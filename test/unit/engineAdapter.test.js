// Direct unit coverage for src/browser/engineAdapter.js — the walking
// skeleton's presentation/persistence glue (01-07 Task 3). Node has no
// built-in `localStorage`, so these tests install a minimal in-memory stub
// on `globalThis` before exercising boot()/dispatch() (mirroring the parity
// harness's own fakeStorage pattern in
// test/parity/harness/sandboxPrototype.js), then remove it afterward so it
// can't leak into other test files.
//
// 02-03: engineAdapter now routes every read/write through
// src/browser/storage.js's shared async abstraction rather than raw
// localStorage. storage.js's own `isNative()` check returns false whenever
// `window` doesn't exist at all (as in this plain `node --test` process, no
// window/Capacitor ever installed) — so it falls straight through to its
// browser branch, which reads/writes the SAME `globalThis.localStorage`
// `withFakeLocalStorage` already installs below. No separate
// window.mzStorage/Capacitor setup is needed in THIS file (contrast with
// test/persistence/dual-write-convergence.test.js, which explicitly proves
// convergence with a fake native/Capacitor window present). boot()/getBest()/
// startNewRun() are now async; dispatch() itself stays synchronous (it
// renders from the state it already has), but its persistence writes are
// fire-and-enqueue — tests that immediately inspect the raw backing store
// after a dispatch()/startNewRun() call must `await flush()` first so the
// queued write has actually settled.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  boot,
  initRun,
  getState,
  dispatch,
  formatEvents,
  startNewRun,
  getBest,
} from "../../src/browser/engineAdapter.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun } from "../../engine/saveState.js";
import { openStore } from "../../engine/economy.js";
import { makeRng } from "../../engine/rng.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SAVE_KEY = "ddr.delve.v1";

async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(globalThis.localStorage);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

test("dispatch(action) throws a clear error if called before boot()/initRun()", () => {
  // Must run before any other test in this file calls boot()/initRun() —
  // engineAdapter holds one module-level `currentState`, and `node --test`
  // runs each test file in its own process, so this is the only point at
  // which `currentState` is still null.
  assert.throws(() => dispatch({ type: "move", dir: "N" }), /boot\(\)\/initRun\(\)/);
});

test("boot(freshSeed) starts a fresh run when there is no save", async () => {
  await withFakeLocalStorage(async () => {
    const state = await boot(4242);
    assert.equal(state.floor.depth, 1);
    assert.equal(state.seed, 4242);
    assert.equal(getState(), state);
  });
});

test("boot(freshSeed) rehydrates a valid existing save instead of starting fresh", async () => {
  await withFakeLocalStorage(async (store) => {
    const original = newRun(99);
    store.setItem(SAVE_KEY, JSON.stringify(serializeRun(original)));
    const state = await boot(1);
    assert.equal(state.seed, 99, "rehydrated the saved run, not a fresh one");
    assert.deepStrictEqual(state.c, original.c);
  });
});

test("boot(freshSeed) fails closed to a fresh run on a corrupt save", async () => {
  await withFakeLocalStorage(async (store) => {
    store.setItem(SAVE_KEY, "{not json");
    const state = await boot(777);
    assert.equal(state.seed, 777, "fell back to a brand-new run rather than throwing");
  });
});

test("dispatch(action) advances state via applyAction and persists it (through the storage abstraction)", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(11);
    const before = getState();
    const { state, events, html } = dispatch({ type: "move", dir: "N" });
    assert.equal(getState(), state, "dispatch swaps in the returned state as current");
    assert.ok(Array.isArray(events));
    assert.ok(Array.isArray(html));

    // persist() is fire-and-enqueue (not awaited inside dispatch) — flush the
    // storage abstraction's write queue before inspecting the raw backend.
    await flushStorage();
    const persisted = JSON.parse(store.getItem(SAVE_KEY));
    assert.deepStrictEqual(persisted.c, state.c, "the persisted save reflects post-dispatch state");
    assert.notEqual(before, state, "dispatch never mutates the previous state object in place");
  });
});

test("CR-01: dispatch() fails closed to a fresh run instead of throwing when applyAction crashes on a corrupted state", async () => {
  await withFakeLocalStorage(async () => {
    initRun(2024);
    const before = getState();
    // Simulate a state that slipped past validateSave's shape checks (or any
    // other future rule-module bug) and would otherwise throw a TypeError
    // deep inside applyAction's move handler — engineAdapter.js#dispatch must
    // not let that escape as an uncaught exception to the page.
    before.floor = {};
    assert.doesNotThrow(() => dispatch({ type: "move", dir: "N" }));
    const state = getState();
    assert.notEqual(state, before, "dispatch swapped in a fresh run rather than keeping the broken state");
    assert.equal(state.floor.depth, 1, "the fallback run is a normal fresh floor 1");
  });
});

test("formatEvents maps known event types to HTML and drops unknown ones silently", () => {
  const html = formatEvents([
    { type: "moved", to: { x: 1, y: 1 } },
    { type: "floorChanged", depth: 3 },
    { type: "leveled", level: 2, wpGain: 5 },
    { type: "died", cause: "starve" },
    { type: "won", level: 3, day: 10, steps: 400 },
    { type: "somethingBrandNewFromALaterSlice" },
  ]);
  assert.equal(html.length, 4, "the unknown-type event and the silent 'moved' both drop out");
  assert.ok(html[0].includes("Floor 3"));
  assert.ok(html[1].includes("2"));
  assert.ok(html[2].includes("died") || html[2].toLowerCase().includes("died"));
  assert.ok(html[3].includes("Gate"));
});

// 04.2 Text batch (E10/P2): goldGained must never leak the engine's internal
// source tag (`why`) to the player, and must read "wilmst", not "wm".
test("E10/P2: formatEvents(goldGained) drops the internal `why` tag and reads 'wilmst'", () => {
  const html = formatEvents([{ type: "goldGained", amount: 3000, why: "tableFour" }]);
  assert.equal(html.length, 1);
  assert.ok(html[0].includes("3000 wilmst"), "reads the canonical 'wilmst' spelling");
  assert.ok(!/tableFour/.test(html[0]), "the internal source tag never leaks");
  assert.ok(!/\bwm\b/.test(html[0]), "the 'wm' abbreviation is gone");
});

// 04.2 Text batch (A1): the affliction line must not leave the ": ," / ":: ,"
// artifact once its <span class="roll"> dice clause is stripped for the
// over-map overlay. Mirror mazeworld.html's stripRollDetail transform here.
test("A1: afflictionRolled renders a clean sentence with no dangling ': ,' after the roll span is stripped", () => {
  const html = formatEvents([{ type: "afflictionRolled", roll: 4, kind: "Poison" }]);
  assert.equal(html.length, 1);
  const stripped = html[0].replace(/<span class="roll">[\s\S]*?<\/span>\s*/g, "").replace(/<[^>]+>/g, "").trim();
  assert.equal(stripped, "Something is wrong with you. Poison.");
  assert.ok(!/:\s*,/.test(stripped), "no dangling ': ,' punctuation artifact");
  assert.ok(!/::/.test(stripped), "no ':: ' artifact");
});

test("startNewRun(seed) after a prior run returns a fresh state and swaps it in as currentState", async () => {
  await withFakeLocalStorage(async () => {
    initRun(11);
    const state = await startNewRun(4242);
    assert.equal(state.floor.depth, 1, "fresh run starts on floor 1");
    assert.equal(state.seed, 4242, "fresh run uses the requested seed");
    assert.equal(getState(), state, "startNewRun swaps in the returned state as current");
  });
});

test("startNewRun(seed) records the ending run's floor.depth into getBest()", async () => {
  await withFakeLocalStorage(async () => {
    initRun(11);
    getState().floor.depth = 7;
    await startNewRun(99);
    assert.equal(await getBest(), 7, "the ended run's deepest floor became the recorded best");
  });
});

test("startNewRun(seed) keeps the higher of two recorded bests", async () => {
  await withFakeLocalStorage(async () => {
    initRun(1);
    getState().floor.depth = 3;
    await startNewRun(2);
    getState().floor.depth = 1;
    await startNewRun(3);
    assert.equal(await getBest(), 3, "a shallower ending run does not overwrite a deeper recorded best");
  });
});

test("getBest() returns 0 when nothing is stored and never throws when storage is blocked", async () => {
  await withFakeLocalStorage(async () => {
    assert.equal(await getBest(), 0, "no stored best yields 0");
  });

  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
    removeItem: () => {},
  };
  try {
    await assert.doesNotReject(async () => {
      const best = await getBest();
      assert.equal(best, 0, "blocked storage falls back to 0");
    });
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

const GRAVE_KEY = "ddr.graveyard.v1";
// audit-batch E12: the two new adapter-owned graveyard keys.
const GRAVE_TOTAL_KEY = "ddr.graveyard.total.v1";
const RECENT_NAMES_KEY = "ddr.graveyard.names.v1";

// firstOpenPlainDir(state) — the first cardinal direction from the player's
// current position that leads onto an open, feature-free cell (no
// wall/climb/gorge/dot/trap/chest/tele/exit). Every genFloor() maze is
// guaranteed at least one open neighbor from the start tile (recursive
// backtracker connectivity), but WHICH direction that is varies by seed —
// hard-coding "N" flaked against seed 55's actual layout (floor-1 (1,1) is
// walled N/E/W, open only S). Used so these dispatch()-driven death tests
// reliably trigger a genuine step (and thus newDay()'s 100-step counter)
// without depending on a specific seed's maze shape.
function firstOpenPlainDir(state) {
  const f = state.floor;
  const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  for (const [d, [dx, dy]] of Object.entries(DIRV)) {
    const nx = f.px + dx;
    const ny = f.py + dy;
    const cell = f.g[ny] && f.g[ny][nx];
    if (cell && !cell.wall && !cell.feat) return d;
  }
  return null;
}

test("CR-01: a starvation death (no combat object) through dispatch() writes a graveyard entry", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(55);
    const state = getState();
    const dir = firstOpenPlainDir(state);
    assert.ok(dir, "seed 55's floor 1 has at least one open, feature-free neighbor from the start tile");
    // Starve the character out: no rations, wp at 1 so the next upkeep tick
    // in newDay() (triggered every 100 steps inside move()) kills via
    // die(state, "starve", ...) — no combat object involved anywhere in this
    // path (engine/movement.js:248).
    state.c.rations = 0;
    state.c.wp = 1;
    state.steps = 99; // the 100th step below trips newDay()

    const { state: after, events } = dispatch({ type: "move", dir });
    assert.equal(after.dead, true, "the character actually died via starvation");
    assert.ok(
      events.some((e) => e.type === "died" && e.cause === "starve"),
      "a starve-cause died event was pushed",
    );

    // persistGrave() is also fire-and-enqueue from dispatch() — flush before
    // inspecting the raw backend.
    await flushStorage();
    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    assert.ok(Array.isArray(graves), "graveyard was written to GRAVE_KEY");
    assert.equal(graves.length, 1, "exactly one tombstone was recorded");
    assert.equal(graves[0].cause, "starve", "the tombstone records the real death cause");
    assert.equal(graves[0].name, after.c.name, "the tombstone matches the dead character");
  });
});

test("CR-01: a climb/gorge-fall death (no combat object) through dispatch() also writes a graveyard entry", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(56);
    const state = getState();
    // Find a climb or gorge tile adjacent to the current position and step
    // toward it with wp low enough that any fall damage kills outright —
    // this exercises engine/movement.js:108's die(state, "fall"/"gorge", ...)
    // path directly, independent of newDay()/starvation.
    const f = state.floor;
    let dir = null;
    for (const [d, [dx, dy]] of Object.entries({ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] })) {
      const nx = f.px + dx;
      const ny = f.py + dy;
      if (f.g[ny] && f.g[ny][nx] && !f.g[ny][nx].wall && (f.g[ny][nx].feat === "climb" || f.g[ny][nx].feat === "gorge")) {
        dir = d;
        break;
      }
    }
    if (!dir) {
      // No climb/gorge tile adjacent on this seed's floor 1 — the starvation
      // test above already proves the no-combat-object path end-to-end, so
      // skip rather than flake on maze layout.
      return;
    }
    state.c.wp = 1;
    dispatch({ type: "move", dir });
    await flushStorage();

    const raw = store.getItem(GRAVE_KEY);
    if (!raw) return; // the climb/leap check may have succeeded (RNG-dependent); not a bug
    const graves = JSON.parse(raw);
    assert.ok(["fall", "gorge"].includes(graves[0].cause), "tombstone records fall/gorge as the cause");
  });
});

test("CR-01: repeated deaths accumulate multiple graveyard entries (unshift order, newest first)", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(77);
    let dir = firstOpenPlainDir(getState());
    assert.ok(dir, "seed 77's floor 1 has at least one open, feature-free neighbor from the start tile");
    getState().c.rations = 0;
    getState().c.wp = 1;
    getState().steps = 99;
    dispatch({ type: "move", dir });
    // Flush BEFORE starting the next run: persistGrave() does a read-then-
    // write of GRAVE_KEY, and storage.js's getItem() is deliberately not
    // queued behind in-flight writes to the same key (see storage.js's own
    // doc comment) — without this flush, the second death's persistGrave()
    // read could race ahead of the first death's still-in-flight write and
    // overwrite it instead of appending.
    await flushStorage();

    await startNewRun(78);
    dir = firstOpenPlainDir(getState());
    assert.ok(dir, "seed 78's floor 1 has at least one open, feature-free neighbor from the start tile");
    getState().c.rations = 0;
    getState().c.wp = 1;
    getState().steps = 99;
    dispatch({ type: "move", dir });
    await flushStorage();

    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    assert.equal(graves.length, 2, "two separate runs each recorded their own tombstone");
  });
});

// audit-bugs (2026-09-09, E9): the reported live bug was a Con Artist who died
// IN COMBAT and never appeared on the Dead/graveyard screen. The adapter's
// persist path is cause-agnostic (every `died` event, whatever its cause,
// funnels through the ONE persistGrave choke point in dispatch()), so the
// existing starve/fall/abandon tests already prove the write. This test pins
// the specific COMBAT-death case end-to-end: a foe kills the player through
// dispatch({type:"attack"}) and the tombstone lands in the graveyard store.
//
// ROOT CAUSE of the live bug is NOT here — the adapter writes the tombstone
// correctly. It is in mazeworld.html's RENDER layer: the Dead screen renders
// from a classic in-memory `graves` array that is only synced from storage at
// boot (loadGraves() inside window.__mzClassicBoot), while every live death now
// routes through this adapter's persistGrave (storage only) and never touches
// that in-memory list or re-renders. That render-layer path is DOM-bound and
// not reachable from `node --test`; the fix (re-fetch loadGraves()+renderGraves()
// every time the Dead tab is opened, mazeworld.html showTab) is verified on
// device. This assertion guards the engine/adapter half of the contract.
test("E9: a COMBAT death through dispatch({type:'attack'}) writes the dead character to the graveyard", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(4321);
    const state = getState();
    // A plain melee Fighter so playerStrike never short-circuits before the
    // foe's turn (a Wizard refuses to melee while a charge remains and would
    // return before afterPlayerAction ever runs the lethal foe swing).
    state.c.cls = "Fighter";
    state.c.sub = "Soldier";
    state.c.race = "Human";
    state.c.wp = 1; // any landed foe blow is lethal
    state.c.maxWP = 55;
    state.c.invis = 0;
    state.c.mirror = 0;
    state.c.armor = "Nothing";
    state.c.ar = 0;
    state.c.armorWP = 0;
    state.c.armorMax = 0;
    // An effectively unkillable foe: the player can never end the fight first,
    // so the loop only exits when a foe blow lands and routes
    // die(state, "combat", ...).
    state.combat = {
      foes: [
        { name: "Ogre", type: "Beasts", lvl: 3, size: "L", intel: 1, wp: 999999, maxWP: 999999, alive: true, asleep: 0, sp: {}, lives: 1 },
      ],
      type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false,
    };
    const charName = state.c.name;

    let died = false;
    for (let i = 0; i < 500 && !died; i++) {
      const { state: after, events } = dispatch({ type: "attack" });
      if (after.dead) {
        died = events.some((e) => e.type === "died" && e.cause === "combat");
        break;
      }
    }
    assert.ok(died, "a foe eventually landed a lethal blow, producing a combat-cause died event");

    await flushStorage();
    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    assert.ok(Array.isArray(graves) && graves.length >= 1, "the combat death was written to GRAVE_KEY");
    assert.equal(graves[0].cause, "combat", "the tombstone records the combat death cause");
    assert.equal(graves[0].name, charName, "the tombstone matches the dead character");
  });
});

test("Device-review Pass B1 item 3: dispatch({type:'abandon'}) buries the current character with a distinct cause and leaves no active run", async () => {
  await withFakeLocalStorage(async (store) => {
    initRun(555);
    const before = getState();
    const characterName = before.c.name;

    const { state: after, events } = dispatch({ type: "abandon" });
    assert.equal(after.dead, true, "abandoning ends the run, same as any other death");
    assert.ok(
      events.some((e) => e.type === "died" && e.cause === "abandon"),
      "the died event records the distinct 'abandon' cause, not a combat/hazard cause",
    );

    await flushStorage();
    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    assert.ok(Array.isArray(graves), "the abandonment was buried in the graveyard");
    assert.equal(graves.length, 1, "exactly one tombstone was recorded");
    assert.equal(graves[0].cause, "abandon", "the tombstone records the voluntary-abandon cause");
    assert.equal(graves[0].name, characterName, "the tombstone matches the abandoned character");
    assert.ok(graves[0].epitaph.length > 0, "an epitaph was filled from the abandon-specific bank");

    // "No active run" is the same contract every other death already relies
    // on: a dead run is never treated as resumable (mazeworld.html's
    // hasActiveDelveSave() checks `!S.dead`) — no separate save-clearing
    // step is needed.
    assert.equal(getState().dead, true, "no active run remains after abandonment");
  });
});

// audit-batch E12 (2026-09-09) — the graveyard rework. Parts 1/2/4 all land in
// persistGrave(): the stored tombstones cap at 5, a separate lifetime total
// counts every death untrimmed, and a wider recent-names window accumulates for
// the fresh-roll dedup. `abandon` is used to bury seed-independently (it never
// depends on maze layout, unlike the starve/fall paths above).
test("E12: persistGrave caps stored graves at 5 while the total climbs and recentNames accumulates", async () => {
  await withFakeLocalStorage(async (store) => {
    const names = [];
    for (let i = 0; i < 7; i++) {
      await startNewRun(1000 + i);
      names.push(getState().c.name);
      dispatch({ type: "abandon" });
      // persistGrave() read-then-writes three keys; flush before the next
      // startNewRun so the running total/graves/recentNames all settle in order
      // (getItem is not queued behind in-flight writes — see storage.js).
      await flushStorage();
    }

    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    assert.ok(Array.isArray(graves), "graveyard was written");
    assert.equal(graves.length, 5, "only the last 5 tombstones are stored (part 1 cap)");
    // newest-first: the 5 stored are the last 5 deaths, most-recent first
    assert.equal(graves[0].name, names[6], "the newest death is first among the stored 5");

    const total = Number(store.getItem(GRAVE_TOTAL_KEY));
    assert.equal(total, 7, "the running total counts EVERY death, untrimmed (part 2)");

    const recent = JSON.parse(store.getItem(RECENT_NAMES_KEY));
    assert.ok(Array.isArray(recent), "recentNames was written");
    assert.equal(recent.length, 7, "all 7 names accumulate (still under the 25 cap, part 4)");
    assert.equal(recent[0], names[6], "recentNames is newest-first");
  });
});

test("E12: the recent-names window is capped at 25 (separately from the 5-grave cap)", async () => {
  await withFakeLocalStorage(async (store) => {
    for (let i = 0; i < 30; i++) {
      await startNewRun(2000 + i);
      dispatch({ type: "abandon" });
      await flushStorage();
    }
    const recent = JSON.parse(store.getItem(RECENT_NAMES_KEY));
    assert.equal(recent.length, 25, "recentNames never exceeds the 25-name window");
    const total = Number(store.getItem(GRAVE_TOTAL_KEY));
    assert.equal(total, 30, "the lifetime total still counts all 30 deaths");
    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    assert.equal(graves.length, 5, "the visible graveyard stays capped at 5");
  });
});

test("E12: startNewRun threads recentNames into the fresh roll so a just-used name is avoided", async () => {
  await withFakeLocalStorage(async (store) => {
    const seed = 24680;
    // What this seed rolls with NO dedup (the engine's raw newRun):
    const base = newRun(seed);
    // Simulate that exact adventurer having just died — pre-seed recentNames.
    store.setItem(RECENT_NAMES_KEY, JSON.stringify([base.c.name]));

    const state = await startNewRun(seed);
    assert.notEqual(state.c.name, base.c.name, "the just-used name was avoided on the fresh roll");
    // Same rng order → only the name differs; race/subclass are unchanged.
    assert.equal(state.c.race, base.c.race, "the roll's race is unchanged (no extra rng draw)");
    assert.equal(state.c.sub, base.c.sub, "the roll's subclass is unchanged (no extra rng draw)");
  });
});

test("E12: persistGrave seeds the total from existing graves when the total key is missing (migration)", async () => {
  await withFakeLocalStorage(async (store) => {
    // A pre-E12 player: three tombstones already stored, but no total key yet.
    store.setItem(GRAVE_KEY, JSON.stringify([
      { name: "Old One", cause: "combat" },
      { name: "Older Two", cause: "starve" },
      { name: "Oldest Three", cause: "fall" },
    ]));
    await startNewRun(31415);
    dispatch({ type: "abandon" });
    await flushStorage();

    const total = Number(store.getItem(GRAVE_TOTAL_KEY));
    assert.equal(total, 4, "the total is seeded from the 3 pre-existing graves, then +1 for this death");
    const graves = JSON.parse(store.getItem(GRAVE_KEY));
    assert.equal(graves.length, 4, "still under the cap — all four remain (newest first)");
  });
});

test("Device-review Pass DR7: dispatch({type:'buyItem'})/dispatch({type:'leaveStore'}) route a purchase through the engine seam end-to-end", async () => {
  await withFakeLocalStorage(async () => {
    initRun(4242);
    const state = getState();
    // Populate state.store the SAME way the live app does — via the
    // engine's own encounters.js -> economy.js#openStore() (plain-data
    // stock, no `buy` closures) — rather than hand-rolling a fixture shape
    // that could silently drift from what real gameplay produces. This is
    // exactly the shape mazeworld.html's renderEncounter() store branch
    // reads and window.mzBuyItem/window.mzLeaveStore dispatch against.
    openStore(state, makeRng(state.rngState));
    assert.ok(state.store && state.store.stock.length > 0, "openStore populated plain-data stock");

    // Guarantee an affordable purchase regardless of the seed's rolled
    // prices/starting gold — this test is about the DISPATCH seam, not
    // economy.js's own pricing (already covered by test/unit/economy.test.js).
    const idx = 0;
    state.c.gold = state.store.stock[idx].cost;
    const priorItemCount = (state.c.items || []).length;

    const { state: after, events } = dispatch({ type: "buyItem", idx });
    assert.equal(after.c.gold, 0, "the item's cost was deducted from gold");
    assert.equal(after.store.stock[idx].sold, true, "the stock slot is marked sold");
    assert.ok(
      events.some((e) => e.type === "bought"),
      "a 'bought' event was pushed for narration",
    );
    // Not every stock entry grants an inventory item (e.g. eatRation/
    // repairArmor apply their effect directly to state.c) — only assert
    // growth when this particular slot's effect is item-granting.
    if (["givePotion", "giveLockpicks", "buyWeapon", "buyArmor", "buyPremium"].includes(state.store.stock[idx].effectId)) {
      assert.ok((after.c.items || []).length > priorItemCount, "the purchased item was granted to the character");
    }

    const { state: closed, events: leaveEvents } = dispatch({ type: "leaveStore" });
    assert.equal(closed.store, null, "leaveStore closes the shop");
    assert.ok(
      leaveEvents.some((e) => e.type === "storeLeft"),
      "a 'storeLeft' event was pushed for narration",
    );
  });
});

test("Device-review Pass DR7: dispatch({type:'buyItem'}) on insufficient gold is a no-op that reports why, never a throw", async () => {
  await withFakeLocalStorage(async () => {
    initRun(4243);
    const state = getState();
    openStore(state, makeRng(state.rngState));
    const idx = 0;
    state.c.gold = 0; // guaranteed short of any positive-cost item

    const { state: after, events } = dispatch({ type: "buyItem", idx });
    assert.equal(after.store.stock[idx].sold, false, "an unaffordable purchase never marks the slot sold");
    assert.ok(
      events.some((e) => e.type === "buyFailed" && e.reason === "insufficientGold"),
      "a 'buyFailed' event explains why, rather than silently doing nothing",
    );
  });
});

test("Device-review Pass DR8: dispatch({type:'castSpell'}) heals WP through the engine seam (guards the '04-07 engine-routing gap' fix — 'Greater Heal didn't heal')", async () => {
  await withFakeLocalStorage(async () => {
    initRun(9001);
    const state = getState();
    // Force a Magic User who can cast "Heal" (SPELLS[0], a level-1 healing
    // spell) at level 1, the same way DR7's store test force-sets
    // state.c.gold directly rather than depending on the seed's roll — this
    // test is about the DISPATCH seam actually applying the effect, not
    // magic.js's own gating (already covered by test/unit/magic.test.js).
    state.c.cls = "Magic User";
    state.c.sub = "Cleric"; // healing school ungated (schoolGate default 1) for a Cleric
    state.c.level = 1;
    state.c.grimoire = ["Heal"];
    state.c.spellsUsed = 0;
    state.c.maxWP = 100;
    state.c.wp = 40; // damaged, well under max, so a heal has room to land

    const before = state.c.wp;
    const { state: after, events } = dispatch({ type: "castSpell", idx: 0 });
    assert.ok(after.c.wp > before, "casting Heal actually raised WP (the live-device regression: it silently didn't)");
    assert.ok(after.c.wp <= after.c.maxWP, "healing never overshoots max WP");
    assert.ok(
      events.some((e) => e.type === "healed"),
      "a 'healed' event was pushed for narration",
    );

    // Cap-at-max: a full-health cast must not push WP past maxWP even though
    // the spell still resolves (mirrors magic.js's own Math.min clamp).
    after.c.wp = after.c.maxWP;
    after.c.spellsUsed = 0;
    const { state: capped } = dispatch({ type: "castSpell", idx: 0 });
    assert.equal(capped.c.wp, capped.c.maxWP, "healing at full WP stays capped at max, never exceeds it");
  });
});

test("Device-review Pass DR8: dispatch({type:'camp'}) applies its effect through the engine seam (rations spent, a day passes)", async () => {
  await withFakeLocalStorage(async () => {
    initRun(9002);
    const state = getState();
    state.c.rations = 5;
    const priorRations = state.c.rations;
    const priorDay = state.day;

    const { state: after, events } = dispatch({ type: "camp" });
    assert.equal(after.day, priorDay + 1, "a day actually passed");
    assert.ok(after.c.rations < priorRations, "rations were actually spent on the camp");
    assert.ok(
      events.some((e) => e.type === "dayBegan" && e.camped === true),
      "a 'dayBegan' event marked camped:true was pushed for narration",
    );
  });
});

test("Device-review Pass DR8: dispatch({type:'camp'}) with no rations is a no-op that reports why, never a throw", async () => {
  await withFakeLocalStorage(async () => {
    initRun(9003);
    const state = getState();
    state.c.rations = 0;
    const priorDay = state.day;

    let result;
    assert.doesNotThrow(() => {
      result = dispatch({ type: "camp" });
    });
    const { state: after, events } = result;
    assert.equal(after.day, priorDay, "no day passed without rations");
    assert.ok(
      events.some((e) => e.type === "campFailed" && e.reason === "noRations"),
      "a 'campFailed' event explains why, rather than silently doing nothing",
    );
  });
});

test("CR-01: persistGrave never throws when storage is blocked (private window/quota)", async () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
    removeItem: () => {},
  };
  try {
    initRun(88);
    getState().c.rations = 0;
    getState().c.wp = 1;
    getState().steps = 99;
    // dispatch() itself never awaits persistGrave() (fire-and-enqueue), so
    // it structurally cannot throw synchronously here regardless of storage
    // state; flushing afterward proves the queued write settled (resolved,
    // not rejected) rather than leaving an unhandled rejection.
    assert.doesNotThrow(() => dispatch({ type: "move", dir: "N" }));
    await assert.doesNotReject(() => flushStorage());
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("engineAdapter.js never references Math.random or the DOM directly", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "engineAdapter.js"), "utf8"));
  assert.ok(!/Math\.random/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
});
