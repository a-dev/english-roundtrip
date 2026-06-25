import { expect, test } from 'bun:test';

import { parseEnv, type Env } from './config';

function validEnv(): Env {
  return {
    DB: { prepare: () => ({}) } as unknown as D1Database,
    BOT_TOKEN: 'bot-token',
    GEMINI_API_KEY: 'gemini-api-key',
    WEBHOOK_SECRET: 'webhook-secret',
    GEMINI_MODEL: 'gemini-2.5-flash',
    COOLDOWN_SECONDS: '3',
    ANTI_REPEAT_WINDOW: '10',
  };
}

test('parseEnv rejects missing required secrets', () => {
  expect(() => parseEnv({ ...validEnv(), BOT_TOKEN: '' })).toThrow('BOT_TOKEN is required');
});

test('parseEnv rejects invalid numeric tunables', () => {
  expect(() => parseEnv({ ...validEnv(), COOLDOWN_SECONDS: '0' })).toThrow(
    'COOLDOWN_SECONDS must be greater than zero',
  );
  expect(() => parseEnv({ ...validEnv(), ANTI_REPEAT_WINDOW: 'not-a-number' })).toThrow();
});

test('parseEnv converts numeric worker variables to numbers', () => {
  const config = parseEnv(validEnv());

  expect(config.COOLDOWN_SECONDS).toBe(3);
  expect(config.ANTI_REPEAT_WINDOW).toBe(10);
});

test('parseEnv defaults the cooldown to three seconds', () => {
  const { COOLDOWN_SECONDS: _cooldownSeconds, ...envWithoutCooldown } = validEnv();

  expect(parseEnv(envWithoutCooldown).COOLDOWN_SECONDS).toBe(3);
});
