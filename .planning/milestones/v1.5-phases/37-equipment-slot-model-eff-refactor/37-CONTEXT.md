# Phase 37: Equipment Slot Model & eff() Refactor - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run, `defer uat to end`) — 3 grey areas proposed, all accepted by the user as recommended

<domain>
## Phase Boundary

A player can wear only one item per slot type (ring, bracelet/anklet, amulet/pendant, helm/gauntlet, cloak, staff); equipping into an occupied slot is an explicit swap, not silent stacking; a character's bonuses reflect only the worn one-per-slot set; old saves that illegally carry two of a slot type are reconciled on load without a crash or a silent loss. This is the widest-blast-radius change in v1.5 (`eff()` has 18 call sites in `engine/derived.js`, more in combat/movement/magic/items and 15 in the shell) and lands alone, fully regression-tested, before Phase 39 (magic items) and Phase 43 (Gear ON YOU/BAG split) depend on it.

Requirements: GEAR-03, GEAR-04.

Out of scope here: the ON YOU / BAG two-panel Gear split (Phase 43, CLAR-04), magic-item use→effect→cooldown timers and one-shot tools (Phase 39), weapon/armor rebalance (Phase 39), teaching the tuning bot to wear items (Phase 42).

</domain>

<decisions>
## Implementation Decisions

### Worn Model & `eff()` Semantics (GEAR-03)
- **Storage:** `c.worn = { ring?, bracelet?, amulet?, helm?, cloak?, staff? }` — a slot-key → item map, **lazily created** (absent on every fixture and bot run). A worn item **moves out of `c.items`** into `c.worn[slot]`, exactly as an equipped weapon/armor is not a bag member: it frees a bag slot, `slotItems(c)` never counts it, the store sell list / loot compare / bag-full drop shelf never see it.
- **`eff(c, key)` rule:** if `c.worn` is present → sum `it.eff[key]` over the populated `c.worn` entries only (plus nothing else — weapon/armor carry no `eff`); if `c.worn` is absent (legacy state: fixtures, bots, un-migrated saves) → today's sum over `c.items` byte-for-byte. This keeps every parity fixture, draw count and bot readout identical while migrated/new runs get one-per-type.
- **Bag ∪ worn lookups:** add a `carriedItems(c)` (or equivalent) helper in `engine/derived.js` returning bag items plus worn entries, and route every name/kind scan that can involve a cloak/jewelry/staff through it: `hasItemNamed` (→ `isFlying`'s Bracelet/Cloak of Flying checks), the Helm of Knowledge fluency read, `conditionsOf`'s item-backed chips, any shell scan. `hasPicks` (Lockpicks are not slot items) is unaffected but may use the helper.
- **Activatables must be worn to work in the new model:** `useItem` gains slot addressing (e.g. `{ type: "useItem", slot: "cloak" }` alongside the existing bag index form) and, when `c.worn` is present, a `use:` cloak/jewelry/staff in the BAG is refused with a named `useRefused`-style reason (`notWorn`) — a Cloak of Invisibility does nothing from the bag. `itemReady`/`usedAt`/`every` ride on the item object and move with it. Legacy states (no `c.worn`) keep today's bag-use behaviour.
- **Slot taxonomy — a new `slot` field on content rows** (`content/treasure-tables.js`): JEWELRY — Ring of Power → `ring`; Bracelet of Flight, Anklet of Invisibility → `bracelet`; Amulet of Light, Amulet of Stone, Pendant of Fortitude → `amulet`; Helm of Knowledge, Gauntlet of the Giant → `helm`; every CLOAKS row → `cloak`; every STAVES row → `staff` (still Magic User only — `equipItem` refuses a staff for any other class with the existing `staffClass`-style reason). A `slotFor(it)` helper derives the slot from `it.slot` (falling back on `it.kind` for `cloak`/`staff` items rolled before the field existed in a save).
- **Swap on an occupied slot:** the engine's `equipItem` grows a branch for `it.kind === "cloak" | "jewel" | "staff"` that performs a **direct swap** — the previously-worn piece drops back into the freed bag index (mirroring the weapon branch: `if (worn) c.items[i] = worn; else c.items.splice(i, 1)`), pushing `itemEquipped { item, slot, replaced? }`. No pending-swap state, no new serialized field. The **"explicit choice" is the shell's two-tap confirm** on the EQUIP button when the slot is occupied (`Swap for {worn name}? [Yes] [No]`, the Phase 33 `.mw-drop-confirm` / Phase 36 DISMISS pattern with its own `*_CONFIRM_MS` trio). `unequipSlot(state, slot)` extends to the six new slots via the same `stowItem` gate (`bagFull` on a full bag).

### Old-Save Reconciliation & Parity (GEAR-04)
- **Migration runs on load** in `engine/saveState.js` (`validateSave` / `rehydrate`, beside `migrateCarry` / `clearFoeEffect` / `clearStaleTimers`) for any save whose `c` lacks `worn`: create `c.worn`, and for each slot wear the **first item of that slot type in bag order**; every later copy **stays in the bag**. Moving bag→worn only frees slots, so migration can never overflow the bag cap. A save that already has `c.worn` is left alone (never re-migrated).
- **Fresh runs:** `newRun(seed, exclude, { wornSlots: true })` — an option **only the shell's new-game path sets** (the `storeRoll` precedent) — creates `c.worn` and wears the Thief's starting cloak. Fixtures, bots and every existing `newRun(seed)` caller pass nothing and stay byte-identical (the cloak stays in `c.items`, `c.worn` absent).
- **Narration:** the load-time migration **returns a reconciliation report** (`[{ slot, worn: name, bagged: [names] }]`) rather than writing any serialized field; the shell surfaces it **once, only when at least one extra was bagged**, as a GEAR-family rail card plus an Oracle line in the sarcastic voice (e.g. "You were wearing two rings on one finger. Physics has filed a complaint — {name} is in your bag."). Voice-safety scan applies.
- **Parity carve-out:** `stripWornField` (strip `worn` from `c`) in all three `*Comparable()` functions in `test/parity/harness/comparables.js` plus the three per-domain local duplicates (`combat-parity` / `magic-parity` / `movement-parity`), as a structural tripwire. A test proves `newRun(seed)` without the option has no `worn` key and that `eff(c, key)` equals the legacy sum for every key on every chargen fixture seed.

### Gear-Tab Surface & Take Flow (this phase's UI slice)
- **Worn rows join the existing worn area** of the Gear tab (`mazeworld.html` `paint()` `#s-carry` block: beside the weapon/armor `wornRow` calls) — one row per populated `c.worn[slot]` with its `txt` and an UNEQUIP button (`bagFull` dims it exactly as the weapon/armor rows do). Slot items in the bag list get an EQUIP button (the `renderCarriedList` gear host, currently weapon/armor only) which arms the swap confirm when the slot is occupied. The ON YOU / BAG two-panel split is **Phase 43**, not here.
- **Taking a slot item** (encounter-dot find, victory loot, store purchase, Thief kit): **auto-wear when the slot is empty** (mirrors `takeItem`'s weapon/armor auto-equip spirit; fewer taps on a phone), narrated through the existing `itemEquipped` event; when the slot is occupied the item goes to the bag as today and the player swaps from the Gear tab. Only in the new model (`c.worn` present) — legacy paths untouched.
- **Refusals** reuse the existing vocabulary: `equipRejected` with `notEquippable` (potions, picks, tools, bags) / the staff class reason; UNEQUIP on a full bag → `bagFull`; bag-use of an unworn activatable → a named refusal (new reason string on the existing refusal event if one fits, else one new event type with narration + toast + rail entries so the coverage guards stay green).
- **Bot / balance:** `tools/lib/tuning-bot.mjs` keeps calling `newRun` without the option this phase (legacy semantics; the v1.5 BEFORE pin stays like-for-like). Passing `{ wornSlots: true }` plus a wear/swap policy is **Phase 42's** bot extension, before the AFTER matrix.

### Claude's Discretion
- Exact names/signatures of `carriedItems`, `slotFor`, `stripWornField`, the reconciliation report shape, and whether the migration lives in `validateSave` or `rehydrate` (follow the `clearStaleTimers` placement).
- Whether `itemEquipped` gains an additive `replaced` field or the swap pushes a second event — additive payload preferred (Phase 25 precedent).
- Exact rail card family/tone for the reconciliation line and the wording of every new line (dark wit, family-friendly).
- Plan decomposition — suggested: (01) content `slot` field + `c.worn` model + `eff()`/lookups refactor + comparables carve-out + legacy-equivalence tests; (02) equip/unequip/useItem slot addressing + take-flow auto-wear + refusals; (03) load migration + `newRun` option + shell (worn rows, EQUIP/UNEQUIP, swap confirm, reconciliation rail card) + phase gate and the aggregated Pixel 7 checklist. Sequential waves are fine (every plan touches `engine/items.js` or `mazeworld.html`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/derived.js:51-55` `eff()` (the sum-all-carried loop to replace), `:129` `hasItemNamed`, `:156-161` `isFlying`, `:66` `slotItems` (bag-cap count — worn items must not appear), `conditionsOf`.
- `engine/items.js:537-634` `equipItem` / `unequipSlot` (weapon/armor scalar branches — the swap pattern to mirror per slot), `:281` `takeItem` (auto-equip spirit), `:378` `stowItem` (bag gate), `:783-870` `itemReady` / `useItem` (bag-index addressing, `usedAt`/`every` cooldowns), `:102` `hasPicks`, `:108-116` `rollJewel/rollCloak/rollStaff` (`kind: "jewel" | "cloak" | "staff"`, staff `every: 250`).
- `engine/encounters.js:398-402` find offers for cloak/staff/jewel; `engine/character.js:382` the Thief's starting cloak in `items`; `engine/economy.js:63-81` store rows for JEWELRY/CLOAKS/STAVES.
- `content/treasure-tables.js:14-34` JEWELRY (8) / CLOAKS (8) / STAVES (8) rows with `eff` / `use` / `every` — the rows that gain `slot`.
- `engine/saveState.js:106-160` `migrateCarry` / `clearFoeEffect` / `clearStaleTimers` (additive-with-default load migrations; `validateSave` at `:182`, `rehydrate`), `engine/state.js` `newRun` options (`dev`, `storeRoll` — the shell-only option precedent).
- `test/parity/harness/comparables.js` strip helpers (`stripTimersField` from Phase 36 is the freshest template) + the three per-domain local duplicates.
- Shell: `mazeworld.html:3216-3225` `wornRow` / `gearBtn` (Unequip, `bagFull` dimming), `:3768` EQUIP button in `renderCarriedList`'s gear host, `:7698-7699` `mzEquipItem` / `mzUnequip` bridges via `inventoryAction`, the Phase 33 drop confirm (`.mw-drop-confirm`, `DROP_CONFIRM_MS`, `revertDropConfirm`) and Phase 36's `DISMISS_CONFIRM_MS` trio (`renderPartyRoster`) as the two-tap confirm precedents; `src/browser/rail.js` families for the reconciliation card; `src/browser/viewModels.js` (2 `eff` reads).
- Coverage/voice guards: `test/unit/toastsCoverage.test.js`, `test/unit/formatEventsCoverage.test.js`, `test/voice/safety-scan.test.js`; existing gear tests `test/unit/items.test.js`, `armorDisplay.test.js`, `shell-gear-*.test.js` (re-pin where rows move).

### Established Patterns
- Engine pure/deterministic; new behaviour behind a state shape false for every fixture (`c.worn` absent ⇒ legacy path) and new-run options only the shell sets (`storeRoll`).
- New serialized fields: lazily created, load-tolerant, carved out of all three comparables + local duplicates (`timers` in Phase 36).
- Worn gear is not a bag member (weapon/armor precedent); equip = direct swap into the freed bag index; unequip through `stowItem`'s cap gate.
- Refusals are named events, never silent (FEED-02); every new event type needs narration + toast + rail entries; every new line passes the voice scan.
- Rail is the ONE feedback surface; HP not WP in player-facing text; two-tap inline confirms for destructive/swap choices.

### Integration Points
- `content/treasure-tables.js` (`slot` field), `engine/derived.js` (`eff`, `carriedItems`, `hasItemNamed`, `isFlying`, `slotFor`), `engine/items.js` (`equipItem`/`unequipSlot` slot branches, `takeItem` auto-wear, `useItem` slot addressing + not-worn refusal), `engine/state.js` (`newRun` `wornSlots` option), `engine/character.js` (Thief cloak worn under the option), `engine/saveState.js` (migration + report), `engine/actions.js` (`useItem`/`equipItem` validation for the slot form), `test/parity/harness/comparables.js` (+3 local dupes), `mazeworld.html` (worn rows, EQUIP/UNEQUIP, swap confirm, reconciliation card on load, `mzUseItem` slot form), `src/browser/{eventNarration,toasts,rail}.js` (new refusal/reconciliation copy), `docs/` ledger note for the GEAR-03 canon change (stacking → one per slot) with the declared rationale.

</code_context>

<specifics>
## Specific Ideas

- Reconciliation line register: "You were wearing two rings on one finger. Physics has filed a complaint — {name} is in your bag now."
- Not-worn refusal register: "{item} is in your bag, doing what things in bags do: nothing. Wear it first."
- Swap confirm copy: `Swap for {worn name}? [Yes] [No]` on the EQUIP row, reverting on timeout / outside tap like DISMISS.
- Worn rows read like the armor row: name, then the item's `txt`, then UNEQUIP.

</specifics>

<deferred>
## Deferred Ideas

- Gear tab ON YOU / BAG two-panel split and the bag-only drop prompt — Phase 43 (CLAR-04).
- Magic-item use→effect→cooldown chips, rope/ladder/torch — Phase 39.
- Tuning-bot wear/swap policy + `wornSlots` option — Phase 42 (before the AFTER matrix).
- The 13 drifted classic-script `SUB_NOTE` rows noted in Phase 36 — Phase 43 or a quick task.

</deferred>
