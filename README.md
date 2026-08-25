# Lazer Player Client

Web client for a personal [Lazer](../) media server: browse and search your
library, stream audio, and control playback from lockscreen / hardware keys
via the MediaSession API. Installable as a PWA (auto-updating service worker,
manifest only — no offline caching strategy).

## Stack

Vite 8 + React 19 + TypeScript 6, React Compiler enabled. Tailwind v4 +
shadcn/Radix primitives. Zustand (persisted player state), TanStack Query v5
(paged library data).

## Server endpoint

The client talks to the media server over HTTP:

- `GET /songs` (`?search=&page=&size=`)
- `GET /audio/<hash>`
- `GET /image/<hash>/optimized`

Set the base URL in `.env`:

```
VITE_LAZER_PLAYER_SERVER_ENDPOINT=https://your-server.example.com
```

Defaults to `''` (same-origin). All URL building lives in
`src/services/api/config.ts`.

**The server must support HTTP Range requests** (`206 Partial Content` with
`Content-Range` for `Range:` headers). Seeking into unbuffered audio relies
on it — a server that advertises `Accept-Ranges: bytes` but answers `200`
with the full body leaves the browser stalled silently. In Express,
`res.sendFile(absPath)` handles ranges; a manual `fs.createReadStream`
pipeline does not unless you implement them.

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Vite dev server on `0.0.0.0:5173` |
| `npm run dev:host` | Dev server with explicit `--host` |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run lint` | ESLint (prettier rules included) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run preview` | Serve the production build locally |

## Tailscale remote access

The dev server binds all interfaces and allows `*.ts.net` hosts; HMR is
configured for TLS termination via Tailscale Serve (internal WS protocol,
client port 443). To use it from another device on your tailnet:

1. Expose the dev server: `tailscale serve https / http://localhost:5173`
2. Open `https://<your-host>.<tailnet>.ts.net` on the client device.

## Architecture notes

See [AGENTS.md](./AGENTS.md) for the operating conventions, target
architecture (store ↔ playback-controller bridge), and refactor history.
