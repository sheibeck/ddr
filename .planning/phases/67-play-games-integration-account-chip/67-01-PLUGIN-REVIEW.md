# 67-01 Plugin review: @modbender/capacitor-play-games@0.5.0

Read-only intake review of the published tarball, per D-17 (exact-version
intake, one review before install) and D-13 (toolchain fit, no ads or
analytics). Reviewed 2026-09-23. The tarball was fetched with `npm pack` into
a scratch directory outside the repo, extracted there, read, then deleted.
Nothing in the repo was installed, vendored or wired: package.json,
package-lock.json, node_modules and android/ are untouched by this plan
(67-06 installs).

Citations below are `file:line` inside the extracted `package/` directory.

## Identity and integrity

| Item | Value |
|---|---|
| Name | `@modbender/capacitor-play-games` |
| Version | 0.5.0 |
| License | MIT (`package.json`, `LICENSE`; README: "© Idle Flow Games (original), © modbender (fork)") |
| Publish time (`time.modified`) | 2026-09-12T18:10:09.180Z |
| Tarball URL | https://registry.npmjs.org/@modbender/capacitor-play-games/-/capacitor-play-games-0.5.0.tgz |
| Registry integrity (`npm view dist.integrity`) | `sha512-GJ7gzDQICQxzPIzKejqYnG9HXnL2/lq5CenHPeDaedkbaYf2hZndj1Xx+F4TtE0PLHp1Da2Ku5W/AMTw5Znb3w==` |
| Computed integrity of the packed .tgz | `sha512-GJ7gzDQICQxzPIzKejqYnG9HXnL2/lq5CenHPeDaedkbaYf2hZndj1Xx+F4TtE0PLHp1Da2Ku5W/AMTw5Znb3w==` |
| Integrity match | **yes** |
| npm shasum (sha1) | `ec37de06d47cf0e02d3e8309cdd1942386610b78` |
| sha256 of `android/src/main/java/com/idleflowgames/playgames/PlayGamesPlugin.kt` | `0023e880027c8b8160676485ef40655623c3bfdce095ac2754319bed82d7b7ec` |
| Size | 48.9 kB packed, 228.1 kB unpacked, 36 files |
| Provenance | README "About this fork" (README.md:8-20): a fork of `@idleflowgames/capacitor-play-games` 0.2.1. The upstream GitHub repo returned 404 on 2026-09-08; the Kotlin and Gradle files were recovered byte-for-byte from the upstream npm tarball and the TypeScript was reconstructed from its `dist/`. The Kotlin package name `com.idleflowgames.playgames` is kept on purpose. |

Tarball file list (36 files):

```
package/CHANGELOG.md                    package/dist/esm/web.d.ts
package/LICENSE                         package/dist/esm/web.d.ts.map
package/README.md                       package/dist/esm/web.js
package/package.json                    package/dist/esm/web.js.map
package/android/build.gradle            package/dist/plugin.cjs.js
package/android/consumer-rules.pro      package/dist/plugin.cjs.js.map
package/android/proguard-rules.pro      package/dist/plugin.js
package/android/src/main/AndroidManifest.xml
package/android/src/main/java/com/idleflowgames/playgames/AchievementsModule.kt
package/android/src/main/java/com/idleflowgames/playgames/EventsModule.kt
package/android/src/main/java/com/idleflowgames/playgames/GameStatsModule.kt
package/android/src/main/java/com/idleflowgames/playgames/LeaderboardsModule.kt
package/android/src/main/java/com/idleflowgames/playgames/Pgs.kt
package/android/src/main/java/com/idleflowgames/playgames/PgsEnums.kt
package/android/src/main/java/com/idleflowgames/playgames/PlayGamesPlugin.kt
package/android/src/main/java/com/idleflowgames/playgames/PlayersModule.kt
package/android/src/main/java/com/idleflowgames/playgames/PlayerStatsModule.kt
package/android/src/main/java/com/idleflowgames/playgames/RecallModule.kt
package/android/src/main/java/com/idleflowgames/playgames/SavedGamesModule.kt
package/android/src/main/java/com/idleflowgames/playgames/SignInModule.kt
package/dist/esm/definitions.d.ts       package/dist/esm/index.d.ts
package/dist/esm/definitions.d.ts.map   package/dist/esm/index.d.ts.map
package/dist/esm/definitions.js         package/dist/esm/index.js
package/dist/esm/definitions.js.map     package/dist/esm/index.js.map
package/dist/plugin.js.map
```

No iOS sources ship (the README mentions Swift/podspec from upstream, but none
is in this tarball). That is irrelevant to an Android-only app.

## Install surface

| Item | Finding |
|---|---|
| Lifecycle scripts | **None.** `scripts` holds only `clean`, `build`, `docgen`, `check-docs`, `typecheck`, `verify`, `prepublishOnly` (package.json). No `preinstall`, `install`, `postinstall` or `prepare`. `prepublishOnly` runs only on the author's publish, never on a consumer install. |
| Runtime `dependencies` | **None.** |
| `peerDependencies` | `@capacitor/core: ^8.0.0` (the project is on Capacitor 8.5.x). |
| `devDependencies` | Build tooling only (`@capacitor/cli`, `@capacitor/core`, `@capacitor/docgen`, `rimraf`, `rollup`, `typescript`); not installed for consumers. |
| `engines` | `node >= 22` (matches the project's Node 22+ requirement). |
| Entry points | `type: module`, `module: dist/esm/index.js`, `main: dist/plugin.cjs.js`, `types: dist/esm/index.d.ts`, `unpkg: dist/plugin.js`, `capacitor.android.src: "android"`. |

## JS surface

- `dist/esm/index.js:2-4`: `registerPlugin("PlayGames", { web: () => import("./web").then((m) => new m.PlayGamesWeb()) })`; exports `PlayGames` and the definitions. The UMD/CJS bundles (`dist/plugin.js`, `dist/plugin.cjs.js`) inline the same code; the only `require` is `@capacitor/core`.
- Web fallback `dist/esm/web.js`: every method resolves a safe signed-out or empty default (`signIn` → `{ signedIn: false }`, `getPlayer` → `{ playerId: "", displayName: "" }`, `submitScore` → empty result). No `fetch`, XHR, WebSocket, `eval` or `Function(` anywhere in `dist/`.
- Methods this phase uses (`dist/esm/definitions.d.ts`):

| Method | Signature | Notes |
|---|---|---|
| `initialize` | `initialize(): Promise<void>` (d.ts:330) | Doc (d.ts:323-329): "No-op. `PlayGamesSdk.initialize` runs automatically when the plugin loads, driven by the Capacitor bridge". |
| `signIn` | `signIn(opts?: { silent?: boolean }): Promise<SignInResult>` (d.ts:341) | **`silent` defaults to `true`** (d.ts:334; native `SignInModule.kt:13` `call.boolOption("silent", true)`). A bare call is silent, not interactive. |
| `isSignedIn` | `isSignedIn(): Promise<{ signedIn: boolean }>` (d.ts:348) | |
| `getPlayer` | `getPlayer(): Promise<PlayerInfo>` (d.ts:358) | Rejects when no player is signed in (native `PlayersModule.kt:20-22` binds a failed `currentPlayer` task to a rejection). |
| `SignInResult` | `{ signedIn: boolean; player?: PlayerInfo }` (d.ts:53-58) | |
| `PlayerInfo` | `playerId`, `displayName`, `avatarUrl?`, `hiResImageUrl?`, `bannerImageLandscapeUrl?`, `bannerImagePortraitUrl?`, `title?`, `retrievedAt?`, `lastPlayedWithAt?`, `level?`, `friendStatus?`, `friendsListVisibility?` (d.ts:3-28) | |
| `addListener` | `addListener("signInStateChanged", ...)` (d.ts:805) | Emitted by every `signIn` resolution (`SignInModule.kt:88-91`). |

- Phase 68 methods, by name: `submitScore({ leaderboardId, score, scoreTag? })` (d.ts:538, resolves only after the server records it via `submitScoreImmediate`), `loadTopScores` (d.ts:588), `loadPlayerCenteredScores` (d.ts:594), `loadCurrentPlayerScore` (d.ts:600), `loadFriends({ pageSize?, forceReload?, resolve? })` (d.ts:394, returns `{ friends, resolutionRequired }` without a dialog unless `resolve: true`).

## Native surface

`PlayGamesPlugin.kt:24` declares `@CapacitorPlugin(name = "PlayGames")`. Every
`@PluginMethod` (`PlayGamesPlugin.kt:97-145`), grouped by module:

| Module | @PluginMethods | Telemetry-shaped? |
|---|---|---|
| Plugin itself | `initialize` (line 97, `call.resolve()` only) | no |
| SignInModule | `signIn`, `isSignedIn`, `requestServerSideAccess` (99-101) | `requestServerSideAccess` hands an OAuth auth code to a game server; never called here |
| PlayersModule | `getPlayer`, `getPlayerId`, `loadPlayer`, `loadFriends`, `loadRecentlyPlayedWithPlayers`, `showPlayerSearch`, `showComparePlayer` (103-109) | no |
| AchievementsModule | `unlockAchievement`, `revealAchievement`, `incrementAchievement`, `setAchievementSteps`, `loadAchievements`, `showAchievements` (111-116) | no |
| LeaderboardsModule | `submitScore`, `showLeaderboard`, `showAllLeaderboards`, `loadLeaderboards`, `loadLeaderboard`, `loadTopScores`, `loadPlayerCenteredScores`, `loadCurrentPlayerScore` (118-125) | no |
| SavedGamesModule | `loadSnapshot`, `saveSnapshot`, `listSnapshots`, `deleteSnapshot`, `showSnapshots`, `getSnapshotLimits` (127-132) | no |
| GameStatsModule | `recordGameEvent`, `recordGameEvents`, `recordProgressUpdate`, `requestGameEventsUpload` (134-137) | **yes** (gameplay events uploaded to Google) |
| EventsModule | `incrementEvent`, `loadEvents`, `loadEventsByIds` (139-141) | **yes** (Play Console event counters) |
| RecallModule | `requestRecallAccess` (143) | **yes** (Recall session id for a game server) |
| PlayerStatsModule | `loadPlayerStats` (145) | **yes** (Google's per-player engagement stats) |

The telemetry-shaped methods run only when JS calls them. This project never
calls them; 67-06/67-08 should keep the provider's surface to sign-in,
isSignedIn and getPlayer (plus Phase 68's leaderboard methods). The modules are
`by lazy` (lines 26-35), so none is constructed until its first call.

`@ActivityCallback` handlers (lines 149-178) only resolve UI-intent results.

## Gradle

`android/build.gradle` compared with the pinned project toolchain
(repo `android/build.gradle:10`, `android/variables.gradle`,
`android/gradle/wrapper/gradle-wrapper.properties:3`):

| Item | Plugin declares | Project pin | Fit |
|---|---|---|---|
| buildscript classpath, AGP | `com.android.tools.build:gradle:9.3.1` (build.gradle:19) | AGP 8.13.0 | Mismatch on paper. The root project's AGP 8.13.0 is already on the parent buildscript classloader, which shadows the subproject's own 9.3.1 declaration (parent-first delegation). |
| buildscript classpath, Kotlin | `org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.10` (build.gradle:20) | none at root (the project has no Kotlin of its own) | KGP 2.4.10 is new on the classpath; it must work on Gradle 8.14.3 + AGP 8.13.0. |
| Plugins applied | `com.android.library` (24), `org.jetbrains.kotlin.android` (29) | | |
| Gradle wrapper | n/a | Gradle 8.14.3 | |
| compileSdk / minSdk / targetSdk | from rootProject ext, fallback 36 / 24 / 36 (33-36) | 36 / 24 / 36 | match |
| JVM target | Java 21 source/target (51-54), Kotlin `JvmTarget.JVM_21` (57-61) | JDK 21 | match |
| Runtime deps | `project(':capacitor-android')`, `androidx.appcompat:appcompat:1.7.1` (root ext wins), `com.google.android.gms:play-services-games-v2:22.0.0` (68-76) | | play-services-games-v2 is the only Google dependency; its transitive tree is audited in 67-06 |
| Release minify | `minifyEnabled false`, `proguard-android-optimize.txt` (43-46) | | library-side only |

On paper only a real build can prove the plugin's Kotlin module compiles on
Gradle 8.14.3 + AGP 8.13.0, and no toolchain upgrade is allowed. The D-21 spike
(`67-AGP9-SPIKE.md`) has since run that build: with the plugin installed
unmodified, `npm run android:debug` on the pinned toolchain passed
(`BUILD SUCCESSFUL in 6m 5s`, `compileDebugKotlin` clean, one advisory KGP
deprecation warning about Gradle 8.14.3). 67-06's own debug build re-proves it.

## Network, analytics and ads scan

Searched every Kotlin file, the manifest, the ProGuard files and all of `dist/`
for `http(s)://`, `java.net`, OkHttp, `HttpURLConnection`, sockets, Firebase,
analytics, measurement, Crashlytics, AdMob/ads, `Runtime.exec`,
`System.loadLibrary`, `Class.forName`, `DexClassLoader` and reflection, plus
`fetch`, XHR, WebSocket, `eval` and `Function(` in the JS.

| Finding | Detail |
|---|---|
| HTTP / socket code of its own | **None.** The only URL is the XML namespace in `AndroidManifest.xml:2`. All network traffic goes through the Play Games SDK's own clients. |
| Ads / analytics / Firebase / Crashlytics | **None.** The single regex hit (`GameStatsModule.kt:72`) is the word "overloads" in a comment. The README (lines 119-120) notes `google-services.json` is only needed for Firebase, which this plugin does not use. |
| Imports | Only `android.*`, `androidx.*`, `com.getcapacitor.*`, `com.google.android.gms.common.*`, `com.google.android.gms.games.*`, `com.google.android.gms.tasks.*`, `java.io`, `java.nio.charset`, `java.util.concurrent`, `org.json`. |
| Dynamic code / obfuscation | None. The Kotlin is readable, commented source; no native libraries, no class loading, no process exec. |
| Manifest | Empty `<manifest/>` (`AndroidManifest.xml:1-2`): no permissions, no components. play-services-games-v2's own manifest merges in its usual entries (checked in 67-06). |
| Background threads | One lazy single-thread daemon executor for snapshot file I/O (`SavedGamesModule.kt:167-174`), created only if saved games are used. |
| consumer-rules.pro | `-keep class com.idleflowgames.playgames.** { *; }` (Capacitor instantiates plugins reflectively). |

## Ambient initialization (the blocker)

`PlayGamesPlugin.kt:40-43`:

```kotlin
override fun load() {
    super.load()
    // Non-fatal: without Play Services, PGS calls resolve signedIn=false rather than crash.
    runCatching { PlayGamesSdk.initialize(context) }
```

and `PlayGamesPlugin.kt:97`: `@PluginMethod fun initialize(call: PluginCall) = call.resolve()`.
The README (README.md:306-308) says the same: "No-op. `PlayGamesSdk.initialize`
runs automatically when the plugin loads, driven by the Capacitor bridge".

Capacitor instantiates every registered plugin and calls its `load()` while the
bridge starts, before any JavaScript runs. So the Play Games SDK initializes on
every app launch, whatever the player's Compete setting, and JS gating cannot
prevent it. Research Assumption A1 (that the JS layer controls whether the SDK
initializes) is **falsified**, and D-02 as originally written ("the PGS SDK is
never initialized at launch" with Compete OFF) **cannot hold** with the tarball
as published. The init is wrapped in `runCatching`, is local, and does not block
boot or require the network. Google's SDK may still attempt its own automatic
sign-in after init (the Play Games "Welcome back" banner).

## Research corrections

| Research claim | Tarball fact |
|---|---|
| A bare `signIn()` is interactive | `silent` defaults to `true` (d.ts:334, `SignInModule.kt:13`). The Sign in row must pass `silent: false` explicitly. Every failure resolves `{ signedIn: false }` rather than rejecting (`SignInModule.kt:18-33`). |
| APP_ID resource naming | The README convention is `<meta-data android:name="com.google.android.gms.games.APP_ID" android:value="@string/game_services_project_id" />`, with the string in `res/values/games-ids.xml` (README.md:106-116). |
| The plugin "matches AGP 8.13" | Its own buildscript classpath is AGP 9.3.1 plus KGP 2.4.10 (build.gradle:19-20). It still builds on the pinned 8.13.0 (spike). |
| Assumption A1: JS controls SDK init | Falsified; see the blocker above. |

## Options for the ruling

(Verbatim from 67-01 Task 2's checkpoint.)

- **as-is:** install 0.5.0 unmodified. D-02 is amended to "the JS layer never calls sign-in, isSignedIn or getPlayer while Compete is OFF". The native SDK still initializes at launch. The Compete-OFF network capture on the Pixel 7 becomes a release-blocking device check in the Phase 69 batch.
- **patch (recommended):** install 0.5.0 with the exact pin. 67-06 adds tools/patch-play-games.mjs, run by `npm run cap:sync` before `npx cap sync`. It moves the PlayGamesSdk.initialize(context) call out of load() and into the JS-called initialize() method, and runs only when PlayGamesPlugin.kt's sha256 matches the reviewed 0.5.0 file (any other bytes fail the build loudly). D-02 then holds as written: the SDK stays untouched until a Compete-ON provider calls initialize(). The package is still installed from npm and not vendored. Only a guarded two-line build-time patch is added, and D-17 is amended to allow it.
- **stop:** do not install. The phase halts for a replan (for example a vendored fork, the research's fallback).

## Ruling
