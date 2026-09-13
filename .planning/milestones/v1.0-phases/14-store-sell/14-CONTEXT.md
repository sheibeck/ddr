# Phase 14: Store Sells All Gear (Economy C) — Context

**Gathered:** 2026-09-09 (autonomous). **Requirements:** ECON-06, ECON-07 (E2).
**Research:** `.planning/research/economy-SUMMARY.md` §3. Depends on Phases 12–13. Baseline: **640/640**, parity 25/25.

## Phase boundary
- **DOES:** let the player SELL any carried item at a store (store lists all carried gear + sell prices), and surface combat-usable carried items in the combat bar (E2). Both reuse ONE carried-item list component.
- **Does NOT:** item wiring/audit (Phase 15 — but this phase adds a base-value FALLBACK for pricing), numbers tuning (Phase 16 tunes the sell spread).

## Tasks
1. **`sellItem{i}` action** (pure, NO rng) — add to `engine/economy.js`, register in `engine/actions.js` ACTION_TYPES (with an `i` non-negative-int guard mirroring `useItem`/`dropItem`) + a dispatch case in `engine/engine.js`. Removes `c.items[i]`, credits `c.gold` by `sellPriceFor(...)` (clamped to the bag wilmst cap via the Phase-12 gated clamp), pushes `itemSold`.
2. **`sellPriceFor(item, race)`** helper (in `economy.js`) — sell ≈ **50%** of the item's buy value, race-adjusted via the existing `priceFor` (`economy.js:26`). Derive the base value: weapons from `WEAPONS[base].cost`, armor from `ARMORS.find(...).cost`, potions from `POTIONS[*].price`, magic gear from its roll cost if present. **For treasure items with NO `cost`/base value yet** (jewelry/cloaks/staves — Phase 15 adds real base values), use a reasonable FALLBACK (e.g. a small flat value or a depth-agnostic default) so selling always works; note in-code that Phase 15 refines these. The 50% spread is a tuning knob (Phase 16).
3. **Store UI — "Your gear" sell section** (`mazeworld.html`, presentation): extend the existing engine-driven store render (`renderEncounter`'s store branch) with a section listing `c.items` (reuse the GEAR-tab carried-item render) with a **Sell** button per item dispatching `{type:"sellItem", i}` (bridge `window.mzSellItem` mirroring `mzBuyItem`). Selling frees a slot + credits gold; re-render.
4. **E2 — combat-bar use-list:** surface combat-usable carried items (potions/staves/scrolls — the `useItem` action is already wired: `engine/items.js` + `engine/engine.js:86`, and the GEAR tab already has a Use button) in the COMBAT action bar (`renderEncounter`'s combat branch), so the player can use them mid-fight. Bridge `window.mzUseItem(i)` → `dispatch({type:"useItem", i})`. Only show items whose effect is combat-relevant (heal/buff/offense — reuse the same filter the GEAR Use button uses, or a simple `it.kind==="potion" || it.use` predicate).
5. **Shared component:** author ONE carried-item list renderer used by BOTH the store-sell section and the combat-bar use-list (and ideally the GEAR tab) so the gear list isn't built three times. Each host passes the per-item action (Sell / Use / Equip+Drop).

## Determinism / parity
`sellItem` + `useItem`-in-combat are pure/no-rng, not in any parity fixture → zero parity impact. `sellPriceFor` is pure. No new serialized fields. Full `npm test` must stay green (640).

## Success criteria (gate)
1. At a store, all carried gear is listed with sell prices; selling any item frees its slot + credits gold (bag-cap clamped) (ECON-06).
2. Combat-usable carried items are usable from the combat bar, sharing one list component with the store-sell list (ECON-07/E2).
3. Sell pricing works for every item type (real base values where they exist, a documented fallback for treasure items pending Phase 15).
4. **Parity gate:** `npm test` green (640+), parity byte-identical (no fixture touched, no serialized field added).

## Hard constraints
Engine pure/deterministic; sell/use pure no-rng; gold-cap clamp via the Phase-12 gated clamp only; new `itemSold` event gets an `EVENT_NARRATION` entry; reuse `useItem` (don't add a new use action); no field/existing-event renames; no git; no build/deploy (orchestrator); no SUMMARY.md (policy).
