# Deferred items (Phase 91)

Out-of-scope failures found while running 91-05's targeted tests. Both sat on the base commit 79740d4c (neither file nor the engine file it reads was touched by 91-05), so 91-05 did not fix them. **Both fixed at the start of 91-06 (2026-10-01).**

- RESOLVED (91-06): `test/unit/combat-gear-lock.test.js` "payload table covers exactly ACTION_TYPES (no entry added or missed)": the table lacked the `teleportPick` action added by plan 91-03. Added the row `teleportPick: [{ auto: true }, { x: 0, y: 0 }]`.
- RESOLVED (91-06): `test/unit/rations-audit.test.js` "draw-count pin: engine/movement.js's rng.-bearing line count ..." read 21, not 18. Cause: 91-03's three new "Pure; no rng." doc-comment lines, not new draws (the d8, d8, d20 draws are the same three declared draws). Re-pinned to 21 with a dated comment.
