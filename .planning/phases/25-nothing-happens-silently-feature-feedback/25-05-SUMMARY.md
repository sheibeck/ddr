---
phase: 25-nothing-happens-silently-feature-feedback
plan: 05
subsystem: testing
tags: [toasts, narration, coverage-guard, feature-manifest, purity, feed-01, feed-02, feed-06]

# Dependency graph
requires:
  - phase: 25-nothing-happens-silently-feature-feedback
    plan: 02
    provides: "TOAST_FOR (189 builders), ORACLE_ONLY (21-entry allowlist), FEATURE_EVENTS (61-entry manifest) in src/browser/toasts.js"
  - phase: 25-nothing-happens-silently-feature-feedback
    plan: 03
    provides: "toastsForAction(type, events, ctx) — the exported per-action aggregation pipeline"
provides:
  - "test/unit/toastsCoverage.test.js — 9 standing tests: exact TOAST_FOR/ORACLE_ONLY partition over the canonical 209-type engine vocabulary, no dead entries either side, named legibility/refusal events pinned to the table never the allowlist, ORACLE_ONLY bookkeeping-only proof (no FEATURE_EVENTS overlap, every non-'moved' entry still narrated, size band [10,40]), FEATURE_EVENTS proven a subset of TOAST_FOR intersected with EVENT_NARRATION, FEATURE_EVENTS proven to cover every event name derived from test/unit/identity-contract.test.js's own source, a purity tripwire on toasts.js/missLines.js, and a no-cycle identity proof on the new re-export"
  - "src/browser/eventNarration.js: one re-export line — `export { TOAST_FOR, ORACLE_ONLY, FEATURE_EVENTS, toastsForAction } from \"./toasts.js\";` — so the toast surface and the narration table are reachable from one module"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone-by-design coverage guards: toastsCoverage.test.js duplicates deriveCanonicalEventTypes/stripComments/collectJsFiles verbatim from formatEventsCoverage.test.js rather than importing a shared helper module, so a future refactor that breaks one derivation cannot silently disable the other guard through a shared, possibly-stale import."
    - "Line-comments-first stripComments order (25-04's documented pitfall): every stripComments() in the new test strips `//` before `/*...*/`, which is immune to a `//` comment containing a `/*`-looking substring being misread as an unterminated block-comment opener."
    - "Source-derived, never hand-copied assertion sets: both the canonical event-type set and the identity-contract event-name set are derived at runtime from the relevant source file's own text via regex, matching the phase's standing prohibition against hand-copied lists."

key-files:
  created:
    - test/unit/toastsCoverage.test.js
  modified:
    - src/browser/eventNarration.js

key-decisions:
  - "No fix was needed in toasts.js/eventNarration.js to satisfy the new guards — 25-02/25-03 already built TOAST_FOR/ORACLE_ONLY/FEATURE_EVENTS to the exact invariants this plan locks (verified: 189/21 exact partition over 209 canonical types, zero dead entries, all 29 named legibility/refusal events in the table, all 32 identity-contract-derived event names already inside the 61-entry manifest). This plan's job (per its own objective) was to make those already-true one-off facts into standing tripwires, not to change the table."
  - "The plan's Task 2 acceptance-criteria literal `grep -c 'eventNarration' src/browser/toasts.js` == 0 does not hold (actual: 4) because toasts.js already contains four PRE-EXISTING prose comments naming 'eventNarration.js' as its sibling module (from 25-02/25-03, e.g. 'beside src/browser/eventNarration.js's EVENT_NARRATION'). The plan explicitly prohibits changing toasts.js content in this plan ('No change to toasts.js or missLines.js content in this plan'), so those comments were left untouched. The semantic invariant the grep was a shorthand for — no IMPORT cycle — is verified correctly and precisely by this plan's own test ('the narration table re-exports the toast surface without a cycle'), which source-checks for the literal import specifier `from \"./eventNarration.js\"` (absent) rather than any mention of the string 'eventNarration'. Treated as a plan-authoring shorthand mismatch, not a defect to fix by editing protected content."

requirements-completed: [FEED-01, FEED-02, FEED-06]

coverage:
  - id: D1
    description: "Every engine-emitted event type (canonical set derived from engine/*.js source, 209 types) has either a TOAST_FOR builder or an explicit ORACLE_ONLY entry; TOAST_FOR and ORACLE_ONLY are disjoint; neither contains a dead/typo entry the engine never emits"
    requirement: "FEED-06"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js#'every engine-emitted event type is either toasted or explicitly Oracle-only' and #'TOAST_FOR and ORACLE_ONLY are disjoint and contain no dead entries'"
        status: pass
    human_judgment: false
  - id: D2
    description: "nothingToThrowAt, noChargesLeft, spellResisted, resistFailed, every foe ability event (foeCast/foeBolted/foeDrained/foeDebuffed/foeHealed/foeSummoned), heroResisted/heroResistFailed, and every refusal type live in TOAST_FOR, never ORACLE_ONLY (probe FEED-06/FEED-02 empty)"
    requirement: "FEED-06"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js#'the named legibility events live in the table, never the allowlist (probe FEED-06/FEED-02 empty)'"
        status: pass
    human_judgment: false
  - id: D3
    description: "ORACLE_ONLY never contains a FEATURE_EVENTS entry, every entry except 'moved' still has an EVENT_NARRATION line (the Oracle carries it), and its size stays in a sane bookkeeping-only band [10,40] so it cannot quietly swallow the toast table"
    requirement: "FEED-02"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js#'ORACLE_ONLY holds bookkeeping only'"
        status: pass
    human_judgment: false
  - id: D4
    description: "FEATURE_EVENTS (61 entries, no duplicates) is a strict subset of TOAST_FOR keys intersected with EVENT_NARRATION keys — every manifest entry has both a toast builder and an Oracle line, and every builder survives a bare {type} call with non-empty text"
    requirement: "FEED-01"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js#'FEATURE_EVENTS is a subset of TOAST_FOR keys intersected with EVENT_NARRATION keys'"
        status: pass
    human_judgment: false
  - id: D5
    description: "FEATURE_EVENTS covers every event name test/unit/identity-contract.test.js asserts, derived at runtime from that file's own comment-stripped source (expectEvent/findEvent second args, .type === comparisons, {type:} literals) intersected with the canonical engine set — never a hand-copied list; the derived set is >= 30 names (32 found)"
    requirement: "FEED-01"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js#'FEATURE_EVENTS covers every event name test/unit/identity-contract.test.js asserts'"
        status: pass
    human_judgment: false
  - id: D6
    description: "src/browser/toasts.js and src/browser/missLines.js contain no Math.random, Date.now, DOM access (document./window./globalThis./localStorage), or engine/ import on any non-comment line"
    requirement: "Engine gate (T-25-23)"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js#'presentation toast modules are pure (no Math.random/Date.now/DOM/engine import)'"
        status: pass
    human_judgment: false
  - id: D7
    description: "src/browser/eventNarration.js re-exports TOAST_FOR/ORACLE_ONLY/FEATURE_EVENTS/toastsForAction from ./toasts.js BY REFERENCE (identity-equal, not a copy); toasts.js contains no import of eventNarration.js (no cycle)"
    requirement: "Engine gate (T-25-22)"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js#'the narration table re-exports the toast surface without a cycle'"
        status: pass
    human_judgment: false
  - id: D8
    description: "The full suite stays fully green with the new guard added (no engine file touched, so parity is unaffected by construction); parity stays 33/33 with a clean tree and untouched fixture; the pre-existing formatEventsCoverage/safety-scan/engineAdapter tests are unaffected by the re-export"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "npm test (1330 pass, 0 fail; 1321 baseline + 9 new); node --test \"test/parity/**/*.test.js\" (33/33, clean test/parity tree, prototype-master.js.txt untouched); node --test test/unit/formatEventsCoverage.test.js test/voice/safety-scan.test.js test/unit/engineAdapter.test.js (43/43)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-15
status: complete
---

# Phase 25 Plan 05: Toast Coverage Standing Guard Summary

**A new `toastsCoverage.test.js` (9 tests) turns 25-02/25-03's already-true toast-table invariants into standing tripwires — exact TOAST_FOR/ORACLE_ONLY partition over the engine's 209-type vocabulary, feature-manifest completeness against the identity-contract test's own source, and a purity + no-cycle proof for the new `eventNarration.js` re-export — with zero changes needed to `toasts.js` itself.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 1 new, 1 modified

## Accomplishments

- `test/unit/toastsCoverage.test.js` (new, 9 tests) duplicates `deriveCanonicalEventTypes`/`stripComments`/`collectJsFiles` verbatim from `test/unit/formatEventsCoverage.test.js` (same `KNOWN_INDIRECT_TYPES`, same regex derivation), deliberately kept standalone rather than shared so a refactor breaking one guard cannot silently disable the other. `stripComments` here strips line comments before block comments — the safe order 25-04 discovered was needed after a `//`-comment mention of `@capacitor/*` was misread as an unterminated block-comment opener.
- **Partition guard:** confirmed the derived canonical set is exactly 209 engine event types; every one has either a `TOAST_FOR` builder or an `ORACLE_ONLY` entry (0 missing); `TOAST_FOR` and `ORACLE_ONLY` are exactly disjoint (0 overlap); neither contains a dead/typo entry the engine never emits (0 in either direction).
- **Named legibility/refusal probe:** all 29 named events (`nothingToThrowAt`, `noChargesLeft`, `spellResisted`, `resistFailed`, every foe ability event, `heroResisted`/`heroResistFailed`, `scrollRefused`, and every refusal type through `backstabDenied`) are confirmed in `TOAST_FOR`, absent from `ORACLE_ONLY` — probe FEED-06/FEED-02 both empty.
- **ORACLE_ONLY bookkeeping-only proof:** confirmed 0 `FEATURE_EVENTS` entries inside `ORACLE_ONLY`; every `ORACLE_ONLY` type except `moved` still has an `EVENT_NARRATION` entry (the Oracle is the record); `ORACLE_ONLY.size` (21) sits inside the sane `[10, 40]` band.
- **Feature manifest guard:** confirmed `FEATURE_EVENTS` (61 entries, 0 duplicates) is a strict subset of `TOAST_FOR` keys intersected with `EVENT_NARRATION` keys, and every builder returns non-empty text for a bare `{type}` call.
- **Identity-contract coverage guard:** reads `test/unit/identity-contract.test.js`'s own comment-stripped source at runtime, extracts event names via three regex shapes (`expectEvent`/`findEvent` second args, `.type === "..."` comparisons, `{ type: "..." }` literals), intersects with the canonical engine set (dropping non-event strings like `"Beasts"`/`"Humans"`/`"Magical"`), and confirms 32 names (>= 30 required) are ALL already inside `FEATURE_EVENTS` — 0 gaps, no hand-copied list anywhere in the test.
- **Purity tripwire** (T-25-23): scans `src/browser/toasts.js` and `src/browser/missLines.js` line-by-line (comment-stripped) for `Math.random`, `Date.now`, `document.`/`window.`/`globalThis.`/`localStorage`, or an `engine/`-importing specifier — 0 offenses.
- **No-cycle proof** (T-25-22): dynamic-imports `src/browser/eventNarration.js` and asserts its re-exported `TOAST_FOR`/`ORACLE_ONLY`/`FEATURE_EVENTS` are identity-equal (`===`) to the objects `toasts.js` exports directly (a true re-export, not a copy) and that `toastsForAction` is a function; source-checks that `toasts.js` contains no `from "./eventNarration.js"`.
- `src/browser/eventNarration.js` gained exactly one new line: `export { TOAST_FOR, ORACLE_ONLY, FEATURE_EVENTS, toastsForAction } from "./toasts.js";` (with a two-line comment explaining the phase decision and the one-directional guarantee) — no other content changed.
- Final suite: `npm test` 1330 pass / 0 fail (1321 baseline + 9 new); `node --test "test/parity/**/*.test.js"` 33/33 with a clean `test/parity` tree and `test/parity/prototype-master.js.txt` untouched; `node --test test/unit/formatEventsCoverage.test.js test/voice/safety-scan.test.js test/unit/engineAdapter.test.js` 43/43 (unaffected by the re-export). No engine file touched in this plan.

## Final Counts (for the record)

- Canonical engine event-type vocabulary: **209** (derived from `engine/*.js` source, identical derivation to `formatEventsCoverage.test.js`).
- `ORACLE_ONLY`: **21** entries.
- `TOAST_FOR`: **189** entries — exactly `209 − 21 + 1` accounting for `moved` (silent by design, outside both universes).
- `FEATURE_EVENTS`: **61** entries, 0 duplicates.
- Identity-contract-derived event names (intersected with canonical): **32** (>= 30 required), 0 gaps against `FEATURE_EVENTS`.
- No builder or allowlist fix was required — every invariant this plan's guards assert was already true going in (25-02/25-03 built the table correctly the first time); this plan's contribution is making those facts standing tripwires instead of one-off tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: toastsCoverage.test.js — partition, exclusivity, manifest ⊆ table ∩ narration, manifest ⊇ identity-contract names** - `68b08de` (test)
2. **Task 2: Purity tripwire for the presentation modules, the eventNarration re-export (no cycle), full suite + parity** - `a61f7b2` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `test/unit/toastsCoverage.test.js` - new, 9 tests (partition, exclusivity, named-legibility probe, ORACLE_ONLY bookkeeping-only, FEATURE_EVENTS ⊆, FEATURE_EVENTS ⊇ identity-contract names, toastsForAction export sanity, purity tripwire, no-cycle proof)
- `src/browser/eventNarration.js` - one new re-export line at the end of the file: `export { TOAST_FOR, ORACLE_ONLY, FEATURE_EVENTS, toastsForAction } from "./toasts.js";`

## Decisions Made

See `key-decisions` in the frontmatter above (no toasts.js/eventNarration.js content fix was needed since 25-02/25-03 already satisfied every invariant; the plan's literal `grep -c 'eventNarration' src/browser/toasts.js == 0` acceptance criterion does not hold due to four pre-existing, protected prose comments in toasts.js naming its sibling module — the actual no-cycle invariant is verified correctly by this plan's own import-specifier source check instead).

## Deviations from Plan

### Auto-fixed Issues

None — no code fix was needed anywhere in `toasts.js`, `missLines.js`, or `eventNarration.js` beyond the one planned re-export line. Every guard this plan adds passed against the existing 25-02/25-03 implementation on the first run.

### Documented Verification Gap (not a defect)

**1. Task 2's literal acceptance-criteria grep does not hold, by design of an earlier plan**
- **Found during:** Task 2, running the plan's own acceptance-criteria commands
- **Issue:** The plan's Task 2 acceptance criteria include `grep -c 'eventNarration' src/browser/toasts.js` == 0 as a stand-in for "no import cycle." The actual count is 4 — all four are pre-existing prose comments from 25-02/25-03 that name `eventNarration.js` as `toasts.js`'s sibling module (e.g. "the pure, testable toast table that sits beside src/browser/eventNarration.js's EVENT_NARRATION"). None of the four is an `import` statement.
- **Why not fixed:** This plan explicitly prohibits changing `toasts.js` content ("No change to toasts.js or missLines.js content in this plan (only tests and the re-export)"). Editing those comments to force the literal grep to zero would violate that prohibition and would also remove accurate, useful design documentation.
- **Resolution:** The semantic invariant the acceptance criterion was a shorthand for — no `import` cycle between the two modules — is verified precisely and correctly by this plan's own test (`'the narration table re-exports the toast surface without a cycle'`), which source-checks for the literal specifier `from "./eventNarration.js"` (0 occurrences) rather than any mention of the bare string `"eventNarration"`. `toasts.js` was left completely unmodified.
- **Files modified:** None (this is a documentation-only note; no file was changed to address it).

---

**Total deviations:** 0 code fixes; 1 documented verification-gap note (a plan-authoring shorthand mismatch between a literal grep and an explicit content-change prohibition in the same plan, resolved in favor of the explicit prohibition and the semantically-correct test already written).
**Impact on plan:** None on functionality or on any must_haves truth — every must_haves truth, artifact, and locked wording in the plan's frontmatter is satisfied and proven by a passing test.

## Issues Encountered

None beyond the documented verification-gap note above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This is the last plan in Phase 25 (wave 3, `depends_on: ["25-03"]`, no further plans reference it as a dependency). The phase's two invariants (nothing ships silently; the feature manifest is honest) are now standing, automated guards rather than one-off proofs:

- Any future engine event type added without a `TOAST_FOR` builder or an `ORACLE_ONLY` entry will fail `toastsCoverage.test.js` immediately.
- Any future `FEATURE_EVENTS` entry missing a toast or narration line, or any future `identity-contract.test.js` assertion naming an event type not yet in the manifest, will fail the same file.
- Any future `Math.random`/`Date.now`/DOM access creeping into `toasts.js`/`missLines.js`, or any future import from `eventNarration.js` into `toasts.js`, will fail the same file.
- The phase's device checklist (attached to 25-04-SUMMARY.md) remains available for the orchestrator's phone-push offer at phase close; no item in it blocks completion.
- No blockers. No follow-up plan is required by this plan's own scope.

---
*Phase: 25-nothing-happens-silently-feature-feedback*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: test/unit/toastsCoverage.test.js
- FOUND: src/browser/eventNarration.js
- FOUND: .planning/phases/25-nothing-happens-silently-feature-feedback/25-05-SUMMARY.md
- FOUND commit: 68b08de (Task 1)
- FOUND commit: a61f7b2 (Task 2)
