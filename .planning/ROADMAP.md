# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (shipped 2026-09-16, device UAT batch closed; see `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.4 Combat & Map Screens** — Phases 34–35 (shipped 2026-09-16, device round closed 2026-09-17; see `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.5 Meaningful Choices — Spells, Gear & Abilities** — Phases 36–43 (code-complete 2026-09-18, archived 2026-09-19; 140-check Pixel 7 UAT batch pending on its own track against a post-quick-task debug APK; see `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-MILESTONE-AUDIT.md`)
- ✅ **v1.6 Shell Debt & Dead Code** — Phases 44–49 (code-complete 2026-09-20, archived 2026-09-20; 26-check Pixel 7 UAT batch + the v1.5 140-check batch pending on APK `c0cdbae`; see `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve** — Phases 50–55 (code-complete 2026-09-22, archived 2026-09-22, override closeout; the four-run DR checklist + 25-item Pixel 7 batch `docs/UAT-v1.7.md` deferred by the user, as are the v1.6 26-check and v1.5 140-check batches; see `.planning/milestones/v1.7-ROADMAP.md`, `.planning/milestones/v1.7-MILESTONE-AUDIT.md`)
- ✅ **v1.8 Sound, Motion & Set Dressing** — Phases 56–60 (code-complete 2026-09-22, archived 2026-09-22, verified closeout; 30 of 31 Pixel 7 checks in `docs/UAT-v1.8.md` spread over the user's play sessions; see `.planning/milestones/v1.8-ROADMAP.md`, `.planning/milestones/v1.8-MILESTONE-AUDIT.md`)
- ✅ **v1.9 The Gear Screen** — Phases 61–64 (code-complete 2026-09-23; override closeout: GSCR-12 device batch partial) → `.planning/milestones/v1.9-ROADMAP.md`
- ✅ **v2.0 Leaderboards** — Phases 65–71 (shipped 2026-09-24 as Play 2.0.0 / vc10; override closeout: 38/38 requirements, 7/7 phases passed, 142-row Pixel 7 batch `docs/UAT-v2.0.md` spread over the user's play sessions) → `.planning/milestones/v2.0-ROADMAP.md`
- ✅ **v2.1 Bug Fixes** — Phases 72–81, incl. 75.1–75.3 and 79.1–79.3 (shipped 2026-09-28 as Play 2.1.0 / vc11 to closed testing; override closeout: 68/68 requirements, 16/16 phases passed, audit tech_debt; UAT batch `docs/UAT-v2.1.md`, 80-05 emulator pass deferred) → `.planning/milestones/v2.1-ROADMAP.md`
- ✅ **v2.2 Our Own Leaderboards** — Phases 82–86 (shipped 2026-09-29 as Play 2.2.0 / vc12 to the testing track; override closeout: 35/35 requirements — SRV-09's live proof passed on release day — 5/5 phases passed, Pixel 7 batch `docs/UAT-v2.2.md` passed bar 3 upgrade-path rows) → `.planning/milestones/v2.2-ROADMAP.md`
- ✅ **v2.3 Truth in Advertising** — Phases 87–92.4, incl. 91.1–91.2 and 92.1–92.4 (shipped 2026-10-02 as Play 2.3.0 / vc13 to closed testing; override closeout: 42/42 requirements, 12/12 phases passed, audit tech_debt — 5 SUMMARY-paperwork partials; batched Pixel 7 checklist (claude.ai artifact LMpj9qYzChoYfH6GRXCEAF, incl. Part B with Compete ON) not yet walked) → `.planning/milestones/v2.3-ROADMAP.md`
- 🚧 **v2.4 Fit & Finish** — Phases 93–98, incl. 93.1 (started 2026-10-03; promoted from backlog 999.17, 999.18, 999.20 and three 2026-10-02 todos, plus the Gauntlet half of player report #6; 23 requirements; release as Play 2.4.0 / vc14 follows the milestone)
- 📋 **v1.0 launch tail** — first-run tutorial (UX-06, rebuilt on the v1.6 modular shell) + Google Play production launch (STR-01..04, STR-06)

## Phases

### v2.4 Fit & Finish (Phases 93–98) — IN PROGRESS

- [x] **Phase 93: Quick Wins: Harmful Chips First & Cloak Heals on Use** - Harmful condition chips always sit at the far left, and using the Cloak of Regeneration heals at once. (completed 2026-10-03)
- [ ] **Phase 93.1: Gauntlet of the Giant Worth Wearing** (INSERTED) - Using the Gauntlet's size step hits hard enough to be worth foes getting +1 to hit you (player report #6).
- [ ] **Phase 94: Ability States You Can Tell Apart** - Every ability row reads as Ready, Recharging (ready in N), Can't use now (with its reason) or Spent this fight, by more than colour.
- [ ] **Phase 95: Fantasy Flavour I: The Text Layer, Spells, Scrolls & Items** - Spells, scrolls, equipment, magic items and potions read as fantasy flavour; the exact rules live in a technical layer that the truth guards pin and the player can still reach.
- [ ] **Phase 96: Fantasy Flavour II: Races, Sub-classes, Abilities, Chips & the Review** - Race and sub-class blurbs, ability descriptions and chip explanations read as flavour (good and bad still conveyed), and every new text clears the safety scan and the narrative review.
- [ ] **Phase 97: Large-Screen Support** - No orientation or resizability restriction; a full run in landscape, sensible tablet, foldable and Chromebook layouts, and rotating, folding or resizing never loses a run.
- [ ] **Phase 98: Fresh Store & Website Screenshots** - The Play listing and darktierstudios.com show the current game, with real tablet and landscape shots.

**Sequencing:** SHOTS is last (user): after large-screen support so the tablet and landscape shots are real, and after the flavour text so the shots show the final words. The two quick wins go first: the cloak's final text feeds the flavour pass, and the chip strip is in its final order before the other UI work. Ability states (94) and the flavour text (95–96) land before large-screen support (97), so the landscape and tablet layouts are designed once against the final rows, the details surface and the real text lengths, and one refreshed set of shell snapshots and one perf baseline describe the final UI. Engine bytes move only in Phase 93 (ITEM-08, a derived-stream tick with declared fixtures) and Phase 94 (ASTATE-04, additive derived state, zero draws); the rest is shell, content, Android manifest and tooling. No bot pass is planned (no balance change beyond the cloak tick; the fair bot's cloak model is updated in Phase 93).

**After the milestone (not requirements, not a phase):** per `docs/RELEASING.md`: patch notes agreed with the user first, one batched Pixel 7 and emulator checklist (`docs/UAT-v2.4.md`), then the release build (`npm run play:release`, versionCode 14), the user's Play upload, tags, the GitHub Release and the darktierstudios.com deploy. Uploading the new listing screenshots in Play Console is also the user's step.

<details>
<summary>✅ v2.3 Truth in Advertising (Phases 87–92.4) — SHIPPED 2026-10-02</summary>

- [x] Phase 87: Player-Report Fixes: Joiner HP, Store Rations & DEPTH Ties (10/10 plans) — completed 2026-09-30
- [x] Phase 88: Item Systems: Effect Sources, Heal-Over-Time & the Crit-Proof Cloak (4/4 plans) — completed 2026-09-30
- [x] Phase 89: Item Audit & Fixes (10/10 plans) — completed 2026-09-30
- [x] Phase 90: Spell & Skill Audit (12/12 plans) — completed 2026-10-01
- [x] Phase 91: Race & Sub-class Audit (10/10 plans) — completed 2026-10-01
- [x] Phase 91.1: Value Review: Races, Sub-classes & Abilities (7 plans) — completed 2026-10-01
- [x] Phase 91.2: Board Identity: Play Games Names Replace Rolled Handles (10/10 plans) — completed 2026-10-01
- [x] Phase 92: Store Economy & Balance Close (5/5 plans) — completed 2026-10-01
- [x] Phase 92.1: Play Games Privacy Gate & Sign-in Fixes (1/1 plans) — completed 2026-10-02
- [x] Phase 92.2: Strength Potion & Spells, Damage Visibility, Small Fixes (1/1 plans) — completed 2026-10-02
- [x] Phase 92.3: Melee Auto-hit on Helpless Foes, Racial HP Truth (2/2 plans) — completed 2026-10-02
- [x] Phase 92.4: Experience Grows with Depth (1/1 plans) — completed 2026-10-02

Released as Play 2.3.0 / vc13 (tags `v2.3.0`, `v2.3.0-play13`). Full details: `.planning/milestones/v2.3-ROADMAP.md`.

</details>

<details>
<summary>✅ v2.2 Our Own Leaderboards (Phases 82–86) — CODE-COMPLETE 2026-09-29</summary>

- [x] Phase 82: DAYS Farming Check (2/2 plans) — completed 2026-09-28
- [x] Phase 83: Leaderboard Server (12/12 plans) — completed 2026-09-29
- [x] Phase 84: Leaderboards Panel v3 (9/9 plans) — completed 2026-09-29
- [x] Phase 85: Play Games Out, Our Board In (6/6 plans) — completed 2026-09-29
- [x] Phase 86: Compliance & Device Close (5/5 plans) — completed 2026-09-29

Release steps (patch notes, release build, Play upload, final rules + SRV-09 probes, website deploy, Play Console cleanup) are in `docs/RELEASING.md`. Full details: `.planning/milestones/v2.2-ROADMAP.md`.

</details>

<details>
<summary>✅ v2.1 Bug Fixes (Phases 72–81) — SHIPPED 2026-09-28</summary>

- [x] Phase 72: Roll-Direction Sign Audit & Fixes (7/7 plans) — completed 2026-09-24
- [x] Phase 73: Engine Roll-High Mirror (10/10 plans) — completed 2026-09-25
- [x] Phase 74: Roll Display & Modifier Honesty (8/8 plans) — completed 2026-09-25
- [x] Phase 75: Engine Rules — Character, Economy, Grimoire & Combat Bugs (13/13 plans) — completed 2026-09-25
- [x] Phase 75.1: Pilfer Fumbles & Scroll Reading (9/9 plans) — completed 2026-09-26
- [x] Phase 75.2: Hero Size Matters (5/5 plans) — completed 2026-09-26
- [x] Phase 75.3: Deep-Floor Encounter Scaling (6/6 plans) — completed 2026-09-26
- [x] Phase 76: Darkness Unification & Relaunch Persistence (6/6 plans) — completed 2026-09-26
- [x] Phase 77: Combat Screen & Oracle Readability (8/8 plans) — completed 2026-09-26
- [x] Phase 78: HUD, Dead State & Climb Decisions (9/9 plans) — completed 2026-09-27
- [x] Phase 79: Content & Narrative Pass (15/13 plans) — completed 2026-09-27
- [x] Phase 79.1: Milestone Balance Check & Deep-Floor Tuning (4/4 plans) — completed 2026-09-28
- [x] Phase 79.2: Early-floor difficulty retune (4/4 plans) — completed 2026-09-28
- [x] Phase 79.3: In-app bug reports and patch notes (8/8 plans) — completed 2026-09-28
- [x] Phase 80: Android Release Build & Tooling (6/6 plans) — completed 2026-09-28
- [x] Phase 81: Leaderboards Panel Fixes (6/6 plans) — completed 2026-09-25

80-05 (the emulator pass) was deferred by the user until the features are in. Full details: `.planning/milestones/v2.1-ROADMAP.md`.

</details>

<details>
<summary>✅ v2.0 Leaderboards (Phases 65–71) — SHIPPED 2026-09-24</summary>

- [x] Phase 65: Run Record & Personal Bests (5/5 plans) — completed 2026-09-23
- [x] Phase 66: Leaderboards Panel — Local (7/7 plans) — completed 2026-09-23
- [x] Phase 67: Play Games Integration & Account Chip (8/8 plans) — completed 2026-09-24
- [x] Phase 68: Global Boards, Submissions & "You Placed X" (7/7 plans) — completed 2026-09-24
- [x] Phase 69: Compliance & Device Close (4/4 plans) — completed 2026-09-24
- [x] Phase 70: Device-Round Polish (4/4 plans) — completed 2026-09-24
- [x] Phase 71: Device-Round Polish II (8/8 plans) — completed 2026-09-24

Full details: `.planning/milestones/v2.0-ROADMAP.md`.

</details>

## Phase Details

### Phase 93: Quick Wins: Harmful Chips First & Cloak Heals on Use

**Goal**: A poisoned or diseased hero can't miss it, and using the Cloak of Regeneration heals right away instead of feeling like a dead tap.
**Depends on**: Nothing (first phase of v2.4). Two small, independent fixes that land first: the cloak's final item text, chip and narration exist before Phase 95 rewrites item text (so it is rewritten once), and the chip strip is in its final order before the ability-state and large-screen work touch the same HUD. CHIP-01 is view-layer only (`src/browser/heroConditions.js`; engine `conditionsOf` order and fixtures do not move). ITEM-08 is the milestone's one rule change: the immediate tick draws from the heal-over-time derived stream (never the main rng), every new event gets an `EVENT_NARRATION` entry plus its rail twin, any moved fixture is measured, declared and regenerated, and the fair bot's cloak model (`tools/lib/tuning-bot.mjs`) plays the new rule.
**Requirements**: CHIP-01, ITEM-08
**Open decisions (discuss-phase)**: the cloak ruling. (A) the immediate tick is one of the three: use, +10, +20 squares, then done, same total heal as today; or (B) it is a fourth: use, +10, +20, +30 squares, a small buff to total heal. The ruling fixes the item text, the Regenerating chip's count, the ITEM-AUDIT row and the patch-notes line.
**Success Criteria** (what must be TRUE):

  1. A hero carrying a harmful condition (Poisoned, Diseased or any other bad-tone chip) plus several buffs sees every harmful chip at the far left of the chip strip, then the good ones, each group in its existing relative order, so a long row can only push good chips off the right edge.
  2. Using a worn Cloak of Regeneration heals one tick at once, with a narrated line and its rail twin, and the every-N-squares ticks that follow match the ruling (A or B); the item text, the Regenerating chip and the Gear, store and find cards all state the same count.
  3. A Joiner who uses the cloak gets the same immediate tick and the same follow-ups, and taking the cloak off still stops any ticks left.
  4. A seeded run that never uses the cloak plays out identically before and after (the main rng does not move); any fixture that does move is declared; the fair bot plays the new cloak rule; and the ITEM-AUDIT row and the patch-notes entry say the same thing as the item.

**Plans**: 3/3 plans executed

- [x] 93-01-PLAN.md
- [x] 93-02-PLAN.md
- [x] 93-03-PLAN.md

**UI hint**: yes

### Phase 93.1: Gauntlet of the Giant Worth Wearing (INSERTED)

**Goal**: Using the Gauntlet of the Giant is worth its downside: its size step hits hard enough that foes getting +1 to hit you is a fair trade, as the Enlarge potion became in 2.3.0.
**Depends on**: Phase 93 (sequencing only; inserted 2026-10-03 by the user's ruling on GitHub issue sheibeck/ddr#6). Source: player report #6 (2.1.0), "Enlarge potion worthless. +2 damage to get hit more often?", and the owner's comment on it, "Same thing with Gauntlet of the Giant". Phase 89 (ITEM-05) fixed Enlarge in 2.3.0: the size step's +2 plus +9 bulk is +11 damage for 50 squares, foes +1 to hit. The Gauntlet is still the bare size step: +2 damage and foes +1 to hit for 50 squares, then a 50-square cooldown (`content/treasure-tables.js`, `act: { kind: "giant", effect: 50, cd: 50 }`; price 1,200 in `engine/economy.js`; the "Enlarged" chip and its CONDITION_EXPLAIN line in `mazeworld.html`; the `docs/ITEM-AUDIT.md` row and its Phase 92 note, "its balance is a tuning read, not an audit mismatch"). Engine gate: a content and number change (the `giant` activation's payload), with no main-rng draw; any moved fixture is measured, declared and regenerated; Joiners use it in their round-1 opener (`MEMBER_COMBAT_KINDS`), and the fair bot (`tools/lib/tuning-bot.mjs`, round-1 buff list) reads the new numbers. Phase 95 rewrites the item text into flavour afterwards, so the rules text lands here first.
**Requirements**: ITEM-09
**Open decisions (discuss-phase)**: the Gauntlet's new numbers. For example: match Enlarge's +9 bulk (+11 in all), or a smaller bulk because the Gauntlet is reusable every 100 squares while the potion is consumed. Also whether the window or cooldown changes, and whether the 1,200 price moves.
**Success Criteria** (what must be TRUE):

  1. A hero who uses a worn Gauntlet of the Giant deals the ruled damage bonus for its window, and foes still get +1 to hit; the item text, the Enlarged chip and its explanation, the Gear, store and find cards and the ITEM-AUDIT row all state the same numbers.
  2. A Joiner who uses the Gauntlet (its round-1 opener) gets the same numbers, and taking it off ends the effect as today.
  3. A seeded run that never uses the Gauntlet plays out identically before and after; any fixture that moves is declared; the fair bot reads the new numbers; and the 2.4.0 patch-notes draft names the change.
  4. GitHub issue #6 is closed with a note once the release that carries the fix ships (Enlarge was fixed in 2.3.0, the Gauntlet in 2.4.0).

**Plans**: 1/1 plans executed

- [x] 93.1-01-PLAN.md

### Phase 94: Ability States You Can Tell Apart

**Goal**: In a fight, a player can see at a glance which abilities are ready, which are recharging, which can't be used right now and which are spent, without relying on colour alone.
**Depends on**: Phase 93 (sequencing only: both touch the HUD's status vocabulary, so the chip order is settled first). The engine exposes each ability row's state category and rounds left as additive derived data (ASTATE-04): zero rng draws, nothing new serialized beyond what the three `*Comparable()` carve-outs already cover, so the view never infers a state. The rows live in `src/browser/combatMenu.js`, where every unavailable row today shares one disabled style and stays tappable, with the tap landing the refusal reason in the fight log.
**Requirements**: ASTATE-01, ASTATE-02, ASTATE-03, ASTATE-04, ASTATE-05
**Open decisions (discuss-phase; `/gsd-ui-phase` recommended)**: the four state names and labels; each state's colour token and its non-colour cue (icon, word or both); whether Recharging and Spent share a visual family; whether a Can't-use-now row stays tappable to log its refusal (today's behaviour); which themes ship, so "light and dark" is pinned correctly. Deferred to Future Requirements: a fifth Active state (chips already show running effects) and the same states on spells.
**Success Criteria** (what must be TRUE):

  1. Every ability row in the combat ABILITIES submenu shows exactly one of four states, Ready, Recharging, Can't use now or Spent this fight, each with its own colour token and a non-colour cue (an icon or a label), so the four still read apart in greyscale.
  2. A recharging ability shows "ready in N", and N drops each round until the row flips to Ready.
  3. A can't-use-now row states the gate's reason on the row itself ("no foe in reach", "needs a weapon"), without a tap.
  4. The state and the rounds left come from the engine for every ability of every class and Joiner, and a tap always agrees with the label: a Ready row acts, any other row refuses with the reason it shows.
  5. The four states stay distinguishable in light and dark themes and under colour-blind simulation, pinned by shell snapshot and a11y tests.

**Plans**: TBD
**UI hint**: yes

### Phase 95: Fantasy Flavour I: The Text Layer, Spells, Scrolls & Items

**Goal**: Players read fantasy flavour for every spell, scroll, weapon, armour piece, magic item and potion, while the exact rules and numbers live in a technical layer that stays reachable in game and keeps every v2.3 truth-in-advertising guard in force.
**Depends on**: Phase 93 (the cloak's final text exists, so item text is rewritten once). This phase owns the two-layer model for every text domain in the milestone (spells and scrolls, equipment, items and potions, races and sub-classes, abilities and chips): the exact v2.3 text moves into the technical layer, and all the guards re-pin to it here, so Phase 96 can rewrite the identity, ability and chip flavour against guards that are already pinned. This phase rewrites the player layer for spells, scrolls, equipment, magic items and potions (`content/spells.js`, `content/treasure-tables.js` and the item and potion content). It changes no rule and no number; the only snapshots that move are text-layer ones, each declared. Player text stays in the house voice (sarcastic, family-friendly).
**Requirements**: FLAVOR-01, FLAVOR-02, FLAVOR-05
**Open decisions (discuss-phase, the milestone's biggest design call; `/gsd-discuss-phase` strongly recommended)**: where the exact numbers live in game (a details toggle on the Gear and spell sheets, the chip-tap text, a Hero-tab footer, or only in docs and code); the data shape (a flavour string beside a rules string on each entry, or a separate content file); how "no guard lost" is proven (the v2.3 audit tables' row counts before and after); the tone guide for the rewrite. The v2.3 guards that re-pin: item-text-engine, authored-ranges, spell-audit, skill-audit, value-identity and the identity tests.
**Success Criteria** (what must be TRUE):

  1. Opening any spell, scroll, weapon, armour piece, magic item or potion (Gear sheet, store, loot and find cards, combat SPELLS and ITEMS menus, grimoire) shows short, evocative fantasy flavour in the house voice, not a rules sentence.
  2. The exact rules and numbers for each are still reachable in game, in the place the discuss-phase rules, and they match what the engine does.
  3. Every v2.3 truth guard pins the technical layer with the same rows, none dropped, and a number deliberately drifted in the technical layer still fails a test.
  4. Every spell and item plays exactly as before: no rule or number moved, and every snapshot that changed is a declared text-layer change.

**Plans**: TBD
**UI hint**: yes

### Phase 96: Fantasy Flavour II: Races, Sub-classes, Abilities, Chips & the Review

**Goal**: Race and sub-class blurbs, ability descriptions and condition-chip explanations read as fantasy flavour that still tells the player each one's good and bad, and every new player text clears the family-friendly scan and the narrative review.
**Depends on**: Phase 95 (the text layer, the in-game details surface and the re-pinned guards) and Phase 94 (the ability rows' states are settled, so the descriptions are written beside their final states). Boundaries: the state labels and gate reasons from Phase 94 ("ready in N", "no foe in reach") are functional and stay plain and exact; FLAVOR-04 rewrites ability description text and `CONDITION_EXPLAIN` chip explanations only. Oracle, rail and fight-log narration lines stay as reviewed in v2.1 Phase 79 (out of scope). FLAVOR-06 closes over the text from both flavour phases.
**Requirements**: FLAVOR-03, FLAVOR-04, FLAVOR-06
**Open decisions (discuss-phase)**: how a flavour blurb carries its good and its bad while the identity guard still pins both (a tagged good and bad cue per blurb, or the check on the technical layer); whether the Phase 94 gate reasons stay plain; the review mechanism (reuse the v2.1 Phase 79 why-ledgers and review page).
**Success Criteria** (what must be TRUE):

  1. Every race and sub-class blurb reads as fantasy flavour and still tells the player, in voice, what that race or sub-class is good and bad at; none loses its good or its bad.
  2. Ability descriptions (combat ABILITIES submenu, Hero tab) and condition-chip explanations (tap a chip) read as fantasy flavour, with their exact numbers and durations in the technical layer Phase 95 built.
  3. Every player text rewritten in Phases 95 and 96 passes the family-friendly safety scan and a narrative review in the house sarcastic voice, and a review page lists each text with its verdict.
  4. A walk across every screen (Gear, store, loot and find, spells, Hero, combat, chip taps, title) finds no description that still reads as a rulebook sentence, no rule or number moved, and every truth guard is still green against the technical layer.

**Plans**: TBD
**UI hint**: yes

### Phase 97: Large-Screen Support

**Goal**: The game installs and plays on every Android screen (phone in portrait and landscape, 7" and 10" tablet, foldable, Chromebook window), and rotating, folding or resizing never loses a run.
**Depends on**: Phases 93–96 (the HUD, the ability rows, the details surface and the final text exist, so the layouts are designed once against them and the refreshed shell snapshots and perf baseline describe the final UI). This is the milestone's largest phase. Context: `AndroidManifest.xml` sets `android:screenOrientation="portrait"` on MainActivity (the Phase 80 lock, kept honoured on Android 16 by `appCategory="game"`) and Phase 80's large-screen answer was a centred 480 CSS px column on gutters with no landscape layout (`docs/ANDROID-DISPLAY.md`). MainActivity already declares `configChanges` for orientation, screenSize, smallestScreenSize and screenLayout, so rotation should reach the WebView without recreating the activity; the emulator profiles prove it. The deferred 80-05 emulator pass (tablet, foldable, nav modes on the R8 build) overlaps this phase's verification and can be absorbed here.
**Requirements**: SCREEN-01, SCREEN-02, SCREEN-03, SCREEN-04, SCREEN-05, SCREEN-06
**Open decisions (discuss-phase; `/gsd-ui-phase` strongly recommended)**: (1) phones: portrait-only as a runtime Settings preference, or free rotation; (2) the landscape play-screen layout (where the maze viewport, rail, HUD, tabs, combat panel and sheets sit when the screen is wide and short); (3) the tablet, foldable and Chromebook layout (breakpoints, whether wide screens get two panes, what replaces the 480 px column); (4) whether `appCategory="game"` stays once the restrictions go; (5) whether to absorb the 80-05 emulator pass. If the discussion finds a clean seam (a rotation-safe foundation: SCREEN-01, 02, 05, then the layouts: SCREEN-03, 04, 06), `/gsd-phase` can split the phase before planning.
**Success Criteria** (what must be TRUE):

  1. The release build's merged manifest carries no orientation, resizability or max-aspect restriction, the app installs and runs, and Play's large-screen notice no longer fires on the next upload.
  2. On a phone, rotation behaves as ruled in discuss-phase: portrait-only as a Settings choice, or free rotation.
  3. A player can play a full run in landscape on a phone: the maze viewport, rail, HUD, tabs and every sheet and screen (combat, store, Gear, Hero, leaderboards) fit and stay usable.
  4. On a 10" tablet, a foldable (folded and unfolded) and a Chromebook-sized window, the layout uses the space sensibly, not a stretched phone column.
  5. Rotating, folding, unfolding, resizing and multi-window never restart or lose a run, a combat or an open store, and the safe areas and system bars are correct in every orientation; the shell snapshots and the perf baseline are refreshed.

**Plans**: TBD
**UI hint**: yes

### Phase 98: Fresh Store & Website Screenshots

**Goal**: The Play listing and darktierstudios.com show the game as it now is: the final flavour text, the ability states, the board with Play Games names, and real tablet and landscape shots.
**Depends on**: Phase 97 (the tablet and landscape shots are real) and Phases 95–96 (the shots show the final text). The last phase of the milestone, by the user's ruling. Shots come from the Pixel 7 debug build and the emulator profiles for the 7" and 10" tablets; the dev row (debug builds only) can reach deep floors, but its chip stays out of frame. Uploading the exported shots in Play Console is the user's step.
**Requirements**: SHOTS-01, SHOTS-02, SHOTS-03
**Open decisions (discuss-phase)**: the shot list, agreed with the user (candidates: title, combat with damage lines and ability states, the leaderboard with Play Games names, the Hero tab, a store, spells, the map), and which landscape shots earn a place.
**Success Criteria** (what must be TRUE):

  1. An agreed shot list is captured on the current build for the phone, the 7" tablet, the 10" tablet and, where it fits, landscape, with no dev chip or debug UI in frame and the final flavour text and ability states visible.
  2. `store-listing/screenshots/` (`phone/`, `tablet-7in/`, `tablet-10in/`) holds the new shots, exported to Play's size rules, and `store-listing/LISTING.md` describes them.
  3. The darktierstudios.com shots and `featured.webp` are replaced as webp with updated alt text in the `ddr-shots` section, and the site is deployed with the new images live.

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 93. Quick Wins: Harmful Chips First & Cloak Heals on Use | 3/3 | Complete    | 2026-10-03 |
| 94. Ability States You Can Tell Apart | 0/TBD | Not started | - |
| 95. Fantasy Flavour I: The Text Layer, Spells, Scrolls & Items | 0/TBD | Not started | - |
| 96. Fantasy Flavour II: Races, Sub-classes, Abilities, Chips & the Review | 0/TBD | Not started | - |
| 97. Large-Screen Support | 0/TBD | Not started | - |
| 98. Fresh Store & Website Screenshots | 0/TBD | Not started | - |

## Deferred / Not This Milestone

- **80-05 emulator pass** (tablet, foldable, nav modes on the R8 build) — deferred by the user 2026-09-28 until the features are in. v2.4 Phase 97 (large-screen support) is the natural place to absorb it; the user decides in that phase's discuss-phase.

- **Pixel 7 UAT batches** — `docs/UAT-v2.2.md` (42 + 8 user tasks), `docs/UAT-v2.1.md` (108 + 12 quick), `docs/UAT-v2.0.md` (142), `UAT-v1.9.md` (21), `UAT-v1.8.md` (30), `UAT-v1.7.md` (25 + DR bar), `UAT-v1.6.md` (26) and `UAT-v1.5.md` (140), walked over the user's play sessions; findings become todos or quick tasks, never ad-hoc edits.
- **UX-06** first-run tutorial — deliberately last; rebuilt on the Phase 47 modular shell (the reason SHELL-01..03 exist). Includes the UIF-04 on/off toggle dropped from v1.3.
- **STR-01..04/06** Google Play production launch (Data Safety audit, privacy page, listing, IARC, pricing, rollout).
- **`storeRoll` for the bots** — the tuning harness still plays the frozen store roll; **the two structural v1.5 AFTER patterns** (Magic Users gain nothing from the class-gated ability system; Wilmsry's racial edge) — both carried forward past v1.7 per `REQUIREMENTS.md`'s Future Requirements (TUNE-06/07 are now in scope this milestone as TUNE-08/09, Phases 54–55).
- Store screen restyle to the dark vocabulary (Phase 47 moves the store into `storeScreen.js` unchanged — the restyle edits that module later).
- Dice-mode setting.
- Haptics polish; the unguarded button set from 32-03 (store rows, drop shelf, `a-evt`, `btn-again`, spell menu).
- Climb dice payload (`roll`/`need` on the four climb events) — carried over from v1.4 as a post-UAT quick task. **Superseded 2026-09-24**: CLIMB-01/02 (v2.1 Phase 78) replaces the retry card with a pre-roll decision card, and ROLL-05 (Phase 73) makes every climb roll high-is-good natively.
- Shell debt noted in the v1.5 audit but not in v1.6's requirements: the unreachable parley fluency-2 branch (`canParley`'s Magical tier, `wilmsryVsMagical`) and the `railCardFor` tie-break — fold into Phase 44's orphan sweep if they fall out for free, otherwise a quick task.
- **Our own friends list (was backlog 999.14)** — not planned (user, 2026-09-28: no friends scope, everyone or just yours); removed from the backlog 2026-10-02.
- Replay verification of top runs, Firebase App Check and a season picker — see REQUIREMENTS.md Future Requirements.
- **Day-one direct-damage guarantee for Magic User subs other than the Wizard** — they keep the Phase 40 best-effort guarantee (user, 2026-09-29); v2.3 IDENT-13 covers the Wizard sub only.

## Backlog

### Phase 999.1: Transitions & Sounds (PROMOTED → Phases 56 / 58 / 59)

> **Promoted 2026-09-22 into milestone v1.8.** Sound → AUD-01..06 (Phase 56); transitions, combat pacing and typed text → MOTION-01..05 (Phase 58); the party-marker ring → ANIM-03 (Phase 59). The rail-overlay prerequisite it names is LAYOUT-01 (Phase 57). Kept here for its planning context until v1.8 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-19 for future planning — user's words] Map the sound clips in `sfx/` (30 MP3s the user added — 31 originally, less `enemy-batrat` which the user deleted 2026-09-22: `walk1-3`, `walk-water1-3`, `hit1-2`, `miss1-2`, `hurt1-3`, `foe-die`, `enemy-{beast,demon,human,undead}`, `spell`, `resist`, `heal`, `drink`, `chest`, `gold`, `trap`, `jump`, `stairs`, `levelup`, `death`, `ui-tap`) to game actions and engine events; and make the shell's transitions smooth — map panning, rail show/hide, opening menu items — "not jarring and immediate". Slow the fight responses down so there are transitions between exchanges and the player can process each one. Animate on-screen text as if quickly typed out (fast, not slow). Dial back the black circle around the party marker — the party is already highlighted, the ring is too stark.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** sound = a `src/browser/sfx.js` event→clip table played through Web Audio (`AudioContext` + `decodeAudioData`, unlocked by the first tap), wired beside `hapticForEvents(events)` in the dispatch path — engine untouched, mute toggle by the settings gear, clips bundled in `www/` (Android WebView plays MP3 offline, no plugin). Transitions: the rail is a flex sibling that reflows the viewport today (see todo `2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — overlay + slide is the fix, land together); map pan goes through `cameraPan()`/`keepInViewAxis` (`src/browser/controls.js`) with no easing; `.mw-rail-new` has a 0.18 s rise (`mazeworld.html` CSS ~L707) and combat has `mwStrikePop`/`mwRoundTick` keyframes but no inter-exchange pacing in `combatPanel.js`. Typed-text effect belongs to the rail/encounter line renderers (`renderRail`, `renderEncounter`), must respect the rail hold/dismiss rules and TalkBack (`#mw-rail-live` announcer gets the full text at once). Party marker ring: `PLAYER_MARKER_ICON`/`draw()`. Sequence AFTER v1.6 Phase 47 (shell modularisation) so the effects land in the new `src/browser/` modules, not the old `paint()` bodies; each effect gets a settings-respecting reduced-motion path.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.3: Dungeon set dressing (PROMOTED → Phase 59)

> **Promoted 2026-09-22 into milestone v1.8 as DRESS-01..05, Phase 59 (Party Animation & Dungeon Set Dressing).** Kept here for its planning context until v1.8 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-19 for future planning — user's words] Add set dressing to the dungeon using the new optimized `icons/optimized/set_dungeon_*.png` icons (54 of them: ash pile, banners, barrels/crates/sacks, bones/skulls/skeleton, blood, book/scrolls, boulder/rocks/rubble, braziers/torches/candles/sconce, cobwebs, mushrooms/moss/fern/roots/vines, grate/hatch/pit, puddles/slime, rat, shackles, …). Use them for random dungeon set items — on walls, or on paths provided they are DIMMED so they are never confused with the real encounter icons. Set dressing only: not interactable, no rules effect, pure ambiance.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** rendering-only, engine untouched — the placement must be deterministic per floor (derive from `makeRng(hash(seed, "dressing", depth))` in the SHELL/`src/browser/` layer, never a draw off the engine's main stream, so no fixture moves and the engine stays pure), keyed off the generated grid (`engine/maze.js` cells `{ wall, seen, feat }`; walls are the majority of the 21×21 grid) and revealed with `c.seen`. Draw in `draw()` (`mazeworld.html` ~L1931; feature icons at ~L1998-2002 via `iconsApi.drawFeatureIcon(ctx, img, x, y, CELL, dir, 0.75)`) BEFORE the feature/party layer: wall items at full or near-full alpha on wall cells; path items at low alpha (≈0.3-0.4) so `featureKeyForCell` encounter icons stay unmistakable; never on a cell that has a `feat`, the stairs, or the party. Density is a tunable (a handful per floor, rarer on deep floors?). `preloadIcons("./icons/optimized")` already loads the directory — check `icons.js`'s manifest approach so 54 extra images don't slow the first paint (lazy or a sprite). Respect the 260918-vm3 stationary camera and Phase 35 map palette; a settings toggle ("set dressing off") is cheap. Land after v1.6 Phase 47 (draw code may move into a module) and alongside 999.1's party-marker frames. The raw `icons/*.png` sheets the user added (`dungeon_dressing.png`, `encounters.png`, …) are sources — only `icons/optimized/` ships in `www/`.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: Map & HUD layout band (PROMOTED → Phase 57)

> **Promoted 2026-09-22 into milestone v1.8 as LAYOUT-01..06, Phase 57 (Map & HUD Layout Band).** Kept here with its todo index until Phase 57 closes; the four todos below carry `resolves_phase: 57`. Not a runnable backlog item — do not queue it.

**Goal:** [Captured from the 2026-09-19/21 Pixel 7 device rounds] The map screen's chrome stops fighting the map: the rail slides up OVER the map instead of reflowing it, the MARKS / CENTRE / MAKE CAMP / gear strip becomes a reserved band outside the viewport (so a chip tap can never also move the party), the HUD stacks into four bands instead of one clipping row, and the Table-7 Darkness counter becomes visible on the map.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (4):**

- `todos/pending/2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — rail is a flex sibling that resizes `.mw-maze-viewport`; must overlay + slide, body tap dismisses a no-decision card (never a decision card), `RAIL_HOLD` roughly doubles. **Lands with 999.1** (both touch rail transitions).
- `todos/pending/2026-09-21-map-chip-strip-is-a-reserved-band-above-the-map-not-an-overl.md` — `.mw-map-chips` is an absolute overlay inside the viewport; chip taps also move the party and `keepInViewAxis` counts hidden cells.
- `todos/pending/2026-09-21-hud-reflow-name-hp-row-then-counters-then-conditions-then-chips.md` — the single-row HUD (Phase 35 ruling 5) overlaps Rations past 1,000 squares; four stacked bands. **Land together with the chip-strip todo.**
- `todos/pending/2026-09-21-table-7-darkness-counter-is-invisible-on-the-map.md` — `c.darkFor` only shrinks the reveal radius for NEW cells (fog is cumulative) and nothing dims; wants a vignette + the existing DARK chip countdown.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: Combat screen & Oracle readability (PROMOTED → Phase 77)

> **Promoted 2026-09-24 into milestone v2.1 as CMBUI-07..13, Phase 77 (Combat Screen & Oracle Readability).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured from the 2026-09-21 Pixel 7 device round] Everything the player reads during a fight is legible, ordered and honest: submenu rows stop clipping and sort by spell level, the foe's BESTIARY family shows after its name, the Oracle prints combat lines in event order rather than priority order, status chits are readable mid-fight, and a scroll that casts stops narrating a refusal.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (5):**

- `todos/pending/2026-09-21-combat-submenu-rows-clip-their-text-order-spells-by-level-then-name.md` — `.cb-row` clips on the phone; spell rows render in `SPELLS` array order with no sort. **Land with the hide-uncastable todo in 999.6.**
- `todos/pending/2026-09-21-foe-type-listed-after-the-name-on-the-combat-screen.md` — the foe record already carries `type` (the six BESTIARY families); surface it on `.cb-foe-name`.
- `todos/pending/2026-09-21-oracle-combat-lines-must-read-in-event-order.md` — the Oracle reuses the rail fold, which sorts by PRIORITY and collapses identical lines across time, so riposte kills print before the misses that caused them; wants idx-order + adjacent-only folding.
- `todos/pending/2026-09-21-status-chit-tap-in-combat-shows-nothing-rail-hidden-in-comba.md` — `railEl.hidden` is forced for the whole fight, so status-effect descriptions are unreachable in combat; wants a combat-legal transient card.
- `todos/pending/2026-09-21-scroll-read-in-combat-narrates-a-level-refusal-although-it-cast.md` — `scrollTooAdvanced` is the copy-to-book gate but reads as a refusal right before the cast line; narration-only.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: Engine rules fixes from the device rounds (PROMOTED → Phase 75)

> **Promoted 2026-09-24 into milestone v2.1 as RULES-01..04, Phase 75 (Engine Rules — Character, Economy, Grimoire & Combat Bugs).** The combat gear-lock and store-charge-then-refuse items in this backlog already shipped as v1.9 Phase 61 (GRULE-02 / STORE-02/03); only the Summoner school-gate, hide-uncastable-spells, HP-dot compounding and wilmst-cache items carried forward into v2.1. Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured from the 2026-09-21 Pixel 7 device round] Five rules bugs the fitted build exposed: a free mid-fight re-arm, a store purchase that charges then refuses, a Summoner holding spells it cannot cast, Table-4 HP dots that compound max HP geometrically, and a wilmst cache that still pays far too much.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (5):**

- `todos/pending/2026-09-21-no-equipping-or-swapping-gear-during-combat.md` — `equipItem` / `unequipSlot` / `wearItem` carry no `state.combat` gate and the Gear tab stays live mid-fight; wants an engine refusal + disabled rows (`engine/movement.js:523` is the existing gate pattern). **DONE — shipped as v1.9 Phase 61 (GRULE-02).**
- `todos/pending/2026-09-21-store-purchase-charged-then-rejected-as-not-an-upgrade-spike.md` — `buyFrom` deducts gold and marks the row sold BEFORE `takeItem` can reject `notBetter`; a purchase must always deliver or refuse before charging. **DONE — shipped as v1.9 Phase 61 (STORE-02/03).**
- `todos/pending/2026-09-21-summoner-rolls-freeze-it-cannot-cast-hide-uncastable-spells-.md` — chargen's `rollGrimoire` ignores the `mu-chart.js` school gate; plus the user ruling that the combat menu HIDES level-locked spells (reverses the earlier disabled-but-visible CONTEXT decision). **Carried to v2.1 as RULES-03/04.**
- `todos/pending/2026-09-21-table-4-hp-dots-compound-max-hp-geometrically-regression.md` — the "+25 HP" row adds `0.6 × CURRENT maxWP` permanently (×1.6 per pull, compounding) and the toll row then takes 36 % of the inflated pool; a 54-05 regression that also inflates the fit's bot heroes. **Carried to v2.1 as RULES-01.**
- `todos/pending/2026-09-21-red-dot-wilmst-cache-still-pays-far-too-much.md` — `WILMST_CACHE_PER_DEPTH = 300` flat × depth; wants its own cut (~100 × depth) or a derived-rng roll. **Carried to v2.1 as RULES-02.**

**Engine gate applies:** every one of these is a rules change — measure the moved parity fixtures first, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, regenerate only those, master never edited, bot readout before/after.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Content accuracy, tooling & the open climb ruling (PROMOTED → Phases 78, 79, 80)

> **Promoted 2026-09-24 into milestone v2.1: the climb/leap ruling → CLIMB-01/02, Phase 78; sub-class descriptions → VOX-04, Phase 79; the fit-tool replay-resume bug → TOOL-01, Phase 80.** The climb ruling was decided by the user 2026-09-24 as option B (the pre-roll CLIMB/LEAP/USE LADDER/USE ROPE/TURN BACK decision card). Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-21/22] The odds and ends from the device rounds: sub-class blurbs that hide their own gates, a fit tool whose replay-resume diverges, and the CLIMB IT retry card that went stale when Phase 54 made climbs one-and-done.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (3):**

- `todos/pending/2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md` — the Summoner blurb never mentions the level-3 offense gate; audit every `SUB_NOTE` / `RACE_NOTE` against `MU_CHART` + the Phase 24 identity table. Content only.
- `todos/pending/2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md` — `+Infinity` scores serialise as `null`, so a resumed walk takes a different step after the first rejected candidate; per-block stdout was also truncated. Tooling only.
- `todos/pending/2026-09-22-climb-leap-retry-card-is-stale-under-one-and-done.md` — **resolved by user ruling 2026-09-24, option B:** a pre-roll CLIMB / USE TOOL / TURN BACK prompt, no rng until commit. Keep the ladder/rope option; `mapMarks.js` crevice copy reads pre-one-and-done too.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.8: Unify the two darkness mechanisms (PROMOTED → Phase 76)

> **Promoted 2026-09-24 into milestone v2.1 as DARK-01/02, Phase 76 (Darkness Unification & Relaunch Persistence).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [User ruling 2026-09-22, found during Phase 57 planning] The game has **two** darkness mechanisms with **different waiver sets**, and they disagree. Unify them behind one shared waiver predicate so a light source means the same thing everywhere.
**Requirements:** TBD
**Plans:** 0 plans

**The inconsistency, measured:**

| | `revealRadius(state)` | `mapViewRadius(state)` |
|---|---|---|
| Origin | **1994 canon** — `engine/derived.js` comment: "ports `mazeworld.html` `reveal()`'s radius line verbatim (line 838)" | **Phase 41 (TERR-03)** — this project's own render filter |
| Governs | what NEW cells are revealed as the party walks (feeds `seen`) | which already-`seen` cells are rendered (`inViewWindow`, applied in `draw()`) |
| Waived by | Night Vision, `+ eff("sight")` | Night Vision, `eff("light") > 0` (Amulet), `itemEffectActive("lit")` (torch) |

Verified empirically at HEAD with `darkFor: 30` on a non-dark tile:

```
no waiver   | inDark true | revealRadius 1 | mapViewRadius 1
lit torch   | inDark true | revealRadius 1 | mapViewRadius Infinity   <-- the divergence
```

**So a lit torch reopens your entire explored map but does not help you see one square further as you walk.** That is backwards from what a torch obviously does, and it is the cause of the 2026-09-21 device report (*"It looks like I'm in the dark, but it's not limiting my vision"*) — the player had a light source, the render filter waived, the reveal rule did not, and nothing on screen explained either.

**The shape of the fix:** one shared `darkWaived(c)` predicate consumed by both functions, with the **torch and the Amulet widening `revealRadius` as well** (the reading the user favours: a light source should mean the same thing everywhere). Keep `+ eff("sight")` as the separate additive it already is.

**Why this is NOT a v1.8 phase:** widening `revealRadius` changes which cells enter `seen`, and `seen` is serialized — so parity fixtures move. v1.8 is gated presentation-only (`engine/` and `content/` byte-identical, zero fixtures moved). This needs the greenfield treatment instead: measure the moved set first, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, regenerate only those, never edit the master, and take a bot readout before/after (a wider reveal radius in the dark is a small difficulty change — darkness gets less punishing for anyone carrying a light).

**What Phase 57 did instead (v1.8, presentation-only):** made the *current* behaviour legible rather than changing it — the DARK chip names which waiver is holding the dark back, and the map vignette follows `mapViewRadius` (what is actually rendered) rather than `revealRadius`. When this backlog phase lands and the two agree, the vignette's source argument can collapse back to a single radius and `waiverFor`'s three-way split becomes a two-way one. Leave a comment in `src/browser/darknessView.js` pointing here.

**Third surface to fold in while here:** per-tile `tile.dark` painting in `draw()` is a *third* darkness expression, independent of both radii. Decide whether it shares the predicate or stays purely cosmetic.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.9: Android 15/16 edge-to-edge, deprecated window APIs, large-screen orientation (PROMOTED → Phase 80)

> **Promoted 2026-09-24 into milestone v2.1 as DROID-02/03, Phase 80 (Android Release Build & Tooling).** Flagged `--research-phase` recommended. Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-23 from the Play Console pre-launch notes on the 1.9.0 / vc8 build] Clear the three Play Console warnings so the game draws correctly edge-to-edge on Android 15+ and behaves on tablets, foldables and Chromebooks.
**Requirements:** TBD
**Plans:** 0 plans

**The three warnings, verbatim from Play Console:**

1. *"From Android 15, apps targeting SDK 35 will display edge-to-edge by default. Apps targeting SDK 35 should handle insets to make sure that their app displays correctly on Android 15 and later. Investigate this issue and allow time to test edge-to-edge and make the required updates. Alternatively, call enableEdgeToEdge() for Kotlin or EdgeToEdge.enable() for Java for backward compatibility."*
2. *"One or more of the APIs you use or parameters that you set for edge-to-edge and window display have been deprecated in Android 15. To fix this, migrate away from these APIs or parameters."*
3. *"Your game doesn't support all display configurations, and uses resizability and orientation restrictions that may lead to layout issues for your users."*

**What is already in place (so this is a verify-and-tidy, not a rewrite):**

- `targetSdkVersion = 36` (`android/variables.gradle`), so edge-to-edge is already forced on Android 15+.
- `mazeworld.html` pads its fixed chrome with `var(--safe-area-inset-*, env(safe-area-inset-*))` (HUD band ~L1026, dead screen ~L1105, `.mw-bd-dock` ~L1187, title/panels ~L1261/1344/1417/1527). Device checks so far have looked right on the Pixel 7, but nobody has tested gesture-nav vs 3-button nav, a display cutout, or landscape.

**Likely sources, to confirm:**

- **Warning 2:** `src/browser/nativeChrome.js` ~L219-220 calls `StatusBar.setBackgroundColor({ color: "#1b170f" })`. On Android that maps to `Window.setStatusBarColor`, which is deprecated in API 35 and ignored under edge-to-edge (the comment there already calls it best-effort). Drop the call, or move to `@capacitor/status-bar`'s edge-to-edge-aware API if 8.x has one. Also check Capacitor core, SplashScreen and the Play Games plugin (Phase 67) for `setStatusBarColor`, `setNavigationBarColor` or `setDecorFitsSystemWindows`. Play Console names the calling class under "View details".
- **Warning 1:** confirm Capacitor 8's `BridgeActivity` already enables edge-to-edge, or call `EdgeToEdge.enable(this)` in `MainActivity`. Then check that the WebView really receives the insets: Capacitor's `SystemBars`/`adjustMarginsForEdgeToEdge` config, and whether `env(safe-area-inset-*)` is populated inside the Android WebView or needs the Capacitor-injected `--safe-area-inset-*` variables.
- **Warning 3:** `AndroidManifest.xml` sets `android:screenOrientation="portrait"` and `nativeChrome.js` locks portrait through `@capacitor/screen-orientation`. On Android 16 (targetSdk 36), large screens (smallest width ≥ 600dp) **ignore** orientation and resizability restrictions, so the game will run in landscape or in split-screen on tablets and foldables whatever we set. Decide whether to (a) accept a letterboxed portrait column centred on wide screens (a max-width layout plus a dark gutter), or (b) do nothing and accept the warning. Games can opt out through the `android:appCategory="game"` exemption, so check whether Play still flags a game that declares it.

**Constraints:** presentation and native shell only. The engine, `content/` and fixtures are untouched. Needs a device pass on the Pixel 7 in both navigation modes, plus an emulator tablet or foldable (resizable AVD) for warning 3.

**Sequencing:** interacts with the AGP 9.3.1 spike (Phase 67, `67-AGP9-SPIKE.md`), which also touches the Android build, so land it after that verdict. A good fit for the first post-v2.0 native-polish pass, alongside the R8/minify todo.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.10: Keep live combat and open store through a relaunch (PROMOTED → Phase 76)

> **Promoted 2026-09-24 into milestone v2.1 as SAV-06/07, Phase 76 (Darkness Unification & Relaunch Persistence).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-24 from Phase 70 plan 70-04's resume proof; user ruling: finish Phase 70, fix later] A player who Save & quits (or whose app is killed) mid-fight or mid-store should come back to the same fight or store after a relaunch, not to a cleared tile.
**Requirements:** TBD
**Plans:** 0 plans

**The gap, measured (70-04, real engineAdapter + fake storage):**

- In session: SAVE & QUIT → ENTER resumes exactly (no dispatch happens).
- After a relaunch: `dispatch()` did persist `combat` / `store`, but `engine/saveState.js#rehydrate` (~L735-736) always resets `combat`, `store`, `beats`, `pendingFind` and `pendingHazard` to null. Only `pendingLoot` survives on purpose (LOOT-06). The code comments call this deliberate: it copies the 1994 prototype's load, which treated them as transient.
- Consequences: a relaunch mid-fight lands on the same tile with the fight gone, which also means force-closing the app escapes any fight. An open store vanishes the same way.
- Pinned as today's behaviour in `test/persistence/` (70-04), with a pointer here.

**The shape of the fix:** carry a validated `combat` and `store` through `validateSave` and `rehydrate`, including mid-fight state that combat depends on (`c.foeEffect`, the timers, any per-round flags). Decide whether `beats` should rehydrate or the round should resume at a clean round boundary. Check `pendingFind` / `pendingHazard` the same way.

**Constraints:** an engine change (greenfield ruling: no dual path). Measure which parity or roundtrip expectations move, declare them in `test/parity/FIXTURE-INVENTORY.md`, and never edit the prototype master. Needs a relaunch-mid-fight device check.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.11: Per-sub-class leaderboards & global LINEAGE (SUPERSEDED by the Our Own Leaderboards milestone, Phases 82–86 — RACE/SUB-CLASS filters over one run table)

**Goal:** [Captured 2026-09-24, user] Every sub-class has its own global DEEPEST board on Play Games. Claude creates all 24 boards in Play Console by script and captures their IDs; nobody fills in the Console form 24 times. The game submits each run to its sub-class board, and LINEAGE gets an honest global form back. **The user wants this promoted as its own milestone** (via `/gsd-new-milestone`, after v2.1), not folded into v2.1.
**Requirements:** TBD
**Plans:** 0 plans

**Combines two threads:**

1. **The ask (user, 2026-09-24):** one leaderboard per sub-class, all ranked by deepest depth. Creating each board by hand in Play Console is too slow with 24 sub-classes, so Claude should create them. It must also **retrieve each new board's ID** and wire it in, the way the Season-1 IDs were pasted by quick task 260924-c14.
2. **The deferred LINEAGE global board:** v2.0 Phase 68 built LINEAGE's global form by grouping a top-25 DEEPEST sample on the client, with no per-combo board explosion in Play Console (PROJECT.md key decision; `proposed-milestone-leaderboards.md` "Race/sub-class boards: combinatorial"). At v2.1 roadmap approval the user made LINEAGE ME-only and deferred per-sub-class global boards (STATE.md 2026-09-24; **Phase 81** success criterion 3). The reason: Play Games keeps one best score per player per board, so a sample of DEEPEST cannot honestly rank lineages. Per-sub-class boards are the fix.

**What exists today (verified 2026-09-24):**

- **24 sub-classes, 8 per parent class:** `content/classes.js:13` (`CLASSES[...].subs`). The id is also the display name.
  - Magic User: Wizard, Warlock, Sorcerer, Summoner, Cleric, Illusionist, Court Mage, Apprentice
  - Fighter: Knight, Guard, Woodsman, Soldier, Barbarian, Master of Arms, Samurai, Bard
  - Thief: Pickpocket, Pilfer, Cat Burglar, Cutthroat, Cloaker, Ninja, Con Artist, Acrobat
  - `src/browser/scoreTag.js:38` `TAG_SUBS` is a frozen, append-only index in a different order. `classOfSub()` is at `:66`.
- **Play Games app / project ID `517177834262`:** `android/app/src/main/res/values/games-ids.xml:6`; runbook `docs/PLAY-GAMES-SETUP.md`.
- **Board IDs:** `content/leaderboards.js` `LEADERBOARD_IDS`, one frozen entry per season with 5 keys (deep/lean/days/kills/purse; `lean` goes away, see the LEANEST decision). A `PLACEHOLDER` prefix means the board is skipped silently.
- **Scores:** `src/browser/boardScores.js`. The DEEPEST encoding is `floor * 1,000,000 - steps` (steps capped at 999,999), `largerIsBetter`. `leaderboardId(ids, season, board)` is at `:132`, and dev builds use `dev_{board}_s{season}` (`:165`).
- **Submission:** `mazeworld.html` `onRunRecorded` → `src/browser/pgsQueue.js` enqueue (`:124`) → `flush()` → `provider.submitScore` (`:386`), one acked board at a time. Standing is fetched on the deep board (`:428-432`). The provider is `src/browser/playGames.js` (`@modbender/capacitor-play-games` 0.5.0).
- **No service account yet:** `docs/RELEASING.md` "Uploading from the CLI (not set up yet)" and `C:/Users/Dell/.play/` does not exist.

**Part A: provision the boards by script (Claude does this, user approves)**

- **API:** Google's Play Games Services **Publishing / Games Configuration API**. `POST https://www.googleapis.com/games/v1configuration/applications/{applicationId}/leaderboards` (`leaderboardConfigurations.insert`), plus `list` / `get` / `update` / `delete`. OAuth scope `https://www.googleapis.com/auth/androidpublisher`. The body is `{ scoreOrder: "LARGER_IS_BETTER", draft: { name: { translations: [{ locale: "en-US", value }] }, scoreFormat: { numberFormatType: "NUMERIC", numDecimalPlaces: 0 }, sortRank } }`. Leave `scoreMin` / `scoreMax` empty to match the Season-1 boards. The response carries the new board's `id` (`CgkI...`), which is how the IDs are captured.
- **One-time user setup:** a Google Cloud service account plus a JSON key stored outside the repo (`C:/Users/Dell/.play/service-account.json`), with the Games Configuration API enabled in that project. Then invite the service account in Play Console → Users and permissions, with the permission that covers Play Games Services configuration. Confirm the exact permission name at planning. **The same key unlocks `tools/play-upload.mjs`** (the CLI AAB upload that RELEASING.md defers), so plan the two together.
- **Script:** `tools/pgs-leaderboards.mjs`, build tooling only; `googleapis` or plain `fetch` + `google-auth-library` as a devDependency; nothing ships in the app. It reads the sub-class list from `content/classes.js` so the list is never retyped. It is **idempotent**: `list` first and skip any board whose name already exists, so a rerun never duplicates. `--dry-run` prints the plan. It writes the returned IDs into `content/leaderboards.js` (or prints the block for review).
- **Naming:** follow the Season-1 convention (`PLAY-GAMES-SETUP.md` §7: *DEEPEST, Season 1*). For example *DEEPEST, Wizard* (all-time) or *Wizard, Season 1* (seasonal). Decide with the seasons question below.
- **Publishing:** the API creates **draft** leaderboards. Testers see drafts; everyone else sees them only after the user presses **Publish** on the Play Games Services config in Play Console. Keep that as a manual user step and add it to the runbook. Ordering cannot be changed once published, so the dry-run output is the review gate.
- **Fallback:** if the service-account route is blocked, drive Play Console's "Create leaderboard" form in the user's signed-in Chrome (claude-in-chrome) and scrape each ID from the board's page. It's slower and more fragile.

**Part B: submit to the sub-class boards**

- Extend the `LEADERBOARD_IDS` shape to carry sub-class boards, keyed by the `content/classes.js` sub names. The unit suite asserts every sub-class has an ID or a `PLACEHOLDER`.
- `pgsQueue` submits the existing DEEPEST score (same `boardScore` encoding and score tag) to the run's sub-class board, as well as the main DEEPEST board. Acks are tracked per board so a retry never double-submits. Dev IDs become `dev_deep_{sub}_s{season}`.
- Old queued entries without sub-class boards load tolerantly (greenfield rule: no dual path; old saves tolerant-load only).

**Part C: global LINEAGE returns**

- The global LINEAGE view for a picked sub-class reads **that sub-class's board** (top page + the player's own standing), not the DEEPEST sample. Race stays a client-side filter from the score tag on that board's rows. This is honest per sub-class; the race split is still a sample, and the copy should say so.
- This reverses or extends Phase 81's "LINEAGE ME-only". **It depends on Phase 81 landing first** (ME | ALL | FRIENDS scopes).

**Decided (user, 2026-09-24): Google only, rolling season sets.**

- **Play Games only.** No backend of our own and no managed leaderboard service. Considered and rejected: a Cloudflare Worker + D1 server (PGS `requestServerSideAccess` identity, `loadFriends` filter, replay-verified runs), and PlayFab / LootLocker / Nakama.
- **Each season gets a full set of 28 boards** (4 main + 24 sub-class; LEANEST is dropped, see below) with fresh IDs, added as a new `LEADERBOARD_IDS` entry plus a `SEASON` bump and an app update, as the season model already works. **The old season's set is deleted later** to stay under Play Games' **70-leaderboard cap**. Published boards cannot be reset, but they can be deleted.
- **Rolling window:** at most two season sets live at once (56 boards). Season N-1's set must be deleted before Season N+1's set is created (3 × 28 = 84 > 70). Google does not document whether deleted boards still count toward the cap. **Test it once with a throwaway board** before the first rollover.
- **The script therefore needs two modes:** `create --season N` (create the 28 boards, capture the IDs, write the `content/leaderboards.js` entry) and `delete --season N` (delete that season's 28 by name/ID; `--dry-run` first).
- **Once a season is deleted,** the panel's season picker must drop it (or show it as retired). `pgsQueue` must treat a "leaderboard not found" error on a retired season's board as permanent and drop the entry, not retry forever. Players who haven't updated keep submitting to the old boards until those are deleted, and after that the submissions are dropped.

**Decided (user, 2026-09-24): drop LEANEST.**

- **Why:** LEANEST ranks by steps per floor (`src/browser/boardScores.js` `lean = round(1000 × steps / max(floor, 1))`; local `engine/records.js` `compareRuns("lean")`). A 1-step death therefore tops it (a floor-0 death counts as one floor on Play Games, and a 1-step death on floor 1 tops the local board). The user's intended meaning, "deepest floor, then the fewest steps", is exactly DEEPEST's ordering (`floor × 1,000,000 − steps`). v2.0 Phase 66 D-09 had moved LEANEST to steps per floor precisely to stop it duplicating DEEPEST, so there is no honest single-number LEANEST left.
- **Considered and parked:** "fewest steps to reach floor 5 / 10 / 15 / 20" speedrun boards. The user liked the idea, but it adds 4 boards per season, and the user wants fewer boards, not more. Keep it as an idea only.
- **Scope of the removal:** drop `lean` from `RANKED_BOARDS` / `BOARD_IDS` (`engine/records.js`), `SUBMIT_BOARDS` / `SCORE_ORDER` / `boardScore` / `scoreFallback` (`src/browser/boardScores.js`), the `lean` key of every `LEADERBOARD_IDS` season entry, `content/boards.js` copy, the panel's board rail, the bests record's `lean` list (tolerant-load: an old `ddr.bests.v1` with a `lean` list loads cleanly and drops it), and queued `pgsQueue` entries' `lean` scores (dropped on load, never submitted). Also update `docs/PLAY-GAMES-SETUP.md` §7 (board table and "The LEANEST limit").
- **The live Season-1 LEANEST board** (`CgkIlvbN0YYPEAIQAw`): stop submitting to it, then delete it in Play Console (or by the script's `delete` mode) once the update without it is out. That frees one slot under the 70 cap.
- **Moved to v2.1 Phase 81 as BOARD-17** (user, 2026-09-24): it closes a live exploit and is the same kind of removal as GRAVEYARD. This milestone starts with LEANEST already gone; the season sets above assume 28 boards.

**Open decisions (for milestone discussion):**

- Race boards too? 6 more per season makes 34 per set, and two live sets = 68, just under the cap, so probably not. Race × sub-class (144) is impossible under the cap.
- Board icons: `imageConfigurations.upload` (`LEADERBOARD_ICON`) could reuse the sub-class PNG art. Optional.
- Does "you placed X" also report the sub-class standing on the death card?

**Constraints:** shell and tooling, plus the pure `engine/records.js` board list for the LEANEST removal; zero parity fixtures expected (verify). The service-account key never enters the repo or `www/`. No new runtime SDK (the ads/analytics audit stays clean). Needs a signed-in Pixel 7 check (submission lands on the sub-class board; LINEAGE ALL/FRIENDS), batched into the milestone-close checklist.

**Sources:** [leaderboardConfigurations.insert](https://developer.android.com/games/services/publishing/api/leaderboardConfigurations/insert) · [LeaderboardConfiguration resource](https://developer.android.com/games/services/publishing/api/leaderboardConfigurations) · [70-leaderboard limit](https://developers.google.com/games/services/common/concepts/leaderboards)

Plans:

- [ ] TBD (promote with /gsd-new-milestone when ready — user wants this as its own milestone)

### Phase 999.12: Achievements track (BACKLOG — promote as its own milestone)

**Goal:** [Captured 2026-09-25, user] Add an achievements track to the game. Every achievement name and unlock line is written in the game's sarcastic, family-friendly voice. **The user wants this promoted as its own milestone** (via `/gsd-new-milestone`), not folded into a bug-fix milestone.
**Note (2026-09-28):** v2.2 removes Play Games entirely, so achievements become a local list unless Play Games is re-added for them.
**Requirements:** TBD
**Plans:** 0 plans

**The user's seed list (ideas, not a closed set):**

- **Depth milestones:** reach 5, 10, 15 and 20. **20 is "Unicorn!"** (matches the depth-20 unicorn-ceiling tuning target).
- **Fully dressed:** have an item equipped in every slot at once.
- **Naked ambition:** reach 5 with **nothing equipped**. You must unequip everything before your first move, so the check is "zero equipped at step 1 and never re-equipped".
- **Teetotaler:** reach 5 without drinking a single healing potion.
- **Frequent flier (tiered):** die 50, 100, 200 and 500 times, counted across all runs.
- **Read the label:** drink the Death potion (`content/potions.js:45`, `eff: "death"`, *"your dead!"*).
- **Body counts:** kill 100 Walking Dead, and one "kill 100" for each monster group. The groups are the `content/bestiary.js` `BESTIARY` keys: Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead.
- **Every race:** reach 5 with each race in `content/races.js`: Human, Elven, Dwarven, Wilmsry, Fridgian, Troll.
- **Every class:** reach 5 with each parent class (Magic User, Fighter, Thief), not with each sub-class.
- **Tourist:** start one delve with every one of the 24 sub-classes (`content/classes.js` `CLASSES[...].subs`). Depth doesn't matter.
- **Survivor (tiered):** live for X days in a single run. Tier thresholds are decided at planning, calibrated from bot/sim day counts.
- **Hoarder (tiered):** gain X coin. Decide at planning whether it counts one run or lifetime, and whether it's coin earned or coin held.
- **Special Snowflake:** die on floor 1. The user's line: *"You're a special snowflake."* Every run starts on floor 1 (there is no floor 0), so any death before the first descent counts.
- **Party Animal (tiered):** accept X Joiners in total, counted across all your delves. The tier thresholds are decided at planning.

- **Fallen Joiners (tiered, user):** X Joiners have died in your service, counted across all delves. Name idea: *Human Shields*.
- **Fallen summons (tiered, user):** X of your summons have died. Name idea: *Disposable Help*.
- **"Any kind of fun thing" (user):** the brainstorm below is open. Keep what's funny.

**Brainstorm (Claude, 2026-09-25, for the milestone discussion; every one keys off an engine event or death cause that already exists):**

- **Death-cause collection.** The death causes are the `content/epitaphs.js` keys: combat, starve, trap, fall, gorge, teleport, maze, quake, potion, insanity, poison, backfire, summon, entombed.
  - *Well-Rounded:* die of every cause.
  - Hidden one-offs, each with a hint breadcrumb:
    - *Just One More Bite* (gorge)
    - *Friendly Fire* (your own spell backfires; also `backfireSelfDamage`)
    - *Read the Fine Print* (killed by your own summon; also `summonBackfired`)
    - *Buried Talent* (entombed)
    - *Poor Aim* (teleported into trouble)
- **Dying with regrets:**
  - *You Can't Take It With You:* die with X coin unspent.
  - *Saving It For Later:* die holding an undrunk healing potion.
  - *Speedrun:* die within your first N steps.
- **Tiered event counters:**
  - *Tactical Retreat Enthusiast:* flee X times (`fled`).
  - *Tripwire Connoisseur:* spring X traps (`trapSprung`).
  - *Bomb Squad:* disarm X traps (`trapDisarmed`).
  - *Get Off My Lawn:* turn X Walking Dead (`walkingDeadTurned`).
  - *Cartographer:* fully map X floors (`floorMapped`).
- **Social disasters:**
  - *Diplomatic Incident:* insult a foe in parley (`parleyInsulted`).
  - *Riveting Company:* a foe gets bored and leaves (`foeBored`).
  - *It's Not You, It's Me:* dismiss a Joiner (`joinerDismissed`).
  - Something for `joinerMurdered`, once planning confirms what that event covers.
- **Collectors:**
  - *Collected Neuroses:* acquire X distinct phobias (`phobiaAcquired`).
  - *Fashion Victim:* lose X armor pieces to wear (`armorDestroyed`).
  - *Retail Therapy:* spend X coin at the store, lifetime.
- **Faerie roulette:** *Fairy Godmother* (a `faerieBoon`) and *Fairy Godmugger* (a `faerieBane`).
- **Clutch:** *Just a Flesh Wound:* win a fight on 1 HP.

**Design principle: tiers and breadcrumbs (user, 2026-09-25):**

- **Tier the counters.** Counting achievements come in escalating tiers (deaths 50 / 100 / 200 / 500). Apply the same idea to kill counts and similar tracks, so there is always a next rung in sight.
- **Achievements hint at other achievements.** An easier, more common unlock's sarcastic line drops a clue about a less obvious one. Example: *Fully dressed* (every slot filled, likely common) hints that taking it all *off* might also count, which leads to *Naked ambition*, something few players would think of otherwise. Chain the hidden or odd achievements behind hints from the obvious ones. Hidden achievements can be revealed when their hint fires (Play Games `revealAchievement` exists for exactly this).

**Open decisions (for milestone discussion):**

- **"Level" means floor depth or character level?** The engine has both: character level comes from `levelFromSP` in `engine/derived.js`. The depth-20 unicorn target suggests depth, and "reach 5" in the other ideas probably means depth too. Confirm.
- **Where achievements live:** Play Games achievements, a local in-game list, or both. The plugin `@modbender/capacitor-play-games` already exposes `unlockAchievement` / `incrementAchievement` / `setAchievementSteps` / `loadAchievements` / `showAchievements`. The game must stay fully playable offline, so a local list is the source of truth and Play Games is a mirror. Unlocks earned offline or while signed out are queued like `pgsQueue` scores.
- **Provisioning:** Play Console achievements need an icon and fixed XP points (1,000 XP cap per game). Created by script via the Games Configuration API (`achievementConfigurations.insert`) with the same service account as 999.11's leaderboards script, or by hand. Plan them together.
- **Counters and persistence:** the kill counts per group, deaths, races/classes reached and sub-classes delved need a durable lifetime-stats record in `@capacitor/preferences` (the `storage.js` pattern), kept separate from the run save. Tolerant-load, no legacy paths. Decide whether to count retroactively from the local graveyard/bests history.
- **Engine purity:** the engine only emits the facts (kills with group, potion drunk, equip state at step 1, depth reached). The achievement tracker is a shell layer that folds events into the lifetime stats. Zero rng draws, so zero parity fixtures should move (verify).
- **Surfacing:** an unlock is a minor event, so it shows as a toast with a sarcastic line, not a card (see the card vs toast rule). The list lives somewhere in ☰ or the Hero Company tab; the Play Games achievements UI opens from ☰. Hidden or secret achievements (e.g. the Death potion) keep the joke intact.
- **Bot / sim:** decide whether the headless bot tracks achievements (probably not, but depth-reach rates from the sim help calibrate how hard each one is).
- **More ideas welcome:** the user's list is a starting point. Brainstorm more in the game's voice during discussion.

**Achievement and icon inventory (Claude, 2026-09-25, for icon generation):**

Icons are required. Play Games treats each tier as its own achievement, and every achievement needs its own uploaded icon (512×512). So **icon files = achievements**. Art is cheaper than that: draw one picture per achievement line and make each tier by adding one of 4 reusable tier frames (bronze / silver / gold / mythic). Play Games generates the greyed-out locked version itself. The same pictures, shrunk down, serve the in-game list. The repo has no race, class or monster art to reuse, so every picture is new.

*The user's list:*

| Achievement | Tiers | Icon files | Pictures |
|---|---|---|---|
| Depth 5 / 10 / 15 | 3 | 3 | 1 (descent) |
| Unicorn! (depth 20) | 1 | 1 | 1 (its own art) |
| Fully Dressed | 1 | 1 | 1 |
| Naked Ambition | 1 | 1 | 1 |
| Teetotaler | 1 | 1 | 1 |
| Frequent Flier (die 50/100/200/500) | 4 | 4 | 1 |
| Read the Label (Death potion) | 1 | 1 | 1 |
| Body counts: Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead | 1 each (100 kills) | 6 | 6 |
| Every race: Human, Elven, Dwarven, Wilmsry, Fridgian, Troll | — | 6 | 6 |
| Every class: Magic User, Fighter, Thief | — | 3 | 3 |
| Tourist (all 24 sub-classes) | 1 | 1 | 1 |
| Special Snowflake | 1 | 1 | 1 |
| Survivor (X days) | TBD | ~4 | 1 |
| Hoarder (X coin) | TBD | ~4 | 1 |
| Party Animal (X Joiners) | TBD | ~4 | 1 |
| Human Shields (fallen Joiners) | TBD | ~4 | 1 |
| Disposable Help (fallen summons) | TBD | ~4 | 1 |
| **Total** | | **49** (44 at 3 tiers) | **29** |

*The Claude brainstorm (not yet agreed):*

| Group | Achievements | Icon files | Pictures |
|---|---|---|---|
| Death causes | Well-Rounded, Just One More Bite, Friendly Fire, Read the Fine Print, Buried Talent, Poor Aim | 6 | 6 |
| Dying with regrets | You Can't Take It With You, Saving It For Later, Speedrun | 3 | 3 |
| Tiered counters | Tactical Retreat Enthusiast, Tripwire Connoisseur, Bomb Squad, Get Off My Lawn, Cartographer | 20 (4 tiers) | 5 |
| Social disasters | Diplomatic Incident, Riveting Company, It's Not You It's Me, one for `joinerMurdered` | 4 | 4 |
| Collectors | Collected Neuroses, Fashion Victim, Retail Therapy (tiered) | 12 (4 tiers) | 3 |
| Faerie | Fairy Godmother, Fairy Godmugger | 2 | 2 |
| Clutch | Just a Flesh Wound | 1 | 1 |
| **Total** | | **48** (40 at 3 tiers) | **24** |

*Scenarios:*

| What ships | Icon files | Pictures |
|---|---|---|
| User's list as written | 44–49 | 29 |
| User's list, kill counts tiered ×4 | ~67 | 29 |
| User's list + full brainstorm | ~84–97 | 53 |
| Tier frames (made once, reused) | — | +4 |

Minimum art job: **29 pictures + 4 tier frames**, exported as about **49 icon files**. The hand-off prompt for an image-generation agent is `.planning/phases/999.12-achievements-track/ICON-BRIEF.md`.

*Decisions that move the counts:*

- **Tier counts** for Survivor, Hoarder, Party Animal, Human Shields, Disposable Help and the kill counts. Each extra tier adds one icon file per track, but no new picture.
- **Races and classes:** 9 separate achievements (as counted above), or one achievement each that fills up as you go. The single-achievement option cuts 9 files and 9 pictures down to 2 of each (29 pictures become 22).
- **Points:** Play Games gives each game 1,000 points in total. Across 50–90 achievements that is roughly 10–20 points each, which argues for short tier ladders.

**Constraints:** offline-first (no network needed to earn an achievement); no new runtime SDK beyond the existing Play Games plugin; family-friendly copy; needs a signed-in Pixel 7 check (unlock toast plus the Play Games popup), batched into the milestone-close checklist.

Plans:

- [ ] TBD (promote with /gsd-new-milestone when ready — user wants this as its own milestone)

### Phase 999.13: Our own leaderboards instead of Google Play Games boards (PROMOTED → Phases 82–86)

**Goal:** [Captured 2026-09-26, user] Stop relying on Google Play Games leaderboards and run our own global boards. The user's reasoning: "with the privacy being defaulted to on, the competition is ghost-town". Play Games hides a player's scores from other players unless their profile visibility allows it, so the ALL and FRIENDS boards look empty. Players must still be able to opt out; the Compete toggle stays. Our boards should be public by default, and Compete OFF means nothing is ever sent.
**Requirements:** TBD
**Plans:** 0 plans

**Decisions this needs before planning (discuss-phase):**

- **The backend is new territory.** PROJECT.md says the game is offline-first: "the offline constraint relaxes only for opted-in players", and signed-out play makes zero network calls. That rule survives, since only Compete-ON players talk to the server. But a server the author runs is new: hosting, cost, uptime and moderation. Candidates:
  - a small serverless endpoint (e.g. Cloudflare Workers + D1, or Supabase), called with plain `fetch`
  - **no** new client SDK: CLAUDE.md bans analytics SDKs, and Firebase counts as one
- **Identity.** Either keep Play Games sign-in only for the player id and display name, dropping only its leaderboards, or use an anonymous install id plus a chosen handle. Chosen handles need the family-friendly filter (`content/safety-wordlist.js`) and a way to report or rename a bad one.
- **Cheating.** A client-submitted score is trivially forged. The engine is deterministic and serializable, and `buildRunSummary` already carries the seed, the rules/season version, an action count and a hash. So the server can check the run cheaply, or fully replay the seed plus the action log for top-N entries.
- **Scopes.** ME stays local and ALL comes from our server. FRIENDS comes from our own friends list: the user decided on 2026-09-26 to drop Google's friends list too. That work is **Phase 999.14**, which is built together with this item.
- **Store compliance.** The Data Safety form and the privacy policy change, because a score, a handle and an id now leave the device and go to our server, not Google's. The Compete opt-out copy is updated too.
- **Migration.** Keep or retire the Season-1 Play Games boards, and decide what happens to queued `pgsQueue` entries. Play Games achievements (999.12) can stay on Play Games regardless.
- **DAYS farming (to check; captured 2026-09-28, user).** "We need a way to prevent someone from wandering around floor 1 endless to wrack up DAYS on the leaderboard. I'd expect that they would eventually starve to death ... so, maybe it's fine, but let's note it as something to check."
  - **The check:** measure how many DAYS a hero can bank by staying on floor 1 and never descending. Count rations, foraging or healing on floor 1, camp and rest loops, store restocks, and anything else that refills food.
  - **If starvation reliably ends it** at a DAYS count below an honest deep run, it's fine; record the number.
  - **If it doesn't:** candidate fixes are to rank DAYS only with depth (e.g. ties broken by depth, or days counted only after floor N), to cap days per floor, or to let the server's run check (above) flag runs with a long days-to-depth ratio.

**The new leaderboard UX (design handed over 2026-09-28, user):** "This is the new UX for leaderboards." Implement it when this item is promoted. It replaces the Phase 81 panel layout described below.

- **The design:** the Claude Design project https://claude.ai/design/p/fed8909e-860d-496e-9d31-04dd31f14a3c?file=Mazeworld+Leaderboards+v3.dc.html
- **Import it** with the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via `/design-login`). The whole project is readable.
- **Focus file:** `Mazeworld Leaderboards v3.dc.html`. Also read the files it imports: `ios-frame.jsx` and `support.js`.
- **Implement:** `Mazeworld Leaderboards v3.dc.html`.
  - Its frame is iOS, but the target is Android only, so treat the frame as presentation.
  - Keep the house rules: PNG icons, the rail rules, tap-to-move.
  - Plan the UI phase against the design (the UI-SPEC from it).

**What it touches / supersedes:**

- The shell leaderboard stack: `src/browser/playGames.js`, `globalBoards.js`, `pgsQueue.js`, `boardScores.js`, `boardsPanel.js`, `boardsView.js`, `account.js`, `accountChip.js`; plus `content/leaderboards.js` (the Play Games board ids). The Phase 81 panel (ME | ALL | FRIENDS, YOU tag, standing card) is kept as the UI; only its global data source changes.
- **Supersedes most of 999.11.** Per-sub-class boards and an honest global LINEAGE become server queries over one run table, and no Play Console board has to be created for each. Review 999.11 when this is promoted.
- Engine untouched: this is shell and server work, with zero parity fixtures.

Plans:

- [ ] TBD (promote with /gsd-review-backlog or /gsd-new-milestone when ready)

### Phase 999.15: Review every skill and every spell (PROMOTED → Phase 90)

> **Promoted 2026-09-29 into milestone v2.3 as SPELL-08/09 and ABIL-06/07, Phase 90 (Spell & Skill Audit).** Player reports #8 (Strength) and #4 (Pommel Strike) ride along as SPELL-09 and ABIL-07. Kept here for its planning context until v2.3 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-27, user] "why does freeze say a d6? Looks like a spell with a to hit roll. So we have spells with to hit rolls? Maybe those rolls need to be double checked. Let's add a backlog item to review every skill and every spell." Audit every spell and every skill/ability end to end. For each one, check what the text promises against what the engine rolls and does, and against canon.
**Requirements:** TBD
**Plans:** 0 plans

**What prompted it (scouted 2026-09-27):**

- **Thrown attack spells have a to-hit roll.** In `engine/magic.js`'s thrown branch (~L598-630), Freeze hits on 6 faces of a d10, and every other thrown spell on 4 faces of a d8. Both are narrowed by Afraid and widened by the school and throw bonuses. The "d6" in Freeze's text (`content/spells.js:87`, "one foe · d6, and frozen solid on a hit") is its DAMAGE die. It reads like a to-hit roll, and the text never states the real to-hit odds.
- The 2026-09-27 universal spell resist (quick 260927-rsx: every foe-targeted spell can be resisted on a half-intel scale) adds a second roll after a thrown spell's to-hit. Its interaction with the to-hit roll belongs in this review.

**Scope for the review (decide at discuss time):**

- **Every spell:** its to-hit roll (if any), damage dice, multipliers, duration, the resist checks (intel, RULES-18 depth control), the school gates, the backfire and fumble odds, and whether the text, the Grimoire, the chips and the foe card state each of those in roll-high form and agree with the engine.
- **Every skill and ability:** its cooldown or once-per-fight rule, auto-hit or forced crit, its bonus terms, who can use it (the hero, Joiners), and the same text-vs-engine agreement.
- **Canon check:** each against the 1994 rulebook. Deviations are recorded as deliberate rulings or fixed.
- **Output:** a per-spell and per-skill audit table (text / engine / canon / verdict), the fixes, and pinned tests. That extends test/unit/authored-ranges.test.js and roll-sign-consistency.test.js to every roll a spell or skill makes.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.16: Itemization pass: every item works as intended, and benefits need the item worn (PROMOTED → Phases 88–89)

> **Promoted 2026-09-29 into milestone v2.3 as ITEM-01..06.** The new systems (effect source, heal-over-time) and the inverted Cloak of Strength are Phase 88 (ITEM-02/03/04, Item Systems); the item audit table, the Enlarge potion rebalance (report #6) and the party-wide item effects such as the Crystal Staff are Phase 89 (ITEM-01/05/06, Item Audit & Fixes). Kept here for its planning context until v2.3 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-28, user] "we need to run an itemization pass to make sure all items are working as intended, we have all required systems, etc. For instance, the cloak of regeneration should actually heal every 10 steps for 30 steps. Also, when you use an item and then take that item off, you should lose the items benefit. For instance, if I wear the cloak of flying and use it, I gain flying, and then if I take it off, I should lose that flying condition. We don't want people just putting everything on and stacking benefits without actually wearing the item for the benefit."
**Requirements:** TBD
**Plans:** 0 plans

**Scope for the pass:**

- **Every item audited end to end:** text vs engine vs canon for every treasure, armour, weapon, cloak, jewellery, staff, wand, potion and scroll. Whatever each promises must actually happen: its duration, charges, cooldown and numbers. Output an audit table (item / text / engine / canon / verdict) with the fixes, pinned by tests (authored-ranges style).
- **Missing systems:** list any system the items need that doesn't exist yet: per-step heal-over-time, stack rules, slot limits, whatever turns up. Build or re-rule each one.
- **Cloak of Regeneration (user example):** it should heal **every 10 steps for 30 steps** (three ticks) once used. Today (`content/treasure-tables.js:199`, engine/items.js "knit" case ~L1616) it gives a flat d6 at once, then a 20-square cooldown (260918-w4n's reading of the prototype's "d6 hp back every 20 squares"). It needs a per-step heal-over-time effect, with narration for each tick.
- **Benefits end when the item comes off (user rule):** an item's activated benefit lasts only while that item is worn or held. Take off a used Cloak of Flying and the flying condition ends at once, with narration. This applies to every use-activated worn item (cloaks, rings, amulets, armour activations such as plated, invisibility, flying, regeneration ticks, etc.), so a player can't put everything on, use it all, and stack benefits from items they no longer wear. That needs an "effect source" link from each timed effect to its item and slot, cleared on unequip, drop, sell, swap or destruction, with save/load and a relaunch covered. Joiners are covered too, if their gear activates.
- **Cloak of Strength is inverted (user report 2026-09-28, scouted):** "the cloak of strength is supposed to stop critical hits, but I'm still getting critted. just now I had Braced on from my cloak, and I took a critical hit from a [Chaos?] wolf."
  - The text (`content/treasure-tables.js:180`, `eff:{noCrit:1}`) says "no critical damage lands on you". The engine reads `eff(c,"noCrit")` in engine/combat.js ~L835-846 as the HERO's OWN crit suppression (the Guard/Soldier "your blows never crit" seam, from Phase 15 ECON-08). So the cloak stops YOUR crits, and foe crits against you still land. That's the opposite of what it promises.
  - Fix: the cloak blocks foe crits against the wearer (foe damage and crit paths, plus the member branch for a Joiner wearing it), and stops suppressing the wearer's own crits.
  - Also, its use activation (`act.kind "brace"`) shows the same "Braced" chip as the Fighter's Brace ability (which halves the next blow). Give it its own chip and name, e.g. "Crit-proof" (a clarity bug).
- **Related existing items to fold in:** backlog 999.15 (the spell and skill review) and the 2026-09-27 PARTY_WIDE_ITEM_EFFECTS (Crystal Staff).

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.17: Large-screen support: drop the portrait lock (PROMOTED → Phase 97)

> **Promoted 2026-10-03 into milestone v2.4** as SCREEN-01..06 (Phase 97). Kept here for its planning context until v2.4 closes. Not a runnable backlog item, do not queue it.

**Goal:** Delve, Die, Repeat works on tablets, foldables and Chromebooks in any orientation and window size, with no resizability or orientation restriction in the manifest.

**Source:** a Play Console pre-launch/quality notice on the 2.3.0 upload (2026-10-02):
"Remove resizability and orientation restrictions in your game to support large screen devices … We detected … `<activity android:name="com.darktierstudios.delvedierepeat.MainActivity" android:screenOrientation="PORTRAIT" />`. To improve the user experience of your game, remove these restrictions and check that your game layouts work on various screen sizes and orientations."

**Context:**

- `android/app/src/main/AndroidManifest.xml` sets `android:screenOrientation="portrait"` on MainActivity. That is the Phase 80 portrait lock, and the app is declared a game (`appCategory`) partly for it.
- On Android 16+ (targetSdk 36), large screens (smallest width ≥ 600dp) ignore orientation and resizability restrictions for non-game apps. Games are exempt today, but Play now flags them as a quality issue.

**Scope:**

1. Remove `screenOrientation`, and any `resizeableActivity=false` or max-aspect limits. Decide what the phone experience should be: keep portrait on phones through a runtime choice, or support landscape everywhere.
2. Responsive layouts for the maze viewport, rail, HUD, tabs and sheets in landscape and at tablet and foldable sizes. Handle multi-window and resizing, safe areas and the system bars (Phase 80 / nativeChrome).
3. Keep state across configuration changes: rotation must not restart a run (Capacitor activity recreation and `configChanges`).
4. Test on emulator profiles: a phone in landscape, a 10" tablet, a foldable (unfolded and folded) and a Chromebook-sized window. Update the shell snapshots and the perf baseline.
5. Update the store listing with tablet and large-screen screenshots, if wanted.

**Decisions this needs before planning:** whether phones stay portrait-only (allowed as a runtime preference) or rotate freely, and the landscape layout design for the play screen.

Plans:

- [ ] TBD (promote at the start of the next milestone via /gsd-review-backlog or /gsd-new-milestone)

### Phase 999.18: Updated screenshots for the store listing and the website (PROMOTED → Phase 98)

> **Promoted 2026-10-03 into milestone v2.4** as SHOTS-01..03 (Phase 98, the last phase, after large-screen support and the flavour text). Kept here for its planning context until v2.4 closes. Not a runnable backlog item, do not queue it.

**Goal:** the Play Store listing and darktierstudios.com show the current game (2.3+): the Play Games names on the board, SIGN IN, the new spells and the current HUD and rail.

**Where they live:**

- **Play listing:** `store-listing/screenshots/` (`phone/`, `tablet-7in/`, `tablet-10in/`), described in `store-listing/LISTING.md`.
- **Website:** `C:/projects/darktier-studio/public/assets/delve-die-repeat/shots/*.webp`, listed in `src/pages/delve-die-repeat/index.astro` (the `ddr-shots` section, each image with alt text), plus `featured.webp`.

**Scope:**

1. Pick a shot list with the user: title, combat with damage lines, the leaderboard with Play Games names, the Hero tab, a store, spells and the map.
2. Capture them on the Pixel 7 debug build. Use the dev row (debug builds only) to reach deep floors; hide the dev chip, or use normal runs.
3. Export them to the Play size rules and to webp for the site. Update the alt text.
4. Upload them to Play Console (listing) and deploy the site.

**Related:** 999.17 (large-screen support) needs real tablet and landscape shots. If both land in the same release, shoot the tablet sizes after 999.17.

Plans:

- [ ] TBD (promote via /gsd-review-backlog or /gsd-new-milestone)

### Phase 999.19: A Joiner's Stealth crit is logged as the hero's (bug, user 2026-10-02)

**Report (Play release 2.3.0):** "When my Dwarf Samurai landed a crit strike with a katana it shows 'Unseen strike' and (stealth) in the combat rail."

- The hero does NOT have the Stealth skill; the user checked the Hero tab.
- A Thief Joiner was present (the user said "cutpurse": a Cutthroat or Cutpurse-ability Joiner).
- It was NOT the hero's first hit of the fight.

**Likely cause:** the Joiner's opening-blow Stealth crit (`memberStrike`, or a Cutthroat first-blow crit) emits `stealthStrike` without `member`, or the rail renders it as the hero's. `src/browser/narrationLines.js:1678` reads "Unseen strike — critical." when `e.member` is missing. `engine/combat.js` ~990-1003 is the hero's own Stealth branch (it requires `skill(c,"Stealth")`). **Diagnosis (gsd-debugger, 2026-10-02): NOT reproduced as a mis-attribution.**

- The "(stealth)" tag comes only from the hero's own Stealth crit (combat.js:997-1001, `critBy:"stealth"`).
- A Joiner's Stealth line is always named ("<Joiner>: unseen strike, critical.").
- Thief Joiners can never have Stealth (THIEF_SKILLS has none).
- A 3,400-fight sweep with a no-Stealth hero produced 0 hero-voiced stealth lines.
- The exact pair reproduces ONLY for a hero WITH Stealth in non-Plate armour, on the first LANDED blow (misses don't count as the opener).
- Hero tab rendering matched `c.skills` in 300/300 cases.
- Open: confirm against the user's save (Hero tab Special skills list, armour worn, Joiner name and sub).
- Optional rulings:
  - name the skill in the hero line;
  - credit Stealth only when it changed the outcome (a Katana crits 19-20 anyway, so only 18 is Stealth's);
  - give allyStruck its own critBy.

Regression pins are specified in the diagnosis: a no-Stealth sweep, Joiner `member` always set, no Thief Stealth, and Plate/Katana rows.

**Fix scope:**

- Every Joiner crit event carries the member's name, and the Oracle and rail say whose blow it was.
- Add a test that a hero without Stealth never gets a hero-voiced stealth line.
- Also check the "(stealth)" crit-source tag on the rail.

Plans:

- [ ] TBD (next release; promote via /gsd-review-backlog or /gsd-new-milestone)

### Phase 999.20: Tell apart an ability on cooldown, one that can't be used, and one not in effect (PROMOTED → Phase 94)

> **Promoted 2026-10-03 into milestone v2.4** as ASTATE-01..05 (Phase 94). The optional fifth Active state and the same states on spells are deferred to Future Requirements. Kept here for its planning context until v2.4 closes. Not a runnable backlog item, do not queue it.

**Ask (user, on 2.3.0):** "Differentiate an ability that is on cooldown from one that is not usable and one that is not active. Some sort of color difference."

**Context:**

- `src/browser/combatMenu.js` renders every unavailable ability or spell row with one disabled style. Examples: a 91.1 cooldown ("ready again N rounds after use"), a once-a-fight ability already spent, a gate such as notWielded or a single-foe-only rule, a spell with no charges.
- Rows stay tappable; a tap lands the refusal reason in the log (see the comments around lines 8, 53, 165-188, 294).
- Active or in-effect abilities (Taunt, Brace, Mark, buffs) are shown by chips elsewhere.

**Scope:**

1. Define three or four visual states, each with its own colour token plus a non-colour cue (an icon or label) for accessibility:
   - **Ready.**
   - **Recharging:** on cooldown, with "ready in N" (a round countdown).
   - **Can't use now:** the gate's reason, e.g. "no foe in reach" or "needs a weapon".
   - **Spent this fight:** once a fight, already used.
   
   Optionally a fifth: **Active**, the effect already running, e.g. Taunt is up.

2. Engine: expose the reason category and the rounds left on each ability row's `enabled` data, if it isn't already there.
3. Apply the same states to spells (no charges, school-gated) where it fits.
4. Light and dark themes, readable for colour-blind players (not hue alone), with shell snapshot and a11y tests.

Plans:

- [ ] TBD (promote via /gsd-review-backlog or /gsd-new-milestone)
