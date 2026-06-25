# Repository Guidelines

## Project Structure & Module Organization

Bun + TypeScript Cloudflare Worker for the English Roundtrip Telegram bot. Entry points: `src/index.ts` and `src/bot.ts`. Keep domain logic in `src/domain/`, D1 code/migrations in `src/data/`, AI/Gemini code in `src/ai/`, handlers in `src/handlers/`, and UI text/keyboards in `src/ui/`. Tests are co-located as `*.test.ts`.

## Build, Test, and Development Commands

- `bun install`: install dependencies.
- `bun run dev`: run Wrangler.
- `bun test`: run tests.
- `bun run lint` / `bun run lint:fix`: check or fix Oxlint.
- `bun run format:check` / `bun run format`: check or write Oxfmt.
- `bun run typecheck`: run Wrangler types and `tsc --noEmit`.
- `bun run check`: run lint, format, tests, and typecheck.
- `bun run deploy`: deploy the Worker.

## Coding Style & Naming Conventions

Write strict TypeScript ESM. Follow Oxfmt: two-space indentation, single quotes, semicolons. Prefer named exports and precise names like `taskLanguage`, `feedbackMode`, and `telegramId`. Comment only security boundaries, Worker behavior, or AI prompt constraints.

## Testing Guidelines

Use `bun:test` with behavior-focused names. Update nearby tests for touched domain rules, config parsing, handlers, D1 access, AI schemas/prompts, and failure paths. Run `bun run check` before handoffs.

## Commit & Pull Request Guidelines

Use Conventional Commits, for example `feat(data): add task language` or `fix: remove stale copy`. PRs should describe user-visible changes, checks, and linked issues.

## Security & Configuration

Never commit `.dev.vars` or secrets. Copy `.dev.vars.example` locally; set production secrets with `bun wrangler secret put <NAME>`. Keep non-secret config in `wrangler.toml`.
