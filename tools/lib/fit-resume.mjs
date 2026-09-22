// tools/lib/fit-resume.mjs
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING G "Adjustment 3(c)", mid-54-07
// cycle 3) — the PURE, engine-free replay/resume machinery
// tools/fit-difficulty.mjs's CLI wires against its real worker-threaded
// evaluator. Split out of fit-difficulty.mjs (which imports worker_threads
// and the engine at module load, and calls main() when run directly as a
// script) so this file is directly importable/unit-testable — no worker
// threads, no engine, no process.argv parsing, no side effects on import.
//
// THE BUG THIS FILE FIXES (todo 2026-09-21-fit-tool-replay-resume-diverges-
// after-an-infeasible-point): a rejected/infeasible candidate's `score` is
// `Infinity` (fit-score.mjs#evalRow — the REJECTED-candidate rule). JSON has
// no Infinity literal — `JSON.stringify({ score: Infinity })` silently
// writes `"score":null`. The OLD `readLog` handed that `null` straight back
// to `walkCoordinate`'s `row.score < baseScore` comparison — and in JS,
// `null < N` coerces `null` to `0`, so a resumed search reusing an
// infeasible logged row would treat it as the BEST score of the entire walk
// (better than any real, feasible candidate), silently steering every later
// probe off the path the ORIGINAL (non-resumed) walk would have taken.
// `rehydrateRow` undoes the coercion the moment a row comes off disk, before
// it can re-enter any comparison.

import fs from "node:fs";
import path from "node:path";

/**
 * rehydrateRow(obj) — undoes JSON.stringify's Infinity -> null coercion on
 * `score`. A logged `score: null` can ONLY mean "this row was Infinity when
 * logged" (evalRow never logs a genuine `null` score) — never any other
 * rehydration. Passing `null`/`undefined` through unchanged (defensive).
 */
export function rehydrateRow(obj) {
  return obj && obj.score === null ? { ...obj, score: Infinity } : obj;
}

/**
 * readLog(logPath) — every already-logged evaluation row, keyed by `n` (a
 * Map), rehydrated (see module header), or an empty Map if the file does
 * not exist.
 */
export function readLog(logPath) {
  const byN = new Map();
  if (!logPath || !fs.existsSync(logPath)) return byN;
  const lines = fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    const obj = JSON.parse(line);
    if (typeof obj.n === "number") byN.set(obj.n, rehydrateRow(obj));
  }
  return byN;
}

/**
 * appendLog(logPath, obj) — appends ONE JSON line (JSONL, append-only).
 * No-op when `logPath` is null.
 */
export function appendLog(logPath, obj) {
  if (!logPath) return;
  const dir = path.dirname(logPath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(obj)}\n`);
}

/**
 * makeResumableEvaluate({ loggedByN, budget, realEvaluate, onRow }) — the
 * search's per-candidate evaluator. Candidate n beyond `budget` returns
 * `null` (the search's own stop signal). Otherwise: when candidate n was
 * already logged AND its logged `dials` byte-match the dials the
 * (deterministic) walk produced this time, the (rehydrated) logged row is
 * reused verbatim — zero evaluation cost, zero re-appended log line.
 * Otherwise `realEvaluate(n, dials)` runs fresh and `onRow(row)` fires once
 * (the CLI's console.log/appendLog hook) before the row is returned.
 */
export function makeResumableEvaluate({ loggedByN, budget, realEvaluate, onRow = () => {} }) {
  let n = 0;
  return async function evaluate(dials) {
    n++;
    if (n > budget) return null;
    const logged = loggedByN.get(n);
    if (logged && JSON.stringify(logged.dials) === JSON.stringify(dials)) {
      return logged;
    }
    const row = await realEvaluate(n, dials);
    onRow(row);
    return row;
  };
}

/**
 * walkCoordinate(current, currentScore, coord, stepScale, evaluate,
 * applyStep) — probes `+1` first (skipped if applyStep returns null, i.e.
 * already at the bound); if the score strictly improves, accepts and keeps
 * stepping the SAME direction (up to 2 more times, 3 total) while it keeps
 * improving; otherwise probes `-1` the same way. Returns `{ current, score,
 * stop, passed }` — `stop: true` means the budget ran out (evaluate
 * returned `null`) or a PASS+ok candidate was found (`passed: true`).
 */
export async function walkCoordinate(current, currentScore, coord, stepScale, evaluate, applyStep) {
  for (const dir of [1, -1]) {
    let base = current;
    let baseScore = currentScore;
    let steps = 0;
    let improvedAny = false;
    while (steps < 3) {
      const probe = applyStep(base, coord, dir, stepScale);
      if (probe === null) break;
      const row = await evaluate(probe);
      if (row === null) return { current: base, score: baseScore, stop: true, passed: false };
      steps++;
      if (row.score < baseScore) {
        base = probe;
        baseScore = row.score;
        improvedAny = true;
        if (row.verdict === "PASS" && row.constraints.ok) {
          return { current: base, score: baseScore, stop: true, passed: true };
        }
      } else {
        break;
      }
    }
    if (improvedAny) return { current: base, score: baseScore, stop: false, passed: false };
  }
  return { current, score: currentScore, stop: false, passed: false };
}

/**
 * runSearch({ startDials, evaluate, searchPlan, applyStep }) — PASS 1 over
 * `searchPlan`'s coordinates (in order, full step), then PASS 2 (the same
 * coordinates, stepScale 0.5). Every held dial is carried through untouched
 * from `startDials` (walkCoordinate/applyStep only ever touch the ONE
 * coordinate's own path). Stops early on budget exhaustion or a PASS+ok
 * candidate.
 */
export async function runSearch({ startDials, evaluate, searchPlan, applyStep }) {
  const startRow = await evaluate(startDials);
  if (startRow === null) return { best: null, stopped: "budget" };
  let best = startRow;
  let current = startDials;
  let currentScore = startRow.score;
  if (startRow.verdict === "PASS" && startRow.constraints.ok) return { best: startRow, stopped: "pass" };

  const trackBest = async (dials) => {
    const row = await evaluate(dials);
    if (row && row.score < best.score) best = row;
    return row;
  };

  for (const pass of [1, 2]) {
    const stepScale = pass === 1 ? 1 : 0.5;
    for (const coord of searchPlan) {
      const result = await walkCoordinate(current, currentScore, coord, stepScale, trackBest, applyStep);
      current = result.current;
      currentScore = result.score;
      if (result.stop) return { best, stopped: result.passed ? "pass" : "budget" };
    }
  }
  return { best, stopped: "plan-exhausted" };
}
