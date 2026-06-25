import { expect, test } from 'bun:test';

import {
  LANGUAGE_CODES,
  TASK_LANGUAGES,
  getTaskLanguage,
  getTaskLanguageLabels,
  inferTaskLanguage,
} from './languages';

test('task-language catalog exposes the supported codes and labels', () => {
  expect(LANGUAGE_CODES).toEqual([
    'pt',
    'es',
    'ar',
    'zh',
    'pl',
    'uk',
    'ru',
    'tr',
    'fr',
    'de',
    'it',
    'ja',
  ]);
  expect(TASK_LANGUAGES).toHaveLength(12);
  expect(new Set(TASK_LANGUAGES.map((language) => language.code)).size).toBe(TASK_LANGUAGES.length);

  expect(getTaskLanguage('pl')).toEqual({
    code: 'pl',
    englishLabel: 'Polish',
    nativeLabel: 'Polski',
  });
  expect(getTaskLanguageLabels('ja')).toEqual({
    englishLabel: 'Japanese',
    nativeLabel: '日本語',
  });

  for (const language of TASK_LANGUAGES) {
    expect(language.englishLabel.trim()).not.toBe('');
    expect(language.nativeLabel.trim()).not.toBe('');
  }
});

test('Telegram language codes are inferred to the supported task-language catalog', () => {
  expect(inferTaskLanguage('uk')).toBe('uk');
  expect(inferTaskLanguage('es-MX')).toBe('es');
  expect(inferTaskLanguage('pt-br')).toBe('pt');
  expect(inferTaskLanguage('pt_BR')).toBe('pt');
  expect(inferTaskLanguage('zh-hans')).toBe('zh');
  expect(inferTaskLanguage('zh_Hant')).toBe('zh');
  expect(inferTaskLanguage('ja-JP')).toBe('ja');
});

test('English and unmapped Telegram languages fall back to the first supported language', () => {
  const fallback = LANGUAGE_CODES[0];
  expect(inferTaskLanguage()).toBe(fallback);
  expect(inferTaskLanguage('')).toBe(fallback);
  expect(inferTaskLanguage('en')).toBe(fallback);
  expect(inferTaskLanguage('en-US')).toBe(fallback);
  expect(inferTaskLanguage('ko')).toBe(fallback);
});
