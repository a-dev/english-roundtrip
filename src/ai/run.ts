import { APICallError, generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import type { z } from 'zod';

import { AiError, type AiOperation } from './errors';

/** Default per-call time budget; on overrun the call fails as a timeout. */
export const DEFAULT_AI_TIMEOUT_MS = 20_000;

/** Total attempts: one initial call plus a single retry on invalid output. */
export const DEFAULT_MAX_ATTEMPTS = 2;

/** Wait at most this long before the one user-facing rate-limit retry. */
export const MAX_RATE_LIMIT_RETRY_MS = 5_000;

export interface ObjectGeneratorArgs {
  model: LanguageModel;
  schema: z.ZodType<unknown>;
  system: string;
  prompt: string;
  temperature: number;
  abortSignal: AbortSignal;
}

/**
 * The single structured-generation call, narrowed to plain data so tests can
 * inject fixtures without the real AI SDK. The default wraps `generateObject`.
 */
export type ObjectGenerator = (args: ObjectGeneratorArgs) => Promise<{ object: unknown }>;

export const defaultObjectGenerator: ObjectGenerator = async (args) => {
  const { object } = await generateObject({
    model: args.model,
    schema: args.schema,
    system: args.system,
    prompt: args.prompt,
    temperature: args.temperature,
    abortSignal: args.abortSignal,
    // The SDK otherwise retries rate limits by default. Resilience policy is
    // owned here so quota usage and learner-facing behaviour stay predictable.
    maxRetries: 0,
  });
  return { object };
};

/** Private sentinel so timeouts are distinguishable from provider throws. */
class TimeoutSignal {}

async function callWithTimeout(
  generator: ObjectGenerator,
  args: Omit<ObjectGeneratorArgs, 'abortSignal'>,
  timeoutMs: number,
): Promise<{ object: unknown }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutSignal());
    }, timeoutMs);
  });

  try {
    return await Promise.race([generator({ ...args, abortSignal: controller.signal }), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export interface RunStructuredParams<T> {
  operation: AiOperation;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature: number;
  model: LanguageModel;
  generator: ObjectGenerator;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Injectable only to make the rate-limit wait deterministic in tests. */
  sleep?: (milliseconds: number) => Promise<void>;
}

interface ProviderRateLimit {
  dailyLimit: boolean;
  retryAfterMs: number | null;
}

function responseHeaders(error: unknown): Record<string, string> | undefined {
  if (APICallError.isInstance(error)) return error.responseHeaders;
  if (typeof error !== 'object' || error === null || !('responseHeaders' in error))
    return undefined;

  const headers = error.responseHeaders;
  if (typeof headers !== 'object' || headers === null) return undefined;
  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function providerStatusCode(error: unknown): number | undefined {
  if (APICallError.isInstance(error)) return error.statusCode;
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  return typeof error.statusCode === 'number' ? error.statusCode : undefined;
}

function providerErrorText(error: unknown): string {
  if (error instanceof Error) {
    const body = APICallError.isInstance(error) ? error.responseBody : undefined;
    return `${error.message}\n${body ?? ''}`.toLowerCase();
  }
  return '';
}

function parseRetryAfterMs(headers: Record<string, string> | undefined): number | null {
  if (headers === undefined) return null;
  const lowerCaseHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const retryAfterMs = Number(lowerCaseHeaders['retry-after-ms']);
  if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) return retryAfterMs;

  const retryAfter = lowerCaseHeaders['retry-after'];
  if (retryAfter === undefined) return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

  const retryAt = Date.parse(retryAfter);
  return Number.isNaN(retryAt) ? null : Math.max(0, retryAt - Date.now());
}

function getProviderRateLimit(error: unknown): ProviderRateLimit | null {
  if (providerStatusCode(error) !== 429) return null;

  const text = providerErrorText(error);
  return {
    // Gemini's quota responses vary by endpoint. These signals identify an
    // exhausted daily allowance without treating ordinary short throttles as
    // a day-long outage.
    dailyLimit: /\bdaily\b|\bper[ _-]?day\b|\brequests?[ _-]?per[ _-]?day\b|\brpd\b/.test(text),
    retryAfterMs: parseRetryAfterMs(responseHeaders(error)),
  };
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Runs a structured AI call with a bounded timeout, a single retry on invalid
 * output, and at most one short provider-advised rate-limit retry. Every
 * failure is surfaced as a typed {@link AiError}.
 * The model's structured output is re-validated here so the contract holds
 * regardless of how the underlying generator was produced.
 */
export async function runStructured<T>(params: RunStructuredParams<T>): Promise<T> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sleep = params.sleep ?? defaultSleep;

  let lastError: unknown;
  let rateLimitRetries = 0;

  for (let attempt = 1; attempt <= maxAttempts; ) {
    let object: unknown;
    try {
      ({ object } = await callWithTimeout(
        params.generator,
        {
          model: params.model,
          schema: params.schema,
          system: params.system,
          prompt: params.prompt,
          temperature: params.temperature,
        },
        timeoutMs,
      ));
    } catch (error) {
      // A timeout is terminal: retrying would only double the latency budget.
      if (error instanceof TimeoutSignal) {
        throw new AiError(
          params.operation,
          'timeout',
          `${params.operation} timed out after ${timeoutMs}ms.`,
        );
      }

      const rateLimit = getProviderRateLimit(error);
      if (rateLimit !== null) {
        if (rateLimit.dailyLimit) {
          throw new AiError(
            params.operation,
            'daily_limit',
            `${params.operation} hit the daily provider limit.`,
            error,
          );
        }
        if (
          rateLimitRetries === 0 &&
          rateLimit.retryAfterMs !== null &&
          rateLimit.retryAfterMs <= MAX_RATE_LIMIT_RETRY_MS
        ) {
          rateLimitRetries++;
          await sleep(rateLimit.retryAfterMs);
          continue;
        }
        throw new AiError(
          params.operation,
          'rate_limited',
          `${params.operation} was rate limited.`,
          error,
        );
      }

      throw new AiError(params.operation, 'provider_error', `${params.operation} failed.`, error);
    }

    const parsed = params.schema.safeParse(object);
    if (parsed.success) {
      return parsed.data;
    }
    lastError = parsed.error;
    attempt++;
  }

  throw new AiError(
    params.operation,
    'invalid_output',
    `${params.operation} failed after ${maxAttempts} attempt(s).`,
    lastError,
  );
}
