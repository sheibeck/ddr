---
phase: 36-balance-foundation-effect-timers-small-independent-wins
plan: 03
subsystem: combat
tags: [combat-targeting, dead-foe, shell, input-guards, arm-window, parity-neutral, deferred-uat]

# Dependency graph
requires:
  - phase: 36-balance-foundation-effect-timers-small-independent-wins (Plan 02)
    provides: "engine/effects.js landed first so this plan's engine/combat.js edits never collide with it (different regions: foeTurn tail/endCombat vs liveFoes/playerStrike)"
provides:
  - "engine/combat.js normalizeTarget(combat) — the ONE dead-target rule, exported beside liveFoes; playerStrike and magic.js#castSpell refactored onto it, behaviour-identical to their former inline copies"
  - "mazeworld.html: normalizeTarget(state.combat) called once per combat dispatch (engineCombatAction), after the state swap and before renderEncounter(); dead foe cards carry aria-disabled=\"true\" with no role/tabIndex/handler; armEncounterButtons' sweep excludes .cb-foe.dead"
  - "test/unit/normalizeTarget.test.js (engine semantics + behaviour-identity) and test/unit/shell-dead-foe-target.test.js (shell wiring pins + a DOM-free arm-window race simulation)"
affects: ["37-spell-rework", "38-ability-cooldowns", "any future combat UI work touching foe-card targeting"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "normalizeTarget(combat) is the single shared implementation of the dead-target rule — engine call sites (playerStrike, castSpell) and the shell's post-dispatch hook both call the same function, so parity byte-identity and shell behaviour can never drift apart"
    - "the shell settles presentation state (S.combat.target) by calling the SAME pure engine helper the engine itself uses internally — no new engine action, matching the Phase 34 ruling that targeting stays a guarded shell mutation"
    - "dead-card inertness is markup-only (aria-disabled, no role/tabIndex/handler) — no CSS aria-disabled rule, no transition/animation-based guard, consistent with the existing input-guard discipline"

key-files:
  created:
    - test/unit/normalizeTarget.test.js
    - test/unit/shell-dead-foe-target.test.js
  modified:
    - engine/combat.js
    - engine/magic.js
    - mazeworld.html

key-decisions:
  - "hero() test helper uses sub 'Soldier' (Fighter class) and 'Sorcerer' (Magic User class) rather than the class names themselves — rollCharacter's force seam validates against the actual sub-class list, not the class name."
  - "The castSpell retarget test seeds a THIRD live foe so the encounter can never fully clear even if the Sorcerer's day-one attack spell (thrown-kind, e.g. Freeze/Fireball) happens to kill the retargeted foe; a high looseRng fallback guarantees a miss on the one branch capable of a kill, keeping the assertion focused on the retarget itself rather than combat's end-of-fight branching."
  - "The playerStrike draw-count identity test uses looseRng (not a hand-counted fakeRng sequence) because the specific hero rolled at seed 1 carries enough kit/skills to swing more than once; the exact draw count (6) was measured by running the test once, not hand-computed, per the project's established convention."

requirements-completed: [TGT-01, TGT-02]

coverage:
  - id: D1
    description: "engine/combat.js exports normalizeTarget(combat): dead target -> lowest alive index; alive target untouched; no live foe -> -1 (today's findIndex value); null/undefined/non-array-foes returns untouched, no throw"
    requirement: TGT-01
    verification:
      - kind: unit
        ref: "test/unit/normalizeTarget.test.js (7 pure-helper tests, all pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "playerStrike and magic.js#castSpell no longer carry inline dead-target copies — both call normalizeTarget — behaviour-identical to the old inline rule, zero new rng draws, every parity fixture byte-identical"
    requirement: TGT-01
    verification:
      - kind: unit
        ref: "test/unit/normalizeTarget.test.js (playerStrike/castSpell retarget tests + draw-count/state identity test, 3 tests)"
        status: pass
      - kind: other
        ref: "npm test (2226/2226, # fail 0); git status --porcelain test/parity/fixtures empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0"
        status: pass
    human_judgment: false
  - id: D3
    description: "mazeworld.html's engineCombatAction calls normalizeTarget(state.combat) exactly once, after the state swap and before renderEncounter(); dead cards get aria-disabled with no role/tabIndex/handler; armEncounterButtons' sweep excludes .cb-foe.dead; no re-aim compound word anywhere in the source"
    requirement: TGT-02
    verification:
      - kind: unit
        ref: "test/unit/shell-dead-foe-target.test.js (10 tests: import/call-order, dead/live branch pins, sweep exclusion, style-block check, Decision-3 restatement, forbidden-word check)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-combat-screen.test.js + test/unit/shell-input-guards.test.js + test/unit/shell-map-invariants.test.js (83/83 combined with shell-dead-foe-target.test.js)"
        status: pass
    human_judgment: false
  - id: D4
    description: "the arm-window race (Pitfall 10) is closed: a kill + normalize refreshes the settled roster before the re-render stamps renderedAt; a tap arriving inside ARM_DELAY_MS is refused; a tap on a live card at/after the window sets the target; the dead card exposes no handler at all"
    requirement: TGT-02
    verification:
      - kind: unit
        ref: "test/unit/shell-dead-foe-target.test.js#SIMULATION: kill + normalize settles the aim, a tap inside ARM_DELAY_MS is refused, a tap on a live card at/after the window lands, the dead card has no handler"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-09-17
status: complete
---

# Phase 36 Plan 03: Dead-Foe Targeting (normalizeTarget) Summary

**One exported `normalizeTarget(combat)` in `engine/combat.js` replaces the two inline dead-target rules in `playerStrike`/`castSpell`; the shell calls it once after every combat dispatch, before the re-render, so a dead foe can never stay the target and the arm-window race that could otherwise land a guarded tap on the wrong foe is closed by a DOM-free simulation — zero rng drift, zero parity fixture movement.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-17T16:42:00Z
- **Completed:** 2026-09-17T16:58:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified) + this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit

## Accomplishments

- `engine/combat.js` gains `export function normalizeTarget(combat)` (directly after `liveFoes`): when `combat.target` doesn't point at a live foe, it becomes `combat.foes.findIndex((f) => f.alive)` — exactly `-1` when nothing is alive, matching today's behaviour byte-for-byte. `null`/`undefined`/non-array-`foes` returns untouched, no throw.
- `playerStrike` (combat.js) and `castSpell` (magic.js) both retired their own inline two-line copies of this rule in favor of a single `normalizeTarget(C)` call — behaviour-identical for every existing scenario, zero rng draws added.
- `mazeworld.html`'s `engineCombatAction` calls `normalizeTarget(state.combat)` once, right after `window.__mzState.set(state);` and before `window.renderEncounter()` — every combat dispatch (hero blow, Joiner blow, Freeze/stone/fire/gas via `mzUseItem`, ward reflection, DOT) settles the aim through this one seam before the roster re-renders and `armEncounterButtons()` stamps the arm window.
- `renderFoeCards` gives a dead card `aria-disabled="true"` and nothing else (no role, no tabIndex, no click/keydown handler) — the live branch's `guardTap`/`tabIndex` wiring is untouched. `armEncounterButtons`' 250 ms sweep selector gained `:not(.cb-foe.dead)` so a dead card's `aria-disabled` attribute is never stripped.
- 10 new unit tests in `test/unit/normalizeTarget.test.js` (pure-helper semantics + both refactored call sites + a draw-count/state-identity proof for an already-alive target) and 10 new unit tests in `test/unit/shell-dead-foe-target.test.js` (source pins + a DOM-free simulation of Pitfall 10's arm-window race: kill + normalize settles the aim, an in-window tap is refused, an armed tap lands, the dead card has no handler at all, and normalize never moves the aim off a still-live target when a different foe dies).
- Full gate: `npm test` 2226/2226 (`# fail 0`), `npm run build:www` exit 0, `git diff --stat -- content test/parity package.json package-lock.json` empty, `git hash-object test/parity/prototype-master.js.txt` unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`), and `git diff --stat v1.4.0 -- engine` lists exactly Plan 02's four files plus this plan's `engine/combat.js`/`engine/magic.js`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Export normalizeTarget(combat) from engine/combat.js and refactor the playerStrike + castSpell lazy rules onto it, behaviour-identically** — `537b934` (feat) — `feat(36-03): export normalizeTarget from engine/combat.js, refactor playerStrike + castSpell onto it`
   - `engine/combat.js`, `engine/magic.js`, `test/unit/normalizeTarget.test.js` (new, 10 tests)
2. **Task 2: Shell — post-dispatch normalize before the re-render, dead cards inert, and the race-proof shell test** — `c4dedc9` (feat) — `feat(36-03): shell post-dispatch normalize + inert dead cards + arm-window race pin`
   - `mazeworld.html`, `test/unit/shell-dead-foe-target.test.js` (new, 10 tests)
3. **Task 3: Gate + SUMMARY with the deferred on-device checks** — this commit (docs) — no source files changed, gate re-verified green.

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: this plan's Task 1 carries `tdd="true"` — `test/unit/normalizeTarget.test.js` was written first and verified RED (the pure-helper tests failed on the missing export) before `normalizeTarget` was implemented, then re-run GREEN after the refactor. Tasks 2 and 3 are `type="auto"` (no tdd flag)._

## Files Created/Modified

- `engine/combat.js` - `normalizeTarget(combat)` (new export, directly after `liveFoes`); `playerStrike`'s inline dead-target rule replaced with `normalizeTarget(C);`
- `engine/magic.js` - `normalizeTarget` added to the `combat.js` import; `castSpell`'s inline dead-target rule replaced with `if (C) normalizeTarget(C);`
- `mazeworld.html` - `import { normalizeTarget } from "./engine/combat.js";`; `engineCombatAction` gains the post-dispatch `if (state.combat) normalizeTarget(state.combat);` call; `renderFoeCards`' dead-card `else` branch sets `aria-disabled="true"`; `armEncounterButtons`' sweep selector gains `:not(.cb-foe.dead)`
- `test/unit/normalizeTarget.test.js` - 10 tests: pure-helper semantics (dead/alive/no-live-foe/out-of-range/null-undefined/non-array-foes), playerStrike and castSpell retarget proofs, draw-count/state identity for an already-alive target
- `test/unit/shell-dead-foe-target.test.js` - 10 tests: import + call-order pin, dead/live branch pins, sweep-exclusion pin, style-block check, Decision-3 restatement, forbidden-word check, the arm-window race simulation, and the still-live-target-unmoved case

## Decisions Made

- **hero() test helper sub names:** `hero("Soldier")` (Fighter class) and `hero("Sorcerer")` (Magic User class) are used rather than the class name itself — `rollCharacter`'s Phase-22 force seam validates `force.sub` against the real sub-class list (`Soldier`, `Barbarian`, `Knight`, ... for Fighter; `Wizard`, `Warlock`, `Sorcerer`, ... for Magic User), not the class name.
- **castSpell retarget test uses three foes:** the Sorcerer's day-one castable attack spell is very likely a `"thrown"`-kind spell (Freeze/Fireball, per the sub's own flavor text — "nearly all of it fire") which CAN kill on a hit. A third live foe (index 2) guarantees the encounter never fully clears even if the retargeted foe (index 1) dies, and a high `looseRng` fallback guarantees a miss on the one branch capable of a kill — keeping the assertion focused on "did it retarget to foe 1" rather than combat's end-of-fight branching.
- **playerStrike draw-count identity test measured, not hand-computed:** the specific hero rolled at seed 1 (Soldier, Human) carries enough kit/skills to draw more dice than a bare "roll then damage" pair would suggest. The test uses `looseRng` (safe fallback beyond the seeded sequence) rather than a strict `fakeRng`, and the pinned count (6) was measured by running the test once, per the project's established "measured-not-hand-computed" convention (see `identity-contract.test.js`'s own precedent).

## Deviations from Plan

None beyond the test-authoring adjustments documented above (sub-class names for the `hero()` helper, the third-foe/miss-guaranteeing setup for the castSpell test, and the measured draw count) — every locked API surface (`normalizeTarget`'s signature and semantics, the shell call-site placement, the dead-card markup, the sweep-exclusion selector) matches the plan verbatim.

## Issues Encountered

- Initial test drafts used `hero("Fighter")` which fails `rollCharacter`'s force-sub validation (Fighter is a CLASS, not a sub) — fixed to `hero("Soldier")` before the first commit.
- Initial `castSpell` retarget test and `playerStrike` draw-count test both hit `fakeRng` sequence exhaustion because the real engine draws more dice than a naive 2-value sequence anticipated (a second attack, an armor-soak check, a thrown-spell hit roll). Resolved by measuring actual draw counts with a scratch script and switching to `looseRng` with a safe fallback where the exact count isn't the point of the assertion — both fixed before the first commit, no separate fix commit needed.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol, no device pause was taken. The following checks are queued for the aggregated end-of-run Pixel 7 batch:

1. Start a fight with two or more foes and kill the currently-targeted one (your own blow, a Joiner's blow, or an item/spell kill) — the TARGET tag must jump to the next living foe's card before you can tap anything else.
2. Tap the downed (greyed-out) card repeatedly — nothing happens: no target change, no log line, no visual "armed" feedback.
3. Immediately after a kill, tap a live non-target card within roughly a quarter second (spam-tap) — either nothing happens (the tap was swallowed) or the tapped card becomes the target; a strike must never land on a foe you did not choose.
4. Verify a Joiner's blow or a Freeze that kills the current target also moves the TARGET tag to a survivor, not just a hero-caused kill.
5. (Optional) With TalkBack on, confirm the downed card reads as disabled.

**rng_draw_impact:** adds zero draws — `normalizeTarget` is pure index arithmetic (a single `findIndex` call, same as before); the two refactored engine call sites (`playerStrike`, `castSpell`) draw exactly as many dice as their pre-refactor inline rules did, confirmed by `npm test`'s byte-identical parity suite and this plan's own draw-count identity test.

**serialized_field_impact:** none — no new field. `combat.target` keeps its exact engine-path values in every parity fixture; the shell's post-dispatch call is a presentation mutation that assigns the same value the engine's own lazy rule would assign at the next strike/cast, so `git hash-object test/parity/prototype-master.js.txt` and every fixture stayed byte-identical.

## Next Phase Readiness

- Plans 04-06 of Phase 36 (Cutthroat murder risk, dismissJoiner, Company panel) are independent of this plan and land in any wave order per the phase's own design.
- `engine/combat.js#normalizeTarget` is now the one place any future combat feature that can kill a targeted foe (new abilities, items, spells from Phases 38-40) should rely on for "the aim never sticks to a corpse" — no new call site is needed at those features' own kill points, since the shell's one post-dispatch hook already covers every dispatch.
- No blockers.

---
*Phase: 36-balance-foundation-effect-timers-small-independent-wins*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (`engine/combat.js`, `engine/magic.js`, `mazeworld.html`, `test/unit/normalizeTarget.test.js`, `test/unit/shell-dead-foe-target.test.js`, this SUMMARY.md); both task commit hashes (`537b934`, `c4dedc9`) found in `git log --oneline --all`.
