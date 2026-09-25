---
phase: 74-roll-display-modifier-honesty
plan: 04
subsystem: ui
tags: [roll-high, to-hit, flee, combat-menu, hero-sheet, roll-02, roll-03]

# Dependency graph
requires:
  - phase: 74-roll-display-modifier-honesty
    provides: "74-01: engine/derived.js#heroStrikeFacesVs/foeSwingVsHero/targetStrikeFaces; 74-02: src/browser/rollRange.js's facesRangeText/hitRangeText/modsText/ROLLERS"
provides:
  - "src/browser/rollOdds.js — heroHitOdds(state), heroHitOddsVs(state, foe), foeHitOddsVs(state, foe), fleeOdds(c): the ONE module every non-event 'right now' odds reading is computed through, reading only engine/derived.js's derived functions and formatting only through rollRange.js"
  - "The hero sheet's TO HIT stat row and #s-hit DOM write both read heroHitOdds(state).text — the class range on d20 at level 1 (caster 18–20, thief 17–20, fighter 16–20), Afraid included"
  - "The combat menu's STRIKE sub reads 'Hit {range} · {dmg} dmg' from the SAME sheet toHit/damage values, so the two surfaces can never disagree; FLEE's cost/desc read fleeOdds(c).text/.modsText, replacing the old 'd20+5, 14+' net-bonus string"
affects: [74-06, 74-07, 74-08, 77]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A THIRD display-driven module, alongside rollRange.js's formatter and derived.js's odds helpers: rollOdds.js composes the two (engine derived functions -> rollRange.js formatting) so every non-event roll surface reads one module instead of re-deriving its own range/mods logic — 74-06/74-07/Phase 77 are expected to import it directly rather than duplicating a call chain"
    - "fleeOdds(c) converts fleeBreakdown's atLeast-on-a-d20 threshold (need − bonus) into a winning-faces count (dieN + 1 − atLeast) so it can flow through the SAME facesRangeText/hitRangeText conversion every other range in this phase uses — the one arithmetic step in the module, documented as mirroring engine/combat.js#flee's own threshold line"

key-files:
  created:
    - src/browser/rollOdds.js
    - test/unit/rollOdds.test.js
  modified:
    - src/browser/heroTab.js
    - src/browser/combatMenu.js
    - test/unit/characterSheetViewModel.test.js
    - test/unit/shell-gear-39.test.js
    - test/unit/combatMenu.test.js
    - test/unit/shell-worn-slots.test.js
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
    - test/unit/fixtures/shell-snapshots/thief.hero.txt

key-decisions:
  - "heroHitOdds/heroHitOddsVs/foeHitOddsVs/fleeOdds each return the raw faces/atLeast/mods alongside the formatted range/text — so a caller (the combat menu's strike-sub cross-check test) can assert against the engine's own numbers instead of re-parsing a string"
  - "fleeOdds's text carries NO modifier clause (unlike foeHitOddsVs's text, which does) — the combat menu's FLEE row needs the range and the modifier list as two separate strings (cost vs. desc), so fleeOdds exposes range/text and modsText separately rather than one combined hitRangeText(faces, dieN, {mods}) call"
  - "The combat menu's strikeSub copy template ('Hit {range} · {dmg} dmg') is filled by simple string .replace() rather than a shared template-filler, matching this file's own existing ROLL_COPY-less convention (COMBAT_MENU_COPY entries were plain strings before this plan; only ROLL_COPY in rollRange.js uses {signed} substitution)"

requirements-completed: [ROLL-02, ROLL-03]

coverage:
  - id: D1
    description: "src/browser/rollOdds.js: heroHitOdds/heroHitOddsVs/foeHitOddsVs/fleeOdds, each reading only engine/derived.js's derived functions and formatting only through rollRange.js — proven against the level-1 class ranges (18–20/17–20/16–20), Afraid/dazed/level-die reads, a capped/untouchable/dozing target, a foe's Guard/Sidestep/blind/insult/Weaken mods signed from the player's side, and flee's atLeast = need − bonus"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/rollOdds.test.js (11/11 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The hero sheet's TO HIT stat row and #s-hit DOM write both read heroHitOdds(state).text; the 74-CONTEXT specifics pin exactly (level-1 Human Magic User/Thief/Fighter on a Club: 18–20/17–20/16–20 (d20)); only mu.hero.txt and thief.hero.txt snapshots changed, deliberately"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/characterSheetViewModel.test.js test/unit/shell-gear-39.test.js test/unit/shell-tab-snapshots.test.js test/unit/heroTab.test.js (49/49 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The combat menu's STRIKE sub reads 'Hit {range} · {dmg} dmg' from the sheet's own toHit/damage values (proven equal to characterSheetViewModel's toHit for the same state); FLEE's cost/desc read fleeOdds(c) — the module-private fleeModsText formatter and the fleeBreakdown import are removed; PARLEY is unchanged ('d20', no engine-derived parley faces function exists)"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "node --test test/unit/combatMenu.test.js test/unit/rollOdds.test.js (37/37 pass); npm test (5926/5926 pass, 0 failures)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pixel 7 device confirmation: a new level-1 hero's sheet reads the class range on d20 (thieves with a dagger read 16–20); the combat menu's STRIKE reads 'Hit 16–20 (d20) · ...' and FLEE reads a 'N–20 (d20)' range"
    verification: []
    human_judgment: true
    rationale: "Visual/UI confirmation on a physical device, deferred to the milestone's end-of-run UAT batch per the deferred-UAT protocol (project memory) — not independently automatable beyond the unit-level string pins already covered by D1–D3."

# Metrics
duration: ~35min
completed: 2026-09-25
status: complete
---

# Phase 74 Plan 04: Roll Display & Modifier Honesty — The Odds Module, Hero Sheet & Combat Menu Summary

**src/browser/rollOdds.js — the one module every non-event "right now" odds reading is computed through — puts the engine's own roll-high ranges on the hero sheet's TO HIT row and the combat menu's STRIKE/FLEE rows, replacing the Phase 31 low-roll "1–N" reading and the old "d20+5, 14+" flee string.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-25
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- **`src/browser/rollOdds.js`** — `heroHitOdds(state)`, `heroHitOddsVs(state, foe)`, `foeHitOddsVs(state, foe)`, `fleeOdds(c)`. Each is a pure read of engine/derived.js's own derived functions (`toHit`, `afraidNeed`, `strikeDie`, `foeDie`, `fleeBreakdown`, and the 74-01 helpers `heroStrikeFacesVs`/`foeSwingVsHero`), formatted only through rollRange.js's `facesRangeText`/`hitRangeText`/`modsText` (74-02) — never a re-derived formula. The module's header states this rule and names its consumers (74-04/74-06/74-07, Phase 77).
- **`test/unit/rollOdds.test.js`** — 11 tests: the three level-1 class ranges on a Club (Fighter 5 faces "16–20 (d20)", Thief 4 "17–20 (d20)", Magic User 3 "18–20 (d20)"), the live Afraid penalty ("19–20"), a dazed foeEffect ("18–20"), a level-2 strike die ("8–12 (d12)"), a capped/untouchable/dozing target via `heroHitOddsVs`, a foe's Guard/Sidestep/blind/insult/Weaken(penalty) mods via `foeHitOddsVs` — each cross-checked against `foeSwingVsHero`'s own signed deltas and the player-signed `playerDelta` flip — flee's `atLeast = need − bonus` for an unarmoured Fighter (14), a Thief (+5 bonus, atLeast 9), and a Troll-in-Plate (−3 bonus, atLeast 17), a purity/no-mutation check (frozen inputs, deep-equal across two calls), and a source scan for `document.`/`window.`/`Math.random`/`Date.now`.
- **The hero sheet** — `characterSheetViewModel`'s TO HIT row and `renderHeroTab`'s `#s-hit` DOM write both now read `heroHitOdds(state).text`; the `toHit` import is trimmed from heroTab.js's derived.js import (nothing else in the file used it). `characterSheetViewModel.test.js` pins the new value and adds the 74-CONTEXT specifics test (level-1 Human Magic User/Thief/Fighter on a Club: exactly "18–20 (d20)"/"17–20 (d20)"/"16–20 (d20)"). `shell-gear-39.test.js`'s `#s-hit` source pin follows the new read.
- **Snapshot re-pin (deliberate, exactly two fixtures)** — `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js`, then `git status --short test/unit/fixtures/shell-snapshots` confirmed only `mu.hero.txt` and `thief.hero.txt` had real content diffs (six other fixtures showed as `M` in `git status` from the worktree's pre-existing CRLF/LF normalization noise with no actual byte difference — `git diff` on each was empty; those six were `git checkout --`'d back to keep the commit to exactly the two intended files). **Before/after:** `mu.hero.txt` `#s-hit`: `"1–3"` → `"18–20 (d20)"` (level-1 Human Magic User on a Club — classNeed 3). `thief.hero.txt` `#s-hit`: `"1–5"` → `"16–20 (d20)"` (level-1 Human Thief on a Dagger — classNeed 4 + the Dagger's `+1` need modifier = 5 faces, per the plan's own annotation).
- **The combat menu's STRIKE row** — `COMBAT_MENU_COPY.strikeSub` = `"Hit {range} · {dmg} dmg"`, filled from the sheet's own `statValue("toHit")`/`statValue("damage")` — the exact same values `characterSheetViewModel` produces, so the menu and the sheet can never disagree (proven by a new cross-check test).
- **The combat menu's FLEE row** — cost is `fleeOdds(c).text` ("9–20 (d20)"); desc appends `fleeOdds(c).modsText` in parentheses when present ("Thief +5"), exactly matching today's wording shape. The module-private `fleeModsText` formatter and the `fleeBreakdown` import are removed (replaced by the `fleeOdds` import from `./rollOdds.js`). PARLEY is unchanged ("d20") with a one-line comment: no engine-derived parley faces function exists.
- **`combatMenu.test.js`** — the strike-sub regex now matches `"Hit <range> (d<N>) · <lo>–<hi> dmg"`; the flee cost pins become `"14–20 (d20)"` (default Fighter), `"9–20 (d20)"` with the unchanged `"(Thief +5)"` desc (Thief), and `"17–20 (d20)"` (Troll Fighter in Plate); a new test asserts the STRIKE sub's range is byte-identical to `characterSheetViewModel`'s `toHit` value for the same state.
- **`npm test`: 5926/5926 pass, 0 failures** (worktree base was 5925/5926 with 1 pre-existing-to-this-plan failure fixed below).

## Task Commits

Each task was committed atomically:

1. **Task 1: rollOdds.js, the one place non-event odds are computed** - `b8b924d` (feat)
2. **Task 2: The hero sheet reads the strike range** - `90ecdba` (feat)
3. **Task 3: The combat menu's STRIKE and FLEE rows** - `0a70c5a` (feat)

_No plan-metadata commit — this is a parallel worktree plan; the orchestrator handles STATE.md/ROADMAP.md after all wave agents complete._

## Files Created/Modified

- `src/browser/rollOdds.js` — NEW: `heroHitOdds`, `heroHitOddsVs`, `foeHitOddsVs`, `fleeOdds`
- `test/unit/rollOdds.test.js` — NEW: 11-test contract for the module above
- `src/browser/heroTab.js` — TO HIT stat row and `#s-hit` write both read `heroHitOdds(state).text`; `toHit` dropped from the derived.js import; header/doc comments updated
- `src/browser/combatMenu.js` — `strikeSub` copy template + fill; FLEE row reads `fleeOdds(c)`; `fleeModsText`/`fleeBreakdown` removed
- `test/unit/characterSheetViewModel.test.js` — TO HIT pin updated; 74-CONTEXT specifics test added
- `test/unit/shell-gear-39.test.js` — `#s-hit` source pin updated
- `test/unit/combatMenu.test.js` — strike-sub regex, three flee cost pins, one new cross-check test
- `test/unit/shell-worn-slots.test.js` — (deviation, see below) the heroTab.js import-line pin updated
- `test/unit/fixtures/shell-snapshots/mu.hero.txt` / `thief.hero.txt` — re-pinned `#s-hit`

## Decisions Made

- `fleeOdds`'s `text` carries no modifier clause (unlike `foeHitOddsVs`'s `text`) so the combat menu's FLEE row can show the range (cost) and the modifier list (desc) as two independently-placed strings, matching the row's existing two-field shape.
- `heroHitOddsVs`/`foeHitOddsVs`/`fleeOdds` all expose their raw numeric inputs (`faces`/`atLeast`/`mods`) alongside the formatted strings, so a consuming test can assert against the engine's own numbers rather than re-parsing formatted text — used by the new combat-menu cross-check test and by `rollOdds.test.js`'s own equivalence assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/unit/shell-worn-slots.test.js` pinned the pre-Phase-74 heroTab.js import line verbatim**
- **Found during:** Task 3's `npm test` run (post-STRIKE/FLEE edit)
- **Issue:** Dropping `toHit` from heroTab.js's `engine/derived.js` import (Task 2, per the plan's own instruction: "Drop `toHit` from the derived.js import if nothing else in the file uses it") broke an unrelated test outside this plan's `files_modified` list — `shell-worn-slots.test.js`'s "the classic eff(key) duplicate is retired" test asserted a regex matching the OLD import line (`import { strikeDie, toHit, upkeep, ... }`) verbatim.
- **Fix:** Updated the regex to match the new import line (`toHit` removed) with a one-line comment explaining why.
- **Files modified:** test/unit/shell-worn-slots.test.js
- **Verification:** `node --test test/unit/shell-worn-slots.test.js` (14/14 pass); `npm test` (5926/5926 pass, 0 failures)
- **Committed in:** `0a70c5a` (Task 3 commit — the fix landed alongside Task 3's other changes since it surfaced during that task's `npm test` gate)

---

**Total deviations:** 1 auto-fixed (1 bug — a stale test pin outside this plan's declared file list, broken by a plan-directed source change)
**Impact on plan:** Test-only fix; no scope creep, no change to any surface this plan didn't already own.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7 (per the project's deferred-UAT protocol — batched at milestone close, not a per-plan device pause):
- A new level-1 hero's sheet reads the class range on d20 at the TO HIT row (a Fighter reads "16–20 (d20)", a Thief with a dagger reads "16–20 (d20)" [classNeed 4 + Dagger's +1], a Magic User reads "18–20 (d20)").
- The combat menu's STRIKE row reads "Hit 16–20 (d20) · N–M dmg" (matching the hero sheet's own TO HIT value exactly).
- The combat menu's FLEE row reads a "N–20 (d20)" range as its cost, with any modifiers ("Thief +5") in its description.

## Next Phase Readiness

- `src/browser/rollOdds.js` exports `heroHitOdds`/`heroHitOddsVs`/`foeHitOddsVs`/`fleeOdds` — 74-06 (foe details' "right now" odds line) and 74-07 (hero condition-chip effects) can import and call these directly instead of re-deriving anything; Phase 77's CMBUI-13 effect indicators are expected to reuse the same module.
- 74-08's consistency guard test and copy-bank scans have a stable, fully-tested rollOdds.js surface to guard against divergence, alongside 74-02's rollRange.js contract.
- No blockers. No known stubs or deferred items from this plan.

---
*Phase: 74-roll-display-modifier-honesty*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: src/browser/rollOdds.js
- FOUND: test/unit/rollOdds.test.js
- FOUND: src/browser/heroTab.js
- FOUND: src/browser/combatMenu.js
- FOUND: .planning/phases/74-roll-display-modifier-honesty/74-04-SUMMARY.md
- FOUND: b8b924d (Task 1 commit)
- FOUND: 90ecdba (Task 2 commit)
- FOUND: 0a70c5a (Task 3 commit)
