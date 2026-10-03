// src/browser/flavorText.js
//
// Phase 95 (FLAVOR-01, FLAVOR-02, FLAVOR-05; CONTEXT 'Data shape and guards'
// and Claude's Discretion item 4): the player layer's lookup.
//
// Two layers. The RULES layer is every row's `txt` plus
// viewModels.js#itemStatLines (and the rules copy such as
// GEAR_COPY.healingDesc): untouched, still pinned by the v2.3 truth guards.
// The PLAYER layer is one frozen keyed flavour map per content file
// (SPELL_FLAVOR, SCROLL_FLAVOR, POTION_FLAVOR, TOOL_FLAVOR, BAG_FLAVOR,
// MAGIC_ITEM_FLAVOR, WEAPON_FLAVOR, ARMOR_FLAVOR), read through this module.
//
// Items NEVER carry flavour. Treasure and bag rows are spread onto rolled
// items (engine/items.js#rollJewel/rollCloak/rollStaff, bagItemFor,
// engine/encounters.js), so a field on a row would be serialized into every
// save. The shell instead looks the line up by name at draw time: an old save
// gets flavour with no save change, and an item this lookup cannot resolve
// reads "" (the surface then shows its rules text as it does today).
//
// Pure: no window or document, no rng, never throws, never mutates.
// See docs/TEXT-LAYERS.md.

import * as C from "../../content/index.js";

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const names = (rows) => rows.map((r) => r.n);

const frozenScroll = (s) => (typeof s === "string" ? Object.freeze({ Scroll: s }) : undefined);
const asMap = (m) => (m && typeof m === "object" && !Array.isArray(m) ? m : undefined);

/**
 * FLAVOR_DOMAINS — the eight flavour domains, in order. Each record:
 * `id`, `module` (the content file that exports the map), `exportName`,
 * `keys()` (a fresh array of the content keys the map must cover, read from
 * the live content tables) and `lines()` (the map, or undefined while the
 * export is absent). Phase 96 appends its domains here.
 */
export const FLAVOR_DOMAINS = Object.freeze([
  Object.freeze({
    id: "spell",
    module: "content/spells.js",
    exportName: "SPELL_FLAVOR",
    keys: () => C.SPELLS.map((s) => s.n),
    lines: () => asMap(C.SPELL_FLAVOR),
  }),
  Object.freeze({
    id: "scroll",
    module: "content/spells.js",
    exportName: "SCROLL_FLAVOR",
    keys: () => ["Scroll"],
    lines: () => frozenScroll(C.SCROLL_FLAVOR),
  }),
  Object.freeze({
    id: "potion",
    module: "content/potions.js",
    exportName: "POTION_FLAVOR",
    keys: () => names(C.POTIONS),
    lines: () => asMap(C.POTION_FLAVOR),
  }),
  Object.freeze({
    id: "tool",
    module: "content/tools.js",
    exportName: "TOOL_FLAVOR",
    keys: () => [...C.TOOL_ORDER.map((k) => C.TOOLS[k].n), "Lockpicks"],
    lines: () => asMap(C.TOOL_FLAVOR),
  }),
  Object.freeze({
    id: "bag",
    module: "content/bags.js",
    exportName: "BAG_FLAVOR",
    keys: () => names(Object.values(C.BAG_ITEMS)),
    lines: () => asMap(C.BAG_FLAVOR),
  }),
  Object.freeze({
    id: "magic",
    module: "content/treasure-tables.js",
    exportName: "MAGIC_ITEM_FLAVOR",
    keys: () => [...names(C.JEWELRY), ...names(C.CLOAKS), ...names(C.STAVES)],
    lines: () => asMap(C.MAGIC_ITEM_FLAVOR),
  }),
  Object.freeze({
    id: "weapon",
    module: "content/weapons.js",
    exportName: "WEAPON_FLAVOR",
    keys: () => Object.keys(C.WEAPONS),
    lines: () => asMap(C.WEAPON_FLAVOR),
  }),
  Object.freeze({
    id: "armor",
    module: "content/armors.js",
    exportName: "ARMOR_FLAVOR",
    keys: () => C.ARMORS.map((a) => a.name),
    lines: () => asMap(C.ARMOR_FLAVOR),
  }),
]);

const str = (v) => (typeof v === "string" && v ? v : null);

/**
 * flavorKeyOf(it) — `{ domain, key }` for an engine item, or `null`. Mirrors
 * engine/derived.js#canonItemText: a potion by its `eff2`, a jewel, cloak or
 * staff by name, a tool by its tool key (else its name), lockpicks as
 * "Lockpicks", a bag by tier (else name), a weapon by `base` (else name), an
 * armour by `armor` (else name). Anything else (a food line, an unknown kind,
 * a non-object, an array) is `null`. Never throws, never mutates `it`.
 */
export function flavorKeyOf(it) {
  try {
    if (!it || typeof it !== "object" || Array.isArray(it)) return null;
    switch (it.kind) {
      case "potion": {
        const p = C.POTIONS.find((row) => row.eff === it.eff2);
        return p ? { domain: "potion", key: p.n } : null;
      }
      case "jewel":
      case "cloak":
      case "staff": {
        const n = str(it.n);
        return n ? { domain: "magic", key: n } : null;
      }
      case "tool": {
        const row = typeof it.tool === "string" && has(C.TOOLS, it.tool) ? C.TOOLS[it.tool] : null;
        const key = row ? row.n : str(it.n);
        return key ? { domain: "tool", key } : null;
      }
      case "picks":
        return { domain: "tool", key: "Lockpicks" };
      case "bag": {
        const row = typeof it.tier === "string" && has(C.BAG_ITEMS, it.tier) ? C.BAG_ITEMS[it.tier] : null;
        const key = row ? row.n : str(it.n);
        return key ? { domain: "bag", key } : null;
      }
      case "weapon": {
        const key = str(it.base) || str(it.n);
        return key ? { domain: "weapon", key } : null;
      }
      case "armor": {
        const key = str(it.armor) || str(it.n);
        return key ? { domain: "armor", key } : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** flavorOf(domainId, key) — the domain's flavour line for `key`, or "" when
 * the map is absent, the key is unknown or the value is not a non-empty string. */
export function flavorOf(domainId, key) {
  try {
    const d = FLAVOR_DOMAINS.find((x) => x.id === domainId);
    if (!d || typeof key !== "string") return "";
    const m = d.lines();
    if (!m || !has(m, key)) return "";
    const v = m[key];
    return typeof v === "string" && v ? v : "";
  } catch {
    return "";
  }
}

/** flavorOfItem(it) — the flavour line for an engine item, or "". */
export function flavorOfItem(it) {
  const k = flavorKeyOf(it);
  return k ? flavorOf(k.domain, k.key) : "";
}

/** flavorOfSpell(name) — the flavour line for a spell name, or "". */
export function flavorOfSpell(name) {
  return flavorOf("spell", name);
}

/** flavorOfScroll() — the one flavour line every scroll shares, or "". */
export function flavorOfScroll() {
  return flavorOf("scroll", "Scroll");
}

/**
 * everyFlavorLine() — a frozen array of frozen `[domainId, key, line]` for
 * every string value of every present map: first in keys() order, then any
 * key of the map keys() lacks (so an orphan stays visible to the scans).
 */
export function everyFlavorLine() {
  const out = [];
  for (const d of FLAVOR_DOMAINS) {
    const m = d.lines();
    if (!m) continue;
    const seen = new Set();
    for (const k of d.keys()) {
      seen.add(k);
      if (has(m, k) && typeof m[k] === "string") out.push(Object.freeze([d.id, k, m[k]]));
    }
    for (const k of Object.keys(m)) {
      if (!seen.has(k) && typeof m[k] === "string") out.push(Object.freeze([d.id, k, m[k]]));
    }
  }
  return Object.freeze(out);
}
