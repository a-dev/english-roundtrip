import { expect, test } from 'bun:test';

import { CEFR, CEFR_DESCRIPTORS, CEFR_LABELS } from './levels';

test('every supported CEFR level has a display label and prompt descriptor', () => {
  for (const level of Object.values(CEFR)) {
    expect(CEFR_LABELS[level]).toContain(level);
    expect(CEFR_DESCRIPTORS[level].length).toBeGreaterThan(20);
  }
});
