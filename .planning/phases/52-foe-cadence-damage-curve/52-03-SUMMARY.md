---
phase: 52-foe-cadence-damage-curve
plan: 03
subsystem: combat
tags: [combat, damage-curve, herman, bot-readout, ledger, bestiary, measurement-gate]

# Dependency graph
requires:
  - phase: 52-foe-cadence-damage-curve
    plan: 02
    provides: "the engine-wide dice-only crit rule + Herman sp.strikesAs, the measured moved parity set, and the AFTER damage-curve audit (FLAGGED 116->65 row×band cells) with its 'Still flagged after the fixes (rule=dice) — pending ruling' table this plan closes out"
provides:
  - "content/BESTIARY-REBALANCE.md's Phase 52 addendum: the 'Still flagged after the fixes (rule=dice) — ruled' table with a per-row Disposition cell (65/65 rows) and a Handoff to Phase 54 (TUNE-08) line"
  - "docs/DIFFICULTY-RETUNE.md's '### v1.7 · Phase 52 — cadence & damage curve' H3: rule-change summary, identical parameters, BEFORE by reference to Phase 51's AFTER (608a0e5, not re-run), the three AFTER transcripts verbatim (commit 049ab50), a Reading (BEFORE → AFTER) table, the cadence readout (CAD-03/SC3), and the damage-curve audit (DMG-01/SC4)"
  - "docs/class-pass/v17-p52-after-smoke.json — the AFTER 143-cell class-pass smoke, meta-parity true against v17-p51-after-smoke.json modulo commit"
  - "The Phase 52 measurement gate is closed: Phase 54 inherits a committed AFTER baseline taken on the finished Phase 52 tree under Phase 51's exact bot flags"
affects: [54-difficulty-four-band-retune]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Disposition column added to an already-generated audit table via a small one-off node script (read the addendum, tag each row tier===5 as deep-tier vs everything else as curve-height, rewrite in place) rather than hand-editing 65 rows"
    - "Ledger H3 assembled by reading the already-committed tool outputs (cadence-audit-output.txt, damage-curve-audit-output.txt) and the freshly-captured bot transcripts into a Node script that splices the new section directly before the pinned '## v1.2 retune (Phase 27)' H2, guaranteeing byte-for-byte verbatim quoting with zero manual retyping"

key-files:
  created:
    - docs/class-pass/v17-p52-after-smoke.json
  modified:
    - content/BESTIARY-REBALANCE.md
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "Applied the ruling_in_force override exactly: tier-5 rows get the literal disposition 'left as a deliberate deep-tier threat (Endgame band) — D-07' (21 rows), tier 2-4 rows (level-base + row-dice, 44 rows) get 'curve height — a Phase 54 dial (four-band retune), not a Phase 52 cliff' — no dice trims, content/bestiary.js and engine/ untouched this plan (git diff --stat empty against 1bb808d)"
  - "Reworded the prose bullets below the ruled table to state the exact Disposition strings once (not repeat them per-row in prose) so grep -c 'left as a deliberate deep-tier threat (Endgame band)' equals exactly 21 (the deep-tier row count), matching the row count rather than row-count+1"
  - "The AFTER bot readout ran on the Task 1 commit (049ab50) since that commit's only changes were documentation (BESTIARY-REBALANCE.md disposition rulings) — no engine/bestiary edits happened in this plan, so the AFTER numbers measure the same tree Plan 02 already fixed, confirming the ruling-only commit changes nothing behaviourally"
  - "Party tune-difficulty --seeds=200 ran ~20 minutes wall-clock (not the ~70-90s ballpark in the plan's ground rules) — party mode's higher stuck-run rate (maxActions=20000 cap hit by 75/200 runs) makes it inherently slower than solo; ran to completion in the background rather than assuming a timeout meant failure"

requirements-completed: [CAD-03, DMG-01, DMG-02]

coverage:
  - id: D1
    description: "Every one of the 65 still-flagged row×band cells in content/BESTIARY-REBALANCE.md's Phase 52 addendum carries an explicit Disposition cell — 21 tier-5 rows ruled 'left as a deliberate deep-tier threat (Endgame band)', 44 tier 2-4 rows ruled 'curve height — a Phase 54 dial (four-band retune), not a Phase 52 cliff'; heading renamed from 'pending ruling' to 'ruled'; nothing silently skipped (D-07)"
    requirement: "DMG-02"
    verification:
      - kind: unit
        ref: "node tools/damage-curve-audit.mjs --rule=dice diffs empty against the committed AFTER section; node --test test/unit/bestiary-yardstick.test.js test/unit/content-tables.test.js test/parity/divergence-records.test.js (52/52 pass)"
        status: pass
      - kind: other
        ref: "grep -c '^#### Still flagged after the fixes (rule=dice) — ruled' content/BESTIARY-REBALANCE.md == 1; grep -c 'pending ruling' == 0; grep -c 'left as a deliberate deep-tier threat (Endgame band)' == 21 (the deep-tier count)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/DIFFICULTY-RETUNE.md's '### v1.7 · Phase 52 — cadence & damage curve' H3 lands between Phase 51's H3 and the pinned '## v1.2 retune (Phase 27)' H2 with BEFORE-by-reference (Phase 51 AFTER, 608a0e5, not re-run), the three AFTER transcripts verbatim (commit 049ab50), a Reading table, the cadence readout (both INVARIANT HOLDS lines quoted), and the damage-curve audit (both FLAGGED lines, both Herman blocks 82/100 → 37/37)"
    requirement: "CAD-03"
    verification:
      - kind: unit
        ref: "node --test test/unit/difficulty-retune-ledger.test.js test/unit/class-pass-ledger.test.js (33/33 pass — v1.2 H2 still last)"
        status: pass
      - kind: other
        ref: "grep -n headings confirm order (1188 Phase51, 1996 Phase52, 2767 v1.2); grep -c on all five required heading strings == expected; sed-extracted H3 contains 2x INVARIANT HOLDS, 2x FLAGGED:, 2x ## Herman, and 82/100 -> 37/37"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/class-pass/v17-p52-after-smoke.json committed: 143 cells, seeds 5, meta.commit 049ab50, every other meta key identical to v17-p51-after-smoke.json (meta-parity node check prints true)"
    requirement: "DMG-01"
    verification:
      - kind: other
        ref: "node -e meta-parity check prints true; cells.length===143 && meta.seeds===5"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase gates on the Wave 3 tree: npm test fail 0, npm run build:www green, master hash unchanged, engine/ and content/bestiary.js untouched this plan, cadence audit re-run byte-identical"
    requirement: "CAD-03"
    verification:
      - kind: unit
        ref: "npm test — 3372/3372 pass, fail 0 (run twice, after Task 1 and after Task 2)"
        status: pass
      - kind: other
        ref: "npm run build:www exit 0; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; git diff --stat 1bb808d -- engine/ test/parity/harness/comparables.js empty; node tools/cadence-audit.mjs | diff - tools/cadence-audit-output.txt empty"
        status: pass
    human_judgment: false

# Metrics
duration: ~90min
completed: 2026-09-20
status: complete
---

# Phase 52 Plan 03: Ruled Dispositions + AFTER Bot Readout + Ledger Close Summary

**Closed Phase 52's measurement gate: applied the user's hand-to-54 ruling as an explicit per-row Disposition on all 65 still-flagged damage-curve cells (no bestiary trims), then captured the AFTER bot readout under Phase 51's exact flags on the ruling commit and wrote the `### v1.7 · Phase 52 — cadence & damage curve` ledger section with BEFORE-by-reference, three verbatim AFTER transcripts, a Reading table, the cadence proof, and the damage-curve flags — giving Phase 54's four-band retune a committed baseline.**

## Performance

- **Duration:** ~90 min (dominated by the ~20 min party bot run and ~2 min class smoke, both run to completion in the background)
- **Completed:** 2026-09-20
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 new)

## Accomplishments

- **Task 1 (ruled dispositions, `049ab50`):** Renamed `content/BESTIARY-REBALANCE.md`'s `#### Still flagged after the fixes (rule=dice) — pending ruling` heading to `— ruled`, and added a `Disposition` column to every one of the 65 rows in the audit-verbatim table: the 21 tier-5 rows (Dread Lock, Stalka Beast, Djinni, Herman T5, Drarl T5, Drudge T5, Vampire, across Wall/Breakaway/Endgame) get `left as a deliberate deep-tier threat (Endgame band) — D-07`; the 44 tier 2-4 rows (level-base: Herman T4, Stink Bug, Ghost, Spectre, Craig, Drarl T4, Drudge T4, Bones, Floater, Undead, Drake at Wall; row-dice: Rast, Sterling, Frank, Primp, Pogo, Trachea, Blumble, Werebeast, Wolf) get `curve height — a Phase 54 dial (four-band retune), not a Phase 52 cliff`. Reworded the prose disposition paragraphs to match verbatim and added a `Handoff to Phase 54 (TUNE-08)` line naming the 44 handed-on rows with their `wouldBeTrim` notations. Zero engine or `content/bestiary.js` changes — the ruling in force is `hand-to-54`, no dice trims.
- **Task 2 (AFTER bot readout + ledger, `8e18503`):** Ran the three Phase 51-exact bot commands on the `049ab50` commit: `tune-difficulty --seeds=200` solo (death-depth min/p50/p90/max 1/4/6/9, action p50 432), `--seeds=200 --party` (death-depth 1/5/7/12, action p50 703, 75/200 stuck — took ~20 minutes wall-clock, not the ~70-90s ballpark, because party mode's higher maxActions-cap hit rate makes it inherently slower), and `tune-classes --seeds 5 --workers 4` (143 cells, pooled mean depth 3.96, mean of cell means 3.959, meta-parity `true` against `v17-p51-after-smoke.json` modulo commit). Inserted the `### v1.7 · Phase 52 — cadence & damage curve` H3 into `docs/DIFFICULTY-RETUNE.md`, immediately after Phase 51's own H3 and before the pinned `## v1.2 retune (Phase 27)` H2, containing: the rule-change summary (cadence unchanged/pinned, crit doubles the dice, Herman `strikesAs: 5`, the hand-to-54 ruling), identical parameters, `#### BEFORE — by reference: Phase 51 AFTER, commit 608a0e58046177c1dd1f225a40c3f63d402f31e1`, `#### AFTER — commit 049ab5011212a8c6a4bea0f7ee4757dd1923c1b7 (crit doubles the dice; Herman strikes as a level five)` with all three transcripts verbatim, `#### Reading (BEFORE → AFTER)` table, `#### Cadence readout (CAD-03 / SC3)` (both `INVARIANT ... HOLDS` lines quoted), and `#### Damage-curve audit (DMG-01 / SC4)` (both `FLAGGED:` lines and both `## Herman` blocks, 82/100 → 37/37, quoted verbatim).
- **Task 3 (gates + this SUMMARY):** `npm test` 3372/3372, fail 0 (run after both Task 1 and Task 2); `npm run build:www` exit 0; `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged); `git diff --stat 1bb808d -- engine/ test/parity/harness/comparables.js` empty (zero engine/comparables bytes touched this plan); `node tools/cadence-audit.mjs | diff - tools/cadence-audit-output.txt` empty (byte-identical — this plan never touched cadence).

## Task Commits

Each task was committed atomically:

1. **Task 1: still-flagged rows ruled (hand-to-54)** - `049ab50` (docs)
2. **Task 2: Phase 52 AFTER bot readout + ledger H3** - `8e18503` (docs)
3. **Task 3: gates + SUMMARY** - (this commit) (docs)

**Plan metadata:** (this commit or the next) — SUMMARY + STATE + ROADMAP + REQUIREMENTS

## Files Created/Modified

- `content/BESTIARY-REBALANCE.md` — Phase 52 addendum's still-flagged table gained a `Disposition` column (65/65 rows) and the heading moved from "pending ruling" to "ruled"; a `Handoff to Phase 54 (TUNE-08)` line added.
- `docs/DIFFICULTY-RETUNE.md` — new `### v1.7 · Phase 52 — cadence & damage curve` H3 (BEFORE by reference, AFTER transcripts, Reading table, cadence readout, damage-curve audit).
- `docs/class-pass/v17-p52-after-smoke.json` (new) — the AFTER 143-cell class-pass smoke, `meta.commit` 049ab50.

## Decisions Made

- Applied the ruling_in_force override exactly as specified by the orchestrator: tier-5 → `left as a deliberate deep-tier threat (Endgame band) — D-07`; tier 2-4 → `curve height — a Phase 54 dial (four-band retune), not a Phase 52 cliff`. No dice trims — `content/bestiary.js` and `engine/` are byte-identical to `1bb808d` at every commit in this plan.
- Kept the exact disposition phrase out of the prose bullets below the table (describing it by reference instead) so `grep -c 'left as a deliberate deep-tier threat (Endgame band)'` counts exactly the 21 table rows, matching the acceptance criterion's expected count precisely rather than off-by-one.
- Ran the AFTER bot readout on the Task 1 commit (`049ab50`) since Task 1 made no engine/bestiary changes — the AFTER numbers therefore measure the same behavioral tree Plan 02 already fixed; this is expected and correctly reflects "BEFORE = Phase 51 AFTER, AFTER = the finished Phase 52 tree" per the measurement gate (D-11), independent of which specific Phase 52 commit the AFTER readout happens to point at.
- Let the party `tune-difficulty --seeds=200` run to completion in the background (~20 minutes) rather than treating a 3-minute timeout as failure — confirmed via CPU-time inspection that the process was actively computing, not hung, before waiting it out.

## Deviations from Plan

None — plan executed exactly as written; the party bot run's longer-than-expected wall-clock time (documented above under Decisions Made) is a timing observation, not a deviation from the plan's instructions (the plan specified running the command in the foreground and waiting, which is what happened, just longer than the ballpark estimate in the ground rules).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 54's four-band retune has a fully committed AFTER baseline (`docs/DIFFICULTY-RETUNE.md`'s Phase 52 H3, `docs/class-pass/v17-p52-after-smoke.json`) measured under Phase 51's exact bot flags on the finished Phase 52 tree.
- The 44 `level-base`/`row-dice` still-flagged rows are enumerated with their `wouldBeTrim` notations in `content/BESTIARY-REBALANCE.md`'s Phase 52 addendum, ready as direct input to Phase 54's TUNE-08 per-creature decision.
- No blockers. `npm test` 3372/3372, `npm run build:www` green, master hash and `comparables.js` unchanged, zero engine bytes touched this plan.

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. A Bat/Rat or China Wolf fight at depth 5 shows at most 2 foe attack lines between your own actions.
2. A Stalka Beast turn is never two hits AND a bolt in the same turn.
3. A Herman crit on floor 5 no longer one-shots a full-HP level-5 hero — a CRIT line reads at most 37 (was reported at 80).

## Success criteria → proof

| # | Success criterion (ROADMAP.md Phase 52) | Proof |
|---|---|---|
| SC1 | A plain foe swings once per round, an `sp.atk: 2` foe swings twice, a frenzied foe doubles its own swing count — each pinned by a dedicated unit test. | `test/unit/foe-cadence.test.js`'s CAD-01 pins (52-01, unaffected by this plan — cadence untouched). |
| SC2 | A resolver test proves an ability turn contains the ability and zero ordinary swings — the Stalka Beast two-hits-plus-frost log is provably impossible. | `test/unit/foe-cadence.test.js`'s CAD-02 pins (52-01, unaffected by this plan). |
| SC3 | A bot readout records attacks-per-player-action for Bat/Rat and China Wolf floor-5 fights at ≤ `sp.atk` (≤2× frenzied), committed in `docs/DIFFICULTY-RETUNE.md`. | `tools/cadence-audit-output.txt` (52-01, re-run byte-identical this plan) quoted verbatim in `docs/DIFFICULTY-RETUNE.md`'s new `#### Cadence readout (CAD-03 / SC3)` — both `INVARIANT attacks per player action <= 2 (sp.atk 2, unfrenzied): HOLDS` lines present. |
| SC4 | A committed script reports max single-hit damage by depth for every bestiary foe and flags any hit ≥ 60% of a level-appropriate character's max HP; every flagged row (Herman's floor-5 crit among them) is fixed and re-measured clean. | `tools/damage-curve-audit.mjs` (BEFORE `--rule=whole` FLAGGED 116, AFTER `--rule=dice` FLAGGED 65 — both quoted verbatim in the new ledger H3's `#### Damage-curve audit (DMG-01 / SC4)`); Herman's crit fixed 82/100 → 37/37 (both `## Herman` blocks quoted). Every still-flagged cell (65) carries an explicit `Disposition` in `content/BESTIARY-REBALANCE.md` — none silently left unresolved. |
| SC5 | Every damage-curve fix carries a before/after row in `content/BESTIARY-REBALANCE.md`; any moved parity fixtures are measured, declared and regenerated per the engine gate. | `content/BESTIARY-REBALANCE.md`'s Phase 52 addendum: the engine-wide crit tier maxima table, Herman's before/after row (82/100 → 37/37), the measured moved parity set (`action-script.combat.json#lose`, declared in 52-02) with its `divergence-records.test.js` guard, and this plan's `Disposition` column on all 65 still-flagged cells + `Handoff to Phase 54 (TUNE-08)` line. |

Note: `npm run boot:check` is environment-blocked on this machine (pre-existing finding from Phase 50, `.planning/STATE.md`'s open Blockers/Concerns) and was not run as a gate.

## Self-Check: PASSED

- FOUND: content/BESTIARY-REBALANCE.md
- FOUND: docs/DIFFICULTY-RETUNE.md
- FOUND: docs/class-pass/v17-p52-after-smoke.json
- FOUND: .planning/phases/52-foe-cadence-damage-curve/52-03-SUMMARY.md
- FOUND commit: 049ab50 (Task 1)
- FOUND commit: 8e18503 (Task 2)
