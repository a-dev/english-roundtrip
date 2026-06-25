import { SessionState } from '../domain/state';

/** The production default; tests may inject zero to avoid waiting. */
export const DEFAULT_COOLDOWN_SECONDS = 3;

/** Persistent session states that own an active AI request. */
export const AI_REQUEST_STATES = [SessionState.Generating, SessionState.Grading] as const;

export type AiRequestState = (typeof AI_REQUEST_STATES)[number];

export interface CooldownSession {
  state: SessionState;
  lastRequestAt: string | null;
}

export type CooldownStatus = 'allowed' | 'in_flight' | 'cooldown';

export function isAiRequestInFlight(state: SessionState): state is AiRequestState {
  return AI_REQUEST_STATES.includes(state as AiRequestState);
}

/** Remaining quiet-period time. Invalid legacy timestamps fail open. */
export function cooldownRemainingMs(
  lastRequestAt: string | null,
  cooldownSeconds: number,
  now: Date,
): number {
  if (lastRequestAt === null || cooldownSeconds <= 0) return 0;

  const previousRequestMs = Date.parse(lastRequestAt);
  if (Number.isNaN(previousRequestMs)) return 0;

  return Math.max(0, previousRequestMs + cooldownSeconds * 1_000 - now.getTime());
}

/**
 * Classify a session before acquiring its database-backed AI request lease.
 * The repository repeats this decision atomically; this pure version keeps
 * messages and unit tests independent of D1.
 */
export function getCooldownStatus(
  session: CooldownSession,
  cooldownSeconds: number,
  now: Date,
): CooldownStatus {
  if (isAiRequestInFlight(session.state)) return 'in_flight';
  return cooldownRemainingMs(session.lastRequestAt, cooldownSeconds, now) > 0
    ? 'cooldown'
    : 'allowed';
}
