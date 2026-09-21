---
phase: 52-foe-cadence-damage-curve
plan: 01
subsystem: combat
tags: [combat, cadence, foe-abilities, report-tool, damage-curve, measurement-gate]

# Dependency graph
requires:
  - phase: 51-initiative-once-per-combat
    provides: "the per-round initiative re-roll's removal (the corrected engine this plan pins/measures) and the AFTER class smoke (docs/class-pass/v17-p51-after-smoke.json, commit 608a0e5) this plan's damage-curve audit uses as its band-level yardstick"
provides:
  - "test/unit/foe-cadence.test.js — CAD-01 swing-count pins (plain 1 / sp.atk:2 -> 2 / frenzied 2 / frenzied sp.atk:2 -> 4), CAD-02 Stalka Beast resolver pins (ability turn = foeCast+effect, zero swings; melee turn <= 2 swings, zero foeCast; the impossibility sweep), CAD-03 attacks-per-player-action invariant over real Bat/Rat and China Wolf fights"
  - "content/foe-abilities.js — a comment-only 'an ability turn replaces every swing' note on each of the six foe-ability kit groups"
  - "tools/cadence-audit.mjs + tools/cadence-audit-output.txt — the CAD-03 report tool (committed, deterministic, both INVARIANT lines HOLD)"
  - "tools/damage-curve-audit.mjs + tools/damage-curve-audit-output.txt — the DMG-01 analytic damage-curve audit, BEFORE section (--rule=whole) committed; reads sp.strikesAs so Plan 02's AFTER run needs no tool change"
affects: [52-02, 52-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "attacksPerAction(events) vocabulary (foeMissed + struckByFoe + armorSoaked + memberStruck) implemented independently in both test/unit/foe-cadence.test.js and tools/cadence-audit.mjs — the two files never import each other, so a future drift is caught by a human reading both, documented in both files' own comments"
    - "tools/damage-curve-audit.mjs's row-evaluation is fully analytic: dmgBonus is the MAX of foeDmgBonusFor(T, difficultyCurve(d)) over every floor d in a band with d >= T (exhaustive, no sampling); levelBase reads sp.strikesAs when present else T*T, so Plan 02's Herman fix needs zero tool changes"

key-files:
  created:
    - test/unit/foe-cadence.test.js
    - tools/cadence-audit.mjs
    - tools/cadence-audit-output.txt
    - tools/damage-curve-audit.mjs
    - tools/damage-curve-audit-output.txt
  modified:
    - content/foe-abilities.js

key-decisions:
  - "wouldBeTrim's search order (bonus down to 0, then the sides ladder 12/10/8/6, then n down to 1, floored at 1d6+0) is deterministic and per-row; no row in the current bestiary triggers a bolt-driven flag category (bolt 0 in the BEFORE FLAGGED summary) since every kit's own bolt/drain dice max stays below its row's own melee critMax"
  - "Band hero levels computed from the Phase 51 AFTER smoke: Filter=2 (118 cells), Wall=3 (25 cells), Breakaway/Endgame=5 (0 cells, defaults to the level cap per D-05 — the smoke's deepest p50Depth is 7)"
  - "A row's effective hero level in a band is max(tier, bandLevel) capped at 5 — a tier-4 row met in the Wall band (bandLevel 3) is still evaluated against a level-4 MU/Fighter bar, not level-3, since a tier-4 foe implies a level>=4 hero"

requirements-completed: [CAD-01, CAD-02, CAD-03, DMG-01]

coverage:
  - id: D1
    description: "CAD-01/CAD-02/CAD-03 standing pins in test/unit/foe-cadence.test.js — 10 named tests (4 CAD-01, 4 CAD-02, 2 CAD-03), all passing on the untouched engine"
    requirement: "CAD-01"
    verification:
      - kind: unit
        ref: "test/unit/foe-cadence.test.js (10/10 pass) + test/unit/foe-abilities.test.js + test/determinism/content-is-pure-data.test.js + test/unit/content-tables.test.js (67/67 pass total)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CAD-02 Stalka Beast resolver pins — an ability turn is exactly foeCast+effect with zero swings, a melee turn is <= 2 swings with zero foeCast, and the impossibility sweep (all 12 d6/to-hit combinations) proves the user's pasted two-hits-plus-a-bolt log cannot happen in one foeTurn call"
    requirement: "CAD-02"
    verification:
      - kind: unit
        ref: "test/unit/foe-cadence.test.js — 4 tests named 'CAD-02 (SC2): ...'"
        status: pass
    human_judgment: false
  - id: D3
    description: "CAD-03 attacks-per-player-action invariant, both the unit pin (real startCombat/fight/playerStrike, >= 5 fights sampled each) and the wider tools/cadence-audit.mjs report (40 seeds each, both INVARIANT lines HOLD)"
    requirement: "CAD-03"
    verification:
      - kind: unit
        ref: "test/unit/foe-cadence.test.js — 'CAD-03 (SC3): Bat/Rat ...' and 'CAD-03 (SC3): China Wolf ...'"
        status: pass
      - kind: other
        ref: "node tools/cadence-audit.mjs > tools/cadence-audit-output.txt (re-run diff empty); Bat/Rat sampled 10/40, China Wolf sampled 6/40, both INVARIANT HOLDS"
        status: pass
    human_judgment: false
  - id: D4
    description: "tools/damage-curve-audit.mjs — the DMG-01 analytic BEFORE audit (--rule=whole), committed and reproducible; FLAGGED 116 rows across 209 row×band cells; Herman tier-4 critMax 82 / tier-5 critMax 100 confirmed (the SC4 'Herman 80 on floor 5' anchor)"
    requirement: "DMG-01"
    verification:
      - kind: other
        ref: "node tools/damage-curve-audit.mjs --rule=whole > tools/damage-curve-audit-output.txt (re-run diff empty); grep -c '^## Herman' == 1; Wall/Breakaway/Endgame bands show 'Wall | 4 | 41 | 82' and 'Wall | 5 | 50 | 100'"
        status: pass
    human_judgment: false

# Metrics
duration: ~55min
completed: 2026-09-20
status: complete
---

# Phase 52 Plan 01: Cadence Pins & Audit Tools Summary

**Pinned the CAD-01/02/03 cadence invariants Phase 51 already made true (four swing-count shapes, the Stalka Beast ability-replaces-swings resolver, and the attacks-per-player-action ceiling for Bat/Rat and China Wolf), and built the two Phase 52 measurement tools — `tools/cadence-audit.mjs` and the analytic `tools/damage-curve-audit.mjs` — with their BEFORE-section outputs committed on the untouched engine.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-20
- **Tasks:** 3
- **Files modified:** 6 (1 modified, 5 new)

## Accomplishments

- **CAD-01/CAD-02/CAD-03 pins** (Task 1): `test/unit/foe-cadence.test.js` — 10 named tests. CAD-01 pins the swing-count rule `swings = (frenzied?2:1) * (sp.atk||1)` for all four shapes (plain 1, sp.atk:2 -> 2, frenzied plain -> 2, frenzied sp.atk:2 -> 4). CAD-02 exercises the LIVE Stalka Beast BESTIARY row (found by name, never by index) through the real ability resolver: an ability turn is exactly `foeCast`+its effect event with zero swing events; a melee turn is <= 2 swings with zero `foeCast`; a 12-case impossibility sweep (every d6 1..6 × to-hit {1,20}) proves the user's pasted "two hits + a bolt in one foe turn" log can never happen. CAD-03 drives real `startCombat`/`fight`/`playerStrike` fights (40 seeds, `i*7919+1`) for Bat/Rat (>= 5 sampled) and China Wolf (level 2, >= 5 sampled) at depth 5, asserting every segment's attack count <= 2. A comment-only "an ability turn replaces every swing" note was added above each of the six foe-ability kit groups in `content/foe-abilities.js` (verified comment-only via `tools/comment-only-diff.mjs`).
- **`tools/cadence-audit.mjs`** (Task 2): the CAD-03 report tool — same real-engine fights, wider sample (40 seeds), committed deterministic output. Bat/Rat sampled 10/40 seeds (30 roster misses), max attacks/action 2, mean 0.47; China Wolf sampled 6/40 (34 roster misses), max 2, mean 0.29. Both `INVARIANT attacks per player action <= 2 (sp.atk 2, unfrenzied): HOLDS`.
- **`tools/damage-curve-audit.mjs`** (Task 3): the DMG-01 analytic audit — no rng, exhaustive over every bestiary row × tier × the four depth bands (Filter 1-4, Wall 5-8, Breakaway 9-15, Endgame 16-20). Band hero levels from the Phase 51 AFTER smoke (`docs/class-pass/v17-p51-after-smoke.json`, commit `608a0e5`): Filter=2, Wall=3, Breakaway/Endgame=5 (defaults to the cap — the smoke's deepest p50Depth is 7). BEFORE section (`--rule=whole`, today's rule) committed: **FLAGGED: 116 rows across 209 row×band cells (deep-tier 21, level-base 72, row-dice 23, bolt 0)**, NOTED 0. `## Herman` block confirms the SC4 anchor: `Wall | 4 | 41 | 82` and `Wall | 5 | 50 | 100` (Herman's tier-4 crit reads exactly 82, tier-5 exactly 100, matching the user's "80 on floor 5" report). The tool already reads `sp.strikesAs` (Plan 02 adds this field to Herman), so the AFTER run needs zero tool changes.
- Wave 1 gates: `npm test` — **3361/3361 pass, fail 0**; `npm run build:www` — exit 0 (`[build-www] done`). Engine fence: `git diff --stat 3415b432b191434f16d5b570b65d77c6dc321d36 -- engine/ test/parity/` is empty; `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged). Comment-only-diff: `comment-only: content/foe-abilities.js` / `comment-only-diff 3415b432b191434f16d5b570b65d77c6dc321d36: 1 changed, 0 code-changed`.

## Task Commits

Each task was committed atomically:

1. **Task 1: CAD-01/02/03 pins — test/unit/foe-cadence.test.js + kit notes** - `7edb356` (test)
2. **Task 2: tools/cadence-audit.mjs — CAD-03 report tool, output committed** - `01b9106` (feat)
3. **Task 3: tools/damage-curve-audit.mjs — DMG-01 analytic audit, BEFORE section + Wave 1 gates** - `750170a` (feat)

**Plan metadata:** (this commit) — SUMMARY + STATE + ROADMAP

## Files Created/Modified

- `test/unit/foe-cadence.test.js` (new) — CAD-01/02/03 standing pins (10 tests).
- `content/foe-abilities.js` (modified, comment-only) — six "an ability turn replaces every swing" notes, one per kit group.
- `tools/cadence-audit.mjs` (new) — the CAD-03 report tool (40-seed sample, both creatures).
- `tools/cadence-audit-output.txt` (new) — committed, deterministic output.
- `tools/damage-curve-audit.mjs` (new) — the DMG-01 analytic damage-curve audit (`--rule=whole|dice`, `--smoke=`, `--levels=` override).
- `tools/damage-curve-audit-output.txt` (new) — committed BEFORE section (`--rule=whole`); Plan 02 appends the AFTER section.

## Decisions Made

- Band hero levels for the damage-curve audit are pulled from the Phase 51 AFTER class smoke's median `meanLevel` per band (Filter=2, Wall=3, Breakaway/Endgame=5 by default since no smoke cell reaches those depths yet) — matching `52-CONTEXT.md`'s D-05 yardstick exactly.
- A row's effective hero level in a band is `max(tier, bandLevel)` capped at 5, so a tier-4 row evaluated inside the (lower-level) Wall band is still measured against a level-4 MU/Fighter bar, not the band's own baseline level — this is what makes the Herman tier-4 numbers (41/82) line up with the user's "80 on floor 5" report even though Wall's own baseline hero level is 3.
- `wouldBeTrim`'s search order (bonus to 0, then the 12/10/8/6 sides ladder, then n to 1, floored at 1d6+0) and the `bolt:<id>` / `deep-tier` / `level-base` / `row-dice` category cascade are implemented exactly as specified in 52-01-PLAN.md; no row in the current bestiary trips the `bolt` category (every kit's bolt/drain max stays below that row's own melee critMax), so `bolt 0` in the BEFORE FLAGGED summary is a legitimate, not a missing, count.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 has its DMG-01 BEFORE readout (FLAGGED 116/209, Herman 82/100 confirmed) and can append the `--rule=dice` AFTER section to the same committed output file without any tool change.
- Plan 02's `test/unit/foe-crit-curve.test.js` and the fixture-moving work can proceed against a known-good BEFORE baseline; `tools/damage-curve-audit.mjs` already reads `sp.strikesAs`, so Herman's fix (`sp.strikesAs: 5`) needs no audit-tool edit.
- No blockers. Zero engine/parity bytes changed this plan (`git diff --stat 3415b432b191434f16d5b570b65d77c6dc321d36 -- engine/ test/parity/` empty; master hash unchanged; `content/foe-abilities.js`'s only change is comment-only, verified).

## Human verification (deferred to end of run)

None owed — this plan is measurement and pins only, zero behaviour change to the shipped game. The Phase 55 device checks (≤ 2 foe attacks between player actions vs Bat/Rat/China Wolf at depth 5; a Stalka Beast turn never two hits + a bolt) are already provably true on the untouched engine, per this plan's own tests and audits, and remain owed to the end-of-run Pixel 7 batch per the deferred-UAT protocol.

## Self-Check: PASSED

- FOUND: test/unit/foe-cadence.test.js
- FOUND: content/foe-abilities.js
- FOUND: tools/cadence-audit.mjs
- FOUND: tools/cadence-audit-output.txt
- FOUND: tools/damage-curve-audit.mjs
- FOUND: tools/damage-curve-audit-output.txt
- FOUND: .planning/phases/52-foe-cadence-damage-curve/52-01-SUMMARY.md
- FOUND commit: 7edb356 (Task 1)
- FOUND commit: 01b9106 (Task 2)
- FOUND commit: 750170a (Task 3)
