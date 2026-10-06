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
  const doc = { ...makeListeners(), visibilityState: "visible" };
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
    `${BLOCK}\nreturn { achievementMirror, onAchievementMirror, onAccountForMirror };`,
  );
  const out = factory(win, doc, nav, wrapped, competeIsOn, playIdentity, getAchievementRecord, bus, account, queueMicro);
  return { st, account, emitAccount, seam, storage, sched, win, doc, micro, drainMicro, seen, bus, banner, getAchievementRecord, ...out };
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
