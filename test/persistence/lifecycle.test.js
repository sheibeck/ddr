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

import test from "node:test";
import assert from "node:assert/strict";
import { registerNativeChrome, flushOnBackground } from "../../src/browser/nativeChrome.js";

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

test("CR-03: SplashScreen.hide() still runs when the '@capacitor/app' import fails/is unavailable — no permanent splash soft-lock", async () => {
  let hideCalled = false;
  const fakeSplashScreen = {
    async hide() {
      hideCalled = true;
    },
  };
  const storage = { flush: async () => {} };
  // App is deliberately NOT injected: this project's zero-runtime-dep design
  // (src/browser/storage.js's own doc comment; .claude/CLAUDE.md) means bare
  // `@capacitor/*` specifiers are never resolvable under `node --test` — so
  // the real `await import("@capacitor/app")` genuinely rejects here,
  // exercising CR-03's guarded-import path for real rather than via a mock
  // (the same pattern the "never throws when Splash/StatusBar/
  // ScreenOrientation are omitted" test above already relies on for those
  // three plugins).
  await assert.doesNotReject(() =>
    registerNativeChrome({ SplashScreen: fakeSplashScreen, storage, getGameContext: () => ({}) })
  );
  assert.equal(
    hideCalled,
    true,
    "SplashScreen.hide() must run even though the @capacitor/app import failed — otherwise launchAutoHide:false leaves the splash up forever"
  );
});

test("CR-03: registerNativeChrome resolves (does not throw/reject) when '@capacitor/app' is unavailable, even with no SplashScreen/StatusBar/ScreenOrientation injected either", async () => {
  const storage = { flush: async () => {} };
  const result = await registerNativeChrome({ storage, getGameContext: () => ({}) });
  assert.equal(result, undefined, "registerNativeChrome degrades gracefully (returns) rather than propagating the @capacitor/app import failure");
});

test("CR-03: StatusBar/ScreenOrientation are still attempted (not skipped) even when the '@capacitor/app' import later fails", async () => {
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
  assert.equal(statusBarStyleSet, true, "status-bar chrome still runs even though @capacitor/app is unavailable");
  assert.equal(orientationLocked, true, "orientation-lock chrome still runs even though @capacitor/app is unavailable");
});
