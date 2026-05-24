# Atlas Completion Roadmap

**Date:** April 10, 2026
**Goal:** finish Atlas around a believable Helix-native graph story, not around map polish.

## What “complete” means

Atlas is complete enough to demo when this flow works end-to-end with real persisted graph relationships:

1. Upload a track.
2. Analysis produces usable audio features and embeddings.
3. The canonical build writes graph truth into Helix.
4. The track lands in a real scene.
5. The UI shows similar tracks, adjacent scenes, and collision pairs.
6. The Track DNA card tells the whole story in one place.

## Product priorities

1. Graph truth over visual polish.
2. Real scenes before 3D sophistication.
3. Collision pairs before generalized discovery extras.
4. One excellent DNA card before broad UI expansion.
5. “Real enough” audio intelligence before deeper ML research.

## Current state on April 10, 2026

### Already working
- Upload, analysis lifecycle, and real playback exist.
- `SIMILAR_TO` and `IN_SCENE` are present in schema/query support.
- The canonical atlas build already persists scenes and similar edges.
- `/map` and `GET /api/atlas/map?v=1` already render a meaningful atlas payload.

### Still missing or weak
- Helix does not yet persist `ADJACENT` or `COLLIDES_WITH`.
- Scene adjacency is inferred at payload time instead of stored as graph truth.
- Collision logic exists as map scoring vibes, not as durable pair relationships with reasons.
- Track detail payloads and the current DNA card are too shallow for the demo narrative.
- Analysis still leans on heuristics enough that the backend can feel “fake” under scrutiny.

## North-star architecture

### Core graph relationships
- `Track -[:SIMILAR_TO { score, basis, model_version, build_seq }]-> Track`
- `Track -[:IN_SCENE { membership_score, build_seq }]-> Scene`
- `Scene -[:ADJACENT { score, basis, build_seq }]-> Scene`
- `Track -[:COLLIDES_WITH { score, reasons[], bpm_delta, key_relation, build_seq }]-> Track`

### Core product surfaces
- `GET /api/tracks/:id` returns a demo-ready DNA payload.
- `GET /api/tracks/:id/similar` returns persisted `SIMILAR_TO`.
- `GET /api/tracks/:id/collisions` returns persisted `COLLIDES_WITH`.
- `GET /api/scenes` lists scenes with paging and summary stats.
- `GET /api/scenes/:id` returns scene details, members, centroid context, and adjacent scenes.
- `/track/[id]` becomes the main DNA card story.
- A simple 2D scene explorer exists even if the 3D map remains in place.

## Stage 1: Make the Helix graph story real

**Objective:** the database, not the UI, becomes the source of truth for Atlas relationships.

### Deliverables
- Extend [`db/schema.hx`](/Users/sonnyfullerton/Projects/atlas/db/schema.hx) with:
  - `ADJACENT`
  - `COLLIDES_WITH`
- Extend [`db/queries.hx`](/Users/sonnyfullerton/Projects/atlas/db/queries.hx) with:
  - add adjacency edge query
  - add collision edge query
  - read queries for adjacent scenes
  - read queries for track collisions
- Expand shared types in [`packages/shared/index.ts`](/Users/sonnyfullerton/Projects/atlas/packages/shared/index.ts) for:
  - adjacency edge model
  - collision edge model
  - DNA payload model
- Update [`apps/web/lib/helix.ts`](/Users/sonnyfullerton/Projects/atlas/apps/web/lib/helix.ts) so reads prefer persisted graph data over runtime-only derivation.

### Implementation notes
- Keep `SIMILAR_TO` as the candidate neighborhood foundation for both scene adjacency and collisions.
- Tag all graph edges with `build_seq` so a canonical build can be reasoned about as one consistent snapshot.
- Continue allowing temporary fallbacks only when Helix has no active build, not during normal runtime.

### Exit criteria
- A single canonical build writes all four relationship types.
- Track, scene, and map APIs can read graph truth directly from Helix.
- Atlas no longer depends on ephemeral-only adjacency/collision derivation for the main demo.

## Stage 2: Make scenes real before the map gets fancier

**Objective:** scenes become first-class product objects with durable assignments, centroids, pages, and neighboring scene edges.

### Deliverables
- Replace the current scene clustering shortcut with a simple but credible clustering pass:
  - first choice: HDBSCAN over vibe/audio embeddings
  - fallback: keep deterministic clustering until HDBSCAN is stable, but write durable outputs with the same interface
- Persist:
  - scene assignment
  - membership score
  - scene centroid
  - adjacent scene edges
- Add scene APIs and pages:
  - `/api/scenes`
  - `/api/scenes/[id]`
  - `/scenes`
  - `/scenes/[id]`
- Ship a clean 2D scene explorer if it lands faster than pushing the 3D atlas further.

### Primary code touchpoints
- [`apps/web/lib/canonical-build.ts`](/Users/sonnyfullerton/Projects/atlas/apps/web/lib/canonical-build.ts)
- [`apps/web/lib/atlas-v1.ts`](/Users/sonnyfullerton/Projects/atlas/apps/web/lib/atlas-v1.ts)
- [`apps/web/lib/atlas-layout.ts`](/Users/sonnyfullerton/Projects/atlas/apps/web/lib/atlas-layout.ts)
- new scene routes under [`apps/web/app/api`](/Users/sonnyfullerton/Projects/atlas/apps/web/app/api)
- new scene pages under [`apps/web/app`](/Users/sonnyfullerton/Projects/atlas/apps/web/app)

### Scene heuristics for first pass
- Use the current embedding/projection stack to assign provisional scene membership.
- Compute centroids from member track positions or embedding means.
- Define adjacency from centroid similarity plus cross-scene edge density.
- Keep stable scene IDs where possible so the UI does not thrash between rebuilds.

### Exit criteria
- Every ready track belongs to exactly one persisted scene for the active build.
- Every scene has a centroid, size, and detail page.
- Adjacent scenes are queryable and rendered without recomputing them in the browser.

## Stage 3: Implement collision pairs as the viral wedge

**Objective:** collision pairs become a durable, explainable recommendation type instead of an inferred badge.

### Deliverables
- Build a collision generation job inside the canonical build:
  - candidate pool from timbre/audio kNN
  - BPM compatibility filter
  - key compatibility filter
  - novelty preference: timbre-close but vibe-not-identical
  - top `N` collisions stored per track
- Persist reasons on `COLLIDES_WITH` edges:
  - `TIMBRE_CLOSE`
  - `VIBE_COMPLEMENT`
  - `BPM_COMPATIBLE`
  - `KEY_COMPATIBLE`
  - `CROSS_SCENE`
- Add:
  - `GET /api/tracks/:id/collisions`
  - collision section on the track page
  - optional collision browse page later if needed

### Suggested scoring formula
- Base score from timbre similarity.
- Penalize nearly identical vibe vectors.
- Bonus for adjacent-scene or cross-scene compatibility.
- Bonus for BPM closeness or half/double-time compatibility.
- Bonus for harmonic compatibility.

### Implementation rule
- Keep the first version deterministic and explainable.
- Prefer obvious reason strings over opaque composite magic.

### Exit criteria
- Every demo-worthy track shows 3-5 sensible collisions.
- Each collision displays short human-readable reasons.
- Collision results are persisted in Helix and survive reloads/rebuild reads.

## Stage 4: Make the Track DNA card absurdly good

**Objective:** the Track DNA card becomes the single best demo artifact in the product.

### Deliverables
- Upgrade the payload behind [`apps/web/app/track/[id]/page.tsx`](/Users/sonnyfullerton/Projects/atlas/apps/web/app/track/[id]/page.tsx).
- Redesign [`apps/web/components/tracks/track-dna.tsx`](/Users/sonnyfullerton/Projects/atlas/apps/web/components/tracks/track-dna.tsx) to show:
  - core features
  - scene assignment
  - nearest scenes
  - similar tracks
  - collision highlights
  - why the track sits where it does
- Add one compact “share this” representation later only after the on-page card is great.

### DNA card sections
- Identity: title, artist, art, duration, playback.
- Core features: BPM, key, energy, loudness/brightness/other top traits.
- Scene home: current scene, membership score, scene descriptor.
- Nearby world: nearest scenes and one-line relationship context.
- Collision lab: top collision pairs and reasons.
- Similarity context: nearest neighbors and what kind of similarity basis was used.

### Exit criteria
- The `/track/[id]` page can carry the full Atlas story without needing the map.
- A first-time viewer can understand “what this track is,” “where it lives,” and “what it collides with” in under 30 seconds.

## Stage 5: Upgrade one layer of analysis so the backend feels real

**Objective:** remove the most obvious “metadata pretending to be music intelligence” failure modes.

### Priority order
1. Keep and highlight real playback.
2. Improve embeddings enough that similarity and scenes feel musically grounded.
3. Improve scene clustering from those embeddings.
4. Improve collisions from the better similarity foundation.
5. Leave search improvements for later.

### Deliverables
- Replace or strengthen the current embedding generation path in [`packages/shared/embeddings.ts`](/Users/sonnyfullerton/Projects/atlas/packages/shared/embeddings.ts) and [`apps/web/lib/analyze.ts`](/Users/sonnyfullerton/Projects/atlas/apps/web/lib/analyze.ts).
- Improve BPM/key extraction:
  - better metadata parsing first
  - real audio estimation second
- Store extra analysis fields only if they directly improve:
  - scene clustering
  - collision ranking
  - DNA explanations

### “Good enough” bar
- Similar neighbors no longer feel random on a 10-track spot check.
- Scene membership is stable enough across rebuilds.
- Collision reasons reference real musical compatibility signals.

## Stage 6: Tighten the demo loop and declare the project complete

**Objective:** finish the product around the story Helix will care about.

### Final deliverables
- End-to-end rebuild command that:
  - ingests tracks
  - analyzes tracks
  - computes embeddings
  - writes graph relationships
  - refreshes scene/collision outputs
- Smoke tests covering:
  - persisted `SIMILAR_TO`
  - persisted `IN_SCENE`
  - persisted `ADJACENT`
  - persisted `COLLIDES_WITH`
  - track page DNA payload
  - scene page payload
  - collision endpoint payload
- Updated docs:
  - architecture
  - demo script
  - Helix graph explanation

### Completion checklist
- Uploading a track eventually places it into a persisted scene.
- The track page shows core traits, scene, nearest scenes, and collisions.
- The scene page shows members and adjacent scenes.
- Similar and collision endpoints return persisted graph relationships.
- The simple 2D or current map experience can browse scenes without faking graph truth.
- The product can be demoed without apologizing for “temporary heuristic placeholders.”

## Recommended execution order

1. Schema and query expansion for `ADJACENT` and `COLLIDES_WITH`.
2. Canonical build writes all graph edges.
3. Scene APIs and pages.
4. Collision endpoint and track-page integration.
5. DNA card redesign.
6. Analysis credibility upgrade.
7. Test and doc pass.

## What to defer until after completion

- More 3D atlas polish.
- Rich social or account systems.
- Personalized library behavior.
- Fancy search across every entity type.
- Export/share mechanics beyond a minimal DNA presentation.
- Clip-level retrieval and pathfinding between scenes.

## Definition of done

Atlas is done when Helix can truthfully demonstrate that the database is performing meaningful relational work across similarity, scene membership, scene adjacency, and collision generation, and the product surfaces that work cleanly through the DNA card, scene pages, and track detail flow.
