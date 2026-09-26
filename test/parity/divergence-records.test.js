// test/parity/divergence-records.test.js
//
// Phase 45 (HEDGE-03): a standing guard over EVERY declared divergence
// record across all six fixture files — "declared set == measured set,
// every field before != after". Complements chargen-parity.test.js's
// existing well-formedness guard (chargen-only, capped at 11 records) with a
// fixture-wide sweep that also pins the MOVED SET identity: the holders that
// declare `worn` in their `fields` must be EXACTLY the sites
// tools/worn-fixture-scan.mjs measured, no more, no less.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

// Phase 53 (JOIN-02): the exposure-replay imports for the guard below —
// engine-only (no prototype sandbox needed; this proves no replay site
// EVER meets a Joiner, not byte-parity).
import { newRun, applyAction } from "../../engine/engine.js";
import { applyStartCombat } from "./harness/comparables.js";
import { makeRng } from "../../engine/rng.js";
import { openStore } from "../../engine/economy.js";
import { descend } from "../../engine/movement.js";
import { springTrap, openChest, encounterDot } from "../../engine/encounters.js";
// Phase 54 (BAND-02, USER RULING D): the guard below — the identity commit.
import { difficultyCurve, foeCountFor, setDialsForTuning } from "../../engine/difficulty.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

const CHARGEN_FIXTURE = readFixture("action-script.chargen.json");
const MOVEMENT_FIXTURE = readFixture("action-script.movement.json");
const COMBAT_FIXTURE = readFixture("action-script.combat.json");
const MAGIC_FIXTURE = readFixture("action-script.magic.json");
const ECONOMY_FIXTURE = readFixture("action-script.economy.json");
const ENCOUNTERS_FIXTURE = readFixture("action-script.encounters.json");

const SCAN_OUTPUT_PATH = path.resolve(__dirname, "..", "..", "tools", "worn-fixture-scan-output.txt");
const INITIATIVE_SCAN_OUTPUT_PATH = path.resolve(__dirname, "..", "..", "tools", "initiative-fixture-scan-output.txt");

/**
 * collectRecords() — walks every fixture file and returns a flat array of
 * `{ id, holderId, kind, record }` entries, one per declared divergence
 * record found anywhere in the six fixture files:
 *   - `action-script.chargen.json#divergences` (keyed by seed string) —
 *     holder id `action-script.chargen.json#seed-<N>`.
 *   - a scenario-based fixture (combat/magic/encounters — carries a
 *     `.scenarios` array) — holder id `<file>#<scenario.name>`, one entry
 *     per `scenario.divergence` and `scenario.chargenDivergence` present.
 *   - a script-level fixture (movement/economy — no `.scenarios`, a single
 *     `seed`/`actions` pair at the top level) — holder id `<file>#script`,
 *     one entry per top-level `divergence`/`chargenDivergence` present.
 *
 * `id` is `<holderId>:<recordKey>` (`recordKey` one of `divergences`,
 * `divergence`, `chargenDivergence`) — a unique human-readable label for
 * assertion messages. `holderId` is the bare site identifier shared with
 * `tools/worn-fixture-scan-output.txt`'s MOVED SET vocabulary.
 */
function collectRecords() {
  const out = [];

  for (const [seedKey, record] of Object.entries(CHARGEN_FIXTURE.divergences || {})) {
    const holderId = `action-script.chargen.json#seed-${seedKey}`;
    out.push({ id: `${holderId}:divergences`, holderId, kind: "divergences", record });
  }

  const scenarioFixtures = [
    ["action-script.combat.json", COMBAT_FIXTURE],
    ["action-script.magic.json", MAGIC_FIXTURE],
    ["action-script.encounters.json", ENCOUNTERS_FIXTURE],
  ];
  for (const [fileName, fixture] of scenarioFixtures) {
    for (const scenario of fixture.scenarios || []) {
      const holderId = `${fileName}#${scenario.name}`;
      if (scenario.divergence) out.push({ id: `${holderId}:divergence`, holderId, kind: "divergence", record: scenario.divergence });
      if (scenario.chargenDivergence) out.push({ id: `${holderId}:chargenDivergence`, holderId, kind: "chargenDivergence", record: scenario.chargenDivergence });
    }
  }

  const scriptFixtures = [
    ["action-script.movement.json", MOVEMENT_FIXTURE],
    ["action-script.economy.json", ECONOMY_FIXTURE],
  ];
  for (const [fileName, fixture] of scriptFixtures) {
    const holderId = `${fileName}#script`;
    if (fixture.divergence) out.push({ id: `${holderId}:divergence`, holderId, kind: "divergence", record: fixture.divergence });
    if (fixture.chargenDivergence) out.push({ id: `${holderId}:chargenDivergence`, holderId, kind: "chargenDivergence", record: fixture.chargenDivergence });
  }

  return out;
}

const RECORDS = collectRecords();

test("every declared divergence record across all fixtures is narrow and well-formed", () => {
  assert.ok(RECORDS.length > 0, "expected at least one declared divergence record across the six fixtures");

  for (const { id, record } of RECORDS) {
    assert.ok(record.phase, `${id}: missing phase`);
    assert.ok(Array.isArray(record.requirements) && record.requirements.length > 0, `${id}: requirements must be a non-empty array`);
    assert.ok(Array.isArray(record.fields) && record.fields.length > 0, `${id}: fields must be a non-empty array`);
    assert.ok(record.before && typeof record.before === "object" && !Array.isArray(record.before), `${id}: missing/malformed before`);
    assert.ok(record.after && typeof record.after === "object" && !Array.isArray(record.after), `${id}: missing/malformed after`);
    assert.ok(typeof record.rationale === "string" && record.rationale.length > 0, `${id}: missing rationale`);

    for (const key of Object.keys(record.before)) {
      assert.ok(record.fields.includes(key), `${id}: before carries key "${key}" not declared in fields`);
    }
    for (const key of Object.keys(record.after)) {
      assert.ok(record.fields.includes(key), `${id}: after carries key "${key}" not declared in fields`);
    }

    if (record.kind === "action-path") {
      assert.ok(Number.isInteger(record.fromAction), `${id}: an action-path record must declare an integer fromAction`);
      // An action-path record's declared purpose is "the per-action byte
      // diff is skipped from fromAction onward because the RNG draw
      // sequence itself diverges" — its `fields` pin the machine-checked
      // END state, which can legitimately land on the SAME value both
      // sides (e.g. combat.json's pre-existing lose-apprentice/parley
      // records: the draw sequence differs but some end fields coincide).
      // The per-field "before != after" invariant below is therefore only
      // meaningful for a kind-less (field-strip) record; skip it here.
    } else {
      for (const field of record.fields) {
        assert.notDeepStrictEqual(
          record.before[field],
          record.after[field],
          `${id}: field "${field}" has no real before/after difference — this looks like a blanket regeneration, not a declared divergence`,
        );
      }
    }
  }
});

test("HEDGE-03: the holders declaring worn are exactly the scan's MOVED SET", () => {
  const scanOutput = fs.readFileSync(SCAN_OUTPUT_PATH, "utf8");
  // CRLF-tolerant: a Windows checkout (core.autocrlf=true, no .gitattributes)
  // writes this file back with \r\n, which the `$`-anchored regex below rejects.
  const movedSetLine = scanOutput.split(/\r?\n/).find((line) => /^MOVED SET \(\d+\): /.test(line));
  assert.ok(movedSetLine, "tools/worn-fixture-scan-output.txt must carry a MOVED SET line");

  const match = movedSetLine.match(/^MOVED SET \((\d+)\): (.*)$/);
  assert.ok(match, "MOVED SET line did not match the expected format");
  const [, countStr, idList] = match;
  const moved = new Set(
    idList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  assert.equal(moved.size, Number(countStr), "MOVED SET line's declared count does not match its own id list length");

  const declared = new Set(RECORDS.filter(({ record }) => Array.isArray(record.fields) && record.fields.includes("worn")).map(({ holderId }) => holderId));

  assert.ok(declared.size > 0, "expected at least one holder to declare worn");
  assert.deepStrictEqual([...declared].sort(), [...moved].sort());
});

test("INIT-01: the holders declaring Phase 51 are exactly the initiative scan's MOVED SET", () => {
  const scanOutput = fs.readFileSync(INITIATIVE_SCAN_OUTPUT_PATH, "utf8");
  const movedSetLine = scanOutput.split(/\r?\n/).find((line) => /^MOVED SET \(\d+\): /.test(line));
  assert.ok(movedSetLine, "tools/initiative-fixture-scan-output.txt must carry a MOVED SET line");

  const match = movedSetLine.match(/^MOVED SET \((\d+)\): (.*)$/);
  assert.ok(match, "MOVED SET line did not match the expected format");
  const [, countStr, idList] = match;
  const moved = new Set(
    idList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  assert.equal(moved.size, Number(countStr), "MOVED SET line's declared count does not match its own id list length");

  const declared = new Set(
    RECORDS.filter(({ kind, record }) => kind === "divergence" && String(record.phase ?? "").split("+").includes("51")).map(
      ({ holderId }) => holderId,
    ),
  );

  assert.ok(declared.size > 0, "expected at least one holder to declare Phase 51");
  assert.deepStrictEqual([...declared].sort(), [...moved].sort());
});

test("DMG-02: the holders declaring Phase 52 are exactly the measured moved set", () => {
  // Unlike Phase 51's INIT-01 guard above, tools/initiative-fixture-scan.mjs
  // carries no crit-exposure predictor line — a foe crit is not an
  // initiative-round-advance event, so it cannot be read off the scan's own
  // Part A invariant. The measured set below comes from the Phase 52 plan's
  // own crit-exposure predictor (a scratch replay of every combat/magic site
  // counting struckByFoe/memberStruck events with critical/soldierCrit),
  // cross-checked against tools/initiative-fixture-scan.mjs's Part B diff at
  // this commit (only #lose's fields.after moved) and the full parity suite
  // (all green) — see test/parity/FIXTURE-INVENTORY.md's Phase 52 section for
  // the full accounting.
  const EXPECTED = ["action-script.combat.json#lose"];

  const declared = new Set(
    RECORDS.filter(({ kind, record }) => kind === "divergence" && String(record.phase ?? "").split("+").includes("52")).map(
      ({ holderId }) => holderId,
    ),
  );

  assert.ok(declared.size > 0, "expected at least one holder to declare Phase 52");
  assert.deepStrictEqual([...declared].sort(), [...EXPECTED].sort());
});

// Phase 53 (JOIN-02) — an internal-call action-type table, mirroring
// comparables.js's own INTERNAL_FNS (never imported directly — comparables.js
// does not export it — so this is a small, deliberate re-declaration for the
// replay below).
const JOIN02_INTERNAL_FNS = { openStore, springTrap, openChest, encounterDot, descend };

function join02ApplyInternal(state, fn) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  fn(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

/**
 * replaySiteEvents(seed, actions, { bumpGold }) — Phase 53 (JOIN-02): a
 * compact, engine-only replay (no prototype sandbox — this proves exposure,
 * not byte-parity) mirroring tools/initiative-fixture-scan.mjs's own
 * dispatch shape: `startCombat` -> applyStartCombat, an internal-call type
 * (openStore/springTrap/openChest/encounterDot/descend) -> the clone/rng-
 * rehydrate/persist shape comparables.js's own runEconomyAction uses,
 * everything else -> applyAction with the FULL action object (movement's
 * `dir` must survive — fixtureRoster.js's own replayEngineActions strips
 * down to `{ type }` and would silently lose it). Returns every event seen
 * and whether `state.pendingJoiner` was ever truthy across the whole replay.
 */
function replaySiteEvents(seed, actions, { bumpGold = false } = {}) {
  let state = newRun(seed);
  if (bumpGold) state.c.gold = 5000; // full-suite.test.js's own economy gold bump
  const allEvents = [];
  // Phase 54 (BAND-02): eventsAtDepth2Plus collects every event emitted by
  // an action whose RESULTING state.floor.depth is >= 2 — the floor-2
  // exposure check (part d) below. maxDepthEver tracks the deepest
  // state.floor.depth ever reached (initial newRun depth included) — the
  // WALL_FROM_DEPTH exposure check (part b). Neither addition changes the
  // JOIN-02 test's own assertions, which destructure only `events` /
  // `pendingJoinerEver`.
  const eventsAtDepth2Plus = [];
  let pendingJoinerEver = !!state.pendingJoiner;
  let maxDepthEver = state.floor.depth;
  // Phase 75 (RULES-13, Plan 09): staffEverSet tracks whether state.c.staff
  // was ever truthy at ANY point across the whole replay (not just the
  // final state) — a staff wielded then unequipped mid-script would
  // otherwise escape a final-state-only check. No existing test destructures
  // this field, so its addition is additive/backward-compatible.
  let staffEverSet = !!(state.c && state.c.staff);
  for (const action of actions) {
    let result;
    if (action.type === "startCombat") {
      result = applyStartCombat(state, action.wandering, action.forced);
    } else if (action.type in JOIN02_INTERNAL_FNS) {
      result = join02ApplyInternal(state, JOIN02_INTERNAL_FNS[action.type]);
    } else {
      result = applyAction(state, action);
    }
    state = result.state;
    const events = result.events || [];
    allEvents.push(...events);
    if (state.floor.depth >= 2) eventsAtDepth2Plus.push(...events);
    if (state.floor.depth > maxDepthEver) maxDepthEver = state.floor.depth;
    if (state.pendingJoiner) pendingJoinerEver = true;
    if (state.c && state.c.staff) staffEverSet = true;
  }
  return { state, events: allEvents, pendingJoinerEver, maxDepthEver, eventsAtDepth2Plus, staffEverSet };
}

test("JOIN-02: the holders declaring Phase 53 are exactly the measured moved set — zero, and no replay site ever meets a Joiner", () => {
  // Part (a): the declared set, DMG-02-shaped, but legitimately EMPTY — the
  // Level Table cap adds no rng draw and no replay site's encounter-roll
  // table lands on "Joiner" (see the exposure replay in part (b) below and
  // test/parity/FIXTURE-INVENTORY.md's Phase 53 section for the full
  // accounting: the scan Part B diff is empty, the parity suite is green
  // with zero fixture edits, and this same exposure replay found 0
  // `joinerMet` events across all 31 sites at this commit).
  const EXPECTED = [];

  const declared = new Set(
    RECORDS.filter(({ kind, record }) => kind === "divergence" && String(record.phase ?? "").split("+").includes("53")).map(
      ({ holderId }) => holderId,
    ),
  );

  // NOT the INIT-01/DMG-02 `declared.size > 0` assertion above — this set is
  // LEGITIMATELY empty; a measured zero is still a claim that needs proof,
  // never a default assumed by omission.
  assert.deepStrictEqual([...declared].sort(), EXPECTED);

  // Part (b): the positive proof — replay every one of the 31 replay sites
  // and assert no site ever emits a joinerMet event, ever rolls "Joiner" off
  // the encounter table, or ever sets state.pendingJoiner.
  let totalSites = 0;

  for (const seed of CHARGEN_FIXTURE.seeds) {
    totalSites++;
    const state = newRun(seed);
    assert.ok(!state.pendingJoiner, `chargen seed ${seed}: pendingJoiner must be falsy (no actions ever run)`);
  }

  const { events: movementEvents, pendingJoinerEver: movementPending } = replaySiteEvents(MOVEMENT_FIXTURE.seed, MOVEMENT_FIXTURE.actions);
  totalSites++;
  assert.equal(movementEvents.filter((e) => e.type === "joinerMet").length, 0, "movement: 0 joinerMet events");
  assert.ok(!movementEvents.some((e) => e.type === "encounterRolled" && e.result === "Joiner"), "movement: no encounterRolled Joiner result");
  assert.ok(!movementPending, "movement: pendingJoiner never set");

  for (const scenario of COMBAT_FIXTURE.scenarios) {
    totalSites++;
    const { events, pendingJoinerEver } = replaySiteEvents(scenario.seed, scenario.actions);
    assert.equal(events.filter((e) => e.type === "joinerMet").length, 0, `combat#${scenario.name}: 0 joinerMet events`);
    assert.ok(!events.some((e) => e.type === "encounterRolled" && e.result === "Joiner"), `combat#${scenario.name}: no encounterRolled Joiner result`);
    assert.ok(!pendingJoinerEver, `combat#${scenario.name}: pendingJoiner never set`);
  }

  for (const scenario of MAGIC_FIXTURE.scenarios) {
    totalSites++;
    const { events, pendingJoinerEver } = replaySiteEvents(scenario.seed, scenario.actions);
    assert.equal(events.filter((e) => e.type === "joinerMet").length, 0, `magic#${scenario.name}: 0 joinerMet events`);
    assert.ok(!events.some((e) => e.type === "encounterRolled" && e.result === "Joiner"), `magic#${scenario.name}: no encounterRolled Joiner result`);
    assert.ok(!pendingJoinerEver, `magic#${scenario.name}: pendingJoiner never set`);
  }

  {
    totalSites++;
    const { events, pendingJoinerEver } = replaySiteEvents(ECONOMY_FIXTURE.seed, ECONOMY_FIXTURE.actions, { bumpGold: true });
    assert.equal(events.filter((e) => e.type === "joinerMet").length, 0, "economy: 0 joinerMet events");
    assert.ok(!events.some((e) => e.type === "encounterRolled" && e.result === "Joiner"), "economy: no encounterRolled Joiner result");
    assert.ok(!pendingJoinerEver, "economy: pendingJoiner never set");
  }

  for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
    totalSites++;
    const { events, pendingJoinerEver } = replaySiteEvents(scenario.seed, scenario.actions);
    assert.equal(events.filter((e) => e.type === "joinerMet").length, 0, `encounters#${scenario.name}: 0 joinerMet events`);
    assert.ok(!events.some((e) => e.type === "encounterRolled" && e.result === "Joiner"), `encounters#${scenario.name}: no encounterRolled Joiner result`);
    assert.ok(!pendingJoinerEver, `encounters#${scenario.name}: pendingJoiner never set`);
  }

  // The scan's own convention: 14 chargen seeds + 1 movement script + 6
  // combat scenarios + 4 magic scenarios + 1 economy script + 5 encounters
  // scenarios = 31 replay sites — this guard provably covers every site the
  // scan reports.
  assert.equal(totalSites, 31, "the guard covers every one of the 31 replay sites the scan reports");
});

// PHASE_54_FITTED_FLOOR1_CURVE — difficultyCurve(1) under the fitted (USER
// RULING G cycle 3) engine, pasted verbatim from a `node -e` capture
// against the landed engine/difficulty.js. USER RULING D's own text ("Every
// fixture will move (floor 1 changes — dots, hazards, hero HP, rations, foe
// hit scale)... the engine gate becomes 'everything that moves is
// declared', not 'nothing moves'") is realized here: foeLevel still maps to
// 1 (its own clamp(1,5) floor — FOE_LEVEL's fitted map(1) rounds to 1), but
// dots/foeHitScale/foeHpScale/hazardScale all move off their identity
// values because their fitted `perDepth` != 0 (the structural `=== 1`/
// `perDepth === 0` fast paths in engine/difficulty.js never engage once a
// dial is genuinely fitted, at ANY depth including 1).
const PHASE_54_FITTED_FLOOR1_CURVE = {
  depth: 1,
  breather: false,
  dots: 7,
  darkBlobs: 0,
  darkRadius: 4,
  waterPools: 1,
  storeTier: 0,
  foeLevel: 1,
  foeHitScale: 0.61,
  foeHpScale: 0.915,
  hazardScale: 0.62,
  abilityThreat: 1,
};

test("BAND-02 (USER RULING D/G): the holders declaring Phase 54 are exactly the measured moved set of the FITTED (54-07) commit; difficultyCurve(1) reads the fitted curve (floor 1 is no longer parity-exact — declared, per Ruling D); the count roll keeps the canon draw shape", () => {
  // Part (a): EXPECTED is the MEASURED moved set — everything that moves
  // under the FITTED dials is declared (USER RULING D's "everything that
  // moves is declared" guard). This grows substantially from the identity
  // commit's 2 holders (flee/lose-apprentice, a level-cap cause) once the
  // fit ships (USER RULING G cycle 3, fit/fit-log.jsonl #13, score 2.7113
  // PASS): every scenario/script whose end-of-run `c` fields move under
  // HERO_HP_SCALE/HERO_SP_SCALE/LOOT_SCALE/FOE_HIT_SCALE/etc — win (kill SP),
  // chest (LOOT_SCALE chest gold), cast-damage (kill SP + rations), and
  // movement#script (the descend SP bonus) are NEW action-path records this
  // commit; lose/lose-plain/parley's PRE-EXISTING action-path records
  // (Phase 24/27/31/51/52's own causes) are RE-MEASURED for their now-moved
  // end-state fields and re-declared with "54" appended to `phase`.
  //
  // USER RULING G (2026-09-21, cycle 3, "Adjustment 2"): encounters.json's
  // tablefour scenario's declared "dot-hp cause" record from the IDENTITY
  // commit is RETIRED — fixing the Table-4 HP-dot compounding bug (54-05's
  // DOT_HP_FRACTION was a fraction of the hero's own CURRENT maxWP, which
  // fed the "+25 HP" row's own output back into its next input) replaced it
  // with DOT_HP_BASE's flat canon value (25) scaled ONCE by HERO_HP_SCALE.
  // At the IDENTITY point (HERO_HP_SCALE 1, the commit immediately after
  // Adjustment 2 lands, before the fit), dotHpFor("large") returns EXACTLY
  // 25 — the same flat canon amount the frozen prototype grants — so that
  // scenario's action-path no longer diverges there; at the FITTED point
  // (HERO_HP_SCALE 1.25) it is folded into `action-script.encounters.json
  // #chest`'s own chargenDivergence (maxWP/wp/rations) instead — tablefour
  // itself stays undeclared (both sides still land on the SAME flat 25 *
  // 1.25, since HERO_HP_SCALE applies identically to both the "large" dot
  // and the chargen maxWP it lands on). See test/parity/FIXTURE-
  // INVENTORY.md's Phase 54 section for the full predictor/scan/moved-set
  // accounting.
  const EXPECTED = [
    "action-script.combat.json#flee",
    "action-script.combat.json#lose",
    "action-script.combat.json#lose-apprentice",
    "action-script.combat.json#lose-plain",
    "action-script.combat.json#parley",
    "action-script.combat.json#win",
    "action-script.encounters.json#chest",
    "action-script.magic.json#cast-damage",
    "action-script.movement.json#script",
  ].sort();

  const declared = new Set(
    RECORDS.filter(({ kind, record }) => kind === "divergence" && String(record.phase ?? "").split("+").includes("54")).map(
      ({ holderId }) => holderId,
    ),
  );

  assert.deepStrictEqual([...declared].sort(), EXPECTED);

  // Part (b): difficultyCurve(1) reads the FITTED curve exactly — floor 1
  // is a declared mover under the global model (USER RULING D), not a
  // never-moved invariant; this pin proves the shipped DIALS produce
  // EXACTLY this floor-1 shape, measured, never hand-typed.
  assert.deepStrictEqual(difficultyCurve(1), PHASE_54_FITTED_FLOOR1_CURVE);

  // Part (c): the count roll keeps the canon draw shape — a first d4 <= 2
  // draws exactly one d4; a first d4 > 2 draws exactly two — regardless of
  // FOE_COUNT_SKEW (every row of the table, restored after).
  for (let skew = 0; skew <= 4; skew++) {
    const restore = setDialsForTuning({ FOE_COUNT_SKEW: skew });
    try {
      let draws = 0;
      const countingD4 = () => {
        draws++;
        return 2; // <= 2: the short-circuit path, no second draw
      };
      assert.equal(foeCountFor(countingD4(), () => { throw new Error("must not draw a second d4 when the first is <= 2"); }), 1);
      assert.equal(draws, 1, `skew ${skew}: a first roll <= 2 must draw exactly one d4`);

      let draws2 = 0;
      const firstOver2 = 3;
      const drawSecond = () => {
        draws2++;
        return 4;
      };
      foeCountFor(firstOver2, drawSecond);
      assert.equal(draws2, 1, `skew ${skew}: a first roll > 2 must draw exactly one MORE d4 (two total)`);
    } finally {
      restore();
    }
  }

  // Part (d): totalSites === 31 — the replay-site walk this guard's
  // predecessors used, kept as a structural completeness proof (every site
  // the scan/inventory accounts for is still reachable and replayable).
  let totalSites = 0;
  for (const seed of CHARGEN_FIXTURE.seeds) {
    totalSites++;
    newRun(seed);
  }
  totalSites++;
  replaySiteEvents(MOVEMENT_FIXTURE.seed, MOVEMENT_FIXTURE.actions);
  for (const scenario of COMBAT_FIXTURE.scenarios) {
    totalSites++;
    replaySiteEvents(scenario.seed, scenario.actions);
  }
  for (const scenario of MAGIC_FIXTURE.scenarios) {
    totalSites++;
    replaySiteEvents(scenario.seed, scenario.actions);
  }
  totalSites++;
  replaySiteEvents(ECONOMY_FIXTURE.seed, ECONOMY_FIXTURE.actions, { bumpGold: true });
  for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
    totalSites++;
    replaySiteEvents(scenario.seed, scenario.actions);
  }
  assert.equal(totalSites, 31, "the guard covers every one of the 31 replay sites the scan reports");
});

// Phase 61 (GRULE-01): the combat gear lock moves zero fixtures — no replay
// site dispatches a gated gear verb, and no replay emits gearRefused. The
// GATED verbs mirror engine/items.js#refuseGear's five call sites.
const GRULE01_GATED = new Set(["equipItem", "unequipSlot", "takeLoot", "takeAllLoot", "takeFind"]);

test("GRULE-01 (Phase 61): the combat gear lock moves zero fixtures — no replay site dispatches a gated gear verb, and no replay emits gearRefused", () => {
  // Part (a): no fixture action list ever dispatches a gated gear verb — the
  // movement/economy top-level `actions`, and every combat/magic/encounters
  // scenario's own `actions`.
  const actionLists = [
    MOVEMENT_FIXTURE.actions,
    ECONOMY_FIXTURE.actions,
    ...COMBAT_FIXTURE.scenarios.map((s) => s.actions),
    ...MAGIC_FIXTURE.scenarios.map((s) => s.actions),
    ...ENCOUNTERS_FIXTURE.scenarios.map((s) => s.actions),
  ];
  const offenders = [];
  for (const actions of actionLists) {
    for (const action of actions || []) {
      if (GRULE01_GATED.has(action.type)) offenders.push(action.type);
    }
  }
  assert.deepStrictEqual(offenders, [], `expected no fixture action to dispatch a gated gear verb; found: ${offenders.join(", ")}`);

  // Part (b): replay every one of the 31 sites and assert zero gearRefused
  // events anywhere — a legitimately empty moved set still needs proof, not
  // an assumption baked into silence (the JOIN-02 precedent above).
  let totalSites = 0;
  let gearRefusedCount = 0;

  for (const seed of CHARGEN_FIXTURE.seeds) {
    totalSites++;
    newRun(seed); // chargen never dispatches an action at all
  }

  totalSites++;
  gearRefusedCount += replaySiteEvents(MOVEMENT_FIXTURE.seed, MOVEMENT_FIXTURE.actions).events.filter((e) => e.type === "gearRefused").length;

  for (const scenario of COMBAT_FIXTURE.scenarios) {
    totalSites++;
    gearRefusedCount += replaySiteEvents(scenario.seed, scenario.actions).events.filter((e) => e.type === "gearRefused").length;
  }

  for (const scenario of MAGIC_FIXTURE.scenarios) {
    totalSites++;
    gearRefusedCount += replaySiteEvents(scenario.seed, scenario.actions).events.filter((e) => e.type === "gearRefused").length;
  }

  totalSites++;
  gearRefusedCount += replaySiteEvents(ECONOMY_FIXTURE.seed, ECONOMY_FIXTURE.actions, { bumpGold: true }).events.filter((e) => e.type === "gearRefused").length;

  for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
    totalSites++;
    gearRefusedCount += replaySiteEvents(scenario.seed, scenario.actions).events.filter((e) => e.type === "gearRefused").length;
  }

  assert.equal(totalSites, 31, "the guard covers every one of the 31 replay sites the scan reports");
  assert.equal(gearRefusedCount, 0, "expected zero gearRefused events across every replay site");
});

// Phase 61 (STORE-02): a store purchase always delivers — the measured
// moved set is exactly the economy script's Axe purchase (action 3, a
// legal-but-not-better weapon buy that is now bagged, not lost).
test("STORE-02 (Phase 61): the holders declaring Phase 61 are exactly the measured moved set — the economy script's Axe is bagged, not lost", () => {
  // Part (a): the declared set, DMG-02/INIT-01-shaped.
  const EXPECTED = ["action-script.economy.json#script"];

  const declared = new Set(
    RECORDS.filter(({ kind, record }) => kind === "divergence" && String(record.phase ?? "").split("+").includes("61")).map(
      ({ holderId }) => holderId,
    ),
  );

  assert.deepStrictEqual([...declared].sort(), [...EXPECTED].sort());

  // Part (b): replay the economy script and prove the measured outcome —
  // exactly one purchaseBagged event, for the Axe, with a non-null `why`;
  // and no notBetter itemRejected (the pre-Phase-61 behaviour this plan
  // retires for a store buy).
  const { events: economyEvents } = replaySiteEvents(ECONOMY_FIXTURE.seed, ECONOMY_FIXTURE.actions, { bumpGold: true });
  const purchaseBaggedEvents = economyEvents.filter((e) => e.type === "purchaseBagged");
  assert.equal(purchaseBaggedEvents.length, 1, "expected exactly one purchaseBagged event in the economy replay");
  assert.equal(purchaseBaggedEvents[0].item?.n, "Axe", "the one purchaseBagged event must be the Axe");
  assert.ok(purchaseBaggedEvents[0].why != null, "purchaseBagged.why must be non-null");
  const notBetterRejections = economyEvents.filter((e) => e.type === "itemRejected" && e.reason === "notBetter");
  assert.equal(notBetterRejections.length, 0, "expected zero notBetter itemRejected events — Phase 61 bags instead of rejecting");

  // Part (c): across every OTHER replay site, zero purchaseBagged events —
  // only the economy script's store visit ever buys anything.
  let otherPurchaseBaggedCount = 0;
  for (const seed of CHARGEN_FIXTURE.seeds) {
    newRun(seed); // chargen never dispatches an action at all
  }
  otherPurchaseBaggedCount += replaySiteEvents(MOVEMENT_FIXTURE.seed, MOVEMENT_FIXTURE.actions).events.filter((e) => e.type === "purchaseBagged").length;
  for (const scenario of COMBAT_FIXTURE.scenarios) {
    otherPurchaseBaggedCount += replaySiteEvents(scenario.seed, scenario.actions).events.filter((e) => e.type === "purchaseBagged").length;
  }
  for (const scenario of MAGIC_FIXTURE.scenarios) {
    otherPurchaseBaggedCount += replaySiteEvents(scenario.seed, scenario.actions).events.filter((e) => e.type === "purchaseBagged").length;
  }
  for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
    otherPurchaseBaggedCount += replaySiteEvents(scenario.seed, scenario.actions).events.filter((e) => e.type === "purchaseBagged").length;
  }
  assert.equal(otherPurchaseBaggedCount, 0, "expected zero purchaseBagged events outside the economy script");
});

// Phase 72 (ROLL-01): the roll-direction sign audit's known fixes. Each
// fixing plan (72-04, 72-05, 72-06, 72-07) measures its OWN moved set and
// extends this constant; 72-04 (Thief evasion sign + the member-branch
// insult reorder) measures zero — evasion is 0 at identity everywhere, and
// no replay site's `state.party`/`combat.allies` is ever populated (the
// JOIN-02 guard above already proves no site ever meets a Joiner, and none
// of the six fixture files hand-builds a party either), so the member
// branch this plan touches never runs against any of the 31 sites. 72-05
// (Fridgian frenzy's second swing, ROLL-01 (b)) also measures zero — the
// one Fridgian hero whose action script reaches a second strike
// (`combat#lose`, seed 14) fires frenzy 4 times, and all 4 resulting
// swing-2 rolls land on the same side of both the old hard-set need (3)
// and the new measured need, so no hit/miss outcome flips (see
// test/parity/FIXTURE-INVENTORY.md's Plan 05 section for the full
// predictor table and live-scan confirmation). 72-06 (the Skeleton shatter,
// ROLL-01 (c)) also measures zero — test/parity/FIXTURE-INVENTORY.md's
// "Parity-exposed bestiary surface" is exactly Beasts lvl 1 (Bat/Rat,
// Shriek, Viper) and Humans lvl 1 (Ned): no replay site ever meets a
// Skeleton or an M&M, and none dispatches a Vampire summon (the one foe
// ability that could ever put a Skeleton on the board), so the new
// `shatterOnBest`-gated code path this plan adds is provably unreachable by
// every one of the 31 replay sites (see FIXTURE-INVENTORY.md's Plan 06
// section for the full predictor and live-scan confirmation). 72-07's F5
// (PARLEY_NEED_MOD subtracted instead of added) also measures zero — the
// dial defaults to 0 in every fixture, and `Math.min(...) - 0` is byte-
// identical to `Math.min(...) + 0`, so the sign change is a structural
// no-op regardless of whether a fixture ever calls parley. 72-07's F1
// (member/legacy/summon strikes gain the hero's per-target to-hit rules)
// also measures zero, by the SAME reasoning as 72-04's member-branch proof
// above: no fixture ever populates `state.party`/`combat.allies`/
// `combat.ally`, so `memberStrike`/`alliesTurn`'s legacy branch/`allyTurn`
// never run against any of the 31 sites (see part (d) below). 72-07's F3
// (the Shadow's `sp.daggerOnly` becomes real) also measures zero — the
// "Parity-exposed bestiary surface" quoted above is the complete roster
// every fixture can ever roll, and it contains no Shadow (nor any other
// `daggerOnly`/`magicOnly`/`toHit`/`fast`/`slow`-flagged foe), so the new
// daggerOnly branch playerStrike/memberStrike/the legacy branch/allyTurn
// gained is provably unreachable too (see part (e) below).
const ROLL01_EXPECTED_HOLDERS = [];

test("ROLL-01 (Phase 72): the holders declaring Phase 72 are exactly the measured moved set; no replay site reaches the member branch, shatters a foe, strikes as an ally, or meets a Shadow", () => {
  // Part (a): the declared set — legitimately empty for 72-04/05/06/07,
  // exactly like JOIN-02's own empty-set precedent above.
  const declared = new Set(
    RECORDS.filter(({ kind, record }) => kind === "divergence" && String(record.phase ?? "").split("+").includes("72")).map(
      ({ holderId }) => holderId,
    ),
  );
  assert.deepStrictEqual([...declared].sort(), [...ROLL01_EXPECTED_HOLDERS].sort());

  // Part (b): the positive proof — replay every one of the 31 replay sites
  // and assert zero memberStruck events and zero foeMissed events carrying a
  // `member` field. Both event shapes only ever originate from foeTurn's
  // member branch (engine/combat.js), which only ever runs when
  // pickFoeTarget finds a live party member — no fixture ever carries one.
  //
  // Part (c) (72-06, ROLL-01 (c)): the same 31-site replay also asserts zero
  // `foeShattered` events — no replay site ever meets a shatter-flagged foe
  // (the Skeleton), so `shatterIfBest` never fires against any fixture.
  //
  // Part (d) (72-07, F1): the same 31-site replay also asserts zero
  // `allyStruck`/`allyMissed` events — these only ever originate from
  // `memberStrike`, `alliesTurn`'s legacy branch, or `allyTurn`, none of
  // which ever run without a populated `state.party`/`combat.allies`/
  // `combat.ally` — proving F1's per-target-rule additions to all three
  // functions are unreachable by every one of the 31 sites.
  //
  // Part (e) (72-07, F3): the same 31-site replay also asserts no
  // `encounterStarted` event ever names a Shadow among its foes — proving
  // F3's new daggerOnly branch is unreachable too.
  let totalSites = 0;
  let memberStruckCount = 0;
  let memberMissedCount = 0;
  let foeShatteredCount = 0;
  let allyEventCount = 0;
  let shadowEncounterCount = 0;

  const tally = (events) => {
    memberStruckCount += events.filter((e) => e.type === "memberStruck").length;
    memberMissedCount += events.filter((e) => e.type === "foeMissed" && e.member).length;
    foeShatteredCount += events.filter((e) => e.type === "foeShattered").length;
    allyEventCount += events.filter((e) => e.type === "allyStruck" || e.type === "allyMissed").length;
    shadowEncounterCount += events.filter(
      (e) => e.type === "encounterStarted" && Array.isArray(e.foes) && e.foes.some((f) => f.name === "Shadow"),
    ).length;
  };

  for (const seed of CHARGEN_FIXTURE.seeds) {
    totalSites++;
    newRun(seed); // chargen never dispatches an action at all
  }

  totalSites++;
  tally(replaySiteEvents(MOVEMENT_FIXTURE.seed, MOVEMENT_FIXTURE.actions).events);

  for (const scenario of COMBAT_FIXTURE.scenarios) {
    totalSites++;
    tally(replaySiteEvents(scenario.seed, scenario.actions).events);
  }

  for (const scenario of MAGIC_FIXTURE.scenarios) {
    totalSites++;
    tally(replaySiteEvents(scenario.seed, scenario.actions).events);
  }

  totalSites++;
  tally(replaySiteEvents(ECONOMY_FIXTURE.seed, ECONOMY_FIXTURE.actions, { bumpGold: true }).events);

  for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
    totalSites++;
    tally(replaySiteEvents(scenario.seed, scenario.actions).events);
  }

  assert.equal(totalSites, 31, "the guard covers every one of the 31 replay sites the scan reports");
  assert.equal(memberStruckCount, 0, "expected zero memberStruck events across every replay site (no fixture carries a party)");
  assert.equal(memberMissedCount, 0, "expected zero member-targeted foeMissed events across every replay site");
  assert.equal(foeShatteredCount, 0, "expected zero foeShattered events across every replay site (no fixture ever meets a shatter-flagged foe)");
  assert.equal(allyEventCount, 0, "expected zero allyStruck/allyMissed events across every replay site (F1 code paths are unreachable — no fixture ever populates a party or a summon)");
  assert.equal(shadowEncounterCount, 0, "expected zero Shadow encounters across every replay site (F3's daggerOnly branch is unreachable)");
});

// Phase 75 (RULES-03, Plan 05, user 2026-09-25): the Summoner's offense
// school gate is removed (content/mu-chart.js), and grant-time legality
// (engine/character.js#grantableAt) is wired into all four grimoire grant
// paths. Two chargen-seed `divergences` records (24, 29) and one combat
// `chargenDivergence` record (lose-apprentice) are the measured moved set —
// see test/parity/FIXTURE-INVENTORY.md's Phase 75 Plan 05 section for the
// full predictor/live-scan accounting (seed 15, the Summoner, was PREDICTED
// but measured NOT to move — its grimoire is byte-identical to the
// pre-existing Phase 40 declared value). Unlike every single-kind guard
// above, this covers all three record kinds (divergences/divergence/
// chargenDivergence) — a Phase-75 declaration can land on any of them.
const RULES75_EXPECTED_HOLDERS = [
  "action-script.chargen.json#seed-24",
  "action-script.chargen.json#seed-29",
  "action-script.combat.json#lose-apprentice",
].sort();

test("RULES-03 (Phase 75): the holders declaring Phase 75 are exactly the measured moved set", () => {
  const declared = new Set(
    RECORDS.filter(({ record }) => String(record.phase ?? "").split("+").includes("75")).map(({ holderId }) => holderId),
  );
  assert.deepStrictEqual([...declared].sort(), RULES75_EXPECTED_HOLDERS);
});

/**
 * countPhase75Exposure(events) -> the per-event-type counts the 31-site
 * exposure guard below tallies, extracted as its own pure function so a
 * dedicated "does this guard have teeth" test (below) can feed it a
 * doctored event list without needing a live engine replay.
 */
function countPhase75Exposure(events) {
  return {
    wardRaised: events.filter((e) => e.type === "wardRaised").length,
    wardReflected: events.filter((e) => e.type === "wardReflected").length,
    sensesGained: events.filter((e) => e.type === "sensesGained").length,
    combatInDark: events.filter((e) => e.type === "combatInDark").length,
    wanderingMonster: events.filter((e) => e.type === "wanderingMonster").length,
    tileResumed: events.filter((e) => e.type === "tileResumed").length,
    halvedHeal: events.filter((e) => (e.type === "healed" || e.type === "regenerated") && e.halved).length,
    booksKept: events.filter((e) => e.type === "wentHungry" && e.booksKept).length,
  };
}

// 75-13: the Phase 75 close-out sibling guard — a 31-site exposure replay
// proving the "measured zero" claim for every OTHER Phase 75 plan
// (02/04/06/07/08/09/10/12; see test/parity/FIXTURE-INVENTORY.md's "Plans
// 02, 04, 06, 07, 08, 09, 10, 12 — measured zero" subsection for the full
// per-plan predictor/measurement accounting this test proves the positive
// side of). No fixture ever: raises or reflects a ward (no site casts
// Shield or Bubble — RULES-05/RULES-14, 75-06), gains senses (no site casts
// Sense Presence — RULES-05, 75-06), fights in the dark (no site's
// startCombat ever sets combat.inDark — RULES-05, 75-06), meets a wandering
// monster mid-step or resumes a pending tile (RULES-12, 75-12), wields a
// staff at any point in the replay (RULES-13, 75-07/75-09), goes hungry
// with a spent-and-kept book (RULES-15, 75-12), or heals/regenerates with
// the Summoner's halved flag set (RULES-03 second half, 75-10 — no fixture
// ever rolls a Summoner into a heal-casting seat). The declared set stays
// exactly RULES75_EXPECTED_HOLDERS (Plan 05's three holders) — none of
// these eight plans added a fourth.
test("RULES-05/06/12/13/15 (Phase 75, Plans 02/04/06/07/08/09/10/12): every one of the 31 replay sites measures zero exposure to the other Phase-75 rule changes", () => {
  let totalSites = 0;
  const totals = { wardRaised: 0, wardReflected: 0, sensesGained: 0, combatInDark: 0, wanderingMonster: 0, tileResumed: 0, halvedHeal: 0, booksKept: 0 };
  let staffEverSetAnywhere = false;

  const tally = (events, staffEverSet) => {
    const counts = countPhase75Exposure(events);
    for (const key of Object.keys(totals)) totals[key] += counts[key];
    if (staffEverSet) staffEverSetAnywhere = true;
  };

  for (const seed of CHARGEN_FIXTURE.seeds) {
    totalSites++;
    const state = newRun(seed); // chargen never dispatches an action at all
    if (state.c && state.c.staff) staffEverSetAnywhere = true;
  }

  totalSites++;
  {
    const r = replaySiteEvents(MOVEMENT_FIXTURE.seed, MOVEMENT_FIXTURE.actions);
    tally(r.events, r.staffEverSet);
  }

  for (const scenario of COMBAT_FIXTURE.scenarios) {
    totalSites++;
    const r = replaySiteEvents(scenario.seed, scenario.actions);
    tally(r.events, r.staffEverSet);
  }

  for (const scenario of MAGIC_FIXTURE.scenarios) {
    totalSites++;
    const r = replaySiteEvents(scenario.seed, scenario.actions);
    tally(r.events, r.staffEverSet);
  }

  totalSites++;
  {
    const r = replaySiteEvents(ECONOMY_FIXTURE.seed, ECONOMY_FIXTURE.actions, { bumpGold: true });
    tally(r.events, r.staffEverSet);
  }

  for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
    totalSites++;
    const r = replaySiteEvents(scenario.seed, scenario.actions);
    tally(r.events, r.staffEverSet);
  }

  assert.equal(totalSites, 31, "the guard covers every one of the 31 replay sites the scan reports");
  assert.equal(totals.wardRaised, 0, "expected zero wardRaised events (no fixture casts Shield or Bubble)");
  assert.equal(totals.wardReflected, 0, "expected zero wardReflected events (no fixture carries an armed mirror)");
  assert.equal(totals.sensesGained, 0, "expected zero sensesGained events (no fixture casts Sense Presence)");
  assert.equal(totals.combatInDark, 0, "expected zero combatInDark events (no fixture starts combat in the dark)");
  assert.equal(totals.wanderingMonster, 0, "expected zero wanderingMonster events (no fixture's newDay check interrupts a feature tile)");
  assert.equal(totals.tileResumed, 0, "expected zero tileResumed events (RULES-12's resolvePendingTile never fires)");
  assert.equal(totals.halvedHeal, 0, "expected zero halved healed/regenerated events (no fixture ever rolls a Summoner into a heal-casting seat)");
  assert.equal(totals.booksKept, 0, "expected zero wentHungry events carrying booksKept (no fixture reaches an unfed day with a spent book)");
  assert.equal(staffEverSetAnywhere, false, "expected c.staff to never be set across any replay site (no fixture equips or wields a staff)");

  const declared = new Set(
    RECORDS.filter(({ record }) => String(record.phase ?? "").split("+").includes("75")).map(({ holderId }) => holderId),
  );
  assert.deepStrictEqual([...declared].sort(), RULES75_EXPECTED_HOLDERS, "the declared Phase 75 set is still exactly RULES75_EXPECTED_HOLDERS after this sibling guard's replay");
});

// 75-13 (teeth proof): the plan's own must-have requires proving the guard
// above would actually FAIL on a non-zero count, not just that it currently
// reads zero on real fixtures — a doctored event list run through the same
// counting function makes that assertion concrete without needing a live
// engine replay.
test("RULES-05/06/12/13/15 exposure guard has teeth: a doctored event list is caught by the same counting function", () => {
  const doctored = [
    { type: "wardRaised" },
    { type: "wardReflected" },
    { type: "sensesGained" },
    { type: "combatInDark" },
    { type: "wanderingMonster" },
    { type: "tileResumed" },
    { type: "healed", halved: true },
    { type: "regenerated", halved: true },
    { type: "wentHungry", booksKept: true },
    // Controls that must NOT be counted: same event types without the
    // Phase-75 flag, and an unrelated event type entirely.
    { type: "healed", halved: false },
    { type: "wentHungry", booksKept: false },
    { type: "itemUsed" },
  ];
  const counts = countPhase75Exposure(doctored);
  assert.equal(counts.wardRaised, 1);
  assert.equal(counts.wardReflected, 1);
  assert.equal(counts.sensesGained, 1);
  assert.equal(counts.combatInDark, 1);
  assert.equal(counts.wanderingMonster, 1);
  assert.equal(counts.tileResumed, 1);
  assert.equal(counts.halvedHeal, 2, "both the halved healed and the halved regenerated event must count");
  assert.equal(counts.booksKept, 1);
  // Prove the zero-count assertions the real guard makes would genuinely
  // FAIL against this doctored list.
  assert.throws(() => assert.equal(counts.wardRaised, 0), assert.AssertionError);
  assert.throws(() => assert.equal(counts.halvedHeal, 0), assert.AssertionError);
});
