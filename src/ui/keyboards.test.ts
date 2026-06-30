import { expect, test } from 'bun:test';

import { CEFR } from '../domain/levels';
import { TASK_LANGUAGES } from '../domain/languages';
import { TIP_TIERS } from '../domain/tips';
import { getTopicsByCategory } from '../domain/topics';
import {
  feedbackModeKeyboard,
  levelKeyboard,
  mainMenuKeyboard,
  postFeedbackKeyboard,
  settingsKeyboard,
  taskLanguageKeyboard,
  tipKeyboard,
  topicKeyboard,
} from './keyboards';

test('keyboard builders use the documented callback payloads', () => {
  expect(mainMenuKeyboard().inline_keyboard).toEqual([
    [{ text: '📚 Grammar', callback_data: 'cat:grammar' }],
    [{ text: '🗣 Vocabulary', callback_data: 'cat:vocab' }],
    [{ text: '⚙️ Settings', callback_data: 'act:settings' }],
    [{ text: '📊 Stats', callback_data: 'nav:stats' }],
  ]);

  expect(topicKeyboard('grammar').inline_keyboard[0]).toEqual([
    { text: 'Present tenses', callback_data: 'topic:present-tenses' },
  ]);

  for (const category of ['grammar', 'vocab'] as const) {
    const topicButtons = topicKeyboard(category).inline_keyboard.slice(0, -1).flat();
    expect(topicButtons).toEqual(
      getTopicsByCategory(category).map((topic) => ({
        text: topic.label,
        callback_data: `topic:${topic.id}`,
      })),
    );
  }

  expect(postFeedbackKeyboard().inline_keyboard).toEqual([
    [{ text: '➡️ Next', callback_data: 'act:next' }],
    [{ text: '🔀 Change topic', callback_data: 'act:change' }],
    [{ text: '⚙️ Settings', callback_data: 'act:settings' }],
  ]);

  expect(
    settingsKeyboard({ taskLanguage: 'es', feedbackMode: 'source', level: CEFR.B1 })
      .inline_keyboard,
  ).toEqual([
    [{ text: '🌐 Task language: Spanish', callback_data: 'cfg:task' }],
    [{ text: '💬 Feedback: Task language', callback_data: 'cfg:feedback' }],
    [{ text: '📊 Level: B1', callback_data: 'cfg:level' }],
    [{ text: '⬅️ Back', callback_data: 'nav:back' }],
  ]);

  const taskLanguageButtons = taskLanguageKeyboard('es', {
    callbackPrefix: 'onb:task',
  }).inline_keyboard.flat();
  expect(taskLanguageButtons).toHaveLength(TASK_LANGUAGES.length);
  expect(taskLanguageButtons).toContainEqual({
    text: '✓ Spanish / Español',
    callback_data: 'onb:task:es',
  });
  expect(taskLanguageButtons).toContainEqual({
    text: 'Japanese / 日本語',
    callback_data: 'onb:task:ja',
  });

  expect(feedbackModeKeyboard({ feedbackMode: 'source' }).inline_keyboard).toEqual([
    [{ text: 'English', callback_data: 'set:feedback:english' }],
    [{ text: '✓ Task language', callback_data: 'set:feedback:source' }],
    [{ text: '⬅️ Back', callback_data: 'cfg:back' }],
  ]);

  expect(levelKeyboard({ level: CEFR.B1 }).inline_keyboard).toEqual([
    [
      { text: 'A2', callback_data: 'set:level:A2' },
      { text: '✓ B1', callback_data: 'set:level:B1' },
    ],
    [
      { text: 'B2', callback_data: 'set:level:B2' },
      { text: 'C1', callback_data: 'set:level:C1' },
    ],
    [{ text: '⬅️ Back', callback_data: 'cfg:back' }],
  ]);

  expect(tipKeyboard().inline_keyboard).toEqual(
    TIP_TIERS.map((stars) => [{ text: `⭐ ${stars}`, callback_data: `tip:${stars}` }]),
  );
});
