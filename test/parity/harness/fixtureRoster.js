// test/parity/harness/fixtureRoster.js
//
// FID-01 (Phase 17): a repeatable, replay-based enumeration of exactly which
// `content/bestiary.js` creatures each frozen parity fixture rolls. This is a
// library module beside comparables.js/diffState.js — NOT a `*.test.js` file,
// so `node --test` never picks it up on its own (test/parity/
// fixture-inventory.test.js imports and pins it).
//
// Every row comes from an ACTUAL REPLAY through the existing engine harness
// (applyStartCombat / applyAction / runEconomyAction) — never from reasoning
// about seeds or reading BESTIARY arrays by hand (see 17-01-PLAN.md's
// prohibitions). This mirrors test/parity/full-suite.test.js's own replay
// shape line-for-line so the enumeration draws from the identical code path
// every parity test already exercises.
//
// tools/fixture-inventory.mjs (a dev CLI) and test/parity/FIXTURE-INVENTORY.md
// (the committed document) both consume this module's exports.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../../engine/engine.js";
import { applyStartCombat, runEconomyAction } from "./comparables.js";
import { loadPrototypeSandbox } from "./sandboxPrototype.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

/** FIXTURE_ORDER — rows are always emitted in this fixture order, then in-
 * file scenario order (per the plan's `must_haves.truths` "FID-01 ordering"). */
export const FIXTURE_ORDER = ["chargen", "movement", "combat", "magic", "economy", "encounters"];

/** snapshotFoe(f) — the small, stable shape a row's `foes` entries carry;
 * pulled from `state.combat.foes` at the moment combat starts. */
function snapshotFoe(f) {
  return { name: f.name, type: f.type, lvl: f.lvl, wp: f.wp };
}

/**
 * replayEngineActions(fixtureFile, scenario, seed, actions) — replays a
 * single scenario/script's actions through the engine's own dispatch
 * (`applyStartCombat` for the internal `startCombat` action, `applyAction`
 * for everything else — the exact shapes test/parity/full-suite.test.js's
 * combat/magic sub-tests use), snapshotting `state.combat.foes` ONLY on the
 * null→non-null transition (a fight that persists across several actions is
 * recorded once). `movement`'s wandering-monster check uses this same path;
 * a transition there is labeled `trigger: "wandering"` since no `startCombat`
 * action drives it directly.
 */
function replayEngineActions(fixtureFile, scenario, seed, actions) {
  let state = newRun(seed);
  let trigger = "none";
  let forced = null;
  let foes = [];
  let wasCombat = state.combat != null;
  for (const action of actions) {
    let next;
    if (action.type === "startCombat") {
      trigger = "startCombat";
      forced = action.forced ?? null;
      ({ state: next } = applyStartCombat(state, action.wandering, action.forced));
    } else if (action.type === "castSpell") {
      ({ state: next } = applyAction(state, { type: "castSpell", idx: action.idx }));
    } else {
      ({ state: next } = applyAction(state, { type: action.type }));
    }
    const nowCombat = next.combat != null;
    // WR-02 fix (Phase 17 review): record EVERY null->non-null transition,
    // not just the first — a script that flees and re-engages (or otherwise
    // starts a second combat) would otherwise silently drop that encounter's
    // foes from the roster. Today's fixtures each start at most one combat
    // per scenario/script, so this concat is a no-op vs. the prior
    // single-snapshot behavior for every existing row.
    if (!wasCombat && nowCombat) {
      foes = foes.concat(next.combat.foes.map(snapshotFoe));
      if (trigger === "none") trigger = "wandering";
    }
    wasCombat = nowCombat;
    state = next;
  }
  return { fixture: fixtureFile, scenario, seed, trigger, forced, foes };
}

/**
 * replayEconomyLikeActions(fixtureFile, scenario, seed, actions, opts) —
 * economy/encounters fixtures dispatch through `runEconomyAction`, which
 * needs the prototype sandbox context (`loadPrototypeSandbox`) alongside the
 * engine state, mirroring test/parity/full-suite.test.js's economy/encounters
 * sub-test exactly (including the gold=5000 bump on BOTH sides before the
 * economy script). Neither domain ever references BESTIARY
 * (content/encounters.js has zero matches for "BESTIARY"), so every row here
 * is expected to end up `trigger: "none"` — but the transition check is still
 * real, not assumed, so a future change would be caught here too.
 */
function replayEconomyLikeActions(fixtureFile, scenario, seed, actions, { bumpGold = false } = {}) {
  const ctx = loadPrototypeSandbox({ seed });
  let state = newRun(seed);
  if (bumpGold) {
    ctx.S.c.gold = 5000;
    state.c.gold = 5000;
  }
  let trigger = "none";
  let foes = [];
  let wasCombat = state.combat != null;
  for (const action of actions) {
    const { state: next } = runEconomyAction(ctx, state, action);
    const nowCombat = next.combat != null;
    // WR-02 fix (Phase 17 review): see replayEngineActions above — record
    // every transition rather than only the first.
    if (!wasCombat && nowCombat) {
      foes = foes.concat(next.combat.foes.map(snapshotFoe));
      trigger = "wandering";
    }
    wasCombat = nowCombat;
    state = next;
  }
  return { fixture: fixtureFile, scenario, seed, trigger, forced: null, foes };
}

/**
 * enumerateFixtureRoster() — synchronous, no arguments. Reads every
 * `test/parity/fixtures/action-script.<name>.json` in FIXTURE_ORDER and
 * REPLAYS each script through the harness, returning an array of row objects
 * `{ fixture, scenario, seed, trigger, forced, foes }`. See this module's
 * header + 17-01-PLAN.md's Task 1 `<action>` for the full replay-rule spec.
 */
export function enumerateFixtureRoster() {
  const rows = [];

  // chargen: no actions at all — emit one explicit `trigger: "none"` row so
  // this fixture is never silently omitted from the inventory.
  {
    const fixtureFile = "action-script.chargen.json";
    const fixture = readFixture(fixtureFile);
    rows.push({
      fixture: fixtureFile,
      scenario: `(${fixture.seeds.length} seeds, no actions)`,
      seed: fixture.seed,
      trigger: "none",
      forced: null,
      foes: [],
    });
  }

  // movement: a single script — any combat that starts is a wandering-
  // monster roll (no startCombat action exists in this fixture).
  {
    const fixtureFile = "action-script.movement.json";
    const fixture = readFixture(fixtureFile);
    rows.push(replayEngineActions(fixtureFile, "(script)", fixture.seed, fixture.actions));
  }

  // combat: four independent scenarios, each forcing an encounter type via
  // startCombat.
  {
    const fixtureFile = "action-script.combat.json";
    const fixture = readFixture(fixtureFile);
    for (const scenario of fixture.scenarios) {
      rows.push(replayEngineActions(fixtureFile, scenario.name, scenario.seed, scenario.actions));
    }
  }

  // magic: four independent scenarios; only "cast-damage" starts combat.
  {
    const fixtureFile = "action-script.magic.json";
    const fixture = readFixture(fixtureFile);
    for (const scenario of fixture.scenarios) {
      rows.push(replayEngineActions(fixtureFile, scenario.name, scenario.seed, scenario.actions));
    }
  }

  // economy: a single script, gold bumped to 5000 on both sides before the
  // script (exactly like full-suite.test.js) so every purchase category is
  // reachable — openStore never references BESTIARY.
  {
    const fixtureFile = "action-script.economy.json";
    const fixture = readFixture(fixtureFile);
    rows.push(
      replayEconomyLikeActions(fixtureFile, "(script)", fixture.seed, fixture.actions, { bumpGold: true }),
    );
  }

  // encounters: five independent scenarios (trap/chest/tablefour/faerie/
  // affliction) — springTrap/openChest/encounterDot never reference BESTIARY.
  {
    const fixtureFile = "action-script.encounters.json";
    const fixture = readFixture(fixtureFile);
    for (const scenario of fixture.scenarios) {
      rows.push(replayEconomyLikeActions(fixtureFile, scenario.name, scenario.seed, scenario.actions));
    }
  }

  return rows;
}

/** foesCell(foes) — renders a row's `foes` array as the markdown table's
 * "Foes rolled" cell: `Name (Type lvl N, wp W)` entries joined by "; ", or an
 * em dash when empty. */
function foesCell(foes) {
  if (!foes.length) return "—";
  return foes.map((f) => `${f.name} (${f.type} lvl ${f.lvl}, wp ${f.wp})`).join("; ");
}

/**
 * rosterToMarkdown(rows) — pure; renders `enumerateFixtureRoster()`'s rows as
 * the exact markdown table `test/parity/FIXTURE-INVENTORY.md` embeds between
 * its generated-block markers. `\n` line endings, no trailing newline.
 */
export function rosterToMarkdown(rows) {
  const lines = [
    "| Fixture | Scenario | Seed | Trigger | Forced type | Foes rolled |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.fixture} | ${r.scenario} | ${r.seed} | ${r.trigger} | ${r.forced ?? "—"} | ${foesCell(r.foes)} |`,
    ),
  ];
  return lines.join("\n");
}
