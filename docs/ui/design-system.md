# Atlas Design System

Last verified: 2026-04-05
Status: active design reference with some historical language preserved

A lightweight design system for Track Atlas built with Next.js, Tailwind CSS, and shadcn/ui primitives.

## Current implementation notes
- The current web app has moved beyond the earlier mock / SoundCloud-inspired framing
- The most distinctive implemented additions beyond the base system are:
  - scene-derived secondary accents
  - layered surface tokens
  - motion tokens shared across layout / list / map components
- When this document conflicts with current source tokens, the source of truth is:
  - `apps/web/app/globals.css`
  - `apps/web/lib/colors.ts`
  - `apps/web/lib/motion.ts`
  - `apps/web/tailwind.config.ts`

---

## Brand Principles

1. **White space is the stage.** Content breathes. Generous padding, open layouts, never cramped.
2. **Sound has shape.** Waveforms, graphs, and spatial layouts are first-class UI elements, not decoration.
3. **Orange is earned.** The signature accent (`#ff5500`) is reserved for primary actions, active states, and progress — never for backgrounds or large fills.
4. **Quiet confidence.** Soft borders, subtle shadows, neutral grays. The interface recedes so the music stands out.
5. **Legibility over flair.** Clean sans-serif type, high contrast text, generous line-heights.
6. **Density is optional.** Default to spacious; let power users opt into compact views later.
7. **Motion is functional.** Transitions communicate state changes (hover, play, load). No animation for decoration.

### Do / Don't

| Do | Don't |
|----|-------|
| Use orange for primary CTAs and active/progress indicators | Flood the page with orange — it loses impact |
| Keep cards clean with a single subtle border or shadow | Stack multiple shadows or combine borders + shadows on the same element |
| Use system font stack for speed, Inter for polish | Use display/script fonts for body text |
| Rely on whitespace to separate sections | Use thick dividers or background color blocks to create hierarchy |
| Show waveforms as thin, mono-color strips | Use multi-color gradients on waveforms |
| Animate on interaction (hover lift, press scale) | Add entrance animations to every element |
| Use `focus-visible` rings for keyboard nav | Remove or hide focus indicators |
| Keep the mini-player fixed, minimal, and unobtrusive | Let the mini-player dominate viewport height |

---

## Color Palette

All colors are defined as CSS custom properties using the shadcn/ui HSL convention (`h s% l%` — no commas, used as `hsl(var(--token))`).

### Core

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--background` | `0 0% 100%` | `#ffffff` | Page background |
| `--foreground` | `0 0% 7%` | `#121212` | Primary text |
| `--card` | `0 0% 100%` | `#ffffff` | Card background |
| `--card-foreground` | `0 0% 7%` | `#121212` | Card text |
| `--popover` | `0 0% 100%` | `#ffffff` | Popover/dropdown background |
| `--popover-foreground` | `0 0% 7%` | `#121212` | Popover text |

### Surfaces & Borders

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--muted` | `0 0% 96%` | `#f5f5f5` | Muted backgrounds (tags, wells, disabled fills) |
| `--muted-foreground` | `0 0% 45%` | `#737373` | Secondary/placeholder text |
| `--border` | `0 0% 90%` | `#e6e6e6` | Default borders |
| `--input` | `0 0% 90%` | `#e6e6e6` | Input borders |
| `--ring` | `18 100% 50%` | `#ff5500` | Focus ring (orange accent) |

### Accent (Signature Orange)

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--primary` | `18 100% 50%` | `#ff5500` | Primary buttons, active waveform, progress bars |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Text on primary |
| `--accent` | `0 0% 96%` | `#f5f5f5` | Subtle accent backgrounds (hover rows, selected tabs) |
| `--accent-foreground` | `0 0% 7%` | `#121212` | Text on accent background |

### Secondary

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--secondary` | `0 0% 96%` | `#f5f5f5` | Secondary button background |
| `--secondary-foreground` | `0 0% 15%` | `#262626` | Secondary button text |

### Semantic

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--destructive` | `0 84% 60%` | `#ef4444` | Error states, destructive actions |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | Text on destructive |
| `--success` | `142 72% 42%` | `#22c55e` | Success indicators |
| `--warning` | `38 92% 50%` | `#f59e0b` | Warning indicators |

### Chart Colors (for visualizations)

| Token | HSL | Usage |
|-------|-----|-------|
| `--chart-1` | `18 100% 50%` | Primary data (orange) |
| `--chart-2` | `220 70% 55%` | Secondary data (blue) |
| `--chart-3` | `142 72% 42%` | Tertiary data (green) |
| `--chart-4` | `280 65% 60%` | Quaternary data (purple) |
| `--chart-5` | `38 92% 50%` | Quinary data (amber) |

---

## Typography

Font stack: **Inter** for UI, with system fallbacks. Monospace for data/code.

### Font Families

```
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, "Cascadia Code", monospace;
```

### Scale

| Name | Size | Weight | Line-height | Letter-spacing | Usage |
|------|------|--------|-------------|----------------|-------|
| `h1` | 2rem (32px) | 700 | 1.2 | -0.02em | Page titles |
| `h2` | 1.5rem (24px) | 600 | 1.3 | -0.01em | Section headers |
| `h3` | 1.25rem (20px) | 600 | 1.4 | 0 | Card titles, dialog headers |
| `h4` | 1.125rem (18px) | 500 | 1.4 | 0 | Subsection headers |
| `body` | 0.9375rem (15px) | 400 | 1.6 | 0 | Default body text |
| `body-sm` | 0.8125rem (13px) | 400 | 1.5 | 0 | Secondary text, captions |
| `caption` | 0.75rem (12px) | 400 | 1.5 | 0.01em | Labels, timestamps, metadata |
| `mono` | 0.8125rem (13px) | 400 | 1.5 | 0 | BPM, key, data values |

### Weight Rules

- **700 (Bold):** Page titles only.
- **600 (Semibold):** Section headers, card titles, primary button text.
- **500 (Medium):** Navigation items, active tab labels, emphasized body text.
- **400 (Regular):** Everything else.
- Never use weights below 400. Never use italic for UI labels.

---

## Spacing & Layout

### Base Unit

`4px` — all spacing derives from multiples of 4.

### Spacing Scale

| Token | Value | Common use |
|-------|-------|------------|
| `space-1` | 4px | Inline icon gaps |
| `space-2` | 8px | Tight padding (tags, badges) |
| `space-3` | 12px | Input padding-x, compact card padding |
| `space-4` | 16px | Default card padding, form gaps |
| `space-5` | 20px | Section gaps within cards |
| `space-6` | 24px | Card padding (comfortable), gutter between cards |
| `space-8` | 32px | Section separation |
| `space-10` | 40px | Large section separation |
| `space-12` | 48px | Page section breaks |
| `space-16` | 64px | Page top/bottom padding |

### Page Layout

| Property | Value |
|----------|-------|
| Max content width | `1280px` (`max-w-screen-xl`) |
| Page gutter (desktop) | `32px` (padding-x) |
| Page gutter (mobile) | `16px` (padding-x) |
| Sidebar width | `240px` |
| Mini-player height | `64px` |

### Grid

- Use CSS Grid or Flexbox, not a rigid 12-column grid.
- Track lists: single-column, full-width rows.
- Card grids: `auto-fill, minmax(280px, 1fr)` with `24px` gap.
- Scene/atlas views: freeform canvas or force-directed (no grid).

### Vertical Rhythm

- Maintain consistent `24px` spacing between stacked card elements.
- Use `8px` between tightly related elements (label + value, icon + text).
- Use `32px–48px` between page sections.

---

## Radius, Shadow, Border

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.5rem` (8px) | Base radius (shadcn `radius` token) |
| Derived: `radius-sm` | `calc(var(--radius) - 2px)` = 6px | Inputs, tags, badges |
| Derived: `radius-md` | `var(--radius)` = 8px | Cards, dialogs, dropdowns |
| Derived: `radius-lg` | `calc(var(--radius) + 2px)` = 10px | Sheets, large modals |
| `rounded-full` | 9999px | Avatars, play buttons, pills |

### Shadows

| Name | Value | Usage |
|------|-------|-------|
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.04)` | Subtle lift (inputs, tags) |
| `shadow` | `0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)` | Cards, dropdowns |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)` | Elevated cards (hover), popovers |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)` | Dialogs, sheets |

Shadows are intentionally soft and low-opacity. No hard drop shadows.

### Borders

- Default border: `1px solid hsl(var(--border))`.
- Cards: use **either** a border **or** a shadow, not both.
- Prefer shadow for floating elements (popovers, dialogs).
- Prefer border for inline elements (cards in a list, inputs).
- Dividers within cards: `1px solid hsl(var(--border))` with `16px` vertical margin.

---

## Component Styling Guidance (shadcn/ui)

All components use shadcn/ui defaults unless overridden below. These are styling guidelines, not component code.

### Button

| Variant | Background | Text | Border | Notes |
|---------|-----------|------|--------|-------|
| `default` (primary) | `--primary` (#ff5500) | `--primary-foreground` (white) | none | Use sparingly: 1 per view |
| `secondary` | `--secondary` (#f5f5f5) | `--secondary-foreground` | none | Most common button |
| `outline` | transparent | `--foreground` | `--border` | Tertiary actions |
| `ghost` | transparent | `--muted-foreground` | none | Icon buttons, nav items |
| `destructive` | `--destructive` | `--destructive-foreground` | none | Delete, remove |

- **Size:** Default `h-9 px-4`. Small `h-8 px-3 text-[13px]`. Icon-only `h-9 w-9`.
- **Radius:** `radius-sm` (6px).
- **Hover:** Primary darkens 8% (`brightness(0.92)`). Secondary shows border. Ghost shows muted bg.
- **Active:** Scale `0.98` with `50ms` transition.

### Card

- Background: `--card`. Border: `1px solid hsl(var(--border))`.
- Padding: `24px` (`p-6`).
- Radius: `radius-md` (8px).
- No shadow by default. On hover (if interactive): elevate to `shadow-md` with `150ms` transition.
- Header/content/footer sections separated by `16px` gap, not divider lines.

### Tabs

- Use `underline` style, not boxed.
- Inactive tab: `--muted-foreground`, no underline.
- Active tab: `--foreground`, `2px` bottom border in `--primary` (orange).
- Hover (inactive): `--foreground` text color.
- Tab bar bottom border: `1px solid hsl(var(--border))`.

### Slider

- Track: `4px` height, `--muted` background, `rounded-full`.
- Fill: `--primary` (orange).
- Thumb: `16px` circle, white fill, `1px` border `--border`, `shadow-sm`.
- Thumb hover: scale `1.15`.
- Used for: volume, playback scrub, filter ranges.

### Tooltip

- Background: `--foreground` (dark). Text: `--background` (white). Inverted.
- Padding: `6px 12px`. Radius: `radius-sm`. Font: `caption` size.
- Shadow: `shadow-md`. Delay: `300ms` show, `0ms` hide.

### Dialog

- Overlay: `black / 50%` opacity.
- Panel: `--card` background, `shadow-lg`, `radius-lg`.
- Padding: `24px`. Max-width: `480px`.
- Title: `h3` style. Description: `body-sm`, `--muted-foreground`.
- Close button: ghost icon button, top-right.

### Sheet (Slide-over)

- Same surface treatment as Dialog.
- Width: `360px` (right sheet), full-height.
- Enter from right with `200ms` ease-out slide + fade.

### Dropdown Menu

- Background: `--popover`, `shadow-md`, `radius-md`.
- Items: `body-sm` size, `8px 12px` padding.
- Hover: `--accent` background.
- Separator: `1px solid hsl(var(--border))`, `4px` vertical margin.
- Check/radio indicators: `--primary` color.

### Input

- Height: `40px` (`h-10`). Padding: `8px 12px`.
- Border: `1px solid hsl(var(--input))`. Radius: `radius-sm`.
- Focus: border becomes `--primary`, plus `ring-2 ring-ring/20` (orange glow at 20% opacity).
- Placeholder: `--muted-foreground`.
- Disabled: `50%` opacity, `not-allowed` cursor.

---

## Interaction States

### Hover

- Buttons: darken or show border (see Button section).
- Cards (interactive): lift with `shadow-md`, `150ms ease`.
- Links/text buttons: underline or color shift to `--primary`.
- List rows: `--accent` background.

### Active / Pressed

- Buttons: `transform: scale(0.98)`, `50ms`.
- Cards: `transform: scale(0.995)`, `50ms`.

### Focus

- **Focus ring rule:** Use `focus-visible` (keyboard only), never `focus` (would trigger on click).
- Ring: `2px` offset, `--ring` color (orange), `ring-2 ring-ring ring-offset-2 ring-offset-background`.
- Inputs: replace ring with border color change + subtle shadow (see Input section).

### Disabled

- Opacity: `0.5`. Cursor: `not-allowed`.
- No hover or active effects.
- Preserve layout (don't shift or collapse).

### Transitions

| Property | Duration | Easing | Usage |
|----------|----------|--------|-------|
| `color, background-color, border-color` | `150ms` | `ease` | All interactive elements |
| `box-shadow` | `150ms` | `ease` | Card hover lift |
| `transform` | `50ms` | `ease-out` | Press/active scale |
| `opacity` | `200ms` | `ease` | Fade in/out (tooltips, overlays) |
| `transform (slide)` | `200ms` | `ease-out` | Sheets, drawers |

Default transition class: `transition-colors duration-150` for most interactive elements.

---

## SoundCloud-like Patterns

Reference patterns for Track Atlas UI components. These are not implementations — they describe the visual structure and token usage.

### Waveform Strip

```
┌────────────────────────────────────────────────────┐
│ ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇▅▃▂▁▂▃▅▇█▇▅▃ │  <- hsl(var(--muted-foreground)) unplayed
│ ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇▅▃▂▁                               │  <- hsl(var(--primary)) played portion
│  ↑ playhead (2px wide, --primary, full height)      │
└────────────────────────────────────────────────────┘
```

- Container: full-width, `64px` height, `--muted` background, `radius-sm`.
- Bars: vertical, `2px` wide, `1px` gap. Unplayed: `--muted-foreground` at `40%` opacity. Played: `--primary`.
- Playhead: `2px` wide vertical line, `--primary`, full container height.
- Hover: show timestamp tooltip above cursor position.
- Click: seek to position.

### Track Row

```
┌─────────────────────────────────────────────────────────────────┐
│  [▶]  Artwork   Title                 Artist     3:42   ··· │
│  36px  40x40    body/500              body-sm    mono   menu│
│                                       muted-fg          ghost│
└─────────────────────────────────────────────────────────────────┘
```

- Layout: horizontal flex, `align-center`, `12px` gap.
- Height: `56px` minimum. Padding: `8px 16px`.
- Play button: `36px` circle, ghost style, `--muted-foreground` icon. Hover: `--primary` icon.
- Artwork: `40x40`, `radius-sm`, object-fit cover.
- Title: `body` size, `500` weight, truncate with ellipsis.
- Artist: `body-sm`, `--muted-foreground`, truncate.
- Duration: `mono` font, `caption` size, `--muted-foreground`.
- Hover: full row gets `--accent` background.
- Playing state: play icon → pause icon, title color → `--primary`.

### Play Button Cluster

```
     [⏮]  [  ▶  ]  [⏭]
     32px    48px    32px
     ghost  primary  ghost
```

- Center play/pause: `48px` circle, `--primary` background, white icon. Hover: `brightness(0.92)`.
- Prev/next: `32px` circle, ghost, `--muted-foreground` icon. Hover: `--foreground`.
- Gap: `8px` between buttons.

### Sidebar Nav

```
┌──────────────────────┐
│  ATLAS               │  <- h4, --foreground, 700
│                      │
│  ○  Discover         │  <- ghost button, body-sm, 500
│  ○  Library          │
│  ●  Scenes           │  <- active: --primary icon + --foreground text + --accent bg
│  ○  Collision Lab    │
│                      │
│  ─────────────────   │  <- border divider
│                      │
│  YOUR TRACKS         │  <- caption, --muted-foreground, 600, uppercase, tracking-wide
│  ○  Recently Added   │
│  ○  Favorites        │
└──────────────────────┘
```

- Width: `240px`. Background: `--background`. Right border: `1px solid hsl(var(--border))`.
- Items: ghost button style, full-width, left-aligned. `36px` height, `12px` horizontal padding.
- Active item: `--accent` background, `--primary` icon, `--foreground` text.
- Section labels: `caption` size, `--muted-foreground`, `600` weight, `uppercase`, `tracking-wider`.
- Section gap: `24px`. Item gap: `2px`.

### Mini-Player (Fixed Bottom Bar)

```
┌─────────────────────────────────────────────────────────────────┐
│  [⏮][▶][⏭]  Artwork  Title – Artist   ▁▂▃▅▇▅▃▂▁  0:00/3:42  🔊━━━━ │
│                40x40   body   body-sm   waveform    mono       vol    │
└─────────────────────────────────────────────────────────────────┘
```

- Fixed to bottom, full-width, `64px` height.
- Background: `--background`. Top border: `1px solid hsl(var(--border))`.
- Layout: flex, `align-center`, `16px` gap.
- Controls cluster: left side, same as Play Button Cluster but smaller (center button `36px`).
- Waveform: compact inline strip, `48px` height, flexible width.
- Volume: Slider, `80px` wide, right-aligned.
- Z-index: `50`.

---

## Accessibility Notes

- All text meets WCAG 2.1 AA contrast (4.5:1 body, 3:1 large text).
  - `--foreground` on `--background` = `#121212` on `#ffffff` = **17.4:1** ✓
  - `--muted-foreground` on `--background` = `#737373` on `#ffffff` = **4.96:1** ✓
  - `--primary-foreground` on `--primary` = white on `#ff5500` = **4.0:1** — passes for large text (buttons). For small text, use `--foreground` on white instead.
- Focus rings are only shown on `focus-visible` (keyboard navigation).
- Interactive elements have minimum `44px` touch targets on mobile, `32px` on desktop.
- Waveforms and visualizations must not be the sole means of conveying information.
