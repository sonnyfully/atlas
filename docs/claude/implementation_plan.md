# Historical Plan: Atlas Steps 1 & 2

Status: historical planning document  
Last contextualized: 2026-04-05

## Why this file still exists
- This was an early implementation plan for monorepo setup and Helix-native database initialization
- It is useful as project history, but it is not the current source of truth for platform status

## What is now complete relative to this plan
- Monorepo structure exists
- `apps/web`, `packages/shared`, `db`, and `scripts` are in place
- Helix schema and named queries exist
- SDK connectivity / smoke scripting exists

## What diverged from the original plan
- `apps/api` remains a scaffold; the active API lives in `apps/web/app/api`
- The platform progressed far beyond “scaffold only” UI
- Atlas v1 3D map, playback, ingest, and similarity all now exist

## Use instead for current reality
- `/Users/sonnyfullerton/Projects/atlas/docs/state.md`
- `/Users/sonnyfullerton/Projects/atlas/docs/architecture.md`
- `/Users/sonnyfullerton/Projects/atlas/docs/interfaces.md`
- `/Users/sonnyfullerton/Projects/atlas/docs/decisions.md`
