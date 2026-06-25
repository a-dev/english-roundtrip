# English Roundtrip — Product Requirements Document (PRD)

> Status: Draft v1 (rebrand/i18n baseline) · Owner: @a-dev · Last updated: 2026-06-24
> Companion docs: [context.md](./context.md) (architecture) · [idea.md](./idea.md) (original seed)


Telegram [@english_roundtrip_bot](https://t.me/english_roundtrip_bot)

## 1. Vision

English Roundtrip is a Telegram bot that helps people **improve their English through focused translation exercises** with detailed, AI-generated grammar feedback. The learner picks a grammar or vocabulary topic, the bot generates **one** sentence — in the learner's chosen **task language** — calibrated to their level, the learner translates it **into English**, and the bot returns specific, supportive feedback that emphasizes grammar.

The *target* is always English. The *source* (task) language is a per-user setting, so a Polish, Spanish, Turkish, or Japanese speaker can all use the same bot to train the same skill. The "roundtrip" is the loop: a sentence in your own language → your English translation → feedback in the language you choose.

The personality is easy-going, friendly, and encouraging — learning should feel light, not like an exam.

## 2. Problem & goals

Active *production* practice (composing English, not just recognizing it) is the hardest skill to train alone, because it needs immediate, specific correction. Tutors are expensive; generic apps rarely explain *why* something is wrong in a language the learner actually understands.

**Goals**
- Give learners cheap, on-demand translation practice with concrete corrective feedback.
- Serve learners **regardless of their first language** — the source language is a setting, not a hard-coded assumption.
- Target weak spots deliberately (specific grammar rules, vocabulary themes).
- Keep it free to run at small scale and frictionless to use (it lives in Telegram).
- Make feedback understandable: explanations in **English** (immersive, default) or **the learner's own language**.

**Non-goals (V1)** — see §7.

## 3. Target users

English learners worldwide, roughly **CEFR A2–C1**, default **B1**, who have a usable first language among the supported task languages (§6.4). Self-directed, mobile-first, already in Telegram. They want short, repeatable practice sessions rather than long lessons.

## 4. Strict rules & principles

These are invariants the implementation must guarantee:

1. **Exactly one sentence per exercise.** Never present multiple sentences to translate at once. (Hard rule from the brief — enforced structurally, including for languages with non-Latin sentence terminators.)
2. **Direction is `task language → English` only** in V1. The target is always English.
3. **Supportive, polite tone**; never mocking. Praise what's correct, then correct what isn't.
4. **Avoid sensitive content** (profanity, violence, adult themes, politics, medical/legal advice). The "use sensitive topics only if explicitly requested" nuance is deferred to V2 (it only arises with user-requested topics).

## 5. Personality & tone

From the seed brief: *"easy-going, fun, and friendly, with a good sense of humor."* Feedback should be encouraging and practical, focused on real-world language use. The bot asks for clarification when a request is ambiguous and never shames mistakes.

## 6. V1 scope

### 6.1 Exercise modes
- **📚 Grammar Focus** — exercises targeting a specific **English** grammar rule (tenses, articles, prepositions, …).
- **🗣 Vocabulary Builder** — exercises themed around an **English** vocabulary domain (travel, food, work, …).

Topics are a **curated catalog of ~9 grammar + ~6 vocabulary** definitions (core through advanced grammar). A "topic" is a definition `{ id, category, label, generationHint }`; it describes the English skill being tested and is **independent of the task language**. Sentences themselves are generated at runtime by the AI, in the user's task language, from the hint + the user's CEFR level.

### 6.2 The exercise loop
1. User picks a category, then a topic (inline buttons).
2. Bot generates **one** sentence, **in the user's task language**, calibrated to their level and topic.
3. User replies with their English translation (plain text).
4. Bot grades it and returns **rich structured feedback**.
5. Buttons: `➡️ Next` (same topic) · `🔀 Change topic` · `⚙️ Settings`.

### 6.3 Feedback (the core value)
Structured output, rendered into a friendly message:
- **Verdict** — ✅ correct / ⚠️ almost / ❌ needs work.
- **Corrected translation** — the natural English version (**always English**).
- **Itemized issues** — each with the offending fragment, a category (tense, article, word order, preposition, vocabulary, …) describing the **English** error, and an explanation **in the learner's chosen feedback language**.
- **Natural alternative** — an optional more idiomatic phrasing (**always English**).
- **Encouragement** — a short supportive line.

### 6.4 Settings (per user, persisted)
- **Task language** — the language the source sentence is written in (what you translate *from*). Curated list of 12: **Spanish, Portuguese, French, German, Italian, Polish, Ukrainian, Russian, Turkish, Arabic, Chinese (Simplified), Japanese**. English is intentionally excluded (it is the target). No default is stored for a brand-new user — the **first `/start` opens a task-language picker** pre-seeded by a guess from the Telegram client language (`from.language_code`). Free-text "other language" is deferred to V2.
- **Feedback language** — a two-way **mode**, not a free choice: **English** (immersive) or **Your language** (= the current task language). Affects *only* the explanation/encouragement text; the corrected sentence and alternatives stay English; the UI stays English. Default **English**. The mode auto-follows the task language, so changing the task language never leaves a stale feedback language.
- **CEFR level** — A2 / B1 / B2 / C1. Feeds generation (sentence complexity & vocabulary) and grading (strictness calibration). Default **B1**.

### 6.5 Progress (light stats)
A `/stats` view: total exercises, accuracy, current streak, and top "weak spots" (most frequent error categories). Stored in D1.

### 6.6 Interface
- **English-only UI** (menus, buttons, commands) — independent of the task/feedback language.
- **Inline-first hybrid** navigation: inline keyboards drive the loop; slash commands registered in Telegram's menu as shortcuts.
- **Settings are a nested hub**: one screen shows the current Task language / Feedback / Level inline; tapping each opens a focused sub-menu and returns to the hub. The same task-language sub-menu is reused for first-run onboarding.
- Commands: `/start` · `/practice` · `/topics` · `/settings` · `/language` (task language) · `/level` · `/stats` · `/help` · `/cancel`.

## 7. Out of scope for V1 (non-goals)

- `English → task language` direction (reverse translation / back-translation).
- Free-text / custom task languages beyond the curated 12.
- Free-form chat / open Q&A with the bot.
- User-requested / custom topics.
- Random mixed challenges.
- Voice or photo input; audio output.
- Bilingual *UI* (only feedback explanations are localized; the UI stays English).
- A third feedback language different from both English and the task language.
- Spaced repetition, full exercise history, leaderboards.
- Multi-sentence exercises (violates the strict one-sentence rule).

## 8. V2 roadmap (deferred)

- **Reverse direction** — `English → task language`, and/or back-translation roundtrips.
- **Custom task languages** — free-text source language beyond the curated 12, with quality/safety guardrails and sentence-terminator handling.
- **Random Challenges** — mixed grammar/vocabulary rounds.
- **User-Requested Topics** — free-text topic requests, with safety guardrails and the "sensitive only if explicitly requested + cautionary note" behavior.
- **Voice answers** (speech-to-text), optionally TTS of the correct sentence.
- **Expanded catalog** and difficulty auto-tuning based on performance.
- **Spaced repetition / mistake review** — resurface past weak spots; needs exercise history (D1).
- **Immersion mode** and possibly a **paid tier / stronger model** for sharper feedback (the model is configurable — see [model.md](./model.md)).

## 9. Success metrics

- **Activation** — % of users who complete ≥1 full exercise after `/start`.
- **Reach** — distribution of task languages in use.
- **Engagement** — exercises per active user per day; D1 / D7 retention.
- **Reliability** — % of rounds completed without an AI/infra error; staying within free-tier limits.
- **Learning signal (proxy)** — accuracy trend per user over time; reduction in repeat error categories.
- **Feedback quality** — (V2) 👍/👎 on feedback messages.

## 10. Constraints & assumptions

- **Free-tier first.** Cloudflare Workers + D1 (free) for hosting/state; a free Gemini API key for AI (current model in [model.md](./model.md)). Comfortably free below ~hundreds of users; the first ceiling is Gemini's free-tier daily request quota (2 calls per round), which varies by model.
- **Generation quality varies by task language.** Major languages are strong; the curated 12 were chosen for reach and Gemini quality. Non-Latin scripts (Arabic, Chinese, Japanese) need explicit sentence-terminator handling in validation (see context.md §5).
- **Privacy.** Only the Telegram user id and lightweight progress/settings data are stored. **Free-tier Gemini prompts may be used by Google for model training** — acceptable for non-sensitive language exercises, and disclosed in `/help`. No sensitive personal data is collected.
- **Per-user cooldown** protects the shared quota and discourages spam.
- **Public repository / secrets.** The repo is **public**, so **no secret is ever committed**. Tokens and keys are supplied via environment variables only: `.dev.vars` locally (gitignored, with a committed `.dev.vars.example` template listing the required names) and **Wrangler secrets** in production. Non-secret config (model, tunables) lives in `wrangler.toml`. Rotating a leaked token (revoke at @BotFather / Google AI Studio) is the documented response to any accidental exposure.

## 11. Risks & mitigations

| Risk                                    | Mitigation                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini daily quota exhausted at scale   | Pick a model with adequate free-tier RPD (configurable, see model.md); per-user cooldown; graceful "busy, try again" messaging; documented upgrade path to paid key |
| Generation quality / safety variance across languages | Constrained generation prompt (task language + level + safety rules); structured output validated by Zod; regenerate on schema/safety failure |
| One-sentence rule leaks on non-Latin scripts | Sentence-terminator set in validation covers Latin/Cyrillic + CJK (`。！？`) + Arabic (`؟`); prompt instructs native punctuation |
| Repetitive sentences                    | Per-(user, topic) anti-repeat list passed to the generator                                                                             |
| Telegram formatting breakage on AI text | Use HTML parse mode and escape AI-produced text; Arabic RTL display is a known minor-polish item                                       |
| Cost creep                              | Stay on free tiers; alert/upgrade only when limits are actually hit                                                                    |

## 12. Open questions / future decisions

- Should `/stats` expose per-category breakdown in V1 or just totals + streak? (Plan assumes totals + streak + top-3 weak categories.)
- When to introduce free-text / custom task languages (the long tail beyond the curated 12).
- When to introduce a paid Gemini key and switch to a stronger model (the model is configurable — see [model.md](./model.md)).
- Whether to add a lightweight 👍/👎 on feedback in V1 to start collecting a quality signal early.
