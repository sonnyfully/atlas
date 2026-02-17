import assert from "node:assert/strict";
import test from "node:test";
import {
  BLOBTOON_VERSION,
  clampCoverSize,
  generateBlobtoonSvg,
  hashToSeed,
  seedFromTrackIdentity,
} from "./blobtoon";
import { getCoverUrl } from "./covers";

test("blobtoon generation is deterministic for same seed/version/size", () => {
  const seed = seedFromTrackIdentity("atlas-test-track", "f0e1d2c3b4a5968778695a4bc3d2e1f0");
  const a = generateBlobtoonSvg({ seed, version: BLOBTOON_VERSION, size: 300 });
  const b = generateBlobtoonSvg({ seed, version: BLOBTOON_VERSION, size: 300 });
  assert.equal(a, b);
});

test("blobtoon generation varies across distinct seeds", () => {
  const a = generateBlobtoonSvg({
    seed: hashToSeed("atlas-seed-A"),
    version: BLOBTOON_VERSION,
    size: 300,
  });
  const b = generateBlobtoonSvg({
    seed: hashToSeed("atlas-seed-B"),
    version: BLOBTOON_VERSION,
    size: 300,
  });
  assert.notEqual(a, b);
});

test("blobtoon SVG output is sane and compact", () => {
  const dangerousTrackId = `"</script><script>alert(1)</script>`;
  const seed = seedFromTrackIdentity(dangerousTrackId);
  const svg = generateBlobtoonSvg({ seed, version: BLOBTOON_VERSION, size: 512 });

  assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
  assert.ok(svg.length < 20_000);
  assert.ok(!svg.includes(dangerousTrackId));
  assert.ok(!/<(?:script|foreignObject|image)\b/i.test(svg));
});

test("cover URL helper clamps size and includes version", () => {
  const url = getCoverUrl("track-123", { v: 3, s: 99999 });
  assert.equal(url, "/api/cover/blobtoon/track-123.svg?v=3&s=1024");
  assert.equal(clampCoverSize(12), 64);
});
