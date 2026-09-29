# Requirements: Delve, Die, Repeat — v2.2 Our Own Leaderboards

**Defined:** 2026-09-28
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Milestone goal:** Replace Google Play Games with our own Firebase-hosted leaderboard and the v3 Leaderboards design: one board of everyone's dead, or just yours, so the global board stops being a ghost town.

**Decided by the user (2026-09-28):**

- Backlog 999.13 is promoted with the new Leaderboards UX design (`design/Mazeworld Leaderboards v3.dc.html` and `design/Mazeworld Boards Panel v3.dc.html`) and the DAYS farming note.
- The existing leaderboards and every Play Games hook are removed entirely.
- The board is hosted on Firebase.
- There is no friends scope. It is everyone, or just your own runs, as the mock shows.
- Identity is a rolled @handle over an anonymous Firebase id.
- Research runs only for the server phase.
- The darktierstudios.com delete-data, terms-of-service and privacy/apps pages are updated as needed.

**Gates:**

- **Engine untouched.** This is shell, server, content and tooling work, with zero parity fixtures moved. `test/parity/prototype-master.js.txt` is never edited.
- **Greenfield, no dual paths.** Play Games code is deleted, not gated. Old stored data gets a tolerant load only.
- **No new client SDK.** Firestore and Firebase Auth are reached with plain `fetch` over REST, as `src/browser/bugReport.js` does. Nothing analytics-shaped is added.
- **Offline.** Compete OFF means zero network calls, and YOUR DEAD works in airplane mode.
- **The mock is the UX and visual spec only.** Its iOS frame is preview chrome, and its toy data maps to shipped canon: squares → `steps`, WILMST → `gold`, EXP → `sp`, Roman level. The house rules win: PNG icons, the rail as the one feedback surface, tap-to-move, HP never WP.

## v2.2 Requirements

### DAYS farming check (FARM) — user note, 2026-09-28

- [x] **FARM-01**: A reproducible measurement shows how many DAYS a hero banks by never leaving floor 1 (a scripted floor-1 farmer across seeds and classes: camping, resting, fighting wandering monsters, buying and finding food), compared with the DAYS of honest runs that descend. The numbers are recorded in a doc.
- [x] **FARM-02**: The verdict is recorded with the user. If starvation reliably ends floor-1 farming below an honest run's DAYS, DAYS ranks as the mock says (days, then floor). If it does not, the rule the user picks is recorded, and the server and panel rank DAYS by it.

### Board server (SRV)

- [x] **SRV-01**: Each finished Compete-ON run is stored once as a document in a Firestore run collection in `delve-die-repeat-6ba5f`. It carries the owner id, handle, season, hero name, race, sub-class, class, level, floor, day, steps, kills, gold, sp, cause, epitaph, run hash and app version. Resubmitting the same run never creates a duplicate.
- [x] **SRV-02**: The security rules let an anonymous signed-in player create only runs owned by their own id and shaped exactly as the client builds them, within plausibility bounds. A JS mirror is kept equal to the rules by tests. Anyone may read in bounded pages. Nobody may update. Only the owner, or the admin service account, may delete. Everything else is denied.
- [x] **SRV-03**: For each of the four stats (DEPTH, DAYS, KILLS, WILMST), filtered by race, sub-class, both or neither, within the current season, the board answers three things: the top ten, the total count, and one run's rank. Ties break as the mock sorts them (DEPTH: fewer squares; DAYS and KILLS: deeper floor), and DAYS follows FARM-02. Declared composite indexes back every query.
- [x] **SRV-04**: The game gets an anonymous Firebase identity through the REST API with plain `fetch` (no Firebase SDK), keeps it in durable storage and refreshes its token. With Compete OFF it never creates or refreshes one.
- [x] **SRV-05**: Each install rolls an @handle from family-friendly word tables in `content/`, the way heroes are rolled, and the player can re-roll it. Every handle passes `content/safety-wordlist.js` by construction.
- [x] **SRV-06**: A durable submission queue holds every non-dev Compete-ON death until the server acknowledges it. It survives relaunches and offline play, retries with backoff, never double-submits, and is discarded when Compete turns OFF.
- [x] **SRV-07**: An admin script lists suspicious runs and deletes one run, or every run of one player. Its service-account key never enters the repo or `www/`. An ops runbook covers the rules and index deploys, the console settings, quotas and moderation.
- [x] **SRV-08**: The live project is configured and proven end to end. The rules and indexes are deployed, anonymous sign-in is enabled, and the API key allows only the APIs the game calls. A smoke test creates, reads, ranks and deletes a run against the live project.
- [ ] **SRV-09**: Sending a bug report needs the shared anonymous identity (created on the first send; still zero network until the player taps Send) and is rate-limited per player: the report and a `reportLimits/{uid}` document ({ last, day, count }) are written in one commit, and the rules enforce a 2-minute cooldown and 5 reports a day (named constants in the rules and the JS mirror). The report itself carries no uid. `reportLimits` allows only the owner's own create/update/get. Over a limit, the report sheet keeps the draft and says so in voice. Old builds' plain creates are rejected (accepted, no legacy path). (User, 2026-09-28 — todo 2026-09-28-bug-report-per-player-limit-and-automatic-firestore-cleanup.)
- [x] **SRV-10**: Firebase Auth's per-IP new-account limit is checked and set to about 10 an hour during live setup, and the value is recorded in the runbook.
- [x] **SRV-11**: The bug-report Action deletes reports from Firestore: fully-filed reports right after filing; reports with a trimmed Oracle 30 days after `filedAt` (the issue says "…until <date>"; `oracleTrimmed` recorded at filing); `failed` reports 30 days after `failedAt`; `reportLimits` documents 2 days after `last`; never `new` or `filing` reports; at most 100 deletes a run, oldest first, with index-backed timestamp queries and a dry run. Retention lengths are named constants; the GitHub issues stay.
- [x] **SRV-12**: The bug-report workflow's schedule (`7,19,33,52 * * * *`, four runs an hour, user 2026-09-28) actually fires (a `schedule`-triggered run is seen in `gh run list`), fixed if it never has.

### Leaderboards panel v3 (BOARD) — the mock, `design/Mazeworld Boards Panel v3.dc.html`

- [x] **BOARD-18**: The DEAD tab and the title's VIEW THE DEAD open one Leaderboards panel built to the v3 mock. With Compete ON it opens on LEADERBOARD ("Everyone's dead. Top ten shown."); with Compete OFF it opens on YOUR DEAD ("Compete is off. Only your heroes."). The back button and the title-entry footer (BACK TO TITLE / ROLL A NEW HERO, or BACK TO THE DUNGEON) route as the mock does.
- [x] **BOARD-19**: The header box switches views. On the board it reads "YOURS ›" with your run count; on your view it reads "EVERYONE ›" with the board's total, and back also returns to the board. With Compete OFF it is a static INTERRED count.
- [x] **BOARD-20**: The RANK BY (DEPTH, DAYS, KILLS, WILMST), RACE and SUB-CLASS pickers open bottom sheets. On YOUR DEAD each option shows its local count under the other filter and zero-count options are dimmed; on LEADERBOARD the options carry no counts (user, 2026-09-29: no per-option count queries). A choice re-ranks the list. The board rail and the LEANEST, LINEAGE and GRAVEYARD boards are gone; LINEAGE becomes RACE plus SUB-CLASS on any stat.
- [x] **BOARD-21**: Each row shows the rank, an initials avatar, the handle (the hero's name on YOUR DEAD), a YOU tag on your own runs, the name · race sub-class · level line, and the value with its unit. The leading row wears the stat's colour.
- [x] **BOARD-22**: Tapping a row opens its cause of death, epitaph and six stat chips (FLOOR, DAYS, SQUARES, KILLS, EXP, WILMST), plus a small line with the date the run was recorded and the app version it was played on (user, 2026-09-28: kept for balance tracking). Tapping it again closes it.
- [x] **BOARD-23**: When your best run is outside the top ten, it is pinned under a "NOT IN THE TOP TEN · YOUR BEST" divider with its real rank. The standing card reads "{handle}'s best, of N interred as {race}, {sub-class}." with the ordinal place, or "None of yours on this board yet."
- [x] **BOARD-24**: A filter with no runs shows NOBODY YET, the in-voice note and a CLEAR FILTERS button.
- [x] **BOARD-25**: LEADERBOARD has deliberate in-voice states for loading, offline or unreachable, and a stale cached result (the mock has none). YOUR DEAD never waits on the network.
- [x] **BOARD-26**: YOUR DEAD ranks your runs from local storage by any stat and filter. Every run recorded from now on is kept as a lean per-run record under a generous cap (not just the last 60 graves). **It starts with runs from the 2.1.0 release on (versionCode 11, `when` ≥ 2026-09-28T19:41:01Z, `BACKFILL_SINCE_MS` in `src/browser/runBackfill.js`) and nothing older** (user, 2026-09-28): older graveyard and `ddr.bests.v1` runs and the old lifetime INTERRED total are not imported or shown. The old keys stay on the device untouched (RETIRE-03).
- [x] **BOARD-27**: The LEADERBOARD view names the current season, read from a season-name table in `content/season.js` next to `SEASON`. Season 1, the closed-testing season, is **SEASON OF THE ALPHA** (user, 2026-09-28). At go-live the boards reset: `SEASON` bumps to 2, named "Season 1" (runbook `docs/LEADERBOARDS.md` §10), and the alpha runs stay in Firestore for balance export.

### Account & submission (ACCT)

- [x] **ACCT-03**: The ☰ account block and the title's corner chip show your @handle and the Compete toggle. The ☰ face wears the handle's initials avatar while competing. There is no sign-in, no sign-out and no Play Games wording anywhere.
- [x] **ACCT-04**: Every non-dev Compete-ON death is queued and submitted to our board. Once the board acknowledges it, the death card's "you placed X" line reports the run's DEPTH rank; offline, it reports on the next flush.
- [x] **ACCT-05**: From the ☰ account block the player can erase every run they have on the board, behind a two-tap confirm. Afterwards the board no longer shows them, and a new identity starts on the next Compete-ON run.
- [x] **ACCT-06**: With Compete OFF the game makes zero network calls (no identity, no submission, no board read) and discards any queued runs.

### Play Games removed (RETIRE)

- [x] **RETIRE-01**: The Play Games plugin, the APP_ID meta-data and `games-ids.xml` are gone from the Android build (package.json, cap sync, manifest). Launch makes no Play Games call and shows no sign-in popup.
- [x] **RETIRE-02**: The Play Games modules (the provider, the PGS queue, global boards, score encodings, the score tag, the board IDs) and their tests, copy and docs are deleted or rewritten. A sweep proves no Play Games identifier remains in shipped code.
- [x] **RETIRE-03**: Old stored data loads tolerantly. The old PGS queue, the welcomed flag and any sign-in state are dropped silently on first launch, and the local graveyard and bests are untouched.

### Compliance & close (COMP)

- [x] **COMP-01**: The Data safety answers in `store-listing/LISTING.md` describe our board's data (an anonymous id, the handle, run stats; collected for app functionality; optional through Compete; deletable) and drop Play Games.
- [ ] **COMP-02**: The darktierstudios.com pages `/privacy/apps`, `/privacy/delete-data` and the Delve, Die, Repeat Terms of Service (`C:/projects/darktier-studio`) describe our own leaderboard instead of Play Games: what is sent, who sees it, Compete OFF, erasing your runs, and removal of forged runs. (User, 2026-09-28.)
- [x] **COMP-03**: `docs/PLAY-GAMES-SETUP.md` is retired in favour of the leaderboard-server runbook. The Play Console cleanup (unpublish or delete the Season-1 boards and the Play Games configuration) is a listed user step.
- [x] **COMP-04**: One batched Pixel 7 checklist, `docs/UAT-v2.2.md`, covers the panel, submission, the handle, erasing your runs, and Compete OFF in airplane mode. It runs against one debug APK built after the last code lands.

## Future Requirements

- Replay verification of top runs (seed plus action log) by a scheduled job, the way bug reports are filed.
- Firebase App Check with Play Integrity, which needs a native SDK.
- A season picker for older seasons (the board shows the current season only).
- Achievements (backlog 999.12). Play Games is gone, so they are a local list, or Play Games is re-added for them.

## Out of Scope

- **A FRIENDS scope and our own friends list** (backlog 999.14). The user said on 2026-09-28: "It's either everyone, or just our own stuff."
- **Google Play Games Services**, removed entirely by this milestone.
- **Per-sub-class Play Console boards** (backlog 999.11), superseded by the RACE and SUB-CLASS filters over one run table.
- **Player-typed handles, chat and messaging.** Handles are rolled, so there is no free text to moderate.
- **Accounts, logins and cloud saves.** The anonymous id is invisible to the player.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FARM-01 | Phase 82 | Complete |
| FARM-02 | Phase 82 | Complete |
| SRV-01 | Phase 83 | Complete |
| SRV-02 | Phase 83 | Complete |
| SRV-03 | Phase 83 | Complete |
| SRV-04 | Phase 83 | Complete |
| SRV-05 | Phase 83 | Complete |
| SRV-06 | Phase 83 | Complete |
| SRV-07 | Phase 83 | Complete |
| SRV-08 | Phase 83 | Complete |
| SRV-09 | Phase 83 (live proof: 2.2 release step, Phase 86) | Pending |
| SRV-10 | Phase 83 | Complete |
| SRV-11 | Phase 83 | Complete |
| SRV-12 | Phase 83 | Complete |
| BOARD-18 | Phase 84 | Complete |
| BOARD-19 | Phase 84 | Complete |
| BOARD-20 | Phase 84 | Complete |
| BOARD-21 | Phase 84 | Complete |
| BOARD-22 | Phase 84 | Complete |
| BOARD-23 | Phase 84 | Complete |
| BOARD-24 | Phase 84 | Complete |
| BOARD-25 | Phase 84 | Complete |
| BOARD-26 | Phase 84 | Complete |
| BOARD-27 | Phase 84 | Complete |
| ACCT-03 | Phase 85 | Complete |
| ACCT-04 | Phase 85 | Complete |
| ACCT-05 | Phase 85 | Complete |
| ACCT-06 | Phase 85 | Complete |
| RETIRE-01 | Phase 85 | Complete |
| RETIRE-02 | Phase 85 | Complete |
| RETIRE-03 | Phase 85 | Complete |
| COMP-01 | Phase 86 | Complete |
| COMP-02 | Phase 86 | Pending |
| COMP-03 | Phase 86 | Complete |
| COMP-04 | Phase 86 | Complete |
