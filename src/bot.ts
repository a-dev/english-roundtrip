import { Bot, type Context } from 'grammy';
import type { BotCommand } from '@grammyjs/types/manage';

import { createAiModel } from './ai/client';
import { generateExercise } from './ai/generate';
import { gradeTranslation } from './ai/grade';
import type { Config } from './config';
import { createDataLayer } from './data';
import { createCancelHandler } from './handlers/cancel';
import { createFallbackHandler } from './handlers/fallback';
import { handleHelp } from './handlers/help';
import { handleMenuCallback, showCategoryMenu } from './handlers/menu';
import { handleOnboardingCallback } from './handlers/onboarding';
import { handlePracticeCallback, handleTranslation } from './handlers/practice';
import {
  handleSettingsCallback,
  showLevelSettings,
  showSettings,
  showTaskLanguageSettings,
} from './handlers/settings';
import { createStartHandler } from './handlers/start';
import { handleStatsCallback, showStats } from './handlers/stats';
import {
  handlePreCheckout,
  handleSuccessfulPayment,
  handleTipCallback,
  handleTipCommand,
} from './handlers/tip';
import type { HandlerDependencies } from './handlers/types';
import { COPY } from './ui/copy';

export const BOT_COMMANDS = [
  { command: 'start', description: COPY.commands.start },
  { command: 'practice', description: COPY.commands.practice },
  { command: 'topics', description: COPY.commands.topics },
  { command: 'settings', description: COPY.commands.settings },
  { command: 'language', description: COPY.commands.language },
  { command: 'level', description: COPY.commands.level },
  { command: 'stats', description: COPY.commands.stats },
  { command: 'tip', description: COPY.commands.tip },
  { command: 'help', description: COPY.commands.help },
  { command: 'cancel', description: COPY.commands.cancel },
] as const satisfies readonly BotCommand[];

/** Compose Worker-bound data and AI adapters once per bot instance. */
export function createBotDependencies(config: Config): HandlerDependencies {
  const model = createAiModel({ apiKey: config.GEMINI_API_KEY, model: config.GEMINI_MODEL });
  return {
    data: createDataLayer(config),
    cooldownSeconds: config.COOLDOWN_SECONDS,
    generateExercise: (input) => generateExercise(input, { model }),
    gradeTranslation: (input) => gradeTranslation(input, { model }),
  };
}

/** Configure all grammY routing; injectable dependencies keep handlers deterministic in tests. */
export function createBot(token: string, dependencies: HandlerDependencies): Bot<Context> {
  const bot = new Bot<Context>(token);

  // Webhook dispatch must acknowledge updates even when a handler fails. This
  // middleware is deliberately first so it covers command, callback, and
  // fallback routes while still giving the learner a useful response.
  bot.use(async (context, next) => {
    try {
      await next();
    } catch (error) {
      console.error('Unhandled bot update', {
        error,
        updateId: context.update.update_id,
        telegramId: context.from?.id,
      });
      try {
        await context.reply(COPY.unexpectedError);
      } catch (replyError) {
        console.error('Failed to send bot error apology', {
          error: replyError,
          updateId: context.update.update_id,
          telegramId: context.from?.id,
        });
      }
    }
  });

  // Commands must be registered before generic message handlers so commands
  // never accidentally become translation answers.
  bot.command('start', createStartHandler(dependencies));
  bot.command(['practice', 'topics'], (context) => showCategoryMenu(context, dependencies));
  bot.command('settings', (context) => showSettings(context, dependencies));
  bot.command('language', (context) => showTaskLanguageSettings(context, dependencies));
  bot.command('level', (context) => showLevelSettings(context, dependencies));
  bot.command('stats', (context) => showStats(context, dependencies));
  bot.command('tip', (context) => handleTipCommand(context, dependencies));
  bot.command('help', handleHelp);
  bot.command('cancel', createCancelHandler(dependencies));

  // Acknowledge every callback before dispatching it, including stale buttons.
  bot.on('callback_query:data', async (context) => {
    await context.answerCallbackQuery();
    const data = context.callbackQuery.data;
    if (await handleOnboardingCallback(context, data, dependencies)) return;
    if (await handleMenuCallback(context, data, dependencies)) return;
    if (await handlePracticeCallback(context, data, dependencies)) return;
    if (await handleSettingsCallback(context, data, dependencies)) return;
    if (await handleTipCallback(context, data)) return;
    await handleStatsCallback(context, data, dependencies);
  });

  // Payment updates must be registered before the generic `message` fallback: a
  // successful_payment is a service message with no text, so it slips past
  // `message:text` but the fallback would otherwise nudge "send a translation".
  bot.on('pre_checkout_query', handlePreCheckout);
  bot.on('message:successful_payment', (context) => handleSuccessfulPayment(context, dependencies));

  bot.on('message:text', async (context, next) => {
    if (await handleTranslation(context, dependencies)) return;
    await next();
  });
  bot.on('message', createFallbackHandler(dependencies));

  return bot;
}

/** Register Telegram's command menu once when the Worker initializes the bot. */
export function registerBotCommands(bot: Bot<Context>): Promise<true> {
  return bot.api.setMyCommands(BOT_COMMANDS);
}
