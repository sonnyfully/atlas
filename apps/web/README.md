# @atlas/web

Track Atlas web app: upload, analyze, place, and present tracks through DNA, scenes, and map views in a single Next.js App Router app.

## Quick start

```bash
# from repo root
pnpm install
bash scripts/init_db.sh
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Route | Description |
|-------|-------------|
| `/` | Atlas overview with recent uploads and the next best presenter actions |
| `/upload` | Live ingest flow with per-track lifecycle progress |
| `/tracks` | Browseable catalog view |
| `/track/[id]` | Primary Track DNA story with scene, collisions, and similarity context |
| `/scenes` | Scene directory for the active persisted build |
| `/scenes/[id]` | Scene detail with members and adjacent scenes |
| `/map` | Supporting atlas map backed by `/api/atlas/map?v=1` |

## Active backend behavior

- Real Helix-backed track reads and writes
- Real ingest pipeline via `POST /api/ingest`
- Real audio streaming via `GET /api/audio/[id]`
- Real search via `GET /api/tracks/search`
- Real persisted similar-track API via `GET /api/tracks/[id]/similar`
- Real persisted collision API via `GET /api/tracks/[id]/collisions`
- Real scene APIs via `GET /api/scenes` and `GET /api/scenes/[id]`
- Real atlas v1 API via `GET /api/atlas/map?v=1`
- Deterministic generated covers via `GET /api/cover/blobtoon/[trackId].svg`

## Important current caveats

- Analysis and atlas rebuild work still run in-process
- Atlas prep is best done through the root-level `pnpm atlas:prep` command before presenting
- Optional `ffmpeg` fallback improves decode coverage for MP3/M4A/FLAC during embedding

## Map surface

- `GET /api/atlas/map?v=1` is the only supported map API
- optional manual rebuild fallback: `GET /api/atlas/map?v=1&rebuild=1`
- `components/map/atlas-map-v1.tsx` is the active map surface

## Useful commands

```bash
bash scripts/init_db.sh
pnpm dev:web
pnpm atlas:prep
pnpm atlas:smoke
pnpm smoke-test
pnpm test:atlas-map-v1
pnpm test:atlas-color
bash scripts/test_upload.sh data/seed_audio/midnight_drive.wav
```

## Source of truth docs

- `/Users/sonnyfullerton/Projects/atlas/docs/state.md`
- `/Users/sonnyfullerton/Projects/atlas/docs/architecture.md`
- `/Users/sonnyfullerton/Projects/atlas/docs/interfaces.md`
- `/Users/sonnyfullerton/Projects/atlas/docs/decisions.md`
