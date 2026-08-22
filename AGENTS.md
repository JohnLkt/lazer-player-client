# AGENTS.md

Repository operating notes for AI agents, new work, and continued refactoring.

Read this before editing code. It is not exhaustive documentation; when
uncertain, inspect the actual files. This doc encodes conventions, tooling
state, and the current design intent so edits stay aligned.

---

## Repository overview

- Small single-page frontend app (~15 files, ~3.5 KB of TS domain code).
- Stack: **Vite 8 + React 19 + TypeScript 6.0**, built with Vite's Oxc
  Babel pipeline. `npm run build` = `tsc -b && vite build`.
- Feature: local music player client. Talks to a media server via `axios`;
  renders a Shadcn/Radix UI with Tailwind v4 globals. Persistent audio
  playback state via Zustand, browser audio + MediaSession API
  (browsers/mobile) for playback control and controls.
- Dev server config: exposes 0.0.0.0:5173 with WSS protocol for
  Tailscale — a personal-remote-access setup, not a networked service.

## Environment and tooling state

- Terminal is **Windows PowerShell 5.1**. Use `.ps1` commands (do NOT rely on
  GNU tools: no `wc`, use `Write-Host`/`Write-Output`).
- **`node_modules/` and `dist/` are currently EMPTY.** Nothing is in a
  verified-green state. Do **not** presume `npm i` succeeds or that the build
  passes before actually installing. Install deps yourself to verify changes.
- Lint is `eslint .` (eslint-plugin-react-hooks, react-refresh preset,
  prettier + typescript-eslint). No tests exist and no test running configured.
- Prettier config: `.prettierrc` = `{ "singleQuote": true, "trailingComma": "all" }`.
  **Inconsistency:** shadcn component files (`button.tsx`, `input.tsx`) use
  **double quotes**, contradicting `singleQuote: true`. Prefer the config
  intent (single quotes) for new code; leave vendored UI components as-is
  unless deliberately editing them.
- Imports: TS path alias `@` → `src/` is configured in `vite.config.ts`.
  `components.json` documents the same aliases. `AudioAgent` imports use the
  `@lib` alias form across files.
- Git: on `main`, working tree clean at time of writing. No remote configured.
  Do not push or create PRs unless the user explicitly asks.

## Project layout

- `src/App.tsx` — composition root: wires QueryClientProvider, Router,
  renders LibraryPage + SongPlayer in a full-height flex container.
- `src/main.tsx` — React entry. StrictMode + BrowserRouter around `<App/>`.
- `src/pages/library/LibraryPage.tsx` — 3-line page wrapper around `<SongList/>`.
- `src/components/SongPlayer.tsx` — bottom player bar. Reads store, drives
  MediaSession actions config, renders controls.
- `src/components/SongList.tsx` — infinite scroll list + mirrored queue.
- `src/components/ui/` — `button.tsx` (cva + Radix Slot), `input.tsx`,
  `slider.tsx`, `separator.tsx`, `skeleton.tsx`. Ignore/avoid editing unless
  intentionally changing UI.
- `src/services/` — shared domain layer.
  - `stores/usePlayerStore.ts` — Zustand store w/ persist middleware (volume,
    queue, offsets, playback flags).
  - `api/config.ts` — `BASE_URL = import.meta.env.VITE_LAZER_PLAYER_SERVER_ENDPOINT ?? ''`.
  - `api/songsApi.ts` — thin `axios.get<SongListItemDto[]>` to `/songs`.
  - `queries/songsQueries.ts` — `useInfiniteSongs` react-query hook incl.
    `songKeys` and `getNextPageParam`.
  - `models/SongListItemDto.ts` — the track data shape.
- `src/lib/` — `audioAgent.ts` (the `<audio>` element + MediaSession),
  `utils.ts` (the `cn(...)` helper from clsx + tailwind-merge), `hooks/`, and
  format helpers.

## Conventions

- Import as named bindings, not namespaces; use fully-qualified imports
  (`import { X } from 'mod'`), not `import * as X`. Prefer `import defaultA, {
  defaultB, defaultC } from 'mod'` when imports share a default. `React.*` is
  generally unnecessary with JSX.
- Component files export named bindings (`export const X = () => {...}`) or a
  default export; hooks export named bindings or default. Prefer named exports.
- File/line references use the TypeScript TSX path form:
  `components/SongPlayer.tsx:71`.

## Domain design decisions

### State of truth: store is source, DOM is rendered (CURRENT — enforce)

Decis[ion made]: the **Zustand store is the single source of truth**; DOM
components are **controlled** by it. The previous store also owned the raw
`<audio>` element and synced it back by observing `timeupdate`/`durationchange`,
which created a bidirectional "fight" between reactive and imperative
subsystems. That coupling is being removed:

- **AudioAgent** is now a **pure presenter** — it writes to the `<audio>` DOM
  AND the browser `MediaSession`, but takes **only store actions as input**; it
  never reads back `currentTime`/`duration` into the store. The `<audio>`
  element becomes a throwaway DOM sink.
- Components must **not subscribe** to the store (no `usePlayerStore.subscribe`,
  no `getState()`/`setState()` for rendering). They read the selectors they
  need and derive everything (URLs, images, disabled state). Derived work
  belongs in the component/`useMemo`, not the global store/selector.
- The store must **own the queue** and play logic is centralized there — no
  pagination or fetch callbacks (`fetchMoreTracks`/`setFetchMoreTracks`) live
  in the store; let the component own pagination.
- Components read specific slices per-render and destructure exactly what they
  use.

### Source-of-truth / single-responsibility targets

- State-of-truth conflict: store is authoritative for queue/currentTrack/
  offsets, and DOM components must NOT re-drive it via `subscribe`/`getState`.
- Query logic: component must own pagination (SongList does prefetch and
  page fetching), removing the react-query store of any callback.
- Model: `SongListItem` is a frozen interface type (legacy: a class DTO,
  changed to interface form).

### Concurrency / performance

- React Compiler is enabled in `vite.config.ts`. Let it memoize; do not add
  `React.memo`, `useMemo`, `useCallback` churn. Prefer the mechanical rules it
  needs for memoization.
- IntersectionObserver is the infinite-scroll mechanism; keep it.

## Todo list for refactoring

### Phase 0 — Setup

- [ ] `npm install` to bring the project to a verified-green baseline (do not
      assume it passes).
- [ ] Verify `npm run build` (tsc -b + vite build) and `npm run lint` pass
      before making any changes.

### Phase 1 — Decouple playback from rendering (store -> DOM sink)

- [ ] Add an `AudioTransport` protocol interface (play/seek/toggle/setVolume)
- [ ] Add an `AudioTransportImpl` that implements the protocol; internally it
      writes to `<audio>` AND `navigator.mediaSession`. Must not read back
      store state.
- [ ] Rebuild `usePlayerStore` to depend on the protocol. Replace every
      `AudioAgent.getAudio()` + raw `audio.addEventListener('timeupdate' ...)`
      back-sync loop with the protocol-driven model. The store stops exposing
      /observing DOM for time/duration; it owns queue, play toggle, scrub,
      seek.
- [ ] `AudioAgent` ceases to be both model and presenter; it becomes the
      presenter/impl above. Document the handoff.
- [ ] Wire consumer components to the new store shape; verify no residual
      `AudioAgent.getAudio` or `addEventListener('timeupdate' ...)` remain.
- [ ] Rebuild + lint; verify no console noise or TODO residue lingers.

### Phase 2 — Evict query logic from the store

- [ ] Remove the react-query `fetchMoreTracks`/`setFetchMoreTracks` plumbing
      (the callback stored in state) since paging lives in the component
      (prefetch).
- [ ] Eliminate direct `.getState()`/`.setState(...)`/action duplication for
      user intents (e.g. a redundant `setState`+action pattern).

### Phase 3 — Normalize model

- [ ] Convert `class SongListItem implements ...` into
      `<output interface SongListItem {...}>`/`type SongListItemOutput`, used
      as the shared model across this layer.

### Phase 4 — React refs & hygiene

- [ ] Replace mixed `React.useState`/`React.Fragment`/`React.useMemo` calls and
      inconsistent dual/namespace-style imports with named bindings on every
      import line.
- [ ] Strip scratch/comments: `console.log`/`setState` noise, TODO banners;
      keep code intent and change-log clarity intact.

## Key considerations / open tensions after refactor

- Remove every remaining `.getState()`/`.setState(...)`/`subscribe` call for
  rendering (a side-effecting concern; reading is fine).
- The `<audio>` element becomes a throwaway DOM sink.
- The store no longer re-observes DOM (time/duration listeners moved to the
  presenter; store observes the presenter for playback state changes only).
- No user-facing progress bar/time display — `SongPlayer.tsx` renders controls
  and the presenter feeds playback state to components.
- URL string building is centralized (audio/artwork from base + hash).
- `SongList.tsx` becomes the single place that owns react-query pagination
  + prefetch; the queue itself lives in the store (`setQueue` + actions).
- Persisted to localStorage: volume, queue, currentTrack, currentOffset
  (in addition to any player config).

## Known inconsistencies

- `.prettierrc` declares `singleQuote: true`, but shadcn component files
  (`button.tsx`, `input.tsx`) use double quotes. Prefer the config for new
  code; leave vendored UI files unless editing them.
- `tsc` type-checking is enabled but not wired into eslint's default passes.

## Verification notes

- `pnpm run build` should pass after `npm install` completes.
