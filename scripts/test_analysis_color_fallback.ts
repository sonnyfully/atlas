import { analysisToColor } from "../apps/web/lib/atlas-color";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function hex(color: { getHexString: () => string }): string {
  return color.getHexString();
}

function run() {
  const empty = {} as Record<string, number | string>;
  const a1 = analysisToColor(empty, "track-alpha");
  const a2 = analysisToColor(empty, "track-alpha");
  const b1 = analysisToColor(empty, "track-beta");
  const rich = analysisToColor(
    {
      energy: 0.78,
      complexity: 0.62,
      brightness: 0.55,
      loudness: 0.81,
      mood_x: 0.4,
      mood_y: -0.2,
    },
    "track-alpha"
  );

  assert(hex(a1) === hex(a2), "Fallback color must be deterministic for same track id");
  assert(hex(a1) !== hex(b1), "Fallback color should vary across different track ids");
  assert(hex(rich).length === 6, "Color should be a valid RGB hex");

  console.log("analysisToColor fallback checks passed");
}

run();
