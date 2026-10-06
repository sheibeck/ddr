// test/unit/play-achievements-flush.test.js
//
// Phase 101 plan 02 task 2. createAchievementMirror over a recording fake seam,
// a Map-backed async storage, a manual scheduler and an injected clock: the
// gate order, batching, the per-batch ledger, backoff, the account switch,
// timers, single-flight, failure isolation, and the Compete OFF proof.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { sanitizeRecord } from "../../src/browser/achievementRecord.js";
import { createAchievementBus } from "../../src/browser/achievementBus.js";
import { backoffMs } from "../../src/browser/runQueue.js";
import {
  PGS_ACH_KEY,
  BATCH_MAX,
  UNLOCK_DELAY_MS,
  PROGRESS_DELAY_MS,
  achievementResourceName,
  createAchievementMirror,
} from "../../src/browser/playAchievements.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const P1 = "player-aaa-0001";
const P2 = "player-bbb-0002";

/* ---------------- helpers ---------------- */

function makeStorage(events, initial) {
  const map = new Map(initial || []);
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
      if (events) events.push("set");
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
    fire(t) {
      t.fired = true;
      t.fn();
    },
  };
}

const allOk = (arg) => ({ ok: true, results: arg.ops.map((_, i) => ({ i, ok: true })) });

function makeSeam(events) {
  const api = {
    calls: [],
    inFlight: 0,
    maxInFlight: 0,
    statusAnswer: { ok: true, signedIn: true, playerId: P1, displayName: "Hero" },
    syncAnswers: [],
    onSync: null,
    onStatus: null,
    showAnswer: { ok: true },
    syncCalls() {
      return api.calls.filter((c) => c.method === "syncAchievements");
    },
    statusCalls() {
      return api.calls.filter((c) => c.method === "status");
    },
    async status() {
      api.calls.push({ method: "status" });
      if (events) events.push("status");
      if (api.onStatus) api.onStatus();
      await null;
      const a = api.statusAnswer;
      return typeof a === "function" ? a() : a;
    },
    async syncAchievements(arg) {
      api.calls.push({ method: "syncAchievements", arg: JSON.parse(JSON.stringify(arg)) });
      if (events) events.push("sync");
      api.inFlight += 1;
      api.maxInFlight = Math.max(api.maxInFlight, api.inFlight);
      if (api.onSync) api.onSync(arg, api.syncCalls().length);
      await null;
      await null;
      api.inFlight -= 1;
      const a = api.syncAnswers.length ? api.syncAnswers.shift() : allOk;
      return typeof a === "function" ? a(arg) : a;
    },
    async showAchievements() {
      api.calls.push({ method: "showAchievements" });
      return api.showAnswer;
    },
  };
  return api;
}

function rec(extra = {}) {
  return sanitizeRecord({ v: 1, ...extra });
}

// Three realistic unlocks in the real catalog.
const THREE = { unlocked: { special_snowflake: 1, class_fighter: 2, race_human: 3 } };

function rig(over = {}) {
  const events = [];
  const st = { compete: true, online: true, record: over.record === undefined ? rec(THREE) : over.record, t: 1_000_000 };
  const storage = over.storage || makeStorage(events, over.initial);
  const seam = over.seam || makeSeam(events);
  const sched = makeSched();
  const logs = [];
  const make = () =>
    createAchievementMirror({
      storage,
      playIdentity: seam,
      competeOn: () => st.compete,
      online: () => st.online,
      getRecord: over.getRecord ? () => over.getRecord(st) : () => st.record,
      catalog: over.catalog,
      now: () => st.t,
      setTimer: sched.setTimer,
      clearTimer: sched.clearTimer,
      log: (l) => logs.push(l),
    });
  const r = { st, storage, seam, sched, logs, events, make, mirror: make() };
  r.relaunch = () => {
    r.mirror = make();
    return r.mirror;
  };
  return r;
}

// A synthetic catalog of standard entries, for batch-size tests.
function synthCatalog(n) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const tag = String(i).padStart(3, "0");
    list.push({ id: `synth_${tag}`, name: `Synth ${tag}`, type: "standard", initialState: "Revealed", listOrder: i + 1 });
  }
  return list;
}
function synthRecord(n) {
  const unlocked = {};
  for (let i = 0; i < n; i++) unlocked[`synth_${String(i).padStart(3, "0")}`] = i + 1;
  return { unlocked, revealed: [] };
}

const flush = (r, o) => r.mirror.flush(o);

/* ---------------- the Compete OFF proof ---------------- */

test("Compete OFF proof: every entry point makes zero seam calls, no timer and no ledger access", async () => {
  const r = rig();
  r.st.compete = false;
  const m = r.mirror;
  m.kick({ unlocks: [{ id: "special_snowflake", at: 1 }], reveals: [], progress: [] });
  m.kick({ unlocks: [], reveals: ["death_falling"], progress: [] });
  m.kick({ unlocks: [], reveals: [], progress: [{ id: "kills_beasts_t1", value: 3, steps: 50 }] });
  assert.deepEqual(await m.wake(), { ok: false, reason: "off" });
  assert.deepEqual(await m.wake({ force: true, checkPlayer: true }), { ok: false, reason: "off" });
  assert.deepEqual(await m.flush(), { ok: false, reason: "off" });
  assert.deepEqual(await m.flush({ force: true }), { ok: false, reason: "off" });
  assert.deepEqual(await m.showAchievements(), { ok: false, reason: "off" });
  await m.waitForPending();

  assert.deepEqual(r.seam.calls, []);
  assert.deepEqual(r.sched.active(), []);
  assert.equal(r.sched.timers.length, 0);
  assert.deepEqual(r.storage.calls.filter((c) => c.key === PGS_ACH_KEY), []);
  assert.deepEqual(r.storage.calls, []);
});

test("Compete OFF clears timers a kick scheduled while ON", async () => {
  const r = rig();
  r.mirror.kick({ unlocks: [{ id: "special_snowflake", at: 1 }] });
  assert.equal(r.sched.active().length, 1);
  r.st.compete = false;
  r.mirror.kick({ unlocks: [{ id: "class_fighter", at: 2 }] });
  assert.equal(r.sched.active().length, 0);
});

test("only a strict true counts as Compete ON", async () => {
  for (const v of ["yes", 1, {}, undefined, null]) {
    const r = rig();
    const m = createAchievementMirror({
      storage: r.storage,
      playIdentity: r.seam,
      competeOn: () => v,
      online: () => true,
      getRecord: () => r.st.record,
      setTimer: r.sched.setTimer,
      clearTimer: r.sched.clearTimer,
    });
    assert.deepEqual(await m.flush(), { ok: false, reason: "off" });
    assert.deepEqual(r.seam.calls, []);
  }
});

/* ---------------- gate order ---------------- */

test("gate: a null record is notready with no seam call", async () => {
  const r = rig({ record: null });
  assert.deepEqual(await flush(r), { ok: false, reason: "notready" });
  assert.deepEqual(r.seam.calls, []);
});

test("gate: offline gives offline with no seam call", async () => {
  const r = rig();
  r.st.online = false;
  assert.deepEqual(await flush(r), { ok: false, reason: "offline" });
  assert.deepEqual(r.seam.calls, []);
});

test("gate: an unforced flush inside retryAt is backoff, a forced one proceeds", async () => {
  const r = rig();
  r.seam.syncAnswers = [{ ok: false, reason: "unavailable" }];
  const first = await flush(r);
  assert.equal(first.reason, "error");
  const calls = r.seam.calls.length;
  assert.deepEqual(await flush(r), { ok: false, reason: "backoff" });
  assert.equal(r.seam.calls.length, calls);
  const forced = await flush(r, { force: true });
  assert.equal(forced.ok, true);
  assert.ok(r.seam.calls.length > calls);
});

test("gate: nothing pending is ok with no seam call, not even status", async () => {
  const r = rig({ record: rec() });
  const res = await flush(r);
  assert.equal(res.ok, true);
  assert.equal(res.sent, 0);
  assert.deepEqual(r.seam.calls, []);
});

test("gate: signed out is a signin hold with no backoff and the ledger untouched", async () => {
  const r = rig();
  r.seam.statusAnswer = { ok: true, signedIn: false };
  const res = await flush(r);
  assert.deepEqual(res, { ok: false, reason: "signin" });
  assert.equal(r.seam.syncCalls().length, 0);
  const snap = await r.mirror.snapshot();
  assert.equal(snap.failures, 0);
  assert.equal(snap.retryAt, 0);
  assert.deepEqual(snap.u, []);
  assert.equal(snap.player, null);
  // a second flush straight away is not a backoff
  assert.equal((await flush(r)).reason, "signin");
});

test("gate: a status answer of signin is the same hold", async () => {
  const r = rig();
  r.seam.statusAnswer = { ok: false, reason: "signin" };
  assert.equal((await flush(r)).reason, "signin");
  assert.equal((await r.mirror.snapshot()).failures, 0);
});

test("gate: a status failure or garbage advances the backoff and never throws", async () => {
  for (const bad of [{ ok: false, reason: "unavailable" }, null, "x", { ok: true }, { ok: true, signedIn: true }]) {
    const r = rig();
    r.seam.statusAnswer = bad;
    const res = await flush(r);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "error");
    assert.equal((await r.mirror.snapshot()).failures, 1);
    assert.equal(r.seam.syncCalls().length, 0);
  }
});

/* ---------------- sending ---------------- */

test("sending: one status then one sync whose ops carry kind and resource, never an id", async () => {
  const r = rig();
  const res = await flush(r);
  assert.deepEqual(res, { ok: true, sent: 3, skipped: 0, remaining: 0 });
  assert.equal(r.seam.statusCalls().length, 1);
  assert.equal(r.seam.syncCalls().length, 1);
  const ops = r.seam.syncCalls()[0].arg.ops;
  assert.equal(ops.length, 3);
  for (const op of ops) {
    assert.deepEqual(Object.keys(op).sort(), ["kind", "resource"]);
    assert.equal(op.kind, "unlock");
    assert.match(op.resource, /^achievement_[a-z0-9_]+$/);
  }
  const snap = await r.mirror.snapshot();
  assert.deepEqual([...snap.u].sort(), ["class_fighter", "race_human", "special_snowflake"]);
  assert.equal(snap.player, P1);
  assert.equal(snap.failures, 0);
  assert.equal(snap.retryAt, 0);
  assert.ok(Object.isFrozen(snap));
});

test("sending: steps ops carry n, reveals carry no n, and the ledger records each", async () => {
  const r = rig({ record: rec({ kills: { Beasts: 37 }, revealed: ["death_falling"] }) });
  await flush(r);
  const ops = r.seam.syncCalls()[0].arg.ops;
  assert.equal(ops[0].kind, "reveal");
  assert.equal("n" in ops[0], false);
  const steps = ops.filter((o) => o.kind === "steps");
  assert.equal(steps.length, 4);
  assert.ok(steps.every((o) => o.n === 37));
  const snap = await r.mirror.snapshot();
  assert.deepEqual([...snap.r], ["death_falling"]);
  assert.equal(snap.s.kills_beasts_t1, 37);
  // a resend of the same record sends nothing, then one more kill resends only the steps
  const calls = r.seam.syncCalls().length;
  await flush(r);
  assert.equal(r.seam.syncCalls().length, calls);
  r.st.record = rec({ kills: { Beasts: 38 }, revealed: ["death_falling"] });
  await flush(r);
  const last = r.seam.syncCalls().at(-1).arg.ops;
  assert.equal(last.length, 4);
  assert.ok(last.every((o) => o.kind === "steps" && o.n === 38));
});

test("sending: a record with exactly one change sends one batch holding one op", async () => {
  const r = rig({ record: rec({ unlocked: { chicken: 5 } }) });
  await flush(r);
  assert.equal(r.seam.syncCalls().length, 1);
  assert.equal(r.seam.syncCalls()[0].arg.ops.length, 1);
});

test("sending: two unlocks earned by one action travel in the same batch", async () => {
  const r = rig({ record: rec({ unlocked: { death_trap: 1, death_falling: 1 } }) });
  await flush(r);
  assert.equal(r.seam.syncCalls().length, 1);
  assert.equal(r.seam.syncCalls()[0].arg.ops.length, 2);
});

/* ---------------- batching ---------------- */

test("batching: 30 pending ops make two calls of 20 and 10, persisted between them", async () => {
  const r = rig({ catalog: synthCatalog(30), record: synthRecord(30) });
  const res = await flush(r);
  assert.equal(res.ok, true);
  assert.equal(res.sent, 30);
  const sizes = r.seam.syncCalls().map((c) => c.arg.ops.length);
  assert.deepEqual(sizes, [BATCH_MAX, 10]);
  // call order: the ledger is written after the first batch before the second call
  const firstSync = r.events.indexOf("sync");
  const secondSync = r.events.indexOf("sync", firstSync + 1);
  assert.ok(r.events.slice(firstSync + 1, secondSync).includes("set"), `events: ${r.events.join(",")}`);
  assert.equal(JSON.parse(r.storage.map.get(PGS_ACH_KEY)).u.length, 30);
});

test("batching: exactly 20 pending ops are one call and 21 are two", async () => {
  const a = rig({ catalog: synthCatalog(20), record: synthRecord(20) });
  await flush(a);
  assert.deepEqual(a.seam.syncCalls().map((c) => c.arg.ops.length), [20]);
  const b = rig({ catalog: synthCatalog(21), record: synthRecord(21) });
  await flush(b);
  assert.deepEqual(b.seam.syncCalls().map((c) => c.arg.ops.length), [20, 1]);
});

test("batching: the real catalog's whole backlog drains in acknowledged batches of at most 20", async () => {
  const everything = {};
  for (const e of ACHIEVEMENTS) everything[e.id] = 1;
  const r = rig({ record: rec({ unlocked: everything, revealed: ["death_falling"] }) });
  const res = await flush(r);
  assert.equal(res.ok, true);
  assert.equal(res.remaining, 0);
  assert.ok(r.seam.syncCalls().every((c) => c.arg.ops.length <= BATCH_MAX));
  assert.equal(res.sent, 77);
  assert.equal((await flush(r)).sent, 0);
});

/* ---------------- mid-flush flip ---------------- */

test("a Compete flip to OFF during a batch lands that batch but sends no further batch", async () => {
  const r = rig({ catalog: synthCatalog(30), record: synthRecord(30) });
  r.seam.onSync = (_arg, n) => {
    if (n === 1) r.st.compete = false;
  };
  const res = await flush(r);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "off");
  assert.equal(r.seam.syncCalls().length, 1);
  const snap = await r.mirror.snapshot();
  assert.equal(snap.u.length, 20);
});

/* ---------------- per-op answers ---------------- */

test("refused ops (unknown, type, config, error) are skipped for the session and retried by a new mirror", async () => {
  for (const reason of ["unknown", "type", "config", "error"]) {
    const r = rig();
    r.seam.syncAnswers = [(arg) => ({ ok: true, results: arg.ops.map((_, i) => (i === 1 ? { i, ok: false, reason } : { i, ok: true })) })];
    const res = await flush(r);
    assert.equal(res.ok, true, reason);
    const snap = await r.mirror.snapshot();
    assert.equal(snap.u.length, 2, reason);
    assert.equal(snap.skipped.length, 1, reason);
    const calls = r.seam.syncCalls().length;
    await flush(r);
    assert.equal(r.seam.syncCalls().length, calls, `${reason}: the skipped id is not sent again this session`);

    r.relaunch();
    await flush(r);
    assert.equal(r.seam.syncCalls().length, calls + 1, `${reason}: a new mirror retries it`);
    assert.equal(r.seam.syncCalls().at(-1).arg.ops.length, 1);
    assert.equal(JSON.parse(r.storage.map.get(PGS_ACH_KEY)).u.length, 3);
  }
});

test("an all-config answer leaves every id skipped, later flushes make no seam call, and the record is untouched", async () => {
  const r = rig();
  const before = JSON.stringify(r.st.record);
  r.seam.syncAnswers = [(arg) => ({ ok: true, results: arg.ops.map((_, i) => ({ i, ok: false, reason: "config" })) })];
  const res = await flush(r);
  assert.equal(res.ok, true);
  assert.equal((await r.mirror.snapshot()).skipped.length, 3);
  const calls = r.seam.calls.length;
  await flush(r);
  await flush(r, { force: true });
  await r.mirror.wake({ checkPlayer: true });
  assert.equal(r.seam.calls.length, calls);
  assert.equal(JSON.stringify(r.st.record), before);
  // a new record entry later in the same session is not sent either (the file is absent)
  r.st.record = rec({ unlocked: { chicken: 1 } });
  await flush(r);
  assert.equal(r.seam.calls.length, calls);
});

test("network: a per-op network stops after that op, acks the earlier ops, and advances the backoff", async () => {
  const r = rig();
  r.seam.syncAnswers = [
    (arg) => ({ ok: true, results: arg.ops.slice(0, 2).map((_, i) => (i === 0 ? { i, ok: true } : { i, ok: false, reason: "network" })) }),
  ];
  const res = await flush(r);
  assert.deepEqual(res, { ok: false, reason: "network", sent: 1 });
  let snap = await r.mirror.snapshot();
  assert.equal(snap.u.length, 1);
  assert.equal(snap.failures, 1);
  assert.equal(snap.retryAt, r.st.t + backoffMs(1));

  const calls = r.seam.calls.length;
  assert.equal((await flush(r)).reason, "backoff");
  assert.equal(r.seam.calls.length, calls);

  // a second network failure doubles the backoff
  r.seam.syncAnswers = [(arg) => ({ ok: true, results: arg.ops.map((_, i) => ({ i, ok: false, reason: "network" })) })];
  const second = await flush(r, { force: true });
  assert.equal(second.reason, "network");
  snap = await r.mirror.snapshot();
  assert.equal(snap.failures, 2);
  assert.equal(snap.retryAt, r.st.t + backoffMs(2));

  // a later success resets both
  const third = await flush(r, { force: true });
  assert.equal(third.ok, true);
  snap = await r.mirror.snapshot();
  assert.equal(snap.failures, 0);
  assert.equal(snap.retryAt, 0);
});

test("a per-op signin is a hold: no backoff", async () => {
  const r = rig();
  r.seam.syncAnswers = [(arg) => ({ ok: true, results: arg.ops.map((_, i) => ({ i, ok: false, reason: "signin" })) })];
  const res = await flush(r);
  assert.equal(res.reason, "signin");
  const snap = await r.mirror.snapshot();
  assert.equal(snap.failures, 0);
  assert.equal(snap.retryAt, 0);
  assert.equal(snap.u.length, 0);
});

test("call-level answers: signin is a hold, unavailable or garbage advance the backoff and never throw", async () => {
  const signin = rig();
  signin.seam.syncAnswers = [{ ok: false, reason: "signin" }];
  assert.equal((await flush(signin)).reason, "signin");
  assert.equal((await signin.mirror.snapshot()).failures, 0);

  const unavailable = rig();
  unavailable.seam.syncAnswers = [{ ok: false, reason: "unavailable" }];
  assert.equal((await flush(unavailable)).reason, "error");
  assert.equal((await unavailable.mirror.snapshot()).failures, 1);

  const network = rig();
  network.seam.syncAnswers = [{ ok: false, reason: "network" }];
  assert.equal((await flush(network)).reason, "network");
  assert.equal((await network.mirror.snapshot()).failures, 1);

  for (const garbage of [null, undefined, "nope", 7, { ok: true }, { ok: true, results: "x" }, { ok: true, results: [] }, { ok: "yes" }]) {
    const g = rig();
    g.seam.syncAnswers = [garbage];
    const res = await flush(g);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "error");
    assert.equal((await g.mirror.snapshot()).failures, 1);
    assert.equal((await g.mirror.snapshot()).u.length, 0);
  }
});

test("results with a bad index are ignored and the op stays pending", async () => {
  const r = rig();
  r.seam.syncAnswers = [{ ok: true, results: [{ i: 0, ok: true }, { i: 99, ok: true }, { i: 0, ok: false, reason: "type" }, null, { i: "1", ok: true }] }];
  const res = await flush(r);
  assert.equal(res.ok, true);
  // only the first valid answer for index 0 counted; the other two ops were never answered, so the next batch carries them
  assert.deepEqual(r.seam.syncCalls().map((c) => c.arg.ops.length), [3, 2]);
  assert.equal(res.sent, 3);
});

/* ---------------- relaunch and dedupe ---------------- */

test("relaunch: a new mirror over the same storage resends nothing, and sends exactly one new unlock", async () => {
  const r = rig();
  await flush(r);
  const calls = r.seam.calls.length;
  r.relaunch();
  const res = await flush(r);
  assert.equal(res.ok, true);
  assert.equal(r.seam.calls.length, calls);

  r.st.record = rec({ unlocked: { ...THREE.unlocked, chicken: 9 } });
  await flush(r);
  const last = r.seam.syncCalls().at(-1).arg.ops;
  assert.equal(last.length, 1);
  assert.equal(last[0].resource, achievementResourceName(ACHIEVEMENTS.find((e) => e.id === "chicken")));
});

test("relaunch: only what was never acked is resent after an interrupted sync", async () => {
  const r = rig({ catalog: synthCatalog(30), record: synthRecord(30) });
  r.seam.onSync = (_arg, n) => {
    if (n === 1) r.st.online = false;
  };
  const res = await flush(r);
  assert.equal(res.reason, "offline");
  r.st.online = true;
  r.relaunch();
  await flush(r);
  const last = r.seam.syncCalls().at(-1).arg.ops;
  assert.equal(last.length, 10);
});

test("a corrupt stored ledger loads empty and the mirror recovers", async () => {
  for (const bad of ["{not json", "[]", JSON.stringify({ v: 9, u: ["chicken"] }), JSON.stringify({ v: 1, u: ["nope"], s: { x: 4 } })]) {
    const r = rig({ initial: [[PGS_ACH_KEY, bad]] });
    const res = await flush(r);
    assert.equal(res.ok, true);
    assert.equal(res.sent, 3);
  }
});

test("a storage that throws on read or write never breaks a flush", async () => {
  const events = [];
  const storage = makeStorage(events);
  storage.getItem = async () => {
    throw new Error("read");
  };
  storage.setItem = async () => {
    throw new Error("write");
  };
  const r = rig({ storage });
  const res = await flush(r);
  assert.equal(res.ok, true);
  assert.equal(res.sent, 3);
  await r.mirror.waitForPending();
});

/* ---------------- account switch ---------------- */

test("account switch: a changed playerId clears the acks and resends everything to the new account", async () => {
  const r = rig();
  await flush(r);
  assert.equal(r.seam.syncCalls().length, 1);
  r.seam.statusAnswer = { ok: true, signedIn: true, playerId: P2, displayName: "Other" };
  r.st.record = rec({ unlocked: { ...THREE.unlocked, chicken: 9 } });
  await flush(r);
  const last = r.seam.syncCalls().at(-1).arg.ops;
  assert.equal(last.length, 4);
  const snap = await r.mirror.snapshot();
  assert.equal(snap.player, P2);
  assert.equal(snap.u.length, 4);
  assert.equal(JSON.parse(r.storage.map.get(PGS_ACH_KEY)).player, P2);
});

test("account switch: the adopted player is persisted before the first batch", async () => {
  const r = rig();
  await flush(r);
  const syncAt = r.events.indexOf("sync");
  assert.ok(r.events.slice(0, syncAt).includes("set"), `events: ${r.events.join(",")}`);
});

test("wake({ checkPlayer }) with nothing pending still asks status once; a switch resends everything, the same player sends nothing", async () => {
  const same = rig();
  await flush(same);
  const before = same.seam.syncCalls().length;
  await same.mirror.wake({ checkPlayer: true });
  assert.equal(same.seam.statusCalls().length, 2);
  assert.equal(same.seam.syncCalls().length, before);

  const switched = rig();
  await flush(switched);
  switched.seam.statusAnswer = { ok: true, signedIn: true, playerId: P2, displayName: "Other" };
  const res = await switched.mirror.wake({ checkPlayer: true });
  assert.equal(res.ok, true);
  assert.equal(switched.seam.statusCalls().length, 2);
  assert.equal(switched.seam.syncCalls().length, 2);
  assert.equal(switched.seam.syncCalls().at(-1).arg.ops.length, 3);
});

test("wake({ checkPlayer }) with an empty record makes no seam call at all", async () => {
  const r = rig({ record: rec() });
  const res = await r.mirror.wake({ checkPlayer: true });
  assert.equal(res.ok, true);
  assert.deepEqual(r.seam.calls, []);
});

/* ---------------- the backlog guarantee (PGS-08) ---------------- */

test("backlog: what was earned while Compete was OFF syncs once Compete is ON, and a resend does not double-send", async () => {
  const r = rig({ record: rec({ unlocked: { special_snowflake: 1 }, kills: { Beasts: 12 } }) });
  r.st.compete = false;
  await flush(r);
  assert.deepEqual(r.seam.calls, []);
  r.st.compete = true;
  const res = await flush(r);
  assert.equal(res.ok, true);
  assert.equal(res.sent, 5);
  const calls = r.seam.syncCalls().length;
  await flush(r);
  await flush(r, { force: true });
  assert.equal(r.seam.syncCalls().length, calls);
});

test("backlog: signed out then signed in, and offline then online, both drain on the first gated flush", async () => {
  const a = rig();
  a.seam.statusAnswer = { ok: true, signedIn: false };
  assert.equal((await flush(a)).reason, "signin");
  a.seam.statusAnswer = { ok: true, signedIn: true, playerId: P1 };
  assert.equal((await flush(a)).sent, 3);

  const b = rig();
  b.st.online = false;
  assert.equal((await flush(b)).reason, "offline");
  b.st.online = true;
  assert.equal((await flush(b)).sent, 3);
});

/* ---------------- single-flight ---------------- */

test("single-flight: three wakes fired together share one promise, one status and one run of batches", async () => {
  const r = rig();
  const [a, b, c] = [r.mirror.wake(), r.mirror.wake(), r.mirror.wake()];
  assert.equal(a, b);
  assert.equal(b, c);
  await Promise.all([a, b, c]);
  assert.equal(r.seam.statusCalls().length, 1);
  assert.equal(r.seam.syncCalls().length, 1);
  assert.equal(r.seam.maxInFlight, 1);
});

test("single-flight: three wakes with checkPlayer are still one status", async () => {
  const r = rig();
  await Promise.all([r.mirror.wake({ checkPlayer: true }), r.mirror.wake({ checkPlayer: true }), r.mirror.wake({ checkPlayer: true })]);
  assert.equal(r.seam.statusCalls().length, 1);
  assert.equal(r.seam.syncCalls().length, 1);
});

test("single-flight: a wake during an in-flight flush gives one trailing pass that picks up a record change", async () => {
  // The record is read on a known schedule, so the change lands after the last
  // batch's own re-read: only a trailing pass can send it.
  let readsAfterSync = 0;
  let injected = false;
  let mirrorRef = null;
  const r = rig({
    record: rec({ unlocked: { chicken: 1 } }),
    getRecord: (st) => {
      if (r && r.seam.syncCalls().length >= 1 && !injected) {
        readsAfterSync += 1;
        if (readsAfterSync === 2) {
          injected = true;
          st.record = rec({ unlocked: { chicken: 1, death_trap: 2 } });
          mirrorRef.wake();
        }
      }
      return st.record;
    },
  });
  mirrorRef = r.mirror;
  const res = await r.mirror.flush();
  assert.equal(res.ok, true);
  assert.equal(r.seam.syncCalls().length, 2);
  assert.equal(r.seam.syncCalls()[1].arg.ops.length, 1);
  assert.equal(r.seam.statusCalls().length, 1, "the trailing pass reuses the identity just checked");
  assert.equal(r.seam.maxInFlight, 1);
});

test("single-flight: a record change mid-flush is picked up without a second status or concurrent sync", async () => {
  const r = rig({ catalog: synthCatalog(30), record: synthRecord(30) });
  r.seam.onSync = (_arg, n) => {
    if (n === 1) {
      const rec2 = synthRecord(30);
      r.st.record = rec2;
      r.mirror.wake();
    }
  };
  await r.mirror.flush();
  assert.equal(r.seam.maxInFlight, 1);
  assert.equal(r.seam.statusCalls().length, 1);
});

/* ---------------- timers ---------------- */

test("timers: an unlock payload schedules one UNLOCK_DELAY_MS timer, a second schedules none", () => {
  const r = rig();
  r.mirror.kick({ unlocks: [{ id: "special_snowflake", at: 1 }], reveals: [], progress: [] });
  assert.deepEqual(r.sched.active().map((t) => t.ms), [UNLOCK_DELAY_MS]);
  r.mirror.kick({ unlocks: [{ id: "class_fighter", at: 2 }], reveals: [], progress: [] });
  r.mirror.kick({ unlocks: [], reveals: ["death_falling"], progress: [] });
  assert.equal(r.sched.timers.length, 1);
});

test("timers: a progress-only payload schedules one PROGRESS_DELAY_MS timer that later progress does not reset", () => {
  const r = rig();
  const p = { unlocks: [], reveals: [], progress: [{ id: "kills_beasts_t1", value: 3, steps: 50 }] };
  r.mirror.kick(p);
  r.mirror.kick(p);
  assert.deepEqual(r.sched.active().map((t) => t.ms), [PROGRESS_DELAY_MS]);
  assert.equal(r.sched.timers.length, 1);
  assert.equal(r.sched.timers[0].cleared, false);
});

test("timers: a reveal-only payload counts as an unlock-speed payload", () => {
  const r = rig();
  r.mirror.kick({ unlocks: [], reveals: ["death_falling"], progress: [] });
  assert.deepEqual(r.sched.active().map((t) => t.ms), [UNLOCK_DELAY_MS]);
});

test("timers: firing a timer runs a flush and the timer clears itself", async () => {
  const r = rig();
  r.mirror.kick({ unlocks: [{ id: "special_snowflake", at: 1 }] });
  const t = r.sched.active()[0];
  r.sched.fire(t);
  await r.mirror.waitForPending();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(r.seam.syncCalls().length, 1);
  assert.deepEqual(r.sched.active(), []);
  // after firing, a new unlock may schedule a fresh timer
  r.mirror.kick({ unlocks: [{ id: "class_fighter", at: 2 }] });
  assert.equal(r.sched.active().length, 1);
});

test("timers: cancel clears both", () => {
  const r = rig();
  r.mirror.kick({ unlocks: [{ id: "special_snowflake", at: 1 }] });
  r.mirror.kick({ progress: [{ id: "kills_beasts_t1", value: 1, steps: 50 }] });
  assert.equal(r.sched.active().length, 2);
  r.mirror.cancel();
  assert.deepEqual(r.sched.active(), []);
});

test("timers: both an unlock and a progress timer can be held at once", () => {
  const r = rig();
  r.mirror.kick({ progress: [{ id: "kills_beasts_t1", value: 1, steps: 50 }] });
  r.mirror.kick({ unlocks: [{ id: "special_snowflake", at: 1 }] });
  assert.deepEqual(r.sched.active().map((t) => t.ms).sort((a, b) => a - b), [UNLOCK_DELAY_MS, PROGRESS_DELAY_MS]);
  r.mirror.cancel();
  assert.deepEqual(r.sched.active(), []);
});

test("timers: null, {}, empty arrays and non-objects schedule nothing and kick returns undefined", () => {
  const r = rig();
  for (const p of [null, undefined, {}, { unlocks: [], reveals: [], progress: [] }, "x", 5, [], { unlocks: "no" }]) {
    assert.equal(r.mirror.kick(p), undefined);
  }
  assert.equal(r.sched.timers.length, 0);
});

/* ---------------- showAchievements ---------------- */

test("showAchievements: gated by Compete, otherwise the normalized seam answer", async () => {
  const r = rig();
  assert.deepEqual(await r.mirror.showAchievements(), { ok: true });
  r.seam.showAnswer = { ok: false, reason: "signin" };
  assert.deepEqual(await r.mirror.showAchievements(), { ok: false, reason: "signin" });
  for (const bad of [null, "x", { ok: false, reason: "weird" }, { ok: false }, {}]) {
    r.seam.showAnswer = bad;
    assert.deepEqual(await r.mirror.showAchievements(), { ok: false, reason: "error" });
  }
  r.st.compete = false;
  const calls = r.seam.calls.length;
  assert.deepEqual(await r.mirror.showAchievements(), { ok: false, reason: "off" });
  assert.equal(r.seam.calls.length, calls);
});

/* ---------------- failure isolation ---------------- */

test("failure isolation: a seam that throws synchronously never breaks kick, flush, wake or showAchievements", async () => {
  const boom = () => {
    throw new Error("sync throw");
  };
  const seam = { status: boom, syncAchievements: boom, showAchievements: boom };
  const r = rig({ seam });
  assert.doesNotThrow(() => r.mirror.kick({ unlocks: [{ id: "special_snowflake", at: 1 }] }));
  const res = await flush(r);
  assert.equal(res.ok, false);
  assert.equal((await r.mirror.wake()).ok, false);
  assert.deepEqual(await r.mirror.showAchievements(), { ok: false, reason: "error" });
  await r.mirror.snapshot();
  await r.mirror.waitForPending();
});

test("failure isolation: a seam whose promises reject, or that answers garbage, is the same", async () => {
  const seam = {
    status: () => Promise.reject(new Error("no")),
    syncAchievements: () => Promise.reject(new Error("no")),
    showAchievements: () => Promise.reject(new Error("no")),
  };
  const r = rig({ seam });
  assert.equal((await flush(r)).reason, "error");
  assert.deepEqual(await r.mirror.showAchievements(), { ok: false, reason: "error" });

  const signedIn = rig();
  signedIn.seam.syncAchievements = () => Promise.reject(new Error("sync reject"));
  assert.equal((await flush(signedIn)).reason, "error");
  assert.equal((await signedIn.mirror.snapshot()).failures, 1);

  const missing = rig({ seam: {} });
  assert.equal((await flush(missing)).ok, false);
});

test("failure isolation: a getRecord that throws is notready, never a rejection", async () => {
  const r = rig({
    getRecord: () => {
      throw new Error("record");
    },
  });
  assert.doesNotThrow(() => r.mirror.kick({ unlocks: [{ id: "chicken", at: 1 }] }));
  assert.deepEqual(await flush(r), { ok: false, reason: "notready" });
  assert.deepEqual(r.seam.calls, []);
});

test("failure isolation: a clock, an online check or a scheduler that throws is survived", async () => {
  const r = rig();
  const m = createAchievementMirror({
    storage: r.storage,
    playIdentity: r.seam,
    competeOn: () => true,
    online: () => {
      throw new Error("online");
    },
    getRecord: () => r.st.record,
    setTimer: () => {
      throw new Error("timer");
    },
    clearTimer: () => {
      throw new Error("clear");
    },
    now: () => {
      throw new Error("now");
    },
  });
  assert.doesNotThrow(() => m.kick({ unlocks: [{ id: "chicken", at: 1 }] }));
  assert.doesNotThrow(() => m.cancel());
  assert.equal((await m.flush()).reason, "offline");
});

test("failure isolation: with the real bus, the banner subscriber runs before and despite a throwing mirror", async () => {
  const bus = createAchievementBus();
  const banner = [];
  bus.subscribe((p) => banner.push(p));
  const seam = {
    status() {
      throw new Error("down");
    },
  };
  const r = rig({ seam });
  bus.subscribe((p) => r.mirror.kick(p));
  const payload = Object.freeze({ unlocks: Object.freeze([{ id: "special_snowflake", at: 1 }]), reveals: Object.freeze([]), progress: Object.freeze([]) });
  bus.publish(payload);
  assert.equal(banner.length, 1);
  assert.equal(banner[0], payload);
  r.sched.fire(r.sched.active()[0]);
  await new Promise((resolve) => setImmediate(resolve));
  await r.mirror.waitForPending();
  bus.publish(payload);
  assert.equal(banner.length, 2);
});

test("the mirror never alters the record it reads", async () => {
  const r = rig();
  const frozen = r.st.record;
  const snapshot = JSON.stringify(frozen);
  await flush(r);
  assert.equal(r.st.record, frozen);
  assert.equal(JSON.stringify(r.st.record), snapshot);
});

/* ---------------- privacy of logs ---------------- */

test("privacy: no log line ever carries an achievement id, a resource name, a Play id or a player id", async () => {
  const xml = fs.readFileSync(path.join(REPO_ROOT, "achievements", "games-ids.xml"), "utf8");
  const playIds = [...xml.matchAll(/<string name="achievement_[^"]*"[^>]*>([^<]+)<\/string>/g)].map((m) => m[1]);
  assert.equal(playIds.length, 77);
  const needles = [...ACHIEVEMENTS.map((e) => e.id), ...ACHIEVEMENTS.map(achievementResourceName), ...playIds, P1, P2];

  const logs = [];
  const scenarios = [];
  const run = async (setup, steps) => {
    const r = rig(setup);
    await steps(r);
    logs.push(...r.logs);
  };
  scenarios.push(run({}, async (r) => await flush(r)));
  scenarios.push(
    run({}, async (r) => {
      r.seam.syncAnswers = [(arg) => ({ ok: true, results: arg.ops.map((_, i) => ({ i, ok: false, reason: "config" })) })];
      await flush(r);
    }),
  );
  scenarios.push(
    run({}, async (r) => {
      r.seam.syncAnswers = [(arg) => ({ ok: true, results: arg.ops.map((_, i) => ({ i, ok: false, reason: "network" })) })];
      await flush(r);
      await flush(r);
      await flush(r, { force: true });
    }),
  );
  scenarios.push(
    run({}, async (r) => {
      r.seam.statusAnswer = { ok: true, signedIn: false };
      await flush(r);
      r.st.compete = false;
      await flush(r);
    }),
  );
  scenarios.push(
    run({ record: rec({ unlocked: { chicken: 1 } }) }, async (r) => {
      await flush(r);
      r.seam.statusAnswer = { ok: true, signedIn: true, playerId: P2 };
      await r.mirror.wake({ checkPlayer: true });
    }),
  );
  scenarios.push(
    run({ seam: { status: () => Promise.reject(new Error(`${P1} special_snowflake`)) } }, async (r) => {
      await flush(r);
    }),
  );
  await Promise.all(scenarios);
  assert.ok(logs.length > 0, "the scenarios should have logged something");
  for (const line of logs) {
    assert.equal(typeof line, "string");
    for (const needle of needles) assert.equal(line.includes(needle), false, `a log line carries "${needle}": ${line}`);
  }
});

test("edge: a broken logger never breaks a flush", async () => {
  const r = rig();
  const m = createAchievementMirror({
    storage: r.storage,
    playIdentity: r.seam,
    competeOn: () => true,
    online: () => true,
    getRecord: () => r.st.record,
    setTimer: r.sched.setTimer,
    clearTimer: r.sched.clearTimer,
    log: () => {
      throw new Error("log");
    },
  });
  assert.equal((await m.flush()).ok, true);
});
