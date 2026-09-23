# Phase 64: Device Close & UAT Batch - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the redone Gear tab end to end on the real Pixel 7 and close the milestone on one recorded checklist (GSCR-12). This covers:
- Building the v1.9 debug APK from master after Phase 63.
- Writing `docs/UAT-v1.9.md`: one batched checklist merged from the `human_verification` lists in `61-VERIFICATION.md` (7), `62-VERIFICATION.md` (7) and `63-VERIFICATION.md` (8), plus the two assumptions 63-04 routed here (TalkBack reading the dialog, the hardware back button's real feel).
- Installing it on the phone.
- Walking the checklist WITH the user in this session, recording each result as the user states it.

No product code changes in this phase. Findings become todos or quick tasks, never mid-walk edits.

</domain>

<decisions>
## Implementation Decisions

### Device session — user decision this session
- **Walk it together now.** The user connected the Pixel 7 over wireless adb during this discuss: re-paired with `adb pair`, now connected as `10.0.0.175:46585`, model `Pixel_7`. The phone runs a sideloaded local build (versionName 1.5.0 / vc 6, installer `null`, from the v1.8 walk), so the new debug APK installs over it with `adb install -r`. That keeps Preferences data, and there is no signer conflict (both are local debug builds). This is NOT the deferred-to-play-sessions mode v1.8 used. The walk happens in-session, with the orchestrator relaying each check to the user and recording the stated result.
- **Deploy recipe (STATE Ground Truth):** `adb install -r <apk>`, then `adb shell am force-stop com.darktierstudios.delvedierepeat`, then a `monkey` relaunch (install alone does not reload the WebView). Screenshots via screencap usually hit the lock screen, so the user reviews and reports. adb lives at `%LOCALAPPDATA%/Android/Sdk/platform-tools/adb.exe` (not on the bash PATH). The wireless port rotates; rediscover with `adb mdns services`, and re-pair with `adb pair <ip:pairport> <code>` when the connect is refused.

### Checklist shape
- `docs/UAT-v1.9.md` follows `docs/UAT-v1.8.md`'s format: a build header (APK name `ddr-v1.9-<shorthash>-debug.apk`, full commit, sha256, and the version label shown in Settings), protocol, sources, suggested order, then sections per phase with `| # | Step | Who | Result |` tables and empty Result cells.
- Suggested order: the Gear tab outside a fight first (layout, then the sheet, then drop and swap), then the store (Spiked Staff as a Magic User if one is at hand; otherwise any illegal or not-better item), then a fight (combat lock), then the reduced-motion items in one pass, then TalkBack last.
- Items that need a specific setup (a Magic User with a Quarter Staff at a store, a full bag, destroyed armor, a staff with charges spent) are marked "if available". The user can skip one, and a skip is recorded as "not reached", never as a pass.

### Build
- The debug APK is built by the project's existing Android pipeline (`npm run android:debug` = `cap:sync` + `pin-jdk` + `gradle assembleDebug`). The output is copied or renamed to `ddr-v1.9-<shorthash>-debug.apk` under a scratch or artifacts directory, not committed, and its sha256 is recorded in the checklist header.
- No version bump for the debug build. The Play internal-testing offer (versionCode bump plus a signed AAB) comes AFTER the milestone closes, per the standing ask-before-deploy rule, and is not part of this phase.

### GSCR-12 traceability
- GSCR-12 is complete when the checklist exists, the APK is installed, and the walk results are recorded, whatever the individual results. Failed items become todos, and failures are not blockers for the milestone close unless the user says so. If the walk is cut short, GSCR-12 is marked "Partial — N of M walked" and the rest carry to the user's play sessions.

### Claude's Discretion
- The plan split. Likely: (1) an autonomous plan that builds the APK and writes `docs/UAT-v1.9.md`; (2) the device walk, run INLINE by the orchestrator with the user, because executors can't talk to the user. It installs over adb, relays the checks, records results in `docs/UAT-v1.9.md`, and turns findings into todos.

</decisions>

<code_context>
## Existing Code Insights

- The previous device round's format and flow: `docs/UAT-v1.8.md`, `.planning/milestones/v1.8-phases/60-performance-footprint-close/60-02-SUMMARY.md` (building the debug APKs) and `60-03-SUMMARY.md` (the walk).
- Sources to merge: `.planning/phases/6[1-3]-*/6?-VERIFICATION.md` frontmatter `human_verification` lists, plus `63-04-SUMMARY.md` "Known carried-forward assumptions".
- `package.json` scripts: `android:debug` (debug APK), `build:www`, `boot:check`. `tools/gradle.mjs` and `tools/pin-jdk.mjs` wrap Gradle.

</code_context>

<specifics>
## Specific Ideas

- The Spiked Staff case is the headline store check: gold is charged, the staff lands in the bag, and the row explains why it isn't an upgrade.
- Mid-fight: open the Gear tab and a sheet, and see EQUIP / SWAP / UNEQUIP greyed with "Not the moment to change outfits." while USE and DROP stay live.

</specifics>

<deferred>
## Deferred Ideas

- The Play internal-testing release (after the milestone close, if the user wants it).
- Earlier milestones' open UAT batches (v1.5–v1.8) are not part of this walk.

</deferred>
