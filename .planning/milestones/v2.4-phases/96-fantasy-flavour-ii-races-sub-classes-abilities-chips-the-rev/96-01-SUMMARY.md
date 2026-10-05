---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 01
subsystem: ui
tags: [flavour, identity, races, classes, text-layer, tag-guard, narrative-review]

requires:
  - phase: 95-fantasy-flavour-i-the-text-layer-spells-scrolls-items
    provides: FLAVOR_DOMAINS, flavorOf, everyFlavorLine, the flavor-layer scans, the two-layer model
provides:
  - identityDomain builder (record map with a lines() string adapter and a tags() record view)
  - flavorOfIdentity, flavorTagsOf, tagsOfRecord
  - per-domain shape rule in flavor-layer (identity domains 200 characters, one or two sentences, NFC, no astral)
  - tag guard with teeth (identity-flavor) and the domain-agnostic not-serialized walk
  - RACE_FLAVOR (6 tagged records) and CLASS_FLAVOR (3 lines), ledgered and on the review page
affects: [96-02 sub-class lines, 96-05 roller and Hero surfaces, 96-08 review]

tech-stack:
  added: []
  patterns:
    - "Identity flavour is a frozen map of { line, good, bad, neutral? } records beside the content; lines() adapts it to plain strings so every shared scan runs unchanged"
    - "Tags are identityEntries ids, guarded live (side, uniqueness, neutral rule), never typed from a separate vocabulary"

key-files:
  created:
    - test/unit/identity-flavor.test.js
    - test/roundtrip/flavor-lines-not-serialized.test.js
    - docs/narrative-pass/why/y-96-01.json
  modified:
    - src/browser/flavorText.js
    - content/flavor.js
    - test/unit/flavor-layer.test.js
    - test/unit/flavor-text.test.js
    - tools/lib/voice-corpus.mjs
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html

key-decisions:
  - "Keyed by the live tables: CLASS_FLAVOR has 3 keys (Magic User, Fighter, Thief), not the 4 CONTEXT mentions"
  - "Number rule stays strict for identity lines (no number words), so TEXT-LAYERS.md step 4's number-word allowance is not used"
  - "identityDomain is exported (not internal) so the builder is tested against a local fake export with no real domain"

patterns-established:
  - "A tag-bearing domain exposes tags(); the identity-flavor live loop picks up every such domain automatically (sub in 96-02)"
  - "Re-pin comments: each moved count carries a one-line 'Phase 96 (FLAVOR-03): declared re-pin' note"

requirements-completed: [FLAVOR-03, FLAVOR-06]

coverage:
  - id: D1
    description: "Identity record shape, lines() adapter, flavorOfIdentity/flavorTagsOf (never throw, never mutate)"
    requirement: FLAVOR-03
    verification:
      - kind: unit
        ref: "test/unit/flavor-text.test.js#identityDomain / tagsOfRecord / flavorTagsOf cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tag guard with teeth; every non-Human identity has a real good and bad; Human neutral"
    requirement: FLAVOR-03
    verification:
      - kind: unit
        ref: "test/unit/identity-flavor.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Race and class lines: number-free, within 200 characters and two sentences, safe, unique, not equal to their notes, not serialized"
    requirement: FLAVOR-03
    verification:
      - kind: unit
        ref: "test/unit/flavor-layer.test.js; test/roundtrip/flavor-lines-not-serialized.test.js; test/voice/safety-scan.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 9 lines read well and each race's good and bad really come through in the wording"
    requirement: FLAVOR-06
    verification: []
    human_judgment: true
    rationale: "Voice and whether the wording conveys the tagged good and bad are judgments the scans cannot make; the 96-08 reviewer and the user's read of review.html decide"

duration: 25min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 01: Identity record shape, tag guard and the race and class lines Summary

**Tagged `{ line, good, bad }` identity records with a lines() adapter, a live tag guard with teeth, a 200-character two-sentence identity rule, and nine ledgered race and class lines (Human neutral, five races tagged to real identityEntries ids).**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-04
- **Tasks:** 3 of 3
- **Files:** 3 created, 7 modified

## PHASE_BASE and audit row counts

- **PHASE_BASE:** `bc1fc900aa9a7ca69ba7f3d0832e4c12da86ccf0` (HEAD before Task 1; every later Phase 96 plan reads it here)
- Audit row counts (`grep -c '^| '`) at PHASE_BASE: ITEM-AUDIT 121, SPELL-AUDIT 112, SKILL-AUDIT 32, IDENTITY-AUDIT 168, VALUE-LEDGER 100. All five docs are byte-unchanged at the end of this plan.

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `bfe2f415` | identity record shape, per-domain shape rule, tag guard, not-serialized walk (no domain registered) |
| 2 | `572072af` | RACE_FLAVOR and CLASS_FLAVOR, race and class domains registered, declared re-pins, voice-corpus rows |
| 3 | `9aa6d494` | y-96-01.json (9 rows) and the regenerated review pages |

## The 9 lines

| Key | Line | Chars | Good ids | Bad ids |
| --- | ---- | ----- | -------- | ------- |
| Human | No perks, no penalties and no excuses: the yardstick every other race is measured against, and the one the dungeon forgets first. | 129 | neutral: human-neutral | none |
| Elven | Shopkeepers adore you, Humans hear you out and your aim is rude. Then anything lands a blow and you remember how little of you there is, and how easy to hit. | 157 | elven-prices, elven-humans, race-to-hit | race-hp-mul, race-foe-to-hit |
| Dwarven | Cheap in the shops, slow to starve, heavy of hand and kind to your armour. Everything in here swings at you as if it had been practising, which the dwarves call a fair trade. | 174 | dwarven-prices, race-upkeep, race-dmg, race-armor-wear | race-foe-strike-step |
| Wilmsry | Everyone wants to haggle with you, you mend like a lizard and you can talk down nearly anything. You will not take a Magic User along, and you learn so slowly that survival teaches you nothing. | 193 | wilmsry-talk, wilmsry-haggle, race-heal2x | wilmsry-joiners, race-sp-mul |
| Fridgian | No armour, no Samurai career and no say in who strikes first, but a hide like a boot and a habit of losing the plot and swinging again. The Game Master has notes. | 162 | race-frenzy, race-hide | race-no-armor, race-no-samurai, race-slow |
| Troll | Sturdy from the first step and brutal with every swing. Shops overcharge you, foes find you easy to hit and your appetite is a municipal problem. | 145 | race-flat-hp, race-dmg | troll-prices, race-size-face, race-eats |
| Magic User | Fragile, unarmoured by temperament and entirely in the grimoire's hands: the spells are the class, and everything else is decoration. | 133 | none (class) | none |
| Fighter | Hit points, heavy armour and a poor opinion of spellbooks: the Fighter stands in the doorway and takes it, which is the whole job description. | 142 | none (class) | none |
| Thief | Light on hit points and lighter on armour, but the only class with a full toolbox of skills. The plan is to be somewhere else when it matters, and the toolbox is how. | 166 | none (class) | none |

## Lines the writer's rules made hard

- **Dwarven:** the race's size is a perk (foes get a worse swing at a small target) while its foe-strike-step is the drawback; "swings at you as if it had been practising" carries only the drawback, and the size perk (race-size-face) is deliberately left untagged because no wording hints at it.
- **Wilmsry:** carries two goods, a bad and a refusal in about 190 characters; it sits close to the 200 ceiling (193). Elven/Fridgian skip a couple of real entries too (race-strike-step, race-size-dmg) rather than tag what the words do not say.
- **Thief:** "the only class with a full toolbox of skills" is a joke built on CLASS_NOTE's "twelve value points, more than anyone else gets"; "only" is slightly stronger than the rules. A watch item for the 96-08 reviewer; not a number or a rule claim.
- **Troll:** the rule bans "twice" and "double", so the two-rations appetite is carried by "appetite is a municipal problem" (race-eats) and the starvation penalty (race-upkeep) is not tagged.

## Declared re-pins

- `test/unit/flavor-layer.test.js`: domains 8 to 10, content keys 111 to 120, layer entries 111 to 120 (race 6 + class 3); each carries a "Phase 96 (FLAVOR-03): declared re-pin" comment.
- `test/unit/flavor-text.test.js`: COUNTS gains race 6 and class 3, domain order gains `race`, `class`, total keys 111 to 120.
- Shape rule: `shapeProblems(line, rule)` now takes a per-domain rule; the default rule (100 characters, exactly one sentence) is byte-for-byte the old behaviour for the eight Phase 95 domains.

## Tests run (targeted only, no full suite, no bot runs)

- Task 1: flavor-layer, flavor-text, identity-flavor, flavor-lines-not-serialized, flavor-not-serialized, identity-footer, identity-text, identity-contract: 201 tests, 201 pass.
- Task 2: the above plus content-tables, voice-corpus, safety-scan, narrative-hygiene, hp-not-wp, stale-terms, shell-no-content-copies, content-is-pure-data, identity-audit: 342 tests, 342 pass; `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints `0`; `bank:RACE_FLAVOR*` counts 6 and `bank:CLASS_FLAVOR*` counts 3.
- Task 3: `--check-ledgers --after` 62 ledger files, 0 errors; `narrative-review.mjs --check` pages in sync (999 rows on 15 surfaces); narrative-review and voice-corpus tests: 40 tests, 40 pass.

## Deviations from Plan

None to the rules. Notes:

- **TDD ordering (Task 1):** the implementation and the tests landed in one working pass, so no separate failing-test commit exists. The "teeth" cases (doctored records, a 201-unit line, three sentences, a decomposed accent, an astral character, a throwing Proxy) are what prove the guards catch what they claim.
- **Task 1 acceptance criterion** `FLAVOR_DOMAINS.length === 8` held at the Task 1 commit and is superseded by Task 2, which registers race and class (10 domains).
- **`identityDomain`, `tagsOfRecord` exported** (the plan said "internal builder"): so the builder is exercised against a local fake export without registering a real domain.
- Git printed "LF will be replaced by CRLF" warnings on commit for LF files (the repo's autocrlf setting); the index holds LF and the working files keep their endings (content/flavor.js, voice-corpus.mjs, the two review pages `w/crlf`; the rest `w/lf`). No CRLF test failure occurred.

## Known Stubs

None. No flavour line is shown on a surface yet by design (the roller and Hero tab read these maps in 96-05).

## Threat Flags

None. No new network, auth or storage surface. T-96-01/02/03 mitigations are in place: flavorOfIdentity/flavorTagsOf never throw and never mutate (Proxy and unknown-key teeth), the not-serialized walk covers every present domain, and tags are checked against identityEntries.

## Human verification (deferred to end of run)

- Read the 9 lines on `docs/narrative-pass/review.html` (surface "blurbs", keys `bank:RACE_FLAVOR.*` and `bank:CLASS_FLAVOR.*`) for voice, and judge whether each race's good and bad really come through in the wording (Elven fragile but sharp, Dwarven cheap and tough but swung at hard, Wilmsry bargainer who refuses Magic Users, Fridgian armourless with a tough hide, Troll strong but costly). Watch the Thief "only class with a full toolbox" wording.

## Self-Check: PASSED

- Files found: src/browser/flavorText.js, content/flavor.js, test/unit/identity-flavor.test.js, test/roundtrip/flavor-lines-not-serialized.test.js, docs/narrative-pass/why/y-96-01.json.
- Commits found: bfe2f415, 572072af, 9aa6d494.
- `git diff --stat bc1fc900 -- engine test/unit/fixtures/shell-snapshots` and the guard and audit docs print nothing; `git diff HEAD -- content | grep -c '^-[^-]'` printed 0 at Task 2 (additions only).
