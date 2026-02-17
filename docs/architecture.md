# Architecture

Last verified: 2026-02-17

## Component Map
- `/Users/sonnyfullerton/Projects/atlas/apps/web/app`
  - App Router pages: `/`, `/upload`, `/tracks`, `/track/[id]`, `/map`
  - API routes: `app/api/*` including map endpoints and deterministic Blobtoon covers (`/api/cover/blobtoon/[trackId].svg`)
- `/Users/sonnyfullerton/Projects/atlas/apps/web/components`
  - `tracks/*`: list/hero/DNA/similar/status polling
  - `player/*`: sticky mini player
  - `map/*`: interactive atlas graph, filters, pin card
- `/Users/sonnyfullerton/Projects/atlas/apps/web/lib`
  - `helix.ts`: Helix data helpers and similarity retrieval/scoring
  - `analyze.ts`: async ingest analysis pipeline
  - `atlas.ts`: atlas graph build/rebuild/snapshot scheduling
  - `blobtoon.ts`: deterministic seeded SVG cover generator (PRNG, palette, shape composition, size clamping)
  - `covers.ts`: cover URL helper for UI consumers
  - `player-context.tsx`: client audio/queue state
- `/Users/sonnyfullerton/Projects/atlas/packages/shared`
  - shared DTOs (`Track`, similarity/map payload types)
  - embedding generation (`embeddings.ts`)
- `/Users/sonnyfullerton/Projects/atlas/db`
  - `schema.hx`, `queries.hx` (named Helix queries)
- `/Users/sonnyfullerton/Projects/atlas/scripts`
  - init/seed/smoke/upload/backfill utilities

## Runtime Topology
```text
[Next.js UI]
   |
   v
[Route Handlers + Server Components]
   | \
   |  \--> [apps/web/lib/atlas.ts]
   |          - build atlas graph
   |          - cache snapshot (data/atlas/latest.json)
   |
   +----> [apps/web/lib/analyze.ts] (fire-and-forget async)
   |          - metadata + embeddings
   |          - status transitions
   |          - schedule atlas rebuild
   |
   +----> [HelixDB :6969]
   |
   +----> [Local disk data/uploads + data/atlas]
```

## Key Flows

### 1) Ingest
- `/upload` posts multipart file to `POST /api/ingest`.
- Ingest validates MIME/ext/size, checks duplicate hash, verifies Helix availability.
- New files are written under `data/uploads`, `Track` node is created with `PENDING`, and analysis starts asynchronously.

### 2) Analyze
- `analyzeTrack()` parses metadata and writes `PROCESSING` analysis fields.
- Generates audio embedding and audio-neighbor candidates.
- Writes `READY` on success or `ERROR` on failure.
- Schedules debounced atlas rebuild after successful completion.

### 3) Similar Retrieval
- `GET /api/tracks/[id]/similar` returns enriched ranked results:
  - `{ source_id, results: [{ track, score, basis, model_version, updated_at }] }`
- Similar ranking is served through the app data layer with deterministic audio-feature scoring on READY tracks (`v3-audio-only`) while persisted edge writes are unstable.

### 4) Atlas Map
- `GET /api/map/atlas` returns atlas payload (`nodes`, `edges`, `scenes`, `meta`).
- `POST /api/map/rebuild` forces rebuild.
- `/map` client renders:
  - pan/zoom graph,
  - gradient audio edges with opacity/width by score,
  - tempo/view filters,
  - single-click floating pin card,
  - double-click navigation to `/track/[id]`.

### 5) Blobtoon Covers
- UI requests cover URLs through `getCoverUrl(trackId, { v, s })`.
- `GET /api/cover/blobtoon/[trackId].svg`:
  - normalizes route id (`.svg` suffix),
  - derives deterministic seed from `Track.file_hash` fallback `trackId`,
  - clamps requested size,
  - emits SVG with immutable cache headers + `X-Content-Type-Options: nosniff`,
  - computes stable ETag from `seed|version|size` and serves `304` when possible.
- Cover fallbacks remain color placeholders in UI if image load fails.

## Contracts
- Canonical DTOs live in `packages/shared/index.ts`.
- API contract summaries live in `docs/interfaces.md`.

## Boundaries
- UI does not write directly to Helix.
- Write paths:
  - ingest route (track creation),
  - analyze pipeline (analysis + embeddings),
  - scripts (seed/backfill/smoke).
- Read orchestration for map/similar is centralized in `apps/web/lib/helix.ts` and `apps/web/lib/atlas.ts`.
