# English Roundtrip

Try it: [@english_roundtrip_bot](https://t.me/english_roundtrip_bot)

A Telegram bot that drills **English** through translation: pick a grammar or
vocabulary topic, translate one AI-generated sentence **from your chosen language
into English**, and get graded feedback. Because the source language is a per-user
setting, anyone — whatever their first language — can use it to train their
English. It runs on Cloudflare Workers (grammY webhook) with D1 for storage and
Gemini for generation and grading.

Telegram name of the production bot: **@english_roundtrip_bot**

- **Architecture & rationale:** [`docs/context.md`](docs/context.md), [`docs/prd.md`](docs/prd.md)
- **Model choice:** [`docs/model.md`](docs/model.md)

## How it works

- **Target is always English.** The bot only trains English; the topic catalog is
  English grammar (tenses, articles, prepositions, …) and English vocabulary
  domains.
- **Task language** (per user) is the language the prompt sentence is written in —
  the language you translate *from*. Twelve are supported:
  Spanish, Portuguese, French, German, Italian, Polish, Ukrainian, Russian, Turkish, Arabic, Chinese (Simplified), Japanese. On first `/start` the bot pre-selects a guess from your
  Telegram language and lets you confirm.
- **Feedback language** is a mode, not a free choice: **English** (immersive,
  default) or **your language** (explanations in your task language). The
  corrected translation and any natural alternative are *always* in English.

## Prerequisites

- [Bun](https://bun.sh) (the project defaults to Bun, not Node).
- A Cloudflare account; `bun wrangler login` once to authenticate.
- A Telegram bot token from [@BotFather](https://t.me/BotFather) — use a
  **separate** bot for production and for local development.
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

Install dependencies: `bun install`.

## Configuration: secrets vs. vars

Three values are **secrets** (set in Cloudflare, never committed). Everything
else is non-secret **config** in `wrangler.toml` `[vars]`. Per-user preferences
(task language, feedback mode, level) live in **D1**, not in config.

| Name                 | Kind   | Where it lives                                     | Notes                                             |
| -------------------- | ------ | -------------------------------------------------- | ------------------------------------------------- |
| `BOT_TOKEN`          | secret | `wrangler secret` (prod) / `.dev.vars` (local)     | From @BotFather; separate bot per environment.    |
| `GEMINI_API_KEY`     | secret | `wrangler secret` (prod) / `.dev.vars` (local)     | From Google AI Studio.                            |
| `WEBHOOK_SECRET`     | secret | `wrangler secret` (prod) / `.dev.vars` (local)     | Any long random string; must match `set-webhook`. |
| `GEMINI_MODEL`       | var    | `wrangler.toml` `[vars]` (override in `.dev.vars`) | See [`docs/model.md`](docs/model.md).             |
| `COOLDOWN_SECONDS`   | var    | `wrangler.toml` `[vars]`                           | Per-user AI cooldown.                             |
| `ANTI_REPEAT_WINDOW` | var    | `wrangler.toml` `[vars]`                           | Recent-sentence memory to avoid repeats.          |

The Worker validates these at the request boundary ([`src/config.ts`](src/config.ts));
a missing secret makes every request fail closed, so set them before deploying.

## Local development

1. Create the local secrets file and fill in all three values:
   ```sh
   cp .dev.vars.example .dev.vars
   ```
   `.dev.vars` is gitignored and must never be committed.
2. If you haven't yet, provision D1 and paste the printed `database_id` into
   `wrangler.toml`:
   ```sh
   bun wrangler d1 create english-roundtrip
   ```
3. Apply migrations to the **local** D1 instance, then run the Worker:
   ```sh
   bun wrangler d1 migrations apply english-roundtrip --local
   bun run dev
   ```

To exercise a real Telegram round locally, expose `wrangler dev` over HTTPS (e.g.
a tunnel) and point a **dev** bot's webhook at it (see below). The Worker rejects
any webhook request whose `X-Telegram-Bot-Api-Secret-Token` header doesn't match
`WEBHOOK_SECRET`.

## Testing

```sh
bun test            # unit + integration suite
bun run typecheck   # wrangler types --check && tsc --noEmit
```

Both must be green before deploying. One opt-in live test hits Gemini for real
(one generate + one grade) and is skipped by default:

```sh
RUN_LIVE_AI=1 GEMINI_API_KEY=... [GEMINI_MODEL=...] bun test src/ai/live.test.ts
```

## Deploy

Run from a clean tree with tests and typecheck green.

1. **Set production secrets** (interactive prompts; values are not written to the repo):
   ```sh
   bun wrangler secret put BOT_TOKEN
   bun wrangler secret put GEMINI_API_KEY
   bun wrangler secret put WEBHOOK_SECRET
   ```
2. **Apply migrations to remote D1:**
   ```sh
   bun wrangler d1 migrations apply english-roundtrip --remote
   ```
3. **Deploy the Worker:**
   ```sh
   bun run deploy
   ```
   Note the printed `https://<worker>.<account>.workers.dev` URL.
4. **Register the production webhook** (see below). The script verifies itself via
   `getWebhookInfo`.
5. **Commands** — the bot registers its `/`-command menu (`setMyCommands`)
   automatically on the first webhook it handles, so no manual step is needed.
   Send `/start` once to trigger it.

### Webhook management

These scripts call the Telegram Bot API directly, so they read `BOT_TOKEN` and
`WEBHOOK_SECRET` from the environment. For production, export the **production**
bot's values for the shell session — they must match the Cloudflare secrets. For
local use you can source `.dev.vars`:

```sh
set -a; source .dev.vars; set +a
```

```sh
# Point the bot at the deployed Worker and verify (URL, pending updates, last error):
bun scripts/set-webhook.ts https://<worker>.<account>.workers.dev

# Check the current webhook state at any time:
bun scripts/webhook-info.ts

# Remove the webhook (drops the pending backlog; pass --keep-pending to retain it):
bun scripts/delete-webhook.ts
```

A healthy webhook shows the correct URL, `Pending updates: 0`, and `Last error:
none`.

## Live smoke test

From a real Telegram account against the production bot, confirm feedback quality
and latency:

- [ ] **First `/start`** opens the task-language picker (pre-selecting a guess from
      your Telegram language), then the main menu.
- [ ] A full **Grammar** round in a **non-English task language**: pick a topic →
      translate the source sentence into English → get graded feedback.
- [ ] A full **Vocabulary** round end to end.
- [ ] Switch **task language** (`/language`); the next sentence is in the new
      language (try a non-Latin one, e.g. Chinese or Arabic).
- [ ] Switch **feedback** (`/settings` → Feedback) between English and your
      language; next feedback honors it (corrected translation stays English).
- [ ] Switch **level** (`/level`); next exercise honors it.
- [ ] `/stats` shows exercises, accuracy, streak, and weak spots.
- [ ] `/cancel` clears the in-flight exercise.
- [ ] Send a **non-text** message (e.g. a sticker) → graceful nudge, no crash.

Record the results in the launch PR/issue.

## Observability

Stream structured logs from the live Worker:

```sh
bun wrangler tail
```

Errors log with context (`updateId`, `telegramId`, operation) from the bot and
Worker boundaries. To confirm an error path, trigger a failure (e.g. exhaust the
Gemini quota, or send during an outage) and watch the corresponding log line.

## Operations / runbook

### Rotate a secret

```sh
bun wrangler secret put <NAME>   # paste the new value; takes effect immediately
```

- **`BOT_TOKEN`** — regenerate in @BotFather (`/revoke`), update the secret, then
  re-run `set-webhook` (it authenticates with the new token).
- **`GEMINI_API_KEY`** — create a new key in Google AI Studio, update the secret,
  then delete the old key.
- **`WEBHOOK_SECRET`** — generate a new value (`openssl rand -hex 32`), update the
  secret, then re-run `set-webhook` so Telegram sends the new header. Brief 401s
  are possible during propagation; Telegram retries.

If a secret is ever committed, treat it as compromised and rotate it immediately.

### Gemini daily cap

When the free-tier daily quota is exhausted, the bot already tells users
gracefully ("Today's AI limit has been reached…") and keeps serving once the cap
clears. To respond:

- **Wait** for the daily reset (Google AI Studio free-tier quotas reset at
  midnight Pacific), or
- **Upgrade**: attach a paid Gemini key (`wrangler secret put GEMINI_API_KEY`) and,
  if desired, bump `GEMINI_MODEL` in `wrangler.toml` `[vars]`, then `bun run deploy`.
  See [`docs/model.md`](docs/model.md) for model notes and free-tier gotchas.

### Rollback a deploy

```sh
bun wrangler deployments list
bun wrangler rollback [<version-id>]   # omit the id to roll back to the previous version
```

### Reset the webhook

If `webhook-info` shows accumulating errors or a stale URL:

```sh
bun scripts/delete-webhook.ts
bun scripts/set-webhook.ts https://<worker>.<account>.workers.dev
```

## Quota dashboards

Watch these to stay ahead of the limits that gate the bot:

- **Cloudflare Workers & D1** — Cloudflare dashboard → *Workers & Pages* →
  `english-roundtrip` → *Metrics* for request volume and errors; *Storage &
  Databases* → D1 → `english-roundtrip` → *Metrics* for rows read/written and
  storage.
- **Gemini usage** — [Google AI Studio](https://aistudio.google.com/) → *API
  keys* / usage, to track request volume against the free-tier daily cap.

## Adding a practice topic

Topics are English grammar/vocabulary definitions; they do **not** depend on the
task language (the AI writes each source sentence in the user's task language at
runtime).

1. Add a `Topic` entry to `TOPICS` in [`src/domain/topics.ts`](src/domain/topics.ts):
   a unique `id`, a `category` (`"grammar"` or `"vocab"`), a user-facing `label`,
   and a `generationHint` that steers the AI prompt.
2. Update [`src/domain/topics.test.ts`](src/domain/topics.test.ts) if you have
   assertions on the catalog (e.g. counts or invariants).
3. `bun test` and `bun run typecheck`, then `bun run deploy`. No migration or
   webhook change is needed — topics are code, surfaced through the menu keyboard.

## Adding a task language

The source-language catalog lives in [`src/domain/languages.ts`](src/domain/languages.ts)
(code, English label, native label, and the Telegram `language_code` → catalog
mapping used to seed onboarding).

1. Add an entry to the catalog (e.g. `{ code: "nl", englishLabel: "Dutch", nativeLabel: "Nederlands" }`)
   and map any matching Telegram `language_code` values to it.
2. Confirm the one-sentence validator (`src/ai/schemas.ts`) recognizes the
   language's sentence terminators; add any missing punctuation to the terminator
   set.
3. `bun test` and `bun run typecheck`, then `bun run deploy`. No migration is
   needed — the picker and onboarding read the catalog.
