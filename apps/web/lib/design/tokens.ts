/**
 * Design tokens for non-Tailwind contexts (canvas rendering, JS animations,
 * inline styles, third-party lib configuration).
 *
 * For Tailwind usage, prefer the CSS variables in globals.css and the
 * utility classes configured in tailwind.config.ts.
 */

// ---------------------------------------------------------------------------
// Spacing (base unit: 4px)
// ---------------------------------------------------------------------------
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export const layout = {
  maxContentWidth: 1280,
  sidebarWidth: 240,
  miniPlayerHeight: 64,
  pageGutter: 32,
  pageGutterMobile: 16,
} as const;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------
export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Transition durations (ms)
// ---------------------------------------------------------------------------
export const duration = {
  fast: 50,
  normal: 150,
  slow: 200,
  tooltip: 300,
} as const;

// ---------------------------------------------------------------------------
// Easing curves
// ---------------------------------------------------------------------------
export const easing = {
  default: "cubic-bezier(0.4, 0, 0.2, 1)", // ease
  out: "cubic-bezier(0, 0, 0.2, 1)",        // ease-out
  in: "cubic-bezier(0.4, 0, 1, 1)",         // ease-in
} as const;

// ---------------------------------------------------------------------------
// Colors (hex values for canvas / non-CSS contexts)
// ---------------------------------------------------------------------------
export const colors = {
  background: "#ffffff",
  foreground: "#121212",
  muted: "#f5f5f5",
  mutedForeground: "#737373",
  border: "#e6e6e6",
  primary: "#ff5500",
  primaryForeground: "#ffffff",
  secondary: "#f5f5f5",
  secondaryForeground: "#262626",
  destructive: "#ef4444",
  success: "#22c55e",
  warning: "#f59e0b",
} as const;

// ---------------------------------------------------------------------------
// Waveform-specific tokens
// ---------------------------------------------------------------------------
export const waveform = {
  barWidth: 2,
  barGap: 1,
  height: 64,
  unplayedOpacity: 0.4,
  playheadWidth: 2,
} as const;

// ---------------------------------------------------------------------------
// Z-index layers
// ---------------------------------------------------------------------------
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  miniPlayer: 50,
  toast: 60,
} as const;
