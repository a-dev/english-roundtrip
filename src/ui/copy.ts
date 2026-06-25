import type { FeedbackMode } from '../data/users';
import { getTaskLanguageLabels, type LanguageCode } from '../domain/languages';
import type { CEFR } from '../domain/levels';

const FEEDBACK_MODE_LABEL: Readonly<Record<FeedbackMode, string>> = {
  english: 'English',
  source: 'Task language',
};

const NOT_SET = 'Not set';

export function taskLanguageLabel(code: LanguageCode | null): string {
  return code === null ? NOT_SET : getTaskLanguageLabels(code).englishLabel;
}

/** All user-facing English copy, kept separate from domain and handler logic. */
export const COPY = {
  buttons: {
    grammar: '📚 Grammar',
    vocabulary: '🗣 Vocabulary',
    settings: '⚙️ Settings',
    stats: '📊 Stats',
    next: '➡️ Next',
    changeTopic: '🔀 Change topic',
    back: '⬅️ Back',
    taskLanguage: (language: string) => `🌐 Task language: ${language}`,
    feedback: (mode: FeedbackMode) => `💬 Feedback: ${FEEDBACK_MODE_LABEL[mode]}`,
    level: (level: CEFR) => `📊 Level: ${level}`,
    feedbackEnglish: 'English',
    feedbackSource: 'Task language',
  },
  commands: {
    start: 'Open the main menu',
    practice: 'Choose an exercise',
    topics: 'Browse practice topics',
    settings: 'Change bot settings',
    level: 'Change your CEFR level',
    language: 'Change task language',
    stats: 'View your progress',
    help: 'Learn how the bot works',
    cancel: 'Cancel the current exercise',
  },
  verdict: {
    correct: '✅ <b>Correct</b>',
    almost: '⚠️ <b>Almost there</b>',
    needsWork: '❌ <b>Needs work</b>',
  },
  grading: {
    correctedTranslation: '<b>Corrected translation</b>',
    whatToImprove: '<b>What to improve</b>',
    naturalAlternative: '<b>Natural alternative</b>',
  },
  welcome:
    'Welcome to English Roundtrip! Pick a focus, translate one sentence into English, and get clear feedback.',
  onboarding: 'Choose the language you want to translate from. English is always the target.',
  onboardingComplete: (code: LanguageCode) =>
    `Task language set to <b>${taskLanguageLabel(code)}</b>.\n\nWhat would you like to practise?`,
  chooseCategory: 'What would you like to practise?',
  chooseGrammarTopic: 'Choose a grammar topic.',
  chooseVocabularyTopic: 'Choose a vocabulary topic.',
  chooseTaskLanguage: 'Choose your task language.',
  chooseFeedbackMode: 'Choose the language for explanations.',
  chooseLevel: 'Choose your CEFR level.',
  translate: (sentence: string, language: string) => `✍️ Translate from ${language}: «${sentence}»`,
  help: [
    '<b>How English Roundtrip works</b>',
    '',
    '1. Choose the language you want to translate from.',
    '2. Translate one sentence into English.',
    '3. Get a correction and a short explanation.',
    '4. Change task language, feedback mode, or level in /settings.',
    '',
    '<b>Privacy</b>',
    'The bot stores your Telegram ID, settings, and lightweight progress. Free-tier Gemini prompts may be used by Google for training, so do not send sensitive personal information.',
    '',
    'Use /practice to begin, /stats to view progress, or /cancel to stop the current exercise.',
  ].join('\n'),
  cancelled: 'Current exercise cancelled.',
  feedbackActions: 'Choose what to do next.',
  settings: (taskLanguage: LanguageCode | null, mode: FeedbackMode, level: CEFR) =>
    [
      '<b>Settings</b>',
      '',
      `Task language: <b>${taskLanguageLabel(taskLanguage)}</b>`,
      `Feedback explanations: <b>${FEEDBACK_MODE_LABEL[mode]}</b>`,
      `Level: <b>${level}</b>`,
    ].join('\n'),
  taskLanguageUpdated: (code: LanguageCode) =>
    `New exercises will use <b>${taskLanguageLabel(code)}</b> source sentences.`,
  feedbackModeUpdated: (mode: FeedbackMode) =>
    `Feedback explanations will be shown in <b>${FEEDBACK_MODE_LABEL[mode]}</b>.`,
  levelUpdated: (level: CEFR) => `New exercises will use <b>${level}</b> difficulty.`,
  stats: {
    title: '<b>📊 Your progress</b>',
    exercises: 'Exercises',
    accuracy: 'Accuracy',
    currentStreak: 'Current streak',
    weakSpots: 'Top weak spots',
    noWeakSpots: 'No weak spots yet — complete an exercise to see patterns.',
  },
  nudgeText: 'Please send your translation as a text message.',
  unknownCommand: 'I don’t know that command. Try /practice or /help.',
  notPractising: 'Choose /practice to start a translation exercise, or use /help for guidance.',
  unknownTopic: 'That topic is no longer available. Please choose another one.',
  stateLost: 'That exercise is no longer available. Please choose a topic and try again.',
  stillWorking: '⏳ I’m still working on your last one…',
  cooldown: '⏳ Please wait a few seconds before the next AI request.',
  busy: '⏳ I’m a bit busy right now — try again in a few seconds.',
  dailyLimit: '⏳ Today’s AI limit has been reached. Please try again later.',
  aiTimedOut: 'Sorry, that took too long. Please try again in a moment.',
  emptyAnswer: 'Please send a non-empty translation.',
  answerTooLong: 'Please keep your translation under 1,000 characters.',
  unexpectedError: 'Sorry, something went wrong. Please try again in a moment.',
  generateFailed: 'I couldn’t create an exercise just now. Please try again in a moment.',
  gradeFailed: 'I couldn’t grade that answer just now. Please send it again in a moment.',
} as const;
