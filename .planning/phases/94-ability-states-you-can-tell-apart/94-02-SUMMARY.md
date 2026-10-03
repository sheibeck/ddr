---
phase: 94-ability-states-you-can-tell-apart
plan: 02
subsystem: ui
tags: [css, accessibility, combat-rows, ASTATE-01, ASTATE-05]
requires: []
provides:
  - "--mw-ast-ready/recharging/unavailable/spent tokens in :root"
  - ".cb-row[data-state] and ul.skills li[data-state] rules"
  - "cbRow sets el.dataset.state for a row that carries state"
  - "test/unit/ability-state-a11y.test.js (contrast, greyscale, colour-blind, edge signature, with teeth)"
affects: [94-03, 94-04, 94-05]
tech-stack:
  added: []
  patterns: ["state look from a data attribute plus :root tokens defined once", "pure-arithmetic a11y test over the shipped CSS with fail-first teeth"]
key-files:
  created: [test/unit/ability-state-a11y.test.js]
  modified: [mazeworld.html, test/unit/shell-combat-actions.test.js]
key-decisions:
  - "Hex values #cbee86 / #eeb433 / #fc7970 / #86898c as planned; the old good/warn/bad/disabled inks fail the greyscale and protanopia checks"
  - "Hatch is a literal rgba(252,121,112,.12) (no color-mix), alpha capped at 0.14 by the test"
  - "A row with a state drops cb-row-off; its look comes from data-state (no new class name)"
requirements-completed: [ASTATE-01, ASTATE-05]
status: complete
duration: ~25 min
completed: 2026-10-03
---

# Phase 94 Plan 02: Ability-state look and a11y guarantee Summary

Four ability-state colour tokens defined once in `:root`, four row edge shapes (solid, dashed, dotted plus a faint hatch, faded with no edge) for the combat rows and the Hero tab rows, and `cbRow` now sets `data-state` and never disables a stated row; contrast, greyscale and colour-blind distinctness are pinned by a pure node test that also fails on the old inks. Nothing reads `state` yet (rows gain it in plan 94-04), so every row renders exactly as before.

BASE (HEAD at plan start): `ef70d4b00baf2edf2a74ff2da4b0a52806a21a25`.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1 | `b1f0ba71` | four `--mw-ast-*` tokens; 9 `.cb-row[data-state]` rules; 9 `ul.skills li[data-state]` rules; `test/unit/ability-state-a11y.test.js` (12 tests) |
| 2 | `296c91c0` | `cbRow` data-state hook, `#s-abilities` markup comment, two pins in `shell-combat-actions.test.js` |

## Measured values (asserted by the a11y test)

- Text contrast: ready 12.79 / recharging 8.90 / unavailable 6.44 on #241d12 (13.70 / 9.53 / 6.89 on the Hero panel #1b170f); spent ink 5.16 on #191510 and 5.08 on #1b170f; spent label #8f856f 4.98 on #191510. Unavailable and description ink on the hatch composite pass at 4.5.
- Edges: every non-spent token at least 3:1 on the page and the row; the spent edge #241f16 is under 1.5 on its background.
- Greyscale pairwise luminance ratio minimum: 1.36 (threshold 1.30).
- CIE76 pairwise minimum: 45.5 normal, 21.0 protanopia, 22.0 deuteranopia (threshold 20).
- Teeth: old inks #a8cc72 / #e8c97a / #e07260 / #8f856f fail greyscale and protanopia; a doctored recharging edge (dashed to solid) fails the signature check; an over-cap hatch alpha is caught.

## Verification

- Targeted run (a11y, shell-combat-actions, combat-lock-shell, shell-tab-snapshots, combat-submenu-fit, text-scale): all green; shell snapshot fixtures untouched (`git status` clean for `test/unit/fixtures/shell-snapshots`).
- `npm run build:www`: exit 0.
- Full `npm test`: 10255 tests, 10247 pass, 0 fail, 8 skipped (baseline 10241 / 10233 / 0 / 8; +14 = 12 a11y tests + 2 shell pins).
- Acceptance greps: each token declared once; `#fc7970` appears once; 9 `cb-row[data-state=` and 9 `ul.skills li[data-state=` rules; `rgba(252,121,112,.12)` once; hook line and className line present once; `guardTap(el, () => pickCombatRow(row))` still once.

## Deviations from Plan

None - plan executed as written. (Test-authoring detail: the behavioural cbRow test uses `loadShellSandbox({ doc })` with the whole `createRecordingDocument()` result, as the other shell tests do.)

## Human verification (end of phase)

Judge the lime ready ink (#cbee86) and the 12% hatch on the Pixel 7. If they need tuning, change only the token values or the hatch alpha (cap 0.14) and keep the a11y test green (muted alternatives from RESEARCH: edges #5e7a3c, #a8761f, #c4483a).

## Known Stubs

None. The `data-state` rules are intentionally unused until plan 94-04 gives rows a `state`.

## Threat Flags

None.

## Self-Check: PASSED

- `test/unit/ability-state-a11y.test.js`, `mazeworld.html` tokens/rules/hook, and the two shell pins exist.
- Commits `b1f0ba71` and `296c91c0` exist and carry both trailers.
