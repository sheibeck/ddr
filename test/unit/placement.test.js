// test/unit/placement.test.js
//
// Phase 68 (PLACE-01/02; D-10..D-13, D-03) — src/browser/placement.js, the
// pure view model that turns a DEEPEST rank into the THAT IS THAT rank quip,
// the one deferred rail card for runs a flush delivered later, and the
// season-drop Oracle line. Covers the ordinal text, the band boundaries
// (1/2, 10/11, 100/101), the D-13 worked example, the standing band for a
// run that did not beat the best, the null cases (D-11: incomplete means
// nothing), the card variants and hash determinism.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ordinalText,
  placementBand,
  placementLine,
  deferredPlacementCard,
  seasonDropLine,
} from "../../src/browser/placement.js";
import { PLACEMENT_LINES, PLACEMENT_CARD, SEASON_DROP_LINES } from "../../content/placement.js";

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
  assert.equal(ordinalText(3117), "3,117th");
  assert.equal(ordinalText(1000000), "1,000,000th");
  assert.equal(ordinalText(1001), "1,001st");
});

// ─── placementBand ───────────────────────────────────────────────────────────

test("placementBand: the band switches exactly at 1/2, 10/11 and 100/101", () => {
  assert.equal(placementBand(1), "first");
  assert.equal(placementBand(2), "ten");
  assert.equal(placementBand(10), "ten");
  assert.equal(placementBand(11), "hundred");
  assert.equal(placementBand(100), "hundred");
  assert.equal(placementBand(101), "rest");
  assert.equal(placementBand(9044), "rest");
});

// ─── placementLine ───────────────────────────────────────────────────────────

test("placementLine: the D-13 worked example", () => {
  assert.equal(
    placementLine({ rank: 3117, total: 9044, newBest: true, hash: H0 }),
    "You placed 3,117th of 9,044. The 3,116 ahead of you are also dead.",
  );
});

test("placementLine: a rest rank is a filled PLACEMENT_LINES.rest line", () => {
  const vars = { rank: "3,117th", total: "9,044", ahead: "3,116" };
  const allowed = PLACEMENT_LINES.rest.map((t) => fill(t, vars));
  for (const hash of [H0, H1, "deadbeef", "0000000a", "ffffffff"]) {
    const line = placementLine({ rank: 3117, total: 9044, newBest: true, hash });
    assert.ok(allowed.includes(line), `${hash} -> ${line}`);
  }
});

test("placementLine: rank 1 uses the first band", () => {
  assert.equal(
    placementLine({ rank: 1, total: 9044, newBest: true, hash: H0 }),
    fill(PLACEMENT_LINES.first[0], { total: "9,044" }),
  );
  const allowed = PLACEMENT_LINES.first.map((t) => fill(t, { total: "9,044" }));
  assert.ok(allowed.includes(placementLine({ rank: 1, total: 9044, newBest: true, hash: "abcdef12" })));
});

test("placementLine: boundary ranks land in their bands (2, 10, 11, 100, 101)", () => {
  const bandOf = (rank) => {
    const line = placementLine({ rank, total: 5000, newBest: true, hash: H0 });
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
    placementLine({ rank: 57, total: 1200, newBest: true, hash: "00000002" }),
    "You placed 57th of 1,200. The 56 ahead of you would like a word. They cannot have one.",
  );
});

test("placementLine: newBest false uses the standing band at any rank, including 1", () => {
  for (const rank of [1, 7, 42, 3117]) {
    const vars = { rank: ordinalText(rank), total: "9,044" };
    const allowed = PLACEMENT_LINES.standing.map((t) => fill(t, vars));
    const line = placementLine({ rank, total: 9044, newBest: false, hash: H1 });
    assert.ok(allowed.includes(line), `rank ${rank} -> ${line}`);
    assert.doesNotMatch(line, /you placed/i);
  }
  assert.equal(
    placementLine({ rank: 412, total: 9044, newBest: false, hash: H0 }),
    "This one did not beat your best. Your best still holds 412th of 9,044.",
  );
});

test("placementLine: newBest null or missing uses the rank band", () => {
  const want = "You placed 3,117th of 9,044. The 3,116 ahead of you are also dead.";
  assert.equal(placementLine({ rank: 3117, total: 9044, newBest: null, hash: H0 }), want);
  assert.equal(placementLine({ rank: 3117, total: 9044, hash: H0 }), want);
});

test("placementLine: returns null for an incomplete or invalid rank (D-11)", () => {
  for (const rank of [0, -1, 1.5, "3", null, undefined, NaN, Infinity]) {
    assert.equal(placementLine({ rank, total: 9044, newBest: true, hash: H0 }), null, `rank ${String(rank)}`);
  }
});

test("placementLine: returns null for an invalid total, a total below rank, or a non-object input", () => {
  for (const total of [null, undefined, 0, -5, 2.5, "9044", 3116]) {
    assert.equal(placementLine({ rank: 3117, total, newBest: true, hash: H0 }), null, `total ${String(total)}`);
  }
  for (const input of [null, undefined, 3117, "3117th", [], true]) {
    assert.equal(placementLine(input), null, `input ${JSON.stringify(input)}`);
  }
});

test("placementLine: rank equal to total is valid (last place)", () => {
  const line = placementLine({ rank: 250, total: 250, newBest: true, hash: H0 });
  assert.equal(line, "You placed 250th of 250. The 249 ahead of you are also dead.");
});

test("placementLine: deterministic by hash; different hashes can differ; an invalid hash picks index 0", () => {
  const input = { rank: 3117, total: 9044, newBest: true, hash: "1234abcd" };
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
    for (const newBest of [true, false, null]) {
      for (const hash of [H0, H1, "00000002", "00000003", "cafebabe"]) {
        const line = placementLine({ rank, total: 9044, newBest, hash });
        assert.equal(typeof line, "string");
        assert.doesNotMatch(line, /[{}]/, `${rank}/${newBest}/${hash} -> ${line}`);
      }
    }
  }
});

// ─── deferredPlacementCard ───────────────────────────────────────────────────

test("deferredPlacementCard: one run, new best", () => {
  const card = deferredPlacementCard({ count: 1, rank: 412, total: 9044, newBest: true, hash: "deadbeef" });
  assert.deepStrictEqual(card, {
    title: "THE LEDGER CAUGHT UP",
    line: "Your earlier death placed 412th of 9,044 on DEEPEST.",
    tone: "good",
    hold: 12000,
  });
  assert.ok(Object.isFrozen(card));
});

test("deferredPlacementCard: several runs use the many line with {count}", () => {
  const card = deferredPlacementCard({ count: 3, rank: 88, total: 9044, newBest: true, hash: H0 });
  assert.equal(card.line, "3 earlier deaths reached the ledger. The best placed 88th of 9,044 on DEEPEST.");
  assert.equal(card.title, PLACEMENT_CARD.title);
  assert.equal(card.tone, PLACEMENT_CARD.tone);
  assert.equal(card.hold, PLACEMENT_CARD.hold);
});

test("deferredPlacementCard: newBest false uses oneStanding / manyStanding", () => {
  assert.equal(
    deferredPlacementCard({ count: 1, rank: 412, total: 9044, newBest: false, hash: H0 }).line,
    "Your earlier death reached the ledger. It did not beat your best, which holds 412th of 9,044.",
  );
  assert.equal(
    deferredPlacementCard({ count: 1200, rank: 1, total: 9044, newBest: false, hash: H0 }).line,
    "1,200 earlier deaths reached the ledger. None beat your best, which holds 1st of 9,044.",
  );
});

test("deferredPlacementCard: returns null for a bad count, a missing rank or total, or total below rank", () => {
  const ok = { count: 2, rank: 412, total: 9044, newBest: true, hash: H0 };
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
    for (const newBest of [true, false, null]) {
      const card = deferredPlacementCard({ count, rank: 7, total: 30, newBest, hash: "0badf00d" });
      assert.doesNotMatch(card.line, /[{}]/);
    }
  }
});

// ─── seasonDropLine ──────────────────────────────────────────────────────────

test("seasonDropLine: singular, plural with the count, and null below 1 or for a non-integer", () => {
  assert.equal(seasonDropLine(1), SEASON_DROP_LINES.one);
  assert.equal(
    seasonDropLine(4),
    "4 unsent deaths belonged to a closed season. That ledger is sealed, so they were let go.",
  );
  assert.match(seasonDropLine(2500), /^2,500 unsent deaths/);
  for (const c of [0, -1, "2", 1.5, null, undefined, NaN]) {
    assert.equal(seasonDropLine(c), null, `count ${String(c)}`);
  }
  assert.doesNotMatch(seasonDropLine(4), /[{}<>&]/);
});
