// engine/economy.js
//
// The store domain (ENG-01, ENG-03, ENG-04) — ports mazeworld.html's
// openStore/buyFrom/leaveStore (lines 2004-2062), ELIMINATING the store's
// buy closures, the one place the frozen prototype itself flags as
// non-serializable ("store stock holds closures and is excluded from
// save" — mazeworld.html's own save() comment). Every `add(n, cost, buy,
// sub)` closure becomes a PLAIN-DATA stock entry `{n, sub, cost, effectId,
// effectParams, sold}`; the closure's body moves into STORE_EFFECTS, an
// engine-side lookup table keyed by `effectId` that buyFrom consults at
// purchase time. No function value is ever written onto `state` — an open
// store is 100% JSON, so it now serializes and survives save/reload
// (01-RESEARCH.md Pattern 3; ENG-03/ENG-04's flagged anti-pattern, fixed).
//
// No DOM, no localStorage, no Math.random — every roll goes through the
// injected engine rng, in the prototype's exact consumption order.

import { giveItem, takeItem, stowItem, canStow, bagCap, hasPicks, rollBlade, rollMailPiece, canEquipArmor, toolItem } from "./items.js";
import { clampCarry, slotItems, hasTool } from "./derived.js";
import {
  WEAPONS,
  ARMORS,
  FOODS,
  POTIONS,
  RACES,
  BAG_FLOORS,
  STORE_POTION_POOL,
  STORE_WEAPON_BANDS,
  STORE_ARMOR_CAP,
  STORE_PREMIUM_BONUS,
  TOOLS,
  TOOL_ORDER,
} from "../content/index.js";

/**
 * priceFor(base, race, sub = null) — "Costs are triple for trolls, and half
 * for elves or dwarves." Ports mazeworld.html priceFor() (line 564). Pure
 * arithmetic, no RNG.
 *
 * DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-05): a Pickpocket's
 * bad — "shopkeepers know your face" — marks up every routed store line
 * x1.25 AFTER the race multiplier, floored at 1 like every other price. A
 * non-Pickpocket (including every existing caller that omits the third
 * argument) gets a value-identical result to before this change.
 */
export function priceFor(base, race, sub = null) {
  const p = race === "Troll" ? base * 3 : race === "Elven" || race === "Dwarven" ? Math.round(base / 2) : base;
  if (sub === "Pickpocket") return Math.max(1, Math.round(p * 1.25));
  return p;
}

// ECON-06 (Phase 14, Economy C): the buy/sell spread. A store buys any carried
// item back for ~50% of its (race-adjusted) buy value. This is a TUNING KNOB —
// Phase 16 (Numbers) tunes the spread. Kept module-local so it is the one place
// the sell discount lives.
const SELL_SPREAD = 0.5;

// ECON-06 FALLBACK base value for treasure items that carry no `cost` yet —
// jewelry, cloaks, and staves (content/treasure-tables.js) have no base value
// today. Phase 15 (item audit) adds real per-item base values; until then this
// documented flat default keeps selling ALWAYS possible (never a 0-gold no-sale)
// for a magic treasure item. Deliberately modest — a real value refines it.
const TREASURE_FALLBACK_VALUE = 200;

// Phase 15 item-wiring (ECON-08): real per-item base (buy) values for the
// jewelry / cloaks / staves that carried NO cost in the content tables — the
// gap Phase 14's baseValueFor documented and fell back on TREASURE_FALLBACK_VALUE
// for. Keyed by the item's DISPLAY NAME (`item.n`) so the values live entirely
// here and NOT as a new field on the treasure-table item objects — that keeps
// the rolled item shapes byte-identical to the frozen prototype master (adding
// a `cost` field to a rolled cloak/jewel/staff would diverge c.items on any
// fixture that rolls one). Values are set roughly in proportion to each item's
// power and are a Phase-16 tuning knob, not frozen. sellPriceFor halves these
// (SELL_SPREAD) and race-adjusts them (priceFor).
const TREASURE_BASE_VALUES = {
  // JEWELRY (content/treasure-tables.js)
  "Ring of Power": 1500,
  "Gauntlet of the Giant": 1200,
  "Amulet of Light": 1000,
  "Pendant of Fortitude": 800,
  "Anklet of Invisibility": 1500,
  "Helm of Knowledge": 900,
  "Bracelet of Flight": 2500,
  "Amulet of Stone": 2000,
  // CLOAKS
  "Cloak of Healing": 1200,
  "Cloak of Strength": 1500,
  "Cloak of Invisibility": 1400,
  "Cloak of Speed": 1600,
  "Cloak of Regeneration": 1400,
  "Cloak of Armor": 2500,
  "Cloak of Flying": 2200,
  "Cloak of Ether": 1800,
  // STAVES (Magic-User only, uniformly potent)
  "Rowan Staff": 2000,
  "Birch Staff": 2200,
  "Walnut Staff": 2000,
  "Oak Staff": 2400,
  "Crystal Staff": 1800,
  "Poplar Staff": 1800,
  "Pine Staff": 2600,
  "Cedar Staff": 2200,
};

/**
 * baseValueFor(item) — the pre-race, pre-spread BUY value of a carried item,
 * derived from the same content tables the store's buy prices use:
 *   - weapon: WEAPONS[base].cost, times the enchant premium (2 + bonus) for a
 *     magic blade (mirrors openStore's premium weapon pricing, economy.js);
 *   - armor:  ARMORS.find(name).cost, doubled for a warded (magic) piece whose
 *     AR exceeds its base (mirrors openStore's premium armor ×2);
 *   - potion: POTIONS[*].price, matched by the store item's "<Name> potion" `n`;
 *   - picks:  the store's lockpick price (450);
 *   - jewelry/cloaks/staves (no base value yet): TREASURE_FALLBACK_VALUE.
 * Pure, no rng, no mutation. Returns a non-negative number.
 */
function baseValueFor(item) {
  if (!item) return 0;
  if (item.kind === "weapon") {
    const base = WEAPONS[item.base] ? WEAPONS[item.base].cost : null;
    if (base == null) return TREASURE_FALLBACK_VALUE;
    return item.bonus ? base * (2 + item.bonus) : base;
  }
  if (item.kind === "armor") {
    const found = ARMORS.find((a) => a.name === item.armor);
    if (!found) return TREASURE_FALLBACK_VALUE;
    // A warded (magic) piece carries a higher AR than its base — reflect the
    // enchant premium (openStore prices magic armor at ×2).
    return item.ar > found.ar ? found.cost * 2 : found.cost;
  }
  if (item.kind === "potion") {
    const p = POTIONS.find((pp) => typeof item.n === "string" && item.n.startsWith(pp.n));
    return p ? p.price : TREASURE_FALLBACK_VALUE;
  }
  if (item.kind === "picks") return 450;
  // Phase 39 (GEAR-05): a tool's buy cost (content/tools.js#TOOLS), never
  // the flat fallback — every tool has a real authored price.
  if (item.kind === "tool") return TOOLS[item.tool]?.cost ?? TREASURE_FALLBACK_VALUE;
  // jewelry, cloaks, staves (Phase 15, ECON-08): read the real per-item base
  // value from the name-keyed TREASURE_BASE_VALUES table above; only an
  // unrecognised/renamed treasure item now falls back to the flat default.
  if (item.kind === "jewel" || item.kind === "cloak" || item.kind === "staff") {
    return TREASURE_BASE_VALUES[item.n] ?? TREASURE_FALLBACK_VALUE;
  }
  return TREASURE_FALLBACK_VALUE;
}

/**
 * sellPriceFor(item, race, sub = null) — what a store PAYS for a carried
 * item: ~50% of its buy value (SELL_SPREAD), race-adjusted through the
 * existing priceFor (trolls pay/receive triple, elves/dwarves half). Always
 * at least 1 so a sale never yields nothing. Pure, no rng. Phase 16 tunes
 * SELL_SPREAD; Phase 15 refines the treasure base values baseValueFor falls
 * back on.
 *
 * DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-05): a Pickpocket
 * sells back at x0.75 of the ORDINARY sell price (never applied to the
 * marked-up buy value — `priceFor(..., race)` here deliberately omits
 * `sub`, since the markdown rides the same base every other race sells
 * from). A non-Pickpocket (including every existing 2-argument caller) gets
 * a value-identical result to before this change.
 */
export function sellPriceFor(item, race, sub = null) {
  const buy = priceFor(baseValueFor(item), race);
  return Math.max(1, Math.round(buy * SELL_SPREAD * (sub === "Pickpocket" ? 0.75 : 1)));
}

/**
 * sellItem(state, i, events) — sell carried item `i` at a store (ECON-06). Pure,
 * NO rng: splices c.items[i] (freeing a slot), credits c.gold by
 * sellPriceFor(item, race), then runs the Phase-12 GATED clamp (clampCarry — a
 * no-op when the character carries no bag) so the credited gold never exceeds
 * the bag's wilmst cap. No-op on an out-of-range index. Pushes `itemSold`.
 * Not driven by any parity fixture (no rng, new action) — parity-safe.
 */
export function sellItem(state, i, events = []) {
  const c = state.c;
  const it = (c.items || [])[i];
  if (!it) return events;
  const price = sellPriceFor(it, c.race, c.sub);
  c.items.splice(i, 1);
  c.gold += price;
  // Phase-12 gated clamp: shrinks c.gold to BAGS[c.bag].wilmst when over-cap,
  // and is a COMPLETE no-op for a bag-less (parity/test) character.
  clampCarry(c);
  events.push({ type: "itemSold", item: it, price });
  return events;
}

// DELIBERATE RULES CHANGE (04.1-03, RATION-01): rations are their own
// purchasable resource, decoupled from HP-restoring food. Previously every
// food purchase silently added +1 ration regardless of the food's price or
// wp value (04.1-RESEARCH.md "the food/rations tangle"). This is a
// deliberate, fixed design value — one ration for 30 gold, race-adjusted via
// priceFor like every other store price.
const RATIONS_BASE_PRICE = 30;

/**
 * STORE_EFFECTS — effectId → (state, params, events) => void. The engine-
 * side replacement for every stock entry's `buy` closure. Never stored on
 * `state` itself; `buyFrom` looks the effect up here by the plain-data
 * `effectId` string carried on the sold stock entry.
 */
export const STORE_EFFECTS = {
  eatRation(state, params, events) {
    // DELIBERATE RULES CHANGE (04.1-03, RATION-01): food purchases are now
    // PURE HP healing — the old silent `c.rations++` side effect is removed.
    // Rations are bought separately via the dedicated buyRations effect below.
    const c = state.c;
    c.wp = Math.min(c.maxWP, c.wp + params.wp);
  },
  buyRations(state, params, events) {
    // DELIBERATE RULES CHANGE (04.1-03, RATION-01): the dedicated, visible
    // ration purchase — replaces the old silent food-side-effect ration gain.
    const c = state.c;
    const amount = params.amount ?? 1;
    c.rations += amount;
    events.push({ type: "rationsBought", amount });
  },
  givePotion(state, params, events) {
    // Potions are slot-exempt (LOOT-04) — deliberately uncapped, unlike
    // giveLockpicks below.
    giveItem(state, params.item, false, events);
  },
  giveLockpicks(state, params, events) {
    stowItem(state, params.item, events, false);
  },
  giveTool(state, params, events) {
    stowItem(state, params.item, events, false);
  },
  repairArmor(state, params, events) {
    state.c.armorWP = state.c.armorMax;
  },
  buyWeapon(state, params, events) {
    takeItem(state, params.item, events);
  },
  buyArmor(state, params, events) {
    takeItem(state, params.item, events);
  },
  buyScroll(state, params, events) {
    state.c.scrolls = (state.c.scrolls || 0) + 1;
  },
  buyPremium(state, params, events) {
    takeItem(state, params.item, events);
  },
};

// Phase 33 (STORE-01) — depth-tier helpers for the guarded store re-roll.
// All pure, no rng inside except where explicitly stated (storePotionPool/
// storeWeaponPool return FRESH arrays; the caller shuffles them).

// STORE_TIER_FLOORS — derived, not restated: the single source of truth for
// the depth-tier ladder stays content/bags.js#BAG_FLOORS.
export const STORE_TIER_FLOORS = [BAG_FLOORS.medium, BAG_FLOORS.large, BAG_FLOORS.exlarge];

/** storeTier(depth) — 0 (depth 1), 1 (2-4), 2 (5-8), 3 (9+); non-finite input treated as depth 1 (tier 0). */
export function storeTier(depth) {
  const d = Number.isFinite(depth) ? depth : 1;
  return STORE_TIER_FLOORS.filter((f) => d >= f).length;
}

/** storePotionPool(tier) — a FRESH array of POTIONS entries from the STORE_POTION_POOL allow-list (never raw POTIONS — the trap potion is never in the allow-list). Fresh because rng.shuffle mutates in place. */
export function storePotionPool(tier) {
  return STORE_POTION_POOL.filter((e) => e.from <= tier).map((e) => POTIONS.find((p) => p.n === e.n));
}

/** storeWeaponPool(letter, tier) — a FRESH array of class-legal weapon names inside the tier's cost band; falls back to every class-legal weapon at or under the band's ceiling when the strict band holds fewer than 2. */
export function storeWeaponPool(letter, tier) {
  const legal = Object.keys(WEAPONS).filter((w) => WEAPONS[w].cls.includes(letter));
  const band = STORE_WEAPON_BANDS[tier];
  let pool = legal.filter((w) => WEAPONS[w].cost >= band.lo && WEAPONS[w].cost <= band.hi);
  if (pool.length < 2) pool = legal.filter((w) => WEAPONS[w].cost <= band.hi);
  return pool;
}

/** storeArmorFor(mails, tier) — given openStore's already-filtered `mails` (class-legal, ar > c.ar, canEquipArmor, ascending ar order), the best entry at or under the tier's STORE_ARMOR_CAP, or null when none fits. No rng. */
export function storeArmorFor(mails, tier) {
  const capIdx = ARMORS.findIndex((a) => a.name === STORE_ARMOR_CAP[tier]);
  const eligible = mails.filter((a) => ARMORS.indexOf(a) <= capIdx);
  return eligible.length ? eligible[eligible.length - 1] : null;
}

/** enchantForTier(premium, tier) — a NEW object (never mutates its input, consumes no rng) with the enchantment bonus re-derived from STORE_PREMIUM_BONUS[tier]. */
export function enchantForTier(premium, tier) {
  const b = STORE_PREMIUM_BONUS[tier];
  if (premium.kind === "weapon") {
    return { ...premium, bonus: b, txt: `${WEAPONS[premium.base].lab} +${b}` };
  }
  const a = ARMORS.find((x) => x.name === premium.armor) || ARMORS[0];
  return { ...premium, ar: a.ar + b, wp: a.wp + 10 * b, txt: `AR ${a.ar + b}, ${a.wp + 10 * b} hp` };
}

/** replaceStockLines(stock, pred, lines) — splices `lines` in at the position of the FIRST match of `pred`, removing every match; a no-op (stock unchanged) when nothing matches, so a line the flag-off store never had is never introduced. */
export function replaceStockLines(stock, pred, lines) {
  const at = stock.findIndex(pred);
  if (at === -1) return stock;
  for (let i = stock.length - 1; i >= 0; i--) {
    if (pred(stock[i])) stock.splice(i, 1);
  }
  stock.splice(at, 0, ...lines);
  return stock;
}

/**
 * openStore(state, rng, events) — builds `state.store = {stock, haggle,
 * race}` from plain-data stock entries. Ports mazeworld.html openStore()
 * (lines 2005-2050): food/potion/lockpick offers, armor repair, two random
 * class-legal weapons, the best class-legal armor upgrade, a Magic User's
 * scroll, and the one premium enchanted item (a d2 pick between a magic
 * weapon and magic armor). Haggle (Wilmsry, -30%) is applied last, exactly
 * as the prototype does.
 *
 * Phase 33 (STORE-01): when `state.storeRoll === true` (a run the SHELL
 * started — see engine/state.js#newRun / src/browser/engineAdapter.js
 * #startNewRun), the potion/weapon/armor/premium lines are re-rolled
 * depth-appropriately by storeTier(d) AFTER every draw below — see the
 * guarded block near the end of this function. Every parity fixture, unit
 * pin and old save reads storeRoll false and never enters that block, so
 * this function's flag-off output is byte-identical to before Phase 33.
 * Note: `rollBlade(rng, d, true)` below never actually reads its own
 * `depth` argument (a pre-existing dead parameter, not introduced by this
 * phase) — the Phase 33 depth scaling for the premium item lives in
 * enchantForTier, not in rollBlade itself.
 */
export function openStore(state, rng, events = []) {
  const stock = [];
  const c = state.c;
  const d = state.floor.depth;
  const race = c.race;
  const letter = c.cls === "Fighter" ? "F" : c.cls === "Thief" ? "T" : "M";
  const mk = (n, cost, effectId, effectParams, sub) => ({ n, sub: sub ?? null, cost: Math.max(1, Math.round(cost)), effectId, effectParams: effectParams ?? null, sold: false });
  const add = (...args) => stock.push(mk(...args));

  // Phase 33 (STORE-01): builders shared by both the flag-off path below and
  // the guarded flag-on rewrite near the end of this function — same object
  // shape, same argument expressions, so the flag-off output is unchanged.
  const potionLine = (p) =>
    mk(`${p.n} potion`, p.price, "givePotion", { item: { kind: "potion", n: `${p.n} potion`, txt: p.txt, eff2: p.eff, uses: 1 } }, p.txt);
  const weaponLine = (w) =>
    mk(
      w,
      priceFor(WEAPONS[w].cost, race, c.sub) * (race === "Troll" ? 2 : 1),
      "buyWeapon",
      { item: { kind: "weapon", n: w, base: w, bonus: 0, txt: WEAPONS[w].lab } },
      WEAPONS[w].lab,
    );
  const armorLine = (a) =>
    mk(
      a.name,
      priceFor(a.cost, race, c.sub),
      "buyArmor",
      { item: { kind: "armor", n: a.name, armor: a.name, ar: a.ar, wp: a.wp, min: a.min, cls: a.cls, txt: `AR ${a.ar}` } },
      `AR ${a.ar}, ${a.wp} hp`,
    );
  const premiumLine = (p) => {
    const pCost =
      p.kind === "weapon"
        ? priceFor((WEAPONS[p.base] || { cost: 500 }).cost, race, c.sub) * (2 + p.bonus)
        : priceFor((ARMORS.find((a) => a.name === p.armor) || ARMORS[0]).cost, race, c.sub) * 2;
    return mk(p.n, pCost, "buyPremium", { item: p }, `${p.txt} · enchanted`);
  };

  for (const f of [FOODS[0], FOODS[1], FOODS[5]]) add(`${f.n} (+${f.wp} hp)`, f.cost, "eatRation", { wp: f.wp });
  for (const p of [POTIONS[0], POTIONS[3], POTIONS[4], POTIONS[2]]) stock.push(potionLine(p));
  if (!hasPicks(c))
    add("Set of lockpicks", 450, "giveLockpicks", { item: { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" } }, "opens boxes on 1–5");

  // "The stores will all repair armor for 1/10 of the cost of your armor per point repaired."
  if (c.armorWP > 0 && c.armorWP < c.armorMax) {
    const base = (ARMORS.find((a) => a.name === c.armor) || ARMORS[0]).cost;
    const pts = c.armorMax - c.armorWP;
    add(`Repair your ${c.armor.toLowerCase()}`, (priceFor(base, race, c.sub) / 10) * pts, "repairArmor", null, `${pts} points at a tenth of its cost each`);
  }

  const arms = Object.keys(WEAPONS).filter((w) => WEAPONS[w].cls.includes(letter));
  rng.shuffle(arms);
  for (const w of arms.slice(0, 2)) stock.push(weaponLine(w));

  // DELIBERATE RULES CHANGE (Phase 24, 2026-09-14, IDENT-07): a Woodsman's
  // "no mail, no plate" bad — the store never even OFFERS an armour line
  // the buyer cannot legally wear. canEquipArmor already covers the noArmor
  // race gate (kept as an explicit `&&` below purely for readability), so
  // every non-Woodsman hero's filtered result is unchanged.
  const mails = ARMORS.filter((a) => a.cls.includes(letter) && a.ar > c.ar && canEquipArmor(c, a));
  if (mails.length && !RACES[race].noArmor) {
    const a = mails[0];
    stock.push(armorLine(a));
  }

  if (c.cls === "Magic User") add("Sealed scroll", 900, "buyScroll", null);

  // one thing on the shelf you cannot simply buy
  const premium = rng.d(2) === 1 ? rollBlade(rng, d, true) : rollMailPiece(rng);
  stock.push(premiumLine(premium));

  // Phase 33 (STORE-01, CONTEXT Area 3): depth-rolled stock, ONLY on a run
  // whose newRun set storeRoll (engine/state.js; the shell's startNewRun) —
  // every parity fixture, unit pin and old save reads false and never
  // enters here. Every new rng draw sits AFTER every existing draw
  // (rng.shuffle(arms) -> rng.d(2) -> rollBlade|rollMailPiece are untouched
  // above), the Phase 29 bagUpgradeTier placement rule, so the flag-off
  // cursor never shifts; the lines are rewritten IN PLACE so
  // food/potions/picks/repair/weapons/armor/scroll/premium/Rations keep
  // their positions. Draw count flag-on = flag-off + (pPool.length - 1) +
  // (wPool.length - 1) (rng.shuffle is n-1 draws) — pinned by
  // test/unit/store-roll.test.js.
  if (state.storeRoll === true) {
    const tier = storeTier(d);
    const pPool = storePotionPool(tier);
    rng.shuffle(pPool);
    const wPool = storeWeaponPool(letter, tier);
    rng.shuffle(wPool);
    replaceStockLines(stock, (l) => l.effectId === "givePotion" && l.effectParams.item.eff2 !== "heal", pPool.slice(0, 3).map(potionLine));
    replaceStockLines(stock, (l) => l.effectId === "buyWeapon", wPool.slice(0, 2).map(weaponLine));
    const capped = storeArmorFor(mails, tier);
    replaceStockLines(stock, (l) => l.effectId === "buyArmor", capped ? [armorLine(capped)] : []);
    replaceStockLines(stock, (l) => l.effectId === "buyPremium", [premiumLine(enchantForTier(premium, tier))]);
  }

  // RATION-01: Rations are their own store line, decoupled from HP-restoring
  // food. `add()` consumes no rng, so appending it here does not shift the
  // rng.shuffle(arms)/rng.d(2)/rollBlade/rollMailPiece draw order above —
  // it is placed last (rather than among the food adds) purely to preserve
  // the existing stock array's index positions for every other item, which
  // test/parity/fixtures/action-script.economy.json's buyItem actions
  // reference by hand-verified index against the frozen prototype's stock
  // (which has no Rations line at all — see comparables.js's stripStoreClosures).
  add("Rations (+1 ration)", priceFor(RATIONS_BASE_PRICE, race, c.sub), "buyRations", { amount: 1 });

  // Phase 39 (GEAR-05): the three one-shot tools, offered like the lockpick
  // line above — flat price (no priceFor route, so a Pickpocket's buy
  // markup never applies), depth-tier gated (Torch/Rope from tier 0, Ladder
  // from tier 1), and only when not already carried (mirrors `!hasPicks(c)`
  // above). Appended LAST (after Rations) so every existing stock index
  // built above stays stable; zero rng draws either way.
  for (const key of TOOL_ORDER) {
    if (TOOLS[key].fromTier <= storeTier(d) && !hasTool(c, key)) {
      add(TOOLS[key].n, TOOLS[key].cost, "giveTool", { item: toolItem(key) }, TOOLS[key].txt);
    }
  }

  const haggle = race === "Wilmsry" ? 0.7 : 1;
  if (haggle < 1) stock.forEach((x) => (x.cost = Math.round(x.cost * haggle)));

  state.store = { stock, haggle, race };
  state.beats = null;
  events.push({
    type: "storeOpened",
    depth: d,
    race,
    haggle,
    troll: race === "Troll",
    elfOrDwarf: race === "Elven" || race === "Dwarven",
    pickpocket: c.sub === "Pickpocket",
  });
  return events;
}

// Phase 29 (LOOT-04, RESEARCH Pitfall 1): effectIds whose STORE_EFFECTS
// handler lands a slot-consuming item in the bag. buyFrom below checks
// canStow for these BEFORE deducting gold, so a full-bag buy never spends
// gold or marks the stock slot sold. givePotion is deliberately absent —
// potions are slot-exempt (LOOT-04) — as are buyWeapon/buyArmor/buyPremium
// (they equip-or-reject via takeItem, consuming no slot either way) and
// buyScroll/buyRations/repairArmor/eatRation (scalar effects, no bag write).
const STOWING_EFFECTS = new Set(["giveLockpicks", "giveTool"]);

/**
 * buyFrom(state, idx, events) — purchases stock slot `idx`: bounds/sold/
 * gold-sufficiency guards (T-01-10b — an invalid buy is a no-op, never a
 * throw), deducts gold, marks the slot sold, then applies the plain-data
 * effect via STORE_EFFECTS. Never calls or stores a function on `state`.
 * Ports mazeworld.html buyFrom() (lines 2051-2061).
 *
 * Phase 29 (LOOT-04): for a STOWING_EFFECTS entry, the stow gate is checked
 * BEFORE any gold is deducted or the slot is marked sold — a refused stow
 * (full bag) is a pure no-op plus one `bagFull` event, never a silent
 * gold-loss (RESEARCH Pitfall 1).
 */
export function buyFrom(state, idx, events = []) {
  const st = state.store;
  if (!st) return events;
  const item = st.stock[idx];
  if (!item || item.sold) return events;
  if (state.c.gold < item.cost) {
    events.push({ type: "buyFailed", reason: "insufficientGold", short: item.cost - state.c.gold });
    return events;
  }
  if (STOWING_EFFECTS.has(item.effectId) && !canStow(state.c)) {
    events.push({
      type: "bagFull",
      item: item.effectParams && item.effectParams.item,
      have: slotItems(state.c).length,
      slots: bagCap(state.c),
    });
    return events;
  }
  state.c.gold -= item.cost;
  item.sold = true;
  events.push({ type: "bought", item: item.n, cost: item.cost });
  const effect = STORE_EFFECTS[item.effectId];
  if (effect) effect(state, item.effectParams, events);
  return events;
}

/**
 * leaveStore(state, events) — closes the shop. Ports mazeworld.html
 * leaveStore() (line 2062).
 */
export function leaveStore(state, events = []) {
  state.store = null;
  events.push({ type: "storeLeft" });
  return events;
}
