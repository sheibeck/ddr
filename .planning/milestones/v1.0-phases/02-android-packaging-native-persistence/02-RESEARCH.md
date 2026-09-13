# Phase 2: Android Packaging & Native Persistence - Research

**Researched:** 2026-09-08
**Domain:** Capacitor 8 Android wrapping of a zero-bundler vanilla-JS/DOM web game; native durable persistence; Windows headless Gradle toolchain
**Confidence:** HIGH (toolchain/JDK compatibility, package versions, plugin APIs — all directly verified against this machine and current official docs) / MEDIUM (no-bundler plugin import resolution pattern — officially documented for imports, but the "global Plugins without import" shortcut could not be confirmed current) / LOW (none of the store-facing content in this doc; that's STR-* phase, not this one)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Capacitor project**
- Capacitor 8.x (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`) — Android platform only; do NOT add `@capacitor/ios`.
- **webDir**: Capacitor needs a `webDir` containing an `index.html` + the game's JS. Decision: assemble the web app into a `www/` directory (or configure webDir) — `mazeworld.html` becomes/loads as `index.html`, alongside `engine/`, `content/`, `src/`. The dev browser loop keeps working from the repo; the build step copies/points webDir. Planner picks the least-duplicative wiring (prefer a build/copy step that keeps a single source of truth for the game files). Keep zero GAME runtime deps; Capacitor is build tooling.
- **Plugins:** `@capacitor/preferences` (durable storage), `@capacitor/app` (back button + lifecycle), `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capacitor/screen-orientation` (portrait lock). **NO** ad/analytics/IAP SDKs (paid-upfront, offline).

**Persistence abstraction**
- Introduce a `Storage` abstraction with two backends: `@capacitor/preferences` (native) and `localStorage` (browser dev/fallback), selected at runtime (Capacitor platform detection). The adapter (`src/browser/engineAdapter.js`) and any prototype save/load route through it. Wrap all reads/writes in try/catch (private-window/quota safe) — pattern already established.
- Preserve the versioned save + integrity validation from Phase 1 `saveState.js` (fail-closed on malformed/tampered/version-mismatch). SAV-04 best-depth and SAV-05 graveyard move behind the same abstraction (they're cross-run accumulation, currently adapter-side localStorage keys).
- **Preferences is async**; localStorage is sync. The abstraction is async (Promise-based) with the sync localStorage wrapped — plan the autosave call sites to await/handle async without dropping saves on rapid actions.

**Native chrome & assets**
- Splash: unzip `assets/mazeworld-splash-android.zip` → copy the five `drawable-*` folders into `android/app/src/main/res/`, reference `@drawable/splash_screen` (per its README). App icon: use `assets/mazeworld-google-play-icon-512.png` to generate the Android launcher-icon mipmaps (or `@capacitor/assets` if it stays dependency-light). Portrait lock via config + `@capacitor/screen-orientation`.

**Build environment (probed 2026-09-08)**
- Node v22.23.2 + npm 10.9.8; npm registry reachable.
- Android SDK at `%LOCALAPPDATA%\Android\Sdk` (build-tools/platforms/platform-tools/emulator, licenses accepted). Executors must export `ANDROID_HOME`/`ANDROID_SDK_ROOT` (not currently set). Optionally write `android/local.properties` with `sdk.dir`.
- JDK for Gradle: both system Java and Android Studio's JBR are JDK 25 — very new for AGP. Research must resolve the Capacitor-8 Gradle/AGP + JDK-25 compatibility and, if needed, install Temurin JDK 21 and set `org.gradle.java.home`. Verify with a real `./gradlew` build; do not assume.

### Claude's Discretion
- Exact webDir layout/build-copy mechanism, the Storage abstraction's file/module location and API shape, and whether app-icon generation uses `@capacitor/assets` (dev dep) or a manual mipmap drop.

### Deferred Ideas (OUT OF SCOPE)
- Emulator/on-device visual + feel test (UAT).
- Release signing, Play App Signing, Data Safety/IARC, store submission — Phase 6.
- Mobile UI/controls/tutorial/accessibility — Phase 4.
- Routing all game domains through the engine in the live page — Phase 4.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLT-01 | Web game packaged as installable native Android app via Capacitor (produces an AAB) | Toolchain/version pinning, webDir strategy, headless build sequence (## Toolchain, ## Windows Headless Setup + Build Sequence, ## webDir Strategy) |
| PLT-02 | Android hardware/gesture back button never silently ends a run | `@capacitor/app` `backButton` API + confirm-before-quit pattern (## Back Button + Lifecycle) |
| PLT-03 | App lifecycle events persist run state and resume cleanly | `@capacitor/app` `pause`/`appStateChange` + Storage abstraction flush-on-background (## Back Button + Lifecycle, ## Persistence Abstraction) |
| PLT-04 | Native chrome configured — splash, status bar, locked portrait | `@capacitor/splash-screen`/`@capacitor/status-bar`/`@capacitor/screen-orientation` config + provided asset wiring (## Native Chrome & Assets) |
| SAV-01 | Autosave after every action/beat AND on background | Async-safe autosave call-site pattern, `pause`/`appStateChange` flush (## Persistence Abstraction) |
| SAV-02 | Resume exactly after interrupt/close/reopen | Storage abstraction read-on-boot + `rehydrate()` reuse (## Persistence Abstraction, ## Validation Architecture) |
| SAV-03 | Durable native storage (Preferences, not localStorage), versioned schema, integrity check | `@capacitor/preferences` API, reuse of `engine/saveState.js` fail-closed validation (## Persistence Abstraction) |
| SAV-04 | Best depth/high score persists across runs and restarts | Same Storage abstraction, `BEST_KEY` migration (## Persistence Abstraction, ## Runtime State Inventory) |
| SAV-05 | Persistent graveyard survives app restarts | Same Storage abstraction, `GRAVE_KEY` migration (## Persistence Abstraction, ## Runtime State Inventory) |
</phase_requirements>

## Summary

The single highest-risk unknown going into this phase was whether the Windows machine's toolchain — Android Studio's bundled JBR and the system `java`, both JDK 25 — can run the Gradle/AGP stack that `npx cap add android` generates for a Capacitor 8 project. It cannot. **Capacitor 8's Android template pins Gradle wrapper 8.14.3 and AGP 8.13.0** [CITED: capawesome.io Capacitor-8-upgrade guide, cross-checked against Gradle's own compatibility matrix]. Gradle 8.14.x can only **run** on JVM 8–24; JVM 25 support for running Gradle itself first arrived in **Gradle 9.1** [CITED: docs.gradle.org/current/userguide/compatibility.html]. AGP 8.13.0 separately documents **JDK 17 as both its minimum and default required JDK** [CITED: developer.android.com/build/releases/agp-8-13-0-release-notes]. So JDK 25 fails on two independent counts, not one. The fix is mechanical and already verified installable on this machine: `winget install --id EclipseAdoptium.Temurin.17.JDK` resolves to version **17.0.20.101**, confirmed present in this machine's winget package index [VERIFIED: winget local query, 2026-09-08]. Point `android/gradle.properties`'s `org.gradle.java.home` at it, and additionally export `JAVA_HOME` to the same path for the shell invoking `gradlew`/`gradlew.bat` — belt-and-suspenders, because the wrapper's own bootstrap JVM is launched via `JAVA_HOME`/`PATH` before `org.gradle.java.home` is ever read.

The second load-bearing finding concerns how the game's zero-bundler, plain-`<script type="module">` architecture consumes Capacitor's npm-distributed plugins. Capacitor removed its old `bundledWebRuntime` no-bundler mode; current guidance is "use a JavaScript module bundler" for bare-specifier `import { X } from '@capacitor/y'` resolution [CITED: capawesome.io / Ionic forum threads on non-bundler Capacitor usage]. Introducing a bundler contradicts this project's explicit zero-build-step ethos. The lower-risk, officially-documented-syntax path that avoids adding a bundler is a browser **import map**: vendor each plugin's `dist/esm/index.js` (verified present via each package's own `module` field) into `www/vendor/@capacitor/<pkg>/`, and declare an `importmap` `<script>` block in the generated `www/index.html` mapping the bare specifiers to those vendored files. Chromium-based Android WebView (which is what Capacitor Android ships) supports import maps natively; this keeps the source code's `import` statements exactly as Capacitor's own docs show, with zero bundler dependency. This import map only needs to exist in the native-wrapped `www/index.html`, never in the plain dev-loop `mazeworld.html` — because the Storage abstraction's native-only imports are reached exclusively behind a `Capacitor.isNativePlatform()` runtime guard, which is always false in a desktop browser dev session.

The third significant finding came from direct inspection of `mazeworld.html`, not from external docs: **the classic (non-module) prototype `<script>` and the ES-module `src/browser/engineAdapter.js` both independently read/write the SAME three `localStorage` keys** (`mazeworld.delve.v1`, `mazeworld.graveyard.v1`, `mazeworld.best.v1`) via separate, hand-duplicated code paths — a documented, intentional temporary coupling from Phase 1 (combat/economy still run on the classic script; movement/new-run route through the engine adapter). Both paths must be migrated to the *same* async Storage abstraction, or the native app will end up with two different backends racing on the same logical save. Because the classic script is not an ES module, the Storage abstraction needs to be exposed on `window` for it to consume (the codebase already uses this `window.*` cross-script bridge pattern for `window.move`/`window.newGame`/`window.__mzState`).

Finally, a genuine offline-compliance risk was found by direct inspection: `mazeworld.html`'s `<head>` loads three Google Fonts families from `fonts.googleapis.com` over HTTPS. A "fully offline" native app that cold-starts in airplane mode (Pitfall 3 in `PITFALLS.md`, and a real App Review-style rejection risk even though this ships to Play, not the App Store) will silently fall back to system fonts with zero visual/functional breakage — but this contradicts the explicit "must run with no network" project constraint and is worth a planner decision (self-host the three font families in `webDir`, or explicitly accept graceful degradation and defer to Phase 4/6). It is flagged as an Open Question below rather than mandated, since CONTEXT.md scopes UI/presentation work to Phase 4.

**Primary recommendation:** Install Temurin 17 and pin it via both `JAVA_HOME` (shell-level, for the wrapper bootstrap) and `org.gradle.java.home` (in `android/gradle.properties`, for the actual build) before ever invoking `gradlew`; use an import-map-based vendoring script (not a bundler) to resolve Capacitor's ESM plugin imports inside a generated `www/index.html`; route BOTH the classic script and `engineAdapter.js` through one shared, `window`-exposed async Storage module backed by `@capacitor/preferences` on native and `localStorage` in the browser.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Save/load persistence (run state, best depth, graveyard) | Browser/Client (WebView JS) | Database/Storage (native `SharedPreferences` via Preferences plugin) | The Storage abstraction lives in the WebView's JS layer; the actual durable bytes are written by the native Android `SharedPreferences` API, which `@capacitor/preferences` bridges to. No backend/API tier exists (fully offline). |
| Back-button / hardware navigation handling | Browser/Client (WebView JS listener) | — | `@capacitor/app`'s `backButton` event is delivered into JS; the decision logic (confirm-before-quit vs in-game nav) is pure client-side game-state logic, no native code to write. |
| App lifecycle (pause/resume/background) | Browser/Client (WebView JS listener) | Database/Storage (flush target) | Lifecycle *events* surface in JS via `@capacitor/app`; the *action taken* (flush current state) writes through to the same Storage tier as normal autosave. |
| Splash screen / status bar / orientation lock | CDN/Static (native Android resources: `drawable-*`, `AndroidManifest.xml`, `styles.xml`) | Browser/Client (JS `SplashScreen.hide()`, `StatusBar.setStyle()`, `ScreenOrientation.lock()` calls) | The visual assets and manifest-level orientation lock are native/static resources; JS only calls control APIs at runtime (e.g., explicitly hiding the splash once the WebView is ready). |
| App packaging / build (AAB) | Native Android build (Gradle/AGP) | — | Entirely a build-time concern; no runtime tier. Node.js/Capacitor CLI orchestrates it but the actual compile/package step is Gradle. |
| webDir asset assembly (single source of truth) | Build tooling (Node script, not a runtime tier) | — | A pre-build step, not a shipped-app tier; produces the static assets the CDN/Static and Browser/Client tiers consume. |

## Toolchain: Pinned Versions + the JDK 25 Problem

### Confirmed current package versions

All verified directly against the npm registry from this machine on 2026-09-08 [VERIFIED: npm registry]:

| Package | Verified version | Published |
|---|---|---|
| `@capacitor/core` | 8.5.1 | 2026-08-31 |
| `@capacitor/cli` | 8.5.1 | 2026-08-31 |
| `@capacitor/android` | 8.5.1 | 2026-08-31 |
| `@capacitor/preferences` | 8.0.1 | 2026-02-12 |
| `@capacitor/app` | 8.1.1 | 2026-07-15 |
| `@capacitor/splash-screen` | 8.0.2 | 2026-07-15 |
| `@capacitor/status-bar` | 8.0.3 | 2026-07-15 |
| `@capacitor/screen-orientation` | 8.0.1 | 2026-02-12 |
| `@capacitor/assets` (optional, dev-only) | 3.0.5 | ~2024 (older, see Package Legitimacy Audit) |

**Correction to `STACK.md`:** `@capacitor/screen-orientation` is listed there as a "community" plugin. It is now a first-party **official** Capacitor plugin (`ionic-team/capacitor-plugins` repo, `@capacitor/` scope) [CITED: capacitorjs.com official plugins listing, cross-checked against npm registry ownership].

### The JDK 25 incompatibility (highest-priority risk)

This machine currently has **only JDK 25** available in both places Gradle could pick it up from: system `java -version` reports `25.0.2`, and Android Studio's bundled JBR reports `25.0.3` [VERIFIED: direct probe on this machine, 2026-09-08]. Capacitor 8's generated `android/` project pins its **own** Gradle wrapper and AGP versions independent of whatever Android Studio's own bundled AGP generation supports:

- **Gradle wrapper: 8.14.3** (`gradle-wrapper.properties` → `gradle-8.14.3-all.zip`)
- **AGP: 8.13.0** (`android/build.gradle` → `classpath 'com.android.tools.build:gradle:8.13.0'`)

[CITED: capawesome.io "How to Upgrade Your Capacitor App to Capacitor 8"]

Two independent compatibility failures with JDK 25:

1. **Gradle 8.14.x cannot even *run* on JDK 25.** Gradle's own compatibility matrix states JVM 8–24 for *executing* Gradle at 8.13–9.0.x; JDK 25 support for running Gradle itself was only added in **Gradle 9.1** [CITED: docs.gradle.org/current/userguide/compatibility.html]. This is not a "compile target" restriction (which toolchains can route around) — it's the JVM Gradle's own daemon process needs to boot at all.
2. **AGP 8.13.0 requires JDK 17** — both the documented minimum *and* default [CITED: developer.android.com/build/releases/agp-8-13-0-release-notes]. AGP has not been validated against JDK 25 even where Gradle itself might technically run on it [CITED: community reports cross-referencing Flutter/Android tooling issue trackers, MEDIUM confidence — this specific claim is corroborating, not the load-bearing one; the Gradle 8.14.x JVM ceiling above is authoritative and sufficient on its own to block JDK 25].

**Remedy — install Temurin 17, verified available on this machine:**

```bash
# Confirmed present in this machine's winget index on 2026-09-08 [VERIFIED: winget search Temurin]:
#   EclipseAdoptium.Temurin.17.JDK   17.0.20.101
winget install --id EclipseAdoptium.Temurin.17.JDK -e --accept-package-agreements --accept-source-agreements
```

After install, confirm the install path (Temurin's Windows MSI installs under `C:\Program Files\Eclipse Adoptium\` by convention — verify the exact folder name after install rather than assuming the patch version):

```bash
ls "/c/Program Files/Eclipse Adoptium/"
```

Then pin it **twice** — once for the Gradle wrapper's own bootstrap JVM (shell-level `JAVA_HOME`, since `gradlew`/`gradlew.bat` use `JAVA_HOME`/`PATH` java to launch the wrapper *before* any Gradle property is ever read), and once for the actual build (`org.gradle.java.home` in `android/gradle.properties`, so Android Studio GUI builds and any future CI agree with the headless CLI build):

```bash
# android/gradle.properties — add/replace this line (use the confirmed folder name from `ls` above):
echo 'org.gradle.java.home=C\:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot' >> android/gradle.properties

# Shell-level, for the wrapper bootstrap AND to sanity-check before building:
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17.0.20.101-hotspot"
cd android && JAVA_HOME="$JAVA_HOME" ./gradlew -version   # confirm JVM 17 reported, BEFORE attempting a real build
```

Do not skip the `-version` sanity check — it is the cheap, fast way to catch a still-wrong JDK before burning a multi-minute `assembleDebug` attempt on the wrong JVM. Do **not** rely on Android Studio's own "automatically install the proper JDK" claim [CITED: capacitorjs.com/docs/getting-started/environment-setup] — that claim is about Android Studio's *own* bundled Gradle-JDK setting for GUI builds, and this machine's Studio JBR is *also* JDK 25, so the claim does not resolve this machine's actual problem; Studio would need its Settings → Build → Gradle JDK explicitly repointed at the same Temurin 17 install too, for consistency with the headless build.

### Android SDK platform gap

Capacitor 8's default `variables.gradle` sets `compileSdkVersion = 36` and `targetSdkVersion = 36` [CITED: Capacitor 8 android template source, cross-checked via search]. This machine's SDK has `build-tools/36.0.0` installed (matches) but **only `platforms/android-37.0`** installed — no `android-36` platform package [VERIFIED: direct probe, `ls $LOCALAPPDATA/Android/Sdk/platforms`]. `npx cap add android` will generate a project that needs `android-36` and will fail to compile until it's installed:

```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager.bat" "platforms;android-36"   # or the sdkmanager path under $ANDROID_HOME/tools if no cmdline-tools/latest
```

(Verify the exact `sdkmanager` binary location on this machine first — `platform-tools`/`build-tools`/`emulator` dirs were confirmed present but `cmdline-tools` was not enumerated in this research pass; locate it with `find "$ANDROID_HOME" -iname "sdkmanager*"` before running the install.)

### Android Studio / Node baseline (already satisfied)

- Node 22.23.2 ≥ Capacitor 8's required Node 22+ [VERIFIED: `node -v` on this machine; CITED requirement: capacitorjs.com/docs/updating/8-0].
- Android Studio build `AI-261.26222.65.2614.16204760` [VERIFIED: `build.txt` on this machine] — comfortably exceeds Capacitor 8's documented minimum of **Android Studio 2025.2.1** [CITED: capacitorjs.com/docs/getting-started/environment-setup].
- SDK licenses already accepted [per 02-CONTEXT.md environment note] — no `sdkmanager --licenses` step needed.

## Windows Headless Setup + Build Sequence

Concrete, ordered, Windows/Git-Bash-specific. Each step's Windows-specific gotcha is called out inline.

```bash
# 1. Install Capacitor core/cli/android as project dependencies (NOT devDependencies —
#    the plugin JS ships inside the shipped WebView bundle; see "Don't Hand-Roll" note
#    on why devDependency-only would be wrong here).
npm install @capacitor/core @capacitor/android
npm install --save-dev @capacitor/cli

# 2. Install the plugins (also runtime deps — their JS runs inside the WebView).
npm install @capacitor/preferences @capacitor/app @capacitor/splash-screen \
            @capacitor/status-bar @capacitor/screen-orientation

# 3. cap init — non-interactive, explicit appId/appName/webDir.
#    appId reverse-DNS should match the studio/publisher identity already used
#    elsewhere in this project's docs (STACK.md's example: com.darktierstudios.mazeworld).
npx cap init "Mazeworld" "com.darktierstudios.mazeworld" --web-dir=www

# 4. Build webDir from the single source of truth BEFORE adding/syncing the
#    Android platform (see "webDir Strategy" below for what this script does).
node tools/build-www.mjs

# 5. Add the Android platform. This generates android/ with the Gradle
#    wrapper/AGP versions discussed above — do this AFTER step 4 so cap add
#    has real webDir content to seed from.
npx cap add android

# 6. Point the generated project at the installed SDK. ANDROID_HOME is not
#    exported on this machine by default — export it for this shell AND
#    write local.properties so Android Studio GUI opens agree with headless
#    CLI builds without relying on shell state.
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
# Git Bash path syntax works directly in local.properties on Windows-hosted
# Gradle IF forward slashes are used; avoid embedding a bare backslash path
# here (Java properties files treat backslash as an escape character):
echo "sdk.dir=$(cygpath -m "$ANDROID_HOME" 2>/dev/null || echo "$ANDROID_HOME")" > android/local.properties

# 7. Pin the JDK (see "The JDK 25 incompatibility" above) BEFORE the first
#    gradlew invocation — a wrong-JDK first run can leave a stale Gradle
#    daemon running under the wrong JVM that silently persists across later,
#    correctly-configured invocations until `gradlew --stop` is run.
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17.0.20.101-hotspot"

# 8. Sync web assets + plugin native code into the Android project. Re-run
#    this (and step 4 first) after ANY change to www/ source files or the
#    plugin list.
npx cap sync android

# 9. Sanity-check the JDK the wrapper will actually use, THEN build headless.
cd android
JAVA_HOME="$JAVA_HOME" ./gradlew -version
JAVA_HOME="$JAVA_HOME" ./gradlew assembleDebug
```

**Windows-specific gotchas:**

- **`./gradlew` vs `gradlew.bat` in Git Bash.** Both exist in a generated Gradle-wrapped project. `./gradlew` (the POSIX shell script) runs correctly under Git Bash's `sh` and is what's shown above — it is *not* necessary to invoke `gradlew.bat` from Git Bash, and doing so tends to have worse path-quoting behavior with spaces (e.g., `C:\Program Files\...`) than the shell-script wrapper. If a plan/execution step instead runs from a plain `cmd.exe`/PowerShell context, use `gradlew.bat` there instead — the two are not interchangeable across shells.
- **Path separators in `local.properties`.** Java `.properties` files treat `\` as an escape character. A raw Windows path (`C:\Users\Dell\...`) written verbatim into `local.properties` risks silently mangled escape sequences. Prefer forward slashes (`C:/Users/Dell/...`) — Gradle/AGP on Windows accepts forward-slash paths in `local.properties` — or double-escape backslashes.
- **Long-path issues.** `C:\projects\mazeworld\android\app\build\...` plus Gradle's own deeply-nested intermediate build output directories can approach Windows' legacy 260-character `MAX_PATH` limit, especially several plugins deep (each Capacitor plugin unpacks its own AAR under a nested path). If `assembleDebug` fails with an obscure "The filename or extension is too long" / "Cannot create directory" error with no other explanation, this is the first thing to check — either enable Windows long-path support (`git config --system core.longpaths true` plus the Windows 10+ registry/group-policy long-paths setting) or move the repo closer to the drive root.
- **A stale Gradle daemon pinned to the wrong JDK.** If step 7 is skipped or done after a first `gradlew` invocation, a background Gradle daemon can start under JDK 25 and then silently keep failing even after `JAVA_HOME`/`org.gradle.java.home` are fixed, because Gradle reuses a compatible-looking existing daemon. Run `JAVA_HOME="$JAVA_HOME" ./gradlew --stop` before the first real build attempt if there is any chance a daemon started earlier under the wrong JVM.

**Where the debug artifact lands:** `android/app/build/outputs/apk/debug/app-debug.apk` for `assembleDebug`. (PLT-01's ultimate target is an AAB via `bundleDebug`/`bundleRelease`, landing at `android/app/build/outputs/bundle/debug/app-debug.aab` — the phase's stated headless-build-succeeds gate can use `assembleDebug`, the faster/simpler check, since `bundleDebug` exercises the same Gradle/AGP/JDK path with additional bundling steps layered on top; the planner should decide whether the phase gate requires just `assembleDebug` or the full `bundleDebug`, given PLT-01 literally asks for "produces an Android App Bundle.")

## webDir Strategy

The game currently has **no bundler and no existing `www/`/`android/` directory** [VERIFIED: `ls` of repo root, 2026-09-08] — `mazeworld.html` at the repo root imports `./src/browser/engineAdapter.js` via a relative path, which in turn imports `../../engine/engine.js` and `../../engine/saveState.js`, all resolved as plain relative ES module specifiers with zero build step. `www/` must contain everything at the same relative layout for those imports to keep resolving once copied.

**Recommended approach — a Node copy/inject script (`tools/build-www.mjs`, alongside the existing `tools/tune-difficulty.mjs`), not a bundler:**

1. Clean `www/` (recreate empty).
2. Copy `engine/`, `content/`, `src/` recursively into `www/engine/`, `www/content/`, `www/src/` — verbatim, no transformation. This preserves the single source of truth: these directories are never hand-edited a second time inside `www/`.
3. Read `mazeworld.html`'s text, and **programmatically inject** (not hand-duplicate) two things before writing it out as `www/index.html`:
   - An `importmap` `<script>` block (see "Capacitor plugin import resolution," below) mapping each `@capacitor/*` bare specifier this project actually imports to a vendored path under `www/vendor/`.
   - A `<script type="module" src="./src/browser/nativeChrome.js"></script>` (or equivalent) that wires splash-screen hide, status bar, orientation lock, and the back-button/lifecycle listeners — kept as a **separate module file**, not inlined into the injected HTML, so it's normal source-controlled code, not string-templated in the build script.
4. Vendor each Capacitor package's ESM build (`node_modules/@capacitor/<pkg>/dist/esm/`) into `www/vendor/@capacitor/<pkg>/` — a recursive directory copy, not cherry-picked files, because a plugin's own ESM entry file may import sibling files within its own `dist/esm/` tree (e.g., a `web.js` implementation file).
5. Never hand-edit anything inside `www/` — it's a build output, gitignored, regenerated every time `tools/build-www.mjs` runs.

Add to `.gitignore`: `www/` and `android/local.properties` (already-generated build outputs; `android/` itself — everything BUT `local.properties` — should stay tracked since Capacitor's native project is source, not a build artifact, per standard Capacitor project conventions).

`package.json` script additions (concrete, matches this project's existing `node --test`-only script style — no new build tooling beyond this one script):

```json
{
  "scripts": {
    "build:www": "node tools/build-www.mjs",
    "cap:sync": "npm run build:www && npx cap sync android",
    "android:debug": "npm run cap:sync && cd android && JAVA_HOME=\"$JAVA_HOME\" ./gradlew assembleDebug"
  }
}
```

### Capacitor plugin import resolution (no bundler)

Capacitor removed its old no-bundler `bundledWebRuntime` config option; current official guidance for consuming `@capacitor/*` packages via `import { X } from '@capacitor/y'` bare specifiers is "use a JavaScript module bundler" [CITED: capawesome.io / Ionic community forum threads, cross-checked; the specific removal was independently confirmed via search of Capacitor migration/community discussion, MEDIUM confidence on the exact wording since this is drawn from community threads rather than a single canonical current doc page]. Introducing a bundler (Vite/esbuild/webpack) purely to resolve these imports would be the "hand-roll a build system" trap this project has deliberately avoided so far.

**Recommended alternative: a browser import map**, injected into `www/index.html` only (never into the repo-root `mazeworld.html` used for the plain browser dev loop):

```html
<script type="importmap">
{
  "imports": {
    "@capacitor/core": "./vendor/@capacitor/core/index.js",
    "@capacitor/preferences": "./vendor/@capacitor/preferences/index.js",
    "@capacitor/app": "./vendor/@capacitor/app/index.js",
    "@capacitor/splash-screen": "./vendor/@capacitor/splash-screen/index.js",
    "@capacitor/status-bar": "./vendor/@capacitor/status-bar/index.js",
    "@capacitor/screen-orientation": "./vendor/@capacitor/screen-orientation/index.js"
  }
}
</script>
```

(Each package's actual ESM entry filename inside its `dist/esm/` folder should be confirmed at implementation time — `@capacitor/core`'s `module` field points at `dist/index.js`, not `dist/esm/index.js`; `@capacitor/preferences`'s `module` field points at `dist/esm/index.js` [VERIFIED: `npm view <pkg> module`, 2026-09-08] — these differ per package and the vendoring script must read each package's own `package.json` `module`/`exports` field rather than assuming a uniform path.)

Chromium-based WebViews (which Capacitor Android uses) have supported import maps since Chrome 89 (2021) — this is a safe assumption for any Android device/emulator this project targets in 2026 and requires no polyfill.

**Why this over the "global `window.Capacitor.Plugins.X`" shortcut:** Older Capacitor guidance describes core plugins as also being reachable via a global `window.Capacitor.Plugins.<PluginName>` object without any import, once `window.Capacitor` itself is injected by the native runtime [CITED: capacitorjs.com/docs/core-apis/web confirms `window.Capacitor` is auto-injected natively and usable without import; community/forum sources describe `window.Capacitor.Plugins.X` for core plugins, MEDIUM confidence — could not confirm this specific registry-population behavior against a current, canonical Capacitor 8 doc page in this research pass]. This is a real, lower-effort fallback worth keeping in mind if the import-map approach hits an unexpected WebView compatibility snag during implementation, but it is not the primary recommendation here because it rests on doc pages this research pass could not pin to a current, authoritative source — the import-map approach uses only officially-documented, currently-supported import syntax.

### Cross-check: does the dev browser loop still work unmodified?

Yes. `mazeworld.html` at the repo root is never touched by `tools/build-www.mjs` (it only *reads* it to produce `www/index.html`); `npx serve` / any static file server pointed at the repo root continues to serve `mazeworld.html` exactly as today, with `localStorage`-only persistence and no Capacitor imports ever reached (guarded by the `Capacitor.isNativePlatform()` check inside the Storage abstraction — see below).

## Persistence Abstraction (SAV-01..05)

### The dual-write hazard (found by direct code inspection — plan around this explicitly)

`mazeworld.html`'s classic (non-module) `<script>` and the ES-module `src/browser/engineAdapter.js` **both currently read and write the same three localStorage keys independently**:

- `mazeworld.delve.v1` (run save) — classic script's `save()`/`load()` at lines ~3182–3197 [VERIFIED: direct read], AND `engineAdapter.js`'s `persist()`/`boot()` [VERIFIED: direct read] — via a **duplicated string literal**, not a shared import (the classic script isn't a module and exports nothing, per `engineAdapter.js`'s own doc comment).
- `mazeworld.graveyard.v1` — classic script's `loadGraves()`/`saveGraves()`/`bury()` at lines ~2945–2960, AND `engineAdapter.js`'s `persistGrave()`.
- `mazeworld.best.v1` — only `engineAdapter.js` currently owns this one (`getBest()`/`recordBest()`); the classic script has no equivalent yet.

Both `<script>` blocks execute on every page load (classic script runs first/synchronously during parsing; the module script runs deferred, after). **Both paths must migrate to the same Storage abstraction**, or the native app ends up with the classic script's combat/economy code still hand-rolling reads/writes on one backend while `engineAdapter.js` uses another — exactly the kind of engine/UI coupling `PITFALLS.md` Pitfall 13 warns against, applied to persistence specifically.

**Recommended resolution:** since the classic script is not an ES module and can't `import` the Storage abstraction directly, expose it on `window` from a module script — this project already has the identical bridge pattern for `window.move`/`window.newGame`/`window.__mzState` (see `mazeworld.html`'s trailing `<script type="module">` block). Concretely: `src/browser/storage.js` (an ES module, imported by the native-bootstrap module script) assigns itself to `window.mzStorage` before the classic script's own boot sequence runs any save/load calls, so both scripts converge on one backend. Because the classic script's own boot sequence (`loadGraves(); renderGraves(); const restored = load(); ...`) currently assumes *synchronous* return values, and the Storage abstraction is async on native, the classic script's boot section needs restructuring to await the abstraction (wrapping the relevant boot lines in an async IIFE, or gating `newGame()`/`reveal()` behind a `.then()`) — this is real, non-trivial work for the planner to scope as its own task, not a drop-in swap.

### API shape recommendation

A thin async wrapper, NOT a hand-rolled two-backend implementation — `@capacitor/preferences` already ships its own web fallback backed by `localStorage` when running in a plain browser [CITED: capacitorjs.com/docs/apis/preferences — "localStorage fallback: Used when running as PWA"]. This means the "two backends selected by platform detection" CONTEXT.md calls for are **largely already provided by the plugin itself** — the abstraction Phase 2 needs to actually write is smaller than "reimplement a dual-backend switch": it's primarily (a) a uniform async `get`/`set`/`remove` surface, (b) JSON stringify/parse at the boundary (Preferences only stores strings), and (c) making sure the plain dev-loop browser path (which has NO Capacitor JS loaded at all, not even the web-fallback shim) still works with plain `localStorage` directly, since `@capacitor/preferences`'s own web fallback only activates if `@capacitor/core`'s web runtime is actually bootstrapped — which the dev loop deliberately never does (see webDir Strategy above: Capacitor imports are guarded behind `isNativePlatform()` and never reached in the browser dev loop by design, so its own web fallback is moot here; the abstraction still needs an explicit `localStorage` branch for the dev loop).

```javascript
// src/browser/storage.js (illustrative shape, not final implementation)
// Exposed as window.mzStorage from the native-bootstrap module script so the
// non-module classic <script> can also reach it.
async function getItem(key) { /* native: dynamic import + Preferences.get({key}); browser: localStorage.getItem(key) wrapped in Promise.resolve */ }
async function setItem(key, value) { /* same split, value already JSON.stringify'd by the caller */ }
async function removeItem(key) { /* same split */ }
```

Platform detection should use the auto-injected `window.Capacitor.isNativePlatform()` global [CITED: capacitorjs.com/docs/core-apis/web confirms `window.Capacitor` is injected natively without requiring an import] rather than a static `import { Capacitor } from '@capacitor/core'` at the top of `storage.js` — this means the module's *native-only* dynamic `import('@capacitor/preferences')` is only ever reached inside the `isNativePlatform()` branch, which is never true in the browser dev loop or in plain-Node unit tests, so neither environment ever attempts to resolve the Capacitor import-map specifiers. This directly avoids a second hazard: `@capacitor/core`/`@capacitor/preferences` assume browser globals (`window`, possibly `document`) at various points in their implementation, and importing them unconditionally at module top-level in a file that's also loaded by `node --test` (which has neither) risks crashing the existing test suite the moment `storage.js` is imported anywhere in the dependency graph a unit test touches.

### Async-safe autosave call sites (don't drop saves on rapid actions)

`engineAdapter.js`'s `dispatch()` currently calls `persist()` synchronously and fire-and-forget after every action [VERIFIED: direct read, line ~196]. Once `persist()` becomes async (Preferences-backed), naive fire-and-forget `persist()` calls risk a later action's write racing ahead of an earlier one's still-in-flight write if the underlying native call reorders (unlikely with a single-key sequential API, but real if two DIFFERENT keys — e.g., a save-key write racing a best-key write during the same `startNewRun()` call — settle out of the intended order). Recommended pattern: an in-memory "last known good state" that renders immediately (so gameplay never blocks on the awaited write), with the actual persistence write queued and awaited sequentially per key (a tiny per-key promise chain / mutex is sufficient — this is exactly the kind of "don't hand-roll" case where a 5-line `let chain = Promise.resolve(); function enqueue(key, fn) { chain = chain.then(fn).catch(()=>{}); return chain; }` per-key queue is enough; a full task-queue library is overkill for 3 keys).

### Migration on first native launch

CONTEXT.md calls for "a one-time localStorage→Preferences migration on first native launch." Important clarification from direct research: **Android WebView storage is sandboxed per-app and per-origin — it does NOT share `localStorage` with the user's Chrome browser or any prior website visit.** A brand-new native install has never had ANY prior localStorage inside its own WebView, so there is no user data to "recover" from an external source on a true first install. The migration's real, concrete value is narrower and still worth implementing exactly as decided: it protects against **this project's own earlier dev/test builds** (e.g., if an emulator/device was used to test an early debug build that still used raw `localStorage` before this phase's Storage abstraction landed) — a one-time "if Preferences has no value for this key but localStorage does, copy it over then leave localStorage alone (don't delete — matches the existing fail-safe, never-throw posture)" check, run once at boot before `boot()`/`load()` return. Document this scope clarification in the plan so nobody spends effort building infrastructure for a "recover a website player's save" scenario that cannot occur.

### Fail-closed integrity — reuse, don't rebuild

`engine/saveState.js`'s `validateSave()` already does exactly what SAV-03 requires: version-checked, shape-checked, fail-closed to a fresh run on anything malformed, tampered, or newer-than-supported [VERIFIED: direct read — rejects malformed JSON, rejects a save whose `version` exceeds `STATE_VERSION`, rejects a save with a malformed `c`/`floor`]. Nothing here needs to change for the Preferences backend — `validateSave(raw, options)` already accepts a plain string (or pre-parsed object), and the Storage abstraction's `getItem()` returning a string (from either backend) feeds it unchanged. The only new integration point: `getItem()` on native should defensively check the Preferences result is actually a string before handing it to `JSON.parse`/`validateSave` (Preferences' own contract already guarantees string-or-`{value: null}`, but this is a one-line defense-in-depth check, not new validation logic).

## Native Chrome & Assets (PLT-04)

### Splash screen

The provided `assets/mazeworld-splash-android.zip` contains exactly what `@capacitor/splash-screen`'s Android integration expects [VERIFIED: unzipped and inspected the archive directly]:

```
mazeworld-splash-android/
  drawable-mdpi/splash_screen.webp     (360×640,  1x)
  drawable-hdpi/splash_screen.webp     (540×960,  1.5x)
  drawable-xhdpi/splash_screen.webp    (720×1280, 2x)
  drawable-xxhdpi/splash_screen.webp   (1080×1920, 3x, upscaled from source — README flags this)
  drawable-xxxhdpi/splash_screen.webp  (1440×2560, 4x, upscaled from source — README flags this)
  README.md
```

Copy the five `drawable-*` folders verbatim into `android/app/src/main/res/` (this is a one-time, post-`cap add android` step — `cap sync` does not touch `android/app/src/main/res/`, so this survives repeated syncs). `@capacitor/splash-screen`'s `androidSplashResourceName` config option defaults to `"splash"` [CITED: capacitorjs.com/docs/apis/splash-screen] but the provided assets are named `splash_screen.webp` — the capacitor.config must explicitly set `androidSplashResourceName: "splash_screen"` to match (or the asset files must be renamed to `splash.webp` — renaming the provided, already-correctly-bucketed assets is the worse option; configure the plugin to match the assets instead).

```typescript
// capacitor.config.ts (illustrative)
const config: CapacitorConfig = {
  // ...
  plugins: {
    SplashScreen: {
      androidSplashResourceName: "splash_screen",
      launchAutoHide: false,   // hide explicitly once the WebView/engine boot completes, not on a fixed timer
      backgroundColor: "#EFE7D6", // matches mazeworld.html's --paper CSS variable, avoids a color-mismatch flash
    },
  },
};
```

Note the zip's own README flags a distinct Android 12+ concern: "For Android 12 and newer, the system-controlled launch splash normally displays an app icon over a solid background. Use these full-screen images for the app's branded splash view immediately after that system splash, or with a compatible splash-screen library" [VERIFIED: read directly from the zip's bundled README]. `@capacitor/splash-screen` is Ionic's own actively-maintained plugin and can reasonably be assumed to already account for the Android 12+ `SplashScreen` API split (system splash → app splash handoff) — but this specific interaction was not independently confirmed against current plugin release notes in this research pass, so it's flagged here as something to visually confirm during the deferred emulator/device UAT, not something to block the headless-build gate on.

### App icon

`assets/mazeworld-google-play-icon-512.png` is confirmed 512×512 PNG [VERIFIED: direct file inspection]. Two viable paths, per CONTEXT.md's discretion:

- **`@capacitor/assets`** (npm, v3.0.5, official `ionic-team` tool) can generate all Android launcher-icon mipmap densities from this single source file via its "Easy Mode." **Caveat found during package-legitimacy verification:** this package's last confirmed publish predates the rest of the Capacitor 8 toolchain by roughly two years relative to a typical "current" check — see Package Legitimacy Audit below. It is not deprecated and its verdict is clean, but confirm it still runs correctly against a Capacitor 8 project structure before relying on it (a quick `npx @capacitor/assets generate --android` dry run is cheap to verify).
- **Manual mipmap drop** — if `@capacitor/assets` proves stale/incompatible, Android Studio's own "Image Asset" wizard (Right-click `res/` → New → Image Asset) can generate the mipmap set from the same 512×512 source with zero added dependency, at the cost of a manual GUI step instead of a scriptable one.

Given this phase's headless-build requirement, prefer whichever path can run non-interactively; if `@capacitor/assets` is confirmed working, it is the more reproducible/scriptable choice.

### Status bar + orientation

- **Status bar:** `@capacitor/status-bar`'s `setStyle`/`setBackgroundColor` calls, matching the parchment theme (`--paper: #EFE7D6`) already used throughout `mazeworld.html`'s CSS.
- **Portrait lock — two layers, both recommended, not either/or:**
  1. **`AndroidManifest.xml`**: `android:screenOrientation="portrait"` on the main activity — a manifest-level, always-enforced lock that works even before any JS runs (covers the cold-start/splash window that a JS-only lock can't reach).
  2. **`@capacitor/screen-orientation`**'s `ScreenOrientation.lock({ orientation: 'portrait' })` — confirmed a first-party official plugin, not community [CITED/VERIFIED: npm registry ownership + capacitorjs.com official plugins listing], useful if any runtime orientation-lock toggling is ever needed later (e.g., a future landscape mode for a specific screen). For a v1 that is portrait-only everywhere, the manifest-level lock alone may be sufficient and the JS plugin call becomes a defensive no-op — the planner should decide whether both are worth the extra plugin/dependency for a portrait-only app, or whether the manifest attribute alone satisfies PLT-04.

## Back Button + Lifecycle (PLT-02, PLT-03)

`@capacitor/app`'s documented event/payload shapes [CITED: capacitorjs.com/docs/apis/app]:

| Event | Payload | Fires |
|---|---|---|
| `backButton` | `{ canGoBack: boolean }` | Android hardware/gesture back press. **Adding any listener disables Capacitor's own default behavior entirely** — the app must handle 100% of back-button semantics itself once a listener is registered, there is no partial-override mode. |
| `pause` | `void` | Activity `onPause()` (backgrounding, not necessarily termination) |
| `resume` | `void` | Activity `onResume()` (returning to foreground) |
| `appStateChange` | `{ isActive: boolean }` | Cross-platform state transition signal |

```javascript
// src/browser/nativeChrome.js (illustrative)
import { App } from "@capacitor/app";

App.addListener("backButton", ({ canGoBack }) => {
  // PLT-02: never silently end a run. Concretely, in this game's shape:
  //   - if a modal/menu/encounter-card is open: close it (one level), consume the event
  //   - if at root gameplay with a live, non-dead/non-won run: show a confirm
  //     ("press back again to exit" or an explicit confirm dialog) — never exitApp() directly
  //   - only exitApp() after the confirm step, or if there's no live run to lose
});

App.addListener("appStateChange", async ({ isActive }) => {
  if (!isActive) {
    // PLT-03/SAV-01: flush current state through the Storage abstraction
    // BEFORE the OS potentially kills the process. Must be awaited, not
    // fire-and-forget, since there is no guarantee JS keeps running after
    // this handler returns once backgrounded.
    await window.mzStorage.flush?.();
  }
});
```

The critical correctness note for PLT-03/SAV-01: because the write is now async, the `appStateChange`/`pause` handler's write **must be awaited inside the handler itself** (or use whatever async-completion signal the native runtime respects for backgrounding) — a fire-and-forget write started in a `pause` handler has no guarantee of completing before the process is suspended/killed by the OS. This is the single most safety-critical async-ordering concern in the whole persistence design, more so than the rapid-action-autosave race discussed above, because losing the LAST write on backgrounding directly violates SAV-01/SAV-02's "resume exactly where they left off" requirement.

## Common Pitfalls

### Pitfall: Google Fonts loaded from a CDN in a "fully offline" app

**What goes wrong:** `mazeworld.html`'s `<head>` contains `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Special+Elite&family=Crimson+Pro...&family=IBM+Plex+Mono...">` [VERIFIED: direct read, line 13]. This is a real network dependency in an app whose PROJECT.md constraint states "v1 must run with no network" and whose Play Store Data Safety declaration (Phase 6, STR-01) claims zero network activity. A cold launch in true airplane mode will not crash — the browser/WebView gracefully falls back to whatever system font is available — but it silently violates the stated offline guarantee, and a font-swap on the very first screen a reviewer or a real user sees is also a visible "this feels like a wrapped website" tell (`PITFALLS.md` Pitfall 3).

**Why it happens:** The Google Fonts `<link>` was fine, even ideal, for the original browser-only prototype; it never surfaced as a problem in any dev-loop or desktop-browser testing because a dev machine has network access.

**How to avoid:** Self-host the three font families (Special Elite, Crimson Pro, IBM Plex Mono) as static files inside the `webDir` bundle (Google Fonts provides direct `.woff2` downloads; total footprint for these three families at the specific weights actually used is small) and swap the CDN `<link>` for local `@font-face` declarations or a local stylesheet `<link>`.

**Recommendation for this phase:** This is flagged as an **Open Question** below, not mandated as in-scope Phase 2 work, because CONTEXT.md explicitly scopes visual/presentation changes to Phase 4 and this phase's stated goal is "prove it compiles + installs headlessly now." However, it directly affects whether the produced app can honestly be called "fully offline," which is a Phase 2-relevant claim (PLT-01 says "installable native Android app"). The planner should make an explicit call: fix now (cheap, ~3 font files + one CSS edit) or explicitly defer with a tracked note so it isn't silently forgotten before Phase 6's Data Safety form.

### Pitfall: dual-write persistence divergence (see "Persistence Abstraction" above for full detail)

Already covered in depth above — restated here for the pitfalls-scan checklist: migrating only `engineAdapter.js` to the Storage abstraction while leaving the classic script's `save()`/`load()`/`saveGraves()`/`loadGraves()` on raw `localStorage` would silently reintroduce exactly the durability risk (`PITFALLS.md` Pitfall 8) this phase exists to close, because the classic script still owns ALL combat/economy state changes (Phase 1 left those un-ported) and therefore still triggers the majority of actual save-worthy events.

### Pitfall: a stale Gradle daemon masking a fixed JDK

Already covered in "Windows Headless Setup + Build Sequence" above — restated for the checklist: `gradlew --stop` before the first real build attempt if there's any chance an earlier invocation ran under the wrong (JDK 25) JVM.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Native-vs-browser storage backend switch | A custom `if (isNative) { ... } else { localStorage }` implementation duplicating Preferences' own logic | `@capacitor/preferences` (already ships its own web/localStorage fallback internally) | The plugin already solves the exact dual-backend problem CONTEXT.md describes; the abstraction Phase 2 writes should be a thin async/JSON wrapper PLUS the dev-loop's own explicit localStorage branch (needed because the dev loop never bootstraps Capacitor's web runtime at all — see webDir Strategy), not a reimplementation of Preferences' own platform-switch logic. |
| Save integrity/version validation | A new validator for the Preferences-backed save | `engine/saveState.js`'s existing `validateSave`/`rehydrate`/`serializeRun` | Already fail-closed, already versioned, already tested (`test/unit/save-validation.test.js`). The Storage abstraction is a transport change, not a schema change — nothing about *what* gets validated differs between a localStorage-sourced string and a Preferences-sourced string. |
| Icon/splash mipmap generation | Hand-cutting each Android density bucket from the 512×512 source PNG | `@capacitor/assets` (verify it still runs against Capacitor 8 first) or Android Studio's built-in Image Asset wizard | Both are standard, already-solve-this tools; manual per-density image editing is exactly the kind of repetitive, error-prone task these exist to remove. |
| A bundler just to resolve `@capacitor/*` imports | Introducing Vite/esbuild/webpack purely for import resolution | A browser import map vendoring each plugin's own pre-built ESM `dist/esm/` output | Adds a whole build-tool dependency and a genuine new maintenance surface for a problem a native browser feature (import maps) already solves, given the plugins already ship pre-built ESM. |

**Key insight:** almost everything CONTEXT.md asks this phase to build already exists as an official, maintained Capacitor plugin or as Phase 1's own `saveState.js` — the actual new code this phase should write is thin glue (a storage wrapper, a `window` bridge, an import map, a copy script), not new subsystems.

## Runtime State Inventory

This phase involves a data-migration concern (SAV-03's localStorage→Preferences migration), so this section is included per the verification protocol even though it's a packaging phase, not a pure rename/refactor.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The three `localStorage` keys (`mazeworld.delve.v1`, `mazeworld.graveyard.v1`, `mazeworld.best.v1`) exist ONLY inside whatever browser/WebView context has run the game so far — this machine's dev-loop testing, if any. Android WebView storage is sandboxed per-app/per-origin; it does **not** share state with any external browser. **No production user data exists yet** (pre-launch, no shipped app). | Code migration logic only (one-time "copy if Preferences empty and localStorage has a value" check on first native boot), NOT a data migration script — there is nothing to migrate FROM in a real first install. This protects only against this project's own earlier local dev/test builds. |
| Live service config | None — no external services of any kind (fully offline app; Data Safety/IARC forms are Phase 6, not stored config touched by this phase). | None. |
| OS-registered state | None — this is a mobile app being packaged for the first time; no prior `android/` directory exists yet [VERIFIED: `ls` of repo root shows no `android/` folder as of this research pass], so there is no existing native project, no prior app ID registered on any device, nothing to re-register. | None. |
| Secrets/env vars | None app-side (fully offline, no API keys, no backend). `ANDROID_HOME`/`JAVA_HOME`/`org.gradle.java.home` are build-machine configuration, not application secrets. | Document the build-machine env requirements in the plan/setup instructions (covered above); no app-level secret handling needed. |
| Build artifacts | None yet — no `android/` or `www/` directory exists in the repo as of this research pass. Once created, `www/` and `android/local.properties` are the only pieces that should be gitignored; `android/` itself (the generated native project) is source, per standard Capacitor convention, and should be committed. | Add `www/` and `android/local.properties` to `.gitignore` as part of this phase's setup work (concrete action, not "none"). |

## Package Legitimacy Audit

Verified via `gsd-tools query package-legitimacy check --ecosystem npm` [VERIFIED: ran directly, 2026-09-08] plus a manual `npm view <pkg> scripts.postinstall` check on the core/android/assets packages (all returned empty — no postinstall scripts found on any of the checked packages).

| Package | Registry | Age (as of 2026-09-08) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@capacitor/core` | npm | 8 days (this specific 8.5.1 release) | 4,027,168 | `github.com/ionic-team/capacitor` | SUS | **Approved, flagged only as "too-new"** — the automated heuristic flags any package version published within the last ~2 weeks; this is Ionic's own mainline package with 4M weekly downloads and a verified official repo, i.e. a routine release-cadence bump, not a legitimacy concern. Planner should still add a `checkpoint:human-verify` before `npm install` per protocol, but no substantive risk was found. |
| `@capacitor/cli` | npm | 8 days | 4,031,622 | `github.com/ionic-team/capacitor` | SUS | Same as above — "too-new" only. |
| `@capacitor/android` | npm | 8 days | 2,566,302 | `github.com/ionic-team/capacitor` | SUS | Same as above — "too-new" only. |
| `@capacitor/preferences` | npm | ~7 months | 926,530 | `github.com/ionic-team/capacitor-plugins` | OK | Approved. |
| `@capacitor/app` | npm | ~2 months | 1,986,864 | `github.com/ionic-team/capacitor-plugins` | OK | Approved. |
| `@capacitor/splash-screen` | npm | ~2 months | 1,409,476 | `github.com/ionic-team/capacitor-plugins` | OK | Approved. |
| `@capacitor/status-bar` | npm | ~2 months | 1,609,694 | `github.com/ionic-team/capacitor-plugins` | OK | Approved. |
| `@capacitor/screen-orientation` | npm | ~7 months | 133,742 | `github.com/ionic-team/capacitor-plugins` | OK | Approved. |
| `@capacitor/assets` (optional) | npm | ~2 years (last publish) | 378,393 | `github.com/ionic-team/capacitor-assets` | OK | Approved by the legitimacy check, but flagged separately above (see "Native Chrome & Assets → App icon") as worth a quick compatibility smoke-test against Capacitor 8 given its comparatively stale last-publish date relative to the rest of this toolchain — 378k weekly downloads and a clean official repo argue it's still fine, just possibly behind on newer Android tooling nuances. |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` — all flagged solely on release recency ("too-new"), not on any structural/identity red flag (all have verified `ionic-team` GitHub repos and multi-million weekly download counts). Per protocol, the planner must still insert a `checkpoint:human-verify` task before the `npm install` step for these three specifically, even though this research found no substantive concern.

*All package names in this document were discovered via official documentation (capacitorjs.com) and cross-verified against the npm registry directly from this machine — they are tagged `[VERIFIED: npm registry]` throughout, not `[ASSUMED]`, because they satisfy both the authoritative-source AND registry-confirmation bar the provenance rule requires.*

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test` (no external test runner — matches existing project convention) |
| Config file | none — plain `node --test` invocation, per existing `package.json` scripts |
| Quick run command | `npm run test:quick` (existing script already includes `test/unit`; extend its glob or add the new persistence test directory to it) |
| Full suite command | `npm test` (already runs `node --test` project-wide) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAV-03 | Storage abstraction get/set/remove round-trips a value through a mocked async backend | unit | `node --test test/persistence/storage.test.js` | ❌ Wave 0 |
| SAV-03 | `getItem()` defends against a non-string Preferences result before `JSON.parse`/`validateSave` | unit | `node --test test/persistence/storage.test.js` | ❌ Wave 0 |
| SAV-01 | `dispatch()`-triggered autosave awaits the Storage write per-key, doesn't drop a rapid second write | unit | `node --test test/persistence/autosave-ordering.test.js` | ❌ Wave 0 |
| SAV-02 | serialize → (mocked) Preferences write → simulated restart → (mocked) Preferences read → `rehydrate` round-trips `deepStrictEqual` | unit | `node --test test/persistence/storage.test.js` (extends the existing `test/roundtrip/serialize-rehydrate.test.js` pattern to the new abstraction) | ❌ Wave 0 |
| SAV-04, SAV-05 | Best-depth and graveyard values persist through the abstraction, same mocked-backend pattern as existing `getBest()`/`persistGrave()` tests | unit | `node --test test/persistence/storage.test.js` | ❌ Wave 0 |
| SAV-03 | Existing save integrity/version validation stays green through the transport change (regression, not new logic) | unit | `node --test test/unit/save-validation.test.js` (already exists, unchanged) | ✅ |
| PLT-02 | Back-button decision logic (confirm-vs-navigate-vs-noop) is a pure function testable without a real hardware event | unit | `node --test test/persistence/back-button-logic.test.js` (extract the decision as a pure function of `{ canGoBack, hasLiveRun, isOnRoot }` → action, test it directly; mock `App.addListener` only to prove it's wired) | ❌ Wave 0 |
| PLT-03 | `appStateChange`(`isActive:false`)/`pause` handler awaits a Storage flush before returning | unit | `node --test test/persistence/lifecycle.test.js` (mock `@capacitor/app`'s `addListener`, assert the registered handler returns a Promise that resolves only after the mocked storage write resolves) | ❌ Wave 0 |
| PLT-01 | The Android project compiles headlessly to a debug artifact | build-succeeds check (not a unit test) | `JAVA_HOME="<temurin17>" ./gradlew assembleDebug` (or `npm run android:debug`) from `android/` | N/A — this is the phase's own build gate, not a node:test file |
| PLT-04 | Native chrome resources (splash drawables, manifest orientation, status-bar config) compile without resource errors | build-succeeds check (subsumed by PLT-01's `assembleDebug`; a broken/missing drawable or malformed manifest attribute fails the Gradle resource-merge step) | same `assembleDebug` command as PLT-01 | N/A |
| PLT-04 | Splash/status-bar/orientation LOOK correct on a real screen | manual-only, justified: visual correctness cannot be asserted by a headless build or a unit test — this is the explicitly deferred emulator/device UAT | — (deferred to UAT, per CONTEXT.md OUT OF SCOPE) | — |

### Sampling Rate

- **Per task commit:** `npm run test:quick` (extend to include `test/persistence/`)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green, PLUS the headless `assembleDebug` build succeeding, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `test/persistence/storage.test.js` — covers SAV-03 (get/set/remove round-trip, non-string defense), SAV-02 (write→simulated-restart→read round-trip), SAV-04/SAV-05 (best/graveyard through the abstraction)
- [ ] `test/persistence/autosave-ordering.test.js` — covers SAV-01 (rapid-action write ordering doesn't drop a save)
- [ ] `test/persistence/lifecycle.test.js` — covers PLT-03 (pause/appStateChange awaits the flush)
- [ ] `test/persistence/back-button-logic.test.js` — covers PLT-02 (pure decision-function coverage; the actual hardware event wiring stays manual/deferred)
- [ ] A reusable fake-async-Preferences mock helper, analogous to the existing `withFakeLocalStorage` pattern already established in `test/unit/engineAdapter.test.js` — needed by all four new test files above; worth extracting into a shared `test/persistence/harness/fakePreferences.js` rather than duplicating it four times.
- [ ] Framework install: none — `node:test` is already the project's framework, no new dependency needed for these tests.

*(No gap for the headless Gradle build check itself — that's a shell command the plan documents and the executor runs, not something `node:test` can meaningfully wrap, since it requires the actual Android SDK/JDK toolchain, not a Node-mockable dependency.)*

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` per `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-player, offline, no accounts of any kind — not applicable to this or any phase of this project's v1. |
| V3 Session Management | No | No sessions — a "run" is game state, not an auth session. |
| V4 Access Control | No | Single-user local device app; no access-control boundary exists. |
| V5 Input Validation | Yes | `engine/saveState.js`'s existing `validateSave()` (fail-closed on malformed JSON, wrong shape, newer-than-supported version) — already implemented in Phase 1, reused unchanged by this phase's Storage abstraction. The abstraction's `getItem()` should additionally validate the raw Preferences result is a string before parsing (new, small, defense-in-depth addition this phase should include). |
| V6 Cryptography | Partial/deferred | No encryption is required or recommended for v1 — `PITFALLS.md` Pitfall 12 explicitly frames a save-file checksum/tamper-resistance layer as "cheap now, expensive later" but **not a launch blocker**, appropriate only once a "share your best run" social feature exists (v2/deferred). This phase's fail-closed shape/version validation already provides the ASVS L1-appropriate baseline (malformed/corrupted data can't crash or silently corrupt the app); a full HMAC/checksum layer is explicitly out of scope for this phase per that pitfall's own guidance. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A rooted device or file-manager tool directly edits the app's `SharedPreferences` XML (or, pre-migration, localStorage) to tamper with best-depth/graveyard/save data | Tampering | Already mitigated by `validateSave()`'s fail-closed shape/version check (rejects structurally invalid data, falls back to a fresh run rather than crashing or accepting garbage) — this is a single-player, no-leaderboard game, so self-tampering a personal save is explicitly accepted as low-severity (per `PITFALLS.md` Pitfall 12 and `engineAdapter.js`'s own doc comment: "single-player with no leaderboard" accepts a self-tampered value). |
| A malformed/corrupted save (torn write from a killed process mid-write) crashes the app on next boot | Denial of Service (self-inflicted) | `boot()`'s existing try/catch-and-fall-back-to-`initRun()` pattern already never throws on a corrupt read [VERIFIED: direct code read]. The async Storage abstraction must preserve this exact fail-open-to-a-fresh-run contract — a rejected `Promise` from a native Preferences read must be caught at the same boundary, not allowed to become an unhandled rejection that could crash the WebView's JS context. |
| Backgrounding mid-write leaves a save write incomplete, corrupting the NEXT read | Tampering (of the app's own data, by its own interrupted process — not an external attacker) | Covered under PLT-03 above: the `pause`/`appStateChange` handler must `await` its flush write rather than fire-and-forget, minimizing (though not perfectly eliminating, since the OS can still hard-kill mid-write in extreme cases) the torn-write window; `validateSave()`'s fail-closed behavior is the backstop if a torn write does occur. |
| A future `@capacitor/*` plugin update silently adds a postinstall script or new native permission | Tampering/Elevation of Privilege (supply chain) | This research pass explicitly checked `scripts.postinstall` on the core/android/assets packages and found none [VERIFIED: `npm view <pkg> scripts.postinstall`]. Re-run this check on any future version bump of these packages, per the general Capacitor/Cordova integration gotcha already documented in `PITFALLS.md`'s Integration Gotchas table. |

## Open Questions

1. **Should the Google Fonts CDN dependency be fixed in this phase, or explicitly deferred?**
   - What we know: `mazeworld.html` loads three font families from `fonts.googleapis.com`; this is a real network call in a "fully offline" app, found by direct code inspection (see Common Pitfalls above).
   - What's unclear: whether this phase's "prove it compiles + installs headlessly" scope should include self-hosting the fonts, or whether it's cleanly deferrable to Phase 4 (presentation) or Phase 6 (store compliance, where the Data Safety form would otherwise need to account for it).
   - Recommendation: the planner should make an explicit, documented choice rather than let this pass silently — the fix itself is cheap (download 3 `.woff2` files into `webDir`, swap one `<link>` for local `@font-face` rules), so there's little cost to just doing it now, but it's also legitimately Phase-4-shaped work per CONTEXT.md's own scoping language ("Mobile UI redesign... Phase 4"). Either choice is defensible; only silence is a problem.

2. **Does `@capacitor/splash-screen` correctly handle the Android 12+ system-splash-to-app-splash handoff out of the box?**
   - What we know: the provided splash asset zip's own README explicitly calls out this Android 12+ behavior split and says these full-screen images are meant to be shown "immediately after that system splash, or with a compatible splash-screen library." `@capacitor/splash-screen` is Ionic's actively-maintained official plugin.
   - What's unclear: this research pass could not independently confirm current release notes stating explicit Android 12+ `SplashScreen` API support for `@capacitor/splash-screen` v8.0.2 specifically.
   - Recommendation: treat as MEDIUM confidence, not a build blocker (a headless `assembleDebug` will succeed regardless of how the splash actually renders) — verify visually during the deferred emulator/device UAT rather than researching further now.

3. **`assembleDebug` vs `bundleDebug` as the phase's headless-build gate?**
   - What we know: PLT-01 literally says "produces an Android App Bundle," which is `bundleDebug`'s output, not `assembleDebug`'s (which produces an `.apk`). Both exercise the identical Gradle/AGP/JDK toolchain path this research de-risks.
   - What's unclear: whether the planner intends the phase-gate check to specifically produce a `.aab` (matching PLT-01's literal wording) or whether an `.apk` via the faster `assembleDebug` satisfies "headless debug build that compiles" for this phase, with the AAB specifically reserved for Phase 6's signed-release path.
   - Recommendation: default to `bundleDebug` if PLT-01's literal wording is meant to be satisfied THIS phase (cheap to also run — same toolchain, one more Gradle task), falling back to `assembleDebug` only if the planner treats "produces an AAB" as describing the eventual release shape (Phase 6) rather than this phase's literal build-gate artifact.

## Sources

### Primary (HIGH confidence)
- `docs.gradle.org/current/userguide/compatibility.html` — Gradle JVM support matrix (8.13–9.0.x: JVM 8-24 only; 9.1+: adds JVM 25) [CITED, directly fetched]
- `developer.android.com/build/releases/agp-8-13-0-release-notes` — AGP 8.13.0's JDK 17 requirement, Gradle 8.13 minimum [CITED, directly fetched]
- `capacitorjs.com/docs/apis/preferences` — Preferences plugin API surface, web/localStorage fallback behavior [CITED, directly fetched]
- `capacitorjs.com/docs/core-apis/web` — `window.Capacitor` auto-injection, `isNativePlatform()`/`getPlatform()` [CITED, directly fetched]
- `capacitorjs.com/docs/apis/app` — backButton/pause/resume/appStateChange event shapes and default-behavior semantics [CITED, directly fetched]
- `capacitorjs.com/docs/apis/splash-screen` — SplashScreen config options, `androidSplashResourceName` wiring [CITED, directly fetched]
- `capacitorjs.com/docs/getting-started/environment-setup` — Android Studio 2025.2.1 minimum, JDK auto-install claim [CITED, directly fetched]
- npm registry, direct `npm view` queries for all `@capacitor/*` package versions, publish dates, and `module`/`main`/`exports` fields — 2026-09-08 [VERIFIED]
- `gsd-tools query package-legitimacy check` — direct tool run against all 9 candidate packages, 2026-09-08 [VERIFIED]
- `winget search Temurin` — direct tool run on this machine confirming `EclipseAdoptium.Temurin.17.JDK 17.0.20.101` availability, 2026-09-08 [VERIFIED]
- Direct inspection of `mazeworld.html`, `src/browser/engineAdapter.js`, `engine/saveState.js`, `assets/mazeworld-splash-android.zip` (unzipped and read), `assets/mazeworld-google-play-icon-512.png` (dimensions), `test/unit/engineAdapter.test.js`, `test/unit/save-validation.test.js`, `.planning/config.json`, `.planning/REQUIREMENTS.md` — all read directly from this repo, 2026-09-08 [VERIFIED]
- Direct probe of this machine: `node -v`, `npm -v`, `java -version`, `ls $LOCALAPPDATA/Android/Sdk/{build-tools,platforms}`, Android Studio `build.txt`/JBR `release` file, `ls` of repo root confirming no existing `android/`/`www/` directories — 2026-09-08 [VERIFIED]

### Secondary (MEDIUM confidence)
- capawesome.io "How to Upgrade Your Capacitor App to Capacitor 8" — Gradle wrapper 8.14.3 / AGP 8.13.0 pinning claim for Capacitor 8's Android template [CITED, via search synthesis, not a single directly-fetched page — recommend re-confirming the exact pinned versions against the actual generated `android/build.gradle`/`gradle-wrapper.properties` at implementation time, since this is the single most load-bearing version claim in this document]
- Community/forum threads (Ionic forum, GitHub discussions) on Capacitor's removed `bundledWebRuntime` no-bundler mode and the `window.Capacitor.Plugins.X` global-access pattern [CITED, MEDIUM — could not pin to one current canonical doc page; the import-map recommendation was chosen specifically because it doesn't depend on this uncertain claim]
- Search-synthesized claim that AGP has not been validated against JDK 25 (secondary corroboration only; the Gradle 8.14.x JVM-execution ceiling from the Primary sources above is independently sufficient to establish the JDK 25 blocker)

### Tertiary (LOW confidence)
- None used for load-bearing claims in this document; all uncertain claims above are explicitly flagged inline as MEDIUM rather than presented as fact.

## Metadata

**Confidence breakdown:**
- Toolchain/JDK compatibility: HIGH — cross-checked against Gradle's own official compatibility matrix, AGP's own official release notes, and directly verified on this exact machine (winget availability, current JDK versions).
- Package versions: HIGH — every version number in this document came from a direct `npm view` on this machine, not training data.
- webDir/no-bundler import strategy: MEDIUM — the import-map recommendation itself uses a well-established, stable web platform feature and officially-documented Capacitor import syntax, but the specific "why not the `window.Capacitor.Plugins.X` shortcut" comparison rests on community sources that couldn't be pinned to one current canonical doc page.
- Persistence/dual-write hazard: HIGH — found by direct code inspection of this exact repo, not external research.
- Native chrome asset wiring: HIGH for splash (directly matched the provided zip's actual contents against plugin config docs); MEDIUM for the Android 12+ splash-handoff nuance (flagged as an Open Question, deferred to UAT).
- Security domain: HIGH — ASVS applicability reasoning is straightforward for a single-player offline app with no auth/session/access-control surface; reuses Phase 1's already-implemented, already-tested validation.

**Research date:** 2026-09-08
**Valid until:** ~14 days for the Capacitor/AGP/Gradle version pins specifically (this is an unusually fast-moving toolchain corner — re-verify `npm view @capacitor/core version` and the actual generated `android/build.gradle`/`gradle-wrapper.properties` contents at implementation time rather than trusting this document's specific version numbers if more than ~2 weeks have passed); ~30 days for the architectural/design guidance (Storage abstraction shape, dual-write hazard, back-button/lifecycle patterns) which is much more stable.
