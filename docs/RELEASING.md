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

Output: `android/app/build/outputs/bundle/release/app-release.aab`, signed with the upload key.
Then Play Console → Testing → Internal testing → **Create new release** → drop the .aab →
release notes → Save + Start rollout. Testers get it within minutes (no review on internal).

## Next Play push: release notes

Tester-facing text to paste into Play Console's release notes for the next push (v2.1
Leaderboards panel fixes). Family-friendly deadpan, no internal ids:

- The Leaderboards panel now has ME | ALL | FRIENDS; signed in, it opens on ALL.
- Your own score is tagged YOU and appears once.
- The boards refresh when you open them.
- LEANEST is gone.
- LINEAGE and GRAVEYARD now live under ME at the end of the board rail, and GRAVEYARD still
  lists every stored run with its epitaph.
- Every finished run lands on your own boards.

## After the push: console checklist

1. Delete LEANEST, Season 1 (`CgkIlvbN0YYPEAIQAw`) in Play Console once the new build is live
   (docs/PLAY-GAMES-SETUP.md section 13).
2. With two signed-in accounts (you and a friend), confirm a new DEEPEST score from one shows
   on the other's ALL board after reopening the Leaderboards panel (the milestone-close device
   check).

The push itself follows the standing ask-first rule (after every update, ask before pushing a
versionCode-bumped signed AAB to the internal-testing track).

- `android/version.properties` is the single source of `versionCode` / `versionName`. Play
  rejects a re-used versionCode, so `play:release` always bumps it; use
  `node tools/bump-version.mjs --name 1.1.0` when the human-readable version should change too.
- `npm run android:release` builds WITHOUT bumping (rebuild the same version after a fix that
  never went up).
- Local review on the Pixel 7 still uses the debug APK (`npm run android:debug` + `adb install -r`).
  A Play-installed build and a locally-signed build have different signers, so one must be
  uninstalled before the other installs — the phone can't hold both.

## Android toolchain pin (AGP 8.13.0, D-21)

The build stays on **AGP 8.13.0 / Gradle 8.14.3 / JDK 21 / compileSdk 36** (Phase 67, D-21).
The Play Games plugin (`@modbender/capacitor-play-games`, pinned at exactly 0.5.0, installed
unmodified) declares AGP 9.3.1 + Kotlin Gradle Plugin 2.4.10 in its own `buildscript {}`, but
the root project's AGP 8.13.0 shadows them and the plugin builds cleanly on the pinned toolchain
with **no Gradle fix** (67-AGP9-SPIKE.md; confirmed again by 67-06's `npm run android:debug`).
A whole-build move to AGP 9.3.1 / Gradle 9.5.0 failed in the spike (the plugin's Kotlin
sources do not compile once its KGP 2.4.10 actually takes effect), so:

- Do **not** let Android Studio's upgrade assistant bump AGP/Gradle.
- The only expected build noise from the plugin is the KGP warning "Gradle 8.14.3 is
  deprecated ..." (advisory).
- A plugin version bump is a deliberate, reviewed change (D-17): re-review the tarball, update
  the pin and lock integrity in `test/unit/play-games-intake.test.js`, and re-run the
  `:app:dependencies --configuration releaseRuntimeClasspath` audit for ads/analytics SDKs.

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
