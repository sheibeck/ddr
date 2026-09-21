// test/unit/foe-crit-curve.test.js
//
// Phase 52 (DMG-02): pins the general crit rule — a foe critical doubles the
// DAMAGE DICE, not the whole `lvl^2 + dmgBonus + dice` sum — at all three
// foe-damage sites (foeTurn's hero branch, foeTurn's member branch,
// pursuitStrike), Herman's `sp.strikesAs: 5` fix (replacing the old flat-25
// notation), the shared `foeLevelBase` helper, the zero-draw-shape guarantee
// (a crit draws exactly the same dice as a non-crit hit — only whether the
// drawn value is added once or twice into the sum changes), and the
// weakened/shrunk/hamstrung halving pipeline's order relative to the new
// crit placement.
//
// Helpers (fakeRng/fixedFighter/fixedFloor/fixedState/fixedFoe/fixedCombat/
// fixedAlly/fixedMember) copied verbatim from test/unit/foe-abilities.test.js
// per this plan's <read_first> instruction — the hero's default `sub` is
// "Soldier" (fixedFighter's own default); override `sub: "Knight"` wherever a
// non-Soldier is needed so a roll of 2 does not ALSO crit via the Soldier
// clause.

import test from "node:test";
import assert from "node:assert/strict";

import { foeTurn, flee, foeLevelBase } from "../../engine/combat.js";
import { BESTIARY } from "../../content/index.js";

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

/** countingRng(seq) — fakeRng's twin that ALSO counts every d() draw, so a
 * test can assert an exact draw count (not merely "did not underflow"). */
function countingRng(seq) {
  const inner = fakeRng(seq);
  let draws = 0;
  return {
    d(sides) {
      draws++;
      return inner.d(sides);
    },
    pick: inner.pick,
    shuffle: inner.shuffle,
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

// --- hero branch -------------------------------------------------------

test("DMG-02 (hero branch): a natural 1 doubles the dice, not the level base — tier-5 d6 foe", () => {
  const state = fixedState({ c: { sub: "Knight" } });
  const foe = fixedFoe({ lvl: 5 });
  state.combat = fixedCombat([foe]);
  const rng = countingRng([1, 6]);
  const events = foeTurn(state, rng, []);
  const hit = events.find((e) => e.type === "struckByFoe");
  assert.equal(hit.dmg, 37, "25 + 2*6");
  assert.equal(hit.critical, true);
  assert.equal(rng.draws, 2, "to-hit + one damage die");

  const state2 = fixedState({ c: { sub: "Knight" } });
  const foe2 = fixedFoe({ lvl: 5 });
  state2.combat = fixedCombat([foe2]);
  const rng2 = countingRng([3, 6]);
  const events2 = foeTurn(state2, rng2, []);
  const hit2 = events2.find((e) => e.type === "struckByFoe");
  assert.equal(hit2.dmg, 31, "25 + 6, no crit");
  assert.equal(hit2.critical, false);
  assert.equal(rng2.draws, 2);
});

test("DMG-02 (hero branch): a level-1 foe's crit moves by one — 1 + 2*d6", () => {
  const state = fixedState({ c: { sub: "Knight" } });
  const foe = fixedFoe({ lvl: 1 });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([1, 6]), []);
  const hit = events.find((e) => e.type === "struckByFoe");
  assert.equal(hit.dmg, 13, "1 + 2*6 (was 14 under the old whole-sum rule)");

  // Bat/Rat shape (flat 0d0+1 notation): first swing crits (roll 1 -> 3, was
  // 4); second swing misses. Exactly 2 draws (to-hit x2, zero damage-dice
  // draws since n:0).
  const state2 = fixedState({ c: { sub: "Knight" } });
  const foe2 = fixedFoe({ lvl: 1, sp: { atk: 2, dmg: { n: 0, sides: 0, bonus: 1 } } });
  state2.combat = fixedCombat([foe2]);
  const rng2 = countingRng([1, 20]);
  const events2 = foeTurn(state2, rng2, []);
  const hits2 = events2.filter((e) => e.type === "struckByFoe");
  const misses2 = events2.filter((e) => e.type === "foeMissed");
  assert.equal(hits2.length, 1);
  assert.equal(hits2[0].dmg, 3, "1 + 2*1 (was 4 under the old whole-sum rule)");
  assert.equal(misses2.length, 1);
  assert.equal(rng2.draws, 2);
});

test("DMG-02 (Soldier): a roll of 2 vs a Soldier doubles the dice only; a Knight's 2 is plain", () => {
  const state = fixedState({ c: { sub: "Soldier" } });
  const foe = fixedFoe({ lvl: 1 });
  state.combat = fixedCombat([foe]);
  const events = foeTurn(state, fakeRng([2, 3]), []);
  const hit = events.find((e) => e.type === "struckByFoe");
  assert.equal(hit.dmg, 7, "1 + 2*3");
  assert.equal(hit.soldierCrit, true);

  const state2 = fixedState({ c: { sub: "Knight" } });
  const foe2 = fixedFoe({ lvl: 1 });
  state2.combat = fixedCombat([foe2]);
  const events2 = foeTurn(state2, fakeRng([2, 3]), []);
  const hit2 = events2.find((e) => e.type === "struckByFoe");
  assert.equal(hit2.dmg, 4, "1 + 3, no crit");
  assert.equal(Object.hasOwn(hit2, "soldierCrit"), false);
});

// --- member branch -------------------------------------------------------

test("DMG-02 (member branch): mRoll 1 doubles the dice only", () => {
  const foe = fixedFoe({ lvl: 3 });
  const ally = fixedAlly({ wp: 20, maxWP: 20 });
  const state = fixedState({ party: [fixedMember({ wp: 20 })] });
  state.combat = fixedCombat([foe], { allies: [ally] });
  // pick d(2)=2 -> member; to-hit d(20)=1 (crit) -> dice d6=4.
  const events = foeTurn(state, fakeRng([2, 1, 4]), []);
  const hit = events.find((e) => e.type === "memberStruck");
  assert.equal(hit.dmg, 17, "9 + 2*4");
  assert.equal(hit.critical, true);
});

// --- pursuit strike --------------------------------------------------------

test("DMG-02 (pursuit strike): a pursuer's natural 1 doubles the dice only", () => {
  // A Cloaker's free vanish skips the fleeRolled roll, so the pursuit
  // strike's own draws are the only ones in the sequence.
  const state = fixedState({ c: { cls: "Thief", sub: "Cloaker" } });
  const foe = fixedFoe({ lvl: 2, sp: { pursues: true } });
  state.combat = fixedCombat([foe]);
  const events = flee(state, fakeRng([1, 5]), []);
  const hit = events.find((e) => e.type === "struckByFoe");
  assert.ok(hit, "the pursuit strike must land as a struckByFoe event");
  assert.equal(hit.critical, true);
  assert.equal(hit.dmg, 14, "4 + 2*5");
});

// --- Herman (sp.strikesAs) -------------------------------------------------

test("DMG-02 (Herman): strikesAs 5 — both live Herman rows hit 25 + d6 and crit at most 37", () => {
  const hermanT4 = BESTIARY.Humans[3].find((r) => r.n === "Herman");
  const hermanT5 = BESTIARY.Humans[4].find((r) => r.n === "Herman");
  assert.ok(hermanT4 && hermanT5, "both Herman rows must exist in the live BESTIARY");
  assert.equal(hermanT4.sp.strikesAs, 5);
  assert.equal(hermanT5.sp.strikesAs, 5);
  assert.equal(Object.hasOwn(hermanT4.sp, "dmg"), false);
  assert.equal(Object.hasOwn(hermanT5.sp, "dmg"), false);

  for (const [herman, lvl] of [[hermanT4, 4], [hermanT5, 5]]) {
    const state = fixedState({ c: { sub: "Knight" } });
    const foe = fixedFoe({ name: "Herman", lvl, sp: { ...herman.sp } });
    state.combat = fixedCombat([foe]);
    const rng = countingRng([3, 6]);
    const events = foeTurn(state, rng, []);
    const hit = events.find((e) => e.type === "struckByFoe");
    assert.equal(hit.dmg, 31, `tier ${lvl}: 25 + 6`);
    assert.equal(rng.draws, 2, "the d6 is now a real draw for Herman");

    const state2 = fixedState({ c: { sub: "Knight" } });
    const foe2 = fixedFoe({ name: "Herman", lvl, sp: { ...herman.sp } });
    state2.combat = fixedCombat([foe2]);
    const rng2 = countingRng([1, 6]);
    const events2 = foeTurn(state2, rng2, []);
    const hit2 = events2.find((e) => e.type === "struckByFoe");
    assert.equal(hit2.dmg, 37, `tier ${lvl}: 25 + 2*6 (was 82/100 under the old whole-sum rule)`);
    assert.equal(rng2.draws, 2);
  }
});

// --- draw-shape guarantee --------------------------------------------------

test("DMG-02 draws: a crit hit draws exactly 2 (to-hit + dice), identical to a non-crit hit; a 0d0+1 crit draws 1 (to-hit only)", () => {
  const stateA = fixedState({ c: { sub: "Knight" } });
  const foeA = fixedFoe({ lvl: 1 });
  stateA.combat = fixedCombat([foeA]);
  const rngA = countingRng([1, 6]);
  foeTurn(stateA, rngA, []);
  assert.equal(rngA.draws, 2, "crit: to-hit + dice");

  const stateB = fixedState({ c: { sub: "Knight" } });
  const foeB = fixedFoe({ lvl: 1 });
  stateB.combat = fixedCombat([foeB]);
  const rngB = countingRng([3, 6]);
  foeTurn(stateB, rngB, []);
  assert.equal(rngB.draws, 2, "non-crit: to-hit + dice, identical draw count");

  const stateC = fixedState({ c: { sub: "Knight" } });
  const foeC = fixedFoe({ lvl: 1, sp: { dmg: { n: 0, sides: 0, bonus: 1 } } });
  stateC.combat = fixedCombat([foeC]);
  const rngC = countingRng([1]);
  const eventsC = foeTurn(stateC, rngC, []);
  assert.equal(rngC.draws, 1, "a 0d0+1 crit draws only the to-hit roll");
  assert.ok(eventsC.some((e) => e.type === "struckByFoe" && e.critical === true));
});

// --- pipeline order ----------------------------------------------------------

test("DMG-02 pipeline order: weakened halves AFTER the dice doubling", () => {
  // lvl 1, dice 5: new dmg = ceil((1 + 2*5) / 2) = 6 -- coincidentally the
  // same result the old whole-sum-doubling rule would have given
  // (2 * ceil((1 + 5) / 2) = 6) -- this case alone doesn't distinguish the
  // two orders.
  const stateA = fixedState({ c: { sub: "Knight" } });
  const foeA = fixedFoe({ lvl: 1 });
  stateA.combat = fixedCombat([foeA], { weakened: true });
  const eventsA = foeTurn(stateA, fakeRng([1, 5]), []);
  const hitA = eventsA.find((e) => e.type === "struckByFoe");
  assert.equal(hitA.dmg, 6);

  // lvl 5, dice 4: new dmg = ceil((25 + 2*4) / 2) = 17 -- the old whole-sum
  // rule would have given 2 * ceil((25 + 4) / 2) = 30. This is where the two
  // orders genuinely diverge (the crit's position relative to the halving),
  // proving the new rule's dice-doubling happens BEFORE the weakened halving,
  // not after.
  const stateB = fixedState({ c: { sub: "Knight" } });
  const foeB = fixedFoe({ lvl: 5 });
  stateB.combat = fixedCombat([foeB], { weakened: true });
  const eventsB = foeTurn(stateB, fakeRng([1, 4]), []);
  const hitB = eventsB.find((e) => e.type === "struckByFoe");
  assert.equal(hitB.dmg, 17);
});

// --- foeLevelBase ------------------------------------------------------------

test("foeLevelBase: reads sp.strikesAs when present, else lvl^2", () => {
  assert.equal(foeLevelBase({ lvl: 3 }), 9);
  assert.equal(foeLevelBase({ lvl: 4, sp: { strikesAs: 5 } }), 25);
  assert.equal(foeLevelBase({ lvl: 4, sp: {} }), 16);
});
