---
phase: 67-play-games-integration-account-chip
plan: 01
subsystem: native-plugins / supply-chain intake
status: complete
tags: [play-games, capacitor-plugin, supply-chain, d-17, d-20, d-21]
requires: []
provides:
  - 67-01-PLUGIN-REVIEW.md with the D-17 tarball review and a machine-readable `Ruling: as-is` line
  - reviewed sha256 of PlayGamesPlugin.kt (0023e880027c8b8160676485ef40655623c3bfdce095ac2754319bed82d7b7ec)
affects: [67-06, 67-08, phase-68, phase-69]
tech-stack:
  added: []
  patterns: [read-only npm pack review outside the repo before any install]
key-files:
  created:
    - .planning/phases/67-play-games-integration-account-chip/67-01-PLUGIN-REVIEW.md
  modified: []
decisions:
  - "Intake ruling as-is (D-20): install @modbender/capacitor-play-games@0.5.0 unmodified with an exact pin; D-02 amended so Compete OFF means no JS sign-in/submit/fetch, while the native SDK still initializes at launch"
  - "AGP path (D-21 spike): stay on AGP 8.13.0 / Gradle 8.14.3; the plugin builds unmodified, no Gradle fix"
metrics:
  duration: ~15 min
  completed: 2026-09-23
  tasks: 3
  files: 1
requirements: [PGS-01]
---

# Phase 67 Plan 01: Play Games plugin intake review Summary

Read-only review of the published `@modbender/capacitor-play-games@0.5.0` tarball (integrity verified against the registry, no install scripts, no runtime deps, no network/ads/analytics code of its own), with the ambient `PlayGamesSdk.initialize` blocker documented and resolved by the user's recorded **as-is** ruling (D-20) on the pinned AGP 8.13.0 toolchain (D-21).

## What was done

- **Task 1:** `npm pack` fetched the 0.5.0 tarball into a scratch directory outside the repo. It was extracted and read in full: package.json, all `dist/` JS, definitions, web fallback, Gradle, manifest, ProGuard rules, all 12 Kotlin files, README and CHANGELOG. The findings are in `67-01-PLUGIN-REVIEW.md` with `file:line` citations. The scratch directory was deleted afterwards.
- **Task 2 (checkpoint:human-verify, blocking-human):** already answered by the user through 67-CONTEXT D-20 (as-is) and D-21 (AGP path, settled by `67-AGP9-SPIKE.md`). Per the orchestrator's ruling the executor did not stop. The review found nothing new that D-20 did not cover, so no stop was needed.
- **Task 3:** recorded `Ruling: as-is` under `## Ruling`, with the date, D-20/D-21 quoted verbatim, the spike verdict, the legitimacy confirmation, the amended decision (D-02) and the next step for 67-06.

## Findings table (copied from the review, as D-17 requires)

| Area | Finding |
|---|---|
| Integrity | Registry `sha512-GJ7gzDQICQxzPIzKejqYnG9HXnL2/lq5CenHPeDaedkbaYf2hZndj1Xx+F4TtE0PLHp1Da2Ku5W/AMTw5Znb3w==` matches the computed sha512 of the packed .tgz. 36 files, 48.9 kB. MIT. Published 2026-09-12. |
| Guard hash | sha256 of `PlayGamesPlugin.kt` = `0023e880027c8b8160676485ef40655623c3bfdce095ac2754319bed82d7b7ec` |
| Install surface | No preinstall/install/postinstall/prepare scripts. No runtime dependencies. Peer `@capacitor/core ^8.0.0`. |
| Blocker | `PlayGamesPlugin.kt:40-43` `load()` runs `runCatching { PlayGamesSdk.initialize(context) }` on every launch, before any JS. `initialize()` (line 97) is a no-op `call.resolve()`, and the README says so. Research Assumption A1 is falsified, and D-02 as originally written cannot hold. Resolved by the as-is ruling, which amends D-02. |
| Gradle classpath | The plugin's own buildscript declares AGP `9.3.1` + KGP `2.4.10` (build.gradle:19-20). Its SDK levels come from rootProject ext (36/24/36) and it targets JVM 21, both matching the pin. Deps: play-services-games-v2:22.0.0, appcompat, capacitor-android. The D-21 spike proved it builds unmodified on AGP 8.13.0 / Gradle 8.14.3. |
| Network / ads / analytics | None of its own. No HTTP, sockets, Firebase, analytics, Crashlytics, AdMob, exec, class loading or obfuscation. The manifest is empty. Imports are limited to android/androidx/Capacitor/GMS games/java/org.json. |
| Telemetry-shaped surfaces (never called by this project) | `recordGameEvent(s)`, `recordProgressUpdate`, `requestGameEventsUpload`, `incrementEvent`, `loadEvents(ByIds)`, `requestRecallAccess`, `requestServerSideAccess`, `loadPlayerStats`. All run only on an explicit JS call, and their modules are lazy. |
| Research corrections | `signIn` `silent` defaults to **true**, so the Sign in row must pass `silent: false`. The APP_ID meta-data points at `@string/game_services_project_id`. The plugin's classpath is AGP 9.3.1, not 8.13. `getPlayer` rejects when signed out, and every `signIn` failure resolves `{ signedIn: false }`. |
| Provenance | A fork of `@idleflowgames/capacitor-play-games` 0.2.1, recovered from its npm tarball after upstream GitHub went 404 (README:8-20). The fork says so openly. |

## Ruling

`Ruling: as-is` (D-20). Install 0.5.0 unmodified with an exact pin. D-02 is amended: with Compete OFF, the JS layer never calls sign-in, submit or fetch and makes no leaderboard traffic. The native SDK still initializes at launch, locally, wrapped in `runCatching`, and boot never waits on it. The AGP path per the D-21 spike: **STAY ON AGP 8.13.0**, with no Gradle fix. D-17 is not amended (no patch). **67-06 may run its as-is branch.**

## Deviations from Plan

- **Checkpoint not paused (orchestrator ruling, not an auto-fix):** Task 2 is `checkpoint:human-verify gate="blocking-human"`. It was resolved by the user's prior D-20/D-21 decisions, which the orchestrator passed in explicitly, so the executor recorded the outcome and continued rather than stopping.
- **Scratch directory location:** the tarball was packed into the session scratchpad (outside the repo) rather than the OS temp dir, per the environment's temp-file guidance. It was deleted after the review.
- The plan's interfaces block described the telemetry list without `requestServerSideAccess` as telemetry. The review lists it as auth-code handoff (never called). Informational only.

Otherwise the plan was executed as written.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md). There are no device pauses in this plan.

- **Release-blocking (ruling was as-is):** on the Pixel 7, with Compete OFF on a cold boot, confirm Logcat and a network capture show no Play Games **sign-in, leaderboard submit or leaderboard fetch** activity from the game. Expect the SDK's own `PlayGamesSdk.initialize` at launch, and possibly Google's automatic "Welcome back" sign-in banner, since the SDK initializes regardless. Record what the SDK does on its own, so the Phase 69 privacy text can state it accurately.
- With Compete OFF and airplane mode on, confirm a cold boot and a full run play normally with no stall at boot (the init is local and non-blocking).

## Known Stubs

None. This plan produced only a review document.

## Threat Flags

None beyond the plan's threat model. T-67-SC was mitigated by the integrity check and the source review. T-67-01 was surfaced and accepted by the user as-is under D-20, with the release-blocking device check above.

## Self-Check: PASSED

- FOUND: .planning/phases/67-play-games-integration-account-chip/67-01-PLUGIN-REVIEW.md
- FOUND: commit 0df20e8 (Task 1 review)
- FOUND: commit 62dc01d (Task 3 ruling)
- package.json, package-lock.json and android/ are unchanged since 825296e
