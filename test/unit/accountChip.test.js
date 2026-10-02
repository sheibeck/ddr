// test/unit/accountChip.test.js
//
// Phase 85 (ACCT-03/05) and Phase 91.2 (BOARD-31/33, D-03, D-10, D-11) — the
// account controller (createAccountController) for our own board's Play Games
// account: boot (the stored name from identity.snapshot(), Compete from
// settings unless the player already chose), setCompete (purge the board queue
// on OFF, ask for a session on ON), sessionChanged (the sign-in state, the
// name, the once-per-launch held-runs card), signInTap, the two-tap erase
// (arm/expire/erase/notify), boardAcked's welcome-once card, and subscribe.
// There is no re-roll any more (D-11), and no rolled handle.
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

const NAME = "Moss Knuckle";
const NAME2 = "Dev Delver";

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

/** scriptedIdentity(name) — snapshot() returns the stored name at once (local, no network) and logs the call. */
function scriptedIdentity(name = NAME) {
  const calls = [];
  return {
    calls,
    snapshot: () => {
      calls.push("snapshot");
      return { uid: "u1", name, linked: name !== null, playerId: null };
    },
  };
}

/** scriptedBoard() — session()/signIn()/erase() return deferreds the test settles; purge()/flush() resolve at once; every call is logged. */
function scriptedBoard() {
  const calls = [];
  const pending = { session: [], signIn: [], erase: [] };
  const scripted = (kind) => () => {
    calls.push(kind);
    const d = deferred();
    pending[kind].push(d);
    return d.promise;
  };
  return {
    calls,
    pending,
    session: scripted("session"),
    signIn: scripted("signIn"),
    erase: scripted("erase"),
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
  const values = { compete: true, nameWelcomed: false, ...initial };
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

async function booted(opts) {
  const m = make(opts);
  await m.ctl.boot();
  return m;
}

// ─── the API shape ───────────────────────────────────────────────────────

test("createAccountController returns a frozen API with the eleven methods and no reroll", () => {
  const { ctl } = make();
  assert.ok(Object.isFrozen(ctl));
  const keys = ["boot", "setCompete", "signInTap", "sessionChanged", "eraseTap", "disarmErase", "boardAcked", "state", "chipView", "sheetView", "menuView", "subscribe"];
  for (const m of keys) assert.equal(typeof ctl[m], "function", m);
  assert.deepStrictEqual(Object.keys(ctl).sort(), [...keys].sort());
  assert.equal("reroll" in ctl, false, "no re-roll (D-11)");
});

test("before boot: name null, signin unknown, erase idle, welcomed false, and the views agree with the pure model; the identity seam is untouched", () => {
  const { ctl, identity } = make({ compete: true });
  assert.equal(ctl.state().name, null);
  assert.equal(ctl.state().signin, "unknown");
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

test("boot: reads settings once, takes the name from identity.snapshot(), never touches the board", async () => {
  const { ctl, board, settings, changes, identity } = make();
  await ctl.boot();
  assert.equal(ctl.state().name, NAME);
  assert.equal(settings.reads, 1);
  assert.deepEqual(identity.calls, ["snapshot"]);
  assert.deepEqual(board.calls, []);
  assert.ok(changes.length >= 1);
});

test("boot: the settings read and the identity snapshot start in the same tick", async () => {
  const order = [];
  const identity = { snapshot: () => { order.push("snapshot"); return { name: NAME }; } };
  const ctl = createAccountController({
    identity,
    board: scriptedBoard(),
    settings: { read: async () => { order.push("read"); return {}; }, write: () => Promise.resolve() },
    notify: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
  });
  const p = ctl.boot();
  assert.deepEqual(order, ["snapshot", "read"], "both seams are called before boot() returns");
  await p;
});

test("boot: an async identity snapshot is awaited", async () => {
  const identity = { snapshot: async () => ({ name: NAME2 }) };
  const { ctl } = make({ identity });
  await ctl.boot();
  assert.equal(ctl.state().name, NAME2);
});

test("boot: applies the stored compete value unless the player already chose", async () => {
  const { ctl } = await booted({ settingsInit: { compete: false } });
  assert.equal(ctl.state().compete, false);
});

test("boot: a setCompete() call before boot resolves wins over the stored value", async () => {
  const settings = recordingSettings({ compete: true });
  const read = deferred();
  const board = scriptedBoard();
  const ctl = createAccountController({
    identity: scriptedIdentity(),
    board,
    settings: { read: () => read.promise, write: settings.write },
    notify: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
  });
  const booting = ctl.boot();
  ctl.setCompete(false);
  read.resolve({ compete: true, nameWelcomed: false });
  await booting;
  await flush();
  assert.equal(ctl.state().compete, false);
  assert.deepEqual(board.calls, ["purge"]);
});

test("boot: welcomed becomes true when settings carries nameWelcomed true", async () => {
  const { ctl } = await booted({ settingsInit: { nameWelcomed: true } });
  assert.equal(ctl.state().welcomed, true);
});

test("boot: a throwing/rejecting identity seam leaves the name null; boot still resolves", async () => {
  for (const identity of [{ snapshot: () => Promise.reject(new Error("gone")) }, { snapshot: () => { throw new Error("sync"); } }, {}]) {
    const { ctl } = make({ identity });
    await assert.doesNotReject(ctl.boot());
    assert.equal(ctl.state().name, null);
  }
});

test("boot: a snapshot with no usable name leaves the name null", async () => {
  const { ctl } = await booted({ identity: scriptedIdentity(null) });
  assert.equal(ctl.state().name, null);
});

test("boot: a settings read that rejects is tolerated (name still set, compete stays seeded)", async () => {
  const ctl = createAccountController({
    identity: scriptedIdentity(),
    board: scriptedBoard(),
    settings: { read: () => Promise.reject(new Error("storage gone")), write: () => Promise.resolve() },
    notify: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
    compete: true,
  });
  await ctl.boot();
  assert.equal(ctl.state().name, NAME);
  assert.equal(ctl.state().compete, true);
});

test("boot called twice returns the same promise and reads settings once", async () => {
  const { ctl, settings } = make();
  const a = ctl.boot();
  const b = ctl.boot();
  assert.strictEqual(a, b);
  await a;
  await ctl.boot();
  assert.equal(settings.reads, 1);
});

// ─── setCompete ──────────────────────────────────────────────────────────

test("setCompete(false): emits at once, disarms an armed erase row, persists compete false, calls board.purge() once, no session", async () => {
  const { ctl, board, settings, timers } = await booted();
  ctl.eraseTap(); // arm it
  assert.equal(ctl.state().erase, "armed");
  ctl.setCompete(false);
  assert.equal(ctl.state().compete, false);
  assert.equal(ctl.state().erase, "idle", "the erase row disarms with Compete off");
  assert.deepEqual(settings.writes, [["compete", false]]);
  assert.deepEqual(board.calls, ["purge"]);
  assert.equal(timers.live.size, 0, "the erase-arm timer is cleared");
});

test("setCompete(true) from off (Phase 92.1): emits, persists, runs the interactive sign-in once (board.signIn, not a quiet session or a bare flush)", async () => {
  const { ctl, board, settings } = await booted({ settingsInit: { compete: false } });
  ctl.setCompete(true);
  assert.equal(ctl.state().compete, true);
  assert.equal(ctl.state().signin, "busy", "the row shows SIGNING IN while the prompt is up");
  assert.deepEqual(settings.writes, [["compete", true]]);
  assert.deepEqual(board.calls, ["signIn"]);
  assert.ok(!board.calls.some((c) => c.startsWith("flush")), "no bare flush");
});

test("setCompete(true): the sign-in answer feeds sessionChanged", async () => {
  const { ctl, board } = await booted({ settingsInit: { compete: false } });
  ctl.setCompete(true);
  board.pending.signIn[0].resolve({ state: "signedIn", name: NAME2 });
  await flush();
  assert.equal(ctl.state().signin, "in");
  assert.equal(ctl.state().name, NAME2);
});

test("setCompete(true): the player is being asked right now, so the held-runs notice is moot, and a tap during the prompt is ignored", async () => {
  const { ctl, board, notes } = await booted({ settingsInit: { compete: false } });
  ctl.setCompete(true);
  ctl.signInTap();
  assert.deepEqual(board.calls, ["signIn"], "a tap while the toggle-ON sign-in runs does not start a second one");
  board.pending.signIn[0].resolve({ state: "signedOut" });
  await flush();
  assert.equal(ctl.state().signin, "out");
  assert.equal(notes.filter((c) => /RUNS ARE WAITING/.test(c.title)).length, 0, "no held-runs card after the player was just asked");
});

test("setCompete(false) while the toggle-ON sign-in is running: the late answer changes nothing", async () => {
  const { ctl, board } = await booted({ settingsInit: { compete: false } });
  ctl.setCompete(true);
  ctl.setCompete(false);
  board.pending.signIn[0].resolve({ state: "signedIn", name: NAME2 });
  await flush();
  assert.equal(ctl.state().compete, false);
  assert.notEqual(ctl.state().name, NAME2, "sessionChanged ignores answers while Compete is OFF");
  assert.notEqual(ctl.state().signin, "in");
});

test("setCompete to its current value is a no-op: no write, no board call, no emit", async () => {
  const { ctl, board, settings, changes } = await booted();
  changes.length = 0;
  ctl.setCompete(true);
  assert.equal(settings.writes.length, 0);
  assert.deepEqual(board.calls, []);
  assert.equal(changes.length, 0);
});

test('setCompete coerces: only true (or the string "true") turns Compete on', async () => {
  const { ctl, board, settings } = await booted({ settingsInit: { compete: false } });
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
  const board = {
    session: () => Promise.reject(new Error("x")),
    signIn: () => { throw new Error("sync signIn failure"); },
    erase: () => Promise.reject(new Error("x")),
    purge: () => {
      throw new Error("sync purge failure");
    },
    flush: () => Promise.reject(new Error("async flush failure")),
  };
  const ctl = createAccountController({
    identity: scriptedIdentity(),
    board,
    settings: {
      read: async () => ({ compete: true, nameWelcomed: false }),
      write: (key) => {
        if (key === "compete") throw new Error("sync write failure");
        return Promise.reject(new Error("async write failure"));
      },
    },
    notify: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
  });
  await ctl.boot();
  assert.doesNotThrow(() => ctl.setCompete(false));
  assert.equal(ctl.state().compete, false);
  assert.doesNotThrow(() => ctl.setCompete(true));
  assert.equal(ctl.state().compete, true);
  await flush();
  assert.doesNotThrow(() => ctl.signInTap());
  await flush();
  assert.equal(ctl.state().signin, "out", "a throwing signIn reads as signed out");
});

// ─── sessionChanged ──────────────────────────────────────────────────────

test("sessionChanged(signedIn): signin in and the answer's name replaces the stored one", async () => {
  const { ctl, notes } = await booted({ identity: scriptedIdentity(null) });
  ctl.sessionChanged({ state: "signedIn", name: NAME2 });
  assert.equal(ctl.state().signin, "in");
  assert.equal(ctl.state().name, NAME2);
  assert.equal(notes.length, 0);
});

test("sessionChanged(signedIn) with no usable name keeps the name already held", async () => {
  const { ctl } = await booted();
  ctl.sessionChanged({ state: "signedIn", name: null });
  assert.equal(ctl.state().signin, "in");
  assert.equal(ctl.state().name, NAME);
});

test("sessionChanged(signedOut): signin out and ONE signinNeeded card per launch, however often it repeats", async () => {
  const { ctl, notes } = await booted();
  ctl.sessionChanged({ state: "signedOut", name: null });
  assert.equal(ctl.state().signin, "out");
  assert.deepEqual(notes, [accountCard("signinNeeded")]);
  ctl.sessionChanged({ state: "signedOut", name: null });
  ctl.sessionChanged({ state: "signedIn", name: NAME });
  ctl.sessionChanged({ state: "signedOut", name: null });
  assert.equal(notes.length, 1);
});

test("sessionChanged(signedOut) with Compete OFF does nothing and raises nothing", async () => {
  const { ctl, notes } = await booted({ settingsInit: { compete: false } });
  ctl.sessionChanged({ state: "signedOut", name: null });
  assert.equal(ctl.state().signin, "unknown");
  assert.equal(notes.length, 0);
  ctl.sessionChanged({ state: "signedIn", name: NAME2 });
  assert.equal(ctl.state().signin, "unknown");
  assert.equal(ctl.state().name, NAME);
});

test("sessionChanged(unavailable) sets unavailable and raises nothing", async () => {
  const { ctl, notes } = await booted();
  ctl.sessionChanged({ state: "unavailable" });
  assert.equal(ctl.state().signin, "unavailable");
  assert.equal(notes.length, 0);
});

test("sessionChanged(offline / error / off / junk) leaves the sign-in state and the name alone", async () => {
  const { ctl, notes } = await booted();
  ctl.sessionChanged({ state: "signedIn", name: NAME });
  for (const info of [{ state: "offline" }, { state: "error" }, { state: "off" }, { state: "weird" }, null, undefined, 7, {}]) {
    ctl.sessionChanged(info);
    assert.equal(ctl.state().signin, "in", JSON.stringify(info));
    assert.equal(ctl.state().name, NAME);
  }
  assert.equal(notes.length, 0);
});

test("sessionChanged is total over hostile input", async () => {
  const { ctl } = await booted();
  const hostile = new Proxy({}, { get() { throw new Error("boom"); } });
  assert.doesNotThrow(() => ctl.sessionChanged(hostile));
});

// ─── signInTap ───────────────────────────────────────────────────────────

test("signInTap: busy while board.signIn() runs, then the answer flows through sessionChanged", async () => {
  const { ctl, board } = await booted({ identity: scriptedIdentity(null) });
  ctl.sessionChanged({ state: "signedOut" });
  ctl.signInTap();
  assert.equal(ctl.state().signin, "busy");
  assert.deepEqual(board.calls, ["signIn"]);
  assert.equal(ctl.sheetView().signIn.disabled, true);
  board.pending.signIn[0].resolve({ state: "signedIn", name: NAME });
  await flush();
  assert.equal(ctl.state().signin, "in");
  assert.equal(ctl.state().name, NAME);
});

test("signInTap: a second tap while busy is ignored", async () => {
  const { ctl, board } = await booted();
  ctl.signInTap();
  ctl.signInTap();
  assert.deepEqual(board.calls, ["signIn"]);
  board.pending.signIn[0].resolve({ state: "signedIn", name: NAME });
  await flush();
  ctl.signInTap();
  assert.deepEqual(board.calls, ["signIn", "signIn"]);
});

test("signInTap: a rejection leaves signin out", async () => {
  const { ctl, board } = await booted();
  ctl.signInTap();
  board.pending.signIn[0].reject(new Error("declined"));
  await flush();
  assert.equal(ctl.state().signin, "out");
});

test("signInTap: a declined answer reads as signed out, an unavailable answer as unavailable, an offline answer as out (never stuck busy)", async () => {
  const { ctl, board } = await booted();
  ctl.signInTap();
  board.pending.signIn[0].resolve({ state: "signedOut", name: null });
  await flush();
  assert.equal(ctl.state().signin, "out");
  ctl.signInTap();
  board.pending.signIn[1].resolve({ state: "unavailable" });
  await flush();
  assert.equal(ctl.state().signin, "unavailable");
  ctl.signInTap();
  board.pending.signIn[2].resolve({ state: "offline" });
  await flush();
  assert.equal(ctl.state().signin, "out");
});

test("signInTap with Compete OFF does nothing", async () => {
  const { ctl, board } = await booted({ settingsInit: { compete: false } });
  ctl.signInTap();
  assert.equal(ctl.state().signin, "unknown");
  assert.deepEqual(board.calls, []);
});

test("signInTap makes the held-runs notice moot: a declined tap raises no signinNeeded card when none was raised before", async () => {
  const { ctl, board, notes } = await booted();
  ctl.signInTap();
  board.pending.signIn[0].resolve({ state: "signedOut" });
  await flush();
  assert.equal(notes.length, 0);
});

// ─── eraseTap / disarmErase ──────────────────────────────────────────────

test("eraseTap(): idle -> armed, arming a single timer of armMs", async () => {
  const { ctl, timers } = await booted();
  ctl.eraseTap();
  assert.equal(ctl.state().erase, "armed");
  assert.equal(timers.live.size, 1);
  assert.equal([...timers.live.values()][0].ms, ERASE_ARM_MS);
});

test("eraseTap(): armed -> a second tap calls board.erase() once; ok -> one erased card naming the name held at that tap, then idle", async () => {
  const { ctl, board, notes } = await booted();
  ctl.eraseTap();
  ctl.eraseTap();
  assert.equal(ctl.state().erase, "busy");
  assert.deepEqual(board.calls, ["erase"]);
  ctl.sessionChanged({ state: "signedIn", name: NAME2 }); // a rename lands while the erase runs
  board.pending.erase[0].resolve({ ok: true, deleted: 3 });
  await flush();
  assert.equal(ctl.state().erase, "idle");
  assert.deepEqual(notes, [accountCard("erased", NAME)], "the card names the name captured at the confirming tap");
});

test("eraseTap(): a failure result raises one eraseFailed card, then idle; a rejection does the same", async () => {
  const { ctl, board, notes } = await booted();
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
  const { ctl, board } = await booted();
  ctl.eraseTap();
  ctl.eraseTap();
  assert.equal(ctl.state().erase, "busy");
  ctl.eraseTap();
  assert.deepEqual(board.calls, ["erase"], "no second board.erase() call while busy");
});

test("eraseTap(): with Compete off or no name, does nothing", async () => {
  const off = await booted({ settingsInit: { compete: false } });
  off.ctl.eraseTap();
  assert.equal(off.ctl.state().erase, "idle");
  assert.deepEqual(off.board.calls, []);

  const noName = await booted({ identity: scriptedIdentity(null) });
  noName.ctl.eraseTap();
  assert.equal(noName.ctl.state().erase, "idle");
  assert.equal(noName.timers.live.size, 0);
});

test("the erase-arm timer firing disarms back to idle with no board call", async () => {
  const { ctl, board, timers } = await booted();
  ctl.eraseTap();
  timers.fireAll();
  assert.equal(ctl.state().erase, "idle");
  assert.deepEqual(board.calls, []);
});

test("disarmErase(): returns an armed row to idle and clears the timer; a no-op when idle or busy", async () => {
  const { ctl, timers } = await booted();
  ctl.disarmErase();
  assert.equal(ctl.state().erase, "idle");
  ctl.eraseTap();
  assert.equal(ctl.state().erase, "armed");
  ctl.disarmErase();
  assert.equal(ctl.state().erase, "idle");
  assert.equal(timers.live.size, 0);
});

// ─── boardAcked (the welcome-once card) ───────────────────────────────────

test("boardAcked(): the first call ever persists nameWelcomed true and raises one welcome card naming the Play Games name", async () => {
  const { ctl, settings, notes } = await booted();
  ctl.boardAcked();
  assert.equal(ctl.state().welcomed, true);
  assert.deepEqual(settings.writes, [["nameWelcomed", true]]);
  assert.deepEqual(notes, [accountCard("welcome", NAME)]);
  assert.match(notes[0].line, /Moss Knuckle/);
  ctl.boardAcked();
  assert.equal(notes.length, 1, "a second call raises nothing");
  assert.equal(settings.writes.length, 1);
});

test("boardAcked(): boot having read nameWelcomed true raises nothing", async () => {
  const { ctl, settings, notes } = await booted({ settingsInit: { nameWelcomed: true } });
  ctl.boardAcked();
  assert.equal(notes.length, 0);
  assert.equal(settings.writes.length, 0);
});

test("boardAcked(): before any name exists it raises and persists nothing, and welcomes once the name arrives", async () => {
  const { ctl, settings, notes } = await booted({ identity: scriptedIdentity(null) });
  ctl.boardAcked();
  assert.equal(notes.length, 0);
  assert.equal(settings.writes.length, 0);
  assert.equal(ctl.state().welcomed, false);
  ctl.sessionChanged({ state: "signedIn", name: NAME2 });
  ctl.boardAcked();
  assert.deepEqual(notes, [accountCard("welcome", NAME2)]);
  assert.deepEqual(settings.writes, [["nameWelcomed", true]]);
});

// ─── subscribe ─────────────────────────────────────────────────────────

test("subscribe: each listener receives every new state snapshot; unsubscribe stops delivery", async () => {
  const { ctl } = make();
  const seen = [];
  const off = ctl.subscribe((s) => seen.push(s.name));
  await ctl.boot();
  assert.deepEqual(seen, [NAME]);
  off();
  ctl.setCompete(false);
  assert.deepEqual(seen, [NAME]);
  assert.equal(ctl.state().compete, false);
});

test("subscribe: the snapshot a listener receives is the frozen current state", async () => {
  const { ctl } = make();
  let got = null;
  ctl.subscribe((s) => {
    got = s;
  });
  await ctl.boot();
  assert.ok(Object.isFrozen(got));
  assert.strictEqual(got, ctl.state());
});

test("subscribe: a throwing listener does not stop the others or the controller", async () => {
  const { ctl } = make();
  const seen = [];
  ctl.subscribe(() => {
    throw new Error("listener bug");
  });
  ctl.subscribe((s) => seen.push(s.name));
  await ctl.boot();
  assert.deepEqual(seen, [NAME]);
});

test("subscribe with a non-function returns a harmless unsubscribe", () => {
  const { ctl } = make();
  const off = ctl.subscribe(null);
  assert.equal(typeof off, "function");
  assert.doesNotThrow(() => off());
});

// ─── persistence pins ────────────────────────────────────────────────────

test("write-keys pin: every settings.write in this file used compete or nameWelcomed with a boolean, never a name", () => {
  assert.ok(ALL_WRITES.length > 0, "the suite exercised writes");
  for (const [key, value] of ALL_WRITES) {
    assert.ok(key === "compete" || key === "nameWelcomed", `unexpected settings key: ${key}`);
    assert.equal(typeof value, "boolean", `non-boolean written for ${key}`);
    assert.notEqual(value, NAME);
    assert.notEqual(value, NAME2);
  }
});

test("source pins: the controller persists only compete/nameWelcomed, has no reroll, imports no rolled-handle module and imports account.js", () => {
  assert.equal((MODULE_SRC.match(/export function createAccountController/g) || []).length, 1);
  const persisted = [...STRIPPED.matchAll(/persist\(\s*"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(persisted)].sort(), ["compete", "nameWelcomed"]);
  assert.doesNotMatch(STRIPPED, /capacitor-play-games/);
  assert.doesNotMatch(MODULE_SRC, /handles\.js|isValidHandle|ensureHandle/);
  assert.doesNotMatch(STRIPPED, /\breroll\b/i);
  assert.match(STRIPPED, /from "\.\/account\.js"/);
  assert.ok((MODULE_SRC.match(/signInTap/g) || []).length >= 2);
  assert.ok((STRIPPED.match(/"signin"/g) || []).length >= 1);
  assert.match(STRIPPED, /board\.signIn\(\)/);
});
