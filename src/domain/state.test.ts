import { expect, test } from 'bun:test';

import { SessionState, canChooseTaskLanguage, canSubmitAnswer, isSessionState } from './state';

test('the onboarding task-language state is a valid persisted session state', () => {
  expect(isSessionState('choosing_task_language')).toBe(true);
  expect(canChooseTaskLanguage({ state: SessionState.ChoosingTaskLanguage })).toBe(true);
  expect(canChooseTaskLanguage({ state: SessionState.Idle })).toBe(false);
});

test('answers can only be submitted while an exercise is awaiting an answer', () => {
  expect(canSubmitAnswer({ state: SessionState.Idle })).toBe(false);
  expect(canSubmitAnswer({ state: SessionState.ChoosingTaskLanguage })).toBe(false);
  expect(canSubmitAnswer({ state: SessionState.ChoosingCategory })).toBe(false);
  expect(canSubmitAnswer({ state: SessionState.ChoosingTopic })).toBe(false);
  expect(canSubmitAnswer({ state: SessionState.Generating })).toBe(false);
  expect(canSubmitAnswer({ state: SessionState.AwaitingAnswer })).toBe(true);
  expect(canSubmitAnswer({ state: SessionState.Grading })).toBe(false);
  expect(canSubmitAnswer({ state: SessionState.FeedbackShown })).toBe(false);
});
