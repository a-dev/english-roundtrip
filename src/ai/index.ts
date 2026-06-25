export { createAiModel, DEFAULT_GEMINI_MODEL, type AiModelConfig } from './client';
export {
  generateExercise,
  GENERATION_TEMPERATURE,
  type GenerateExerciseInput,
  type AiCallOptions,
} from './generate';
export { gradeTranslation, GRADING_TEMPERATURE, type GradeTranslationInput } from './grade';
export { AiError, type AiOperation, type AiErrorKind } from './errors';
export {
  GenerationSchema,
  GradingSchema,
  ErrorCategorySchema,
  GradingVerdictSchema,
  type Generation,
  type Grading,
  type GradingIssue,
  type GradingVerdict,
} from './schemas';
export type { ObjectGenerator } from './run';
