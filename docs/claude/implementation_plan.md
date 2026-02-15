# Implementation Plan - Atlas (Steps 1 & 2)

This plan covers the initialization of the Atlas monorepo and the foundational "Helix-native" database setup.

## 1. Objectives
- **Monorepo Setup**: Establish a clean `pnpm` workspace structure for web, api, and database components.
- **HelixDB Initialization**: Get a local HelixDB instance running with a valid configuration.
- **Canonical Schema**: Create `/db/schema.hx` with the minimal entities (`Track`, `Scene`) and edges.
- **Canonical Queries**: Create `/db/queries.hx` with 2-3 essential queries (e.g., `AddTrack`, `GetTrack`, `FindSimilar`).
- **SDK Connection**: Verify connectivity using `helix-ts` from a simple script.
- **MCP Workflow**: Establish a workflow for the agent to use Helix MCP for query development.

## 2. Assumptions & Non-goals
- **Assumptions**:
  - `helix-ts` is available via npm.
  - HelixDB binary is installed or easily downloadable.
  - We are building for local-first development initially (running DB on localhost).
- **Non-goals**:
  - No frontend UI work in this step.
  - No full audio ingestion pipeline (just a placeholder/script to add a test track).
  - No generated embeddings (we will use mock vectors for testing).
  - No advanced clustering (HDBSCAN) yet.

## 3. Repo Structure Plan
We will use a standard Turborepo-style structure (even if not using Turbo explicitly yet, just strict folders).

```text
/
├── apps/
│   ├── web/                 # Next.js frontend (scaffold only)
│   └── api/                 # API server (future)
├── packages/
│   └── shared/              # Shared types/utils
├── db/                      # THE SOURCE OF TRUTH
│   ├── schema.hx            # DDL: N, E, V definitions
│   ├── queries.hx           # DML: Stored queries / functions
│   ├── helix.toml           # DB config
│   ├── seeds/               # Seed data scripts
│   └── README.md            # "How to run DB"
├── scripts/                 # Dev utilities
│   ├── init_db.sh           # Setup script
│   └── seed_db.ts           # TS seed script
├── package.json             # Root workspace config
└── pnpm-workspace.yaml
```

**Ownership:**
- **DB Agent**: Owns `/db` entirely.
- **API Agent**: Owns `apps/api` and consumes `helix-ts`.

## 4. HelixDB Initialization Plan
1.  **Install & Config**:
    -   Create `db/helix.toml` with `mcp = true` (crucial for MCP features).
    -   Ensure HelixDB is running on default port (likely 6969).
2.  **Schema Definition (`/db/schema.hx`)**:
    -   `V::Track_Vector`: The embedding vector for a track.
    -   `N::Track`: `id`, `title`, `artist`, `filepath`.
    -   `N::Scene`: `id`, `name`.
    -   `E::IN_SCENE`: Connects Track -> Scene.
    -   `E::SIMILAR_TO`: Connects Track -> Track (optional for step 1, but good to have).
3.  **Query Definition (`/db/queries.hx`)**:
    -   Use the `#[mcp]` macro for all queries to make them agent-accessible.
    -   `AddTrack(title, artist) -> Track`
    -   `GetTrack(id) -> Track`
    -   `FindNeighbors(track_id) -> [Track]` (vector search placeholder)

## 5. MCP Usage Plan
**Crucial:** The implementation agent must use the Helix MCP server to "try before you commit".

1.  **Start Helix MCP**: The agent should ensure the Helix MCP server is running (or provided via the user's environment).
2.  **Interactive Scratchpad**:
    -   Instead of guessing HelixQL syntax, use the `mcp/schema_resource` tool to inspect the current state.
    -   Use `mcp/init` + `mcp/n_from_type` to verify data exists.
    -   **Validation**: Start a restricted task to specific write a "test query" using `helix-ts` in a temporary file. Run it. If it works, *then* formalize it into `db/queries.hx`.
3.  **Guardrails**:
    -   **NO** ad-hoc queries in `apps/api` code (e.g., `client.query("RAW QUERY STRING")`).
    -   **ALWAYS** call named queries defined in `queries.hx` (e.g., `client.query("GetTrack", { ... })`).
4.  **Reference Docs**:
    -   `helix/docs/mcp/mcp_macro.md`: For how to write `#[mcp]` queries.
    -   `helix/docs/helix_ts_sdk.md`: For how to call them from TS.

## 6. Acceptance Checks
- [ ] **Repo exists**: Directories created, `pnpm install` works.
- [ ] **DB Running**: `helix-db` process is active.
- [ ] **Schema Applied**: `schema.hx` loaded without errors.
- [ ] **Queries Loaded**: `queries.hx` loaded, and `mcp/schema_resource` shows the new queries.
- [ ] **Smoke Test**: A script `scripts/smoke_test.ts` runs successfully:
    -   Connects to DB.
    -   Calls `AddTrack`.
    -   Calls `GetTrack`.
    -   Logs output.

## 7. Risks & Decision Points
-   **Vector Dimensions**: We need to pick a default dimension for `Track_Vector` even if we don't have the model yet. **Decision**: Default to **384** (common for efficient small models like `all-MiniLM-L6-v2`) or **1536** (OpenAI). *Recommendation: 384 for local performance.*
-   **Helix Version**: Ensure the installed binary matches the docs syntax.
-   **Env Vars**: Need `HELIX_URL` in `.env`.
