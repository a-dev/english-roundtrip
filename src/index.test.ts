import { expect, test } from 'bun:test';

import { handleWebhookRequest } from './index';
import type { Env } from './config';

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

function webhookRequest(secretToken?: string): Request {
  return new Request('https://worker.example', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secretToken === undefined ? {} : { 'X-Telegram-Bot-Api-Secret-Token': secretToken }),
    },
    body: JSON.stringify({ update_id: 1 }),
  });
}

test('worker accepts a request with the configured Telegram secret', async () => {
  const response = await handleWebhookRequest(
    webhookRequest('webhook-secret'),
    validEnv(),
    async () => new Response(null, { status: 200 }),
  );

  expect(response.status).toBe(200);
});

test('worker rejects a missing or mismatched Telegram secret', async () => {
  let dispatched = false;
  const dispatch = async () => {
    dispatched = true;
    return new Response(null, { status: 200 });
  };

  expect((await handleWebhookRequest(webhookRequest(), validEnv(), dispatch)).status).toBe(401);
  expect(
    (await handleWebhookRequest(webhookRequest('wrong-secret'), validEnv(), dispatch)).status,
  ).toBe(401);
  expect(dispatched).toBe(false);
});

test('worker acknowledges a valid update even when webhook dispatch fails', async () => {
  const response = await handleWebhookRequest(
    webhookRequest('webhook-secret'),
    validEnv(),
    async () => {
      throw new Error('simulated failure');
    },
  );

  expect(response.status).toBe(200);
});

test('worker acknowledges an update when configuration parsing fails', async () => {
  const response = await handleWebhookRequest(webhookRequest('webhook-secret'), {
    ...validEnv(),
    BOT_TOKEN: '',
  });

  expect(response.status).toBe(200);
});
