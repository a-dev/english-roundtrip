import { afterEach, beforeEach, expect, test } from 'bun:test';
import { BOT_COMMANDS, createBot } from './bot';
import { AiError } from './ai/errors';
import type { HandlerDependencies } from './handlers/types';
import { CEFR } from './domain/levels';
import { SessionState } from './domain/state';
import { createDataLayer } from './data';
import { TestD1 } from './data/test-d1';

let database: TestD1;

beforeEach(async () => {
  database = new TestD1();
  await database.migrate();
});

afterEach(() => {
  database.close();
});

const learner = { id: 123, is_bot: false, first_name: 'Andrei', language_code: 'es' };
const chat = { id: 456, type: 'private' as const };

function messageUpdate(updateId: number, text: string, command = false) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat,
      from: learner,
      text,
      ...(command ? { entities: [{ offset: 0, length: text.length, type: 'bot_command' }] } : {}),
    },
  } as never;
}

function callbackUpdate(updateId: number, data: string) {
  return {
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      from: learner,
      chat_instance: 'test-chat',
      data,
      message: { message_id: updateId, date: 0, chat, from: learner, text: 'menu' },
    },
  } as never;
}

function preCheckoutUpdate(updateId: number, stars: number) {
  return {
    update_id: updateId,
    pre_checkout_query: {
      id: `pcq-${updateId}`,
      from: learner,
      currency: 'XTR',
      total_amount: stars,
      invoice_payload: `tip:${stars}`,
    },
  } as never;
}

function successfulPaymentUpdate(updateId: number, stars: number, chargeId: string) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat,
      from: learner,
      successful_payment: {
        currency: 'XTR',
        total_amount: stars,
        invoice_payload: `tip:${stars}`,
        telegram_payment_charge_id: chargeId,
        provider_payment_charge_id: '',
      },
    },
  } as never;
}

function nonTextUpdate(updateId: number) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat,
      from: learner,
      sticker: {
        file_id: 'sticker',
        file_unique_id: 'unique',
        type: 'regular',
        width: 1,
        height: 1,
        is_animated: false,
        is_video: false,
      },
    },
  } as never;
}

async function createFixture() {
  const data = createDataLayer({ DB: database.asD1(), ANTI_REPEAT_WINDOW: 10 });
  const generated = [
    {
      sourceSentence: 'Ya he terminado el trabajo.',
      referenceTranslation: 'I have already finished work.',
      targetPoints: ['present perfect'],
    },
    {
      sourceSentence: 'Ella está preparando la cena ahora.',
      referenceTranslation: 'She is cooking dinner now.',
      targetPoints: ['present continuous'],
    },
  ];
  const calls: {
    generated: unknown[];
    graded: unknown[];
    telegram: Array<{ method: string; payload: Record<string, unknown> }>;
  } = {
    generated: [],
    graded: [],
    telegram: [],
  };
  const dependencies: HandlerDependencies = {
    data,
    cooldownSeconds: 0,
    async generateExercise(input) {
      calls.generated.push(input);
      return generated[calls.generated.length - 1] ?? generated[0]!;
    },
    async gradeTranslation(input) {
      calls.graded.push(input);
      return {
        verdict: 'almost',
        correctedTranslation: 'I have already finished work.',
        issues: [
          {
            fragment: 'I already finished',
            category: 'tense',
            explanation: 'Use the present perfect here.',
          },
        ],
        encouragement: 'Good attempt!',
      };
    },
  };
  const bot = createBot('test-token', dependencies);
  bot.botInfo = {
    id: 999,
    is_bot: true,
    first_name: 'English Roundtrip',
    username: 'english_roundtrip_test',
  } as never;
  bot.api.config.use(async (_previous, method, payload) => {
    calls.telegram.push({ method, payload: payload as Record<string, unknown> });
    const text = (payload as { text?: string }).text;
    return {
      ok: true,
      result: method === 'sendMessage' ? { message_id: 1, date: 0, chat, text } : true,
    } as never;
  });
  return { bot, calls, data, dependencies };
}

test('a user can complete the menu → exercise → answer → feedback → next loop', async () => {
  const { bot, calls, data } = await createFixture();

  await bot.handleUpdate(messageUpdate(1, '/start', true));
  expect((await data.sessions.getSession(learner.id)).state).toBe(
    SessionState.ChoosingTaskLanguage,
  );
  const onboarding = calls.telegram.find((call) => call.method === 'sendMessage')?.payload;
  expect(onboarding?.text).toBe(
    'Choose the language you want to translate from. English is always the target.',
  );
  expect(onboarding?.reply_markup).toMatchObject({
    inline_keyboard: expect.arrayContaining([
      expect.arrayContaining([{ text: '✓ Spanish / Español', callback_data: 'onb:task:es' }]),
    ]),
  });

  await bot.handleUpdate(callbackUpdate(2, 'onb:task:es'));
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.ChoosingCategory);
  expect(await data.users.getOrCreateUser(learner.id)).toMatchObject({ taskLanguage: 'es' });
  const welcome = calls.telegram.at(-1)?.payload.text;
  expect(welcome).toContain('Task language set to <b>Spanish</b>.');
  expect(welcome).not.toContain('Ukrainian');

  await bot.handleUpdate(callbackUpdate(3, 'cat:grammar'));
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.ChoosingTopic);
  expect(calls.telegram.some((call) => call.method === 'answerCallbackQuery')).toBe(true);

  await bot.handleUpdate(callbackUpdate(4, 'topic:present-perfect'));
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.AwaitingAnswer);
  expect(calls.generated).toHaveLength(1);
  expect(calls.generated[0]).toMatchObject({ taskLanguage: 'es' });
  expect(calls.telegram.at(-1)?.payload.text).toContain('Translate from Spanish');

  await bot.handleUpdate(messageUpdate(5, 'I already finished work.'));
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.FeedbackShown);
  expect((await data.stats.getStats(learner.id)).totalExercises).toBe(1);
  expect(calls.graded).toHaveLength(1);
  expect(calls.graded[0]).toMatchObject({ taskLanguage: 'es', feedbackMode: 'english' });
  expect(calls.telegram.at(-1)?.payload).toMatchObject({ parse_mode: 'HTML' });

  await bot.handleUpdate(callbackUpdate(6, 'act:next'));
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.AwaitingAnswer);
  expect(calls.generated).toHaveLength(2);
});

test('a returning user with a task language skips onboarding on start', async () => {
  const { bot, calls, data } = await createFixture();
  await data.users.setTaskLanguage(learner.id, 'fr');

  await bot.handleUpdate(messageUpdate(1, '/start', true));

  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.ChoosingCategory);
  expect(calls.telegram.at(-1)?.payload.text).toContain(
    'Welcome to English Roundtrip! Pick a focus, translate one sentence into English, and get clear feedback.',
  );
  expect(calls.telegram.at(-1)?.payload.text).not.toContain('Choose the language');
});

test('settings commands route a first-run user into onboarding instead', async () => {
  const { bot, calls, data } = await createFixture();

  for (const command of ['/settings', '/language', '/level'] as const) {
    calls.telegram.length = 0;
    await bot.handleUpdate(messageUpdate(1, command, true));
    expect(calls.telegram.at(-1)?.payload.text).toBe(
      'Choose the language you want to translate from. English is always the target.',
    );
    expect((await data.sessions.getSession(learner.id)).state).toBe(
      SessionState.ChoosingTaskLanguage,
    );
    expect(await data.users.getOrCreateUser(learner.id)).toMatchObject({ taskLanguage: null });
  }
});

test('settings persist for the next grade and stats and fallback routes remain usable', async () => {
  const { bot, calls, data } = await createFixture();

  await data.users.setTaskLanguage(learner.id, 'fr');
  await bot.handleUpdate(callbackUpdate(1, 'set:feedback:source'));
  await bot.handleUpdate(callbackUpdate(2, 'set:level:C1'));
  await bot.handleUpdate(callbackUpdate(3, 'set:task:ja'));
  expect(await data.users.getOrCreateUser(learner.id)).toMatchObject({
    taskLanguage: 'ja',
    feedbackMode: 'source',
    level: CEFR.C1,
  });

  await bot.handleUpdate(callbackUpdate(4, 'cat:grammar'));
  await bot.handleUpdate(callbackUpdate(5, 'topic:present-perfect'));
  expect(calls.generated[0]).toMatchObject({ taskLanguage: 'ja', level: CEFR.C1 });
  await bot.handleUpdate(messageUpdate(6, 'I already finished work.'));
  expect(calls.graded[0]).toMatchObject({
    taskLanguage: 'ja',
    feedbackMode: 'source',
    level: CEFR.C1,
  });

  await bot.handleUpdate(callbackUpdate(7, 'act:settings'));
  await bot.handleUpdate(callbackUpdate(8, 'cfg:feedback'));
  expect(calls.telegram.at(-1)?.payload.text).toBe('Choose the language for explanations.');
  await bot.handleUpdate(callbackUpdate(9, 'cfg:back'));
  expect(calls.telegram.at(-1)?.payload.text).toContain('<b>Settings</b>');
  await bot.handleUpdate(callbackUpdate(10, 'nav:back'));
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.FeedbackShown);

  await bot.handleUpdate(callbackUpdate(11, 'nav:stats'));
  expect(calls.telegram.at(-1)?.payload.text).toContain('Your progress');

  await bot.handleUpdate(callbackUpdate(12, 'topic:present-perfect'));
  await bot.handleUpdate(nonTextUpdate(13));
  expect(calls.telegram.at(-1)?.payload.text).toBe(
    'Please send your translation as a text message.',
  );

  await bot.handleUpdate(messageUpdate(14, '/unknown', true));
  expect(calls.telegram.at(-1)?.payload.text).toBe(
    'I don’t know that command. Try /practice or /help.',
  );
});

test('help and cancel commands are registered and leave the session idle', async () => {
  const { bot, calls, data } = await createFixture();

  expect(BOT_COMMANDS.map((command) => command.command)).toEqual([
    'start',
    'practice',
    'topics',
    'settings',
    'language',
    'level',
    'stats',
    'tip',
    'help',
    'cancel',
  ]);

  await bot.handleUpdate(messageUpdate(1, '/help', true));
  expect(calls.telegram.at(-1)?.payload.text).toContain(
    'Free-tier Gemini prompts may be used by Google for training',
  );

  await data.users.setTaskLanguage(learner.id, 'fr');

  await bot.handleUpdate(messageUpdate(2, '/language', true));
  expect(calls.telegram.at(-1)?.payload.text).toBe('Choose your task language.');

  await bot.handleUpdate(messageUpdate(3, '/level', true));
  expect(calls.telegram.at(-1)?.payload.text).toBe('Choose your CEFR level.');

  await data.sessions.startExercise(learner.id, 'present-perfect', 'Я работал.', 'I worked.', [
    'past',
  ]);
  await bot.handleUpdate(messageUpdate(4, '/cancel', true));
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.Idle);
});

test('empty and oversized answers are kept out of the grading prompt', async () => {
  const { bot, calls, data } = await createFixture();
  await data.sessions.startExercise(learner.id, 'present-perfect', 'Я работал.', 'I worked.', [
    'past',
  ]);

  await bot.handleUpdate(messageUpdate(1, ' \n\t '));
  expect(calls.telegram.at(-1)?.payload.text).toBe('Please send a non-empty translation.');

  await bot.handleUpdate(messageUpdate(2, 'a'.repeat(1_001)));
  expect(calls.telegram.at(-1)?.payload.text).toBe(
    'Please keep your translation under 1,000 characters.',
  );
  expect(calls.graded).toHaveLength(0);
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.AwaitingAnswer);
});

test('a redelivered answer does not grade or count the exercise twice', async () => {
  const { bot, calls, data } = await createFixture();
  await data.sessions.startExercise(learner.id, 'present-perfect', 'Я работал.', 'I worked.', [
    'past',
  ]);
  const duplicate = messageUpdate(1, 'I worked.');

  await bot.handleUpdate(duplicate);
  await bot.handleUpdate(duplicate);

  expect(calls.graded).toHaveLength(1);
  expect((await data.stats.getStats(learner.id)).totalExercises).toBe(1);
});

test('AI failures leave the session retryable and explain rate limits clearly', async () => {
  const { bot, calls, data, dependencies } = await createFixture();
  await data.sessions.startExercise(learner.id, 'present-perfect', 'Я работал.', 'I worked.', [
    'past',
  ]);
  dependencies.gradeTranslation = async () => {
    throw new AiError('grade', 'rate_limited', 'simulated 429');
  };

  await bot.handleUpdate(messageUpdate(1, 'I worked.'));
  expect(calls.telegram.at(-1)?.payload.text).toBe(
    '⏳ I’m a bit busy right now — try again in a few seconds.',
  );
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.AwaitingAnswer);

  dependencies.gradeTranslation = async () => {
    throw new AiError('grade', 'daily_limit', 'simulated daily cap');
  };
  await bot.handleUpdate(messageUpdate(2, 'I worked.'));

  expect(calls.telegram.at(-1)?.payload.text).toBe(
    '⏳ Today’s AI limit has been reached. Please try again later.',
  );
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.AwaitingAnswer);

  dependencies.gradeTranslation = async () => {
    throw new AiError('grade', 'timeout', 'simulated timeout');
  };
  await bot.handleUpdate(messageUpdate(3, 'I worked.'));

  expect(calls.telegram.at(-1)?.payload.text).toBe(
    'Sorry, that took too long. Please try again in a moment.',
  );
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.AwaitingAnswer);
});

test('the /tip command offers the tip tiers without touching the practice session', async () => {
  const { bot, calls, data } = await createFixture();

  await bot.handleUpdate(messageUpdate(1, '/tip', true));

  const prompt = calls.telegram.at(-1)?.payload;
  expect(prompt?.text).toBe(
    'Tips are optional and keep the bot running — thank you! Choose an amount:',
  );
  expect(prompt?.reply_markup).toMatchObject({
    inline_keyboard: expect.arrayContaining([
      expect.arrayContaining([{ text: '⭐ 100', callback_data: 'tip:100' }]),
    ]),
  });
  // Tipping is state-agnostic: it must not advance or create a practice session.
  expect((await data.sessions.getSession(learner.id)).state).toBe(SessionState.Idle);
});

test('a tip tier callback sends an XTR Stars invoice for that amount', async () => {
  const { bot, calls } = await createFixture();

  await bot.handleUpdate(callbackUpdate(1, 'tip:100'));

  const invoice = calls.telegram.find((call) => call.method === 'sendInvoice')?.payload;
  expect(invoice).toMatchObject({
    currency: 'XTR',
    payload: 'tip:100',
    provider_token: '',
    prices: [{ label: 'Tip ⭐ 100', amount: 100 }],
  });
});

test('a tampered tip amount is ignored without sending an invoice', async () => {
  const { bot, calls } = await createFixture();

  await bot.handleUpdate(callbackUpdate(1, 'tip:9999'));

  expect(calls.telegram.some((call) => call.method === 'sendInvoice')).toBe(false);
});

test('the Stars payment flow approves checkout, records the tip, and thanks once', async () => {
  const { bot, calls } = await createFixture();
  const replyText = (call: { payload: Record<string, unknown> }): string =>
    typeof call.payload.text === 'string' ? call.payload.text : '';

  await bot.handleUpdate(preCheckoutUpdate(1, 100));
  expect(calls.telegram.at(-1)).toMatchObject({
    method: 'answerPreCheckoutQuery',
    payload: { ok: true },
  });

  await bot.handleUpdate(successfulPaymentUpdate(2, 100, 'charge-1'));
  expect(calls.telegram.at(-1)?.payload.text).toBe('Thank you for the ⭐ 100 tip! 💛');

  const stored = await database
    .asD1()
    .prepare('SELECT telegram_id, amount FROM tips WHERE charge_id = ?')
    .bind('charge-1')
    .first<{ telegram_id: number; amount: number }>();
  expect(stored).toEqual({ telegram_id: learner.id, amount: 100 });

  // A redelivered payment update is a service message — it neither re-thanks nor
  // falls through to the translation/fallback path.
  const thanksBefore = calls.telegram.filter((call) => replyText(call).startsWith('Thank you'));
  await bot.handleUpdate(successfulPaymentUpdate(3, 100, 'charge-1'));
  const thanksAfter = calls.telegram.filter((call) => replyText(call).startsWith('Thank you'));
  expect(thanksAfter).toHaveLength(thanksBefore.length);
  expect(calls.graded).toHaveLength(0);
  expect(
    calls.telegram.some((call) => replyText(call).includes('Please send your translation')),
  ).toBe(false);
});

test('the top-level bot boundary sends an apology for an unexpected handler error', async () => {
  const { bot, calls } = await createFixture();
  bot.api.config.use(async (previous, method, payload, signal) => {
    if (method === 'answerCallbackQuery') throw new Error('simulated callback failure');
    return previous(method, payload, signal);
  });

  await bot.handleUpdate(callbackUpdate(1, 'cat:grammar'));

  expect(calls.telegram.at(-1)?.payload.text).toBe(
    'Sorry, something went wrong. Please try again in a moment.',
  );
});
