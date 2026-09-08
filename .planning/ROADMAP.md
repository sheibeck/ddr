# Roadmap: Mazeworld

## Overview

Mazeworld ports a complete, proven ~3,300-line vanilla-JS/HTML/canvas roguelike (`mazeworld.html`) into a paid, offline, native Android game on Google Play. The ruleset is not being rebuilt — it's being extracted behind a clean, deterministic, serializable engine boundary, then wrapped, converted from a fixed 5-floor game to an endless depth-chase, dressed in mobile-native presentation and the game's sarcastic voice, and finally taken through Google Play compliance to a live store listing. The path front-loads the two highest-leverage, highest-risk moves — decoupling the engine and getting a real native build onto a real device early — so that endless-mode balance, mobile UX, and voice/content work happen against a stable foundation instead of a moving one, and store submission lands as a distinct, gated final phase rather than a scramble at the end.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Engine Extraction & Determinism** - The full ruleset runs behind a single deterministic, serializable `applyAction` contract with zero gameplay regressions
- [ ] **Phase 2: Android Packaging & Native Persistence** - The game installs as a native Android app that reliably autosaves and resumes on a real device
- [ ] **Phase 3: Endless Descent & Difficulty Balance** - Players descend an endless, fairly-paced maze instead of a fixed 5-floor Gate
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

**Plans**: 1/10 plans executed

- [x] 01-01-PLAN.md — Scaffold + seeded RNG + dice resolver + static determinism/purity guards
- [ ] 01-02-PLAN.md — Content extraction: all rules tables → pure data + dice-notation
- [ ] 01-03-PLAN.md — Parity harness infra + frozen golden master (node:vm)
- [ ] 01-04-PLAN.md — Maze generation (genFloor/bfs/reveal), RNG-injected + determinism
- [ ] 01-05-PLAN.md — Engine core (applyAction + validation) + character gen, derived numbers & leveling
- [ ] 01-06-PLAN.md — Items/treasure & death/graveyard helpers + fail-closed save validation
- [ ] 01-07-PLAN.md — Movement slice + round-trip guardrail + browser adapter (walking skeleton)
- [ ] 01-08-PLAN.md — Combat slice (encounters, strikes, foe turns, flee/parley/sing)
- [ ] 01-09-PLAN.md — Magic, potions & scrolls slice
- [ ] 01-10-PLAN.md — Economy/store (closures→data) + encounters/traps/chests + full-suite green

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

**Plans**: TBD
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

**Plans**: TBD

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

**Plans**: TBD
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

**Plans**: TBD
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

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine Extraction & Determinism | 1/10 | In Progress|  |
| 2. Android Packaging & Native Persistence | 0/TBD | Not started | - |
| 3. Endless Descent & Difficulty Balance | 0/TBD | Not started | - |
| 4. Mobile Presentation, Controls & Onboarding | 0/TBD | Not started | - |
| 5. Voice, Content & Graveyard | 0/TBD | Not started | - |
| 6. Google Play Compliance & Launch | 0/TBD | Not started | - |
