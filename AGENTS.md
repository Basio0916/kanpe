# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript frontend.
- `src/components/kanpe/`: product screens and overlay UI.
- `src/components/ui/`: reusable UI primitives.
- `src/routes/`: route-level pages (`sessions`, `session-detail`, `onboarding`).
- `src/stores/`: Zustand state stores.
- `src/lib/tauri.ts`: typed frontend bridge for Tauri commands.
- `src/lib/i18n.ts`: localization dictionaries and translation helper (`en`/`ja`).
- `src-tauri/`: Rust backend (audio capture, STT/LLM, persistence, window control).
- `src-tauri/src/commands/`: Tauri command handlers.
- `src-tauri/migrations/`: SQLite migration files.
- `docs/`: product and design docs.
- `dist/`: build output (generated, do not edit manually).

## Build, Test, and Development Commands
- `pnpm install`: install Node dependencies.
- `pnpm dev`: run frontend via Vite.
- `pnpm tauri dev`: run the desktop app in development.
- `pnpm build`: type-check and build frontend (`tsc -b && vite build`).
- `cd src-tauri && cargo check`: compile-check Rust backend.
- `cd src-tauri && cargo fmt`: format Rust code.

## Coding Style & Naming Conventions
- TypeScript/TSX: follow existing style per file; avoid unrelated reformatting.
- Use descriptive names; prefer clarity over abbreviations.
- Components use `PascalCase` exports; filenames are mostly kebab-case (e.g., `screen-session-detail.tsx`).
- Hooks follow `use-*` naming.
- Rust modules/functions use snake_case; keep command logic under `src-tauri/src/commands/`.
- This project is i18n-enabled. Do not hardcode user-facing strings in components; add/update keys in `src/lib/i18n.ts` and provide both English and Japanese values.

## Testing Guidelines
- No dedicated automated test suite is currently enforced.
- Minimum validation before PR:
  - `pnpm build`
  - `cd src-tauri && cargo check`
- For logic-heavy changes (session state, AI context, audio pipeline), add targeted tests where practical and document manual verification steps.

## Commit & Pull Request Guidelines
- Follow current history style: Conventional Commits with Japanese summaries.
- Examples:
  - `feat: セッション固有の話者タグ管理機能を実装`
  - `refactor: セッション一覧の未使用のMoreボタンを削除`
- Keep commits atomic and scoped to one concern.
- PRs should include purpose, impacted areas, verification commands/results, and screenshots for UI changes.

## Security & Configuration Tips
- Store secrets in `.env` (for example, API keys); never hardcode credentials.
- Handle missing env vars with clear error messages and safe fallbacks.
