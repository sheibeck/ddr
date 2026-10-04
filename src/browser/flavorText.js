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
// Phase 96 (FLAVOR-03; CONTEXT 'Good and bad are guarded by tags') appends the
// identity and ability domains: race, sub, class, ability, skill and chip. An
// identity domain's content export is a map of records `{ line, good, bad }`
// (race, sub-class) or plain strings (class): `lines()` still returns a plain
// `{ key: string }` map so every shared scan runs unchanged, and `tags()`
// returns the raw record map the tag guard reads (the ids are
// identityEntries ids from src/browser/identityFooter.js).
//
// Pure: no window or document, no rng, never throws, never mutates.
// See docs/TEXT-LAYERS.md.

import * as C from "../../content/index.js";

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const names = (rows) => rows.map((r) => r.n);

const frozenScroll = (s) => (typeof s === "string" ? Object.freeze({ Scroll: s }) : undefined);
const asMap = (m) => (m && typeof m === "object" && !Array.isArray(m) ? m : undefined);

/**
 * identityDomain(spec) — a frozen domain record for a content export that is a
 * map of identity records `{ line, good, bad, neutral? }`. `spec` is `{ id,
 * module, exportName, keys, read }`, `read()` giving the raw export (or
 * undefined while it is absent). `lines()` builds a FRESH plain `{ key: line }`
 * map of the records' `line` strings (undefined while the export is absent, not
 * an object or an array); `tags()` returns the raw record map (undefined when
 * absent). Pure; never throws on a hostile export.
 */
export function identityDomain(spec) {
  const raw = () => {
    try {
      return asMap(spec.read());
    } catch {
      return undefined;
    }
  };
  return Object.freeze({
    id: spec.id,
    module: spec.module,
    exportName: spec.exportName,
    keys: spec.keys,
    lines: () => {
      try {
        const m = raw();
        if (!m) return undefined;
        const out = {};
        for (const k of Object.keys(m)) {
          const r = m[k];
          out[k] = r && typeof r === "object" && !Array.isArray(r) ? r.line : r;
        }
        return out;
      } catch {
        return undefined;
      }
    },
    tags: raw,
  });
}

/**
 * FLAVOR_DOMAINS — the ten flavour domains so far, in order (eight from
 * Phase 95, then race and class; 96-02 and later append sub, ability, skill
 * and chip). Each record:
 * `id`, `module` (the content file that exports the map), `exportName`,
 * `keys()` (a fresh array of the content keys the map must cover, read from
 * the live content tables) and `lines()` (the map, or undefined while the
 * export is absent). An identity domain also has `tags()`. Phase 96 appends
 * race, sub, class, ability, skill and chip.
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
  // Phase 96 (FLAVOR-03): the identity domains. A race is a tagged record; a
  // class is a plain string with no tags (it has no identity good and bad).
  identityDomain({
    id: "race",
    module: "content/flavor.js",
    exportName: "RACE_FLAVOR",
    keys: () => Object.keys(C.RACES),
    read: () => C.RACE_FLAVOR,
  }),
  Object.freeze({
    id: "class",
    module: "content/flavor.js",
    exportName: "CLASS_FLAVOR",
    keys: () => Object.keys(C.CLASSES),
    lines: () => asMap(C.CLASS_FLAVOR),
  }),
]);

const str = (v) => (typeof v === "string" && v ? v : null);

const EMPTY_TAGS = Object.freeze({ good: Object.freeze([]), bad: Object.freeze([]), neutral: "" });

/** idList(v) — a frozen copy of the string ids in `v` (a non-array reads as none). */
const idList = (v) => Object.freeze(Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);

/**
 * tagsOfRecord(record) — the frozen `{ good, bad, neutral }` of one identity
 * record (id arrays; `neutral` an id or ""). A non-record reads all-empty.
 * Never throws, never mutates.
 */
export function tagsOfRecord(record) {
  try {
    if (!record || typeof record !== "object" || Array.isArray(record)) return EMPTY_TAGS;
    return Object.freeze({ good: idList(record.good), bad: idList(record.bad), neutral: str(record.neutral) || "" });
  } catch {
    return EMPTY_TAGS;
  }
}

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
 * flavorOfIdentity(kind, key) — the flavour line for an identity: kind "race",
 * "sub" or "class", key the race, sub-class or class name. "" for an unknown
 * kind or key, or while the map is absent. Never throws.
 */
export function flavorOfIdentity(kind, key) {
  if (kind !== "race" && kind !== "sub" && kind !== "class") return "";
  return flavorOf(kind, key);
}

/**
 * flavorTagsOf(kind, key) — the frozen `{ good, bad, neutral }` identity ids
 * the line of a race or sub-class hints at. All-empty for an unknown kind or
 * key, for a class (plain strings, no tags) and while the map is absent.
 * Never throws, never mutates.
 */
export function flavorTagsOf(kind, key) {
  try {
    if (kind !== "race" && kind !== "sub") return EMPTY_TAGS;
    const d = FLAVOR_DOMAINS.find((x) => x.id === kind);
    if (!d || typeof d.tags !== "function" || typeof key !== "string") return EMPTY_TAGS;
    const m = d.tags();
    if (!m || !has(m, key)) return EMPTY_TAGS;
    return tagsOfRecord(m[key]);
  } catch {
    return EMPTY_TAGS;
  }
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
