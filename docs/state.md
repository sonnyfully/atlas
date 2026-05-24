# State

Last verified: 2026-04-05

## Truth Snapshot

### Working
- Discover/Desktop UX hierarchy is implemented:
  - Atlas overview with search input, upload CTA, and build / readiness status
  - rich track rows with scene-tinted waveform lanes and queue integration
  - queue context is rendered directly on the home page
  - sticky bottom player uses a real `HTMLAudioElement` with seek, volume, mute, prev/next, buffering/error states, and keyboard shortcuts
- Upload ingestion is implemented:
  - `POST /api/ingest` validates MIME type, extension, and size
  - upload is deduplicated by SHA-256 (`Track.file_hash`)
  - files are stored on local disk in `data/uploads`
  - ingest hard-checks Helix availability and returns actionable `503` errors when Helix is unavailable
  - background analysis is triggered immediately after track creation
- Track browse/read APIs are implemented:
  - `GET /api/tracks`
  - `GET /api/tracks/[id]`
  - `GET /api/tracks/search?q=...&limit=...`
- Deterministic cover art API is implemented:
  - `GET /api/cover/blobtoon/[trackId].svg?v=1&s=<size>`
  - stable SVG output, immutable caching, and ETag / `304` support
- Audio playback API is implemented:
  - `GET /api/audio/[id]` serves full-file and range requests for `READY` tracks
- Analysis pipeline is implemented:
  - metadata extraction via `music-metadata`
  - heuristic BPM / key / energy derivation
  - audio embedding generation via CLAP when decode succeeds
  - status lifecycle `PENDING -> PROCESSING -> READY | ERROR`
- Similar retrieval is implemented:
  - `GET /api/tracks/[id]/similar` returns `{ source_id, results: [{ track, score, basis, model_version, updated_at }] }`
  - current read path prefers persisted graph truth and falls back only when needed
- Collision and scene APIs are implemented:
  - `GET /api/tracks/[id]/collisions`
  - `GET /api/scenes`
  - `GET /api/scenes/[id]`
- Atlas v1 3D sound map is implemented:
  - `GET /api/atlas/map?v=1` returns `{ world, tracks, scenes, scene_graph_edges }`
  - backend computes deterministic projection, scene clustering, scene graph edges, bridge / collision scores, and provenance
  - payloads are cached by `world.version_hash` in memory and on disk at `data/atlas/v1/<hash>.json`
  - `/map` renders the React Three Fiber planet-skim map with toroidal wrap, scene aura blobs, scene arcs, selection, and player integration
- Frontend pages using real data:
  - `/`
  - `/upload`
  - `/tracks`
  - `/track/[id]`
  - `/map`
  - `/scenes`
  - `/scenes/[id]`
- Client polling for async completion remains active on the track detail page (`2s`)

### Partial
- Search remains intentionally track-first:
  - UI no longer advertises multiple scopes
  - backend performs track search only
- Audio embedding generation still has decode constraints in the current Node runtime:
  - WAV works on the active CLAP path
  - optional ffmpeg fallback broadens decode coverage, but local environments can still differ
- Library / likes are only partially productized:
  - `/tracks` is a working browseable catalog
  - likes are local UI state only
  - there is no auth or persisted user library yet

### Stubbed
- `apps/api/` is still only a scaffold; all active API routes live in `apps/web/app/api/`

### Broken / Operational Caveats
- Analysis and atlas rebuild scheduling still run in-process; a process restart loses in-flight work
- Local scripted verification currently depends on dev dependencies actually being installed; repo scripts exist, but the current checkout may not always be in a runnable state

## Invariants And Verification

### Invariants
- `Track.status` lifecycle remains `PENDING -> PROCESSING -> READY` or `ERROR`
- Duplicate upload detection remains SHA-256 based (`Track.file_hash`)
- Audio playback is gated on `Track.status === "READY"`
- Cover generation invariants:
  - seed is derived server-side from `Track.file_hash` when present, else `trackId`
  - SVG payload is deterministic for `(seed, version, size)`
  - no user strings are embedded in SVG markup
- Atlas v1 invariants:
  - `world.version_hash` changes when the ready-track dataset materially changes
  - `track.pos` values are stable for a fixed dataset
  - scene graph edges are scene-to-scene only in v1

### Verify with commands
```bash
bash scripts/init_db.sh
pnpm dev:web
pnpm atlas:prep
pnpm atlas:smoke
bash scripts/test_upload.sh data/seed_audio/midnight_drive.wav
curl -s http://localhost:3000/api/tracks/<id>/similar
curl -s 'http://localhost:3000/api/atlas/map?v=1'
```

### Verify manually
- Upload MP3/WAV from `/upload`; confirm ingest succeeds and status transitions to `READY`
- Open `/track/<id>` and confirm Similar Tracks shows ranked results
- Play a `READY` track from the list or map and confirm the bottom player streams audio through `/api/audio/[id]`
- Open `/map` and verify:
  - 3D planet-skim scene renders
  - hover and click selection behave correctly
  - sidebar actions open DNA and scene proof pages
  - `Highlight Neighbors` lights up neighboring tracks / scenes

## Known Gaps / Tech Debt
- No durable queue / worker for analysis or atlas rebuild jobs
- Search remains intentionally narrower than a broader discovery product

## Now / Next / Later

### Now
- Core ingest -> analyze -> browse -> search -> playback loop is implemented and connected
- Similar retrieval endpoint is implemented and usable
- Atlas v1 3D map is implemented and is the primary map experience

### Next
- Add a durable background execution model for analysis + rebuild tasks
- Expand search only if the product needs broader discovery than the current flow

### Later
- Add auth, persisted likes, and user-owned library features
- Add observability around atlas build latency, failure reasons, and snapshot freshness
- Decide whether to fully remove or intentionally retain the legacy atlas v0 path
