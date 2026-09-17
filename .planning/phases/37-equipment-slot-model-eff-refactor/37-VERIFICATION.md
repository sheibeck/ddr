---
phase: 37-equipment-slot-model-eff-refactor
verified: 2026-09-17T19:40:00Z
status: passed
score: 4/4 success criteria verified on automated evidence; every player-facing check (worn rows, swap confirm, auto-wear, reconciliation card) is deferred to the end-of-run Pixel 7 batch per the user's "defer uat to end" instruction
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7 (GEAR-04): resume a pre-Phase-37 save carrying two of one slot type (e.g. two Rings of Power) — the GEAR rail card reads 'You were wearing two rings on one finger. Physics has filed a complaint — Ring of Power is in your bag now.', the Oracle log carries the same line, and it shows exactly once per boot (a second ENTER or a fresh roll shows nothing)", "Pixel 7 (GEAR-04): resume a clean pre-Phase-37 save (nothing doubled) or one that already has worn — no reconciliation card", "Pixel 7 (GEAR-03, fresh run): start a new run as a Thief — the starting cloak is already worn (Gear tab worn area, not the bag) with no extra tap", "Pixel 7 (GEAR-03, combat): fight with a worn activatable staff/cloak/jewelry — it appears in the combat ITEMS submenu and is usable under the existing cooldown rules; the same item bagged instead shows the notWorn refusal ('Wear it first') when tapped", "Pixel 7 (GEAR-03, Gear tab): with at least one worn slot item, the worn row reads name · txt with [Use] (activatables only) and [Unequip], formatted like the weapon/armor rows", "Pixel 7 (GEAR-03, swap): tap EQUIP on a second Ring of Power while one is worn — the row shows 'Swap for Ring of Power? [Yes] [No]'", "Pixel 7 (GEAR-03, swap): No reverts; waiting ~3 s reverts; tapping anywhere else reverts; arming a second row disarms the first", "Pixel 7 (GEAR-03, swap): EQUIP → Yes on the occupied slot — the swap lands, the Oracle names the displaced item going back to the bag, and the displaced ring now shows EQUIP in the bag list", "Pixel 7 (GEAR-03, unequip): UNEQUIP on a worn item with a full bag reads 'Bag full' and is inert, exactly like the weapon/armor rows", "Pixel 7 (GEAR-03, take): pick up a cloak with an empty cloak slot (find/loot/store/Thief kit) — it auto-wears with an Equipped-style line and no extra tap", "Pixel 7 (GEAR-03, take): pick up a second cloak with the slot occupied — it goes to the bag with an EQUIP button, never auto-swapped", "Pixel 7 (GEAR-03, eff): with a worn Amulet of Light the map's revealed radius stays widened — the classic script's eff('sight') reads the worn model via window.__mzEff", "Pixel 7 (GEAR-03, eff): on the Hero tab a worn Ring of Power's +1 damage is counted exactly once, not doubled by a second bagged Ring of Power", "Pixel 7 (a11y, optional): with TalkBack on, the swap confirm's Yes/No and the worn row's Use/Unequip read their labels"]
gaps: []
---

# Phase 37 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-17)

Goal-backward check of the phase goal: *a player can wear only one item per slot type (ring, bracelet/anklet, amulet/pendant, helm/gauntlet, cloak, staff); equipping into an occupied slot is an explicit swap, not silent stacking; old saves with an illegal double-equip are reconciled on load without a crash or a silent loss; the widest-blast-radius change of the milestone (every `eff()` call site) lands alone, fully regression-tested.*

## Automated evidence (re-run by the orchestrator after 37-04)

- `npm test`: **2388/2388, 0 failures** (2276 at phase start → 2299 after 37-01 → 2344 after 37-02 → 2376 after 37-03 → 2388 after 37-04). `npm run build:www` exit 0 (37-04, the only plan that touched `mazeworld.html`).
- Engine gate: `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged); `git status --porcelain test/parity/fixtures` empty — no fixture regenerated. Cumulative `git diff --stat 6671921 -- engine content src mazeworld.html docs` = 15 files, 1029+/93−, exactly the declared touch-set. `tools/` (tuning bot) untouched — the v1.5 BEFORE pin stays like-for-like.
- Live proof (orchestrator `node -e`): `newRun(2).c.worn` is `undefined`; `newRun(2, [], { wornSlots: true }).c.worn` = `{ cloak: "Cloak of Regeneration" }` with an empty bag — the shell-only option is the sole path that creates the model.
- New rng draws: **zero** in every plan. New serialized field: `c.worn` only — lazily created, `stripWornField` in all three `*Comparable()` fns + the three per-domain local duplicates, `sanitizeWorn` load tolerance, option-gated migration that never injects without `{ wornSlots: true }` and never re-migrates.
- Declared canon change (GEAR-03: stacking → one per slot) recorded in `docs/GEAR-SLOTS.md` with fixture-impact proof (zero: the legacy two-path `eff()` keeps every fixture/bot/un-migrated save byte-identical; measured `LEGACY_EFF_PINS` = `{2:{cloakRegen:1}, 4:{cloakRegen:1}}` matched the pre-refactor sums exactly).
- Coverage guards green with the new `notWorn` reason, `itemEquipped.replaced` clause and `wornReconciled` rail copy; voice scan green (two new BRANCH_TOGGLES).
- Four plans, four SUMMARY.md files, none carrying `## Self-Check: FAILED`; working tree clean at HEAD `fde9003` apart from the two untracked user directories outside the phase.

## Success criteria → evidence

| # | Success criterion (ROADMAP) | Evidence |
|---|-----------------------------|----------|
| 1 | Equipping a second ring/cloak/staff/bracelet while one is worn prompts an explicit swap instead of silently stacking | `equipItem` cloak/jewel/staff branch does a direct swap into the freed bag index with additive `itemEquipped.replaced`; the shell's EQUIP row arms `Swap for {worn}? [Yes] [No]` (`SWAP_CONFIRM_MS` trio, `.mw-swap-confirm`) on an occupied slot; `worn-slots.test.js` 45 + `shell-worn-slots.test.js` 12. |
| 2 | Total bonuses reflect only the worn one-per-slot set — no double-counting | `eff()` sums `c.worn` entries only when the model exists; `carriedItems` routes `hasItemNamed`/`isFlying`; classic shell `eff(key)` delegates to `window.__mzEff`; the Plan 01 invariant test proves no populated slot's item is also in `c.items` and nothing outside `c.worn` is counted (`worn-model.test.js` 23). |
| 3 | Loading a pre-phase save with two of one slot type does not crash; the extra is narrated into the bag on load | `validateSave`/`rehydrate` migration under the boot-passed option: first copy worn, extras stay bagged (never overflows), `wornReport` returned once; `engineAdapter.takeBootWornReport()` → `surfaceWornReconcile()` → GEAR rail card + Oracle line on the resume branch; `worn-migration.test.js` 18, `engineAdapter.test.js` +6, `rail.test.js` +7. |
| 4 | Every pre-existing gear/`eff()` path behaves identically for any slot-legal save or fixture | Legacy-equivalence pins on every chargen seed; the five-entry-point legacy-identity sweep against a real `newRun(3)` state (37-02 Task 3); exported `JEWELRY`/`CLOAKS`/`STAVES` tables byte-identical (slot lives in `SLOT_OF`); parity suites unchanged; the `eff()` call-site inventory (19 engine reads + `viewModels.js:47` + the classic `eff(key)` and its 11 callers) recorded in `docs/GEAR-SLOTS.md`. |

## Requirements

GEAR-03 ✓ · GEAR-04 ✓ — automated halves verified; on-device halves in the frontmatter `human_verification` list (14 items, from the 16-item aggregated checklist in 37-04-SUMMARY.md).

## Accepted planner deviations (recorded in plan frontmatter, honoured by the executors)

- The `slot` is authored on every content row but exposed through the name-keyed `SLOT_OF` lookup rather than spread onto rolled item objects — a literal field would have shifted the Thief chargen fixtures and a frozen economy fixture that declares a Cloak of Ether without it.
- The load migration is gated on the same shell-only `wornSlots` option the boot path always passes, so every real player save migrates (GEAR-04 holds on device) while direct `rehydrate` test contracts stay byte-identical; one declared assertion update in `engineAdapter.test.js` (boot-rehydrates-a-save now expects `worn`).

## Follow-ups noted (not gaps)

- `state.update-progress` reports "Progress field not found in STATE.md" (a pre-existing in-body marker quirk; the frontmatter `progress:` block is maintained by `phase.complete`).
- The tuning bot still runs the legacy model — Phase 42 passes `{ wornSlots: true }` plus a wear/swap policy before the AFTER matrix.
