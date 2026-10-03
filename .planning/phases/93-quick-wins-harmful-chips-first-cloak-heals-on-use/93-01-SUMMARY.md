---
phase: 93-quick-wins-harmful-chips-first-cloak-heals-on-use
plan: 01
subsystem: ui
tags: [chips, conditions, view-layer, shell, heroConditions]
requires: []
provides:
  - "harmfulFirst(conds): pure stable bad-first partition on engine polarity"
  - "hero strip (#mm-conditions) and hero YOUR LOT card render harmful chips first"
affects: [93-02]
tech-stack:
  added: []
  patterns: ["one pure view-layer helper bridged on window.__mzHeroChips, applied at the two hero call sites only"]
key-files:
  created: []
  modified:
    - src/browser/heroConditions.js
    - mazeworld.html
    - test/unit/harness/shellSandbox.js
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/hero-conditions.test.js
    - test/unit/your-lot-chips.test.js
key-decisions:
  - "Partition on polarity, never tone: amber Darkness/Afraid/Fear-armed go first, Ether-in-stone (engine-good) stays good"
  - "Applied in paintConditions (before keyList, so the re-arm key follows the displayed order) and the hero branch of yourLotChipsFor only; lotChips, conditionsOf and Joiner rows untouched"
requirements-completed: [CHIP-01]
duration: 40min
completed: 2026-10-03
status: complete
---

# Phase 93 Plan 01: Harmful chips first Summary

**One pure `harmfulFirst` stable partition (engine polarity "bad" first) drives both hero chip rows, the HUD condition strip and the hero's YOUR LOT card, with the engine, `lotChips`, Joiner rows and foe chips untouched.**

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | harmfulFirst with unit pins (TDD) | a40eb913 (RED test), d55750f0 (GREEN feat) |
| 2 | Wire strip + hero card, sandbox bridge, registry, shell pins | 12ac2e20 |

## What was built

- `src/browser/heroConditions.js`: `export function harmfulFirst(conds)`. A non-array gives a frozen empty list; otherwise one pass splits entries whose `safe(() => cn.polarity)` is `"bad"` from the rest and returns `Object.freeze([...bad, ...rest])`. Same descriptor objects, input not mutated; a throwing getter, a null entry or a missing polarity stays in the rest group.
- `mazeworld.html`: `harmfulFirst` added to the module import and to `window.__mzHeroChips`; `paintConditions` reads `rawConds` and sets `conds = harmfulFirst(rawConds)` before the empty check and before `keyList`; `yourLotChipsFor` applies it to the hero branch only.
- `test/unit/harness/shellSandbox.js`: its own `__mzHeroChips` bridge carries `harmfulFirst`.
- `src/browser/bridge.js` registry text and the `docs/SHELL-MODULES.md` row name `harmfulFirst` and `paintConditions` (row hand-edited, CRLF preserved; `bridge-doc.mjs --write` was not run, as the plan directed).
- Tests: 8 `harmfulFirst:` unit pins plus `lotChips: keeps its input order` in `hero-conditions.test.js`; section "(h) harmful chips first (CHIP-01)" in `your-lot-chips.test.js` (card, strip, Poisoned out of a fight, Joiner control).

## Test results

- Full `npm test`: 10,196 tests, 10,188 pass, 0 fail, 8 skipped (baseline 10,183 / 10,175 / 0 / 8; this plan added 13 tests).
- Targeted run (your-lot-chips, hero-conditions, bridge-registry, status-chit-combat, heal-over-time-lines, dark-surfaces, darkness-vignette, size-voice, joiner-item-chips): 158 pass, 0 fail.
- `git log --name-only --format= --grep="(93-01)" -- engine content test/parity` prints nothing: no engine, content or parity file touched.

## Deviations from Plan

**1. [Rule 3 - Blocking, doc-only] Bridge doc consumers join** The plan said consumers are joined by ", "; `tools/bridge-doc.mjs#renderTable` joins with `<br>`. The entry has a single consumer, so the row is identical either way. No code impact.

Otherwise the plan executed as written. TDD gate: RED `test(93-01)` commit precedes the GREEN `feat(93-01)` commit.

## Issues Encountered

A scripted insert briefly rewrote `test/unit/hero-conditions.test.js` with LF endings (a `sed -i` side effect); it was restored to CRLF before the GREEN commit. The RED commit stat is 103 insertions, 1 deletion (index is LF), so no churn.

## Known Stubs

None.

## Threat Flags

None. View-layer reorder only; no new endpoint, auth path or schema.

## Human verification (end of phase, batched)

1. Get poisoned (or diseased) while hasted or carrying other buffs: the Poisoned chip is the first chip on the strip under the HUD.
2. In a fight, get Dazed or Weakened while a buff (Smoke, Shield) is live: on the strip and on your card in YOUR LOT, the harmful chip is first.
3. A Joiner's card keeps its old chip order.

## Self-Check: PASSED

- harmfulFirst export, tests, wiring and bridge entries verified present by grep (heroConditions.js 1, mazeworld.html 4, shellSandbox.js 2, bridge.js 1, SHELL-MODULES.md 1, `(h) ` tests 6 lines).
- Commits a40eb913, d55750f0, 12ac2e20 exist in `git log`.
