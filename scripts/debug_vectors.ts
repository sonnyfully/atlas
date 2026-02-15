import { HelixDB } from "helix-ts";

const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";

async function testSearchV() {
    const client = new HelixDB(HELIX_URL);

    console.log("=== Testing SearchV Directly ===\n");

    // 1. Create a test track with embedding
    const track = await client.query("AddTrack", {
        title: "Search Test Track",
        artist: "Test Artist",
        filepath: "/test/search.wav",
        original_filename: "search.wav",
        file_hash: "search_hash_456",
        status: "READY",
        upload_date: new Date().toISOString(),
    });

    const trackId = (track as any)?.track?.id ?? (track as any)[0]?.id ?? (track as any).id;
    console.log(`Created track: ${trackId}`);

    // 2. Add embedding
    const embedding1 = new Array(384).fill(0).map(() => Math.random());
    const vecResult = await client.query("AddTrackEmbedding", {
        track_id: trackId,
        embedding: embedding1,
    });
    console.log(`Added embedding, vector ID: ${(vecResult as any)?.vec?.id}\n`);

    // 3. Try to search for neighbors using the SAME embedding
    console.log("Searching for neighbors with the same embedding...");
    const neighbors = await client.query("FindNeighbors", {
        embedding: embedding1,
        k: 5,
    });

    console.log("FindNeighbors result:", JSON.stringify(neighbors).substring(0, 500));
    const neighborList = Array.isArray(neighbors) ? neighbors : [];
    console.log(`\nFound ${neighborList.length} neighbors`);

    if (neighborList.length > 0) {
        console.log("✓ SearchV is working!");
        neighborList.forEach((n: any, i: number) => {
            console.log(`  ${i + 1}. ${n.title} (${n.id})`);
        });
    } else {
        console.log("✗ SearchV returned no results even with exact same embedding");
        console.log("\nThis suggests:");
        console.log("  1. Vector index may need time to build");
        console.log("  2. SearchV may require multiple vectors");
        console.log("  3. There may be a minimum similarity threshold");
    }
}

testSearchV().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
