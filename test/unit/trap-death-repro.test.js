// test/unit/trap-death-repro.test.js
//
// RULES-06 (Phase 75, plan 75-01) — the resumed root-cause session for the
// 2026-09-22 field report ("a floor-2 trap that the Oracle showed as -1 HP
// killed a 21-HP Elven Ninja"). See .planning/debug/trap-death-21hp-oracle-
// minus1.md for the full evidence trail (the 2026-09-22 session, re-verified
// here, plus this Phase 75 session's engine-scale reproduction (500 seeds,
// ~197k actions) and shell-level 8-path audit).
//
// This file pins the two re-verified facts the debug file's Phase 75
// session confirms still hold on master (Phases 73/74 did not regress
// them): (1) the trap's narrated dmg is the SAME value subtracted from
// c.wp — narration can never disagree with the actual loss for a single
// trapSprung event; (2) planBeat's last hero-hp frame still equals the
// real final hp for a multi-swing fold (CMBUI-10: now the adjacent-identical " ×N" fold) (the 2026-09-22 fix,
// src/browser/combatBeat.js, regression-tested in combat-beat.test.js —
// pinned again here as this session's own artifact, per the plan's own
// instruction to "build the states directly, the way combat-beat.test.js
// and encounters.test.js do").
//
// No production file changed by this plan — every case below is a PASSING
// pin of already-correct, already-fixed behavior. Nothing here is left as a
// pending/skipped case because this session's Verdict is "no NEW cause
// confirmed" (see the debug file's Phase 75 ### Verdict) — the 2026-09-22
// root cause and its fix are re-verified, not superseded.
//
// Phase 75, plan 75-08 — 75-01's own ### Fix inputs says no code fix is
// required (the Verdict is the "no reproduction of a NEW cause" branch), so
// this plan adds only the two RULES-06 boundary cases Task 1's own
// <behavior> names (a hero at dmg+1 hp survives a trap of dmg with exactly
// 1 hp; a hero at exactly dmg hp dies, cause "trap", and the trapSprung
// line prints dmg) plus the engine-scale sweep Task 2's own <behavior>
// names (promoting 75-01's ad hoc "75-01-trap-death-repro.mjs" scratchpad
// technique into a permanent, committed guard) — appended at the end of
// this file, below the three tests 75-01 already pinned.

import test from "node:test";
import assert from "node:assert/strict";

import { springTrap } from "../../engine/encounters.js";
import { newRun } from "../../engine/state.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";
import { planBeat, beatOffsets, beatEndMs } from "../../src/browser/combatBeat.js";
import { playRun, RUN_FLAGS } from "../../tools/lib/tuning-bot.mjs";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07: this suite's damage pins are canon-mechanic numbers, so it
// runs under the same identity-dials override encounters.test.js uses.
setIdentityDials();

/** fakeRng(seq) — mirrors test/unit/encounters.test.js's own helper. */
function fakeRng(seq) {
  let i = 0;
  return {
    d: () => {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 21, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = [];
  for (let y = 0; y < 11; y++) {
    g.push([]);
    for (let x = 0; x < 11; x++) g[y].push({ wall: x === 0 || y === 0 || x === 10 || y === 10, seen: true, feat: null });
  }
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g, px: 5, py: 5, depth: 2, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}
function fixedCombat(foes, overrides = {}) {
  return { foes, type: "Beasts", round: 3, target: 0, spellOpen: false, tracked: false, first: "you", ...overrides };
}

// ── (1) trapSprung's narrated dmg is the SAME value subtracted from c.wp ──

test("RULES-06 (Phase 75 re-verification): a sprung trap's narrated dmg equals the real c.wp loss — the report's central claim (a small narrated number killing a much-higher-hp hero) cannot happen for a single trapSprung event", () => {
  // A 21-hp Elven Ninja (the report's own numbers), floor 2 (state.floor.depth
  // set in fixedState above). dodge=20 (misses nimble=5+3 Acrobat-only bonus,
  // n/a here); trap table roll=2 -> Falling Rocks (d20); damage roll=1 -> the
  // exact "-1 HP" shape the report described.
  const state = fixedState({ c: { sub: "Thief", wp: 21 } });
  const before = state.c.wp;
  const events = springTrap(state, fakeRng([20, 2, 1]), []);

  const sprung = events.find((e) => e.type === "trapSprung");
  assert.ok(sprung, "sanity: a trapSprung event must fire on a missed dodge");
  assert.equal(sprung.dmg, 1, "sanity: this scripted roll must reproduce the report's own '-1 HP' shape");

  // The engine's own subtraction and the event's own dmg field are read off
  // the SAME local variable in engine/encounters.js#springTrap (`c.wp -=
  // dmg; ...events.push({ type: "trapSprung", ..., dmg })`) — assert the
  // OBSERVABLE consequence holds, not the implementation detail.
  assert.equal(before - state.c.wp, sprung.dmg, "the hp actually removed must equal the event's own dmg field");
  assert.equal(state.c.wp, 20, "a 21-hp hero survives a genuine -1 HP trap");
  assert.equal(state.dead, false);

  // The Oracle's own narration table reads the SAME event field — no
  // second, independently-computed number that could ever disagree.
  const line = EVENT_NARRATION.trapSprung(sprung);
  assert.match(line, /−1 hp/, "the Oracle line must print the SAME -1, not a different number");
});

test("RULES-06 (Phase 75 re-verification): a sprung trap's narrated dmg equals the real c.wp loss even when it is fatal (an overkill blow clamps c.wp to 0, not below — die() owns the clamp, not springTrap)", () => {
  // dodge=20 (miss); table roll=8 -> Spike (d10, times 5); damage roll=5 -> 25,
  // well past this hero's 21 hp — the OPPOSITE shape from the report (a
  // correctly-narrated, sufficient blow), included here because the Phase 75
  // engine-scale reproduction's own (ii) count flagged this exact shape (a
  // narratedLossSum that reads MORE than the clamped actualChange) as
  // something to explain, not a bug — see the debug file's Evidence.
  const state = fixedState({ c: { sub: "Thief", wp: 21 } });
  const events = springTrap(state, fakeRng([20, 8, 5]), []);
  const sprung = events.find((e) => e.type === "trapSprung");
  assert.equal(sprung.dmg, 25, "sanity: 5 * the Spike trap's 5x multiplier");
  assert.equal(state.c.wp, 0, "die() clamps c.wp to exactly 0, never negative");
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died"));
});

// ── (2) planBeat's last hero-hp frame — re-pinned this session ────────────

test("RULES-06 (Phase 75 re-verification): planBeat's last hero-hp frame still equals the real final hp for a multi-swing fold — the 2026-09-22 fix (src/browser/combatBeat.js) holds on master after Phases 73/74", () => {
  // CMBUI-10 (Phase 77): the fight log folds only back-to-back IDENTICAL
  // lines now (the per-foe "hits you K of M" group is gone), so the fold
  // this pin guards is two identical swings reading "Ogre hits you (8) ×2".
  const foes = [
    { name: "Rat", alive: true, wp: 6, maxWP: 6, type: "Beasts" },
    { name: "Ogre", alive: true, wp: 20, maxWP: 20, type: "Beasts" },
  ];
  const before = fixedState({ combat: fixedCombat(foes, { round: 4 }), c: { wp: 55 } });
  const events = [
    { type: "struck", target: "Rat", dmg: 5 },
    { type: "foeKilled", name: "Rat", spGained: 1 },
    { type: "struckByFoe", name: "Ogre", dmg: 8 },
    { type: "struckByFoe", name: "Ogre", dmg: 8 },
  ];
  const ctx = {};

  const lines = fightLogLinesFor("attack", events, ctx);
  const ogreLines = lines.filter((l) => l.text.includes("Ogre"));
  assert.equal(ogreLines.length, 1, "sanity: the Ogre exchange must fold to one fight-log line");
  assert.equal(ogreLines[0].text, "Ogre hits you (8) ×2", "sanity: the fold's TEXT names both swings");

  const after = fixedState({ c: { wp: 55 - 16 }, combat: null }); // true final: 39
  const plan = planBeat({ actionType: "attack", events, before, after, beforeLog: null, ctx });
  assert.ok(plan);
  assert.equal(plan.ending, true);
  assert.equal(
    plan.heroHp[plan.heroHp.length - 1],
    39,
    "the LAST frame — the one on screen the instant before the over-panel/settle takes over — must equal the real final hp, never an under-count from only the fold's first constituent event (55-8=47)"
  );
});

// ── (3) Phase 75 finding: the intermediate (non-last) frame of a multi-swing ───
// fold still under-counts (blind spot 1, named-but-unfixed by the
// 2026-09-22 session) — pinned here as a KNOWN, CONFIRMED, NON-FATAL fact:
// this transient frame is never the one on screen at an actionable moment
// (combat-beat-shell.test.js's own test (4) already proves the action
// buttons stay disarmed for the WHOLE beat), so it cannot itself explain a
// death. Not a case left pending for a future fix — nothing here needs to change; this is
// a passing pin of a already-understood, already-bounded limitation.

test("RULES-06 (Phase 75 finding): an intermediate (not-last) multi-swing fold frame still under-counts — the true value returns on the very next line, and the ROUND's own last frame is always correct regardless", () => {
  const foes = [
    { name: "Rat", alive: true, wp: 6, maxWP: 6, type: "Beasts" },
    { name: "Ogre", alive: true, wp: 20, maxWP: 20, type: "Beasts" },
  ];
  const before = fixedState({ combat: fixedCombat(foes, { round: 4 }), c: { wp: 55 } });
  // The Ogre fold is deliberately NOT the round's last line — Rat's own
  // single hit follows it, so the fold's transient under-count is genuinely
  // on screen for one beat-gap, not masked by the last-frame pin.
  // CMBUI-10 (Phase 77): the fold is now the event order's adjacent-identical
  // " ×2" (two identical 8s) — the only multi-swing line left; two different
  // swings are two lines, each with its own exact frame.
  const events = [
    { type: "struck", target: "Rat", dmg: 5 },
    { type: "struckByFoe", name: "Ogre", dmg: 8 },
    { type: "struckByFoe", name: "Ogre", dmg: 8 },
    { type: "struckByFoe", name: "Rat", dmg: 2 },
  ];
  const after = fixedState({ c: { wp: 55 - 16 - 2 }, combat: fixedCombat([{ ...foes[0], wp: 1 }, foes[1]], { round: 5 }) });
  const plan = planBeat({ actionType: "attack", events, before, after, beforeLog: null, ctx: {} });
  assert.ok(plan);
  assert.equal(plan.count, 3, "sanity: three fight-log lines (hero's own hit, the Ogre fold, Rat's own hit)");

  // Frame 1 (the Ogre fold, index 1, NOT the last index 2): still reads the
  // fold's first-constituent-only under-count (55-8=47), not the true
  // running total at that point (55-16=39) — this is blind spot 1, still
  // present, and this test documents (not fixes) it.
  assert.equal(plan.heroHp[1], 47, "blind spot 1: the fold's own frame is STILL an under-count (documented, not fixed by this plan)");

  // Frame 2 (the LAST line, Rat's own single hit) is always correct — the
  // 2026-09-22 fix pins the LAST entry to after.c.wp regardless of any
  // upstream fold's own math.
  assert.equal(plan.heroHp[2], 37, "the round's own last frame is always correct: 55-16-2=37");

  // The player can never act while any of this is on screen: every offset
  // before the round's last one falls strictly inside the beat's own timed
  // window (beatOffsets/beatEndMs), during which the shell's own encArmed()
  // gate stays false for the whole beat (test/unit/combat-beat-shell.test.js
  // test (4)) — so frame 1's transient overstatement is never the number a
  // player can act on.
  const offsets = beatOffsets(plan.texts, () => 0);
  const endMs = beatEndMs(plan.texts, () => 0);
  assert.ok(offsets[1] < endMs, "the fold's own offset must fall strictly before the beat's own end — it is never the settled, actionable frame");
});

// ── (4)/(5) Phase 75, plan 75-08 — Task 1's own boundary cases ────────────
// (a hero with dmg + 1 hp survives a trap of dmg with exactly 1 hp; a hero
// with exactly dmg hp dies, cause "trap", and the trapSprung line prints
// dmg). Same fakeRng/fixedState technique as case (1) above — dodge roll 20
// mirrors to roll 1 (rollCheck's roll-high mirror, engine/dice.js: `roll =
// dieN + 1 - r`), always a miss; trap-kind roll 2 always picks the SAME
// "Falling Rocks" (d20, no `times` multiplier, no Hardiness/Cat Burglar on
// this fixedFighter) trap case (1) already uses, so the final damage roll
// alone sets `dmg` (no scaleHazard surprise at this depth/identity-dials
// setting — case (1)/(2) already establish that).

test("RULES-06 boundary (Phase 75, plan 75-08): a hero at dmg+1 hp survives a trap of dmg with exactly 1 hp left", () => {
  const state = fixedState({ c: { sub: "Thief", wp: 6 } }); // dmg (5) + 1
  const events = springTrap(state, fakeRng([20, 2, 5]), []);
  const sprung = events.find((e) => e.type === "trapSprung");
  assert.equal(sprung.dmg, 5, "sanity: this scripted roll must reproduce a dmg-5 trap");
  assert.equal(state.c.wp, 1, "a hero at dmg+1 hp must survive with exactly 1 hp left");
  assert.equal(state.dead, false);
});

test("RULES-06 boundary (Phase 75, plan 75-08): a hero at exactly dmg hp dies, cause \"trap\", and the trapSprung line prints dmg", () => {
  const state = fixedState({ c: { sub: "Thief", wp: 5 } }); // exactly dmg (5)
  const events = springTrap(state, fakeRng([20, 2, 5]), []);
  const sprung = events.find((e) => e.type === "trapSprung");
  assert.equal(sprung.dmg, 5, "sanity: this scripted roll must reproduce the SAME dmg-5 trap as the survive case above");
  assert.equal(state.c.wp, 0, "a hero at exactly dmg hp must be reduced to exactly 0, never negative");
  assert.equal(state.dead, true);
  const died = events.find((e) => e.type === "died");
  assert.ok(died, "sanity: a lethal trap must push a died event");
  assert.equal(died.cause, "trap", "the death's own cause must be \"trap\", not a generic/unnamed cause");
  const line = EVENT_NARRATION.trapSprung(sprung);
  assert.match(line, /−5 hp/, "the trapSprung line must still print the SAME dmg (5), even on the killing blow");
});

// ── (6) Phase 75, plan 75-08, Task 2 — the engine-scale standing guard ────
//
// Promotes 75-01's own ad hoc scratchpad reproduction (500 seeds / ~197k
// actions, run once by hand, `75-01-trap-death-repro.mjs`, never committed —
// see .planning/debug/trap-death-21hp-oracle-minus1.md's "### Phase 75
// session") into a permanent, committed guard, bounded to a small seed set
// so it runs in well under this plan's own 60s budget (this plan's own
// <flagged_assumptions>: "The engine guard's seed sweep is sized to run in
// under 60 seconds inside npm test. The full 500-seed reproduction stays a
// scratch tool, as in 75-01."). Drives the REAL engine (`applyAction`,
// never a hand-built event) through the tuning bot's own decideAction
// policy, from `newRun(seed, [], { startDepth: 2 })`, exactly as 75-01's
// own reproduction did.

const SWEEP_SEEDS = 45;
const SWEEP_MAX_ACTIONS = 300;
const SWEEP_START_DEPTH = 2;

/**
 * LOSS_FIELDS — every engine site that both mutates the HERO's own `c.wp`
 * DOWNWARD AND narrates the amount removed on a matching numeric event
 * field (a full `grep -n "c\.wp -="` sweep of every engine/*.js site, this
 * plan, cross-checked by direct code read against each site's own event
 * push). Every one of these sites subtracts its narrated amount directly —
 * unlike a GAIN (see GAIN_TYPES below), a hero's hp loss is never silently
 * clamped away below the narrated figure (the ONE clamp on the loss side,
 * death.js#die()'s floor-at-0 on a lethal blow, is handled separately
 * below, not folded into this map) — so `narratedHeroLossDelta` can sum
 * these fields and expect EXACT agreement with the real hp drop.
 */
const LOSS_FIELDS = {
  trapSprung: "dmg", // engine/encounters.js#springTrap
  struckByFoe: "dmg", // engine/combat.js — a foe's landed blow on the hero
  foeBolted: "dmg", // engine/combat.js/foeAbilities.js — a foe-ability bolt (excluded below when `member`-tagged: that shape targets a party member, not the hero)
  trappedPanic: "loss", // engine/movement.js — the >=1hp clamp is baked INTO this field's own value before it is narrated
  afflictionTick: "loss", // engine/movement.js — same >=1hp pre-narration clamp
  afflictionCaught: "first", // engine/encounters.js#catchAffliction's first tick
  fellClimbing: "hurt", // engine/movement.js
  fellInGorge: "hurt", // engine/movement.js
  insanitySelfHarm: "loss", // engine/encounters.js#goInsane
  backfireSelfDamage: "amount", // engine/magic.js — an Apprentice's 1-in-8 mishap
  summonBackfired: "amount", // engine/magic.js — a doubled Summoner's 1-in-8 mishap
  earthquakeSelfDamage: "amount", // engine/magic.js — Earthquake's unwarded self-hit
  deathCast: "cost", // engine/magic.js — the Death spell's own fixed fee
  wentHungry: "cost", // engine/movement.js — an unfed night's upkeep
};
// GAIN_TYPES — every event type that narrates a HERO wp GAIN. Phase 79
// (plan 79-02, VOX-05, todo 2026-09-25): each now carries an additive
// `gained` — the HP actually added after the clamp to max (0 at full) — so
// the sweep SUMS them instead of skipping the action (75-08 skipped them
// because most of these narrated the raw pre-clamp roll). `bought` joins
// the set for a store meal (its `gained` rides on the purchase event; any
// other purchase has none and adds 0). A `memberSecondWind` heals a party
// member, never the hero, so it is neutral here (like a member-tagged
// foeBolted). tableFour is summed separately by `stat` and `amount` (see
// heroTableFourDelta below).
const GAIN_TYPES = new Set([
  "healed", "secondWindHealed", "foodFound", "faerieBoon", "floorRegen",
  "cloakRegenerated", "potionDrunk", "rested", "cooked", "regenerated",
  "leveled", // a level-up's own HP raise also raises c.wp (`gained` = wpGain)
  "bought", // a store meal's `gained` (Phase 79); any other purchase adds 0
]);

/** heroTableFourDelta(e) — a Table 4 row's signed change to the hero's
 * CURRENT hp: `amount` for an "hp" row (a clamped heal or a toll) and for a
 * "maxHp" row (which raises current hp by the same step); 0 for an "xp" or
 * "armor" row. Phase 79 (plan 79-02, todo 2026-09-26). */
function heroTableFourDelta(e) {
  if (e.stat === "hp" || e.stat === "maxHp") return typeof e.amount === "number" ? e.amount : NaN;
  return 0;
}
// NEUTRAL_TYPES — every OTHER event type this plan's own calibration runs
// actually observed co-occurring with an hp-changing action, confirmed by
// direct code read to never itself touch the HERO's own `c.wp` (a foe's own
// wp, a party member's own wp, a roll/selection/narration-only event, or a
// non-wp resource such as gold/rations). A type in neither this set nor the
// two above is UNCLASSIFIED, per `narratedHeroLossDelta` below.
const NEUTRAL_TYPES = new Set([
  "frenzy", "strikeMissed", "combatJoined", "moved", "encounterRolled",
  "dayBegan", "rationsEaten", "trapPoisoned", "afflictionCured", "spGained",
  "floorChanged", "foeMissed", "struck", "foeKilled", "goldGained",
  "draggedOver", "foeArmorSoaked", "dirtyTrickLanded", "backstab",
  "trapDoubled", "wanderingMonster", "encounterStarted", "waterFear",
  "afflictionRolled", "afflictionPassed", "phobiaTriggered", "heightsFear",
  "phobiaAfraid", "combatInDark", "mirrorSelf", "allyMissed", "allyStruck",
  "mirrorFaded", "memberSwept", "memberStruck", "braced", "allyDeparted",
  "braceHeld", "spellChargeRecovered", "spellMissed", "heroResistFailed",
  "faerieMet", "foeRevived", "armorSoaked", "armorDestroyed", "itemCooled",
  "riposteReady", "fleeRolled", "fleeFailed", "afflictionLingers",
  "battleRoarRaised", "swept", "sweptFoe", "died", "chestLockRolled",
  "scrollFound", "findOffered", "allyJoined", "spellHit",
  "frozenSolid", "fearPassed", "poisonedEdgeApplied", "dotTick",
  "foeSightReturned", "lootDropped", "parleyRolled", "parleyFailed",
  "parleyInsulted", "spellBackfired", "pommelStruck", "allyCast",
  "allySpellHit", "foeSlept", "foeDebuffed", "trapAvoided",
  "abilityLearned", "foeFled", "encounterCleared", "insanityRolled",
  "armorPatched", "foeStunned", "leaptOver", "conArtistOpener",
  "trapDisarmed", "chestOpened", "wardRaised", "regenerationCast",
  "memberSecondWind", // Phase 79: heals a party member, never the hero
]);

/**
 * narratedHeroLossDelta(events) — sums LOSS_FIELDS across `events`,
 * restricted to the HERO's own wp (a `foeBolted` event carrying a `member`
 * field targets a PARTY MEMBER, not the hero, and is excluded). Returns
 * `{ loss, gain, hasGain, unclassified }`: `loss` is the positive sum of
 * every confirmed hero hp-loss field; `gain` is the summed hero `gained`
 * (Phase 79) plus every Table 4 row's signed hero-hp `amount` (a toll is a
 * negative amount, so it lowers `gain`); `hasGain` is true when a
 * GAIN_TYPES or hp-moving tableFour event is present (these actions are now
 * CHECKED, tallied as gain-bearing); `unclassified` is true when any event's
 * type is outside every set above (LOSS_FIELDS ∪ GAIN_TYPES ∪
 * NEUTRAL_TYPES ∪ tableFour), meaning this action's total cannot be safely
 * checked.
 */
function narratedHeroLossDelta(events) {
  let loss = 0;
  let gain = 0;
  let hasGain = false;
  let unclassified = false;
  for (const e of events) {
    if (!e || typeof e.type !== "string") continue;
    if (e.type === "foeBolted" && e.member) continue; // targets a party member, not the hero
    if (Object.prototype.hasOwnProperty.call(LOSS_FIELDS, e.type)) {
      const v = e[LOSS_FIELDS[e.type]];
      if (typeof v === "number" && Number.isFinite(v)) loss += v;
      continue;
    }
    if (GAIN_TYPES.has(e.type)) {
      if (e.type === "bought" && !Object.prototype.hasOwnProperty.call(e, "gained")) continue; // a non-meal purchase moves no hp
      hasGain = true;
      if (typeof e.gained === "number" && Number.isFinite(e.gained)) gain += e.gained;
      else unclassified = true; // a gain event without its honest field cannot be checked
      continue;
    }
    if (e.type === "tableFour") {
      const d = heroTableFourDelta(e);
      if (!Number.isFinite(d)) unclassified = true;
      else if (e.stat === "hp" || e.stat === "maxHp") {
        hasGain = true;
        gain += d;
      }
      continue;
    }
    if (!NEUTRAL_TYPES.has(e.type)) unclassified = true;
  }
  return { loss, gain, hasGain, unclassified };
}

test("RULES-06 (Phase 75 standing guard, plan 75-08; gains added Phase 79 plan 79-02): an engine-scale sweep — every trapSprung's dmg equals the hp it removed, a trap death only happens at or under that dmg, and every checkable action's narrated gains minus losses match its real hp change", () => {
  const t0 = Date.now();
  let trapSprungCount = 0;
  let checkedActions = 0;
  let checkedGainActions = 0;
  let skippedActions = 0;

  for (let seed = 1; seed <= SWEEP_SEEDS; seed++) {
    // The SAME newRun call playRun makes internally (RUN_FLAGS, no force) —
    // pure/deterministic, so this read of the hero's OWN starting hp (before
    // policyRng ever advances) matches playRun's own first action's before-
    // state exactly.
    let hpBefore = newRun(seed, [], { startDepth: SWEEP_START_DEPTH, ...RUN_FLAGS }).c.wp;

    playRun(seed, { startDepth: SWEEP_START_DEPTH, maxActions: SWEEP_MAX_ACTIONS }, (events, state) => {
      const hpAfter = state.c.wp;
      const actualDelta = hpAfter - hpBefore;
      const { loss, gain, hasGain, unclassified } = narratedHeroLossDelta(events);

      for (const e of events) {
        if (e.type !== "trapSprung") continue;
        trapSprungCount++;
        // A trapSprung is ALWAYS the event that fires die("trap") on lethal
        // (engine/encounters.js#springTrap). When it is the ONLY hp-loss
        // event this action (no co-occurring hazard, no gain, nothing
        // unclassified), the hero's hp must drop by EXACTLY its own dmg
        // (clamped at 0, never negative), and a death this action must
        // only happen when hpBefore was at most dmg.
        if (!unclassified && !hasGain && loss === e.dmg) {
          assert.equal(hpAfter, Math.max(0, hpBefore - e.dmg), `seed ${seed}: trapSprung dmg ${e.dmg} must remove exactly that much hp from ${hpBefore} (got ${hpAfter})`);
          if (hpAfter <= 0) {
            assert.ok(hpBefore <= e.dmg, `seed ${seed}: a trap death must only happen when hp-before (${hpBefore}) was at most its dmg (${e.dmg})`);
          }
        }
      }

      if (unclassified) {
        skippedActions++;
      } else if (loss > 0 || hasGain || actualDelta !== 0) {
        checkedActions++;
        if (hasGain) checkedGainActions++;
        const narrated = gain - loss;
        if (state.dead) {
          // death.js#die() clamps c.wp to exactly 0 regardless of overkill —
          // an overkill blow's narrated loss legitimately reads LARGER than
          // the clamped actual change (75-01's own (ii) count, "explained,
          // not a bug"); assert the clamp landed and the narrated net change
          // was at least enough to be lethal, not a strict equality.
          assert.equal(hpAfter, 0, `seed ${seed}: a dead hero's c.wp must clamp to exactly 0`);
          assert.ok(hpBefore + narrated <= 0, `seed ${seed}: a lethal action's narrated net (${narrated}) must be sufficient to explain the death from ${hpBefore} hp`);
        } else {
          assert.equal(actualDelta, narrated, `seed ${seed}: the hp change (${actualDelta}) must equal the narrated gains minus losses (+${gain} −${loss})`);
        }
      }

      hpBefore = hpAfter;
    });
  }

  assert.ok(trapSprungCount >= 20, `sweep must observe at least 20 trapSprung events to be non-vacuous — saw ${trapSprungCount}`);
  assert.ok(checkedActions > 0, "sweep must actually check at least one action's hp accounting, not skip everything");
  // Phase 79 (plan 79-02): the gain half is live, not vacuous.
  assert.ok(checkedGainActions >= 20, `sweep must check at least 20 gain-bearing actions — checked ${checkedGainActions}`);
  console.log(`# trap-death sweep: ${checkedActions} actions checked (${checkedGainActions} gain-bearing), ${skippedActions} skipped, ${trapSprungCount} traps, ${Date.now() - t0}ms`);
  assert.ok(skippedActions >= 0, "sanity: skippedActions is a non-negative tally");
  assert.ok(Date.now() - t0 < 60000, `sweep must stay under this plan's own 60s budget — took ${Date.now() - t0}ms`);
});
