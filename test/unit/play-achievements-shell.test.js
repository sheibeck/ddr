// test/unit/play-achievements-shell.test.js
//
// Phase 101 (PGS-07, PGS-08, PGS-09), plan 03 — the shell wiring of the Play
// Games achievements mirror. Two parts:
//
// Part 1: source anchors over the comment-stripped module script (the import,
// the one creation, the bus subscription order, the listener order, the
// account hook, the boot wake, the tokens the block must not contain).
//
// Part 2: a behaviour harness. The SHIPPED block (sliced from the module
// script, comment-stripped) is rebuilt with `new Function` over the REAL
// createAchievementMirror (wrapped only to inject a manual scheduler and a
// clock), the REAL achievement bus, a fake window/document/navigator, a
// Map-backed async storage, a fake account controller and the recording fake
// Play seam from playIdentity.js.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";
import { sanitizeRecord } from "../../src/browser/achievementRecord.js";
import { createAchievementBus } from "../../src/browser/achievementBus.js";
import { ACHIEVEMENTS_SHEET_COPY } from "../../src/browser/achievementsSheet.js";
import { createFakePlayIdentity } from "../../src/browser/playIdentity.js";
import {
  PGS_ACH_KEY,
  UNLOCK_DELAY_MS,
  PROGRESS_DELAY_MS,
  achievementResourceName,
  createAchievementMirror,
} from "../../src/browser/playAchievements.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");
const RAW_HTML = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");
const CODE = stripHtml(RAW_HTML);

function occurrences(haystack, needle) {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

const IMPORT_LINE = 'import { createAchievementMirror } from "./src/browser/playAchievements.js";';
const BLOCK_START_MARK = "const achievementMirror = createAchievementMirror({";
const BLOCK_END_MARK = "account.subscribe(onAccountForMirror);";
const BLOCK_START = CODE.indexOf(BLOCK_START_MARK);
const BLOCK_END = CODE.indexOf(BLOCK_END_MARK) + BLOCK_END_MARK.length;
const BLOCK = CODE.slice(BLOCK_START, BLOCK_END);
// Plan 101-04 (AUI-04): the VIEW IN PLAY GAMES button's wiring sits right after
// the mirror block and outside its span (the five-name pin below stays exact).
const BTN_START_MARK = "const playAchievementsRow = ";
const BTN_END_MARK = "syncPlayAchievementsButton();";
const BTN_START = CODE.indexOf(BTN_START_MARK);
const BTN_END = CODE.lastIndexOf(BTN_END_MARK) + BTN_END_MARK.length;
const BTN = CODE.slice(BTN_START, BTN_END);
const SHEET_IMPORT_LINE = 'import { ACHIEVEMENTS_SHEET_COPY } from "./src/browser/achievementsSheet.js";';
const PINNED_SHEET_IMPORT = 'import { buildAchievementsView, renderAchievementsSheet, menuCountText } from "./src/browser/achievementsSheet.js";';

// ═══════════════════════ Part 1: source anchors ════════════════════════════

test("PGS-07 anchors: the import is on its own line once; the mirror is created once", () => {
  assert.equal(CODE.split("\n").filter((l) => l.trim() === IMPORT_LINE).length, 1);
  assert.equal(occurrences(CODE, "createAchievementMirror("), 1);
  assert.ok(BLOCK_START !== -1 && BLOCK_END > BLOCK_START, "the block is sliceable");
});

test("PGS-07 anchors: the five options, the record reader handed as a reference, and getAchievementRecord( stays at two", () => {
  const opts = BLOCK.slice(0, BLOCK.indexOf("});") + 3);
  for (const line of [
    "storage: window.mzStorage,",
    "playIdentity: playIdentity(),",
    "competeOn: competeIsOn,",
    "online: () => navigator.onLine !== false,",
    "getRecord: getAchievementRecord,",
  ]) {
    assert.ok(opts.includes(line), line);
  }
  assert.equal(occurrences(CODE, "getAchievementRecord("), 2, "the sheet's two calls only; the mirror gets the reference");
});

test("PGS-07 anchors: the mirror subscribes once, after the banner and before boot; the adapter slot is taken once", () => {
  const sub = "achievementEvents.subscribe(onAchievementMirror);";
  const banner = "achievementEvents.subscribe(onAchievementBanner);";
  assert.equal(occurrences(CODE, sub), 1);
  assert.equal(occurrences(CODE, banner), 1);
  assert.equal(occurrences(CODE, "setAchievementListener("), 1);
  assert.ok(CODE.indexOf(banner) < CODE.indexOf(sub));
  assert.ok(CODE.indexOf(sub) < CODE.indexOf("await boot("));
});

test("PGS-09 anchors: boardSync's visibilitychange listener stays the first; the mirror's comes after it; its pinned lines are untouched", () => {
  const needle = 'document.addEventListener("visibilitychange"';
  const first = CODE.indexOf(needle);
  assert.ok(first !== -1);
  assert.ok(CODE.slice(first, first + 160).includes("boardSync.session()"), "the first listener is boardSync's");
  const second = CODE.indexOf(needle, first + needle.length);
  assert.ok(second > first && second > CODE.indexOf(BLOCK_START_MARK), "the mirror's listener is second and inside the block");
  assert.ok(CODE.slice(second, second + 120).includes("achievementMirror.wake()"));
  assert.ok(CODE.includes('window.addEventListener("online", () => boardSync.flush({ force: true }));'));
  assert.ok(CODE.includes("onSession: (info) => account?.sessionChanged(info),"));
  assert.ok(CODE.includes("waitForPending: () => Promise.all([waitForPending(), boardSync.waitForPending()]),"));
  assert.ok(first < CODE.indexOf(BLOCK_START_MARK), "the block comes after boardSync's listener");
});

test("PGS-08 anchors: the account hook is a named subscriber and the block's last statement; the first account.subscribe block is the only literal one", () => {
  assert.equal(occurrences(CODE, "account.subscribe(onAccountForMirror);"), 1);
  assert.equal(occurrences(CODE, "account.subscribe(() => {"), 1);
  assert.ok(BLOCK.endsWith("account.subscribe(onAccountForMirror);"));
  assert.ok(CODE.indexOf("account.subscribe(() => {") < CODE.indexOf(BLOCK_START_MARK));
});

test("PGS-08 anchors: the boot wake follows boardSync.boot( and carries the account check", () => {
  const wake = "achievementMirror.wake({ checkPlayer: true });";
  assert.equal(occurrences(CODE, wake), 1);
  assert.ok(CODE.indexOf("boardSync.boot({") !== -1);
  assert.ok(CODE.indexOf("boardSync.boot({") < CODE.indexOf(wake));
  assert.ok(CODE.indexOf(wake) < CODE.indexOf("registerNativeChrome({"));
  assert.ok(CODE.indexOf("await boot(") < CODE.indexOf(wake));
});

test("PGS-09 anchors: the block holds no network, storage write, Capacitor token, window.__mz assignment or Play ID", () => {
  for (const token of ["fetch(", "localStorage", "setItem", "getItem", "Capacitor", "XMLHttpRequest", "WebSocket", "dispatch("]) {
    assert.equal(BLOCK.includes(token), false, `the block must not contain ${token}`);
  }
  assert.equal(/window\.__mz\w*\s*=[^=]/.test(BLOCK), false, "no new window.__mz name is assigned");
  assert.equal(BLOCK.includes("CgkI"), false);
  const idPrefix = "Cg" + "kI";
  assert.equal(CODE.includes(idPrefix), false, "no Play ID literal anywhere in the shell");
});

test("PGS-09 anchors: the Play plugin is reached only through the mirror", () => {
  // `.syncAchievements(` never appears in the shell; `.showAchievements(` only as achievementMirror.showAchievements(.
  assert.equal(CODE.includes(".syncAchievements("), false);
  const shows = CODE.match(/[A-Za-z0-9_$.?]*\.showAchievements\(/g) || [];
  for (const s of shows) assert.equal(s, "achievementMirror.showAchievements(", `only through the mirror, found ${s}`);
});

test("PGS-07 anchors: the only new top-level names are the mirror, its two functions and the two tracked values", () => {
  const names = ["achievementMirror", "onAchievementMirror", "onAccountForMirror", "mirrorCompete", "mirrorSignin"];
  for (const n of names) {
    const re = new RegExp(`\\n  (?:const|let|function) ${n}\\b`, "g");
    assert.equal((CODE.match(re) || []).length, 1, n);
  }
  const declared = BLOCK.match(/\n  (?:const|let|function) \w+/g) || [];
  assert.equal(declared.length + 1, names.length, "the block declares exactly the five names (the first const opens the slice)");
});

// ═══════════ Plan 101-04 anchors: the VIEW IN PLAY GAMES row ═══════════════════

test("AUI-04 anchors: the copy import is on its own line once; the pinned sheet import line is untouched", () => {
  assert.equal(CODE.split("\n").filter((l) => l.trim() === SHEET_IMPORT_LINE).length, 1);
  assert.equal(CODE.split("\n").filter((l) => l.trim() === PINNED_SHEET_IMPORT).length, 1);
  assert.equal(occurrences(CODE, "getAchievementRecord("), 2);
});

test("AUI-04 anchors: the markup row sits between the sheet's head and its body and carries no text", () => {
  const sheet = RAW_HTML.slice(RAW_HTML.indexOf('<div id="mw-achievements-sheet"'), RAW_HTML.indexOf("<!-- Phase 78 (HUD-06): the stairs fade layer"));
  const head = sheet.indexOf('<div class="mw-legend-head">');
  const row = sheet.indexOf('id="mw-achievements-play"');
  const body = sheet.indexOf('id="mw-achievements-body"');
  assert.ok(head !== -1 && row > head && body > row, "head, then the play row, then the body");
  const rowMarkup = sheet.slice(sheet.lastIndexOf("<div", row), sheet.lastIndexOf("<div", body));
  assert.match(rowMarkup, /<div id="mw-achievements-play" class="mw-achievements-play" hidden>/);
  assert.match(rowMarkup, /<button type="button" class="mw-achievements-play-btn" id="mw-achievements-play-btn"><\/button>/);
  assert.match(rowMarkup, /<span class="mw-achievements-play-note" id="mw-achievements-play-note" role="status" hidden><\/span>/);
  assert.equal(rowMarkup.replace(/<[^>]*>/g, "").trim(), "", "no text in the markup");
});

test("AUI-04 anchors: the wiring follows the mirror block, precedes boot and reaches Play only through the mirror", () => {
  assert.ok(BTN_START !== -1 && BTN_END > BTN_START, "the button block is sliceable");
  assert.ok(BTN_START > BLOCK_END, "outside the mirror block's span");
  assert.ok(BTN_START < CODE.indexOf("await boot("));
  assert.equal(occurrences(CODE, "achievementMirror.showAchievements("), 1);
  assert.equal(occurrences(CODE, "ACHIEVEMENTS_SHEET_COPY.play.view"), 1);
  assert.equal(occurrences(CODE, "ACHIEVEMENTS_SHEET_COPY.play.failed"), 1);
  assert.equal(occurrences(CODE, "account.subscribe(syncPlayAchievementsButton);"), 1);
  for (const token of ["Capacitor", "isNativePlatform", "localStorage", "setItem", "fetch(", "setTimeout", "setInterval", ".style"]) {
    assert.equal(BTN.includes(token), false, `the button block must not contain ${token}`);
  }
  assert.equal(/window\.__mz\w*\s*=[^=]/.test(BTN), false);
});

test("AUI-04 anchors: the button's text and the failure line are written with textContent", () => {
  assert.ok(BTN.includes("playAchievementsBtn.textContent = ACHIEVEMENTS_SHEET_COPY.play.view"));
  assert.ok(BTN.includes("playAchievementsNote.textContent = ACHIEVEMENTS_SHEET_COPY.play.failed"));
  assert.equal(BTN.includes("innerHTML"), false);
});

// ═══════════════════════ Part 2: the behaviour harness ═════════════════════

const UNLOCK_ID = "special_snowflake";
const UNLOCK_ENTRY = ACHIEVEMENTS.find((e) => e.id === UNLOCK_ID);
const SECOND_ID = "class_fighter";
const REVEAL_ID = ACHIEVEMENTS.find((e) => e.initialState === "Hidden").id;
const INCREMENTAL = ACHIEVEMENTS.find((e) => e.type === "incremental");

function makeStorage() {
  const map = new Map();
  const calls = [];
  return {
    map,
    calls,
    async getItem(key) {
      calls.push({ op: "get", key });
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      calls.push({ op: "set", key });
      map.set(key, String(value));
    },
    async removeItem(key) {
      calls.push({ op: "remove", key });
      map.delete(key);
    },
  };
}

function makeSched() {
  const timers = [];
  return {
    timers,
    setTimer(fn, ms) {
      const t = { fn, ms, cleared: false, fired: false };
      timers.push(t);
      return t;
    },
    clearTimer(t) {
      if (t) t.cleared = true;
    },
    active() {
      return timers.filter((t) => !t.cleared && !t.fired);
    },
    runAll() {
      for (const t of timers.slice()) {
        if (t.cleared || t.fired) continue;
        t.fired = true;
        t.fn();
      }
    },
  };
}

function makeListeners() {
  const reg = {};
  return {
    reg,
    addEventListener(type, fn) {
      (reg[type] ||= []).push(fn);
    },
    emit(type) {
      for (const fn of reg[type] || []) fn({ type });
    },
  };
}

const rec = (extra = {}) => sanitizeRecord({ v: 1, ...extra });
const settle = () => new Promise((r) => setImmediate(r));
const unlockPayload = (...ids) => ({ unlocks: ids.map((id) => ({ id, at: 1 })), reveals: [], progress: [] });
const revealPayload = (...ids) => ({ unlocks: [], reveals: ids, progress: [] });
const progressPayload = () => ({ unlocks: [], reveals: [], progress: [{ id: INCREMENTAL.id, value: 1, steps: INCREMENTAL.steps }] });

// Fake row, button and note, as the markup ships them: the row and the note start hidden.
function makePlayRow() {
  const clicks = [];
  const row = { hidden: true };
  const note = { hidden: true, textContent: "" };
  const btn = {
    textContent: "",
    addEventListener(type, fn) {
      if (type === "click") clicks.push(fn);
    },
    click() {
      return Promise.all(clicks.map((fn) => fn({ type: "click" })));
    },
  };
  return {
    row,
    btn,
    note,
    clicks,
    byId: { "mw-achievements-play": row, "mw-achievements-play-btn": btn, "mw-achievements-play-note": note },
  };
}

function rig(over = {}) {
  const st = {
    compete: over.compete === true,
    signin: over.signin || "unknown",
    online: over.online !== false,
    dead: false,
    record: over.record || rec(),
    t: 2_000_000,
  };
  const subs = [];
  const account = {
    state: () => ({ compete: st.compete, signin: st.signin }),
    subscribe(fn) {
      subs.push(fn);
      return () => {};
    },
  };
  const emitAccount = () => subs.slice().forEach((fn) => fn());
  const seam = over.seam || createFakePlayIdentity({ signedIn: true, playerId: "player-aaa-0001" });
  const storage = makeStorage();
  const sched = makeSched();
  const win = { ...makeListeners(), mzStorage: storage, __mzState: { get: () => ({ dead: st.dead }) } };
  const dom = over.dom === true ? makePlayRow() : null;
  const doc = {
    ...makeListeners(),
    visibilityState: "visible",
    getElementById: (id) => (dom ? dom.byId[id] || null : null),
  };
  const nav = { get onLine() { return st.online; } };
  const micro = [];
  const queueMicro = (fn) => micro.push(fn);
  const drainMicro = () => {
    while (micro.length) micro.shift()();
  };
  const seen = { opts: null };
  const wrapped = (o) => {
    seen.opts = o;
    return createAchievementMirror({ ...o, now: () => st.t, setTimer: sched.setTimer, clearTimer: sched.clearTimer });
  };
  const bus = createAchievementBus();
  const banner = [];
  bus.subscribe((p) => banner.push(p));
  const competeIsOn = () => account.state().compete === true;
  const playIdentity = () => seam;
  const getAchievementRecord = () => st.record;
  const factory = new Function(
    "window",
    "document",
    "navigator",
    "createAchievementMirror",
    "competeIsOn",
    "playIdentity",
    "getAchievementRecord",
    "achievementEvents",
    "account",
    "queueMicrotask",
    "ACHIEVEMENTS_SHEET_COPY",
    `${BLOCK}\n${BTN}\nreturn { achievementMirror, onAchievementMirror, onAccountForMirror, syncPlayAchievementsButton };`,
  );
  const out = factory(win, doc, nav, wrapped, competeIsOn, playIdentity, getAchievementRecord, bus, account, queueMicro, ACHIEVEMENTS_SHEET_COPY);
  return { st, account, emitAccount, seam, storage, sched, win, doc, dom, micro, drainMicro, seen, bus, banner, getAchievementRecord, ...out };
}

const syncCalls = (r) => r.seam.calls().filter((c) => c.method === "syncAchievements");
const statusCalls = (r) => r.seam.calls().filter((c) => c.method === "status");

test("PGS-07 harness: the block builds one mirror with the five options and subscribes it to the bus once", () => {
  const r = rig();
  assert.equal(r.bus.size(), 2, "the banner stand-in and the mirror");
  assert.equal(r.seen.opts.getRecord, r.getAchievementRecord, "the function reference itself");
  assert.equal(r.seen.opts.storage, r.storage);
  assert.equal(r.seen.opts.playIdentity, r.seam);
  assert.equal(r.seen.opts.competeOn(), false);
  r.st.compete = true;
  assert.equal(r.seen.opts.competeOn(), true);
  r.st.online = false;
  assert.equal(r.seen.opts.online(), false);
  assert.equal(r.win.reg.online.length, 1);
  assert.equal(r.doc.reg.visibilitychange.length, 1);
  assert.deepEqual(Object.keys(r.achievementMirror).sort(), ["cancel", "flush", "kick", "showAchievements", "snapshot", "waitForPending", "wake"]);
});

test("PGS-09 harness: with Compete OFF every shell trigger leaves the Play seam and the ledger untouched", async () => {
  const r = rig({ record: rec({ unlocked: { [UNLOCK_ID]: 1 }, revealed: [REVEAL_ID] }) });
  r.bus.publish(unlockPayload(UNLOCK_ID));
  r.bus.publish(revealPayload(REVEAL_ID));
  r.bus.publish(progressPayload());
  r.doc.visibilityState = "hidden";
  r.doc.emit("visibilitychange");
  r.doc.visibilityState = "visible";
  r.doc.emit("visibilitychange");
  r.win.emit("online");
  r.st.signin = "in";
  r.emitAccount();
  r.st.signin = "out";
  r.emitAccount();
  r.st.dead = true;
  r.bus.publish(unlockPayload(SECOND_ID));
  r.drainMicro();
  r.achievementMirror.wake({ checkPlayer: true }); // the boot wake
  await settle();
  r.sched.runAll();
  r.drainMicro();
  await settle();
  await r.achievementMirror.waitForPending();
  assert.deepEqual(r.seam.calls(), []);
  assert.equal(r.storage.map.has(PGS_ACH_KEY), false);
  assert.deepEqual(r.storage.calls, []);
  assert.equal(r.sched.timers.length, 0, "no timer was ever scheduled");
});

test("PGS-07 harness: Compete ON, signed in, an unlock goes out 1.5 s later as status then sync with that unlock's resource", async () => {
  const r = rig({ compete: true, signin: "in", record: rec({ unlocked: { [UNLOCK_ID]: 1 } }) });
  r.bus.publish(unlockPayload(UNLOCK_ID));
  const active = r.sched.active();
  assert.equal(active.length, 1);
  assert.equal(active[0].ms, UNLOCK_DELAY_MS);
  await settle();
  assert.deepEqual(r.seam.calls(), [], "nothing before the timer");
  r.sched.runAll();
  await settle();
  const calls = r.seam.calls();
  assert.deepEqual(calls.map((c) => c.method), ["status", "syncAchievements"]);
  const ops = calls[1].args.ops;
  assert.equal(ops.length, 1);
  assert.equal(ops[0].kind, "unlock");
  assert.equal(ops[0].resource, achievementResourceName(UNLOCK_ENTRY));
  assert.deepEqual(Object.keys(ops[0]).sort(), ["kind", "resource"], "only a kind and a resource name cross the seam, never an id");
});

test("PGS-07 harness: a reveal uses the 1.5 s timer; a progress-only publish uses the 60 s timer", () => {
  const a = rig({ compete: true, signin: "in" });
  a.bus.publish(revealPayload(REVEAL_ID));
  assert.deepEqual(a.sched.active().map((t) => t.ms), [UNLOCK_DELAY_MS]);
  const b = rig({ compete: true, signin: "in" });
  b.bus.publish(progressPayload());
  assert.deepEqual(b.sched.active().map((t) => t.ms), [PROGRESS_DELAY_MS]);
});

test("PGS-08 harness: an unlock earned with Compete OFF is sent once Compete turns ON, without waiting for a timer, and only once", async () => {
  const r = rig({ compete: false, signin: "in", record: rec({ unlocked: { [UNLOCK_ID]: 1 } }) });
  r.bus.publish(unlockPayload(UNLOCK_ID));
  await settle();
  assert.deepEqual(r.seam.calls(), []);
  r.st.compete = true;
  r.emitAccount();
  await settle();
  assert.deepEqual(r.seam.calls().map((c) => c.method), ["status", "syncAchievements"]);
  assert.equal(syncCalls(r)[0].args.ops.length, 1);
  assert.equal(syncCalls(r)[0].args.ops[0].resource, achievementResourceName(UNLOCK_ENTRY));
  r.emitAccount(); // a second account change, compete unchanged
  await settle();
  r.achievementMirror.wake({ force: true, checkPlayer: true });
  await settle();
  assert.equal(syncCalls(r).length, 1, "the unlock reached the seam once");
});

test("PGS-09 harness: Compete turning OFF cancels the pending timers at once; running them afterwards sends nothing", async () => {
  const r = rig({ compete: true, signin: "in", record: rec({ unlocked: { [UNLOCK_ID]: 1 } }) });
  r.bus.publish(unlockPayload(UNLOCK_ID));
  r.bus.publish(progressPayload());
  assert.equal(r.sched.active().length, 2);
  r.st.compete = false;
  r.emitAccount();
  assert.equal(r.sched.active().length, 0, "cancelled the instant Compete went OFF");
  r.sched.runAll();
  await settle();
  assert.deepEqual(r.seam.calls(), []);
  assert.equal(r.storage.map.has(PGS_ACH_KEY), false);
});

test("PGS-08 harness: Play sign-in turning to 'in' wakes with the account check; signed out sends nothing", async () => {
  const r = rig({ compete: true, signin: "out", record: rec({ unlocked: { [UNLOCK_ID]: 1 } }) });
  r.bus.publish(unlockPayload(UNLOCK_ID));
  r.emitAccount(); // nothing changed
  await settle();
  assert.deepEqual(r.seam.calls(), [], "no wake while signin stays out");
  r.st.signin = "in";
  r.emitAccount();
  await settle();
  assert.deepEqual(r.seam.calls().map((c) => c.method), ["status", "syncAchievements"]);
  r.emitAccount(); // still in: no new wake
  await settle();
  assert.equal(syncCalls(r).length, 1);
});

test("PGS-07 harness: a death wakes the mirror in a microtask, before any timer", async () => {
  const r = rig({ compete: true, signin: "in", record: rec({ unlocked: { [UNLOCK_ID]: 1 } }) });
  r.st.dead = true;
  r.bus.publish(progressPayload());
  await settle();
  assert.deepEqual(r.seam.calls(), [], "the wake waits for the microtask");
  assert.equal(r.micro.length, 1);
  r.drainMicro();
  await settle();
  assert.deepEqual(r.seam.calls().map((c) => c.method), ["status", "syncAchievements"]);
  assert.deepEqual(r.sched.active().map((t) => t.ms), [PROGRESS_DELAY_MS], "the progress timer was only pending, never needed");
});

test("PGS-07 harness: a living hero's publish queues a microtask that wakes nothing", async () => {
  const r = rig({ compete: true, signin: "in", record: rec({ unlocked: { [UNLOCK_ID]: 1 } }) });
  r.bus.publish(unlockPayload(UNLOCK_ID));
  r.drainMicro();
  await settle();
  assert.deepEqual(r.seam.calls(), []);
});

test("PGS-07 harness: visibilitychange in either direction wakes the mirror", async () => {
  for (const state of ["hidden", "visible"]) {
    const r = rig({ compete: true, signin: "in", record: rec({ unlocked: { [UNLOCK_ID]: 1 } }) });
    r.doc.visibilityState = state;
    r.doc.emit("visibilitychange");
    await settle();
    assert.deepEqual(r.seam.calls().map((c) => c.method), ["status", "syncAchievements"], state);
  }
});

test("PGS-07 harness: coming back online wakes it forced, past a backoff an earlier network failure set; a plain wake honours the backoff", async () => {
  const base = createFakePlayIdentity({ signedIn: true, playerId: "player-aaa-0001" });
  let failNext = true;
  const seam = Object.freeze({
    ...base,
    status: () => base.status(),
    syncAchievements: async (arg) => {
      const out = await base.syncAchievements(arg);
      if (failNext) {
        failNext = false;
        return { ok: false, reason: "network" };
      }
      return out;
    },
    calls: () => base.calls(),
  });
  const r = rig({ compete: true, signin: "in", seam, record: rec({ unlocked: { [UNLOCK_ID]: 1 } }) });
  r.doc.emit("visibilitychange");
  await settle();
  assert.equal(syncCalls(r).length, 1, "the first batch failed on the network");
  r.doc.emit("visibilitychange");
  await settle();
  assert.equal(syncCalls(r).length, 1, "the backoff holds a plain wake");
  r.win.emit("online");
  await settle();
  assert.equal(syncCalls(r).length, 2, "online forces past the backoff");
});

test("PGS-09 harness: every wake-up together makes one Play batch at a time", async () => {
  const base = createFakePlayIdentity({ signedIn: true, playerId: "player-aaa-0001" });
  let inFlight = 0;
  let maxInFlight = 0;
  const seam = Object.freeze({
    ...base,
    status: () => base.status(),
    syncAchievements: async (arg) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await settle();
      const out = await base.syncAchievements(arg);
      inFlight--;
      return out;
    },
    calls: () => base.calls(),
  });
  const r = rig({ compete: true, signin: "out", seam, record: rec({ unlocked: { [UNLOCK_ID]: 1, [SECOND_ID]: 2 } }) });
  r.st.dead = true;
  r.bus.publish(unlockPayload(UNLOCK_ID));
  r.doc.emit("visibilitychange");
  r.win.emit("online");
  r.st.signin = "in";
  r.emitAccount();
  r.drainMicro();
  r.achievementMirror.wake({ checkPlayer: true });
  r.sched.runAll();
  await settle();
  await settle();
  await settle();
  assert.equal(maxInFlight, 1, "never two batches at once");
  assert.equal(syncCalls(r).length >= 1, true);
  const sent = syncCalls(r).flatMap((c) => c.args.ops.map((o) => o.resource));
  assert.equal(new Set(sent).size, sent.length, "nothing was sent twice");
});

test("PGS-09 harness: a Play failure never reaches the banner; the mirror's subscriber never throws", async () => {
  const throwing = Object.freeze({
    kind: "fake",
    status: () => {
      throw new Error("boom");
    },
    syncAchievements: () => Promise.reject(new Error("rejected")),
    showAchievements: () => {
      throw new Error("boom");
    },
    init: () => Promise.reject(new Error("rejected")),
    calls: () => [],
  });
  const r = rig({ compete: true, signin: "in", seam: throwing, record: rec({ unlocked: { [UNLOCK_ID]: 1 } }) });
  const payload = unlockPayload(UNLOCK_ID);
  r.st.dead = true;
  assert.doesNotThrow(() => r.bus.publish(payload));
  assert.equal(r.banner.length, 1);
  assert.equal(r.banner[0], payload, "the banner subscriber got the payload untouched");
  assert.doesNotThrow(() => r.onAchievementMirror(payload));
  assert.doesNotThrow(() => r.onAchievementMirror(undefined));
  assert.doesNotThrow(() => r.drainMicro());
  r.sched.runAll();
  r.doc.emit("visibilitychange");
  r.win.emit("online");
  r.emitAccount();
  await settle();
  assert.equal(r.banner.length, 1);
});

test("PGS-09 harness: a kick that throws inside the mirror is swallowed by the subscriber", () => {
  const r = rig({ compete: true, signin: "in" });
  const broken = {
    kick() {
      throw new Error("kick");
    },
  };
  const factory = new Function(
    "achievementMirror",
    "queueMicrotask",
    "window",
    `${BLOCK.slice(BLOCK.indexOf("function onAchievementMirror"), BLOCK.indexOf("achievementEvents.subscribe(onAchievementMirror);"))}\nreturn onAchievementMirror;`,
  );
  const fn = factory(broken, () => {}, r.win);
  assert.doesNotThrow(() => fn(unlockPayload(UNLOCK_ID)));
});

// ═══════════ Plan 101-04 harness: the VIEW IN PLAY GAMES row ═══════════════════

const showCalls = (r) => r.seam.calls().filter((c) => c.method === "showAchievements");

test("AUI-04 harness: the button's label comes from the copy bank", () => {
  const r = rig({ dom: true });
  assert.equal(r.dom.btn.textContent, ACHIEVEMENTS_SHEET_COPY.play.view);
  assert.equal(r.dom.btn.textContent, "VIEW IN PLAY GAMES");
  assert.equal(r.dom.clicks.length, 1);
});

test("AUI-04 harness: the row is hidden with Compete OFF and with every signin but 'in'; shown with Compete ON and signed in", () => {
  const off = rig({ dom: true, compete: false, signin: "in" });
  assert.equal(off.dom.row.hidden, true, "Compete OFF");
  for (const signin of ["unknown", "out", "busy", "unavailable"]) {
    const r = rig({ dom: true, compete: true, signin });
    assert.equal(r.dom.row.hidden, true, signin);
  }
  const on = rig({ dom: true, compete: true, signin: "in" });
  assert.equal(on.dom.row.hidden, false);
});

test("AUI-04 harness: the row appears and disappears live as the account changes", () => {
  const r = rig({ dom: true, compete: true, signin: "out" });
  assert.equal(r.dom.row.hidden, true);
  r.st.signin = "in";
  r.emitAccount();
  assert.equal(r.dom.row.hidden, false);
  r.st.compete = false;
  r.emitAccount();
  assert.equal(r.dom.row.hidden, true, "Compete turning OFF hides it");
  r.st.compete = true;
  r.emitAccount();
  assert.equal(r.dom.row.hidden, false);
  r.st.signin = "busy";
  r.emitAccount();
  assert.equal(r.dom.row.hidden, true);
});

test("AUI-04 harness: a tap reaches the seam once; a second tap while one is in flight is ignored", async () => {
  const base = createFakePlayIdentity({ signedIn: true, playerId: "player-aaa-0001" });
  let release;
  let shows = 0;
  const seam = Object.freeze({
    ...base,
    status: () => base.status(),
    showAchievements: () => {
      shows++;
      return new Promise((resolve) => {
        release = () => resolve({ ok: true });
      });
    },
    calls: () => base.calls(),
  });
  const r = rig({ dom: true, compete: true, signin: "in", seam });
  const first = r.dom.btn.click();
  await settle();
  assert.equal(shows, 1);
  await r.dom.btn.click();
  assert.equal(shows, 1, "the second tap was ignored");
  release();
  await first;
  const again = r.dom.btn.click();
  await settle();
  assert.equal(shows, 2, "after the answer a new tap goes through");
  release();
  await again;
  assert.equal(r.dom.note.hidden, true, "an ok answer leaves the note hidden");
});

test("AUI-04 harness: a tap with the fake seam records one showAchievements call", async () => {
  const r = rig({ dom: true, compete: true, signin: "in" });
  await r.dom.btn.click();
  assert.equal(showCalls(r).length, 1);
  assert.equal(r.dom.note.hidden, true);
});

test("AUI-04 harness: a failed open shows the one failure line; the next tap clears it", async () => {
  const base = createFakePlayIdentity({ signedIn: true, playerId: "player-aaa-0001" });
  let answer = { ok: false, reason: "error" };
  const seam = Object.freeze({
    ...base,
    status: () => base.status(),
    showAchievements: async () => answer,
    calls: () => base.calls(),
  });
  const r = rig({ dom: true, compete: true, signin: "in", seam });
  await r.dom.btn.click();
  assert.equal(r.dom.note.hidden, false);
  assert.equal(r.dom.note.textContent, ACHIEVEMENTS_SHEET_COPY.play.failed);
  answer = { ok: true };
  await r.dom.btn.click();
  assert.equal(r.dom.note.hidden, true);
  assert.equal(r.dom.note.textContent, "");
  answer = { ok: false, reason: "network" };
  await r.dom.btn.click();
  assert.equal(r.dom.note.hidden, false);
  r.st.signin = "out";
  r.emitAccount();
  assert.equal(r.dom.note.hidden, true, "re-syncing the row hidden clears the note");
  assert.equal(r.dom.note.textContent, "");
});

test("AUI-04 harness: a thrown seam answer reads as the failure line too", async () => {
  const base = createFakePlayIdentity({ signedIn: true, playerId: "player-aaa-0001" });
  const seam = Object.freeze({
    ...base,
    status: () => base.status(),
    showAchievements: () => {
      throw new Error("boom");
    },
    calls: () => base.calls(),
  });
  const r = rig({ dom: true, compete: true, signin: "in", seam });
  await assert.doesNotReject(() => r.dom.btn.click());
  assert.equal(r.dom.note.hidden, false);
  assert.equal(r.dom.note.textContent, ACHIEVEMENTS_SHEET_COPY.play.failed);
});

test("AUI-04 harness: a tap after Compete went OFF behind the button's back reaches nothing and says nothing", async () => {
  const r = rig({ dom: true, compete: true, signin: "in" });
  assert.equal(r.dom.row.hidden, false);
  r.st.compete = false; // no account event: the row stays forced visible
  assert.equal(r.dom.row.hidden, false);
  await r.dom.btn.click();
  assert.deepEqual(r.seam.calls(), [], "no seam call at all");
  assert.equal(r.dom.note.hidden, true);
  assert.equal(r.storage.calls.length, 0);
});

test("AUI-04 harness: with no row elements in the document the block still evaluates and the account hook still runs", () => {
  const r = rig({ compete: true, signin: "out" });
  assert.equal(r.dom, null);
  r.st.signin = "in";
  assert.doesNotThrow(() => r.emitAccount());
  assert.doesNotThrow(() => r.syncPlayAchievementsButton());
});

test("AUI-04 harness: nothing opens Play's screen without a tap, whatever the account does", () => {
  const r = rig({ dom: true, compete: true, signin: "in" });
  r.st.signin = "out";
  r.emitAccount();
  r.st.signin = "in";
  r.emitAccount();
  assert.equal(showCalls(r).length, 0);
});

// ═══════════════════════ Part 3: the docs section ══════════════════════════

const DOCS = fs.readFileSync(path.join(REPO_ROOT, "docs", "SHELL-MODULES.md"), "utf8").replace(/\r\n/g, "\n");
const DOCS_HEADING = "### Play Games achievements mirror (Phase 101)";

function docsSection() {
  const start = DOCS.indexOf(DOCS_HEADING);
  assert.ok(start !== -1, "the section exists");
  const ends = [DOCS.indexOf("\n## ", start + DOCS_HEADING.length), DOCS.indexOf("\n### ", start + DOCS_HEADING.length)].filter((i) => i !== -1);
  return DOCS.slice(start, ends.length ? Math.min(...ends) : DOCS.length);
}

test("docs: the Play mirror section sits after the Phase 100 list section and before 'What stays shared'", () => {
  const list = DOCS.indexOf("### Achievements list (Phase 100)");
  const mirror = DOCS.indexOf(DOCS_HEADING);
  const shared = DOCS.indexOf("## What stays shared");
  assert.ok(list !== -1 && mirror > list && shared > mirror);
  assert.equal(occurrences(DOCS, DOCS_HEADING), 1);
});

test("docs: the Play mirror section names the module, the bus hook, the ledger key, the ops, the gate and boardSync", () => {
  const text = docsSection();
  for (const needle of [
    "createAchievementMirror",
    "achievementEvents.subscribe",
    "ddr.pgsAch.v1",
    "syncAchievements",
    "setStepsImmediate",
    "Compete OFF",
    "boardSync",
    "onAccountForMirror",
    "waitForPending",
  ]) {
    assert.ok(text.includes(needle), `the section names ${needle}`);
  }
});

test("docs: the Play mirror section does not use the retired notification word", () => {
  const retired = ["to", "ast"].join("");
  assert.equal(docsSection().toLowerCase().includes(retired), false);
});
