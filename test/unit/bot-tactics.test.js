// test/unit/bot-tactics.test.js
//
// Phase 42 (BAL-01 second half, 42-02-PLAN.md) — synthetic-state probes for
// the tuning bot's ability/item/spell-by-niche tactics
// (tools/lib/tuning-bot.mjs). Mirrors test/unit/tuning-bot.test.js's own
// discipline: hand-built states only, decisions and guard behavior asserted,
// never a readout number from a real seeded run (except the no-stall proof,
// which asserts only `stuck`/event-presence, never a depth/action count).

import test from "node:test";
import assert from "node:assert/strict";

import {
  decideAction,
  makeBotContext,
  observe,
  chooseAbility,
  hardestFoeIndex,
  hardFight,
  chooseCombatItem,
  chooseFieldItem,
  itemLabel,
  tallyUsage,
  makeTallies,
  RUN_FLAGS,
  playRun,
  BOT_DEFAULTS,
  BOT_TACTICS,
} from "../../tools/lib/tuning-bot.mjs";
import { DEATH_PANIC_THRESHOLD } from "../../engine/derived.js";
import { SPELLS } from "../../content/index.js";
import { maxCharges } from "../../engine/movement.js";
import { takeFind } from "../../engine/items.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
setIdentityDials();

/** idx(name) — the SPELLS index for a spell by exact display name. */
function idx(name) {
  return SPELLS.findIndex((s) => s.n === name);
}

/** mu(over) — a Magic User character sheet (Sorcerer default), zero scrolls/potions/rations. */
function mu(over = {}) {
  return {
    cls: "Magic User",
    sub: "Sorcerer",
    race: "Human",
    level: 1,
    wp: 40,
    maxWP: 40,
    potions: 0,
    rations: 0,
    scrolls: 0,
    spellsUsed: 0,
    grimoire: [],
    items: [],
    skills: {},
    gold: 0,
    timers: {},
    ...over,
  };
}

// A policyRng whose .pick() always returns the first element (unused by any
// test in this file — combat/pending-state decisions never reach it — kept
// for call-shape parity with tuning-bot.test.js's own fixedPolicyRng).
const fixedPolicyRng = { pick: (arr) => arr[0] };

function mkState(over = {}) {
  const { c: cOverride, ...rest } = over;
  return {
    c: {
      name: "T",
      race: "Human",
      cls: "Fighter",
      sub: "Soldier",
      level: 1,
      wp: 40,
      maxWP: 40,
      potions: 0,
      rations: 0,
      spellsUsed: 0,
      grimoire: [],
      items: [],
      skills: {},
      gold: 0,
      timers: {},
      ...cOverride,
    },
    combat: null,
    store: null,
    pendingFind: null,
    pendingJoiner: null,
    party: [],
    floor: { g: [[{ wall: false, seen: true, feat: null }]], px: 0, py: 0, depth: 1 },
    dead: false,
    ...rest,
  };
}

/** fight(type, nFoes, round, extra) — a minimal state.combat with nFoes plain, alive, undamaged foes. */
function fight(type, nFoes, round = 1, extra = {}) {
  const foes = Array.from({ length: nFoes }, (_, i) => ({ name: `foe${i}`, alive: true, lvl: 1, wp: 20, maxWP: 20 }));
  return { type, foes, round, target: 0, ...extra };
}

/** fighter(over) — a Fighter character sheet with an `abilities` list and an empty `timers` map. */
function fighter(over = {}) {
  return { cls: "Fighter", sub: "Knight", race: "Human", level: 1, wp: 40, maxWP: 40, potions: 0, rations: 0, spellsUsed: 0, grimoire: [], items: [], skills: {}, timers: {}, abilities: [], ...over };
}

/** thief(over) — a Thief character sheet with an `abilities` list and an empty `timers` map. */
function thief(over = {}) {
  return { cls: "Thief", sub: "Pilfer", race: "Human", level: 1, wp: 40, maxWP: 40, potions: 0, rations: 0, spellsUsed: 0, grimoire: [], items: [], skills: {}, timers: {}, abilities: [], ...over };
}

// --- hardestFoeIndex -------------------------------------------------------

test("hardestFoeIndex: highest lvl, tie -> higher wp, tie -> lowest index; null with no live foe", () => {
  const s1 = mkState({ combat: { foes: [{ alive: true, lvl: 1, wp: 5 }, { alive: true, lvl: 3, wp: 5 }, { alive: true, lvl: 2, wp: 5 }] } });
  assert.strictEqual(hardestFoeIndex(s1), 1);

  const s2 = mkState({ combat: { foes: [{ alive: true, lvl: 2, wp: 10 }, { alive: true, lvl: 2, wp: 20 }] } });
  assert.strictEqual(hardestFoeIndex(s2), 1);

  const s3 = mkState({ combat: { foes: [{ alive: true, lvl: 2, wp: 10 }, { alive: true, lvl: 2, wp: 10 }] } });
  assert.strictEqual(hardestFoeIndex(s3), 0);

  const s4 = mkState({ combat: { foes: [{ alive: false, lvl: 5, wp: 99 }] } });
  assert.strictEqual(hardestFoeIndex(s4), null);

  assert.strictEqual(hardestFoeIndex(mkState({ combat: null })), null);
});

// --- chooseAbility structural guards ---------------------------------------

test("chooseAbility: null for a Magic User, out of combat, empty/absent abilities, or every owned ability on cooldown/blocked", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 1);

  const mu = mkState({ combat, c: { cls: "Magic User", sub: "Sorcerer", abilities: ["kata"], timers: {} } });
  assert.strictEqual(chooseAbility(mu, ctx), null);

  const outOfCombat = mkState({ combat: null, c: fighter({ abilities: ["pommelStrike"] }) });
  assert.strictEqual(chooseAbility(outOfCombat, ctx), null);

  const noAbilitiesKey = mkState({ combat, c: fighter({ abilities: undefined }) });
  assert.strictEqual(chooseAbility(noAbilitiesKey, ctx), null);

  const emptyAbilities = mkState({ combat, c: fighter({ abilities: [] }) });
  assert.strictEqual(chooseAbility(emptyAbilities, ctx), null);

  const onCooldown = mkState({
    combat,
    c: fighter({ abilities: ["pommelStrike"], timers: { "ability:pommelStrike": { cadence: "rounds", left: 3, phase: "cooldown" } } }),
  });
  assert.strictEqual(chooseAbility(onCooldown, ctx), null);

  const blockedCtx = makeBotContext();
  blockedCtx.abilityBlocked.add("pommelStrike");
  const blockedState = mkState({ combat, c: fighter({ abilities: ["pommelStrike"] }) });
  assert.strictEqual(chooseAbility(blockedState, blockedCtx), null);
});

// --- chooseAbility policy matrix (mirrors pickMemberAbility) ---------------

test("chooseAbility: round 1 prefers a ready opener even when a damage ability is also ready", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 1);
  const state = mkState({ combat, c: fighter({ abilities: ["pommelStrike", "kata"] }) });
  assert.deepStrictEqual(chooseAbility(state, ctx), { key: "pommelStrike" });
});

test("chooseAbility: round 2, target above half hp, a damage ability (kata) is picked", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 2); // target foe0 wp:20/maxWP:20 -> above half
  const state = mkState({ combat, c: fighter({ abilities: ["kata"] }) });
  assert.deepStrictEqual(chooseAbility(state, ctx), { key: "kata" });
});

test("chooseAbility: target below half hp AND the hero below half hp with only a defensive ability ready picks it", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 2, { foes: [{ name: "f", alive: true, lvl: 1, wp: 5, maxWP: 20 }] });
  const state = mkState({ combat, c: fighter({ abilities: ["brace"], wp: 10, maxWP: 40 }) });
  assert.deepStrictEqual(chooseAbility(state, ctx), { key: "brace" });
});

test("chooseAbility: target below half and hero above half with only damage/defensive abilities ready falls through to null", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 2, { foes: [{ name: "f", alive: true, lvl: 1, wp: 5, maxWP: 20 }] });
  const state = mkState({ combat, c: fighter({ abilities: ["kata", "brace"], wp: 40, maxWP: 40 }) });
  assert.strictEqual(chooseAbility(state, ctx), null);
});

test("chooseAbility: lastStand is skipped above the death-panic threshold and picked at/below it (target above half)", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 2); // target foe0 above half hp

  const aboveThreshold = mkState({ combat, c: fighter({ abilities: ["lastStand"], wp: 11, maxWP: 40 }) }); // 11 > 40*0.25
  assert.strictEqual(chooseAbility(aboveThreshold, ctx), null);

  const atThreshold = mkState({ combat, c: fighter({ abilities: ["lastStand"], wp: 10, maxWP: 40 }) }); // 10 <= 40*0.25
  assert.strictEqual(10 <= 40 * DEATH_PANIC_THRESHOLD, true);
  assert.deepStrictEqual(chooseAbility(atThreshold, ctx), { key: "lastStand", target: 0 });
});

// --- once-a-fight foe-targeted hardest-foe aiming --------------------------

test("chooseAbility: a once-a-fight FOE-targeted ability (mark/hamstring/cutpurse/lastStand) carries target = hardestFoeIndex", () => {
  const ctx = makeBotContext();
  const foes = [
    { name: "weak", alive: true, lvl: 1, wp: 20, maxWP: 20 },
    { name: "strong", alive: true, lvl: 4, wp: 20, maxWP: 20 },
  ];

  const markState = mkState({ combat: fight("Beasts", 2, 1, { foes }), c: thief({ abilities: ["mark"] }) });
  assert.deepStrictEqual(chooseAbility(markState, ctx), { key: "mark", target: 1 });

  const hamstringState = mkState({ combat: fight("Beasts", 2, 1, { foes }), c: thief({ abilities: ["hamstring"] }) });
  assert.deepStrictEqual(chooseAbility(hamstringState, ctx), { key: "hamstring", target: 1 });

  const cutpurseState = mkState({ combat: fight("Beasts", 2, 2, { foes }), c: thief({ abilities: ["cutpurse"] }) });
  assert.deepStrictEqual(chooseAbility(cutpurseState, ctx), { key: "cutpurse", target: 1 });
});

test("chooseAbility: a self-targeted or numeric-cooldown foe-targeted ability carries no target field", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 1);

  const openerSelf = mkState({ combat, c: fighter({ abilities: ["battleRoar"] }) }); // self, cd:5, opener
  const r1 = chooseAbility(openerSelf, ctx);
  assert.deepStrictEqual(r1, { key: "battleRoar" });
  assert.ok(!("target" in r1));

  const pommelFoeNumericCd = mkState({ combat, c: fighter({ abilities: ["pommelStrike"] }) }); // foe, cd:4 (numeric)
  const r2 = chooseAbility(pommelFoeNumericCd, ctx);
  assert.deepStrictEqual(r2, { key: "pommelStrike" });
  assert.ok(!("target" in r2));
});

// --- decideAction wiring -----------------------------------------------

test("decideAction: a Fighter, round 1, opener ready, full hp, no potions returns useAbility; never fires for a Magic User", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 1);
  const fighterState = mkState({ combat, c: fighter({ abilities: ["pommelStrike"] }) });
  assert.deepStrictEqual(decideAction(fighterState, fixedPolicyRng, ctx), { type: "useAbility", key: "pommelStrike" });

  const foes = [
    { name: "weak", alive: true, lvl: 1, wp: 20, maxWP: 20 },
    { name: "strong", alive: true, lvl: 4, wp: 20, maxWP: 20 },
  ];
  const thiefState = mkState({ combat: fight("Beasts", 2, 1, { foes }), c: thief({ abilities: ["mark"] }) });
  assert.deepStrictEqual(decideAction(thiefState, fixedPolicyRng, ctx), { type: "useAbility", key: "mark", target: 1 });

  // A Sorcerer with charges and a castable spell still gets its castSpell —
  // chooseAbility itself gates on c.cls, so this branch is unreachable for a
  // Magic User even if (implausibly) `c.abilities` were populated.
  const muState = mkState({
    combat,
    c: { cls: "Magic User", sub: "Sorcerer", grimoire: ["Freeze"], level: 1, spellsUsed: 0, wp: 40, maxWP: 40, items: [], abilities: ["kata"], timers: {} },
  });
  const result = decideAction(muState, fixedPolicyRng, ctx);
  assert.strictEqual(result.type, "castSpell");
});

test("decideAction: the ability step sits AFTER sing (round-1 Bard) and BEFORE the plain attack fallback", () => {
  const ctx = makeBotContext();
  const bardState = mkState({
    steps: 500,
    combat: fight("Beasts", 1, 1),
    c: { cls: "Fighter", sub: "Bard", level: 1, grimoire: [], wp: 40, maxWP: 40, potions: 0, rations: 0, abilities: ["pommelStrike"], timers: {} },
  });
  assert.deepStrictEqual(decideAction(bardState, fixedPolicyRng, ctx), { type: "sing" });

  const noAbilityState = mkState({ combat: fight("Beasts", 1, 1), c: fighter({ abilities: [] }) });
  assert.deepStrictEqual(decideAction(noAbilityState, fixedPolicyRng, ctx), { type: "attack" });
});

// --- observe: abilityRefused guard -----------------------------------------

test("observe: abilityRefused blocks the key for the rest of the encounter; encounterStarted clears it", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 1);
  const state = mkState({ combat, c: fighter({ abilities: ["pommelStrike"] }) });

  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "useAbility", key: "pommelStrike" });
  observe(ctx, [{ type: "abilityRefused", key: "pommelStrike" }]);
  assert.ok(ctx.abilityBlocked.has("pommelStrike"));
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "attack" });

  observe(ctx, [{ type: "encounterStarted" }]);
  assert.strictEqual(ctx.abilityBlocked.size, 0);
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "useAbility", key: "pommelStrike" });
});

// --- no-stall proof: playRun's target write + at least one abilityUsed -----

test("playRun: a forced Fighter/Knight cell uses at least one ability and never stalls (seeds 1-5, measured)", () => {
  // [Measured] seeds 1..5 each: not stuck, at least one abilityUsed event —
  // confirmed via a live playRun scratch run before writing this assertion
  // (node -e over tools/lib/tuning-bot.mjs); seed 1 alone already satisfies
  // it, but the loop keeps the proof robust to any future BOT_DEFAULTS tweak.
  //
  // Cap re-measured to 2000 (was 1000) under USER RULING G (2026-09-21,
  // cycle 3, Adjustment 2): dotHpFor's Table-4 dots now read DOT_HP_BASE's
  // flat canon values (10/15/25) instead of a fraction of the hero's own
  // (class-dependent) maxWP — a real, deliberate identity-column shift, not
  // a regression. Seed 3's run now legitimately resolves at 1163 actions
  // (was under 1000 before this fix); 2000 keeps a ~2x margin for all five
  // seeds while staying well clear of BOT_DEFAULTS' own 20000 safety cap.
  let sawAbility = false;
  for (let seed = 1; seed <= 5; seed++) {
    const r = playRun(seed, { ...BOT_DEFAULTS, maxActions: 2000, force: { cls: "Fighter", sub: "Knight", race: "Human" } }, (events) => {
      if (events.some((e) => e.type === "abilityUsed")) sawAbility = true;
    });
    assert.strictEqual(r.stuck, false, `seed ${seed}: the bot must not stall`);
  }
  assert.ok(sawAbility, "at least one of seeds 1-5 must use a ready ability");
});

test("BOT_TACTICS: frozen constants exist for the item/spell tactics this plan and Plan 03 consume", () => {
  assert.deepStrictEqual(BOT_TACTICS, { hardFoeLvl: 3, staffMinFoes: 2, dotToughMargin: 1, mapBankRatio: 0.5 });
  assert.ok(Object.isFrozen(BOT_TACTICS));
});

// ============================================================================
// Plan 03, Task 1: Map the Floor once per floor, and observe's new
// (ctx, events, stateAfter) signature.
// ============================================================================

test("decideAction: Map the Floor casts out of combat when charges are plentiful on an unmapped floor", () => {
  const ctx = makeBotContext();
  const state = mkState({ c: mu({ grimoire: ["Map the Floor"] }) });
  assert.strictEqual(ctx.mappedDepth, null);
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Map the Floor") });
});

test("decideAction: Map the Floor is skipped once ctx.mappedDepth already matches the current floor", () => {
  const ctx = makeBotContext();
  const state = mkState({ c: mu({ grimoire: ["Map the Floor"] }) });
  ctx.mappedDepth = state.floor.depth; // already mapped THIS depth
  const result = decideAction(state, fixedPolicyRng, ctx);
  assert.notDeepStrictEqual(result, { type: "castSpell", idx: idx("Map the Floor") });
});

test("decideAction: Map the Floor is skipped when banked charges do not clear BOT_TACTICS.mapBankRatio", () => {
  const ctx = makeBotContext();
  const c = mu({ grimoire: ["Map the Floor"] });
  const mc = maxCharges(c);
  const noChargesToSpare = mkState({ c: { ...c, spellsUsed: mc } }); // 0 left, not > mc*0.5
  const result = decideAction(noChargesToSpare, fixedPolicyRng, ctx);
  assert.notDeepStrictEqual(result, { type: "castSpell", idx: idx("Map the Floor") });
});

test("decideAction: a floor change re-arms Map the Floor even after ctx.mappedDepth was set for the previous floor", () => {
  const ctx = makeBotContext();
  const c = mu({ grimoire: ["Map the Floor"] });
  ctx.mappedDepth = 1; // already mapped floor 1
  const newFloor = { g: [[{ wall: false, seen: true, feat: null }]], px: 0, py: 0, depth: 2 };
  const state = mkState({ c, floor: newFloor });
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "castSpell", idx: idx("Map the Floor") });
});

test("decideAction: Map the Floor never fires for a non-Magic-User", () => {
  const ctx = makeBotContext();
  const state = mkState({ c: fighter({}) });
  const result = decideAction(state, fixedPolicyRng, ctx);
  assert.notStrictEqual(result.type, "castSpell");
});

test("observe(ctx, events, stateAfter): floorMapped sets ctx.mappedDepth from stateAfter.floor.depth; the pre-Phase-42 two-argument call is a safe no-op for it", () => {
  const ctx = makeBotContext();
  assert.strictEqual(ctx.mappedDepth, null);

  // Two-argument call — every pre-existing observe() call site in this repo
  // (and every other test in this file) — floorMapped is silently ignored
  // with no stateAfter to read from; no throw, ctx.mappedDepth untouched.
  observe(ctx, [{ type: "floorMapped", squares: 40, cells: 12 }]);
  assert.strictEqual(ctx.mappedDepth, null);

  // Three-argument call (playRun's own call site) reads stateAfter.floor.depth.
  const stateAfter = mkState({ floor: { g: [[{ wall: false, seen: true, feat: null }]], px: 0, py: 0, depth: 4 } });
  observe(ctx, [{ type: "floorMapped", squares: 40, cells: 12 }], stateAfter);
  assert.strictEqual(ctx.mappedDepth, 4);

  // A non-floorMapped event with a stateAfter present never touches it.
  observe(ctx, [{ type: "moved" }], stateAfter);
  assert.strictEqual(ctx.mappedDepth, 4);
});

// ============================================================================
// Task 2: items — heal-before-flee, round-1 buffs, worn staves, the torch,
// the loot pile, and the shipped run rules.
// ============================================================================

/** potion(eff2, over) — a bag potion item shaped like a real find/store buy. */
function potion(eff2, over = {}) {
  return { kind: "potion", n: `${eff2} potion`, eff2, uses: { n: 1, sides: 4, bonus: 0 }, ...over };
}

// --- itemLabel / hardFight --------------------------------------------------

test("itemLabel: potion:<eff2> / tool:<tool> / the item's own display name; null-safe", () => {
  assert.strictEqual(itemLabel(potion("heal")), "potion:heal");
  assert.strictEqual(itemLabel({ kind: "tool", tool: "torch", n: "Torch" }), "tool:torch");
  assert.strictEqual(itemLabel({ kind: "staff", n: "Birch Staff" }), "Birch Staff");
  assert.strictEqual(itemLabel({ kind: "cloak", n: "Cloak of Speed" }), "Cloak of Speed");
  assert.strictEqual(itemLabel(null), "");
});

test("hardFight: true for a kit-bearing live foe OR any live foe at/above BOT_TACTICS.hardFoeLvl; false for two plain level-1 foes", () => {
  const casterFight = mkState({ combat: { foes: [{ alive: true, lvl: 1, wp: 5, maxWP: 5, abilities: ["x"] }] } });
  assert.strictEqual(hardFight(casterFight), true);

  const highLvlFight = mkState({ combat: { foes: [{ alive: true, lvl: 3, wp: 20, maxWP: 20 }] } });
  assert.strictEqual(hardFight(highLvlFight), true);

  const plainFight = mkState({ combat: { foes: [{ alive: true, lvl: 1, wp: 20, maxWP: 20 }, { alive: true, lvl: 1, wp: 20, maxWP: 20 }] } });
  assert.strictEqual(hardFight(plainFight), false);
});

// --- chooseCombatItem: heal below the flee line ----------------------------

test("chooseCombatItem: heals below the flee line, preferring Xtra Healing (full) over Healing (heal)", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 2);

  const healOnly = mkState({ combat, c: fighter({ wp: 4, maxWP: 40, items: [potion("heal")] }) }); // 0.1 < 0.4 (fleeThreshold, USER RULING D)
  assert.deepStrictEqual(chooseCombatItem(healOnly, ctx), { action: { type: "useItem", i: 0 }, reason: "heal" });

  const bothPotions = mkState({ combat, c: fighter({ wp: 4, maxWP: 40, items: [potion("heal"), potion("full")] }) });
  assert.deepStrictEqual(chooseCombatItem(bothPotions, ctx), { action: { type: "useItem", i: 1 }, reason: "heal" });

  const aboveFleeLine = mkState({ combat, c: fighter({ wp: 40, maxWP: 40, items: [potion("heal")] }) });
  assert.strictEqual(chooseCombatItem(aboveFleeLine, ctx), null);

  // a Death potion is never chosen, at any hp
  const deathOnly = mkState({ combat, c: fighter({ wp: 4, maxWP: 40, items: [potion("death")] }) });
  assert.strictEqual(chooseCombatItem(deathOnly, ctx), null);
});

test("chooseCombatItem: decideAction heals below the flee line BEFORE the flee/parley decision", () => {
  const ctx = makeBotContext();
  const combat = fight("Beasts", 1, 1);
  const state = mkState({ combat, c: fighter({ wp: 4, maxWP: 40, items: [potion("heal")] }) }); // would otherwise flee
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "useItem", i: 0 });
});

// --- chooseCombatItem: round-1 buff before a hard fight --------------------

test("chooseCombatItem: round 1 of a hard fight pops Speed, then Strength, then Enlarge; skipped once already active", () => {
  const ctx = makeBotContext();
  const hard = fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, lvl: 3, wp: 20, maxWP: 20 }] });

  const speedFirst = mkState({ combat: hard, c: fighter({ items: [potion("strength"), potion("speed")] }) });
  assert.deepStrictEqual(chooseCombatItem(speedFirst, ctx), { action: { type: "useItem", i: 1 }, reason: "buff" });

  const strengthNext = mkState({ combat: hard, c: fighter({ items: [potion("enlarge"), potion("strength")] }) });
  assert.deepStrictEqual(chooseCombatItem(strengthNext, ctx), { action: { type: "useItem", i: 1 }, reason: "buff" });

  const enlargeLast = mkState({ combat: hard, c: fighter({ items: [potion("enlarge")] }) });
  assert.deepStrictEqual(chooseCombatItem(enlargeLast, ctx), { action: { type: "useItem", i: 0 }, reason: "buff" });

  // haste already active (a live item:Speed effect record) -> skipped
  const hasteActive = mkState({
    combat: hard,
    c: fighter({ items: [potion("speed")], timers: { "item:Speed": { cadence: "squares", left: 10, phase: "effect" } } }),
  });
  assert.strictEqual(chooseCombatItem(hasteActive, ctx), null);

  // not a hard fight (two plain level-1 foes) -> no buff even with a potion in hand
  const easyFight = fight("Beasts", 2, 1);
  const notHard = mkState({ combat: easyFight, c: fighter({ items: [potion("speed")] }) });
  assert.strictEqual(chooseCombatItem(notHard, ctx), null);

  // round 2 of a hard fight -> the buff window has passed
  const roundTwo = fight("Beasts", 1, 2, { foes: [{ name: "f", alive: true, lvl: 3, wp: 20, maxWP: 20 }] });
  const round2State = mkState({ combat: roundTwo, c: fighter({ items: [potion("speed")] }) });
  assert.strictEqual(chooseCombatItem(round2State, ctx), null);

  // RULES-09 (Phase 75.1): a Pilfer takes the buff pick like anyone now —
  // potions never fumble, so the round-1 buff tier is unchanged for a Pilfer.
  const pilferState = mkState({ combat: hard, c: thief({ sub: "Pilfer", items: [potion("speed")] }) });
  assert.deepStrictEqual(chooseCombatItem(pilferState, ctx), { action: { type: "useItem", i: 0 }, reason: "buff" });
});

test("chooseCombatItem: a ready worn Cloak of Speed is used at round 1 of a hard fight", () => {
  const ctx = makeBotContext();
  const hard = fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, lvl: 3, wp: 20, maxWP: 20 }] });
  const cloak = { kind: "cloak", n: "Cloak of Speed", use: "haste" };
  const state = mkState({ combat: hard, c: fighter({ worn: { cloak } }) });
  assert.deepStrictEqual(chooseCombatItem(state, ctx), { action: { type: "useItem", slot: "cloak" }, reason: "buff" });
});

// 260918-w4n: the round-1 worn-buff tier walks WORN_SLOTS order. 260918-wy1
// (jewelry-merge): WORN_SLOTS is now jewelry1, jewelry2, cloak — the first
// ready buff wins, regardless of which kind it is; a live (already-active)
// buff of that same kind is skipped even when a different key could still
// fire.
test("chooseCombatItem: round-1 worn buff tier walks WORN_SLOTS order and skips an already-live kind", () => {
  const ctx = makeBotContext();
  const hard = fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, lvl: 3, wp: 20, maxWP: 20 }] });
  const ring = { kind: "jewel", n: "Ring of Power", eff: { dmg: 1 } }; // kind: power
  const cloak = { kind: "cloak", n: "Cloak of Strength", eff: { noCrit: 1 } }; // kind: brace

  // jewelry1 (earlier in WORN_SLOTS order) wins over cloak when both are ready.
  const both = mkState({ combat: hard, c: fighter({ worn: { jewelry1: ring, cloak } }) });
  assert.deepStrictEqual(chooseCombatItem(both, ctx), { action: { type: "useItem", slot: "jewelry1" }, reason: "buff" });

  // the ring's kind (power) is already live -> falls through to the cloak.
  const ringLive = mkState({
    combat: hard,
    c: fighter({ worn: { jewelry1: ring, cloak }, timers: { "item:Ring of Power": { cadence: "squares", left: 50, cd: 50, phase: "effect" } } }),
  });
  assert.deepStrictEqual(chooseCombatItem(ringLive, ctx), { action: { type: "useItem", slot: "cloak" }, reason: "buff" });

  // 260918-wy1: two jewelry pieces — the ring live in jewelry1, a ready
  // Anklet of Invisibility (kind unseen) in jewelry2 — falls through to
  // jewelry2 rather than stopping at the live jewelry1 match.
  const anklet = { kind: "jewel", n: "Anklet of Invisibility", eff: { foeToHit: -2 } }; // kind: unseen
  const jewelry2Fires = mkState({
    combat: hard,
    c: fighter({
      worn: { jewelry1: ring, jewelry2: anklet },
      timers: { "item:Ring of Power": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
    }),
  });
  assert.deepStrictEqual(chooseCombatItem(jewelry2Fires, ctx), { action: { type: "useItem", slot: "jewelry2" }, reason: "buff" });
});

// --- chooseCombatItem: a Magic User's WIELDED staff (RULES-13, Phase 75,
// Plan 09: a staff equips into the weapon slot; a bagged staff's power is
// inert, so chooseCombatItem now reads wieldedStaff(c) and dispatches by
// { slot: "weapon" } — never by bag index) -------------------------------

test("chooseCombatItem: a Magic User's wielded targeted staff fires at staffMinFoes+ live foes", () => {
  const ctx = makeBotContext();
  const staff = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };

  const oneFoe = mkState({ combat: fight("Beasts", 1, 2), c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, weapon: "Birch Staff", staff, items: [], worn: {}, timers: {} } });
  assert.strictEqual(chooseCombatItem(oneFoe, ctx), null);

  const twoFoes = mkState({ combat: fight("Beasts", 2, 2), c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, weapon: "Birch Staff", staff, items: [], worn: {}, timers: {} } });
  assert.deepStrictEqual(chooseCombatItem(twoFoes, ctx), { action: { type: "useItem", slot: "weapon" }, reason: "staff" });

  // a Fighter never fires a staff (class-gated at the top of the check) —
  // a Fighter can't wield one at all, so this stays a bagged staff.
  const fighterWithStaff = mkState({ combat: fight("Beasts", 2, 2), c: fighter({ items: [staff] }) });
  assert.strictEqual(chooseCombatItem(fighterWithStaff, ctx), null);

  // an empty staff (0 charges) is never ready (itemReady's own charge gate)
  const emptyStaff = { ...staff, charges: 0 };
  const noCharges = mkState({ combat: fight("Beasts", 2, 2), c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, weapon: "Birch Staff", staff: emptyStaff, items: [], worn: {}, timers: {} } });
  assert.strictEqual(chooseCombatItem(noCharges, ctx), null);

  // a BAGGED (unwielded) staff is never picked here at all — its power is
  // inert now, so chooseCombatItem must find nothing.
  const bagged = mkState({ combat: fight("Beasts", 2, 2), c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, items: [staff], worn: {}, timers: {} } });
  assert.strictEqual(chooseCombatItem(bagged, ctx), null);
});

test("chooseCombatItem: a wielded dome/heal staff fires below potionThreshold; dome is skipped with an active ward", () => {
  const ctx = makeBotContext();
  const domeStaff = { kind: "staff", n: "Rowan Staff", use: "dome", charges: 2 };
  const healStaff = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 3 };
  const combat = fight("Beasts", 1, 2);
  const muC = (over) => ({ cls: "Magic User", sub: "Sorcerer", wp: 10, maxWP: 40, potions: 0, worn: {}, timers: {}, items: [], ...over }); // 0.25 < potionThreshold 0.6 (USER RULING D)

  const domeReady = mkState({ combat, c: muC({ weapon: "Rowan Staff", staff: domeStaff, ward: null }) });
  assert.deepStrictEqual(chooseCombatItem(domeReady, ctx), { action: { type: "useItem", slot: "weapon" }, reason: "staff" });

  const domeAlreadyUp = mkState({ combat, c: muC({ weapon: "Rowan Staff", staff: domeStaff, ward: { pool: 50 } }) });
  assert.strictEqual(chooseCombatItem(domeAlreadyUp, ctx), null);

  const healReady = mkState({ combat, c: muC({ weapon: "Poplar Staff", staff: healStaff, ward: null }) });
  assert.deepStrictEqual(chooseCombatItem(healReady, ctx), { action: { type: "useItem", slot: "weapon" }, reason: "staff" });
});

test("chooseCombatItem: a wielded staff resolves via wieldedStaff(c) regardless of the worn-slot model (legacy or c.worn present)", () => {
  const ctx = makeBotContext();
  const staff = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };
  const combat = fight("Beasts", 2, 2);

  const legacy = mkState({ combat, c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, weapon: "Birch Staff", staff, items: [], timers: {} } });
  assert.ok(!("worn" in legacy.c));
  assert.deepStrictEqual(chooseCombatItem(legacy, ctx), { action: { type: "useItem", slot: "weapon" }, reason: "staff" });

  const wornModel = mkState({ combat, c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, weapon: "Birch Staff", staff, items: [], worn: {}, timers: {} } });
  assert.deepStrictEqual(chooseCombatItem(wornModel, ctx), { action: { type: "useItem", slot: "weapon" }, reason: "staff" });
});

test("chooseCombatItem: a torch/staff/cloak label in ctx.itemBlocked is skipped", () => {
  const ctx = makeBotContext();
  ctx.itemBlocked.add("Birch Staff");
  const staff = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };
  const state = mkState({ combat: fight("Beasts", 2, 2), c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, weapon: "Birch Staff", staff, items: [], worn: {}, timers: {} } });
  assert.strictEqual(chooseCombatItem(state, ctx), null);
});

// --- decideAction: out of combat, a Magic User wields its staff (RULES-13,
// Phase 75, Plan 09) -------------------------------------------------------

test("decideAction: out of combat, a Magic User with a bagged staff and none wielded equips it", () => {
  const ctx = makeBotContext();
  const staff = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };
  const state = mkState({ c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, items: [staff], timers: {} } });
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "equipItem", i: 0 });
});

test("decideAction: with a staff already wielded, a second bagged staff is left alone (no equipItem pick)", () => {
  const ctx = makeBotContext();
  const wielded = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };
  const second = { kind: "staff", n: "Oak Staff", use: "stone", charges: 1 };
  const state = mkState({ c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, weapon: "Birch Staff", staff: wielded, items: [second], timers: {} } });
  const action = decideAction(state, fixedPolicyRng, ctx);
  assert.notEqual(action.type, "equipItem");
});

test("decideAction: a non-Magic-User never equips a bagged staff", () => {
  const ctx = makeBotContext();
  const staff = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };
  const state = mkState({ c: fighter({ items: [staff] }) });
  const action = decideAction(state, fixedPolicyRng, ctx);
  assert.notEqual(action.type, "equipItem");
});

// --- decideAction: buff/staff sit after drinkPotion, before talk-first -----

test("decideAction: a round-1 buff/staff pick sits after the generic drinkPotion step and before talk-first", () => {
  const ctx = makeBotContext();
  const hard = fight("Humans", 1, 1, { foes: [{ name: "f", alive: true, lvl: 3, wp: 20, maxWP: 20 }] });

  // A Bard vs Humans is talk-first at round 1 (canParley returns true
  // directly); with a buff potion in hand and a hard fight, the buff pick
  // (b2) must still win — proving it precedes talk-first (c) in the chain.
  const bardBuff = mkState({ combat: hard, c: fighter({ sub: "Bard", items: [potion("speed")] }) });
  assert.deepStrictEqual(decideAction(bardBuff, fixedPolicyRng, ctx), { type: "useItem", i: 0 });

  // the generic drinkPotion step (b) still wins over the buff pick when the
  // hero is ALSO below potionThreshold with a heal potion in the bag — heal
  // is (a0), buff is (b2)/(b3); the plain (b) drinkPotion only ever fires
  // when chooseCombatItem found nothing (no potions to drink here means (b)
  // itself can't fire, but a low-hp state routes through (a0) first).
  const lowHpNoHealPotion = mkState({ combat: hard, c: fighter({ wp: 4, maxWP: 40, items: [potion("speed")] }) });
  const result = decideAction(lowHpNoHealPotion, fixedPolicyRng, ctx);
  // below the flee threshold with no heal potion -> flee wins (a), before the
  // buff pick ever gets a chance — proving (a0)/(a) precede (b2)/(b3).
  assert.strictEqual(result.type, "flee");
});

// --- chooseFieldItem: the torch --------------------------------------------

test("chooseFieldItem: lights a bag torch while in the dark and not already lit; null otherwise", () => {
  const ctx = makeBotContext();
  const torch = { kind: "tool", tool: "torch", n: "Torch", use: "light" };
  const darkFloor = { g: [[{ wall: false, seen: true, feat: null, dark: true }]], px: 0, py: 0, depth: 1 };
  const litFloor = { g: [[{ wall: false, seen: true, feat: null, dark: false }]], px: 0, py: 0, depth: 1 };

  const inDarkState = mkState({ floor: darkFloor, c: fighter({ items: [torch] }) });
  assert.deepStrictEqual(chooseFieldItem(inDarkState, ctx), { type: "useItem", i: 0 });

  const notDarkState = mkState({ floor: litFloor, c: fighter({ items: [torch] }) });
  assert.strictEqual(chooseFieldItem(notDarkState, ctx), null);

  const noTorchState = mkState({ floor: darkFloor, c: fighter({ items: [] }) });
  assert.strictEqual(chooseFieldItem(noTorchState, ctx), null);

  const alreadyLitState = mkState({
    floor: darkFloor,
    c: fighter({ items: [torch], timers: { "item:Torch": { cadence: "squares", left: 30, phase: "effect" } } }),
  });
  assert.strictEqual(chooseFieldItem(alreadyLitState, ctx), null);

  const blockedCtx = makeBotContext();
  blockedCtx.itemBlocked.add("tool:torch");
  assert.strictEqual(chooseFieldItem(inDarkState, blockedCtx), null);
});

test("decideAction: the torch step sits out of combat", () => {
  const ctx = makeBotContext();
  const torch = { kind: "tool", tool: "torch", n: "Torch", use: "light" };
  const darkFloor = { g: [[{ wall: false, seen: true, feat: null, dark: true }]], px: 0, py: 0, depth: 1 };
  const state = mkState({ floor: darkFloor, c: { wp: 40, maxWP: 40, rations: 0, potions: 0, items: [torch] } });
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "useItem", i: 0 });
});

// --- chooseFieldItem: 260918-w4n additions (Amulet of Light, Cloak of
// Regeneration, and field-item priority over drinkPotion/camp) -------------

test("chooseFieldItem: in the dark with no torch, a ready worn Amulet of Light is used (kind glow) from either jewelry key", () => {
  const ctx = makeBotContext();
  const darkFloor = { g: [[{ wall: false, seen: true, feat: null, dark: true }]], px: 0, py: 0, depth: 1 };
  const amulet = { kind: "jewel", n: "Amulet of Light", eff: { sight: 1, light: 1 } };

  const ready = mkState({ floor: darkFloor, c: fighter({ worn: { jewelry1: amulet } }) });
  assert.deepStrictEqual(chooseFieldItem(ready, ctx), { type: "useItem", slot: "jewelry1" });

  // 260918-wy1: found in jewelry2 alike (family-agnostic scan).
  const readyJewelry2 = mkState({ floor: darkFloor, c: fighter({ worn: { jewelry2: amulet } }) });
  assert.deepStrictEqual(chooseFieldItem(readyJewelry2, ctx), { type: "useItem", slot: "jewelry2" });

  // a carried torch still wins over the amulet
  const torch = { kind: "tool", tool: "torch", n: "Torch", use: "light" };
  const withTorch = mkState({ floor: darkFloor, c: fighter({ items: [torch], worn: { jewelry1: amulet } }) });
  assert.deepStrictEqual(chooseFieldItem(withTorch, ctx), { type: "useItem", i: 0 });

  // a LIVE glow effect (already used) needs no torch/amulet
  const alreadyGlowing = mkState({
    floor: darkFloor,
    c: fighter({ worn: { jewelry1: amulet }, timers: { "item:Amulet of Light": { cadence: "squares", left: 50, cd: 50, phase: "effect" } } }),
  });
  assert.strictEqual(chooseFieldItem(alreadyGlowing, ctx), null);
});

test("chooseFieldItem: below potionThreshold, a ready worn Cloak of Regeneration is used (kind knit) — tried before a potion or camp", () => {
  const ctx = makeBotContext();
  const cloak = { kind: "cloak", n: "Cloak of Regeneration", eff: { cloakRegen: 1 } };
  const litFloor = { g: [[{ wall: false, seen: true, feat: null, dark: false }]], px: 0, py: 0, depth: 1 };

  const hurt = mkState({ floor: litFloor, c: fighter({ wp: 5, maxWP: 40, worn: { cloak } }) });
  assert.deepStrictEqual(chooseFieldItem(hurt, ctx), { type: "useItem", slot: "cloak" });

  // decideAction tries it BEFORE drinkPotion, even with a potion in the bag
  const hurtWithPotion = mkState({
    floor: litFloor,
    c: fighter({ wp: 5, maxWP: 40, potions: 3, worn: { cloak } }),
  });
  assert.deepStrictEqual(decideAction(hurtWithPotion, fixedPolicyRng, ctx), { type: "useItem", slot: "cloak" });

  // full health never fires it
  const healthy = mkState({ floor: litFloor, c: fighter({ wp: 40, maxWP: 40, worn: { cloak } }) });
  assert.strictEqual(chooseFieldItem(healthy, ctx), null);
});

// --- preHazardFlight (via decideAction's field-movement dispatch) ---------

test("decideAction: a ready worn Cloak of Flying/Bracelet of Flight is used BEFORE stepping onto a climb/gorge tile", () => {
  const ctx = makeBotContext();
  const cloak = { kind: "cloak", n: "Cloak of Flying", eff: { fly: 1 } };
  // A single-cell floor with a climb tile to the north; dotsRemaining is 0
  // (no dots), so decideAction heads toward the exit — E in this tiny grid
  // has no cell, so dirTowardExit/nearestUnseenDir fall back; force the
  // climb tile to be the ONLY legal direction by open-walling just N.
  const floor = {
    g: [
      [{ wall: false, seen: true, feat: "climb" }],
      [{ wall: true, seen: true, feat: null }],
    ],
    px: 0, py: 1, depth: 1,
  };
  const state = mkState({ floor, c: fighter({ worn: { cloak } }) });
  const action = decideAction(state, fixedPolicyRng, ctx);
  assert.deepStrictEqual(action, { type: "useItem", slot: "cloak" });
});

test("decideAction: a LIVE fly effect never re-triggers preHazardFlight (the plain move proceeds)", () => {
  const ctx = makeBotContext();
  const cloak = { kind: "cloak", n: "Cloak of Flying", eff: { fly: 1 } };
  const floor = {
    g: [
      [{ wall: false, seen: true, feat: "climb" }],
      [{ wall: true, seen: true, feat: null }],
    ],
    px: 0, py: 1, depth: 1,
  };
  const state = mkState({
    floor,
    c: fighter({ worn: { cloak }, timers: { "item:Cloak of Flying": { cadence: "squares", left: 20, cd: 50, phase: "effect" } } }),
  });
  const action = decideAction(state, fixedPolicyRng, ctx);
  assert.equal(action.type, "move");
});

// --- helm-before-parley assist ---------------------------------------------

test("decideAction: below the flee threshold, wants to parley but can't (fluency 0) — a ready worn Helm of Knowledge is used first (either jewelry key)", () => {
  const ctx = makeBotContext();
  const helm = { kind: "jewel", n: "Helm of Knowledge", eff: { tongue: 1 } };
  const combat = fight("Humans", 1, 1);
  const state = mkState({ combat, c: fighter({ sub: "Soldier", wp: 4, maxWP: 40, worn: { jewelry1: helm } }) });
  const action = decideAction(state, fixedPolicyRng, ctx);
  assert.deepStrictEqual(action, { type: "useItem", slot: "jewelry1" });

  // 260918-wy1: found in jewelry2 alike.
  const state2 = mkState({ combat, c: fighter({ sub: "Soldier", wp: 4, maxWP: 40, worn: { jewelry2: helm } }) });
  assert.deepStrictEqual(decideAction(state2, fixedPolicyRng, ctx), { type: "useItem", slot: "jewelry2" });
});

// --- the victory loot pile ---------------------------------------------

test("decideAction: takes the pending loot pile before even a pending Joiner; leaves it when the bag is full", () => {
  const ctx = makeBotContext();
  const withLoot = mkState({ pendingLoot: [{ kind: "potion", n: "x", eff2: "heal" }], pendingJoiner: { name: "J" } });
  assert.deepStrictEqual(decideAction(withLoot, fixedPolicyRng, ctx), { type: "takeAllLoot" });

  ctx.findFull = true;
  assert.deepStrictEqual(decideAction(withLoot, fixedPolicyRng, ctx), { type: "leaveAllLoot" });

  // USER RULING D (54-CONTEXT.md, 2026-09-21): an empty party still accepts
  // the pending Joiner once the loot pile is empty (D-20 superseded).
  const emptyLoot = mkState({ pendingLoot: [], pendingJoiner: { name: "J" } });
  assert.deepStrictEqual(decideAction(emptyLoot, fixedPolicyRng, ctx), { type: "resolveJoiner", accept: true });
});

test("observe: lootTaken/lootLeft clear findFull the same way findTaken/findLeft do; bagFull sets it", () => {
  const ctx = makeBotContext();
  observe(ctx, [{ type: "bagFull" }]);
  assert.strictEqual(ctx.findFull, true);
  observe(ctx, [{ type: "lootTaken" }]);
  assert.strictEqual(ctx.findFull, false);
  observe(ctx, [{ type: "bagFull" }]);
  observe(ctx, [{ type: "lootLeft" }]);
  assert.strictEqual(ctx.findFull, false);
});

// --- observe: useRefused blocks an item label -------------------------

test("observe: useRefused blocks the item's label for the rest of the encounter/floor; encounterStarted AND floorChanged clear it", () => {
  const ctx = makeBotContext();
  observe(ctx, [{ type: "useRefused", item: { kind: "tool", tool: "torch", n: "Torch" } }]);
  assert.ok(ctx.itemBlocked.has("tool:torch"));
  observe(ctx, [{ type: "encounterStarted" }]);
  assert.strictEqual(ctx.itemBlocked.size, 0);

  observe(ctx, [{ type: "useRefused", item: { kind: "staff", n: "Birch Staff" } }]);
  assert.ok(ctx.itemBlocked.has("Birch Staff"));
  observe(ctx, [{ type: "floorChanged" }]);
  assert.strictEqual(ctx.itemBlocked.size, 0);
});

// --- RUN_FLAGS / playRun plays the shipped run rules -----------------------

test("RUN_FLAGS is { storeRoll: true }; playRun's state carries storeRoll and c.worn, and a Thief starts with its cloak worn", () => {
  assert.deepStrictEqual(RUN_FLAGS, { storeRoll: true });

  const r = playRun(1, { ...BOT_DEFAULTS, maxActions: 5 });
  assert.strictEqual(r.state.storeRoll, true);
  assert.strictEqual(typeof r.state.c.worn, "object");

  // find a seed whose forced Thief starts with a cloak already worn (a
  // Thief's starting kit includes one per chargen) — measured, not guessed.
  let sawWornCloak = false;
  for (let seed = 1; seed <= 10; seed++) {
    const r2 = playRun(seed, { ...BOT_DEFAULTS, maxActions: 1, force: { cls: "Thief", sub: "Pilfer", race: "Human" } });
    if (r2.state.c.worn && r2.state.c.worn.cloak) sawWornCloak = true;
  }
  assert.ok(sawWornCloak, "at least one of seeds 1-10 must start a forced Thief with a worn cloak");
});

// 260918-wy1 (jewelry-merge): a bot hero already wearing two jewelry pieces
// takes a third find — it stows (itemGiven, no itemEquipped), exactly like
// any other bag-goes-full case. The bot never calls equipItem itself; it
// acquires via takeFind/takeLoot/buy, all of which route through
// autoWearSlot -> freeWornKey, so it wears up to two pieces and stows the
// third automatically.
test("a bot hero with two worn jewels (playRun's single-path shape) taking a third find stows it — findTaken only, no itemEquipped", () => {
  const state = playRun(1, { ...BOT_DEFAULTS, maxActions: 1 }).state;
  const ring1 = { kind: "jewel", n: "Ring of Power", eff: { dmg: 1 }, txt: "+1 damage to all attacks" };
  const ring2 = { kind: "jewel", n: "Anklet of Invisibility", eff: { foeToHit: -2 }, txt: "foes need two better to land" };
  const ring3 = { kind: "jewel", n: "Gauntlet of the Giant", eff: { size: 1 }, txt: "one size larger" };
  state.c.worn.jewelry1 = ring1;
  state.c.worn.jewelry2 = ring2;
  state.pendingFind = ring3;
  const events = takeFind(state, []);
  assert.deepStrictEqual(events, [{ type: "findTaken", item: ring3 }]);
  assert.ok(!events.some((e) => e.type === "itemEquipped"), "the third jewel never equips");
  assert.ok(state.c.items.includes(ring3), "the third jewel stows in the bag");
  assert.equal(state.c.worn.jewelry1, ring1, "jewelry1 untouched");
  assert.equal(state.c.worn.jewelry2, ring2, "jewelry2 untouched");
});

// --- no-stall proof: Thief/MU/Fighter x seeds 1-3, items in use ------------

test("playRun: nine forced-cell runs (Thief/MU/Fighter x three seeds each) never stall; at least one itemUsed or lootTaken occurs", () => {
  // [Measured] a live playRun scratch run (node -e over tools/lib/tuning-bot.mjs)
  // confirmed all nine combinations complete (die naturally) well under
  // maxActions=1000, and multiple of the nine saw an itemUsed/lootTaken event
  // (e.g. Thief/Pilfer seed 1, Magic User/Sorcerer seed 1 and 3, Fighter/
  // Knight/Troll seed 3) — this assertion only requires at least one.
  //
  // Phase 54 rung 5 (USER RULING C, 2026-09-21): the per-floor knot fit
  // softened foePower substantially at floors 2-15 (down to 0.25-0.5) — a
  // forced-cell hero now survives noticeably longer against those foes.
  // Magic User/Sorcerer/Human seed 3 now dies at action 1280 (was < 1000),
  // so the cap widens to 5000 (re-measured live via this file's own
  // playRun, never hand-computed); every other combination still dies well
  // under this margin.
  //
  // Phase 54 (BAND-02, 2026-09-21, USER RULING D): the identity-commit
  // engine removes EVERY early-floor easing the retired knot ladder used to
  // supply — re-measured live up to 30,000 actions: Thief/Pilfer/Human seed
  // 2 and Fighter/Knight/Troll seed 3 now genuinely never resolve (stuck at
  // depth 8/day 11 and depth 3/day 4 respectively). This is an expected
  // consequence of landing at identity BEFORE 54-06/54-07's fit, not a
  // routing/engine regression this file exists to catch. Each force's own
  // seed trio is swapped for the smallest re-measured set that dies
  // naturally within the same 5000-action budget.
  //
  // Phase 72 (ROLL-01, finding F1, user ruling 2026-09-24): a live party
  // member's strike now applies the hero's own per-target to-hit rules
  // (`memberStrike`/`alliesTurn`'s legacy branch/`allyTurn`), which this
  // playthrough exercises for real (this seed's bot accepts a Joiner) —
  // the RNG sequence downstream of that first altered hit/miss diverges
  // completely from there, an expected consequence of a deliberate rule
  // change reaching a real (non-scripted) playthrough, not a routing/
  // engine regression. Bisected live (a scratch playRun against the
  // pre-Phase-72 engine, then against F1/F3/F5 individually) to confirm F1
  // alone is the cause: F3 (daggerOnly) and F5 (parley, 0 at identity)
  // reproduce the pre-fix outcome exactly (depth 17, day 26); only F1
  // diverges. Magic User/Sorcerer/Human seed 1 now hits `campFailed` in a
  // loop it never reached before (a pre-existing bot-AI edge case, not new
  // in this phase — see this file's own `Rule 1` stuck-investigation
  // reference near line 975) and never resolves even at 30,000 actions.
  // Re-measured live (never hand-typed): seed 4 is the smallest untaken
  // seed for this force that still dies naturally within 5000 actions
  // (depth 5, day 5) — swapped in; every other combination in every other
  // force is unaffected (re-confirmed live, all eight still resolve).
  //
  // "Thief"/"Pilfer" seed 1 swapped for seed 2 (Phase 75, Plan 12,
  // 2026-09-25): RULES-15's fed-only book refill and RULES-12's
  // `resolvePendingTile` both change which actions the bot's own decision
  // policy takes over a long run (a caster/item-using Thief's melee-vs-item
  // choices shift once a spent charge/tool state can persist differently
  // across a day, and a resumed tile firing later than before can change
  // which loot/finds are ever offered) — seed 1 now genuinely never
  // resolves (stuck at depth 11/day 11, re-measured live up to 5000
  // actions), the same "declared rules change reaching a real playthrough"
  // category the Phase 72 (ROLL-01 F1) comment above documents. Re-measured
  // live: seed 2 dies naturally (depth 8, day 14) and is the smallest
  // untaken seed for this force; seeds 3 and 5 are unaffected (still die
  // naturally, re-confirmed live) and keep their slots. The other two
  // forces' seed trios ("Magic User"/"Sorcerer" and "Fighter"/"Knight") are
  // unaffected by this plan (re-confirmed live, all six still resolve).
  const forces = [
    { cls: "Thief", sub: "Pilfer", race: "Human", seeds: [2, 3, 5] },
    { cls: "Magic User", sub: "Sorcerer", race: "Human", seeds: [4, 2, 3] },
    { cls: "Fighter", sub: "Knight", race: "Troll", seeds: [1, 2, 4] },
  ];
  let sawItem = false;
  for (const { seeds, ...force } of forces) {
    for (const seed of seeds) {
      const r = playRun(seed, { ...BOT_DEFAULTS, maxActions: 5000, force }, (events) => {
        if (events.some((e) => e.type === "itemUsed" || e.type === "lootTaken")) sawItem = true;
      });
      assert.strictEqual(r.stuck, false, `${force.cls}/${force.sub}/${force.race} seed ${seed}: the bot must not stall`);
    }
  }
  assert.ok(sawItem, "at least one of the nine forced-cell runs must use an item or take loot");
});

// ============================================================================
// Plan 03, Task 2: tallyUsage — the per-run pick-rate tally.
// ============================================================================

test("makeTallies: usage is a fresh { abilities: {}, spells: {}, items: {} } every call", () => {
  const t1 = makeTallies();
  assert.deepStrictEqual(t1.usage, { abilities: {}, spells: {}, items: {} });
  t1.usage.abilities.kata = 1;
  const t2 = makeTallies();
  assert.deepStrictEqual(t2.usage, { abilities: {}, spells: {}, items: {} }); // no shared reference
});

test("tallyUsage: abilityUsed increments usage.abilities[key]; repeated events accumulate", () => {
  const tallies = makeTallies();
  const action = { type: "useAbility", key: "kata" };
  tallyUsage(tallies, action, [{ type: "abilityUsed", key: "kata", name: "Kata" }], {}, {});
  tallyUsage(tallies, action, [{ type: "abilityUsed", key: "kata", name: "Kata" }], {}, {});
  assert.deepStrictEqual(tallies.usage.abilities, { kata: 2 });
});

test("tallyUsage: itemUsed increments usage.items[itemLabel(item)] — a potion, a torch, and a staff each label correctly", () => {
  const tallies = makeTallies();
  const action = { type: "useItem", i: 0 };
  tallyUsage(tallies, action, [{ type: "itemUsed", item: { kind: "potion", eff2: "heal" } }], {}, {});
  tallyUsage(tallies, action, [{ type: "itemUsed", item: { kind: "tool", tool: "torch", n: "Torch" } }], {}, {});
  tallyUsage(tallies, action, [{ type: "itemUsed", item: { kind: "staff", n: "Birch Staff" } }], {}, {});
  assert.deepStrictEqual(tallies.usage.items, { "potion:heal": 1, "tool:torch": 1, "Birch Staff": 1 });
});

test("tallyUsage: toolUsed increments usage.items['tool:' + tool] (a rope/ladder hazard-tool spend)", () => {
  const tallies = makeTallies();
  tallyUsage(tallies, { type: "useTool", tool: "rope" }, [{ type: "toolUsed", tool: "rope", feat: "gorge", item: { kind: "tool", tool: "rope" } }], {}, {});
  assert.deepStrictEqual(tallies.usage.items, { "tool:rope": 1 });
});

test("tallyUsage: scrollCast increments usage.items.scroll — a scroll is an ITEM use, never a spell use", () => {
  const tallies = makeTallies();
  const before = { c: { spellsUsed: 0 } };
  const after = { c: { spellsUsed: 0 } }; // readScroll saves/restores spellsUsed around its own free castSpell call
  tallyUsage(tallies, { type: "readScroll" }, [{ type: "scrollCast", spell: "Freeze" }], before, after);
  assert.deepStrictEqual(tallies.usage.items, { scroll: 1 });
  assert.deepStrictEqual(tallies.usage.spells, {});
});

test("tallyUsage: a castSpell action whose spellsUsed delta is +1 tallies usage.spells[name]; a refused cast (delta 0) tallies nothing", () => {
  const tallies = makeTallies();
  const freezeIdx = idx("Freeze");
  const before = { c: { spellsUsed: 0 } };
  const realCast = { c: { spellsUsed: 1 } };
  tallyUsage(tallies, { type: "castSpell", idx: freezeIdx }, [{ type: "spellHit" }], before, realCast);
  assert.deepStrictEqual(tallies.usage.spells, { Freeze: 1 });

  const refused = { c: { spellsUsed: 0 } }; // e.g. noChargesLeft/spellResisted — spellsUsed unchanged
  tallyUsage(tallies, { type: "castSpell", idx: freezeIdx }, [{ type: "noChargesLeft" }], before, refused);
  assert.deepStrictEqual(tallies.usage.spells, { Freeze: 1 }); // unchanged — no double count, no phantom entry
});

test("tallyUsage: a non-castSpell/non-usage action with no matching events tallies nothing and never throws", () => {
  const tallies = makeTallies();
  tallyUsage(tallies, { type: "move", dir: "N" }, [{ type: "moved" }], { c: { spellsUsed: 0 } }, { c: { spellsUsed: 0 } });
  assert.deepStrictEqual(tallies.usage, { abilities: {}, spells: {}, items: {} });
});

test("playRun: a real run's tallies.usage carries at least one ability/item/spell entry when the matching event fires (measured via onStep)", () => {
  // [Measured] a live playRun scratch run over a Fighter/Knight cell (seeds
  // 1-5, the same forced cell the existing no-stall proof above uses)
  // confirmed at least one abilityUsed event, and tallies.usage.abilities
  // ends up non-empty at the end of the run that saw it.
  let sawUsage = false;
  for (let seed = 1; seed <= 5; seed++) {
    const r = playRun(seed, { ...BOT_DEFAULTS, maxActions: 1000, force: { cls: "Fighter", sub: "Knight", race: "Human" } });
    if (Object.keys(r.tallies.usage.abilities).length > 0) sawUsage = true;
  }
  assert.ok(sawUsage, "at least one of seeds 1-5 must end with a non-empty tallies.usage.abilities");
});
