# Deterministic Icon System: Blobtoon Covers (v1)

Last verified: 2026-04-05
Status: implemented

## Current implementation notes
- Blobtoon covers are live in the app and served from `GET /api/cover/blobtoon/[trackId].svg`
- Active seed behavior is:
  1. `Track.file_hash` when available
  2. fallback derived from `trackId`
- The generated-cover system should be treated as current platform behavior, not just a design proposal

## Goal
Implement a deterministic “Blobtoon” cover generator so every track has a unique, consistent album-cover-style icon **without storing images in the database**. Covers must be fast to generate, safe under load, and cacheable.

Primary output format is **SVG** (vector). PNG is optional later.

---

## Non-negotiables (must follow)

### Determinism
- Same seed + same version + same size => identical SVG output.
- Seed must be stable. Preferred seed order:
1) `track.file_hash` when available
2) fallback: `track.id`
3) avoid user-string-derived seed fallback unless the server path changes

### Storage
- Do **not** store image binaries in HelixDB.
- Optional DB fields (only if needed):
  - `cover_style: "blobtoon"` (enum)
  - `cover_version: int` (default 1)
  - `cover_seed: string` (only if seed is not always track.id)

### Performance & memory safety
- SVG generation must be **pure string building**, no large buffers, no heavy deps.
- Keep SVG small (target < 10–20 KB).
- No unbounded in-memory caching on server.
- Rely on HTTP caching:
  - `Cache-Control: public, max-age=31536000, immutable`
  - stable `ETag` derived from `seed|version|size`
- Avoid per-request heavy crypto if it becomes hot. If SHA already exists, reuse it.

### Security
- Never interpolate user-provided strings into SVG unescaped.
- API accepts track id only; seed is derived server-side.
- Set:
  - `Content-Type: image/svg+xml; charset=utf-8`
  - `X-Content-Type-Options: nosniff`

---

## Product behavior

### Endpoints
Implement:
- `GET /api/cover/blobtoon/[trackId].svg`
  - Returns deterministic SVG cover for that track.

Optional convenience:
- `GET /api/cover/[trackId]`
  - Redirects to `/api/cover/blobtoon/[trackId].svg` (or returns same).

(Do not implement PNG in v1 unless already required.)

### UI integration
All places that show cover art should use:
- `getCoverUrl(trackId, { v: 1, s?: number }) => /api/cover/blobtoon/${trackId}.svg?v=1&s=...`

Use sane sizes by context:
- list rows: 64–96
- compact widgets: 48–64
- hero/detail: 300–600

Maintain 1:1 aspect ratio and avoid layout shift.

---

## Blobtoon style grammar (SVG primitives only)

### Inputs
- `seed: string`
- `opts: { size: number; version: number }` where `version=1` default

### Outputs
- SVG markup string (standalone, no external assets)
- (optional) small metadata for debugging

### Components
1) **Background**
   - solid or gradient
   - optional subtle pattern (dots/stripes) using a small number of elements

2) **Main blob body**
   - Generate a blob path by sampling N points around a circle with seeded jitter.
   - Use a smooth curve (quadratic/cubic) to connect points.
   - Variation knobs (seeded):
     - N = 6–12
     - jitter amplitude
     - rotation
     - fill color
     - optional outline stroke

3) **Face**
   - Eyes: 3–6 variants (circles, ovals, sleepy arcs)
   - Mouth: 4–6 variants (smile arc, neutral line, “o”, grin)
   - Optional cheeks/blush (two tiny circles)

4) **Accessory (0–1)**
   - Primitive-only options (no images):
     - headphones
     - cap
     - star
     - lightning bolt
     - music note

5) **Accents (0–3)**
   - sparkles/dots around character

### Palette system
- Derive 3–6 colors using seeded HSL.
- Enforce contrast:
  - if blob and bg are too close in lightness, shift blob lightness or bg lightness.
- Keep line colors readable.

### SVG requirements
- `<svg viewBox="0 0 SIZE SIZE" width/height optional>`
- No heavy filters. If shadow used, keep minimal and deterministic.
- Must render correctly in light/dark UI.

---

## Versioning & cache busting
- Set constant `COVER_VERSION = 1`.
- URLs must include `?v=1` so bumping version invalidates caches.
- If version changes in the future, keep backward compatibility by switching algorithm based on `v`.

---

## Testing requirements
Add lightweight tests:
1) Determinism: same inputs => same output / same ETag.
2) Variation: different seeds => different output (at least path or palette differs).
3) Valid SVG sanity: contains `<svg`, no `NaN`, no `undefined`.
4) (Optional) micro perf sanity: generate 100–1000 covers without runaway memory.

---

## Dev preview (recommended)
Add a simple internal page (e.g. `/dev/covers`) that shows:
- grid of blobtoon covers for recent track IDs + some random seeds
- helps iterate on aesthetics quickly

---

## Done criteria
- Blobtoon SVG endpoint exists, fast, cacheable, secure.
- UI uses it everywhere covers are shown.
- Tests pass.
- No binary image storage added.
