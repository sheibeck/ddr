---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 03
subsystem: ui
tags: [flavour, abilities, skills, text-layer, narrative-review]

requires:
  - phase: 96-02
    provides: the sub domain, the 11-domain layer, the shared scans and the ledger flow
provides:
  - ABILITY_FLAVOR (21 lines: the 20 catalog abilities plus the Bard's Sing) in content/abilities.js
  - SKILL_FLAVOR (10 lines: the passive special skills) in content/skills.js
  - the ability and skill domains (13 domains, 175 content keys), flavorOfAbility, flavorOfSkill
  - y-96-03.json (31 new-line ledger rows) and the regenerated review pages
affects: [96-06 combat ABILITIES rows, Hero lists and Final Sheet, 96-07 chips and UP YOUR SLEEVE, 96-08 review]

tech-stack:
  added: []
  patterns:
    - "Flavour is keyed by name beside the table, never on a row; the Sing key has no catalog row and its rules text is COMBAT_MENU_COPY.singDesc"
    - "Skill keys() are derived live from the rows with no `active` marker, so a new passive without a line fails the completeness test"

key-files:
  created:
    - docs/narrative-pass/why/y-96-03.json
  modified:
    - content/abilities.js
    - content/skills.js
    - src/browser/flavorText.js
    - test/unit/flavor-layer.test.js
    - test/unit/flavor-text.test.js
    - tools/lib/voice-corpus.mjs
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html

key-decisions:
  - "Skill keys are the 10 passives only; the 10 table-skill actives get no second line (their ability line covers them)"
  - "Ledger keys are bank:ABILITY_FLAVOR.<name> and bank:SKILL_FLAVOR.<name> (plain-string maps, no .line suffix)"

patterns-established:
  - "A limit the player needs is carried in plain words (plate, darkness, a crowd, nearly done for, not repeated this fight) and tagged 'accurate' in the ledger"

requirements-completed: [FLAVOR-04, FLAVOR-06]

coverage:
  - id: D1
    description: "21 ability lines and 10 passive-skill lines exist, one sentence, at most 100 characters, number-free, safe, unique across the layer, never equal to their rules text"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/flavor-layer.test.js; test/voice/safety-scan.test.js; test/voice/narrative-hygiene.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every ability and skill txt/txt2, the catalog, ABILITY_POOL, ONCE_A_FIGHT and the Phase 94 state labels are byte-identical"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/abilities-catalog.test.js; ability-state-copy.test.js; skill-audit.test.js; value-abilities.test.js; spell-skill-text-engine.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 31 lines read well, point the same way as their rules text and do not hide a cost or drawback"
    requirement: FLAVOR-06
    verification: []
    human_judgment: true
    rationale: "Voice and honesty against the rules text are judgments the scans cannot make; the 96-08 reviewer and the user's read of review.html decide"

duration: 25min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 03: Ability and passive-skill flavour Summary

**31 one-sentence player lines (21 for the abilities, the Bard's Sing included, and 10 for the passive special skills) in two frozen keyed exports, the `ability` and `skill` domains registered so every shared guard covers them, ledgered and on the review page. Nothing on screen changes yet (96-06 wires the surfaces).**

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `9af4cd70` | ABILITY_FLAVOR (21), the ability domain, flavorOfAbility, declared re-pins, BANK_REGISTRY row |
| 2 | `83c82602` | SKILL_FLAVOR (10), the skill domain, flavorOfSkill, declared re-pins, BANK_REGISTRY row |
| 3 | `c4eea194` | y-96-03.json (31 rows) and the regenerated review pages |

## The 31 lines

| Key | Line | Chars |
| --- | ---- | ----- |
| ABILITY_FLAVOR.Kata | Years of practice in one tidy motion, so the next blow lands better and bites harder. | 85 |
| ABILITY_FLAVOR.Death Touch | Announce the blow, then land it: the frail are finished, and the stunt is not repeated this fight. | 98 |
| ABILITY_FLAVOR.Sidestep | A brief lesson in not standing where the sword is going, which foes find terribly rude. | 87 |
| ABILITY_FLAVOR.Pommel Strike | The handle instead of the pointy bit, and a landed blow costs the foe its next move. | 84 |
| ABILITY_FLAVOR.Battle Roar | A bellow so unpleasant that foes aim worse at everyone on your side for a while. | 80 |
| ABILITY_FLAVOR.Second Wind | A deep breath, a dirty look at fate, and some of your health comes crawling back. | 81 |
| ABILITY_FLAVOR.Sweep | A generous arc that clips every foe in reach, but only if there is a crowd to be clipped. | 89 |
| ABILITY_FLAVOR.Brace | Plant your feet and clench: the next few blows that land hurt rather less than they might. | 90 |
| ABILITY_FLAVOR.Riposte | Defence with a grudge: for a moment, every foe that misses you gets your weapon in return. | 90 |
| ABILITY_FLAVOR.Taunt | Invite every foe to swing at you, and let your armour do the heavy lifting for a while. | 87 |
| ABILITY_FLAVOR.Overhead Blow | Everything you have behind a single swing: it hits much harder, and misses a little more. | 89 |
| ABILITY_FLAVOR.Last Stand | Saved for when you are nearly done for: a furious flurry from someone with nothing to lose. | 91 |
| ABILITY_FLAVOR.Silent Step | A strike from nowhere that hurts extra, spoiled by plate, darkness and a soldierly manner. | 90 |
| ABILITY_FLAVOR.Feint | A showy bluff that gets the foe's guard all wrong, so the blade lands better and bites deeper. | 94 |
| ABILITY_FLAVOR.Dirty Trick | A fistful of grit and no sense of honour: the foe goes blind and hits only by fluke. | 84 |
| ABILITY_FLAVOR.Smoke | Gone in a puff of showmanship: foes seldom hit you, and running away finally works. | 83 |
| ABILITY_FLAVOR.Cutpurse | A blow with a side hustle: if it lands, some of the foe's gold leaves with you. | 79 |
| ABILITY_FLAVOR.Poisoned Edge | A little something on the blade, so the foe keeps paying for the cut long after you stop. | 89 |
| ABILITY_FLAVOR.Hamstring | A sly cut behind the knee, after which the foe's blows land softer for the rest of the fight. | 93 |
| ABILITY_FLAVOR.Mark | Study the foe's soft spots until every strike afterwards hurts a bit more. | 74 |
| ABILITY_FLAVOR.Sing | Burst into song and let the tune choose the spell, free of charge and short on dignity. | 87 |
| SKILL_FLAVOR.Stealth | Your first blow of a fight is often a nasty surprise, as long as you left the plate at home. | 92 |
| SKILL_FLAVOR.Hardiness | Every wound, trap and bolt hurts a little less, and you stopped being impressed long ago. | 89 |
| SKILL_FLAVOR.Ambidextrous | Both hands pitch in on every strike, so each blow arrives with an encore. | 73 |
| SKILL_FLAVOR.Cooking | Whatever you kill, you can eat, and you do: a little health back and a ration for later. | 88 |
| SKILL_FLAVOR.Runes/Signs | Scrolls always do as they are told, and now and then they even survive the reading. | 83 |
| SKILL_FLAVOR.Locks | Chests surrender to patience, picks and brains, but a botched attempt loses the whole thing. | 92 |
| SKILL_FLAVOR.Sewing | A needle, thread and a rest after a decent meal put your armour back in shape, within reason. | 93 |
| SKILL_FLAVOR.Night Vision | The dark is just a room with the lights off, and it costs you nothing. | 70 |
| SKILL_FLAVOR.Heft | Extra muscle behind each swing, mail on your back and a kinder bill for upkeep. | 79 |
| SKILL_FLAVOR.Acute Hearing | Nothing sneaks up on you, and trouble announces itself through the walls, if never by name. | 91 |

## Lines the writer's rules made hard

- **Kata and Feint** share one rules sentence. Kata leans on practised form ("one tidy motion"), Feint on the bluff ("a showy bluff that gets the guard wrong"), so they stay different at a glance and neither repeats the txt wording.
- **The defensive group** (Sidestep, Brace, Riposte, Taunt, Smoke) each gets one verb of its own: not being there, clenching, hitting back, inviting every foe, vanishing. Taunt says "every foe" so the drawback (everyone swings at you) is in the line.
- **Silent Step:** the txt lists heavy armour, the dark, and a Guard or Soldier hero (sub-classes). "Spoiled by plate, darkness and a soldierly manner" covers all three without naming a sub-class or the doubling. The once-a-fight limit is left to RULES (no "once" allowed); a 96-08 watch item.
- **Death Touch:** the once-a-fight limit is carried as "not repeated this fight"; the under-15-hp threshold is "the frail".
- **Number words hide in idioms:** "double", "twice", "half", "once" and "ten" appear in the rules text of Taunt, Overhead Blow, Hamstring, Cutpurse and others; each line uses "much harder", "softer", "a blow with a side hustle" and similar instead.
- **Sing** says the tune chooses the spell (the singDesc "random" pick) and "free of charge", both true; the level cap and second-song limit stay in RULES.

## Declared re-pins

- `test/unit/flavor-layer.test.js`: domains 11 to 13, content keys 144 to 175, layer entries 144 to 175, each with a "Phase 96 (FLAVOR-04): declared re-pin" comment; RULES_TXT gains `ability` (Sing from `COMBAT_MENU_COPY.singDesc`) and `skill`; one new test that no skill line equals a txt2.
- `test/unit/flavor-text.test.js`: COUNTS gains `ability: 21` and `skill: 10`, the domain order appends `ability` then `skill`, total keys 144 to 175; two new tests (ability keys are the 20 catalog names plus Sing, Sing alone has no catalog row; skill keys are exactly the rows with no `active` marker, no key is an ability twin, actives read "").

## Tests run (targeted only, no full suite, no bot runs)

- Task 1: flavor-layer, flavor-text, identity-flavor, flavor-lines-not-serialized, content-tables, abilities-catalog, ability-state-copy, value-abilities, spell-skill-text-engine, skill-audit, voice-corpus, safety-scan, narrative-hygiene, hp-not-wp, stale-terms, shell-no-content-copies, content-is-pure-data: 378 tests, 378 pass. `voice-inventory --roll-under --hygiene --safety --count` prints `0`; `bank:ABILITY_FLAVOR*` counts 21.
- Task 2: the same set with spell-skill-text-wording in place of ability-state-copy and value-abilities: 341 tests, 341 pass; the count command still prints `0`.
- Task 3: `--check-ledgers --after` 64 ledger files, 0 errors; `narrative-review --check` pages in sync (1054 rows on 15 surfaces); narrative-review and voice-corpus tests: 40 tests, 40 pass.
- `git diff` against the plan base shows 0 removed lines under `content/` and no change to `engine`, `test/parity`, `test/determinism`, `test/unit/fixtures/shell-snapshots`, `src/browser/abilityStates.js` or the five audit docs.

## Deviations from Plan

None. TDD note: as in 96-01 and 96-02, the implementation and the re-pinned tests landed in one pass per task, so there is no separate failing-test commit.

Note: the worktree checks out every file as CRLF (`core.autocrlf=true`), including the files the plan lists as LF; the index holds LF and the `Edit` tool preserved each working file's existing endings. No CRLF-related test failure occurred.

## Known Stubs

None. No flavour line is shown on a surface yet by design (96-06 wires the combat ABILITIES rows, the Hero lists and the Final Sheet).

## Threat Flags

None. No new network, auth or storage surface. T-96-07: each line was read against its txt and limits are carried in plain words; T-96-08: `flavorOfAbility` and `flavorOfSkill` read by name through `flavorOf` and return "" for an unknown name (tested with hostile input); T-96-09: `src/browser/abilityStates.js` and `ability-state-copy.test.js` are byte-unchanged.

## Human verification (deferred to end of run)

- Read the 31 lines on `docs/narrative-pass/review.html` (surface "spells", keys `bank:ABILITY_FLAVOR.*` and `bank:SKILL_FLAVOR.*`) for voice, and check each against its rules text for honesty. Watch items: Silent Step ("a soldierly manner" for the Guard/Soldier clause, and the once-a-fight limit left to RULES), Death Touch ("the frail"), Last Stand ("nearly done for" as the under-a-quarter-hp gate), Overhead Blow ("misses a little more"), and the Kata/Feint pair.

## Self-Check: PASSED

- Files found: content/abilities.js (ABILITY_FLAVOR), content/skills.js (SKILL_FLAVOR), src/browser/flavorText.js (ability and skill domains), docs/narrative-pass/why/y-96-03.json (31 rows).
- Commits found: 9af4cd70, 83c82602, c4eea194.
