// content/store-stock.js
//
// Phase 33 (STORE-01) — the depth-rolled store's per-tier tables. The TIER
// INDEX (0..3) is computed by engine/economy.js#storeTier as the number of
// BAG_FLOORS floors (content/bags.js: medium 2 / large 5 / exlarge 9) at or
// below floor.depth — the same ladder bag upgrades climb, so the whole game
// has ONE set of depth breakpoints (CONTEXT Area 3: reuse the existing
// bands, invent no new floor table). Every array below is indexed by that
// tier. TUNING KNOBS, same status as BAG_FLOORS. Pure data — no functions,
// no closures — see test/determinism/content-is-pure-data.test.js.

// STORE_POTION_POOL — an explicit ALLOW-LIST, never `POTIONS` itself: the
// trap potion at POTIONS index 8 (eff "death") is deliberately absent and
// must never be added (RESEARCH Pitfall 5). Healing is always stocked and
// lives outside the roll (openStore's fixed line). `from` is the first tier
// (0..3) an entry may roll; pool at tier t = every entry with `from <= t`
// (cumulative: 4 / 7 / 8 / 8 entries), the store draws 3.
export const STORE_POTION_POOL = [
  { n: "Cure Poison", from: 0 },
  { n: "Strength", from: 0 },
  { n: "Cure Disease", from: 0 },
  { n: "Enlarge", from: 0 },
  { n: "Invisible", from: 1 },
  { n: "Speed", from: 1 },
  { n: "Xtra Healing", from: 1 },
  { n: "Acuteness", from: 2 },
];

// STORE_WEAPON_BANDS — WEAPONS base cost, inclusive; deeper = pricier band.
// Fallback: when a class's legal weapons inside the band number fewer than
// 2 (a Magic User's priciest legal weapon costs 250), engine/economy.js's
// storeWeaponPool drops `lo` and uses every legal weapon with cost <= hi.
export const STORE_WEAPON_BANDS = [
  { lo: 0, hi: 250 },
  { lo: 100, hi: 500 },
  { lo: 200, hi: 700 },
  { lo: 400, hi: 900 },
];

// STORE_ARMOR_CAP — the best ARMORS entry (by name) a tier's store will
// stock; the offered line is the BEST class-legal upgrade at or under the
// cap.
export const STORE_ARMOR_CAP = ["Leather", "Studded", "Mail", "Plate"];

// STORE_PREMIUM_BONUS — the enchanted premium item's bonus per tier (+1
// shallow ... +3 deep).
export const STORE_PREMIUM_BONUS = [1, 1, 2, 3];
