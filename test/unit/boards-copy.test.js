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

import { BOARD_COPY, BOARD_FOOTNOTES, BOARDS_PANEL_COPY, STANDING_LINES, GLOBAL_STANDING_LINES } from "../../content/boards.js";

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

// ─── Phase 67 (D-08): the signed-in strip and coming-online notes ───────────

test("BOARDS_PANEL_COPY.strip.live: the signed-in source line verbatim and a non-empty fallback name", () => {
  assert.equal(BOARDS_PANEL_COPY.strip.live.source, "PLAY GAMES · SIGNED IN");
  assert.equal(BOARDS_PANEL_COPY.strip.live.unnamed, "A player with no name");
  // The Phase 66 signed-out strip is untouched.
  assert.equal(BOARDS_PANEL_COPY.strip.glyph, "?");
  assert.equal(BOARDS_PANEL_COPY.strip.label, "PLAY GAMES · SIGNED OUT");
  assert.equal(BOARDS_PANEL_COPY.strip.source, "Your dead only");
});

test("BOARDS_PANEL_COPY.note.live: the coming-online notes verbatim, the signed-out notes untouched", () => {
  assert.equal(
    BOARDS_PANEL_COPY.note.live.all,
    "The world's ledger is still being bound. Your own dead will have to do.",
  );
  assert.equal(
    BOARDS_PANEL_COPY.note.live.friends,
    "Your friends' ledger is still at the bindery. Your own dead will have to do for now.",
  );
  assert.equal(BOARDS_PANEL_COPY.note.all, "Nobody out there can see you yet.");
  assert.equal(
    BOARDS_PANEL_COPY.note.friends,
    "Your friends have not been told you exist. It may be kinder that way.",
  );
});

test("The live notes claim no rank, count or ranking scope (they say the boards are not open yet)", () => {
  const forbidden = /worldwide|among friends|\d|\b(rank|ranked|place|placed)\b|@/i;
  for (const [k, line] of Object.entries(BOARDS_PANEL_COPY.note.live)) {
    assert.doesNotMatch(line, forbidden, `note.live.${k} -> "${line}"`);
  }
});

// ─── Phase 68 (D-05..D-09): the global board copy ───────────────────────────

const GLOBAL_PINS = {
  season: "SEASON {n}",
  loading: "Asking the world who died. It keeps records, slowly.",
  unreachable: "The world is unreachable. Your own dead are still here.",
  closed: "This board has not opened yet. The ledger is still being ruled.",
  empty: "Nobody has died on this board yet this season. Somebody has to go first.",
  consent: "Play Games will not show us your friends until you say so.",
  consentButton: "SHOW MY FRIENDS",
  you: "YOU",
  friend: "FRIEND",
  anon: "A nameless delver",
  foe: "foe",
  leanRateUnit: "SQ / FLOOR",
  noEntry: "Nothing of yours on this board yet this season.",
  ofWorld: "of {n} interred worldwide.",
  ofFriends: "of {n} among friends.",
  ofSampled: "of {n} lineages in the sample.",
  sampledFoot: "Sampled from the top {n} deepest corpses in the world. Rare lineages may be buried further down.",
};

test("BOARDS_PANEL_COPY.global is deep-frozen and sits after note", () => {
  const g = BOARDS_PANEL_COPY.global;
  assert.ok(g && typeof g === "object");
  (function walk(obj) {
    if (obj && typeof obj === "object") {
      assert.ok(Object.isFrozen(obj), "every nested object in BOARDS_PANEL_COPY.global must be frozen");
      for (const v of Object.values(obj)) walk(v);
    }
  })(g);
  const keys = Object.keys(BOARDS_PANEL_COPY);
  assert.equal(keys.indexOf("global"), keys.indexOf("note") + 1);
});

test("BOARDS_PANEL_COPY.global.scope pins the ALL / FRIENDS scope lines verbatim (D-05, D-06)", () => {
  assert.deepStrictEqual(Object.keys(BOARDS_PANEL_COPY.global.scope), ["all", "friends"]);
  assert.equal(BOARDS_PANEL_COPY.global.scope.all, "Global. Every delve this season.");
  assert.equal(BOARDS_PANEL_COPY.global.scope.friends, "Your friends’ dead only. This season.");
});

test("BOARDS_PANEL_COPY.global pins every other string verbatim (D-05..D-09)", () => {
  for (const [k, v] of Object.entries(GLOBAL_PINS)) {
    assert.equal(BOARDS_PANEL_COPY.global[k], v, `global.${k}`);
  }
  assert.deepStrictEqual(Object.keys(BOARDS_PANEL_COPY.global).sort(), ["scope", ...Object.keys(GLOBAL_PINS)].sort());
});

test("BOARDS_PANEL_COPY.global token rules: season/ofWorld/ofFriends/ofSampled/sampledFoot carry {n}; nothing else carries a token", () => {
  const withN = new Set(["season", "ofWorld", "ofFriends", "ofSampled", "sampledFoot"]);
  for (const [p, v] of collectLeaves(BOARDS_PANEL_COPY.global)) {
    const t = tokensIn(v);
    if (withN.has(p)) assert.deepStrictEqual(t, ["n"], `global.${p}`);
    else assert.deepStrictEqual(t, [], `global.${p}`);
  }
  assert.match(BOARDS_PANEL_COPY.global.ofWorld, /worldwide/);
  assert.match(BOARDS_PANEL_COPY.global.ofFriends, /among friends/);
});

test("No BOARDS_PANEL_COPY.global string has a markup character, WP or a handle marker", () => {
  for (const [p, v] of collectLeaves(BOARDS_PANEL_COPY.global)) {
    assert.doesNotMatch(v, /[<>&@]/, `global.${p} -> "${v}"`);
    assert.doesNotMatch(v, /\bWP\b/i, `global.${p} -> "${v}"`);
  }
});

test("The Phase 66/67 keys of BOARDS_PANEL_COPY are unchanged by the Phase 68 addition", () => {
  assert.deepStrictEqual(Object.keys(BOARDS_PANEL_COPY), [
    "head", "scope", "strip", "chips", "note", "global", "empty", "divider", "standing", "stats", "lineage", "level", "sep", "dock",
  ]);
  assert.equal(BOARDS_PANEL_COPY.scope.ranked, "Your dead only. The world has not been told.");
  assert.equal(BOARDS_PANEL_COPY.divider, "NOT IN THE TOP TEN · YOUR BEST RUN");
});

const GLOBAL_STANDING_PINS = {
  first: [
    "First place. The others have been told, and are not thrilled.",
    "Top of the heap. Mind the drop.",
    "Nobody has done better. Nobody will admit it, either.",
  ],
  ten: [
    "Top ten. Strangers are studying your corpse.",
    "In the top ten. Your ghost has earned a small nod.",
    "Top ten. The rest are taking notes, grudgingly.",
  ],
  hundred: [
    "Top hundred. A large room, but a respectable one.",
    "Somewhere in the top hundred. The view is mostly other graves.",
    "Top hundred. Frame it before the season ends.",
  ],
  rest: [
    "Out in the crowd. Everyone here is dead too, if that helps.",
    "Not near the top. Not near the bottom either, probably.",
    "A face in a very large, very quiet crowd.",
  ],
};

test("GLOBAL_STANDING_LINES is deep-frozen { first, ten, hundred, rest } with at least 3 lines each", () => {
  assert.ok(Object.isFrozen(GLOBAL_STANDING_LINES));
  assert.deepStrictEqual(Object.keys(GLOBAL_STANDING_LINES), ["first", "ten", "hundred", "rest"]);
  for (const [bank, lines] of Object.entries(GLOBAL_STANDING_LINES)) {
    assert.ok(Object.isFrozen(lines), `${bank} must be frozen`);
    assert.ok(lines.length >= 3, `${bank} has at least 3 lines`);
  }
});

test("GLOBAL_STANDING_LINES pins the plan's lines verbatim, with no {token}, markup, WP or handle marker", () => {
  for (const [bank, lines] of Object.entries(GLOBAL_STANDING_PINS)) {
    lines.forEach((line, i) => assert.equal(GLOBAL_STANDING_LINES[bank][i], line, `${bank}[${i}]`));
  }
  for (const [bank, lines] of Object.entries(GLOBAL_STANDING_LINES)) {
    lines.forEach((line, i) => {
      assert.deepStrictEqual(tokensIn(line), [], `${bank}[${i}]`);
      assert.doesNotMatch(line, /[<>&@{}]/, `${bank}[${i}] -> "${line}"`);
      assert.doesNotMatch(line, /\bWP\b/i, `${bank}[${i}] -> "${line}"`);
    });
  }
});
