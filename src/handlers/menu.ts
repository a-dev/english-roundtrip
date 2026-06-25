import type { Context } from 'grammy';

import { SessionState } from '../domain/state';
import { getTopic, type TopicCategory } from '../domain/topics';
import { COPY } from '../ui/copy';
import { mainMenuKeyboard, postFeedbackKeyboard, topicKeyboard } from '../ui/keyboards';
import { needsOnboarding } from './onboarding';
import { startExercise } from './practice';
import { telegramId, type HandlerDependencies } from './types';

export async function showCategoryMenu(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<void> {
  const id = telegramId(context);
  if (id === null) return;
  if (await needsOnboarding(context, dependencies)) return;

  await dependencies.data.sessions.setState(id, SessionState.ChoosingCategory);
  await context.reply(COPY.chooseCategory, { reply_markup: mainMenuKeyboard() });
}

export async function showTopicMenu(
  context: Context,
  dependencies: HandlerDependencies,
  category: TopicCategory,
): Promise<void> {
  const id = telegramId(context);
  if (id === null) return;
  if (await needsOnboarding(context, dependencies)) return;

  await dependencies.data.sessions.setState(id, SessionState.ChoosingTopic);
  await context.reply(
    category === 'grammar' ? COPY.chooseGrammarTopic : COPY.chooseVocabularyTopic,
    {
      reply_markup: topicKeyboard(category),
    },
  );
}

/** Handles category/topic navigation callbacks and returns whether it consumed the event. */
export async function handleMenuCallback(
  context: Context,
  data: string,
  dependencies: HandlerDependencies,
): Promise<boolean> {
  if (data === 'cat:grammar') {
    await showTopicMenu(context, dependencies, 'grammar');
    return true;
  }
  if (data === 'cat:vocab') {
    await showTopicMenu(context, dependencies, 'vocab');
    return true;
  }
  if (data === 'act:change') {
    await showCategoryMenu(context, dependencies);
    return true;
  }
  if (data === 'nav:back') {
    const id = telegramId(context);
    if (
      id !== null &&
      (await dependencies.data.sessions.getSession(id)).state === SessionState.FeedbackShown
    ) {
      await context.reply(COPY.feedbackActions, { reply_markup: postFeedbackKeyboard() });
      return true;
    }
    await showCategoryMenu(context, dependencies);
    return true;
  }
  if (!data.startsWith('topic:')) return false;

  const topic = getTopic(data.slice('topic:'.length));
  if (topic === undefined) {
    await context.reply(COPY.unknownTopic);
    return true;
  }

  await startExercise(context, dependencies, topic);
  return true;
}
