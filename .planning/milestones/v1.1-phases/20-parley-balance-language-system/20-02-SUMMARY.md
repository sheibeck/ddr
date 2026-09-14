---
phase: 20-parley-balance-language-system
plan: 02
subsystem: engine
tags: [combat, parley, fluency, derived, narration, ui-mirror, deliberate-divergence, node-test]

requires: ["20-01"]
provides:
  - "engine/derived.js exports killSpFor(c, f, roll) and fluency(c) — pure, cycle-free leaf helpers"
  - "engine/combat.js: killFoe routes through killSpFor byte-identically; canParley/parley rewritten per D-01..D-12/D-20; foeTurn need/mNeed += 1 on C.parleyInsulted"
  - "src/browser/eventNarration.js: parleyInsulted/parleyExhausted entries, parleyRolled fluency annotation, parleyRefused canon grudge line, goldGained parley branch"
  - "mazeworld.html classic fluency()/canParley() mirror the engine line for line (D-17); dead classic parley() untouched"
affects: ["20-03-parley-balance-language-system"]

tech-stack:
  added: []
  patterns: ["shared pure leaf helper consumed by two call sites so a payout ratio is structural, not a second formula (killSpFor)", "single fluency(c) source of truth feeding both an availability gate and a bonus term", "post-draw need/mNeed arithmetic for a persistent combat debuff, matching the existing f.blind/foeToHitPenalty precedent", "hand-maintained classic-script mirror of an engine gate function, kept in lockstep in the same commit"]

key-files:
  created:
    - test/unit/fluency.test.js
  modified:
    - engine/derived.js
    - engine/combat.js
    - test/unit/combat.test.js
    - src/browser/eventNarration.js
    - test/voice/safety-scan.test.js
    - mazeworld.html

key-decisions:
  - "killSpFor/fluency homed in engine/derived.js directly after resistRoll (before levelFromSP) — the established cycle-free-leaf precedent in this file"
  - "canParley's decision order: !state.combat -> parleyTried -> Walking Dead -> fluency<2-vs-Magical -> Con Artist/Woodsman/Bard -> fluency>=1-and-talkable -> Wilmsry(non-Magical) -> Elven-vs-Humans -> false"
  - "parley's decision order: !C -> parleyTried(push parleyExhausted) -> !canParley -> LO-03 zero-foes guard -> wilmsryVsMagical refusal(before parleyTried is set) -> C.parleyTried=true -> bonus/need/roll -> success(killSpFor x0.5, wilmst on d6===6) or failure(parleyInsulted)"
  - "C.parleyTried/C.parleyInsulted are lazily written (never initialised in startCombat) — startCombat's md5 stays 29ee82224a85976c14ccef8166763427, pursuitStrike's stays be9895e12352bc80017542871c3e6181, both pinned exactly as CONTEXT.md's D-16/D-19 required"
  - "eventNarration.js's parleyRolled-comment avoids repeating the literal phrase \"for the tongue\" a second time, keeping the plan's grep -c 'for the tongue' gate at exactly 1 (mirrors 20-01's stripParleyDivergence naming-collision precedent)"
  - "mazeworld.html's classic canParley()/fluency() pair edited in the same commit as the engine rewrite (D-17); the dead classic parley() beside it is untouched and re-verified hash-identical (da8097f5e4101da9cf971e28009f0cf3)"

patterns-established:
  - "A payout ratio that must never exceed a second, independently-tuned formula is made structural by extracting ONE shared pure helper both call sites invoke, rather than two formulas a future change could silently desync (killSpFor)."
  - "A gate and its bonus term that read the same underlying capability (skill + item) share ONE derived helper (fluency), read twice, never re-derived inline in either call site."

requirements-completed: [PARLEY-01, PARLEY-02, PARLEY-03, PARLEY-04, LANG-01, LANG-02]

coverage:
  - id: D01-D02
    description: "killSpFor extracted from killFoe's inline formula (byte-identical draw/result); parley's SP payout is now round(combatEquivalent x 0.5) where combatEquivalent sums killSpFor per live foe — structurally half of the kill-equivalent, never a second formula"
    requirement: PARLEY-01
    verification:
      - kind: unit
        ref: "test/unit/fluency.test.js (2160-case equivalence matrix + killFoe integration pin, 6 tests)"
        status: pass
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (30/30)"
        status: pass
    human_judgment: false
  - id: D03-D04
    description: "Humans wilmst bonus now fires on d6===6 (was >=4); draw shape unchanged except the conditional 4th draw, which correctly stops firing when the check no longer fires"
    requirement: PARLEY-01
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js parley success test (rng [10,3,2], wilmst check draws 2, does not fire)"
        status: pass
    human_judgment: false
  - id: D05
    description: "One parley attempt per encounter via C.parleyTried; a re-sent action gets parleyExhausted with zero draws and no state change"
    requirement: PARLEY-02
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js \"D-05: the second parley...\" test"
        status: pass
    human_judgment: false
  - id: D06-D20
    description: "A failed parley sets C.parleyInsulted; both foeTurn to-hit sites (hero need, member mNeed) widen by exactly +1 as post-draw arithmetic; the narrated roll is the literal die"
    requirement: PARLEY-02
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js \"D-06/D-20: parleyInsulted widens...\" test; test/unit/foe-turn-draw-count.test.js unchanged (FID-02 pins)"
        status: pass
    human_judgment: false
  - id: D07-D08
    description: "Con Artist bonus +4 (need 13 at even level vs a solo foe, 65%); need clamped to <= 17 for any stacked bonus combo"
    requirement: PARLEY-03
    verification:
      - kind: unit
        ref: "test/unit/combat.test.js Con Artist success test asserts e.need === 13 && e.fluency === 0"
        status: pass
    human_judgment: false
  - id: D09-D11
    description: "fluency(c) returns 0/1/2 for neither/skill-or-Helm/both; feeds both canParley's gate (TALKATIVE at 1, +Magical at 2) and parley's +2xfluency bonus term; Walking Dead refused unconditionally"
    requirement: "LANG-01, LANG-02"
    verification:
      - kind: unit
        ref: "test/unit/fluency.test.js D-09 tests; test/unit/combat.test.js gate-matrix additions (Walking Dead, fluency-2 Con Artist vs Magical)"
        status: pass
    human_judgment: false
  - id: D12
    description: "The dead parleyRefused wilmsryVsMagical branch is reachable (fluency-2 Wilmsry vs Magical) and does not consume C.parleyTried"
    requirement: PARLEY-04
    verification:
      - kind: unit
        ref: "grep -c 'reason: \"wilmsryVsMagical\"' engine/combat.js == 1; the refusal line precedes C.parleyTried = true in source order"
        status: pass
    human_judgment: false
  - id: D14
    description: "parleyInsulted/parleyExhausted narrated, parleyRolled shows the fluency contribution, parleyRefused narrates the canon grudge line, goldGained's parley branch reads as a rare payout — all family-friendly under the voice safety scan"
    requirement: "LANG-01"
    verification:
      - kind: unit
        ref: "node --test test/unit/formatEventsCoverage.test.js test/voice/safety-scan.test.js (12/12 pass)"
        status: pass
    human_judgment: false
  - id: D16-D17
    description: "startCombat and pursuitStrike stay hash-identical to 04eb229; mazeworld.html's LIVE classic canParley()/fluency() mirror the engine line for line; the dead classic parley() and both call sites are untouched"
    requirement: "PARLEY-02, LANG-02"
    verification:
      - kind: other
        ref: "md5 pins: startCombat 29ee82224a85976c14ccef8166763427, pursuitStrike be9895e12352bc80017542871c3e6181, classic parley() da8097f5e4101da9cf971e28009f0cf3 — all matched"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-14
status: complete
---

# Phase 20 Plan 02: Parley Rewrite (Engine, Narration, UI Mirror) Summary

**The whole Phase 20 rules change landed in `engine/combat.js`/`engine/derived.js` and both its presentation mirrors — payout is now structurally half of `killFoe`'s own combat-equivalent, Con Artist's odds and the Humans wilmst bonus are retuned, one parley attempt per encounter with insulted aggro on failure, fluency (Language skill + Helm of Knowledge) drives both the availability gate and the bonus term, and the dead Wilmsry-vs-Magical refusal is reachable — with `npm test` at 893/893 and parity 30/30, no carve-out beyond 20-01's already-landed seed-303 stripper.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-14
- **Tasks:** 3 completed
- **Files modified:** 7 (6 modified, 1 created)

## Accomplishments

- Added `export function killSpFor(c, f, roll)` and `export function fluency(c)` to `engine/derived.js` (directly after `resistRoll`, mirroring its JSDoc shape) — both pure, cycle-free leaf helpers. `killFoe` now calls `killSpFor(c, f, roll)` at the exact same draw site with the exact same two-step raw/mul arithmetic — every combat/magic fixture stays byte-identical (parity 30/30, `git diff --quiet 04eb229 -- test/parity/prototype-master.js.txt test/parity/fixtures` exits 0).
- Added `test/unit/fluency.test.js` (6 tests): the 2160-case `killSpFor` equivalence matrix (every race x sub x level x foe-level x d6, plus 5 spot pins including the seed-303 combat-equivalent 13), the fluency 0/1/1/2 tier matrix, purity/arity checks, and a `killFoe` integration pin proving the extraction pays exactly `killSpFor`'s number.
- Rewrote `canParley(state)` in `engine/combat.js` to the exact locked decision order: `!state.combat` → `C.parleyTried` (D-05) → `Walking Dead` unconditional (D-11) → `fluency(c) < 2` vs `Magical` (D-11) → Con Artist/Woodsman/Bard subclass checks (unchanged) → `flu >= 1 && talkable.includes(t)` where `talkable` widens to include `Magical` at `flu >= 2` (D-10/D-11, replaces the old boolean Language-OR-Helm line) → Wilmsry non-Magical (unchanged) → Elven-vs-Humans (unchanged) → `false`.
- Rewrote `parley(state, rng, events)`: `C.parleyTried` early-out pushes `parleyExhausted` with zero draws (D-05); the `wilmsryVsMagical` refusal (now reachable via a fluency-2 Wilmsry, D-12) fires BEFORE `C.parleyTried = true` so a refusal never consumes the attempt; bonus is `Con Artist +4` (was +6, D-07) + Woodsman +3 + Wilmsry +4 + Elven-vs-Humans +3 + `2 * fluency(c)` (D-10) + `level - top`; `need = Math.min(9 + bonus, 17)` (D-08 clamp); `parleyRolled` carries a `fluency` field (D-14); success pays `round(combatEquivalent * 0.5)` where `combatEquivalent` sums `killSpFor(c, f, rng.d(6))` per live foe (D-01/D-02, retiring the literal `x 2.5`); the Humans wilmst bonus now fires on `rng.d(6) === 6` (D-03, was `>= 4`) with the amount formula untouched; failure sets `C.parleyInsulted = true` and pushes `parleyInsulted` (D-06) before `afterPlayerAction`.
- Added `if (C.parleyInsulted) mNeed += 1;` at `engine/combat.js:1256` (member branch) and `if (C.parleyInsulted) need += 1;` at `engine/combat.js:1279` (hero branch) in `foeTurn` — post-draw arithmetic only, matching the file's own `f.blind`/`foeToHitPenalty` precedent, zero extra draws. `test/unit/foe-turn-draw-count.test.js`'s FID-02 pins are untouched (`git diff --quiet 04eb229` on that file exits 0) because that scenario never calls `parley`.
- Verified `startCombat` and `pursuitStrike` are still hash-identical to `04eb229` (`29ee82224a85976c14ccef8166763427` / `be9895e12352bc80017542871c3e6181`) — no flag initialisation was added anywhere; `C.parleyTried`/`C.parleyInsulted` are lazily written only inside `parley()`/`foeTurn`.
- Extended `test/unit/combat.test.js`: the gate-matrix test's Magical case now reads "Magical needs fluency 2 (D-11); fluency 0 here" plus two new assertions (Con Artist vs Walking Dead → false; a fluency-2 Con Artist vs Magical → true); the Con Artist success/failure tests were recomputed for the new formulas (need 13, sp 8, `e.fluency === 0`) and the failure test now asserts `parleyInsulted` lands after `parleyFailed` and both flags are set; added a D-05 exhausted-retry test and a D-06/D-20 insulted-`+1` test (baseline miss at need 5 vs. insulted hit at need 6, same literal roll 6, dmg 4).
- Rewrote `EVENT_NARRATION.parleyRefused` to narrate the canon grudge line `"Magic Users hate the Wilmsry. There is nothing to discuss."` when `e.reason === "wilmsryVsMagical"` (else unchanged); extended `parleyRolled` to append `" (+N for the tongue)"` when `e.fluency` is truthy; added `parleyInsulted`/`parleyExhausted` entries; extended `goldGained` to read `"One of them, against the odds, pays you to forget the whole thing. +N wilmst."` when `e.why === "parley"`.
- Extended `test/voice/safety-scan.test.js`'s `BASE_EVENT` (`fluency: 2`, `why: "parley"`) and `BRANCH_TOGGLES` (`{ fluency: 0 }`, `{ why: null }`, `{ reason: "wilmsryVsMagical" }`) so every new ternary branch renders under the family-friendly scan; `formatEventsCoverage.test.js`'s bidirectional guard is green (both new event types narrated, no orphan entries).
- Rewrote `mazeworld.html`'s classic (LIVE) `canParley()` and added a new classic `fluency()` helper, mirroring `engine/combat.js#canParley` line for line, with a Phase 20/D-17 comment explaining the mirror; the dead classic `parley()` beside it is confirmed byte-identical (`da8097f5e4101da9cf971e28009f0cf3`), and both live call sites (`#a-talk` button render, the `"5"` keybinding) are unchanged. CRLF line endings are preserved throughout the file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fluency(c)/killSpFor(c,f,roll) to derived.js, route killFoe, pin in fluency.test.js** - `66f6706` (feat)
2. **Task 2: Rewrite canParley/parley (D-03..D-08, D-10..D-12) + foeTurn insulted +1** - `b4e7ab1` (feat)
3. **Task 3: Narrate the new events (D-14) + mirror fluency()/canParley() into mazeworld.html (D-17)** - `15db4ae` (feat)

_Note: no TDD tasks in this plan._

## Files Created/Modified
- `engine/derived.js` - `killSpFor(c, f, roll)` and `fluency(c)` exports (Task 1)
- `engine/combat.js` - `killFoe` via `killSpFor`; `canParley`/`parley` rewrite; `foeTurn` insulted `+1` at both to-hit sites (Tasks 1-2)
- `test/unit/fluency.test.js` - new, 6 tests (Task 1)
- `test/unit/combat.test.js` - gate-matrix + parley test updates, 2 new tests (Task 2)
- `src/browser/eventNarration.js` - `parleyInsulted`/`parleyExhausted` entries; `parleyRolled`/`parleyRefused`/`goldGained` changes (Task 3)
- `test/voice/safety-scan.test.js` - `BASE_EVENT`/`BRANCH_TOGGLES` additions (Task 3)
- `mazeworld.html` - classic `fluency()` + rewritten classic `canParley()` (Task 3)

## Decisions Made
- `killSpFor`/`fluency` placed directly after `resistRoll` in `engine/derived.js`, matching that helper's exact JSDoc shape (single cycle-free leaf, explains WHY it lives here).
- `canParley`'s decision order and `parley`'s ordering (refusal before `parleyTried` write) followed RESEARCH.md's verified AFTER block exactly — no deviation needed, every trace matched the current source on first read.
- `C.parleyTried`/`C.parleyInsulted` are lazily written (never initialised in `startCombat`) per CONTEXT.md's "Claude's Discretion" — confirmed by the `startCombat`/`pursuitStrike` md5 pins staying exact.
- `eventNarration.js`'s explanatory comment above `parleyRolled` avoids repeating the literal phrase "for the tongue" a second time, keeping the plan's `grep -c 'for the tongue'` gate at exactly 1 (same naming-collision-avoidance trick 20-01 used for `stripParleyDivergence`).
- Exact narration wording (Claude's Discretion per CONTEXT.md): `parleyInsulted` → "You have made it personal. They will be aiming with real intent from here on."; `parleyExhausted` → "You already said your piece. They are done listening; try the pointy end."; `parleyRolled`'s fluency suffix → " (+N for the tongue)"; `goldGained`'s parley branch → "One of them, against the odds, pays you to forget the whole thing. +N wilmst."

## Deviations from Plan
None — plan executed exactly as written. All three tasks' acceptance criteria (grep gates, md5 pins, unit tests, parity suite, `npm test` count, `git diff --quiet` engine-frozen-file checks) passed without needing a fix-up pass.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Evidence

- `npm test`: **893/893** passing (886 baseline + 5 `fluency.test.js` + 2 new `combat.test.js` tests), ~12s.
- `node --test "test/parity/**/*.test.js"`: **30/30** passing — the seed-303 parley scenario diverges only in `c.sp`/`c.gold`, already absorbed by 20-01's `stripParleyDivergence` carve-out at both replay sites; no new carve-out needed.
- `git diff --quiet 04eb229 -- test/parity/prototype-master.js.txt test/parity/fixtures test/unit/foe-turn-draw-count.test.js package.json package-lock.json` exits 0 (frozen files and the FID-02 pins are untouched; no dependency changes).
- md5 pins matched exactly: `startCombat` block `29ee82224a85976c14ccef8166763427`; `pursuitStrike` block `be9895e12352bc80017542871c3e6181`; mazeworld.html's dead classic `parley()` `da8097f5e4101da9cf971e28009f0cf3`.
- `node -e "..."` CRLF check on `mazeworld.html` exits 0 — no mixed line endings introduced.

## Next Phase Readiness
20-03 can now write `test/unit/parley.test.js` (or extend further), `test/unit/parley-button-mirror.test.js` (replaying the engine's availability matrix through the extracted classic `mazeworld.html` functions), fill `docs/PARLEY-REBALANCE.md`'s AFTER readout and Comparison section against this plan's landed formulas, add the `test/parity/FIXTURE-INVENTORY.md` Phase 20 before/after table for seed 303 (need 19→17, sp 13→7, gold 250→50 per the RESEARCH.md-computed table, now confirmed live by this plan's `canParley`/`parley` rewrite), and run `requirements mark-complete` for PARLEY-01/02/03/04/LANG-01/LANG-02 once the phase's own final gate gives the go-ahead. `npm test` is green at 893/893; parity remains byte-identical to `04eb229` outside the one named, documented, scenario-scoped carve-out from 20-01.

---
*Phase: 20-parley-balance-language-system*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: engine/derived.js
- FOUND: engine/combat.js
- FOUND: test/unit/fluency.test.js
- FOUND: test/unit/combat.test.js
- FOUND: src/browser/eventNarration.js
- FOUND: test/voice/safety-scan.test.js
- FOUND: mazeworld.html
- FOUND: .planning/phases/20-parley-balance-language-system/20-02-SUMMARY.md
- FOUND commit: 66f6706
- FOUND commit: b4e7ab1
- FOUND commit: 15db4ae
