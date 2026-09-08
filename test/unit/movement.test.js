// Direct unit coverage for engine/movement.js branches the movement-parity
// fixture (test/parity/fixtures/action-script.movement.json) deliberately
// does NOT exercise, because the fixture must avoid every unimplemented
// feature tile (dot/trap/chest/tele) and every rng-dependent climb/gorge
// roll to stay reachable via a feature-avoiding path (see the fixture's
// `_note`). These tests fill that gap with hand-crafted floors and a
// deterministic mock rng whose `.d()` sequence is supplied directly (so each
// test documents, in order, exactly which die rolls the ported prototype
// code consumes) plus `test/unit/character.test.js`-style real seeded rng
// where a call (like genFloor) needs a real, unpredictable-length draw.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { makeRng } from "../../engine/rng.js";
import { GW, GH } from "../../engine/maze.js";
import {
  move,
  newDay,
  makeCamp,
  teleport,
  bestTeleportDir,
  descend,
  winGame,
  maxCharges,
} from "../../engine/movement.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count (each test documents which "roll" each entry is);
 * `.pick(arr)` returns `arr[0]` unless a picker is supplied. Throws if the
 * sequence underflows, which doubles as a "no more rng draws expected"
 * assertion. */
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

/** A minimal, fully-walled 21x21 grid (matches engine/maze.js's GW/GH) with
 * a hole punched wherever a test needs an open cell. */
function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, seen: false, feat: null, ...extra };
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
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g: wallGrid(), px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, won: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

// --- legality -------------------------------------------------------------

test("move: a wall/out-of-bounds move is a no-op (no state change, no events)", () => {
  const state = fixedState();
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(events.length, 0);
  assert.equal(state.floor.px, 5);
  assert.equal(state.floor.py, 5);
  assert.equal(state.steps, 0);
});

test("move: combat/store/dead/won all short-circuit as a no-op", () => {
  for (const overrides of [{ combat: {} }, { store: {} }, { dead: true }, { won: true }]) {
    const state = fixedState(overrides);
    open(state.floor.g, 5, 4);
    const events = move(state, "N", fakeRng([]), []);
    assert.equal(events.length, 0, `${JSON.stringify(overrides)} must block movement`);
  }
});

test("move: a legal corridor move increments steps, reveals, and emits moved", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.floor.px, 5);
  assert.equal(state.floor.py, 4);
  assert.equal(state.steps, 1);
  assert.equal(state.floor.g[4][5].seen, true);
  assert.deepStrictEqual(events, [{ type: "moved", to: { x: 5, y: 4 } }]);
});

// --- HI-01 regression: reveal radius follows darkness/Night Vision/sight --
//
// Ports the prototype's reveal() radius formula (test/parity/prototype-
// master.js.txt:838): r = ((dark && !skill("Night Vision")) ? 1 : 2) +
// eff("sight"). Before this fix, every real call site hard-coded radius 2
// regardless of darkness/skills/items.

/** assertSeenSquare(g, cx, cy, radius) — every cell within `radius` of
 * (cx,cy) must be seen; every cell exactly one step outside that square
 * (still in-bounds) must NOT be seen. */
function assertSeenSquare(g, cx, cy, radius) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      assert.equal(g[y][x].seen, true, `expected (${x},${y}) seen at radius ${radius}`);
    }
  }
  const outside = [
    [cx - radius - 1, cy],
    [cx + radius + 1, cy],
    [cx, cy - radius - 1],
    [cx, cy + radius + 1],
  ];
  for (const [x, y] of outside) {
    assert.equal(g[y] && g[y][x] && g[y][x].seen, false, `expected (${x},${y}) unseen at radius ${radius}`);
  }
}

test("HI-01: move onto a dark tile without Night Vision reveals only radius 1 (3x3)", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { dark: true });
  move(state, "N", fakeRng([]), []);
  assertSeenSquare(state.floor.g, 5, 4, 1);
});

test("HI-01: move onto a dark tile WITH Night Vision reveals full radius 2 (5x5)", () => {
  const state = fixedState({ c: { skills: { "Night Vision": 1 } } });
  open(state.floor.g, 5, 4, { dark: true });
  move(state, "N", fakeRng([]), []);
  assertSeenSquare(state.floor.g, 5, 4, 2);
});

test("HI-01: the Amulet of Light's sight:1 effect widens a lit tile's reveal to radius 3 (7x7)", () => {
  const state = fixedState({ c: { items: [{ n: "Amulet of Light", eff: { sight: 1, light: 1 } }] } });
  open(state.floor.g, 5, 4); // not dark
  move(state, "N", fakeRng([]), []);
  assertSeenSquare(state.floor.g, 5, 4, 3);
});

test("HI-01: sight:1 on a dark tile without Night Vision still only widens the dark 1 to a 2 (5x5)", () => {
  const state = fixedState({ c: { items: [{ n: "Amulet of Light", eff: { sight: 1, light: 1 } }] } });
  open(state.floor.g, 5, 4, { dark: true });
  move(state, "N", fakeRng([]), []);
  assertSeenSquare(state.floor.g, 5, 4, 2);
});

// --- one-way doors ----------------------------------------------------

test("move: a one-way door blocks entry from the wrong side (no-op)", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { feat: "one", dir: "S" }); // only openable heading S
  const events = move(state, "N", fakeRng([]), []); // approaching from the S side, heading N
  assert.equal(state.floor.py, 5, "blocked: position unchanged");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "oneWayBlocked");
});

test("move: a one-way door admits travel matching its designated direction", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { feat: "one", dir: "N" }); // openable heading N
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.floor.py, 4, "the door opens for a matching-direction approach");
  assert.ok(events.some((e) => e.type === "moved"));
});

test("move: once standing on a one-way door, only continuing its direction is legal", () => {
  const state = fixedState({ floor: { px: 5, py: 4 } });
  open(state.floor.g, 5, 4, { feat: "one", dir: "N" });
  open(state.floor.g, 4, 4); // a side passage the door should NOT allow leaving into
  open(state.floor.g, 5, 3);
  const blocked = move(state, "W", fakeRng([]), []);
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].type, "oneWayBlocked");
  assert.equal(state.floor.px, 5, "leaving sideways off the door is blocked");

  const allowed = move(state, "N", fakeRng([]), []);
  assert.ok(allowed.some((e) => e.type === "moved"));
  assert.equal(state.floor.py, 3, "continuing the door's own direction succeeds");
});

// --- climbing / leaping -------------------------------------------------

test("move: a successful climb clears the feature and does not hurt the character", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { feat: "climb" });
  // pick(["rope","rock","wood"]) -> "rope" (arr[0]); feet = 10*(1+d(2)=1) = 20;
  // two 10ft rungs, each r = d(10) - climbBonus(0) <= rope.success(7).
  const rng = fakeRng([1, 5, 5]);
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 55, "no fall damage on a clean climb");
  assert.equal(state.floor.g[4][5].feat, null, "the climb feature is consumed on success");
  assert.equal(state.floor.py, 4);
  assert.ok(events.some((e) => e.type === "climbedOver"));
});

test("move: a failed climb hurts the character and leaves the feature in place", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { feat: "climb" });
  // feet = 10*(1+d(2)=1) = 20; first rung r = d(10)=9 > rope.success(7) -> fail;
  // fall check for g=0: d(20)=15 (>2, hurt rolls); fall damage d6 = 4.
  const rng = fakeRng([1, 9, 15, 4]);
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 51, "took 4 wp of fall damage");
  assert.equal(state.floor.g[4][5].feat, "climb", "an unsuccessful climb does not consume the feature");
  assert.equal(state.floor.py, 5, "you never left the starting cell on a failed climb");
  assert.ok(events.some((e) => e.type === "fellClimbing" && e.hurt === 4));
});

test("move: a fatal climb fall kills the character via die('fall')", () => {
  const state = fixedState({ c: { wp: 3 } });
  open(state.floor.g, 5, 4, { feat: "climb" });
  const rng = fakeRng([1, 9, 15, 4], { pick: (arr) => arr[0] }); // 4 wp of fall damage >= 3 wp
  const events = move(state, "N", rng, []);
  assert.equal(state.dead, true);
  assert.equal(state.c.wp, 0, "die() zeroes wp regardless of how far the fall damage overshot");
  assert.ok(events.some((e) => e.type === "died" && e.cause === "fall"));
  assert.equal(state.deathNote, "fell off a wall");
});

test("move: a failed gorge leap deals 2d6 fall damage and leaves the gap open", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { feat: "gorge" });
  // LEAP_TABLE[d(4)-1=0] -> {ft:"3-4 feet", F:10, T:10, M:9}; Fighter needs <=10;
  // r = d(10) - leapBonus(0) = 10 draws to 11 (fail, > need 10); fall = d6+d6.
  const rng = fakeRng([1, 11, 3, 4]);
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 48, "took 7 wp (3+4) of fall damage");
  assert.equal(state.floor.g[4][5].feat, "gorge");
  assert.ok(events.some((e) => e.type === "fellInGorge" && e.hurt === 7));
});

test("move: a successful gorge leap clears the feature", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { feat: "gorge" });
  // LEAP_TABLE[0]: Fighter needs <=10; r = d(10)=6 - leapBonus(0) = 6 <= 10 -> clear.
  const rng = fakeRng([1, 6]);
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 55);
  assert.equal(state.floor.g[4][5].feat, null);
  assert.ok(events.some((e) => e.type === "leaptOver"));
});

// --- per-step ticks -------------------------------------------------------

test("move: an active affliction ticks down and clears when its duration expires", () => {
  const state = fixedState({ c: { affliction: { kind: "Poison", loss: { n: 1, sides: 6, bonus: 0 }, per: 1, left: 1 } } });
  open(state.floor.g, 5, 4);
  const rng = fakeRng([3]); // the affliction's d6 loss roll
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 52, "lost 3 wp to the tick");
  assert.equal(state.c.affliction, null, "left hit 0 and the affliction cleared");
  assert.ok(events.some((e) => e.type === "afflictionPassed"));
});

test("move: haste/invis/ether all decrement by one on a step", () => {
  const state = fixedState({ c: { haste: 5, invis: 3, ether: 1 } });
  open(state.floor.g, 5, 4);
  move(state, "N", fakeRng([]), []);
  assert.equal(state.c.haste, 4);
  assert.equal(state.c.invis, 2);
  assert.equal(state.c.ether, 0);
});

test("move: a Magic User recovers a spell charge every 20 steps if any are spent", () => {
  const state = fixedState({
    c: { cls: "Magic User", sub: "Wizard", spellsUsed: 1 },
    steps: 19,
  });
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.steps, 20);
  assert.equal(state.c.spellsUsed, 0);
  assert.equal(maxCharges(state.c), 2 * 1 + 2 + 0);
  assert.ok(events.some((e) => e.type === "spellChargeRecovered"));
});

// --- feature dispatch: exit / gate ----------------------------------------

test("move: stepping onto an exit tile descends to the next floor", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { feat: "exit" });
  const rng = makeRng(777); // genFloor draws an unpredictable number of times
  const events = move(state, "N", rng, []);
  assert.equal(state.floor.depth, 2);
  assert.equal(state.c.sp, 70, "40 + 30*1 skill points from clearing floor 1");
  assert.ok(events.some((e) => e.type === "floorChanged" && e.depth === 2));
});

test("move: a legacy 'gate' tile routes to descend (endless-mode compat), never wins (RUN-04)", () => {
  // genFloor never emits "gate" anymore (Plan 02) — this exercises the
  // legacy-save compatibility path: an in-flight save from before endless
  // descent may still hold a "gate" tile on its current floor. Stepping onto
  // it must continue deeper, exactly mirroring the exit-descend test above,
  // and must never set state.won.
  const state = fixedState({ floor: { depth: 5 } });
  open(state.floor.g, 5, 4, { feat: "gate" });
  const rng = makeRng(42); // genFloor draws an unpredictable number of times
  const events = move(state, "N", rng, []);
  assert.equal(state.floor.depth, 6);
  assert.equal(state.won, false);
  assert.equal(state.dead, false);
  assert.ok(events.some((e) => e.type === "floorChanged" && e.depth === 6));
});

test("winGame: still sets state.won when called directly (RETIRED as a run terminator — no longer wired by move(), but the function itself is unchanged/dormant)", () => {
  const state = fixedState();
  const rng = makeRng(1);
  const events = winGame(state, rng, [], () => 12345);
  assert.equal(state.won, true);
  assert.equal(state.dead, false, "winning is not dying");
  assert.equal(state.deathNote, "walked out");
  assert.ok(state.epitaph.length > 0);
  assert.ok(events.some((e) => e.type === "won" && e.level === state.c.level && e.day === state.day));
});

test("move: dot/trap/chest feature tiles are consumed and dispatch to the real encounter/trap/chest handlers (01-10)", () => {
  // dot: d8=4 -> ENCOUNTER_TABLES[3] ("+10 WP".."-All armour"), d10=1 -> "+10 WP"
  // (a plain tableFour row; no further rolls, so a 2-entry fakeRng suffices).
  {
    const state = fixedState();
    open(state.floor.g, 5, 4, { feat: "dot" });
    const events = move(state, "N", fakeRng([4, 1]), []);
    assert.equal(state.floor.g[4][5].feat, null, "dot is consumed");
    assert.ok(events.some((e) => e.type === "encounterRolled" && e.result === "+10 WP"));
    assert.ok(events.some((e) => e.type === "tableFour" && e.result === "+10 WP"));
    assert.equal(state.c.wp, 55, "the +10 WP row healed toward the cap (already at max)");
  }
  // trap: nimble = 5 (no Agility/Leaping skill, not an Acrobat); a dodge roll
  // of 5 <= nimble avoids the trap outright, so no further rolls are drawn.
  {
    const state = fixedState();
    open(state.floor.g, 5, 4, { feat: "trap" });
    const events = move(state, "N", fakeRng([5]), []);
    assert.equal(state.floor.g[4][5].feat, null, "trap is consumed");
    assert.ok(events.some((e) => e.type === "trapAvoided" && e.roll === 5 && e.need === 5));
  }
  // chest: no Locks skill and no lockpicks -> tier 0 -> the bare d20 branch;
  // a roll of 9 (> 8) leaves it locked, so no further rolls are drawn.
  {
    const state = fixedState();
    open(state.floor.g, 5, 4, { feat: "chest" });
    const events = move(state, "N", fakeRng([9]), []);
    assert.equal(state.floor.g[4][5].feat, null, "chest is consumed");
    assert.ok(events.some((e) => e.type === "chestLockRolled" && e.opened === false));
    assert.ok(events.some((e) => e.type === "chestLocked"));
  }
});

// --- day cycle --------------------------------------------------------

test("newDay: a fed character heals, and a wandering-monster hit starts a forced-random encounter (01-08)", () => {
  const state = fixedState();
  // heal = d(10)=5 + 2*level(1) = 7; then 8 d20 monster-check draws, one
  // hits; startCombat then draws the single foe's level (d4) and initiative
  // (2x d20: mine=15 >= theirs=10, so the player moves first and startCombat
  // does not also need to resolve a foeTurn). ENC_TYPES/roster picks use
  // fakeRng's default pick => arr[0] ("Beasts" -> level-1 roster's first
  // entry, "Bat/Rat").
  const rng = fakeRng([5, 1, 2, 3, 4, 5, 6, 7, 8, 3, 15, 10]);
  const events = newDay(state, false, rng, []);
  assert.equal(state.day, 2);
  assert.equal(state.c.wp, 55, "already at maxWP, so the +7 heal is clamped");
  assert.equal(state.c.rations, 5, "one ration consumed");
  assert.ok(events.some((e) => e.type === "wanderingMonster"));
  assert.ok(events.some((e) => e.type === "encounterStarted"));
  assert.ok(state.combat, "a wandering-monster hit starts combat (01-08)");
  assert.equal(state.combat.foes.length, 1, "a wandering encounter is always a single foe");
  assert.equal(state.combat.foes[0].name, "Bat/Rat");
});

test("newDay: starving with no rations kills via die('starve') when wp hits 0", () => {
  const state = fixedState({ c: { rations: 0, wp: 1 } }); // Human upkeep cost is 4
  const rng = makeRng(9);
  const events = newDay(state, false, rng, []);
  assert.equal(state.dead, true);
  assert.equal(state.deathNote, "starved in the dark");
  assert.ok(events.some((e) => e.type === "died" && e.cause === "starve"));
});

test("makeCamp: refuses to camp without enough rations for the night", () => {
  const state = fixedState({ c: { rations: 0 } });
  const events = makeCamp(state, fakeRng([]), []);
  assert.equal(state.day, 1, "no day advanced");
  assert.ok(events.some((e) => e.type === "campFailed"));
});

test("makeCamp: camps successfully and runs a camped newDay", () => {
  const state = fixedState();
  const rng = fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]); // heal roll + 8 safe monster-check draws
  const events = makeCamp(state, rng, []);
  assert.equal(state.day, 2);
  assert.ok(events.some((e) => e.type === "dayBegan" && e.camped === true));
});

// --- teleport -----------------------------------------------------------

test("teleport: an Illusionist chooses their best direction and travels a fixed 12 (no rng draws)", () => {
  const state = fixedState({ c: { sub: "Illusionist" } });
  for (let x = 5; x <= 17; x++) open(state.floor.g, x, 5); // a long clear run east
  assert.equal(bestTeleportDir(state), "E", "the longest clear run from the start is east");
  const rng = fakeRng([]); // must consume ZERO draws: no dice, no shuffle
  const events = teleport(state, rng, []);
  assert.equal(state.floor.px, 17, "travelled the fixed 12 squares east");
  assert.equal(state.floor.py, 5);
  assert.ok(events.some((e) => e.type === "teleported" && e.dist === 12 && e.used === "E"));
});

test("teleport: a non-Illusionist rolls 2d8 for direction and d20 for distance", () => {
  const state = fixedState();
  for (let y = 1; y <= 5; y++) open(state.floor.g, 5, y); // clear run north to y=1
  // DIRECTION_TABLE[d(8)-1=0]="N" twice; dist = d(20)=5. The full 5 squares
  // north would land on y=0 (out of bounds, `ny<1`), so tryDir falls back to
  // the next-farthest open square at y=1 (travelled=4).
  const rng = fakeRng([1, 1, 5]);
  const events = teleport(state, rng, []);
  assert.equal(state.floor.px, 5);
  assert.equal(state.floor.py, 1);
  const ev = events.find((e) => e.type === "teleported");
  assert.equal(ev.dir, "N");
  assert.equal(ev.dist, 5);
  assert.equal(ev.travelled, 4);
});

test("teleport: falls back toward the nearest open square when the full distance runs off the map", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4);
  open(state.floor.g, 5, 3); // open only 2 squares north; the rest stays wall
  const rng = fakeRng([1, 1, 20]); // dir N twice, dist d(20)=20 (way too far)
  const events = teleport(state, rng, []);
  assert.equal(state.floor.px, 5);
  assert.equal(state.floor.py, 3, "lands on the farthest actually-open square north");
  const ev = events.find((e) => e.type === "teleported");
  assert.equal(ev.travelled, 2);
  assert.equal(ev.dist, 20);
});

// --- purity ---------------------------------------------------------------

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("movement.js references no Math.random/document/localStorage", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "movement.js"), "utf8"));
  assert.ok(!/Math\.random/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
  assert.ok(!/\blocalStorage\b/.test(src));
});
