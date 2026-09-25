# Phase 80: Android Release Build & Tooling - Context

**Gathered:** 2026-09-25 (collected ahead, while Phase 72 wave 5 executed)
**Status:** Ready for research, then planning. This is the ONE v2.1 phase with a gsd-phase-researcher (user policy for this run).

<domain>
## Phase Boundary

- The release build is optimized and store-clean on modern Android and large screens (DROID-01..03).
- The difficulty fit tool's replay-resume is trustworthy (TOOL-01).

This is a native/infra track: the engine, `content/` and parity fixtures are untouched.

**Not in scope:**
- The AGP 9 upgrade (user ruling at scoping: R8 on AGP 8.13 now; AGP 9 is deferred).
- Any gameplay change.
- A Play production launch (v1.0 launch tail).
</domain>

<decisions>
## Implementation Decisions

### Android release — DROID-01..03 (user accepted 2026-09-25)
- **R8 (DROID-01):**
  - Turn on minify, shrink resources and obfuscation for the release build on **AGP 8.13** (`android/app/build.gradle:57` `minifyEnabled false` today; `android/build.gradle:10` AGP 8.13.0).
  - Write keep rules in `android/app/proguard-rules.pro` for Capacitor core, every Capacitor plugin in use (preferences, app, splash-screen, status-bar, screen-orientation, haptics), the Play Games plugin (Phase 67) and the WebView JS bridge. The researcher confirms the exact rule set for Capacitor 8 + AGP 8.13.
  - Every AAB ships its deobfuscation mapping (`mapping.txt`), uploaded with the bundle. Update `docs/RELEASING.md`.
  - **Proof:** a release-signed build on the Pixel 7 boots, saves and resumes, handles back, and plays sound and haptics as before; Play Games sign-in and the global boards work. These device items are batched into the milestone-close checklist per the deferred-UAT protocol.
- **Status bar and edge-to-edge (DROID-02):**
  - DROP the deprecated status-bar colour call (`src/browser/nativeChrome.js:230` `StatusBar.setBackgroundColor`, which maps to the deprecated `Window.setStatusBarColor`).
  - The parchment extends under a TRANSPARENT status bar, and the UI pads itself with the safe-area insets (`var(--safe-area-inset-*, env(safe-area-inset-*))` already on the fixed chrome).
  - Confirm Capacitor 8's `BridgeActivity` enables edge-to-edge (or call `EdgeToEdge.enable(this)`), and that the WebView actually receives the insets.
  - Audit Capacitor core, SplashScreen and the Play Games plugin for other deprecated window APIs Play flags (`setNavigationBarColor`, `setDecorFitsSystemWindows`).
  - Verify in gesture AND 3-button navigation and with a display cutout.
- **Large screens (DROID-03):**
  - A deliberate, documented **letterboxed portrait column**, centred on wide screens with parchment-dark gutters.
  - Declare the app as a game (`android:appCategory="game"`) and let large screens (sw ≥ 600dp) rotate and resize around the column. Android 16 ignores orientation locks there anyway.
  - Revisit the manifest `android:screenOrientation="portrait"` (L18) and the `@capacitor/screen-orientation` lock so phones stay portrait while large screens behave. The researcher confirms the right mechanism and whether Play still flags a game that declares the category.
  - Document the layout decision in `docs/RELEASING.md` (or a device doc).
- **Verification:**
  - Claude runs an emulator tablet/foldable pass (resizable AVD) with screenshots in the phase.
  - The Pixel 7 checks (both nav modes, a cutout if available, and the release-signed smoke) join the milestone-close checklist.
  - After the phase, offer a Play internal-testing push of a versionCode-bumped signed AAB (standing ask-first rule).

### Fit tool — TOOL-01 (user accepted 2026-09-25)
- A fit run resumed from its JSONL log retraces EXACTLY the same walk as the live run, including after an infeasible (`+Infinity`) point.
  - Today the logged row is read back with `score: null` where the live run had `+Infinity`, and the walk diverges. See `tools/fit-difficulty.mjs:340-355` (evaluate/replay), `:188-215` (runSearch), and `tools/lib/fit-score.mjs:268-282` (applyStep).
- Per-block stdout is APPENDED, never truncated.
- A test runs a short fit live and then resumed from its log, and compares the walks.

### Claude's Discretion
- The keep-rule details (per research), the letterbox implementation (CSS max-width column vs native), and the emulator AVD choice.
- Plan split: R8, then edge-to-edge + large screens, then the fit tool (the fit tool is fully independent).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `android/app/build.gradle` (release buildType ~L55-62), `android/app/proguard-rules.pro`, `android/build.gradle:10`, `android/variables.gradle` (`targetSdkVersion = 36`), `android/app/src/main/AndroidManifest.xml:18`.
- `src/browser/nativeChrome.js` (~L219-230 status bar; the orientation lock).
- `mazeworld.html` safe-area padding: the HUD band ~L1026, the dead screen ~L1105, `.mw-bd-dock` ~L1187, title/panels ~L1261/1344/1417/1527.
- `docs/RELEASING.md`.
- `tools/fit-difficulty.mjs`, `tools/lib/fit-score.mjs`.
- The backlog 999.9 planning notes in `.planning/ROADMAP.md` (the three verbatim Play Console warnings and likely sources).
- The todos: `2026-09-23-enable-r8-code-shrinking-obfuscation-and-evaluate-agp-9-upgrade.md`, `2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md`.
- The Phase 67 AGP9 spike: `67-AGP9-SPIKE.md` (context for why AGP 9 is deferred).

### Established Patterns
- Release builds and Play pushes follow `docs/RELEASING.md`. The adb re-pair recipe is in memory. Ask before any Play internal deploy.

### Integration Points
- The milestone-close Pixel 7 checklist and the debug APK built after the last wave.
</code_context>

<specifics>
## Specific Ideas

- The three Play Console warnings on 1.9.0/vc8, quoted verbatim in ROADMAP 999.9: the edge-to-edge default, deprecated window APIs, and display-configuration restrictions.
</specifics>

<deferred>
## Deferred Ideas

- The AGP 9 upgrade: deferred by the user at scoping.
</deferred>
