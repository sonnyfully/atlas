# Track Atlas — Current Status

**Date:** April 5, 2026
**Primary stack:** Next.js 15 + React 19 + Tailwind CSS + HelixDB + `helix-ts`
**Primary runtime app:** `apps/web`

---

## Implemented

### Ingest / Analysis
- Drag-and-drop upload flow at `/upload`
- `POST /api/ingest` with file validation, SHA-256 dedupe, disk persistence, and Helix-backed `Track` creation
- Async analysis pipeline with metadata extraction, heuristic feature derivation, best-effort CLAP audio embeddings, and status transitions
- Track detail polling until analysis completes

### Browse / Search / Playback
- Discover page backed by real Helix data
- Library page at `/tracks`
- Track detail page at `/track/[id]`
- Search endpoint at `GET /api/tracks/search`
- Real audio playback via `/api/audio/[id]` and the global mini player
- Deterministic Blobtoon cover-art API

### Atlas
- Primary map contract at `GET /api/atlas/map?v=1`
- Atlas v1 payload includes:
  - `world`
  - `tracks`
  - `scenes`
  - `scene_graph_edges`
- `/map` renders the 3D planet-skim atlas with scene arcs, selection, provenance, and player integration
- Version-hash caching is implemented in memory and on disk

---

## Partially Implemented

### Search
- Backend intentionally remains track-first for the current product scope

### Productization
- `/tracks` is a working catalog, but not a personalized library
- likes are local UI state only
- auth / users do not exist yet

---

## Main Gaps
1. Durable background execution for analysis and atlas rebuild jobs
2. Broader search/discovery beyond the current track-first flow
3. Auth, likes, and user-owned library features

---

## Recommended Near-Term Focus
1. Harden operations:
   move analysis / rebuild work out of the web process lifecycle
2. Harden verification:
   add stronger E2E and map interaction coverage
