import { expect, test } from 'bun:test';
import type { LanguageModel } from 'ai';

import { CEFR } from '../domain/levels';
import { AiError } from './errors';
import { GRADING_TEMPERATURE, gradeTranslation, type GradeTranslationInput } from './grade';
import type { ObjectGenerator } from './run';

const model = {} as LanguageModel;

const input: GradeTranslationInput = {
  sourceSentence: 'Я уже прочитал эту книгу.',
  userTranslation: 'I already read this book.',
  topic: 'Present perfect',
  taskLanguage: 'ru',
  level: CEFR.B1,
  referenceTranslation: 'I have already read this book.',
  targetPoints: ['present perfect', 'already'],
  feedbackMode: 'source',
};

const flawedGrading = {
  verdict: 'needs_work' as const,
  correctedTranslation: 'I have already read this book.',
  issues: [
    { fragment: 'I already read', category: 'tense', explanation: 'Нужен present perfect.' },
  ],
  alternative: "I've finished this book already.",
  encouragement: 'Хорошая работа!',
};

const correctGrading = {
  verdict: 'correct' as const,
  correctedTranslation: 'I have already read this book.',
  issues: [],
  encouragement: 'Отлично!',
};

function singleShotGenerator(object: unknown) {
  const calls: Array<{ temperature: number }> = [];
  const generator: ObjectGenerator = async (args) => {
    calls.push({ temperature: args.temperature });
    return { object };
  };
  return { generator, calls };
}

test('gradeTranslation maps a flawed answer with categorized issues', async () => {
  const { generator, calls } = singleShotGenerator(flawedGrading);

  const result = await gradeTranslation(input, { model, generator });

  expect(result.verdict).toBe('needs_work');
  expect(result.issues[0]?.category).toBe('tense');
  expect(result.correctedTranslation).toBe('I have already read this book.');
  expect(calls[0]?.temperature).toBe(GRADING_TEMPERATURE);
});

test('gradeTranslation accepts a clearly-correct answer with empty issues', async () => {
  const { generator } = singleShotGenerator(correctGrading);

  const result = await gradeTranslation(input, { model, generator });

  expect(result.verdict).toBe('correct');
  expect(result.issues).toEqual([]);
});

test('gradeTranslation rejects a correct verdict that smuggles in issues', async () => {
  const { generator } = singleShotGenerator({ ...correctGrading, issues: flawedGrading.issues });

  const error = await gradeTranslation(input, { model, generator }).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(AiError);
  expect((error as AiError).operation).toBe('grade');
  expect((error as AiError).kind).toBe('invalid_output');
});
