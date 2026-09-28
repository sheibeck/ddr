---
phase: 74-roll-display-modifier-honesty
plan: 07
subsystem: ui
tags: [condition-chips, roll-display, presentation, bridge]

# Dependency graph
requires:
  - phase: 74-04
    provides: src/browser/rollOdds.js#heroHitOdds, src/browser/rollRange.js's ONE formatter (toHitText/signedText/playerDelta/ROLLERS)
provides:
  - src/browser/conditionEffects.js (conditionEffectText, WHAT_IF, CONDITION_EFFECT_COPY) — the hero condition chip's measured to-hit effect
  - window.__mzConditionEffect bridge (mazeworld.html module script, registered in src/browser/bridge.js and docs/SHELL-MODULES.md)
  - mazeworld.html classic paintConditions' chip-tap card leading with the measured effect sentence
affects: [74-08 (consistency guard test / ROLL-LEDGER closure), 77 (CMBUI-13 effect indicators reuse WHAT_IF/conditionEffectText)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measure, never restate: a condition chip's effect is read by diffing heroHitOdds(live)/heroHitOdds(whatIf) and foeToHitVs(live)/foeToHitVs(whatIf), where whatIf is a SHALLOW copy of state with only that one condition dropped — never a re-derived formula."
    - "Generic item-source what-if: any chip descriptor carrying `source` (a live item-effect record) falls through to a single generic builder that removes `item:<source>` from a copied c.timers, rather than special-casing every item kind."

key-files:
  created:
    - src/browser/conditionEffects.js
    - test/unit/conditionEffects.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/status-chit-combat.test.js

key-decisions:
  - "conditionEffectText compares heroHitOdds/foeToHitVs between the live state and a shallow what-if state (never a restated arithmetic formula) so it can never disagree with any other roll surface in the phase."
  - "A die-swap (e.g. a live Acuteness effect) takes priority over a faces-count change when both differ, per the plan's dieSwap/toHitNow branching order."
  - "Chips with no source and no WHAT_IF entry (ward, regen, a spell-sourced might chip, itemCooldown, staffCharges, an unknown key) return null by construction — no special-casing needed, since buildWhatIf simply finds no builder."

patterns-established:
  - "Pattern: any future condition-chip effect (Phase 77's ability timers) adds one WHAT_IF[key] builder rather than inventing a second what-if mechanism."

requirements-completed: [ROLL-02, ROLL-03]

coverage:
  - id: D1
    description: "conditionEffects.js measures each hero chip's to-hit effect (afraid, dazed foeEffect, darkness, senses, mirror, and any live item-sourced chip) against the engine's own heroHitOdds/foeToHitVs, formatted through rollRange.js"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "test/unit/conditionEffects.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every displayed chip modifier is signed from the player's side (a chip that makes foes worse at hitting the hero reads as a plus)"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "test/unit/conditionEffects.test.js#mirror: a plain Human Soldier reads foes needing far more to land a blow"
        status: pass
      - kind: unit
        ref: "test/unit/conditionEffects.test.js#unseen: a live Anklet of Invisibility item effect reads a smaller +2"
        status: pass
    human_judgment: false
  - id: D3
    description: "The chip-tap card (in and out of combat) leads with the measured effect sentence, wired through window.__mzConditionEffect; a chip with no to-hit effect is unchanged"
    requirement: "ROLL-03"
    verification:
      - kind: unit
        ref: "test/unit/status-chit-combat.test.js#(a) combat + Afraid"
        status: pass
      - kind: unit
        ref: "test/unit/bridge-registry.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "On the Pixel 7, tapping the Afraid chip in a fight opens with '−3 to hit (now …)', and tapping a live Anklet of Invisibility chip opens with '+2 vs their swings'"
    verification: []
    human_judgment: true
    rationale: "Requires an on-device tap-and-read confirmation; deferred to the end-of-run device batch per this plan's Human verification note."

duration: 45min
completed: 2026-09-25
status: complete
---

# Phase 74 Plan 07: Condition-chip effect honesty Summary

**Hero condition chips now lead their chip-tap card with a measured, engine-derived effect sentence (e.g. "−3 to hit (now 19–20)."), read by diffing the engine's own heroHitOdds/foeToHitVs between the live state and a shallow what-if state — never a restated formula.**

## Performance

- **Duration:** 45min
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `src/browser/conditionEffects.js` (`conditionEffectText`, `WHAT_IF`, `CONDITION_EFFECT_COPY`): measures each hero condition chip's to-hit effect by diffing `heroHitOdds`/`foeToHitVs` between the live state and a shallow what-if copy with only that one condition dropped, formatted through `rollRange.js`'s one formatter — never a re-derived arithmetic path
- Explicit `WHAT_IF` builders for `afraid`, `foeEffect`, `darkness`, `mirror`, `senses`; a generic item-source builder (`item:<source>` removed from a copied `c.timers`) covers every live item-effect chip (acute, unseen, haste, might, flight, …) without special-casing each kind
- Chips with no measurable to-hit effect (haste, might, ward, regen, flight, item-cooldown/staff-charges chips, a weakening foeEffect, an unrecognized key) correctly read `null` by construction — no special-casing required
- The chip-tap card (mazeworld.html's classic `paintConditions`, both the combat-legal card and the rail line, out of combat) now leads with the bridge's effect sentence followed by "`. `" and then today's unchanged explanation
- The hero sheet's static `#s-hit` placeholder reads "—" like every other sheet placeholder (`renderHeroTab` overwrites it at paint)
- `window.__mzConditionEffect` bridge registered in `src/browser/bridge.js`, regenerated into `docs/SHELL-MODULES.md`, and twinned in `test/unit/harness/shellSandbox.js`
- `test/unit/status-chit-combat.test.js` test (a) re-pinned to the Afraid lead ("−3 to hit (now 9–10)" for that test's level-3 Human Fighter Soldier) followed by `explainCondition(...)`/`CONDITION_EXPLAIN.afraid`; no other test in the file compares an effect-bearing chip's exact tap text, so no further re-pins were needed
- `npm test`: 5962/5962 (5947 baseline + 15 new `conditionEffects.test.js` cases)

## Task Commits

Each task was committed atomically:

1. **Task 1: conditionEffects.js measures each chip's effect against the engine** - `f951194` (feat, tdd)
2. **Task 2: The chip-tap card leads with the effect; the bridge, its registry and the harness twin** - `efc165c` (feat)

_Note: Task 1 was written test-first (its own 15-case suite), so its single commit already includes both the tests and the implementation._

## Files Created/Modified
- `src/browser/conditionEffects.js` - `conditionEffectText`/`WHAT_IF`/`CONDITION_EFFECT_COPY`, the pure presentation module that measures each hero chip's effect
- `test/unit/conditionEffects.test.js` - 15 cases covering every WHAT_IF key, every item-sourced chip, every no-effect chip, and malformed-input/frozen-state safety
- `mazeworld.html` - the `conditionEffectText` import + `window.__mzConditionEffect` bridge (module script); `paintConditions`'s `explainText` local now leads with the bridge's result (classic script); the `#s-hit` placeholder reads "—"
- `src/browser/bridge.js` - the `__mzConditionEffect` registry entry
- `docs/SHELL-MODULES.md` - regenerated via `node tools/bridge-doc.mjs --write` (62 bridge rows)
- `test/unit/harness/shellSandbox.js` - wires `w.__mzConditionEffect = conditionEffectText` next to `w.__mzConditionsOf`
- `test/unit/status-chit-combat.test.js` - test (a) re-pinned to the new Afraid lead + tail text

## Decisions Made
- Followed the plan's exact WHAT_IF key list and generic item-source fallback; no chip needed a bespoke builder beyond the five named keys (afraid/foeEffect/darkness/mirror/senses).
- Where the plan specified the die-swap-vs-faces-change branching order ("A die change gives dieSwap... otherwise a faces change gives toHitNow"), implemented `dieN` comparison first, `faces` comparison second, matching the acute-item test case exactly ("Hit 2–6 (d6)", no toHitNow clause, since foeToHitVs is unaffected by a strike-die swap).

## Deviations from Plan

None - plan executed exactly as written. Every `<behavior>` example in Task 1 and every acceptance-criteria grep in both tasks passed without adjustment; the status-chit-combat.test.js re-pin was the plan's own Task 2 action item, not an unplanned deviation.

## Issues Encountered

`npm run boot:check` fails on this machine with the same pre-existing environment block already tracked in `.planning/STATE.md` (Phase 50 blocker: "0-byte dump, its own `--self-test` fails, reproduces on pre-fix HTML" — an interactive Chrome session appears to swallow the invocation). Reproduced here (`boot-dom.html` is 162 bytes, all three checks FAIL) before any of this plan's edits were staged, confirming it is the known environment issue, not a regression from this plan's changes. `npm test` (the phase's authoritative suite) is fully green.

## Known Stubs

None.

## Threat Flags

None — this plan is presentation-only (chip-tap text), reads only already-computed engine state, introduces no new network/auth/file-access/schema surface.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7, while Afraid in a fight, tap the Afraid chip and confirm the card opens with "−3 to hit (now …)"; with an Anklet of Invisibility running, tap its chip and confirm "+2 vs their swings".

## Next Phase Readiness
- `src/browser/conditionEffects.js`'s `WHAT_IF` map and `CONDITION_EFFECT_COPY` are exported and documented as Phase 77's (CMBUI-13) hook — adding an ability-timer key (Smoke/Sidestep/Battle Roar) there is expected to give those effect indicators their text for free, without inventing a second what-if mechanism.
- Ready for 74-08 (the consistency guard test, the new copy banks in the standing voice scans, and the ROLL-LEDGER display closure).
- No blockers.

---
*Phase: 74-roll-display-modifier-honesty*
*Completed: 2026-09-25*

## Self-Check: PASSED

All created/modified files (`src/browser/conditionEffects.js`, `test/unit/conditionEffects.test.js`, `mazeworld.html`, `src/browser/bridge.js`, `docs/SHELL-MODULES.md`, `test/unit/harness/shellSandbox.js`, `test/unit/status-chit-combat.test.js`, and this SUMMARY) exist on disk. Both task commits (`f951194`, `efc165c`) are present in `git log`.
