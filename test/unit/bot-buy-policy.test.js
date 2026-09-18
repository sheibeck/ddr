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

import { chooseStorePurchase, decideAction, makeBotContext, GOLD_RESERVE } from "../../tools/lib/tuning-bot.mjs";

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
    won: false,
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

// --- Phase 39 (GEAR-05): the pending-hazard handler -------------------------
// A pending-STATE handler (answers a decision the engine already parked),
// NOT a timing tactic (WHEN to pop an item stays Phase 42's bot-tactics
// scope) — the bot never buys/carries a tool today (chooseStorePurchase
// only scans buyWeapon/buyArmor/buyPremium lines), so this only proves the
// dispatch shape; it never actually fires in a real 400-seed run yet.

test("decideAction: a pending hazard (not yet declined) is answered with useTool in one dispatch", () => {
  const c = hero({ gold: 0 });
  const state = mkState(c, null);
  state.pendingHazard = { feat: "climb", dir: "E", tool: "ladder", declined: false };
  const ctx = makeBotContext();
  assert.deepStrictEqual(decideAction(state, { pick: (arr) => arr[0] }, ctx), { type: "useTool", tool: "ladder", dir: "E" });
});

test("decideAction: a DECLINED pending hazard falls through to the normal exploration chain instead of re-answering", () => {
  const c = hero({ gold: 0 });
  const explFloor = {
    px: 0,
    py: 0,
    depth: 1,
    g: [
      [{ wall: false, seen: true, feat: "dot" }, { wall: false, seen: false, feat: null }],
      [{ wall: false, seen: true, feat: null }, { wall: false, seen: true, feat: null }],
    ],
  };
  const state = mkState(c, null);
  state.floor = explFloor;
  state.pendingHazard = { feat: "climb", dir: "E", tool: "ladder", declined: true };
  const ctx = makeBotContext();
  const result = decideAction(state, { pick: (arr) => arr[0] }, ctx);
  assert.notEqual(result.type, "useTool");
});
