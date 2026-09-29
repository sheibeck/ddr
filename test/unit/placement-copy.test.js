// test/unit/placement-copy.test.js
//
// Phase 85 (ACCT-04; 85-CONTEXT group 2) — pins content/placement.js: the
// DEPTH rank-quip bank (first / ten / hundred / rest — every run has its
// own rank now, so there is no "standing" band) and the deferred rail-card
// copy. Proves the shape (deep-frozen, no functions, exactly the keys this
// plan keeps), the token rules ({rank}, {total}, {ahead}, {count} only,
// where each band needs them), and the rendering guards (no markup
// characters, because the Oracle/rail render through innerHTML; no "WP";
// no "@" handle marker, because no line ever names another player; no
// retired board name or Play Games wording).

import test from "node:test";
import assert from "node:assert/strict";

import { PLACEMENT_LINES, PLACEMENT_CARD } from "../../content/placement.js";

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

const ALL = { PLACEMENT_LINES, PLACEMENT_CARD };

// ─── PLACEMENT_LINES ─────────────────────────────────────────────────────────

test("PLACEMENT_LINES is deep-frozen with exactly first/ten/hundred/rest — no standing band", () => {
  assertDeepFrozen(PLACEMENT_LINES, "PLACEMENT_LINES");
  assert.deepStrictEqual(Object.keys(PLACEMENT_LINES), ["first", "ten", "hundred", "rest"]);
});

test("PLACEMENT_LINES bank sizes: first/ten/hundred at least 3, rest at least 4", () => {
  assert.ok(PLACEMENT_LINES.first.length >= 3);
  assert.ok(PLACEMENT_LINES.ten.length >= 3);
  assert.ok(PLACEMENT_LINES.hundred.length >= 3);
  assert.ok(PLACEMENT_LINES.rest.length >= 4);
});

test("Every first line carries {total}; every ten/hundred/rest line carries {rank} and {total}", () => {
  for (const line of PLACEMENT_LINES.first) {
    assert.ok(tokensIn(line).includes("total"), `first -> "${line}"`);
  }
  for (const band of ["ten", "hundred", "rest"]) {
    for (const line of PLACEMENT_LINES[band]) {
      const t = tokensIn(line);
      assert.ok(t.includes("rank") && t.includes("total"), `${band} -> "${line}"`);
    }
  }
});

test("At least one rest line carries {ahead}", () => {
  assert.ok(PLACEMENT_LINES.rest.some((l) => tokensIn(l).includes("ahead")));
  assert.ok(PLACEMENT_LINES.rest.includes("You placed {rank} of {total}. The {ahead} ahead of you are also dead."));
});

test("PLACEMENT_LINES uses no token other than {rank}, {total} and {ahead}", () => {
  const allowed = new Set(["rank", "total", "ahead"]);
  for (const [p, v] of collectLeaves(PLACEMENT_LINES)) {
    for (const t of tokensIn(v)) assert.ok(allowed.has(t), `${p} uses {${t}}`);
  }
});

test("Every line starts with \"You placed {rank} of {total}.\" (first says 1st outright)", () => {
  for (const line of PLACEMENT_LINES.first) {
    assert.match(line, /^You placed 1st of \{total\}\./);
    assert.ok(!tokensIn(line).includes("rank"), `first -> "${line}"`);
  }
  for (const band of ["ten", "hundred", "rest"]) {
    for (const line of PLACEMENT_LINES[band]) {
      assert.match(line, /^You placed \{rank\} of \{total\}\./, `${band} -> "${line}"`);
    }
  }
});

// ─── PLACEMENT_CARD ──────────────────────────────────────────────────────────

test("PLACEMENT_CARD is deep-frozen with exactly title/tone/hold/one/many — no Standing variants", () => {
  assertDeepFrozen(PLACEMENT_CARD, "PLACEMENT_CARD");
  assert.deepStrictEqual(Object.keys(PLACEMENT_CARD).sort(), ["hold", "many", "one", "title", "tone"]);
});

test("PLACEMENT_CARD carries the THE LEDGER CAUGHT UP title, good tone and 12 s hold", () => {
  assert.equal(PLACEMENT_CARD.title, "THE LEDGER CAUGHT UP");
  assert.equal(PLACEMENT_CARD.tone, "good");
  assert.equal(PLACEMENT_CARD.hold, 12000);
});

test("PLACEMENT_CARD variants are non-empty arrays with the right tokens", () => {
  for (const v of ["one", "many"]) {
    assert.ok(Array.isArray(PLACEMENT_CARD[v]) && PLACEMENT_CARD[v].length > 0, v);
    for (const line of PLACEMENT_CARD[v]) {
      const t = tokensIn(line);
      assert.ok(t.includes("rank") && t.includes("total"), `${v} -> "${line}"`);
      if (v === "many") assert.ok(t.includes("count"), `${v} -> "${line}"`);
      else assert.ok(!t.includes("count"), `${v} -> "${line}"`);
      for (const tok of t) assert.ok(["rank", "total", "count"].includes(tok), `${v} uses {${tok}}`);
    }
  }
});

test("PLACEMENT_CARD pins the plan's lines verbatim", () => {
  assert.deepStrictEqual([...PLACEMENT_CARD.one], ["Your earlier death placed {rank} of {total} on DEPTH."]);
  assert.deepStrictEqual([...PLACEMENT_CARD.many], [
    "{count} earlier deaths reached the ledger. The best placed {rank} of {total} on DEPTH.",
  ]);
});

// ─── rendering guards across every bank ──────────────────────────────────────

test("Every leaf is a non-empty string (hold excepted) with no markup, no WP, no @ and no retired-service wording", () => {
  for (const [bank, obj] of Object.entries(ALL)) {
    for (const [p, v] of collectLeaves(obj, bank)) {
      if (p === "PLACEMENT_CARD.hold") continue;
      assert.equal(typeof v, "string", `${p} should be a string`);
      assert.ok(v.length > 0, `${p} should be non-empty`);
      assert.doesNotMatch(v, /[<>&]/, `${p} has a markup character -> "${v}"`);
      assert.doesNotMatch(v, /\bWP\b/i, `${p} says WP -> "${v}"`);
      assert.doesNotMatch(v, /@/, `${p} has a handle marker -> "${v}"`);
      assert.doesNotMatch(v, /play[ _-]?games/i, `${p} names the retired service -> "${v}"`);
      assert.doesNotMatch(v, /deepest/i, `${p} names the retired board -> "${v}"`);
    }
  }
});

test("Every line in the placement bank is unique", () => {
  const lines = collectLeaves(PLACEMENT_LINES).map(([, v]) => v);
  assert.equal(new Set(lines).size, lines.length);
});

test("SEASON_DROP_LINES no longer exists — every run has its own rank, there is no season-drop path", async () => {
  const mod = await import("../../content/placement.js");
  assert.equal(Object.prototype.hasOwnProperty.call(mod, "SEASON_DROP_LINES"), false);
});
