// test/unit/boards-copy.test.js
//
// Phase 66 (BOARD-02/03/07/08), Task 2 — pins content/boards.js's Phase 66
// additions verbatim against the mock (design/Mazeworld Boards Panel.dc.html)
// and the 66-02-PLAN.md Task 1 <action> list, and proves the panel copy's
// shape (deep-frozen, no functions, tokens from the closed set only, no
// signed-out board claiming a global/friends rank).
//
// TDD RED: written before this task extends content/boards.js's exports; the
// assertions below are pinned to 66-02-PLAN.md Task 2's <behavior> bullets.

import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_COPY, BOARD_FOOTNOTES, BOARDS_PANEL_COPY, STANDING_LINES } from "../../content/boards.js";

const MOCK_RULE = {
  deep: "Lowest floor reached before dying. Ties broken by the fewer squares walked to get there.",
  combo: "Every race and class combination rolled so far, ranked by the deepest floor any of them managed.",
  days: "Days survived underground. Rations are the real opponent.",
  kills: "Things killed before being killed. Not correlated with depth, which is the joke.",
  purse: "Wilmst carried at the moment of death. All of it still down there.",
  yard: "Everyone you have rolled and lost, deepest first, with what was said over them. Not ranked against anybody.",
};

const OLD_LEAN_RULE = "Depth first, then economy: the lowest floor reached, and among equals, whoever walked the fewest squares to get there.";

const MOCK_MARK_COL = {
  deep: { mark: "▼", col: "#d3c49f" },
  lean: { mark: "▪", col: "#e8c97a" },
  combo: { mark: "◆", col: "#b9a4ef" },
  days: { mark: "⧗", col: "#8fb08a" },
  kills: { mark: "✕", col: "#e07260" },
  purse: { mark: "●", col: "#e8c97a" },
  yard: { mark: "✝", col: "#c9bda0" },
};

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const TOKENS = new Set(["n", "name", "floor", "steps", "epitaph"]);

/** Every `{token}` in a string, without the braces. */
function tokensIn(s) {
  const out = [];
  const re = /\{([a-zA-Z]+)\}/g;
  let m;
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
}

/** Recursively collect [path, value] for every leaf in a plain object/array tree. */
function collectLeaves(obj, pathLabel = "") {
  const leaves = [];
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    leaves.push([pathLabel, obj]);
    return leaves;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves.push(...collectLeaves(v, `${pathLabel}[${i}]`)));
    return leaves;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      leaves.push(...collectLeaves(v, pathLabel ? `${pathLabel}.${k}` : k));
    }
  }
  return leaves;
}

// ─── BOARD_COPY key order + Phase 65 fields untouched ───────────────────────

test("Object.keys(BOARD_COPY) still equals the mock tab order", () => {
  assert.deepStrictEqual(Object.keys(BOARD_COPY), ["deep", "lean", "combo", "days", "kills", "purse", "yard"]);
});

test("BOARD_COPY tab/title/unit/unitOne match their Phase 65 values", () => {
  const pinned = {
    deep: { tab: "DEEPEST", title: "DEEPEST DESCENT", unit: "floor" },
    lean: { tab: "LEANEST", title: "DEEPEST, FEWEST STEPS", unit: "sq" },
    combo: { tab: "LINEAGE", title: "BY RACE & CLASS", unit: "floor" },
    days: { tab: "LONGEST", title: "LONGEST HELD OUT", unit: "days", unitOne: "day" },
    kills: { tab: "BUTCHERY", title: "MOST KILLS", unit: "kills", unitOne: "kill" },
    purse: { tab: "PURSE", title: "RICHEST CORPSE", unit: "wilmst" },
    yard: { tab: "GRAVEYARD", title: "YOUR GRAVEYARD", unit: "floor" },
  };
  for (const [id, fields] of Object.entries(pinned)) {
    for (const [field, value] of Object.entries(fields)) {
      assert.equal(BOARD_COPY[id][field], value, `BOARD_COPY.${id}.${field}`);
    }
  }
});

// ─── mark/col/unitLabel/title/rule shape and verbatim mock pins ─────────────

test("Every board has a one-character mark, a #rrggbb col, a non-empty unitLabel, title and rule", () => {
  for (const [id, b] of Object.entries(BOARD_COPY)) {
    assert.equal(typeof b.mark, "string", `${id}.mark`);
    assert.equal([...b.mark].length, 1, `${id}.mark should be one character, got ${JSON.stringify(b.mark)}`);
    assert.match(b.col, HEX_COLOR_RE, `${id}.col should be #rrggbb`);
    assert.ok(typeof b.unitLabel === "string" && b.unitLabel.length > 0, `${id}.unitLabel non-empty`);
    assert.ok(typeof b.title === "string" && b.title.length > 0, `${id}.title non-empty`);
    assert.ok(typeof b.rule === "string" && b.rule.length > 0, `${id}.rule non-empty`);
  }
});

test("Every board's mark and col match the mock verbatim (D-11)", () => {
  for (const [id, expected] of Object.entries(MOCK_MARK_COL)) {
    assert.equal(BOARD_COPY[id].mark, expected.mark, `${id}.mark`);
    assert.equal(BOARD_COPY[id].col, expected.col, `${id}.col`);
  }
});

test("The six non-LEANEST rule lines equal the mock strings verbatim", () => {
  for (const [id, rule] of Object.entries(MOCK_RULE)) {
    assert.equal(BOARD_COPY[id].rule, rule, `${id}.rule`);
  }
});

test("LEANEST's rule is the re-voice, not the mock's old duplicated-ordering line, and mentions per-floor", () => {
  assert.notEqual(BOARD_COPY.lean.rule, OLD_LEAN_RULE);
  assert.match(BOARD_COPY.lean.rule, /per floor/i);
});

// ─── BOARD_FOOTNOTES ─────────────────────────────────────────────────────────

test("BOARD_FOOTNOTES.ranked and .yard equal the mock verbatim", () => {
  assert.equal(
    BOARD_FOOTNOTES.ranked,
    "Top ten only. Boards count the dead — living characters are provisional and the dungeon keeps no provisional records.",
  );
  assert.equal(
    BOARD_FOOTNOTES.yard,
    "Epitaphs are written by the dungeon, not by you. There is no appeal.",
  );
});

// ─── BOARDS_PANEL_COPY: frozen, string leaves, token universe ───────────────

test("BOARDS_PANEL_COPY is deep-frozen", () => {
  (function walk(obj) {
    if (obj && typeof obj === "object") {
      assert.ok(Object.isFrozen(obj), "every nested object in BOARDS_PANEL_COPY must be frozen");
      for (const v of Object.values(obj)) walk(v);
    }
  })(BOARDS_PANEL_COPY);
});

test("Every BOARDS_PANEL_COPY leaf is a non-empty string", () => {
  for (const [path, value] of collectLeaves(BOARDS_PANEL_COPY)) {
    assert.equal(typeof value, "string", `${path} should be a string`);
    assert.ok(value.length > 0, `${path} should be non-empty`);
  }
});

test("Every BOARDS_PANEL_COPY template's tokens are only from {n,name,floor,steps,epitaph}", () => {
  for (const [path, value] of collectLeaves(BOARDS_PANEL_COPY)) {
    for (const t of tokensIn(value)) {
      assert.ok(TOKENS.has(t), `${path} uses unexpected token {${t}}`);
    }
  }
});

test("BOARDS_PANEL_COPY carries the D-01/D-06/D-07/D-12 fields the plan specifies", () => {
  assert.equal(BOARDS_PANEL_COPY.head.title, "LEADERBOARDS");
  assert.equal(BOARDS_PANEL_COPY.head.interred, "INTERRED");
  assert.equal(BOARDS_PANEL_COPY.strip.label, "PLAY GAMES · SIGNED OUT");
  assert.equal(BOARDS_PANEL_COPY.strip.source, "Your dead only");
  assert.equal(BOARDS_PANEL_COPY.chips.all, "ALL");
  assert.equal(BOARDS_PANEL_COPY.chips.friends, "FRIENDS");
  assert.equal(BOARDS_PANEL_COPY.empty, "Nobody of yours has qualified for this board yet.");
  assert.equal(BOARDS_PANEL_COPY.standing.noEntry, "NO ENTRY");
  assert.equal(BOARDS_PANEL_COPY.dock.title, "BACK TO TITLE");
  assert.equal(BOARDS_PANEL_COPY.dock.roll, "ROLL A NEW HERO");
  assert.equal(BOARDS_PANEL_COPY.dock.dungeon, "BACK TO THE DUNGEON");
});

// ─── STANDING_LINES: frozen, shape, bank sizes, forbidden wording ───────────

test("STANDING_LINES is deep-frozen", () => {
  assert.ok(Object.isFrozen(STANDING_LINES));
  for (const arr of Object.values(STANDING_LINES)) {
    assert.ok(Object.isFrozen(arr), "each bank array must be frozen");
  }
});

test("STANDING_LINES has first/ten/rest arrays of at least 2 each and at least 6 lines total", () => {
  assert.ok(Array.isArray(STANDING_LINES.first) && STANDING_LINES.first.length >= 2);
  assert.ok(Array.isArray(STANDING_LINES.ten) && STANDING_LINES.ten.length >= 2);
  assert.ok(Array.isArray(STANDING_LINES.rest) && STANDING_LINES.rest.length >= 2);
  const total = STANDING_LINES.first.length + STANDING_LINES.ten.length + STANDING_LINES.rest.length;
  assert.ok(total >= 6, `expected at least 6 standing lines total, got ${total}`);
});

test("No STANDING_LINES entry mentions a pin, worldwide, friends, or another player", () => {
  const forbidden = /worldwide|friend|pinned|@/i;
  for (const [bank, lines] of Object.entries(STANDING_LINES)) {
    lines.forEach((line, i) => {
      assert.doesNotMatch(line, forbidden, `STANDING_LINES.${bank}[${i}] -> "${line}"`);
    });
  }
});
