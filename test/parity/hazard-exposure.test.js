// test/parity/hazard-exposure.test.js
//
// Phase 78 (CLIMB-01), plan 78-04: the standing hazard-exposure guard.
//
// Why it exists. Since 78-01 every step toward a wall (climb) or a crevice
// (gorge) pauses on one engine decision: `state.pendingHazard` is set, a
// `hazardChoice` event fires, and no die is drawn until `resolveHazard`
// commits. The prototype (test/parity/prototype-master.js.txt) still rolls on
// the step itself. The two agree draw for draw once the engine commits (the
// golden commit test, test/unit/hazard-decision.test.js), but a parity
// fixture that walks into a wall or crevice would now stop one action early
// on the engine side and fall out of step with the prototype.
//
// 78-01 measured the exposure on the unchanged engine and found ZERO: no
// fixture script or scenario ever steps toward a climb or gorge tile, so no
// harness reconcile was needed and no fixture moved (see
// test/parity/FIXTURE-INVENTORY.md, `## Phase 78`). This guard keeps that
// true. It replays every fixture site on the engine, the same way
// test/parity/divergence-records.test.js's exposure guards do (engine only,
// no prototype sandbox: it proves exposure, not byte parity), collects every
// `hazardChoice` event with its site and action index, and asserts the
// collected set equals 78-01's measured set (empty). A future fixture that
// reaches a wall or crevice fails here, loudly, and points at the reconcile
// decision it now needs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { openStore } from "../../engine/economy.js";
import { descend, DIRV } from "../../engine/movement.js";
import { springTrap, openChest, encounterDot } from "../../engine/encounters.js";
import { applyStartCombat } from "./harness/comparables.js";
import { legalDirs } from "../../tools/lib/tuning-bot.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

const CHARGEN_FIXTURE = readFixture("action-script.chargen.json");
const MOVEMENT_FIXTURE = readFixture("action-script.movement.json");
const COMBAT_FIXTURE = readFixture("action-script.combat.json");
const MAGIC_FIXTURE = readFixture("action-script.magic.json");
const ECONOMY_FIXTURE = readFixture("action-script.economy.json");
const ENCOUNTERS_FIXTURE = readFixture("action-script.encounters.json");

/**
 * MEASURED_HAZARD_SITES — 78-01's measured exposure (78-01-SUMMARY.md,
 * "Parity exposure"): every fixture site reached zero hazard steps. Each
 * entry, if one is ever reconciled, is `<file>#<site>@<actionIndex>`.
 */
const MEASURED_HAZARD_SITES = [];

// The internal-call action types the fixtures dispatch, mirroring
// comparables.js's INTERNAL_FNS and divergence-records.test.js's replay.
const INTERNAL_FNS = { openStore, springTrap, openChest, encounterDot, descend };

function applyInternal(state, fn) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  fn(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

/**
 * hazardSites(site, actions, { seed, initial, bumpGold }) — replays one site
 * on the engine (startCombat -> applyStartCombat; an internal-call type ->
 * the clone/rng-rehydrate/persist shape; everything else -> applyAction with
 * the FULL action object, so movement's `dir` survives) and returns one
 * `<site>@<actionIndex>` entry for every `hazardChoice` event or newly set
 * `state.pendingHazard` it meets. `initial` replaces `newRun(seed)` (the
 * teeth case below uses it).
 */
function hazardSites(site, actions, { seed, initial = null, bumpGold = false } = {}) {
  let state = initial ? structuredClone(initial) : newRun(seed);
  if (bumpGold) state.c.gold = 5000; // full-suite.test.js's own economy gold bump
  const hits = [];
  if (state.pendingHazard) hits.push(`${site}@start`);
  actions.forEach((action, i) => {
    let result;
    if (action.type === "startCombat") result = applyStartCombat(state, action.wandering, action.forced);
    else if (action.type in INTERNAL_FNS) result = applyInternal(state, INTERNAL_FNS[action.type]);
    else result = applyAction(state, action);
    state = result.state;
    const sawChoice = (result.events || []).some((e) => e && e.type === "hazardChoice");
    if (sawChoice || state.pendingHazard) hits.push(`${site}@${i}`);
  });
  return hits;
}

/** Every fixture site, replayed; returns { sites, hits }. */
function replayAllFixtures() {
  let sites = 0;
  const hits = [];

  for (const seed of CHARGEN_FIXTURE.seeds) {
    sites++;
    hits.push(...hazardSites(`action-script.chargen.json#seed-${seed}`, [], { seed }));
  }

  sites++;
  hits.push(...hazardSites("action-script.movement.json#script", MOVEMENT_FIXTURE.actions, { seed: MOVEMENT_FIXTURE.seed }));

  for (const [file, fixture] of [
    ["action-script.combat.json", COMBAT_FIXTURE],
    ["action-script.magic.json", MAGIC_FIXTURE],
    ["action-script.encounters.json", ENCOUNTERS_FIXTURE],
  ]) {
    for (const scenario of fixture.scenarios) {
      sites++;
      hits.push(...hazardSites(`${file}#${scenario.name}`, scenario.actions, { seed: scenario.seed }));
    }
  }

  sites++;
  hits.push(...hazardSites("action-script.economy.json#script", ECONOMY_FIXTURE.actions, { seed: ECONOMY_FIXTURE.seed, bumpGold: true }));

  return { sites, hits };
}

test("CLIMB-01 (Phase 78): no parity replay site ever steps toward a wall or crevice (the measured set is exactly 78-01's, empty)", () => {
  const { sites, hits } = replayAllFixtures();
  assert.equal(sites, 31, "the guard covers every one of the 31 replay sites (14 chargen seeds, movement, 6 combat, 4 magic, economy, 5 encounters)");
  assert.deepStrictEqual(
    [...new Set(hits)].sort(),
    [...MEASURED_HAZARD_SITES].sort(),
    `a parity fixture now reaches a wall or crevice (${hits.join(", ")}). ` +
      "Since Phase 78 (78-01) the engine pauses on that step (pendingHazard, hazardChoice, no dice) and rolls only on " +
      "resolveHazard { cross: true }, while the prototype rolls on the step. Reconcile the site the way 78-01 decided " +
      "(the harness answers the pause with the commit, draw-identical), declare it in test/parity/FIXTURE-INVENTORY.md " +
      "under ## Phase 78, and add it to MEASURED_HAZARD_SITES here. Never regenerate an unmeasured fixture.",
  );
});

test("CLIMB-01 exposure guard has teeth: a synthetic replay that steps a hero toward a hand-set wall is caught by the same collector", () => {
  const seed = MOVEMENT_FIXTURE.seed;
  const base = newRun(seed);
  const dir = legalDirs(base)[0];
  assert.ok(dir, "the synthetic hero has a legal step");
  const v = DIRV[dir];
  for (const feat of ["climb", "gorge"]) {
    const s = structuredClone(base);
    s.floor.g[s.floor.py + v[1]][s.floor.px + v[0]].feat = feat;
    const hits = hazardSites("synthetic#teeth", [{ type: "move", dir }], { initial: s });
    assert.deepStrictEqual(hits, ["synthetic#teeth@0"], `the collector sees the ${feat} pause`);
    // And the guard's own assertion would fail on it.
    assert.throws(() => assert.deepStrictEqual(hits, MEASURED_HAZARD_SITES), assert.AssertionError);
  }
  // Control: the same step with no feat on the target cell is not a hit.
  assert.deepStrictEqual(hazardSites("synthetic#control", [{ type: "move", dir }], { initial: base }), []);
});
