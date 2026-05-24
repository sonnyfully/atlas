import { getAtlasMapV1 } from "@/lib/atlas-v1";
import { rebuildCanonicalAtlasBuild } from "@/lib/canonical-build";

const ATLAS_REFRESH_DEBOUNCE_MS = 15000;

let scheduledRefresh: NodeJS.Timeout | null = null;

export async function refreshAtlasSnapshot(): Promise<void> {
  await rebuildCanonicalAtlasBuild();
  await getAtlasMapV1({ forceRebuild: true });
}

export function scheduleAtlasRefresh(delayMs = ATLAS_REFRESH_DEBOUNCE_MS): void {
  if (scheduledRefresh) {
    clearTimeout(scheduledRefresh);
  }

  scheduledRefresh = setTimeout(() => {
    scheduledRefresh = null;
    refreshAtlasSnapshot().catch((err) => {
      console.error("Scheduled atlas refresh failed:", err);
    });
  }, delayMs);
}
