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
  maxCharges,
  nightlyEats,
} from "../../engine/movement.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { fallDark } from "../../engine/encounters.js";
import { inDark, revealRadius } from "../../engine/derived.js";

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
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
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
    dead: false, deathNote: "", epitaph: "",
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

test("move: combat/store/dead all short-circuit as a no-op", () => {
  for (const overrides of [{ combat: {} }, { store: {} }, { dead: true }]) {
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

// 260918-w4n (use-activated-only): the Amulet's sight/light payload applies
// only while its own item:Amulet of Light record is LIVE.
function liveAmuletOfLight() {
  return { "item:Amulet of Light": { cadence: "squares", left: 50, cd: 50, phase: "effect" } };
}

test("HI-01: the Amulet of Light's LIVE sight:1 effect widens a lit tile's reveal to radius 3 (7x7)", () => {
  const state = fixedState({
    c: { items: [{ n: "Amulet of Light", eff: { sight: 1, light: 1 } }], timers: liveAmuletOfLight() },
  });
  open(state.floor.g, 5, 4); // not dark
  move(state, "N", fakeRng([]), []);
  assertSeenSquare(state.floor.g, 5, 4, 3);
});

test("HI-01: LIVE sight:1 on a dark tile without Night Vision still only widens the dark 1 to a 2 (5x5)", () => {
  const state = fixedState({
    c: { items: [{ n: "Amulet of Light", eff: { sight: 1, light: 1 } }], timers: liveAmuletOfLight() },
  });
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

// Phase 27 (2026-09-15, TUNE-06): hazardScale — post-draw arithmetic, same
// canon rolls as the two failed-fall tests above, but at floors where
// hazardScale leaves identity. Zero extra rng draws either way.
test("move: at depth 2, hazardScale (0.5) halves the canon climb-fall damage — Math.max(1, Math.round(4 * 0.5)) = 2", () => {
  const state = fixedState({ floor: { depth: 2 } });
  open(state.floor.g, 5, 4, { feat: "climb" });
  const rng = fakeRng([1, 9, 15, 4]);
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 53, "2 wp of fall damage (canon 4, hazardScale 0.5)");
  assert.ok(events.some((e) => e.type === "fellClimbing" && e.hurt === 2));
});

test("move: at depth 2, hazardScale (0.5) halves the canon gorge-fall damage — Math.max(1, Math.round(7 * 0.5)) = 4", () => {
  const state = fixedState({ floor: { depth: 2 } });
  open(state.floor.g, 5, 4, { feat: "gorge" });
  const rng = fakeRng([1, 11, 3, 4]);
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 51, "4 wp of fall damage (canon 7, hazardScale 0.5)");
  assert.ok(events.some((e) => e.type === "fellInGorge" && e.hurt === 4));
});

test("move: at depth 5, hazardScale is exactly 1 (canon) — the gorge-fall damage is unchanged", () => {
  const state = fixedState({ floor: { depth: 5 } });
  open(state.floor.g, 5, 4, { feat: "gorge" });
  const rng = fakeRng([1, 11, 3, 4]);
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 48, "7 wp of fall damage (canon, hazardScale 1 at depth 5)");
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

// --- audit-batch1 (2026-09-09, A2) + Phase 39 (GEAR-02): flight (Bracelet of
// Flight / Cloak of Flying) skips the climb/leap roll and all fall damage
// entirely. Bracelet of Flight is unconditional and never starts a c.timers
// record; Cloak of Flying is a real 20-square effect on a 50-square
// cooldown, ticked by the same per-step squares tick as every other item
// effect. `fakeRng([])` throws if ANY die is drawn, so a flownOver test that
// passes proves the roll (and its fall-damage math) was skipped entirely,
// not just that it happened to pass.

// 260918-w4n (use-activated-only): a ready-but-unused flight item (worn or
// bagged, no LIVE record) is NOT flying any more — the climb/gorge roll
// runs normally, no record is auto-started.
test("move: a ready-but-unused Bracelet of Flight does NOT skip the climb roll — it rolls normally and starts nothing", () => {
  const state = fixedState({ c: { items: [{ n: "Bracelet of Flight", eff: { fly: 1 } }] } });
  open(state.floor.g, 5, 4, { feat: "climb" });
  // Same sequence as the plain successful-climb test: pick -> "rope";
  // feet=10*(1+d(2)=1)=20; two 10ft rungs, each d(10)=5 <= rope.success(7).
  const events = move(state, "N", fakeRng([1, 5, 5]), []);
  assert.ok(events.some((e) => e.type === "climbedOver"), "rolls the climb — the Bracelet is not flying while unused");
  assert.ok(!events.some((e) => e.type === "flownOver"));
  assert.equal(state.c.timers, undefined, "a ready-but-unused item starts no record");
});

test("move: a ready-but-unused Bracelet of Flight does NOT skip a gorge leap either", () => {
  const state = fixedState({ c: { items: [{ n: "Bracelet of Flight", eff: { fly: 1 } }] } });
  open(state.floor.g, 5, 4, { feat: "gorge" });
  // Same sequence as the plain successful-leap test: LEAP_TABLE[0], Fighter
  // needs <=10; d(10)=6 <= 10 -> clear.
  const events = move(state, "N", fakeRng([1, 6]), []);
  assert.ok(events.some((e) => e.type === "leaptOver"));
  assert.ok(!events.some((e) => e.type === "flownOver"));
});

test("move: a worn+used (LIVE) Bracelet of Flight flies over a climb with zero rng draws; the per-step tick burns it down by one", () => {
  const state = fixedState({
    c: {
      worn: { bracelet: { n: "Bracelet of Flight", eff: { fly: 1 } } },
      timers: { "item:Bracelet of Flight": { cadence: "squares", left: 20, cd: 50, phase: "effect" } },
    },
  });
  open(state.floor.g, 5, 4, { feat: "climb" });
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.wp, 55, "no fall damage — the roll never ran");
  assert.equal(state.floor.g[4][5].feat, null, "the climb feature is still consumed");
  assert.equal(state.floor.py, 4);
  assert.ok(events.some((e) => e.type === "flownOver"));
  assert.ok(!events.some((e) => e.type === "climbedOver"));
  assert.deepStrictEqual(state.c.timers["item:Bracelet of Flight"], { cadence: "squares", left: 19, cd: 50, phase: "effect" });
});

test("move: a ready Cloak of Flying with NO live record rolls the climb — the old auto-activation is removed", () => {
  const state = fixedState({ c: { items: [{ n: "Cloak of Flying", eff: { fly: 1 } }] } });
  open(state.floor.g, 5, 4, { feat: "climb" });
  const events = move(state, "N", fakeRng([1, 5, 5]), []);
  assert.ok(events.some((e) => e.type === "climbedOver"));
  assert.ok(!events.some((e) => e.type === "flownOver"));
  assert.ok(!events.some((e) => e.type === "itemEffectStarted"));
  assert.equal(state.c.timers, undefined, "nothing auto-starts any more — useItem is the only way to start it");
});

test("move: while a Cloak of Flying effect is still active, a SECOND climb in the same window flies over again without re-starting the effect", () => {
  const state = fixedState({
    c: {
      items: [{ n: "Cloak of Flying", eff: { fly: 1 } }],
      timers: { "item:Cloak of Flying": { cadence: "squares", left: 5, cd: 50, phase: "effect" } },
    },
  });
  open(state.floor.g, 5, 4, { feat: "climb" });
  const events = move(state, "N", fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "flownOver"));
  assert.equal(events.some((e) => e.type === "itemEffectStarted"), false, "the existing effect is not re-started");
  assert.equal(state.c.timers["item:Cloak of Flying"].left, 4, "the existing effect just ticks down by one step — never resets to 20");
});

test("move: a Cloak of Flying effect exhausting on a plain step starts the 50-square cooldown (narrating itemEffectFaded)", () => {
  const state = fixedState({
    c: {
      items: [{ n: "Cloak of Flying", eff: { fly: 1 } }],
      timers: { "item:Cloak of Flying": { cadence: "squares", left: 1, cd: 50, phase: "effect" } },
    },
  });
  open(state.floor.g, 5, 4); // a plain corridor step, not a climb/gorge tile
  const events = move(state, "N", fakeRng([]), []);
  assert.deepStrictEqual(state.c.timers["item:Cloak of Flying"], { cadence: "squares", left: 50, cd: 50, phase: "cooldown" });
  assert.ok(events.some((e) => e.type === "itemEffectFaded" && e.item === "Cloak of Flying"));
});

test("move: while a Cloak of Flying is on cooldown, climb/gorge rolls resume normally (isFlying is false) and the cooldown keeps ticking", () => {
  const state = fixedState({
    c: {
      items: [{ n: "Cloak of Flying", eff: { fly: 1 } }],
      timers: { "item:Cloak of Flying": { cadence: "squares", left: 5, phase: "cooldown" } },
    },
  });
  open(state.floor.g, 5, 4, { feat: "climb" });
  // Same successful-climb roll sequence as the plain climb test above.
  const rng = fakeRng([1, 5, 5]);
  const events = move(state, "N", rng, []);
  assert.ok(events.some((e) => e.type === "climbedOver"), "on cooldown, a real roll happens — not flownOver");
  assert.ok(!events.some((e) => e.type === "flownOver"));
  assert.equal(state.c.wp, 55, "the roll succeeded, so still no fall damage");
  assert.equal(state.c.timers["item:Cloak of Flying"].left, 4, "the cooldown still ticks down on an ordinary step");
});

test("move: carrying BOTH items, only the one with a LIVE record flies — the other's record is left untouched", () => {
  const state = fixedState({
    c: {
      items: [
        { n: "Bracelet of Flight", eff: { fly: 1 } },
        { n: "Cloak of Flying", eff: { fly: 1 } },
      ],
      timers: { "item:Bracelet of Flight": { cadence: "squares", left: 20, cd: 50, phase: "effect" } },
    },
  });
  open(state.floor.g, 5, 4, { feat: "climb" });
  const events = move(state, "N", fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "flownOver"));
  assert.equal(state.c.timers["item:Cloak of Flying"], undefined, "the Bracelet's live flight never touches the Cloak's own record");
});

// --- PHOBIA-01: Heights/Bodies-of-water climb/leap penalties (04.1-06) ----
//
// Both penalties add a DETERMINISTIC value to the roll comparison `r` —
// never a new rng draw — so an identical rng sequence produces a different
// pass/fail outcome purely from the phobia flag. Hardiness halves the
// penalty (round(2/2)=1), proven by re-running the SAME borderline roll.

test("move: a Heights-phobic character fails a borderline climb an identical non-phobic character passes", () => {
  const nonPhobic = fixedState(); // default phobia "Spiders" — not Heights
  open(nonPhobic.floor.g, 5, 4, { feat: "climb" });
  // pick(["rope","rock","wood"]) -> rope (success=7); feet=10*(1+d(2)=1)=20;
  // rung 1: r = d(10)=6 - climbBonus(0) + 0 = 6 <= 7 -> pass; rung 2: r=5<=7 -> pass.
  const passEvents = move(nonPhobic, "N", fakeRng([1, 6, 5]), []);
  assert.equal(nonPhobic.c.wp, 55, "no penalty, no phobia -> clean climb");
  assert.ok(passEvents.some((e) => e.type === "climbedOver"));
  assert.ok(!passEvents.some((e) => e.type === "heightsFear"));

  const phobic = fixedState({ c: { phobia: "Heights", phobiaType: null } });
  open(phobic.floor.g, 5, 4, { feat: "climb" });
  // Identical roll (6), but +2 Heights penalty: r = 6 + 2 = 8 > 7 -> fails on
  // rung 1; fall check g=0: d(20)=15 (>2, hurt rolls); fall damage d6=4.
  const failEvents = move(phobic, "N", fakeRng([1, 6, 15, 4]), []);
  assert.equal(phobic.c.wp, 51, "the SAME roll now fails and costs 4 fall wp");
  assert.ok(failEvents.some((e) => e.type === "fellClimbing" && e.hurt === 4));
  assert.ok(failEvents.some((e) => e.type === "heightsFear"));
});

test("move: Hardiness halves the Heights penalty enough to turn the same borderline roll back into a pass", () => {
  const state = fixedState({ c: { phobia: "Heights", phobiaType: null, skills: { Hardiness: 1 } } });
  open(state.floor.g, 5, 4, { feat: "climb" });
  // Halved penalty = round(2/2) = 1: rung 1 r = 6 + 1 = 7 <= 7 -> pass;
  // rung 2 r = 5 + 1 = 6 <= 7 -> pass.
  const events = move(state, "N", fakeRng([1, 6, 5]), []);
  assert.equal(state.c.wp, 55, "Hardiness halves the penalty enough to clear the climb");
  assert.ok(events.some((e) => e.type === "climbedOver"));
  assert.ok(events.some((e) => e.type === "heightsFear"), "the fear still registers even though the roll passes");
});

test("move: a Bodies-of-water-phobic character fails a borderline gorge leap an identical non-phobic character passes", () => {
  const nonPhobic = fixedState();
  open(nonPhobic.floor.g, 5, 4, { feat: "gorge" });
  // LEAP_TABLE[0]: Fighter needs <=10; r = d(10)=9 - leapBonus(0) + 0 = 9 <= 10 -> clear.
  const passEvents = move(nonPhobic, "N", fakeRng([1, 9]), []);
  assert.equal(nonPhobic.c.wp, 55);
  assert.ok(passEvents.some((e) => e.type === "leaptOver"));
  assert.ok(!passEvents.some((e) => e.type === "waterFear"));

  const phobic = fixedState({ c: { phobia: "Bodies of water", phobiaType: null } });
  open(phobic.floor.g, 5, 4, { feat: "gorge" });
  // Identical roll (9), but +2 water penalty: r = 9 + 2 = 11 > 10 -> fails; fall = d6+d6.
  const failEvents = move(phobic, "N", fakeRng([1, 9, 3, 4]), []);
  assert.equal(phobic.c.wp, 48, "the SAME roll now fails and costs 7 (3+4) fall wp");
  assert.ok(failEvents.some((e) => e.type === "fellInGorge" && e.hurt === 7));
  assert.ok(failEvents.some((e) => e.type === "waterFear"));
});

test("move: Hardiness halves the Bodies-of-water penalty enough to turn the same borderline roll back into a pass", () => {
  const state = fixedState({ c: { phobia: "Bodies of water", phobiaType: null, skills: { Hardiness: 1 } } });
  open(state.floor.g, 5, 4, { feat: "gorge" });
  // Halved penalty = round(2/2) = 1: r = 9 + 1 = 10 <= 10 -> clear.
  const events = move(state, "N", fakeRng([1, 9]), []);
  assert.equal(state.c.wp, 55, "Hardiness halves the penalty enough to clear the leap");
  assert.ok(events.some((e) => e.type === "leaptOver"));
  assert.ok(events.some((e) => e.type === "waterFear"));
});

// --- PHOBIA-01: Being-trapped dead-end panic, debounced (04.1-06) --------
//
// A dead-end tile has exactly one (or zero) non-wall orthogonal neighbor.
// The debounce marker lives on the TILE itself (there.trapPanicked), not a
// new chargen field — proven by the regression test below: leaving and
// re-entering the identical dead-end tile does not re-fire the penalty.

test("move: a Being-trapped-phobic character panics on first entry into a dead-end tile", () => {
  const state = fixedState({ c: { phobia: "Being trapped", phobiaType: null } });
  open(state.floor.g, 5, 5); // the start tile itself, so a return trip stays legal
  open(state.floor.g, 5, 4); // a genuine dead end: its only open neighbor is (5,5)
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.wp, 51, "took the 4 wp Being-trapped panic (no Hardiness)");
  assert.ok(events.some((e) => e.type === "trappedPanic" && e.loss === 4));
  assert.equal(state.floor.g[4][5].trapPanicked, true, "the tile itself carries the debounce marker");
});

test("move: a second consecutive entry into the SAME dead-end tile does NOT re-apply the panic (debounce regression)", () => {
  const state = fixedState({ c: { phobia: "Being trapped", phobiaType: null } });
  // (5,5) needs a SECOND open neighbor (5,6) so the start tile is not itself
  // read as a dead end when the player steps back onto it — isolating this
  // regression to exactly one dead-end tile, (5,4).
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 6);
  open(state.floor.g, 5, 4);
  move(state, "N", fakeRng([]), []); // first entry into (5,4): panics, wp 55 -> 51
  move(state, "S", fakeRng([]), []); // leaves (5,4) for (5,5) — not a dead end, no panic
  const events = move(state, "N", fakeRng([]), []); // second entry into (5,4): already panicked
  assert.equal(state.c.wp, 51, "no additional wp loss on re-entry — debounced");
  assert.ok(!events.some((e) => e.type === "trappedPanic"), "the marker on the tile suppresses the re-fire");
});

test("move: a non-Being-trapped-phobic character entering the same dead-end tile takes no panic", () => {
  const state = fixedState(); // default phobia "Spiders"
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.wp, 55);
  assert.ok(!events.some((e) => e.type === "trappedPanic"));
});

test("move: Hardiness halves a Being-trapped character's panic loss", () => {
  const state = fixedState({ c: { phobia: "Being trapped", phobiaType: null, skills: { Hardiness: 1 } } });
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.wp, 53, "took only 2 wp (halved from 4) with Hardiness");
  assert.ok(events.some((e) => e.type === "trappedPanic" && e.loss === 2));
});

// --- per-step ticks -------------------------------------------------------

test("move: an active affliction ticks down and clears when its duration expires", () => {
  const state = fixedState({ c: { affliction: { kind: "Poison", loss: { n: 1, sides: 6, bonus: 0 }, per: 1, left: 1 } } });
  open(state.floor.g, 5, 4);
  const rng = fakeRng([3]); // the affliction's d6 loss roll
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 52, "lost 3 wp to the tick");
  assert.equal(state.c.affliction, null, "left hit 0 and the affliction cleared");
  // audit-batch1 (2026-09-09, A1): afflictionPassed now names what passed.
  const passed = events.find((e) => e.type === "afflictionPassed");
  assert.ok(passed, "afflictionPassed fired");
  assert.equal(passed.kind, "Poison");
});

// audit-bugs (2026-09-09, E5): poison-at-1hp infinite loop. A character at
// 1 hp clamps every tick's loss to 0 (never the killing blow) — before the
// fix, the affliction only cleared via its duration counter, so a long-left
// affliction kept re-emitting the same loss-0 "has taken everything it can"
// tick every step, forever, with no way out. The fix clears the affliction
// immediately once a tick can take nothing more, regardless of how much
// duration is left, and never emits the loss-0 afflictionTick at all.
test("move: poison at 1 hp clears immediately on the next tick instead of looping the loss-0 tick forever", () => {
  const state = fixedState({
    c: { wp: 1, affliction: { kind: "Poison", loss: { n: 1, sides: 6, bonus: 0 }, per: 1, left: 10 } },
  });
  open(state.floor.g, 5, 4);
  const rng = fakeRng([6]); // the affliction's d6 loss roll — irrelevant, clamped to 0 at 1 hp
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 1, "already at 1 hp; the clamp leaves it untouched");
  assert.equal(state.c.affliction, null, "the affliction auto-clears once it can take nothing more");
  assert.ok(!events.some((e) => e.type === "afflictionTick"), "no loss-0 tick event — it clears instead of looping");
  const passed = events.find((e) => e.type === "afflictionPassed");
  assert.ok(passed, "afflictionPassed fired instead");
  assert.equal(passed.kind, "Poison");
});

test("move: poison NOT yet at the floor keeps ticking normally (duration-based clear unaffected)", () => {
  const state = fixedState({
    c: { wp: 20, affliction: { kind: "Poison", loss: { n: 1, sides: 6, bonus: 0 }, per: 1, left: 10 } },
  });
  open(state.floor.g, 5, 4);
  const rng = fakeRng([4]); // the affliction's d6 loss roll — well under wp-1, no clamp
  const events = move(state, "N", rng, []);
  assert.equal(state.c.wp, 16, "took the full rolled loss");
  assert.ok(state.c.affliction, "still has 9 rounds left — not cleared");
  assert.equal(state.c.affliction.left, 9);
  const tick = events.find((e) => e.type === "afflictionTick");
  assert.ok(tick, "a normal (non-floored) tick still fires afflictionTick");
  assert.equal(tick.loss, 4);
  assert.ok(!events.some((e) => e.type === "afflictionPassed"), "duration has not run out yet");
});

// --- PHOBIA-01: persistent darkness state (04.1-05) -----------------------

test("fallDark sets a persistent darkFor counter; inDark reads true and revealRadius shrinks even off a dark tile", () => {
  const state = fixedState();
  const events = fallDark(state, fakeRng([]), []);
  assert.ok(state.c.darkFor > 0, "fallDark sets a positive persistent-darkness duration");
  // The player's own current tile (5,5) was never opened/painted dark by
  // this wallGrid fixture, so a bare tile check would read false here —
  // proving the counter, not the tile, is what's driving these reads.
  assert.equal(state.floor.g[5][5].dark, undefined, "the current tile itself carries no dark flag");
  assert.equal(inDark(state), true, "inDark reads true purely from the persistent counter");
  assert.equal(revealRadius(state), 1, "the shrunk fog-of-war radius applies off a dark tile");
  assert.ok(events.some((e) => e.type === "darknessFell"));
});

test("a Night Vision character's revealRadius ignores the persistent darkness counter's shrink", () => {
  const state = fixedState({ c: { skills: { "Night Vision": 1 } } });
  fallDark(state, fakeRng([]), []);
  assert.equal(inDark(state), true, "inDark still reports the state fact");
  assert.equal(revealRadius(state), 2, "Night Vision waives the shrink, exactly like the tile-dark case");
});

test("move: the persistent darkness counter decrements per step and clears at zero, emitting darknessLifted", () => {
  const state = fixedState({ c: { darkFor: 1 } });
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.darkFor, 0);
  assert.ok(events.some((e) => e.type === "darknessLifted"));
  assert.equal(inDark(state), false, "once cleared, a non-dark tile no longer reads inDark");
});

test("move: the persistent darkness counter decrements without clearing while still active", () => {
  const state = fixedState({ c: { darkFor: 5 } });
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.darkFor, 4);
  assert.ok(!events.some((e) => e.type === "darknessLifted"));
  assert.equal(inDark(state), true, "still active, so inDark stays true even off a dark tile");
});

test("move: a character with darkFor at 0 gets no darkness tick/event at all", () => {
  const state = fixedState({ c: { darkFor: 0 } });
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.darkFor, 0);
  assert.ok(!events.some((e) => e.type === "darknessLifted"));
});

test("move: haste/invis/ether item effects (c.timers, squares cadence) all decrement by one on a step", () => {
  // Phase 39 (GEAR-02): the retired c.haste/c.invis/c.ether counters — every
  // item effect now lives on c.timers, squares-cadence, ticked identically.
  const state = fixedState({
    c: {
      timers: {
        "item:Cloak of Speed": { cadence: "squares", left: 5, cd: 50, phase: "effect" },
        "item:Invisible": { cadence: "squares", left: 3, phase: "effect" },
        "item:Cloak of Ether": { cadence: "squares", left: 1, cd: 80, phase: "effect" },
      },
    },
  });
  open(state.floor.g, 5, 4);
  const events = move(state, "N", fakeRng([]), []);
  assert.equal(state.c.timers["item:Cloak of Speed"].left, 4);
  assert.equal(state.c.timers["item:Invisible"].left, 2);
  // ether had 1 left with a cd (80) — flips to cooldown, narrating itemEffectFaded.
  assert.deepStrictEqual(state.c.timers["item:Cloak of Ether"], { cadence: "squares", left: 80, cd: 80, phase: "cooldown" });
  assert.ok(events.some((e) => e.type === "itemEffectFaded" && e.item === "Cloak of Ether"));
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
  // and never marks the run as won.
  const state = fixedState({ floor: { depth: 5 } });
  open(state.floor.g, 5, 4, { feat: "gate" });
  const rng = makeRng(42); // genFloor draws an unpredictable number of times
  const events = move(state, "N", rng, []);
  assert.equal(state.floor.depth, 6);
  assert.ok(!("won" in state), "the run carries no won flag");
  assert.equal(state.dead, false);
  assert.ok(events.some((e) => e.type === "floorChanged" && e.depth === 6));
});

test("WR-01: descend() guards the SP-bonus formula against a tampered negative/non-integer floor.depth", () => {
  // A hand-edited save could rehydrate with a negative/non-integer
  // state.floor.depth (engine/saveState.js#isValidFloor only checks
  // Number.isInteger, not >= 1). Before the fix, `40 + 30 * state.floor.depth`
  // read the raw field directly and could produce a large NEGATIVE SP grant
  // (e.g. depth -500 -> bonus -14960) instead of routing through
  // difficultyCurve()'s safeDepth() guard the way genFloor's own knobs do.
  for (const tamperedDepth of [-500, -1, 0, 1.9, NaN]) {
    const state = fixedState({ floor: { depth: tamperedDepth } });
    open(state.floor.g, 5, 4, { feat: "exit" });
    const rng = makeRng(123);
    const before = state.c.sp;
    const events = move(state, "N", rng, []);
    const gained = state.c.sp - before;
    assert.ok(gained >= 40, `depth ${tamperedDepth}: SP bonus must never go negative/absurd, got ${gained}`);
    assert.ok(Number.isFinite(gained), `depth ${tamperedDepth}: SP bonus must be finite, got ${gained}`);
    assert.ok(events.some((e) => e.type === "spGained" && e.amount === gained));
    assert.ok(Number.isInteger(state.floor.depth) && state.floor.depth >= 1, "the new floor's own depth is also sanitized");
  }
});

test("move: dot/trap/chest feature tiles are consumed and dispatch to the real encounter/trap/chest handlers (01-10)", () => {
  // dot: d8=4 -> ENCOUNTER_TABLES[3] ("+10 HP".."-All armour"), d10=1 -> "+10 HP"
  // (a plain tableFour row; no further rolls, so a 2-entry fakeRng suffices).
  // 04.2 E3: the dual-purpose cell/switch key was "+10 WP", now "+10 HP"; the
  // tableFour beat now carries a prose sentence rather than the raw cell.
  {
    const state = fixedState();
    open(state.floor.g, 5, 4, { feat: "dot" });
    const events = move(state, "N", fakeRng([4, 1]), []);
    assert.equal(state.floor.g[4][5].feat, null, "dot is consumed");
    assert.ok(events.some((e) => e.type === "encounterRolled" && e.result === "+10 HP"));
    assert.ok(events.some((e) => e.type === "tableFour" && /10 hp/.test(e.result)));
    assert.equal(state.c.wp, 55, "the +10 HP row healed toward the cap (already at max)");
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
  // 260919-00d: a wandering monster no longer finds a party standing inside
  // rock — open the party's own cell so this pre-existing test still means
  // "asleep in a corridor", not "asleep entombed" (the fixedState() default
  // sits on wallGrid's unopened (5,5)).
  open(state.floor.g, 5, 5);
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

// --- newDay: audit-batch1 (2026-09-09, A3) resting cure roll --------------
//
// Resting used to auto-cure any affliction unconditionally. Now it is a real
// d20 roll — <=10 succeeds (~50%), +4 with Hardiness — that fires ONLY when
// the character HAS an affliction. Sequence discipline matches the "fed
// character heals" test above: heal d(10), then (only with an affliction)
// the cure-roll d(20), then 8 wandering-monster d20 checks.

test("newDay: a successful cure roll clears the affliction and fires afflictionCured with its kind", () => {
  const state = fixedState({ c: { affliction: { kind: "Poison", loss: { n: 1, sides: 6, bonus: 0 }, per: 1, left: 5 } } });
  const rng = fakeRng([5, 5, 2, 2, 2, 2, 2, 2, 2, 2]); // heal 5, cure roll 5 (<=10 -> succeeds)
  const events = newDay(state, false, rng, []);
  assert.equal(state.c.affliction, null, "the roll succeeded");
  const cured = events.find((e) => e.type === "afflictionCured");
  assert.ok(cured);
  assert.equal(cured.kind, "Poison");
  assert.ok(!events.some((e) => e.type === "afflictionLingers"));
});

test("newDay: a failed cure roll leaves the affliction lingering and fires afflictionLingers with its kind", () => {
  const state = fixedState({ c: { affliction: { kind: "Poison", loss: { n: 1, sides: 6, bonus: 0 }, per: 1, left: 5 } } });
  const rng = fakeRng([5, 15, 2, 2, 2, 2, 2, 2, 2, 2]); // heal 5, cure roll 15 (>10 -> fails)
  const events = newDay(state, false, rng, []);
  assert.ok(state.c.affliction, "the affliction is still present");
  assert.equal(state.c.affliction.kind, "Poison");
  const lingers = events.find((e) => e.type === "afflictionLingers");
  assert.ok(lingers);
  assert.equal(lingers.kind, "Poison");
  assert.ok(!events.some((e) => e.type === "afflictionCured"));
});

test("newDay: Hardiness raises the cure threshold from 10 to 14, turning the same roll from a fail into a success", () => {
  const noHardiness = fixedState({
    c: { affliction: { kind: "Disease", loss: { n: 1, sides: 6, bonus: 0 }, per: 1, left: 5 } },
  });
  const failRng = fakeRng([5, 13, 2, 2, 2, 2, 2, 2, 2, 2]); // heal 5, cure roll 13 (>10, no Hardiness -> fails)
  newDay(noHardiness, false, failRng, []);
  assert.ok(noHardiness.c.affliction, "without Hardiness, 13 fails the base threshold of 10");

  const withHardiness = fixedState({
    c: { skills: { Hardiness: 1 }, affliction: { kind: "Disease", loss: { n: 1, sides: 6, bonus: 0 }, per: 1, left: 5 } },
  });
  const passRng = fakeRng([5, 13, 2, 2, 2, 2, 2, 2, 2, 2]); // the SAME roll of 13, now <=14 -> succeeds
  newDay(withHardiness, false, passRng, []);
  assert.equal(withHardiness.c.affliction, null, "Hardiness's +4 turns the identical roll into a cure");
});

// --- newDay: armour patching, Sewing + Master of Arms (RULE-02) -----------
//
// Ports the movement.js armour-patch block. The outer gate used to read the
// dead `c.dr > 0` (a field rollCharacter never sets); it now reads
// `skillTier(c, "Sewing") || c.sub === "Master of Arms"`. Sequence discipline
// matches the "fed character heals" test above: heal d(10), then (only when
// the armour-patch branch actually draws) its own die, then 8 wandering-
// monster d20 checks (all non-1 here, so no combat starts).

test("newDay: a tier-1 Sewing thief patches d6 armour, clamped to armorMax", () => {
  const state = fixedState({ c: { skills: { Sewing: 1 }, armorWP: 18, armorMax: 20, patches: 0 } });
  const rng = fakeRng([5, 6, 2, 2, 2, 2, 2, 2, 2, 2]);
  const events = newDay(state, false, rng, []);
  assert.equal(state.c.armorWP, 20, "18 + d6(6) clamps to armorMax 20");
  assert.equal(state.c.patches, 1);
  assert.ok(events.some((e) => e.type === "armorPatched" && e.amount === 6));
});

test("newDay: a tier-2 Sewing thief patches d6+3 armour", () => {
  const state = fixedState({ c: { skills: { Sewing: 2 }, armorWP: 10, armorMax: 100, patches: 5 } });
  const rng = fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
  const events = newDay(state, false, rng, []);
  assert.equal(state.c.armorWP, 15, "10 + (d6(2)+3) = 15");
  assert.equal(state.c.patches, 6);
  assert.ok(events.some((e) => e.type === "armorPatched" && e.amount === 5));
});

test("newDay: a tier-2 Sewing thief who has already used all 6 patches gets no further patch", () => {
  const state = fixedState({ c: { skills: { Sewing: 2 }, armorWP: 10, armorMax: 100, patches: 6 } });
  const rng = fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]);
  const events = newDay(state, false, rng, []);
  assert.equal(state.c.armorWP, 10, "patch budget exhausted -> no repair");
  assert.equal(state.c.patches, 6);
  assert.ok(!events.some((e) => e.type === "armorPatched"));
});

test("newDay: a Master of Arms fighter (no Sewing) patches d6+3 armour", () => {
  const state = fixedState({ c: { sub: "Master of Arms", skills: {}, armorWP: 10, armorMax: 100, patches: 0 } });
  const rng = fakeRng([5, 4, 2, 2, 2, 2, 2, 2, 2, 2]);
  const events = newDay(state, false, rng, []);
  assert.equal(state.c.armorWP, 17, "10 + (d6(4)+3) = 17");
  assert.equal(state.c.patches, 0, "the Master of Arms branch does not consume a Sewing patch slot");
  assert.ok(events.some((e) => e.type === "armorPatched" && e.amount === 7));
});

test("newDay: a plain character with damaged armour and neither capability gets NO patch (T-04.1-03)", () => {
  const state = fixedState({ c: { sub: "Soldier", skills: {}, armorWP: 10, armorMax: 100, patches: 0 } });
  const rng = fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]);
  const events = newDay(state, false, rng, []);
  assert.equal(state.c.armorWP, 10, "no Sewing and not Master of Arms -> the gate never opens");
  assert.equal(state.c.patches, 0);
  assert.ok(!events.some((e) => e.type === "armorPatched"), "the old bare-else d4 fallback must not fire");
});

test("newDay: starving with no rations kills via die('starve') when wp hits 0", () => {
  const state = fixedState({ c: { rations: 0, wp: 1 } }); // Human upkeep cost is 4
  const rng = makeRng(9);
  const events = newDay(state, false, rng, []);
  assert.equal(state.dead, true);
  assert.equal(state.deathNote, "starved in the dark");
  assert.ok(events.some((e) => e.type === "died" && e.cause === "starve"));
});

// --- newDay: party upkeep, party-LOCAL balance (PARTY-10, Phase 11) --------
//
// A joiner must be a real resource cost, not free power: the canon
// counterweight is that a PARTY EATS MORE. newDay now folds each LIVE party
// member's rations into `eats` and its upkeep() into the hungry-path `cost`,
// GATED behind `state.party?.length`. These tests prove (a) the empty/no-party
// path is byte-identical to the pre-party baseline, (b) a member drains
// rations faster, and (c) an unfed party starves the hero faster. Sequence
// discipline matches the "fed character heals" test: heal d(10), then 8
// wandering-monster d20 checks (all non-1 here, so no combat starts).

/** A live party member: a full rollCharacter()-shaped sheet (fixedFighter),
 * Human by default (upkeep 4, eats 1). state.party holds LIVE members only —
 * endCombat prunes downed/departed — so tests may list them all directly. */
function member(overrides = {}) {
  return fixedFighter({ name: "Hired Muscle", ...overrides });
}

test("newDay: a solo day (no party) drains exactly one ration — byte-identical to the pre-party baseline", () => {
  // No `party` field at all, and an explicit empty `party: []`, must BOTH
  // consume exactly one ration (Human hero eats 1), proving the party-upkeep
  // block is fully skipped when there is no party.
  for (const overrides of [{ c: { rations: 6 } }, { c: { rations: 6 }, party: [] }]) {
    const state = fixedState(overrides);
    const rng = fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]); // heal 5, then 8 non-1 monster checks
    newDay(state, false, rng, []);
    assert.equal(state.c.rations, 5, `${JSON.stringify(overrides)}: solo consumes exactly one ration`);
    assert.equal(state.dead, false);
  }
});

test("newDay: one live party member makes the day eat MORE rations than solo (a party is a real cost)", () => {
  const solo = fixedState({ c: { rations: 6 } });
  newDay(solo, false, fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal(solo.c.rations, 5, "solo Human hero eats 1 ration");

  const withMember = fixedState({ c: { rations: 6 }, party: [member({ race: "Human" })] });
  newDay(withMember, false, fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal(withMember.c.rations, 4, "hero (1) + one Human member (1) = 2 rations consumed");
  assert.ok(withMember.c.rations < solo.c.rations, "a party drains rations faster than solo");
});

test("newDay: an unfed party starves the hero FASTER — a wp the solo hero survives is lethal with a member in tow", () => {
  // Human upkeep cost is 4. At wp 5 the solo hero survives the hungry night
  // (5 - 4 = 1). With one live Human member the cost is 8 (4 + 4), so the same
  // wp 5 hero starves into die("starve").
  const solo = fixedState({ c: { rations: 0, wp: 5 } });
  newDay(solo, false, fakeRng([2, 2, 2, 2, 2, 2, 2, 2]), []); // no heal (hungry path), 8 monster checks
  assert.equal(solo.dead, false, "solo hero survives the hungry night at wp 5 (cost 4)");
  assert.equal(solo.c.wp, 1, "5 - 4 = 1 wp left");

  const withMember = fixedState({ c: { rations: 0, wp: 5 }, party: [member({ race: "Human" })] });
  const events = newDay(withMember, false, fakeRng([]), []); // dies before the monster checks -> no rng draws
  assert.equal(withMember.dead, true, "the party's extra upkeep (cost 8) starves the hero");
  assert.equal(withMember.deathNote, "starved in the dark");
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

// --- nightlyEats / makeCamp DFB-06 (Phase 25.1) --------------------------

test("nightlyEats: solo hero = own appetite (Human 1, Troll 2); no party field and party [] agree", () => {
  assert.equal(nightlyEats(fixedState()), 1, "solo Human = 1");
  assert.equal(nightlyEats(fixedState({ c: { race: "Troll" } })), 2, "solo Troll = 2");
  assert.equal(nightlyEats(fixedState({ party: [] })), 1, "empty party array agrees with no party field");
  const noPartyField = fixedState();
  delete noPartyField.party;
  assert.equal(nightlyEats(noPartyField), 1, "a missing party field agrees too");
});

test("nightlyEats: every live member adds its race appetite; a member with an unknown race counts as 1", () => {
  assert.equal(nightlyEats(fixedState({ party: [member({ race: "Human" })] })), 2, "Human + Human member = 2");
  assert.equal(nightlyEats(fixedState({ party: [member({ race: "Troll" })] })), 3, "Human + Troll member = 3");
  assert.equal(nightlyEats(fixedState({ party: [member({ race: "Nonesuch" })] })), 2, "unknown race defaults to 1");
});

test("makeCamp DFB-06: a Troll with 1 ration is refused with need 2 have 1, drawing nothing and changing nothing", () => {
  const state = fixedState({ c: { race: "Troll", rations: 1, wp: 40 } });
  const events = makeCamp(state, fakeRng([]), []);
  assert.deepStrictEqual(
    events.find((e) => e.type === "campFailed"),
    { type: "campFailed", reason: "noRations", need: 2, have: 1 },
    "exact solo shape — no members key",
  );
  assert.equal(state.day, 1, "no day advanced");
  assert.equal(state.c.rations, 1, "rations unchanged");
  assert.equal(state.c.wp, 40, "wp unchanged");
});

test("makeCamp DFB-06: a Troll with exactly 2 rations camps (strict less-than) and eats both", () => {
  const state = fixedState({ c: { race: "Troll", rations: 2 } });
  const rng = fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]); // heal roll + 8 safe monster-check draws
  const events = makeCamp(state, rng, []);
  assert.equal(state.day, 2);
  assert.equal(state.c.rations, 0);
  assert.ok(!events.some((e) => e.type === "campFailed"));
});

test("makeCamp DFB-06: a Human hero with a Human member and 1 ration is refused with need 2 have 1 and names the member", () => {
  const state = fixedState({ c: { rations: 1 }, party: [member({ name: "Bram", race: "Human" })] });
  const partyBefore = state.party.slice();
  const events = makeCamp(state, fakeRng([]), []);
  const failed = events.find((e) => e.type === "campFailed");
  assert.equal(failed.need, 2);
  assert.equal(failed.have, 1);
  assert.deepStrictEqual(failed.members, [{ name: "Bram", eats: 1 }]);
  assert.deepStrictEqual(state.party, partyBefore, "party untouched");
});

test("makeCamp DFB-06: a solo Human with 1 ration still camps (the gate is unchanged for solo heroes)", () => {
  const state = fixedState({ c: { rations: 1 } });
  const rng = fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]);
  const events = makeCamp(state, rng, []);
  assert.equal(state.day, 2);
  assert.equal(state.c.rations, 0);
  assert.ok(!events.some((e) => e.type === "campFailed"));
});

test("makeCamp DFB-06: zero rations refuses with have 0", () => {
  const state = fixedState({ c: { rations: 0 } });
  const events = makeCamp(state, fakeRng([]), []);
  const failed = events.find((e) => e.type === "campFailed");
  assert.equal(failed.have, 0);
  assert.equal(failed.need, 1);
});

test("newDay DFB-06: the rations delta equals nightlyEats(state) for solo and for hero + member (arithmetic unchanged)", () => {
  for (const overrides of [{ c: { rations: 6 } }, { c: { rations: 6 }, party: [member({ race: "Troll" })] }]) {
    const state = fixedState(overrides);
    const before = state.c.rations;
    const need = nightlyEats(state);
    newDay(state, false, fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]), []);
    assert.equal(before - state.c.rations, need, `${JSON.stringify(overrides)}: rations delta equals nightlyEats`);
  }
});

test("campFailed narration and toast render the numbers and the member clause", () => {
  const withMember = EVENT_NARRATION.campFailed({
    type: "campFailed",
    reason: "noRations",
    need: 2,
    have: 1,
    members: [{ name: "Bram", eats: 1 }],
  }).replace(/<[^>]+>/g, "");
  assert.equal(withMember, "You eat 2 a night (Bram eats 1 more). You have 1. Find rations first.");

  const solo = EVENT_NARRATION.campFailed({ type: "campFailed", need: 2, have: 1 }).replace(/<[^>]+>/g, "");
  assert.equal(solo, "You eat 2 a night. You have 1. Find rations first.");

  const toast = LINE_FOR.campFailed({ type: "campFailed", need: 2, have: 1 });
  assert.equal(toast.tone, "block");
  assert.ok(toast.text.includes("2") && toast.text.includes("1"));

  const bare = LINE_FOR.campFailed({ type: "campFailed" });
  assert.equal(bare.tone, "block");
  assert.ok(typeof bare.text === "string" && bare.text.length > 0);
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
