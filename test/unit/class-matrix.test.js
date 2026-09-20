// test/unit/class-matrix.test.js
//
// Phase 22 (HARN-03) — pins tools/lib/class-matrix.mjs's pure helpers: cell
// enumeration/exclusion, name resolution, seed list, per-cell aggregation
// (stuck-aware, null-safe), ranking tie-break, roll-ups, report/text
// building, the force pass-through smoke test (HARN-01 via the bot), and
// module purity. Never asserts a death-depth/rank number from a real
// playRun — this stays a proxy, not a gate (see tools/lib/tuning-bot.mjs's
// own file-header discipline).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  enumerateCells,
  EXCLUDED_CELLS,
  resolveName,
  resolveForce,
  selectCells,
  seedList,
  rowFromRun,
  summarizeRows,
  pooledSummary,
  rankCells,
  rollups,
  buildReport,
  formatText,
  formatUsageMarkdown,
} from "../../tools/lib/class-matrix.mjs";
import { playRun, BOT_DEFAULTS, RUN_FLAGS } from "../../tools/lib/tuning-bot.mjs";
import { CLASSES, RACES, ABILITIES, SPELLS } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// --- (1) enumerateCells --------------------------------------------------

test("enumerateCells: 143 canonical cells, no excluded triple, 24 subs, 6 races", () => {
  const cells = enumerateCells();
  assert.equal(cells.length, 143);

  const allClasses = new Set(Object.keys(CLASSES));
  const allSubs = new Set(Object.values(CLASSES).flatMap((c) => c.subs));
  const allRaces = new Set(Object.keys(RACES));
  for (const cell of cells) {
    assert.ok(allClasses.has(cell.cls), `unexpected cls ${cell.cls}`);
    assert.ok(allSubs.has(cell.sub), `unexpected sub ${cell.sub}`);
    assert.ok(allRaces.has(cell.race), `unexpected race ${cell.race}`);
  }
  assert.equal(allSubs.size, 24);
  assert.equal(allRaces.size, 6);

  const excludedTriple = EXCLUDED_CELLS[0];
  assert.ok(
    !cells.some((c) => c.cls === excludedTriple.cls && c.sub === excludedTriple.sub && c.race === excludedTriple.race),
  );
});

// --- (2) resolveName -------------------------------------------------------

test("resolveName: case-insensitive resolution to canonical keys; throws with valid keys listed", () => {
  assert.equal(resolveName("sub", "summoner"), "Summoner");
  assert.equal(resolveName("cls", "magic user"), "Magic User");
  assert.equal(resolveName("race", " TROLL "), "Troll");
  assert.throws(() => resolveName("sub", "Paladin"), /Wizard/);
});

// --- (3) resolveForce -------------------------------------------------------

test("resolveForce: infers cls from sub, rejects cls/sub mismatch, rejects Fridgian Samurai, null when empty", () => {
  assert.deepStrictEqual(resolveForce({ sub: "summoner" }), { cls: "Magic User", sub: "Summoner" });
  assert.throws(() => resolveForce({ cls: "fighter", sub: "wizard" }));
  assert.throws(() => resolveForce({ sub: "samurai", race: "fridgian" }), /Fridg/i);
  assert.equal(resolveForce({}), null);
});

// --- (4) selectCells -------------------------------------------------------

test("selectCells: filters enumerateCells by whichever of cls/sub/race is set", () => {
  assert.equal(selectCells({ race: "Troll" }).length, 24);
  assert.equal(selectCells({ sub: "Samurai" }).length, 5);
  assert.equal(selectCells({ cls: "Thief" }).length, 48);
  assert.equal(selectCells(null).length, 143);
});

// --- (5) seedList -------------------------------------------------------

test("seedList: the fixed i*7919+1 stride", () => {
  assert.deepStrictEqual(seedList(3), [1, 7920, 15839]);
});

// --- (5b) rowFromRun.usage (Phase 42, BAL-02) ------------------------------

test("rowFromRun: carries run.tallies.usage straight through unchanged", () => {
  const run = { seed: 1, deathDepth: 5, floorsGained: 4, state: { c: { kills: 2, level: 2 } }, actions: 50, stuck: false, cause: "trap", tallies: { encounters: 1, usage: { abilities: { kata: 2 }, spells: {}, items: { "tool:torch": 1 } } }, encountersSurvived: 1 };
  const row = rowFromRun(run);
  assert.deepStrictEqual(row.usage, { abilities: { kata: 2 }, spells: {}, items: { "tool:torch": 1 } });
});

// --- (6) summarizeRows -------------------------------------------------------

test("summarizeRows: all-stuck rows are null-safe; mixed rows exclude stuck from depth metrics; topCauses caps at 3", () => {
  const stuckRow = { seed: 1, deathDepth: 3, stuck: true, cause: "maxActionsHit", kills: 0, level: 1, actions: 5000, floorsGained: 2, encounters: 1, encountersSurvived: 1 };
  const allStuck = summarizeRows([stuckRow]);
  assert.equal(allStuck.meanDepth, null);
  assert.equal(allStuck.p50Depth, null);
  assert.equal(allStuck.reach5, null);
  assert.equal(allStuck.stuck, 1);
  assert.equal(allStuck.completed, 0);
  assert.deepStrictEqual(allStuck.topCauses, []);

  const completedRow = (seed, deathDepth, cause) => ({
    seed, deathDepth, stuck: false, cause, kills: 2, level: 2, actions: 100, floorsGained: deathDepth - 1, encounters: 3, encountersSurvived: 2,
  });
  const mixed = summarizeRows([
    stuckRow,
    completedRow(2, 6, "trap"),
    completedRow(3, 4, "trap"),
    completedRow(4, 12, "combat"),
    completedRow(5, 8, "beast"),
    completedRow(6, 2, "combat"),
  ]);
  assert.equal(mixed.n, 6);
  assert.equal(mixed.stuck, 1);
  assert.equal(mixed.completed, 5);
  assert.notEqual(mixed.meanDepth, null);
  // stuck row's depth (3) must never contribute to the depth mean
  const completedDepths = [6, 4, 12, 8, 2];
  assert.equal(mixed.meanDepth, Math.round((completedDepths.reduce((a, b) => a + b, 0) / completedDepths.length) * 100) / 100);
  assert.ok(mixed.topCauses.length <= 3);
  // trap(2) > combat(2) tie broken by cause asc; beast(1) is 3rd or dropped
  assert.equal(mixed.topCauses[0].count >= mixed.topCauses[mixed.topCauses.length - 1].count, true);

  // Phase 42 (BAL-02): usage is never null, and rows carrying no `usage`
  // field at all (every row above) contribute zero uses everywhere.
  assert.deepStrictEqual(allStuck.usage, { abilities: {}, spells: {}, items: {} });
  assert.deepStrictEqual(mixed.usage, { abilities: {}, spells: {}, items: {} });
});

// --- (6a2) summarizeRows.usage (Phase 42, BAL-02) --------------------------

test("summarizeRows: usage sums uses and counts runs over COMPLETED rows only, in sorted label order", () => {
  const row = (seed, stuck, usage) => ({
    seed, deathDepth: 5, stuck, cause: "trap", kills: 1, level: 1, actions: 50, floorsGained: 4, encounters: 1, encountersSurvived: 1, usage,
  });
  const rows = [
    row(1, false, { abilities: { kata: 2 }, spells: {}, items: { "potion:heal": 1 } }),
    row(2, false, { abilities: { kata: 1, brace: 3 }, spells: { Freeze: 1 }, items: {} }),
    // a stuck row's usage must never contribute, even if present
    row(3, true, { abilities: { kata: 99 }, spells: {}, items: {} }),
    // a completed row with no usage field at all contributes zero
    { seed: 4, deathDepth: 5, stuck: false, cause: "trap", kills: 1, level: 1, actions: 50, floorsGained: 4, encounters: 1, encountersSurvived: 1 },
  ];
  const result = summarizeRows(rows);
  assert.deepStrictEqual(result.usage.abilities, { brace: { uses: 3, runs: 1 }, kata: { uses: 3, runs: 2 } });
  assert.deepStrictEqual(result.usage.spells, { Freeze: { uses: 1, runs: 1 } });
  assert.deepStrictEqual(result.usage.items, { "potion:heal": { uses: 1, runs: 1 } });
  // label insertion order is sorted ascending (brace before kata)
  assert.deepStrictEqual(Object.keys(result.usage.abilities), ["brace", "kata"]);
});

// --- (6b) reach20 (Phase 27, TUNE-05) -------------------------------------------------------

test("summarizeRows: reach20 is null when all rows are stuck, 0.0 when no completed run reaches 20, and counts a run at exactly deathDepth 20", () => {
  const stuckRow = { seed: 1, deathDepth: 3, stuck: true, cause: "maxActionsHit", kills: 0, level: 1, actions: 5000, floorsGained: 2, encounters: 1, encountersSurvived: 1 };
  const allStuck = summarizeRows([stuckRow]);
  assert.equal(allStuck.reach20, null);

  const completedRow = (seed, deathDepth, cause) => ({
    seed, deathDepth, stuck: false, cause, kills: 2, level: 2, actions: 100, floorsGained: deathDepth - 1, encounters: 3, encountersSurvived: 2,
  });

  const belowTwenty = summarizeRows([completedRow(1, 6, "trap"), completedRow(2, 9, "trap")]);
  assert.equal(belowTwenty.reach20, 0.0);

  const withExactTwenty = summarizeRows([completedRow(1, 19, "trap"), completedRow(2, 20, "combat"), completedRow(3, 25, "combat")]);
  // 2 of 3 completed runs have deathDepth >= 20 (the exact-20 run and the 25 run) -> 66.7%
  assert.equal(withExactTwenty.reach20, Math.round((2 / 3) * 1000) / 10);
  assert.ok(withExactTwenty.reach20 > 0);
});

// --- (6c) pooledSummary (Phase 27, TUNE-05) -------------------------------------------------------

test("pooledSummary: run-weighted over cells — pooled p50Depth is the median over ALL rows, not the mean of per-cell p50s; key ALL; null-not-NaN when all-stuck", () => {
  const completedRow = (seed, deathDepth) => ({
    seed, deathDepth, stuck: false, cause: "trap", kills: 1, level: 1, actions: 50, floorsGained: deathDepth - 1, encounters: 1, encountersSurvived: 1,
  });
  const cellA = { cell: { cls: "Fighter", sub: "Knight", race: "Human" }, rows: [completedRow(1, 9)] };
  const cellB = { cell: { cls: "Thief", sub: "Ninja", race: "Elven" }, rows: [completedRow(2, 1), completedRow(3, 1), completedRow(4, 2)] };

  const pooled = pooledSummary([cellA, cellB]);
  assert.equal(pooled.key, "ALL");
  assert.equal(pooled.n, 4);
  assert.equal(pooled.completed, 4);

  // pooled over the concatenation [1,1,2,9] must equal summarizeRows' own percentile of that set.
  const expected = summarizeRows([...cellA.rows, ...cellB.rows]);
  assert.equal(pooled.p50Depth, expected.p50Depth);

  // and it must differ from the naive mean of the two cells' own p50Depths (9 and 1 -> mean 5),
  // proving pooling is run-weighted, not cell-averaged.
  const cellAp50 = summarizeRows(cellA.rows).p50Depth;
  const cellBp50 = summarizeRows(cellB.rows).p50Depth;
  const naiveMeanOfP50s = (cellAp50 + cellBp50) / 2;
  assert.notEqual(pooled.p50Depth, naiveMeanOfP50s);

  // all-stuck pair -> null, never NaN, walked recursively.
  const stuckRow = { seed: 5, deathDepth: 3, stuck: true, cause: "maxActionsHit", kills: 0, level: 1, actions: 5000, floorsGained: 0, encounters: 0, encountersSurvived: 0 };
  const allStuckPooled = pooledSummary([{ cell: { cls: "Fighter", sub: "Knight", race: "Human" }, rows: [stuckRow] }]);
  assert.equal(allStuckPooled.p50Depth, null);
  const walk = (obj, seen = new Set()) => {
    if (obj === null || typeof obj !== "object" || seen.has(obj)) return;
    seen.add(obj);
    for (const v of Object.values(obj)) {
      if (typeof v === "number") assert.ok(!Number.isNaN(v), "pooledSummary produced a NaN");
      walk(v, seen);
    }
  };
  walk(allStuckPooled);
});

// --- (7) rankCells -------------------------------------------------------

test("rankCells: meanDepth desc, p50 desc, reach5 desc, then sub asc/race asc; null meanDepth ranks last", () => {
  const base = { n: 10, completed: 10, stuck: 0, meanKills: 1, meanLevel: 1, meanActions: 100, meanFloorsGained: 1, p50FloorsGained: 1, meanEncountersSurvived: 1, topCauses: [] };
  const cells = [
    { cls: "Fighter", sub: "Knight", race: "Human", ...base, meanDepth: 10, p50Depth: 10, reach5: 50 },
    { cls: "Fighter", sub: "Guard", race: "Human", ...base, meanDepth: 10, p50Depth: 10, reach5: 80 }, // higher reach5 -> ranks above Knight
    { cls: "Thief", sub: "Ninja", race: "Elven", ...base, meanDepth: null, p50Depth: null, reach5: null }, // null -> last
    { cls: "Fighter", sub: "Knight", race: "Dwarven", ...base, meanDepth: 10, p50Depth: 10, reach5: 50 }, // ties Knight/Human on everything but race
  ];
  const ranked = rankCells(cells);
  assert.equal(ranked[0].sub, "Guard"); // reach5 80 wins
  assert.equal(ranked[ranked.length - 1].sub, "Ninja"); // null meanDepth always last
  // Knight/Human vs Knight/Dwarven: identical sub, race asc -> Dwarven before Human
  const knightIdx = ranked.findIndex((c) => c.sub === "Knight" && c.race === "Dwarven");
  const knightHumanIdx = ranked.findIndex((c) => c.sub === "Knight" && c.race === "Human");
  assert.ok(knightIdx < knightHumanIdx);
  assert.deepStrictEqual(
    ranked.map((c) => c.rank),
    [1, 2, 3, 4],
  );
});

// --- (8) rollups -------------------------------------------------------

test("rollups: pools rows by class/sub/race; byClass sums n across member cells", () => {
  const rows1 = [{ seed: 1, deathDepth: 5, stuck: false, cause: "trap", kills: 1, level: 1, actions: 50, floorsGained: 4, encounters: 1, encountersSurvived: 1 }];
  const rows2 = [{ seed: 2, deathDepth: 7, stuck: false, cause: "combat", kills: 2, level: 2, actions: 80, floorsGained: 6, encounters: 2, encountersSurvived: 1 }];
  const cellRows = [
    { cell: { cls: "Fighter", sub: "Knight", race: "Human" }, rows: rows1 },
    { cell: { cls: "Fighter", sub: "Guard", race: "Elven" }, rows: rows2 },
  ];
  const ru = rollups(cellRows);
  assert.equal(ru.byClass.length, 1);
  assert.equal(ru.byClass[0].key, "Fighter");
  assert.equal(ru.byClass[0].n, 2);
  assert.equal(ru.bySub.length, 2);
  assert.deepStrictEqual(ru.bySub.map((r) => r.key).sort(), ["Guard", "Knight"]);
  assert.equal(ru.byRace.length, 2);
  assert.deepStrictEqual(ru.byRace.map((r) => r.key).sort(), ["Elven", "Human"]);
});

// --- (8b) rollups usage pass-through (Phase 42, BAL-02) --------------------

test("rollups: usage flows through byClass/bySub/byRace/pooled for free, pooled over every cell's rows", () => {
  const rows1 = [{ seed: 1, deathDepth: 5, stuck: false, cause: "trap", kills: 1, level: 1, actions: 50, floorsGained: 4, encounters: 1, encountersSurvived: 1, usage: { abilities: { kata: 2 }, spells: {}, items: {} } }];
  const rows2 = [{ seed: 2, deathDepth: 7, stuck: false, cause: "combat", kills: 2, level: 2, actions: 80, floorsGained: 6, encounters: 2, encountersSurvived: 1, usage: { abilities: {}, spells: { Freeze: 3 }, items: { "tool:torch": 1 } } }];
  const cellRows = [
    { cell: { cls: "Fighter", sub: "Knight", race: "Human" }, rows: rows1 },
    { cell: { cls: "Magic User", sub: "Sorcerer", race: "Elven" }, rows: rows2 },
  ];
  const ru = rollups(cellRows);
  const knight = ru.bySub.find((r) => r.key === "Knight");
  assert.deepStrictEqual(knight.usage.abilities, { kata: { uses: 2, runs: 1 } });
  assert.deepStrictEqual(ru.pooled.usage.abilities, { kata: { uses: 2, runs: 1 } });
  assert.deepStrictEqual(ru.pooled.usage.spells, { Freeze: { uses: 3, runs: 1 } });
  assert.deepStrictEqual(ru.pooled.usage.items, { "tool:torch": { uses: 1, runs: 1 } });
});

// --- (9) buildReport / formatText -------------------------------------------------------

test("buildReport: correct meta.cells/excluded, no timing fields; formatText contains footnote/Stuck/Bot lines, no verdict words", () => {
  const rowsA = [{ seed: 1, deathDepth: 5, stuck: false, cause: "trap", kills: 1, level: 1, actions: 50, floorsGained: 4, encounters: 1, encountersSurvived: 1 }];
  const rowsB = [{ seed: 1, deathDepth: 20000, stuck: true, cause: "maxActionsHit", kills: 0, level: 1, actions: 5000, floorsGained: 0, encounters: 0, encountersSurvived: 0 }];
  const cellRows = [
    { cell: { cls: "Fighter", sub: "Knight", race: "Human" }, rows: rowsA },
    { cell: { cls: "Thief", sub: "Ninja", race: "Elven" }, rows: rowsB },
  ];
  const opts = { ...BOT_DEFAULTS, seeds: 1, workers: 2, cls: null, sub: null, race: null };
  const report = buildReport({ cellRows, opts, commit: "abc1234" });

  assert.equal(report.meta.cells, 2);
  assert.equal(report.meta.excluded.length, 1);
  assert.ok(report.meta.bot.startsWith("Bot: "));
  assert.deepStrictEqual(report.meta.runFlags, RUN_FLAGS); // Phase 42 (BAL-01/02)

  const walk = (obj, seen = new Set()) => {
    if (obj === null || typeof obj !== "object" || seen.has(obj)) return;
    seen.add(obj);
    for (const [k, v] of Object.entries(obj)) {
      assert.ok(!/^(elapsed|ms|time)$/i.test(k), `unexpected timing key: ${k}`);
      walk(v, seen);
    }
  };
  walk(report);

  assert.equal(report.rollups.pooled.key, "ALL");
  assert.equal(report.rollups.pooled.n, rowsA.length + rowsB.length);

  const text = formatText(report);
  assert.ok(text.includes("Fridgian"));
  assert.ok(text.includes("Stuck:"));
  assert.ok(text.trim().endsWith(report.meta.bot));
  for (const word of ["fun", "strong", "weak"]) {
    assert.ok(!text.toLowerCase().includes(word), `formatText should not contain "${word}"`);
  }

  // (Phase 27, TUNE-05) a POOLED block appears after BY RACE and before the
  // Bot line, which must still be the very last line of the text.
  const byRaceIdx = text.indexOf("BY RACE:");
  const pooledIdx = text.indexOf("POOLED (all cells, run-weighted over completed runs):");
  assert.ok(byRaceIdx !== -1 && pooledIdx !== -1 && pooledIdx > byRaceIdx, "POOLED block must appear after the BY RACE table");
  assert.ok(pooledIdx < text.indexOf(report.meta.bot), "POOLED block must appear before the Bot line");
});

// --- (9b) rollups.pooled + POOLED block (Phase 27, TUNE-05) -------------------------------------------------------

test("buildReport: rollups.pooled present with key ALL; formatText's POOLED block carries a >=20% column and the deep gained/survived columns at a deep start depth", () => {
  const rowsA = [
    { seed: 1, deathDepth: 22, stuck: false, cause: "combat", kills: 3, level: 5, actions: 400, floorsGained: 2, encounters: 4, encountersSurvived: 3 },
  ];
  const rowsB = [
    { seed: 2, deathDepth: 20, stuck: false, cause: "trap", kills: 1, level: 5, actions: 200, floorsGained: 0, encounters: 1, encountersSurvived: 1 },
  ];
  const cellRows = [
    { cell: { cls: "Fighter", sub: "Knight", race: "Human" }, rows: rowsA },
    { cell: { cls: "Thief", sub: "Ninja", race: "Elven" }, rows: rowsB },
  ];
  const opts = { ...BOT_DEFAULTS, seeds: 1, workers: 2, startDepth: 20, cls: null, sub: null, race: null };
  const report = buildReport({ cellRows, opts, commit: "abc1234" });

  assert.equal(report.rollups.pooled.key, "ALL");
  assert.equal(report.rollups.pooled.completed, 2);
  // both runs reached deathDepth >= 20 -> pooled reach20 is 100%.
  assert.equal(report.rollups.pooled.reach20, 100.0);

  const text = formatText(report);
  const pooledBlockStart = text.indexOf("POOLED (all cells, run-weighted over completed runs):");
  assert.ok(pooledBlockStart !== -1, "POOLED block missing");
  const pooledBlock = text.slice(pooledBlockStart, text.indexOf("\n\n", pooledBlockStart));
  assert.ok(pooledBlock.includes(">=20%"), "POOLED block header is missing the >=20% column");
  assert.ok(pooledBlock.includes("survived"), "POOLED block at a deep start depth is missing the deep 'survived' column");
});

// --- (9c) formatUsageMarkdown (Phase 42, BAL-02) ----------------------------

/** mkUsageReport(usage) — a minimal two-cell report with a synthetic rollups.pooled/byClass/bySub, enough for formatUsageMarkdown. */
function mkUsageReport(usage) {
  const knightCompleted = 10;
  const sorcererCompleted = 5;
  return {
    meta: { cells: 2 },
    rollups: {
      byClass: [
        { key: "Fighter", completed: knightCompleted },
        { key: "Magic User", completed: sorcererCompleted },
      ],
      bySub: [
        { key: "Knight", usage: { abilities: { kata: { uses: 4, runs: 2 } }, spells: {}, items: {} } },
        { key: "Sorcerer", usage: { abilities: {}, spells: { Freeze: { uses: 3, runs: 1 } }, items: { "tool:torch": { uses: 1, runs: 1 } } } },
      ],
      pooled: { completed: knightCompleted + sorcererCompleted, usage },
    },
  };
}

test("formatUsageMarkdown: exactly four headings in order; abilities/spells rows cover every catalog entry; items sorted by uses desc then label asc; every rate 2 decimals, never NaN", () => {
  const usage = {
    abilities: { kata: { uses: 4, runs: 2 } },
    spells: { Freeze: { uses: 3, runs: 1 } },
    items: { "tool:torch": { uses: 1, runs: 1 }, "potion:heal": { uses: 5, runs: 3 } },
  };
  const md = mkUsageReport(usage);
  const text = formatUsageMarkdown(md);

  const headings = [...text.matchAll(/^### .+$/gm)].map((m) => m[0]);
  assert.deepStrictEqual(headings, ["### Pick-rates — abilities", "### Pick-rates — spells", "### Pick-rates — items", "### Top picks by sub-class"]);

  // every ABILITIES/SPELLS catalog entry gets exactly one row (header +
  // separator + N data rows, all lines starting with "|")
  const countTableRows = (block) => (block.match(/^\|.*\|$/gm) || []).length - 2; // minus header + separator
  const abilitiesBlock = text.slice(text.indexOf("### Pick-rates — abilities"), text.indexOf("### Pick-rates — spells"));
  assert.equal(countTableRows(abilitiesBlock), ABILITIES.length);
  const spellsBlock = text.slice(text.indexOf("### Pick-rates — spells"), text.indexOf("### Pick-rates — items"));
  assert.equal(countTableRows(spellsBlock), SPELLS.length);

  // Kata: 4 uses / 10 eligible (Fighter) = 0.40
  assert.ok(text.includes("| Kata | Fighter | 4 | 2 | 10 | 0.40 |"));
  // Freeze: 3 uses / 5 eligible (Magic User) = 0.60
  assert.ok(text.includes("| Freeze | 3 | 1 | 5 | 0.60 |"));

  // items sorted by uses desc (potion:heal 5 before tool:torch 1) then label asc
  const itemsBlock = text.slice(text.indexOf("### Pick-rates — items"), text.indexOf("### Top picks by sub-class"));
  const potionIdx = itemsBlock.indexOf("potion:heal");
  const torchIdx = itemsBlock.indexOf("tool:torch");
  assert.ok(potionIdx !== -1 && torchIdx !== -1 && potionIdx < torchIdx);

  assert.ok(!text.includes("NaN"));
});

test("formatUsageMarkdown: a report with NO usage field anywhere renders every table with zero uses and 0.00 rates, never throws", () => {
  const bare = { meta: { cells: 2 }, rollups: { byClass: [{ key: "Fighter", completed: 10 }, { key: "Magic User", completed: 5 }], bySub: [{ key: "Knight" }], pooled: { completed: 15 } } };
  const text = formatUsageMarkdown(bare);
  assert.ok(!text.includes("NaN"));
  assert.ok(text.includes("0.00"));
  assert.ok(text.includes("| Kata | Fighter | 0 | 0 | 10 | 0.00 |"));
  assert.ok(text.includes("- |") || text.includes("| - |")); // the sub row's "no picks" placeholder
});

test("formatUsageMarkdown: 'Top picks by sub-class' has one row per rollups.bySub entry with its top three uses/runs picks", () => {
  const usage = { abilities: {}, spells: {}, items: {} };
  const md = mkUsageReport(usage);
  const text = formatUsageMarkdown(md);
  const subBlock = text.slice(text.indexOf("### Top picks by sub-class"));
  assert.ok(subBlock.includes("Knight"));
  assert.ok(subBlock.includes("kata (4/2)"));
  assert.ok(subBlock.includes("Sorcerer"));
  assert.ok(subBlock.includes("Freeze (3/1)"));
  assert.ok(subBlock.includes("tool:torch (1/1)"));
});

// --- (10) force pass-through smoke (HARN-01 via the bot) -------------------------------------------------------

test("force pass-through: resolveForce output feeds playRun's force option and produces the requested character", () => {
  const force = resolveForce({ sub: "summoner", race: "troll" });
  const run = playRun(1, { ...BOT_DEFAULTS, maxActions: 5, force });
  assert.equal(run.state.c.sub, "Summoner");
  assert.equal(run.state.c.race, "Troll");
  assert.equal(run.state.c.cls, "Magic User");
});

// --- (11) purity -------------------------------------------------------

test("purity: module source draws no Math.random/Date.now, and imports no fs/os/worker_threads", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "tools", "lib", "class-matrix.mjs"), "utf8");
  const codeLines = src.split("\n").filter((line) => !/^\s*(\/\/|\/?\*)/.test(line));
  assert.ok(!codeLines.some((line) => /Math\.random|Date\.now|worker_threads|from ["']node:fs["']|from ["']fs["']|from ["']node:os["']/.test(line)));
});
