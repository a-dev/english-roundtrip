import { InlineKeyboard } from 'grammy';

import type { FeedbackMode } from '../data/users';
import { TASK_LANGUAGES, type LanguageCode } from '../domain/languages';
import { CEFR } from '../domain/levels';
import { TIP_TIERS } from '../domain/tips';
import { getTopicsByCategory, type TopicCategory } from '../domain/topics';
import { COPY, taskLanguageLabel } from './copy';

export interface SettingsKeyboardValues {
  taskLanguage: LanguageCode | null;
  feedbackMode: FeedbackMode;
  level: CEFR;
}

export interface TaskLanguageKeyboardOptions {
  callbackPrefix?: 'set:task' | 'onb:task';
  includeBack?: boolean;
}

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(COPY.buttons.grammar, 'cat:grammar')
    .row()
    .text(COPY.buttons.vocabulary, 'cat:vocab')
    .row()
    .text(COPY.buttons.settings, 'act:settings')
    .row()
    .text(COPY.buttons.stats, 'nav:stats');
}

export function topicKeyboard(category: TopicCategory): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const topic of getTopicsByCategory(category)) {
    keyboard.text(topic.label, `topic:${topic.id}`).row();
  }
  return keyboard.text(COPY.buttons.back, 'nav:back');
}

export function postFeedbackKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(COPY.buttons.next, 'act:next')
    .row()
    .text(COPY.buttons.changeTopic, 'act:change')
    .row()
    .text(COPY.buttons.settings, 'act:settings');
}

export function settingsKeyboard(values: SettingsKeyboardValues): InlineKeyboard {
  return new InlineKeyboard()
    .text(COPY.buttons.taskLanguage(taskLanguageLabel(values.taskLanguage)), 'cfg:task')
    .row()
    .text(COPY.buttons.feedback(values.feedbackMode), 'cfg:feedback')
    .row()
    .text(COPY.buttons.level(values.level), 'cfg:level')
    .row()
    .text(COPY.buttons.back, 'nav:back');
}

export function taskLanguageKeyboard(
  current: LanguageCode,
  options: TaskLanguageKeyboardOptions = {},
): InlineKeyboard {
  const callbackPrefix = options.callbackPrefix ?? 'set:task';
  const keyboard = new InlineKeyboard();

  for (let index = 0; index < TASK_LANGUAGES.length; index += 2) {
    for (const language of TASK_LANGUAGES.slice(index, index + 2)) {
      const mark = language.code === current ? '✓ ' : '';
      keyboard.text(
        `${mark}${language.englishLabel} / ${language.nativeLabel}`,
        `${callbackPrefix}:${language.code}`,
      );
    }
    keyboard.row();
  }

  if (options.includeBack === true) {
    keyboard.text(COPY.buttons.back, 'cfg:back');
  }

  return keyboard;
}

export function feedbackModeKeyboard(
  values: Pick<SettingsKeyboardValues, 'feedbackMode'>,
): InlineKeyboard {
  const feedbackLabel = (mode: FeedbackMode, label: string) =>
    mode === values.feedbackMode ? `✓ ${label}` : label;

  return new InlineKeyboard()
    .text(feedbackLabel('english', COPY.buttons.feedbackEnglish), 'set:feedback:english')
    .row()
    .text(feedbackLabel('source', COPY.buttons.feedbackSource), 'set:feedback:source')
    .row()
    .text(COPY.buttons.back, 'cfg:back');
}

/** One button per tip tier, each carrying a `tip:<stars>` callback. */
export function tipKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  TIP_TIERS.forEach((stars, index) => {
    if (index > 0) keyboard.row();
    keyboard.text(`⭐ ${stars}`, `tip:${stars}`);
  });
  return keyboard;
}

export function levelKeyboard(values: Pick<SettingsKeyboardValues, 'level'>): InlineKeyboard {
  const levelLabel = (level: CEFR) => (level === values.level ? `✓ ${level}` : level);

  return new InlineKeyboard()
    .text(levelLabel(CEFR.A2), 'set:level:A2')
    .text(levelLabel(CEFR.B1), 'set:level:B1')
    .row()
    .text(levelLabel(CEFR.B2), 'set:level:B2')
    .text(levelLabel(CEFR.C1), 'set:level:C1')
    .row()
    .text(COPY.buttons.back, 'cfg:back');
}
