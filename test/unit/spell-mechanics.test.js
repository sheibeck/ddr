// test/unit/spell-mechanics.test.js
//
// Phase 40 Plan 02 (SPELL-01) — direct unit coverage for the offense-school
// MECHANICS the Plan 01 table promised: engine/magic.js's data-flag thrown
// branch (Freeze's `onHit`, Lightning's `aoe`), Ice (the `dot` branch and its
// frozen-solid payoff until Phase 90 plan 05 made it the area freeze: see the
// re-pinned tests below), the summon cast branch (Phase 90 plan 06: Lesser
// Summon is removed; the Summoner's doubled Summon from level 1), the Weaken duration timer (+ its
// combat.js#foeTurn expiry), Stupidity's fight-long skip, and Shrink's real
// half-damage. Helpers (fakeRng/looseRng/fixedFighter/fixedState/fixedFloor/
// fixedFoe/fixedCombat) mirror test/unit/combat.test.js's established
// pattern verbatim — playerStrike/foeTurn/flee all read `state.c`/
// `state.combat` the same way regardless of which spell put them there.
//
// ONE-TICK-ALREADY-SPENT INVARIANT (38-03 SUMMARY, restated for Weaken/Ice):
// a cast IS the round's action, so the SAME dispatch's own
// afterPlayerAction->foeTurn tail always ticks a freshly-started
// c.timers/f.dot record once before castSpell returns — a fresh Weaken
// timer or a fresh Ice dot is therefore already one tick into its life by
// the time the caller can observe it from outside a bare cast. Tests that
// need the UN-ticked value read it off the emitted event's own payload
// (captured before the tail runs); tests that need the ticked value read
// the persisted state after the full dispatch completes — following
// test/unit/cast-refusals.test.js's Acid-retarget test's own documented
// precedent for the identical `t.acid` shape.

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell } from "../../engine/magic.js";
import { playerStrike, foeTurn, flee, alliesTurn } from "../../engine/combat.js";
import { SPELLS } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { setIdentityDials } from "./harness/identityDials.js";
// Quick 260927-rsx: forced resist outcomes come from the real derived check.
import { actsWhere, noResistActs } from "./harness/spellResistActs.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
setIdentityDials();

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows (ports test/unit/combat.test.js's
 * helper verbatim). */
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

/** looseRng(seq, fallback) — like fakeRng, but returns `fallback` forever
 * once `seq` is exhausted instead of throwing (ports
 * test/unit/identity-contract.test.js's helper verbatim). Used only where
 * the PRECEDING draws this test claims are pinned but the trailing
 * afterPlayerAction tail's own content-driven draws (a foe's own to-hit
 * roll, the round's fresh initiative) are not this test's claim. */
function looseRng(seq, fallback = 20) {
  let i = 0;
  return {
    d(_sides) {
      return i < seq.length ? seq[i++] : fallback;
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

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

/** A tiny fully-lit 3x3 open floor — none of these tests touch the map. */
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

/** A Magic User caster — grimoire-driven tests override `sub`/`grimoire`/`level`. */
function fixedCaster(overrides = {}) {
  return fixedFighter({
    cls: "Magic User", sub: "Wizard", weapon: "Dagger", armor: "Cloth",
    grimoire: [], level: 1, wp: 40, maxWP: 40,
    ...overrides,
  });
}

// ─── Task 1: data flags (Freeze/Lightning), Ice (the `dot` branch), Summon ───

test("no engine spell branch is name-keyed: Lightning (aoe:'all') pushes one spellThrown per live foe", () => {
  const f1 = fixedFoe({ name: "A" });
  const f2 = fixedFoe({ name: "B" });
  const f3 = fixedFoe({ name: "C" });
  const state = fixedState({ c: fixedCaster({ sub: "Sorcerer", grimoire: ["Lightning"], level: 5 }), combat: fixedCombat([f1, f2, f3]) });
  // All three miss (roll 20 way above any plausible need+bonus) — the point
  // is the COUNT and independence of the per-target rolls, not the outcome.
  const events = castSpell(state, SPELL_IDX.Lightning, looseRng([20, 20, 20], 20), []);
  const thrown = events.filter((e) => e.type === "spellThrown");
  assert.equal(thrown.length, 3, "Lightning hits every live foe independently");
  assert.deepStrictEqual(thrown.map((e) => e.target).sort(), ["A", "B", "C"]);
});

test("Fireball (a plain thrown spell, no aoe flag) targets only C.target, not every foe", () => {
  const f1 = fixedFoe({ name: "A" });
  const f2 = fixedFoe({ name: "B" });
  const state = fixedState({ c: fixedCaster({ sub: "Sorcerer", grimoire: ["Fireball"], level: 5 }), combat: fixedCombat([f1, f2], { target: 1 }) });
  const events = castSpell(state, SPELL_IDX.Fireball, looseRng([20], 20), []);
  const thrown = events.filter((e) => e.type === "spellThrown");
  assert.equal(thrown.length, 1);
  assert.equal(thrown[0].target, "B");
});

// Phase 90 plan 05 (SPELL-12, Q5 A): Ice is no longer a damage-over-time spell
// (the `dot` kind, the f.dot ice record, iceApplied and foeTurn's frozen-solid
// payoff are gone). It is the area freeze: every foe takes d10 + level² with no
// to-hit roll, and each survivor is frozen d4 rounds unless it resists.
// test/unit/doze-stun-ice.test.js pins the full rule; these three keep the old
// per-cast shape pins re-pinned to it.
test("Ice (area freeze cast): the foe takes d10 + level² with no to-hit roll, then a d4 freeze; the SAME dispatch's trailing foeTurn spends one hold turn", () => {
  const foe = fixedFoe({ name: "Target", intel: 1, wp: 100, maxWP: 100 });
  const state = fixedState({ c: fixedCaster({ sub: "Sorcerer", grimoire: ["Ice"], level: 3 }), combat: fixedCombat([foe]) });
  state.acts = noResistActs("Ice"); // quick 260927-rsx: the foe does not resist
  // d10=3 (the damage dice) + the level-3 caster's level² 9 = 12; the freeze's
  // d4=2; then the tail: the held foe skips its swing, the round-advance draws
  // are not this test's claim.
  const events = castSpell(state, SPELL_IDX.Ice, looseRng([3, 2], 20), []);
  assert.equal(events.filter((e) => e.type === "spellThrown").length, 0, "no to-hit roll for Ice");
  const hit = events.find((e) => e.type === "spellHit");
  assert.ok(hit);
  assert.equal(hit.target, "Target");
  assert.equal(hit.dmg, 12, "d10 3 + level² 9");
  assert.equal(foe.wp, 88);
  const held = events.find((e) => e.type === "controlHeld");
  assert.deepStrictEqual({ kind: held.kind, rounds: held.rounds, freeze: held.freeze }, { kind: "frozen", rounds: 2, freeze: true });
  assert.deepStrictEqual(foe.held, { kind: "frozen", left: 1 }, "the SAME dispatch's trailing foeTurn already spent one hold turn");
  assert.equal(foe.dot, undefined, "no damage-over-time record any more");
});

// Quick 260927-rsx (user ruling 2026-09-27): re-pinned from the Phase 19
// canon (an intel >= 12 target's main-rng d20). Every foe now rolls half its
// intel in faces on a derived-stream d20 (intel 12: 6 faces, 15–20), so the
// main sequence carries no resist draw; the outcome is forced with the real
// check (harness/spellResistActs.js).
test("Ice: a foe that resists the freeze (intel 12, 15–20 on a d20) still takes the damage and is not frozen", () => {
  const foe = fixedFoe({ name: "Target", intel: 12, wp: 100, maxWP: 100 });
  const state = fixedState({ c: fixedCaster({ sub: "Sorcerer", grimoire: ["Ice"], level: 3 }), combat: fixedCombat([foe]) });
  state.acts = actsWhere("Ice", [[0, true]], { intels: { 0: 12 } });
  // d10=3 (damage) and the freeze's d4=2 are drawn either way; the tail is not the claim.
  const events = castSpell(state, SPELL_IDX.Ice, looseRng([3, 2], 20), []);
  assert.ok(events.some((e) => e.type === "spellResisted" && e.spell === "Ice" && e.freeze === true && e.roll >= 15 && e.atLeast === 15 && e.dieN === 20));
  assert.equal(foe.wp, 88, "the damage landed; the resist stops only the freeze");
  assert.equal(foe.held, undefined, "a resisted freeze holds nothing");
});

test("Ice: a foe that fails to resist the freeze is frozen (resistFailed, then the hold)", () => {
  const foe = fixedFoe({ name: "Target", intel: 12, wp: 100, maxWP: 100 });
  const state = fixedState({ c: fixedCaster({ sub: "Sorcerer", grimoire: ["Ice"], level: 3 }), combat: fixedCombat([foe]) });
  state.acts = actsWhere("Ice", [[0, false]], { intels: { 0: 12 } });
  const events = castSpell(state, SPELL_IDX.Ice, looseRng([3, 2], 20), []);
  assert.ok(events.some((e) => e.type === "resistFailed" && e.roll < 15 && e.atLeast === 15 && e.dieN === 20));
  const held = events.find((e) => e.type === "controlHeld");
  assert.ok(held);
  assert.equal(held.rounds, 2, "the freeze's own d4");
});

test("a Poisoned Edge dot (the one f.dot left) ticks, and a lethal tick pays through the dot-kill path", () => {
  const foe = fixedFoe({ name: "Target", type: "Humans", wp: 2, maxWP: 10, dot: { left: 1, dmg: { n: 1, sides: 6, bonus: 0 }, by: "poisonedEdge" } });
  const state = fixedState({ combat: fixedCombat([foe]) });
  // tick d6=6 (dmg, 2-6<=0, lethal on the tick itself); killFoe: d6=4, d10=5, d20=20.
  const events = foeTurn(state, fakeRng([6, 4, 5, 20]), []);
  assert.ok(events.some((e) => e.type === "dotTick" && e.by === "poisonedEdge"));
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.equal(foe.alive, false);
});

test("a Poisoned Edge dot running out never freezes the foe (Ice's old payoff is gone)", () => {
  const foe = fixedFoe({ name: "Target", wp: 200, maxWP: 200, asleep: 1, dot: { left: 1, dmg: { n: 1, sides: 4, bonus: 0 }, by: "poisonedEdge" } });
  const state = fixedState({ combat: fixedCombat([foe]) });
  // one d4 tick draw; asleep:1 skips the foe's own trailing melee turn with 0 extra draws.
  const events = foeTurn(state, fakeRng([2]), []);
  assert.ok(events.some((e) => e.type === "dotTick" && e.by === "poisonedEdge" && e.left === 0));
  assert.equal(events.some((e) => e.type === "frozenSolid"), false);
  assert.equal(foe.frozen, undefined);
  assert.equal(foe.alive, true);
  assert.equal(foe.dot, undefined, "the dot record is deleted once it runs out");
});

test("Ice: a kill-twice (lives) foe whose damage kills it once is revived to full and is not frozen (a Freeze's rule)", () => {
  const foe = fixedFoe({ name: "Target", type: "Humans", wp: 5, maxWP: 50, lives: 2 });
  const state = fixedState({ c: fixedCaster({ sub: "Sorcerer", grimoire: ["Ice"], level: 3 }), combat: fixedCombat([foe]) });
  state.acts = noResistActs("Ice");
  // d10=3 + 9 = 12 >= 5: killFoe sees lives>1 and returns BEFORE any of its own draws, no freeze d4.
  const events = castSpell(state, SPELL_IDX.Ice, looseRng([3], 20), []);
  assert.ok(events.some((e) => e.type === "foeRevived"));
  assert.equal(events.some((e) => e.type === "controlHeld"), false);
  assert.equal(foe.alive, true);
  assert.equal(foe.wp, 50, "killFoe's lives rule restores the foe to full wp");
  assert.equal(foe.held, undefined);
});

// Phase 90 plan 06 (SPELL-12): Lesser Summon is removed; the Summoner casts the
// full Summon from level 1 (the named exception), doubled, with the one-in-eight
// backfire kept. The summon branch has the one ally name table now.
const ALLY_NAMES = ["A horned thing", "Something with too many arms", "A shape that hurts to look at", "A tall grey silence"];

test("Summon (Phase 90 plan 06): a level-1 Summoner draws the d8 backfire check then ONE die (the duration, doubled +2), the ally is level 2", () => {
  // Zero live foes -> afterPlayerAction's own encounterCleared shortcut
  // fires with 0 further draws, so the strict two-value sequence proves the
  // cast branch itself drew exactly twice (the d8 check, the d4 duration).
  const state = fixedState({ c: fixedCaster({ sub: "Summoner", grimoire: ["Summon"], level: 1 }), combat: fixedCombat([]) });
  const events = castSpell(state, SPELL_IDX["Summon"], fakeRng([3, 3]), []);
  const ally = events.find((e) => e.type === "allySummoned");
  assert.ok(ally);
  assert.equal(ally.lvl, 2, "min(5, level + 1): a Summoner's creatures come doubled");
  assert.equal(ally.rounds, 8, "2 * d4(3) + 2");
  assert.ok(ALLY_NAMES.includes(ally.name));
  assert.ok(!events.some((e) => e.type === "summonBackfired"));
  assert.equal("lesser" in ally, false);
});

test("Summon: the persisted ally object itself carries only lvl, name and rounds", () => {
  const foe = fixedFoe({ wp: 50, maxWP: 50 });
  const state = fixedState({ c: fixedCaster({ sub: "Summoner", grimoire: ["Summon"], level: 1 }), combat: fixedCombat([foe]) });
  // A live foe keeps the encounter open past the cast, so C.ally survives
  // for inspection; the trailing tail's own content-driven draws are not
  // this test's claim.
  castSpell(state, SPELL_IDX["Summon"], looseRng([5, 3], 20), []);
  assert.ok(state.combat, "the encounter is still open");
  assert.deepStrictEqual(Object.keys(state.combat.ally).sort(), ["lvl", "name", "rounds"]);
});

test("Summon: a level-1 Summoner's first draw of 1 is the one-in-eight backfire (the d8 check runs for the Summoner)", () => {
  const state = fixedState({ c: fixedCaster({ sub: "Summoner", grimoire: ["Summon"], level: 1, wp: 40, maxWP: 40 }), combat: fixedCombat([]) });
  const events = castSpell(state, SPELL_IDX["Summon"], fakeRng([1, 4]), []);
  assert.ok(events.some((e) => e.type === "summonBackfired"));
  assert.ok(!events.some((e) => e.type === "allySummoned"));
});

test("Summon: a level-5 Summoner's ally caps at lvl 5", () => {
  const state = fixedState({ c: fixedCaster({ sub: "Summoner", grimoire: ["Summon"], level: 5 }), combat: fixedCombat([]) });
  const events = castSpell(state, SPELL_IDX["Summon"], fakeRng([2, 2]), []);
  const ally = events.find((e) => e.type === "allySummoned");
  assert.equal(ally.lvl, 5, "min(5, 5+1) = 5");
});

test("Summon: a level-2 Wizard's ally is lvl 2 (never doubled — not a Summoner) and allyPending carries no `lesser` key", () => {
  const state = fixedState({ c: fixedCaster({ sub: "Wizard", grimoire: ["Summon"], level: 2 }), combat: null });
  const events = castSpell(state, SPELL_IDX.Summon, fakeRng([4]), []); // rounds d4=4
  const ally = events.find((e) => e.type === "allyPending");
  assert.ok(ally);
  assert.equal(ally.lvl, 2);
  assert.equal(ally.rounds, 6, "1 * d4(4) + 2");
  assert.equal("lesser" in ally, false);
});

test("Narration: iceCast/dotTick(poison) render through EVENT_NARRATION and LINE_FOR", () => {
  assert.match(EVENT_NARRATION.iceCast({ spell: "Ice", foes: 3 }), /Ice/);
  assert.match(EVENT_NARRATION.dotTick({ target: "Ogre", dmg: 3, by: "poisonedEdge" }), /the poison/);
  assert.equal(typeof LINE_FOR.iceCast({ type: "iceCast", spell: "Ice", foes: 3 }).text, "string");
});

// ─── Task 2: Weaken's duration timer, Stupidity's fight-long skip, Shrink's half damage ───

test("Weaken: casting starts a rounds-cadence spell:weaken timer, already one tick spent by the SAME dispatch", () => {
  const foe = fixedFoe({ name: "Target", intel: 1 });
  const state = fixedState({ c: fixedCaster({ sub: "Wizard", grimoire: ["Weaken"], level: 1 }), combat: fixedCombat([foe]) });
  // d4=2 -> rounds 3 (the cast draw); the trailing tail (foeTurn's own miss
  // + the round's fresh initiative) is not this test's claim.
  const events = castSpell(state, SPELL_IDX.Weaken, looseRng([2], 20), []);
  const weakened = events.find((e) => e.type === "weakened");
  assert.ok(weakened);
  assert.equal(weakened.rounds, 3, "the un-ticked cast-time value");
  assert.equal(state.combat.weakened, true);
  assert.equal(state.combat.foeToHitPenalty, 3);
  assert.deepStrictEqual(state.c.timers["spell:weaken"], { cadence: "rounds", left: 2, phase: "effect" }, "already one tick spent by the SAME dispatch");
});

test("Weaken: re-casting mid-window overwrites the record (refresh) — never two records", () => {
  const foe = fixedFoe({ name: "Target", intel: 1 });
  const state = fixedState({ c: fixedCaster({ sub: "Wizard", grimoire: ["Weaken"], level: 1 }), combat: fixedCombat([foe]) });
  const first = castSpell(state, SPELL_IDX.Weaken, looseRng([2], 20), []);
  assert.ok(first.some((e) => e.type === "weakened" && e.rounds === 3));
  const second = castSpell(state, SPELL_IDX.Weaken, looseRng([4], 20), []);
  assert.ok(second.some((e) => e.type === "weakened" && e.rounds === 5));
  assert.equal(Object.keys(state.c.timers).length, 1, "still one record, never two");
  assert.equal(state.c.timers["spell:weaken"].left, 4, "overwritten to the fresh duration, one tick already spent again");
});

test("Weaken: the swing on the expiry round is still halved (the swing precedes the tail tick)", () => {
  const foe = fixedFoe({ name: "Target", lvl: 4 });
  const state = fixedState({ combat: fixedCombat([foe], { weakened: true, foeToHitPenalty: 3 }) });
  state.c.timers = { "spell:weaken": { cadence: "rounds", left: 1, phase: "effect" } };
  // foeDie roll=3 (hits, need floored to foeToHitPenalty 3); d6=6 damage ->
  // raw 4*4+6=22, halved by C.weakened -> 11 (roll!==1, no crit doubling).
  const events = foeTurn(state, fakeRng([3, 6]), []);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.ok(struck, "the swing lands");
  assert.equal(struck.dmg, 11, "still halved — C.weakened was still true when the swing resolved");
  assert.ok(events.some((e) => e.type === "weakenFaded"));
  assert.equal(state.combat.weakened, false, "cleared by the SAME call's tail tick, AFTER the swing");
  assert.equal(state.combat.foeToHitPenalty, 0);
  assert.equal(state.c.timers["spell:weaken"], undefined, "the expired record is deleted");
});

test("Weaken expiry: two more foeTurn calls tick the record out and narrate weakenFaded exactly once", () => {
  const foe = fixedFoe({ name: "Target", asleep: 1 }); // asleep: skip the foe's own swing, isolate the timer tick
  const state = fixedState({ combat: fixedCombat([foe], { weakened: true, foeToHitPenalty: 3 }) });
  state.c.timers = { "spell:weaken": { cadence: "rounds", left: 2, phase: "effect" } };
  const first = foeTurn(state, fakeRng([]), []);
  assert.equal(state.c.timers["spell:weaken"].left, 1);
  assert.equal(first.some((e) => e.type === "weakenFaded"), false);
  assert.equal(state.combat.weakened, true, "still active with one round left");
  foe.asleep = 1; // asleep again for the second call
  const second = foeTurn(state, fakeRng([]), []);
  assert.ok(second.some((e) => e.type === "weakenFaded"));
  assert.equal(state.combat.weakened, false);
  assert.equal(state.combat.foeToHitPenalty, 0);
  assert.equal(state.c.timers["spell:weaken"], undefined);
});

test("Weaken (member cast, DFB-05 precedent): allyCast draws one extra d4 and starts spell:weaken on the HERO's own timers", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const member = { cls: "Magic User", sub: "Wizard", weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: ["Weaken"], spellsUsed: 0, name: "Ada", level: 1, race: "Human", wp: 20, maxWP: 20, status: "ok" };
  const state = fixedState({ party: [member] });
  state.combat = fixedCombat([foe], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20 }] });
  // intel 1 -> no resist draw; ONE d4 for the new spell:weaken duration (3 -> rounds 4).
  const events = alliesTurn(state, fakeRng([3]), []);
  const hit = events.find((e) => e.type === "allySpellHit");
  assert.ok(hit);
  assert.equal(hit.effect, "weakened");
  assert.equal(hit.rounds, 4, "d4(3)+1");
  assert.equal(state.combat.weakened, true);
  assert.ok(state.c.timers && state.c.timers["spell:weaken"]);
  assert.equal(state.c.timers["spell:weaken"].left, 4, "the ally's own cast draws no trailing tick of its own");
});

// Phase 90 plan 04 (SPELL-12, user 2026-09-30): re-pinned. Stupidity drops the
// foe's intelligence to 1 for the fight; it no longer skips the foe's turns or
// floors the strike need (test/unit/petrify-blind-stupidity.test.js pins the
// rework in full). Before: it set the fight-long skip flag only.
test("Stupidity: casting draws zero dice (the old rng.d(10) nap is retired), sets the chip flag and drops the foe's intelligence to 1", () => {
  let foe, state, events;
  for (let acts = 0; acts < 200; acts++) { // the first acts where the intelligence-12 foe fails its one resist
    foe = fixedFoe({ intel: 12 });
    state = fixedState({ c: fixedCaster({ sub: "Wizard", grimoire: ["Stupidity"], level: 2 }), combat: fixedCombat([foe]) });
    state.acts = acts;
    events = castSpell(state, SPELL_IDX.Stupidity, looseRng([], 20), []);
    if (events.some((e) => e.type === "stupefied")) break;
  }
  assert.equal(foe.stupid, true);
  assert.equal(foe.intel, 1);
  assert.equal(foe.asleep, 0, "the retired nap line never runs — asleep stays untouched");
  assert.ok(events.some((e) => e.type === "stupefied" && e.target === foe.name && e.was === 12 && e.intel === 1));
});

test("Stupidity: foeTurn no longer skips a stupid foe — it takes its turn (a to-hit draw) every round and says no foeStupefied", () => {
  const foe = fixedFoe({ stupid: true, intel: 1 });
  const state = fixedState({ combat: fixedCombat([foe]) });
  const events = foeTurn(state, fakeRng([3, 3]), []);
  assert.equal(events.some((e) => e.type === "foeStupefied"), false);
  assert.ok(events.some((e) => e.type === "struckByFoe" || e.type === "foeMissed"), "it swung");
  assert.equal(foe.stupid, true, "the flag never clears itself");
  const events2 = foeTurn(state, fakeRng([3, 3]), []);
  assert.ok(events2.some((e) => e.type === "struckByFoe" || e.type === "foeMissed"), "and again the next round");
});

// Phase 90 plan 04 (SPELL-12): re-pinned. A stupid foe is NO LONGER struck at the
// dozing foe's floor of 5 faces: it is hit exactly like the same foe not stupid.
test("Stupidity: playerStrike gives a stupid foe no floor — the same need as the same foe not stupid", () => {
  const strikeNeed = (foeOver) => {
    const foe = fixedFoe({ wp: 50, maxWP: 50, ...foeOver });
    const state = fixedState({ combat: fixedCombat([foe]) });
    const events = playerStrike(state, looseRng([5], 20), []);
    const struck = events.find((e) => e.type === "struck");
    assert.ok(struck);
    return struck.atLeast;
  };
  assert.equal(strikeNeed({ stupid: true, intel: 1 }), strikeNeed({}));
});

test("Shrink: a shrunk foe's hero-target melee damage is halved, and quartered when also weakened", () => {
  const foe = fixedFoe({ name: "Target", lvl: 4, shrunk: true });
  const state = fixedState({ combat: fixedCombat([foe]) });
  // foeDie roll=3 (hits, default need 5); d6=6 damage -> raw 4*4+6=22, shrunk halves to 11.
  const events = foeTurn(state, fakeRng([3, 6]), []);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.equal(struck.dmg, 11);

  const foe2 = fixedFoe({ name: "Target", lvl: 4, shrunk: true });
  const state2 = fixedState({ combat: fixedCombat([foe2], { weakened: true }) });
  const events2 = foeTurn(state2, fakeRng([3, 6]), []);
  const struck2 = events2.find((e) => e.type === "struckByFoe");
  assert.equal(struck2.dmg, Math.ceil(Math.ceil(22 / 2) / 2), "weakened then shrunk — ceil applied twice");
});

test("Shrink: a shrunk foe's member-target damage is halved too", () => {
  const foe = fixedFoe({ name: "Target", lvl: 4, shrunk: true });
  const member = { partyIdx: 0, name: "Ally", wp: 30, maxWP: 30 };
  const state = fixedState({
    combat: fixedCombat([foe], { allies: [member] }),
    party: [{ name: "Ally", level: 1, cls: "Fighter", sub: "Soldier", wp: 30, maxWP: 30, status: "ok" }],
  });
  // pickFoeTarget: d2=2 -> targets the member; member to-hit d(dieN)=3 (hits,
  // default need 5); damage d6=6 -> raw 4*4+6=22, shrunk halves to 11.
  const events = foeTurn(state, fakeRng([2, 3, 6]), []);
  const struck = events.find((e) => e.type === "memberStruck");
  assert.ok(struck);
  assert.equal(struck.dmg, 11);
});

test("Shrink: pursuitStrike halves a shrunk pursuer's parting blow", () => {
  const pursuer = fixedFoe({ name: "Ghost", sp: { pursues: true }, lvl: 3, shrunk: true, wp: 50, maxWP: 50 });
  // Phase 91.1 plan 03 part B (V27 B, 2026-10-01): the unseen Cloaker's free vanish no longer takes the pursuer's parting blow, so this test reaches pursuitStrike through the tracked round-1 withdrawal instead (also a zero-draw exit; same draws as before).
  const state = fixedState({ c: fixedFighter(), combat: fixedCombat([pursuer], { tracked: true, round: 1 }) });
  // The tracked round-1 withdrawal calls pursuitStrike FIRST, zero
  // prior draws: foeDie roll=3 (hits, default need 5); d6=6 damage -> raw
  // 3*3+6=15, shrunk halves to 8 (roll!==1, no crit doubling).
  const events = flee(state, fakeRng([3, 6]), []);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.ok(struck);
  assert.equal(struck.dmg, 8, "ceil(15/2)");
});

// Phase 90 plan 04: foeStupefied (the per-turn skip line) is gone with the skip.
test("Narration: weakenFaded renders through EVENT_NARRATION and LINE_FOR; the foeStupefied entries are gone", () => {
  assert.match(EVENT_NARRATION.weakenFaded({}), /remember/);
  assert.match(EVENT_NARRATION.weakened({ rounds: 3 }), /3 rounds/);
  assert.match(EVENT_NARRATION.weakened({}), /softer now\./);
  assert.equal(EVENT_NARRATION.foeStupefied, undefined);
  assert.equal(typeof LINE_FOR.weakenFaded({ type: "weakenFaded" }).text, "string");
  assert.equal(LINE_FOR.foeStupefied, undefined);
});

// VOX-05 (Phase 79, plan 79-08) made Strength's HP boost non-silent; Phase 90
// (SPELL-09, report #8) removed the boost. The cast's event now carries the
// window (`squares`) and whether a live one was restarted (`restarted`); a
// recast says it starts over. No hit points move.
test("Strength: the cast event states the 100 squares, a recast says it restarted, and no hit points move", () => {
  const state = fixedState({ c: fixedCaster({ grimoire: ["Strength"], wp: 30, maxWP: 40 }) });
  const events = castSpell(state, SPELL_IDX.Strength, fakeRng([]), []);
  const cast = events.find((e) => e.type === "strengthCast");
  assert.ok(cast, "strengthCast pushed");
  assert.deepStrictEqual(cast, { type: "strengthCast", squares: 100, restarted: false });
  assert.equal(state.c.wp, 30);
  assert.equal(state.c.maxWP, 40);

  // A recast restarts the 100 squares and says so; it never stacks.
  const again = castSpell(state, SPELL_IDX.Strength, fakeRng([]), []).find((e) => e.type === "strengthCast");
  assert.deepStrictEqual(again, { type: "strengthCast", squares: 100, restarted: true });
  assert.equal(state.c.maxWP, 40, "no hit points on a recast either");
});

// Phase 90 (SPELL-09): the cast lines state the d10, the 100 squares and the
// absence of hit points; a recast says it starts over; no stale wording.
test("Strength: the Oracle and rail cast lines say the extra d10, the 100 squares and no extra HP; a recast says it starts over", () => {
  const fresh = { type: "strengthCast", squares: 100, restarted: false };
  const oracle = EVENT_NARRATION.strengthCast(fresh).replace(/<[^>]+>/g, "");
  assert.match(oracle, /extra d10/);
  assert.match(oracle, /100 squares/);
  assert.match(oracle, /No extra HP/);
  const rail = LINE_FOR.strengthCast(fresh).text;
  assert.match(rail, /extra d10/);
  assert.match(rail, /100 squares/);
  assert.match(rail, /No extra HP/);

  const again = { type: "strengthCast", squares: 100, restarted: true };
  assert.match(EVENT_NARRATION.strengthCast(again).replace(/<[^>]+>/g, ""), /starts over/);
  assert.match(LINE_FOR.strengthCast(again).text, /starts over/);

  for (const e of [fresh, again, { type: "strengthCast" }]) {
    for (const text of [EVENT_NARRATION.strengthCast(e).replace(/<[^>]+>/g, ""), LINE_FOR.strengthCast(e).text]) {
      assert.doesNotMatch(text, /undefined|NaN|until you make camp|till camp|doubled/);
    }
  }
});

test("Strength: a fumbled scroll's line on a foe names the damage and no hit points", () => {
  const e = { type: "fumbleOnFoe", spell: "Strength", target: "Viper", effect: "might", might: 6 };
  const oracle = EVENT_NARRATION.fumbleOnFoe(e).replace(/<[^>]+>/g, "");
  assert.match(oracle, /\+6/);
  assert.doesNotMatch(oracle, /hp/);
  assert.doesNotMatch(LINE_FOR.fumbleOnFoe(e).text, /hp/);
});
