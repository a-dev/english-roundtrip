import type { Context } from 'grammy';

import { COPY } from '../ui/copy';

export async function handleHelp(context: Context): Promise<void> {
  await context.reply(COPY.help, { parse_mode: 'HTML' });
}
