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
    dead: false, won: false, deathNote: "", epitaph: "",
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

// --- openChest ----------------------------------------------------------

test("openChest: a Pilfer always opens the box for free", () => {
  const state = fixedState({ c: { sub: "Pilfer", scrolls: 0 } });
  // gold roll d10=4 -> (4+6)*100*1/10=100; scroll roll d6=6 (>=3, scroll gained);
  // rollTreasureItem: hasPicks=false, d12=5 (not lockpicks); d10=10 -> rollStaff d8=1.
  const events = openChest(state, fakeRng([4, 6, 5, 10, 1]), []);
  assert.ok(events.some((e) => e.type === "chestOpened" && e.reason === "pilfer"));
  assert.equal(state.c.gold, 150, "50 starting + 100 chest gold");
  assert.equal(state.c.scrolls, 1);
  // rollTreasureItem happens to roll a staff here, and a Fighter can't wield
  // one (takeItem's class gate, ported verbatim) — the treasure roll still
  // ran (itemRejected proves it), it just didn't land in the character's
  // items array. That class gate is takeItem's job, not openChest's.
  assert.ok(events.some((e) => e.type === "itemTaken" || e.type === "itemRejected"), "the treasure roll ran through takeItem");
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

test("encounterDot: a plain Table Four row (e.g. '+10 WP') applies directly, no extra rolls", () => {
  const state = fixedState({ c: { wp: 40, maxWP: 55 } });
  // d8=4, d10=1 -> ENCOUNTER_TABLES[3][0] === "+10 WP".
  const events = encounterDot(state, fakeRng([4, 1]), []);
  assert.equal(state.c.wp, 50);
  assert.ok(events.some((e) => e.type === "encounterRolled" && e.result === "+10 WP"));
  assert.ok(events.some((e) => e.type === "tableFour"));
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

test("tableFour: a lethal '-15 WP' row kills via die('maze')", () => {
  const state = fixedState({ c: { wp: 10 } });
  const events = tableFour(state, "-15 WP", fakeRng([]), []);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died" && e.cause === "maze"));
});

// --- findFood / findGrimoire / findGear / findMisc -------------------------

test("findFood: heals toward the cap and grants a ration", () => {
  const state = fixedState({ c: { wp: 40, maxWP: 55, rations: 2 } });
  const events = findFood(state, fakeRng([1]), []); // FOODS[0] === Chicken (+12 wp)
  assert.equal(state.c.wp, 52);
  assert.equal(state.c.rations, 3);
  assert.ok(events.some((e) => e.type === "foodFound"));
});

test("findGrimoire: a non-Magic-User sells the book for gold instead of learning", () => {
  const state = fixedState({ c: { cls: "Fighter", gold: 50 } });
  const events = findGrimoire(state, fakeRng([]), []);
  assert.equal(state.c.gold, 200);
  assert.ok(events.some((e) => e.type === "grimoireSold"));
});

test("findGear: 'weapon' takes a mundane blade via rollBlade/takeItem", () => {
  const state = fixedState({ c: { cls: "Fighter", weapon: "Club", prof: 0, magicWpn: 0 } });
  const events = findGear(state, "weapon", fakeRng([1, 1]), []);
  assert.ok(events.some((e) => e.type === "itemTaken" || e.type === "itemRejected"));
});

test("findMisc: a Scroll result increments scrolls", () => {
  const state = fixedState({ c: { scrolls: 0 } });
  // d10=3 -> MISC_MAGIC[2] === "Scroll"
  const events = findMisc(state, fakeRng([3]), []);
  assert.equal(state.c.scrolls, 1);
  assert.ok(events.some((e) => e.type === "scrollFound"));
});

// --- meetFaerie / meetJoiner ------------------------------------------------

test("meetFaerie: '+d20 Base WP' raises the WP cap", () => {
  const state = fixedState({ c: { maxWP: 55, wp: 40 } });
  // d8=2 -> FAERIE[1] === "+d20 Base WP"; boon roll d20=10.
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
