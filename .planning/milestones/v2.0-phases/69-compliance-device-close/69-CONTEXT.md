# Phase 69: Compliance & Device Close - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous v2.0 run). Area 2 was accepted as recommended. For Area 1 the user pointed at the existing privacy page in the website project ("I have a privacy page already in my darktier-studio website. See projects folder"), so the privacy decisions below reconcile that page instead of drafting a new one.

<domain>
## Phase Boundary

This phase brings the privacy, Data Safety and Play Console story into line with the shipped Play Games integration from Phases 67–68. The console-side steps go to the user as a runbook; they do not block the milestone. The milestone closes on a signed 2.0.0 AAB and the batched Pixel 7 checklist `docs/UAT-v2.0.md`.

**Not in this phase:** any new gameplay, UI or network behaviour. If the audit finds a real defect in 65–68, it becomes a small fix plan inside this phase, recorded as such.

</domain>

<decisions>
## Implementation Decisions

### Privacy policy (COMPLY-01): the live page is in the website repo
- **D-01 — Source of truth:** the live apps policy is `C:/projects/darktier-studio/src/pages/privacy/apps.astro` (an Astro site deployed to `https://darktierstudios.com/privacy/apps`, the URL entered in Play Console). A companion page, `src/pages/privacy/delete-data.astro`, backs Play Console's "Delete data URL". Both were written on 2026-09-17, ahead of the build, and already describe optional Play Games leaderboards.
- **D-02 — Reconcile, don't rewrite:** edit `apps.astro` in the darktier-studio repo so that it matches exactly what v2.0 sends and does. Commit it there **locally**. The user deploys the website. Known gaps to fix:
  1. It says the adventurer's name and epitaph are **not** sent. Under 67 D-18, the score tag **does** carry a truncated adventurer name, race/sub/level, floor/days/steps/kills/sp/gold and a cause code. The epitaph is still not sent.
  2. It lists "your total death count" as sent. Most Deaths is not a global board in v2.0, so it is removed.
  3. It says the player can "sign out at any time from the account menu". PGS v2 has no programmatic sign-out, so this becomes "turn off Compete (Stop competing) in the account menu; to disconnect entirely, use the Play Games app".
  4. It describes the tombstone share card, which was deferred out of v2.0. Remove the section until share ships, or mark it as not yet available (planner's choice; removal is preferred).
  5. Automatic sign-in is on by default with Compete (67 D-01). The text must say plainly that the game may sign the player in automatically at launch unless Compete is turned off, and that no leaderboard data is sent while Compete is off.
  6. Update the `effective` date, and keep the "Data safety summary" section consistent with D-04 below.
  The `delete-data.astro` steps are re-checked against the current Play Games app wording and fixed only if wrong.
- **D-03 — Mirror in this repo:** `store-listing/LISTING.md`'s Privacy policy section records the reconciled page's effective date and the website commit hash, so the record keeping lives next to the listing.

### Data Safety and the listing (COMPLY-02)
- **D-04 — Data Safety answers:** update `store-listing/LISTING.md`'s "Data safety" section:
  - **User IDs** (the Play Games player ID) and **App activity** (game scores, plus the tag's gameplay details) are collected.
  - The data is encrypted in transit (Google Play services) and **optional**, since users can turn Compete off.
  - The purpose is **App functionality**.
  - It is **not sold**. Whether "shared" applies is decided against Google's PGS data-disclosure guidance (`https://developers.google.com/games/services/data-collection`), and the planner records the finding and its source.
  - Deletion is through the Play Games app and the delete-data page.
  - The answers are backed by a **fresh SDK and dependency audit** of the shipped build: the Gradle `:app:dependencies` tree, `package.json`, the `AndroidManifest.xml` permissions, and a grep of `www/` for network APIs outside `src/browser/playGames.js`. The audit is recorded in the listing, with no ads, analytics or crash SDKs.
- **D-05 — Listing copy:** the store description bullet "Plays fully offline. No account, no sign-in, no ads, no in-app purchases, no data collected." is re-voiced. For example: "Plays fully offline. Optional Google Play Games leaderboards, if you want the whole world to see how you died. No ads, no in-app purchases." The screenshots are unchanged unless the panel makes one wrong: the "graveyard" screenshot now shows the Leaderboards panel, so it is regenerated with `node tools/store-screenshots/capture.js` if that tool still runs headless, or otherwise flagged as a human item.

### Console runbook, release and UAT (COMPLY-03, COMPLY-04)
- **D-06 — Runbook completion:** finish `docs/PLAY-GAMES-SETUP.md`, which Phase 67 started. It covers:
  - creating the **5 Season-1 leaderboards** (DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE) with their names, sort order (LEANEST lower-is-better, the rest higher-is-better, per 68 D-16), score format and limits;
  - pasting the IDs into the `content/` leaderboard-ID map (68 D-14);
  - the APP_ID string resource;
  - linking the Play App Signing SHA-1 plus the debug-keystore SHA-1;
  - the tester allow-list and publishing the PGS config;
  - the season-bump procedure (68 D-15).

  These are the user's Play Console actions, so they are recorded as a **deferred human item** and never block closure.
- **D-07 — Release build:** bump to **2.0.0 / versionCode 9** (`npm run version:bump` plus the `android/version.properties` convention) and build the signed AAB with the existing `npm run android:release` / `play:release` flow. The build runs, but the **user uploads it** to the closed-testing track by hand (standing rule: ask first, never upload for them). Record the AAB path and versionCode. Tag `v2.0.0-play9` after a successful build.
- **D-08 — Device build for UAT:** after the last plan lands, build the **debug APK** (`npm run android:debug`) and offer a Pixel 7 install at the milestone close (deferred-UAT protocol). The Play and debug builds have different signers, so an install means uninstalling first, which loses save data; the offer says so.
- **D-09 — UAT batch:** `docs/UAT-v2.0.md` is one batched checklist, in the house format of `docs/UAT-v1.9.md`, merging every `human_verification` item from the Phase 65–68 VERIFICATION and SUMMARY files. It is grouped by area: the new-best block, the Leaderboards panel on every board, title vs tab entry and back, sign-in (auto, decline, no profile), the account chip and menu, Compete off with a network capture (Phase 67 research Assumption A1), the offline queue and flush, "you placed X" (live and deferred rail card), seasons, and airplane mode. It is written and committed, **not run** mid-milestone.

### Claude's Discretion
- The exact wording of the reconciled policy paragraphs (plain, accurate and friendly; the website voice, not the game's sarcasm), the UAT item numbering, and the shape of the audit record.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `C:/projects/darktier-studio/src/pages/privacy/apps.astro` and `delete-data.astro`: an Astro site with `const effective`, `const contact` and a `Layout` component. The prior commit `43b70e9` is "apps privacy policy — optional Google Play Games leaderboards + share".
- `store-listing/LISTING.md`: the store copy, privacy URL, Data safety section (currently "No data collected", verified 2026-09-17) and screenshot notes. `tools/store-screenshots/capture.js` is the headless capture bot.
- `docs/RELEASING.md`, `npm run play:release` (bump, then www, cap sync, pin-jdk, signed `bundleRelease`), and `android/version.properties`. The keystore credentials are in git-ignored `android/keystore.properties`. The AAB output is `android/app/build/outputs/bundle/release/app-release.aab`.
- `docs/UAT-v1.9.md` is the house format for the batched device checklist.
- `docs/PLAY-GAMES-SETUP.md` (started in Phase 67), `content/leaderboards.js` (the Phase 68 ID map) and `content/season.js`.

### Established Patterns
- The deferred-UAT protocol: an orchestrator-authored VERIFICATION with `human_verification` lists and one batched checklist at the milestone close. Console and website steps are user actions recorded as deferred items.
- The standing rule: after an update batch, offer the Play build but never upload it. The user uploads to closed testing by hand.

### Integration Points
- The website repo (a separate git repo, committed locally, deployed by the user), `store-listing/LISTING.md`, `docs/`, `android/version.properties`, and the release build.

</code_context>

<specifics>
## Specific Ideas

- The reconciled policy's "what is sent" list should mirror the tag format literally, so the policy never drifts from code: player ID; per run, the five leaderboard scores; plus a short tag with the adventurer's name (possibly shortened), race, sub-class, level, floor, days, steps, kills, experience, wilmst and the cause of death. Not sent: the epitaph, your saves, your settings and your local graveyard.

</specifics>

<deferred>
## Deferred Ideas

- Tombstone share (and its policy section) → a later milestone.
- R8/minify and AGP 9 → the existing todo, not this milestone.

</deferred>
