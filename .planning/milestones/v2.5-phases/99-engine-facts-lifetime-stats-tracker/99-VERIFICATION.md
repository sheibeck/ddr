---
phase: 99
status: passed
verified: 2026-10-05
method: orchestrator (verifier agents off per config; deferred-UAT protocol)
human_verification:
  - "Pixel 7: kill the app mid-run right after an unlock; relaunch keeps the counts and the unlock with its original date, and it does not fire again"
  - "Pixel 7: adb install -r an update over a 2.5 build; the achievements record and the current-run progress survive"
  - "Pixel 7: a run left in progress on 2.4.0, updated to 2.5.0 and resumed, counts from then on and never earns Naked Ambition or Teetotaler"
---

# Phase 99 Verification

**Status: passed** on automated evidence; device rows deferred to the milestone-close checklist.

| Criterion | Evidence |
|---|---|
| 1. Engine reports every fact additively, zero rng draws, no fixture moved | 99-01: `foeKilled.group`, `afflictionCaught.wp`, `afflictionTick.wp`; draw-count pins unchanged; parity/determinism/roundtrip green; 0 fixtures moved |
| 2. Record in Preferences apart from the run save; zero start; tolerant load; survives relaunch | `src/browser/achievementRecord.js` (key `ddr.achievements.v1`); achievement-record (18) + achievements-persistence (8) tests |
| 3. Every achievement unlocks the moment its condition is met, headless | `src/browser/achievementTracker.js`; tracker (34) + runs (21) + 77-entry sweep (4); real-engine adapter test (Demons kill, Poison to 1 HP, floor-1 death) |
| 4. Unlock fires once, never re-locks, saved in the earning write; relaunch neither loses nor re-fires | achievements-adapter (13) + persistence tests |
| 5. The bot earns nothing and never touches the record | achievements-bot-isolation (4): import walk over tools/ |

Full suite at phase close: 10,871 tests, 10,863 pass, 0 fail, 8 skipped.
