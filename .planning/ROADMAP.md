# Roadmap: Mazeworld

## Overview

Mazeworld ports a complete, proven ~3,300-line vanilla-JS/HTML/canvas roguelike (`mazeworld.html`) into a paid, offline, native Android game on Google Play. The ruleset is not being rebuilt — it's being extracted behind a clean, deterministic, serializable engine boundary, then wrapped, converted from a fixed 5-floor game to an endless depth-chase, dressed in mobile-native presentation and the game's sarcastic voice, and finally taken through Google Play compliance to a live store listing. The path front-loads the two highest-leverage, highest-risk moves — decoupling the engine and getting a real native build onto a real device early — so that endless-mode balance, mobile UX, and voice/content work happen against a stable foundation instead of a moving one, and store submission lands as a distinct, gated final phase rather than a scramble at the end.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Engine Extraction & Determinism** - The full ruleset runs behind a single deterministic, serializable `applyAction` contract with zero gameplay regressions ✓ (285/285 tests, 2026-09-08)
- [x] **Phase 2: Android Packaging & Native Persistence** - The game installs as a native Android app that reliably autosaves and resumes on a real device ✓ (372/372 tests, debug APK+AAB build green, 2026-09-08; device UAT deferred)
- [x] **Phase 3: Endless Descent & Difficulty Balance** - Players descend an endless, fairly-paced maze instead of a fixed 5-floor Gate ✓ (324/324 tests, 2026-09-08)
- [ ] **Phase 4: Mobile Presentation, Controls & Onboarding** - The game feels native and approachable on a phone, with touch controls, readable UI, and in-context teaching
- [ ] **Phase 5: Voice, Content & Graveyard** - The game's sarcastic identity comes alive through data-driven copy tied to real events, verified safe for its rating
- [ ] **Phase 6: Google Play Compliance & Launch** - Mazeworld is live, purchasable, and compliant on Google Play

## Phase Details

### Phase 1: Engine Extraction & Determinism

**Goal**: The full ruleset (character gen, movement, combat, magic, economy, leveling, death, descent) runs behind a single deterministic, serializable `applyAction(state, action) → {state, events}` contract, with content data separated from logic and zero gameplay regressions from the prototype.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05
**Success Criteria** (what must be TRUE):

  1. Every game rule executes only through `applyAction(state, action) → {state, events}` — no rendering, storage, or DOM code lives inside the engine module.
  2. Given the same seed and the same sequence of actions, the engine produces byte-identical results across two independent runs, with no direct `Math.random()` calls remaining anywhere in the rules.
  3. All game content (classes, subclasses, races, spells, creatures, items, traps, afflictions, epitaphs) lives in standalone data tables the engine reads, with no content values hardcoded into logic.
  4. A serialize/rehydrate round-trip test suite passes for full game state at multiple points in a run, and stays green as work continues into later phases.
  5. A full playthrough driven through the new engine (via the existing browser harness) matches the original prototype's behavior for the same inputs — all 3 classes / 24 subclasses / 6 races / 31 spells / ~45 creatures / items / economy functioning with no regressions.

**Plans**: 10/10 plans executed

- [x] 01-01-PLAN.md — Scaffold + seeded RNG + dice resolver + static determinism/purity guards
- [x] 01-02-PLAN.md — Content extraction: all rules tables → pure data + dice-notation
- [x] 01-03-PLAN.md — Parity harness infra + frozen golden master (node:vm)
- [x] 01-04-PLAN.md — Maze generation (genFloor/bfs/reveal), RNG-injected + determinism
- [x] 01-05-PLAN.md — Engine core (applyAction + validation) + character gen, derived numbers & leveling
- [x] 01-06-PLAN.md — Items/treasure & death/graveyard helpers + fail-closed save validation
- [x] 01-07-PLAN.md — Movement slice + round-trip guardrail + browser adapter (walking skeleton)
- [x] 01-08-PLAN.md — Combat slice (encounters, strikes, foe turns, flee/parley/sing)
- [x] 01-09-PLAN.md — Magic, potions & scrolls slice
- [x] 01-10-PLAN.md — Economy/store (closures→data) + encounters/traps/chests + full-suite green

### Phase 2: Android Packaging & Native Persistence

**Goal**: The game runs as an installable native Android app (via Capacitor) that autosaves durably and resumes exactly where the player left off, surfacing signing/storage/lifecycle problems early while there is still schedule slack.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PLT-01, PLT-02, PLT-03, PLT-04, SAV-01, SAV-02, SAV-03, SAV-04, SAV-05
**Success Criteria** (what must be TRUE):

  1. The game installs and launches as a native Android app (Android App Bundle, built via Capacitor) with a configured splash screen, status bar, and orientation locked to portrait.
  2. Pressing the Android hardware/gesture back button never silently ends a run — it always routes to confirm-before-quit or in-game navigation instead.
  3. Backgrounding, force-closing, or losing the app mid-run and reopening it resumes the run exactly where the player left off, because a save is written after every action/beat and on every app lifecycle interruption.
  4. Run state, best depth/high score, and the graveyard of past characters are stored in durable native storage (Capacitor Preferences, not browser `localStorage`) behind a versioned schema with an integrity check, and all three survive an app restart.

**Plans**: 4/4 plans executed

Plans:

- [x] 02-01-PLAN.md — Shared async Storage abstraction + legacy-key migration + Wave-0 persistence tests (SAV-01..05)
- [x] 02-02-PLAN.md — Native toolchain (Temurin 17 + android-36) + Capacitor scaffold + webDir build script + bare headless build (PLT-01)
- [x] 02-03-PLAN.md — Dual-write convergence onto durable storage + async autosave + back-button + lifecycle flush (SAV-01/02/04/05, PLT-02/03)
- [x] 02-04-PLAN.md — Native chrome (splash/status-bar/portrait/icon) + self-hosted offline fonts + green assembleDebug+bundleDebug build gate (PLT-01/04)

**UI hint**: yes

### Phase 3: Endless Descent & Difficulty Balance

**Goal**: The fixed 5-floor Gate ending is replaced with an endless, tuned descent — a 100%-dice-rolled character descends procedurally-generated floors of scaling difficulty until permadeath, with sessions resolving in roughly 5-10 minutes.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05
**Success Criteria** (what must be TRUE):

  1. Starting a run generates a 100%-dice-rolled character with zero player choices and reveals it before descent begins.
  2. The player can keep descending procedurally-generated floors indefinitely — there is no floor cap and no Gate ending.
  3. Played out across a sample of runs to floor 30-50+, difficulty scales along a tuned curve with soft-cap/breather floors, so a typical run resolves in about 5-10 minutes and never feels trivially easy or unfairly unwinnable.
  4. Character death is permanent for that character — there is no revive, undo, or continue.
  5. From the death screen, a single tap starts a fresh dice-rolled run.

**Plans**: 3/3 plans executed

Plans:

- [x] 03-01-PLAN.md — Difficulty-curve module (engine/difficulty.js, bounded soft-cap) + property tests + headless tuning harness (RUN-03)
- [x] 03-02-PLAN.md — Bounded genFloor + endless descent (gate→exit, legacy gate→descend, winGame retired) + fairness/determinism/combat-regression tests (RUN-02, RUN-03, RUN-04)
- [x] 03-03-PLAN.md — One-tap new-run loop + best-depth tracking (adapter + mazeworld.html) + RUN-01/04/05 coverage tests (RUN-01, RUN-04, RUN-05)

### Phase 4: Mobile Presentation, Controls & Onboarding

**Goal**: The game feels native and approachable on a phone — mobile-native touch controls, DPI-correct and safe-area-aware rendering, readable/accessible UI, and an in-context tutorial replace the prototype's assumption of rules knowledge.
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08
**Success Criteria** (what must be TRUE):

  1. The player can move and act via tap/contextual touch controls, and can switch to the prototype's D-pad as an alternate control scheme.
  2. Every interactive touch target meets a minimum ≥48dp hit size with spacing that keeps destructive actions from being triggered by an adjacent mis-tap.
  3. The maze canvas renders crisply at device DPI, respects safe areas/notches, and stays locked to portrait.
  4. The player can open a character/stat sheet (class, race, stats, kit, skills) and a scrollable message/combat log at any point during a run.
  5. A first-run, in-context tutorial teaches move/fight/descend/survive without a wall of text, the player can adjust sound, haptics, text size, control scheme, and confirm-before-quit in settings, and status indicators are colorblind-safe with scalable UI text throughout.

**Plans**: 6/11 plans executed

Plans (ordered by wave):

- [x] 04-01-PLAN.md — Touch-control + canvas-sizing math (controls.js, canvasSizing.js) [W1] [UX-01, UX-03]
- [x] 04-02-PLAN.md — Settings/text-scale/confirm-quit module (settings.js) [W1] [UX-07, UX-08, UX-01]
- [x] 04-03-PLAN.md — Screen view-models + tutorial sequencer + icon loader [W1] [UX-04, UX-05, UX-06]
- [x] 04-04-PLAN.md — formatEvents full-coverage data table + coverage guard [W1] [UX-05, engine-routing prereq]
- [x] 04-11-PLAN.md — Persistence-key rename mazeworld.*.v1→ddr.*.v1 (no shim) + product-name cleanup [W2] [UX-04, UX-07, folded-in rename]
- [x] 04-05-PLAN.md — Dark torch-lit shell: fonts + 5-tab nav + real-state HUD + safe-area + dark status bar + GAME_NAME "Delve, Die, Repeat" [W3] [UX-03, UX-08]
- [ ] 04-06-PLAN.md — DPR canvas viewport + 9 PNG icons + tap-to-move + D-pad [W4] [UX-01, UX-02, UX-03]
- [ ] 04-07-PLAN.md — Engine-routing completion: combat/economy/camp/new-run through applyAction [W5] [UX-05, deferred Phase-1/3 item]
- [ ] 04-08-PLAN.md — Character sheet + Oracle log + full-screen combat, dice transparency [W6] [UX-04, UX-05, UX-02]
- [ ] 04-09-PLAN.md — Settings screen + @capacitor/haptics + confirm-quit gating + live text-scale [W7] [UX-07, UX-08, UX-02]
- [ ] 04-10-PLAN.md — First-run coach-mark tutorial overlay [W8] [UX-06]

**UI hint**: yes

### Phase 5: Voice, Content & Graveyard

**Goal**: The game's core comedic identity — sarcastic, dark-but-family-friendly copy generated from structured game events — is built as a data-driven system and verified safe before the content is considered final.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: VOX-01, VOX-02, VOX-03
**Success Criteria** (what must be TRUE):

  1. Death epitaphs, Oracle/event-log lines, and item flavor text are generated by a data-driven voice system keyed to structured game events (death cause, class/race, depth) rather than hardcoded per-scenario strings.
  2. A batch-generated sample of procedural flavor-text combinations has been reviewed and confirmed family-friendly (no profanity or gore) before the content is treated as final.
  3. The player can open a graveyard/run-history screen showing past adventurers, how they died, and their sarcastic epitaphs, and this history persists across app restarts.

**Plans**: 3 plans

Plans:

- [ ] 05-01-PLAN.md — Voice generator foundation: category-keyed event→copy map (all ~158 engine types, coverage-guarded), presentation-local RNG, first-pass banks + tone guide (VOX-01)
- [ ] 05-02-PLAN.md — Variant breadth + narrate() wired into the live Oracle log + exhaustive family-friendly safety scan + vendored wordlist + human-review sample (VOX-01, VOX-02)
- [ ] 05-03-PLAN.md — Graveyard/run-history screen: re-fetch-on-open fix + all-causes persistence round-trip + ship presentation/ to the build (VOX-03)

**UI hint**: yes

### Phase 6: Google Play Compliance & Launch

**Goal**: Mazeworld is signed, tested on real devices, compliant with Google Play policy, and published to production as a paid title.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5
**Requirements**: STR-01, STR-02, STR-03, STR-04, STR-05, STR-06
**Success Criteria** (what must be TRUE):

  1. A completed Data Safety form accurately declares no data collection, backed by an actual dependency/SDK audit of the shipped build.
  2. An IARC content rating has been obtained using real sampled flavor text, correctly reflecting the game's dark-humor-but-family-friendly tone.
  3. A published privacy policy is linked from the store listing, and the app is configured as paid-upfront with zero ad/IAP/analytics SDKs bundled.
  4. A signed Android App Bundle (Play App Signing) has been validated by real testers on real devices via the Play internal testing track.
  5. The Google Play store listing (title, description, screenshots, icon, feature graphic) is complete and the app is published to production.

**Plans**: TBD

## Progress

**Execution Order (re-sequenced 2026-09-08):** 1 ✓ → 3 ✓ → 2 ✓ → **4 (UI, NEXT)** → 5 (voice, deferred after 4) → 6 (Play launch, when $25 account ready). User has a working native build on a real device (Pixel 7, wireless adb) and chose to bring the mobile UX (Claude Design + provided map icons + touch controls + onboarding) forward ahead of the voice phase. Phase 5 is fully planned + plan-checked (PASS) and ready whenever it's resumed.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine Extraction & Determinism | 10/10 | Complete ✓ | 2026-09-08 |
| 2. Android Packaging & Native Persistence | 4/4 | Complete ✓ | 2026-09-08 |
| 3. Endless Descent & Difficulty Balance | 3/3 | Complete ✓ | 2026-09-08 |
| 4. Mobile Presentation, Controls & Onboarding | 6/11 | In Progress|  |
| 5. Voice, Content & Graveyard | 0/3 | Planned + checked (PASS) — deferred to AFTER Phase 4 (user re-prioritized 2026-09-08) | - |
| 6. Google Play Compliance & Launch | 0/TBD | Deferred — needs $25 Play account + release signing (final phase) | - |

> **Execution order (re-adjusted 2026-09-08 — user installed Android Studio):** 1 ✓ → 3 ✓ → **2 (now unblocked)** → 5 → then 4 & 6 when a device/emulator visual test and Google Play account are ready. Phase 2's code + a headless debug build are automatable; the emulator/device visual test and release signing are UAT/user steps.
>
> **Build environment (probed 2026-09-08):** Node v22.23.2 + npm 10.9.8 (registry reachable); JDK — **both** system Java AND Android Studio's bundled JBR are **JDK 25** (`C:\Program Files\Android\Android Studio\jbr`, openjdk 25.0.3). JDK 25 is very new for the Android Gradle Plugin — **Phase 2 research must pin the exact Capacitor-8 Gradle/AGP version and confirm it supports JDK 25; if not, install a JDK 21 (Temurin) and point Gradle at it** via `org.gradle.java.home`. Since this Android Studio (2026) bundles JBR 25, its matching AGP/Gradle likely supports 25 — but verify with a real `./gradlew` build, don't assume; **Android SDK installed at `%LOCALAPPDATA%\Android\Sdk`** (build-tools, platforms, platform-tools, emulator, **licenses already accepted**) — set `ANDROID_HOME`/`ANDROID_SDK_ROOT` to it (not currently exported); Android Studio at `C:\Program Files\Android\Android Studio`. `sdkmanager`/`adb`/`emulator` are in the SDK dir but not on PATH (invoke by full path or add to PATH).
