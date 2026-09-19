---
phase: 43-clarity-pass
plan: 01
subsystem: narration
tags: [engine, narration, cause-lines, hp-not-wp, additive-payload, ledger, parity, deferred-uat]

# Dependency graph
requires:
  - phase: 41-terrain-darkness-phobias (Plan 03)
    provides: "the phobiaTriggered/trappedPanic cause-first line model (\"Being trapped: four walls and one door you already used. −4 hp.\") this plan generalizes to every other cost-bearing event"
  - phase: 28-armor-rework (Plan 02)
    provides: "the stripCloakArmorTxt cosmetic-txt carve-out precedent this plan generalizes to REWORDED_TXT_ITEMS"
provides:
  - "Nine additive event-payload keys naming their cause: trappedPanic.phobia, heightsFear.penalty, waterFear.penalty, backfireSelfDamage.{spell,sub}, summonBackfired.{spell,sub}, earthquakeSelfDamage.spell, deathCast.cost, deathSpellTooWeak.fee, insanitySelfHarm.loss"
  - "Cause-first, cost-last rewrites of 24 EVENT_NARRATION + matching TOAST_FOR entries (the SC-1 literal renders exactly)"
  - "docs/CLARITY.md: the Cost-event inventory ledger (38 rows) + the HP-not-WP sweep report + a Requirements-map placeholder for Plan 04"
  - "test/parity/harness/comparables.js#REWORDED_TXT_ITEMS: the Phase 28 stripCloakArmorTxt carve-out generalized from one name to five, wired into every comparable chain (shared + three local duplicates) that has live exposure"
  - "test/unit/hp-not-wp.test.js: the standing HP-not-WP guard across narration, presentation COPY, content banks, and mazeworld.html/www/index.html"
  - "test/unit/clarity-cause-lines.test.js: 69 tests covering the additive engine keys, the narration rewrite, and a docs/CLARITY.md-driven ledger + cause-first-shape test"
  - "test/parity/FIXTURE-INVENTORY.md's Phase 43 section, Plan 01 subsection"
affects: [43-02-day-cycle-clarity, 43-03-loot-legibility-gear-panels, 43-04-shell-wiring-phase-close]

tech-stack:
  added: []
  patterns:
    - "Cause-first line format: `<Cause>: <plain-language why>. −N <unit>.` — the cost clause is plain text outside any HTML span (never a `class=\"roll\"` dice span), so rail.js's rollLineFor/oracleDetailText (which key on the roll span specifically) never mistake a stated cost for dice."
    - "REWORDED_TXT_ITEMS: a named Set of content-bank item names whose `txt` field carries a purely cosmetic content edit, generalizing the single-name Phase 28 stripCloakArmorTxt carve-out — the function name is kept so every existing call site widens for free; only files with a LOCAL comparable() duplicate (not importing the shared harness function) need an explicit strip added when a fixture seed's roster changes."

key-files:
  created:
    - test/unit/clarity-cause-lines.test.js
    - test/unit/hp-not-wp.test.js
    - docs/CLARITY.md
  modified:
    - engine/movement.js
    - engine/magic.js
    - engine/encounters.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - test/voice/safety-scan.test.js
    - test/unit/rail.test.js
    - test/unit/narrativeToasts.test.js
    - test/unit/loot-narration.test.js
    - content/races.js
    - content/skills.js
    - content/potions.js
    - content/treasure-tables.js
    - test/unit/abilities-catalog.test.js
    - test/parity/harness/comparables.js
    - test/parity/chargen-parity.test.js
    - test/parity/full-suite.test.js
    - test/parity/movement-parity.test.js
    - test/parity/fixtures/action-script.economy.json
    - test/parity/FIXTURE-INVENTORY.md

key-decisions:
  - "Cost clause lives OUTSIDE any HTML span (plain text after a closing </span>), never inside a class=\"roll\" span — this is what makes the new 'no roll span carries the cost' guarantee true for trapSprung/fellClimbing/trappedPanic without any change to rail.js's existing roll-span-keyed logic."
  - "foeBolted's no-member branch previously never named the foe at all (\"It lands. N hp.\"); the cause-first rewrite adds `${e.name}` so the SAME builder used directly (Task 2's target) reads cause-first — the in-combat enemyRound fold text (fight log) is untouched, since that's a different code path with its own dice-first convention."
  - "lootForfeited's reason set is really {\"died\", anything-else} in the existing code (not a literal \"escaped\"/\"fled\" enum) — the rewrite preserves that: any non-\"died\" reason reads as the Fled: line, matching both this plan's \"escaped\" examples and the pre-existing test suite's \"fled\" reason value."

requirements-completed: []

coverage:
  - id: D1
    description: "Nine additive event-payload keys (trappedPanic.phobia, heightsFear.penalty, waterFear.penalty, backfireSelfDamage.{spell,sub}, summonBackfired.{spell,sub}, earthquakeSelfDamage.spell, deathCast.cost, deathSpellTooWeak.fee, insanitySelfHarm.loss) land with zero new rng draws and zero fixture moves"
    requirement: "CLAR-01"
    verification:
      - kind: unit
        ref: "test/unit/clarity-cause-lines.test.js (12 engine-half tests); grep -c \"rng\\.\" unchanged in engine/movement.js, engine/magic.js, engine/encounters.js vs git HEAD"
        status: pass
    human_judgment: false
  - id: D2
    description: "24 EVENT_NARRATION + matching TOAST_FOR entries rewritten cause-first, cost-last; the SC-1 literal (\"Being trapped: four walls and one door you already used. −4 hp.\") renders exactly; coverage guards (toastsCoverage/formatEventsCoverage) and the voice safety scan stay green"
    requirement: "CLAR-01"
    verification:
      - kind: unit
        ref: "test/unit/clarity-cause-lines.test.js (69 tests total incl. the narration half); test/unit/toastsCoverage.test.js; test/unit/formatEventsCoverage.test.js; test/voice/safety-scan.test.js (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/CLARITY.md's cost-event inventory (38 rows, machine-checked against EVENT_NARRATION) and HP-not-WP sweep report exist; test/parity/FIXTURE-INVENTORY.md's Phase 43 Plan 01 subsection documents the measured exposure and zero-regeneration conclusion"
    verification:
      - kind: unit
        ref: "test/unit/clarity-cause-lines.test.js's ledger test (parses docs/CLARITY.md directly); grep -c on both docs files' section headers"
        status: pass
    human_judgment: false
  - id: D4
    description: "No player-facing string anywhere (Oracle, toasts, presentation COPY, content banks, mazeworld.html, www/index.html) reads the standalone word wp/WP; the five content-bank txt rewords are a measured, declared, zero-blanket-regeneration cosmetic carve-out (REWORDED_TXT_ITEMS); the one fixture literal the sweep touches (economy after.items[1].txt) is re-measured, not assumed"
    requirement: "CLAR-01"
    verification:
      - kind: unit
        ref: "test/unit/hp-not-wp.test.js (7 tests); test/parity/**/*.test.js (46/46 incl. hp-not-wp); npm test 3078/3078"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole-suite engine gate holds: master hash unchanged, npm test green, npm run build:www exits 0, and git status --porcelain test/parity/fixtures shows only the one declared record"
    verification:
      - kind: unit
        ref: "npm test (3078/3078, # fail 0); git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; npm run build:www exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "The rewritten Oracle/toast lines and the Gear-tab item txt rewords are visually confirmable on a Pixel 7"
    verification: []
    human_judgment: true
    rationale: "Deferred per the standing defer-uat-to-end instruction — no device steps taken this plan; the Pixel 7 checklist below runs at the end-of-run UAT batch."

duration: unrecorded (single continuous session, no start-time checkpoint captured)
completed: 2026-09-18
status: complete
---

# Phase 43 Plan 01: Cost-Event Inventory + Cause-First Cost Lines + HP-not-WP Sweep Summary

**Nine additive event-payload keys and a cause-first rewrite of 24 Oracle/toast lines (the SC-1 literal — "Being trapped: four walls and one door you already used. −4 hp." — renders exactly), backed by a machine-checked `docs/CLARITY.md` cost-event ledger and a standing HP-not-WP grep-pin test across every narration surface, content bank, and the shell.**

## Performance

- **Duration:** unrecorded (single continuous session, no start-time checkpoint captured)
- **Tasks:** 3 (plan tasks) — committed as 3 atomic commits
- **Files modified:** 20 (3 new, 17 modified)

## Accomplishments

- **Task 1 — additive cause keys + ledger:** `engine/movement.js` (`trappedPanic.phobia`, `heightsFear.penalty`, `waterFear.penalty`), `engine/magic.js` (`backfireSelfDamage.{spell,sub}`, `summonBackfired.{spell,sub}`, `earthquakeSelfDamage.spell`, and a new `DEATH_SPELL_FEE` constant powering `deathCast.cost`/`deathSpellTooWeak.fee`), `engine/encounters.js` (`insanitySelfHarm.loss`) — all additive, zero new rng draws (verified: `grep -c "rng\."` unchanged for all three files vs. `git show HEAD`), zero fixture moves. `docs/CLARITY.md` created with the full Cost-event inventory table (38 rows, one per cost-bearing event Phases 36-42 introduced, each marked present/ADDED/unchanged with an Owner column). `test/unit/clarity-cause-lines.test.js` created with 12 engine-half tests plus a ledger test that parses `docs/CLARITY.md` directly and asserts every named event is a real `EVENT_NARRATION` key.
- **Task 2 — cause-first narration rewrite:** all 24 Plan-01-owned `EVENT_NARRATION` builders and their matching `TOAST_FOR` entries rewritten to `<Cause>: <plain-language why>. −N <unit>.` (cost clause plain text, never inside a `class="roll"` span, so `rail.js`'s roll-span-keyed `rollLineFor`/`oracleDetailText` correctly report "no dice" for these lines now). `test/voice/safety-scan.test.js`'s `BRANCH_TOGGLES` gained entries for the nine additive keys plus `lootForfeited`'s `died` branch and `toolUsed`'s two tool names. Three pre-existing pin tests were re-pointed to the new wording with a one-line `Phase 43 (CLAR-01)` reason each: `test/unit/rail.test.js` (trapSprung no longer carries a roll span — the roll-span example moved to a `struck` event), `test/unit/narrativeToasts.test.js` (two trap pins), `test/unit/loot-narration.test.js` (the lootForfeited fled/died pins). The narration half of `test/unit/clarity-cause-lines.test.js` was appended (one `test()` per case, not one test looping many asserts, so the file's own test count — 69 — genuinely reports 69 independent claims).
- **Task 3 — HP-not-WP sweep + measured txt carve-out + gate:** eight content-bank strings reworded wp→hp (races.js Dwarven/Troll notes, skills.js Cooking, potions.js Healing, treasure-tables.js Cloak of Healing/Regeneration + Rowan/Poplar Staff). `REWORDED_TXT_ITEMS` (comparables.js) generalizes the Phase 28 `stripCloakArmorTxt` single-name carve-out to five names; live-measured exposure (chargen seeds 2/4, movement seed 256) required adding the strip to `chargen-parity.test.js`, `full-suite.test.js`'s own independent chargen loop, and `movement-parity.test.js`'s local `comparable()` — `combat-parity.test.js` already had it from Phase 28 and needed no change; `magic-parity.test.js` has no exposure. The economy fixture's declared `after.items[1].txt` was re-measured (`"+d10+2 wp"` → `"+d10+2 hp"`); `before` is untouched. `test/unit/hp-not-wp.test.js` (new, 7 tests) is the standing guard across `EVENT_NARRATION`/`TOAST_FOR`, the five presentation COPY objects, ten+ content banks, and `mazeworld.html`/`www/index.html` — all scan clean (zero player-facing `wp`/`WP` anywhere). `docs/CLARITY.md`'s HP-not-WP section and `test/parity/FIXTURE-INVENTORY.md`'s Phase 43 Plan 01 subsection were filled in with the full measured ledger.

## Task Commits

Each task was committed atomically:

1. **Task 1: Cost-event inventory (docs/CLARITY.md) + the additive cause keys in the engine** - `3270942` (feat)
2. **Task 2: Cause-first rewrite of the 24 Plan-01 rows on EVENT_NARRATION + TOAST_FOR; voice toggles; re-pin the wording tests** - `9e55c39` (feat)
3. **Task 3: HP-not-WP sweep with a grep-pin test, the measured cosmetic txt carve-out, FIXTURE-INVENTORY entry, plan gate** - `5381651` (test)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `docs/CLARITY.md` (new) — the Cost-event inventory ledger + HP-not-WP sweep report + Requirements-map placeholder
- `test/unit/clarity-cause-lines.test.js` (new) — 69 tests (engine-half + narration-half + ledger + cause-first-shape + no-roll-span)
- `test/unit/hp-not-wp.test.js` (new) — 7 tests, the standing HP-not-WP guard
- `engine/movement.js` — `heightsFear.penalty`, `waterFear.penalty`, `trappedPanic.phobia`
- `engine/magic.js` — `backfireSelfDamage`/`summonBackfired` `{spell,sub}`, `earthquakeSelfDamage.spell`, `DEATH_SPELL_FEE` constant + `deathCast.cost`/`deathSpellTooWeak.fee`
- `engine/encounters.js` — `insanitySelfHarm.loss`
- `src/browser/eventNarration.js` — 24 rewritten Oracle builders
- `src/browser/toasts.js` — matching TOAST_FOR rewrites (`deathSpellTooWeak` stays a block toast)
- `test/voice/safety-scan.test.js` — BRANCH_TOGGLES additions for the new payload shapes
- `test/unit/rail.test.js`, `test/unit/narrativeToasts.test.js`, `test/unit/loot-narration.test.js` — re-pinned to the new wording
- `content/races.js`, `content/skills.js`, `content/potions.js`, `content/treasure-tables.js` — eight wp→hp rewords
- `test/unit/abilities-catalog.test.js` — Cooking txt re-pin
- `test/parity/harness/comparables.js` — `REWORDED_TXT_ITEMS` (new export) generalizing `stripCloakArmorTxt`
- `test/parity/chargen-parity.test.js`, `test/parity/full-suite.test.js`, `test/parity/movement-parity.test.js` — the strip wired into local comparables with live exposure
- `test/parity/fixtures/action-script.economy.json` — the one declared, re-measured field
- `test/parity/FIXTURE-INVENTORY.md` — the Phase 43 Plan 01 subsection

## Decisions Made

- The cost clause always renders as plain text OUTSIDE any HTML span (never inside `class="roll"`), which is what makes rail.js's existing roll-span-keyed `rollLineFor`/`oracleDetailText` correctly report "no dice" for trapSprung/fellClimbing/trappedPanic without any change to rail.js itself — see `key-decisions` in the frontmatter for the full list.
- `test/unit/hp-not-wp.test.js`'s comment-stripping helper strips HTML comments (`<!-- -->`) BEFORE JS line/block comments — the opposite order of the `shell-company-panel.test.js` precedent this file otherwise follows. Discovered during authoring: `mazeworld.html` has an HTML comment containing the plain-English text "icons/optimized/*.png", and a naive JS-block-comment-first pass reads the embedded "/*" as a real comment opener, silently swallowing everything up to the next literal "*/" — which happened to consume the entire classic `<script>` opening tag. Reordering (HTML comments stripped first) fixes this permanently; documented in the test file's own header comment so a future sibling `shell-*.test.js` file copying this pattern for a full-document scan doesn't reintroduce the bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test/parity/full-suite.test.js`'s own independent chargen comparison loop lacked the generalized `stripCloakArmorTxt` strip**

- **Found during:** Task 3, running the full parity gate after generalizing `REWORDED_TXT_ITEMS`
- **Issue:** `chargen-parity.test.js` and `full-suite.test.js` each maintain their OWN chargen-vs-prototype comparison (not a shared function) — applying the strip only to `chargen-parity.test.js` left `full-suite.test.js`'s "ENG-05 phase gate" chargen subtest failing on seed 2's Cloak of Regeneration `txt` diff.
- **Fix:** Imported and applied `stripCloakArmorTxt` to both `protoCForDiff`/`engineCForDiff` in `full-suite.test.js`'s chargen loop, mirroring `chargen-parity.test.js`'s own application exactly.
- **Files modified:** `test/parity/full-suite.test.js`
- **Verification:** `node --test test/parity/full-suite.test.js` green (6/6); full `npm test` 3078/3078.
- **Committed in:** `5381651` (Task 3 commit)

**2. [Rule 1 - Bug] `test/parity/movement-parity.test.js`'s local `comparable()` never mirrored `stripCloakArmorTxt` at all**

- **Found during:** Task 3, running the full parity gate
- **Issue:** This file keeps its own local `comparable()` (documented precedent: it mirrors every OTHER harness strip individually because it doesn't import the shared comparable function) but had never needed `stripCloakArmorTxt` before this phase, since no movement fixture seed previously rolled a Cloak of Armor. Seed 256 (movement fixture) rolls a Cloak of Healing, newly in scope under the generalized `REWORDED_TXT_ITEMS` set, and the test failed on that seed's `txt` diff.
- **Fix:** Added the `stripCloakArmorTxt` import and applied it to `rest.c` in the local `comparable()`'s existing `c`-destructure tail, mirroring the file's own established pattern for every other structural carve-out.
- **Files modified:** `test/parity/movement-parity.test.js`
- **Verification:** `node --test test/parity/movement-parity.test.js` green; full parity suite 39/39 (later 46/46 with hp-not-wp.test.js included).
- **Committed in:** `5381651` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — the plan's own text named only "the three comparable chains" (the SHARED harness functions) as already covering the carve-out; it did not anticipate that two of the THREE per-domain local `comparable()` duplicates would need the same generalization applied explicitly once the exposed item set widened. Both fixes are structurally identical to the plan's own prescribed pattern, just applied to files the plan's read_first section didn't specifically call out).
**Impact on plan:** No scope creep, no architectural change. Both fixes are required for `npm test` to reach `# fail 0` and were caught by running the plan's own gate, not assumed.

## Issues Encountered

None beyond the two items above (found and reconciled inline, verified, part of the green suite before commit) and the comment-stripping-order discovery documented under Decisions Made (caught while authoring the new test, fixed before the test was ever committed failing).

## User Setup Required

None — no external service configuration required.

## Gate (Task 3, plan's own verification — verification agents are off)

- `npm test`: **3078/3078**, `# fail 0`
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `npm run build:www`: exit 0
- `node --test "test/parity/**/*.test.js"`: 39/39 green (46/46 including `test/unit/hp-not-wp.test.js` in the same invocation)
- `git status --porcelain test/parity/fixtures`: shows only `test/parity/fixtures/action-script.economy.json` (the one declared, re-measured record) — empty after the Task 3 commit
- `src/browser` was touched (Task 2), so `npm run build:www` was run and confirmed exit 0 per the plan's own gate requirement
- `store-listing/`/`tools/store-screenshots/`: untouched throughout (never staged; both remain pre-existing untracked directories this plan never touched)
- No `mazeworld.html` edit was made this plan (confirmed: `git diff --stat -- mazeworld.html` is empty); the HP-not-WP sweep's own scan of the shell found ZERO player-facing `wp`/`WP` occurrences, so there is no shell straggler to hand to Plan 04

## Human verification (deferred to end of run)

Per the standing `defer uat to end` instruction, no device steps were taken this plan. A Pixel 7 tester should check, at the end of the run (batched with the other Phase 43 plans):

1. **Spring a trap** — the rail card "A TRAP" reads `Trap: <name> finds you first. −N hp.`
2. **A Being-trapped hero enters a dead end** — the AFRAID/rail card reads `Being trapped: four walls and one door you already used. −N hp.` (the ROADMAP SC-1 literal)
3. **Fall off a wall / short of a crevice** — the lines read `Fall: the wall had other plans. −N hp.` / `Fall: short. The floor of the crevice makes its introduction. −N hp.`
4. **An Apprentice backfire / a Summoner backfire / an Earthquake with no ward / a Death cast** — each line names the spell (or "Death") and the fee, e.g. `Backfire: Fireball went wrong in your hands — the Apprentice tax, one time in eight. −N hp.`
5. **Buy anything** — the line reads `Bought: <item>. −N wilmst.`
6. **Flee with a loot pile pending** — the line reads `Fled: the loot stays with them — <items>.`
7. **A Cutthroat descent that loses a Joiner** — the line opens `Cutthroat: <name> …`
8. **The Gear tab's Cloak of Healing / Cloak of Regeneration / Rowan Staff / Poplar Staff rows and a Healing potion row all read "hp", never "wp"**
9. **A voice read of every rewritten line on-device** — deadpan, family-friendly, no tonal drift from the surrounding Oracle log

## Corrections to CONTEXT

- **Death potion → Death SPELL:** `43-CONTEXT.md`'s sweep list names "Death potion" as a cost-bearing event; there is no Death potion in the game. The 25-hp self-cost is the Death SPELL (`engine/magic.js`, `sp.kind === "death"`, events `deathCast`/`deathSpellTooWeak`). This plan implements the additive keys on the Death spell's events, as the plan's own `<source_audit>` had already corrected.
- **No in-combat foe DOT on the hero:** `43-CONTEXT.md`'s sweep list mentions "foe DOT ticks on the hero." No such mechanic exists — the hero's only DOT is the exploration `afflictionTick` (covered, row 5 of the ledger); the foe-ability costs are `foeBolted`/`foeDrained` (both covered, rows 17-18). Also already corrected in the plan's own `<source_audit>`; recorded here for the record.
- **Measured seed list (confirms the plan's own predictions exactly):** chargen seeds 2 and 4 roll a Cloak of Regeneration; movement seed 256 rolls a Cloak of Healing; encounters seed 160 rolls a Cloak of Regeneration; no fixture seed rolls a Rowan/Poplar Staff into a starting kit.
- **CLAR-01 is only half-landed by this plan:** the plan's own frontmatter lists `requirements: [CLAR-01]`, but `43-CONTEXT.md`'s decisions section is explicit that CLAR-01 spans Plan 01 (non-day-cycle rows, this plan) AND Plan 02 (day-cycle rows: `dayBegan`/`rationsEaten`/`wentHungry`/`rested`/`campFailed`). `requirements-completed` in this SUMMARY's frontmatter is therefore left `[]` — REQUIREMENTS.md should NOT mark CLAR-01 complete until Plan 02 lands its half too.

## Next Phase Readiness

- The non-day-cycle half of CLAR-01 is fully landed: nine additive cause keys, 24 cause-first Oracle/toast rewrites, the SC-1 literal, the machine-checked `docs/CLARITY.md` ledger, and the standing HP-not-WP guard. Zero rng change, zero serialized-field change, zero fixture regeneration beyond the one declared, measured economy record.
- Plan 02 (day-cycle CLAR-01 rows + CLAR-03/05 ration audit) has everything it needs: `docs/CLARITY.md`'s ledger already lists the five day-cycle rows with `Owner: Plan 02`, and the cause-first line-format rule is now established and proven across 24 other events for it to follow.
- Plan 03/04 (CLAR-02/04 loot legibility, gear panels, shell wiring) can proceed independently — this plan touched no shell code and introduced no new serialized fields for them to carve out.
- No blockers. `npm test`: 3078/3078, `# fail 0`. Master hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`). Full parity suite green; `mazeworld.html` untouched; no shell straggler to hand off.

---
*Phase: 43-clarity-pass*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `docs/CLARITY.md`, `test/unit/clarity-cause-lines.test.js`, `test/unit/hp-not-wp.test.js`, `engine/movement.js`, `engine/magic.js`, `engine/encounters.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `test/voice/safety-scan.test.js`, `test/unit/rail.test.js`, `test/unit/narrativeToasts.test.js`, `test/unit/loot-narration.test.js`, `content/races.js`, `content/skills.js`, `content/potions.js`, `content/treasure-tables.js`, `test/unit/abilities-catalog.test.js`, `test/parity/harness/comparables.js`, `test/parity/chargen-parity.test.js`, `test/parity/full-suite.test.js`, `test/parity/movement-parity.test.js`, `test/parity/fixtures/action-script.economy.json`, `test/parity/FIXTURE-INVENTORY.md` all exist.
Verified in git log: `3270942`, `9e55c39`, `5381651` all present on `master`.
