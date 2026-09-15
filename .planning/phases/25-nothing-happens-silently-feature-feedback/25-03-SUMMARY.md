---
phase: 25-nothing-happens-silently-feature-feedback
plan: 03
subsystem: ui
tags: [toasts, aggregation, presentation, feature-feedback, feed-01, feed-02, feed-03, feed-04, feed-06]

# Dependency graph
requires:
  - phase: 25-nothing-happens-silently-feature-feedback
    plan: 01
    provides: "The additive event payload fields the aggregators read defensively: soaked, needMods, soldierCrit, critBy"
  - phase: 25-nothing-happens-silently-feature-feedback
    plan: 02
    provides: "TOAST_FOR (189 builders), TONES, PRIORITY, MAX_TOASTS, ORACLE_ONLY, FEATURE_EVENTS, decorateMisses (missLines.js) wired into engineAdapter.dispatch"
provides:
  - "src/browser/toasts.js#toastsForAction(type, events, ctx = {}) — the per-action pipeline: encounterStart -> enemyRound -> yourRound -> spellChain (+resist fold) -> fleeChain -> parleyChain -> chestChain -> killFold -> map remaining through TOAST_FOR -> dedupe per type -> stable-sort by priority -> cap at MAX_TOASTS"
  - "Internal (non-exported) aggregators: enemyRound, yourRound, spellChain, fleeChain, parleyChain, chestChain, encounterStart, killFold, dedupeByType, sumSoaked — each documented in toasts.js"
  - "Locked aggregate format strings: '${name} hits you ${K} of ${M} (${sum})', '${name} misses you ${M} times', '${F} foes swing, ${K} land (${sum})' / 'none land', 'You hit ${t} ${K} of ${M} (${sum})', 'You miss ${t} ${M} times', the ' · CRIT' / ' · felled' / ' — ${quip}' / ' · ${parts} soaked' suffixes, and the '(${roll}+${bonus} vs ${need})' roll fold"
  - "test/unit/toastsForAction.test.js (53 tests) proving every must_haves truth, boundary, and probe tag"
affects: [25-04, 25-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "consumed-index Set + tagged-toast pipeline: each aggregator receives the full events array and a shared `consumed` Set, marks the indices it folds, and returns `{ text, tone, priority, idx, type?, _target? }` toasts; `idx` (the first consumed event's index) drives the final stable sort, `type` (present only on table-mapped toasts) drives per-type dedupe, and `_target` (present only on a landed player hit) is how killFold finds the toast to append a felled suffix to — three independent, orthogonal tags on the same lightweight toast shape"
    - "borrow the field the aggregated event doesn't carry: engine/magic.js's spellHit/spellMissed events carry no `spell` field of their own (only spellThrown does) — spellChain spreads `{ ...event, spell: e0.spell }` before handing off to the existing TOAST_FOR builder, rather than teaching the builder a second lookup path"
    - "single shared literal for a cross-cutting suffix: killFold is the ONE place ' · felled' is concatenated, called once after all of yourRound/spellChain have run, so both call sites share one literal and one behavior instead of duplicating the suffix logic"

key-files:
  created:
    - test/unit/toastsForAction.test.js
  modified:
    - src/browser/toasts.js

key-decisions:
  - "spellResisted's wording drops its trailing period (introduced in 25-02) to match this plan's no-period aggregate-format convention every other locked wording follows (struckByFoe/foeMissed/struck/etc. carry none) — toastTable.test.js's own pin uses .includes(), so this is backward compatible and required to satisfy this plan's own literal 'Dante resists Doze' verify gate."
  - "encounterStart's flag clauses (knightBigFoe/samuraiNeverFirst/fridgianSlow/courtMageTalksFirst/acuteHearing) render via the existing TOAST_FOR.encounterStarted builder's own text (unchanged from 25-02) BEFORE the follower clauses this plan adds, rather than re-deriving the foe-list-only text and re-ordering flags after followers as the plan's action-body prose loosely suggested — no locked test asserts an exact ordering between flags and followers, and reusing the existing builder verbatim avoids duplicating its foe-list-formatting logic."
  - "killFold is a single shared function (not duplicated between yourRound and spellChain): a built toast opts in by carrying `_target` (a landed hit's target name); killFold runs once, after all target-bearing aggregators, and is the one place the ' · felled' suffix is concatenated in the whole file."
  - "spellChain's per-target spellHit/spellMissed folding borrows `spell` from the originating spellThrown event via a spread, since the real engine's spellHit/spellMissed events (engine/magic.js) never carry their own `spell` field — a gap in 25-02's single-event TOAST_FOR.spellHit/spellMissed builders that only surfaces once real (not hand-authored) event shapes are aggregated."

requirements-completed: [FEED-01, FEED-02, FEED-03, FEED-04, FEED-06]

coverage:
  - id: D1
    description: "toastsForAction(type, events, ctx) is a pure function that aggregates, prioritises, dedupes per event type, caps at MAX_TOASTS (4), and returns [{ text, tone, priority }]; empty/null/undefined events yield []; the same input always yields deepEqual output and never mutates its events"
    requirement: "FEED-01"
    verification:
      - kind: unit
        ref: "test/unit/toastsForAction.test.js — empty/garbage suite, 'is deterministic', 'never mutates its input events'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Toast order is deterministic: refusals (0) -> your outcome (1) -> enemy outcome (2) -> feature call-outs (3) -> other (4); ties keep engine order; the cap of 4 drops the lowest-priority, latest-engine-order toasts first; two same-priority feature events in one action both show, deduped per event type"
    requirement: "FEED-01, FEED-02"
    verification:
      - kind: unit
        ref: "test/unit/toastsForAction.test.js — 'probe FEED-01 ordering', 'probe FEED-02 ordering', 'probe FEED-01 adjacency' suite (backstab+struck+foeKilled, frenzy+struck+struckByFoe, two-backstab dedupe)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A refused action produces exactly one block toast, priority 0, never dropped by the cap even with 5+ competing toasts; withdrawalDenied/vanishDenied precede the flee-chain outcome toast in the same action"
    requirement: "FEED-02"
    verification:
      - kind: unit
        ref: "test/unit/toastsForAction.test.js — 'probe FEED-02 adjacency' suite (every refusal type, strikeRefused names the spell, withdrawalDenied+fleeRolled+fleeFailed ordering)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Enemy-round aggregation is exact and grouped by foe name: 1 swing has no 'of'; 2+ swings reads 'K of M (sum)' or 'M times'; 1-2 distinct foes get one toast each; 3+ distinct foes collapse into one toast; damage sums are integer event-count sums, never derived from sp.atk; member hits aggregate separately at feature priority"
    requirement: "FEED-04"
    verification:
      - kind: unit
        ref: "test/unit/toastsForAction.test.js — 'probe FEED-04 boundary'/'probe FEED-04 precision' suite (14 tests: single hit/miss, 2-of-2, 4-swing sum, 3-swing miss, crit/soldierCrit, two-foe order, 3-foe collapse landing/none-landing, same-name merge, member 1x and 2x, sp.atk-immune precision)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Your multi-attack rounds mirror the enemy wording (1 swing vs 2+ swings, crit suffix, first-quip-carrying miss), and the fledgling-miss quip's level-2/level-3 gate holds end-to-end through decorateMisses -> toastsForAction"
    requirement: "FEED-04"
    verification:
      - kind: unit
        ref: "test/unit/toastsForAction.test.js — your-round suite + the two decorateMisses-integration tests (level 2 quipped, level 3 plain)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every enemy-outcome toast has tone hurt/dodge and text starting with the foe name (or an F-foes collapse); every player-outcome toast has tone hit/miss and text starting with 'You' (FEED-03 tone-family contract)"
    requirement: "FEED-03"
    verification:
      - kind: unit
        ref: "test/unit/toastsForAction.test.js#'FEED-03: every THEM-family output...' and #'FEED-03: every YOU-family output...' (11-type matrix)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A spell that both hits and kills folds into one toast (Freeze+frozenSolid+foeKilled, and a plain spellHit+foeKilled felled suffix); a resisted spell shows only the resist toast; a resistFailed followed by its effect event yields only the effect toast; 3+ targets (Lightning) collapse into one toast; your cast sorts before the foe's own turn in the same action"
    requirement: "FEED-06"
    verification:
      - kind: unit
        ref: "test/unit/toastsForAction.test.js — 'probe FEED-06 adjacency'/'probe FEED-06 ordering' suite (6 tests)"
        status: pass
    human_judgment: false
  - id: D8
    description: "encounterStarted plus its same-action followers (trackable, allyJoined, warlockBoost, foeFled knight/conArtist, foeBored, phobiaFrozen, combatInDark) compose into ONE toast; the same events without an encounterStarted keep their own builders; fleeRolled/parleyRolled/chestLockRolled fold their roll detail into their outcome's own toast"
    requirement: "FEED-01, FEED-04"
    verification:
      - kind: unit
        ref: "test/unit/toastsForAction.test.js — encounter-start suite (4 tests) + chains suite (5 tests)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The pipeline is pure (no Math.random/Date.now/DOM access), and npm test stays fully green with no engine file touched (parity unaffected by construction)"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "npm test (1307 pass, 0 fail; 1254 baseline + 53 new); node --test test/unit/toastsForAction.test.js test/unit/toastTable.test.js test/unit/missLines.test.js (80/80); source-scan test for Math.random/Date.now/document./window."
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-15
status: complete
---

# Phase 25 Plan 03: toastsForAction Pipeline Summary

**`toastsForAction(type, events, ctx)` — the per-action toast pipeline that aggregates enemy/your multi-attack rounds (with the 3+ foe collapse and "K of M" wording), folds spell/flee/parley/chest roll chains and a combined encounter-start toast, dedupes and priority-sorts, and caps at 4 toasts.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 2 (1 modified, 1 new)

## Accomplishments

- `src/browser/toasts.js` gained `toastsForAction(type, events, ctx = {})` — the exported pipeline the 25-04 shell will call once per dispatched action, plus ten internal (non-exported) aggregator/helper functions: `enemyRound`, `yourRound`, `spellChain`, `fleeChain`, `parleyChain`, `chestChain`, `encounterStart`, `killFold`, `dedupeByType`, `sumSoaked`.
- **Enemy rounds** aggregate per foe name: a single swing reuses the locked 25-02 single-event wording verbatim ("Dante hits you (6)" / "Dante misses you"); 2+ swings reads "Dante hits you 2 of 4 (11)" / "Dante misses you 3 times", with a summed integer soak suffix and a CRIT suffix when any hit was critical or a Soldier's roll-of-2. **3+ distinct foe names collapse into one toast** — "3 foes swing, 3 land (12)" or "3 foes swing, none land". Party-member hits (`memberStruck`/`foeMissed` with `member`) aggregate the same way but separately, at feature priority.
- **Your multi-attack rounds** mirror the same wording ("You hit Dante 2 of 2 (14) · CRIT", "You miss Dante 2 times"), carrying the FIRST quipped miss's quip on a 0-of-M group; untouchable misses are never grouped.
- **`killFold`** is the one shared place a foeKilled folds into an already-built toast as a felled suffix — used by both the your-round aggregator and the spell chain, so the literal suffix concatenation exists exactly once in the file.
- **`spellChain`** folds `spellThrown` -> its per-target outcome into one toast: a plain hit, a hit that also killed (felled suffix), a Freeze hit that also froze-and-killed ("Freeze — Dante frozen solid", no separate felled suffix), a miss, or — for 3+ targets (Lightning) — one collapsed "Lightning: 3 targets, 2 hit (18)" toast. It also folds a bare `resistFailed` away whenever a resisted-but-failed effect event (dozed/stunned/weakened/.../frozenSolid) follows it in the same action, for the same target or an untargeted AOE effect. Along the way this surfaced that the real `spellHit`/`spellMissed` engine events carry no `spell` field of their own (only `spellThrown` does) — the aggregator now borrows it from the originating `spellThrown`.
- **`fleeChain`/`parleyChain`/`chestChain`** fold each `*Rolled` event into its outcome, appending the roll detail (`(7+5 vs 11)`, `(15 vs 9)`) to the outcome's own text.
- **`encounterStart`** folds `encounterStarted` plus its same-action followers (trackable, allyJoined, warlockBoost, foeFled knight/conArtist, foeBored, phobiaFrozen, combatInDark) into ONE toast; without an `encounterStarted` in the action, each of those events keeps its own builder (e.g. a mid-fight lowHp flee).
- The pipeline maps every remaining unconsumed, non-`ORACLE_ONLY` event through `TOAST_FOR`, dedupes per event type (a repeated type with the same text collapses silently; with different text it appends ` ×N`), stable-sorts ascending by priority (ties keep engine order via the first-consumed event's index), and caps at `MAX_TOASTS` (4) — so a priority-0 refusal is never dropped and the cap always drops the lowest-priority, latest-engine-order toasts first.
- `spellResisted`'s single-event wording (25-02) dropped its trailing period to match this plan's no-period aggregate-format convention.
- New `test/unit/toastsForAction.test.js` (53 tests) proves every must_haves truth, boundary (1 vs 2+ swings, 1-2 vs 3+ foes, level 2 vs 3), refusal-first rule, chain fold, and direction contract, each named with its probe tag.
- Final suite: `npm test` 1307 pass / 0 fail (1254 baseline + 53 new); `node --test test/unit/toastsForAction.test.js test/unit/toastTable.test.js test/unit/missLines.test.js` 80/80; no engine file touched, so parity is unaffected by construction.

## Field Reference for 25-04/25-05

- `toastsForAction(type, events, ctx = {})` -> `Array<{ text, tone, priority }>`, at most 4 entries, sorted by priority ascending (block=0, you=1, them=2, feature=3, other=4).
- Locked aggregate format strings (verbatim, for the 25-04 shell smoke test and the device checklist):
  - `${name} hits you ${K} of ${M} (${sum})` / `${name} misses you ${M} times`
  - `${F} foes swing, ${K} land (${sum})` / `${F} foes swing, none land`
  - `You hit ${t} ${K} of ${M} (${sum})` / `You miss ${t} ${M} times`
  - Suffixes: ` · CRIT`, the felled suffix (middle-dot + "felled"), ` — ${quip}`, ` · ${parts} soaked`
  - Roll fold: `(${roll}+${bonus} vs ${need})` (the `+${bonus}` segment omitted when `bonus` is 0)
  - Spell chain: `${spell} — ${target} frozen solid`, `${spell}: ${T} targets, ${K} hit (${sum})`
- `toastsForAction` is pure, deterministic, never mutates its `events` argument, and contains no `Math.random`/`Date.now`/DOM access anywhere in the file (source-scanned by test).

## Task Commits

Each task was committed atomically:

1. **Task 1: Round aggregators — enemy per-foe/3+ collapse, your multi-attack, kill fold** - `c22e333` (feat)
2. **Task 2: Spell/flee/parley/chest chains, combined encounter-start toast, full pipeline** - `9729a6f` (feat)
3. **Task 3: toastsForAction.test.js — every locked contract, boundary, and probe truth** - `59622dd` (test)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `src/browser/toasts.js` - new: `toastsForAction` (exported) plus `enemyRound`, `yourRound`, `spellChain`, `fleeChain`, `parleyChain`, `chestChain`, `encounterStart`, `killFold`, `dedupeByType`, `sumSoaked` (internal); `spellResisted`'s wording lost its trailing period
- `test/unit/toastsForAction.test.js` - new, 53 tests

## Decisions Made

See `key-decisions` in the frontmatter above (spellResisted's period drop; encounterStart's flag-then-follower ordering as an unlocked implementation choice; killFold as one shared function/literal; spellChain borrowing `spell` from `spellThrown` since the real engine's spellHit/spellMissed carry none of their own).

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed spellChain's spellHit/spellMissed toasts falling back to "It" instead of the spell name**
- **Found during:** Task 3 (writing the Fireball felled-suffix test)
- **Issue:** `engine/magic.js`'s real `spellHit`/`spellMissed` events carry no `spell` field of their own (only the `spellThrown` that starts the chain does) — 25-02's single-event `TOAST_FOR.spellHit`/`spellMissed` builders read `e?.spell`, which is `undefined` for real engine event shapes, producing "It hits Dante (12)" instead of "Fireball hits Dante (12)".
- **Fix:** `spellChain` now spreads `{ ...event, spell: e0.spell }` (borrowing the field from the originating `spellThrown`) before handing the hit/miss event to the existing `TOAST_FOR` builder — no builder logic changed, no new event field added to the engine.
- **Files modified:** `src/browser/toasts.js`
- **Verification:** `test/unit/toastsForAction.test.js#'probe FEED-06 adjacency: Fireball spellHit + foeKilled fold into a felled suffix'` (and the sibling Freeze/Lightning tests) pass with the real (spell-less) event shape.
- **Committed in:** `59622dd` (Task 3 commit)

**2. [Rule 1 - Bug] Fixed spellResisted's exact wording to satisfy this plan's own literal locked-text verify gate**
- **Found during:** Task 2 (running the plan's own `<verify>` one-liner)
- **Issue:** 25-02's `TOAST_FOR.spellResisted` returned "Dante resists Doze." (trailing period), but this plan's Task 2 `<verify>` block requires the exact text "Dante resists Doze" (no period) to exit 0.
- **Fix:** Dropped the trailing period, matching the no-period convention every other locked aggregate format in this plan follows (struckByFoe/foeMissed/struck/etc.). `toastTable.test.js`'s own 25-02 pin uses `.includes(...)`, so this stays backward compatible.
- **Files modified:** `src/browser/toasts.js`
- **Verification:** The plan's Task 2 `<verify>` one-liner exits 0; `node --test test/unit/toastTable.test.js` still green.
- **Committed in:** `9729a6f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bug fixes, both within this plan's own scope and required by its own verify gates)
**Impact on plan:** Both fixes were necessary for this plan's own locked acceptance criteria to pass; no scope creep, no engine file touched.

## Issues Encountered

None beyond the two deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 25-04 can wire the shell's `mzToast` host to `toastsForAction`'s output directly at the single dispatch seam — the pipeline's contract (`[{ text, tone, priority }]`, at most 4, sorted) is exactly what 25-CONTEXT.md's shell-wiring decision expects; the CSS `data-tone` values for `dodge`/`block`/`beat` (and a re-spec of `miss`) still need adding.
- 25-05's standing coverage/manifest/purity guards can be pointed directly at `toastsForAction`'s aggregators — this plan's 53 tests already prove the invariants those guards will assert as one-off tests (dedupe, cap, priority order, the felled/CRIT/soak suffixes, the resist fold, the encounter-start fold).
- The device checklist item "a fight vs a multi-attack foe (X of N)" from 25-CONTEXT.md's Specifics section is now backed by a concrete, tested format string ("Dante hits you 2 of 4 (11)") for 25-04's on-device verification pass to look for.
- No blockers for 25-04/25-05.

---
*Phase: 25-nothing-happens-silently-feature-feedback*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: src/browser/toasts.js
- FOUND: test/unit/toastsForAction.test.js
- FOUND: .planning/phases/25-nothing-happens-silently-feature-feedback/25-03-SUMMARY.md
- FOUND commit: c22e333 (Task 1)
- FOUND commit: 9729a6f (Task 2)
- FOUND commit: 59622dd (Task 3)
