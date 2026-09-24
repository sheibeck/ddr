// test/persistence/lifecycle.test.js
//
// PLT-03/SAV-01 (02-RESEARCH.md "Back Button + Lifecycle" — the awaited-flush
// correctness note): the pause/appStateChange handler MUST await a full
// storage flush before it resolves, since a fire-and-forget write started in
// a backgrounding handler has no guarantee of completing before the OS
// suspends/kills the process. This is the single most safety-critical
// async-ordering concern in the persistence design (more so than the
// rapid-action-autosave race) because losing the LAST write on backgrounding
// directly violates SAV-01/SAV-02's "resume exactly where they left off".
//
// src/browser/nativeChrome.js (02-03 Task 3) does not exist yet — this file
// is written RED-first (Wave-0 Task 1) against its not-yet-built exports.
// `@capacitor/app` is never imported here directly — registerNativeChrome
// accepts an injected fake `App` so no bare `@capacitor/*` specifier is ever
// resolved under node.

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  registerNativeChrome,
  flushOnBackground,
  __resetNativeChromeRegistrationForTests,
} from "../../src/browser/nativeChrome.js";

// WR-02 (02-REVIEW.md): registerNativeChrome() now guards against being
// invoked a second time in the same process lifetime — reset that guard
// before every test in this file so each test's own registerNativeChrome()
// call actually registers its listeners, rather than every test after the
// first silently no-op'ing.
beforeEach(() => {
  __resetNativeChromeRegistrationForTests();
});

/** makeFakeApp() — mimics @capacitor/app's `App.addListener(event, handler)`
 * surface just enough to capture the registered handlers for direct
 * invocation, without ever importing the real plugin. */
function makeFakeApp() {
  const listeners = new Map();
  return {
    addListener(event, handler) {
      listeners.set(event, handler);
      return { remove() {} };
    },
    exitApp() {
      this.exited = true;
    },
    exited: false,
    _listeners: listeners,
  };
}

/** makeControllableStorage() — a fake Storage-shaped object whose flush()
 * resolves only when the test explicitly calls resolveFlush(), so tests can
 * observe that a caller genuinely AWAITED it rather than fired-and-forgot. */
function makeControllableStorage() {
  let resolveFlush;
  const flushPromise = new Promise((resolve) => {
    resolveFlush = resolve;
  });
  return {
    flush: () => flushPromise,
    resolveFlush: () => resolveFlush(),
  };
}

test("flushOnBackground(storage) awaits storage.flush() and resolves only AFTER it settles", async () => {
  const storage = makeControllableStorage();
  let resolved = false;
  const p = flushOnBackground(storage).then(() => {
    resolved = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, false, "flushOnBackground must not resolve before storage.flush() settles");
  storage.resolveFlush();
  await p;
  assert.equal(resolved, true, "flushOnBackground resolves once the flush settles");
});

test("flushOnBackground never throws when storage has no flush() method (or is missing entirely)", async () => {
  await assert.doesNotReject(() => flushOnBackground({}));
  await assert.doesNotReject(() => flushOnBackground(null));
  await assert.doesNotReject(() => flushOnBackground(undefined));
});

test("registerNativeChrome wires an appStateChange listener that AWAITS a flush before resolving when the app goes inactive", async () => {
  const fakeApp = makeFakeApp();
  const storage = makeControllableStorage();
  await registerNativeChrome({ App: fakeApp, storage, getGameContext: () => ({}) });

  assert.ok(fakeApp._listeners.has("appStateChange"), "registerNativeChrome must register an appStateChange listener");
  const handler = fakeApp._listeners.get("appStateChange");

  let resolved = false;
  const p = Promise.resolve(handler({ isActive: false })).then(() => {
    resolved = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, false, "the appStateChange(inactive) handler must await the flush, not fire-and-forget");
  storage.resolveFlush();
  await p;
  assert.equal(resolved, true);
});

test("registerNativeChrome's appStateChange listener does not hang waiting on a flush when the app becomes active again", async () => {
  const fakeApp = makeFakeApp();
  const storage = makeControllableStorage(); // flush() deliberately never resolves in this test
  await registerNativeChrome({ App: fakeApp, storage, getGameContext: () => ({}) });
  const handler = fakeApp._listeners.get("appStateChange");
  await assert.doesNotReject(() => Promise.resolve(handler({ isActive: true })));
});

test("registerNativeChrome also wires a pause listener that awaits the same flush before resolving (PLT-03)", async () => {
  const fakeApp = makeFakeApp();
  const storage = makeControllableStorage();
  await registerNativeChrome({ App: fakeApp, storage, getGameContext: () => ({}) });

  assert.ok(fakeApp._listeners.has("pause"), "registerNativeChrome must register a pause listener");
  const handler = fakeApp._listeners.get("pause");

  let resolved = false;
  const p = Promise.resolve(handler()).then(() => {
    resolved = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, false, "the pause handler must await the flush, not fire-and-forget");
  storage.resolveFlush();
  await p;
  assert.equal(resolved, true);
});

test("registerNativeChrome also wires a backButton listener (disabling Capacitor's own default entirely)", async () => {
  const fakeApp = makeFakeApp();
  const storage = { flush: async () => {} };
  await registerNativeChrome({ App: fakeApp, storage, getGameContext: () => ({}) });
  assert.ok(fakeApp._listeners.has("backButton"), "registerNativeChrome must register a backButton listener");
});

test("registerNativeChrome never throws when SplashScreen/StatusBar/ScreenOrientation are omitted (chrome finalized in 02-04)", async () => {
  const fakeApp = makeFakeApp();
  const storage = { flush: async () => {} };
  await assert.doesNotReject(() => registerNativeChrome({ App: fakeApp, storage, getGameContext: () => ({}) }));
});

// CR-03 (02-REVIEW.md): the '@capacitor/app' import must be guarded exactly
// like SplashScreen/StatusBar/ScreenOrientation above it — a rejection must
// NOT prevent SplashScreen.hide() from running, or (because
// capacitor.config.json sets launchAutoHide:false) the native splash screen
// is never hidden and the app appears permanently frozen even though the
// WebView underneath is fully booted and playable.
//
// These tests force the '@capacitor/app' import to fail deterministically
// via nativeChrome.js's test-only `globalThis.__mzAppImportOverride` hook,
// rather than relying on the real `@capacitor/app` package being
// unresolvable under `node --test` — unlike SplashScreen/StatusBar/
// ScreenOrientation, the real `@capacitor/app` web implementation touches
// `document` during its own module setup, which throws unpredictably
// depending on whether node_modules has it installed (it does, in this
// project, once 02-02's Android scaffold lands it as a real dependency).

function withFailingAppImport(fn) {
  return async () => {
    globalThis.__mzAppImportOverride = async () => {
      throw new Error("@capacitor/app import failed (simulated)");
    };
    try {
      await fn();
    } finally {
      delete globalThis.__mzAppImportOverride;
    }
  };
}

test(
  "CR-03: SplashScreen.hide() still runs when the '@capacitor/app' import fails — no permanent splash soft-lock",
  withFailingAppImport(async () => {
    let hideCalled = false;
    const fakeSplashScreen = {
      async hide() {
        hideCalled = true;
      },
    };
    const storage = { flush: async () => {} };
    await assert.doesNotReject(() =>
      registerNativeChrome({ SplashScreen: fakeSplashScreen, storage, getGameContext: () => ({}) })
    );
    assert.equal(
      hideCalled,
      true,
      "SplashScreen.hide() must run even though the @capacitor/app import failed — otherwise launchAutoHide:false leaves the splash up forever"
    );
  })
);

test(
  "CR-03: registerNativeChrome resolves (does not throw/reject) when the '@capacitor/app' import fails, even with no SplashScreen/StatusBar/ScreenOrientation injected either",
  withFailingAppImport(async () => {
    const storage = { flush: async () => {} };
    const result = await registerNativeChrome({ storage, getGameContext: () => ({}) });
    assert.equal(result, undefined, "registerNativeChrome degrades gracefully (returns) rather than propagating the @capacitor/app import failure");
  })
);

test(
  "CR-03: StatusBar/ScreenOrientation are still attempted (not skipped) even when the '@capacitor/app' import later fails",
  withFailingAppImport(async () => {
    let statusBarStyleSet = false;
    const fakeStatusBar = {
      async setStyle() {
        statusBarStyleSet = true;
      },
      async setBackgroundColor() {},
    };
    let orientationLocked = false;
    const fakeScreenOrientation = {
      async lock() {
        orientationLocked = true;
      },
    };
    const storage = { flush: async () => {} };
    await registerNativeChrome({
      StatusBar: fakeStatusBar,
      ScreenOrientation: fakeScreenOrientation,
      storage,
      getGameContext: () => ({}),
    });
    assert.equal(statusBarStyleSet, true, "status-bar chrome still runs even though @capacitor/app import failed");
    assert.equal(orientationLocked, true, "orientation-lock chrome still runs even though @capacitor/app import failed");
  })
);

// WR-02 (02-REVIEW.md): a second registerNativeChrome() call in the same
// process must be a no-op, not a second independent set of listeners with
// its own confirming/confirmTimer state (which would double-fire every
// lifecycle event).

test("WR-02: a second registerNativeChrome() call in the same process is a no-op (does not register a second listener set)", async () => {
  const firstApp = makeFakeApp();
  const secondApp = makeFakeApp();
  const storage = { flush: async () => {} };

  await registerNativeChrome({ App: firstApp, storage, getGameContext: () => ({}) });
  assert.ok(firstApp._listeners.has("backButton"), "the first call registers listeners on the first App instance");

  // Deliberately do NOT reset the guard here (that's what
  // __resetNativeChromeRegistrationForTests()/beforeEach above is for
  // between different TESTS) — this call simulates a second real-world
  // invocation within the same session.
  await registerNativeChrome({ App: secondApp, storage, getGameContext: () => ({}) });
  assert.equal(
    secondApp._listeners.size,
    0,
    "a second call in the same process must not register any listeners on a second App instance"
  );
});

// ─── Quick task 260924-51h (R-07): onBackground / onForeground hooks ─────
//
// The title theme stops on background and may restart on foreground. The
// hooks are presentation-only: they run synchronously ahead of the flush,
// and a throwing hook must never block or break the safety-critical flush.

test("260924-51h: pause calls onBackground synchronously, and still resolves only after the flush settles", async () => {
  const fakeApp = makeFakeApp();
  const storage = makeControllableStorage();
  const calls = [];
  await registerNativeChrome({
    App: fakeApp,
    storage,
    getGameContext: () => ({}),
    onBackground: () => calls.push("bg"),
    onForeground: () => calls.push("fg"),
  });
  let resolved = false;
  const p = Promise.resolve(fakeApp._listeners.get("pause")()).then(() => {
    resolved = true;
  });
  assert.deepEqual(calls, ["bg"], "onBackground runs synchronously inside the pause handler");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, false, "the pause handler still awaits the flush");
  storage.resolveFlush();
  await p;
  assert.equal(resolved, true);
});

test("260924-51h: appStateChange({ isActive: false }) calls onBackground and awaits the flush", async () => {
  const fakeApp = makeFakeApp();
  const storage = makeControllableStorage();
  const calls = [];
  await registerNativeChrome({
    App: fakeApp,
    storage,
    getGameContext: () => ({}),
    onBackground: () => calls.push("bg"),
    onForeground: () => calls.push("fg"),
  });
  let resolved = false;
  const p = Promise.resolve(fakeApp._listeners.get("appStateChange")({ isActive: false })).then(() => {
    resolved = true;
  });
  assert.deepEqual(calls, ["bg"]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, false);
  storage.resolveFlush();
  await p;
  assert.equal(resolved, true);
});

test("260924-51h: appStateChange({ isActive: true }) calls onForeground and does not hang", async () => {
  const fakeApp = makeFakeApp();
  const storage = makeControllableStorage(); // never resolves
  const calls = [];
  await registerNativeChrome({
    App: fakeApp,
    storage,
    getGameContext: () => ({}),
    onBackground: () => calls.push("bg"),
    onForeground: () => calls.push("fg"),
  });
  await assert.doesNotReject(() => Promise.resolve(fakeApp._listeners.get("appStateChange")({ isActive: true })));
  assert.deepEqual(calls, ["fg"]);
});

test("260924-51h: a resume listener is registered and calls onForeground", async () => {
  const fakeApp = makeFakeApp();
  const calls = [];
  await registerNativeChrome({
    App: fakeApp,
    storage: { flush: async () => {} },
    getGameContext: () => ({}),
    onBackground: () => calls.push("bg"),
    onForeground: () => calls.push("fg"),
  });
  assert.ok(fakeApp._listeners.has("resume"), "registerNativeChrome must register a resume listener");
  await assert.doesNotReject(() => Promise.resolve(fakeApp._listeners.get("resume")()));
  assert.deepEqual(calls, ["fg"]);
});

test("260924-51h: throwing hooks never make a handler throw, and pause still awaits the flush", async () => {
  const fakeApp = makeFakeApp();
  const storage = makeControllableStorage();
  const boom = () => {
    throw new Error("hook boom");
  };
  await registerNativeChrome({ App: fakeApp, storage, getGameContext: () => ({}), onBackground: boom, onForeground: boom });
  let resolved = false;
  let p;
  assert.doesNotThrow(() => {
    p = Promise.resolve(fakeApp._listeners.get("pause")()).then(() => {
      resolved = true;
    });
  });
  assert.doesNotThrow(() => fakeApp._listeners.get("appStateChange")({ isActive: true }));
  assert.doesNotThrow(() => fakeApp._listeners.get("resume")());
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, false, "a throwing onBackground must not short-circuit the flush wait");
  storage.resolveFlush();
  await p;
  assert.equal(resolved, true);
});

test("260924-51h: with the hooks omitted, pause, appStateChange and resume all run without throwing", async () => {
  const fakeApp = makeFakeApp();
  await registerNativeChrome({ App: fakeApp, storage: { flush: async () => {} }, getGameContext: () => ({}) });
  await assert.doesNotReject(() => Promise.resolve(fakeApp._listeners.get("pause")()));
  await assert.doesNotReject(() => Promise.resolve(fakeApp._listeners.get("appStateChange")({ isActive: false })));
  await assert.doesNotReject(() => Promise.resolve(fakeApp._listeners.get("appStateChange")({ isActive: true })));
  await assert.doesNotReject(() => Promise.resolve(fakeApp._listeners.get("resume")()));
});
