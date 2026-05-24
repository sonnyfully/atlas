# Scene Accent + Surface Tuning

Last verified: 2026-04-05
Status: active implementation reference

This is the quick reference for adjusting the new global visual system in the Atlas web app.

## Primary tweak points

- Accent generation logic:
  - File: `apps/web/lib/colors.ts`
  - Adjust these constants:
    - `BRAND_GUARD_BAND` (distance from CTA orange hue)
    - `baseHue` mapping range (`24 + (hash % 312)`)
    - saturation range clamp (`52–68`)
    - lightness range clamp (`42–56`)
- Surface depth + shadows:
  - File: `apps/web/app/globals.css`
  - Adjust:
    - `--surface-0`, `--surface-1`, `--surface-2`
    - `--shadow-surface`, `--shadow-surface-hover`
    - `.surface-panel-interactive:hover` bloom strength and border alpha
- Motion timing + easing:
  - File: `apps/web/lib/motion.ts`
  - Adjust:
    - `DURATION_FAST`, `DURATION_MED`, `DURATION_MAP`
    - `EASE_STANDARD`, `EASE_OUT`, `EASE_SPRING`
    - transition helper classes (`TRANSITION_INTERACTIVE`, `TRANSITION_PANEL`)
- Tailwind utility mapping:
  - File: `apps/web/tailwind.config.ts`
  - Keep this in sync when adding/removing:
    - `colors.scene`, `colors.surface.*`
    - `boxShadow.surface`, `boxShadow.surface-hover`, `boxShadow.scene-bloom`
    - `transitionDuration.fast|medium|map`
    - `transitionTimingFunction.standard|out|spring`

## Rules to preserve

- Brand orange (`--primary`) remains the main CTA color.
- Scene accent is secondary only:
  - allowed: borders, glows, chips, selected backgrounds, waveform fill
  - disallowed: body text tint
- Keep reduced-motion support intact (`prefers-reduced-motion` block in `apps/web/app/globals.css`).
