// test/unit/accountChip.test.js
//
// Phase 67 (ACCT-01/02, PGS-02), Plan 07 Task 2 — the account controller
// (createAccountController): boot (D-01/D-02), the welcome card once (D-04),
// the single failed card with no automatic retry (D-11), Stop competing as
// Compete OFF with no sign-out (D-03), the silent attempt's timeout, and the
// ACCT-02 edge rows (idempotency and concurrency). Every collaborator is a
// fake: a scripted provider whose calls return deferred promises the test
// settles, recording settings { read, write }, a recording notify and a
// manual timer (setTimer/clearTimer).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { createAccountController } from "../../src/browser/accountChip.js";
import { accountCard, accountChipView, accountSheetView } from "../../src/browser/account.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "accountChip.js"), "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

const PLAYER = Object.freeze({ id: "g-8817-secret", displayName: "Hilda Ferrow" });
const OTHER = Object.freeze({ id: "g-0002-other", displayName: "Lanternjaw" });

// Every settings.write made by any controller in this file, for the
// write-keys pin at the bottom.
const ALL_WRITES = [];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** scriptedProvider() — every method logs its name; init()/signIn() return deferreds the test settles. */
function scriptedProvider() {
  const calls = [];
  const pending = { init: [], signIn: [] };
  const settleable = (name) => () => {
    calls.push(name);
    const d = deferred();
    pending[name].push(d);
    return d.promise;
  };
  return {
    calls,
    pending,
    init: settleable("init"),
    signIn: settleable("signIn"),
    isAuthenticated: () => {
      calls.push("isAuthenticated");
      return Promise.resolve(false);
    },
    getPlayer: () => {
      calls.push("getPlayer");
      return Promise.resolve(null);
    },
  };
}

/** A Proxy over a provider that records every property read at all. */
function touchRecording(provider) {
  const touched = [];
  const proxy = new Proxy(provider, {
    get(target, prop, receiver) {
      touched.push(prop);
      return Reflect.get(target, prop, receiver);
    },
  });
  return { proxy, touched };
}

function recordingSettings(initial = {}) {
  const values = { compete: true, pgsWelcomed: false, ...initial };
  const writes = [];
  let reads = 0;
  return {
    writes,
    values,
    get reads() {
      return reads;
    },
    read: async () => {
      reads += 1;
      return { ...values };
    },
    write: (key, value) => {
      writes.push([key, value]);
      ALL_WRITES.push([key, value]);
      values[key] = value;
      return Promise.resolve({ ...values });
    },
  };
}

function fakeTimers() {
  let next = 1;
  const live = new Map();
  return {
    live,
    setTimer: (fn, ms) => {
      const id = next++;
      live.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id) => {
      live.delete(id);
    },
    fireAll() {
      for (const [id, t] of [...live]) {
        live.delete(id);
        t.fn();
      }
    },
  };
}

async function flush() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
}

function make({ settingsInit = {}, timeoutMs, provider } = {}) {
  const prov = provider || scriptedProvider();
  const settings = recordingSettings(settingsInit);
  const notes = [];
  const timers = fakeTimers();
  const opts = {
    provider: prov,
    settings: { read: settings.read, write: settings.write },
    notify: (card) => notes.push(card),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  };
  if (timeoutMs !== undefined) opts.timeoutMs = timeoutMs;
  const ctl = createAccountController(opts);
  const changes = [];
  ctl.subscribe((s) => changes.push(s));
  return { ctl, provider: prov, settings, notes, timers, changes };
}

// ─── the API shape ───────────────────────────────────────────────────────

test("createAccountController returns a frozen API with the nine methods", () => {
  const { ctl } = make();
  assert.ok(Object.isFrozen(ctl));
  for (const m of ["boot", "signIn", "setCompete", "stopCompeting", "state", "identity", "chipView", "sheetView", "subscribe"]) {
    assert.equal(typeof ctl[m], "function", m);
  }
});

test("before boot: the state is pending with Compete ON, and the chip shows the pending face", () => {
  const { ctl, provider } = make();
  assert.equal(ctl.state().status, "pending");
  assert.equal(ctl.state().compete, true);
  assert.equal(ctl.chipView().face, "pending");
  assert.deepEqual(ctl.chipView(), accountChipView(ctl.state()));
  assert.deepEqual(ctl.sheetView(), accountSheetView(ctl.state()));
  assert.equal(provider.calls.length, 0);
});

// ─── boot (D-01 / D-02) ──────────────────────────────────────────────────

test("boot with Compete OFF: status off, zero provider calls or reads, no notify, no write, one change", async () => {
  const { proxy, touched } = touchRecording(scriptedProvider());
  const { ctl, settings, notes, changes, timers } = make({ settingsInit: { compete: false }, provider: proxy });
  await ctl.boot();
  await flush();
  assert.equal(ctl.state().status, "off");
  assert.equal(ctl.state().compete, false);
  assert.deepEqual(touched, [], "the provider is never touched with Compete OFF (D-02)");
  assert.equal(notes.length, 0);
  assert.equal(settings.writes.length, 0);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].status, "off");
  assert.equal(timers.live.size, 0);
  assert.equal(ctl.chipView().face, "nobody");
});

test("boot with Compete ON: emits pending, calls init() once, and resolves without waiting on init", async () => {
  const { ctl, provider, changes } = make();
  await ctl.boot();
  assert.deepEqual(provider.calls, ["init"]);
  assert.equal(ctl.state().status, "pending");
  assert.equal(changes.length, 1);
  assert.equal(changes[0].status, "pending");
  // init has not settled yet — boot resolved anyway (D-01: non-blocking)
  assert.equal(provider.pending.init.length, 1);
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
});

test("boot called twice returns the same promise and starts one attempt", async () => {
  const { ctl, provider } = make();
  const a = ctl.boot();
  const b = ctl.boot();
  assert.strictEqual(a, b);
  await a;
  await ctl.boot();
  assert.deepEqual(provider.calls, ["init"]);
});

test("boot tolerates a settings read that rejects: Compete ON, one silent attempt", async () => {
  const provider = scriptedProvider();
  const ctl = createAccountController({
    provider,
    settings: { read: () => Promise.reject(new Error("storage gone")), write: () => Promise.resolve() },
    notify: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
  });
  await ctl.boot();
  assert.deepEqual(provider.calls, ["init"]);
  assert.equal(ctl.state().status, "pending");
});

// ─── the silent result (D-01 / D-04 / D-11) ─────────────────────────────

test("silent sign-in, not yet welcomed: signedIn, identity set, one welcome card, pgsWelcomed persisted once, timer cleared", async () => {
  const { ctl, provider, settings, notes, timers } = make();
  await ctl.boot();
  assert.equal(timers.live.size, 1, "the silent attempt arms its timeout");
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
  assert.deepEqual(ctl.identity(), { signedIn: true, player: { id: PLAYER.id, displayName: PLAYER.displayName } });
  assert.deepEqual(notes, [accountCard("welcome")]);
  assert.deepEqual(settings.writes, [["pgsWelcomed", true]]);
  assert.equal(ctl.state().welcomed, true);
  assert.equal(timers.live.size, 0, "the timeout is cleared when init settles first");
  assert.equal(ctl.chipView().face, "avatar");
});

test("silent sign-in, already welcomed: signedIn with no card and no write", async () => {
  const { ctl, provider, settings, notes } = make({ settingsInit: { pgsWelcomed: true } });
  await ctl.boot();
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
  assert.equal(notes.length, 0);
  assert.equal(settings.writes.length, 0);
});

test("silent signed-out result: signedOut, one failed card, no further provider call, no timer left", async () => {
  const { ctl, provider, settings, notes, timers } = make();
  await ctl.boot();
  provider.pending.init[0].resolve({ signedIn: false, player: null });
  await flush();
  assert.equal(ctl.state().status, "signedOut");
  assert.deepEqual(ctl.identity(), { signedIn: false, player: null });
  assert.deepEqual(notes, [accountCard("failed")]);
  assert.deepEqual(provider.calls, ["init"]);
  assert.equal(timers.live.size, 0, "no retry is scheduled (D-11)");
  assert.equal(settings.writes.length, 0);
});

test("init rejects: treated as signed out with the failed card; the controller never rejects", async () => {
  const { ctl, provider, notes } = make();
  await ctl.boot();
  provider.pending.init[0].reject(new Error("SDK exploded"));
  await flush();
  assert.equal(ctl.state().status, "signedOut");
  assert.deepEqual(notes, [accountCard("failed")]);
});

test("init throws synchronously: treated as signed out with the failed card; boot still resolves", async () => {
  const provider = {
    calls: [],
    init() {
      this.calls.push("init");
      throw new Error("sync boom");
    },
    signIn() {
      this.calls.push("signIn");
      throw new Error("sync boom");
    },
  };
  const { ctl, notes, timers } = make({ provider });
  await assert.doesNotReject(ctl.boot());
  await flush();
  assert.equal(ctl.state().status, "signedOut");
  assert.deepEqual(notes, [accountCard("failed")]);
  assert.equal(timers.live.size, 0);
  // and the interactive path swallows a throw too
  await assert.doesNotReject(Promise.resolve(ctl.signIn()));
  await flush();
  assert.equal(ctl.state().status, "signedOut");
  assert.equal(notes.length, 2);
});

test("a malformed init result (null, a string, signedIn truthy but not true) reads as signed out", async () => {
  for (const bad of [null, "yes", { signedIn: 1, player: PLAYER }, undefined]) {
    const { ctl, provider, notes } = make();
    await ctl.boot();
    provider.pending.init[0].resolve(bad);
    await flush();
    assert.equal(ctl.state().status, "signedOut", JSON.stringify(bad));
    assert.deepEqual(notes, [accountCard("failed")]);
  }
});

// ─── the silent timeout ──────────────────────────────────────────────────

test("silent timeout: the default is 20000ms; firing it signs out with the failed card; a late signed-in init is discarded", async () => {
  const { ctl, provider, notes, timers } = make();
  await ctl.boot();
  assert.equal(timers.live.size, 1);
  assert.equal([...timers.live.values()][0].ms, 20000);
  timers.fireAll();
  await flush();
  assert.equal(ctl.state().status, "signedOut");
  assert.deepEqual(notes, [accountCard("failed")]);
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedOut", "the late result is dropped");
  assert.equal(notes.length, 1, "no welcome card from a discarded result");
  assert.deepEqual(provider.calls, ["init"], "no retry after the timeout");
});

test("silent timeout honours an injected timeoutMs", async () => {
  const { ctl, timers } = make({ timeoutMs: 1234 });
  await ctl.boot();
  assert.equal([...timers.live.values()][0].ms, 1234);
});

// ─── the interactive attempt (Sign in, D-11) ────────────────────────────

async function signedOutController(opts) {
  const h = make(opts);
  await h.ctl.boot();
  h.provider.pending.init[0].resolve({ signedIn: false, player: null });
  await flush();
  h.notes.length = 0;
  h.changes.length = 0;
  return h;
}

test("signIn from signed out: one provider.signIn(), pending, then signedIn with the welcome card (first time)", async () => {
  const { ctl, provider, notes, settings, timers } = await signedOutController();
  ctl.signIn();
  assert.equal(ctl.state().status, "pending");
  assert.deepEqual(provider.calls, ["init", "signIn"]);
  assert.equal(timers.live.size, 0, "no timeout applies to the interactive attempt");
  provider.pending.signIn[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
  assert.deepEqual(notes, [accountCard("welcome")]);
  assert.deepEqual(settings.writes, [["pgsWelcomed", true]]);
});

test("signIn when already welcomed: signedIn with no card", async () => {
  const { ctl, provider, notes, settings } = await signedOutController({ settingsInit: { pgsWelcomed: true } });
  ctl.signIn();
  provider.pending.signIn[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
  assert.equal(notes.length, 0);
  assert.equal(settings.writes.length, 0);
});

test("signIn declined: signedOut with one failed card, and nothing scheduled", async () => {
  const { ctl, provider, notes, timers } = await signedOutController();
  ctl.signIn();
  provider.pending.signIn[0].resolve({ signedIn: false, player: null });
  await flush();
  assert.equal(ctl.state().status, "signedOut");
  assert.deepEqual(notes, [accountCard("failed")]);
  assert.equal(timers.live.size, 0);
  assert.deepEqual(provider.calls, ["init", "signIn"]);
});

test("the welcome card shows at most once per controller: sign in, stop, compete again, sign in again → one card", async () => {
  const { ctl, provider, notes, settings } = make();
  await ctl.boot();
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  ctl.setCompete(false);
  ctl.setCompete(true);
  provider.pending.init[1].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
  assert.deepEqual(notes, [accountCard("welcome")]);
  assert.equal(settings.writes.filter(([k]) => k === "pgsWelcomed").length, 1);
});

// ─── concurrency (ACCT-02 edge rows) ────────────────────────────────────

test("signIn is ignored while pending (before and during boot), when signed in, and with Compete OFF", async () => {
  // pending before boot
  const a = make();
  a.ctl.signIn();
  assert.deepEqual(a.provider.calls, []);
  // pending during the silent attempt
  await a.ctl.boot();
  a.ctl.signIn();
  assert.deepEqual(a.provider.calls, ["init"]);
  // signed in
  a.provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  a.ctl.signIn();
  assert.deepEqual(a.provider.calls, ["init"]);
  // Compete OFF
  const b = make({ settingsInit: { compete: false } });
  await b.ctl.boot();
  b.ctl.signIn();
  assert.deepEqual(b.provider.calls, []);
  assert.equal(b.ctl.state().status, "off");
});

test("two rapid signIn() calls make one provider call", async () => {
  const { ctl, provider } = await signedOutController();
  ctl.signIn();
  ctl.signIn();
  assert.deepEqual(provider.calls, ["init", "signIn"]);
});

test("a result from an older attempt is discarded once a newer attempt began", async () => {
  const { ctl, provider, notes } = make();
  await ctl.boot();
  // Compete OFF then ON starts a second silent attempt while the first is in flight
  ctl.setCompete(false);
  ctl.setCompete(true);
  assert.deepEqual(provider.calls, ["init", "init"]);
  provider.pending.init[0].resolve({ signedIn: true, player: OTHER });
  await flush();
  assert.equal(ctl.state().status, "pending", "the first attempt's result is stale");
  assert.equal(notes.length, 0);
  provider.pending.init[1].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
  assert.equal(ctl.identity().player.displayName, PLAYER.displayName);
});

// ─── Compete (D-02 / D-03) ───────────────────────────────────────────────

test("setCompete(false) while pending: off at once, compete false persisted, the later signed-in result is discarded", async () => {
  const { ctl, provider, settings, notes, timers } = make();
  await ctl.boot();
  ctl.setCompete(false);
  assert.equal(ctl.state().status, "off");
  assert.deepEqual(settings.writes, [["compete", false]]);
  assert.equal(timers.live.size, 0, "the silent timeout is cancelled with the attempt");
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "off", "Compete OFF always wins");
  assert.equal(notes.length, 0);
  assert.deepEqual(settings.writes, [["compete", false]]);
});

test("setCompete(false) when signed in: off, identity signed out, compete false persisted, no provider call of any kind", async () => {
  const { ctl, provider, settings, notes } = make({ settingsInit: { pgsWelcomed: true } });
  await ctl.boot();
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  const before = [...provider.calls];
  ctl.setCompete(false);
  await flush();
  assert.equal(ctl.state().status, "off");
  assert.equal(ctl.state().player, null);
  assert.deepEqual(ctl.identity(), { signedIn: false, player: null });
  assert.deepEqual(settings.writes, [["compete", false]]);
  assert.deepEqual(provider.calls, before, "no sign-out call: the provider has none (D-03)");
  assert.equal(notes.length, 0);
  assert.equal(ctl.chipView().face, "nobody");
});

test("stopCompeting() behaves exactly like setCompete(false)", async () => {
  const { ctl, provider, settings } = make({ settingsInit: { pgsWelcomed: true } });
  await ctl.boot();
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  ctl.stopCompeting();
  assert.equal(ctl.state().status, "off");
  assert.deepEqual(settings.writes, [["compete", false]]);
  assert.deepEqual(provider.calls, ["init"]);
  // and a second stop is a no-op
  ctl.stopCompeting();
  assert.deepEqual(settings.writes, [["compete", false]]);
});

test("setCompete to its current value is a no-op: no write, no provider call, no emit", async () => {
  const on = make();
  await on.ctl.boot();
  on.changes.length = 0;
  on.ctl.setCompete(true);
  assert.equal(on.settings.writes.length, 0);
  assert.deepEqual(on.provider.calls, ["init"]);
  assert.equal(on.changes.length, 0);

  const off = make({ settingsInit: { compete: false } });
  await off.ctl.boot();
  off.changes.length = 0;
  off.ctl.setCompete(false);
  assert.equal(off.settings.writes.length, 0);
  assert.deepEqual(off.provider.calls, []);
  assert.equal(off.changes.length, 0);
});

test("setCompete(true) from off: compete true persisted, one silent init, and a failure raises the failed card", async () => {
  const { ctl, provider, settings, notes, timers } = make({ settingsInit: { compete: false } });
  await ctl.boot();
  ctl.setCompete(true);
  assert.deepEqual(settings.writes, [["compete", true]]);
  assert.deepEqual(provider.calls, ["init"], "silent, never the interactive signIn()");
  assert.equal(ctl.state().status, "pending");
  assert.equal(ctl.state().compete, true);
  assert.equal(timers.live.size, 1, "the silent timeout applies");
  provider.pending.init[0].resolve({ signedIn: false, player: null });
  await flush();
  assert.equal(ctl.state().status, "signedOut");
  assert.deepEqual(notes, [accountCard("failed")]);
});

test("setCompete(true) from off, signing in silently, applies the result as at boot", async () => {
  const { ctl, provider, notes } = make({ settingsInit: { compete: false, pgsWelcomed: true } });
  await ctl.boot();
  ctl.setCompete(true);
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
  assert.equal(notes.length, 0);
});

test("setCompete coerces: only true (or the string \"true\") turns Compete on", async () => {
  const { ctl, provider, settings } = make({ settingsInit: { compete: false } });
  await ctl.boot();
  ctl.setCompete("false");
  ctl.setCompete(0);
  ctl.setCompete(undefined);
  assert.equal(ctl.state().status, "off");
  assert.equal(settings.writes.length, 0);
  assert.deepEqual(provider.calls, []);
  ctl.setCompete("true");
  assert.equal(ctl.state().compete, true);
  assert.deepEqual(settings.writes, [["compete", true]]);
});

test("Compete OFF chosen while boot is still reading settings wins over the stored value", async () => {
  const provider = scriptedProvider();
  const read = deferred();
  const writes = [];
  const ctl = createAccountController({
    provider,
    settings: { read: () => read.promise, write: (k, v) => (writes.push([k, v]), ALL_WRITES.push([k, v]), Promise.resolve()) },
    notify: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
  });
  const booting = ctl.boot();
  ctl.setCompete(false);
  read.resolve({ compete: true, pgsWelcomed: false });
  await booting;
  await flush();
  assert.equal(ctl.state().status, "off");
  assert.deepEqual(provider.calls, []);
  assert.deepEqual(writes, [["compete", false]]);
});

test("a settings.write that throws or rejects never breaks the controller", async () => {
  const provider = scriptedProvider();
  const notes = [];
  const ctl = createAccountController({
    provider,
    settings: {
      read: async () => ({ compete: true, pgsWelcomed: false }),
      write: (key) => {
        if (key === "compete") throw new Error("sync write failure");
        return Promise.reject(new Error("async write failure"));
      },
    },
    notify: (c) => notes.push(c),
    setTimer: () => 1,
    clearTimer: () => {},
  });
  await ctl.boot();
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
  assert.deepEqual(notes, [accountCard("welcome")]);
  assert.doesNotThrow(() => ctl.setCompete(false));
  assert.equal(ctl.state().status, "off");
});

test("a notify that throws never breaks the controller", async () => {
  const provider = scriptedProvider();
  const ctl = createAccountController({
    provider,
    settings: { read: async () => ({ compete: true, pgsWelcomed: false }), write: () => Promise.resolve() },
    notify: () => {
      throw new Error("rail is down");
    },
    setTimer: () => 1,
    clearTimer: () => {},
  });
  await ctl.boot();
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.equal(ctl.state().status, "signedIn");
});

// ─── subscriptions ───────────────────────────────────────────────────────

test("subscribe: each listener receives every new state snapshot; unsubscribe stops delivery", async () => {
  const { ctl, provider } = make({ settingsInit: { pgsWelcomed: true } });
  const seen = [];
  const off = ctl.subscribe((s) => seen.push(s.status));
  await ctl.boot();
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.deepEqual(seen, ["pending", "signedIn"]);
  off();
  ctl.setCompete(false);
  assert.deepEqual(seen, ["pending", "signedIn"]);
  assert.equal(ctl.state().status, "off");
});

test("subscribe: the snapshot a listener receives is the frozen current state", async () => {
  const { ctl } = make({ settingsInit: { compete: false } });
  let got = null;
  ctl.subscribe((s) => {
    got = s;
  });
  await ctl.boot();
  assert.ok(Object.isFrozen(got));
  assert.strictEqual(got, ctl.state());
});

test("subscribe: a throwing listener does not stop the others or the controller", async () => {
  const { ctl, provider } = make({ settingsInit: { pgsWelcomed: true } });
  const seen = [];
  ctl.subscribe(() => {
    throw new Error("listener bug");
  });
  ctl.subscribe((s) => seen.push(s.status));
  await ctl.boot();
  provider.pending.init[0].resolve({ signedIn: true, player: PLAYER });
  await flush();
  assert.deepEqual(seen, ["pending", "signedIn"]);
  assert.equal(ctl.state().status, "signedIn");
});

test("subscribe with a non-function returns a harmless unsubscribe", () => {
  const { ctl } = make();
  const off = ctl.subscribe(null);
  assert.equal(typeof off, "function");
  assert.doesNotThrow(() => off());
});

// ─── persistence pins ────────────────────────────────────────────────────

test("write-keys pin: every settings.write in this file used compete or pgsWelcomed with a boolean, never the player's id or name", () => {
  assert.ok(ALL_WRITES.length > 0, "the suite exercised writes");
  for (const [key, value] of ALL_WRITES) {
    assert.ok(key === "compete" || key === "pgsWelcomed", `unexpected settings key: ${key}`);
    assert.equal(typeof value, "boolean", `non-boolean written for ${key}`);
    for (const p of [PLAYER, OTHER]) {
      assert.notEqual(value, p.id);
      assert.notEqual(value, p.displayName);
    }
  }
});

test("source pins: the controller calls only provider.init() and provider.signIn(), writes only compete/pgsWelcomed, and names no plugin", () => {
  assert.equal((MODULE_SRC.match(/export function createAccountController/g) || []).length, 1);
  const providerCalls = [...STRIPPED.matchAll(/provider\.(\w+)\s*\(/g)].map((m) => m[1]);
  assert.ok(providerCalls.length > 0);
  for (const m of providerCalls) assert.ok(m === "init" || m === "signIn", `unexpected provider call: ${m}`);
  assert.doesNotMatch(STRIPPED, /signOut/);
  assert.doesNotMatch(STRIPPED, /capacitor-play-games/);
  assert.match(STRIPPED, /from "\.\/account\.js"/);
  const persisted = [...STRIPPED.matchAll(/persist\(\s*"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(persisted)].sort(), ["compete", "pgsWelcomed"]);
});
