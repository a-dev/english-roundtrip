import { expect, test } from 'bun:test';

import { EXEMPT_ROLES, isExempt } from './roles';

test('every exempt role is recognised as exempt', () => {
  for (const role of EXEMPT_ROLES) {
    expect(isExempt(role)).toBe(true);
  }
});

test('null and unknown roles are not exempt', () => {
  expect(isExempt(null)).toBe(false);
  expect(isExempt('')).toBe(false);
  expect(isExempt('learner')).toBe(false);
});
