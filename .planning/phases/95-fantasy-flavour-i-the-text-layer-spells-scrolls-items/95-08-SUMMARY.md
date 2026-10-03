---
phase: 95-fantasy-flavour-i-the-text-layer-spells-scrolls-items
plan: 08
subsystem: text layer phase gate (flavour completeness test, RULES-surface model doc, 2.4.0 DRAFT notes, full gate)
tags: [flavour, text-layer, rules-layer, phase-gate, patch-notes, docs]
requires:
  - phase: 95-01
    provides: flavorText.js domain registry, flavor-layer guards, flavor-drift proof, PHASE_BASE
  - phase: 95-02
    provides: rulesLayer.js and the Always show the rules setting
  - phase: 95-03
    provides: spell, scroll, potion, tool and bag flavour maps
  - phase: 95-04
    provides: magic item, weapon and armour flavour maps
  - phase: 95-05
    provides: Grimoire, combat rows, find card surfaces and rules-surfaces.test.js
  - phase: 95-06
    provides: Gear tab and Gear sheet surfaces
  - phase: 95-07
    provides: store, sell list, loot list and drop shelf surfaces
provides:
  - "test/unit/flavor-layer.test.js: absence of a flavour map is a named failure (all 8 domains, 111 entries); no per-domain test skips"
  - "docs/TEXT-LAYERS.md: the final model document with the RULES-surface table (13 surfaces) for Phase 96 to reuse"
  - "docs/patch-notes/2.4.0.md: two Interface bullets (flavour layer with RULES; Always show the rules switch) and a standing test"
  - "the Phase 95 gate record: no guard lost, no rule or number moved, suite green, human-verification list"
affects: [96]
tech-stack:
  added: []
  patterns: ["a local missingMaps(domains) helper makes absence a named failure; per-domain tests assert the map exists instead of skipping"]
key-files:
  created: []
  modified:
    - test/unit/flavor-layer.test.js
    - docs/TEXT-LAYERS.md
    - docs/patch-notes/2.4.0.md
    - test/unit/rules-surfaces.test.js
key-decisions:
  - "The 2.4.0 Headline is left unchanged (Claude's discretion; the user agrees the draft at release time); both new bullets sit under Interface because no rule changed."
  - "docs/NARRATIVE-PASS.md and docs/narrative-pass/review.html needed no regeneration: every Phase 95 ledger landed with its pages, so Task 3 made no commit."
requirements-completed: [FLAVOR-01, FLAVOR-02, FLAVOR-05]
status: complete
duration: ~50 min
completed: 2026-10-03
---

# Phase 95 Plan 08: The phase gate Summary

A missing flavour map is now a named failing test (all 8 domains, 111 entries, no skips), the RULES surface has its full written model for Phase 96, the 2.4.0 DRAFT notes name the flavour layer and the Always show the rules switch, and the full gate is green: no v2.3 guard lost, no engine byte, rule or number moved, only the seven declared text-layer fixtures changed.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1. A missing flavour map is a failure | 90712e3c | `missingMaps(domains)` helper and `mapOf(d)` assertion in `flavor-layer.test.js`; new tests "the layer is complete: all 8 domains export their map, 111 entries" and "teeth: a domain whose map is missing is named by the completeness check"; the four per-domain tests and the whole-layer uniqueness test no longer skip. RED was watched first (2 failures, `missingMaps is not defined`), then GREEN. |
| 2. RULES-surface table and 2.4.0 DRAFT notes | b23f8cc5 | `docs/TEXT-LAYERS.md` (Guards updated; "## The RULES surface" with The component, The setting, The rule every surface follows, Surfaces (13-row table), Deliberately plain, Reuse in Phase 96); two Interface bullets in `docs/patch-notes/2.4.0.md`; the 2.4.0 DRAFT test appended to `rules-surfaces.test.js`. |
| 3. The phase gate | none | No file needed changing (the review pages were already current), so no commit; results are recorded below. |

## No guard lost

All commands run against PHASE_BASE `cb5f77ecc7e08943939f9111fec2321d23f83feb`.

| Group | Check | Result |
| --- | --- | --- |
| The 18 guard test files (item-text-engine, item-text-wording, item-text-refresh, item-audit, item-audit-fixes, spell-audit, spell-skill-text-engine, spell-skill-text-wording, spell-skill-audit-fixes, skill-audit, authored-ranges, value-identity, value-text, value-abilities, value-ledger, value-cleanup, identity-text, identity-audit) | `git diff --stat PHASE_BASE -- <18 files>` | empty (byte-identical) |
| The five audit docs | `git diff --stat PHASE_BASE -- <5 docs>` | empty (byte-identical) |
| `engine/`, `test/parity`, `test/determinism`, `test/roundtrip/serialize-rehydrate.test.js` | `git diff --stat PHASE_BASE -- ...` | empty |
| `content/` | `git diff PHASE_BASE -- content \| grep -c '^-[^-]'` | 0 (additions only: the eight flavour maps) |
| `docs/patch-notes/2.3.0.md`, `src/browser/patchNotesData.js`, `android/version.properties` | `git diff PHASE_BASE -- ...` | empty |

| Audit doc | Rows at PHASE_BASE | Rows at HEAD | Pinned |
| --- | --- | --- | --- |
| docs/ITEM-AUDIT.md | 121 | 121 | 121 |
| docs/SPELL-AUDIT.md | 112 | 112 | 112 |
| docs/SKILL-AUDIT.md | 32 | 32 | 32 |
| docs/IDENTITY-AUDIT.md | 168 | 168 | 168 |
| docs/VALUE-LEDGER.md | 100 | 100 | 100 |

Drift proof (`node --test test/unit/flavor-drift.test.js`, 2 pass): both child runs fail as required, naming "Heal: every number the text states is claimed by one fact and equals the engine" (spell-skill-text-engine) and "truth: every stated number equals the engine's, for every row" (item-text-engine). A drifted number in the technical layer still fails the real guards.

Test files outside the guard list that Phase 95 re-pinned (reported, not hidden; each declared in its plan's SUMMARY): `settings.test.js`, `shell-gear-toolbar.test.js`, `combatMenu.test.js`, `find-card-scroll-rows.test.js`, `find-card-full-bag.test.js`, `gear-view-models.test.js`, `gear-tab-dom.test.js`, `gear-sheet-dom.test.js`, `store-rows.test.js`, `item-stat-lines.test.js` ("agreement (store DOM)", re-pinned in 95-07 commit f129157b), `shell-tab-snapshots.test.js` (header declarations). None is on the guard list.

## Fixtures moved against PHASE_BASE

`git diff --ignore-cr-at-eol --stat PHASE_BASE -- test/unit/fixtures/shell-snapshots` lists exactly the seven declared text-layer moves: `mu.hero.txt`, `thief.gear.txt`, `mu.gear.txt`, `thief.gear-sheet-bag.txt`, `thief.gear-sheet-worn.txt`, `thief-store.store.txt`, `mu-store.store.txt`. Unmoved: `thief.hero.txt`, `fighter.abilities-states.txt`, `fighter.hero-in-combat.txt`. `grep -c "Phase 95 (FLAVOR-" test/unit/shell-tab-snapshots.test.js` = 4 (the declaration paragraphs).

## Gate results

- Full `npm test`: tests 10404, pass 10396, fail 0, cancelled 0, skipped 8, duration about 178 s. (95-07 baseline 10401 / 10393 / 0 / 8; this plan adds three tests: the completeness test, its teeth, the 2.4.0 notes test. The 8 skips predate the phase; the 32 flavour skips are gone.)
- Voice and review: `node tools/narrative-review.mjs --check` reports pages in sync, and a regeneration left `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html` unchanged (empty `git status`); `node tools/voice-inventory.mjs --check-ledgers --after`: 61 ledger files, 0 errors; `--roll-under --hygiene --safety --count` prints `0`; the Phase 95 new-line rows are 114 (`y-95-02.json` 3, `y-95-03.json` 59, `y-95-04.json` 52), every `before` empty.
- `npm run build:www`: exit 0 (stamped 2.3.0 (13); `www/` is gitignored).
- `node tools/patch-notes.mjs --check`: `patch notes 2.3.0: OK (Play cut 474/500)`; `validatePatchNotes(md, "2.4.0")` returns [] (pinned by the new test).
- `npm run boot:check`: runs on this machine now, and reports PASS no-uncaught, PASS painted, **FAIL graves**, PASS title (4 of 4 runs at HEAD). Not a regression: a build of PHASE_BASE `cb5f77ec` (a throwaway detached worktree, since removed) fails the same `graves` check in 3 of 3 runs. It is the known pre-existing boot:check `graves` problem listed in STATE.md (tooling row: "boot:check `graves` flake"; Phase 50 environment block). Recorded, not fixed (out of scope).
- Line endings: `flavor-layer.test.js`, `TEXT-LAYERS.md`, `2.4.0.md`, `rules-surfaces.test.js` all `w/lf`; none `w/mixed`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] rules-surfaces.test.js line endings after a checkout**
- **Found during:** Task 2
- **Issue:** a first append attempt corrupted the new test's escapes, so I restored the file with `git checkout -- <file>`; with `core.autocrlf` the working copy came back CRLF while the index is LF (the plan requires LF).
- **Fix:** re-applied the edit and converted the file back to LF (`git ls-files --eol` shows `i/lf w/lf`).
- **Files modified:** test/unit/rules-surfaces.test.js
- **Commit:** b23f8cc5

Otherwise the plan executed as written. Task 3 made no commit because nothing was stale.

## Known Stubs

None.

## Threat Flags

None. This plan adds a test and documentation only.

## Human verification (end of phase, batched)

Deferred to the milestone device checklist by this project's convention; none of these was performed by the executor. Device: Pixel 7, text size L; walk every surface first with Always show the rules Off, then On.

1. The Grimoire: niche label and flavour; RULES opens the exact old line; the body is still open after a tab switch.
2. Combat SPELLS and ITEMS: rows with the RULES column fit the capped list (the 206 px `.cb-sub-list` with a 48 px toggle and an open body); the cost tag, the blocked reason and the live resist hint stay visible; a toggle is inert while a round plays; no ghost toggle right after a submenu opens.
3. The find card: the flavour line; the toggle works while the line is still typing and never dismisses or pulses the card.
4. Gear tab: WORN rows and BAG cards show flavour and still open the sheet; the armour row keeps its wear note; CONSUMABLES toggles sit under each description.
5. The Gear sheet: flavour under the title, RULES around the stats, the sheet still scrolls.
6. The store: the toggle beside each BUY row never buys; the Sealed scroll; the Your gear sell list.
7. The loot card: flavour plus the advice line; TAKE ALL and LEAVE ALL still in view.
8. The drop shelf on a full largest bag (find and loot cards): the list still fits and scrolls; a drag never drops; a toggle tap never drops.
9. Settings: Always show the rules On opens every RULES line at once on every surface; Off restores the toggles; the choice survives a relaunch.
10. The narrative review: open `docs/narrative-pass/review.html` and read all 114 new Phase 95 lines (111 flavour lines and the three RULES words), marking any line to rewrite.

Carried forward from the 95-02, 95-05, 95-06 and 95-07 SUMMARYs (not already named above):

11. (95-02) The RULES chip's look: a legible 48 px target in muted gold (`#a8955f` on the dark panel) beside a combat or drop row.
12. (95-05) A tap on a freshly opened SPELLS or ITEMS submenu's toggle is not arm-guarded (an inspection): it reveals the rules rather than being swallowed. Confirm that reads as harmless.
13. (95-06) The CONSUMABLES toggle's tap target size and where it sits relative to the USE or READ button.
14. (95-06) Always-on rules bodies on WORN rows and BAG cards: row height at text size L, and a tap on a body still opens the Gear sheet.
15. (95-06) The sheet's RULES toggle while the sheet scrolls, and that a revealed body stays open after USE or a swap refreshes the sheet.
16. (95-07) Store rows: the 48 px RULES column beside BUY and the italic still fit at text size L.
17. (95-07) The sell list's toggle (left-aligned under the italic, above Sell and Drop).
18. (95-07) The drop shelf: the existing two-line clamp on `.mw-find-drop .g-n i` now covers flavour plus the usable-by tag, so a long flavour could clip the tag at large text; confirm that reads acceptably.

Claude's-discretion calls for the user to confirm or overrule:

19. The niche label sits before the flavour on the Grimoire and the combat spell row (95-05).
20. The armour WORN row keeps its live wear note; armour flavour shows on its BAG card and in its sheet (95-06).
21. The WORN weapon row's voice line gives way to the weapon type's flavour; the old line is its RULES (statically shown with Always on) and the first line of the sheet's RULES body (95-06).
22. A jewel or cloak SWAP FOR or EQUIP candidate in the sheet is described by its flavour; weapon and armour candidates keep their compare line (95-06).
23. The Sealed scroll now has flavour, and its RULES are the scroll rules plus the reader's odds, the same text the Gear SCROLLS row states; it had no text before (95-07).
24. The loot card puts the advice line (verdict, can't-use reason, bag comparison, usable-by) on its own second italic line under the flavour; a jewel or potion with no advice shows no second line (95-07).
25. A RULES body repeats a usable-by tag that also shows first on the row (store, BAG card, loot): the tag is functional so it stays visible, and the body holds the full old text.
26. The 2.4.0 Headline is left unchanged; the two new bullets sit under Interface (this plan).
27. Open item from the gate: `npm run boot:check` fails its `graves` check on this machine, identically at PHASE_BASE; consider fixing or migrating the tool separately.

## Self-Check: PASSED

- FOUND: test/unit/flavor-layer.test.js ("the layer is complete: all 8 domains export their map, 111 entries"), docs/TEXT-LAYERS.md (`## The RULES surface`, `### Surfaces`), docs/patch-notes/2.4.0.md (both bullets), test/unit/rules-surfaces.test.js ("patch notes: 2.4.0 is a DRAFT")
- FOUND commits: 90712e3c, b23f8cc5
