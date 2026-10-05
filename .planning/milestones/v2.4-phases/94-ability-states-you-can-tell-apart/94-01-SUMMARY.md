---
phase: 94-ability-states-you-can-tell-apart
plan: 01
subsystem: engine
tags: [abilities, combat, derived-state, ASTATE-04]
requires: []
provides:
  - "abilityState(state, sheet, key) -> { state, roundsLeft, reason }"
  - "ABILITY_UNAVAILABLE_REASONS (frozen)"
  - "singState(state) -> { state, roundsLeft, reason }"
  - "SING_UNAVAILABLE_REASONS (frozen)"
affects: [94-02, 94-03, 94-04, 94-05]
tech-stack:
  added: []
  patterns: ["one derived ladder read by both the refusal path and the view", "pure, nothing serialized"]
key-files:
  created: [test/unit/ability-state.test.js]
  modified: [engine/abilities.js, engine/combat.js, docs/ABILITIES.md]
key-decisions:
  - "Rung order is the ladder's own: pending (notFought) first, before ownership, so abilityState agrees with useAbility for a key the hero does not own"
  - "No class check and no heroOut check inside abilityState"
  - "A Joiner is aimed at the first live foe and its Last Stand reads its live combat ally entry"
requirements-completed: [ASTATE-02, ASTATE-03, ASTATE-04]
status: complete
duration: ~35 min
completed: 2026-10-03
---

# Phase 94 Plan 01: Ability states, engine half Summary

One pure derived `abilityState(state, sheet, key)` (hero or Joiner) and its Sing twin `singState(state)` now hold the refusal ladders, and `useAbility` and `sing()` read them, so a tap and the label can never disagree; every refusal payload, fixture and draw is byte-identical.

BASE (HEAD at plan start): `c1b315399ff98c9470f669cce2dfa48a74e90ee6`.

## Exported names and signatures (later plans import these)

From `engine/abilities.js`:

- `export const ABILITY_UNAVAILABLE_REASONS` : frozen `["notFought", "unknown", "notInCombat", "noTarget", "tooFewFoes", "alreadyOn", "notLowEnough"]`
- `export function abilityState(state, sheet, key)` : returns a fresh `{ state, roundsLeft, reason }`
  - `state`: `"ready" | "recharging" | "unavailable" | "spent"`
  - ready: `roundsLeft 0, reason null`; recharging: `roundsLeft = abilityRoundsLeft(sheet, key)`, `reason "cooldown"`; spent (a `cd: "fight"` ability with a record): `roundsLeft 0, reason "spent"`; unavailable: `roundsLeft 0`, `reason` one of the list above
  - `sheet` is the hero (`state.c`) or a Joiner (`state.party[i]`); pure, no rng, writes nothing (never retargets)

From `engine/combat.js`:

- `export const SING_UNAVAILABLE_REASONS` : frozen `["notFought", "notInCombat", "wrongClass"]`
- `export function singState(state)` : same contract; ready `reason null`; recharging `reason "songResting"`, `roundsLeft = sangAt + SONG_GAP_ROUNDS - round`; spent `reason "sungThisFight"`; unavailable `notFought | notInCombat | wrongClass`. `songReady(state) === (singState(state).state === "ready")` is pinned. `songReady` itself is unchanged.

The view (plans 94-03/94-04) maps these to words in `src/browser/abilityStates.js`. A duration ability (Sidestep, Battle Roar, Riposte, Taunt, Smoke) reads `recharging` while its effect runs (RESEARCH Pitfall 8; an Active state is deferred).

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1 | `c23a5a3d` | `abilityState`, `singState`, both reason lists, `test/unit/ability-state.test.js` (15 tests: reason lists, rung order, no-foes-array, 20 x 15 agreement sweep plus unowned/"nope"/non-string keys, purity, payload shapes and key order, retarget order, hero-vs-Joiner aim, Joiner pins, pickMemberAbility soundness sweep, Sing pins) |
| 2 | `83c75ea1` | `useAbility` and `sing()` read the new functions; module header updated; `docs/ABILITIES.md` "## Phase 94: ability states (ASTATE-04)" |

## Engine gate proof

- Payload comparison: a scratch script (kept outside the repo in the scratchpad, never committed) ran 429 scenarios (every one of the 20 abilities plus "nope" and 42 across 19 hand-built fight states, and 12 Sing states), recording every event array, any throw and the full resulting state JSON (rngState, timers, combat.target). before.json (captured on Task 1's tree, ladders still original) and after.json (after the refactor) are byte-identical: `diff` printed nothing, `cmp` agreed, 899 events and about 1 MB compared.
- No fixture moved: `git diff --stat c1b31539 -- test/parity test/determinism test/roundtrip test/unit/roll-high-state-pins.test.js test/unit/abilities.test.js test/unit/bard-song.test.js test/unit/party-abilities.test.js` prints nothing; `test/parity/prototype-master.js.txt` untouched; `test/parity/harness/comparables.js` untouched (nothing serialized, so no `*Comparable()` carve-out); no new event type.
- `abilityShortfall`, `abilityTargetShortfall`, `abilityUnavailableReason`, `abilityRoundsLeft` are byte-identical (no diff line touches them).
- Task 1 removed zero lines from `engine/abilities.js`.

## Full suite

`npm test`: 10241 tests, 10233 pass, 0 fail, 8 skipped (baseline 10226 / 10218 / 0 / 8; +15 = the new file). Targeted run (the 10 plan test files) 308/308; parity + determinism + roundtrip 131/131.

## Visible behaviour change to name later

- Last Stand now reads its hp gate: it has always refused `notLowEnough` above a quarter hp, but the menu never showed it. It is a real rung of `abilityState`, so the row will show it (RESEARCH Finding F4, intended).
- Malformed state only: a combat object with no `foes` array used to throw inside `useAbility` for a foe ability (`liveFoes`); it now refuses `noTarget`. No real state has this shape.

## Joiner note

No surface lists a Joiner's abilities (RESEARCH Finding F1, orchestrator ruling), so Joiner states are engine-pinned in tests only; no Joiner UI was added. A Joiner is aimed at the first live foe (what `alliesTurn` passes) and its Last Stand reads its `combat.allies` entry (matched by `partyIdx`), else its sheet.

## Deviations from Plan

None - plan executed as written. Notes: the pickMemberAbility soundness sweep needed an extra Fighter sheet owning only Last Stand, because with the full Fighter list the damage policy always reaches Kata first and Last Stand is never picked (test-design detail, inside Task 1).

## Known Stubs

None.

## Threat Flags

None: no new endpoint, auth path, file access or schema surface.

## Self-Check: PASSED

- `engine/abilities.js`, `engine/combat.js`, `test/unit/ability-state.test.js`, `docs/ABILITIES.md` exist and carry the new exports/section.
- Commits `c23a5a3d` and `83c75ea1` exist and each ends with both trailers.
