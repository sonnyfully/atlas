# @atlas/web

SoundCloud-inspired music discovery UI for Track Atlas.

## Quick start

```bash
# From the repo root
pnpm install
pnpm dev:web        # http://localhost:3000
```

Or directly:

```bash
cd apps/web
pnpm dev            # http://localhost:3000
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Home / Discover — track feed, search, trending tags, recently played |
| `/track/[id]` | Track detail — hero, waveform, Track DNA card, similar tracks |
| `/map` | Sound Map — 2D scatter plot of tracks by scene, filters (tabs, tempo slider, genre select), scene detail sheet |

## What's mocked

Everything. There is no backend connection yet.

- **Track data** (`lib/mock/tracks.ts`) — 12 tracks with full metadata (energy, mood, tempo, brightness, danceability, genre, tags).
- **Scene data** (`lib/mock/scenes.ts`) — 5 scenes with positions, descriptions, and track membership.
- **Player** (`lib/player-context.tsx`) — client-side context with play/pause/next/prev/seek/volume. Progress auto-advances while "playing". No actual audio.
- **Cover art** — colored `<div>` placeholders (no images).
- **Waveforms** — deterministic pseudo-random bar heights seeded by track ID.
- **Search** — input is rendered but non-functional.
- **Like** — toggles locally per component instance (no persistence).
- **Sidebar "Library" and "Likes"** — nav items are visible but disabled.

## Tech stack

- Next.js 15 (App Router, Turbopack)
- React 19
- TypeScript (strict)
- Tailwind CSS 3
- shadcn/ui (new-york style, CSS variables)
- Lucide icons

### shadcn/ui components used

Button, Card, Tabs, Slider, Sheet, DropdownMenu, Input, Badge, Separator, Tooltip, ScrollArea, Select, Skeleton

## Design system

See `docs/design-system.md` for the full spec. Key tokens live in:

- `app/globals.css` — CSS custom properties (colors, radius)
- `tailwind.config.ts` — Tailwind theme (type scale, shadows, fonts)
- `lib/design/tokens.ts` — JS constants (spacing, radii, durations, hex colors)

### Tuning the palette

**More SoundCloud:** increase the orange saturation, darken `--foreground` to pure black, make `--border` lighter (`0 0% 93%`), use smaller border-radius (`--radius: 0.25rem`).

**More Apple:** soften the accent to a blue (`220 100% 50%`), increase `--radius` to `0.75rem`, use SF Pro font stack, add more shadow depth.
