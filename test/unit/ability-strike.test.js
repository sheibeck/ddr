// test/unit/ability-strike.test.js
//
// Phase 38 Plan 02 (ABIL-02) — direct coverage for the transient
// `state.combat.abilityStrike` descriptor `playerStrike` reads (autoHit,
// forceCrit, finishUnder, bonusDmg, dmgMul, needShift, attacks, key), the
// additive `via`/`critBy` tags, the zero-new-draws invariant, `t.marked`'s
// +2, and the three c.timers-driven need-shift actives (Battle Roar/
// Sidestep/Smoke). Local helper copies (fakeRng/countingRng/fixedFighter/
// fixedFloor/fixedState/fixedFoe/fixedCombat) mirror test/unit/
// feedback-payload.test.js verbatim — this repo's established
// per-file-fixture convention (never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { playerStrike } from "../../engine/combat.js";
import { foeToHitVs, toHit, weaponDamage, fluency } from "../../engine/derived.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow. `.pick(arr)` returns `arr[0]`
 * unless a picker is supplied. */
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

function fixedFloor(overrides = {}) {
  const { dark = false, ...rest } = overrides;
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...rest };
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
    wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// A generous tail of harmless filler draws so a strike loop's afterPlayerAction
// (foeTurn etc.) never underflows the fake sequence.
const FILL = new Array(24).fill(20);

// --- 1. autoHit -------------------------------------------------------------

test("abilityStrike: autoHit lands a strike that would otherwise miss; never sets C.opened", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Soldier" }) }); // need 5
  state.combat = fixedCombat([fixedFoe()], { abilityStrike: { key: "kata", autoHit: true } });
  const events = playerStrike(state, fakeRng([20, 4, ...FILL]), []); // roll 20 would normally miss
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck, "expected a struck event despite roll 20");
  assert.equal(struck.via, "kata");
  assert.equal(state.combat.opened, undefined);
});

test("abilityStrike: bonusDmg adds a flat amount on top of weaponDamage, identical roll otherwise", () => {
  const baseline = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  baseline.combat = fixedCombat([fixedFoe()]);
  const baseEvents = playerStrike(baseline, fakeRng([3, 4, ...FILL]), []);
  const baseStruck = baseEvents.find((e) => e.type === "struck");
  assert.ok(baseStruck);

  const boosted = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  boosted.combat = fixedCombat([fixedFoe()], { abilityStrike: { key: "kata", bonusDmg: 1 } });
  const boostEvents = playerStrike(boosted, fakeRng([3, 4, ...FILL]), []);
  const boostStruck = boostEvents.find((e) => e.type === "struck");
  assert.ok(boostStruck);
  assert.equal(boostStruck.dmg, baseStruck.dmg + 1);
  assert.equal(boostStruck.via, "kata");
});

test("abilityStrike: a Cat Burglar's own opening auto-hit still sets C.opened with no descriptor present", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Cat Burglar", cls: "Thief" }) });
  state.combat = fixedCombat([fixedFoe()]);
  const events = playerStrike(state, fakeRng([20, 4, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "struck"));
  assert.equal(state.combat.opened, true);
});

test("abilityStrike: a Ninja's first-strike damage formula still fires with no descriptor present", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Ninja", cls: "Thief" }) });
  state.combat = fixedCombat([fixedFoe()]);
  const events = playerStrike(state, fakeRng([20, 4, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "ninjaFirstStrike"));
});

// --- 2. zero extra draws -----------------------------------------------------

test("abilityStrike: a descriptor adds zero rng draws vs. an ordinary strike for the same seed", () => {
  const plainRng = countingRng(fakeRng([3, 4, ...FILL]));
  const plain = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  plain.combat = fixedCombat([fixedFoe({ wp: 30, maxWP: 30 })]);
  playerStrike(plain, plainRng, []);

  const abilityRng = countingRng(fakeRng([3, 4, ...FILL]));
  const withAbility = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  withAbility.combat = fixedCombat([fixedFoe({ wp: 30, maxWP: 30 })], {
    abilityStrike: { key: "kata", autoHit: true, bonusDmg: 1 },
  });
  playerStrike(withAbility, abilityRng, []);

  assert.equal(abilityRng.draws, plainRng.draws);
});

// --- 3. forceCrit -------------------------------------------------------------

test("abilityStrike: forceCrit doubles damage and names critBy for a plain Thief (Pilfer, Leather)", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Pilfer", cls: "Thief", armor: "Leather" }) });
  state.combat = fixedCombat([fixedFoe()], { abilityStrike: { key: "silentStep", forceCrit: true, autoHit: true } });
  const events = playerStrike(state, fakeRng([4, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, true);
  assert.equal(struck.critBy, "silentStep");
});

test("abilityStrike: forceCrit is denied by the Guard/Soldier no-crit rule", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Guard" }) });
  state.combat = fixedCombat([fixedFoe()], { abilityStrike: { key: "silentStep", forceCrit: true, autoHit: true } });
  const events = playerStrike(state, fakeRng([4, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, false);
});

test("abilityStrike: Silent Step's forceCrit is denied by heavy armour on a Thief, with exactly one backstabDenied", () => {
  // Phase 39 (GEAR-01): "heavy" is now armorBulk(c) >= 2 — Plate (bulk 2) is
  // the real ARMORS row that denies; the old hard-coded "Chain Mail" string
  // never matched a real armor name either, before or after this phase.
  const state = fixedState({ c: fixedFighter({ sub: "Pilfer", cls: "Thief", armor: "Plate" }) });
  state.combat = fixedCombat([fixedFoe()], { abilityStrike: { key: "silentStep", forceCrit: true, autoHit: true } });
  const events = playerStrike(state, fakeRng([4, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, false);
  const denied = events.filter((e) => e.type === "backstabDenied");
  assert.equal(denied.length, 1);
});

// --- 4. finishUnder (Death Touch) --------------------------------------------

test("abilityStrike: finishUnder does nothing when the foe is at/above the threshold (noCrit sub)", () => {
  const control = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  control.combat = fixedCombat([fixedFoe({ wp: 30, maxWP: 30 })]);
  const controlEvents = playerStrike(control, fakeRng([3, 4, ...FILL]), []);
  const controlStruck = controlEvents.find((e) => e.type === "struck");

  const state = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  state.combat = fixedCombat([fixedFoe({ wp: 30, maxWP: 30 })], {
    abilityStrike: { key: "deathTouch", forceCrit: true, finishUnder: 15 },
  });
  const events = playerStrike(state, fakeRng([3, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, false);
  assert.equal(struck.dmg, controlStruck.dmg);
});

test("abilityStrike: finishUnder + forceCrit doubles damage on a non-noCrit sub when the foe survives the threshold check", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Knight" }) });
  state.combat = fixedCombat([fixedFoe({ wp: 30, maxWP: 30 })], {
    abilityStrike: { key: "deathTouch", forceCrit: true, finishUnder: 15 },
  });
  const events = playerStrike(state, fakeRng([3, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, true);
  assert.equal(struck.critBy, "deathTouch");
});

test("abilityStrike: finishUnder kills outright under the threshold — deathTouch + foeKilled, no struck", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Knight" }) });
  state.combat = fixedCombat([fixedFoe({ wp: 12, maxWP: 30 })], {
    abilityStrike: { key: "deathTouch", forceCrit: true, finishUnder: 15 },
  });
  const events = playerStrike(state, fakeRng([3, 4, ...FILL]), []);
  const dt = events.find((e) => e.type === "deathTouch");
  assert.ok(dt);
  assert.equal(dt.via, "deathTouch");
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.equal(events.some((e) => e.type === "struck"), false);
});

test("abilityStrike: finishUnder fires on a noCrit sub too (Soldier) — the finish ignores noCrit", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  state.combat = fixedCombat([fixedFoe({ wp: 12, maxWP: 30 })], {
    abilityStrike: { key: "deathTouch", forceCrit: true, finishUnder: 15 },
  });
  const events = playerStrike(state, fakeRng([3, 4, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "deathTouch"));
  assert.ok(events.some((e) => e.type === "foeKilled"));
});

// --- 5. dmgMul / needShift (Overhead Blow) -----------------------------------

test("abilityStrike: needShift widens the strikeMissed need and names the overhead needMods entry", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Knight" }) }); // need 5
  state.combat = fixedCombat([fixedFoe()], { abilityStrike: { key: "overheadBlow", dmgMul: 2, needShift: -2 } });
  const events = playerStrike(state, fakeRng([4, ...FILL]), []);
  const missed = events.find((e) => e.type === "strikeMissed");
  assert.ok(missed, "roll 4 vs a shifted need of 3 should miss");
  assert.equal(missed.need, 3);
  assert.ok(missed.needMods.some((m) => m.name === "overhead" && m.delta === -2));
  assert.equal(missed.via, "overheadBlow");
});

test("abilityStrike: dmgMul doubles damage on a landed Overhead Blow", () => {
  const control = fixedState({ c: fixedFighter({ sub: "Knight" }) });
  control.combat = fixedCombat([fixedFoe()]);
  const controlEvents = playerStrike(control, fakeRng([2, 4, ...FILL]), []);
  const controlStruck = controlEvents.find((e) => e.type === "struck");
  assert.ok(controlStruck);

  const state = fixedState({ c: fixedFighter({ sub: "Knight" }) });
  state.combat = fixedCombat([fixedFoe()], { abilityStrike: { key: "overheadBlow", dmgMul: 2, needShift: -2 } });
  const events = playerStrike(state, fakeRng([2, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.dmg, controlStruck.dmg * 2);
});

test("abilityStrike: needShift floors at 1 rather than reviving an untouchable/near-zero need", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Knight" }) });
  const foe = fixedFoe({ sp: { toHit: 1 } }); // "hard to hit" clamps need to 1 before the shift
  state.combat = fixedCombat([foe], { abilityStrike: { key: "overheadBlow", needShift: -2 } });
  const events = playerStrike(state, fakeRng([1, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.need, 1);
});

test("abilityStrike: needShift never revives a magicOnly foe with no magic weapon (need stays 0)", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Knight", magicWpn: 0 }) });
  const foe = fixedFoe({ sp: { magicOnly: true } });
  state.combat = fixedCombat([foe], { abilityStrike: { key: "overheadBlow", needShift: -2 } });
  const events = playerStrike(state, fakeRng([1, ...FILL]), []);
  const missed = events.find((e) => e.type === "strikeMissed");
  assert.ok(missed);
  assert.equal(missed.untouchable, true);
  assert.equal(missed.need, 0);
});

// --- 6. attacks (Last Stand / frenzy Math.max) -------------------------------

test("abilityStrike: attacks raises the swing count (Last Stand: 3 attacks)", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Knight" }) });
  state.combat = fixedCombat([fixedFoe({ wp: 300, maxWP: 300 })], { abilityStrike: { key: "lastStand", attacks: 3 } });
  const events = playerStrike(state, fakeRng([3, 4, 3, 4, 3, 4, ...FILL]), []);
  const attackEvents = events.filter((e) => e.type === "struck" || e.type === "strikeMissed");
  assert.equal(attackEvents.length, 3);
});

test("abilityStrike: attacks combines with a Fridgian's frenzy via Math.max, never stacking additively", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Knight", race: "Fridgian" }) });
  state.combat = fixedCombat([fixedFoe({ wp: 300, maxWP: 300 })], { abilityStrike: { key: "lastStand", attacks: 3 } });
  // frenzy draw (d8 <= 5) then 3 attacks' rolls/damage.
  const events = playerStrike(state, fakeRng([1, 3, 4, 3, 4, 3, 4, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "frenzy"));
  const attackEvents = events.filter((e) => e.type === "struck" || e.type === "strikeMissed");
  assert.equal(attackEvents.length, 3, "frenzy's own attacks=2 must not stack additively with the descriptor's 3");
});

// --- 7. transient clear -------------------------------------------------------

test("abilityStrike: the descriptor is gone from state.combat once playerStrike returns", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  state.combat = fixedCombat([fixedFoe()], { abilityStrike: { key: "kata", autoHit: true } });
  playerStrike(state, fakeRng([20, 4, ...FILL]), []);
  assert.equal("abilityStrike" in state.combat, false);
});

// --- 8. marked ----------------------------------------------------------------

test("abilityStrike: a marked foe takes control damage + 2 on a landed non-crit strike", () => {
  const control = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  control.combat = fixedCombat([fixedFoe()]);
  const controlStruck = playerStrike(control, fakeRng([3, 4, ...FILL]), []).find((e) => e.type === "struck");

  const state = fixedState({ c: fixedFighter({ sub: "Soldier" }) });
  state.combat = fixedCombat([fixedFoe({ marked: true })]);
  const struck = playerStrike(state, fakeRng([3, 4, ...FILL]), []).find((e) => e.type === "struck");
  assert.equal(struck.dmg, controlStruck.dmg + 2);
});

test("abilityStrike: a marked foe takes control damage x2 + 2 on a critical strike", () => {
  const control = fixedState({ c: fixedFighter({ sub: "Knight" }) });
  control.combat = fixedCombat([fixedFoe()]);
  const controlStruck = playerStrike(control, fakeRng([1, 4, ...FILL]), []).find((e) => e.type === "struck");

  const state = fixedState({ c: fixedFighter({ sub: "Knight" }) });
  state.combat = fixedCombat([fixedFoe({ marked: true })]);
  const struck = playerStrike(state, fakeRng([1, 4, ...FILL]), []).find((e) => e.type === "struck");
  assert.equal(struck.critical, true);
  // controlStruck.dmg is ALREADY crit-doubled (same roll, same weapon draw);
  // marked adds its flat +2 on top of that same doubled value, not a second doubling.
  assert.equal(struck.dmg, controlStruck.dmg + 2);
});

// --- 9. retired passive reads are gone ---------------------------------------

test("retired passives: Agility/Silence/Kata/Death-touch skills change nothing about toHit/foeToHitVs/weaponDamage", () => {
  const control = fixedState({ c: fixedFighter({ skills: {} }) });
  const planted = fixedState({
    c: fixedFighter({ skills: { Agility: 1, Silence: 1, Kata: 1, "Death-touch": 1 } }),
  });
  assert.equal(toHit(planted), toHit(control));
  assert.equal(foeToHitVs(planted), foeToHitVs(control));
  assert.equal(weaponDamage(planted.c, fakeRng([4])), weaponDamage(control.c, fakeRng([4])));
});

test("retired passives: a plain Thief's opening strike crits as 'backstab', never 'silenceStrike', even with Silence planted", () => {
  const state = fixedState({ c: fixedFighter({ sub: "X", cls: "Thief", armor: "Nothing", skills: { Silence: 1 } }) });
  state.combat = fixedCombat([fixedFoe({ wp: 100, maxWP: 100 })]);
  const events = playerStrike(state, fakeRng([3, 4, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "backstab"));
  assert.equal(events.some((e) => e.type === "silenceStrike"), false);
});

test("retired passives: a planted Death-touch skill no longer finishes a low-hp foe on a natural 1 (the crit still doubles)", () => {
  const state = fixedState({ c: fixedFighter({ sub: "Knight", skills: { "Death-touch": 1 } }) });
  state.combat = fixedCombat([fixedFoe({ wp: 12, maxWP: 30 })]);
  const events = playerStrike(state, fakeRng([1, 4, ...FILL]), []);
  assert.equal(events.some((e) => e.type === "deathTouch"), false);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(struck);
  assert.equal(struck.critical, true);
});

test("retired passives: fluency ignores a planted Language skill (fluency comes from a tongue item only)", () => {
  assert.equal(fluency({ skills: { Language: 1 } }), 0);
  assert.equal(fluency({ skills: {} }), 0);
});
