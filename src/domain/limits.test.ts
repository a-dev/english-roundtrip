import { expect, test } from 'bun:test';

import { DAILY_FREE_LIMIT, isOverDailyLimit } from './limits';

test('isOverDailyLimit is false below the limit and true at or above it', () => {
  expect(isOverDailyLimit(0)).toBe(false);
  expect(isOverDailyLimit(DAILY_FREE_LIMIT - 1)).toBe(false);
  expect(isOverDailyLimit(DAILY_FREE_LIMIT)).toBe(true);
  expect(isOverDailyLimit(DAILY_FREE_LIMIT + 1)).toBe(true);
});
