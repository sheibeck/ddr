---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 08
subsystem: tooling
tags: [flavor-review, verdicts, narrative-review, FLAVOR-06]
requires:
  - phase: 96-04
    provides: the last of the 225 Phase 95 and 96 player lines and their ledgers
provides:
  - tools/lib/flavor-review.mjs and tools/flavor-review.mjs (worksheet, skeleton, check, closed)
  - verdict merge in tools/narrative-review.mjs (byte-identical with no verdict file)
  - docs/narrative-pass/verdicts/96-review-1.json (round 1: 211 pass, 14 revise)
affects: [96-09, 96-11]
tech-stack:
  added: []
  patterns: [hash-bound verdict files beside the why-ledgers, plan-boundary reviewer independence]
key-files:
  created:
    - tools/lib/flavor-review.mjs
    - tools/flavor-review.mjs
    - test/unit/flavor-review.test.js
    - docs/narrative-pass/verdicts/96-review-1.json
  modified:
    - tools/narrative-review.mjs
    - docs/narrative-pass/README.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "Verdicts live in docs/narrative-pass/verdicts/*.json, one file per round, each row bound to the SHA-1 prefix of the line it judged"
  - "Staleness is not a schema error: validateVerdicts ignores hashes, validateClosed and the pages flag a stale latest verdict"
  - "On the pages pass/revise count only a non-stale latest verdict; stale and no-verdict are separate buckets, so the four add up to the reviewed total"
requirements-completed: []
duration: one session
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 08: The FLAVOR-06 review mechanism and round 1 Summary

**Hash-bound verdict files with five validators and a worksheet CLI, merged into both review pages, plus an independent round-1 review of all 225 Phase 95 and 96 player lines: 211 pass, 14 revise.**

R1_BASE: `01c3237c1b1c4a24a8793baca010c305651716f0`

## Performance

- Tasks: 2 of 2
- Commits: `626b3418` (Task 1: tooling, page extension, tests, README section), `65015b74` (Task 2: round-1 verdicts and regenerated pages)

## What was built

- `tools/lib/flavor-review.mjs`: `REVIEW_CHECKS`, `REVIEW_CHECKLIST`, `USER_OWNED_LINES` (only `bank:SPELL_FLAVOR.Heal`), `lineHash`, `reviewedLines`, `readVerdicts`, `validateVerdicts`, `validateClosed`, `worksheet`, `formatWorksheet`. Nothing is hand-kept: domains resolve through `FLAVOR_DOMAINS` (`exportName`), rules texts come from the live content, the shell tables (`CONDITION_EXPLAIN`, `FOE_EFFECT_EXPLAIN`, `HERO_OUT_EXPLAIN`, `HASTE_SPELL_EXPLAIN`, the Bubble mirror sentence) are sliced out of `mazeworld.html` and asserted found.
- `tools/flavor-review.mjs`: `--worksheet [--domain]`, `--skeleton --round N --reviewer --out`, `--check`, `--closed`, `--root`. Skeleton rows carry `verdict: null`, `--out` must be directly under `docs/narrative-pass/verdicts` and must not exist; exit 0/1/2 as specified.
- `tools/narrative-review.mjs`: `buildReview({ base, ledgers, verdicts })` adds `review` only when verdict files exist; a `**review** (...)` paragraph is appended to a row's Why cell (Markdown through `mdCell`, HTML through `esc`), a "The review verdicts" section with a final table and a table per round. With no verdict file both pages are byte-identical (the unedited `narrative-review.test.js` passes; the pages were unchanged after Task 1).
- `docs/narrative-pass/README.md`: "The Phase 96 review (FLAVOR-06)" section (reviewed set, five checks, file format, round rules, closed rule, independence boundary, commands).
- `test/unit/flavor-review.test.js`: 25 tests (hash, reviewedLines, every validator defect, validateClosed and userOwned, page integration with escaping, stale and null-skeleton behaviour, determinism and no-verdict byte identity, CLI exit codes, live coverage and worksheet resolution).

## Round 1 totals (reviewer: this executor)

| Domain (bank) | Pass | Revise |
|---|---:|---:|
| SPELL_FLAVOR | 38 | 3 |
| SCROLL_FLAVOR | 1 | 0 |
| POTION_FLAVOR | 10 | 0 |
| TOOL_FLAVOR | 4 | 0 |
| BAG_FLAVOR | 3 | 0 |
| MAGIC_ITEM_FLAVOR | 21 | 2 |
| WEAPON_FLAVOR | 24 | 0 |
| ARMOR_FLAVOR | 4 | 1 |
| RACE_FLAVOR | 6 | 0 |
| SUB_FLAVOR | 22 | 2 |
| CLASS_FLAVOR | 3 | 0 |
| ABILITY_FLAVOR | 18 | 3 |
| SKILL_FLAVOR | 9 | 1 |
| CHIP_FLAVOR | 45 | 2 |
| RULES_COPY | 3 | 0 |
| **Total** | **211** | **14** |

## Revise list (input for plan 96-09)

Every key below is the ledger key; all 14 verdicts are in `docs/narrative-pass/verdicts/96-review-1.json` with the same notes.

| Key | Fails | Note |
|---|---|---|
| bank:SPELL_FLAVOR.Bubble | voice, consistent | Plain description with no joke, and 'then pops' ignores that the shield lingers as a cushion for the rest of the round; give it the house attitude and keep both halves (the bounce, then the cushion). |
| bank:SPELL_FLAVOR.Sense Presence | consistent | 'The dark stops mattering' promises more than the rules deliver: it is a fight-only relief and lights nothing; keep the no-ambush joke but scope the dark to the fight. |
| bank:SPELL_FLAVOR.Size of the Behemoth | consistent | 'The smaller foes flee' reads as physical size, but the rule is foes below your level that fail their resist; say lesser or weaker foes and keep the hedge that some resist. |
| bank:MAGIC_ITEM_FLAVOR.Gauntlet of the Giant | consistent | 'Far easier to aim at' overstates a +1 to hit for foes; keep the bigger-target joke, drop the 'far'. |
| bank:MAGIC_ITEM_FLAVOR.Pendant of Fortitude | consistent | 'A mere insult' promises the blow is nullified, but the rule only halves one attack; soften the claim. |
| bank:ARMOR_FLAVOR.Mail | voice | A plain inventory of the armour with no joke or deadpan; keep 'best left to fighters' but give it the attitude Plate has. |
| bank:SUB_FLAVOR.Master of Arms.line | voice | A flat list of the good and the bad, with 'no running, no clever exits' lifted from the rules text; find the joke in a fighter who can neither talk nor leave and keep a tagged good and a tagged bad in the wording. |
| bank:SUB_FLAVOR.Samurai.line | family | 'Suicidal' is the self-harm stem the safety wordlist bans ('suicide'); the old rules text carries it, but this first-read line should not; say reckless, hopeless or doomed and keep the joke that the book does not soften it. |
| bank:ABILITY_FLAVOR.Brace | consistent, numberFree | 'The next few blows' is a count in disguise and runs past the two blows the rule covers; say the hits that land hurt less, with no count. |
| bank:ABILITY_FLAVOR.Overhead Blow | voice | A straight description of the trade with no joke or deadpan; lead with attitude, keep the bigger hit and the worse aim. |
| bank:ABILITY_FLAVOR.Mark | voice | A plain restatement of the rule in other words with no joke; give it the house attitude. |
| bank:SKILL_FLAVOR.Cooking | consistent | 'Whatever you kill, you can eat' contradicts the rules text, where only beasts feed you; scope it to beasts. |
| bank:CHIP_FLAVOR.unlock | voice | A flat description with no joke; the rules text already owns the 'lock will not be consulted' line, so give this one its own deadpan. |
| bank:CHIP_FLAVOR.ability | voice | A plain restatement of the rules sentence with no joke or attitude at all. |

Pass-with-note lines (not revise, not required): Weaken and Walnut Staff ('every foe ... who swing' is a singular with a plural verb); Knight and Woodsman (the second sentence is copied word for word from the rules text, so it shows twice with the rules open). `bank:SPELL_FLAVOR.Heal` (the user's own example) passed on its merits; no `userOwned` flag was needed.

Standards applied: a number word counts only when it carries a rule quantity (a count, duration, multiplier, fraction or threshold); idioms such as 'day one', 'the first step' and 'both hands' were not failed; 'swing and swing again' (Barbarian) conveys the extra attack without a number and was passed. A voice fail means no discernible joke, deadpan or attitude, not a weak one. Every race and sub-class line was checked for at least one tagged good and one tagged bad in its wording (all pass; Human is the tagged-neutral yardstick).

Finding outside the scope of this plan: the unchanged RULES text for Samurai (`SUB_NOTE` in `content/flavor.js`, line 72) also contains the word 'suicidal'. Plan 96-09 can only fix the player line; whether to touch the canon rules text is a user decision, and the Play content-rating answers may want to know the word exists.

## Reviewer statement

The 225 lines were written by Phase 95 plans 03 and 04 (and 02 for the three RULES_COPY toggle words) and Phase 96 plans 01 to 04. This executor ran in a fresh context, authored none of them, edited no content, shell or engine file, and set every verdict by reading the worksheet (line, hash, rules text, tagged good and bad texts) and writing the verdict file by hand; the skeleton carried only nulls and no script assigned a verdict. All 225 recorded hashes match the current lines (`flavor-review --check` reports no stale verdict).

## Verification (targeted tests only)

- `node --test test/unit/flavor-review.test.js test/unit/narrative-review.test.js test/unit/voice-corpus.test.js`: 65 pass, 0 fail. `test/unit/authored-ranges.test.js` (it names the README): 64 pass, 0 fail.
- `node tools/flavor-review.mjs --check`: 1 verdict file valid. `node tools/narrative-review.mjs --check`: pages in sync. `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count`: last line `0`.
- Independence gate: `git diff --stat 01c3237c -- content src engine mazeworld.html test/unit/fixtures test/unit/narrative-review.test.js` prints nothing. Line endings: `tools/narrative-review.mjs`, `docs/narrative-pass/README.md`, `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html` stay CRLF in the working tree (the index is LF, `core.autocrlf`); the new files are LF.
- The full suite and the bots were not run, by ruling.

## Deviations from Plan

- **[Process]** Task 1's implementation was written before the test file rather than RED first; the tests were then run and two of my own assertions (key order, a Markdown escaping literal) were corrected, no implementation change was needed. No behaviour is untested as a result.
- **[Design]** `validateVerdicts` takes an optional `{ coverage }` flag (default true) so `validateClosed` can reuse the schema checks without duplicating the round-1 coverage errors with its own "unreviewed" errors. `--skeleton` refuses to overwrite an existing file. Verdict rows are written one per line (compact) so they can be edited line by line.
- **[Design]** The verdict file also rejects unknown row fields and a `userOwned` revise (the plan only required the Heal-key restriction).

No auth gates. No Rule 1 to 4 deviations beyond the above.

## Known Stubs

None.

## Threat Flags

None. The worksheet tool prints to stdout and `--skeleton` writes only a new file directly under `docs/narrative-pass/verdicts`; verdict notes are escaped in both pages (tested with angle brackets, ampersand, pipe, asterisk and underscore).

## Human verification (deferred to end of run)

- Open `docs/narrative-pass/review.html` on the Pixel 7 or on desktop and read the 225 lines with their verdicts (the "The review verdicts" section at the top, then each row's Why cell). This joins the v2.4 milestone device checklist. Check that the review paragraphs read clearly on the phone layout and that the 14 revise notes make sense to you.
- Decide whether the 'suicidal' wording in the unchanged Samurai rules text (SUB_NOTE) should stay.

## Self-Check: PASSED

- Files: `tools/lib/flavor-review.mjs`, `tools/flavor-review.mjs`, `test/unit/flavor-review.test.js`, `docs/narrative-pass/verdicts/96-review-1.json` exist.
- Commits `626b3418` and `65015b74` exist on `worktree-agent-a2f92299eb615d2ec`.
