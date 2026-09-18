---
phase: 40-spell-rework
plan: 03
subsystem: engine
tags: [spell-system, condition-chips, initiative, scroll-scribing, parity-declared-divergences]

# Dependency graph
requires:
  - phase: 40-spell-rework plan 01
    provides: "content/spells.js's 33-row niche/flag contract; Sense Presence's txt states the 'till your next fight ends' expiry"
  - phase: 40-spell-rework plan 02
    provides: "engine/magic.js's data-flag-driven kind branches; the c.timers/foeTurn tail shape Plan 03's endCombat expiry lines slot beside"
provides:
  - "engine/derived.js#conditionsOf: four new chips (mirror/senses/regen/foresight), fixed order after ward, before flight"
  - "engine/combat.js#rollInitiative: c.senses waives every forced foe-first rule (Samurai/Fridgian slow/Knight-vs-big-foe/Court Mage round 1); the two d20s still always drawn"
  - "engine/combat.js#fight: combatJoined.senses (additive, only when c.senses decided the win)"
  - "engine/combat.js#endCombat: regenFaded/sensesFaded/mirrorFaded expiry narration for a still-running effect, before the existing unconditional resets"
  - "engine/magic.js#readScroll: the copy-to-grimoire gate is now exactly canCast's own two checks; scrollTooAdvanced { spell, need, have, school } on failure, falls through to the existing free-cast path"
  - "src/browser/{eventNarration,toasts,rail}.js: sensesFaded/regenFaded/scrollTooAdvanced fully narrated; combatJoined's senses branch narrated"
  - "test/unit/spell-utility.test.js (new, 29 tests)"
affects: [40-04-map-the-floor-refog, 40-05-shell-close]

tech-stack:
  added: []
  patterns:
    - "conditionsOf's mirror/senses/regen/foresight chips copy the pre-existing might/ward precedent exactly — a pure if-block per field, no new serialized state, no comparables carve-out needed"
    - "rollInitiative's forced-foe-first clause gains one more &&-guarded term (!c.senses) alongside the existing !foreseen — a branch change, never a draw-count change, so every existing initiative pin not involving senses stays byte-identical"
    - "readScroll's scribe gate is now literally canCast's own two checks (spellLevelFor <= level && level >= schoolGate) instead of a narrower, buggier inline copy — the scroll bug closes by reuse, not by inventing a third gate function"

key-files:
  created:
    - test/unit/spell-utility.test.js
  modified:
    - engine/derived.js
    - engine/combat.js
    - engine/magic.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - test/unit/conditions.test.js
    - test/unit/combat.test.js
    - test/unit/cast-refusals.test.js
    - docs/USABLE-FEATURES-AUDIT.md
    - docs/SPELLS.md
    - test/parity/FIXTURE-INVENTORY.md

key-decisions:
  - "conditionsOf's four new chips sit in a FIXED order after ward, before flight (mirror -> senses -> regen -> foresight) — matches the plan's own must_haves ordering exactly, verified by three separate order-pin tests (conditions.test.js x2, spell-utility.test.js x1)"
  - "combatJoined's senses key is additive and conditional (spread only when c.senses is truthy AND first === 'you') so a plain win, or a senses-carrying character who still lost the fair roll, keeps the byte-identical pre-Phase-40 event shape — no fixture moves"
  - "endCombat's three new expiry pushes happen BEFORE the existing unconditional resets (regen=false/ward=null/mirror=0/senses=0), in the plan-specified order regenFaded -> sensesFaded -> mirrorFaded, then the existing combatEnded — a mirror that already faded mid-fight via the per-foeTurn countdown never double-narrates since it is already 0 by the time endCombat runs"
  - "readScroll's need payload is Math.max(spellLevelFor, schoolGate) — the higher of the two checks canCast itself makes, so scrollTooAdvanced never understates how far off the caster is"
  - "Task 1 and Task 2 were built and fully verified together in one working-tree pass (both plan tasks touch adjacent hunks in the same three narration files), then split into two atomic commits by temporarily reverting engine/magic.js, test/unit/cast-refusals.test.js, docs/USABLE-FEATURES-AUDIT.md, and Task 2's narration hunks to HEAD, re-running the full Task 1 verify suite + npm test green in that intermediate state, committing Task 1, then restoring Task 2's changes verbatim and re-verifying before committing Task 2 — both commits are independently green, not just the combined end state"

requirements-completed: [SPELL-02, SPELL-07]

coverage:
  - id: D1
    description: "Mirror Self, Sense Presence, Regeneration, and an armed Sense Danger each surface a conditionsOf chip (mirror/senses/regen/foresight) in the fixed order after ward, before flight — none of the ten utility kinds is a dead pick"
    requirement: "SPELL-02"
    verification:
      - kind: unit
        ref: "test/unit/spell-utility.test.js (7 conditionsOf tests); test/unit/conditions.test.js (3 updated/new order-pin tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sense Presence means something in the engine: while c.senses is up no forced foe-first initiative rule applies (the two d20s still always drawn); it lasts until the next fight ends and its expiry narrates sensesFaded (Regeneration likewise regenFaded; a still-running mirror narrates mirrorFaded when the fight ends)"
    requirement: "SPELL-02"
    verification:
      - kind: unit
        ref: "test/unit/spell-utility.test.js (rollInitiative/fight/endCombat sections, 10 tests); test/unit/combat.test.js (senses-initiative pin beside the existing Samurai pin)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A scroll is scribed into a Magic User's grimoire ONLY when canCast's two gates already pass; otherwise scrollTooAdvanced { spell, need, have, school } names the level needed and the scroll is cast once for free — a scribed spell is therefore always castable immediately"
    requirement: "SPELL-07"
    verification:
      - kind: unit
        ref: "test/unit/spell-utility.test.js (9 readScroll tests); test/unit/cast-refusals.test.js (scrollTooAdvanced case)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Old saves with a scribed-but-uncastable spell keep it; canCast refuses with the existing spellAboveLevel/spellSchoolLocked naming the level (no migration needed)"
    requirement: "SPELL-07"
    verification:
      - kind: unit
        ref: "test/unit/spell-utility.test.js#tolerant proof: an old save's scribed-but-uncastable grimoire entry refuses cleanly"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every new event type has EVENT_NARRATION + TOAST_FOR + RAIL_FAMILY entries and passes the voice scan; every parity fixture is byte-identical (the scroll scenario's Wizard has no gated school — measured)"
    verification:
      - kind: unit
        ref: "npm test (2773/2773, # fail 0); test/unit/toastsCoverage.test.js, test/unit/formatEventsCoverage.test.js, test/voice/safety-scan.test.js; test/parity/magic-parity.test.js"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-18
status: complete
---

# Phase 40 Plan 03: Utility Visibility + Scroll Fix Summary

**Four new `conditionsOf` chips (mirror/senses/regen/foresight) make every previously-invisible utility spell observable; Sense Presence's "never surprised" gets a real initiative-side effect that waives every forced foe-first rule; `readScroll`'s scribe gate now reuses `canCast`'s own two checks, closing five reachable stuck-grimoire cases with a `scrollTooAdvanced` refusal.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 3
- **Files modified:** 12 (1 new, 11 modified)

## Accomplishments

- `engine/derived.js#conditionsOf` gains four chips — `mirror { remaining }`, `senses` (flat boolean), `regen` (flat boolean), `foresight` (flat boolean) — in a fixed order after `ward`, before `flight`, copying the pre-existing `might`/`ward` precedent exactly. Pure reads of fields the engine already writes; no new serialized state, no comparables carve-out.
- `engine/combat.js#rollInitiative`: Sense Presence's canon "never surprised" now has a real initiative-side effect — while `c.senses` is truthy, the forced foe-first clause (Samurai/Fridgian slow/Knight-vs-big-foe/Court Mage round 1) is waived and the character's own d20 pair decides the roll fairly. The two d20s are still always drawn (a branch change, never a draw-count change). `fight()`'s `combatJoined` event gains an additive `senses: true` key, spread in only when `c.senses` is up AND it is the reason the roll went the hero's way.
- `engine/combat.js#endCombat`: narrates `regenFaded`/`sensesFaded`/`mirrorFaded` (in that order) for any of the three utility effects still running when the fight ends, before the existing unconditional resets wipe them. A mirror that already faded mid-fight (the existing per-foeTurn countdown) never double-narrates.
- `engine/magic.js#readScroll`: the copy-to-grimoire condition is now exactly `canCast`'s own two checks (`spellLevelFor(c.sub, sp) <= c.level && c.level >= schoolGate(c.sub, sp.s)`) instead of the old, buggier `sp.lvl <= c.level` (which never checked the school gate at all). A scribed spell is therefore always castable immediately. When the checks fail, `scrollTooAdvanced { spell, need, have, school }` names the level needed (the higher of the two checks) and the scroll still casts itself once for free, unchanged. Closes five reachable level-1 stuck-grimoire cases: Warlock+Heal, Court Mage+Map the Floor, Apprentice+Map the Floor, Illusionist+Shield, Summoner+Freeze.
- `src/browser/{eventNarration,toasts,rail}.js`: `sensesFaded`/`regenFaded`/`scrollTooAdvanced` fully narrated in all three tables; `combatJoined`'s senses branch narrated ("You move first. Nothing gets the jump on you.").
- `test/unit/spell-utility.test.js` (new, 29 tests): every behavior above, measured against the real engine — `conditionsOf` chip presence/absence/order/purity, `rollInitiative`'s senses waiver across every forced-foe-first case, `fight`'s conditional `combatJoined.senses`, `endCombat`'s three expiry lines (individually and combined, in order), narration coverage, and the full `readScroll` gate matrix including the tolerant old-save proof.
- `docs/SPELLS.md`'s "Utility visibility and scrolls (Plan 03)" section closes the ten-kind utility audit table and documents both rules changes; `docs/USABLE-FEATURES-AUDIT.md` and `test/parity/FIXTURE-INVENTORY.md` gain their matching sections.

## Task Commits

1. **Task 1: Utility chips (mirror/senses/regen/foresight), Sense Presence's initiative meaning, expiry narration** - `2557f34` (feat)
2. **Task 2: Scroll scribing aligned with canCast; scrollTooAdvanced names the level; tolerant old-grimoire proof** - `b52354f` (feat)
3. **Task 3: Ledger "Utility visibility and scrolls" section, fixture check, plan gate** - `6369c56` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `engine/derived.js` — `conditionsOf`'s four new chips + extended JSDoc
- `engine/combat.js` — `rollInitiative`'s senses waiver; `fight`'s `combatJoined.senses`; `endCombat`'s three expiry lines
- `engine/magic.js` — `readScroll`'s scribe gate + `scrollTooAdvanced`
- `src/browser/eventNarration.js`, `toasts.js`, `rail.js` — `sensesFaded`/`regenFaded`/`scrollTooAdvanced` narrated; `combatJoined`'s senses branch
- `test/unit/spell-utility.test.js` (new, 29 tests) — the full Task 1 + Task 2 TDD suite
- `test/unit/conditions.test.js` — three order-pin tests extended/added for the four new chips
- `test/unit/combat.test.js` — a senses-initiative case beside the existing Samurai pin
- `test/unit/cast-refusals.test.js` — one scroll case naming `scrollTooAdvanced`
- `docs/USABLE-FEATURES-AUDIT.md` §4 — the scroll scribing gate documented beside the existing refusal vocabulary
- `docs/SPELLS.md` — "Utility visibility and scrolls (Plan 03)" section
- `test/parity/FIXTURE-INVENTORY.md` — "Plan 03" section (zero fixture moves, measured)

## Decisions Made

See frontmatter `key-decisions` — the fixed chip order, `combatJoined.senses`'s additive/conditional spread, `endCombat`'s expiry-before-reset ordering, `scrollTooAdvanced`'s `Math.max` need payload, and the two-commit split process (built together, verified independently at each commit boundary) are all recorded there with rationale.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<behavior>` specs (exact chip shapes, exact event payloads, exact draw-count invariants) were precise enough that the implementation matched on the first pass; no Rule 1/2/3 auto-fixes were needed.

## Issues Encountered

None. The one process note worth recording: Task 1 and Task 2 both touch adjacent hunks in the same three narration files (`eventNarration.js`/`toasts.js`/`rail.js`), so after building and fully verifying both together, the commits were split by temporarily reverting Task 2's specific hunks (via `git checkout -- <file>` for cleanly-separable files, and targeted `Edit` removals for the shared narration files) to HEAD, re-running the full Task 1 verify suite + `npm test` green in that intermediate state, committing Task 1, then restoring Task 2's changes verbatim and re-verifying before committing Task 2. Both commits are independently green — not just the combined end state — matching the plan's own "atomic per-task commit" requirement without any functional rework.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Per the standing `defer uat to end` instruction, no device steps were taken this plan. Engine-observable checks a Pixel 7 tester should confirm at the end of the run (batched with the other Phase 40 plans):

1. **Cast Mirror Self / Sense Presence / Regeneration outside a fight** — after Plan 05 lands, each shows a condition chip on the map HUD (this plan wires the chip data; Plan 05 renders the shell's copy rows).
2. **With Sense Presence up, a forced-foe-first race (e.g. a Samurai's own "They move first.")** should no longer be forced — the Fight! line should instead read "You move first. Nothing gets the jump on you." whenever the fair roll goes the hero's way.
3. **After the fight ends**, if Sense Presence or Regeneration was still active, the fight log should show "Your senses dull back to normal." / "The wounds stop closing on their own." exactly once.
4. **A level-1 Warlock reading a Heal scroll** should see "Heal needs level 3; you are 1. The scroll reads itself once and crumbles." and then be healed once — Heal should NOT appear in the Hero-tab grimoire afterward.

## Next Phase Readiness

- `conditionsOf`'s chip keys (`mirror`/`senses`/`regen`/`foresight`) and `readScroll`'s `scrollTooAdvanced` event are stable and narrated — Plan 04 (Map the Floor re-fog) can build directly on this without touching utility spells or scrolls again.
- Plan 05 (shell close) has everything it needs on the engine side to paint the four new chips and the Hero-tab grimoire rows; `docs/SPELLS.md`'s ledger documents every number/behavior it will need.
- No blockers. `npm test`: 2773/2773, `# fail 0`. Master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`).

---
*Phase: 40-spell-rework*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `engine/derived.js`, `engine/combat.js`, `engine/magic.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `test/unit/spell-utility.test.js`, `test/unit/conditions.test.js`, `test/unit/combat.test.js`, `test/unit/cast-refusals.test.js`, `docs/USABLE-FEATURES-AUDIT.md`, `docs/SPELLS.md` ("## Utility visibility and scrolls (Plan 03)" present), `test/parity/FIXTURE-INVENTORY.md` ("### Plan 03" present) all exist with the expected content.
Verified in git log: `2557f34`, `b52354f`, `6369c56` all present on `master`.
