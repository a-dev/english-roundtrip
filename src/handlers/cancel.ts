import type { Context } from 'grammy';

import { COPY } from '../ui/copy';
import { mainMenuKeyboard } from '../ui/keyboards';
import { telegramId, type HandlerDependencies } from './types';

export function createCancelHandler(dependencies: HandlerDependencies) {
  return async (context: Context): Promise<void> => {
    const id = telegramId(context);
    if (id === null) return;

    await dependencies.data.sessions.clear(id);
    await context.reply(COPY.cancelled, { reply_markup: mainMenuKeyboard() });
  };
}
