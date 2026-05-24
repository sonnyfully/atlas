# Helix Graph Explanation

Last verified: 2026-04-12

## Why Helix Matters In Atlas
Atlas is complete enough to present when Helix is doing real relational work, not when the UI looks fancy.

The four relationships that matter are:

## `SIMILAR_TO`
- `Track -> Track`
- Stores nearest-neighbor similarity with score, basis, model version, and build sequence.
- Used to explain local musical neighborhood and drive the similar-tracks part of DNA.

## `IN_SCENE`
- `Track -> Scene`
- Stores persisted scene membership and membership score for the active build.
- Used to explain where a track lives and how confidently Atlas places it there.

## `ADJACENT`
- `Scene -> Scene`
- Stores persisted neighboring-scene edges for the active build.
- Used to explain how scenes border or bleed into each other.

## `COLLIDES_WITH`
- `Track -> Track`
- Stores persisted crossover pairs with score and reason codes.
- Used to explain surprising but plausible pairings, especially across scenes.

## Product Translation
- Track DNA answers:
  - `SIMILAR_TO`
  - `IN_SCENE`
  - `COLLIDES_WITH`
- Scene pages answer:
  - `IN_SCENE`
  - `ADJACENT`
- Map answers:
  - the library has a persisted scene graph, not just projected dots

## Reason Codes To Call Out
- `TIMBRE_CLOSE`
- `VIBE_COMPLEMENT`
- `BPM_COMPATIBLE`
- `KEY_COMPATIBLE`
- `CROSS_SCENE`

Those reasons matter because they let the presenter explain why a collision exists without hand-waving around a black-box score.
