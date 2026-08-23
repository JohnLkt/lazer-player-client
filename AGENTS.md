# AGENTS.md

Operating notes for AI agents and humans: repository state, the problems we
are fixing, the target architecture, and the phased refactor plan. Read this
before editing code. When uncertain, inspect the actual files — this doc is
the plan, not a description of a finished system.

> This document **supersedes** all previous AGENTS.md plans and phase lists.
> The core architectural decision (strict no-readback from `<audio>` into the
> store) has been revised: see §4, "Controller bridge" model.

---

## 1. Repository snapshot (verified 2026-08-23)

- Small single-page frontend (~15 source files). Local music player client.
- Stack: **Vite 8 + React 19 + TypeScript 6.0**, React Compiler enabled via
  `@rolldown/plugin-babel` (`reactCompilerPreset`) in `vite.config.ts`.
  `npm run build` = `tsc -b && vite build`.
- Talks to a media server over HTTP (`axios`): `GET /songs`, `/audio/<hash>`,
  `/image/<hash>/optimized`. Endpoint comes from
  `VITE_LAZER_PLAYER_SERVER_ENDPOINT` (`.env`), defaulting to `''`.
- UI: Tailwind v4 globals + shadcn/Radix primitives in `src/components/ui/`.
  State: Zustand v5 with `persist` (localStorage key `lazer-player-storage`).
  Data: TanStack Query v5 infinite query. Audio: one `<audio>` element +
  MediaSession API. PWA via `vite-plugin-pwa` (`autoUpdate`, manifest only).
- Dev server binds `0.0.0.0:5173`, `.ts.net` hosts allowed, WSS-over-Tailscale
  HMR config. Personal remote access, not a networked service.
- Router: single route `/` (`BrowserRouter`). React Query client configured
  inline in `App.tsx` (`refetchOnWindowFocus: false`, `retry: false`).

### Environment and tooling

- Terminal is **Windows PowerShell 5.1**. No GNU tools; use PowerShell cmdlets.
- Install state is **not trusted**: always run `npm install` yourself and get
  `npm run build` + `npm run lint` green before and after changes. Do not
  assume either passes.
- Lint: `eslint .` (react-hooks, react-refresh, prettier, typescript-eslint).
  No tests exist; no test runner configured.
- Prettier `.prettierrc`: `{ singleQuote: true, trailingComma: 'all' }`.
  Vendored shadcn files (`button.tsx`, `input.tsx`) use double quotes — leave
  them as-is unless deliberately editing; new/edited app code follows the
  config (single quotes).
- Path alias `@` → `src/` (vite.config.ts, components.json, tsconfig).
- Git: `main`, no remote. Never push/PR/commit unless explicitly asked.

---

## 2. Current file map (roles as they are TODAY)

| Path | Role today |
| --- | --- |
| `src/main.tsx` | Entry: StrictMode + BrowserRouter → App |
| `src/App.tsx` | QueryClientProvider + layout composition root; renders LibraryPage + SongPlayer |
| `src/pages/library/LibraryPage.tsx` | Thin page wrapper around SongList |
| `src/components/SongList.tsx` | Search input, infinite-scroll song list; **currently mutates the store during render** |
| `src/components/SongPlayer.tsx` | Bottom bar: metadata, transport controls, scrubber, volume |
| `src/components/ui/*` | Vendored shadcn primitives (button, input, slider, separator, skeleton) — avoid editing |
| `src/services/stores/usePlayerStore.ts` | Zustand store + persist; **entangled with AudioAgent, react-query callback, module-level audio listeners** |
| `src/lib/audioAgent.ts` | Singleton `<audio>` + MediaSession presenter; exposes raw element via `getAudio()` |
| `src/services/api/config.ts` | `BASE_URL` from env |
| `src/services/api/songsApi.ts` | `GET /songs` via axios → `SongListItemDto[]` |
| `src/services/queries/songsQueries.ts` | `useInfiniteSongs` (+ `songKeys`, `getNextPageParam`) |
| `src/services/models/SongListItemDto.ts` | Track shape declared as a class (to become interface) |
| `src/lib/formatTime.ts` | m:ss formatter (default export) |
| `src/lib/hooks/useDebounce.ts` | Debounce hook (default export) |
| `src/lib/utils.ts` | `cn()` helper |

---

## 3. Problem inventory (why the refactor exists)

Numbered for reference in the plan. Line refs are relative to `src/`.

- **P1 — Bidirectional store↔DOM fight.** Store actions call
  `AudioAgent.*` (`stores/usePlayerStore.ts:71,83,122,151,164`) while module-
  level audio listeners write back into the store
  (`usePlayerStore.ts:213-233`). Two writers for `isPlaying`/time; ordering-
  dependent behavior.
- **P2 — Module-import side effects.** The entire audio sync block runs at
  import time (`usePlayerStore.ts:190-238`), including `setState` and
  listener registration. StrictMode-hostile, untestable, order-dependent.
- **P3 — react-query leaks into the store.** `fetchMoreTracks` callback held
  in state (`usePlayerStore.ts:19-23,34-40,87-99,169`) and written from the
  component (`components/SongList.tsx:35-39`). Paging belongs to the
  component that owns the query.
- **P4 — Render-phase store mutation.** `SongList.tsx:22,28-39` calls
  `getState()`/`setState()` during render (queue swap + callback install).
  Illegal pattern; double-fires under StrictMode.
- **P5 — Non-atomic play intent.** `handlePlaySong`
  (`SongList.tsx:43-47`) performs three sequential mutations
  (queue, track, offset) instead of one action; duplicated logic vs
  `setTrack`; tear window between sets.
- **P6 — Components bypass actions.** `getState()` used to invoke actions in
  handlers/JSX (`SongPlayer.tsx:32-36,84,93,107,121,130,144`,
  `SongList.tsx:31,44-46`).
- **P7 — Whole-store subscription.** `SongPlayer.tsx:17-28` destructures the
  entire store without selectors → re-renders the whole bar on every
  `timeupdate`.
- **P8 — Triplicated play+metadata block.** Identical
  set/playTrack/updateMediaSession sequences at
  `usePlayerStore.ts:58-79`, `86-130`, `132-159`.
- **P9 — Scattered/wrong URL building.** `AudioAgent.getAssetUrl`
  (`lib/audioAgent.ts:104-107`) returns `/audio/<hash>` even for artwork,
  while images are actually served from `/image/<hash>/optimized`
  (`SongList.tsx:128`). `BASE_URL` re-read from env inside audioAgent
  instead of reusing `services/api/config.ts`.
- **P10 — Model lies.** `SongListItemDto` is a class of definite-assignment
  fields used purely as a type; `dateAdded` typed `Date` but arrives as a
  JSON string.
- **P11 — Debug residue.** `console.log(queue)` (`usePlayerStore.ts:89`),
  narrational comments (`SongList.tsx:139`, `usePlayerStore.ts:91-109`).
- **P12 — Queue identity fragility.** Changing the search rebuilds
  `allSongs`; queue is swapped by first-id heuristic
  (`SongList.tsx:28-33`); `currentOffset` can silently point at the wrong
  song; selection mixes offset + id (`SongList.tsx:110-111`).
- **P13 — End-of-queue desync.** `nextTrack` stall leaves `isPlaying === true`
  while audio ended (`usePlayerStore.ts:103-107`); prefetch threshold
  `currentOffset + 3 >= queue.length - 1` is off-by-one-ish.
- **P14 — MediaSession incomplete.** No `setPositionState` (lockscreen scrubber
  position); seek actions read the raw element directly
  (`audioAgent.ts:79-99`) — acceptable only inside the presenter layer.
- **P15 — Convention drift.** Default exports (`formatTime.ts`,
  `useDebounce.ts`), `React.*` namespace usage (`SongList.tsx:1,13,23,85,102,114`),
  hardcoded page size `20` (`SongList.tsx:104`) duplicating the hook arg.
- **P16 — Bogus slider scale.** Scrubber falls back to `max={100}` when
  duration is unknown (`SongPlayer.tsx:159`).

---

## 4. Target architecture

### Principles (enforce in review)

1. **Store is the single source of truth** for domain + playback state.
   Components read selectors and dispatch actions. Nothing else.
2. **One imperative bridge.** A `PlaybackController` owns the `<audio>`
   element and `navigator.mediaSession`. Nothing else touches them. Reading
   element state is allowed *only* inside `src/lib/audio/*`.
3. **Two one-way channels** (the "controller bridge" model — decided):
   - *Commands*: UI → store action → state diff → controller slice
     subscription → element/mediaSession writes.
   - *Facts*: element events → controller → store setters. Single-writer:
     `currentTime` updates from `timeupdate` are suppressed while a scrub
     gesture is active; the gesture window belongs to the component until
     commit.
4. **No module-import side effects anywhere under `src/`.** Bootstrap happens
   in an explicit `initPlaybackController()` called once from `main.tsx`.
5. **Paging lives in `SongList`.** The store knows nothing about react-query;
   no callbacks in state.
6. **React Compiler memoizes.** No `React.memo` / `useCallback` /
   `useMemo` churn; write compiler-friendly components.

### Data flow

```
        commands (actions)                    facts (events)
UI ────────────────────▶ Zustand store ──subscribeWithSelector──▶ PlaybackController
 ▲                         (persisted)                              │        │
 └──── selectors ─────────────┘                                     ▼        ▼
                                                            <audio>   mediaSession
```

### Module layout target

```
src/
  lib/
    audio/playbackController.ts   # initPlaybackController(): element, listeners,
                                  # mediaSession, store subscriptions. Exposes nothing.
    formatTime.ts                 # named export
    hooks/useDebounce.ts          # named export
    utils.ts
  services/
    api/config.ts                 # BASE_URL + getAudioUrl(hash) + getImageUrl(hash, variant?)
    api/songsApi.ts
    queries/songsQueries.ts       # PAGE_SIZE exported here
    models/SongListItem.ts        # interface (replaces SongListItemDto class)
    stores/usePlayerStore.ts      # pure state + intents only
```

`src/lib/audioAgent.ts` is deleted once zero references remain.

### Draft contracts

Store state: `currentTrack`, `currentOffset`, `queue`, `isPlaying`,
`volume`, `currentTime`, `duration`, `isScrubbing`, `pendingSeek`
(`{ value, nonce } | null` — seek is expressed as state so it stays one-way).
Persisted (`partialize`): `volume`, `currentTrack`, `currentOffset`,
`queue` — unchanged.

Store actions: `playFromList(songs, index)` (atomic: adopt queue + set track +
offset), `nextTrack(): boolean`, `previousTrack()`, `togglePlay()`,
`setVolume(v)`, `beginScrub(t)` / `commitScrub(t)` (sets `pendingSeek`),
`applyPlaybackFacts({ currentTime?, duration?, isPlaying? })`.

Controller subscriptions (via `subscribeWithSelector`):
`currentTrack?.id` changed → load & play + metadata; `volume` → `el.volume`;
`isPlaying` → play/pause (guarded against echo); `pendingSeek?.nonce` → seek +
clear; element events → `applyPlaybackFacts` (with scrub guard) and
`ended` → `nextTrack()`, setting `isPlaying: false` when it cannot advance
(fixes P13). Adds throttled `mediaSession.setPositionState` (fixes part of P14).

Queue adoption policy (fixes P12): clicking a row adopts the visible list as
the queue (explicit user intent). Background refresh swaps the queue only when
the head id matches the current queue's head id (same logical list, grown) —
this check moves into `playFromList`/a store helper, never render code.

---

## 5. Refactor plan

Work top-to-bottom; keep every phase green (build + lint) before moving on.

### Phase 0 — Baseline

- [x] `npm install`; then `npm run build` and `npm run lint`. Fix only
      environment-level breakage. Record results.
      (Done 2026-08-23: build ✓ 547ms, lint clean.)

### Phase 1 — Foundations (mechanical, low-risk)

- [x] Replace `class SongListItemDto` with `export interface SongListItem`
      (`dateAdded: string`); update imports in songsApi/store/SongList; delete
      old file. (Fixes P10.)
- [x] Add `getAudioUrl(hash)` / `getImageUrl(hash, variant = 'optimized')` to
      `api/config.ts`; migrate audioAgent playback/artwork URLs and SongList
      image srcs; delete the misnamed `getAssetUrl`. No URL string building
      outside `config.ts`. (Fixes P9.)
- [x] Named exports for `formatTime` and `useDebounce`; update call sites.
      Defer SongList/SongPlayer import cleanup to Phase 3 (same files).
- [x] Export `PAGE_SIZE` from `songsQueries.ts`; kill the hardcoded `20`
      where the hook is called. (Part of P15.)

Acceptance: build + lint green; grep finds no `/audio/` or `/image/`
concatenation outside `api/config.ts`.

### Phase 2 — Store purification + PlaybackController extraction (core)

- [x] Create `lib/audio/playbackController.ts` per §4 contracts (element,
      listeners, MediaSession incl. `setPositionState`, slice subscriptions,
      scrub guard, `ended` → advance-or-pause).
- [x] Call `initPlaybackController()` once from `main.tsx` (module scope,
      outside render).
- [x] Slim `usePlayerStore.ts`: pure state + intents; add
      `playFromList`, `pendingSeek`, `applyPlaybackFacts`; unify the three
      duplicated blocks behind one internal helper; delete
      `fetchMoreTracks`/`setFetchMoreTracks`; delete `AudioAgent` usage and
      the whole bottom sync block (`190-238`).
- [x] Delete `lib/audioAgent.ts` when unreferenced.
      (Done 2026-08-23: build ✓ 553ms, lint clean.)

Contract refinements discovered during implementation (supersede §4 draft):

- Commands key off a `loadNonce` counter (incremented by every play intent),
  not `currentTrack?.id` alone — re-clicking the playing row must restart it,
  which an id-diff cannot express. Metadata still derives from `currentTrack`.
- Extra store actions beyond the draft: `moveScrub` (drag updates; implies
  `isScrubbing`), `seek` (programmatic seek primitive used by MediaSession
  ±10s handlers; `commitScrub` wraps it), `setIsPlaying` (explicit intent for
  MediaSession play/pause handlers), `togglePlay`.
- Store wraps `subscribeWithSelector` outside `persist` — required for the
  controller's slice subscriptions.
- Minimal SongPlayer/SongList rewiring happened here out of necessity
  (audioAgent deletion breaks them): scrubber now uses `moveScrub`/
  `commitScrub`; SongList dispatches `playFromList`; render-phase queue-swap
  and `fetchMoreTracks` install blocks deleted. Remaining Phase 3 items are
  unchanged (selectors, TransportControls dedupe, prefetch effect,
  namespace-import cleanup).

Acceptance: build + lint green; grep gates: zero `AudioAgent`, zero
`addEventListener` outside `lib/audio`, no statements after the store
definition in `usePlayerStore.ts` besides the export, zero `fetchMoreTracks`.

### Phase 3 — Consumer rewiring (SongList, SongPlayer)

- [ ] SongList: remove all render-phase `getState`/`setState`; derive
      selection from selectors; replace `handlePlaySong` body with a single
      `playFromList(allSongs, globalIndex)`; move near-end prefetch into an
      effect watching page proximity (`fetchNextPage`) so auto-advance keeps
      the buffer fed without store knowledge; normalize remaining
      `React.*` usages to named imports. (Fixes P3, P4, P5, P12, P15-part.)
- [ ] SongPlayer: per-field selectors instead of whole-store destructure;
      call hook actions directly in handlers (no `getState`); dedupe the
      mobile/desktop control clusters into a local `TransportControls`
      component; scrubber `max={duration || 0}`, disabled while unknown.
      (Fixes P6, P7, P16.)

Acceptance: build + lint green; grep: zero `getState(`/`setState(` under
`src/components/` and `src/pages/`; progress bar still tracks playback and
scrubbing does not fight updates (manual check per §7 matrix items 4, 7).

### Phase 4 — Hygiene sweep

- [ ] Strip residual `console.log`, narrational comments, TODO banners
      (`console.error` for genuine failures is allowed). (Fixes P11.)
- [ ] Finish named-import normalization repo-wide (excluding vendored
      `components/ui/*`).
- [ ] Prettier pass on edited files (single quotes; vendored ui/* untouched).
- [ ] Rewrite stock `README.md`: what the app is, dev/build/lint commands,
      `VITE_LAZER_PLAYER_SERVER_ENDPOINT`, Tailscale dev-server note.

Acceptance: `npm run lint -- --max-warnings 0` green; grep: zero
`console.log` under `src/`.

### Phase 5 — Closeout

- [ ] Full `npm run build` + `npm run lint`.
- [ ] Run the full manual smoke matrix (§7).
- [ ] Update this AGENTS.md: tick phases, replace §2 "today" map with the
      post-refactor map, retire solved problem IDs.

---

## 6. Conventions

- Verify installs/builds yourself; never assume green (see §1).
- Imports: named bindings; no `import *`; prefer `import d, { a } from 'mod'`.
- Prefer named exports for components and hooks alike; vendored `ui/*` exempt.
- Path alias `@` → `src/`.
- React Compiler on: no manual memoization churn; stable props, early returns.
- **New hard rules:** components never call `getState`/`setState`/`subscribe`;
  no side effects at module import; only `lib/audio` touches `<audio>` /
  `mediaSession`; only `api/config.ts` builds server URLs; only `SongList`
  owns paging; transient playback fields must not be added to `partialize`.
- File references use TSX path form relative to `src/`, e.g.
  `components/SongPlayer.tsx:71`.

## 7. Verification playbook

Commands: `npm run build`, `npm run lint` after each phase; grep gates listed
per phase. Manual smoke matrix (dev server, desktop + mobile viewport):

1. Cold start with saved queue → track restored paused, metadata correct,
   play resumes.
2. Click row → plays immediately; row highlighted; bar shows title/artist.
3. Next/prev boundaries: no crash at ends; at end-of-library `isPlaying`
   becomes false (truthful state).
4. Scrub: dragging updates time without fighting; commit seeks; live updates
   resume after release.
5. Volume slider + mute toggle; persists across reload.
6. Infinite scroll through ≥2 pages mid-playback; next-track crosses page
   boundary without stalling.
7. Search-filter change while playing → current row highlight stays correct;
   queue adoption behaves per policy.
8. MediaSession (lock screen / hardware keys): play/pause/next/prev/
   seek±10s; artwork and position shown.
9. Track missing audio hash → surfaced error, no silent stuck state.

## 8. Non-goals

Shuffle/repeat/playlist features; router restructuring (single route is
fine); theming; SSR; introducing a test runner (future option: vitest unit
tests for pure store reducers after Phase 2); offline/PWA caching strategy
(`autoUpdate` SW stays as-is).
