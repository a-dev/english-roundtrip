/**
 * Refund a Telegram Stars tip. Refunds are rare and manual, so this stays a
 * script rather than a privileged in-bot command (context.md §13.2).
 *
 * Usage:
 *   BOT_TOKEN=... bun run scripts/refund.ts <telegram_id> <charge_id>
 *
 * Find the charge id with:
 *   wrangler d1 execute english-roundtrip --remote \
 *     --command "SELECT charge_id, telegram_id, amount, created_at FROM tips WHERE telegram_id = <id>"
 */
import { callTelegram } from './telegram';

const [rawUserId, chargeId] = Bun.argv.slice(2);

if (rawUserId === undefined || chargeId === undefined) {
  throw new Error('Usage: bun run scripts/refund.ts <telegram_id> <charge_id>');
}

const userId = Number(rawUserId);
if (!Number.isSafeInteger(userId) || userId <= 0) {
  throw new Error(`Invalid telegram_id: ${rawUserId}`);
}

await callTelegram('refundStarPayment', {
  user_id: userId,
  telegram_payment_charge_id: chargeId,
});

console.log(`Refunded charge ${chargeId} for user ${userId}.`);
