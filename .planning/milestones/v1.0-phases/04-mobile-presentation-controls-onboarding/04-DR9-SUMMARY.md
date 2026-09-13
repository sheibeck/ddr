---
phase: 04-mobile-presentation-controls-onboarding
plan: DR9 (device-review revision round 9 — HUD reorg + Settings bottom-sheet completing the deferred UX-07 panel, ad hoc — not a numbered PLAN.md)
subsystem: settings-ui
tags: [settings, ux-07, hud, handedness, dice-transparency, confirm-before-quit, haptics, device-review]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-02: settings.js's readSettings/writeSetting/effectiveTextScale/shouldConfirmQuit + the ddr.settings.v1 schema this round extends with a 7th field"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR4: the marks-legend bottom-sheet's scrim/mwrise chrome (.mw-legend-sheet/-scrim/-panel/-head/-close) — reused verbatim for the new Settings sheet"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-06: the top HUD (.mw-hud-row/.mw-hud-item), the bottom control bar (#btn-camp/.dpad in .mazefoot), and window.__mzSettings/window.fit/window.mzCenterMap bridges this round reads/calls"
provides:
  - "The config gear button (top-right HUD) opening a Settings bottom-sheet — completes the deferred UX-07 settings panel (04-CONTEXT.md's 'sound, haptics, text size, control scheme, confirm-before-quit + diceMode' list, now all reachable in-app)"
  - "settings.js's 7th field: handedness ('left'|'right', default 'right') — swaps which side MAKE CAMP vs. the D-pad sit on, live, via #app[data-handedness] CSS"
  - "diceMode now actually gates roll-detail visibility in both the Oracle log and the combat/feature exchange log (previously always visible regardless of the setting) via #app[data-dice-mode] CSS + delegated tap-to-reveal listeners"
  - "confirmBeforeQuit now actually gates the HERO tab's 'Abandon this character' (CUT LOSSES) action via shouldConfirmQuit (previously fired an unconditional window.confirm regardless of the setting)"
  - "src/browser/haptics.js#maybeHaptic — a guarded, fail-open haptics call site (no-op until @capacitor/haptics is installed/vendored), wired at the D-pad's movement tap"
  - "RATIONS moved into the HUD's left cluster with FLOOR/DAY/SQUARES; its depletion progress bar removed (label+number only, red-text warn state preserved)"
affects: [05-graveyard-voice-system]

tech-stack:
  added: []
  patterns:
    - "A brand-new bottom-sheet doesn't need brand-new CSS chrome: the Settings sheet reuses .mw-legend-sheet/-scrim/-panel/-head/-close verbatim (same classes, different id/content) rather than duplicating the scrim/mwrise/dark-panel treatment a second time — any FUTURE bottom-sheet in this app should follow the same reuse, not re-derive the chrome."
    - "A per-app-root data-attribute (#app[data-handedness]/#app[data-dice-mode]) is a cheap 'apply live' mechanism for a CSS-driven layout/visibility toggle: one JS line (setAttribute) flips descendant CSS selectors everywhere at once, with no need to re-render or diff DOM — used here for both the handedness order-swap and the dice-mode roll-visibility gate."
    - "Gating an EXISTING inline `<span class=\"roll\">` (embedded mid-sentence across 260+ narration call sites) is done via delegated click listeners toggling a class on the containing <p>, not by restructuring every call site into the mock's separate-label-below-narration layout — the mock's full dice-transparency redesign (a distinct roll-detail line under each entry) is a larger, separate Oracle-tab visual overhaul out of this round's scope; this delivers the functional diceMode gate (on tap/always/never all now behave differently) without that redesign."
    - "A settings toggle can have a real, wired call site (src/browser/haptics.js#maybeHaptic) before its native dependency is installed — the guarded dynamic import() (mirroring nativeChrome.js's own posture) fails closed to a silent no-op today and becomes live the moment a LATER plan adds @capacitor/haptics + vendors it, with zero call-site changes needed."

key-files:
  created:
    - src/browser/haptics.js
    - test/unit/haptics.test.js
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR9-SUMMARY.md
  modified:
    - mazeworld.html
    - src/browser/settings.js
    - test/unit/settings.test.js

key-decisions:
  - "Scoped the Oracle/combat-log diceMode gating to a CSS-attribute + delegated-click-toggle approach on the EXISTING inline `.roll` spans, rather than implementing the mock's full separate-line dice-reveal design (already scaffolded in src/browser/viewModels.js's oracleLogViewModel/ROLL_SPAN_RE but never wired into mazeworld.html's actual #log/#enc-body rendering) — the full redesign would touch the narration format across 30+ say()/evt() call sites and is a materially larger, separate Oracle-tab visual overhaul; this delivers the functionally-required behavior (diceMode actually changes what's visible, live) without that risk. Documented as a scope decision, not a deviation, since the plan's own wording ('gate the dice-reveal... accordingly') is satisfied by the gate existing and working, not by a specific implementation shape."
  - "Only gated window.mzAbandonCharacter ('Abandon this character' / the mock's CUT LOSSES · ROLL ANOTHER) with shouldConfirmQuit, NOT window.mzAbandonRun ('Save & quit') — 04-UI-SPEC.md's Confirm-before-quit contract explicitly scopes the setting to (a) the back button (already handled, untouched) and (b) the CUT LOSSES action specifically; Save & quit is non-destructive (resumable) and was never in scope for this setting."
  - "Wired maybeHaptic() at exactly one call site (the D-pad's movement tap) rather than spreading illustrative calls across every action button — a single, clearly-documented touch-feedback point is enough to prove the toggle has a real (if currently no-op) effect without inventing a broader per-event haptics design the plan explicitly deferred ('Haptics polish beyond the settings toggle... optional, not required for MVP')."
  - "Did not add @capacitor/haptics to package.json, tools/build-www.mjs's CAPACITOR_PACKAGES vendor list, or run npx cap sync — per the plan's explicit instruction; src/browser/haptics.js's guarded dynamic import() fails closed to a no-op in every environment (dev loop, node --test, and a native build that hasn't vendored the plugin) until a future plan adds the real dependency."
  - "Sound has no wiring beyond persistence — unlike haptics, there is no existing audio system/Audio element anywhere in the codebase to gate, so there is no call site to add; the setting round-trips through settings.js and is available for a future sound system to read."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1 through 04-DR8-SUMMARY.md's own precedent.

duration: ~90min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR9: HUD reorg + Settings bottom-sheet (completes UX-07) Summary

Completed the deferred UX-07 settings panel: a new config gear button in the top-right of the HUD opens a dark, torch-lit Settings bottom-sheet (reusing the marks-legend sheet's exact scrim/mwrise chrome) exposing all six previously-inert-or-missing settings — handedness (new 7th settings.js field), text size, dice detail, confirm-before-quit, sound, and haptics — every one read from and written back through settings.js/`window.mzStorage`, applied live where the setting has a visible/behavioral effect. Also reorganized the top HUD per direct user direction: RATIONS moved into the left FLOOR/DAY/SQUARES cluster and its depletion progress bar was removed outright (label+number only), freeing the top-right for the gear button. Along the way, closed two settings that had been declared in settings.js but never actually wired to anything: `diceMode` now genuinely gates roll-detail visibility in the Oracle and combat logs (previously always visible regardless of the setting), and `confirmBeforeQuit` now genuinely gates the HERO tab's destructive "Abandon this character" action (previously confirmed unconditionally). Two atomic commits, each rebuilt (`npm run build:www`) and fully tested (`npm test` + `npm run test:quick`) before the next group's edits began.

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-09-08
- **Groups:** 2 (HUD reorg; Settings bottom-sheet + handedness/diceMode/confirmBeforeQuit/haptics wiring) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** 4 (`mazeworld.html`, `src/browser/settings.js`, `test/unit/settings.test.js`) + 2 created (`src/browser/haptics.js`, `test/unit/haptics.test.js`)

## Accomplishments

### Group 1 — HUD reorg (`e69dfd7`)

1. **Moved RATIONS into the HUD's left cluster.** `#m-rat-wrap` (label "Rations" + `<b id="m-rations">`) now sits inside `.mw-hud-row` alongside FLOOR/DAY/SQUARES, reusing `.mw-hud-item`'s own row layout directly — no separate flex-column wrapper needed.
2. **Removed the depletion progress bar entirely.** Deleted `.mw-bar`/`.mw-bar i` CSS and the `#m-rations-fill` element/width-update code from `paint()` — the mock-fonts label+number is now the sole rations display, still colorblind-safe via the co-rendered numeric label plus the existing red-text `.warn` state at <=2 rations remaining (never color-only).
3. **Added the config gear button** (`#mw-gear-btn`, top-right of `.mw-hud`, `&#9881;` glyph) — same dark chip treatment as the MARKS/CENTRE chips (`.mw-gear-btn`, >=48dp), `aria-label="Settings"`.

### Group 2 — Settings bottom-sheet + live wiring (`86f3025`)

1. **Added `handedness` to settings.js's schema** (7th field, default `"right"`, allowed values `["left","right"]`), updated `test/unit/settings.test.js` (default assertion, round-trip test, invalid-value-rejection test) and the module's own header-comment field count.
2. **Built the Settings bottom-sheet** (`#mw-settings-sheet`), reusing `.mw-legend-sheet`/`.mw-legend-scrim`/`.mw-legend-panel`/`.mw-legend-head`/`.mw-legend-close` verbatim from the marks-legend sheet (04-DR4) — same dark scrim + `mwrise` slide-up, opened by the gear button, dismissed by scrim tap or Close. Six rows (Handedness, Text size, Dice detail, Confirm before quit, Sound, Haptics), each a label + a row of segmented `.mw-settings-opt` buttons (>=48dp, gold `.active` state) — value/read-back entirely through `settings.js`.
3. **Handedness swaps the bottom control bar live.** `#app[data-handedness="right"]` (default) sets `.dpad{order:1}` / `#btn-camp{order:2}` — D-pad LEFT, MAKE CAMP RIGHT, reversing the earlier DR4 fixed layout; `data-handedness="left"` restores that original DOM order (D-pad right, MAKE CAMP left). Applied via `applySettings()` at boot and on every settings-sheet write.
4. **Text size drives `--mw-text-scale` AND recomputes the maze cell size live** — the settings-sheet click handler calls `window.fit()` (re-reads `window.__mzSettings.textSize` via `cellSizeForTextScale`) + `window.mzCenterMap()` after a `textSize` write, in addition to the existing boot-time `effectiveTextScale()` application.
5. **Dice detail (`diceMode`) now actually gates roll visibility.** Added `#app[data-dice-mode="never"|"on tap"]` CSS hiding `.roll` spans inside `#log`/`#enc-body` `<p>` lines (both the Oracle log and every combat/feature exchange share the same inline `<span class="roll">` markup from `say()`/`evt()`), with delegated click listeners on `#log` and `#enc-body` toggling a `mw-roll-revealed` class per tapped line for "on tap" mode. Added the mock's "Tap a line to see the dice that did it" hint paragraph to the Oracle tab, shown only in "on tap" mode. **Prior state:** this setting existed in settings.js since 04-02 but had zero effect on the actual log rendering — `.log .roll`/`.evt p .roll` were always visible regardless of `diceMode`.
6. **Confirm-before-quit now actually gates "Abandon this character."** `window.mzAbandonCharacter` (the HERO tab's destructive CUT LOSSES action) now checks `shouldConfirmQuit(currentSettings)` before showing its `window.confirm()` dialog — OFF skips the dialog and abandons immediately. **Prior state:** this action always confirmed unconditionally, ignoring the setting entirely. `window.mzAbandonRun` ("Save & quit," non-destructive) and the Android back-button's press-twice safety were both deliberately left untouched, per 04-UI-SPEC.md's exact scoping of this setting.
7. **Sound/Haptics persist as before**, plus a new `src/browser/haptics.js#maybeHaptic(settings, style)` — a guarded, fail-open call site (no-op today since `@capacitor/haptics` is not installed/vendored; dynamic `import()` inside try/catch, mirroring `nativeChrome.js`'s own posture) wired at the D-pad's movement tap via a new `window.__mzHaptics` bridge. 4 new `test/unit/haptics.test.js` tests cover the no-op paths (haptics off, no native platform, missing settings, native-but-plugin-absent).
8. **`currentSettings`** — one in-memory mirror of the persisted settings blob, populated by a new `applySettings(settings)` function (replaces the old one-shot text-scale-only boot block) and read by every live-apply site (`renderSettingsSheet()`'s `.active` highlighting, `shouldConfirmQuit`, `window.__mzSettings`).

## Task Commits

1. **Group 1 — HUD reorg** — `e69dfd7` (feat)
2. **Group 2 — Settings bottom-sheet + handedness/diceMode/confirmBeforeQuit/haptics wiring** — `86f3025` (feat)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test`, `npm run test:quick`) before the next group's edits began.

## Files Created/Modified

- `mazeworld.html` — HUD markup/CSS reorg (RATIONS left cluster, gear button, `.mw-gear-btn`); Settings bottom-sheet markup/CSS (`#mw-settings-sheet`, `.mw-settings-row/-label/-options/-opt`); `#app[data-handedness]`/`#app[data-dice-mode]` CSS rules; Oracle-tab dice-transparency hint; delegated dice-reveal click listeners on `#log`/`#enc-body`; trailing module script's `applySettings()`/`renderSettingsSheet()`/`openSettingsSheet()`/`closeSettingsSheet()` + settings-sheet click handler; `window.__mzHaptics` bridge + D-pad haptic call site; `shouldConfirmQuit` gate on `window.mzAbandonCharacter`.
- `src/browser/settings.js` — added `handedness` field (default `"right"`, allowed `["left","right"]`) to `SETTINGS_DEFAULTS`/`ALLOWED_VALUES`; updated header/doc comments' field count (six → seven).
- `src/browser/haptics.js` (new) — `maybeHaptic(settings, style)`, guarded fail-open haptics stub.
- `test/unit/settings.test.js` — `handedness` default assertion, round-trip coverage, invalid-value-rejection case.
- `test/unit/haptics.test.js` (new) — 4 tests covering `maybeHaptic`'s no-op paths.

## Decisions Made

See `key-decisions` in the frontmatter above (diceMode gating approach vs. the mock's full separate-line redesign, confirmBeforeQuit's exact scope, single haptic call site, no `@capacitor/haptics` install/vendor/sync, sound has no wiring target yet).

## Deviations from Plan

### Auto-fixed issues (Rule 2 — missing critical functionality)

**1. [Rule 2] `diceMode` had zero effect on the actual Oracle/combat log before this round.** The setting existed in `settings.js` since 04-02 (and `src/browser/viewModels.js#oracleLogViewModel` already implemented the pure gating logic), but nothing in `mazeworld.html`'s actual `#log`/`#enc-body` rendering ever consumed it — every `.roll` span was always visible regardless of the setting. This is exactly the behavior the plan's Settings sheet asks the `diceMode` control to change, so a Settings-sheet toggle with no observable effect would be a broken control, not a working one. Fixed via the CSS-attribute + delegated-click-toggle approach described above (see key-decisions for why this shape, not the mock's full separate-line redesign).
- **Found during:** Group 2 investigation of where `diceMode` needed to apply.
- **Files modified:** `mazeworld.html` (CSS rules, hint paragraph, delegated listeners).
- **Commit:** `86f3025`.

**2. [Rule 2] `confirmBeforeQuit` had zero effect on "Abandon this character" before this round.** Same shape of gap: the setting existed and was documented in 04-UI-SPEC.md as gating this exact action, but the action's `window.confirm()` call was unconditional. Fixed by wrapping it in `shouldConfirmQuit(currentSettings)`.
- **Found during:** Group 2 investigation of the confirm-before-quit gate.
- **Files modified:** `mazeworld.html`.
- **Commit:** `86f3025`.

### Notable scope decision requiring no further action

**The mock's full separate-line dice-transparency redesign was not implemented.** `design/Mazeworld Mobile.dc.html`'s Oracle tab shows narration on one line and a conditionally-revealed roll-detail line BELOW it; the live app's `#log`/`#enc-body` instead embed `<span class="roll">` inline, mid-sentence, across 30+ `say()`/`evt()` call sites written before this round. Restructuring every call site into the mock's exact layout is a materially larger, separate Oracle-tab visual overhaul (out of this HUD/Settings-focused round's scope) — this round delivers the functionally-required behavior (the `diceMode` setting genuinely changes what's visible, live, in both logs) via the CSS-gate approach instead. Documented here for a future Oracle-tab visual-fidelity pass to pick up if a literal mock-match is later required.

## Known Stubs / Threat Flags

None. This was settings-schema, HUD-layout, and presentation-glue work (a new bottom-sheet, CSS-attribute-driven live-apply, delegated click listeners, and one new guarded-no-op module) — no new network endpoints, auth paths, or schema changes at a trust boundary. Every settings write goes through `settings.js`'s `writeSetting()` (which itself validates against `ALLOWED_VALUES` before persisting via `window.mzStorage`) — no raw `localStorage`/`window.mzStorage` call was added anywhere in `mazeworld.html`. `src/browser/haptics.js#maybeHaptic` is intentionally inert today (no `@capacitor/haptics` installed/vendored) — not a stub left incomplete by mistake, but a deliberately guarded seam per the plan's explicit "do NOT npm-install or cap-sync here" instruction.

## Verification

- `npm run build:www` — succeeds at both commit checkpoints.
- `npm test` — **467 → 472/472 green** (467 baseline from 04-DR8 + 1 new `SETTINGS_DEFAULTS: handedness` test + 4 new `haptics.test.js` tests), green at every checkpoint.
- `npm run test:quick` — **378 → 383/383 green** at the final checkpoint.
- Both the classic (non-module) `<script>` block and the trailing `<script type="module">` block were extracted and syntax-checked independently via `node --check` after the Group 2 edits (no headless-DOM/visual harness exists in this project, consistent with prior `04-DR*-SUMMARY.md` notes).
- Self-check below confirms every claimed file/commit/test exists.
- App boot path unchanged: `applySettings()` runs before `boot()`/`window.__mzClassicBoot()` (same position the prior one-shot text-scale block occupied), and every new DOM query (`#mw-gear-btn`, `#mw-settings-*`) is optional-chained (`?.`) so a missing element never throws during boot.
- **Not verified here (on-device UAT deferred):** the visual "feel" of the gear button/Settings sheet/handedness swap on the Pixel 7 build, and confirming the dice-reveal tap interaction reads clearly at all three text sizes — per this project's `mvp — autonomous run` mode, on-device visual verification is deferred to the orchestrator's next device build, consistent with every prior `04-DR*` round.

## Self-Check: PASSED

- FOUND: `mazeworld.html` — `#mw-gear-btn`, `#mw-settings-sheet`, `.mw-settings-opt`, `#app[data-handedness="right"]`, `#app[data-dice-mode="never"]`, `function applySettings(settings)`, `function renderSettingsSheet()`, `shouldConfirmQuit(currentSettings)`, `window.__mzHaptics = { maybeHaptic };`.
- FOUND: `src/browser/settings.js` — `handedness: "right"` in `SETTINGS_DEFAULTS`, `handedness: ["left", "right"]` in `ALLOWED_VALUES`.
- FOUND: `src/browser/haptics.js` — `export async function maybeHaptic(settings, style = "Light")`.
- FOUND: `test/unit/settings.test.js` — `SETTINGS_DEFAULTS: handedness defaults to 'right'` test.
- FOUND: `test/unit/haptics.test.js` — 4 tests, all passing.
- FOUND commit `e69dfd7` (feat(04-DR9): HUD reorg — RATIONS moves left, config gear opens Settings).
- FOUND commit `86f3025` (feat(04-DR9): Settings bottom-sheet (completes UX-07) + handedness swap).
- FOUND: `npm test` 472/472 and `npm run test:quick` 383/383 at final state.

## Next Phase Readiness

- All DR9 items are complete and test-green; ready for on-device UAT on the next Pixel 7 build — specifically the gear button/Settings sheet's visual fit against the mock's dark torch-lit style, the handedness layout swap feeling natural for both orientations, and confirming the dice-reveal tap interaction is discoverable/legible.
- No blockers. The mock's full separate-line Oracle dice-transparency redesign remains an open, separately-scoped visual-fidelity item for a future pass (see "Notable scope decision" above) — not a blocker for this round's functional completion of UX-07.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
