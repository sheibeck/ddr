// test/unit/fit-resume.test.js
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING G "Adjustment 3(c)", mid-54-07
// cycle 3) — direct, engine-free unit coverage for tools/lib/fit-resume.mjs:
// the Infinity/null replay bug (readLog rehydration) and a full search-level
// regression test proving a RESUMED walk reproduces the ORIGINAL walk even
// when the primed log contains an infeasible (score: Infinity, logged as
// null) row. Never imports the engine, worker_threads, or
// tools/fit-difficulty.mjs itself (which calls main() on direct execution) —
// a synthetic 2-coordinate SEARCH_PLAN-shaped bowl and a deterministic
// realEvaluate stand in for the real fit.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readLog, appendLog, rehydrateRow, makeResumableEvaluate, runSearch } from "../../tools/lib/fit-resume.mjs";

function tmpLogPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fit-resume-")), "log.jsonl");
}

// --- rehydrateRow / readLog -------------------------------------------------

test("rehydrateRow: a logged score:null (JSON.stringify's Infinity coercion) rehydrates to Infinity; a real numeric score, and null itself, pass through untouched", () => {
  assert.equal(rehydrateRow({ n: 1, score: null }).score, Infinity);
  assert.equal(rehydrateRow({ n: 1, score: 12.5 }).score, 12.5);
  assert.equal(rehydrateRow(null), null);
  assert.equal(rehydrateRow(undefined), undefined);
});

test("readLog: rehydrates every logged Infinity-serialized-as-null score before a resumed walk can reuse the row", () => {
  const logPath = tmpLogPath();
  appendLog(logPath, { n: 1, dials: { x: 1 }, score: 10, verdict: "MISS", constraints: { ok: true } });
  // JSON.stringify silently writes "score":null for an Infinity input — this
  // is the REAL on-disk shape a rejected candidate's row takes.
  appendLog(logPath, { n: 2, dials: { x: 2 }, score: Infinity, verdict: "MISS", constraints: { ok: false } });

  const raw = fs.readFileSync(logPath, "utf8");
  assert.ok(raw.includes('"score":null'), "sanity: JSON.stringify really did coerce Infinity to null on disk");

  const byN = readLog(logPath);
  assert.equal(byN.get(1).score, 10);
  assert.equal(byN.get(2).score, Infinity, "readLog must rehydrate the null back to Infinity");
});

test("readLog: a missing log file returns an empty Map", () => {
  assert.equal(readLog(null).size, 0);
  assert.equal(readLog(path.join(os.tmpdir(), "does-not-exist-fit-resume.jsonl")).size, 0);
});

// --- the walk-level regression: a resumed search reproduces the original --
//
// A minimal 2-coordinate synthetic search: dials = { a, b }, both integers.
// Candidate (a=2, b=1) — the VERY FIRST probe from the start point {a:1,b:1}
// — is deliberately INFEASIBLE (constraints.ok=false, score=Infinity, just
// like a real class-fairness rejection from fit-score.mjs#evalRow), so it
// reliably lands as the search's n=2 row (the bug this file guards against:
// on resume, that row's null-on-disk score must NOT be mistaken for a score
// of 0, which would make an infeasible candidate look like the best one).

const PLAN = [
  { path: ["a"], step: 1, lo: 0, hi: 3 },
  { path: ["b"], step: 1, lo: 0, hi: 3 },
];

function applyStep(dials, coord, dir) {
  const key = coord.path[0];
  const next = dials[key] + dir * coord.step;
  if (next < coord.lo || next > coord.hi) return null;
  return { ...dials, [key]: next };
}

/** A bowl minimized at a=0,b=2 (score 0, PASS), except (a=2,b=1) — the first probe off the {a:1,b:1} start — is INFEASIBLE. */
function scoreOf(dials) {
  if (dials.a === 2 && dials.b === 1) return { score: Infinity, ok: false };
  const score = dials.a ** 2 + (dials.b - 2) ** 2;
  return { score, ok: true };
}

function makeRealEvaluate(calls) {
  return async (n, dials) => {
    calls.push(n);
    const { score, ok } = scoreOf(dials);
    return { n, dials, score, verdict: score === 0 ? "PASS" : "MISS", constraints: { ok } };
  };
}

test("a search resumed from a log containing an infeasible row reproduces the original walk (USER RULING G Adjustment 3(c))", async () => {
  // 1) The ORIGINAL, unresumed walk — also writes every row to disk (a
  // real interrupted CLI run's fit-log.jsonl).
  const fullLogPath = tmpLogPath();
  const freshCalls = [];
  const freshEvaluate = makeResumableEvaluate({
    loggedByN: new Map(),
    budget: 12,
    realEvaluate: makeRealEvaluate(freshCalls),
    onRow: (row) => appendLog(fullLogPath, row),
  });
  const fresh = await runSearch({ startDials: { a: 1, b: 1 }, evaluate: freshEvaluate, searchPlan: PLAN, applyStep });

  const fullLines = fs.readFileSync(fullLogPath, "utf8").trim().split("\n");
  assert.ok(fullLines.length >= 3, "the fresh walk must produce at least 3 rows for this test to prime a partial log");
  const row2 = JSON.parse(fullLines[1]);
  assert.equal(row2.n, 2);
  assert.equal(row2.score, null, "sanity: the infeasible n=2 row's Infinity score really did serialize as null on disk");

  // 2) Prime a resume log with just the first 3 rows (n=1,2,3) — as a real
  // interrupted CLI run would leave on disk — then resume from there.
  const resumeLogPath = tmpLogPath();
  fs.writeFileSync(resumeLogPath, `${fullLines.slice(0, 3).join("\n")}\n`);
  const loggedByN = readLog(resumeLogPath);
  assert.equal(loggedByN.get(2).score, Infinity, "readLog must rehydrate n=2's score before the resumed walk can reuse it");

  const resumedCalls = [];
  const resumedEvaluate = makeResumableEvaluate({
    loggedByN,
    budget: 12,
    realEvaluate: makeRealEvaluate(resumedCalls),
  });
  const resumed = await runSearch({ startDials: { a: 1, b: 1 }, evaluate: resumedEvaluate, searchPlan: PLAN, applyStep });

  // 3) The resumed walk must land on the EXACT same best candidate as the
  // original, unresumed walk — the bug (null coerced to 0 in `row.score <
  // baseScore`) would make the resumed walk treat the infeasible n=2 row as
  // the best-scoring candidate of the whole search and diverge from here.
  assert.deepStrictEqual(resumed.best.dials, fresh.best.dials, "the resumed walk must land on the SAME best candidate as the original, unresumed walk");
  assert.equal(resumed.best.score, fresh.best.score);
  assert.equal(resumed.stopped, fresh.stopped);

  // 4) n=1..3 (including the infeasible n=2) were reused from the log, never
  // re-evaluated — the resumed run's realEvaluate is called ONLY for
  // candidates beyond what was primed.
  assert.ok(!resumedCalls.includes(1) && !resumedCalls.includes(2) && !resumedCalls.includes(3), `n=1..3 must be reused from the log, never re-evaluated: got calls ${JSON.stringify(resumedCalls)}`);
  assert.ok(resumedCalls.length < freshCalls.length, "the resumed run must spend less real-evaluate work than the original (the primed rows are free)");
});

test("makeResumableEvaluate: candidate n beyond the budget returns null without invoking realEvaluate", async () => {
  const calls = [];
  const evaluate = makeResumableEvaluate({ loggedByN: new Map(), budget: 1, realEvaluate: makeRealEvaluate(calls) });
  const first = await evaluate({ a: 1, b: 1 });
  assert.ok(first);
  const second = await evaluate({ a: 2, b: 1 });
  assert.equal(second, null, "budget exhausted -> null, the search's own stop signal");
  assert.deepStrictEqual(calls, [1]);
});

test("makeResumableEvaluate: a logged row whose dials do NOT byte-match the nth candidate this walk produced is treated as unlogged (re-evaluated fresh)", async () => {
  const loggedByN = new Map([[1, { n: 1, dials: { a: 99, b: 99 }, score: 5, verdict: "MISS", constraints: { ok: true } }]]);
  const calls = [];
  const evaluate = makeResumableEvaluate({ loggedByN, budget: 5, realEvaluate: makeRealEvaluate(calls) });
  const row = await evaluate({ a: 1, b: 1 }); // does NOT match the logged n=1's dials {a:99,b:99}
  assert.deepStrictEqual(calls, [1], "a dials mismatch must fall through to realEvaluate, never silently reuse a stale row");
  assert.equal(row.dials.a, 1);
});
