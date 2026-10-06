// src/browser/playAchievements.js
//
// Phase 101 (PGS-07, PGS-08, PGS-09, PGS-10, PGS-11). The Play Games mirror's
// brain: a pure, headless module that turns the lifetime achievement record
// (achievementRecord.js) into idempotent Play operations and sends them
// through an injected seam. It is wired into the shell by plan 101-03 and is
// never imported by anything under tools/.
//
// CONTEXT decisions it implements:
//   - The ledger is DERIVED from the record, not an event queue. Pending work
//     is the pure diff pendingOps(record, ledger). The ledger stores only what
//     Play has acknowledged, plus the Play player id and the backoff state,
//     under PGS_ACH_KEY (ddr.pgsAch.v1). The achievement bus is only a
//     wake-up; kick(payload) never reads what the payload says beyond "is
//     there something to send soon".
//   - An incremental entry is mirrored as an absolute step value (clamped to
//     1..steps), which Play treats as "at least N": a resend of the same or a
//     lower number is a no-op, so nothing can double-count. A standard entry
//     is mirrored as an unlock, and a Hidden entry the record has revealed
//     (and not unlocked) as a reveal. Unlock and reveal are one-way.
//   - Resource names, never Play ids, cross the seam. The name is derived from
//     the catalog name (achievementResourceName); the coverage test against
//     achievements/games-ids.xml is the contract (PGS-11).
//   - Gate order, first failing check wins and returns without touching the
//     seam: (1) Compete ON, checked before any storage read or seam call;
//     (2) the record is loaded; (3) online; (4) backoff elapsed (unless
//     forced); nothing pending is a success with no seam call; (5) status():
//     signed out is a hold with no backoff; (6) batches of at most BATCH_MAX
//     ops, with Compete and online re-checked before every batch.
//   - Refused ops (unknown, type, config, error) are skipped for the rest of
//     this mirror's life and are never persisted, so the next launch retries
//     them. A batch whose every answer is config means the resource file is
//     absent: a no-op for the session (PGS-10).
//   - Account switch: a changed Play player id clears the acknowledged
//     unlocks, reveals and steps and resends everything to the new account.
//
// Mirror contract (createAchievementMirror):
//   kick(payload)   the bus subscriber. Synchronous, returns undefined, never
//                   throws and never awaits Play. Compete OFF cancels timers
//                   and returns. An unlock or reveal schedules one flush after
//                   UNLOCK_DELAY_MS; progress alone schedules one after
//                   PROGRESS_DELAY_MS (not reset by later progress).
//   wake(opts)      an immediate flush request ({ force, checkPlayer }).
//   flush(opts)     single-flight. A call that arrives while one is in flight
//                   shares its promise and marks one trailing pass.
//   cancel()        clears both timers.
//   showAchievements()  gated pass-through to the seam.
//   snapshot()      a frozen copy of the ledger plus the session skip list.
//   waitForPending()    resolves when every storage write has settled.
// Persisted: the ledger only. Session-only: the skip set, the timers, the
// single-flight state. Log lines carry only reason codes and counts, never an
// achievement id, a resource name, a Play id or a player id.
//
// Pure and DOM-free: it imports only the catalog, the tracker's progressFor
// and the queue's backoffMs; every side effect (storage, seam, clock, timers,
// log) is injected.

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { progressFor } from "./achievementTracker.js";
import { backoffMs } from "./runQueue.js";

export const PGS_ACH_KEY = "ddr.pgsAch.v1";
export const BATCH_MAX = 20;
export const UNLOCK_DELAY_MS = 1500;
export const PROGRESS_DELAY_MS = 60000;

const PLAYER_MAX = 128;
const ACHIEVEMENT_REASONS = Object.freeze(["unavailable", "signin", "network", "unknown", "type", "config", "error"]);

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function hasOwn(obj, key) {
  return isPlainObject(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

function byListOrder(a, b) {
  return a.listOrder - b.listOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

const DEFAULT_CATALOG = Object.freeze([...ACHIEVEMENTS].sort(byListOrder));

function sortedCatalog(catalog) {
  return Array.isArray(catalog) ? Object.freeze([...catalog].filter(isPlainObject).sort(byListOrder)) : DEFAULT_CATALOG;
}

/** stepsOf(entry) — an entry's step count as an integer of at least 1, else 0. */
function stepsOf(entry) {
  const n = entry && entry.steps;
  return typeof n === "number" && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 0;
}

/**
 * achievementResourceName(entry) — "achievement_" plus the catalog name
 * lower-cased, every run of characters outside [a-z0-9] turned into one
 * underscore and leading or trailing underscores trimmed.
 */
export function achievementResourceName(entry) {
  const name = entry && typeof entry.name === "string" ? entry.name : "";
  return "achievement_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** playOpFor(entry) — the one legal Play op: "steps" for an incremental, "unlock" for a standard entry, else null. */
export function playOpFor(entry) {
  if (!isPlainObject(entry)) return null;
  if (entry.type === "incremental") return "steps";
  if (entry.type === "standard") return "unlock";
  return null;
}

/** emptyLedger() — a fresh { v: 1, player: null, u: [], r: [], s: {}, failures: 0, retryAt: 0 }. */
export function emptyLedger() {
  return { v: 1, player: null, u: [], r: [], s: {}, failures: 0, retryAt: 0 };
}

/**
 * sanitizeLedger(raw, catalog) — a tolerant load. Garbage or another version
 * is the empty ledger; only catalog ids are kept; unlocks and reveals are
 * deduplicated; steps are kept only for incremental ids, truncated to
 * integers and clamped to 1..steps; a bad player reads null. Never throws.
 */
export function sanitizeLedger(raw, catalog) {
  try {
    if (!isPlainObject(raw) || raw.v !== 1) return emptyLedger();
    const cat = sortedCatalog(catalog);
    const ids = new Set(cat.map((e) => e.id));
    const stepsById = new Map();
    for (const e of cat) if (e.type === "incremental" && stepsOf(e) > 0) stepsById.set(e.id, stepsOf(e));

    const pick = (list) => {
      const out = [];
      const seen = new Set();
      for (const id of Array.isArray(list) ? list : []) {
        if (typeof id === "string" && ids.has(id) && !seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      }
      return out;
    };

    const s = {};
    if (isPlainObject(raw.s)) {
      for (const e of cat) {
        if (!stepsById.has(e.id) || !hasOwn(raw.s, e.id)) continue;
        const v = raw.s[e.id];
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        const n = Math.min(Math.trunc(v), stepsById.get(e.id));
        if (n >= 1) s[e.id] = n;
      }
    }

    const player = typeof raw.player === "string" && raw.player.length > 0 && raw.player.length <= PLAYER_MAX ? raw.player : null;
    const failures = Number.isInteger(raw.failures) && raw.failures >= 0 ? raw.failures : 0;
    const retryAt = typeof raw.retryAt === "number" && Number.isFinite(raw.retryAt) && raw.retryAt >= 0 ? raw.retryAt : 0;
    return { v: 1, player, u: pick(raw.u), r: pick(raw.r), s, failures, retryAt };
  } catch {
    return emptyLedger();
  }
}

/**
 * pendingOps(record, ledger, catalog, skip) — the pure diff of the record
 * against what Play has acknowledged. Frozen ops { id, kind, resource } plus
 * n for steps, ordered reveals, then steps, then unlocks, each group in
 * catalog list order (ties by id). `skip` is an optional Set or array of ids
 * to leave out. A null record has nothing pending.
 */
export function pendingOps(record, ledger, catalog, skip) {
  try {
    if (!isPlainObject(record)) return Object.freeze([]);
    const cat = sortedCatalog(catalog);
    const led = isPlainObject(ledger) ? ledger : emptyLedger();
    const ackedU = new Set(Array.isArray(led.u) ? led.u : []);
    const ackedR = new Set(Array.isArray(led.r) ? led.r : []);
    const ackedS = isPlainObject(led.s) ? led.s : {};
    const skipSet = skip instanceof Set ? skip : new Set(Array.isArray(skip) ? skip : []);
    const unlocked = isPlainObject(record.unlocked) ? record.unlocked : {};
    const revealed = new Set(Array.isArray(record.revealed) ? record.revealed : []);

    const reveals = [];
    const steps = [];
    const unlocks = [];
    for (const entry of cat) {
      const id = entry.id;
      if (typeof id !== "string" || skipSet.has(id)) continue;
      const isUnlocked = hasOwn(unlocked, id);
      const op = playOpFor(entry);
      if (op === null) continue;

      if (entry.initialState === "Hidden" && revealed.has(id) && !isUnlocked && !ackedR.has(id)) {
        reveals.push(Object.freeze({ id, kind: "reveal", resource: achievementResourceName(entry) }));
      }

      if (op === "unlock") {
        if (isUnlocked && !ackedU.has(id)) {
          unlocks.push(Object.freeze({ id, kind: "unlock", resource: achievementResourceName(entry) }));
        }
        continue;
      }

      const total = stepsOf(entry);
      if (total < 1) continue;
      let value;
      if (isUnlocked) {
        value = total;
      } else {
        const p = progressFor(record, entry);
        value = p && Number.isFinite(p.value) ? Math.trunc(p.value) : 0;
      }
      const n = Math.min(value, total);
      const acked = hasOwn(ackedS, id) && Number.isFinite(ackedS[id]) ? ackedS[id] : 0;
      if (n >= 1 && n > acked) {
        steps.push(Object.freeze({ id, kind: "steps", resource: achievementResourceName(entry), n }));
      }
    }
    return Object.freeze([...reveals, ...steps, ...unlocks]);
  } catch {
    return Object.freeze([]);
  }
}

const OFF = Object.freeze({ ok: false, reason: "off" });

/**
 * createAchievementMirror({ storage, playIdentity, competeOn, online,
 * getRecord, catalog, now, setTimer, clearTimer, log }) — returns a frozen
 * { kick, wake, flush, cancel, showAchievements, snapshot, waitForPending }.
 * Every function is total. See the file header for the contract.
 */
export function createAchievementMirror(opts) {
  const o = isPlainObject(opts) ? opts : {};
  const { storage, playIdentity, competeOn, online, getRecord } = o;
  const catalog = sortedCatalog(o.catalog);
  const now = typeof o.now === "function" ? o.now : Date.now;
  const setTimer = typeof o.setTimer === "function" ? o.setTimer : (fn, ms) => setTimeout(fn, ms);
  const clearTimer = typeof o.clearTimer === "function" ? o.clearTimer : (h) => clearTimeout(h);
  const log = typeof o.log === "function" ? o.log : () => {};

  let ledger = emptyLedger();
  let loadPromise = null;
  let loaded = false;
  let lastSaved = null;
  let flushPromise = null;
  let trailing = null;
  let lastIdentity = null;
  let noResources = false;
  let unlockTimer = null;
  let progressTimer = null;
  const skipped = new Set();
  const pendingWrites = new Set();

  function logLine(line) {
    try {
      log(line);
    } catch {
      // a broken logger never breaks the mirror
    }
  }

  function gateOn() {
    try {
      return typeof competeOn === "function" && competeOn() === true;
    } catch {
      return false;
    }
  }

  function onlineOk() {
    try {
      return typeof online === "function" ? online() === true : true;
    } catch {
      return false;
    }
  }

  function nowMs() {
    try {
      const t = now();
      return Number.isFinite(t) ? t : Date.now();
    } catch {
      return Date.now();
    }
  }

  function recordNow() {
    try {
      const r = typeof getRecord === "function" ? getRecord() : null;
      return isPlainObject(r) ? r : null;
    } catch {
      return null;
    }
  }

  function trackedWrite(run) {
    const p = (async () => {
      try {
        await run();
      } catch {
        // best-effort: the in-memory ledger already reflects this session
      }
    })();
    pendingWrites.add(p);
    p.finally(() => pendingWrites.delete(p));
    return p;
  }

  function load() {
    if (loadPromise === null) {
      loadPromise = (async () => {
        try {
          const raw = await storage.getItem(PGS_ACH_KEY);
          if (typeof raw !== "string") {
            ledger = emptyLedger();
            lastSaved = null;
          } else {
            let parsed = null;
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = null;
            }
            ledger = sanitizeLedger(parsed, catalog);
            lastSaved = raw;
          }
        } catch {
          ledger = emptyLedger();
          lastSaved = null;
        }
        loaded = true;
        return ledger;
      })();
    }
    return loadPromise;
  }

  async function persist() {
    let json;
    try {
      json = JSON.stringify(ledger);
    } catch {
      return;
    }
    if (json === lastSaved) return;
    await trackedWrite(async () => {
      await storage.setItem(PGS_ACH_KEY, json);
      lastSaved = json;
    });
  }

  function cancel() {
    try {
      if (unlockTimer !== null) clearTimer(unlockTimer);
    } catch {
      // ignore
    }
    try {
      if (progressTimer !== null) clearTimer(progressTimer);
    } catch {
      // ignore
    }
    unlockTimer = null;
    progressTimer = null;
  }

  // seam(method, arg) — the one place the mirror reaches the Play seam. Gate 1
  // is checked here as well, so no path can call the seam with Compete OFF.
  async function seam(method, arg) {
    if (!gateOn()) return OFF;
    try {
      if (!playIdentity || typeof playIdentity[method] !== "function") return { ok: false, reason: "error" };
      return await playIdentity[method](arg);
    } catch {
      return { ok: false, reason: "error" };
    }
  }

  function fail(reason, sent) {
    logLine(`[playAch] flush ${reason}`);
    return typeof sent === "number" ? { ok: false, reason, sent } : { ok: false, reason };
  }

  function advanceBackoff() {
    ledger.failures = (Number.isInteger(ledger.failures) ? ledger.failures : 0) + 1;
    ledger.retryAt = nowMs() + backoffMs(ledger.failures);
  }

  function normalizeStatus(a) {
    if (!isPlainObject(a)) return { kind: "error" };
    if (a.ok === true) {
      if (a.signedIn === false) return { kind: "signin" };
      if (a.signedIn === true && typeof a.playerId === "string" && a.playerId.length > 0 && a.playerId.length <= PLAYER_MAX) {
        return { kind: "in", playerId: a.playerId };
      }
      return { kind: "error" };
    }
    if (a.ok === false) {
      if (a.reason === "signin") return { kind: "signin" };
      if (a.reason === "network") return { kind: "network" };
    }
    return { kind: "error" };
  }

  function ack(op) {
    if (op.kind === "unlock") {
      if (!ledger.u.includes(op.id)) ledger.u.push(op.id);
    } else if (op.kind === "reveal") {
      if (!ledger.r.includes(op.id)) ledger.r.push(op.id);
    } else if (op.kind === "steps") {
      const old = hasOwn(ledger.s, op.id) ? ledger.s[op.id] : 0;
      ledger.s[op.id] = Math.max(old, op.n);
    }
  }

  // applyAnswer(batch, ans) — folds one syncAchievements answer into the
  // ledger. Returns { acked, skippedNow, stop, allConfig } where stop is null,
  // "signin", "network" or "error".
  function applyAnswer(batch, ans) {
    const out = { acked: 0, skippedNow: 0, stop: null, allConfig: false };
    if (!isPlainObject(ans)) {
      out.stop = "error";
      advanceBackoff();
      return out;
    }
    if (ans.ok !== true) {
      if (ans.reason === "signin") {
        out.stop = "signin";
        return out;
      }
      out.stop = ans.reason === "network" ? "network" : "error";
      advanceBackoff();
      return out;
    }
    if (!Array.isArray(ans.results)) {
      out.stop = "error";
      advanceBackoff();
      return out;
    }

    const byIndex = new Map();
    for (const r of ans.results) {
      if (!isPlainObject(r) || !Number.isInteger(r.i) || r.i < 0 || r.i >= batch.length || byIndex.has(r.i)) continue;
      byIndex.set(r.i, r);
    }
    const order = [...byIndex.keys()].sort((a, b) => a - b);
    let configCount = 0;
    for (const i of order) {
      const r = byIndex.get(i);
      const op = batch[i];
      if (r.ok === true) {
        ack(op);
        out.acked += 1;
        continue;
      }
      const reason = typeof r.reason === "string" ? r.reason : "error";
      if (reason === "network" || reason === "unavailable") {
        out.stop = reason === "network" ? "network" : "error";
        break;
      }
      if (reason === "signin") {
        out.stop = "signin";
        break;
      }
      skipped.add(op.id);
      out.skippedNow += 1;
      if (reason === "config") configCount += 1;
    }
    if (out.acked > 0) {
      ledger.failures = 0;
      ledger.retryAt = 0;
    }
    if (order.length > 0 && configCount === order.length) out.allConfig = true;
    if (out.stop === "network" || out.stop === "error") advanceBackoff();
    return out;
  }

  function wireOp(op) {
    return op.kind === "steps" ? { kind: op.kind, resource: op.resource, n: op.n } : { kind: op.kind, resource: op.resource };
  }

  async function runOnce(fopts, reuse) {
    const force = fopts.force === true;
    const checkPlayer = fopts.checkPlayer === true;
    lastIdentity = reuse || null;

    if (!gateOn()) return fail("off");
    if (recordNow() === null) return fail("notready");
    if (!onlineOk()) return fail("offline");
    await load();
    if (!gateOn()) return fail("off");
    if (!force && ledger.retryAt > 0 && nowMs() < ledger.retryAt) return fail("backoff");

    const okResult = (sent) => ({ ok: true, sent, skipped: skipped.size, remaining: pendingOps(recordNow(), ledger, catalog, skipped).length });
    if (noResources) return okResult(0);

    let record = recordNow();
    if (record === null) return fail("notready");
    let pending = pendingOps(record, ledger, catalog, skipped);
    if (pending.length === 0) {
      const mirrorable = pendingOps(record, emptyLedger(), catalog, skipped).length > 0;
      if (!(checkPlayer && !reuse && mirrorable)) return okResult(0);
    }

    // The identity check, once per run, just before the first batch.
    if (!reuse) {
      const raw = await seam("status");
      if (raw === OFF) return fail("off");
      const st = normalizeStatus(raw);
      if (st.kind === "signin") return fail("signin");
      if (st.kind !== "in") {
        advanceBackoff();
        await persist();
        return fail(st.kind === "network" ? "network" : "error");
      }
      lastIdentity = { playerId: st.playerId };
      if (st.playerId !== ledger.player) {
        ledger.u = [];
        ledger.r = [];
        ledger.s = {};
        ledger.player = st.playerId;
        await persist();
      }
    }

    const maxBatches = Math.ceil(catalog.length / BATCH_MAX) + 2;
    let sent = 0;
    for (let b = 0; b < maxBatches; b++) {
      if (!gateOn()) return fail("off", sent);
      if (!onlineOk()) return fail("offline", sent);
      record = recordNow();
      if (record === null) return fail("notready", sent);
      pending = pendingOps(record, ledger, catalog, skipped);
      if (pending.length === 0) break;
      const batch = pending.slice(0, BATCH_MAX);

      const ans = await seam("syncAchievements", { ops: batch.map(wireOp) });
      if (ans === OFF) return fail("off", sent);
      const out = applyAnswer(batch, ans);
      sent += out.acked;
      if (out.allConfig && out.acked === 0) {
        noResources = true;
        for (const op of pending) skipped.add(op.id);
        await persist();
        logLine("[playAch] flush config: resources absent, no-op for this session");
        break;
      }
      if (out.stop === null && out.acked === 0 && out.skippedNow === 0) {
        out.stop = "error";
        advanceBackoff();
      }
      await persist();
      if (out.stop !== null) return fail(out.stop, sent);
    }

    const result = okResult(sent);
    logLine(`[playAch] flush ok sent=${sent} remaining=${result.remaining}`);
    return result;
  }

  async function runChain(first) {
    let res;
    let reuse = null;
    let fopts = first;
    for (let pass = 0; pass < 8; pass++) {
      try {
        res = await runOnce(fopts, reuse);
      } catch {
        res = fail("error");
      }
      reuse = lastIdentity;
      if (trailing === null) break;
      fopts = trailing;
      trailing = null;
      // The identity was just asked in this chain: do not ask it again.
      if (reuse) fopts = { ...fopts, checkPlayer: false };
    }
    trailing = null;
    return res;
  }

  function normalizeOpts(opts2) {
    const src = isPlainObject(opts2) ? opts2 : {};
    return { force: src.force === true, checkPlayer: src.checkPlayer === true };
  }

  function flush(opts2) {
    try {
      const fo = normalizeOpts(opts2);
      if (!gateOn()) {
        cancel();
        return Promise.resolve({ ok: false, reason: "off" });
      }
      if (flushPromise) {
        trailing = trailing
          ? { force: trailing.force || fo.force, checkPlayer: trailing.checkPlayer || fo.checkPlayer }
          : fo;
        return flushPromise;
      }
      flushPromise = runChain(fo)
        .catch(() => ({ ok: false, reason: "error" }))
        .finally(() => {
          flushPromise = null;
        });
      return flushPromise;
    } catch {
      return Promise.resolve({ ok: false, reason: "error" });
    }
  }

  function wake(opts2) {
    try {
      if (!gateOn()) {
        cancel();
        return Promise.resolve({ ok: false, reason: "off" });
      }
      return flush(opts2);
    } catch {
      return Promise.resolve({ ok: false, reason: "error" });
    }
  }

  function fireTimer(which) {
    if (which === "unlock") unlockTimer = null;
    else progressTimer = null;
    try {
      flush({}).catch(() => {});
    } catch {
      // ignore
    }
  }

  function schedule(which, ms) {
    try {
      const h = setTimer(() => fireTimer(which), ms);
      if (which === "unlock") unlockTimer = h === null || h === undefined ? 0 : h;
      else progressTimer = h === null || h === undefined ? 0 : h;
    } catch {
      // a broken scheduler never breaks the bus
    }
  }

  function countOf(v) {
    return Array.isArray(v) ? v.length : 0;
  }

  function kick(payload) {
    try {
      if (!gateOn()) {
        cancel();
        return undefined;
      }
      if (!isPlainObject(payload)) return undefined;
      if (countOf(payload.unlocks) > 0 || countOf(payload.reveals) > 0) {
        if (unlockTimer === null) schedule("unlock", UNLOCK_DELAY_MS);
      } else if (countOf(payload.progress) > 0) {
        if (progressTimer === null) schedule("progress", PROGRESS_DELAY_MS);
      }
    } catch {
      // never throws into the bus
    }
    return undefined;
  }

  async function showAchievements() {
    try {
      if (!gateOn()) return { ok: false, reason: "off" };
      const a = await seam("showAchievements");
      if (a === OFF) return { ok: false, reason: "off" };
      if (isPlainObject(a) && a.ok === true) return { ok: true };
      if (isPlainObject(a) && a.ok === false && ACHIEVEMENT_REASONS.includes(a.reason)) return { ok: false, reason: a.reason };
      return { ok: false, reason: "error" };
    } catch {
      return { ok: false, reason: "error" };
    }
  }

  async function snapshot() {
    try {
      if (!loaded && gateOn()) await load();
    } catch {
      // ignore
    }
    return Object.freeze({
      player: ledger.player,
      u: Object.freeze([...ledger.u]),
      r: Object.freeze([...ledger.r]),
      s: Object.freeze({ ...ledger.s }),
      failures: ledger.failures,
      retryAt: ledger.retryAt,
      skipped: Object.freeze([...skipped].sort()),
    });
  }

  async function waitForPending() {
    try {
      let batch = [...pendingWrites];
      while (batch.length > 0) {
        await Promise.allSettled(batch);
        batch = [...pendingWrites];
      }
    } catch {
      // ignore
    }
  }

  return Object.freeze({ kick, wake, flush, cancel, showAchievements, snapshot, waitForPending });
}
