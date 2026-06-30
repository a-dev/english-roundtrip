import { afterEach, beforeEach, expect, test } from 'bun:test';
import type { Context } from 'grammy';

import { startExercise } from './practice';
import type { HandlerDependencies } from './types';
import { createDataLayer } from '../data';
import { TestD1 } from '../data/test-d1';
import { getTopic } from '../domain/topics';
import { SessionState } from '../domain/state';
import { DAILY_FREE_LIMIT } from '../domain/limits';
import { COPY } from '../ui/copy';

const LEARNER_ID = 123;
const topic = getTopic('present-perfect')!;

let database: TestD1;

beforeEach(async () => {
  database = new TestD1();
  await database.migrate();
});

afterEach(() => {
  database.close();
});

function fakeContext(): { context: Context; replies: string[] } {
  const replies: string[] = [];
  const context = {
    from: { id: LEARNER_ID },
    async reply(text: string) {
      replies.push(text);
    },
  } as unknown as Context;
  return { context, replies };
}

function createFixture() {
  const data = createDataLayer({ DB: database.asD1(), ANTI_REPEAT_WINDOW: 10 });
  const generated: unknown[] = [];
  const dependencies: HandlerDependencies = {
    data,
    cooldownSeconds: 0,
    async generateExercise(input) {
      generated.push(input);
      return {
        sourceSentence: 'Ya he terminado el trabajo.',
        referenceTranslation: 'I have already finished work.',
        targetPoints: ['present perfect'],
      };
    },
    async gradeTranslation() {
      throw new Error('gradeTranslation should not be called by startExercise');
    },
  };
  return { data, dependencies, generated };
}

test('a capped non-exempt user is refused and no generation is attempted', async () => {
  const { data, dependencies, generated } = createFixture();
  const { context, replies } = fakeContext();

  for (let i = 0; i < DAILY_FREE_LIMIT; i += 1) {
    await data.stats.incrementDailyCount(LEARNER_ID);
  }
  await data.sessions.setState(LEARNER_ID, SessionState.ChoosingTopic);

  await startExercise(context, dependencies, topic);

  expect(replies).toEqual([COPY.dailyCapReached]);
  expect(generated).toHaveLength(0);
  // The lease was never taken, so the session is untouched.
  expect((await data.sessions.getSession(LEARNER_ID)).state).toBe(SessionState.ChoosingTopic);
});

test('an exempt user past the cap still gets an exercise', async () => {
  const { data, dependencies, generated } = createFixture();
  const { context } = fakeContext();

  await data.users.setRole(LEARNER_ID, 'premium');
  for (let i = 0; i < DAILY_FREE_LIMIT + 5; i += 1) {
    await data.stats.incrementDailyCount(LEARNER_ID);
  }
  await data.sessions.setState(LEARNER_ID, SessionState.ChoosingTopic);

  await startExercise(context, dependencies, topic);

  expect(generated).toHaveLength(1);
  expect((await data.sessions.getSession(LEARNER_ID)).state).toBe(SessionState.AwaitingAnswer);
});

test('a successful generation increments the daily count exactly once', async () => {
  const { data, dependencies } = createFixture();
  const { context, replies } = fakeContext();

  await data.sessions.setState(LEARNER_ID, SessionState.ChoosingTopic);

  await startExercise(context, dependencies, topic);

  expect(replies[0]).toContain('Translate from');
  expect(await data.stats.getDailyCount(LEARNER_ID)).toBe(1);
});
