/**
 * Shared helpers for the Telegram Bot API scripts in this folder.
 *
 * These scripts talk to Telegram directly (not through the Worker), so they read
 * the bot token and webhook secret from the environment. For production, export
 * the *production* bot's values for the shell session before running — they must
 * match the secrets stored in Cloudflare. Never commit them.
 */

export function requireBotToken(): string {
  const botToken = Bun.env.BOT_TOKEN;
  if (botToken === undefined || botToken.length === 0) {
    throw new Error('BOT_TOKEN must be set in the environment.');
  }
  return botToken;
}

export function requireWebhookSecret(): string {
  const webhookSecret = Bun.env.WEBHOOK_SECRET;
  if (webhookSecret === undefined || webhookSecret.length === 0) {
    throw new Error('WEBHOOK_SECRET must be set in the environment.');
  }
  return webhookSecret;
}

/** Call a Telegram Bot API method and return its `result`, throwing on failure. */
export async function callTelegram<T>(method: string, body?: unknown): Promise<T> {
  const botToken = requireBotToken();
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json()) as { ok?: boolean; description?: string; result?: T };
  if (!response.ok || payload.ok !== true) {
    throw new Error(`Telegram ${method} failed: ${payload.description ?? response.statusText}`);
  }
  return payload.result as T;
}
