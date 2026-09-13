---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Monster Balancing & Abilities
status: planning
last_updated: "2026-09-13T18:13:10.880Z"
last_activity: 2026-09-13
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-13 after v1.0)

**Core value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Current focus:** Milestone v1.1 Monster Balancing & Abilities — defining requirements (research-first)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-09-13 — Milestone v1.1 started

## Ground Truth (durable facts every session needs)

**App identity:** "Delve, Die, Repeat", appId `com.darktierstudios.delvedierepeat` (PERMANENT — published). Player-facing text uses "Dungeon"/"Game Master". The old working-title string survives only in filenames (`mazeworld.html`, `mazeworld.pdf`), code ids, and storage-key history — do not reintroduce it anywhere player-facing or in docs.

**Google Play:** store entry EXISTS; app is on the **internal-testing track** with friends as testers (first upload 2026-09-10, versionCode 1, built BEFORE DR18). **STANDING RULE (user, 2026-09-13): after every update batch, ASK whether to push a Play internal-testing build** (`npm run play:release` → drop the AAB in Play Console; Developer-API upload not set up yet — `docs/RELEASING.md`). A signed versionCode-2 AAB with DR17+DR18 was built 2026-09-13 13:48 and handed to the user to upload.

**Build/env:** `npm test` (683/683) · `npm run android:debug` (debug APK) · `npm run play:release` (bump `android/version.properties` → build www → cap sync → pin-jdk → signed `bundleRelease`; keystore creds in git-ignored `android/keystore.properties`, alias `key0`, keystore `C:/Users/Dell/android_store_keys/delvedierepeat.jks`). All JDK paths resolve to `JAVA_HOME` = `C:/Program Files/Microsoft/jdk-21.0.10.7-hotspot/` (gradle.properties pin + Studio's gradleJvm=#JAVA_HOME). `tools/gradle.mjs` runs the wrapper (this machine sets `NoDefaultCurrentDirectoryInExePath=1`). `npx cap sync` wipes `org.gradle.java.home`; pin-jdk re-applies it. AGP 8.13.0 / Gradle 8.14.3 — don't let Studio upgrade.

**Device:** Pixel 7 wireless adb (`adb-28051FDH200H0R`, 10.0.0.175:<port rotates>; rediscover via `adb mdns services`). Deploy = `adb install -r` + `am force-stop` + `monkey` relaunch (install alone doesn't reload the WebView). A Play-installed build and a local build have different signers — uninstall one before installing the other (Preferences data is lost on uninstall). Screenshots via screencap usually hit the lock screen — the user reviews and reports.

**Engine gate (non-negotiable, every change):** engine pure/deterministic; parity byte-identical for solo/empty-party play; new rng draws only behind new-feature guards; new serialized fields carved out in all 3 `*Comparable()` fns (`test/parity/harness/comparables.js`); `test/parity/prototype-master.js.txt` NEVER edited; every new event type gets an `EVENT_NARRATION` entry (coverage guard). Deliberate divergences regenerate only their specific fixtures, with rationale.

**Working method:** GSD phases (autonomous runs) for systems work; on-device DR rounds (small user-directed batches, each with a `DR*-SUMMARY.md`) for UX. Commit per batch — do not let the tree sit uncommitted for days. Remote: `origin` = https://github.com/sheibeck/ddr (public). Push is a user-run step (`! git push`) — the auto-mode classifier blocks pushes from Claude.

## Accumulated Context

### Blockers/Concerns (open)

- [Balance]: The consolidated difficulty retune (Phase-3 feel-tuning to floor 30–50+, PARTY-10 party power, ECON deep tuning, foe abilities) has NOT happened — it runs ONCE in Monster Balancing using `tools/tune-difficulty.mjs` / `tools/tune-economy.mjs`.
- [Play launch]: target-API level, Data Safety fields, and IARC questions shift yearly — re-verify against current Play Console Help right before the production phase. Repo-side: a dependency/SDK audit proving "no data collected" is still owed.
- [Tutorial]: `04-10-PLAN.md` (archived) predates the DR-era UI — re-plan, don't execute as-is.
- [Play testers]: internal testers are on the pre-DR18 build until the versionCode-2 AAB is uploaded.

### Pending Todos

- Set up Play Developer API upload (service account) so `play:release` can push to the internal track without Console drag-and-drop — user steps in `docs/RELEASING.md`.
- DR15-A "Language as a system" design + DR16-G "squares of opponents" — fold into Monster Balancing's parley pass / foe model if relevant.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-09-13 (v1.0 override closeout):

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 01/02/03 VERIFICATION.md `human_needed` | accepted — end-of-milestone UAT satisfied by DR1–DR18 on-device play + Play internal testers |
| quick_task | rules-text-audit-pass (20260909) | missing SUMMARY → shipped as Phase 04.2 |
| quick_task | 260908-kkq-rename-product-to-delve-die-repeat-and-s | partial → landed in f81942f |
| requirement | UX-06 first-run tutorial (04-10) | user-deferred until the UI settles (build LAST) |
| requirement | STR-01..04, STR-06 production launch | in progress by the user; repo-side audit owed |
| requirement | PARTY-10 consolidated difficulty retune | Monster Balancing milestone |
| v2 | Networked multiplayer (MP-01/02) | post-launch; party layer already shipped as its foundation |

## Session Continuity

Last session: 2026-09-13 — resumed after a token-limit cutoff; reconstructed the 09-10 state; built + sideloaded DR17/DR18; set up the signed Play release pipeline + JDK unification; committed everything (3 commits) and the user pushed to `origin/master`; closed v1.0 (override closeout) and reconciled all planning docs.
Stopped at: v1.0 closed; ready to `/compact` then `/gsd-new-milestone` (Monster Balancing & Abilities).
Resume file: None.

## Operator Next Steps

1. Upload the signed versionCode-2 AAB to the internal-testing track (Play Console → Testing → Internal testing → Create new release).
2. `/compact`, then `/gsd-new-milestone` — Monster Balancing & Abilities (research-first).
