# State

Last verified: 2026-02-17

## Truth Snapshot

### Working
- Upload ingestion: `POST /api/ingest` validates MIME/extension/size, deduplicates by SHA-256, stores file on disk, creates `Track`, and starts async analysis.
- Ingest now hard-checks Helix availability and returns actionable `503` errors when Helix is down instead of generic `500`.
- Track browse/read APIs:
  - `GET /api/tracks`
  - `GET /api/tracks/[id]`
  - `GET /api/tracks/search?q=...&limit=...`
- Deterministic cover art API: `GET /api/cover/blobtoon/[trackId].svg?v=1&s=<size>` returns seeded SVG covers with immutable caching + ETag/304 support.
- Audio playback API: `GET /api/audio/[id]` serves full/range streams for `READY` tracks.
- Analysis pipeline (`apps/web/lib/analyze.ts`) runs metadata extraction + audio embedding and finishes with `READY/ERROR`.
- Similar retrieval contract is now edge-enriched:
  - `GET /api/tracks/[id]/similar` returns `{ source_id, results: [{ track, score, basis, model_version, updated_at }] }`.
- Sound map is implemented:
  - `GET /api/map/atlas` returns map graph payload (`nodes`, `edges`, `scenes`, `meta`).
  - `POST /api/map/rebuild` forces a rebuild.
  - `/map` renders interactive graph UI (filters, pan/zoom, gradient edges, click pin card, double-click navigation).
- Atlas rebuild lifecycle exists:
  - Debounced `scheduleAtlasRebuild()` triggers after successful analysis.
  - Snapshot persistence at `data/atlas/latest.json`.
- Frontend pages using real data: `/`, `/upload`, `/tracks`, `/track/[id]`, `/map`.
- Cover rendering in track list rows, track hero, mini player, right rail, and compact track widgets now uses Blobtoon URL covers with deterministic fallback placeholders.
- Client polling for async completion remains active (`TrackStatusPoller`, 2s).

### Partial
- Similarity edge persistence in Helix (`AddSimilarEdge`) is still unreliable in this environment (`Graph error: Unsupported value type`); retrieval currently uses deterministic audio-feature scoring from READY tracks.
- `Scene`/`IN_SCENE` schema was expanded for map metadata, but current map rendering uses computed scenes from atlas build output rather than persisted scene graph writes.
- Audio-embedding generation still depends on WAV decode support in Node CLAP path; non-WAV can still reduce similarity quality until decode coverage is expanded.

### Stubbed
- None on primary user-facing map/similarity surfaces.

### Broken
- No hard compile/runtime breakages verified in source for core flows.
- Operational caveat remains: analysis and rebuild scheduling run in-process; process restart loses in-flight work.

## Invariants And Verification

### Invariants
- `Track.status` lifecycle remains `PENDING -> PROCESSING -> READY` or `ERROR`.
- Duplicate upload detection remains SHA-256 based (`Track.file_hash`).
- Cover generation invariants:
  - seed is derived server-side from `Track.file_hash` when present, else `trackId` hash.
  - SVG payload is deterministic for `(seed, version, size)`.
  - no user strings are embedded in SVG markup.
- `GET /api/audio/[id]` rejects non-READY tracks (`422`) and missing files (`404`).
- Map availability gate:
  - `READY tracks >= 3`
  - `similar edges >= 2`
- `/map` click model:
  - single-click opens pin card
  - double-click navigates `/track/[id]`

### Verify with commands
```bash
bash scripts/init_db.sh
pnpm smoke-test
pnpm dev:web
bash scripts/test_upload.sh data/seed_audio/midnight_drive.wav
curl -s http://localhost:3000/api/tracks/<id>/similar
curl -s http://localhost:3000/api/map/atlas
```

### Verify manually
- Upload MP3/WAV from `/upload`; confirm ingest succeeds and status transitions to `READY`.
- Open `/track/<id>` and confirm Similar Tracks shows score/basis badges.
- Open `/map` and verify:
  - graph renders (not placeholder),
  - filters adjust view,
  - single-click opens floating pin card,
  - double-click opens track page.
- Stop Helix and hit `/api/map/atlas`; confirm structured unavailable response and UI unavailable state.

## Known Gaps / Tech Debt
- No durable queue/worker for analysis or atlas rebuild jobs.
- Helix edge write path for string-heavy `SIMILAR_TO` metadata currently unreliable; dynamic similarity scoring is used as runtime fallback.
- Similarity model is currently deterministic audio-feature scoring (`v3-audio-only`) on read path, not persisted graph retrieval.
- Text/hybrid similarity edges are removed from active runtime and scripts; audio is the only basis.

## Now / Next / Later

### Now (verified current reality)
- Core ingest -> analyze -> browse -> playback loop is implemented and connected.
- Similar retrieval endpoint returns ranked edge metadata.
- Sound map is implemented with interactive UX and atlas API contracts.

### Next (clearly implied by current code/comments)
- Stabilize Helix `SIMILAR_TO` write semantics and migrate map/similar reads to persisted audio graph edges.
- Persist scene assignments (`Scene` + `IN_SCENE`) from atlas rebuild job.
- Add durable background execution model for analysis + rebuild tasks.

### Later (proposed)
- Replace deterministic audio-feature scorer with validated audio-vector retrieval once edge persistence is stable.
- Add scene adjacency/collision layers on top of current atlas graph.
- Add observability around atlas build latency, failure reasons, and stale-snapshot age.

## Notes
- This state reflects actual code/runtime behavior as of 2026-02-17, including dynamic fallback choices made to keep similarity and map UX functional while Helix edge writes are unstable.
