# Audit Notes
- Audit date: 2026-02-15
- Scope: verified code paths in `/Users/sonnyfullerton/Projects/atlas/apps/web`, `/Users/sonnyfullerton/Projects/atlas/packages/shared`, `/Users/sonnyfullerton/Projects/atlas/db`, `/Users/sonnyfullerton/Projects/atlas/scripts`.

## Verified findings
- Frontend routes implemented: `/`, `/upload`, `/tracks`, `/track/[id]`, `/map`.
- API routes implemented: `POST /api/ingest`, `GET /api/tracks`, `GET /api/tracks/[id]`, `GET /api/tracks/[id]/similar`, `GET /api/tracks/search`, `GET /api/audio/[id]`.
- Upload flow is real and idempotent by SHA-256 file hash (`findTrackByHash`) before writing `data/uploads`.
- Audio files are stored on local disk at `data/uploads` (resolved from `apps/web/app/api/ingest/route.ts`).
- Analysis is triggered in-process from ingest (`analyzeTrack(...)`) and not queued/durable.
- Analysis pipeline is real: metadata parse (`music-metadata`), feature extraction heuristics (BPM/key/energy), text embeddings (`Xenova/all-MiniLM-L6-v2`), audio embeddings (`Xenova/clap-htsat-unfused`), and `SIMILAR_TO` edge writes.
- Helix schema actively used: `Track`, `Track_Vector`, `Audio_Vector`, `HAS_EMBEDDING`, `HAS_AUDIO_EMBEDDING`, `SIMILAR_TO`.
- Similarity retrieval endpoint currently returns track nodes only (`{ results: Track[] }`) without edge `score/basis/model_version`.
- UI polling behavior exists: track detail page polls `/api/tracks/[id]` every 2s until status is `READY` or `ERROR`.
- Playback uses real browser audio streaming through `/api/audio/[id]` with HTTP range support.
- `/map` page and map components are placeholders; scene schema exists but scene UX is not implemented.
- There are no actionable TODO/FIXME markers in source code outside docs.

## Ambiguities / decisions needed
- Similarity API shape: should `/api/tracks/[id]/similar` include edge metadata (`score`, `basis`, `model_version`) or stay as plain tracks?
- Async analysis reliability: keep in-process fire-and-forget, or move to a durable queue/worker.
- Audio embedding support: CLAP path currently supports WAV decoding in Node; non-WAV uploads fall back to text-only similarity.
- Legacy script overlap: `scripts/compute_similarities.ts` is text-only while ingest/analyze path is hybrid; decide whether to keep, update, or deprecate.
