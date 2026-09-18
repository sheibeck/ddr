---
phase: 38-melee-active-abilities
plan: 03
subsystem: engine
tags: [engine, useAbility, dispatcher, cooldowns, foe-flags, dot, refusals, narration, deferred-uat]

# Dependency graph
requires:
  - phase: 38-melee-active-abilities plan 01
    provides: "content/abilities.js catalog (ABILITY_BY_ID/ABILITY_POOL/ONCE_A_FIGHT), c.abilities on every character"
  - phase: 38-melee-active-abilities plan 02
    provides: "state.combat.abilityStrike descriptor read by playerStrike; the three abilityEffectActive-driven need-shift terms in foeToHitVs/foeToHitBreakdown; t.marked's +2"
provides:
  - "engine/abilities.js: useAbility(state, key, rng, events), abilityRoundsLeft(c, key), applyPommel/applyDirtyTrick/applyPoison/applyHamstring/applyMark (shared with Plan 04's Joiner policy)"
  - "engine/actions.js + engine/engine.js: the 'useAbility' action type, its validate case, and its dispatch"
  - "engine/combat.js: foeTurn's f.dot tick / f.stunned skip / f.hamstrung halving / hero-branch Riposte counter / f.blindFor countdown; pickFoeTarget's Taunt bypass; applyFoeDamageToPlayer's Brace halving + Taunt's doubled armour-soak target; flee's Smoke bypass"
  - "23 new event types narrated in EVENT_NARRATION + TOAST_FOR, plus fled's new 'smoke' reason; 'abilityRefused' added to FEATURE_EVENTS"
  - "docs/USABLE-FEATURES-AUDIT.md §1 abilityRefused row; docs/ABILITIES.md 'Play rules (Plan 03)' section"
affects: [38-04-melee-joiners, 38-05-melee-shell]

tech-stack:
  added: []
  patterns:
    - "A transient action-scoped descriptor (state.combat.abilityStrike, Plan 02) driving an existing action function (playerStrike) instead of a parallel strike implementation — the design this plan's 5 strike-modifying abilities all reuse verbatim"
    - "Foe-flag appliers (applyPommel/applyDirtyTrick/applyPoison/applyHamstring/applyMark) exported as small pure setters specifically so Plan 04's Joiner policy can reuse them unchanged"
    - "The 'one-tick-already-spent' invariant: activating an ability IS the round's action, so the SAME dispatch's own afterPlayerAction->foeTurn call always ticks every freshly-started c.timers record once before useAbility returns — a duration-1 ability (riposte/taunt) is therefore already in its cooldown phase by the time the caller can observe it from outside"

key-files:
  created:
    - engine/abilities.js
    - test/unit/abilities.test.js
    - test/unit/actions.test.js
  modified:
    - engine/actions.js
    - engine/engine.js
    - engine/combat.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - test/voice/safety-scan.test.js
    - docs/USABLE-FEATURES-AUDIT.md
    - docs/ABILITIES.md

key-decisions:
  - "Every strike-modifying ability (kata/feint/deathTouch/silentStep/overheadBlow/lastStand) sets state.combat.abilityStrike then calls playerStrike inline and returns immediately — useAbility never also calls afterPlayerAction on that branch (the RESEARCH-named double-foe-turn pitfall)"
  - "The refusal ladder order is notFought -> unknown -> notInCombat -> cooldown -> noTarget -> notLowEnough, exactly per the plan's must_haves; noTarget is structurally unreachable in real play (proven by a hand-built zero-foe combat in the test suite, mirroring castSpell's own documented reasoning)"
  - "startAbilityTimer(c, meta) is the ONE cooldown-dispatch site: a DURATION_ROUNDS lookup ({ sidestep:2, battleRoar:2, riposte:1, taunt:1, smoke:2 }) picks startEffect vs startCooldown; cd:\"fight\" maps to ONCE_A_FIGHT (999) on either path"
  - "engine/combat.js#foeTurn's f.dot tick and f.stunned skip are placed at the EXACT positions ability_effects_spec names (directly after the acid block; directly after the asleep check) so a foe that is both dot-ticked and stunned resolves in the documented order; f.blindFor's countdown is placed at the literal END of each foe's visit (after the swings loop), which means a foe that continue'd earlier this turn (asleep/stunned/dot-killed) does NOT get its blindFor decremented that round — a deliberate, spec-literal placement, not an oversight"
  - "test/unit/actions.test.js did not exist before this plan (RESEARCH's own read_first instruction to 'mirror the castSpell.idx pin' assumed a file that was never actually created in this repo) — created it as the new home for useAbility's validateAction pins, mirroring engine-purity.test.js's existing castSpell.idx/useItem.i pin style"
  - "ABIL-01 and ABIL-04 are NOT marked complete in REQUIREMENTS.md by this plan, despite being named in this plan's own frontmatter — both requirements' literal text (\"shown and used from the ABILITIES submenu\", \"legible in the submenu\") describes UI Plan 05 has not yet built; Plan 05's own frontmatter independently re-lists both IDs, confirming the phase's own decomposition expects the mark-complete to happen there, not here (the ABIL-02 precedent — marked complete only once its full DoD text was satisfied — is followed for the same reason)"

requirements-completed: []

coverage:
  - id: D1
    description: "useAbility(state, key, rng, events) exists with the full refusal ladder (notFought/unknown/notInCombat/cooldown/noTarget/notLowEnough), each a single event, zero draws, no timer started, combat.round unchanged"
    requirement: "ABIL-01"
    verification:
      - kind: unit
        ref: "test/unit/abilities.test.js (ladder section, 8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A successful use pushes abilityUsed first, starts the id's timer, resolves the effect, and ends the round exactly once — proven by a foe-count/round proof for both a strike and a non-strike ability"
    requirement: "ABIL-01"
    verification:
      - kind: unit
        ref: "test/unit/abilities.test.js (round economy section, 2 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 20 abilities resolve per ability_effects_spec: the five strike-modifiers (+Overhead Blow, Last Stand) via the abilityStrike descriptor; the eight foe-flag/self/foes abilities (pommelStrike/dirtyTrick/poisonedEdge/hamstring/mark/cutpurse/secondWind/sweep) resolve directly; brace/riposte/taunt/sidestep/battleRoar/smoke start their timers"
    requirement: "ABIL-01"
    verification:
      - kind: unit
        ref: "test/unit/abilities.test.js (per-ability section, 24 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The four combat.js foe-side hooks (dot tick/stunned skip/hamstrung halving/riposte counter/blindFor countdown, pickFoeTarget's taunt bypass, applyFoeDamageToPlayer's brace halving + taunt soak doubling, flee's smoke bypass) are wired and proven, inert on every existing fixture"
    requirement: "ABIL-01"
    verification:
      - kind: unit
        ref: "test/unit/abilities.test.js (Task 2 hooks section, 12 tests)"
        status: pass
      - kind: unit
        ref: "test/parity/*.test.js (37/37, unchanged fixtures)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every new event type (23) has an EVENT_NARRATION + TOAST_FOR entry; the canon refusal register renders exactly once per file; abilityRefused is in FEATURE_EVENTS; the voice scan and both coverage guards are green"
    requirement: "ABIL-04"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js + test/unit/formatEventsCoverage.test.js (11/11)"
        status: pass
      - kind: unit
        ref: "test/voice/safety-scan.test.js (60/60)"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm test ends # fail 0; fixtures unchanged from Plan 01; master hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0 unchanged; the diff since Plan 02's final commit touches exactly the 8 files this plan's frontmatter names"
    verification:
      - kind: unit
        ref: "npm test (2499/2499)"
        status: pass
      - kind: unit
        ref: "git diff --stat e5b3be5 -- engine content src mazeworld.html docs"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-17
status: complete
---

# Phase 38 Plan 03: Melee Ability Dispatcher Summary

**`engine/abilities.js#useAbility` — the ABILITIES submenu's real action: a `castSpell`-parallel refusal ladder, Phase 36 `c.timers` cooldowns, and all 20 ability resolutions, wired into `engine/actions.js`/`engine/engine.js` and every foe-side `combat.js` hook (dot/stun/blindFor/hamstrung/riposte/taunt/brace/smoke), narrated in all three event tables with the canon refusal register.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 11 (3 new, 8 modified)

## Accomplishments

- `engine/abilities.js` (new): `useAbility(state, key, rng, events)` with the full six-step refusal ladder (notFought/unknown/notInCombat/cooldown/noTarget/notLowEnough), `abilityRoundsLeft(c, key)`, and `applyPommel`/`applyDirtyTrick`/`applyPoison`/`applyHamstring`/`applyMark` — small pure foe-flag setters Plan 04's Joiner policy reuses verbatim. All 20 abilities resolve per `ability_effects_spec`: the six strike-modifiers (kata/feint/deathTouch/silentStep/overheadBlow/lastStand) delegate entirely to `playerStrike` via the transient `abilityStrike` descriptor; the eight foe-targeted/self abilities resolve directly and tail-call `afterPlayerAction` exactly once.
- `engine/actions.js` + `engine/engine.js`: the `"useAbility"` action type, its `validate` case (`useAbility.key must be a non-empty string`), and its dispatch case.
- `engine/combat.js`: `foeTurn`'s `f.dot` tick (Poisoned Edge, the `f.acid` template), `f.stunned` skip (Pommel Strike, the `f.asleep` template), `f.hamstrung` halving at both the hero- and member-branch damage sites, a hero-branch-miss Riposte counter, and the `f.blindFor` countdown (Dirty Trick) at the end of each foe's own visit; `pickFoeTarget`'s Taunt bypass (0 draws); `applyFoeDamageToPlayer`'s Brace single-charge halving and Taunt's doubled armour-soak target; `flee`'s Smoke bypass (no roll, no pursuit strike).
- `test/unit/abilities.test.js` (new, 54 tests): the ladder, round economy, timer lifecycle (including the one-tick-already-spent invariant), every ability's Task-1-reachable behaviour, and 12 Task-2-hook proofs.
- `test/unit/actions.test.js` (new): `useAbility`'s `validateAction` pins (this file did not exist before this plan — see Decisions).
- `src/browser/eventNarration.js` + `toasts.js`: all 23 new event types narrated, the canon refusal register (`"<Name>: N round(s). Your arm has opinions."`), `fled`'s new `"smoke"` branch, `"abilityRefused"` added to `FEATURE_EVENTS`.
- `test/voice/safety-scan.test.js`: `BASE_EVENT` gains `left`/`have`/`by`/`attacks`; `BRANCH_TOGGLES` gains the six new `abilityRefused` reasons plus `fled`'s `"smoke"`.
- `docs/USABLE-FEATURES-AUDIT.md` §1 + `docs/ABILITIES.md`'s new "Play rules (Plan 03)" section (ladder, cooldown model, condensed resolution table, the Task 2 hooks, the draw statement).

## Task Commits

1. **Task 1: useAbility refusal ladder, timers, 20 resolutions, action registration** — `845fd32` (feat)
2. **Task 2: combat.js foe-side hooks** — `42f9ebc` (test)
3. **Task 3: narration + docs + plan gate** — `49841be` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `engine/abilities.js` (new) — `useAbility`, `abilityRoundsLeft`, the five `apply*` foe-flag setters
- `engine/actions.js` — `"useAbility"` action type + validate case
- `engine/engine.js` — `useAbility` dispatch
- `engine/combat.js` — `foeTurn`/`pickFoeTarget`/`applyFoeDamageToPlayer`/`flee` hooks
- `test/unit/abilities.test.js` (new, 54 tests)
- `test/unit/actions.test.js` (new)
- `src/browser/eventNarration.js`, `src/browser/toasts.js` — 23 new events + `fled`'s smoke branch + `FEATURE_EVENTS`
- `test/voice/safety-scan.test.js` — `BASE_EVENT`/`BRANCH_TOGGLES` extensions
- `docs/USABLE-FEATURES-AUDIT.md`, `docs/ABILITIES.md` — the ledger and audit row

## Decisions Made

- Every strike-modifying ability sets `state.combat.abilityStrike` then calls `playerStrike` inline and returns immediately, never also calling `afterPlayerAction` on that branch — the RESEARCH-named double-foe-turn pitfall, avoided by construction.
- `startAbilityTimer(c, meta)` is the one cooldown-dispatch site: a `DURATION_ROUNDS` lookup picks `startEffect` (sidestep/battleRoar/riposte/taunt/smoke) vs `startCooldown` (everything else); `cd: "fight"` maps to `ONCE_A_FIGHT` (999) on either path.
- The **one-tick-already-spent invariant**: activating an ability IS the round's action, so the SAME dispatch's own `afterPlayerAction` → `foeTurn` call always ticks every freshly-started `c.timers` record once before `useAbility` returns. A duration-1 ability (riposte, taunt) is therefore already in its cooldown phase by the time the caller can observe it from outside — its one-round window IS that same `foeTurn`, not a later-observable state. This surfaced as 8 initially-wrong test expectations during Task 1/2 development (see Deviations) and is now documented in `docs/ABILITIES.md`.
- `f.blindFor`'s countdown sits at the literal END of each foe's visit (after the swings loop), per the plan's own spec placement — a foe that `continue`d earlier this turn (asleep/stunned/dot-killed) does NOT get its `blindFor` decremented that round. Followed literally rather than second-guessed.
- `test/unit/actions.test.js` did not exist before this plan (the plan's own `read_first` instruction to "mirror the castSpell.idx pin" assumed a file that was never actually created in this repo — `engine-purity.test.js` carries the only pre-existing `castSpell.idx`/`useItem.i` pins). Created it fresh as `useAbility`'s dedicated home, mirroring that file's exact style.
- **ABIL-01 and ABIL-04 are NOT marked complete in `REQUIREMENTS.md`** despite being named in this plan's own frontmatter — both requirements' literal text describes the ABILITIES submenu (Plan 05, not yet built). Plan 05's own frontmatter independently re-lists both IDs, confirming the phase's decomposition expects the mark-complete there. This follows the same precedent Plan 01 set for ABIL-02 (marked complete only once its full DoD was satisfied).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/test-authoring] Eight timer-lifecycle test expectations were off by one tick**
- **Found during:** Task 1, first `node --test` run of the new test file
- **Issue:** `kata`/`sidestep`/`secondWind`/`riposte`/`taunt`'s timer-lifecycle tests all assumed the freshly-started timer would still read its FULL starting value immediately after `useAbility` returned. In fact `useAbility`'s own non-strike tail calls `afterPlayerAction`, which always runs the same round's `foeTurn` — which always ticks every `c.timers` "rounds" record once at its own tail — before `useAbility` can return. Every fresh timer is therefore already one tick into its life by the time the caller observes it.
- **Fix:** Recomputed every expected value (kata: 3→2 immediately after use; sidestep: 6→5; secondWind's exact 999 replaced with a `>=990` bound + an `isReady` check; riposte/taunt: removed the `abilityEffectActive === true` post-call assertion entirely, since a duration-1 effect is ALREADY in its cooldown phase by the time it can be observed from outside — replaced with `isReady === false` + `remaining === cd` assertions). Documented as the "one-tick-already-spent invariant" in both the test file's own header comment and `docs/ABILITIES.md`.
- **Files modified:** test/unit/abilities.test.js
- **Verification:** all 42 Task-1 tests green.
- **Committed in:** 845fd32 (Task 1 commit)

**2. [Rule 1 - Bug/test-authoring] Two deathTouch tests used the "Soldier" sub, which structurally can never crit**
- **Found during:** Task 1, same test run
- **Issue:** `deathTouch`'s "forceCrit" test used `fixedFighter`'s default `sub: "Soldier"` — but `playerStrike`'s `noCrit` gate is `true` for Guard/Soldier by design ("your blows never crit"), so `forceCrit` correctly never set `crit = true`, and the finish-under-15 test's roll (20) missed outright (deathTouch's finish only fires on a LANDED blow, never a miss).
- **Fix:** Switched both tests to `sub: "Knight"` (also Fighter, no crit suppression) and used a landing roll (3) for the finish test, retitling it to make the "a miss only burns the cooldown" rule explicit.
- **Files modified:** test/unit/abilities.test.js
- **Committed in:** 845fd32 (Task 1 commit)

**3. [Rule 1 - Bug/test-authoring] Three Task-1-section per-ability tests needed the same one-tick correction after Task 2 landed the foeTurn hooks**
- **Found during:** Task 2, first full `node --test test/unit/abilities.test.js` run after wiring the combat.js hooks
- **Issue:** `pommelStrike`'s test expected `foe.stunned === true` right after `useAbility`; `dirtyTrick`'s expected `foe.blindFor === 2`; `poisonedEdge`'s expected `foe.dot.left === 3`. Once Task 2's hooks existed, the SAME same-dispatch `foeTurn` call (which was already running in Task 1, just previously a no-op on these fields) now consumes exactly one tick of each — flipping `stunned` back to `false` (with a `foeStunned` event), decrementing `blindFor` to 1, and decrementing `dot.left` to 2.
- **Fix:** Updated the three assertions to the post-one-tick values, retitling each to point at the dedicated Task-2 section's fuller proof (skip-turn / countdown / three-tick sequence).
- **Files modified:** test/unit/abilities.test.js
- **Verification:** all 54 tests green; `npm test` 2499/2499.
- **Committed in:** 42f9ebc (Task 2 commit)

**4. [Rule 1 - Bug] `sweep`'s lethal-kill test underflowed its fake rng sequence**
- **Found during:** Task 1
- **Issue:** `killFoe` draws several dice beyond the initial `weaponDamage` roll (the sp-gain d6, the coin d10, the loot-chance d20, and — for a `"Beasts"`/`"Lair Beasts"` foe — an extra cooking-check d6); the test's single-value sequence underflowed on the second kill.
- **Fix:** Gave both test foes `type: "Humans"` (skipping the cooking branch) and appended the shared `FILL` filler after the initial weapon-damage draw.
- **Files modified:** test/unit/abilities.test.js
- **Committed in:** 845fd32 (Task 1 commit)

**5. [Rule 1 - Bug] The narration/toast "canon refusal register" comment collided with its own grep tripwire**
- **Found during:** Task 3
- **Issue:** A doc comment quoting the exact sentence `"Pommel Strike: three rounds. Your arm has opinions."` above `abilityRefused` in both `eventNarration.js` and `toasts.js` made `grep -c "Your arm has opinions"` print 2 instead of the required 1 (mirroring Plan 01's own identical `active: "` grep-collision fix).
- **Fix:** Reworded both comments to describe the register without repeating the literal sentence.
- **Files modified:** src/browser/eventNarration.js, src/browser/toasts.js
- **Verification:** `grep -c "Your arm has opinions"` now prints 1 for each file.
- **Committed in:** 49841be (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (all Rule 1 — test-authoring corrections against the plan's own documented mechanics, plus one narration grep-collision fix mirroring Plan 01's precedent). No scope creep, no architectural changes.

## Issues Encountered

None beyond the deviations above. The plan's exhaustive `ability_effects_spec`/`narration_spec` text made every fix mechanical (re-derive the expected value from the documented mechanic, not guess).

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

**Zero items.** This plan's engine surface (`useAbility`, the 23 new events, the `combat.js` hooks) has no producer or reader in the live shell yet — no submenu row exists until Plan 05 lands `combatMenu.js`'s third branch, and no `useAbility` dispatch can be triggered from the running app until then. There is nothing reachable on-device to check from this plan alone. Carry forward to Plan 05's aggregated Pixel 7 checklist: once the submenu ships, verify (a) the cooldown line reads exactly `"<Name>: N round(s). Your arm has opinions."` with correct singular/plural, (b) an on-cooldown row stays tappable and produces the fight-log line rather than a disabled/greyed row, and (c) a spot-check of a few ability tones (Pommel Strike/Sweep/Riposte/Smoke) for the family-friendly deadpan voice in real play, not just the synthetic safety-scan corpus.

## Next Phase Readiness

- `useAbility`, `abilityRoundsLeft`, and the five foe-flag appliers (`applyPommel`/`applyDirtyTrick`/`applyPoison`/`applyHamstring`/`applyMark`) are exported and ready for Plan 04's Joiner policy to call directly — no new engine surface needed there.
- All 20 abilities are fully resolvable and narrated; Plan 05 needs only the `combatMenu.js` submenu branch (per RESEARCH Question 7's already-sketched shape) and the Hero-tab abilities list — zero further engine work.
- `docs/ABILITIES.md`'s "Play rules (Plan 03)" section is the living reference Plan 04/05 can cite directly (the ladder, the cooldown model, the one-tick invariant, the per-ability table).
- No blockers.

---
*Phase: 38-melee-active-abilities*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created files found on disk; all three task commits found in git log (845fd32, 42f9ebc, 49841be).
