// test/unit/mapMarks.test.js
//
// Phase 35 (Map Screen Rebuild), Plan 01 (MAP-07) — direct unit coverage
// for src/browser/mapMarks.js: glyph-table completeness, the legend row
// move-verbatim proof (byte-identical to the old mazeworld.html
// MARKS_LEGEND table), markForCell's mapping for every engine feat, the
// one-way-door rotation table, and a BANNED voice scan of the legend rows.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import {
  MAP_PALETTE,
  MARK_GLYPHS,
  MARK_SCALE,
  ONEWAY_ROTATION_DEG,
  MARKS_LEGEND,
  markForCell,
  legendFor,
} from "../../src/browser/mapMarks.js";

// ─── glyph table completeness ──────────────────────────────────────────────

test("MARK_GLYPHS: exactly the nine expected keys, each with the CONTEXT-spec'd glyph and colour", () => {
  assert.deepEqual(
    Object.keys(MARK_GLYPHS).sort(),
    ["chest", "crevice", "descent", "encounter", "onewaydoor", "party", "teleport", "trap", "wall"].sort()
  );
  assert.deepEqual(MARK_GLYPHS.encounter, { glyph: "●", color: "#e05a48" });
  assert.deepEqual(MARK_GLYPHS.teleport, { glyph: "◆", color: "#a78ce8" });
  assert.deepEqual(MARK_GLYPHS.onewaydoor, { glyph: "▲", color: "#8ec06a" });
  assert.deepEqual(MARK_GLYPHS.trap, { glyph: "✕", color: "#e05a48" });
  assert.deepEqual(MARK_GLYPHS.chest, { glyph: "▪", color: "#d3c49f" });
  assert.deepEqual(MARK_GLYPHS.crevice, { glyph: "⧗", color: "#d3c49f" });
  assert.deepEqual(MARK_GLYPHS.descent, { glyph: "▼", color: "#d3c49f" });
  assert.equal(MARK_GLYPHS.party.color, "#f4dc94");
  assert.equal(MARK_SCALE, 0.6);
});

// ─── rotation table ─────────────────────────────────────────────────────────

test("ONEWAY_ROTATION_DEG: N is the zero-rotation case (the glyph points north at rest, unlike the PNG which points east)", () => {
  assert.deepEqual(ONEWAY_ROTATION_DEG, { N: 0, E: 90, S: 180, W: 270 });
});

// ─── palette ────────────────────────────────────────────────────────────────

test("MAP_PALETTE: carries the CONTEXT-spec'd chrome hexes", () => {
  assert.equal(MAP_PALETTE.fog, "#0b0a08");
  assert.equal(MAP_PALETTE.wall, "#2c261c");
  assert.equal(MAP_PALETTE.floor, "#645c48");
  assert.equal(MAP_PALETTE.border, "#443a26");
  assert.equal(MAP_PALETTE.party, "#f4dc94");
});

// Phase 40 (SPELL-05), Plan 05 — the "borrowed sight" tint for a
// spell-revealed (cell.spellSeen) floor cell: distinct from every other
// floor-adjacent hex, and MAP_PALETTE stays frozen with every existing
// key/value unchanged.
test("MAP_PALETTE.floorSpell: a distinct 'borrowed sight' tint; the palette stays frozen with prior keys unchanged", () => {
  assert.equal(typeof MAP_PALETTE.floorSpell, "string");
  assert.notEqual(MAP_PALETTE.floorSpell, MAP_PALETTE.floor);
  assert.notEqual(MAP_PALETTE.floorSpell, MAP_PALETTE.floorDark);
  assert.notEqual(MAP_PALETTE.floorSpell, MAP_PALETTE.fog);
  assert.equal(Object.isFrozen(MAP_PALETTE), true);
  assert.equal(MAP_PALETTE.floor, "#645c48");
});

// ─── MARKS_LEGEND: move-verbatim proof ─────────────────────────────────────

// Literal copy of the old mazeworld.html MARKS_LEGEND table (icon -> key),
// so this test proves the move is byte-identical, not just "close enough".
const OLD_MARKS_LEGEND = [
  { key: "encounter", name: "ENCOUNTER", desc: "Something gets rolled for you the moment you touch it." },
  { key: "teleport", name: "TELEPORT", desc: "Thrown a d20 of squares somewhere you did not choose." },
  { key: "onewaydoor", name: "ONE-WAY DOOR", desc: "Go where the arrow points. There is no coming back." },
  { key: "trap", name: "TRAP", desc: "A d6 out of you, before you knew it was there." },
  { key: "chest", name: "LOCKED BOX", desc: "1–5 on a d10 opens it. The rest costs you a pick." },
  { key: "crevice", name: "CREVICE", desc: "Climb it, or fall, and be grateful for half the fall." },
  { key: "descent", name: "DESCENT", desc: "The floor below, which is worse in every way." },
  { key: "wall", name: "WALL", desc: "Climb it on a d10 under your class's number, or fall and eat the difference." },
  { key: "party", name: "YOU", desc: "The party marker. Whatever is nearby has already noticed you." },
];

test("MARKS_LEGEND: 9 rows, in order, byte-identical name/desc to the old mazeworld.html table", () => {
  assert.equal(MARKS_LEGEND.length, 9);
  assert.deepEqual(
    MARKS_LEGEND.map((r) => ({ key: r.key, name: r.name, desc: r.desc })),
    OLD_MARKS_LEGEND
  );
});

// ─── markForCell ────────────────────────────────────────────────────────────

test("markForCell: maps every engine feat to its glyph/colour, accepting either a cell object or a bare feat string", () => {
  const cases = [
    ["dot", "encounter"],
    ["tele", "teleport"],
    ["one", "onewaydoor"],
    ["trap", "trap"],
    ["chest", "chest"],
    ["climb", "wall"],
    ["gorge", "crevice"],
    ["exit", "descent"],
    ["gate", "descent"],
  ];
  for (const [feat, key] of cases) {
    assert.equal(markForCell({ feat }).key, key, `feat "${feat}"`);
    assert.equal(markForCell(feat).key, key, `bare feat "${feat}"`);
    assert.deepEqual(markForCell(feat), { key, ...MARK_GLYPHS[key] });
  }
  assert.equal(markForCell(null), null);
  assert.equal(markForCell({ feat: null }), null);
  assert.equal(markForCell("not-a-real-feat"), null);
});

// ─── legendFor ──────────────────────────────────────────────────────────────

test("legendFor: resolves a feat through featureKeyForCell to its MARKS_LEGEND row, or null when unmapped", () => {
  const row = legendFor("trap");
  assert.equal(row.name, "TRAP");
  assert.equal(legendFor("nope"), null);
  assert.equal(legendFor(null), null);
});

// ─── voice scan ─────────────────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
function findBannedTerms(text) {
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = text.match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
  }
  return hits;
}

test("voice scan: every MARKS_LEGEND name/desc is non-empty and clear of BANNED", () => {
  for (const row of MARKS_LEGEND) {
    for (const leaf of [row.name, row.desc]) {
      assert.ok(leaf && leaf.length > 0, `${row.key}: string leaf must be non-empty`);
      const hits = findBannedTerms(leaf);
      assert.equal(hits.length, 0, `banned term(s) in "${leaf}": ${JSON.stringify(hits)}`);
    }
  }
});

// ─── purity / import contract ──────────────────────────────────────────────

test("mapMarks.js is pure and imports ONLY featureKeyForCell from icons.js (no preload/draw pipeline)", () => {
  const src = url.fileURLToPath(new URL("../../src/browser/mapMarks.js", import.meta.url));
  const raw = fs.readFileSync(src, "utf8");
  const importLines = [...raw.matchAll(/^import .* from "([^"]+)";$/gm)];
  assert.equal(importLines.length, 1);
  assert.equal(importLines[0][1], "./icons.js");
  assert.match(importLines[0][0], /\{\s*featureKeyForCell\s*\}/);

  const noLineComments = raw
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  const text = noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  for (const needle of ["window.", "document.", "Date.now", "localStorage", "setTimeout", "innerHTML", "Math.random"]) {
    assert.doesNotMatch(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${needle} must not appear in mapMarks.js`);
  }
});
