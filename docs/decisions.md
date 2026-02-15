# Decision Log

Last verified: 2026-02-15

## ADR-001
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Run web UI and API in one Next.js App Router app (`apps/web`) with route handlers under `app/api`.
- Rationale: Current code keeps ingest/read endpoints and page rendering in one deployable unit.
- Consequences: Faster iteration and shared types; analysis work shares web process lifecycle.
- Follow-ups: Confirm if/when API should be split into `apps/api` (folder exists but no active service code).

## ADR-002
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Use HelixDB as source of truth for track metadata + vectors + similarity graph (`db/schema.hx`, `db/queries.hx`).
- Rationale: Code reads/writes through `helix-ts` named queries and MCP traversal helpers.
- Consequences: Graph+vector retrieval is centralized; app behavior depends on local Helix availability.
- Follow-ups: Keep query contracts versioned when changing payload fields.

## ADR-003
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Store uploaded audio files on local disk (`data/uploads`) and persist absolute filepath in `Track.filepath`.
- Rationale: `POST /api/ingest` writes bytes directly with `fs/promises.writeFile` and `GET /api/audio/[id]` streams from that path.
- Consequences: Simple local setup; file durability/scaling tied to host filesystem.
- Follow-ups: Decide if production target remains local disk or moves to object storage.

## ADR-004
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Enforce idempotent upload by SHA-256 file hash before writing new track rows.
- Rationale: Ingest computes hash of raw bytes and checks for existing `Track.file_hash` match.
- Consequences: Re-uploads return existing track id/status and avoid duplicate track/file creation.
- Follow-ups: Confirm whether dedupe scope should remain exact-byte only.

## ADR-005
- Date: 2026-02 (approx)
- Status: implicit
- Decision: Run analysis asynchronously via fire-and-forget call from ingest handler, without queue/broker.
- Rationale: `analyzeTrack(...).catch(...)` is launched and not awaited in route handler.
- Consequences: Low latency ingest response; in-flight analysis can be lost on process restart/crash.
- Follow-ups: Confirm if reliability requirements require a durable queue/worker.

## ADR-006
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Build similarity from hybrid embeddings with weighted rank merge (text 0.4, audio 0.6).
- Rationale: `apps/web/lib/analyze.ts` computes text and optional audio neighbors, merges by rank, writes `SIMILAR_TO` edges with basis/model version.
- Consequences: Similarity quality can improve with audio signal; pipeline falls back to text-only when audio embedding fails.
- Follow-ups: Validate and tune weights against real retrieval quality.

## ADR-007
- Date: 2026-02 (approx)
- Status: implicit
- Decision: Keep similarity read contract as track list only, not edge metadata.
- Rationale: `GetSimilarTracks` returns outbound track nodes; API returns `{ results: Track[] }`.
- Consequences: UI cannot display confidence score, basis, or model version despite those being stored on edges.
- Follow-ups: Confirm expected API contract and possibly add edge-enriched response type.

## ADR-008
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Use client polling for analysis completion on track page (2s interval).
- Rationale: `TrackStatusPoller` repeatedly fetches `GET /api/tracks/[id]` and refreshes when status reaches `READY`/`ERROR`.
- Consequences: Simple state convergence without websocket infra; adds periodic request load.
- Follow-ups: Revisit SSE/websocket if status traffic grows.

## ADR-009
- Date: 2026-02 (approx)
- Status: implicit
- Decision: Audio embedding implementation in Node currently supports WAV decoding path for CLAP input.
- Rationale: `generateAudioEmbedding()` decodes WAV PCM manually and throws for unsupported formats.
- Consequences: Non-WAV uploads may still complete analysis but similarity may be text-only.
- Follow-ups: Confirm target format support and implement broader audio decode path if required.
