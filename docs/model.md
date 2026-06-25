# Model

The LLM is intentionally **not pinned** in the architecture docs — we're still
experimenting with models and providers. This file is the single living record
of the current choice. Update it whenever the model changes.

## Current model

**`gemini-flash-lite-latest`** (Gemini via `@ai-sdk/google`).

- **Why:** works on the free tier, cheap and fast, and the workload is tiny —
  one short source-language sentence to generate and one English translation to
  grade per round.
  A lite model is plenty for that. We use the `-latest` alias so we auto-track
  Google's current flash-lite without redeploying. **Trade-off:** the underlying
  model can change under us (quality/latency may shift silently), so this record
  is the *family*, not a pinned version — pin a dated id if reproducibility ever
  matters more than auto-upgrades.
- **Set via** the `GEMINI_MODEL` env var. The deployed default lives in
  `wrangler.toml` `[vars]`; `src/ai/client.ts` holds a matching fallback used
  only when the var is unset (e.g. the live smoke test).

## How to change the model

- **Production / default:** edit `GEMINI_MODEL` in `wrangler.toml` `[vars]`.
- **Locally, for one session:** set `GEMINI_MODEL` in `.dev.vars` (it overrides
  the `wrangler.toml` value for `wrangler dev`). See `.dev.vars.example`.
- **Live smoke test:** `RUN_LIVE_AI=1 GEMINI_MODEL=... GEMINI_API_KEY=... bun test src/ai/live.test.ts`.

Keep the fallback in `src/ai/client.ts` (`DEFAULT_GEMINI_MODEL`) in sync with the
current choice so the live test exercises the model we actually ship.

## Switching providers

`src/ai/client.ts` is the **only** module bound to `@ai-sdk/google`; everything
downstream takes a plain `LanguageModel`. To try another provider, swap the
provider package and `createAiModel` there — no other code changes. (See
context.md §4–§5.)

## Notes from free-tier experimentation

Hard-won gotchas, kept here so we don't relearn them:

- **`gemini-2.0-flash` returned `limit: 0`** on the free tier for our account —
  the *first* request 429s (`generate_content_free_tier_requests`, limit 0), not
  a usage problem. Different models get different free-tier allowances.
- **Free-tier daily caps are per model and vary by account** (region, age,
  billing). What AI Studio shows for *your* project is authoritative; published
  numbers are just starting points.
- **Gemma model ids need the `-it` suffix** (e.g. `gemma-4-31b-it`, not
  `gemma-4-31b`). A bare id 404s with "not found … for generateContent". Confirm
  ids via ListModels: `GET /v1beta/models?key=...`.
- **Gemma 4 31B works but lost to flash-lite on quality.** It has a higher daily
  cap (~1500/day vs flash-lite's account-specific cap) and handled structured
  JSON + system instructions fine, but its feedback was noticeably more verbose
  and read worse for grading. Use `scripts/compare-models.ts` to re-evaluate if
  the quota math ever forces a revisit.
