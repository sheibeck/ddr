// test/unit/foe-fumble-mechanics.test.js
//
// RULES-10 (Phase 75.1, plan 03) — the foe-side effects a helpful fumbled
// scroll can hand the TARGETED enemy: a foe ward (Shield pool) and an armed
// Bubble (catch/pop/rebound) in the one foe-damage seam and foeTurn's tail;
// foe Mirror Self (the strike cap every striker obeys); foe Strength
// (`might`, folded into foeLevelBase's shared term); and foe Regeneration.
// Every mechanic is engine-only today — no resolver sets these fields yet
// (that lands in 75.1-05) — so every test here builds the field directly on
// a fixture foe/state, mirroring test/unit/bubble-mirror.test.js's own
// direct-construction pattern for the hero's mirror equivalent.
//
// Local fixtures mirror test/unit/bubble-mirror.test.js and
// test/unit/party-combat.test.js verbatim, per this suite's established
// per-file convention (no cross-import of test helpers).

import test from "node:test";
import assert from "node:assert/strict";

import { damageFoe } from "../../engine/foeDamage.js";
import { applyFoeDamageToPlayer, foeTurn, allyTurn, alliesTurn, playerStrike, flee, foeLevelBase } from "../../engine/combat.js";
import { targetStrikeFaces, heroStrikeFacesVs } from "../../engine/derived.js";
import { derivedRng } from "../../engine/rng.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// every might/regen test below computes an EXPECTED delta through the same
// curve the engine reads (foeHitFor/foeLevelBase/roundDamageCapFor), so it
// runs under the explicit identity override every other file in this family
// uses (test/unit/harness/identityDials.js) to keep that arithmetic simple
// and stable across a later fit.
setIdentityDials();

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count. Throws if the sequence underflows — this doubles
 * as a "no more rng draws expected" assertion. */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
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
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
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

/** DFB-05: a fully class-shaped party sheet — Knight + Club + prof 2, so
 * alliesTurn's classed branch (memberStrike) fires instead of the legacy
 * fallback. */
function classedMember(overrides = {}) {
  return fixedMember({
    cls: "Fighter", sub: "Knight", race: "Human", weapon: "Club", prof: 2, magicWpn: 0, might: 0,
    items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0,
    ...overrides,
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Task 1: the foe ward (Shield) and armed Bubble in the damage seam, the
// rebound, and the ward tick.
// ══════════════════════════════════════════════════════════════════════════

// --- Shield pool -------------------------------------------------------

test("damageFoe: a foe ward pool absorbs a blow smaller than the pool, narrated with amount/left, no wp loss", () => {
  const foe = fixedFoe({ wp: 10, maxWP: 10, ward: { name: "Shield", pool: 50, rounds: 5 } });
  const state = fixedState();
  const events = [];
  const result = damageFoe(state, foe, 20, { kind: "melee" }, fakeRng([]), events);
  assert.deepEqual(result, { applied: 0, soaked: true, mult: 1 });
  assert.equal(foe.ward.pool, 30);
  assert.equal(foe.wp, 10, "no wp lost — the pool ate the whole blow");
  assert.deepEqual(events, [{ type: "foeWardSoaked", name: "Target", amount: 20, left: 30 }]);
});

test("damageFoe: ward pool boundary — an exact blow shatters it clean, one over lets the remainder through, one under leaves 1", () => {
  const cases = [
    { dmg: 30, applied: 0, poolAfter: null },
    { dmg: 31, applied: 1, poolAfter: null },
    { dmg: 29, applied: 0, poolAfter: 1 },
  ];
  for (const { dmg, applied, poolAfter } of cases) {
    const foe = fixedFoe({ wp: 10, maxWP: 10, ward: { name: "Shield", pool: 30, rounds: 5 } });
    const state = fixedState();
    const events = [];
    const result = damageFoe(state, foe, dmg, { kind: "melee" }, fakeRng([]), events);
    assert.equal(result.applied, applied, `dmg ${dmg}: applied`);
    assert.equal(foe.wp, 10 - applied, `dmg ${dmg}: wp`);
    if (poolAfter === null) {
      assert.equal(foe.ward, undefined, `dmg ${dmg}: ward removed`);
      assert.ok(events.some((e) => e.type === "foeWardBroken" && e.name === "Target"), `dmg ${dmg}: foeWardBroken`);
    } else {
      assert.equal(foe.ward.pool, poolAfter, `dmg ${dmg}: pool remaining`);
      assert.equal(events.some((e) => e.type === "foeWardBroken"), false, `dmg ${dmg}: ward survives`);
    }
  }
});

test("damageFoe: order — the multiplier and halfDmg apply BEFORE the ward pool, and the natural-armor soak only ever sees the remainder", () => {
  const foe = fixedFoe({ name: "Trachea", type: "Lair Beasts", wp: 999, maxWP: 999, sp: { halfDmg: true, ar: 12 }, ward: { name: "Shield", pool: 3, rounds: 5 } });
  const state = fixedState();
  const events = [];
  // raw melee 10 from a Fighter vs Trachea -> CANON-04 x2 = 20; halfDmg
  // ceils 20/2 = 10; the pool (3) absorbs 3, leaving 7 to face the
  // natural-armor soak (ar 12 -> atLeastFor(12,20)=9; raw draw 5 mirrors to
  // face 16, well past 9 -> soaked).
  const result = damageFoe(state, foe, 10, { kind: "melee", casterClass: "Fighter" }, fakeRng([5]), events);
  assert.deepEqual(events[0], { type: "foeWardSoaked", name: "Trachea", amount: 3, left: 0 });
  assert.ok(events.some((e) => e.type === "foeWardBroken"));
  assert.deepEqual(events[2], { type: "foeArmorSoaked", name: "Trachea", amount: 7, roll: 16, atLeast: 9, dieN: 20 });
  assert.equal(result.applied, 0);
  assert.equal(result.soaked, true);
  assert.equal(foe.wp, 999, "the armor soak absorbed the remainder — no wp lost");
});

test("foeTurn: a foe ward with rounds 2 lasts two foeTurns, fading with foeWardFaded on the second tail tick", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Shield", pool: 10, rounds: 2 } });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  // a huge raw draw mirrors to a deeply negative roll-high face — guaranteed miss.
  let events = foeTurn(state, fakeRng([999]), []);
  assert.equal(foe.ward.rounds, 1);
  assert.equal(events.some((e) => e.type === "foeWardFaded"), false);
  events = foeTurn(state, fakeRng([999]), []);
  assert.equal(foe.ward, undefined);
  assert.ok(events.some((e) => e.type === "foeWardFaded" && e.name === "Target"));
});

// --- Armed Bubble: catch, pop, rebound ----------------------------------

test("damageFoe: an armed foe Bubble catches the first blow in full, pops into a popPool pool that then soaks the NEXT blow the same round", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Bubble", mirror: true, popPool: 25 } });
  const state = fixedState();
  const events1 = [];
  const caught = damageFoe(state, foe, 18, { kind: "melee" }, fakeRng([]), events1);
  assert.deepEqual(caught, { applied: 0, soaked: true, mult: 1 });
  assert.deepEqual(events1, [{ type: "foeBubbleCaught", name: "Target", amount: 18 }]);
  assert.deepEqual(foe.ward, { name: "Bubble", pool: 25, rounds: 1 });
  assert.equal(foe.rebound, 18);
  assert.equal(foe.wp, 999, "the catch never touched hp");

  const events2 = [];
  const soaked = damageFoe(state, foe, 10, { kind: "melee" }, fakeRng([]), events2);
  assert.deepEqual(soaked, { applied: 0, soaked: true, mult: 1 });
  assert.deepEqual(events2, [{ type: "foeWardSoaked", name: "Target", amount: 10, left: 15 }]);
  // Adjacency: the caught blow and the popped pool never apply to the same
  // blow — each of these two blows produced exactly one narrated outcome.
  assert.equal(foe.wp, 999, "neither blow ever reached the foe's own hp");

  // the popped pool always fades at THIS round's own foeTurn tail.
  delete foe.rebound;
  state.combat = fixedCombat([foe]);
  const events3 = foeTurn(state, fakeRng([999]), []);
  assert.equal(foe.ward, undefined);
  assert.ok(events3.some((e) => e.type === "foeWardFaded"));
});

test("damageFoe: an armed foe Bubble absorbs an ally- or foe-sourced catch but stores no rebound", () => {
  for (const kind of ["ally", "foe"]) {
    const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Bubble", mirror: true, popPool: 25 } });
    const state = fixedState();
    const events = [];
    const result = damageFoe(state, foe, 12, { kind }, fakeRng([]), events);
    assert.deepEqual(result, { applied: 0, soaked: true, mult: 1 }, kind);
    assert.equal(foe.rebound, undefined, `${kind}: no rebound stored`);
    assert.deepEqual(foe.ward, { name: "Bubble", pool: 25, rounds: 1 }, kind);
  }
});

test("damageFoe: an armed foe Bubble catches a spell and an item blow too, both stored as a rebound", () => {
  for (const kind of ["spell", "item", "reflect"]) {
    const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Bubble", mirror: true, popPool: 25 } });
    const state = fixedState();
    const result = damageFoe(state, foe, 9, { kind }, fakeRng([]), []);
    assert.deepEqual(result, { applied: 0, soaked: true, mult: 1 }, kind);
    assert.equal(foe.rebound, 9, `${kind}: rebound stored`);
  }
});

test("foeTurn: a hero-side blow caught by a foe Bubble is thrown back at the TOP of the foe's next turn, ignoring armor", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, rebound: 20 });
  const state = fixedState({ c: { armor: "Plate", ar: 10, armorWP: 50, armorMax: 50, armorMin: 0 } });
  state.combat = fixedCombat([foe]);
  // no draw for the rebound itself (dmg is passed directly); the ONE value
  // below is spent on the foe's OWN ordinary swing later this same visit.
  const events = foeTurn(state, fakeRng([999]), []);
  const rebound = events.find((e) => e.type === "foeBubbleRebound");
  assert.deepEqual(rebound, { type: "foeBubbleRebound", name: "Target", amount: 20 });
  assert.equal(foe.rebound, undefined, "the rebound is deleted once thrown");
  assert.equal(state.c.wp, 55 - 20, "armor never rolled for it — ignoresArmor true");
  assert.ok(events.some((e) => e.type === "foeBolted" && e.ability === "Bubble" && e.ignoresArmor === true && e.dmg === 20));
});

test("foeTurn: a lethal rebound kills the hero and foeTurn returns at once", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, rebound: 60 });
  const state = fixedState({ c: { wp: 40, maxWP: 40 } });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "foeBubbleRebound"));
  assert.equal(state.dead, true);
  assert.equal(state.combat, null);
});

test("foeTurn: a foe that died before its next turn drops its stored rebound silently — no event, no damage, no draw", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, rebound: 30, alive: false });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([]), []);
  assert.equal(foe.rebound, undefined);
  assert.equal(events.some((e) => e.type === "foeBubbleRebound"), false);
  assert.equal(state.c.wp, 55);
});

test("foeTurn: an ARMED foe Bubble mirror is never ticked down by the tail — it stays armed until a blow lands", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, ward: { name: "Bubble", mirror: true, popPool: 25 } });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([999]), []);
  assert.deepEqual(foe.ward, { name: "Bubble", mirror: true, popPool: 25 });
  assert.equal(events.some((e) => e.type === "foeWardFaded"), false);
});

// --- Inertness (Task 1) --------------------------------------------------

test("inertness: a plain foe (no ward/rebound) takes damage through damageFoe exactly as before — zero new draws, no new events", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999 });
  const state = fixedState();
  const events = [];
  const result = damageFoe(state, foe, 7, { kind: "melee" }, fakeRng([]), events);
  assert.deepEqual(result, { applied: 7, soaked: false, mult: 1 });
  assert.equal(foe.wp, 992);
  assert.deepEqual(events, []);
});

// ══════════════════════════════════════════════════════════════════════════
// Task 2: foe Mirror Self, foe Strength (might), foe Regeneration.
// ══════════════════════════════════════════════════════════════════════════

// --- Mirror Self: targetStrikeFaces + heroStrikeFacesVs ------------------

test("targetStrikeFaces: Mirror Self caps an ordinary target's faces to 1", () => {
  const c = fixedFighter();
  const t = fixedFoe({ mirror: 1 });
  assert.equal(targetStrikeFaces(c, t, 5), 1);
});

test("targetStrikeFaces: Mirror Self never revives an already-untouchable (magicOnly) foe — 0 stays 0", () => {
  const c = fixedFighter({ magicWpn: 0 });
  const t = fixedFoe({ sp: { magicOnly: true }, mirror: 5 });
  assert.equal(targetStrikeFaces(c, t, 5), 0);
});

test("heroStrikeFacesVs: reports the same Mirror Self cap the strike itself rolls against", () => {
  const state = fixedState();
  const t = fixedFoe({ mirror: 3, wp: 999, maxWP: 999 });
  assert.equal(heroStrikeFacesVs(state, t), 1);
});

test("playerStrike: a mirrored foe caps to the top face and the miss event carries a negative 'Mirror Self' mod", () => {
  const foe = fixedFoe({ mirror: 3, wp: 999, maxWP: 999 });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  // toHit(state) baseline is 5 for a plain Fighter/Soldier on a Club; mirror
  // caps it to 1 -> atLeastFor(1, 20) = 20 (only the die's top face hits).
  // raw draw 2 mirrors to face 19 — one short — a clean miss. playerStrike's
  // own miss then falls through to afterPlayerAction's foeTurn (the foe's
  // own turn) — a huge second raw draw guarantees ITS swing misses too.
  const events = playerStrike(state, fakeRng([2, 999]), []);
  const missed = events.find((e) => e.type === "strikeMissed");
  assert.ok(missed, "the strike missed under the cap");
  assert.equal(missed.roll, 19);
  assert.equal(missed.atLeast, 20);
  assert.deepEqual(missed.mods, [{ name: "Mirror Self", delta: -4 }]);
});

test("allyTurn: a mirrored foe caps a summoned ally's strike to the die's top face", () => {
  const foe = fixedFoe({ mirror: 3, wp: 999, maxWP: 999 });
  const state = fixedState();
  state.combat = fixedCombat([foe], { ally: { lvl: 1, name: "Summon", rounds: 5 } });
  // dieN 20 (STRIKE_DICE[0]); faces floor 5 capped to 1 by mirror ->
  // atLeastFor(1,20)=20. raw draw 5 mirrors to face 16 — short of 20, a miss
  // under the cap (it would have HIT at the uncapped faces-5 threshold, 16).
  const events = allyTurn(state, fakeRng([5]), []);
  assert.ok(events.some((e) => e.type === "allyMissed"));
  assert.equal(foe.wp, 999, "the mirror cap turned what would have been a hit into a miss");
});

test("alliesTurn (legacy branch): a mirrored foe caps a legacy ally's strike to the top face", () => {
  const foe = fixedFoe({ mirror: 3, wp: 999, maxWP: 999 });
  const state = fixedState({ party: [] });
  state.combat = fixedCombat([foe], { allies: [{ partyIdx: 0, name: "Legacy", lvl: 1, wp: 20, maxWP: 20 }] });
  const events = alliesTurn(state, fakeRng([5]), []);
  assert.ok(events.some((e) => e.type === "allyMissed"));
  assert.equal(foe.wp, 999);
});

test("alliesTurn (memberStrike): a class-fighting party member's strike is also capped to the mirrored foe's top face", () => {
  const foe = fixedFoe({ mirror: 3, type: "Humans", wp: 999, maxWP: 999 });
  const state = fixedState({ party: [classedMember()] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  // memberToHit(Fighter/Human)=5, capped to 1 by mirror -> atLeastFor(1,20)=20.
  // raw draw 5 mirrors to face 16 — short of 20, a miss under the cap.
  const events = alliesTurn(state, fakeRng([5]), []);
  assert.ok(events.some((e) => e.type === "allyMissed"));
  assert.equal(foe.wp, 999);
});

test("foeTurn: a foe's own Mirror Self (mirror 2) lasts two foeTurns, fading once with foeMirrorFaded at 0", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999, mirror: 2 });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  let events = foeTurn(state, fakeRng([999]), []);
  assert.equal(foe.mirror, 1);
  assert.equal(events.some((e) => e.type === "foeMirrorFaded"), false);
  events = foeTurn(state, fakeRng([999]), []);
  assert.equal(foe.mirror, 0);
  assert.ok(events.some((e) => e.type === "foeMirrorFaded" && e.name === "Target"));
});

// --- Foe Strength (might), via foeLevelBase -------------------------------

test("foeLevelBase: might adds flat atop the level-base (or strikesAs) term, a pure 0 when absent", () => {
  assert.equal(foeLevelBase({ lvl: 1 }), 1);
  assert.equal(foeLevelBase({ lvl: 1, might: 7 }), 8);
  assert.equal(foeLevelBase({ lvl: 2, might: 0 }), 4);
  assert.equal(foeLevelBase({ lvl: 2, sp: { strikesAs: 5 }, might: 7 }), 32);
});

test("foeTurn (hero branch): a foe with might 7 deals exactly 7 more on a landed blow than the same foe without it", () => {
  const dmgFor = (might) => {
    const foe = fixedFoe({ wp: 999, maxWP: 999, ...(might ? { might } : {}) });
    const state = fixedState();
    state.combat = fixedCombat([foe]);
    // raw 5 -> roll 16, hits (atLeastFor(5,20)=16); dmg dice draw 4.
    const events = foeTurn(state, fakeRng([5, 4]), []);
    return events.find((e) => e.type === "struckByFoe").dmg;
  };
  assert.equal(dmgFor(7) - dmgFor(0), 7);
});

test("foeTurn (member branch): a foe with might 7 deals exactly 7 more on a landed blow against a party member than without it", () => {
  const dmgFor = (might) => {
    const foe = fixedFoe({ wp: 999, maxWP: 999, ...(might ? { might } : {}) });
    const state = fixedState({ party: [fixedMember()] });
    state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
    // pickFoeTarget: one live member -> pool size 2; raw pick 2 targets it.
    // to-hit raw 5 -> roll 16, hits (atLeastFor(5,20)=16); dmg dice draw 4.
    const events = foeTurn(state, fakeRng([2, 5, 4]), []);
    return events.find((e) => e.type === "memberStruck").dmg;
  };
  assert.equal(dmgFor(7) - dmgFor(0), 7);
});

test("pursuitStrike (via flee): a foe with might 7 deals exactly 7 more than the same foe without it", () => {
  const dmgFor = (might) => {
    const state = fixedState({ c: { sub: "Cloaker" } });
    const foe = fixedFoe({ sp: { pursues: true }, wp: 999, maxWP: 999, ...(might ? { might } : {}) });
    state.combat = fixedCombat([foe], { pending: false, opened2: false });
    const events = [];
    flee(state, fakeRng([5, 4]), events);
    return events.find((e) => e.type === "struckByFoe").dmg;
  };
  assert.equal(dmgFor(7) - dmgFor(0), 7);
});

// --- Foe Regeneration ------------------------------------------------------

test("foeTurn: a live foe with regen below maxWP regains a capped d8 each visit, narrated with amount/wp/maxWP", () => {
  const foe = fixedFoe({ regen: true, wp: 10, maxWP: 30 });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  // predicted from the SAME derived key the engine draws — a fresh, pure
  // call to the same helper, mirroring items.js#pilferFumbleRng's own
  // "a test can predict it from a fresh call with the same key" pattern.
  const expectedRoll = derivedRng(0, "foeRegen", state.combat.round, 0).d(8);
  const healed = Math.min(30 - 10, expectedRoll);
  // a huge raw draw on the foe's OWN swing this turn -> guaranteed miss.
  const events = foeTurn(state, fakeRng([999]), []);
  assert.equal(foe.wp, 10 + healed);
  assert.deepEqual(events.find((e) => e.type === "foeRegenerated"), {
    type: "foeRegenerated", name: "Target", amount: healed, wp: 10 + healed, maxWP: 30,
  });
});

test("foeTurn: a foe with regen at full hp draws nothing and narrates nothing for it", () => {
  const foe = fixedFoe({ regen: true, wp: 30, maxWP: 30 });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([999]), []);
  assert.equal(events.some((e) => e.type === "foeRegenerated"), false);
  assert.equal(foe.wp, 30);
});

test("foeTurn: an asleep foe still regenerates, ahead of the sleep skip, drawing zero main-rng", () => {
  const foe = fixedFoe({ regen: true, wp: 10, maxWP: 30, asleep: 1 });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  const expectedRoll = derivedRng(0, "foeRegen", state.combat.round, 0).d(8);
  const healed = Math.min(30 - 10, expectedRoll);
  // fakeRng([]) throws on any draw — an asleep foe never swings, so this
  // proves regen drew ONLY from its own derived stream, never the main rng.
  const events = foeTurn(state, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "foeRegenerated" && e.amount === healed));
  assert.ok(events.some((e) => e.type === "foeSlept"));
  assert.equal(foe.wp, 10 + healed);
  assert.equal(foe.asleep, 0);
});

// --- Inertness (Task 2) ----------------------------------------------------

test("inertness: a plain foe (no ward/rebound/mirror/might/regen) strikes and is struck with the exact same draws and damage as before", () => {
  const foe = fixedFoe({ wp: 999, maxWP: 999 });
  const state = fixedState();
  state.combat = fixedCombat([foe]);
  // to-hit raw draw 5 -> roll 16 hits (atLeastFor(5,20)=16); dmg dice draw 4.
  // fakeRng's throw-on-underflow proves NOTHING beyond these two draws fires.
  const events = foeTurn(state, fakeRng([5, 4]), []);
  const struck = events.find((e) => e.type === "struckByFoe");
  assert.ok(struck);
  assert.equal(struck.dmg, foeLevelBase(foe) + 4, "might is a pure 0 no-op — identical to the pre-Phase-75.1 formula");
});
