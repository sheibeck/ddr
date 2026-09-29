# Releasing to Google Play (internal testing)

The app lives on Play Console as **Delve, Die, Repeat** (`com.darktierstudios.delvedierepeat`), on an
**internal-testing** track with friends as testers (first upload 2026-09-10, versionCode 1).

## One-time setup (this machine)

1. `android/keystore.properties` (git-ignored) — fill in `storePassword`, `keyAlias`
   (and `keyPassword` if it differs). The file already points at the upload keystore
   `C:/Users/Dell/android_store_keys/delvedierepeat.jks`. **Back that .jks up** somewhere
   off this machine; Play App Signing lets you reset a lost upload key, but it's a support ticket.
2. Nothing else — `android/app/build.gradle` picks the file up automatically. When it is
   missing or blank, `bundleRelease` still builds but produces an **unsigned** bundle
   (Play rejects it), and `assembleDebug` is unaffected.

## Every update

```
npm test                 # must be green
npm run play:release     # = bump versionCode → build:www → cap sync → pin-jdk → bundleRelease
```

### Patch notes (NOTES-01, every Play release)

1. Write `docs/patch-notes/<versionName>.md` with the user before the release build (format in
   docs/patch-notes/README.md). Use `node tools/bump-version.mjs --name <versionName>` first
   when the human-readable version changes.
2. `node tools/patch-notes.mjs --write-module`, then `node tools/patch-notes.mjs --check`.
   `npm run build:www`, and therefore `play:release`, fails when the current versionName has no
   notes file.
3. Paste `node tools/patch-notes.mjs --play` (at most 500 characters) into Play Console's
   release notes.
4. After the `v<versionName>` tag is pushed, run
   `node tools/patch-notes.mjs --release-body | gh release create v<versionName> --repo sheibeck/ddr --title "Delve, Die, Repeat <versionName>" --notes-file -`.
5. Run `node tools/patch-notes.mjs --site ../darktier-studio` (the website repo,
   `C:/projects/darktier-studio`, an Astro site on Firebase Hosting, project
   `darktierstudios-b846f`), then commit it there. At release time, `npm run deploy`
   in darktier-studio publishes the notes at
   `https://darktierstudios.com/delve-die-repeat/patch-notes` — the page the in-game
   "Past versions" link opens.

Output: `android/app/build/outputs/bundle/release/app-release.aab`, signed with the upload key.
Then Play Console → Testing → Internal testing → **Create new release** → drop the .aab →
release notes → Save + Start rollout. Testers get it within minutes (no review on internal).

After the build, before the upload:

- Run the scan from "Verifying a release build" below: `node tools/android-api-scan.mjs --fail-on com.capacitorjs.plugins.statusbar,com.darktierstudios.delvedierepeat` must exit 0.
- Archive `android/app/build/outputs/mapping/release/mapping.txt` outside the repo, in a folder named for the versionName and versionCode (see "R8" below).

## Release notes

The notes live in `docs/patch-notes/<versionName>.md` (format in
`docs/patch-notes/README.md`; the pipeline is the "Patch notes" section
above). `docs/patch-notes/2.2.0.md` is a **DRAFT** until the user agrees it
— checklist step 1 below.

## Release 2.2.0: the ordered checklist

A hard-ordered sequence (86-CONTEXT "Release steps"): 2.1.0 keeps filing bug
reports until the rules cutover in step 4, and `play:release` would
double-bump the versionCode `86-01` already set. Do not skip ahead.

1. **Agree the patch notes.** Walk `docs/patch-notes/2.2.0.md` with the
   user, apply their edits, delete the paragraph that starts
   `**DRAFT, not yet agreed.**`, confirm `grep -c DRAFT docs/patch-notes/2.2.0.md`
   prints `0`, run `node tools/patch-notes.mjs --write-module` then
   `node tools/patch-notes.mjs --check`, commit. No release build before
   this (standing rule).
2. **Release build, versionCode 12.** `npm test`, then
   `npm run android:release` — **not `npm run play:release`**:
   `android/version.properties` already reads 2.2.0 / 12 from the debug APK
   build (86-01), and `play:release` would bump it to 13. After the build,
   before the upload: run the scan from "Verifying a release build" below
   (must exit 0), archive `mapping.txt` to
   `C:/Users/Dell/android_releases/2.2.0-vc12/`, re-run the build-level
   audit on this AAB and record it in `store-listing/LISTING.md`, and tag
   `v2.2.0` and `v2.2.0-play12`.
3. **Ask the user before the Play upload** (standing rule). The user
   uploads the AAB to the testing track by hand and pastes
   `node tools/patch-notes.mjs --play` into the release notes. Push master
   and the tags; publish the GitHub Release with
   `node tools/patch-notes.mjs --release-body | gh release create v2.2.0 --repo sheibeck/ddr --title "Delve, Die, Repeat 2.2.0" --notes-file -`.
4. **When 2.2 reaches testers** (the user confirms the update is live on
   their track): deploy the final rules with the default config —
   `firebase deploy --only firestore:rules,firestore:indexes --project delve-die-repeat-6ba5f --non-interactive`.
   From this moment, 2.1.0's REPORT A BUG is refused by the live rules
   (accepted by the user, 2026-09-29).
5. **`node tools/bug-reports/send-test-report.mjs --probe-rules`**: all ten
   probes must PASS (exit 0) — this is SRV-09's live proof. Record the
   table in `docs/BUG-REPORTS.md`'s release-day subsection and check SRV-09
   in `.planning/REQUIREMENTS.md`. If any probe fails: stop, keep the
   transition files, redeploy the transition config
   (`docs/LEADERBOARDS.md` section 6) if 2.1.0 reporting must be restored,
   and investigate before continuing.
6. **Delete the transition files**: `firebase/firestore.transition.rules`,
   `firebase.transition.json` and `test/unit/firestore-transition-rules.test.js`
   — update the docs that name them (`docs/LEADERBOARDS.md` section 6's
   transition subsection becomes history); `npm test`; commit.
7. **The website.** `node tools/patch-notes.mjs --site ../darktier-studio`,
   commit it there, then `npm run deploy` in `C:/projects/darktier-studio`
   (publishes `/privacy/apps`, `/privacy/delete-data`,
   `/delve-die-repeat/terms`, `/delve-die-repeat` and the 2.2.0 patch
   notes); open each page and confirm it serves the new text.
8. **Play Console: Data safety and store text.** Enter the Data safety
   answers and both URLs from `store-listing/LISTING.md`, and paste the
   full description (if Play Console asks for the Data safety form during
   step 3's release review, enter it then instead).
9. **Play Console cleanup of the old game service** —
   `docs/LEADERBOARDS.md` section 16.

At go-live (a later release, not 2.2): the Season 1 reset,
`docs/LEADERBOARDS.md` section 10.

The push itself follows the standing ask-first rule (after every update,
ask before pushing a versionCode-bumped signed AAB to the testing track).

- `android/version.properties` is the single source of `versionCode` / `versionName`. Play
  rejects a re-used versionCode, so `play:release` always bumps it; use
  `node tools/bump-version.mjs --name 1.1.0` when the human-readable version should change too.
- `npm run android:release` builds WITHOUT bumping (checklist step 2 uses
  this — rebuild the same version after a fix that never went up).
- Local review on the Pixel 7 still uses the debug APK (`npm run android:debug` + `adb install -r`).
  A Play-installed build and a locally-signed build have different signers, so one must be
  uninstalled before the other installs — the phone can't hold both.

## Android toolchain pin (AGP 8.13.0, D-21)

The build stays on **AGP 8.13.0 / Gradle 8.14.3 / JDK 21 / compileSdk 36** (Phase 67, D-21).
The plugin that originally motivated this pin, the Play Games plugin
(`@modbender/capacitor-play-games`, `67-AGP9-SPIKE.md`), was removed from
the app in 2.2 (Phase 85, RETIRE-01). The pin itself stays in place until
the deferred AGP 9 / Gradle 9 upgrade is taken up as its own reviewed
change:

- Do **not** let Android Studio's upgrade assistant bump AGP/Gradle.

## R8: minify, shrink, obfuscate (Phase 80, DROID-01)

The release build type in `android/app/build.gradle` runs R8: `minifyEnabled true` (dead code
removed, the rest renamed) and `shrinkResources true` (unused resources removed). AGP 8 runs R8 in
full mode by default. The debug build stays unminified, so the Pixel 7 dev loop and stack traces
are unchanged.

- **Default file: `proguard-android.txt`**, on purpose. It shrinks and obfuscates with no extra
  optimisation passes, which is the lower-risk choice while the release-signed device smoke waits
  for milestone close. The deferred AGP 9 upgrade must switch to `proguard-android-optimize.txt`
  (AGP 9 no longer accepts the non-optimising file).
- **Where the keep rules come from.** The real rules ship with the dependencies as consumer rules:
  Capacitor core keeps every `com.getcapacitor.Plugin` subclass and its `@PluginMethod` members
  (plugins are loaded by name from `capacitor.plugins.json`, so R8 can't see them); AGP's default
  file keeps every `@JavascriptInterface` method (the JS bridge). `android/app/proguard-rules.pro` mirrors all of
  them, so a dependency update that drops its own rules cannot silently break a release. It adds
  `-keepattributes SourceFile,LineNumberTable` so crash traces keep line numbers.
- **`android/app/src/main/res/raw/keep.xml`** keeps `@drawable/splash_screen`: the splash-screen
  plugin looks the drawable up by name (`capacitor.config.json` `androidSplashResourceName`),
  which the resource shrinker cannot see. Without it the splash is quietly deleted and the app
  boots to a blank rectangle, which is a look, but not ours.
- **Test:** `test/unit/android-r8.test.js` pins all of the above statically. Nothing in the test
  suite builds anything.

### The mapping (deobfuscation)

R8 writes `android/app/build/outputs/mapping/release/mapping.txt` (original name -> obfuscated
name). The AAB embeds it under `BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`,
so Play applies it automatically when the .aab is uploaded; there is no separate upload step and
no crash-reporting SDK (none is allowed: paid, offline, zero third-party SDKs).

- **Archive a copy per release**, outside the repo, in a folder named for the versionName and
  versionCode (e.g. `C:/Users/Dell/android_releases/2.1.0-vc11/mapping.txt`). The
  build directory is wiped by the next build; the archive is how an old crash gets decoded.
- **Manual fallback** (if Play ever shows obfuscated traces for a version): Play Console → the
  app → App bundle explorer → pick the version → Downloads → **ReTrace mapping file** → upload the
  archived `mapping.txt`.
- **Local retrace:** save the stack trace to a file, then
  `%LOCALAPPDATA%/Android/Sdk/cmdline-tools/latest/bin/retrace.bat <mapping.txt> <trace.txt>`.

### Verifying a release build

The recipe to run against a release build. Under the Phase 80 ruling the build and these checks
run **once**, after all the milestone's code has landed (80-04), not per change. If R8 stops on
missing classes, record `android/app/build/outputs/mapping/release/missing_rules.txt` and fix the
config in a code-part plan before building again; do not patch and rebuild on the spot.

1. **Plugins kept by name.** Every `classpath` in `android/app/src/main/assets/capacitor.plugins.json`
   (generated by `cap sync`) has an identity line `X -> X:` in `mapping.txt`. If the mapping is
   ambiguous, fall back to `apkanalyzer dex packages --defined-only <apk>`. The same holds for
   `com.getcapacitor.plugin.SystemBars` and `com.getcapacitor.MessageHandler`, whose
   `postMessage` member keeps its name (the JS bridge).
2. **Obfuscation is actually on.** At least one `androidx.` class line maps to a renamed class.
3. **The mapping travels with the bundle.** `jar tf app-release.aab` lists
   `BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`.
4. **Resources survived shrinking.** `aapt2 dump resources <apk>` (build-tools 36.0.0) lists
   `drawable/splash_screen`.
5. **The web app is packed.** The APK carries `assets/public/index.html` and
   `assets/capacitor.config.json`.
6. **No deprecated window APIs from us.**
   `node tools/android-api-scan.mjs --fail-on com.capacitorjs.plugins.statusbar,com.darktierstudios.delvedierepeat`
   exits 0 (it reads the default AAB and mapping; `--apk <path>` and `--mapping none` scan an
   unobfuscated archive; `--json` for machine output). The unresolved count must be 0, and the
   table (owner by owner: androidx, Capacitor plugins, other) must match the audit in
   `docs/ANDROID-DISPLAY.md`. Exit 1 means a match, exit 2 a tooling problem.

### Measured on the Phase 80 build

The single Phase 80 release build (80-04), the first R8-shrunk build made under this
milestone's build-part ruling:

- **BUILD_COMMIT:** `acba40ed9259f2a107c5355f5937417c0b256720`
- **`app-release.aab`:** 11,298,002 bytes.
- **`app-release-unsigned.apk`:** 10,916,555 bytes.
- **Pre-R8 baseline AAB** (`android/app/build/outputs/bundle/release/app-release.aab` in the
  main checkout, built 2026-09-24, `minifyEnabled false`): 12,740,741 bytes.
- **Delta:** 1,442,739 bytes smaller with R8 on, an 11.3% reduction.

See `docs/ANDROID-DISPLAY.md` for the edge-to-edge/system-bars decisions (DROID-02) and the
large-screen letterboxed-column decision (DROID-03), and its "Deprecated window API audit"
section for the full scan table run against this same build.

### First release after R8: Pixel 7 smoke (milestone-close checklist)

Install a **release-signed** build. Uninstall the Play-installed build first: the signers
differ, so the phone refuses to update in place, and uninstalling loses its Preferences data
(the save and the graveyard). Then check:

1. **Boot:** the app reaches the title screen, splash included.
2. **Save and resume:** start a run, SAVE & QUIT, relaunch, and resume the same run.
3. **Back button:** back closes an open sheet, and asks before quitting a live run.
4. **Sound and music:** sound effects play, and the title music plays.
5. **Haptics:** a hit buzzes.
6. **Account:** the ☰ account block shows your @handle.
7. **Leaderboard:** a Compete-ON death appears on LEADERBOARD, with "You placed Nth of M." on the death card.

## Uploading from the CLI (not set up yet)

Play's Developer API can do the upload so no Console drag-and-drop is needed:

1. Google Cloud Console → a project → **IAM & Admin → Service Accounts → Create**; create a JSON
   key and store it OUTSIDE the repo (e.g. `C:/Users/Dell/.play/service-account.json`).
2. Play Console → **Users and permissions → Invite new user** → the service account's email →
   app permissions: *Release to testing tracks* (+ *Edit and delete draft apps* if listing edits
   should be scripted too).
3. Then a `tools/play-upload.mjs` (using the `googleapis` **devDependency** — build tooling only,
   nothing ships in the app) does: edits.insert → edits.bundles.upload → edits.tracks.update
   (`internal`) → edits.commit. Ask Claude to add it once steps 1–2 are done.
