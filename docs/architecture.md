# Architecture

Last verified: 2026-02-15

## Component Map
- `/Users/sonnyfullerton/Projects/atlas/apps/web/app`
  - App Router pages (`/`, `/upload`, `/tracks`, `/track/[id]`, `/map`)
  - API routes under `app/api/*`
- `/Users/sonnyfullerton/Projects/atlas/apps/web/components`
  - `tracks/*`: list rows, search, status polling, similar tracks, DNA panel
  - `player/*`: sticky mini player
  - `layout/*`: sidebar + right rail
  - `map/*`: currently placeholder components
- `/Users/sonnyfullerton/Projects/atlas/apps/web/lib`
  - `helix.ts`: HelixDB client helpers (named queries + MCP traversal wrappers)
  - `analyze.ts`: async analysis/similarity pipeline
  - `player-context.tsx`: client audio/queue state
- `/Users/sonnyfullerton/Projects/atlas/packages/shared`
  - shared types (`Track`, `IngestResponse`) and `audioUrl()` helper
  - embedding generation (`embeddings.ts`)
- `/Users/sonnyfullerton/Projects/atlas/db`
  - `schema.hx`: graph/vector schema
  - `queries.hx`: named Helix queries used by app/scripts
- `/Users/sonnyfullerton/Projects/atlas/scripts`
  - DB init, seed, smoke tests, upload/search tests, backfill tools

## Runtime Topology
```text
[Next.js UI Pages]
      |
      v
[Next.js API Routes] ----> [apps/web/lib/analyze.ts] (fire-and-forget async in same process)
      |                              |
      |                              v
      +-----------------------> [HelixDB :6969]
      |                          - Track nodes
      |                          - Vector nodes
      |                          - SIMILAR_TO edges
      v
[Local Disk data/uploads]
      |
      v
[GET /api/audio/[id] stream -> HTMLAudioElement in PlayerContext]
```

## Key Flows

### 1) Ingest / Upload
- UI (`/upload`) sends `multipart/form-data` with key `file` to `POST /api/ingest`.
- API validates MIME type, extension, and max size (100MB).
- API computes SHA-256 hash and checks duplicates via `findTrackByHash()`.
- If duplicate: returns existing `{ id, status, duplicate: true }`.
- If new: writes file to `data/uploads/<uuid>.<ext>`, creates `Track` node with `PENDING`, triggers `analyzeTrack(...)` without awaiting, returns `{ id, status: "PENDING", duplicate: false }`.

### 2) Analyze
- Triggered by ingest route in-process (no external queue).
- `analyzeTrack()`:
  - parses metadata using `music-metadata`
  - derives `duration_sec`, `bpm`, `key`, `energy`
  - writes `PROCESSING` + analysis fields via `UpdateTrackAnalysis`
  - builds metadata text and generates text embedding (`all-MiniLM-L6-v2`)
  - attempts CLAP audio embedding (`clap-htsat-unfused`); on failure, continues text-only
  - finds neighbors (`FindNeighbors`, `FindAudioNeighbors`), merges rank-based scores (40% text / 60% audio), writes `SIMILAR_TO` edges with `score`, `basis`, `model_version`
  - sets `READY` via `UpdateTrackAnalysis`
- On failure: writes `ERROR` + message via `UpdateTrackError`.

### 3) Retrieve / Similarity
- Track detail page fetches `getTrack(id)` server-side.
- If status is `PENDING`/`PROCESSING`, client `TrackStatusPoller` polls `GET /api/tracks/[id]` every 2s until `READY`/`ERROR`, then refreshes page.
- Similar tracks panel calls `getSimilarTracks(id)` server-side.
- API route `GET /api/tracks/[id]/similar` exposes same query for client integrations as `{ results: Track[] }`.
- Player streams audio from `GET /api/audio/[id]` only when track is `READY`; supports byte ranges for seek/scrub.

## Data Contracts (UI-facing)

### `Track` (`packages/shared/index.ts`)
- Required fields used by UI: `id`, `title`, `artist`, `status`, `duration_sec`, `bpm`, `key`, `energy`, `original_filename`, `filepath`, `upload_date`, `error`.
- Status values: `"PENDING" | "PROCESSING" | "READY" | "ERROR"`.

### Ingest response
- `POST /api/ingest -> IngestResponse`
- Shape: `{ id: string, status: TrackStatus, duplicate: boolean }`.

### Search response
- `GET /api/tracks/search?q=...&limit=...`
- Shape: `{ results: Track[] }`.

### Similar response
- `GET /api/tracks/[id]/similar`
- Shape: `{ results: Track[] }`.
- Note: does not currently include similarity edge metadata despite DB storing it.

### Audio response
- `GET /api/audio/[id]`
- `200` full stream or `206` ranged stream; `422` if track not ready; `404` if track/file missing.

## Storage Model
- File storage: local filesystem under `/Users/sonnyfullerton/Projects/atlas/data/uploads`.
- Metadata + vectors + graph edges: HelixDB at `HELIX_URL` (`.env` default `http://localhost:6969`).

## Boundaries
- DB writes happen from:
  - `POST /api/ingest` (track creation)
  - `apps/web/lib/analyze.ts` (analysis fields, embeddings, similarity edges)
  - maintenance scripts in `/scripts` (seed/backfill/smoke)
- UI components must not write directly to HelixDB.
- Read helpers in `apps/web/lib/helix.ts` are the application boundary for data access.
- `Track.status` gating is enforced before audio streaming and before queueing playable tracks.
