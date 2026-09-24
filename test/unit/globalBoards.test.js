// test/unit/globalBoards.test.js
//
// Phase 68 (PGS-05, D-05..D-07, D-09): the global and friends boards'
// fetch-and-cache controller. The first half proves the pure builders:
// toGlobalEntry turns a normalized Play Games score into a frozen, decoded
// GlobalEntry (YOU/FRIEND marking, anon keys, malformed tags keep the row)
// and snapshotOf builds the deep-frozen GlobalSnapshot contract 68-06's
// boardsView consumes. Entries keep the order Play Games returned; nothing
// here re-sorts (PGS-05 adjacency).

import test from "node:test";
import assert from "node:assert/strict";

import {
  GLOBAL_TTL_MS,
  GLOBAL_RETRY_MS,
  TOP_N,
  LINEAGE_SAMPLE_N,
  toGlobalEntry,
  snapshotOf,
} from "../../src/browser/globalBoards.js";
import { encodeTag, decodeTag } from "../../src/browser/scoreTag.js";

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

test("constants: 5-minute TTL, 30-second retry, top 10, 25-score LINEAGE sample", () => {
  assert.equal(GLOBAL_TTL_MS, 300000);
  assert.equal(GLOBAL_RETRY_MS, 30000);
  assert.equal(TOP_N, 10);
  assert.equal(LINEAGE_SAMPLE_N, 25);
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
      sampled: null,
      stale: false,
    },
  );
  assert.ok(Object.isFrozen(s));
  assert.ok(Object.isFrozen(s.entries));
});

test("snapshotOf: a ready snapshot keeps its entries, you, total, sampled and stale", () => {
  const entries = [0, 1].map((i) => toGlobalEntry(score({ rank: i + 1, playerId: `p${i}` }), i, { meId: "me", scope: "all" }));
  const you = toGlobalEntry(score({ playerId: "me" }), 0, { meId: "me", scope: "all" });
  const s = snapshotOf({ status: "ready", board: "combo", scope: "all", season: 1, entries, you, total: 40, sampled: 2, stale: true });
  assert.equal(s.entries.length, 2);
  assert.equal(s.entries[0], entries[0]);
  assert.equal(s.you, you);
  assert.equal(s.total, 40);
  assert.equal(s.sampled, 2);
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

test("snapshotOf: junk total, sampled and stale fall back to their defaults", () => {
  const s = snapshotOf({ status: "ready", board: "deep", scope: "all", season: 1, total: -1, sampled: 1.5, stale: "yes" });
  assert.equal(s.total, null);
  assert.equal(s.sampled, null);
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
