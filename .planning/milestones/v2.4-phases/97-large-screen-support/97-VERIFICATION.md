---
phase: 97-large-screen-support
status: passed
verified: 2026-10-04
verifier: orchestrator (deferred-UAT protocol)
requirements: [SCREEN-01, SCREEN-02, SCREEN-03, SCREEN-04, SCREEN-05, SCREEN-06]
full_suite: "10,634 tests / 10,626 pass / 0 fail / 8 skipped (phase close, one run). PHASE_BASE a5fbd87f."
layout_check: "npm run layout:check: 12/12 profiles, 7/7 boundary probes, 15 scenes each, combat and store rotation round-trips kept"
human_verification:
  - "(97, build gate) Merged manifest of the release build (aapt2 dump xmltree): no screenOrientation on MainActivity, appCategory game kept, configChanges intact (97-01)."
  - "(97, after upload) Play's large-screen 'orientation and resizability restrictions' notice no longer fires on the next upload (97-01)."
  - "(97) Pixel 7: Settings > Screen Portrait keeps the game upright; Rotate lets it turn without a restart; the choice survives a relaunch. Tablet: no Screen row (97-01, 97-03)."
  - "(97) Pixel 7 landscape, both directions, Screen = Rotate: play a full run (roll, arrows and tap-to-move, a find docked beside the map with the pad up, two fight rounds, store, camp, Hero/Gear/Oracle/leaderboards, die and bury); every screen fits (97-04)."
  - "(97) Pixel 7 landscape at text size L: one-row HUD keeps name, HP and the four counters; the ☰ dropdown fits (97-04)."
  - "(97) Real cutout and nav bars: cutout left then right, gesture and 3-button navigation; no HUD text, tab, rail card, side panel or docked camp sheet under an inset (97-03, 97-04)."
  - "(97, feel) Landscape fight: the foe-card strip is about 50 px tall and scrolls at 412 px high; is aiming comfortable? Side panel at 45% of an 800x360 window: right width? (97-04, 97-06)."
  - "(97, build gate AVD pass, absorbs 80-05) pixel_7 gesture + 3-button + cutout, portrait and landscape; pixel_tablet rotated both ways mid-fight; pixel_fold folded/unfolded mid-store (Screen lock re-applies on the cover screen); a desktop-size window dragged across 840 px twice. No restart; run, fight and store kept (97-05, 97-06)."
  - "(97) 10\" tablet / Chromebook: map squares read larger than on the Pixel 7, taps easy, pinch zoom works; portrait tablet panels are a centred column of at most 640 px (97-02, 97-05)."
  - "(97, build gate) Refresh docs/PERF-BASELINE.md on the Pixel 7, portrait and landscape step timings (97-06)."
  - "(97, decision) Two-pane screens: the right pane collapses to zero on MAP when nothing is up (planner's 'only while up' reading). Keep, or make the pane always present (one rule)."
  - "(97, decision) Agree the 2.4.0 'Screens' patch-notes bullet with the rest of the notes before the release build (97-07)."
---
# Phase 97 Verification

Orchestrator-authored on automated evidence (verifier agents are off by user ruling). Hand checks are batched into the v2.4 device checklist at the build gate.

1. **No orientation, resizability or max-aspect restriction in the manifest (SCREEN-01): passed in source.**
   - `android:screenOrientation` is gone from `.MainActivity`. `appCategory="game"`, every `configChanges` entry and `singleTask` are kept, and there is no `resizeableActivity="false"` or `maxAspectRatio`. `android-large-screen.test.js` pins this.
   - The merged-manifest and Play-notice checks need a build and an upload, so they are on the checklist.
2. **Phone rotation as ruled (SCREEN-02): passed.**
   - `decideOrientationLock` / `syncOrientationLock` in `nativeChrome.js` lock only when the smallest width is under 600 and the `screen` setting is `portrait`. The rule is idempotent and runs at boot, on resize and when the setting changes.
   - Settings has a phone-only "Screen: Portrait / Rotate" row; the default is Portrait. Covered by `screen-orientation.test.js` (16) and the settings tests.
3. **A full run in landscape (SCREEN-03): passed on CDP evidence.**
   - In the SHORT layout, the nav rail, one-row HUD, right-hand side panel (fight, store, encounter, docked camp), centred 640 px columns, two-column Hero and Gear, and full-height sheets all render in the phone-landscape profiles (915x412, 800x360) across 15 scenes with no overflow or clipping.
   - Two real defects were found and fixed: the ☰ button sat 3 px above the window, and the Rations counter was clipped at 360 px.
4. **Tablets, foldables and Chromebook windows use the space (SCREEN-04): passed on CDP evidence.**
   - MEDIUM is the stack widened, with panels centred at 640 px.
   - EXPANDED is two panes: the map stays on the left and Hero, Gear, Oracle or Dead open in a 360–560 px pane. A fight that starts takes the pane.
   - Cells scale with the window, capped at 1.5x or 144 px. The 480 px letterbox is gone.
   - Profiles: 7" and 10" tablets both ways, foldable folded, unfolded and upright, and two Chromebook windows.
5. **Rotate, fold and resize keep the run; insets; snapshots and perf (SCREEN-05, SCREEN-06): passed, with the device part deferred.**
   - `configChanges` is kept, so the WebView is never recreated.
   - The layout check's rotation round-trips keep a live fight and an open store.
   - A map-viewport ResizeObserver re-centres the party on every reflow.
   - Left and right safe-area insets now apply to the HUD, rail, panels and sheets. `dvh` is used under `@supports`, with the `vh` fallbacks kept.
   - No shell-snapshot fixture moved, because no plan changed markup under a snapshot root.
   - The perf baseline is refreshed on the Pixel 7 at the build gate (user-accepted, Area 4).
6. **Guards: passed.**
   - `git diff a5fbd87f -- engine test/parity test/determinism` is empty.
   - Re-pins carry declared comments: shell-map-viewport, shell-map-store-polish, settings, shell-gear-toolbar, layout-shell (f), (h) and (r), and the android-large-screen rewrite.
   - The voice corpus marks the new layoutClass exports as non-copy.

**Tooling:** `tools/layout-check.mjs` (`npm run layout:check`) replaces `tools/letterbox-check.mjs`. Screenshots go to the gitignored `tools/layout-check-output/`. The gallery is published for the user at https://claude.ai/artifact/ELyMSDLXdN3PFacmnuWX5P.
