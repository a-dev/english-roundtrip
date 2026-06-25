/** Which AI touchpoint failed — useful for logs and user-facing copy. */
export type AiOperation = 'generate' | 'grade';

/**
 * Why an AI call failed after exhausting retries:
 * - `timeout`        — the call exceeded its time budget.
 * - `invalid_output` — the model returned output that never matched the schema.
 * - `rate_limited`   — the provider declined a request temporarily.
 * - `daily_limit`    — the provider's daily quota has been exhausted.
 * - `provider_error` — the provider threw (network, quota, 5xx, …).
 */
export type AiErrorKind =
  | 'timeout'
  | 'invalid_output'
  | 'rate_limited'
  | 'daily_limit'
  | 'provider_error';

/**
 * The single typed failure surfaced by `generateExercise` / `gradeTranslation`.
 * Callers (bot handlers, rate limiter) branch on `kind` rather than sniffing
 * provider-specific error shapes, keeping the AI layer provider-agnostic.
 */
export class AiError extends Error {
  readonly operation: AiOperation;
  readonly kind: AiErrorKind;

  constructor(operation: AiOperation, kind: AiErrorKind, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AiError';
    this.operation = operation;
    this.kind = kind;
  }
}
