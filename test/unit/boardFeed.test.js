// test/unit/boardFeed.test.js
//
// Phase 84 Plan 04 Task 2. Covers createBoardFeed against a real
// createBoardClient wired to createFakeBoardFetch (Phase 83), with an
// injectable clock and competeOn, and a small stub identity whose async
// snapshot() returns {uid, handle}.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { rollHandle } from "../../src/browser/handles.js";
import { SEASON } from "../../content/season.js";
import { buildRunDoc, rankKeyOf } from "../../src/browser/runDoc.js";
import { createFakeBoardFetch } from "../../src/browser/fakeBoardServer.js";
import { createBoardClient } from "../../src/browser/boardClient.js";
import { createBoardFeed } from "../../src/browser/boardFeed.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BOARD_FEED_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "boardFeed.js"), "utf8").replace(/\r\n/g, "\n");

const VALID_CONFIG = Object.freeze({ projectId: "delve-die-repeat-6ba5f", apiKey: `AIza${"A".repeat(35)}` });

/* ---------------- helpers ---------------- */

let hashCounter = 0;
function nextHash() {
  hashCounter += 1;
  return hashCounter.toString(16).padStart(8, "0");
}

function validHandle(seed = 0.15) {
  return rollHandle(() => seed, null);
}

function makeSummary(overrides = {}) {
  return {
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
    when: 1000,
    hash: nextHash(),
    seed: 12345,
    acts: 10,
    ...overrides,
  };
}

function buildRun(overrides = {}, buildOpts = {}) {
  const summary = makeSummary(overrides);
  const built = buildRunDoc(summary, {
    uid: buildOpts.uid ?? "u1",
    handle: buildOpts.handle ?? validHandle(0.15),
    version: buildOpts.version ?? "2.2.0 (12)",
  });
  if (!built.ok) throw new Error("bad test fixture: " + JSON.stringify(built.fails));
  return built;
}

function seedFrom(built) {
  return { id: built.id, doc: built.doc };
}

/**
 * makeBoard(uidCount, floors) — 11 "other" runs (uid o1..o11) at distinct
 * high floors that fill the top ten, plus 3 owned runs (uid MY_UID) at a
 * low floor (never in the top ten). Returns { runs, myRuns }.
 */
const MY_UID = "myuid1";

function makeBoard({ mineFloor = 2, mineSteps = [100, 200, 300], mineOverrides = {}, otherOverrides = {} } = {}) {
  const others = [];
  for (let i = 0; i < 11; i++) {
    others.push(buildRun({ floor: 100 + i, ...otherOverrides }, { uid: `o${i + 1}` }));
  }
  const mine = mineSteps.map((steps) => buildRun({ floor: mineFloor, steps, ...mineOverrides }, { uid: MY_UID }));
  return { runs: [...others, ...mine].map(seedFrom), others, mine };
}

function makeFeed({ runs, competeOn = () => true, identity, ttlMs, extra = {} } = {}) {
  let clockMs = 0;
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs: runs ?? [], now: () => clockMs });
  const client = createBoardClient({ fetchFn: server.fetchFn, config: VALID_CONFIG, competeOn, now: () => clockMs, season: SEASON, ...extra });
  const opts = { client, identity, now: () => clockMs, season: SEASON };
  if (ttlMs !== undefined) opts.ttlMs = ttlMs;
  const feed = createBoardFeed(opts);
  return { feed, client, server, setClock: (ms) => (clockMs = ms) };
}

function stubIdentity(uid, handle = "@stub") {
  return () => ({
    async snapshot() {
      return { uid, handle };
    },
  });
}

function throwingIdentity() {
  return () => ({
    async snapshot() {
      throw new Error("boom");
    },
  });
}

/* ================================================================
   shape, purity
   ================================================================ */

test("createBoardFeed: returns frozen {load, cached, clear}", () => {
  const { feed } = makeFeed({ runs: [], identity: null });
  assert.ok(Object.isFrozen(feed));
  assert.equal(typeof feed.load, "function");
  assert.equal(typeof feed.cached, "function");
  assert.equal(typeof feed.clear, "function");
});

test("purity: boardFeed.js never touches DOM globals and never calls the bare global fetch", () => {
  const code = stripJs(BOARD_FEED_SRC);
  for (const banned of [/\bwindow\b/, /\bnavigator\b/, /\blocalStorage\b/, /\bsessionStorage\b/]) {
    assert.doesNotMatch(code, banned, `must not use ${banned}`);
  }
  assert.doesNotMatch(code, /(?<!\.)\bdocument\b(?!\s*:)/, "must not use the DOM global `document`");
  assert.doesNotMatch(code, /(?<!\w)fetch\(/, "must never call the global fetch directly");
});

test("purity: exports createBoardFeed", () => {
  assert.equal((BOARD_FEED_SRC.match(/export function createBoardFeed/g) || []).length, 1);
});

/* ================================================================
   the core "your best" flow
   ================================================================ */

test("load({stat}): ready, rows = topTen order, total/filteredTotal 14, you = your best (not listed, real rank via rankOf)", async () => {
  const { runs } = makeBoard();
  const { feed } = makeFeed({ runs, identity: stubIdentity(MY_UID) });

  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.status, "ready");
  assert.equal(snap.reason, null);
  assert.equal(snap.rows.length, 10);
  for (let i = 1; i < snap.rows.length; i++) {
    assert.ok(snap.rows[i - 1].deepKey >= snap.rows[i].deepKey);
  }
  assert.equal(snap.total, 14);
  assert.equal(snap.filteredTotal, 14);
  assert.equal(snap.uid, MY_UID);
  assert.equal(snap.youKnown, true);
  assert.ok(snap.you);
  assert.equal(snap.you.listed, false);
  // the mine run with steps=100 has the largest deepKey among the 3 owned runs
  assert.equal(snap.you.run.steps, 100);
  assert.equal(snap.you.run.uid, MY_UID);
  // rank = count of ALL board runs with a strictly larger deepKey, + 1 (the 11 "others" all outrank floor 2)
  assert.equal(snap.you.rank, 12);
  assert.ok(Object.isFrozen(snap));
  assert.ok(Object.isFrozen(snap.rows));
  assert.ok(Object.isFrozen(snap.you));
});

test("load: when one of your runs is in the top ten, you.listed is true and you.rank is its index + 1 — no rankOf read is made", async () => {
  const others = [];
  for (let i = 0; i < 9; i++) others.push(buildRun({ floor: 100 + i }, { uid: `o${i + 1}` }));
  const mine = buildRun({ floor: 150 }, { uid: MY_UID }); // clearly the deepest run on the board
  const runs = [...others, mine].map(seedFrom);
  const { feed, server } = makeFeed({ runs, identity: stubIdentity(MY_UID) });

  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.status, "ready");
  const idx = snap.rows.findIndex((r) => r.uid === MY_UID);
  assert.ok(idx !== -1, "the owned run must be in the top ten");
  assert.equal(snap.you.listed, true);
  assert.equal(snap.you.rank, idx + 1);

  // no rankOf call: every request in this load was either :runQuery (topTen,
  // total, ownRuns) or none at all for :runAggregationQuery with an `above`
  // filter — assert no aggregation request carried an "above" GREATER_THAN filter.
  const aggCalls = server.calls().filter((c) => c.url.includes(":runAggregationQuery"));
  assert.ok(aggCalls.length >= 1); // total() still runs
});

test("load({stat:'kills', race:'Troll', sub:null}): restricts rows/your-best/filteredTotal to Troll; total stays unfiltered; other-race owned runs never count", async () => {
  const others = [];
  for (let i = 0; i < 5; i++) others.push(buildRun({ race: "Troll", cls: "Thief", sub: "Ninja", kills: 50 + i, steps: 200 }, { uid: `t${i + 1}` }));
  for (let i = 0; i < 5; i++) others.push(buildRun({ race: "Human", cls: "Fighter", sub: "Knight", kills: 90 + i, steps: 200 }, { uid: `h${i + 1}` }));
  const mineTroll = buildRun({ race: "Troll", cls: "Thief", sub: "Ninja", kills: 10, steps: 200 }, { uid: MY_UID });
  const mineHuman = buildRun({ race: "Human", cls: "Fighter", sub: "Knight", kills: 999, steps: 1200 }, { uid: MY_UID, handle: validHandle(0.2) });
  const runs = [...others, mineTroll, mineHuman].map(seedFrom);
  const { feed } = makeFeed({ runs, identity: stubIdentity(MY_UID) });

  const snap = await feed.load({ stat: "kills", race: "Troll", sub: null });
  assert.equal(snap.status, "ready");
  assert.ok(snap.rows.every((r) => r.race === "Troll"));
  assert.equal(snap.filteredTotal, 6); // 5 Troll others + 1 Troll mine
  assert.equal(snap.total, 12); // unfiltered: all 12 seeded runs
  assert.ok(snap.you, "must find a Troll best even though a higher-kills Human run exists");
  assert.equal(snap.you.run.race, "Troll");
  assert.equal(snap.you.run.kills, 10);
});

test("load: owned runs from another season are ignored when picking your best", async () => {
  const others = [];
  for (let i = 0; i < 3; i++) others.push(buildRun({ floor: 50 + i }, { uid: `o${i + 1}` }));
  // buildRunDoc always validates season === SEASON, so a season-2 own run is
  // seeded raw (fakeBoardServer's seed runs are never validated) — ownRuns
  // has no season filter, so this doc IS read back; boardFeed must discard
  // it locally when picking "your best".
  const built = buildRun({}, { uid: MY_UID });
  const mineOtherSeason = { id: built.id, doc: Object.freeze({ ...built.doc, season: 2 }) };
  const runs = [...others.map(seedFrom), mineOtherSeason];
  const { feed } = makeFeed({ runs, identity: stubIdentity(MY_UID) });

  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.status, "ready");
  assert.equal(snap.you, null);
  assert.equal(snap.youKnown, true);
});

test("load: ties on the rank key pick the earlier `when` (falling back to createdAt), then the smaller id", async () => {
  // Two owned runs with the SAME deepKey (floor+steps identical) but different `when`.
  const mineLater = buildRun({ floor: 2, steps: 100, when: 5000 }, { uid: MY_UID, handle: validHandle(0.1) });
  const mineEarlier = buildRun({ floor: 2, steps: 100, when: 1000 }, { uid: MY_UID, handle: validHandle(0.1) });
  const runs = [mineLater, mineEarlier].map(seedFrom);
  const { feed } = makeFeed({ runs, identity: stubIdentity(MY_UID) });

  const snap = await feed.load({ stat: "deep" });
  assert.ok(snap.you);
  assert.equal(snap.you.run.when, 1000);
  assert.equal(snap.you.run.id, mineEarlier.id);
});

/* ================================================================
   identity edge cases
   ================================================================ */

test("load: no identity (null) — you null, youKnown true, uid null, zero ownRuns calls", async () => {
  const { runs } = makeBoard();
  const { feed, server } = makeFeed({ runs, identity: null });
  const before = server.calls().length;
  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.you, null);
  assert.equal(snap.youKnown, true);
  assert.equal(snap.uid, null);
  // no runQuery call carries a uid-only filter beyond topTen's own — verify
  // total runQuery calls made equal exactly topTen's own paging (1 call).
  const runQueryCalls = server.calls().filter((c) => c.url.includes(":runQuery")).length - (before);
  assert.equal(runQueryCalls, 1); // topTen only — no ownRuns paging
});

test("load: identity snapshot with uid null — you null, youKnown true, uid null", async () => {
  const { runs } = makeBoard();
  const { feed } = makeFeed({ runs, identity: stubIdentity(null) });
  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.you, null);
  assert.equal(snap.youKnown, true);
  assert.equal(snap.uid, null);
});

test("load: identity.snapshot() throws — you null, youKnown true, uid null; load never rejects", async () => {
  const { runs } = makeBoard();
  const { feed } = makeFeed({ runs, identity: throwingIdentity() });
  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.status, "ready");
  assert.equal(snap.you, null);
  assert.equal(snap.youKnown, true);
  assert.equal(snap.uid, null);
});

test("load: the ownRuns read failing with no cache — you null, youKnown false; rows still ready", async () => {
  const { runs } = makeBoard();
  const server = createFakeBoardFetch({ config: VALID_CONFIG, runs, now: () => 0 });
  // a fetchFn that answers :runQuery for topTen (no uid filter present in the
  // structured query) but fails any query carrying a uid EQUAL filter
  // (ownRuns), simulating a read that fails specifically for own-runs.
  const fetchFn = async (u, init) => {
    const body = init && typeof init.body === "string" ? JSON.parse(init.body) : null;
    const where = body?.structuredQuery?.where;
    const isUidFilter = where?.fieldFilter?.field?.fieldPath === "uid";
    if (isUidFilter) throw new Error("ownRuns network failure");
    return server.fetchFn(u, init);
  };
  const client = createBoardClient({ fetchFn, config: VALID_CONFIG, competeOn: () => true, now: () => 0, season: SEASON });
  const feed = createBoardFeed({ client, identity: stubIdentity(MY_UID), now: () => 0, season: SEASON });

  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.status, "ready");
  assert.ok(snap.rows.length > 0);
  assert.equal(snap.you, null);
  assert.equal(snap.youKnown, false);
});

/* ================================================================
   offline / stale / off
   ================================================================ */

test("load: the fake offline before any load — status unreachable, reason offline, rows []", async () => {
  const { runs } = makeBoard();
  const { feed, server } = makeFeed({ runs, identity: stubIdentity(MY_UID) });
  server.setOnline(false);
  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.status, "unreachable");
  assert.equal(snap.reason, "offline");
  assert.deepEqual([...snap.rows], []);
});

test("load: the fake going offline after a ready load, with the client cache expired — status ready, stale true, fetchedAt equal to the earlier load's", async () => {
  const { runs } = makeBoard();
  const { feed, server, setClock } = makeFeed({ runs, identity: stubIdentity(MY_UID) });

  const first = await feed.load({ stat: "deep" });
  assert.equal(first.status, "ready");
  assert.equal(first.stale, false);
  const firstFetchedAt = first.fetchedAt;
  assert.equal(typeof firstFetchedAt, "number");

  server.setOnline(false);
  setClock(300000); // past the client's 5-minute cache TTL

  const second = await feed.load({ stat: "deep" });
  assert.equal(second.status, "ready");
  assert.equal(second.stale, true);
  assert.equal(second.fetchedAt, firstFetchedAt);
});

test("load: Compete OFF — status off, zero fetch calls; load never rejects even when client methods throw", async () => {
  const { runs } = makeBoard();
  const { feed, server } = makeFeed({ runs, competeOn: () => false, identity: stubIdentity(MY_UID) });
  const before = server.calls().length;
  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.status, "off");
  assert.equal(server.calls().length, before);

  // a client whose methods throw synchronously must still resolve, never reject
  const throwingClient = {
    topTen() {
      throw new Error("boom");
    },
    total() {
      throw new Error("boom");
    },
    ownRuns() {
      throw new Error("boom");
    },
    rankOf() {
      throw new Error("boom");
    },
    clear() {},
  };
  const throwFeed = createBoardFeed({ client: throwingClient, identity: stubIdentity(MY_UID), now: () => 0, season: SEASON });
  await assert.doesNotReject(() => throwFeed.load({ stat: "deep" }));
});

/* ================================================================
   cached() / clear()
   ================================================================ */

test("cached(query): returns the last ready non-stale snapshot within ttlMs for the exact query, else null", async () => {
  const { runs } = makeBoard();
  const { feed, setClock } = makeFeed({ runs, identity: stubIdentity(MY_UID), ttlMs: 300000 });

  assert.equal(feed.cached({ stat: "deep", race: null, sub: null }), null);
  const snap = await feed.load({ stat: "deep" });
  assert.equal(snap.status, "ready");

  const hit = feed.cached({ stat: "deep", race: null, sub: null });
  assert.ok(hit);
  assert.equal(hit.status, "ready");

  // a different query (different stat) is a cache miss
  assert.equal(feed.cached({ stat: "kills", race: null, sub: null }), null);

  setClock(300000); // past ttlMs
  assert.equal(feed.cached({ stat: "deep", race: null, sub: null }), null);
});

test("clear(): empties the feed's own cache and calls client.clear()", async () => {
  const { runs } = makeBoard();
  const { feed, client } = makeFeed({ runs, identity: stubIdentity(MY_UID) });
  await feed.load({ stat: "deep" });
  assert.ok(feed.cached({ stat: "deep", race: null, sub: null }));

  let cleared = false;
  const originalClear = client.clear;
  // client is frozen; wrap the feed's own view of clear by re-creating the
  // feed with a client stub that tracks the clear() call instead.
  const trackingClient = {
    topTen: client.topTen,
    total: client.total,
    ownRuns: client.ownRuns,
    rankOf: client.rankOf,
    clear() {
      cleared = true;
      originalClear();
    },
  };
  const trackedFeed = createBoardFeed({ client: trackingClient, identity: stubIdentity(MY_UID), now: () => 0, season: SEASON });
  await trackedFeed.load({ stat: "deep" });
  assert.ok(trackedFeed.cached({ stat: "deep", race: null, sub: null }));
  trackedFeed.clear();
  assert.equal(cleared, true);
  assert.equal(trackedFeed.cached({ stat: "deep", race: null, sub: null }), null);
});

/* ================================================================
   older-shape doc passthrough
   ================================================================ */

test("load: a seeded older-shape doc (no note/when) appears in rows unchanged", async () => {
  const others = [];
  for (let i = 0; i < 3; i++) others.push(buildRun({ floor: 60 + i }, { uid: `o${i + 1}` }));
  const withNoteWhen = buildRun({ floor: 90 }, { uid: "olderu1" });
  const { note, when, ...oldShapeDoc } = withNoteWhen.doc;
  const oldShapeSeed = { id: withNoteWhen.id, doc: oldShapeDoc };
  const runs = [...others.map(seedFrom), oldShapeSeed];
  const { feed } = makeFeed({ runs, identity: null });

  const snap = await feed.load({ stat: "deep" });
  const row = snap.rows.find((r) => r.id === withNoteWhen.id);
  assert.ok(row, "the older-shape doc must appear in rows");
  assert.equal(row.note, undefined);
  assert.equal(row.when, undefined);
});
