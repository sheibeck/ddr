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
- ✓ **Nothing happens silently** — v1.2 Phase 25 (pure toast table exactly partitioning all 209 engine event types with a 21-entry Oracle-only allowlist; red-for-them/green-for-you tone families plus amber refusals; per-foe "K of M" aggregation and the 3-foe collapse; 15 fledgling miss quips at levels 1–2; passive modifiers surfaced as additive event payload; one dispatch seam in the shell; 1330 tests, parity untouched)
- ✓ **Device feedback batch (inserted Phase 25.1)** — v1.2 Phase 25.1 (the "Move on" card only for floorChanged/leveled plus the existing Fight!/Joiner/find/death cards; every other move-path event is a toast carrying the Oracle sentence; toasts 3000 + 60/char capped at 9 s, +1.2 s per visible toast, tap to dismiss; Oracle fills the screen, opens at the newest line, "↑ newer" pill; a full party swaps its Joiner with one of five exit lines, zero rng; party members fight by class — Fighter weapon, Thief backstab, Magic User attack spell on own charges; Make Camp refuses with "You eat N a night, you have M" counting party appetites like newDay; 1397 tests, parity untouched)
- ✓ **Every sub-class and race has one good and one bad** — v1.2 Phase 24 (11 sub-class mechanics + a 3-race pass, all zero-draw; Woodsman/Pilfer/Cloaker restrictions enforced; 30 blurbs truthful; identity-contract test over 24 subs + 5 races with Human neutral; dagger ruling KEEP; 1188 tests, 2 declared action-path divergences, prototype master untouched)
- ✓ **Casters can act** — v1.2 Phase 23 (Wizard refuses melee only while an attack spell is castable and names it; every non-Summoner caster rolls a day-one attack spell with zero new rng draws; Summon at level 1 for Summoners and Phantom Host at level 1 for Illusionists via a data-driven override table; Freeze kills pay out like any kill; 1036 tests, three declared parity divergences, prototype master untouched)
- ✓ **Class-aware playtest harness** — v1.2 Phase 22 (dev-only `force` chargen seam, sub-class-aware bot with `chooseSpell` scoring table, `tools/tune-classes.mjs` 143-cell matrix on worker threads, `--start-depth`, `stuck` bucket; 989 tests, parity untouched)
- ✓ **BEFORE class matrix captured** — v1.2 Phase 22 (`docs/CLASS-PASS.md` + `docs/class-pass/before*.json`, engine pinned `5565b22`; 0 stuck in 7,150 runs)
- ✓ **Depth scaling past floor 5** (`engine/difficulty.js`, tuning bot, dev start-at-depth) — v1.1 (human sign-off TUNE-04 came back tune-again → v1.2)

### Active

- ✓ **Mass playtest AFTER matrix + findings ledger** — v1.2 Phase 26 (AFTER 143 × 40 + 143 × 10 on pin d1e3235 at BEFORE parameters; μ 3.08, bands 2.31–4.15; 0 cannot-act cells; every caster sub in band; one out-of-band row — Ninja, too strong, accepted; Wilmsry in band; revisit list empty; `tools/class-pass-diff.mjs` + `docs/class-pass/verdicts.json` + standing ledger test; the gate caught a pre-existing stranded-combat bug (foe killed by ward reflect on its opening turn) fixed as a gap closure)
- ✓ **Delve-to-death retune** — v1.2 Phase 27 (band agreed over three user rounds and recorded first; pin 39bfecf: canon combat through depth 20 (`COMBAT_SCALE_FROM_DEPTH` 21), gentle ramp past it (power 1.15, threat 1.3, cap 4), foe grace ×0.5 at floors 2–4, dot cap 13, darkness held through 3, hazard ×0.5 from floor 2, Dante → tier 2 / Ned tier 1 as the one declared parity divergence; AFTER: bot median 4, reach-5 30.6 %, forced-20 3.17 fights — IN; forced-20 floors 0.84 / reach-20 0.1 % — recorded misses; TUNE-07 closed by user deferral 2026-09-15, DR round carried forward)
- [ ] **Quick 5–10 minute session feel** — mechanically bounded; validated only by the retune + playtest
- [ ] Player **onboarding/tutorial** (first-run coach marks, 04-10 / UX-06) — deliberately LAST, once the UI settles
- [ ] **Publish to Google Play production** — store entry exists; remaining: repo-side SDK/dependency audit for Data Safety, privacy-policy page, listing assets/copy, then the Console steps (Data Safety, IARC, paid pricing, production rollout)
- [ ] Automate the Play upload (Developer API service account) — see `docs/RELEASING.md`
- ✓ **Armor rework** — v1.3 Phase 28 (soak-vs-wear ruling audited: rulebook p.44 = prototype = engine, kept as canon and recorded as a Key Decision; the "wear N / panel shows no damage" discrepancy root-caused to the HUD armor line never showing durability and pinned by test; durability rides the bag item (`left`/`patches`) so re-equip no longer repairs; destroyed armor is gone; Cloak of Armor = never-wearing plate for any carrier, text states the rule, shown as effective armor; four armor outcomes narrated via additive `armorSoaked` flags; 1485/1485 tests, master untouched; 5 Pixel 7 checks deferred to the end-of-run UAT batch)
- ✓ **End-of-combat loot** — v1.3 Phase 29 (every foe drop goes into a serialized `pendingLoot` pile and is presented on a Victory card with Take/Leave per item, Take all/Leave all, `lootCompare` readout and Equip now vs Stow; one `stowItem` bag-cap gate on every pickup/buy/kit/loot path — potions and scrolls never count, a refused stow spends nothing; bigger bags (medium/large/exlarge from floors 2/5/9) as one-tier-up treasure behind the phase's single guarded rng draw; flee/death forfeit the pile with a narrated line; 1593/1593 tests, zero fixture edits; 8 Pixel 7 checks deferred to the end-of-run UAT batch)
- ✓ **Combat narrative & input redesign** — v1.3 Phases 30–32: the Round Card built (`docs/COMBAT-NARRATIVE-DESIGN.md` §6 contract) — one always-visible, uncapped round block below the foe roster (post-dispatch routing in `dispatchWithToasts`; refusals stay toasts; Oracle untouched), `S.lastExchange` retired, `src/browser/inputGuards.js` 250 ms arm/settle `Date.now()` guards on every encounter decision button + `window.move`; 1902 tests, engine/parity untouched; CMBUI-06 device round in the end-of-run UAT batch
- ✓ **Combat start & usability** — v1.3 Phase 31 (`fight` action owns initiative/phobia/pre-emptive strike after an explicit Fight! tap, `combat.pending` gates the preview; every refusal explains itself — `docs/USABLE-FEATURES-AUDIT.md` + doc-synced test; buff potions usable from Gear, targeted staffs combat-only; Shield chip shows pool + rounds, Acuteness ticks per round/step; Amulet of Stone/Pine Staff kills close the encounter with full payout; phobia = Afraid penalty (need −3 on a LOW-range to-hit, half damage, 2 rounds), never a lost action; Elven foeToHit inversion flipped; sheet TO HIT reads 1–N; 1855 tests, master untouched)
- ✓ **UI feel** — v1.3 Phase 33 (UIF-01/02/03/05): gear rows show Use/Equip beside a far-right Drop with an inline two-tap confirm; the map recenters on the party at every panel-closed choke point and on pinch release; default zoom 1.5 (session-only); Make Camp lives in the Marks/Centre strip and the handedness option is gone. The tutorial on/off setting (UIF-04) was dropped from v1.3 — the tutorial UI is not wired yet — and moves to the UX-06 backlog
- ✓ **Store stock random and floor-appropriate** — v1.3 Phase 33 (STORE-01): depth-tiered potions/weapons/armor/premium behind the `state.storeRoll` run flag (new runs only; fixtures, bots and old saves stay on the frozen roll)
- ✓ **Combat screen rebuilt to the Claude Design mock** — v1.4 Phase 34 (CSCR-01..09): one dark full-screen panel (ENCOUNTER · ROUND N · N STANDING header, foe cards with guarded tap-to-target, YOUR LOT strip for hero + joiners, newest-first › fight log with tap-to-reveal dice — refusals as dull entries, no in-combat toasts), the 2×2 STRIKE / SPELLS-or-ABILITIES / ITEMS / SOCIAL grid with per-class submenus and keyboard map, the Fight! gate as the map's MAJOR OVERLAY (`renderMajorOverlay`, reused by Phase 35), and the THEY ARE DOWN / YOU GOT OUT / THAT IS THAT endings folded into the same screen; presentation view-models in 'src/browser/{fightLog,combatMenu,combatPanel}.js`; 2047/2047 tests, engine/content/parity untouched; CSCR-10 = 27 Pixel 7 checks deferred to the end-of-run UAT batch
- [ ] **Next tuning pass** (deferred, not v1.3) — TUNE-07 human DR round (forced 20/35/50 + natural) and the TUNE-06 roster decision wait in `docs/DIFFICULTY-RETUNE.md`; Play versionCode-4 upload pending the phone

### Out of Scope

- **iOS / Apple App Store** — deliberately out of scope. Android/Google Play only. Avoids the Apple Developer account, Mac/Xcode toolchain, and Apple's review process. May be reconsidered post-launch, but the tech path should not be compromised to accommodate it now.
- **Networked multiplayer / "play with friends"** — still post-launch (v2). The *party* layer is now IN scope and shipped (Joiners, Phases 7–11) as its single-player foundation; only the network/relay layer stays out.
- **Accounts, logins, cloud save, servers** — go simple; use platform identity (Game Center / Google Play Games) later if/when multiplayer needs it.
- **Ads and in-app purchases** — v1 is paid-upfront only.
- **Player-authored / Game-Master layer from the tabletop rules** — not revived. (The *party* layer WAS revived in v1.0 as the Joiner system — reasoning changed once the engine seam made it a 5-phase job.)
- **Original illustrated art / voiced audio as a hard requirement** — the prototype's procedural/typographic aesthetic is a viable shipping style; richer art/audio is a nice-to-have, not a gate.

## Current Milestone: v1.3 Feel, Loot & Combat Flow

**Goal:** Make gear and combat legible and honest — armor behaves the way the screen says it does, kill drops become a real end-of-combat loot decision, and the combat narrative is delivered through a researched, less tap-heavy, tap-safe UI — while landing the parked Feel & Polish backlog (inventory integrity, UI feel, combat start, store stock).

**Target features:**
- **Armor rework** — audit and decide the soak-vs-wear rule; fix the "Armor takes N / Wear N" toast vs. gear-panel discrepancy; durability on the item (kills the re-equip full-repair exploit); Cloak of Armor legible and real; every armor outcome narrated
- **End-of-combat loot** — foe drops collected during combat and presented afterward with take/leave per item; one bag-cap gate with feedback; bigger bags as depth-appropriate treasure; no more silent/auto-rejected drops
- **Combat narrative & input research → design → build** — known-pattern survey (combat log/ledger, batched round summaries, auto-advance, mis-tap guards), a chosen design, then the implementation: less disjointed narrative, fewer taps to move on, Fight!/decision buttons protected from D-pad thumb-spam
- **Combat start & usability** — no initiative before Fight!; "not ready yet" audit; combat potions from Gear; Shield chip; round-based effects expire outside combat; G16 squares of opponents + Amulet of Stone ends combat
- **UI feel** — gear panel Use/Drop + drop confirm; map recenter; default zoom midpoint; tutorial on/off; Make Camp into the toolbar row; handedness removed
- **Store stock** — random, floor-appropriate

**Out of this milestone (user decision 2026-09-15):** the tuning pass (TUNE-07 human DR round, TUNE-06 roster decision — `docs/DIFFICULTY-RETUNE.md`), the Play versionCode-4 upload (pending the phone), the first-run tutorial (UX-06), production launch (STR-01..04/06), Developer API upload automation. Phase numbering continues from 27.

**Engine gate applies as always:** pure/deterministic engine, parity byte-identical for solo/empty-party play, new rng draws (store stock, bag loot, drop collection) only behind new-feature guards, new serialized fields (item-carried durability, pending loot) carved out of all three `*Comparable()` fns, every new event type gets an `EVENT_NARRATION` + toast-table entry, prototype master never edited.

## Current State (v1.2 shipped 2026-09-15; v1.3 started 2026-09-15)

**Shipped:** v1.0 (Android build, internal testing), v1.1 (Monster Balancing & Abilities) and v1.2 (Class Pass & Mass Playtest — every sub-class and race with a code-verified good and bad, casters that can act, a toast/Oracle feedback layer for every feature, a device-feedback batch, a 143-cell class matrix ledger with fun-band verdicts, and a depth-20-targeted retune that made the game canon through depth 20 with an eased early game). The engine has data-driven foe abilities with symmetric INT resistance, a yardstick-rebalanced bestiary behind one damage seam, a parley system with real cost and a fluency-based Language system, and depth scaling past floor 5 with a dev start-at-depth harness. 1448 tests, parity 33/33 with declared, machine-checked divergences.

**Known deferrals carried forward:** the human DR verdict on the retune (TUNE-04 in v1.1 → TUNE-07 in v1.2) has been deferred twice by the user — the v1.2 constants ship as landed, and the four-run DR checklist waits in `docs/DIFFICULTY-RETUNE.md` for a later tuning milestone (explicitly NOT v1.3). Two bot band rows stay short (forced-20 floors gained; reach ≥ 20) and would need canon tier-3/5 roster decisions. The Play internal track is on versionCode 3 (pre-25.1); a versionCode-4 upload is pending the user's return. v1.0 tail (tutorial, production launch) still deferred.

## Last Milestone: v1.2 Class Pass & Mass Playtest (shipped 2026-09-15)

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

## Current State (2026-09-16, after v1.4 Phase 34)

**In progress:** v1.4 "Combat & Map Screens" — Phase 34 (combat screen rebuild) complete on automated evidence, 2047 tests green, parity master untouched; Phase 35 (map screen rebuild: tap-to-step, bottom rail replacing every toast, HUD + chips, major overlay for descents/death) next. The debug APK build + Pixel 7 UAT batch (v1.3's 50 checks + Phase 34's 27) runs once after Phase 35.

**Shipped:** v1.3 "Feel, Loot & Combat Flow" (Phases 28–33) — armor integrity, end-of-combat loot + bag cap, Fight!-gated combat with explained refusals and honest effect chips, the Afraid/Elven rules rulings, the Round Card + input guards, gear/toolbar/map polish, depth-rolled store stock. 1955 tests green; parity master untouched since v1.2. Debug build installed on the Pixel 7; the 50-check UAT batch (incl. the CMBUI-06 DR round) runs against it.

**Next milestone candidates:** the v1.0 launch tail (UX-06 tutorial incl. the dropped UIF-04 toggle; Google Play production launch STR-01..04/06), the deferred tuning pass (TUNE-06/07, `storeRoll` for bots), a feel pass for the unguarded button set + haptics — plus whatever the UAT batch turns up.

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
| Combat round narrative = one always-visible Round Card in the encounter panel (below the foe roster, above the action bar) + `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` = 250 ms `Date.now()` guards; in-combat per-event toasts replaced, Oracle stays the complete log | Phase 30 survey (`docs/COMBAT-NARRATIVE-DESIGN.md`): scored 4.75/5 on the fixed scorecard (highest of six patterns incl. today's toast stack at 2.90); generalizes the shipped Phase 29 loot card; reuses `toastsForAction`'s groupers unmodified; the code read showed the overlay already covers the D-pad, so the real mis-tap is rapid re-render collision — the guards target that. User ratified 2026-09-16 over the Guarded Bundled Toast runner-up | ✓ Built in Phase 32 — uncapped card (user ruling), `inputGuards.js`, 24 guarded call sites, worst-case round measured at 6 lines / 293 chars; on-device DR round deferred to end-of-run UAT |
| Fight-log dice detail sourced through the folding pipeline (`toastsForAction` `withIdx` + `oracleDetailText`), not raw `result.html` — Phase 34, 2026-09-16 | CONTEXT pins "log line count = folded count" and the 400-seed worst-case proof; raw events would give one line per narrated event and break both. A folded entry reveals its first constituent event's dice; the Oracle stays the complete record | ✓ Landed in 34-01/34-02 — `round-card-worst-case` retargeted, 400/400 seeds reveal dice; `#enc-body .roll` DR18 rule scoped to `.evt` so tap-to-reveal can render |
| `renderMajorOverlay(host, spec)` is combat-agnostic and built in Phase 34 for Phase 35 to reuse — 2026-09-16 | The Fight! gate moved to the map's MAJOR OVERLAY (user amendment); descents (GO DOWN / NOT YET) and out-of-combat death use the same surface next phase, so parameterizing now costs nothing and avoids a second overlay element | ✓ `#mw-major` + guarded `#mw-major-primary/-secondary`; the combat screen never renders a pending combat; no engine `retarget` action exists or was added — targeting stays the guarded shell mutation |
| Store stock rolled by depth behind a run flag (`state.storeRoll`, v1.3 Phase 33) | Parity must stay byte-identical for fixtures/old saves while new runs get floor-appropriate stock; a newRun option only the shell sets (the `dev` precedent) keeps every fixture, bot and pre-Phase-33 save on the frozen roll, with the new draws placed after every existing draw | ✓ Good — zero fixture edits, six one-line comparable strips, tiers reuse the BAG_FLOORS 2/5/9 ladder; on-device check of shallow vs. deep stock deferred to the end-of-run UAT batch |
| UIF-04 tutorial on/off setting dropped from v1.3 (2026-09-16) | Phase 33 research found `src/browser/tutorial.js` has zero references in the shell and UX-06 is parked past the milestone — a toggle would control nothing | ✓ Moved to the UX-06 backlog; REQUIREMENTS/ROADMAP annotated |
| Elven foeToHit flipped −1 → +1 (easier to hit) — Phase 31, 2026-09-16 | The 1994 prototype's −1 made Elves HARDER to hit because foeToHitVs adds the value to the foe's need (hit on roll ≤ need) — the opposite of the race note, flavor.js and CLASS-PASS ("thin-boned and easy to hit"); the roll-direction audit (`31-ROLL-DIRECTION-AUDIT.md`, 34 sites OK, 2 inversions) caught the inversion and the user ruled the prose is canon | ✓ Deliberate canon deviation: data-layer flip in content/races.js with a DELIBERATE RULES CHANGE comment, identity-contract asserts the direction (foe need 6 vs 5), zero fixtures affected, master untouched |
| Phobia = Afraid PENALTY, never a lost action — Phase 31, 2026-09-16 | User ruling: "Phobia should be penalties, never a no actions state"; the to-hit system is a LOW range (hit on d20 ≤ need), so a "−3 penalty" SHRINKS the need (`afraidNeed = Math.max(1, need − 3)`), never `roll − 3`; damage halved (ceil, min 1) for 2 rounds; every action stays available while afraid | ✓ Landed in Phase 31 — three declared action-path divergences (combat/lose 14, lose-apprentice 127, magic/cast-damage 8) replace the prototype's freeze; death-path parity restored via the new `lose-plain` scenario (seed 1119) |
| Armor soak-vs-wear: canon kept (rulebook p.44 = prototype = engine — d20 ≤ AR soaks the whole blow; blocked damage above the piece's Min is charged to durability; Dwarves wear at half); Cloak of Armor = never-wearing magic Plate for ANY carrier (no class gate); destroyed armor is gone (no repair, no bag copy); durability rides on the bag item (left/patches) when a piece leaves the body | Phase 28 audit (2026-09-15): rulebook, frozen prototype and live engine already agree byte-for-byte, so changing the rule would be tuning, not a fidelity fix; the real defects were display (the HUD armor line never showed durability) and data-model (durability reset to full on every re-equip). User addition: the cloak counts as armor for anyone who can carry a cloak | ✓ Landed in Phase 28 — no fixture regenerated, no new parity divergence (left/patches carved out of all three comparables as a structural tripwire); toast wear and displayed durability pinned equal by test/unit/armorDisplay.test.js |

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
*Last updated: 2026-09-16 — v1.4 Phase 34 complete (combat screen rebuilt); Phase 35 next; device UAT batch (v1.3 + Phase 34) pending after Phase 35*
