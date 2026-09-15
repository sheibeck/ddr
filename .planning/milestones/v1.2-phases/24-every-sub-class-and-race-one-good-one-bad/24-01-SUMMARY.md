---
phase: 24-every-sub-class-and-race-one-good-one-bad
plan: 01
subsystem: combat
tags: [engine, combat, identity-pass, sub-classes, zero-draw]

# Dependency graph
requires:
  - phase: 23-casters-can-act
    provides: Wizard strike refusal / Summoner-Illusionist level-1 casting / Freeze payout (untouched by this plan)
provides:
  - "knightFacesBigFoe(state) exported helper (engine/combat.js)"
  - "Knight never-first vs a live maxWP >= 20 foe (rollInitiative)"
  - "Court Mage never-first in round 1 only (rollInitiative); boredom kill widened to d12 <= 2 (1-in-6)"
  - "Guard -1 to be hit (foeToHitVs, engine/derived.js)"
  - "Cloaker free vanish gated on !C.opened2; vanishDenied once seen (flee)"
  - "Master of Arms tracked round-1 withdrawal denied (flee); withdrawalDenied narrated"
  - "Ninja and Master of Arms can never parley (canParley + mazeworld.html classic mirror + parley() direct-dispatch refusal)"
  - "Court Mage can always parley Humans (canParley)"
  - "pickFoeTarget(state, rng, foe) optional third arg — Bard party-play low-wit targeting"
  - "EVENT_NARRATION entries: withdrawalDenied, vanishDenied, parleyRefused reasons ninja/masterOfArms, encounterStarted knightBigFoe/courtMageTalksFirst clauses"
affects: [24-02, 24-03, 24-04, 24-05, 24-06, 24-07, docs/CLASS-PASS.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-draw never-first initiative override (samuraiNeverFirst structure reused for Knight-vs-big-foe and Court Mage round-1)"
    - "Sub-class gate wins over fluency in canParley's decision order (Ninja/Master of Arms checked before Walking Dead/Magical/TALKATIVE)"
    - "Optional trailing argument added to a shared helper (pickFoeTarget's `foe`) so only one call site opts into new behavior, the other (foeAbilities.js) stays untouched"

key-files:
  created:
    - test/unit/identity-combat.test.js
  modified:
    - engine/combat.js
    - engine/derived.js
    - mazeworld.html
    - src/browser/eventNarration.js
    - test/unit/combat.test.js
    - test/unit/item-wiring.test.js
    - test/unit/parley-button-mirror.test.js

key-decisions:
  - "Court Mage boredom's exact draw sequence was measured with a permissive looseRng (fallback value after the pinned prefix) rather than hand-computing every downstream killFoe/foeTurn draw — the test's claim is scoped to the d12 <= 2 boundary, not the full content-driven tail."
  - "Bard party-play reinterpretation: an intel<=3 foe targets the Bard hero OUTRIGHT (not a biased re-roll) when pickFoeTarget's existing (n+1)-sided draw is still consumed — the only symmetric zero-draw design, per the plan's Claude's Discretion note."
  - "Two pre-existing unit tests (combat.test.js's 'critical ignores the soak' D-07 test, item-wiring.test.js's Cloak of Strength crit-suppression test) incidentally used a Knight vs a maxWP>=20/maxWP:100 foe — collateral of the file's own defaults, unrelated to what either test actually proves. Dropped both foes to maxWP 19 rather than touch the new Knight rule."

requirements-completed: [IDENT-05, IDENT-06, IDENT-07, FID-07]

coverage:
  - id: D1
    description: "Knight never wins initiative while any live foe has maxWP >= 20; a foreseen Knight still goes first"
    requirement: "IDENT-05"
    verification:
      - kind: unit
        ref: "test/unit/identity-combat.test.js#rollInitiative: a Knight never wins vs a live maxWP >= 20 foe, unless foreseen"
        status: pass
      - kind: unit
        ref: "test/unit/identity-combat.test.js#knightFacesBigFoe: true only for a Knight with a live maxWP >= 20 foe"
        status: pass
    human_judgment: false
  - id: D2
    description: "Court Mage's foes act first in round one only; boredom kill fires on d12 <= 2 (1-in-6); Court Mage can always parley Humans"
    requirement: "IDENT-05, IDENT-06"
    verification:
      - kind: unit
        ref: "test/unit/identity-combat.test.js#rollInitiative: a Court Mage's foes act first in round one only, unless foreseen"
        status: pass
      - kind: unit
        ref: "test/unit/identity-combat.test.js#startCombat: a Court Mage's boredom kill fires on d12 in {1,2} and nothing else"
        status: pass
      - kind: unit
        ref: "test/unit/identity-combat.test.js#canParley: a Court Mage can parley Humans at fluency 0, but not Beasts or Walking Dead"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ninja and Master of Arms can never parley, for any encounter type at any fluency, in both the engine and the mazeworld.html classic mirror"
    requirement: "IDENT-05"
    verification:
      - kind: unit
        ref: "test/unit/parley-button-mirror.test.js#D-17: the classic canParley() agrees with engine/combat.js#canParley on all 1008 matrix cases"
        status: pass
      - kind: unit
        ref: "test/unit/identity-combat.test.js#parley: a Ninja's direct parley narrates a refusal, spends no attempt, draws no rng"
        status: pass
      - kind: unit
        ref: "test/unit/identity-combat.test.js#parley: a Master of Arms' direct parley narrates a refusal, spends no attempt, draws no rng"
        status: pass
    human_judgment: false
  - id: D4
    description: "Guard needs one better to be hit (foeToHitVs -1), stacking with Agility, floored/overridden the same as before"
    requirement: "IDENT-06"
    verification:
      - kind: unit
        ref: "test/unit/identity-combat.test.js#foeToHitVs: a Guard needs one better, stacking with Agility, never beating a hard override"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cloaker's free vanish only works before the first landed blow (!C.opened2); once seen, vanishDenied and the ordinary Thief roll"
    requirement: "IDENT-07"
    verification:
      - kind: unit
        ref: "test/unit/identity-combat.test.js#flee: a Cloaker who has already struck (opened2) is denied the free vanish and escapes on the ordinary roll"
        status: pass
    human_judgment: false
  - id: D6
    description: "Master of Arms gets no clean tracked round-1 withdrawal (withdrawalDenied); every other Fighter's clean exit is untouched"
    requirement: "IDENT-05"
    verification:
      - kind: unit
        ref: "test/unit/identity-combat.test.js#flee: a Master of Arms gets no clean tracked round-1 withdrawal — narrated, then the ordinary roll"
        status: pass
      - kind: unit
        ref: "test/unit/identity-combat.test.js#flee: every other Fighter's tracked round-1 clean exit stays byte-identical"
        status: pass
    human_judgment: false
  - id: D7
    description: "In party play, an intel<=3 foe always targets a Bard hero; the existing pool draw is still consumed"
    requirement: "IDENT-05"
    verification:
      - kind: unit
        ref: "test/unit/identity-combat.test.js#pickFoeTarget: an intel<=3 foe always targets a Bard hero when a live party stands by"
        status: pass
    human_judgment: false
  - id: D8
    description: "Every new event type/reason/flag is narrated (coverage guard + voice scan green); npm test and parity stay fully green with zero parity file changes"
    requirement: "FID-07"
    verification:
      - kind: unit
        ref: "test/unit/formatEventsCoverage.test.js#formatEvents narrates every engine-emitted event type"
        status: pass
      - kind: unit
        ref: "test/voice/safety-scan.test.js"
        status: pass
      - kind: other
        ref: "npm test (1056/1056, # fail 0)"
        status: pass
      - kind: other
        ref: "node --test \"test/parity/**/*.test.js\" (32/32); git status --porcelain test/parity empty"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-09-14
status: complete
---

# Phase 24 Plan 01: Combat-Side Sub-Class Identity Pass Summary

**Knight/Court Mage never-first initiative bads, Court Mage 1-in-6 boredom + Humans parley good, Ninja/Master-of-Arms permanent parley refusal (engine + mazeworld.html classic mirror), Master of Arms' denied clean tracked withdrawal, Guard's -1 to be hit, Cloaker's real "vanish only while unseen" bad, and a Bard's low-wit party targeting — all zero-draw, all narrated.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 7 (1 new test file, 6 modified)

## Accomplishments

- `knightFacesBigFoe(state)` exported from `engine/combat.js`; `rollInitiative` now never lets a Knight win initiative while any live foe has `maxWP >= 20`, and never lets a Court Mage win initiative in round 1 — both zero-draw overrides of an already-drawn roll, both switched off by foresight.
- Court Mage's boredom kill widened from `rng.d(12) === 1` to `rng.d(12) <= 2` (same single draw, now 1-in-6 instead of 1-in-12).
- `foeToHitVs` (engine/derived.js) subtracts 1 for a Guard, stacking with Agility, still floored at 1 and still losing to the dark/mirror/invisible overrides.
- `flee`'s Cloaker free-vanish branch now gates on `!C.opened2`; once the Cloaker has landed a blow this fight, it narrates `vanishDenied` and falls through to the ordinary d20+5-vs-11 Thief roll. The tracked-round-1 clean-exit branch now special-cases Master of Arms: `withdrawalDenied` is narrated and they fall through to the same ordinary roll; every other Fighter's clean exit is byte-identical.
- `canParley` gains two lines in lockstep with mazeworld.html's classic (non-module) `canParley()`: a Ninja or Master of Arms is refused for every encounter type at any fluency (the sub gate wins over the fluency ladder), and a Court Mage can always parley Humans. `parley()`'s direct-dispatch path narrates `parleyRefused` with reason `ninja`/`masterOfArms` before `C.parleyTried` is set (a refusal never spends the one attempt).
- `pickFoeTarget` gained an optional third `foe` argument; foeTurn's melee swing passes it, and when the foe's `intel <= 3` and the hero is a Bard, the swing targets the Bard outright instead of the normal pool draw — the draw is still consumed. `engine/foeAbilities.js`'s bolt/drain call stays two-argument, unchanged.
- `src/browser/eventNarration.js` gained `withdrawalDenied`/`vanishDenied` builders, two new `parleyRefused` reasons, and two additive `encounterStarted` narration clauses.

## Task Commits

Each task was committed atomically:

1. **Task 1: Initiative (Knight big-foe, Court Mage round 1), boredom 1-in-6, Guard -1, Cloaker gate, Master of Arms withdrawal, Bard party targeting** - `d28c3ed` (feat)
2. **Task 2: canParley gates (Ninja, Master of Arms false; Court Mage vs Humans true) + parley() refusals + the mazeworld.html classic mirror in lockstep** - `a6da888` (feat)
3. **Task 3: EVENT_NARRATION entries for the new events, reasons and flags; coverage guard + voice scan + full suite green** - `b2378ec` (feat)
4. **Test hardening: split Cloaker/MoA flee cases, add encounterStarted flag coverage** - `6036ae6` (test) — raises identity-combat.test.js from 13 to 17 tests to comfortably clear the plan's `>= 15` verification bar.

**Plan metadata:** (pending — final commit below)

## Files Created/Modified

- `engine/combat.js` - `knightFacesBigFoe` export; `rollInitiative` never-first extension; boredom `<= 2`; `encounterStarted` flags; `flee`'s Cloaker gate + `vanishDenied` + Master of Arms `withdrawalDenied`; `canParley` Ninja/MoA/Court Mage lines; `parley()` direct-refusal guards; `pickFoeTarget` optional `foe` arg + Bard clause; foeTurn's call site updated
- `engine/derived.js` - `foeToHitVs` Guard `-1`
- `mazeworld.html` - classic `canParley()` mirror carries the same two new lines
- `src/browser/eventNarration.js` - `withdrawalDenied`, `vanishDenied` builders; extended `parleyRefused`/`encounterStarted`
- `test/unit/identity-combat.test.js` - new, 17 tests covering every mechanic in this plan
- `test/unit/parley-button-mirror.test.js` - matrix widened to 1008 cases (7 subs); new Ninja/MoA/Court Mage cross-checks + source pins
- `test/unit/combat.test.js`, `test/unit/item-wiring.test.js` - collision-avoidance fixture tweaks (see Deviations)

## Decisions Made

- Court Mage boredom's exact draw sequence measured with a permissive `looseRng` (pinned prefix through the d12 draw, safe fallback afterward) rather than hand-verifying every downstream `killFoe`/`foeTurn` draw against real BESTIARY content — keeps the test's claim scoped and robust to unrelated content changes.
- Bard party-play targeting: an intel<=3 foe targets the Bard hero outright (not a biased re-roll of the existing draw) — the only symmetric zero-draw design per the plan's discretion note; documented in `pickFoeTarget`'s JSDoc.
- `knightBigFoe`/`courtMageTalksFirst` added to `encounterStarted` as additive fields (no test pinned the event's exact key set, confirmed by grep before relying on it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Collision] Two pre-existing unit tests incidentally tripped the new Knight rule**
- **Found during:** Task 1 (full-suite verification pass)
- **Issue:** `test/unit/combat.test.js`'s "a critical ignores the soak (D-07)" test and `test/unit/item-wiring.test.js`'s "Cloak of Strength suppresses the player's own critical" test both used a Knight-sub character against a foe with `maxWP` at/above 20 (20 and 100 respectively) — incidental to what either test actually proves (soak-bypass-on-crit, crit-suppression-by-item). With the new Knight-vs-big-foe never-first rule, `afterPlayerAction`'s "fresh initiative" roll now always resolves to `"foe"` for these fixtures, triggering an extra `foeTurn` call that starved both tests' fixed rng sequences (`fakeRng: sequence exhausted`).
- **Fix:** Dropped both foes' `maxWP` to 19 (below the new threshold, unrelated to either test's actual assertions) and updated the one wp-remaining assertion in combat.test.js (10 → 9) that depended on the foe's starting hp.
- **Files modified:** `test/unit/combat.test.js`, `test/unit/item-wiring.test.js`
- **Verification:** `npm test` — 1056/1056, `# fail 0`
- **Committed in:** `d28c3ed` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 collision/bug)
**Impact on plan:** Necessary to keep the full suite green after landing the Knight identity rule; zero scope creep, both fixture edits are minimal and documented inline with a Phase 24 comment.

## Issues Encountered

None beyond the collision above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The four remaining combat-touching sub-classes/mechanics not in this plan's scope (Pickpocket, Cutthroat, Woodsman armor gate, Pilfer item gate) and the three race changes (Dwarven armor wear, Wilmsry joiner refusal, Fridgian frenzy/hide) land in later 24-0N plans per the phase's wave plan.
- `docs/CLASS-PASS.md`'s Rulings section (dagger ruling + this plan's design decisions) is owned by a later plan in this phase, not this one.
- No blockers for 24-02 onward; `engine/combat.js` and `engine/derived.js` are in a clean, fully-tested state with zero new serialized fields and zero parity drift.

---
*Phase: 24-every-sub-class-and-race-one-good-one-bad*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: test/unit/identity-combat.test.js
- FOUND: .planning/phases/24-every-sub-class-and-race-one-good-one-bad/24-01-SUMMARY.md
- FOUND commit: d28c3ed (Task 1)
- FOUND commit: a6da888 (Task 2)
- FOUND commit: b2378ec (Task 3)
- FOUND commit: 6036ae6 (test hardening)
