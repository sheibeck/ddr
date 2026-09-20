---
phase: 45-collapse-the-phase-37-hedges
plan: 03
subsystem: docs
tags: [fixture-inventory, docs, tuning-bot, smoke, closing-gates, worn-model]

requires:
  - phase: 45-01
    provides: "tools/worn-fixture-scan.mjs + the committed BEFORE readout (MOVED SET (13))"
  - phase: 45-02
    provides: "newRun always wears, load always reconciles, no option, MOVED SET declared, divergence-records.test.js"
provides:
  - "test/parity/FIXTURE-INVENTORY.md Phase 45 section — the measured MOVED SET, the scan quoted verbatim, declared per-site records"
  - "docs/GEAR-SLOTS.md §2/§3/§5/§7 corrected to the single unconditional worn path"
  - "the 143-cell x 3-seed tuning-bot smoke confirming RUN_FLAGS = { storeRoll: true } and 0 stuck runs"
  - "ROADMAP Phase 45 success criteria 1-5 verified verbatim"
affects: [46]

tech-stack:
  added: []
  patterns:
    - "Closing-plan pattern: no engine/tool/test edits, only inventory + docs prose + a scratch smoke; the SUMMARY is the phase's closing record"

key-files:
  created: []
  modified:
    - test/parity/FIXTURE-INVENTORY.md
    - docs/GEAR-SLOTS.md

key-decisions:
  - "Fixed an own-introduced deviation before closing: the first draft of FIXTURE-INVENTORY.md's Phase 45 section used the literal string \"wornSlots\" in prose (\"no wornSlots option\"), which counts against ROADMAP success criterion 1's grep gate (`grep -rn wornSlots engine/ src/ mazeworld.html tools/ test/` must be 0) because the file lives under test/. Reworded to \"no option argument\" in a follow-up commit (5a96c22) before running the closing gates."
  - "GEAR-SLOTS.md's one remaining wornSlots mention (S7's Phase 42 historical bullet) was rephrased so \"Phase 45\" appears on the SAME grep-matched line as \"wornSlots\", not merely nearby in the same bullet — the acceptance check is a line-based grep, not a paragraph-based one."

requirements-completed: [HEDGE-01, HEDGE-02, HEDGE-03]

coverage:
  - id: D1
    description: "FIXTURE-INVENTORY.md carries the Phase 45 section (moved set + scan output + byte-identical-elsewhere), generated roster block regenerated (byte-identical, A-7 confirmed), fixture-inventory.test.js + divergence-records.test.js green"
    requirement: "HEDGE-03"
    verification:
      - kind: unit
        ref: "node --test test/parity/fixture-inventory.test.js test/parity/divergence-records.test.js — # fail 0 (7 + 2 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/GEAR-SLOTS.md no longer states the option-gated design as current; every remaining wornSlots mention carries Phase 45 on the same line"
    requirement: "HEDGE-03"
    verification:
      - kind: other
        ref: "grep -n wornSlots docs/GEAR-SLOTS.md | grep -vc \"Phase 45\" — 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "143-cell x 3-seed bot smoke: 0 stuck, RUN_FLAGS = { storeRoll: true }, Bot: line byte-equal to the v1.5 AFTER pin modulo seeds="
    requirement: "HEDGE-01"
    verification:
      - kind: other
        ref: "node tools/tune-classes.mjs --seeds 3 --workers 4 --max-actions 5000 --out <scratch>; node tools/class-pass-diff.mjs --gate --after <scratch> — exit 0, cannot-act cells: 0 of 143; node <scratch-check>.mjs — SMOKE OK, botMatch=true"
        status: pass
    human_judgment: false
  - id: D4
    description: "ROADMAP Phase 45 success criteria 1-5 verified verbatim"
    requirement: "HEDGE-01, HEDGE-02, HEDGE-03"
    verification:
      - kind: unit
        ref: "npm test — # pass 3242, # fail 0; npm run build:www — exit 0"
        status: pass
    human_judgment: false

duration: ~2h
completed: 2026-09-19
status: complete
---

# Phase 45 Plan 03: Close the Phase 37 Hedges — Summary

**Documented the measured, declared moved set in `FIXTURE-INVENTORY.md`, corrected `GEAR-SLOTS.md`'s prose from the retired option-gated design to the single unconditional worn path, ran a 143-cell x 3-seed tuning-bot smoke (0 stuck, `RUN_FLAGS = { storeRoll: true }`, `Bot:` line byte-equal to the v1.5 AFTER pin), and verified all five ROADMAP success criteria verbatim — closing Phase 45.**

## Performance

- **Duration:** ~2h
- **Tasks:** 3 (Task 2 uncommitted by design — the smoke readout stays out of the repo)
- **Files modified:** 2 (`test/parity/FIXTURE-INVENTORY.md`, `docs/GEAR-SLOTS.md`) + this SUMMARY

## Task Commits

1. **Task 1: FIXTURE-INVENTORY.md Phase 45 section + GEAR-SLOTS.md prose** — `b942cd5` (docs)
2. **Deviation fix: FIXTURE-INVENTORY prose spelled the retired identifier** — `5a96c22` (fix, discovered during Task 3's own criterion-1 gate run — see Deviations)
3. **Task 2: 143-cell x 3-seed tuning-bot smoke** — no commit (readout kept at a scratch path, per plan)
4. **Task 3: this closing SUMMARY** — committed per `<final_commit>` below

## Success criteria

Verified verbatim, in ROADMAP order:

**1.** `grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/` returns 0 lines; `newRun(seed)` called with no options yields a Thief whose starting cloak sits in `c.worn.cloak` and not in `c.items`, pinned by a test that passes no option.

```
$ grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/ | wc -l
0
$ node tools/shell-sweep.mjs refs wornSlots
refs wornSlots: 0
$ node --test test/unit/worn-migration.test.js
# tests 24
# pass 24
# fail 0
```
`ok 1 - HEDGE-01: newRun(2) with no options wears the Thief's starting cloak — c.worn.cloak set, c.items empty, every other field and rngState untouched`

**2.** A v1.4-era save (no `c.worn`, two rings stacked in the bag) loads through `validateSave`/`rehydrate` with no option argument and comes out legal — first copy worn, extras bagged, the reconciliation report returned once — pinned by a test that passes no option.

`ok 4 - HEDGE-02: a v1.4-era save (no c.worn, two rings + two cloaks + a potion stacked in the bag) loads through validateSave/rehydrate with NO option — both rings and the first cloak worn, the second cloak bagged, wornReport returned once`
`ok 6 - HEDGE-02 ordering: three identical Rings of Power — the first two in bag order wear jewelry1/jewelry2, the third stays bagged, reported once`

**3.** The fixtures that moved are exactly the set a live scan measured before the edit; each carries a before/after divergence record in the harness; every other fixture is byte-identical; `test/parity/FIXTURE-INVENTORY.md` is regenerated; the master hash is unchanged.

```
$ node --test test/parity/divergence-records.test.js
# pass 2
$ diff <(node tools/worn-fixture-scan.mjs) tools/worn-fixture-scan-output.txt
(empty)
$ git status --porcelain test/parity/fixtures
(empty)
$ git hash-object test/parity/prototype-master.js.txt
a1f4d0dc29782218d8e5aab65bc5989c33f917f0
$ node --test test/parity/fixture-inventory.test.js
# fail 0
$ git diff --stat 7447629 -- test/parity/fixtures/
 test/parity/fixtures/action-script.chargen.json    | 49 ++++++++++------
 test/parity/fixtures/action-script.combat.json     | 68 ++++++++++++++--------
 test/parity/fixtures/action-script.economy.json    | 49 ++++++++++------
 test/parity/fixtures/action-script.encounters.json | 44 +++++++++-----
 test/parity/fixtures/action-script.movement.json   | 11 ++--
 test/parity/fixtures/action-script.schema.md       | 11 ++++
 6 files changed, 154 insertions(+), 78 deletions(-)
```
Exactly the MOVED SET holders' fixture files + `action-script.schema.md` (the schema doc, not a fixture) — no extra file touched.

**4.** The tuning bot plays the single path: `RUN_FLAGS` no longer names `wornSlots`, `meta.runFlags` in a fresh readout omits it, and a 143-cell x 3-seed smoke reports 0 stuck runs with the frozen `Bot:` parameter line byte-equal to the v1.5 AFTER pin.

```
$ grep -c "Object.freeze({ storeRoll: true })" tools/lib/tuning-bot.mjs
1
$ node tools/tune-classes.mjs --seeds 3 --workers 4 --max-actions 5000 --out "$TEMP/45-hedge-smoke.json"
... 429 runs, elapsed 66.5s
$ node tools/class-pass-diff.mjs --gate --after "$TEMP/45-hedge-smoke.json"
cannot-act cells: 0 of 143
(exit 0)
$ node "$TEMP/45-smoke-check.mjs"
cells=143
runs=429
stuck=0
runFlags={"storeRoll":true}
botMatch=true
SMOKE OK
```
See "Bot: line comparison" below for the full side-by-side.

**5.** `npm test` fail 0 and `npm run build:www` green at every commit of the phase.

```
$ npm test
# tests 3242
# pass 3242
# fail 0
$ npm run build:www
[build-www] done
(exit 0)
```
Verified at this plan's final commit (`5a96c22`, the deviation fix, and again after this SUMMARY's own commit); each prior phase commit (`726d384`, `9d8d9a7`, `b942cd5`) was independently gated in its own plan's SUMMARY (`45-01-SUMMARY.md`, `45-02-SUMMARY.md`) — see Gate outputs below.

## Scan output

The committed live scan (`tools/worn-fixture-scan-output.txt`), summary lines:

```
UNEXPLAINED: action-script.combat.json#lose

MOVED SET (13): action-script.chargen.json#seed-2, action-script.chargen.json#seed-3, action-script.chargen.json#seed-4, action-script.movement.json#script, action-script.combat.json#win, action-script.combat.json#lose-plain, action-script.combat.json#flee, action-script.combat.json#parley, action-script.economy.json#script, action-script.encounters.json#chest, action-script.encounters.json#tablefour, action-script.encounters.json#faerie, action-script.encounters.json#affliction
WORN EXPOSURE: 13 of 31 replay sites
```

`UNEXPLAINED: action-script.combat.json#lose` is a **pre-existing action-path divergence, NOT a worn move** (investigated fully by 45-01 — a Phase 24/31 RNG-stream divergence from `fromAction: 0`, already tolerated by the passing test suite's own `skipsByteDiffAt`; the Fighter hero involved never carries a cloak, `worn: {}` throughout). It is excluded from the MOVED SET and needs no declared record.

BEFORE == AFTER: `diff <(node tools/worn-fixture-scan.mjs) tools/worn-fixture-scan-output.txt` — empty. The collapse (45-02) moved exactly the measured set (45-01), nothing more, nothing less — re-confirmed at this plan's close.

## Moved fixtures (before/after)

The consolidated 13-site MOVED SET (economy carries two records — chargen-time and end-state):

| Holder | Site / seed | Hero | record | items before (prototype) | items after (engine) | worn after (engine) |
|---|---|---|---|---|---|---|
| `action-script.chargen.json` | `#seed-2` (2) | Thief Cat Burglar Wilmsry | `divergences["2"]` | `[Cloak of Regeneration]` | `[]` | `cloak=Cloak of Armor` |
| `action-script.chargen.json` | `#seed-3` (3) | Thief Pickpocket Human | `divergences["3"]` | `[Cloak of Ether]` | `[]` | `cloak=Cloak of Ether` |
| `action-script.chargen.json` | `#seed-4` (4) | Thief Cat Burglar Dwarven | `divergences["4"]` | `[Cloak of Regeneration]` | `[]` | `cloak=Cloak of Regeneration` |
| `action-script.movement.json` | `#script` (256) | Thief Cat Burglar Human | top-level `chargenDivergence` | `[Cloak of Healing]` | `[]` | `cloak=Cloak of Strength` |
| `action-script.combat.json` | `#win` (3) | Thief Pickpocket Human | scenario `chargenDivergence` | `[Cloak of Ether]` | `[]` | `cloak=Cloak of Ether` |
| `action-script.combat.json` | `#lose-plain` (1119) | Thief Cutthroat Human | scenario `chargenDivergence` | `[Cloak of Ether]` | `[]` | `cloak=Cloak of Ether` |
| `action-script.combat.json` | `#flee` (17) | Thief Pilfer Fridgian | scenario `chargenDivergence` | `[Cloak of Armor]` | `[]` | `cloak=Cloak of Flying` |
| `action-script.combat.json` | `#parley` (303) | Thief Con Artist Wilmsry | scenario `chargenDivergence` | `[Cloak of Ether]` | `[]` | `cloak=Cloak of Ether` |
| `action-script.economy.json` | `#script` (3), chargen | Thief Pickpocket Human | top-level `chargenDivergence` | `[Cloak of Ether]` | `[]` | `cloak=Cloak of Ether` |
| `action-script.economy.json` | `#script` (3), END | Thief Pickpocket Human | top-level `divergence` (action-path, end-state) | `[Cloak of Ether, Healing potion, Lockpicks]` | `[Healing potion, Lockpicks, Speed potion]` | `cloak=Cloak of Ether` |
| `action-script.encounters.json` | `#chest` (2) | Thief Cat Burglar Wilmsry | scenario `chargenDivergence` | `[Cloak of Regeneration]` | `[]` | `cloak=Cloak of Armor` |
| `action-script.encounters.json` | `#tablefour` (3) | Thief Pickpocket Human | scenario `chargenDivergence` | `[Cloak of Ether]` | `[]` | `cloak=Cloak of Ether` |
| `action-script.encounters.json` | `#faerie` (38) | Thief Con Artist Elven | scenario `chargenDivergence` | `[Cloak of Ether]` | `[]` | `cloak=Cloak of Ether` |
| `action-script.encounters.json` | `#affliction` (160) | Thief Pilfer Human | scenario `chargenDivergence` | `[Cloak of Regeneration]` | `[]` | `cloak=Cloak of Armor` |

Every non-Thief site (every Fighter/Magic User chargen seed, combat's `lose`/`lose-apprentice`, all four magic scenarios, encounters' `trap`) is byte-identical — confirmed by both the live scan (45-01) and `divergence-records.test.js`'s standing MOVED-SET-equality guard (45-02). Full record detail (JSON before/after triples) lives in `test/parity/FIXTURE-INVENTORY.md`'s Phase 45 section, landed this plan.

## Bot: line comparison

| Field | v1.5 AFTER pin (`docs/class-pass/v15-after.json`) | This smoke (scratch, `5a96c22`-era engine) |
|---|---|---|
| `Bot:` line | `Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=40  workers=4  startDepth=1` | `Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=3  workers=4  startDepth=1` |
| `runFlags` | `{"storeRoll":true,"wornSlots":true}` (frozen v1.5-era history) | `{"storeRoll":true}` |
| `cells` | 143 | 143 |
| `stuck` | 0 | 0 |
| `--gate` | n/a (this is the frozen AFTER matrix, not gated post-hoc here) | `cannot-act cells: 0 of 143` (exit 0) |

Byte-equal modulo `seeds=` — confirmed programmatically (`botMatch=true`). The smoke readout was written to `%TEMP%/45-hedge-smoke.json` (NOT `docs/class-pass/`) and no ledger entry was added to `docs/CLASS-PASS.md` — this is a smoke, not a readout (plan prohibition, satisfied: `git status --porcelain` printed nothing after the run).

**Direction check only (A-8), pooled row vs the Phase 42 v1.5 tactics smoke** (both 143x3, both post-worn-model-tactics; NOT a tuning verdict — read only as "did anything obviously break"):

| Measure | v1.5 tactics smoke (`baf6db7`, Phase 42) | This smoke (Phase 45 close) |
|---|---|---|
| n (runs) | 429 | 429 |
| meanDepth | 3.59 | 3.54 |
| p50Depth | 3 | 3 |
| p90Depth | 5 | 5 |
| reach5 % | 24.7 | 21.4 |
| reach10 % | 0.5 | 0.2 |
| reach20 % | 0.0 | 0.0 |
| meanKills | 7.88 | 7.56 |
| meanLevel | 2.44 | 2.38 |
| stuck | 0 of 429 | 0 of 429 |
| top death causes | Poltergeist, starved in the dark, Werebeast | Poltergeist, starved in the dark, undone by a trap |

The small deltas (meanDepth -0.05, reach5 -3.3pp) are exactly the low-sample noise a 3-seed smoke cannot distinguish from a real shift (same caveat Phase 42 recorded for its own smoke vs the 40-seed BEFORE pin) — not actioned. Nothing here is an acceptance check; only `cells`, `stuck`, `runFlags`, the `Bot:` line and `--gate`'s exit code are (A-8).

## Tests re-pinned or deleted (phase total)

All re-pinning happened in 45-02 (the one engine-editing plan); 45-01 and 45-03 added/deleted no tests.

| File | Kind | Reason |
|---|---|---|
| `test/unit/worn-migration.test.js` | rewritten (whole file) | Every `newRun`/`validateSave`/`rehydrate` option argument deleted; new HEDGE-01 pins (newRun(2) cloak-worn, Fighter/Magic User empty worn, every chargen seed); new HEDGE-02 pins (v1.4-era save with rings/cloaks, three-ring ordering, idempotency); `illegalOldSave()` and siblings now `delete s.c.worn` to simulate a genuine pre-Phase-45 save |
| `test/unit/engineAdapter.test.js` | re-pinned | Fresh-boot-fallback and corrupt-save tests assert `"worn" in state.c"` (true); two-/three-rings boot-migration tests `delete original.c.worn`; "already carries worn" test asserts `wornReport` deep-equals `[]` (A-4) |
| `test/unit/bot-tactics.test.js` | re-pinned | `RUN_FLAGS` pin updated to `{ storeRoll: true }` |
| `test/unit/class-pass-ledger.test.js` | re-pinned (reworded, not "fixed") | The two literal `runFlags` pins against the FROZEN v1.5 AFTER readouts reworded to assert what's true of the stored files without spelling the retired identifier — `docs/class-pass/*.json` themselves untouched |
| `test/unit/item-activation.test.js` | re-pinned | Dropped the option, renamed the test |
| `test/unit/worn-model.test.js` | re-pinned | `"worn" in c` assertions inverted; a pre-existing tripwire test needed a Rule-1 fix (see 45-02's Deviations) |
| `test/unit/worn-slots.test.js` | 2 deleted, 2 rewritten | Deleted the two "Task 3 sweep" legacy-state tests (`newRun` can no longer produce a worn-less state); rewrote `takeFind`/`takeLoot` to the single-path outcome |
| `test/unit/save-validation.test.js` | re-pinned | Both hand-built old-save pins gained `worn: {}` in the expected spread |
| `test/unit/loot-pile.test.js` (A-5 extra, not in 45-02's plan frontmatter) | re-pinned | `reconcilePendingLoot` comparison tests re-pinned — auto-wear now fires (see 45-02's Deviations #3) |

`npm test` count: 3,243 (phase baseline) → 3,242 (after 45-02: net -1, 2 legacy tests deleted in `worn-slots.test.js` offset by new tests added elsewhere) → 3,242 (unchanged through 45-03; this plan added/removed no tests).

## Declared consequences

- **A-4:** `takeBootWornReport()` now returns `[]` (not `null`) for a valid save that was already migrated, because `validateSave` has one return shape. Rendering is identical (`wornReconcileCard([])` is `null`). No consumer branching on `null` vs `[]` was found across all three plans.
- **The class-pass ledger test's stored-file assertion is REWORDED, never "fixed"** — `test/unit/class-pass-ledger.test.js` now asserts what's true of the frozen `docs/class-pass/v15-after*.json` files (`storeRoll: true`, both readouts agree, exactly 2 keys) without spelling the retired identifier. **These JSON files, and `docs/CLASS-PASS.md`'s Phase 42 `RUN_FLAGS` transcription, are NEVER regenerated to the new one-flag shape** — they are frozen history. Future readers: do not "fix" `docs/class-pass/*.json` or `docs/CLASS-PASS.md`'s Phase 42 section to match today's `RUN_FLAGS`; that is explicitly out of this phase's (and Phase 48's docs-sweep) scope per the CONTEXT ruling.

## Gate outputs

Per phase-45 commit (chronological):

```
726d384 (45-01, feat: worn-fixture-scan + BEFORE readout)
  npm test: # pass 3243, # fail 0 | npm run build:www: exit 0
  (git diff --stat HEAD~1 -- engine/ src/ content/ mazeworld.html test/: empty)

9d8d9a7 (45-02, refactor: the collapse, one commit)
  npm test: # pass 3242, # fail 0 | npm run build:www: exit 0
  git diff --stat -- engine/ content/: engine/derived.js, engine/saveState.js, engine/state.js (52+/82-)
  git status --porcelain test/parity/fixtures: 6 files (5 fixtures + schema.md)

b942cd5 (45-03 Task 1, docs: FIXTURE-INVENTORY + GEAR-SLOTS)
  npm test: # pass 3242, # fail 0 | npm run build:www: exit 0
  git diff --stat: test/parity/FIXTURE-INVENTORY.md, docs/GEAR-SLOTS.md only

5a96c22 (45-03 fix, wornSlots wording deviation)
  npm test: # pass 3242, # fail 0 | npm run build:www: exit 0
  grep -rn wornSlots engine/ src/ mazeworld.html tools/ test/: 0
```

`git log --oneline 7447629..HEAD` (phase-45-tagged commits only, filtered from interleaved unrelated backlog/asset commits): `4642700`, `7c746ee`, `726d384`, `35c1879`, `8d902a7`, `2286d4a`, `9d8d9a7`, `4fa6a1f`, `b942cd5`, `5a96c22` — each gated per its own plan's SUMMARY or (for the two 45-03 commits) this SUMMARY.

## Human verification (deferred to end of run)

Consolidated across the whole phase — no device pauses were taken; batched for the milestone-close Pixel 7 UAT round:

- A fresh Thief starts with the cloak in the WORN row of the Gear tab (`c.worn.cloak`), not the BAG.
- Resuming the current on-device save shows the reconciliation rail card **once** if it bagged an extra during migration (or **no card** if the save was already migrated / nothing was bagged) — plus the matching Oracle log line.
- A Fighter's Gear tab shows an empty worn row set (`c.worn = {}`) and an unchanged bag.
- Nothing else is user-visible — this phase is an internal single-path collapse with no new gameplay rule.

## Flagged assumptions

- **A-1** (populated `c.worn` ⟺ the site's parity comparable moves): holds, with one investigated exception (`combat/lose`, seed 14 — pre-existing Phase 24/31 action-path divergence, not a worn-model issue; documented and excluded from the MOVED SET correctly).
- **A-2** (prototype sandbox loaded exactly as parity tests load it; economy site's gold bump mirrors `full-suite.test.js`): holds.
- **A-3** (HEDGE-02 concurrency — n/a): confirmed n/a — the load chain is synchronous, single-threaded, pure over its own clone.
- **A-4** (`takeBootWornReport()` returns `[]` not `null` for an already-migrated save): holds; no consumer branches on `null` vs `[]`.
- **A-5** (every `npm test` failure after the engine edit is either a legacy pin to re-pin/delete, or a scan-named site to declare): held for all 3 auto-fixed deviations in 45-02 (2 anticipated in kind, 1 extra — `loot-pile.test.js` — also in kind, just outside the plan's frontmatter file list).
- **A-6** (MOVED SET = the 13 Thief-hero sites predicted, no mid-script wear anywhere): held exactly — 13/13 measured, zero surprises, zero mid-script wears across all 31 sites.
- **A-7** (regenerated roster block byte-identical): held — `node tools/fixture-inventory.mjs`'s fresh output matched the committed generated block exactly (modulo a trailing-newline capture artifact, not a content diff); no engine/harness bytes moved which creatures a fight rolls.
- **A-8** (3-seed smoke is a direction check, not a tuning verdict): held — only `cells`, `stuck`, `runFlags`, the `Bot:` line and `--gate`'s exit code were treated as acceptance checks; the pooled-row comparison above is quoted for context only, not actioned.

## Next phase readiness

- `wornSlots` is fully retired from `engine/`, `src/`, `mazeworld.html`, `tools/`, and `test/` (confirmed by this plan's own criterion-1 gate, after fixing this plan's own prose slip — see Deviations). Phase 46's NAME-02 zero-straggler grep should find nothing left to catch from this phase's edits.
- `docs/GEAR-SLOTS.md` now describes the single unconditional path with every historical `wornSlots` mention explicitly dated to Phase 42 or earlier. `docs/CLASS-PASS.md` and the frozen `docs/class-pass/*.json` readouts are untouched — Phase 48's docs sweep owns any further wording pass there.
- No blockers for Phase 46.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FIXTURE-INVENTORY.md's Phase 45 prose spelled the retired `wornSlots` identifier, breaking ROADMAP success criterion 1's own gate**
- **Found during:** Task 3, running criterion 1's own verification command (`grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/ | wc -l`) — it printed `1`, not the expected `0`.
- **Issue:** Task 1's new Phase 45 section in `test/parity/FIXTURE-INVENTORY.md` (a file under `test/`) used the phrase "no `wornSlots` option" in its opening paragraph — a correct historical reference in meaning, but the literal identifier string is exactly what criterion 1's grep counts, and the grep's scope includes `test/`.
- **Fix:** Reworded "no `wornSlots` option, zero rng draws" to "no option argument, zero rng draws" — same meaning, no identifier spelled.
- **Files modified:** `test/parity/FIXTURE-INVENTORY.md`
- **Verification:** `grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/ | wc -l` → `0`; `node --test test/parity/fixture-inventory.test.js test/parity/divergence-records.test.js` → `# fail 0` (unaffected — prose-only change); `npm test` → `# fail 0`; `npm run build:www` → exit 0.
- **Committed in:** `5a96c22` (its own atomic commit, per the executor's per-task commit discipline — this was discovered after Task 1's commit had already landed)

---

**Total deviations:** 1 auto-fixed (1 bug fix — a self-introduced prose slip caught by this plan's own closing-gate verification before it could reach the phase-close record)
**Impact on plan:** Necessary for ROADMAP success criterion 1 to actually read `0`, as required. No scope creep — a one-line wording fix in a file this plan already owns.

## Issues Encountered

None beyond the one auto-fixed deviation above.

## User Setup Required

None — no external service configuration required.

---
*Phase: 45-collapse-the-phase-37-hedges*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: docs/GEAR-SLOTS.md
- FOUND: .planning/phases/45-collapse-the-phase-37-hedges/45-03-SUMMARY.md
- FOUND: commit b942cd5 (docs: FIXTURE-INVENTORY Phase 45 section + GEAR-SLOTS prose)
- FOUND: commit 5a96c22 (fix: FIXTURE-INVENTORY wornSlots wording deviation)
