// test/unit/spell-mechanics.test.js
//
// Phase 40 Plan 02 (SPELL-01) — direct unit coverage for the offense-school
// MECHANICS the Plan 01 table promised: engine/magic.js's data-flag thrown
// branch (Freeze's `onHit`, Lightning's `aoe`), the new `dot` branch (Ice) +
// combat.js#foeTurn's frozen-solid payoff, the Lesser Summon cast branch
// (never doubled, never backfires), the Weaken duration timer (+ its
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
import { TOAST_FOR } from "../../src/browser/toasts.js";

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
    darkFor: 0, flightLeft: 0, flightCooldown: 0,
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
    dead: false, won: false, deathNote: "", epitaph: "",
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

// ─── Task 1: data flags (Freeze/Lightning), Ice (the `dot` branch), Lesser Summon ───

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

test("Ice (dot cast): one draw for the duration, no to-hit roll; the SAME dispatch's trailing foeTurn ticks it once", () => {
  const foe = fixedFoe({ name: "Target", intel: 1, wp: 100, maxWP: 100 });
  const state = fixedState({ c: fixedCaster({ sub: "Sorcerer", grimoire: ["Ice"], level: 3 }), combat: fixedCombat([foe]) });
  // d4=3 -> rounds 4 (the cast draw); the SAME dispatch's trailing foeTurn
  // ticks the freshly-applied ice dot once (d6=1 tick dmg) before its own
  // swing misses (20 vs need 5), then the round-advance initiative (15/10)
  // — mirrors cast-refusals.test.js's documented Acid-retarget tail exactly.
  const events = castSpell(state, SPELL_IDX.Ice, fakeRng([3, 1, 20, 15, 10]), []);
  assert.equal(events.filter((e) => e.type === "spellThrown").length, 0, "no to-hit roll for a dot cast");
  const applied = events.find((e) => e.type === "iceApplied");
  assert.ok(applied);
  assert.equal(applied.target, "Target");
  assert.equal(applied.rounds, 4, "d4(3)+1, the un-ticked cast-time value");
  assert.deepStrictEqual(foe.dot && { dmg: foe.dot.dmg, by: foe.dot.by }, { dmg: { n: 1, sides: 6, bonus: 0 }, by: "ice" });
  assert.equal(foe.dot.left, 3, "the SAME dispatch's trailing foeTurn already ticked it once");
});

test("Ice: an intel>=12 foe can resist (d20 below intel) before any dot draw", () => {
  const foe = fixedFoe({ name: "Target", intel: 12, wp: 100, maxWP: 100 });
  const state = fixedState({ c: fixedCaster({ sub: "Sorcerer", grimoire: ["Ice"], level: 3 }), combat: fixedCombat([foe]) });
  // 11 -> resistRoll resists (11 < 12); tail: foe miss (20) + initiative (15/10).
  const events = castSpell(state, SPELL_IDX.Ice, fakeRng([11, 20, 15, 10]), []);
  assert.ok(events.some((e) => e.type === "spellResisted" && e.spell === "Ice" && e.roll === 11));
  assert.equal(foe.dot, undefined, "a resisted Ice never lands");
});

test("Ice: an intel>=12 foe that fails to resist still gets the dot (resistFailed then iceApplied)", () => {
  const foe = fixedFoe({ name: "Target", intel: 12, wp: 100, maxWP: 100 });
  const state = fixedState({ c: fixedCaster({ sub: "Sorcerer", grimoire: ["Ice"], level: 3 }), combat: fixedCombat([foe]) });
  // 12 -> fails to resist (12 is NOT < 12); d4=2 (rounds 3, cast draw); tail
  // ticks once (d6=1), foe miss (20), initiative (15/10).
  const events = castSpell(state, SPELL_IDX.Ice, fakeRng([12, 2, 1, 20, 15, 10]), []);
  assert.ok(events.some((e) => e.type === "resistFailed" && e.roll === 12));
  const applied = events.find((e) => e.type === "iceApplied");
  assert.ok(applied);
  assert.equal(applied.rounds, 3, "d4(2)+1");
});

test("Ice payoff: a dot's last tick that leaves the foe standing freezes it solid and kills it via killFoe (pays like any kill)", () => {
  const foe = fixedFoe({ name: "Target", type: "Humans", wp: 200, maxWP: 200, dot: { left: 1, dmg: { n: 1, sides: 6, bonus: 0 }, by: "ice" } });
  const state = fixedState({ combat: fixedCombat([foe]) });
  // tick d6=3 (dmg, 200-3=197, not lethal); killFoe: d6=4 (sp roll), d10=5
  // (coin roll), d20=20 (treasure check, skips: 20 > 2+1). "Humans" skips
  // the Beasts-only cooking-check draw.
  const events = foeTurn(state, fakeRng([3, 4, 5, 20]), []);
  const types = events.map((e) => e.type);
  const tickIdx = types.indexOf("dotTick");
  const frozenIdx = types.indexOf("frozenSolid");
  const killedIdx = types.indexOf("foeKilled");
  assert.ok(tickIdx >= 0 && frozenIdx > tickIdx && killedIdx > frozenIdx, "dotTick -> frozenSolid -> foeKilled, in order");
  assert.equal(events[tickIdx].left, 0);
  assert.equal(foe.alive, false);
  assert.equal(foe.frozen, true);
  assert.equal(foe.dot, undefined, "the dot record is deleted once it runs out");
});

test("Ice payoff: a foe whose own tick kills it pays through the existing dot-kill path with NO frozenSolid", () => {
  const foe = fixedFoe({ name: "Target", type: "Humans", wp: 2, maxWP: 10, dot: { left: 1, dmg: { n: 1, sides: 6, bonus: 0 }, by: "ice" } });
  const state = fixedState({ combat: fixedCombat([foe]) });
  // tick d6=6 (dmg, 2-6<=0, lethal on the tick itself); killFoe: d6=4, d10=5, d20=20.
  const events = foeTurn(state, fakeRng([6, 4, 5, 20]), []);
  assert.ok(events.some((e) => e.type === "dotTick"));
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.equal(events.some((e) => e.type === "frozenSolid"), false, "the tick itself killed it — freeze never fires");
  assert.equal(foe.alive, false);
  assert.equal(foe.frozen, undefined);
});

test("Ice payoff: a by:'poisonedEdge' dot running out never freezes (by is the switch)", () => {
  const foe = fixedFoe({ name: "Target", wp: 200, maxWP: 200, asleep: 1, dot: { left: 1, dmg: { n: 1, sides: 4, bonus: 0 }, by: "poisonedEdge" } });
  const state = fixedState({ combat: fixedCombat([foe]) });
  // one d4 tick draw; asleep:1 skips the foe's own trailing melee turn with 0 extra draws.
  const events = foeTurn(state, fakeRng([2]), []);
  assert.ok(events.some((e) => e.type === "dotTick" && e.by === "poisonedEdge" && e.left === 0));
  assert.equal(events.some((e) => e.type === "frozenSolid"), false);
  assert.equal(foe.frozen, undefined);
  assert.equal(foe.alive, true);
});

test("Ice payoff: a kill-twice (lives) foe survives the freeze once and is unfrozen", () => {
  const foe = fixedFoe({ name: "Target", type: "Humans", wp: 200, maxWP: 200, lives: 2, dot: { left: 1, dmg: { n: 1, sides: 6, bonus: 0 }, by: "ice" } });
  const state = fixedState({ combat: fixedCombat([foe]) });
  // tick d6=3 (not lethal alone); killFoe sees lives>1 and returns BEFORE any of its own draws.
  const events = foeTurn(state, fakeRng([3]), []);
  const frozenIdx = events.findIndex((e) => e.type === "frozenSolid");
  const revivedIdx = events.findIndex((e) => e.type === "foeRevived");
  assert.ok(frozenIdx >= 0 && revivedIdx >= 0 && frozenIdx < revivedIdx);
  assert.equal(foe.alive, true);
  assert.equal(foe.wp, 200, "killFoe's lives rule restores the foe to full wp");
  assert.equal(foe.frozen, false, "a standing (revived) foe is not frozen");
});

const LESSER_ALLY_NAMES = [
  "A thing with one horn, mostly",
  "Something with nearly enough arms",
  "A small grey sulk",
  "A shape that is mildly upsetting to look at",
];

test("Lesser Summon: a level-1 Summoner draws ONE die (the duration), never doubles/backfires, lvl clamps to 1..3", () => {
  // Zero live foes -> afterPlayerAction's own encounterCleared shortcut
  // fires with 0 further draws, so the strict one-value sequence proves the
  // cast branch itself drew exactly once (no d8 backfire check, no doubling
  // multiplier draw) without needing a trailing-tail budget.
  const state = fixedState({ c: fixedCaster({ sub: "Summoner", grimoire: ["Lesser Summon"], level: 1 }), combat: fixedCombat([]) });
  const events = castSpell(state, SPELL_IDX["Lesser Summon"], fakeRng([3]), []);
  const ally = events.find((e) => e.type === "allySummoned");
  assert.ok(ally);
  assert.equal(ally.lvl, 1, "clamp(max(1, min(3, level-1))) at level 1");
  assert.equal(ally.rounds, 3, "a plain d4, never doubled/+2");
  assert.equal(ally.lesser, true);
  assert.ok(LESSER_ALLY_NAMES.includes(ally.name));
  assert.ok(!events.some((e) => e.type === "summonBackfired"));
});

test("Lesser Summon: the persisted ally object itself gains NO new field (no `lesser` key on C.ally)", () => {
  const foe = fixedFoe({ wp: 50, maxWP: 50 });
  const state = fixedState({ c: fixedCaster({ sub: "Summoner", grimoire: ["Lesser Summon"], level: 1 }), combat: fixedCombat([foe]) });
  // A live foe keeps the encounter open past the cast, so C.ally survives
  // for inspection; the trailing tail's own content-driven draws are not
  // this test's claim.
  castSpell(state, SPELL_IDX["Lesser Summon"], looseRng([3], 20), []);
  assert.ok(state.combat, "the encounter is still open");
  assert.deepStrictEqual(Object.keys(state.combat.ally).sort(), ["lvl", "name", "rounds"]);
});

test("Lesser Summon: even a first-draw-of-1 never backfires (the d8 backfire check never runs for a lesser cast)", () => {
  const state = fixedState({ c: fixedCaster({ sub: "Summoner", grimoire: ["Lesser Summon"], level: 1 }), combat: fixedCombat([]) });
  const events = castSpell(state, SPELL_IDX["Lesser Summon"], fakeRng([1]), []);
  assert.ok(!events.some((e) => e.type === "summonBackfired"));
  assert.ok(events.some((e) => e.type === "allySummoned"));
});

test("Lesser Summon: a level-5 Summoner's ally caps at lvl 3", () => {
  const state = fixedState({ c: fixedCaster({ sub: "Summoner", grimoire: ["Lesser Summon"], level: 5 }), combat: fixedCombat([]) });
  const events = castSpell(state, SPELL_IDX["Lesser Summon"], fakeRng([2]), []);
  const ally = events.find((e) => e.type === "allySummoned");
  assert.equal(ally.lvl, 3, "clamp(min(3, 5-1)) = 3");
});

test("Lesser Summon: a level-1 Wizard's ally is lvl 1 too (never doubled — not a Summoner)", () => {
  const state = fixedState({ c: fixedCaster({ sub: "Wizard", grimoire: ["Lesser Summon"], level: 1 }), combat: null });
  const events = castSpell(state, SPELL_IDX["Lesser Summon"], fakeRng([1]), []);
  const ally = events.find((e) => e.type === "allyPending");
  assert.ok(ally);
  assert.equal(ally.lvl, 1);
  assert.equal(ally.lesser, true);
});

test("Summon (not Lesser Summon): allyPending never carries a `lesser` key", () => {
  const state = fixedState({ c: fixedCaster({ sub: "Wizard", grimoire: ["Summon"], level: 2 }), combat: null });
  const events = castSpell(state, SPELL_IDX.Summon, fakeRng([4]), []); // rounds d4=4
  const ally = events.find((e) => e.type === "allyPending");
  assert.ok(ally);
  assert.equal("lesser" in ally, false);
});

test("Narration: iceApplied/dotTick(ice)/allySummoned(lesser) render through EVENT_NARRATION and TOAST_FOR", () => {
  assert.match(EVENT_NARRATION.iceApplied({ target: "Ogre", rounds: 4 }), /Ice climbs Ogre/);
  assert.match(EVENT_NARRATION.dotTick({ target: "Ogre", dmg: 3, by: "ice" }), /the ice/);
  assert.match(EVENT_NARRATION.dotTick({ target: "Ogre", dmg: 3, by: "poisonedEdge" }), /the poison/);
  assert.match(EVENT_NARRATION.allySummoned({ name: "Thing", lesser: true }), /sort of/);
  assert.match(EVENT_NARRATION.allyPending({ name: "Thing", lesser: true }), /in a small way/);
  assert.equal(typeof TOAST_FOR.iceApplied({ type: "iceApplied", target: "Ogre", rounds: 4 }).text, "string");
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

test("Stupidity: casting draws zero dice (the old rng.d(10) nap is retired) and sets the fight-long flag", () => {
  const foe = fixedFoe({ intel: 1 });
  const state = fixedState({ c: fixedCaster({ sub: "Wizard", grimoire: ["Stupidity"], level: 2 }), combat: fixedCombat([foe]) });
  const events = castSpell(state, SPELL_IDX.Stupidity, looseRng([], 20), []);
  assert.equal(foe.stupid, true);
  assert.equal(foe.asleep, 0, "the retired nap line never runs — asleep stays untouched");
  assert.ok(events.some((e) => e.type === "stupefied" && e.target === foe.name));
});

test("Stupidity: foeTurn skips a stupid foe's ENTIRE turn every round (no counter, lasts the fight)", () => {
  const foe = fixedFoe({ stupid: true });
  const state = fixedState({ combat: fixedCombat([foe]) });
  // An empty sequence throws on ANY draw — proving the stupid foe neither
  // rolls to-hit nor casts; it just skips.
  const events = foeTurn(state, fakeRng([]), []);
  assert.deepStrictEqual(events.map((e) => e.type), ["foeStupefied"]);
  assert.equal(foe.stupid, true, "the flag never clears itself");
  // A second call proves it is not a one-shot skip.
  const events2 = foeTurn(state, fakeRng([]), []);
  assert.deepStrictEqual(events2.map((e) => e.type), ["foeStupefied"]);
});

test("Stupidity: playerStrike floors need at 5 vs a stupid foe (the same floor a dozing foe gets)", () => {
  const foe = fixedFoe({ stupid: true, wp: 50, maxWP: 50 });
  const state = fixedState({ combat: fixedCombat([foe]) });
  // The strike roll (5) is the only pinned value; the trailing tail (the
  // stupid foe's own turn skips at 0 draws — proven separately above — plus
  // the round's fresh initiative) is not this test's claim.
  const events = playerStrike(state, looseRng([5], 20), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck, "a stupid foe is struck at the floored need");
  assert.equal(struck.need, 5);
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
  const state = fixedState({ c: fixedFighter({ sub: "Cloaker" }), combat: fixedCombat([pursuer]) });
  // Cloaker's free vanish (C.opened2 falsy) calls pursuitStrike FIRST, zero
  // prior draws: foeDie roll=3 (hits, default need 5); d6=6 damage -> raw
  // 3*3+6=15, shrunk halves to 8 (roll!==1, no crit doubling).
  const events = flee(state, fakeRng([3, 6]), []);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.ok(struck);
  assert.equal(struck.dmg, 8, "ceil(15/2)");
});

test("Narration: weakenFaded/foeStupefied render through EVENT_NARRATION and TOAST_FOR", () => {
  assert.match(EVENT_NARRATION.weakenFaded({}), /remember/);
  assert.match(EVENT_NARRATION.weakened({ rounds: 3 }), /3 rounds/);
  assert.match(EVENT_NARRATION.weakened({}), /softer now\./);
  assert.match(EVENT_NARRATION.foeStupefied({ name: "Ogre" }), /thinking about nothing/);
  assert.equal(typeof TOAST_FOR.weakenFaded({ type: "weakenFaded" }).text, "string");
  assert.equal(typeof TOAST_FOR.foeStupefied({ type: "foeStupefied", name: "Ogre" }).text, "string");
});
