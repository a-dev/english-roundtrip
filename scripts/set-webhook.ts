import { callTelegram, requireWebhookSecret } from './telegram';
import { formatWebhookInfo, getWebhookInfo } from './webhook-info';

const [workerUrl] = Bun.argv.slice(2);

if (workerUrl === undefined) {
  throw new Error(
    'Usage: bun scripts/set-webhook.ts <https://english-roundtrip.<account>.workers.dev>',
  );
}

const webhookSecret = requireWebhookSecret();

const url = new URL(workerUrl);
if (url.protocol !== 'https:') {
  throw new Error('Telegram webhooks require an HTTPS Worker URL.');
}

await callTelegram('setWebhook', {
  url: url.toString(),
  secret_token: webhookSecret,
  allowed_updates: ['message', 'callback_query'],
});

console.log(`Telegram webhook set to ${url.origin}${url.pathname}\n`);
// Verify immediately so a successful set can't hide a stale URL or backlog.
console.log(formatWebhookInfo(await getWebhookInfo()));
