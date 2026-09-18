// content/tools.js
//
// Phase 39 (GEAR-05): the three one-shot hazard tools — Rope, Ladder,
// Torch. Each answers exactly one hazard and is consumed on use. A
// `kind:"tool"` bag item (engine/items.js#toolItem) — one bag slot each
// (bagCap applies via engine/derived.js#slotItems), never stacks (a second
// is refused `itemRejected {reason:"haveOne"}`, mirroring the Lockpicks
// `kind:"picks"` precedent — engine/items.js#hasPicks/rollTreasureItem's
// lockpick gate).
//
// `feat` names the hazard TILE (engine/movement.js) a tool answers:
// rope -> "gorge", ladder -> "climb". Rope/Ladder are spent through
// engine/movement.js#useTool (the pre-roll hazard decision), never
// engine/items.js#useItem — they carry no `use` key. The Torch instead
// carries `use: "light"` and is spent through the SAME useItem path every
// other consumable uses (it has no `feat` — it answers `c.darkFor`
// darkness, not a movement tile); its activation record
// (`TOOL_ACTIVATION_OF.Torch`, spread into content/activations.js#
// ACTIVATION_OF alongside TREASURE_ACTIVATION_OF/POTION_ACTIVATION_OF)
// declares a 40-square `lit` effect with no cooldown — a one-shot
// consumable, comfortably under the once-a-day rule (effect 40 <= 100).
//
// TOOLS itself (cost/fromTier/feat/txt) is store/loot/engine-gate content
// ONLY — engine/items.js#toolItem strips cost/fromTier/feat before building
// the bag item, so a rolled/bought tool's shape never carries them (keeps
// every future parity fixture that rolls one lean, matching the
// treasure-tables.js `slot`/`act`-stripping precedent).
//
// Pure data — no functions (test/determinism/content-is-pure-data.test.js).

export const TOOLS = {
  torch: {
    n: "Torch",
    cost: 25,
    fromTier: 0,
    use: "light",
    txt: "lights the dark once, and keeps it off for forty squares",
  },
  rope: {
    n: "Rope",
    cost: 60,
    fromTier: 0,
    feat: "gorge",
    txt: "the honest way across a crevice. Once.",
  },
  ladder: {
    n: "Ladder",
    cost: 150,
    fromTier: 1,
    feat: "climb",
    txt: "one climbable wall, no climbing. Once.",
  },
};

/** TOOL_ORDER — the store-line / loot-candidate walk order. */
export const TOOL_ORDER = ["torch", "rope", "ladder"];

/** TOOL_LOOT_WEIGHTS — engine/items.js#pickLootTool's weighted pick,
 * torch commonest (hazard-density-weighted per 39-CONTEXT.md Area 1). */
export const TOOL_LOOT_WEIGHTS = { torch: 4, rope: 3, ladder: 1 };

/** TOOL_ACTIVATION_OF — spread into content/activations.js#ACTIVATION_OF.
 * The torch is the ONLY tool with an activation record (rope/ladder are
 * instant, spent through useTool, never useItem). */
export const TOOL_ACTIVATION_OF = Object.freeze({
  Torch: { kind: "lit", effect: 40 },
});
