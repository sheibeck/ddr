---
quick_id: 261005-opm
slug: race-class-floor-10
date: 2026-10-05
autonomous: true
---

# Quick 261005-opm: Race and class achievements at floor 10, 20 points each

User ruling (2026-10-05, after reading the Phase 98 copy): the 9 race and class achievements (`race_human`, `race_elven`, `race_dwarven`, `race_wilmsry`, `race_fridgian`, `race_troll`, `class_magic_user`, `class_fighter`, `class_thief`) require reaching **floor 10** (was 5) and are worth **20 points** each (was 10). The total moves 1,110 → **1,200** (headroom 890 → **800**). Naked Ambition and Teetotaler stay at floor 5. Nothing else changes (types, hidden set, reveal pairs, list order, names).

## Task 1: catalog, tests, copy
- `content/achievements.js`: threshold 5 → 10 and points 10 → 20 on the 9 entries; rewrite their `description` (and `line` wherever it states or implies floor 5) for floor 10 in the same voice, keeping Play rules (no commas, numbers without separators, ≤500 chars) and the existing names.
- `test/unit/achievements-catalog.test.js` and `test/unit/achievements-copy.test.js`: update the pinned literals (thresholds, points, 1110 → 1200 total, any floor-5 ruling pins for races/classes). Keep Naked Ambition/Teetotaler pins at floor 5.
- acceptance: `node --test test/unit/achievements-catalog.test.js test/unit/achievements-copy.test.js test/unit/achievements-zip.test.js test/unit/achievements-zip-cli.test.js test/unit/achievements-docs.test.js test/voice/safety-scan.test.js test/unit/voice-corpus.test.js test/unit/stale-terms.test.js test/determinism/content-is-pure-data.test.js` all pass; `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints 0.

## Task 2: docs, zip, planning records
- Regenerate `docs/ACHIEVEMENTS-COPY.md` with `node tools/achievements-zip.mjs --copy-table`; update any 1,110 / 890 / floor-5-for-races figures in `docs/ACHIEVEMENTS.md`.
- `node tools/achievements-zip.mjs --build` then `--check` (PASS); record the new sha256, size and point total.
- Planning records: in `.planning/phases/98-achievement-catalog-play-console-import-zip/98-CONTEXT.md` (Points table, totals, races/classes definitions), `98-VERIFICATION.md` (1,110 and the sha256), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`: change race/class "floor 5" to "floor 10" and 1,110/890 to 1,200/800 where they refer to the catalog, noting "(quick 261005-opm, user 2026-10-05)". Leave Naked Ambition/Teetotaler at floor 5. Phase 99 text that says "each race and class to floor 5" becomes floor 10.
