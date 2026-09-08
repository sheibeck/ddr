# Project Research Summary

**Project:** Mazeworld
**Domain:** Paid, fully-offline, single-player mobile roguelike dungeon-crawler - Android / Google Play only
**Researched:** 2026-09-07
**Confidence:** MEDIUM-HIGH

Scope note: The project scope was narrowed to Android/Google Play only after the Stack and Pitfalls research was already underway. Both documents were written against a dual iOS+Android target and contain Apple App Store, Xcode, and Mac-toolchain content that is now out of scope. This summary strips that content out. iOS may be reconsidered post-launch but does not inform any current recommendation below. Dropping iOS removes the need-a-Mac-to-build-and-sign blocker entirely; the whole toolchain (Capacitor plus Android Studio plus keytool) runs natively on the author Windows machine.

## Executive Summary

Mazeworld is a premium, offline, single-player mobile roguelike that already has a complete, tested ruleset living in a 3300-line vanilla-JS/HTML/canvas prototype (mazeworld.html). The heavy lift is not building a dungeon crawler; it is platform packaging, mobile presentation, endless-mode conversion, and onboarding, without breaking the existing proven rules. All four research tracks converge on wrap, do not rewrite. The prototype is a DOM-and-canvas app with a single serializable global state object (S) and an act()/beats action dispatcher, an ideal shape for Capacitor, which ships it as a native Android app with no game-logic rewrite and no engine-port detour.

The recommended approach is a phased extraction-and-hardening sequence: pull the engine data tables and rules functions out from behind DOM/render/save entanglement, inject a seeded RNG in place of Math.random(), and land on a clean applyAction(state, action) to (state, events) boundary. This single refactor delivers bulletproof autosave/resume, reproducible seed-verifiable high scores, and the decoupled, serializable engine requirement PROJECT.md states as non-negotiable. Endless descent then becomes a difficultyCurve(depth) layered onto the existing floor generator, replacing the fixed 5-floor Gate; a design/balance problem more than an engineering one.

Key risks are unglamorous, well-documented porting failure modes: localStorage is not durable inside a native WebView and must be replaced with native storage (this game entire replay hook depends on save durability); Android back-button/lifecycle handling must be explicit (an unhandled back-tap can silently kill a permadeath run); touch targets must be sized to avoid mis-tap unfair deaths; Google Play compliance (Data Safety form, IARC rating) is mandatory even for a zero-data-collection offline app; and endless-mode difficulty must be a deliberate curve-design pass, not a flat per-floor multiplier. The roadmap should front-load engine extraction and a thin, store-compliant vertical slice through the Play internal testing track, rather than let visual polish or balance work consume the schedule before compliance and durability are proven.

## Key Findings

### Recommended Stack

Path: wrap mazeworld.html with Capacitor for Android. The prototype is a DOM UI (character sheet, dice log, dialogs) with one canvas for the maze grid, plain-JSON global state, and only localStorage as a browser dependency (no fetch/WebSocket/Workers). Capacitor wraps this almost unchanged. No game-engine or cross-platform-framework port is advisable; the canvas-game problems those tools solve do not exist in this turn-based, DOM-panel-heavy crawler.

Core technologies:
- Capacitor 8.x (capacitor/core, capacitor/cli, capacitor/android) - wraps the existing HTML/CSS/JS in a native Android WebView shell, no DOM/canvas rewrite needed.
- Node.js 22+ - required by the Capacitor 8 CLI.
- Android Studio (Otter/2025.2.1+) - compiles, signs, and builds the Android App Bundle; runs fully on Windows.
- capacitor/preferences - durable native key-value storage; must replace raw localStorage for save/graveyard data.
- capacitor/app - hooks the Android hardware/gesture back button.
- capacitor/splash-screen, capacitor/status-bar - cheap native-chrome polish.
- capacitor/screen-orientation (community) - lock to portrait, matching the prototype 1080px reflow.
- Explicitly no ad SDK, analytics SDK, or IAP plugin - paid-upfront, offline, zero third-party SDKs is both the product promise and the simplest compliance path.

### Expected Features

Must have (table stakes):
- Tap-to-move / contextual touch controls (D-pad retained as alternate scheme)
- Reliable autosave every beat plus instant resume after any interruption
- Ceremonial permadeath death screen plus one-tap new run
- Local best-depth/high-score tracking, bulletproof and persisted
- Integrated first-run tutorial taught in-context, not a text wall
- Scrollable message/combat log
- Character/stat sheet screen (the reveal for 100 percent dice-rolled characters)
- Basic settings (sound, haptics, text size, control scheme, confirm-before-quit)
- Basic accessibility: adjustable text size, colorblind-safe status indicators
- Google Play compliance: Data Safety form, IARC content rating, privacy policy

Should have (differentiators):
- Sarcastic content/voice system (death epitaphs, item flavor, Oracle log) built as data tables keyed to structured engine events
- Graveyard/run-history screen; reinforces depth-chase without violating no-meta-progression
- Non-power knowledge unlocks (bestiary/compendium)
- Shareable run summary card; free organic marketing
- Touch-native QoL (interruptible auto-explore, rest-until-healed)
- Escalating difficulty pacing tuned for 5 to 10 minute typical runs

Defer (v2+):
- Multiplayer / play with friends (architecture must stay ready for it)
- Power-affecting meta-progression, platform-identity/account layer, daily/seasonal seeded challenges, narrative expansion

### Architecture Approach

Refactor (not rewrite) the prototype into a layered system with one hard boundary: a pure, synchronous rules/simulation engine (applyAction(state, action) to (state, events)) that never touches DOM, localStorage, or Math.random() directly. This is simultaneously the save/resume mechanism, the endless-mode scaling seam, and the future multiplayer seam.

Major components:
1. Rules/Simulation Engine (engine/) - character creation, movement, combat, magic, economy, leveling, death, endless-descent progression; consumes an injected seeded RNG.
2. Content (content/) - pure data tables (classes, races, spells, creatures, items, epitaphs) split out from logic.
3. Presentation (presentation/) - DOM/canvas rendering, input adapter, and the one place structured Events become sarcastic narrative copy.
4. Persistence (persistence/) - versioned save/graveyard storage behind a swappable adapter (native Preferences, not raw localStorage).
5. Platform Bridge (platform/) - Capacitor-specific lifecycle, native storage, haptics, back-button handling.

Suggested extraction order: content tables first (zero risk), inject seeded RNG, slice-by-slice convert movement/combat/economy/character/death into the applyAction contract, build the real event-to-narrative log formatter, add the endless-mode difficulty curve, harden persistence, and only then do platform packaging and visual/UX work.

### Critical Pitfalls

1. localStorage is not durable inside a native WebView - must migrate save and graveyard to native storage (capacitor/preferences) before shipping; highest-priority technical pitfall given local high-score/graveyard is the primary replay hook.
2. Android hardware/gesture back button unhandled - a bare back-tap can silently exit mid-run with no confirmation, catastrophic for permadeath. Intercept explicitly; persist full run state on every backgrounding event.
3. Endless-mode difficulty curve treated as just multiply stats per floor - player power vs enemy difficulty diverging produces a trivial early game or an unbeatable wall. Needs a dedicated design/balance pass playtested to floor 30 to 50+.
4. Undersized/adjacent touch targets on high-stakes actions - mis-taps cause player-perceived unfair deaths; enforce 44pt/48dp minimum hit areas with spacing between destructive/non-destructive actions.
5. Google Play compliance treated as a rubber stamp - Data Safety form and IARC questionnaire are mandatory even for a zero-collection offline app, and must be derived from an actual dependency audit, re-checked after every plugin change.
6. Rules-engine/UI coupling creeping back in under deadline pressure - mobile-specific feature work tempts direct global-state mutation from UI code, quietly foreclosing the planned multiplayer future. Guard with a serialize/rehydrate round-trip test kept green throughout development.

## Implications for Roadmap

### Phase 1: Engine Extraction and Determinism
Rationale: Everything else (save/resume, endless mode, multiplayer-readiness) is cheaper once the engine is decoupled and deterministic; doing this first, against the still-working browser prototype, is lowest-risk.
Delivers: engine/ module reachable only through applyAction(state, action) to (state, events); content tables extracted; seeded RNG replacing all Math.random() calls; a serialize/rehydrate round-trip test.
Addresses: the project non-negotiable decoupled, serializable engine constraint; seed for deterministic/verifiable high scores.
Avoids: engine/UI coupling creep - establish the guardrail before any mobile-specific feature work.

### Phase 2: Android Packaging and Native Persistence
Rationale: De-risk the platform/store path early - surfaces signing/storage/compliance problems while there is still schedule slack.
Delivers: Capacitor Android shell; native Preferences-based persistence (versioned save schema plus integrity checksum) replacing raw localStorage; back-button and app-lifecycle handling; splash/status-bar chrome.
Uses: Capacitor 8.x, capacitor/android, capacitor/preferences, capacitor/app.
Implements: Persistence and Platform Bridge components.
Avoids: localStorage durability failure, unhandled Android back button, canvas DPI/safe-area issues.

### Phase 3: Endless Descent and Difficulty Balance
Rationale: Requires a stable engine boundary (Phase 1) to be a pure content/tuning change rather than a structural one; explicitly a design-balance problem needing dedicated playtesting.
Delivers: difficultyCurve(depth) replacing the fixed 5-floor Gate; soft-cap/asymptotic scaling with periodic breather floors; playtesting to floor 30 to 50+ validating fairness and the 5 to 10 minute session target.
Addresses: the endless descent core requirement.
Avoids: linear-vs-exponential curve divergence; unfair-feeling permadeath deaths from RNG layering issues.

### Phase 4: Mobile Presentation, Controls, and Onboarding
Rationale: Best done against a stable, portable engine and working native shell, so UX iteration does not risk re-coupling the engine.
Delivers: Tap-to-move contextual controls (D-pad alt); touch-target sizing/spacing; DPI-correct canvas rendering; safe-area-aware layout; in-context first-run tutorial; character sheet/HUD/combat log screens; basic accessibility.
Addresses: table-stakes UX features.
Avoids: canvas DPI blur, safe-area/edge-to-edge overlap, undersized touch targets.

### Phase 5: Voice, Content, and Differentiators
Rationale: Depends on the engine emitting structured events and a stable log formatter; this is where the game core comedic identity gets built and QA verified.
Delivers: Sarcastic content/voice system (epitaphs, Oracle log, item flavor) as data tables keyed to structured events; graveyard/run-history screen; non-power knowledge unlocks; shareable run-summary card; a batch-generated procedural-text QA pass for tone/rating safety.
Addresses: the game stated differentiators and core identity.
Avoids: procedural text combinatorics reading as unintended/inappropriate; age-rating mapping errors for dark humor.

### Phase 6: Google Play Compliance and Launch
Rationale: Store submission itself eats real calendar time and should be a gated checklist distinct from feature complete.
Delivers: Data Safety form (from a real dependency audit), IARC content rating (mapped from real flavor-text samples), privacy policy, Play Console listing, signed AAB via Play App Signing, Play internal testing track validation, optional crash-reporting hook (re-declared in compliance forms if added).
Addresses: the Publish to Google Play requirement.
Avoids: privacy/data-safety mismatch, age-rating miscalibration, no crash reporting/device diversity, compliance workstream starved by polish work.

### Phase Ordering Rationale

- Engine extraction comes first because every later phase is cheaper against a clean, deterministic, serializable engine and expensive to retrofit once presentation/platform code has assumed a tangled shape.
- Packaging/native persistence comes early (Phase 2), before the full visual/UX redesign, specifically to surface signing/storage/compliance problems while there is still schedule slack; a thin but store-compliant build should reach the Play internal testing track early, in parallel with polish work, not after.
- Endless-mode balance and mobile presentation are sequenced after the engine and packaging are stable so tuning/UI iteration does not risk re-coupling the architecture.
- Voice/content and final compliance are placed last since they depend on structured events existing and benefit from testing against a feature-complete, already-store-compliant build.

### Research Flags

Needs research: Phase 3 (project-specific difficulty-curve tuning requires playtesting data beyond genre precedent), Phase 6 (Google Play target-API/Data-Safety/IARC specifics shift yearly - re-verify against current Play Console Help immediately before execution).

Standard patterns (skip research-phase): Phase 1 (command/event engine boundary and seeded-PRNG patterns are well-established, with code examples already in ARCHITECTURE.md), Phase 2 (Capacitor plus native storage plugin usage is a documented standard pattern), Phase 4 (DPI-scaling, safe-area insets, touch-target sizing are standard mobile UX patterns).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM (Android-specific portions HIGH) | Capacitor/Android Studio/Play packaging facts cross-checked across multiple sources; dropping iOS removes the one genuinely fragile/time-sensitive claim set (Apple SDK deadlines) from this project critical path entirely. |
| Features | MEDIUM-HIGH | Cross-corroborated genre/UX research across multiple queries; findings are design conventions, not API specifics. |
| Architecture | HIGH | Component boundaries derived directly from reading the actual prototype source; multiplayer-lockstep and seeded-PRNG patterns are established general knowledge. |
| Pitfalls | HIGH for Android/Play and wrapper-mechanics pitfalls; MEDIUM for roguelike-design pitfalls | Store-policy and WebView-storage pitfalls corroborated by official docs and GitHub issues; genre pitfalls synthesized from established design wisdom, not project-specific playtesting. |

Overall confidence: MEDIUM-HIGH

### Gaps to Address

- Exact current Google Play target-API-level deadline and Data Safety form field set shift yearly - re-verify against developer.android.com and Play Console Help immediately before Phase 6, not from this document alone.
- Actual endless-mode difficulty curve shape requires project-specific playtesting during Phase 3 - budget real iteration time, not a one-shot formula.
- No crash-reporting or multi-device test data exists yet (pre-development); Phase 6 should budget Play internal testing with external testers on varied Android device models.
- Procedural flavor-text combinatorics have not been generated or reviewed yet; Phase 5 must include a batch-generation QA pass before tone/rating is finalized.

## Sources

### Primary (HIGH confidence)
- Direct inspection of mazeworld.html - confirmed DOM+CSS UI, single-canvas maze renderer, localStorage-only persistence, no fetch/WebSocket/Worker usage.
- .planning/PROJECT.md - authoritative scope, requirements, and constraints.
- Official docs: capacitorjs.com/docs/guides/storage, capawesome.io (edge-to-edge/safe-area guide), support.google.com/googleplay (Data Safety, content ratings), developer.android.com (target SDK, app bundle, signing).

### Secondary (MEDIUM confidence)
- Ionic/Capacitor 8 release notes and migration docs.
- Genre/UX research: Shattered Pixel Dungeon control-scheme analysis, mobile roguelike onboarding/accessibility best-practice articles, EU Accessibility Act coverage.
- Store-rejection-pattern aggregator articles cross-checked against official guideline categories.
- WKWebView/Capacitor localStorage-eviction reports (Apple Developer Forums, ionic-team/capacitor GitHub issue 636).
- Deterministic lockstep / command-pattern multiplayer architecture references.

### Tertiary (LOW confidence)
- Single player-forum anecdote on endless-mode balancing - used only to corroborate an already well-established scaling-failure pattern.

---
Research completed: 2026-09-07
Ready for roadmap: yes
