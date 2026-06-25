import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

/**
 * Fallback model id, used only when `GEMINI_MODEL` is unset (e.g. the live
 * smoke test). The deployed default lives in wrangler.toml [vars]; the current
 * choice and rationale are tracked in docs/model.md.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';

export interface AiModelConfig {
  apiKey: string;
  /** Model id; defaults to {@link DEFAULT_GEMINI_MODEL} when omitted/blank. */
  model?: string;
}

/**
 * Builds the provider-bound language model. This is the *only* module that
 * knows we use Gemini via `@ai-sdk/google`; everything downstream takes a plain
 * `LanguageModel`, so swapping providers is local to this file (context.md §5).
 */
export function createAiModel(config: AiModelConfig): LanguageModel {
  const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
  return google(config.model?.trim() || DEFAULT_GEMINI_MODEL);
}
