#!/usr/bin/env node
// tools/terrain-fixture-scan.mjs
//
// Phase 41 (TERR-01, Plan 01, Task 3) — the LIVE fixture-roster scan
// (research "Pitfall 1" recipe). A REPORT tool (always exits 0, makes no
// assertions — NOT a `*.test.js` file, `node --test` never picks it up)
// that measures, by actually replaying every parity fixture through the
// real engine, exactly which scripted `move` actions land on a water cell.
// This is the phase's proof that "the water field is structurally stripped"
// does NOT by itself mean "water is fixture-safe" (research Pitfall 1): the
// FIELD is a structural carve-out (stripWaterField), but a scripted `move`
// that happens to land on a water tile is a REAL, comparable-visible
// divergence in `state.steps`/`c.timers` once TERR-02 lands the move-cost
// surcharge — so this scan measures it live rather than assuming the
// eligibility rules alone are sufficient (Assumption A2 in 41-RESEARCH.md).
//
// Run:
//   node tools/terrain-fixture-scan.mjs
//
// Paste the stdout verbatim into test/parity/FIXTURE-INVENTORY.md's new
// "Phase 41: water terrain" section (see that file's own instructions).

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../engine/engine.js";
import { applyStartCombat } from "../test/parity/harness/comparables.js";
import { isDeadEnd, TERRAIN_PHOBIAS } from "../engine/phobias.js";
import { DIRV } from "../engine/movement.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "..", "test", "parity", "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

/** waterCellsOf(floor) — every `[x, y]` whose cell carries `water === true`,
 * row-major order. Pure read, no mutation. */
function waterCellsOf(floor) {
  const cells = [];
  for (let y = 0; y < floor.g.length; y++) {
    const row = floor.g[y];
    for (let x = 0; x < row.length; x++) if (row[x] && row[x].water === true) cells.push([x, y]);
  }
  return cells;
}

/**
 * scanMovementFixture(fixtureFile) — replays action-script.movement.json's
 * full scripted action list through the real engine (`newRun` + one
 * `applyAction` per action), tracking the party's (px, py) after every
 * action. For each `move` action whose destination cell differs from the
 * cell BEFORE that action, checks `state.floor.g[py][px].water === true`
 * and records a hit. Also snapshots the full water-cell list for depth 1
 * (the starting floor) and depth 2 (the first floor reached after a
 * descend, if the script ever descends) for the report's reference table.
 *
 * Phase 41 (TERR-04/05, Plan 03): also flags, per `move`, whether the
 * destination is `.dark` (darkHits) or a dead end (deadEndHits, via the
 * SAME `isDeadEnd` engine/phobias.js exports), and whether the ATTEMPTED
 * tile (read BEFORE the move — before a successful climb/gorge clears its
 * `.feat`) is a climb/gorge tile (climbGorgeAttempts) — the three region/
 * attempt triggers this fixture's hero could ever exercise, measured live
 * rather than assumed.
 */
function scanMovementFixture(fixtureFile) {
  const fixture = readFixture(fixtureFile);
  let state = newRun(fixture.seed);
  const hits = [];
  const waterByDepth = {};
  const snapshotDepth = (s) => {
    const d = s.floor.depth;
    if (!(d in waterByDepth)) waterByDepth[d] = waterCellsOf(s.floor);
  };
  snapshotDepth(state);

  let moveCount = 0;
  let darkHits = 0;
  let deadEndHits = 0;
  let climbGorgeAttempts = 0;
  for (let i = 0; i < fixture.actions.length; i++) {
    const action = fixture.actions[i];
    if (action.type === "move") {
      moveCount++;
      const f = state.floor;
      const [dx, dy] = DIRV[action.dir] || [0, 0];
      const tx = f.px + dx;
      const ty = f.py + dy;
      const target = f.g[ty] && f.g[ty][tx];
      if (target && (target.feat === "climb" || target.feat === "gorge")) climbGorgeAttempts++;
    }
    const before = { px: state.floor.px, py: state.floor.py, depth: state.floor.depth };
    const { state: next } = applyAction(state, action);
    if (action.type === "move") {
      const moved = next.floor.px !== before.px || next.floor.py !== before.py || next.floor.depth !== before.depth;
      if (moved) {
        const { px, py, depth } = next.floor;
        const cell = next.floor.g[py] && next.floor.g[py][px];
        if (cell && cell.water === true) {
          hits.push({ fixture: fixtureFile, seed: fixture.seed, action: i, depth, x: px, y: py });
        }
        if (cell && cell.dark === true) darkHits++;
        if (isDeadEnd(next.floor, px, py)) deadEndHits++;
      }
    }
    state = next;
    snapshotDepth(state);
  }

  return { seed: fixture.seed, moveCount, hits, waterByDepth, darkHits, deadEndHits, climbGorgeAttempts };
}

/**
 * scanNonMoveFixture(fixtureFile, scenario, seed, actions) — for every
 * fixture/scenario whose scripted actions are never `move` (combat/magic/
 * economy/encounters), just counts move actions (expected 0 — a sanity
 * check, not an assumption) and reads the hero's `c.phobia` off a fresh
 * `newRun(seed)` (Plan 03's own future reference column).
 */
function scanNonMoveFixture(fixtureFile, scenario, seed, actions) {
  const moveCount = actions.filter((a) => a.type === "move").length;
  const state = newRun(seed);
  return { fixture: fixtureFile, scenario, seed, moveCount, phobia: state.c.phobia };
}

function main() {
  const rows = [];
  let totalHits = 0;

  // chargen: no actions at all — report the seed count only.
  {
    const fixtureFile = "action-script.chargen.json";
    const fixture = readFixture(fixtureFile);
    rows.push({
      fixture: fixtureFile,
      scenario: `(${fixture.seeds.length} seeds, no actions)`,
      seed: fixture.seed,
      moveCount: 0,
      hitsCell: "—",
      phobia: "—",
      phobiaHitsCell: "—",
    });
  }

  // movement: the one fixture with real move actions — the full scan.
  let movementWaterByDepth = {};
  {
    const fixtureFile = "action-script.movement.json";
    const result = scanMovementFixture(fixtureFile);
    movementWaterByDepth = result.waterByDepth;
    totalHits += result.hits.length;
    const hitsCell = result.hits.length
      ? result.hits.map((h) => `#${h.action}@d${h.depth} (${h.x},${h.y})`).join("; ")
      : "none";
    const state = newRun(result.seed);
    // Phase 41 (TERR-04/05, Plan 03): the phobia-trigger column — dark/dead-
    // end/climb-gorge hit COUNTS (not indices — the movement fixture's own
    // hero phobia, "Vampires and the undead", is not a terrain phobia, so
    // these counts are exposure surface, not actual triggers; see the
    // TERRAIN TRIGGER EXPOSURE line below for the real measurement).
    rows.push({
      fixture: fixtureFile,
      scenario: "(script)",
      seed: result.seed,
      moveCount: result.moveCount,
      hitsCell,
      phobia: state.c.phobia,
      phobiaHitsCell: `dark:${result.darkHits} deadEnd:${result.deadEndHits} climbGorge:${result.climbGorgeAttempts}`,
    });
  }

  // combat: six independent scenarios — none has a move action.
  {
    const fixtureFile = "action-script.combat.json";
    const fixture = readFixture(fixtureFile);
    for (const scenario of fixture.scenarios) {
      const r = scanNonMoveFixture(fixtureFile, scenario.name, scenario.seed, scenario.actions);
      rows.push({ ...r, hitsCell: "n/a (no move actions)", phobiaHitsCell: "n/a (no move actions)" });
    }
  }

  // magic: four independent scenarios — none has a move action.
  {
    const fixtureFile = "action-script.magic.json";
    const fixture = readFixture(fixtureFile);
    for (const scenario of fixture.scenarios) {
      const r = scanNonMoveFixture(fixtureFile, scenario.name, scenario.seed, scenario.actions);
      rows.push({ ...r, hitsCell: "n/a (no move actions)", phobiaHitsCell: "n/a (no move actions)" });
    }
  }

  // economy: a single script — no move actions.
  {
    const fixtureFile = "action-script.economy.json";
    const fixture = readFixture(fixtureFile);
    const r = scanNonMoveFixture(fixtureFile, "(script)", fixture.seed, fixture.actions);
    rows.push({ ...r, hitsCell: "n/a (no move actions)", phobiaHitsCell: "n/a (no move actions)" });
  }

  // encounters: five independent scenarios — none has a move action.
  {
    const fixtureFile = "action-script.encounters.json";
    const fixture = readFixture(fixtureFile);
    for (const scenario of fixture.scenarios) {
      const r = scanNonMoveFixture(fixtureFile, scenario.name, scenario.seed, scenario.actions);
      rows.push({ ...r, hitsCell: "n/a (no move actions)", phobiaHitsCell: "n/a (no move actions)" });
    }
  }

  const lines = [];
  lines.push("| Fixture | Scenario | Seed | Move actions | Water hits (action idx @ depth x,y) | Hero phobia | Phobia trigger hits (dark/deadEnd/climbGorge) |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(`| ${r.fixture} | ${r.scenario} | ${r.seed} | ${r.moveCount} | ${r.hitsCell} | ${r.phobia} | ${r.phobiaHitsCell} |`);
  }
  console.log(lines.join("\n"));
  console.log("");
  for (const [depth, cells] of Object.entries(movementWaterByDepth)) {
    console.log(`Movement fixture (seed 256) water cells at depth ${depth}: ${cells.length ? cells.map(([x, y]) => `(${x},${y})`).join(", ") : "none"}`);
  }
  console.log("");
  console.log(`WATER HITS: ${totalHits}`);

  // Phase 41 (TERR-04/05, Plan 03): TERRAIN TRIGGER EXPOSURE — the count of
  // fixtures whose hero carries a phobia in TERRAIN_PHOBIAS (engine/
  // phobias.js) AND whose script contains at least one `move` action (the
  // ONLY way checkTerrainPhobias/noteHeightsAttempt can ever fire — both are
  // wired at move()/teleport(), never at a non-move action). Measured, not
  // assumed: read straight off the rows built above.
  const exposure = rows.filter((r) => TERRAIN_PHOBIAS.includes(r.phobia) && r.moveCount > 0).length;
  console.log(`TERRAIN TRIGGER EXPOSURE: ${exposure}`);
}

main();
