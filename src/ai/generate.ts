import type { LanguageModel } from 'ai';

import type { CEFR } from '../domain/levels';
import { getTaskLanguageLabels, type LanguageCode } from '../domain/languages';
import { buildGenerationPrompt } from './prompts';
import { GenerationSchema, type Generation } from './schemas';
import { defaultObjectGenerator, runStructured, type ObjectGenerator } from './run';

/** Higher temperature favours variety across generated sentences. */
export const GENERATION_TEMPERATURE = 0.9;

export interface GenerateExerciseInput {
  topicHint: string;
  taskLanguage: LanguageCode;
  level: CEFR;
  recentSentences: readonly string[];
}

/** Runtime dependencies; `generator`/`timeoutMs` exist mainly for testing. */
export interface AiCallOptions {
  model: LanguageModel;
  generator?: ObjectGenerator;
  timeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

/**
 * Produces one source-language sentence to translate, with a hidden English reference
 * and the points it tests. Retries once on invalid output, then throws a typed
 * `AiError` (see {@link runStructured}).
 */
export function generateExercise(
  input: GenerateExerciseInput,
  options: AiCallOptions,
): Promise<Generation> {
  const { system, prompt } = buildGenerationPrompt({
    ...input,
    taskLanguageLabel: getTaskLanguageLabels(input.taskLanguage).englishLabel,
  });
  return runStructured({
    operation: 'generate',
    schema: GenerationSchema,
    system,
    prompt,
    temperature: GENERATION_TEMPERATURE,
    model: options.model,
    generator: options.generator ?? defaultObjectGenerator,
    timeoutMs: options.timeoutMs,
    sleep: options.sleep,
  });
}
