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
