import type { Context } from 'grammy';

import { inferTaskLanguage, isLanguageCode, type LanguageCode } from '../domain/languages';
import { canChooseTaskLanguage, SessionState } from '../domain/state';
import { COPY } from '../ui/copy';
import { mainMenuKeyboard, taskLanguageKeyboard } from '../ui/keyboards';
import { telegramId, type HandlerDependencies } from './types';

export async function showOnboarding(
  context: Context,
  dependencies: HandlerDependencies,
  current: LanguageCode = inferTaskLanguage(context.from?.language_code),
): Promise<void> {
  const id = telegramId(context);
  if (id === null) return;

  await dependencies.data.users.getOrCreateUser(id);
  await dependencies.data.sessions.setState(id, SessionState.ChoosingTaskLanguage);
  await context.reply(COPY.onboarding, {
    reply_markup: taskLanguageKeyboard(current, { callbackPrefix: 'onb:task' }),
  });
}

/**
 * Routes a first-run user (no task language yet) into onboarding and reports
 * whether it did so, letting any entry point short-circuit before its own work.
 */
export async function needsOnboarding(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<boolean> {
  const id = telegramId(context);
  if (id === null) return false;

  const user = await dependencies.data.users.getOrCreateUser(id);
  if (user.taskLanguage !== null) return false;

  await showOnboarding(context, dependencies);
  return true;
}

/** Handles first-run language selection and returns whether it consumed the event. */
export async function handleOnboardingCallback(
  context: Context,
  data: string,
  dependencies: HandlerDependencies,
): Promise<boolean> {
  if (!data.startsWith('onb:task:')) return false;

  // The prefix is ours, so consume the event even when the code is malformed
  // (stale/crafted callback) rather than leaking it to later handlers.
  const code = data.slice('onb:task:'.length);
  if (!isLanguageCode(code)) return true;

  const id = telegramId(context);
  if (id === null) return true;

  const session = await dependencies.data.sessions.getSession(id);
  if (!canChooseTaskLanguage(session)) {
    await context.reply(COPY.chooseCategory, { reply_markup: mainMenuKeyboard() });
    return true;
  }

  await dependencies.data.users.setTaskLanguage(id, code);
  await dependencies.data.sessions.setState(id, SessionState.ChoosingCategory);
  await context.reply(COPY.onboardingComplete(code), {
    parse_mode: 'HTML',
    reply_markup: mainMenuKeyboard(),
  });
  return true;
}
