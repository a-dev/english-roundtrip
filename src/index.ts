import { timingSafeEqual } from 'node:crypto';

import { webhookCallback } from 'grammy';

import { DEFAULT_AI_TIMEOUT_MS } from './ai/run';
import { createBot, createBotDependencies, registerBotCommands } from './bot';
import { parseEnv, type Config, type Env } from './config';

const telegramSecretHeader = 'X-Telegram-Bot-Api-Secret-Token';

/** Compare two secrets in constant time so response latency can't leak the secret. */
function secretsMatch(provided: string, expected: string): boolean {
  const providedBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);
  // timingSafeEqual throws on length mismatch, so the length guard short-circuits first.
  return (
    providedBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

export function hasValidWebhookSecret(request: Request, webhookSecret: string): boolean {
  const provided = request.headers.get(telegramSecretHeader);
  return provided !== null && secretsMatch(provided, webhookSecret);
}

type WebhookDispatcher = (request: Request, config: Config) => Promise<Response>;

let cachedBotToken: string | undefined;
let cachedWebhookHandler: ((request: Request) => Promise<Response>) | undefined;

async function dispatchToTelegram(request: Request, config: Config): Promise<Response> {
  if (cachedBotToken !== config.BOT_TOKEN || cachedWebhookHandler === undefined) {
    cachedBotToken = config.BOT_TOKEN;
    const bot = createBot(config.BOT_TOKEN, createBotDependencies(config));
    await bot.init();
    await registerBotCommands(bot);
    // Keep grammY's webhook budget above one bounded AI call. Its default is
    // 10 seconds, which would otherwise abandon our 20-second timeout policy.
    cachedWebhookHandler = webhookCallback(bot, 'cloudflare-mod', {
      timeoutMilliseconds: DEFAULT_AI_TIMEOUT_MS + 5_000,
    });
  }

  return cachedWebhookHandler(request);
}

export async function handleWebhookRequest(
  request: Request,
  env: Env,
  dispatch: WebhookDispatcher = dispatchToTelegram,
): Promise<Response> {
  let config: Config;
  try {
    config = parseEnv(env);
  } catch (error) {
    console.error('Invalid worker configuration while handling webhook', {
      error,
      method: request.method,
      url: request.url,
    });
    return new Response(null, { status: 200 });
  }

  if (!hasValidWebhookSecret(request, config.WEBHOOK_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    return await dispatch(request, config);
  } catch (error) {
    // Telegram retries non-2xx webhooks, which turns one internal failure into
    // a delivery storm. Bot middleware sends the learner an apology when a
    // context exists; this final boundary also covers initialization failures.
    console.error('Unhandled webhook failure', {
      error,
      method: request.method,
      url: request.url,
    });
    return new Response(null, { status: 200 });
  }
}

export const worker = {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleWebhookRequest(request, env);
  },
};

export default worker;
