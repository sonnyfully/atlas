# Presentation Runbook

Last verified: 2026-04-12

## Prep

```bash
bash scripts/init_db.sh
pnpm dev:web
pnpm atlas:prep
pnpm atlas:smoke
```

Default app URL: [http://localhost:3000](http://localhost:3000)

## Presenter Flow
1. Open `/`.
2. Point out the active build, ready track count, and quick links.
3. Open the latest READY DNA card.
4. Tell the story from the DNA page:
   - what the track is
   - where it lives
   - what it collides with
5. Open the scene page from the DNA action rail.
6. Show adjacent scenes and a few member tracks.
7. Open the map as supporting proof that the scene graph exists across the library.

## Live Upload Variant
1. Start at `/upload`.
2. Drop a track.
3. Narrate the row stages:
   - uploading
   - analyzing
   - graph pending
   - ready in Atlas
4. Open the DNA card once the row reaches `Ready in Atlas`.
5. If the build is still catching up, pivot back to `/` and open the latest READY DNA from the curated library.

## Fallback Branches
- If a live upload is still `PROCESSING`, pivot to the curated-library flow from `/`.
- If there is no active build yet, run `pnpm atlas:prep` again or use `GET /api/atlas/map?v=1&rebuild=1` as the manual fallback.
- If the map feels sparse, keep the presentation anchored on Track DNA and Scene pages; they are the primary proof surfaces.

## What To Emphasize
- Atlas is not just drawing a map.
- Helix is storing meaningful relationships:
  - similar tracks
  - scene membership
  - scene adjacency
  - collisions
- The presentation is strongest when the presenter stays on the DNA page the longest and uses scenes/map as corroboration.
