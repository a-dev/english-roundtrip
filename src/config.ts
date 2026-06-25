import { z } from 'zod';

/** Bindings and variables supplied by Cloudflare Workers. */
export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  GEMINI_API_KEY: string;
  WEBHOOK_SECRET: string;
  GEMINI_MODEL: string;
  COOLDOWN_SECONDS?: string | number;
  ANTI_REPEAT_WINDOW: string | number;
}

const envSchema = z.object({
  DB: z.custom<D1Database>(
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      'prepare' in value &&
      typeof value.prepare === 'function',
    'The DB D1 binding is required.',
  ),
  BOT_TOKEN: z.string().trim().min(1, 'BOT_TOKEN is required.'),
  GEMINI_API_KEY: z.string().trim().min(1, 'GEMINI_API_KEY is required.'),
  WEBHOOK_SECRET: z.string().trim().min(1, 'WEBHOOK_SECRET is required.'),
  GEMINI_MODEL: z.string().trim().min(1, 'GEMINI_MODEL is required.'),
  COOLDOWN_SECONDS: z.coerce
    .number()
    .int('COOLDOWN_SECONDS must be an integer.')
    .positive('COOLDOWN_SECONDS must be greater than zero.')
    .default(3),
  ANTI_REPEAT_WINDOW: z.coerce
    .number()
    .int('ANTI_REPEAT_WINDOW must be an integer.')
    .positive('ANTI_REPEAT_WINDOW must be greater than zero.'),
});

export type Config = z.infer<typeof envSchema>;

/**
 * Validates worker bindings at the request boundary so configuration failures
 * are explicit instead of surfacing later in bot or database code.
 */
export function parseEnv(env: Env): Config {
  return envSchema.parse(env);
}
