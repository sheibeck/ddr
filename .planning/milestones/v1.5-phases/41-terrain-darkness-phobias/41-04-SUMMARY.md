---
phase: 41-terrain-darkness-phobias
plan: 04
subsystem: ui
tags: [shell, darkness-filter, render-filter, map-paint, water-tint, condition-chip, hold-inspect, docs-ledger, phase-close, deferred-uat]

# Dependency graph
requires:
  - phase: 41-terrain-darkness-phobias (Plan 01)
    provides: "cell.water on every generated floor; the derived-stream placement (TERR-01)"
  - phase: 41-terrain-darkness-phobias (Plan 02)
    provides: "moveCost(state, cell)/WATER_MOVE_COST (TERR-02); waded narration"
  - phase: 41-terrain-darkness-phobias (Plan 03)
    provides: "c.fearArmed / c.phobiaState (TERR-04/05); the fearArmed chip's DATA shape from conditionsOf"
  - phase: 40-spell-rework plan 05
    provides: "the draw() fill-line pin, the CONDITION_COPY/TONE/EXPLAIN table pattern, the shell-plan phase-close precedent (40-05-SUMMARY.md's aggregated-checklist format)"
provides:
  - "engine/derived.js#DARK_VIEW_RADIUS, #mapViewRadius(state), #inViewWindow(state, x, y) — the pure TERR-03 render-filter reads"
  - "src/browser/mapMarks.js#MAP_PALETTE.water / .waterDark"
  - "src/browser/rail.js#RAIL_COPY.water; src/browser/tapStep.js#inspectCell's water branch"
  - "mazeworld.html: window.__mzMapView bridge, draw()'s visible() render filter + water paint override, CONDITION_COPY/TONE/EXPLAIN.fearArmed (the Rattled chip)"
  - "test/unit/darkness-filter.test.js (new, 13 tests); test/unit/shell-terrain-41.test.js (new, 8 tests)"
  - "docs/TERRAIN.md closed (Darkness filter/map paint/UI + Requirements map + Out of scope/next — no placeholders remain)"
  - ".planning/REQUIREMENTS.md: TERR-01..05 marked complete — Phase 41 fully closed"
affects: ["42 (bot tactics around water/fear; the AFTER matrix re-measurement against v1.5 BEFORE)", "milestone-close UAT batch"]

tech-stack:
  added: []
  patterns:
    - "a render-time-only filter (mapViewRadius/inViewWindow) re-read fresh on every draw() paint, never a stored flag — the SAME 'never cache a derived read across paints' discipline every prior conditionsOf/eff bridge in this codebase already follows"
    - "an OVERRIDE fill line placed immediately AFTER an existing pinned fill line, never a rewrite of it — mirrors Phase 40's own floorSpell-over-dark precedent exactly, so a source-pin test can assert both the untouched original AND the new override in one pass"
    - "a flat (no-count) CONDITION_COPY chip row reusing the generic detail branch with zero new control flow — the foresight/Forewarned precedent, now also fearArmed/Rattled"

key-files:
  created:
    - test/unit/darkness-filter.test.js
    - test/unit/shell-terrain-41.test.js
  modified:
    - engine/derived.js
    - src/browser/mapMarks.js
    - src/browser/rail.js
    - src/browser/tapStep.js
    - mazeworld.html
    - test/unit/mapMarks.test.js
    - test/unit/tapStep.test.js
    - test/unit/rail.test.js
    - test/unit/shell-gear-39.test.js
    - test/unit/shell-worn-slots.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/TERRAIN.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "TERR-03's waiver set is deliberately the SAME set revealRadius (Night Vision) and engine/movement.js's darkFor-dispel check (eff(c, \"light\") > 0) already use, plus itemEffectActive(c, \"lit\") for a lit torch — 'a light effect' means one thing everywhere in this codebase, not a fourth independent definition."
  - "mapViewRadius/inViewWindow are PURE derived reads with zero new serialized field — TERR-03 needed no parity carve-out, no tolerant-load helper, and no fixture declaration, because nothing new is ever written to state."
  - "[Rule 1 - documentation convention] test/parity/FIXTURE-INVENTORY.md's own '### Plan 04' heading collides with Phase 40's pre-existing '### Plan 04 — spellSeen provenance flag' section (landed two phases earlier) — the SAME collision pattern already documented as a Plan 03 deviation in this same phase (its own '### Plan 03' heading collided with a Phase 40 section). Implemented per the file's own established per-phase numbering convention (grep count 2, not the plan's literal expectation of 1) rather than renaming the heading to dodge a miscounted acceptance check."
  - "[Rule 1 - bug] Task 2's legitimate extension of the shared engine/derived.js import line (adding mapViewRadius, inViewWindow) broke two PRE-EXISTING tests (shell-gear-39.test.js, shell-worn-slots.test.js) that hardcoded the OLD exact import-line literal. Fixed both pins to the new nine-name import line rather than reverting the import (see Deviations)."

requirements-completed: [TERR-01, TERR-02, TERR-03, TERR-04, TERR-05]

coverage:
  - id: D1
    description: "mapViewRadius(state)/inViewWindow(state, x, y) — the pure 3x3 darkness render-filter reads: Infinity unless inDark(state) and no waiver (Night Vision / a live Amulet of Light / a lit torch), else DARK_VIEW_RADIUS (1); the window hides even previously-seen cells and restores instantly on leaving, since nothing was ever stored"
    requirement: "TERR-03"
    verification:
      - kind: unit
        ref: "test/unit/darkness-filter.test.js (13 tests: all waivers, the persistent-darkFor-on-a-lit-tile case, the exact 3x3 boundary, mutation-free proof, the leaving-restores-Infinity proof)"
        status: pass
    human_judgment: false
  - id: D2
    description: "draw() consumes the filter via window.__mzMapView at both the floor-fill and feature-icon continue sites, fails open on a missing bridge, and the Phase 40 spellSeen/dark fill-line pin stays byte-identical with the water paint as an override line immediately after it"
    requirement: "TERR-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-terrain-41.test.js (import/bridge/visible()-wiring/fill-line-pin/fallback-hex-parity sections)"
        status: pass
    human_judgment: false
  - id: D3
    description: "MAP_PALETTE.water/waterDark (two distinct hexes) and the WATER hold-inspect row (RAIL_COPY.water + tapStep.js#inspectCell's water branch, ordered after feat, before EMPTY CORRIDOR)"
    requirement: "TERR-01"
    verification:
      - kind: unit
        ref: "test/unit/mapMarks.test.js (palette distinctness/frozen pin); test/unit/tapStep.test.js (three inspectCell water cases); test/unit/rail.test.js (RAIL_COPY.water pin + the generic voice scan)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Rattled (fearArmed) condition chip's shell copy — label, warn tone, and a plain-language tap explanation naming the mechanism (the next fight opens Afraid)"
    requirement: "TERR-05"
    verification:
      - kind: unit
        ref: "test/unit/shell-terrain-41.test.js (CONDITION_COPY/TONE/EXPLAIN.fearArmed section, including the voice-safety check on the explanation sentence)"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/TERRAIN.md is closed (zero '(appended by Plan' placeholders remain) with the Darkness filter/map paint/UI section, the Requirements map, and an Out of scope/next section; .planning/REQUIREMENTS.md marks TERR-01..05 complete (checkboxes + traceability table) — Phase 41 fully closed"
    requirement: "TERR-01, TERR-02, TERR-03, TERR-04, TERR-05"
    verification:
      - kind: unit
        ref: "grep -c \"(appended by Plan\" docs/TERRAIN.md (0); grep -cE TERR-0[1-5] checks on REQUIREMENTS.md (5/5/0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The whole-phase gate is green and every number recorded: npm test 2915/2915 (# fail 0); prototype-master.js.txt hash unchanged; npm run build:www exit 0; test/parity/fixtures porcelain empty; fonts.googleapis count 0; floor-gen-rng-pin/chargen-rng-pin green; package.json/lock and docs/class-pass/ unchanged since Phase 40 close"
    requirement: "TERR-01, TERR-02, TERR-03, TERR-04, TERR-05"
    verification:
      - kind: unit
        ref: "npm test; git hash-object test/parity/prototype-master.js.txt; npm run build:www; git status --porcelain test/parity/fixtures; grep -c fonts.googleapis mazeworld.html; node --test test/unit/floor-gen-rng-pin.test.js test/unit/chargen-rng-pin.test.js; git diff --stat on package.json/package-lock.json/docs/class-pass/"
        status: pass
    human_judgment: false
  - id: D7
    description: "The aggregated, plan-grouped, continuously-numbered Pixel 7 checklist (22 items across all 4 plans) exists in this SUMMARY for the milestone-close UAT batch (never executed in this run)"
    verification: []
    human_judgment: true
    rationale: "On-device verification is explicitly deferred to the milestone-close UAT batch per this run's 'defer uat to end' protocol — no device steps, no adb, no APK build in this run."

duration: 25min
completed: 2026-09-18
status: complete
---

# Phase 41 Plan 04: Shell Close + Phase Close Summary

**The 3x3 darkness render filter (mapViewRadius/inViewWindow — a pure, zero-parity-impact read consumed fresh by draw() every paint), the two-shade water map paint plus its hold-inspect card, the Rattled condition chip's shell copy, then the ledger closed, all five TERR requirements marked complete, and the phase's full aggregated Pixel 7 checklist assembled for milestone-close UAT.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 15 (2 new, 13 modified)

## Accomplishments

- `engine/derived.js#DARK_VIEW_RADIUS` (1) + `#mapViewRadius(state)` + `#inViewWindow(state, x, y)` — the pure TERR-03 render filter: `Infinity` unless the player is `inDark(state)` and carries none of the established waivers (Night Vision, a live Amulet of Light `eff(c, "light") > 0`, or a lit torch `itemEffectActive(c, "lit")`), else `DARK_VIEW_RADIUS`. `inViewWindow` is `true` for every cell at `Infinity`, else `true` only inside the 3x3 Chebyshev window around the party — hiding even previously-`seen` cells outside it. Zero new serialized field, zero rng, zero mutation — re-read fresh on every `draw()` paint (never a stored flag), so leaving the dark square restores the full explored view for free.
- `src/browser/mapMarks.js#MAP_PALETTE` gains `water: "#2f5f7a"` / `waterDark: "#1f3a4a"` — two distinct shades, frozen alongside every prior key. `src/browser/rail.js#RAIL_COPY.water` + `src/browser/tapStep.js#inspectCell`'s water branch (after `feat`, before EMPTY CORRIDOR) — a hold on a water tile names it and its cost.
- `mazeworld.html`: `window.__mzMapView = { mapViewRadius, inViewWindow }` (the same read-only bridge pattern as `__mzConditionsOf`); `draw()`'s `visible(x, y)` helper gates both the floor-fill loop and the feature-icon pass, fail-open on a missing bridge; the Phase 40 `spellSeen`/dark fill line stays byte-identical (the `shell-spells-40.test.js` pin still matches) with the water paint as an OVERRIDE line immediately after it; `CONDITION_COPY.fearArmed = { label: "Rattled" }`, `CONDITION_TONE.fearArmed = "warn"`, and a plain-language `CONDITION_EXPLAIN.fearArmed` sentence — the flat, no-count `foresight`/Forewarned precedent, zero new control flow in `paintConditions`.
- `test/unit/darkness-filter.test.js` (new, 13 tests): every `<behavior>` bullet — all three waivers independently, the COOLING-torch non-waiver, the persistent-`darkFor`-on-a-lit-tile case, the exact 3x3 boundary (including previously-`seen` cells one step outside it), a mutation-free proof (`deepStrictEqual` before/after across repeated calls), and the "leaving the dark restores `Infinity`, nothing was ever stored" proof.
- `test/unit/shell-terrain-41.test.js` (new, 8 tests): source pins for the import line, the bridge, both `visible()` wiring sites (with ordering-after-definition asserted), the Phase 40 fill-line pin + water override, the fallback-palette hex parity, the `fearArmed` chip copy/tone/explain (plus a voice-safety check), a dead-code-untouched proof over the shell's legacy classic `move()`/`reveal()` bodies, and a `www/index.html` build-artefact check.
- `docs/TERRAIN.md`'s two Plan 04 placeholders are filled: "Darkness filter, map paint and UI" (the render-filter rule + waiver set, the water palette, the hold-inspect, the Rattled chip, and what stays for the cleanup milestone) and "Requirements map" (TERR-01..05 -> landed-in plan(s) -> proving tests), plus a new "Out of scope / next" section (Phase 42's bot/AFTER-matrix work; the deferred swimming/lava/ice ideas from `41-CONTEXT.md`).
- `.planning/REQUIREMENTS.md`: TERR-01..05 all marked `[x]` complete (checkboxes + traceability table) — Phase 41 is fully closed.
- Whole-phase gate green: `npm test` 2915/2915 (`# fail 0`); `npm run build:www` exit 0; `test/parity/fixtures` porcelain empty; `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); `fonts.googleapis` count 0; `test/unit/floor-gen-rng-pin.test.js`/`test/unit/chargen-rng-pin.test.js` green; `package.json`/`package-lock.json`/`docs/class-pass/` unchanged since Phase 40's close (`6a717a9`); cumulative `6a717a9..HEAD` diff: 15 files across `engine/`, `docs/`, `mazeworld.html`, `src/browser/`, `tools/` — zero new dependencies; `store-listing/`/`tools/store-screenshots/` never staged this phase.

## Task Commits

Each task was committed atomically:

1. **Task 1: mapViewRadius/inViewWindow render-filter reads, water palette, water hold-inspect copy** — `b2af0b8` (feat)
2. **Task 2: mazeworld.html — 3x3 darkness render filter in draw(), water paint, Rattled chip copy** — `2095820` (feat)
3. **Task 3: ledger close (UI + requirements map), REQUIREMENTS.md, whole-phase gate** — `4684ce3` (docs)

**Plan metadata:** (this commit, immediately following; `commit_docs: true` in `.planning/config.json`, so the final metadata commit still fires for `.planning/` docs — the orchestrator owns STATE.md/ROADMAP.md per this run's instructions)

## Files Created/Modified

- `engine/derived.js` — `DARK_VIEW_RADIUS`, `mapViewRadius(state)`, `inViewWindow(state, x, y)`
- `src/browser/mapMarks.js` — `MAP_PALETTE.water`/`.waterDark`
- `src/browser/rail.js` — `RAIL_COPY.water`
- `src/browser/tapStep.js` — `inspectCell`'s water branch
- `mazeworld.html` — `window.__mzMapView` bridge, `draw()`'s `visible()` filter + water override, `CONDITION_COPY`/`CONDITION_TONE`/`CONDITION_EXPLAIN.fearArmed`
- `test/unit/darkness-filter.test.js` (new, 13 tests) — `mapViewRadius`/`inViewWindow` coverage
- `test/unit/shell-terrain-41.test.js` (new, 8 tests) — source pins for every `mazeworld.html` surface above
- `test/unit/mapMarks.test.js`, `test/unit/tapStep.test.js`, `test/unit/rail.test.js` — the Task 1 TDD extensions
- `test/unit/shell-gear-39.test.js`, `test/unit/shell-worn-slots.test.js` — the two brittle import-line pins updated (Rule 1 deviation)
- `test/parity/FIXTURE-INVENTORY.md` — the "Plan 04 — shell close: zero engine-state changes" subsection
- `docs/TERRAIN.md` — "Darkness filter, map paint and UI (Plan 04)" + "Requirements map (Plan 04)" + "Out of scope / next"
- `.planning/REQUIREMENTS.md` — TERR-01..05 marked complete

## Decisions Made

See frontmatter `key-decisions` — the waiver-set reuse (never a fourth independent "light effect" definition), the zero-parity-impact nature of a pure derived read (no carve-out/tolerant-load/fixture declaration needed for TERR-03), the FIXTURE-INVENTORY.md heading-collision convention (mirroring Plan 03's own precedent from two sections earlier), and the two pre-existing brittle import-line test pins fixed to match Task 2's legitimate import extension.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing tests hardcoded the exact OLD engine/derived.js import line and broke when Task 2 legitimately extended it**

- **Found during:** Task 3, running the whole-phase gate's full `npm test`
- **Issue:** `test/unit/shell-gear-39.test.js` and `test/unit/shell-worn-slots.test.js` each assert an exact-literal regex against the shared `import { conditionsOf, canCast, eff, slotFor, WORN_SLOTS, hasTool, toHit, strikeDie } from "./engine/derived.js";` line. Task 2's own plan-mandated edit (extending that SAME import line with `mapViewRadius, inViewWindow`, per the plan's own Action A) made both literals stale — 2 test failures.
- **Fix:** Updated both regex pins to the new nine-name import line (`..., strikeDie, mapViewRadius, inViewWindow } from "./engine/derived.js";`), matching the exact string Task 2 actually shipped. No behavior change — this is a test-pin correction, not a code fix.
- **Files modified:** `test/unit/shell-gear-39.test.js`, `test/unit/shell-worn-slots.test.js`
- **Verification:** `npm test` — 2915/2915, `# fail 0` (both previously-failing tests now pass).
- **Committed in:** `4684ce3` (Task 3 commit, bundled with the whole-phase gate that caught it)

**2. [Rule 1 - documentation convention] `test/parity/FIXTURE-INVENTORY.md`'s own `### Plan 04` heading collides with a pre-existing Phase 40 section of the identical literal heading**

- **Found during:** Task 3, verifying the plan's own literal `grep -c "### Plan 04" test/parity/FIXTURE-INVENTORY.md` acceptance check (expected 1)
- **Issue:** Phase 40's own `### Plan 04 — spellSeen provenance flag: structural carve-out, zero fixture moves` section (landed two phases earlier) already contributes one match to that literal grep; this plan's new `### Plan 04 — shell close: zero engine-state changes` subsection is the SAME literal substring by the file's own established `### Plan NN — ...` per-phase heading convention — the identical collision pattern already documented as a deviation in `41-03-SUMMARY.md` (whose own `### Plan 03` heading collided with a different pre-existing Phase 40 section two sections earlier in the same file). The count is unavoidably 2, not 1 — the plan's own acceptance check did not (and could not, without renumbering every prior phase's headings) account for the cross-phase collision.
- **Fix:** Kept the heading exactly as the file's own established convention dictates (mirroring `### Plan 01`/`### Plan 02`/`### Plan 03` used identically earlier in this same Phase 41 section) rather than renaming it to chase a miscounted literal.
- **Files affected:** `test/parity/FIXTURE-INVENTORY.md` (documentation note only — no functional change)
- **Verification:** `npm test` 2915/2915, `# fail 0`; the file's convention (`grep -c "### Plan 0" test/parity/FIXTURE-INVENTORY.md`) confirmed consistent with every sibling phase section.
- **Committed in:** `4684ce3` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — a legitimate own-plan edit breaking two brittle pre-existing test pins; a pre-existing cross-phase heading-collision convention, identical in kind to Plan 03's own documented instance).
**Impact on plan:** No scope creep, no architectural change, no functional gap. Both fixes make the codebase's own tests/docs consistent with what Task 1/2 actually and correctly shipped.

## Issues Encountered

None beyond the two items above (found and reconciled inline during the whole-phase gate, verified, part of the green suite before the Task 3 commit).

## User Setup Required

None — no external service configuration required.

## Success Criteria Map (ROADMAP SC-1..4, as amended by CONTEXT)

| SC | Text (as amended) | Landed in | Proof |
|----|------|-----------|-------|
| 1 | A blue multi-square water pool is visible on the map; no main-rng draw moved; declared fixtures only | Plan 01 (generation, zero-main-rng proof, "measured zero" fixture declaration) + Plan 04 (the map paint itself, two shades) | `test/unit/terrain.test.js`; `test/unit/floor-gen-rng-pin.test.js`; `test/unit/mapMarks.test.js`; `test/unit/shell-terrain-41.test.js` |
| 2 | Stepping onto water costs 2 squares of time, consistently across every squares-based system (the ratified Key Decision) | Plan 02 | `test/unit/water-cost.test.js`; `test/unit/tuning-bot.test.js` |
| 3 | On a dark square without Night Vision or a light effect, the map shows only the 3x3 around the party; leaving restores the explored view (a render filter — `seen` unchanged) | Plan 04 | `test/unit/darkness-filter.test.js`; `test/unit/shell-terrain-41.test.js` |
| 4 | Every phobia has a real trigger, fires once on fresh region entry, and arms the Phase 31 Afraid penalty for the next fight — never a lost action, the trigger named in the rail | Plan 03 (the region model + arming) + Plan 04 (the Rattled chip's shell copy) | `test/unit/phobia-triggers.test.js`; `test/unit/conditions.test.js`; `test/unit/shell-terrain-41.test.js` |

## For PROJECT.md

Two Key Decisions this phase hands to the orchestrator for `PROJECT.md`'s Key Decisions ledger at phase close (this plan does NOT edit `PROJECT.md` — that is the orchestrator's job), reproduced verbatim from Plans 02/03's own ratified text:

1. **"One tap, two squares of time"** (user-ratified Key Decision, 2026-09-18, `41-CONTEXT.md` Area 1): a single `move` onto a water cell advances `state.steps` by 2 and every per-square system by the same 2 in one dispatch — `tickSquares(c, 2)` (item/spell/ability timers), the affliction cadence, `c.darkFor`, the Magic-User spell-charge cadence, and the once-a-day `newDay` roll all see the full cost through a `crossings(n)` cadence helper that never skips a boundary. Leaving water costs the normal 1. Flying (Bracelet of Flight, a LIVE Cloak-of-Flying window) and ethereal characters skip the surcharge; a READY-but-unstarted Cloak of Flying is deliberately NOT spent on a puddle. Implemented as a single pure derived read (`engine/derived.js#moveCost`) consumed at the ONE step-cost site in `engine/movement.js#move` — no second code path, no run flag (greenfield ruling).

2. **"Arm Afraid for the next fight"** (user-ratified Key Decision, 2026-09-18, `41-CONTEXT.md` Area 3): every terrain phobia (Bodies of water, Darkness, Heights, Being trapped, Death) fires once on a fresh entry into its region, narrates the trigger immediately on the rail, and arms a zero-rng `c.fearArmed` flag that `engine/combat.js#fight`'s existing three-condition Afraid trigger reads as a fourth OR-condition — so the NEXT fight opens genuinely Afraid through the real, existing Phase 31 mechanism (`afraidNeed`/`afraidDamage`), never a lost action. The arm is consumed the instant `fight()` reads it (whether or not Hardiness then shrugs off the effect, and even for a now-stale phobia match), and deliberately survives `endCombat`/`descend` in between. Existing standalone mechanics — the deterministic `heightsPenalty`/`waterPenalty` added to the climb/leap roll, and `trappedPanic`'s flat hp loss on dead-end entry — are completely unchanged and never double-counted, because the arm's eventual payoff lands on a DIFFERENT roll (the next fight's strikes) than the triggering event's own roll. Per the CONTEXT clarification (binding, recorded in `docs/TERRAIN.md`): all five terrain phobias arm Afraid — Being-trapped's flat hp loss is retained, not replaced. Death's threshold is HP at or below 25% of max, in or out of combat, re-arming only after HP climbs back above 50% (the hysteresis band, `DEATH_REARM_FRACTION`).

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device steps were taken this plan (or anywhere in Phase 41). This is the phase's full aggregated Pixel 7 checklist, grouped by plan and numbered continuously, for the milestone-close UAT batch. Items that named a "wait for Plan 04" caveat in their originating plan's own SUMMARY are stated here without that caveat — Plan 04 has now landed. An item covered by more than one plan is listed once, under the earliest plan, with an "(also Plan NN)" note.

### Plan 01

1. A fresh floor shows blue water pools somewhere on the explored map — lit pools paint in a distinct blue, and a pool inside a dark blob paints in a visibly darker shade (also Plan 04).
2. An old save resumes with a waterless floor and no card — load a save created before Phase 41 landed; the current floor should show no water tiles and no popup/toast about the change.
3. The next descent after resuming an old save shows water — once the player descends to a newly generated floor, that floor carries visible water pools.

### Plan 02

4. HUD Squares jumps by 2 on stepping onto a water cell, and by 1 stepping off it — walk onto a blue pool tile and watch the SQUARES counter in the HUD strip; it should advance by 2 for that one tap, then by 1 again for a normal dry step off the pool.
5. The "Wading…" rail/toast line appears exactly once on entering a pool, not once per square inside it — step across a multi-tile pool; the line should fire on the first wet tile only, staying silent for every subsequent wet-to-wet step, then silent again on the dry step off.
6. A lit torch / a MAPPED (Map the Floor) chip counts down 2 squares per water step instead of 1 — with a lit torch or an active Map the Floor window running, cross a water tile and confirm the chip's remaining-squares readout drops by 2 for that one step, not 1.
7. A day rolls over when a water step crosses square 100 — approach square 99 or 98 with rations available, step onto a water tile that crosses the 100-square boundary, and confirm exactly one "a new day" transition (rest/hunger tick) fires, not zero and not two.
8. A flying (Bracelet of Flight or an active Cloak-of-Flying window) or ethereal (Cloak of Ether) character's SQUARES counter advances by only 1 stepping onto water — no "Wading…" line, no double-cost tick, confirming the exemption reads correctly on-device.

### Plan 03

9. A Bodies-of-water hero entering a pool sees "Water. You knew this was coming. Your knees did too." exactly once, stays silent while wading further into the same pool, and sees the line again only after stepping fully out and back in.
10. A Darkness-phobic hero sees "The dark. It was always going to be the dark." on entering an unlit square — once per fresh entry, silent while it stays dark, again on leaving and re-entering.
11. A dead end shows BOTH the existing "Four walls and one door you already used. −N hp." line AND the new "A dead end. The walls lean in a little, just to be sure." line, in that order, for a Being-trapped-phobic hero — the hp loss is unchanged from before this phase.
12. A climb or gorge attempt shows "That is a long way down. Your stomach has already left." BEFORE any climb/leap roll result, for a Heights-phobic hero — a retry of the exact same wall/crevice stays silent; walking away and coming back shows it again.
13. At or below 25% hp, a Death-phobic hero sees "You can hear your own pulse. It sounds unimpressed." once, and not again until hp climbs back above half.
14. The next fight after any of the above opens with the Afraid condition chip AND the phobiaAfraid line reads "... Still rattled from the water/the dark/the drop/the dead end/your own pulse." — this proves the arm actually consumed correctly at fight time.
15. The Rattled chip shows between the trigger moment and that next fight, distinct from the in-fight Afraid chip — its label reads "Rattled", and a tap gives the plain-language explanation "Something out there got to you. The next fight opens Afraid — harder to hit, softer blows — until it passes." (also Plan 04).

### Plan 04

16. A hold on a water tile (not a feature tile) shows the WATER card — title "WATER", line "Two squares a step, and your boots never dry. Wade, or go around."
17. Standing on a dark square without Night Vision, a lit torch, or the Amulet of Light shows only the 3x3 squares around the party on the map — every other explored cell (even ones walked minutes ago) disappears from view.
18. Stepping off the dark square restores the full explored view instantly — nothing needs to be re-walked; the map simply shows everything already `seen` again on the next paint.
19. With a lit torch, Night Vision, or the Amulet of Light active while standing on a dark tile, the full explored map stays visible (no 3x3 clamp) — confirm all three waivers independently.
20. Map the Floor's own reveal window keeps counting down normally while the darkness 3x3 filter is also active on the same square — the two systems are independent; the filter only hides, it never pauses the window's countdown.
21. TalkBack reads the Rattled chip's label and tap explanation, and the WATER hold-inspect card's title and line.
22. A voice spot-check of every new line in real play (the WATER card, the Rattled chip explanation, the darkness window's on-device feel) for the family-friendly deadpan tone, not just the synthetic safety-scan corpus.

## Next Phase Readiness

- Phase 41 is fully closed: all five TERR requirements (TERR-01..05) are complete, `npm test` is green at 2915/2915, and the parity master/fixtures are byte-identical to before the phase.
- Every engine surface (Plans 01-03) and every shell surface (this plan) needed for terrain/darkness/phobias is complete and reusable as-is.
- `docs/TERRAIN.md` is the living reference for the full TERR-01..05 ledger, the pool curve, the water-cost Key Decision, the phobia trigger table, the darkness render filter, and the UI conventions this phase established.
- The 22-item aggregated Pixel 7 checklist above is queued for the milestone-close UAT batch — no device steps or APK build were taken in this phase, per the standing `defer uat to end` protocol.
- Two Key Decisions above are handed to the orchestrator for `PROJECT.md` at phase close.
- Phase 42 (the next tuning pass) inherits: water's 2-square cost (expected to shift the hunger/depth curve — measured there against `docs/class-pass/v15-before*.json`, not retuned here); bot tactics around water/fear (the bot already crosses water and never stalls on a phobia, but no cost-aware routing preference exists yet); the AFTER matrix re-measurement.
- No blockers.

---
*Phase: 41-terrain-darkness-phobias*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `engine/derived.js`, `src/browser/mapMarks.js`, `src/browser/rail.js`, `src/browser/tapStep.js`, `mazeworld.html`, `test/unit/darkness-filter.test.js`, `test/unit/shell-terrain-41.test.js`, `test/unit/mapMarks.test.js`, `test/unit/tapStep.test.js`, `test/unit/rail.test.js`, `test/unit/shell-gear-39.test.js`, `test/unit/shell-worn-slots.test.js`, `test/parity/FIXTURE-INVENTORY.md`, `docs/TERRAIN.md` (no `(appended by Plan` placeholders remain), `.planning/REQUIREMENTS.md` (TERR-01..05 all `[x]`/Complete) all exist with the expected content.
Verified in git log: `b2af0b8`, `2095820`, `4684ce3` all present on `master`.
