import type { Context } from 'grammy';

import type { Generation } from '../ai/schemas';
import type { GenerateExerciseInput } from '../ai/generate';
import type { GradeTranslationInput } from '../ai/grade';
import type { Grading } from '../ai/schemas';
import type { DataLayer } from '../data';

/** Dependencies that vary between the Worker and handler-level tests. */
export interface HandlerDependencies {
  data: DataLayer;
  /** Minimum spacing between AI calls; production gets this from Worker config. */
  cooldownSeconds?: number;
  generateExercise(input: GenerateExerciseInput): Promise<Generation>;
  gradeTranslation(input: GradeTranslationInput): Promise<Grading>;
}

export function telegramId(context: Context): number | null {
  return context.from?.id ?? null;
}
