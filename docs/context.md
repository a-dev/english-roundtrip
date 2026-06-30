# English Roundtrip — Engineering Context & Architecture

This document is the technical source of truth: the stack, why each piece was chosen, the data model, the AI layer, and the runtime behavior. It assumes the product decisions in [prd.md](./prd.md).

---

## 1. Decision log (ADR-style)

| #   | Decision           | Choice                                                     | Rationale                                                                                                                                    |
| --- | ------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Production runtime | **Cloudflare Workers** (webhook)                           | Free tier (100k req/day); LLM latency is I/O wait, not CPU, so the CPU-time cap doesn't bite; HTTPS webhook out of the box. Bun is dev-only. |
| 2   | Dev tooling        | **Bun** (install/test/scripts) + **Wrangler** (dev/deploy) | Honors repo convention for the dev loop; Wrangler handles Workers build & deploy.                                                            |
| 3   | Bot framework      | **grammY** + `webhookCallback(bot, "cloudflare-mod")`      | TypeScript-first, official Workers adapter, inline keyboards, `setMyCommands`.                                                               |
| 4   | AI client          | **Vercel AI SDK** (`ai`) + `@ai-sdk/google`                | Mature, edge-compatible, `generateObject` + Zod is exactly our structured generate/grade need. Provider-swappable.                           |
| 5   | Content model      | **Runtime AI generation**                                  | Topics are English-skill definitions; Gemini writes each source sentence in the user's task language. Max variety, near-zero authoring. Cost: 2 AI calls/round. |
| 6   | Model              | **Configurable** via `GEMINI_MODEL` (provider-swappable)  | Not pinned here — we're still experimenting. Current model + rationale: [docs/model.md](./model.md). Swapping providers is local to `ai/client.ts` (§5). |
| 7   | Storage            | **D1 (SQLite)**, single store                              | Bot writes state nearly every message; D1 free tier allows ~100k writes/day vs KV's ~1,000. Real SQL for profile + session + stats.          |
| 8   | UI language        | **English only**                                           | Simpler; no i18n menu system. Independent of task/feedback language.                                                                         |
| 9   | Target language    | **Always English**                                         | The bot trains English only; the topic catalog is English grammar/vocab. Reverse direction is V2.                                            |
| 10  | Task (source) language | **Curated 12, per-user**; default seeded from Telegram `language_code` | Catalog in `domain/languages.ts`; first-run picker confirms the guess. |
| 11  | Feedback language  | **Mode `english`\|`source`** (default `english`)          | The only meaningful choices are immersive (English) or native (the task language). A mode auto-follows the task language — no stale value. Corrected sentence/alternatives always English. |
| 12  | Difficulty         | **CEFR A2/B1/B2/C1** (default B1)                          | Calibrates generation complexity and grading strictness (of the English target).                                                            |
| 13  | Feedback shape     | **Rich structured** (Zod)                                  | Consistent rendering, localizable, enables weak-spot analytics.                                                                             |
| 14  | Catalog            | **Curated: 9 grammar + 6 vocab** (English skills)         | Core → advanced grammar; fast to ship; trivially extensible; task-language-independent.                                                     |
| 15  | Rate limiting      | **Graceful 429 + per-user cooldown**                       | Protects shared Gemini quota; good UX under limits.                                                                                         |
| 16  | Daily usage cap    | **10 sentences/day**, counted per *delivered* sentence at generation; resets **midnight UTC** | Per-user complement to the §6 cooldown, protecting the shared Gemini quota. Grading is never gated, so an in-flight round always finishes. `DAILY_FREE_LIMIT` is a hardcoded constant (`domain/limits.ts`). Counter lives on `stats` (§3). |
| 17  | Cap exemption      | **`users.role`** (TEXT, `NULL` = capped); exempt set `{'premium','admin'}`, set **manually in D1** | Lifts the cap for supporters/myself with a manual DB edit — no deploy. A *defined* set (not "any non-null") leaves room for future non-exempt roles; the set is a constant in `domain/roles.ts`. |
| 18  | Tipping            | **Telegram Stars (`XTR`)**, preset tiers, **gratitude-only** | The only in-Telegram payment rail. Tips grant **no** functional benefit and are fully **decoupled** from the cap exemption (§17) — deliberately *not* a paywall. Recorded in a `tips` ledger (§3); refunds via an out-of-band script (§13). |

---

## 2. Runtime topology

```
Telegram  ──HTTPS POST (Update)──▶  Cloudflare Worker (src/index.ts)
                                      │  1. validate X-Telegram-Bot-Api-Secret-Token
                                      │  2. grammY webhookCallback → middleware
                                      ▼
                              Handlers (commands / callbacks / messages)
                                      │
                        ┌─────────────┴─────────────┐
                        ▼                           ▼
                   D1 (SQLite)                 Gemini (Vercel AI SDK)
              users · sessions · stats     generate sentence / grade answer
                        │                           │
                        └─────────────┬─────────────┘
                                      ▼
                              bot.api.sendMessage (reply + inline keyboard)
```

- **Webhook, not long-polling** — mandatory on Workers (no long-running process).
- **Stateless compute** — every request reconstructs state from D1; nothing is kept in module memory between requests.
- Local dev uses `wrangler dev` (+ local D1) and a tunnel or `setWebhook` to a temporary URL, or grammY's polling shim for handler-level testing.

---

## 3. Data model (D1)

`src/data/migrations/0001_init.sql` (fresh `english-roundtrip` database — no legacy data to migrate, so the initial schema is written directly in its final shape):

```sql
CREATE TABLE IF NOT EXISTS users (
  telegram_id    INTEGER PRIMARY KEY,
  task_language  TEXT,                          -- NULL until first-run onboarding; then 'ru'|'uk'|'es'|... (see domain/languages.ts)
  feedback_mode  TEXT NOT NULL DEFAULT 'english', -- 'english' | 'source'
  level          TEXT NOT NULL DEFAULT 'B1',     -- 'A2' | 'B1' | 'B2' | 'C1'
  role           TEXT,                            -- NULL = capped; exempt set {'premium','admin'} (domain/roles.ts), set manually in D1
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One in-flight exercise per user. Overwritten each round.
CREATE TABLE IF NOT EXISTS sessions (
  telegram_id          INTEGER PRIMARY KEY REFERENCES users(telegram_id),
  state                TEXT NOT NULL DEFAULT 'idle',  -- see §4
  topic_id             TEXT,
  source_sentence      TEXT,                           -- the ONE sentence to translate, in the user's task language
  reference_translation TEXT,                          -- hidden English reference, from generation
  target_points        TEXT,                           -- JSON string[]
  recent_sentences     TEXT,                           -- JSON string[] (anti-repeat, capped)
  last_request_at      TEXT,                           -- for per-user cooldown
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stats (
  telegram_id     INTEGER PRIMARY KEY REFERENCES users(telegram_id),
  total_exercises INTEGER NOT NULL DEFAULT 0,
  total_correct   INTEGER NOT NULL DEFAULT 0,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,
  daily_count      INTEGER NOT NULL DEFAULT 0,    -- sentences delivered on daily_count_date (§16)
  daily_count_date TEXT                           -- 'YYYY-MM-DD' (UTC); when != today, daily_count is treated as 0
);

-- Per-category error tallies → "weak spots". Categories describe the English target.
CREATE TABLE IF NOT EXISTS error_stats (
  telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
  category    TEXT NOT NULL,                            -- 'tense' | 'article' | ...
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (telegram_id, category)
);

-- Tip ledger (Telegram Stars). One row per successful payment (§13).
CREATE TABLE IF NOT EXISTS tips (
  charge_id   TEXT PRIMARY KEY,                          -- telegram_payment_charge_id; dedupes retried successful_payment updates
  telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
  amount      INTEGER NOT NULL,                          -- stars (XTR), the invoice total
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

> **Migration note:** the schema above is the *target* shape. Because V1 is already published
> (live data exists), the §16–§18 additions (`users.role`, `stats.daily_count` /
> `daily_count_date`, the `tips` table) land in a new **`0002_tips_and_cap.sql`**
> (`ALTER TABLE … ADD COLUMN` + `CREATE TABLE tips`), **not** by editing `0001_init.sql`.

Notes:
- `task_language` is **nullable on purpose**: `NULL` means "never onboarded," which routes the user to the first-run task-language picker (§4). `ensureUser` inserts only `telegram_id`, so new rows get `task_language = NULL`, `feedback_mode = 'english'`, `level = 'B1'`, `role = NULL`.
- `role` is **nullable on purpose**: `NULL` (the default for every new row) means "capped." Exemption is granted by setting `role` to a value in the exempt set (`domain/roles.ts`), done **manually in D1** — there is no in-app path to assign a role.
- `daily_count` is read+checked at generation and is **self-resetting via the write**: the increment is `daily_count = CASE WHEN daily_count_date = :today THEN daily_count + 1 ELSE 1 END, daily_count_date = :today`, so a new UTC day needs no cron. The check treats a stale `daily_count_date` as count 0.
- `tips.charge_id` is the **primary key** so a redelivered `successful_payment` (Telegram retries on non-2xx) is an idempotent no-op rather than a double thank-you / double row.
- `users` + `stats` are written rarely; `sessions` is written ~2×/round; `tips` is written only on payment. All comfortably within D1 free limits.
- `recent_sentences` is capped (e.g., last 10) to keep the anti-repeat prompt short.
- No raw exercise history in V1 (deferred to V2 spaced-repetition).

---

## 4. Session state machine

```
[new user: task_language IS NULL]
  └─(/start)──▶ choosing_task_language ──(pick language → persist)──▶ idle (+ main menu)

idle
  └─(/practice or 📚/🗣)──▶ choosing_category
                              └─(pick category)──▶ choosing_topic
                                                     └─(pick topic)──▶ [generate] ──▶ awaiting_answer
awaiting_answer
  ├─(text message)──▶ [grade] ──▶ feedback_shown
  ├─(non-text)──────▶ awaiting_answer (polite nudge)
  └─(/cancel)───────▶ idle
feedback_shown
  ├─(➡️ Next)───────▶ [generate] ──▶ awaiting_answer
  ├─(🔀 Change topic)▶ choosing_category
  └─(⚙️ Settings)───▶ settings (overlay; returns to feedback_shown)
```

State lives in `sessions.state`. The **`choosing_task_language`** state is the first-run onboarding gate: it is entered only when a user with `task_language IS NULL` issues `/start`, and exited once a language is chosen. Generation and grading are the two AI touchpoints; each is one Gemini call on a separate webhook request.

---

## 5. AI layer

Library: `ai` + `@ai-sdk/google`. Both operations use `generateObject` with a Zod schema (validated output, retried on parse failure). The **task language** (resolved from `users.task_language` via `domain/languages.ts`) is threaded into both prompts; the **feedback language** for grading is resolved from `feedback_mode` (`english` → English, `source` → the task language).

### 5.1 Config
- `GEMINI_MODEL` (var) — current model and rationale in [docs/model.md](./model.md).
- `GEMINI_API_KEY` (secret).
- `temperature`: generation ≈ 0.9 (variety), grading ≈ 0.2 (consistency).
- Hard timeout per call (e.g., 20s); on timeout → graceful failure (see §6).

### 5.2 Generation — `ai/generate.ts`
**Inputs:** topic `generationHint`, **task language**, CEFR `level`, `recentSentences` (anti-repeat), safety rules.
**Output schema:**
```ts
const GenerationSchema = z.object({
  sourceSentence: z.string(),        // the ONE sentence to translate, in the task language
  referenceTranslation: z.string(),  // natural English, hidden from user, stored for grading
  targetPoints: z.array(z.string()), // what this sentence is testing, e.g. ["present perfect", "for/since"]
});
```
**Prompt shape (system):** role parameterized by task language ("an expert teacher of *{task language}* who writes translation exercises for English learners") + strict rules (exactly one sentence; write it in the task language using its **native script and native punctuation**; match CEFR level; stay on the topic's English grammar/vocab focus; non-sensitive; avoid the listed recent sentences). **User:** the topic hint + task language + level + recent list.

**One-sentence guarantee across scripts.** The "exactly one sentence" rule is enforced *structurally* in `schemas.ts`, not by trusting the prompt. The terminator set must cover every task language, so it includes Latin/Cyrillic **and** CJK and Arabic terminators:

```ts
// counts sentence-like segments; must recognize every task language's terminators
text.split(/[.!?…。！？؟]+/).map(s => s.trim()).filter(Boolean).length === 1
```

`。！？` cover Chinese/Japanese; `؟` covers Arabic questions (Arabic statements typically use a Latin `.`). Without these, a two-sentence CJK output would split into *one* segment and slip past validation. (Arabic is right-to-left; rendering `«…»` + emoji around RTL text can look slightly scrambled in some clients — a known minor-polish item, not a validation concern.)

### 5.3 Grading — `ai/grade.ts`
**Inputs:** `sourceSentence`, `userTranslation`, `topic`, `level`, `referenceTranslation`, `targetPoints`, **`feedbackLanguage`** (resolved from `feedback_mode`).
**Output schema:**
```ts
const ErrorCategory = z.enum([
  "tense","aspect","article","preposition","word-order",
  "agreement","vocabulary","spelling","punctuation","other",
]);
const GradingSchema = z.object({
  verdict: z.enum(["correct","almost","needs_work"]),
  correctedTranslation: z.string(),               // always English
  issues: z.array(z.object({
    fragment: z.string(),                          // the user's problematic span
    category: ErrorCategory,                       // describes the English error
    explanation: z.string(),                       // in feedbackLanguage
  })),
  alternative: z.string().optional(),              // more idiomatic phrasing (English)
  encouragement: z.string(),                        // in feedbackLanguage
});
```
**Prompt shape (system):** supportive English coach; the learner was shown a *{task language}* sentence and translated it into English; explain in `feedbackLanguage`; corrected sentence + alternatives in English; categorize each issue; be encouraging; don't invent errors when the translation is acceptable (`verdict = correct`, empty `issues`). The error categories describe the **English** output, so they are unchanged regardless of task language.

`verdict !== "correct"` does **not** require non-empty issues necessarily, but `correct` implies `issues` is empty. The formatter and stats logic rely on this.

### 5.4 Failure handling
- Zod parse failure → one retry, then a friendly error message and state stays usable.
- Safety: if the model returns something off-policy, regenerate once; the constrained prompt makes this rare.

---

## 6. Rate limiting & resilience (`ratelimit/cooldown.ts`)

- **Per-user cooldown** — at most one in-flight exercise per user, plus a small minimum gap (e.g., 3s) between AI-triggering actions. Enforced via `sessions.last_request_at` and `state`.
- **429 / quota** — catch the AI SDK rate-limit error; if a `retry-after` is available and short, `await` then retry once (I/O wait is free on Workers); otherwise reply "⏳ I'm a bit busy right now — try again in a few seconds."
- **Daily cap reached** — friendly message explaining the bot is at its daily AI limit; suggest trying later. (Upgrade path: paid Gemini key.)
- **Timeouts** — bounded per-call; never leave the user hanging without a reply.

---

## 7. UX & command spec

- Commands registered via `setMyCommands`: `start, practice, topics, settings, language, level, stats, tip, help, cancel`. `/language` opens the **task-language** picker; `/settings` opens the nested hub; `/level` opens the level sub-menu. `/tip` opens the **tip jar** (preset Stars tiers, §13) and is also mentioned in `/help`.
- **Settings are a nested hub.** One message shows the current selections inline (e.g. `🌐 Task language: Spanish`, `💬 Feedback: English`, `📊 Level: B1`); each opens a focused sub-keyboard and returns to the hub. The task-language sub-keyboard is reused for first-run onboarding.
- **Inline keyboard `callback_data` scheme** (each < 64 bytes):
  - `cat:grammar` · `cat:vocab`
  - `topic:<id>`
  - `act:next` · `act:change` · `act:settings`
  - `cfg:task` · `cfg:feedback` · `cfg:level` — open the matching settings sub-menu
  - `set:task:<code>` — `<code>` ∈ `ru,uk,es,pt,fr,de,it,pl,tr,ar,zh,ja`
  - `set:feedback:english` · `set:feedback:source`
  - `set:level:A2|B1|B2|C1`
  - `onb:task:<code>` — first-run onboarding choice (then → main menu)
  - `tip:<stars>` — send a Stars invoice for the chosen tier; `<stars>` ∈ `50,100,250` (§13)
  - `cfg:back` (→ settings hub) · `nav:back` (→ main menu) · `nav:stats`
- **Payment updates (Stars):** outside the callback/text routing above. `pre_checkout_query` → `answerPreCheckoutQuery(true)` within 10s (nothing to validate for Stars); `message:successful_payment` → idempotent `tips` insert + thank-you. Neither touches `sessions.state`, so tipping never disturbs an in-flight exercise.
- **Message formatting:** Telegram **HTML parse mode** (only `<`, `>`, `&` need escaping) — safer than MarkdownV2 for AI-generated text. A central `ui/format.ts` renders the `GradingSchema` into a message; `ui/copy.ts` holds the English UI strings. The "translate" prompt names the source language (e.g. *"✍️ Translate from Spanish: «…»"*).
- **Non-text input** while `awaiting_answer` → polite nudge, state unchanged.

---

## 8. Config & secrets

`wrangler.toml` (sketch):
```toml
name = "english-roundtrip"
main = "src/index.ts"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "DB"
database_name = "english-roundtrip"
database_id = "<from wrangler d1 create>"

[vars]
GEMINI_MODEL = "gemini-flash-lite-latest"   # current choice — see docs/model.md
COOLDOWN_SECONDS = "3"
ANTI_REPEAT_WINDOW = "10"
```
Per-user preferences (task language, feedback mode, level) are **not** config — they live in D1 (§3).

**Secrets — this is a public repo, so they are NEVER committed:** `BOT_TOKEN`, `GEMINI_API_KEY`, `WEBHOOK_SECRET`.

- **Production:** `wrangler secret put <NAME>` — stored encrypted in Cloudflare, never in the repo or git history.
- **Local dev:** `.dev.vars` (`KEY=VALUE`, gitignored). A committed **`.dev.vars.example`** lists the required names with empty values so a contributor knows what to provide without ever seeing a real value.
- `.gitignore` excludes `.dev.vars` and `.dev.vars.*` (with `!.dev.vars.example`). Non-secret config stays in `[vars]`.

---

## 9. Security

- Validate Telegram's `X-Telegram-Bot-Api-Secret-Token` header against `WEBHOOK_SECRET` on every request; reject mismatches with 401.
- No `eval`, no dynamic code from model output.
- Content-safety constraints in the generation prompt; structured output only.
- Minimal data retention (Telegram id + settings + progress); documented in `/help`.
- **Public-repo secret hygiene** — no secret is committed: `.gitignore` excludes `.dev.vars`; `.dev.vars.example` documents the required names with empty values; production secrets live only in Cloudflare (`wrangler secret put`). Treat any secret that lands in git as compromised → rotate it immediately (@BotFather for the bot token, Google AI Studio for the Gemini key).

---

## 10. Testing (`bun test`)

Pure, fast, no network:
- **Language catalog** — `domain/languages.ts`: code↔label lookups; Telegram `language_code` → supported-language mapping (incl. fallback for `en`/unmapped).
- **Prompt builders** — given inputs, assert the prompt includes the task language, level, topic hint, anti-repeat list, safety rules, and (grading) the resolved feedback language.
- **Zod schemas** — parse golden/edge JSON; reject malformed; the one-sentence refinement accepts single CJK/Arabic sentences and rejects multi-sentence ones.
- **Feedback formatter** — schema → expected HTML (escaping, verdict emoji, feedback in English vs the task language).
- **Session state machine** — transitions and guards (onboarding gate, cooldown, awaiting → grade).
- **Stats logic** — streak increment/reset, error-category tally, accuracy.
- **Command/callback routing** — craft grammY `Update` objects; assert handler dispatch (incl. `cfg:*`, `set:task:*`, `set:feedback:*`, `onb:task:*`).

AI and Telegram are **mocked**. An optional live smoke test (real Gemini, 1 generate + 1 grade) sits behind an env flag and is excluded from CI.

---

## 11. Observability

- `console.*` structured logs; inspect with `wrangler tail`.
- Errors logged with context (handler, user id hash, state).
- Usage insight derived from the D1 `stats` table (no third-party APM in V1); task-language distribution is queryable from `users.task_language`.

---

## 12. Proposed repository structure

```
src/
  index.ts              # Worker entry: secret check + grammY webhookCallback
  bot.ts                # Bot instance, middleware wiring, command registration
  config.ts             # env/var parsing & validation
  ai/
    client.ts           # @ai-sdk/google provider setup
    schemas.ts          # GenerationSchema, GradingSchema, ErrorCategory, one-sentence check
    prompts.ts          # system/user prompt builders (task language + feedback language aware)
    generate.ts         # generateExercise()
    grade.ts            # gradeTranslation()
  data/
    db.ts               # D1 helpers / query wrappers
    users.ts            # profile repo (get-or-create, set task language / feedback mode / level)
    sessions.ts         # session repo + state transitions
    stats.ts            # counters, streak, error tallies, daily-cap count (§16)
    tips.ts             # tip ledger repo: idempotent insert, totals (§13)
    migrations/0001_init.sql
    migrations/0002_tips_and_cap.sql   # role + daily_count columns + tips table
  domain/
    topics.ts           # the topic catalog (id, category, label, generationHint) — English skills
    languages.ts        # task-language catalog (code, English/native label) + language_code mapping
    levels.ts           # CEFR constants & descriptions
    limits.ts           # DAILY_FREE_LIMIT constant + per-day count helpers (§16)
    roles.ts            # exempt-role set + isExempt(role) (§17)
    state.ts            # session state enum + guards (incl. choosing_task_language)
  handlers/
    start.ts  help.ts  cancel.ts
    onboarding.ts       # first-run task-language pick (choosing_task_language)
    menu.ts             # category/topic inline menus
    practice.ts         # generate → awaiting → grade → feedback loop
    settings.ts         # nested hub: task language, feedback mode, level
    stats.ts
    fallback.ts         # non-text / unknown input
    tip.ts              # /tip jar: tier keyboard, invoice, pre_checkout, successful_payment (§13)
  ui/
    keyboards.ts        # inline keyboard builders (incl. language picker, nested settings)
    format.ts           # GradingSchema → HTML message
    copy.ts             # English UI strings (translate prompt names the source language)
  ratelimit/
    cooldown.ts
tests/                  # mirrors src/, bun test
wrangler.toml
package.json            # grammy, ai, @ai-sdk/google, zod (+ dev: @types/bun, wrangler)
scripts/
  refund.ts             # out-of-band Stars refund (refundStarPayment) — §13
.dev.vars              # gitignored (local secrets — never committed)
.dev.vars.example      # committed template, empty values
```

---

## 13. Daily usage cap & tipping (Telegram Stars)

Two **independent** features (decision §18): tips grant **no** benefit and the cap exemption
is a **manual** DB flag. They never reference each other in code or copy.

### 13.1 Daily usage cap

- **Unit & timing.** One *delivered* sentence = one count. The cap is checked and the counter
  incremented in `handlers/practice.ts` `startExercise` — the single seam that covers both
  topic-pick and **Next**. **Grading is never gated**: a sentence already shown can always be
  answered. Failed generations don't count (increment only after a successful generation).
- **Limit.** `DAILY_FREE_LIMIT = 10` (constant in `domain/limits.ts`).
- **Reset.** Midnight **UTC**, via the self-resetting write on `stats.daily_count` /
  `daily_count_date` (§3 Notes) — no cron.
- **Exemption.** `isExempt(user.role)` (`domain/roles.ts`, exempt set `{'premium','admin'}`)
  short-circuits the check entirely. Set `role` manually in D1.
- **Concurrency.** The check runs *before* `beginAiRequest`; the existing per-user in-flight
  lease (§6) already serialises generations, so two rapid taps can't double-spend — the second
  is rejected as `in_flight` regardless. No extra locking needed.
- **When capped.** Informational message only — e.g. *"You've done all 10 sentences for today —
  great work! 🎉 Come back after midnight UTC for more."* **No** tip-jar mention (avoids any
  paywall signal). New copy lives in `ui/copy.ts`.

### 13.2 Tip jar

- **Rail.** Telegram Stars — `bot.api.sendInvoice` with `currency: 'XTR'`, empty
  `provider_token`, `prices: [{ label, amount: <stars> }]`. No real-money provider, no shipping.
- **Tiers.** Preset buttons `⭐50 / ⭐100 / ⭐250` (`tip:<stars>` callbacks). Amounts are a single
  constant — tune freely. No custom-amount entry (keeps the FSM untouched).
- **Flow.** `/tip` → tier keyboard → invoice → `pre_checkout_query` answered `true` (≤10s) →
  `successful_payment` → idempotent `tips` insert (`charge_id` PK) + thank-you. Orthogonal to the
  practice FSM; `sessions.state` is never read or written by the tip path.
- **Records.** `tips(charge_id, telegram_id, amount, created_at)`. Stores `charge_id` so refunds
  are possible and enables a "total raised" query.
- **Refunds.** Out-of-band `scripts/refund.ts` calling `refundStarPayment(user_id, charge_id)`
  (look up `charge_id` in `tips`). No in-bot admin command / privileged webhook path.
- **No new secrets.** Stars uses the existing `BOT_TOKEN`; no provider token, no new env var.

### 13.3 Testing additions

- **Cap logic** (`domain/limits.ts`): under/at/over limit; stale `daily_count_date` resets to 0;
  exempt role bypasses; boundary at exactly `DAILY_FREE_LIMIT`.
- **Roles** (`domain/roles.ts`): `isExempt` for each exempt value, `NULL`, and unknown values.
- **Practice gating**: capped user is refused at `startExercise` *before* any AI call; exempt user
  is not; grading of an already-shown sentence is unaffected by the cap.
- **Tips repo**: insert is idempotent on duplicate `charge_id`.
- **Routing**: `tip:<stars>` dispatch, `pre_checkout_query` auto-approve,
  `successful_payment` → ledger + thank-you. Telegram payment APIs mocked.
