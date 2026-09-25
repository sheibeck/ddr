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
// 73-02 added the test SHELL (OUTCOME empty, COMPLETE false). 73-04 adds the
// first real rows: the hero's own strike/miss, the frenzy trigger, and the
// foe's natural-armor soak of the hero's blow. COMPLETE stays false until
// 73-09 converts the last event family. The self-test below proves the rule
// FUNCTIONS themselves are correct, independent of what OUTCOME contains.

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
 * group). 73-05 through 73-09 add more rows as each event family converts
 * to the roll-high `atLeast` shape.
 *
 * 73-04 rows: the hero's own strike (struck/strikeMissed), the frenzy
 * trigger, and the foe's natural-armor soak of the hero's blow. Each event
 * type only ever fires on ONE side of its own check, so the outcome is a
 * constant (never computed from `following`) — I3 still cross-checks it
 * against `event.roll >= event.atLeast` for every non-auto event.
 */
const OUTCOME = {
  struck: () => true, // a struck event only fires once the hero's blow landed
  strikeMissed: () => false, // a strikeMissed event only fires once the hero's blow missed
  frenzy: () => true, // a frenzy event only fires once the frenzy-trigger check succeeded
  foeArmorSoaked: () => true, // a foeArmorSoaked event only fires once the foe's natural-armor soak succeeded
  // 73-05 rows: member/legacy/summoned-ally strikes and thrown attack spells
  // (hero + member).
  allyStruck: () => true, // an allyStruck event only fires once a member/ally/summon's blow landed
  allyMissed: () => false, // an allyMissed event only fires once a member/ally/summon's blow missed
  foeShattered: () => true, // a shatter only fires on a landed blow showing the die's best face (atLeast = dieN)
  // spellThrown announces the roll BEFORE its outcome is known — the real
  // outcome is whichever of spellHit/spellMissed follows in the SAME
  // action, for the SAME target, before the next spellThrown (an AOE cast
  // pushes one spellThrown per target in sequence).
  spellThrown: (e, following) => {
    for (const ev of following) {
      if (ev.type === "spellThrown") break;
      if (ev.type === "spellMissed" && ev.target === e.target) return false;
    }
    return true;
  },
  // allyCast only carries atLeast for a thrown spell (status/stun/weaken
  // casts push a bare allyCast with no roll fields, so I3 never runs on
  // them). Its real outcome is whichever of allySpellHit/allySpellMissed
  // follows in the same action, before the next allyCast — a resisted miss
  // (resisted: true) is a DIFFERENT check (the target's resist roll), not
  // this cast's own to-hit, so only an unresisted allySpellMissed counts.
  allyCast: (e, following) => {
    for (const ev of following) {
      if (ev.type === "allyCast") break;
      if (ev.type === "allySpellMissed" && ev.resisted === false) return false;
    }
    return true;
  },
  // 73-06 rows: resistance (resistRoll, both directions) and the magic
  // mishaps. Every one of these fires on only ONE side of its own check, so
  // (like the 73-04 rows above) the outcome is a constant.
  spellResisted: () => true, // the FOE's own resist check succeeded
  resistFailed: () => false, // the FOE's own resist check failed
  heroResisted: () => true, // the HERO's own resist check succeeded
  heroResistFailed: () => false, // the HERO's own resist check failed
  // allySpellMissed only ever carries atLeast/roll on its resisted:true form
  // (the target's OWN resist roll); the resisted:false form (the caster's
  // own to-hit miss) carries no roll fields, so I3 never evaluates this row
  // for it — see allyCast's own OUTCOME fn above for that outcome instead.
  allySpellMissed: () => true,
  // the Apprentice/doubled-summon backfire mishap gates fire on a natural 1
  // (roll 1, atLeast 2, dieN 8) — the caster's own safety check FAILED.
  spellBackfired: () => false,
  summonBackfired: () => false,
  // 73-07 rows: the foe's own to-hit rolls (hero branch, member branch,
  // pursuit) and the hero's own armor soak. Each fires on only ONE side of
  // its own check, so the outcome is a constant, exactly like the 73-04/06
  // rows above.
  foeMissed: () => false, // a foeMissed event only fires once the foe's own to-hit check failed
  struckByFoe: () => true, // a struckByFoe event only fires once the foe's own to-hit check succeeded
  memberStruck: () => true, // a memberStruck event only fires once the foe's own to-hit check succeeded (against a member)
  armorSoaked: () => true, // an armorSoaked event only fires once the hero's armor soak check succeeded
  // 73-08 rows: flee, parley, the startCombat/fight gates, the kill drops
  // and the foe ability gate.
  // fleeRolled announces the roll BEFORE its outcome is known — the real
  // outcome is whichever of fled/fleeFailed follows in the SAME action,
  // before the next fleeRolled (mirrors spellThrown's own pattern above).
  fleeRolled: (e, following) => {
    for (const ev of following) {
      if (ev.type === "fleeRolled") break;
      if (ev.type === "fleeFailed") return false;
    }
    return true;
  },
  // parleyRolled likewise announces the roll before its outcome; the real
  // outcome is whichever of parleyFailed/spGained("parley")/beastsSoothed
  // follows, before the next parleyRolled.
  parleyRolled: (e, following) => {
    for (const ev of following) {
      if (ev.type === "parleyRolled") break;
      if (ev.type === "parleyFailed") return false;
    }
    return true;
  },
  // foeFled (reason "conArtist") only carries atLeast when the Con Artist
  // weak-foe flee die was drawn and it succeeded; foeFled's "knight"/
  // "lowHp" reasons carry no roll fields at all, so I3 never runs on them.
  foeFled: () => true,
  // foeBored only ever carries atLeast on a landed Court Mage boredom kill.
  foeBored: () => true,
  // phobiaAfraid only carries atLeast when the Hardiness shrug die was
  // drawn AND it FAILED — a successful shrug never pushes phobiaAfraid at
  // all (the fear never lands).
  phobiaAfraid: () => false,
  // lootDropped only carries atLeast on a landed kill-drop gate (its nested
  // `bag` triple, when present, is covered by NESTED_CHECKS/I2 instead).
  lootDropped: () => true,
  // foeCast only carries atLeast when the ability gate's own die was drawn
  // (never_melee skips the gate entirely) AND it succeeded — the ability
  // never fires off a failed gate.
  foeCast: () => true,
  // 73-09 rows: traps, locks, climbs, leaps, cures, wake, and the Cutthroat
  // murder check.
  trapAvoided: () => true, // a trapAvoided event only fires once the dodge check succeeded
  trapSprung: () => false, // trapSprung only fires once the dodge check failed (and the hero is not a Pilfer)
  trapDisarmed: () => false, // trapDisarmed (Pilfer) only fires once the dodge check failed
  chestLockRolled: (e) => !!e.opened, // opened is exactly the check's own .ok
  // climbedOver/fellClimbing both carry `roll` (the LAST segment's roll)
  // alongside `rolls` (every segment's own roll) — the loop halts on the
  // first failed segment, so a climbedOver's `rolls` are ALL at or above
  // atLeast, and a fellClimbing's `rolls` are every-earlier-segment-passed
  // followed by exactly one failing last segment.
  climbedOver: (e) => Array.isArray(e.rolls) && e.rolls.every((r) => r >= e.atLeast),
  fellClimbing: (e) => {
    if (!Array.isArray(e.rolls) || e.rolls.length === 0) return true;
    const last = e.rolls[e.rolls.length - 1];
    const priorAllOk = e.rolls.slice(0, -1).every((r) => r >= e.atLeast);
    return !(last < e.atLeast && priorAllOk);
  },
  leaptOver: () => true, // a leaptOver event only fires once the leap check succeeded
  fellInGorge: () => false, // fellInGorge only fires once the leap check failed
  afflictionCured: () => true, // afflictionCured only fires once the cure check succeeded
  afflictionLingers: () => false, // afflictionLingers only fires once the cure check failed
  // wanderingMonster carries no singular `roll` — only `rolls` (the eight
  // hourly draws, already-high/unmirrored) — so `hours` must equal the
  // count of rolls that failed the hero's quiet check (roll < atLeast).
  wanderingMonster: (e) => Array.isArray(e.rolls) && e.rolls.filter((r) => r < e.atLeast).length === e.hours,
  joinerMurdered: () => false, // a mishap on the natural 1 — always a failure for the hero
};

/**
 * NESTED_CHECKS — nested keys that carry their own `{ roll, atLeast, dieN }`
 * triple (`soak`, `bag`), each with an outcome function `(nested) =>
 * boolean`. Since 73-04, a landed `struck` event nests a failed `soak`
 * triple (`nested.roll < nested.atLeast` — a landed blow means the foe's
 * armor soak did NOT succeed); `bag` remains forward scaffolding for a
 * later plan.
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
const COMPLETE = true;

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
  // I6 does not fire when complete is explicitly forced off (independent of
  // the module's real COMPLETE value, which 73-09 sets to true).
  assert.deepStrictEqual(
    checkEvent({ type: "selfTestCheck", roll: 10 }, [], { complete: false }).filter((v) => v.startsWith("I6")),
    [],
    "expected zero I6 violations when complete is forced off",
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

test("COMPLETE is true — every roll-carrying event has been converted", () => {
  assert.equal(COMPLETE, true);
});

// --- ROLL-05 standing zero-declaration check --------------------------------
//
// 73-10: walks every declared divergence record across all six fixture
// files — the same shape test/parity/divergence-records.test.js#collectRecords
// walks, re-implemented locally here so this file carries its own standing
// guard — and asserts that none of them declares Phase 73. This is the
// machine-checked half of "proof it changed nothing": the byte-identical
// parity suite, the unchanged direction tests, the unmoved state pins/save
// and the matching 200-seed readout together mean the roll-high mirror
// never needed to regenerate a fixture or declare a divergence anywhere.

function collectDivergenceRecords() {
  const out = [];

  for (const [seedKey, record] of Object.entries(CHARGEN_FIXTURE.divergences || {})) {
    out.push({ id: `action-script.chargen.json#seed-${seedKey}:divergences`, record });
  }

  const scenarioFixtures = [
    ["action-script.combat.json", COMBAT_FIXTURE],
    ["action-script.magic.json", MAGIC_FIXTURE],
    ["action-script.encounters.json", ENCOUNTERS_FIXTURE],
  ];
  for (const [fileName, fixture] of scenarioFixtures) {
    for (const scenario of fixture.scenarios || []) {
      const holderId = `${fileName}#${scenario.name}`;
      if (scenario.divergence) out.push({ id: `${holderId}:divergence`, record: scenario.divergence });
      if (scenario.chargenDivergence) out.push({ id: `${holderId}:chargenDivergence`, record: scenario.chargenDivergence });
    }
  }

  const scriptFixtures = [
    ["action-script.movement.json", MOVEMENT_FIXTURE],
    ["action-script.economy.json", ECONOMY_FIXTURE],
  ];
  for (const [fileName, fixture] of scriptFixtures) {
    const holderId = `${fileName}#script`;
    if (fixture.divergence) out.push({ id: `${holderId}:divergence`, record: fixture.divergence });
    if (fixture.chargenDivergence) out.push({ id: `${holderId}:chargenDivergence`, record: fixture.chargenDivergence });
  }

  return out;
}

test("ROLL-05 zero-declaration: no divergence record anywhere declares Phase 73", () => {
  const records = collectDivergenceRecords();
  assert.ok(records.length > 0, "expected at least one declared divergence record across the six fixtures");
  const phase73 = records.filter(({ record }) =>
    String(record.phase ?? "")
      .split("+")
      .map((s) => s.trim())
      .includes("73"),
  );
  assert.deepStrictEqual(
    phase73.map((r) => r.id),
    [],
    "expected zero divergence records to declare Phase 73 — the roll-high mirror changed representation only, never outcome",
  );
});
