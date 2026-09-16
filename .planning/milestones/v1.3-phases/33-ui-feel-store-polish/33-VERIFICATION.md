---
phase: 33-ui-feel-store-polish
verified: 2026-09-16T18:00:00Z
status: passed
score: 5/5 in-scope requirements verified (UIF-01, UIF-02, UIF-03, UIF-05, STORE-01) — automated evidence; UIF-04 dropped from v1.3 by user decision (tutorial UI unwired; → UX-06 backlog); on-device confirmation deferred to the end-of-run UAT batch
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7 (STORE-01): NEW run at depth 1, first store — Healing + three cheap utility potions from {Cure Poison, Strength, Cure Disease, Enlarge}, two weapons ≤ 250, at most Leather; header shows the 'Stock rolled fresh for this floor…' line under the purse", "Pixel 7 (STORE-01): dev start-at-depth 9 (Settings → long-press version) — pricier weapons (400+ band), Plate offered to a lighter-mail Fighter, +3 premium, Acuteness possible", "Pixel 7 (STORE-01): leave and re-enter a store on the same floor — potions/weapons/premium re-roll; food/lockpicks/repair/scroll/Rations do not", "Pixel 7 (STORE-01): a pre-Phase-33 save, if any — store shows the old fixed four potions / two weapons and no roll line (flag off)", "Pixel 7 (UIF-01): Gear tab with a potion, spare weapon and treasure — each row shows name/detail, then Use/Equip immediately left of Drop, Drop flush right, all ≥ 48 dp", "Pixel 7 (UIF-01): tap Drop → 'Drop it? [Yes] [No]' in place; ~3 s revert; revert on any outside tap; No reverts; Yes drops (potion included); arming a second row un-arms the first", "Pixel 7 (UIF-01): worn weapon/armor rows still show Unequip, never Drop; a store with a full bag shows the Sell/Drop rows exactly as before", "Pixel 7 (UIF-05): Map tab — MAKE CAMP is the right-most chip of the Marks/Centre strip; the D-pad is centered alone under the map; camp dims when short on food and camps on tap", "Pixel 7 (UIF-05): Settings — no Handedness row; text size / sound / haptics / confirm-before-quit still round-trip", "Pixel 7 (UIF-03): cold start opens at the new default zoom (visibly closer, mid-range under pinch); pinch, kill, relaunch → back to default", "Pixel 7 (UIF-02): drag the map off the party, enter a store, Leave → centered; same after Move on / loot card / Joiner card; same after Hero/Gear/Oracle/Dead → Map; same after Settings Close and scrim tap", "Pixel 7 (UIF-02): two-finger pinch scales smoothly without snapping mid-gesture; on lift it recenters once"]
gaps: []
---

# Phase 33 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-16)

Goal-backward check of the phase goal: *the gear panel, map, toolbar layout, and store all get their remaining polish pass — done once against the finished combat UI.* (The tutorial toggle was removed from the goal by the user's UIF-04 decision.)

## Automated evidence (re-run by the orchestrator after 33-03)

- `npm test`: **1955/1955, 0 failures** (1902 at phase start → 1925 after 33-01 → 1941 after 33-02 → 1955 after 33-03). `npm run build:www` exit 0 (33-03).
- Parity: `test/parity/prototype-master.js.txt` hash `a1f4d0dc…` unchanged; zero fixture edits; the only `test/parity` diff is the six one-line `storeRoll` comparable strips (harness + three test-local copies). The economy fixture (seed 3, the only store-opening fixture) and the seed-3 unit pins replay byte-identical because `storeRoll` is a `newRun` OPTION only `engineAdapter#startNewRun` passes (the `dev` precedent) — fixtures, tools/ bots, `boot()`'s throwaway run and the fail-closed recovery all read `false`.
- Shell-only plans 33-02/33-03: `git diff --stat -- engine content test/parity` shows only 33-01's files. `grep -ci handedness` = 0 in `mazeworld.html` and `src/browser/settings.js`; `grep -c tutorial mazeworld.html` = 0.
- Three plans, three SUMMARY.md files, all `## Self-Check: PASSED`; working tree clean at HEAD `dca9f63`.

## Success criteria → evidence

| # | Success criterion (ROADMAP) | Evidence |
|---|-----------------------------|----------|
| 1 | Gear panel: Use and Drop side by side, Drop far right, confirm before drop | `renderCarriedList` `opts.gearRow` branch (GEAR call site only) re-parents buttons into `.mw-gear-actions` (Use/Equip left, Drop `margin-left:auto`); `mkDropConfirm` in-place "Drop it? [Yes] [No]" with `DROP_CONFIRM_MS = 3000` `setTimeout` + document capture `pointerdown` revert, single armed row; Drop dispatches the existing `dropItem` action (no new engine action); store/loot/combat hosts byte-identical (`test/unit/shell-gear-toolbar.test.js`, 16). |
| 2 | Map recenters on return from any full-screen panel; default zoom = midpoint | `let zoom = 1.5` (session-only); `window.mzCenterMap?.()` at the `renderEncounter` dismissal transition, `showTab("maze")`, `closeSettingsSheet`, and pinch release (`wasPinch`) — never in pointermove; total call count pinned at 10 (`test/unit/shell-map-store-polish.test.js`, 14). |
| 3 | Tutorial on/off setting | **Dropped from v1.3** (user decision 2026-09-16): the coach-mark sequencer in `src/browser/tutorial.js` has zero references in the shell and UX-06 is parked past this milestone — nothing to toggle. REQUIREMENTS/ROADMAP annotated; → UX-06 backlog. |
| 4 | Make Camp in the Marks/Centre row (far right); movement centered; handedness gone | `#btn-camp` is the last `.mw-chip` of `.mw-viewport-chips` (id/onclick/dim-state wiring untouched — `shell-party-camp` pins green); `.mazefoot` holds only the centered D-pad; Handedness settings row, `data-handedness` attribute/CSS, `settings.js` field and `ALLOWED_VALUES` entry deleted; a stale stored key is ignored silently (pinned in `settings.test.js`). |
| 5 | Store stock rolled randomly and floor-appropriately per visit; parity byte-identical | `state.storeRoll` (`engine/state.js#newRun` option, `validateSave`/`rehydrate` `!!obj.storeRoll`); `content/store-stock.js` allow-listed potion pools (trap potion excluded), weapon cost bands, armor cap ladder, premium bonus `[1,1,2,3]` — tier derived from the imported `BAG_FLOORS` 2/5/9; `openStore` flag-on block placed after every existing draw with in-place line replacement; draw-count contract flag-on = flag-off + (potionPool−1) + (weaponPool−1) pinned by rng-cursor equality (`test/unit/store-roll.test.js`, 18); header line `STORE_ROLL_COPY` only when `S.storeRoll === true`, BANNED-scan clean. |

## Requirements

UIF-01 ✓ · UIF-02 ✓ · UIF-03 ✓ · UIF-04 ✗ dropped (→ UX-06) · UIF-05 ✓ · STORE-01 ✓

## Milestone hand-off (from 33-03-SUMMARY)

PROJECT.md's "UI feel" bullet still lists the tutorial toggle — drop that clause when ticking it. Still open for a future feel pass: the 32-03 deliberately-unguarded button set (store rows, drop shelf, `a-evt`, `btn-again`, spell-menu buttons) and haptics on hit/kill. `storeRoll` is a tuning knob: tools/ bots run flag-off, so mass-playtest ledgers are unchanged by the rolled store.

## Deferred human verification

The twelve Pixel 7 checks in the frontmatter `human_verification` list (merged from the three SUMMARY.md sections) join the end-of-run UAT batch per the user's instruction for this autonomous run.
