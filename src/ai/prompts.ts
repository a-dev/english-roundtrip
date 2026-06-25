import { CEFR, CEFR_LABELS, getLevelDescriptor } from '../domain/levels';
import { ERROR_CATEGORIES } from '../domain/errors';
import type { FeedbackMode } from '../data/users';

/** A system + user message pair handed to `generateObject`. */
export interface PromptPair {
  system: string;
  prompt: string;
}

export interface GenerationPromptInput {
  topicHint: string;
  taskLanguageLabel: string;
  level: CEFR;
  recentSentences: readonly string[];
}

export interface GradingPromptInput {
  sourceSentence: string;
  userTranslation: string;
  topic: string;
  taskLanguageLabel: string;
  level: CEFR;
  referenceTranslation: string;
  targetPoints: readonly string[];
  feedbackMode: FeedbackMode;
}

export function resolveFeedbackLanguageLabel(
  feedbackMode: FeedbackMode,
  taskLanguageLabel: string,
): string {
  return feedbackMode === 'english' ? 'English' : taskLanguageLabel;
}

function levelLine(level: CEFR): string {
  return `${CEFR_LABELS[level]} — ${getLevelDescriptor(level)}`;
}

function renderRecentList(recentSentences: readonly string[]): string {
  if (recentSentences.length === 0) {
    return 'None yet.';
  }
  return recentSentences.map((sentence) => `- ${sentence}`).join('\n');
}

/**
 * Builds the generation prompt: one safe, on-topic, level-appropriate source
 * sentence plus a hidden English reference and the points it tests.
 */
export function buildGenerationPrompt(input: GenerationPromptInput): PromptPair {
  const system = [
    `You are an expert teacher of ${input.taskLanguageLabel} who writes translation exercises for English learners.`,
    'Follow every rule exactly:',
    `1. Output EXACTLY ONE ${input.taskLanguageLabel} sentence for the learner to translate into English — never two sentences, never a list.`,
    `2. Write that sentence in natural, idiomatic ${input.taskLanguageLabel}, using ${input.taskLanguageLabel}'s native script and native punctuation.`,
    `3. Match the target CEFR level: ${levelLine(input.level)}`,
    "4. Stay on the requested topic's grammar/vocabulary focus. When its hint names variants, test one clear, level-appropriate target rather than cramming them together.",
    '5. The CEFR level takes precedence when selecting the target variant and complexity; never force advanced structures or vocabulary at a lower level.',
    '6. Keep content safe and non-sensitive: use everyday, neutral scenarios only. Do not include violence, politics, religion, adult themes, profanity, medical or legal advice, or other sensitive content.',
    '7. Also provide a natural English reference translation (hidden from the learner) and list, in targetPoints, the specific grammar or vocabulary the sentence tests.',
    '8. Do NOT reuse or closely paraphrase any sentence in the recent list.',
  ].join('\n');

  const prompt = [
    `Topic focus: ${input.topicHint}`,
    `Task language: ${input.taskLanguageLabel}`,
    `CEFR level: ${levelLine(input.level)}`,
    '',
    'Recent sentences to avoid repeating:',
    renderRecentList(input.recentSentences),
    '',
    `Produce one new ${input.taskLanguageLabel} sentence with its hidden English reference translation and targetPoints.`,
  ].join('\n');

  return { system, prompt };
}

/**
 * Builds the grading prompt: a supportive correction of the learner's English
 * translation, explained in their chosen feedback language.
 */
export function buildGradingPrompt(input: GradingPromptInput): PromptPair {
  const languageLabel = resolveFeedbackLanguageLabel(input.feedbackMode, input.taskLanguageLabel);

  const system = [
    'You are a supportive English coach.',
    `The learner was shown a ${input.taskLanguageLabel} sentence and translated it into English.`,
    'Follow every rule exactly:',
    '1. Choose a verdict: "correct", "almost", or "needs_work".',
    `2. Accept any natural translation that preserves the ${input.taskLanguageLabel} sentence's meaning, even when it differs from the hidden reference. If it is fully acceptable, set verdict="correct" and leave issues EMPTY.`,
    '3. Judge at the requested CEFR level: identify real errors, but accept legitimate level-appropriate variation and never mark a stylistic preference as an error.',
    `4. Write every explanation and the encouragement in ${languageLabel}.`,
    '5. ALWAYS write correctedTranslation and alternative in English, regardless of the feedback language.',
    `6. For each genuine issue, quote the learner's problematic fragment, classify it as one of these categories: ${ERROR_CATEGORIES.join(', ')}, and explain the correction clearly.`,
    '7. Be supportive and encouraging throughout.',
  ].join('\n');

  const prompt = [
    `Source sentence (${input.taskLanguageLabel}): ${input.sourceSentence}`,
    `Hidden reference translation (English): ${input.referenceTranslation}`,
    `Topic: ${input.topic}`,
    `CEFR level: ${levelLine(input.level)}`,
    `Points being tested: ${input.targetPoints.join(', ')}`,
    `Feedback language for explanations: ${languageLabel}`,
    '',
    `Learner's English translation: ${input.userTranslation}`,
  ].join('\n');

  return { system, prompt };
}
