---
phase: 69-compliance-device-close
plan: 01
subsystem: compliance
status: complete
tags: [privacy, data-safety, store-listing, play-games, website]
requires: [67 D-01, 67 D-03, 67 D-18, 67 D-20, 68-07 queue purge]
provides: [reconciled apps privacy policy (website commit aaa0f4a), 2.0 Data safety answers + source-level audit, re-voiced listing, store-listing pins]
affects: [69-03 UAT-v2.0 (Compete-off capture feeds the diagnostics decision), 69-04 (build-level audit on 2.0.0)]
tech-stack:
  added: []
  patterns: [doc pins in node --test (house play-games-runbook pattern)]
key-files:
  created:
    - test/unit/store-listing.test.js
  modified:
    - store-listing/LISTING.md
    - C:/projects/darktier-studio/src/pages/privacy/apps.astro (separate repo)
    - C:/projects/darktier-studio/src/pages/privacy/delete-data.astro (separate repo)
decisions:
  - "Data safety: User IDs + App activity/Other actions collected, optional, App functionality, encrypted in transit, not shared (service-provider + user-initiated exemptions), not sold; 'Other actions' label confirmed on answer/10787469"
  - "SDK auto Analytics/Diagnostics left as the user's console-time decision, tied to the Compete-off capture in UAT-v2.0; D-04 answers unchanged"
  - "delete-data steps replaced with Google's current wording (answer/9130646: web profile page + Play Store app); the old Play Games app path no longer matches Google's help"
  - "08-dead.png not regenerated: playwright-core does not resolve; recorded as an owed human item"
metrics:
  duration: ~25 min
  completed: 2026-09-24
  tasks: 3
  files: 4
---

# Phase 69 Plan 01: Privacy, Data Safety and Listing Reconciliation Summary

The darktier-studio apps policy and delete-data page now describe exactly what 2.0 sends: Compete on by default, the v1 score tag field by field, and Google's own SDK start-up with Compete off. They are committed locally as darktier-studio `aaa0f4a`. LISTING.md now has the D-04 Data safety answers, the not-shared finding with both Google sources, the diagnostics question left open for the user, a dated source-level audit and the re-voiced offline bullet. All of it is pinned by a new test.

## Commits

| Repo | Task | Commit | Message |
|---|---|---|---|
| mazeworld (worktree) | 1 RED | 074542a | test(69-01): add failing pins for the 2.0 Data safety answers |
| mazeworld (worktree) | 1 GREEN | c5e9dc6 | feat(69-01): 2.0 Data safety answers with source-level audit |
| darktier-studio | 2 | aaa0f4ad4822ebd43c58de205c0da210580c41df (aaa0f4a) | docs(privacy): reconcile the apps policy with Delve, Die, Repeat 2.0 leaderboards |
| mazeworld (worktree) | 3 | f179808 | feat(69-01): listing privacy record, re-voiced offline bullet, owed screenshot |

darktier-studio: `git show --stat HEAD` lists exactly `src/pages/privacy/apps.astro` and `src/pages/privacy/delete-data.astro`. `git status -sb` shows `main...origin/main [ahead 1]`, so the commit is **not pushed** and **not deployed**. Its working tree was clean before the edit (`git status --short` printed nothing, HEAD b779ba3).

## Task 1: Source-level audit (raw outputs in the session scratchpad, not the repo)

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | lockfile-only install (worktree had no node_modules) |
| `npm run build:www` | 0 | www/ rebuilt; 8 native plugin packages vendored |
| `node -e` list of `package.json` deps/devDeps | 0 | 8 `@capacitor/*` + `@modbender/capacitor-play-games` `0.5.0`; dev `@capacitor/cli` |
| `node -e` list of package-lock non-dev entries | 0 | 10 entries: the 9 above plus `tslib` |
| `grep -ciE "firebase\|admob\|play-services-ads\|ads-identifier\|analytics\|measurement\|crashlytics\|appsflyer\|adjust\|facebook\|appcenter\|sentry\|bugsnag"` over that list | 1 (no match) | **0 hits** |
| `grep -n "uses-permission\|AD_ID\|APP_ID\|games" android/app/src/main/AndroidManifest.xml` | 0 | only `android.permission.INTERNET` (line 46); `com.google.android.gms.games.APP_ID` meta-data; no AD_ID |
| `grep -n -i "http\|CapacitorHttp" capacitor.config.json` | 0 | only `"androidScheme": "https"`; CapacitorHttp not enabled |
| `grep -rlE "fetch\(\|XMLHttpRequest\|WebSocket\|sendBeacon\|EventSource" www/` | 0 | `www/src/browser/sfx.js` (line 353, same-origin `./sfx/<clip>.mp3`); `www/vendor/@capacitor/core/{capacitor.js,index.js,index.cjs.js}` + `.map` files (CapacitorHttp web patch, inert) |

No hit in the vendored Play Games plugin or in `playGames.js`.

**Defect findings: none.**

The Google sources were fetched on 2026-09-24 with `curl` into the scratchpad:
- answer/10787469: "Other actions" = "any other user activity or actions in-app not listed here such as gameplay" (label confirmed); the service-provider and user-initiated exemptions; the rule that "optional" requires all users to be able to opt in or out.
- developer.android.com/games/pgs/data-collection (last updated 2026-06-16): automatic Gamer Identity, Analytics and Diagnostics; game scores; HTTPS in transit; the authenticated-player rule; delete via the profile; "solely responsible".

TDD: RED ran with 0 pass / 2 fail before the section was rewritten. GREEN ran with 2 pass / 0 fail.

## Task 2: Claim table (apps.astro / delete-data.astro)

| Policy sentence (short form) | Source |
|---|---|
| We collect nothing ourselves, run no servers | 69 D-01; no backend in repo; audit above |
| Compete is on by default; the game may sign you in automatically at launch | 67 D-01; `src/browser/account.js:62` (compete true unless exactly false) |
| Declining or no profile leaves the game fully playable | 67 D-01, D-11; `src/browser/playGames.js:30-32` |
| Compete off: no sign-in, submission or leaderboard request; no leaderboard data | 67 D-20; `playGames.js:22-25`; `globalBoards.js:32-34` |
| Google's software still starts with the app and may show "Welcome back" | 67 D-20 (`PlayGamesPlugin.kt:40-43`); `playGames.js:24-25` |
| Five boards: deepest descent, leanest run, longest-lived, most kills, fattest purse | `src/browser/boardScores.js:20` SUBMIT_BOARDS (DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE) |
| Sent: player ID; five scores per ended run; run summary race, sub-class, level, cause, floor, days, steps, kills, wilmst, experience, name (in tag order) | `src/browser/scoreTag.js:10-17` (v1.race.sub.lvl.cause.floor.day.steps.kills.gold.sp.name); gold = wilmst, sp = experience; `pgsQueue.js:13` entry shape |
| Name is game-rolled, may be shortened | `scoreTag.js:13-15` (full / "First L." / cut); content/names.js, no name input |
| Not sent: epitaph, saves, settings, personal bests, local graveyard | `scoreTag.js:16-17`; 67 D-18; tag is the only free text |
| Friends only after SHOW MY FRIENDS + Google's screen | `content/boards.js:143`; 68 D-06; `globalBoards.js:34` |
| Global/friends results shown, not saved | `src/browser/globalBoards.js:35` ("The cache lives in memory only") |
| Account menu: face top right of the title screen, beside ☰ in the dungeon | `mazeworld.html:1666-1667`, `1904-1910` |
| STOP COMPETING, or COMPETE → OFF | `content/account.js:39,42`; 67 D-03 |
| Compete off discards runs still waiting to be sent | `pgsQueue.js:235-237,444-458` purge(); `mazeworld.html:6278-6288` calls `pgsQueue.purge()` on turn-off (68-07). Confirmed |
| Disconnect entirely via the Play Games app | `content/account.js:40` stopHelp; 67 D-03 |
| Delete via Play Games profile / play.google.com/games/profile | Google answer/9130646 (fetched 2026-09-24); PGS data-collection page |
| Device data includes the offline queue | `pgsQueue.js:9,28` (`ddr.pgsqueue.v1` via mzStorage) |
| Internet used only for Play Games while Compete on, plus Google's start-up | AndroidManifest.xml:46; audit above; 67 D-20 |
| No advertising/analytics/crash SDKs | Audit above (0 forbidden hits) |
| Data safety summary (User IDs + App activity, optional, App functionality, not shared, not sold) | LISTING.md Data safety (Task 1), D-04 |

Removed: the "total death count" and "most deaths" items, "sign out at any time", and the "Sharing your results" share-card section (gap 4; share deferred). Effective date: `"September 24, 2026"`. `const contact` is unchanged.

**Delete-steps check:** the plan named https://support.google.com/googleplay/answer/3129346 as the starting point. That page only links out to deletion, so the check used https://support.google.com/googleplay/answer/9130646 ("Delete your Play Games data or Play Games profile"), fetched 2026-09-24. **Verdict: the old steps were wrong.** They sent the player to the Google Play Games app, then profile picture, then Settings. Google now gives two routes:
- Web: play.google.com/games/profile, then Your Data, then Delete Play Games Account & Data, then Delete individual game data, then Delete.
- Play Store app: Profile icon, then Settings, then General, then Play Games Profile, then Privacy & Settings, then Your Data, then Delete profile & game data, then Delete individual game data, then Delete.

The page now gives both routes and links answer/9130646. docs/UAT-v2.0.md carries the device check.

**darktier-studio build:** `npm run build` exited 0 (10 pages in about 56 s, including `/privacy/apps.html` and `/privacy/delete-data.html`). It wrote only the git-ignored `dist/` and `public/build-info.json`.

## Task 3: Listing

- Privacy section: added the delete-data URL and "Reconciled for 2.0.0 (Leaderboards): effective September 24, 2026; darktier-studio commit aaa0f4a (local, not yet deployed …)", plus the full hash.
- Description: only the offline bullet changed, to the D-05 text. I re-read every other sentence and both short descriptions against v2.0. None is made false by v2.0 ("offline roguelike" still holds, since play is fully offline and the boards are optional). The description is 2774 characters, under the 4000 limit. The preferred short description is exactly 80 characters.
- **Screenshot outcome: not regenerated.** `require.resolve("playwright-core", {paths:[tools/store-screenshots]})` gave MODULE_NOT_FOUND. The plan forbids installing it, so an "Owed (deferred human item)" note was added under "## Screenshots".
- Tests: `node --test test/unit/store-listing.test.js test/unit/stale-terms.test.js`: 11 pass / 0 fail. `npm test`: 5030 tests, 5023 pass, 7 fail. All 7 are the known worktree CRLF doc-ledger failures (class-pass-ledger 1057-1059/1067, flee-ledger 1822-1824). None are new.

## Deviations from Plan

1. **[Rule 1 - Bug] delete-data deletion steps replaced.** Google's current help (answer/9130646) no longer matches the old Play Games app path, so the steps were rewritten to Google's web and Play Store routes. The plan allowed this ("change only if wrong").
2. **apps.astro wording additions beyond the item list.** These keep the page consistent with 67 D-20:
   - a sentence after the "do not collect" list saying Google's own Play Games software is covered by Google's policy;
   - a link to Google's PGS data-disclosure page in the "No servers…" section.

   They add no new claims about the game's own behaviour.
3. Task 2 produced no commit in this repo: its files live in darktier-studio. Its record is in Task 3's LISTING commit.

## Known Stubs

None.

## Threat Flags

None. No code changed; the disclosure surface is the subject of the plan's threat model (T-69-01..04 mitigated as planned).

## Human verification (deferred to end of run)

1. **Deploy the website.** Review darktier-studio commit `aaa0f4a` (`git -C C:/projects/darktier-studio show HEAD`), then run `npm run deploy` in `C:/projects/darktier-studio`. Afterwards check that https://darktierstudios.com/privacy/apps shows "Effective September 24, 2026".
2. **Play Console Data safety.** Enter the answers from `store-listing/LISTING.md` "## Data safety":
   - Yes, the app collects data;
   - User IDs and App activity / Other actions: collected, not shared, optional, App functionality, not ephemeral;
   - encrypted in transit; deletion available.
   Use privacy URL https://darktierstudios.com/privacy/apps and Delete data URL https://darktierstudios.com/privacy/delete-data.
3. **Paste the full description** from LISTING.md (Grow users → Store presence → Main store listing).
4. **Diagnostics decision.** After the release-blocking Compete-off network capture in docs/UAT-v2.0.md: if Google's SDK sends anything at launch with Compete off, also declare App info and performance → Diagnostics (collected, not optional). Otherwise leave the table as is.
5. **Owed screenshot.** Regenerate `store-listing/screenshots/{phone,tablet-7in,tablet-10in}/08-dead.png` showing the Leaderboards panel on DEEPEST, at 1080×1920, 1350×2400 and 1620×2880. Use either `playwright-core` + `capture.js` or Chrome device mode, per the LISTING note.
6. **Device check of the deletion steps.** On the Pixel 7, confirm the Play Store route (Settings → General → Play Games Profile → Privacy & Settings) matches the delete-data page.

## Self-Check: PASSED

Found: 074542a, c5e9dc6, f179808 (worktree); aaa0f4a (darktier-studio, ahead 1, not pushed); test/unit/store-listing.test.js; store-listing/LISTING.md.
