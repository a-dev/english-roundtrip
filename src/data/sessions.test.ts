import { afterEach, beforeEach, expect, test } from 'bun:test';

import { SessionState } from '../domain/state';
import { TestD1 } from './test-d1';
import { createSessionsRepository } from './sessions';

let testD1: TestD1;

beforeEach(async () => {
  testD1 = new TestD1();
  await testD1.migrate();
});

afterEach(() => {
  testD1.close();
});

test('starting an exercise provisions its user and persists state changes', async () => {
  const sessions = createSessionsRepository(testD1.asD1(), { antiRepeatWindow: 3 });

  const started = await sessions.startExercise(
    123,
    'present-perfect',
    'Я уже закончил работу.',
    'I have already finished work.',
    ['present perfect', 'already'],
  );
  const feedback = await sessions.setState(123, SessionState.FeedbackShown);
  const stored = await sessions.getSession(123);

  expect(started).toMatchObject({
    telegramId: 123,
    state: SessionState.AwaitingAnswer,
    topicId: 'present-perfect',
    sourceSentence: 'Я уже закончил работу.',
    referenceTranslation: 'I have already finished work.',
    targetPoints: ['present perfect', 'already'],
  });
  expect(feedback.state).toBe(SessionState.FeedbackShown);
  expect(stored).toEqual(feedback);
});

test('recent sentences retain only the configured anti-repeat window', async () => {
  const sessions = createSessionsRepository(testD1.asD1(), { antiRepeatWindow: 3 });

  await sessions.pushRecentSentence(123, 'one');
  await sessions.pushRecentSentence(123, 'two');
  await sessions.pushRecentSentence(123, 'three');
  const recent = await sessions.pushRecentSentence(123, 'four');

  expect(recent.recentSentences).toEqual(['two', 'three', 'four']);
});

test('touchRequest persists a cooldown timestamp from the injected clock', async () => {
  const requestTime = new Date('2026-06-23T10:15:30.000Z');
  const sessions = createSessionsRepository(testD1.asD1(), {
    antiRepeatWindow: 3,
    now: () => requestTime,
  });

  const touched = await sessions.touchRequest(123);

  expect(touched.lastRequestAt).toBe(requestTime.toISOString());
});

test('an AI request lease blocks concurrent calls and allows the next call after the cooldown', async () => {
  let currentTime = new Date('2026-06-23T10:00:00.000Z');
  const sessions = createSessionsRepository(testD1.asD1(), {
    antiRepeatWindow: 3,
    now: () => currentTime,
  });
  await sessions.setState(123, SessionState.ChoosingTopic);

  const first = await sessions.beginAiRequest(
    123,
    SessionState.Generating,
    [SessionState.ChoosingTopic],
    3,
  );
  const concurrent = await sessions.beginAiRequest(
    123,
    SessionState.Generating,
    [SessionState.ChoosingTopic],
    3,
  );

  expect(first.acquired).toBe(true);
  expect(concurrent).toMatchObject({ acquired: false, reason: 'in_flight' });

  await sessions.restoreAiRequest(123, SessionState.Generating, SessionState.ChoosingTopic);
  const tooSoon = await sessions.beginAiRequest(
    123,
    SessionState.Generating,
    [SessionState.ChoosingTopic],
    3,
  );
  expect(tooSoon).toMatchObject({ acquired: false, reason: 'cooldown' });

  currentTime = new Date('2026-06-23T10:00:03.001Z');
  const afterGap = await sessions.beginAiRequest(
    123,
    SessionState.Generating,
    [SessionState.ChoosingTopic],
    3,
  );
  expect(afterGap.acquired).toBe(true);
});

test('clear removes the in-flight exercise while retaining anti-repeat and cooldown data', async () => {
  const sessions = createSessionsRepository(testD1.asD1(), { antiRepeatWindow: 3 });
  await sessions.startExercise(123, 'articles', 'Это книга.', 'This is a book.', ['article']);
  await sessions.pushRecentSentence(123, 'Это книга.');
  await sessions.touchRequest(123);

  const cleared = await sessions.clear(123);

  expect(cleared).toMatchObject({
    state: SessionState.Idle,
    topicId: null,
    sourceSentence: null,
    referenceTranslation: null,
    targetPoints: [],
    recentSentences: ['Это книга.'],
  });
  expect(cleared.lastRequestAt).not.toBeNull();
});
