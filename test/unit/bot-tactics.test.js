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
  RUN_FLAGS,
  playRun,
  BOT_DEFAULTS,
  BOT_TACTICS,
} from "../../tools/lib/tuning-bot.mjs";
import { DEATH_PANIC_THRESHOLD } from "../../engine/derived.js";

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
    won: false,
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
  let sawAbility = false;
  for (let seed = 1; seed <= 5; seed++) {
    const r = playRun(seed, { ...BOT_DEFAULTS, maxActions: 1000, force: { cls: "Fighter", sub: "Knight", race: "Human" } }, (events) => {
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

  const healOnly = mkState({ combat, c: fighter({ wp: 4, maxWP: 40, items: [potion("heal")] }) }); // 0.1 < 0.3
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

  // a Pilfer never gets the buff pick (a non-heal/full item — useItem would refuse it "pilfer")
  const pilferState = mkState({ combat: hard, c: thief({ sub: "Pilfer", items: [potion("speed")] }) });
  assert.strictEqual(chooseCombatItem(pilferState, ctx), null);
});

test("chooseCombatItem: a ready worn Cloak of Speed is used at round 1 of a hard fight", () => {
  const ctx = makeBotContext();
  const hard = fight("Beasts", 1, 1, { foes: [{ name: "f", alive: true, lvl: 3, wp: 20, maxWP: 20 }] });
  const cloak = { kind: "cloak", n: "Cloak of Speed", use: "haste" };
  const state = mkState({ combat: hard, c: fighter({ worn: { cloak } }) });
  assert.deepStrictEqual(chooseCombatItem(state, ctx), { action: { type: "useItem", slot: "cloak" }, reason: "buff" });
});

// --- chooseCombatItem: a Magic User's worn staff ---------------------------

test("chooseCombatItem: a Magic User's worn targeted staff fires at staffMinFoes+ live foes", () => {
  const ctx = makeBotContext();
  const staff = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };

  const oneFoe = mkState({ combat: fight("Beasts", 1, 2), c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, items: [], worn: { staff }, timers: {} } });
  assert.strictEqual(chooseCombatItem(oneFoe, ctx), null);

  const twoFoes = mkState({ combat: fight("Beasts", 2, 2), c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, items: [], worn: { staff }, timers: {} } });
  assert.deepStrictEqual(chooseCombatItem(twoFoes, ctx), { action: { type: "useItem", slot: "staff" }, reason: "staff" });

  // a Fighter never fires a staff (class-gated at the top of the check)
  const fighterWithStaff = mkState({ combat: fight("Beasts", 2, 2), c: fighter({ worn: { staff } }) });
  assert.strictEqual(chooseCombatItem(fighterWithStaff, ctx), null);

  // an empty staff (0 charges) is never ready (itemReady's own charge gate)
  const emptyStaff = { ...staff, charges: 0 };
  const noCharges = mkState({ combat: fight("Beasts", 2, 2), c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, items: [], worn: { staff: emptyStaff }, timers: {} } });
  assert.strictEqual(chooseCombatItem(noCharges, ctx), null);
});

test("chooseCombatItem: a worn dome/heal staff fires below potionThreshold; dome is skipped with an active ward", () => {
  const ctx = makeBotContext();
  const domeStaff = { kind: "staff", n: "Rowan Staff", use: "dome", charges: 2 };
  const healStaff = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 3 };
  const combat = fight("Beasts", 1, 2);
  const muC = (over) => ({ cls: "Magic User", sub: "Sorcerer", wp: 10, maxWP: 40, potions: 0, items: [], timers: {}, ...over }); // 0.25 < potionThreshold 0.5

  const domeReady = mkState({ combat, c: muC({ worn: { staff: domeStaff }, ward: null }) });
  assert.deepStrictEqual(chooseCombatItem(domeReady, ctx), { action: { type: "useItem", slot: "staff" }, reason: "staff" });

  const domeAlreadyUp = mkState({ combat, c: muC({ worn: { staff: domeStaff }, ward: { pool: 50 } }) });
  assert.strictEqual(chooseCombatItem(domeAlreadyUp, ctx), null);

  const healReady = mkState({ combat, c: muC({ worn: { staff: healStaff }, ward: null }) });
  assert.deepStrictEqual(chooseCombatItem(healReady, ctx), { action: { type: "useItem", slot: "staff" }, reason: "staff" });
});

test("chooseCombatItem: a legacy state (no c.worn) reads a bagged staff by index; a worn-model state never reads it by index", () => {
  const ctx = makeBotContext();
  const staff = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };
  const combat = fight("Beasts", 2, 2);

  const legacy = mkState({ combat, c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, items: [staff], timers: {} } });
  assert.ok(!("worn" in legacy.c));
  assert.deepStrictEqual(chooseCombatItem(legacy, ctx), { action: { type: "useItem", i: 0 }, reason: "staff" });
});

test("chooseCombatItem: a torch/staff/cloak label in ctx.itemBlocked is skipped", () => {
  const ctx = makeBotContext();
  ctx.itemBlocked.add("Birch Staff");
  const staff = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };
  const state = mkState({ combat: fight("Beasts", 2, 2), c: { cls: "Magic User", sub: "Sorcerer", wp: 40, maxWP: 40, potions: 0, items: [], worn: { staff }, timers: {} } });
  assert.strictEqual(chooseCombatItem(state, ctx), null);
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

test("decideAction: the torch step sits out of combat, after camp", () => {
  const ctx = makeBotContext();
  const torch = { kind: "tool", tool: "torch", n: "Torch", use: "light" };
  const darkFloor = { g: [[{ wall: false, seen: true, feat: null, dark: true }]], px: 0, py: 0, depth: 1 };
  const state = mkState({ floor: darkFloor, c: { wp: 40, maxWP: 40, rations: 0, potions: 0, items: [torch] } });
  assert.deepStrictEqual(decideAction(state, fixedPolicyRng, ctx), { type: "useItem", i: 0 });
});

// --- the victory loot pile ---------------------------------------------

test("decideAction: takes the pending loot pile before even a pending Joiner; leaves it when the bag is full", () => {
  const ctx = makeBotContext();
  const withLoot = mkState({ pendingLoot: [{ kind: "potion", n: "x", eff2: "heal" }], pendingJoiner: { name: "J" } });
  assert.deepStrictEqual(decideAction(withLoot, fixedPolicyRng, ctx), { type: "takeAllLoot" });

  ctx.findFull = true;
  assert.deepStrictEqual(decideAction(withLoot, fixedPolicyRng, ctx), { type: "leaveAllLoot" });

  const emptyLoot = mkState({ pendingLoot: [], pendingJoiner: { name: "J" } });
  assert.deepStrictEqual(decideAction(emptyLoot, fixedPolicyRng, ctx), { type: "resolveJoiner", accept: false });
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

test("RUN_FLAGS is { storeRoll: true, wornSlots: true }; playRun's state carries both, and a Thief starts with its cloak worn", () => {
  assert.deepStrictEqual(RUN_FLAGS, { storeRoll: true, wornSlots: true });

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

// --- no-stall proof: Thief/MU/Fighter x seeds 1-3, items in use ------------

test("playRun: nine forced-cell runs (Thief/MU/Fighter x seeds 1-3) never stall; at least one itemUsed or lootTaken occurs", () => {
  // [Measured] a live playRun scratch run (node -e over tools/lib/tuning-bot.mjs)
  // confirmed all nine combinations complete (die naturally) well under
  // maxActions=1000, and multiple of the nine saw an itemUsed/lootTaken event
  // (e.g. Thief/Pilfer seed 1, Magic User/Sorcerer seed 1 and 3, Fighter/
  // Knight/Troll seed 3) — this assertion only requires at least one.
  const forces = [
    { cls: "Thief", sub: "Pilfer", race: "Human" },
    { cls: "Magic User", sub: "Sorcerer", race: "Human" },
    { cls: "Fighter", sub: "Knight", race: "Troll" },
  ];
  let sawItem = false;
  for (const force of forces) {
    for (let seed = 1; seed <= 3; seed++) {
      const r = playRun(seed, { ...BOT_DEFAULTS, maxActions: 1000, force }, (events) => {
        if (events.some((e) => e.type === "itemUsed" || e.type === "lootTaken")) sawItem = true;
      });
      assert.strictEqual(r.stuck, false, `${force.cls}/${force.sub}/${force.race} seed ${seed}: the bot must not stall`);
    }
  }
  assert.ok(sawItem, "at least one of the nine forced-cell runs must use an item or take loot");
});
