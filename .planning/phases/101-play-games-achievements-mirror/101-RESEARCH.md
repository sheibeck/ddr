# Phase 101: Play Games Achievements Mirror - Research

**Researched:** 2026-10-05
**Domain:** Play Games Services v2 (`AchievementsClient`) from an in-repo Capacitor 8 plugin, a durable idempotent sync ledger, the Phase 92.1 Compete privacy gate, Data safety follow-through
**Confidence:** HIGH on API semantics and repo facts (read from the primary reference and the code); MEDIUM on Play Console draft/tester behaviour and popup behaviour (documented loosely; the PGS-11 device check settles them)

## User Constraints

No `101-CONTEXT.md` exists yet (discuss-phase runs after this research). The binding inputs are the roadmap and requirements for this phase, plus project rules:

- PGS-07..11, AUI-04, COMP-05 (REQUIREMENTS.md): mirror unlock, progress and reveal to Play with Compete ON and signed in; durable queue, re-send never double-counts; Compete OFF never starts the SDK and makes zero network calls; Play failure never blocks the in-game achievements; IDs come from the Play Console "Get resources" file by name, never hard-coded in JS; full-coverage test; Pixel 7 device row; Data safety and privacy pages checked.
- Phase 100's `achievementEvents` bus is the only subscription point. Never call `setAchievementListener` (the adapter has one slot; `mazeworld.html` already registers `achievementEvents.publish` in it).
- Project rules (CLAUDE.md and memory): offline-first, no monetization SDKs; rules engine untouched (shell-only phase); greenfield, no legacy paths; targeted tests per plan, full `npm test` once at phase close, bots only at milestone end; no stall watches; the Pixel 7 check is deferred to the milestone-close batch.
- The user already provided the REAL export (`achievements/games-ids.xml`), so no fixture or placeholder path is needed.

## Summary

The Play side is small and well-bounded: 77 achievements = 57 incremental (all `initialState: Revealed`) + 20 standard (12 Revealed, 8 Hidden). Every incremental catalog entry has `steps === threshold`, and every incremental measure the tracker keeps (lifetime counters, single-run bests, Tourist's distinct-set size) is a monotone, absolute number in `ddr.achievements.v1`. That makes `setStepsImmediate(id, absoluteValue)` ("at least N steps"; documented no-op when Play already has more) the correct, naturally idempotent call for ALL 57 incrementals. `increment` is never safe to resend and is never needed. Standard achievements use `unlockImmediate` (which also reveals a hidden one) and `revealImmediate` for the reveal chain. Calling `unlock` on an incremental achievement is a documented failure (`ACHIEVEMENT_UNLOCK_FAILURE` 26560); an incremental unlocks itself when its steps reach the maximum.

The cleanest durable design is not an event queue but a **sync ledger derived from the record**: the pending work is `diff(getAchievementRecord(), ledger)`, where the ledger (`ddr.pgsAch.v1`) stores only what Play has acknowledged (plus backoff state, as `runQueue.js` does). The bus (`achievementEvents`) is just a wake-up. This covers everything in PGS-08 (earned with Compete OFF, signed out, offline, or before the mirror existed), dedupes by construction, survives relaunch, and cannot overflow. The Compete gate is the first line of every flush and sits before ANY plugin call, including `status()` (which starts the SDK).

Three things the roadmap did not foresee: (1) the release build runs R8 resource shrinking, which will strip name-looked-up `achievement_*` strings unless they are added to the existing `res/raw/keep.xml`; (2) two existing source-pin tests count the plugin's methods and `ensureInit();` call sites and must be updated as declared test moves; (3) Google's own Data safety page now lists "Unlocked achievements" under data collected depending on usage, so the "sign-in only, no achievements" statements in LISTING.md, the privacy page (separate `darktier-studio` repo), `docs/PLAY-GAMES-SETUP.md` and the in-app Compete help line become false the moment this phase ships.

**Primary recommendation:** Add two `@PluginMethod`s to `PlayIdentityPlugin` (`syncAchievements` batch, `showAchievements`), a pure `src/browser/playAchievements.js` mirror (ledger + diff + gated flush, `runQueue.js` patterns), subscribe it to `achievementEvents`, send `setStepsImmediate(absolute)` for all incrementals, replace `res/values/games-ids.xml` with the Console export, and keep resources alive with `tools:keep`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decide what to send (diff of record vs ledger), dedupe, backoff, gating | Shell JS (pure module) | Storage (Preferences) | Rules engine stays untouched; the record already is the source of truth; Compete gate is a JS concept (`competeIsOn`) |
| Resolve resource name -> Play ID, call `AchievementsClient`, map errors | Native plugin (`PlayIdentityPlugin`) | Android resources (`games-ids.xml`) | Only native code can reach the SDK; IDs live in resources, never in JS (PGS-10) |
| Start the Play Games SDK | Native (`initSdkOnce`, from MainActivity on Compete-ON launch or the plugin's `ensureInit`) | JS gate decides whether the plugin is ever called | Phase 92.1 gate; unchanged |
| Show Play's own achievements screen | Native (intent via `startActivityForResult` + `@ActivityCallback`) | Shell button (Compete ON and signed in) | Intent must be launched by an Activity result API so Play can identify the caller package |
| Unlock popup and XP | Play Games service (Google process) | -- | Drawn by Play; the game has no popup API in v2 |
| In-game toast, list | Shell (Phase 100) | -- | Stays the source of truth; Play can fail without touching it |
| Data safety / privacy disclosure | Docs (LISTING.md), site repo, in-app help copy | Play Console (user) | COMP-05 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `com.google.android.gms:play-services-games-v2` | 22.1.0 (already in `android/app/build.gradle`) | `PlayGames.getAchievementsClient(activity)` | Already the project's PGS dependency; v2 has no `GamesClient`, so no popup-placement API exists [VERIFIED: developers.google.com/android/reference/.../PlayGames method list] |
| `@capacitor/android` / `@capacitor/core` | 8.5.1 (installed) | `Plugin.startActivityForResult(PluginCall, Intent, String)` + `@ActivityCallback` | Verified in the installed source: `Plugin.java` line 173, registered at plugin load (lines 113-117), `@since 3.0.0`; `proguard-rules.pro` already keeps `@ActivityCallback` methods [VERIFIED: node_modules/@capacitor/android/.../Plugin.java] |

### Supporting
None new. No npm or Gradle package is added by this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend `PlayIdentityPlugin` | A second plugin class | Keeps two source pins untouched but needs a second `registerPlugin`, a second JS seam and a second fake; the roadmap says extend; extend |
| `increment` for lifetime counters | `setSteps` at least | `increment` double-counts on any resend; rejected |
| Fire-and-forget (`unlock`, `setSteps`) | `*Immediate` | Fire-and-forget gives no per-call status, so the ledger cannot acknowledge; Immediate chosen |

**Installation:** nothing to install.

## Package Legitimacy Audit

No external package is installed or added by this phase (`play-services-games-v2` 22.1.0 and Capacitor 8.5.1 are already in the build). Nothing to run through `package-legitimacy check`.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none) | -- | -- | -- |

**Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none.

## 1. PGS v2 AchievementsClient: what each call does

Source for every row unless noted: `AchievementsClient` reference, developers.google.com/android/reference/com/google/android/gms/games/AchievementsClient (page last updated 2025-06-23), fetched and read in full this session [CITED]. `GamesClientStatusCodes`: developers.google.com/android/reference/com/google/android/gms/games/GamesClientStatusCodes [CITED].

| Call | Returns | Semantics (quoted or paraphrased from the reference) |
|------|---------|------------------------------------------------------|
| `unlock(id)` | void | Unlocks for the signed-in player. "If the achievement is hidden this will reveal it to the player." Fire-and-forget: "the update may not be sent to the server until the next sync." |
| `unlockImmediate(id)` | `Task<Void>` | Same, but "will attempt to update the user's achievement on the server immediately. The Task will complete successfully when the server has been updated." |
| `increment(id, n)` | void | "The achievement must be an incremental achievement." Auto-unlocks at max steps; "any further increments will be ignored." `n` must be > 0. Not idempotent. |
| `incrementImmediate(id, n)` | `Task<Boolean>` | Same, immediate; the Boolean says whether it is now unlocked. |
| `setSteps(id, n)` | void | "Sets an achievement to have **at least** the given number of steps completed. Calling this method while the achievement already has more steps than the provided value is a no-op." At max it auto-unlocks and "any further mutation operations will be ignored." `n` must be > 0. |
| `setStepsImmediate(id, n)` | `Task<Boolean>` | Same, immediate; Boolean = now unlocked. |
| `reveal(id)` / `revealImmediate(id)` | void / `Task<Void>` | Reveals a hidden achievement; "no effect" if already visible or already unlocked. |
| `getAchievementsIntent()` | `Task<Intent>` | "The Intent returned from the Task must be invoked with `Activity.startActivityForResult(Intent, int)`, so that the identity of the calling package can be established." May fail with `RemoteException`. |

**Failure codes that matter** (ApiException `getStatusCode()`, `GamesClientStatusCodes`) [CITED]:

| Code | Name | Meaning for us |
|------|------|----------------|
| 26560 | `ACHIEVEMENT_UNLOCK_FAILURE` | "An incremental achievement cannot be unlocked directly" -> we called `unlock` on an incremental. A bug; never retry. |
| 26561 | `ACHIEVEMENT_UNKNOWN` | Id not found (typo, achievement not visible to this account, config not yet published for a non-tester). Hold; retry next launch, not in a loop. |
| 26562 | `ACHIEVEMENT_NOT_INCREMENTAL` | We called `setSteps`/`increment` on a standard one. Console/catalog type mismatch. |
| 26563 | `ACHIEVEMENT_UNLOCKED` | "The incremental achievement was also unlocked when the call was made." Treat as success. |
| 26506 | `NETWORK_ERROR_OPERATION_FAILED` | Offline, or rate-limited: "The operation may be retried later." Backoff, keep pending. |
| 26508 | `APP_MISCONFIGURED` | Credential/APP_ID problem. Hold. |
| 4 | `CommonStatusCodes.SIGN_IN_REQUIRED` | Not signed in. Hold without backoff (same rule as `runQueue` "signin"). [ASSUMED code for the signed-out case; the plugin pre-checks `isAuthenticated()` so it should not occur] |

**Which calls show Play's unlock popup?** The reference says nothing about popups, and v2 removed `GamesClient.setViewForPopups` / `setGravityForPopups` (the v1 `GamesClient` page marks them deprecated; `PlayGames` v2 has no `getGamesClient`) [VERIFIED: PlayGames method list; migration guide]. The popup is drawn by the Play Games service when the achievement transitions to unlocked, for either call form; this is [ASSUMED] and is exactly what the PGS-11 Pixel 7 row proves. Resending an already-unlocked achievement is documented as no effect, so it should not re-pop [ASSUMED].

**Offline / signed out / queueing.** Fire-and-forget calls may be held by the Games service "until the next sync", but nothing documents persistence across a reboot or process death, so the SDK's internal queue must not be relied on. `*Immediate` calls fail offline with 26506 and the Task result tells us whether the server has the write. The quota page confirms that rate limiting also surfaces as `NETWORK_ERROR_OPERATION_FAILED` on `incrementImmediate`-style calls, "which indicates that the library will automatically attempt to make the call again later" (developer.android.com/games/pgs/quota) [CITED]. Signed-out behaviour of the client calls is undocumented [ASSUMED fails]; the plugin must pre-check `isAuthenticated()` and never call the achievements client otherwise.

**Rate limits.** No numeric limit is published; the quality checklist (5.1-5.3) says the Android library combines frequent increments when it detects rate limiting and recommends sending one call per round, not per event (developer.android.com/games/pgs/quality) [CITED]. Our ledger already sends at most one `setSteps` per changed achievement per flush, debounced (section 3). Lifetime ceiling is about 77 unlocks + 57 step values + 8 reveals, so total volume is tiny after the first sync.

**Hidden achievements.** All 57 incrementals are `Revealed`; all 8 Hidden ones are standard (death_falling, ether_entombed, naked_ambition, read_the_label, death_starvation, death_trap, chicken, death_disease). So the question "does increment reveal a hidden one" never arises. `unlock` reveals a hidden one itself; `reveal` is only needed when the in-game record has `revealed` it but not unlocked it (the `reveals` chain: e.g. unlocking depth_t1 reveals death_falling). Reveal-then-unlock order is safe either way.

**`getAchievementsIntent` from a Capacitor plugin.** In the plugin: `getAchievementsIntent().addOnSuccessListener(intent -> startActivityForResult(call, intent, "achievementsClosed"))`, and `@ActivityCallback private void achievementsClosed(PluginCall call, ActivityResult result) { call.resolve(ok) }`. Capacitor registers the launcher at plugin load, so the plugin class must be registered before `super.onCreate` (it already is, `MainActivity`). Use the 3-arg, non-deprecated overload; the int-request-code overload is `@Deprecated`. `MainActivity`'s `configChanges` list prevents recreation on rotation, so the pending call survives [VERIFIED: Plugin.java; MainActivity.java; AndroidManifest.xml]. The task failing (not signed in, `RemoteException`) resolves `{ ok: false, reason }` like every other method (no `call.reject(`; a pinned rule).

## 2. Idempotent choice per trigger type

Measured from `content/achievements.js` and `src/browser/achievementTracker.js` (read this session): all increments are driven by absolute, monotone values in the record.

| Trigger kind (count) | Catalog type | Record measure | Play call | Why safe |
|----------------------|--------------|----------------|-----------|----------|
| `lifetimeCounter` (44: 6 kill groups x4, deaths, joinersAccepted, joinersFallen, parleysWon, trapsSurvived x4) | incremental | `record.counters.*` / `record.kills[group]`, only ever incremented by 1+ | `setStepsImmediate(id, min(value, steps))` | At-least semantics; a resend of the same or a lower number is a no-op |
| `singleRunBest` incremental (12: depth t1-3 + Unicorn, Survivor days x4, Hoarder wilmst x4) | incremental | `record.bests.depth / days / wilmstHeld`, stored as `Math.max` | same | "Best in one run" cannot be expressed as increments at all; set-at-least to the best is exactly right |
| `distinctSetCount` Tourist (1, 24 steps) | incremental | `record.subClassesDelved.length` (distinct, append-only) | same | Set size is monotone |
| `singleRunBest` / `singleRunFlag` / `deathCause` / `lifetimeFlagPair` standard (20) | standard | `record.unlocked[id]` | `unlockImmediate(id)` | Unlock is a one-way state; repeating is "no effect" |
| Reveals | -- | `record.revealed` (Hidden ids only, reveal order) | `revealImmediate(id)` | One-way, no effect if already visible |

Rules for the mirror:

- An incremental already `unlocked` in the record sends `steps` (its full count), not its measure, so a Play-side gap (offline during the final steps) heals and Play unlocks it itself.
- Never send 0 (API requires > 0) and never more than `entry.steps` (the tracker's `progressFor` already clamps; clamp again).
- Never call `unlock` on an incremental and never `setSteps` on a standard one. A pure function `playOpFor(entry, state)` returns the one legal op kind per catalog entry; a test proves it for all 77.
- `increment` / `incrementImmediate` appear nowhere in the code (a source pin).
- The Phase 98 type ruling stands: Console `steps` for each incremental must equal the catalog `steps`. The Console XML export carries IDs only (no steps), so this cannot be re-proved here; Phase 98's matches-catalog check owns it, and the PGS-11 device row confirms one real incremental.

## 3. Durable queue design: the record-derived ledger

### Why not a runQueue-style event queue
`runQueue.js` stores entries because a death summary exists nowhere else. Here the record already holds the full truth (`unlocked`, `revealed`, absolute progress). A second copy of events would duplicate state, can overflow, and would miss anything earned before the mirror shipped or while the bus had no subscriber. Reuse the runQueue *patterns* instead: injected `storage`, `load()` memoized, `persist()` through `trackedWrite`, `waitForPending()`, single-flight `flush()`, `backoffMs(n)` (30 s doubling to 30 min; import it), record-level `failures`/`retryAt`, a "signin" hold with no backoff, `sanitize` on load, never throws.

### Ledger (`ddr.pgsAch.v1`, new key, tolerant load)
```
{ v: 1, player: "<playerId>" | null,
  u: [ids acked unlocked],  r: [ids acked revealed],  s: { id: highest acked steps },
  failures: 0, retryAt: 0 }
```
Only catalog ids are kept on load (anything else dropped), `s` values clamped to `[1, steps]`.

### Pending = pure diff (`pendingOps(record, ledger, catalog)`)
```
for entry of catalog (listOrder):
  standard:  unlocked && !u.has(id)            -> { kind:"unlock" }
             else revealed && !unlocked && !r.has(id) -> { kind:"reveal" }
  incremental: v = unlocked ? steps : progressFor(record, entry).value
             v >= 1 && v > (s[id] ?? 0)          -> { kind:"steps", n: v }
```
Order: reveals, then steps ascending, then unlocks last, so a popup lands after its progress. Batches of at most 20 ops per bridge call; the ledger is persisted after each batch before the next starts.

### Flush gate order (first failing check wins; each returns without touching the plugin)
1. `competeOn() !== true` -> `{ ok:false, reason:"off" }`. **Before any plugin call, including `status()`.**
2. Record not loaded yet (`getAchievementRecord() === null`) -> `"notready"`.
3. `online() !== true` -> `"offline"`.
4. Backoff (`!force && retryAt > now`) -> `"backoff"`.
5. Nothing pending -> `ok`.
6. `playIdentity.status()`: signed out -> `"signin"` hold (no backoff, ledger untouched); error -> transient. Never call `signIn()` from the mirror (interactive sign-in belongs to the account block).
7. If `status.playerId !== ledger.player`: if `ledger.player` was non-null reset `u/r/s` (a different Play account must get the whole record); adopt the id.
8. Send batches; re-check gate 1 and 3 between batches (Compete flipped OFF mid-flush stops at the next batch boundary).
9. Per-op result handling: ok -> record in the ledger; `network` -> stop, failures+1, backoff; `signin` -> stop, hold; `unknown` -> skip that id for the rest of the session (retry next launch); `type`/`config` -> skip that id for the session and surface in a dev log line, never throw. A batch where every op is `config` means the resource file is absent: no-op for the session (PGS-10).

### Triggers
| Trigger | Action | Notes |
|---------|--------|-------|
| Bus event with `unlocks.length > 0` or `reveals.length > 0` | flush after ~1.5 s | the in-game toast lands first, then Play's popup |
| Bus event with progress only | debounce ~60 s, trailing | coalesces a kill spree into one call per achievement |
| Death / run end (`died`) and `visibilitychange` -> hidden | flush now (best effort) | do not await in the native pause path; the ledger resends anyway |
| `visibilitychange` -> visible, `online`, boot after `loadAchievements()` | flush | cheap when nothing is pending: no plugin call happens for an empty diff |
| Compete turned ON (account state change) | flush | covers PGS-08 "earned while OFF" |
| Sign-in completes (`boardSync` `onSession`, any state) | flush | but do not depend on `boardSync`'s "signedIn": that needs Firebase and a network, Play auth does not; the mirror asks `status()` itself |

Place the mirror's `visibilitychange` listener after boardSync's (a test requires boardSync's to stay the first listener).

### What is deliberately NOT done
- Compete OFF does not purge the ledger (it records what Play already has, no personal content). Unlike board runs, achievements earned while OFF DO sync later (PGS-08 says so); that difference is a disclosure point (section 5).
- The mirror never reads the engine, never touches `S`, and is never imported by anything under `tools/` (the Phase 99 bot-isolation walk already guards `tools/`).

## 4. Testing draft achievements with a tester account

[CITED: developer.android.com/games/pgs/console/publish, "Test and publish your game", last updated 2026-06-16]:
- "If your game is in an unpublished state, you must allowlist the user accounts that you want to grant access for testing. Otherwise, your testers will encounter OAuth and 404 errors." "Remember to add yourself as a tester, or the Play Games SDK won't work for your user account."
- Testers: Play Console, Grow users > Play Games Services > Setup and management > Testers > Add testers (comma-separated emails); or enable a release track on the Release tracks tab (needs the Android app linked). Takes "a couple of hours".
- Publishing the PGS configuration (Setup and management > Publishing) is separate from publishing the app; changes take up to 2 hours; publish at least 2 hours before a production rollout. The tester list and tester data are not deleted on publish ("To delete data for testers, use the Play Games Services Management APIs").

For this repo:
- The user's Pixel 7 Google account must be a PGS tester (it already must be, for Compete sign-in per `docs/PLAY-GAMES-SETUP.md` section 2 step 6). Draft achievements imported from the Phase 98 zip are reachable only by testers until the configuration is published [ASSUMED: the docs say "unpublished game", the Console labels per-achievement "Draft"; confirm in the Console when the user does the device round].
- The debug build's SHA-1 matters, but only for **sign-in**: the OAuth Android credential is per package + signing certificate, and `docs/PLAY-GAMES-SETUP.md` step 5 already requires one credential for the Play App Signing key and one for the debug keystore, which "sit side by side". The achievements API adds no new credential. If sign-in works on the debug APK today (Compete), achievements work on it; if the debug SHA-1 credential is missing, `status()` is signed out and the mirror holds forever (silently correct, but the device check fails) [CITED: docs/PLAY-GAMES-SETUP.md lines 63-83].
- A tester's test unlocks persist after publishing. Plan a reset of the user's own account before the milestone UAT if clean state matters (Play Games profile data deletion, or the Management API `achievements.reset`) [CITED: publish page; Management API route ASSUMED].
- Play Console's own publish check (quality checklist) wants at least 10 visible achievements (we have 69 Revealed), unique names, descriptions and icons, all attainable [CITED: developer.android.com/games/pgs/quality, items 2.1-2.5]. Points total 1200 under the 2000 cap (Phase 98 owns this).

## 5. Data safety implications (COMP-05)

Google's PGS data-collection page (developer.android.com/games/pgs/data-collection, last updated 2026-06-16) [CITED] lists, under "Data collected depending on your usage" -> Game Service: "Unlocked achievements, Games scores, Engagement and spend statistics" and "Cumulative data generated by users during gameplay and stored on Google's servers". The existing `store-listing/LISTING.md` lines 109-112 explicitly say this table "does not apply: the game uses Play Games for sign-in only, with no leaderboards, achievements...". That sentence becomes false.

What changes, concretely:

| Surface | Today | Needed |
|---------|-------|--------|
| `store-listing/LISTING.md` line 109-112 | "does not apply ... no achievements" | Say it now applies for unlocked achievements and progress counts; mapped to the existing **App activity -> Other actions** row (the same row the board runs use; Play defines it as in-app activity "such as gameplay", answer/10787469, already cited there) |
| LISTING.md "Other actions" row (line 91) | per finished run, Compete on | add: achievement unlocks, reveals and progress counts (for example 37 of 50) while Compete is on and signed in; purpose App functionality; optional (Compete) |
| LISTING.md "Why optional" (lines 167-173) | "never uploads runs finished while Compete was off" | keep for runs; add that achievements earned while Compete was off wait on the phone and go to Play Games only after Compete is turned ON and the player is signed in |
| LISTING.md deletion bullet (lines 153-166) | ERASE MY RUNS deletes board data and the game account | add: ERASE MY RUNS does not delete Play-side achievements; the player clears them in their Play Games profile (Google's page says users can delete game data there) |
| LISTING.md "Shared" finding | Play Games is Google's own platform (service-provider and user-initiated exemptions) | same finding; achievements go to the same Google-operated service under the player's own account. No new data type, so the Console form types are unchanged; re-read the form at submission (user's step) |
| `docs/PLAY-GAMES-SETUP.md` line 6 | "sign-in only: no Play Games leaderboards, no achievements, no saved games" | rewrite: sign-in and achievements; still no leaderboards (Play-side) or saved games |
| Privacy page `C:/projects/darktier-studio/src/pages/privacy/apps.astro` (lines 160-171, also the header comment lines 11 and 22 meta description, and the "what leaves the phone" list near 200-215) | "We use it for sign-in only: no Google leaderboards, achievements, or saved games" | state achievements are sent to Google Play Games while Compete is on; Compete off sends nothing; deletion route unchanged for Google's side. This is a separate repo (not deployed by this repo; the user commits/deploys) |
| In-app Compete help `content/account.js` `onHelp` ("Every death from here goes on the board ...") | board only | add one clause that achievements go to Play Games too. It is voice-registered text (stale-terms and voice-corpus tests), so it is a planned content edit, not a drive-by |
| `terms.astro`, `delve-die-repeat/index.astro` line 18 ("Compete ... nothing is sent") | board only | check wording; add achievements if they claim what Compete sends |

Unchanged: the Play Games SDK already runs while Compete is ON, so its automatic Gamer Identity / Analytics / Diagnostics rows are unchanged. The mirror makes the SDK's data flow bigger, not new. With Compete turned OFF mid-session the SDK stays alive until the app closes (existing disclosure, `LISTING.md` line 94); the mirror stops calling it immediately, which is stricter than the existing text and consistent with it.

## Architecture Patterns

### System Architecture Diagram

```
 engine action ──> engineAdapter.dispatch ──> tracker fold ──> record (ddr.achievements.v1)
                                                     │              │ (record updated BEFORE notify)
                                                     └─ listener slot (one) ─> achievementEvents.publish
                                                                              │
                                              ┌───────────────────────────────┼──────────────────────────┐
                                              v                               v                          v
                                    banner (Phase 100)            mirror.kick(payload)         (future subscribers)
                                                                              │ (wake-up only; content is re-derived)
   wake-ups: boot, visible, online, Compete ON, onSession, died, hidden ──────┤
                                                                              v
                                   flush(): competeOn? ──no──> { off } (ZERO plugin calls)
                                      │yes
                                      v  record loaded? online? backoff? pending = diff(record, ledger)?
                                      v
                          playIdentity.status() ──signed out──> hold ("signin", no backoff)
                                      │ signed in (playerId; reset ledger if it changed)
                                      v
                    playIdentity.syncAchievements({ ops:[{kind,resource,n}] })   (<= 20 per call)
                                      │ bridge (Capacitor, plain {plugin} wrapper)
                                      v
              PlayIdentityPlugin.syncAchievements: ensureInit(); isAuthenticated?; per op:
                getIdentifier("achievement_x","string",pkg)=0 -> "config"
                getString(id) -> unlockImmediate | revealImmediate | setStepsImmediate
                ApiException code -> "network"|"signin"|"unknown"|"type"|"config"|"error"
                                      v
                       results[] ──> ledger ack (persist per batch) ──> failures/backoff on transient

   ☰ ACHIEVEMENTS sheet ──[VIEW IN PLAY GAMES, only Compete ON && signin "in"]──> playIdentity.showAchievements()
        ──> plugin: getAchievementsIntent ──> startActivityForResult(call, intent, "achievementsClosed")
```

### Recommended file structure
```
src/browser/playAchievements.js        NEW  pure: achievementResourceName, playOpFor, pendingOps, sanitizeLedger,
                                            createAchievementMirror({storage, playIdentity, competeOn, online, now,
                                            getRecord, catalog, log}) -> { kick, flush, onSession, snapshot, waitForPending }
src/browser/playIdentity.js            EDIT add syncAchievements + showAchievements to native seam AND fake
android/.../PlayIdentityPlugin.java    EDIT +syncAchievements, +showAchievements, +@ActivityCallback achievementsClosed
android/app/src/main/res/values/games-ids.xml   REPLACE with the Console export (see below)
android/app/src/main/AndroidManifest.xml        EDIT APP_ID meta-data -> @string/app_id
android/app/src/main/res/raw/keep.xml           EDIT add @string/achievement_*
mazeworld.html                          EDIT (shell executor): create mirror, subscribe to achievementEvents, wake-ups, sheet button
content/account.js                      EDIT onHelp clause (voice-registered)
store-listing/LISTING.md, docs/PLAY-GAMES-SETUP.md, docs/SHELL-MODULES.md  EDIT
test/unit/play-achievements*.test.js    NEW (see Test plan)
```

### Pattern 1: resource name from the catalog (verified against the real export)
`achievement_<name lower-cased, every run of non-[a-z0-9] -> "_", leading/trailing "_" trimmed>`. Verified: all 77 catalog names resolve to a string in `achievements/games-ids.xml`, 0 missing, 0 unused, 0 slug collisions (names with punctuation: "Unicorn!" -> `achievement_unicorn`; "Body Count: Lair Beasts II" -> `achievement_body_count_lair_beasts_ii`) [VERIFIED: node run against content/achievements.js and the export]. The Console's own derivation rule is undocumented, so the **coverage test is the contract**: it fails the day a catalog rename or a re-export diverges.

```js
export const achievementResourceName = (entry) =>
  "achievement_" + String(entry.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
```
Only names cross the bridge. No `CgkI...` id appears in JS, in `www/`, or in any test fixture except the XML itself (a source test greps `src/`, `content/`, `mazeworld.html` for `CgkI`).

### Pattern 2: native lookup by name
```java
int resId = getContext().getResources().getIdentifier(resName, "string", getContext().getPackageName());
if (resId == 0) -> result { ok:false, reason:"config" }      // file absent: no-op, never a crash
String playId = getContext().getString(resId);
```
A generated static Java map was considered and rejected: it forces a compile dependency on every string, defeating PGS-10's "no file means no-op", and needs regeneration on every achievement added (800 spare points are reserved for a later set).

### Pattern 3: the plugin batch (sketch of the contract, not final code)
- `syncAchievements({ ops: [{ kind: "unlock"|"reveal"|"steps", resource: "achievement_x", n?: int }] })` -> `{ ok:true, results:[{ i, ok, reason? }] }` or `{ ok:false, reason:"signin"|"error" }`.
- Order: `ensureInit()` (privacy gate: this line is reachable only because JS called) -> `PlayGames.getGamesSignInClient(getActivity()).isAuthenticated()` -> if not authenticated resolve `{ ok:false, reason:"signin" }` -> run ops **sequentially** (each Task chained from the previous; stop the batch at the first `network`/`signin`).
- Validate on the native side too: kind in the closed set, `resource` matches `^achievement_[a-z0-9_]{1,80}$` (blocks arbitrary resource lookups), `n` between 1 and 10000.
- Error mapping from `ApiException.getStatusCode()`: 26506 -> `network`; 4 -> `signin`; 26561 -> `unknown`; 26560, 26562 -> `type`; 26508 -> `config`; everything else -> `error`. Unknown shapes in JS normalize to `{ ok:false, reason:"error" }` (existing `normalize*` style).
- Never `call.reject(`, never log ids or names, never request scopes (pinned by existing tests).
- `showAchievements()` -> `ensureInit()` -> `getAchievementsIntent` -> `startActivityForResult(call, intent, "achievementsClosed")`; `achievementsClosed` resolves `{ ok:true }` whatever the result code; failure of the Task resolves `{ ok:false, reason }`.

### Pattern 4: games-ids.xml
Recommended: **replace** `android/app/src/main/res/values/games-ids.xml` with the Console export verbatim (Console's own instruction: "Save this file as res/values/games-ids.xml"), and point the manifest meta-data at `@string/app_id` (the export's `app_id` = `517177834262` = `PLAY_GAMES_CONFIG.appId`). That makes every future re-export (new achievements later) a pure drop-in. The export also carries `package_name` and 5 legacy `leaderboard_*` strings; they are unreferenced, harmless, and stripped from the release by the resource shrinker. Declared test moves: `test/unit/playIdentity.test.js` line 267-273 (looks up `game_services_project_id`) now looks up `app_id`; `docs/PLAY-GAMES-SETUP.md` lines 113, 171-176 and `docs/RELEASING.md` line 198, `docs/LEADERBOARDS.md` line 1229 mention the old name. Fallback if the user prefers not to touch the manifest: keep `games-ids.xml` as is and add the filtered `achievement_*` block as a second file `games-achievements.xml` plus a drift test (both are valid; `app_id` must not be duplicated across files in one source set).

### Pattern 5: keep the strings in release builds (R8 resource shrinker)
`app/build.gradle` has `minifyEnabled true` + `shrinkResources true` for release. Resource shrinking cannot see names that arrive from JS at runtime, so unreferenced `achievement_*` strings would vanish from the AAB while the debug APK works: a classic debug-passes/release-fails trap. Docs: "`tools:keep` ... typically because they are referenced in an indirect way at runtime, such as by passing a dynamically generated resource name to `Resources.getIdentifier()` ... You can use the asterisk character as a wildcard" (developer.android.com/studio/write/tool-attributes) [CITED]. The repo already has the precedent (`res/raw/keep.xml` keeps the splash drawables for the same reason, Phase 80). Edit:
```xml
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@drawable/splash_screen,@drawable/splash,@string/achievement_*" />
```
Add a pin to `test/unit/android-r8.test.js` (line 120 area), and put "open Play's list on the release build" in the device row.

### Anti-Patterns to Avoid
- `increment`/`incrementImmediate` anywhere; `unlock` on an incremental; `setSteps(0)`.
- Calling `playIdentity.status()` (or any method) before the Compete check: `status()` runs `ensureInit()` and starts the SDK.
- Gating on `account.state().signin === "in"` for the sync (that is the Firebase board session); gate on Compete and Play auth only. (Use it only for the button's visibility, where "signed in" is the literal requirement.)
- Returning the Capacitor plugin proxy from an async function (the proxy-thenable rule): keep the `{ plugin }` wrapper inside `playIdentity.js`'s existing `invoke`.
- Awaiting Play inside the unlock path of the banner: the mirror is a bus subscriber that returns immediately; the bus already isolates subscriber throws and rejections.
- Persisting Play IDs, names or unlock details in logs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Play's unlock popup | A custom Play-style overlay | Play Games service's own popup | v2 has no popup API; the in-game toast (Phase 100) is the in-game surface |
| Achievements list UI | A mirrored Play list | `getAchievementsIntent` | Play shows XP, suggested row, friends |
| Backoff, single-flight, tracked persistence | New timers/locks | `backoffMs` and the `runQueue.js` structure | Already proven and tested |
| Id lookup | A JS id table | `getIdentifier` + the Console XML | PGS-10 |
| Sign-in flow | A second sign-in path | Existing `PlayIdentity.status()` / account block | One identity seam |

**Key insight:** the dangerous half of this phase is not the Play call, it is the gate and the failure isolation. Everything Play-shaped is behind one `competeOn()` check and one never-throwing module.

## Common Pitfalls

### Pitfall 1: Compete OFF starts the SDK through a "harmless" status call
**What goes wrong:** the mirror (or the new button) calls `playIdentity.status()` to see whether it can sync; `status()` runs `ensureInit()` -> `PlayGamesSdk.initialize`, silently breaking the 92.1 gate on a Compete-OFF session.
**How to avoid:** `competeOn()` is the first statement of `flush`, of `showAchievements` and of any wake-up handler; one `guarded()` wrapper checks it before every plugin call. Test with a recording fake (section "Test plan").
**Warning signs:** a test where the fake's `calls()` is non-empty after a Compete-OFF run.

### Pitfall 2: Release build loses the strings
See Pattern 5. Warning sign: `syncAchievements` returns `config` for every op on the release APK only.

### Pitfall 3: Existing source pins break
`dev-build-gate.test.js:217` pins `ensureInit();` count at 4 ("init, status, signIn and serverAuthCode only") and `android-system-bars.test.js:229` pins the method list to `["buildInfo","init","status","signIn","serverAuthCode"]` and "no `call.reject(`"; `playIdentity.test.js:94` pins `PLAY_IDENTITY_REASONS` to four values; `playIdentity.test.js:267` pins `game_services_project_id`. The plan must list these as declared test updates (count 4 -> 6; add the two methods; keep `buildInfo` banned from `ensureInit`; keep the reasons set and give the new methods their own closed reason set `PLAY_ACHIEVEMENT_REASONS`).

### Pitfall 4: Compete ON, Firebase offline
The board session reports `offline`/`error`, but Play auth works. A mirror hooked only to `onSession "signedIn"` would never sync on a plane-mode-then-wifi-without-Firebase day. Ask `status()` yourself.

### Pitfall 5: A different Play account on the same phone
The record is the device's lifetime record; a second Play account would be treated as already-synced by an unscoped ledger. Store `player` in the ledger and reset on change (section 3, step 7).

### Pitfall 6: First sync floods popups
A player with a long Compete-OFF history gets dozens of popups at once. Sequential Immediate calls serialize them; it is also a rare path. Accept, do not engineer around it (decision D5).

### Pitfall 7: Draft/unpublished configuration looks like a bug
Non-testers get sign-in failures or `ACHIEVEMENT_UNKNOWN`. The mirror holds (no loop, retry at next launch); the real fix is publishing the PGS configuration 2+ hours before the release rollout (existing `docs/PLAY-GAMES-SETUP.md` section 8).

### Pitfall 8: Activity result plumbing
Using `Activity.startActivityForResult` directly (or the deprecated 3-int overload) from the plugin can lose the call after process death; use `Plugin.startActivityForResult(call, intent, "callbackName")` with an `@ActivityCallback` method (Capacitor's own comment on the deprecated overload says why).

### Pitfall 9: Mid-session Compete OFF
The SDK stays alive until the app closes (existing disclosure). The mirror must stop sending at once: check the gate between batches, and drop any scheduled debounce on Compete OFF.

## Code Examples

### Gate-first guarded call (JS, sketch)
```js
async function guarded(method, args) {
  if (competeOn() !== true) return OFF;               // zero plugin calls, zero SDK start
  try { return await playIdentity[method](args); }    // fake or native seam; never rejects
  catch { return ERROR; }
}
```

### Plugin op dispatch (Java, sketch of the one-op call)
```java
AchievementsClient c = PlayGames.getAchievementsClient(getActivity());
switch (kind) {
  case "unlock": return c.unlockImmediate(playId);                 // Task<Void>
  case "reveal": return c.revealImmediate(playId);                 // Task<Void>
  case "steps":  return c.setStepsImmediate(playId, n);            // Task<Boolean>, "at least"
}
```
Source: AchievementsClient reference [CITED].

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `GamesClient.setViewForPopups` / `setGravityForPopups` (v1) | v2 has no popup API; Play draws the popup | Nothing to configure; the popup is verified on the device, not coded |
| `GoogleSignIn` + `Games.getAchievementsClient(ctx, account)` | `PlayGames.getAchievementsClient(activity)` after `GamesSignInClient.isAuthenticated()` | We already use the v2 sign-in client |

**Deprecated/outdated:** `GamesClient` (v1) and any `GoogleSignIn` flow: not used here.

## Environment Availability

Not probed (research only; another executor is editing the shell and builds are the executor's job).

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Pixel 7 + adb (re-pair recipe in memory) | PGS-11 device row | assumed | deferred to the milestone-close batch |
| Play Console access, PGS testers list containing the user's Pixel account | draft-achievement test | user step | confirm the account is already a tester (Compete sign-in needs it) |
| Debug-keystore SHA-1 OAuth credential | sign-in on the debug APK | per `PLAY-GAMES-SETUP.md` step 5 | already required by Compete |
| Android Studio / Gradle / JDK 21 | native compile | present per `gradle.properties` | build-only steps skip the full suite (memory) |

## Test plan (Validation Architecture skipped: `workflow.nyquist_validation` is `false`)

All targeted; full suite once at phase close (project rule). Suggested files:

1. `test/unit/play-achievements.test.js` (pure module, no DOM):
   - `achievementResourceName` for all 77; **coverage**: every catalog entry's resource exists in BOTH `achievements/games-ids.xml` and `android/app/src/main/res/values/games-ids.xml` (parse `<string name=...>`), values non-empty and unique, and `app_id` equals `PLAY_GAMES_CONFIG.appId` (PGS-11).
   - `playOpFor`: exactly one legal op kind per entry; never `unlock` for incremental, never `steps` for standard; steps within `[1, entry.steps]`.
   - `pendingOps`: empty record -> none; unlocked standard -> unlock; unlocked incremental -> full steps; revealed-not-unlocked hidden -> reveal; ledger-acked items excluded; resend after a crash between ack and persist yields the same op (idempotent).
   - Ledger `sanitize` tolerance (garbage, unknown ids dropped, clamping).
2. `test/unit/play-achievements-flush.test.js` (fake `playIdentity`, fake storage, injected clock):
   - **Compete OFF -> zero SDK calls**: drive bus publishes with unlocks, `kick`, `flush({force:true})`, `onSession`, visibility/online wake-ups and the show-achievements handler; assert the fake's `calls()` is `[]` (so no `status`, no `init`, no `signIn`, no sync) and storage was not written by the mirror.
   - Compete flips OFF between batches: the next batch is not sent.
   - Signed out holds without backoff; `network` backs off with `backoffMs`; `unknown` skipped for the session; all-`config` is a no-op.
   - Ledger persists per batch, survives a "relaunch" (new mirror over the same storage) and does not resend acked ops; a changed `playerId` resets the ledger; a rejecting/garbage plugin never rejects `flush` and never touches the banner (publish with both subscribers; the banner still fires).
   - Offline-earned achievements sync after Compete ON + signed in (PGS-08), proven end-to-end through the adapter's real record where practical (`engineAdapter` tests already drive real unlocks).
3. Source pins (`test/unit/play-achievements-source.test.js`, in the style of `android-system-bars.test.js`):
   - Java: every `@PluginMethod` except `buildInfo` calls `ensureInit();` (count now 6); `PlayGamesSdk.initialize(` still occurs once; `MainActivity` gate unchanged; the plugin uses only `unlockImmediate`, `revealImmediate`, `setStepsImmediate` and `getAchievementsIntent`, never `increment`, `.unlock(`, `setSteps(`; no `call.reject(`; no `Log.`; uses `startActivityForResult(call,` with an `@ActivityCallback`; resource names validated by regex.
   - JS: the mirror never imports `engineAdapter`, `firestoreRest`, `boardClient` or any fetch; `mazeworld.html` calls `syncAchievements`/`showAchievements` only through the mirror/handler; no `setAchievementListener(` outside the existing registration; no `CgkI` in `src/`, `content/`, `mazeworld.html`.
   - `keep.xml` contains `@string/achievement_*`; no `increment` anywhere in `src/browser/playAchievements.js` or the plugin.
4. `playIdentity.test.js`: normalizers for the two new methods (unknown shapes -> `{ok:false, reason:"error"}`), fake parity (same method set, records calls).
5. Shell test (existing style, e.g. `shell-account.test.js`): the sheet button is hidden unless Compete ON and `signin === "in"`; tapping it calls the mirror's show path only then.
6. Declared updates to the pinned tests listed in Pitfall 3.
7. Device row for the milestone-close Pixel 7 batch (PGS-11): signed in, tester account, Compete ON: earn one standard unlock (toast then Play popup, XP visible in the Play Games profile), an incremental step, a reveal; airplane mode, earn, reconnect, confirm sync and no popup storm; Compete OFF, earn, confirm nothing sent (adb logcat shows no Games calls), turn ON, confirm sync; open Play's list from the sheet on both the debug APK and a release build (the shrinker check); force-stop mid-sync and relaunch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Play's unlock popup appears for `unlockImmediate`/auto-unlock via `setStepsImmediate` the same as fire-and-forget | 1 | Medium: the device row would show no popup; fallback is to try the non-Immediate variants (a one-line change) |
| A2 | Resending an already-unlocked achievement does not re-show the popup | 1 | Low: only matters after a crash between ack and persist |
| A3 | A signed-out client call fails (code `SIGN_IN_REQUIRED` or similar) | 1 | Low: the plugin pre-checks `isAuthenticated()` |
| A4 | Draft achievements are usable only by PGS testers until the configuration is published | 4 | Medium: if drafts are unusable even by testers the test needs a publish first |
| A5 | Tester unlock data survives publishing and can be reset through the Management API / profile data deletion | 4 | Low: affects UAT cleanliness only |
| A6 | Achievement sync maps to Data safety "App activity -> Other actions" and is not newly "shared" | 5 | Medium: the user may choose a different category; Console form is the user's step |
| A7 | The Console's slug rule continues to equal lower-case, non-alphanumeric -> `_`, trimmed | Pattern 1 | Low: the coverage test fails loudly on divergence |
| A8 | Play's per-achievement step limit allows up to 10000 (Hoarder) | 2 | Low: Phase 98's import already accepted it (steps-rules in its checks: 1 to 10000) |

## Open Questions (decisions for discuss-phase, with recommended answers)

1. **D1 Incremental call:** `setStepsImmediate(absolute)` for all 57, never `increment`. Recommend: yes (section 2).
2. **D2 Immediate vs fire-and-forget:** Immediate everywhere. Recommend: Immediate, so the ledger can acknowledge; fall back per A1 only if the popup misbehaves on device.
3. **D3 Queue shape:** record-derived ledger (`ddr.pgsAch.v1`), not an event queue. Recommend: ledger.
4. **D4 Flush triggers and timing:** unlock/reveal ~1.5 s; progress debounce ~60 s; plus boot, visible, online, hidden, died, Compete ON, `onSession`. Recommend as tabled.
5. **D5 Backlog behaviour:** achievements earned with Compete OFF or signed out all sync later, popups included (PGS-08). Recommend: accept; sequential sends.
6. **D6 Resource file:** replace `games-ids.xml` with the Console export and point the manifest at `@string/app_id`. Recommend: yes (fallback: separate `games-achievements.xml`).
7. **D7 Id mapping:** derive the resource name from the catalog name; coverage test is the contract. Recommend: yes; no new catalog field.
8. **D8 Where Play's screen opens (AUI-04):** a "VIEW IN PLAY GAMES" button in the ☰ ACHIEVEMENTS sheet, shown only with Compete ON and `signin === "in"`, hidden otherwise, voice-registered copy. Recommend: sheet button, not another ☰ row (the dropdown and the account block are already full).
9. **D9 In-app disclosure:** extend `onHelp` with one achievements clause. Recommend: yes.
10. **D10 COMP-05 scope:** LISTING.md, `PLAY-GAMES-SETUP.md`, in-app help, and the `darktier-studio` privacy page (separate repo, user deploys). Console Data safety types unchanged; user re-checks at submission. Recommend: all four.
11. **D11 Account switch:** reset the ledger when the Play player id changes. Recommend: yes.
12. **D12 Unknown/refused ops:** skip for the session, retry next launch, never drop permanently. Recommend: yes.
13. **D13 Plugin placement:** extend `PlayIdentityPlugin` (two new `@PluginMethod`s), update the two pins. Recommend: extend.
14. **D14 Who flips the release strings:** `keep.xml` gets `@string/achievement_*` in this phase, with a pin. Recommend: yes, not optional.

## Sources

### Primary (HIGH confidence)
- developers.google.com/android/reference/com/google/android/gms/games/AchievementsClient (read in full; method semantics quoted above)
- developers.google.com/android/reference/com/google/android/gms/games/GamesClientStatusCodes (codes 26504-26563)
- developers.google.com/android/reference/com/google/android/gms/games/PlayGames (v2 client list; no `GamesClient`) and `.../GamesClient` (v1 popup methods deprecated)
- developer.android.com/games/pgs/android/achievements (unlock/increment/intent samples; "automatically unlocks at the required steps")
- developer.android.com/games/pgs/quota ("Detect rate limiting": `NETWORK_ERROR_OPERATION_FAILED`, library retries) and /games/pgs/quality (items 2.x, 5.1-5.3)
- developer.android.com/games/pgs/console/publish (testers, publishing, 2-hour delay)
- developer.android.com/games/pgs/data-collection (automatic vs usage-dependent collection, "Unlocked achievements")
- developer.android.com/studio/write/tool-attributes (`tools:keep`, `shrinkMode`, `getIdentifier`)
- Repo, read this session: `PlayIdentityPlugin.java`, `MainActivity.java`, `AndroidManifest.xml`, `build.gradle`, `res/raw/keep.xml`, `proguard-rules.pro`, `playIdentity.js`, `runQueue.js`, `boardSync.js`, `accountChip.js`, `account.js`, `achievementTracker.js`, `achievementRecord.js`, `engineAdapter.js` (apply order), `content/achievements.js` (dumped), `achievements/games-ids.xml`/`.csv`, `store-listing/LISTING.md`, `docs/PLAY-GAMES-SETUP.md`, `node_modules/@capacitor/android/.../Plugin.java` (8.5.1), the 99-03 and 100-01 summaries, and the existing source-pin tests named in Pitfall 3.

### Secondary (MEDIUM confidence)
- docs.flutter.dev/cookbook/games/achievements-leaderboard (the "Get resources" -> Android (XML) -> `res/values/games-ids.xml` flow, corroborated by the real export's own header comment)
- bitrise / community write-ups on `tools:keep` with `getIdentifier` (corroborate the official page)

### Tertiary (LOW confidence)
- Popup behaviour for Immediate vs fire-and-forget, signed-out status code, draft-achievement visibility to testers (A1, A3, A4): settled by the device row, not by documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new; versions read from the repo.
- Architecture: HIGH for call semantics and idempotency (primary reference plus the tracker's own monotone measures); MEDIUM for popup and draft behaviour.
- Pitfalls: HIGH, each traced to a file and line in this repo or a documented API contract.

**Research date:** 2026-10-05
**Valid until:** 2026-11-05 (Play Console UI and PGS docs move; re-read the data-collection page at each release, as LISTING.md already says)
