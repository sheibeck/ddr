# Deferred items (Phase 91)

Out-of-scope failures found while running 91-05's targeted tests. Both sit on the base commit 79740d4c (neither file nor the engine file it reads was touched by 91-05), so they were not fixed.

- `test/unit/combat-gear-lock.test.js` "payload table covers exactly ACTION_TYPES (no entry added or missed)": the table lacks the `teleportPick` action added by plan 91-04. Owner: 91-04 or the orchestrator.
- `test/unit/rations-audit.test.js` "draw-count pin: engine/movement.js's rng.-bearing line count is unchanged by rations work (grep -c parity, 18 post-73-09)": the count reads 21, not 18. `engine/movement.js` is unchanged since the base.
