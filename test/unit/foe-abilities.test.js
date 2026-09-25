// Direct unit coverage for engine/foeAbilities.js (Phase 19, FOE-01..09) and
// its wiring into engine/combat.js#foeTurn's ability gate: readiness
// (cooldown/uses/heal/summon caps), the D-04 cast-policy d6, kit order,
// hero resistance (FOE-07), every effect kind (bolt/drain/debuff/heal/
// summon), member targeting (D-13), and startCombat's kit copy against the
// REAL bestiary. Mirrors test/unit/combat.test.js and
// test/unit/party-combat.test.js's fakeRng/fixed* helpers verbatim.
//
// Test 20 (the EVENT_NARRATION builder coverage for the 11 new event types)
// is appended by 19-03 Task 3, once the builders exist — see that task's
// commit for the coverage-guard note.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/state.js";
import { foeTurn, startCombat, playerStrike, endCombat, killFoe } from "../../engine/combat.js";
import { firstReadyAbility, tickAbilityCooldowns, resolveFoeAbility } from "../../engine/foeAbilities.js";
import { FOE_ABILITIES, BESTIARY } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";

/** fakeRng(seq) — `.d()` pops the next value regardless of side count; throws
 * on underflow, which doubles as a "no more rng draws expected" assertion. */
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

/** A combat-scoped ally entry as startCombat's sync produces it. */
function fixedAlly(overrides = {}) {
  return { partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20, ...overrides };
}

/** A persistent roster member (a rollCharacter-shaped sheet; `level` not `lvl`). */
function fixedMember(overrides = {}) {
  return { name: "Ada", level: 1, sub: "Fighter", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok", ...overrides };
}

// --- 1: the structural gate --------------------------------------------------

test("gate: a foe without abilities / with abilities: [] takes the melee path with no extra draw", () => {
  const state1 = fixedState();
  const foe1 = fixedFoe();
  state1.combat = fixedCombat([foe1]);
  const events1 = foeTurn(state1, fakeRng([7]), []);
  assert.deepEqual(events1.map((e) => e.type), ["foeMissed"]);
  assert.equal(Object.hasOwn(foe1, "cd"), false);
  assert.equal(Object.hasOwn(foe1, "uses"), false);

  const state2 = fixedState();
  const foe2 = fixedFoe({ abilities: [] });
  state2.combat = fixedCombat([foe2]);
  const events2 = foeTurn(state2, fakeRng([7]), []);
  assert.deepEqual(events2.map((e) => e.type), ["foeMissed"]);
  assert.equal(Object.hasOwn(foe2, "cd"), false);
});

// --- 2: the D-04 cast-policy d6 ---------------------------------------------

test("gate: kit with a ready bolt — d6 1..4 casts (foeCast then foeBolted), 5..6 melees; no to-hit roll for the bolt", () => {
  const krupkeFreezeTxt = FOE_ABILITIES.find((a) => a.id === "krupkeFreeze").txt;
  const state = fixedState();
  const foe = fixedFoe({ abilities: ["krupkeFreeze"] });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([4, 6]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeBolted"]);
  assert.deepStrictEqual(events[0], { type: "foeCast", name: "Target", ability: "krupkeFreeze", kind: "bolt", txt: krupkeFreezeTxt });
  assert.equal(events[1].dmg, 6);
  assert.equal(events[1].ignoresArmor, false);
  assert.equal(state.c.wp, 49);

  const state2 = fixedState();
  const foe2 = fixedFoe({ abilities: ["krupkeFreeze"] });
  state2.combat = fixedCombat([foe2]);
  const events2 = foeTurn(state2, fakeRng([5, 7]), []);
  assert.deepEqual(events2.map((e) => e.type), ["foeMissed"]);
});

// --- 3: never_melee ----------------------------------------------------------

test("never_melee: casts with no d6; with nothing ready pushes foeOutOfSpells and no swing", () => {
  const state = fixedState();
  const foe = fixedFoe({ abilities: ["drudgeFreeze"], sp: { never_melee: true } });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([3]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeBolted"]);
  assert.equal(events[1].dmg, 3);

  const state2 = fixedState();
  const foe2 = fixedFoe({ abilities: ["drakeBreath"], sp: { never_melee: true } });
  state2.combat = fixedCombat([foe2]);
  const events2 = foeTurn(state2, fakeRng([]), []);
  assert.deepStrictEqual(events2, [{ type: "foeOutOfSpells", name: "Target" }]);
  assert.equal(foe2.cd.drakeBreath, 3);
});

// --- 4: cooldown cadence (D-20) ----------------------------------------------

test("cooldown cadence (D-20): every:4 fires on the 4th visit, resets, fires on the 8th; a d6 of 5 on a ready visit leaves cd at 0", () => {
  const state = fixedState({ c: { wp: 200, maxWP: 200 } });
  const foe = fixedFoe({ abilities: ["drakeBreath"], lvl: 4 });
  state.combat = fixedCombat([foe]);

  for (let visit = 1; visit <= 3; visit++) {
    const events = foeTurn(state, fakeRng([7]), []);
    assert.deepEqual(events.map((e) => e.type), ["foeMissed"]);
    assert.equal(foe.cd.drakeBreath, 4 - visit);
  }

  let events = foeTurn(state, fakeRng([1, 5, 5]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeBolted"]);
  assert.equal(events[1].dmg, 14);
  assert.equal(foe.cd.drakeBreath, 4);

  for (let visit = 5; visit <= 7; visit++) {
    events = foeTurn(state, fakeRng([7]), []);
    assert.deepEqual(events.map((e) => e.type), ["foeMissed"]);
  }

  events = foeTurn(state, fakeRng([6, 7]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed"]);
  assert.equal(foe.cd.drakeBreath, 0);

  events = foeTurn(state, fakeRng([2, 3, 3]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeBolted"]);
  assert.equal(foe.cd.drakeBreath, 4);
});

// --- 5: uses (D-05) -----------------------------------------------------------

test("uses (D-05): four casts then never again this encounter — the 5th visit draws no d6", () => {
  const state = fixedState();
  const foe = fixedFoe({ abilities: ["djinniLightning"] });
  state.combat = fixedCombat([foe]);
  for (let i = 0; i < 4; i++) {
    const events = foeTurn(state, fakeRng([1, 5]), []);
    assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeBolted"]);
    assert.equal(events[1].dmg, 11);
    assert.equal(foe.uses.djinniLightning, 3 - i);
  }
  const events = foeTurn(state, fakeRng([7]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed"]);
});

// --- 6: kit order + interleave (D-04) -----------------------------------------

test("kit order + interleave (D-04): the Drudge kit casts Freeze, Fireball, Lightning, Fireball, Weaken, Lightning over six visits", () => {
  const state = fixedState({ c: { intel: 10, wp: 500, maxWP: 500 } });
  const foe = fixedFoe({
    abilities: ["drudgeLightning", "drudgeFireball", "drudgeWeaken", "drudgeFreeze"],
    sp: { never_melee: true },
    lvl: 4,
  });
  state.combat = fixedCombat([foe]);

  const visits = [
    { seq: [6], ability: "drudgeFreeze" },
    { seq: [5, 5], ability: "drudgeFireball" },
    { seq: [7], ability: "drudgeLightning" },
    { seq: [5, 5], ability: "drudgeFireball" },
    { seq: [2], ability: "drudgeWeaken" },
    { seq: [7], ability: "drudgeLightning" },
  ];
  for (const { seq, ability } of visits) {
    const events = foeTurn(state, fakeRng(seq), []);
    const cast = events.find((e) => e.type === "foeCast");
    assert.ok(cast, `expected a foeCast event (wanted ${ability})`);
    assert.equal(cast.ability, ability);
    if (ability === "drudgeWeaken") {
      // asserted immediately after the cast — the very next visit's
      // end-of-turn tick (D-09/A8) legitimately decrements this further,
      // since by then the effect is no longer the one this turn applied.
      assert.deepEqual(state.c.foeEffect, { kind: "weakened", rounds: 2 });
    }
  }
});

// --- 7: resist (D-07) ----------------------------------------------------------

test("resist (D-07): intel 12 hero — raw d20 11 resists a bolt (mirrored roll 10, no damage die), raw d20 12 fails (mirrored roll 9) then the bolt lands; intel 11 never rolls", () => {
  const state = fixedState({ c: { intel: 12 } });
  const foe = fixedFoe({ abilities: ["krupkeFreeze"] });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([1, 11]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "heroResisted"]);
  assert.equal(events[1].roll, 10);
  assert.equal(events[1].atLeast, 10);
  assert.equal(events[1].dieN, 20);
  assert.equal(events[1].intel, 12);
  assert.equal(state.c.wp, 55);

  const state2 = fixedState({ c: { intel: 12 } });
  const foe2 = fixedFoe({ abilities: ["krupkeFreeze"] });
  state2.combat = fixedCombat([foe2]);
  const events2 = foeTurn(state2, fakeRng([1, 12, 4]), []);
  assert.deepEqual(events2.map((e) => e.type), ["foeCast", "heroResistFailed", "foeBolted"]);
  assert.equal(events2[1].roll, 9);
  assert.equal(events2[1].atLeast, 10);
  assert.equal(events2[1].dieN, 20);
  assert.equal(events2[2].dmg, 4);

  const state3 = fixedState({ c: { intel: 11 } });
  const foe3 = fixedFoe({ abilities: ["krupkeFreeze"] });
  state3.combat = fixedCombat([foe3]);
  const events3 = foeTurn(state3, fakeRng([1, 4]), []);
  assert.deepEqual(events3.map((e) => e.type), ["foeCast", "foeBolted"]);
});

// --- 8: bolt through the hero pipeline (D-02) -----------------------------------

test("bolt through the pipeline (D-02): armor soak d20 applies to a bolt, Hardiness reduces it, a reflecting ward bounces it", () => {
  const armored = fixedState({ c: { ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" } });
  const foeA = fixedFoe({ abilities: ["krupkeFreeze"] });
  armored.combat = fixedCombat([foeA]);
  const eventsA = foeTurn(armored, fakeRng([1, 4, 10]), []);
  assert.deepEqual(eventsA.map((e) => e.type), ["foeCast", "armorSoaked"]);

  const hardy = fixedState({ c: { skills: { Hardiness: 1 } } });
  const foeB = fixedFoe({ abilities: ["krupkeFreeze"] });
  hardy.combat = fixedCombat([foeB]);
  const eventsB = foeTurn(hardy, fakeRng([1, 6]), []);
  assert.deepEqual(eventsB.map((e) => e.type), ["foeCast", "foeBolted"]);
  assert.equal(eventsB[1].dmg, 3);

  const warded = fixedState({ c: { ward: { pool: 10, reflect: true, rounds: 3 } } });
  const foeC = fixedFoe({ abilities: ["krupkeFreeze"], wp: 10, maxWP: 10 });
  warded.combat = fixedCombat([foeC]);
  const eventsC = foeTurn(warded, fakeRng([1, 4]), []);
  assert.deepEqual(eventsC.map((e) => e.type), ["foeCast", "wardReflected"]);
  assert.equal(eventsC[1].amount, 4);
  assert.equal(foeC.wp, 6);
  assert.equal(eventsC.some((e) => e.type === "foeBolted"), false);
});

// --- 9/10: drain (D-11) --------------------------------------------------------

test("drain (D-11): no soak roll on an armoured hero; heals the foe by the applied amount capped at maxWP; foeDrained after foeBolted", () => {
  const armored = fixedState({ c: { ar: 15, armorWP: 20, armorMax: 20, armorMin: 0, armor: "Studded" } });
  const foe = fixedFoe({ abilities: ["vampireDrain"], wp: 60, maxWP: 65 });
  armored.combat = fixedCombat([foe]);
  const events = foeTurn(armored, fakeRng([2, 3, 4]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeBolted", "foeDrained"]);
  assert.equal(events[1].dmg, 7);
  assert.equal(events[1].ignoresArmor, true);
  assert.deepEqual(events[2], { type: "foeDrained", name: "Target", ability: "vampireDrain", stolen: 5, wp: 65, maxWP: 65 });
  assert.equal(armored.c.wp, 48);

  const warded = fixedState({ c: { ward: { pool: 20, reflect: false, rounds: 3 } } });
  const foe2 = fixedFoe({ abilities: ["vampireDrain"], wp: 60, maxWP: 65 });
  warded.combat = fixedCombat([foe2]);
  const events2 = foeTurn(warded, fakeRng([2, 3, 4]), []);
  assert.deepEqual(events2.map((e) => e.type), ["foeCast", "wardAbsorbed"]);
  assert.equal(foe2.wp, 60);
});

test("drain kills: a lethal drain runs die() and foeTurn returns { died }", () => {
  const state = fixedState({ c: { wp: 5 } });
  const foe = fixedFoe({ abilities: ["vampireDrain"] });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([2, 3, 4]), []);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died"));
  assert.equal(events.some((e) => e.type === "foeDrained"), false);
});

// --- 11/12: debuff (D-09/D-10) ---------------------------------------------------

test("debuff (D-09/D-10): sets a NEW foeEffect with d4 rounds; same kind refreshes; different kind replaces; a resisted debuff does nothing", () => {
  const djinniDaze = FOE_ABILITIES.find((a) => a.id === "djinniDaze");
  const krupkeWeaken = FOE_ABILITIES.find((a) => a.id === "krupkeWeaken");

  const state = fixedState();
  const preset = { kind: "dazed", rounds: 1 };
  state.c.foeEffect = preset;
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);

  const events1 = [];
  resolveFoeAbility(state, foe, djinniDaze, fakeRng([3]), events1);
  assert.ok(events1.some((e) => e.type === "foeDebuffed" && e.kind === "dazed" && e.rounds === 3));
  assert.deepStrictEqual(state.c.foeEffect, { kind: "dazed", rounds: 3 });
  assert.notEqual(state.c.foeEffect, preset, "a fresh object, never a mutated reuse");

  const events2 = [];
  resolveFoeAbility(state, foe, krupkeWeaken, fakeRng([2]), events2);
  assert.deepStrictEqual(state.c.foeEffect, { kind: "weakened", rounds: 2 });

  state.c.intel = 14;
  const before = state.c.foeEffect;
  const events3 = [];
  resolveFoeAbility(state, foe, djinniDaze, fakeRng([5]), events3);
  assert.deepEqual(events3.map((e) => e.type), ["foeCast", "heroResisted"]);
  assert.equal(state.c.foeEffect, before, "unchanged reference — a resisted debuff never touches foeEffect");
});

test("debuff never targets a member; a debuff applied this foeTurn does not tick this foeTurn", () => {
  const state = fixedState({ party: [fixedMember()] });
  const foe = fixedFoe({ abilities: ["krupkeWeaken"], cd: { krupkeWeaken: 1 } });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = foeTurn(state, fakeRng([1, 1]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeDebuffed"]);
  assert.deepEqual(state.c.foeEffect, { kind: "weakened", rounds: 1 });
});

// --- 13: heal (D-02) -----------------------------------------------------------

test("heal (D-02): capped at maxWP, not ready at full HP", () => {
  const state = fixedState();
  const foe = fixedFoe({ abilities: ["stalkaHeal"], wp: 90, maxWP: 94, cd: { stalkaHeal: 1 } });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([1, 10]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeHealed"]);
  assert.deepEqual(events[1], { type: "foeHealed", name: "Target", ability: "stalkaHeal", amount: 4, wp: 94, maxWP: 94 });

  const state2 = fixedState();
  const foe2 = fixedFoe({ abilities: ["stalkaHeal"], wp: 94, maxWP: 94 });
  state2.combat = fixedCombat([foe2]);
  const events2 = foeTurn(state2, fakeRng([7]), []);
  assert.deepEqual(events2.map((e) => e.type), ["foeMissed"]);
});

// --- 14/15: summon (D-12) --------------------------------------------------------

test("summon (D-12): queues one pending reinforcement, joins next foeTurn, has no abilities, lvl = the roster tier its stats were drawn from, lives per twice", () => {
  const state = fixedState();
  const summoner = fixedFoe({ name: "Target", abilities: ["vampireSummon"], lvl: 5, cd: { vampireSummon: 1 } });
  state.combat = fixedCombat([summoner]);
  const events = foeTurn(state, fakeRng([1], { pick: (arr) => arr[1] }), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeSummoned"]);
  assert.deepEqual(events[1], { type: "foeSummoned", name: "Skeleton", by: "Target", pending: true });

  const skeletonBase = BESTIARY["Walking Dead"][1][1];
  assert.deepStrictEqual(state.combat.pendingFoes, [
    {
      by: "Target",
      foe: {
        name: "Skeleton",
        type: "Walking Dead",
        // WR-01 (19-REVIEW.md): lvl matches the tier-2 roster its stats came
        // from, NOT the summoner's own lvl (5) — the to-hit die/melee
        // damage/XP payout all key off f.lvl elsewhere in the engine.
        lvl: 2,
        size: skeletonBase.sz,
        intel: skeletonBase.i,
        wp: skeletonBase.wp,
        maxWP: skeletonBase.wp,
        alive: true,
        asleep: 0,
        sp: skeletonBase.sp,
        lives: 2,
      },
    },
  ]);
  assert.equal(Object.hasOwn(state.combat.pendingFoes[0].foe, "abilities"), false);

  summoner.asleep = 5;
  const events2 = foeTurn(state, fakeRng([7]), []);
  assert.deepEqual(events2.map((e) => e.type), ["foeSummoned", "foeSlept", "foeMissed"]);
  assert.equal(events2[0].pending, false);
  assert.equal(state.combat.foes.length, 2);

  // WR-01 regression guard: a summoner's OWN lvl must never leak into the
  // reinforcement's lvl — a lvl-1 summoner still spawns a lvl-2 (tier-2)
  // Skeleton, proving the two are fully decoupled.
  const state3 = fixedState();
  const weakSummoner = fixedFoe({ name: "Weak", abilities: ["vampireSummon"], lvl: 1, cd: { vampireSummon: 1 } });
  state3.combat = fixedCombat([weakSummoner]);
  foeTurn(state3, fakeRng([1], { pick: (arr) => arr[1] }), []);
  assert.equal(state3.combat.pendingFoes[0].foe.lvl, 2, "the summoned foe's lvl equals the tier-2 roster level, independent of the summoner's own lvl");
});

test("summon caps: not ready while one is pending or when live foes >= 4 (falls to the next kit entry)", () => {
  const state = fixedState();
  const foe = fixedFoe({ abilities: ["vampireSummon"] });
  state.combat = fixedCombat([foe], { pendingFoes: [{ by: "X", foe: fixedFoe({ name: "Y" }) }] });
  assert.equal(firstReadyAbility(state, foe), null, "a pending summon blocks a fresh one");

  const state2 = fixedState();
  const foe2 = fixedFoe({ abilities: ["vampireSummon"] });
  state2.combat = fixedCombat([foe2, fixedFoe({ name: "B" }), fixedFoe({ name: "C" }), fixedFoe({ name: "D" })]);
  assert.equal(firstReadyAbility(state2, foe2), null, "4 live foes total");

  const state3 = fixedState();
  const foe3 = fixedFoe({ abilities: ["vampireSummon"] });
  state3.combat = fixedCombat([foe3, fixedFoe({ name: "B" }), fixedFoe({ name: "C" })]);
  assert.ok(firstReadyAbility(state3, foe3), "3 live foes — ready");

  const state4 = fixedState();
  const foe4 = fixedFoe({ abilities: ["vampireSummon", "vampireFireball"], cd: { vampireFireball: 0 } });
  state4.combat = fixedCombat([foe4], { pendingFoes: [{ by: "X", foe: fixedFoe({ name: "Y" }) }] });
  const ready = firstReadyAbility(state4, foe4);
  assert.equal(ready.id, "vampireFireball");
});

// --- 16: summoned foe accounting ------------------------------------------------

test("summoned foe accounting: killFoe pays normal XP and it targets like any foe", () => {
  const state = fixedState();
  const vampire = fixedFoe({ name: "Vampire", abilities: ["vampireSummon"], lvl: 5, cd: { vampireSummon: 1 } });
  state.combat = fixedCombat([vampire]);
  foeTurn(state, fakeRng([1], { pick: (arr) => arr[1] }), []); // queue the Skeleton
  vampire.asleep = 5; // keep the Vampire quiet for the join visit
  // join at the top of the next foeTurn (vampire asleep -> 0 draws); the
  // freshly-joined Skeleton takes its own first melee swing and misses.
  foeTurn(state, fakeRng([7]), []);
  assert.equal(state.combat.foes.length, 2);
  const skeleton = state.combat.foes[1];
  assert.equal(skeleton.name, "Skeleton");
  assert.equal(skeleton.lives, 2);

  const events1 = killFoe(state, skeleton, fakeRng([]), []);
  assert.ok(events1.some((e) => e.type === "foeRevived"));
  assert.equal(skeleton.alive, true);

  const spBefore = state.c.sp;
  const events2 = killFoe(state, skeleton, fakeRng([4, 6, 20]), []);
  assert.equal(skeleton.alive, false);
  assert.ok(events2.some((e) => e.type === "foeKilled" && e.spGained > 0));
  assert.ok(state.c.sp > spBefore, "normal XP was paid, exactly like any other foe");
});

// --- 17: member path (D-13) ------------------------------------------------------

test("member path (D-13): a bolt on a live member skips resist/ward/armor, hits member.wp, and can down it; a drain on a member heals the foe by the raw dmg", () => {
  const state = fixedState({ c: { intel: 14 }, party: [fixedMember({ wp: 3, maxWP: 20 })] });
  const ally = fixedAlly({ wp: 3, maxWP: 20 });
  const foe = fixedFoe({ abilities: ["krupkeFreeze"] });
  state.combat = fixedCombat([foe], { allies: [ally] });
  const events = foeTurn(state, fakeRng([1, 2, 4]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeBolted", "memberDowned"]);
  assert.deepEqual(events[1], { type: "foeBolted", name: "Target", ability: "krupkeFreeze", dmg: 4, ignoresArmor: false, member: "Ada" });
  assert.equal(state.combat.allies.length, 0);
  assert.equal(state.party[0].status, "downed");
  assert.equal(events.some((e) => e.type === "heroResisted" || e.type === "heroResistFailed"), false);

  const state2 = fixedState({ c: { intel: 14 }, party: [fixedMember({ wp: 20, maxWP: 20 })] });
  const ally2 = fixedAlly({ wp: 20, maxWP: 20 });
  const foe2 = fixedFoe({ abilities: ["vampireDrain"], wp: 3, maxWP: 10 });
  state2.combat = fixedCombat([foe2], { allies: [ally2] });
  const events2 = foeTurn(state2, fakeRng([1, 2, 3, 4]), []);
  assert.deepEqual(events2.map((e) => e.type), ["foeCast", "foeBolted", "foeDrained"]);
  assert.equal(events2[1].dmg, 7);
  assert.equal(events2[1].ignoresArmor, true);
  assert.deepEqual(events2[2], { type: "foeDrained", name: "Target", ability: "vampireDrain", stolen: 7, wp: 10, maxWP: 10 });
  assert.equal(ally2.wp, 13);

  const state3 = fixedState({ c: { intel: 14 }, party: [fixedMember({ wp: 20, maxWP: 20 })] });
  const ally3 = fixedAlly({ wp: 20, maxWP: 20 });
  const foe3 = fixedFoe({ abilities: ["krupkeFreeze"] });
  state3.combat = fixedCombat([foe3], { allies: [ally3] });
  const events3 = foeTurn(state3, fakeRng([1, 1, 5]), []);
  assert.deepEqual(events3.map((e) => e.type), ["foeCast", "heroResisted"]);
});

// --- 18: two casters in one turn; hero death stops it ----------------------------

test("two casters in one foeTurn act in order; a hero death stops the turn", () => {
  const state = fixedState();
  const foeA = fixedFoe({ name: "A", abilities: ["krupkeFreeze"] });
  const foeB = fixedFoe({ name: "B", abilities: ["krupkeFreeze"] });
  state.combat = fixedCombat([foeA, foeB]);
  const events = foeTurn(state, fakeRng([1, 4, 1, 4]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeCast", "foeBolted", "foeCast", "foeBolted"]);
  assert.equal(state.c.wp, 47);

  const state2 = fixedState({ c: { wp: 5 } });
  const foeA2 = fixedFoe({ name: "A", abilities: ["krupkeFreeze"] });
  const foeB2 = fixedFoe({ name: "B", abilities: ["krupkeFreeze"] });
  state2.combat = fixedCombat([foeA2, foeB2]);
  const events2 = foeTurn(state2, fakeRng([1, 5]), []);
  assert.equal(events2.filter((e) => e.type === "foeCast").length, 1);
  assert.ok(events2.some((e) => e.type === "died"));
  assert.equal(events2.some((e) => e.type === "foeEffectFaded"), false);
  assert.equal(state2.combat, null);
});

// --- 19: startCombat's kit copy against the real bestiary --------------------------

test("startCombat copies the kit only for caster rows (real bestiary)", () => {
  let krupke = null;
  let chinaWolf = null;
  for (let seed = 1; seed <= 200 && (!krupke || !chinaWolf); seed++) {
    const s = newRun(1);
    // Phase 54 (BAND-02, USER RULING D): foe level keys to DEPTH now, never
    // the hero's level — depth 5 is the first floor whose foeLevelFor(d)
    // reads tier 2 (the identity map "1111222223333..."), so this is where
    // the tier-2 Humans roster (Krupke/China Wolf) becomes reachable.
    s.c.level = 2;
    s.floor.depth = 5;
    startCombat(s, false, "Humans", makeRng(seed), []);
    if (!s.combat) continue;
    for (const f of s.combat.foes) {
      if (f.name === "Krupke" && !krupke) krupke = f;
      if (f.name === "China Wolf" && !chinaWolf) chinaWolf = f;
    }
  }
  assert.ok(krupke, "expected a Krupke to roll within 200 seeds");
  assert.equal(Object.hasOwn(krupke, "abilities"), true);
  assert.deepStrictEqual(krupke.abilities, ["krupkeWeaken", "krupkeFreeze"]);
  const bestiaryRow = BESTIARY["Humans"][1].find((f) => f.n === "Krupke");
  assert.notEqual(krupke.abilities, bestiaryRow.abilities, "the kit array is a copy, not the same reference");
  assert.ok(chinaWolf, "expected a China Wolf to roll within 200 seeds");
  assert.equal(Object.hasOwn(chinaWolf, "abilities"), false);
});

// --- 20: narration builder coverage (Task 3) --------------------------------

test("narration: every new event builder returns a non-empty string for a bare { type } and for a full payload", () => {
  const NEW_KEYS = [
    "foeCast",
    "foeBolted",
    "foeDrained",
    "foeDebuffed",
    "foeHealed",
    "foeSummoned",
    "foeEffectFaded",
    "heroResisted",
    "heroResistFailed",
    "foePursued",
    "foeOutOfSpells",
  ];
  const FULL_PAYLOADS = {
    foeCast: { type: "foeCast", name: "Krupke", ability: "krupkeFreeze", kind: "bolt", txt: "Krupke flicks a chill at you." },
    foeBolted: { type: "foeBolted", name: "Krupke", ability: "krupkeFreeze", dmg: 4, ignoresArmor: false },
    foeDrained: { type: "foeDrained", name: "Vampire", ability: "vampireDrain", stolen: 5, wp: 65, maxWP: 65 },
    foeDebuffed: { type: "foeDebuffed", name: "Krupke", ability: "krupkeWeaken", kind: "weakened", rounds: 2 },
    foeHealed: { type: "foeHealed", name: "Stalka Beast", ability: "stalkaHeal", amount: 4, wp: 94, maxWP: 94 },
    foeSummoned: { type: "foeSummoned", name: "Skeleton", by: "Vampire", pending: true },
    foeEffectFaded: { type: "foeEffectFaded", kind: "dazed" },
    heroResisted: { type: "heroResisted", name: "Krupke", ability: "krupkeFreeze", roll: 10, atLeast: 10, dieN: 20, intel: 12 },
    heroResistFailed: { type: "heroResistFailed", name: "Krupke", ability: "krupkeFreeze", roll: 9, atLeast: 10, dieN: 20, intel: 12 },
    foePursued: { type: "foePursued", name: "Spectre" },
    foeOutOfSpells: { type: "foeOutOfSpells", name: "Drudge" },
  };

  for (const key of NEW_KEYS) {
    assert.equal(typeof EVENT_NARRATION[key], "function", `${key} must be a function`);
    const bare = EVENT_NARRATION[key]({ type: key });
    assert.equal(typeof bare, "string");
    assert.ok(bare.trim().length > 0, `${key} must render something for a bare { type }`);

    const full = EVENT_NARRATION[key](FULL_PAYLOADS[key]);
    assert.equal(typeof full, "string");
    assert.ok(full.trim().length > 0, `${key} must render something for a full payload`);
    const ability = FULL_PAYLOADS[key].ability;
    if (ability) {
      assert.equal(full.includes(ability), false, `${key} must not leak the engine ability id "${ability}"`);
    }
  }

  const lowHp = EVENT_NARRATION.foeFled({ type: "foeFled", name: "Djinni", reason: "lowHp" });
  const plain = EVENT_NARRATION.foeFled({ type: "foeFled", name: "Djinni" });
  assert.notEqual(lowHp, plain);
  assert.ok(lowHp.includes("Plane"));
});
