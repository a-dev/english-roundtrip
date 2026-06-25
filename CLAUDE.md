# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Telegram bot for English translation drills: Cloudflare Worker (grammY webhook) + D1 + Gemini.

## Commands

- `bun test` — all tests. One file: `bun test src/ai/grade.test.ts`; by name: `bun test -t "<pattern>"`.
- `bun run check` — lint + format + tests + typecheck; green before handoff/deploy.
- `bun run dev` — local Worker.
- Live AI test (opt-in): `RUN_LIVE_AI=1 GEMINI_API_KEY=... bun test src/ai/live.test.ts`.

## Architecture (non-obvious, cross-file)

- **Worker (`src/index.ts`):** validates env + the `X-Telegram-Bot-Api-Secret-Token` header (**401** on mismatch). Config/unhandled errors return **200** on purpose (non-2xx → Telegram retries → storm). Bot memoized per isolate.
- **State always from D1**, never memory. `src/data/`: `users`, `sessions` (one/user), `stats`.
- **Target is always English.** "Task language" = the *source* translated *from* (per-user, 12; `domain/languages.ts`); `sourceSentence` is in it.
- **Feedback is a mode, not a language:** `feedback_mode ∈ {english, source}` (no `feedback_language` column), resolved at grading; corrected text always English.
- **AI (`src/ai/`):** `generate.ts`/`grade.ts`, each `generateObject` + Zod (`schemas.ts`). Swap providers only in `ai/client.ts`. One-sentence rule enforced in `schemas.ts` (regex incl. CJK/Arabic).
- **Config:** secrets via `wrangler secret`/`.dev.vars`, vars in `wrangler.toml`; per-user prefs in D1. Session FSM in `domain/state.ts`; handlers stay thin.

## Rules

- More: [`docs/context.md`](docs/context.md), [`README.md`](README.md), [`docs/model.md`](docs/model.md).
