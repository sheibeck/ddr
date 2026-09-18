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
