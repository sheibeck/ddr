---
quick_id: 261005-opm
slug: race-class-floor-10
date: 2026-10-05
status: complete
commits: [7bdcb24e, 6c77b9d7]
---

# Quick 261005-opm: Race and class achievements at floor 10, 20 points each

**One-liner:** the 9 race and class achievements now need floor 10 and are worth 20 points; catalog total 1,110 -> 1,200 (headroom 890 -> 800), Play zip rebuilt.

User ruling 2026-10-05. Naked Ambition and Teetotaler stay at floor 5. Types, hidden set, reveal pairs, list order and names are unchanged.

## What changed

- **Task 1 (7bdcb24e):** `content/achievements.js` (threshold 5 -> 10, points 10 -> 20, descriptions and lines rewritten for floor 10 on the nine entries); pinned literals updated in `test/unit/achievements-catalog.test.js` (locked table, group sums 120 and 60, total 1200, headroom 800), `test/unit/achievements-copy.test.js` (race and class ruling pins now `floor 10`), `test/unit/achievements-zip.test.js` and `test/unit/achievements-zip-cli.test.js` (points 1200).
- **Task 2 (6c77b9d7):** `docs/ACHIEVEMENTS-COPY.md` regenerated, `docs/ACHIEVEMENTS.md` figures 1200 / 800, zip rebuilt and checked, and the Phase 98 `98-CONTEXT.md` (points table, totals, races and classes definition) and `98-VERIFICATION.md` (1,200 and the new sha256), plus `REQUIREMENTS.md` TRACK-03 and `ROADMAP.md` Phase 99 text, now say floor 10 for races and classes. `PROJECT.md` has no catalog figures, so it needed no change.

## Zip

`build/achievements/ddr-achievements.zip` (git-ignored): 9557487 bytes, sha256 `a1da9cdd18d45ce5ce8e161d7f8a5c18ca241d43d8aa610f9d77f5f715e2ef07`. `--check`: PASS, 79 entries, 77 achievements, 1200 points, 57 incremental, 8 hidden. The previous zip hash was `75ee34ff...5d34`.

## Verification

Targeted run (catalog, copy, zip, zip-cli, docs, safety-scan, voice-corpus, stale-terms, content-is-pure-data): 166 tests, 166 pass after the docs regeneration. `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints 0. No full suite and no bots, per the dispatch rules.

## Deviations from Plan

None. Task 1's acceptance tests for the docs freshness and docs figures failed between the two commits (the docs were Task 2's work) and passed once Task 2 landed.

## Self-Check: PASSED
