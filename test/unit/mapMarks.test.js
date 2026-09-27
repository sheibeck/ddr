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
import { facesRangeText } from "../../src/browser/rollRange.js";
import { openChest, springTrap } from "../../engine/encounters.js";
import { TRAPS } from "../../content/index.js";

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

// Phase 41 (TERR-01), Plan 04 — the two water shades: a lit pool
// (MAP_PALETTE.water) and a pool inside a dark blob (MAP_PALETTE.waterDark)
// — both distinct 6-digit hexes, from each other and from every other
// palette key, with the palette still frozen and every prior key/value
// unchanged.
test("MAP_PALETTE.water/waterDark: two distinct 6-digit hex shades; the palette stays frozen with prior keys unchanged", () => {
  assert.match(MAP_PALETTE.water, /^#[0-9a-fA-F]{6}$/);
  assert.match(MAP_PALETTE.waterDark, /^#[0-9a-fA-F]{6}$/);
  assert.notEqual(MAP_PALETTE.water, MAP_PALETTE.waterDark);
  for (const key of ["fog", "wall", "floor", "floorDark", "floorSpell", "border", "party"]) {
    assert.notEqual(MAP_PALETTE.water, MAP_PALETTE[key], `water must differ from ${key}`);
    assert.notEqual(MAP_PALETTE.waterDark, MAP_PALETTE[key], `waterDark must differ from ${key}`);
  }
  assert.equal(Object.isFrozen(MAP_PALETTE), true);
  assert.equal(MAP_PALETTE.floor, "#645c48");
  assert.equal(MAP_PALETTE.floorSpell, "#4e5a6a");
});

// DARK-02 (Phase 76) — the waived-dark tint: a dark cell while a light
// holds the dark back. A real middle shade (relative luminance strictly
// between the dark and lit neighbours), distinct from every other key, with
// the palette still frozen and every prior key/value unchanged.
function relLuminance(hex) {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

test("MAP_PALETTE.floorDarkLit/waterDarkLit: 6-digit hexes strictly between their dark and lit neighbours in luminance, distinct from every other key; prior keys unchanged", () => {
  const P = MAP_PALETTE;
  assert.match(P.floorDarkLit, /^#[0-9a-fA-F]{6}$/);
  assert.match(P.waterDarkLit, /^#[0-9a-fA-F]{6}$/);
  const L = relLuminance;
  assert.ok(L(P.floorDark) < L(P.floorDarkLit) && L(P.floorDarkLit) < L(P.floor), "floorDark < floorDarkLit < floor");
  assert.ok(L(P.waterDark) < L(P.waterDarkLit) && L(P.waterDarkLit) < L(P.water), "waterDark < waterDarkLit < water");
  for (const key of Object.keys(P)) {
    if (key !== "floorDarkLit") assert.notEqual(P.floorDarkLit.toLowerCase(), String(P[key]).toLowerCase(), `floorDarkLit must differ from ${key}`);
    if (key !== "waterDarkLit") assert.notEqual(P.waterDarkLit.toLowerCase(), String(P[key]).toLowerCase(), `waterDarkLit must differ from ${key}`);
  }
  assert.equal(Object.isFrozen(P), true);
  assert.equal(P.floor, "#645c48");
  assert.equal(P.floorDark, "#3d372a");
  assert.equal(P.floorSpell, "#4e5a6a");
  assert.equal(P.water, "#2f5f7a");
  assert.equal(P.waterDark, "#1f3a4a");
});

// ─── MARKS_LEGEND: move-verbatim proof ─────────────────────────────────────

// Literal copy of the old mazeworld.html MARKS_LEGEND table (icon -> key),
// so this test proves the move is byte-identical, not just "close enough".
// Phase 78 (CLIMB-02) re-pin: the crevice and wall rows are the two
// deliberate rewrites since the move (the pre-roll choice and one and
// done); every other row is still the moved text, byte for byte.
const OLD_MARKS_LEGEND = [
  { key: "encounter", name: "ENCOUNTER", desc: "Something gets rolled for you the moment you touch it." },
  { key: "teleport", name: "TELEPORT", desc: "Thrown a d20 of squares somewhere you did not choose." },
  { key: "onewaydoor", name: "ONE-WAY DOOR", desc: "Go where the arrow points. There is no coming back." },
  // VOX-05 (79-10): the trap and chest rows are rewritten (previously "A d6
  // out of you, before you knew it was there." and "1–5 on a d10 opens it.
  // The rest costs you a pick."); their numbers are pinned to the engine at
  // the end of this file.
  {
    key: "trap",
    name: "TRAP",
    desc: "Step on it and a d20 decides: 16–20 dodges it (13–20 for an Acrobat). Fail and it goes off, anything from a d6 of darts to a spike pit's d10×5. Going around is free.",
  },
  {
    key: "chest",
    name: "LOCKED BOX",
    desc: "With lockpicks or the Locks skill, 6–10 on a d10 opens it (more faces with practice or wits); bare hands need 13–20 on a d20. Fail and it stays shut for good.",
  },
  {
    key: "crevice",
    name: "CREVICE",
    desc: "You choose before anything is rolled: leap it, use a rope if you have one, or turn back. A failed leap still gets you across, hurt.",
  },
  { key: "descent", name: "DESCENT", desc: "The floor below, which is worse in every way." },
  {
    key: "wall",
    name: "WALL",
    desc: "You choose before anything is rolled: climb it, use a ladder if you have one, or turn back. A failed climb still gets you over, hurt.",
  },
  { key: "party", name: "YOU", desc: "The party marker. Whatever is nearby has already noticed you." },
];

// Phase 78 (HUD-07) re-pin: a tenth row, `heard`, is appended after the nine
// moved rows (which stay byte-identical, as above).
test("MARKS_LEGEND: the nine moved rows, in order, byte-identical name/desc to the old mazeworld.html table (crevice and wall as rewritten in Phase 78), then the HUD-07 heard row", () => {
  assert.equal(MARKS_LEGEND.length, 10);
  assert.deepEqual(
    MARKS_LEGEND.slice(0, 9).map((r) => ({ key: r.key, name: r.name, desc: r.desc })),
    OLD_MARKS_LEGEND
  );
  assert.equal(MARKS_LEGEND[9].key, "heard");
});

// Phase 78 (HUD-07, user ruling 2026-09-26, option A): the heard row explains
// the ripple and names nothing; it is not a feature, so it has no glyph and
// legendFor never answers it; the MARKS sheet draws its swatch as the ripple.
test("HUD-07: the HEARD legend row explains Acute Hearing's ripple, names no feature, and carries the ripple swatch", () => {
  const row = MARKS_LEGEND.find((r) => r.key === "heard");
  assert.ok(row);
  assert.equal(row.name, "HEARD");
  assert.equal(row.swatch, "ripple");
  assert.match(row.desc, /Acute Hearing/);
  assert.match(row.desc, /three squares/);
  assert.match(row.desc, /walls/);
  for (const named of [/encounter/i, /monster/i, /foe/i, /trap/i, /chest/i, /box/i, /joiner/i, /faerie/i]) {
    assert.doesNotMatch(row.desc, named, `the heard row must not name ${named}`);
  }
  assert.equal(MARK_GLYPHS.heard, undefined, "the ripple is never a glyph");
  assert.equal(legendFor("heard"), null, "no feature resolves to the heard row");
  assert.equal(MARKS_LEGEND.filter((r) => r.swatch).length, 1, "only the heard row draws a swatch instead of a PNG icon");
});

test("HUD-07: MAP_PALETTE.heard is a pale parchment hex, distinct from the encounter mark's colour and from the fog", () => {
  assert.match(MAP_PALETTE.heard, /^#[0-9a-fA-F]{6}$/);
  assert.notEqual(MAP_PALETTE.heard.toLowerCase(), MARK_GLYPHS.encounter.color.toLowerCase());
  assert.notEqual(MAP_PALETTE.heard.toLowerCase(), MAP_PALETTE.fog.toLowerCase());
  assert.ok(relLuminance(MAP_PALETTE.heard) > relLuminance(MAP_PALETTE.floor), "a pale tone reads over the fog");
});

// Phase 78 (CLIMB-02): the crevice and wall rows describe the pre-roll
// choice and one and done, never the retired retry-and-fall rule or a
// roll-under number, and the hold-inspect card reads the same rows.
test("CLIMB-02: the crevice and wall rows name the choice before any roll and the crossing on a failed roll; no 'or fall' outcome, no 'under your'", () => {
  for (const [key, cross, tool, over] of [["crevice", "leap it", "rope", "across"], ["wall", "climb it", "ladder", "over"]]) {
    const { desc } = MARKS_LEGEND.find((r) => r.key === key);
    assert.match(desc, /before anything is rolled/, key);
    assert.ok(desc.includes(cross), `${key}: ${cross}`);
    assert.ok(desc.includes(tool), `${key}: ${tool}`);
    assert.match(desc, /turn back/, key);
    assert.match(desc, new RegExp(`still gets you ${over}, hurt`), key);
    assert.doesNotMatch(desc, /or fall/i, `${key}: no fall-only outcome`);
    assert.doesNotMatch(desc, /under your/i, `${key}: no roll-under phrasing`);
    assert.doesNotMatch(desc, /(?<![\w.$-])(wp|WP)(?![\w:])/, key);
  }
  assert.equal(legendFor("climb").key, "wall");
  assert.equal(legendFor("gorge").key, "crevice");
  assert.equal(legendFor("climb").desc, MARKS_LEGEND.find((r) => r.key === "wall").desc);
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

// ─── VOX-05 / ROLL-04 (79-10): the LOCKED BOX and TRAP rows read the engine ─

// The LOCKED BOX row used to read "1–5 on a d10 opens it. The rest costs you
// a pick." That was the retired roll-under face count, and a failed roll
// never costs a pick: engine/encounters.js#openChest pushes chestLocked and
// stops, and engine/movement.js#resolveFeature has already cleared the box's
// cell. Both ranges are read from the engine's own chestLockRolled event, so
// the legend can never drift from the lock table.
function lockRange(c) {
  const events = openChest({ c }, { d: (n) => n }, []); // the worst face: the roll fails
  const rolled = events.find((e) => e.type === "chestLockRolled");
  assert.ok(rolled, "openChest rolls the lock");
  assert.equal(events.at(-1).type, "chestLocked", "a failed roll ends in chestLocked");
  return { range: facesRangeText(rolled.dieN + 1 - rolled.atLeast, rolled.dieN), dieN: rolled.dieN };
}

test("VOX-05 / ROLL-04 (79-10): the LOCKED BOX row states the engine's lock ranges roll-high and what a failure costs", () => {
  const { desc } = MARKS_LEGEND.find((r) => r.key === "chest");
  const withPicks = { sub: "Knight", skills: {}, intel: 10, items: [{ kind: "picks", n: "Lockpicks" }] };
  const withSkill = { sub: "Knight", skills: { Locks: 1 }, intel: 10, items: [] };
  const bare = { sub: "Knight", skills: {}, intel: 10, items: [] };
  const picked = lockRange(withPicks);
  assert.deepEqual(lockRange(withSkill), picked, "a lockpick and Locks I are the same tier");
  assert.equal(picked.dieN, 10);
  assert.ok(desc.includes(`${picked.range} on a d10`), `the picks/skill range ${picked.range} on a d10: ${desc}`);
  const hands = lockRange(bare);
  assert.equal(hands.dieN, 20);
  assert.ok(desc.includes(`${hands.range} on a d20`), `the bare-hands range ${hands.range} on a d20: ${desc}`);
  assert.equal(withPicks.items.length, 1, "a failed roll keeps the lockpicks");
  assert.doesNotMatch(desc, /costs you a pick/i, "a failed roll never costs a pick");
  assert.match(desc, /stays shut for good/, "a failure leaves the box shut, and its cell is cleared");
  const movement = fs.readFileSync(url.fileURLToPath(new URL("../../engine/movement.js", import.meta.url)), "utf8");
  assert.match(movement, /cell\.feat === "chest"\) \{\s*cell\.feat = null;\s*openChest\(/, "the box's cell clears before the roll");
});

test("VOX-05 / ROLL-04 (79-10): the TRAP row states the engine's d20 dodge range and the trap table's spread", () => {
  const { desc } = MARKS_LEGEND.find((r) => r.key === "trap");
  const dodge = (sub) => {
    const events = springTrap({ c: { sub, cls: "Fighter", skills: {} } }, { d: () => 1 }, []); // the best face: dodged
    const e = events.find((x) => x.type === "trapAvoided");
    assert.ok(e, `${sub}: the best face dodges`);
    return facesRangeText(e.dieN + 1 - e.atLeast, e.dieN);
  };
  assert.ok(desc.includes(`${dodge("Knight")} dodges it`), `the base dodge range: ${desc}`);
  assert.ok(desc.includes(`(${dodge("Acrobat")} for an Acrobat)`), `the Acrobat's range: ${desc}`);
  const sides = TRAPS.map((t) => t.dmg.sides);
  const spike = TRAPS.find((t) => t.times);
  assert.ok(desc.includes(`a d${Math.min(...sides)} of darts`), `the smallest trap: ${desc}`);
  assert.ok(desc.includes(`d${spike.dmg.sides}×${spike.times}`), `the spike pit: ${desc}`);
  assert.doesNotMatch(desc, /before you knew it was there/, "the mark is only drawn on a square you can see");
});
