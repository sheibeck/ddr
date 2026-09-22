# Deferred Items — Phase 58

## Pre-existing `npm test` failures, out of scope for 58-02

Logged during 58-02 execution (2026-09-22). `npm test` at this plan's completion
reports 3654/3670 passing, 16 failing. All 16 are confirmed pre-existing —
verified by reverting `src/browser/sfx.js` to its last committed state (fully
removing this plan's changes) and re-running; the failures persisted
identically. None of the 16 touch `src/browser/combatBeat.js`,
`src/browser/sfx.js`, `test/unit/combat-beat.test.js`, or
`test/unit/sfx-cues.test.js` — they span unrelated subsystems (DOM tab
snapshots, a parity/divergence doc scan, and the flee-ledger content table).
Per the scope-boundary rule ("only auto-fix issues DIRECTLY caused by the
current task's changes"), these are logged here rather than fixed:

- `HEDGE-03: the holders declaring worn are exactly the scan's MOVED SET` —
  `test/parity/divergence-records.test.js`
- `INIT-01: the holders declaring Phase 51 are exactly the initiative scan's MOVED SET` —
  `test/parity/divergence-records.test.js`
- `Outliers (Phase 26) lists exactly the revisit rows` — `test/parity/divergence-records.test.js`
- `AFTER, Outliers and Handoff blocks are byte-identical to a fresh render` —
  `test/parity/divergence-records.test.js`
- `Handoff to Phase 27 carries the yardstick` — `test/parity/divergence-records.test.js`
- `v1.5 AFTER section is byte-identical to a fresh render` — `test/parity/divergence-records.test.js`
- `Modifier table: every FLEE_RACE_MOD/FLEE_CLASS_MOD key's numeric cell equals the content value; the Thief flee bonus is separate` —
  `test/unit/flee-ledger.test.js`
- `Before/after table: the Human Fighter no-armor row's New need is FLEE_NEED; the Thief Leather row's is FLEE_NEED - FLEE_THIEF_BONUS` —
  `test/unit/flee-ledger.test.js`
- `Before/after table: every row's Old %/New % equals Math.round((21 - need) / 20 * 100)` —
  `test/unit/flee-ledger.test.js`
- `SHELL-01/02: thief.hero — the Hero tab DOM for a fresh Thief` — `test/unit/shell-tab-snapshots.test.js`
- `SHELL-01: thief.gear — the Gear tab DOM for a fresh Thief with a full bag` — `test/unit/shell-tab-snapshots.test.js`
- `SHELL-01: thief.gear-confirms — the Drop confirm and the jewelry swap confirm, both armed` — `test/unit/shell-tab-snapshots.test.js`
- `SHELL-01: thief-store.store — a full-bag Thief's store screen` — `test/unit/shell-tab-snapshots.test.js`
- `SHELL-02: mu.hero — the Hero tab DOM for a Magic User with a joined party member` — `test/unit/shell-tab-snapshots.test.js`
- `SHELL-01: mu.gear — the Gear tab DOM for a Magic User with every worn slot empty` — `test/unit/shell-tab-snapshots.test.js`
- `SHELL-01: mu-store.store — a Magic User's store screen with nothing to sell` — `test/unit/shell-tab-snapshots.test.js`

These were present in the worktree's base state before 58-02 touched any file
and are unrelated to Phase 58's motion/pacing scope. Flagging for the
orchestrator/next phase to triage (likely stale DOM/content snapshot fixtures
needing regeneration from an unrelated prior-phase change).
