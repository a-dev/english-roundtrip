import { z } from 'zod';

import { ERROR_CATEGORIES } from '../domain/errors';

/**
 * Counts sentence-like segments by splitting on terminal punctuation. Used to
 * enforce the "exactly one source sentence" rule structurally rather than
 * trusting the prompt alone.
 */
function sentenceCount(text: string): number {
  return text
    .split(/[.!?…。！？؟]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0).length;
}

/** Output of `generateExercise` — one sentence to translate plus grading aids. */
export const GenerationSchema = z.object({
  // The ONE source-language sentence the learner translates into English.
  sourceSentence: z
    .string()
    .trim()
    .min(1, 'sourceSentence must not be empty.')
    .refine(
      (value) => sentenceCount(value) === 1,
      'sourceSentence must contain exactly one sentence.',
    ),
  // Natural English translation, hidden from the user, stored for grading.
  referenceTranslation: z.string().trim().min(1, 'referenceTranslation must not be empty.'),
  // What the sentence is testing, e.g. ["present perfect", "for/since"].
  targetPoints: z
    .array(z.string().trim().min(1))
    .min(1, 'targetPoints must list at least one focus.'),
});

export type Generation = z.infer<typeof GenerationSchema>;

/** Closed set of error categories shared with the stats layer (domain/errors). */
export const ErrorCategorySchema = z.enum(ERROR_CATEGORIES);

export const GradingVerdictSchema = z.enum(['correct', 'almost', 'needs_work']);
export type GradingVerdict = z.infer<typeof GradingVerdictSchema>;

export const GradingIssueSchema = z.object({
  fragment: z.string().min(1), // the user's problematic span
  category: ErrorCategorySchema,
  explanation: z.string().min(1), // in the resolved feedback language
});

export type GradingIssue = z.infer<typeof GradingIssueSchema>;

/** Output of `gradeTranslation`. */
export const GradingSchema = z
  .object({
    verdict: GradingVerdictSchema,
    correctedTranslation: z.string().min(1), // always English
    issues: z.array(GradingIssueSchema),
    alternative: z.string().min(1).optional(), // more idiomatic English phrasing
    encouragement: z.string().min(1), // in the resolved feedback language
  })
  // A "correct" verdict carries no issues; the formatter and stats logic rely
  // on this invariant (context.md §5.3).
  .refine((value) => value.verdict !== 'correct' || value.issues.length === 0, {
    message: "A 'correct' verdict must have no issues.",
    path: ['issues'],
  });

export type Grading = z.infer<typeof GradingSchema>;
