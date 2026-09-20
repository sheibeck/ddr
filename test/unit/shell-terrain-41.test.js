// test/unit/shell-terrain-41.test.js
//
// Phase 41 (TERR-01/02/03/05), Plan 04 — mazeworld.html has no ESM surface a
// test can import directly, so — mirroring test/unit/shell-spells-40.test.js's
// own fs.readFileSync pattern — this file reads the real shipped source and
// asserts against it directly:
//   (1) the derived.js import line carries mapViewRadius/inViewWindow
//   (2) window.__mzMapView is bridged exactly once
//   (3) draw()'s 3x3 render filter is wired at both continue sites
//   (4) the Phase 40 fill-line pin still matches, and the water override
//       line follows it
//   (5) the fallback P literal's water/waterDark hexes equal the real
//       MAP_PALETTE module's values
//   (6) the fearArmed chip copy/tone/explain rows are present and clear the
//       voice scan
//   (7) the shell's legacy classic move()/reveal() dead-code bodies were
//       never touched by this plan
//   (8) the build artefact carries the new surface

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { MAP_PALETTE } from "../../src/browser/mapMarks.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, then block comments — same
// order-sensitive approach as every sibling shell-*.test.js file) ──────────
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

const CODE = stripComments(HTML);

// ─── (1) the derived.js import line ────────────────────────────────────────

test("import: the ./engine/derived.js import line carries mapViewRadius and inViewWindow", () => {
  const importMatch = CODE.match(/import \{[^}]*\} from "\.\/engine\/derived\.js";/);
  assert.ok(importMatch, "the ./engine/derived.js import line was not found");
  assert.match(importMatch[0], /\bmapViewRadius\b/);
  assert.match(importMatch[0], /\binViewWindow\b/);
});

// ─── (2) the window.__mzMapView bridge ─────────────────────────────────────

test("bridge: window.__mzMapView = { mapViewRadius, inViewWindow }; exactly once", () => {
  assert.equal((CODE.match(/window\.__mzMapView = \{ mapViewRadius, inViewWindow \};/g) || []).length, 1);
});

// ─── (3) draw()'s 3x3 render filter — both continue sites ─────────────────

test("draw(): the visible() definition appears once, and if (!visible(x, y)) continue; appears exactly twice, both after the definition", () => {
  const defIdx = CODE.indexOf("const visible = (x, y) => !view || view.inViewWindow(S, x, y);");
  assert.notEqual(defIdx, -1, "visible() definition not found");
  assert.equal(
    (CODE.match(/const visible = \(x, y\) => !view \|\| view\.inViewWindow\(S, x, y\);/g) || []).length,
    1,
    "visible() must be defined exactly once"
  );
  const useMatches = [...CODE.matchAll(/if \(!visible\(x, y\)\) continue;/g)];
  assert.equal(useMatches.length, 2, "if (!visible(x, y)) continue; must appear exactly twice");
  for (const m of useMatches) {
    assert.ok(m.index > defIdx, "each use of visible() must come after its own definition");
  }
});

// ─── (4) the Phase 40 fill-line pin + the water override line ─────────────

test("draw(): the Phase 40 spellSeen/dark fill-line pin is unchanged, and the water override line immediately follows it", () => {
  assert.match(CODE, /ctx\.fillStyle = c\.spellSeen \? P\.floorSpell : \(c\.dark \? P\.floorDark : P\.floor\);/);
  const region = sliceBetween(
    CODE,
    "ctx.fillStyle = c.spellSeen ? P.floorSpell : (c.dark ? P.floorDark : P.floor);",
    "ctx.fillRect(X, Y, CELL, CELL);"
  );
  assert.match(region, /if \(c\.water && !c\.spellSeen\) ctx\.fillStyle = c\.dark \? P\.waterDark : P\.water;/);
});

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ─── (5) fallback palette hex parity ───────────────────────────────────────

test("draw(): the fallback P literal's water/waterDark hexes equal the real MAP_PALETTE module's values", () => {
  const fallbackMatch = CODE.match(/const P = M \? M\.MAP_PALETTE : \{[^}]*water: "(#[0-9a-fA-F]{6})", waterDark: "(#[0-9a-fA-F]{6})"[^}]*\};/);
  assert.ok(fallbackMatch, "fallback palette literal must carry water/waterDark");
  assert.equal(fallbackMatch[1], MAP_PALETTE.water, "the fallback water hex must equal the real module's MAP_PALETTE.water");
  assert.equal(fallbackMatch[2], MAP_PALETTE.waterDark, "the fallback waterDark hex must equal the real module's MAP_PALETTE.waterDark");
});

// ─── (6) fearArmed chip copy/tone/explain ──────────────────────────────────

test("CONDITION_COPY/TONE/EXPLAIN: each carries a fearArmed entry — label Rattled, tone warn, a non-empty voice-clean explanation", () => {
  assert.match(CODE, /fearArmed: \{ label: "Rattled" \}/);
  const toneMatch = CODE.match(/const CONDITION_TONE = \{[^}]*\};/);
  assert.ok(toneMatch, "CONDITION_TONE literal not found");
  assert.match(toneMatch[0], /fearArmed: "warn"/);
  const explainMatch = CODE.match(/const CONDITION_EXPLAIN = \{[\s\S]*?\n\};/);
  assert.ok(explainMatch, "CONDITION_EXPLAIN literal not found");
  const m = explainMatch[0].match(/fearArmed: "([^"]+)"/);
  assert.ok(m, "CONDITION_EXPLAIN is missing the fearArmed key");
  assert.ok(m[1].length > 0);

  const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
  for (const { term, re } of MATCHERS) {
    const hit = m[1].match(re);
    assert.ok(!hit || ALLOW.has(hit[0].toLowerCase()), `banned term "${term}" found in fearArmed explanation`);
  }
});

// ─── (7) no classic move()/reveal() body survives ──────────────────────────

test("no classic move()/reveal() body survives to carry mapViewRadius or moveCost (Phase 44 deleted both; the check skips when a marker is absent)", () => {
  for (const startMarker of ["\nfunction move(", "\nfunction reveal("]) {
    const start = CODE.indexOf(startMarker);
    if (start === -1) continue; // the classic functions are deleted (Phase 44) — the check is vacuous by design
    // Slice to the next top-level "\nfunction " after the opening body,
    // approximating "the function's own body" without a full brace parser.
    const nextFn = CODE.indexOf("\nfunction ", start + startMarker.length);
    const body = nextFn === -1 ? CODE.slice(start) : CODE.slice(start, nextFn);
    assert.doesNotMatch(body, /mapViewRadius/, `${startMarker} body must not reference mapViewRadius`);
    assert.doesNotMatch(body, /moveCost/, `${startMarker} body must not reference moveCost`);
  }
});

// ─── (8) build artefact ────────────────────────────────────────────────────

test("Build artefact: www/index.html carries waterDark, __mzMapView and Rattled (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) {
    return; // build:www not run in this environment — not a failure
  }
  const built = fs.readFileSync(wwwPath, "utf8");
  assert.match(built, /waterDark/);
  assert.match(built, /__mzMapView/);
  assert.match(built, /Rattled/);
});
