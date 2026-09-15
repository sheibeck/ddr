---
phase: 25-nothing-happens-silently-feature-feedback
plan: 02
subsystem: ui
tags: [toasts, narration, presentation, event-payload, feature-feedback, oracle, feed-01, feed-02, feed-03, feed-05, feed-06]

# Dependency graph
requires:
  - phase: 25-nothing-happens-silently-feature-feedback
    plan: 01
    provides: "The additive event payload fields this table reads defensively: soaked, needMods, soldierCrit, critBy, armorSoaked.wear/.halved, struck.need, rested.doubled, potionDrunk.doubled, armorPatched.by, scrollRefused.reason, itemRejected/equipRejected reason 'acrobat'"
provides:
  - "src/browser/missLines.js — MISS_LINES (15 distinct, <=40 char, family-friendly fledgling-miss quips), QUIP_MAX_LEVEL=2, missLineAt(seq) (negative-safe integer rotation), decorateMisses(events, level, seq) (pure, copy-on-decorate, level-gated)"
  - "engineAdapter.js: module-level missSeq counter (presentation-only); dispatch() decorates events through decorateMisses before formatEvents, so the Oracle line and the 25-03 toast share one quip from one assignment site"
  - "src/browser/toasts.js — TONES (7), PRIORITY ({block,you,them,feature,other}), MAX_TOASTS=4, ORACLE_ONLY (21-entry allowlist with reason comments), FEATURE_EVENTS (61-entry manifest), TOAST_FOR (189 builders, one per toasting engine event type, exactly partitioning the 209-type EVENT_NARRATION universe with ORACLE_ONLY)"
  - "Locked toast wordings for struckByFoe/foeMissed/memberStruck/struck/strikeMissed, all 24 refusal/rejection types (tone block, priority 0, voiced fallback even for unknown/absent reason), the THEM-family tone/prefix contract (hurt/dodge, text starts with the foe name), and the YOU-family contract (hit/miss, text starts with 'You')"
  - "test/unit/missLines.test.js (10 tests), test/unit/toastTable.test.js (17 tests); test/voice/safety-scan.test.js extended with TOAST_FOR + MISS_LINES coverage and new branch toggles"
affects: [25-03, 25-04, 25-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentation-side deterministic counter: decorateMisses(events, level, seq) takes a caller-owned plain integer (never Math.random/Date.now/the engine rng) so a rotating quip is fully reproducible and never touches state.rngState — engineAdapter.js owns the one module-level missSeq that advances it"
    - "One decoration site, two consumers: engineAdapter.js#dispatch decorates events ONCE (before formatEvents), so the Oracle html and the future toast (25-03) both read events[i].quip off the exact same object — never two independent quip draws"
    - "Pure toast table beside the narration table: TOAST_FOR mirrors EVENT_NARRATION's per-type builder shape ((e, ctx) => {...}) and its defend-every-field-with-??/?.-convention, but returns a structured {text, tone, priority} triple instead of an HTML string, so 25-03's aggregator can sort/cap/dedupe before ever touching the DOM"
    - "ORACLE_ONLY is a one-directional allowlist proven by set-difference: TOAST_FOR's key set is the exact complement of ORACLE_ONLY within EVENT_NARRATION's key set (209 = 189 + 20, plus 'moved' which is outside both narration and toast universes) — verified by construction, not by inspection"

key-files:
  created:
    - src/browser/missLines.js
    - src/browser/toasts.js
    - test/unit/missLines.test.js
    - test/unit/toastTable.test.js
  modified:
    - src/browser/engineAdapter.js
    - test/unit/engineAdapter.test.js
    - test/voice/safety-scan.test.js

key-decisions:
  - "heroResistFailed's toast text starts with the foe's name ('${name} gets through — you fail to resist.') rather than the plan action-body's illustrative 'You fail to resist ${name}' wording — the must_haves truths bullet's FEED-03 tone-family contract (text starting with the foe name for every THEM-family builder) is the binding, testable requirement; the action-body prose was descriptive, not locked."
  - "TOAST_FOR entry count is exactly 189 (209 EVENT_NARRATION keys minus the 20 ORACLE_ONLY entries that are also engine-emitted types; 'moved' is the 21st ORACLE_ONLY entry but lives outside both the narration and toast universes since it is silent by design) — verified programmatically as an exact set-equality, not just a >=180 threshold."
  - "insaneRolled and vaporRolled are treated as roll-detail siblings (priority 'other') rather than folded into the 'Your spell outcomes (priority you)' bullet's blanket priority — the plan's own ORACLE_ONLY-adjacent note explicitly calls these two out by name as roll-detail siblings 25-03's aggregator folds into their outcome toasts, which is the more specific instruction."
  - "Refusal wording deviates from the plan action-body's illustrative examples (e.g. 'Fridgians wear no armour.' as a generic noArmor example, or bagFull/nothingToThrowAt exact text) in favor of Claude's-discretion short wordings — the plan explicitly reserves 'exact toast strings' for Claude's discretion except where a wording is called out as a must_haves truth or a Task 3 locked-wording test (struckByFoe/foeMissed/memberStruck/struck/strikeMissed/spellHit/foeBolted), all of which match exactly."

requirements-completed: [FEED-01, FEED-02, FEED-03, FEED-05, FEED-06]

coverage:
  - id: D1
    description: "missLines.js corpus (15 distinct, <=40 char, family-friendly, no shouting) with a deterministic negative-safe integer rotation (missLineAt) and a pure, copy-on-decorate, level-gated decorateMisses(events, level, seq) that stamps a quip on every non-untouchable strikeMissed event while level <= 2, and is the identity at level 3"
    requirement: "FEED-05"
    verification:
      - kind: unit
        ref: "test/unit/missLines.test.js (10 tests: corpus constraints, full-rotation no-repeat, negative-safety, decorate purity/level-gate/untouchable-exclusion, Math.random/Date.now source scan)"
        status: pass
    human_judgment: false
  - id: D2
    description: "engineAdapter.js#dispatch decorates the returned events through decorateMisses with the post-action hero level and a module-level presentation counter (missSeq), before formatting html — so a real strikeMissed through dispatch() carries a rotating quip at level <=2, the Oracle html keeps the roll before the quip, and leveling to 3 yields a plain unquipped miss"
    requirement: "FEED-05"
    verification:
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#'Phase 25 (FEED-05): dispatch() stamps a rotating quip on strikeMissed at level <= 2, and stops at level 3'"
        status: pass
    human_judgment: false
  - id: D3
    description: "toasts.js exports TONES/PRIORITY/MAX_TOASTS/ORACLE_ONLY(21)/FEATURE_EVENTS(61)/TOAST_FOR(189) — a builder for every toasting engine event type not in ORACLE_ONLY, exactly partitioning EVENT_NARRATION's 209-type universe; every builder survives a bare {type} call with a valid {text, tone, priority} shape"
    requirement: "FEED-01, FEED-06"
    verification:
      - kind: unit
        ref: "test/unit/toastTable.test.js#'every TOAST_FOR builder survives a bare {type} call with a valid shape'; node verify one-liner (TOAST_FOR 189, ORACLE_ONLY 21, FEATURE 61, exact set-equality against EVENT_NARRATION minus ORACLE_ONLY)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every refusal/rejection builder (24 types) returns tone block, priority 0, and non-empty voiced text even when reason is absent or unknown, with reason-specific text differing from the generic fallback for parleyRefused/itemRejected/equipRejected/useRefused/scrollRefused/joinerRefused/strikeRefused"
    requirement: "FEED-02"
    verification:
      - kind: unit
        ref: "test/unit/toastTable.test.js#'every refusal type is block/priority-0...' and #'reason-specific refusal text differs from the generic fallback' (24-type loop x 3 payload shapes)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Direction is encoded in tone family: THEM-family builders (struckByFoe/foeMissed/memberStruck/foeBolted/foeDrained/foeDebuffed/foeHealed/foeSummoned/foeCast/foeRevived/foeSlept/foeOutOfSpells/heroResistFailed) return hurt/dodge with text starting with the foe name; YOU-family builders (struck/strikeMissed/heroResisted) return hit/miss starting with 'You'; locked wordings for struckByFoe/foeMissed/memberStruck/struck/strikeMissed/spellHit/foeBolted match exactly"
    requirement: "FEED-03, FEED-06"
    verification:
      - kind: unit
        ref: "test/unit/toastTable.test.js#'THEM-family builders...', #'YOU-family builders...', #'locked wordings: *' (5 tests), #'both directions: your spell outcomes and their outcomes'"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every toast string and every miss quip is under the family-friendly voice scan (no new banned-term collisions; the allowlist stays complete and load-bearing); no Math.random/Date.now/DOM access in either new module"
    requirement: "FEED-05 (voice half)"
    verification:
      - kind: unit
        ref: "test/voice/safety-scan.test.js#'TOAST_FOR: every toast builder renders family-friendly across all branches and tokens' (new); MISS_LINES folded into collectAuthoredStrings; test/unit/missLines.test.js and test/unit/toastTable.test.js purity-scan tests"
        status: pass
    human_judgment: false
  - id: D7
    description: "npm test stays fully green with the new modules and tests added (no engine file touched, this plan touches no engine code, so parity is unaffected by construction)"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "npm test (1254 pass, 0 fail; 1225 baseline + 29 new: 10 missLines + 1 engineAdapter + 17 toastTable + 1 safety-scan)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-15
status: complete
---

# Phase 25 Plan 02: Toast Table and Fledgling-Miss Quip Corpus Summary

**A pure, DOM-free `toasts.js` table (189 builders exactly partitioning the engine's 209-type event vocabulary) and a `missLines.js` fledgling-miss quip corpus, wired into `engineAdapter.dispatch` so the Oracle and the future toast share one deterministic quip from a single presentation-side counter.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 4 new, 3 modified

## Accomplishments

- `src/browser/missLines.js`: `MISS_LINES` (15 distinct, deadpan, family-friendly fledgling-adventurer quips, each <= 40 characters), `QUIP_MAX_LEVEL = 2`, `missLineAt(seq)` (a plain, negative-safe integer modulo — never floating point, never the engine rng or wall-clock time), and `decorateMisses(events, level, seq)` — pure, copy-on-decorate (never mutates the engine's own event objects), stamping a quip onto every non-untouchable `strikeMissed` event only while `level <= QUIP_MAX_LEVEL`, and returning the identical array reference (identity no-op) once the hero levels past it.
- `src/browser/engineAdapter.js`: a new module-level `missSeq` counter (presentation-only — never serialized, never part of `state.rngState`, resets on reload by design) and `dispatch()` now decorates its returned `events` through `decorateMisses` with the post-action hero level, BEFORE formatting the Oracle html — so the Oracle line and the future toast (25-03) read the exact same quip from this one assignment site.
- `src/browser/toasts.js`: `TONES` (hit/miss/hurt/dodge/magic/block/beat), `PRIORITY` (`{block:0, you:1, them:2, feature:3, other:4}`), `MAX_TOASTS = 4`, `ORACLE_ONLY` (a 21-entry Set of bookkeeping types each with a one-line reason comment), `FEATURE_EVENTS` (a 61-entry manifest of every class/sub-class/race feature + refusal event), and `TOAST_FOR` — exactly 189 builders, one per toasting engine event type, verified by construction to be the exact complement of `ORACLE_ONLY` within `EVENT_NARRATION`'s 209-type universe (no missing, no extra).
- Locked wordings implemented exactly as specified: `struckByFoe` ("Dante hits you (6)" + `· CRIT` + soak note), `foeMissed` (needMods-credited miss note only when the roll would have landed without the negative modifiers), `memberStruck`, `struck` (+ critBy-named reason suffix), `strikeMissed` (untouchable vs. quipped), plus `spellHit`/`foeBolted` exact strings and the full "both directions" spell/foe-ability coverage (FEED-06).
- All 24 refusal/rejection event types (`strikeRefused` through `parleyExhausted`) return tone `block`, priority `0`, and a non-empty voiced fallback even with an absent or unrecognized `reason` — with reason-specific text (parleyRefused/itemRejected/equipRejected/useRefused/scrollRefused/joinerRefused/strikeRefused) verified to differ from the generic fallback (FEED-02, probe FEED-02 empty).
- Tone-family direction contract (FEED-03): every THEM-family builder (foe-caused outcome) returns `hurt`/`dodge` and text starting with the foe's name; every YOU-family builder returns `hit`/`miss` and text starting with "You" — verified across 13 THEM-family and 3 YOU-family builders with a shared test payload.
- `test/voice/safety-scan.test.js` extended: imports `TOAST_FOR` and `MISS_LINES`, adds 19 new `BRANCH_TOGGLES` entries covering every new reason/flag branch (pilfer, acrobat, woodsman, noRunes, knight, conArtist, cutthroat, wilmsry, pickpocket, bard, doubled, halved/wear, soaked, needMods, critBy, soldierCrit, quip, untouchable, encounter-flag combo), adds a new `"TOAST_FOR: every toast builder renders family-friendly..."` test mirroring the `EVENT_NARRATION` scan, and folds `MISS_LINES` into `collectAuthoredStrings` so the quip corpus participates in the allowlist completeness/load-bearing meta-tests. No new banned-term collisions; the allowlist stays complete and load-bearing.
- Final suite: `npm test` 1254 pass / 0 fail (1225 baseline + 29 new: 10 `missLines.test.js` + 1 `engineAdapter.test.js` + 17 `toastTable.test.js` + 1 `safety-scan.test.js`). This plan touches no engine file, so parity is unaffected by construction.

## Field Reference for 25-03/25-05

- `TOAST_FOR` — 189 entries, `Object.keys(TOAST_FOR)` == the exact complement of `ORACLE_ONLY` within `EVENT_NARRATION`'s key set.
- `ORACLE_ONLY` (21): `moved, dayBegan, floorChanged, spellChargeRecovered, spGained, combatEnded, died, won, storeLeft, encounterRolled, tableFour, tableFourNoop, findOffered, findTaken, findLeft, itemDropped, itemUnequipped, joinerMet, faerieMet, grimoireSold, itemConsumed`.
- `FEATURE_EVENTS` (61): every class/sub-class/race feature event and every refusal type (see `src/browser/toasts.js` for the full literal array); a strict subset of `TOAST_FOR`'s keys, disjoint from `ORACLE_ONLY`.
- `MISS_LINES` (15): `"A swing. Technically.", "The air takes the hit for it.", "You attack the general vicinity.", "That was practice. Probably.", "Nowhere near. Good effort though.", "A rehearsal, not a performance.", "Your weapon declines to participate.", "You miss. It looks surprised too.", "Wide. Impressively wide.", "Somewhere, a wall feels threatened.", "The floor was never the target.", "Ambitious. Also nowhere close.", "You swing at yesterday.", "That counts as a warning shot.", "The dungeon rates that a two."`.
- `TOAST_FOR[type](e, ctx = {})` -> `{ text, tone, priority }`; every builder defends every field with `??`/`?.` and is pure (deepEqual on repeated calls with the same payload).
- `decorateMisses(events, level, seq)` -> `{ events, seq }`; `engineAdapter.dispatch` is the ONE call site — 25-03/25-04 read `events[i].quip` off the already-decorated array, never call `decorateMisses` themselves.

## Task Commits

Each task was committed atomically:

1. **Task 1: missLines.js (corpus + deterministic rotation + decorateMisses) with tests, wired into engineAdapter.dispatch** - `2df92b4` (feat)
2. **Task 2: toasts.js — TONES, PRIORITY, MAX_TOASTS, ORACLE_ONLY, FEATURE_EVENTS and the full TOAST_FOR table** - `796308f` (feat)
3. **Task 3: toastTable.test.js (builder contracts, refusal fallbacks, tone families, bare-type safety) + safety-scan corpus extension** - `be914c7` (test)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `src/browser/missLines.js` - new: `MISS_LINES`, `QUIP_MAX_LEVEL`, `missLineAt`, `decorateMisses`
- `src/browser/engineAdapter.js` - module-level `missSeq` counter; `dispatch()` decorates events through `decorateMisses` before `formatEvents`
- `src/browser/toasts.js` - new: `TONES`, `PRIORITY`, `MAX_TOASTS`, `ORACLE_ONLY`, `FEATURE_EVENTS`, `TOAST_FOR` (189 builders)
- `test/unit/missLines.test.js` - new, 10 tests
- `test/unit/toastTable.test.js` - new, 17 tests
- `test/unit/engineAdapter.test.js` - one new dispatch-level quip test
- `test/voice/safety-scan.test.js` - extended: `TOAST_FOR`/`MISS_LINES` imports, 19 new branch toggles, one new test, `MISS_LINES` folded into `collectAuthoredStrings`

## Decisions Made

See `key-decisions` in the frontmatter above (heroResistFailed's foe-name-first wording per the FEED-03 must_haves contract; exact 189-entry TOAST_FOR count verified by set-equality; insaneRolled/vaporRolled treated as roll-detail siblings; refusal wording left to Claude's discretion except where locked).

## Deviations from Plan

None — plan executed exactly as written. Where the plan's action-body prose offered an illustrative wording that conflicted with a must_haves truths bullet's binding contract (heroResistFailed's foe-name-first tone-family requirement vs. the action body's "You fail to resist" example), the must_haves truths bullet was treated as authoritative (it is the testable FEED-03 contract; the action body is descriptive). This is not a deviation from the plan's REQUIREMENTS — it is resolving an internal inconsistency in favor of the binding contract, consistent with "Claude's discretion" on exact toast strings.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 25-03 can now build `toastsForAction` (aggregation/priority/cap) directly on top of `TOAST_FOR`, `PRIORITY`, and `MAX_TOASTS` — no further table changes needed.
- 25-04 can wire the shell's toast host to `toastsForAction`'s output and add the CSS `data-tone` values for `dodge`/`block`/`beat` (and re-spec `miss`) — the tone vocabulary is locked.
- 25-05 can add the standing coverage/manifest/purity guards directly against `TOAST_FOR`/`ORACLE_ONLY`/`FEATURE_EVENTS`/`MISS_LINES` — this plan already proves the invariants those guards will assert (exact 189/21 partition, 61-entry manifest subset, purity, voice-scan coverage) as one-off tests; 25-05's job is to make them standing tripwires.
- No blockers for 25-03/25-04/25-05.

---
*Phase: 25-nothing-happens-silently-feature-feedback*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: src/browser/missLines.js
- FOUND: src/browser/toasts.js
- FOUND: test/unit/missLines.test.js
- FOUND: test/unit/toastTable.test.js
- FOUND: src/browser/engineAdapter.js
- FOUND: test/unit/engineAdapter.test.js
- FOUND: test/voice/safety-scan.test.js
- FOUND: .planning/phases/25-nothing-happens-silently-feature-feedback/25-02-SUMMARY.md
- FOUND commit: 2df92b4 (Task 1)
- FOUND commit: 796308f (Task 2)
- FOUND commit: be914c7 (Task 3)
