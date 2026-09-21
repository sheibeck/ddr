// test/unit/class-mitigation.test.js
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING D) — direct coverage for
// 54-06's economy/class/accuracy/exposed dials: LOOT_SCALE (the four coin
// sites), CLASS_MITIGATION (three rows, never a race/sub-class row),
// FOE_ACCURACY, FLEE_NEED_MOD/PARLEY_NEED_MOD, STARTING_GOLD/
// STARTING_POTION_BONUS. Every helper lives in engine/difficulty.js; this
// file proves the identity fast path AND the wired hook, never a floor-range
// knot. fakeRng/fixedFighter/fixedFloor/fixedState/fixedFoe/fixedCombat are
// local copies (this repo's established per-file-fixture convention — never
// imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import {
  DIALS,
  setDialsForTuning,
  lootFor,
  foeAccuracyFor,
  classEvasionFor,
  classTrapAvoidFor,
  classKillSpeedFor,
  classArmorMulFor,
  spellPowerFor,
  spellDamageFor,
  fleeNeedModFor,
  parleyNeedModFor,
  startingGoldFor,
  startingPotionsFor,
} from "../../engine/difficulty.js";
import { foeToHitVs, foeToHitBreakdown, armorSoak, fleeBreakdown } from "../../engine/derived.js";
import { playerStrike, killFoe } from "../../engine/combat.js";
import { openChest, tableFour, meetFaerie } from "../../engine/encounters.js";
import { castSpell } from "../../engine/magic.js";
import { rollCharacter } from "../../engine/character.js";
import { SPELLS } from "../../content/index.js";

/** fakeRng(seq) — pops the next value off `seq` regardless of requested die
 * size; throws on underflow (a "no more draws expected" assertion). Ports
 * test/unit/combat.test.js's helper verbatim. */
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
    affliction: null, joiner: null,
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

// A generous, proven-safe filler for whatever the foe's own turn draws once
// the hero's action leaves it standing (a value far above any real foe's
// to-hit need reads as a guaranteed miss on the very next draw, regardless
// of which die-size the code requests). Ports test/unit/flee-retune.test.js's
// FILL verbatim.
const FILL = new Array(24).fill(20);
// A second filler for item-roll continuations (rollTreasureItem's table
// lookups index by rng.d(N)-1) — 1 is always a valid 1-based face on any
// table, so this never indexes out of bounds.
const SAFE_FILL = new Array(24).fill(1);

// --- CLASS_MITIGATION shape ------------------------------------------------

test("CLASS_MITIGATION has exactly the three class rows and no race/sub-class key", () => {
  assert.deepStrictEqual(Object.keys(DIALS.CLASS_MITIGATION).sort(), ["Fighter", "Magic User", "Thief"]);
});

// --- identity fast path -----------------------------------------------------

test("at identity every helper returns its input by identity", () => {
  assert.equal(lootFor(123), 123);
  assert.equal(spellDamageFor(17, { cls: "Magic User" }), 17);
  assert.equal(classKillSpeedFor({ cls: "Thief" }, { opener: true }), 1);
  assert.equal(classKillSpeedFor({ cls: "Fighter" }, { opener: false }), 1);
  assert.equal(classArmorMulFor({ cls: "Fighter" }), 1);
  assert.equal(classEvasionFor({ cls: "Thief" }), 0);
  assert.equal(classTrapAvoidFor({ cls: "Thief" }), 0);
  assert.equal(foeAccuracyFor(), 0);
  assert.equal(fleeNeedModFor(), 0);
  assert.equal(parleyNeedModFor(), 0);
  assert.equal(startingGoldFor(), 50);
  assert.equal(startingPotionsFor(3), 3);
  assert.equal(spellPowerFor({ cls: "Magic User" }), 1);
});

// --- FOE_ACCURACY / Thief evasion ------------------------------------------

test("Thief evasion -1 lowers foeToHitVs by 1 for vs hero only (member unchanged); the breakdown records { name: 'evasion', delta: -1 }", () => {
  const state = fixedState({ c: { cls: "Thief", sub: "Pilfer" } });
  const identityHero = foeToHitVs(state, "hero");
  const identityMember = foeToHitVs(state, "member");

  const restore3 = setDialsForTuning({ CLASS_MITIGATION: { Thief: { ...DIALS.CLASS_MITIGATION.Thief, evasion: -1 } } });
  try {
    assert.equal(foeToHitVs(state, "hero"), identityHero - 1, "vs hero drops by exactly 1");
    assert.equal(foeToHitVs(state, "member"), identityMember, "vs member is untouched");
    const { need, mods } = foeToHitBreakdown(state, "hero");
    assert.equal(need, identityHero - 1);
    assert.ok(mods.some((m) => m.name === "evasion" && m.delta === -1), "the breakdown records the evasion delta");
    const memberBreakdown = foeToHitBreakdown(state, "member");
    assert.ok(!memberBreakdown.mods.some((m) => m.name === "evasion"), "member breakdown carries no evasion entry");
  } finally {
    restore3();
  }

  // A non-Thief never reads CLASS_MITIGATION.Thief.evasion at all.
  const fighter = fixedState({ c: { cls: "Fighter", sub: "Soldier" } });
  const fighterIdentity = foeToHitVs(fighter, "hero");
  const restore4 = setDialsForTuning({ CLASS_MITIGATION: { Thief: { ...DIALS.CLASS_MITIGATION.Thief, evasion: -1 } } });
  try {
    assert.equal(foeToHitVs(fighter, "hero"), fighterIdentity, "a Fighter is unaffected by the Thief evasion dial");
  } finally {
    restore4();
  }
});

test("FOE_ACCURACY +2 raises the need by 2 for hero and member; the Math.max(1, h) clamp holds at -3", () => {
  const state = fixedState({ c: { cls: "Fighter", sub: "Soldier" } });
  const identityHero = foeToHitVs(state, "hero");
  const identityMember = foeToHitVs(state, "member");

  const restorePlus = setDialsForTuning({ FOE_ACCURACY: 2 });
  try {
    assert.equal(foeToHitVs(state, "hero"), identityHero + 2);
    assert.equal(foeToHitVs(state, "member"), identityMember + 2);
    const { mods } = foeToHitBreakdown(state, "hero");
    assert.ok(mods.some((m) => m.name === "accuracy" && m.delta === 2));
  } finally {
    restorePlus();
  }

  // Acrobat: h = 3 before the accuracy term; -3 accuracy would floor at 1
  // via Math.max(1, h), never go negative.
  const acrobat = fixedState({ c: { cls: "Fighter", sub: "Acrobat" } });
  const restoreMinus = setDialsForTuning({ FOE_ACCURACY: -3 });
  try {
    assert.equal(foeToHitVs(acrobat, "hero"), 1, "the floor clamp holds even at a large negative accuracy");
  } finally {
    restoreMinus();
  }
});

// --- CLASS_MITIGATION.killSpeed ---------------------------------------------

test("Thief killSpeed 1.25 scales the backstab opener only (a second-round strike unchanged); Fighter killSpeed 0.9 scales every Fighter melee strike; MU untouched", () => {
  // Thief opener (backstab): strike d20=3 vs Thief need=4 -> hit; club d6=4
  // -> base dmg = level^2(1)+4 = 5, doubled by the backstab crit to 10.
  const thiefOpener = () => {
    const state = fixedState({ c: { cls: "Thief", sub: "Pilfer" } });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
    const rng = fakeRng([3, 4, ...FILL]);
    const events = playerStrike(state, rng, []);
    return events.find((e) => e.type === "struck").dmg;
  };
  const identityOpenerDmg = thiefOpener();
  assert.equal(identityOpenerDmg, 10);
  const restoreThief = setDialsForTuning({ CLASS_MITIGATION: { Thief: { ...DIALS.CLASS_MITIGATION.Thief, killSpeed: 1.25 } } });
  try {
    assert.equal(thiefOpener(), Math.max(1, Math.round(10 * 1.25)), "the opener scales by killSpeed");
  } finally {
    restoreThief();
  }

  // Thief second-round strike (opened2 already true -> not an opener):
  // strike d20=3 vs need=4 -> hit; club d6=4 -> dmg 5, no crit.
  const thiefSecondRound = () => {
    const state = fixedState({ c: { cls: "Thief", sub: "Pilfer" } });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { opened2: true });
    const rng = fakeRng([3, 4, ...FILL]);
    const events = playerStrike(state, rng, []);
    return events.find((e) => e.type === "struck").dmg;
  };
  const identitySecondDmg = thiefSecondRound();
  const restoreThief2 = setDialsForTuning({ CLASS_MITIGATION: { Thief: { ...DIALS.CLASS_MITIGATION.Thief, killSpeed: 1.25 } } });
  try {
    assert.equal(thiefSecondRound(), identitySecondDmg, "a non-opener Thief strike is unaffected by killSpeed");
  } finally {
    restoreThief2();
  }

  // Fighter melee strike (any round): strike d20=3 vs need=? (Soldier no
  // crit anyway) -> hit; club d6=4 -> dmg = 1+4=5.
  const fighterStrike = () => {
    const state = fixedState({ c: { cls: "Fighter", sub: "Soldier" } });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { opened2: true });
    const rng = fakeRng([3, 4, ...FILL]);
    const events = playerStrike(state, rng, []);
    return events.find((e) => e.type === "struck").dmg;
  };
  const identityFighterDmg = fighterStrike();
  const restoreFighter = setDialsForTuning({ CLASS_MITIGATION: { Fighter: { ...DIALS.CLASS_MITIGATION.Fighter, killSpeed: 0.9 } } });
  try {
    assert.equal(fighterStrike(), Math.max(1, Math.round(identityFighterDmg * 0.9)), "every Fighter melee strike scales by killSpeed");
  } finally {
    restoreFighter();
  }

  // A Magic User's own weapon strike (rare, but the helper must still no-op).
  const muStrike = () => {
    const state = fixedState({ c: { cls: "Magic User", sub: "Wizard" } });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { opened2: true });
    const rng = fakeRng([3, 4, ...FILL]);
    const events = playerStrike(state, rng, []);
    return events.find((e) => e.type === "struck").dmg;
  };
  const identityMuDmg = muStrike();
  const restoreMu = setDialsForTuning({
    CLASS_MITIGATION: {
      Fighter: { ...DIALS.CLASS_MITIGATION.Fighter, killSpeed: 0.9 },
      Thief: { ...DIALS.CLASS_MITIGATION.Thief, killSpeed: 1.25 },
    },
  });
  try {
    assert.equal(muStrike(), identityMuDmg, "an MU's melee strike reads neither the Fighter nor the Thief row");
  } finally {
    restoreMu();
  }
});

// --- CLASS_MITIGATION.spellPower --------------------------------------------

test("spellPower 1.15 scales a Fireball's rolled damage and never Heal", () => {
  const fireballIdx = SPELLS.findIndex((s) => s.n === "Fireball");
  const healIdx = SPELLS.findIndex((s) => s.n === "Heal");
  assert.ok(fireballIdx >= 0 && healIdx >= 0, "fixture assumption: Fireball and Heal exist in SPELLS");

  const castFireball = () => {
    const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 5, grimoire: [SPELLS[fireballIdx].n] } });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999, intel: 1 })]);
    // to-hit roll (need 4, no bonus -> roll 1 hits), damage dice draws follow.
    const rng = fakeRng([1, 6, 6, ...FILL]);
    const events = castSpell(state, fireballIdx, rng, []);
    return events.find((e) => e.type === "spellHit").dmg;
  };
  const identityDmg = castFireball();
  const restore = setDialsForTuning({ CLASS_MITIGATION: { "Magic User": { spellPower: 1.15 } } });
  try {
    assert.equal(castFireball(), Math.max(0, Math.round(identityDmg * 1.15)), "Fireball's applied damage scales by spellPower");
  } finally {
    restore();
  }

  const castHeal = () => {
    const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 5, wp: 10, maxWP: 55, grimoire: [SPELLS[healIdx].n] } });
    const rng = fakeRng([6]);
    const events = castSpell(state, healIdx, rng, []);
    return state.c.wp;
  };
  const identityHealWp = castHeal();
  const restoreHeal = setDialsForTuning({ CLASS_MITIGATION: { "Magic User": { spellPower: 1.15 } } });
  try {
    assert.equal(castHeal(), identityHealWp, "Heal is never scaled by spellPower");
  } finally {
    restoreHeal();
  }
});

// --- CLASS_MITIGATION.armorMul ----------------------------------------------

test("armorMul 1.2 scales the Fighter's ar read in armorSoak", () => {
  const fighter = fixedFighter({ cls: "Fighter", ar: 10, armorWP: 20, armorMax: 20, armorMin: 0 });
  const identity = armorSoak(fighter);
  assert.equal(identity.ar, 10);
  const restore = setDialsForTuning({ CLASS_MITIGATION: { Fighter: { ...DIALS.CLASS_MITIGATION.Fighter, armorMul: 1.2 } } });
  try {
    const scaled = armorSoak(fighter);
    assert.equal(scaled.ar, Math.round(10 * 1.2));
    assert.equal(scaled.wp, identity.wp, "the durability pool is untouched by armorMul");
  } finally {
    restore();
  }

  const thief = fixedFighter({ cls: "Thief", ar: 10, armorWP: 20, armorMax: 20, armorMin: 0 });
  const restoreThief = setDialsForTuning({ CLASS_MITIGATION: { Fighter: { ...DIALS.CLASS_MITIGATION.Fighter, armorMul: 1.2 } } });
  try {
    assert.equal(armorSoak(thief).ar, 10, "a non-Fighter never reads armorMul");
  } finally {
    restoreThief();
  }
});

// --- LOOT_SCALE --------------------------------------------------------------

test("LOOT_SCALE 0.8 scales the kill purse / chest / cache / faerie post-draw with the same draw count", () => {
  // Kill purse: foe type "Humans" (purse 12), lvl 2. coin = round(d10 * 2 *
  // 12 / 10). d10=5 -> round(5*2*12/10) = 12.
  const killPurse = () => {
    const state = fixedState({ c: { cls: "Fighter", sub: "Soldier" } });
    const foe = fixedFoe({ type: "Humans", lvl: 2, wp: 0 });
    const before = state.c.gold;
    const rng = fakeRng([5, 4, 5, 20, 1]); // sp d6, coin d10, treasure-gate d20, cooking (n/a for Humans)
    killFoe(state, foe, rng, []);
    return state.c.gold - before;
  };
  const identityKillGold = killPurse();
  const restoreKill = setDialsForTuning({ LOOT_SCALE: 0.8 });
  try {
    assert.equal(killPurse(), Math.round(identityKillGold * 0.8));
  } finally {
    restoreKill();
  }

  // Chest: Pilfer opens for free (no lock roll); coin = round(((d10+6)*100*
  // depth)/10).
  const chestGold = () => {
    const state = fixedState({ c: { cls: "Thief", sub: "Pilfer" } });
    const before = state.c.gold;
    const rng = fakeRng([5, 5, ...SAFE_FILL]); // coin d10, scroll d6, then rollTreasureItem's own draws
    openChest(state, rng, []);
    return state.c.gold - before;
  };
  const identityChestGold = chestGold();
  const restoreChest = setDialsForTuning({ LOOT_SCALE: 0.8 });
  try {
    assert.equal(chestGold(), Math.round(identityChestGold * 0.8));
  } finally {
    restoreChest();
  }

  // Wilmst cache (table-four): flat WILMST_CACHE_PER_DEPTH * depth, no draw.
  const cacheGold = () => {
    const state = fixedState({ c: { cls: "Fighter", sub: "Soldier" } });
    const before = state.c.gold;
    tableFour(state, "wilmst cache", fakeRng([]), []);
    return state.c.gold - before;
  };
  const identityCacheGold = cacheGold();
  const restoreCache = setDialsForTuning({ LOOT_SCALE: 0.8 });
  try {
    assert.equal(cacheGold(), Math.round(identityCacheGold * 0.8));
  } finally {
    restoreCache();
  }

  // Faerie: "d10 x 100 wilmst" gift (roll 8 -> FAERIE[7]).
  const faerieGold = () => {
    const state = fixedState({ c: { cls: "Fighter", sub: "Soldier" } });
    const before = state.c.gold;
    const rng = fakeRng([8, 7, ...FILL]); // gift roll, then the d10 coin roll
    meetFaerie(state, rng, []);
    return state.c.gold - before;
  };
  const identityFaerieGold = faerieGold();
  const restoreFaerie = setDialsForTuning({ LOOT_SCALE: 0.8 });
  try {
    assert.equal(faerieGold(), Math.round(identityFaerieGold * 0.8));
  } finally {
    restoreFaerie();
  }
});

// --- STARTING_GOLD / STARTING_POTION_BONUS ----------------------------------

test("STARTING_GOLD 75 / STARTING_POTION_BONUS 1 at chargen", () => {
  const seed = 12345;
  const identity = rollCharacter(makeRng(seed));
  const restore = setDialsForTuning({ STARTING_GOLD: 75, STARTING_POTION_BONUS: 1 });
  try {
    const scaled = rollCharacter(makeRng(seed));
    assert.equal(scaled.gold, 75);
    assert.equal(scaled.potions, identity.potions + 1);
  } finally {
    restore();
  }
});
