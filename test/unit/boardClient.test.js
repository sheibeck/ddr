// test/unit/boardClient.test.js
//
// Phase 83 Plan 04 Task 2. Covers createBoardClient against
// createFakeBoardFetch (Task 1) with an injected clock, plus a small stub
// fetchFn for the 503/400/timeout cases: ordering for all four stats, the
// four filter shapes, season exclusion, total, rankOf, request bodies, no
// Authorization header, cache hit/expiry/single-flight, stale fallback,
// off/invalid zero-call gates and error mapping.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { rollHandle } from "../../src/browser/handles.js";
import { SEASON } from "../../content/season.js";
import { firestoreUrl, docName } from "../../src/browser/firestoreRest.js";
import { RUN_COLLECTION, RUN_CLIENT_FIELDS, rankKeys, runDocId, topTenQuery, countQuery } from "../../src/browser/runDoc.js";
import { createFakeBoardFetch } from "../../src/browser/fakeBoardServer.js";
import {
  BOARD_CACHE_TTL_MS,
  BOARD_REASONS,
  decodeRunDocument,
  createBoardClient,
} from "../../src/browser/boardClient.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BOARD_CLIENT_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "boardClient.js"), "utf8").replace(/\r\n/g, "\n");

const VALID_CONFIG = Object.freeze({ projectId: "delve-die-repeat-6ba5f", apiKey: `AIza${"A".repeat(35)}` });

/* ---------------- helpers ---------------- */

function validHandle(seed = 0.15) {
  return rollHandle(() => seed, null);
}

function baseValidPartial(overrides = {}) {
  return {
    uid: "u1",
    handle: validHandle(),
    season: SEASON,
    name: "Test Hero",
    race: "Human",
    sub: "Knight",
    cls: "Fighter",
    level: 1,
    floor: 5,
    day: 3,
    steps: 500,
    kills: 10,
    gold: 100,
    sp: 40,
    cause: "combat",
    note: "cut down by a Rat",
    epitaph: "",
    when: 0,
    hash: "0a1b2c3d",
    version: "2.2.0 (12)",
    seed: 12345,
    acts: 10,
    ...overrides,
  };
}

function docFrom(overrides = {}) {
  const merged = baseValidPartial(overrides);
  const keys = rankKeys(merged);
  const doc = {};
  for (const f of RUN_CLIENT_FIELDS) doc[f] = f in keys ? keys[f] : merged[f];
  return doc;
}

function seedOf(overrides = {}) {
  const doc = docFrom(overrides);
  return { id: runDocId(doc.uid, doc.hash), doc };
}

function spy(fetchFn) {
  const calls = [];
  const fn = async (u, init) => {
    calls.push({ url: u, init });
    return fetchFn(u, init);
  };
  fn.calls = calls;
  return fn;
}

function makeSeeds() {
  // A spread of races/classes/subs and stat values, plus two season-2 docs
  // (must never appear in any topTen/total/rankOf result).
  const out = [];
  let h = 1;
  const nextHash = () => (h++).toString(16).padStart(8, "0");
  const combos = [
    { race: "Human", cls: "Fighter", sub: "Knight" },
    { race: "Elven", cls: "Magic User", sub: "Wizard" },
    { race: "Dwarven", cls: "Thief", sub: "Pickpocket" },
    { race: "Wilmsry", cls: "Fighter", sub: "Guard" },
    { race: "Fridgian", cls: "Magic User", sub: "Cleric" },
    { race: "Troll", cls: "Thief", sub: "Ninja" },
  ];
  for (let i = 0; i < combos.length; i++) {
    const c = combos[i];
    out.push(
      seedOf({
        uid: `u${i}`,
        hash: nextHash(),
        race: c.race,
        cls: c.cls,
        sub: c.sub,
        floor: 5 + i,
        steps: 100 + i,
        day: 2 + i,
        kills: 3 + i,
        gold: 50 + i * 10,
      }),
    );
  }
  // two season-2 docs — must be excluded from every read
  out.push(seedOf({ uid: "season2a", hash: nextHash(), season: 2, floor: 200, steps: 0, day: 1, kills: 999, gold: 9999999 }));
  out.push(seedOf({ uid: "season2b", hash: nextHash(), season: 2, floor: 199 }));
  return out;
}

function makeClient({ runs = makeSeeds(), competeOn = () => true, ttlMs, extra = {} } = {}) {
  let clockMs = 0;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs, now: () => clockMs });
  const fetchFn = spy(server.fetchFn);
  const opts = { fetchFn, config: VALID_CONFIG, competeOn, now: () => clockMs, season: SEASON, ...extra };
  if (ttlMs !== undefined) opts.ttlMs = ttlMs;
  const client = createBoardClient(opts);
  return { client, server, fetchFn, setClock: (ms) => (clockMs = ms) };
}

/* ================================================================
   constants, decodeRunDocument
   ================================================================ */

test("constants: BOARD_CACHE_TTL_MS, BOARD_REASONS", () => {
  assert.equal(BOARD_CACHE_TTL_MS, 300000);
  assert.deepEqual([...BOARD_REASONS], ["off", "offline", "server", "refused", "invalid", "unavailable"]);
});

test("decodeRunDocument: fromFirestoreFields plus id, frozen", () => {
  const doc = docFrom({ uid: "d1", hash: "00000001" });
  const id = runDocId("d1", "00000001");
  const name = docName(VALID_CONFIG, RUN_COLLECTION, id);
  const fields = {
    uid: { stringValue: "d1" },
    floor: { integerValue: "5" },
    createdAt: { timestampValue: "2026-01-01T00:00:00.000Z" },
  };
  const row = decodeRunDocument({ name, fields });
  assert.equal(row.id, id);
  assert.equal(row.uid, "d1");
  assert.equal(row.floor, 5);
  assert.equal(row.createdAt, "2026-01-01T00:00:00.000Z");
  assert.ok(Object.isFrozen(row));
});

/* ================================================================
   topTen: ordering, filters, season exclusion, row shape
   ================================================================ */

for (const stat of ["deep", "days", "kills", "purse"]) {
  test(`topTen(${stat}): at most 10 rows in descending rank-key order, excludes season-2 docs`, async () => {
    const { client } = makeClient();
    const res = await client.topTen(stat);
    assert.equal(res.ok, true);
    assert.ok(res.rows.length <= 10);
    assert.ok(res.rows.every((r) => r.season === SEASON));
    const field = { deep: "deepKey", days: "daysKey", kills: "killsKey", purse: "goldKey" }[stat];
    for (let i = 1; i < res.rows.length; i++) {
      assert.ok(res.rows[i - 1][field] >= res.rows[i][field], `${stat} not descending at ${i}`);
    }
  });
}

test("topTen: race/sub filter shapes return only matching rows", async () => {
  const { client } = makeClient();
  const all = await client.topTen("deep");
  assert.equal(all.rows.length, 6);

  const byRace = await client.topTen("deep", "Human");
  assert.ok(byRace.rows.every((r) => r.race === "Human"));
  assert.equal(byRace.rows.length, 1);

  const bySub = await client.topTen("deep", null, "Knight");
  assert.ok(bySub.rows.every((r) => r.sub === "Knight"));
  assert.equal(bySub.rows.length, 1);

  const byBoth = await client.topTen("deep", "Human", "Knight");
  assert.equal(byBoth.rows.length, 1);
  assert.equal(byBoth.rows[0].race, "Human");
  assert.equal(byBoth.rows[0].sub, "Knight");
});

test("topTen: each row is frozen with every run field decoded plus id", async () => {
  const { client } = makeClient();
  const res = await client.topTen("deep");
  const row = res.rows[0];
  assert.ok(Object.isFrozen(row));
  assert.equal(typeof row.floor, "number");
  assert.equal(typeof row.gold, "number");
  assert.equal(typeof row.createdAt, "string");
  assert.equal(typeof row.id, "string");
});

test("topTen: a seeded older-shape doc (no note, no when) decodes without throwing — note/when come back undefined, createdAt an ISO string", async () => {
  const merged = baseValidPartial({ uid: "olderu1", hash: "0000000a" });
  const { note, when, ...oldShape } = merged;
  const keys = rankKeys(oldShape);
  const doc = { ...oldShape, ...keys };
  const id = runDocId(doc.uid, doc.hash);
  const { client } = makeClient({ runs: [{ id, doc }] });

  const res = await client.topTen("deep", doc.race, doc.sub);
  assert.equal(res.ok, true);
  const row = res.rows.find((r) => r.id === id);
  assert.ok(row, "the older-shape doc must appear in topTen");
  assert.equal(row.note, undefined);
  assert.equal(row.when, undefined);
  assert.equal(typeof row.createdAt, "string");
  assert.doesNotThrow(() => decodeRunDocument({ name: `runs/${id}`, fields: {} }));
});

/* ================================================================
   total, rankOf
   ================================================================ */

test("total(stat, race, sub): {ok:true, count} equal to the matching seeded count", async () => {
  const { client } = makeClient();
  const all = await client.total("deep");
  assert.equal(all.ok, true);
  assert.equal(all.count, 6);
  const filtered = await client.total("deep", "Elven");
  assert.equal(filtered.count, 1);
});

test("rankOf(stat, key, race, sub): rank = ahead + 1, ahead = count of matching rows with a strictly greater key", async () => {
  const { client } = makeClient();
  const top = await client.topTen("deep");
  const sorted = [...top.rows].sort((a, b) => b.deepKey - a.deepKey);
  const midKey = sorted[2].deepKey;
  const res = await client.rankOf("deep", midKey);
  assert.equal(res.ok, true);
  const expectedAhead = sorted.filter((r) => r.deepKey > midKey).length;
  assert.equal(res.ahead, expectedAhead);
  assert.equal(res.rank, expectedAhead + 1);
});

/* ================================================================
   request bodies, no Authorization header, API key
   ================================================================ */

test("request bodies equal topTenQuery/countQuery; no Authorization header; API key on every URL", async () => {
  const { client, fetchFn } = makeClient();
  await client.topTen("deep", "Human", "Knight");
  await client.total("kills", "Elven");
  await client.rankOf("purse", 500, null, "Wizard");

  assert.equal(fetchFn.calls.length, 3);
  for (const call of fetchFn.calls) {
    assert.ok(call.url.includes(`key=${encodeURIComponent(VALID_CONFIG.apiKey)}`));
    const headerKeys = Object.keys(call.init.headers || {}).map((k) => k.toLowerCase());
    assert.ok(!headerKeys.includes("authorization"));
  }

  const topTenBody = JSON.parse(fetchFn.calls[0].init.body);
  assert.deepEqual(topTenBody, topTenQuery({ stat: "deep", season: SEASON, race: "Human", sub: "Knight" }));

  const totalBody = JSON.parse(fetchFn.calls[1].init.body);
  assert.deepEqual(totalBody, countQuery({ stat: "kills", season: SEASON, race: "Elven" }));

  const rankBody = JSON.parse(fetchFn.calls[2].init.body);
  assert.deepEqual(rankBody, countQuery({ stat: "purse", season: SEASON, sub: "Wizard", above: 500 }));
});

/* ================================================================
   cache: hit, expiry, single-flight
   ================================================================ */

test("cache: a second identical read within 5 minutes makes no new request; after 300000ms it refetches", async () => {
  const { client, fetchFn, setClock } = makeClient();
  await client.topTen("deep");
  assert.equal(fetchFn.calls.length, 1);
  await client.topTen("deep");
  assert.equal(fetchFn.calls.length, 1);

  setClock(299999);
  await client.topTen("deep");
  assert.equal(fetchFn.calls.length, 1);

  setClock(300000);
  await client.topTen("deep");
  assert.equal(fetchFn.calls.length, 2);
});

test("cache: two identical reads started together make one request", async () => {
  const { client, fetchFn } = makeClient();
  const [a, b] = await Promise.all([client.topTen("kills"), client.topTen("kills")]);
  assert.equal(fetchFn.calls.length, 1);
  assert.deepEqual(a, b);
});

test("clear(): empties the cache so the next read refetches", async () => {
  const { client, fetchFn } = makeClient();
  await client.total("deep");
  assert.equal(fetchFn.calls.length, 1);
  await client.total("deep");
  assert.equal(fetchFn.calls.length, 1);
  client.clear();
  await client.total("deep");
  assert.equal(fetchFn.calls.length, 2);
});

/* ================================================================
   stale fallback and error mapping (stub fetchFn)
   ================================================================ */

function jsonRes(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

test("stale fallback: a refresh failure with a cached copy returns the cached copy flagged stale:true", async () => {
  let clockMs = 0;
  let call = 0;
  const responses = [
    jsonRes(200, [{ result: { aggregateFields: { count: { integerValue: "3" } } }, readTime: "t" }]),
    () => {
      throw new Error("network down");
    },
  ];
  const fetchFn = async () => {
    const r = responses[Math.min(call, responses.length - 1)];
    call++;
    if (typeof r === "function") return r();
    return r;
  };
  const client = createBoardClient({ fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => clockMs, season: SEASON });

  const first = await client.total("deep");
  assert.equal(first.ok, true);
  assert.equal(first.count, 3);
  assert.equal(first.stale, false);

  clockMs = 300000; // force expiry so the second call refetches
  const second = await client.total("deep");
  assert.equal(second.ok, true);
  assert.equal(second.count, 3);
  assert.equal(second.stale, true);
});

test("no cached copy: offline -> {ok:false, reason:'offline'}; 503 -> 'server'; 400 -> 'refused' with status", async () => {
  const offlineFetch = async () => {
    throw new Error("boom");
  };
  const offlineClient = createBoardClient({ fetchFn: offlineFetch, config: VALID_CONFIG, competeOn: () => true, now: () => 0, season: SEASON });
  const offlineRes = await offlineClient.total("deep");
  assert.deepEqual(offlineRes, { ok: false, reason: "offline" });

  const serverFetch = async () => jsonRes(503, { error: { code: 503, message: "UNAVAILABLE", status: "UNAVAILABLE" } });
  const serverClient = createBoardClient({ fetchFn: serverFetch, config: VALID_CONFIG, competeOn: () => true, now: () => 0, season: SEASON });
  const serverRes = await serverClient.total("deep");
  assert.deepEqual(serverRes, { ok: false, reason: "server" });

  const refusedFetch = async () => jsonRes(400, { error: { code: 400, message: "FAILED_PRECONDITION", status: "FAILED_PRECONDITION" } });
  const refusedClient = createBoardClient({ fetchFn: refusedFetch, config: VALID_CONFIG, competeOn: () => true, now: () => 0, season: SEASON });
  const refusedRes = await refusedClient.total("deep");
  assert.deepEqual(refusedRes, { ok: false, reason: "refused", status: "FAILED_PRECONDITION" });
});

test("timeout: a timer that fires first resolves offline (no cached copy)", async () => {
  let firedTimeout;
  let aborted = false;
  class FakeAbortController {
    constructor() {
      this.signal = {};
    }
    abort() {
      aborted = true;
    }
  }
  const hangingFetch = () => new Promise(() => {});
  const client = createBoardClient({
    fetchFn: hangingFetch,
    config: VALID_CONFIG,
    competeOn: () => true,
    now: () => 0,
    season: SEASON,
    setTimer: (fn) => {
      firedTimeout = fn;
      return "timer-1";
    },
    clearTimer: () => {},
    AbortCtl: FakeAbortController,
  });
  const resultPromise = client.total("deep");
  firedTimeout();
  const result = await resultPromise;
  assert.deepEqual(result, { ok: false, reason: "offline" });
  assert.equal(aborted, true);
});

/* ================================================================
   off / invalid gates — zero network calls
   ================================================================ */

test("competeOn not returning true resolves {ok:false, reason:'off'} with zero calls", async () => {
  for (const competeOn of [undefined, () => false, () => "yes", () => 0]) {
    const server = createFakeBoardFetch({ config: VALID_CONFIG, runs: makeSeeds(), now: () => 0 });
    const fetchFn = spy(server.fetchFn);
    const client = createBoardClient({ fetchFn, config: VALID_CONFIG, competeOn, now: () => 0, season: SEASON });
    const res = await client.topTen("deep");
    assert.deepEqual(res, { ok: false, reason: "off" });
    assert.equal(fetchFn.calls.length, 0);
  }
});

test("invalid arguments resolve {ok:false, reason:'invalid'} with zero calls", async () => {
  const { client, fetchFn } = makeClient();
  assert.deepEqual(await client.topTen("not-a-stat"), { ok: false, reason: "invalid" });
  assert.deepEqual(await client.topTen("deep", "Not-A-Race"), { ok: false, reason: "invalid" });
  assert.deepEqual(await client.topTen("deep", null, "Not-A-Sub"), { ok: false, reason: "invalid" });
  assert.deepEqual(await client.rankOf("deep", -1), { ok: false, reason: "invalid" });
  assert.deepEqual(await client.rankOf("deep", 1.5), { ok: false, reason: "invalid" });
  assert.deepEqual(await client.rankOf("deep", "5"), { ok: false, reason: "invalid" });
  assert.equal(fetchFn.calls.length, 0);
});

test("unavailable: a bad config or missing fetchFn resolves 'unavailable' with zero calls", async () => {
  const client1 = createBoardClient({ fetchFn: undefined, config: VALID_CONFIG, competeOn: () => true, now: () => 0, season: SEASON });
  assert.deepEqual(await client1.topTen("deep"), { ok: false, reason: "unavailable" });

  const client2 = createBoardClient({ fetchFn: async () => jsonRes(200, []), config: { projectId: "x", apiKey: "bad" }, competeOn: () => true, now: () => 0, season: SEASON });
  assert.deepEqual(await client2.topTen("deep"), { ok: false, reason: "unavailable" });
});

/* ================================================================
   purity
   ================================================================ */

test("purity: boardClient.js never touches DOM globals and never calls the bare global fetch", () => {
  const code = stripJs(BOARD_CLIENT_SRC);
  for (const banned of [/\bwindow\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  // "document" appears only as a property read off a runQuery hit
  // (`h.document`, mirroring the real REST shape) — never as the bare DOM
  // global (`document.<member>`, with no preceding `.`).
  assert.doesNotMatch(code, /(?<!\.)\bdocument\b(?!\s*:)/, "must not use the DOM global `document`");
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
});

test("purity: exports createBoardClient", () => {
  assert.equal((BOARD_CLIENT_SRC.match(/export function createBoardClient/g) || []).length, 1);
});
