# Phase 101: Play Games Achievements Mirror - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning
**Research:** `101-RESEARCH.md`. Its decision table D1–D14 is adopted as written, with the rulings below.

<domain>
## Phase Boundary

When Compete is ON and the player is signed in, Play Games receives:
- every unlock;
- the progress of each incremental achievement, as absolute steps;
- every reveal.

The sync goes through the in-repo `PlayIdentityPlugin` and is driven by a durable ledger derived from the record. Play's own achievements screen opens from the ACHIEVEMENTS sheet.

The Phase 92.1 gate holds: with Compete OFF, the Play SDK never starts. A Play failure never touches the in-game unlock, card or list.

Phase 101 also covers:
- merging the IDs file the user exported from Play Console into the app;
- COMP-05, the disclosure updates.

**IDs are in hand.** The user's real Play Console export is committed as `achievements/games-ids.xml`, with `achievements/games-ids.csv` alongside it. Its `app_id` is 517177834262, and all 77 achievement names resolve. No fixture or placeholder path is needed. PGS-11's full-coverage proof runs against the real file in this phase.

</domain>

<decisions>
## Implementation Decisions

### What the player sees
- **Play's own screen (AUI-04):** a **"VIEW IN PLAY GAMES" button at the top of the ACHIEVEMENTS sheet** (`#mw-achievements-sheet`, from Phase 100).
  - It shows only while Compete is ON and Play sign-in is in.
  - It is not a separate ☰ row. The user ruled this; it amends the roadmap wording "☰ also opens", since it is reached through ☰ → ACHIEVEMENTS.
  - It launches `getAchievementsIntent` through the plugin's `showAchievements`.
- **Backlog (PGS-08):**
  - Unlocks, reveals and progress earned while Compete was OFF, while signed out or while offline **all sync later**, the next time Compete is ON and the player is signed in.
  - Play shows its popups for them in sequence.
  - Turning Compete OFF does not purge anything.
- **Timing:**
  - Unlocks and reveals are sent about **1.5 s** after they happen, so Play's popup lands near the in-game card.
  - Progress is batched about every **60 s**, and is also flushed on app background, on death, on boot or foreground, on coming back online, on Compete turning ON, and on a new Play session.
- **Account switch:** if the Play `playerId` changes, the ledger resets and **everything is resent to the new account**.

### Disclosure (COMP-05)
- Update these to say achievement progress is sent to Play Games while Compete is ON:
  - `store-listing/LISTING.md` (lines ~109–112: the Data safety answers extend the existing "Other actions" row, the "why optional" paragraph and the deletion note);
  - `docs/PLAY-GAMES-SETUP.md` (line ~6);
  - the in-app Compete help (`content/account.js`, `onHelp`): add an achievements clause;
  - the darktierstudios.com privacy page (`C:/projects/darktier-studio`, the privacy apps page around lines 160–163), edited in that repo.
- **The website deploy and submitting the Play Console Data safety form are the user's steps,** shown as checkpoints. Neither blocks this phase.
- **No new Data safety data type.**
- **The deletion note says plainly** that ERASE MY RUNS does not delete achievements held in Play Games.

### Technical defaults (Claude's discretion, per RESEARCH)
- **Incrementals:** all 57 incremental entries are sent as `setStepsImmediate(absolute value clamped to 1..steps)`, never `increment`.
- **Standard entries** use `unlockImmediate`, and reveals use `revealImmediate`.
- **The ledger is derived from the record, not an event queue.** Pending work = `diff(getAchievementRecord(), ledger)`.
  - Key: `ddr.pgsAch.v1`.
  - Contents: acked unlocks, reveals and steps, plus `playerId`, failures and retryAt.
  - It reuses the `runQueue.js` patterns and `backoffMs`.
  - The `achievementEvents` bus (Phase 100) is only a wake-up. Subscribe with `achievementEvents.subscribe`, and never call `setAchievementListener`.
- **Gate order:**
  1. Compete ON. This is checked first, before ANY plugin call, because `status()` starts the SDK.
  2. Record loaded.
  3. Online.
  4. Backoff elapsed.
  5. `status()`: signed out means hold, with no backoff.
  6. Send batches of up to 20 ops, re-checking the gate between batches.
- **Refused ops** (unknown id and the like) are skipped for the session and retried on the next launch, never dropped permanently.
- **Resource file:** replace `android/app/src/main/res/values/games-ids.xml` with the Console export verbatim. Point the manifest or plugin config at `@string/app_id`. The fallback is a separate file plus a drift test.
  - Look ids up natively with `getIdentifier(name, "string", pkg)`. A result of 0 means a no-op, never a crash.
  - The resource name is derived from the catalog name: lowercase, with runs of non-`[a-z0-9]` turned into `_`, and the ends trimmed. No new catalog field.
  - A coverage test proves all 77 resolve, and that `app_id` equals `PLAY_GAMES_CONFIG.appId`.
- **R8 shrinker (mandatory):** add `@string/achievement_*` to `res/raw/keep.xml` (the Phase 80 splash precedent), with a pin. Otherwise the release build strips the names that are looked up.
- **Plugin:** extend `PlayIdentityPlugin` with `syncAchievements` (batch) and `showAchievements` (`startActivityForResult` plus `@ActivityCallback`). Give them their own reason set rather than editing `PLAY_IDENTITY_REASONS`.
  - Update the declared source pins: `dev-build-gate.test.js` (the `ensureInit` count goes from 4 to 6), `android-system-bars.test.js` (the method list), and `playIdentity.test.js` (`game_services_project_id`).
- **Tests:**
  - A Compete OFF proof: a recording fake plugin sees zero calls across every trigger.
  - A test that a mid-flush flip to OFF stops the next batch.
  - Source pins: no `increment`, no hard-coded `CgkI` ids in JS, and only the one existing `setAchievementListener` call.
  - The ID coverage test.
  - Ledger relaunch/dedupe tests.
- **Executors run targeted tests only.** The orchestrator runs the full suite at phase close. No bots.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `android/app/src/main/java/com/darktierstudios/delvedierepeat/PlayIdentityPlugin.java`, `src/browser/playIdentity.js` (`PLAY_IDENTITY_REASONS`), `src/browser/pgsProbe.js`.
- `src/browser/runQueue.js`: the durable queue and backoff pattern.
- `src/browser/achievementBus.js`: `achievementEvents.subscribe`.
- `src/browser/engineAdapter.js`: `getAchievementRecord`.
- `src/browser/achievementTracker.js`: `progressFor`.
- `src/browser/achievementsSheet.js` and the `#mw-achievements-sheet` mount in `mazeworld.html` (Phase 100).
- `achievements/games-ids.xml` and `achievements/games-ids.csv`: the user's real export.
- `android/app/src/main/res/raw/keep.xml`: the shrinker keep list.
- `content/account.js`: the Compete help text (`onHelp`).
- `store-listing/LISTING.md`, `docs/PLAY-GAMES-SETUP.md`.

### Established Patterns
- The Phase 92.1 privacy gate: the Play Games SDK starts only while Compete is ON.
- In-repo native plugin calls through `ensureInit()`.
- Greenfield, tolerant load.

### Integration Points
- The milestone-close device checklist gains these rows:
  - the signed-in Pixel 7 unlock, showing both the in-game card and Play's popup with XP;
  - an airplane-mode round;
  - a Compete OFF round;
  - the release-build shrinker check;
  - a force-stop during a sync.
- Testing draft achievements requires the user's account to be a PGS tester (Play Games Services > Setup and management > Testers). Put this in `docs/ACHIEVEMENTS.md`.

</code_context>

<specifics>
## Specific Ideas
- "VIEW IN PLAY GAMES" is the button label. Its copy is in the house voice and registered with the safety scan and voice corpus.

</specifics>

<deferred>
## Deferred Ideas
- None.

</deferred>
