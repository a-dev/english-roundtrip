import { isSessionState, SessionState } from '../domain/state';
import { getCooldownStatus, type AiRequestState, type CooldownStatus } from '../ratelimit/cooldown';
import { first, parseStringArray, run, serializeStringArray, type SqlValue } from './db';
import { createUsersRepository } from './users';

export interface Session {
  telegramId: number;
  state: SessionState;
  topicId: string | null;
  sourceSentence: string | null;
  referenceTranslation: string | null;
  targetPoints: string[];
  recentSentences: string[];
  lastRequestAt: string | null;
  updatedAt: string;
}

interface SessionRow {
  telegramId: number;
  state: string;
  topicId: string | null;
  sourceSentence: string | null;
  referenceTranslation: string | null;
  targetPoints: string | null;
  recentSentences: string | null;
  lastRequestAt: string | null;
  updatedAt: string;
}

export interface SessionsRepositoryOptions {
  antiRepeatWindow: number;
  now?: () => Date;
}

export type BeginAiRequestResult =
  | { acquired: true; session: Session }
  | { acquired: false; session: Session; reason: CooldownStatus | 'state_changed' };

const sessionColumns = `
    telegram_id AS telegramId,
    state,
    topic_id AS topicId,
    source_sentence AS sourceSentence,
    reference_translation AS referenceTranslation,
    target_points AS targetPoints,
    recent_sentences AS recentSentences,
    last_request_at AS lastRequestAt,
    updated_at AS updatedAt
`;

const sessionSelect = `SELECT ${sessionColumns} FROM sessions WHERE telegram_id = ?`;

function toSession(row: SessionRow): Session {
  if (!isSessionState(row.state)) {
    throw new Error(`Unknown session state: ${row.state}`);
  }

  return {
    ...row,
    state: row.state,
    targetPoints: parseStringArray(row.targetPoints),
    recentSentences: parseStringArray(row.recentSentences),
  };
}

export function createSessionsRepository(db: D1Database, options: SessionsRepositoryOptions) {
  if (!Number.isSafeInteger(options.antiRepeatWindow) || options.antiRepeatWindow < 1) {
    throw new RangeError('antiRepeatWindow must be a positive safe integer.');
  }

  const users = createUsersRepository(db);
  const now = options.now ?? (() => new Date());

  /** Ensure the user and session rows exist before reading or updating them. */
  async function provision(telegramId: number): Promise<void> {
    await users.ensureUser(telegramId);
    await run(
      db,
      'INSERT INTO sessions (telegram_id) VALUES (?) ON CONFLICT (telegram_id) DO NOTHING',
      [telegramId],
    );
  }

  async function getSession(telegramId: number): Promise<Session> {
    await provision(telegramId);

    const row = await first<SessionRow>(db, sessionSelect, [telegramId]);
    if (row === null) {
      throw new Error(`Session for user ${telegramId} was not found after provisioning.`);
    }

    return toSession(row);
  }

  /** Apply a set of column assignments and return the updated row in a single round trip. */
  async function updateSession(
    telegramId: number,
    assignments: string,
    params: readonly SqlValue[],
  ): Promise<Session> {
    const row = await first<SessionRow>(
      db,
      `UPDATE sessions SET ${assignments}, updated_at = datetime('now') WHERE telegram_id = ? RETURNING ${sessionColumns}`,
      [...params, telegramId],
    );
    if (row === null) {
      throw new Error(`Session for user ${telegramId} was not found after provisioning.`);
    }

    return toSession(row);
  }

  /**
   * Atomically acquire a per-user AI request lease and record its start time.
   * The state predicate makes concurrent Telegram deliveries mutually
   * exclusive, avoiding a read-then-write cooldown race.
   */
  async function beginAiRequest(
    telegramId: number,
    inFlightState: AiRequestState,
    allowedStates: readonly SessionState[],
    cooldownSeconds: number,
  ): Promise<BeginAiRequestResult> {
    if (allowedStates.length === 0) {
      throw new RangeError('At least one source state is required to begin an AI request.');
    }
    if (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 0) {
      throw new RangeError('cooldownSeconds must be a non-negative finite number.');
    }

    await provision(telegramId);
    const requestTime = now();
    const cutoff = new Date(requestTime.getTime() - cooldownSeconds * 1_000).toISOString();
    const statePlaceholders = allowedStates.map(() => '?').join(', ');
    const row = await first<SessionRow>(
      db,
      `UPDATE sessions
       SET state = ?, last_request_at = ?, updated_at = datetime('now')
       WHERE telegram_id = ?
         AND state IN (${statePlaceholders})
         AND (last_request_at IS NULL OR last_request_at <= ?)
       RETURNING ${sessionColumns}`,
      [inFlightState, requestTime.toISOString(), telegramId, ...allowedStates, cutoff],
    );

    if (row !== null) {
      return { acquired: true, session: toSession(row) };
    }

    const session = await getSession(telegramId);
    const cooldownStatus = getCooldownStatus(session, cooldownSeconds, requestTime);
    return {
      acquired: false,
      session,
      reason:
        cooldownStatus === 'in_flight'
          ? 'in_flight'
          : allowedStates.includes(session.state)
            ? cooldownStatus
            : 'state_changed',
    };
  }

  /** Restore a retryable state only if this request still owns the lease. */
  async function restoreAiRequest(
    telegramId: number,
    inFlightState: AiRequestState,
    retryState: SessionState,
  ): Promise<Session | null> {
    await provision(telegramId);
    const row = await first<SessionRow>(
      db,
      `UPDATE sessions
       SET state = ?, updated_at = datetime('now')
       WHERE telegram_id = ? AND state = ?
       RETURNING ${sessionColumns}`,
      [retryState, telegramId, inFlightState],
    );
    return row === null ? null : toSession(row);
  }

  return {
    getSession,

    beginAiRequest,

    restoreAiRequest,

    async startExercise(
      telegramId: number,
      topicId: string,
      sourceSentence: string,
      reference: string,
      targetPoints: readonly string[],
    ): Promise<Session> {
      await provision(telegramId);
      return updateSession(
        telegramId,
        'state = ?, topic_id = ?, source_sentence = ?, reference_translation = ?, target_points = ?',
        [
          SessionState.AwaitingAnswer,
          topicId,
          sourceSentence,
          reference,
          serializeStringArray(targetPoints),
        ],
      );
    },

    /**
     * Persist an exercise only while its generation lease is still active.
     * A late response after /cancel therefore cannot resurrect an exercise.
     */
    async completeExerciseGeneration(
      telegramId: number,
      topicId: string,
      sourceSentence: string,
      reference: string,
      targetPoints: readonly string[],
    ): Promise<Session | null> {
      const session = await getSession(telegramId);
      const recentSentences = [...session.recentSentences, sourceSentence].slice(
        -options.antiRepeatWindow,
      );
      const row = await first<SessionRow>(
        db,
        `UPDATE sessions
         SET state = ?, topic_id = ?, source_sentence = ?, reference_translation = ?,
             target_points = ?, recent_sentences = ?, updated_at = datetime('now')
         WHERE telegram_id = ? AND state = ?
         RETURNING ${sessionColumns}`,
        [
          SessionState.AwaitingAnswer,
          topicId,
          sourceSentence,
          reference,
          serializeStringArray(targetPoints),
          serializeStringArray(recentSentences),
          telegramId,
          SessionState.Generating,
        ],
      );
      return row === null ? null : toSession(row);
    },

    /** Complete grading only if the request lease is still active. */
    async completeGrading(telegramId: number): Promise<Session | null> {
      return restoreAiRequest(telegramId, SessionState.Grading, SessionState.FeedbackShown);
    },

    async setState(telegramId: number, state: SessionState): Promise<Session> {
      await provision(telegramId);
      return updateSession(telegramId, 'state = ?', [state]);
    },

    async pushRecentSentence(telegramId: number, sentence: string): Promise<Session> {
      const session = await getSession(telegramId);
      const recentSentences = [...session.recentSentences, sentence].slice(
        -options.antiRepeatWindow,
      );
      return updateSession(telegramId, 'recent_sentences = ?', [
        serializeStringArray(recentSentences),
      ]);
    },

    async touchRequest(telegramId: number): Promise<Session> {
      await provision(telegramId);
      return updateSession(telegramId, 'last_request_at = ?', [now().toISOString()]);
    },

    async clear(telegramId: number): Promise<Session> {
      await provision(telegramId);
      return updateSession(
        telegramId,
        'state = ?, topic_id = NULL, source_sentence = NULL, reference_translation = NULL, target_points = NULL',
        [SessionState.Idle],
      );
    },
  };
}

export type SessionsRepository = ReturnType<typeof createSessionsRepository>;
