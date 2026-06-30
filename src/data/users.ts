import { first, run } from './db';
import { CEFR } from '../domain/levels';
import type { LanguageCode } from '../domain/languages';

export type FeedbackMode = 'english' | 'source';

export interface User {
  telegramId: number;
  taskLanguage: LanguageCode | null;
  feedbackMode: FeedbackMode;
  level: CEFR;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  telegramId: number;
  taskLanguage: LanguageCode | null;
  feedbackMode: FeedbackMode;
  level: CEFR;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

const userColumns = `
    telegram_id AS telegramId,
    task_language AS taskLanguage,
    feedback_mode AS feedbackMode,
    level,
    role,
    created_at AS createdAt,
    updated_at AS updatedAt
`;

const userSelect = `SELECT ${userColumns} FROM users WHERE telegram_id = ?`;

export function createUsersRepository(db: D1Database) {
  /** Insert the default profile if absent. Cheap no-op when the row exists. */
  async function ensureUser(telegramId: number): Promise<void> {
    await run(
      db,
      'INSERT INTO users (telegram_id) VALUES (?) ON CONFLICT (telegram_id) DO NOTHING',
      [telegramId],
    );
  }

  async function readUser(telegramId: number): Promise<User> {
    const user = await first<UserRow>(db, userSelect, [telegramId]);
    if (user === null) {
      throw new Error(`User ${telegramId} was not found after provisioning.`);
    }
    return user;
  }

  /** Provision then update a single column, returning the updated row in one round trip. */
  async function applyUpdate(
    telegramId: number,
    assignment: string,
    value: string | null,
  ): Promise<User> {
    await ensureUser(telegramId);
    const user = await first<UserRow>(
      db,
      `UPDATE users SET ${assignment}, updated_at = datetime('now') WHERE telegram_id = ? RETURNING ${userColumns}`,
      [value, telegramId],
    );
    if (user === null) {
      throw new Error(`User ${telegramId} was not found after provisioning.`);
    }
    return user;
  }

  return {
    ensureUser,

    async getOrCreateUser(telegramId: number): Promise<User> {
      await ensureUser(telegramId);
      return readUser(telegramId);
    },

    setFeedbackMode(telegramId: number, mode: FeedbackMode): Promise<User> {
      return applyUpdate(telegramId, 'feedback_mode = ?', mode);
    },

    setTaskLanguage(telegramId: number, code: LanguageCode): Promise<User> {
      return applyUpdate(telegramId, 'task_language = ?', code);
    },

    setLevel(telegramId: number, level: CEFR): Promise<User> {
      return applyUpdate(telegramId, 'level = ?', level);
    },

    /** Set or clear the daily-cap exemption role. Manual/admin use; not called by the bot at runtime. */
    setRole(telegramId: number, role: string | null): Promise<User> {
      return applyUpdate(telegramId, 'role = ?', role);
    },
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
