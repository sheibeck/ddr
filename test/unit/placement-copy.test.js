// test/unit/placement-copy.test.js
//
// Phase 68 (PLACE-01/02; D-03, D-10..D-13) — pins content/placement.js: the
// DEEPEST rank-quip bank (first / ten / hundred / rest, plus the "standing"
// band for a run that did not beat the player's best), the deferred rail
// card copy, and the season-drop Oracle line. Proves the shape (deep-frozen,
// no functions), the token rules ({rank}, {total}, {ahead}, {count} only,
// where each band needs them), and the rendering guards (no markup
// characters, because the Oracle renders through innerHTML; no "WP"; no
// "@" handle marker, because no line ever names another player).

import test from "node:test";
import assert from "node:assert/strict";

import { PLACEMENT_LINES, PLACEMENT_CARD, SEASON_DROP_LINES } from "../../content/placement.js";

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
  if (obj === null || typeof obj !== "object") {
    leaves.push([pathLabel, obj]);
    return leaves;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves.push(...collectLeaves(v, `${pathLabel}[${i}]`)));
    return leaves;
  }
  for (const [k, v] of Object.entries(obj)) {
    leaves.push(...collectLeaves(v, pathLabel ? `${pathLabel}.${k}` : k));
  }
  return leaves;
}

function assertDeepFrozen(obj, label) {
  (function walk(o, p) {
    if (o && typeof o === "object") {
      assert.ok(Object.isFrozen(o), `${p} must be frozen`);
      for (const [k, v] of Object.entries(o)) walk(v, `${p}.${k}`);
    }
  })(obj, label);
}

const ALL = { PLACEMENT_LINES, PLACEMENT_CARD, SEASON_DROP_LINES };

// ─── PLACEMENT_LINES ─────────────────────────────────────────────────────────

test("PLACEMENT_LINES is deep-frozen with exactly first/ten/hundred/rest/standing", () => {
  assertDeepFrozen(PLACEMENT_LINES, "PLACEMENT_LINES");
  assert.deepStrictEqual(Object.keys(PLACEMENT_LINES), ["first", "ten", "hundred", "rest", "standing"]);
});

test("PLACEMENT_LINES bank sizes: first/ten/hundred/standing at least 3, rest at least 4", () => {
  assert.ok(PLACEMENT_LINES.first.length >= 3);
  assert.ok(PLACEMENT_LINES.ten.length >= 3);
  assert.ok(PLACEMENT_LINES.hundred.length >= 3);
  assert.ok(PLACEMENT_LINES.rest.length >= 4);
  assert.ok(PLACEMENT_LINES.standing.length >= 3);
});

test("Every first line carries {total}; every ten/hundred/rest/standing line carries {rank} and {total}", () => {
  for (const line of PLACEMENT_LINES.first) {
    assert.ok(tokensIn(line).includes("total"), `first -> "${line}"`);
  }
  for (const band of ["ten", "hundred", "rest", "standing"]) {
    for (const line of PLACEMENT_LINES[band]) {
      const t = tokensIn(line);
      assert.ok(t.includes("rank") && t.includes("total"), `${band} -> "${line}"`);
    }
  }
});

test("At least one rest line carries {ahead} (the D-13 worked example)", () => {
  assert.ok(PLACEMENT_LINES.rest.some((l) => tokensIn(l).includes("ahead")));
  assert.ok(PLACEMENT_LINES.rest.includes("You placed {rank} of {total}. The {ahead} ahead of you are also dead."));
});

test("PLACEMENT_LINES uses no token other than {rank}, {total} and {ahead}", () => {
  const allowed = new Set(["rank", "total", "ahead"]);
  for (const [p, v] of collectLeaves(PLACEMENT_LINES)) {
    for (const t of tokensIn(v)) assert.ok(allowed.has(t), `${p} uses {${t}}`);
  }
});

test("The first band says 1st outright and never needs {rank}", () => {
  for (const line of PLACEMENT_LINES.first) {
    assert.match(line, /1st/);
    assert.ok(!tokensIn(line).includes("rank"), `first -> "${line}"`);
  }
});

test("The standing band never claims this run placed (it did not beat the best)", () => {
  for (const line of PLACEMENT_LINES.standing) {
    assert.doesNotMatch(line, /you placed/i, `standing -> "${line}"`);
    assert.match(line, /best|better/i, `standing -> "${line}"`);
  }
});

// ─── PLACEMENT_CARD ──────────────────────────────────────────────────────────

test("PLACEMENT_CARD is deep-frozen with the title, good tone and 12 s hold", () => {
  assertDeepFrozen(PLACEMENT_CARD, "PLACEMENT_CARD");
  assert.equal(PLACEMENT_CARD.title, "THE LEDGER CAUGHT UP");
  assert.equal(PLACEMENT_CARD.tone, "good");
  assert.equal(PLACEMENT_CARD.hold, 12000);
});

test("PLACEMENT_CARD variants are non-empty arrays with the right tokens", () => {
  for (const v of ["one", "many", "oneStanding", "manyStanding"]) {
    assert.ok(Array.isArray(PLACEMENT_CARD[v]) && PLACEMENT_CARD[v].length > 0, v);
    for (const line of PLACEMENT_CARD[v]) {
      const t = tokensIn(line);
      assert.ok(t.includes("rank") && t.includes("total"), `${v} -> "${line}"`);
      if (v.startsWith("many")) assert.ok(t.includes("count"), `${v} -> "${line}"`);
      else assert.ok(!t.includes("count"), `${v} -> "${line}"`);
      for (const tok of t) assert.ok(["rank", "total", "count"].includes(tok), `${v} uses {${tok}}`);
    }
  }
});

test("PLACEMENT_CARD pins the plan's lines verbatim", () => {
  assert.deepStrictEqual([...PLACEMENT_CARD.one], ["Your earlier death placed {rank} of {total} on DEEPEST."]);
  assert.deepStrictEqual([...PLACEMENT_CARD.many], [
    "{count} earlier deaths reached the ledger. The best placed {rank} of {total} on DEEPEST.",
  ]);
  assert.deepStrictEqual([...PLACEMENT_CARD.oneStanding], [
    "Your earlier death reached the ledger. It did not beat your best, which holds {rank} of {total}.",
  ]);
  assert.deepStrictEqual([...PLACEMENT_CARD.manyStanding], [
    "{count} earlier deaths reached the ledger. None beat your best, which holds {rank} of {total}.",
  ]);
});

// ─── SEASON_DROP_LINES ───────────────────────────────────────────────────────

test("SEASON_DROP_LINES is deep-frozen { one, many }; many uses {count}, one uses no token", () => {
  assertDeepFrozen(SEASON_DROP_LINES, "SEASON_DROP_LINES");
  assert.deepStrictEqual(Object.keys(SEASON_DROP_LINES), ["one", "many"]);
  assert.deepStrictEqual(tokensIn(SEASON_DROP_LINES.one), []);
  assert.deepStrictEqual(tokensIn(SEASON_DROP_LINES.many), ["count"]);
  assert.equal(
    SEASON_DROP_LINES.one,
    "One unsent death belonged to a closed season. That ledger is sealed, so it was let go.",
  );
  assert.equal(
    SEASON_DROP_LINES.many,
    "{count} unsent deaths belonged to a closed season. That ledger is sealed, so they were let go.",
  );
});

// ─── rendering guards across every bank ──────────────────────────────────────

test("Every leaf is a non-empty string (hold excepted) with no markup, no WP and no @", () => {
  for (const [bank, obj] of Object.entries(ALL)) {
    for (const [p, v] of collectLeaves(obj, bank)) {
      if (p === "PLACEMENT_CARD.hold") continue;
      assert.equal(typeof v, "string", `${p} should be a string`);
      assert.ok(v.length > 0, `${p} should be non-empty`);
      assert.doesNotMatch(v, /[<>&]/, `${p} has a markup character -> "${v}"`);
      assert.doesNotMatch(v, /\bWP\b/i, `${p} says WP -> "${v}"`);
      assert.doesNotMatch(v, /@/, `${p} has a handle marker -> "${v}"`);
    }
  }
});

test("Every line in the placement bank is unique", () => {
  const lines = collectLeaves(PLACEMENT_LINES).map(([, v]) => v);
  assert.equal(new Set(lines).size, lines.length);
});
