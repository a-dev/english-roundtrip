import { expect, test } from 'bun:test';

import { ERROR_CATEGORIES } from '../domain/errors';
import { GenerationSchema, GradingSchema } from './schemas';

const validGeneration = {
  sourceSentence: 'Я уже прочитал эту книгу.',
  referenceTranslation: 'I have already read this book.',
  targetPoints: ['present perfect', 'already'],
};

const validGrading = {
  verdict: 'needs_work' as const,
  correctedTranslation: 'I have already read this book.',
  issues: [
    {
      fragment: 'I already read',
      category: 'tense' as const,
      explanation: 'Используйте present perfect.',
    },
  ],
  alternative: "I've finished this book already.",
  encouragement: 'Хорошая попытка!',
};

test('GenerationSchema parses a golden object', () => {
  expect(GenerationSchema.parse(validGeneration)).toEqual(validGeneration);
});

test('GenerationSchema rejects missing fields', () => {
  const { referenceTranslation: _referenceTranslation, ...withoutReference } = validGeneration;
  expect(GenerationSchema.safeParse(withoutReference).success).toBe(false);
});

test('GenerationSchema rejects an empty targetPoints list', () => {
  expect(GenerationSchema.safeParse({ ...validGeneration, targetPoints: [] }).success).toBe(false);
});

test('GenerationSchema rejects multiple sentences in sourceSentence', () => {
  const result = GenerationSchema.safeParse({
    ...validGeneration,
    sourceSentence: 'Я прочитал книгу. Она была интересной.',
  });
  expect(result.success).toBe(false);
});

test('GenerationSchema accepts a single sentence ending in other punctuation', () => {
  expect(
    GenerationSchema.safeParse({ ...validGeneration, sourceSentence: 'Ты уже прочитал книгу?' })
      .success,
  ).toBe(true);
});

test('GenerationSchema accepts single CJK and Arabic sentences', () => {
  expect(
    GenerationSchema.safeParse({ ...validGeneration, sourceSentence: '我今天要去图书馆。' })
      .success,
  ).toBe(true);
  expect(
    GenerationSchema.safeParse({ ...validGeneration, sourceSentence: '今日は図書館に行きます。' })
      .success,
  ).toBe(true);
  expect(
    GenerationSchema.safeParse({ ...validGeneration, sourceSentence: 'هل قرأت الكتاب؟' }).success,
  ).toBe(true);
});

test('GenerationSchema rejects multiple CJK and Arabic sentences', () => {
  expect(
    GenerationSchema.safeParse({
      ...validGeneration,
      sourceSentence: '我今天要去图书馆。明天我要工作。',
    }).success,
  ).toBe(false);
  expect(
    GenerationSchema.safeParse({
      ...validGeneration,
      sourceSentence: 'هل قرأت الكتاب؟ متى ستعيده؟',
    }).success,
  ).toBe(false);
});

test('GradingSchema parses a golden object', () => {
  expect(GradingSchema.parse(validGrading)).toEqual(validGrading);
});

test('GradingSchema allows a correct verdict with empty issues', () => {
  const correct = {
    ...validGrading,
    verdict: 'correct' as const,
    issues: [],
    alternative: undefined,
  };
  expect(GradingSchema.safeParse(correct).success).toBe(true);
});

test('GradingSchema rejects a correct verdict that still reports issues', () => {
  const result = GradingSchema.safeParse({ ...validGrading, verdict: 'correct' });
  expect(result.success).toBe(false);
});

test('GradingSchema rejects an unknown error category', () => {
  const result = GradingSchema.safeParse({
    ...validGrading,
    issues: [{ fragment: 'x', category: 'made-up', explanation: 'y' }],
  });
  expect(result.success).toBe(false);
});

test('GradingSchema rejects an invalid verdict', () => {
  expect(GradingSchema.safeParse({ ...validGrading, verdict: 'perfect' }).success).toBe(false);
});

test('every domain error category is an accepted grading category', () => {
  for (const category of ERROR_CATEGORIES) {
    const result = GradingSchema.safeParse({
      ...validGrading,
      issues: [{ fragment: 'x', category, explanation: 'y' }],
    });
    expect(result.success).toBe(true);
  }
});
