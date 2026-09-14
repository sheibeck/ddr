---
phase: 18-bestiary-rebalance-canon-combat-fixes
plan: 04
subsystem: engine
tags: [engine, magic, items, damage-seam, determinism, parity, node-test]

# Dependency graph
requires:
  - phase: 18-bestiary-rebalance-canon-combat-fixes (18-02)
    provides: "engine/foeDamage.js#damageFoe/multiplierFor seam (multiplier -> halfDmg -> armor-soak -> wp-decrement) and content/damage-multipliers.js, built and tested in isolation, ready for call-site routing"
provides:
  - "engine/magic.js: quake (per foe), volley (per ball), the insane r=2 foe-on-foe blow, and the thrown branch (Fireball/Lightning/Freeze/etc.) all route through damageFoe with typed sources ({ kind: 'spell', school: sp.kind, casterSub: c.sub } for cast spells, { kind: 'foe', crit: false } for the foe-on-foe blow); every existing kill check stays exactly where it was; caster self-damage (c.wp -=) is untouched"
  - "engine/items.js: the fire item effect ('fire' case, Pine Staff) routes through damageFoe as { kind: 'item', crit: false } — physical, soakable by sp.ar, never multiplier-eligible"
  - "8 new behavioral tests (7 in test/unit/magic.test.js, 1 in test/unit/item-wiring.test.js) proving Cleric-vs-Demons / any-spell-vs-Walking-Dead doubling, per-foe Earthquake, halfDmg volley totals, the D-06 zero-draw spell/armor bypass, and the soakable foe-on-foe and item-fire blows"
affects: [18-05, 18-06, 19-foe-abilities-spellcasting-symmetric-int-resistance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Call-site routing through the shared damage seam (engine/foeDamage.js): every caller keeps its own event-push (with dmg fields switched from raw to hit.applied) and its own unchanged kill-check line immediately after the seam call — same pattern 18-03 established for combat.js"

key-files:
  created: []
  modified:
    - engine/magic.js
    - engine/items.js
    - test/unit/magic.test.js
    - test/unit/item-wiring.test.js

key-decisions:
  - "quake's per-foe damageFoe call is fire-and-forget (no captured return value) since the earthquake event intentionally reports the single rolled base, not a per-foe applied amount — matches the plan's locked event-shape decision"
  - "insane r=2's insaneStruckAlly event is now guarded on !hit.soaked — a fully-soaked foe-on-foe blow emits no insaneStruckAlly event at all, only foeArmorSoaked"
  - "thrown's spellHit.dmg field switched from raw dmg to hit.applied; the level multiplier (mult) already in the event is left untouched since it is unrelated to the seam's own CANON-04 multiplier"

requirements-completed: [CANON-01, CANON-03, CANON-04, FID-05]

coverage:
  - id: D1
    description: "magic.js's quake, volley, insane r=2, and thrown branches all route through damageFoe with typed sources; no foe-side direct wp decrement remains in magic.js; kill checks stay at every existing call site"
    requirement: "CANON-04"
    verification:
      - kind: unit
        ref: "test/unit/magic.test.js — Phase 18 section (7 tests: Cleric-vs-Demons, Wizard control, any-spell-vs-Walking-Dead, D-06 zero-draw armor bypass, per-foe Earthquake, halfDmg volley total, Insanity r=2 soak + control)"
        status: pass
      - kind: other
        ref: "acceptance-criteria greps (import counts, decrement removal, seam call signatures, killFoe line counts, earthquake/shrink untouched lines) — all matched"
        status: pass
    human_judgment: false
  - id: D2
    description: "items.js's fire effect (Pine Staff) routes through damageFoe as kind:\"item\" — soakable by sp.ar, never multiplied"
    requirement: "CANON-01"
    verification:
      - kind: unit
        ref: "test/unit/item-wiring.test.js#Pine Staff's fire effect routes through damageFoe: soakable by sp.ar, never multiplied"
        status: pass
    human_judgment: false
  - id: D3
    description: "The seam's armor-soak d20, halfDmg ceil-halving, and the CANON-04 multiplier table apply correctly through every real magic/item call site; a spell never draws the soak d20 (D-06 zero-draw proof)"
    requirement: "FID-05"
    verification:
      - kind: unit
        ref: "test/unit/magic.test.js#a spell never draws the armor soak (D-06); node --test test/unit/magic.test.js test/unit/item-wiring.test.js test/unit/items.test.js (781/781 including 8 new)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The magic-parity fixture and every other parity fixture stay byte-identical — no foe any fixture rolls has ar/halfDmg or a multiplier-matching type against the fixture's caster"
    requirement: "FID-05"
    verification:
      - kind: unit
        ref: "node --test \"test/parity/**/*.test.js\" (30/30 pass); git diff --quiet e01ac46 -- test/parity/fixtures test/parity/harness/comparables.js test/parity/prototype-master.js.txt package.json package-lock.json"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-13
status: complete
---

# Phase 18 Plan 04: Magic.js/Items.js Damage-Seam Routing Summary

**Routed all four remaining `engine/magic.js` damage-to-foe sites (quake, volley, insane r=2 foe-on-foe blow, thrown) and `engine/items.js`'s fire item effect through the 18-02 `damageFoe` seam with typed sources, closing the CANON-04 doubling table's magic-side half and leaving zero direct foe-wp decrements outside the seam in either file.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-13T23:44:00Z (approx, continuing from 18-03's completion)
- **Completed:** 2026-09-13T~00:14Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- Routed `magic.js`'s quake (per foe, inside `liveFoes(state).forEach`), volley (per ball), the insane r=2 foe-on-foe blow, and the thrown branch (Fireball/Lightning/Freeze/every other thrown kind) through `damageFoe` with `{ kind: "spell", school: sp.kind, casterSub: c.sub }` for cast spells and `{ kind: "foe", crit: false }` for the foe-on-foe blow — every existing kill check (`killFoe`) stays exactly where it was; the caster's own `c.wp -=` self-damage lines (Apprentice backfire, Summoner backfire, quake self-damage, the death spell) are all untouched.
- Routed `items.js`'s `"fire"` case (the Pine Staff effect) through `damageFoe` as `{ kind: "item", crit: false }` — physical for armor-soak purposes, never multiplier-eligible.
- Switched `volley.totalDamage`, `spellHit.dmg`, and `insaneStruckAlly.dmg`/`itemBurned.total` to report APPLIED (post-multiplier/halfDmg/soak) damage rather than raw; `earthquake.amount` deliberately stays the single rolled base per the plan's locked event-shape decision, since per-foe applied values are visible on each foe's own wp.
- Guarded `insaneStruckAlly` on `!hit.soaked` — a fully-soaked foe-on-foe blow (the victim's natural armor stops it entirely) now emits only `foeArmorSoaked`, never a follow-on `insaneStruckAlly` with a zero/negative amount.
- Added 7 behavioral tests to `test/unit/magic.test.js` proving: a Cleric's Fireball doubles vs Demons while a Wizard's does not (Cleric-only row), any caster's Fireball doubles vs Walking Dead, a spell never draws the armor-soak d20 even against `sp.ar: 15` (D-06), Earthquake applies its multiplier PER FOE while `earthquake.amount` stays the single rolled base, Fireballs' volley total sums ceil-halved APPLIED damage against a `halfDmg` foe (CANON-03), and Insanity's r=2 foe-on-foe blow is soakable by the victim's own natural armor (with an unarmoured control proving the full-damage/`insaneStruckAlly` path).
- Added 1 behavioral test to `test/unit/item-wiring.test.js` proving the Pine Staff's fire effect is soakable by `sp.ar` (with an unarmoured control).
- Verified zero regression: all pre-existing `magic.test.js`/`item-wiring.test.js`/`items.test.js` tests pass unmodified; the 30-test parity suite is byte-identical; `npm test` is green at 781/781 (773 baseline + 8 new).

## Task Commits

Each task was committed atomically:

1. **Task 1: Route quake / volley / insane r=2 / thrown in magic.js and the fire effect in items.js through damageFoe** - `e06e57d` (feat)
2. **Task 2: Add CANON-04 / CANON-03 / D-06 / A3 behavioral tests for the routed spell and item sites** - `7760a54` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `engine/magic.js` - `damageFoe` import; quake/volley/insane-r=2/thrown routed through the seam; `spellHit.dmg`/`volley.totalDamage`/`insaneStruckAlly.dmg` switched to applied values; `insaneStruckAlly` guarded on `!hit.soaked`. No foe-side direct `wp -=` remains; the four `c.wp -=` caster self-damage lines are untouched.
- `engine/items.js` - `damageFoe` import (extending the existing circular-import comment with a one-sentence note that this edge is acyclic); the `"fire"` case routed through the seam; `itemBurned.total` sums `hit.applied`.
- `test/unit/magic.test.js` - Added a 7-test "Phase 18: damageFoe routing (CANON-04 / CANON-03 / D-06)" section before the purity checks.
- `test/unit/item-wiring.test.js` - Added a "9. Phase 18: fire item routed through damageFoe (CANON-01 A3)" test (renumbering the trailing sellPriceFor section to 10).

## Decisions Made

- quake's per-foe `damageFoe` call captures no return value (unlike volley/thrown/insane) — the earthquake event intentionally reports the single rolled base `d`, not a per-foe applied amount, per the plan's locked event-shape decision; each foe's own post-cast `wp` shows what actually landed.
- `insaneStruckAlly` is now conditional on `!hit.soaked`, matching the plan's must-haves truth that a fully-armor-soaked foe-on-foe blow reports no `insaneStruckAlly` event.
- thrown's `spellHit.dmg` field switched to `hit.applied`; the pre-existing `mult` field (the caster-level area/duration multiplier) is left untouched since it is a distinct concept from the seam's own CANON-04 multiplier.

## Deviations from Plan

### Auto-fixed Issues

None — no code deviations were needed; all four magic.js sites and the items.js fire effect were routed exactly per the plan's locked action text, and every acceptance-criteria grep matched on the first implementation pass.

### Noted Discrepancy (not a defect)

**1. Acceptance criterion #3's expected `c.wp -= ` count (magic.js) is 3 in the plan but the actual pre-existing codebase has 4.**
- **Found during:** Task 1 verification (acceptance-criteria greps)
- **Detail:** The plan's read_first/acceptance section named three caster self-damage sites (quake self-damage, Apprentice backfire, the death spell), but `engine/magic.js` also has a fourth pre-existing `c.wp -= hurt;` line in the Summoner's doubled-summon backfire branch (`sp.kind === "summon"`, line 104 pre-plan / 107 post-plan). Confirmed via `git show HEAD~2:engine/magic.js` (the commit immediately before this plan's Task 1) that all 4 occurrences existed before this plan touched the file — none was added or removed by this plan's edits.
- **Resolution:** No fix needed — none of the four lines is a foe-wp decrement (the substantive intent of the acceptance check, "no untouched foe-side damage sneaking past the seam," holds); this is purely a miscount in the plan's own acceptance-criteria text against a site the plan's read_first section didn't enumerate. Documented here rather than "fixed" since there is nothing in the code to change.
- **Files modified:** none (documentation-only note).
- **Verification:** `grep -n 'c\.wp -= ' engine/magic.js` lists all 4 lines; `git show HEAD:engine/magic.js` (pre-Task-1) shows the same 4.

---

**Total deviations:** 0 code auto-fixes; 1 documented plan-accuracy note (acceptance-criteria undercount, no code impact).
**Impact on plan:** None on scope or behavior — purely a bookkeeping note for 18-06's invariant test author, who should expect 4 (not 3) pre-existing caster-side `c.wp -=` lines in `magic.js`.

## Issues Encountered

None beyond the acceptance-criteria discrepancy documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/magic.js` and `engine/items.js` have zero remaining foe-side direct `wp -=` decrements — both files are fully routed through `engine/foeDamage.js#damageFoe`, alongside `engine/combat.js` (18-03). Every direct wp SET (shrink, petrify, turn, gate, insane r=1/3/6, vapor, freeze's instant-removal) is deliberately untouched per D-09's "excluded from the seam" list.
- `npm test` is green at 781/781 (773 baseline + 7 magic.test.js + 1 item-wiring.test.js); the parity suite (30/30) and all frozen files (`test/parity/fixtures`, `test/parity/harness/comparables.js`, `test/parity/prototype-master.js.txt`, `package.json`, `package-lock.json`) are byte-identical to `e01ac46`.
- `content/bestiary.js` (18-05) and the invariant test (18-06) can now assume ALL foe-damage sources across the entire engine (hero strike, ally/member strike, ward reflect, acid tick, quake, volley, insane foe-on-foe, thrown, item fire) route through the one seam.
- No blockers for 18-05/18-06.

---
*Phase: 18-bestiary-rebalance-canon-combat-fixes*
*Completed: 2026-09-13*

## Self-Check: PASSED

- FOUND: engine/magic.js
- FOUND: engine/items.js
- FOUND: test/unit/magic.test.js
- FOUND: test/unit/item-wiring.test.js
- FOUND commit: e06e57d (Task 1)
- FOUND commit: 7760a54 (Task 2)
