import { HelixDB } from "helix-ts";
import { TEXT_EMBEDDING_VERSION } from "../packages/shared/embeddings";

const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";

interface TrackWithEmbedding {
    id: string;
    title: string;
    embedding: number[];
}

async function computeSimilarities() {
    const client = new HelixDB(HELIX_URL);

    console.log("Computing similarities for all tracks...\n");

    // 1. Fetch all READY tracks via MCP traversal
    const connId = await mcpPost("mcp/init", {});
    await mcpPost("mcp/n_from_type", {
        connection_id: connId,
        data: { node_type: "Track" },
    });
    await mcpPost("mcp/filter_items", {
        connection_id: connId,
        data: {
            properties: [{ key: "status", operation: "==", value: "READY" }],
        },
    });
    const tracks = await mcpPost("mcp/collect", {
        connection_id: connId,
        data: {},
    });

    const trackList = Array.isArray(tracks) ? tracks : [];
    console.log(`Found ${trackList.length} READY tracks\n`);

    // 2. For each track, get its embedding
    const tracksWithEmbeddings: TrackWithEmbedding[] = [];
    for (const track of trackList) {
        const embConnId = await mcpPost("mcp/init", {});
        await mcpPost("mcp/n_from_id", {
            connection_id: embConnId,
            data: { id: track.id },
        });
        await mcpPost("mcp/out_step", {
            connection_id: embConnId,
            data: { edge_type: "HAS_EMBEDDING" },
        });
        const vectors = await mcpPost("mcp/collect", {
            connection_id: embConnId,
            data: {},
        });

        const vectorList = Array.isArray(vectors) ? vectors : [];
        if (vectorList.length > 0) {
            const vectorNode = vectorList[0] as any;
            // The vector node has an 'embedding' property according to schema
            const embedding = vectorNode?.embedding || vectorNode?.vector;
            if (embedding && Array.isArray(embedding) && embedding.length > 0) {
                tracksWithEmbeddings.push({
                    id: track.id,
                    title: track.title,
                    embedding: embedding,
                });
            } else {
                console.log(`  Warning: No embedding found for "${track.title}"`);
            }
        }
    }

    console.log(`Retrieved ${tracksWithEmbeddings.length} embeddings\n`);

    // 3. For each track, find neighbors and write SIMILAR_TO edges
    let edgeCount = 0;
    for (const track of tracksWithEmbeddings) {
        const neighbors = await client.query("FindNeighbors", {
            embedding: track.embedding,
            k: 10,
        });

        const neighborList = Array.isArray(neighbors) ? neighbors : [];

        for (let i = 0; i < neighborList.length; i++) {
            const neighbor = neighborList[i] as any;
            if (neighbor.id !== track.id) {
                // Rank-based scoring: rank 0 → 1.0, rank 9 → 0.1
                const score = 1.0 - (i / 10);

                await client.query("AddSimilarEdge", {
                    from_id: track.id,
                    to_id: neighbor.id,
                    score,
                    basis: "text",
                    model_version: TEXT_EMBEDDING_VERSION,
                });
                edgeCount++;
            }
        }
        console.log(`  Computed similarities for "${track.title}" (${neighborList.length - 1} edges)`);
    }

    console.log(`\nCreated ${edgeCount} SIMILAR_TO edges.`);
}

async function mcpPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${HELIX_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return text.replace(/"/g, "");
    }
}

computeSimilarities().catch((err) => {
    console.error("Similarity computation failed:", err);
    process.exit(1);
});
