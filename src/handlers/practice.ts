import type { Context } from 'grammy';

import { AiError } from '../ai/errors';
import { FALLBACK_TASK_LANGUAGE, getTaskLanguageLabels } from '../domain/languages';
import { isOverDailyLimit } from '../domain/limits';
import { isExempt } from '../domain/roles';
import { SessionState } from '../domain/state';
import { getTopic, type Topic } from '../domain/topics';
import { DEFAULT_COOLDOWN_SECONDS, isAiRequestInFlight } from '../ratelimit/cooldown';
import { COPY } from '../ui/copy';
import { formatGrading } from '../ui/format';
import { postFeedbackKeyboard } from '../ui/keyboards';
import { telegramId, type HandlerDependencies } from './types';

/** Telegram accepts longer messages, but short answers keep prompts bounded. */
export const MAX_ANSWER_LENGTH = 1_000;

function sanitizeAnswer(answer: string): string {
  return (
    answer
      // oxlint-disable-next-line no-control-regex -- Telegram input may contain ASCII controls; strip them before AI prompts.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

async function replyForAiFailure(
  context: Context,
  error: unknown,
  fallback: string,
): Promise<void> {
  if (error instanceof AiError) {
    if (error.kind === 'rate_limited') {
      await context.reply(COPY.busy);
      return;
    }
    if (error.kind === 'daily_limit') {
      await context.reply(COPY.dailyLimit);
      return;
    }
    if (error.kind === 'timeout') {
      await context.reply(COPY.aiTimedOut);
      return;
    }
  }
  await context.reply(fallback);
}

async function replyForRejectedAiRequest(
  context: Context,
  reason: 'allowed' | 'in_flight' | 'cooldown' | 'state_changed',
): Promise<void> {
  if (reason === 'in_flight') {
    await context.reply(COPY.stillWorking);
  } else if (reason === 'cooldown') {
    await context.reply(COPY.cooldown);
  } else if (reason === 'state_changed') {
    await context.reply(COPY.notPractising);
  }
}

/**
 * Generate and persist the next exercise for a selected topic.
 *
 * Phase 4 adds a cooldown guard around this seam. Keeping generation behind
 * this function makes that guard apply to both topic selection and “Next”.
 */
export async function startExercise(
  context: Context,
  dependencies: HandlerDependencies,
  topic: Topic,
): Promise<void> {
  const id = telegramId(context);
  if (id === null) return;

  const [session, user] = await Promise.all([
    dependencies.data.sessions.getSession(id),
    dependencies.data.users.getOrCreateUser(id),
  ]);

  if (!isExempt(user.role)) {
    const used = await dependencies.data.stats.getDailyCount(id);
    if (isOverDailyLimit(used)) {
      await context.reply(COPY.dailyCapReached);
      return;
    }
  }

  const request = await dependencies.data.sessions.beginAiRequest(
    id,
    SessionState.Generating,
    [SessionState.ChoosingTopic, SessionState.FeedbackShown],
    dependencies.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS,
  );
  if (!request.acquired) {
    await replyForRejectedAiRequest(context, request.reason);
    return;
  }

  try {
    const taskLanguage = user.taskLanguage ?? FALLBACK_TASK_LANGUAGE;
    const exercise = await dependencies.generateExercise({
      topicHint: topic.generationHint,
      taskLanguage,
      level: user.level,
      recentSentences: session.recentSentences,
    });
    const completed = await dependencies.data.sessions.completeExerciseGeneration(
      id,
      topic.id,
      exercise.sourceSentence,
      exercise.referenceTranslation,
      exercise.targetPoints,
    );
    if (completed !== null) {
      await context.reply(
        COPY.translate(exercise.sourceSentence, getTaskLanguageLabels(taskLanguage).englishLabel),
      );
      await dependencies.data.stats.incrementDailyCount(id);
    }
  } catch (error) {
    console.error('Exercise generation failed', { error, telegramId: id, topicId: topic.id });
    await dependencies.data.sessions.restoreAiRequest(id, SessionState.Generating, session.state);
    await replyForAiFailure(context, error, COPY.generateFailed);
  }
}

/** Handles the “Next” callback and returns whether it consumed the event. */
export async function handlePracticeCallback(
  context: Context,
  data: string,
  dependencies: HandlerDependencies,
): Promise<boolean> {
  if (data !== 'act:next') return false;

  const id = telegramId(context);
  if (id === null) return true;

  const session = await dependencies.data.sessions.getSession(id);
  if (isAiRequestInFlight(session.state)) {
    await context.reply(COPY.stillWorking);
    return true;
  }
  const topic = session.topicId === null ? undefined : getTopic(session.topicId);
  if (session.state !== SessionState.FeedbackShown || topic === undefined) {
    await context.reply(COPY.notPractising);
    return true;
  }

  await startExercise(context, dependencies, topic);
  return true;
}

/** Grade a plain-text answer only while a complete exercise is awaiting it. */
export async function handleTranslation(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<boolean> {
  const answer = context.message?.text;
  const id = telegramId(context);
  if (answer === undefined || id === null || answer.startsWith('/')) return false;

  const session = await dependencies.data.sessions.getSession(id);
  if (isAiRequestInFlight(session.state)) {
    await context.reply(COPY.stillWorking);
    return true;
  }
  if (session.state !== SessionState.AwaitingAnswer) return false;

  const topic = session.topicId === null ? undefined : getTopic(session.topicId);
  if (
    topic === undefined ||
    session.sourceSentence === null ||
    session.referenceTranslation === null ||
    session.targetPoints.length === 0
  ) {
    await dependencies.data.sessions.clear(id);
    await context.reply(COPY.stateLost);
    return true;
  }

  const sanitizedAnswer = sanitizeAnswer(answer);
  if (sanitizedAnswer.length === 0) {
    await context.reply(COPY.emptyAnswer);
    return true;
  }
  if (sanitizedAnswer.length > MAX_ANSWER_LENGTH) {
    await context.reply(COPY.answerTooLong);
    return true;
  }

  const request = await dependencies.data.sessions.beginAiRequest(
    id,
    SessionState.Grading,
    [SessionState.AwaitingAnswer],
    dependencies.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS,
  );
  if (!request.acquired) {
    await replyForRejectedAiRequest(context, request.reason);
    return true;
  }

  const user = await dependencies.data.users.getOrCreateUser(id);
  try {
    const taskLanguage = user.taskLanguage ?? FALLBACK_TASK_LANGUAGE;
    const grading = await dependencies.gradeTranslation({
      sourceSentence: session.sourceSentence,
      userTranslation: sanitizedAnswer,
      topic: topic.label,
      taskLanguage,
      level: user.level,
      referenceTranslation: session.referenceTranslation,
      targetPoints: session.targetPoints,
      feedbackMode: user.feedbackMode,
    });
    await dependencies.data.stats.recordResult(id, {
      correct: grading.verdict === 'correct',
      categories: grading.issues.map((issue) => issue.category),
    });
    const completed = await dependencies.data.sessions.completeGrading(id);
    if (completed !== null) {
      await context.reply(formatGrading(grading), {
        parse_mode: 'HTML',
        reply_markup: postFeedbackKeyboard(),
      });
    }
  } catch (error) {
    console.error('Translation grading failed', { error, telegramId: id });
    await dependencies.data.sessions.restoreAiRequest(
      id,
      SessionState.Grading,
      SessionState.AwaitingAnswer,
    );
    await replyForAiFailure(context, error, COPY.gradeFailed);
  }

  return true;
}
