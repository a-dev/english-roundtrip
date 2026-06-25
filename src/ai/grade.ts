import type { CEFR } from '../domain/levels';
import { getTaskLanguageLabels, type LanguageCode } from '../domain/languages';
import type { FeedbackMode } from '../data/users';
import { buildGradingPrompt } from './prompts';
import { GradingSchema, type Grading } from './schemas';
import { defaultObjectGenerator, runStructured } from './run';
import type { AiCallOptions } from './generate';

/** Lower temperature favours consistent, repeatable grading. */
export const GRADING_TEMPERATURE = 0.2;

export interface GradeTranslationInput {
  sourceSentence: string;
  userTranslation: string;
  topic: string;
  taskLanguage: LanguageCode;
  level: CEFR;
  referenceTranslation: string;
  targetPoints: readonly string[];
  feedbackMode: FeedbackMode;
}

/**
 * Grades the learner's English translation into a validated `GradingSchema`:
 * verdict, English correction, categorized issues, and encouragement in the
 * resolved feedback language. Retries once on invalid output, then throws a typed
 * `AiError` (see {@link runStructured}).
 */
export function gradeTranslation(
  input: GradeTranslationInput,
  options: AiCallOptions,
): Promise<Grading> {
  const { system, prompt } = buildGradingPrompt({
    ...input,
    taskLanguageLabel: getTaskLanguageLabels(input.taskLanguage).englishLabel,
  });
  return runStructured({
    operation: 'grade',
    schema: GradingSchema,
    system,
    prompt,
    temperature: GRADING_TEMPERATURE,
    model: options.model,
    generator: options.generator ?? defaultObjectGenerator,
    timeoutMs: options.timeoutMs,
    sleep: options.sleep,
  });
}
