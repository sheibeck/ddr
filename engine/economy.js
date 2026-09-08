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

import { giveItem, takeItem, hasPicks, rollBlade, rollMailPiece } from "./items.js";
import { WEAPONS, ARMORS, FOODS, POTIONS, RACES } from "../content/index.js";

/**
 * priceFor(base, race) — "Costs are triple for trolls, and half for elves
 * or dwarves." Ports mazeworld.html priceFor() (line 564). Pure arithmetic,
 * no RNG.
 */
export function priceFor(base, race) {
  if (race === "Troll") return base * 3;
  if (race === "Elven" || race === "Dwarven") return Math.round(base / 2);
  return base;
}

/**
 * STORE_EFFECTS — effectId → (state, params, events) => void. The engine-
 * side replacement for every stock entry's `buy` closure. Never stored on
 * `state` itself; `buyFrom` looks the effect up here by the plain-data
 * `effectId` string carried on the sold stock entry.
 */
export const STORE_EFFECTS = {
  eatRation(state, params, events) {
    const c = state.c;
    c.wp = Math.min(c.maxWP, c.wp + params.wp);
    c.rations++;
  },
  givePotion(state, params, events) {
    giveItem(state, params.item, false, events);
  },
  giveLockpicks(state, params, events) {
    giveItem(state, params.item, false, events);
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

/**
 * openStore(state, rng, events) — builds `state.store = {stock, haggle,
 * race}` from plain-data stock entries. Ports mazeworld.html openStore()
 * (lines 2005-2050): food/potion/lockpick offers, armor repair, two random
 * class-legal weapons, the best class-legal armor upgrade, a Magic User's
 * scroll, and the one premium enchanted item (a d2 pick between a magic
 * weapon and magic armor). Haggle (Wilmsry, -30%) is applied last, exactly
 * as the prototype does.
 */
export function openStore(state, rng, events = []) {
  const stock = [];
  const c = state.c;
  const d = state.floor.depth;
  const race = c.race;
  const letter = c.cls === "Fighter" ? "F" : c.cls === "Thief" ? "T" : "M";
  const add = (n, cost, effectId, effectParams, sub) =>
    stock.push({ n, sub: sub ?? null, cost: Math.max(1, Math.round(cost)), effectId, effectParams: effectParams ?? null, sold: false });

  for (const f of [FOODS[0], FOODS[1], FOODS[5]]) add(`${f.n} (+${f.wp} wp)`, f.cost, "eatRation", { wp: f.wp });
  for (const p of [POTIONS[0], POTIONS[3], POTIONS[4], POTIONS[2]])
    add(`${p.n} potion`, p.price, "givePotion", { item: { kind: "potion", n: `${p.n} potion`, txt: p.txt, eff2: p.eff, uses: 1 } }, p.txt);
  if (!hasPicks(c))
    add("Set of lockpicks", 450, "giveLockpicks", { item: { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" } }, "opens boxes on 1–5");

  // "The stores will all repair armor for 1/10 of the cost of your armor per point repaired."
  if (c.armorWP > 0 && c.armorWP < c.armorMax) {
    const base = (ARMORS.find((a) => a.name === c.armor) || ARMORS[0]).cost;
    const pts = c.armorMax - c.armorWP;
    add(`Repair your ${c.armor.toLowerCase()}`, (priceFor(base, race) / 10) * pts, "repairArmor", null, `${pts} points at a tenth of its cost each`);
  }

  const arms = Object.keys(WEAPONS).filter((w) => WEAPONS[w].cls.includes(letter));
  rng.shuffle(arms);
  for (const w of arms.slice(0, 2))
    add(
      w,
      priceFor(WEAPONS[w].cost, race) * (race === "Troll" ? 2 : 1),
      "buyWeapon",
      { item: { kind: "weapon", n: w, base: w, bonus: 0, txt: WEAPONS[w].lab } },
      WEAPONS[w].lab,
    );

  const mails = ARMORS.filter((a) => a.cls.includes(letter) && a.ar > c.ar);
  if (mails.length && !RACES[race].noArmor) {
    const a = mails[0];
    add(
      a.name,
      priceFor(a.cost, race),
      "buyArmor",
      { item: { kind: "armor", n: a.name, armor: a.name, ar: a.ar, wp: a.wp, min: a.min, cls: a.cls, txt: `AR ${a.ar}` } },
      `AR ${a.ar}, ${a.wp} wp`,
    );
  }

  if (c.cls === "Magic User") add("Sealed scroll", 900, "buyScroll", null);

  // one thing on the shelf you cannot simply buy
  const premium = rng.d(2) === 1 ? rollBlade(rng, d, true) : rollMailPiece(rng);
  const pCost =
    premium.kind === "weapon"
      ? priceFor((WEAPONS[premium.base] || { cost: 500 }).cost, race) * (2 + premium.bonus)
      : priceFor((ARMORS.find((a) => a.name === premium.armor) || ARMORS[0]).cost, race) * 2;
  add(premium.n, pCost, "buyPremium", { item: premium }, `${premium.txt} · enchanted`);

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
  });
  return events;
}

/**
 * buyFrom(state, idx, events) — purchases stock slot `idx`: bounds/sold/
 * gold-sufficiency guards (T-01-10b — an invalid buy is a no-op, never a
 * throw), deducts gold, marks the slot sold, then applies the plain-data
 * effect via STORE_EFFECTS. Never calls or stores a function on `state`.
 * Ports mazeworld.html buyFrom() (lines 2051-2061).
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
