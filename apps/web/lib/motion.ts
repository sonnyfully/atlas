export const DURATION_FAST = 140;
export const DURATION_MED = 240;
export const DURATION_MAP = 360;

export const EASE_STANDARD = "cubic-bezier(0.2, 0, 0, 1)";
export const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
export const EASE_SPRING = "cubic-bezier(0.22, 1, 0.36, 1)";

export const TRANSITION_INTERACTIVE =
  "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-fast ease-out motion-reduce:transition-none";

export const TRANSITION_PANEL =
  "transition-[background-color,border-color,box-shadow,transform,opacity] duration-medium ease-standard motion-reduce:transition-none";

export const TRANSITION_OPACITY =
  "transition-opacity duration-fast ease-out motion-reduce:transition-none";
