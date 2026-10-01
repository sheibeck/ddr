// test/unit/scroll-pool.test.js
//
// Phase 90 plan 09 (SPELL-10; 90-CONTEXT "The scroll roll table includes the new
// schools", user 2026-09-30, mid-run): "Make sure that the scroll roll table now
// includes the two new schools of spell as options."
//
// engine/magic.js#readScroll rolls the scroll's spell from
// `SPELLS.filter((sp) => sp.lvl <= Math.min(5, depth + 1))`, so the ten new
// Special and Illusion spells enter the table by joining SPELLS, and the removed
// Lesser Summon and Phantom Host left it. This file pins that, band by band:
//   - the pool at depths 1, 2, 3, 4 and deeper is EXACTLY the SPELLS rows at or
//     below min(5, depth + 1);
//   - it holds every one of the ten slate spells allowed at that band, so both
//     schools are represented at every band;
//   - it never holds Lesser Summon or Phantom Host.
// Reading follows RULES-10: anyone may try a Special or Illusion scroll (a read
// scroll is consumed), and a Magic User copies it into the book only when its
// sub-class can learn the school (the school gates of 90-06).

import test from "node:test";
import assert from "node:assert/strict";

import { readScroll } from "../../engine/magic.js";
import { foeRisingResistCheck, scrollReadBands, scrollReadOutcome } from "../../engine/derived.js";
import { rollCheck } from "../../engine/dice.js";
import { derivedRng } from "../../engine/rng.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";

// the ten slate spells, by level (one Special and one Illusion at every level 1 to 5)
const SLATE = [
  { n: "Open/Lock", lvl: 1, s: "special" },
  { n: "Door Illusion", lvl: 1, s: "illusion" },
  { n: "Fly", lvl: 2, s: "special" },
  { n: "Senseless", lvl: 2, s: "illusion" },
  { n: "Stop Time", lvl: 3, s: "special" },
  { n: "Chameleon Tongue", lvl: 3, s: "illusion" },
  { n: "Enchant Character", lvl: 4, s: "special" },
  { n: "Size of the Behemoth", lvl: 4, s: "illusion" },
  { n: "Speed of Sound", lvl: 5, s: "special" },
  { n: "Duplicate Foe", lvl: 5, s: "illusion" },
];
const REMOVED = ["Lesser Summon", "Phantom Host"];

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const ONES = (n) => new Array(n).fill(1);

function fixedFloor(depth = 1) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth };
}

function hero(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 5, sp: 0,
    maxWP: 60, wp: 60, skills: {}, vp: 0, intel: 18,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 4, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Reader",
    ...overrides,
  };
}

function state({ depth = 1, fight = false, foes = 1, foeIntel = 2, heroOver = {} } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero(heroOver),
    floor: fixedFloor(depth),
    day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    combat: fight
      ? {
          foes: Array.from({ length: foes }, (_, k) => ({ name: `F${k + 1}`, type: "Humans", lvl: 1, size: "S", intel: foeIntel, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1 })),
          type: "Humans", round: 1, target: 0, spellOpen: false, tracked: false,
        }
      : null,
  };
}

/** recordingRng — `pick` records the exact array it was handed and returns the row named `want`. */
function recordingRng(want) {
  const rec = { options: null };
  return {
    rec,
    d: () => 1,
    pick(arr) {
      rec.options = arr;
      return arr.find((sp) => sp.n === want) || arr[0];
    },
    shuffle: (a) => a,
    getState: () => 0,
  };
}

const poolAt = (depth) => {
  const s = state({ depth });
  const rng = recordingRng(null);
  readScroll(s, rng, []);
  return rng.rec.options;
};

test("the scroll pool at each depth band is exactly the SPELLS rows at or below min(5, depth + 1), in table order", () => {
  for (const depth of [1, 2, 3, 4, 9]) {
    const expected = SPELLS.filter((sp) => sp.lvl <= Math.min(5, depth + 1));
    assert.deepEqual(poolAt(depth).map((sp) => sp.n), expected.map((sp) => sp.n), `depth ${depth}`);
  }
  // the band sizes (41 rows in all), so a row added or removed anywhere moves a pin on purpose
  assert.deepEqual([1, 2, 3, 4, 9].map((d) => poolAt(d).length), [19, 29, 36, 41, 41]);
});

test("every band holds every slate spell allowed there, and both new schools are represented at every band", () => {
  for (const depth of [1, 2, 3, 4, 9]) {
    const pool = new Set(poolAt(depth).map((sp) => sp.n));
    const cap = Math.min(5, depth + 1);
    for (const slate of SLATE) {
      assert.equal(pool.has(slate.n), slate.lvl <= cap, `depth ${depth}: ${slate.n} (level ${slate.lvl}, ${slate.s}) ${slate.lvl <= cap ? "is" : "is not"} in the pool`);
    }
    const rows = poolAt(depth);
    assert.ok(rows.some((sp) => sp.s === "special"), `depth ${depth}: a Special spell is in the pool`);
    assert.ok(rows.some((sp) => sp.s === "illusion"), `depth ${depth}: an Illusion spell is in the pool`);
  }
});

test("the pool by band, spelled out: depth 1 Open/Lock, Door Illusion, Fly, Senseless; depth 2 adds Stop Time and Chameleon Tongue; depth 3 adds Enchant Character and Size of the Behemoth; depth 4 and deeper all ten", () => {
  // compared as sets: the pool itself is in table order (the first test pins that)
  const slateNames = (depth) => poolAt(depth).map((sp) => sp.n).filter((n) => SLATE.some((x) => x.n === n)).sort();
  const sorted = (a) => [...a].sort();
  assert.deepEqual(slateNames(1), sorted(["Open/Lock", "Door Illusion", "Fly", "Senseless"]));
  assert.deepEqual(slateNames(2), sorted(["Open/Lock", "Door Illusion", "Fly", "Senseless", "Stop Time", "Chameleon Tongue"]));
  assert.deepEqual(slateNames(3), sorted(["Open/Lock", "Door Illusion", "Fly", "Senseless", "Stop Time", "Chameleon Tongue", "Enchant Character", "Size of the Behemoth"]));
  assert.equal(slateNames(4).length, 10);
  assert.deepEqual(slateNames(9), slateNames(4));
});

test("no band holds a removed spell (Lesser Summon, Phantom Host)", () => {
  for (const depth of [1, 2, 3, 4, 9]) {
    for (const gone of REMOVED) assert.equal(poolAt(depth).some((sp) => sp.n === gone), false, `depth ${depth}: ${gone}`);
  }
  for (const gone of REMOVED) assert.equal(SPELLS.some((sp) => sp.n === gone), false, `${gone} is not in SPELLS`);
});

test("the slate rows are what the pool pins say they are: the level and school of each of the ten", () => {
  for (const slate of SLATE) {
    const row = SPELLS.find((sp) => sp.n === slate.n);
    assert.ok(row, `${slate.n} is in SPELLS`);
    assert.equal(row.lvl, slate.lvl, `${slate.n} level`);
    assert.equal(row.s, slate.s, `${slate.n} school`);
  }
});

// ---------------------------------------------------------------------------
// Reading (RULES-10: anyone may try; the school gates govern only the copy)
// ---------------------------------------------------------------------------

/** findActs — the first state.acts where the Fighter's own intelligence read succeeds AND
 * (when `foeIntel` is given) the lone foe fails its one resist against `spell`. */
function findReadActs(depth, spell, foeIntel) {
  const probe = { getState: () => 0 };
  const c = hero();
  const bands = scrollReadBands(c.intel);
  for (let acts = 0; acts <= 20000; acts++) {
    const check = rollCheck(derivedRng(0, "scrollRead", acts), bands.dieN, bands.atLeast);
    if (scrollReadOutcome(check, bands) !== "read") continue;
    if (foeIntel === undefined) return acts;
    if (!foeRisingResistCheck({ floor: { depth }, acts, combat: { round: 1 } }, probe, spell, 0, foeIntel, "you").resisted) return acts;
  }
  throw new Error("findReadActs: nothing found");
}

test("Reading: a Fighter (an intelligence reader) whose scroll rolls Door Illusion in a fight and reads it escapes: a free cast, no charge, no book", () => {
  const s = state({ depth: 1, fight: true, foeIntel: 2 });
  s.acts = findReadActs(1, "Door Illusion", 2);
  const rng = recordingRng("Door Illusion");
  const ev = readScroll(s, rng, []);
  assert.equal(s.c.scrolls, 0, "the scroll is consumed");
  assert.ok(ev.some((e) => e.type === "scrollRead" && e.spell === "Door Illusion" && e.reader === "intel"));
  assert.ok(ev.some((e) => e.type === "scrollDeciphered" && e.spell === "Door Illusion"));
  assert.ok(ev.some((e) => e.type === "scrollCast" && e.spell === "Door Illusion"), "a free cast");
  assert.deepEqual(ev.filter((e) => e.type === "fled"), [{ type: "fled", reason: "door" }], "and it escapes");
  assert.equal(s.combat, null);
  assert.equal(s.c.spellsUsed, 0, "a scroll pays for itself");
  assert.deepEqual(s.c.grimoire, [], "a Fighter has no book to copy into");
});

test("Reading: a Warlock Magic User (no Illusion school) reading an Illusion scroll free-casts it and does NOT copy it", () => {
  for (const name of ["Door Illusion", "Chameleon Tongue", "Size of the Behemoth"]) {
    const s = state({ depth: 4, fight: true, heroOver: { cls: "Magic User", sub: "Warlock", level: 5 } });
    const ev = readScroll(s, recordingRng(name), []);
    assert.equal(ev.some((e) => e.type === "scrollCopiedToGrimoire"), false, `${name}: not copied`);
    assert.deepEqual(s.c.grimoire, [], `${name}: the book is untouched`);
    assert.ok(ev.some((e) => e.type === "scrollCast" && e.spell === name), `${name}: free-cast`);
    assert.equal(s.c.scrolls, 0);
  }
});

test("Reading: a Wizard copies a Special scroll it can cast but never an Illusion one (the Wizard has no Illusion school since 90-06)", () => {
  const stop = state({ depth: 4, fight: true, heroOver: { cls: "Magic User", sub: "Wizard", level: 5 } });
  const evStop = readScroll(stop, recordingRng("Stop Time"), []);
  assert.ok(evStop.some((e) => e.type === "scrollCopiedToGrimoire" && e.spell === "Stop Time"));
  assert.deepEqual(stop.c.grimoire, ["Stop Time"]);
  const door = state({ depth: 4, fight: true, heroOver: { cls: "Magic User", sub: "Wizard", level: 5 } });
  const evDoor = readScroll(door, recordingRng("Door Illusion"), []);
  assert.equal(evDoor.some((e) => e.type === "scrollCopiedToGrimoire"), false);
  assert.ok(evDoor.some((e) => e.type === "scrollCast" && e.spell === "Door Illusion"));
  assert.deepEqual(door.c.grimoire, []);
});

test("Reading: an Illusionist copies an Illusion scroll when it is castable at its level, and free-casts it (with the too-advanced note) when it is not", () => {
  const ready = state({ depth: 4, fight: true, heroOver: { cls: "Magic User", sub: "Illusionist", level: 5 } });
  const ev = readScroll(ready, recordingRng("Chameleon Tongue"), []);
  assert.ok(ev.some((e) => e.type === "scrollCopiedToGrimoire" && e.spell === "Chameleon Tongue"));
  assert.deepEqual(ready.c.grimoire, ["Chameleon Tongue"]);
  assert.equal(ready.combat !== null, true, "copying a scroll casts nothing: the fight is as it was");

  const young = state({ depth: 4, fight: true, heroOver: { cls: "Magic User", sub: "Illusionist", level: 1 } });
  const ev2 = readScroll(young, recordingRng("Size of the Behemoth"), []);
  assert.ok(ev2.some((e) => e.type === "scrollTooAdvanced" && e.spell === "Size of the Behemoth" && e.need === 4));
  assert.deepEqual(young.c.grimoire, [], "not scribed above its level");
  assert.ok(ev2.some((e) => e.type === "scrollCast" && e.spell === "Size of the Behemoth"), "the scroll still pays for itself once");
});

test("the slate scrolls read with a recording rng draw exactly one pick from the table (the pool is the only roll that moved)", () => {
  const s = state({ depth: 2 });
  let picks = 0;
  const rng = { ...recordingRng("Fly"), pick(arr) { picks++; return arr.find((sp) => sp.n === "Fly"); } };
  readScroll(s, rng, []);
  assert.equal(picks, 1);
  assert.ok(IDX.Fly >= 0);
});
