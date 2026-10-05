// test/unit/joiner-level-cap.test.js
//
// Phase 94.1 (JOIN-01, user ruling 2026-10-03: "you should never find a level 5
// Joiner at level 5 dungeon. Max level on find should be dungeon depth / 3
// (min. 1)") — meetJoiner's Level Table roll is capped by the floor's band:
// `const lvl = Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1],
// joinerLevelCap(state.floor.depth));` (engine/encounters.js), where
// joinerLevelCap(depth) = ceil(depth / 3) held to 1..5. It replaces Phase 53's
// (JOIN-02) cap at the floor NUMBER. A cap, not an exact level: a low roll
// stays low. The d10 is still drawn FIRST, so the draw count and the delegate
// rng cursor stay byte-identical — every downstream read (grantLevelAbilities,
// both `20 * lvl + d20` wp rolls, c.joiner, pendingJoiner, joinerMet/
// joinerRefused, the caster's starting scroll) takes the ONE capped `lvl`
// binding. A Joiner keeps the level it was met at (user: "Don't level
// Joiners"): nothing re-levels it on descent or on load.
//
// THE RULE (mirrors test/unit/foe-turn-draw-count.test.js): a draw-count or
// cursor mismatch here means meetJoiner's draw ORDER changed — that is a bug
// in the engine edit, never a reason to touch a pinned number in this file.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { meetJoiner, resolveJoiner, joinerLevelCap } from "../../engine/encounters.js";
import { rollCharacter, grantLevelAbilities } from "../../engine/character.js";
import { spellLevelFor } from "../../engine/derived.js";
import { descend } from "../../engine/movement.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun, validateSave } from "../../engine/saveState.js";
import { makeRng } from "../../engine/rng.js";
import { SPELL_LEVEL_TABLE } from "../../content/misc-tables.js";
import { SPELLS } from "../../content/index.js";
import { narrateEvent } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { validatePatchNotes } from "../../tools/lib/patch-notes.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// --- fixedFighter/fixedFloor/fixedState — copied verbatim from
// test/unit/joiner-acquisition.test.js, with identity-world.test.js's
// `pendingJoiner: null` default folded in (this file's own refusal test
// needs a real `null` to assert against, not `undefined`). ------------------
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
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "", pendingJoiner: null,
    ...rest,
  };
}

// --- countingRng(inner) — copied verbatim from
// test/unit/foe-turn-draw-count.test.js. ------------------------------------
function countingRng(inner) {
  let draws = 0;
  const wrapped = {
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
  if (typeof inner.next === "function") {
    wrapped.next = () => {
      draws++;
      return inner.next();
    };
  }
  if (typeof inner.getState === "function") wrapped.getState = inner.getState;
  if (typeof inner.setState === "function") wrapped.setState = inner.setState;
  return wrapped;
}

// --- scriptedFirstD10(first, seed) — a rng whose FIRST d(sides) call MUST be
// the Level Table d10 (asserted), returning `first` WITHOUT touching the
// delegate; every OTHER call (d/pick/shuffle/next/getState/setState) forwards
// to a private `makeRng(seed)`. So a capped roll (first = a high value) and a
// native roll (first = the floor's own value) share the IDENTICAL
// rollCharacter/wp-d20 stream off the same seed — the only way to prove the
// downstream reads by deepStrictEqual. ----------------------------------
function scriptedFirstD10(first, seed) {
  const delegate = makeRng(seed);
  let usedFirst = false;
  return {
    d(sides) {
      if (!usedFirst) {
        usedFirst = true;
        assert.equal(sides, 10, "scriptedFirstD10: the very first d() call must be meetJoiner's Level Table d10");
        return first;
      }
      return delegate.d(sides);
    },
    pick: (arr) => delegate.pick(arr),
    shuffle: (arr) => delegate.shuffle(arr),
    next: () => delegate.next(),
    getState: () => delegate.getState(),
    setState: (s) => delegate.setState(s),
  };
}

// --- SEED_FT / SEED_MU — measured ONCE by a search loop while writing the
// Phase 53 version of this test (1..500), pinned as named constants:
//   SEED_FT = 1  — the smallest seed whose rollCharacter(makeRng(seed)).cls
//                  is Fighter or Thief (a Knight, Fridgian) — non-vacuous
//                  abilities assertion (a Magic User's pool is empty).
//   SEED_MU = 7  — the smallest seed whose class is Magic User (a Wizard,
//                  Human) — for the Wilmsry refusal payload.
const SEED_FT = 1;
const SEED_MU = 7;

// The literal cap by floor — never computed from joinerLevelCap itself.
const BAND = { 1: 1, 3: 1, 4: 2, 6: 2, 7: 3, 9: 3, 10: 4, 12: 4, 13: 5, 20: 5 };
const EDGES = [1, 3, 4, 6, 7, 9, 10, 12, 13, 20];
const FACES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ─── joinerLevelCap ─────────────────────────────────────────────────────

test("joinerLevelCap: one level per three floors, at least 1 and at most 5 (floors 1–3 give 1, 4–6 give 2, 7–9 give 3, 10–12 give 4, 13 and deeper give 5)", () => {
  const got = [];
  for (let d = 1; d <= 20; d++) got.push(joinerLevelCap(d));
  assert.deepStrictEqual(got, [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5]);
  assert.equal(joinerLevelCap(30), 5);
  assert.equal(joinerLevelCap(100), 5);
});

test("joinerLevelCap: band edges and one step either side, a ceiling and never floor or round (3 gives 1, 4 and 5 give 2, 12 gives 4, 13 gives 5)", () => {
  assert.equal(joinerLevelCap(3), 1);
  assert.equal(joinerLevelCap(4), 2);
  assert.equal(joinerLevelCap(5), 2);
  assert.equal(joinerLevelCap(6), 2);
  assert.equal(joinerLevelCap(7), 3);
  assert.equal(joinerLevelCap(9), 3);
  assert.equal(joinerLevelCap(10), 4);
  assert.equal(joinerLevelCap(12), 4);
  assert.equal(joinerLevelCap(13), 5);
  for (const [lo, hi] of [[3, 4], [6, 7], [9, 10], [12, 13]]) {
    assert.equal(joinerLevelCap(hi) - joinerLevelCap(lo), 1, `floors ${lo} and ${hi} differ by exactly one level of cap`);
  }
  // multiples of 3 land exactly on the integer: no float drift
  assert.deepStrictEqual([3, 6, 9, 12].map(joinerLevelCap), [1, 2, 3, 4]);
});

test("joinerLevelCap: a depth below 1, not finite or missing reads as floor 1, and a fractional depth is floored first as difficulty.js#safeDepth does (3.9 gives 1, 4.2 gives 2)", () => {
  for (const bad of [0, -1, -10, NaN, undefined, null, Infinity, -Infinity]) {
    assert.equal(joinerLevelCap(bad), 1, `joinerLevelCap(${String(bad)}) reads as floor 1`);
  }
  assert.equal(joinerLevelCap(3.9), 1);
  assert.equal(joinerLevelCap(4.2), 2);
  for (const d of [0, -1, NaN, undefined, null, Infinity, 1, 2.5, 3.9, 4.2, 12.9, 13, 99, 1e9]) {
    const v = joinerLevelCap(d);
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 5, `joinerLevelCap(${String(d)}) = ${v} is an integer from 1 to 5`);
  }
});

// ─── meetJoiner: the level ──────────────────────────────────────────────

test("meetJoiner at every band edge (floors 1, 3, 4, 6, 7, 9, 10, 12, 13, 20) and every d10 face: the level is min(the Level Table roll, the floor's cap), on pendingJoiner, c.joiner and joinerMet alike", () => {
  for (const depth of EDGES) {
    for (const face of FACES) {
      const want = Math.min(SPELL_LEVEL_TABLE[face - 1], BAND[depth]);
      const state = fixedState({ floor: { depth } });
      const events = meetJoiner(state, scriptedFirstD10(face, SEED_FT), []);
      const tag = `floor ${depth}, d10 ${face}`;
      assert.equal(state.pendingJoiner.lvl, want, `${tag}: pendingJoiner.lvl`);
      assert.equal(state.pendingJoiner.level, want, `${tag}: pendingJoiner.level`);
      assert.equal(state.c.joiner.lvl, want, `${tag}: c.joiner.lvl`);
      assert.equal(events.find((e) => e.type === "joinerMet").lvl, want, `${tag}: joinerMet.lvl`);
    }
  }
});

test("a cap, not a level: a d10 of 1 is level 1 on floor 20, a d10 of 3 is level 2 on floor 4, a d10 of 10 is level 4 on floor 12 and level 5 on floor 13, and a d10 of 9 on floor 5 is level 2", () => {
  const lvlAt = (face, depth) => {
    const s = fixedState({ floor: { depth } });
    meetJoiner(s, scriptedFirstD10(face, SEED_FT), []);
    return s.pendingJoiner.lvl;
  };
  assert.equal(lvlAt(1, 20), 1, "a low roll stays low on the deepest floor: the cap never raises");
  assert.equal(lvlAt(2, 20), 1);
  assert.equal(lvlAt(3, 4), 2, "a roll equal to the cap is exactly that level");
  assert.equal(lvlAt(4, 4), 2);
  assert.equal(lvlAt(10, 12), 4, "level 5 needs floor 13: a d10 of 10 on floor 12 is level 4");
  assert.equal(lvlAt(10, 13), 5);
  assert.equal(lvlAt(9, 5), 2, "the 2026-10-03 complaint: a d10 of 9 on floor 5 is level 2, not 5");
  assert.equal(lvlAt(9, 3), 1);
});

test("hp follows the level: wp is 20 x level + the first d20 after rollCharacter at every band edge, maxWP mirrors it and c.joiner agrees", () => {
  const ctrl = makeRng(SEED_FT);
  rollCharacter(ctrl);
  const firstD20 = ctrl.d(20);
  for (const depth of EDGES) {
    const state = fixedState({ floor: { depth } });
    meetJoiner(state, scriptedFirstD10(10, SEED_FT), []);
    const lvl = Math.min(5, BAND[depth]);
    assert.equal(state.pendingJoiner.lvl, lvl, `floor ${depth}`);
    assert.equal(state.pendingJoiner.wp, 20 * lvl + firstD20, `floor ${depth}: wp = 20 x level + the first d20`);
    assert.equal(state.pendingJoiner.maxWP, state.pendingJoiner.wp, `floor ${depth}: maxWP mirrors wp`);
    assert.equal(state.c.joiner.wp, state.c.joiner.maxWP, `floor ${depth}: c.joiner mirrors the same shape`);
    assert.equal(state.c.joiner.wp, state.pendingJoiner.wp, `floor ${depth}: c.joiner and pendingJoiner agree`);
  }
});

test("abilities follow the level: a Joiner's abilities equal grantLevelAbilities rebuilt at its capped level from the same stream at every band edge, and a capped Joiner equals a natively rolled Joiner of the same level", () => {
  for (const depth of EDGES) {
    const state = fixedState({ floor: { depth } });
    meetJoiner(state, scriptedFirstD10(10, SEED_FT), []);
    const lvl = BAND[depth];
    const twin = rollCharacter(makeRng(SEED_FT));
    grantLevelAbilities(twin, `joiner:${twin.name}:${depth}`, lvl);
    assert.deepStrictEqual(state.pendingJoiner.abilities, twin.abilities, `floor ${depth}: abilities equal a rebuild at level ${lvl}`);
  }

  assert.equal(SPELL_LEVEL_TABLE[2], 2, "d10 of 3 indexes SPELL_LEVEL_TABLE[2] = 2 (a NATIVE level-2 roll, no cap applied)");
  const capped = fixedState({ floor: { depth: 4 } });
  const cappedEvents = meetJoiner(capped, scriptedFirstD10(9, SEED_FT), []);
  const native = fixedState({ floor: { depth: 4 } });
  const nativeEvents = meetJoiner(native, scriptedFirstD10(3, SEED_FT), []);
  assert.deepStrictEqual(capped.pendingJoiner, native.pendingJoiner, "pendingJoiner is identical whether level 2 was capped or rolled natively");
  assert.deepStrictEqual(capped.c.joiner, native.c.joiner, "c.joiner is identical");
  assert.deepStrictEqual(
    cappedEvents.find((e) => e.type === "joinerMet"),
    nativeEvents.find((e) => e.type === "joinerMet"),
    "the joinerMet event is identical",
  );
  assert.ok(capped.pendingJoiner.abilities.length > 0, "non-vacuous: a Knight carries level-pool abilities");

  // Negative: a level-5 twin has MORE ability ids than the capped level-2
  // Joiner, so the pre-cap level never leaks into the abilities grant.
  const level5Twin = rollCharacter(makeRng(SEED_FT));
  grantLevelAbilities(level5Twin, `joiner:${level5Twin.name}:4`, 5);
  assert.ok(level5Twin.abilities.length > capped.pendingJoiner.abilities.length, "the level-5 twin has MORE ability ids than the capped level-2 Joiner");
});

test("a Magic User Joiner's starting scroll is read at its capped level: met on floor 4 with a rolled 5 it joins at level 2, and any spell it copies is castable at level 2", () => {
  const state = fixedState({ floor: { depth: 4 } });
  meetJoiner(state, scriptedFirstD10(9, SEED_MU), []);
  assert.equal(state.pendingJoiner.cls, "Magic User");
  assert.equal(state.pendingJoiner.lvl, 2);
  const events = resolveJoiner(state, true, []);
  const joined = events.find((e) => e.type === "joinerJoined");
  assert.ok(joined, "joinerJoined fires");
  assert.equal(joined.lvl, 2, "joinerJoined.lvl is the capped level");
  assert.ok("scroll" in joined, "a Magic User with a scroll reports the scroll key");
  if (joined.scroll !== null) {
    const sp = SPELLS.find((s) => s.n === joined.scroll);
    assert.ok(sp, "the copied spell exists");
    assert.ok(spellLevelFor(state.party[0].sub, sp) <= 2, "the copied spell is castable at level 2");
  }
});

// ─── meetJoiner: draws, cursor, refusal ─────────────────────────────────

test("the draw count and cursor are unchanged: one d10, rollCharacter's own draws and two d20s at every band edge and every face, the cursor lands in the same place, and the next draw matches the hand-replayed control", () => {
  const rcCounter = countingRng(makeRng(SEED_FT));
  rollCharacter(rcCounter);
  const expectedDraws = 1 + rcCounter.draws + 2;

  const ctrl = makeRng(SEED_FT);
  rollCharacter(ctrl);
  ctrl.d(20);
  ctrl.d(20);
  const ctrlState = ctrl.getState();
  const ctrlNext = ctrl.d(20);

  for (const depth of EDGES) {
    for (const face of FACES) {
      const rng = countingRng(scriptedFirstD10(face, SEED_FT));
      meetJoiner(fixedState({ floor: { depth } }), rng, []);
      const tag = `floor ${depth}, d10 ${face}`;
      assert.equal(rng.draws, expectedDraws, `${tag}: 1 (d10) + rollCharacter's own draws + 2 (the wp d20 x2)`);
      assert.equal(rng.getState(), ctrlState, `${tag}: the cursor lands where the hand-replayed control's does`);
      assert.equal(rng.d(20), ctrlNext, `${tag}: the next draw equals the control's`);
    }
  }
});

test("Wilmsry refusal: a Magic User met on floor 4 with a rolled 5 is refused at level 2 (joinerRefused.lvl 2), pendingJoiner stays null, and the payload key sets are pinned", () => {
  const state = fixedState({ c: { race: "Wilmsry" }, floor: { depth: 4 } });
  const events = meetJoiner(state, scriptedFirstD10(9, SEED_MU), []);
  const met = events.find((e) => e.type === "joinerMet");
  const refused = events.find((e) => e.type === "joinerRefused");
  assert.ok(met, "joinerMet still fires before the refusal");
  assert.ok(refused, "joinerRefused fires");
  assert.equal(met.lvl, 2, "joinerMet.lvl is the capped level");
  assert.equal(refused.lvl, 2, "joinerRefused.lvl is the capped level");
  assert.equal(refused.reason, "wilmsry");
  assert.equal(state.pendingJoiner, null, "pendingJoiner stays null on a refusal");
  assert.deepStrictEqual(Object.keys(met), ["type", "name", "race", "sub", "lvl"], "joinerMet's key set is pinned");
  assert.deepStrictEqual(Object.keys(refused), ["type", "reason", "name", "sub", "cls", "lvl"], "joinerRefused's key set is pinned");
});

// ─── a Joiner keeps the level it was met at ─────────────────────────────

test("a Joiner keeps the level it was met at: four descents from floor 1 leave a level-1 Joiner at level 1 with the same maxWP and abilities", () => {
  const state = newRun(11, [], { force: { cls: "Fighter", sub: "Soldier", race: "Human" } });
  assert.equal(state.floor.depth, 1);
  meetJoiner(state, scriptedFirstD10(9, SEED_FT), []);
  resolveJoiner(state, true, []);
  const member = state.party[0];
  const before = { lvl: member.lvl, level: member.level, maxWP: member.maxWP, abilities: [...member.abilities] };
  assert.equal(before.lvl, 1, "a rolled 5 met on floor 1 is capped to level 1");
  assert.equal(before.level, 1);
  assert.ok(before.abilities.length > 0, "non-vacuous: the Knight carries abilities");

  for (let i = 0; i < 4; i++) {
    const rng = makeRng(state.rngState);
    descend(state, rng, []);
    state.rngState = rng.getState();
  }
  assert.equal(state.floor.depth, 5, "four descents reach floor 5 (cap 2)");
  const after = state.party[0];
  assert.deepStrictEqual(
    { lvl: after.lvl, level: after.level, maxWP: after.maxWP, abilities: [...after.abilities] },
    before,
    "nothing re-levels a Joiner on descent",
  );
});

test("old saves load as they were: a level-4 Joiner in the party and a level-4 pending offer saved on floor 2 load at level 4 (no re-levelling on load)", () => {
  const forced = { cls: "Fighter", sub: "Soldier", race: "Human" };

  const partyRun = newRun(11, [], { force: forced });
  partyRun.floor.depth = 13;
  meetJoiner(partyRun, scriptedFirstD10(7, SEED_FT), []);
  assert.equal(partyRun.pendingJoiner.lvl, 4, "d10 of 7 is Level Table 4, under the floor-13 cap of 5");
  resolveJoiner(partyRun, true, []);
  partyRun.floor.depth = 2;
  const loadedParty = validateSave(JSON.stringify(serializeRun(partyRun)));
  assert.equal(loadedParty.ok, true, loadedParty.reason);
  assert.equal(loadedParty.value.party[0].lvl, 4);
  assert.equal(loadedParty.value.party[0].level, 4);

  const offerRun = newRun(11, [], { force: forced });
  offerRun.floor.depth = 13;
  meetJoiner(offerRun, scriptedFirstD10(7, SEED_FT), []);
  offerRun.floor.depth = 2;
  const loadedOffer = validateSave(JSON.stringify(serializeRun(offerRun)));
  assert.equal(loadedOffer.ok, true, loadedOffer.reason);
  assert.equal(loadedOffer.value.pendingJoiner.lvl, 4);
  assert.equal(loadedOffer.value.pendingJoiner.level, 4);
});

// ─── shapes / narration / rail-card source pins ─────────────────────────

test("shape: c.joiner keeps its frozen 7-key shape, and pendingJoiner's only new key is lvl (level, wp and maxWP are overridden, not added)", () => {
  const state = fixedState({ floor: { depth: 4 } });
  meetJoiner(state, scriptedFirstD10(9, SEED_FT), []);
  assert.deepStrictEqual(
    Object.keys(state.c.joiner).sort(),
    ["cls", "lvl", "maxWP", "name", "race", "sub", "wp"],
    "c.joiner's frozen 7-key shape is unchanged",
  );
  // Measured (not assumed): rollCharacter's own sheet ALREADY carries level/
  // wp/maxWP (level: 1, wp/maxWP from the class roll) — meetJoiner's spread
  // OVERRIDES those three to the joiner's own combat stats rather than
  // adding new keys; `lvl` is the only key genuinely absent from a bare
  // rollCharacter sheet.
  const sheetKeys = new Set(Object.keys(rollCharacter(makeRng(SEED_FT))));
  const pendingKeys = new Set(Object.keys(state.pendingJoiner));
  const added = [...pendingKeys].filter((k) => !sheetKeys.has(k));
  assert.deepStrictEqual(added.sort(), ["lvl"], "pendingJoiner's only genuinely NEW key (vs. the key SET already on a rollCharacter sheet) is lvl");
  const overridden = ["level", "wp", "maxWP"].filter((k) => sheetKeys.has(k));
  assert.deepStrictEqual(overridden.sort(), ["level", "maxWP", "wp"], "level/wp/maxWP pre-exist on the sheet and are overridden by the joiner spread, never appended as new keys");
  assert.equal(state.pendingJoiner.level, state.pendingJoiner.lvl, "pendingJoiner.level is overridden to the (capped) joiner lvl");
  assert.equal(state.pendingJoiner.wp, state.pendingJoiner.maxWP, "pendingJoiner.wp/maxWP are overridden to the joiner's own combat wp (the discarded second roll)");
});

test("narration: joinerMet and joinerRefused render identically for a capped and a natively rolled Joiner of the same level, and match today's copy verbatim", () => {
  const capped = fixedState({ floor: { depth: 4 } });
  const cappedEvents = meetJoiner(capped, scriptedFirstD10(9, SEED_FT), []);
  const native = fixedState({ floor: { depth: 4 } });
  const nativeEvents = meetJoiner(native, scriptedFirstD10(3, SEED_FT), []);
  assert.equal(
    narrateEvent(cappedEvents.find((e) => e.type === "joinerMet")),
    narrateEvent(nativeEvents.find((e) => e.type === "joinerMet")),
    "joinerMet renders identically for a capped vs a natively-rolled same-level Joiner",
  );

  const cappedWilmsry = fixedState({ c: { race: "Wilmsry" }, floor: { depth: 4 } });
  const cappedRefusedEvents = meetJoiner(cappedWilmsry, scriptedFirstD10(9, SEED_MU), []);
  const nativeWilmsry = fixedState({ c: { race: "Wilmsry" }, floor: { depth: 4 } });
  const nativeRefusedEvents = meetJoiner(nativeWilmsry, scriptedFirstD10(3, SEED_MU), []);
  const cappedRefused = cappedRefusedEvents.find((e) => e.type === "joinerRefused");
  const nativeRefused = nativeRefusedEvents.find((e) => e.type === "joinerRefused");
  assert.equal(narrateEvent(cappedRefused), narrateEvent(nativeRefused), "joinerRefused renders identically for a capped vs a natively-rolled same-level Joiner");
  assert.equal(
    LINE_FOR.joinerRefused(cappedRefused).text,
    LINE_FOR.joinerRefused(nativeRefused).text,
    "LINE_FOR.joinerRefused renders identically for a capped vs a natively-rolled same-level Joiner",
  );

  // Literal snapshots against today's copy (read verbatim from the source
  // files while writing this test):
  // VOX-05 (79-11): the meeting is an offer (the accept, decline or refusal
  // follows), and it states the Joiner's level.
  assert.equal(
    narrateEvent({ type: "joinerMet", name: "Ada Brook", race: "Human", sub: "Guard", lvl: 2 }),
    '<span class="hit">Ada Brook</span>, a level 2 Guard, offers to travel with you for a while.',
  );
  assert.equal(
    narrateEvent({ type: "joinerRefused", reason: "wilmsry", name: "Ada Brook", sub: "Apprentice", cls: "Magic User", lvl: 2 }),
    // Phase 91 plan 08 (IDENT-21, user 2026-09-30): the WILMSRY refuses, so the line is in its voice.
    // (It read '<span class="beat">Ada Brook, a Magic User, takes one look at a Wilmsry and remembers an
    // appointment elsewhere.</span>'.)
    '<span class="beat">You take one look at Ada Brook, a Magic User, and refuse before they finish asking.</span> The Wilmsry keep a long list of grudges, and you are carrying all of it.',
  );
  assert.equal(
    LINE_FOR.joinerRefused({ type: "joinerRefused", reason: "wilmsry", name: "Ada Brook", sub: "Apprentice", cls: "Magic User", lvl: 2 }).text,
    // VOX-05 (79-11): the rail names why, as the Oracle does. Phase 91 plan 08: you refuse the Magic User
    // (it read "Ada Brook, a Magic User, takes one look at a Wilmsry and leaves.").
    "You refuse Ada Brook, a Magic User. Wilmsry grudge.",
  );
});

test("shell: the rail card and the Company panel read the same lvl field (source pins on mazeworld.html and src/browser/heroTab.js)", () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
  const startMarker = "} else if (S.pendingJoiner && !S.combat && !S.store) {";
  const endMarker = "} else if (S.pendingFind";
  const start = html.indexOf(startMarker);
  assert.ok(start !== -1, "the rail card's joiner branch is present in mazeworld.html");
  const end = html.indexOf(endMarker, start);
  assert.ok(end !== -1 && end > start, "the joiner branch is followed by the pendingFind branch");
  const region = html.slice(start, end);
  assert.match(region, /const lvl = j\.lvl \?\? j\.level \?\? 1;/, "the rail card reads j.lvl ?? j.level ?? 1 — the capped level rides the existing payload");
  assert.match(region, /skill level \$\{window\.__mzTables\.ROMAN\[lvl - 1\] \|\| lvl\}/, "the rail card's roll text renders the capped level unchanged");

  const heroTabSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "heroTab.js"), "utf8").replace(/\r\n/g, "\n");
  assert.match(heroTabSrc, /const lvl = m\.lvl \?\? m\.level \?\? 1;/, "the Company panel reads m.lvl ?? m.level ?? 1 — the same capped level, no shell change needed");
});

test("meetJoiner reads the cap from joinerLevelCap(state.floor.depth): the lvl line keeps its one d10 and its roll:selection tag", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "engine", "encounters.js"), "utf8").replace(/\r\n/g, "\n");
  const line = "Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1], joinerLevelCap(state.floor.depth)); // roll:selection";
  assert.equal(src.split(line).length - 1, 1, "the capped lvl line appears exactly once");
});

test("patch notes: 2.4.0 is agreed (no DRAFT line), validates, and its Joiners bullet states one level per three floors, old → new", () => {
  const md = fs.readFileSync(path.join(REPO_ROOT, "docs", "patch-notes", "2.4.0.md"), "utf8").replace(/\r\n/g, "\n");
  assert.ok(!md.includes("**DRAFT, not yet agreed.**"), "2.4.0 is agreed"); // release-2.4.0: declared re-pin (the user agreed the notes 2026-10-05)
  assert.deepStrictEqual(validatePatchNotes(md, "2.4.0"), []);
  const start = md.indexOf("## Monsters & difficulty\n");
  assert.ok(start !== -1, "the Monsters & difficulty category is present");
  const next = md.indexOf("\n## ", start + 1);
  const body = md.slice(start, next === -1 ? md.length : next);
  const bullets = body.split("\n").filter((l) => l.startsWith("- Joiners:"));
  assert.equal(bullets.length, 1, "exactly one Joiners bullet");
  for (const needle of ["→", "floors 1–3", "4–6", "7–9", "10–12", "from floor 13", "keeps the level it was met at"]) {
    assert.ok(bullets[0].includes(needle), `the Joiners bullet carries "${needle}"`);
  }
});
