---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 12
subsystem: ui
tags: [flavour, skills, final-sheet, rules-layer, gap-closure, criterion-4]

requires:
  - phase: 96-03
    provides: SKILL_FLAVOR (10 passive lines), the skill domain and flavorOfSkill
  - phase: 96-06
    provides: the Hero passive-skill row shape and the Final Sheet tricks read-only RULES pattern
  - phase: 96-10
    provides: the flavour sweep and its two todo findings
provides:
  - SKILL_FLAVOR now covers all 21 skill rows (11 new active-skill lines), the skill domain keys every skill row
  - the Hero special-skills list reads a bought active skill's flavour first, its exact txt behind RULES
  - the Final Sheet worn and bag notes read the item's Phase 95 flavour line, the exact text only with Always show the rules on
  - both 96-10 todo tests are ordinary passing tests; flavor-sweep reports todo 0, fail 0
  - docs/narrative-pass/why/y-96-12.json (11 ledger rows) and regenerated review pages
affects: [96-11]

tech-stack:
  added: []
  patterns:
    - "An active skill reads its own skill line, worded apart from its twin ability line, so one sheet never repeats a sentence"
    - "A read-only surface adds an additive view-model field (flavor) and leaves the pinned field (note) untouched"

key-files:
  created:
    - docs/narrative-pass/why/y-96-12.json
  modified:
    - content/skills.js
    - src/browser/flavorText.js
    - src/browser/heroTab.js
    - src/browser/finalSheet.js
    - tools/lib/voice-corpus.mjs
    - test/unit/flavor-layer.test.js
    - test/unit/flavor-text.test.js
    - test/unit/flavor-sweep.test.js
    - test/unit/rules-surfaces.test.js
    - test/unit/final-sheet.test.js
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html

key-decisions:
  - "The 11 lines go in SKILL_FLAVOR itself (appended after the passives, table order), not a sibling map: one export, one bank, one ledger key scheme (bank:SKILL_FLAVOR.<name>)"
  - "The Final Sheet worn row keeps `note` as the exact rules text (the HUD-03 pin reads it) and gains `flavor`; the bag gains `items` [{ name, flavor, rules }] beside the pinned `names`"
  - "The bag flavour is looked up by name from the held item (flavorOfItem), so no usable-by tag from the Gear card rides along"
  - "The SKILL_FLAVOR bank trigger text drops the word 'passive' (it now covers every skill row)"

patterns-established:
  - "Declared re-pin comments name plan 96-12 and what moved (counts 222 to 233, skill keys 10 to 21, case (y) split)"

requirements-completed: [FLAVOR-04, FLAVOR-06]

coverage:
  - id: D1
    description: "Every active special skill has a one-sentence, number-free flavour line of at most 100 characters, held in the skill domain map and never on a serialized row"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/flavor-layer.test.js (skill domain, 21 keys, number/shape/uniqueness rules); test/unit/flavor-text.test.js (skill domain test); test/roundtrip/flavor-lines-not-serialized.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Hero special-skills list shows a bought active skill's flavour with its exact txt behind a RULES toggle"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/rules-surfaces.test.js (y2) over every active skill of both tables; (y) tolerant half; test/unit/flavor-sweep.test.js 'Hero special-skills list shows no rules sentence for a bought active skill'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Final Sheet worn and bag notes show flavour; the exact text appears only with Always show the rules on, with no control; an unflavoured item keeps today's note"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/final-sheet.test.js: three new 96-12 cases plus the HUD-03 pins unedited; test/unit/flavor-sweep.test.js 'Final Sheet worn and bag sections carry no rules sentence outside a RULES body'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 11 new lines read well, are honest against their rules text, and carry the voice"
    requirement: FLAVOR-06
    verification: []
    human_judgment: true
    rationale: "Voice and honesty are judgments; the independent reviewer of plan 96-11 and the user's read of review.html decide. No verdict file was written here."

duration: 40min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 12: Active-skill flavour and the Final Sheet worn and bag notes Summary

**The two surfaces the 96-10 sweep found still printing rulebook sentences now read flavour: a bought active skill on the Hero tab (11 new skill lines, exact text behind RULES) and the Final Sheet's worn and bag notes (the item's Phase 95 line, exact text only with Always show the rules on). Both sweep todo tests are ordinary passing tests.**

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `3a55971b` | 11 active-skill lines in SKILL_FLAVOR, the skill domain keys every skill row, Hero row via the existing renderer, declared re-pins, Hero todo removed |
| 2 | `4c78042a` | Final Sheet worn `flavor` and bag `items`, static final:worn / final:bag bodies, three new final-sheet cases, Final Sheet todo removed |
| 3 | `a9f3eb60` | y-96-12.json (11 rows), bank trigger wording, regenerated review pages |

## The 11 new lines (SKILL_FLAVOR, appended in table order)

| Skill | Line |
| ----- | ---- |
| Kata | Courtyard drilling pays off in a tidy strike that wants a breather before the encore. |
| Death Touch | A theatrical promise to end someone, kept only if the swing lands and the foe is hurt already. |
| Sidestep | Practised footwork that has foes swinging at where you were a moment ago, for a short while. |
| Pommel Strike | A knock on the head with the blunt end, and a foe who is hit stands there thinking about it. |
| Battle Roar | Volume as a weapon: foes flinch, and their swings go wide of your whole side for a moment. |
| Second Wind | A pep talk to yourself that happens to work, and needs a few rounds before it will again. |
| Sweep | Fancy broadwork for a crowd: everyone gets a taste, nobody gets the full helping. |
| Feint | Eyes left, blade right: a classic that works nicely, then wants a few rounds off. |
| Dirty Trick | Sand, a thumb and an elbow, applied to a foe's face until it can barely see for a while. |
| Smoke | A vanishing act with a good exit line, so foes swing at scenery and fleeing works for a spell. |
| Silent Step | Nobody heard that, least of all the foe; plate, gloom and a soldier's habits spoil the best of it. |

Each is worded apart from its twin ABILITY_FLAVOR line, since the Hero tab and the Final Sheet show both rows. Limits the player needs are carried in plain words (the wait before a repeat, the crowd Sweep needs, a blow that must land, the three things that spoil Silent Step) and tagged "accurate" in the ledger. Watch items for the 96-11 reviewer: Death Touch ("hurt already" for the under-15-hp rule), Sweep ("the full helping" for the half-damage rule), Silent Step ("a soldier's habits" for the Guard/Soldier clause, the once-a-fight limit left to RULES).

## What changed

- **content/skills.js:** 11 entries appended to SKILL_FLAVOR (no line removed; the older comment saying the actives get no second line is left in place and superseded by a new comment beside the entries).
- **src/browser/flavorText.js:** the skill domain `keys()` is the passives then the actives (21); `flavorOfSkill` doc updated.
- **src/browser/heroTab.js:** no logic change was needed (the 96-06 renderer already shows flavour plus RULES for any skill with a line); two comments updated. The Hero row for an active skill is now `<b>Kata</b><i>flavour</i>` + RULES toggle holding the exact txt.
- **src/browser/finalSheet.js:** worn rows gain `flavor` (from gearWornModel's `lead`); `note` is untouched. The bag gains `items: [{ name, flavor, rules }]` beside `names`. The renderer shows the flavour as the note, and with Always show the rules on mounts a static `final:worn:<key>` or `final:bag:<n>` body via mountRules (no button, no handler, no innerHTML). Armour keeps its live wear note (no flavour by design, as in Phase 95), an empty slot keeps its empty line, an unknown item keeps today's note.
- **tools/lib/voice-corpus.mjs:** the SKILL_FLAVOR bank trigger reads "a special skill's flavour line (the Hero tab's special-skills list and the Final Sheet)". No other registry change (no new map).

## Declared re-pins

| File | What moved |
| ---- | ---------- |
| test/unit/flavor-layer.test.js | layer 222 to 233 entries and content keys (three assertions), RULES_TXT skill comment, txt2 test name; declared comments |
| test/unit/flavor-text.test.js | COUNTS skill 10 to 21, total 222 to 233, the skill domain test rewritten (passives then actives, 21 keys, each active reads a line different from its ability line) |
| test/unit/rules-surfaces.test.js | case (y) "active rows keep today's markup" split: (y) keeps the tolerant unknown-skill half, new (y2) pins every active skill of both tables (flavour, toggle, closed body, exact txt) |
| test/unit/flavor-sweep.test.js | both `{ todo }` flags removed; comments say the findings are closed; no assertion loosened |
| test/unit/final-sheet.test.js | three new cases (flavour present and `note` exact; off/on rendering with ids, no control; unflavoured item keeps today's note). The HUD-03 pins are unedited |

No snapshot moved: thief.hero and the other shell fixtures stayed byte-identical (shell-tab-snapshots 156 pass without regeneration), so no fixture was regenerated or restored.

## Tests run (targeted only, no full suite, no bot runs)

- `flavor-layer, flavor-text, rules-surfaces, heroTab, shell-tab-snapshots`: 156 tests, 156 pass, 0 fail.
- `flavor-sweep`: 36 tests, 36 pass, `# todo 0`, `# fail 0` (`grep -c "todo:"` prints 0).
- `final-sheet, flavor-sweep, rules-surfaces`: 106 pass, 0 fail, todo 0.
- `narrative-review, voice-corpus`: 40 pass. `flavor-drift, flavor-lines-not-serialized, safety-scan, narrative-hygiene, skill-audit, abilities-catalog, dead-lockdown`: 68 pass.
- `voice-inventory --roll-under --hygiene --safety --count`: last line `0`. `--check-ledgers --after`: 67 ledger files, 0 errors. `narrative-review --check`: pages in sync (1112 rows).
- Engine gate: `git diff d6d2b3a5 --stat -- engine test/parity test/determinism test/unit/fixtures` prints nothing; content/skills.js removes 0 lines versus the plan start.

## Deviations from Plan

**1. [Rule 2 - view-model shape] Final Sheet bag.** The plan said "each worn and bag row" gets a `flavor`. The bag had names only (pinned by HUD-03 as `vm.bag.names`), so the bag gained an additive `items` array beside `names` rather than changing `names`. A bag item with a flavour line now shows it as a note under its name (new on-screen content; the plan's truth statement names bag notes).

**2. Trailers.** The project rulings name `Claude Opus 5.5 (1M context)`; commits carry exactly the two lines the rulings give.

## Open handoff for plan 96-11 (not fixed here, by rule)

- `test/unit/flavor-review.test.js` "live: every present verdict file is valid and a round-1 file covers every reviewed key" now FAILS (`# fail 1` in that file), and `node tools/flavor-review.mjs --check` reports 11 errors: the 11 new bank:SKILL_FLAVOR keys have no verdict in 96-review-1.json. This is the expected consequence of adding reviewed lines after round 1; per the rulings I wrote no verdict file. 96-11 must give the 11 keys their independent verdicts and decide how the "round 1 covers every reviewed key" rule (also planned in flavor-review-closed.test.js Test 1) treats lines added after round 1 (for example, scope the rule to the keys that existed at round 1, or record the new keys' first verdict as the closing round).
- 96-11's `docs/TEXT-LAYERS.md` final contents text still says skill = 10 passive skills, "Total: 222 keys" and "the actives are covered by their ability line". These are now 21 skills (10 passive + 11 active), 233 keys, and the active skills have their own line. The Final Sheet row of the Surfaces table also now covers the worn and bag sections (ids final:worn:<key>, final:bag:<n>), and the Hero skills row covers active skills. The 2.4.0 DRAFT notes count (111 new lines) is now 122.
- Neither docs/TEXT-LAYERS.md nor any test pins those numbers today (flavor-drift and the guards passed).

## Known Stubs

None.

## Threat Flags

None. No new network, storage or auth surface. The new lines live in a frozen content map looked up by name and never on a serialized row (flavor-lines-not-serialized passes); the Final Sheet stays control-free (no button, handler or innerHTML, HUD-03 pins unedited); `flavorOfItem` and `flavorOfSkill` return "" for anything unknown.

## Human verification (deferred to end of run)

Pixel 7 walk:
- Buy an active skill (Fighter Kata, Thief Smoke) and read its Hero special-skills row with Always show the rules off, then on: flavour first, RULES toggle holding the exact text when off, the text open and no toggle when on.
- Read the 11 new lines on the Hero tab and on docs/narrative-pass/review.html for voice and for honesty against each rules text (watch items above).
- After a death, read the Final Sheet WORN and THE BAG sections with the setting off (flavour only, no rules sentence, no control) and on (the exact text sits under each flavoured row, still no button). Check an armour row (keeps its wear note) and an empty slot (keeps its empty line).
- Check the Final Sheet still scrolls and the extra bag note lines fit at the largest text size.

## Self-Check: PASSED

- Files found: content/skills.js, src/browser/flavorText.js, src/browser/heroTab.js, src/browser/finalSheet.js, tools/lib/voice-corpus.mjs, docs/narrative-pass/why/y-96-12.json, the five test files.
- Commits found: 3a55971b, 4c78042a, a9f3eb60.
