// test/unit/class-pass-diff.test.js
//
// Phase 26 (PLAY-02) — pins tools/class-pass-diff.mjs's pure helpers and
// CLI: the closed band-interval edges, the cannot-act rule (0.5 is NOT
// cannot-act, 0.49 is), the null-not-NaN discipline on an all-stuck cell,
// the harness's rankCells ordering re-derived through rankRollupRows, the
// missing-BEFORE-cell tolerance, the self-diff invariants (delta 0/null,
// verdict/reason/lever null, no band on a deep row), the editorial merge
// (copy-by-key, reject an unknown verdict, idempotent), Markdown section
// rendering, CLI byte-stability across two runs, the --gate exit code, and
// module purity. Never asserts a real death-depth/rank number as a target
// — before.json is used as a synthetic AFTER, exactly as the harness
// produced it, so every assertion is about the SCRIPT's rules, not the
// game's balance (mirrors test/unit/class-matrix.test.js's own discipline).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import url from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

import {
  BAND_ORDER,
  cellKey,
  muOverRuns,
  bandFor,
  isCannotAct,
  rowBand,
  metaParity,
  rankRollupRows,
  buildVerdicts,
  mergeEditorial,
  renderMarkdown,
} from "../../tools/class-pass-diff.mjs";
import { rankCells } from "../../tools/lib/class-matrix.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(REPO_ROOT, "tools", "class-pass-diff.mjs");
const BEFORE_PATH = path.join(REPO_ROOT, "docs", "class-pass", "before.json");
const BEFORE_DEEP_PATH = path.join(REPO_ROOT, "docs", "class-pass", "before-depth20.json");

const before = JSON.parse(fs.readFileSync(BEFORE_PATH, "utf8"));
const beforeDeep = JSON.parse(fs.readFileSync(BEFORE_DEEP_PATH, "utf8"));

// --- (1) bandFor -------------------------------------------------------

test("bandFor: closed interval — exactly 0.75mu and 1.35mu are fine; strictly below/above are too weak/too strong", () => {
  const mu = 3;
  assert.equal(bandFor(0.75 * mu, mu), "fine");
  assert.equal(bandFor(1.35 * mu, mu), "fine");
  assert.equal(bandFor(0.75 * mu - 1e-9, mu), "too weak");
  assert.equal(bandFor(1.35 * mu + 1e-9, mu), "too strong");
  assert.equal(bandFor(null, mu), null);

  const realMu = muOverRuns(before);
  assert.equal(bandFor(0.75 * realMu, realMu), "fine");
  assert.equal(bandFor(1.35 * realMu, realMu), "fine");
  assert.equal(bandFor(0.75 * realMu - 1e-9, realMu), "too weak");
  assert.equal(bandFor(1.35 * realMu + 1e-9, realMu), "too strong");
});

// --- (2) isCannotAct/rowBand + NaN walk ---------------------------------

test("isCannotAct/rowBand: meanKills exactly 0.5 is not cannot-act; 0.49 is; stuck > 0 is; completed 0 is cannot-act with null depth stats and no NaN", () => {
  assert.equal(isCannotAct({ meanKills: 0.5, stuck: 0, completed: 40, meanDepth: 3 }), false);
  assert.equal(isCannotAct({ meanKills: 0.49, stuck: 0, completed: 40, meanDepth: 3 }), true);
  assert.equal(isCannotAct({ meanKills: 9, stuck: 1, completed: 39, meanDepth: 3 }), true);

  const allStuck = { n: 40, completed: 0, stuck: 40, meanDepth: null, meanKills: null, reach5: null, p50Depth: null };
  assert.equal(isCannotAct(allStuck), true);
  assert.equal(rowBand(allStuck, 3), "cannot act");

  const afterCopy = JSON.parse(JSON.stringify(before));
  afterCopy.cells[0] = {
    ...afterCopy.cells[0],
    n: 40,
    completed: 0,
    stuck: 40,
    meanDepth: null,
    p50Depth: null,
    p90Depth: null,
    reach5: null,
    reach10: null,
    meanKills: null,
    meanLevel: null,
    meanActions: null,
    meanFloorsGained: null,
    p50FloorsGained: null,
    meanEncountersSurvived: null,
    topCauses: [],
  };
  const v = buildVerdicts({ before, after: afterCopy, beforeDeep, afterDeep: beforeDeep });
  const walk = (obj, seen = new Set()) => {
    if (obj === null || typeof obj !== "object" || seen.has(obj)) return;
    seen.add(obj);
    for (const val of Object.values(obj)) {
      if (typeof val === "number") assert.ok(!Number.isNaN(val), "found NaN in verdicts object");
      walk(val, seen);
    }
  };
  walk(v);
});

// --- (3) muOverRuns -------------------------------------------------------

test("muOverRuns: run-weighted over cells with completed > 0, recomputed independently; null with no completed runs", () => {
  let weighted = 0;
  let totalCompleted = 0;
  for (const c of before.cells) {
    if (c.completed > 0) {
      weighted += c.meanDepth * c.completed;
      totalCompleted += c.completed;
    }
  }
  const recomputed = weighted / totalCompleted;
  assert.ok(Math.abs(muOverRuns(before) - recomputed) < 1e-9);

  const allZero = { cells: before.cells.map((c) => ({ ...c, completed: 0 })) };
  assert.equal(muOverRuns(allZero), null);
});

// --- (4) metaParity -------------------------------------------------------

test("metaParity: the natural pair is identical modulo commit; natural vs depth-20 reports seeds/startDepth/bot", () => {
  assert.equal(metaParity(before.meta, before.meta).ok, true);
  const mismatches = metaParity(before.meta, beforeDeep.meta).mismatches;
  assert.ok(mismatches.includes("seeds"));
  assert.ok(mismatches.includes("startDepth"));
  assert.ok(mismatches.includes("bot"));

  const differentCommit = { ...before.meta, commit: "deadbee" };
  assert.equal(metaParity(before.meta, differentCommit).ok, true);
});

// --- (5) ordering -------------------------------------------------------

test("ordering: subs/races/cells follow rankCells; re-ranking before.json's cells reproduces the stored rank; appendix is band-ordered then AFTER rank; ties break by key asc", () => {
  assert.deepStrictEqual(rankCells(before.cells).map((c) => c.rank), before.cells.map((c) => c.rank));
  assert.deepStrictEqual(rankRollupRows(before.rollups.bySub).map((r) => r.key), before.rollups.bySub.map((r) => r.key));

  const tie = { meanDepth: 5, p50Depth: 5, reach5: 50 };
  const rows = [
    { key: "z", ...tie },
    { key: "a", ...tie },
    { key: "m", ...tie },
  ];
  assert.deepStrictEqual(rankRollupRows(rows).map((r) => r.key), ["a", "m", "z"]);

  const v = buildVerdicts({ before, after: before, beforeDeep, afterDeep: beforeDeep });
  const bandIdx = v.cells.outOfBand.map((c) => BAND_ORDER.indexOf(c.band));
  for (let i = 1; i < bandIdx.length; i++) assert.ok(bandIdx[i] >= bandIdx[i - 1], "band sequence must be non-decreasing");
  for (let i = 1; i < v.cells.outOfBand.length; i++) {
    if (v.cells.outOfBand[i].band === v.cells.outOfBand[i - 1].band) {
      assert.ok(v.cells.outOfBand[i].rank > v.cells.outOfBand[i - 1].rank, "rank must strictly increase within a band");
    }
  }
});

// --- (6) missing BEFORE cell ---------------------------------------------

test("missing BEFORE cell: delta null, Markdown shows n/a, no throw", () => {
  const beforeCopy = JSON.parse(JSON.stringify(before));
  const removedCell = beforeCopy.cells[0]; // Thief/Ninja/Wilmsry, rank 1 — verified out-of-band ("too strong") in the self-diff
  beforeCopy.cells = beforeCopy.cells.slice(1);
  beforeCopy.rollups.bySub = beforeCopy.rollups.bySub.filter((r) => r.key !== removedCell.sub);

  let v;
  assert.doesNotThrow(() => {
    v = buildVerdicts({ before: beforeCopy, after: before, beforeDeep, afterDeep: beforeDeep });
  });

  const subRow = v.subs.find((r) => r.key === removedCell.sub);
  assert.equal(subRow.before, null);
  assert.equal(subRow.delta, null);

  const cellRow = v.cells.outOfBand.find((c) => c.key === cellKey(removedCell));
  assert.ok(cellRow, "the removed cell is expected to be out-of-band in the self-diff");
  assert.equal(cellRow.before, null);
  assert.equal(cellRow.delta, null);

  const md = renderMarkdown(v, "after");
  assert.ok(md.includes("n/a"));
});

// --- (7) self-diff -------------------------------------------------------

test("self-diff: before vs before -> every delta is 0 or null; inBand + outOfBand.length === 143; verdict/reason/lever null on every row; no deep row carries a band or verdict", () => {
  const v = buildVerdicts({ before, after: before, beforeDeep, afterDeep: beforeDeep });
  const checkDelta = (d) => assert.ok(d === 0 || d === null, `expected delta 0 or null, got ${d}`);

  for (const r of v.classes) checkDelta(r.delta);
  for (const r of v.subs) {
    checkDelta(r.delta);
    assert.equal(r.verdict, null);
    assert.equal(r.reason, null);
    assert.equal(r.lever, null);
  }
  for (const r of v.races) {
    checkDelta(r.delta);
    assert.equal(r.verdict, null);
    assert.equal(r.reason, null);
    assert.equal(r.lever, null);
  }
  for (const c of v.cells.outOfBand) checkDelta(c.delta);
  assert.equal(v.cells.inBand + v.cells.outOfBand.length, 143);

  for (const group of [v.deep.byClass, v.deep.bySub, v.deep.byRace]) {
    for (const r of group) {
      assert.ok(!("band" in r), "deep rows never carry a band");
      assert.ok(!("verdict" in r), "deep rows never carry a verdict");
    }
  }

  assert.equal(v.cannotAct.length, 0);
  assert.equal(v.meta.mu.after, v.meta.mu.before);
});

// --- (8) mergeEditorial -------------------------------------------------------

test("mergeEditorial: copies verdict/reason/lever by key, rejects unknown verdict values, idempotent", () => {
  const v = buildVerdicts({ before, after: before, beforeDeep, afterDeep: beforeDeep });
  const firstSubKey = v.subs[0].key;
  const firstRaceKey = v.races[0].key;
  const prior = {
    subs: [{ key: firstSubKey, verdict: "revisit", reason: "r", lever: "l" }],
    races: [{ key: firstRaceKey, verdict: "accept", reason: "ok" }],
  };

  const merged = mergeEditorial(JSON.parse(JSON.stringify(v)), prior);
  const subRow = merged.subs.find((r) => r.key === firstSubKey);
  assert.equal(subRow.verdict, "revisit");
  assert.equal(subRow.reason, "r");
  assert.equal(subRow.lever, "l");
  const raceRow = merged.races.find((r) => r.key === firstRaceKey);
  assert.equal(raceRow.verdict, "accept");
  assert.equal(raceRow.reason, "ok");
  assert.equal(raceRow.lever, null);
  for (const r of merged.subs) {
    if (r.key !== firstSubKey) {
      assert.equal(r.verdict, null);
      assert.equal(r.reason, null);
      assert.equal(r.lever, null);
    }
  }
  for (const r of merged.races) {
    if (r.key !== firstRaceKey) {
      assert.equal(r.verdict, null);
      assert.equal(r.reason, null);
      assert.equal(r.lever, null);
    }
  }

  assert.throws(() => mergeEditorial(JSON.parse(JSON.stringify(v)), { subs: [{ key: firstSubKey, verdict: "maybe" }], races: [] }));

  const freshBuild = buildVerdicts({ before, after: before, beforeDeep, afterDeep: beforeDeep });
  const reMerged = mergeEditorial(freshBuild, { subs: merged.subs, races: merged.races });
  const rebuiltFromMerged = buildVerdicts({
    before,
    after: before,
    beforeDeep,
    afterDeep: beforeDeep,
    prior: { subs: merged.subs, races: merged.races },
  });
  assert.deepStrictEqual(reMerged, rebuiltFromMerged);
});

// --- (9) renderMarkdown -------------------------------------------------------

test("renderMarkdown: outliers says the no-revisit sentence when empty and lists the revisit row with its lever when present; handoff has its heading and the accepted-but-strong list; after starts with the cannot-act headline and its seven H3 headings in order", () => {
  const v = buildVerdicts({ before, after: before, beforeDeep, afterDeep: beforeDeep });

  const emptyOutliers = renderMarkdown(v, "outliers");
  assert.ok(emptyOutliers.includes("No revisit rows — every out-of-band row was accepted."));

  const firstSubKey = v.subs[0].key;
  const withPrior = buildVerdicts({
    before,
    after: before,
    beforeDeep,
    afterDeep: beforeDeep,
    prior: { subs: [{ key: firstSubKey, verdict: "revisit", reason: "r", lever: "l" }], races: [] },
  });
  const outliersWithRow = renderMarkdown(withPrior, "outliers");
  assert.ok(outliersWithRow.includes(firstSubKey));
  assert.ok(outliersWithRow.includes("revisit"));
  assert.ok(outliersWithRow.includes("r"));
  assert.ok(outliersWithRow.includes("l"));

  const handoff = renderMarkdown(v, "handoff");
  assert.ok(handoff.startsWith("## Handoff to Phase 27"));
  assert.ok(handoff.includes("### Accepted-but-strong rows"));

  const after = renderMarkdown(v, "after");
  assert.ok(after.startsWith("**Zero cannot-act cells.**"));
  const headings = [...after.matchAll(/^### .+$/gm)].map((m) => m[0]);
  assert.deepStrictEqual(headings, [
    "### By class — BEFORE → AFTER",
    "### Sub-classes — bottom five and top five (AFTER)",
    "### Races — BEFORE → AFTER (Human is the control)",
    "### Sub-classes — all 24 rows (AFTER rank order)",
    "### Reach table (AFTER natural, pooled over completed runs)",
    "### Depth-20 slice — Phase 27's yardstick (no verdicts)",
    "### Out-of-band cells (appendix)",
  ]);
});

// --- (10) CLI determinism -------------------------------------------------------

test("CLI determinism: two runs on the same inputs are byte-identical (stdout and --out-verdicts); --json equals the written file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "class-pass-diff-"));
  try {
    const out1 = path.join(tmpDir, "v1.json");
    const out2 = path.join(tmpDir, "v2.json");
    const run = (outPath) =>
      execFileSync(process.execPath, [SCRIPT, "--after", BEFORE_PATH, "--after-deep", BEFORE_DEEP_PATH, "--out-verdicts", outPath], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });

    const stdout1 = run(out1);
    const stdout2 = run(out2);
    assert.equal(stdout1, stdout2);
    assert.equal(fs.readFileSync(out1, "utf8"), fs.readFileSync(out2, "utf8"));

    const jsonOut = execFileSync(process.execPath, [SCRIPT, "--after", BEFORE_PATH, "--after-deep", BEFORE_DEEP_PATH, "--json"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.deepStrictEqual(JSON.parse(jsonOut), JSON.parse(fs.readFileSync(out1, "utf8")));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- (11) CLI --gate -------------------------------------------------------

test("CLI --gate: exit 0 with 'cannot-act cells: 0 of 143' on before.json; exit 3 listing the cell on a synthetic copy with one meanKills 0.3 cell", () => {
  const r1 = spawnSync(process.execPath, [SCRIPT, "--gate", "--after", BEFORE_PATH], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(r1.status, 0);
  assert.ok(r1.stdout.includes("cannot-act cells: 0 of 143"));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "class-pass-diff-gate-"));
  try {
    const modified = JSON.parse(fs.readFileSync(BEFORE_PATH, "utf8"));
    modified.cells[0] = { ...modified.cells[0], meanKills: 0.3 };
    const modPath = path.join(tmpDir, "after-bad.json");
    fs.writeFileSync(modPath, JSON.stringify(modified));

    const r2 = spawnSync(process.execPath, [SCRIPT, "--gate", "--after", modPath], { cwd: REPO_ROOT, encoding: "utf8" });
    assert.equal(r2.status, 3);
    assert.ok(r2.stdout.includes(cellKey(modified.cells[0])));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- (12) purity -------------------------------------------------------

test("purity: no Math.random/Date.now/new Date/process-spawning/engine or content imports on non-comment lines", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  const codeLines = src.split("\n").filter((line) => !/^\s*(\/\/|\/?\*)/.test(line));
  assert.ok(
    !codeLines.some((line) => /Math\.random|Date\.now|new Date\(|child_process|worker_threads|from ["']\.\.\/engine|from ["']\.\.\/content/.test(line)),
  );
});
