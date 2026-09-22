// Task 2 — the encounter/trap/chest domain (ENG-01, ENG-05): springTrap,
// openChest, encounterDot and their helper tables (tableFour, findFood,
// findGrimoire, findGear, findMisc, meetFaerie, meetJoiner, catchAffliction,
// goInsane, newPhobia, fallDark) are pure, RNG-injected, and event-emitting.
//
// Uses a fakeRng whose `.d()` pops the next value off a supplied sequence
// (matching test/unit/movement.test.js's convention), so each test documents
// exactly which die rolls the ported prototype code consumes, in order.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  springTrap,
  openChest,
  encounterDot,
  tableFour,
  findFood,
  findGrimoire,
  findGear,
  findMisc,
  meetFaerie,
  meetJoiner,
  catchAffliction,
  goInsane,
  newPhobia,
  fallDark,
} from "../../engine/encounters.js";
import { GW, GH } from "../../engine/maze.js";
import { difficultyCurve, scaleHazard, dotHpFor, heroSpFor, setDialsForTuning } from "../../engine/difficulty.js";
import { makeRng } from "../../engine/rng.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** fakeRng(seq) — `.d()`/`.pick()` pop the next value off `seq` (ignoring the
 * requested side count / array); `.shuffle()` is a no-op by default. Throws
 * if the sequence underflows, doubling as a "no more draws expected"
 * assertion — mirrors test/unit/movement.test.js's helper. */
function fakeRng(seq, { pick } = {}) {
  let i = 0;
  const next = () => {
    if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
    return seq[i++];
  };
  return {
    d: (_sides) => next(),
    pick: pick || ((arr) => arr[0]),
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 40, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    ...overrides,
  };
}

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = wallGrid();
  g[5][5] = { wall: false, seen: true, feat: null };
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g, px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

// --- springTrap -------------------------------------------------------

test("springTrap: a dodge roll at or under `nimble` avoids the trap (no further rolls)", () => {
  const state = fixedState();
  const events = springTrap(state, fakeRng([5]), []); // nimble=5 for a plain Soldier
  assert.equal(state.c.wp, 40, "untouched");
  assert.ok(events.some((e) => e.type === "trapAvoided"));
});

test("springTrap: a Pilfer always disarms a trap the dodge roll missed", () => {
  const state = fixedState({ c: { sub: "Pilfer" } });
  const events = springTrap(state, fakeRng([20]), []); // dodge fails (20 > nimble 5)
  assert.equal(state.c.wp, 40);
  assert.ok(events.some((e) => e.type === "trapDisarmed" && e.reason === "pilfer"));
});

test("springTrap: a sprung trap deals dice-notation damage and can kill via die('trap')", () => {
  const state = fixedState({ c: { wp: 2 } });
  // dodge=20 (misses nimble=5); trap table roll=2 -> Falling Rocks (d20); d20 dmg roll=20.
  const events = springTrap(state, fakeRng([20, 2, 20]), []);
  assert.equal(state.c.wp, 0);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "trapSprung" && e.dmg === 20));
  assert.ok(events.some((e) => e.type === "died"));
});

test("springTrap: a poisoned arrow (table row 1) sets a plain-data affliction", () => {
  const state = fixedState();
  // dodge=20 (miss); table roll=1 -> Poison Arrow (d8); damage d8 roll=1.
  const events = springTrap(state, fakeRng([20, 1, 1]), []);
  assert.equal(state.c.wp, 39);
  assert.deepStrictEqual(state.c.affliction, { kind: "Poison", loss: { n: 2, sides: 6, bonus: 0 }, per: 1, left: 10 });
  assert.ok(events.some((e) => e.type === "trapPoisoned"));
});

test("springTrap: a Spike trap's `times` multiplier is applied after the roll", () => {
  const state = fixedState();
  // dodge=20 (miss); table roll=8 -> Spike (d10, times 5); damage d10 roll=3 -> 15.
  const events = springTrap(state, fakeRng([20, 8, 3]), []);
  assert.equal(state.c.wp, 25, "15 damage (3 * 5 times multiplier)");
  assert.ok(events.some((e) => e.type === "trapSprung" && e.dmg === 15));
});

// USER RULING D: HAZARD_SCALE is now a single global dial, identity
// (`{ base: 1, perDepth: 0 }`) at every depth — floor 1 is no longer a
// special case. Depth 1 and depth 5 (identity 1) leave the canon Spike
// damage unchanged; a synthetic override proves scaleHazard is still wired
// through the live curve.
test("springTrap: hazardScale is identity (1) at every depth by default — the canon Spike damage is unchanged at depths 1, 2 and 5", () => {
  for (const depth of [1, 2, 5]) {
    const state = fixedState({ floor: { depth } });
    const events = springTrap(state, fakeRng([20, 8, 3]), []);
    assert.equal(state.c.wp, 40 - 15, `depth ${depth}: identity hazardScale leaves the canon 15 damage unchanged`);
    assert.ok(events.some((e) => e.type === "trapSprung" && e.dmg === 15));
  }
});

test("springTrap: a synthetic HAZARD_SCALE override scales the Spike damage through the live curve (restored after)", () => {
  const restore = setDialsForTuning({ HAZARD_SCALE: { base: 0.5, perDepth: 0 } });
  try {
    const state = fixedState({ floor: { depth: 5 } });
    const events = springTrap(state, fakeRng([20, 8, 3]), []);
    const expectedDmg = scaleHazard(15, difficultyCurve(5));
    assert.equal(expectedDmg, 8, "round(15 * 0.5) = 8 (measured via scaleHazard itself)");
    assert.equal(state.c.wp, 40 - expectedDmg);
    assert.ok(events.some((e) => e.type === "trapSprung" && e.dmg === expectedDmg));
  } finally {
    restore();
  }
});

// --- openChest ----------------------------------------------------------

test("openChest: a Pilfer always opens the box for free", () => {
  const state = fixedState({ c: { sub: "Pilfer", scrolls: 0 } });
  // gold roll d10=4 -> (4+6)*100*1/10=100; scroll roll d6=6 (>=3, scroll gained);
  // rollTreasureItem: hasPicks=false, d12=5 (not lockpicks); d10=10 -> rollStaff d8=1.
  const events = openChest(state, fakeRng([4, 6, 5, 10, 1]), []);
  assert.ok(events.some((e) => e.type === "chestOpened" && e.reason === "pilfer"));
  assert.equal(state.c.gold, 150, "50 starting + 100 chest gold");
  assert.equal(state.c.scrolls, 1);
  // ECON-03 (Phase 13): the rolled treasure is now OFFERED (state.pendingFind +
  // a findOffered event), not auto-taken. The treasure roll STILL ran (same rng
  // order — findOffered proves it landed a staff), it just waits on the player's
  // takeFind/leaveFind choice instead of auto-equipping. rollTreasureItem here
  // rolls a staff (d10=10 -> rollStaff); openChest does not gate on class —
  // that is equipItem's job now.
  assert.ok(events.some((e) => e.type === "findOffered"), "the treasure roll ran and was offered");
  assert.ok(state.pendingFind && state.pendingFind.kind === "staff", "the rolled staff is stashed as the pending find");
});

test("openChest: with no lock skill, a bare d20 roll over 8 leaves it locked (no further rolls)", () => {
  const state = fixedState();
  const events = openChest(state, fakeRng([9]), []);
  assert.equal(state.c.gold, 50, "untouched");
  assert.ok(events.some((e) => e.type === "chestLockRolled" && e.opened === false));
  assert.ok(events.some((e) => e.type === "chestLocked"));
});

test("openChest: with no lock skill, a bare d20 roll of 8 or under opens it", () => {
  const state = fixedState();
  // lock roll d20=8 -> opened; gold d10=1 -> (1+6)*100*1/10=70; scroll d6=2 (<3, none);
  // rollTreasureItem: d12=7, d10=8 -> rollCloak d8=1.
  const events = openChest(state, fakeRng([8, 1, 2, 7, 8, 1]), []);
  assert.equal(state.c.gold, 120, "50 starting + 70 chest gold");
  assert.equal(state.c.scrolls, 0);
  assert.ok(events.some((e) => e.type === "chestOpened"));
});

test("openChest: RULE-01 — a higher-Intelligence character opens a borderline lock that an identical lower-Intelligence character does not, given the same rng", () => {
  // Bare d20 path (no Locks skill/lockpicks): need = 8 + intelBonus(c).
  // intelBonus(5) floors to 0 (below the intel-15 threshold) -> need stays 8;
  // a roll of 9 (9 > 8) fails, matching the pre-RULE-01 baseline exactly.
  const lowIntel = fixedState({ c: { intel: 5 } });
  const lowEvents = openChest(lowIntel, fakeRng([9]), []);
  assert.ok(
    lowEvents.some((e) => e.type === "chestLockRolled" && e.need === 8 && e.roll === 9 && e.opened === false),
    "low intel: need stays 8, the same borderline roll of 9 still fails"
  );
  assert.ok(lowEvents.some((e) => e.type === "chestLocked"));
  assert.equal(lowIntel.c.gold, 50, "untouched — the chest never opened");

  // intelBonus(20) = 2 (capped) -> need rises to 10; the SAME roll of 9 (9 <=
  // 10) now succeeds. Everything after the lock roll (gainWilmst d10=1,
  // scroll d6=2 <3 none, rollTreasureItem d12=7/d10=8 -> rollCloak d8=1)
  // consumes rng in the exact same order as the identical bare-d20-opens
  // fixture above, proving the intel bonus changed only the threshold.
  const highIntel = fixedState({ c: { intel: 20 } });
  const highEvents = openChest(highIntel, fakeRng([9, 1, 2, 7, 8, 1]), []);
  assert.ok(
    highEvents.some((e) => e.type === "chestLockRolled" && e.need === 10 && e.roll === 9 && e.opened === true),
    "high intel: need rises to 10, the identical roll of 9 now succeeds"
  );
  assert.ok(highEvents.some((e) => e.type === "chestOpened"));
  assert.equal(highIntel.c.gold, 120, "50 starting + 70 chest gold — the chest opened and paid out");
});

// --- encounterDot ---------------------------------------------------------

test("encounterDot: a monster-type result (via ENC_ALIAS) starts combat", () => {
  // A real seeded rng drives startCombat's own (variable-length) roll
  // sequence rather than a hand-crafted fakeRng array — search a small seed
  // range for one that happens to roll a monster-type encounter.
  const MONSTER_RESULTS = ["Lair Beast", "Beasts", "Demons", "Humans", "Magical", "Walking Dead"];
  let found = false;
  for (let seed = 1; seed <= 200 && !found; seed++) {
    const state = fixedState();
    const events = encounterDot(state, makeRng(seed), []);
    const rolled = events.find((e) => e.type === "encounterRolled");
    if (rolled && MONSTER_RESULTS.includes(rolled.result)) {
      found = true;
      assert.ok(events.some((e) => e.type === "encounterStarted"), "startCombat ran");
      assert.ok(state.combat || state.dead, "the encounter left combat active (or resolved to a kill/death)");
    }
  }
  assert.ok(found, "at least one seed in range must roll a monster-type encounter");
});

test("encounterDot: a plain Table Four row (e.g. '+10 HP') applies directly, no extra rolls", () => {
  const state = fixedState({ c: { wp: 40, maxWP: 55 } });
  // d8=4, d10=1 -> ENCOUNTER_TABLES[3][0] === "+10 HP" (04.2 E3: was "+10 WP").
  const events = encounterDot(state, fakeRng([4, 1]), []);
  // Phase 54 (BAND-02, USER RULING D, amended USER RULING G cycle 3): the
  // flat "+10 HP" dot is dotHpFor("small") — DOT_HP_BASE's canon flat value
  // scaled ONCE by HERO_HP_SCALE (identity here), never a fraction of the
  // hero's own (mutable) maxWP.
  const expectedHeal = dotHpFor("small");
  assert.equal(state.c.wp, 40 + expectedHeal);
  assert.ok(events.some((e) => e.type === "encounterRolled" && e.result === "+10 HP"));
  // The tableFour beat now carries a prose sentence, not the raw cell string.
  assert.ok(events.some((e) => e.type === "tableFour" && new RegExp(`${expectedHeal} hp`).test(e.result)));
});

test("encounterDot: 'Store' opens the shop with plain-data stock", () => {
  const state = fixedState();
  // d8=2, d10=7 -> ENCOUNTER_TABLES[1][6] === "Store".
  const events = encounterDot(state, fakeRng([2, 7, 5, 1]), []);
  assert.ok(events.some((e) => e.type === "encounterRolled" && e.result === "Store"));
  assert.ok(state.store, "a store was opened");
});

// --- tableFour ------------------------------------------------------------

test("tableFour: '-All armour' strips every armor field", () => {
  const state = fixedState({ c: { armor: "Plate", ar: 15, armorWP: 40, armorMax: 45 } });
  tableFour(state, "-All armour", fakeRng([]), []);
  assert.equal(state.c.armor, "Nothing");
  assert.equal(state.c.ar, 0);
  assert.equal(state.c.armorWP, 0);
  assert.equal(state.c.armorMax, 0);
});

test("tableFour: a lethal '-15 HP' row kills via die('maze')", () => {
  const state = fixedState({ c: { wp: 10 } });
  // 04.2 E3: the dual-purpose switch key was "-15 WP", now "-15 HP".
  const events = tableFour(state, "-15 HP", fakeRng([]), []);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died" && e.cause === "maze"));
});

// DELIBERATE RULES CHANGE (Phase 54, BAND-02, 2026-09-21, USER RULING D,
// amended USER RULING G cycle 3): every flat Table-4 ±HP dot is now
// DOT_HP_BASE's canon flat value (10/15/25) scaled ONCE by HERO_HP_SCALE —
// identity here (1), so the dots are exactly canon — and the XP dots ride
// HERO_SP_SCALE like a kill. The +25 HP row no longer compounds: it reads
// the SAME flat 25 (scaled by HERO_HP_SCALE) regardless of the hero's own
// current maxWP, so three pulls in a row grow maxWP by exactly 75, never a
// geometric ×4.
test("tableFour ±HP dots are DOT_HP_BASE canon flats scaled by HERO_HP_SCALE (identity: +10/-10/-15/+25 -> 10/10/15/25; no compounding across repeat pulls)", () => {
  assert.equal(dotHpFor("small"), 10);
  assert.equal(dotHpFor("mid"), 15);
  assert.equal(dotHpFor("large"), 25);

  const plus10 = fixedState({ c: { wp: 20, maxWP: 40 } });
  tableFour(plus10, "+10 HP", fakeRng([]), []);
  assert.equal(plus10.c.wp, 30, "20 + dotHpFor(small)=10");

  const minus10 = fixedState({ c: { wp: 20, maxWP: 40 } });
  tableFour(minus10, "-10 HP", fakeRng([]), []);
  assert.equal(minus10.c.wp, 10, "20 - dotHpFor(small)=10");

  const minus15 = fixedState({ c: { wp: 30, maxWP: 40 } });
  tableFour(minus15, "-15 HP", fakeRng([]), []);
  assert.equal(minus15.c.wp, 15, "30 - dotHpFor(mid)=15");

  const plus25 = fixedState({ c: { wp: 30, maxWP: 40 } });
  tableFour(plus25, "+25 HP", fakeRng([]), []);
  assert.equal(plus25.c.maxWP, 65, "40 + dotHpFor(large)=25");
  assert.equal(plus25.c.wp, 55, "30 + dotHpFor(large)=25");

  // No compounding: three "+25 HP" pulls in a row grow maxWP by exactly
  // 3*25=75 (canon flat, identity HERO_HP_SCALE), never a geometric blowup.
  const thrice = fixedState({ c: { wp: 40, maxWP: 40 } });
  tableFour(thrice, "+25 HP", fakeRng([]), []);
  tableFour(thrice, "+25 HP", fakeRng([]), []);
  tableFour(thrice, "+25 HP", fakeRng([]), []);
  assert.equal(thrice.c.maxWP, 40 + 3 * 25, "three pulls add exactly 3x the flat dot, no feedback");
});

test("tableFour: +10 XP / +25 XP ride heroSpFor (identity: no-op)", () => {
  const state10 = fixedState({ c: { sp: 0 } });
  tableFour(state10, "+10 XP", fakeRng([]), []);
  assert.equal(state10.c.sp, heroSpFor(10));

  const state25 = fixedState({ c: { sp: 0 } });
  tableFour(state25, "+25 XP", fakeRng([]), []);
  assert.equal(state25.c.sp, heroSpFor(25));
});

test("tableFour: the 'wilmst cache' row pays a depth-scaled amount via goldGained, NO redundant beat, NO new rng (E10/ECON-09)", () => {
  // Depth 1 → 300 * 1. The empty fakeRng sequence is itself the no-new-rng
  // assertion: fakeRng throws on ANY .d()/.pick() draw, so the row's gold path
  // must stay flat/derived (a Pickpocket would draw, but a Soldier does not).
  const d1 = fixedState({ c: { gold: 0 }, floor: { depth: 1 } });
  const e1 = tableFour(d1, "wilmst cache", fakeRng([]), []);
  assert.equal(d1.c.gold, 300, "depth 1 → 300 wilmst");
  assert.ok(e1.some((e) => e.type === "goldGained" && e.amount === 300), "goldGained narrates the depth-1 amount");
  assert.ok(!e1.some((e) => e.type === "tableFour"), "no redundant raw-jargon tableFour beat");

  // Depth 7 → 300 * 7 = 2100, confirming the flat linear depth scaling.
  const d7 = fixedState({ c: { gold: 0 }, floor: { depth: 7 } });
  const e7 = tableFour(d7, "wilmst cache", fakeRng([]), []);
  assert.equal(d7.c.gold, 2100, "depth 7 → 2100 wilmst");
  assert.ok(e7.some((e) => e.type === "goldGained" && e.amount === 2100), "goldGained narrates the depth-7 amount");
});

// --- findFood / findGrimoire / findGear / findMisc -------------------------

test("findFood: heals toward the cap and leaves c.rations UNCHANGED (RATION-01)", () => {
  const state = fixedState({ c: { wp: 40, maxWP: 55, rations: 2 } });
  const events = findFood(state, fakeRng([1]), []); // FOODS[0] === Chicken (+12 wp)
  assert.equal(state.c.wp, 52);
  assert.equal(state.c.rations, 2, "findFood must not silently change rations");
  assert.ok(events.some((e) => e.type === "foodFound"));
});

test("findGrimoire: a non-Magic-User sells the book for gold instead of learning", () => {
  const state = fixedState({ c: { cls: "Fighter", gold: 50 } });
  const events = findGrimoire(state, fakeRng([]), []);
  assert.equal(state.c.gold, 200);
  assert.ok(events.some((e) => e.type === "grimoireSold"));
});

test("findGear: 'weapon' OFFERS a mundane blade via rollBlade/offerFind (ECON-03)", () => {
  const state = fixedState({ c: { cls: "Fighter", weapon: "Club", prof: 0, magicWpn: 0 } });
  const events = findGear(state, "weapon", fakeRng([1, 1]), []);
  // ECON-03 (Phase 13): the rolled blade is offered, not auto-equipped.
  assert.ok(events.some((e) => e.type === "findOffered" && e.kind === "weapon"));
  assert.ok(state.pendingFind && state.pendingFind.kind === "weapon", "the rolled blade is the pending find");
});

test("findMisc: a Scroll result increments scrolls", () => {
  const state = fixedState({ c: { scrolls: 0 } });
  // d10=3 -> MISC_MAGIC[2] === "Scroll"
  const events = findMisc(state, fakeRng([3]), []);
  assert.equal(state.c.scrolls, 1);
  assert.ok(events.some((e) => e.type === "scrollFound"));
});

// --- meetFaerie / meetJoiner ------------------------------------------------

test("meetFaerie: '+d20 Base HP' raises the WP cap", () => {
  const state = fixedState({ c: { maxWP: 55, wp: 40 } });
  // d8=2 -> FAERIE[1] === "+d20 Base HP" (04.2 E3: was "+d20 Base WP"); boon roll d20=10.
  const events = meetFaerie(state, fakeRng([2, 10]), []);
  assert.equal(state.c.maxWP, 65);
  assert.equal(state.c.wp, 50);
  assert.ok(events.some((e) => e.type === "faerieBoon" && e.amount === 10));
});

test("meetJoiner: rolls a full character and sets state.c.joiner, consuming BOTH wp draws (fidelity)", () => {
  const state = fixedState();
  // rollCharacter consumes a long, real dice sequence (class/sub/race/skills/
  // grimoire/name/etc.) — rather than hand-count every draw with a fakeRng,
  // drive it with a REAL seeded rng so the sequence never underflows, and
  // just assert the resulting shape/consumption-order contract.
  const events = meetJoiner(state, makeRng(555), []);
  assert.ok(state.c.joiner, "a joiner was set");
  assert.equal(state.c.joiner.maxWP, state.c.joiner.wp, "maxWP mirrors wp (the discarded second roll)");
  assert.ok(events.some((e) => e.type === "joinerMet"));
});

// --- catchAffliction / goInsane / newPhobia / fallDark ----------------------

test("catchAffliction: a permanent-phobia row (AFFLICTIONS row 5) sets a phobia, not a wp-loss affliction", () => {
  const state = fixedState();
  // d8=5 -> AFFLICTIONS[4] has phobia:true; phobia pick d10=3.
  const events = catchAffliction(state, fakeRng([5, 3]), []);
  assert.ok(state.c.phobia, "a phobia was set");
  assert.equal(state.c.affliction, null);
  assert.ok(events.some((e) => e.type === "phobiaAcquired"));
});

test("catchAffliction: a periodic affliction ticks an immediate first loss", () => {
  const state = fixedState({ c: { wp: 40 } });
  // d8=1 -> AFFLICTIONS[0] (Poison, loss 2d6, per 1); left d20=10; first-tick 2d6=(3,4)=7.
  const events = catchAffliction(state, fakeRng([1, 10, 3, 4]), []);
  assert.equal(state.c.affliction.kind, "Poison");
  assert.equal(state.c.affliction.left, 10);
  assert.equal(state.c.wp, 33);
  assert.ok(events.some((e) => e.type === "afflictionCaught" && e.first === 7));
});

test("goInsane: roll 1 halves wp (rounded up) via self-harm", () => {
  const state = fixedState({ c: { wp: 41 } });
  const events = goInsane(state, fakeRng([1]), []);
  assert.equal(state.c.wp, 21);
  assert.ok(events.some((e) => e.type === "insanitySelfHarm"));
});

test("goInsane: roll 3 teleports (delegates into the movement domain)", () => {
  const state = fixedState();
  // insanity roll=3; teleport (non-Illusionist): dir a=d8, dir b=d8, dist=d20.
  const events = goInsane(state, fakeRng([3, 1, 1, 1]), []);
  assert.ok(events.some((e) => e.type === "teleported"));
});

test("newPhobia: sets a fresh phobia from PHOBIAS", () => {
  const state = fixedState();
  const events = newPhobia(state, fakeRng([2]), []);
  assert.ok(state.c.phobia);
  assert.ok(events.some((e) => e.type === "phobiaAcquired"));
});

test("fallDark: darkens a 4-square radius around the player with no RNG draws", () => {
  const state = fixedState();
  const events = fallDark(state, fakeRng([]), []);
  assert.equal(state.floor.g[5][5].dark, true);
  assert.ok(events.some((e) => e.type === "darknessFell"));
});

// --- purity -----------------------------------------------------------

test("encounters.js has no ACTUAL Math.random/document/localStorage code reference (comment-stripped)", () => {
  const raw = fs.readFileSync(path.resolve(__dirname, "..", "..", "engine", "encounters.js"), "utf8");
  const codeOnly = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
  assert.doesNotMatch(codeOnly, /Math\.random/);
  assert.doesNotMatch(codeOnly, /\bdocument\b/);
  assert.doesNotMatch(codeOnly, /\blocalStorage\b/);
});
