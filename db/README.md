# Atlas Database (HelixDB)

This directory is the **source of truth** for all database schema and queries.

## Files

- `helix.toml` — HelixDB project config (MCP enabled)
- `schema.hx` — Node, edge, and vector definitions
- `queries.hx` — Named queries exposed via `#[mcp]` macro
- `seeds/` — Seed data scripts

## Prerequisites

Install the HelixDB CLI:

```bash
curl -sSL https://install.helix-db.com | bash
```

## Running Locally

1. **Deploy to local dev instance:**

```bash
bash scripts/init_db.sh
```

This runs `helix deploy --local dev` which starts HelixDB on `http://localhost:6969`.

2. **Seed test data:**

```bash
pnpm seed
```

3. **Run smoke test:**

```bash
pnpm smoke-test
```

## Schema Overview

| Entity | Type | Description |
|--------|------|-------------|
| `Track` | Node | Music track with title, artist, filepath |
| `Scene` | Node | Micro-genre / vibe cluster |
| `Track_Vector` | Vector | 384-dim embedding for a track |
| `HAS_EMBEDDING` | Edge | Track -> Track_Vector |
| `IN_SCENE` | Edge | Track -> Scene |
| `SIMILAR_TO` | Edge | Track -> Track (with score) |

## Query Reference

| Query | Params | Description |
|-------|--------|-------------|
| `AddTrack` | title, artist, filepath | Create a new track node |
| `GetTrack` | id | Retrieve a track by ID |
| `AddScene` | name | Create a new scene node |
| `AddTrackEmbedding` | track_id, embedding | Attach a vector to a track |
| `FindNeighbors` | track_id, k | Vector similarity search |

All queries use the `#[mcp]` macro and should be called via named query through `helix-ts`:

```typescript
import HelixDB from "helix-ts";
const client = new HelixDB("http://localhost:6969");
const track = await client.query("GetTrack", { id: "some-id" });
```

**Important:** Never use ad-hoc/raw query strings in application code. Always call named queries from `queries.hx`.
