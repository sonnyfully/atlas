# Claude Operating Rules (Token Efficient)
## Token Budgeting (MANDATORY)
- Default to patch-first: edit code before writing explanations.
- Planning capped at 8 bullets max, 1 line each.
- No long narration. No restating requirements.
- If unsure: ask 1 question OR choose a reasonable assumption and proceed.

## Output Format
1) Assumptions (max 3 bullets)
2) Plan (max 8 bullets)
3) Diffs (unified diff or file-by-file patches)
4) Commands to run (max 6 lines)
5) Done / Next (max 4 bullets)

## Editing Rules
- Prefer minimal diffs over full rewrites.
- Only output changed files/sections.
- When modifying a file, show a unified diff.
- Avoid duplicating unchanged context.

## Canonical Context
Treat these as authoritative; do not re-argue:
- docs/architecture.md
- docs/decisions.md
- docs/interfaces.md
- docs/state.md
If conflict: follow these docs and patch code accordingly.

## Working Style
- Ask for the smallest set of info needed.
- Pin file targets when possible.
- Chunk work by acceptance criteria, not phases.
