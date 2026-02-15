# Track Atlas — v1 Status

**Date:** February 13, 2026
**Stack:** Next.js 15 + React 19 + Tailwind CSS + HelixDB (graph+vector) + helix-ts SDK
**Repo:** `apps/web` (frontend + API routes), `packages/shared` (types), `db/` (schema + queries)

---

## Working Features

### Upload & Ingestion
- **Drag-and-drop upload page** at `/upload` — accepts MP3, WAV, M4A, FLAC, OGG up to 100MB
- **POST `/api/ingest`** — validates MIME type, extension, and size; computes SHA-256 hash for idempotent deduplication; saves file to `data/uploads/{uuid}.ext`
- **Artist/title extraction** from filename (DJ convention: `Artist - Title.mp3`)
- **Async analysis pipeline** — returns track ID immediately, processes in background
- **Duplicate detection** — re-uploading the same file returns the existing track ID

### Track Lifecycle (PENDING → PROCESSING → READY | ERROR)
- Track created in HelixDB with `status=PENDING` on upload
- Analysis worker transitions through `PROCESSING` → `READY` (or `ERROR` with message)
- **Auto-polling** on the track detail page — polls `/api/tracks/[id]` every 2 seconds, refreshes when complete

### Analysis Pipeline (v0)
- **Metadata extraction** via `music-metadata` — duration, ID3 tags (title, artist)
- **BPM detection** — from ID3 BPM tag or filename pattern (`[128BPM]`), falls back to 0
- **Key detection** — from ID3 key tag or filename pattern (`[Am]`), falls back to ""
- **Energy proxy** — BPM-based heuristic (60–180 BPM → 0.2–0.9), hash-based fallback
- **384-dim embedding** — deterministic metadata-based vector (title + artist + key + BPM hashed), L2-normalized. This is a placeholder; will be replaced with a real audio embedding model

### Track Display
- **Home page** (`/`) — "Recent Uploads" feed fetched from HelixDB via MCP traversal, sorted by upload date. Empty state with upload CTA
- **Track detail page** (`/track/[id]`) — hero section (cover art, title, artist, key/BPM badges), Track DNA card (key, tempo, energy bar, file info), status badges during analysis
- **Track list rows** — index, play button, cover art (deterministic HSL from track ID), title/artist, BPM, mini waveform strip, duration, context menu
- **Right rail** — 4 most recent tracks in compact format (xl: screens only)

### Player UI (mock)
- **Mini player** fixed at bottom — skip/play-pause/skip, track info, progress bar with seek, volume slider
- **Player context** — queue management, next/prev, auto-advance at track end
- **Waveform visualization** — deterministic bar heights from track ID hash, progress overlay, seek on click

### Navigation
- **Sidebar** — Home, Upload, Explore (map), Library (disabled), Likes (disabled)
- **Theme toggle** — light/dark mode via `next-themes`

### Database (HelixDB)
- **Schema:** Track (12 fields), Scene, Track_Vector (384-dim), HAS_EMBEDDING, IN_SCENE, SIMILAR_TO edges
- **Queries (8):** AddTrack, GetTrack, UpdateTrackAnalysis, UpdateTrackStatus, UpdateTrackError, AddScene, AddTrackEmbedding, FindNeighbors
- **Persistence:** Docker volume at `.helix/.volumes/dev`, survives container restarts
- **MCP enabled** for traversal queries + BM25 full-text search

### Scripts & Testing
- `pnpm seed` — seeds 5 test tracks with randomized analysis data + 384-dim embeddings + 1 scene
- `pnpm smoke-test` — full CRUD lifecycle test (add → get → update analysis → embed → update status → verify)
- `bash scripts/test_upload.sh <audio-file>` — end-to-end upload test via curl, polls until READY

---

## Partially Implemented

### Analysis Pipeline
- BPM/key detection only works if present in ID3 tags or filename — no signal processing (no FFT-based BPM detection, no chromagram key detection)
- Energy is a rough heuristic, not a real loudness/RMS measurement
- Embedding is a deterministic hash of metadata text, not audio-derived. Provides "similar title/artist" capability but no real timbre or vibe similarity

### Search
- Search input exists on the home page header but is not wired to any query. HelixDB has BM25 enabled which could power this

### Audio Playback
- Player UI is fully functional (controls, progress, seek, volume, queue) but uses simulated progress — no actual `<audio>` element or Web Audio API. No audio streaming from uploaded files

---

## Stubbed / Not Started

### Sound Map (`/map`)
- Page route exists, shows placeholder message
- `SoundMap` and `SceneSheet` components return null
- `MapFilters` UI component exists (tempo range slider, genre dropdown, view tabs) but is disconnected
- **Blocked on:** Scene clustering pipeline (HDBSCAN over vibe vectors)

### Scene System
- Scene node type exists in schema, `AddScene` query works, `IN_SCENE` edge defined
- No scene generation logic (HDBSCAN clustering, centroid computation)
- No `ADJACENT` edge between scenes (planned in spec)
- No scene assignment for uploaded tracks

### Collision Pairs
- `SIMILAR_TO` edge exists in schema but is never written
- No `COLLIDES_WITH` edge (planned: timbre kNN filtered by BPM/key compatibility)
- No collision detection pipeline

### Library & Likes
- Sidebar links disabled, no pages or endpoints
- `LikeButton` component toggles locally but doesn't persist

### Authentication
- No user model, no auth system

### `apps/api/`
- Empty scaffold (package.json only). All API routes live in `apps/web/app/api/` via Next.js App Router

---

## Data Flow

```
User drops audio file on /upload
    ↓
POST /api/ingest
    ├── Validate (MIME, ext, size ≤ 100MB)
    ├── SHA-256 hash → check duplicate in Helix
    ├── Save to data/uploads/{uuid}.ext
    ├── Parse filename → title, artist
    ├── AddTrack(status=PENDING) → Helix
    └── Fire analyzeTrack() async
         ├── music-metadata → duration, ID3 tags
         ├── Extract/estimate BPM, key, energy
         ├── UpdateTrackAnalysis(status=PROCESSING) → Helix
         ├── Generate 384-dim embedding → AddTrackEmbedding → Helix
         └── UpdateTrackAnalysis(status=READY) → Helix
    ↓
/track/[id] polls until READY → shows full DNA card
    ↓
/ homepage lists all tracks from Helix (MCP traversal, sorted by upload_date)
```

---

## Commands

```bash
bash scripts/init_db.sh        # Build + deploy HelixDB schema (Docker)
pnpm seed                      # Seed 5 test tracks with analysis data
pnpm smoke-test                # Run integration test against Helix
pnpm dev:web                   # Start Next.js dev server (port 3000)
pnpm build:web                 # Production build
bash scripts/test_upload.sh <file>  # End-to-end upload test
```

---

## Next Goals

### Near-term (v1 → v1.5)
1. **Real audio playback** — serve uploaded files via API route, wire `<audio>` element to player context
2. **Search** — wire home page search input to HelixDB BM25 full-text search over title/artist
3. **Better BPM/key detection** — integrate `essentia.js` (WASM) or a lightweight beat detection library for server-side signal processing
4. **Real embedding model** — replace metadata hash with `transformers.js` (`Xenova/all-MiniLM-L6-v2`) on metadata text, or a real audio embedding model

### Medium-term (v2)
5. **Scene clustering** — run HDBSCAN over vibe vectors, write `IN_SCENE` edges, compute scene centroids
6. **Sound Map** — 2D scatter plot visualization (canvas/SVG), scene labels, track dots colored by scene, click-to-explore
7. **Scene adjacency** — `ADJACENT` edges between scenes based on centroid similarity
8. **Collision pairs** — timbre kNN candidates filtered by BPM/key compatibility, write `COLLIDES_WITH` edges with score + reasons

### Longer-term (v3+)
9. **Shareable Track DNA cards** — OG image generation, export as image
10. **User accounts** — auth, persisted likes/library, upload history
11. **Cloud deployment** — S3/R2 for file storage, hosted HelixDB instance
12. **Mobile-responsive player** — full-screen player on small screens
