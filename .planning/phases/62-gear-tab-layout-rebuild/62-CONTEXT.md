# Phase 62: Gear Tab Layout Rebuild - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild the GEAR tab's layout to the user's `design/Mazeworld Gear.dc.html` mock, in this order: a slim stat header, a fixed five-slot **WORN** list, a **BAG** with a capacity meter and item cards, a **CONSUMABLES** block, and a compact **ALSO ON YOU** block. Every number, label and state comes from the shared view models, so the Gear tab can never disagree with the ITEMS combat submenu, the loot screen or the store (GSCR-01..06, GSCR-11).

This phase is presentation only, in `src/browser/` plus `mazeworld.html` markup/CSS for `#screen-gear`. The engine, `content/` and `test/parity/` are untouched.

Out of this phase: the bottom action sheet, greyed combat rows, the Android back button and the TalkBack sheet reading. All of those are Phase 63. Until then the current Equip / Unequip / Drop actions stay reachable on the new rows (see Frame Q4).

</domain>

<decisions>
## Implementation Decisions

### Frame, header and interim actions — user accepted all recommendations
- **Header = a slim stat header, NOT the mock's identity block.** It shows **ARMOR RATING** (the effective value from `viewModels.js#armorDisplay`, Cloak of Armor included) and **WILMST** (`c.gold`). The global HUD (`#mw-hud`, band 1: name / dim line / `x/y HP`) already names the hero on every tab, so the mock's name and race · sub-class · floor lines are dropped. GSCR-01 and ROADMAP Phase 62 criterion 1 are reworded to match (done in this discuss).
- **Section order:** WORN → BAG → CONSUMABLES → ALSO ON YOU. ALSO ON YOU is a compact key/value block holding rations (`N days`), a Magic User's spell charges (`k / max`), every running effect the old `#s-kit` list showed (Shield ward `pool hp left · rounds rds`, Strength, Regeneration, Mirror Self, Sense Presence, Sense Danger, Map the Floor), and Kills. Nothing the old ON YOU / ALSO ON YOU panels showed is lost. Potions and scrolls move to CONSUMABLES; wilmst moves to the header.
- **Styling:** the mock's look mapped onto the EXISTING tokens in `mazeworld.html` `:root`. Section heads use Press Start 2P micro (`--mw-font-micro` / `--mw-font-display`) with the mock's 3px rule (`#3a3226`). The body uses Courier Prime bold (`--mw-font-body` / `--mw-font-data`), gold accents `#e8c97a`, red `#e07260` at capacity, and the panel fills `#1b170f` / `#14110c`. Every size honours `--mw-text-scale` (the S/M/L setting). No new font files; the fonts are already bundled offline. Player text says HP, never WP.
- **Interim actions (before the Phase 63 sheet):** rows carry the mock's `›` chevron, and today's actions stay reachable as small in-row buttons on the new layout: Equip / Unequip / Drop / Use, with the existing two-tap Drop and swap confirms. That way the tab is fully usable between phases. Phase 63 replaces them with the sheet; the chevron is the affordance it will use.

### WORN list — user accepted all recommendations
- **Five fixed rows in the mock's order:** WEAPON, ARMOR, CLOAK, JEWELRY 1, JEWELRY 2 (engine keys: `c.weapon`; `c.armor` via `armorDisplay`; `c.worn.cloak`, `c.worn.jewelry1`, `c.worn.jewelry2`). The head shows `WORN` and an `N / 5` filled count. Bare `Fists` counts as an EMPTY weapon slot. A Cloak of Armor sits in the CLOAK row, and the ARMOR row keeps showing the plate underneath (today's `armorDisplay.under` sub), so the effective AR and the worn piece both stay legible.
- **Value column only where there's a clean number:** weapon die plus magic (`d10 +2`, from `WEAPONS[c.weapon].lab` and `c.magicWpn`) and armor `AR 15`. Jewelry and cloaks show `—`. The note line carries the item's `txt`, and armor wear (`22/40 hp`, or `destroyed`) sits in the armor row's note.
- **Empty slots:** keep the shipped in-voice `GEAR_COPY.empty` lines (armor, jewelry1, jewelry2, cloak), in italics, via the ONE `emptySlotRows(c)` read, and ADD a weapon line in the same voice (`GEAR_COPY.empty.weapon`, e.g. "fists — …"). The empty-slot rule is not restated anywhere else.
- **USE cell:** the mock's USE / ACTIVE / COOLING button plus sub-label, driven ONLY by `itemRowState(state, it)`. `ready` shows USE; `effect` shows ACTIVE with `n SQ` left; `cooldown` shows COOLING with `n SQ`; `charges` (staff) shows its `k/max · n SQ`. It only appears for activatable items (`kind !== "none"`). Tapping runs today's `deps.useItem` path, which costs the turn in combat.

### BAG, CONSUMABLES and the shared lists — user accepted all recommendations
- **Bag meter:** the head shows `BAG` with `used / cap` from `bagUsage(c)` (potions and scrolls never count), plus one pip per slot (caps are 4/6/8/10 from `content/bags.js`). At capacity the count and pips turn red and a line reads "BAG FULL · DROP OR USE SOMETHING". The "potions & scrolls ride free" note (`GEAR_COPY.freeRide`) stays as a small sub-line. A bag-less character (`slots === null`) shows the count only, with no pips.
- **Bag cards:** the name in the display font; a slot tag with the family the item fits (via `slotFor` / `WORN_KEYS_OF`: WEAPON / ARMOR / CLOAK / JEWELRY) plus `· SWAP` when every slot of that family is occupied; and a description of `it.txt` plus the `usableBy` suffix. Bag-only items (staffs, torch, rope, ladder, picks and the like) get NO slot tag and carry the USE / state button where `itemRowState` says they're activatable. The `NOTHING LEFT TO CARRY` empty state stays in voice.
- **Consumables:** a HEALING POTION row (the `c.potions` counter, USE → `drinkPotion`, usable in or out of combat), one row per buff-potion TYPE (`kind: "potion"` items in `c.items`, grouped by name, `×N`, USE → the existing use path), and a SCROLLS row (`c.scrolls`, `×N`, READ → `readScroll`). READ is greyed and states the engine's reason when `canRead(state)` is false. Rows with 0 held are omitted, except that a zero healing count still shows `×0` with a disabled button. The head shows `CONSUMABLES` with `N HELD`.
- **Shared lists (GSCR-11):** the Gear tab gets its OWN renderer in `src/browser/gearTab.js`. `renderCarriedList` stays exactly as it is for the store's SELL list, the combat ITEMS list and the loot screen. All of them read the same `itemRowState` / `bagUsage` / `lootCompare` view models, so a state shown on the Gear tab can never disagree with another screen. Do not fork a copy of any of those rules.

### Standing rulings (not re-asked)
- Presentation only: `engine/`, `content/` and `test/parity/` are byte-identical (the prototype master blob `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`).
- The rail is the one feedback surface: no toasts and no inline refusal text under rows. The mock's toast strip is NOT built.
- Greenfield: the old ON YOU / ALSO ON YOU / BAG panel markup and CSS are replaced outright, not kept alongside. DOM snapshot pins that move (`gear` tab snapshots in `test/unit/shell-tab-snapshots.test.js` and the gear-panel tests) are deliberately regenerated, with the change named in the SUMMARY.

### Claude's Discretion
- Exact DOM structure and class names, provided they follow the existing `mw-` conventions and build via `createElement`/`textContent` wherever an item name is involved (T-38-11: no `innerHTML` carrying item text).
- Pip rendering (divs vs a single meter element) and the exact spacing values, taken from the mock.
- Plan split (likely: header, WORN and CONSUMABLES view models plus tests, then markup/CSS/render wiring plus snapshots).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/gearTab.js`: `renderGearTab(host, state, deps)` (:399, today's ON YOU / ALSO ON YOU / BAG renderer), `bagUsage`, `GEAR_COPY`, `emptySlotRows`, `ITEM_STATE_COPY`, `itemRowState` (:132), and `renderCarriedList` (:199, shared with the store, combat and loot screens; leave it intact).
- `src/browser/viewModels.js`: `armorDisplay(c)`, `bagArmorText`, `lootCompare` (now with `why`, from Phase 61), `usableBy`, `storeRowState` (Phase 61).
- `engine/derived.js`: `WORN_SLOTS` (jewelry1, jewelry2, cloak), `WORN_KEYS_OF`, `slotFor`, `activationFor`, `itemTimerId`, `chargesTimerId`; `engine/items.js`: `bagCap`, `canStow`, `slotItems`, `gearLockReason` (Phase 61; Phase 63 will use it); `engine/magic.js`: `canRead`; `engine/movement.js`: `maxCharges`.
- The engine actions the rows dispatch through `deps`: `drinkPotion`, `readScroll`, `useItem`, `equipItem`, `unequipSlot`, `dropItem` (see `tabDeps()` in `mazeworld.html`).

### Established Patterns
- `window.__mzTabs.gear(screen, S, tabDeps())` renders the tab (`mazeworld.html:2103`, `:3000`); a hidden tab is skipped on the step path (Phase 60 perf fix) and re-rendered on tab switch.
- Frozen copy objects (`GEAR_COPY`, `ITEM_STATE_COPY`) are walked by the voice scan and the hp-not-wp guard. New copy goes in frozen objects.
- DOM snapshot tests (`test/unit/shell-tab-snapshots.test.js`, with fixtures in `test/unit/fixtures/shell-snapshots/*.gear.txt`) pin the rendered tab. They are deliberately regenerated with `MZ_SNAPSHOT_UPDATE=1`, and the fixture read is CRLF-tolerant since Phase 61.
- Existing gear tests to update greenfield-style: `gearTab.test.js`, `gear-panels.test.js`, `shell-gear-39.test.js`, `shell-gear-toolbar.test.js`, `shell-armor-display.test.js`, `shell-clarity-43.test.js`.

### Integration Points
- `mazeworld.html` `#screen-gear` markup (:1852–1863: `#onyou-panel`, `#m-gold`, `#s-onyou`, `#s-kit`, `#bag-panel`, `#s-carry-n`, `#s-carry`) is replaced by the new sections. The CSS lives in the same file's style block (tokens at :96–140).
- The HUD's `m-gold` write moved into `renderGearTab` in Phase 47. If `#m-gold` is removed, its HUD/other readers must be checked (grep `m-gold`).

</code_context>

<specifics>
## Specific Ideas

- The mock (`design/Mazeworld Gear.dc.html`) is the visual spec: row paddings (11px), the 3px section rules, gold count on the right of each section head, the card borders (`2px solid #2c2519`, fill `#1b170f`), the USE button (Press Start 2P 7px, min-width 74, inset 1px border, colour by phase: gold ready / green `#8fb08a` active / dim `#6f6754` cooling), the slot-tag colours (`#8f856f` normal, `#b9a4ef` for `· SWAP`), and red `#e07260` at capacity.
- The mock's toy rules (scrolls taking bag slots, hatchet/rope/picks powers, a flat "AR 10" with no armor) are ignored. Shipped rules are canon.

</specifics>

<deferred>
## Deferred Ideas

- The bottom action sheet, combat-greyed rows, back-button close and TalkBack sheet reading belong to Phase 63.
- Hero tab redo: no mock yet (milestone Future Requirements).

</deferred>
