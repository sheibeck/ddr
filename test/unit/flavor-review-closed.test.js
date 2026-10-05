// test/unit/flavor-review-closed.test.js
//
// Phase 96 (FLAVOR-06; CONTEXT 'The review: Verdicts'), plan 96-11: the
// standing guard that the review stays CLOSED. flavor-review.test.js proves the
// mechanism against fixtures; this file proves the live state:
//   1. the committed verdict files are consecutive rounds from 1; round 1
//      covers every reviewed key except the declared post-round-1 lines (the
//      96-12 active-skill lines, which round 1 never saw and which get a first
//      verdict in a later round, never a back-dated round-1 row); every later
//      round's reviewer string differs from every earlier round's (the
//      independence boundary, T-96-32);
//   2. validateClosed over the committed verdicts and the live ledgers returns
//      no errors: every reviewed key's latest verdict is a pass whose hash is
//      the hash of the line the game prints now (a rewrite after the last
//      verdict fails by key, T-96-33). A stale line, a latest revise and an
//      unreviewed key are each proven to fail by name on doctored copies;
//   3. selfChecked rows (the rewriting agent checked its own rewrite) are
//      bounded by the number of round-2 revise rows, userOwned rows by the
//      size of USER_OWNED_LINES, and both lists are printed for the SUMMARY
//      and the user's own read;
//   4. the committed review pages equal a fresh generation, so the page lists
//      each text with its verdict (ROADMAP criterion 3).

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import url from "node:url";

import {
  LEDGER_DIR, VERDICT_DIR, POST_ROUND1_PLANS, USER_OWNED_LINES,
  lineHash, readVerdicts, reviewedLines, validateClosed,
} from "../../tools/lib/flavor-review.mjs";
import { checkPages } from "../../tools/narrative-review.mjs";
import { readLedgers } from "../../tools/lib/voice-checks.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const lines = reviewedLines({ ledgers: readLedgers(path.join(ROOT, LEDGER_DIR)) });
const verdicts = readVerdicts(path.join(ROOT, VERDICT_DIR));
const judged = (r) => r && (r.verdict === "pass" || r.verdict === "revise");
const names = (errors) => errors.join("\n");

test("closed 1: the verdict files are consecutive rounds from 1, round 1 covers every line it could see, each later reviewer is a new one", () => {
  assert.ok(verdicts.length >= 1, "at least the round-1 file is committed");
  assert.deepStrictEqual(verdicts.filter((v) => v.parseError).map((v) => v.file), [], "every verdict file parses");
  const rounds = verdicts.map((v) => v.round);
  assert.deepStrictEqual(rounds, rounds.map((_, i) => i + 1), "rounds are 1, 2, 3 ... in file order, with no gap and no repeat");

  const late = lines.filter((l) => POST_ROUND1_PLANS.includes(l.first)).map((l) => l.key);
  const round1 = new Set(verdicts[0].rows.map((r) => r.key));
  assert.deepStrictEqual(lines.filter((l) => !late.includes(l.key) && !round1.has(l.key)).map((l) => l.key), [], "round 1 misses a line it could see");
  assert.deepStrictEqual(late.filter((k) => round1.has(k)), [], "round 1 holds a verdict for a line added after it");
  assert.ok(verdicts[0].rows.every(judged), "round 1 judged every line it lists");
  for (const k of late) {
    assert.ok(verdicts.slice(1).some((v) => v.rows.some((r) => r.key === k && judged(r))), `${k}: added after round 1 and not judged in a later round`);
  }

  const seen = [];
  for (const v of verdicts) {
    assert.equal(typeof v.reviewer, "string");
    assert.ok(v.reviewer.trim() !== "", `${v.file}: a reviewer is named`);
    assert.ok(!seen.includes(v.reviewer.trim()), `${v.file}: reviewer "${v.reviewer}" also judged an earlier round`);
    seen.push(v.reviewer.trim());
  }
});

test("closed 2: validateClosed over the committed verdicts returns no errors; a stale line, a latest revise and an unreviewed key each fail by key", () => {
  const live = validateClosed({ verdicts, lines });
  assert.deepStrictEqual(live.errors, [], names(live.errors));
  // Phase 97.1 (FLAVOR-07): declared re-pin, 236 to 233 after the three RULES_COPY toggle words were retired.
  assert.ok(lines.length >= 233, `the Phase 95 and 96 lines (225 at round 1, 236 after 96-12, 233 after the toggle words went) are all reviewed, saw ${lines.length}`);

  // a line rewritten after its last verdict is stale, and the error names the key
  const target = lines.find((l) => l.key === "bank:SKILL_FLAVOR.Kata");
  assert.ok(target, "the Kata skill line is reviewed");
  const rewritten = lines.map((l) => (l.key === target.key ? { ...l, line: `${l.line} (reworded)` } : l));
  const stale = validateClosed({ verdicts, lines: rewritten }).errors;
  assert.ok(stale.some((e) => e.startsWith(`${target.key}: stale`)), names(stale));

  // a key whose latest verdict is a revise is not closed
  const flipped = structuredClone(verdicts);
  const lastRow = flipped[flipped.length - 1].rows[0];
  Object.assign(lastRow, { verdict: "revise", fails: ["voice"], note: "Doctored copy: this must fail the closed check." });
  delete lastRow.selfChecked;
  const open = validateClosed({ verdicts: flipped, lines }).errors;
  assert.ok(open.some((e) => e.startsWith(`${lastRow.key}: latest verdict is revise`)), names(open));

  // a key with no verdict at all is unreviewed
  const gone = structuredClone(verdicts).map((v) => ({ ...v, rows: v.rows.filter((r) => r.key !== target.key) }));
  const unreviewed = validateClosed({ verdicts: gone, lines }).errors;
  assert.ok(unreviewed.some((e) => e.startsWith(`${target.key}: unreviewed`)), names(unreviewed));

  // a pass at the wrong wording (a hash that is not the current line's) is stale too
  const wrongHash = structuredClone(verdicts);
  const row = wrongHash.flatMap((v) => v.rows).find((r) => r.key === target.key);
  row.h = lineHash("some other wording");
  assert.ok(validateClosed({ verdicts: wrongHash, lines }).errors.some((e) => e.startsWith(`${target.key}: stale`)));
});

test("closed 3: selfChecked rows are bounded by the round-2 revise rows, userOwned rows by USER_OWNED_LINES, and both are listed", (t) => {
  const round2Revise = (verdicts.find((v) => v.round === 2)?.rows ?? []).filter((r) => r.verdict === "revise");
  const { selfChecked } = validateClosed({ verdicts, lines });
  const userOwned = verdicts.flatMap((v) => v.rows.filter((r) => r.userOwned === true).map((r) => ({ key: r.key, round: v.round, file: v.file })));
  t.diagnostic(`selfChecked (${selfChecked.length}): ${selfChecked.map((s) => `${s.key} [round ${s.round}]`).join("; ") || "none"}`);
  t.diagnostic(`userOwned (${userOwned.length}): ${userOwned.map((s) => `${s.key} [round ${s.round}]`).join("; ") || "none"}`);
  assert.ok(selfChecked.length <= round2Revise.length, `${selfChecked.length} selfChecked rows but only ${round2Revise.length} round-2 revise rows`);
  assert.ok(userOwned.length <= USER_OWNED_LINES.length, `${userOwned.length} userOwned rows but only ${USER_OWNED_LINES.length} user-owned lines`);
  // a selfChecked row answers a round-2 revise on the same key, and is the later round's, never round 1 or 2
  const revised = new Set(round2Revise.map((r) => r.key));
  for (const s of selfChecked) {
    assert.ok(revised.has(s.key), `${s.key}: selfChecked without a round-2 revise`);
    assert.ok(s.round >= 3, `${s.key}: a selfChecked row belongs to the round after the revise`);
  }
  for (const u of userOwned) assert.ok(USER_OWNED_LINES.includes(u.key), u.key);
});

test("closed 4: the committed review pages equal a fresh generation, so they list each text with its verdict", () => {
  const { ok, problems } = checkPages({ root: ROOT });
  assert.ok(ok, problems.join("\n"));
});
