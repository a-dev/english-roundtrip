import { afterEach, beforeEach, expect, test } from 'bun:test';

import { TestD1 } from './test-d1';
import { createTipsRepository } from './tips';

let testD1: TestD1;

beforeEach(async () => {
  testD1 = new TestD1();
  await testD1.migrate();
});

afterEach(() => {
  testD1.close();
});

test('recordTip is idempotent on charge_id and stores the tip once', async () => {
  const tips = createTipsRepository(testD1.asD1());

  expect(await tips.recordTip({ telegramId: 42, chargeId: 'charge-1', amount: 100 })).toBe(true);
  // A redelivered successful_payment update must not double-count or re-thank.
  expect(await tips.recordTip({ telegramId: 42, chargeId: 'charge-1', amount: 100 })).toBe(false);

  const stored = await testD1
    .asD1()
    .prepare('SELECT charge_id, telegram_id, amount FROM tips ORDER BY charge_id')
    .all<{ charge_id: string; telegram_id: number; amount: number }>();

  expect(stored.results).toEqual([{ charge_id: 'charge-1', telegram_id: 42, amount: 100 }]);
});

test('recordTip keeps separate charge_ids as distinct tips', async () => {
  const tips = createTipsRepository(testD1.asD1());

  expect(await tips.recordTip({ telegramId: 7, chargeId: 'charge-a', amount: 50 })).toBe(true);
  expect(await tips.recordTip({ telegramId: 7, chargeId: 'charge-b', amount: 250 })).toBe(true);

  const count = await testD1
    .asD1()
    .prepare('SELECT COUNT(*) AS n FROM tips WHERE telegram_id = ?')
    .bind(7)
    .first<{ n: number }>();

  expect(count?.n).toBe(2);
});

test('recordTip provisions a brand-new tipper so the foreign key holds', async () => {
  const tips = createTipsRepository(testD1.asD1());

  // No prior interaction for this id — recordTip must create the users row.
  expect(await tips.recordTip({ telegramId: 999, chargeId: 'charge-x', amount: 100 })).toBe(true);

  const user = await testD1
    .asD1()
    .prepare('SELECT telegram_id FROM users WHERE telegram_id = ?')
    .bind(999)
    .first<{ telegram_id: number }>();

  expect(user?.telegram_id).toBe(999);
});
