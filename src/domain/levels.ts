/** CEFR levels supported by the exercise generator and grader. */
export enum CEFR {
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
}

export const CEFR_LABELS: Readonly<Record<CEFR, string>> = {
  [CEFR.A2]: 'A2 — Elementary',
  [CEFR.B1]: 'B1 — Intermediate',
  [CEFR.B2]: 'B2 — Upper-intermediate',
  [CEFR.C1]: 'C1 — Advanced',
};

/** Instructions included in generation and grading prompts for each level. */
export const CEFR_DESCRIPTORS: Readonly<Record<CEFR, string>> = {
  [CEFR.A2]:
    'Use short, familiar sentences with common vocabulary and simple present, past, and future forms.',
  [CEFR.B1]:
    'Use everyday topics with connected sentences and common grammar such as present perfect, conditionals, and modals.',
  [CEFR.B2]:
    'Use varied sentence structures, less frequent vocabulary, and nuanced grammar appropriate for independent users.',
  [CEFR.C1]:
    'Use precise, natural language with complex structures, idiomatic phrasing, and subtle distinctions in meaning.',
};

export function getLevelDescriptor(level: CEFR): string {
  return CEFR_DESCRIPTORS[level];
}
