---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Monster Balancing & Abilities
current_phase: 18
current_phase_name: Bestiary Rebalance & Canon Combat Fixes
status: executing
stopped_at: Completed 18-05-PLAN.md
last_updated: "2026-09-13T23:46:26.204Z"
last_activity: 2026-09-13
last_activity_desc: Phase 18 execution started
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 9
  completed_plans: 8
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-13 after v1.0)

**Core value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Current focus:** Phase 18 — Bestiary Rebalance & Canon Combat Fixes

## Current Position

Phase: 18 (Bestiary Rebalance & Canon Combat Fixes) — EXECUTING
Plan: 6 of 6
Status: Ready to execute
Last activity: 2026-09-13 — Phase 18 execution started

Progress: [█████████░] 89%

## Ground Truth (durable facts every session needs)

**App identity:** "Delve, Die, Repeat", appId `com.darktierstudios.delvedierepeat` (PERMANENT — published). Player-facing text uses "Dungeon"/"Game Master". The old working-title string survives only in filenames (`mazeworld.html`, `mazeworld.pdf`), code ids, and storage-key history — do not reintroduce it anywhere player-facing or in docs.

**Google Play:** store entry EXISTS; app is on the **internal-testing track** with friends as testers (first upload 2026-09-10, versionCode 1, built BEFORE DR18). **STANDING RULE (user, 2026-09-13): after every update batch, ASK whether to push a Play internal-testing build** (`npm run play:release` → drop the AAB in Play Console; Developer-API upload not set up yet — `docs/RELEASING.md`). A signed versionCode-2 AAB with DR17+DR18 was built 2026-09-13 13:48 and handed to the user to upload.

**Build/env:** `npm test` (683/683) · `npm run android:debug` (debug APK) · `npm run play:release` (bump `android/version.properties` → build www → cap sync → pin-jdk → signed `bundleRelease`; keystore creds in git-ignored `android/keystore.properties`, alias `key0`, keystore `C:/Users/Dell/android_store_keys/delvedierepeat.jks`). All JDK paths resolve to `JAVA_HOME` = `C:/Program Files/Microsoft/jdk-21.0.10.7-hotspot/` (gradle.properties pin + Studio's gradleJvm=#JAVA_HOME). `tools/gradle.mjs` runs the wrapper (this machine sets `NoDefaultCurrentDirectoryInExePath=1`). `npx cap sync` wipes `org.gradle.java.home`; pin-jdk re-applies it. AGP 8.13.0 / Gradle 8.14.3 — don't let Studio upgrade.

**Device:** Pixel 7 wireless adb (`adb-28051FDH200H0R`, 10.0.0.175:<port rotates>; rediscover via `adb mdns services`). Deploy = `adb install -r` + `am force-stop` + `monkey` relaunch (install alone doesn't reload the WebView). A Play-installed build and a local build have different signers — uninstall one before installing the other (Preferences data is lost on uninstall). Screenshots via screencap usually hit the lock screen — the user reviews and reports.

**Engine gate (non-negotiable, every change):** engine pure/deterministic; parity byte-identical for solo/empty-party play; new rng draws only behind new-feature guards; new serialized fields carved out in all 3 `*Comparable()` fns (`test/parity/harness/comparables.js`); `test/parity/prototype-master.js.txt` NEVER edited; every new event type gets an `EVENT_NARRATION` entry (coverage guard). Deliberate divergences regenerate only their specific fixtures, with rationale. (Also stated in `ROADMAP.md` as the v1.1 preamble gate.)

**v1.1 phase order (ROADMAP.md):** 17 Fixture Inventory & Foe-Turn Refactors → 18 Bestiary Rebalance & Canon Combat Fixes → 19 Foe Abilities/Spellcasting/Symmetric INT Resistance (`--research-phase` recommended) → 20 Parley Balance & Language System → 21 Consolidated Difficulty Retune (`--research-phase` recommended; TUNE-04 human DR sign-off is the milestone's last step, UAT deferred to milestone end).

**Working method:** GSD phases (autonomous runs) for systems work; on-device DR rounds (small user-directed batches, each with a `DR*-SUMMARY.md`) for UX. Commit per batch — do not let the tree sit uncommitted for days. Remote: `origin` = https://github.com/sheibeck/ddr (public). Push is a user-run step (`! git push`) — the auto-mode classifier blocks pushes from Claude.

## Accumulated Context

### Blockers/Concerns (open)

- [Balance]: The consolidated difficulty retune (Phase-3 feel-tuning to floor 30–50+, PARTY-10 party power, ECON deep tuning, foe abilities, parley economy) has NOT happened — it runs ONCE in Phase 21 using `tools/tune-difficulty.mjs` / `tools/tune-economy.mjs`, closed by a human DR-round sign-off (TUNE-04).
- [Play launch]: target-API level, Data Safety fields, and IARC questions shift yearly — re-verify against current Play Console Help right before the production phase. Repo-side: a dependency/SDK audit proving "no data collected" is still owed.
- [Tutorial]: `04-10-PLAN.md` (archived) predates the DR-era UI — re-plan, don't execute as-is.
- [Play testers]: internal testers are on the pre-DR18 build until the versionCode-2 AAB is uploaded.

### Pending Todos

- Set up Play Developer API upload (service account) so `play:release` can push to the internal track without Console drag-and-drop — user steps in `docs/RELEASING.md`.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-09-13 (v1.0 override closeout):

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 01/02/03 VERIFICATION.md `human_needed` | accepted — end-of-milestone UAT satisfied by DR1–DR18 on-device play + Play internal testers |
| quick_task | rules-text-audit-pass (20260909) | missing SUMMARY → shipped as Phase 04.2 |
| quick_task | 260908-kkq-rename-product-to-delve-die-repeat-and-s | partial → landed in f81942f |
| requirement | UX-06 first-run tutorial (04-10) | user-deferred until the UI settles (build LAST, after v1.1) |
| requirement | STR-01..04, STR-06 production launch | in progress by the user; repo-side audit owed; after v1.1 |
| requirement | PARTY-10 consolidated difficulty retune | now Phase 21 (v1.1) |
| v2 | Networked multiplayer (MP-01/02) | post-launch; party layer already shipped as its foundation |
| v2 | DR16-G "squares of opponents" / Amulet of Stone 4-target | tracked as UI-V2-03 in REQUIREMENTS.md v2 Requirements |

## Session Continuity

Last session: 2026-09-13T23:46:26.164Z
Stopped at: Completed 18-05-PLAN.md
Resume file: None

## Operator Next Steps

1. Upload the signed versionCode-2 AAB to the internal-testing track (Play Console → Testing → Internal testing → Create new release), if not already done.
2. Review/approve `.planning/ROADMAP.md` for v1.1, then `/gsd-plan-phase 17`.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 17 P01 | 30min | 2 tasks | 4 files |
| Phase 17 P02 | 20min | 2 tasks | 3 files |
| Phase 17 P03 | 25min | 2 tasks | 2 files |
| Phase 18 P01 | 28min | 2 tasks | 3 files |
| Phase 18 P02 | 20min | 2 tasks | 6 files |
| Phase 18 P03 | 25min | 2 tasks | 3 files |
| Phase 18 P04 | 30min | 2 tasks | 4 files |
| Phase 18 P05 | 20min | 2 tasks | 2 files |

## Decisions

- [Phase ?]: 17-01: fixtureRoster.js replays fixtures via applyStartCombat/applyAction/runEconomyAction rather than re-deriving startCombat math; foes snapshotted only on the null->non-null state.combat transition (once per script/scenario)
- [Phase ?]: 17-02: applyFoeDamageToPlayer avoids an internal f=foe alias so its killFoe/die call sites read as the literal parameter name, matching the plan's textual acceptance-criteria greps
- [Phase ?]: 17-02: options-object signature (state, foe, rng, events, { dmg, roll, need }) locked per CONTEXT.md's small-rng-explicit-signature preference over RESEARCH.md's positional draft
- [Phase ?]: 17-03: pinned draw-count integers measured by actually running countingRng against the post-17-02 engine (not hand-traced); matched the plan's PRE-Phase-17 numbers exactly, confirming 17-02's extraction is draw-for-draw identical
- [Phase ?]: 18-01: Werebeast's TTK ratio computes to exactly 2.0 (unflagged) while lethality 2.60 flags it, matching the plan's strict boundary rule precisely; Philly's ttkRatio floats to 2.0000000000000004 due to the twice-doubling path (cosmetic, handled via the curated Review Verdicts disposition, not a code fix)
- [Phase ?]: 18-01: CANON-04's damage-source x creature-type multiplier is out of tools/bestiary-yardstick.mjs's melee-only scope (depends on caster class, not modeled by the composite hero) — documented explicitly in content/BESTIARY-REBALANCE.md
- [Phase ?]: 18-02: implemented damageFoe/multiplierFor exactly per plan's locked order (multiplier -> halfDmg -> soak); no call site routed yet (18-03/18-04 do the routing)
- [Phase ?]: 18-03: reflect damage routed as kind:"reflect" (physical for armor-soak, never multiplier-eligible); ally/member strikes routed as kind:"ally" so D-20 (no Fighter-vs-Trachea doubling for allies) holds structurally
- [Phase ?]: 18-03: renamed playerStrike's damageFoe result binding from the plan's suggested 'hit' to 'landed' to avoid colliding with the pre-existing to-hit boolean of the same name
- [Phase ?]: 18-04: quake's per-foe damageFoe call captures no return value — earthquake.amount reports the single rolled base, not a per-foe applied amount (locked event-shape decision)
- [Phase ?]: 18-04: insaneStruckAlly is now guarded on !hit.soaked — a fully-soaked foe-on-foe blow emits only foeArmorSoaked
- [Phase ?]: D-18: Drake wp 135->38, Werebeast dmg bonus 5->0 (outlier fixes)
- [Phase ?]: D-03: five caster foes (Djinni x2, Krupke, Drudge x2, Vampire, Stalka Beast) get -25% wp pre-ability discount, one dice-step lower melee
