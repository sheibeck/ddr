// test/unit/roll-high-guard.test.js
//
// Phase 73-01 (ROLL-05) — the build-failing roll-high guard. Every later
// Phase 73 plan ratchets this tighter: convert a file's check sites to
// engine/dice.js#rollCheck, tag every remaining raw draw with a trailing
// `// roll:<kind>` comment, add the file's path to ENFORCED, and add its
// live draw counts to DRAW_INVENTORY. ALL_ENFORCED flips true in 73-09,
// once every engine/*.js file with a check site has been converted.
//
// Five rules, read from the parsed lines of every ENFORCED file:
//   1. tags     — every `.d(` in code carries a valid trailing tag; kind is
//                 one of amount/selection/mishap-on-1/already-high, and
//                 `primitive` is allowed only in engine/dice.js.
//   2. dice     — engine/dice.js holds exactly two primitive draws and
//                 exports rollDice, rollCheck, atLeastFor, rollFields and
//                 isBestFace.
//   3. shapes   — S1-S8 (roll-under comparison shapes) fire on the code of
//                 every non-selection-tagged line. A `roll:selection` tag
//                 exempts a pure dispatch-ladder comparison line (e.g.
//                 `if (r <= 3) return ...`) that LOOKS like a roll-under
//                 check but is a table pick, not a check.
//   4. mirror   — M1 (the dieN+1-roll arithmetic) fires nowhere outside
//                 engine/dice.js, which is the only file allowed to mirror
//                 a draw.
//   5. inventory — the live per-file draw-tag counts (computed by parsing
//                 every ENFORCED file fresh, every run) deep-equal the
//                 hardcoded DRAW_INVENTORY below, so a silently-added or
//                 silently-removed draw fails the build instead of drifting
//                 the ledger.
// Plus two standing checks: `transitional` (the literal phrase "Phase 73
// transitional" appears in no enforced file — this plan's tags are meant to
// stay, not to be a temporary marker) and `enforced` (every ENFORCED path
// exists under engine/, and once ALL_ENFORCED is true, ENFORCED must equal
// the full engine/*.js listing).
//
// A self-test at the bottom runs the shape/mirror/tag-validity functions
// over synthetic lines: one bad line per shape S1-S8 and M1, an untagged
// draw, an unknown tag, and a misplaced primitive tag — each asserted to
// fire — plus every allowed roll-high shape from this plan's `<interfaces>`
// block, each asserted NOT to fire. This proves the rule functions
// themselves are correct, independent of what today's engine files contain.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/* ---------------- ENFORCED list & ratchet -------------------------------- */

// 73-08 adds engine/combat.js and engine/foeAbilities.js — every remaining
// check site in both (flee, parley, the startCombat/fight gates, the kill
// drops, the foe ability gate) now converts through rollCheck, and every
// other raw draw in both files carries a tag.
// 73-09 adds engine/encounters.js and engine/movement.js — the last two
// files: traps, locks, climbs, leaps, cures and the wake/murder checks all
// convert (or, for wake/murder, stay tagged already-high/mishap-on-1), and
// ALL_ENFORCED flips true below.
export const ENFORCED = [
  "engine/abilities.js",
  "engine/character.js",
  "engine/combat.js",
  "engine/derived.js",
  "engine/dice.js",
  "engine/economy.js",
  "engine/encounters.js",
  "engine/maze.js",
  "engine/difficulty.js",
  "engine/items.js",
  "engine/actions.js",
  "engine/death.js",
  "engine/effects.js",
  "engine/engine.js",
  "engine/events.js",
  "engine/foeAbilities.js",
  "engine/foeDamage.js",
  "engine/magic.js",
  "engine/movement.js",
  "engine/phobias.js",
  "engine/records.js",
  "engine/rng.js",
  "engine/saveState.js",
  "engine/state.js",
];

// Flips true in 73-09, once encounters.js and movement.js have converted
// their remaining check sites (traps, locks, climbs, leaps, cures, wake) and
// joined ENFORCED — every engine/*.js file with a check site is now covered.
export const ALL_ENFORCED = true;

// Per-enforced-file draw-tag counts, keyed by the SAME kind vocabulary the
// tag grammar uses, plus `rollCheck` (calls to the helper in code,
// excluding its own definition in dice.js). Counts are of `.d(`
// OCCURRENCES per tagged line (a line can hold more than one draw under one
// tag, e.g. items.js's pickpocket-extra line), not of tagged LINES — a
// selection-tagged dispatch-ladder line with no `.d(` on it (a pure
// comparison, exempted from the shapes rule) contributes zero.
export const DRAW_INVENTORY = {
  "engine/abilities.js": { rollCheck: 0, amount: 2, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/character.js": { rollCheck: 0, amount: 3, selection: 13, "mishap-on-1": 1, "already-high": 0, primitive: 0 },
  "engine/combat.js": { rollCheck: 22, amount: 18, selection: 3, "mishap-on-1": 0, "already-high": 5, primitive: 0 },
  "engine/derived.js": { rollCheck: 1, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/dice.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 2 },
  "engine/economy.js": { rollCheck: 0, amount: 0, selection: 1, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/encounters.js": { rollCheck: 3, amount: 10, selection: 13, "mishap-on-1": 0, "already-high": 1, primitive: 0 },
  "engine/maze.js": { rollCheck: 0, amount: 1, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/difficulty.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/items.js": { rollCheck: 1, amount: 8, selection: 9, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/actions.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/death.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/effects.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/engine.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/events.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/foeAbilities.js": { rollCheck: 0, amount: 1, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/foeDamage.js": { rollCheck: 1, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/magic.js": { rollCheck: 1, amount: 17, selection: 2, "mishap-on-1": 3, "already-high": 0, primitive: 0 },
  "engine/movement.js": { rollCheck: 3, amount: 7, selection: 4, "mishap-on-1": 1, "already-high": 2, primitive: 0 },
  "engine/phobias.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/records.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/rng.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/saveState.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
  "engine/state.js": { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 },
};

const VALID_KINDS = new Set(["amount", "selection", "mishap-on-1", "already-high", "primitive"]);

/* ---------------- shape / mirror regexes (per this plan's <interfaces>) -- */

const RE_S1 = /\b(?:\w+\.)*(?:roll|\w*Roll)\b\s*<=?(?![<=])/;
const RE_S2 = /(?<![=>-])>=?\s*(?:\w+\.)*(?:roll|\w*Roll)\b(?!\s*\()/;
const RE_S3 = /\.d\([^)]*\)\s*<=?(?![<=])/;
const RE_S4 = /(?<![=>-])>=?\s*[\w.]*\.d\(/;
const RE_S5 = /\b(?:r|dodge|soak|mRoll)\s*<=/;
const RE_S6 = /(?:<=|(?<![=>-])>)\s*(?:need|mNeed|faces|nimble|wakeOn)\b/;
const RE_S7 = /\b(?:\w+\.)*(?:roll|\w*Roll)\b\s*-\s*[\w.]+\s*<=?/;
const RE_S8 = /Math\.min\(\s*(?:\w+\.)*(?:roll|\w*Roll)\b(?!\s*\()/;

const RE_M1A = /\+\s*1\s*-\s*(?:\w+\.)*(?:roll|\w*Roll)\b/;
const RE_M1B = /\+\s*1\s*-\s*[\w.]*\.d\(/;
const RE_M1C = /\b(?:dieN|sides|mDieN|legacyDieN)\s*\+\s*1\s*-/;

const SHAPES = [
  ["S1", RE_S1],
  ["S2", RE_S2],
  ["S3", RE_S3],
  ["S4", RE_S4],
  ["S5", RE_S5],
  ["S6", RE_S6],
  ["S7", RE_S7],
  ["S8", RE_S8],
];

/** matchesAnyShape(code) — returns the ids of every S1-S8 shape that fires
 * on `code` (a line's code part, comments already stripped). */
function matchesAnyShape(code) {
  const hits = [];
  for (const [id, re] of SHAPES) if (re.test(code)) hits.push(id);
  return hits;
}

/** matchesMirror(code) — true if any M1 sub-pattern fires on `code`. */
function matchesMirror(code) {
  return RE_M1A.test(code) || RE_M1B.test(code) || RE_M1C.test(code);
}

/* ---------------- line parser -------------------------------------------- */

/**
 * parseFile(absPath) — splits a file into lines and, for each one, returns
 * { lineNo, raw, code, tag }: `raw` is the untouched line, `tag` is the
 * trailing `// roll:<kind>` capture read BEFORE any stripping, and `code`
 * is `raw` with every `/* ... *\/` block-comment span (tracked across
 * lines) and any trailing `//` line comment removed.
 */
function parseFile(absPath) {
  const text = fs.readFileSync(absPath, "utf8");
  const rawLines = text.split(/\r\n|\n/);
  let inBlock = false;
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const tagMatch = raw.match(/\/\/\s*roll:([a-z0-9-]+)/i);
    const tag = tagMatch ? tagMatch[1] : null;

    let code = raw;
    if (inBlock) {
      const endIdx = code.indexOf("*/");
      if (endIdx === -1) {
        code = "";
      } else {
        code = code.slice(endIdx + 2);
        inBlock = false;
      }
    }
    if (!inBlock) {
      let searchFrom = 0;
      // handle any number of complete /* ... */ spans on the remaining
      // code, and one possible unterminated /* that carries to next line
      for (;;) {
        const startIdx = code.indexOf("/*", searchFrom);
        if (startIdx === -1) break;
        const endIdx = code.indexOf("*/", startIdx + 2);
        if (endIdx === -1) {
          code = code.slice(0, startIdx);
          inBlock = true;
          break;
        }
        code = code.slice(0, startIdx) + code.slice(endIdx + 2);
        searchFrom = startIdx;
      }
    }
    const lineCommentIdx = code.indexOf("//");
    if (lineCommentIdx !== -1) code = code.slice(0, lineCommentIdx);

    lines.push({ lineNo: i + 1, raw, code, tag });
  }
  return lines;
}

/* ---------------- rule functions ------------------------------------------ */

/** ruleTags(filePath, lines) — every `.d(` in code carries a valid tag. */
function ruleTags(filePath, lines) {
  const violations = [];
  for (const { lineNo, code, tag, raw } of lines) {
    const drawCount = (code.match(/\.d\(/g) || []).length;
    if (drawCount === 0) continue;
    if (!tag) {
      violations.push(`${filePath}:${lineNo}: [tags] untagged raw draw — ${raw.trim()}`);
      continue;
    }
    if (!VALID_KINDS.has(tag)) {
      violations.push(`${filePath}:${lineNo}: [tags] unknown tag "roll:${tag}" — ${raw.trim()}`);
      continue;
    }
    if (tag === "primitive" && filePath !== "engine/dice.js") {
      violations.push(`${filePath}:${lineNo}: [tags] roll:primitive is reserved for engine/dice.js — ${raw.trim()}`);
    }
  }
  return violations;
}

/** ruleShapes(filePath, lines) — S1-S8 fire on every non-selection-tagged line. */
function ruleShapes(filePath, lines) {
  const violations = [];
  for (const { lineNo, code, tag, raw } of lines) {
    if (tag === "selection") continue;
    const hits = matchesAnyShape(code);
    if (hits.length) {
      violations.push(`${filePath}:${lineNo}: [shapes:${hits.join(",")}] roll-under shape — ${raw.trim()}`);
    }
  }
  return violations;
}

/** ruleMirror(filePath, lines) — M1 fires nowhere outside engine/dice.js. */
function ruleMirror(filePath, lines) {
  if (filePath === "engine/dice.js") return [];
  const violations = [];
  for (const { lineNo, code, raw } of lines) {
    if (matchesMirror(code)) {
      violations.push(`${filePath}:${lineNo}: [mirror] mirror arithmetic outside engine/dice.js — ${raw.trim()}`);
    }
  }
  return violations;
}

/** liveCounts(lines) — the live per-tag draw-occurrence + rollCheck-call
 * counts for one file's parsed lines, in DRAW_INVENTORY's shape. */
function liveCounts(lines) {
  const counts = { rollCheck: 0, amount: 0, selection: 0, "mishap-on-1": 0, "already-high": 0, primitive: 0 };
  for (const { code, tag } of lines) {
    const drawCount = (code.match(/\.d\(/g) || []).length;
    if (drawCount > 0 && tag && VALID_KINDS.has(tag)) counts[tag] += drawCount;
    const isDefinition = /export function rollCheck\s*\(/.test(code);
    if (!isDefinition) {
      const calls = code.match(/\brollCheck\s*\(/g) || [];
      counts.rollCheck += calls.length;
    }
  }
  return counts;
}

/* ---------------- main tests over the real, live ENFORCED files ---------- */

const parsedByFile = new Map();
function parsed(filePath) {
  if (!parsedByFile.has(filePath)) {
    parsedByFile.set(filePath, parseFile(path.join(REPO_ROOT, filePath)));
  }
  return parsedByFile.get(filePath);
}

test("[enforced] every ENFORCED path exists under engine/", () => {
  for (const filePath of ENFORCED) {
    assert.ok(filePath.startsWith("engine/"), `${filePath} must live under engine/`);
    assert.ok(fs.existsSync(path.join(REPO_ROOT, filePath)), `${filePath} does not exist`);
  }
  if (ALL_ENFORCED) {
    const allEngineFiles = fs
      .readdirSync(path.join(REPO_ROOT, "engine"))
      .filter((f) => f.endsWith(".js"))
      .map((f) => `engine/${f}`)
      .sort();
    assert.deepEqual([...ENFORCED].sort(), allEngineFiles, "ALL_ENFORCED requires ENFORCED to equal every engine/*.js file");
  }
});

test("[dice] engine/dice.js holds exactly two primitive draws and exports the five functions", () => {
  const text = fs.readFileSync(path.join(REPO_ROOT, "engine/dice.js"), "utf8");
  const primitiveCount = (text.match(/roll:primitive/g) || []).length;
  assert.equal(primitiveCount, 2, "engine/dice.js must carry exactly two roll:primitive tags");
  for (const fn of ["rollDice", "rollCheck", "atLeastFor", "rollFields", "isBestFace"]) {
    assert.match(text, new RegExp(`export function ${fn}\\b`), `engine/dice.js must export ${fn}`);
  }
});

test("[tags] every raw draw in every ENFORCED file carries a valid trailing tag", () => {
  const violations = [];
  for (const filePath of ENFORCED) violations.push(...ruleTags(filePath, parsed(filePath)));
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("[shapes] no roll-under comparison shape (S1-S8) survives in any non-selection-tagged line", () => {
  const violations = [];
  for (const filePath of ENFORCED) violations.push(...ruleShapes(filePath, parsed(filePath)));
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("[mirror] no mirror arithmetic (M1) exists outside engine/dice.js", () => {
  const violations = [];
  for (const filePath of ENFORCED) violations.push(...ruleMirror(filePath, parsed(filePath)));
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("[inventory] live per-file draw-tag counts deep-equal DRAW_INVENTORY", () => {
  for (const filePath of ENFORCED) {
    const live = liveCounts(parsed(filePath));
    assert.deepEqual(live, DRAW_INVENTORY[filePath], `${filePath}: live counts ${JSON.stringify(live)} !== DRAW_INVENTORY ${JSON.stringify(DRAW_INVENTORY[filePath])}`);
  }
  // every ENFORCED file has a DRAW_INVENTORY row, and vice versa
  assert.deepEqual([...ENFORCED].sort(), Object.keys(DRAW_INVENTORY).sort());
});

test('[transitional] the literal phrase "Phase 73 transitional" appears in no enforced file', () => {
  for (const filePath of ENFORCED) {
    const text = fs.readFileSync(path.join(REPO_ROOT, filePath), "utf8");
    assert.ok(!text.includes("Phase 73 transitional"), `${filePath} still carries a "Phase 73 transitional" marker`);
  }
});

/* ---------------- self-test: prove the rule functions themselves fire correctly ---- */

test("[self-test] each roll-under shape S1-S8 fires on its known-bad synthetic line", () => {
  const cases = [
    ["S1", "if (roll <= need) {"],
    ["S6", "if (roll > need) {"], // trips S6 (> need), not S1 (roll is on the left of >)
    ["S3", "if (rng.d(20) <= 5) {"],
    ["S4", "if (need >= rng.d(20)) {"],
    ["S5", "if (dodge <= nimble) {"],
    ["S7", "if (roll - bonus <= target) {"],
    ["S8", "const x = Math.min(roll, rng.d(n));"],
  ];
  for (const [expectedId, line] of cases) {
    const hits = matchesAnyShape(line);
    assert.ok(hits.includes(expectedId), `expected shape ${expectedId} to fire on: ${line} (got ${hits.join(",") || "none"})`);
  }
});

test("[self-test] M1 mirror arithmetic fires on its known-bad synthetic line", () => {
  assert.equal(matchesMirror("const roll = dieN + 1 - r;"), true);
  assert.equal(matchesMirror("const x = someRoll + 1 - r;") || matchesMirror("const x = dieN + 1 - roll;"), true);
});

test("[self-test] an untagged draw, an unknown tag and a misplaced primitive tag each fail ruleTags", () => {
  const untagged = [{ lineNo: 1, raw: "const x = rng.d(6);", code: "const x = rng.d(6);", tag: null }];
  assert.equal(ruleTags("engine/fake.js", untagged).length, 1);

  const unknown = [{ lineNo: 1, raw: "const x = rng.d(6); // roll:bogus", code: "const x = rng.d(6); ", tag: "bogus" }];
  assert.equal(ruleTags("engine/fake.js", unknown).length, 1);

  const misplacedPrimitive = [
    { lineNo: 1, raw: "const x = rng.d(6); // roll:primitive", code: "const x = rng.d(6); ", tag: "primitive" },
  ];
  assert.equal(ruleTags("engine/fake.js", misplacedPrimitive).length, 1);
  // the SAME line in engine/dice.js is legal
  assert.equal(ruleTags("engine/dice.js", misplacedPrimitive).length, 0);
});

test("[self-test] every allowed roll-high shape from <interfaces> does NOT fire on shapes or mirror", () => {
  const allowed = [
    "if (chk.ok) {",
    "return roll >= atLeast;",
    "return atLeast <= roll;",
    "Math.max(chk.roll, second.roll);",
    "rng.d(6) >= 4",
    "rng.d(20) > 2",
    "rng.d(8) === 1",
    '(sp) => sp.roll !== "derived"',
    "Math.min(rollDice(rng, a.loss), Math.max(0, c.wp - 1));",
    "for (let r = 0; r < row.length; r++) {",
    "if (c.scrolls < 1) {",
    "if (x > c.scroll) {",
    "if (rolls.length > 2) {",
  ];
  for (const line of allowed) {
    assert.deepEqual(matchesAnyShape(line), [], `expected no shape to fire on: ${line}`);
    assert.equal(matchesMirror(line), false, `expected mirror to not fire on: ${line}`);
  }
});
