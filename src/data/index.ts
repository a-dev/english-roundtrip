import type { Config } from '../config';
import { createSessionsRepository } from './sessions';
import { createStatsRepository } from './stats';
import { createUsersRepository } from './users';

export interface DataLayerOptions {
  now?: () => Date;
  weakCategoryLimit?: number;
}

/**
 * Compose the repositories from validated Worker configuration.
 * All repositories share the same D1 binding and provision users on first touch.
 */
export function createDataLayer(
  config: Pick<Config, 'DB' | 'ANTI_REPEAT_WINDOW'>,
  options: DataLayerOptions = {},
) {
  return {
    users: createUsersRepository(config.DB),
    sessions: createSessionsRepository(config.DB, {
      antiRepeatWindow: config.ANTI_REPEAT_WINDOW,
      now: options.now,
    }),
    stats: createStatsRepository(config.DB, {
      now: options.now,
      weakCategoryLimit: options.weakCategoryLimit,
    }),
  };
}

export type DataLayer = ReturnType<typeof createDataLayer>;
