---
phase: 38-melee-active-abilities
plan: 02
subsystem: engine
tags: [engine, passive-deletion, strike-descriptor, need-shift, identity-contract, sc-4, deferred-uat]

# Dependency graph
requires:
  - phase: 38-melee-active-abilities plan 01
    provides: "c.abilities catalog + level pool + chargenDivergence mechanism"
provides:
  - "engine/derived.js: abilityEffectActive(c, key); foeToHitVs/foeToHitBreakdown gain a vs='hero'|'member' param reading Battle Roar/Sidestep/Smoke from c.timers"
  - "engine/combat.js#playerStrike: the transient state.combat.abilityStrike descriptor (autoHit/forceCrit/finishUnder/bonusDmg/dmgMul/needShift/attacks/key), additive via/critBy tags, t.marked +2"
  - "the four dropped-skill reads deleted (Tracking/Language/Climbing/Leaping) with zero replacement"
  - "test/unit/ability-strike.test.js: 25-test descriptor composition + zero-draw + retired-passive-no-op suite"
  - "identity-contract.test.js SC-4 regression guard (RESHAPED_SKILLS) + Guard->Sidestep stacking proof"
  - "docs/ABILITIES.md 'Retired passives (Plan 02)' ledger"
affects: [38-03-melee-dispatcher, 38-04-melee-joiners, 38-05-melee-shell]

tech-stack:
  added: []
  patterns:
    - "Transient action-scoped descriptor (state.combat.abilityStrike) read by an existing action function (playerStrike) rather than a parallel implementation — zero new draws, reuses all existing narration/hooks"
    - "c.timers-driven need-shift terms in a narration-twin pair (foeToHitVs/foeToHitBreakdown) with a vs parameter distinguishing 'the hero's own body' from 'this side, party-wide'"
    - "Declared-divergence discipline extended from parity fixtures to hand-written unit tests: a retired passive's synthetic test plant becomes a documented no-op assertion instead of a deleted test"

key-files:
  created:
    - test/unit/ability-strike.test.js
  modified:
    - engine/derived.js
    - engine/combat.js
    - engine/movement.js
    - engine/encounters.js
    - src/browser/viewModels.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - test/unit/feedback-payload.test.js
    - test/unit/combat.test.js
    - test/unit/fluency.test.js
    - test/unit/parley.test.js
    - test/unit/identity-combat.test.js
    - test/unit/toastsForAction.test.js
    - test/unit/identity-contract.test.js
    - test/unit/parley-button-mirror.test.js
    - test/unit/tuning-bot.test.js
    - docs/ABILITIES.md

key-decisions:
  - "playerStrike's AS = C.abilityStrike || null is taken once right after the !t return; every descriptor field is read as an additive, zero-draw reinterpretation of the roll playerStrike already makes for an ordinary strike — no new rng.d() calls anywhere in the descriptor path"
  - "subAuto (the Cat Burglar/Ninja opener, which claims C.opened) is now structurally separate from auto (subAuto || AS.autoHit) — an ability auto-hit never burns or sets the sub's own free-opener flag, and the Ninja first-strike damage formula reads subAuto specifically so a descriptor's autoHit alone doesn't misfire it"
  - "forceCrit tracks a local heavyBackstabDenied flag so Silent Step's heavy-armor denial pushes exactly one backstabDenied per attack even when the pre-existing opening-strike heavy check already fired one this same attack"
  - "finishUnder (Death Touch) ignores noCrit entirely (the finish always fires under the threshold) while forceCrit still obeys the Guard/Soldier/dark/noCrit-gear rule like a natural 1 — these are deliberately different gates per the plan's strike_descriptor_spec"
  - "fluency(c) now reads eff(c,'tongue') alone; canParley's fluency-2 Magical branch and parley()'s wilmsryVsMagical refusal (which sits behind canParley) are both left in place as unreachable-but-documented code, not deleted, per the plan's explicit prohibition on touching mazeworld.html/combatMenu.js this phase"
  - "Rule 1 fixes beyond this plan's own file list: test/unit/parley-button-mirror.test.js (the classic-vs-engine matrix drops the now-unreachable Language dimension — real chargen never grants Language anymore, so both scripts cap at fluency 1 for every live character) and test/unit/tuning-bot.test.js (D-06's fluency-2 Wilmsry scenario now resolves to flee, not parley) — both were direct, unavoidable fallout of the fluency-ceiling drop and were required to keep npm test at # fail 0"

requirements-completed: [ABIL-02]

coverage:
  - id: D1
    description: "Four dropped skills (Tracking/Language/Climbing/Leaping) have zero executable engine read anywhere; Agility/Silence-in-dark are replaced by Battle Roar/Sidestep/Smoke's abilityEffectActive terms in foeToHitVs/foeToHitBreakdown"
    requirement: "ABIL-02"
    verification:
      - kind: unit
        ref: "test/unit/ability-strike.test.js (retired-passives suite)"
        status: pass
      - kind: unit
        ref: "test/unit/feedback-payload.test.js (need-equality matrix with the three timer records x vs x phase)"
        status: pass
    human_judgment: false
  - id: D2
    description: "playerStrike honours the transient state.combat.abilityStrike descriptor (autoHit/forceCrit/finishUnder/bonusDmg/dmgMul/needShift/attacks), tags struck/strikeMissed/deathTouch with via, clears the descriptor after its own attack loop, zero new draws"
    requirement: "ABIL-02"
    verification:
      - kind: unit
        ref: "test/unit/ability-strike.test.js (25 tests: autoHit, bonusDmg, forceCrit x3, finishUnder x3, needShift x3, attacks x2, transient clear, marked x2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "t.marked +2 on every landed hero strike; foeTurn's member branch reads foeToHitVs/foeToHitBreakdown with vs='member'"
    requirement: "ABIL-02"
    verification:
      - kind: unit
        ref: "test/unit/ability-strike.test.js (marked tests)"
        status: pass
      - kind: unit
        ref: "test/unit/feedback-payload.test.js (Battle Roar applies to both vs values; Sidestep/Smoke apply only to vs='hero')"
        status: pass
    human_judgment: false
  - id: D4
    description: "identity-contract SC-4: Guard's stacking proof moves to Sidestep; every Fighter/Thief sub still has a code-verified good and bad referencing no reshaped skill; docs/CLASS-PASS.md's good/bad table names none of them"
    requirement: "ABIL-02"
    verification:
      - kind: unit
        ref: "test/unit/identity-contract.test.js (SC-4 guard, 72/72)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full suite green with test/parity/fixtures byte-unchanged and the master hash unmoved"
    verification:
      - kind: unit
        ref: "npm test (2442/2442, # fail 0)"
        status: pass
      - kind: unit
        ref: "test/parity/*.test.js (37/37)"
        status: pass
    human_judgment: false

duration: ~75min
completed: 2026-09-17
status: complete
---

# Phase 38 Plan 02: Melee Ability Hooks — Strike Descriptor + Need-Shift Actives Summary

**Deleted every retired passive read (Agility/Death-touch/Kata/Silence/Language/Tracking/Climbing/Leaping) and installed the two seams the dispatcher (Plan 03) will drive: a transient `state.combat.abilityStrike` descriptor `playerStrike` honours per-attack, and three `c.timers`-driven need-shift terms in `foeToHitVs`/`foeToHitBreakdown`.**

## Performance

- **Duration:** ~75 min
- **Tasks:** 3
- **Files modified:** 17 (1 new, 16 modified)

## Accomplishments

- `engine/derived.js`: `abilityEffectActive(c, key)` (reads a live `c.timers["ability:"+key]` "effect"-phase record); `foeToHitVs`/`foeToHitBreakdown` gain a `vs = "hero" | "member"` parameter and read Battle Roar (-2, any vs)/Sidestep (-2, hero only)/Smoke (override to 1, hero only) in place of the deleted Agility and Silence-in-dark lines; the Kata reads deleted from `toHit`/`memberToHit`/`weaponDamage`; `fluency(c)` now sources solely from a tongue-effect item (ceiling 1, not 2).
- `engine/combat.js#playerStrike`: the `state.combat.abilityStrike` descriptor (`{ key, autoHit?, forceCrit?, finishUnder?, bonusDmg?, dmgMul?, needShift?, attacks? }`) replaces the old Death-touch and Silence(-opening-strike) passive branches — every field is an additive, zero-draw reinterpretation of the strike loop's existing roll; `subAuto` (the Cat Burglar/Ninja free opener) is now structurally distinct from `auto` (`subAuto || AS.autoHit`) so an ability auto-hit never touches `C.opened`; `t.marked` adds +2 on every landed hero strike; `foeTurn`'s member branch now calls `foeToHitVs(state, "member")`/`foeToHitBreakdown(state, "member")`.
- `engine/movement.js`/`engine/encounters.js`: the Tracking read deleted from `startCombat` (`tracked` stays dormant machinery); `climbBonus`/`leapBonus` and the climb+leap fall-damage halving deleted; `springTrap`'s dodge formula keeps only the Acrobat bonus.
- `src/browser/viewModels.js`/`eventNarration.js`/`toasts.js`: Kata's flat damage-bracket term deleted; the `silenceStrike` event/crit token retired everywhere (engine, both narration tables, `FEATURE_EVENTS`, the `encounterStarted` fold case); `deathTouch`/`silentStep` crit tokens added to both `CRIT_BY_TEXT` maps.
- `test/unit/ability-strike.test.js` (new, 25 tests): every descriptor field, the zero-extra-draws invariant, `t.marked`'s +2, and the retired-passive no-ops.
- Test surgery across `feedback-payload.test.js`, `combat.test.js`, `fluency.test.js`, `parley.test.js`, `identity-combat.test.js`, `toastsForAction.test.js`, `identity-contract.test.js` reconciled every assertion that planted a now-retired skill or relied on the old fluency-2 ceiling — plus two out-of-plan-scope files (`parley-button-mirror.test.js`, `tuning-bot.test.js`) that broke as direct, unavoidable fallout and needed the same treatment to keep `npm test` at `# fail 0`.
- `docs/ABILITIES.md`: a new "Retired passives (Plan 02)" ledger section — the seven deleted read sites (file#function), the full `abilityStrike` descriptor spec, the three need-shift actives, and the two flagged gameplay changes (fluency ceiling 2→1, climb/leap halving gone for everyone).

## Task Commits

1. **Task 1: playerStrike abilityStrike descriptor + Silence/Death-touch deletion + t.marked + need-shift twins + Kata/Agility/Silence/Language reads deleted — tests first** - `4a5e1c4` (feat)
2. **Task 2: Dropped-skill reads (Tracking/Climbing/Leaping/trap Agility) + trackingRolled removal + test surgery** - `eb2d580` (feat)
3. **Task 3: Identity-contract SC-4 guard + Guard->Sidestep stacking + docs/ABILITIES.md ledger** - `e5b3be5` (test)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `engine/derived.js` — `abilityEffectActive`; vs-aware `foeToHitVs`/`foeToHitBreakdown`; Kata/Agility/Silence/Language reads deleted
- `engine/combat.js` — `abilityStrike` descriptor reads in `playerStrike`, Tracking block deleted, `t.marked` +2, member-branch `vs="member"`, canParley/parley JSDoc updated
- `engine/movement.js` — `climbBonus`/`leapBonus` and the climb/leap fall-halving deleted
- `engine/encounters.js` — `springTrap` dodge without Agility/Leaping terms
- `src/browser/viewModels.js` — Kata line deleted from `damageBracket`
- `src/browser/eventNarration.js`, `src/browser/toasts.js` — `silenceStrike`/`trackingRolled` retired; `deathTouch`/`silentStep` crit tokens added
- `test/unit/ability-strike.test.js` (new) — 25-test descriptor/need-shift/marked/retired-passive suite
- `test/unit/feedback-payload.test.js`, `combat.test.js`, `fluency.test.js`, `parley.test.js`, `identity-combat.test.js`, `toastsForAction.test.js` — test surgery for the retired skills and the fluency ceiling
- `test/unit/identity-contract.test.js` — Guard→Sidestep stacking, SC-4 guard
- `test/unit/parley-button-mirror.test.js`, `test/unit/tuning-bot.test.js` — Rule-1 fixes (unavoidable fallout, not in the plan's own file list)
- `docs/ABILITIES.md` — "Retired passives (Plan 02)" ledger section

## Decisions Made

- `playerStrike`'s `AS = C.abilityStrike || null` is taken once right after the `!t` return; every descriptor field is an additive, zero-draw reinterpretation of the existing roll — measured, not assumed (a dedicated `countingRng` test proves identical draw counts with and without a descriptor).
- `subAuto` (the sub's own free opener) is now structurally separate from `auto` (`subAuto || AS.autoHit`); the Ninja first-strike damage formula reads `subAuto` specifically so a bare `autoHit` descriptor never misfires it, and an ability auto-hit never sets/burns `C.opened`.
- `forceCrit` tracks a local `heavyBackstabDenied` flag so Silent Step's heavy-armor crit denial pushes exactly one `backstabDenied` per attack even when the pre-existing opening-strike heavy check already fired one.
- `finishUnder` (Death Touch) ignores `noCrit` entirely (always finishes under the threshold); `forceCrit` still obeys the Guard/Soldier/dark/noCrit-gear rule like a natural 1 — deliberately different gates, per the plan's own spec.
- `fluency(c)` now reads `eff(c,"tongue")` alone; `canParley`'s fluency-2 Magical branch and `parley()`'s `wilmsryVsMagical` refusal (which sits behind `canParley`) are left in place as unreachable-but-documented code rather than deleted, since the plan explicitly prohibits touching `mazeworld.html`/`combatMenu.js` this phase.
- Tasks 1 and 2 landed as two separate commits along the plan's own task boundaries, but `engine/combat.js` carries edits from BOTH tasks in a single file — the playerStrike/foeToHitVs-member-branch edits (Task 1) and the `startCombat`/`canParley` JSDoc edits (Task 2) are interleaved in the same file and could not be cleanly split into per-task diffs without hand-authoring a patch; each commit was independently verified green before the next was made.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing `feedback-payload.test.js` tests planted the now-retired Agility/Silence skills**
- **Found during:** Task 1, first `npm test` run after the engine edits
- **Issue:** `foeToHitBreakdown: a plain Human Soldier has zero mods; a Guard has exactly one; Guard+Agility orders Agility then Guard` and `playerStrike: struck.critBy = 'silence' for a Silence opening strike` both planted skills this task's own changes retire — a direct, deliberate consequence of the reshape, not a pre-existing bug.
- **Fix:** Rewrote both to plant Sidestep (via `startEffect`) and a `forceCrit` `silentStep` descriptor respectively; extended the matrix test to cover the three new c.timers-driven actives x `vs` x an "effect"/"cooldown" phase control.
- **Files modified:** test/unit/feedback-payload.test.js
- **Committed in:** 4a5e1c4 (Task 1 commit)

**2. [Rule 1 - Bug] `test/unit/tuning-bot.test.js`'s D-06 scenario relied on the now-unreachable fluency-2 tier**
- **Found during:** Task 2, full `npm test` sweep
- **Issue:** A Wilmsry planted with both a Language skill AND a tongue item expected `decideAction` to choose "parley" (fluency 2 opens Magical) — with fluency capped at 1, `canParley` is now false for this state and the bot correctly falls straight to "flee".
- **Fix:** Updated the scenario and both assertions to expect "flee" unconditionally (with or without `ctx.parleyBlocked`), documenting why fluency 2 is now structurally unreachable.
- **Files modified:** test/unit/tuning-bot.test.js
- **Committed in:** eb2d580 (Task 2 commit)

**3. [Rule 1 - Bug] `test/unit/parley-button-mirror.test.js`'s classic-vs-engine matrix diverged on a synthetic Language plant**
- **Found during:** Task 2, full `npm test` sweep
- **Issue:** This file (not in either task's file list) extracts `mazeworld.html`'s hand-maintained classic `canParley()`/`fluency()` duplicate and replays the engine's availability matrix through it. The classic script's `fluency()` still reads `skill("Language")` (mazeworld.html is out of this plan's scope and explicitly prohibited from editing); the engine's `fluency()` no longer does. Planting a synthetic `c.skills.Language` — a shape chargen can no longer produce in real play — made the two scripts disagree.
- **Fix:** Dropped the `lang` dimension from the 1008-case matrix (now 504, real-play-reachable cases only) and updated the two other cases that relied on a synthetic fluency-2 Wilmsry. Documented that this is harmless in real play: chargen never grants Language anymore, so both scripts cap at fluency 1 for every live character regardless.
- **Files modified:** test/unit/parley-button-mirror.test.js
- **Committed in:** eb2d580 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — direct, unavoidable consequences of this plan's own fluency-ceiling and passive-deletion changes; two of the three touched files not in either task's original `<files>` list, required to keep `npm test` at `# fail 0`)
**Impact on plan:** No scope creep, no architectural changes — every fix was a test-only reconciliation of an assertion this plan's own engine changes made stale.

## Issues Encountered

None beyond the deviations above. The plan's detailed strike_descriptor_spec/need_shift_spec sections and the RESEARCH.md fixture-blast-radius table meant every reconciliation step could be checked mechanically (grep gates, measured draw counts) before moving on.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

**Zero items.** This plan's only new engine surface (`state.combat.abilityStrike`, the three `c.timers` need-shift terms) has no producer yet — nothing sets an `ability:*` timer record or an `abilityStrike` descriptor anywhere in the shipped app until Plan 03 lands `useAbility` and its dispatcher wiring. There is nothing reachable in the live game to check on-device from this plan alone. The gameplay changes this plan DOES flag (fluency ceiling 2→1; climb/leap fall-damage halving gone for everyone) are passive/latent rules changes with no dedicated UI surface to verify — they will be exercised incidentally once Plan 05's combat submenu/Hero-tab wiring ships, and are recorded here for the milestone-close tone read:

1. Fluency now maxes at 1 (a tongue item alone) — the old "Language skill + Helm" fluency-2 tier that opened Magical-type parleys is permanently gone (Language is no longer ever rolled).
2. Fall damage from a failed climb or leap is no longer halved for anyone (the old Climbing skill's halving applied to both branches and is now gone entirely).

## Next Phase Readiness

- The `abilityStrike` descriptor seam and the three `c.timers`-driven need-shift terms are live, proven zero-draw, and fully covered by `test/unit/ability-strike.test.js`; Plan 03 can now build `engine/abilities.js#useAbility` directly against these seams without touching `derived.js`/`combat.js`'s hook surfaces again.
- `docs/ABILITIES.md` carries the full "Retired passives" ledger Plan 03 onward can append to.
- No blockers.

---
*Phase: 38-melee-active-abilities*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk; all three task commits found in git log (4a5e1c4, eb2d580, e5b3be5).
