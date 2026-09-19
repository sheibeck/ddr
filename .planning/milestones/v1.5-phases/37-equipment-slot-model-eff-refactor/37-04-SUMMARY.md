---
phase: 37-equipment-slot-model-eff-refactor
plan: 04
subsystem: shell
tags: [shell, gear-tab, worn-rows, two-tap-swap-confirm, use-slot-form, reconciliation-rail-card, docs-ledger, phase-close, deferred-uat]

# Dependency graph
requires:
  - phase: 37-01
    provides: "WORN_SLOTS, slotFor(it), carriedItems(c), the two-path eff(), the c.worn parity carve-out"
  - phase: 37-02
    provides: "equipItem/unequipSlot slot branches, autoWearSlot/wearItem, useItem slot addressing + notWorn refusal"
  - phase: 37-03
    provides: "newRun's wornSlots option, saveState.js's option-gated load migration + wornReport, engineAdapter's takeBootWornReport(), rail.js's wornReconcileCard(report), combatMenu.js's worn ITEMS rows"
provides:
  - "mazeworld.html: classic eff(key) routes through window.__mzEff (the engine's two-path eff), legacy loop kept as the pre-bridge fallback; module bridges window.__mzEff/__mzSlotFor/__mzWornSlots"
  - "mazeworld.html: paint()'s Gear-tab carry block renders one wornSlotRow per populated c.worn[slot] (name, cooldown, txt, Use for activatables, Unequip dimmed to 'Bag full')"
  - "mazeworld.html: renderCarriedList's equip branch arms a two-tap 'Swap for {worn name}? [Yes] [No]' confirm (SWAP_CONFIRM_MS/swapConfirmRevert/revertSwapConfirm() trio, .mw-swap-confirm CSS) on a bag slot item when its slot is occupied, else Equip"
  - "mazeworld.html: window.mzUseItem(ref) accepts a bag index or { slot }; COMBAT_DISPATCH.useItem forwards d.slot when present"
  - "mazeworld.html: surfaceWornReconcile() surfaces the one-shot load-time reconciliation report on the ENTER-to-resume branch as a GEAR rail card + Oracle line"
  - "docs/GEAR-SLOTS.md: the GEAR-03/GEAR-04 canon-change ledger — declared canon change, slot taxonomy, the model, play rules, old-save reconciliation, the full eff() call-site inventory, out-of-scope/next"
  - "test/unit/shell-worn-slots.test.js (12 tests) + the re-pinned useItem regex in test/unit/shell-combat-actions.test.js"
affects: ["39 (magic items)", "42 (tuning-bot wear/swap policy)", "43 (Gear ON YOU/BAG split)", "milestone-close UAT batch"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "the classic eff(key) duplicate delegates to the engine's own two-path eff via a one-line bridge check, keeping its legacy loop as the byte-identical fallback — the same 'bridge, don't reimplement' pattern as __mzConditionsOf/__mzCanCast"
    - "the swap confirm is a byte-for-byte structural mirror of the Phase 33 Drop confirm (its own SWAP_CONFIRM_MS/swapConfirmRevert/revertSwapConfirm trio, its own .mw-swap-confirm class so the Phase 33 mw-drop-confirm count pin stays exact) — the third instance of this two-tap pattern in the codebase (Drop, DISMISS, now Swap)"
    - "wornSlotRow is a paint-local sibling of the pinned wornRow — never touches wornRow's signature, so every pre-existing weapon/armor row pin survives untouched"
    - "window.mzUseItem's ref-resolution ternary (object -> { slot }, else -> { i }) is the one place the bag-index and slot addressing forms converge, mirrored by COMBAT_DISPATCH.useItem's own d.slot !== undefined check"

key-files:
  created:
    - test/unit/shell-worn-slots.test.js
    - docs/GEAR-SLOTS.md
  modified:
    - mazeworld.html
    - test/unit/shell-combat-actions.test.js

key-decisions:
  - "The swap confirm's initial (unarmed) button reads 'Equip', identical to the empty-slot case — the confirm only appears after the tap, matching the plan's locked EQUIP-then-arm flow rather than pre-labelling the row as a swap."
  - "wornSlotRowRegion() in the new test file is a narrower slice than the full paint-carry region specifically so the 'once' pins on window.mzUnequip?.(slot)/window.mzUseItem?.({ slot }) aren't confused by wornRow's own pre-existing, byte-identical window.mzUnequip?.(slot) call earlier in the same carry block."
  - "docs/GEAR-SLOTS.md's reconciliation copy register is set off in a blockquote (rather than inline prose) so the locked sentence — including 'Physics has filed a complaint' — is never word-wrapped across a markdown line break, keeping the doc's own acceptance-criteria grep exact."

requirements-completed: [GEAR-03, GEAR-04]

coverage:
  - id: D1
    description: "the classic eff(key) duplicate routes through window.__mzEff (engine's two-path eff), keeping the legacy sum-over-c.items loop as the byte-identical fallback; the module bridges window.__mzEff/__mzSlotFor/__mzWornSlots from engine/derived.js"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/shell-worn-slots.test.js (eff routing + bridges sections, 2 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "the Gear tab's paint() carry block renders one wornSlotRow per populated c.worn[slot] (name, cooldown, txt, Use for activatables, Unequip dimmed to Bag full) after the armor row and before renderCarriedList; the pinned wornRow signature is untouched"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/shell-worn-slots.test.js (worn-rows sections, 2 tests) + test/unit/shell-armor-display.test.js (wornRow signature pin, unaffected)"
        status: pass
    human_judgment: false
  - id: D3
    description: "renderCarriedList's equip branch arms the two-tap Swap for {worn name}? [Yes] [No] confirm on an occupied slot (its own SWAP_CONFIRM_MS trio and .mw-swap-confirm class), reverting on No/timeout/outside-tap; Yes reverts then dispatches window.mzEquipItem(i); every Phase 33 Drop-confirm pin still holds"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/shell-worn-slots.test.js (SWAP trio + confirm-mechanics + equip-branch sections, 3 tests) + test/unit/shell-gear-toolbar.test.js (Drop-confirm pins, unaffected)"
        status: pass
    human_judgment: false
  - id: D4
    description: "window.mzUseItem accepts a bag index or { slot } and routes to engineCombatAction in combat / inventoryAction otherwise; COMBAT_DISPATCH.useItem forwards d.slot when present"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/shell-worn-slots.test.js (mzUseItem section, 1 test) + test/unit/shell-combat-actions.test.js (re-pinned COMBAT_DISPATCH.useItem regex)"
        status: pass
    human_judgment: false
  - id: D5
    description: "the title screen's ENTER-to-resume branch calls surfaceWornReconcile(), which consumes takeBootWornReport() through rail.js's wornReconcileCard and, only when a card results, pushes it via window.mzRailLine (GEAR, dull, 6000ms, tick icon) and logs the same line to the Oracle; a fresh roll or a second ENTER is a no-op"
    requirement: GEAR-04
    verification:
      - kind: unit
        ref: "test/unit/shell-worn-slots.test.js (resume-surfacing section, 1 test)"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/GEAR-SLOTS.md exists with the canon-change declaration, the 24-row slot taxonomy, the model rules, the refusal vocabulary, the migration rule + option gate, and the eff() call-site inventory"
    requirement: GEAR-04
    verification:
      - kind: other
        ref: "test -f docs/GEAR-SLOTS.md; grep -c '^## ' == 7; grep -c notWorn == 2; grep -c wornSlots == 8; grep -c 'Physics has filed a complaint' == 1; grep -c 'engine/derived.js:284' == 1"
        status: pass
    human_judgment: false
  - id: D7
    description: "Phase gate: npm test '# fail 0'; npm run build:www exit 0; fixtures untouched; master hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0; no package/font change; the cumulative engine/content/src/mazeworld.html/docs footprint since 6671921 is exactly the declared 15-file list; tools/ untouched; store-listing/ and tools/store-screenshots/ never staged in any Phase 37 commit"
    verification:
      - kind: other
        ref: "npm test 2388/2388 (# fail 0); npm run build:www exit 0; git status --porcelain test/parity/fixtures empty; git hash-object prototype-master.js.txt unchanged; git diff --stat -- package.json package-lock.json tools empty; grep -c fonts.googleapis mazeworld.html == 0; git diff --stat 6671921 -- engine content src mazeworld.html docs == 15 files; git log --stat 6671921..HEAD -- store-listing tools/store-screenshots shows only the pre-existing, pre-Phase-37 docs commit (cc74828), never a Phase 37 commit"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-17
status: complete
---

# Phase 37 Plan 04: Equipment Slot Model & eff() Refactor — Shell Wiring & Phase Close Summary

**Put the worn model on the screen and closed the phase: the classic script's `eff(key)` duplicate now delegates to the engine's two-path `eff`, worn rows join the Gear tab's existing worn area with Use/Unequip, EQUIP on an occupied slot arms a two-tap `Swap for {worn name}?` confirm mirroring the Phase 33 Drop pattern, `window.mzUseItem`/`COMBAT_DISPATCH` learned the slot form for worn activatables, the ENTER-to-resume path surfaces Plan 03's one-shot reconciliation report as a GEAR rail card + Oracle line, `docs/GEAR-SLOTS.md` declares the canon change, and the phase gate closes green with the aggregated Pixel 7 checklist for all four plans below.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-17T19:47:27Z (Plan 03 completion marker)
- **Completed:** 2026-09-17T20:12:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified) + this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit

## Accomplishments

- `mazeworld.html`'s classic `function eff(key)` (~3539) now opens with `const f = window.__mzEff; if (f) return f(S.c, key);` before its untouched legacy loop — every one of the eleven classic-script callers (map radius, charges, to-hit, damage, upkeep, greed, throw, spellDmg, tongue) inherits the engine's worn-aware rule the instant an item leaves the bag for `c.worn`, closing the "a worn Amulet of Light stops widening the map radius" gap the plan objective named. The trailing module block's `derived.js` import gained `eff`, `slotFor`, `WORN_SLOTS`, bridged as `window.__mzEff`/`window.__mzSlotFor`/`window.__mzWornSlots` directly after `window.__mzConditionsOf`.
- Gear tab: a new paint-local `wornSlotRow(slot, it)` (never touching the pinned `wornRow` weapon/armor helper) renders one `<li class="mw-worn">` per populated `c.worn[slot]` — name, `· N sq` cooldown text using the same `it.every`/`it.usedAt`/`S.steps` arithmetic as `renderCarriedList`'s rows, the item's `txt`, a `Use` button for activatables (`window.mzUseItem?.({ slot })`), and `Unequip`/`Bag full` (dimmed on a full bag) exactly like the armor row — looped over `window.__mzWornSlots` directly after the armor `wornRow` call and before `renderCarriedList`.
- `renderCarriedList` gained `mkSwapConfirm(i, wornName)` directly after `mkDropConfirm` — a byte-for-byte structural mirror (its own `SWAP_CONFIRM_MS`/`swapConfirmRevert`/`revertSwapConfirm()` trio placed below the Drop trio, its own `.mw-swap-confirm` class/CSS rule so the Phase 33 `mw-drop-confirm` count pin stays exactly 2) except the label (`Swap for {worn name}?`), the Yes action (`window.mzEquipItem?.(i)` — a genuine swap, not a drop), and the listener name (`onSwapTap`). The equip branch now reads: weapon/armor Equip byte-identical, then `else if (S.c.worn && window.__mzSlotFor?.(it))` arms `mkSwapConfirm` when the slot is occupied or plain `Equip` when empty.
- `window.mzUseItem` now takes a `ref` (bag index or `{ slot }`), resolving `params = ref && typeof ref === "object" ? { slot: ref.slot } : { i: ref }` before dispatching through `engineCombatAction`/`inventoryAction` identically to before; `COMBAT_DISPATCH.useItem` forwards `d.slot` when present, `d.i` otherwise — so a worn staff/cloak is usable from both the Gear tab and the fight's ITEMS submenu (Plan 03's `combatMenu.js` worn rows already build the `{ slot }` dispatch payload).
- `surfaceWornReconcile()` (new, directly above `initTitleScreen`) calls `wornReconcileCard(takeBootWornReport())`; when a card results it pushes it via `window.mzRailLine?.(card.title, card.line, card.tone, card.hold, card.icon)` and logs the same line via `window.logLine?.(card.line)` — never a toast. `enterBtn.onclick`'s resume branch is now `if (resumeIntent) { surfaceWornReconcile(); return; }`.
- `docs/GEAR-SLOTS.md` (new, 7 `##` sections): the declared canon change (stacking → one per slot) with rationale and fixture-impact proof, the 24-row slot taxonomy table, the model (`c.worn`, `carriedItems`, the two-path `eff`), play rules (auto-wear, the direct swap, `unequipSlot`, the staff class gate, the `notWorn` refusal row), old-save reconciliation (the option gate's surfaced-assumption rationale, the locked reconciliation copy in a blockquote), the full `eff()` call-site inventory copied verbatim from 37-01-PLAN.md, and out-of-scope/next (Phases 39/42/43).
- `test/unit/shell-worn-slots.test.js` (new, 12 tests): the SWAP trio's position, the swap-confirm mechanics alongside the re-asserted Phase 33 Drop pins, the equip branch's weapon/armor-byte-identical + new slot-branch reads, the worn rows' position/dispatch/loop, classic `eff` routing, the derived.js bridges, `mzUseItem`'s slot form, the resume-time `surfaceWornReconcile` call site + its imports, the new CSS (with the `.mw-drop-confirm` rule re-pinned byte-identical), voice safety, and a build-artefact sanity check. `test/unit/shell-combat-actions.test.js`'s `useItem` regex re-pinned to the `d.slot !== undefined` form.
- Full gate: `npm test` 2388/2388 (`# fail 0`), `npm run build:www` exit 0, `test/parity/fixtures` untouched, `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`), `git diff --stat -- package.json package-lock.json tools` empty, `grep -c fonts.googleapis mazeworld.html` = 0, the cumulative `git diff --stat 6671921 -- engine content src mazeworld.html docs` footprint is exactly the declared 15 files, `store-listing/`/`tools/store-screenshots/` never staged in any Phase 37 commit (the one pre-existing commit touching them, `cc74828`, predates Phase 37 entirely), a live `node -e` proof that `newRun(2)` has no `worn` key while `newRun(2, [], { wornSlots: true })` wears the Cloak of Regeneration.

## Task Commits

Each task was committed atomically:

1. **Task 1: mazeworld.html — classic eff routing, bridges, worn slot rows, EQUIP + swap confirm, mzUseItem/COMBAT_DISPATCH slot forms, resume-time reconciliation card, CSS** — `fd7b242` (feat) — `feat(37-04): classic eff routing, worn slot rows, EQUIP swap confirm, mzUseItem/COMBAT_DISPATCH slot forms, resume reconciliation card`
   - `mazeworld.html`
2. **Task 2: test/unit/shell-worn-slots.test.js source pins + the COMBAT_DISPATCH re-pin** — `c6a402f` (test) — `test(37-04): shell-worn-slots source pins + COMBAT_DISPATCH.useItem re-pin`
   - `test/unit/shell-worn-slots.test.js` (new, 12 tests), `test/unit/shell-combat-actions.test.js`
3. **Task 3: docs/GEAR-SLOTS.md canon ledger, Phase 37 closing gate, aggregated Pixel 7 checklist** — this commit (docs) — the phase gate re-verified green, no source files changed beyond the doc.
   - `docs/GEAR-SLOTS.md` (new)

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: this plan's tasks are `type="auto"` (no `tdd` flag) — Task 1's shell edit was verified against its own acceptance-criteria greps and the four pre-existing shell test files (47/47 green) before Task 2's source-pin file was authored, per the plan's stated Task 1 verification step ("expect exactly ONE failure before Task 2 lands: the shell-combat-actions COMBAT_DISPATCH pin") — confirmed exactly one pre-existing failure at that point, resolved by Task 2's re-pin._

## Files Created/Modified

- `mazeworld.html` — classic `eff(key)` routing, three module bridges, `wornSlotRow`/the `WORN_SLOTS` loop, the SWAP trio, `mkSwapConfirm` + the equip-branch extension, `window.mzUseItem`'s slot form, `COMBAT_DISPATCH.useItem`'s slot forwarding, `surfaceWornReconcile()` + the ENTER-resume wiring, `.mw-swap-confirm` CSS
- `test/unit/shell-worn-slots.test.js` — new file, 12 tests: SWAP trio, confirm mechanics, equip branch, worn rows (two sections), classic eff routing, bridges, mzUseItem, resume surfacing, CSS, voice safety, build artefact
- `test/unit/shell-combat-actions.test.js` — `COMBAT_DISPATCH.useItem` regex re-pinned to the `d.slot !== undefined` form
- `docs/GEAR-SLOTS.md` — new file: the GEAR-03/GEAR-04 canon ledger (7 sections)

## Decisions Made

- **The swap confirm's unarmed button reads "Equip"** (not a pre-labelled "Swap"), matching the plan's own locked flow: tapping EQUIP on an occupied slot is what arms the `Swap for {worn name}?` confirm, not a separately-styled row — mirrors the empty-slot Equip button exactly until tapped.
- **`wornSlotRowRegion()`'s narrower slice** in the new test file avoids a false "twice, not once" reading on `window.mzUnequip?.(slot)` — wornRow's own pre-existing, byte-identical call to the same literal sits earlier in the same paint carry block; the narrower region isolates just the new wornSlotRow code so the "once" pins are accurate to what Plan 04 actually added, not what already existed.
- **`docs/GEAR-SLOTS.md`'s locked reconciliation sentence lives in a markdown blockquote**, not inline prose — a first draft let the sentence word-wrap across a line break, which silently broke the doc's own literal `grep -c "Physics has filed a complaint"` acceptance check; the blockquote keeps the full sentence on one line.

## Deviations from Plan

None — plan executed exactly as written. Every locked API surface (the `SWAP_CONFIRM_MS`/`swapConfirmRevert`/`revertSwapConfirm`/`onSwapTap` names, `mkSwapConfirm`'s signature and copy, `wornSlotRow`'s field order, `window.mzUseItem`'s `ref`-resolution ternary, `COMBAT_DISPATCH.useItem`'s forwarding, `surfaceWornReconcile`'s body, the CSS rule bodies, the docs ledger's declared sections) matches the plan verbatim.

## Issues Encountered

One doc-authoring correction during Task 3: the first draft of `docs/GEAR-SLOTS.md`'s reconciliation-copy paragraph let "Physics has filed a complaint" word-wrap across a markdown line break (prose fill at ~72 chars), which made the acceptance criterion's literal `grep -c "Physics has filed a complaint"` return 0 instead of 1. Caught by re-running the acceptance greps before committing; fixed by moving the locked sentence into its own blockquote line. No source code was affected — this was purely a documentation-formatting fix.

## Success Criteria Map (ROADMAP SC-1..4)

| SC | Text | Landed in | Proof |
|----|------|-----------|-------|
| 1 | Equipping a second ring/cloak/staff/bracelet while one of that type is already worn prompts an explicit swap choice instead of silently stacking both | 37-02 (engine: `equipItem`'s direct-swap branch) + 37-04 (shell: `mkSwapConfirm`'s two-tap `Swap for {worn name}? [Yes] [No]`) | `test/unit/worn-slots.test.js` (equipItem swap section); `test/unit/shell-worn-slots.test.js` (confirm-mechanics + equip-branch sections) |
| 2 | A player's total bonuses (armor, magic effects) reflect only the currently worn one-per-slot set — no double-counting from two copies of the same slot type | 37-01 (engine: two-path `eff`) + 37-04 (shell: classic `eff(key)` routed through `window.__mzEff`) | `test/unit/worn-model.test.js` (eff new-model sum tests); `test/unit/shell-worn-slots.test.js` (classic eff-routing test) |
| 3 | Loading a save created before this phase that illegally has two items of one slot type does not crash; the extra item is narrated into the bag on load | 37-03 (engine: option-gated `reconcileWorn` migration + `wornReport`, `takeBootWornReport`, `wornReconcileCard`) + 37-04 (shell: `surfaceWornReconcile()` on the ENTER-to-resume branch) | `test/unit/worn-migration.test.js` (synthetic illegal-save migration + report shape); `test/unit/shell-worn-slots.test.js` (resume-surfacing section) |
| 4 | Every pre-existing gear/`eff()` code path (armor, weapons, potions) behaves identically to before for any save or fixture that was already slot-legal | All four plans | The pinned legacy-equivalence table (37-01) over every chargen fixture seed; the five-entry-point legacy-identity sweep on a real `newRun(3)` state (37-02); `npm test` `# fail 0` at every plan's gate with `test/parity/fixtures` untouched and `prototype-master.js.txt`'s hash unchanged throughout (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`) |

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol: no device pause was taken anywhere in Phase 37. The following checks are the phase's full aggregated Pixel 7 checklist, grouped by plan and numbered continuously, for the milestone-close UAT batch. `adb install -r` + `am force-stop` + relaunch and the APK build itself happen at milestone close, not in this phase.

### Plan 01

Nothing to add — a pure engine-model/data plan with zero player-visible behaviour. No fixture, bot run, or existing `newRun(seed)` caller anywhere in the shipped codebase creates a `worn` key; a normal run through chargen, a fight, a floor change, and taking/using a jewelry/cloak/staff item was expected to look, sound, and play identically to the pre-Phase-37 build, and this plan's own device-testable behaviour is what Plan 04's checklist below exercises.

### Plan 02

Nothing to add on its own — this plan's engine behaviours (the equip swap, auto-wear at every take site, the `notWorn` refusal) had no shell path to reach them yet. Every one of them is exercised through Plan 04's UI in the checklist items below.

### Plan 03

1. Resume a pre-Phase-37 save carrying two of one slot type (e.g. two Rings of Power) — the GEAR rail card reads "You were wearing two rings on one finger. Physics has filed a complaint — Ring of Power is in your bag now.", the same line appears in the Oracle log, and the card shows exactly once per boot (a second ENTER or a fresh roll shows nothing).
2. Resume a clean pre-Phase-37 save (nothing doubled, or a save that already has `worn`) — no reconciliation card appears.
3. Start a brand-new run as a Thief — the starting cloak is already worn (the Gear tab's worn area shows it, not the bag) with no extra tap.
4. Fight with a worn activatable staff/cloak/jewelry item — it appears in the combat ITEMS submenu and is usable via the engine's existing cooldown rules; the same item bagged (not worn) instead shows a refusal ("Wear it first" / the `notWorn` copy) when tapped.

### Plan 04

5. Open the Gear tab with at least one worn slot item — the worn row reads `name · txt` with a `[Use]` button (activatables only) and an `[Unequip]` button, formatted like the existing weapon/armor rows.
6. Tap EQUIP on a second Ring of Power while one is already worn — the row shows `Swap for Ring of Power? [Yes] [No]`.
7. Tap No on the swap confirm — reverts to the EQUIP button.
8. Arm the swap confirm and wait 3 seconds without tapping anything — reverts to the EQUIP button.
9. Arm the swap confirm and tap anywhere else on screen — reverts to the EQUIP button. (Only ever one row armed at a time — arming a second row anywhere in the list disarms the first.)
10. Tap EQUIP → Yes on the same occupied slot — the swap lands, the Oracle log reads a line naming the displaced item going back in the bag, and the previously-worn ring now shows an EQUIP button in the bag list.
11. Tap UNEQUIP on a worn item while the bag is full — the button reads "Bag full", is inert (dimmed, tap does nothing), exactly like the existing weapon/armor Unequip rows.
12. Pick up a cloak (find/loot/store/Thief kit) with an empty cloak slot — it auto-wears (no extra tap; the Gear tab shows it in the worn area) narrated as an Equipped-style line.
13. Pick up a second cloak with the slot now occupied — it goes to the bag instead, with an EQUIP button (not auto-swapped).
14. With a worn Amulet of Light, confirm the map's revealed radius stays widened (not narrowed back to the un-widened default) — proves the classic script's `eff("sight")` call is reading the worn model correctly via `window.__mzEff`.
15. On the Hero tab, confirm a worn Ring of Power's `+1 damage` is counted exactly once in the displayed damage bracket (not doubled by a second, bagged Ring of Power).
16. With TalkBack on, confirm the swap confirm's Yes/No buttons and the worn row's Use/Unequip buttons read their labels correctly (no unlabeled or mislabeled controls).

## Assumption-delta / rng / serialized-field statements (from plan frontmatter)

- **rng_draw_impact:** zero — confirmed by the full gate: the shell only dispatches existing engine actions (`equipItem`/`unequipSlot`/`useItem`'s slot form) through the same `dispatch()` → `applyAction()` seam every other Gear-tab/combat button already uses; the reconciliation card is built entirely from Plan 03's already-computed `takeBootWornReport()` return value, never from a fresh engine call.
- **serialized_field_impact:** none beyond `c.worn` (already carved out of every parity comparable in Plan 01). Every new shell-local state this plan adds (the SWAP confirm's armed/revert closures, the consumed one-shot boot report) is DOM-local or adapter-local — never a field on `S` (`serializeRun` spreads `S` wholesale).
- **canon_change:** none new in this plan — Plan 04 is the player-facing surface for the ONE deliberate canon change the phase declares in `docs/GEAR-SLOTS.md` §1 (stacking → one item per slot type, an occupied slot's equip is an explicit swap, activatables must be worn to work). Fixture impact: ZERO — the legacy sum-all-carried path is preserved byte-for-byte for every state without `c.worn` (fixtures, bots, un-migrated saves), proved throughout the phase by the pinned legacy table plus the untouched parity suite.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 37 is fully closed: both requirements (GEAR-03, GEAR-04) landed, `npm test` is green at 2388/2388, and the parity master/fixtures are byte-identical to before the phase.
- `WORN_SLOTS`/`slotFor`/`carriedItems`/the two-path `eff()` (37-01), `equipItem`/`unequipSlot`/`autoWearSlot`/`useItem`'s slot form (37-02), the `wornSlots` option + load migration + `takeBootWornReport`/`wornReconcileCard`/combat ITEMS worn rows (37-03), and this plan's full shell surface (worn rows, the swap confirm, the slot use form, the resume-time card, the classic `eff` bridge) are all complete and reusable as-is.
- Phase 39 (magic-item use → effect → cooldown chips) and Phase 43 (Gear ON YOU / BAG split) both have a real, tested worn set to build on. Phase 42's tuning-bot `wornSlots` wear/swap policy is unblocked whenever that phase starts.
- The 13-item aggregated Pixel 7 checklist above (plus Plans 01/02's "nothing to add" notes) is queued for the milestone-close UAT batch — no device steps or APK build were taken in this phase, per the standing `defer uat to end` protocol.
- No blockers.

---
*Phase: 37-equipment-slot-model-eff-refactor*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (`mazeworld.html`, `test/unit/shell-worn-slots.test.js`, `test/unit/shell-combat-actions.test.js`, `docs/GEAR-SLOTS.md`, this SUMMARY.md); both task commit hashes (`fd7b242`, `c6a402f`) found in `git log --oneline --all`.
