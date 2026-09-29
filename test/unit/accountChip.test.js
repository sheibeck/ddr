// test/unit/accountChip.test.js
//
// Phase 85 (ACCT-03/05, 85-CONTEXT group 1), Plan 03 Task 2 — the account
// controller (createAccountController) for our own board: boot (the handle
// from identity.ensureHandle(), Compete from settings unless the player
// already chose), setCompete (purge the board queue on OFF, flush on ON),
// reroll (board.reroll()), the two-tap erase (arm/expire/erase/notify),
// boardAcked's welcome-once card, and subscribe. Replaces every test of the
// retired sign-on flow (its silent-attempt timeout and its injected
// game-service seam): "boot with Compete OFF/ON", "the silent result",
// "the silent timeout", "the interactive attempt (Sign in)", "signIn is
// ignored while pending...", "Compete OFF chosen while boot is still
// reading settings wins over the stored value" survive in spirit (renamed
// for the new seams); "silent sign-in ...", "signIn from signed out ...",
// "signIn declined ...", "a malformed init result ..." and every
// provider-shaped test are gone with the provider they scripted.
//
// Every collaborator is a fake: a scripted identity/board pair whose calls
// return deferred promises the test settles, recording settings
// { read, write }, a recording notify and a manual timer
// (setTimer/clearTimer).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { createAccountController, ERASE_ARM_MS } from "../../src/browser/accountChip.js";
import { accountCard, accountChipView, accountSheetView, accountMenuView } from "../../src/browser/account.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MODULE_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "accountChip.js"), "utf8").replace(/\r\n/g, "\n");
const STRIPPED = stripJs(MODULE_SRC);

const HANDLE = "@lanternjaw";
const HANDLE2 = "@sootboot";

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

/** scriptedIdentity(handle) — ensureHandle() returns a deferred the test settles; resolveNext() settles the latest call. */
function scriptedIdentity(handle = HANDLE) {
  const calls = [];
  const pending = { ensureHandle: [] };
  return {
    calls,
    pending,
    ensureHandle: () => {
      calls.push("ensureHandle");
      const d = deferred();
      pending.ensureHandle.push(d);
      return d.promise;
    },
    resolveNext(h = handle) {
      pending.ensureHandle[pending.ensureHandle.length - 1].resolve(h);
    },
  };
}

/** scriptedBoard() — reroll()/erase() return deferreds the test settles; purge()/flush() resolve at once but are logged. */
function scriptedBoard() {
  const calls = [];
  const pending = { reroll: [], erase: [] };
  return {
    calls,
    pending,
    reroll: () => {
      calls.push("reroll");
      const d = deferred();
      pending.reroll.push(d);
      return d.promise;
    },
    erase: () => {
      calls.push("erase");
      const d = deferred();
      pending.erase.push(d);
      return d.promise;
    },
    purge: () => {
      calls.push("purge");
      return Promise.resolve();
    },
    flush: (opts) => {
      calls.push(`flush:${JSON.stringify(opts)}`);
      return Promise.resolve();
    },
  };
}

function recordingSettings(initial = {}) {
  const values = { compete: true, boardWelcomed: false, ...initial };
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

function make({ settingsInit = {}, identity, board, compete } = {}) {
  const ident = identity || scriptedIdentity();
  const brd = board || scriptedBoard();
  const settings = recordingSettings(settingsInit);
  const notes = [];
  const timers = fakeTimers();
  const opts = {
    identity: ident,
    board: brd,
    settings: { read: settings.read, write: settings.write },
    notify: (card) => notes.push(card),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  };
  if (compete !== undefined) opts.compete = compete;
  const ctl = createAccountController(opts);
  const changes = [];
  ctl.subscribe((s) => changes.push(s));
  return { ctl, identity: ident, board: brd, settings, notes, timers, changes };
}

// ─── the API shape ───────────────────────────────────────────────────────

test("createAccountController returns a frozen API with the eleven methods", () => {
  const { ctl } = make();
  assert.ok(Object.isFrozen(ctl));
  const keys = ["boot", "setCompete", "reroll", "eraseTap", "disarmErase", "boardAcked", "state", "chipView", "sheetView", "menuView", "subscribe"];
  for (const m of keys) assert.equal(typeof ctl[m], "function", m);
  assert.deepStrictEqual(Object.keys(ctl).sort(), [...keys].sort());
});

test("before boot: handle null, erase idle, welcomed false, and the views agree with the pure model; the identity seam is untouched", () => {
  const { ctl, identity } = make({ compete: true });
  assert.equal(ctl.state().handle, null);
  assert.equal(ctl.state().erase, "idle");
  assert.equal(ctl.state().welcomed, false);
  assert.equal(ctl.state().compete, true);
  assert.deepEqual(ctl.chipView(), accountChipView(ctl.state()));
  assert.deepEqual(ctl.sheetView(), accountSheetView(ctl.state()));
  assert.deepEqual(ctl.menuView(), accountMenuView(ctl.state()));
  assert.equal(identity.calls.length, 0);
});

test("the seeded compete value survives until boot() runs", () => {
  const { ctl } = make({ compete: false });
  assert.equal(ctl.state().compete, false);
});

// ─── boot ────────────────────────────────────────────────────────────────

test("boot: reads settings once, sets the handle from identity.ensureHandle(), never touches the board", async () => {
  const { ctl, identity, board, settings, changes } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  assert.equal(ctl.state().handle, HANDLE);
  assert.equal(settings.reads, 1);
  assert.deepEqual(board.calls, []);
  assert.ok(changes.length >= 1);
});

test("boot: applies the stored compete value unless the player already chose", async () => {
  const { ctl, identity } = make({ settingsInit: { compete: false } });
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  assert.equal(ctl.state().compete, false);
});

test("boot: a setCompete() call before boot resolves wins over the stored value", async () => {
  const settings = recordingSettings({ compete: true });
  const read = deferred();
  settings.read = () => {
    settings.reads = (settings.reads || 0) + 1;
    return read.promise;
  };
  const identity = scriptedIdentity();
  const board = scriptedBoard();
  const ctl = createAccountController({
    identity,
    board,
    settings: { read: settings.read, write: settings.write },
    notify: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
  });
  const booting = ctl.boot();
  ctl.setCompete(false);
  read.resolve({ compete: true, boardWelcomed: false });
  identity.resolveNext(HANDLE);
  await booting;
  await flush();
  assert.equal(ctl.state().compete, false);
  assert.deepEqual(board.calls, ["purge"]);
});

test("boot: welcomed becomes true when settings carries boardWelcomed true", async () => {
  const { ctl, identity } = make({ settingsInit: { boardWelcomed: true } });
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  assert.equal(ctl.state().welcomed, true);
});

test("boot: a throwing/rejecting identity seam leaves the handle null; boot still resolves", async () => {
  const identity = { ensureHandle: () => Promise.reject(new Error("offline")) };
  const { ctl } = make({ identity });
  await assert.doesNotReject(ctl.boot());
  assert.equal(ctl.state().handle, null);
});

test("boot: a settings read that rejects is tolerated (handle still set, compete stays seeded)", async () => {
  const identity = scriptedIdentity();
  const board = scriptedBoard();
  const ctl = createAccountController({
    identity,
    board,
    settings: { read: () => Promise.reject(new Error("storage gone")), write: () => Promise.resolve() },
    notify: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
    compete: true,
  });
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  assert.equal(ctl.state().handle, HANDLE);
  assert.equal(ctl.state().compete, true);
});

test("boot called twice returns the same promise and reads settings once", async () => {
  const { ctl, identity, settings } = make();
  const a = ctl.boot();
  const b = ctl.boot();
  assert.strictEqual(a, b);
  identity.resolveNext(HANDLE);
  await a;
  await ctl.boot();
  assert.equal(settings.reads, 1);
});

// ─── setCompete ──────────────────────────────────────────────────────────

test("setCompete(false): emits at once, disarms an armed erase row, persists compete false, calls board.purge() once, no flush", async () => {
  const { ctl, identity, board, settings, timers } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.eraseTap(); // arm it
  assert.equal(ctl.state().erase, "armed");
  ctl.setCompete(false);
  assert.equal(ctl.state().compete, false);
  assert.equal(ctl.state().erase, "idle", "the erase row disarms with Compete off");
  assert.deepEqual(settings.writes, [["compete", false]]);
  assert.deepEqual(board.calls, ["purge"]);
  assert.equal(timers.live.size, 0, "the erase-arm timer is cleared");
});

test("setCompete(true) from off: emits, persists, calls board.flush({force:true}) once", async () => {
  const { ctl, identity, board, settings } = make({ settingsInit: { compete: false } });
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.setCompete(true);
  assert.equal(ctl.state().compete, true);
  assert.deepEqual(settings.writes, [["compete", true]]);
  assert.deepEqual(board.calls, ['flush:{"force":true}']);
});

test("setCompete to its current value is a no-op: no write, no board call, no emit", async () => {
  const { ctl, identity, board, settings, changes } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  changes.length = 0;
  ctl.setCompete(true);
  assert.equal(settings.writes.length, 0);
  assert.deepEqual(board.calls, []);
  assert.equal(changes.length, 0);
});

test('setCompete coerces: only true (or the string "true") turns Compete on', async () => {
  const { ctl, identity, board, settings } = make({ settingsInit: { compete: false } });
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.setCompete("false");
  ctl.setCompete(0);
  ctl.setCompete(undefined);
  assert.equal(ctl.state().compete, false);
  assert.equal(settings.writes.length, 0);
  assert.deepEqual(board.calls, []);
  ctl.setCompete("true");
  assert.equal(ctl.state().compete, true);
  assert.deepEqual(settings.writes, [["compete", true]]);
});

test("a settings.write or board call that throws or rejects never breaks the controller", async () => {
  const identity = scriptedIdentity();
  const board = {
    calls: [],
    reroll: () => Promise.reject(new Error("x")),
    erase: () => Promise.reject(new Error("x")),
    purge: () => {
      throw new Error("sync purge failure");
    },
    flush: () => Promise.reject(new Error("async flush failure")),
  };
  const ctl = createAccountController({
    identity,
    board,
    settings: {
      read: async () => ({ compete: true, boardWelcomed: false }),
      write: (key) => {
        if (key === "compete") throw new Error("sync write failure");
        return Promise.reject(new Error("async write failure"));
      },
    },
    notify: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
  });
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  assert.doesNotThrow(() => ctl.setCompete(false));
  assert.equal(ctl.state().compete, false);
  assert.doesNotThrow(() => ctl.setCompete(true));
  assert.equal(ctl.state().compete, true);
});

// ─── reroll ──────────────────────────────────────────────────────────────

test("reroll(): calls board.reroll() once, and a valid returned handle replaces the state's handle", async () => {
  const { ctl, identity, board } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.reroll();
  assert.deepEqual(board.calls, ["reroll"]);
  board.pending.reroll[0].resolve({ handle: HANDLE2, previous: HANDLE });
  await flush();
  assert.equal(ctl.state().handle, HANDLE2);
});

test("reroll(): a second call while one is in flight is ignored", async () => {
  const { ctl, identity, board } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.reroll();
  ctl.reroll();
  assert.deepEqual(board.calls, ["reroll"]);
  board.pending.reroll[0].resolve({ handle: HANDLE2 });
  await flush();
  ctl.reroll();
  assert.deepEqual(board.calls, ["reroll", "reroll"]);
});

test("reroll(): with no handle yet, does nothing", () => {
  const { ctl, board } = make();
  ctl.reroll();
  assert.deepEqual(board.calls, []);
});

test("reroll(): an invalid or rejected result leaves the handle unchanged", async () => {
  const { ctl, identity, board } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.reroll();
  board.pending.reroll[0].resolve({ handle: "not-a-handle" });
  await flush();
  assert.equal(ctl.state().handle, HANDLE);
  ctl.reroll();
  board.pending.reroll[1].reject(new Error("offline"));
  await flush();
  assert.equal(ctl.state().handle, HANDLE);
});

// ─── eraseTap / disarmErase ──────────────────────────────────────────────

test("eraseTap(): idle -> armed, arming a single timer of armMs", async () => {
  const { ctl, identity, timers } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.eraseTap();
  assert.equal(ctl.state().erase, "armed");
  assert.equal(timers.live.size, 1);
  assert.equal([...timers.live.values()][0].ms, ERASE_ARM_MS);
});

test("eraseTap(): armed -> a second tap calls board.erase() once; ok -> one erased card naming the handle, then idle", async () => {
  const { ctl, identity, board, notes } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.eraseTap();
  ctl.eraseTap();
  assert.equal(ctl.state().erase, "busy");
  assert.deepEqual(board.calls, ["erase"]);
  board.pending.erase[0].resolve({ ok: true, deleted: 3 });
  await flush();
  assert.equal(ctl.state().erase, "idle");
  assert.deepEqual(notes, [accountCard("erased", HANDLE)]);
});

test("eraseTap(): a failure result raises one eraseFailed card, then idle; a rejection does the same", async () => {
  const { ctl, identity, board, notes } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.eraseTap();
  ctl.eraseTap();
  board.pending.erase[0].resolve({ ok: false, reason: "offline" });
  await flush();
  assert.equal(ctl.state().erase, "idle");
  assert.deepEqual(notes, [accountCard("eraseFailed")]);

  ctl.eraseTap();
  ctl.eraseTap();
  board.pending.erase[1].reject(new Error("boom"));
  await flush();
  assert.equal(ctl.state().erase, "idle");
  assert.deepEqual(notes, [accountCard("eraseFailed"), accountCard("eraseFailed")]);
});

test("eraseTap(): busy ignores taps", async () => {
  const { ctl, identity, board } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.eraseTap();
  ctl.eraseTap();
  assert.equal(ctl.state().erase, "busy");
  ctl.eraseTap();
  assert.deepEqual(board.calls, ["erase"], "no second board.erase() call while busy");
});

test("eraseTap(): with Compete off or no handle, does nothing", async () => {
  const off = make({ settingsInit: { compete: false } });
  const boot1 = off.ctl.boot();
  off.identity.resolveNext(HANDLE);
  await boot1;
  off.ctl.eraseTap();
  assert.equal(off.ctl.state().erase, "idle");
  assert.deepEqual(off.board.calls, []);

  const noHandle = make();
  noHandle.ctl.eraseTap();
  assert.equal(noHandle.ctl.state().erase, "idle");
});

test("the erase-arm timer firing disarms back to idle with no board call", async () => {
  const { ctl, identity, board, timers } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.eraseTap();
  timers.fireAll();
  assert.equal(ctl.state().erase, "idle");
  assert.deepEqual(board.calls, []);
});

test("disarmErase(): returns an armed row to idle and clears the timer; a no-op when idle or busy", async () => {
  const { ctl, identity, timers } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.disarmErase();
  assert.equal(ctl.state().erase, "idle");
  ctl.eraseTap();
  assert.equal(ctl.state().erase, "armed");
  ctl.disarmErase();
  assert.equal(ctl.state().erase, "idle");
  assert.equal(timers.live.size, 0);
});

// ─── boardAcked (the welcome-once card) ───────────────────────────────────

test("boardAcked(): the first call ever persists boardWelcomed true and raises one welcome card naming the handle", async () => {
  const { ctl, identity, settings, notes } = make();
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.boardAcked();
  assert.equal(ctl.state().welcomed, true);
  assert.deepEqual(settings.writes, [["boardWelcomed", true]]);
  assert.deepEqual(notes, [accountCard("welcome", HANDLE)]);
  ctl.boardAcked();
  assert.equal(notes.length, 1, "a second call raises nothing");
  assert.equal(settings.writes.length, 1);
});

test("boardAcked(): boot having read boardWelcomed true raises nothing", async () => {
  const { ctl, identity, settings, notes } = make({ settingsInit: { boardWelcomed: true } });
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  ctl.boardAcked();
  assert.equal(notes.length, 0);
  assert.equal(settings.writes.length, 0);
});

// ─── subscribe ─────────────────────────────────────────────────────────

test("subscribe: each listener receives every new state snapshot; unsubscribe stops delivery", async () => {
  const { ctl, identity } = make();
  const seen = [];
  const off = ctl.subscribe((s) => seen.push(s.handle));
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  assert.deepEqual(seen, [HANDLE]);
  off();
  ctl.setCompete(false);
  assert.deepEqual(seen, [HANDLE]);
  assert.equal(ctl.state().compete, false);
});

test("subscribe: the snapshot a listener receives is the frozen current state", async () => {
  const { ctl, identity } = make();
  let got = null;
  ctl.subscribe((s) => {
    got = s;
  });
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  assert.ok(Object.isFrozen(got));
  assert.strictEqual(got, ctl.state());
});

test("subscribe: a throwing listener does not stop the others or the controller", async () => {
  const { ctl, identity } = make();
  const seen = [];
  ctl.subscribe(() => {
    throw new Error("listener bug");
  });
  ctl.subscribe((s) => seen.push(s.handle));
  const booting = ctl.boot();
  identity.resolveNext(HANDLE);
  await booting;
  assert.deepEqual(seen, [HANDLE]);
});

test("subscribe with a non-function returns a harmless unsubscribe", () => {
  const { ctl } = make();
  const off = ctl.subscribe(null);
  assert.equal(typeof off, "function");
  assert.doesNotThrow(() => off());
});

// ─── persistence pins ────────────────────────────────────────────────────

test("write-keys pin: every settings.write in this file used compete or boardWelcomed with a boolean, never a handle", () => {
  assert.ok(ALL_WRITES.length > 0, "the suite exercised writes");
  for (const [key, value] of ALL_WRITES) {
    assert.ok(key === "compete" || key === "boardWelcomed", `unexpected settings key: ${key}`);
    assert.equal(typeof value, "boolean", `non-boolean written for ${key}`);
    assert.notEqual(value, HANDLE);
    assert.notEqual(value, HANDLE2);
  }
});

test("source pins: the controller persists only compete/boardWelcomed, names no plugin or sign-on method, and imports account.js", () => {
  assert.equal((MODULE_SRC.match(/export function createAccountController/g) || []).length, 1);
  const persisted = [...STRIPPED.matchAll(/persist\(\s*"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(persisted)].sort(), ["boardWelcomed", "compete"]);
  assert.doesNotMatch(STRIPPED, /capacitor-play-games/);
  assert.match(STRIPPED, /from "\.\/account\.js"/);
});
