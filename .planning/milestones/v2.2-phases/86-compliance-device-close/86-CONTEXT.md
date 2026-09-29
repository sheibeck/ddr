# Phase 86: Compliance & Device Close - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Every store, policy and website text matches what the game now sends (our Firebase board + bug reports, no Play Games), Play Games setup docs are retired, and the milestone's device checks are batched into one Pixel 7 checklist against one debug APK. Requirements COMP-01..COMP-04, plus ROADMAP criterion 5 (the release-day rules swap is a listed release step). No app feature code; no release build (release builds come only after the user agrees the patch notes — standing rule).

</domain>

<decisions>
## Implementation Decisions

### Privacy and Data safety (group 1)
- **Data safety gets its own "User IDs" row: an anonymous game ID** — collected for app functionality, optional (created only when Compete is ON and a run is sent, or when the player sends a bug report), deletable with ERASE MY RUNS. The leaderboard row covers the handle and run stats (every field in the run doc, including cause/killer, epitaph, version, death time); bug reports keep their rows. Drop every Play Games row and phrase (player ID, score tags, "Google stores the scores", PGS SDK auto-collection decision) from `store-listing/LISTING.md`, and refresh its source/build audits (Firebase REST now present, plugin gone, INTERNET now used for our board + bug reports).
- **Collected, not shared.** Google Firebase is our service provider (Play's service-provider exemption); the privacy policy says plainly that your handle and runs are public on the board for other players to see.
- **Backend described as "one small database":** "We keep one small database on Google Firebase for the public leaderboard and bug reports, nothing else" — then what is sent, who sees it, Compete OFF (nothing sent), erasing your runs (ERASE MY RUNS: board runs + anonymous account deleted; local history stays), retention (bug reports and limit records deleted on the Phase 83 schedule), removal of forged runs (moderation), and children. Replaces "we run no servers of our own" everywhere.
- **Pages:** darktier-studio `src/pages/privacy/apps.astro` (Leaderboards section rewritten, lede, permissions INTERNET, children, Data safety summary, meta description, header comment, effective date), `src/pages/privacy/delete-data.astro` (delete via ERASE MY RUNS in the game; email fallback with the @handle; no Play Games profile steps), `src/pages/delve-die-repeat/terms.astro` (section 5 becomes our leaderboard: handle visible, runs public, forged runs removed, Compete OFF; section 6 privacy; the header comment's OAuth-consent note is obsolete once Play Games sign-in is gone — keep the page, update the comment), and `src/pages/delve-die-repeat/index.astro` ("Optional Google Play Games leaderboards" → our board). Keep each page's structure and plain policy language.
- **Website deploy happens with the 2.2 release, not now.** Commit and push the darktier-studio changes to its `main` (the user's repo, push authorized) during this phase; `npm run deploy` there is a listed release step alongside the Play upload and the rules swap.

### Build and checklist (group 2)
- **The debug APK is 2.2.0 (versionCode 12).** Bump `android/version.properties` so device-test runs on the live board are stamped "2.2.0 (12)", not 2.1.0. `tools/build-www.mjs` requires `docs/patch-notes/2.2.0.md` for the current version, so draft it in this phase (house style per `docs/patch-notes/README.md`) and mark it as a draft for the user to agree; the agreed text gates any release build (standing rule), not the debug APK.
- **Build the debug APK right after Phase 85's last code lands** (`npm run android:debug`; output `android/app/build/outputs/apk/debug/app-debug.apk`), while this phase's docs/website work continues — overrides "APK after the last wave" for this milestone because Phase 86 carries no app code. If Phase 86 does end up touching shipped code, rebuild once at the end.
- **Old Play Games device-check rows are marked superseded** in `docs/UAT-v2.1.md` (15.1–15.4, 15.8, row 0.3) and `docs/UAT-v2.0.md` (F1 and the PGS rows), each with a pointer to `docs/UAT-v2.2.md`.
- **Play Console Play Games cleanup is a user step after 2.2 reaches testers** (2.1.0 still uses Play Games until testers update): unpublish/delete the Season-1 boards and the Play Games configuration. Listed in UAT-v2.2 section 0 and the release checklist.

### Retire PLAY-GAMES-SETUP.md (COMP-03)
- Retire `docs/PLAY-GAMES-SETUP.md` in favour of `docs/LEADERBOARDS.md`; fix live links (docs/RELEASING.md console checklist incl. the LEANEST delete step, UAT docs); archived `.planning/milestones/*` stay as history.

### UAT-v2.2 (COMP-04)
- `docs/UAT-v2.2.md` follows the UAT-v2.1 format: header (Build, Protocol, Install note, Sources), section 0 user tasks (console/store/site: Data safety answers, site deploy, rules swap, Play Games cleanup), then one section per phase from each VERIFICATION's human_verification list (84 panel, 85 account/submission/erase/Compete OFF in airplane mode (runs played with Compete off never uploaded), 83-09 report-sheet limit states), plus quick-task rows. Result column `open`.

### Release steps (ROADMAP criterion 5 and the rulings above)
- One ordered release checklist (in `docs/RELEASING.md` or UAT-v2.2 section 0): agree patch notes → release build (vc12) → Play upload (ask before the internal/closed push — standing rule) → when 2.2 reaches testers: deploy `firebase.json` (final rules), run `send-test-report.mjs --probe-rules` (ten PASS; SRV-09 live proof, record in docs/BUG-REPORTS.md), delete the transition files (`firebase/firestore.transition.rules`, `firebase.transition.json`, `test/unit/firestore-transition-rules.test.js`), deploy the website, then the Play Console Play Games cleanup. At go-live (later, not this release): the Season 1 reset (runbook §10).

### Claude's Discretion
- Exact policy wording within the decisions; how LISTING.md's audits are restructured; section grouping in UAT-v2.2.
- Bot readout: the engine is untouched this milestone, so the milestone-end bot run (bots-only-at-milestone-end rule) is not required; note it in the milestone audit.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `store-listing/LISTING.md` (Data safety table :105-110, bug-report rows already present, anonymous-uid note :131-141 left for this phase), `test/unit/store-listing.test.js` (pins listing text — update with the text).
- UAT format: `docs/UAT-v2.1.md`. Patch notes: `docs/patch-notes/README.md`, `tools/patch-notes.mjs` (`--check`, `--play`, `--site ../darktier-studio`, `--write-module`).
- `npm run android:debug`; `android/version.properties` (versionCode=11, versionName=2.1.0).

### Established Patterns
- Website: Astro 7 + Tailwind, Firebase Hosting (`darktierstudios-b846f`), manual `npm run deploy`; repo `sheibeck/darktier-studio`, branch main.
- Listing/site text must match each other (the apps.astro header comment says the Data safety summary must match LISTING.md).

### Integration Points
- darktier-studio pages listed above; docs/RELEASING.md; docs/LEADERBOARDS.md §6/§10/§14; docs/BUG-REPORTS.md "## Live proof".

</code_context>

<specifics>
## Specific Ideas

- "We keep one small database on Google Firebase for the public leaderboard and bug reports, nothing else."

</specifics>

<deferred>
## Deferred Ideas

- The Season 1 go-live reset (SEASON → 2 named "Season 1") — at go-live, not this release.

</deferred>
