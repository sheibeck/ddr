---
phase: 89-item-audit-fixes
plan: 01
subsystem: items
tags: [audit, items, docs, test, balance-rulings]
requires: []
provides:
  - "docs/ITEM-AUDIT.md: one audited row per item (text / engine / canon / verdict / pinned by), the Systems (ITEM-06) list, findings for Phases 91 and 92, Balance calls Q1 to Q6 and the user's Rulings"
  - "test/unit/item-audit.test.js: coverage and consistency guard for the table"
affects: [89-02, 89-03, 89-04, 89-05, 89-06, 89-07, 89-08, 89-09, 89-10, 90, 91, 92]
tech-stack:
  added: []
  patterns: ["doc-parsing audit test (rations-audit precedent) with a checkDoc() that is itself tested against doctored copies"]
key-files:
  created: [docs/ITEM-AUDIT.md, test/unit/item-audit.test.js]
  modified: []
key-decisions:
  - "Q1: remove every floor-12 special effect on all five items; keep the depth-rising resist and apply it uniformly to every item effect a foe can resist"
  - "Q2 to Q5: option A (recommended) on each"
  - "Q6: the Walnut Staff casts the full Weaken (option B)"
requirements-completed: [ITEM-01, ITEM-06]
duration: one session
completed: 2026-09-30
status: complete
---

# Phase 89 Plan 01: Item audit table and the batched balance rulings Summary

The item audit (docs/ITEM-AUDIT.md, 14 family tables, 12 Systems rows) with a coverage test, and the user's six balance rulings recorded and handed to the owner plans. No engine, content, shell or parity file changed.

## What was built

- **docs/ITEM-AUDIT.md**: Weapons 24, Magic weapons, Armour 5, Magic armour, Cloaks 7, Jewellery 8, Staves 8, Wands (not in game), Potions 11 (the stock healing potion first), Scrolls and books, Tools 3, Lockpicks, Bags 4, Treasure 24 (chest, foe drop, every Misc Magic and Faerie outcome). Every row has Text, Engine, Canon, Verdict and Pinned by. The Systems (ITEM-06) table, Findings for other phases, Balance calls Q1 to Q6 and Rulings follow.
- **test/unit/item-audit.test.js** (9 tests): fails on a missing, duplicate, merged or reordered row, an empty cell, an unknown verdict, an owner that is not plan 89-01 to 89-10, a `match` row whose cells admit a gap, a pinned-by path that does not exist, a balance call whose question already has a ruling, and a ruled question with no ruled row.

## Rulings for the fix plans

All ruled by the user on 2026-09-30 in one reply.

- **Q1 (owners 89-08 engine, 89-09 text):** remove the "past floor 12" special effects on all five: Amulet of Stone, Oak Staff, Cedar Staff, Birch Staff, Walnut Staff. No three-round cap, no floor-12 extra resist: a landed stone kills and a landed gas sleeps for the whole fight at any depth. Keep the resist roll that rises with depth, and apply it uniformly to every item or staff effect a foe can resist (not only these five). The spell side of the same rule is Phase 90's. Text: drop the "past floor 12" sentences, "squares" becomes foes, state the resist.
- **Q2 (89-05, wording 89-07):** a Joiner cannot use the party-moving and leading items (Cloak of Flying, Cloak of Ether, Bracelet of Flight, Amulet of Light, Helm of Knowledge, Amulet of Stone); the Company panel says why in one line.
- **Q3 (89-05):** a Magic User Joiner reads its starting scroll on joining: a spell it can learn at its level, rolled from a derived stream, goes into its book and the scroll is spent.
- **Q4 (89-08 engine, 89-07 panel and store surface):** each store offers a repair line for each Joiner's armour on the hero's rule, a tenth of the armour's cost per point.
- **Q5 (89-08):** each cure potion cures only its own kind; drunk against the wrong affliction (or none) it is refused and kept, not spent.
- **Q6 (89-08 engine, 89-09 text):** the Walnut Staff casts the full Weaken: half damage and foes hit only on their top three faces, matching the Weaken spell; its floor-12 limit goes per Q1.

Pre-owned fixes the table carries: Enlarge 89-02; Poplar Staff party heal and Pendant source link 89-03; Joiner armour soak 89-04; Joiner item use, wear-on-join and item timers 89-05; Joiner combat policy and chips 89-06; Company panel USE and bot 89-07; Death typo and TEXT-01 89-09; the guard 89-10.

## Scope notes for the orchestrator (owner plan scope to check)

- **89-08 gained work:** Q1 (remove the floor-12 knee from every item effect and give all resistable item effects the uniform depth-rising resist), Q4 (Joiner repair store line), Q5 (cures per kind), Q6 (full Weaken on the staff). **89-09 gained text:** Q1 wording on five items, Q6 wording, plus the audit's own text findings below.
- **Audit text findings owned by 89-09:** Cloak of Speed reads "once every 50" but is ready 100 after use; Cloak of Flying "once every 50" is ready 70 after use; Cloak of Ether does not state its 10-square window or that ending inside a wall kills; Studded, Mail and Plate hide their `bulk` agility cost; every bag tier also caps wilmst and rations and the text says slots only; every staff text omits its recharge time; weapons with a to-hit modifier or a two-face crit never state it on the item (your "stays" ruling is kept); the Helm of Knowledge and Gauntlet, Anklet, Invisibility and Crystal Staff "faces" wording (TEXT-01).
- **Phase 92 findings:** after Enlarge's +11 the Gauntlet of the Giant stays at +2; the bot's worn-cloak and staff-heal reads; Phase 91: Wilmsry double heal is stock-potion only, Joiner hide soak, Helm parley wording.

## Deviations from Plan

- **[Rule 2 - missing decision]** Q6 added: the Walnut Staff runs a reduced Weaken (halving only, `engine/items.js` L1867 never sets the to-hit cap `engine/magic.js` L290 sets), which the user's earlier "text-only" ruling had assumed equal. Ruled B at the checkpoint.
- Potions use one row per POTIONS entry (as the plan's test spec requires); the store and found names share it because both resolve to the same activation. The adjacency neighbours (stock healing potion vs Healing, Cloak of Flying vs Bracelet of Flight, the two cures) each keep their own row.
- The verdict vocabulary also accepts `ruled (YYYY-MM-DD)` and `fixed engine/text (89-NN)`.
- Birch Staff carries `ruled (Q1, ...)` rather than `fix text (89-09)` because Q1 adds an engine change to it; its text work stays with 89-09.

No auth gates. No stubs. No threat flags (docs and a doc-parsing test only).

## Verification

- `node --test test/unit/item-audit.test.js`: 9 pass, 0 fail.
- `git diff --stat -- engine content src mazeworld.html test/parity`: nothing.
- No row reads `balance call` (awk over `## Rows`: 0); Rulings has 6 `- Q` entries.
- `npm test` not run: no engine, shell or content code changed.

## Human verification (deferred to end of run)

1. None on the device for this plan: the user reviewed the Balance calls at the checkpoint. At milestone close, skim docs/ITEM-AUDIT.md: every item you know from play has a row, and its verdict reads true.

## Commits

- f41cab3e: docs(89-01): item audit table and its coverage test
- (next) docs(89-01): record the batched balance rulings and summary

## Self-Check: PASSED

docs/ITEM-AUDIT.md, test/unit/item-audit.test.js and this file exist; commit f41cab3e exists.
