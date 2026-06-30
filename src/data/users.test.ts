import { afterEach, beforeEach, expect, test } from 'bun:test';

import { TestD1 } from './test-d1';
import { createUsersRepository } from './users';
import { CEFR } from '../domain/levels';

let testD1: TestD1;

beforeEach(async () => {
  testD1 = new TestD1();
  await testD1.migrate();
});

afterEach(() => {
  testD1.close();
});

test('migration stores onboarding and feedback-mode fields without the legacy feedback language', async () => {
  const schema = await testD1
    .asD1()
    .prepare("SELECT name FROM pragma_table_info('users') ORDER BY cid")
    .all<{ name: string }>();

  expect(schema.results.map((column) => column.name)).toEqual([
    'telegram_id',
    'task_language',
    'feedback_mode',
    'level',
    'created_at',
    'updated_at',
    'role',
  ]);
});

test('role defaults to null and round-trips through setRole', async () => {
  const users = createUsersRepository(testD1.asD1());

  expect((await users.getOrCreateUser(7)).role).toBeNull();

  const promoted = await users.setRole(7, 'premium');
  expect(promoted.role).toBe('premium');
  expect((await users.getOrCreateUser(7)).role).toBe('premium');

  const cleared = await users.setRole(7, null);
  expect(cleared.role).toBeNull();
});

test('getOrCreateUser provisions an idempotent default profile', async () => {
  const users = createUsersRepository(testD1.asD1());

  const first = await users.getOrCreateUser(123_456);
  const second = await users.getOrCreateUser(123_456);

  expect(first).toMatchObject({
    telegramId: 123_456,
    taskLanguage: null,
    feedbackMode: 'english',
    level: 'B1',
  });
  expect(second).toEqual(first);
});

test('profile setters provision a new user and persist task language, feedback mode, and level', async () => {
  const users = createUsersRepository(testD1.asD1());

  const withFeedbackMode = await users.setFeedbackMode(99, 'source');
  const withTaskLanguage = await users.setTaskLanguage(99, 'uk');
  const withLevel = await users.setLevel(99, CEFR.C1);
  const persisted = await users.getOrCreateUser(99);

  expect(withFeedbackMode.feedbackMode).toBe('source');
  expect(withTaskLanguage.taskLanguage).toBe('uk');
  expect(withLevel.level).toBe(CEFR.C1);
  expect(persisted).toMatchObject({ taskLanguage: 'uk', feedbackMode: 'source', level: CEFR.C1 });
});
