# Phase 63: Action Sheet, Combat Lock & Accessibility - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Every equip / swap / unequip / use / drop decision on the GEAR tab goes through ONE bottom action sheet, as in the user's `design/Mazeworld Gear.dc.html` mock. The sheet states the engine's real reason on every greyed action, reflects the combat lock live (from Phase 61's `gearLockReason`), and is fully usable with reduced motion, the Android back button and TalkBack (GSCR-07..10, GRULE-02).

This phase is presentation only, in `src/browser/` plus `mazeworld.html` markup/CSS and wiring. The engine, `content/` and `test/parity/` are untouched. The engine already has every verb and every refusal it needs (Phase 61).

Out of this phase: the Pixel 7 device batch (Phase 64), the store, combat and loot screens (their `renderCarriedList` stays byte-identical), and the Hero tab.

</domain>

<decisions>
## Implementation Decisions

### Sheet entry and structure — user accepted all recommendations
- **What opens a sheet:** tapping a WORN row (all five slots, empty ones included) or a BAG card; the whole row is the target, with the `›` chevron. The inline USE / ACTIVE / COOLING button on a row still acts DIRECTLY (with `stopPropagation`, so it never also opens the sheet), as in the mock. **Consumables keep their direct USE / READ buttons and get no sheet.**
- **Built on the existing camp-sheet pattern** (`openCampSheet` / `closeCampSheet`, `mazeworld.html:4796`): a scrim element, `showPanel` / `hidePanel` (`mazeworld.html:3290/3295`, Phase 58 motion with the reduced-motion snap), `armEncounterButtons()` + `guardTap(btn, fn)` (`:3360/3377`, the 250 ms ghost-tap guard so the opening tap can never fire a sheet action), and the `lastDismissAt` stamp. The sheet joins the Android back handler's `hasOpenModal` list (`mazeworld.html:6878`, `decideBackAction` → `close-modal`). The render and view-model logic goes in a `src/browser/` module (e.g. a `gearSheet.js`, or inside `gearTab.js`), following the Phase 47 module contract (no window/document globals in the module; `host.ownerDocument` + deps).
- **Interim row buttons are removed.** The Phase 62 in-row Equip / Unequip / Drop and the inline two-tap Drop and swap confirms come OFF the Gear tab rows, because the sheet replaces them. `renderCarriedList` itself, as used by the store SELL list, the combat ITEMS list and the loot screen, stays byte-identical, and those snapshots must not move.
- **DROP arms a tap-again confirm inside the sheet.** The DROP row relabels to "DROP IT? · tap again" and reverts after 3 s (the same `DROP_CONFIRM_MS` idea, DOM-local and never on `S`). The second tap dispatches `dropItem` and closes the sheet.

### Sheet actions and reasons — user accepted all recommendations
- **Header:** a micro label `SLOT · WORN` / `SLOT · EMPTY` / `BAG · <FAMILY or USED FROM THE BAG>`, then the title (the item name, or NOTHING WORN), then the note (`it.txt` / the in-voice empty line).
- **A filled WORN slot:** USE (only if `itemRowState(...).kind !== "none"`; the sub-line shows its state: ready / "Already running — n squares left." / "Cooling down — n more squares." / staff charges), then UNEQUIP, then one **SWAP FOR `<item>`** per bag item whose family fits this slot. UNEQUIP is greyed with "Bag is full — free a slot first." when `canStow` is false. A **destroyed** armor piece shows **DISCARD** instead of UNEQUIP (no room needed), mirroring today's `noSlotNeeded` rule.
- **An empty WORN slot:** one **EQUIP `<item>`** per fitting bag item, or a greyed **NOTHING TO EQUIP** with a line in voice.
- **Illegal candidates** (a weapon or armor the class, race or weight rules refuse) are **listed but greyed**, with the engine's own refusal text via `weaponRefusalReason` / `armorRefusalReason` → `refusalText` (e.g. "can't use — Fighters only"). They are never hidden.
- **A BAG card:** weapon and armor cards show the **explained upgrade line** from Phase 61 (`lootCompare(c, it).line`, e.g. `d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing · not an upgrade`) in the header note area. Actions are one **EQUIP TO `<SLOT>` / SWAP INTO `<SLOT>`** per named slot the item fits (both JEWELRY 1 and JEWELRY 2 named, so the player picks which piece comes off; weapon and armor have one slot each), then **DROP**. Bag-only items (staff, torch, rope, picks and the like) get **USE** (if activatable) and **DROP**.
- **Outcome goes to the rail only.** Every action dispatches through the existing `tabDeps()` bridges (`equipItem(i, slot)`, `unequip(slot)`, `dropItem(i)`, `useItem(...)`). The sheet closes, and the engine events reach the rail through the existing narration fold, with no toast and no in-sheet result text. A greyed action's reason is its own sub-line; tapping a greyed action does nothing.

### Combat lock, accessibility and motion — user accepted all recommendations
- **In a fight** (`gearLockReason(state) === "combat"`, the pending Fight! preview included): EQUIP / SWAP / UNEQUIP / DISCARD are greyed with **"Not the moment to change outfits."** That copy is single-sourced from Phase 61's narration, not a second literal. **USE and DROP stay live.** The Shield spell and the torch are not gear changes (Phase 61 ruling). If a fight starts while the sheet is open, the sheet **re-renders greyed** in place rather than closing. After the fight, everything works again. GRULE-02 is satisfied here.
- **Closing:** CANCEL, a backdrop (scrim) tap, and the Android back button. Focus returns to the row that opened the sheet.
- **TalkBack:** the sheet container is `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (the title). Focus moves to the title on open. Each action is a real `<button>`; greyed ones are `aria-disabled="true"` with the reason wired as their accessible description. Openable rows are announced as buttons with an "opens actions" hint.
- **Motion:** the mock's backdrop fade (≈0.16 s) and sheet rise (≈0.2 s) go through Phase 58's `showPanel` / `hidePanel` path, and reduced motion snaps instantly. Every new font size is `calc(<rem> * var(--mw-text-scale))`, as in Phase 62.

### Standing rulings (not re-asked)
- Presentation only; engine, content and parity are byte-identical (master blob `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`).
- The rail is the one feedback surface. HP never WP. Item-named DOM via `createElement`/`textContent` only.
- Greenfield: no dual path. The Gear-tab snapshots that move (`thief.gear`, `mu.gear`, `thief.gear-confirms`, which probably becomes a sheet snapshot) are regenerated deliberately and named in the SUMMARY. The store, loot and hero snapshots must NOT move.

### Claude's Discretion
- Module boundaries (a new `gearSheet.js` vs extending `gearTab.js`), the sheet's DOM ids and class names, and the pure view-model shape (e.g. `gearSheetModel(state, target)` returning `{ label, title, note, actions:[{key, label, sub, enabled, reason, run}] }`). It should be pure and tested without a DOM, like the Phase 62 models.
- Exact copy for the new labels and sub-lines, in the house voice, walked by the voice scan and the hp-not-wp guard.
- Plan split (likely: the pure sheet view model plus tests, then markup/CSS/wiring plus back/TalkBack/motion plus snapshots, then agreement or regression tests).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/gearTab.js` (Phase 62): `renderGearTab`, `gearWornModel`, `gearBagCardsModel` (has `swap`), `gearUseCell`, `GEAR_WORN_ORDER`, `GEAR_COPY`, `itemRowState`, `bagUsage`, `emptySlotRows`; `renderCarriedList` (shared, keep intact).
- `engine/items.js`: `gearLockReason(state)`, `canStow`, `weaponRefusalReason`, `armorRefusalReason`; `engine/derived.js`: `WORN_SLOTS`, `WORN_KEYS_OF`, `slotFor`, `activationFor`.
- `src/browser/viewModels.js`: `lootCompare` (`.line`, `.why`), `refusalText`, `usableBy`, `armorDisplay`.
- `src/browser/narrationLines.js:1702`: the `gearRefused` line ("Not the moment to change outfits."). Reuse the copy, don't duplicate it.
- `mazeworld.html`: `showPanel`/`hidePanel` (:3290), `armEncounterButtons`/`guardTap` (:3360/3377), the camp sheet (:4796, markup `#mw-camp-sheet`/`#mw-camp-scrim`), `tabDeps()` (useItem, drinkPotion, readScroll, equipItem, unequip, dropItem, …), the back handler's `hasOpenModal` (:6878).

### Established Patterns
- Bottom sheets are hidden-by-default sections with a scrim; `showPanel`/`hidePanel` own the motion and reduced-motion paths; `guardTap` + `armEncounterButtons` stop ghost taps.
- Phase 58: `lastDismissAt` is stamped at close so the map's tap-to-move ignores the dismissing tap.
- DOM snapshot tests (`test/unit/shell-tab-snapshots.test.js`) and source-pin tests guard the tab. The fixture read is CRLF-tolerant.

### Integration Points
- The Gear tab re-renders via `window.__mzTabs.gear(...)` on paint and tab switch. The sheet must survive a repaint (re-derive from state by target, never hold a stale item index) and close if its target item disappears.
- The combat state changes while the sheet is open → the sheet re-renders greyed, reading `gearLockReason` on each render.

</code_context>

<specifics>
## Specific Ideas

- The mock's sheet: a full-width panel with `border-top 3px #6b5c3c`, padding `18px 18px 26px`, header with bottom rule `3px #3a3226`, label Press Start 2P ~6.5px `#9a8f76`, title Press Start 2P ~10px, note Courier Prime bold ~14.5px `#a89c82`. Action rows have a `2px #241f16` bottom border and a gold label when enabled, grey at 45% opacity when disabled, with the chevron hidden. CANCEL is a full-width bordered button at the bottom.
- The acceptance example: a Magic User opens the Spiked Staff bag card and sees `d8 vs your d6 · −1 to hit · 4.1 vs 5.0 a swing · not an upgrade` plus SWAP INTO WEAPON and DROP. Mid-fight, SWAP INTO WEAPON is greyed with "Not the moment to change outfits." while DROP stays live.

</specifics>

<deferred>
## Deferred Ideas

- Revisiting mid-fight READ on the Gear tab vs the combat submenu (noted in Phase 62). No change this phase: consumables have no sheet.
- The `--mw-font-*` text-scale token bug (a separate todo).

</deferred>
