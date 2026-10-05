// test/unit/screen-orientation.test.js
//
// Phase 97 (SCREEN-02, SCREEN-05): the phone-only, preference-driven,
// idempotent orientation rule in src/browser/nativeChrome.js.
//   - decideOrientationLock is pure: "portrait" only for a phone (smallest
//     width < 600 CSS px) whose Screen preference is not "rotate"; "unlock"
//     for everything else (Rotate on a phone, every tablet/foldable/Chromebook).
//   - syncOrientationLock re-applies the rule idempotently: a repeat with the
//     same inputs makes no plugin call, a changed input makes exactly one, a
//     throwing plugin call is swallowed and retried on the next sync.

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  PHONE_SMALLEST_WIDTH_LIMIT,
  decideOrientationLock,
  syncOrientationLock,
  registerNativeChrome,
  __resetNativeChromeRegistrationForTests,
} from "../../src/browser/nativeChrome.js";

beforeEach(() => {
  __resetNativeChromeRegistrationForTests();
});

function makeFakeApp() {
  const listeners = new Map();
  return {
    addListener(event, handler) {
      listeners.set(event, handler);
      return { remove() {} };
    },
    exitApp() {},
    _listeners: listeners,
  };
}

function makeFakeOrientation({ throwOnLock = false, throwOnUnlock = false } = {}) {
  const calls = [];
  return {
    calls,
    async lock(arg) {
      calls.push(["lock", arg]);
      if (throwOnLock) throw new Error("lock failed");
    },
    async unlock() {
      calls.push(["unlock"]);
      if (throwOnUnlock) throw new Error("unlock failed");
    },
    count(name) {
      return calls.filter((c) => c[0] === name).length;
    },
  };
}

const storage = { flush: async () => {} };

async function register(plugin, getters = {}) {
  await registerNativeChrome({
    App: makeFakeApp(),
    SplashScreen: { hide: async () => {} },
    SystemBars: { setStyle: async () => {} },
    ScreenOrientation: plugin,
    storage,
    getGameContext: () => ({}),
    ...getters,
  });
}

// ─── decideOrientationLock ──────────────────────────────────────────────────

test("SCREEN-02: PHONE_SMALLEST_WIDTH_LIMIT is 600", () => {
  assert.equal(PHONE_SMALLEST_WIDTH_LIMIT, 600);
});

test("SCREEN-02: a phone on Portrait locks portrait; unknown preference reads as the default", () => {
  assert.equal(decideOrientationLock({ screenPref: "portrait", smallestWidth: 412 }), "portrait");
  assert.equal(decideOrientationLock({ screenPref: undefined, smallestWidth: 412 }), "portrait");
  assert.equal(decideOrientationLock({ screenPref: "sideways", smallestWidth: 412 }), "portrait");
  assert.equal(decideOrientationLock({}), "portrait");
  assert.equal(decideOrientationLock(), "portrait");
});

test("SCREEN-02: a phone set to Rotate unlocks", () => {
  assert.equal(decideOrientationLock({ screenPref: "rotate", smallestWidth: 412 }), "unlock");
});

test("SCREEN-02: boundary at 600 CSS px (599 and 599.98 are phones, 600 and 601 are not)", () => {
  assert.equal(decideOrientationLock({ screenPref: "portrait", smallestWidth: 599 }), "portrait");
  assert.equal(decideOrientationLock({ screenPref: "portrait", smallestWidth: 599.98 }), "portrait");
  for (const w of [600, 601, 800]) {
    assert.equal(decideOrientationLock({ screenPref: "portrait", smallestWidth: w }), "unlock", `portrait @${w}`);
    assert.equal(decideOrientationLock({ screenPref: "rotate", smallestWidth: w }), "unlock", `rotate @${w}`);
  }
});

test("SCREEN-02: a missing, non-numeric, zero or negative smallest width counts as a phone", () => {
  for (const w of [undefined, NaN, "412", 0, -5, null, Infinity]) {
    const label = String(w);
    // Infinity is not a finite number: treated as unmeasured, so a phone.
    assert.equal(decideOrientationLock({ screenPref: "portrait", smallestWidth: w }), "portrait", `portrait @${label}`);
    assert.equal(decideOrientationLock({ screenPref: "rotate", smallestWidth: w }), "unlock", `rotate @${label}`);
  }
});

// ─── registerNativeChrome applies the rule at boot ──────────────────────────

test("SCREEN-02: registerNativeChrome locks portrait on a phone set to Portrait", async () => {
  const plugin = makeFakeOrientation();
  await register(plugin, { getScreenPref: () => "portrait", getSmallestWidth: () => 412 });
  assert.deepEqual(plugin.calls, [["lock", { orientation: "portrait" }]]);
});

test("SCREEN-02: registerNativeChrome unlocks on a phone set to Rotate", async () => {
  const plugin = makeFakeOrientation();
  await register(plugin, { getScreenPref: () => "rotate", getSmallestWidth: () => 412 });
  assert.equal(plugin.count("unlock"), 1);
  assert.equal(plugin.count("lock"), 0);
});

test("SCREEN-02: registerNativeChrome unlocks on a tablet even when the preference says Portrait", async () => {
  const plugin = makeFakeOrientation();
  await register(plugin, { getScreenPref: () => "portrait", getSmallestWidth: () => 800 });
  assert.equal(plugin.count("unlock"), 1);
  assert.equal(plugin.count("lock"), 0);
});

test("SCREEN-02: registerNativeChrome with a fake plugin and no getters locks portrait once", async () => {
  const plugin = makeFakeOrientation();
  await register(plugin);
  assert.deepEqual(plugin.calls, [["lock", { orientation: "portrait" }]]);
});

test("SCREEN-02: a plugin with only lock() (no unlock) does not break registration", async () => {
  const calls = [];
  await register({ lock: async (a) => calls.push(a) }, { getScreenPref: () => "rotate", getSmallestWidth: () => 412 });
  assert.deepEqual(calls, []);
});

// ─── syncOrientationLock: idempotent re-application ─────────────────────────

test("SCREEN-05: syncOrientationLock re-reads the getters; a changed preference makes exactly one call, a repeat none", async () => {
  const plugin = makeFakeOrientation();
  let pref = "portrait";
  await register(plugin, { getScreenPref: () => pref, getSmallestWidth: () => 412 });
  assert.equal(plugin.calls.length, 1);

  // Same inputs: no second plugin call.
  assert.equal(await syncOrientationLock(), "portrait");
  assert.equal(plugin.calls.length, 1);

  pref = "rotate";
  assert.equal(await syncOrientationLock(), "unlock");
  assert.equal(plugin.count("unlock"), 1);
  assert.equal(plugin.calls.length, 2);

  assert.equal(await syncOrientationLock(), "unlock");
  assert.equal(plugin.calls.length, 2, "no further plugin call on a repeat");
});

test("SCREEN-05: an unfold (412 -> 841) unlocks once; a fold (841 -> 411) locks once", async () => {
  const plugin = makeFakeOrientation();
  let width = 412;
  await register(plugin, { getScreenPref: () => "portrait", getSmallestWidth: () => width });
  assert.equal(plugin.calls.length, 1);

  width = 841;
  await syncOrientationLock();
  assert.deepEqual(plugin.calls.slice(1), [["unlock"]]);

  await syncOrientationLock();
  assert.equal(plugin.calls.length, 2, "repeat at 841 is a no-op");

  width = 411;
  await syncOrientationLock();
  assert.deepEqual(plugin.calls.slice(2), [["lock", { orientation: "portrait" }]]);
});

test("SCREEN-05: a throwing lock() is swallowed and retried on the next sync", async () => {
  const plugin = makeFakeOrientation({ throwOnLock: true });
  await register(plugin, { getScreenPref: () => "portrait", getSmallestWidth: () => 412 });
  assert.equal(plugin.count("lock"), 1);

  // No stale "applied" memory: the same inputs call lock() again.
  await assert.doesNotReject(() => syncOrientationLock());
  assert.equal(plugin.count("lock"), 2);
});

test("SCREEN-05: a throwing getter reads as undefined (a phone on the default)", async () => {
  const plugin = makeFakeOrientation();
  await register(plugin, {
    getScreenPref: () => {
      throw new Error("boom");
    },
    getSmallestWidth: () => {
      throw new Error("boom");
    },
  });
  assert.deepEqual(plugin.calls, [["lock", { orientation: "portrait" }]]);
});

test("SCREEN-05: syncOrientationLock before registration resolves null and touches nothing", async () => {
  assert.equal(await syncOrientationLock(), null);
});

test("SCREEN-05: the reset hook clears the remembered lock state", async () => {
  const plugin = makeFakeOrientation();
  await register(plugin, { getScreenPref: () => "portrait", getSmallestWidth: () => 412 });
  __resetNativeChromeRegistrationForTests();
  assert.equal(await syncOrientationLock(), null);
  assert.equal(plugin.calls.length, 1);
});
