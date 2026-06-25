import { all, first, run } from './db';
import { createUsersRepository } from './users';
import { ERROR_CATEGORIES, type ErrorCategory } from '../domain/errors';

// Re-exported for callers that historically imported the enum from the stats
// layer; the canonical definition now lives in ../domain/errors.
export { ERROR_CATEGORIES };
export type { ErrorCategory };

export interface RecordResultInput {
  correct: boolean;
  categories: readonly ErrorCategory[];
}

export interface WeakCategory {
  category: ErrorCategory;
  count: number;
}

export interface Stats {
  telegramId: number;
  totalExercises: number;
  totalCorrect: number;
  /** Percentage rounded to a whole number in the inclusive 0–100 range. */
  accuracy: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  weakCategories: WeakCategory[];
}

interface StatsRow {
  telegramId: number;
  totalExercises: number;
  totalCorrect: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

interface WeakCategoryRow {
  category: ErrorCategory;
  count: number;
}

export interface StatsRepositoryOptions {
  now?: () => Date;
  weakCategoryLimit?: number;
}

const statsColumns = `
    telegram_id AS telegramId,
    total_exercises AS totalExercises,
    total_correct AS totalCorrect,
    current_streak AS currentStreak,
    longest_streak AS longestStreak,
    last_active_date AS lastActiveDate
`;

const statsSelect = `SELECT ${statsColumns} FROM stats WHERE telegram_id = ?`;

/**
 * The calendar day used for streaks, as a UTC `YYYY-MM-DD` key.
 *
 * Streak boundaries intentionally follow UTC rather than the user's local day:
 * the schema stores no per-user timezone yet, so a user practising near their
 * local midnight may see a streak roll over earlier/later than expected.
 * Revisit once a per-user timezone is captured.
 */
function toDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function createStatsRepository(db: D1Database, options: StatsRepositoryOptions = {}) {
  const weakCategoryLimit = options.weakCategoryLimit ?? 3;
  if (!Number.isSafeInteger(weakCategoryLimit) || weakCategoryLimit < 1) {
    throw new RangeError('weakCategoryLimit must be a positive safe integer.');
  }

  const users = createUsersRepository(db);
  const now = options.now ?? (() => new Date());

  async function ensureStats(telegramId: number): Promise<void> {
    await users.ensureUser(telegramId);
    await run(
      db,
      'INSERT INTO stats (telegram_id) VALUES (?) ON CONFLICT (telegram_id) DO NOTHING',
      [telegramId],
    );
  }

  async function loadWeakCategories(telegramId: number): Promise<WeakCategory[]> {
    return all<WeakCategoryRow>(
      db,
      `
        SELECT category, count
        FROM error_stats
        WHERE telegram_id = ?
        ORDER BY count DESC, category ASC
        LIMIT ?
      `,
      [telegramId, weakCategoryLimit],
    );
  }

  function buildStats(row: StatsRow, weakCategories: WeakCategory[]): Stats {
    return {
      ...row,
      accuracy:
        row.totalExercises === 0 ? 0 : Math.round((row.totalCorrect / row.totalExercises) * 100),
      weakCategories,
    };
  }

  async function getStats(telegramId: number): Promise<Stats> {
    await ensureStats(telegramId);
    const row = await first<StatsRow>(db, statsSelect, [telegramId]);
    if (row === null) {
      throw new Error(`Stats for user ${telegramId} were not found after provisioning.`);
    }

    return buildStats(row, await loadWeakCategories(telegramId));
  }

  return {
    getStats,

    async recordResult(telegramId: number, result: RecordResultInput): Promise<Stats> {
      await users.ensureUser(telegramId);
      const activeDate = toDateKey(now());
      const correct = result.correct ? 1 : 0;

      const row = await first<StatsRow>(
        db,
        `
          INSERT INTO stats (
            telegram_id,
            total_exercises,
            total_correct,
            current_streak,
            longest_streak,
            last_active_date
          )
          VALUES (?, 1, ?, 1, 1, ?)
          ON CONFLICT (telegram_id) DO UPDATE SET
            total_exercises = stats.total_exercises + 1,
            total_correct = stats.total_correct + excluded.total_correct,
            current_streak = CASE
              WHEN stats.last_active_date = excluded.last_active_date THEN MAX(stats.current_streak, 0)
              WHEN stats.last_active_date = date(excluded.last_active_date, '-1 day') THEN MAX(stats.current_streak, 0) + 1
              ELSE 1
            END,
            longest_streak = MAX(
              stats.longest_streak,
              CASE
                WHEN stats.last_active_date = excluded.last_active_date THEN MAX(stats.current_streak, 0)
                WHEN stats.last_active_date = date(excluded.last_active_date, '-1 day') THEN MAX(stats.current_streak, 0) + 1
                ELSE 1
              END
            ),
            last_active_date = excluded.last_active_date
          RETURNING ${statsColumns}
        `,
        [telegramId, correct, activeDate],
      );
      if (row === null) {
        throw new Error(`Stats for user ${telegramId} were not found after provisioning.`);
      }

      // Weak-spot tallies only make sense for incorrect answers; a "correct"
      // verdict carries no issues (see context.md §5.3). Guard against a caller
      // passing categories alongside correct: true inflating the counts.
      if (!result.correct) {
        for (const category of result.categories) {
          await run(
            db,
            `
              INSERT INTO error_stats (telegram_id, category, count)
              VALUES (?, ?, 1)
              ON CONFLICT (telegram_id, category) DO UPDATE SET count = error_stats.count + 1
            `,
            [telegramId, category],
          );
        }
      }

      return buildStats(row, await loadWeakCategories(telegramId));
    },
  };
}

export type StatsRepository = ReturnType<typeof createStatsRepository>;
