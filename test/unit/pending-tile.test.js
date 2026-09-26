// test/unit/pending-tile.test.js
//
// RULES-12 (Phase 75, user 2026-09-25, DECLARED CANON DIVERGENCE): a
// newDay wandering-monster check can interrupt the very step that would
// have dispatched the destination cell's feature (dot/trap/chest/tele/exit/
// gate). `state.pendingTile = { x, y, depth }` records it; `resolveFeature`
// is the ONE feature dispatch `move()` and `resolvePendingTile` both call;
// `resolvePendingTile` (wired into `engine/engine.js#applyAction` after
// every dispatched action) finishes the job once the fight — and any
// spoils/find/store it leaves open — is settled and the hero is still
// standing on the tile.
//
// Two tiers of coverage:
//   A) an end-to-end proof that a REAL wandering-monster check (scripted
//      through move()/newDay()/startCombat()) actually sets pendingTile,
//      and that an ordinary (no-wanderer) step resolves a feature exactly
//      as it always has (no pendingTile, no tileResumed).
//   B) direct unit coverage of resolvePendingTile's own dispatch contract
//      (wait/clear/resolve), built on hand-constructed state — legitimate
//      because resolvePendingTile's behavior depends only on
//      state.pendingTile/combat/pendingLoot/pendingFind/store/dead/floor,
//      never on HOW those fields got that way.

import test from "node:test";
import assert from "node:assert/strict";

import { move, resolveFeature, resolvePendingTile } from "../../engine/movement.js";
import { newRun, applyAction } from "../../engine/engine.js";
import { validateSave, rehydrate } from "../../engine/saveState.js";
import { afterPlayerAction, flee } from "../../engine/combat.js";
import { GW, GH } from "../../engine/maze.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

/** fakeRng(seq) — pops `.d()` values off `seq` in order; throws on
 * underflow. `.pick` always returns `arr[0]`. */
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

/** A generous tail of low-but-valid draws so a multi-draw dispatch (chest's
 * gainWilmst/scroll/rollTreasureItem chain) never underflows a hand-built
 * sequence — this file never asserts on those draws' own results. */
function withTail(seq, tailLen = 40) {
  return [...seq, ...Array(tailLen).fill(3)];
}

function openGrid() {
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
    floor: { g: openGrid(), px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    pendingTile: null, pendingLoot: [], pendingFind: null, pendingHazard: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

// --- A) end-to-end: a real wandering-monster check sets pendingTile -------

test("move: a wandering monster interrupting a day-boundary step onto a chest sets pendingTile and leaves the chest on the tile", () => {
  const state = fixedState({ steps: 99 });
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 4, { feat: "chest" });
  // heal d10=5, then 8 wander checks (first hits: roll 1 < wakeOn(1)+1=2;
  // the rest quiet), then startCombat's own single tier-check d4 draw.
  const rng = fakeRng([5, 1, 2, 2, 2, 2, 2, 2, 2, 3]);
  const events = move(state, "N", rng, []);
  assert.equal(state.floor.py, 4, "the step itself still happened");
  assert.ok(state.combat, "the wandering monster started a fight");
  assert.ok(events.some((e) => e.type === "wanderingMonster"));
  assert.ok(events.some((e) => e.type === "encounterStarted"));
  assert.deepStrictEqual(state.pendingTile, { x: 5, y: 4, depth: 1 });
  assert.equal(state.floor.g[4][5].feat, "chest", "the chest is still there, untouched");
  assert.ok(!events.some((e) => e.type === "tileResumed"), "not resolved yet — the fight just started");
});

test("move: the same day-boundary step with the wanderer quiet resolves the chest exactly as an ordinary step would (no pendingTile)", () => {
  const state = fixedState({ steps: 99 });
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 4, { feat: "chest" });
  // heal d10=5, then 8 quiet wander checks (all >= 2), then the chest's own
  // dispatch — the lock-roll reads roll-high THROUGH rollCheck (which
  // mirrors the raw draw: `roll = dieN + 1 - raw`), so a LOW raw draw (1)
  // guarantees a HIGH roll and opens the chest; a generous filler tail
  // covers its further gainWilmst/scroll/treasure draws.
  const rng = fakeRng(withTail([5, 2, 2, 2, 2, 2, 2, 2, 2, 1]));
  const events = move(state, "N", rng, []);
  assert.equal(state.combat, null, "no wanderer this time");
  assert.equal(state.pendingTile, null);
  assert.equal(state.floor.g[4][5].feat, null, "the chest resolved via move()'s own ordinary dispatch");
  assert.ok(events.some((e) => e.type.startsWith("chest")));
  assert.ok(!events.some((e) => e.type === "tileResumed"));
});

test("newRun(seed) starts with pendingTile: null", () => {
  const state = newRun(1);
  assert.equal(state.pendingTile, null);
});

// --- A2) determinism: replaying the same script twice is identical --------

test("determinism: replaying the exact same scripted wanderer-onto-a-chest step twice from independent clones gives identical events and state", () => {
  function run() {
    const state = fixedState({ steps: 99 });
    open(state.floor.g, 5, 5);
    open(state.floor.g, 5, 4, { feat: "chest" });
    const rng = fakeRng([5, 1, 2, 2, 2, 2, 2, 2, 2, 3]);
    const events = move(state, "N", rng, []);
    return { state, events };
  }
  const a = run();
  const b = run();
  assert.deepStrictEqual(a.events, b.events);
  assert.deepStrictEqual(a.state, b.state);
});

// --- B) resolvePendingTile's own dispatch contract -------------------------

/** A minimal combat object with exactly one live foe with no `sp.pursues`
 * (so flee's pursuitStrike is a zero-draw no-op) and no `abilities` kit. */
function liveCombat() {
  return { foes: [{ name: "Bat/Rat", type: "Beasts", lvl: 1, wp: 5, maxWP: 5, alive: true, sp: {} }], type: "Beasts", round: 1, target: 0, pending: false };
}

/** pendingTileState(overrides) — a fixedState() whose hero is standing
 * exactly on (5, 4) (`state.floor.px/py`), matching `state.pendingTile`'s own
 * `{x: 5, y: 4, depth: 1}` — the "hero still on the tile" precondition
 * resolvePendingTile itself checks. A test that wants to prove the OPPOSITE
 * (walked off, a different floor) overrides `state.floor.px/py/depth`
 * directly after construction. */
function pendingTileState(overrides = {}) {
  const { floor: floorOverrides, ...rest } = overrides;
  const state = fixedState({ floor: { px: 5, py: 4, ...floorOverrides }, ...rest });
  state.pendingTile = { x: 5, y: 4, depth: 1 };
  return state;
}

test("resolvePendingTile: a no-op when nothing is pending", () => {
  const state = fixedState();
  const events = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.equal(state.pendingTile, null);
});

test("resolvePendingTile: waits while combat is still open", () => {
  const state = pendingTileState({ combat: liveCombat() });
  open(state.floor.g, 5, 4, { feat: "chest" });
  const events = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.ok(state.pendingTile, "still pending — combat is open");
});

test("resolvePendingTile: waits while a spoils pile is still open", () => {
  const state = pendingTileState({ pendingLoot: [{ kind: "jewel", n: "A" }] });
  open(state.floor.g, 5, 4, { feat: "chest" });
  const events = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.ok(state.pendingTile, "still pending — a spoils pile is open");
});

test("resolvePendingTile: waits while a pending find is open", () => {
  const state = pendingTileState({ pendingFind: { n: "A cloak", kind: "armor" } });
  open(state.floor.g, 5, 4, { feat: "chest" });
  const events = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.ok(state.pendingTile, "still pending — a find prompt is open");
});

test("resolvePendingTile: waits while a store is open", () => {
  const state = pendingTileState({ store: { stock: [] } });
  open(state.floor.g, 5, 4, { feat: "chest" });
  const events = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.ok(state.pendingTile, "still pending — a store is open");
});

test("resolvePendingTile: clears (with no event) when the hero died — the feature stays untouched", () => {
  const state = pendingTileState({ dead: true });
  open(state.floor.g, 5, 4, { feat: "chest" });
  const events = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.equal(state.pendingTile, null);
  assert.equal(state.floor.g[4][5].feat, "chest", "the feature is untouched");
});

test("resolvePendingTile: resolves a chest — pushes tileResumed then the chest's own dispatch, and clears pendingTile", () => {
  const state = pendingTileState();
  open(state.floor.g, 5, 4, { feat: "chest" });
  // the lock-roll reads roll-high through rollCheck (`roll = dieN + 1 -
  // raw`) — a low raw draw (1) guarantees a high roll and opens the chest.
  const events = resolvePendingTile(state, fakeRng(withTail([1])), []);
  assert.equal(state.pendingTile, null);
  assert.equal(events[0].type, "tileResumed");
  assert.equal(events[0].feat, "chest");
  assert.ok(events.some((e) => e.type.startsWith("chest")), "the chest's own event follows");
  assert.equal(state.floor.g[4][5].feat, null, "the chest is gone");
});

test("resolvePendingTile: resolves a trap — the trap springs after the fight", () => {
  const state = pendingTileState();
  open(state.floor.g, 5, 4, { feat: "trap" });
  // trapAvoided's dodge check reads roll-high through rollCheck too — a
  // low raw draw (1) guarantees a high roll and a dodge, drawing exactly
  // one die (no filler needed).
  const events = resolvePendingTile(state, fakeRng([1]), []);
  assert.equal(state.pendingTile, null);
  assert.equal(events[0].type, "tileResumed");
  assert.equal(events[0].feat, "trap");
  assert.ok(events.some((e) => e.type === "trapAvoided" || e.type === "trapSprung"));
  assert.equal(state.floor.g[4][5].feat, null, "the trap is gone either way");
});

test("resolvePendingTile: never fires twice for the same tile", () => {
  const state = pendingTileState();
  open(state.floor.g, 5, 4, { feat: "chest" });
  resolvePendingTile(state, fakeRng(withTail([1])), []);
  assert.equal(state.pendingTile, null);
  const second = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(second, [], "a second call with nothing pending is a pure no-op");
});

test("resolvePendingTile: the hero walked off before it resolved — pendingTile clears, the feature stays for later", () => {
  const state = pendingTileState();
  open(state.floor.g, 5, 4, { feat: "chest" });
  // the hero has since moved to a different cell entirely
  state.floor.px = 9;
  state.floor.py = 9;
  const events = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.equal(state.pendingTile, null, "clears — it will never resolve this way again");
  assert.equal(state.floor.g[4][5].feat, "chest", "the feature stays on the map for a genuine future step");
});

test("resolvePendingTile: the hero descended to a different floor — clears without resolving", () => {
  const state = pendingTileState();
  open(state.floor.g, 5, 4, { feat: "chest" });
  state.floor.depth = 2; // a fresh floor object; px/py happen to coincide
  const events = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.equal(state.pendingTile, null);
});

test("resolvePendingTile: the feature was somehow already cleared — clears without resolving, no tileResumed", () => {
  const state = pendingTileState();
  open(state.floor.g, 5, 4, { feat: null });
  const events = resolvePendingTile(state, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
  assert.equal(state.pendingTile, null);
});

// --- B2) stepping back onto a walked-away tile resolves it normally -------

test("move: stepping back onto a tile whose pendingTile already cleared resolves the feature normally (an ordinary step, not a resume)", () => {
  const state = fixedState();
  open(state.floor.g, 5, 5);
  open(state.floor.g, 5, 4, { feat: "trap" });
  const events = move(state, "N", fakeRng([1]), []); // guaranteed dodge (low raw draw = high mirrored roll)
  assert.equal(state.pendingTile, null);
  assert.ok(events.some((e) => e.type === "trapAvoided"));
  assert.equal(state.floor.g[4][5].feat, null);
});

// --- B3) win/flee/spoils, driven with the real combat functions -----------

test("afterPlayerAction ending the fight (no spoils) resolves the pending chest in the SAME step — pushes tileResumed then the chest's dispatch", () => {
  const state = pendingTileState({ combat: liveCombat() });
  open(state.floor.g, 5, 4, { feat: "chest" });
  state.combat.foes[0].alive = false; // the kill already happened
  const events = [];
  afterPlayerAction(state, fakeRng([]), events);
  assert.ok(events.some((e) => e.type === "encounterCleared"));
  assert.equal(state.combat, null, "endCombat ran");
  // The engine.js hook calls resolvePendingTile right after the dispatch —
  // reproduced by hand here since this test drives combat.js directly. The
  // chest's lock-roll mirrors its raw draw (rollCheck), so 1 opens it.
  resolvePendingTile(state, fakeRng(withTail([1])), events);
  assert.ok(events.some((e) => e.type === "tileResumed" && e.feat === "chest"));
  assert.equal(state.pendingTile, null);
  assert.equal(state.floor.g[4][5].feat, null);
});

test("a spoils pile pending after the win waits; emptying it resolves the tile", () => {
  const state = pendingTileState({ combat: liveCombat(), pendingLoot: [{ kind: "jewel", n: "A" }] });
  open(state.floor.g, 5, 4, { feat: "chest" });
  state.combat.foes[0].alive = false;
  const events = [];
  afterPlayerAction(state, fakeRng([]), events);
  assert.equal(state.combat, null);
  // still waits — the pile is open
  resolvePendingTile(state, fakeRng([]), events);
  assert.ok(state.pendingTile, "still pending — the spoils pile is open");
  assert.ok(!events.some((e) => e.type === "tileResumed"));
  // takeAllLoot/leaveAllLoot empties the pile — simulate the empty result directly
  state.pendingLoot = [];
  resolvePendingTile(state, fakeRng(withTail([1])), events);
  assert.equal(state.pendingTile, null);
  assert.ok(events.some((e) => e.type === "tileResumed" && e.feat === "chest"));
});

test("flee resolves the tile after the flee (flee never moves the hero)", () => {
  const state = pendingTileState({ combat: liveCombat() });
  state.combat.pending = false;
  open(state.floor.g, 5, 4, { feat: "chest" });
  const events = [];
  flee(state, fakeRng([20]), events); // guaranteed flee success — flee's own d20 IS the roll (already-high, no rollCheck mirror)
  assert.ok(events.some((e) => e.type === "fled"));
  assert.equal(state.combat, null, "endCombat ran inside flee's success exit");
  assert.equal(state.floor.px, 5, "flee never moves the hero");
  assert.equal(state.floor.py, 4, "flee never moves the hero");
  resolvePendingTile(state, fakeRng(withTail([1])), events); // the chest's own lock-roll mirrors via rollCheck — 1 opens it
  assert.ok(events.some((e) => e.type === "tileResumed" && e.feat === "chest"));
  assert.equal(state.pendingTile, null);
});

test("the hero dies in the fight: pendingTile clears, the feature is untouched — no tileResumed", () => {
  const state = pendingTileState({ combat: liveCombat() });
  open(state.floor.g, 5, 4, { feat: "chest" });
  // simulate a lethal foe turn: the hero's own death path always sets
  // state.dead/state.combat via engine/death.js#die, reproduced minimally
  // here (die() itself is exercised at length elsewhere).
  state.dead = true;
  state.combat = null;
  const events = [];
  resolvePendingTile(state, fakeRng([]), events);
  assert.deepStrictEqual(events, []);
  assert.equal(state.pendingTile, null);
  assert.equal(state.floor.g[4][5].feat, "chest");
});

// --- C) resolveFeature is the ONE dispatch, used identically by both -------

test("resolveFeature dispatches every feature type move()'s own tail always has, and is a no-op with no feature", () => {
  const state = fixedState();
  const chestCell = { wall: false, feat: "chest" };
  resolveFeature(state, chestCell, fakeRng(withTail([1])), []); // rollCheck mirrors — 1 opens it
  assert.equal(chestCell.feat, null);

  const trapCell = { wall: false, feat: "trap" };
  resolveFeature(state, trapCell, fakeRng([1]), []); // rollCheck mirrors — 1 dodges it
  assert.equal(trapCell.feat, null);

  const plainCell = { wall: false, feat: null };
  const events = resolveFeature(state, plainCell, fakeRng([]), []);
  assert.deepStrictEqual(events, []);
});

// --- D) save/load: pendingTile is transient, reset to null on load --------

test("validateSave/rehydrate always reset a saved pendingTile to null", () => {
  const state = newRun(1);
  state.pendingTile = { x: 3, y: 3, depth: 1 };
  const saved = JSON.parse(JSON.stringify(state));

  const validated = validateSave(saved);
  assert.ok(validated.ok);
  assert.equal(validated.value.pendingTile, null);

  const rehydrated = rehydrate(saved);
  assert.equal(rehydrated.pendingTile, null);
});

// --- E) engine.js wiring: applyAction calls resolvePendingTile after EVERY dispatch ---

test("applyAction resolves a pending tile once every guard clears, without a dedicated action for it", () => {
  let state = newRun(1);
  state.pendingTile = { x: state.floor.px, y: state.floor.py, depth: state.floor.depth };
  const cell = state.floor.g[state.floor.py][state.floor.px];
  cell.feat = "chest";
  // Any validated action still runs the post-dispatch hook, even one that
  // is itself a pure no-op against this fresh run's state — "leaveFind"
  // touches nothing but state.pendingFind (already null) and draws no rng,
  // so it can never itself start a fight or otherwise interfere with the
  // pending tile's own resolution.
  const result = applyAction(state, { type: "leaveFind" });
  assert.equal(result.state.pendingTile, null, "resolved on the very next dispatched action");
  assert.ok(result.events.some((e) => e.type === "tileResumed" && e.feat === "chest"));
});
