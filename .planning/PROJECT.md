# Delve, Die, Repeat

## What This Is

**Delve, Die, Repeat** (appId `com.darktierstudios.delvedierepeat`) is a premium (paid-upfront), fully-offline mobile roguelike dungeon-crawler for **Android (Google Play)**, adapting a fantasy tabletop RPG the author designed in 1994. As of v1.0 (2026-09-13) it is a native Capacitor app on a Google Play **internal-testing track** with real testers: a pure deterministic engine (`engine/`), a dark torch-lit mobile UX built from the Claude Design mock, endless descent, an NPC party system, a real loot economy, and the sarcastic Oracle voice. Players generate a randomly-rolled adventurer and descend an ever-deeper procedurally-generated maze — fighting monsters, casting spells, looting treasure, and surviving traps and starvation — until permadeath ends the run and they chase a higher depth/score on the next one. It's for players who love crunchy, dice-driven dungeon crawls and the comedic, "play-the-hand-you're-dealt" spirit of the original game.

**Tone & voice:** heavy sarcasm and dark humor — self-aware, deadpan, poking fun at fantasy-RPG tropes and at the player's own doomed adventurers — but kept **family-friendly** (no profanity, gore, or adult content; the darkness is in the wit, not the shock). Sarcasm is the through-line of every screen: death epitaphs, the "Oracle" log, item flavor, the tutorial. This voice is a core identity, not decoration.

## Core Value

**The dungeon crawl** — the tension and discovery of descending into the unknown. If everything else is stripped away, walking deeper into a dangerous, uncertain maze must feel great.

## Business Context

- **Customer**: Solo mobile players who like roguelikes / dungeon crawlers; plus the author's nostalgia audience for the original tabletop game.
- **Revenue model**: One-time paid purchase on Google Play (no ads, no IAP in v1). iOS dropped.
- **Success metric**: Production launch on Google Play + players completing and repeating runs (depth-chasing retention). Internal testers active since 2026-09-10.
- **Strategy notes**: MVP is solo-only. "Play with friends" multiplayer is a deliberate post-MVP add-on that wraps the same rules engine.

## Requirements

### Validated

- ✓ Native, store-installable **Android app** (Capacitor 8) — v1.0, on the Play internal-testing track with real testers
- ✓ Prototype's **full ruleset** preserved as canon — v1.0 (frozen golden-master parity suite, byte-identical every commit; deliberate deviations logged per phase)
- ✓ **100%-dice-rolled character creation** — v1.0 ("THE TABLES DECIDE" roller)
- ✓ **Endless descent** with a bounded soft-cap difficulty curve — v1.0 (feel-tuning still owed → Monster Balancing)
- ✓ **Permadeath** + persistent graveyard (last 5 shown, running total, epitaphs) — v1.0
- ✓ **Local best-depth chase**, no server — v1.0
- ✓ **Fully offline** — v1.0 (self-hosted fonts, zero network calls, `@capacitor/preferences` saves)
- ✓ **Claude Design "Mazeworld Mobile" UX** adapted as the authoritative surface — v1.0 (18 on-device review rounds)
- ✓ Mobile-first controls + readable/accessible UI + settings (handedness, text size, confirm-quit, sound, haptics) — v1.0
- ✓ **Robust local save/resume** (durable native storage, lifecycle flush, fail-closed validation) — v1.0
- ✓ Signed Android App Bundle via Play App Signing, validated on the **internal testing track** — v1.0 (STR-05)
- ✓ NPC **Joiner party system** (1-member cap, model built for N) — v1.0 (Phases 7–11; pulled forward from "post-MVP" because the engine seam made it cheap)
- ✓ **Loot economy**: class bags/carry, manual take/leave/drop/equip, sell-back store, 9 inert items wired — v1.0 (Phases 12–16)
- ✓ **Foe abilities + spellcasting** — v1.1 (19 data-driven ability descriptors, symmetric INT resistance)
- ✓ **Bestiary rebalance** on a yardstick behind one damage seam — v1.1
- ✓ **Parley balance + Language system** — v1.1 (one attempt per encounter, fluency feeds the bonus)
- ✓ **Every sub-class and race has one good and one bad** — v1.2 Phase 24 (11 sub-class mechanics + a 3-race pass, all zero-draw; Woodsman/Pilfer/Cloaker restrictions enforced; 30 blurbs truthful; identity-contract test over 24 subs + 5 races with Human neutral; dagger ruling KEEP; 1188 tests, 2 declared action-path divergences, prototype master untouched)
- ✓ **Casters can act** — v1.2 Phase 23 (Wizard refuses melee only while an attack spell is castable and names it; every non-Summoner caster rolls a day-one attack spell with zero new rng draws; Summon at level 1 for Summoners and Phantom Host at level 1 for Illusionists via a data-driven override table; Freeze kills pay out like any kill; 1036 tests, three declared parity divergences, prototype master untouched)
- ✓ **Class-aware playtest harness** — v1.2 Phase 22 (dev-only `force` chargen seam, sub-class-aware bot with `chooseSpell` scoring table, `tools/tune-classes.mjs` 143-cell matrix on worker threads, `--start-depth`, `stuck` bucket; 989 tests, parity untouched)
- ✓ **BEFORE class matrix captured** — v1.2 Phase 22 (`docs/CLASS-PASS.md` + `docs/class-pass/before*.json`, engine pinned `5565b22`; 0 stuck in 7,150 runs)
- ✓ **Depth scaling past floor 5** (`engine/difficulty.js`, tuning bot, dev start-at-depth) — v1.1 (human sign-off TUNE-04 came back tune-again → v1.2)

### Active

- [ ] **Feature feedback** — every class/sub-class/racial feature that fires or blocks the player is narrated (Oracle + toast), enemy hits toast red, multi-attack foes aggregate "X of N". — v1.2
- [ ] **Mass playtest AFTER matrix + findings ledger** — all 143 valid combinations at volume post-identity-pass, ranked over/under-performers with fun-band verdicts, before/after ledger (`docs/CLASS-PASS.md`). — v1.2 (BEFORE half validated in Phase 22)
- [ ] **Delve-to-death retune** — the deferred TUNE-04 re-attempt on corrected player power, human DR sign-off. — v1.2
- [ ] **Quick 5–10 minute session feel** — mechanically bounded; validated only by the retune + playtest
- [ ] Player **onboarding/tutorial** (first-run coach marks, 04-10 / UX-06) — deliberately LAST, once the UI settles
- [ ] **Publish to Google Play production** — store entry exists; remaining: repo-side SDK/dependency audit for Data Safety, privacy-policy page, listing assets/copy, then the Console steps (Data Safety, IARC, paid pricing, production rollout)
- [ ] Automate the Play upload (Developer API service account) — see `docs/RELEASING.md`
- [ ] **Feedback, Feel & Polish remainder** (v1.3 candidate) — inventory integrity, store stock, UI layout, combat start on Fight!, "not ready yet" audit; see `.planning/proposed-milestone-feedback-feel-polish.md`

### Out of Scope

- **iOS / Apple App Store** — deliberately out of scope. Android/Google Play only. Avoids the Apple Developer account, Mac/Xcode toolchain, and Apple's review process. May be reconsidered post-launch, but the tech path should not be compromised to accommodate it now.
- **Networked multiplayer / "play with friends"** — still post-launch (v2). The *party* layer is now IN scope and shipped (Joiners, Phases 7–11) as its single-player foundation; only the network/relay layer stays out.
- **Accounts, logins, cloud save, servers** — go simple; use platform identity (Game Center / Google Play Games) later if/when multiplayer needs it.
- **Ads and in-app purchases** — v1 is paid-upfront only.
- **Player-authored / Game-Master layer from the tabletop rules** — not revived. (The *party* layer WAS revived in v1.0 as the Joiner system — reasoning changed once the engine seam made it a 5-phase job.)
- **Original illustrated art / voiced audio as a hard requirement** — the prototype's procedural/typographic aesthetic is a viable shipping style; richer art/audio is a nice-to-have, not a gate.

## Current State (v1.1 shipped 2026-09-14; v1.2 started 2026-09-14)

**v1.2 progress:** Phases 22–24 complete (2026-09-14). Phase 22: harness + BEFORE matrix. Phase 23: casters can act. Phase 24: every sub-class and race has one good and one bad (smoke: Guard 2.80 → 3.22, Fridgian 2.46 → 2.97, Dwarven 2.45 → 2.73, Knight 3.19 → 3.48). Next: Phase 25, nothing happens silently.

**Shipped:** v1.0 (Android build, internal testing) and v1.1 (Monster Balancing & Abilities). The engine now has data-driven foe abilities with symmetric INT resistance, a yardstick-rebalanced bestiary behind one damage seam, a parley system with real cost and a fluency-based Language system, and depth scaling past floor 5 with a dev start-at-depth harness. 951 tests, parity 30/30 with one documented divergence (seed-303 parley).

**Known deferrals carried forward:** the consolidated difficulty retune's human sign-off (TUNE-04) came back **tune-again** — depth 20 is instant death — and is deferred until after the upcoming cleanup + class-fixes milestones move player power (`docs/DIFFICULTY-RETUNE.md`). First-run tutorial (UX-06) and the Google Play production launch (STR-01..04, STR-06) remain deferred by the user.

## Current Milestone: v1.2 Class Pass & Mass Playtest

**Goal:** Every class, sub-class, and race is fun to be dealt — one solid good, one solid bad, no "cannot act" states — then a class-aware mass playtest ranks who over/under-performs, and the deferred difficulty retune (TUNE-04) lands on the corrected player power.

**Target features:**
- Sub-class and race identity pass (24 subs × 6 races): code-verified good + bad for each; headline fixes — Wizard melee refusal only while an attack spell is castable and an attack spell is guaranteed at chargen; Summoner can summon at level 1; Illusionist has a level-1 damage source; missing "bads" (Knight, Master of Arms, Court Mage, Pickpocket, Cutthroat, Ninja, Bard) and missing "good" (Guard) implemented from their own flavor text; unenforced flavor (Woodsman armor, Pilfer magic items) enforced or reworded. Human stays the neutral control race (user decision 2026-09-14).
- Feature feedback (folded in from the Feedback/Feel/Polish proposal §A/§B): every class/sub/race feature that fires or blocks is narrated; enemy hits toast red; "X of N hits" aggregation; effect legibility for spells/items in both directions.
- Class-aware playtest harness: force any class/sub/race deterministically; sub-class-aware bot policy (Summon out of combat, Bard sings, Illusionist Mirror Self, Doze/Stun/Weaken casts, Con Artist parleys); per-combination matrix report.
- Mass playtest + findings ledger: all 144 combinations at volume, ranked over/under-performers, committed before/after ledger (`docs/CLASS-PASS.md`).
- Delve-to-death retune: TUNE-04 re-attempt (`engine/difficulty.js`) using the matrix as the yardstick, closed by a human DR round.

**Baseline (2026-09-14, 400-seed tuning bot, pre-milestone):** mean death depth Thief 3.2 / Fighter 3.1 / Magic User 2.1; Magic Users reach floor 5 in 4% of runs vs 20% for Thieves; bottom five subs all Magic Users (Summoner 1.3, Wizard 1.7, Apprentice 1.7, Warlock 1.8, Illusionist 2.1); top three Barbarian 4.1, Ninja 4.1, Cat Burglar 3.8. Caveat: the v1.1 bot casts only thrown spells, so caster subs are under-measured — the harness fix is itself a target feature.

**Out of this milestone (parked for v1.3 "Feedback, Feel & Polish" remainder):** inventory integrity (armor durability, bag cap, bigger bags, Cloak of Armor, G16 squares + Amulet of Stone), UI layout (gear panel, recenter, zoom, tutorial toggle, Make Camp row/handedness), combat start only on Fight!, "not ready yet" audit, combat potions from Gear, store stock, Shield chip, round-based effects expiring outside combat.

<details>
<summary>Archived: v1.1 milestone section</summary>

## Current Milestone: v1.1 Monster Balancing & Abilities

**Goal:** Make fights fair and interesting at depth — give foes real abilities (spellcasting and specials), rebalance the bestiary, fix parley's dominance, and run the ONE consolidated difficulty retune across party, economy, and monster power.

**Target features:**
- Foe abilities + spellcasting — data-driven, deterministic, parity-gated, narrated through the Oracle/toasts/condition tracker; rulebook-first, invent only to fill depth-band gaps
- Bestiary rebalance — every creature's HP/damage/to-hit/AR/special vs. intended depth
- Consolidated difficulty retune — fold ability-bearing foes into `difficulty.js`, re-run the tuning harness (closes PARTY-10, ECON deep tuning, Phase 3 feel-tuning)
- Parley balance pass + Language as a system (DR15-A, Helm of Knowledge wiring) + symmetric INT spell resistance

**Progress:** Phase 17 complete (2026-09-13) — fixture inventory (`test/parity/FIXTURE-INVENTORY.md`: only Bat/Rat, Shriek, Viper, Dante at L1 are fixture-exposed), `pickFoeTarget`/`applyFoeDamageToPlayer` extracted from `foeTurn`, FID-02 draw-count baseline pinned; 724/724 tests, parity byte-identical.

**Progress:** Phase 18 complete (2026-09-13) — `engine/foeDamage.js#damageFoe` is now the ONE damage-to-foe seam (multiplier → halfDmg → gated d20 armor soak → apply); foe natural armor, Sterling halving, Cleric/spell/Fighter type multipliers, Philly `slow` live; 9 bestiary rows retuned (Drake 135→38, Werebeast, 7 pre-ability caster discounts) with the before/after ledger in `content/BESTIARY-REBALANCE.md` + `tools/bestiary-yardstick.mjs`; zero carve-outs; 796/796 tests.

**Progress:** Phase 19 complete (2026-09-14) — data-driven foe abilities: `content/foe-abilities.js` (19 descriptors) + kits on the 8 caster rows, `engine/foeAbilities.js` resolver gated in `foeTurn` (zero draws for ability-less foes), bolts/drains/debuffs/heals/summons, Spectre pursuit, Djinni low-HP flee; symmetric INT resistance via one shared `resistRoll` (`derived.js`, draw-neutral for player casting); "Weakened"/"Dazed" chip; D-15 determinism suite for the five caster encounters; 882/882 tests, parity byte-identical, zero fixture regeneration. One on-device check (chip renders/counts down) deferred to `/gsd-verify-work 19`.

**Progress:** Phase 20 complete (2026-09-14) — parley rebalanced: one attempt per encounter (`C.parleyTried`), failed attempts insult the group (+1 to every foe swing incl. the pursuit strike), Con Artist +6→+4 (~60% at even level), `need` clamped ≤17, payout = ½ the exact kill-SP formula via shared `killSpFor`, Humans wilmst bonus on d6=6 only; Language is a fluency system (`fluency(c)` 0/1/2 from the skill + Helm of Knowledge, +2/tier, tier 2 opens Magical, the Wilmsry-vs-Magical grudge line now reachable). The ONE deliberate parity divergence (seed-303 parley scenario) is a scenario-scoped carve-out with a before/after table (need 19→17, sp 13→7, gold 250→50); 200-seed readout in `docs/PARLEY-REBALANCE.md` (attempts 151→97, success 57.6%→60.8%, SP share 3.7%→2.3%); 912/912 tests.

**Scope boundaries:** engine/data/narration only — no new screens. Backlogged (not this milestone): DR16-G "squares of opponents" / Amulet of Stone, foe inspect / threat hint on the encounter panel, a browsable bestiary screen. Research-first: foe casting vs. RNG order/parity, how abilities move the tuned curve, which abilities fit tone + canon.

</details>

## Context

- **Source materials** (kept in-repo as reference, not deleted):
  - `mazeworld.html` — a ~3,300-line, single-file, **zero-dependency vanilla-JS** prototype (DOM + `<canvas>`, `localStorage` save). It is a **complete, proven solo implementation** of the ruleset and is the authoritative behavioral spec. Key seams already present: a single global `S` state object, an `act()`/"beats" action system, and a responsive 1080px mobile reflow with a touch D-pad and one-beat-at-a-time stepping.
  - `mazeworld.pdf` — the original 1994 rulebook (~3,700 lines of text). Old and untested; **superseded by the prototype** wherever they conflict. Valuable for lore (the god Felect, The Planes, the Wilmsry, the year-792 cataclysm) and for dropped systems that could be ported later (bag/carry-weight, shields, thrown weapons, richer phobia/language tables).
- **Prototype rules that supersede the rulebook** (already decided in-prototype): solo conversion (no party/Maze Master), invented natural healing (`sleep = d10 + 2×level`), skill points ×5 for solo pacing, Magic Users start `25 + d10` WP, loot ÷10, and several book-ambiguity rulings the prototype formalized.
- **Codebase state after v1.0 (2026-09-13):** ~15.5k lines of game source (`engine/` pure rules, `content/` pure data tables, `src/browser/` adapter/view-models/narration, `mazeworld.html` as the DOM/canvas shell with a strangler-fig'd classic script) + ~22.8k lines of tests (683 tests: unit, determinism, round-trip, parity against the frozen `test/parity/prototype-master.js.txt`, voice safety scan). Zero runtime dependencies beyond Capacitor's own plugins. Build: `tools/build-www.mjs` (no bundler) → `npx cap sync` → Gradle; release via `npm run play:release` (`docs/RELEASING.md`).
- **Working method that emerged:** GSD phases for systems work, then rapid on-device "DR" (device-review) rounds on the user's Pixel 7 for UX — each round a small user-directed batch, built + sideloaded + reviewed live. The user's device play is the human UAT. Every engine change is parity-gated: new rng draws only behind new-feature guards, new serialized fields carved out of the parity comparators, the prototype master never edited.
- **Known debt:** the classic (non-engine) gameplay functions in `mazeworld.html` are dead-but-present; `formatEvents`/`EVENT_NARRATION` is the single narration table (coverage-guarded); `04-10-PLAN.md` (tutorial) predates the DR-era UI and needs re-planning.
- **Author is new to mobile development** — de-risked: native build, signing, and Play internal testing are all working.
- **The heavy lift is platform + presentation + endless-mode conversion**, not rebuilding game logic. Whatever tech path is chosen (e.g. wrapping the existing web game vs. porting to an engine) must keep the rules engine decoupled and state serializable to protect the multiplayer future.

## Constraints

- **Platforms**: Must ship to **Google Play (Android only)**. Native packaging, Play App Signing, store entry and internal-testing track are DONE (targetSdk 36, minSdk 24); remaining compliance = Data Safety form, IARC, privacy policy, production listing. iOS is explicitly excluded.
- **Offline**: v1 must run with **no network**, no accounts, no backend.
- **Monetization**: **Paid upfront**, no ads/IAP — keep the build free of monetization SDKs.
- **Fidelity**: The prototype's rules are **canon**; deviations must be deliberate design decisions, not accidental regressions.
- **Rules engine**: Must remain **decoupled from UI and fully serializable** (multiplayer-ready), mirroring the prototype's existing `S`-state / `act()` design.
- **Performance / feel**: Must feel responsive and native-quality on mid-range phones; sessions target **5–10 minutes**.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Android / Google Play only; no iOS | Avoid Apple's account/Mac/Xcode/review overhead; author's explicit choice | ✓ Good — shipped to internal testing in 7 days on Windows only |
| Solo-only MVP; multiplayer post-MVP add-on | Ship value fast; multiplayer is a large, separable layer | ⚠️ Revisit — the *party* half was pulled into v1.0 (Joiners) because the engine seam made it cheap; only networking remains deferred |
| Endless descent replaces fixed 5-floor Gate | "Descend forever + chase depth" fits roguelike + quick sessions | ✓ Good — curve is bounded/tested; feel-tuning owed to the consolidated retune |
| Permadeath, no meta-progression in v1 | Author chose pure roguelike; local high-score is the hook | ✓ Good — graveyard rework (cap 5, running total) made death feel like content |
| 100%-dice-rolled characters, no player choice | Faithful to the game's comedic identity | ✓ Good — "THE TABLES DECIDE" roller is a highlight on device |
| Fully offline, no accounts; platform identity later | Simplest path to ship; protects multiplayer future cheaply | ✓ Good — Data Safety can truthfully declare "no data collected" |
| Paid-upfront, no ads/IAP | Author's chosen model; keeps build clean | ✓ Good — zero third-party SDKs beyond Capacitor plugins |
| Prototype is canon over the rulebook | Prototype is tested/playable; rulebook is old and untested | ✓ Good — frozen golden master + parity suite made every deviation deliberate and visible |
| Voice: heavy sarcasm / dark humor, but family-friendly | Core identity of the game; must stay clean enough for a broad store rating | ✓ Good — safety-scan guardrail over all copy; user directive: lean into humor when class/race works against the player |
| Keep rules engine decoupled + state serializable | Enables post-MVP multiplayer without a rewrite | ✓ Good — paid off immediately: party system, economy, and every UI rewrite touched no engine seam |
| Wrap the web game with Capacitor (not an engine port) | Prototype is DOM+canvas with a serializable global state — ideal WebView shape | ✓ Good — same JS runs in a browser (Claude-in-Chrome layout checks) and on device |
| Claude Design mock is the AUTHORITATIVE UX; prototype UX superseded where the mock defines a surface | User directive 2026-09-09 | ✓ Good — kept 18 DR rounds converging instead of drifting |
| D-pad-only movement (tap-to-move removed); handedness moves only MAKE CAMP | On-device feel, user decision | ✓ Good |
| Name: "Delve, Die, Repeat" (the working title collided with an existing Play listing) | Trademark/discoverability research 2026-09-08 | ✓ Good — appId `com.darktierstudios.delvedierepeat` is now permanent (published) |
| Human UAT deferred to milestone end; user's device play IS the UAT | Autonomous run 2026-09-07 | ✓ Good — v1.0 closed as an override closeout on that basis |
| Every engine change parity-gated (rng draws behind feature guards, new fields carved out of comparators, master never edited) | Protects "prototype is canon" while adding systems | ✓ Good — byte-identical through Joiners, Economy, phobias, flight |
| ONE consolidated difficulty retune after all power-changing milestones (not per-milestone) | Avoid triple-tuning across Joiners/Economy/Monsters | — Pending — lands in Monster Balancing |
| Difficulty is tuned toward **depth 20**, not infinite depth; reaching 20 is a **unicorn run** (rare, not expected); past 20 the curve is left alone — no dial-back, no artificial death | User decision 2026-09-14 (v1.2 Phase 22): a bounded, honest target replaces "endless survivability"; the score chase is reaching and pushing slightly past 20 | — Pending — governs Phase 27's TUNE-05 target band |
| Freeze kills pay experience, coin, treasure, and kill count like any other kill (prototype awarded nothing) | User decision 2026-09-14 during Phase 23: a prototype bug, not a rule; casters need their kills to count | ✓ Landed in Phase 23 with a declared parity divergence |
| Tutorial built LAST, after the UI settles | A UI change forces a tutorial redo | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-14 — v1.2 Phase 24 complete (identity pass)*
