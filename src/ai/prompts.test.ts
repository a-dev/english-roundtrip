import { expect, test } from 'bun:test';

import { CEFR, CEFR_LABELS, getLevelDescriptor } from '../domain/levels';
import { ERROR_CATEGORIES } from '../domain/errors';
import { buildGenerationPrompt, buildGradingPrompt } from './prompts';

test('generation prompt includes level, topic, anti-repeat list, and the one-sentence/safety rules', () => {
  const { system, prompt } = buildGenerationPrompt({
    topicHint: 'Use the present perfect with for/since',
    taskLanguageLabel: 'Spanish',
    level: CEFR.B2,
    recentSentences: ['Vivo aquí desde hace dos años.', 'Nos conocemos desde niños.'],
  });
  const combined = `${system}\n${prompt}`;

  expect(combined).toContain(CEFR_LABELS[CEFR.B2]);
  expect(combined).toContain(getLevelDescriptor(CEFR.B2));
  expect(combined).toContain('Use the present perfect with for/since');
  expect(combined).toContain('Spanish');
  expect(combined).toContain('Vivo aquí desde hace dos años.');
  expect(combined).toContain('Nos conocemos desde niños.');
  expect(combined).toContain('EXACTLY ONE Spanish sentence');
  expect(system).toContain('expert teacher of Spanish');
  expect(system).toContain('native script and native punctuation');
  expect(combined.toLowerCase()).toContain('safe');
  expect(system).toContain('CEFR level takes precedence');
  expect(system).toContain('medical or legal advice');
});

test('generation prompt shows a placeholder when there are no recent sentences', () => {
  const { prompt } = buildGenerationPrompt({
    topicHint: 'Daily routines',
    taskLanguageLabel: 'Japanese',
    level: CEFR.A2,
    recentSentences: [],
  });

  expect(prompt).toContain('None yet.');
});

test('grading prompt carries inputs, the feedback-language directive, and the category list', () => {
  const { system, prompt } = buildGradingPrompt({
    sourceSentence: 'Ya he leído este libro.',
    userTranslation: 'I already read this book.',
    topic: 'Present perfect',
    taskLanguageLabel: 'Spanish',
    level: CEFR.B1,
    referenceTranslation: 'I have already read this book.',
    targetPoints: ['present perfect', 'already'],
    feedbackMode: 'source',
  });
  const combined = `${system}\n${prompt}`;

  expect(combined).toContain('Ya he leído este libro.');
  expect(combined).toContain('I already read this book.');
  expect(combined).toContain('Present perfect');
  expect(combined).toContain(getLevelDescriptor(CEFR.B1));
  expect(combined).toContain('present perfect, already');
  expect(system).toContain('supportive English coach');
  expect(system).toContain('shown a Spanish sentence');
  // Explanations in the source language; corrections always in English.
  expect(system).toContain('in Spanish');
  expect(system).toContain('English');
  expect(system).toContain('Accept any natural translation');
  expect(system).toContain('level-appropriate variation');
  for (const category of ERROR_CATEGORIES) {
    expect(system).toContain(category);
  }
});

test('grading prompt switches the explanation language to English when requested', () => {
  const { system } = buildGradingPrompt({
    sourceSentence: 'Hola.',
    userTranslation: 'Hi.',
    topic: 'Greetings',
    taskLanguageLabel: 'Spanish',
    level: CEFR.A2,
    referenceTranslation: 'Hello.',
    targetPoints: ['greetings'],
    feedbackMode: 'english',
  });

  expect(system).toContain('in English');
});
