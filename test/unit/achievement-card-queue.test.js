// test/unit/achievement-card-queue.test.js
//
// Phase 100 (AUI-01): the pending queue, the drain gate, the collapse rule and
// the Earned strip view in src/browser/achievementCard.js. Pure data in and out.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  emptyBannerQueue,
  bannerEnqueue,
  bannerNext,
  earnedStripView,
  achievementIconSrc,
  ACHIEVEMENT_CARD_COPY,
} from "../../src/browser/achievementCard.js";
import { ACHIEVEMENTS } from "../../content/achievements.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const CLEAR = Object.freeze({ ready: true, fighting: false, dead: false, fade: false, decision: false, railBusy: false });
const ORDER = ACHIEVEMENTS.map((e) => e.id);
const NAME = Object.fromEntries(ACHIEVEMENTS.map((e) => [e.id, e.name]));

function deepFrozen(v) {
  if (v === null || typeof v !== "object") return true;
  if (!Object.isFrozen(v)) return false;
  return Object.values(v).every(deepFrozen);
}

function unlocks(...ids) {
  return ids.map((id) => ({ id, at: 5 }));
}

function queueOf(...ids) {
  return bannerEnqueue(emptyBannerQueue(), unlocks(...ids));
}

test("emptyBannerQueue is frozen with an empty pending list", () => {
  const q = emptyBannerQueue();
  assert.deepEqual(q, { pending: [] });
  assert.ok(deepFrozen(q));
});

test("bannerEnqueue sorts by catalog list order and dedupes against what is pending", () => {
  const q1 = bannerEnqueue(emptyBannerQueue(), [{ id: "kills_beasts_t1", at: 5 }, { id: "depth_t1", at: 5 }]);
  assert.deepEqual(q1.pending, ["depth_t1", "kills_beasts_t1"]);
  assert.ok(deepFrozen(q1));
  assert.equal(bannerEnqueue(q1, unlocks("depth_t1")), q1, "same call repeat returns the very same queue");
  assert.equal(bannerEnqueue(q1, unlocks("kills_beasts_t1", "depth_t1")), q1);
  const q2 = bannerEnqueue(q1, unlocks("tourist", "depth_t1"));
  assert.deepEqual(q2.pending, ["depth_t1", "tourist", "kills_beasts_t1"]);
  assert.notEqual(q2, q1);
  assert.deepEqual(q1.pending, ["depth_t1", "kills_beasts_t1"], "the old queue is untouched");
});

test("bannerEnqueue adds nothing for unknown ids, malformed items and non-array payloads", () => {
  const q = queueOf("depth_t1");
  const bads = [
    unlocks("nope"),
    unlocks("Depth_T1"),
    unlocks(" depth_t2"),
    unlocks("depth_t2 "),
    [5, null, undefined, "depth_t2", {}, { id: 7 }, { id: null }, []],
    ["depth_t2", "tourist"], // reveal-style ids, not objects
    "depth_t2",
    undefined,
    null,
    5,
    {},
    { unlocks: unlocks("depth_t2") }, // the whole payload instead of its unlocks array
    { reveals: ["depth_t2"] },
  ];
  for (const bad of bads) {
    assert.equal(bannerEnqueue(q, bad), q, JSON.stringify(bad));
  }
  assert.deepEqual(q.pending, ["depth_t1"]);
});

test("a null, undefined or malformed queue reads as the empty queue and never throws", () => {
  for (const bad of [null, undefined, 5, "x", {}, { pending: "depth_t1" }, { pending: null }]) {
    assert.doesNotThrow(() => bannerEnqueue(bad, unlocks("tourist")));
    assert.deepEqual(bannerEnqueue(bad, unlocks("tourist")).pending, ["tourist"]);
    const r = bannerNext(bad, CLEAR);
    assert.equal(r.card, null);
    assert.equal(r.strip, null);
    assert.deepEqual(r.queue.pending, []);
  }
});

test("empty payload edges: no unlocks key, an empty array, null and undefined payloads leave the queue alone", () => {
  const q = emptyBannerQueue();
  for (const p of [undefined, null, {}, [], ""]) {
    assert.equal(bannerEnqueue(q, p), q);
  }
  const r = bannerNext(q, CLEAR);
  assert.equal(r.card, null);
  assert.equal(r.strip, null);
  assert.equal(r.queue, q, "nothing pending: the very same queue");
});

test("gate matrix: every blocker gives no card, no strip and the very same queue", () => {
  const q = queueOf("depth_t1", "kills_beasts_t1");
  const blockers = [
    { ...CLEAR, ready: false },
    { ...CLEAR, fighting: true },
    { ...CLEAR, fade: true },
    { ...CLEAR, decision: true },
    { ...CLEAR, railBusy: true },
    {},
    null,
    undefined,
    "ready",
    5,
    { fighting: false, dead: false, fade: false, decision: false, railBusy: false }, // ready missing
    { ...CLEAR, ready: 1 }, // only a strict true counts
    { ...CLEAR, ready: "true" },
  ];
  for (const ctx of blockers) {
    const r = bannerNext(q, ctx);
    assert.equal(r.card, null, JSON.stringify(ctx));
    assert.equal(r.strip, null, JSON.stringify(ctx));
    assert.equal(r.queue, q, JSON.stringify(ctx));
  }
  // a truthy-but-not-true blocker flag does not block (only strict true counts)
  const loose = bannerNext(q, { ...CLEAR, fighting: 1, fade: "yes" });
  assert.equal(loose.card.achievementId, "depth_t1");
});

test("all clear: the first id comes out as a card and the rest stay queued", () => {
  const q = queueOf("depth_t1", "kills_beasts_t1");
  const r = bannerNext(q, CLEAR);
  assert.equal(r.card.kind, "achievement");
  assert.equal(r.card.achievementId, "depth_t1");
  assert.equal(r.strip, null);
  assert.deepEqual(r.queue.pending, ["kills_beasts_t1"]);
  assert.deepEqual(q.pending, ["depth_t1", "kills_beasts_t1"], "input untouched");
  assert.ok(deepFrozen(r));
});

test("a store or loot screen is not a blocker: ready alone is enough", () => {
  const q = queueOf("tourist");
  const r = bannerNext(q, { ready: true });
  assert.equal(r.card.achievementId, "tourist");
});

test("a fight holds the queue and loses nothing", () => {
  const q = queueOf("depth_t1", "tourist");
  const held = bannerNext(q, { ...CLEAR, fighting: true });
  assert.equal(held.card, null);
  assert.equal(held.queue, q);
  const first = bannerNext(held.queue, CLEAR);
  assert.equal(first.card.achievementId, "depth_t1");
  const second = bannerNext(first.queue, CLEAR);
  assert.equal(second.card.achievementId, "tourist");
  assert.deepEqual(second.queue.pending, []);
});

test("collapse boundary: three pending are three cards, four are one summary", () => {
  let q = queueOf("kills_beasts_t1", "depth_t1", "tourist");
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const r = bannerNext(q, CLEAR);
    assert.equal(r.card.kind, "achievement");
    seen.push(r.card.achievementId);
    q = r.queue;
  }
  assert.deepEqual(seen, ["depth_t1", "tourist", "kills_beasts_t1"]);
  assert.deepEqual(q.pending, []);

  const four = queueOf("kills_beasts_t1", "depth_t1", "tourist", "special_snowflake");
  const r = bannerNext(four, CLEAR);
  assert.equal(r.card.kind, "achievement-many");
  assert.equal(r.card.opensList, true);
  assert.deepEqual(r.card.achievementIds, ["depth_t1", "tourist", "kills_beasts_t1", "special_snowflake"]);
  assert.deepEqual(r.card.lines.slice(1, 5).map((l) => l.text), r.card.achievementIds.map((id) => NAME[id]));
  assert.deepEqual(r.queue.pending, []);
  assert.equal(r.strip, null);

  for (const n of [5, 12]) {
    const big = bannerEnqueue(emptyBannerQueue(), unlocks(...ORDER.slice(0, n).reverse()));
    const s = bannerNext(big, CLEAR);
    assert.equal(s.card.kind, "achievement-many");
    assert.deepEqual(s.card.achievementIds, ORDER.slice(0, n));
    assert.deepEqual(s.queue.pending, []);
  }
});

test("none lost: 200 seeded scenarios drain to exactly the ids enqueued, each once", () => {
  let seed = 20261005;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let scenario = 0; scenario < 200; scenario++) {
    const n = 1 + Math.floor(rand() * 12);
    const pool = [...ORDER];
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    const calls = 1 + Math.floor(rand() * 4);
    const chunks = Array.from({ length: calls }, () => []);
    ids.forEach((id) => chunks[Math.floor(rand() * calls)].push(id));
    let q = emptyBannerQueue();
    for (const chunk of chunks) q = bannerEnqueue(q, unlocks(...chunk));
    const shown = [];
    for (let guard = 0; guard < 40 && q.pending.length > 0; guard++) {
      const r = bannerNext(q, CLEAR);
      assert.ok(r.card, `scenario ${scenario}: a card while something is pending`);
      if (r.card.kind === "achievement") shown.push(r.card.achievementId);
      else shown.push(...r.card.achievementIds);
      q = r.queue;
    }
    assert.deepEqual(q.pending, [], `scenario ${scenario} drained`);
    assert.deepEqual([...shown].sort(), [...ids].sort(), `scenario ${scenario}`);
    assert.equal(new Set(shown).size, shown.length, `scenario ${scenario}: each once`);
  }
});

test("death: the queue becomes the Earned strip, in list order, and empties", () => {
  const q = queueOf("unicorn", "depth_t1", "tourist");
  const r = bannerNext(q, { ...CLEAR, dead: true });
  assert.equal(r.card, null);
  assert.equal(r.strip.label, ACHIEVEMENT_CARD_COPY.strip.label);
  assert.deepEqual(r.strip.items, [
    { id: "depth_t1", name: NAME.depth_t1, iconSrc: achievementIconSrc("depth_t1") },
    { id: "unicorn", name: NAME.unicorn, iconSrc: achievementIconSrc("unicorn") },
    { id: "tourist", name: NAME.tourist, iconSrc: achievementIconSrc("tourist") },
  ]);
  assert.deepEqual(r.queue.pending, []);
  assert.ok(deepFrozen(r));
  const after = bannerNext(r.queue, CLEAR);
  assert.equal(after.card, null);
  assert.equal(after.strip, null);
});

test("death beats every other flag, including a fight still showing and a shell not ready", () => {
  const q = queueOf("depth_t1");
  for (const ctx of [
    { dead: true },
    { dead: true, ready: false },
    { dead: true, fighting: true },
    { ...CLEAR, dead: true, fighting: true, fade: true, decision: true, railBusy: true },
  ]) {
    const r = bannerNext(q, ctx);
    assert.equal(r.card, null);
    assert.deepEqual(r.strip.items.map((i) => i.id), ["depth_t1"], JSON.stringify(ctx));
    assert.deepEqual(r.queue.pending, []);
  }
});

test("death with nothing pending gives a null strip", () => {
  const r = bannerNext(emptyBannerQueue(), { dead: true });
  assert.equal(r.card, null);
  assert.equal(r.strip, null);
  assert.deepEqual(r.queue.pending, []);
});

test("earnedStripView: null for nothing resolvable, list order otherwise", () => {
  assert.equal(earnedStripView([]), null);
  assert.equal(earnedStripView(null), null);
  assert.equal(earnedStripView(undefined), null);
  assert.equal(earnedStripView(["nope"]), null);
  assert.equal(earnedStripView("depth_t1"), null);
  const v = earnedStripView(["unicorn", "depth_t1", "nope"]);
  assert.deepEqual(v.items.map((i) => i.id), ["depth_t1", "unicorn"]);
  assert.equal(v.label, ACHIEVEMENT_CARD_COPY.strip.label);
  assert.ok(deepFrozen(v));
});

test("results are deeply frozen and frozen inputs are accepted and never mutated", () => {
  const frozenUnlocks = Object.freeze(unlocks("tourist", "depth_t1").map((u) => Object.freeze(u)));
  const frozenQueue = Object.freeze({ pending: Object.freeze(["unicorn"]) });
  const q = bannerEnqueue(frozenQueue, frozenUnlocks);
  assert.deepEqual(q.pending, ["depth_t1", "unicorn", "tourist"]);
  assert.deepEqual(frozenQueue.pending, ["unicorn"]);
  assert.ok(deepFrozen(q));
  const r = bannerNext(q, CLEAR);
  assert.ok(deepFrozen(r));
  assert.ok(deepFrozen(bannerNext(q, { dead: true })));
});

test("reveals alone never produce a card, a queue entry or a strip item", () => {
  const payload = { unlocks: [], reveals: ["death_falling", "special_snowflake"], progress: [{ id: "depth_t2", value: 3, steps: 10 }] };
  const q = bannerEnqueue(emptyBannerQueue(), payload.unlocks);
  assert.deepEqual(q.pending, []);
  assert.equal(bannerNext(q, CLEAR).card, null);
  assert.equal(bannerNext(q, { dead: true }).strip, null);
});

test("encoding: names and lines come through as plain data, exactly as the catalog has them", () => {
  const q = queueOf("depth_t1");
  const { card } = bannerNext(q, CLEAR);
  const entry = ACHIEVEMENTS.find((e) => e.id === "depth_t1");
  assert.equal(card.lines[0].text, entry.name);
  assert.equal(card.lines[1].text, entry.line);
  for (const e of ACHIEVEMENTS) assert.match(e.name + e.line, /^[\x20-\x7e]*$/, e.id);
});

test("source purity: no window, document, timers, storage, fetch or Date; imports only the catalog and rail", () => {
  const raw = readFileSync(new URL("../../src/browser/achievementCard.js", import.meta.url), "utf8");
  const src = stripJs(raw);
  for (const word of ["window", "document", "setTimeout", "setInterval", "localStorage", "fetch", "Date", "Math.random"]) {
    assert.equal(new RegExp("\\b" + word.replace(".", "\\.") + "\\b").test(src), false, word);
  }
  const imports = [...src.matchAll(/^\s*import\b[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ["../../content/achievements.js", "./rail.js"]);
});
