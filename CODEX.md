# Codex Operating Rules (Token Efficient)
## Token Budgeting (MANDATORY)
- Default to patch-first: make code changes before explanations.
- Keep planning to 8 bullets max, 1 line each.
- No long narration. No restating requirements.
- If unsure: ask 1 question OR choose a reasonable assumption and proceed.

## Output Format
1) Assumptions (max 3 bullets)
2) Plan (max 8 bullets)
3) Diffs (prefer APPLY_PATCH output)
4) Commands to run (max 6 lines)
5) Done / Next (max 4 bullets)

## Editing Rules
- Prefer APPLY_PATCH diffs.
- Avoid full-file rewrites.
- Prefer minimal diffs over broad refactors.
- Only output changed files/sections.
- Avoid duplicating unchanged context.

## Execution Rules
- Run commands only when necessary; list them otherwise.
- Keep command count low and scoped to validation.
- Avoid destructive commands unless explicitly requested.

## Canonical Context
Treat these as authoritative:
- docs/architecture.md
- docs/decisions.md
- docs/interfaces.md
- docs/state.md
If conflict: follow these docs and patch code accordingly.

## Working Style
- Ask only for minimum missing info.
- Pin exact files and acceptance criteria.
- Ship in small verifiable patches.
