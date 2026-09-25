// test/unit/globalBoards.test.js
//
// Phase 68 (PGS-05, D-05..D-07, D-09): the global and friends boards'
// fetch-and-cache controller. The first half proves the pure builders:
// toGlobalEntry turns a normalized Play Games score into a frozen, decoded
// GlobalEntry (YOU/FRIEND marking, anon keys, malformed tags keep the row)
// and snapshotOf builds the deep-frozen GlobalSnapshot contract 68-06's
// boardsView consumes. Entries keep the order Play Games returned; nothing
// here re-sorts (PGS-05 adjacency).
//
// The second half drives createGlobalBoards over createFakePlayGames with a
// manual clock: zero provider calls while inactive, one fetch per (season,
// board, scope), the 5-minute TTL and its background refresh, stale-on-
// failure, unreachable with the 30-second retry, closed boards, LINEAGE's
// 25-score DEEPEST sample, both friends-consent paths, and discarding a
// fetch that settles after the player stopped competing or after clear().

import test from "node:test";
import assert from "node:assert/strict";

import {
  GLOBAL_TTL_MS,
  GLOBAL_RETRY_MS,
  TOP_N,
  toGlobalEntry,
  snapshotOf,
  createGlobalBoards,
} from "../../src/browser/globalBoards.js";
import { encodeTag, decodeTag } from "../../src/browser/scoreTag.js";
import { devLeaderboardIds, scoreOrdersFor } from "../../src/browser/boardScores.js";
import { createFakePlayGames, FAKE_PLAYER } from "../../src/browser/playGames.js";

const SUMMARY = Object.freeze({
  race: "Dwarven",
  sub: "Cat Burglar",
  level: 3,
  cause: "combat",
  floor: 7,
  day: 22,
  steps: 431,
  kills: 19,
  gold: 4688,
  sp: 1180,
  name: "Hilda Ferrow",
});
const TAG = encodeTag(SUMMARY);

const score = (over = {}) =>
  Object.freeze({ rank: 3, rawScore: 6999569, tag: TAG, handle: "Rival", playerId: "r1", friend: true, ...over });

// ─── constants ──────────────────────────────────────────────────────────────

test("constants: 5-minute TTL, 30-second retry, top 10 (Phase 81, BOARD-13: no LINEAGE sample size — LINEAGE is ME-only and never reaches this module)", () => {
  assert.equal(GLOBAL_TTL_MS, 300000);
  assert.equal(GLOBAL_RETRY_MS, 30000);
  assert.equal(TOP_N, 10);
});

// ─── toGlobalEntry ──────────────────────────────────────────────────────────

test("toGlobalEntry: a rival's score becomes a frozen decoded entry keyed by playerId and index", () => {
  assert.ok(decodeTag(TAG), "the fixture tag is a valid v1 tag");
  const e = toGlobalEntry(score(), 2, { meId: "me", scope: "all" });
  assert.ok(Object.isFrozen(e));
  assert.deepEqual(
    { ...e, run: null },
    { key: "g:r1:2", rank: 3, handle: "Rival", playerId: "r1", you: false, friend: true, rawScore: 6999569, run: null },
  );
  assert.deepEqual(e.run, decodeTag(TAG));
  assert.equal(e.run.name, "Hilda Ferrow");
  assert.equal(e.run.floor, 7);
  assert.deepEqual(Object.keys(e).sort(), ["friend", "handle", "key", "playerId", "rank", "rawScore", "run", "you"]);
});

test("toGlobalEntry: a playerId equal to meId is marked you", () => {
  const e = toGlobalEntry(score({ playerId: "me", friend: false }), 0, { meId: "me", scope: "all" });
  assert.equal(e.you, true);
  assert.equal(e.key, "g:me:0");
});

test("toGlobalEntry: an empty meId never marks an anonymous row as you", () => {
  const e = toGlobalEntry(score({ playerId: "" }), 4, { meId: "", scope: "all" });
  assert.equal(e.you, false);
  assert.equal(e.key, "g:anon:4");
});

test("toGlobalEntry: in the friends scope every non-you entry is a friend", () => {
  const other = toGlobalEntry(score({ friend: false }), 1, { meId: "me", scope: "friends" });
  assert.equal(other.friend, true);
  const mine = toGlobalEntry(score({ playerId: "me", friend: false }), 0, { meId: "me", scope: "friends" });
  assert.equal(mine.you, true);
  assert.equal(mine.friend, false);
});

test("toGlobalEntry: in the all scope friend follows the score", () => {
  assert.equal(toGlobalEntry(score({ friend: false }), 0, { meId: "me", scope: "all" }).friend, false);
  assert.equal(toGlobalEntry(score({ friend: true }), 0, { meId: "me", scope: "all" }).friend, true);
});

test("toGlobalEntry: an empty or missing playerId gives an anon key", () => {
  assert.equal(toGlobalEntry(score({ playerId: "" }), 5, { meId: "me", scope: "all" }).key, "g:anon:5");
  assert.equal(toGlobalEntry(score({ playerId: undefined }), 6, { meId: "me", scope: "all" }).key, "g:anon:6");
  assert.equal(toGlobalEntry(score({ playerId: undefined }), 6, { meId: "me", scope: "all" }).playerId, "");
});

test("toGlobalEntry: a malformed tag keeps the row with run null", () => {
  for (const tag of ["", "v9.1.2", "not a tag", 42, null, "x".repeat(80)]) {
    const e = toGlobalEntry(score({ tag }), 0, { meId: "me", scope: "all" });
    assert.equal(e.run, null, `tag ${String(tag)}`);
    assert.equal(e.handle, "Rival");
    assert.equal(e.rawScore, 6999569);
  }
});

test("toGlobalEntry: rank, rawScore and handle are coerced defensively", () => {
  const opts = { meId: "me", scope: "all" };
  assert.equal(toGlobalEntry(score({ rank: undefined }), 0, opts).rank, null);
  assert.equal(toGlobalEntry(score({ rank: 2.5 }), 0, opts).rank, null);
  assert.equal(toGlobalEntry(score({ rank: "3" }), 0, opts).rank, null);
  assert.equal(toGlobalEntry(score({ rank: 0 }), 0, opts).rank, null);
  assert.equal(toGlobalEntry(score({ rawScore: NaN }), 0, opts).rawScore, 0);
  assert.equal(toGlobalEntry(score({ rawScore: Infinity }), 0, opts).rawScore, 0);
  assert.equal(toGlobalEntry(score({ rawScore: "12" }), 0, opts).rawScore, 0);
  assert.equal(toGlobalEntry(score({ handle: 42 }), 0, opts).handle, "");
  assert.equal(toGlobalEntry(score({ handle: { evil: true } }), 0, opts).handle, "");
});

test("toGlobalEntry: a non-object score still yields a harmless row", () => {
  const e = toGlobalEntry(null, 3, { meId: "me", scope: "all" });
  assert.deepEqual({ ...e }, {
    key: "g:anon:3",
    rank: null,
    handle: "",
    playerId: "",
    you: false,
    friend: false,
    rawScore: 0,
    run: null,
  });
});

// ─── snapshotOf ─────────────────────────────────────────────────────────────

test("snapshotOf: defaults and deep freeze", () => {
  const s = snapshotOf({ status: "loading", board: "deep", scope: "all", season: 1 });
  assert.deepEqual(
    { ...s, entries: [...s.entries] },
    {
      status: "loading",
      board: "deep",
      scope: "all",
      season: 1,
      entries: [],
      you: null,
      total: null,
      stale: false,
    },
  );
  assert.ok(!("sampled" in s), "Phase 81 (BOARD-13): sampled is gone — LINEAGE never reaches this module");
  assert.ok(Object.isFrozen(s));
  assert.ok(Object.isFrozen(s.entries));
});

test("snapshotOf: a ready snapshot keeps its entries, you, total and stale", () => {
  const entries = [0, 1].map((i) => toGlobalEntry(score({ rank: i + 1, playerId: `p${i}` }), i, { meId: "me", scope: "all" }));
  const you = toGlobalEntry(score({ playerId: "me" }), 0, { meId: "me", scope: "all" });
  const s = snapshotOf({ status: "ready", board: "deep", scope: "all", season: 1, entries, you, total: 40, stale: true });
  assert.equal(s.entries.length, 2);
  assert.equal(s.entries[0], entries[0]);
  assert.equal(s.you, you);
  assert.equal(s.total, 40);
  assert.equal(s.stale, true);
  assert.ok(Object.isFrozen(s.entries));
  assert.ok(s.entries.every((e) => Object.isFrozen(e)));
  assert.ok(Object.isFrozen(s.you));
  assert.notEqual(s.entries, entries, "the snapshot owns a copy of the entries array");
});

test("snapshotOf: entries are forced to [] unless the status is ready", () => {
  const entries = [toGlobalEntry(score(), 0, { meId: "me", scope: "all" })];
  for (const status of ["loading", "unreachable", "consent", "closed"]) {
    const s = snapshotOf({ status, board: "deep", scope: "all", season: 1, entries });
    assert.deepEqual([...s.entries], [], status);
  }
});

test("snapshotOf: junk total and stale fall back to their defaults", () => {
  const s = snapshotOf({ status: "ready", board: "deep", scope: "all", season: 1, total: -1, stale: "yes" });
  assert.equal(s.total, null);
  assert.equal(s.stale, false);
});

// ─── order preservation (PGS-05 adjacency edge probe) ───────────────────────

test("entries keep the order Play Games returned: equal scores and one player twice are never re-sorted", () => {
  const returned = [
    score({ rank: 1, rawScore: 500, playerId: "b", handle: "B" }),
    score({ rank: 1, rawScore: 500, playerId: "a", handle: "A" }),
    score({ rank: 3, rawScore: 400, playerId: "a", handle: "A" }),
    score({ rank: 4, rawScore: 900, playerId: "c", handle: "C" }),
  ];
  const entries = returned.map((s, i) => toGlobalEntry(s, i, { meId: "me", scope: "all" }));
  const snap = snapshotOf({ status: "ready", board: "deep", scope: "all", season: 1, entries });
  assert.deepEqual(snap.entries.map((e) => e.handle), ["B", "A", "A", "C"]);
  assert.deepEqual(snap.entries.map((e) => e.key), ["g:b:0", "g:a:1", "g:a:2", "g:c:3"]);
  assert.equal(new Set(snap.entries.map((e) => e.key)).size, 4);
});

// ─── createGlobalBoards: rig ────────────────────────────────────────────────

const ME = FAKE_PLAYER.id;
const IDS = devLeaderboardIds();
const DEEP = IDS[1].deep;

/** flush() — lets every pending provider promise and its continuation settle. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** rivals(n, start) — n seeded rival entries, best first; every third is a friend. */
function rivals(n, { top = 1000, step = 10 } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    playerId: `r${i}`,
    handle: `Rival ${i}`,
    score: top - i * step,
    tag: encodeTag({ ...SUMMARY, floor: i + 1, name: `Rival ${i}` }),
    friend: i % 3 === 0,
  }));
}

/** mine(score) — the signed-in player's own seeded entry. */
const mine = (score) => ({ playerId: ME, handle: FAKE_PLAYER.displayName, score, tag: TAG, friend: false });

/** spied(provider) — the provider with every leaderboard call's arguments recorded. */
function spied(p) {
  const args = [];
  const wrap = {};
  for (const m of ["submitScore", "loadTopScores", "loadPlayerScore", "loadStanding", "friendsAccess"]) {
    wrap[m] = (o) => {
      args.push([m, o]);
      return p[m](o);
    };
  }
  return { provider: { ...p, ...wrap }, args };
}

/**
 * rig(opts) — a controller over a signed-in fake with a manual clock, an
 * isActive switch and an onChange counter. `boards` defaults to twelve rivals
 * plus the player at rank 13 on DEEPEST.
 */
function rig({
  boards = { [DEEP]: [...rivals(12), mine(100)] },
  ids = IDS,
  friendsConsent = "granted",
  interactive = "accept",
  online = true,
  active = true,
  meId = ME,
  provider = null,
  onChange = null,
} = {}) {
  let t = 1000000;
  let on = active;
  let changes = 0;
  const fake = createFakePlayGames({ signedIn: true, boards, orders: scoreOrdersFor(ids), friendsConsent, interactive, online });
  const s = spied(provider || fake);
  const gb = createGlobalBoards({
    provider: s.provider,
    ids,
    isActive: () => on,
    playerId: () => meId,
    onChange:
      onChange ||
      (() => {
        changes++;
      }),
    now: () => t,
  });
  return {
    gb,
    fake,
    args: s.args,
    names: () => s.args.map(([m]) => m),
    advance(ms) {
      t += ms;
    },
    setActive(v) {
      on = v;
    },
    changes: () => changes,
  };
}

/** stub(methods) — a minimal provider; unspecified reads succeed empty. */
function stub(methods = {}) {
  return {
    loadTopScores: async () => ({ ok: true, scores: [], total: 0 }),
    loadPlayerScore: async () => ({ ok: true, score: null }),
    friendsAccess: async () => "granted",
    ...methods,
  };
}

const deepAll = Object.freeze({ board: "deep", scope: "all", season: 1 });

// ─── createGlobalBoards ─────────────────────────────────────────────────────

test("createGlobalBoards returns a frozen { view, requestFriendsAccess, clear }", () => {
  const { gb } = rig();
  assert.ok(Object.isFrozen(gb));
  assert.deepEqual(Object.keys(gb).sort(), ["clear", "requestFriendsAccess", "view"]);
});

test("inactive (signed out or Compete OFF): view() is null and nothing touches the provider", async () => {
  const r = rig({ active: false });
  for (const board of ["deep", "combo", "days", "kills", "purse"]) {
    for (const scope of ["all", "friends"]) assert.equal(r.gb.view({ board, scope, season: 1 }), null);
  }
  assert.equal(await r.gb.requestFriendsAccess(), "unavailable");
  await flush();
  assert.deepEqual(r.fake.calls(), []);
  assert.deepEqual(r.args, []);
  assert.equal(r.changes(), 0);
});

test("GRAVEYARD, LINEAGE (combo — both ME-only, Phase 81, BOARD-13/BOARD-14), the local scope and unknown boards or scopes return null with no call", async () => {
  const r = rig();
  assert.equal(r.gb.view({ board: "yard", scope: "all", season: 1 }), null);
  assert.equal(r.gb.view({ board: "combo", scope: "all", season: 1 }), null);
  assert.equal(r.gb.view({ board: "combo", scope: "friends", season: 1 }), null);
  assert.equal(r.gb.view({ board: "deep", scope: "local", season: 1 }), null);
  assert.equal(r.gb.view({ board: "tallest", scope: "all", season: 1 }), null);
  assert.equal(r.gb.view({ board: "deep", scope: "everyone", season: 1 }), null);
  assert.equal(r.gb.view(), null);
  await flush();
  assert.deepEqual(r.args, []);
});

test("first view() is loading and starts exactly one top-10 and one player-score fetch; settling fires onChange once", async () => {
  const r = rig();
  const first = r.gb.view(deepAll);
  assert.equal(first.status, "loading");
  assert.equal(first.board, "deep");
  assert.equal(first.scope, "all");
  assert.equal(first.season, 1);
  assert.deepEqual([...first.entries], []);
  assert.equal(r.gb.view(deepAll), first, "a second view() before settling starts nothing and returns the same snapshot");
  assert.deepEqual(r.args, [
    ["loadTopScores", { leaderboardId: DEEP, collection: "public", maxResults: 10 }],
    ["loadPlayerScore", { leaderboardId: DEEP, collection: "public" }],
  ]);
  assert.equal(r.changes(), 0);
  await flush();
  assert.equal(r.changes(), 1);
  const ready = r.gb.view(deepAll);
  assert.equal(ready.status, "ready");
  assert.equal(ready.entries.length, 10);
  assert.deepEqual(ready.entries.map((e) => e.handle), rivals(10).map((e) => e.handle));
  assert.deepEqual(ready.entries.map((e) => e.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(ready.entries[0].key, "g:r0:0");
  assert.equal(ready.entries[3].run.floor, 4);
  assert.equal(ready.entries[3].run.name, "Rival 3");
  assert.equal(ready.entries[3].friend, true);
  assert.equal(ready.entries[1].friend, false);
  assert.ok(ready.entries.every((e) => e.you === false));
  assert.equal(ready.total, 13);
  assert.ok(!("sampled" in ready));
  assert.equal(ready.stale, false);
  assert.equal(r.args.length, 2);
});

test("the player's own score outside the top ten is you, keyed g:you, with its real rank", async () => {
  const r = rig();
  r.gb.view(deepAll);
  await flush();
  const { you } = r.gb.view(deepAll);
  assert.ok(Object.isFrozen(you));
  assert.equal(you.key, "g:you");
  assert.equal(you.you, true);
  assert.equal(you.rank, 13);
  assert.equal(you.rawScore, 100);
  assert.deepEqual(you.run, decodeTag(TAG));
});

test("the player's own score inside the top ten marks the matching entry you as well", async () => {
  const r = rig({ boards: { [DEEP]: [...rivals(12), mine(995)] } });
  r.gb.view(deepAll);
  await flush();
  const snap = r.gb.view(deepAll);
  const marked = snap.entries.filter((e) => e.you);
  assert.equal(marked.length, 1);
  assert.equal(marked[0].rank, 2);
  assert.equal(marked[0].key, `g:${ME}:1`);
  assert.equal(snap.you.key, "g:you");
  assert.equal(snap.you.rank, 2);
});

test("the player's own score is you even when Play Games returns it without a playerId", async () => {
  const provider = stub({
    loadTopScores: async () => ({
      ok: true,
      scores: [
        { rank: 1, rawScore: 900, tag: TAG, handle: "Top", playerId: "t1", friend: false },
        { rank: 2, rawScore: 800, tag: TAG, handle: "Me", playerId: "me-id", friend: false },
      ],
      total: 2,
    }),
    loadPlayerScore: async () => ({
      ok: true,
      score: { rank: 2, rawScore: 800, tag: TAG, handle: "Me", playerId: "", friend: false },
    }),
  });
  const r = rig({ provider, meId: "me-id" });
  r.gb.view(deepAll);
  await flush();
  const snap = r.gb.view(deepAll);
  assert.equal(snap.you.key, "g:you");
  assert.equal(snap.you.you, true);
  assert.equal(snap.you.rank, 2);
  assert.deepEqual(snap.entries.map((e) => e.you), [false, true]);
});

test("with no signed-in id yet, the player score's own playerId marks the matching entry", async () => {
  const r = rig({ boards: { [DEEP]: [...rivals(12), mine(995)] }, meId: "" });
  r.gb.view(deepAll);
  await flush();
  const snap = r.gb.view(deepAll);
  assert.deepEqual(snap.entries.filter((e) => e.you).map((e) => e.rank), [2]);
});

test("TTL: the same snapshot for 5 minutes, then one background refresh that replaces it", async () => {
  const r = rig();
  r.gb.view(deepAll);
  await flush();
  const ready = r.gb.view(deepAll);
  r.advance(300000);
  assert.equal(r.gb.view(deepAll), ready);
  assert.equal(r.args.length, 2, "no call at exactly the TTL");
  await r.fake.submitScore({ leaderboardId: DEEP, score: 5000, tag: TAG });
  r.advance(1);
  assert.equal(r.gb.view(deepAll), ready, "past the TTL the cached snapshot is still served");
  assert.equal(r.gb.view(deepAll), ready);
  assert.deepEqual(r.names().slice(2), ["loadTopScores", "loadPlayerScore"], "exactly one refresh");
  await flush();
  assert.equal(r.changes(), 2);
  const fresh = r.gb.view(deepAll);
  assert.notEqual(fresh, ready);
  assert.equal(fresh.status, "ready");
  assert.equal(fresh.entries[0].you, true);
  assert.equal(fresh.you.rank, 1);
  r.advance(299999);
  assert.equal(r.gb.view(deepAll), fresh);
  assert.equal(r.args.length, 4, "the refresh restarted the TTL");
});

test("a failed refresh keeps the last entries marked stale, retries after 30 seconds and clears stale on success", async () => {
  const r = rig();
  r.gb.view(deepAll);
  await flush();
  const ready = r.gb.view(deepAll);
  r.fake.setOnline(false);
  r.advance(300001);
  r.gb.view(deepAll);
  await flush();
  const stale = r.gb.view(deepAll);
  assert.equal(stale.status, "ready");
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.entries, ready.entries);
  assert.equal(stale.you, ready.you);
  assert.equal(stale.total, ready.total);
  assert.equal(r.changes(), 2);
  assert.equal(r.args.length, 4);
  r.advance(30000);
  assert.equal(r.gb.view(deepAll), stale);
  assert.equal(r.args.length, 4, "no retry within 30 seconds");
  r.fake.setOnline(true);
  r.advance(1);
  assert.equal(r.gb.view(deepAll), stale);
  assert.equal(r.args.length, 6, "one retry after 30 seconds");
  await flush();
  const back = r.gb.view(deepAll);
  assert.equal(back.status, "ready");
  assert.equal(back.stale, false);
});

test("a failure with no cache is unreachable, retried after 30 seconds", async () => {
  const r = rig({ online: false });
  assert.equal(r.gb.view(deepAll).status, "loading");
  await flush();
  const down = r.gb.view(deepAll);
  assert.equal(down.status, "unreachable");
  assert.deepEqual([...down.entries], []);
  assert.equal(down.you, null);
  assert.equal(r.changes(), 1);
  r.advance(30000);
  assert.equal(r.gb.view(deepAll), down);
  assert.equal(r.args.length, 2);
  r.advance(1);
  assert.equal(r.gb.view(deepAll), down, "the unreachable note stays while the retry runs");
  assert.equal(r.args.length, 4);
  await flush();
  assert.equal(r.gb.view(deepAll).status, "unreachable");
  r.fake.setOnline(true);
  r.advance(30001);
  r.gb.view(deepAll);
  await flush();
  assert.equal(r.gb.view(deepAll).status, "ready");
});

test("a provider that throws or rejects gives unreachable and never breaks view()", async () => {
  for (const loadTopScores of [
    () => {
      throw new Error("boom");
    },
    async () => {
      throw new Error("boom");
    },
    async () => null,
    async () => ({ ok: true, scores: "junk" }),
  ]) {
    const r = rig({ provider: stub({ loadTopScores }) });
    assert.equal(r.gb.view(deepAll).status, "loading");
    await flush();
    const snap = r.gb.view(deepAll);
    assert.ok(["unreachable", "ready"].includes(snap.status));
    if (snap.status === "ready") assert.deepEqual([...snap.entries], []);
  }
  const r = rig({ provider: stub({ loadTopScores: async () => ({ ok: false }) }) });
  r.gb.view(deepAll);
  await flush();
  assert.equal(r.gb.view(deepAll).status, "unreachable");
});

test("a placeholder or missing id gives closed with zero calls (LINEAGE/combo is already null — Phase 81, BOARD-13 — before any placeholder check applies)", async () => {
  const ids = { 1: { ...IDS[1], deep: "PLACEHOLDER_DEEPEST_S1" } };
  const r = rig({ ids });
  const closed = r.gb.view(deepAll);
  assert.equal(closed.status, "closed");
  assert.deepEqual([...closed.entries], []);
  assert.equal(r.gb.view(deepAll), closed);
  assert.equal(r.gb.view({ board: "combo", scope: "all", season: 1 }), null);
  assert.equal(r.gb.view({ board: "deep", scope: "friends", season: 1 }).status, "closed");
  assert.equal(r.gb.view({ board: "deep", scope: "all", season: 7 }).status, "closed");
  await flush();
  assert.deepEqual(r.args, []);
  assert.equal(r.changes(), 0);
  assert.equal(r.gb.view({ board: "days", scope: "all", season: 1 }).status, "loading");
  assert.equal(r.args.length, 2, "the other boards still fetch");
});

test("FRIENDS with consent granted: a silent access check, then the friends top 10 and the player's friends score", async () => {
  const r = rig();
  const friends = { board: "deep", scope: "friends", season: 1 };
  assert.equal(r.gb.view(friends).status, "loading");
  await flush();
  assert.deepEqual(r.args, [
    ["friendsAccess", { request: false }],
    ["loadTopScores", { leaderboardId: DEEP, collection: "friends", maxResults: 10 }],
    ["loadPlayerScore", { leaderboardId: DEEP, collection: "friends" }],
  ]);
  const snap = r.gb.view(friends);
  assert.equal(snap.status, "ready");
  assert.equal(snap.scope, "friends");
  assert.deepEqual(snap.entries.map((e) => e.handle), ["Rival 0", "Rival 3", "Rival 6", "Rival 9", FAKE_PLAYER.displayName]);
  assert.ok(snap.entries.every((e) => e.friend !== e.you));
  assert.equal(snap.you.rank, 5);
  assert.equal(snap.you.friend, false);
  assert.equal(snap.total, 5);
});

test("FRIENDS with consent required: a consent snapshot and no score call", async () => {
  const r = rig({ friendsConsent: "required" });
  const friends = { board: "deep", scope: "friends", season: 1 };
  r.gb.view(friends);
  await flush();
  const snap = r.gb.view(friends);
  assert.equal(snap.status, "consent");
  assert.deepEqual([...snap.entries], []);
  assert.equal(snap.you, null);
  assert.deepEqual(r.args, [["friendsAccess", { request: false }]]);
  assert.equal(r.changes(), 1);
  assert.equal(r.gb.view(friends), snap);
  assert.equal(r.args.length, 1);
});

test("FRIENDS when friendsAccess is unavailable: unreachable", async () => {
  const r = rig({ provider: stub({ friendsAccess: async () => "unavailable" }) });
  const friends = { board: "deep", scope: "friends", season: 1 };
  r.gb.view(friends);
  await flush();
  assert.equal(r.gb.view(friends).status, "unreachable");
  assert.deepEqual(r.names(), ["friendsAccess"]);
});

test("requestFriendsAccess: one consent request at a time; granted drops the friends snapshots and calls onChange", async () => {
  const r = rig({ friendsConsent: "required", interactive: "accept" });
  const friends = { board: "deep", scope: "friends", season: 1 };
  r.gb.view(friends);
  r.gb.view(deepAll);
  await flush();
  const all = r.gb.view(deepAll);
  assert.equal(r.gb.view(friends).status, "consent");
  const before = r.changes();
  const a = r.gb.requestFriendsAccess();
  const b = r.gb.requestFriendsAccess();
  assert.deepEqual(await Promise.all([a, b]), ["granted", "granted"]);
  assert.deepEqual(
    r.args.filter(([m, o]) => m === "friendsAccess" && o && o.request === true),
    [["friendsAccess", { request: true }]],
  );
  assert.equal(r.changes(), before + 1);
  assert.equal(r.gb.view(deepAll), all, "the ALL snapshots are kept");
  assert.equal(r.gb.view(friends).status, "loading");
  await flush();
  const snap = r.gb.view(friends);
  assert.equal(snap.status, "ready");
  assert.equal(snap.entries.length, 5);
});

test("requestFriendsAccess declined: resolves required, the consent snapshot stays, nothing else is called", async () => {
  const r = rig({ friendsConsent: "decline" });
  const friends = { board: "deep", scope: "friends", season: 1 };
  r.gb.view(friends);
  await flush();
  const consent = r.gb.view(friends);
  const before = r.changes();
  assert.equal(await r.gb.requestFriendsAccess(), "required");
  await flush();
  assert.equal(r.gb.view(friends), consent);
  assert.deepEqual(r.args, [
    ["friendsAccess", { request: false }],
    ["friendsAccess", { request: true }],
  ]);
  assert.equal(r.changes(), before);
});

test("requestFriendsAccess resolves unavailable when the provider throws", async () => {
  const r = rig({
    provider: stub({
      friendsAccess: async () => {
        throw new Error("no");
      },
    }),
  });
  assert.equal(await r.gb.requestFriendsAccess(), "unavailable");
});

test("a fetch that settles after the player stopped competing is discarded", async () => {
  const r = rig();
  assert.equal(r.gb.view(deepAll).status, "loading");
  r.setActive(false);
  await flush();
  assert.equal(r.changes(), 0);
  assert.equal(r.gb.view(deepAll), null);
  r.setActive(true);
  assert.equal(r.gb.view(deepAll).status, "loading", "nothing was cached");
  assert.equal(r.args.length, 4, "a fresh fetch starts");
  await flush();
  assert.equal(r.gb.view(deepAll).status, "ready");
});

test("a background refresh discarded after going inactive keeps the old snapshot and can refresh again", async () => {
  const r = rig();
  r.gb.view(deepAll);
  await flush();
  const ready = r.gb.view(deepAll);
  r.advance(300001);
  r.gb.view(deepAll);
  r.setActive(false);
  await flush();
  assert.equal(r.changes(), 1);
  r.setActive(true);
  assert.equal(r.gb.view(deepAll), ready);
  assert.equal(r.args.length, 6, "the in-flight mark was released, so a new refresh starts");
});

test("clear() drops every snapshot and discards fetches already in flight", async () => {
  const r = rig();
  r.gb.view(deepAll);
  r.gb.clear();
  await flush();
  assert.equal(r.changes(), 0);
  assert.equal(r.gb.view(deepAll).status, "loading");
  await flush();
  assert.equal(r.gb.view(deepAll).status, "ready");
  r.gb.clear();
  assert.equal(r.gb.view(deepAll).status, "loading");
});

test("a throwing onChange never breaks the controller", async () => {
  const r = rig({
    onChange: () => {
      throw new Error("redraw failed");
    },
  });
  r.gb.view(deepAll);
  await flush();
  assert.equal(r.gb.view(deepAll).status, "ready");
});

test("each season has its own cache and the provider only sees that season's ids", async () => {
  const ids = devLeaderboardIds({ 1: {}, 2: {} });
  const r = rig({ ids, boards: { [ids[1].deep]: rivals(3), [ids[2].deep]: rivals(2) } });
  r.gb.view({ board: "deep", scope: "all", season: 2 });
  await flush();
  assert.ok(r.args.every(([, o]) => o.leaderboardId === ids[2].deep));
  const s2 = r.gb.view({ board: "deep", scope: "all", season: 2 });
  assert.equal(s2.season, 2);
  assert.equal(s2.entries.length, 2);
  assert.equal(r.gb.view({ board: "deep", scope: "all", season: 1 }).status, "loading");
  await flush();
  assert.equal(r.gb.view({ board: "deep", scope: "all", season: 1 }).entries.length, 3);
});

test("source pins: no DOM, storage or network; consent is requested in exactly one place", async () => {
  const fs = await import("node:fs");
  const src = fs
    .readFileSync(new URL("../../src/browser/globalBoards.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const bad of ["window.", "document.", "localStorage", "fetch(", "XMLHttpRequest", "WebSocket", "Preferences", "__mz"]) {
    assert.ok(!src.includes(bad), bad);
  }
  assert.equal(src.match(/request:\s*true/g).length, 1);
  assert.ok(/provider\.loadTopScores\(/.test(src));
  assert.ok(/decodeTag\(/.test(src));
});
