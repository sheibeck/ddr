# Phase 2: Android Packaging & Native Persistence - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning
**Mode:** mvp — user installed Android Studio; toolchain probed and ready. Decisions below come from `.planning/research/STACK.md` + the 2026-09-08 environment probe. The emulator/device VISUAL test and release signing are deferred (UAT / Phase 6); the CODE + a headless DEBUG build are in scope.

<domain>
## Phase Boundary

Wrap the existing web game (`mazeworld.html` + `engine/` + `content/` + `src/browser/`) as an installable native **Android** app via **Capacitor**, with durable **native persistence** replacing browser `localStorage`, back-button/lifecycle handling, and native chrome (splash/status-bar/portrait). Produce a **headless debug build** proving it compiles and installs. Requirements PLT-01..04, SAV-01..05.

IN SCOPE:
- Capacitor 8.x Android project wrapping the web assets; `npx cap sync`; a working `webDir`.
- Durable persistence: a storage abstraction backed by `@capacitor/preferences` on native (localStorage fallback in the browser dev loop), migrating the three existing keys: `mazeworld.delve.v1` (run save), `mazeworld.graveyard.v1`, `mazeworld.best.v1`. Versioned schema + integrity check (Phase 1 `saveState.js` already versions/validates).
- Autosave after every action/beat AND on app background/pause; exact resume on relaunch.
- Android hardware/gesture back button → never silently ends a run (confirm-before-quit / in-game nav) via `@capacitor/app`.
- App lifecycle (pause/resume/background) persists run state.
- Native chrome: splash screen (the provided `assets/mazeworld-splash-android.zip` density buckets), status bar, orientation locked to portrait.
- A headless Gradle **debug** build (`./gradlew assembleDebug` or `bundleDebug`) that succeeds, proving the wrap compiles.

OUT OF SCOPE:
- Mobile UI redesign / touch controls / tutorial / accessibility — Phase 4.
- Release signing (upload keystore, Play App Signing), the Data Safety/IARC forms, and store submission — Phase 6.
- Emulator/on-device VISUAL & feel testing — deferred UAT (the user runs the emulator).
- Routing ALL game domains through the engine in the live page — Phase 1 left combat/economy on prototype code in the browser; completing that is Phase 4. Phase 2 persists whatever the current app state is via the abstraction; it does not rewire gameplay.
</domain>

<decisions>
## Implementation Decisions

### Capacitor project
- **Capacitor 8.x** (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`) — Android platform only; do NOT add `@capacitor/ios`.
- **webDir**: Capacitor needs a `webDir` containing an `index.html` + the game's JS. Decision: assemble the web app into a `www/` directory (or configure webDir) — `mazeworld.html` becomes/loads as `index.html`, alongside `engine/`, `content/`, `src/`. The dev browser loop keeps working from the repo; the build step copies/points webDir. Planner picks the least-duplicative wiring (prefer a build/copy step that keeps a single source of truth for the game files). Keep zero GAME runtime deps; Capacitor is build tooling.
- **Plugins:** `@capacitor/preferences` (durable storage), `@capacitor/app` (back button + lifecycle), `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capacitor/screen-orientation` (portrait lock). **NO** ad/analytics/IAP SDKs (paid-upfront, offline).

### Persistence abstraction
- Introduce a `Storage` abstraction with two backends: `@capacitor/preferences` (native) and `localStorage` (browser dev/fallback), selected at runtime (Capacitor platform detection). The adapter (`src/browser/engineAdapter.js`) and any prototype save/load route through it. Wrap all reads/writes in try/catch (private-window/quota safe) — pattern already established.
- Preserve the versioned save + integrity validation from Phase 1 `saveState.js` (fail-closed on malformed/tampered/version-mismatch). SAV-04 best-depth and SAV-05 graveyard move behind the same abstraction (they're cross-run accumulation, currently adapter-side localStorage keys).
- **Preferences is async**; localStorage is sync. The abstraction is async (Promise-based) with the sync localStorage wrapped — plan the autosave call sites to await/handle async without dropping saves on rapid actions.

### Native chrome & assets
- Splash: unzip `assets/mazeworld-splash-android.zip` → copy the five `drawable-*` folders into `android/app/src/main/res/`, reference `@drawable/splash_screen` (per its README). App icon: use `assets/mazeworld-google-play-icon-512.png` to generate the Android launcher-icon mipmaps (or `@capacitor/assets` if it stays dependency-light). Portrait lock via config + `@capacitor/screen-orientation`.

### Build environment (probed 2026-09-08 — see ROADMAP env note)
- Node v22.23.2 + npm 10.9.8; npm registry reachable.
- **Android SDK** at `%LOCALAPPDATA%\Android\Sdk` (build-tools/platforms/platform-tools/emulator, **licenses accepted**). Executors must export `ANDROID_HOME`/`ANDROID_SDK_ROOT` to it (not currently set). Optionally write `android/local.properties` with `sdk.dir`.
- **JDK for Gradle:** both system Java and Android Studio's JBR are **JDK 25** — very new for AGP. RESEARCH MUST resolve the Capacitor-8 Gradle/AGP + JDK-25 compatibility and, if needed, install Temurin JDK 21 and set `org.gradle.java.home`. Verify with a real `./gradlew` build; do not assume.

### Claude's Discretion
- Exact webDir layout/build-copy mechanism, the Storage abstraction's file/module location and API shape, and whether app-icon generation uses `@capacitor/assets` (dev dep) or a manual mipmap drop.
</decisions>

<code_context>
## Existing Code Insights
- `src/browser/engineAdapter.js` — owns save/load + best-depth (`mazeworld.best.v1`) + graveyard (`mazeworld.graveyard.v1`) via `localStorage` and `engine/saveState.js`. This is the primary integration point for the Storage abstraction.
- `engine/saveState.js` — `serializeRun`/`validateSave`/`rehydrate`, versioned + fail-closed. Reuse; do not weaken.
- `mazeworld.html` — the web entry; a module `<script>` wires movement + new-run through the adapter. Becomes the app's index.
- `engine/`, `content/`, `src/` — the game code to bundle into webDir. Zero runtime deps (keep it so; Capacitor plugins are the only additions and they're platform bridges, not game logic).
- `assets/mazeworld-splash-android.zip`, `assets/mazeworld-google-play-icon-512.png` — ready-to-use native assets.

## Reference
- `.planning/research/STACK.md` (Android-only banner) — Capacitor plugin list, versions, store prerequisites; `.planning/research/PITFALLS.md` — localStorage eviction, back-button, Data-Safety (Phase 6).
- A focused `02-RESEARCH.md` will pin current Capacitor-8 Android setup, the JDK-25/Gradle/AGP resolution, the headless-debug-build command, and the Preferences migration.
</code_context>

<specifics>
## Specific Ideas
- Keep a SINGLE source of truth for the game files (engine/content/src/mazeworld.html); the Capacitor webDir should be assembled from them (copy/build step), not a hand-maintained duplicate.
- The whole point (per PROJECT.md) is de-risking the platform early: prove it compiles + installs headlessly now; the polished feel is Phase 4.
</specifics>

<deferred>
## Deferred Ideas
- Emulator/on-device visual + feel test (UAT).
- Release signing, Play App Signing, Data Safety/IARC, store submission — Phase 6.
- Mobile UI/controls/tutorial/accessibility — Phase 4.
- Routing all game domains through the engine in the live page — Phase 4.
</deferred>
