import { callTelegram } from './telegram';
import { formatWebhookInfo, getWebhookInfo } from './webhook-info';

// Webhook reset: by default we drop the backlog Telegram queued while the
// webhook was failing so the next set-webhook starts clean. Pass --keep-pending
// to retain those updates.
const dropPendingUpdates = !Bun.argv.slice(2).includes('--keep-pending');

await callTelegram('deleteWebhook', { drop_pending_updates: dropPendingUpdates });

console.log(`Telegram webhook deleted${dropPendingUpdates ? ' (pending updates dropped)' : ''}.\n`);
console.log(formatWebhookInfo(await getWebhookInfo()));
