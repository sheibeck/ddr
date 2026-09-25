// test/parity/roll-high-invariant.test.js
//
// Phase 73 (ROLL-05) runtime invariant. Per 73-CONTEXT.md Area 3 ("Proof it
// changed nothing"), rule 4: over every event in every group replayed here,
// every roll-carrying event satisfies `1 <= roll <= dieN` and its outcome
// equals `roll >= atLeast` (unless flagged `auto`). Each conversion plan
// (73-04 through 73-09) adds its event types to OUTCOME below as it
// converts them; 73-09 sets COMPLETE = true. The event-field contract is
// documented in docs/ROLL-LEDGER.md `### Event fields (Phase 73)` (73-03).
//
// This plan (73-02) adds the test SHELL only: OUTCOME is empty, COMPLETE is
// false, so none of I1-I6 can fire against TODAY's events (no event yet
// carries `atLeast` — that field doesn't exist until a later plan renames
// `need`). The self-test below proves the rule FUNCTIONS themselves are
// correct, independent of what the untouched engine emits today.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../engine/engine.js";
import { applyStartCombat } from "./harness/comparables.js";
import { makeRng } from "../../engine/rng.js";
import { openStore } from "../../engine/economy.js";
import { descend } from "../../engine/movement.js";
import { springTrap, openChest, encounterDot } from "../../engine/encounters.js";
import { playRun } from "../../tools/lib/tuning-bot.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

const CHARGEN_FIXTURE = readFixture("action-script.chargen.json");
const MOVEMENT_FIXTURE = readFixture("action-script.movement.json");
const COMBAT_FIXTURE = readFixture("action-script.combat.json");
const MAGIC_FIXTURE = readFixture("action-script.magic.json");
const ECONOMY_FIXTURE = readFixture("action-script.economy.json");
const ENCOUNTERS_FIXTURE = readFixture("action-script.encounters.json");

// --- constants later Phase 73 plans edit -----------------------------------

/**
 * OUTCOME — keyed by event type. Each value is `(event, following) =>
 * boolean`, returning whether the ROLLER succeeded, where `following` is
 * the rest of the SAME action's events (for pre-outcome events such as
 * spellThrown/fleeRolled, whose real outcome is a later event in the same
 * group). Empty in this plan — 73-04 through 73-09 add rows as each event
 * family converts to the roll-high `atLeast` shape.
 */
const OUTCOME = {};

/**
 * NESTED_CHECKS — nested keys that carry their own `{ roll, atLeast, dieN }`
 * triple (`soak`, `bag`), each with an outcome function `(nested) =>
 * boolean`. No event emitted by the untouched engine nests either key
 * today (confirmed by grep) — pure forward scaffolding for later plans.
 */
const NESTED_CHECKS = {
  soak: (nested) => nested.roll >= nested.atLeast,
  bag: (nested) => nested.roll >= nested.atLeast,
};

/**
 * SELECTION_ROLL_EVENTS — TABLE PICKS, not checks: they keep a bare `roll`
 * with no `atLeast` even once COMPLETE is true. Confirmed by grep of
 * `roll:` across every engine/ event push (73-02-PLAN.md's interfaces
 * block).
 */
const SELECTION_ROLL_EVENTS = ["encounterRolled", "vaporRolled", "insaneRolled", "insanityRolled", "afflictionRolled", "faerieMet"];

/** COMPLETE — set to true by 73-09, once every roll-carrying event has been converted. */
const COMPLETE = false;

// --- rule functions (I1-I6) -------------------------------------------------

function isValidRoll(roll, dieN) {
  return Number.isInteger(roll) && Number.isInteger(dieN) && dieN >= 2 && roll >= 1 && roll <= dieN;
}

function isValidRollsArray(rolls, dieN) {
  return Array.isArray(rolls) && rolls.length > 0 && rolls.every((r) => Number.isInteger(r) && r >= 1 && r <= dieN);
}

/**
 * checkEvent(event, following, opts) — runs I1-I6 against a single event
 * (opts.complete overrides the module-level COMPLETE, used by the self-test
 * to exercise I6 without flipping the real constant). Returns an array of
 * violation strings (empty when the event is fully compliant).
 */
function checkEvent(event, following, opts = {}) {
  const complete = opts.complete ?? COMPLETE;
  const violations = [];
  const hasAtLeast = Object.prototype.hasOwnProperty.call(event, "atLeast");

  // I1: an event carrying `atLeast` has an integer `dieN >= 2`; either a
  // valid `roll` or a valid `rolls` array (or both); and no `need` key.
  if (hasAtLeast) {
    if (!(Number.isInteger(event.dieN) && event.dieN >= 2)) {
      violations.push(`I1: dieN is not an integer >= 2 (got ${JSON.stringify(event.dieN)})`);
    } else {
      const rollOk = "roll" in event ? isValidRoll(event.roll, event.dieN) : false;
      const rollsOk = "rolls" in event ? isValidRollsArray(event.rolls, event.dieN) : false;
      if (!("roll" in event) && !("rolls" in event)) {
        violations.push("I1: atLeast present but neither roll nor rolls is present");
      } else if (("roll" in event) && !rollOk) {
        violations.push(`I1: roll out of range (roll=${event.roll} dieN=${event.dieN})`);
      } else if (("rolls" in event) && !rollsOk) {
        violations.push(`I1: rolls array has an out-of-range entry (dieN=${event.dieN})`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(event, "need")) {
      violations.push("I1: atLeast present alongside a need key");
    }
  }

  // I2: every nested check object (NESTED_CHECKS keys) obeys I1 and its
  // outcome function equals `roll >= atLeast`.
  for (const key of Object.keys(NESTED_CHECKS)) {
    const nested = event[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const nestedViolations = checkEvent(nested, [], { complete: false }).filter((v) => v.startsWith("I1"));
      for (const v of nestedViolations) violations.push(`I2 (${key}): ${v}`);
      if (Number.isInteger(nested.atLeast) === false && Object.prototype.hasOwnProperty.call(nested, "atLeast")) {
        // covered by the nested I1 check above; nothing further needed here.
      }
      if (Object.prototype.hasOwnProperty.call(nested, "atLeast") && Object.prototype.hasOwnProperty.call(nested, "roll")) {
        const expected = nested.roll >= nested.atLeast;
        const actual = NESTED_CHECKS[key](nested);
        if (actual !== expected) violations.push(`I2 (${key}): outcome function disagrees with roll >= atLeast`);
      }
    }
  }

  // I3: the event's type is in OUTCOME, and OUTCOME[type](event, following)
  // === (event.roll >= event.atLeast), unless event.auto === true. For a
  // rolls-only event, OUTCOME does the per-roll check itself and returns
  // true when consistent.
  if (hasAtLeast) {
    if (!(event.type in OUTCOME)) {
      violations.push(`I3: event type ${JSON.stringify(event.type)} carries atLeast but has no OUTCOME row`);
    } else if (event.auto !== true) {
      const outcomeFn = OUTCOME[event.type];
      if ("roll" in event) {
        const expected = event.roll >= event.atLeast;
        const actual = outcomeFn(event, following);
        if (actual !== expected) {
          violations.push(`I3: OUTCOME[${JSON.stringify(event.type)}] returned ${actual}, expected ${expected} (roll=${event.roll} atLeast=${event.atLeast})`);
        }
      } else {
        const actual = outcomeFn(event, following);
        if (actual !== true) {
          violations.push(`I3: OUTCOME[${JSON.stringify(event.type)}] returned ${actual} for a rolls-only event (expected true when internally consistent)`);
        }
      }
    }
  }

  // I4: when critAtLeast is present, the event is a critical, and
  // roll >= critAtLeast.
  if (Object.prototype.hasOwnProperty.call(event, "critAtLeast")) {
    const isCrit = !!(event.critical || event.crit || event.soldierCrit);
    if (!isCrit) {
      violations.push("I4: critAtLeast present but event is not flagged critical/crit/soldierCrit");
    } else if (!(Number.isInteger(event.roll) && event.roll >= event.critAtLeast)) {
      violations.push(`I4: critAtLeast present but roll (${event.roll}) < critAtLeast (${event.critAtLeast})`);
    }
  }

  // I5: every `mods` array holds `{ name: string, delta: non-zero integer }` entries.
  if (Array.isArray(event.mods)) {
    for (const m of event.mods) {
      const ok = m && typeof m === "object" && typeof m.name === "string" && Number.isInteger(m.delta) && m.delta !== 0;
      if (!ok) violations.push(`I5: malformed mods entry ${JSON.stringify(m)}`);
    }
  }

  // I6 (only when complete): every event carrying `roll` also carries
  // `atLeast`, or its type is in SELECTION_ROLL_EVENTS; and no event
  // carrying `roll` carries `need`.
  if (complete && Object.prototype.hasOwnProperty.call(event, "roll")) {
    const isSelection = SELECTION_ROLL_EVENTS.includes(event.type);
    if (!hasAtLeast && !isSelection) {
      violations.push(`I6: roll present but no atLeast, and type ${JSON.stringify(event.type)} is not in SELECTION_ROLL_EVENTS`);
    }
    if (Object.prototype.hasOwnProperty.call(event, "need")) {
      violations.push("I6: roll present alongside a need key");
    }
  }

  return violations;
}

/** checkGroup(events) — runs checkEvent over every event in one action's group, collecting all violations. */
function checkGroup(events) {
  const violations = [];
  for (let i = 0; i < events.length; i++) {
    const following = events.slice(i + 1);
    for (const v of checkEvent(events[i], following)) {
      violations.push(`event[${i}] (${events[i].type}): ${v}`);
    }
  }
  return violations;
}

// --- Task 3: the 31-site engine-only replay, grouped per action ------------

const REPLAY_INTERNAL_FNS = { openStore, springTrap, openChest, encounterDot, descend };

function applyInternal(state, fn) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  fn(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

/**
 * replaySiteGroups(seed, actions, { bumpGold }) — a local copy of
 * divergence-records.test.js's replaySiteEvents (ROLL-01 (b), L226-268),
 * EXCEPT it returns events GROUPED per action (one array per dispatched
 * action) instead of one flat array — the invariant's `following` argument
 * needs each action's own event list, not the whole replay's.
 */
function replaySiteGroups(seed, actions, { bumpGold = false } = {}) {
  let state = newRun(seed);
  if (bumpGold) state.c.gold = 5000;
  const groups = [];
  for (const action of actions) {
    let result;
    if (action.type === "startCombat") {
      result = applyStartCombat(state, action.wandering, action.forced);
    } else if (action.type in REPLAY_INTERNAL_FNS) {
      result = applyInternal(state, REPLAY_INTERNAL_FNS[action.type]);
    } else {
      result = applyAction(state, action);
    }
    state = result.state;
    groups.push(result.events || []);
  }
  return groups;
}

// --- Task 3: the bot-sweep event groups -------------------------------------

/**
 * BOT_SWEEP_RUNS — four runs (two solo, one party, one deep start), each
 * step's events kept as its own group via playRun's onStep. Sized to
 * produce "some thousands" of events (acceptance criterion) while keeping
 * this whole test under about 15 seconds.
 */
const BOT_SWEEP_RUNS = [
  { seed: 9001, opts: { maxActions: 1200 } },
  { seed: 9002, opts: { maxActions: 1200 } },
  { seed: 9003, opts: { party: true, maxActions: 1200 } },
  { seed: 9004, opts: { startDepth: 10, maxActions: 1000 } },
];

function botSweepGroups() {
  const groups = [];
  for (const cfg of BOT_SWEEP_RUNS) {
    playRun(cfg.seed, cfg.opts, (events) => {
      groups.push(events);
    });
  }
  return groups;
}

// --- the standing test -------------------------------------------------------

test("Phase 73 roll-high runtime invariant: 31 replay sites + a bot sweep, I1-I6 over every event", () => {
  let totalSites = 0;
  const allGroups = [];

  for (const seed of CHARGEN_FIXTURE.seeds) {
    totalSites++;
    newRun(seed); // chargen never dispatches an action — no events, no group
  }

  totalSites++;
  for (const group of replaySiteGroups(MOVEMENT_FIXTURE.seed, MOVEMENT_FIXTURE.actions)) allGroups.push(group);

  for (const scenario of COMBAT_FIXTURE.scenarios) {
    totalSites++;
    for (const group of replaySiteGroups(scenario.seed, scenario.actions)) allGroups.push(group);
  }

  for (const scenario of MAGIC_FIXTURE.scenarios) {
    totalSites++;
    for (const group of replaySiteGroups(scenario.seed, scenario.actions)) allGroups.push(group);
  }

  totalSites++;
  for (const group of replaySiteGroups(ECONOMY_FIXTURE.seed, ECONOMY_FIXTURE.actions, { bumpGold: true })) allGroups.push(group);

  for (const scenario of ENCOUNTERS_FIXTURE.scenarios) {
    totalSites++;
    for (const group of replaySiteGroups(scenario.seed, scenario.actions)) allGroups.push(group);
  }

  assert.equal(totalSites, 31, "the replay covers every one of the 31 parity sites");

  for (const group of botSweepGroups()) allGroups.push(group);

  let totalEvents = 0;
  const violations = [];
  for (const group of allGroups) {
    totalEvents += group.length;
    for (const v of checkGroup(group)) violations.push(v);
  }

  assert.ok(totalEvents >= 2000, `expected the bot sweep + 31-site replay to produce at least a couple thousand events, got ${totalEvents}`);
  assert.deepStrictEqual(violations, [], `expected zero I1-I6 violations across ${totalEvents} events`);
});

// --- self-test: synthetic groups prove each rule fires -----------------------

test("roll-high invariant self-test: each rule (I1-I6) fires on its own synthetic violation, and a well-formed event passes", () => {
  // I1 (a): out-of-range roll.
  assert.ok(
    checkEvent({ type: "selfTestCheck", atLeast: 15, dieN: 20, roll: 21 }, []).some((v) => v.startsWith("I1")),
    "expected an I1 violation for an out-of-range roll",
  );

  // I1 (b): a need key beside atLeast.
  assert.ok(
    checkEvent({ type: "selfTestCheck", atLeast: 15, dieN: 20, roll: 16, need: 5 }, []).some((v) => v.startsWith("I1")),
    "expected an I1 violation for a need key beside atLeast",
  );

  // I2: a bad nested soak (out-of-range roll inside the nested triple).
  assert.ok(
    checkEvent({ type: "selfTestCheck", soak: { atLeast: 15, dieN: 20, roll: 99 } }, []).some((v) => v.startsWith("I2")),
    "expected an I2 violation for a bad nested soak",
  );

  // I3 (a): a wrong outcome — register a deliberately-wrong OUTCOME fn.
  const originalOutcome = OUTCOME.selfTestWrongOutcome;
  OUTCOME.selfTestWrongOutcome = () => true; // always claims success
  try {
    const violations = checkEvent({ type: "selfTestWrongOutcome", atLeast: 15, dieN: 20, roll: 10 }, []); // 10 < 15, should be false
    assert.ok(violations.some((v) => v.startsWith("I3")), "expected an I3 violation for a wrong outcome");
  } finally {
    if (originalOutcome === undefined) delete OUTCOME.selfTestWrongOutcome;
    else OUTCOME.selfTestWrongOutcome = originalOutcome;
  }

  // I3 (b): a missing OUTCOME row.
  assert.ok(
    checkEvent({ type: "selfTestNoOutcomeRow", atLeast: 15, dieN: 20, roll: 16 }, []).some((v) => v.startsWith("I3")),
    "expected an I3 violation for a type with no OUTCOME row",
  );

  // I4: critAtLeast above the roll.
  assert.ok(
    checkEvent({ type: "selfTestCheck", atLeast: 1, dieN: 20, roll: 15, critAtLeast: 19, critical: true }, []).some((v) => v.startsWith("I4")),
    "expected an I4 violation when roll < critAtLeast on a flagged critical",
  );

  // I5: a malformed mods entry.
  assert.ok(
    checkEvent({ type: "selfTestCheck", mods: [{ name: "foo", delta: 0 }] }, []).some((v) => v.startsWith("I5")),
    "expected an I5 violation for a zero-delta mods entry",
  );

  // I6 (with COMPLETE forced on): a check event without atLeast.
  assert.ok(
    checkEvent({ type: "selfTestCheck", roll: 10 }, [], { complete: true }).some((v) => v.startsWith("I6")),
    "expected an I6 violation (forced COMPLETE) for a roll with no atLeast and not a selection type",
  );
  // I6 does not fire when COMPLETE is left at its real (false) value.
  assert.deepStrictEqual(
    checkEvent({ type: "selfTestCheck", roll: 10 }, []).filter((v) => v.startsWith("I6")),
    [],
    "expected zero I6 violations when complete is not forced (module COMPLETE is false)",
  );
  // I6 does not fire on a SELECTION_ROLL_EVENTS type even with COMPLETE forced on.
  assert.deepStrictEqual(
    checkEvent({ type: "encounterRolled", roll: 10 }, [], { complete: true }).filter((v) => v.startsWith("I6")),
    [],
    "expected zero I6 violations for a SELECTION_ROLL_EVENTS type",
  );

  // A well-formed event: zero violations.
  OUTCOME.selfTestWellFormed = (e) => e.roll >= e.atLeast;
  try {
    assert.deepStrictEqual(
      checkEvent({ type: "selfTestWellFormed", atLeast: 15, dieN: 20, roll: 16, mods: [{ name: "bonus", delta: 2 }] }, []),
      [],
      "expected zero violations for a well-formed event",
    );
  } finally {
    delete OUTCOME.selfTestWellFormed;
  }
});

test("COMPLETE is false in this plan", () => {
  assert.equal(COMPLETE, false);
});
