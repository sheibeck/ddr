---
phase: 72-roll-direction-sign-audit-fixes
plan: 04
subsystem: engine (combat to-hit, foe-vs-hero/member)
tags: [roll-01, sign-fix, combat, parley, thief, evasion, smoke, parity]

requires:
  - phase: 72-01
    provides: "docs/ROLL-LEDGER.md's known fixes (a)/(d) and the F5 ruling context"
  - phase: 72-02
    provides: "test/unit/rollDirection.test.js's pending [foe-vs-hero:thief-evasion] and [foe-vs-member:insult-after-member-smoke] rows, and test/unit/harness/rollOdds.js"
provides:
  - "engine/derived.js#foeToHitVs/#foeToHitBreakdown: CLASS_MITIGATION.Thief.evasion (vs hero only) is SUBTRACTED from the foe's need, not added"
  - "engine/combat.js#foeTurn member branch: the parleyInsulted term now applies AFTER the member's own Sidestep/Smoke override, matching the hero branch and pursuitStrike"
  - "Smoke's player-facing text (content/abilities.js, content/skills.js, docs/ABILITIES.md) and both smokeThrown narration lines (src/browser/eventNarration.js, src/browser/narrationLines.js) now state the insult exception"
  - "test/parity/FIXTURE-INVENTORY.md's new Phase 72 H2 + this plan's measured-zero subsection"
  - "test/parity/divergence-records.test.js's ROLL-01 (Phase 72) standing guard + ROLL01_EXPECTED_HOLDERS (empty; 72-05/06/07 extend it)"
affects: [72-05, 72-06, 72-07, "Phase 73 (roll-high mirror)", "Phase 74 (display-sign)"]

tech-stack:
  added: []
  patterns:
    - "A member's own ability timers (Sidestep/Smoke/Taunt) live on state.party[member.partyIdx], read via abilityEffectActive(mSheet, key) — never on the hero's c — and a foe-swing need's post-override terms (blind/penalty/insulted) must all sit AFTER those per-body overrides, on both the hero and member branches, for the insult to actually stack instead of being swallowed."

key-files:
  created: []
  modified:
    - engine/derived.js
    - engine/difficulty.js
    - engine/combat.js
    - content/abilities.js
    - content/skills.js
    - docs/ABILITIES.md
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/class-mitigation.test.js
    - test/unit/feedback-payload.test.js
    - test/unit/abilities-catalog.test.js
    - test/unit/parley.test.js
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
    - test/unit/rollDirection.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/divergence-records.test.js

key-decisions:
  - "Confirmed ability/skill txt is NOT serialized into state before editing Smoke's wording: engine/character.js's c.abilities stores only string ids (entry.active / id) and c.skills stores only key/level pairs — no comparables.js carve-out needed, per the plan's own gate (Task 2's action block required this check before editing)."
  - "The two shell-snapshot regeneration passes (MZ_SNAPSHOT_UPDATE=1) touched 8 fixture files on disk, but 7 of those 8 diffs were line-ending-only (LF vs the repo's committed CRLF, a pre-existing worktree autocrlf artifact) with zero content change — those 7 were reverted with `git checkout --` before committing, leaving only thief.hero.txt's genuine one-line content change staged, per the plan's `git diff --stat` acceptance criterion."
  - "The ROLL-01 (Phase 72) standing guard (test/parity/divergence-records.test.js) proves a stronger claim than the GRULE-01/STORE-02 precedent it copies: instead of checking that no fixture dispatches a specific gated action, it replays all 31 sites and asserts zero memberStruck/member-foeMissed events anywhere — the direct positive proof that no fixture's engine state ever reaches the member branch this plan's insult-reorder touches, since none of the six fixture files ever populates state.party/combat.allies."

requirements-completed: [ROLL-01]

duration: ~1 session
completed: 2026-09-24
status: complete
---

# Phase 72 Plan 04: Thief evasion sign + insult-after-member-smoke ordering Summary

**Flipped the Thief `evasion` dial's sign to SUBTRACT from the foe's need (a positive value now makes a Thief harder to hit) and moved the parley insult to the LAST need term on `foeTurn`'s party-member branch, so a member's own Smoke can no longer swallow the insult — both fixes measured at zero parity fixture moves.**

## Performance

- **Duration:** ~1 session
- **Tasks:** 3 (Task 1: evasion sign; Task 2: insult reorder + Smoke text; Task 3: measure and declare zero)
- **Files modified:** 16 (5 Task 1, 10 Task 2, 2 Task 3 — `test/unit/rollDirection.test.js` touched by both Task 1 and Task 2)

## Accomplishments

- **Fix (d):** `engine/derived.js#foeToHitVs` and `#foeToHitBreakdown` now do `h -= classEvasionFor(c)` (was `h +=`) for `vs === "hero" && c.cls === "Thief"`. Identity (evasion 0) is unchanged everywhere; a positive dial now makes the Thief harder to hit, matching its name. `engine/difficulty.js#classEvasionFor`'s JSDoc direction rewritten to match.
- **Fix (a):** `engine/combat.js#foeTurn`'s party-member branch moves the `if (C.parleyInsulted)` block from BEFORE the member's own Sidestep/Smoke override to immediately AFTER it — the last need term before the `mRoll > mNeed` miss test, exactly matching the hero branch and `pursuitStrike` (which already applied it last). A Smoked, insulted member is now found on 2 faces (was 1).
- Smoke's player-facing text updated everywhere it's authored (`content/abilities.js`, `content/skills.js`, `docs/ABILITIES.md`, the `test/unit/abilities-catalog.test.js` pin) to "...need a natural 1 to find you (a 1–2 if you insulted them)...", plus both `smokeThrown` narration lines (`src/browser/eventNarration.js`, `src/browser/narrationLines.js`).
- Confirmed ability/skill `txt` is not serialized into `state` (grepped `engine/character.js` — `c.abilities` stores only ids, `c.skills` stores only key/level pairs) — no `comparables.js` carve-out needed.
- The two formerly-`todo` direction rows (`[foe-vs-hero:thief-evasion]`, `[foe-vs-member:insult-after-member-smoke]`) in `test/unit/rollDirection.test.js` now pass green with the `todo` option removed.
- Both fixes measured at **zero** parity fixture moves: `node --test test/parity/*.test.js` is 47/47 green, both fixture scans diff empty, `test/parity/fixtures/`/`comparables.js`/`prototype-master.js.txt` are byte-identical to the plan's base commit, and the master hash is unchanged.
- `test/parity/FIXTURE-INVENTORY.md`'s new `## Phase 72: roll-direction sign fixes (ROLL-01)` H2 and this plan's `### Plan 04` measured-zero subsection; `test/parity/divergence-records.test.js`'s new `ROLL-01 (Phase 72)` standing guard (part a: declared set == `ROLL01_EXPECTED_HOLDERS`, currently empty; part b: zero `memberStruck`/member-`foeMissed` events across all 31 replay sites).

## Task Commits

1. **Task 1: (d) Thief evasion subtracts from the foe's need** — `c8cd666` (fix) — `engine/derived.js`, `engine/difficulty.js`, `test/unit/class-mitigation.test.js`, `test/unit/feedback-payload.test.js`, `test/unit/rollDirection.test.js`.
2. **Task 2: (a) The insult is the last term on the member branch; the Smoke text stays true** — `6484f48` (fix) — `engine/combat.js`, `content/abilities.js`, `content/skills.js`, `docs/ABILITIES.md`, `src/browser/eventNarration.js`, `src/browser/narrationLines.js`, `test/unit/abilities-catalog.test.js`, `test/unit/parley.test.js`, `test/unit/fixtures/shell-snapshots/thief.hero.txt`, `test/unit/rollDirection.test.js`.
3. **Task 3: Measure and declare zero fixture moves; open the Phase 72 inventory section and the ROLL-01 guard** — `cae934e` (docs) — `test/parity/FIXTURE-INVENTORY.md`, `test/parity/divergence-records.test.js`.

**Plan metadata:** this SUMMARY's own commit (docs: complete plan), made by the execution harness after this file is written.

## Files Created/Modified

- `engine/derived.js` — `foeToHitVs`/`foeToHitBreakdown`: evasion term subtracted instead of added.
- `engine/difficulty.js` — `classEvasionFor`'s JSDoc direction rewritten.
- `engine/combat.js` — `foeTurn` member branch: insulted block moved after Smoke; comment notes added to the hero branch and `pursuitStrike`.
- `content/abilities.js`, `content/skills.js`, `docs/ABILITIES.md` — Smoke `txt` reworded with the insult exception.
- `src/browser/eventNarration.js`, `src/browser/narrationLines.js` — `smokeThrown` narration reworded.
- `test/unit/class-mitigation.test.js` — evasion probe value flipped to +1, title updated.
- `test/unit/feedback-payload.test.js` — evasion matrix iterates `[1, 0]`, asserts `delta === -evasion`.
- `test/unit/abilities-catalog.test.js` — Smoke `txt` pin updated.
- `test/unit/parley.test.js` — new test: `Phase 72 ROLL-01 (a): the member branch applies the insult after the member's own Smoke` (needMods order + faceOdds).
- `test/unit/fixtures/shell-snapshots/thief.hero.txt` — regenerated (one line, the Smoke description).
- `test/unit/rollDirection.test.js` — both pending rows' `todo` option removed.
- `test/parity/FIXTURE-INVENTORY.md` — new Phase 72 H2 + Plan 04 measured-zero subsection.
- `test/parity/divergence-records.test.js` — new `ROLL01_EXPECTED_HOLDERS` constant + `ROLL-01 (Phase 72)` guard test.

## Decisions Made

See `key-decisions` in the frontmatter — summarized: confirmed no `comparables.js` carve-out is needed for the Smoke text (not serialized state); the snapshot regeneration's 7 line-ending-only diffs were reverted before committing, leaving only the genuine content change; the ROLL-01 guard proves the stronger "zero member-branch events across all 31 sites" claim rather than just "no fixture dispatches a specific action."

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed autonomously with no auto-fixes needed beyond the plan's own explicit instructions.

## Measurement Log (Task 3)

1. `node --test test/parity/*.test.js`: 47 tests, 47 pass, 0 fail.
2. `node tools/initiative-fixture-scan.mjs | diff --strip-trailing-cr - tools/initiative-fixture-scan-output.txt`: empty.
3. `node tools/worn-fixture-scan.mjs | diff --strip-trailing-cr - tools/worn-fixture-scan-output.txt`: empty.
4. `git diff --stat -- test/parity/fixtures/ test/parity/harness/comparables.js test/parity/prototype-master.js.txt` (plan-base `a346452`..HEAD): empty.
5. `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged).
6. `node --test test/parity/fixture-inventory.test.js`: 5 tests, 5 pass, 0 fail.

**Txt-serialization check (Task 2):** `engine/character.js` stores `c.abilities` as an array of string ids (`entry.active`, `id`) and `c.skills` as a plain `{ [name]: level }` map — neither carries `txt`. No `test/parity/harness/comparables.js` carve-out needed; confirmed before editing content/narration text, per the plan's gate.

## Verification

- `node --test test/unit/class-mitigation.test.js test/unit/feedback-payload.test.js test/unit/rollDirection.test.js`: 127 pass, 0 fail, 9 todo (down from 10 — the thief-evasion row is now green).
- `node --test test/unit/parley.test.js test/unit/abilities-catalog.test.js test/unit/shell-tab-snapshots.test.js test/unit/rollDirection.test.js test/unit/feedback-payload.test.js test/unit/formatEventsCoverage.test.js test/unit/narrationLinesCoverage.test.js`: 169 pass, 0 fail, 8 todo (down from 9 — the insult-after-member-smoke row is now green).
- Member-branch order check: `node -e "..."` (the plan's own grep-order script) prints `ok`.
- `grep -c "a 1–2 if you insulted them" content/abilities.js content/skills.js docs/ABILITIES.md test/unit/abilities-catalog.test.js`: 1 in each of the four files.
- `grep -c "insulted them" src/browser/eventNarration.js src/browser/narrationLines.js`: 1 in each file.
- `git diff --stat -- test/unit/fixtures/shell-snapshots/`: only `thief.hero.txt`, one line, containing "insulted them".
- `node --test test/parity/divergence-records.test.js test/parity/fixture-inventory.test.js`: 14/14 pass.
- `node --test test/parity/*.test.js`: 47/47 pass.
- `npm test`: 5,559 pass / 7 fail / 8 todo. The 7 failures are the pre-existing worktree-only CRLF doc-ledger noise the orchestrator flagged before this plan started (`docs/CLASS-PASS.md`/`docs/FLEE.md` byte-identical-render checks, checked out CRLF by `core.autocrlf` in a fresh worktree; identical on the base commit and untouched by this plan — confirmed via `git diff --stat a346452..HEAD -- docs/CLASS-PASS.md docs/FLEE.md`, empty). The 8 todo rows are 72-05's (2) and 72-06's (6) own pending fixes, not this plan's.

## Issues Encountered

None beyond the expected worktree-only CRLF noise documented above (pre-existing, not caused by this plan).

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

On the Pixel 7, use Smoke in a fight after a failed parley and confirm the Smoke card and Oracle log line read "(a 1–2 if you insulted them)".

## Next Phase Readiness

- `docs/ROLL-LEDGER.md`'s known fixes (a) and (d) are landed; (b) and (c) remain for 72-05/72-06, and F5 (`parleyNeedModFor`) for 72-07.
- `ROLL01_EXPECTED_HOLDERS` in `test/parity/divergence-records.test.js` is ready for 72-05/72-06/72-07 to extend with their own measured moved sets.
- `test/unit/rollDirection.test.js` now carries 8 remaining `todo` rows (2 frenzy, 6 shatter) for 72-05/72-06 to flip.
- Phase 73's roll-high mirror can run `test/unit/rollDirection.test.js` and `test/unit/harness/rollOdds.js` unchanged — this plan touched neither file's odds-only contract, only removed two `todo` options.

---
*Phase: 72-roll-direction-sign-audit-fixes*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: engine/derived.js
- FOUND: engine/combat.js
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: test/parity/divergence-records.test.js
- FOUND: .planning/phases/72-roll-direction-sign-audit-fixes/72-04-SUMMARY.md
- FOUND commit c8cd666 (Task 1)
- FOUND commit 6484f48 (Task 2)
- FOUND commit cae934e (Task 3)
- FOUND commit 99cb26d (SUMMARY commit)
