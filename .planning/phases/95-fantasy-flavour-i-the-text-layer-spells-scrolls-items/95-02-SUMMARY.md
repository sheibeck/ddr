---
phase: 95-fantasy-flavour-i-the-text-layer-spells-scrolls-items
plan: 02
subsystem: shell text layer (RULES reveal component, Always show the rules setting, shell wiring)
tags: [flavour, rules-layer, settings, bridge, voice-ledger]
requires:
  - phase: 95-01
    provides: flavorText.js lookup, RULES_COPY bank pre-registered in the voice corpus
provides:
  - src/browser/rulesLayer.js (RULES_COPY, setAlwaysRules, alwaysRules, rulesOpen, toggleRulesOpen, clearRulesOpen, layerText, mountRules, wrapRow)
  - settings field alwaysRules (13th, default false) and its Settings row
  - window.__mzRules bridge (mount, wrap, layer, always, flavorOf, flavorOfItem, flavorOfSpell, flavorOfScroll)
  - .mw-rules-* CSS and the combat-lock extension
  - docs/narrative-pass/why/y-95-02.json (three RULES_COPY rows)
affects: [95-03, 95-04, 95-05, 95-06, 95-07, 95-08, 96]
tech-stack:
  added: []
  patterns: [module-level open set for reveal state (never on game state), sibling-not-child toggle via wrapRow, classic-script surfaces reach modules through a frozen window bridge]
key-files:
  created:
    - src/browser/rulesLayer.js
    - test/unit/rules-layer.test.js
    - docs/narrative-pass/why/y-95-02.json
  modified:
    - src/browser/settings.js
    - test/unit/settings.test.js
    - test/unit/shell-gear-toolbar.test.js
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "The toggle is a plain onclick that flips the DOM in place (an inspection, the fight-log reveal row's precedent): no guardTap, no render, no dispatch; open ids live in a module-level set."
  - "wrapRow puts the toggle beside the action row's button in a two-column grid, never inside it; the revealed rules span the full width beneath."
  - "A row with no rules text gets no wrapper (wrapRow returns the row itself), so nothing on screen or in any snapshot moves in this plan."
requirements-completed: [FLAVOR-05]
status: complete
duration: ~25 min
completed: 2026-10-03
---

# Phase 95 Plan 02: The RULES reveal component, the Always-show setting and the shell wiring Summary

One shared RULES reveal component (toggle chip, rules body, module-level open set, "Always show the rules" mode), the thirteenth settings field `alwaysRules` with its Settings row, the CSS and the `window.__mzRules` bridge are in place and tested, with no surface calling them yet: no rendered surface and no shell snapshot moved.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1. Shared RULES component, copy and ledger | fd6c1470 | `rulesLayer.js`, `rules-layer.test.js` (15 tests; RED confirmed first with the module moved aside: ERR_MODULE_NOT_FOUND, then GREEN), `y-95-02.json` (3 rows), regenerated `NARRATIVE-PASS.md` and `review.html` |
| 2. The "Always show the rules" setting | bfebb60c | `alwaysRules: false` as the 13th SETTINGS_DEFAULTS key plus `[true, false]` in ALLOWED_VALUES; JSDoc and count words updated; one new settings test |
| 3. Shell wiring | 59ff8146 | Settings row, `.mw-rules-*` CSS, combat-lock extension, module imports, `applySettings` hook, repaint on change, `window.__mzRules`, bridge registry entry, regenerated bridge table, SHELL-MODULES.md section, sandbox wiring |

## Declared re-pins

Two key-list tests were deliberately re-pinned for the new settings field (both declared in the plan):

1. `test/unit/settings.test.js`: the defaults literal gains `alwaysRules: false`, the key-order list appends `"alwaysRules"`, `length` 12 to 13, "twelve" to "thirteen" in titles and comments.
2. `test/unit/shell-gear-toolbar.test.js`: "exposes exactly 12 fields, in order" is now 13 with `alwaysRules` appended.

## RULES_COPY words (ledgered, on the narrative review page)

- `closed`: `RULES ▸`
- `open`: `RULES ▾`
- `label`: `Rules for {name}` (the button's aria-label)

## CSS values chosen for the toggle (for the device check)

- `.mw-rules-btn`: transparent background, `1px solid #4a4032` border, no shadow, ink `#a8955f` (muted gold), mono font, uppercase, `letter-spacing:.06em`, `font-size:calc(0.625rem * var(--mw-text-scale))`, `min-width:48px`, `min-height:48px`, `padding:6px 8px`, `flex:none`; its `:active` has no translate or shadow.
- `.mw-rules-line`: `font-size:calc(0.75rem * var(--mw-text-scale))`, `line-height:1.35`, ink `#a8a08a`, `margin:4px 0 0`, `overflow-wrap:anywhere`.
- `.mw-rules-wrap`: `display:grid; grid-template-columns:minmax(0,1fr) auto; column-gap:6px; align-items:stretch; flex:none`; its body spans `grid-column:1/-1`.
- Combat lock: `#cb-act[data-locked="1"] .mw-rules-btn` joins the locked-row selector list (opacity .45, no pointer events), so a toggle in a locked action area is as inert as its row.

To confirm on a device once a surface adopts it (95-05): the chip is a legible 48 px target beside a combat or drop row, and the muted gold reads against the dark panel.

## Verification results

- Full `npm test`: tests 10355, pass 10315, fail 0, skipped 40 (the same 40 skips as the 95-01 baseline: 32 flavor-layer per-domain tests that skip by name until 95-08, plus 8 older ones). Duration about 227 s. The 95-01 run was 10339 tests / 10299 pass; the +16 tests are the 15 in `rules-layer.test.js` and the one new settings test.
- Task 1 gates: `voice-corpus`, `narrative-review`, `narrative-hygiene`, `safety-scan` and `rules-layer` tests pass; `voice-inventory --check-ledgers --after` reports 59 ledger files, 0 errors; `narrative-review --check` reports pages in sync; `voice-inventory --roll-under --hygiene --safety --count` prints 0; `--key 'bank:RULES_COPY*' --count` prints 3.
- Task 3 acceptance greps: `data-setting="alwaysRules"` 1, `Always show the rules</span>` 1, `window.__mzRules = Object.freeze` 1, `setAlwaysRules(settings.alwaysRules === true)` 1, locked-selector extension 1, `__mzRules` in SHELL-MODULES.md 2, section heading 1.
- `git diff --stat cb5f77ec -- engine content test/unit/fixtures/shell-snapshots` is empty; no shell snapshot moved.
- Line endings: mazeworld.html, settings.js, bridge.js, SHELL-MODULES.md, shellSandbox.js, shell-gear-toolbar.test.js, NARRATIVE-PASS.md and review.html all report `w/crlf`; settings.test.js and the new files report `w/lf`; none `w/mixed`.

## Deviations from Plan

None to behaviour. Adaptations within the plan's intent:

- `node tools/bridge-doc.mjs --write` writes LF newlines into the table region of a CRLF working copy, leaving `docs/SHELL-MODULES.md` `w/mixed`. After adding the new section, the whole file was normalised to CRLF so it again reads `w/crlf`. `test/unit/bridge-registry.test.js` (which compares the doc table with the registry) passes; the standalone `node tools/bridge-doc.mjs --check` exits 1 on a CRLF working copy because it compares the table string byte for byte. That is how the tool already behaves on a CRLF checkout, not something this plan changed, and it is not part of the plan's verify command.
- TDD RED for Task 1 was confirmed after the module draft was written, by moving `rulesLayer.js` aside and running the test (ERR_MODULE_NOT_FOUND), then restoring it for GREEN.

## Known Stubs

None. `window.__mzRules` and the component are intentionally not called by any surface yet; 95-05 adopts them. The flavour lookups still return `""` until the maps land.

## Self-Check: PASSED
