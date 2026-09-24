// test/unit/sfx-assets.test.js
//
// Phase 56 (AUD-06)'s asset-side gate — pins the 30 delivered sfx/*.mp3
// clips by set equality (an added, renamed or deleted clip fails this
// before it can ship) and source-scans tools/build-www.mjs to prove the
// copySfx() build wiring from 56-01 Task 1 actually exists, is called after
// copySplash(), and throws loud when sfx/ is missing.
//
// This is an asset-side check ONLY: it asserts the 30 files EXIST and that
// the build copies them. Whether each clip is reachable from the engine
// event -> clip map is plan 56-02's assertion (test/unit/sfx-map.test.js),
// not this file's business — this file has no dependency on the sfx module
// under src/browser/, which does not exist yet in this wave.
//
// User ruling (2026-09-22): enemy-batrat.mp3 was deleted. The 30 one-shot
// clips are all mapped — there is no "unused clip" concept. User ruling
// (2026-09-24, quick task 260924-51h): sfx/ ALSO holds exactly one declared
// music track, theme.mp3 (the title theme), pinned separately as
// EXPECTED_MUSIC — it is never counted among the 30 clips. sfx/ therefore
// holds exactly 30 + 1 files. If either count ever needs to change, that is
// a deliberate asset decision, not drift. This file still never imports
// src/browser/sfx.js — the two pins stay independent.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SFX_DIR = path.join(REPO_ROOT, "sfx");
const BUILD_WWW_PATH = path.join(REPO_ROOT, "tools", "build-www.mjs");

// The 30 delivered one-shot clip basenames (no extension), per the
// 56-CONTEXT.md verified sfx/ inventory and the 2026-09-22 user ruling that
// removed enemy-batrat.
const EXPECTED_CLIPS = Object.freeze([
  "walk1", "walk2", "walk3",
  "walk-water1", "walk-water2", "walk-water3",
  "hit1", "hit2",
  "miss1", "miss2",
  "hurt1", "hurt2", "hurt3",
  "foe-die",
  "enemy-beast", "enemy-demon", "enemy-human", "enemy-undead",
  "spell", "resist", "heal", "drink",
  "chest", "gold", "trap", "jump", "stairs",
  "levelup", "death", "ui-tap",
]);

// User ruling 2026-09-24 (quick task 260924-51h): theme.mp3 is the single
// declared music track (the title theme). It is not a clip and is not part
// of the 30 — it streams as a loop, never fires as a one-shot.
const EXPECTED_MUSIC = Object.freeze(["theme"]);

// ─── (1) EXPECTED_CLIPS shape ───────────────────────────────────────────

test("AUD-06: EXPECTED_CLIPS has exactly 30 entries and no duplicates", () => {
  assert.equal(EXPECTED_CLIPS.length, 30);
  assert.equal(new Set(EXPECTED_CLIPS).size, EXPECTED_CLIPS.length);
});

test("AUD-06: EXPECTED_MUSIC has exactly 1 entry and shares nothing with EXPECTED_CLIPS", () => {
  assert.equal(EXPECTED_MUSIC.length, 1);
  for (const id of EXPECTED_MUSIC) {
    assert.equal(EXPECTED_CLIPS.includes(id), false, `${id} must not also be a clip`);
  }
});

// ─── (2) totality gate — sfx/ matches EXPECTED_CLIPS + EXPECTED_MUSIC ──

test("AUD-06: sfx/ contains exactly the 30 expected clips plus the 1 declared music track (set equality)", () => {
  const actual = readdirSync(SFX_DIR).filter((f) => f.endsWith(".mp3")).sort();
  const expected = [...EXPECTED_CLIPS, ...EXPECTED_MUSIC].map((id) => `${id}.mp3`).sort();
  assert.equal(expected.length, 31);
  assert.deepEqual(actual, expected);
});

// ─── (3) every clip is a real, non-empty file ───────────────────────────

test("AUD-06: every file in sfx/ has a non-zero size", () => {
  for (const file of readdirSync(SFX_DIR)) {
    if (!file.endsWith(".mp3")) continue;
    const size = statSync(path.join(SFX_DIR, file)).size;
    assert.ok(size > 0, `${file} has zero size`);
  }
});

// ─── (4) copySfx() is defined, called after copySplash(), and wired ───

test("AUD-06: tools/build-www.mjs defines copySfx() and calls it after copySplash()", () => {
  const code = readFileSync(BUILD_WWW_PATH, "utf8");
  assert.match(code, /function copySfx\s*\(/, "expected a function copySfx( definition");
  assert.match(code, /copySfx\(\);/, "expected a copySfx(); call");
  assert.match(code, /path\.join\(ROOT,\s*["']sfx["']\)/, "expected path.join(ROOT, \"sfx\") as the source path");
  assert.match(code, /path\.join\(WWW,\s*["']sfx["']\)/, "expected path.join(WWW, \"sfx\") as the destination path");

  const splashCallIdx = code.indexOf("copySplash();");
  const sfxCallIdx = code.indexOf("copySfx();");
  assert.ok(splashCallIdx !== -1, "expected a copySplash(); call to compare against");
  assert.ok(sfxCallIdx > splashCallIdx, "expected copySfx(); to be called after copySplash();");
});

// ─── (5) fail-loud contract — copySfx() throws when sfx/ is missing ────

test("AUD-06: copySfx()'s body guards on existsSync and throws when sfx/ is absent", () => {
  const code = readFileSync(BUILD_WWW_PATH, "utf8");
  const fnStart = code.indexOf("function copySfx(");
  assert.ok(fnStart !== -1, "expected a function copySfx( definition to scan");
  // Isolate the function body: from its definition to the next top-level
  // function declaration (or end of file) so the assertions below can't
  // accidentally match a guard belonging to a different function.
  const nextFnStart = code.indexOf("\nfunction ", fnStart + 1);
  const fnBody = nextFnStart === -1 ? code.slice(fnStart) : code.slice(fnStart, nextFnStart);

  assert.match(fnBody, /existsSync\(/, "expected an existsSync(...) guard inside copySfx()");
  assert.match(fnBody, /throw new Error/, "expected copySfx() to throw new Error(...) when the guard fails");
});
