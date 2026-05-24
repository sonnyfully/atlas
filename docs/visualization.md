# Atlas 3D Visualization Strategy

Last verified: 2026-04-05
Status: active reference for the atlas v1 rendering path

## Scope
- Primary surface: `/map`
- Primary contract: `GET /api/atlas/map?v=1`
- Primary UI: `apps/web/components/map/atlas-map-v1.tsx`

## Rendering strategy
- Node counts up to roughly `~2000` render with `InstancedMesh` spheres for low draw calls and stronger silhouettes
- Node counts above that threshold, or lower quality modes, can switch to `THREE.Points`
- Instanced interaction uses `instanceId` picking; points mode uses point-index raycast hits

## Surface and depth cues
- The map surface is a curved planet-skim patch rather than a flat scatterplot
- Fog / haze provide depth separation
- Scene aura blobs provide continent-like structure
- Scene graph arcs are the only explicit edge layer in v1

## Postprocessing policy
- `high`: SSAO + selective bloom
- `med`: SSAO only
- `low`: no postprocessing
- Adaptive DPR is used to reduce cost on weaker devices

## Quality tuning knobs
- `use-quality.ts` drives:
  - mode selection
  - DPR bounds
  - effect enablement
  - instanced vs points rendering

## Current evaluation notes
- The visualization strategy is implemented enough for product evaluation
- The remaining open question is not the rendering model itself, but scale verification at the upper end of the target dataset range
- Legacy 2D atlas components remain in the repo, but this document describes the active atlas v1 path only
