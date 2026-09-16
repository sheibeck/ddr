# Phase 29: End-of-Combat Loot & Bag Cap - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas proposed in batch tables; user accepted all

<domain>
## Phase Boundary

Foe drops during combat go into a pending pile instead of being auto-equipped or silently discarded; when combat clears, the player is presented a loot screen with take/leave per item (plus take-all/leave-all) and a compare-to-equipped readout with equip-now vs stow; ONE bag-cap gate covers every path that lands an item in the bag, with clear "bag full" feedback and a drop-to-make-room option; bigger bags exist as depth-appropriate treasure; the pending pile survives save/resume and is honestly forfeited (narrated) on flight or death. Requirements: LOOT-01..06.

Out of scope here: the combat narrative/tap-safety rebuild (Phases 30/32 — the loot screen is a decision surface and must not fire from a D-pad tap, but the general guard design lands in Phase 32), store stock randomization (Phase 33), gear-panel Use/Drop layout (Phase 33), any tuning of drop rates beyond the new bag draw.

</domain>

<decisions>
## Implementation Decisions

### Pending pile & loot screen (LOOT-01, LOOT-02, LOOT-06)
- Drops accumulate on a top-level `state.pendingLoot: []` (sibling of `pendingFind`). `engine/combat.js#killFoe` pushes the rolled treasure there INSTEAD of calling `takeItem` — the `rng.d(20) <= 2 + f.lvl` gate and the `rollTreasureItem(rng, depth, c)` draws are unchanged (zero rng change; only the destination of the item changes).
- Unlike `pendingFind` (transient, reset on load), `pendingLoot` IS serialized: `engine/saveState.js` `serializeRun`/`validateSave`/`rehydrate` carry it (tolerant: a pre-v1.3 save without the field loads as `[]`); it is carved out of all three `*Comparable()` fns via a `reconcilePendingLoot` mirror of the existing `reconcilePendingFind` (apply the legacy `takeItem` auto-take of each pending drop onto a CLONE of `c` before comparing — proves the engine offers byte-identically what the prototype auto-took).
- KNOWN PARITY RISK (research must enumerate): in the frozen prototype a strictly-better mid-fight drop was auto-equipped and USED in later rounds; with the pile, the hero fights on with the old gear, so any fixture whose combat continues after such a drop is a genuine action-path divergence (different weapon dice → different rng consumption). Treat each such fixture as a DECLARED divergence with an action-path record and rationale (the Phase 24 `actionPathDivergenceOf` / `stripScenarioDivergence` mechanism), never a blanket regeneration; `test/parity/prototype-master.js.txt` is never edited.
- The loot screen shows when combat ends (`encounterCleared`/`combatEnded`) with `pendingLoot.length > 0`, replacing the "encounter cleared" card; it also re-appears on resume if the pile is non-empty. The existing find card (`pendingFind`) stays for exploration finds.
- Actions (pure, no rng) in `engine/items.js` + `engine/engine.js` dispatch: `takeLoot {i, equip?}`, `leaveLoot {i}`, `takeAllLoot`, `leaveAllLoot`. The screen closes when the pile is empty. Every action emits an event (`lootTaken`, `lootLeft`, and the existing `itemEquipped` when equip-now) — no silent discards.
- Forfeit: fleeing (every `fled` reason) or dying with a non-empty pile clears it and pushes ONE `lootForfeited {items, reason}` event (new event type → `EVENT_NARRATION` entry + toast-table entry, family-friendly sarcastic line, e.g. leaving things on the floor in your hurry not to be on the floor). Amulet of Stone / other combat ends (Phase 31 will add more) show the pile normally.
- The loot screen is a decision surface: like Fight!/Joiner/find cards, its buttons must not be reachable from a D-pad tap (reuse whatever guard those cards have today; the systematic guard redesign is Phase 32).

### Compare-to-equipped & take semantics (LOOT-03)
- `lootCompare(c, it)` is a pure view-model helper in `src/browser/viewModels.js` (engine stays presentation-free): weapons compare max damage using the SAME rule `takeItem` uses (`WEAPON_MAX[base] + bonus` vs `WEAPON_MAX[c.weapon] + c.prof + c.magicWpn`) → "+2 damage" / "not an upgrade"; armor compares AR and shows durability via Phase 28's `bagArmorText` (`AR 15 vs your AR 6 · 45/45 hp`); class/race-illegal gear reads "can't use (Fighter only)" using the existing `weaponRefusalReason`/`armorRefusalReason` (export or wrap them — one rule, no duplication).
- Taking a weapon/armor offers two buttons: **Equip now** (`takeLoot {i, equip: true}` — a direct swap; the displaced worn piece goes to the bag through the single stow gate, so a slot is needed only when something is displaced; a bare-handed / "Nothing" character needs no slot) and **Stow** (`takeLoot {i}` → bag). Equip now is hidden when the piece is illegal or not an upgrade (the player can still stow and equip later from Gear).
- Class-illegal gear is still takeable to the bag (sellable at the store); only Equip now is hidden.
- Non-gear drops (cloaks, jewelry, staves, lockpicks, special potions): Take = stow; the row shows the item's `txt`. The lockpick duplicate gate stays at roll time (`hasPicks`) as today.

### The single bag-cap gate (LOOT-04)
- Only gear and treasure consume slots: `slotItems(c)` = `c.items` filtered to `kind !== "potion"`; healing potions (`c.potions`) and scrolls (`c.scrolls`) are already scalars. The "used / slots" readouts (gear panel, find card, loot screen, store) count the same way — one exported helper, no ad-hoc `c.items.length` counts left anywhere in the shell.
- ONE engine helper (planner's naming, e.g. `stowItem(state, it, events)`) is the only path that adds to `c.items` from outside chargen: it checks `slotItems(c).length >= bagCap(c)` → pushes `bagFull {item, have, slots}` and refuses (item stays where it was — pending find/loot untouched, no gold spent); else `giveItem`. Used by `takeFind`, `takeLoot`/`takeAllLoot`, the store paths that land in the bag (`givePotion`, `giveLockpicks`, and any buy that stows), `unequipSlot`, and the Equip-now displacement. Paths that equip directly (a strictly-better store buy via `takeItem`) consume no slot and are not gated.
- `bagFull` feedback: one toast ("Bag full (4/4) — drop something to make room") plus the existing drop-to-make-room shelf from the find card, reused on the loot screen and in the store. The engine never spends gold or discards an item on a refused stow.
- Starting kit: no behavior change (a Thief's single starting cloak ≤ every cap); add a test asserting chargen never exceeds `bagCap` for any class/bag.

### Bigger bags as treasure (LOOT-05)
- A bigger bag turns up as a loot/find ITEM ("Medium bag (6 slots)" — `kind: "bag"`, `tier`), only ever ONE tier above the bag carried; taking it upgrades `c.bag` immediately (`bagUpgraded {from, to, slots}` event → toast "Bigger bag: 6 slots" + Oracle line in voice); it consumes no slot and is never stowed.
- Depth appropriateness by floor: medium from floor 2, large from floor 5, exlarge from floor 9; never offered below its floor, or when the character already carries that tier or better.
- The new rng draw: ONE extra `rng.d(20)` on a successful treasure drop (a low roll yields the bag instead of the rolled item), fired ONLY behind a guard the parity fixtures never satisfy: `floor.depth >= 2` AND an upgrade is available. Research MUST confirm no parity fixture kills a foe (or opens a chest that reaches the same roll) past floor 1; if any does, use an explicit run-level `state.features.bags` flag set by the shell's `startNewRun` and absent in every bare `newRun(seed)` fixture instead. Either way the new draw sits AFTER the existing draws so nothing upstream shifts.
- The same guarded draw may also apply to exploration finds (`findGear`/`openChest`) if the planner finds it clean; combat drops are the required path.

### Claude's Discretion
- Exact field/action/event names (`pendingLoot`, `takeLoot`, `lootForfeited`, `bagUpgraded`, `stowItem`, `slotItems`) and the loot-screen markup/CSS (reuse the find card's `.enc-head/.enc-sub/.actions/.shelf` pattern).
- Toast/Oracle wording for lootTaken/lootLeft/lootForfeited/bagUpgraded/bagFull (voice: sarcastic, deadpan, family-friendly; safety scan green).
- Whether Take all stops at the first `bagFull` (recommended: take what fits in order, then surface bagFull for the remainder) — must never lose an item.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/items.js`: `takeItem` (~L255, the legacy auto-take — keep for store buys and for the comparables reconcile), `giveItem` (~L60), `bagCap` (~L323), `takeFind`/`leaveFind`/`dropItem`/`equipItem`/`unequipSlot` (~L366–500, the pure inventory-action pattern with `bagFull`), `rollTreasureItem` (~L154), `weaponRefusalReason`/`armorRefusalReason` (ECON-05 legality).
- `engine/combat.js#killFoe` (~L558–610): the ONE drop site (`rng.d(20) <= 2 + f.lvl` → `takeItem(rollTreasureItem(...))`); `flee` (~L684–740, three success exits all push `fled`); `endCombat` (~L962); `engine/death.js` for the death path.
- `engine/encounters.js#offerFind` (~L156–170) + `state.pendingFind`: the accept/decline precedent; `engine/engine.js` action switch (~L100–136) for adding `takeLoot`/`leaveLoot`/`takeAllLoot`/`leaveAllLoot`.
- `engine/saveState.js` (~L180–245): `validateSave` builds the value object explicitly (add `pendingLoot`), `rehydrate` resets transient fields (do NOT reset `pendingLoot`), `migrateCarry` is the tolerant-migration precedent.
- `content/bags.js` `BAGS` (small 4 / medium 6 / large 8 / exlarge 10) — tiers for the upgrade item.
- `test/parity/harness/comparables.js`: `reconcilePendingFind` (~L47) — clone-and-apply-legacy-take reconcile; `stripBagField`; `actionPathDivergenceOf`/`stripScenarioDivergence`/`declaredEndDiffs` (declared per-fixture divergences with action-path records, Phase 24 precedent).
- Shell: find card in `mazeworld.html` (~L4940–4990: `S.pendingFind` card with Take/Leave and the full-bag drop shelf `#find-drop-shelf`), `renderCarriedList` (~L3479), `window.__mzBags`, `window.__mzArmorDisplay` (Phase 28), `hasPendingSurface` guard at ~L4703 (`S.pendingFind` blocks movement — add `pendingLoot` there so the map stays parked while the loot screen is up).
- `src/browser/viewModels.js` (Phase 28 `armorDisplay`/`bagArmorText` — the helper style for `lootCompare`), `src/browser/toasts.js` + `src/browser/eventNarration.js` tables, `test/unit/formatEventsCoverage.test.js` (every new event type needs an entry).

### Established Patterns
- Engine gate: pure/deterministic; parity byte-identical for solo play; new rng draws only behind guards fixtures never satisfy and placed after existing draws; new serialized fields carved out of all three comparables; master never edited; every new event type gets an `EVENT_NARRATION` entry; deliberate divergences are per-fixture, declared, with before/after rationale.
- Player-choice inventory actions are pure engine actions dispatched via `applyAction` and bridged as `window.mz*` functions in the trailing module; cards render from `S.pending*` state in the classic script.
- Phase 25/25.1 feedback rules: decisions get a dismissible card, minor events toast-only with the narrative line; toasts linger and tap to dismiss.

### Integration Points
- `killFoe` → `pendingLoot`; `flee`/`die` → forfeit; `endCombat`/`encounterCleared` → shell renders the loot screen; `saveState` → serialized pile; `engine.js` → four new actions; comparables → reconcile + carve-out; shell find card/store/gear → `slotItems` readouts and the shared drop shelf; `formatEventsCoverage` → new event entries.

</code_context>

<specifics>
## Specific Ideas

- User rule (2026-09-15, restated in REQUIREMENTS LOOT-04): healing potions, special potions and scrolls never count against bag space — only gear and treasure consume slots.
- "No drop is silently discarded" is the core promise: every leave/forfeit/bagFull is narrated; the engine never drops an item on a refusal.
- Depth tiers for bags (2 / 5 / 9) are tuning knobs — document them as such in `content/bags.js` alongside the existing knob comment.

</specifics>

<deferred>
## Deferred Ideas

- Systematic D-pad mis-tap guard for all decision cards → Phase 32 (CMBUI-04/05); the loot screen reuses today's card guard only.
- Selling/buying bags at the store → Phase 33 store stock if wanted.
- Compare readouts for jewelry/cloak effects (stat deltas beyond txt) — not requested.

</deferred>
