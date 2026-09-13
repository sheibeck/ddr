# Requirements: Mazeworld

**Defined:** 2026-09-07
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Platform:** Android / Google Play only (iOS out of scope). Paid-upfront, fully offline, solo. Multiplayer deferred to v2.

## v1 Requirements

Requirements for the initial paid Google Play release. Each maps to a roadmap phase.

### Engine (foundation)

- [x] **ENG-01**: Game rules (character gen, movement, combat, magic, economy, leveling, death, descent) run in a UI-free engine reached only through a single `applyAction(state, action) → {state, events}` contract — no rendering, storage, or DOM inside the engine
- [x] **ENG-02**: All randomness uses an injected seeded PRNG stored in game state (no direct `Math.random()`), so any run is reproducible from its seed
- [x] **ENG-03**: Game content (classes, subclasses, races, spells, creatures, items, traps, afflictions, epitaphs) lives in pure data tables separated from game logic
- [x] **ENG-04**: Full game state serializes and rehydrates losslessly, verified by a serialize/rehydrate round-trip test kept green throughout development
- [x] **ENG-05**: The complete prototype ruleset is preserved with no gameplay regressions (3 classes / 24 subclasses / 6 races / 31 spells / ~45 creatures / dozens of items / economy)

### Run Loop (endless roguelike)

- [x] **RUN-01**: Starting a run generates a 100%-dice-rolled character with no player choices, then reveals it on a character sheet
- [x] **RUN-02**: The player descends procedurally-generated floors endlessly, with no fixed floor cap or Gate ending
- [x] **RUN-03**: Difficulty scales with depth along a tuned curve (soft-cap / breather floors) so a typical run resolves in ~5–10 minutes and never becomes a trivial or unbeatable wall
- [x] **RUN-04**: Character death is permanent and ends the run (permadeath)
- [x] **RUN-05**: After death, the player can start a fresh run in a single tap from a death screen

### Save & Persistence

- [x] **SAV-01**: The current run auto-saves after every action/beat and whenever the app is backgrounded
- [x] **SAV-02**: The player can be interrupted or fully close and reopen the app and resume the run exactly where they left off
- [x] **SAV-03**: Saves use durable native storage (Capacitor Preferences, not browser `localStorage`) with a versioned schema and an integrity check
- [x] **SAV-04**: The player's best depth / high score persists across runs and app restarts
- [x] **SAV-05**: A persistent graveyard records past characters and how they died, surviving app restarts

### Mobile UX (controls, rendering, screens)

- [x] **UX-01**: The player moves and acts via tap / contextual touch controls, with the prototype's D-pad available as an alternate control scheme
- [x] **UX-02**: All interactive touch targets meet a minimum hit size (≥48dp) with spacing that separates destructive actions from safe ones, preventing mis-tap deaths
- [x] **UX-03**: The maze canvas renders crisply at device DPI and the layout respects safe areas/notches, locked to portrait
- [x] **UX-04**: The player can view a character/stat sheet showing their rolled adventurer's class, race, stats, kit, and skills
- [x] **UX-05**: The player can read a scrollable message/combat log
- [x] **UX-06**: A first-run, in-context tutorial teaches the core loop (move, fight, descend, survive) without a wall of text
- [x] **UX-07**: The player can adjust settings: sound, haptics, text size, control scheme, and confirm-before-quit
- [x] **UX-08**: Status indicators are colorblind-safe (icon + color, not color alone) and UI text scales for readability

### Voice & Content (identity)

- [ ] **VOX-01**: A data-driven voice system generates the game's sarcastic, dark-but-family-friendly copy (death epitaphs, event/Oracle log lines, item flavor) keyed to structured game events (death cause, class/race, depth)
- [ ] **VOX-02**: A batch tone/rating QA pass validates the procedural flavor-text combinations stay family-friendly (no profanity/gore) before rating is finalized
- [ ] **VOX-03**: The player can review a graveyard / run-history screen showing past adventurers and their epitaphs

### Platform (Android packaging)

- [x] **PLT-01**: The web game is packaged as an installable native Android app via Capacitor (produces an Android App Bundle)
- [x] **PLT-02**: The Android hardware/gesture back button is handled explicitly and never silently ends a run (routes to confirm-before-quit / in-game navigation)
- [x] **PLT-03**: App lifecycle events (background/foreground/interruption) persist run state and resume cleanly
- [x] **PLT-04**: Native chrome is configured — splash screen, status bar, and locked portrait orientation

### Store & Launch (Google Play)

- [ ] **STR-01**: A completed Google Play Data Safety form accurately declares no data collection (fully offline, on-device), derived from a real dependency audit
- [ ] **STR-02**: An IARC content rating is obtained, mapped from real sampled flavor text (dark humor calibrated correctly)
- [ ] **STR-03**: A privacy policy is published and linked from the listing
- [ ] **STR-04**: The app is configured as a paid (upfront) title with zero ad/IAP/analytics SDKs bundled
- [ ] **STR-05**: A signed Android App Bundle is produced via Play App Signing and validated through the Play internal testing track on real devices
- [ ] **STR-06**: The Google Play store listing (title, description, screenshots, icon, feature graphic) is complete and the app is published to production

### Party / Joiners (inserted milestone — executes NEXT, before launch)

Introduces the single-player party system (the multiplayer-ready foundation). Generalizes the two half-built ally footholds (inert persistent `c.joiner`, invulnerable combat-only `C.ally`) into a real, damageable, serialized party. Decisions locked 2026-09-09: **v1 cap = 1 joiner** (model built for N); **lifecycle = permadeath-when-downed, else leaves after a while**; **canon XP split among participants, hero keeps all loot** (joiners are hired muscle, no separate progression). See `.planning/research/SUMMARY.md`. Networked co-op stays v2 ([MP-01]/[MP-02]).

- [ ] **PARTY-01**: The player can recruit an NPC "Joiner" — a fully-rolled adventurer (its own class/race/level/gear/HP) — through the Joiner encounter's accept/decline offer (declining leaves them behind, per rulebook canon)
- [ ] **PARTY-02**: A recruited joiner persists in the run's saved state (a party roster) and survives app close/reopen; pre-existing saves default to an empty party with no data loss
- [ ] **PARTY-03**: In combat, the joiner auto-acts each round using its own strike math (no per-member micro-management), alongside the hero
- [ ] **PARTY-04**: Foes can target either the hero or the joiner, and the joiner has its own HP that takes damage and can reach 0
- [ ] **PARTY-05**: A joiner beaten to 0 HP permanently dies and departs the run (with an on-tone line) and NEVER triggers the hero's death/run-end; a surviving joiner eventually leaves on its own after a while
- [ ] **PARTY-06**: XP from kills splits among all participants who fought (a joiner reduces the hero's per-kill share, per canon); the hero holds all wilmst/loot (joiners carry no separate inventory or progression in v1)
- [ ] **PARTY-07**: A party rail shows the active joiner's identity, HP, and status during play (shown only when a joiner is present, legible in portrait on a phone)
- [ ] **PARTY-08**: The party is capped at ONE joiner in v1, with the underlying model built to support additional members later without a save break
- [ ] **PARTY-09**: Joiner flavor (join / kill / downed / leave) is sarcastic and family-friendly, reusing the game's voice
- [ ] **PARTY-10**: The difficulty curve accounts for added party power, retuned in a SINGLE consolidated balance pass coordinated with the Economy & Item Balancing and Monster Balancing milestones (no triple-retune)

> **Cross-cutting engine constraint (not a separate REQ — governed by ENG-02/ENG-04):** every party change keeps the engine pure/deterministic and the parity suite byte-identical for an empty party — new rng draws gated behind party size, new serialized fields carved out in `comparables.js` (mirror `stripDarkForField`), the frozen `prototype-master.js.txt` never edited.

### Economy & Item Balancing (inserted milestone — after Joiners, before launch)

Turns the loot/economy loop into a real system: bags/carry-capacity, manual inventory (replacing auto-take-best), a sell economy, item review/wiring, and conservative economy-number fixes. Research: `.planning/research/economy-SUMMARY.md`. **Scope decision (2026-09-09): mechanics + CONSERVATIVE first-pass numbers** — deep economy tuning (harness-driven) + the GLOBAL difficulty retune are DEFERRED (the latter to the consolidated cross-milestone pass). Defaults locked: rations cap = book 10/20/40/60 as ration-days; starting gold stays flat 50 for now; ex-large carry-gate = flavor; equip = direct swap. Folds in DR15-A (Language/Helm), DR15-D (potion use-affordance/ether), DR16-G (Amulet-of-Stone 4-target).

- [ ] **ECON-01**: Every character starts with a class-derived bag whose capacity caps item slots (4/6/8/10), a wilmst cap, and a rations cap; every carried (non-equipped) item takes a slot
- [ ] **ECON-02**: Bags/carry state persists and rehydrates losslessly; pre-existing saves migrate to a default bag with no data loss
- [ ] **ECON-03**: On finding an item, the player chooses whether to take it (no auto-grab)
- [ ] **ECON-04**: When the bag is full, the player chooses which items to keep and which to drop
- [ ] **ECON-05**: The player can manually equip items from the bag — including gear inferior to what's worn — while class/subclass/race equip restrictions stay enforced (can't equip what you can't use)
- [ ] **ECON-06**: The player can sell any carried item at a store, which lists all carried gear with sell prices
- [ ] **ECON-07**: Combat-usable carried items are usable from the combat bar (E2), sharing one carried-item list component with the store-sell list
- [ ] **ECON-08**: Every item either has a working, wired effect or is deliberately retired; currently-inert item effects (Helm of Knowledge/`tongue`, Cloaks of Healing/Regeneration/Strength, Pendant of Fortitude, Amulet of Light `light`, Amulet of Stone's 4-target) are fixed; treasure items carry a base value for pricing
- [ ] **ECON-09**: Over-generous/obviously-off economy numbers get a conservative first-pass fix (the +3000 wilmst red-dot reward depth-scaled with NO new rng draw; egregious costs) — deep balance deferred to on-device playtesting
- [ ] **ECON-10**: The three bag caps (slots/wilmst/rations) are set to sensible v1 values, all left as documented tuning knobs

> **Cross-cutting engine constraint (ENG-02/ENG-04):** new serialized fields (`c.bag`, `state.pendingFind`) get parity carve-outs (mirror `stripDarkForField`); capacity clamps + any new behavior live ONLY in new gated action handlers, never retrofitted into the ported paths the frozen fixtures replay; reward-amount retunes add NO rng draw (flat/derived); `prototype-master.js.txt` never edited; the GLOBAL `difficulty.js` foe-scaling retune is explicitly OUT of scope (deferred).

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
| ENG-01 | Phase 1: Engine Extraction & Determinism | Complete |
| ENG-02 | Phase 1: Engine Extraction & Determinism | Complete |
| ENG-03 | Phase 1: Engine Extraction & Determinism | Complete |
| ENG-04 | Phase 1: Engine Extraction & Determinism | Complete |
| ENG-05 | Phase 1: Engine Extraction & Determinism | Complete |
| PLT-01 | Phase 2: Android Packaging & Native Persistence | Complete |
| PLT-02 | Phase 2: Android Packaging & Native Persistence | Complete |
| PLT-03 | Phase 2: Android Packaging & Native Persistence | Complete |
| PLT-04 | Phase 2: Android Packaging & Native Persistence | Complete |
| SAV-01 | Phase 2: Android Packaging & Native Persistence | Complete |
| SAV-02 | Phase 2: Android Packaging & Native Persistence | Complete |
| SAV-03 | Phase 2: Android Packaging & Native Persistence | Complete |
| SAV-04 | Phase 2: Android Packaging & Native Persistence | Complete |
| SAV-05 | Phase 2: Android Packaging & Native Persistence | Complete |
| RUN-01 | Phase 3: Endless Descent & Difficulty Balance | Complete |
| RUN-02 | Phase 3: Endless Descent & Difficulty Balance | Complete |
| RUN-03 | Phase 3: Endless Descent & Difficulty Balance | Complete |
| RUN-04 | Phase 3: Endless Descent & Difficulty Balance | Complete |
| RUN-05 | Phase 3: Endless Descent & Difficulty Balance | Complete |
| UX-01 | Phase 4: Mobile Presentation, Controls & Onboarding | Complete |
| UX-02 | Phase 4: Mobile Presentation, Controls & Onboarding | Complete |
| UX-03 | Phase 4: Mobile Presentation, Controls & Onboarding | Complete |
| UX-04 | Phase 4: Mobile Presentation, Controls & Onboarding | Complete |
| UX-05 | Phase 4: Mobile Presentation, Controls & Onboarding | Complete |
| UX-06 | Phase 4: Mobile Presentation, Controls & Onboarding | Complete |
| UX-07 | Phase 4: Mobile Presentation, Controls & Onboarding | Complete |
| UX-08 | Phase 4: Mobile Presentation, Controls & Onboarding | Complete |
| VOX-01 | Phase 5 (satisfied by DR work: eventNarration.js + coverage guard) | Complete |
| VOX-02 | Phase 5: Voice, Content & Graveyard (safety-scan guardrail) | Complete |
| VOX-03 | Phase 5 (satisfied by 04.2 E9/E12: graveyard re-fetch + rework) | Complete |
| STR-01 | Phase 6: Google Play Compliance & Launch | Pending |
| STR-02 | Phase 6: Google Play Compliance & Launch | Pending |
| STR-03 | Phase 6: Google Play Compliance & Launch | Pending |
| STR-04 | Phase 6: Google Play Compliance & Launch | Pending |
| STR-05 | Phase 6: Google Play Compliance & Launch | Pending |
| STR-06 | Phase 6: Google Play Compliance & Launch | Pending |
| PARTY-01 | Phase 9: Joiner Acquisition + Voice | Pending |
| PARTY-02 | Phase 7: Party Model + Save Migration + Parity Carve-outs | Pending |
| PARTY-03 | Phase 8: Party Combat | Pending |
| PARTY-04 | Phase 8: Party Combat | Pending |
| PARTY-05 | Phase 8: Party Combat | Pending |
| PARTY-06 | Phase 8: Party Combat | Pending |
| PARTY-07 | Phase 10: Party UI | Pending |
| PARTY-08 | Phase 7: Party Model + Save Migration + Parity Carve-outs | Pending |
| PARTY-09 | Phase 9: Joiner Acquisition + Voice | Pending |
| PARTY-10 | Phase 11: Party Balance (consolidated) | Pending |
| ECON-01 | Phase 12: Carry Model + Migration | Complete |
| ECON-02 | Phase 12: Carry Model + Migration | Complete |
| ECON-03 | Phase 13: Inventory Actions + UI | Complete |
| ECON-04 | Phase 13: Inventory Actions + UI | Complete |
| ECON-05 | Phase 13: Inventory Actions + UI | Complete |
| ECON-06 | Phase 14: Store Sells All Gear | Complete |
| ECON-07 | Phase 14: Store Sells All Gear (E2) | Complete |
| ECON-08 | Phase 15: Item Audit + Inert Wiring | Complete |
| ECON-09 | Phase 16: Economy-Local Conservative Tuning | Complete |
| ECON-10 | Phase 16: Economy-Local Conservative Tuning | Complete |

**Coverage:**

- v1 core requirements: 36 (ENG×5, RUN×5, SAV×5, UX×8, VOX×3, PLT×4, STR×6) — mapped 36/36 ✓
- Party / Joiners (inserted milestone, executes before launch): 10 (PARTY×10) — mapped 10/10 ✓
- Total mapped: 46/46 ✓ · Unmapped: 0
- (Inserted BUGFIX phases 04.1 Rules Review + 04.2 Bug Fixes & Text Polish are device-review batches tracked in ROADMAP, not in this REQ traceability.)

---
*Requirements defined: 2026-09-07*
*Last updated: 2026-09-09 — added Party / Joiners milestone requirements (PARTY-01..10), mapped to Phases 7–11.*
