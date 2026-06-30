# Implementation plan: tip jar (Telegram Stars) + daily sentence cap

**Status:** proposed
**Design source of truth:** [context.md](../context.md) §16–§18, §13.
**Scope:** two independent features — a gratitude-only Telegram Stars tip jar, and a
10-sentence/day cap with a manual role-based exemption. They never reference each other in
code or copy.

This plan is file-by-file and phased so each phase ends green (`bun run check`). Snippets show
shape and intent, not final code.

---

## 0. Ground rules / invariants to preserve

- **State always from D1** (per `CLAUDE.md`); nothing new in module memory.
- **Worker returns 200 on handled/unhandled errors** (`index.ts`) — don't change this; Telegram
  retries on non-2xx. Idempotency on `tips.charge_id` is what makes retries safe.
- **The per-user in-flight lease (`beginAiRequest`) already serialises generations** — the cap
  check needs no extra locking (see §2.4).
- **No new env var or secret.** `DAILY_FREE_LIMIT` is a constant; Stars reuses `BOT_TOKEN`.

---

## 1. Phase 0 — migration + test harness

### 1.1 New migration `src/data/migrations/0002_tips_and_cap.sql`

`0001_init.sql` is already published (live data exists) → **never edit it**. Add:

```sql
ALTER TABLE users ADD COLUMN role TEXT;                       -- NULL = capped; exempt set in domain/roles.ts
ALTER TABLE stats ADD COLUMN daily_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stats ADD COLUMN daily_count_date TEXT;          -- 'YYYY-MM-DD' (UTC)

CREATE TABLE IF NOT EXISTS tips (
  charge_id   TEXT PRIMARY KEY,                               -- telegram_payment_charge_id; dedupes retries
  telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
  amount      INTEGER NOT NULL,                               -- stars (XTR)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

> SQLite `ALTER TABLE ADD COLUMN` with `NOT NULL` requires a default — `daily_count` has one;
> `daily_count_date`/`role` are nullable, so no default needed.

### 1.2 Update the test harness `src/data/test-d1.ts`

`TestD1.migrate()` currently applies only `0001_init.sql`. Apply **all migrations in order** so
repo tests see the new columns/table:

```ts
async migrate(): Promise<void> {
  for (const file of ['0001_init.sql', '0002_tips_and_cap.sql']) {
    const sql = await Bun.file(new URL(`./migrations/${file}`, import.meta.url)).text();
    this.#sqlite.exec(sql);
  }
}
```

**Exit criteria:** existing `bun test` still green (new columns are additive).

---

## 2. Phase 1 — daily sentence cap

### 2.1 `src/domain/limits.ts` (new)

Keep it tiny; reset logic lives in SQL (§2.3), tested at the repo layer.

```ts
/** Free sentences per UTC day for non-exempt users (context.md §16). */
export const DAILY_FREE_LIMIT = 10;

export function isOverDailyLimit(used: number): boolean {
  return used >= DAILY_FREE_LIMIT;
}
```

### 2.2 `src/domain/roles.ts` (new)

```ts
/** Roles exempt from the daily cap (context.md §17). Set manually in D1. */
export const EXEMPT_ROLES = new Set(['premium', 'admin']);

export function isExempt(role: string | null): boolean {
  return role !== null && EXEMPT_ROLES.has(role);
}
```

### 2.3 `src/data/users.ts` — surface `role`

- Add `role: string | null` to `User` and `UserRow`.
- Add `role` to `userColumns` (`role`).
- `ensureUser` already inserts only `telegram_id`; new rows get `role = NULL` (capped) by the
  column default. No change to insert.
- Optional: `setRole(telegramId, role: string | null)` via `applyUpdate` — handy for tests and
  the refund/admin scripts; not used by the bot at runtime. (Implement `applyUpdate` to accept a
  nullable value, or add a small dedicated update.)

### 2.4 `src/data/stats.ts` — daily counter methods

Keep daily metering **out** of the user-facing `Stats` shape. Add two methods that own their UTC
`today` via the repo's existing injected `now()` (mirrors `recordResult`/`toDateKey`):

```ts
/** Effective count for today; a stale daily_count_date reads as 0. */
async getDailyCount(telegramId: number): Promise<number> {
  await ensureStats(telegramId);
  const row = await first<{ count: number }>(
    db,
    `SELECT CASE WHEN daily_count_date = ? THEN daily_count ELSE 0 END AS count
       FROM stats WHERE telegram_id = ?`,
    [toDateKey(now()), telegramId],
  );
  return row?.count ?? 0;
}

/** Self-resetting increment: new UTC day starts the count at 1. */
async incrementDailyCount(telegramId: number): Promise<void> {
  await ensureStats(telegramId);
  const today = toDateKey(now());
  await run(
    db,
    `UPDATE stats
        SET daily_count = CASE WHEN daily_count_date = ? THEN daily_count + 1 ELSE 1 END,
            daily_count_date = ?
      WHERE telegram_id = ?`,
    [today, today, telegramId],
  );
}
```

### 2.5 `src/handlers/practice.ts` — gate generation

In `startExercise`, after loading `session` + `user` and **before** `beginAiRequest`:

```ts
if (!isExempt(user.role)) {
  const used = await dependencies.data.stats.getDailyCount(id);
  if (isOverDailyLimit(used)) {
    await context.reply(COPY.dailyCapReached);
    return;
  }
}
```

Then after a **successful** generation (inside the `if (completed !== null)` block, right after
the translate reply):

```ts
await dependencies.data.stats.incrementDailyCount(id);
```

Rationale (all from §13.1):
- Increment only on `completed !== null` → counts **delivered** sentences; failed AI calls and
  lost-lease races don't count.
- Check before the lease is safe: two rapid taps both reading `used = 9` still can't both
  generate — the second loses the in-flight lease in `beginAiRequest` and is rejected as
  `in_flight`. Worst case is one extra sentence past the cap under a precise race; acceptable.
- `handleTranslation` (grading) is **untouched** — an already-shown sentence is always gradable.

### 2.6 Copy — `src/ui/copy.ts`

```ts
dailyCapReached:
  'You’ve done all 10 sentences for today — great work! 🎉 Come back after midnight UTC for more.',
```

> Keep the literal "10" in sync with `DAILY_FREE_LIMIT`, or interpolate
> `` `${DAILY_FREE_LIMIT}` `` by making this a function. Info only — **no** tip mention (§13.1).

### 2.7 Tests (Phase 1)

- `src/domain/limits.test.ts` — `isOverDailyLimit` boundary at exactly `DAILY_FREE_LIMIT`.
- `src/domain/roles.test.ts` — `isExempt` for each exempt value, `null`, unknown value.
- `src/data/users.test.ts` — `role` is read back (default `null`; round-trips via `setRole` if added).
- `src/data/stats.test.ts` — with injected `now`: increment from fresh row (→1), same-day
  increment (→2), **stale date resets to 1**, `getDailyCount` returns 0 across a day boundary.
- Practice gating: add `src/handlers/practice.test.ts` (or extend `bot.test.ts`) driving
  `startExercise` with a stubbed data layer — capped non-exempt user gets `dailyCapReached` and
  `generateExercise` is **never called**; exempt user proceeds; increment fires once on success.

---

## 3. Phase 2 — tip jar (Telegram Stars)

### 3.1 `src/data/tips.ts` (new) + wire into `src/data/index.ts`

```ts
export function createTipsRepository(db: D1Database) {
  return {
    /** Idempotent on charge_id. Returns true only on first insert (so we thank once). */
    async recordTip(input: { telegramId: number; chargeId: string; amount: number }): Promise<boolean> {
      const row = await first<{ charge_id: string }>(
        db,
        `INSERT INTO tips (charge_id, telegram_id, amount) VALUES (?, ?, ?)
         ON CONFLICT (charge_id) DO NOTHING
         RETURNING charge_id`,
        [input.chargeId, input.telegramId, input.amount],
      );
      return row !== null;
    },
    // Optional nice-to-have for a future "/stats raised" — not required for V1:
    // async totalRaised(): Promise<number> { ... SUM(amount) ... }
  };
}
export type TipsRepository = ReturnType<typeof createTipsRepository>;
```

In `data/index.ts` add `tips: createTipsRepository(config.DB)` to the returned object (no options
needed). `DataLayer` type updates automatically.

> `recordTip` calls `users.ensureUser(telegramId)` first **or** relies on the FK — a tipper has
> always issued `/tip` (which can `ensureUser`); to be safe, call `ensureUser` before insert so the
> FK never fails for a brand-new chat that paid before any other interaction.

### 3.2 Tier constants + keyboard

- `src/domain/limits.ts` is for the cap; put tip tiers in the tip handler or a small const in
  `domain/` — recommend a `TIP_TIERS = [50, 100, 250] as const` constant colocated in
  `handlers/tip.ts` (single source; cosmetic).
- `src/ui/keyboards.ts`:

```ts
export function tipKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const stars of TIP_TIERS) kb.text(`⭐ ${stars}`, `tip:${stars}`).row();
  return kb;
}
```

### 3.3 Copy — `src/ui/copy.ts`

```ts
commands: { ..., tip: 'Support the bot with Telegram Stars' },
tipPrompt: 'Tips are optional and keep the bot running — thank you! Choose an amount:',
tipThanks: (stars: number) => `Thank you for the ⭐ ${stars} tip! 💛`,
tipInvoiceTitle: 'Tip — English Roundtrip',
tipInvoiceDescription: 'A voluntary tip to support the bot. Grants no extra features.',
```

Also add a `/tip` line to the `help` array (the support contact `@a_dev` is already present):

```
'Enjoying it? Support the bot with /tip (Telegram Stars).',
```

### 3.4 `src/handlers/tip.ts` (new)

```ts
export const TIP_TIERS = [50, 100, 250] as const;

export async function handleTipCommand(ctx: Context, deps: HandlerDependencies): Promise<void> {
  // ensureUser so a payment from a fresh chat has its user row; works in ANY session state.
  const id = telegramId(ctx);
  if (id !== null) await deps.data.users.getOrCreateUser(id);
  await ctx.reply(COPY.tipPrompt, { reply_markup: tipKeyboard() });
}

/** Returns whether it consumed the callback. */
export async function handleTipCallback(ctx: Context, data: string): Promise<boolean> {
  if (!data.startsWith('tip:')) return false;
  const stars = Number(data.slice('tip:'.length));
  if (!TIP_TIERS.includes(stars as (typeof TIP_TIERS)[number])) return true; // ignore stale/bad
  // Stars: provider_token = '' and amount = star count (XTR has 0 decimals — NOT ×100).
  await ctx.replyWithInvoice(
    COPY.tipInvoiceTitle,
    COPY.tipInvoiceDescription,
    `tip:${stars}`,       // payload
    'XTR',                // currency
    [{ label: `Tip ⭐ ${stars}`, amount: stars }],
    { provider_token: '' },
  );
  return true;
}

export async function handlePreCheckout(ctx: Context): Promise<void> {
  // Nothing to validate for a fixed-tier Stars tip — approve. Must answer within 10s.
  await ctx.answerPreCheckoutQuery(true);
}

export async function handleSuccessfulPayment(ctx: Context, deps: HandlerDependencies): Promise<void> {
  const payment = ctx.message?.successful_payment;
  const id = telegramId(ctx);
  if (payment === undefined || id === null) return;
  const inserted = await deps.data.tips.recordTip({
    telegramId: id,
    chargeId: payment.telegram_payment_charge_id,
    amount: payment.total_amount, // for XTR this equals the star count
  });
  if (inserted) await ctx.reply(COPY.tipThanks(payment.total_amount));
}
```

> **Verify the grammY signature** of `replyWithInvoice` against the installed version
> (`bun pm ls | grep grammy`). Some versions take `provider_token` as a positional arg
> (`title, description, payload, provider_token, currency, prices, other?`). If so, pass `''`
> positionally and drop it from `other`. For Stars the token is the empty string regardless.

### 3.5 `src/bot.ts` wiring

1. `BOT_COMMANDS`: add `{ command: 'tip', description: COPY.commands.tip }` (kept before `help`).
2. Register the command: `bot.command('tip', (ctx) => handleTipCommand(ctx, dependencies));`
3. Tip callback in the `callback_query:data` chain — add **before** the stats fallthrough:
   `if (await handleTipCallback(context, data)) return;`
4. **Payment updates** — order matters relative to the generic `message` fallback:
   ```ts
   bot.on('pre_checkout_query', handlePreCheckout);
   bot.on('message:successful_payment', (ctx) => handleSuccessfulPayment(ctx, dependencies));
   // ...existing:
   bot.on('message:text', ...);
   bot.on('message', createFallbackHandler(dependencies));
   ```
   `successful_payment` is a service `message` (no text), so `message:text` won't catch it but the
   generic `message` fallback would nudge "send a translation" — register the payment handler
   first. `pre_checkout_query` is its own update type; place it with the other `bot.on`s.

> The `index.ts` webhook already forwards every update type to the bot; no changes there.
> `pre_checkout_query` must be answered within 10s — well within the webhook budget
> (`DEFAULT_AI_TIMEOUT_MS + 5s`), and it makes no AI/D1-heavy calls.

### 3.6 Tests (Phase 2)

- `src/data/tips.test.ts` — `recordTip` returns `true` first time, `false` on duplicate
  `charge_id`; row stored with correct `telegram_id`/`amount` (uses updated `TestD1`).
- `src/ui/keyboards.test.ts` — `tipKeyboard` emits one `tip:<stars>` button per tier.
- `src/bot.test.ts` — craft `Update`s:
  - callback `tip:100` → `replyWithInvoice` called with `currency: 'XTR'`, amount 100;
  - `pre_checkout_query` → `answerPreCheckoutQuery(true)`;
  - `message.successful_payment` → `recordTip` called + thank-you sent; a duplicate delivery sends
    no second thank-you.
  - a `successful_payment` update does **not** trigger the translation/fallback path.
- (Telegram payment APIs are mocked, consistent with §10 testing policy.)

---

## 4. Phase 3 — refund script

`scripts/refund.ts` (mirrors existing `scripts/*.ts` — run with `bun run scripts/refund.ts ...`):

```ts
// Usage: BOT_TOKEN=... bun run scripts/refund.ts <telegram_id> <charge_id>
// Find <charge_id> via: wrangler d1 execute english-roundtrip \
//   --command "SELECT charge_id, telegram_id, amount, created_at FROM tips WHERE telegram_id = <id>"
```

- Read `BOT_TOKEN` from `process.env` (loaded from `.dev.vars` or shell).
- Call `refundStarPayment` — either via a one-off grammY `Bot(token).api.refundStarPayment(userId, chargeId)`
  or a raw `fetch` to `https://api.telegram.org/bot<token>/refundStarPayment`.
- Print the API response; exit non-zero on failure.

No in-bot admin command, no new privileged webhook path (§13.2). Refunds are rare and manual.

---

## 5. Phase 4 — help text (support contact)

✅ **Already done** in this session: the `<b>Support</b>` block with `@a_dev` is added to
`COPY.help` in `src/ui/copy.ts`. Phase 2 (§3.3) adds the `/tip` line to the same `help` array.

---

## 6. Rollout

1. `bun run check` green locally.
2. Apply the migration to D1:
   - Local: `wrangler d1 execute english-roundtrip --local --file src/data/migrations/0002_tips_and_cap.sql`
   - **Remote (prod):** `wrangler d1 execute english-roundtrip --remote --file src/data/migrations/0002_tips_and_cap.sql`
3. `wrangler deploy`.
4. `setMyCommands` re-runs automatically on first request after deploy (`index.ts` →
   `registerBotCommands`), so `/tip` appears in the menu.
5. Smoke test in Telegram:
   - `/tip` → pick a tier → pay with Stars (test account) → thank-you appears; `tips` row exists.
   - Generate 10 sentences → 11th is refused with `dailyCapReached`; grading the 10th still works.
   - Set your own `users.role = 'premium'` in D1 → cap no longer applies.
6. Verify a refund end-to-end once with `scripts/refund.ts`.

---

## 7. Edge cases & risks

- **Cap race:** at most one extra sentence past the cap under a precise concurrent tap (check is
  pre-lease). Accepted — cost is one Gemini call; tightening would need the count folded into the
  `beginAiRequest` UPDATE.
- **`provider_token` / amount units for XTR:** the two classic Stars mistakes — token must be the
  empty string, and `amount` is the raw star count (no ×100). Both are called out in §3.4.
- **Idempotency:** relies on `tips.charge_id` PK + `recordTip` returning `inserted`. If the
  thank-you `reply` fails after a successful insert, no retry re-thanks (insert is now a dup) —
  acceptable; the payment is still recorded.
- **`pre_checkout_query` failure:** if the handler throws before answering, Telegram fails the
  charge and the user simply retries — no money moves. The global middleware still returns 200.
- **Migration ordering in tests:** `TestD1.migrate()` must run `0001` then `0002`; forgetting this
  breaks every repo test (missing columns). Covered in §1.2.
- **Schema drift doc:** keep `context.md` §3 and this migration in lockstep; §3 already shows the
  target shape.

---

## 8. File change summary

**New**
- `src/data/migrations/0002_tips_and_cap.sql`
- `src/domain/limits.ts`, `src/domain/roles.ts`
- `src/data/tips.ts`
- `src/handlers/tip.ts`
- `scripts/refund.ts`
- Tests: `src/domain/limits.test.ts`, `src/domain/roles.test.ts`, `src/data/tips.test.ts`,
  `src/handlers/practice.test.ts` (or extend `bot.test.ts`)

**Modified**
- `src/data/test-d1.ts` (apply both migrations)
- `src/data/users.ts` (`role` column surfaced; optional `setRole`)
- `src/data/stats.ts` (`getDailyCount`, `incrementDailyCount`)
- `src/data/index.ts` (`tips` repo)
- `src/handlers/practice.ts` (cap gate + increment)
- `src/ui/copy.ts` (`dailyCapReached`, tip copy, `/tip` help line; **support contact already added**)
- `src/ui/keyboards.ts` (`tipKeyboard`)
- `src/bot.ts` (`/tip` command, tip callback, `pre_checkout_query` + `successful_payment` handlers)
- Tests: `src/data/users.test.ts`, `src/data/stats.test.ts`, `src/ui/keyboards.test.ts`,
  `src/bot.test.ts`
```
