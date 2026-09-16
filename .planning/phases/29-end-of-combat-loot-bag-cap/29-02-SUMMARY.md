---
phase: 29-end-of-combat-loot-bag-cap
plan: 02
subsystem: engine-combat-inventory
tags: [loot, combat, pending-pile, parity, bag-cap, events]

# Dependency graph
requires:
  - phase: 29-end-of-combat-loot-bag-cap
    provides: "Plan 01 — slotItems/canStow/stowItem, bagUpgradeTier/bagItemFor, BAG_ORDER/BAG_FLOORS/BAG_DROP_UNDER/BAG_ITEMS, lootCompare/bagUsage, bagFull/bagUpgraded presentation"
provides:
  - "state.pendingLoot: [] — a serialized, top-level sibling of pendingFind, carried through save/resume (never reset)"
  - "sanitizeLoot; validateSave/rehydrate carry pendingLoot (pre-v1.3 saves default to [])"
  - "offerLoot(state, it, events) — the one producer; killFoe's ONLY drop site"
  - "takeLoot(state, i, equip, events)/leaveLoot(state, i, events)/takeAllLoot(state, events)/leaveAllLoot(state, events) — pure, no-rng, routed through the single stowItem gate"
  - "engine/actions.js + engine/engine.js: takeLoot/leaveLoot/takeAllLoot/leaveAllLoot validated and dispatched"
  - "killFoe redirect (offerLoot replaces the legacy auto-take) + the ONE guarded LOOT-05 bag-swap d20, placed after every existing draw"
  - "forfeitLoot(state, reason, events) (engine/death.js) — the one hook; die() forfeits unconditionally; flee's three success exits forfeit before fled"
  - "reconcilePendingLoot (test/parity/harness/comparables.js, exported) wired into movementComparable/combatComparable/economyComparable AND into combat-parity.test.js/magic-parity.test.js/movement-parity.test.js's own local comparable() functions"
  - "lootDropped/lootTaken/lootLeft/lootForfeited: TOAST_FOR + EVENT_NARRATION entries, none ORACLE_ONLY"
affects: [29-03-loot-screen-shell]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pending-pile player-choice actions: offerLoot/takeLoot/leaveLoot/takeAllLoot/leaveAllLoot mirror the takeFind/leaveFind shape exactly — pure, no rng, routed through the one stowItem gate — over state.pendingLoot instead of state.pendingFind"
    - "ONE forfeit hook inside the terminator: forfeitLoot lives inside die() itself (not at any of its 13+ call sites) and inside flee's three success exits — the same 'one funnel, not many call sites' pattern state.combat=null already used"
    - "Parity reconcile-not-strip: reconcilePendingLoot mirrors reconcilePendingFind — applies the SAME legacy takeItem auto-take per pending drop onto a cloned c, proving the engine offers byte-identically what the prototype auto-took, instead of a blanket field strip"

key-files:
  created:
    - test/unit/loot-pile.test.js
    - test/unit/loot-narration.test.js
  modified:
    - engine/state.js
    - engine/saveState.js
    - engine/items.js
    - engine/actions.js
    - engine/engine.js
    - engine/combat.js
    - engine/death.js
    - test/parity/harness/comparables.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/parity/movement-parity.test.js
    - src/browser/toasts.js
    - src/browser/eventNarration.js
    - test/unit/save-validation.test.js
    - test/roundtrip/serialize-rehydrate.test.js

key-decisions:
  - "takeAllLoot takes what fits in PILE ORDER and surfaces exactly ONE bagFull for the first refusal (subsequent refusals are silent) — never loses an item; a potion or bag behind a blocked gear item still lands (RESEARCH A1, locked)"
  - "takeLoot's equip:true path is a direct swap: the displaced worn piece goes through the SAME stowItem gate, so a slot is needed only when something is actually displaced (bare-handed/Nothing/destroyed worn pieces need none) — exactly mirroring equipItem's existing behavior"
  - "The LOOT-05 bag-swap d20 sits immediately after rollTreasureItem's draws and before the Beasts/Lair-Beasts cooking check, guarded by bagUpgradeTier(state) — non-null only at depth >= 2 with an upgrade tier available and no bag already pending"
  - "forfeitLoot lives inside die() itself (RESEARCH Pitfall 3), not at any of its 13+ call sites — one hook, not many"

patterns-established:
  - "See tech-stack.patterns above"

requirements-completed: [LOOT-01, LOOT-02, LOOT-05, LOOT-06]

coverage:
  - id: D1
    description: "killFoe no longer auto-takes a treasure drop — it pushes into state.pendingLoot via offerLoot with a lootDropped event; c.items and equipped fields are untouched mid-fight"
    requirement: "LOOT-01"
    verification:
      - kind: unit
        ref: "test/unit/loot-pile.test.js — offerLoot tests, killFoe draw-count/pendingLoot tests, 'killFoe never calls the legacy auto-take' source assertion"
        status: pass
    human_judgment: false
  - id: D2
    description: "takeLoot/leaveLoot/takeAllLoot/leaveAllLoot: per-item and bulk take/leave, equip-now vs stow, every action narrated, take-all never loses an item (exactly one bagFull for the remainder)"
    requirement: "LOOT-02"
    verification:
      - kind: unit
        ref: "test/unit/loot-pile.test.js — Task 1 handler tests (empty/single/ordering/adjacency/take-all-order/leave-all)"
        status: pass
      - kind: integration
        ref: "test/unit/loot-pile.test.js — applyAction dispatch test"
        status: pass
    human_judgment: false
  - id: D3
    description: "The guarded LOOT-05 bag-swap d20 fires only at depth >= 2 with an upgrade available, sits after every existing draw, and never fires on any parity fixture (all fight at depth 1)"
    requirement: "LOOT-05"
    verification:
      - kind: unit
        ref: "test/unit/loot-pile.test.js — depth-1/depth-2/depth-4/depth-5/exlarge/already-pending draw-count pins"
        status: pass
      - kind: integration
        ref: "test/parity/combat-parity.test.js, test/parity/magic-parity.test.js, test/parity/movement-parity.test.js, test/parity/full-suite.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "pendingLoot survives save/resume byte-identically (serializeRun/validateSave/rehydrate, pre-v1.3 saves default to []); flee (every success reason) and die() (every cause) forfeit a non-empty pile with exactly ONE narrated lootForfeited before the terminal event; reconcilePendingLoot proves byte-identical parity in all three comparables with zero fixture edits"
    requirement: "LOOT-06"
    verification:
      - kind: unit
        ref: "test/unit/loot-pile.test.js — serialization/save-validation/roundtrip/flee/die/forfeitLoot/reconcile tests; test/unit/save-validation.test.js; test/roundtrip/serialize-rehydrate.test.js"
        status: pass
      - kind: integration
        ref: "npm test (full suite, 1578/1578); git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt (clean)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every new event type (lootDropped/lootTaken/lootLeft/lootForfeited) has an EVENT_NARRATION entry and a TOAST_FOR entry, none ORACLE_ONLY; formatEventsCoverage/toastsCoverage/voice safety-scan all green"
    verification:
      - kind: unit
        ref: "test/unit/loot-narration.test.js; test/unit/formatEventsCoverage.test.js; test/unit/toastsCoverage.test.js; test/voice/safety-scan.test.js"
        status: pass
    human_judgment: false
  - id: D6
    description: "On-device verification of the forfeit narration and the loot-taking flow end to end (deferred to end of Phase 29 run, after Plan 03's shell)"
    verification: []
    human_judgment: true
    rationale: "Requires a physical device session with an active run to observe the Oracle log and the loot screen together — see Human verification section below"

duration: 95min
completed: 2026-09-16
status: complete
---

# Phase 29 Plan 02: Pending Loot Pile, Guarded Bag Draw & Forfeit Rule Summary

**`state.pendingLoot` replaces the mid-fight auto-take: killFoe now offers every drop into a serialized pile via `offerLoot`, four pure player actions (`takeLoot`/`leaveLoot`/`takeAllLoot`/`leaveAllLoot`) manage it through the single `stowItem` gate, flight and death forfeit it with one narrated `lootForfeited`, and `reconcilePendingLoot` proves the change is byte-identical to the frozen prototype across every parity fixture with zero fixture edits.**

## Performance

- **Duration:** ~95 min
- **Tasks:** 3
- **Files modified:** 15 (2 new test files, 13 modified)

## Accomplishments
- `state.pendingLoot: []` is a real, serialized top-level field on every fresh run — unlike `pendingFind`, it survives `serializeRun` → `validateSave` → `rehydrate` byte-identically and in order; a pre-v1.3 save with no field defaults to `[]` via `sanitizeLoot`
- Five pure, no-rng handlers in `engine/items.js` (`offerLoot`/`takeLoot`/`leaveLoot`/`takeAllLoot`/`leaveAllLoot`) mirror the `takeFind`/`leaveFind` shape exactly, routed entirely through Plan 01's `stowItem` gate; `takeLoot`'s `equip: true` path is a direct swap whose displaced worn piece goes through the same gate
- `killFoe` (`engine/combat.js`) no longer calls the legacy auto-take at all — it offers every treasure roll into the pile via `offerLoot`, with the ONE new LOOT-05 draw (a guarded `rng.d(20) <= BAG_DROP_UNDER`) sitting after every existing draw and firing only when `bagUpgradeTier(state)` is non-null (depth >= 2, an upgrade available, no bag already pending)
- `forfeitLoot` (`engine/death.js`) is the one hook: `die()` calls it unconditionally right after `state.combat = null` (covering all 13+ death call sites at once), and `flee`'s three success exits (cloaker, tracked, escaped) call it before pushing `fled`
- `takeLoot`/`leaveLoot`/`takeAllLoot`/`leaveAllLoot` are validated (`engine/actions.js`) and dispatched (`engine/engine.js`) through `applyAction`
- `reconcilePendingLoot` (exported from `test/parity/harness/comparables.js`) mirrors `reconcilePendingFind`: applies the legacy `takeItem` auto-take per pending drop, in kill order, onto a cloned `c`, skipping `kind:"bag"` entries (engine-only content). Wired into all three shared comparables AND into `combat-parity.test.js`/`magic-parity.test.js`/`movement-parity.test.js`'s own local `comparable()` functions, which predate the shared harness and needed the identical fix — `combat/lose` (seed 14), the one fixture RESEARCH identified as rolling a mid-fight drop, now compares clean
- `lootDropped`/`lootTaken`/`lootLeft`/`lootForfeited` each have a `TOAST_FOR` and an `EVENT_NARRATION` entry (deadpan, family-friendly voice), none in `ORACLE_ONLY`
- Full suite green at 1578/1578 (1528 baseline + 50 new tests); every parity suite green with `git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt` clean — zero fixture edits, master never touched

## Task Commits

Each task was committed atomically:

1. **Task 1: pendingLoot model + serialization + the four pure handlers** - `0ed0042` (feat)
2. **Task 2: dispatch/validation, killFoe redirect + guarded bag draw, forfeit on flee/die** - `1da4443` (feat)
3. **Task 3: reconcilePendingLoot carve-out, presentation entries, full-suite gate** - `3a7e437` (feat)

_No separate TDD RED/GREEN commits — tests and implementation were authored together per task and committed once both were verified green (the same minor process deviation Plan 01 documented: every acceptance criterion and behavior in the plan was independently verified against the final code, and against the plan's specified draw sequences/event orderings, before each commit)._

## Files Created/Modified
- `engine/state.js` - `pendingLoot: []` seeded on every fresh run
- `engine/saveState.js` - `sanitizeLoot`; `validateSave`/`rehydrate` carry `pendingLoot` through (never reset, unlike `pendingFind`)
- `engine/items.js` - `offerLoot`/`takeLoot`/`leaveLoot`/`takeAllLoot`/`leaveAllLoot` added after `unequipSlot`
- `engine/actions.js` - `takeLoot`/`leaveLoot`/`takeAllLoot`/`leaveAllLoot` added to `ACTION_TYPES` + `validateAction`
- `engine/engine.js` - the four new dispatch cases
- `engine/combat.js` - `killFoe`'s treasure block redirected to `offerLoot` + the guarded bag-swap draw; `flee`'s three success exits forfeit
- `engine/death.js` - `forfeitLoot`; `die()` calls it unconditionally
- `test/parity/harness/comparables.js` - `reconcilePendingLoot` (exported); wired into all three shared comparables
- `test/parity/combat-parity.test.js` / `magic-parity.test.js` / `movement-parity.test.js` - their own local `comparable()` functions strip/reconcile `pendingLoot` too (see Deviations)
- `src/browser/toasts.js` / `eventNarration.js` - the four new event entries
- `test/unit/loot-pile.test.js` (new) - Task 1/2/3 pins (draw counts, handler behavior, forfeit ordering, reconcile)
- `test/unit/loot-narration.test.js` (new) - presentation pins
- `test/unit/save-validation.test.js`, `test/roundtrip/serialize-rehydrate.test.js` - pendingLoot save/round-trip additions

## Decisions Made
- See `key-decisions` in frontmatter.
- `takeAllLoot`'s scratch-events approach (a throwaway `events` array per item, appended to the real list only on success or on the FIRST refusal) keeps the "exactly one bagFull for the remainder" rule structurally guaranteed rather than tracked with a manual flag alone — the flag (`refused`) only gates whether a refusal's scratch events get appended, never whether the stow itself is attempted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `combat-parity.test.js`/`magic-parity.test.js`/`movement-parity.test.js` needed their own pendingLoot carve-out, not just the shared harness**
- **Found during:** Task 3 (running the plan's own required verify command: `node --test test/parity/combat-parity.test.js test/parity/magic-parity.test.js test/parity/movement-parity.test.js test/parity/economy-parity.test.js test/parity/full-suite.test.js`)
- **Issue:** The plan's Task 3 action list only names `test/parity/harness/comparables.js` for the carve-out. In fact `combat-parity.test.js` and `magic-parity.test.js` each define their OWN local `comparable()` function (a pre-existing duplication that predates the shared harness helpers — `economy-parity.test.js` imports `economyComparable` directly, but these two do not) and `movement-parity.test.js` does too. Without updating these three files, `state.pendingLoot` — now a real top-level key on every state — would cause an immediate top-level key-set mismatch against the frozen prototype's boot state, failing all three test files outright; `combat-parity`'s `lose` scenario (seed 14) additionally needed the real reconcile (not just a strip), since it is the one fixture that rolls a mid-fight jewel drop.
- **Fix:** Exported `reconcilePendingLoot` from `test/parity/harness/comparables.js` (it was previously an unexported local like `reconcilePendingFind`); added `pendingLoot` to each of the three files' own destructure lists (mirroring their existing `pendingFind`/`dev` precedent) and applied `reconcilePendingLoot` in `combat-parity.test.js` (the only one of the three whose fixtures can roll a drop).
- **Files modified:** `test/parity/harness/comparables.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/parity/movement-parity.test.js`
- **Verification:** `node --test test/parity/combat-parity.test.js test/parity/magic-parity.test.js test/parity/movement-parity.test.js test/parity/economy-parity.test.js test/parity/full-suite.test.js test/parity/chargen-parity.test.js test/parity/fixture-inventory.test.js` — 31/31 pass; full `npm test` — 1578/1578; `git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt` clean.
- **Committed in:** `3a7e437` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the plan's own required verification commands to pass and for LOOT-05/LOOT-06's parity guarantee to actually hold on the fixture (`combat/lose`, seed 14) RESEARCH identified as exercising the divergence. No scope creep — the fix only touches the parity-comparison surface these three files already maintained locally, using the exact reconcile pattern the plan specified for the shared harness.

## Issues Encountered
- Two test-authoring bugs were caught and fixed before committing (never landed in a passing state): (1) two `takeAllLoot` tests built their "expected" `c.items` array by spreading a `filler` array AFTER calling `takeAllLoot`, but `fixedState`'s `items: filler` override aliases the same array reference `stowItem`'s `giveItem` mutates in place — fixed by snapshotting the expected array before the call (and passing a copy, `[...filler]`, into `fixedState`) so the two arrays don't alias; (2) an arity-check test asserted the wrong expected `Function.length` values for the five handlers (`Function.length` counts only parameters before the first default value, so `takeLoot(state, i, equip=false, events=[])` has `.length === 2`, not 4) — fixed to the correct expected arities with an explanatory comment.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 (loot screen shell) can dispatch `takeLoot {i, equip?}`/`leaveLoot {i}`/`takeAllLoot`/`leaveAllLoot` directly via `applyAction`, read `state.pendingLoot` for the pile, and bridge Plan 01's `lootCompare`/`bagUsage` for the compare-to-equipped readout — no further engine work needed for the core loot-decision surface.
- Plan 03 still owns: the loot screen card itself (shell markup/CSS, tap-safety guard reuse), suppressing the "Move on" combat-report card when a pile is pending (RESEARCH Pitfall 4), and re-showing the screen on resume when the pile is non-empty.
- No blockers identified for Plan 03.

## Human verification (deferred to end of run)

Deferred to the end of the autonomous run (the executor copies this block into SUMMARY.md under "## Human verification (deferred to end of run)"):
- On device (after Plan 03): kill a foe that drops something, then flee the next foe in the same fight — the Oracle shows "You leave <item> on the floor in your hurry not to be on the floor yourself." and the loot never appears in the bag.
- Die with a pending pile: the death card shows and the Oracle's last lines include the "stay where they fell" line.

---
*Phase: 29-end-of-combat-loot-bag-cap*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 15 modified/created source files and the SUMMARY.md itself exist on disk; all 3 task commit hashes (0ed0042, 1da4443, 3a7e437) found in git history.
