// test/unit/bot-buy-policy.test.js
//
// Phase 39 (GEAR-01, 39-02-PLAN.md Task 1) — pins the tuning bot's store
// buy/equip policy: chooseStorePurchase(state, ctx) and decideAction's
// rewritten step (l). Hand-built minimal states (a `store.stock` array of
// plain lines — chooseStorePurchase never needs a real openStore() call),
// mirroring test/unit/tuning-bot.test.js's fixture style. Asserts DECISIONS
// only — never a real seeded-run readout number.

import test from "node:test";
import assert from "node:assert/strict";

import { chooseStorePurchase, decideAction, makeBotContext, GOLD_RESERVE, BOT_RATION_DAYS } from "../../tools/lib/tuning-bot.mjs";
import { buyFrom } from "../../engine/economy.js";
import { nightlyEats } from "../../engine/movement.js";

/** hero(over) — a level-1 Human Fighter/Soldier with a Club and no armor, overridable. */
function hero(over = {}) {
  return {
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
    weapon: "Club",
    prof: 0,
    magicWpn: 0,
    armor: "Nothing",
    ar: 0,
    armorMin: 0,
    armorWP: 0,
    armorMax: 0,
    ...over,
  };
}

/** weaponLine(base, cost, opts) — a plain buyWeapon (or buyPremium) stock line. */
function weaponLine(base, cost, opts = {}) {
  const { sold = false, bonus = 0, effectId = "buyWeapon" } = opts;
  return {
    n: base,
    sub: null,
    cost,
    effectId,
    effectParams: { item: { kind: "weapon", n: base, base, bonus, txt: base } },
    sold,
  };
}

/** armorLine(name, ar, cls, cost, opts) — a plain buyArmor (or buyPremium) stock line. */
function armorLine(name, ar, cls, cost, opts = {}) {
  const { sold = false, effectId = "buyArmor" } = opts;
  return {
    n: name,
    sub: null,
    cost,
    effectId,
    effectParams: { item: { kind: "armor", n: name, armor: name, ar, wp: ar * 2, min: 1, cls, txt: `AR ${ar}` } },
    sold,
  };
}

/** mkState(c, stock) — a minimal store-open state; stock omitted/null means no store open. */
function mkState(c, stock) {
  return {
    c,
    store: stock ? { stock, haggle: 1, race: c.race } : null,
    combat: null,
    pendingFind: null,
    pendingJoiner: null,
    party: [],
    floor: null,
    dead: false,
  };
}

test("chooseStorePurchase buys the highest expectedStrike affordable weapon first (Flail over Rapier), then the armor upgrade on the next call, then null", () => {
  const c = hero({ gold: 1000 });
  const stock = [
    weaponLine("Flail", 250), // idx 0 — expectedStrike 2.125 (39-01-SUMMARY sample pin)
    weaponLine("Rapier", 200), // idx 1 — expectedStrike 1.80
    armorLine("Studded", 10, "FT", 750), // idx 2
  ];
  const ctx = makeBotContext();
  const state = mkState(c, stock);

  // Call 1: the weapon pass wins — Flail's higher expectedStrike beats Rapier's.
  assert.deepStrictEqual(chooseStorePurchase(state, ctx), { type: "buyItem", idx: 0 });

  // Simulate the engine's own takeItem effect of that buy (mark sold, re-equip).
  stock[0].sold = true;
  c.weapon = "Flail";

  // Call 2: Rapier is no longer an upgrade over the now-wielded Flail (its
  // expectedStrike is lower), so the weapon pass finds nothing and the armor
  // pass buys Studded (armorUpgradeDelta 10 - 0 > 0).
  assert.deepStrictEqual(chooseStorePurchase(state, ctx), { type: "buyItem", idx: 2 });

  stock[2].sold = true;
  c.armor = "Studded";
  c.ar = 10;

  // Call 3: nothing left qualifies (Rapier still not an upgrade over Flail,
  // both other lines sold) -> null, and decideAction falls back to leaveStore.
  assert.strictEqual(chooseStorePurchase(state, ctx), null);
  assert.deepStrictEqual(decideAction(state, { pick: (arr) => arr[0] }, ctx), { type: "leaveStore" });
});

test("a Thief skips a bulk>1 armor line even when it is class-legal, and buys the bulk<=1 upgrade instead", () => {
  const c = hero({ cls: "Thief", sub: "Pilfer", weapon: "Dagger", gold: 5000 });
  const stock = [
    // Real Plate is F-only canon, but its ARMORS-table bulk (2) is what
    // armorBulk() reads by NAME — override this line's own `cls` to "FT" so
    // canEquipArmor passes, isolating the Thief bulk-skip rule from the
    // canon class gate.
    armorLine("Plate", 15, "FT", 2000),
    armorLine("Studded", 10, "FT", 750),
  ];
  const ctx = makeBotContext();
  const state = mkState(c, stock);

  assert.deepStrictEqual(chooseStorePurchase(state, ctx), { type: "buyItem", idx: 1 });
});

test("a Magic User is never offered a Flail (F/T only) — the class-legality gate refuses it outright", () => {
  const c = hero({ cls: "Magic User", sub: "Sorcerer", weapon: "Quarter Staff", gold: 1000 });
  const stock = [weaponLine("Flail", 250)];
  const ctx = makeBotContext();
  const state = mkState(c, stock);

  assert.strictEqual(chooseStorePurchase(state, ctx), null);
});

test("gold 60 (budget under GOLD_RESERVE headroom) -> nothing affordable -> chooseStorePurchase null, decideAction leaves the store", () => {
  const c = hero({ gold: 60 });
  const stock = [weaponLine("Flail", 250)];
  const ctx = makeBotContext();
  const state = mkState(c, stock);

  assert.strictEqual(chooseStorePurchase(state, ctx), null);
  assert.deepStrictEqual(decideAction(state, { pick: (arr) => arr[0] }, ctx), { type: "leaveStore" });
});

test("a bot already wielding a Bardiche leaves a strictly-worse Rapier alone (weaponUpgradeDelta <= 0)", () => {
  const c = hero({ weapon: "Bardiche", gold: 1000 });
  const stock = [weaponLine("Rapier", 200)];
  const ctx = makeBotContext();
  const state = mkState(c, stock);

  assert.strictEqual(chooseStorePurchase(state, ctx), null);
});

test("T-39-04: a sold line or a line over budget is never chosen, no matter its score", () => {
  const c = hero({ gold: 1000 });
  const stock = [
    weaponLine("Flail", 250, { sold: true }), // best score, but sold
    weaponLine("Rapier", 999999), // affordable? no — way over budget
  ];
  const ctx = makeBotContext();
  const state = mkState(c, stock);

  assert.strictEqual(chooseStorePurchase(state, ctx), null);
});

test("premium lines (buyPremium) are considered as weapons/armor by effectParams.item.kind", () => {
  const c = hero({ gold: 1000 });
  const stock = [weaponLine("Flail", 250, { effectId: "buyPremium", bonus: 1 })];
  const ctx = makeBotContext();
  const state = mkState(c, stock);

  assert.deepStrictEqual(chooseStorePurchase(state, ctx), { type: "buyItem", idx: 0 });
});

test("GOLD_RESERVE is exactly 50 and store.stock missing/empty never throws", () => {
  assert.strictEqual(GOLD_RESERVE, 50);
  const c = hero({ gold: 1000 });
  assert.strictEqual(chooseStorePurchase(mkState(c, null), makeBotContext()), null);
  assert.strictEqual(chooseStorePurchase({ c, store: {} }, makeBotContext()), null);
});

// ─── Phase 87 STORE-04: the fair bot's ration target (user ruling 2026-09-29) ───

/** rationsLine(cost, left) — the engine's Rations stock line (economy.js openStore shape). */
function rationsLine(cost, left, opts = {}) {
  return {
    n: "Rations (+1 ration)",
    sub: null,
    cost,
    effectId: "buyRations",
    effectParams: { amount: 1 },
    sold: opts.sold ?? false,
    left,
  };
}

/** Drive chooseStorePurchase -> the REAL engine buyFrom until the bot returns null; returns the picked idxs. */
function driveBuys(state, ctx, limit = 60) {
  const picks = [];
  for (let n = 0; n < limit; n++) {
    const a = chooseStorePurchase(state, ctx);
    if (a === null) return picks;
    assert.equal(a.type, "buyItem");
    const before = { gold: state.c.gold, rations: state.c.rations };
    buyFrom(state, a.idx, []);
    // never a buy the engine refuses: the purse and the pack must have moved
    assert.ok(state.c.gold < before.gold && state.c.rations > before.rations, "the bot picked a buy the engine refused");
    picks.push(a.idx);
  }
  assert.fail("chooseStorePurchase looped without settling");
}

test("BOT_RATION_DAYS is exactly 3", () => {
  assert.strictEqual(BOT_RATION_DAYS, 3);
});

test("Human hero alone tops up to BOT_RATION_DAYS x 1 rations, one per pick, then null; decideAction then leaves", () => {
  const c = hero({ gold: 200, rations: 1, bag: "small" });
  const stock = [rationsLine(30, 7)];
  const state = mkState(c, stock);
  const ctx = makeBotContext();
  assert.deepStrictEqual(chooseStorePurchase(state, ctx), { type: "buyItem", idx: 0 });
  const picks = driveBuys(state, ctx);
  assert.deepStrictEqual(picks, [0, 0], "1 -> 3 rations is two buys");
  assert.equal(c.rations, BOT_RATION_DAYS * nightlyEats(state));
  assert.equal(stock[0].left, 5);
  assert.strictEqual(chooseStorePurchase(state, ctx), null);
  assert.deepStrictEqual(decideAction(state, { pick: (arr) => arr[0] }, ctx), { type: "leaveStore" });
});

test("the target is nightlyEats(state): a Troll (eats 2) targets 6; a Human with one Troll Joiner (1 + 2) targets 9", () => {
  const troll = hero({ race: "Troll", gold: 1000, rations: 0, bag: "large" });
  const s1 = mkState(troll, [rationsLine(30, 10)]);
  assert.equal(nightlyEats(s1), 2);
  driveBuys(s1, makeBotContext());
  assert.equal(troll.rations, 6);

  const human = hero({ gold: 1000, rations: 0, bag: "large" });
  const s2 = mkState(human, [rationsLine(30, 10)]);
  s2.party = [{ race: "Troll", name: "Zell" }];
  assert.equal(nightlyEats(s2), 3);
  driveBuys(s2, makeBotContext());
  assert.equal(human.rations, 9);
});

test("an affordable weapon and armour upgrade are still bought first; the ration pass runs only after both", () => {
  const c = hero({ gold: 1000, rations: 0, bag: "large" });
  const stock = [
    rationsLine(30, 10), // idx 0 — listed FIRST, must still lose to gear
    weaponLine("Flail", 250), // idx 1
    armorLine("Studded", 10, "FT", 450), // idx 2
  ];
  const state = mkState(c, stock);
  const ctx = makeBotContext();
  assert.deepStrictEqual(chooseStorePurchase(state, ctx), { type: "buyItem", idx: 1 });
  stock[1].sold = true;
  c.weapon = "Flail";
  assert.deepStrictEqual(chooseStorePurchase(state, ctx), { type: "buyItem", idx: 2 });
  stock[2].sold = true;
  c.armor = "Studded";
  c.ar = 10;
  assert.deepStrictEqual(chooseStorePurchase(state, ctx), { type: "buyItem", idx: 0 }, "gear done, now the rations");
});

test("the ration pass stops at the shelf, the purse and the pack cap, and never offers a refused buy", () => {
  // shelf: two left, target 3 from 0 -> exactly two buys, then null
  const a = hero({ gold: 500, rations: 0, bag: "large" });
  const sa = mkState(a, [rationsLine(30, 2)]);
  assert.deepStrictEqual(driveBuys(sa, makeBotContext()), [0, 0]);
  assert.equal(a.rations, 2);
  assert.equal(sa.store.stock[0].sold, true);
  assert.strictEqual(chooseStorePurchase(sa, makeBotContext()), null);

  // purse: 70 wm buys two at 30; the third is short, so it stops (no GOLD_RESERVE on rations)
  const b = hero({ gold: 70, rations: 0, bag: "large" });
  const sb = mkState(b, [rationsLine(30, 10)]);
  assert.deepStrictEqual(driveBuys(sb, makeBotContext()), [0, 0]);
  assert.equal(b.gold, 10);

  // pack cap: the 3-day target (30 here) is far above a small pack's cap of 10
  const d = hero({ race: "Troll", gold: 5000, rations: 9, bag: "small" });
  const sd = mkState(d, [rationsLine(30, 10)]);
  sd.party = [{ race: "Troll", name: "A" }, { race: "Troll", name: "B" }, { race: "Troll", name: "C" }, { race: "Troll", name: "D" }];
  assert.deepStrictEqual(driveBuys(sd, makeBotContext()), [0]);
  assert.equal(d.rations, 10);
  assert.strictEqual(chooseStorePurchase(sd, makeBotContext()), null, "at the pack cap the bot never asks");

  // sold / left 0 lines are never picked
  const e = hero({ gold: 500, rations: 0, bag: "large" });
  assert.strictEqual(chooseStorePurchase(mkState(e, [rationsLine(30, 0, { sold: true })]), makeBotContext()), null);
  assert.strictEqual(chooseStorePurchase(mkState(e, [rationsLine(30, 0)]), makeBotContext()), null);
});

test("at or above the target the ration pass returns null", () => {
  const c = hero({ gold: 500, rations: 3, bag: "large" });
  assert.strictEqual(chooseStorePurchase(mkState(c, [rationsLine(30, 10)]), makeBotContext()), null);
  const c2 = hero({ gold: 500, rations: 8, bag: "large" });
  assert.strictEqual(chooseStorePurchase(mkState(c2, [rationsLine(30, 10)]), makeBotContext()), null);
});

test("the ration pass ignores GOLD_RESERVE: a hero with 30 wm buys a 30 wm ration (food is the reserve's own purpose)", () => {
  const c = hero({ gold: 30, rations: 0, bag: "large" });
  assert.deepStrictEqual(chooseStorePurchase(mkState(c, [rationsLine(30, 5)]), makeBotContext()), { type: "buyItem", idx: 0 });
});

test("a legacy Rations line (no left, unsold) is bought once, then it is sold", () => {
  const c = hero({ gold: 200, rations: 0, bag: "large" });
  const line = { n: "Rations (+1 ration)", sub: null, cost: 30, effectId: "buyRations", effectParams: { amount: 1 }, sold: false };
  const state = mkState(c, [line]);
  assert.deepStrictEqual(driveBuys(state, makeBotContext()), [0]);
  assert.equal(c.rations, 1);
});

test("decideAction is unchanged for one in-combat and one exploration decision (no drift)", () => {
  const ctx = makeBotContext();
  const fixedPolicyRng = { pick: (arr) => arr[0] };

  // In-combat: a healthy Fighter above every flee/potion threshold just attacks.
  const combatState = {
    c: hero({ wp: 40, maxWP: 40 }),
    combat: { type: "Beasts", foes: [{ name: "wolf", alive: true, wp: 10, maxWP: 10 }], round: 1, target: 0 },
    store: null,
    pendingFind: null,
    pendingJoiner: null,
    party: [],
  };
  assert.deepStrictEqual(decideAction(combatState, fixedPolicyRng, ctx), { type: "attack" });

  // Exploration: no store/combat/joiner/find, dots remain -> explore toward
  // the nearest unseen tile (unchanged from before this plan).
  const explFloor = {
    px: 0,
    py: 0,
    depth: 1,
    g: [
      [{ wall: false, seen: true, feat: "dot" }, { wall: false, seen: false, feat: null }],
      [{ wall: false, seen: true, feat: null }, { wall: false, seen: true, feat: null }],
    ],
  };
  const exploreState = {
    c: hero({ wp: 40, maxWP: 40 }),
    combat: null,
    store: null,
    pendingFind: null,
    pendingJoiner: null,
    party: [],
    floor: explFloor,
  };
  const decision = decideAction(exploreState, fixedPolicyRng, ctx);
  assert.strictEqual(decision.type, "move");
  assert.ok(["N", "S", "E", "W"].includes(decision.dir));
});

// --- Phase 39 (GEAR-05) / Phase 78 (CLIMB-01): the pending-hazard handler --
// A pending-STATE handler (answers a decision the engine already parked),
// NOT a timing tactic (WHEN to pop an item stays Phase 42's bot-tactics
// scope). CLIMB-01: every step toward a wall or crevice now parks the
// decision, so the bot answers it on the very next action — the carried tool
// when it has one, otherwise the commit. It never turns back.

test("decideAction: a pending hazard with the matching tool carried is answered with useTool in one dispatch", () => {
  const c = hero({ gold: 0, items: [{ kind: "tool", tool: "ladder", n: "Ladder" }] });
  const state = mkState(c, null);
  state.pendingHazard = { feat: "climb", dir: "E", tool: "ladder" };
  const ctx = makeBotContext();
  assert.deepStrictEqual(decideAction(state, { pick: (arr) => arr[0] }, ctx), { type: "useTool", tool: "ladder", dir: "E" });
});

test("CLIMB-01: decideAction commits (resolveHazard cross true) to a pending hazard when the tool is not carried", () => {
  const c = hero({ gold: 0 });
  const state = mkState(c, null);
  state.pendingHazard = { feat: "gorge", dir: "E", tool: "rope" };
  const ctx = makeBotContext();
  assert.deepStrictEqual(decideAction(state, { pick: (arr) => arr[0] }, ctx), { type: "resolveHazard", cross: true });
});
