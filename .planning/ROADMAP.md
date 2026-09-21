# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (shipped 2026-09-16, device UAT batch closed; see `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.4 Combat & Map Screens** — Phases 34–35 (shipped 2026-09-16, device round closed 2026-09-17; see `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.5 Meaningful Choices — Spells, Gear & Abilities** — Phases 36–43 (code-complete 2026-09-18, archived 2026-09-19; 140-check Pixel 7 UAT batch pending on its own track against a post-quick-task debug APK; see `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-MILESTONE-AUDIT.md`)
- ✅ **v1.6 Shell Debt & Dead Code** — Phases 44–49 (code-complete 2026-09-20, archived 2026-09-20; 26-check Pixel 7 UAT batch + the v1.5 140-check batch pending on APK `c0cdbae`; see `.planning/milestones/v1.6-ROADMAP.md`)
- 🚧 **v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve** — Phases 50–55 (started 2026-09-20)
- 📋 **v1.0 launch tail** — first-run tutorial (UX-06, rebuilt on the v1.6 modular shell) + Google Play production launch (STR-01..04, STR-06)

## Milestone Gates for v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve (apply to every phase — from `REQUIREMENTS.md`)

**Engine gate (applies to every requirement):** every rule change here is a *deliberate* canon divergence under the greenfield ruling (2026-09-17) — no dual-path or run-option gating; the moved parity fixtures are **measured first** (a `tools/worn-fixture-scan.mjs`-style scan listing every replay site whose comparables move), each declared with before/after in `test/parity/FIXTURE-INVENTORY.md`, and only those regenerated; `test/parity/prototype-master.js.txt` is never edited; the draw-count pins (`test/unit/foe-turn-draw-count.test.js`, `combat.test.js`) are re-pinned with the new sequences, not loosened; `npm test` fail 0 and `npm run build:www` green at every commit; the bot plays the new rules. (Phase 50's ROLL-01 fix is shell-only and out of this gate's rng/fixture scope by construction — it changes no rule.)

**Sequencing gate:** Phase 50 (the character-roller display bug) is independent of every rule change and lands first purely to stay out of the way of the engine waves. The remaining phases land in the order INIT → CAD/DMG → JOIN → BAND/TUNE, and the retune is measured only after the earlier rule phases are on master — each of them moves floors 1–7 by itself, and the curve must be tuned once, on the corrected cadence, not twice.

**Measurement gate:** every phase that changes a rule records a bot readout BEFORE and AFTER under identical parameters (`tools/tune-difficulty.mjs --seeds=200` solo + `--party`; `tools/tune-classes.mjs` matrix or its smoke) in `docs/DIFFICULTY-RETUNE.md`, so the four-band phase inherits a known baseline. (Phase 50 needs no bot readout — it changes no rule.)

## Phases

### v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve (Phases 50–55) — IN PROGRESS (started 2026-09-20)

- [x] **Phase 50: Character Roller Fix** - The character the roller's reels reveal is exactly the character that lands on the Hero tab — no second roll, no stale pending state, no label drift; shell-only, engine/fixtures untouched (completed 2026-09-20)
- [x] **Phase 51: Initiative Once Per Combat** - Initiative rolls once in `startCombat`/`fight`, the per-round re-roll is deleted so a foe never takes two turns back to back, and the result is narrated once per fight in the Oracle and fight log (completed 2026-09-20)
- [x] **Phase 52: Foe Cadence & Damage Curve** - A foe swings its ordinary attack count once per round (never stacked with a firing ability), the Bat/Rat and China Wolf floor-5 fights are re-measured in band, and every flat-damage cliff (Herman's 25 × multiplier) is smoothed by a bot-audited damage curve (completed 2026-09-20)
- [x] **Phase 53: Joiner Level Cap** - A Joiner's level never exceeds the floor it's met on (promoted from backlog 999.2), with the level-shallower fixtures declared/regenerated and the early-Joiner power shift measured (completed 2026-09-20)
- [ ] **Phase 54: Four-Band Retune & Roster Decision** - `engine/difficulty.js` is reshaped toward the four recorded bands (Filter 1–4 / Wall 5–8 / Breakaway 9–15 / Endgame 16–20, average run ends floor 5–7), and the tier-3/5 roster (Herman, Drarl, Vampire, Djinni) gets a recorded per-creature decision
- [ ] **Phase 55: Human DR Round** - The twice-deferred human verdict (TUNE-07 → TUNE-09) runs once on the Pixel 7 against the post-retune debug APK, and the milestone closes on the recorded result

<details>
<summary>✅ v1.6 Shell Debt & Dead Code (Phases 44–49) — CODE-COMPLETE 2026-09-20, archived 2026-09-20 (Pixel 7 UAT batch pending: 26 checks + the v1.5 140)</summary>

Full details: `.planning/milestones/v1.6-ROADMAP.md`. Audit: `.planning/milestones/v1.6-MILESTONE-AUDIT.md`.

- [x] **Phase 44: Retire the Classic Engine from the Shell** - The 16 dead pre-extraction mirrors and everything only they reach are gone from `mazeworld.html`, the Hero dossier reads `content/flavor.js`, and the drift-tripwire tests guard `engine/`/`content/` instead — expect −2k lines, zero engine bytes (completed 2026-09-19)
- [x] **Phase 45: Collapse the Phase 37 Hedges** - One worn-model path everywhere: every `newRun` creates `c.worn`, every load reconciles unconditionally, no `wornSlots` option anywhere; the fixtures that move are measured, declared and regenerated — the milestone's only fixture-moving phase (completed 2026-09-19)
- [x] **Phase 46: Honest Names, Dead Exports & the Tutorial Decision** - `toasts.js` becomes `narrationLines.js` with exports named for what they do, `winGame`/`state.won` and the dead toast-lifetime exports are deleted, no identifier is named after a retired mechanism, and `tutorial.js` is decided (delete or park), one rename per commit (completed 2026-09-19)
- [x] **Phase 47: Shell Modularisation** - The Gear tab, Hero tab and Store screen render from `src/browser/gearTab.js` / `heroTab.js` / `storeScreen.js` with source-pin tests; `mazeworld.html` is a mount point (5,621 lines, re-baselined from the < 5,000 target by user ruling) with the `window.__mz*` bridge listed in one place (completed 2026-09-19)
- [x] **Phase 48: Stale Docs, Comments & Test Names Purge** - Every comment, `docs/*.md` page, `.claude/CLAUDE.md` row and test name describes the game as it is — D-pad, toasts-as-UI, dead classic mirrors, `wornSlots`, retired counters and iOS rows are gone, proven by a recorded grep list over the final layout (completed 2026-09-20)
- [x] **Phase 49: Measure-First Perf Pass** - `paint()` re-render and `draw()` per step are measured on the Pixel 7 and recorded in `docs/PERF-BASELINE.md`; only a measured ≥ 16 ms hotspot or user-confirmed jank gets code — otherwise the phase closes with the numbers and no diff (completed 2026-09-20)

</details>

<details>
<summary>✅ v1.5 Meaningful Choices — Spells, Gear & Abilities (Phases 36–43) — CODE-COMPLETE 2026-09-18, archived 2026-09-19 (Pixel 7 UAT batch pending: 140 checks)</summary>

Full details: `.planning/milestones/v1.5-ROADMAP.md`. Audit: `.planning/milestones/v1.5-MILESTONE-AUDIT.md`.

- [x] **Phase 36: Balance Foundation, Effect Timers & Small Independent Wins** - The BEFORE class-matrix pin is captured before any new power lands, a general-purpose effect/cooldown/timer model exists for later phases to build on, dead foes can never be targeted, Cutthroats can accept (and occasionally lose) a Joiner, and any hero can dismiss one from the Company panel. (completed 2026-09-17)
- [x] **Phase 37: Equipment Slot Model & eff() Refactor** - One worn item per slot type, with a narrated migration for any old save that illegally has two — the widest-blast-radius change in the milestone, landed alone. (completed 2026-09-17)
- [x] **Phase 38: Melee Active Abilities** - Fighters and Thieves get a rolled pool of class-flavored active abilities with cooldowns, plus select passive skills converted to actives, all surfaced in the combat ABILITIES submenu. (completed 2026-09-18)
- [x] **Phase 39: Gear, Magic Items & One-Shot Tools** - Weapons/armor are rebalanced for real trade-offs, every activatable magic item follows one use-effect-cooldown model, and rope/ladder/torch give players a consumable answer to a specific hazard each. (completed 2026-09-18)
- [x] **Phase 40: Spell Rework** - Combat spells are differentiated by niche instead of a damage ladder, every utility spell has a felt effect, every Wizard sub-class starts with a damage spell, Detect Magic is renamed and time-boxed, and scribed scrolls are instantly castable. (completed 2026-09-18)
- [x] **Phase 41: Terrain, Darkness & Phobias** - Water squares cost extra movement and can scare swimmers, a dark square fogs the view to a 3×3 window, and every phobia has a real, once-per-entry trigger. (completed 2026-09-18)
- [x] **Phase 42: Flee Retune & Consolidated Balance Close** - Flee odds are lower and shown transparently, and the ONE consolidated AFTER class-matrix run verifies abilities + gear + spells together against the depth-20 target. (completed 2026-09-18)
- [x] **Phase 43: Clarity Pass** - Every costly line names its cause, every loot offer shows who can use it, ration math is honest, and the Gear screen splits into ON YOU and BAG. (completed 2026-09-18)

</details>

<details>
<summary>✅ v1.4 Combat & Map Screens (Phases 34–35) — SHIPPED 2026-09-16 (device round closed 2026-09-17)</summary>

Full details: `.planning/milestones/v1.4-ROADMAP.md`.

- [x] Phase 34: Combat Screen Rebuild - The encounter panel becomes the mock's full-screen layout (header, foes, YOUR LOT, › log, four-action bar with submenus), with the Fight! gate and the loot/flee/death endings folded into the same screen, engine untouched, validated on the Pixel 7. (completed 2026-09-16)
- [x] Phase 35: Map Screen Rebuild - The map tab becomes the mock's column: HUD + condition chips, tap-to-step viewport (no D-pad), the bottom rail that replaces every toast and carries every decision, the major overlay for encounters/descents/death, and the MARKS/CENTRE/MAKE CAMP chips with their sheets — engine untouched, validated on the Pixel 7. (completed 2026-09-16)

</details>

<details>
<summary>✅ v1.3 Feel, Loot & Combat Flow (Phases 28–33) — SHIPPED 2026-09-16 (device UAT batch pending; UIF-04 dropped to UX-06)</summary>

Full details: `.planning/milestones/v1.3-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.3-phases/`.

- [x] **Phase 28: Armor Integrity & Durability** - Armor behaves exactly as the screen says: the soak-vs-wear rule is audited and decided, durability lives on the item, and every armor outcome is legible (completed 2026-09-15)
- [x] **Phase 29: End-of-Combat Loot & Bag Cap** - Foe drops become a real, presented decision after combat, gated by one consistent bag-cap system, with bigger bags as a treasure path (completed 2026-09-15)
- [x] **Phase 30: Combat Narrative & Input — Research** - A written, decision-ready survey of combat-feedback UI patterns exists, with a recommended design for this game's combat flow agreed before any implementation begins (completed 2026-09-16)
- [x] **Phase 31: Combat Start Gating & Effect Hygiene** - Combat only truly starts on Fight!, every refusal explains itself, and every consumable/condition behaves and expires honestly (completed 2026-09-16)
- [x] **Phase 32: Combat Narrative & Input UI Build** - The chosen combat-feedback design is built — round narrative in one place, one-tap move-on, decision buttons safe from D-pad thumb-spam — then proven on-device (completed 2026-09-16)
- [x] **Phase 33: UI Feel & Store Polish** - Gear panel, map, tutorial toggle, toolbar layout, and store stock all get their remaining polish pass, done once against the finished combat UI (completed 2026-09-16)

</details>

<details>
<summary>✅ v1.2 Class Pass & Mass Playtest (Phases 22–27) — SHIPPED 2026-09-15 (override closeout: TUNE-07 deferred by user)</summary>

Full details: `.planning/milestones/v1.2-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.2-phases/`.

- [x] **Phase 22: Class-Aware Harness & BEFORE Matrix** - Force any class/sub-class/race through the bot with a sub-class-aware policy, print a ranked 144-combo matrix, and capture the BEFORE snapshot before any identity change lands (completed 2026-09-14)
- [x] **Phase 23: Casters Can Act** - Fix the three "cannot act" states and guarantee every fresh Magic User a day-one attack spell (completed 2026-09-14)
- [x] **Phase 24: Every Sub-class and Race: One Good, One Bad** - Every sub-class and race gets a code-verified good and bad, flavor text matches the mechanics, and an identity-contract test proves it (completed 2026-09-14)
- [x] **Phase 25: Nothing Happens Silently (Feature Feedback)** - Every class/sub-class/racial feature that fires or blocks is narrated in the Oracle and as a toast; enemy hits are unmistakable from player hits/misses (completed 2026-09-15)
- [x] **Phase 25.1: Device Feedback Batch** - Card only for decisions/big updates, minor events toast-only, Oracle fills the screen, Joiner swap with snark, Joiners fight by class, camp refusal states the numbers (completed 2026-09-15)
- [x] **Phase 26: Mass Playtest & Class-Pass Ledger** - An AFTER matrix on the post-pass engine ranks over/under-performers with a fun-band verdict per row, committed to `docs/CLASS-PASS.md` (completed 2026-09-15)
- [x] **Phase 27: Delve-to-Death Retune** - The deferred TUNE-04 re-attempt on the corrected player power, closed by a human DR round on the Pixel 7 (completed 2026-09-15; TUNE-07 verdict deferred by user)

</details>

<details>
<summary>✅ v1.1 Monster Balancing & Abilities (Phases 17–21) — SHIPPED 2026-09-14 (override closeout: TUNE-04 retune deferred)</summary>

Full details: `.planning/milestones/v1.1-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.1-phases/`.

- [x] **Phase 17: Fixture Inventory & Foe-Turn Refactors** - Document which bestiary creatures each parity fixture rolls and extract shared foe-turn helpers before any bestiary or ability behavior changes land (completed 2026-09-13)
- [x] **Phase 18: Bestiary Rebalance & Canon Combat Fixes** - Review every creature's stats against its intended depth band and land canon-accurate combat modifiers (armor, half-damage, type multipliers, slow) (completed 2026-09-13)
- [x] **Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance** - Foes cast, drain, debuff, heal, and summon via a data-driven ability system; the player's Intelligence resists incoming foe magic (completed 2026-09-14)
- [x] **Phase 20: Parley Balance & Language System** - Fix parley's payout/spam dominance and wire Language/Helm-of-Knowledge fluency into the same bonus term (completed 2026-09-14)
- [x] **Phase 21: Consolidated Difficulty Retune** - The ONE retune across party power, economy, monster power, ability threat, and parley numbers, closed out by a human DR-round sign-off (completed 2026-09-14)

</details>

<details>
<summary>✅ v1.0 Delve, Die, Repeat (Phases 1–16 + 04.1/04.2) — SHIPPED 2026-09-13 (internal testing)</summary>

Full details: `.planning/milestones/v1.0-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.0-phases/`.

- [x] Phase 1: Engine Extraction & Determinism (10/10 plans) — completed 2026-09-08
- [x] Phase 2: Android Packaging & Native Persistence (4/4 plans) — completed 2026-09-08
- [x] Phase 3: Endless Descent & Difficulty Balance (3/3 plans) — completed 2026-09-08
- [x] Phase 4: Mobile Presentation, Controls & Onboarding (10/11 plans + DR1–DR18) — 04-10 tutorial carried forward (UX-06)
- [x] Phase 04.1: Rules Review & Wiring (6/6 plans) — completed 2026-09-09
- [x] Phase 04.2: Bug Fixes & Text Polish (5 batches) — completed 2026-09-09
- [x] Phase 5: Voice, Content & Graveyard (3/3) — completed 2026-09-09
- [~] Phase 6: Google Play Compliance & Launch — store entry + internal-testing track live 2026-09-10 (STR-05 ✓); production launch carried forward (STR-01..04, STR-06)
- [x] Phases 7–11: Joiners / Party System — completed 2026-09-09 (PARTY-10 retune carried forward)
- [x] Phases 12–16: Economy & Item Balancing — completed 2026-09-10 (deep tuning carried forward)

</details>

## Phase Details

### Phase 50: Character Roller Fix

**Goal**: The character the roller screen reveals (race / class / sub-class reels, name, quirk) is exactly the character that lands on the Hero tab — no second roll, no stale pending state, no label drift.
**Depends on**: Nothing (first phase of v1.7; independent of every rule change in the milestone — landed first only to stay clear of the engine waves).
**Requirements**: ROLL-01
**Note**: from todo `.planning/todos/pending/2026-09-20-roller-reels-do-not-match-the-hero-tab-character.md` (tag `resolves_phase: 50` once this roadmap is approved — not edited by the roadmapper).
**Success Criteria** (what must be TRUE):

  1. A source-pin/unit test proves the committed state's `characterSheetViewModel` labels (race/class/sub-class/name/quirk) equal the reel labels shown at reveal — the reel lock and the CTA commit read the same object (`rollerPendingState`), not a captured `sheet`.
  2. Re-entry is guarded: a resolved `startNewRun()` from a superseded roll (double-tap on the roll trigger, Play-again from a death mid-reveal) is ignored, pinned by a test that fires two rolls and asserts only the second's state ever reaches the Hero tab.
  3. A manual repro pass (roll → note the three locked reels + name → DESCEND → compare the Hero tab; repeated with a double-tap and with Play-again from a death) shows zero mismatches, recorded in the phase summary.
  4. `engine/`, `content/`, parity fixtures and the master hash are untouched — the fix is shell-only (`mazeworld.html`, `src/browser/viewModels.js`, `src/browser/heroTab.js`, `src/browser/engineAdapter.js`).

**Plans**: 3 plans (waves 1 → 2 → 3, sequential — `mazeworld.html` is touched only in wave 3)

Plans:
**Wave 1**

- [x] 50-01-PLAN.md — `src/browser/roller.js` (`createRoller`: monotonic roll token + serialized `startNewRun()` chain + reels/CTA reading the one pending state) and `test/unit/roller.test.js` (SC1 identity, SC2 supersede races, serialization, CTA gating, module pins); shell untouched

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 50-02-PLAN.md — `tools/roller-repro.mjs` (dependency-free headless-Chrome CDP driver: normal / double-tap / Play-again-from-death / mid-reveal) and the BEFORE table against the unfixed shell

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 50-03-PLAN.md — the `mazeworld.html` mount swap (`window.mzStartRoll = roller.start`, `commitRolledState` as `onCommit`, inline roller deleted), pin re-homes + mount pins, bridge strings + `docs/SHELL-MODULES.md`, the AFTER repro table, gates (build:www → npm test → boot:check), fence, SUMMARY with the deferred Pixel 7 checks

### Phase 51: Initiative Once Per Combat

**Goal**: Initiative is fixed for the whole fight and visible to the player — the foe can never take two turns back to back.
**Depends on**: Phase 50 in sequence only (no causal dependency). Sequencing gate: lands before every other rule-changing phase (INIT → CAD/DMG → JOIN → BAND/TUNE).
**Requirements**: INIT-01, INIT-02
**Success Criteria** (what must be TRUE):

  1. `rollInitiative` fires exactly once per combat (from `startCombat`/the `fight` action); the per-round re-roll at `engine/combat.js:1341` is gone, pinned by a zero-draw assertion in `foe-turn-draw-count.test.js`.
  2. A scenario where the foe would have won a fresh second-round roll now alternates player/foe turns for the whole fight — no back-to-back foe turns — proven by a determinism/unit test.
  3. One narrated line ("Initiative — you N, them M. You go first.") appears exactly once per fight in the Oracle and the fight log, pinned by a test that fails on a second appearance.
  4. Samurai / slow / foresight / Acute Hearing overrides still apply to the single roll, proven by their existing tests re-targeted at the new call site.
  5. The p.24 divergence is declared in `test/parity/FIXTURE-INVENTORY.md` with before/after; only the measured fixtures are regenerated; the prototype master hash is unchanged.

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 51-01-PLAN.md — Measure first: BEFORE bot readout on the phase-start commit + `tools/initiative-fixture-scan.mjs` (MOVED SET measured, output committed) — zero engine bytes

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 51-02-PLAN.md — Engine cut (initiative once in `fight()`, `resolveInitiative`, `combatJoined.mine/theirs/why/foe`, afterPlayerAction re-roll + second foe turn deleted) + every draw pin re-pinned + SC1/SC2 pins + the three moved fixtures declared/regenerated + FIXTURE-INVENTORY Phase 51 + AFTER bot readout

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 51-03-PLAN.md — INIT-02: the once-per-fight initiative line in the Oracle and fight log (dice in .roll spans, in-voice verdict per override) + SC3 once-per-fight pin

### Phase 52: Foe Cadence & Damage Curve

**Goal**: Every foe attacks an honest, countable number of times per round, and no single hit can spike past a smooth depth-scaled damage curve.
**Depends on**: Phase 51 (cadence is measured on the corrected initiative, so no foe turn is inflated by a phantom double-turn).
**Requirements**: CAD-01, CAD-02, CAD-03, DMG-01, DMG-02
**Success Criteria** (what must be TRUE):

  1. A plain foe swings once per round, an `sp.atk: 2` foe swings twice, and a frenzied foe doubles its own swing count — each pinned by a dedicated unit test.
  2. When a foe ability fires (bolt/drain/debuff/heal/summon/frost…), a resolver test proves that turn contains the ability and zero ordinary swings — the Stalka Beast two-hits-plus-frost log is provably impossible.
  3. A bot readout records attacks-per-player-action for the Bat/Rat and China Wolf floor-5 fights at ≤ the foe's `sp.atk` (≤2× if frenzied), committed in `docs/DIFFICULTY-RETUNE.md`.
  4. A committed script reports max single-hit damage by depth for every bestiary foe and flags any hit ≥ 60% of a level-appropriate character's max HP; every flagged row (Herman's floor-5 crit among them) is fixed and re-measured clean.
  5. Every damage-curve fix carries a before/after row in `content/BESTIARY-REBALANCE.md`; any moved parity fixtures are measured, declared and regenerated per the engine gate.

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 52-01-PLAN.md — Zero engine bytes: CAD-01/02/03 pins (`test/unit/foe-cadence.test.js` — swing counts, the Stalka ability-replaces-swings resolver, attacks-per-player-action invariant) + per-kit notes in `content/foe-abilities.js` + `tools/cadence-audit.mjs` (Bat/Rat + China Wolf at depth 5, output committed) + `tools/damage-curve-audit.mjs` with the BEFORE section (`--rule=whole`)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 52-02-PLAN.md — One executor, one green commit: a foe crit doubles the dice, not the `lvl² + dmgBonus + dice` sum (`foeLevelBase` + hero/member/pursuit sites) + Herman `sp.strikesAs: 5` + crit re-pins + DMG-02 pins + the measured moved parity set declared/regenerated (predicted: `combat.json#lose` only) + Phase 52 guard + yardstick AFTER block; then FIXTURE-INVENTORY/BESTIARY-REBALANCE Phase 52 records, the AFTER damage-curve section, and a decision checkpoint on the rows still flagged (trim now vs hand to Phase 54 TUNE-08)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 52-03-PLAN.md — Apply the checkpoint ruling (fix rows or explicit per-row rulings, never silent) + AFTER bot readout under Phase 51's flags (`v17-p52-after-smoke.json`) + the `### v1.7 · Phase 52 — cadence & damage curve` ledger H3 (BEFORE by reference to 608a0e5, AFTER, Reading table, cadence quote, flagged rows) + gates

### Phase 53: Joiner Level Cap

**Goal**: A Joiner's level never exceeds the floor it is met on, so early floors stop handing the player a free deep-tier ally.
**Depends on**: Phase 52 (cadence and damage are settled so the Joiner-power bot smoke measures against a stable combat baseline, not one about to move again).
**Requirements**: JOIN-02, JOIN-03
**Note**: promoted from backlog 999.2 (formerly `.planning/phases/999.2-joiner-level-capped-by-floor-depth/`, now retired — superseded by this phase).
**Success Criteria** (what must be TRUE):

  1. `meetJoiner`'s rolled level is clamped `lvl = min(rolled, state.floor.depth)` with the same one-d10-then-two-d20 draw sequence, pinned by a test showing a level-5-rolled Joiner met on floor 2 arrives as level 2 with an unchanged draw count.
  2. `grantLevelAbilities` and the `20 * lvl + d20` wp formula both receive the capped level — a floor-2 level-capped Joiner's abilities and wp match a natively-rolled level-2 Joiner, pinned by test.
  3. `joinerMet`/`joinerRefused` narration and the rail card render unchanged (the capped `lvl` rides the existing payload shape) — no copy/shape diff, pinned by a snapshot test.
  4. Only the fixtures that meet a Joiner on a floor shallower than its rolled level move; each is declared with before/after in `FIXTURE-INVENTORY.md` and regenerated; every other fixture and the master hash are untouched.
  5. A `tune-classes` smoke before/after records the early-Joiner power shift in `docs/DIFFICULTY-RETUNE.md`.

**Plans**: 2 plans

Plans:
**Wave 1**

- [x] 53-01-PLAN.md — One executor, one green commit: `meetJoiner` clamps the Level Table roll to the floor (`Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1], state.floor.depth)`, draw sequence untouched) + the Joiner-test triage/re-pins + `test/unit/joiner-level-cap.test.js` (SC1 cap/draw-count, SC2 abilities/wp == native level-2 twin, SC3 narration/payload/rail-card snapshot) + the MEASURED moved parity set (scan Part B re-run, parity suite, Joiner-exposure replay — predicted zero) declared in a FIXTURE-INVENTORY.md Phase 53 section + the JOIN-02 MOVED SET guard

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 53-02-PLAN.md — AFTER bot readout on the 53-01 commit under Phase 52's exact flags (solo, `--party`, `v17-p53-after-smoke.json`) + the `### v1.7 · Phase 53 — Joiner level cap` ledger H3 (BEFORE by reference to 049ab50, AFTER, Reading, the `--party` shift declared by design with a forced-ally level histogram, class-smoke identity as the solo-play-untouched evidence) + gates

### Phase 54: Four-Band Retune & Roster Decision

**Goal**: `engine/difficulty.js` is reshaped toward the four recorded bands so the average run ends floor 5–7, and the open tier-3/5 roster question is closed with a recorded per-creature decision.
**Depends on**: Phases 51–53 (every earlier rule phase moves floors 1–7 on its own; the curve is tuned once, on the fully corrected cadence/damage/Joiner baseline).
**Requirements**: BAND-01, BAND-02, BAND-03, TUNE-08
**Success Criteria** (what must be TRUE):

  1. `docs/DIFFICULTY-RETUNE.md` records the four bands verbatim (Filter 1–4 / Wall 5–8 / Breakaway 9–15 / Endgame 16–20) as numeric targets: median death depth 5–7, p90 ≈10–13, reach-16 a few percent, reach-20 well under 1%.
     *Note (2026-09-21, USER RULING C — 54-CONTEXT.md `## USER RULING C`): BAND-01's numeric targets are superseded mid-phase by the user's per-floor survival curve (p_L / S_L per floor 1–25; pass bands ±8 pts S_L on 1–10, ±3 pts on 11–19, reach-20 3–5 %); the ledger keeps this table as history marked SUPERSEDED and records the curve verbatim as the live target. REQUIREMENTS/ROADMAP wording is updated by the orchestrator.*

  2. `difficultyCurve` is reshaped — identity-ish through floor 4, a step at 5–8, an eased slope through 9–15, steepened 16–20, breather floors kept, `DENSITY_CANON_THROUGH_DEPTH = 2` respected — with every dial change cited against a bot readout that moved toward the bands.
  3. The AFTER bot readout (`tune-difficulty --seeds=200` solo + `--party`, plus the class matrix) lands inside the BAND-01 numbers, or each miss is recorded with its untaken rung and reason; the ledger's change table has one row per constant with before/after.
  4. The tier-3/5 roster decision (Herman, Drarl, Vampire, Djinni) is recorded per creature — stays, moves tier, or is retuned — with the forced-20 untaken rungs (floors gained p50 0 / mean 0.84, reach ≥ 20 0.1%) named as a deliberate shape, not residue; any parity divergence is declared.
  5. No flat-damage nerf is used to chase the median; `npm test` and `npm run build:www` stay green throughout.

**Plans**: 7 plans (54-01 complete; 54-02 / 54-03 SUPERSEDED by USER RULING D 2026-09-21 — left on disk as history, never executed further; 54-04..54-07 are the live plans)

Plans:
**Wave 1**

- [x] 54-01-PLAN.md — The four bands verbatim + numeric targets + the structural bound (reach ≥5 fixed by floors 1–4 — why a Filter rung exists, USER RULING A) in the ledger H3 (BAND-01); band-curve scaffolding in `engine/difficulty.js` at identity values (`WALL_*` / `BREAKAWAY_*` / `ENDGAME_CANON_FROM_DEPTH`, `bandFoePowerFor`, literal 1 from 16) with the curve pinned byte-identical to Phase 53's; the always-on `Four-band readout` block in `tune-difficulty` (bot policy untouched); the BEFORE `--start-depth=20` slice on the untouched engine; the BAND-02 measured-zero guard (completed 2026-09-21; its 16+ identity pins and numeric-targets table are superseded by USER RULING C in 54-02)

**Wave 2** *(SUPERSEDED — USER RULING D, 2026-09-21: the floor-range ladder was halted after rung 5 at `1cb56c6`; rungs 1–5 stand in history; this plan is not executed further)*

- [~] 54-02-PLAN.md — SUPERSEDED (USER RULING D). Original scope: RE-PLANNED under USER RULING C (2026-09-21, mid-ladder; rungs 1 `b0facb6` and 2 `850f176` stand): the `Per-floor survival` readout block (p_L / S_L per floor vs the 25-row target, verdict line — report-only, bot untouched); the ledger's Ruling C target section (verbatim) + the retro Rung 2 section; the per-floor KNOT table in `engine/difficulty.js` (floors 2–4 individually dialable, Endgame 16–20 dialable below 1.0, hazard knots per band, 21+ ramp relative to floor 20; landed at rung-2 values, curve byte-identical; 16+ identity pins retired, floor 1 parity-exact); rungs 3..6 (cap 6) as deterministic FITS from the previous rung's p_L table (`f_K = clamp(1 − Δp/100, 0.6, 1.25)`, hazard knots on hazard share ≥ 15 %), each a green constants commit + the FULL four readouts on that commit (`--start-depth=20` now a p_L readout vs 84.5 %) + `#### Rung N` with the fit table; stop = verdict empty / rung 6 / floor-1 escalation (written for the user, not taken); starvation recorded as `food economy`, never chased; parity measured every rung and declared on the final curve (floors ≥ 2 may move fixtures — measured set), the change table (every constant incl. knots and the retired Phase 27 ramps), the per-floor miss table, the depth-20 p_L readout, `v17-p54-after-smoke.json` (BAND-02, BAND-03, BAND-01)

**Wave 3** *(SUPERSEDED — USER RULING D: the round-damage ceiling replaces per-creature retunes; the audit / roster / addendum work is re-scoped into 54-07)*

- [~] 54-03-PLAN.md — SUPERSEDED (USER RULING D). Original scope: Damage-curve audit re-run on the AFTER curve (fold verified: `dmgBonusForBand` reads `foeDmgBonusFor(T, difficultyCurve(d))`; locked v17-p51 yardstick; both rules) + BESTIARY-REBALANCE Phase 54 addendum (cell count 65 → AFTER, every remaining row re-dispositioned, in-place retune only for a still-≥100 % one-shot at its own tier's band — the Drake, 2d10+4 → 2d8+2 per USER RULING B, `drakeBreath` untouched — declared end-to-end with post-retune readouts) + the roster decision per creature (Herman / Drarl / Vampire / Djinni record `stays` from the AFTER audit + the forced-20 slice; the Endgame shape restated as the Ruling C 16–20 segment (p_L 81 → 84.5 %) with the untaken rungs named; the `--start-depth=20` slice read as p_L, not identity; parity declared) + the phase roll-up SUMMARY (TUNE-08, BAND-02, BAND-03)

**Wave 4** *(USER RULING D — the GLOBAL DIFFICULTY MODEL; sequential on master, one plan per wave)*

- [x] 54-04-PLAN.md — Fair bot (potion 0.6 / flee 0.4 / caster 0.6 / camp 0.5 kept; accept a Joiner when the party is empty; MU defensive + offensive modes; Thief opener/flees counted; per-floor snapshots + identity tallies) + the readout blocks (three-class death split combat / dot / starvation-exhaustion; per-floor Pace; Class identity — class pools only; recorded cell spread in tune-classes) + the fresh BEFORE on the untouched engine (solo / party / class smoke / depth-20) + the ledger opener (why floor bands failed; the dial table with hook / identity / start / bounds / order / direction; the governing principle; class pools; roster note) (BAND-01)

**Wave 5** *(blocked on Wave 4)*

- [x] 54-05-PLAN.md — The global model in the engine AT IDENTITY: every floor-range constant/helper removed (export-key-set pin); the frozen `DIALS` object + harness-only `setDialsForTuning`; foe level from depth (`0.6 + 0.2·d`), whole-hit `FOE_HIT_SCALE` at the three damage sites, `FOE_HP_SCALE`, the foe-count table with the canon draw shape (level cap gone), `ROUND_DAMAGE_CEILING` (off), hero HP / regen / SP / camp-heal / dot-HP / food helpers, `ENCOUNTER_DOTS` / `HAZARD_SCALE` / `ABILITY_THREAT` / `DARK_*` / `STORE_TIER` as globals on the curve (MAZE_SIZE cut — v1.8 candidate); ONE-AND-DONE climbs/leaps + the `draggedOver` / `floorRegen` lines in voice; every pin re-measured; the identity-commit movers measured, declared, regenerated; FIXTURE-INVENTORY Phase 54 section; ledger `#### Identity commit` (BAND-02)

**Wave 6** *(blocked on Wave 5)*

- [ ] 54-06-PLAN.md — The rest of the model at identity: `LOOT_SCALE` (four coin sites), `STORE_TIER`'s store consumer, `CLASS_MITIGATION` (three rows — Fighter ABSORB / Thief AVOID / Magic User CHOOSE — seven hooks, the manual knob), `FOE_ACCURACY`, `DOT_MIX` / `FIGHT_SHARE` post-roll remap, `WANDER_RATE`, the exposed-at-canon dials (`TIER_SPREAD`, `FLEE_NEED_MOD`, `PARLEY_NEED_MOD`, `STARTING_GOLD`, `STARTING_POTION_BONUS`) — same draw counts, parity measured; the fit tool `tools/fit-difficulty.mjs` + `tools/lib/fit-score.mjs` (in-process worker-threaded evaluation, Ruling C S_L score on floors 1–12, class-pool fairness + identity constraints, JSONL log, resumable bounded coordinate search over `SEARCH_PLAN` = the CORE 10 coordinates only — every other dial held at its start value) + `fit/start.json` (BAND-02)

**Wave 7** *(blocked on Wave 6)*

- [ ] 54-07-PLAN.md — The FIT (budget 80, 4 workers, 200 seeds, from `fit/start.json`; the CORE 10 coordinates in two passes, every other dial held; objective = floors 1–12; the manual-notch rule ≤ 2) → `DIALS` shipped at the evaluated values with the log as evidence; every pin re-measured; the fitted parity set declared + regenerated; the full AFTER (solo / party / class smoke → `v17-p54-global-after-smoke.json` / depth-20 as p_L) + the measured TAIL (1,000-seed solo for floors 13–20 and reach-20 vs 3–5 %; a `--start-depth=10` slice — readouts, not fitted); the damage-curve audit re-keyed to the global model (both rules); Herman / Drarl / Vampire / Djinni / Drake recorded under the ceiling (no retune, no tier move; Ruling B's Drake trim superseded); BESTIARY-REBALANCE Phase 54 addendum; the ledger close-out (Fit, AFTER per-floor table + pace + class pools + recorded spread, Change table, Miss table, Roster, Depth-20 p_L, Parity measured set) (BAND-01, BAND-02, BAND-03, TUNE-08)

### Phase 55: Human DR Round

**Goal**: The twice-deferred human verdict on the retuned game is run once, on the Pixel 7, and the milestone closes on the recorded result.
**Depends on**: Phase 54 (the retune must be on master before the device round measures it).
**Requirements**: TUNE-09
**Success Criteria** (what must be TRUE):

  1. A debug APK is built from the post-Phase-54 commit (the milestone's last wave), per the deferred-UAT protocol — one build, one batched session.
  2. The four-run Pixel 7 checklist (start-at-depth 20/35/50 plus one natural run) in `docs/DIFFICULTY-RETUNE.md` is completed in that session.
  3. Any pending UAT-batch items scheduled to ride along are run in the same sitting, per the standing deferred-UAT protocol (one batched device session at milestone close).
  4. The verdict is recorded verbatim, and the milestone closes only on a recorded "tuned" result or an explicit user-recorded deferral.

**Plans**: TBD

<details>
<summary>v1.6 phase details (44–49) — archived, see `.planning/milestones/v1.6-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, success criteria, plan lists and the milestone gates (engine gate as amended 2026-09-17, sequencing gate, standing rules) for v1.6 live in the archived roadmap, not duplicated here.

</details>
<details>
<summary>v1.5 phase details (36–43) — archived, see `.planning/milestones/v1.5-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, success criteria and plan lists for v1.5 live in the archived roadmap, not duplicated here. The v1.5 Engine Gate text (new-rng-behind-guards, comparables carve-outs, voice scan) is preserved there verbatim.

</details>

<details>
<summary>v1.4 phase details (34–35) — archived, see `.planning/milestones/v1.4-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.4 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.3 phase details (28–33) — archived, see `.planning/milestones/v1.3-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.3 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.2 phase details (22–27) — archived, see `.planning/milestones/v1.2-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.2 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.1 phase details (17–21) — archived, see `.planning/milestones/v1.1-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.1 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.0 phase details (Phases 1–16 + 04.1/04.2) — archived, see `.planning/milestones/v1.0-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.0 live in the archived roadmap, not duplicated here.

</details>

## Deferred / Not This Milestone

- **Pixel 7 UAT batches** — `docs/UAT-v1.6.md` (26 checks, from the 44–47 VERIFICATION lists) and `docs/UAT-v1.5.md` (140 checks, never run), both against APK `c0cdbae` (on the phone at v1.6 close); findings become quick tasks or a UAT gap plan, never ad-hoc edits.
- **UX-06** first-run tutorial — deliberately last; rebuilt on the Phase 47 modular shell (the reason SHELL-01..03 exist). Includes the UIF-04 on/off toggle dropped from v1.3.
- **STR-01..04/06** Google Play production launch (Data Safety audit, privacy page, listing, IARC, pricing, rollout).
- **`storeRoll` for the bots** — the tuning harness still plays the frozen store roll; **the two structural v1.5 AFTER patterns** (Magic Users gain nothing from the class-gated ability system; Wilmsry's racial edge) — both carried forward past v1.7 per `REQUIREMENTS.md`'s Future Requirements (TUNE-06/07 are now in scope this milestone as TUNE-08/09, Phases 54–55).
- Store screen restyle to the dark vocabulary (Phase 47 moves the store into `storeScreen.js` unchanged — the restyle edits that module later).
- Dice-mode setting.
- Haptics polish; the unguarded button set from 32-03 (store rows, drop shelf, `a-evt`, `btn-again`, spell menu).
- Climb dice payload (`roll`/`need` on the four climb events) — carried over from v1.4 as a post-UAT quick task.
- Shell debt noted in the v1.5 audit but not in v1.6's requirements: the unreachable parley fluency-2 branch (`canParley`'s Magical tier, `wilmsryVsMagical`) and the `railCardFor` tie-break — fold into Phase 44's orphan sweep if they fall out for free, otherwise a quick task.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 50. Character Roller Fix | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 51. Initiative Once Per Combat | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 52. Foe Cadence & Damage Curve | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 53. Joiner Level Cap | v1.7 | 2/2 | Complete    | 2026-09-20 |
| 54. Four-Band Retune & Roster Decision | v1.7 | 5/7 | In Progress|  |
| 55. Human DR Round | v1.7 | 0/? | Not started | - |
| 44. Retire the Classic Engine from the Shell | v1.6 | 4/4 | Complete    | 2026-09-19 |
| 45. Collapse the Phase 37 Hedges | v1.6 | 3/3 | Complete    | 2026-09-19 |
| 46. Honest Names, Dead Exports & the Tutorial Decision | v1.6 | 4/4 | Complete    | 2026-09-19 |
| 47. Shell Modularisation | v1.6 | 5/5 | Complete    | 2026-09-19 |
| 48. Stale Docs, Comments & Test Names Purge | v1.6 | 5/5 | Complete    | 2026-09-20 |
| 49. Measure-First Perf Pass | v1.6 | 2/2 | Complete    | 2026-09-20 |
| 36. Balance Foundation, Effect Timers & Small Independent Wins | v1.5 | 6/6 | Complete    | 2026-09-17 |
| 37. Equipment Slot Model & eff() Refactor | v1.5 | 4/4 | Complete    | 2026-09-17 |
| 38. Melee Active Abilities | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 39. Gear, Magic Items & One-Shot Tools | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 40. Spell Rework | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 41. Terrain, Darkness & Phobias | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 42. Flee Retune & Consolidated Balance Close | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 43. Clarity Pass | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 34. Combat Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 35. Map Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 28–33 | v1.3 | 16/16 | Shipped | 2026-09-16 |
| 22–27 (+25.1) | v1.2 | 31/31 | Shipped (override closeout: TUNE-07 deferred by user) | 2026-09-15 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.6 (tutorial rebuilds on the modular shell) | - |

## Backlog

### Phase 999.1: Transitions & Sounds (BACKLOG)

**Goal:** [Captured 2026-09-19 for future planning — user's words] Map the sound clips in `sfx/` (31 MP3s the user added: `walk1-3`, `walk-water1-3`, `hit1-2`, `miss1-2`, `hurt1-3`, `foe-die`, `enemy-{batrat,beast,demon,human,undead}`, `spell`, `resist`, `heal`, `drink`, `chest`, `gold`, `trap`, `jump`, `stairs`, `levelup`, `death`, `ui-tap`) to game actions and engine events; and make the shell's transitions smooth — map panning, rail show/hide, opening menu items — "not jarring and immediate". Slow the fight responses down so there are transitions between exchanges and the player can process each one. Animate on-screen text as if quickly typed out (fast, not slow). Dial back the black circle around the party marker — the party is already highlighted, the ring is too stark.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** sound = a `src/browser/sfx.js` event→clip table played through Web Audio (`AudioContext` + `decodeAudioData`, unlocked by the first tap), wired beside `hapticForEvents(events)` in the dispatch path — engine untouched, mute toggle by the settings gear, clips bundled in `www/` (Android WebView plays MP3 offline, no plugin). Transitions: the rail is a flex sibling that reflows the viewport today (see todo `2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — overlay + slide is the fix, land together); map pan goes through `cameraPan()`/`keepInViewAxis` (`src/browser/controls.js`) with no easing; `.mw-rail-new` has a 0.18 s rise (`mazeworld.html` CSS ~L707) and combat has `mwStrikePop`/`mwRoundTick` keyframes but no inter-exchange pacing in `combatPanel.js`. Typed-text effect belongs to the rail/encounter line renderers (`renderRail`, `renderEncounter`), must respect the rail hold/dismiss rules and TalkBack (`#mw-rail-live` announcer gets the full text at once). Party marker ring: `PLAYER_MARKER_ICON`/`draw()`. Sequence AFTER v1.6 Phase 47 (shell modularisation) so the effects land in the new `src/browser/` modules, not the old `paint()` bodies; each effect gets a settings-respecting reduced-motion path.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.3: Dungeon set dressing (BACKLOG)

**Goal:** [Captured 2026-09-19 for future planning — user's words] Add set dressing to the dungeon using the new optimized `icons/optimized/set_dungeon_*.png` icons (54 of them: ash pile, banners, barrels/crates/sacks, bones/skulls/skeleton, blood, book/scrolls, boulder/rocks/rubble, braziers/torches/candles/sconce, cobwebs, mushrooms/moss/fern/roots/vines, grate/hatch/pit, puddles/slime, rat, shackles, …). Use them for random dungeon set items — on walls, or on paths provided they are DIMMED so they are never confused with the real encounter icons. Set dressing only: not interactable, no rules effect, pure ambiance.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** rendering-only, engine untouched — the placement must be deterministic per floor (derive from `makeRng(hash(seed, "dressing", depth))` in the SHELL/`src/browser/` layer, never a draw off the engine's main stream, so no fixture moves and the engine stays pure), keyed off the generated grid (`engine/maze.js` cells `{ wall, seen, feat }`; walls are the majority of the 21×21 grid) and revealed with `c.seen`. Draw in `draw()` (`mazeworld.html` ~L1931; feature icons at ~L1998-2002 via `iconsApi.drawFeatureIcon(ctx, img, x, y, CELL, dir, 0.75)`) BEFORE the feature/party layer: wall items at full or near-full alpha on wall cells; path items at low alpha (≈0.3-0.4) so `featureKeyForCell` encounter icons stay unmistakable; never on a cell that has a `feat`, the stairs, or the party. Density is a tunable (a handful per floor, rarer on deep floors?). `preloadIcons("./icons/optimized")` already loads the directory — check `icons.js`'s manifest approach so 54 extra images don't slow the first paint (lazy or a sprite). Respect the 260918-vm3 stationary camera and Phase 35 map palette; a settings toggle ("set dressing off") is cheap. Land after v1.6 Phase 47 (draw code may move into a module) and alongside 999.1's party-marker frames. The raw `icons/*.png` sheets the user added (`dungeon_dressing.png`, `encounters.png`, …) are sources — only `icons/optimized/` ships in `www/`.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)
