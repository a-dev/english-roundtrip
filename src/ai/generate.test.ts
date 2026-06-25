import { expect, test } from 'bun:test';
import { APICallError, type LanguageModel } from 'ai';

import { CEFR } from '../domain/levels';
import { AiError } from './errors';
import { GENERATION_TEMPERATURE, generateExercise, type GenerateExerciseInput } from './generate';
import type { ObjectGenerator } from './run';

const model = {} as LanguageModel;

const input: GenerateExerciseInput = {
  topicHint: 'Present perfect with for/since',
  taskLanguage: 'ru',
  level: CEFR.B1,
  recentSentences: [],
};

const validObject = {
  sourceSentence: 'Я знаю её много лет.',
  referenceTranslation: 'I have known her for many years.',
  targetPoints: ['present perfect', 'for'],
};

/** A generator that returns each queued result in turn, recording its args. */
function scriptedGenerator(results: unknown[]) {
  const calls: Array<{ temperature: number; system: string; prompt: string }> = [];
  const generator: ObjectGenerator = async (args) => {
    calls.push({ temperature: args.temperature, system: args.system, prompt: args.prompt });
    const object = results.shift();
    return { object };
  };
  return { generator, calls };
}

function rateLimitError(message: string, responseHeaders?: Record<string, string>) {
  return new APICallError({
    message,
    url: 'https://generativelanguage.googleapis.com/test',
    requestBodyValues: {},
    statusCode: 429,
    responseHeaders,
  });
}

test('generateExercise maps a valid model object to the Generation type', async () => {
  const { generator, calls } = scriptedGenerator([validObject]);

  const result = await generateExercise(input, { model, generator });

  expect(result).toEqual(validObject);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.temperature).toBe(GENERATION_TEMPERATURE);
  expect(calls[0]?.prompt).toContain('Present perfect with for/since');
});

test('generateExercise retries once when the first object fails to parse', async () => {
  const { generator, calls } = scriptedGenerator([{ sourceSentence: '' }, validObject]);

  const result = await generateExercise(input, { model, generator });

  expect(result).toEqual(validObject);
  expect(calls).toHaveLength(2);
});

test('generateExercise throws a typed AiError after repeated invalid output', async () => {
  const { generator, calls } = scriptedGenerator([{ bad: true }, { worse: true }]);

  const error = await generateExercise(input, { model, generator }).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(AiError);
  expect((error as AiError).operation).toBe('generate');
  expect((error as AiError).kind).toBe('invalid_output');
  expect(calls).toHaveLength(2);
});

test('generateExercise surfaces provider throws as an AiError', async () => {
  const generator: ObjectGenerator = async () => {
    throw new Error('boom');
  };

  const error = await generateExercise(input, { model, generator }).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(AiError);
  expect((error as AiError).kind).toBe('provider_error');
});

test('generateExercise retries exactly once after a short provider-advised rate limit', async () => {
  let calls = 0;
  const waited: number[] = [];
  const generator: ObjectGenerator = async () => {
    calls++;
    if (calls === 1) throw rateLimitError('Too many requests', { 'retry-after': '2' });
    return { object: validObject };
  };

  const result = await generateExercise(input, {
    model,
    generator,
    sleep: async (milliseconds) => {
      waited.push(milliseconds);
    },
  });

  expect(result).toEqual(validObject);
  expect(calls).toBe(2);
  expect(waited).toEqual([2_000]);
});

test('generateExercise maps an unadvised 429 and a daily cap to distinct errors', async () => {
  const throttled: ObjectGenerator = async () => {
    throw rateLimitError('Too many requests');
  };
  const dailyCap: ObjectGenerator = async () => {
    throw rateLimitError('Daily request limit reached', { 'retry-after': '1' });
  };

  const throttledError = await generateExercise(input, { model, generator: throttled }).catch(
    (error: unknown) => error,
  );
  const dailyError = await generateExercise(input, { model, generator: dailyCap }).catch(
    (error: unknown) => error,
  );

  expect(throttledError).toMatchObject({ kind: 'rate_limited' });
  expect(dailyError).toMatchObject({ kind: 'daily_limit' });
});

test('generateExercise fails as a timeout when the call exceeds its budget', async () => {
  const generator: ObjectGenerator = () => new Promise(() => {});

  const error = await generateExercise(input, { model, generator, timeoutMs: 20 }).catch(
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(AiError);
  expect((error as AiError).kind).toBe('timeout');
});
