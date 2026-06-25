import type { Context } from 'grammy';

import { SessionState } from '../domain/state';
import { COPY } from '../ui/copy';
import { mainMenuKeyboard } from '../ui/keyboards';
import { showOnboarding } from './onboarding';
import { telegramId, type HandlerDependencies } from './types';

export function createStartHandler(dependencies: HandlerDependencies) {
  return async (context: Context): Promise<void> => {
    const id = telegramId(context);
    if (id === null) return;

    const user = await dependencies.data.users.getOrCreateUser(id);
    if (user.taskLanguage === null) {
      await showOnboarding(context, dependencies);
      return;
    }

    await dependencies.data.sessions.setState(id, SessionState.ChoosingCategory);
    await context.reply(`${COPY.welcome}\n\n${COPY.chooseCategory}`, {
      reply_markup: mainMenuKeyboard(),
    });
  };
}
