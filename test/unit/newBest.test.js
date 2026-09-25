// test/unit/newBest.test.js
//
// Phase 65 (RUN-04): tests for src/browser/newBest.js, the pure view model
// that turns the death report's `{ first, newBests, summary }` shape into
// either nothing, a first-death line, or a NEW PERSONAL BEST block with
// ordered board rows and one quip (65-03-PLAN.md Task 2's <behavior> list).
//
// TDD RED: written before src/browser/newBest.js exists. All assertions
// below are pinned to the plan's <behavior> bullets and <action> formatting
// rules — no free-standing invention.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newBestView, newBestValueText } from "../../src/browser/newBest.js";
import { NEW_BEST_HEAD, NEW_BEST_LINES, FIRST_DEATH_LINES, BOARD_COPY } from "../../content/boards.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const baseSummary = {
  name: "Bram",
  race: "Dwarf",
  sub: "Court Mage",
  cls: "Fighter",
  level: 3,
  sp: 120,
  floor: 9,
  day: 14,
  steps: 312,
  gold: 1240,
  kills: 23,
  cause: "combat",
  note: "cut down by a Rat",
  epitaph: "Went toe to toe with a Rat and lost by roughly one toe.",
  when: "2026-09-23T00:00:00.000Z",
  season: 1,
  seed: "abc123",
  acts: 42,
  hash: "0000000a",
};

test("newBestView(null | undefined | non-object) returns null", () => {
  assert.equal(newBestView(null), null);
  assert.equal(newBestView(undefined), null);
  assert.equal(newBestView("x"), null);
});

test("newBestView with first:false and no newBests stays silent (null)", () => {
  assert.equal(newBestView({ first: false, newBests: [], summary: baseSummary }), null);
});

test("newBestView with first:true returns a head:null, rows:[] block with a FIRST_DEATH_LINES quip", () => {
  const view = newBestView({ first: true, newBests: [], summary: baseSummary });
  assert.ok(view);
  assert.equal(view.head, null);
  assert.deepStrictEqual(view.rows, []);
  assert.ok(FIRST_DEATH_LINES.includes(view.quip), `expected quip to be a FIRST_DEATH_LINES entry, got: ${view.quip}`);
});

test("newBestView with several boards returns ordered rows (mock tab order) and one NEW_BEST_LINES quip", () => {
  const summary = { ...baseSummary, floor: 9, steps: 312, kills: 23, hash: "0000000a" };
  const view = newBestView({ first: false, newBests: ["kills", "deep"], summary });
  assert.ok(view);
  assert.equal(view.head, NEW_BEST_HEAD);
  assert.deepStrictEqual(view.rows, [
    "DEEPEST DESCENT · floor 9",
    "MOST KILLS · 23 kills",
  ]);
  const expectedPick = (parseInt(summary.hash, 16) >>> 0) % NEW_BEST_LINES.length;
  assert.equal(view.quip, NEW_BEST_LINES[expectedPick]);
});

test("newBestValueText formats every board id per the plan's rules; the retired LEANEST id returns \"\" (BOARD-17)", () => {
  assert.equal(newBestValueText("deep", { floor: 9 }), "floor 9");
  assert.equal(newBestValueText("lean", { floor: 9, steps: 312 }), "");
  // Phase 70 (D-10): LINEAGE reads race + sub-class, never the base class.
  assert.equal(newBestValueText("combo", { race: "Dwarven", sub: "Knight", cls: "Fighter", floor: 4 }), "Dwarven Knight · floor 4");
  assert.equal(newBestValueText("days", { day: 1 }), "1 day");
  assert.equal(newBestValueText("days", { day: 14 }), "14 days");
  assert.equal(newBestValueText("kills", { kills: 1 }), "1 kill");
  assert.equal(newBestValueText("kills", { kills: 23 }), "23 kills");
  assert.equal(newBestValueText("purse", { gold: 1240 }), "1,240 wilmst");
  assert.equal(newBestValueText("bogus", {}), "");
  assert.equal(newBestValueText("yard", {}), "");
});

test("Unknown ids (yard, bogus) in newBests are skipped; only-unknown + first:false stays silent", () => {
  const summary = { ...baseSummary };
  assert.equal(newBestView({ first: false, newBests: ["yard", "bogus"], summary }), null);

  const view = newBestView({ first: false, newBests: ["yard", "deep", "bogus"], summary });
  assert.ok(view);
  assert.deepStrictEqual(view.rows, [`DEEPEST DESCENT · floor ${summary.floor}`]);
});

test("A missing or malformed summary.hash picks bank index 0 without throwing", () => {
  const noHash = { ...baseSummary, hash: undefined };
  assert.doesNotThrow(() => newBestView({ first: true, newBests: [], summary: noHash }));
  const view1 = newBestView({ first: true, newBests: [], summary: noHash });
  assert.equal(view1.quip, FIRST_DEATH_LINES[0]);

  const malformed = { ...baseSummary, hash: "not-hex!!" };
  const view2 = newBestView({ first: true, newBests: [], summary: malformed });
  assert.equal(view2.quip, FIRST_DEATH_LINES[0]);
});

test("A missing summary object never throws (guarded as {})", () => {
  assert.doesNotThrow(() => newBestView({ first: true, newBests: [] }));
  assert.doesNotThrow(() => newBestView({ first: false, newBests: ["deep"] }));
  const view = newBestView({ first: false, newBests: ["deep"] });
  assert.ok(view, "deep is a real board id, so the view is not null even with no summary");
  assert.deepStrictEqual(view.rows, ["DEEPEST DESCENT · floor 0"]);
});

test("Determinism: calling newBestView twice with the same report returns deepStrictEqual views", () => {
  const report = { first: false, newBests: ["deep", "purse"], summary: baseSummary };
  const view1 = newBestView(report);
  const view2 = newBestView(report);
  assert.deepStrictEqual(view1, view2);

  const firstReport = { first: true, newBests: [], summary: baseSummary };
  assert.deepStrictEqual(newBestView(firstReport), newBestView(firstReport));
});

test("No produced string matches /\\bWP\\b/ (player-facing text says HP, never WP)", () => {
  const reports = [
    { first: true, newBests: [], summary: baseSummary },
    { first: false, newBests: ["deep", "combo", "days", "kills", "purse"], summary: baseSummary },
  ];
  for (const report of reports) {
    const view = newBestView(report);
    assert.ok(view);
    const texts = [view.head, view.quip, ...view.rows].filter((s) => s != null);
    for (const t of texts) {
      assert.ok(!/\bWP\b/.test(t), `found WP in produced text: ${t}`);
    }
  }
});

test("newBestView guards report.newBests that is not an array (treated as none)", () => {
  assert.equal(newBestView({ first: false, newBests: "deep", summary: baseSummary }), null);
  assert.equal(newBestView({ first: false, summary: baseSummary }), null);
});

// --- Source-scan purity guard (the same comment-stripped scan engineAdapter.test.js uses) ---

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("src/browser/newBest.js is pure: no Math.random, no document, exactly one content/boards.js import", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "newBest.js"), "utf8"));
  assert.ok(!/Math\.random/.test(src), "must not call Math.random");
  assert.ok(!/\bdocument\b/.test(src), "must not reference the DOM document object");
  const importMatches = src.match(/from ["']\.\.\/\.\.\/content\/boards\.js["']/g) || [];
  assert.equal(importMatches.length, 1, "expected exactly one import from ../../content/boards.js");
});

test("BOARD_COPY key order matches the panel's tab order used for row ordering (LEANEST retired, BOARD-17)", () => {
  assert.deepStrictEqual(Object.keys(BOARD_COPY), ["deep", "days", "kills", "purse", "combo", "yard"]);
});
