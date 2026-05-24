# Historical Handoff: Phase C2 Audio Embeddings

Status: historical handoff document  
Last contextualized: 2026-04-05

## Why this file still exists
- This file captured an intermediate handoff during the transition toward real audio embeddings
- It no longer describes the current runtime behavior accurately enough to serve as a status doc

## Important differences from current reality
- The current runtime does not use the older hybrid text+audio similarity path described here as its active truth model
- Live similarity reads currently rely on deterministic audio-feature scoring fallback
- `SIMILAR_TO` persistence is not yet the canonical runtime path
- Atlas v1 and the broader platform have progressed beyond the scope of this handoff

## Still-useful historical takeaways
- CLAP was the chosen audio-embedding direction
- Schema support for `Audio_Vector` and `HAS_AUDIO_EMBEDDING` was established here
- The project’s retrieval direction clearly moved toward audio-first semantics

## Use instead for current reality
- `/Users/sonnyfullerton/Projects/atlas/docs/state.md`
- `/Users/sonnyfullerton/Projects/atlas/docs/architecture.md`
- `/Users/sonnyfullerton/Projects/atlas/docs/interfaces.md`
- `/Users/sonnyfullerton/Projects/atlas/docs/decisions.md`
