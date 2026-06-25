/**
 * The single source of truth for translation error categories.
 *
 * The AI grading schema ([[schemas]]) validates each issue's `category`
 * against this list, and the stats layer tallies weak spots by the same keys,
 * so generation, grading, and analytics all agree on one closed set.
 */
export const ERROR_CATEGORIES = [
  'tense',
  'aspect',
  'article',
  'preposition',
  'word-order',
  'agreement',
  'vocabulary',
  'spelling',
  'punctuation',
  'other',
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];
