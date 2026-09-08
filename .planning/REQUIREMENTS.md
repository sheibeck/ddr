# Requirements: Mazeworld

**Defined:** 2026-09-07
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Platform:** Android / Google Play only (iOS out of scope). Paid-upfront, fully offline, solo. Multiplayer deferred to v2.

## v1 Requirements

Requirements for the initial paid Google Play release. Each maps to a roadmap phase.

### Engine (foundation)

- [ ] **ENG-01**: Game rules (character gen, movement, combat, magic, economy, leveling, death, descent) run in a UI-free engine reached only through a single `applyAction(state, action) → {state, events}` contract — no rendering, storage, or DOM inside the engine
- [ ] **ENG-02**: All randomness uses an injected seeded PRNG stored in game state (no direct `Math.random()`), so any run is reproducible from its seed
- [ ] **ENG-03**: Game content (classes, subclasses, races, spells, creatures, items, traps, afflictions, epitaphs) lives in pure data tables separated from game logic
- [ ] **ENG-04**: Full game state serializes and rehydrates losslessly, verified by a serialize/rehydrate round-trip test kept green throughout development
- [ ] **ENG-05**: The complete prototype ruleset is preserved with no gameplay regressions (3 classes / 24 subclasses / 6 races / 31 spells / ~45 creatures / dozens of items / economy)

### Run Loop (endless roguelike)

- [ ] **RUN-01**: Starting a run generates a 100%-dice-rolled character with no player choices, then reveals it on a character sheet
- [ ] **RUN-02**: The player descends procedurally-generated floors endlessly, with no fixed floor cap or Gate ending
- [ ] **RUN-03**: Difficulty scales with depth along a tuned curve (soft-cap / breather floors) so a typical run resolves in ~5–10 minutes and never becomes a trivial or unbeatable wall
- [ ] **RUN-04**: Character death is permanent and ends the run (permadeath)
- [ ] **RUN-05**: After death, the player can start a fresh run in a single tap from a death screen

### Save & Persistence

- [ ] **SAV-01**: The current run auto-saves after every action/beat and whenever the app is backgrounded
- [ ] **SAV-02**: The player can be interrupted or fully close and reopen the app and resume the run exactly where they left off
- [ ] **SAV-03**: Saves use durable native storage (Capacitor Preferences, not browser `localStorage`) with a versioned schema and an integrity check
- [ ] **SAV-04**: The player's best depth / high score persists across runs and app restarts
- [ ] **SAV-05**: A persistent graveyard records past characters and how they died, surviving app restarts

### Mobile UX (controls, rendering, screens)

- [ ] **UX-01**: The player moves and acts via tap / contextual touch controls, with the prototype's D-pad available as an alternate control scheme
- [ ] **UX-02**: All interactive touch targets meet a minimum hit size (≥48dp) with spacing that separates destructive actions from safe ones, preventing mis-tap deaths
- [ ] **UX-03**: The maze canvas renders crisply at device DPI and the layout respects safe areas/notches, locked to portrait
- [ ] **UX-04**: The player can view a character/stat sheet showing their rolled adventurer's class, race, stats, kit, and skills
- [ ] **UX-05**: The player can read a scrollable message/combat log
- [ ] **UX-06**: A first-run, in-context tutorial teaches the core loop (move, fight, descend, survive) without a wall of text
- [ ] **UX-07**: The player can adjust settings: sound, haptics, text size, control scheme, and confirm-before-quit
- [ ] **UX-08**: Status indicators are colorblind-safe (icon + color, not color alone) and UI text scales for readability

### Voice & Content (identity)

- [ ] **VOX-01**: A data-driven voice system generates the game's sarcastic, dark-but-family-friendly copy (death epitaphs, event/Oracle log lines, item flavor) keyed to structured game events (death cause, class/race, depth)
- [ ] **VOX-02**: A batch tone/rating QA pass validates the procedural flavor-text combinations stay family-friendly (no profanity/gore) before rating is finalized
- [ ] **VOX-03**: The player can review a graveyard / run-history screen showing past adventurers and their epitaphs

### Platform (Android packaging)

- [ ] **PLT-01**: The web game is packaged as an installable native Android app via Capacitor (produces an Android App Bundle)
- [ ] **PLT-02**: The Android hardware/gesture back button is handled explicitly and never silently ends a run (routes to confirm-before-quit / in-game navigation)
- [ ] **PLT-03**: App lifecycle events (background/foreground/interruption) persist run state and resume cleanly
- [ ] **PLT-04**: Native chrome is configured — splash screen, status bar, and locked portrait orientation

### Store & Launch (Google Play)

- [ ] **STR-01**: A completed Google Play Data Safety form accurately declares no data collection (fully offline, on-device), derived from a real dependency audit
- [ ] **STR-02**: An IARC content rating is obtained, mapped from real sampled flavor text (dark humor calibrated correctly)
- [ ] **STR-03**: A privacy policy is published and linked from the listing
- [ ] **STR-04**: The app is configured as a paid (upfront) title with zero ad/IAP/analytics SDKs bundled
- [ ] **STR-05**: A signed Android App Bundle is produced via Play App Signing and validated through the Play internal testing track on real devices
- [ ] **STR-06**: The Google Play store listing (title, description, screenshots, icon, feature graphic) is complete and the app is published to production

## v2 Requirements

Deferred to future releases. Tracked but not in the current roadmap.

### Multiplayer

- **MP-01**: Online "play with friends" co-op/party mode wrapping the same rules engine
- **MP-02**: Platform identity (Google Play Games) for multiplayer, instead of custom accounts

### Meta & Replay

- **META-01**: Non-power "knowledge" unlocks (bestiary/compendium) that don't affect balance
- **META-02**: Shareable run-summary card for organic marketing
- **META-03**: Daily / seeded challenge runs with shared seeds
- **META-04**: Touch QoL — interruptible auto-explore and rest-until-healed

### Content Expansion

- **CONT-01**: Ported-back tabletop systems (bag/carry-weight, shields, thrown weapons, richer phobia/language tables)
- **CONT-02**: Narrative/lore/story mode drawing on the rulebook's world (Felect, The Planes, the Wilmsry, the year-792 cataclysm)

### Platform Expansion

- **PLTX-01**: iOS / Apple App Store release

## Out of Scope

Explicitly excluded from the product. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Power-affecting meta-progression | Contradicts the decided pure-permadeath identity; local high-score is the hook |
| Accounts / logins / cloud save / servers (v1) | Fully offline v1; platform identity added later only if multiplayer needs it |
| Ads and in-app purchases | Paid-upfront model; keeps the build free of monetization SDKs and simplifies compliance |
| Player choice in character creation | 100%-dice-rolled is a deliberate identity choice ("play the hand you're dealt") |
| Maze Master / party / player-authored tabletop layer | Prototype already stubs these out for solo play |
| Original illustrated art / voiced audio as a launch gate | Prototype's procedural/typographic style is a viable shipping aesthetic |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (to be filled by roadmap) | — | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 33 ⚠️

---
*Requirements defined: 2026-09-07*
*Last updated: 2026-09-07 after initial definition*
