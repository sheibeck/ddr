# Mazeworld Test Suite

Zero-dependency test suite built entirely on Node.js built-ins: `node:test`,
`node:assert/strict`, and `node:vm`. No test framework or dev dependency is
installed — `node --test` ships with Node 22+.

## Run commands

- **Quick** (unit + determinism + roundtrip, skips the heavier parity harness):
  ```bash
  npm run test:quick
  # equivalent to: node --test test/unit test/determinism test/roundtrip
  ```
- **Full suite** (everything, including the prototype-parity harness):
  ```bash
  npm test
  # equivalent to: node --test
  ```

## Test tiers

| Tier | Directory | Purpose |
|------|-----------|---------|
| Unit | `test/unit/` | Per-module tests for extracted engine code (RNG, dice, character, maze, combat, economy, death, ...). |
| Determinism | `test/determinism/` | Static + behavioral guards for ENG-02 (seeded PRNG only, no `Math.random`) and ENG-03 (content is pure data, no function-typed leaves). |
| Round-trip | `test/roundtrip/` | ENG-04: `JSON.stringify` → `JSON.parse` losslessness, checked after every action in a multi-action fixture script — a standing guardrail, not a one-off test. |
| Parity | `test/parity/` | ENG-05: the original `mazeworld.html` prototype (run headless via `node:vm`, zero DOM/browser install) vs. the extracted `engine/` compared action-by-action on identical seeds and action scripts. Heaviest tier — included in the full suite, skipped by the quick run. |

## Notes

- No test file uses `--watch` or any watch API.
- Wall-clock fields (`Date.now()`-derived: `deathAt`, graveyard `when`, the
  `AGAIN_LOCK` cooldown) are excluded from every determinism/round-trip/parity
  equality check — they have no gameplay-outcome effect and would otherwise
  make timing-sensitive tests flaky.
