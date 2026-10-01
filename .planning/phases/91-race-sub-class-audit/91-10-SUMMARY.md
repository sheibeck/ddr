---
phase: 91-race-sub-class-audit
plan: 10
subsystem: identity-text
tags: [text-01, blurb-guard, identity, audit-close, parley, d20-ranges, narrative-ledger]
requires:
  - phase: 91-race-sub-class-audit
    provides: "91-01's audit and rulings; 91-02..91-09's engine fixes and the rows they closed"
provides:
  - "TEXT-01 for every race, sub-class and class line: '+N to hit' / 'foes -N to hit you', d20 ranges computed from the engine's numbers, 'can always parley with X' with the parley explained in the blurb; no 'faces' anywhere in identity text"
  - "IDENT-12's blurb guard: BLURB_ANCHORS (content/identity.js), one anchor per identityEntries id of 6 races and 24 sub-classes (a race's RACES note too); test/unit/identity-text.test.js fails a trait with no blurb line, a dead anchor, an empty blurb"
  - "every blurb and note states every advantage and drawback its footer lists: closed schools named, Special stretch, free skills, Acrobat trap dodge, Cleric chain mail and scroll, Apprentice Illusion, Fridgian no-Samurai, Troll 75 HP / +11, flat-priced tool exception on every price line"
  - "docs/IDENTITY-AUDIT.md closed: 132 rows, none open, none an unbuilt gap; identity-audit.test.js final-verdict, Pinned-by and engine-scan guards"
affects: [phase-91.1, phase-92]
tech-stack:
  added: []
  patterns:
    - "text numbers are written by rollRange.js from the engine's own functions, then read back through the engine by a test, so text and engine cannot drift"
    - "BLURB_ANCHORS: regex sources (lookaheads for two facts) matched case-insensitively against the blurb and, for a race, its RACES note"
    - "an engine-scan guard: every name-keyed engine rule (a sub or race string compared in engine/*.js, or a name list) must be cited by file in that identity's audit Engine cells"
key-files:
  created:
    - test/unit/identity-text.test.js
    - docs/narrative-pass/why/91-10.json
    - docs/narrative-pass/why/r-91-10.json
  modified:
    - content/identity.js
    - content/flavor.js
    - content/races.js
    - src/browser/identityFooter.js
    - src/browser/combatMenu.js
    - src/browser/eventNarration.js
    - mazeworld.html
    - tools/lib/voice-corpus.mjs
    - docs/IDENTITY-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - test/unit/identity-audit.test.js
    - test/unit/identity-footer.test.js
    - test/unit/authored-ranges.test.js
    - test/unit/casters-can-act.test.js
    - test/unit/class-trims-nrf-copy.test.js
    - test/unit/combatMenu.test.js
    - test/unit/parley-rewards.test.js
    - test/unit/size-voice.test.js
    - test/unit/shell-tab-snapshots.test.js
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
key-decisions:
  - "A smaller strike die hits more often (the winning numbers count down from the top of the die), so the Elven 'one size better' reads 'one size smaller (a d12 at level 1, not a d20), so you hit more often'; the plan's 'one size bigger' would have said the opposite"
  - "The Elven to-hit floor reads 'you hit on at least the top five numbers of your strike die (16-20 on a d20), whatever the class', not 'always hits on 16-20': it is a floor on the class need, never an auto-hit"
  - "The unstated rows become stated traits, as the audit's row-keeping rules say: generated lines for data-backed rules (chart-stretch-special, free-skill, race-no-samurai) and authored traits with a pinning test for the rest (cleric-mail, apprentice-illusion, acrobat-traps)"
  - "Elven, Dwarven, Troll and Pickpocket price lines say 'torches, rope and ladders aside': Q8 A left the three flat-priced tools outside the rule and the old lines promised more than the engine does"
  - "The 90-12 text hand-offs are done here (parley card and insult chip, the Bard's song chip copy, the Ninja crit line); the dead C.inspired readers and the dead beastsSoothed branch stay logged for 91.1 (digest-pinned tests, files outside this plan)"
requirements-completed: [TEXT-01, IDENT-11, IDENT-12, IDENT-21]
status: complete
duration: one long session
completed: 2026-10-01
---

# Phase 91 Plan 10: TEXT-01 for every race and sub-class, the blurb guard and the audit close Summary

**Every identity line a player reads now says '+N to hit' or 'foes -N to hit you' with d20 ranges the engine computes, every blurb states every advantage and drawback its footer lists (guarded by a BLURB_ANCHORS table), and docs/IDENTITY-AUDIT.md is closed at 132 rows with every fixed row pinned by a named test.**

## What was built

**Task 1 (RED, `b4062051`).** `test/unit/identity-text.test.js` (the TEXT-01 guard, the engine-numbers checks, the blurb guard, the schools check, the four TEXT-01 edges) and the engine-scan, final-verdict and Pinned-by guards in `test/unit/identity-audit.test.js`, with an empty `BLURB_ANCHORS` export so the file imports. Both files failed on the old wording and the open audit.

**Task 2 (`ad53a4bd`).**
- `src/browser/identityFooter.js`: generated lines in TEXT-01 form: `+N to hit with thrown X spells`; size and race shifts as `foes +N / -N to hit you`; the strike die and the foe die in plain words with the level-1 die from `STRIKE_DICE` and `foeDie`; the to-hit floor with its d20 range from `facesRangeText`; new generated lines `chart-stretch-<school>` (from `spellEffectSquares` and `spellEffectRounds`), `free-skill` (from `FREE_SKILL`) and `race-no-samurai`.
- `content/identity.js`: every trait reworded with engine-checked ranges (Guard, Soldier, Ninja, Acrobat, Cleric, the price lines, the Apprentice's backfire); new authored traits `cleric-mail`, `apprentice-illusion`, `acrobat-traps`, each pinned by a titled test; `BLURB_ANCHORS` filled for every id.
- `content/flavor.js` and `content/races.js`: every `SUB_NOTE`, `RACE_NOTE`, `CLASS_NOTE` and `RACES` note that was incomplete or used the old wording, in the house voice (the Cleric's Q2 A / Q3 B blurb with no shield; the Woodsman's shield gone; the Elven +3 parley; the Troll's 75 starting hit points and +11 with the Large +2 inside it; the Ninja and Acrobat in plain words; every Magic User's closed schools; the Apprentice's Illusion; the Summoner's Summon-from-level-1 exception).
- The 90-12 hand-offs: `COMBAT_MENU_COPY.parleyDesc` and the insult chip read '+1 to hit', the Bard's song chip copy reads '+1 to hit', and the Ninja's crit line reads 'A Ninja's top two numbers. Critical!'.
- Pins reworded to the TEXT-01 form (`identity-footer`, `class-trims-nrf-copy`, `size-voice`, `combatMenu`, `parley-rewards`, `authored-ranges`, `casters-can-act`), the two moved Hero-tab snapshots regenerated and declared, `docs/narrative-pass/why/91-10.json` (82 rows) and `r-91-10.json` (3 rows), `docs/NARRATIVE-PASS.md` and `review.html` regenerated (`node tools/narrative-review.mjs --check` exits 0).

**Task 3 (`85f184de`).** `docs/IDENTITY-AUDIT.md` closed: unstated rows renamed to the traits that state them and moved into `identityEntries` order, every verdict final, Pinned by filled, five missing engine citations added (found by the scan), rulings marked built, findings for 91.1 and 92 written.

## The audit close

132 rows in 6 race and 24 sub-class sections:

| Verdict | Rows |
|---|---|
| match | 51 |
| fixed text only | 63 |
| fixed engine and fixed text | 12 |
| fixed engine only | 3 |
| retired (`pickpocket-take`, `moa-withdraw`, `troll-weapons`) | 3 |

Seven of the fixed-text rows also carry a user ruling (`ninja-crit`, `acrobat-dodge`, `race-flat-hp`, `race-dmg`, `cleric-mail`, `unstated:cleric-scroll`, `bard-song`). No row reads `fix` or `balance call`.

**Open gap rows: none.** 91-09 left no unbuilt rows and 91-10 built every text row, so nothing is handed to a gap plan.

**Findings handed on** (full list in the audit's Findings section):
- Phase 91.1: the Joiner Bard's missing dim-witted drawback; the Joiner Apprentice never backfires; the Illusionist's Special stretch is large (Fly 70 squares) while its Illusion bonus stretches nothing; the Woodsman starts in Leather where other Fighters start in Studded (no text mentions it); the dead `C.inspired` readers (`derived.js` three sites, `conditionEffects.js`, `heroConditions.js`, the `mazeworld.html` chip, six test files, the `[hero-strike:inspired]` ROLL-LEDGER row) and the dead `beastsSoothed` branch in `mazeworld.html`, both logged in `deferred-items.md` and left alone.
- Phase 92: this plan moves no number; the bot pass needs only the 91-02..91-09 moves, and should be watched on the Illusionist's pick, the Bard's song, the Cleric with no offense spell, the Troll's and Pickpocket's prices on every line but the three tools, and the Wilmsry's doubled potions.

## Fixture drift

- **Engine and parity fixtures: none.** `git diff --stat HEAD -- engine test/parity` prints nothing; `node --test "test/parity/**/*.test.js"` is 66 of 66. `test/parity/prototype-master.js.txt` untouched. No rng draw, no serialized state, no event moved.
- **Declared text regenerations (two Hero-tab snapshots, DOM structure unchanged):** `test/unit/fixtures/shell-snapshots/thief.hero.txt` (Wilmsry blurb and note, Cat Burglar blurb and footer) and `test/unit/fixtures/shell-snapshots/mu.hero.txt` (Magic User class blurb, Wizard blurb and footer), declared in `test/unit/shell-tab-snapshots.test.js`. The other six snapshots re-wrote the same bytes (`git diff --ignore-cr-at-eol --stat` shows only these two) and were not committed.
- **Narrative ledger:** 85 rows in two files; the narrative pages regenerated.
- **Pins re-worded, numbers unchanged:** the ROLL-04 prose pins in `identity-footer.test.js` (now "TEXT-01 pin: ..."), the Acrobat pin in `class-trims-nrf-copy.test.js`, the size notes in `size-voice.test.js`, the parley card in `combatMenu.test.js` and `parley-rewards.test.js`, the Ninja line and parley card in `authored-ranges.test.js` (two `PINNED_OUTSIDE_CONTENT` rows left the list because their strings no longer state a face count; one was added for the race-field fragments).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan wording] The Elven strike die is 'smaller', not 'bigger'**
- **Found during:** Task 2
- **Issue:** the plan suggested "your strike die is one size bigger (a d12 at level 1, not a d20)". A d12 is smaller than a d20 and hits more often (winning numbers count down from the top), so 'bigger' says the opposite of the engine.
- **Fix:** 'your strike die is one size smaller (a d12 at level 1, not a d20), so you hit more often'; the foe die line the same way, with the d12 and the d8 floor read from `foeDie`. The Elven to-hit floor reads 'you hit on at least the top five numbers of your strike die (16-20 on a d20), whatever the class' instead of 'always hits on 16-20', which a player would read as an automatic hit.
- **Files modified:** `src/browser/identityFooter.js`, `test/unit/identity-text.test.js`

**2. [Rule 1 - Bug] 'remembers your face' tripped the new guard**
- **Found during:** Task 2
- **Issue:** `SUB_NOTE.Pickpocket` said the shopkeepers remember your 'face', a real face, which the whole-word `faces?` check rightly flags.
- **Fix:** 'remembers you all the same'. The guard keeps matching whole words (the plan's 'surface' / 'interface' edge), so a genuine 'face' is the one false positive and is reworded.
- **Files modified:** `content/flavor.js`

**3. [Rule 3 - Blocking] The new `BLURB_ANCHORS` export had to be registered with the voice corpus**
- **Found during:** Task 2 (`voice-corpus.test.js` completeness: "no unregistered copy-bearing export")
- **Fix:** one `NON_COPY_EXPORTS` row in `tools/lib/voice-corpus.mjs` (a file outside the plan's list): the anchors are patterns, not player copy.
- **Commit:** `ad53a4bd`

**4. [Rule 3 - Blocking] Three Acrobat ledger rows live in `r-91-10.json`**
- **Found during:** Task 2 (`voice-corpus.test.js` standing ledger check, `narrative-review.test.js`)
- **Issue:** the quick task `q-260928-z4-nrf` also changed the Acrobat footer, trait and blurb, and ledgers are chained in file-name order, where `q-*` sorts after every numbered plan, so a `91-10` row could not follow it.
- **Fix:** those three rows go in `docs/narrative-pass/why/r-91-10.json` (it sorts after `q-*`), each chained from the quick task's `after`; the other 82 rows are `91-10.json`.

**5. [Rule 2 - Missing critical functionality] Scope the text pass needed beyond the plan's file list**
- The Elven, Dwarven, Troll and Pickpocket price lines now say 'torches, rope and ladders aside' (Q8 A left the three flat-priced tools outside the rule, and the lines promised more than the engine does).
- The 90-12 hand-offs (`src/browser/combatMenu.js`, `mazeworld.html` chips, `src/browser/eventNarration.js`) were done here as the standing rulings list them, with their pins updated.
- The plan named three unstated rules the guard could not otherwise reach; they became stated traits (`cleric-mail`, `apprentice-illusion`, `acrobat-traps`) or generated lines (`chart-stretch-special`, `free-skill`, `race-no-samurai`) and their audit rows were renamed per the audit's own row-keeping rule.

### Not done, by the standing testing rule

- The plan's Task 3 asked for `npm test`. The standing rule is targeted tests only (the orchestrator runs the phase-close full suite), so this run covered: `identity-text` (26), `identity-audit` (23), `identity-footer`, `identity-contract`, `casters-can-act`, `voice-corpus`, `narrative-review`, `safety-scan`, `stale-terms`, `hp-not-wp`, `authored-ranges`, `class-trims-nrf-copy`, `size-voice`, `parley-rewards`, `combatMenu`, the three shell snapshot tests, `heroTab`, `roller`, `troll-prices`, `fridgian-frenzy`, `pickpocket-item`, `cutthroat-joiner`, `illusionist-book`, `pilfer-fumble`, `scroll-read-surfaces`: **562 of 562 pass**; a second sweep of 23 narration, chip and wording tests: 659 of 659; parity 66 of 66; `node tools/narrative-review.mjs --check` exits 0.
- No bot runs.

## Known Stubs

None.

## Threat Flags

None: text, content and tests only; no endpoint, auth path, file access or schema.

## Human verification (deferred to end of run)

The phase's combined list for the batched Pixel 7 checklist at milestone close:

**Identity text (plans 91-02, 91-05, 91-06, 91-09 and 91-10)**
1. Roll through a few characters and read each Hero tab: the blurb and the footer agree, name every advantage and drawback, and say "+1 to hit" / "17-20 on a d20" style numbers instead of "faces".
2. Read the Ninja, Acrobat, Elven and Troll blurbs: the Ninja crits on the top two numbers of the strike die (19-20 on a d20), the Acrobat is hit only on a high roll (17-20 on a d20), the Elf can always parley with Humans at +3 on the roll, the Troll starts with 75 hit points and +11 damage with the Large +2 inside the 11.
3. Read the Wizard, Illusionist and Apprentice blurbs: only the Illusionist and the Apprentice can learn Illusion spells; every Magic User blurb names the schools it can never learn.
4. Read the Cleric blurb: chain mail, +1 to hit over other Magic Users, no offense spells, and "a scroll will still fire one"; no word about a shield. The Woodsman blurb says no shield either.
5. The Elf, Dwarf, Troll and Pickpocket footers say "torches, rope and ladders aside"; a Troll store shows doubled prices on everything else.
6. The roller and the Hero tab read cleanly for a Fridgian (can never be a Samurai) and an Acrobat, Ninja and Cat Burglar (their free skill named).
7. Roll Wizards until one comes up (three times): each Grimoire shows a level-1 spell that hurts, castable in the first fight (91-02). Roll a Cleric: the Grimoire holds Heal and no offense spell, and the combat spell menu offers no Freeze.
8. Read the PARLEY row's description: it says what a parley is, what it pays, and what failing costs ("+1 to hit you and yours"); the insult chip reads "+1 to hit" too (91-05, 91-10).

**Illusionist teleport (91-03, 91-04)**
9. As an Illusionist with Movement on ARROWS (the default), step onto a teleport: nothing moves until you choose, the card appears and the reachable squares glow; tap one: the party lands there. Same with TAP TO MOVE.
10. With the pick open, press an arrow on the pad and tap a dark square: nothing moves and the card pulses. Press LET IT CHOOSE: the party lands along the longest clear run. Quit mid-pick and relaunch: the card and the glow are back. The glow reads clearly over a dark square, water and an item icon.

**Master of Arms, Samurai and parley (91-05)**
11. As a Master of Arms (and a Samurai), open SOCIAL in a fight: FLEE is greyed with a one-line reason and no odds.
12. As a Bard (or anyone who can talk to Humans), win a parley against Humans: the Oracle says what it paid, the loot screen offers the dropped items, and the experience matches a won fight.

**Bard (91-06, 91-07)**
13. As a Bard, open the combat menu: SING says READY; sing: the Oracle names the song's title and the spell it echoes. SING again: greyed (SUNG THIS FIGHT); in the next fight it is ready again. The Hero tab says the Bard sings once per fight and that dim-witted foes come for you when a Joiner is along.
14. Take on a Bard Joiner and start a fight: on its first turn the Oracle and the rail say it sings a named song and what it does, and it does not sing again that fight; a Shield song makes the Joiner's HP in YOUR LOT drop less; an Earthquake or Death song costs the Joiner's HP, never the hero's, and a Joiner at 26 hp or less that sings Death gets the "needs at least 27" line.

**Pickpocket, Troll, Wilmsry, Cutthroat, Elf and Dwarf (91-08)**
15. As a Pickpocket, open a chest: the find card offers the usual item and the pile holds one more; kill something that drops an item: two entries in the pile.
16. As a Troll, every store price (weapons too) is twice a Human's, potions and food included (Healing potion 300), but Torch, Rope and Ladder stay flat; selling pays what a Human gets.
17. As a Wilmsry, meet a Magic User Joiner: the line says you refuse to travel with them.
18. As a Cutthroat with a Joiner, descend several floors: when a Joiner is lost (one descent in ten) the line names them.
19. As an Elf or Dwarf, a store halves potions, food, lockpicks and the sealed scroll as well as gear; as a Pickpocket they cost a quarter more (Healing potion 188).

**Fridgian, Wilmsry, Cleric and parley split (91-09)**
20. As a Fridgian, fight a few rounds: the Oracle shows the frenzy on a 4, 5 or 6 of a d6, never on a 3; the Hero tab footer names the d6, the 4-6 and the -1 to hit and says nothing about corpses; with a Fridgian Joiner a foe's hit takes 2 less than from a Human Joiner.
21. As a Wilmsry, use a found Healing potion: it heals twice a Human's amount and the Oracle says "twice the dose"; Xtra Healing still tops you up to full.
22. As a Cleric, read a scroll in a fight: an offense spell can still fire from it, and your book never gains it.
23. Parley with a Joiner at your side and win: the hero's XP is about half of what the same parley pays alone; a solo parley pays as before.

**Audit (91-01)**
24. Skim `docs/IDENTITY-AUDIT.md`: every race and sub-class you know from play has its section, and each verdict reads true.

## Self-Check: PASSED

- FOUND: `test/unit/identity-text.test.js`, `docs/narrative-pass/why/91-10.json`, `docs/narrative-pass/why/r-91-10.json`, `.planning/phases/91-race-sub-class-audit/91-10-SUMMARY.md`
- FOUND: `export const BLURB_ANCHORS` in `content/identity.js` (1)
- FOUND commits: `b4062051` (Task 1), `ad53a4bd` (Task 2), `85f184de` (Task 3)
- `git diff --stat HEAD~3 -- engine test/parity` prints nothing
- STATE.md, ROADMAP.md and REQUIREMENTS.md untouched
