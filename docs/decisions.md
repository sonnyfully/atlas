# Decision Log

Last verified: 2026-04-05

## ADR-001
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Run web UI and API in one Next.js App Router app (`apps/web`) with route handlers under `app/api`
- Rationale: Shared type/runtime context and fast iteration
- Consequences: Analysis and atlas rebuild run in the same web process lifecycle
- Follow-ups: Revisit split if operational isolation is needed

## ADR-002
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Use HelixDB as source of truth for track metadata / vectors / graph entities
- Rationale: Existing read/write helpers and scripts are Helix-native
- Consequences: Local dev requires Helix availability for ingest and read APIs
- Follow-ups: Improve failure surfacing and retry strategy

## ADR-003
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Store uploaded audio on local disk (`data/uploads`) with absolute `Track.filepath`
- Rationale: Simple local durability and direct streaming via `/api/audio/[id]`
- Consequences: Host filesystem constraints apply
- Follow-ups: Optional object storage migration for production

## ADR-004
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Enforce idempotent upload by SHA-256 hash (`Track.file_hash`)
- Rationale: Duplicate uploads should return the same track identity
- Consequences: Exact-byte dedupe only
- Follow-ups: Consider fuzzy / metadata dedupe separately

## ADR-005
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Keep analysis async fire-and-forget from the ingest route
- Rationale: Low ingest latency and simple local architecture
- Consequences: In-flight work can be lost on process restart
- Follow-ups: Add a durable queue / worker when reliability requirements increase

## ADR-006
- Date: 2026-02 (approx)
- Status: accepted (schema + query path)
- Decision: Keep `SIMILAR_TO` edge support in Helix schema / queries, but do not treat persisted edge writes as production-stable yet
- Rationale: The product needs a graph shape in Helix, but current runtime behavior is still more reliable with computed reads
- Consequences: Live reads cannot assume `SIMILAR_TO` persistence is canonical
- Follow-ups: Stabilize write semantics and re-enable persisted similarity as the primary truth path

## ADR-007
- Date: 2026-02-17
- Status: accepted
- Decision: Upgrade similarity read API contract to edge-enriched results
- Rationale: UI and map require ranking metadata; plain `Track[]` is insufficient
- Consequences: `/api/tracks/[id]/similar` returns `{ source_id, results: [{ track, score, basis, model_version, updated_at }] }`
- Follow-ups: Keep helper ergonomics simple for UI call sites

## ADR-008
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Keep client polling for track completion (`2s`) on the detail page
- Rationale: No websocket / SSE dependency is required for v1
- Consequences: Small periodic request overhead
- Follow-ups: Revisit if polling load grows

## ADR-009
- Date: 2026-02 (approx)
- Status: accepted
- Decision: Audio embedding in Node currently targets the CLAP path with limited decode support
- Rationale: CLAP is the chosen local audio embedding model, but Node decode support is constrained
- Consequences: Non-WAV uploads may reduce similarity quality until decode support broadens
- Follow-ups: Expand decode coverage for MP3 / M4A / FLAC

## ADR-010
- Date: 2026-02-17
- Status: accepted (active runtime behavior)
- Decision: Serve similar-track and map-edge behavior from deterministic audio-feature scoring while persisted graph writes remain unstable
- Rationale: Keep the product functional with reliable reads before graph persistence is ready
- Consequences:
  - Similarity and atlas graph semantics remain deterministic when graph truth is sparse
  - Live analysis can still recover through fallback behavior when persisted graph data is incomplete
- Follow-ups: Replace the fallback with persisted graph retrieval once edge writes are stable

## ADR-011
- Date: 2026-02-18
- Status: accepted
- Decision: Adopt a desktop-first command-bar + rich-list + queue-context layout for Discover without adding dashboard-style hero modules
- Rationale: Improve content hierarchy and interaction density while preserving existing routes/actions
- Consequences:
  - Discover header is a command bar with status affordances and direct Atlas actions
  - Track rows expose quick actions on hover
  - Queue context is rendered inline on the home surface
- Follow-ups:
  - Keep tightening the handoff between DNA, scenes, and map

## ADR-012
- Date: 2026-02-18
- Status: accepted
- Decision: Ship Atlas planet-skim v1 via `GET /api/atlas/map?v=1` and migrate `/map` to a React Three Fiber implementation
- Rationale: v1 needs toroidal wrap, scene-graph truth surfaces, better visual headroom, and a stable cache contract
- Consequences:
  - Backend materializes stable map payloads keyed by `world.version_hash`
  - Frontend map uses the v1 payload as its primary source of truth
  - Scene-to-scene arcs are the only edge layer in v1
- Follow-ups:
  - Validate the 2,000-track performance envelope
  - Persist scene assignments once graph semantics are stable

## ADR-013
- Date: 2026-04-05
- Status: accepted
- Decision: Treat atlas v1 (`/api/atlas/map?v=1`) as the only supported product map surface
- Rationale: The v1 contract and 3D UI now carry the main product behavior, and the legacy atlas stack no longer adds distinct value
- Consequences:
  - Core docs should describe atlas v1 only
  - Legacy atlas runtime/routes should be removed rather than maintained in parallel
- Follow-ups: Keep the presentation/operator scripts aligned to atlas v1 only
