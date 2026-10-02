---
status: complete
quick: 260402-dev-row-debug-only
date: 2026-10-02
commits: [567085e3, 6a85b201]
---
# Quick 260402: dev rows on debug builds only

User ruling 2026-10-02: the hidden Settings dev trick never shows on a production build.

- **Native:** `PlayIdentityPlugin.buildInfo()` returns `{ok, debug: BuildConfig.DEBUG}` and does not initialize the Play Games SDK. `buildFeatures.buildConfig=true` was added for AGP 8.
- **JS:** the seam's `buildInfo()` is normalised. `src/browser/devBuild.js` `devToolsAllowed()` fails closed on native: only `{ok:true, debug:true}` opens it.
- **Shell:** `devToolsOn = !devNative`. The long-press listeners live only in `attachDevLongPress()`, which is called after the check resolves true on native, or directly in the browser.
- **Guards:** `mzDevStartAtDepth`, Start, the probe and Fake sign-in all return early when `!devToolsOn`.
- **Browser dev loop:** ungated. There is no web hosting (`firebase.json` has none; `www/` is the Capacitor webDir).
- **Tests:** test/unit/dev-build-gate.test.js plus the android-system-bars method list; 780 targeted tests green.
- **Compile:** debug and release javac BUILD SUCCESSFUL.
- **Docs:** "debug builds only" added.
- **Deviation** [Rule 3]: `buildConfig=true` in app/build.gradle.
