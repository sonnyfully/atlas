import type { TrackDnaResponse } from "@atlas/shared";

export interface TrackRouteResponse {
  status: number;
  body: TrackDnaResponse | { error: string };
}

export async function resolveTrackRoute(args: {
  id: string;
  getTrackDna: (trackId: string) => Promise<TrackDnaResponse | null>;
}): Promise<TrackRouteResponse> {
  const { id, getTrackDna } = args;

  try {
    const dna = await getTrackDna(id);
    if (!dna) {
      return {
        status: 404,
        body: { error: "Track not found" },
      };
    }

    return {
      status: 200,
      body: dna,
    };
  } catch (err) {
    console.error(`Failed to fetch track ${id}:`, err);
    return {
      status: 500,
      body: { error: "Failed to fetch track" },
    };
  }
}
