---
phase: 24-every-sub-class-and-race-one-good-one-bad
plan: 07
subsystem: docs
tags: [docs, ledger, class-pass, fixture-inventory, fid-07, ident-10, paperwork]

# Dependency graph
requires:
  - phase: 24-every-sub-class-and-race-one-good-one-bad
    provides: "Combat-side identity pass (24-01), action-path divergence harness (24-02), Fridgian/Dwarven race pass (24-03), Pickpocket store markup (24-04), world-side identity pass + 30-blurb flavor sweep (24-05), identity-contract table (24-06) — this plan is the phase's paperwork close-out, transcribing all of it"
  - phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell
    provides: "Draft Rulings entry for Freeze pays out (23-04-SUMMARY.md), pasted verbatim into this plan's Rulings section"
provides:
  - "docs/CLASS-PASS.md Rulings (Phase 24 — PLAY-03) section filled: 11 sub-class + 3 race rulings, the IDENT-10 dagger KEEP ruling, the Freeze-pays-out entry, the 30-row good/bad table, the FID-07 fidelity posture, and a Phase 24 smoke readout"
  - "test/parity/FIXTURE-INVENTORY.md 'Phase 24 identity-pass divergences' section: combat/lose (seed 14), lose-apprentice (seed 127, added), economy (seed 3), FID-07 gate evidence, and the mechanics measured to touch zero fixture bytes"
affects: [26-mass-playtest-and-class-pass-ledger]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Docs-only closeout plan: every number in the ledger is transcribed verbatim from a prior plan's SUMMARY.md or from a freshly-run tool command, never hand-derived or re-computed"

key-files:
  created: []
  modified:
    - docs/CLASS-PASS.md
    - test/parity/FIXTURE-INVENTORY.md

key-decisions:
  - "The good/bad table's markdown separator row uses `| --- | --- | --- |` (spaced) rather than `|---|---|---|` so the plan's own literal `grep -c \"^\\| \"` acceptance criterion (>= 32 lines including header+separator) is satisfiable — a purely cosmetic formatting choice, same content either way."
  - "The Phase 24 smoke readout picked the four sub-class mechanics (Knight, Court Mage, Guard, Pickpocket) and two race mechanics (Fridgian, Dwarven) that land a real combat/economy-affecting change, rather than an arbitrary six — the other 7 sub mechanics (Ninja/Bard/MoA/Woodsman/Pilfer/Cloaker/Cutthroat/Wilmsry) are refusal/gate mechanics with no expected depth-curve shift, and Elven/Troll/Human/Samurai are unchanged this phase."

requirements-completed: [IDENT-10, IDENT-05, IDENT-06, IDENT-07, IDENT-09, FID-07]

coverage:
  - id: D1
    description: "docs/CLASS-PASS.md's Rulings section records every Phase 24 sub-class/race decision with a one-line rationale, the IDENT-10 dagger KEEP ruling under a grep-able heading, the Freeze-pays-out entry (pasted from 23-04-SUMMARY.md), and the 30-row good/bad table transcribed from 24-06-SUMMARY.md; the AFTER section stays byte-identical"
    requirement: "IDENT-10, IDENT-05, IDENT-06, IDENT-07, IDENT-09"
    verification:
      - kind: other
        ref: "grep -c \"^### Ruling: level-1 Thief dagger\" docs/CLASS-PASS.md == 1; grep -c \"^### Ruling: Freeze pays out\" == 1; awk-counted good/bad table rows == 32; all 17 named mechanics present in the Rulings section; AFTER-section md5 unchanged from HEAD"
        status: pass
    human_judgment: false
  - id: D2
    description: "test/parity/FIXTURE-INVENTORY.md gains a 'Phase 24 identity-pass divergences' section transcribing the measured combat/lose (seed 14) and economy (seed 3) before/after tables, the lose-apprentice addition, the FID-02 pin changes, and the FID-07 gate evidence (comparables.js / prototype-master.js.txt git diffs); the generated roster block is untouched"
    requirement: "FID-07"
    verification:
      - kind: other
        ref: "node --test test/parity/fixture-inventory.test.js (5/5 pass); node tools/fixture-inventory.mjs diffed against the generated block (no content diff); git diff --stat 4ba2edd..HEAD -- test/parity/prototype-master.js.txt (empty)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Phase 24 smoke readout (6 tune-classes runs, 20 seeds each) is appended to the Rulings section as a directional signal only, explicitly caveated as NOT the AFTER matrix; the AFTER section still reads 'Nothing recorded yet.'"
    requirement: "FID-07"
    verification:
      - kind: other
        ref: "docs/CLASS-PASS.md 'Phase 24 note' table (8 lines: header+separator+6 rows); AFTER section's 'Nothing recorded yet.' count == 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm test and the parity suite stay fully green at phase close, with zero engine/content/src/test changes (docs-only plan)"
    requirement: "FID-07"
    verification:
      - kind: other
        ref: "npm test (1188/1188, # fail 0); node --test \"test/parity/**/*.test.js\" (33/33); git status --porcelain engine content src test (empty)"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-09-14
status: complete
---

# Phase 24 Plan 07: Class-Pass Ledger + Fixture-Inventory Paperwork Summary

**Filled docs/CLASS-PASS.md's Rulings section with all 14 sub-class + 3 race Phase 24 decisions (including the IDENT-10 level-1 Thief dagger KEEP ruling and the Freeze-pays-out entry), the 30-row good/bad table, and a caveated 6-run smoke readout; wrote test/parity/FIXTURE-INVENTORY.md's Phase 24 divergence section from the measured combat/lose (seed 14) and economy (seed 3) tables; confirmed the FID-07 zero-new-serialized-field gate via git diff.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 2 (both docs, no code/test/content files touched)

## Accomplishments

- `docs/CLASS-PASS.md`'s Rulings (Phase 24 — PLAY-03) placeholder replaced with: a preamble naming the phase's commit range; 11 sub-class rulings (Knight, Ninja, Bard, Master of Arms, Court Mage, Pickpocket, Cutthroat, Guard, Woodsman, Pilfer, Cloaker) and 3 race rulings (Dwarven, Wilmsry, Fridgian) plus 3 no-change confirmations (Human, Elven, Troll), each with a one-line rationale and requirement ID; the `### Ruling: level-1 Thief dagger (IDENT-10) — KEEP` heading, quoting the ledger's own BY SUBCLASS means (Ninja 4.22, Con Artist 4.08, Acrobat 3.71) as the rationale; the `### Ruling: Freeze pays out` entry pasted verbatim from `23-04-SUMMARY.md`, with the Petrify/Turn/Gate v1.3 candidate note; the 30-row `### Good / bad table` transcribed verbatim from `24-06-SUMMARY.md`; a `### Fidelity posture (FID-07)` paragraph quoting the measured `git diff --stat` evidence.
- `test/parity/FIXTURE-INVENTORY.md` gained a `## Phase 24 identity-pass divergences (IDENT-05..10 / FID-07)` section: an intro naming the two fixture-touching mechanics (Fridgian hide/frenzy on `combat/lose`, Pickpocket markup on `economy`) plus the one added scenario (`lose-apprentice`); the full per-action before/after table for `combat/lose` (seed 14), the FID-02 pin changes, the `lose-apprentice` (seed 127) description, the economy stock/gold-trajectory tables for seed 3, and a "byte-identical elsewhere" paragraph naming every mechanic measured and found to touch zero fixture bytes (Knight, Court Mage, Bard, Guard, Cloaker, Dwarven, Wilmsry, Woodsman, Pilfer, Fridgian-on-flee).
- A Phase 24 smoke readout (`tools/tune-classes.mjs`, 20 seeds each) was run for Knight, Court Mage, Guard, Pickpocket (subs) and Fridgian, Dwarven (races), quoted verbatim in a new `### Phase 24 note` table in the Rulings section, explicitly caveated as a directional signal, not the AFTER matrix.
- Confirmed the FID-07 gate live: `git diff --stat 4ba2edd..HEAD -- test/parity/harness/comparables.js` shows only Plan 24-02's 157-line declared-divergence-helper addition; the same diff against `test/parity/prototype-master.js.txt` is empty.
- Final full-suite run: `npm test` 1188/1188 (`# fail 0`); `node --test "test/parity/**/*.test.js"` 33/33; `git status --porcelain engine content src test` empty, confirming this plan touched only the two named docs.

## Measured Evidence (quoted per the plan's `<output>` requirement)

### FID-07 gate check

```
$ git diff --stat 4ba2edd70ca3be04c49fd1ba74ae5c77dc593703..HEAD -- test/parity/harness/comparables.js
 test/parity/harness/comparables.js | 157 +++++++++++++++++++++++++++++++++++++
 1 file changed, 157 insertions(+)

$ git diff --stat 4ba2edd70ca3be04c49fd1ba74ae5c77dc593703..HEAD -- test/parity/prototype-master.js.txt
(empty — no output)
```

### Phase 24 smoke readout (6 tune-classes runs, 20 seeds each)

| Sub / Race | BEFORE mean depth (roll-up) | Phase 24 smoke (20 seeds) | Stuck |
|---|---|---|---|
| Knight | 3.19 | 3.48 | 0 of 120 |
| Court Mage | 2.52 | 2.49 | 0 of 120 |
| Guard | 2.80 | 3.22 | 0 of 120 |
| Pickpocket | 2.88 | 3.01 | 0 of 120 |
| Fridgian | 2.46 | 2.97 | 0 of 460 |
| Dwarven | 2.45 | 2.73 | 0 of 480 |

Every sub/race moved up or held flat within noise; none regressed; 0 of
1560 total smoke runs got stuck. Directional signal only — no dial or bot
policy was changed. The paired, rigorous AFTER matrix is Phase 26.

### Final suite pass counts

`npm test` — 1188/1188, `# fail 0` (unchanged from the phase's running
total at 24-06's close, since this plan is docs-only). `node --test
"test/parity/**/*.test.js"` — 33/33.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fill the Rulings section — every decision with rationale, the IDENT-10 dagger ruling, the Freeze-pays-out entry, the good/bad table** - `1d07335` (docs)
2. **Task 2: FIXTURE-INVENTORY.md "Phase 24" divergences section + FID-07 comparables diff check** - `4bc972e` (docs)
3. **Task 3: Phase 24 smoke readout (directional only) appended to the Rulings section; final suite run** - `9f22e29` (docs)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `docs/CLASS-PASS.md` - Rulings (Phase 24 — PLAY-03) section fully populated (sub-class rulings, race rulings, dagger ruling, Freeze ruling, good/bad table, fidelity posture, smoke readout); AFTER section byte-identical
- `test/parity/FIXTURE-INVENTORY.md` - new "Phase 24 identity-pass divergences" section; generated roster block untouched

## Decisions Made

- The good/bad table's and the smoke-readout table's markdown separator rows use spaced `| --- | --- |` cells rather than the doc's usual bare `|---|---|` convention, purely so the plan's own literal `grep -c "^\| "` line-count acceptance criteria (>= 32 and >= 8 respectively) count the separator row as a "| " line — no content difference, cosmetic only, isolated to these two new tables.
- The Phase 24 smoke readout covers the 4 sub-class mechanics (Knight, Court Mage, Guard, Pickpocket) and 2 race mechanics (Fridgian, Dwarven) that plausibly shift the depth curve; the remaining 7 sub mechanics are pure refusal/gate mechanics with no expected curve shift, and Elven/Troll/Human/Samurai are unchanged this phase.

## Deviations from Plan

None - plan executed exactly as written. One minor self-correction during Task 1/3 verification: the good/bad table and smoke-readout table separator rows initially used the doc's bare `|---|---|` convention, which didn't match the acceptance criteria's `^\| ` line-count regex (undercounted by 1 row each); reformatted both separator rows to `| --- | --- |` before committing — a pure formatting fix caught during the same task's own verification pass, not a deviation from the plan's substance.

## Issues Encountered

None beyond the formatting self-correction noted above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 24 ("Every Sub-class and Race: One Good, One Bad") is now fully complete: all 7 plans landed (combat-side identity pass, action-path divergence harness, Fridgian/Dwarven race pass, Pickpocket store markup, world-side identity pass + flavor sweep, identity-contract table, and this plan's ledger/paperwork close-out).
- `docs/CLASS-PASS.md`'s Rulings section and `test/parity/FIXTURE-INVENTORY.md`'s Phase 24 section are both complete and ready for Phase 26 ("Mass Playtest & Class-Pass Ledger") to reference when it captures the AFTER matrix and writes fun-band verdicts.
- No blockers. `npm test` 1188/1188, `# fail 0`; parity 33/33; `test/parity/prototype-master.js.txt` untouched; zero engine/content/src/test files changed by this plan.

---
*Phase: 24-every-sub-class-and-race-one-good-one-bad*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: .planning/phases/24-every-sub-class-and-race-one-good-one-bad/24-07-SUMMARY.md
- FOUND commit: 1d07335 (Task 1)
- FOUND commit: 4bc972e (Task 2)
- FOUND commit: 9f22e29 (Task 3)
