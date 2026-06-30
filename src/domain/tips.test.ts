import { expect, test } from 'bun:test';

import { isTipTier, TIP_TIERS } from './tips';

test('isTipTier accepts each configured tier', () => {
  for (const tier of TIP_TIERS) {
    expect(isTipTier(tier)).toBe(true);
  }
});

test('isTipTier rejects amounts outside the configured tiers', () => {
  for (const value of [0, 1, 49, 75, 1_000, -100, Number.NaN]) {
    expect(isTipTier(value)).toBe(false);
  }
});
