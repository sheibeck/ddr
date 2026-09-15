---
phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell
plan: 03
subsystem: engine
tags: [engine, combat, wizard-rule, strikeRefused, narration, flavor, summon, phantom-host, casters-can-act]

# Dependency graph
requires:
  - phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell
    provides: "Plan 01: castableAttackSpells(state)/ATTACK_SPELL_KINDS/spellLevelFor/override-aware canCast (engine/derived.js); Plan 02: rollGrimoire's guaranteed day-one attack spell (Summoner exempt)"
provides:
  - "engine/combat.js#playerStrike — Wizard refuses to melee ONLY while a charge remains AND castableAttackSpells(state) is non-empty; strikeRefused gains spell: <SPELLS[].n>"
  - "src/browser/eventNarration.js#strikeRefused — names the spell in the deadpan voice when present, falls back to the old line otherwise"
  - "content/flavor.js#SUB_NOTE — Wizard/Illusionist/Summoner blurbs restated to match the landed rules, bads kept visible"
  - "test/unit/casters-can-act.test.js — 16 tests locking IDENT-01 (fights book-empty/spent/zero-charge, refusal names the spell, level/school-locked spells never count, non-Wizard never refuses), IDENT-03 (L1 Summon doubled formula in/out of combat, backfire kept, pre-override refusal), IDENT-04 (L1 Phantom Host undoubled, non-Illusionist still refused, strikeDie unchanged, Mirror Self unchanged), and a SUB_NOTE voice guard"
affects: [23-04-freeze-pays-out]

tech-stack:
  added: []
  patterns:
    - "castableAttackSpells(state) is the single Wizard-refusal gate; combat.js never re-declares the attack-kind set (imports it from derived.js)"
    - "strikeRefused stays a single event TYPE with an additive `spell` field, avoiding a new EVENT_NARRATION entry or coverage-guard change"

key-files:
  created:
    - test/unit/casters-can-act.test.js
  modified:
    - engine/combat.js
    - src/browser/eventNarration.js
    - content/flavor.js
    - test/unit/combat.test.js

key-decisions:
  - "playerStrike's Wizard check computes `castable = castableAttackSpells(state)` only when a charge remains (short-circuit order preserved), naming `castable[0].n` (SPELLS order) as the event's `spell` field — never re-implemented the attack-kind definition locally."
  - "IDENT-03/IDENT-04 in-combat Summon/Phantom Host tests use an EMPTY foe list (`fixedCombat([])`) rather than a live foe — castSpell's trailing `if (state.combat) afterPlayerAction(...)` call fires unconditionally after any spell, and an empty foe list lets afterPlayerAction's own `encounterCleared` short-circuit consume ZERO extra rng, keeping the fakeRng sequence exactly [2,3] / [3] as the plan specified, while still exercising the true 'in combat' `C.ally` assignment path (verified via a locally-captured `combat` object reference, since `state.combat` is nulled by the immediately-following `endCombat`)."
  - "The backfire test drives `state.combat = null` (an out-of-combat cast) so the trailing `afterPlayerAction` call is skipped entirely by its own guard — isolating the backfire arithmetic (lvl^2 + d6 = 8) from any foeTurn/rollInitiative rng noise."
  - "Reused test/unit/combat.test.js's exact KILL_SEQUENCE shape ([1,3,4,5,20,1]: strike hit, weapon d6, killFoe's sp/coin/treasure-skip/cooking-skip draws) for every 'the caster still swings' assertion — sub-agnostic since cls=\"Magic User\" never enters the Thief-only backstab/heavy-armor branches, so one lethal-foe rng sequence covers Wizard, Sorcerer, and every grimoire-content variant."

requirements-completed: [IDENT-01, IDENT-03, IDENT-04]

coverage:
  - id: D1
    description: "A Wizard with an empty castable-attack set (utility-only book, attack spells all spent, or zero remaining charges) strikes normally — no strikeRefused event"
    requirement: "IDENT-01"
    verification:
      - kind: unit
        ref: "test/unit/casters-can-act.test.js — 'a Wizard with a utility-only grimoire...', '...has spent every attack spell...', '...at zero remaining charges...'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Wizard refusal names the exact castable attack spell (SPELLS order), and the narration renders that name in the deadpan voice; a level-locked or school-locked attack spell never counts as castable; a non-Wizard caster never refuses"
    requirement: "IDENT-01"
    verification:
      - kind: unit
        ref: "test/unit/casters-can-act.test.js — 'the refusal names the spell...', '...Fireball...', '...school-locked...', '...non-Wizard caster never refuses'; test/unit/combat.test.js — 'a Wizard refuses to melee while an attack spell is castable'"
        status: pass
    human_judgment: false
  - id: D3
    description: "strikeRefused.spell is additive (no new event type, no coverage-guard change) and the EVENT_NARRATION builder tolerates a bare {type} call and a spell-less wizard refusal"
    verification:
      - kind: unit
        ref: "test/unit/formatEventsCoverage.test.js (full run); inline node -e check against EVENT_NARRATION.strikeRefused for all three shapes"
        status: pass
    human_judgment: false
  - id: D4
    description: "A level-1 Summoner's Summon keeps the unchanged doubled formula (ally lvl 2, rounds 2*d4+2) in combat and out of combat, the one-in-eight backfire is kept, and every other sub-class at level 1 is still refused"
    requirement: "IDENT-03"
    verification:
      - kind: unit
        ref: "test/unit/casters-can-act.test.js — the four IDENT-03 tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "A level-1 Illusionist's Phantom Host is castable and UNdoubled (lvl 1, rounds d4+2, no backfire draw), a non-Illusionist at level 1 is still refused, strikeDie's d20 stall through level 2 is unchanged, and Mirror Self is unchanged"
    requirement: "IDENT-04"
    verification:
      - kind: unit
        ref: "test/unit/casters-can-act.test.js — the four IDENT-04 tests"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Wizard, Illusionist, and Summoner SUB_NOTE blurbs state the landed rules in the family-friendly deadpan voice, with every bad still visible; only these three values changed in content/flavor.js"
    verification:
      - kind: unit
        ref: "test/voice/safety-scan.test.js (full run); test/unit/casters-can-act.test.js's SUB_NOTE test; git show --numstat 43b12f0 -- content/flavor.js (3 3)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-14
status: complete
---

# Phase 23 Plan 03: Wizard Fights, Summoner/Illusionist Win at Level 1 Summary

**`playerStrike`'s Wizard refusal now gates on `castableAttackSpells(state)` (not bare charges) and names the spell to cast; a level-1 Summoner's Summon and a level-1 Illusionist's Phantom Host are locked with unit tests against Plan 01's override table; three `SUB_NOTE` blurbs restated to match.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-14T22:14:32Z (per STATE.md, end of Plan 02)
- **Completed:** 2026-09-14T22:26:15Z
- **Tasks:** 3
- **Files modified:** 5 (1 new test file, 4 modified: engine/combat.js, src/browser/eventNarration.js, content/flavor.js, test/unit/combat.test.js)

## Accomplishments

- `engine/combat.js#playerStrike`: the Wizard melee refusal now fires only when a spell charge remains AND `castableAttackSpells(state)` returns at least one legal attack spell (known, level-legal via the override table, school-legal). The refused event carries `spell: castable[0].n`. A `DELIBERATE RULES CHANGE (Phase 23, 2026-09-14, IDENT-01)` comment documents the prototype's old blanket-refusal behavior and the new narrower one.
- `src/browser/eventNarration.js#strikeRefused`: when `e.spell` is present, renders `A Wizard does not stoop to fisticuffs while ${e.spell} is still in the book.`; falls back to the original line when `reason: "wizard"` has no `spell`, and to `You hold back.` for any other reason — all three shapes verified directly.
- `test/unit/combat.test.js`: the pre-existing Wizard-refusal test updated for the new condition and event shape (`grimoire: ["Freeze"]`, expects `spell: "Freeze"`).
- `test/unit/casters-can-act.test.js` (new, 16 tests): locks every IDENT-01 branch (utility-only book, attack spells spent, zero charges, refusal naming, level-locked Fireball, school-locked Stun for a Summoner, non-Wizard casters), every IDENT-03 branch (in-combat/out-of-combat Summon at the unchanged doubled formula, the one-in-eight backfire, the pre-override Wizard-still-refused control), every IDENT-04 branch (undoubled Phantom Host with a proven zero-backfire-draw, non-Illusionist still refused, `strikeDie` unchanged through level 3, Mirror Self unchanged), and a `SUB_NOTE` voice guard.
- `content/flavor.js#SUB_NOTE`: exactly three values replaced (Wizard, Illusionist, Summoner) to state the landed rules while keeping every bad visible (one wizard per party, the d20 strike stall, the one-in-eight backfire) — `git show --numstat` on the commit confirms `3 3`, no other line touched.
- `npm test` 1027/1027 (1011 baseline + 16 new tests); `node --test "test/parity/**/*.test.js"` 31/31 with zero fixture/comparables diff for this plan's three commits.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wizard melee rule in playerStrike + strikeRefused.spell + narration** - `5dcaebd` (feat)
2. **Task 2: Tests — Wizard fights when the book cannot hurt; Summoner and Illusionist cast at level 1; the bads stay** - `c2c1e8c` (test)
3. **Task 3: Flavor — the three SUB_NOTE blurbs these rules make false** - `43b12f0` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `engine/combat.js` - `playerStrike`'s Wizard refusal routed through `castableAttackSpells(state)`; `strikeRefused` gains `spell`
- `src/browser/eventNarration.js` - `strikeRefused` names the spell when present
- `test/unit/combat.test.js` - the existing Wizard-refusal test updated (grimoire + `spell: "Freeze"`)
- `test/unit/casters-can-act.test.js` - 16 new tests (IDENT-01/03/04 + SUB_NOTE voice guard)
- `content/flavor.js` - `SUB_NOTE.Wizard`/`SUB_NOTE.Illusionist`/`SUB_NOTE.Summoner` restated

## Final strikeRefused event shape

```js
{ type: "strikeRefused", reason: "wizard", spell: "Doze" } // when an attack spell is castable
{ type: "strikeRefused", reason: "wizard" }                 // legacy/no-spell shape (narration still degrades gracefully)
```

## Final SUB_NOTE strings

- **Wizard:** "Every school of magic, and a flat refusal to teach anybody who isn't an Apprentice. You will not raise a hand while an attack spell is left in the book; once the book cannot hurt anything, the staff will do. Two wizards in a party fight each other; there is only one of you, which helps."
- **Illusionist:** "You choose where the teleport squares put you, which in a dungeon is very close to owning the floor. A Phantom Host from day one, three illusions, and a d20 to strike until level three — let the host do the hitting."
- **Summoner:** "You can call something up from your very first day. Everything you call arrives twice as strong and twice as long-lived, and one time in eight it arrives on the wrong side. The book declines to say whose fault that is."

## Decisions Made

- `castableAttackSpells(state)` is the single Wizard-refusal gate; `engine/combat.js` imports it rather than re-declaring the attack-kind set, matching Plan 01's "one definition of attack spell" contract.
- The two in-combat Summon/Phantom Host tests (IDENT-03/IDENT-04) use an empty foe list so `afterPlayerAction`'s own `encounterCleared` short-circuit keeps the rng sequence to exactly the summon-branch draws (`[2,3]` / `[3]`) while still exercising the real `C.ally` assignment — the ally object is asserted via a locally-captured `combat` reference (state.combat itself is nulled by the immediately-following `endCombat`, an intentional consequence of testing with no live foes, not a code defect).
- The Summoner backfire test drives `combat: null` so `castSpell`'s trailing unconditional `afterPlayerAction` call never fires, isolating the backfire arithmetic from foeTurn/rollInitiative rng noise.
- Reused `test/unit/combat.test.js`'s existing lethal-hit rng sequence (`[1,3,4,5,20,1]`) verbatim for every "the caster still swings" assertion — it is sub-agnostic (cls `"Magic User"` never enters the Thief-only backstab/heavy-armor branches), so one sequence covers Wizard, Sorcerer, and every grimoire-content variant without hand-deriving a new one per test.

## Deviations from Plan

None - plan executed exactly as written. The three tasks landed with the exact acceptance-criteria greps specified (`castableAttackSpells(state)` count 1, `spell: castable[0].n` count 1, the `DELIBERATE RULES CHANGE` comment, the `SUB_NOTE` regex checks, the `3 3` numstat on `content/flavor.js`). Task 2's test file intentionally left one test (the `SUB_NOTE` voice guard) red until Task 3 landed, exactly as the plan specified ("test 15 may fail until Task 3 lands").

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/combat.js#playerStrike`'s Wizard rule, `src/browser/eventNarration.js#strikeRefused`, and the three `SUB_NOTE` strings are landed and tested; Plan 04 (Freeze pays out via `killFoe`, `spellAboveLevel` via `spellLevelFor`) can proceed independently — it touches `engine/magic.js`, not `engine/combat.js`'s playerStrike.
- `test/unit/casters-can-act.test.js` is the new home for every IDENT-01/03/04 assertion; Plan 04 should extend it (or add its own file) rather than duplicating the fixedCaster/fakeRng helpers.
- No blockers. `npm test` 1027/1027, parity 31/31, no undeclared carve-outs added.

---
*Phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created/modified files confirmed present; all three task commits (`5dcaebd`, `c2c1e8c`, `43b12f0`) confirmed in git log.
