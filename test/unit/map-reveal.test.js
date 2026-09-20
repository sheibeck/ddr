// test/unit/map-reveal.test.js
//
// Phase 40 (SPELL-05), Plan 04 — Map the Floor's time-boxed, re-fogging
// reveal: the ratified Key Decision (40-CONTEXT.md Area 1) is "re-fog ONLY
// what the spell alone showed" — a per-cell `spellSeen` provenance flag,
// normal walking graduates a cell to permanent memory the instant reveal()
// touches it, ONE sweep re-fogs whatever is still flagged when the window's
// `c.timers["spell:reveal"]` record expires (never a per-step poll —
// research Pitfall 4), and a recast mid-window refreshes the timer without
// ever double-marking a cell.
//
// Direct unit coverage against the real engine (castSpell/move/descend/
// teleport/conditionsOf/refogSpellSeen/reveal), mirroring test/unit/
// magic.test.js's and test/unit/movement.test.js's own fixture patterns
// (fixedFloor/fixedChar/fixedState, fakeRng). The full byte-for-byte
// prototype comparison + the spellSeen structural carve-out live in
// test/parity/harness/comparables.js and its three call sites — this file
// only proves the mechanic itself.

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell } from "../../engine/magic.js";
import { move, descend, teleport } from "../../engine/movement.js";
import { GW, GH, reveal, refogSpellSeen } from "../../engine/maze.js";
import { conditionsOf } from "../../engine/derived.js";
import { newRun } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { SPELLS } from "../../content/index.js";
import { serializeRun, validateSave } from "../../engine/saveState.js";
import { stripSpellSeen, movementComparable, combatComparable, economyComparable } from "../parity/harness/comparables.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, ORACLE_ONLY } from "../../src/browser/narrationLines.js";
import { RAIL_FAMILY } from "../../src/browser/rail.js";

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — `.d()` pops the next value off `seq`; throws (a loud,
 * intentional test failure) if the sequence underflows — doubles as a
 * "zero rng draws expected" assertion when called with []. Ports test/unit/
 * magic.test.js's / movement.test.js's identical helper. */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

/** A fully-open GW x GH floor, every cell unseen — mirrors test/unit/
 * magic.test.js's fixedFloor() (the reveal spell iterates the WHOLE grid,
 * so an undersized fixture floor throws). */
function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

/** A minimal, fully-shaped character — ports test/unit/movement.test.js's
 * fixedFighter() verbatim (Phase 39: no legacy haste/invis/ether/acute
 * scalar counters; a live effect is a c.timers record). sub "Soldier" (not
 * Apprentice/Illusionist/Cutthroat) and phobia "Spiders" (not "Being
 * trapped") keep move()/castSpell() free of any incidental rng draw. */
function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedChar(cOverrides),
    floor: floor || fixedFloor(),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

/** countFlagged(floor) — the number of cells currently carrying spellSeen. */
function countFlagged(floor) {
  let n = 0;
  for (const row of floor.g) for (const cell of row) if (cell.spellSeen) n++;
  return n;
}

const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** buildCorridorFloor(dirs, start) — a fully-walled GW x GH grid with ONLY
 * the cells a scripted walk from `start` along `dirs` actually visits
 * opened up (feat: null throughout, so move() never touches a climb/gorge/
 * one-way/feature branch — zero incidental rng draws). */
function buildCorridorFloor(dirs, start = [1, 1]) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  let [x, y] = start;
  g[y][x] = { wall: false, seen: false, feat: null };
  for (const dir of dirs) {
    const [dx, dy] = DIRV[dir];
    x += dx;
    y += dy;
    g[y][x] = { wall: false, seen: false, feat: null };
  }
  return g;
}

/** A 43-move zigzag corridor (18 E, 2 S, 18 W, 2 S, 3 E) from (1,1) — long
 * enough to cross the 40-square window's expiry with room to prove no
 * second sweep follows. */
function longCorridorDirs() {
  return [
    ...Array(18).fill("E"),
    ...Array(2).fill("S"),
    ...Array(18).fill("W"),
    ...Array(2).fill("S"),
    ...Array(3).fill("E"),
  ];
}

// --- cast: provenance marking + the window's own timer --------------------

test("castSpell (Map the Floor): marks every unseen non-wall cell seen+spellSeen, leaves already-seen cells and walls alone, starts the spell:reveal timer, zero rng draws", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  state.floor.g[2][2].wall = true; // a wall cell — left alone by the reveal branch
  state.floor.g[3][3].seen = true; // already seen before the cast — never gets the flag

  const events = castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);

  const floorMapped = events.find((e) => e.type === "floorMapped");
  assert.ok(floorMapped, "floorMapped fires");
  assert.equal(floorMapped.squares, 40);
  assert.equal(events.some((e) => e.type === "detectMagic"), false, "the retired event never fires");

  let expectedCells = 0;
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const cell = state.floor.g[y][x];
      if (x === 2 && y === 2) {
        assert.equal(cell.wall, true);
        assert.equal(cell.seen, false, "a wall cell is untouched");
        assert.equal("spellSeen" in cell, false);
        continue;
      }
      if (x === 3 && y === 3) {
        assert.equal(cell.seen, true);
        assert.equal("spellSeen" in cell, false, "an already-seen cell never gets the provenance flag");
        continue;
      }
      assert.equal(cell.seen, true, `(${x},${y}) should be newly seen`);
      assert.equal(cell.spellSeen, true, `(${x},${y}) should carry the provenance flag`);
      expectedCells++;
    }
  }
  assert.equal(floorMapped.cells, expectedCells, "floorMapped.cells counts only the newly-marked cells");
  assert.deepStrictEqual(state.c.timers["spell:reveal"], { cadence: "squares", left: 40, phase: "effect" });
});

test("castSpell (Map the Floor): a recast on a floor that is still fully lit marks zero new cells but refreshes the timer to 40", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  state.c.timers["spell:reveal"].left = 17; // simulate the window having ticked down

  const events2 = castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  const floorMapped2 = events2.find((e) => e.type === "floorMapped");
  assert.equal(floorMapped2.cells, 0, "every cell is already seen from the first cast — nothing new to mark");
  assert.deepStrictEqual(state.c.timers["spell:reveal"], { cadence: "squares", left: 40, phase: "effect" });
});

// --- refogSpellSeen / reveal() graduation, as pure functions ---------------

test("refogSpellSeen(floor): re-fogs and un-flags only spellSeen cells, returns the count, leaves graduated cells alone", () => {
  const floor = fixedFloor();
  floor.g[1][1].seen = true;
  floor.g[1][1].spellSeen = true;
  floor.g[1][2].seen = true;
  floor.g[1][2].spellSeen = true;
  floor.g[1][3].seen = true; // a graduated (walked) cell — no flag

  const count = refogSpellSeen(floor);
  assert.equal(count, 2);
  assert.equal(floor.g[1][1].seen, false);
  assert.equal("spellSeen" in floor.g[1][1], false);
  assert.equal(floor.g[1][2].seen, false);
  assert.equal("spellSeen" in floor.g[1][2], false);
  assert.equal(floor.g[1][3].seen, true, "a graduated cell is untouched by the sweep");
});

test("refogSpellSeen(floor): a floor with no flags anywhere re-fogs nothing and returns 0", () => {
  assert.equal(refogSpellSeen(fixedFloor()), 0);
});

test("reveal(floor, radius): a touched cell's spellSeen flag is deleted (graduation) — a no-op delete on a cell that never carried it", () => {
  const floor = fixedFloor({ px: 5, py: 5 });
  floor.g[5][5].spellSeen = true;
  reveal(floor, 1);
  assert.equal(floor.g[5][5].seen, true);
  assert.equal("spellSeen" in floor.g[5][5], false);
  assert.equal(floor.g[4][4].seen, true);
  assert.equal("spellSeen" in floor.g[4][4], false, "no-op delete on a cell that never carried the flag");
});

// --- walking graduates cells during the window -----------------------------

test("move(): walking graduates every cell reveal() touches — spellSeen removed, seen stays true, the flagged count never increases", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  const before = countFlagged(state.floor);
  assert.ok(before > 0);

  move(state, "E", fakeRng([]), []);
  const afterFirst = countFlagged(state.floor);
  assert.ok(afterFirst < before, "walking graduates cells — the flagged count strictly decreases");
  const { px, py } = state.floor;
  for (let y = Math.max(0, py - 2); y <= Math.min(GH - 1, py + 2); y++) {
    for (let x = Math.max(0, px - 2); x <= Math.min(GW - 1, px + 2); x++) {
      assert.equal(state.floor.g[y][x].seen, true);
      assert.equal("spellSeen" in state.floor.g[y][x], false, `(${x},${y}) should have graduated`);
    }
  }

  move(state, "E", fakeRng([]), []);
  assert.ok(countFlagged(state.floor) <= afterFirst, "the flagged count never increases across steps");
});

// --- the ONE sweep at expiry, never a per-step poll (research Pitfall 4) --

test("the reveal window's sweep: no re-fog for 39 steps, exactly ONE sweep on the 40th, never a second", () => {
  const dirs = longCorridorDirs();
  const state = fixedState({
    c: { grimoire: ["Map the Floor"] },
    floor: { g: buildCorridorFloor(dirs), px: 1, py: 1, depth: 1 },
  });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  assert.equal(state.c.timers["spell:reveal"].left, 40);

  for (let i = 0; i < 39; i++) {
    const events = move(state, dirs[i], fakeRng([]), []);
    assert.equal(events.some((e) => e.type === "revealFaded"), false, `step ${i + 1}: no sweep yet`);
  }
  assert.ok(state.c.timers["spell:reveal"], "the record survives 39 ticks");
  assert.equal(state.c.timers["spell:reveal"].left, 1);

  const preFlagged = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (state.floor.g[y][x].spellSeen) preFlagged.push([x, y]);

  const events40 = move(state, dirs[39], fakeRng([]), []);
  const faded = events40.filter((e) => e.type === "revealFaded");
  assert.equal(faded.length, 1, "exactly one sweep on the 40th step");

  let refogged = 0;
  let graduated = 0;
  for (const [x, y] of preFlagged) {
    if (state.floor.g[y][x].seen === false) refogged++;
    else graduated++;
  }
  assert.equal(refogged + graduated, preFlagged.length);
  assert.equal(faded[0].cells, refogged, "the sweep re-fogs exactly the cells still flagged right before it ran");
  assert.equal("spell:reveal" in state.c.timers, false, "the record is gone");
  assert.equal(countFlagged(state.floor), 0, "the floor holds zero spellSeen keys after the sweep");

  for (let i = 40; i < dirs.length; i++) {
    const events = move(state, dirs[i], fakeRng([]), []);
    assert.equal(events.some((e) => e.type === "revealFaded"), false, `step ${i + 1}: no second sweep`);
  }
});

test("castSpell (Map the Floor): a recast at step 20 resets the window without ticking early", () => {
  const dirs = longCorridorDirs();
  const state = fixedState({
    c: { grimoire: ["Map the Floor"] },
    floor: { g: buildCorridorFloor(dirs), px: 1, py: 1, depth: 1 },
  });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  for (let i = 0; i < 20; i++) move(state, dirs[i], fakeRng([]), []);
  assert.equal(state.c.timers["spell:reveal"].left, 20);

  const preFlagged = countFlagged(state.floor);
  const recastEvents = castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  const floorMapped = recastEvents.find((e) => e.type === "floorMapped");
  assert.equal(floorMapped.cells, 0, "every cell reachable from here is already seen");
  assert.equal(countFlagged(state.floor), preFlagged, "no flag is set twice — the recast leaves the flagged count unchanged");
  assert.deepStrictEqual(state.c.timers["spell:reveal"], { cadence: "squares", left: 40, phase: "effect" });

  for (let i = 20; i < 25; i++) {
    const events = move(state, dirs[i], fakeRng([]), []);
    assert.equal(events.some((e) => e.type === "revealFaded"), false, "no premature sweep after the refresh");
  }
  assert.equal(state.c.timers["spell:reveal"].left, 35, "expiry now sits 40 squares after the recast, not the original cast");
});

// --- descend clears the record; teleport leaves it running -----------------

test("descend(): deletes a live spell:reveal record silently (no revealFaded), the new floor carries no flags", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  assert.ok(state.c.timers["spell:reveal"]);

  const events = descend(state, makeRng(7), []);
  assert.equal("spell:reveal" in state.c.timers, false, "the record is deleted");
  assert.equal(events.some((e) => e.type === "revealFaded"), false, "no sweep is narrated on descend");
  assert.equal(countFlagged(state.floor), 0, "the new floor carries no flags");
});

test("teleport(): graduates cells it reveals like any reveal() call, but never ticks or otherwise touches the spell:reveal record", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  const leftBefore = state.c.timers["spell:reveal"].left;

  teleport(state, makeRng(3), []);
  assert.equal(state.c.timers["spell:reveal"].left, leftBefore, "teleport never ticks the window");
  const { px, py } = state.floor;
  assert.equal(state.floor.g[py][px].seen, true);
  assert.equal("spellSeen" in state.floor.g[py][px], false, "the landed cell graduated like any other reveal() touch");
});

// --- conditionsOf's reveal chip ---------------------------------------------

test("conditionsOf: the reveal chip tracks the live spell:reveal window and is absent before/after", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  assert.equal(conditionsOf(state).some((c2) => c2.key === "reveal"), false);

  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  assert.deepStrictEqual(
    conditionsOf(state).find((c2) => c2.key === "reveal"),
    { key: "reveal", polarity: "good", remaining: 40, cadence: "squares" },
  );
});

// --- a fresh run carries no flag at all -------------------------------------

test("newRun(seed): no cell ever carries a spellSeen key, and c has no timers key, for every chargen pin seed", () => {
  const SEEDS = [1, 2, 3, 4, 6, 7, 8, 13, 14, 15, 17, 19, 24, 29, 32, 35, 38, 160, 256, 303];
  for (const seed of SEEDS) {
    const state = newRun(seed);
    assert.equal("timers" in state.c, false, `seed ${seed}: a fresh c must carry no timers key`);
    for (const row of state.floor.g) {
      for (const cell of row) {
        assert.equal("spellSeen" in cell, false, `seed ${seed}: a fresh floor must carry no spellSeen key`);
      }
    }
  }
});

// --- Task 2: the harness carve-out (structural tripwire) -------------------

test("stripSpellSeen (harness): returns the SAME floor object, unmutated, when no cell anywhere carries the flag", () => {
  const floor = fixedFloor();
  const stripped = stripSpellSeen(floor);
  assert.equal(stripped, floor, "a cheap no-op — the identical reference, not merely an equal one");
});

test("stripSpellSeen (harness): strips the flag from every carrying cell without mutating the input floor", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  assert.ok(countFlagged(state.floor) > 0);

  const before = JSON.stringify(state.floor);
  const stripped = stripSpellSeen(state.floor);
  assert.equal(JSON.stringify(state.floor), before, "the input floor is never mutated");
  assert.equal(countFlagged(stripped), 0, "every spellSeen key is gone from the stripped copy");
  for (const row of stripped.g) for (const cell of row) assert.equal("spellSeen" in cell, false);
});

// --- Task 2: narration coverage (floorMapped/revealFaded; detectMagic gone)

test("floorMapped/revealFaded: both have EVENT_NARRATION + LINE_FOR + RAIL_FAMILY entries; the retired event is gone from all three", () => {
  for (const type of ["floorMapped", "revealFaded"]) {
    assert.equal(typeof EVENT_NARRATION[type], "function", `EVENT_NARRATION.${type} must be a builder`);
    assert.equal(typeof LINE_FOR[type], "function", `LINE_FOR.${type} must be a builder`);
    assert.ok(RAIL_FAMILY[type], `RAIL_FAMILY.${type} must have a card identity`);
  }
  assert.equal("detectMagic" in EVENT_NARRATION, false);
  assert.equal("detectMagic" in LINE_FOR, false);
  assert.equal("detectMagic" in ORACLE_ONLY, false);
  assert.equal("detectMagic" in RAIL_FAMILY, false);

  const mapped = EVENT_NARRATION.floorMapped({ squares: 40 });
  assert.ok(/40/.test(mapped) && /squares/.test(mapped));
  const faded = EVENT_NARRATION.revealFaded({});
  assert.ok(/forgets/.test(faded));
});

// --- Task 2: the saveState boundary end to end ------------------------------

test("serializeRun -> validateSave round-trip: a LIVE spell:reveal window and its still-flagged cells survive intact", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  move(state, "E", fakeRng([]), []); // graduate a few cells, leave the rest flagged
  const flaggedBefore = countFlagged(state.floor);
  assert.ok(flaggedBefore > 0);

  const check = validateSave(JSON.stringify(serializeRun(state)));
  assert.equal(check.ok, true);
  assert.deepStrictEqual(check.value.c.timers["spell:reveal"], state.c.timers["spell:reveal"]);
  assert.equal(countFlagged(check.value.floor), flaggedBefore, "a live window's flags survive the round-trip untouched");
});

test("serializeRun -> validateSave round-trip: an expired/tampered-away window (no live record) has its stale flags cleared on load", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  delete state.c.timers["spell:reveal"]; // simulate the record having already expired/been dropped
  assert.ok(countFlagged(state.floor) > 0);

  const check = validateSave(JSON.stringify(serializeRun(state)));
  assert.equal(check.ok, true);
  assert.equal(countFlagged(check.value.floor), 0, "stale flags with no live record are cleared on load");
});

test("movementComparable/combatComparable/economyComparable (harness): a flagged floor never leaks a spellSeen key through any of the three", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] } });
  castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  assert.ok(countFlagged(state.floor) > 0);

  for (const cmp of [movementComparable, combatComparable, economyComparable]) {
    const out = cmp(structuredClone(state));
    assert.ok(out.floor, `${cmp.name}: floor must survive the comparable`);
    assert.equal(countFlagged(out.floor), 0, `${cmp.name}: no spellSeen key may leak through`);
  }
});
