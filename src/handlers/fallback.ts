import type { Context } from 'grammy';

import { SessionState } from '../domain/state';
import { isAiRequestInFlight } from '../ratelimit/cooldown';
import { COPY } from '../ui/copy';
import { telegramId, type HandlerDependencies } from './types';

/** Final handler for unknown commands, idle text, and non-text answers. */
export function createFallbackHandler(dependencies: HandlerDependencies) {
  return async (context: Context): Promise<void> => {
    const id = telegramId(context);
    if (id === null || context.message === undefined) return;

    const text = 'text' in context.message ? context.message.text : undefined;
    if (text?.startsWith('/')) {
      await context.reply(COPY.unknownCommand);
      return;
    }

    const session = await dependencies.data.sessions.getSession(id);
    if (isAiRequestInFlight(session.state)) {
      await context.reply(COPY.stillWorking);
      return;
    }
    if (!('text' in context.message) && session.state === SessionState.AwaitingAnswer) {
      await context.reply(COPY.nudgeText);
      return;
    }

    if (text !== undefined) {
      await context.reply(COPY.notPractising);
    }
  };
}
