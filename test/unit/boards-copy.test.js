// test/unit/boards-copy.test.js
//
// Phase 66 (BOARD-02/03/07/08), Task 2 — originally pinned content/boards.js's
// old-panel exports (BOARD_COPY's mark/col/unitLabel/rule fields,
// BOARDS_PANEL_COPY, STANDING_LINES, GLOBAL_STANDING_LINES). Phase 84
// (BOARD-18..25, BOARD-20) retired the old Leaderboards panel and its copy
// (84-09): those exports are gone, so their pins are deleted below. What
// remains pinned here: BOARD_COPY's trimmed shape and its title/unit/
// unitOne values (unchanged since Phase 65, read by src/browser/newBest.js)
// and the NEW_BEST_HEAD/NEW_BEST_LINES/FIRST_DEATH_LINES shapes.
//
// (LEADERBOARD_COPY, the v3 panel's own copy bank, is pinned separately in
// test/unit/leaderboard-copy.test.js.)

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_COPY, NEW_BEST_HEAD, NEW_BEST_LINES, FIRST_DEATH_LINES } from "../../content/boards.js";

// ─── BOARD_COPY: exactly the four NEW PERSONAL BEST rows ────────────────────

test("Object.keys(BOARD_COPY) is exactly deep, days, kills, purse (LEANEST retired BOARD-17; LINEAGE/GRAVEYARD retired Phase 84 84-09)", () => {
  assert.deepStrictEqual(Object.keys(BOARD_COPY), ["deep", "days", "kills", "purse"]);
});

test("BOARD_COPY title/unit/unitOne match their Phase 65 values, unchanged by the Phase 84 trim", () => {
  const pinned = {
    deep: { title: "DEEPEST DESCENT", unit: "floor" },
    days: { title: "LONGEST HELD OUT", unit: "days", unitOne: "day" },
    kills: { title: "MOST KILLS", unit: "kills", unitOne: "kill" },
    purse: { title: "RICHEST CORPSE", unit: "wilmst" },
  };
  for (const [id, fields] of Object.entries(pinned)) {
    for (const [field, value] of Object.entries(fields)) {
      assert.equal(BOARD_COPY[id][field], value, `BOARD_COPY.${id}.${field}`);
    }
  }
});

test("Every BOARD_COPY entry holds only title, unit and (where applicable) unitOne — no mark/col/unitLabel/rule/tab leftovers", () => {
  for (const [id, b] of Object.entries(BOARD_COPY)) {
    const keys = Object.keys(b).sort();
    assert.ok(keys.every((k) => k === "title" || k === "unit" || k === "unitOne"), `${id} carries an unexpected field: ${keys.join(",")}`);
    assert.ok(typeof b.title === "string" && b.title.length > 0, `${id}.title non-empty`);
    assert.ok(typeof b.unit === "string" && b.unit.length > 0, `${id}.unit non-empty`);
  }
});

test("No retired board id (lean, combo, yard) is a BOARD_COPY key", () => {
  assert.ok(!("lean" in BOARD_COPY));
  assert.ok(!("combo" in BOARD_COPY));
  assert.ok(!("yard" in BOARD_COPY));
});

// ─── NEW_BEST_HEAD / NEW_BEST_LINES / FIRST_DEATH_LINES shapes ──────────────

test("NEW_BEST_HEAD is the mock's head string verbatim", () => {
  assert.equal(NEW_BEST_HEAD, "NEW PERSONAL BEST");
});

test("NEW_BEST_LINES is a non-empty array of non-empty strings", () => {
  assert.ok(Array.isArray(NEW_BEST_LINES) && NEW_BEST_LINES.length > 0);
  for (const line of NEW_BEST_LINES) {
    assert.equal(typeof line, "string");
    assert.ok(line.length > 0);
  }
});

test("FIRST_DEATH_LINES is a non-empty array of non-empty strings", () => {
  assert.ok(Array.isArray(FIRST_DEATH_LINES) && FIRST_DEATH_LINES.length > 0);
  for (const line of FIRST_DEATH_LINES) {
    assert.equal(typeof line, "string");
    assert.ok(line.length > 0);
  }
});

test("No NEW_BEST_LINES or FIRST_DEATH_LINES entry mentions a pin, worldwide, friends, or another player", () => {
  const forbidden = /worldwide|friend|pinned|@/i;
  NEW_BEST_LINES.forEach((line, i) => assert.doesNotMatch(line, forbidden, `NEW_BEST_LINES[${i}] -> "${line}"`));
  FIRST_DEATH_LINES.forEach((line, i) => assert.doesNotMatch(line, forbidden, `FIRST_DEATH_LINES[${i}] -> "${line}"`));
});
