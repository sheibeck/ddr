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
- [ ] **Phases 7–11: Joiners / Party System** (INSERTED 2026-09-09 — executes NEXT, before launch) - Recruit an NPC joiner into a real, damageable, serialized party; the single-player foundation of the multiplayer-ready engine

> **Execution order (user directive 2026-09-09):** the remaining v1.0 work runs **Joiners (Phases 7–11) → Phase 4 tutorial (04-10, LAST) → Phase 5 Voice → Phase 6 Play launch**. Phase numbers are labels; this order is the source of truth.

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

**Plans**: 8/11 plans executed

Plans (ordered by wave):

- [x] 04-01-PLAN.md — Touch-control + canvas-sizing math (controls.js, canvasSizing.js) [W1] [UX-01, UX-03]
- [x] 04-02-PLAN.md — Settings/text-scale/confirm-quit module (settings.js) [W1] [UX-07, UX-08, UX-01]
- [x] 04-03-PLAN.md — Screen view-models + tutorial sequencer + icon loader [W1] [UX-04, UX-05, UX-06]
- [x] 04-04-PLAN.md — formatEvents full-coverage data table + coverage guard [W1] [UX-05, engine-routing prereq]
- [x] 04-11-PLAN.md — Persistence-key rename mazeworld.*.v1→ddr.*.v1 (no shim) + product-name cleanup [W2] [UX-04, UX-07, folded-in rename]
- [x] 04-05-PLAN.md — Dark torch-lit shell: fonts + 5-tab nav + real-state HUD + safe-area + dark status bar + GAME_NAME "Delve, Die, Repeat" [W3] [UX-03, UX-08]
- [x] 04-06-PLAN.md — DPR canvas viewport + 9 PNG icons + tap-to-move + D-pad [W4] [UX-01, UX-02, UX-03]
- [ ] 04-07-PLAN.md — Engine-routing completion: combat/economy/camp/new-run through applyAction [W5] [UX-05, deferred Phase-1/3 item]
- [ ] 04-08-PLAN.md — Character sheet + Oracle log + full-screen combat, dice transparency [W6] [UX-04, UX-05, UX-02]
- [x] 04-09-PLAN.md — Settings screen + @capacitor/haptics + confirm-quit gating + live text-scale [W7] [UX-07, UX-08, UX-02] (settings sheet/text-scale/confirm gates via DR9; haptics install+vendor+beat-wiring 2026-09-09, 499/499)
- [ ] 04-10-PLAN.md — First-run coach-mark tutorial overlay [W8] [UX-06]

**UI hint**: yes

### Phase 04.1: Rules Review & Wiring: every character-sheet stat affects gameplay — implement missing rules, adapt unimplementable ones, wire orphaned rules through existing systems, fix terminology (skill points to experience, win-potential to hit points, rations as rations), give phobias real effects (INSERTED)

**Goal:** Every character-sheet value that reads like it affects gameplay actually does. Fix terminology (skill points→experience, Win Potential/wp→Hit Points/hp — text-only, resolving the live HUD-says-HP-but-sheet-says-Win-Potential split); fix the `c.dr` dead-code bug that silently disables Thief Sewing + Fighter Master of Arms; decouple rations from the food/HP purchase (sell rations directly); wire Intelligence into a self-contained check; and give the 6 inert phobias bespoke, flavor-matched effects (incl. a real persistent darkness/fog-of-war state for the Darkness phobia). Engine stays pure/deterministic; no state-field/event renames; scroll type-system deferred.
**Requirements**: TERM-01, TERM-02, RULE-01, RULE-02, RATION-01, PHOBIA-01
**Depends on:** Phase 4
**Plans:** 6/6 plans executed (Executed 2026-09-09, 535/535 tests green, deployed to Pixel 7; device UAT + gsd-verifier gate pending)

Plans:

- [x] 04.1-01-PLAN.md — Terminology: skill points→experience/XP, Win Potential/wp→Hit Points/hp (text-only, incl. engine store labels) [W1] [TERM-01, TERM-02]
- [x] 04.1-02-PLAN.md — Fix the c.dr dead-code gate (Thief Sewing armour patch) + implement Master of Arms "+2 with every weapon" [W1] [RULE-02]
- [x] 04.1-03-PLAN.md — Sell rations directly: food = pure HP heal, dedicated Rations store line, decouple findFood, surface ration changes [W2] [RATION-01]
- [x] 04.1-04-PLAN.md — Intelligence self-contained check: intelBonus helper (derived.js) applied to the openChest lock roll + sheet sync [W3] [RULE-01]
- [x] 04.1-05-PLAN.md — Phobia part A: persistent darkness state (fallDark→counter, inDark extension, fog-of-war shrink) + Darkness-phobia freeze [W4] [PHOBIA-01]
- [x] 04.1-06-PLAN.md — Phobia part B: Death (near-death panic), Being trapped, Heights, Bodies of water — bespoke Hardiness-halved effects [W5] [PHOBIA-01]

### Phase 04.2: Bug Fixes & Text Polish (INSERTED — device-review batch, 2026-09-09)

**Goal:** Consolidate the DR14 device-review bug/text batch (from the rules-text audit + live play) into one GSD phase. Fix the live bugs (poison-at-1hp loop, foe HP showing current/current, Oracle not clearing on new character, backstab "Critical" on a miss, inert Cloak-of-Armor, dead character missing from the Dead screen) and the text/terminology cleanup (Disease→Ailment bucket, duplicate Teleport, remaining SP→XP/WP→HP uppercase, raw-jargon narration leaks in tableFour/meetFaerie, wm→wilmst, cosmetic voice fixes) — plus the already-landed rules work (flying charge/cooldown, rest cure-roll, affliction narration kind). Engine stays pure/deterministic; player-facing text/UI only where noted; no state-field/event-type renames.
**Requirements**: BUGFIX (audit A1-A3 + P1/P2/P3 + E1,E3–E9; E2 deferred to the Economy & Item Balancing milestone)
**Depends on:** Phase 4.1
**Source of truth for the fix inventory:** `.planning/quick/20260909-rules-text-audit-pass/` — `FINDINGS.md` (audit P1/P2/P3 + A1-A3 + locked decisions), `EXTRA-SCOPE.md` (E1–E9), `SUMMARY-batch1.md` (landed rules work).
**Plans (executor batches — some already landed as pre-phase quick-task work, folded in here for GSD tracking):**

- [x] Batch 1 (rules) — flying charge/cooldown (A2), rest cure-roll (A3), affliction event `kind` (A1 engine) — DONE, 545/545 (`SUMMARY-batch1.md`)
- [x] Bugs A — E5 poison-loop auto-clear ✓, E6 clear Oracle on new character ✓, E4 foe HP current/max (defensive `maxWP` in `encounterStarted` event; couldn't repro in current source — watch on device) — DONE, 549/549, deployed
- [x] Bugs B — E7 Con-Artist opener no longer fakes "Critical" (now a sarcastic no-damage beat), E8 Cloak-of-Armor soaks as Plate (take-the-better, magical/non-degrading), E9 Dead tab re-fetches storage on open — DONE, 554/554, deployed
- [x] Graveyard Rework (E12, user-requested during DR14) — cap graveyard at last 5 shown/stored, non-clearable running total of all dead, clear button removed, no name reuse over last ~25 (determinism-safe: one seeded pick + no-rng forward-walk past excluded names) — DONE, 564/564, deployed
- [x] Text — A1 narration + Disease→Ailment bucket, E1 dup Teleport (→ `-10 HP`), E3 SP→XP/WP→HP (+ dual-purpose parsers), E10 (+3000 triple-message + `(tableFour)` why-leak removed), E11 `Skill pts`→XP gravestone label + epitaph editorial polish, P1 tableFour/meetFaerie jargon→prose + stripRollDetail scoping, P2 wm→wilmst, P3 cosmetics — DONE, 567/567 (parity 25/25), deployed

**Phase 04.2 COMPLETE 2026-09-09** — all batches built + deployed to the Pixel 7 (567/567 full suite, parity 25/25). E2 (combat-item use in the combat bar) deferred to the Economy & Item Balancing milestone. NEW balance items captured this session → milestone specs: **+3000 wilmst amount** (too generous) and the full **parley balance pass** (2.5× kill-XP + zero-risk + Con-Artist 75%@L1) → see Economy/Monster specs.

> **Proposed future milestones** (captured 2026-09-09; to be stood up via `/gsd-new-milestone` after the 04.1 device UAT + the in-flight rules-text-audit quick task land). BOTH affect game balance — coordinate the balance passes / decide order at planning time.
> 1. **"Economy & Item Balancing"** (`.planning/proposed-milestone-economy-item-balancing.md`) — bags/carry-capacity + inventory management (choose-to-take, keep/drop, **manual equip incl. inferior gear**, replacing auto-take-best) + store sells all carried gear + full item review & rebalance + economy cost balancing.
> 2. **"Joiners / Party System"** (`.planning/proposed-milestone-joiners-party-system.md`) — NPCs that join you; introduces the party system (the engine's multiplayer-ready foundation). **User wants this as the NEXT focus milestone.** Affects difficulty-curve + economy balance; builds on the existing `C.ally`/`allyStruck` hook.
> 3. **"Monster Balancing & Abilities"** (`.planning/proposed-milestone-monster-balancing.md`) — rebalance the bestiary + give foes new abilities incl. **magic/spellcasting** (foes can't cast today); retune the difficulty dial. RESEARCH-FIRST. Also unlocks the deferred 04.1 symmetric-INT spell-resistance (blocked until foes cast).
>
> **These 3 all move game balance** (party power / enemy power / gear-economy power) and interact with `engine/difficulty.js` (Phase 3 curve) — coordinate the balance passes / decide global order at the milestone-planning session. Open question: how they + the remaining v1.0 phases (tutorial, Voice, Play launch) sequence — before the Play launch or as post-launch v1.1+.

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

---

## Milestone: Joiners / Party System (Phases 7–11 — INSERTED 2026-09-09, executes NEXT, BEFORE launch)

Introduces the single-player party system — the multiplayer-ready foundation. Generalizes the two half-built ally footholds (inert persistent `c.joiner`, invulnerable combat-only `C.ally`) into a real, damageable, serialized party. **Research:** `.planning/research/{SUMMARY,STACK,FEATURES,ARCHITECTURE,PITFALLS}.md` (four-way HIGH-confidence convergence). **Locked decisions (2026-09-09):** v1 cap = **1 joiner** (model built for N); lifecycle = **permadeath-when-downed, else leaves after a while**; **canon XP split among participants, hero keeps all loot** (hired muscle, no separate progression). **Requirements:** PARTY-01..10.

> **EXECUTION ORDER (user directive 2026-09-09):** these Phases 7–11 run **NEXT** — before the still-pending v1.0 tail (Phase 4 first-run tutorial 04-10 → Phase 5 Voice → Phase 6 Play launch). Phase NUMBERS continue from 6 (GSD numbering); the sequence above is the source of truth, consistent with this project's prior re-sequenced execution orders. Networked co-op stays v2 (MP-01/02).
>
> **NON-NEGOTIABLE ENGINE GATE (every phase below):** engine stays pure/deterministic; the parity suite stays byte-identical for an EMPTY party — new rng draws gated behind party size (mirror the phobia `rng.d(2)` guard + today's null-`C.ally` `allyTurn`); new serialized fields carved out in `test/parity/harness/comparables.js` (mirror `stripDarkForField`); `prototype-master.js.txt` NEVER edited; new event types get `EVENT_NARRATION` entries (formatEventsCoverage guard). No git commits (device-review tree).

### Phase 7: Party Model + Save Migration + Parity Carve-outs
**Depends on:** Phase 1 (engine), Phase 2 (persistence). **Requirements:** PARTY-02, PARTY-08.
**Success Criteria:**
  1. A persistent party roster (top-level `state.party[]` of full `rollCharacter`-shaped sheets) exists in state and serializes/rehydrates losslessly (round-trip test green).
  2. Pre-existing saves (no party field) load with an empty party and zero data loss (migration via the `validateSave`/`rehydrate` whitelists; fail-open on malformed party data).
  3. The party is capped at 1 in v1 but the model + all iteration is written for N members.
  4. **Parity gate:** with an empty party, the full parity + unit suites are byte-identical to pre-change (new field stripped in all three `*Comparable()` fns).

### Phase 8: Party Combat — turn order, targeting, member HP, death fork
**Depends on:** Phase 7. **Requirements:** PARTY-03, PARTY-04, PARTY-05, PARTY-06.
**Success Criteria:**
  1. The persistent party syncs into a combat-scoped `C.allies[]` at `startCombat` and HP syncs back at `endCombat`; the joiner auto-acts each round with its own strike math (no player micro-management).
  2. Foes choose targets from a `[hero] + live members` pool; a joiner has its own HP that takes damage and can reach 0.
  3. A joiner at 0 HP is downed/departs the run and NEVER routes into the hero's `die()`/run-end; combat still terminates the instant `liveFoes()` clears (bounded loop, hard round ceiling).
  4. XP from a kill splits among participants (a joiner reduces the hero's per-kill share, per canon); wilmst/loot all go to the hero.
  5. **Parity/perf gate:** every new draw (member strike, foe target choice) is gated behind party size so solo fixtures draw ZERO new rng and stay byte-identical; new events have narration entries.

### Phase 9: Joiner Acquisition (accept/decline) + Voice
**Depends on:** Phase 8. **Requirements:** PARTY-01, PARTY-09.
**Success Criteria:**
  1. The Joiner encounter presents a real accept/decline choice; accepting recruits a fully-rolled adventurer (own class/race/level/gear/HP) into the roster; declining leaves them behind.
  2. Recruitment captures the character `meetJoiner` ALREADY rolls (zero new chargen rng); `c.joiner` continues to be set identically (frozen shape preserved).
  3. Join / kill / downed / leave moments emit sarcastic, family-friendly flavor in the game's voice (reusing the rolled temperament/motive).
  4. **Parity gate:** recruit-path rng fires only in the non-chargen encounter path, gated; empty-party runs unaffected.

### Phase 10: Party UI (turn the rail on)
**Depends on:** Phase 8 (live party/combat state). **Requirements:** PARTY-07.
**Success Criteria:**
  1. The design mock's party rail is turned on, data-driven on `party.length` (dropping the demo `partyOn` toggle) — shown only when a joiner is present, hidden when solo.
  2. The rail shows the joiner's identity, HP, and status legibly in portrait on a phone (reusing the Phase-4 status-chip pattern), threaded through the existing `window.__mzState` bridge (no new bridge).
  3. Verified on the Pixel 7 via a device-review checkpoint (no overflow, readable, no mis-tap hazards).

### Phase 11: Party Balance (consolidated, coordinated)
**Depends on:** Phases 8–10; **coordinate with** the Economy & Item Balancing and Monster Balancing milestones. **Requirements:** PARTY-10.
**Success Criteria:**
  1. `engine/difficulty.js` accounts for added party power (wandering-monster scaling already keys off highest party level) in a SINGLE consolidated retune — not a party-only pass.
  2. Per-member upkeep (rations) and the XP-split numbers are tuned so a joiner is a meaningful choice, not free power — using the Phase-3 tuning harness with party scenarios.
  3. The retune is sequenced ONCE across the three balance-touching milestones (no double/triple tuning); each other milestone touches only its local knobs.
  4. A typical party run still resolves in ~5–10 minutes and never becomes trivial or an unbeatable wall.

**Coverage:** PARTY-01→P9, PARTY-02→P7, PARTY-03→P8, PARTY-04→P8, PARTY-05→P8, PARTY-06→P8, PARTY-07→P10, PARTY-08→P7, PARTY-09→P9, PARTY-10→P11. All 10 mapped ✓.

---

> **ECONOMY & ITEM BALANCING = CODE-COMPLETE + DEPLOYED 2026-09-10 (666/666, parity 25/25 byte-identical throughout).** P12 Carry Model ✅ · P13 Inventory Actions ✅ (auto-take-best replaced) · P14 Store-Sell+E2 ✅ · P15 Item-Wiring ✅ (9 inert items wired incl. DR15-A/DR16-G) · P16 Conservative Tuning ✅ (+3000→300×depth). DEFERRED to the consolidated cross-milestone pass: deep economy tuning + the GLOBAL difficulty retune (with Joiners P11 + Monster Balancing). All on the Pixel 7.

## Milestone: Economy & Item Balancing (Phases 12–16 — INSERTED 2026-09-09, after Joiners, before launch)

Turns the loot/economy loop into a real system: bags/carry, manual inventory (replacing auto-take-best), sell economy, item review/wiring, conservative economy-number fixes. **Research:** `.planning/research/economy-SUMMARY.md` (HIGH confidence, rulebook p.9 bag table + code-cited). **Requirements:** ECON-01..10. **Scope (user, 2026-09-09):** mechanics + CONSERVATIVE first-pass numbers; deep harness tuning + the GLOBAL `difficulty.js` retune DEFERRED (the latter to the consolidated cross-milestone pass). **Locked defaults:** bag slots 4/6/8/10 + book wilmst caps + rations-days 10/20/40/60; starting gold stays 50; ex-large carry-gate = flavor; equip = direct swap. **Folds in:** DR15-A (Language/Helm), DR15-D (potion use-affordance/ether), DR16-G (Amulet-of-Stone 4-target), E2 (combat-item use).

> **NON-NEGOTIABLE ENGINE GATE (every phase):** engine pure/deterministic; parity byte-identical for empty/solo play — new serialized fields (`c.bag`, `state.pendingFind`) carved out in all 3 comparators (mirror `stripDarkForField`); capacity clamps + new behavior ONLY in new gated action handlers (never in ported `giveItem`/`takeItem`/`gainWilmst`); reward retunes add NO rng draw (flat/derived), regenerating only the specific economy-parity fixtures they change (deliberate divergence, RATION-01 style); `prototype-master.js.txt` NEVER edited; new event types get `EVENT_NARRATION` entries. GLOBAL `difficulty.js` foe-scaling UNTOUCHED.

### Phase 12: Carry Model + Migration (A)
**Depends on:** Phase 1 (engine), 2 (persistence). **Requirements:** ECON-01, ECON-02.
**Success criteria:** (1) `BAGS` content table + class-derived `c.bag` at chargen (plain assignment, NO rng); `state.pendingFind` field. (2) A gated `clampCarry(c)` helper — no-op when `!c.bag`. (3) Save defaults in `validateSave`/`rehydrate` (old saves → default bag, `pendingFind` null); no `STATE_VERSION` bump. (4) **Parity gate:** `stripBagField` + `pendingFind` strip in all 3 comparators; full parity byte-identical (clamp is a no-op on every frozen fixture); chargen-parity green with `c.bag` stripped.

### Phase 13: Inventory Actions + UI (B) — replaces auto-take-best
**Depends on:** Phase 12. **Requirements:** ECON-03, ECON-04, ECON-05.
**Success criteria:** (1) New PURE actions `takeFind`/`leaveFind`/`dropItem`/`equipItem`/`unequipSlot` (no rng); find callers (`openChest`/`findGear`/`findMisc`/`meetFaerie`) stash `pendingFind` + emit `findOffered` instead of auto-`takeItem`. (2) `equipItem` equips regardless of better/worse (deliberate rules change) but enforces class/subclass/race legality via `canEquipWeapon/Armor` extracted from `takeItem`; full bag → keep/drop prompt. (3) GEAR-tab keep/drop/equip UI + the find accept/decline prompt. (4) **Parity gate:** new actions touch no frozen fixture; ported find paths stay callable OR fixtures migrated with documented rationale; parity green; equip-restriction unit tests.

### Phase 14: Store Sells All Gear (C)
**Depends on:** Phases 12–13. **Requirements:** ECON-06, ECON-07.
**Success criteria:** (1) Pure `sellItem{i}` action + `sellPriceFor` (≈50% spread, race-adjusted, a tuning knob). (2) Store render gains a "Your gear" sell section listing `c.items` with Sell buttons; selling frees a slot + credits gold (bag-cap clamped). (3) ONE carried-item list component shared by the store-sell list AND the combat-bar use-list (E2 — `useItem` already wired). (4) **Parity gate:** sell is pure/no-rng, zero parity impact; sell-pricing + wilmst-cap unit tests.

### Phase 15: Item Audit + Inert-Effect Wiring (D)
**Depends on:** Phase 12 (pairs with 14's base-value work). **Requirements:** ECON-08.
**Success criteria:** (1) Wire the confirmed-inert set: Helm of Knowledge `tongue`→canParley (DR15-A), Cloak of Healing/Regeneration per-step tick, Cloak of Strength `noCrit` (`|| eff(c,"noCrit")`), Pendant of Fortitude `halfNext`, Amulet of Light `light`→dispel darkFor; Amulet of Stone → per-item AoE count `slice(0,4)` (DR16-G). (2) `ether` + Gauntlet-of-the-Giant: wire a real effect OR formally retire (design call). (3) Treasure items get a base value (feeds §3 pricing). (4) **Parity gate:** each new read is a pure state read (mirror `isFlying`/`armorSoak`); any new combat draw gated to the qualifying non-chargen path; parity + same-seed green.

### Phase 16: Economy-Local Conservative Tuning (E)
**Depends on:** Phases 12–15. **Requirements:** ECON-09, ECON-10.
**Success criteria:** (1) The `+3000` red-dot reward → depth-scaled flat (e.g. `~300*depth`) with NO new rng draw; audit chest/faerie/grimoire grants + `LOOT_DIVISOR` and fix only the egregious ones (conservative — deep tuning deferred to device playtest). (2) Bag caps (slots/wilmst/rations) set to sensible v1 values, documented as knobs. (3) **Parity gate:** no new rng draws (flat/derived only); same-seed-same-result green; regenerate ONLY the specific economy-parity fixtures whose reward amounts changed (documented deliberate divergence); GLOBAL `difficulty.js` explicitly untouched. (4) A headless tuning harness may be scaffolded for the later deep-tune, but final deep balance is deferred.

**Coverage:** ECON-01→P12, ECON-02→P12, ECON-03→P13, ECON-04→P13, ECON-05→P13, ECON-06→P14, ECON-07→P14, ECON-08→P15, ECON-09→P16, ECON-10→P16. All 10 mapped ✓.

## Progress

**Execution Order (re-sequenced 2026-09-08):** 1 ✓ → 3 ✓ → 2 ✓ → **4 (UI, NEXT)** → 5 (voice, deferred after 4) → 6 (Play launch, when $25 account ready). User has a working native build on a real device (Pixel 7, wireless adb) and chose to bring the mobile UX (Claude Design + provided map icons + touch controls + onboarding) forward ahead of the voice phase. Phase 5 is fully planned + plan-checked (PASS) and ready whenever it's resumed.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine Extraction & Determinism | 10/10 | Complete ✓ | 2026-09-08 |
| 2. Android Packaging & Native Persistence | 4/4 | Complete ✓ | 2026-09-08 |
| 3. Endless Descent & Difficulty Balance | 3/3 | Complete ✓ | 2026-09-08 |
| 4. Mobile Presentation, Controls & Onboarding | 8/11 | In Progress (04-07/08 delivered via DR loop; **only 04-10 tutorial remains, deferred to LAST**) |  |
| 04.1 Rules Review & Wiring | 6/6 | Complete ✓ (535/535, on device) | 2026-09-09 |
| 04.2 Bug Fixes & Text Polish (DR14 batch) | 5 batches | Complete ✓ (567/567, parity 25/25, deployed; ran as quick-task batches — see 04.2-SUMMARY.md) | 2026-09-09 |
| **7–11. Joiners / Party System** | **5/5 CODE-COMPLETE + DEPLOYED** | **Built autonomously 2026-09-09, parity byte-identical throughout.** P7 Model ✅ · P8 Combat ✅ · P9 Acquisition+Voice ✅ · P10 UI ✅ · P11 Party-local balance ✅ (global difficulty retune DEFERRED). Deployed to Pixel 7. | 2026-09-09 |
| **12–16. Economy & Item Balancing** | **5/5 CODE-COMPLETE + DEPLOYED** | **Built autonomously 2026-09-10, 666/666, parity byte-identical throughout.** P12 Carry Model ✅ · P13 Inventory (auto-take-best replaced) ✅ · P14 Store-Sell+E2 ✅ · P15 Item-Wiring ✅ · P16 Conservative Tuning ✅. Deep tuning + global difficulty retune DEFERRED. Deployed to Pixel 7. | 2026-09-10 |
| 5. Voice, Content & Graveyard | **3/3 ✅** | **Complete 2026-09-09 (605/605).** VOX-01 (eventNarration.js voice + coverage guard) & VOX-03 (graveyard re-fetch, 04.2 E9/E12) satisfied by DR work; VOX-02 family-friendly safety-scan guardrail built now. Test-only, no device deploy needed. | 2026-09-09 |
| 6. Google Play Compliance & Launch | 0/TBD | Deferred — final phase; needs $25 Play account + release signing | - |

> **Execution order (re-adjusted 2026-09-08 — user installed Android Studio):** 1 ✓ → 3 ✓ → **2 (now unblocked)** → 5 → then 4 & 6 when a device/emulator visual test and Google Play account are ready. Phase 2's code + a headless debug build are automatable; the emulator/device visual test and release signing are UAT/user steps.
>
> **Build environment (probed 2026-09-08):** Node v22.23.2 + npm 10.9.8 (registry reachable); JDK — **both** system Java AND Android Studio's bundled JBR are **JDK 25** (`C:\Program Files\Android\Android Studio\jbr`, openjdk 25.0.3). JDK 25 is very new for the Android Gradle Plugin — **Phase 2 research must pin the exact Capacitor-8 Gradle/AGP version and confirm it supports JDK 25; if not, install a JDK 21 (Temurin) and point Gradle at it** via `org.gradle.java.home`. Since this Android Studio (2026) bundles JBR 25, its matching AGP/Gradle likely supports 25 — but verify with a real `./gradlew` build, don't assume; **Android SDK installed at `%LOCALAPPDATA%\Android\Sdk`** (build-tools, platforms, platform-tools, emulator, **licenses already accepted**) — set `ANDROID_HOME`/`ANDROID_SDK_ROOT` to it (not currently exported); Android Studio at `C:\Program Files\Android\Android Studio`. `sdkmanager`/`adb`/`emulator` are in the SDK dir but not on PATH (invoke by full path or add to PATH).
