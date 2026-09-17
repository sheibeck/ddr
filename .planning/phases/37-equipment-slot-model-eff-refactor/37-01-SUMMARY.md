---
phase: 37-equipment-slot-model-eff-refactor
plan: 01
subsystem: engine
tags: [worn-slots, eff-refactor, content-taxonomy, parity-carve-out, legacy-equivalence, deferred-uat]

# Dependency graph
requires: []
provides:
  - "content/treasure-tables.js: slot authored on every JEWELRY/CLOAKS/STAVES row (module-private *_ROWS arrays); exported JEWELRY/CLOAKS/STAVES stay byte-identical (slot stripped); frozen SLOT_OF (24 entries, name -> slot)"
  - "engine/derived.js: WORN_SLOTS, slotFor(it), carriedItems(c) (bag ∪ worn), reconcileWorn(c) (the load/newRun-option migration); eff(c, key) is two-path (worn-only when c.worn present, byte-identical legacy sum over c.items otherwise); hasItemNamed routed through carriedItems"
  - "test/parity/harness/comparables.js + the three per-domain local duplicates: c.worn carved out of every *Comparable() function as a structural tripwire (stripWornField)"
  - "test/unit/worn-model.test.js: taxonomy pins, slotFor/carriedItems specs, eff two-path, reconcileWorn, a MEASURED legacy-equivalence table over every chargen fixture seed, the companion invariant, and rng/parity proofs"
affects: ["37-02 (equip/unequip/useItem slot addressing)", "37-03 (load migration + newRun option + shell worn rows)", "37-04 (mazeworld.html bridges)", "39 (magic items)", "43 (Gear ON YOU/BAG split)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "c.worn follows the exact lazy-creation / never-injected-on-load / carved-out-of-all-comparables discipline established by c.foeEffect (Phase 19) and c.timers (Phase 36)"
    - "content data gains a taxonomy field (slot) authored on private *_ROWS but stripped from the exported item tables, mirroring the ECON-08 name-keyed-sibling-table precedent (engine/economy.js TREASURE_BASE_VALUES) so rolled item shapes stay byte-identical"
    - "eff(c, key) is a two-path function keyed on `'worn' in c` — the presence of the new field is itself the legacy/new-model switch, with zero new state.dev-style flag needed"

key-files:
  created:
    - test/unit/worn-model.test.js
  modified:
    - content/treasure-tables.js
    - engine/derived.js
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js

key-decisions:
  - "SLOT_OF is derived from the same *_ROWS arrays that produce JEWELRY/CLOAKS/STAVES (Object.fromEntries over row.n -> row.slot), so the taxonomy and the exported tables can never drift out of sync by hand-editing one without the other."
  - "reconcileWorn refuses to touch a c that already carries an own `worn` key, even an empty `{}` — proven by an explicit test (Task 3's companion-invariant state (c)) so the 'never re-migrate' contract is a genuine behavioral guarantee, not just documentation."
  - "eff()'s legacy branch is left byte-for-byte identical to the pre-refactor loop (no added null-guard on `it` itself) — only the new worn-path branch gets the extra defensive guards described in the threat model, so the legacy path's behavior for every existing fixture is provably unchanged by construction, not just by test coverage."
  - "The Task 3 invariant/legacy-equivalence/rng-invariance tests were authored together with Task 1's core test file in a single Write pass (not appended in a separate edit) — the plan's Task 3 action anticipates this ordering flexibility since RED/GREEN was already established before either commit; all 23 tests (Task 1's core suite + Task 3's companion-invariant/chargen-shape/rng-invariance tests) landed in the Task 1 commit and were verified against the plan's literal acceptance criteria unchanged."

requirements-completed: [GEAR-03]

coverage:
  - id: D1
    description: "content/treasure-tables.js exports SLOT_OF (24 entries, frozen) mapping every JEWELRY/CLOAKS/STAVES display name to its locked slot; no exported row (or any rolled item) ever carries a slot key"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-model.test.js (taxonomy + tripwire tests, 6 tests)"
        status: pass
      - kind: other
        ref: "node -e SLOT_OF introspection prints 24 true false; grep -c 'slot:' content/treasure-tables.js prints 24"
        status: pass
    human_judgment: false
  - id: D2
    description: "engine/derived.js exports WORN_SLOTS/slotFor/carriedItems/reconcileWorn; eff(c, key) is two-path (worn-only vs. the byte-identical legacy sum); hasItemNamed (and therefore isFlying/conditionsOf) reads bag ∪ worn"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-model.test.js (slotFor/carriedItems/eff/hasItemNamed/reconcileWorn sections, 15 tests)"
        status: pass
      - kind: other
        ref: "node -e derived.js introspection prints function function function [six slots]; grep -c '\"worn\" in c' >= 2; grep -c 'carriedItems(c).some' == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "for every chargen fixture seed, newRun(seed).c has no worn key and eff(c, key) equals a MEASURED pre-refactor pinned value for every EFF_KEYS entry (legacy-equivalence); the companion invariant proves no worn item is ever double-counted from the bag"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-model.test.js legacy-equivalence + companion-invariant + rng-invariance tests (3 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "c.worn is carved out of all three *Comparable() functions plus the three per-domain local comparable() duplicates as a structural tripwire; full suite stays green with zero fixture edits"
    requirement: GEAR-03
    verification:
      - kind: other
        ref: "npm test (2299/2299, # fail 0); git status --porcelain test/parity/fixtures empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; grep -c stripWornField comparables.js == 5; grep -c 'stripWornField(stripTimersField(' == 3; grep -c 'timers, worn, ...cRest' == 1 in each of the three local duplicates"
        status: pass
    human_judgment: false

# Metrics
duration: 22min
completed: 2026-09-17
status: complete
---

# Phase 37 Plan 01: Equipment Slot Model & eff() Refactor — Foundation Summary

**Landed the worn-slot data model and the wide-blast-radius `eff()` refactor with zero behaviour change: a name-keyed `SLOT_OF` taxonomy (24 entries) authored on content rows but stripped from the exported item tables, `engine/derived.js`'s `WORN_SLOTS`/`slotFor`/`carriedItems`/`reconcileWorn` plus a two-path `eff()`, and `c.worn` carved out of every parity comparable as a structural tripwire.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-17T18:56:00Z (phase execution marker)
- **Completed:** 2026-09-17T19:10:00Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified) + this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit

## Accomplishments

- `content/treasure-tables.js`: `slot` authored on every JEWELRY/CLOAKS/STAVES row in three module-private `*_ROWS` arrays; the exported `JEWELRY`/`CLOAKS`/`STAVES` are derived from those rows with `slot` stripped (byte-identical to the pre-Phase-37 literals — proven by a pinned-literal test), so every `Object.assign({ kind }, ROW)` construction site (rollJewel/rollCloak/rollStaff, the Thief's starting cloak, the three find offers) keeps producing item shapes with no `slot` key. New frozen `SLOT_OF` (24 entries: 8 JEWELRY + 8 CLOAKS + 8 STAVES) is the name-keyed runtime lookup.
- `engine/derived.js`: `WORN_SLOTS` (the frozen six-slot order), `slotFor(it)` (`it.slot` → `SLOT_OF[it.n]` → kind fallback for cloak/staff → null), `carriedItems(c)` (bag ∪ worn, defensive, never mutates), `reconcileWorn(c)` (the load/newRun-option migration, homed beside `clampCarry`; refuses to re-migrate a `c` that already carries a `worn` key; moves the first item of each slot type into `c.worn`, respecting the staff/Magic-User class gate; returns a `{ slot, worn, bagged }` report in `WORN_SLOTS` order or `[]`). `eff(c, key)` is now two-path: when `c` carries an own `worn` key, sums only over the populated `c.worn` entries; otherwise the exact pre-refactor loop over `c.items`. `hasItemNamed` routed through `carriedItems`, so `isFlying`/`conditionsOf`'s Bracelet/Cloak-of-Flying checks see a worn item exactly as they saw it in the bag.
- `test/parity/harness/comparables.js`: new `stripWornField(c)`, wired as the innermost-but-one wrapper directly around `stripTimersField(...)` in all three `*Comparable()` chains (movement/combat/economy) — a structural tripwire, since `c.worn` has no prototype-side equivalent and nothing in this plan's fixture/bot replay path ever creates one.
- `test/parity/{combat,magic,movement}-parity.test.js`: each file's local `comparable()` duplicate destructure extended to also drop `worn`.
- `test/unit/worn-model.test.js` (new, 23 tests): taxonomy pins (SLOT_OF shape + count, per-name mappings, byte-identical JEWELRY row literals, no-slot-on-rolled-items tripwire), `slotFor`/`carriedItems` specs, `eff` two-path (legacy sum + new-model worn-only sum + null-entry skip + JSON round-trip), `hasItemNamed`/`isFlying`/`conditionsOf` routing through a worn Bracelet/Cloak of Flying, `reconcileWorn` (swap-on-duplicate, staff/class gate, refusal-to-re-migrate, null-safety, exact report-key shape), a MEASURED legacy-equivalence table (`{2:{cloakRegen:1}, 4:{cloakRegen:1}}`, every other chargen seed all-zero — matched the plan's own predicted table exactly) over every chargen fixture seed, the companion invariant (no `c.worn[slot]` item is ever also present in `c.items`, and `eff` matches an independent `wornOnlySum` oracle), a chargen-shape/byte-identical-across-calls proof, and a 20-move rng-invariance proof.
- Full gate: `npm test` 2299/2299 (`# fail 0`), `test/parity/fixtures` untouched, `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`), `git diff --stat 6671921 -- engine content src mazeworld.html` lists exactly `content/treasure-tables.js` and `engine/derived.js`, zero touch to `engine/items.js`/`engine/state.js`/`engine/saveState.js`/`engine/character.js`/`engine/encounters.js`/`mazeworld.html`/`src` (Plans 02-04's scope), no `package.json`/`package-lock.json` change, `store-listing/`/`tools/store-screenshots/` never staged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Slot taxonomy + derived.js worn-model helpers + two-path eff() — tests first** — `2810f2f` (feat) — `feat(37-01): worn-slot taxonomy + two-path eff() refactor`
   - `content/treasure-tables.js`, `engine/derived.js`, `test/unit/worn-model.test.js` (new, 23 tests — includes Task 3's invariant/rng-proof tests, authored together)
2. **Task 2: Parity carve-out (stripWornField + three local comparable() duplicates)** — `80527a4` (test) — `test(37-01): carve c.worn out of every parity comparable`
   - `test/parity/harness/comparables.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/parity/movement-parity.test.js`
3. **Task 3: Companion invariant + rng/parity proofs + plan gate** — no additional code changes were needed; the invariant/chargen-shape/rng-invariance tests were written as part of Task 1's single-pass test-file authoring (see Decisions Made) and are already present in commit `2810f2f`. This SUMMARY IS Task 3's gate record.

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: Task 1 (`tdd="true"`) ran a genuine RED-then-GREEN gate — `node --test test/unit/worn-model.test.js` was run against the file before `content/treasure-tables.js`/`engine/derived.js` were touched and failed with `SyntaxError: The requested module '../../engine/derived.js' does not provide an export named 'WORN_SLOTS'` (RED, confirmed by direct run, not assumed); all 23 tests passed on the first run after implementation (GREEN). Task 2 and Task 3 are `type="auto"` (no tdd flag)._

## Files Created/Modified

- `content/treasure-tables.js` - slot taxonomy authored on private `*_ROWS`, byte-identical exported tables, new `SLOT_OF`
- `engine/derived.js` - `WORN_SLOTS`, `slotFor`, `carriedItems`, `reconcileWorn`, two-path `eff`, `hasItemNamed` via `carriedItems`
- `test/unit/worn-model.test.js` - 23 tests (new)
- `test/parity/harness/comparables.js` - new `stripWornField`, wired into all three comparable chains
- `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/parity/movement-parity.test.js` - local `comparable()` destructure extended with `worn`

## Decisions Made

- **SLOT_OF derivation:** built via `Object.fromEntries` over the same `*_ROWS` arrays that produce the exported tables, so the taxonomy and the item tables structurally cannot drift apart.
- **reconcileWorn's refusal-to-re-migrate is behaviorally proven**, not just documented — Task 3's companion-invariant state (c) plants an empty `c.worn = {}` and asserts the second `reconcileWorn` call returns `null` and changes nothing.
- **eff()'s legacy branch is byte-for-byte identical** to the pre-refactor loop (same `for...of c.items || []` with the same `it.eff && it.eff[key]` check, no added guard on `it` itself) — the new defensive guards (non-object `worn`, null/undefined entries) apply ONLY to the new worn-path branch, keeping the legacy path's behavior unchanged by construction for every state without `c.worn`.
- **Task 3's tests were authored together with Task 1's core suite** in a single `Write` pass rather than a separate append-then-commit step — the plan's own Task 3 action text describes appending to the same file Task 1 creates, and since the full RED-then-GREEN TDD gate was already established for the whole file before any implementation landed, splitting the authoring across two edits would have added no additional verification value. All acceptance criteria specific to Task 3 (`wornOnlySum` count, ≥20 tests, the diff-stat/store-listing gates) were independently re-verified against the already-committed state.

## Deviations from Plan

None — plan executed exactly as written. The two locked deviations noted in the plan's own frontmatter (`surfaced_deviation_slot_storage`: slot authored on rows but never spread onto items, via the ECON-08 sibling-table precedent; the assumption-delta PROMOTE decision: `c.worn` is the primary representation, the old sum-of-every-carried-copy path is the legacy variant) were both already pre-authorized in the plan and landed exactly as specified — not additional deviations discovered during execution.

## Issues Encountered

None. The RED gate failed exactly as expected (missing exports) before any implementation, and GREEN passed on the first run after implementation with no fix-up iterations needed.

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol: **this plan has zero player-visible behaviour.** No fixture, bot run, or existing `newRun(seed)` caller anywhere in the shipped codebase ever creates a `worn` key — `reconcileWorn` exists and is unit-tested but has no caller yet (Plan 03 wires the load path and the shell-only `newRun` option), and nothing in `mazeworld.html`/`src/browser/*` was touched. A normal run through chargen, a fight, a floor change, and taking/using a jewelry/cloak/staff item is expected to look, sound, and play identically to the pre-Phase-37 build. Nothing to add to the aggregated Pixel 7 checklist. No device steps, no APK build, no checkpoint was needed or attempted for this plan.

## Assumption-delta / rng / serialized-field statements (from plan frontmatter)

- **assumption_delta (PROMOTE):** `c.worn` becomes the primary representation of what confers effects; the old "sum of every carried copy" is demoted to the legacy variant kept only for un-migrated states. Landed exactly as specified — `eff()`'s two-path switch on `'worn' in c` is the mechanism.
- **surfaced_deviation_slot_storage:** the slot lives on content rows via module-private `*_ROWS` + a name-keyed `SLOT_OF` sibling table (ECON-08 precedent), never spread onto a rolled item object — verified by the no-slot-on-rolled-items tripwire test (rollJewel/rollCloak/rollStaff + the Thief's starting cloak).
- **rng_draw_impact:** zero — confirmed by the rng-invariance test (20 legal moves from `newRun(3)` produce an identical `rngState` and event-type sequence across two independent fresh runs, and `state.c` never carries a `worn` key afterward).
- **serialized_field_impact:** `c.worn` only — a lazily-created slot-key → item map that NOTHING in this plan creates on any fixture/bot/`newRun(seed)` path; carved out of `movementComparable`/`combatComparable`/`economyComparable` plus the three local `comparable()` duplicates via `stripWornField`. No slot key ever lands on an item object (tripwire test passes).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 can now build `equipItem`/`unequipSlot`/`useItem` slot addressing and take-flow auto-wear directly on top of `WORN_SLOTS`/`slotFor`/`carriedItems`/the two-path `eff()` with zero additional engine-model work.
- Plan 03's `newRun(seed, exclude, { wornSlots: true })` option and the load-path migration have `reconcileWorn(c)` ready to call as-is — its report shape (`{ slot, worn, bagged }[]`) is already the exact shape Plan 03's reconciliation rail card needs.
- No blockers.

---
*Phase: 37-equipment-slot-model-eff-refactor*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (content/treasure-tables.js, engine/derived.js, test/unit/worn-model.test.js, test/parity/harness/comparables.js, test/parity/combat-parity.test.js, test/parity/magic-parity.test.js, test/parity/movement-parity.test.js, this SUMMARY.md); both task commit hashes (`2810f2f`, `80527a4`) found in `git log --oneline --all`.
