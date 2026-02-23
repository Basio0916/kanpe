# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kanpe is a cross-platform conversation assistant desktop app built with Tauri v2 (Rust backend + React frontend). It captures, transcribes, and analyzes conversations in real-time with AI assistance. Supports macOS, Windows, and Linux.

## Commands

```bash
# Install dependencies
pnpm install

# Frontend dev server (port 1420)
pnpm dev

# Full Tauri dev (frontend + Rust backend with hot reload)
pnpm tauri dev

# Type-check + build frontend
pnpm build

# Build distributable desktop app
pnpm tauri build

# Build Rust backend only
cd src-tauri && cargo build
```

No test framework is configured yet.

## Architecture

### Two-Window System

The app runs two separate windows, each with its own React entry point:

- **Main window** (`index.html` → `src/main.tsx` → `App.tsx`): Sessions list, session detail, settings, onboarding. Uses React Router v7 for navigation.
- **Overlay window** (`overlay.html` → `src/overlay.tsx` → `OverlayApp.tsx`): Floating transparent always-on-top window for live captions and AI controls during recording.

### Frontend → Backend Communication

Frontend calls Rust commands via `invoke()` and listens for events via `listen()` from `@tauri-apps/api`. Type-safe wrappers live in `src/lib/tauri.ts`. The backend emits events for real-time data: `caption`, `ai-response`, `recording-state`, `connection`.

### State Management

Three Zustand stores, each focused on a specific domain:
- `src/stores/app-store.ts` — locale, onboarding status
- `src/stores/session-store.ts` — session data and captions
- `src/stores/overlay-store.ts` — recording status, connection state

### Rust Backend (`src-tauri/src/`)

Commands are organized by domain in `src-tauri/src/commands/`: `recording.rs`, `sessions.rs`, `ai.rs`, `permissions.rs`, `settings.rs`, `window.rs`. Shared state in `state.rs` (AppState with Mutex-wrapped fields). Database configured as SQLite (`kanpe.db`) via Tauri SQL plugin but migrations are not yet populated.

### i18n

Two locales (English, Japanese) defined in `src/lib/i18n.ts`. Components access translations via `const d = t(locale)` pattern.

## Key Conventions

- **Package manager**: pnpm
- **UI components**: shadcn/ui (New York style) in `src/components/ui/`, app-specific components in `src/components/kanpe/`
- **Styling**: Tailwind CSS v4 with CSS variables for theming; use `cn()` from `src/lib/utils.ts` for class merging
- **Path alias**: `@/*` maps to `./src/*`
- **File naming**: kebab-case for files, PascalCase for components, `Screen*` prefix for page-level components, `Overlay*` for overlay components
- **Rust commands**: Return `Result<T, String>`, registered in `src-tauri/src/lib.rs`
