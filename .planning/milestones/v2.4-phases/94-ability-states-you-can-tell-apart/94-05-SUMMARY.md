---
phase: 94-ability-states-you-can-tell-apart
plan: 05
subsystem: ui
tags: [abilities, shell-snapshot, docs, patch-notes, phase-gate, ASTATE-01, ASTATE-05]
requires:
  - phase: 94-02
    provides: "the data-state edge rules and ink tokens"
  - phase: 94-04
    provides: "combat and Hero rows built from abilityState / singState"
provides:
  - "test/unit/shell-ability-states.test.js with two declared fixtures (combat ABILITIES submenu, Hero tab in a fight) and the Bard SING row check"
  - "docs/ABILITIES.md 'The rows' subsection; the Sing audit cell reads READY IN n in SKILL-AUDIT.md and its generated copy"
  - "2.4.0 DRAFT patch notes: two Interface bullets (the four states; Last Stand's visible gate)"
  - "the Phase 94 gate results and the batched on-device checklist"
affects: []
tech-stack:
  added: []
  patterns: ["declared shell snapshots: new fixtures only, the eight Phase 47 fixtures byte-identical"]
key-files:
  created:
    - test/unit/shell-ability-states.test.js
    - test/unit/fixtures/shell-snapshots/fighter.abilities-states.txt
    - test/unit/fixtures/shell-snapshots/fighter.hero-in-combat.txt
  modified:
    - docs/ABILITIES.md
    - docs/SKILL-AUDIT.md
    - docs/USABLE-FEATURES-AUDIT.md
    - docs/patch-notes/2.4.0.md
    - test/unit/hero-conditions.test.js
    - test/unit/foe-conditions.test.js
key-decisions:
  - "The snapshot uses one Fighter showing all four states and two unavailable reasons; the Bard SING row is assertions only (no fixture)"
  - "2.4.0 Headline left as it is; the user agrees the draft at release time"
requirements-completed: []
status: complete
duration: ~35 min
completed: 2026-10-03
---

# Phase 94 Plan 05: Pin the rows, write the words down, run the gate Summary

The real shell's rendered ability rows are now pinned by two declared snapshots (the combat ABILITIES submenu and the Hero tab in a fight), a Bard SING row check proves it reads READY IN N between songs, the docs and the 2.4.0 DRAFT notes carry the four states and Last Stand's now-visible hp gate, and the full phase gate is green. (ASTATE IDs are left for the orchestrator to mark.)

BASE (HEAD at plan start): `be172bbab66e1f581716b77f595e99b8c4e13845`.
PHASE_BASE (from 94-01-SUMMARY): `c1b315399ff98c9470f669cce2dfa48a74e90ee6`.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1 | `0fe97d25` | `shell-ability-states.test.js` (three tests) and the two NEW declared fixtures |
| 2 | `50d94e87` | ABILITIES.md "The rows (ASTATE-01..03, 05)"; Sing cell READY IN n in SKILL-AUDIT.md and the generated block; USABLE-FEATURES-AUDIT.md Phase 94 bullet; two 2.4.0 Interface bullets; hero/foe-conditions descriptor strings |
| 3 | (no file changes) | the phase gate, results below |

## Declared DOM change

Two NEW fixtures, no existing fixture moved: `fighter.abilities-states.txt` and `fighter.hero-in-combat.txt`. `git diff --stat PHASE_BASE -- test/unit/fixtures/shell-snapshots` lists only those two files (92 insertions). The eight Phase 47 fixtures (thief/mu hero, gear, gear-sheet, store) are untouched; `shell-tab-snapshots.test.js` passes.

First lines of each captured fixture:

`fighter.abilities-states.txt`:
```
## #cb-sub-title
<span id="cb-sub-title" class="cb-sub-title">
  text="TEST DELVER · ABILITIES"
```
Rows in order: `data-state="ready"` READY, `recharging` READY IN 3, `spent` SPENT THIS FIGHT, `unavailable` NEEDS TWO OR MORE FOES, `unavailable` NEEDS A QUARTER HP OR LESS.

`fighter.hero-in-combat.txt`:
```
## #s-abilities
<div id="s-abilities">
  <li data-state="ready">
```
Same five states and words, each in a trailing span; the Kata item carries its long description in `<i>` as before.

Notes: the recording DOM keeps `data-*` on `node.dataset`, so the test reads `row.dataset.state` (not `getAttribute`). `paint()` populates `#s-abilities` in a fight, so the `__mzTabs.hero` fallback was not needed. Every combat row carries `aria-disabled="true"` in the capture because the arm sweep has not armed the buttons in the sandbox; that is the guardTap state, not the disabled property (no row is `disabled`, asserted).

## Gate results

| Check | Result |
| --- | --- |
| `npm test` | 10283 tests, 10275 pass, 0 fail, 8 skipped (phase 94-04 close: 10280 / 10272 / 0 / 8; +3 = this plan's three tests; phase baseline 10,226) |
| `node tools/narrative-review.mjs --check` | pages are in sync |
| `node tools/voice-inventory.mjs --check-ledgers --after` | 58 ledger files, 0 errors |
| `npm run build:www` | exit 0 (stamped 2.3.0 (13)) |
| `node tools/patch-notes.mjs --check` | `patch notes 2.3.0: OK (Play cut 474/500)` |
| `validatePatchNotes(2.4.0.md, "2.4.0")` | returns [] |
| `git diff --stat PHASE_BASE -- test/parity test/determinism test/roundtrip test/unit/roll-high-state-pins.test.js test/parity/harness/comparables.js test/parity/prototype-master.js.txt` | prints nothing (no parity, determinism, round-trip or roll-high fixture and not the prototype master moved across the phase) |
| `git diff PHASE_BASE.. -- docs/patch-notes/2.3.0.md src/browser/patchNotesData.js android/version.properties` | prints nothing |
| `npm run boot:check` | not a clean pass: no-uncaught PASS, painted PASS, title PASS, `graves` FAIL on 3 of 4 runs here (PASS on the other). This is the known pre-existing `graves` flake logged in STATE.md (Phase 50 environment block; the dump here was not empty, the console log is just Chrome enterprise-policy/WLAN noise). Not a code regression from this phase; reported, not fought. |

## Joiner note

Joiner ability states are engine-pinned only (`abilityState` accepts a Joiner's sheet and a sweep proves `pickMemberAbility`'s pick reads ready). No screen lists a Joiner's abilities, so there is no Joiner row to snapshot. Ask the user whether a Joiner ability line is wanted later.

## Deviations from Plan

None. The plan executed as written; Task 3 needed no fixes. The new patch-notes bullets, doc subsection and fixtures use the exact wording the plan specified, and the Sing audit cell and its generated copy were changed together so `skill-audit.test.js` still regenerates an identical block.

## Known Stubs

None.

## Threat Flags

None: tests, docs and patch-note text only.

## Human verification (end of phase, batched, Pixel 7)
1. A Fighter or Thief in a fight, ABILITIES open: a ready row has a solid lime edge and READY; use one and it reads READY IN N with a dashed amber edge, and N drops each round until READY; a used once-per-fight ability reads SPENT THIS FIGHT, flat dark with no edge.
2. Sweep with one foe left: NEEDS TWO OR MORE FOES with a dotted coral edge and a faint diagonal hatch. Judge the hatch weight (12%; the test caps it at 14%) and whether the lime ready ink (#cbee86) and the coral (#fc7970) feel right; tune only the tokens or the alpha, keeping test/unit/ability-state-a11y.test.js green (muted edge alternatives: #5e7a3c, #a8761f, #c4483a).
3. Tap each non-ready row: the fight log's refusal names the same reason the row shows, and nothing is spent.
4. Last Stand at full hp reads NEEDS A QUARTER HP OR LESS; below a quarter hp it reads READY (intended: it was always refused; the row now says so).
5. A Bard: SING reads READY, then READY IN N after the first song, then SPENT THIS FIGHT after the second.
6. The Hero tab mid-fight shows the same words, with the edge on each row's left rule; out of a fight it shows the cooldown lengths as before.
7. Sidestep (or Smoke) just used reads READY IN N counting its effect rounds too: expected (the Active state is deferred), not a bug.
8. Text size L: NEEDS A QUARTER HP OR LESS wraps inside the row without pushing the ability name off.

## Self-Check: PASSED

- `test/unit/shell-ability-states.test.js`, `test/unit/fixtures/shell-snapshots/fighter.abilities-states.txt`, `fighter.hero-in-combat.txt` exist.
- Commits `0fe97d25` and `50d94e87` exist and each ends with both trailers.
