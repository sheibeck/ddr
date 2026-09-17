---
phase: 37-equipment-slot-model-eff-refactor
plan: 02
subsystem: engine
tags: [worn-slots, equip-swap, auto-wear, use-item-slot-form, refusals, feed-02, deferred-uat]

# Dependency graph
requires:
  - phase: 37-01
    provides: "WORN_SLOTS, slotFor(it), carriedItems(c), reconcileWorn(c), the two-path eff() and the c.worn parity carve-out"
provides:
  - "engine/items.js: autoWearSlot(state, it)/wearItem(state, it, slot, events); equipItem's cloak/jewel/staff swap branch (itemEquipped { item, slot, replaced? }); unequipSlot extended to the six worn slots (delete, not null); auto-wear wired into takeItem/takeFind/takeLoot(non-equip)/takeAllLoot; useItem(state, ref, ...) accepts a bag index OR { slot }, with a new notWorn refusal (after wrongClass, before pilfer) and a slot-aware consume path"
  - "engine/actions.js: unequipSlot accepts EQUIP_SLOTS ∪ WORN_SLOTS; useItem accepts exactly one of { i } or { slot } ∈ WORN_SLOTS"
  - "engine/engine.js: useItem dispatch maps action.slot into the { slot } ref form"
  - "src/browser/toasts.js / eventNarration.js: the notWorn refusal copy; itemEquipped's additive replaced clause (byte-identical without it)"
  - "test/voice/safety-scan.test.js: BRANCH_TOGGLES cover both new branches"
  - "docs/USABLE-FEATURES-AUDIT.md: notWorn row in the §1 refusal vocabulary table"
  - "test/unit/worn-slots.test.js: 45 tests (equip/unequip/auto-wear specs, useItem slot addressing + refusal ladder, toast/Oracle copy, and a 5-entry-point legacy-identity sweep over a real newRun(3) state)"
affects: ["37-03 (load migration + newRun option + shell worn rows)", "37-04 (mazeworld.html bridges)", "39 (magic items)", "43 (Gear ON YOU/BAG split)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "auto-wear is a pure predicate (autoWearSlot) + a tiny mutator (wearItem) shared by all four take sites (takeItem/takeFind/takeLoot/takeAllLoot), never duplicated inline"
    - "the equip swap mirrors the existing weapon/armor pattern exactly: `const worn = c.worn[slot] || null; c.worn[slot] = it; if (worn) c.items[i] = worn; else c.items.splice(i, 1);`"
    - "useItem's ref parameter (bag index | { slot }) is resolved once at the top into a single `it` local, so the entire refusal ladder and the switch body are addressing-form-agnostic"
    - "every new behaviour is gated on `c.worn` being a present, own, object-typed key — the SAME presence check Plan 01 established for eff()"

key-files:
  created:
    - test/unit/worn-slots.test.js
  modified:
    - engine/items.js
    - engine/actions.js
    - engine/engine.js
    - src/browser/toasts.js
    - src/browser/eventNarration.js
    - test/voice/safety-scan.test.js
    - docs/USABLE-FEATURES-AUDIT.md

key-decisions:
  - "itemEquipped gains an additive `replaced` field (built conditionally so the no-swap event object has no `replaced` key at all, not `replaced: null`) rather than a second event — Phase 25 additive-payload precedent, locked by CONTEXT."
  - "The not-worn refusal reason is `notWorn` on the existing `useRefused` event (no new event type), fired directly after the staff wrongClass check and before the Pilfer check, so ordering matches the plan's literal ladder."
  - "useItem's `ref` resolution (`slot = ref && typeof ref === 'object' ? ref.slot : null`) treats a bag index of `0` correctly as a non-slot form (`0` is not an object), avoiding a falsy-index bug."
  - "The Task 3 legacy-identity sweep asserts each call's own before/after state (or, for useItem, agreement across two independently-cloned real newRun(3) states) rather than hand-typed literal pins on the seed's actual chargen output — avoids a mistyped magic-string pin while still proving byte-identical behaviour; documented here as the plan's own 'Claude's Discretion' allowance for exact sweep mechanics."

requirements-completed: [GEAR-03]

coverage:
  - id: D1
    description: "equipItem grows a cloak/jewel/staff branch that performs a direct swap into the freed bag index (mirroring the weapon branch), pushing itemEquipped { item, slot, replaced? }; a non-Magic-User staff is refused wrongClass; legacy states (no c.worn) keep notEquippable byte-identically"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-slots.test.js (equipItem section, 7 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "unequipSlot extends to the six worn slots via the same stowItem gate (bagFull on a full bag); an empty slot is a silent no-op; a legacy state is unaffected; validateAction accepts EQUIP_SLOTS ∪ WORN_SLOTS"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-slots.test.js (unequipSlot + validateAction sections, 5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "autoWearSlot/wearItem auto-wear a slot item into an empty slot at all four take sites (takeItem/takeFind/takeLoot non-equip/takeAllLoot), consuming no bag slot, narrated through the existing itemEquipped event; an occupied slot or a legacy state falls through to the pre-existing bag path unchanged"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-slots.test.js (autoWearSlot/wearItem + take-site sections, 12 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "useItem gains slot addressing ({ type: 'useItem', slot }); a bagged (not worn) cloak/jewelry/staff activatable is refused useRefused { reason: 'notWorn' } before any side effect, after wrongClass and before pilfer; legacy states keep bag-use; the consume path deletes the worn slot instead of splicing the bag when addressed by slot"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-slots.test.js (Task 2 useItem section, 8 tests) + test/unit/item-combat-gate.test.js (regression)"
        status: pass
    human_judgment: false
  - id: D5
    description: "engine.js dispatches action.slot into useItem's { slot } form; actions.js validates exactly one of i/slot for useItem; toasts.js/eventNarration.js render notWorn and itemEquipped's replaced clause; the voice-safety scan and the toast/narration coverage guards stay green; the notWorn row lands in docs/USABLE-FEATURES-AUDIT.md §1"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-slots.test.js (engine.js/actions.js/toast/Oracle sections, 6 tests) + test/voice/safety-scan.test.js + test/unit/toastsCoverage.test.js + test/unit/formatEventsCoverage.test.js"
        status: pass
      - kind: other
        ref: "grep -c '| notWorn |' docs/USABLE-FEATURES-AUDIT.md == 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "every changed entry point (equipItem, unequipSlot, takeFind, takeLoot, useItem) is byte-identical for a legacy state — proven on a real newRun(3) state (Thief, starting cloak in the bag, no worn key), not just synthetic fixtures; npm test 2344/2344, fixtures untouched, master hash unchanged, diff-stat lists exactly the eight declared files"
    requirement: GEAR-03
    verification:
      - kind: unit
        ref: "test/unit/worn-slots.test.js (Task 3 sweep section, 5 tests)"
        status: pass
      - kind: other
        ref: "npm test (2344/2344, # fail 0); git status --porcelain test/parity/fixtures empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; git diff --stat 6671921 -- engine content src mazeworld.html docs lists exactly 8 files"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-09-17
status: complete
---

# Phase 37 Plan 02: Equipment Slot Model & eff() Refactor — Behaviours Summary

**Gave the worn model its behaviours on top of Plan 01's data layer: `equipItem`/`unequipSlot` slot branches with a direct-swap-on-occupied-slot rule, auto-wear at all four take sites, `useItem` slot addressing with a new `notWorn` refusal, and matching toast/Oracle copy — every branch gated on `c.worn` being present so no fixture, bot, or un-migrated save changes by a byte.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-17 (Plan 01 completion marker)
- **Completed:** 2026-09-17T19:28:44Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified) + this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit

## Accomplishments

- `engine/items.js`: `autoWearSlot(state, it)` (pure predicate) and `wearItem(state, it, slot, events)` (mutator, no `eff.wp` applied — no slot row ever carries it) wired into `takeItem`/`takeFind`/`takeLoot` (non-equip form)/`takeAllLoot`; `equipItem` grows a `cloak`/`jewel`/`staff` branch performing the exact weapon-branch swap pattern (`const worn = c.worn[slot] || null; c.worn[slot] = it; if (worn) c.items[i] = worn; else c.items.splice(i, 1);`), pushing `itemEquipped { item, slot, replaced? }` with `replaced` present only on a genuine swap; the staff class gate (`equipRejected wrongClass`) fires before any mutation; `unequipSlot` extends to the six worn slots via the same `stowItem` bag-cap gate, `delete`-ing the slot key (never setting it `null`) so `slot in c.worn` reports empty.
- `engine/items.js#useItem`: signature changed to `useItem(state, ref, rng, events, now)` where `ref` is a non-negative bag index OR `{ slot }`; the new `notWorn` refusal (`useRefused { reason: "notWorn" }`) fires when a bagged (not-worn) cloak/jewelry/staff activatable is addressed by bag index in the new model — placed directly after the existing `wrongClass` staff gate and before the Pilfer gate, so ordering matches the locked refusal ladder; the consume path (`it.kind === "potion" || it.uses === 1`) now deletes the worn slot instead of splicing the bag when addressed by slot. Legacy states (no `c.worn`) never see `notWorn` — bag-use is byte-identical to before this plan.
- `engine/engine.js`: `useItem` dispatch maps `action.slot` into the `{ slot }` ref form when present, else the original `action.i`.
- `engine/actions.js`: `unequipSlot` validation accepts `EQUIP_SLOTS ∪ WORN_SLOTS` (imported from `derived.js`, the cycle-free leaf); `useItem` validation requires exactly one of `i` (existing contract, unchanged reason string) or `slot ∈ WORN_SLOTS` (new reason string), never both.
- `src/browser/toasts.js` / `src/browser/eventNarration.js`: `useRefused`'s reason map/ladder gains `notWorn` (`"{item} is in your bag, doing what things in bags do: nothing. Wear it first."` — the locked copy register, verbatim); `itemEquipped`'s builder appends `" {replaced.n} goes back in the bag."` / `" {replaced.n} goes back in the bag — the maze is not a jeweller."` only when `replaced` is present, keeping the no-swap text byte-identical to today.
- `test/voice/safety-scan.test.js`: two new `BRANCH_TOGGLES` entries (`{ reason: "notWorn" }`, `{ replaced: { n: "Ring of Power" } }`) exercise both new copy branches under the family-friendly scan.
- `docs/USABLE-FEATURES-AUDIT.md`: `notWorn` row added to the §1 refusal vocabulary table, directly after `pilfer`.
- `test/unit/worn-slots.test.js` (new, 45 tests): Task 1's equip/unequip/auto-wear specs (26 tests, including legacy-identity proofs for equipItem/takeFind/takeItem on synthetic fixtures), Task 2's `useItem` slot addressing + refusal-ordering + toast/Oracle copy specs (14 more tests, 40 total), and Task 3's 5-entry-point legacy-identity sweep against a REAL `newRun(3)` state (a Pickpocket Thief with a Cloak of Ether in the bag, no `worn` key).
- Full gate: `npm test` 2344/2344 (`# fail 0`), `test/parity/fixtures` untouched, `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`), `git diff --stat 6671921 -- engine content src mazeworld.html docs` lists exactly the eight declared files (`content/treasure-tables.js`, `docs/USABLE-FEATURES-AUDIT.md`, `engine/actions.js`, `engine/derived.js`, `engine/engine.js`, `engine/items.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`), no `package.json`/`package-lock.json` change, `store-listing/`/`tools/store-screenshots/` never staged.

## Task Commits

Each task was committed atomically:

1. **Task 1: equipItem/unequipSlot slot branches + autoWearSlot/wearItem + auto-wear at the four take sites (tests first)** — `c12a4ff` (feat) — `feat(37-02): equip/unequip slot branches + auto-wear at the four take sites`
   - `engine/items.js`, `engine/actions.js`, `test/unit/worn-slots.test.js` (new, 26 tests)
2. **Task 2: useItem slot addressing + notWorn refusal + engine.js dispatch + actions validation + toast/Oracle copy + safety-scan toggles (tests first)** — `6963b05` (feat) — `feat(37-02): useItem slot addressing + notWorn refusal + toast/Oracle copy`
   - `engine/items.js`, `engine/engine.js`, `engine/actions.js`, `src/browser/toasts.js`, `src/browser/eventNarration.js`, `test/voice/safety-scan.test.js`, `test/unit/worn-slots.test.js` (+14 tests, 40 total)
3. **Task 3: Refusal-vocabulary ledger row, legacy-path identity sweep, plan gate and the deferred-UAT SUMMARY section** — `448aa38` (docs) — `docs(37-02): notWorn refusal-vocabulary row + legacy-identity sweep`
   - `docs/USABLE-FEATURES-AUDIT.md`, `test/unit/worn-slots.test.js` (+5 tests, 45 total)

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: Task 1 and Task 2 (`tdd="true"`) each ran a genuine RED-then-GREEN gate — the test file was extended and run against the pre-implementation engine first (confirmed failing: Task 1 failed on a missing `autoWearSlot` export; Task 2 failed 11 of 40 tests on the old `useItem(state, i, ...)` signature and missing `notWorn`/`replaced` copy), then all tests passed after implementation with no fix-up iterations. Task 3 is `type="auto"` (no tdd flag)._

## Files Created/Modified

- `engine/items.js` — `autoWearSlot`/`wearItem`; equipItem's swap branch; unequipSlot's six-slot extension; auto-wear at takeItem/takeFind/takeLoot/takeAllLoot; useItem's `ref` addressing + `notWorn` refusal + slot-aware consume
- `engine/actions.js` — `unequipSlot`/`useItem` validation for the worn-slot forms (imports `WORN_SLOTS`)
- `engine/engine.js` — `useItem` dispatch maps `action.slot` into the `{ slot }` ref
- `src/browser/toasts.js` — `notWorn` copy, `itemEquipped`'s additive `replaced` clause
- `src/browser/eventNarration.js` — `notWorn` copy, `itemEquipped`'s additive `replaced` clause
- `test/voice/safety-scan.test.js` — two new `BRANCH_TOGGLES` entries
- `docs/USABLE-FEATURES-AUDIT.md` — `notWorn` row in §1
- `test/unit/worn-slots.test.js` — 45 tests (new)

## Decisions Made

- **`itemEquipped.replaced` is additive, built conditionally** so the no-swap event object carries no `replaced` key at all (not `replaced: null`) — matches Plan 01/CONTEXT's Phase-25-precedent instruction and keeps `assert.deepStrictEqual` checks exact.
- **`notWorn`'s placement in the refusal ladder** (after `wrongClass`, before `pilfer`) was verified by a dedicated ordering test rather than just documented — a bagged staff on a non-caster still gets `wrongClass` first; a Pilfer's bagged Cloak of Speed still gets `notWorn` first (never reaches the pilfer check).
- **`useItem`'s `ref` resolution** treats a bag index of `0` correctly (`typeof 0 === "object"` is `false`), so `useItem(state, 0, ...)` unambiguously means "bag index 0," never misread as a slot form.
- **Task 3's legacy-identity sweep uses measured before/after assertions on real `newRun(3)` output** rather than hand-typed literal pins on that seed's actual (non-trivial) chargen state — avoids a mistyped magic-string pin while still proving byte-identical behaviour for every changed entry point; the `useItem` sweep specifically compares two independently-cloned legacy states run through the same call, proving neither drifted and that `notWorn` never fires on a legacy state.

## Deviations from Plan

None — plan executed exactly as written. The two locked discretion points named in the plan's own frontmatter (the additive `replaced` field; the `notWorn` reason string on the existing `useRefused` event) were both pre-authorized and landed exactly as specified — not additional deviations discovered during execution.

## Issues Encountered

None. The docs row acceptance grep (`| notWorn |`, no backticks) initially failed when the row was authored with the table's usual backtick styling around `notWorn`/`useRefused` — corrected to the plan's literal (unbacktick) template to match the acceptance criterion exactly. The `legacy identity sweep` grep count initially returned 6 (the section-header comment plus five per-test titles all repeating the phrase) against an expected 1 — renamed the five test titles to `Task 3 sweep: ...` so the exact phrase appears only in the section comment. Both were caught and fixed before committing Task 3; no test coverage or behavior was affected.

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol: **no shell path can yet create `c.worn`** (Plan 03/04 own the load-path migration and the `newRun({ wornSlots: true })` shell option), so this plan has zero player-visible behaviour of its own — nothing to add to the aggregated Pixel 7 checklist, no device steps, no APK build, no checkpoint needed or attempted. This plan's engine behaviours ARE what Plan 04's device checklist will exercise once the shell wires worn rows / EQUIP / UNEQUIP / the swap confirm:

- **Swap on an occupied slot** — equipping a second ring/cloak/staff/bracelet swaps it in directly; the old one lands back in the bag (no stacking, no silent loss).
- **Unequip on a full bag** — UNEQUIP is dimmed/refused with a `bagFull` toast naming the have/slots count, exactly like the existing weapon/armor UNEQUIP rows.
- **Auto-wear on a find/loot/take** — accepting a ring/cloak/staff/amulet/bracelet/helm item when that slot is empty wears it immediately (no extra tap, no bag-slot cost); an occupied slot still bags it for a manual swap later.
- **`notWorn` refusal** — using a cloak/jewelry/staff item from the BAG (rather than worn) refuses with the exact copy "X is in your bag, doing what things in bags do: nothing. Wear it first."

## Assumption-delta / rng / serialized-field statements (from plan frontmatter)

- **rng_draw_impact:** zero — `equipItem`/`unequipSlot`/`takeFind`/`takeLoot`/`takeAllLoot`/`takeItem` remain pure (no rng) as before this plan; `useItem`'s new slot resolution and the `notWorn` refusal both fire BEFORE `it.usedAt`/`itemUsed` and before any draw (the Phase 31 refusal-ladder rule preserved); every new branch is gated on `c.worn` being present, which no fixture/bot/`newRun`-without-option state has. Confirmed by the full 2344/2344 `npm test` pass and the Task 3 legacy-identity sweep's rng-free before/after assertions.
- **serialized_field_impact:** `c.worn` only — moved into/out of by equip/unequip/auto-wear (already carved out of every parity comparable in Plan 01); `usedAt`/`every` ride on the item object and move with it (worn or bagged); no new field lands on any item; no new event TYPE — one new reason string (`useRefused.notWorn`) and one additive payload field (`itemEquipped.replaced`).
- **canon_change:** the ONE deliberate GEAR-03 change (stacking → one per slot; equipping into an occupied slot is a swap) applies only when `c.worn` is present; legacy states keep today's `equipRejected notEquippable` for cloaks/jewelry/staves and today's bag-use behaviour — zero fixtures moved, confirmed by the Task 3 sweep.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 can now wire the load-path migration (`reconcileWorn`, ready since Plan 01) and the shell-only `newRun({ wornSlots: true })` option directly on top of this plan's fully-behaviored `equipItem`/`unequipSlot`/`useItem`/take-site auto-wear — no further engine-model work needed before the shell starts creating `c.worn`.
- Plan 04's worn rows / EQUIP / UNEQUIP / swap-confirm UI have a complete, tested engine surface to bind to: `itemEquipped { replaced? }` for the swap-confirm copy, `bagFull` for the UNEQUIP-on-full-bag dim state, and `useRefused { reason: "notWorn" }` for the bag-use refusal toast.
- No blockers.

---
*Phase: 37-equipment-slot-model-eff-refactor*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (engine/items.js, engine/actions.js, engine/engine.js, src/browser/toasts.js, src/browser/eventNarration.js, test/voice/safety-scan.test.js, docs/USABLE-FEATURES-AUDIT.md, test/unit/worn-slots.test.js, this SUMMARY.md); all three task commit hashes (`c12a4ff`, `6963b05`, `448aa38`) found in `git log --oneline --all`.
