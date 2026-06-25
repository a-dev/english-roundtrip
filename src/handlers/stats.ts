import type { Context } from 'grammy';

import type { Stats } from '../data/stats';
import { COPY } from '../ui/copy';
import { mainMenuKeyboard } from '../ui/keyboards';
import { telegramId, type HandlerDependencies } from './types';

function formatCategory(category: string): string {
  return category.replaceAll('-', ' ');
}

export function formatStats(stats: Stats): string {
  const lines = [
    COPY.stats.title,
    '',
    `${COPY.stats.exercises}: <b>${stats.totalExercises}</b>`,
    `${COPY.stats.accuracy}: <b>${stats.accuracy}%</b>`,
    `${COPY.stats.currentStreak}: <b>${stats.currentStreak}</b>`,
    '',
    `<b>${COPY.stats.weakSpots}</b>`,
  ];

  if (stats.weakCategories.length === 0) {
    lines.push(COPY.stats.noWeakSpots);
  } else {
    lines.push(
      ...stats.weakCategories.map((item) => `• ${formatCategory(item.category)} — ${item.count}`),
    );
  }
  return lines.join('\n');
}

export async function showStats(
  context: Context,
  dependencies: HandlerDependencies,
): Promise<void> {
  const id = telegramId(context);
  if (id === null) return;

  const stats = await dependencies.data.stats.getStats(id);
  await context.reply(formatStats(stats), { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() });
}

/** Handles the stats navigation callback and returns whether it consumed the event. */
export async function handleStatsCallback(
  context: Context,
  data: string,
  dependencies: HandlerDependencies,
): Promise<boolean> {
  if (data !== 'nav:stats') return false;
  await showStats(context, dependencies);
  return true;
}
