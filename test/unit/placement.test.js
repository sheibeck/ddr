// test/unit/placement.test.js
//
// Phase 85 (ACCT-04; 85-CONTEXT group 2) — src/browser/placement.js, the
// pure view model that turns our own board's DEPTH rank into the THAT IS
// THAT rank line ("You placed 12th of 340.") and the one deferred rail
// card for runs a flush acknowledged after the death panel closed. Covers
// the ordinal text, the band boundaries (1/2, 10/11, 100/101), the null
// cases (an incomplete rank means nothing), the card variants, hash
// determinism, and placementOutcome's line-vs-card split. Every run has
// its own rank now, so there is no "standing" band and no season-drop
// line — those went with the retired Play Games board.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ordinalText,
  placementBand,
  placementLine,
  deferredPlacementCard,
  placementOutcome,
} from "../../src/browser/placement.js";
import { PLACEMENT_LINES, PLACEMENT_CARD } from "../../content/placement.js";

// "00000000" picks index 0 of any bank; "00000001" picks index 1 (bank > 1).
const H0 = "00000000";
const H1 = "00000001";

/** The line a template yields once its tokens are filled by hand. */
function fill(t, vars) {
  return t.replace(/\{(rank|total|ahead|count)\}/g, (_, k) => vars[k]);
}

// ─── ordinalText ─────────────────────────────────────────────────────────────

test("ordinalText: the st/nd/rd/th suffixes, including the teens", () => {
  const cases = {
    1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 11: "11th", 12: "12th", 13: "13th",
    21: "21st", 22: "22nd", 23: "23rd", 101: "101st", 111: "111th", 112: "112th", 113: "113th",
  };
  for (const [n, want] of Object.entries(cases)) assert.equal(ordinalText(Number(n)), want, `ordinalText(${n})`);
});

test("ordinalText: groups digits en-US", () => {
  assert.equal(ordinalText(340), "340th");
  assert.equal(ordinalText(1000000), "1,000,000th");
  assert.equal(ordinalText(1001), "1,001st");
});

test("ordinalText: never throws; a non-integer or negative input gives an empty string", () => {
  for (const x of [undefined, null, "3", 1.5, -1, NaN, Infinity, {}]) {
    assert.equal(ordinalText(x), "", `ordinalText(${String(x)})`);
  }
});

// ─── placementBand ───────────────────────────────────────────────────────────

test("placementBand: the band switches exactly at 1/2, 10/11 and 100/101", () => {
  assert.equal(placementBand(1), "first");
  assert.equal(placementBand(2), "ten");
  assert.equal(placementBand(10), "ten");
  assert.equal(placementBand(11), "hundred");
  assert.equal(placementBand(100), "hundred");
  assert.equal(placementBand(101), "rest");
  assert.equal(placementBand(340), "rest");
});

// ─── placementLine ───────────────────────────────────────────────────────────

test("placementLine: the canonical worked example (\"You placed 12th of 340.\")", () => {
  const line = placementLine({ rank: 12, total: 340, hash: H0 });
  assert.match(line, /^You placed 12th of 340\./);
});

test("placementLine: a rest rank is a filled PLACEMENT_LINES.rest line", () => {
  const vars = { rank: "3,117th", total: "9,044", ahead: "3,116" };
  const allowed = PLACEMENT_LINES.rest.map((t) => fill(t, vars));
  for (const hash of [H0, H1, "deadbeef", "0000000a", "ffffffff"]) {
    const line = placementLine({ rank: 3117, total: 9044, hash });
    assert.ok(allowed.includes(line), `${hash} -> ${line}`);
  }
});

test("placementLine: rank 1 uses the first band", () => {
  assert.equal(
    placementLine({ rank: 1, total: 9044, hash: H0 }),
    fill(PLACEMENT_LINES.first[0], { total: "9,044" }),
  );
  const allowed = PLACEMENT_LINES.first.map((t) => fill(t, { total: "9,044" }));
  assert.ok(allowed.includes(placementLine({ rank: 1, total: 9044, hash: "abcdef12" })));
});

test("placementLine: boundary ranks land in their bands (2, 10, 11, 100, 101)", () => {
  const bandOf = (rank) => {
    const line = placementLine({ rank, total: 5000, hash: H0 });
    for (const [band, bank] of Object.entries(PLACEMENT_LINES)) {
      const vars = { rank: ordinalText(rank), total: "5,000", ahead: (rank - 1).toLocaleString("en-US") };
      if (bank.some((t) => fill(t, vars) === line)) return band;
    }
    return null;
  };
  assert.equal(bandOf(2), "ten");
  assert.equal(bandOf(10), "ten");
  assert.equal(bandOf(11), "hundred");
  assert.equal(bandOf(100), "hundred");
  assert.equal(bandOf(101), "rest");
});

test("placementLine: the {ahead} token is rank minus one, grouped (hundred band)", () => {
  // hundred[2] carries {ahead}; bank length 3, so hash 2 picks it.
  assert.equal(
    placementLine({ rank: 57, total: 1200, hash: "00000002" }),
    "You placed 57th of 1,200. The 56 ahead of you would like a word. They cannot have one.",
  );
});

test("placementLine: an extra newBest field is ignored — only rank decides the band", () => {
  const withNewBest = placementLine({ rank: 3117, total: 9044, newBest: false, hash: H0 });
  const without = placementLine({ rank: 3117, total: 9044, hash: H0 });
  assert.equal(withNewBest, without);
  assert.match(withNewBest, /^You placed 3,117th of 9,044\./);
});

test("placementLine: returns null for an incomplete or invalid rank", () => {
  for (const rank of [0, -1, 1.5, "3", null, undefined, NaN, Infinity]) {
    assert.equal(placementLine({ rank, total: 9044, hash: H0 }), null, `rank ${String(rank)}`);
  }
});

test("placementLine: returns null for an invalid total, a total below rank, or a non-object input", () => {
  for (const total of [null, undefined, 0, -5, 2.5, "9044", 3116]) {
    assert.equal(placementLine({ rank: 3117, total, hash: H0 }), null, `total ${String(total)}`);
  }
  for (const input of [null, undefined, 3117, "3117th", [], true]) {
    assert.equal(placementLine(input), null, `input ${JSON.stringify(input)}`);
  }
});

test("placementLine: rank equal to total is valid (last place)", () => {
  const line = placementLine({ rank: 250, total: 250, hash: H0 });
  assert.equal(line, "You placed 250th of 250. The 249 ahead of you are also dead.");
});

test("placementLine: deterministic by hash; different hashes can differ; an invalid hash picks index 0", () => {
  const input = { rank: 3117, total: 9044, hash: "1234abcd" };
  assert.equal(placementLine(input), placementLine({ ...input }));
  const a = placementLine({ ...input, hash: H0 });
  const b = placementLine({ ...input, hash: H1 });
  assert.notEqual(a, b);
  for (const hash of [undefined, null, "", "XYZ", "123", "0000000g", 7]) {
    assert.equal(placementLine({ ...input, hash }), a, `hash ${String(hash)}`);
  }
});

test("placementLine: never leaves a {token} behind across bands and hashes", () => {
  for (const rank of [1, 2, 9, 10, 11, 50, 99, 100, 101, 3117]) {
    for (const hash of [H0, H1, "00000002", "00000003", "cafebabe"]) {
      const line = placementLine({ rank, total: 9044, hash });
      assert.equal(typeof line, "string");
      assert.doesNotMatch(line, /[{}]/, `${rank}/${hash} -> ${line}`);
    }
  }
});

// ─── deferredPlacementCard ───────────────────────────────────────────────────

test("deferredPlacementCard: one run", () => {
  const card = deferredPlacementCard({ count: 1, rank: 412, total: 9044, hash: "deadbeef" });
  assert.deepStrictEqual(card, {
    title: "THE LEDGER CAUGHT UP",
    line: "Your earlier death placed 412th of 9,044 on DEPTH.",
    tone: "good",
    hold: 12000,
  });
  assert.ok(Object.isFrozen(card));
});

test("deferredPlacementCard: several runs use the many line with {count}", () => {
  const card = deferredPlacementCard({ count: 3, rank: 88, total: 9044, hash: H0 });
  assert.equal(card.line, "3 earlier deaths reached the ledger. The best placed 88th of 9,044 on DEPTH.");
  assert.equal(card.title, PLACEMENT_CARD.title);
  assert.equal(card.tone, PLACEMENT_CARD.tone);
  assert.equal(card.hold, PLACEMENT_CARD.hold);
});

test("deferredPlacementCard: an extra newBest field is ignored", () => {
  const withNewBest = deferredPlacementCard({ count: 1, rank: 412, total: 9044, newBest: false, hash: H0 });
  const without = deferredPlacementCard({ count: 1, rank: 412, total: 9044, hash: H0 });
  assert.deepStrictEqual(withNewBest, without);
});

test("deferredPlacementCard: returns null for a bad count, a missing rank or total, or total below rank", () => {
  const ok = { count: 2, rank: 412, total: 9044, hash: H0 };
  assert.ok(deferredPlacementCard(ok));
  for (const count of [0, -1, 1.5, "2", null, undefined]) {
    assert.equal(deferredPlacementCard({ ...ok, count }), null, `count ${String(count)}`);
  }
  assert.equal(deferredPlacementCard({ ...ok, rank: undefined }), null);
  assert.equal(deferredPlacementCard({ ...ok, rank: 0 }), null);
  assert.equal(deferredPlacementCard({ ...ok, total: undefined }), null);
  assert.equal(deferredPlacementCard({ ...ok, total: 411 }), null);
  assert.equal(deferredPlacementCard(null), null);
  assert.equal(deferredPlacementCard("card"), null);
});

test("deferredPlacementCard: never leaves a {token} behind", () => {
  for (const count of [1, 2, 40]) {
    const card = deferredPlacementCard({ count, rank: 7, total: 30, hash: "0badf00d" });
    assert.doesNotMatch(card.line, /[{}]/);
  }
});

// ─── placementOutcome ────────────────────────────────────────────────────────
//
// placementOutcome({ live, rest, liveHash, panelUp }) is the one rule that
// decides whether an acknowledged batch draws the fading rank line on the
// death panel or parks a rail card for later: a valid live run whose hash
// still matches the panel's own liveDeathHash, drawn while that panel is up,
// takes the line (and rest, if any, still parks its own card); every other
// combination — the panel already gone, the hashes no longer matching, no
// live run at all — folds into one card. Never throws on garbage.

const LIVE = Object.freeze({ hash: "11111111", rank: 12, total: 340 });
const REST = Object.freeze({ count: 2, hash: "22222222", rank: 40, total: 340 });

test("placementOutcome: a matching live run with the panel up draws the line; a rest still parks its own card", () => {
  const out = placementOutcome({ live: LIVE, rest: REST, liveHash: LIVE.hash, panelUp: true });
  assert.deepStrictEqual(out.line, { hash: LIVE.hash, line: placementLine({ rank: LIVE.rank, total: LIVE.total, hash: LIVE.hash }) });
  assert.match(out.line.line, /^You placed 12th of 340\./);
  assert.deepStrictEqual(out.card, deferredPlacementCard({ count: REST.count, rank: REST.rank, total: REST.total, hash: REST.hash }));
});

test("placementOutcome: a matching live run with the panel up and no rest draws the line and parks no card", () => {
  const out = placementOutcome({ live: LIVE, rest: null, liveHash: LIVE.hash, panelUp: true });
  assert.equal(out.line.line, placementLine({ rank: LIVE.rank, total: LIVE.total, hash: LIVE.hash }));
  assert.equal(out.card, null);
});

test("placementOutcome: the same live run once the panel is gone parks one card (count 1) and draws no line", () => {
  const out = placementOutcome({ live: LIVE, rest: null, liveHash: LIVE.hash, panelUp: false });
  assert.equal(out.line, null);
  assert.deepStrictEqual(out.card, deferredPlacementCard({ count: 1, rank: LIVE.rank, total: LIVE.total, hash: LIVE.hash }));
});

test("placementOutcome: live plus rest with the panel gone folds into one card (count + 1, the smaller/better rank)", () => {
  const out = placementOutcome({ live: LIVE, rest: REST, liveHash: LIVE.hash, panelUp: false });
  assert.equal(out.line, null);
  // LIVE.rank (12) is smaller/better than REST.rank (40) -> the merged card uses LIVE's rank.
  assert.deepStrictEqual(out.card, deferredPlacementCard({ count: REST.count + 1, rank: LIVE.rank, total: LIVE.total, hash: LIVE.hash }));
});

test("placementOutcome: when rest is the better rank, the merged card uses rest's rank", () => {
  const worseLive = Object.freeze({ hash: "33333333", rank: 200, total: 340 });
  const betterRest = Object.freeze({ count: 5, hash: "44444444", rank: 3, total: 340 });
  const out = placementOutcome({ live: worseLive, rest: betterRest, liveHash: worseLive.hash, panelUp: false });
  assert.equal(out.line, null);
  assert.deepStrictEqual(out.card, deferredPlacementCard({ count: betterRest.count + 1, rank: betterRest.rank, total: betterRest.total, hash: betterRest.hash }));
});

test("placementOutcome: a live hash that no longer matches liveDeathHash parks a card instead of drawing", () => {
  const out = placementOutcome({ live: LIVE, rest: null, liveHash: "99999999", panelUp: true });
  assert.equal(out.line, null);
  assert.deepStrictEqual(out.card, deferredPlacementCard({ count: 1, rank: LIVE.rank, total: LIVE.total, hash: LIVE.hash }));
});

test("placementOutcome: only a rest report parks a card; nothing draws", () => {
  const out = placementOutcome({ live: null, rest: REST, liveHash: null, panelUp: true });
  assert.equal(out.line, null);
  assert.deepStrictEqual(out.card, deferredPlacementCard({ count: REST.count, rank: REST.rank, total: REST.total, hash: REST.hash }));
});

test("placementOutcome: nothing valid gives { line: null, card: null }; never throws on garbage", () => {
  const garbage = [
    undefined, null, {}, { live: null, rest: null },
    { live: { rank: 0, total: 340, hash: LIVE.hash }, rest: null, liveHash: LIVE.hash, panelUp: true },
    { live: "not an object", rest: 5, liveHash: 7, panelUp: "yes" },
    { live: { rank: NaN, total: NaN }, rest: { count: -1, rank: -1, total: -1 } },
    "placement", 42, [],
  ];
  for (const input of garbage) {
    const out = placementOutcome(input);
    assert.deepStrictEqual(out, { line: null, card: null }, `input ${JSON.stringify(input)}`);
  }
});
