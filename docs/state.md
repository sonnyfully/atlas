# State

Last verified: 2026-02-15

## Truth Snapshot

### Working
- Upload ingestion: `POST /api/ingest` validates MIME/extension/size, deduplicates by SHA-256, stores file on disk, creates `Track` node, triggers analysis.
- Track browse/read APIs:
  - `GET /api/tracks` (default recent list, or paginated/sorted via `sort|offset|limit`)
  - `GET /api/tracks/[id]`
  - `GET /api/tracks/search?q=...&limit=...`
- Audio playback API: `GET /api/audio/[id]` serves full or range-based stream for `READY` tracks.
- Analysis pipeline (`apps/web/lib/analyze.ts`): metadata extraction + text embedding + audio embedding (best effort) + similarity edge writes + status transitions.
- Helix persistence paths in use:
  - named queries: `AddTrack`, `GetTrack`, `UpdateTrackAnalysis`, `UpdateTrackError`, `AddTrackEmbedding`, `AddAudioEmbedding`, `FindNeighbors`, `FindAudioNeighbors`, `AddSimilarEdge`, `GetSimilarTracks`
  - MCP traversal endpoints used for list/search/filter/sort flows.
- Frontend pages are wired to real data: `/`, `/upload`, `/tracks`, `/track/[id]`.
- Client polling for async completion: `TrackStatusPoller` refreshes track page every 2s until terminal state.

### Partial
- Similarity retrieval endpoint (`GET /api/tracks/[id]/similar`) returns only track nodes; edge metadata (`score`, `basis`, `model_version`) is stored but not returned.
- Audio-embedding coverage depends on file format support in Node CLAP path (WAV decode implemented). When audio embedding fails, text-only similarity still proceeds.
- Error handling in Helix read helpers often returns empty/null fallbacks, which keeps UI stable but obscures outage details.

### Stubbed
- Map/scene product surface:
  - `/map` route is a placeholder message.
  - `apps/web/components/map/sound-map.tsx` and `apps/web/components/map/scene-sheet.tsx` return `null`.
  - `Scene` and `IN_SCENE` schema exist but are not used by app routes.

### Broken
- None verified as hard-broken in source.
- Caveat: analysis is fire-and-forget in the web process; if the process dies, in-flight analysis is lost (operational reliability gap, not compile-time breakage).

## Invariants And Verification

### Invariants
- `Track.status` lifecycle is `PENDING -> PROCESSING -> READY` or `ERROR`.
- Duplicate upload detection is based on `Track.file_hash` SHA-256 of file bytes.
- `GET /api/audio/[id]` must reject non-READY tracks (`422`) and missing files (`404`).
- Playback queue only includes `READY` tracks (`TrackList` filters before calling `setQueue`).
- Similarity edges are directed `SIMILAR_TO` from analyzed track to neighbors.

### Verify with commands
```bash
bash scripts/init_db.sh
pnpm seed
pnpm smoke-test
pnpm dev:web
pnpm tsx scripts/test_search.ts
bash scripts/test_upload.sh data/seed_audio/midnight_drive.wav
```

### Verify manually
- Open `http://localhost:3000/upload`, upload an audio file, then open `/track/<id>`.
- Confirm status badge transitions from `Analyzing...` to `READY` (or `ERROR`).
- Start playback and verify browser requests `/api/audio/<id>` and seek works.
- Use home search input and confirm `/api/tracks/search` results render.

## Known Gaps / Tech Debt
- No durable background queue; analysis runs in-process from API route call site.
- Similarity read path drops edge scores/basis despite writing them.
- `/map` and scene graph UX are not implemented even though scene schema exists.
- `scripts/compute_similarities.ts` is text-only and diverges from hybrid analyze pipeline behavior.
- Some scripts/docs still reflect older assumptions and should be treated as historical unless they match current routes/query usage.

## Now / Next / Later

### Now (verified current reality)
- Core ingest -> analyze -> browse -> playback loop is implemented and connected.
- Hybrid similarity write path exists in analyze pipeline and seed/backfill scripts.

### Next (clearly implied by current code/comments)
- Implement real scene/map experience (commented placeholders in map components).
- Decide and implement similarity API contract for edge metadata exposure.
- Choose durable async execution model for analysis.

### Later (proposed)
- Consolidate or retire legacy text-only similarity tooling to avoid drift.
- Tighten Helix error surfacing/observability instead of silent empty fallbacks.

## Notes
- No open-issues tracker or actionable source TODO/FIXME markers were found in this repo snapshot; Next/Later items above are inferred from placeholder comments and code-path mismatches.
