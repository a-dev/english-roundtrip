import { expect, test } from 'bun:test';

import { CEFR } from '../domain/levels';
import { createAiModel } from './client';
import { generateExercise } from './generate';
import { gradeTranslation } from './grade';

// Opt-in live smoke test: one real generate + grade against Gemini. Excluded
// from CI; run with `RUN_LIVE_AI=1 GEMINI_API_KEY=... bun test src/ai/live.test.ts`.
const live = process.env.RUN_LIVE_AI === '1' && Boolean(process.env.GEMINI_API_KEY);

test.if(live)(
  'live: generates an exercise and grades a translation end to end',
  async () => {
    const model = createAiModel({
      apiKey: process.env.GEMINI_API_KEY!,
      model: process.env.GEMINI_MODEL,
    });

    const exercise = await generateExercise(
      {
        topicHint: 'Present perfect with for/since',
        taskLanguage: 'ru',
        level: CEFR.B1,
        recentSentences: [],
      },
      { model },
    );

    expect(exercise.sourceSentence.length).toBeGreaterThan(0);
    expect(exercise.referenceTranslation.length).toBeGreaterThan(0);
    expect(exercise.targetPoints.length).toBeGreaterThan(0);

    const grading = await gradeTranslation(
      {
        sourceSentence: exercise.sourceSentence,
        userTranslation: exercise.referenceTranslation,
        topic: 'Present perfect',
        taskLanguage: 'ru',
        level: CEFR.B1,
        referenceTranslation: exercise.referenceTranslation,
        targetPoints: exercise.targetPoints,
        feedbackMode: 'english',
      },
      { model },
    );

    expect(['correct', 'almost', 'needs_work']).toContain(grading.verdict);
    expect(grading.correctedTranslation.length).toBeGreaterThan(0);
  },
  60_000,
);
