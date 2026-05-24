# Atlas Discover UI — Component Spec (v1)

Last verified: 2026-04-05
Status: active spec with implementation notes

## Current implementation notes
- Implemented today:
  - sidebar navigation
  - command-bar style top area
  - rich clickable track rows
  - queue-based home-side panel
  - sticky global player
  - keyboard shortcuts for search / playback
- Partially implemented:
  - likes are local UI state only
  - responsive collapse behavior described below is not yet the fully hardened evaluation focus
- Use this document as a product / UX spec, not as a claim that every future-facing behavior below is already complete

## Goals
- **Primary action is play**: clicking anywhere on a track row plays it.
- **Single source of truth for Now Playing**: list highlight, right rail, and bottom player always match.
- **Premium feel**: consistent spacing, alignment, and states; no raw technical errors shown to users.
- **Keyboard-first**: fast navigation and search.
- **Accessible**: focus states, aria-labels, and **≥44×44** hit targets for controls.

---

## IA / Layout

### `DiscoverPage`
**Regions**
- `SidebarNav` (left)
- `TopBar` (top)
- `TrackTable` (main content)
- `QueuePanel` (secondary content)
- `GlobalPlayer` (sticky bottom)

**Responsive**
- `< 1024px`: Queue panel collapses away and the page stays focused on the main story.
- `< 768px`: Sidebar becomes icon-only + drawer.

**Page States**
- `loading`: skeleton rows and placeholder player
- `empty`: “No uploads yet” + primary CTA to upload
- `ready`: normal view
- `error`: friendly message + retry action (no raw stack traces)

---

## Top Navigation

### `TopBar`
**Elements**
- Search input: placeholder `Search tracks...`
- Upload button
- Optional processing indicator (small badge/dot) when background analysis jobs exist

**Keyboard**
- `/` focuses search
- `Esc` clears/defocuses search
- When search dropdown open:
  - `↑/↓` moves selection
  - `Enter` plays selected
  - `Cmd/Ctrl+Enter` opens details (optional)

**Search States**
- `idle`
- `searching` (debounced)
- `results` (dropdown list)
- `noResults`

---

## Sidebar

### `SidebarNav`
**Items**
- Discover (Home)
- Upload
- Explore
- Library
- Likes

**Behavior**
- Highlights current route
- Collapsed mode shows tooltips on hover/focus

---

## Track List

### Data Model (UI-facing)
```ts
type Track = {
  id: string
  title: string
  artist?: string
  durationSec?: number
  bpm?: number
  coverUrl?: string
  audioUrl?: string
  liked?: boolean
  status?: "uploading" | "processing" | "ready" | "failed"
  waveform?: { peaks?: number[] } // optional
}

TrackTable

Props
	•	tracks: Track[]
	•	nowPlayingTrackId?: string
	•	queueIds?: string[]
	•	Callbacks:
	•	onPlay(trackId: string)
	•	onToggleLike(trackId: string)
	•	onOpenMenu(trackId: string)
	•	onAddToQueue(trackId: string)

Layout
	•	Header: Recent Uploads
	•	Rows: TrackRow (virtualize if > ~200 rows)

Sorting (v1)
	•	Default: most recent first
	•	Optional toggle slots (v2): Recent, BPM, Duration, Similarity

Empty State
	•	Title: No uploads yet
	•	Body: Upload a track to start building its DNA.
	•	CTA: Upload

⸻

TrackRow

Clickable Area
	•	Entire row is clickable → play track.
	•	Buttons inside row must not trigger row click (stop propagation).

Default Row Content
	•	Left cluster: index + cover + (title + artist)
	•	Metadata: BPM as a subtle pill near title (e.g., 136 BPM)
	•	Right cluster: duration + actions (Like + More)
	•	Waveform:
	•	Only show on hover or when active/playing, OR only show when data exists.
	•	Do not let waveform dominate the row in default state.

Row Visual States
	1.	default
	•	Actions hidden until hover/focus (desktop); always visible on touch
	2.	hover
	•	Show play overlay on cover
	•	Reveal actions (Like / More)
	•	Optionally reveal WaveformMini if available
	3.	focused (keyboard)
	•	Visible focus ring on row and on icon buttons
	4.	playing (Now Playing)
	•	Left accent bar
	•	Subtle background tint
	•	Title emphasized
	•	Play overlay becomes equalizer/playing indicator
	5.	loading (buffering)
	•	Spinner at play position
	6.	disabled/not-ready
	•	If audioUrl missing or status !== "ready", show badge:
	•	Uploading, Processing, or Not ready
	•	Row click behavior:
	•	If processing/uploading: do not attempt playback; optionally open details/toast: Track is still processing.
	•	If failed: show Failed badge + Retry in menu

Interaction Rules
	•	Single click:
	•	If not current track: play selected track
	•	If current track: toggle play/pause
	•	Double click (optional):
	•	Opens TrackDetailDrawer(trackId)
	•	Context menu / More (“…”):
	•	Add to queue
	•	View DNA card
	•	Find collisions / similar
	•	Copy link
	•	Delete (if owner; optional)

Accessibility
	•	Row is button or role="button" with:
	•	aria-pressed when it is the current track
	•	Clear focus ring
	•	Icon buttons:
	•	aria-label for play/pause, like, more
	•	Hit area ≥44×44
	•	Text truncation:
	•	Title truncates with ellipsis; tooltip on hover/focus

⸻

WaveformMini (optional v1)

Purpose
	•	Visual affordance; not primary UI.

Rules
	•	Render only if waveform exists OR show lightweight placeholder bars.
	•	Scrubbing (if any) only enabled when:
	•	Track is current AND
	•	Audio is ready/loaded.

⸻

Secondary Queue Panel (avoid duplication)

QueuePanel

Pick one primary mode for v1 (recommended: Queue).

Mode A: QueuePanel (recommended v1)
	•	Shows:
	•	Now Playing
	•	Up Next queue
	•	History (optional)
	•	Interactions:
	•	Click item to play
	•	Remove from queue (optional v1)
	•	Drag reorder (v2)

Mode B: InsightsPanel (alt v1)
	•	Cards:
	•	Top collisions
	•	Recent scenes
	•	Processing status

Must not
	•	Duplicate Recent Uploads with a second mini-list that behaves differently.

⸻

Global Player

GlobalPlayer (sticky bottom)

Elements
	•	Left: cover + title + artist (click opens details)
	•	Center: prev, play/pause, next + timeline scrub
	•	Right: volume + mute
	•	Optional: like button

States
	•	empty: Select a track to play
	•	loading: buffering indicator
	•	playing / paused
	•	error: friendly message + retry action

Critical Rule
	•	Never show raw technical messages (e.g., “Audio not supported”) in UI.
	•	Replace with UX-safe messages:
	•	Playback unavailable + Try again
	•	Track still processing
	•	Log technical details only in console/telemetry.

Keyboard Shortcuts (v1 baseline)
	•	Space: play/pause
	•	←/→: seek (small step)
	•	Shift+←/→: previous/next
	•	M: mute
	•	/: focus search (TopBar)

⸻

Upload & Processing UX

UploadFlow

Steps
	1.	Select file
	2.	Upload progress
	3.	Processing job state
	4.	Ready state

Track Status Badges
	•	Uploading
	•	Processing
	•	Ready
	•	Failed (tap for details + retry)

List integration
	•	Uploading/processing tracks appear at top with correct badges and disabled playback behavior.

⸻

Quality Bar (definition of “done”)
	•	Whole-row click-to-play works and matches Now Playing highlight + player.
	•	No raw errors leaked to user; friendly empty/loading/error states everywhere.
	•	Keyboard navigation works (search focus, play/pause, seeking).
	•	Icon buttons have ≥44×44 hit areas and aria-labels.
	•	Right rail provides non-duplicative value (Queue or Insights).
	•	Spacing/alignment consistent; no clipped text; truncation + tooltips.
