---
phase: 67-play-games-integration-account-chip
plan: 02
subsystem: browser-shell / identity
status: complete
tags: [play-games, settings, provider-seam, runbook, PGS-01, PGS-02]
requires: []
provides:
  - "SETTINGS_DEFAULTS.compete / .pgsWelcomed / .pgsDevSignedIn (true / false / false) in ddr.settings.v1"
  - "src/browser/playGames.js: PROVIDER_METHODS, RESERVED_LEADERBOARD_METHODS, FAKE_PLAYER, createPlayGames, createFakePlayGames"
  - "docs/PLAY-GAMES-SETUP.md: the D-16 Play Console runbook plus the Phase 68 engineering notes"
affects: [67-06, 67-07, 67-08, 68]
tech-stack:
  added: []
  patterns:
    - "Injected lazy loader (createPlayGames({ loadPlugin })) in place of a globalThis import-override hook"
    - "Plain wrapper { PlayGames } so the Capacitor proxy is never adopted as a thenable"
    - "Memoized load/initialize promises that clear themselves on rejection (retry on next call)"
key-files:
  created:
    - src/browser/playGames.js
    - test/unit/playGames.test.js
    - docs/PLAY-GAMES-SETUP.md
    - test/unit/play-games-runbook.test.js
  modified:
    - src/browser/settings.js
    - test/unit/settings.test.js
    - test/unit/shell-gear-toolbar.test.js
decisions:
  - "The Play Games provider takes an injected loader instead of a globalThis override hook, so it adds no __mz bridge name"
  - "Provider results are frozen objects; the fake provider normalizes a custom player to a frozen { id, displayName }"
  - "The runbook's APP_ID resource is game_services_project_id (per the plan), not games_app_id (the research sketch)"
metrics:
  duration: "~25 min"
  completed: 2026-09-23
  tasks: 3
  files: 7
---

# Phase 67 Plan 02: Play Games identity foundation Summary

This plan adds the identity layer the later Phase 67 plans build on. Three new settings fields (Compete, the first-sign-in flag and the dev simulate-signed-in flag) now persist in `ddr.settings.v1`. `src/browser/playGames.js` adds a provider seam with two implementations. The native one loads the plugin lazily on the first method call and never rejects. The in-memory fake serves tests and the browser dev loop. Both return an identity with only `{ id, displayName }`. `docs/PLAY-GAMES-SETUP.md` is the Play Console runbook, with the D-14, D-18 and D-19 notes carried to Phase 68.

## What shipped

**Task 1: settings.js.** Three fields appended after `dressing`, in order:
- `compete: true` (D-01, D-02)
- `pgsWelcomed: false` (D-04)
- `pgsDevSignedIn: false` (D-12)

Each is validated as `[true, false]`. An old five-key blob reads the defaults with no migration. Invalid values are rejected on write and fall back to the default on read. The header comment now says eight fields and has one line per new field.

**Task 2: src/browser/playGames.js.**
- `PROVIDER_METHODS`: `init`, `isAuthenticated`, `signIn`, `getPlayer`.
- `RESERVED_LEADERBOARD_METHODS`: the five Phase 68 plugin calls, carrying D-14, D-18 and D-19.
- `FAKE_PLAYER`: `{ id: "fake-player", displayName: "Dev Delver" }`.
- `createPlayGames({ loadPlugin })`: the only `import("@modbender/capacitor-play-games")` in the code is its default loader, and nothing reaches it until a method is called. Load and `initialize()` each run at most once per provider, and a failure clears the stored promise so the next call retries. `init()` calls `signIn({ silent: true })` and `signIn()` calls `signIn({ silent: false })`. When sign-in succeeds without a player, the provider calls `getPlayer()` once. Every method catches everything: failures come back as `{ signedIn: false, player: null }`, `false` or `null`.
- `createFakePlayGames({ signedIn, player, interactive })`: in memory, with `"accept"` or `"decline"` for the interactive sign-in and a frozen `calls()` log.
- Neither provider has a sign-out method or any leaderboard method. The module uses no window, document, `__mz` or network API.

**Task 3: docs/PLAY-GAMES-SETUP.md.** Eight sections:
1. What this is, and how sign-in fails gracefully until setup is done (D-15).
2. Enabling PGS.
3. The Play App Signing key's SHA-1, with why the upload key's never matches, plus an optional debug-keystore credential.
4. The APP_ID and where it goes: `game_services_project_id` in `games-ids.xml`, then a rebuild.
5. The Testers allow-list.
6. What Phase 69 completes: five boards per season, a score and sort table, the 70-board cap and 14 seasons, publishing, Data Safety.
7. The Phase 68 engineering notes: the 64-character tag layout, name truncation, no epitaph, LINEAGE sampling, and why the durable queue is still needed.
8. How to check it worked.

`test/unit/play-games-runbook.test.js` checks that the doc contains the required facts and never uses the old working title.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 (RED) | a4485e9 | test(67-02): add failing tests for compete, pgsWelcomed, pgsDevSignedIn settings |
| 1 (GREEN) | af47891 | feat(67-02): persist compete, pgsWelcomed and pgsDevSignedIn settings |
| 2 (RED) | fafb1bd | test(67-02): add failing tests for the Play Games provider seam |
| 2 (GREEN) | 66563c3 | feat(67-02): add the Play Games provider seam (native + fake) |
| 3 | 8abee1c | docs(67-02): add the Play Games Services console runbook |

## Verification

- `node --test test/unit/settings.test.js test/unit/sfx-settings.test.js test/unit/shell-gear-toolbar.test.js`: 49/49 pass.
- `node --test test/unit/playGames.test.js`: 30/30 pass. Together with `bridge-registry.test.js` and `stale-terms.test.js`: 45/45 pass, so there is no new bridge name and no retired term.
- `node --test test/unit/play-games-runbook.test.js`: 18/18 pass.
- `npm test`: 4521 tests, 4514 pass, 7 fail. All 7 are the known worktree CRLF doc-ledger failures (class-pass-ledger / flee-ledger), which also fail on master. No new failures.
- Acceptance greps: each of `compete: true`, `pgsWelcomed: false` and `pgsDevSignedIn: false` appears exactly once. `export function createPlayGames` and `export function createFakePlayGames` each appear exactly once. `RESERVED_LEADERBOARD_METHODS` is present. `Play App Signing` and `game_services_project_id` each appear at least once in the runbook.

## TDD Gate Compliance

Tasks 1 and 2 each have a `test(...)` RED commit followed by a `feat(...)` GREEN commit. Neither needed a refactor commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the key-order pin in test/unit/shell-gear-toolbar.test.js**
- **Found during:** Task 1
- **Issue:** This test (outside the plan's files_modified) pins `Object.keys(SETTINGS_DEFAULTS)` to the five-key list. Task 1's own verify command runs it, and it would have failed once the three new fields landed.
- **Fix:** I added `compete`, `pgsWelcomed` and `pgsDevSignedIn` to that pin with a Phase 67 comment and retitled the test "exactly 8 fields". It is a three-line change inside one test, so the risk of a merge conflict with 67-05 (which edits the shell, not this test) is low.
- **Files modified:** test/unit/shell-gear-toolbar.test.js
- **Commit:** a4485e9

## Deferred / notes for later plans

- **67-06:** `src/browser/playGames.js`'s default loader imports `@modbender/capacitor-play-games` by its bare name. The import map / `tools/build-www.mjs` vendoring must resolve that name on native and in the browser, or the native provider resolves signed out every time. That outcome is graceful but useless. The runbook names the string resource `game_services_project_id` in `android/app/src/main/res/values/games-ids.xml`, with the placeholder `000000000000`. 67-06 must use that name. If it uses another, update the runbook and its test.
- **67-07 / 67-08:** the controller reads `compete`, `pgsWelcomed` and `pgsDevSignedIn` through `readSettings()` and writes them with `writeSetting()`. `createFakePlayGames({ signedIn: settings.pgsDevSignedIn })` is the browser dev-loop seed.
- **Laziness vs D-20:** the provider never loads the plugin module unless called, but the plugin's native `load()` still initializes Google's SDK at app start (D-20). The laziness covers the JS side only, and the module header says so.

## Known Stubs

None. The native provider is fully wired, and it resolves signed out until 67-06 installs the plugin.

## Threat Flags

None. The module adds no network API, DOM access or bridge name. The only external surface is the plugin's sign-in and identity calls, which the plan's threat notes already cover.

## Human verification (deferred to end of run)

For the Phase 69 batch (`docs/UAT-v2.0.md`); do not pause for a device:

1. Walk `docs/PLAY-GAMES-SETUP.md` end to end in Play Console and confirm each menu path still exists. If a path has moved, note its current name:
   - Play Games Services → Setup and management → Configuration
   - Credentials → Add credential (Android)
   - Test and release → Setup → App signing → App signing key certificate (SHA-1)
   - where the numeric application ID appears on the Configuration page
   - Setup and management → Testers
2. Confirm the debug-keystore `keytool` command prints a SHA-1 on this machine. This only matters if you plan to test sign-in on a locally built debug APK.
3. After the APP_ID is pasted in and the app is rebuilt, a tester account on a Play-installed build should see its initials on the account chip, and the Leaderboards identity strip should read PLAY GAMES · SIGNED IN. This part depends on 67-06..67-08.

## Self-Check: PASSED

- FOUND: src/browser/playGames.js, test/unit/playGames.test.js, docs/PLAY-GAMES-SETUP.md, test/unit/play-games-runbook.test.js, src/browser/settings.js
- FOUND commits: a4485e9, af47891, fafb1bd, 66563c3, 8abee1c
