---
phase: 41-terrain-darkness-phobias
plan: 02
subsystem: engine
tags: [terrain, water, move-cost, timers, cadence, key-decision, bot, narration]

# Dependency graph
requires:
  - phase: 41-terrain-darkness-phobias (Plan 01)
    provides: "cell.water on every generated floor (derived-stream placeWater), the structural stripWaterField carve-out, and the live tools/terrain-fixture-scan.mjs measurement (WATER HITS: 0)"
  - phase: 36-balance-foundation-effect-timers-small-independent-wins (Plan 02)
    provides: "engine/effects.js — c.timers[id] = { cadence, left, cd?, phase } and tickSquares(c, n) already accepting n>1, exactly as this plan's step-cost site now feeds it"
provides:
  - "engine/derived.js#WATER_MOVE_COST (2) + moveCost(state, cell) — the pure derived read for a single step's cost"
  - "engine/movement.js#move — the cost-aware step site: const cost = moveCost(state, there); state.steps += cost; a local crossings(n) cadence helper; tickSquares(c, cost) called once; a waded{cost} event fired on genuine entry only"
  - "the affliction cadence, c.darkFor, both Cloak-of-Healing/Regeneration 20-square ticks, the Magic User 20-square spell-charge recovery, and the 100-square newDay all read the same crossings(n)/cost so a 2-cost water step never skips a cadence boundary"
  - "waded entries on all three narration surfaces (src/browser/eventNarration.js, toasts.js, rail.js), voice-scan clean"
  - "test/unit/water-cost.test.js (32 tests) and a new tuning-bot.test.js bot water-pathing proof"
  - "docs/TERRAIN.md ## Water cost — Key Decision (Plan 02), filled"
affects: [41-03-phobia-regions, 41-04-darkness-shell-close, 42-bal-02-consolidated-retune]

tech-stack:
  added: []
  patterns:
    - "a single per-step cost computed ONCE (engine/derived.js#moveCost) and threaded through every squares-cadence read site via a local crossings(n) helper, rather than re-deriving 'did we cross a boundary' at each site independently — crossings(n) is algebraically identical to the old state.steps % n === 0 test at cost 1, so every dry step stays byte-identical"
    - "an affliction's own per-N cadence is ticked via a bounded for-loop over crossings(af.per), reusing the EXISTING tick body unchanged, stopping the instant the body clears the affliction — the general pattern for any future per-square system whose cadence is smaller than a possible step cost"
    - "a narrated event fires on genuine STATE TRANSITION (entering water from dry), never on every qualifying step, mirroring the darknessLifted/afflictionPassed transition-not-poll discipline already established in this codebase"

key-files:
  created:
    - test/unit/water-cost.test.js
  modified:
    - engine/derived.js
    - engine/movement.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - test/unit/tuning-bot.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/TERRAIN.md

key-decisions:
  - "Ratified Key Decision (user, 2026-09-18, CONTEXT Area 1): 'one tap, two squares of time' — a single step onto water advances state.steps by 2 and every per-square system by the same 2 in one dispatch; leaving water costs the normal 1; flight/ether skip the surcharge. Recorded verbatim in docs/TERRAIN.md and this SUMMARY's Key Decisions section for PROJECT.md."
  - "moveCost deliberately does NOT reuse isFlying(state) directly: isFlying treats a READY-but-unstarted Cloak of Flying as flying (so the climb block can start a fresh window on a wall/crevice), but a water step must NOT spend that same ready cloak on a puddle — moveCost checks hasItemNamed(Bracelet)/itemEffectActive(fly)/itemEffectActive(ether) directly and falls through to WATER_MOVE_COST for a ready-but-unstarted cloak, starting no effect record."
  - "[Rule 1 - test-budget correction] the plan's own literal tuning-bot test parameter (playRun(seed, {...BOT_DEFAULTS, maxActions: 600})) was measured, not hand-typed as written: seed 2 is still mid-run at 600 actions (dies naturally to a Werebeast at action 623, never routing-stuck) — 600 would report a false stuck purely from an undersized budget. Corrected to maxActions: 1000 (measured minimum that lets all three seeds complete naturally), documented inline in the test."
  - "The affliction cadence loop's early-stop condition (`i < ticks && c.affliction`) is the general fix for 'a >1-cost step must never tick an already-cleared affliction a second time' — the existing tick body is reused byte-for-byte, only the iteration count and the stop condition are new."

requirements-completed: [TERR-02]

coverage:
  - id: D1
    description: "A single move onto a water cell advances state.steps by exactly 2 (the HUD counter jumps by 2); stepping off water onto dry costs the normal 1"
    requirement: "TERR-02"
    verification:
      - kind: unit
        ref: "test/unit/water-cost.test.js (move: stepping onto water from dry costs 2 / water -> water costs 2 / water -> dry costs 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every squares-based system sees the full cost on that one dispatch (tickSquares(c,2) once; affliction cadence; c.darkFor; both Cloak ticks; the Magic User spell-charge cadence; newDay); a cadence boundary crossed by a +2 step fires exactly once, never skipped"
    requirement: "TERR-02"
    verification:
      - kind: unit
        ref: "test/unit/water-cost.test.js (cadence-crossing 98->100/99->101/97->99, spellChargeRecovered 19->21, cloakHealed 19->21 zero-rng, per:1/per:10 affliction crossing cases, the early-clear-stops-the-loop case, darkFor clamp cases, every c.timers transition shape)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Flying (Bracelet/live Cloak-of-Flying window) and ethereal characters pay 1 on water; a ready-but-unstarted Cloak of Flying is not spent on a puddle"
    requirement: "TERR-02"
    verification:
      - kind: unit
        ref: "test/unit/water-cost.test.js (moveCost + move() exemption tests for Bracelet/live fly/live ether/ready-unstarted-cloak)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A normal (cost-1) step is byte-identical to before this plan; only a MEASURED fixture divergence would be declared — measured zero this plan"
    requirement: "TERR-02"
    verification:
      - kind: unit
        ref: "node --test test/parity/**/*.test.js test/roundtrip/**/*.test.js (60/60 green); tools/terrain-fixture-scan.mjs re-run (WATER HITS: 0); git status --porcelain test/parity/fixtures (empty)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The tuning bot paths across water and never stalls"
    requirement: "TERR-02"
    verification:
      - kind: unit
        ref: "test/unit/tuning-bot.test.js 'Phase 41 (TERR-02): the bot paths across water and never stalls' — dirTowardExit/nearestUnseenDir non-null for seeds 1-20; seeds 1-3 via playRun never stuck, at least one crosses a waded event"
        status: pass
    human_judgment: false
  - id: D6
    description: "Entering water narrates one 'Wading…' line (waded) on all three surfaces, voice-scan clean"
    requirement: "TERR-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/toastsCoverage.test.js test/unit/formatEventsCoverage.test.js test/unit/rail.test.js test/voice/*.test.js (all green, zero uncovered event types, zero voice-scan hits)"
        status: pass
    human_judgment: false
  - id: D7
    description: "HUD Squares jumps by 2 on a water step and by 1 stepping off; the Wading line appears once on entering a pool; a lit torch / MAPPED chip counts down 2 per water step; a day rolls over when a water step crosses square 100 — visually confirmable on a Pixel 7"
    verification: []
    human_judgment: true
    rationale: "mazeworld.html is untouched this plan (the HUD counter already reads S.steps; the shell paint changes are Plan 04's scope) — deferred to the end-of-run Pixel 7 UAT batch per the standing defer-uat-to-end instruction."

duration: 18min
completed: 2026-09-18
status: complete
---

# Phase 41 Plan 02: One Tap, Two Squares of Time — the Water Move Cost Summary

**`moveCost(state, cell)` (1 normal, 2 on water, flight/ether-exempt) is consumed once at the movement step site, and a `crossings(n)` cadence helper threads the same per-step cost through every squares-based system in one dispatch — the affliction cadence, `c.darkFor`, both Cloak ticks, the Magic User spell-charge cadence, and `newDay` — so a 2-cost water step never skips a cadence boundary; `waded` narrates the entry once on all three surfaces; the bot crosses water and never stalls; the movement fixture is measured (not assumed) to be unmoved.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2
- **Files modified:** 9 (1 new, 8 modified)

## Accomplishments

- `engine/derived.js#moveCost(state, cell)` (new export) + `WATER_MOVE_COST = 2` (a TUNING KNOB, citing CONTEXT Area 1) — pure, zero rng: `1` for a null/undefined/dry cell; `1` when the hero carries the Bracelet of Flight, or a LIVE `fly`/`ether` item effect is running; `WATER_MOVE_COST` (2) on water otherwise, including for a READY-but-unstarted Cloak of Flying (deliberately not the same "ready = flying" read `isFlying` uses — a puddle never spends the cloak's charge the way a wall/crevice does).
- `engine/movement.js#move` — the ONE step-cost site: `const cost = moveCost(state, there)` computed once before `f.px = nx`; `state.steps += cost` (not `++`); a local `crossings(n) = Math.floor(state.steps/n) - Math.floor(stepsBefore/n)` cadence helper that is algebraically identical to the old `% n === 0` test at cost 1 (byte-identical dry steps) and fires exactly once on a crossed boundary at cost 2 (never skipped: `99 -> 101` still rolls the day). Every per-square read site now goes through it: the affliction cadence (a bounded loop over `crossings(af.per)`, reusing the existing tick body unchanged, stopping the instant the body clears the affliction), `c.darkFor -= cost` (clamped at 0), both Cloak-of-Healing/Regeneration 20-square ticks, the Magic User 20-square spell-charge recovery, and the 100-square `newDay` roll. `tickSquares(c, cost)` is called exactly once per step (research Pitfall 3 — never twice). A `waded { cost }` event fires ONLY on genuine entry (`cost > 1 && !here.water`) — one line per wade, not per step.
- `test/unit/water-cost.test.js` (new, 32 tests) — every behavior bullet from the plan: `moveCost` pure-function coverage, entry/exit cost and `waded` (dry->water, water->water, water->dry, and all three flight/ether exemptions plus the ready-cloak non-exemption), cadence-crossing proofs (100/20/`af.per`, including the odd-base `99->101` case and the never-reached `97->99` case), the affliction early-clear-stops-the-loop case, `c.darkFor` clamp cases, every `c.timers` transition shape (plain decrement, effect->cooldown flip, effect->deleted, a rounds-cadence record left untouched, `spell:reveal`'s `revealFaded`), and a byte-identical dry-step regression check.
- `waded` narrated on all three surfaces (`src/browser/eventNarration.js`, `toasts.js`, `rail.js`) — "Wading. Everything takes twice as long and smells worse." — voice-scan clean.
- `test/unit/tuning-bot.test.js` gains "Phase 41 (TERR-02): the bot paths across water and never stalls" — `dirTowardExit`/`nearestUnseenDir` non-null for seeds 1-20 (water is a non-feat cell property, invisible to the bot's `.wall`/feat-based BFS routing, so it never special-cases it), and `playRun` for seeds 1-3 never reports `stuck`, with at least one run's events containing a `waded`, proving the bot genuinely crosses water. No `tools/lib/tuning-bot.mjs` edit was needed — water required no avoidance fix.
- `tools/terrain-fixture-scan.mjs` re-run after the cost landed: **`WATER HITS: 0`**, unchanged from Plan 01 — `action-script.movement.json` (seed 256) still never steps onto water. No `action-path` divergence declared; `git status --porcelain test/parity/fixtures` stayed empty throughout.
- `docs/TERRAIN.md` — `## Water cost — Key Decision (Plan 02)` filled: the ratified Key Decision verbatim, the mechanism, the exemption table, the per-square systems table (with the CONTEXT-vs-code correction that "the encounter clock"/"member timers" have no separate per-square counterpart — `newDay`'s wandering check already IS the `crossings(100)` site, and party members carry no squares-cadence state), the measured-zero divergence, and a Phase 42 hunger/depth-drift note.

## Task Commits

1. **Task 1: moveCost derived read + the cost-aware step site (crossings cadence, tickSquares once, darkFor, waded)** - `e69534d` (feat)
2. **Task 2: waded narration, bot water-pathing proof, declared fixture divergence (measured), TERRAIN ledger Key Decision, plan gate** - `127a25e` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `test/unit/water-cost.test.js` — 32 new tests (new file)
- `engine/derived.js` — `WATER_MOVE_COST` + `moveCost(state, cell)`
- `engine/movement.js` — the cost-aware step site (`cost`, `crossings(n)`, `waded`, the affliction loop, `darkFor`, both cloak sites, `tickSquares(c, cost)`, spell-charge/newDay cadences)
- `src/browser/eventNarration.js` — `waded` Oracle line
- `src/browser/toasts.js` — `TOAST_FOR.waded`
- `src/browser/rail.js` — `RAIL_FAMILY.waded`
- `test/unit/tuning-bot.test.js` — the water-pathing proof test
- `test/parity/FIXTURE-INVENTORY.md` — the "Plan 02 — the move cost: measured, zero fixture moves" subsection
- `docs/TERRAIN.md` — the Water cost Key Decision section filled

## Key Decisions (for PROJECT.md)

**"One tap, two squares of time"** (user-ratified Key Decision, 2026-09-18): a single `move` onto a water cell advances `state.steps` by 2 and every per-square system by the same 2 in one dispatch — `tickSquares(c, 2)` (item/spell/ability timers), the affliction cadence, `c.darkFor`, the Magic-User spell-charge cadence, and the once-a-day `newDay` roll all see the full cost through a `crossings(n)` cadence helper that never skips a boundary. Leaving water costs the normal 1. Flying (Bracelet of Flight, a LIVE Cloak-of-Flying window) and ethereal characters skip the surcharge; a READY-but-unstarted Cloak of Flying is deliberately NOT spent on a puddle. Implemented as a single pure derived read (`engine/derived.js#moveCost`) consumed at the ONE step-cost site in `engine/movement.js#move` — no second code path, no run flag (greenfield ruling). This is the second of the two Key Decisions Phase 41 hands to `PROJECT.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's own literal tuning-bot test budget (`maxActions: 600`) was measured, not hand-typed as written**

- **Found during:** Task 2, writing the bot water-pathing test
- **Issue:** The plan's own action text specifies `playRun(seed, { ...BOT_DEFAULTS, maxActions: 600 })` for seeds `[1, 2, 3]`, asserting `stuck === false`. Measured live (`node -e` against `playRun`): seed 2 is still mid-run at exactly 600 actions (it dies naturally to a Werebeast at action 623, never routing-stuck on water or anything else) — using the plan's literal 600 would have reported a FALSE `stuck` purely from an undersized budget, not a real stall, and the test would have failed for the wrong reason (looking like a routing bug when it is not one).
- **Fix:** Measured the actual completion actions for all three seeds at a real 20000-action budget (259 / 623 / 554), then picked `maxActions: 1000` — the smallest round number that lets all three seeds finish naturally (none hits `stuck`) — so the test genuinely proves "never stalls," not "budget generous enough by accident." Documented inline in the test with the measured numbers.
- **Files modified:** `test/unit/tuning-bot.test.js`
- **Verification:** `node --test test/unit/tuning-bot.test.js` — 31/31 green, including the new test; `sawWaded` asserts true (at least one of the three runs crosses a `waded` event within the budget).
- **Committed in:** `127a25e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — the plan's own literal test parameter conflicted with a measured live run).
**Impact on plan:** No scope creep, no architectural change. The fix makes the bot proof measure the real claim ("never stalls on water") instead of an artifact of an undersized action budget.

## Issues Encountered

None beyond the item above (found and fixed inline, verified, part of the green suite before commit).

## User Setup Required

None — no external service configuration required.

## Gate (Task 2, plan's own verification — verification agents are off)

- `npm test`: **2859/2859**, `# fail 0`
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `npm run build:www`: exit 0 (src/browser touched this plan)
- `node tools/terrain-fixture-scan.mjs`: **`WATER HITS: 0`** — unchanged from Plan 01; no `action-path` divergence declared
- `node --test test/parity/**/*.test.js test/roundtrip/**/*.test.js`: 60/60 green
- `git status --porcelain test/parity/fixtures`: empty (zero fixture files touched)
- `git diff --quiet HEAD -- mazeworld.html`: clean — the shell was not touched this plan (the HUD counter already reads `S.steps`; Plan 04 owns every shell paint change)
- `store-listing/`/`tools/store-screenshots/`: untouched throughout (never staged; both remain pre-existing untracked directories this plan never touched)

## Human verification (deferred to end of run)

Per the standing `defer uat to end` instruction, no device steps were taken this plan. A Pixel 7 tester should check, at the end of the run (batched with the other Phase 41 plans):

1. **HUD Squares jumps by 2 on stepping onto a water cell, and by 1 stepping off it** — once Plan 04 paints water on the map, walk onto a blue pool tile and watch the SQUARES counter in the HUD strip; it should advance by 2 for that one tap, then by 1 again for a normal dry step off the pool.
2. **The "Wading…" rail/toast line appears exactly once on entering a pool, not once per square inside it** — step across a multi-tile pool; the line should fire on the first wet tile only, staying silent for every subsequent wet-to-wet step, then silent again on the dry step off.
3. **A lit torch / a MAPPED (Map the Floor) chip counts down 2 squares per water step instead of 1** — with a lit torch or an active Map the Floor window running, cross a water tile and confirm the chip's remaining-squares readout drops by 2 for that one step, not 1.
4. **A day rolls over when a water step crosses square 100** — approach square 99 or 98 with rations available, step onto a water tile that crosses the 100-square boundary, and confirm exactly one "a new day" transition (rest/hunger tick) fires, not zero and not two.
5. **A flying (Bracelet of Flight or an active Cloak-of-Flying window) or ethereal (Cloak of Ether) character's SQUARES counter advances by only 1 stepping onto water** — no "Wading…" line, no double-cost tick, confirming the exemption reads correctly on-device.

## Next Phase Readiness

- TERR-02 is fully landed: the water-cost Key Decision is implemented, tested (32 new unit tests + a bot smoke proof), narrated on every surface, and measured (not assumed) to move zero parity fixtures.
- Plan 03 (phobia regions, `fearArmed`, triggers/narration) and Plan 04 (darkness render filter, water map paint, rail lines, the `docs/TERRAIN.md` ledger close, the whole-phase gate) can proceed independently — neither depends on any new engine surface this plan didn't already expose (`moveCost`/`WATER_MOVE_COST` are the complete new API).
- No blockers. `npm test`: 2859/2859, `# fail 0`. Master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`). Full parity + roundtrip glob green (60/60); `git status --porcelain test/parity/fixtures` empty.

---
*Phase: 41-terrain-darkness-phobias*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `test/unit/water-cost.test.js`, `engine/derived.js`, `engine/movement.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `test/unit/tuning-bot.test.js`, `test/parity/FIXTURE-INVENTORY.md`, `docs/TERRAIN.md` all exist with the expected content (`moveCost`/`WATER_MOVE_COST` present in `engine/derived.js`; `waded` present in all three narration files; "Plan 02" subsections present in `FIXTURE-INVENTORY.md` and `docs/TERRAIN.md`).
Verified in git log: `e69534d`, `127a25e` both present on `master`.
