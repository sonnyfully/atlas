/**
 * Acceptance tests for search + browse endpoints.
 *
 * Prerequisites:
 *   bash scripts/init_db.sh && pnpm seed && pnpm dev:web
 *
 * Run:
 *   pnpm tsx scripts/test_search.ts
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

interface Track {
  id: string;
  title: string;
  artist: string;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

async function testSearch() {
  console.log("\n--- Search Tests ---\n");

  // Test 1: search "midnight" → 1 result containing "Midnight"
  {
    const res = await fetch(`${BASE}/api/tracks/search?q=midnight`);
    assert(res.ok, "GET /api/tracks/search?q=midnight returns 200");
    const data = await res.json();
    const results: Track[] = data.results ?? [];
    assert(results.length >= 1, `"midnight" returns at least 1 result (got ${results.length})`);
    const hasMidnight = results.some((t) =>
      t.title.toLowerCase().includes("midnight")
    );
    assert(hasMidnight, 'Results contain a track with "Midnight" in title');
  }

  // Test 2: search "neon" → 2 results (both by Neon Pulse)
  {
    const res = await fetch(`${BASE}/api/tracks/search?q=neon`);
    assert(res.ok, "GET /api/tracks/search?q=neon returns 200");
    const data = await res.json();
    const results: Track[] = data.results ?? [];
    assert(results.length >= 2, `"neon" returns at least 2 results (got ${results.length})`);
  }

  // Test 3: search nonexistent → 0 results
  {
    const res = await fetch(`${BASE}/api/tracks/search?q=xyznothing`);
    assert(res.ok, "GET /api/tracks/search?q=xyznothing returns 200");
    const data = await res.json();
    const results: Track[] = data.results ?? [];
    assert(results.length === 0, `"xyznothing" returns 0 results (got ${results.length})`);
  }

  // Test 4: missing q param → 400
  {
    const res = await fetch(`${BASE}/api/tracks/search`);
    assert(res.status === 400, "Missing q param returns 400");
  }
}

async function testBrowse() {
  console.log("\n--- Browse Tests ---\n");

  // Test 5: alphabetical sort with limit
  {
    const res = await fetch(`${BASE}/api/tracks?sort=alpha&limit=3`);
    assert(res.ok, "GET /api/tracks?sort=alpha&limit=3 returns 200");
    const tracks: Track[] = await res.json();
    assert(tracks.length <= 3, `Alpha limit=3 returns at most 3 (got ${tracks.length})`);
    if (tracks.length >= 2) {
      const sorted = tracks.every((t, i) =>
        i === 0 || t.title.toLowerCase() >= tracks[i - 1].title.toLowerCase()
      );
      assert(sorted, "Results are in alphabetical order");
    }
  }

  // Test 6: default browse returns tracks
  {
    const res = await fetch(`${BASE}/api/tracks`);
    assert(res.ok, "GET /api/tracks returns 200");
    const tracks: Track[] = await res.json();
    assert(tracks.length > 0, `Default browse returns tracks (got ${tracks.length})`);
  }
}

async function main() {
  console.log(`Testing against ${BASE}\n`);

  try {
    await testSearch();
    await testBrowse();
  } catch (err) {
    console.error("\nTest runner error:", err);
    failed++;
  }

  console.log(`\n=============================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`=============================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
