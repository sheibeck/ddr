---
phase: 98-achievement-catalog-play-console-import-zip
plan: 02
subsystem: content
tags: [achievements, copy, house-voice, play-games, voice-tooling]
requires:
  - "98-01: content/achievements.js with 77 entries and empty copy fields, voice registration"
provides:
  - "content/achievements.js: final name, description and line on all 77 entries (231 copy fields)"
  - "test/unit/achievements-copy.test.js: the copy contract (names, Play limits, house rules, ruling pins, hint pins, corpus walk)"
affects: [98-03, 100, 101]
tech-stack:
  added: []
  patterns: ["ruling pins and hint pins as must / mustNot regex tables keyed by id or track prefix", "copy filled by id anchor so no non-copy field can move"]
key-files:
  created:
    - test/unit/achievements-copy.test.js
  modified:
    - content/achievements.js
key-decisions:
  - "Depth ladder base is Downward Mobility (I, II, III)"
  - "Race names: Human Error, Elf Preservation, Dwarfing Expectations, Wilmsry Loves Company, Fridge Benefits, Troll Model"
  - "Class names: Power User (Magic User), Fighting Chance (Fighter), Honour Among Thieves (Thief)"
  - "Body-count descriptions say 'Have N <group> fall in your fights' and name Joiner and summon kills, so they never promise solo kills"
requirements-completed: [ACH-01, ACH-02, ACH-04]
duration: 12min
completed: 2026-10-05
status: complete
---

# Phase 98 Plan 02: Achievement Copy Summary

**All 231 copy fields written in the house voice: the user's names verbatim, 12 new pun names, Play descriptions held to Google's import rules and the counting rulings, and the 8 revealer lines carrying their hints. A 21-test copy contract holds all of it.**

## Accomplishments

- **Copy contract (Task 1, red).** `test/unit/achievements-copy.test.js` has 21 named tests. They cover:
  - the names: verbatim singles and bases, I to IV, the shared depth base, the 12 authored names against their placeholders, ASCII, and uniqueness after normalising;
  - the descriptions: Play limits, no thousands separator or hyphen range, never "level", British spelling, HP not WP, wilmst, the threshold in digits, and 41 ruling pins;
  - the lines: length, the Special Snowflake line, the hint-pin table checked against the catalog's revealers, and the 8 hint pins;
  - distinctness, and the 231-entry corpus walk.

  Every table is written out as literals in the test. Red run: 17 failed and 4 passed, and every failure came from empty copy.
- **Copy (Task 2, green).** All 77 triples were filled by id anchor, then reworked after a read-back:
  - accuracy fixes: Elf, Wilmsry and Magic User flavour checked against the race and class blurbs; Troll changed to "eating for two" (Trolls eat two rations a night); Turn Undead made neutral about who casts it;
  - variety: five "Somewhere a ..." openers and six number-first body-count lines rewritten.

## Task Commits

| Task | Commit | Summary |
|------|--------|---------|
| 1 | b8a6c96a | test: add the copy contract (red) |
| 2 | 5580d92f | feat: write the 77 achievement names, descriptions and unlock lines |

## Verification (targeted only; no full suite, no bot)

- The six test files together pass 93 / 93: `achievements-copy`, `achievements-catalog`, `voice/safety-scan`, `voice-corpus`, `stale-terms` and `content-is-pure-data`.
- `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints `0`. With `--key "bank:ACHIEVEMENTS.*"` it also prints `0`.
- The plan's node one-liner prints `77 0 You're a special snowflake.`
- `git diff` on content/achievements.js changes only `name:`, `description:` and `line:` lines.

## Least-sure entries (start the hand-off read here)

1. **Fridge Benefits** (Fridgian): this pun on "fringe benefits" relies on sound alone. Of the 12 authored names it is the weakest.
2. **Dressed to be buried in** (Fully Dressed description): it freezes in Play and is the darkest description. It is family-friendly, but it should be checked.
3. **Fully Dressed line** ("...trying it with nothing at all"): this is the hint closest to plainly stating Naked Ambition, though it gives neither the floor nor the first-step rule.
4. **Gravity Wins line** ("Sideways, into solid rock, is still taking challengers"): it points at Solid Miscalculation without naming the Cloak. Check that it still lands for a player who never notices the hint.
5. **Body counts "Have N <group> fall in your fights"**: this states the whoever-struck ruling plainly but is wordy. "Magical foes" adds "foes" after the group name, so the pin still matches.
6. **Terminal Condition description**: it says "once each in any of your runs" and "Not fatal". That is true to the lifetime flag pair, but it does not say the two can happen in different runs, which "any of your runs" only implies.
7. **Chicken** ("all of the cardio"): "cardio" is the one modern word in the set. "Only a won flee roll counts" is accurate, but it does not list the excluded escapes (door, Cloaker, Fighter withdrawal, Smoke).
8. **Elf Preservation line** ("a little over half a person's HP"): this rounds the 60% from the race blurb.
9. **Human Shields IV** ("You are the reason they ask for contracts"): it may read flat.
10. **Party Animal III line**: it uses single quotes around a quoted pitch. This is fine in game, because lines never go to Play.

## Deviations from Plan

None - plan executed exactly as written. The contract test adds three house-word guards beyond the listed pins: no coin or gold, no retired title, no US -or spelling. These match the voice brief's own rules.

## Issues Encountered

None.

## Known Stubs

None.

## Next Phase Readiness

Plan 98-03 can build the zip and the copy table from `ACHIEVEMENTS`. The names, which Play's resource names derive from, are unique after normalising.

## Self-Check: PASSED

- test/unit/achievements-copy.test.js and content/achievements.js are present.
- Commits b8a6c96a and 5580d92f are in `git log`.
