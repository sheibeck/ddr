// test/unit/account-signin-row.test.js
//
// Phase 92.1 plan 01 (BOARD-31) — the SIGN IN row and the sign-in failure
// card. Three promises, tested from the identity up to the controller:
//
//   1. identity.canSignIn() is the identity's own seamsReady(): false for a
//      dormant Play Games config (empty web client id), a missing seam or an
//      unconfigured Firebase, true when all of them are set. Every "dormant"
//      case here is an INJECTED config; the shipped firebaseConfig.js is never
//      edited or relied on to be dormant.
//   2. While it is false the controller's sheet view has no SIGN IN row (the
//      ☰ account block and the title sheet both draw accountSheetView).
//   3. A sign-in the player asked for (the row tap, or Compete turned back
//      ON) that comes back unavailable or error raises exactly ONE rail card
//      with a plain reason; dismissing the prompt or succeeding raises none.
//
// The last two tests wire the REAL identity, boardSync and controller
// together over the fake board server and the fake Play Games seam.

import test from "node:test";
import assert from "node:assert/strict";

import { createAccountController } from "../../src/browser/accountChip.js";
import { createBoardSync } from "../../src/browser/boardSync.js";
import { createBoardClient } from "../../src/browser/boardClient.js";
import { ACCOUNT_COPY } from "../../content/account.js";
import { makeBoardRig, makeIdentity, makeMemoryStorage, TEST_PLAY_CONFIG } from "./harness/boardHarness.js";

const NAME = "Moss Knuckle";
const DORMANT_PLAY_CONFIG = Object.freeze({ appId: TEST_PLAY_CONFIG.appId, webClientId: "" });

async function flush() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
}

// ─── identity.canSignIn ─────────────────────────────────────────────────────

test("identity.canSignIn: true when configured, false for a dormant Play Games config, a missing seam or an unconfigured Firebase", () => {
  const rig = makeBoardRig();
  assert.equal(rig.identity.canSignIn(), true);
  const dormant = [
    { playConfig: DORMANT_PLAY_CONFIG },
    { playConfig: { appId: "", webClientId: TEST_PLAY_CONFIG.webClientId } },
    { playIdentity: undefined },
    { config: { projectId: "delve-die-repeat-6ba5f", apiKey: "not-a-real-key" } },
    { fetchFn: undefined },
  ];
  for (const over of dormant) {
    assert.equal(makeIdentity(rig, { storage: makeMemoryStorage(), ...over }).canSignIn(), false, JSON.stringify(Object.keys(over)));
  }
});

test("identity.canSignIn is local: no storage, network or plugin call", () => {
  const rig = makeBoardRig();
  const storage = makeMemoryStorage();
  makeIdentity(rig, { storage, playConfig: DORMANT_PLAY_CONFIG }).canSignIn();
  rig.identity.canSignIn();
  assert.equal(rig.sent.length, 0);
  assert.equal(rig.play.calls().length, 0);
  assert.deepEqual({ ...storage.calls }, { getItem: 0, setItem: 0, removeItem: 0 });
});

// ─── the controller: row visibility ────────────────────────────────────────

function scriptedBoard(answer) {
  const calls = [];
  return {
    calls,
    session: async () => ({ state: "signedOut" }),
    signIn: () => {
      calls.push("signIn");
      return typeof answer === "function" ? answer() : Promise.resolve(answer);
    },
    erase: async () => ({ ok: true }),
    purge: async () => {},
    flush: async () => {},
  };
}

function makeController({ canSignIn, board, compete = true }) {
  const notes = [];
  const identity = { snapshot: async () => ({ name: NAME }) };
  if (canSignIn !== undefined) identity.canSignIn = canSignIn;
  const ctl = createAccountController({
    identity,
    board,
    settings: { read: async () => ({ compete, nameWelcomed: true }), write: async () => ({}) },
    notify: (card) => notes.push(card),
    setTimer: () => 1,
    clearTimer: () => {},
    compete,
  });
  return { ctl, notes };
}

test("controller: canSignIn() false hides the SIGN IN row in every sign-in state, even from before boot", async () => {
  const { ctl } = makeController({ canSignIn: () => false, board: scriptedBoard({ state: "signedOut" }) });
  assert.equal(ctl.state().canSignIn, false);
  assert.equal(ctl.sheetView().signIn.visible, false, "before boot");
  await ctl.boot();
  for (const state of ["out", "unavailable"]) {
    ctl.sessionChanged({ state: state === "out" ? "signedOut" : "unavailable" });
    assert.equal(ctl.state().signin, state);
    assert.equal(ctl.sheetView().signIn.visible, false, `hidden while ${state}`);
  }
});

test("controller: an identity without canSignIn, or one that throws, reads as able (only a plain false hides the row)", async () => {
  for (const canSignIn of [undefined, () => true, () => { throw new Error("boom"); }, () => undefined]) {
    const { ctl } = makeController({ canSignIn, board: scriptedBoard({ state: "signedOut" }) });
    await ctl.boot();
    ctl.sessionChanged({ state: "signedOut" });
    assert.equal(ctl.sheetView().signIn.visible, true);
  }
});

// ─── the controller: one card per failed attempt ──────────────────────────

test("a row tap that comes back unavailable raises ONE signinUnavailable card", async () => {
  const board = scriptedBoard({ state: "unavailable", name: null });
  const { ctl, notes } = makeController({ board });
  await ctl.boot();
  ctl.signInTap();
  await flush();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, ACCOUNT_COPY.cards.signinUnavailable.title);
  assert.equal(notes[0].line, ACCOUNT_COPY.cards.signinUnavailable.line);
  assert.equal(ctl.state().signin, "unavailable");
});

test("a row tap that comes back error, or rejects or throws, raises ONE signinFailed card and reads as signed out", async () => {
  const answers = [() => Promise.resolve({ state: "error" }), () => Promise.reject(new Error("x")), () => { throw new Error("sync"); }];
  for (const answer of answers) {
    const { ctl, notes } = makeController({ board: scriptedBoard(answer) });
    await ctl.boot();
    ctl.signInTap();
    await flush();
    assert.equal(notes.length, 1, "exactly one card");
    assert.equal(notes[0].title, ACCOUNT_COPY.cards.signinFailed.title);
    assert.equal(ctl.state().signin, "out", "the row does not stay on SIGNING IN");
  }
});

test("a signed-in answer, a dismissed prompt (signed out) and an offline answer raise no failure card", async () => {
  for (const answer of [{ state: "signedIn", name: NAME }, { state: "signedOut" }, { state: "offline" }, { state: "off" }]) {
    const { ctl, notes } = makeController({ board: scriptedBoard(answer) });
    await ctl.boot();
    ctl.signInTap();
    await flush();
    const failures = notes.filter((c) => c.title === ACCOUNT_COPY.cards.signinUnavailable.title || c.title === ACCOUNT_COPY.cards.signinFailed.title);
    assert.equal(failures.length, 0, JSON.stringify(answer));
  }
});

test("Compete turned ON whose sign-in comes back unavailable or error raises ONE card, same as the tap", async () => {
  for (const [state, title] of [["unavailable", ACCOUNT_COPY.cards.signinUnavailable.title], ["error", ACCOUNT_COPY.cards.signinFailed.title]]) {
    const board = scriptedBoard({ state });
    const { ctl, notes } = makeController({ board, compete: false });
    await ctl.boot();
    ctl.setCompete(true);
    await flush();
    assert.deepEqual(board.calls, ["signIn"]);
    assert.equal(notes.length, 1, state);
    assert.equal(notes[0].title, title);
  }
});

test("Compete turned OFF while a sign-in is running raises no card when it fails", async () => {
  let settle;
  const board = scriptedBoard(() => new Promise((res) => { settle = res; }));
  const { ctl, notes } = makeController({ board });
  await ctl.boot();
  ctl.signInTap();
  ctl.setCompete(false);
  settle({ state: "error" });
  await flush();
  assert.equal(notes.length, 0);
});

// ─── the real stack: identity + boardSync + controller ────────────────────

function realStack({ identityOver = {}, play = {} } = {}) {
  // Compete starts OFF (the launch the player later turns it ON in); the
  // settings write is what flips the flag every seam reads.
  let competeNow = false;
  const rig = makeBoardRig({ play });
  const identity = makeIdentity(rig, identityOver);
  const client = createBoardClient({ fetchFn: rig.fetchFn });
  let ctl;
  const board = createBoardSync({
    storage: rig.storage,
    fetchFn: rig.fetchFn,
    identity,
    client,
    competeOn: () => competeNow,
    onSession: (info) => ctl?.sessionChanged(info),
  });
  const notes = [];
  ctl = createAccountController({
    identity,
    board,
    settings: {
      read: async () => ({ compete: competeNow, nameWelcomed: true }),
      write: async (key, value) => {
        if (key === "compete") competeNow = value === true;
        return {};
      },
    },
    notify: (card) => notes.push(card),
    setTimer: () => 1,
    clearTimer: () => {},
    compete: false,
  });
  return { rig, ctl, notes };
}

test("dormant config end to end: the row is hidden and turning Compete ON raises one plain card with no network and no plugin call", async () => {
  const { rig, ctl, notes } = realStack({ identityOver: { storage: makeMemoryStorage(), playConfig: DORMANT_PLAY_CONFIG } });
  await ctl.boot();
  assert.equal(ctl.state().canSignIn, false);
  assert.equal(ctl.sheetView().signIn.visible, false);

  ctl.setCompete(true);
  await flush();
  assert.equal(ctl.state().compete, true);
  assert.equal(ctl.state().signin, "unavailable");
  assert.equal(ctl.sheetView().signIn.visible, false, "still hidden: it cannot work");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, ACCOUNT_COPY.cards.signinUnavailable.title);
  assert.equal(rig.sent.length, 0, "no board network call");
  assert.equal(rig.play.calls().length, 0, "the Play Games seam is never touched");
});

test("configured end to end: Compete turned ON starts the SDK (init), signs in and posts the name, with no failure card", async () => {
  const { rig, ctl, notes } = realStack({ play: { signedIn: false, interactive: true, playerId: "p-moss", displayName: NAME } });
  await ctl.boot();
  assert.equal(ctl.state().compete, false);
  ctl.setCompete(true);
  await flush();
  assert.deepEqual(rig.play.calls().map((c) => c.method).slice(0, 3), ["init", "status", "signIn"]);
  assert.equal(ctl.state().signin, "in");
  assert.equal(ctl.state().name, NAME);
  assert.equal(notes.length, 0);
});

test("configured end to end: a sign-in that errors raises one signinFailed card and leaves the row offered", async () => {
  const stub = {
    init: async () => ({ ok: false, reason: "error" }),
    status: async () => ({ ok: true, signedIn: false }),
    signIn: async () => ({ ok: true, signedIn: false }),
    serverAuthCode: async () => ({ ok: false, reason: "error" }),
  };
  const { ctl, notes } = realStack({ identityOver: { storage: makeMemoryStorage(), playIdentity: stub } });
  await ctl.boot();
  ctl.setCompete(true);
  await flush();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, ACCOUNT_COPY.cards.signinFailed.title);
  assert.equal(ctl.sheetView().signIn.visible, true, "sign-in can work here, so the row stays");
});
