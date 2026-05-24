# Architecture

Last verified: 2026-04-12

## Summary
- Atlas is now organized around one presentation flow:
  - upload a track
  - analyze real audio into persisted track features and embeddings
  - run the canonical build
  - read back persisted similarity, scene membership, scene adjacency, and collisions
  - present that graph truth through Track DNA, Scene pages, and the Atlas map
- `Track DNA` is the hero surface.
- `Scenes` and `Map` are supporting proof surfaces.

## Runtime Topology
```text
[Next.js App Router]
   |
   +--> /api/ingest
   |      -> create Track
   |      -> write file to data/uploads
   |      -> kick off analyzeTrack()
   |
   +--> analyzeTrack()
   |      -> metadata + audio feature extraction
   |      -> audio embedding generation
   |      -> persisted track analysis update
   |      -> schedule canonical rebuild + atlas snapshot refresh
   |
   +--> rebuildCanonicalAtlasBuild()
   |      -> persisted SIMILAR_TO
   |      -> persisted IN_SCENE
   |      -> persisted ADJACENT
   |      -> persisted COLLIDES_WITH
   |
   +--> helix.ts read layer
   |      -> Track DNA
   |      -> similar tracks
   |      -> collisions
   |      -> scenes and scene members
   |
   +--> atlas-v1.ts
          -> read active persisted build
          -> build /api/atlas/map?v=1 payload
          -> cache payload by world.version_hash
```

## Product Surfaces
- `/`
  - atlas overview
  - ready/analyzing/build summary
  - quick links to upload, latest DNA, scenes, and map
- `/upload`
  - live ingest flow
  - per-file lifecycle states from upload to ready DNA
- `/track/[id]`
  - canonical Track DNA narrative
  - placement summary, scene home, nearby scenes, collisions, similar tracks
- `/scenes` and `/scenes/[id]`
  - persisted scene directory and detail proof pages
- `/map`
  - supporting atlas visualization using persisted scene graph data

## Core Read/Write Boundaries
- Write paths:
  - `POST /api/ingest`
  - `apps/web/lib/analyze.ts`
  - `apps/web/lib/canonical-build.ts`
  - operator scripts under `scripts/`
- Read paths:
  - `apps/web/lib/helix.ts` for Track/Scene/DNA truth
  - `apps/web/lib/atlas-v1.ts` for map payload generation
- Important rule:
  - product read routes should not rely on hidden rebuild side effects during normal product usage

## Presentation Commands
- `pnpm atlas:prep`
  - canonical operator prep command
  - ingest seed audio, wait for analysis, run canonical rebuild, refresh atlas outputs, print suggested URLs
- `pnpm atlas:smoke`
  - canonical presenter smoke command
  - verifies DNA, similar, collisions, scenes, and map routes on a running app
- `GET /api/atlas/map?v=1&rebuild=1`
  - manual HTTP fallback for rebuilds
  - keep as a backup path, not the primary operator flow

## Remaining Debt
- Analysis and rebuild jobs are still in-process rather than durable worker jobs
- Search remains intentionally narrow and track-first for the current product scope
