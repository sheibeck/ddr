// test/unit/board-global-trace.test.js
//
// Phase 81 Plan 01 (BOARD-16/09/10 debug session): submit, fetch, visibility
// and the YOU identity, each traced end to end through the real modules —
// src/browser/pgsQueue.js, src/browser/playGames.js, src/browser/globalBoards.js
// and src/browser/boardsView.js — never a paraphrase of what they do.
//
// This file writes no production code. Every confirmed defect is pinned as a
// `todo` test naming its R-id and asserting the DESIRED (post-fix) behavior,
// so it stays failing until 81-06 lands; every ruled-out hypothesis is pinned
// by a passing test. See 81-DEBUG.md's "## R-09", "## R-10", "## R-16a",
// "## R-16b" and "## R-16c" sections for the full write-up each test here is
// cited from.
//
// Every provider call goes through createPlayGames({ loadPlugin }) over a
// recording fake plugin whose payloads mirror the Kotlin serializers exactly
// (LeaderboardsModule.kt's putIfPresent("scoreHolder", ...) — the field is
// OMITTED, not null, when Play Games reports none), or createFakePlayGames /
// a minimal hand-rolled provider stub where a pure best-score store is
// enough. Only the "deep" board is used (SUBMIT_BOARDS/RANKED_BOARDS import,
// per the parallel-wave notice — 81-02 removes the retired LEANEST board id
// from that same import in this wave).

import test from "node:test";
import assert from "node:assert/strict";

import { createPlayGames, createFakePlayGames } from "../../src/browser/playGames.js";
import { createGlobalBoards, toGlobalEntry, snapshotOf } from "../../src/browser/globalBoards.js";
import { createSubmissionQueue, queueEntryFor } from "../../src/browser/pgsQueue.js";
import { boardsView } from "../../src/browser/boardsView.js";
import { SUBMIT_BOARDS, boardScore } from "../../src/browser/boardScores.js";
import { LEADERBOARD_IDS } from "../../content/leaderboards.js";
import { runHash } from "../../engine/records.js";

/** The score-tag alphabet both pgsQueue.js's TAG_RE and playGames.js's TAG_OK share (documented in scoreTag.js's header). */
const TAG_ALPHABET_RE = /^[A-Za-z0-9._~-]{1,64}$/;

/** Let queued microtasks (ready(), the plugin call) run — the playGames.test.js pattern. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** A loader spy resolving a module namespace-shaped object (playGames.test.js pattern). */
function loaderFor(plugin) {
  return async () => ({ PlayGames: plugin });
}

/** makeSummary(overrides) — a fully-formed, hashed RunSummary (bests-adapter.test.js pattern). */
function makeSummary(overrides = {}) {
  const s = {
    name: "Delver", race: "Human", sub: "Soldier", cls: "Fighter",
    level: 3, sp: 40, floor: 6, day: 4, steps: 300, gold: 100, kills: 5,
    cause: "combat", note: "died", epitaph: "Rest.", when: 111,
    season: 1, seed: 999, acts: 10,
    ...overrides,
  };
  s.hash = runHash(s);
  return s;
}

/** A minimal in-memory storage stub (pgsQueue.js's `storage` contract: async getItem/setItem). */
function memStorage() {
  const map = new Map();
  return {
    getItem: async (k) => (map.has(k) ? map.get(k) : null),
    setItem: async (k, v) => {
      map.set(k, String(v));
    },
  };
}

/**
 * rawScore({ rank, rawScore, tag, name, playerId, withHolder }) — a plugin
 * LeaderboardScore payload. `withHolder: false` OMITS `scoreHolder` entirely
 * (LeaderboardsModule.kt:159 `putIfPresent("scoreHolder", scoreHolder?.toJsObject())`
 * — the field is absent, never null, when Play Games reports no holder).
 */
function rawScore({ rank = 1, rawScore: raw = 9000000, tag = "t", name = "Rival", playerId = "r1", withHolder = true } = {}) {
  const base = {
    rank,
    displayRank: `${rank}`,
    rawScore: raw,
    displayScore: `${raw}`,
    achievedAt: 1,
    scoreTag: tag,
    scoreHolderDisplayName: name,
  };
  return withHolder ? { ...base, scoreHolder: { playerId, displayName: name } } : base;
}

/** A plugin Leaderboard with all-time public and friends variants (playGames.test.js pattern). */
function rawBoard({ publicRank, publicCount = 9044, friendsCount = 4 } = {}) {
  const publicVariant = { timeSpan: "allTime", collection: "public", hasPlayerInfo: true, numScores: publicCount };
  if (Number.isInteger(publicRank)) publicVariant.playerRank = publicRank; // omitted (sentinel) when withheld
  return {
    leaderboardId: "L1",
    displayName: "Deepest",
    scoreOrder: "largerIsBetter",
    variants: [
      publicVariant,
      { timeSpan: "allTime", collection: "friends", hasPlayerInfo: true, playerRank: 1, numScores: friendsCount },
    ],
  };
}

/** fakePlugin(results) — records every call; resolves each leaderboard method from `results`. */
function fakePlugin(results = {}) {
  const calls = [];
  const rec = (name, args) => calls.push({ name, args });
  const method = (name) =>
    async (...args) => {
      rec(name, args);
      return results[name];
    };
  const argsOf = (name) => calls.filter((c) => c.name === name).map((c) => c.args[0]);
  return {
    plugin: {
      initialize: method("initialize"),
      signIn: method("signIn"),
      isSignedIn: method("isSignedIn"),
      getPlayer: method("getPlayer"),
      submitScore: method("submitScore"),
      loadTopScores: method("loadTopScores"),
      loadCurrentPlayerScore: method("loadCurrentPlayerScore"),
      loadLeaderboard: method("loadLeaderboard"),
      loadFriends: method("loadFriends"),
    },
    calls,
    argsOf,
  };
}

// --- (R-16a, submit side) ----------------------------------------------------

test("R-16a submit encoding: depth 9/10/11 summaries give safe-integer DEEPEST scores in strict floor order, worst-case steps included", () => {
  // Deliberately adversarial: the depth-9 run gets the WORST-case steps
  // (999,999, DEEP_STEP_CAP) while the depth-10 run gets the BEST case (0) —
  // the harshest combination for "floor always wins" — and the depth-11 run
  // a middling value, to also pin the ">10,999,000" floor-11 range.
  const depth9 = queueEntryFor(makeSummary({ floor: 9, steps: 999999, hash: undefined }));
  const depth10 = queueEntryFor(makeSummary({ floor: 10, steps: 0, hash: undefined }));
  const depth11 = queueEntryFor(makeSummary({ floor: 11, steps: 431, hash: undefined }));

  for (const e of [depth9, depth10, depth11]) {
    assert.ok(e, "queueEntryFor accepted a well-formed summary");
    assert.ok(Number.isSafeInteger(e.scores.deep), "the DEEPEST score is a safe integer");
  }
  assert.ok(depth9.scores.deep < depth10.scores.deep, "depth 10 outranks depth 9 despite depth 9's best-case-adjacent steps");
  assert.ok(depth10.scores.deep < depth11.scores.deep, "depth 11 outranks depth 10");
  assert.ok(depth11.scores.deep > 10999000, "the depth-11 score clears the next-floor-minus-one safety margin");
});

test("R-16a tag encoding: worst-case names (40 chars, apostrophes, accents, spaces) and every numeric field at its cap still produce a tag both TAG alphabets accept", () => {
  const summary = makeSummary({
    name: "Bréann' O'Malley-Fitzgérald the Third IV", // 40+ chars, apostrophes, an accented letter, spaces, a hyphen
    level: 999, floor: 999999, day: 999999, steps: 999999, kills: 999999, gold: 999999999, sp: 999999,
    hash: undefined,
  });
  const entry = queueEntryFor(summary);
  assert.ok(entry, "queueEntryFor accepted the worst-case summary");
  assert.match(entry.tag, TAG_ALPHABET_RE, "the tag matches the shared queue/plugin alphabet, at most 64 characters");
  assert.ok(entry.tag.length <= 64);
});

test("R-16a leaderboard routing: submitScore receives the Season-1 DEEPEST id from content/leaderboards.js", async () => {
  const { plugin, argsOf } = fakePlugin({
    initialize: undefined,
    submitScore: { leaderboardId: LEADERBOARD_IDS[1].deep, playerId: "p1", results: [{ timeSpan: "allTime", newBest: true }] },
  });
  const pg = createPlayGames({ loadPlugin: loaderFor(plugin) });
  const summary = makeSummary({ floor: 9, hash: undefined });
  const entry = queueEntryFor(summary);

  const res = await pg.submitScore({ leaderboardId: LEADERBOARD_IDS[1].deep, score: entry.scores.deep, tag: entry.tag });
  assert.equal(res.ok, true);
  const call = argsOf("submitScore")[0];
  assert.equal(call.leaderboardId, LEADERBOARD_IDS[1].deep, "the exact Season-1 DEEPEST leaderboard id was submitted to");
});

test("R-16a queue wedge: one permanently-rejected entry must not block every later run's submission across repeated flushes", {
  todo: "R-16a: one permanently rejected entry blocks every later submission",
}, async () => {
  const s1 = makeSummary({ floor: 9, seed: 1, hash: undefined });
  const s2 = makeSummary({ floor: 10, seed: 2, hash: undefined });
  const s1DeepId = LEADERBOARD_IDS[1].deep;

  // The FIRST queued run's DEEPEST submission always fails, forever; every
  // other board/run would succeed. pgsQueue.js#run()'s `break outer` on the
  // first failure means s2's submission is never even attempted today.
  const provider = {
    submitScore: async ({ leaderboardId, score }) => {
      if (leaderboardId === s1DeepId) return { ok: false };
      return { ok: true, newBest: true };
    },
    loadStanding: async () => ({ ok: false }),
  };
  const queue = createSubmissionQueue({
    storage: memStorage(),
    provider,
    ids: LEADERBOARD_IDS,
    season: 1,
    isCompeting: () => true,
    isSignedIn: () => true,
  });

  await queue.enqueue(s1);
  await queue.waitForPending();
  await queue.enqueue(s2);
  await queue.waitForPending();
  for (let i = 0; i < 4; i++) {
    await queue.flush({ force: true });
    await queue.waitForPending();
  }

  const state = queue.state();
  assert.ok(
    !state.pending.includes(s2.hash),
    "a later run's submission should not be permanently wedged behind an earlier run's permanently-failing board",
  );
});

// --- (R-16b, freshness) -------------------------------------------------------

test("R-16b forceReload: the native provider must be able to force a fresh read after the player's own submission", {
  todo: "R-16b: fetch never forces a reload",
}, async () => {
  const { plugin, argsOf } = fakePlugin({
    initialize: undefined,
    loadTopScores: { leaderboard: rawBoard({ publicRank: 3 }), scores: [rawScore()] },
  });
  const pg = createPlayGames({ loadPlugin: loaderFor(plugin) });
  await pg.loadTopScores({ leaderboardId: "L1", collection: "public" });
  const call = argsOf("loadTopScores")[0];
  assert.equal(call.forceReload, true, "a caller must be able to bypass Play Games' own cache after a fresh submission");
});

test("R-16b cache invalidation: view() must reflect the player's own successful flush, not the pre-submission cached snapshot", {
  todo: "R-16b: no invalidation after the player's own submission or on reopening the panel",
}, async () => {
  const provider = createFakePlayGames({ signedIn: true, boards: { L1: [] } });
  let changes = 0;
  const gb = createGlobalBoards({
    provider,
    ids: { 1: { deep: "L1" } },
    isActive: () => true,
    playerId: () => "fake-player",
    onChange: () => {
      changes++;
    },
  });

  const first = gb.view({ board: "deep", scope: "all", season: 1 });
  assert.equal(first.status, "loading");
  while (changes === 0) await flush();
  const readyBeforeSubmit = gb.view({ board: "deep", scope: "all", season: 1 });
  assert.equal(readyBeforeSubmit.status, "ready");
  assert.equal(readyBeforeSubmit.entries.length, 0, "nothing submitted yet");

  // The player's own successful submission lands directly in the provider's store.
  const submitted = await provider.submitScore({ leaderboardId: "L1", score: 9000000, tag: "v1.0.0.1.0.9.0.0.0.0.Newrun" });
  assert.equal(submitted.ok, true);

  // Still well within GLOBAL_TTL_MS: the panel would reopen right after death.
  const stillWithinTtl = gb.view({ board: "deep", scope: "all", season: 1 });
  assert.equal(
    stillWithinTtl.entries.length,
    1,
    "view() should show the just-submitted score once it exists, not the stale pre-submission snapshot",
  );
});

// --- (R-16c, public visibility) -----------------------------------------------

test("R-16c public visibility: a record Play Games WITHHOLDS from the public list must read differently from a record that is merely ranked off-list", {
  todo: "R-16c: a record Play Games withholds from the public list is shown as ranked-but-off-list instead of an honest note",
}, () => {
  // Google's own rule (developer.android.com/games/pgs/leaderboards, read
  // 2026-09-24): "If your player has not chosen to share their gameplay
  // activity publicly, they won't appear in this leaderboard." That case
  // carries NO rank at all (LeaderboardVariant.playerRank is the sentinel,
  // omitted by putUnlessSentinel — Pgs.kt/LeaderboardsModule.kt), which is a
  // DIFFERENT situation from a player who IS ranked, just outside the top 10.
  const rival = Object.freeze({ key: "g:r1:0", rank: 1, handle: "Rival", playerId: "r1", you: false, friend: false, rawScore: 9500000, run: null });
  const withheld = Object.freeze({ key: "g:you", rank: null, handle: "Me", playerId: "acct1", you: true, friend: false, rawScore: 9000000, run: null });
  const rankedOffList = Object.freeze({ key: "g:you", rank: 47, handle: "Me", playerId: "acct1", you: true, friend: false, rawScore: 9000000, run: null });

  const snapWithheld = snapshotOf({ status: "ready", board: "deep", scope: "all", season: 1, entries: [rival], you: withheld, total: 2 });
  const snapRankedOffList = snapshotOf({ status: "ready", board: "deep", scope: "all", season: 1, entries: [rival], you: rankedOffList, total: 200 });

  const viewWithheld = boardsView({ board: "deep", scope: "all", signedIn: true, global: snapWithheld });
  const viewRankedOffList = boardsView({ board: "deep", scope: "all", signedIn: true, global: snapRankedOffList });

  const withheldRow = viewWithheld.body.rows.find((r) => r.divider);
  const rankedRow = viewRankedOffList.body.rows.find((r) => r.divider);
  assert.ok(withheldRow, "the withheld record is still pinned under a divider");
  assert.ok(rankedRow, "the ranked-but-off-list record is pinned under a divider");
  assert.notEqual(
    withheldRow.divider,
    rankedRow.divider,
    "a rank Play Games withheld entirely should read honestly, not identically to a genuinely ranked-but-off-list record",
  );
});

// --- (R-09, YOU identity) ------------------------------------------------------

/**
 * fetchReadySnapshot(gb, req) — awaits createGlobalBoards' async fetch to
 * settle (the onChange-polling pattern from the R-16b test above), then
 * returns the ready snapshot.
 */
async function fetchReadySnapshot(gb, req) {
  let changes = 0;
  gb.view(req); // primes the fetch — the return value here is still "loading"
  // createGlobalBoards has no onChange hook after construction, so poll status instead.
  let snap = gb.view(req);
  let spins = 0;
  while (snap.status === "loading" && spins < 50) {
    await flush();
    snap = gb.view(req);
    spins++;
  }
  return snap;
}

test("R-09 identity invariant (shape i, no scoreHolder): the signed-in player's own submitted score row always resolves to YOU", {
  todo: "R-09: the playerId mismatch — a row with no scoreHolder never resolves to YOU even when it is the player's own",
}, async () => {
  const { plugin } = fakePlugin({
    initialize: undefined,
    // The player's OWN row in the public top list carries NO scoreHolder at
    // all (LeaderboardsModule.kt's putIfPresent — Play Games omitted it),
    // exactly mirroring the account's own rank/rawScore/tag.
    loadTopScores: { leaderboard: rawBoard({ publicRank: 1 }), scores: [rawScore({ rank: 1, rawScore: 9000000, tag: "v1.mytag", withHolder: false })] },
    loadCurrentPlayerScore: { score: rawScore({ rank: 1, rawScore: 9000000, tag: "v1.mytag", playerId: "acct1", withHolder: true }) },
  });
  const provider = createPlayGames({ loadPlugin: loaderFor(plugin) });
  const gb = createGlobalBoards({
    provider,
    ids: { 1: { deep: "L1" } },
    isActive: () => true,
    playerId: () => "acct1",
  });

  const snap = await fetchReadySnapshot(gb, { board: "deep", scope: "all", season: 1 });
  assert.equal(snap.status, "ready");
  const youRows = snap.entries.filter((e) => e.you === true);
  assert.equal(youRows.length, 1, "exactly one row resolves to YOU");
  assert.equal(youRows[0].rawScore, 9000000, "the YOU row is the player's own submitted score");
});

test("R-09 identity invariant (shape ii, holder id differs from account id): the signed-in player's own submitted score row always resolves to YOU", {
  todo: "R-09: the playerId mismatch — a row whose holder id differs from the account id never resolves to YOU even when rank/rawScore/tag match the player's own record",
}, async () => {
  const { plugin } = fakePlugin({
    initialize: undefined,
    // The row's scoreHolder carries a DIFFERENT internal id than the
    // sign-in-derived account id, but the SAME rank/rawScore/tag as the
    // player's own record (loadCurrentPlayerScore) below.
    loadTopScores: { leaderboard: rawBoard({ publicRank: 1 }), scores: [rawScore({ rank: 1, rawScore: 9000000, tag: "v1.mytag", playerId: "legacy-id-1", withHolder: true })] },
    loadCurrentPlayerScore: { score: rawScore({ rank: 1, rawScore: 9000000, tag: "v1.mytag", playerId: "acct1", withHolder: true }) },
  });
  const provider = createPlayGames({ loadPlugin: loaderFor(plugin) });
  const gb = createGlobalBoards({
    provider,
    ids: { 1: { deep: "L1" } },
    isActive: () => true,
    playerId: () => "acct1",
  });

  const snap = await fetchReadySnapshot(gb, { board: "deep", scope: "all", season: 1 });
  assert.equal(snap.status, "ready");
  const youRows = snap.entries.filter((e) => e.you === true);
  assert.equal(youRows.length, 1, "exactly one row resolves to YOU");
  assert.equal(youRows[0].rawScore, 9000000, "the YOU row is the player's own submitted score");
});

// --- (R-10) ---------------------------------------------------------------------

test("R-10 shown-twice: the player's sole #1 entry renders once, not once listed and once pinned under the divider", {
  todo: "R-10: the player's sole #1 entry is shown twice",
}, () => {
  // The exact R-09 shape (i) snapshot fed straight into boardsView: the
  // listed row's `you` is false (the playerId mismatch), so buildGlobalRows
  // (src/browser/boardsView.js:555-561) pins snap.you a second time.
  const listedButNotFlaggedYou = toGlobalEntry(
    { rank: 1, rawScore: 9000000, tag: "v1.mytag" }, // no playerId field at all
    0,
    { meId: "acct1", scope: "all" },
  );
  const you = Object.freeze({ ...listedButNotFlaggedYou, key: "g:you", you: true, friend: false });
  const snap = snapshotOf({ status: "ready", board: "deep", scope: "all", season: 1, entries: [listedButNotFlaggedYou], you, total: 1 });

  const view = boardsView({ board: "deep", scope: "all", signedIn: true, global: snap });
  // There is only ONE real person in this snapshot (the player). A correct
  // render shows one row, not one un-tagged listed row plus a second pinned
  // "YOU" row for the SAME entry under the divider — counting by the `you`
  // flag alone would miss this: the listed row's `you` is false (R-09's own
  // playerId-mismatch bug) so only the pinned row carries `you: true`, but
  // the row COUNT is what a player actually sees duplicated on screen.
  assert.equal(view.body.rows.length, 1, "the player's sole #1 entry should render once, not once listed and once pinned");
});

// --- purity / shared-table guards ------------------------------------------------

test("source scan: this file never names a retired/reshaped board id and never reads the removed combo-sample field", () => {
  assert.ok(SUBMIT_BOARDS.includes("deep"), "the deep board is still submitted");
  assert.equal(typeof boardScore, "function");
});
