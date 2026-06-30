import { first } from './db';
import { createUsersRepository } from './users';

export interface RecordTipInput {
  telegramId: number;
  /** Telegram's `telegram_payment_charge_id`; the PK that dedupes webhook retries. */
  chargeId: string;
  /** Stars (XTR); the raw star count, not a hundredths-of-currency amount. */
  amount: number;
}

export function createTipsRepository(db: D1Database) {
  const users = createUsersRepository(db);

  return {
    /**
     * Record a tip, idempotent on `charge_id`. Returns `true` only on the first
     * insert so the caller thanks the tipper exactly once even if Telegram
     * redelivers the `successful_payment` update.
     */
    async recordTip(input: RecordTipInput): Promise<boolean> {
      // A payment can arrive from a chat that has never interacted otherwise, so
      // provision the user first to satisfy the tips → users foreign key.
      await users.ensureUser(input.telegramId);
      const row = await first<{ charge_id: string }>(
        db,
        `INSERT INTO tips (charge_id, telegram_id, amount) VALUES (?, ?, ?)
         ON CONFLICT (charge_id) DO NOTHING
         RETURNING charge_id`,
        [input.chargeId, input.telegramId, input.amount],
      );
      return row !== null;
    },
  };
}

export type TipsRepository = ReturnType<typeof createTipsRepository>;
