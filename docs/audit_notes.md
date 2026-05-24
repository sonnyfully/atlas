# Audit Notes

- Audit date: 2026-04-05
- Scope: verified code paths in `/Users/sonnyfullerton/Projects/atlas/apps/web`, `/Users/sonnyfullerton/Projects/atlas/packages/shared`, `/Users/sonnyfullerton/Projects/atlas/db`, `/Users/sonnyfullerton/Projects/atlas/scripts`
- Status: current evaluation snapshot

## Verified findings
- Frontend routes implemented:
  - `/`
  - `/upload`
  - `/tracks`
  - `/track/[id]`
  - `/map`
- API routes implemented:
  - `POST /api/ingest`
  - `GET /api/tracks`
  - `GET /api/tracks/[id]`
  - `GET /api/tracks/[id]/similar`
  - `GET /api/tracks/[id]/collisions`
  - `GET /api/tracks/search`
  - `GET /api/scenes`
  - `GET /api/scenes/[id]`
  - `GET /api/audio/[id]`
  - `GET /api/cover/blobtoon/[trackId].svg`
  - `GET /api/atlas/map?v=1`
- Upload flow is real and idempotent by SHA-256 file hash before writing `data/uploads`
- Audio files are stored on local disk at `data/uploads`
- Analysis is triggered in-process from ingest and is not durable
- Analysis pipeline is real:
  - metadata parse via `music-metadata`
  - heuristic BPM / key / energy derivation
  - best-effort CLAP audio embeddings
  - `READY` / `ERROR` terminal states
- Playback uses real browser audio streaming through `/api/audio/[id]` with HTTP range support
- Atlas v1 is implemented and is the primary map surface:
  - stable `world.version_hash`
  - deterministic projection
  - persisted scenes
  - scene graph edges
  - provenance / bridge / collision metadata
- Similarity retrieval is implemented, with persisted graph truth preferred over fallback behavior when available

## Key conclusions
- The platform is beyond prototype stage and functions as a real local-first alpha
- The product is strongest today on:
  - ingest
  - browse
  - playback
  - map exploration
- The main missing piece is durable graph truth and durable background execution, not UI completeness
- The main missing piece is durable background execution, not a second map stack

## Remaining risks
- In-process analysis / rebuild lifecycle is still the main operational risk
- Search intentionally remains narrower than a broader discovery product
- Local verification is environment-sensitive because the dev dependency install state is not always guaranteed

## Recommended evaluation framing
- Stage: functional alpha / internal evaluation build
- Not yet: production-hardened platform
- Ready for:
  - product evaluation
  - UX iteration
  - architecture hardening
- Not ready for:
  - reliability-sensitive deployment
  - claiming durable graph persistence as complete
