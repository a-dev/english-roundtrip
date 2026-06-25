import { expect, test } from 'bun:test';

import { SessionState } from '../domain/state';
import { cooldownRemainingMs, getCooldownStatus } from './cooldown';

const now = new Date('2026-06-23T10:00:02.999Z');

test('the cooldown is active until the configured gap elapses', () => {
  const session = {
    state: SessionState.AwaitingAnswer,
    lastRequestAt: '2026-06-23T10:00:00.000Z',
  };

  expect(getCooldownStatus(session, 3, now)).toBe('cooldown');
  expect(cooldownRemainingMs(session.lastRequestAt, 3, now)).toBe(1);
  expect(getCooldownStatus(session, 3, new Date('2026-06-23T10:00:03.001Z'))).toBe('allowed');
});

test('an active generation or grade is always reported as in flight', () => {
  expect(getCooldownStatus({ state: SessionState.Generating, lastRequestAt: null }, 3, now)).toBe(
    'in_flight',
  );
  expect(getCooldownStatus({ state: SessionState.Grading, lastRequestAt: null }, 3, now)).toBe(
    'in_flight',
  );
});
