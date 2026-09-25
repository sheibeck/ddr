---
phase: 73-engine-roll-high-mirror
plan: 06
subsystem: engine
tags: [dice, roll-high, resistance, magic, oracle, roll-05]

# Dependency graph
requires:
  - phase: 73-01
    provides: "engine/dice.js#rollCheck/atLeastFor/rollFields — the ONE roll-high check helper; the build-failing guard"
  - phase: 73-02
    provides: "The baselines, readout-compare tool, state pins, pre-switch save and the runtime invariant test shell"
  - phase: 73-03
    provides: "src/browser/rollRange.js (rangeText/rollVsText) and docs/ROLL-LEDGER.md's Phase 73 mirror verdicts"
  - phase: 73-05
    provides: "engine/combat.js#allyTurn/memberStrike/allyCast(thrown) on rollCheck; isBestFace flipped to roll === dieN; the ally/thrown Oracle lines"
provides:
  - "engine/derived.js#resistRoll on rollCheck(rng, 20, atLeastFor(intel - 1, 20)) — returns { rolled, resisted, roll, atLeast, dieN }, byte-identical to the old roll < intel reading for every raw draw"
  - "spellResisted/resistFailed (magic.js), heroResisted/heroResistFailed (foeAbilities.js) and allySpellMissed{resisted:true} (combat.js allyCast) all carry the { roll, atLeast, dieN } triple"
  - "magic.js's Apprentice and doubled-summon backfires stay natural-1 mishap gates (unmirrored); spellBackfired/summonBackfired carry roll/atLeast:2/dieN:8"
  - "Every remaining raw draw in engine/magic.js tagged (amount/selection/mishap-on-1); engine/magic.js and engine/derived.js added to the guard's ENFORCED list with live DRAW_INVENTORY counts"
  - "engine/derived.js's JSDoc for toHit, classNeed, weaponNeedMod, afraidNeed, memberToHit, foeToHitVs, foeToHitBreakdown, fleeBreakdown and resistRoll rewritten to the faces/roll-high reading — every function's return value unchanged"
  - "src/browser/eventNarration.js's heroResisted/heroResistFailed/spellResisted/resistFailed/allySpellMissed lines on the roll-high '<roll> vs lo-hi (intel N)' shape via rangeText"
  - "test/parity/roll-high-invariant.test.js's OUTCOME table covers spellResisted/resistFailed/heroResisted/heroResistFailed/allySpellMissed/spellBackfired/summonBackfired; 16 event types total, all 31 replay sites + the bot sweep pass I1-I6 with zero violations"
affects: [73-07, 73-08, 73-09, 73-10, 74, 75.1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resistRoll draws exactly one rollCheck(rng, 20, atLeastFor(intel - 1, 20)) in the same position the old rng.d(20) sat — its boolean outcome is provably identical for every raw draw (new roll = 21 - raw; ok = roll >= atLeast is algebraically raw < intel), so every scripted-rng test's control flow needed zero changes, only the reported roll VALUE needed mirroring (21 - old raw expectation)"
    - "A natural-1 mishap gate (Apprentice/doubled-summon backfire, the vapor kill-save) is drawn on its OWN tagged line via a ternary that preserves the original && short-circuit (`cond ? rng.d(8) : null`), never mirrored — the raw draw IS the reported roll, and the event's atLeast/dieN name the gate (2/8) without touching the draw itself"
    - "Every draw in engine/magic.js now carries a roll:<kind> tag (amount/selection/mishap-on-1) so the guard's shape/tag/inventory rules can enforce the whole file; engine/derived.js needed zero new tags since its resistRoll is now the file's only check, routed entirely through rollCheck"

key-files:
  created: []
  modified:
    - engine/derived.js
    - engine/magic.js
    - engine/foeAbilities.js
    - engine/combat.js
    - src/browser/eventNarration.js
    - test/parity/roll-high-invariant.test.js
    - test/unit/roll-high-guard.test.js
    - test/unit/resist-roll.test.js
    - test/unit/magic.test.js
    - test/unit/foe-abilities.test.js
    - test/unit/spell-mechanics.test.js

key-decisions:
  - "allySpellMissed's OUTCOME row is a bare () => true: the event only ever carries atLeast/roll on its resisted:true form (the target's own resist check succeeding); the resisted:false form (the caster's own to-hit miss) carries no roll fields at all, so I3 never evaluates this row for that form — that outcome is already covered by allyCast's own OUTCOME fn scanning for a following resisted:false allySpellMissed"
  - "spellBackfired/summonBackfired both read OUTCOME () => false: the mishap always fires on the worst face (roll 1, atLeast 2), so the invariant's roll >= atLeast check is always false — 'failure' here means the caster's own safety check failed, not that anything else went wrong"
  - "The backfire d8 draw was restructured from an inline && short-circuit (`c.sub === 'Apprentice' && rng.d(8) === 1`) to a ternary assigned to a named variable on its own line (`const apprenticeBackfireRoll = c.sub === 'Apprentice' ? rng.d(8) : null;`) so the guard's line-based tag parser has exactly one line to tag — draw count and position are unchanged"

requirements-completed: [ROLL-05]

coverage:
  - id: D1
    description: "resistRoll (both directions — foe resisting the hero's spell, hero resisting a foe's ability) reads roll-high through rollCheck with a byte-identical outcome for every possible raw draw; the intel<12 gate and its zero-draw early return are untouched"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/resist-roll.test.js test/unit/rollDirection-checks.test.js test/unit/magic.test.js test/unit/foe-abilities.test.js test/unit/roll-high-state-pins.test.js (124/124 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every resist and backfire event (spellResisted/resistFailed/heroResisted/heroResistFailed/allySpellMissed/spellBackfired/summonBackfired) carries its roll data; engine/magic.js and engine/derived.js are fully enforced by the roll-high guard"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node --test test/unit/roll-high-guard.test.js test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js (156/156 pass); tools/comment-only-diff.mjs confirms every derived.js hunk besides the dice.js import and resistRoll's body is comment-only"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Oracle's resist lines print the roll-high shape; the runtime invariant covers all 7 new event types (16 total); the full parity suite, npm test, and every proof gate hold with zero fixture moves"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: 'node --test "test/parity/**/*.test.js" (52/52 pass, zero fixture moves) && npm test (5751 total, 5744 pass, 7 known worktree-only CRLF failures unrelated to this plan)'
        status: pass
    human_judgment: false

# Metrics
duration: ~55min
completed: 2026-09-25
status: complete
---

# Phase 73 Plan 06: Engine Roll-High Mirror — Resistance and Magic Mishaps Summary

**Converted p.25's intel-based resistance check (both directions — a foe resisting the hero's spell, the hero resisting a foe's ability) to the roll-high `rollCheck` helper, tagged every remaining raw draw in `engine/magic.js`, brought `magic.js` and `derived.js` under the roll-high guard, and moved the Oracle's resist lines to the "roll vs lo–hi (intel N)" shape — all byte-identical outcomes proven by the full parity suite (zero fixture moves), the Phase 72 direction tests, and a runtime invariant now covering 16 converted event types.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-25 (approx)
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- `engine/derived.js#resistRoll` now draws through `rollCheck(rng, 20, atLeastFor(intel - 1, 20))` in the exact position the old `rng.d(20)` sat, returning `{ rolled, resisted, roll, atLeast, dieN }` — algebraically byte-identical to the old `roll < intel` reading for every raw draw (proved: mirrored `roll = 21 - raw`, `atLeast = 22 - intel`, so `roll >= atLeast` ⟺ `raw <= intel - 1` ⟺ `raw < intel`).
- `spellResisted`/`resistFailed` (magic.js), `heroResisted`/`heroResistFailed` (foeAbilities.js) and `allySpellMissed{resisted:true}` (combat.js `allyCast`) all carry the `{ roll, atLeast, dieN }` triple beside their existing fields.
- `engine/magic.js`'s Apprentice and doubled-summon backfires stay exactly on the natural 1 (unmirrored mishap gates): the d8 draw moved to its own line (`cond ? rng.d(8) : null`, preserving the old `&&` short-circuit) tagged `// roll:mishap-on-1`, and `spellBackfired`/`summonBackfired` now carry `roll`, `atLeast: 2`, `dieN: 8`.
- Every remaining raw draw in `engine/magic.js` is tagged (17 `amount`, 2 `selection`, 3 `mishap-on-1`, plus the existing thrown-branch `rollCheck` call); `engine/magic.js` and `engine/derived.js` both joined the roll-high guard's `ENFORCED` list with live `DRAW_INVENTORY` counts — all five guard rules pass for both files.
- `engine/derived.js`'s JSDoc for `toHit`, `classNeed`, `weaponNeedMod`, `afraidNeed`, `memberToHit`, `foeToHitVs`, `foeToHitBreakdown`, `fleeBreakdown` and `resistRoll` (plus the module's top-of-file Afraid tuning-knob comment) was rewritten to the faces/roll-high reading — confirmed comment-only via `tools/comment-only-diff.mjs` (the only code hunks are the `dice.js` import and `resistRoll`'s own body).
- `src/browser/eventNarration.js`'s `heroResisted`/`heroResistFailed`/`spellResisted`/`resistFailed`/`allySpellMissed` lines all print the roll-high `"<roll> vs lo–hi (intel N)"` (or, for `allySpellMissed`/`resistFailed`, `"<roll> vs lo–hi"` with no intel) shape via `rangeText`, replacing the old `"vs intel N"` / bare-roll / `"against its wits"` renderings. `grep -c "vs intel" src/browser/eventNarration.js` is 0.
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME` table gains rows for `spellResisted`/`heroResisted` (success), `resistFailed`/`heroResistFailed` (failure), `allySpellMissed` (success — only its `resisted:true` form ever carries `atLeast`) and `spellBackfired`/`summonBackfired` (failure — the natural-1 mishap). The invariant now validates 16 converted event types across all 31 replay sites plus the bot sweep with zero I1–I6 violations.
- All proof gates hold: the full parity suite (52/52, zero fixture moves), the Phase 72 direction tests/state pins/guard tests green, and `npm test` at 5744/5751 (only the 7 known worktree-only CRLF doc-ledger failures, unrelated to this plan and present before it).

## Task Commits

Each task was committed atomically:

1. **Task 1: resistRoll on rollCheck, the resist events, and the backfire mishaps** - `3fda951` (feat)
2. **Task 2: Tag magic.js, rewrite derived.js's JSDoc, and enforce both files** - `89ad2e5` (feat)
3. **Task 3: The resist Oracle lines, the invariant rows, and the proof gates** - `b49dd6d` (feat)

_No plan-metadata commit — this is a parallel worktree plan; the orchestrator handles STATE.md/ROADMAP.md after all wave agents complete._

## Files Created/Modified

- `engine/derived.js` - `resistRoll` on `rollCheck`; faces-reading JSDoc across nine functions and the top-of-file Afraid comment
- `engine/magic.js` - resist events carry the triple; Apprentice/doubled backfires restructured onto tagged mishap-on-1 lines; every remaining draw tagged
- `engine/foeAbilities.js` - `heroResisted`/`heroResistFailed` carry the triple
- `engine/combat.js` - `allyCast`'s non-thrown `allySpellMissed{resisted:true}` carries the triple
- `src/browser/eventNarration.js` - `heroResisted`/`heroResistFailed`/`spellResisted`/`resistFailed`/`allySpellMissed` on the roll-high line shape
- `test/parity/roll-high-invariant.test.js` - `OUTCOME` rows for the seven newly-converted event types
- `test/unit/roll-high-guard.test.js` - `engine/magic.js`/`engine/derived.js` added to `ENFORCED` with live `DRAW_INVENTORY` rows
- `test/unit/resist-roll.test.js`, `test/unit/magic.test.js`, `test/unit/foe-abilities.test.js`, `test/unit/spell-mechanics.test.js` - mirrored `roll`/`atLeast`/`dieN` expectations per the test-update rule (new roll = 21 − old raw expectation)

## Decisions Made

- `allySpellMissed`'s `OUTCOME` row is a bare `() => true` — the event only ever carries `atLeast`/`roll` on its `resisted:true` form (I3 skips any event lacking `atLeast`), so the row's semantics are unambiguous even though the same event type also fires (with no roll fields) on a caster's own to-hit miss.
- `spellBackfired`/`summonBackfired` both read `OUTCOME () => false`: the mishap always fires on the worst face (`roll: 1, atLeast: 2`), so "failure" in the invariant's sense means the caster's own safety check failed — matching the roll-under `roll >= atLeast` arithmetic exactly.
- The backfire d8 draws were restructured from an inline `&&` short-circuit to a named-variable ternary on its own line so the guard's per-line tag parser has exactly one place to attach `// roll:mishap-on-1` — draw count and consumption order are unchanged.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7:
- A foe's spell against a hero with intel 14 or more reads "**\<roll\>** vs 8–20 (intel 14)" in the Oracle (a resisted `heroResisted`/`heroResistFailed` line).
- A player's spell cast at an intel-12+ foe reads "**\<roll\>** vs 10–20 (intel 12)" (or similar) on a `spellResisted`/`resistFailed` line.
- An Apprentice's or doubled-Summoner's backfire still narrates on roughly one cast in eight, with no roll shown (backfire lines never printed a roll and still don't).

## Next Phase Readiness

- Every check site this plan's `docs/ROLL-LEDGER.md` mirror verdicts call for (rows 35, 36, 38, 39, 46) now reads through `rollCheck` or carries a correct tag; `engine/magic.js` and `engine/derived.js` are both fully enforced by the guard with zero shape/mirror/tag violations.
- `test/parity/roll-high-invariant.test.js`'s `OUTCOME`/`NESTED_CHECKS` now cover 16 event types (the 73-04/73-05 rows plus this plan's seven) — ready for 73-07 (foe swings, hero soak) and 73-08/73-09 (flee, parley, gates, drops, traps, locks, climbs, cures, wake) to extend the remaining families. `COMPLETE` stays `false` until 73-09.
- `docs/ROLL-LEDGER.md`'s "Phase 73 mirror verdicts" table still shows `Status: planned` for every row this plan converted in substance — 73-10 is the plan that flips each site's row to done, unchanged from 73-04/73-05's note.
- No blockers for the sibling wave-2/3 plans — this plan touched only `engine/derived.js#resistRoll`, `engine/magic.js`'s backfire/resist/remaining-draw sites, `engine/foeAbilities.js#heroResist` and `engine/combat.js#allyCast`'s non-thrown branch, leaving every other check site (foe swings vs hero/member, pursuit, flee, parley, traps, locks, climbs, cures, wake) exactly as prior plans left them.
- Phase 75.1's Pilfer fumble and scroll-read roll can build directly on `resistRoll`'s now-established roll-high shape and the `rollCheck`/`atLeastFor` helper.

---
*Phase: 73-engine-roll-high-mirror*
*Completed: 2026-09-25*
