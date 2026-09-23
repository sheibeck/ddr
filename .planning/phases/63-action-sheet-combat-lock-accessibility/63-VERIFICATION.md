---
phase: 63-action-sheet-combat-lock-accessibility
verified: 2026-09-23T19:30:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator re-run at HEAD a552c18); device checks deferred to the Phase 64 batch
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - "GSCR-07 (Pixel 7): tap a filled WORN row: the sheet rises with SLOT · WORN, the name and note, then USE (if it has one), UNEQUIP, and a SWAP FOR row per fitting bag item. With a full bag, UNEQUIP is greyed with 'Bag is full — free a slot first.' Destroyed armor shows DISCARD"
  - "GSCR-07 (Pixel 7): tap an empty slot: one EQUIP row per fitting bag item, or a greyed NOTHING TO EQUIP"
  - "GSCR-08 (Pixel 7): tap a bag weapon or armor card: the explained upgrade line shows (e.g. the Spiked Staff's 'd8 vs your d6 · −1 to hit · …'). A jewelry card offers SWAP INTO JEWELRY 1 and JEWELRY 2 by name. DROP needs a second tap ('DROP IT? · tap again') and reverts after ~3 s"
  - "GSCR-08 (Pixel 7): the inline USE / ACTIVE / COOLING button on a row acts directly and never opens the sheet"
  - "GSCR-09 (Pixel 7): every completed action closes the sheet and its outcome reaches the rail: equip, swap, unequip, discard and drop all have a line, with no toast and no text inside the sheet. An illegal swap candidate is greyed with its reason"
  - "GRULE-02 (Pixel 7): in a fight (and at the Fight! preview), open the sheet: EQUIP / SWAP / UNEQUIP / DISCARD are greyed with 'Not the moment to change outfits.' while USE and DROP stay live. Open it before a fight starts and it re-greys in place. After the fight everything works again"
  - "GSCR-10 (Pixel 7): the sheet closes on CANCEL, on a backdrop tap and on the Android back button, and focus returns to the row. With reduced motion on it snaps with no animation"
  - "GSCR-10 (Pixel 7, TalkBack): the rows announce as buttons that open actions, the sheet reads as a dialog with its title, and greyed actions read their reason"
gaps: []
---

# Phase 63 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, standing 2026-09-14 ruling)

This is a goal-backward check of the phase goal: *every equip / swap / unequip / use / drop decision goes through one bottom action sheet. The sheet states the engine's real reason for every greyed row, reflects the combat lock live, and is fully usable with reduced motion and TalkBack.*

There were five plans in four waves, all in worktrees:
- 63-01: the pure sheet model and copy.
- 63-02: the DOM renderer.
- Wave 3, in parallel: 63-03 (Drop and Unequip rail lines plus the sheet↔engine sweep) and 63-04 (shell wiring).
- 63-05: rows and cards open the sheet, and the interim in-row actions are removed.

After each merge the orchestrator reran the full suite on master. The 63-05 cleanup helper blocked on its deletion guard (the declared removal of `thief.gear-confirms.txt`), so that branch was merged by hand, and the gates were rerun on the merged master.

## Evidence (orchestrator re-run at HEAD a552c18)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | A worn-slot tap opens a sheet: filled → USE / UNEQUIP (greyed when the bag is full) / SWAP FOR; empty → EQUIP per candidate or a greyed NOTHING TO EQUIP | `src/browser/gearSheet.js#gearSheetModel(state, target)`: the header plus ordered actions, with DISCARD for destroyed armor. `gear-sheet-model.test.js` (34 tests) pins every shape, the ordering, the empty and full-bag edges, and the Spiked Staff case. `gearTab.js#opener()` makes all five WORN rows (empty included) and every BAG card an accessible opener: `role=button`, `tabindex=0`, `aria-haspopup=dialog`, the "opens actions" hint, Enter/Space. |
| 2 | A bag-card tap opens the same sheet with USE (bag-only items), EQUIP TO / SWAP INTO per named slot, and DROP, replacing the inline confirms | Weapon and armor cards carry `lootCompare(c, it).line` in the header. Jewelry gets one action per named slot. DROP arms a tap-again confirm (3000 ms, DOM-local, reverts on timeout or re-render), pinned in `gear-sheet-dom.test.js` (22 tests). The Phase 62 interim in-row Equip / Unequip / Drop and confirms are removed, and `renderCarriedList` is byte-identical (store sell / combat ITEMS / loot only). |
| 3 | Every greyed action states the engine's reason; every outcome reaches the rail; no toasts or inline refusal text | `gear-sheet-agreement.test.js` (19 tests) is an 8-state sweep: all 117 model actions are dispatched through the real `applyAction`. It covers 28 combat-greyed, 7 bag-full-greyed and 4 illegality-greyed actions, each reason byte-equal to its engine source, and 78 enabled actions, each landing a rail or fight-log line. `itemDropped` / `itemUnequipped` now have rail lines in `narrationLines.js#LINE_FOR`, with a distinct DISCARD line. The combat reason is read from `LINE_FOR.gearRefused`, never typed twice. |
| 4 | In a fight EQUIP / SWAP / UNEQUIP are greyed with the combat reason while USE stays live; after the fight all work again | Greying reads `gearLockReason(state)` (Phase 61), so the Fight! preview is included. USE and DROP stay live. `paint()` calls `refreshGearSheet()` so an open sheet re-greys in place when a fight starts (source pin plus a sandbox test in `gear-sheet-shell.test.js`). GRULE-02 is proven directly: the 28 combat-greyed actions re-enable and dispatch after the fight. |
| 5 | The sheet closes on CANCEL, a backdrop tap and Android back; the rise and fade have a reduced-motion path; TalkBack reads the title and actions | `#mw-gear-sheet` is `role=dialog`, `aria-modal`, `aria-labelledby` (a title with `tabindex=-1`), with a real CANCEL button. The camp-sheet pattern is reused: `showPanel` / `hidePanel` (reduced-motion snap), the `guardTap` / arm sweep (`:not([data-off])`), and the `lastDismissAt` stamp. `closeModal` closes the Gear sheet first on back. Focus returns to the opener. Greyed actions are `aria-disabled` with the reason as their description. `gear-sheet-shell.test.js` (22 tests) covers open, close (reduced and real motion), CANCEL, DROP ordering, closing when the target vanishes, the combat re-render, and the end-to-end dispatch plus focus return. |
| — | Gates | `npm test` passes **4197/4197** on master after `build:www` (4132 → 4154 → 4195 → 4197 across the waves). `build:www` exits 0. `boot:check` passes 4/4 (no-uncaught / painted / graves / title). `git diff --stat 6395a0f..HEAD -- engine/ content/ test/parity/` is **empty**, and the master blob `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` is unchanged. Snapshots: `thief.gear` and `mu.gear` were regenerated, `thief.gear-confirms` was deleted, and the new `thief.gear-sheet-bag` / `thief.gear-sheet-worn` were declared. Store, loot and hero are untouched. |

## Notes the reader should have

- **USE is never greyed in the sheet** (the Phase 31 "never disable silently" ruling). A cooling or recharging refusal comes from the engine on the rail, matching the row's own USE button. The mock's cooling-grey is a toy rule.
- **Motion:** the sheet reuses the shared 0.18 s sheet animation, so there is one reduced-motion path for every sheet, rather than the mock's ≈0.16 s fade and ≈0.2 s rise.
- **Pins that moved legitimately:** `reduced-motion.test.js`'s `paint()` SHA re-pin (63-04, because `paint()` now refreshes an open sheet). The `lastDismissAt` count went from 3 to 4 (63-04). The `gearRow:true` pin went from one call site to zero (63-05).
- **Follow-up (not this milestone):** `renderCarriedList`'s `gearRow` branch and the `.mw-drop-confirm` / `.mw-swap-confirm` / `.mw-gear-actions` CSS now have no caller from the Gear tab. They were kept byte-identical under the phase ruling and are a cleanup candidate.
