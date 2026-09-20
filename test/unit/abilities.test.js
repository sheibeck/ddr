// test/unit/abilities.test.js
//
// Phase 38 Plan 03 (ABIL-01/04) — direct coverage for engine/abilities.js's
// useAbility: the refusal ladder, the round economy (exactly one foeTurn per
// use), the cooldown/timer lifecycle, and each of the 20 abilities' own
// resolution. Local helper copies (fakeRng/countingRng/fixedFighter/
// fixedFloor/fixedState/fixedFoe/fixedCombat) mirror test/unit/
// ability-strike.test.js verbatim — this repo's established
// per-file-fixture convention (never imported cross-file).
//
// TASK 2 NOTE: the foeTurn/pickFoeTarget/applyFoeDamageToPlayer/flee hooks
// (dot tick, f.stunned skip, f.blindFor countdown, f.hamstrung halving, the
// riposte counter, the taunt target/soak bypass, the smoke flee bypass) do
// not exist until Task 2 lands. Every test in the "Task 2 hooks" section
// below is EXPECTED RED at the Task 1 commit — see 38-03-SUMMARY.md.

import test from "node:test";
import assert from "node:assert/strict";

import { useAbility, abilityRoundsLeft, applyPommel, applyDirtyTrick, applyPoison, applyHamstring, applyMark } from "../../engine/abilities.js";
import { isReady, remaining, startEffect } from "../../engine/effects.js";
import { abilityEffectActive, foeToHitVs, DEATH_PANIC_THRESHOLD } from "../../engine/derived.js";
import { endCombat, foeTurn, pickFoeTarget, applyFoeDamageToPlayer, flee } from "../../engine/combat.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow (a "no more draws expected"
 * assertion). */
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

/** countingRng(inner) — wraps any rng object and counts every draw-producing call. */
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
    maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: [],
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
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

/** fixedCombat — the plan's own required shape: pending/opened/opened2
 * explicit so refuseIfPending/playerStrike's opener logic behave exactly as
 * a real fight would. */
function fixedCombat(foes, overrides = {}) {
  return {
    foes, type: foes[0]?.type || "Beasts", round: 1, target: 0,
    pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
    ...overrides,
  };
}

// A generous tail of harmless filler draws: every per-foe foeTurn swing
// misses (need is always well under 20). Phase 51 (INIT-01): the
// round-advance itself draws zero rng now (initiative is rolled once, at
// fight()'s Fight! gate, never re-rolled by afterPlayerAction), so this
// filler is simply extra unused supply — harmless either way.
const FILL = new Array(40).fill(20);

// ---------------------------------------------------------------------------
// 1. Registration (engine.js dispatch + actions.js validation) — see also
//    test/unit/actions.test.js for the pure validateAction pins.
// ---------------------------------------------------------------------------

test("useAbility is reachable through applyAction's dispatch", async () => {
  const { applyAction } = await import("../../engine/engine.js");
  const state = fixedState({ c: fixedFighter({ abilities: ["kata"] }) });
  state.combat = fixedCombat([fixedFoe()]);
  const { events } = applyAction(state, { type: "useAbility", key: "kata" });
  assert.ok(events.some((e) => e.type === "abilityUsed" || e.type === "struck" || e.type === "strikeMissed"));
});

// ---------------------------------------------------------------------------
// 2. Refusal ladder
// ---------------------------------------------------------------------------

test("ladder: notFought (refuseIfPending) refuses before anything else, spends no timer", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["kata"] }) });
  state.combat = fixedCombat([fixedFoe()], { pending: true });
  const events = useAbility(state, "kata", fakeRng([]), []);
  assert.deepEqual(events, [{ type: "abilityRefused", key: "kata", reason: "notFought" }]);
  assert.equal(isReady(state.c, "ability:kata"), true);
});

test("ladder: unknown — a key not in the catalog at all", () => {
  const state = fixedState({ c: fixedFighter({ abilities: [] }) });
  state.combat = fixedCombat([fixedFoe()]);
  const events = useAbility(state, "not-a-real-ability", fakeRng([]), []);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "abilityRefused");
  assert.equal(events[0].reason, "unknown");
});

test("ladder: unknown — a catalog id the character never rolled", () => {
  const state = fixedState({ c: fixedFighter({ abilities: [] }) });
  state.combat = fixedCombat([fixedFoe()]);
  const events = useAbility(state, "kata", fakeRng([]), []);
  assert.deepEqual(events, [{ type: "abilityRefused", key: "kata", reason: "unknown", name: "Kata" }]);
});

test("ladder: notInCombat — no active encounter", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["kata"] }) });
  state.combat = null;
  const events = useAbility(state, "kata", fakeRng([]), []);
  assert.deepEqual(events, [{ type: "abilityRefused", key: "kata", reason: "notInCombat", name: "Kata" }]);
});

test("ladder: cooldown — an on-cooldown ability names itself and the rounds left", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["kata"], timers: { "ability:kata": { cadence: "rounds", left: 2, phase: "cooldown" } } }) });
  state.combat = fixedCombat([fixedFoe()]);
  const events = useAbility(state, "kata", fakeRng([]), []);
  assert.deepEqual(events, [{ type: "abilityRefused", key: "kata", reason: "cooldown", name: "Kata", left: 2 }]);
  assert.equal(abilityRoundsLeft(state.c, "kata"), 2);
});

test("ladder: noTarget — a hand-built zero-foe combat (structurally unreachable in real play)", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["kata"] }) });
  state.combat = fixedCombat([]);
  const events = useAbility(state, "kata", fakeRng([]), []);
  assert.deepEqual(events, [{ type: "abilityRefused", key: "kata", reason: "noTarget", name: "Kata" }]);
});

test("ladder: notLowEnough — Last Stand refuses above a quarter hp", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["lastStand"], wp: 55, maxWP: 55 }) });
  state.combat = fixedCombat([fixedFoe()]);
  const events = useAbility(state, "lastStand", fakeRng([]), []);
  assert.deepEqual(events, [{ type: "abilityRefused", key: "lastStand", reason: "notLowEnough", name: "Last Stand", have: 55, max: 55 }]);
  assert.equal(55 > 55 * DEATH_PANIC_THRESHOLD, true);
});

test("a refused dispatch spends no action: rngState-equivalent (zero draws) and combat.round unchanged", () => {
  const state = fixedState({ c: fixedFighter({ abilities: [] }) });
  state.combat = fixedCombat([fixedFoe()], { round: 1 });
  const events = useAbility(state, "kata", fakeRng([]), []); // throws on ANY draw
  assert.equal(events.length, 1);
  assert.equal(state.combat.round, 1);
  assert.equal(isReady(state.c, "ability:kata"), true);
});

// ---------------------------------------------------------------------------
// 3. Round economy — exactly one foeTurn's worth per use
// ---------------------------------------------------------------------------

function countFoeActionEvents(events) {
  return events.filter((e) => e.type === "foeMissed" || e.type === "struckByFoe" || e.type === "foeStunned" || e.type === "memberStruck").length;
}

test("round economy: a non-strike ability (pommelStrike) advances the round by exactly 1 and both foes act exactly once", () => {
  const foes = [fixedFoe({ name: "A", wp: 999, maxWP: 999 }), fixedFoe({ name: "B", wp: 999, maxWP: 999 })];
  const state = fixedState({ c: fixedFighter({ abilities: ["pommelStrike"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat(foes, { round: 1, target: 0 });
  const events = useAbility(state, "pommelStrike", fakeRng([...FILL]), []);
  assert.equal(state.combat.round, 2, "afterPlayerAction's single round++ ran exactly once");
  assert.equal(countFoeActionEvents(events), 2, "both foes acted exactly once — never a double foeTurn");
});

test("round economy: a strike ability (kata) advances the round by exactly 1 and both foes act exactly once", () => {
  const foes = [fixedFoe({ name: "A", wp: 999, maxWP: 999 }), fixedFoe({ name: "B", wp: 999, maxWP: 999 })];
  const state = fixedState({ c: fixedFighter({ abilities: ["kata"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat(foes, { round: 1, target: 0 });
  const events = useAbility(state, "kata", fakeRng([3, 4, ...FILL]), []);
  assert.equal(state.combat.round, 2);
  assert.equal(countFoeActionEvents(events), 2);
});

// ---------------------------------------------------------------------------
// 4. Timer lifecycle
// ---------------------------------------------------------------------------

// NOTE ON THE "ONE TICK ALREADY HAPPENED" INVARIANT: activating an ability
// IS the round's action — afterPlayerAction (called either by playerStrike's
// own tail or useAbility's own non-strike tail) always runs the SAME round's
// foeTurn before useAbility returns, and foeTurn's own tail always calls
// tickRounds once. So by the time useAbility returns, every freshly-started
// timer has already been ticked down by exactly 1 — a duration:1 ability
// (riposte/taunt) is therefore ALREADY in its cooldown phase the instant the
// dispatch returns; this is correct (their one-round window IS that same
// foeTurn), not a bug. Every assertion below accounts for this one tick.

test("timers: kata starts a plain 3-round cooldown (one tick already spent by this dispatch's own foeTurn), ticks down, then is ready again", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["kata"] }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  useAbility(state, "kata", fakeRng([3, 4, ...FILL]), []);
  assert.equal(isReady(state.c, "ability:kata"), false);
  assert.equal(abilityRoundsLeft(state.c, "kata"), 2);
  foeTurn(state, fakeRng([...FILL]), []);
  assert.equal(abilityRoundsLeft(state.c, "kata"), 1);
  foeTurn(state, fakeRng([...FILL]), []);
  assert.equal(isReady(state.c, "ability:kata"), true);
});

test("timers: sidestep (duration 2, cd 4) ticks through its effect phase then its own cooldown, abilityEffectActive true only during the effect phase", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["sidestep"] }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  useAbility(state, "sidestep", fakeRng([...FILL]), []);
  assert.equal(abilityRoundsLeft(state.c, "sidestep"), 5); // (2-1 effect) + 4 cd
  assert.equal(abilityEffectActive(state.c, "sidestep"), true);
  foeTurn(state, fakeRng([...FILL]), []);
  // effect phase's last round just expired -> flips into its own 4-round cooldown
  assert.equal(abilityEffectActive(state.c, "sidestep"), false);
  assert.equal(isReady(state.c, "ability:sidestep"), false);
  assert.equal(remaining(state.c, "ability:sidestep"), 4);
});

test("timers: secondWind is a once-a-fight cooldown, cleared unconditionally by endCombat", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["secondWind"], wp: 10, maxWP: 55 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  useAbility(state, "secondWind", fakeRng([5, ...FILL]), []);
  assert.equal(isReady(state.c, "ability:secondWind"), false);
  assert.ok(remaining(state.c, "ability:secondWind") >= 990, "still deep in the once-a-fight cooldown");
  endCombat(state, []);
  assert.equal(isReady(state.c, "ability:secondWind"), true);
});

// ---------------------------------------------------------------------------
// 5. Per-ability resolution (Task 1: everything reachable without a
//    foeTurn/pickFoeTarget/applyFoeDamageToPlayer/flee hook)
// ---------------------------------------------------------------------------

test("kata: autoHit + level bonus damage, via tag", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["kata"], level: 3 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "kata", fakeRng([20, 4, ...FILL]), []); // roll 20 would normally miss
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.via, "kata");
});

test("feint: autoHit + level bonus damage, via tag", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["feint"], cls: "Thief", sub: "Pilfer", level: 2 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "feint", fakeRng([20, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.via, "feint");
});

test("deathTouch: a landed blow on a foe under 15 hp finishes it (a miss would only burn the cooldown)", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["deathTouch"], sub: "Knight" }) });
  state.combat = fixedCombat([fixedFoe({ wp: 10, maxWP: 30 })]);
  const events = useAbility(state, "deathTouch", fakeRng([3, ...FILL]), []); // roll 3 lands
  assert.ok(events.some((e) => e.type === "deathTouch"));
  assert.ok(events.some((e) => e.type === "foeKilled"));
});

test("deathTouch: doubles damage on a foe at/above 15 hp (forceCrit)", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["deathTouch"], sub: "Knight" }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "deathTouch", fakeRng([3, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, true);
  assert.equal(struck.critBy, "deathTouch");
});

test("silentStep: auto-hit + forced crit", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["silentStep"], cls: "Thief", sub: "Pilfer" }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "silentStep", fakeRng([20, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, true);
  assert.equal(struck.critBy, "silentStep");
});

test("overheadBlow: double damage, need shifted -2 (harder to land)", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["overheadBlow"] }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "overheadBlow", fakeRng([3, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.ok(struck.needMods.some((m) => m.name === "overhead" && m.delta === -2));
});

test("lastStand: three strike attempts in one dispatch", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["lastStand"], wp: 5, maxWP: 55 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "lastStand", fakeRng([3, 4, 3, 4, 3, 4, ...FILL]), []);
  const struckCount = events.filter((e) => e.type === "struck").length;
  assert.equal(struckCount, 3);
  assert.ok(events.some((e) => e.type === "lastStandCalled" && e.attacks === 3));
});

test("pommelStrike: pushes pommelStruck (foeTurn's own consumption of t.stunned is proven in the Task 2 section below)", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["pommelStrike"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  const events = useAbility(state, "pommelStrike", fakeRng([...FILL]), []);
  assert.ok(events.some((e) => e.type === "pommelStruck" && e.target === "Rat"));
});

test("applyPommel(t) is a pure setter — Plan 04 reuses it directly", () => {
  const t = fixedFoe();
  applyPommel(t);
  assert.equal(t.stunned, true);
});

test("dirtyTrick: pushes dirtyTrickLanded and leaves the target blind (the exact blindFor countdown is proven in the Task 2 section below)", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["dirtyTrick"], cls: "Thief", sub: "Pilfer", wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  const events = useAbility(state, "dirtyTrick", fakeRng([...FILL]), []);
  assert.equal(foe.blind, true);
  assert.ok(events.some((e) => e.type === "dirtyTrickLanded" && e.target === "Rat" && e.rounds === 2));
});

test("applyDirtyTrick(t) is a pure setter — Plan 04 reuses it directly", () => {
  const t = fixedFoe();
  applyDirtyTrick(t);
  assert.equal(t.blind, true);
  assert.equal(t.blindFor, 2);
});

test("poisonedEdge: sets t.dot shape and pushes poisonedEdgeApplied", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["poisonedEdge"], cls: "Thief", sub: "Pilfer", wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  const events = useAbility(state, "poisonedEdge", fakeRng([...FILL]), []);
  // this dispatch's own foeTurn already ticks the dot once (Task 2's dot
  // hook, exercised in full in the section below) — left starts at 3 but
  // reads 2 by the time useAbility returns.
  assert.equal(foe.dot.left, 2);
  assert.deepEqual(foe.dot.dmg, { n: 1, sides: 4, bonus: 0 });
  assert.equal(foe.dot.by, "poisonedEdge");
  assert.ok(events.some((e) => e.type === "poisonedEdgeApplied" && e.target === "Rat" && e.rounds === 3));
});

test("applyPoison(t, dot) is a pure setter — Plan 04 reuses it directly", () => {
  const t = fixedFoe();
  applyPoison(t, { left: 3, dmg: { n: 1, sides: 4, bonus: 0 }, by: "poisonedEdge" });
  assert.deepEqual(t.dot, { left: 3, dmg: { n: 1, sides: 4, bonus: 0 }, by: "poisonedEdge" });
});

test("hamstring: sets f.hamstrung and pushes hamstrung", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["hamstring"], cls: "Thief", sub: "Pilfer", wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  const events = useAbility(state, "hamstring", fakeRng([...FILL]), []);
  assert.equal(foe.hamstrung, true);
  assert.ok(events.some((e) => e.type === "hamstrung" && e.target === "Rat"));
});

test("applyHamstring(t) is a pure setter — Plan 04 reuses it directly", () => {
  const t = fixedFoe();
  applyHamstring(t);
  assert.equal(t.hamstrung, true);
});

test("mark: sets f.marked (already read by playerStrike's +2 since Plan 02) and pushes marked", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["mark"], cls: "Thief", sub: "Pilfer", wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  const events = useAbility(state, "mark", fakeRng([...FILL]), []);
  assert.equal(foe.marked, true);
  assert.ok(events.some((e) => e.type === "marked" && e.target === "Rat"));
});

test("applyMark(t) is a pure setter — Plan 04 reuses it directly", () => {
  const t = fixedFoe();
  applyMark(t);
  assert.equal(t.marked, true);
});

test("cutpurse: d10 x level gold, cutpursed + goldGained events, exactly one draw for a non-Pickpocket", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["cutpurse"], cls: "Thief", sub: "Pilfer", level: 3, gold: 0, wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  const rng = countingRng(fakeRng([7, ...FILL]));
  const events = useAbility(state, "cutpurse", rng, []);
  assert.equal(state.c.gold, 21); // 7 * level 3
  assert.ok(events.some((e) => e.type === "cutpursed" && e.target === "Rat" && e.amount === 21));
  assert.ok(events.some((e) => e.type === "goldGained" && e.amount === 21 && e.why === "cutpurse"));
});

test("secondWind: heals d8 + level, capped at maxWP, reports the capped amount", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["secondWind"], level: 2, wp: 50, maxWP: 55 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "secondWind", fakeRng([8, ...FILL]), []); // rolled 8 + level 2 = 10, capped to 5
  assert.equal(state.c.wp, 55);
  const healed = events.find((e) => e.type === "secondWindHealed");
  assert.ok(healed);
  assert.equal(healed.amount, 5);
  assert.equal(healed.rolled, 10);
});

test("sweep: every live foe takes ceil(weaponDamage/2); a lethal sweep kills and clears the encounter", () => {
  // type "Humans" (not Beasts/Lair Beasts) so killFoe's cooking branch never
  // fires an extra draw — keeps this test's filler budget small and legible.
  const foeA = fixedFoe({ name: "A", type: "Humans", wp: 3, maxWP: 30 });
  const foeB = fixedFoe({ name: "B", type: "Humans", wp: 3, maxWP: 30 });
  const state = fixedState({ c: fixedFighter({ abilities: ["sweep"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foeA, foeB]);
  // weaponDamage draws one die (Club, no halve) — value 6 here — plus level^2(1)+prof(0)+magicWpn(0)=1 => 7, ceil(7/2)=4
  const events = useAbility(state, "sweep", fakeRng([6, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "swept" && e.dmg === 4 && e.count === 2));
  assert.ok(events.some((e) => e.type === "sweptFoe" && e.target === "A"));
  assert.ok(events.some((e) => e.type === "sweptFoe" && e.target === "B"));
  assert.equal(events.filter((e) => e.type === "foeKilled").length, 2);
  assert.equal(events.some((e) => e.type === "encounterCleared"), true);
  assert.equal(state.combat, null);
});

test("sweep: a foe with sp.ar draws its own armour d20 (damageFoe's own gate, unchanged)", () => {
  const foeA = fixedFoe({ name: "A", wp: 999, maxWP: 999, sp: { ar: 5 } });
  const state = fixedState({ c: fixedFighter({ abilities: ["sweep"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foeA]);
  const rng = countingRng(fakeRng([6, 1, ...FILL])); // weaponDamage die, then the armour-soak d20 (roll 1 <= ar 5 -> soaked)
  const events = useAbility(state, "sweep", rng, []);
  assert.ok(events.some((e) => e.type === "foeArmorSoaked"));
  assert.equal(events.some((e) => e.type === "sweptFoe"), false, "a soaked hit never pushes sweptFoe");
});

test("brace: sets C.braced and pushes braced", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["brace"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "brace", fakeRng([...FILL]), []);
  assert.equal(state.combat.braced, true);
  assert.ok(events.some((e) => e.type === "braced"));
});

test("riposte: pushes riposteReady; its 1-round effect window is this same dispatch's own foeTurn, so by the time useAbility returns it has already ticked into its 4-round cooldown", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["riposte"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "riposte", fakeRng([...FILL]), []);
  assert.equal(isReady(state.c, "ability:riposte"), false);
  assert.equal(remaining(state.c, "ability:riposte"), 4);
  assert.ok(events.some((e) => e.type === "riposteReady" && e.rounds === 1));
});

test("taunt: pushes taunted; same one-tick-already-spent invariant as riposte", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["taunt"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "taunt", fakeRng([...FILL]), []);
  assert.equal(isReady(state.c, "ability:taunt"), false);
  assert.equal(remaining(state.c, "ability:taunt"), 4);
  assert.ok(events.some((e) => e.type === "taunted" && e.rounds === 1));
});

test("sidestep/battleRoar/smoke: already shift foeToHitVs the instant the effect starts (Plan 02's wiring)", () => {
  const mkState = (key) => {
    const state = fixedState({ c: fixedFighter({ abilities: [key], wp: 999, maxWP: 999 }) });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
    return state;
  };
  const sidestepState = mkState("sidestep");
  useAbility(sidestepState, "sidestep", fakeRng([...FILL]), []);
  assert.equal(foeToHitVs(sidestepState), 3); // 5 - 2

  const battleRoarState = mkState("battleRoar");
  useAbility(battleRoarState, "battleRoar", fakeRng([...FILL]), []);
  assert.equal(foeToHitVs(battleRoarState), 3); // 5 - 2
  assert.ok(useAbility, "battleRoarRaised pushed"); // event presence checked below

  const smokeState = mkState("smoke");
  useAbility(smokeState, "smoke", fakeRng([...FILL]), []);
  assert.equal(foeToHitVs(smokeState), 1); // override
});

test("battleRoar: pushes battleRoarRaised", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["battleRoar"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "battleRoar", fakeRng([...FILL]), []);
  assert.ok(events.some((e) => e.type === "battleRoarRaised" && e.rounds === 2));
});

test("sidestep: pushes sidestepped", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["sidestep"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "sidestep", fakeRng([...FILL]), []);
  assert.ok(events.some((e) => e.type === "sidestepped" && e.rounds === 2));
});

test("smoke: pushes smokeThrown", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["smoke"], cls: "Thief", sub: "Pilfer", wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useAbility(state, "smoke", fakeRng([...FILL]), []);
  assert.ok(events.some((e) => e.type === "smokeThrown" && e.rounds === 2));
});

// ---------------------------------------------------------------------------
// 6. Task 2 hooks — foeTurn/pickFoeTarget/applyFoeDamageToPlayer/flee. These
//    were RED at the Task 1 commit (see 38-03-SUMMARY.md); Task 2 lands the
//    combat.js hooks that turn them green.
// ---------------------------------------------------------------------------

test("Task 2: pommelStrike's f.stunned makes the target skip THIS SAME round's foeTurn (its 'next turn')", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["pommelStrike"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  const events = useAbility(state, "pommelStrike", fakeRng([...FILL]), []);
  assert.ok(events.some((e) => e.type === "foeStunned" && e.name === "Rat"));
  assert.equal(events.some((e) => e.type === "foeMissed" || e.type === "struckByFoe"), false, "the stunned foe never reaches its swing");
  assert.equal(foe.stunned, false, "consumed — a single stun, not a duration");
});

test("Task 2: dirtyTrick's f.blindFor counts down across foeTurn visits, then restores sight", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["dirtyTrick"], cls: "Thief", sub: "Pilfer", wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  // this dispatch's own foeTurn already ticks blindFor once: 2 -> 1
  useAbility(state, "dirtyTrick", fakeRng([...FILL]), []);
  assert.equal(foe.blind, true);
  assert.equal(foe.blindFor, 1);
  const events2 = foeTurn(state, fakeRng([...FILL]), []);
  assert.equal(foe.blind, false);
  assert.equal(foe.blindFor, undefined);
  assert.ok(events2.some((e) => e.type === "foeSightReturned" && e.name === "Rat"));
});

test("Task 2: a spell-blinded foe (no blindFor) never regains sight on its own", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999, blind: true }); // no blindFor — e.g. Blind spell
  const state = fixedState({ c: fixedFighter({ wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  foeTurn(state, fakeRng([...FILL]), []);
  assert.equal(foe.blind, true, "still blind — no blindFor counter to expire");
});

test("Task 2: poisonedEdge ticks a d4 three times total (one already inside its own dispatch), then f.dot is deleted", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["poisonedEdge"], cls: "Thief", sub: "Pilfer", wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  const events0 = useAbility(state, "poisonedEdge", fakeRng([2, ...FILL]), []);
  const tick0 = events0.find((e) => e.type === "dotTick");
  assert.ok(tick0);
  assert.equal(tick0.dmg, 2);
  assert.equal(tick0.by, "poisonedEdge");
  assert.equal(tick0.left, 2);
  assert.equal(foe.dot.left, 2);
  const events1 = foeTurn(state, fakeRng([3, ...FILL]), []);
  assert.equal(events1.find((e) => e.type === "dotTick").left, 1);
  const events2 = foeTurn(state, fakeRng([1, ...FILL]), []);
  const tick2 = events2.find((e) => e.type === "dotTick");
  assert.equal(tick2.left, 0);
  assert.equal(foe.dot, undefined);
});

test("Task 2: poisonedEdge's dot kills a low-hp foe on its very first tick", () => {
  const foe = fixedFoe({ name: "Rat", wp: 2, maxWP: 2 });
  const state = fixedState({ c: fixedFighter({ abilities: ["poisonedEdge"], cls: "Thief", sub: "Pilfer", wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  const events = useAbility(state, "poisonedEdge", fakeRng([4, ...FILL]), []); // d4 rolls 4 -> lethal
  assert.ok(events.some((e) => e.type === "foeKilled" && e.name === "Rat"));
  assert.ok(events.some((e) => e.type === "encounterCleared"));
});

test("Task 2: hamstring halves this foe's own landed damage on the hero (hero branch)", () => {
  const mk = (hamstrung) => {
    const foe = fixedFoe({ name: "Rat", lvl: 1, wp: 999, maxWP: 999 });
    if (hamstrung) foe.hamstrung = true;
    const state = fixedState({ c: fixedFighter({ wp: 999, maxWP: 999 }) });
    state.combat = fixedCombat([foe]);
    return state;
  };
  const control = mk(false);
  const controlEvents = foeTurn(control, fakeRng([3, 5]), []); // roll 3 hits (need 5), dmg = 1 + 5 = 6, no crit
  const controlHit = controlEvents.find((e) => e.type === "struckByFoe");
  assert.equal(controlHit.dmg, 6);

  const hamstrungState = mk(true);
  const hamstrungEvents = foeTurn(hamstrungState, fakeRng([3, 5]), []);
  const hamstrungHit = hamstrungEvents.find((e) => e.type === "struckByFoe");
  assert.equal(hamstrungHit.dmg, 3, "half of the control's 6, ceil-rounded");
});

test("Task 2: hamstring halves this foe's own landed damage on a party member too", () => {
  const foe = fixedFoe({ name: "Rat", lvl: 1, wp: 999, maxWP: 999, hamstrung: true });
  const state = fixedState({ c: fixedFighter({ wp: 999, maxWP: 999 }), party: [{ name: "Ada", level: 1, sub: "Fighter", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok" }] });
  state.combat = fixedCombat([foe], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20 }] });
  // pick = rng.d(2) -> 2 targets the (only) member; mDieN roll hits; damage die
  const events = foeTurn(state, fakeRng([2, 3, 5]), []);
  const memberHit = events.find((e) => e.type === "memberStruck");
  assert.ok(memberHit);
  assert.equal(memberHit.dmg, 3, "half of 6, ceil-rounded, same as the hero-branch control above");
});

test("Task 2: riposte counters a hero-branch foe miss during its own effect round with weaponDamage dice", () => {
  const foe = fixedFoe({ name: "Rat", wp: 999, maxWP: 999 });
  const state = fixedState({ c: fixedFighter({ abilities: ["riposte"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([foe]);
  // sequence: the foe's own to-hit roll (20 -> miss vs need 5), then
  // riposte's weaponDamage die (Club, 6); the round advance itself draws
  // zero rng (Phase 51, INIT-01) — FILL is just harmless spare supply.
  const events = useAbility(state, "riposte", fakeRng([20, 6, 20, 20, ...FILL]), []);
  const riposted = events.find((e) => e.type === "riposted");
  assert.ok(riposted, "the foe's miss triggered a counter");
  assert.equal(riposted.target, "Rat");
  assert.equal(riposted.dmg, 7); // level^2(1) + Club die(6) + prof(0) + magicWpn(0)
});

test("Task 2: pickFoeTarget returns null with zero draws while taunt is active", () => {
  const state = fixedState({ c: fixedFighter({ wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20 }] });
  startEffect(state.c, "ability:taunt", { rounds: 1, cd: 4 });
  const rng = fakeRng([]); // throws on any draw
  const result = pickFoeTarget(state, rng);
  assert.equal(result, null);
});

test("Task 2: pickFoeTarget can pick a live member when taunt is NOT active (control)", () => {
  const state = fixedState({ c: fixedFighter({ wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20 }] });
  const result = pickFoeTarget(state, fakeRng([2])); // d(2) -> 2 picks the member
  assert.ok(result, "a member CAN be targeted when taunt is not active");
});

test("Task 2: taunt doubles the armour soak target (capped at 20)", () => {
  const mk = () => {
    const c = fixedFighter({ ar: 5, armorWP: 20, armorMax: 20, armorMin: 0, wp: 999, maxWP: 999 });
    const state = fixedState({ c });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
    return state;
  };
  const withoutTaunt = mk();
  const withoutResult = applyFoeDamageToPlayer(withoutTaunt, withoutTaunt.combat.foes[0], fakeRng([7]), [], { dmg: 8, roll: 3, need: 5 });
  assert.equal(withoutResult.onArmour, false, "roll 7 > ar 5 — not soaked without taunt");

  const withTaunt = mk();
  startEffect(withTaunt.c, "ability:taunt", { rounds: 1, cd: 4 });
  const withResult = applyFoeDamageToPlayer(withTaunt, withTaunt.combat.foes[0], fakeRng([7]), [], { dmg: 8, roll: 3, need: 5 });
  assert.equal(withResult.onArmour, true, "roll 7 <= doubled ar 10 — soaked with taunt");
});

test("Task 2: smoke's flee bypass — no roll, no pursuit strike, unconditional escape", () => {
  const state = fixedState({ c: fixedFighter({ abilities: ["smoke"], cls: "Thief", sub: "Pilfer", wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  useAbility(state, "smoke", fakeRng([...FILL]), []);
  // the smoke effect is this same dispatch's own 1-round window too — but
  // smoke's DURATION is 2 rounds (unlike riposte/taunt's 1), so it is STILL
  // active immediately after useAbility returns.
  assert.equal(abilityEffectActive(state.c, "smoke"), true);
  const events = flee(state, fakeRng([]), []); // throws on any draw — smoke never rolls
  assert.ok(events.some((e) => e.type === "fled" && e.reason === "smoke"));
  assert.equal(events.some((e) => e.type === "fleeRolled"), false);
  assert.equal(events.some((e) => e.type === "foePursued"), false);
  assert.equal(state.combat, null);
});
