#!/usr/bin/env node
// tools/initiative-fixture-scan.mjs
//
// Phase 51 (INIT-01) — measure first. Replays every parity replay site
// through the real engine in lockstep with the frozen prototype sandbox and
// reports, per site, exactly where the per-round initiative re-roll
// (engine/combat.js's afterPlayerAction, the `state.combat.round++` guarded
// on `!state.dead && state.combat`, today followed by a fresh
// `rollInitiative` + its pre-emptive foe turn) fires — the MOVED SET Plan
// 02's engine cut declares and regenerates, nothing more.
//
// A REPORT tool (always exits 0, makes no assertions — NOT a `*.test.js`
// file, `node --test` never picks it up), in the `tools/worn-fixture-
// scan.mjs` pattern (Phase 45, HEDGE-03).
//
// Run:
//   node tools/initiative-fixture-scan.mjs > tools/initiative-fixture-scan-output.txt
//
// Part A — the predictor (INVARIANT across the Plan 02 engine edit). Per
// site, after every scripted action this tracks `state.combat.round` before
// and after; the site's `firstRoundAdvance` is the first action index i
// where the action type is not `flee`, the round went from n (>= 1) to
// n+1, `state.combat` is still live, and `state.dead` is falsy — exactly
// the `afterPlayerAction` round-advance that today is followed by the
// per-round re-roll, and after Plan 02 is followed by nothing. This keys
// on `state.combat.round` itself (read straight off `engineState.combat`,
// never through a comparable — `combatComparable` strips `round`), which
// Plan 02's edit does not change (the `round++` placement stays; only what
// runs after it is cut), so Part A's numbers must stay identical before
// and after that edit. `flee`'s own `C.round++` (a FAILED flee, combat.js
// ~line 1001) is not a re-roll site, so `flee` actions never count as the
// round-advancing action.
//
// Part B — the lockstep measurement (changes after the edit; what Plan 02
// fills its divergence records from). For every combat/magic-family site
// (whether or not that particular scenario ever enters combat — heal/
// potion/scroll are magic-family sites with no `startCombat` action, and
// are measured exactly like cast-damage), this diffs
// `combatComparable(engineState)` against `combatComparable(ctx.S)` after
// every action, wrapped with the SAME per-scenario carve-outs
// full-suite.test.js applies on top of the bare comparable (`chargenShiftOf`/
// `stripChargenShift` for the Phase 38/45 chargen-table-reshape record every
// scenario carries; `stripParleyDivergence` for the "parley" scenario;
// `stripScenarioDivergence` for a magic scenario's own field-strip
// `divergence` when it is not an action-path record) — WITHOUT the
// `skipsByteDiffAt` suppression the test files apply for a declared
// action-path record's own already-known cause, so a genuinely NEW
// divergence is never hidden behind a pre-existing, already-declared one.
// Reports `firstDivergentAction` (index of the first non-null diff, else
// "never") and `maxRound` (the highest `state.combat.round` observed, else
// "n/a" when the site never enters combat). Non-combat/magic families
// (chargen/movement/economy/encounters) never carry `state.combat` at all —
// both Part B columns print "n/a" for them rather than skipping the row, so
// the row count stays 31.
//
// The scan imports `combatComparable`/`diffState`/`applyStartCombat`/
// `runEconomyAction` (plus the carve-out helpers above) straight from the
// harness — unlike tools/worn-fixture-scan.mjs (which deliberately avoids
// the harness so its output is independent of the carve-out Plan 02 there
// rewrote), Plan 02 here rewrites NO comparable, so reusing the harness's
// own exported helpers is safe and avoids re-deriving the replay dispatch a
// second time.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../engine/engine.js";
import { loadPrototypeSandbox } from "../test/parity/harness/sandboxPrototype.js";
import { diffState } from "../test/parity/harness/diffState.js";
import {
  combatComparable,
  applyStartCombat,
  runEconomyAction,
  chargenShiftOf,
  stripChargenShift,
  stripParleyDivergence,
  stripScenarioDivergence,
  actionPathDivergenceOf,
} from "../test/parity/harness/comparables.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "..", "test", "parity", "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

/** roundOf(state) — `state.combat.round`, or `undefined` when there is no live combat. */
function roundOf(state) {
  return state && state.combat ? state.combat.round : undefined;
}

/** endFields(c) — the five action-path record fields this scan's "Record
 * values" section pins, read straight off a character object. */
function endFields(c) {
  return { wp: c.wp, sp: c.sp, gold: c.gold, kills: c.kills, rations: c.rations };
}

/**
 * buildCmp(scenario, family) — reconstructs, for Part B's diff, the SAME
 * effective comparable full-suite.test.js compares combat/magic scenarios
 * on (minus its `skipsByteDiffAt` suppression — see this file's header):
 * `combatComparable`, wrapped with `stripParleyDivergence` for the "parley"
 * scenario (combat family only), or `stripScenarioDivergence` for a magic
 * scenario's own plain (non-action-path) `divergence` record, then
 * outermost with `stripChargenShift` when the scenario carries a
 * `chargenDivergence` (every combat/magic scenario today, Phase 38/45's
 * universal chargen-table-reshape record). A scenario with a `kind:
 * "action-path"` `divergence` (`actionPathDivergenceOf`) skips the plain
 * `stripScenarioDivergence` wrap (full-suite.test.js's own rule: an
 * action-path record's cause is proven by `declaredEndDiffs`, not a
 * field-strip), matching the real test's cmp selection exactly.
 */
function buildCmp(scenario, family) {
  const pathDiv = actionPathDivergenceOf(scenario);
  let cmp;
  if (family === "magic") {
    cmp = pathDiv ? combatComparable : scenario.divergence ? (s) => stripScenarioDivergence(combatComparable(s), scenario.divergence) : combatComparable;
  } else {
    cmp = scenario.name === "parley" ? (s) => stripParleyDivergence(combatComparable(s)) : combatComparable;
  }
  const shift = chargenShiftOf(scenario);
  if (shift) {
    const inner = cmp;
    cmp = (s) => stripChargenShift(inner(s), shift);
  }
  return cmp;
}

/**
 * replaySite({fixture, site, seed, partB, cmp, divergencePhase, run}) —
 * generic driver shared by every family below: loads the prototype sandbox
 * + a fresh engine start state, hands off to the site-specific `run(ctx,
 * engineState, onAfterAction, setEngineState)` dispatcher (copies the
 * per-domain parity tests' own per-action branches, dropping every
 * assert), and tracks Part A's round-advance predictor plus (when `partB`
 * is true — the site's fixture family is combat or magic) Part B's
 * first-divergent-action / max-round measurement, on every action.
 */
function replaySite({ fixture, site, seed, partB, cmp = combatComparable, divergencePhase = null, run }) {
  const ctx = loadPrototypeSandbox({ seed });
  let engineState = newRun(seed);

  const hero = `${engineState.c.cls} ${engineState.c.sub} ${engineState.c.race}`;

  let actionCount = 0;
  let prevRound = roundOf(engineState);
  let firstRoundAdvance = "never";
  let sawCombat = prevRound !== undefined;
  let maxRound = typeof prevRound === "number" ? prevRound : null;
  let firstDivergentAction = "never";

  const onAfterAction = (i, action, nextEngineState) => {
    actionCount = i + 1;
    engineState = nextEngineState;
    const round = roundOf(engineState);
    if (round !== undefined) {
      sawCombat = true;
      if (maxRound === null || round > maxRound) maxRound = round;
    }
    if (
      firstRoundAdvance === "never" &&
      action.type !== "flee" &&
      typeof prevRound === "number" &&
      prevRound >= 1 &&
      round === prevRound + 1 &&
      !!engineState.combat &&
      !engineState.dead
    ) {
      firstRoundAdvance = i;
    }
    prevRound = round;

    if (partB && firstDivergentAction === "never") {
      const d = diffState(cmp(ctx.S), cmp(engineState));
      if (d !== null) firstDivergentAction = i;
    }
  };

  run(ctx, engineState, onAfterAction, (s) => {
    engineState = s;
  });

  const moved = firstRoundAdvance !== "never";
  // Symmetry with tools/worn-fixture-scan.mjs's own diagnostic — cannot
  // happen (a round advance is only ever recorded while `state.combat` is
  // live), kept so an assumption violated by a future engine change is
  // never silently swallowed.
  const unexplained = moved && !sawCombat;

  return {
    fixture,
    site,
    seed,
    hero,
    actions: actionCount,
    firstRoundAdvance,
    moved,
    unexplained,
    firstDivergentAction: partB ? firstDivergentAction : "n/a",
    maxRound: partB && sawCombat ? maxRound : "n/a",
    divergencePhase: divergencePhase ?? "none",
    fieldsBefore: endFields(ctx.S.c),
    fieldsAfter: endFields(engineState.c),
    stateBefore: { dead: !!ctx.S.dead },
    stateAfter: { dead: !!engineState.dead },
  };
}

function main() {
  const rows = [];

  // chargen — every seed of CHARGEN.seeds; no actions at all.
  {
    const fixture = "action-script.chargen.json";
    const CHARGEN = readFixture(fixture);
    for (const seed of CHARGEN.seeds) {
      rows.push(
        replaySite({
          fixture,
          site: `${fixture}#seed-${seed}`,
          seed,
          partB: false,
          run: () => {}, // no actions — chargen state is the end state
        }),
      );
    }
  }

  // movement — the single script.
  {
    const fixture = "action-script.movement.json";
    const MOVEMENT = readFixture(fixture);
    rows.push(
      replaySite({
        fixture,
        site: `${fixture}#script`,
        seed: MOVEMENT.seed,
        partB: false,
        run: (ctx, engineState, onAfterAction, setEngineState) => {
          let state = engineState;
          MOVEMENT.actions.forEach((action, i) => {
            ctx.move(action.dir);
            const { state: next } = applyAction(state, action);
            state = next;
            onAfterAction(i, action, state);
          });
          setEngineState(state);
        },
      }),
    );
  }

  // combat — each scenario.
  {
    const fixture = "action-script.combat.json";
    const COMBAT = readFixture(fixture);
    for (const scenario of COMBAT.scenarios) {
      rows.push(
        replaySite({
          fixture,
          site: `${fixture}#${scenario.name}`,
          seed: scenario.seed,
          partB: true,
          cmp: buildCmp(scenario, "combat"),
          divergencePhase: scenario.divergence?.phase ?? null,
          run: (ctx, engineState, onAfterAction, setEngineState) => {
            let state = engineState;
            scenario.actions.forEach((action, i) => {
              if (action.type === "startCombat") {
                ctx.startCombat(action.wandering, action.forced);
                const { state: next } = applyStartCombat(state, action.wandering, action.forced);
                state = next;
              } else {
                const verb = action.type === "attack" ? "playerStrike" : action.type;
                ctx[verb]();
                const { state: next } = applyAction(state, { type: action.type });
                state = next;
              }
              onAfterAction(i, action, state);
            });
            setEngineState(state);
          },
        }),
      );
    }
  }

  // magic — each scenario.
  {
    const fixture = "action-script.magic.json";
    const MAGIC = readFixture(fixture);
    for (const scenario of MAGIC.scenarios) {
      rows.push(
        replaySite({
          fixture,
          site: `${fixture}#${scenario.name}`,
          seed: scenario.seed,
          partB: true,
          cmp: buildCmp(scenario, "magic"),
          divergencePhase: scenario.divergence?.phase ?? null,
          run: (ctx, engineState, onAfterAction, setEngineState) => {
            let state = engineState;
            scenario.actions.forEach((action, i) => {
              if (action.type === "startCombat") {
                ctx.startCombat(action.wandering, action.forced);
                const { state: next } = applyStartCombat(state, action.wandering, action.forced);
                state = next;
              } else if (action.type === "castSpell") {
                ctx.castSpell(action.idx);
                const { state: next } = applyAction(state, { type: "castSpell", idx: action.idx });
                state = next;
              } else {
                ctx[action.type]();
                const { state: next } = applyAction(state, { type: action.type });
                state = next;
              }
              onAfterAction(i, action, state);
            });
            setEngineState(state);
          },
        }),
      );
    }
  }

  // economy — the script. Gold bumped to 5000 on both sides AFTER the
  // chargen snapshot (matching tools/worn-fixture-scan.mjs and
  // full-suite.test.js), so the initial hero stays untouched.
  {
    const fixture = "action-script.economy.json";
    const ECONOMY = readFixture(fixture);
    rows.push(
      replaySite({
        fixture,
        site: `${fixture}#script`,
        seed: ECONOMY.seed,
        partB: false,
        run: (ctx, startState, onAfterAction, setEngineState) => {
          ctx.S.c.gold = 5000;
          let engineState = startState;
          engineState.c.gold = 5000;
          ECONOMY.actions.forEach((action, i) => {
            const { state: next } = runEconomyAction(ctx, engineState, action);
            engineState = next;
            onAfterAction(i, action, engineState);
          });
          setEngineState(engineState);
        },
      }),
    );
  }

  // encounters — each scenario.
  {
    const fixture = "action-script.encounters.json";
    const ENCOUNTERS = readFixture(fixture);
    for (const scenario of ENCOUNTERS.scenarios) {
      rows.push(
        replaySite({
          fixture,
          site: `${fixture}#${scenario.name}`,
          seed: scenario.seed,
          partB: false,
          run: (ctx, startState, onAfterAction, setEngineState) => {
            let engineState = startState;
            scenario.actions.forEach((action, i) => {
              const { state: next } = runEconomyAction(ctx, engineState, action);
              engineState = next;
              onAfterAction(i, action, engineState);
            });
            setEngineState(engineState);
          },
        }),
      );
    }
  }

  // ---- output ----------------------------------------------------------

  const lines = [];
  lines.push("# initiative-fixture-scan — Phase 51 (INIT-01): where the per-round initiative re-roll fires");
  lines.push("");
  lines.push("## Part A — the predictor (invariant across the Plan 02 engine edit)");
  lines.push("");
  lines.push(
    "| Fixture | Site | Seed | Hero | actions | first live-fight round advance | moved | firstDivergentAction | maxRound | divergence.phase |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      `| ${r.fixture} | ${r.site} | ${r.seed} | ${r.hero} | ${r.actions} | ${r.firstRoundAdvance} | ${r.moved} | ${r.firstDivergentAction} | ${r.maxRound} | ${r.divergencePhase} |`,
    );
  }

  const unexplainedRows = rows.filter((r) => r.unexplained);
  for (const r of unexplainedRows) lines.push(`UNEXPLAINED: ${r.site}`);

  lines.push("");
  const movedRows = rows.filter((r) => r.moved);
  lines.push(`MOVED SET (${movedRows.length}): ${movedRows.map((r) => r.site).join(", ")}`);
  lines.push(`INITIATIVE EXPOSURE: ${movedRows.length} of ${rows.length} replay sites`);

  lines.push("");
  lines.push("## Part B — the lockstep measurement (per combat/magic site; fills Plan 02's divergence records)");
  lines.push("");
  lines.push("## Record values (JSON, per moved site)");
  for (const r of movedRows) {
    lines.push("");
    lines.push(`### ${r.site}`);
    lines.push(`fields.before (prototype @end): ${JSON.stringify(r.fieldsBefore)}`);
    lines.push(`fields.after (engine @end): ${JSON.stringify(r.fieldsAfter)}`);
    lines.push(`state.before (prototype @end): ${JSON.stringify(r.stateBefore)}`);
    lines.push(`state.after (engine @end): ${JSON.stringify(r.stateAfter)}`);
    lines.push(`firstDivergentAction: ${r.firstDivergentAction}`);
    lines.push(`maxRound: ${r.maxRound}`);
    lines.push(`divergence.phase: ${r.divergencePhase}`);
  }

  console.log(lines.join("\n"));
}

main();
