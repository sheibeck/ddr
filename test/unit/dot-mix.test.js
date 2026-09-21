// test/unit/dot-mix.test.js
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING D) — direct coverage for
// 54-06's late dial: DOT_MIX/FIGHT_SHARE, the post-roll encounter-table
// remap engine/difficulty.js#conversionTableFor/#remapEncounterResult
// implement, wired into engine/encounters.js#encounterDot AFTER the SAME
// two draws (the d8 table roll + the d10 cell roll) every fixture already
// pins. fakeRng/fixedFighter/fixedState/countingRng are local copies (this
// repo's established per-file-fixture convention — never imported
// cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { ENCOUNTER_TABLES } from "../../content/encounters.js";
import { DOT_MIX_FAMILIES, conversionTableFor, setDialsForTuning, DIALS } from "../../engine/difficulty.js";
import { encounterDot } from "../../engine/encounters.js";
import { GW, GH } from "../../engine/maze.js";

/** fakeRng(seq) — pops the next value off `seq`; throws on underflow. */
function fakeRng(seq, { pick } = {}) {
  let i = 0;
  const next = () => {
    if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
    return seq[i++];
  };
  return {
    d: (_sides) => next(),
    pick: pick || ((arr) => arr[0]),
    shuffle: (a) => a,
  };
}

function countingRng(inner) {
  let draws = 0;
  return {
    d(n) {
      draws++;
      return inner.d(n);
    },
    pick(a) {
      draws++;
      return inner.pick(a);
    },
    shuffle(a) {
      draws += Math.max(0, a.length - 1);
      return inner.shuffle(a);
    },
    get draws() {
      return draws;
    },
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 40, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    ...overrides,
  };
}

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = wallGrid();
  g[5][5] = { wall: false, seen: true, feat: null };
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g, px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

test("every ENCOUNTER_TABLES cell belongs to exactly one DOT_MIX family (80 cells; fight 43)", () => {
  let total = 0;
  let fight = 0;
  for (const row of ENCOUNTER_TABLES) {
    for (const cell of row) {
      total++;
      const owners = Object.keys(DOT_MIX_FAMILIES).filter((f) => DOT_MIX_FAMILIES[f].includes(cell));
      assert.equal(owners.length, 1, `"${cell}" must belong to exactly one family (found: ${owners.join(",")})`);
      if (owners[0] === "fight") fight++;
    }
  }
  assert.equal(total, 80);
  assert.equal(fight, 43);
});

test("conversionTableFor at all-1.0 is empty (identity)", () => {
  const table = conversionTableFor({ fight: 1, harm: 1, loot: 1, help: 1 });
  assert.equal(table.size, 0);
  assert.equal(conversionTableFor(DIALS.DOT_MIX).size, 0, "the live identity DOT_MIX object is also empty");
});

test("FIGHT_SHARE 0.6 converts round(0.4 x 43) = 17 fight cells, each to a non-fight cell in its own row, deterministically (the same Map twice)", () => {
  const mix = { fight: 0.6, harm: 1, loot: 1, help: 1 };
  const table = conversionTableFor(mix);
  assert.equal(table.size, 17);
  for (const [key, result] of table.entries()) {
    const [t, r] = key.split(",").map(Number);
    assert.ok(DOT_MIX_FAMILIES.fight.includes(ENCOUNTER_TABLES[t][r]), `${key} must have started as a fight cell`);
    assert.ok(!DOT_MIX_FAMILIES.fight.includes(result), `${key}'s converted result must not be a fight cell`);
    assert.equal(ENCOUNTER_TABLES[t].includes(result), true, `${key}'s result must come from the SAME row`);
  }
  const again = conversionTableFor(mix);
  assert.deepStrictEqual([...again.entries()], [...table.entries()], "the same mix object always yields the same Map");
});

test("FIGHT_SHARE 1.2 converts round(0.2 x 43) = 9 non-fight cells to fight cells", () => {
  const mix = { fight: 1.2, harm: 1, loot: 1, help: 1 };
  const table = conversionTableFor(mix);
  assert.equal(table.size, 9);
  for (const [key, result] of table.entries()) {
    const [t, r] = key.split(",").map(Number);
    assert.ok(!DOT_MIX_FAMILIES.fight.includes(ENCOUNTER_TABLES[t][r]), `${key} must have started as a non-fight cell`);
    assert.ok(DOT_MIX_FAMILIES.fight.includes(result), `${key}'s converted result must be a fight cell`);
  }
});

test("encounterDot draws exactly 2 dice before the remap and the event carries `rolled` only when converted (countingRng)", () => {
  // d8=4, d10=1 -> ENCOUNTER_TABLES[3][0] === "+10 HP" (a plain Table Four
  // row — no extra rolls beyond the two encounterDot itself draws).
  const identityState = fixedState();
  const identityRng = countingRng(fakeRng([4, 1]));
  const identityEvents = encounterDot(identityState, identityRng, []);
  assert.equal(identityRng.draws, 2, "identity DOT_MIX: exactly 2 draws before dispatch");
  const identityRolled = identityEvents.find((e) => e.type === "encounterRolled");
  assert.equal(identityRolled.result, "+10 HP");
  assert.equal("rolled" in identityRolled, false, "identity never adds the rolled field");

  // Force the "+10 HP" cell (t=4,r=1, 1-based) to convert by shrinking its
  // own family (help) toward a small ratio — 1/7 (the count of distinct
  // help member strings) is an arbitrary small fraction that, measured
  // live, converts 9 of the 11 actual help cells including this one.
  const helpRatio = 1 / DOT_MIX_FAMILIES.help.length;
  const restore = setDialsForTuning({ DOT_MIX: { fight: 1, harm: 1, loot: 1, help: helpRatio } });
  try {
    const convertedTable = conversionTableFor({ fight: 1, harm: 1, loot: 1, help: helpRatio });
    // Find whichever help cell actually got converted this run (deterministic).
    const [key, expectedResult] = [...convertedTable.entries()].find(([k]) => k === "3,0") || [];
    if (key) {
      const state = fixedState();
      const rng = countingRng(fakeRng([4, 1]));
      const events = encounterDot(state, rng, []);
      assert.equal(rng.draws, 2, "the remap itself draws nothing — still exactly 2 draws");
      const rolled = events.find((e) => e.type === "encounterRolled");
      assert.equal(rolled.result, expectedResult);
      assert.equal(rolled.rolled, "+10 HP", "the ORIGINAL cell is carried as `rolled` once converted");
    }
  } finally {
    restore();
  }
});
