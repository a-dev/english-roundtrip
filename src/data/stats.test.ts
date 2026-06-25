import { afterEach, beforeEach, expect, test } from 'bun:test';

import { TestD1 } from './test-d1';
import { createStatsRepository } from './stats';

let testD1: TestD1;

beforeEach(async () => {
  testD1 = new TestD1();
  await testD1.migrate();
});

afterEach(() => {
  testD1.close();
});

test('recordResult updates totals and reports percentage accuracy', async () => {
  const stats = createStatsRepository(testD1.asD1(), {
    now: () => new Date('2026-06-23T10:00:00.000Z'),
  });

  await stats.recordResult(123, { correct: true, categories: [] });
  const result = await stats.recordResult(123, { correct: false, categories: [] });

  expect(result).toMatchObject({
    telegramId: 123,
    totalExercises: 2,
    totalCorrect: 1,
    accuracy: 50,
    currentStreak: 1,
    longestStreak: 1,
  });
});

test('streaks advance once per consecutive active day and reset after a gap', async () => {
  let currentTime = new Date('2026-06-20T10:00:00.000Z');
  const stats = createStatsRepository(testD1.asD1(), { now: () => currentTime });

  await stats.recordResult(123, { correct: true, categories: [] });
  await stats.recordResult(123, { correct: true, categories: [] });
  currentTime = new Date('2026-06-21T10:00:00.000Z');
  const consecutiveDay = await stats.recordResult(123, { correct: true, categories: [] });
  currentTime = new Date('2026-06-24T10:00:00.000Z');
  const afterGap = await stats.recordResult(123, { correct: true, categories: [] });

  expect(consecutiveDay).toMatchObject({ currentStreak: 2, longestStreak: 2 });
  expect(afterGap).toMatchObject({ currentStreak: 1, longestStreak: 2 });
  expect(afterGap.currentStreak).toBeGreaterThanOrEqual(0);
});

test('error categories are tallied and returned in weakest-first top-N order', async () => {
  const stats = createStatsRepository(testD1.asD1(), {
    weakCategoryLimit: 2,
    now: () => new Date('2026-06-23T10:00:00.000Z'),
  });

  await stats.recordResult(123, { correct: false, categories: ['article', 'article', 'tense'] });
  const result = await stats.recordResult(123, {
    correct: false,
    categories: ['spelling', 'spelling', 'spelling'],
  });

  expect(result.weakCategories).toEqual([
    { category: 'spelling', count: 3 },
    { category: 'article', count: 2 },
  ]);
});
