#!/usr/bin/env node
// tools/worn-fixture-scan.mjs
//
// Phase 45 (HEDGE-03) — the live worn-exposure scan: replays every parity
// replay site through the real engine in lockstep with the frozen prototype
// sandbox, with the engine's freshly rolled character passed through
// `reconcileWorn` (the ONE line that simulates the collapse before Plan 02
// lands it; a no-op afterwards because `newRun` then creates `c.worn` itself
// — which is exactly why the output must be byte-identical before and after
// the engine edit), and reports which sites end up with a populated
// `c.worn` (an item left the engine's bag that the prototype still carries
// = a real, comparable-visible divergence to DECLARE, never to strip).
//
// A REPORT tool (always exits 0, makes no assertions — NOT a `*.test.js`
// file, `node --test` never picks it up), in the `tools/terrain-fixture-
// scan.mjs` pattern.
//
// Run:
//   node tools/worn-fixture-scan.mjs > tools/worn-fixture-scan-output.txt
//
// Plan 02's `test/parity/divergence-records.test.js` parses the `MOVED SET`
// line; `test/parity/FIXTURE-INVENTORY.md`'s Phase 45 section quotes the
// whole output (Plan 03).
//
// The scan reads `c.items`/`c.worn` directly — it imports NO `*Comparable`/
// `strip*` helper from the harness, so its output is independent of the
// harness carve-outs Plan 02 rewrites (`stripWornField` today, whatever
// replaces it after).

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../engine/engine.js";
import { reconcileWorn } from "../engine/derived.js";
import { loadPrototypeSandbox } from "../test/parity/harness/sandboxPrototype.js";
import { applyStartCombat, runEconomyAction, reconcilePendingLoot } from "../test/parity/harness/comparables.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "..", "test", "parity", "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

/**
 * startEngine(seed) — the ONE line that simulates the Phase 45 collapse:
 * `newRun(seed)` today never creates `c.worn` on its own (no options in
 * this plan); calling reconcileWorn explicitly right after is a complete
 * no-op once Plan 02 makes `newRun` do this itself (reconcileWorn returns
 * `null` and touches nothing when `c` already has an own `worn` key) — so
 * this scan's output is identical before and after that edit.
 */
function startEngine(seed) {
  const state = newRun(seed);
  reconcileWorn(state.c);
  return state;
}

/** itemNames(items) — a stable, human-readable summary of a bag array. */
function itemNames(items) {
  return Array.isArray(items) && items.length ? items.map((it) => it && it.n).join(", ") : "(none)";
}

/** wornNames(worn) — a stable, human-readable summary of a worn map. */
function wornNames(worn) {
  const entries = worn && typeof worn === "object" ? Object.entries(worn) : [];
  return entries.length ? entries.map(([k, it]) => `${k}=${it && it.n}`).join(", ") : "(none)";
}

/** wornKeyCount(c) — number of own keys of a plain-object `c.worn`, else 0. */
function wornKeyCount(c) {
  return c && c.worn && typeof c.worn === "object" && !Array.isArray(c.worn) ? Object.keys(c.worn).length : 0;
}

/**
 * reconciledEngineItems(engineState) — Phase 29 (LOOT-01/06): killFoe defers
 * a rolled combat drop into `state.pendingLoot` instead of the prototype's
 * mid-fight auto-take; `combat/lose` (seed 14) is the one fixture site that
 * ever rolls one (a jewel drop), per `reconcilePendingLoot`'s own doc
 * comment in comparables.js. Applying the SAME reconciliation the harness's
 * comparables use — onto a throwaway clone, never mutating `engineState` —
 * keeps the scan's items comparison honest: an UNEXPLAINED row must mean a
 * real, unexplained divergence, not the pre-existing, already-declared
 * pendingLoot indirection this phase does not touch.
 */
function reconciledEngineItems(engineState) {
  return reconcilePendingLoot({ c: engineState.c }, engineState.pendingLoot).c.items;
}

/** snapshot(ctx, engineState) — the comparable pair the row/record needs. */
function snapshot(ctx, engineState) {
  const engineItems = reconciledEngineItems(engineState);
  return {
    protoItems: itemNames(ctx.S.c.items),
    engineItems: itemNames(engineItems),
    engineWorn: wornNames(engineState.c.worn),
    protoItemsJson: JSON.stringify(ctx.S.c.items),
    engineItemsJson: JSON.stringify(engineItems),
    engineWornJson: JSON.stringify(engineState.c.worn ?? null),
  };
}

/**
 * replaySite({ fixture, site, seed, run }) — generic driver shared by every
 * site below: loads the prototype sandbox + reconciled engine start state,
 * snapshots chargen, hands off to the site-specific `run(ctx, engineState,
 * onAfterAction)` dispatcher (which copies full-suite.test.js's per-action
 * branches verbatim, dropping every assert), tracks the first mid-script
 * action index at which `c.worn`'s key count grows past its chargen count,
 * then snapshots the end state.
 */
function replaySite({ fixture, site, seed, run }) {
  const ctx = loadPrototypeSandbox({ seed });
  let engineState = startEngine(seed);

  const hero = `${engineState.c.cls} ${engineState.c.sub} ${engineState.c.race}`;
  const chargenKeys = wornKeyCount(engineState.c);
  const chargen = snapshot(ctx, engineState);

  let firstMidScriptWear = "never";
  const onAfterAction = (i, nextEngineState) => {
    engineState = nextEngineState;
    if (firstMidScriptWear === "never" && wornKeyCount(engineState.c) > chargenKeys) firstMidScriptWear = i;
  };

  run(ctx, engineState, onAfterAction, (s) => {
    engineState = s;
  });

  const end = snapshot(ctx, engineState);
  const moved = chargenKeys > 0 || firstMidScriptWear !== "never";
  const unexplained = (chargen.protoItems !== chargen.engineItems || end.protoItems !== end.engineItems) && !moved;

  return {
    fixture,
    site,
    seed,
    hero,
    wornAtChargen: chargen.engineWorn,
    firstMidScriptWear,
    chargen,
    end,
    moved,
    unexplained,
  };
}

function main() {
  const rows = [];

  // chargen — every seed of CHARGEN.seeds; no actions at all (chargen == end).
  {
    const fixture = "action-script.chargen.json";
    const CHARGEN = readFixture(fixture);
    for (const seed of CHARGEN.seeds) {
      rows.push(
        replaySite({
          fixture,
          site: `${fixture}#seed-${seed}`,
          seed,
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
        run: (ctx, engineState, onAfterAction, setEngineState) => {
          let state = engineState;
          MOVEMENT.actions.forEach((action, i) => {
            ctx.move(action.dir);
            const { state: next } = applyAction(state, action);
            state = next;
            onAfterAction(i, state);
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
              onAfterAction(i, state);
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
              onAfterAction(i, state);
            });
            setEngineState(state);
          },
        }),
      );
    }
  }

  // economy — the script. Gold bumped to 5000 on both sides AFTER the
  // chargen snapshot (matching full-suite.test.js), so `before.items` stays
  // the untouched chargen bag; the end snapshot is taken after the last
  // (`leaveStore`) action — the same state `declaredEndDiffs` reads in
  // Plan 02, and the value Plan 02 writes into the action-path record's
  // `after.items`/`after.worn`.
  {
    const fixture = "action-script.economy.json";
    const ECONOMY = readFixture(fixture);
    rows.push(
      replaySite({
        fixture,
        site: `${fixture}#script`,
        seed: ECONOMY.seed,
        run: (ctx, startState, onAfterAction, setEngineState) => {
          ctx.S.c.gold = 5000;
          let engineState = startState;
          engineState.c.gold = 5000;
          ECONOMY.actions.forEach((action, i) => {
            const { state: next } = runEconomyAction(ctx, engineState, action);
            engineState = next;
            onAfterAction(i, engineState);
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
          run: (ctx, startState, onAfterAction, setEngineState) => {
            let engineState = startState;
            scenario.actions.forEach((action, i) => {
              const { state: next } = runEconomyAction(ctx, engineState, action);
              engineState = next;
              onAfterAction(i, engineState);
            });
            setEngineState(engineState);
          },
        }),
      );
    }
  }

  // ---- output ----------------------------------------------------------

  const lines = [];
  lines.push("# worn-fixture-scan — Phase 45 (HEDGE-03): c.worn created on every fresh character");
  lines.push("");
  lines.push(
    "| Fixture | Site | Seed | Hero | worn at chargen | first mid-script wear | items @chargen (prototype) | items @chargen (engine) | worn @chargen (engine) | items @end (prototype) | items @end (engine) | worn @end (engine) | moved |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      `| ${r.fixture} | ${r.site} | ${r.seed} | ${r.hero} | ${r.wornAtChargen} | ${r.firstMidScriptWear} | ${r.chargen.protoItems} | ${r.chargen.engineItems} | ${r.chargen.engineWorn} | ${r.end.protoItems} | ${r.end.engineItems} | ${r.end.engineWorn} | ${r.moved} |`,
    );
  }

  const unexplainedRows = rows.filter((r) => r.unexplained);
  for (const r of unexplainedRows) lines.push(`UNEXPLAINED: ${r.site}`);

  lines.push("");
  const movedRows = rows.filter((r) => r.moved);
  lines.push(`MOVED SET (${movedRows.length}): ${movedRows.map((r) => r.site).join(", ")}`);
  lines.push(`WORN EXPOSURE: ${movedRows.length} of ${rows.length} replay sites`);

  lines.push("");
  lines.push("## Record values (JSON, per moved site)");
  for (const r of movedRows) {
    lines.push("");
    lines.push(`### ${r.site}`);
    lines.push(`before.items (prototype @chargen): ${r.chargen.protoItemsJson}`);
    lines.push(`after.items (engine @chargen): ${r.chargen.engineItemsJson}`);
    lines.push(`after.worn (engine @chargen): ${r.chargen.engineWornJson}`);
    lines.push(`end.before.items (prototype @end): ${r.end.protoItemsJson}`);
    lines.push(`end.after.items (engine @end): ${r.end.engineItemsJson}`);
    lines.push(`end.after.worn (engine @end): ${r.end.engineWornJson}`);
  }

  console.log(lines.join("\n"));
}

main();
