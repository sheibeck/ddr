---
phase: 92-store-economy-balance-close
plan: 05
subsystem: balance-close-docs
tags: [TUNE-10, drift-ruling, accept-and-record, docs-close]
requires:
  - phase: 92-03
    provides: the economy lock and the last economy readout (commit 21111a88)
  - phase: 92-04
    provides: the TUNE-10 pass, the drift list D1 and D2
provides:
  - the user's drift ruling (accept and record, 2026-10-01) in docs/DIFFICULTY-RETUNE.md and the Phase 92 final reading
  - docs/ECONOMY-READOUT.md closed, with the floors 8 to 12 overshoot accepted and recorded
  - a Closed by Phase 92 line under every audit's Phase 92 findings
affects: []
tech-stack:
  added: []
  patterns: [a clean-close plan that builds nothing and proves it with ledger guards]
key-files:
  created: []
  modified:
    - docs/DIFFICULTY-RETUNE.md
    - docs/ECONOMY-READOUT.md
    - docs/ITEM-AUDIT.md
    - docs/SPELL-AUDIT.md
    - docs/SKILL-AUDIT.md
    - docs/IDENTITY-AUDIT.md
    - docs/VALUE-LEDGER.md
    - test/unit/economy-readout-ledger.test.js
    - test/unit/difficulty-retune-ledger.test.js
key-decisions:
  - "TUNE-10 D1/D2 ruled ACCEPT AND RECORD (option A) by the user, 2026-10-01: nothing built for the drift"
  - "Floors 8 and 9 with-bag overshoot (53%/54% vs 42% at depth 7) accepted with the floors 10 to 12 overshoot, to revisit after a device playthrough (user, 2026-10-01)"
requirements-completed: [TUNE-10]
duration: about 30 minutes
completed: 2026-10-01
status: complete
---

# Phase 92 Plan 05: The phase close (drift accepted, docs closed) Summary

**No retune: the user accepted the fair-bot drift (median death floor 5 against the [3, 4] band, floors 3 to 6 MISS) as recorded, the Phase 92 ledger now ends with the ruling and the final reading, the economy readout reads closed, and every audit's Phase 92 hand-off says where it was handled.**

## What was built

No retune: the user's ruling (2026-10-01, after the 92-04 pass) on D1 and D2 is ACCEPT AND RECORD (option A), so nothing is built for the drift. Before the pass the user said: "It's ok if the numbers move. Let's see where they land." To be verified on device runs.

Skipped by the ruling, as the plan allows for a clean or accept path:

- Task 1 (retune): no dial refit, no engine or canon change, no bot fix; no `fit/drift-*` file, no `readDriftLock()`, `engine/difficulty.js`, `tools/lib/tuning-bot.mjs` and `test/difficulty/difficulty.test.js` untouched.
- Task 2 (fixtures and after-readouts): skipped. Nothing moved, so there is no `### Phase 92 plan 05` entry in `test/parity/FIXTURE-INVENTORY.md`, no after-readout (`92-after-*`), no re-run economy readout (no price, gold source or shopping rule changed; the fair bot never sells) and no fixture, state pin or unit pin regenerated.

Task 3 (commit 4e38ca9e), the only work done:

- `docs/DIFFICULTY-RETUNE.md`: `### Phase 92 — ruling` replaces `Pending` with the ruling, the date, the user's words and "what 92-05 built: nothing"; the D1 and D2 tags read "ruled 2026-10-01: accepted and recorded"; `### Phase 92 — final reading` is the last Phase 92 section (the fair-bot median and what it means for a human, starvation after the d10 rations, the economy at depth 7 after 92-03, each drift item and its ruling, and the flags carried to a later milestone); `## v1.2 retune (Phase 27)` is still the last H2.
- `docs/ECONOMY-READOUT.md`: Status `closed 2026-10-01`; the accepted-overshoot paragraph (floors 8 and 9 with-bag 53% and 54% against 42%, floors 10 to 12 on gold alone 46%, 67%, 75%; revisit after a device playthrough); a final `**Closed 2026-10-01:**` line naming the last readout's commit (21111a88) and the TUNE-10 pointer. The ECON-12 verdict (PASS) stands.
- Audits: each `Phase 92` findings bullet (ITEM-AUDIT x5, SPELL-AUDIT, SKILL-AUDIT, IDENTITY-AUDIT, VALUE-LEDGER) gets a `Closed by Phase 92 (...)` line pointing at 92-01 (bot fixes), 92-02/92-03 (the economy) or 92-04 (the measured watch items, with numbers); no existing bullet was reworded.
- Guards: `test/unit/economy-readout-ledger.test.js` accepts `retuned|closed` and gains two tests (a closed doc has its date and names the commit its last readout measured, as its last line; the accepted overshoot is recorded with the user's date); `test/unit/difficulty-retune-ledger.test.js` gains one test (the ruling is not pending and carries the date and ruling, the final reading is the last Phase 92 section, the v1.2 H2 stays last).

## Moved fixtures

None. `git diff --stat` over `engine content tools test/parity/prototype-master.js.txt` is empty.

## After numbers per drift item

No after-readout was taken (nothing moved). The numbers stand as measured by 92-04 (commit 10fec3c3): D1 p50 death floor 5 against [3, 4] (accepted); D2 floors 3 (+11.5), 4 (+17.0), 5 (+13.5), 6 (+9.1) MISS against a tolerance of 8 (accepted); D3 to D7 no drift.

## Verification

`node --test test/unit/difficulty-retune-ledger.test.js test/unit/economy-readout-ledger.test.js test/unit/item-audit.test.js test/unit/spell-audit.test.js test/unit/skill-audit.test.js test/unit/identity-audit.test.js test/unit/value-ledger.test.js`: 137 of 137 pass. `grep -c "^### Phase 92 — final reading"` prints 1; `grep -c "^\*\*Status:\*\* closed"` prints 1; `Closed by Phase 92` appears in all five audit docs. No bot run, no full `npm test` (the orchestrator runs it once at phase close).

## Deviations from Plan

None - plan executed as written for the accept path; Tasks 1 and 2 skipped by the user's ruling. STATE.md, ROADMAP.md and REQUIREMENTS.md were not edited (instruction).

One process note: the first run of my doc-edit script duplicated a section of docs/DIFFICULTY-RETUNE.md (an anchor matched an earlier mention); it was reverted with `git checkout -- docs/DIFFICULTY-RETUNE.md` before any commit and re-run with a correct anchor.

## Auth gates

None.

## Known Stubs

None.

## Threat Flags

None (docs and ledger guard tests only).

## Human verification

1. Play two or three runs on the debug APK and note where they end. The fair bot's median is floor 5; by the rule of thumb a skilled human should end about floor 7 to 9. This is the check on the accepted D1/D2 drift: flag a run that ends far earlier or later, with the class and race.
2. Read `### Phase 92 — final reading` and `### Phase 92 — ruling` in docs/DIFFICULTY-RETUNE.md: D1 and D2 read as you ruled them (accepted and recorded, nothing built), and the carried flags are the ones you expect.
3. At a store on floors 8 and up, note whether the Sell prices (about an eighth of base) and what you can afford feel right; the floors 8 to 12 overshoot is accepted and recorded in docs/ECONOMY-READOUT.md, to be revisited after your playthrough.

## Self-Check: PASSED

Files found: the nine modified files above and this SUMMARY. Commit found: 4e38ca9e. The targeted tests pass (137 of 137). `git diff --stat -- engine content tools test/parity/prototype-master.js.txt` is empty.
