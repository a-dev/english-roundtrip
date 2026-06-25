/**
 * Side-by-side model quality check (throwaway dev tool, not shipped behaviour).
 *
 * Runs the real generate + grade pipeline against two or more models on the same
 * inputs and prints the texts so you can eyeball quality. Generation uses shared
 * topics; grading uses a *fixed* flawed translation so feedback is apples-to-apples.
 *
 *   GEMINI_API_KEY=... bun run scripts/compare-models.ts
 *   GEMINI_API_KEY=... bun run scripts/compare-models.ts gemini-3.1-flash-lite gemma-4-31b-it
 */
import { CEFR } from '../src/domain/levels';
import { createAiModel } from '../src/ai/client';
import { generateExercise } from '../src/ai/generate';
import { gradeTranslation } from '../src/ai/grade';

const DEFAULT_MODELS = ['gemini-3.1-flash-lite', 'gemma-4-31b-it'];

const apiKey = Bun.env.GEMINI_API_KEY;
if (apiKey === undefined || apiKey.length === 0) {
  throw new Error('GEMINI_API_KEY must be set in the environment.');
}

const models = Bun.argv.slice(2).length > 0 ? Bun.argv.slice(2) : DEFAULT_MODELS;

const GENERATION_TASKS = [
  { topicHint: 'Present perfect with for/since', taskLanguage: 'ru', level: CEFR.B1 },
  { topicHint: 'Phrasal verbs about work', taskLanguage: 'ru', level: CEFR.B2 },
] as const;

// Fixed grading input: identical for every model, with deliberate errors
// (article, preposition, tense) so the feedback has something to catch.
const GRADING_TASK = {
  sourceSentence: 'Я живу здесь с 2015 года.',
  userTranslation: 'I am living here since 2015 year.',
  topic: 'Present perfect',
  taskLanguage: 'ru',
  level: CEFR.B1,
  referenceTranslation: 'I have lived here since 2015.',
  targetPoints: ['present perfect', 'since'],
  feedbackMode: 'english',
} as const;

function rule(label: string): void {
  console.log(`\n${'='.repeat(72)}\n${label}\n${'='.repeat(72)}`);
}

async function run(): Promise<void> {
  for (const task of GENERATION_TASKS) {
    rule(`GENERATE — ${task.topicHint} (${task.level})`);
    for (const id of models) {
      const model = createAiModel({ apiKey, model: id });
      try {
        const ex = await generateExercise({ ...task, recentSentences: [] }, { model });
        console.log(`\n[${id}]`);
        console.log(`  source:    ${ex.sourceSentence}`);
        console.log(`  EN (ref):  ${ex.referenceTranslation}`);
        console.log(`  points:    ${ex.targetPoints.join(', ')}`);
      } catch (error) {
        console.log(`\n[${id}]  FAILED: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  rule(`GRADE — "${GRADING_TASK.userTranslation}"`);
  for (const id of models) {
    const model = createAiModel({ apiKey, model: id });
    try {
      const g = await gradeTranslation(GRADING_TASK, { model });
      console.log(`\n[${id}]`);
      console.log(`  verdict:     ${g.verdict}`);
      console.log(`  corrected:   ${g.correctedTranslation}`);
      if (g.alternative) console.log(`  alternative: ${g.alternative}`);
      for (const issue of g.issues) {
        console.log(
          `  issue:       [${issue.category}] "${issue.fragment}" — ${issue.explanation}`,
        );
      }
      console.log(`  encourage:   ${g.encouragement}`);
    } catch (error) {
      console.log(`\n[${id}]  FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await run();
