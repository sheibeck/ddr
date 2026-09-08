# Feature Research

**Domain:** Premium (paid), offline, single-player mobile roguelike dungeon-crawler
**Researched:** 2026-09-07
**Confidence:** MEDIUM-HIGH (cross-corroborated web research across multiple queries; no official platform-doc lookups were needed since findings are design/UX conventions, not API specifics)

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these on a **paid** game invites 1-star reviews and refund requests — paid buyers hold premium titles to a "complete, respectful experience" bar that free-to-play doesn't get held to.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tap-to-move / contextual touch controls (tap empty tile to move, tap enemy to attack) | This is *the* proven mobile control scheme for grid roguelikes (Shattered Pixel Dungeon's whole UX is built on it: "tap to move, tap enemy to attack, most controls fully contextual"). A D-pad-only port of a desktop/web UI feels like an afterthought. | MEDIUM | Keep the prototype's D-pad as a fallback/option, but tap-to-move-on-grid should be the primary scheme. Contextual = the game infers "move" vs "attack" vs "pick up" from what's tapped. |
| Chunky, high-contrast, distance-readable UI | Reviewers explicitly praise UIs "designed to be viewed from a distance" on phones; small text/icons are a top mobile-game complaint. | LOW | Directly supports 5–10 min sessions played one-handed on a commute/couch. |
| Reliable autosave every action + instant resume after interruption (call, notification, app-kill, OS memory reclaim) | Turn-based roguelikes traditionally autosave every turn; on mobile this is non-negotiable because sessions *will* be interrupted by phone calls/texts mid-run — losing a run to an interruption (not to the game's own permadeath) is an instant-refund-grade complaint. | MEDIUM | Because the prototype already has a serializable global `S` state + `act()`/beats system, this should be cheap: snapshot after every beat, not just every floor. |
| Clear, ceremonial death screen with permadeath finality (no fake "revive?" dialog) | Permadeath is the genre's core contract; players expect a definitive, well-presented end screen, not an ambiguous game-over. | LOW | This is also the primary comedy delivery point (see Differentiators — epitaphs). |
| One-tap "new run" from the death screen | Session length target is 5–10 minutes; every extra tap between death and the next run is friction against the depth-chase loop. | LOW | Should skip all menus — death screen → tap → dice roll → playing. |
| Local best-depth / high-score tracking, persisted across app kills | This is the game's explicitly designated **primary replay hook** (per PROJECT.md) — it must be bulletproof and always visible (e.g., on the death screen: "Your best: Depth 14"). | LOW | Pure local storage; no server needed for v1. |
| Integrated first-run tutorial / contextual tooltips (not a text wall) | The rules engine is deep (3 classes, 24 subclasses, 6 races, 31 spells, ~45 creatures) but the prototype "assumes rules knowledge." Untaught mechanics are a top cause of early quits on rules-heavy mobile games. Best practice: teach one mechanic at a time, in-context, during the first real run — not a separate menu-based tutorial. | MEDIUM-HIGH | Biggest UX risk in the project. Should be the first thing playtested. |
| Scrollable message/combat log | Dice-driven combat generates numbers players need to parse ("why did I take 7 damage?"); without a log, a crunchy rules engine feels arbitrary/unfair rather than crunchy. | LOW-MEDIUM | Also a natural home for the sarcastic "Oracle" commentary (see Differentiators). |
| Character/stat sheet screen | Since character creation is 100% dice-rolled, players need a clear screen to see *what they got* (class, subclass, race, stats, spells known) — this doubles as the "reveal" moment that replaces player choice. | LOW | Already modeled in the rules engine; mostly a UI task. |
| Basic settings: sound/music toggle, haptics toggle, text size, control-scheme choice, "confirm before quitting a run" | Baseline expectation for any 2025-era mobile game; absence reads as unfinished. | LOW-MEDIUM | Text size ties into accessibility compliance (below). |
| No forced network / no login / no ads / no IAP nags | This *is* the pitch (paid, offline, complete). Any deviation (a hidden analytics SDK phoning home, a "rate us" popup that looks like an IAP prompt) breaks the trust premium buyers are paying for and reads as bait-and-switch in reviews. | LOW | Mostly a discipline/process constraint, not a build task — but must be verified before submission (see compliance row). |
| Basic accessibility: adjustable text size, colorblind-safe status/threat indicators (never color-only) | The four most-complained-about accessibility gaps across games are remapping, text size, colorblindness, and subtitle/text presentation. The EU's European Accessibility Act became fully enforceable in June 2025 and covers mobile apps sold to EU consumers — this is now a *compliance* table-stake, not just a nicety, for a game selling on both stores globally. | MEDIUM | Cheapest if designed in from day one (icon+color for status effects, scalable text) rather than retrofitted after UI is locked. |
| Store compliance basics: privacy label / data-use declaration, accurate age rating (via IARC/Apple's updated questionnaire), privacy policy URL | Mandatory gate to ship on both stores in 2025–2026; Apple's rating system added new tiers (13+/16+/18+) with a stricter questionnaire, and Google's IARC questionnaire is required for every app. | LOW-MEDIUM | Process work, but must be planned into the roadmap's "publish to both stores" phase — an offline game with zero data collection should sail through this if declared honestly. |

### Differentiators (Competitive Advantage)

Where Mazeworld should actually compete — mostly by leaning into its already-decided identity (sarcasm, full dice-roll, no meta-progression) rather than chasing generic "content depth."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sarcastic content/voice system (death epitaphs, item flavor text, an in-fiction "Oracle" commentary log) | This is the game's stated core identity, not decoration. Distinct voice is one of the few ways a small paid indie title stands out in a crowded roguelike field, and it's a strong word-of-mouth driver ("look at this hilarious death message" screenshots). | MEDIUM-HIGH | Needs to be built as **data tables keyed off structured game events** (cause of death, class/race, floor depth, item used) rather than hardcoded strings, so content can grow without code changes and so tone stays consistent as more writers/content get added later. Depends on the rules engine emitting structured event data (see Dependencies). |
| The "reveal" moment for 100%-dice-rolled characters | Since players make zero build choices, the character-creation roll itself must feel like the game's loot box — a satisfying, theatrical reveal of race/class/subclass/stats is the emotional hook that replaces "build crafting." | LOW-MEDIUM | Rules engine already has all the data; this is primarily a presentation/animation task. |
| Graveyard / run-history screen (browsable list of past characters, how they died, depth reached) | Reinforces the depth-chase loop and comedic tone without violating the "no meta-progression in v1" decision — it's pure history/flavor, not power. Doubles as content that rewards returning players. | MEDIUM | Needs only an append-only local log of past runs; low schema cost on top of the required save/resume system. |
| Non-power "knowledge" unlocks: bestiary/compendium fills in as creatures/spells are encountered, plus small lore/trivia entries | Gives mobile players *something* that persists and grows across permadeath runs (a well-documented retention driver in the genre) **without** touching starting-power balance — threads the needle between "pure roguelike, no meta-progression" and mobile players' general expectation of *some* cross-run progression. | MEDIUM | Depends on the rules engine already tracking creature/spell IDs (it does, given ~45 creatures / 31 spells are modeled) — mostly a "have I seen this?" flag plus a compendium UI. |
| Shareable, funny "run summary" card (screenshot-friendly stat card at death: depth, cause of death, a generated one-liner) | Free organic marketing for a paid game with no ad budget — this is exactly the kind of asset that gets shared to social media and drives discovery, which paid indie games desperately need since store algorithms favor free/viral hits. | LOW-MEDIUM | Reuses the epitaph/flavor-text system; mostly a "render to shareable image" feature. |
| Touch-native QoL commands adapted from desktop roguelike conventions: auto-explore empty corridors (interruptible), rest-until-healed/-interrupted, single-tap "continue descending" | Modern roguelikes are increasingly judged on these QoL conveniences; without them, a deep rules engine can feel tedious to operate one-tap-at-a-time on a phone. Also **directly shortens dead time within the 5–10 minute session target** by cutting repetitive taps. | MEDIUM | Auto-explore/rest must remain interruptible (stop immediately on danger) — this is a well-established genre convention, not novel risk. |
| Fine-grained mid-beat state snapshotting (quit and resume *inside* a fight, not just between floors) | A step beyond the "reliable autosave" table stake — genuinely resuming exactly where you left off, mid-action, is a differentiator versus games that only checkpoint between levels. | MEDIUM | This is mostly free if the roadmap keeps the prototype's decoupled/serializable `S`-state + `act()`/beats architecture (already a stated project constraint for multiplayer-readiness) — the same architecture that enables multiplayer later also enables perfect save/resume now. |
| Escalating-difficulty pacing curve explicitly tuned for 5–10 minute mobile sessions | Generic "endless descent" isn't automatically mobile-shaped; the differentiator is deliberately tuning the difficulty ramp so a *typical* run (not a lucky/skilled one) naturally resolves in that window, so permadeath doesn't feel like it's punishing players for playing on the go. | MEDIUM | Needs playtesting/telemetry-free tuning since there's no server to A/B against — budget explicit design time for this in the roadmap. |
| Optional, fully offline-degradable platform achievements/leaderboards (Game Center / Google Play Games) | Platform-native leaderboards raise a game's perceived polish and give players an external flex point, but the standard implementations are cloud/account-based. The differentiator is treating this as strictly opt-in and non-blocking — the local high-score system is the source of truth, and platform services (if added at all) sync opportunistically without ever requiring login. | MEDIUM | Do **not** let this become a dependency for launch; if it slips, the offline local high-score system alone fully satisfies the replay-hook requirement. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Power-affecting meta-progression (unlockable starting gear, permanent stat boosts, unlockable "easier" classes) | Extremely common in modern roguelites (Hades, Rogue Legacy) and correlated with higher retention — an obvious thing to copy. | Directly contradicts the project's own decided identity: "Permadeath, no meta-progression in v1" and "100%-dice-rolled characters, no player choice." Once a run's difficulty assumes accumulated unlocks, later runs stop being a fair "play the hand you're dealt" test, undermining the comedic premise. | Non-power "knowledge" unlocks only (bestiary, epitaphs, graveyard, titles) — see Differentiators above. Revisit power-based meta-progression only as a deliberate, separately-decided v2 pivot, not a default add. |
| Any ads, IAP, or monetization SDK (including "innocent" ones like a review-nag that resembles a purchase prompt) | Common in mobile to boost LTV even after an upfront purchase. | Explicitly out of scope; breaks the "paid, complete, respectful experience" promise that is the entire value proposition of a premium offline game, and is exactly the kind of thing that triggers "bait and switch" 1-star reviews. | One-time purchase price covers the full game, forever. If future content is added, ship it as a free update, not paid DLC, to protect trust (or treat a paid expansion as a clearly separate v2 decision). |
| Accounts / cloud save / social login for the base game | Feels modern, enables cross-device play. | Directly conflicts with the "fully offline, no accounts, no servers" constraint; adds attack surface for privacy-label complications and slows store review. | Local save only for v1; add platform identity (Game Center / Google Play Games) later and only when the deferred multiplayer feature actually needs it. |
| Real-time multiplayer or async "ghost run" leaderboards requiring a server | Natural extension of a depth-chase hook — "see how you compare to friends." | Explicitly deferred post-MVP per PROJECT.md; building any server dependency now works against the "fully offline" constraint and the decoupled/serializable architecture goal. | Local high-score/depth chase only for v1; keep the rules engine's state fully serializable so a future multiplayer layer can be bolted on without a rewrite. |
| Real-time pressure elements (turn timers, twitch/reflex mechanics) | Common in mobile to inject urgency and shorten sessions. | This is a **turn-based, dice-driven tactical crawler** — imposing a clock on decisions clashes with the tabletop-fidelity identity and punishes exactly the "crunchy, dice-driven" tactical thinking the target audience loves. | Let session length come from pacing/difficulty-curve tuning (see Differentiators), not from clocking the player. |
| Player-authored content / Maze-Master / party tools from the original tabletop rules | Tempting since it exists in the source rulebook and some nostalgia players may ask for it. | Already deliberately stubbed out in the prototype for solo play and explicitly out of scope; reviving it now is scope creep against a solo MVP. | Leave stubbed; revisit only alongside the deferred multiplayer milestone, since Maze-Master tooling is inherently a multiplayer/party feature. |
| Character build choices (pick starting equipment, allocate stat points, choose a class) | Standard RPG expectation; players unfamiliar with the tabletop original may ask "why can't I choose?" | Directly undermines the stated, deliberate identity: "100%-dice-rolled character creation — no player choices (faithful to the game's identity)." This isn't an oversight to fix, it's the joke. | Invest instead in making the dice-roll *reveal* itself satisfying and funny (see Differentiators), and use onboarding/flavor text to frame "no choice" as the game's comedic premise rather than a missing feature. |
| Heavy narrative/cutscenes or extensive voiced dialogue | Seen as adding "production value" and immersion. | High cost (writing, localization, possibly VO) for a solo/small team shipping a paid game; PROJECT.md explicitly treats richer art/audio as a nice-to-have, not a gate. Cutscenes also work against 5–10 minute sessions by adding unskippable dead time. | Deliver all humor and worldbuilding through short, skippable in-line text (epitaphs, item flavor, Oracle log, tutorial copy) — cheap to produce, cheap to consume, and reinforces rather than interrupts the session-length target. |
| Aggressive push notifications / re-engagement nudges | Standard F2P retention lever ("come back and claim your reward!"). | Clashes with the premium/no-tracking, no-server positioning and reads as F2P behavior bleeding into a paid game — a common source of paid-game complaints about "feeling exploited." | If notifications exist at all, make them strictly opt-in, minimal, and locally generated (e.g., a single optional "new best depth today?" reminder) — never framed as urgency or loss. |
| Full auto-battler / auto-play mode that resolves floors without player input | Superficially a QoL win, and easy to justify by analogy to "auto-explore." | Guts the game's stated Core Value ("the tension and discovery of descending... must feel great") — auto-resolving combat removes the exact tactical decisions the dice-driven rules engine exists to create. | Limit automation to genuinely tedious, low-decision actions only (walking empty corridors, resting when safe); every combat/spell decision stays manual. |

## Feature Dependencies

```
Reliable autosave/instant-resume (table stake)
    └──requires──> Decoupled, serializable `S`-state / act()-beats architecture (already a stated project constraint)

Fine-grained mid-beat snapshotting (differentiator)
    └──requires──> Reliable autosave/instant-resume
    └──enhances──> Session-length fit (5-10 min) and future multiplayer-readiness

Integrated first-run tutorial
    └──requires──> Scrollable message/combat log (to surface contextual tooltips/explanations)
    └──requires──> Rules engine already modeling all outcomes to explain (exists)

Sarcastic content/voice system (epitaphs, Oracle log, item flavor)
    └──requires──> Rules engine emitting structured event data (cause of death, class/race, floor, item used)
    └──enhances──> Death screen (table stake), Graveyard screen, Shareable run-summary card

Graveyard / run-history screen
    └──requires──> Reliable autosave/local persistence layer (table stake)
    └──requires──> Sarcastic content/voice system (for the epitaphs that make it fun to browse)

Non-power "knowledge" unlocks (bestiary/compendium)
    └──requires──> Rules engine tracking creature/spell IDs encountered (largely exists: ~45 creatures / 31 spells modeled)
    └──conflicts──> Power-affecting meta-progression (anti-feature) — must stay strictly informational, never power-affecting

Shareable run-summary card
    └──requires──> Sarcastic content/voice system
    └──requires──> Local high-score/depth tracking (table stake)

Touch-native QoL (auto-explore, rest-until-healed)
    └──requires──> Turn-based beats-stepping system (exists in prototype)
    └──enhances──> 5-10 minute session pacing

Optional platform achievements/leaderboards (Game Center / Google Play Games)
    └──enhances──> Local high-score/depth tracking (table stake)
    └──conflicts──> Fully-offline / no-accounts constraint if implemented as a hard dependency (must stay optional/opt-in)

Accessibility (text scale, colorblind-safe indicators)
    └──requires──> UI theming architecture designed for it from the start (retrofitting color-only status effects later is costly)

Power-affecting meta-progression (anti-feature)
    └──conflicts──> 100%-dice-rolled characters / permadeath-with-no-meta-progression (decided project identity)
```

### Dependency Notes

- **Autosave/resume requires the serializable state architecture:** this is good news — PROJECT.md already mandates keeping the rules engine decoupled and state serializable for the future multiplayer feature. The same architectural discipline that protects multiplayer also gives near-free, best-in-class save/resume now. Don't treat these as separate investments.
- **The sarcastic content system requires structured event data, not string concatenation:** epitaphs/Oracle log entries should be authored as data tables keyed by event type (death cause, class, race, depth, item), so tone stays consistent and content can be expanded without touching game logic. This is a content-pipeline decision that should be made early, since retrofitting a hardcoded joke system later is expensive and risks tonal drift (sarcastic-but-family-friendly must stay consistent as content grows).
- **Non-power unlocks conflict with power-affecting meta-progression:** these two must be kept clearly separate in the roadmap so "knowledge/lore persistence" (fine, differentiator) doesn't quietly grow into "starting-gear persistence" (anti-feature, contradicts a core decision).
- **Accessibility must be designed in, not bolted on:** status effects, threat indicators, and UI feedback should use icon+shape+color from the start; retrofitting colorblind support after art/UI is locked is a common and costly mistake.
- **Optional platform leaderboards must never become a hard dependency:** the local high-score system alone must fully satisfy the "primary replay hook" requirement; platform services are a nice-to-have layered on top, not a blocker.

## MVP Definition

### Launch With (v1)

Minimum viable product — everything already required by PROJECT.md plus the table-stakes UX/compliance work needed to survive App Store/Play Store scrutiny as a paid title.

- [ ] Tap-to-move / contextual touch controls (with D-pad as an alternate control option) — the proven mobile control scheme for grid crawlers
- [ ] Full ruleset preserved as canon (3 classes/24 subclasses/6 races/31 spells/~45 creatures/economy/procedural mazes) — already required
- [ ] 100%-dice-rolled character creation with a satisfying "reveal" presentation — core identity, low incremental cost
- [ ] Endless descent with a difficulty curve tuned for 5–10 minute typical runs
- [ ] Permadeath with a ceremonial death screen (epitaph) and one-tap "new run"
- [ ] Local high-score / best-depth tracking, persisted locally
- [ ] Reliable autosave every beat + instant resume after any interruption
- [ ] Integrated, in-context first-run tutorial (not a menu wall)
- [ ] Scrollable message/combat log
- [ ] Character/stat sheet screen
- [ ] Basic settings: sound/music, haptics, text size, control scheme, confirm-before-quit
- [ ] Sarcastic content/voice system for death epitaphs, item flavor, and Oracle log — the game's stated core identity
- [ ] Graveyard / run-history screen — supports depth-chase loop without meta-progression
- [ ] Basic accessibility: adjustable text size, colorblind-safe (icon+color) status/threat indicators
- [ ] Store compliance: privacy label, accurate age rating, privacy policy, verified no hidden data collection

### Add After Validation (v1.x)

Add once the core loop and store presence are proven.

- [ ] Bestiary/compendium unlocks (creatures/spells seen) — trigger: players ask "what was that monster?" or engagement data shows repeat-run drop-off that lore/collection hooks could offset
- [ ] Shareable "run summary" card — trigger: want organic/social discovery for a paid game with no ad budget
- [ ] Optional Game Center / Google Play Games achievements & leaderboards (opt-in, offline-safe) — trigger: platform polish once core loop is validated; must never block launch
- [ ] Expanded QoL (auto-explore, rest-until-healed/interrupted, quick "continue descending") — trigger: playtesting shows tedium/excess taps within a run
- [ ] Expanded accessibility (remappable controls, additional colorblind modes, larger accessibility pass) — trigger: post-launch review feedback or EU market expansion
- [ ] Fine-grained mid-beat snapshotting (if not already achieved for free via the serializable architecture)

### Future Consideration (v2+)

Explicitly deferred; do not let scope creep pull these into v1.

- [ ] Play-with-friends multiplayer — explicitly deferred per PROJECT.md; large, separable layer
- [ ] Platform identity / cloud save bridging (Game Center / Google Play Games as an account layer) — only needed once multiplayer requires it
- [ ] Power-affecting meta-progression — only reconsider as a deliberate, separately-decided design pivot away from "pure roguelike," not a default add
- [ ] Daily/seasonal shared-seed challenge runs — interesting differentiator later, but adds seed-sharing/fairness-verification complexity not worth taking on pre-launch
- [ ] Narrative expansion / story mode — richer art/audio and story are nice-to-haves, not gates, per PROJECT.md

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Tap-to-move contextual controls | HIGH | MEDIUM | P1 |
| Reliable autosave/instant resume | HIGH | MEDIUM | P1 |
| Ceremonial death screen + one-tap restart | HIGH | LOW | P1 |
| Local high-score/depth tracking | HIGH | LOW | P1 |
| Integrated first-run tutorial | HIGH | HIGH | P1 |
| Message/combat log | HIGH | LOW-MEDIUM | P1 |
| Sarcastic content/voice system (epitaphs, Oracle log) | HIGH | MEDIUM-HIGH | P1 |
| Basic accessibility (text scale, colorblind-safe indicators) | MEDIUM-HIGH | MEDIUM | P1 |
| Store compliance (privacy, age rating) | HIGH (gates launch) | LOW-MEDIUM | P1 |
| Graveyard/run-history screen | MEDIUM | MEDIUM | P2 |
| Bestiary/compendium unlocks | MEDIUM | MEDIUM | P2 |
| Shareable run-summary card | MEDIUM | LOW-MEDIUM | P2 |
| Touch-native QoL (auto-explore, rest) | MEDIUM | MEDIUM | P2 |
| Optional platform leaderboards/achievements | LOW-MEDIUM | MEDIUM | P3 |
| Fine-grained mid-beat snapshotting | MEDIUM | MEDIUM | P2 |
| Power-affecting meta-progression | (rejected — see anti-features) | — | N/A |
| Play-with-friends multiplayer | HIGH (long-term) | HIGH | P3 (post-MVP) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

Comparing Mazeworld's planned approach against the closest genre analogues: touch-native grid roguelikes and premium mobile roguelike/roguelite titles.

| Feature | Shattered Pixel Dungeon (free, grid roguelike) | Slice & Dice / Card Thief-style premium roguelites | Our Approach |
|---------|--------------------------------------------------|------------------------------------------------------|--------------|
| Movement/combat input | Tap-to-move on grid, tap enemy to attack, fully contextual | Varies — often card/dice-drag rather than grid movement | Tap-to-move + tap-to-attack on the grid maze, D-pad as an alt option, matching the genre's proven touch pattern |
| Meta-progression | None to minimal in base game (classic roguelike, permadeath-pure lineage) | Often includes unlockable characters/cards between runs | Deliberately none for power (matches SPD's classic-roguelike camp); knowledge-only unlocks (bestiary, graveyard) as the compromise |
| Monetization | Free with optional cosmetic support | Premium, one-time purchase, no ads/IAP | Premium, one-time purchase, no ads/IAP — matches the trusted "complete experience" premium roguelite convention |
| Tone/voice | Minimal narrative, mechanically focused | Varies; some (e.g., Card Thief) have light flavor text | Heavy, distinctive sarcastic voice as the primary differentiator — genre gap most competitors don't fill |
| Session length design | Designed for longer, exploratory runs (can run 20–40+ min) | Explicitly designed for 5–15 minute sessions | Matches the short-session camp: endless descent tuned specifically for 5–10 minutes, with autosave/resume supporting interruption |
| Save/resume | Autosave every turn is a genre norm | Same convention | Adopt the norm, extend it to mid-beat snapshotting given the existing serializable state architecture |
| Accessibility | Minimal formal accessibility features (community-driven, not designed-in) | Varies widely, generally weak across the genre | Treat as a table stake designed in from the start — a gap most competitors leave open, and now a compliance requirement (EAA) for EU sales |

## Sources

- [Best mobile Dungeon Crawler games 2025 — MiniReview](https://minireview.io/top-mobile-games/best-dungeon-crawler-games-mobile)
- [Best roguelikes and roguelites for iPhone/iPad — Pocket Gamer](https://www.pocketgamer.com/ios/best-roguelikes-ios/)
- [Best Roguelikes on Android and iOS — Rogueliker](https://rogueliker.com/android-roguelikes/)
- [Shattered Pixel Dungeon — Glitchwave (control scheme, UI, genre classification)](https://glitchwave.com/game/shattered-pixel-dungeon/)
- [Shattered Pixel Dungeon for Android — Uptodown (touch-control description)](https://shattered-pixel-dungeon.en.uptodown.com/android)
- [Game Wisdom — The Struggles of Onboarding Gamers](https://game-wisdom.com/critical/onboarding)
- [Wayline — Tutorial UX: Your Indie Game's Onboarding Roadmap](https://www.wayline.io/blog/tutorial-ux-indie-game-onboarding)
- [Adrian Crook & Associates — Best Practices For Mobile Game Onboarding](https://adriancrook.com/best-practices-for-mobile-game-onboarding/)
- [Medium — I'm Better Than My Stats: Is Meta-Progression Killing Mastery?](https://medium.com/@jannihilator/im-better-than-my-stats-5e19fb38ac35)
- [Bugnet Blog — How to Design a Roguelite Meta-Progression](https://bugnet.io/blog/how-to-design-a-roguelite-meta-progression)
- [Hamatti Notes — Meta-progression with gradual tutorial in roguelike games](https://notes.hamatti.org/gaming/video-games/meta-progression-with-gradual-tutorial-in-roguelike-games)
- [Google for Developers — Enabling Server-Side Access to Google Play Games Services](https://developers.google.com/games/services/android/offline-access)
- [Google Play Help — Track achievements, XP & leaderboards](https://support.google.com/googleplay/answer/3129939?hl=en)
- [Gloobia — Gaming Accessibility Options (2026 Update)](https://gloobia.com/gaming-accessibility-options/)
- [Game Accessibility Guidelines — Basic](https://gameaccessibilityguidelines.com/basic/)
- [Access-Ability — Accessibility Standards / Advancements 2025 Needs (European Accessibility Act)](https://access-ability.uk/2025/02/21/accessibility-standards-advancements-2025-needs/)
- [AppFollow — Mobile game monetization guide: what players want according to reviews](https://appfollow.io/blog/what-mobile-game-players-want-monetization-insights-from-app-store-reviews)
- [AppFollow — Monetization & paywall complaints: a game studio playbook](https://appfollow.io/blog/monetization-paywall-complaints-mobile-game-reviews)
- [Mobile Free To Play — Mobile Session Design: Easy In, Easy Out](https://mobilefreetoplay.com/mobile-session-design/)
- [Udonis — 10 Roguelike Mobile Games You Will Not Quit](https://www.blog.udonis.co/top-games/roguelike)
- [RogueBasin — Catacombs of the Luato Depths (QoL feature conventions)](https://www.roguebasin.com/index.php/Catacombs_of_the_Luato_Depths)
- [Capgo — App Store Age Ratings Guide for iOS and Android](https://capgo.app/blog/app-store-age-ratings-guide/)
- [Capgo — The Complete First-Time App Review Guide for 2026](https://capgo.app/blog/first-time-app-review-guide/)

---
*Feature research for: premium offline single-player mobile roguelike dungeon-crawler (Mazeworld)*
*Researched: 2026-09-07*
