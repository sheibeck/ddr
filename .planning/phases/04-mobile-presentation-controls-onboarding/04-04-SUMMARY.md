---
phase: 04-mobile-presentation-controls-onboarding
plan: 04
subsystem: ui
tags: [event-narration, data-driven-table, coverage-guardrail, engineAdapter, node-test, vanilla-js]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/*.js's applyAction(state, action) -> {state, events} seam and every rule domain's structured {type, ...} event shapes (combat/magic/economy/encounters/items/movement/character/death)"
provides:
  - "src/browser/eventNarration.js: EVENT_NARRATION — a data-driven type->narration-line lookup table covering all 162 engine-emitted event types, the seam Phase 5's voice generator replaces wholesale"
  - "src/browser/engineAdapter.js: formatEvents()/formatEvent() refactored to delegate to EVENT_NARRATION (monolithic ~26-case switch removed)"
  - "test/unit/formatEventsCoverage.test.js: a standing guardrail that derives the full event-type vocabulary from engine/*.js source at runtime and fails if any engine-emitted type ever produces no narration line again"
affects: [04-07 (combat/economy engine-routing — this closes the silent-log-line gap before those domains go live), 04-08 (ORACLE/combat log rendering consumes formatEvents' now-complete output), 05 (voice generator replaces EVENT_NARRATION's terse copy)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-driven type->builder lookup table (object of (e) => string) instead of a monolithic switch — each entry is independently reviewable/testable and is the exact seam a later generator replaces"
    - "Source-derived coverage guardrail: the test reads engine/*.js at runtime (comment-stripped, ternary-aware regex) rather than hand-maintaining a frozen type list, so a future new event type automatically fails the test until narrated"

key-files:
  created:
    - src/browser/eventNarration.js
    - test/unit/formatEventsCoverage.test.js
  modified:
    - src/browser/engineAdapter.js

key-decisions:
  - "EVENT_NARRATION covers exactly the 162 types derived from engine/*.js source (158 literal `type: \"...\"` occurrences + 4 emitted only via engine/events.js's EVENT_TYPES indirection: died/won/leveled/floorChanged). \"moved\" is deliberately EXCLUDED from both the canonical set and the table — a plain step stays silent by pre-existing, already-tested design (test/unit/engineAdapter.test.js asserts a moved event contributes zero html lines) — special-cased in formatEvent() rather than given a table entry."
  - "The 3 dead pendingEncounter/pendingTrap/pendingChest cases from the old switch were DROPPED, not migrated — encounters.js has fully replaced them since 01-10 and the engine no longer emits them; the coverage test's own \"EVENT_NARRATION has no entries for event types the engine never emits\" assertion would fail if they were kept, so keeping them would directly contradict Task 2's own acceptance criteria."
  - "[Rule 1 - Bug, found mid-Task-2] The Task 1 coverage test's own type-derivation regex (`type:\\s*\"([A-Za-z]+)\"`) missed engine/movement.js's ternary-typed event pushes (`type: climbing ? \"climbedOver\" : \"leaptOver\"`, `type: climbing ? \"fellClimbing\" : \"fellInGorge\"`) because both branches sit after a `?`/`:`, not directly after `type:`. Broadened the regex to capture the whole expression after `type:` up to the next `,`/`}` and extract every quoted string within it — this also transparently still matches the simple single-literal case. Verified: the coverage test's own \"no dead entries\" sub-test went from failing (falsely flagging climbedOver/leaptOver/fellClimbing/fellInGorge as dead) to passing once the derivation was fixed."
  - "goldGained's narration is reason-aware via the optional `why` field (parley/pickpocket/tableFour/chest/faerie/off-the-body/null) rather than a fixed string, since gainWilmst() and combat.js's parley() both emit it with different `why` values."
  - "spGained's narration branches on `reason` (\"parley\" -> \"Talking your way out\"; \"descend\" -> \"Surviving the floor\"; anything else -> generic \"That\") since the same event type now fires from both combat.js's parley() and movement.js's descend()."

patterns-established:
  - "Pattern 2 (continuing 04-01/04-02/04-03's DOM-free-module pattern): a pure presentation-glue lookup table under src/browser/ with zero engine/DOM imports, matching every prior Phase-4 plan's isolation discipline."

requirements-completed: [UX-05]

coverage:
  - id: D1
    description: "EVENT_NARRATION (src/browser/eventNarration.js) is a data-driven type->builder table (not a monolithic switch) covering every one of the 162 event types engine/*.js can emit, migrating the original ~22 real narration lines verbatim (same span-class markup) and adding terse, on-tone lines for the remaining ~136 combat/magic/economy/encounters/items types"
    requirement: "UX-05"
    verification:
      - kind: unit
        ref: "test/unit/formatEventsCoverage.test.js#formatEvents narrates every engine-emitted event type (derived from engine/*.js source)"
        status: pass
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#formatEvents maps known event types to HTML and drops unknown ones silently"
        status: pass
    human_judgment: false
  - id: D2
    description: "test/unit/formatEventsCoverage.test.js derives the canonical event-type set from engine/*.js source at runtime (comment-stripped, ternary-aware) rather than a hand-copied frozen list, so a future new engine event type automatically fails the guardrail until narrated; a companion assertion guards against dead/typo table entries the engine never emits"
    requirement: "UX-05"
    verification:
      - kind: unit
        ref: "test/unit/formatEventsCoverage.test.js#EVENT_NARRATION has no entries for event types the engine never emits"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 4: Event Narration Coverage Summary

**Data-driven `EVENT_NARRATION` table (src/browser/eventNarration.js) covers all 162 engine-emitted event types — up from ~22 real lines in the old monolithic switch — guarded by a coverage test that derives the type vocabulary from engine/*.js source at runtime and fails on any future unmapped type.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-08T20:06:00Z
- **Completed:** 2026-09-08T20:19:32Z
- **Tasks:** 2 (both auto)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Enumerated the full engine event vocabulary directly from `engine/*.js` source (158 literal `type: "..."` occurrences plus 4 emitted only via `engine/events.js`'s `EVENT_TYPES` object indirection: `died`/`won`/`leveled`/`floorChanged`) — a comment-stripped, ternary-aware regex scan, never a hand-copied list, so it self-updates as new event types land.
- Built `src/browser/eventNarration.js`'s `EVENT_NARRATION` — a plain object mapping every one of those 162 types to a small `(e) => string` builder, migrating the prior adapter's ~22 real hand-written lines verbatim (identical `span class="hit"/"miss"/"hurt"/"roll"/"beat"/"banner"` markup so `mazeworld.html`'s existing logLine CSS renders them unchanged) and writing terse, on-tone (deadpan, family-friendly) new copy for the remaining ~136 combat/magic/economy/encounters/items types, reading each emitter's real payload shape from `engine/combat.js`, `magic.js`, `economy.js`, `encounters.js`, `items.js`, and `movement.js` directly.
- Refactored `engineAdapter.js#formatEvent` to delegate to the table (monolithic switch removed); `"moved"` stays a deliberate silent no-op via an explicit exclusion set, matching its pre-existing, already-tested behavior.
- `test/unit/formatEventsCoverage.test.js`: a standing two-part guardrail — (1) asserts `formatEvents()` returns a non-null narration line for every one of the 162 derived types, (2) asserts `EVENT_NARRATION` has no dead/typo entries for types the engine never emits (verified by dropping the 01-07/01-09 `pendingEncounter`/`pendingTrap`/`pendingChest` placeholder cases, which `encounters.js` has fully superseded since 01-10).
- `npm test` grew from 449 to 451 (both new coverage tests green, zero regressions); `npm run test:quick` stayed green at 362.

## Task Commits

1. **Task 1: Enumerate the full engine event vocabulary + coverage guard test** — `0364136` (test) — RED as designed: 144 of the derived 162 types produced no narration line under the pre-existing adapter.
2. **Task 2: Data-driven narration table + formatEvents delegation** — `26d5894` (feat) — GREEN: `EVENT_NARRATION` implemented, `formatEvent` delegates to it, both coverage tests pass. Includes the Rule 1 regex-derivation fix (see Deviations).

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `test/unit/formatEventsCoverage.test.js` - the coverage guardrail: derives the canonical event-type set from `engine/*.js` source at runtime and asserts full narration coverage plus no dead table entries
- `src/browser/eventNarration.js` - `EVENT_NARRATION`, the data-driven type->narration-line table (162 entries)
- `src/browser/engineAdapter.js` - `formatEvent`/`formatEvents` refactored to delegate to `EVENT_NARRATION`; `NO_NARRATION_TYPES` exclusion set for `"moved"`

## Decisions Made
- Derived the canonical event-type set from source rather than trusting 04-RESEARCH.md's "~140" estimate — the actual grepped/ternary-aware count is 162, confirming the research's own caveat that this was "a direct grep count, not an estimate" undercounted the ternary-typed pushes until this plan's own regex fix caught them too.
- Kept `"moved"` excluded from the coverage requirement by name (not by omission) — narrating it would contradict `test/unit/engineAdapter.test.js`'s existing, already-locked assertion that a `moved` event contributes zero HTML lines.
- Dropped the 3 dead `pendingEncounter`/`pendingTrap`/`pendingChest` cases from the old switch rather than migrating them "verbatim" — they are unreachable now that `encounters.js` (01-10) replaced the stubs that used to emit them, and Task 2's own "no dead entries" acceptance criterion directly requires their removal.
- `goldGained`/`spGained` narration branches on their optional `reason`/`why` field since both event types now fire from multiple call sites (`items.js#gainWilmst`, `combat.js#killFoe`/`parley`, `movement.js#descend`) with different semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Coverage test's own type-derivation regex missed ternary-typed event pushes**
- **Found during:** Task 2 (turning the coverage test green — the "no dead entries" sub-test unexpectedly flagged 4 real, migrated table entries as dead)
- **Issue:** `test/unit/formatEventsCoverage.test.js`'s Task-1 regex (`type:\s*"([A-Za-z]+)"`) only matched a single string literal directly following `type:`. `engine/movement.js` emits `climbedOver`/`leaptOver`/`fellClimbing`/`fellInGorge` via ternary expressions (`type: climbing ? "climbedOver" : "leaptOver"`), so neither branch's string sits directly after `type:` — the derivation silently omitted all 4 from the canonical set, making the "no dead entries" check falsely reject their legitimately-migrated `EVENT_NARRATION` entries.
- **Fix:** Broadened the regex to capture the entire expression after `type:` up to the next `,`/`}`, then extract every quoted string within that expression (handles both the simple single-literal case and any ternary/multi-branch case transparently).
- **Files modified:** test/unit/formatEventsCoverage.test.js
- **Verification:** `node --test test/unit/formatEventsCoverage.test.js` — canonical set size confirmed at 162 (up from an incomplete 158 before the fix); both sub-tests pass; `npm test` stays green at 451.
- **Committed in:** 26d5894 (Task 2 commit, alongside the eventNarration.js/engineAdapter.js changes it was discovered while landing)

---

**Total deviations:** 1 auto-fixed (1 bug, in the test's own derivation logic — not the production code)
**Impact on plan:** No scope creep. The fix strengthens the guardrail's correctness (a stricter, more complete derivation) rather than weakening it; without the fix, the "no dead entries" check would have forced dropping 4 legitimately-narrated types just to pass a buggy test.

## Issues Encountered
None beyond the derivation-regex bug documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 04-07 (combat/economy engine-routing) can now wire every remaining prototype code path through `dispatch()` with zero risk of a silent, blank combat/store log line — every event type those domains can emit already has a narration entry.
- 04-08 (ORACLE/combat log rendering) consumes `formatEvents()`'s now-complete output with no further adapter changes needed; `oracleLogViewModel` (04-03) already parses whatever HTML `formatEvents` returns.
- Phase 5's voice generator has a clean, enumerable 162-entry table to replace wholesale — `EVENT_NARRATION`'s flat type->builder shape is the intended replacement seam.
- `npm test` is green at 451 (up from 449 baseline); `npm run test:quick` green at 362.
- No blockers for the rest of Wave 1 or downstream waves.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*

## Self-Check: PASSED

All created/modified files verified present on disk (src/browser/eventNarration.js, test/unit/formatEventsCoverage.test.js, src/browser/engineAdapter.js, this SUMMARY.md); both task commit hashes (0364136, 26d5894) verified present in `git log --oneline --all`.
