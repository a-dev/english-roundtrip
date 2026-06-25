import type { Context } from 'grammy';

import { inferTaskLanguage, isLanguageCode } from '../domain/languages';
import { CEFR } from '../domain/levels';
import { COPY } from '../ui/copy';
import {
  feedbackModeKeyboard,
  levelKeyboard,
  settingsKeyboard,
  taskLanguageKeyboard,
} from '../ui/keyboards';
import { needsOnboarding } from './onboarding';
import { telegramId, type HandlerDependencies } from './types';

export async function showSettings(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<void> {
  const id = telegramId(context);
  if (id === null) return;
  if (await needsOnboarding(context, dependencies)) return;

  const user = await dependencies.data.users.getOrCreateUser(id);
  await context.reply(COPY.settings(user.taskLanguage, user.feedbackMode, user.level), {
    parse_mode: 'HTML',
    reply_markup: settingsKeyboard(user),
  });
}

export async function showTaskLanguageSettings(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<void> {
  const id = telegramId(context);
  if (id === null) return;
  if (await needsOnboarding(context, dependencies)) return;

  const user = await dependencies.data.users.getOrCreateUser(id);
  await context.reply(COPY.chooseTaskLanguage, {
    reply_markup: taskLanguageKeyboard(
      user.taskLanguage ?? inferTaskLanguage(context.from?.language_code),
      { includeBack: true },
    ),
  });
}

export async function showFeedbackSettings(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<void> {
  const id = telegramId(context);
  if (id === null) return;

  const user = await dependencies.data.users.getOrCreateUser(id);
  await context.reply(COPY.chooseFeedbackMode, {
    reply_markup: feedbackModeKeyboard(user),
  });
}

export async function showLevelSettings(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<void> {
  const id = telegramId(context);
  if (id === null) return;
  if (await needsOnboarding(context, dependencies)) return;

  const user = await dependencies.data.users.getOrCreateUser(id);
  await context.reply(COPY.chooseLevel, {
    reply_markup: levelKeyboard(user),
  });
}

/** Handles settings callbacks and returns whether it consumed the event. */
export async function handleSettingsCallback(
  context: Context,
  data: string,
  dependencies: HandlerDependencies,
): Promise<boolean> {
  if (data === 'act:settings') {
    await showSettings(context, dependencies);
    return true;
  }

  if (data === 'cfg:back') {
    await showSettings(context, dependencies);
    return true;
  }

  if (data === 'cfg:task') {
    await showTaskLanguageSettings(context, dependencies);
    return true;
  }

  if (data === 'cfg:feedback') {
    await showFeedbackSettings(context, dependencies);
    return true;
  }

  if (data === 'cfg:level') {
    await showLevelSettings(context, dependencies);
    return true;
  }

  const id = telegramId(context);
  if (id === null) return data.startsWith('set:') || data.startsWith('cfg:');

  if (data.startsWith('set:task:')) {
    // Once the prefix matches we own the event; swallow malformed codes
    // (stale/crafted callbacks) instead of leaking them to later handlers.
    const code = data.slice('set:task:'.length);
    if (!isLanguageCode(code)) return true;
    const user = await dependencies.data.users.setTaskLanguage(id, code);
    await context.reply(COPY.taskLanguageUpdated(code), { parse_mode: 'HTML' });
    await context.reply(COPY.settings(user.taskLanguage, user.feedbackMode, user.level), {
      parse_mode: 'HTML',
      reply_markup: settingsKeyboard(user),
    });
    return true;
  }

  if (data.startsWith('set:feedback:')) {
    const mode = data.slice('set:feedback:'.length);
    if (mode !== 'english' && mode !== 'source') return true;
    const user = await dependencies.data.users.setFeedbackMode(id, mode);
    await context.reply(COPY.feedbackModeUpdated(mode), { parse_mode: 'HTML' });
    await context.reply(COPY.settings(user.taskLanguage, user.feedbackMode, user.level), {
      parse_mode: 'HTML',
      reply_markup: settingsKeyboard(user),
    });
    return true;
  }

  if (!data.startsWith('set:level:')) return false;
  const level = data.slice('set:level:'.length);
  if (!Object.values(CEFR).includes(level as CEFR)) return true;

  const user = await dependencies.data.users.setLevel(id, level as CEFR);
  await context.reply(COPY.levelUpdated(user.level), { parse_mode: 'HTML' });
  await context.reply(COPY.settings(user.taskLanguage, user.feedbackMode, user.level), {
    parse_mode: 'HTML',
    reply_markup: settingsKeyboard(user),
  });
  return true;
}
