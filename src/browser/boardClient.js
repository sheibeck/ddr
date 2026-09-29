// src/browser/boardClient.js
//
// Phase 83 (SRV-03), Plan 04 Task 2. The board read client — CONTEXT "Queue,
// backfill & live setup": topTen(stat, race, sub), total(stat, race, sub)
// and rankOf(stat, key, race, sub) for stat in deep/days/kills/purse, over
// REST runQuery/runAggregationQuery count, always within the current
// content/season.js SEASON. Reads are public — no Authorization header, no
// identity needed — but still gated on Compete being ON (CONTEXT "network
// while Compete is OFF" is an SRV-09/T-83-17 concern shared by every Phase
// 83 network module, boards included). rank = count(rankKey > key) + 1
// (rankOf's `ahead`, via countQuery's `above` filter).
//
// Every (op, stat, race, sub[, key]) answer is cached for 5 minutes
// (BOARD_CACHE_TTL_MS); when a refresh fails and a cached copy exists, the
// cached copy is returned flagged `stale: true`; concurrent identical reads
// share one in-flight request. Phase 84's panel and Phase 85's "you placed
// X" both consume this client unchanged.
//
// Pure, DOM-free, never throws: no window/document/navigator/localStorage,
// no bare global fetch — the network is reached only through the injected
// fetchFn (the shell passes the live fetch on Android; the browser dev loop
// passes src/browser/fakeBoardServer.js's fetchFn).

import { RACES } from "../../content/races.js";
import { CLASSES } from "../../content/classes.js";
import { SEASON } from "../../content/season.js";
import { FIREBASE_CONFIG, firebaseConfigured } from "./firebaseConfig.js";
import { firestoreUrl, timedFetch, readJson, restError, fromFirestoreFields } from "./firestoreRest.js";
import { isBoardStat, topTenQuery, countQuery } from "./runDoc.js";

export const BOARD_CACHE_TTL_MS = 300000;
export const BOARD_REASONS = Object.freeze(["off", "offline", "server", "refused", "invalid", "unavailable"]);

// Module-private content lists (never exported — a copy-like array export
// is flagged by the voice-corpus completeness audit).
const RACE_LIST = Object.keys(RACES);
const SUB_UNIVERSE = new Set(Object.values(CLASSES).flatMap((c) => c.subs));

function isValidRaceArg(race) {
  return race === null || race === undefined || RACE_LIST.includes(race);
}

function isValidSubArg(sub) {
  return sub === null || sub === undefined || SUB_UNIVERSE.has(sub);
}

function isValidKeyArg(key) {
  return Number.isSafeInteger(key) && key >= 0;
}

/**
 * decodeRunDocument(doc) — a frozen plain object decoded from a runQuery
 * hit's `.document` ({name, fields, createTime, updateTime}):
 * fromFirestoreFields(doc.fields) plus `id` (the name's last `/` segment).
 * Never throws.
 */
export function decodeRunDocument(doc) {
  const fields = fromFirestoreFields(doc && typeof doc === "object" ? doc.fields : undefined);
  const name = typeof doc?.name === "string" ? doc.name : "";
  const idx = name.lastIndexOf("/");
  const id = idx === -1 ? name : name.slice(idx + 1);
  return Object.freeze({ ...fields, id });
}

function cacheKey(op, stat, race, sub, key) {
  return `${op}|${stat}|${race ?? "*"}|${sub ?? "*"}|${key ?? ""}`;
}

function decodeCount(json) {
  const entry = Array.isArray(json) ? json[0] : null;
  const raw = entry?.result?.aggregateFields?.count?.integerValue;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * createBoardClient({ fetchFn, config = FIREBASE_CONFIG, competeOn,
 * now = Date.now, ttlMs = BOARD_CACHE_TTL_MS, season = SEASON, timeoutMs,
 * setTimer, clearTimer, AbortCtl }) — returns frozen { topTen, total,
 * rankOf, clear }. Never throws.
 */
export function createBoardClient(opts = {}) {
  const {
    fetchFn,
    config = FIREBASE_CONFIG,
    competeOn,
    now = Date.now,
    ttlMs = BOARD_CACHE_TTL_MS,
    season = SEASON,
    timeoutMs,
    setTimer,
    clearTimer,
    AbortCtl,
  } = opts;

  const cache = new Map(); // key -> { value, fetchedAt }
  const inflight = new Map(); // key -> Promise

  function timedOpts() {
    const o = {};
    if (timeoutMs !== undefined) o.timeoutMs = timeoutMs;
    if (setTimer !== undefined) o.setTimer = setTimer;
    if (clearTimer !== undefined) o.clearTimer = clearTimer;
    if (AbortCtl !== undefined) o.AbortCtl = AbortCtl;
    return o;
  }

  function competeGateOk() {
    return typeof competeOn === "function" && competeOn() === true;
  }

  function fresh(entry) {
    return !!entry && now() - entry.fetchedAt < ttlMs;
  }

  // checkGates — the fixed order every read applies before touching the
  // cache or the network: competeOn, config/fetchFn availability, argument
  // validation. Returns a failure result, or null when ok to proceed.
  function checkGates(stat, race, sub, key) {
    if (!competeGateOk()) return { ok: false, reason: "off" };
    if (!firebaseConfigured(config) || typeof fetchFn !== "function") return { ok: false, reason: "unavailable" };
    if (!isBoardStat(stat)) return { ok: false, reason: "invalid" };
    if (!isValidRaceArg(race)) return { ok: false, reason: "invalid" };
    if (!isValidSubArg(sub)) return { ok: false, reason: "invalid" };
    if (key !== undefined && !isValidKeyArg(key)) return { ok: false, reason: "invalid" };
    return null;
  }

  async function doPost(suffix, body) {
    const url = firestoreUrl(config, suffix);
    const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    const raced = await timedFetch(fetchFn, url, init, timedOpts());
    if (!raced.ok) return { ok: false, reason: "offline" };
    const res = raced.res;
    const json = await readJson(res);
    if (res.ok) return { ok: true, json };
    if (res.status === 429 || res.status >= 500) return { ok: false, reason: "server" };
    if (res.status >= 400) {
      const { status } = restError(json);
      return status ? { ok: false, reason: "refused", status } : { ok: false, reason: "refused" };
    }
    return { ok: false, reason: "server" };
  }

  // runRead(key, buildRequest) — the fresh-cache-hit / in-flight-join /
  // fetch-and-cache / stale-fallback pipeline shared by topTen/total/rankOf.
  // buildRequest resolves { ok: true, value } (value is the op's own
  // success shape, minus stale/fetchedAt) or { ok: false, reason, status? }.
  function runRead(key, buildRequest) {
    const entry = cache.get(key);
    if (fresh(entry)) return Promise.resolve({ ...entry.value, stale: false, fetchedAt: entry.fetchedAt });
    if (inflight.has(key)) return inflight.get(key);

    const promise = (async () => {
      const outcome = await buildRequest();
      if (outcome.ok) {
        const fetchedAt = now();
        cache.set(key, { value: outcome.value, fetchedAt });
        return { ...outcome.value, stale: false, fetchedAt };
      }
      const existing = cache.get(key);
      if (existing) return { ...existing.value, stale: true, fetchedAt: existing.fetchedAt };
      return outcome.status !== undefined ? { ok: false, reason: outcome.reason, status: outcome.status } : { ok: false, reason: outcome.reason };
    })();

    inflight.set(key, promise);
    promise.finally(() => {
      inflight.delete(key);
    });
    return promise;
  }

  async function topTen(stat, race = null, sub = null) {
    const gate = checkGates(stat, race, sub);
    if (gate) return gate;
    const key = cacheKey("topTen", stat, race, sub);
    return runRead(key, async () => {
      const body = topTenQuery({ stat, season, race, sub });
      const outcome = await doPost(":runQuery", body);
      if (!outcome.ok) return outcome;
      const hits = Array.isArray(outcome.json) ? outcome.json : [];
      const rows = Object.freeze(hits.filter((h) => h && h.document).map((h) => decodeRunDocument(h.document)));
      return { ok: true, value: { ok: true, rows } };
    });
  }

  async function total(stat, race = null, sub = null) {
    const gate = checkGates(stat, race, sub);
    if (gate) return gate;
    const key = cacheKey("total", stat, race, sub);
    return runRead(key, async () => {
      const body = countQuery({ stat, season, race, sub });
      const outcome = await doPost(":runAggregationQuery", body);
      if (!outcome.ok) return outcome;
      return { ok: true, value: { ok: true, count: decodeCount(outcome.json) } };
    });
  }

  async function rankOf(stat, key, race = null, sub = null) {
    const gate = checkGates(stat, race, sub, key);
    if (gate) return gate;
    const cKey = cacheKey("rankOf", stat, race, sub, key);
    return runRead(cKey, async () => {
      const body = countQuery({ stat, season, race, sub, above: key });
      const outcome = await doPost(":runAggregationQuery", body);
      if (!outcome.ok) return outcome;
      const ahead = decodeCount(outcome.json);
      return { ok: true, value: { ok: true, rank: ahead + 1, ahead } };
    });
  }

  function clear() {
    cache.clear();
  }

  return Object.freeze({ topTen, total, rankOf, clear });
}
