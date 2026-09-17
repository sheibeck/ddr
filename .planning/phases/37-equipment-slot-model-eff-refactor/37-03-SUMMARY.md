---
phase: 37-equipment-slot-model-eff-refactor
plan: 03
subsystem: engine
tags: [worn-slots, new-run-option, save-migration, reconciliation-report, adapter, rail-copy, combat-items-submenu, deferred-uat]

# Dependency graph
requires:
  - phase: 37-01
    provides: "WORN_SLOTS, slotFor(it), carriedItems(c), reconcileWorn(c), the two-path eff() and the c.worn parity carve-out"
  - phase: 37-02
    provides: "equipItem/unequipSlot slot branches, autoWearSlot/wearItem at the four take sites, useItem slot addressing + notWorn refusal"
provides:
  - "engine/state.js: newRun's wornSlots option (shell-only, storeRoll precedent) calling reconcileWorn(c) — creates c.worn and wears the Thief's starting cloak, zero rng draw"
  - "engine/saveState.js: sanitizeWorn(c) on both load chains; validateSave(raw, { freshSeed?, wornSlots? }) returning { ok, value, wornReport? }; rehydrate(obj, { wornSlots? }) — the option-gated load-time migration, never re-migrates, never overflows, never injects without the option"
  - "src/browser/engineAdapter.js: boot()/startNewRun() pass wornSlots: true; module-level bootWornReport + export takeBootWornReport() (one-shot read, then null)"
  - "src/browser/rail.js: RAIL_COPY.wornReconciled + WORN_RECONCILE_HOLD + wornReconcileCard(report) — the pure reconciliation-card builder"
  - "src/browser/combatMenu.js: worn activatable rows in the ITEMS submenu (id worn-{slot}, dispatch { type: 'useItem', slot }), appended after carried rows, passive worn items excluded"
  - "test/unit/worn-migration.test.js (new, 18 tests): option/legacy-identity, the Pitfall 8 synthetic illegal-old-save migration + report shape, the bag-cap-never-overflows proof, never-re-migrated/never-injected, tolerance, idempotence, staff class gate"
affects: ["37-04 (mazeworld.html worn rows/EQUIP/UNEQUIP/swap confirm/reconciliation card wiring, phase gate)", "39 (magic items)", "43 (Gear ON YOU/BAG split)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "newRun's wornSlots option mirrors storeRoll exactly: false/omitted by every fixture/bot/tools/test caller, true only from engineAdapter#startNewRun — a plain reassignment pass with zero rng draw"
    - "the load-time migration lives beside migrateCarry/clearFoeEffect/clearStaleTimers in saveState.js but is option-gated (not unconditional) so the six standing rehydrate round-trip contracts stay untouched; validateSave/rehydrate both gate on options.wornSlots === true and both call the SAME reconcileWorn, which is itself idempotent (a c that already has worn is a no-op)"
    - "the reconciliation report is a RETURN VALUE (validateSave's wornReport key, attached only when the migration ran), never a serialized field — sanitizeWorn (tolerance) is unconditional on presence, reconcileWorn (creation) is option-gated, and the two never overlap in what they touch"
    - "bootWornReport is a module-level, non-serialized adapter value consumed on read via takeBootWornReport() — the exact same one-shot-then-null posture the codebase already uses for missSeq-adjacent state"

key-files:
  created:
    - test/unit/worn-migration.test.js
  modified:
    - engine/state.js
    - engine/saveState.js
    - src/browser/engineAdapter.js
    - src/browser/rail.js
    - src/browser/combatMenu.js
    - test/unit/engineAdapter.test.js
    - test/unit/rail.test.js
    - test/unit/combatMenu.test.js

key-decisions:
  - "The one declared test-contract update (engineAdapter.test.js's boot-rehydrates-a-save assertion) landed exactly as the plan's frontmatter pre-authorized: boot() IS the shell's real load path and now migrates every legacy save, so state.c gains worn: {} when nothing was wearable."
  - "wornReconcileCard is a standalone, directly-built card (mirrors railLineCard's posture) rather than routed through railCardFor's fold pipeline — the migration is a load-time event, not an applyAction dispatch the fold pipeline ever sees."
  - "Combat ITEMS test for worn-row ordering asserts the full row-id array including the always-present potion row (['potion','item-0','worn-cloak']) rather than a two-element slice — combatMenu.js unconditionally shows the potion row whenever usableCount !== 0, regardless of c.potions' value, so a worn-only-vs-carried-only comparison without the potion row would misdescribe the real shape."

requirements-completed: [GEAR-03, GEAR-04]

coverage:
  - id: D1
    description: "newRun(seed, exclude, { wornSlots: true }) creates c.worn wearing the Thief's starting cloak with zero rng draw; every newRun(seed) caller without the option (every fixture/bot/tools/test) never creates c.worn and stays byte-identical"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-migration.test.js (Task 1a section, 4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "engine/saveState.js's option-gated load migration (validateSave/rehydrate) reconciles a synthetic pre-Phase-37 illegal save (two rings, two cloaks) into worn/bagged with a matching reconciliation report; never re-migrates a save that already has worn; never overflows the bag; never injects worn without the option; tampered worn values are neutralised on every load"
    requirement: GEAR-04
    verification:
      - kind: unit
        ref: "test/unit/worn-migration.test.js (Task 1b-1f sections, 14 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "engineAdapter#boot() migrates a stored legacy save (state.c gains worn) and takeBootWornReport() returns the report exactly once (second call null); startNewRun() produces a state whose c has worn; initRun(seed) does not"
    requirement: GEAR-04
    verification:
      - kind: unit
        ref: "test/unit/engineAdapter.test.js (Phase 37/GEAR-04 section, 6 assertions across the boot/startNewRun tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "rail.js exports wornReconcileCard(report): null for null/[]/all-empty-bagged reports; builds the exact locked-copy sentence for one/multiple bagged extras (incl. the 7+ digit fallback and multi-slot join); every RAIL_COPY.wornReconciled leaf passes the BANNED voice scan; the builder is pure (never mutates its argument)"
    requirement: GEAR-04
    verification:
      - kind: unit
        ref: "test/unit/rail.test.js (Phase 37/GEAR-04 section, 7 tests) + the existing voice-scan/purity tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "combatMenuViewModel lists a worn activatable (e.g. c.worn.staff with use) as an ITEMS row { id:'worn-staff', dispatch:{ type:'useItem', slot:'staff' } } counted in usableCount and appended after carried rows; a worn passive (no use) is never listed; a legacy c (no worn key) produces zero worn rows"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/combatMenu.test.js (Phase 37/GEAR-03 section, 4 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm test ends # fail 0; fixtures/test/parity/prototype-master.js.txt untouched (hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0 unchanged); tools/lib/tuning-bot.mjs byte-unchanged; store-listing/ and tools/store-screenshots/ never staged"
    requirement: GEAR-04
    verification:
      - kind: other
        ref: "npm test (2376/2376, # fail 0); git hash-object test/parity/prototype-master.js.txt unchanged; git status --short store-listing tools/store-screenshots empty"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-09-17
status: complete
---

# Phase 37 Plan 03: Equipment Slot Model & eff() Refactor — Load Migration & New-Run Option Summary

**Made the worn model REACHABLE for real players: `newRun`'s shell-only `wornSlots` option creates `c.worn` on a fresh roll (Thief wears the starting cloak), `saveState.js`'s option-gated migration reconciles any illegal pre-Phase-37 save into a legal one-per-slot state with a returned reconciliation report, `engineAdapter` exposes that report once per boot, and `rail.js`/`combatMenu.js` give the shell the copy and the combat-usable rows to surface it — zero fixture/bot/tools byte moves.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-17 (Plan 02 completion marker)
- **Completed:** 2026-09-17T19:44:44Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified) + this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit

## Accomplishments

- `engine/state.js`: `newRun` gains a `wornSlots = false` option (mirroring `storeRoll`'s shell-only precedent) — when true, calls `reconcileWorn(c)` directly after the character roll, creating `c.worn` and wearing a Thief's starting cloak with zero rng draw, so the seeded chargen cursor and every fixture/bot/tools/test caller (`newRun(seed)` without the option) stay byte-identical. Confirmed live: `newRun(2,[],{wornSlots:true}).c.worn.cloak.n === newRun(2).c.items[0].n`, `rngState` unchanged, `floor` unchanged.
- `engine/saveState.js`: `sanitizeWorn(c)` (new, module-private, mirrors `clearStaleTimers`) neutralises a present-but-tampered `c.worn` (`"999"`/`[]`/`null`/`7` → `{}`; a non-object entry inside a genuine map is dropped) on BOTH load chains, unconditionally — never injects a missing key. `validateSave(raw, { freshSeed?, wornSlots? })` gains an option-gated `reconcileWorn(value.c)` call after building `value`; the result carries a `wornReport` key ONLY when the migration ran (`[]` when nothing was wearable, an array of `{ slot, worn, bagged }` entries otherwise) — never a serialized field. `rehydrate(obj, { wornSlots? } = {})` gains the mirrored option-gated call; since `reconcileWorn` is itself a no-op on a `c` that already has `worn`, calling both `validateSave` then `rehydrate` with the option never double-migrates.
- `src/browser/engineAdapter.js`: `boot()` now passes `wornSlots: true` to both `validateSave` and `rehydrate` — every real load migrates a legacy save — and stashes the returned report on a new module-level `bootWornReport`. `takeBootWornReport()` (new export) returns it once, then resets to `null`. `startNewRun()` passes `wornSlots: true` (mirrors `storeRoll`) so every shell-started run creates `c.worn` on the fresh roll; `boot()`'s throwaway pre-title fallback run and `dispatch()`'s fail-closed recovery run deliberately do NOT pass the option.
- `src/browser/rail.js`: `RAIL_COPY.wornReconciled` (title "GEAR", a template line, and the six `WORN_SLOTS` plural noun-phrases) + `WORN_RECONCILE_HOLD = 6000` + `wornReconcileCard(report)` — a pure builder returning `null` for a missing/empty/all-clean report, otherwise one locked-copy sentence pair per bagged-extra slot (spelled-out counts up to six, digit fallback at seven+), joined with a single space. Confirmed live against the plan's exact locked line: "You were wearing two rings on one finger. Physics has filed a complaint — Ring of Power is in your bag now."
- `src/browser/combatMenu.js`: imports `WORN_SLOTS` from `engine/derived.js`; builds `wornRows` over `WORN_SLOTS` for any `c.worn[slot]` with a `use`, using the same cooldown/cost/enabled math as `carriedRows`, `id: worn-${slot}`, `dispatch: { type: "useItem", slot }`; `wornRows.length` added to `usableCount`; rows appended AFTER `carriedRows` in the ITEMS submenu. A passive worn item (no `use`) is never listed; a legacy `c` (no `worn` key) contributes zero worn rows, byte-identical to before this phase.
- `test/unit/worn-migration.test.js` (new, 18 tests): the option's byte-identical-without-it proof across every chargen fixture seed, the Pitfall 8 synthetic illegal-old-save (two Rings of Power, two cloaks) migration + exact report shape, the bag-cap-never-overflows proof (a small bag at cap with two rings), never-re-migrated / never-injected-without-option, tolerance (four tampered `worn` values + a mixed-entry drop), idempotence (double-rehydrate, non-mutating JSON-string input), and the staff class gate (bagged on a Fighter, worn on a Magic User).
- `test/unit/engineAdapter.test.js`: the ONE declared assertion update (`boot()` now migrates a pre-Phase-37 save — `state.c` gains `worn: {}`) plus new coverage for the two-Rings-of-Power migration + one-shot report, a no-op re-migration on an already-worn save, and `startNewRun()` vs `initRun(seed)`.
- `test/unit/rail.test.js` / `test/unit/combatMenu.test.js`: 7 + 4 new tests for the reconciliation card (null/empty/clean cases, single/multi bagged extras, 7+ digit fallback, multi-slot join, purity) and the worn ITEMS rows (ordering after carried rows, passive exclusion, ready-with-no-`usedAt`, legacy zero-rows).
- Full gate: `npm test` 2376/2376 (`# fail 0`), `test/parity/fixtures` untouched, `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`), `store-listing/`/`tools/store-screenshots/` never staged, `tools/lib/tuning-bot.mjs` byte-unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: newRun wornSlots option + saveState.js sanitizeWorn / option-gated reconcileWorn / wornReport (tests first)** — `1ef17c4` (feat) — `feat(37-03): newRun wornSlots option + saveState.js sanitizeWorn/migration/wornReport`
   - `engine/state.js`, `engine/saveState.js`, `test/unit/worn-migration.test.js` (new, 18 tests)
2. **Task 2: engineAdapter — boot()/startNewRun() pass wornSlots, takeBootWornReport(); the one declared assertion update (tests first)** — `602fb39` (feat) — `feat(37-03): engineAdapter boot()/startNewRun() pass wornSlots + takeBootWornReport()`
   - `src/browser/engineAdapter.js`, `test/unit/engineAdapter.test.js`
3. **Task 3: rail.js reconciliation copy + wornReconcileCard(report); combatMenu.js worn activatable rows (tests first)** — `336a0ab` (feat) — `feat(37-03): rail.js reconciliation card + combatMenu.js worn activatable rows`
   - `src/browser/rail.js`, `src/browser/combatMenu.js`, `test/unit/rail.test.js`, `test/unit/combatMenu.test.js`

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: all three tasks (`tdd="true"`) ran genuine RED-then-GREEN gates — each test file/section was written and run against the pre-implementation code first (Task 1's `worn-migration.test.js` against the untouched `newRun`/`validateSave`/`rehydrate`; Task 2's declared assertion against the pre-migration `boot()`; Task 3's new rail/combatMenu sections against the pre-`wornReconcileCard`/pre-worn-rows modules), then all tests passed after implementation. One test-authoring iteration was needed in Task 3 (a worn-row-ordering test's expected id array was corrected to include the always-present `potion` row) — see Issues Encountered._

## Files Created/Modified

- `engine/state.js` — `newRun`'s `wornSlots` option
- `engine/saveState.js` — `sanitizeWorn`; option-gated `reconcileWorn` in `validateSave`/`rehydrate`; `wornReport`
- `src/browser/engineAdapter.js` — `boot()`/`startNewRun()` pass `wornSlots: true`; `takeBootWornReport()`
- `src/browser/rail.js` — `RAIL_COPY.wornReconciled`, `WORN_RECONCILE_HOLD`, `wornReconcileCard`
- `src/browser/combatMenu.js` — worn activatable ITEMS rows
- `test/unit/worn-migration.test.js` — 18 tests (new)
- `test/unit/engineAdapter.test.js` — declared update + 6 new assertions
- `test/unit/rail.test.js` — 7 new tests
- `test/unit/combatMenu.test.js` — 4 new tests

## Decisions Made

- **The one declared test-contract update landed exactly as pre-authorized** — `engineAdapter.test.js`'s boot-rehydrates-a-save assertion now expects `worn: {}` because `boot()` genuinely does migrate every real load; no other existing assertion was weakened.
- **`wornReconcileCard` is a standalone, directly-built card**, not routed through `railCardFor`'s event-fold pipeline — the reconciliation is a load-time, non-`applyAction` event, so it mirrors `railLineCard`'s "shell calls this directly" posture instead.
- **The worn-row-ordering combatMenu test asserts the full three-id row array** (`['potion', 'item-0', 'worn-cloak']`) rather than a two-element slice, since `combatMenu.js` unconditionally renders the potion row whenever `usableCount !== 0` regardless of `c.potions`'s value — this is the precise, byte-accurate description of "worn rows come after carried rows" for this codebase's actual behavior.

## Deviations from Plan

None — plan executed exactly as written. `reconcileWorn`/`WORN_SLOTS`/`slotFor`/`carriedItems` (Plan 01) and `equipItem`/`unequipSlot`/`autoWearSlot`/`useItem` slot addressing (Plan 02) were already fully built and unit-tested; this plan's three tasks landed the shell-facing surface on top of them with zero engine-model rework needed.

## Issues Encountered

None blocking. One test-authoring correction during Task 3: the first draft of the "worn row comes AFTER carried rows" `combatMenu.test.js` test expected `['item-0', 'worn-cloak']` (no potion row), which failed against the real implementation — `combatMenu.js`'s ITEMS assembly always includes a (possibly disabled) potion row whenever `usableCount !== 0`, independent of `c.potions`'s count. Corrected the expectation to `['potion', 'item-0', 'worn-cloak']` before committing; no source code change was needed, only the test's own literal expectation.

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol: this plan's engine/adapter/presentation work has real player-visible consequences for the first time in Phase 37 (Plans 01/02 were engine-model-only), but the shell (`mazeworld.html`) does not yet WIRE any of it — Plan 04 owns the resume-time reconciliation-card call site, the EQUIP/UNEQUIP swap-confirm UI, and the worn rows in the Gear tab. Nothing here is independently device-testable yet. The aggregated Pixel 7 checklist (to be finalized at Plan 04's close) will need to cover:

- **Resume a pre-Phase-37 save carrying two of one slot type** (e.g. two rings, or two cloaks) — the GEAR rail card names the item that went to the bag ("You were wearing two rings on one finger. Physics has filed a complaint — Ring of Power is in your bag now."); the card is dismissible and shows exactly once per boot.
- **Resume a clean pre-Phase-37 save** (nothing doubled, or a save that already has `worn`) — NO reconciliation card appears.
- **Start a brand-new run as a Thief** — the starting cloak is already worn (Gear tab shows it in the worn area, not the bag) with no extra tap.
- **Fight with a worn activatable staff/cloak/jewelry item** — it appears in the combat ITEMS submenu and is usable via the engine's existing cooldown rules; a passive worn item (e.g. a Ring of Power) is correctly absent from ITEMS.

## Assumption-delta / rng / serialized-field statements (from plan frontmatter)

- **rng_draw_impact:** zero — confirmed live: `newRun(2,[],{wornSlots:true}).rngState === newRun(2).rngState` and `.floor` deepStrictEqual; the load migration (`reconcileWorn`) is plain reassignment over already-validated `c.items`, no rng touched; every fixture/bot/tools/test caller of `newRun(seed)`/`validateSave`/`rehydrate` without the option is unaffected (full 2376/2376 `npm test` pass, including the untouched `save-validation`/`roundtrip`/`parity` suites).
- **serialized_field_impact:** `c.worn` only — created by `newRun({ wornSlots: true })` (shell new-game path) and by the option-gated load migration (`validateSave`/`rehydrate` with `{ wornSlots: true }`, passed only by `engineAdapter.boot`); a present-but-tampered `worn` is neutralised by `sanitizeWorn` on every load (never injected); the reconciliation report is a RETURN VALUE (`validateSave`'s `wornReport`), never a serialized field.
- **canon_change:** none new in this plan — GEAR-04's reconciliation is the load-time consequence of Plans 01/02's declared GEAR-03 change; zero fixture impact (fixtures never pass the option).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 can now wire `mazeworld.html`'s resume path directly to `takeBootWornReport()` + `wornReconcileCard()` (both fully tested and exported), the worn Gear-tab rows to `c.worn` (Plan 02's `equipItem`/`unequipSlot` slot branches are already behaviorally complete), and the swap confirm to `itemEquipped.replaced` (Plan 02).
- The combat ITEMS submenu already surfaces worn activatables correctly — Plan 04 needs only to wire the shell's `COMBAT_DISPATCH` to forward `action.slot` (already handled engine-side by `engine/engine.js`'s `useItem` dispatch, Plan 02).
- No blockers. GEAR-03 and GEAR-04 requirements are both structurally complete as of this plan; Plan 04 is the on-device-visible finish line and phase-gate close.

---
*Phase: 37-equipment-slot-model-eff-refactor*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (engine/state.js, engine/saveState.js, src/browser/engineAdapter.js, src/browser/rail.js, src/browser/combatMenu.js, test/unit/worn-migration.test.js, test/unit/engineAdapter.test.js, test/unit/rail.test.js, test/unit/combatMenu.test.js, this SUMMARY.md); all three task commit hashes (`1ef17c4`, `602fb39`, `336a0ab`) found in `git log --oneline --all`.
