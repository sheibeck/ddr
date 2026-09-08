---
phase: 4
slug: mobile-presentation-controls-onboarding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-08
---

# Phase 4 — Validation Strategy

> Zero-dependency `node:test`. The high-value logic (tap→cell math, gesture classification, canvas DPR sizing math, character-sheet + oracle-log view-models, `formatEvents` narration-completeness, coach-mark sequencer, settings/text-scale round-trips, confirm-before-quit gating, and the combat/economy/camp/new-run engine-routing completion) is DOM-free and unit-testable now. The genuinely on-device parts (real-finger 48dp tap feel, actual `env()`/System-Bars safe-area insets, DPR crispness, portrait-lock feel, tutorial "does it teach", haptic vibration feel) are deferred device-UAT — consistent with the autonomous-run `--defer-uat` posture. The 372 existing tests MUST stay green; new UI code is presentation-only and must never mutate `GameState.rngState` off-band (parity/determinism/round-trip suites stay green).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node built-ins; established) |
| **Config file** | none — `node --test` over `test/**` (`package.json` `"test": "node --test"`) |
| **Quick run** | `npm run test:quick` (`node --test test/unit test/determinism test/roundtrip`) |
| **Full suite** | `npm test` (372 currently green + new Phase 4 unit tests) |
| **Estimated runtime** | ~7–15s |

---

## Sampling Rate
- After every task commit: `npm run test:quick`
- After every wave: `npm test` (full — parity/determinism/round-trip must stay green)
- Before `/gsd-verify-work`: full suite green
- Max feedback latency: ~15s

---

## Per-Requirement Verification Map

| Requirement | Criterion | Test Type | Automated Command | Wave 0 | Status |
|-------------|-----------|-----------|-------------------|--------|--------|
| UX-01 | `screenToCell`/`resolveTapDirection` resolve a tap to an adjacent-seen-cell one-step move (no-op for non-adjacent/unseen) | unit | `node --test test/unit/controls.test.js` | ❌ W0 | ⬜ |
| UX-01 | `classifyPointerGesture` distinguishes tap vs pan-drag by movement threshold + duration | unit | `node --test test/unit/controls.test.js` | ❌ W0 | ⬜ |
| UX-01 | Control-scheme setting (tap/dpad) persists via `window.mzStorage` and reads back | unit | `node --test test/unit/settings.test.js` | ❌ W0 | ⬜ |
| UX-02 | ≥48dp hit-area corrections applied on every element the UI-SPEC correction table lists | manual/device-UAT (CSS `min-height` assertions are gameable; real confidence needs finger testing) | — | n/a | ⬜ deferred |
| UX-03 | Canvas backing-store size = CSS size × `devicePixelRatio` after fit/resize | unit (pure size-math extracted from `fit()`, DOM-free) | `node --test test/unit/canvasSizing.test.js` | ❌ W0 | ⬜ |
| UX-03 | Safe-area CSS vars resolve non-zero on-device; portrait lock holds; DPR-crisp | manual device-UAT (no headless DOM has real `env()`/System-Bars injection) | — | n/a | ⬜ deferred |
| UX-04 | Character-sheet view-model binds every UI-SPEC row to real `GameState.c` fields (not mockup placeholders) | unit (pure `GameState → sheet view-model`) | `node --test test/unit/characterSheetViewModel.test.js` | ❌ W0 | ⬜ |
| UX-05 | Oracle log renders reverse-chronological; dice-reveal gating matches `diceMode` setting | unit (pure `(logEntries, diceMode) → rows`) | `node --test test/unit/oracleLogViewModel.test.js` | ❌ W0 | ⬜ |
| UX-05 | `formatEvents()` returns a non-null narration line for EVERY event type the engine emits (~140, not the current ~26) — no silent drop | unit — coverage assertion (enumerate every emitted `type:"…"` literal; assert `formatEvent` never returns null) | `node --test test/unit/formatEventsCoverage.test.js` | ❌ W0 | ⬜ |
| UX-06 | Coach-mark sequencer advances/dismisses and persists `tutorialSeen`; step copy stays within the "no wall of text" length cap | unit | `node --test test/unit/tutorial.test.js` | ❌ W0 | ⬜ |
| UX-07 | Settings read/write round-trip for all 6 fields (sound, haptics, textSize, controlScheme, confirmBeforeQuit, diceMode) via `window.mzStorage` | unit | `node --test test/unit/settings.test.js` | ❌ W0 | ⬜ |
| UX-07 | Confirm-before-quit gating for the Sheet's "Cut Losses" honors the setting (pure fn, `decideBackAction` pattern) | unit | `node --test test/unit/confirmQuit.test.js` | ❌ W0 | ⬜ |
| UX-07 | Haptics: `Haptics.impact()` is CALLED on the intended beats when the setting is ON (injectable/mocked plugin, `nativeChrome.js` pattern) — vibration FEEL is device-UAT | unit (call-assertion) + deferred UAT | `node --test test/unit/settings.test.js` | ❌ W0 | ⬜ |
| UX-08 | Text-scale multiplier (S/M/L → e.g. 0.85/1.0/1.25×) clamps OS font-scale input to the same bound | unit | `node --test test/unit/textScale.test.js` | ❌ W0 | ⬜ |
| UX-08 | Colorblind-safe status: rendered status indicators carry icon+shape+label, not color alone | manual/visual device-UAT (semantic/visual judgment) | — | n/a | ⬜ deferred |
| Engine routing (deferred Phase 1/3 item) | `attack`/`flee`/`parley`/`sing`/`castSpell`/`drinkPotion`/`readScroll`/`buyItem`/`leaveStore`/`camp` + new-run all resolve through `dispatch()`/`applyAction` from the live page's new call sites, NOT the classic `S`-state functions | integration (extend `test/unit/engineAdapter.test.js`: dispatch each action type; assert engine state changed) | `node --test test/unit/engineAdapter.test.js` | 🔶 extend | ⬜ |

---

## Wave 0 Requirements
- [ ] `test/unit/controls.test.js` — UX-01 tap→cell / gesture-classification pure functions.
- [ ] `test/unit/canvasSizing.test.js` — UX-03 DPR backing-store math.
- [ ] `test/unit/characterSheetViewModel.test.js` — UX-04 real-field binding.
- [ ] `test/unit/oracleLogViewModel.test.js` — UX-05 dice-reveal gating.
- [ ] `test/unit/formatEventsCoverage.test.js` — UX-05 narration-completeness (**highest-value new test** — guards the ~140-event silent-drop failure mode). Standing guardrail; stays green as events grow.
- [ ] `test/unit/tutorial.test.js` — UX-06 coach-mark sequencer + `tutorialSeen`.
- [ ] `test/unit/settings.test.js` — UX-07 all 6 fields + UX-01 control-scheme persistence + haptics call-assertion.
- [ ] `test/unit/confirmQuit.test.js` — UX-07 confirm-before-quit gating.
- [ ] `test/unit/textScale.test.js` — UX-08 text-scale clamping.
- [ ] Extend `test/unit/engineAdapter.test.js` — engine-routing completion (combat/economy/camp/new-run dispatch coverage).
- [ ] No new framework install — `node:test` already wired.

---

## Manual-Only Verifications (Deferred Device UAT)

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|--------------|
| Real-finger tap accuracy; ≥48dp targets prevent mis-tap deaths | UX-02 | Physical touch feel | Play on the Pixel 7; attempt fast taps near destructive actions |
| Real safe-area insets, on-device DPR crispness, portrait-lock feel | UX-03 | Real `env()`/System-Bars + real DPI | Install debug build; observe notch/gesture-nav padding + crisp maze |
| Tutorial actually teaches move/fight/descend/survive without feeling wordy | UX-06 | Teaching "feel" is subjective | First-run on device; confirm the loop is learnable |
| Haptics vibration feels right on the intended beats | UX-07 | No headless way to confirm a physical vibration | Play with haptics ON; confirm taps/hits/level-ups buzz appropriately |
| Colorblind-safe status reads correctly (icon+shape+label) | UX-08 | Visual/semantic judgment | Review HUD/marks under a colorblind simulation |

*Deferred to milestone-end UAT per the autonomous `--defer-uat` posture. Logic is unit-tested; the physical/visual "feel" is confirmed on-device (user has a Pixel 7).*

---

## Security Domain (ASVS L1 — offline single-player)
- **V5 Input Validation (applies):** new tap/D-pad inputs must resolve through the SAME `validateAction`/`applyAction` chokepoint every other action uses (already fail-safe/no-throw on malformed input). New client code must never construct a raw engine-state mutation bypassing `dispatch()`. `resolveTapDirection` returns a direction ONLY for an orthogonally-adjacent, currently-seen cell; else no-op.
- **Data integrity:** all new settings/tutorial persistence goes through `window.mzStorage` (per-key write-queue), never raw `localStorage`/`Preferences`.
- **Supply chain (build-time):** fonts/icons are committed version-controlled source; no runtime fetch (preserves offline/no-collection posture). `@capacitor/haptics` add vetted (legitimacy OK, same ionic-team publisher as trusted plugins).
- V2/V3/V4/V6: N/A (offline, no accounts/sessions/roles/crypto).

---

## Validation Sign-Off
- [ ] Every UX requirement maps to an automated test or a documented manual/device-UAT item
- [ ] `formatEvents` narration-completeness coverage test green (no silent-drop for any engine event type)
- [ ] Engine-routing completion covered (combat/economy/camp/new-run dispatch through `applyAction`)
- [ ] New presentation code never mutates `GameState.rngState`; parity/determinism/round-trip (372) stay green
- [ ] `nyquist_compliant: true` set

**Approval:** pending
