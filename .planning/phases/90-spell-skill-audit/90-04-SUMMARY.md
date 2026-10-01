---
phase: 90-spell-skill-audit
plan: 04
subsystem: spells
tags: [resist, depth, petrify, blind, stupidity, spell-effects, narration, ledgers, spell-12]
requires:
  - phase: 89-08
    provides: the shared depth-rising resist (derived.js#risingResistFaces, #foeRisingResistCheck, #RISING_RESIST_CEILING; combat.js#foeResistsEffect), reused as built
  - phase: 90-01
    provides: the spell audit rows and the Q2 A (Petrify's experience) and Q7 A (Stupidity's aim) rulings
  - phase: 90-03
    provides: the spell-sourced timed-effect machinery and the Strength d10 that joins the damage rolls this plan leaves alone
provides:
  - "every spell a foe can resist (the hero's, a scroll's free cast, a Joiner's) rolls ONE resist per targeted foe, the shared depth-rising one: combat.js#foeResistsSpell IS foeResistsEffect; no spell calls resistControl, holdFoe with controlHoldRoundsFor, or controlCapRounds"
  - "Petrify kills through killFoe with spoils off (experience paid, no coin, treasure, bag or cooking), both lives; Stupidity sets the picked foe's intelligence to 1; Blind is fight-long, top-face-only, never crits, and is the last term of a foe swing"
  - "killFoe(state, f, rng, events, opts) with opts.spoils === false; foeStupefied is gone; the combat menu's resist hint and the foe card read risingResistFaces(depth, intel)"
  - "test/unit/spell-depth-resist.test.js (14 pins) and test/unit/petrify-blind-stupidity.test.js (22 pins)"
affects: [90-05, 90-07, 90-08, 90-09, 90-10, 90-11, 90-12, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "one resist gate, two names: foeResistsSpell delegates to foeResistsEffect, so a spell and an item roll the same roll on the same derived stream"
    - "a killFoe option (spoils: false) as an early return after the experience, so every tagged draw keeps its tag"
key-files:
  created:
    - test/unit/spell-depth-resist.test.js
    - test/unit/petrify-blind-stupidity.test.js
    - docs/narrative-pass/why/90-04.json
  modified:
    - engine/combat.js
    - engine/magic.js
    - engine/derived.js
    - engine/abilities.js
    - content/spells.js
    - src/browser/combatMenu.js
    - src/browser/foeDetails.js
    - src/browser/foeConditions.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/rail.js
    - docs/SPELL-AUDIT.md
    - docs/ROLL-LEDGER.md
    - docs/SPELLS.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - docs/narrative-pass/why/q-260928-z-sq2.json
    - test/parity/FIXTURE-INVENTORY.md
key-decisions:
  - "Reused 89-08's shared helper as built (the orchestrator amendment): faces = min(19, round(a + c - a*c/20)), NOT the plan's plain a + c. foeResistsSpell now just calls foeResistsEffect; derived.js#foeSpellResistCheck stays as the half-intelligence probe the older unit harnesses use"
  - "Flagged assumption (Blind vs the insult): the user's 'hits only on the maximum roll' is read as a hard cap applied AFTER the insult, so an insulted party still faces only the top face (before: two faces). foeSwingChain now orders penalty, insulted, blind"
  - "Stupidity keeps the f.stupid flag as the chip's mark only; nothing in a foe turn or in a strike's faces reads it"
  - "Ice's text lost its floor-12 clause now (the engine no longer has it), though 90-05 rewrites Ice wholesale, because the prohibition says a text must never state a floor-12 rule the engine lacks"
requirements-completed: []
status: complete
duration: ~one long session
completed: 2026-10-01
---

# Phase 90 Plan 04: One depth-rising resist for every spell; Petrify, Blind and Stupidity (SPELL-12) Summary

**Every spell a foe can resist now rolls the one depth-rising resist Phase 89 built (`foeResistsSpell` is `foeResistsEffect`), with no RULES-18 control resist, hold or cap left on any spell; Petrify kills and pays its experience with no spoils, Stupidity drops the picked foe's intelligence to 1 and leaves it swinging, and Blind is a fight-long top-face-only blindness that never crits.**

## What was built

- **One resist for every spell** (`engine/combat.js`, `engine/magic.js`). `foeResistsSpell` delegates to `foeResistsEffect`, so the hero's cast, a scroll's free cast and a Joiner's `allyCast` roll `derived.js#risingResistFaces` once per targeted foe on the existing `spellResist` derived stream (the main rng never moves). Intelligence 10 resists on 16-20 up to floor 12, 15-20 at floor 13, 10-20 at floor 20. `castSpell` lost every `resistControl`, `holdFoe` and `controlHoldRoundsFor` call (stun, stupid, blind, shrink, vapor, insane, status, petrify); `allyCast`'s sleep lost its `resistControl`; `foeTurn`'s Ice payoff lost its knee branches (a surviving iced foe freezes solid and dies at every depth, as below the knee before). The resist event carries the additive `depthFaces` (above floor 12 only), already narrated by 89-08.
- **Petrify (Q2 A).** After the one resist (the foe may still resist), a landed Petrify pushes `petrified { target }`, sets `lives = 1` (both lives of a kill-twice foe end) and calls `killFoe(..., { spoils: false })`: the experience d6 and `checkLevel`, and no coin, treasure, bag or cooking (an early return, so no tagged draw changes). No hold at any depth.
- **Stupidity (Q7 A).** `SINGLE_TARGET_KINDS.stupid` is `"target"`: it aims at the foe you picked, a dead pick falling to the first live foe. After the resist (rolled on the foe's OLD intelligence) the foe's `intel` becomes 1 and `stupid` is set (the chip's mark); the event is `stupefied { target, intel: 1, was }`. The foe keeps acting (`foeTurn`'s skip and `foeStupefied` are gone) and is no easier to hit (`targetStrikeFaces` floors only dozing and held foes, and the three engine copies of that floor agree). A later spell on it resists on 1 face (a 20 on a d20 up to floor 12, 19-20 at floor 13, 12-20 at floor 20). A foe already at intelligence 1 still lands it and the line says so.
- **Blind.** After the resist: `blind = true`, any `blindFor` deleted (a Dirty Trick's two-round countdown on the same foe goes; `abilities.js#applyDirtyTrick` now adds none to a fight-long blind foe), event `blinded { target }` with no rounds. A blind foe never crits at `pursuitStrike`, `foeTurn`'s hero branch, its Joiner branch, or on the `struckByFoe` line (`critical` and `soldierCrit` are false for it). `derived.js#foeSwingChain` applies the blind cap LAST.
- **Surfaces.** Spell texts for Petrify, Blind and Stupidity say the new rules with no floor-12 language; Ice's floor-12 clause is dropped too. The combat menu's resist hint (`risingResistFaces(state.floor.depth, intel)`) and the foe card's resist line read the same faces the engine rolls. `foeConditions.js`: the Stupefied chip says intelligence 1 and still swinging; the Blind chip says top face and no criticals; the Held chip is only a Freeze's (label Frozen); the reserved Stone label and description are removed. `foeDetails.js`: a stupid foe no longer reads a to-hit effect. Narration: `stupefied` (the `was` and the 1, or "already" when `was` is 1), `blinded` (no rounds, no critical), `petrified` (no spoils), on the Oracle and the rail; `foeStupefied` (Oracle, rail and the rail family title) removed.
- **Ledgers.** `docs/narrative-pass/why/90-04.json` (16 rows, every `after` read from `buildCorpus`: 11 changed lines and 5 removals, 5 of the 16 extending an earlier row of the same key); `node tools/narrative-review.mjs` 628 -> 639 rows, `--check` in sync. `docs/SPELL-AUDIT.md` rows (Petrify, Blind and Stupidity rewritten; Freeze, Weaken, Acid, Shrink, Earthquake, Fireballs, Insane, Plane Gate, Fireball and Mangle now `fixed engine (90-04)`; Doze, Stun, Ice, Vapor, Death, Lightning and Turn keep their later owners with the resist done); `docs/ROLL-LEDGER.md` (C3, C5, C7-C11, C17-C19 superseded, X10, a "Phase 90 plan 04" section); `docs/SPELLS.md` ("Phase 90: one resist, no floor-12 extras; Petrify, Blind, Stupidity", plus superseded notes on the control-axis table and the RULES-18 section).

## Remaining callers of the RULES-18 helpers

- `resistControl(`: `engine/combat.js#sing` twice (the Bard's Lullaby and Thunder; Phase 91, IDENT-17 moves them onto the shared helper). Its definition stays.
- `controlCapRounds(`: `engine/combat.js#sing` once (the Lullaby's 24). Defined in `engine/difficulty.js`.
- `controlHoldRoundsFor(`: only `engine/combat.js#holdFoe`'s default (no live caller: Freeze passes its own rounds; 90-08's Stop Time will too) and `engine/difficulty.js#controlCapRounds`. The dial itself (`CONTROL_AT_DEPTH`, `controlResistFacesFor`) is unchanged: the rising resist's `c` term reads it.
- `castSpell`, `allyCast` and `foeTurn` are audited exemptions (X10) in `test/unit/control-at-depth-rules.test.js`; the guard's other tests (the `controlResistCheck` and the `"controlResist"` stream pins) are unchanged.

## Fixture drift

None re-recorded. Measured against the plan base 60ef187d (`### Phase 90 plan 04` in `test/parity/FIXTURE-INVENTORY.md`).

- **Predictor.** The resist rise is 0 at or below floor 12 and the resist already came before a foe's own draws there, so a run moves only if it casts a resistible spell on floor 13 or deeper, casts Petrify, Blind or Stupidity, lets an Ice dot run out past floor 12, or has a blind foe that would have crit or been insulted. Parity fixtures sit on floors 1-3 and cast only Freeze, Heal and Fireball; the fair bot's pinned runs end on floors 3-5.
- `node --test "test/parity/**/*.test.js"`: 66 / 66, **zero parity drift**. `test/parity/prototype-master.js.txt` untouched.
- `roll-high-state-pins.test.js`: **0 of 8 labels moved**, none re-recorded, `roll-high-baseline.mjs save` never run. `roll-high-save-compat` and `roll-high-guard` (`DRAW_INVENTORY`) unchanged (killFoe's skip is an early return, so every tagged draw keeps its tag and count). `hazard-commit/golden.json`, `days-farm` and the other seed pins unchanged.
- **The one fixture file that moved is a text snapshot**: `test/unit/fixtures/shell-snapshots/mu.hero.txt`, the Stupidity Grimoire row (hand-pasted, one line; before "...does nothing at all for the rest of the fight; past floor 12, only for three rounds", after the intelligence-1 text). Declared in `shell-tab-snapshots.test.js`.
- **Main-rng draws that moved (floor 13 and deeper, or spells the pins do not run).** The one resist comes BEFORE each foe's own draws, where the old past-floor-12 control resist came after them: a resisted Doze, Stun, Shrink or Noxious Vapor foe, a resisted Insane cast and a Joiner's resisted Doze now draw no d4 / d6 (before: it was drawn first). A landed Petrify takes the experience d6 and skips the coin d10, treasure d20, bag d20 and cooking d6 (before: no `killFoe`, no draws). A stupid foe's `foeTurn` now takes its to-hit and damage draws (before: none).

### Pins replaced (before -> after, each re-pinned and named in its test)

- `control-spells-depth.test.js` (the RULES-18 spell pins): Doze (C7), Stun (C8), Stupidity (C17), Blind (C18), Shrink (C19), Petrify (C5), Noxious Vapor / Insane (C10 / C11), "main-draw parity" (now "main draws at floor 20": a resisted foe draws nothing for the effect), "the held dial" and "texts: every spell whose promise changes past the knee names floor kneeDepth and holdRounds" (now asserts no spell or item names them). Before: a second `controlResisted` roll, Unmoved marks, a 3-round stupid / stone hold, `blindFor` 3, `blinded.rounds` 3. After: one `spellResisted` with `depthFaces`, no marks, no hold. The floor-12 digest rows are unchanged except the three reworked spells (declared in the file). Weaken (C14), Freeze (C1), the scroll of Freeze and the item rows were already on the rising resist (89-08) and are untouched.
- `control-at-depth.test.js`: a Joiner's Doze (C9, two tests merged into one: one rising resist, a resisted Doze draws no d4), Ice's last tick (C3, three tests into one: it freezes solid at every depth), the held-chip kinds test.
- `control-at-depth-rules.test.js`: X10 exemptions (`castSpell`, `allyCast`, `foeTurn`).
- `foe-conditions.test.js` (the Stone label and desc, Held chip kinds, a `1` allowed in a description, `intel` on NOT_A_CONDITION), `foeDetails.test.js` (a blind foe's insult no longer stacks: 19-20 -> 20; a stupid foe reads no to-hit effect), `rollOdds.test.js` and `rollDirection.test.js` and `odds-helpers.test.js` (blind cap is last: two faces -> one; a stupid foe is not floored: the Phase 40 bonus is gone), `spell-mechanics.test.js` and `hero-out.test.js` (a stupid foe acts; `foeStupefied` gone; hero-out's "foe skips" fixtures now use `asleep`), `item-audit-fixes.test.js` (the spell gate is the rising gate), `shell-tab-snapshots.test.js` (above). `combatMenu.test.js` and `foeDetails.test.js` gained a depth-aware resist-hint pin each.
- `docs/narrative-pass/why/q-260928-z-sq2.json`: the Ice row's `after` dropped the floor-12 clause (see deviations).

## Flagged for the user

1. **Blind vs the insult (assumption).** "Hits only on the maximum roll" is read as a hard cap applied after the insult (Phase 72 put the insult last): an insulted party now faces only the top face of a blind foe (before: the top two). Recorded in `foeSwingChain`'s JSDoc, the Blind audit row and the ROLL-LEDGER section.
2. **What intelligence 1 changes besides the resist.** A grep of foe-side reads of `intel` finds one more: `combat.js#pickFoeTarget` sends a foe with intelligence 3 or less straight at the hero when the hero is a Bard ("creatures too stupid to know better come for you first"), so a Stupidity'd foe in a Bard's party now does that. The foe card's INT line and the combat strip show the 1.
3. **Dirty Trick's line.** `dirtyTrickLanded` still says "two rounds" on a foe that is already spell-blinded for the fight (the engine adds no countdown; the line is the skill audit's, 90-10 / 90-11).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `struckByFoe` still said `critical` for a blind foe's top-face hit.** `applyFoeDamageToPlayer` recomputed the crit flag from the roll, independent of the new `!f.blind` gate, so the line would have shouted a critical the damage never doubled. Added `!foe.blind` to `critical` and `soldierCrit`. Pinned in `petrify-blind-stupidity.test.js`. **Commit:** 8d6f514e.

**2. [Rule 3 - Blocking] The ledger orders files by name, so a `90-NN` row cannot chain after a `q-` row.** Ice's text row existed in `q-260928-z-sq2.json` (before: base, after: the level² text with the floor-12 clause); a 90-04 row after it sorted first and failed the "before is a base line" check. Fixed by dropping the floor-12 clause from that row's `after` (with a note in its `why`) rather than adding a 90-04 row. **Hand-off to 90-05:** its Ice rewrite hits the same ordering; the same fix applies.

**3. [Rule 2 - plan wording] The plan's `a + c` sum was not used.** The orchestrator amendment (reuse 89-08's helper) supersedes it; see key-decisions.

### Plan adjustments (not bugs)

- **`holdFoe`'s `controlHoldRoundsFor` default** (no live caller) and the `CONTROL_HOLD_WORD` stone / stupid words in `eventNarration.js` were kept, not removed: the first because `control-at-depth.test.js` still pins the held skip through it and 90-08 will reuse `holdFoe`; the second because the frozen corpus variants (`tools/lib/event-variants.mjs`) still render those kinds, so dropping them would delete two voice-corpus lines for nothing.
- **`foeStupefied`** was not a frozen corpus input (event-variants.mjs does not name it), so its Oracle, rail and rail-family entries were removed with three ledger removal rows.
- **TDD order.** The pin files were written after the engine change and run green (the old pins, 23 of them, were the red evidence: they failed against the new engine before being re-pinned); there is no separate `test(...)` RED commit, as in 90-03.
- **Files outside the plan's list**, all pins or docs the rule moved: `control-at-depth.test.js`, `control-at-depth-rules.test.js`, `odds-helpers.test.js`, `rollDirection.test.js`, `rollOdds.test.js`, `hero-out.test.js`, `item-audit-fixes.test.js`, `shell-tab-snapshots.test.js` and its `mu.hero.txt` fixture, `foe-conditions` / `foeDetails` expectations, `src/browser/rail.js`, `engine/abilities.js` (Dirty Trick's countdown), `docs/narrative-pass/why/q-260928-z-sq2.json`, `docs/SPELL-AUDIT.md`. `test/unit/roll-high-guard.test.js` and `roll-high-state-pins.test.js` needed no change (nothing moved).
- The generated review aid `tools/voice-sample-output.txt` still lists `foeStupefied`; nothing reads it and it is regenerated by hand.

## Known Stubs

None.

## Threat Flags

None. A pure engine rule change plus text; no new network, auth or file surface.

## Human verification (deferred to end of run)

1. Cast Petrify on a foe: it turns to stone and dies; no treasure offer follows and no coin is gained, but the experience is paid.
2. Cast Stupidity: the foe keeps attacking, its chip says intelligence 1, and the spell menu's resist hint against it drops to a 20 (more on a deep floor).
3. Cast Blind: the foe's attacks land only on its top roll and never crit (even if you insulted it); its chip says so for the whole fight.
4. On a deep floor (13+), the spell menu's resist hint and the foe card show higher odds than on floor 12 for the same foe, and a spell's Oracle roll line reads "(intel N, depth +M)".

## Commits

- 8d6f514e: feat(90-04): one depth-rising resist for every spell; Petrify kills with no spoils, Stupidity drops intelligence to 1, Blind never crits (engine, content, surfaces, pins, 90-04 ledger and review pages)
- 8d2111cd: docs(90-04): measure and declare the fixture drift (none re-recorded); audit rows, ROLL-LEDGER X10 and SPELLS.md state the one resist

## Results

- `npm test` (final full run, after the last file change except this SUMMARY): **8,806 tests, 8,804 pass, 0 fail, 2 skipped** (base 8,771 / 8,769 / 0 / 2; +35). None of the known worktree CRLF doc-ledger failures appeared in this run.
- `node --test "test/parity/**/*.test.js"`: 66 / 66. `node tools/narrative-review.mjs` then `--check`: 639 rows, pages in sync. `git diff --stat -- test/parity/prototype-master.js.txt`: empty.
- Acceptance greps: `castSpell` has no `resistControl(` / `controlHoldRoundsFor(` / `controlCapRounds(` outside comments (0); `allyCast` has no `resistControl(` (0); Petrify, Blind and Stupidity `txt` carry no "floor 12"; `foeTurn` has no `foeStupefied` (0); `### Phase 90 plan 04` in FIXTURE-INVENTORY 1; `Phase 90` in SPELLS.md 3.
- `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json` untouched.

## Self-Check: PASSED

- Files present: `test/unit/spell-depth-resist.test.js`, `test/unit/petrify-blind-stupidity.test.js`, `docs/narrative-pass/why/90-04.json`, this file.
- Commits 8d6f514e and 8d2111cd exist on `worktree-agent-a745c15ae8633f848`.
- Full suite fail 0 after the last source change.
