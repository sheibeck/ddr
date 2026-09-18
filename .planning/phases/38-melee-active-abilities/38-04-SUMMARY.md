---
phase: 38-melee-active-abilities
plan: 04
subsystem: engine
tags: [engine, joiners, party-combat, member-abilities, class-policy, member-timers, deferred-uat]

# Dependency graph
requires:
  - phase: 38-melee-active-abilities plan 03
    provides: "engine/abilities.js#useAbility, abilityRoundsLeft, applyPommel/applyDirtyTrick/applyPoison/applyHamstring/applyMark (shared foe-flag appliers), the transient state.combat.abilityStrike descriptor, the three abilityEffectActive-driven need-shift terms"
provides:
  - "engine/combat.js: memberView, pickMemberAbility, resolveMemberAbility (all 20 member ability resolutions), memberStrike(..., mod), the alliesTurn ability branch, foeTurn member-branch Sidestep/Smoke need shifts + Riposte counter + Brace halving, pickFoeTarget's member Taunt bypass, per-member tickRounds (foeTurn tail) / clearRoundTimers (endCombat)"
  - "engine/derived.js: partyEffectActive(state, key); the Battle Roar term in foeToHitVs/foeToHitBreakdown now honours any live party member's own Battle Roar"
  - "engine/abilities.js: DURATION_ROUNDS exported so combat.js reuses the exact cooldown/effect mapping"
  - "src/browser/eventNarration.js + toasts.js: memberAbilityUsed/memberSecondWind/memberSwept/memberRiposted narrated; the fourteen Plan 03 activation/effect events gain an additive member-name prefix; allyStruck/allyMissed gain an optional via clause"
  - "docs/ABILITIES.md 'Joiners (Plan 04)' section"
affects: [38-05-melee-shell]

tech-stack:
  added: []
  patterns:
    - "A member-side transient descriptor (memberStrike's `mod` parameter, passed as a direct function argument) as the Joiner analog of playerStrike's shared state.combat.abilityStrike slot — no shared combat-scoped field needed since a Joiner never dispatches useAbility"
    - "Per-member persistent-sheet timers (state.party[i].timers) ticked/cleared beside the hero's own c.timers at the SAME two call sites (foeTurn's tail, endCombat), rather than a parallel bookkeeping mechanism"
    - "partyEffectActive(state, key) as the 'any live carrier on this side' scan, layered onto abilityEffectActive(c, key) ('this one carrier') via an OR at both call sites — Battle Roar is the first ability to need a whole-side term"

key-files:
  created:
    - test/unit/party-abilities.test.js
  modified:
    - engine/combat.js
    - engine/derived.js
    - engine/abilities.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - test/voice/safety-scan.test.js
    - docs/ABILITIES.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "pickMemberAbility's three-way policy falls THROUGH rather than being a strict if/elseif/elseif/else on round number alone: at round 1, a missing/unready opener still lets the same call check the damage-then-defensive branches (matching the plan's own 'opener preferred in round 1 ONLY' framing and its four worked examples) rather than returning null outright at round 1 with no opener ready"
  - "memberStrike's `mod` is passed as a plain function argument by resolveMemberAbility, never stashed on `ally`/`state.combat` — the member analog of playerStrike's shared C.abilityStrike slot, but with no shared slot to clash over since a Joiner never dispatches useAbility"
  - "t.marked's +2 applies in memberStrike UNCONDITIONALLY (mod or not), mirroring playerStrike's own unconditional rule — a marked foe takes +2 from every striker, hero or member alike; inert on every existing test since no foe was ever marked before this phase's Mark ability exists"
  - "endCombat's per-member clearRoundTimers loop iterates C.allies (not state.party) since downMember already splices a downed member out of C.allies the instant it happens — C.allies at endCombat time holds only SURVIVING members, so no extra 'is this member downed' check was needed"
  - "allyStruck/allyMissed's new optional via clause renders the ability's CANON CATALOG NAME (via ABILITY_BY_ID[e.via].name), not the raw internal id, importing content/abilities.js into eventNarration.js/toasts.js (pure content data, not engine/ — same discipline as eventNarration.js's existing content/flavor.js import)"
  - "Tasks 1 and 2 were committed as two genuinely separate diffs (not merely two commit messages over one combined diff): resolveMemberAbility's switch statement was authored in two passes — the 12 Task-1 cases (strike kinds + foe-flag kinds + cutpurse) committed first, then the 8 Task-2 cases (secondWind/sweep/brace/riposte/taunt/sidestep/battleRoar/smoke) reapplied and committed second, alongside the foeTurn/pickFoeTarget/endCombat hooks and derived.js's partyEffectActive — each commit independently verified green against its own plan-specified verify command before the next was authored"

requirements-completed: [ABIL-05]

coverage:
  - id: D1
    description: "pickMemberAbility(sheet, ally, round, target) implements the class-driven use policy exactly (round-1 opener preference, above-half-hp damage pick with Last Stand's own death-panic gate, below-half-hp defensive pick, sheet.abilities order breaks ties, other-class/unknown ids ignored, cooldown-phase abilities not READY) — zero rng draws for the decision"
    requirement: "ABIL-05"
    verification:
      - kind: unit
        ref: "test/unit/party-abilities.test.js (policy matrix, 9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A classed Fighter/Thief member with no abilities key, an empty list, only the other class's ids, or everything on cooldown falls through to today's plain strike/cast byte-identically (DFB-05 identity preserved)"
    requirement: "ABIL-05"
    verification:
      - kind: unit
        ref: "test/unit/party-abilities.test.js (zero-draw fall-through, 4 tests) + test/unit/party-combat.test.js (unchanged, 60/60)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 20 abilities resolve for a member through the exact primitives the hero's useAbility uses: the 6 strike-modifiers via memberStrike(mod); pommelStrike/dirtyTrick/poisonedEdge/hamstring/mark via the shared foe-flag appliers; cutpurse/secondWind/sweep/brace/riposte/taunt/sidestep/battleRoar/smoke each resolved and narrated with an additive member field"
    requirement: "ABIL-05"
    verification:
      - kind: unit
        ref: "test/unit/party-abilities.test.js (per-ability sections 3/4, 20 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "foeTurn's member branch honours a member's own Sidestep/Smoke need shifts, a Riposte counter on a miss against THAT member only, and a single-charge Brace halving; pickFoeTarget's member-own Taunt bypass (checked after the hero's own); per-member tickRounds at foeTurn's tail and clearRoundTimers at endCombat (post-research ruling: Joiner cooldowns clear at endCombat); partyEffectActive extends Battle Roar to the whole side in both foeToHitVs/foeToHitBreakdown twins"
    requirement: "ABIL-05"
    verification:
      - kind: unit
        ref: "test/unit/party-abilities.test.js (sections 5-8, 13 tests)"
        status: pass
      - kind: unit
        ref: "test/parity/*.test.js (37/37, unchanged fixtures)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every new/extended event type is narrated in both tables with the member-name prefix/clause convention; voice scan and coverage guards green"
    verification:
      - kind: unit
        ref: "test/unit/toastsCoverage.test.js + test/unit/formatEventsCoverage.test.js + test/voice/safety-scan.test.js (18/18)"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm test ends # fail 0; fixtures unchanged; master hash a1f4d0dc29782218d8e5aab65bc5989c33f917f0 unchanged; diff since Plan 03's final commit touches exactly the 6 files named in the plan's own gate"
    verification:
      - kind: unit
        ref: "npm test (2542/2542)"
        status: pass
      - kind: unit
        ref: "git diff --stat 49841be -- engine content src mazeworld.html docs"
        status: pass
    human_judgment: false

duration: 100min
completed: 2026-09-18
status: complete
---

# Phase 38 Plan 04: Melee Joiners Summary

**Party Joiners of a melee class now fight by class AND by kit — `alliesTurn`'s class policy gains a third branch (`pickMemberAbility`) that uses a Joiner's own rolled ability by an opener/damage/defensive rule before falling back to a plain strike or cast, resolving all 20 abilities through the exact `memberStrike`/shared foe-flag-applier primitives the hero's `useAbility` already uses, with per-member cooldowns on the member's own persistent sheet clearing at `endCombat` like the hero's.**

## Performance

- **Duration:** ~100 min
- **Tasks:** 3
- **Files modified:** 8 (1 new, 7 modified)

## Accomplishments

- `engine/combat.js`: `memberView(sheet, ally)` (the pre-existing inline `view` literal factored out, byte-identical); `pickMemberAbility(sheet, ally, round, target)` — the pure, zero-draw class-driven use policy (round-1 opener; else an above-half-hp damage ability with Last Stand's own death-panic gate; else a below-half-hp defensive ability; else null); `resolveMemberAbility` resolving all 20 abilities through `memberStrike`'s new `mod` parameter (strike kinds) and Plan 03's shared foe-flag appliers (`applyPommel`/`applyDirtyTrick`/`applyPoison`/`applyHamstring`/`applyMark`) plus cutpurse/secondWind/sweep/brace/riposte/taunt/sidestep/battleRoar/smoke; the `alliesTurn` ability branch (checked before the Magic User cast branch, zero draws for the decision itself); `foeTurn`'s member branch gains the member's own Sidestep/Smoke need shifts, a Riposte counter on a miss against that specific member, and a single-charge Brace halving; `pickFoeTarget`'s member-own Taunt bypass (checked after the hero's own, zero draws); per-member `tickRounds` at `foeTurn`'s tail and `clearRoundTimers` at `endCombat` (post-research ruling: Joiner cooldowns clear at `endCombat` exactly like the hero's).
- `engine/derived.js`: `partyEffectActive(state, key)` — true when any live party member's own sheet carries the effect; `foeToHitVs`/`foeToHitBreakdown`'s Battle Roar term now reads `abilityEffectActive(c, "battleRoar") || partyEffectActive(state, "battleRoar")` in both twins, so a Joiner's Battle Roar covers the whole side exactly like the hero's.
- `engine/abilities.js`: `DURATION_ROUNDS` exported so `combat.js#startMemberAbilityTimer` reuses the identical cooldown/effect-duration mapping rather than duplicating it.
- `src/browser/eventNarration.js` + `toasts.js`: four new member-only events narrated (`memberAbilityUsed`, `memberSecondWind`, `memberSwept`, `memberRiposted`); fourteen Plan 03 activation/effect events (`braced`/`braceHeld`/`pommelStruck`/`dirtyTrickLanded`/`poisonedEdgeApplied`/`hamstrung`/`marked`/`cutpursed`/`riposteReady`/`taunted`/`sidestepped`/`battleRoarRaised`/`smokeThrown`/`lastStandCalled`) gain an additive `${e.member ? \`${e.member}: \` : ""}` prefix in both tables; `allyStruck`/`allyMissed` gain an optional trailing clause naming the ability behind a member's strike-kind use (`ABILITY_BY_ID[e.via].name`, imported as pure content data).
- `test/voice/safety-scan.test.js`: `BRANCH_TOGGLES` gains `{ member: null }` so both sides of every new member-prefix ternary render under the scan.
- `test/unit/party-abilities.test.js` (new, 43 tests): the policy matrix, zero-draw fall-through, all 20 ability resolutions, the foeTurn member-branch hooks, `pickFoeTarget`'s Taunt precedence, per-member tick/clear, and `partyEffectActive`'s own matrix.
- `docs/ABILITIES.md`'s new "Joiners (Plan 04)" section: the policy rule verbatim, the sheet-timers/transient-flag split, the `endCombat`-clear ruling, the shared-primitive table, and the `foeTurn`/`pickFoeTarget` hook summary.
- `.planning/REQUIREMENTS.md`: ABIL-05 marked complete (this plan's full DoD text is satisfied — unlike ABIL-01/04, which describe the combat submenu Plan 05 has not yet built).

## Task Commits

1. **Task 1: Joiner ability policy, strike/foe-flag kinds, cutpurse** — `df8ebf3` (feat)
2. **Task 2: self/defensive kinds, foeTurn hooks, partyEffectActive** — `ef40527` (test)
3. **Task 3: narration for every member event, ledger, plan gate** — `29ce0aa` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `engine/combat.js` — `memberView`, `pickMemberAbility`, `resolveMemberAbility`, `memberStrike(..., mod)`, the `alliesTurn` ability branch, `foeTurn`/`pickFoeTarget`/`endCombat` member hooks
- `engine/derived.js` — `partyEffectActive`; the Battle Roar term in both `foeToHitVs`/`foeToHitBreakdown` twins
- `engine/abilities.js` — `DURATION_ROUNDS` exported
- `test/unit/party-abilities.test.js` (new, 43 tests)
- `src/browser/eventNarration.js`, `src/browser/toasts.js` — 4 new member events + 14 member-prefix extensions + `allyStruck`/`allyMissed`'s `via` clause
- `test/voice/safety-scan.test.js` — `BRANCH_TOGGLES` extension
- `docs/ABILITIES.md` — the "Joiners (Plan 04)" ledger section
- `.planning/REQUIREMENTS.md` — ABIL-05 marked complete

## Decisions Made

- `pickMemberAbility`'s three-way policy falls THROUGH round 1's opener check to the damage/defensive checks when no opener is ready, rather than returning `null` outright — matching the plan's own "opener preferred in round 1 ONLY" framing and its four worked examples exactly.
- `memberStrike`'s `mod` is a plain function argument (never stashed on `ally`/`state.combat`) — the member analog of `playerStrike`'s shared `C.abilityStrike` slot, with no shared slot needed since a Joiner never dispatches `useAbility`.
- `t.marked`'s +2 applies in `memberStrike` UNCONDITIONALLY (mod or not), mirroring `playerStrike`'s own unconditional rule — a marked foe takes +2 from every striker, hero or member alike; inert on every pre-existing test since no foe was ever marked before this phase's Mark ability exists.
- `endCombat`'s per-member `clearRoundTimers` loop iterates `C.allies` (not `state.party`) since `downMember` already splices a downed member out of `C.allies` the instant it happens — `C.allies` at `endCombat` time holds only SURVIVING members, so no extra "is this member downed" check was needed.
- `allyStruck`/`allyMissed`'s new optional `via` clause renders the ability's CANON CATALOG NAME (`ABILITY_BY_ID[e.via].name`), not the raw internal id — `content/abilities.js` imported into `eventNarration.js`/`toasts.js` as pure content data (same discipline as `eventNarration.js`'s existing `content/flavor.js` import).
- Tasks 1 and 2 were committed as two genuinely separate diffs — `resolveMemberAbility`'s switch statement was authored in two passes (the 12 Task-1 cases first, the 8 Task-2 cases plus the `foeTurn`/`pickFoeTarget`/`endCombat` hooks and `partyEffectActive` second), each independently verified green against its own plan-specified verify command before the next was authored, mirroring 38-02's own precedent for interleaved-file task boundaries.

## Deviations from Plan

None — plan executed exactly as written. `pickMemberAbility`'s fall-through behavior (documented above as a Decision, not a deviation) is a direct, literal reading of the plan's own must_haves text and worked examples, not a departure from it.

## Issues Encountered

None. The plan's exhaustive `member_spec` section (exact descriptor shapes, exact event names, exact hook placements) made every implementation step mechanical — the only judgment calls were the two documented above, both resolved by re-reading the plan's own worked examples/spec text rather than guessing.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

This plan's new engine surface (the Joiner ability policy, all 20 member resolutions, the `foeTurn`/`pickFoeTarget` hooks, the new narration) has no shell trigger yet — a Joiner is recruited and fights automatically through `alliesTurn`, which the live app already calls every combat round, so this IS reachable on-device once a Joiner is recruited (no Plan 05 dependency, unlike Plans 01-03). Three items for the aggregated Pixel 7 checklist:

1. Recruit a Fighter or Thief Joiner and, in a fight, watch the fight log for a "{name} calls {ability}." line in round 1 (an opener ability, e.g. Pommel Strike/Dirty Trick/Battle Roar/Silent Step) followed by its effect line, and confirm the companion's name appears correctly.
2. Continue the fight past round 1 and confirm the Joiner uses a damage-tagged ability (e.g. Kata/Feint/Sweep) against a healthy foe, or a defensive-tagged one (e.g. Brace/Second Wind) once it takes damage — matching the "fights by class and by kit" design intent.
3. Confirm a Joiner's ability shows READY again at the start of the NEXT fight (cooldowns clear at `endCombat`), and that a member Battle Roar's fight-log line reads as covering the whole party's side, not just that one companion.

## Next Phase Readiness

- Every engine surface Plan 05 needs (the ABILITIES submenu, the Hero-tab ability list) is already fully built and Joiner-complete from Plans 01-04 — Plan 05 needs only shell/UI wiring, zero further engine work.
- `docs/ABILITIES.md`'s "Joiners (Plan 04)" section is the living reference for anyone auditing the class-driven use policy or the shared-primitive table.
- No blockers.

---
*Phase: 38-melee-active-abilities*
*Completed: 2026-09-18*
