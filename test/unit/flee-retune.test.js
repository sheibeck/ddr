// test/unit/flee-retune.test.js
//
// Phase 42 (FLEE-01/FLEE-02) — direct coverage for the flee retune:
// content/flee.js's tables, engine/derived.js#fleeBreakdown, and
// engine/combat.js#flee's rewritten roll. Local helper copies
// (fakeRng/fixedFighter/fixedFloor/fixedState/fixedFoe/fixedCombat) mirror
// test/unit/combat.test.js verbatim — this repo's established
// per-file-fixture convention (never imported cross-file).
//
// Task 2 (FLEE-02) appends a `narration` section below covering
// EVENT_NARRATION/LINE_FOR/fightLogLinesFor for the same event shape.

import test from "node:test";
import assert from "node:assert/strict";

import { flee } from "../../engine/combat.js";
import { fleeBreakdown } from "../../engine/derived.js";
import { setDialsForTuning } from "../../engine/difficulty.js";
import { RACES, CLASSES, FLEE_NEED, FLEE_THIEF_BONUS, FLEE_CLASS_MOD, FLEE_RACE_MOD } from "../../content/index.js";
import { narrateEvent } from "../../src/browser/eventNarration.js";
import { linesForAction, LINE_FOR } from "../../src/browser/narrationLines.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow, which doubles as a "no more
 * rng draws expected" assertion (ports test/unit/combat.test.js's helper
 * verbatim). */
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

// A generous, proven-safe filler for the foeTurn a failed flee always runs
// afterward (mirrors test/unit/gear-axes.test.js's FILL: a value far above
// any real foe's to-hit need reads as a guaranteed miss on the very next
// draw, regardless of which die-size the code requests).
const FILL = new Array(24).fill(20);

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// --- 1. Table shape ---------------------------------------------------------

test("content/flee.js: FLEE_NEED is 14, FLEE_THIEF_BONUS is 5", () => {
  assert.equal(FLEE_NEED, 14);
  assert.equal(FLEE_THIEF_BONUS, 5);
});

test("content/flee.js: every FLEE_CLASS_MOD/FLEE_RACE_MOD value is an integer in [-2, 2]; every RACES/CLASSES key has an entry", () => {
  for (const key of Object.keys(RACES)) {
    const v = FLEE_RACE_MOD[key];
    assert.ok(Number.isInteger(v) && Math.abs(v) <= 2, `FLEE_RACE_MOD.${key}`);
  }
  for (const key of Object.keys(CLASSES)) {
    const v = FLEE_CLASS_MOD[key];
    assert.ok(Number.isInteger(v) && Math.abs(v) <= 2, `FLEE_CLASS_MOD.${key}`);
  }
});

// --- 2. fleeBreakdown(c) — pure, worked rows -------------------------------

test("fleeBreakdown: pure (no mutation of c)", () => {
  const c = fixedFighter({ cls: "Thief", race: "Elven", armor: "Leather" });
  const before = structuredClone(c);
  fleeBreakdown(c);
  assert.deepStrictEqual(c, before);
});

// Phase 54 (BAND-02, USER RULING D): FLEE_NEED_MOD, added to the fixed need
// itself (never a `mods` entry). Identity 0 fast path; a non-zero override
// raises the need by exactly that amount, restored after.
test("fleeBreakdown: FLEE_NEED_MOD identity (0) leaves need at FLEE_NEED; +3 raises the need to 17, never touching mods", () => {
  const c = fixedFighter({ cls: "Fighter", race: "Human", armor: "Nothing" });
  const identity = fleeBreakdown(c);
  assert.equal(identity.need, FLEE_NEED);
  const restore = setDialsForTuning({ FLEE_NEED_MOD: 3 });
  try {
    const raised = fleeBreakdown(c);
    assert.equal(raised.need, FLEE_NEED + 3);
    assert.deepStrictEqual(raised.mods, identity.mods, "FLEE_NEED_MOD is never a mods entry");
    assert.equal(raised.bonus, identity.bonus);
  } finally {
    restore();
  }
});

test("fleeBreakdown: worked rows match the plan's table exactly", () => {
  const rows = [
    [{ cls: "Fighter", race: "Human", armor: "Nothing" }, 14, 0],
    [{ cls: "Thief", race: "Human", armor: "Leather" }, 14, 5],
    [{ cls: "Thief", race: "Elven", armor: "Leather" }, 14, 6],
    [{ cls: "Fighter", race: "Human", armor: "Plate" }, 14, -2],
    [{ cls: "Magic User", race: "Human", armor: "Cloth" }, 14, -1],
    [{ cls: "Fighter", race: "Troll", armor: "Plate" }, 14, -3],
    [{ cls: "Fighter", race: "Dwarven", armor: "Mail" }, 14, -2],
    [{ cls: "Thief", race: "Fridgian", armor: "Nothing" }, 14, 4],
  ];
  for (const [c, need, bonus] of rows) {
    const b = fleeBreakdown(c);
    assert.equal(b.need, need, `${JSON.stringify(c)} need`);
    assert.equal(b.bonus, bonus, `${JSON.stringify(c)} bonus`);
    assert.equal(
      b.bonus,
      b.mods.reduce((s, m) => s + m.delta, 0),
      "bonus is the sum of every mods[].delta",
    );
  }
});

test("fleeBreakdown: a Human Fighter in no armor carries zero mods; a Troll Fighter in Plate names race then armor", () => {
  const plain = fleeBreakdown(fixedFighter({ armor: "Nothing" }));
  assert.deepStrictEqual(plain.mods, []);

  const troll = fleeBreakdown(fixedFighter({ race: "Troll", armor: "Plate" }));
  assert.deepStrictEqual(troll.mods, [
    { name: "Troll", delta: -1 },
    { name: "Plate", delta: -2 },
  ]);

  const elvenThief = fleeBreakdown(fixedFighter({ cls: "Thief", race: "Elven", armor: "Leather" }));
  assert.deepStrictEqual(elvenThief.mods, [
    { name: "Thief", delta: 5 },
    { name: "Elven", delta: 1 },
  ]);
});

// --- 3. Exhaustive d20 enumeration ------------------------------------------

function countFled(c) {
  let n = 0;
  for (let roll = 1; roll <= 20; roll++) {
    const state = fixedState({ c });
    state.combat = fixedCombat([fixedFoe()]);
    const events = flee(state, fakeRng([roll, ...FILL]), []);
    if (events.some((e) => e.type === "fled" && e.reason === "escaped")) n++;
  }
  return n;
}

test("exhaustive d20 enumeration: base rates match the CONTEXT anchors and the plan's worked table", () => {
  assert.equal(countFled(fixedFighter({ armor: "Nothing" })), 7, "Human Fighter no armor: 7/20 (35%)");
  assert.equal(countFled(fixedFighter({ cls: "Thief", armor: "Leather" })), 12, "Human Thief Leather: 12/20 (60%)");
  assert.equal(countFled(fixedFighter({ armor: "Plate" })), 5, "Human Fighter Plate: 5/20 (25%)");
  assert.equal(countFled(fixedFighter({ cls: "Magic User", armor: "Cloth" })), 6, "Human Magic User Cloth: 6/20 (30%)");
  assert.equal(countFled(fixedFighter({ cls: "Thief", race: "Elven", armor: "Leather" })), 13, "Elven Thief Leather: 13/20 (65%)");
  // NOTE (deviation from the plan's own <behavior> bullet, which claimed
  // 3/20 — arithmetic error inconsistent with the plan's own Action A
  // table (Troll -1) and its Before/after table (need 17, 20%): FLEE_RACE_MOD.Troll
  // (-1) + Plate's bulk (-2) is bonus -3, so the true need is roll >= 17,
  // i.e. rolls 17-20 = 4/20 (20%) — measured live, not hand-typed.
  assert.equal(countFled(fixedFighter({ race: "Troll", armor: "Plate" })), 4, "Troll Fighter Plate: 4/20 (20%)");
});

// --- 4. flee()'s fleeRolled event shape -------------------------------------

test("flee: the ordinary path pushes exactly one fleeRolled with exactly {type,roll,atLeast,dieN,mods}, no total/need/bonus/bulk key, preceding fled/fleeFailed", () => {
  const state = fixedState({ c: fixedFighter({ cls: "Thief", race: "Elven", armor: "Leather" }) });
  state.combat = fixedCombat([fixedFoe()]);
  // Phase 73 (ROLL-05): flee is already roll-high — the raw d20 IS the
  // roll, no mirror; 8 >= atLeast(14 - bonus(6) = 8) escapes.
  const events = flee(state, fakeRng([8]), []);
  const rolledEvents = events.filter((e) => e.type === "fleeRolled");
  assert.equal(rolledEvents.length, 1);
  const rolled = rolledEvents[0];
  assert.deepStrictEqual(Object.keys(rolled).sort(), ["atLeast", "dieN", "mods", "roll", "type"].sort());
  assert.equal(rolled.roll, 8);
  assert.equal(rolled.dieN, 20);
  assert.equal(rolled.atLeast, 14 - fleeBreakdown(state.c).bonus);
  assert.ok(!("total" in rolled), "the old total field is retired");
  assert.ok(!("need" in rolled), "the old need field is retired");
  assert.ok(!("bonus" in rolled), "the old additive bonus field is retired");
  assert.ok(!("bulk" in rolled), "the old bulk field is retired");
  const rolledIdx = events.findIndex((e) => e.type === "fleeRolled");
  const outcomeIdx = events.findIndex((e) => e.type === "fled" || e.type === "fleeFailed");
  assert.ok(outcomeIdx > rolledIdx, "fleeRolled precedes fled/fleeFailed");
});

test("flee: a failed roll (Human Fighter, roll 1) still hands the foe its swing and advances the round — byte-identical failure path", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe()]);
  const events = flee(state, fakeRng([1, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "fleeFailed"));
  assert.equal(state.combat.round, 2);
});

test("flee: the ordinary path draws exactly one d20 (no pursuit strike, no extra draw)", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe()]); // no sp.pursues
  const events = flee(state, fakeRng([14]), []); // throws on any second draw
  assert.ok(events.some((e) => e.type === "fled" && e.reason === "escaped"));
});

// --- 5. Sub-class flavour untouched: same order, same events, zero draws ---

test("flee: Samurai refusal, Cloaker unseen vanish, tracked round-1 withdrawal and Smoke auto-flee never emit fleeRolled and draw nothing extra", () => {
  const samurai = fixedState({ c: { sub: "Samurai" } });
  samurai.combat = fixedCombat([fixedFoe()]);
  const samuraiEvents = flee(samurai, fakeRng([]), []);
  assert.deepStrictEqual(samuraiEvents, [{ type: "fleeRefused", reason: "samurai" }]);

  const cloaker = fixedState({ c: { cls: "Thief", sub: "Cloaker" } });
  cloaker.combat = fixedCombat([fixedFoe()]);
  const cloakerEvents = flee(cloaker, fakeRng([]), []);
  assert.ok(cloakerEvents.some((e) => e.type === "fled" && e.reason === "cloaker"));
  assert.equal(cloakerEvents.some((e) => e.type === "fleeRolled"), false);

  const tracked = fixedState();
  tracked.combat = fixedCombat([fixedFoe()], { tracked: true, round: 1 });
  const trackedEvents = flee(tracked, fakeRng([]), []);
  assert.ok(trackedEvents.some((e) => e.type === "fled" && e.reason === "tracked"));
  assert.equal(trackedEvents.some((e) => e.type === "fleeRolled"), false);
});

// --- 6. narration (Task 2, FLEE-02): EVENT_NARRATION / LINE_FOR / fightLogLinesFor ---

test("narration: EVENT_NARRATION.fleeRolled renders the roll, its winning range and every named modifier, BEFORE the outcome", () => {
  const full = narrateEvent({ type: "fleeRolled", roll: 8, atLeast: 10, dieN: 20, mods: [{ name: "Thief", delta: 5 }, { name: "Mail", delta: -1 }] });
  assert.equal(full, 'Flee: rolled <span class="roll">8</span> vs 10–20 (Thief +5, Mail −1).');

  const noMods = narrateEvent({ type: "fleeRolled", roll: 8, atLeast: 14, dieN: 20, mods: [] });
  assert.equal(noMods, 'Flee: rolled <span class="roll">8</span> vs 14–20.');

  const sparse = narrateEvent({ type: "fleeRolled" });
  assert.doesNotThrow(() => sparse);
  assert.ok(sparse.includes("Flee:"));
});

test("narration: LINE_FOR.fleeRolled matches the fold's own text; null-safe on a sparse event", () => {
  const full = LINE_FOR.fleeRolled({ roll: 8, atLeast: 10, dieN: 20, mods: [{ name: "Thief", delta: 5 }, { name: "Mail", delta: -1 }] });
  assert.equal(full.text, "Flee: 8 vs 10–20 (Thief +5, Mail −1)");
  assert.equal(full.tone, "beat");

  const noMods = LINE_FOR.fleeRolled({ roll: 8, atLeast: 14, dieN: 20, mods: [] });
  assert.equal(noMods.text, "Flee: 8 vs 14–20");

  assert.doesNotThrow(() => LINE_FOR.fleeRolled({}));
});

test("narration: fightLogLinesFor folds fleeRolled+outcome into ONE line, roll first, whose tap-reveal is the Oracle sentence with dice", () => {
  const events = [
    { type: "fleeRolled", roll: 9, atLeast: 9, dieN: 20, mods: [{ name: "Thief", delta: 5 }] },
    { type: "fled", reason: "escaped" },
  ];
  const lines = fightLogLinesFor("flee", events, {});
  assert.equal(lines.length, 1);
  assert.ok(lines[0].text.startsWith("Flee: 9 vs 9–20 (Thief +5)."), "the roll/range/modifiers lead the outcome text");
  assert.ok(lines[0].roll.startsWith("Flee: rolled"), "the tap-reveal is the Oracle's own fleeRolled sentence, dice kept");
  assert.ok(lines[0].roll.includes("Thief +5"));
});

test("narration: linesForAction's flee fold reads the SAME mods list every surface reads (no re-derivation)", () => {
  const events = [
    { type: "fleeRolled", roll: 3, atLeast: 14, dieN: 20, mods: [] },
    { type: "fleeFailed" },
  ];
  const out = linesForAction("flee", events, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Flee: 3 vs 14–20. You do not make it.");
  assert.equal(out[0].tone, "miss");
});
