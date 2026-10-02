---
phase: 90-spell-skill-audit
plan: 11
subsystem: spells-and-skills
tags: [text-01, plain-language, wording-guard, grimoire, combat-menu, chips, narrative-ledger, q7, q9, q10, q11]
requires:
  - phase: 90-10
    provides: the Joiner reads of Stealth, Hardiness and Ambidextrous (Q10), Death's aim (Q7), the fixated read (Q9) that this plan words
  - phase: 90-04
    provides: the blind cap applied last and the one depth-rising resist the new resist sentence states
  - phase: 89-09
    provides: the item wording precedent (signed to-hit, d20 ranges from facesRangeText, the wording-guard shape, the ledger fold)
provides:
  - "every spell, ability and skill row, Oracle and rail line, chip sentence and menu row states a shift as a signed to-hit and a hard cap as a d20 range, never as faces"
  - "heroTab.js#GRIMOIRE_COPY.resistNote: the one resist sentence on every foe-targeted spell's Grimoire row and combat menu row"
  - "test/unit/spell-skill-text-wording.test.js: the TEXT-01 wording guard with engine-measured shifts and ranges"
  - "docs/narrative-pass/why/90-11.json (63 rows) and the regenerated review pages"
affects: [90-12, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "a hard cap's range is written through rollRange.js#facesRangeText from the engine's own faces and pinned against foeSwingVsHero, plain case first and the insulted case after it"
    - "one copy constant (GRIMOIRE_COPY) feeds two surfaces instead of thirty hand-edited spell texts"
key-files:
  created:
    - test/unit/spell-skill-text-wording.test.js
    - docs/narrative-pass/why/90-11.json
  modified:
    - content/spells.js
    - content/abilities.js
    - content/skills.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/foeConditions.js
    - src/browser/combatMenu.js
    - src/browser/heroTab.js
    - src/browser/mapMarks.js
    - mazeworld.html
    - tools/lib/voice-corpus.mjs
    - docs/SPELL-AUDIT.md
    - docs/SKILL-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - docs/narrative-pass/why/q-260927-opf.json
    - docs/narrative-pass/why/q-260927-rsx.json
    - docs/narrative-pass/why/q-260928-z4-nrf.json
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
    - "tests: authored-ranges, roll-sign-consistency, abilities-catalog, class-trims-nrf-copy, combatMenu, foe-conditions, escape-talk-rout-spells, petrify-blind-stupidity, mapMarks"
key-decisions:
  - "Hard caps read 'only on their best roll (20 on a d20; 19–20 if you insulted them)' for Mirror Self and Smoke (the item wording), 'a high roll (18–20 on a d20; 17–20 if you insulted them)' for Weaken and the Behemoth's cower, and 'its best roll (20 on a d20)' with no insulted case for Blind and Dirty Trick (the blind cap is applied last, so an insult never widens it)"
  - "The hero's own die scales, so Stealth reads 'the top two numbers of your die (19–20 on a d20)' and a fumbled Mirror Self on a foe reads 'the top number of your die', never a bare d20 range"
  - "The resist sentence lives in heroTab.js as GRIMOIRE_COPY.resistNote (combatMenu.js already imports heroTab.js, so the other direction would be a cycle) and is registered as a corpus bank"
  - "Every cd: 'fight' ability says 'once per fight' in its text (the audit's finding), pinned both ways"
requirements-completed: [TEXT-01]
status: complete
duration: one long session
completed: 2026-10-01
---

# Phase 90 Plan 11: Plain-language spell and skill text (TEXT-01) Summary

**Kata and Feint read "+3 to hit", Sidestep "foes −2 to hit you", Mirror Self and Smoke "only on their best roll (20 on a d20; 19–20 if you insulted them)", Weaken "a high roll (18–20 on a d20; 17–20 if you insulted them)"; every spell cast on a foe says on its Grimoire and menu row that a foe may resist it and deeper floors resist more; Death Touch is "one swing", the Fixated chip says the dead swing only at you, and a guard fails the build if any spell or skill surface says "faces" again or states a number the engine does not roll.**

## What was built

### Task 1: the wording (commit e9878239)

- **Shifts** (`content/abilities.js`, `content/skills.js`, `eventNarration.js`, `narrationLines.js`): Kata and Feint "+3 to hit on this strike" (`KATA_FEINT_NEED_SHIFT`), Overhead Blow "−2 to hit", Sidestep "foes −2 to hit you", Battle Roar "foes −2 to hit anyone on your side". The table skill and its catalog ability keep one text; the Oracle and rail lines say the same words.
- **Hard caps**, each range computed from `facesRangeText(faces, 20)`: Mirror Self and Smoke (20; 19–20 insulted), Weaken and the Behemoth's cower (18–20; 17–20 insulted), Blind and Dirty Trick (20 only), Stealth ("the top two numbers of your die (19–20 on a d20)"). The foe chips (`foeConditions.js`: blind, weakened, cowering) and the hero chips (`mazeworld.html`: mirror, heroBlind) carry the same words.
- **Resist, plainly**: `heroTab.js#GRIMOIRE_COPY.resistNote` ("a foe may resist this on its intelligence, and the deeper the floor, the likelier it does") is the `resistNote` of every foe-targeted `grimoireViewModel` row (rendered after the row's text) and is appended to every foe-targeted combat menu row, beside the menu's per-target "{target} resists on {range}". Self spells carry neither.
- **Parley**: Chameleon Tongue says "a parley (talking your way out of the fight instead of swinging) at +4 to the roll".
- **Area effects**: no spell or skill text says "squares of" foes (the audit found none left after Phase 89); each states how many foes it reaches (Doze d4, Shrink up to d6, Plane Gate d6, Fireballs d8 bolts spread across the foes, the rest every foe), and a test pins it.
- **Orchestrator amendment**: Q9 (the Fixated chip and the Turn Walking Dead text: the dead left standing swing only at you for the rest of the fight, never at your Joiner), Q10 (Stealth, Hardiness and Ambidextrous each say a Joiner uses it, with the engine's −3 and two swings), Q11 (Death Touch: "one swing, rolled as normal; if it lands it doubles and finishes anything under 15 hp; once per fight", engine unchanged), Q7 (Stupidity and Death read "the foe you picked").
- **The other audit text rows**: Cooking (the ration, and whose max hp), Locks (lockpick and intelligence terms, a failed roll loses the chest), Sewing (a fed day's rest, in hp), Silent Step (never misses, the exceptions that keep the hit and lose the doubling), Noxious Vapor and Insane (their tables listed), Dirty Trick (what blind means), the once-per-fight rule on Smoke, Second Wind, Cutpurse, Hamstring and Mark.
- **Both audit docs**: every `fix text (90-11)` row is `fixed text (90-11)` with its pin; Death Touch reads `ruled (Q11, 2026-09-30) -> 90-11 built (text only, no engine change)`; the spell rows that carried a "TEXT-01 -> 90-11" note have the new text and their pins in the Pinned by cell.

### Task 2: the wording guard and the re-pinned ranges (commit 809b5677)

- `test/unit/spell-skill-text-wording.test.js` (24 tests): no face(s) or "squares of" foes on any row, event line (Oracle, rail, bare payload, Joiner's, read from the live corpus), chip sentence, Grimoire row or menu row; shifts and ranges compared with the engine (`foeSwingVsHero` plain and insulted, `foeToHitVs`, `KATA_FEINT_NEED_SHIFT`, a real Overhead Blow, a real Stealth opening blow, a real Death Touch swing and miss, `applyFoeDamageToPlayer` for Hardiness); the resist sentence on every foe-targeted row and none on a self spell; the four probe edges (ADJACENCY, EMPTY, ENCODING U+2212 and U+2013, ORDERING plain-then-insulted).
- `authored-ranges` (header rule rewritten, Mirror Self, Smoke, Weaken, Battle Roar, Sidestep, Overhead Blow, Stealth, the Locks lockpick and intelligence terms, the chip and line pins) and `roll-sign-consistency` (Smoke, Mirror Self and Weaken compare the stated d20 range with the foe card's measured faces, plain and insulted) re-pinned.

### Task 3: ledger, snapshots, drift (commit 31797911)

- `docs/narrative-pass/why/90-11.json`: 63 rows from a corpus diff of the plan base (an extracted tree of 09db3fbf) against the change; every `after` is a live corpus line; `node tools/voice-inventory.mjs --check-ledgers --after` reports 0 errors; `node tools/narrative-review.mjs` (744 rows) and `--check` are in sync.
- Shell snapshots `thief.hero` and `mu.hero` regenerated alone through `MZ_SNAPSHOT_UPDATE=1`; the six others re-wrote byte-identical and were restored.

## Fixture drift

Text only, as predicted. Full record in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 90 plan 11").

- **Parity: 66 of 66 unmoved.** `node tools/fixture-inventory.mjs --json` is byte-identical to the same command on an extracted tree of 09db3fbf.
- **State pins: 0 of 8 moved** (`roll-high-state-pins`, `roll-high-save-compat`, `roll-high-guard`: 24 of 24 pass with every pin as 90-10 left it). Not re-recorded; `roll-high-baseline.mjs save` never run.
- **Shell snapshots: 2 of 8 moved.** `thief.hero`: Dirty Trick's text and Smoke's text (two rows). `mu.hero`: four Grimoire rows (Doze, Freeze, Stun, Earthquake) gain the resist sentence. The plan predicted `mu.hero` alone; `thief.hero` moves because the Thief's Hero tab prints the Dirty Trick and Smoke rows.
- **Draws and fields:** none added; no `*Comparable()` carve-out; `roll-high-guard` DRAW_INVENTORY unchanged. Spell and skill text is never stored in a save, so no load refresh.
- **Unit pins moved (words only):** authored-ranges, roll-sign-consistency, abilities-catalog, class-trims-nrf-copy, combatMenu, foe-conditions, escape-talk-rout-spells, petrify-blind-stupidity, mapMarks.
- `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json` untouched (`git diff` empty).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The resist constant lives in heroTab.js, not COMBAT_MENU_COPY**
- **Found during:** Task 1. `combatMenu.js` already imports `heroTab.js`, so a constant in `COMBAT_MENU_COPY` that the Grimoire also reads would be a cycle. It is `heroTab.js#GRIMOIRE_COPY.resistNote` (a frozen object), registered as a corpus bank in `tools/lib/voice-corpus.mjs` (the voice-corpus completeness test fails an unregistered copy export). Read by both surfaces from that one place; the menu copy bank has no duplicate.
- **Commit:** e9878239.

**2. [Rule 3 - Blocking] Ledger rows the plan could not chain from were folded (the 89-09 precedent)**
- **Found during:** Task 3. `90-11` sorts before the `q-` ledgers, so it cannot chain from the Kata, Feint, Death Touch, Silent Step, Overhead Blow and Weaken rows those later ledgers hold, and their `after`s were no longer in the corpus. Removed nine `q-260927-opf`, four `q-260928-z4-nrf` and two `q-260927-rsx` rows by exact text surgery (the rest of those files byte-identical) and carried their changes and whys in the 90-11 rows.
- **Commit:** 31797911.

**3. [Rule 3 - Blocking] Files outside the plan's list**
- `src/browser/mapMarks.js` and `test/unit/mapMarks.test.js` (the LOCKED BOX legend said "more faces with practice or wits" about the Locks skill; now "a wider range"), `tools/lib/voice-corpus.mjs` (the bank registration), and the pins `class-trims-nrf-copy`, `escape-talk-rout-spells`, `petrify-blind-stupidity` that quoted the old words. `thief.hero.txt` also moved (above).

**4. [Rule 3] foeConditions.js writes its ranges inline**
- A first draft held the two range strings as top-level constants; the corpus's raw sweep read them as new `raw:` keys. They are written inline through `facesRangeText` in the three chip sentences instead.

### Plan decisions worth the user's eye (not blocking)

- **The d8 example is gone from the Behemoth's text** ("6–8 on a d8, 18–20 on a d20" became "a high roll (18–20 on a d20; 17–20 if you insulted them)"), as the plan's TEXT-01 rule asks for one d20 example; its insulted case is stated because a cower is capped like a Weaken (three faces, four insulted), measured.
- **Blind and Dirty Trick state no insulted case** on purpose: the blind cap is applied last, so an insult never widens it. A test pins that the plain and insulted faces are equal.
- **Stealth and the fumbled-Mirror line say "the top number(s) of your die"**, not a d20 range alone, because the hero's strike die scales from d20 to d6 (the item precedent for weapon crits).
- **Not touched, by design:** the parley insult chip and `COMBAT_MENU_COPY.parleyDesc` ("one face easier"), the Bard's song chip ("one face easier") and the Ninja's "top two faces" crit line are race, sub-class, parley and Bard wording (Phase 91's TEXT-01 pass and PARLEY-01); the guard's chip list excludes them.
- **TDD note:** the guard was written after the wording, within the same plan; there is no separate RED commit.
- **`npm test` was not run** (the user's 2026-10-01 testing rule: only the files this plan touches and the pins it moved). The orchestrator runs the full suite once at phase close.

## Results (targeted runs, after the last file change)

- The plan's Task 2 verify list plus the audit, catalog, spell-table, class-trims, escape-talk, petrify and mapMarks files and `voice-corpus`: **438 tests, 438 pass, 0 fail**.
- 185 test files that read spell, skill, ability, chip, menu, Hero-tab, store, gear, party, Joiner, class, identity or map text (including `shell-tab-snapshots` and the Task 2 set): **3,553 tests, 3,553 pass, 0 fail, 0 skipped**.
- `node --test "test/parity/**/*.test.js"`: 66 of 66. `roll-high-state-pins`, `roll-high-save-compat`, `roll-high-guard`: 24 of 24.
- `narrative-review`, `formatEventsCoverage`, `narrationLinesCoverage`, `narrationLinesTable`, `narrativeLines`, `voice-corpus`, `shell-narration-wiring`, `narrative-hygiene`, `safety-scan`, `stale-terms`, `hp-not-wp`, `roll-ledger-sync`, `size-voice`: 146 of 146. `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count`: 0. `node tools/narrative-review.mjs --check`: in sync.
- Acceptance greps: no spell, ability or skill `txt` matches `\bfaces?\b|squares of`; `fix text (90-11)` appears 0 times in either audit's table; `### Phase 90 plan 11` appears once in FIXTURE-INVENTORY; `git diff` for `tools/lib/event-variants.mjs`, `docs/narrative-pass/corpus-base.json` and `test/parity/prototype-master.js.txt` is empty. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Commits

- `e9878239` feat(90-11): spell and skill text in plain words (Task 1)
- `809b5677` test(90-11): the spell and skill wording guard; re-pin ranges, shifts and chips (Task 2)
- `31797911` docs(90-11): ledger the reworded lines, regenerate the two moved shell snapshots, record the measured fixture drift (Task 3)

## Known Stubs

None.

## Threat Flags

None. Display text, one copy constant and a corpus registration; no new network, auth, file or schema surface.

## Human verification (deferred to end of run)

1. Open the combat ABILITIES menu as a Fighter: Kata reads "+3 to hit", Sidestep "foes −2 to hit you", Battle Roar "foes −2 to hit anyone on your side", Overhead Blow "−2 to hit"; no line says "faces". Death Touch reads "one swing, rolled as normal; if it lands it doubles and finishes anything under 15 hp; once per fight".
2. Open the Grimoire as a Magic User: Mirror Self reads "foes hit you only on their best roll (20 on a d20; 19–20 if you insulted them)"; Weaken "foes hit only on a high roll (18–20 on a d20; 17–20 if you insulted them)"; each spell cast on a foe (Freeze, Doze, Stun, Earthquake...) ends "a foe may resist this on its intelligence, and the deeper the floor, the likelier it does"; Heal and Shield do not.
3. In a fight, open the SPELLS menu: a foe-targeted row shows the same sentence and then "{foe} resists on 16–20 (d20)"; Chameleon Tongue's row explains what a parley is.
4. Cast Mirror Self, Smoke (Thief) and Weaken and read the Oracle and the rail: the same d20 ranges, plain case first. Long-press a Weakened, Blind and Fixated foe: the chips say the same, and the Fixated chip says it swings only at you, never at your Joiner.
5. The Hero tab for a Thief shows Dirty Trick "...so it hits only on its best roll (20 on a d20) and never lands a critical" and Smoke ending "once per fight"; a Fighter's Stealth, Hardiness and Ambidextrous rows mention a Joiner.

## Self-Check: PASSED

- Files exist: `test/unit/spell-skill-text-wording.test.js`, `docs/narrative-pass/why/90-11.json`, this summary.
- Commits `e9878239`, `809b5677` and `31797911` exist on the worktree branch; the targeted verification above is green.
- `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json` untouched.
