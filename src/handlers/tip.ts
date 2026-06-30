import type { Context } from 'grammy';

import { isTipTier } from '../domain/tips';
import { COPY } from '../ui/copy';
import { tipKeyboard } from '../ui/keyboards';
import { telegramId, type HandlerDependencies } from './types';

export { TIP_TIERS } from '../domain/tips';

/**
 * Offer the tip tiers. Works in any session state — tipping never touches the
 * practice FSM. Provisions the user so a payment from a brand-new chat already
 * has its row when `successful_payment` arrives.
 */
export async function handleTipCommand(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<void> {
  const id = telegramId(context);
  if (id !== null) await dependencies.data.users.getOrCreateUser(id);
  await context.reply(COPY.tipPrompt, { reply_markup: tipKeyboard() });
}

/** Handle a `tip:<stars>` button. Returns whether it consumed the callback. */
export async function handleTipCallback(context: Context, data: string): Promise<boolean> {
  if (!data.startsWith('tip:')) return false;

  const stars = Number(data.slice('tip:'.length));
  // Ignore stale or tampered amounts rather than invoicing an arbitrary value.
  if (!isTipTier(stars)) return true;

  // Telegram Stars: currency is 'XTR', the provider token is the empty string,
  // and `amount` is the raw star count (XTR has zero decimals — no ×100).
  await context.replyWithInvoice(
    COPY.tipInvoiceTitle,
    COPY.tipInvoiceDescription,
    `tip:${stars}`,
    'XTR',
    [{ label: `Tip ⭐ ${stars}`, amount: stars }],
    { provider_token: '' },
  );
  return true;
}

/**
 * Approve the pre-checkout. A fixed-tier Stars tip has nothing to validate, and
 * Telegram requires an answer within 10 seconds.
 */
export async function handlePreCheckout(context: Context): Promise<void> {
  await context.answerPreCheckoutQuery(true);
}

/** Record a completed tip and thank the user exactly once (idempotent on charge id). */
export async function handleSuccessfulPayment(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<void> {
  const payment = context.message?.successful_payment;
  const id = telegramId(context);
  if (payment === undefined || id === null) return;

  const inserted = await dependencies.data.tips.recordTip({
    telegramId: id,
    chargeId: payment.telegram_payment_charge_id,
    amount: payment.total_amount, // for XTR this equals the star count
  });
  if (inserted) await context.reply(COPY.tipThanks(payment.total_amount));
}
