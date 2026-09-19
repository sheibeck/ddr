---
phase: 44-retire-the-classic-engine-from-the-shell
plan: 03
subsystem: infra
tags: [dead-code, shell, content-single-source, dossier, source-pin]

# Dependency graph
requires:
  - phase: 44-retire-the-classic-engine-from-the-shell (Plan 02)
    provides: "mazeworld.html at 6600 lines, engine gate diff empty, layers 2+3 deleted, tools/shell-sweep.mjs reachability-aware refs/orphans"
provides:
  - "window.__mzTables — module-assigned, frozen bridge object carrying RACE_NOTE/CLASS_NOTE/SUB_NOTE/ROMAN/THRESHOLDS/WEAPONS/FIGHTER_SKILLS/THIEF_SKILLS/RACES from content/index.js to the classic renderers"
  - "The nine classic table copies deleted from mazeworld.html; every surviving classic read (mzCombatReport, R_, skillTable, paint, renderGraves, renderPartyRoster, renderEncounter, renderRail, the classic boot resume line) rewritten to the bridge"
  - "test/unit/shell-no-content-copies.test.js — the DEAD-02 source pin: derives its name set from Object.keys(content/index.js) at test time (79 names measured), fails on any future classic copy, proves 24/6/3 dossier byte-equality"
affects: [44-04, 45-collapse-the-phase-37-hedges, 47-shell-modularisation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "window.__mzTables = Object.freeze({...}) — same bridge shape as window.__mzBags/__mzState/__mzIconMap, assigned in the module before boot() and read lazily inside classic functions, never at parse time"
    - "Source-pin name set derived from Object.keys(await import(content/index.js)) at test time, never a hand-written list — a future content/ export is automatically covered by the same pin"

key-files:
  created:
    - test/unit/shell-no-content-copies.test.js
  modified:
    - mazeworld.html
    - test/unit/shell-company-panel.test.js

key-decisions:
  - "content/index.js measured at 79 export names, not the plan's phase_facts estimate of 85 — the plan's own acceptance criteria never hard-gated on the exact figure (only 'at least 80' in the action narrative, not a graded grep); the test asserts >= 70 (safely below the measured 79, robust to small future additions) and this SUMMARY records the correction"
  - "shell-company-panel.test.js's single-row SUB_NOTE Cutthroat pin deleted outright (not re-pointed) — the classic SUB_NOTE table it asserted against no longer exists; shell-no-content-copies.test.js's byte-equality pin covers the same Cutthroat row plus all 23 other SUB_NOTE rows, all 6 RACE_NOTE rows and all 3 CLASS_NOTE rows, a strictly stronger replacement"
  - "The ROMAN[lvl - 1] regex pin in shell-company-panel.test.js was left untouched, per the plan — a plain substring/regex match against 'window.__mzTables.ROMAN[lvl - 1]' still finds 'ROMAN[lvl - 1]' as a substring, so the existing assertion continues to prove the field is present without needing a rewrite"

patterns-established: []

requirements-completed: [DEAD-02]

coverage:
  - id: D1
    description: "window.__mzTables bridges the nine content/ tables to the classic renderers; nine classic copies deleted; every surviving read rewritten"
    requirement: DEAD-02
    verification:
      - kind: unit
        ref: "npm test (3240/3240, fail 0 after Task 1's commit); node --test test/unit/shell-company-panel.test.js (11/11, fail 0)"
        status: pass
      - kind: other
        ref: "node tools/shell-sweep.mjs refs <9 names> (all survivors are the two documented import lines + the bridge assignment + the pinned RACES roller import + ROLLER_RACE_NAMES read); npm run build:www; npm run boot:check (4 PASS); git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt (empty)"
        status: pass
    human_judgment: false
  - id: D2
    description: "test/unit/shell-no-content-copies.test.js — DEAD-02 source pin, 5 tests, fail-first proven against an injected classic copy"
    requirement: DEAD-02
    verification:
      - kind: unit
        ref: "node --test test/unit/shell-no-content-copies.test.js (5/5, fail 0); npm test (3245/3245, fail 0)"
        status: pass
      - kind: other
        ref: "MZ_HTML-pointed run against a scratch copy with an injected 'const SUB_NOTE = {};' — test 1 FAILS naming 'SUB_NOTE (classic script)'; unset MZ_HTML run passes clean"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-09-19
status: complete
---

# Phase 44 Plan 03: window.__mzTables Bridge + DEAD-02 Source Pin Summary

**Made `content/` the single source for the nine tables the shell still renders: `window.__mzTables` (module-assigned, frozen, the established `__mzBags`/`__mzState` bridge pattern) hands `RACE_NOTE`/`CLASS_NOTE`/`SUB_NOTE`/`ROMAN`/`THRESHOLDS`/`WEAPONS`/`FIGHTER_SKILLS`/`THIEF_SKILLS`/`RACES` across, every surviving classic read (the Hero-tab dossier, `mzCombatReport`, `R_`, `skillTable`, `paint`, `renderGraves`, `renderPartyRoster`, `renderEncounter`, `renderRail`, the classic boot resume line) now reads the bridge, the nine classic copies are gone, and a new source-pin test derives its name set from `content/index.js` at test time so it fails on any future second copy — with a 24/6/3 byte-equality proof for the dossier strings.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2
- **Files created:** 1 (`test/unit/shell-no-content-copies.test.js`)
- **Files modified:** 2 (`mazeworld.html`, `test/unit/shell-company-panel.test.js`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Bridge the nine content/ tables across as window.__mzTables, rewrite every surviving classic read, delete the nine classic copies** - `20b818a` (refactor)
2. **Task 2: The DEAD-02 source-pin test — no second copy of any content/ export, and 24/6/3 dossier byte-equality** - `8da2ce3` (test)

**Plan metadata:** (this commit)

## Deleted symbols

All line ranges are the pre-Plan-03 line numbers (mazeworld.html was 6600 lines at the start of this plan; every deletion was located and verified by declaration text, not by these numbers, per the plan's own line-number-is-stale warning).

| Symbol | Range (pre-plan) | Notes |
|---|---|---|
| `THRESHOLDS` | L1798 | array `[0, 201, 501, 901, 1501]` — byte-identical to `content/misc-tables.js`'s copy; no drift, deleted for the single-source rule |
| `ROMAN` | L1799 | array `["I", "II", "III", "IV", "V"]` — byte-identical to `content/misc-tables.js`'s copy; no drift |
| `WEAPONS` | L1801–1829 | 24 keys; the "book's" doc comment above it stayed (still heads nothing after deletion — no orphaned banner here, this table had no dedicated section comment) |
| `FIGHTER_SKILLS` | L1830–1845 (comment + table) | the "Special skills, bought at creation..." comment described only this pair of tables — deleted with it |
| `THIEF_SKILLS` | L1846–1856 | |
| `RACES` | L1860–1872 | `skillTable`/`skill`/`maxCharges` (kept, logic not data) sit directly around this table — extracted individually, not as one contiguous block |
| `RACE_NOTE` | L1891–1898 | the "the Maze Master's opinion of you" banner (L1890) headed only these three tables — deleted with them |
| `CLASS_NOTE` | L1899–1903 | |
| `SUB_NOTE` | L1904–1931 | |

### Kept, with the live reference

None — all nine names report `refs NAME: 0` outside the documented import-line/bridge-assignment survivors (see Gate outputs below).

## Added symbols

- `window.__mzTables` (module script) — `Object.freeze({ RACE_NOTE, CLASS_NOTE, SUB_NOTE, ROMAN, THRESHOLDS, WEAPONS, FIGHTER_SKILLS, THIEF_SKILLS, RACES })`, assigned at L5099 (before `await boot(freshSeed)` at L5449), next to `window.__mzBags = BAGS;` in the same comment style.
- A separate `import { RACE_NOTE, CLASS_NOTE, SUB_NOTE, ROMAN, THRESHOLDS, WEAPONS, FIGHTER_SKILLS, THIEF_SKILLS } from "./content/index.js";` line (L5063), directly below the pinned `import { RACES, CLASSES, BAGS, ABILITY_BY_ID } from "./content/index.js";` line (which stays byte-identical — `RACES` is reused from that existing binding).
- `test/unit/shell-no-content-copies.test.js` — 5 tests: (1) no classic/module declaration of any `content/index.js` export; (2) the dossier reads `RACE_NOTE`/`CLASS_NOTE`/`SUB_NOTE` only through `window.__mzTables`; (3) the bridge is assigned before `await boot(`; (4) every surviving classic read of the six other tables goes through the bridge; (5) 24 `SUB_NOTE` + 6 `RACE_NOTE` + 3 `CLASS_NOTE` strings are byte-equal (`===`) to `content/flavor.js` and appear nowhere verbatim in `mazeworld.html`.

## Drift discarded

`content/` is canon; zero bytes of `content/` changed this plan (confirmed by the engine-gate diff, empty at both commit boundaries). The classic copies this plan deleted had drifted from `content/` as follows (measured by diffing the pre-plan classic tables against their `content/` counterparts):

| Table | Rows drifted | Detail |
|---|---|---|
| `RACE_NOTE` | 3 of 6 (Dwarven, Wilmsry, Fridgian) | `content/flavor.js`'s rows mention mechanics the classic prose never caught up to (Dwarven's armour-wear-at-half-rate, Wilmsry's "not one of them will so much as travel with you", Fridgian's hide-soaks-2/never-wastes-a-swing-on-a-corpse) |
| `CLASS_NOTE` | 0 of 3 | byte-identical — no drift |
| `SUB_NOTE` | 13 of 24 (Knight, Guard, Woodsman, Master of Arms, Bard, Pickpocket, Pilfer, Cloaker, Ninja, Wizard, Court Mage, Illusionist, Summoner) | each row picked up a newer mechanical clause the classic string never received (e.g. Cloaker's flee-after-first-blow rule, Pilfer's hands-refuse-to-use wording, Illusionist's Phantom-Host-from-day-one) |
| `RACES` | field-level, not row-count | `content/races.js` added `armorWear` (Dwarven), `hide` (Fridgian), and deliberately flipped `foeToHit` from −1 to +1 for Elven (Phase 31 rules-bug fix, documented in `content/races.js`'s own comment) — the classic copy still had the old, buggy −1 |
| `WEAPONS` | 17 of 24 | `lab`/`cost`/dice values re-balanced (Phase 39 GEAR-01); the classic copy also used closures (`d: () => D(n)`) where `content/` uses `dice: {n, sides, bonus}` notation objects — a representation change on top of the value drift |
| `FIGHTER_SKILLS` | full reshape | Phase 38 ABIL-02 dropped Language/Tracking/Climbing/Leaping and added Sidestep/Pommel Strike/Battle Roar/Second Wind/Sweep as actives; the classic copy still had the pre-reshape 12-key set |
| `THIEF_SKILLS` | full reshape | same phase: dropped Climbing/Leaping/Silence (as a passive)/the old Kata; added Dirty Trick/Smoke/Silent Step; the classic copy still had the pre-reshape 9-key set |
| `THRESHOLDS` / `ROMAN` | 0 | byte-identical — no drift, deleted purely for the single-source rule |

## Tests re-pointed or deleted

| File | Change | Reason |
|---|---|---|
| `test/unit/shell-company-panel.test.js` | deleted the "SUB_NOTE: the classic Cutthroat row is byte-identical to content/flavor.js..." test case and its `subNoteRegion()` helper; dropped the now-unused `import { SUB_NOTE } from "../../content/flavor.js"`; reworded the top-of-file doc comment's item 1 | the classic `SUB_NOTE` table it pinned no longer exists; `test/unit/shell-no-content-copies.test.js` proves the strictly stronger 24/6/3 byte-equality property (this row plus 32 others the old test never covered) |
| `test/unit/shell-no-content-copies.test.js` | added (5 tests) | the DEAD-02 source pin — see "Added symbols" above |

## Gate outputs

**At the Task 1 commit boundary (`20b818a`):**
- `grep -c 'import { RACE_NOTE, ... } from "./content/index.js";' mazeworld.html` → `1`; `grep -c 'import { RACES, CLASSES, BAGS, ABILITY_BY_ID } from "./content/index.js";' mazeworld.html` → `1` (pinned line untouched).
- `grep -c 'window.__mzTables = Object.freeze({ RACE_NOTE, CLASS_NOTE, SUB_NOTE, ROMAN, THRESHOLDS, WEAPONS, FIGHTER_SKILLS, THIEF_SKILLS, RACES });' mazeworld.html` → `1`; line 5099, `await boot(freshSeed)` at line 5449 — assignment precedes boot.
- `grep -c 'window.__mzTables.RACE_NOTE\[c.race\]'` / `.CLASS_NOTE\[c.cls\]` / `.SUB_NOTE\[c.sub\]` mazeworld.html → `1` each; `grep -cE "(^|[^.A-Za-z_])(RACE_NOTE|CLASS_NOTE|SUB_NOTE)\[" mazeworld.html` → `0`.
- `sed -n '/^<script>$/,/^<script type="module">$/p' mazeworld.html | grep -cE "^\s*(const|let|var|function|async function)\s+(RACE_NOTE|CLASS_NOTE|SUB_NOTE|ROMAN|THRESHOLDS|WEAPONS|FIGHTER_SKILLS|THIEF_SKILLS|RACES)\b"` → `0`.
- `grep -cE "(^|[^.A-Za-z_])ROMAN\[" mazeworld.html` → `0`; `grep -c "window.__mzTables.ROMAN\[" mazeworld.html` → `7` (≥ 6 required: `mzCombatReport`, `paint` ×2, `renderGraves`, `renderPartyRoster`, `renderEncounter`, `renderRail`, the classic boot resume line); `grep -cE "(^|[^.A-Za-z_])(WEAPONS|THRESHOLDS|RACES|FIGHTER_SKILLS|THIEF_SKILLS)\[" mazeworld.html` → `0`.
- `node tools/shell-sweep.mjs refs RACE_NOTE CLASS_NOTE SUB_NOTE ROMAN THRESHOLDS WEAPONS FIGHTER_SKILLS THIEF_SKILLS RACES` — every name's only hits are the two documented import lines (L5060, L5063) and the bridge assignment (L5099); `RACES` additionally hits the pre-existing pinned `const ROLLER_RACE_NAMES = Object.keys(RACES);` roller-flicker read (documented in the plan's own phase_facts as an existing import-line survivor) — no unexpected leaks.
- `grep -c "const SUB_NOTE = {" test/unit/shell-company-panel.test.js` → `0`; the `ROMAN[lvl - 1]` regex pin (`assert.match(region, /ROMAN\[lvl - 1\]/);`) kept as-is, still matches the bridge read as a substring.
- `npm run build:www` — exit 0. `npm run boot:check` — 4 `PASS` lines. `npm test` — 3240/3240, fail 0. `node --test test/unit/shell-map-invariants.test.js test/unit/shell-company-panel.test.js test/unit/shell-abilities.test.js test/unit/hp-not-wp.test.js` — fail 0.
- `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` — empty.
- `wc -l < mazeworld.html` — `6493` (from `6600`).

**At the Task 2 commit boundary (`8da2ce3`):**
- `test -f test/unit/shell-no-content-copies.test.js` — found. `node --test test/unit/shell-no-content-copies.test.js` — `# pass 5`, `# fail 0`.
- `grep -c 'Object.keys(SUB_NOTE).length, 24' test/unit/shell-no-content-copies.test.js` → `1`.
- `grep -c "process.env.MZ_HTML" test/unit/shell-no-content-copies.test.js` → `1`. Fail-first proof: injected `const SUB_NOTE = {};` into a scratch copy of `mazeworld.html` (written to the OS temp dir, never touching the real file), ran `MZ_HTML=<scratch> node --test test/unit/shell-no-content-copies.test.js` → `# pass 4`, `# fail 1`, test 1's failure message:
  ```
  mazeworld.html must not re-declare any content/ export:
  SUB_NOTE (classic script)
  ```
  Re-ran without `MZ_HTML` → `# pass 5`, `# fail 0` (clean).
- `grep -c "content/index.js" test/unit/shell-no-content-copies.test.js` → `7` (≥ 1); `grep -c "new Function" test/unit/shell-no-content-copies.test.js` → `0`; `grep -rl "new Function" test/` → empty.
- `npm test` — 3245/3245, fail 0 (3240 + this plan's 5 new tests).
- `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` — empty.

## Deviations from Plan

### Auto-fixed Issues

None — the plan's own tasks were followed exactly as written, including the discretionary bridge name (`window.__mzTables`, as the plan itself named it), the table set (all nine survived as live reads per the plan's phase_facts), and the test's derived-name-set design.

### Notable corrections (not auto-fixes, recorded per the "measured, not planned" convention)

**1. `content/index.js`'s export count is 79, not the plan's phase_facts estimate of 85.**
- **Found during:** Task 2, before writing the source-pin test — `Object.keys(await import("./content/index.js"))` measured 79 names across all 28 barrel-re-exported content modules, not the 85 the plan's `<phase_facts>` section stated.
- **Impact:** None on the plan's actual graded acceptance criteria — the "at least 80" language lives only in Task 2's `<action>` narrative text, not in a grep-checked `<acceptance_criteria>` line. The test asserts `names.length >= 70` (safely below the measured 79, tolerant of small future content additions) rather than blindly copying the stale 85/80 figures forward.
- **Files modified:** none beyond the test file itself, written correctly from the start.
- **Verification:** `node --test test/unit/shell-no-content-copies.test.js` passes; the name-set is re-derived from `content/index.js` at every test run, so this figure is never hand-maintained again.

---

**Total deviations:** 0 Rule 1-4 auto-fixes. One measurement correction recorded per the plan's own directive to derive facts from the post-deletion state rather than trust stale planner figures.
**Impact on plan:** None — `mazeworld.html`'s actual bridge/deletion set matches the plan's Task 1 list exactly (nine tables bridged, nine classic copies deleted, all documented readers rewritten); the source-pin test matches the plan's Task 2 design exactly (5 named tests, MZ_HTML override, fail-first proof, 24/6/3 byte-equality).

## Issues Encountered

None beyond the measurement correction documented above.

## Known Stubs

None — this plan only relocates a data source (classic tables → `content/` via a bridge) and adds a source-pin test; no new UI surface or data flow was introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. This plan strictly re-points read-only display data at an existing pure-data module and deletes the now-redundant classic copies.

## Human verification (deferred to end of run)

Per the deferred-UAT protocol, batched to the milestone-close Pixel 7 round:

- The Hero-tab dossier reads correctly for a Thief, a Fighter and a Magic User: race/class/sub-class paragraphs are present, and the Cutthroat and Knight rows specifically show the newer `content/flavor.js` wording (the flee-after-first-blow clause for Cloaker, the large-monsters-come-straight-at-you clause for Knight, etc. — not the older classic prose this plan discarded).
- The Hero-tab skills list (Fighter/Thief) shows the `content/skills.js` post-reshape descriptions — the new actives (Sidestep, Pommel Strike, Battle Roar, Second Wind, Sweep for Fighter; Dirty Trick, Smoke, Silent Step for Thief), not the pre-Phase-38 skill names (Language, Tracking, Climbing, Leaping) this plan's deleted classic copy still had.
- The HUD level reads "Lvl I" (etc.) and the graveyard stones show "lvl I" (etc.) — both now sourced through `window.__mzTables.ROMAN`.
- A weapon's worn-slot display (GEAR tab) shows the current `content/weapons.js` `lab`/damage text, not the classic pre-Phase-39 values (e.g. Bastard Sword should read `2d8+1`, not the classic `2d6`).

## Flagged assumptions

- **A-1** (survivor set as measured — carried from the plan): status after this plan — **held, no restoration needed.** All nine tables bridged exactly as the plan's phase_facts listed; `refs` reported only the documented import-line/bridge-assignment survivors for every name.
- **A-4** (the classic `D` die helper should have no live readers after this plan): **held, unresolved — deferred to Plan 44-04 as the plan itself specifies.** `D` was not touched this plan (its last live classic readers, the `WEAPONS`/`CLASSES` closures, were already deleted in Plan 44-02); its final `refs D` sweep is Plan 44-04's fixed-point pass, not this plan's.

## Next Phase Readiness

- `mazeworld.html` is at 6493 lines, `# fail 0` at 3245 tests (3240 + 5 new), engine gate diff empty. Ready for Plan 44-04 (persistence/boot slimming — the restored `reveal()` call site, the "Delve resumed." lines re-homing, and the classic `save()`/`load()`/`SAVE_KEY` retirement per `44-CONTEXT.md`).
- The nine `content/` tables this plan bridged are now the only source the shell reads for race/class/sub-class flavor, level-roman-numeral display, weapon stats, and Fighter/Thief skill lists — any future content update to these tables now reaches the shell automatically with zero shell-side code change.
- No blockers.

## Self-Check: PASSED

- FOUND: `test/unit/shell-no-content-copies.test.js`
- FOUND commit: `20b818a`
- FOUND commit: `8da2ce3`
- `wc -l < mazeworld.html` = `6493` (matches claimed line count)
- CONFIRMED: `npm test` = 3245/3245, fail 0
- CONFIRMED: `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` = empty
- CONFIRMED: `node tools/shell-sweep.mjs refs <9 names>` — all hits are the documented import-line/bridge-assignment/roller-import survivors

---
*Phase: 44-retire-the-classic-engine-from-the-shell*
*Completed: 2026-09-19*
