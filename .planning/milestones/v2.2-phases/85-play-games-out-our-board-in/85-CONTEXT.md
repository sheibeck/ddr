# Phase 85: Play Games Out, Our Board In - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Google Play Games leaves the app entirely, and every non-dev Compete-ON death reaches our Firebase board. The ☰ account block and the title's corner chip carry your @handle, the Compete toggle, re-roll and erase. The death screen's "you placed X" reads from our board. Requirements ACCT-03..ACCT-06 and RETIRE-01..RETIRE-03. Also folds in the captured todo "☰ menu — drop CENTRE MAP, MAKE CAMP first" (user, 2026-09-29).

Builds on Phase 83 (identity, handles, boardWrites, runQueue, runBackfill, boardClient, live board) and Phase 84 (the new panel, the local run history, the board client in the shell). Not this phase: store/policy/website text, the Play Console cleanup, the device checklist (Phase 86).

</domain>

<decisions>
## Implementation Decisions

### The ☰ account block and title chip (group 1)
- **☰ account block = your @handle with its initials avatar (one initial per handle word, Phase 84's rule), then COMPETE ON/OFF, RE-ROLL HANDLE and ERASE MY RUNS.** Re-roll is unlimited and rewrites the handle on all your board runs (`boardWrites.rewriteHandle`; offline it updates the local handle and the rewrite happens on the next Compete-ON flush — Claude's discretion on the exact retry shape). ERASE MY RUNS is a two-tap arm-in-row confirm, like ABANDON THIS CHARACTER (first tap arms "TAP AGAIN TO ERASE", expires, disarms when the menu closes).
- **A handle exists from the first launch.** Roll it on the phone with no network (`identity.ensureHandle()`), show it immediately; the anonymous account is only created when the first run is sent (lazy sign-up, Phase 83).
- **The title's corner chip opens the account sheet** (as today): handle + avatar, COMPETE ON/OFF, RE-ROLL HANDLE, ERASE MY RUNS, SETTINGS. The ☰ face wears the handle's initials avatar while Compete is ON, the plain ☰ when OFF.
- **No sign-in, sign-out or Play Games wording anywhere** (ACCT-03). Copy is in the house voice; `content/account.js` is rewritten; `aria-label="Play Games account"` becomes an account label.
- **☰ menu todo folded in:** remove the CENTRE MAP row (`#mw-chip-centre`) and its wiring (keep `centerMap()`/`window.mzCenterMap` for their other callers); MAKE CAMP becomes the first row under the account block. Resulting order: account block, MAKE CAMP, MARKS, SETTINGS, REPORT A BUG, PATCH NOTES, SAVE & QUIT, ABANDON. Update the tests that pin the row list/order and any focus order. Todo file: `.planning/todos/pending/2026-09-28-menu-drop-centre-map-make-camp-first.md` (move to done when shipped).

### The death screen (group 2)
- **"You placed X" = the run's DEPTH rank on the whole board this season** ("You placed 12th of 340."), from `boardClient.rankOf("deep", deepKey)` + `total("deep")` once the run is acknowledged (ACCT-04). Rewrite `content/placement.js` / `src/browser/placement.js` for our board (drop the Play Games wording).
- **Offline: the deferred card stays.** If the rank arrives while the death screen is open, the line fades in (existing `#cb-over-rank` data-fresh path); otherwise a one-time rail card ("THE LEDGER CAUGHT UP"-style, rewritten) when you are back in the dungeon — same parking/delivery as today.
- **The first-time welcome card is rewritten:** shown once, when your first run reaches the board — it names your @handle, says deaths are public, and says how to turn Compete off. House voice. Replaces "ON THE PUBLIC RECORD / Play Games is watching now…". The "PLAY GAMES DID NOT ANSWER" failed card goes.
- **The "standing" band is removed** (it existed only because Play Games kept each player's best score; every run now has its own rank).

### Compete, erase and old runs (group 3)
- **Compete OFF keeps the identity.** Zero network calls, discard queued runs (`runQueue.purge()`, ACCT-06), but keep `ddr.identity.v1` (handle + account) so turning Compete back on continues as the same @handle. Existing board runs stay up (erase is the way to remove them).
- **After ERASE MY RUNS the next Compete-ON run starts a new board account but keeps the SAME handle** (user choice, overriding the recommendation). Phase 83's `eraseMyRuns` deletes all runs, deletes the anonymous account and then drops `ddr.identity.v1` entirely — Phase 85 must preserve the handle across the erase (e.g. re-seed the identity with the old handle after the drop, or an identity option to drop only the account). Board runs are gone; the handle string may be reused by the new account.
- **Erase is board-only.** YOUR DEAD (the local history) and personal bests stay on the phone.
- **Runs played while Compete was OFF are never uploaded** (user, 2026-09-29, reversing an earlier "ask once" answer): turning Compete back ON sends only runs that finish from then on. No offer, no card, no per-run compete flag in the history. Runs purged from the queue when Compete went OFF are gone for good. (The one-time 2.1.0-cutoff backfill is decided at the first 2.2 launch: Compete ON then → upload once; OFF then → skipped for good. 2.1.0 recorded no per-run Compete state, so the setting at that first launch stands in for it.)
- **Bound the backfill to pre-2.2 runs** (planner finding, orchestrator decision 2026-09-29): Phase 84 keeps writing the old graveyard/bests at death, so 2.2 runs played with Compete OFF would sit there with `when` after the cutoff and `runBackfill` would upload them stamped "2.1.0 (11)" — breaking the never-upload ruling. Fix: the backfill uploads only runs recorded before 2.2 existed — source them from the local history's imported records (version "2.1.0 (11)", Phase 84's one-time import) or cap `when` at the stored first-2.2-launch time; never from graveyard entries written by 2.2.
- **Boot:** call `runBackfill()` once at boot when Compete is ON (the 2.1.0-cutoff board upload, Phase 83 plan 12); flush the queue on resume (`visibilitychange` visible), on `online`, and after enqueue; await pending writes in the native pause path (replacing `pgsQueue.waitForPending`). Dev runs never enqueue (engineAdapter's `state.dev` skip). The version string comes from `#mw-app-version`.

### Play Games removal (RETIRE, locked by requirements)
- Delete the plugin (`@modbender/capacitor-play-games` in package.json/lock; cap sync regenerates capacitor.settings.gradle / capacitor.build.gradle / capacitor.plugins.json), the APP_ID meta-data, `res/values/games-ids.xml`, the proguard keep rule, and the plugin vendoring in `tools/build-www.mjs`. Keep the stock `google-services` template lines (not Play Games) and `appCategory="game"`.
- Delete `src/browser/playGames.js`, `pgsQueue.js`, `globalBoards.js`, `boardScores.js`, `scoreTag.js`, `content/leaderboards.js` and their tests; rewrite `account.js`, `accountChip.js`, `content/account.js`, `placement.js`, `content/placement.js`; fix collateral imports (e.g. reader-fumble-mechanics.test's `TAG_CAUSES`, hp-not-wp / safety-scan `ACCOUNT_COPY`, title-music-shell's pgsQueue listener pin, store-listing.test's "Optional Google Play Games leaderboards" — the listing line itself is Phase 86's, coordinate by updating the test expectation there or leaving the listing text to 86 with the test adjusted), `tools/lib/voice-corpus.mjs` module lists. Remove the dev "Play Games (dev, next launch)" row.
- A sweep test proves no Play Games identifier remains in shipped code (RETIRE-02).
- **Old data (RETIRE-03):** drop `ddr.pgsqueue.v1` silently on first launch; remove `pgsWelcomed` / `pgsDevSignedIn` from `SETTINGS_DEFAULTS` and strip them from the stored settings blob on the next write; keep `compete`. The local graveyard and bests keys stay untouched.

### Claude's Discretion
- Exact copy for the account rows, erase confirm, welcome card, placement lines — house voice, voice-corpus and safety tests.
- How the handle survives erase (identity API shape), and how a re-roll made offline is retried.
- Plan split (removal vs. account UI vs. death wiring), keeping mazeworld.html edits in as few plans as practical.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/firebaseAuth.js` `createIdentity({competeOn, …})` → `snapshot, ensureHandle, rerollHandle, getToken, forceRefresh, deleteAccount, drop`; `src/browser/handles.js` `rollHandle`, `isValidHandle`.
- `src/browser/boardWrites.js` `submitRun`, `rewriteHandle`, `eraseMyRuns`; `src/browser/runQueue.js` `createRunQueue` → `enqueue, enqueueMany, flush, purge, snapshot`; `src/browser/runBackfill.js` `runBackfill`.
- `src/browser/boardClient.js` `rankOf`, `total`; `src/browser/runDoc.js` `deepKey`.
- Existing rail-card parking/delivery (`parkAccountCard`/`flushAccountCard`) and the `#cb-over-rank` fade path for the placement line.

### Established Patterns
- Account controller + three render surfaces (`renderAccountSurfaces`: title chip/sheet, ☰ face, ☰ block) in accountChip.js / mazeworld.html ~8350-8562.
- Death: `engineAdapter.js` ~734-747 → `notifyRunRecorded(summary)` → shell `onRunRecorded` (~8504) → queue. Flush hooks at ~8493-8496; pause path ~9917.
- Settings blob `ddr.settings.v1` via settings.js (`readSettings` merges only SETTINGS_DEFAULTS keys).

### Integration Points
- mazeworld.html imports ~6987-6997, globals ~7351-7354, boards wiring ~7364-7378, `window.__mzPlacement` ~7419 (+ bridge.js ~314), account sheet ~7750-7794, shared identity ~7808-7816 (`competeOn: () => false` "until Phase 85"), PGS/account block ~8350-8562, `account.boot()` ~9893, `waitForPending` ~9917, dev row ~2315, ☰ menu rows ~2489-2505.
- Android: package.json:26, AndroidManifest.xml:46-49, res/values/games-ids.xml, proguard-rules.pro:37-39, tools/build-www.mjs:87-91.

</code_context>

<specifics>
## Specific Ideas

- "You placed 12th of 340." as the canonical line shape.
- ERASE MY RUNS mirrors ABANDON THIS CHARACTER's arm-in-row confirm.

</specifics>

<deferred>
## Deferred Ideas

- Ranking "you placed X" by race/sub-class or by the player's best stat (not chosen; DEPTH overall only).

</deferred>
