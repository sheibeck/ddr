// Direct unit coverage for src/browser/engineAdapter.js — the walking
// skeleton's presentation/persistence glue (01-07 Task 3). Node has no
// built-in `localStorage`, so these tests install a minimal in-memory stub
// on `globalThis` before exercising boot()/dispatch() (mirroring the parity
// harness's own fakeStorage pattern in
// test/parity/harness/sandboxPrototype.js), then remove it afterward so it
// can't leak into other test files.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { boot, initRun, getState, dispatch, formatEvents } from "../../src/browser/engineAdapter.js";
import { newRun } from "../../engine/engine.js";
import { serializeRun } from "../../engine/saveState.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SAVE_KEY = "mazeworld.delve.v1";

function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return fn(globalThis.localStorage);
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

test("boot(freshSeed) starts a fresh run when there is no save", () => {
  withFakeLocalStorage(() => {
    const state = boot(4242);
    assert.equal(state.floor.depth, 1);
    assert.equal(state.seed, 4242);
    assert.equal(getState(), state);
  });
});

test("boot(freshSeed) rehydrates a valid existing save instead of starting fresh", () => {
  withFakeLocalStorage((store) => {
    const original = newRun(99);
    store.setItem(SAVE_KEY, JSON.stringify(serializeRun(original)));
    const state = boot(1);
    assert.equal(state.seed, 99, "rehydrated the saved run, not a fresh one");
    assert.deepStrictEqual(state.c, original.c);
  });
});

test("boot(freshSeed) fails closed to a fresh run on a corrupt save", () => {
  withFakeLocalStorage((store) => {
    store.setItem(SAVE_KEY, "{not json");
    const state = boot(777);
    assert.equal(state.seed, 777, "fell back to a brand-new run rather than throwing");
  });
});

test("dispatch(action) advances state via applyAction and persists it", () => {
  withFakeLocalStorage((store) => {
    initRun(11);
    const before = getState();
    const { state, events, html } = dispatch({ type: "move", dir: "N" });
    assert.equal(getState(), state, "dispatch swaps in the returned state as current");
    assert.ok(Array.isArray(events));
    assert.ok(Array.isArray(html));

    const persisted = JSON.parse(store.getItem(SAVE_KEY));
    assert.deepStrictEqual(persisted.c, state.c, "the persisted save reflects post-dispatch state");
    assert.notEqual(before, state, "dispatch never mutates the previous state object in place");
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

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("engineAdapter.js never references Math.random or the DOM directly", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "engineAdapter.js"), "utf8"));
  assert.ok(!/Math\.random/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
});
