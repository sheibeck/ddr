# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (shipped 2026-09-16, device UAT batch closed; see `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.4 Combat & Map Screens** — Phases 34–35 (shipped 2026-09-16, device round closed 2026-09-17; see `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.5 Meaningful Choices — Spells, Gear & Abilities** — Phases 36–43 (code-complete 2026-09-18, archived 2026-09-19; 140-check Pixel 7 UAT batch pending on its own track against a post-quick-task debug APK; see `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-MILESTONE-AUDIT.md`)
- 🚧 **v1.6 Shell Debt & Dead Code** — Phases 44–49 (started 2026-09-19; cleanup only — zero gameplay change; `.planning/REQUIREMENTS.md`, source proposal `.planning/proposed-milestone-shell-cleanup.md`)
- 📋 **v1.0 launch tail** — first-run tutorial (UX-06, rebuilt on the v1.6 modular shell) + Google Play production launch (STR-01..04, STR-06)
- 📋 **Next tuning pass** — TUNE-06 roster decision + TUNE-07 human DR round; `storeRoll` for the bots; the two structural v1.5 AFTER patterns (`docs/DIFFICULTY-RETUNE.md`, `docs/CLASS-PASS.md`)

## Milestone Gates for Shell Debt & Dead Code (apply to every phase — from `REQUIREMENTS.md`)

**Engine gate (as amended 2026-09-17 — greenfield, no dual paths; this milestone's reading):** no rule changes. The engine's observable behaviour — events, state, rng draw order — is identical before and after every phase. `test/parity/prototype-master.js.txt` is never edited. The ONLY fixtures that may move are the ones Phase 45 (HEDGE-03) is declared to move — regenerated with a before/after divergence record, never gated behind an option, never a blanket regeneration; every other phase leaves `engine/`, `content/`, `test/parity/fixtures/` and the master hash byte-identical (Phase 46's `winGame`/`state.won` removal and Phase 48's comment purge are the two other phases that may touch `engine/` at all, and neither moves a fixture). `npm test` fail 0 and `npm run build:www` green at every commit. The debug APK that closes the milestone is byte-for-byte the same game as the one before it, minus dead weight.

**Sequencing gate:** every phase that edits `mazeworld.html` or `engine/` (44, 45, 46, 47, 48) starts only after the five 2026-09-18/19 quick tasks — `260918-vm3` (stationary camera), `260918-vvt` (potions/scrolls bag-free), `260918-w4n` (use-activated magic items + staff-to-bag), `260918-wy1` (two jewelry slots), `260919-00d` (Cloak of Ether wall-walking) — have landed on master. **Status at roadmap creation (2026-09-19):** vm3 and vvt landed (SUMMARY + commits); w4n, wy1 and 00d have a PLAN but no SUMMARY and their engine/test edits sit uncommitted in the working tree — Phase 44 is blocked until those three land. A purge mid-quick-task would collide.

**Standing rules for this milestone:**

- Comments, doc lines and test names go with the code they described — each phase takes its own; Phase 48 is the proof sweep over the final layout, not the first pass.
- Every phase summary records the grep that proves its zero (the NAME-02 pattern) and the `wc -l mazeworld.html` at close.
- No research phases; no discuss round unless flagged on the phase (only 46 and 47 are). Verification agents stay off per config; the executor gate (tests, build, engine/content/parity diff, master hash) is the phase gate.
- One debug APK at milestone close (after Phase 49's measurements), per the deferred-UAT protocol; the v1.5 140-check batch and this milestone's 3-screen smoke run against it.

**Out of this milestone:** any gameplay or balance change; refactoring `engine/` module boundaries; a bundler/TypeScript/build step; perf work without a measurement; the store restyle; haptics; dice-mode setting; UX-06 tutorial; STR production launch; TUNE-06/07; the v1.5 Pixel 7 UAT batch (own track).

## Phases

### v1.6 Shell Debt & Dead Code (Phases 44–49) — IN PROGRESS (started 2026-09-19)

- [x] **Phase 44: Retire the Classic Engine from the Shell** - The 16 dead pre-extraction mirrors and everything only they reach are gone from `mazeworld.html`, the Hero dossier reads `content/flavor.js`, and the drift-tripwire tests guard `engine/`/`content/` instead — expect −2k lines, zero engine bytes (completed 2026-09-19)
- [x] **Phase 45: Collapse the Phase 37 Hedges** - One worn-model path everywhere: every `newRun` creates `c.worn`, every load reconciles unconditionally, no `wornSlots` option anywhere; the fixtures that move are measured, declared and regenerated — the milestone's only fixture-moving phase (completed 2026-09-19)
- [ ] **Phase 46: Honest Names, Dead Exports & the Tutorial Decision** - `toasts.js` becomes `narrationLines.js` with exports named for what they do, `winGame`/`state.won` and the dead toast-lifetime exports are deleted, no identifier is named after a retired mechanism, and `tutorial.js` is decided (delete or park), one rename per commit
- [ ] **Phase 47: Shell Modularisation** - The Gear tab, Hero tab and Store screen render from `src/browser/gearTab.js` / `heroTab.js` / `storeScreen.js` with source-pin tests; `mazeworld.html` is a mount point under 5,000 lines with the `window.__mz*` bridge listed in one place
- [ ] **Phase 48: Stale Docs, Comments & Test Names Purge** - Every comment, `docs/*.md` page, `.claude/CLAUDE.md` row and test name describes the game as it is — D-pad, toasts-as-UI, dead classic mirrors, `wornSlots`, retired counters and iOS rows are gone, proven by a recorded grep list over the final layout
- [ ] **Phase 49: Measure-First Perf Pass** - `paint()` re-render and `draw()` per step are measured on the Pixel 7 and recorded in `docs/PERF-BASELINE.md`; only a measured ≥ 16 ms hotspot or user-confirmed jank gets code — otherwise the phase closes with the numbers and no diff

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

### Phase 44: Retire the Classic Engine from the Shell

**Goal**: `mazeworld.html` carries only the live shell — the game plays identically through `engine/` with no second engine defined beside it, and nothing in the repo reads the classic script as a source of rules.
**Depends on**: Nothing in-milestone (first phase). Sequencing gate: quick tasks 260918-w4n, 260918-wy1 and 260919-00d must land first (they edit `mazeworld.html` and `engine/`).
**Requirements**: DEAD-01, DEAD-02, DEAD-03
**Baseline (2026-09-19)**: shell 8,607 lines; 16 mirror `function` definitions; classic `SUB_NOTE` at line 2442 with 13 rows drifted from `content/flavor.js`; two `new Function` extraction tests (`parley-button-mirror`, `spell-menu-mirror`); 3,200 tests.
**Success Criteria** (what must be TRUE):

  1. `grep -cE "^\s*function (castSpell|parley|startCombat|meetJoiner|genFloor|rollCharacter|descend|makeCamp|takeItem|useItem|playerStrike|foeTurn|killFoe|openStore|readScroll|drinkPotion)\s*\(" mazeworld.html` returns 0 (16 today), and no helper, table or constant reachable only from those functions survives — the phase summary lists every deleted symbol from an orphan sweep, and the shell still parses and boots (`npm run build:www` green, the app reaches the map tab in the browser dev loop).
  2. `wc -l mazeworld.html` is at least 2,000 lines below the phase-start count (≤ 6,600 from 8,607).
  3. The Hero-tab dossier line for every one of the 24 sub-classes is byte-equal to `content/flavor.js` — the classic `SUB_NOTE` table is gone — and a source-pin test fails if `mazeworld.html` ever declares `SUB_NOTE` or a second copy of any exported `content/` table.
  4. Zero tests extract a classic helper from the shell via `new Function` (`grep -rl "new Function" test/` empty); each former tripwire is re-pointed at the `engine/`/`content/` implementation it guarded or deleted with its reason recorded in the summary; `shell-map-invariants.test.js` and the full suite stay at fail 0.
  5. Engine gate: `git diff --stat <phase-start> -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` is empty; the debug build plays the same game (any Pixel 7 check batched to milestone close).

**Discuss**: Not worth a round — the deletion list was verified by direct code read (2026-09-17, re-verified 2026-09-19); the plan is the list plus the tripwire re-pointing.
**Plans**: 4 plans (sequential waves 1–4 — every plan edits `mazeworld.html`; phase-start baseline re-measured 2026-09-19 at `ba45dfd`: 8,710 lines → target ≤ 6,710)

Plans:
**Wave 1**

- [x] 44-01-PLAN.md — Gates first (headless `boot:check` + `shell-sweep` refs/orphans tools, fail-first proven); retire the two `new Function` tripwires (parley matrix folded into `parley.test.js` as 504 engine-vs-oracle cases, spell-menu mirror deleted); deletion layer 1 — the 16 mirrors + combat cluster + the dead `__mzCanCast` bridge, 5 shell pins re-pointed

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 44-02-PLAN.md — Deletion layer 2 (classic movement/encounter engine, `die`/epitaphs, explicit `window.move` calls, no `else makeCamp()`) and layer 3 (orphaned classic tables + combat-math/chargen helpers); 7 test anchors re-pointed, CLOAKS txt-mirror pin deleted

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 44-03-PLAN.md — DEAD-02: `window.__mzTables` bridge from `content/index.js` for the 9 surviving table copies (RACE_NOTE/CLASS_NOTE/SUB_NOTE + ROMAN/THRESHOLDS/WEAPONS/FIGHTER_SKILLS/THIEF_SKILLS/RACES, six of them drifted); classic copies deleted; `shell-no-content-copies.test.js` source pin (85-name set, 24/6/3 byte-equality, fail-first proven)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 44-04-PLAN.md — Retire classic `save`/`load`/`SAVE_KEY`/`newGame`/fallbacks, slim `__mzClassicBoot`, resume lines re-homed in the module boot, dual-write test graves-only; fixed-point orphan sweep; closing gates = ROADMAP success criteria 1–5 with the consolidated deleted-symbol and test-reason lists

### Phase 45: Collapse the Phase 37 Hedges

**Goal**: One worn-model code path everywhere — every fresh run creates `c.worn` (the Thief's starting cloak worn), every load reconciles unconditionally, and no `wornSlots` option or option-keyed branch exists in the engine, the shell, the bot or the tests — with exactly the fixtures that move declared and regenerated under the greenfield ruling.
**Depends on**: Phase 44 (the shell no longer carries a dead mirror that references `eff`/worn state, so the collapse edits one live path). Sequencing gate applies (edits `engine/`).
**Requirements**: HEDGE-01, HEDGE-02, HEDGE-03
**Baseline (2026-09-19)**: `wornSlots` ×19 in `engine/` (`state.js` 5, `saveState.js` 13, `derived.js` 1), plus `src/browser/engineAdapter.js` (×5), `tools/lib/tuning-bot.mjs` (`RUN_FLAGS.wornSlots`), `test/parity/harness/comparables.js`, `bot-tactics.test.js`, `class-pass-ledger.test.js`; `eff()` already single-path after quick task 260918-w4n; `docs/GEAR-SLOTS.md` §2 predicts the exposure: chargen seeds 2/3/4 (Thief starting cloaks in `c.items`), combat/flee seed 17 (Cloak of Armor in the bag), `action-script.economy.json`'s Cloak of Ether.
**Success Criteria** (what must be TRUE):

  1. `grep -rn "wornSlots" engine/ src/ mazeworld.html tools/ test/` returns 0 lines; `newRun(seed)` called with no options yields a Thief whose starting cloak sits in `c.worn.cloak` and not in `c.items`, pinned by a test that passes no option.
  2. A v1.4-era save (no `c.worn`, two rings stacked in the bag) loads through `validateSave`/`rehydrate` with no option argument and comes out legal — first copy worn, extras bagged, the reconciliation report returned once — pinned by a test that passes no option.
  3. The fixtures that moved are exactly the set a live scan measured before the edit (not assumed from GEAR-SLOTS §2 — the scan is committed with its output); each carries a before/after divergence record in the harness; every other fixture is byte-identical; `test/parity/FIXTURE-INVENTORY.md` is regenerated; the master hash is unchanged.
  4. The tuning bot plays the single path: `RUN_FLAGS` no longer names `wornSlots`, `meta.runFlags` in a fresh readout omits it, and a 143-cell × 3-seed smoke reports 0 stuck runs with the frozen `Bot:` parameter line byte-equal to the v1.5 AFTER pin.
  5. `npm test` fail 0 and `npm run build:www` green at every commit of the phase.

**Discuss**: Not worth a round — the ruling ("no dual-path code — fixtures follow", 2026-09-17) is already recorded; the only judgment is which fixtures move, and that is measured, not decided.
**Plans**: 3 plans (sequential waves 1–3 — measure, collapse-in-one-commit, close; phase-start baseline 2026-09-19 at `7447629`: `wornSlots` ×67 lines, 3,243 tests, master hash `a1f4d0dc`)

Plans:
**Wave 1**

- [x] 45-01-PLAN.md — Measure first: `tools/worn-fixture-scan.mjs` replays all 31 parity replay sites in lockstep with the prototype sandbox with the engine's fresh character passed through `reconcileWorn` (invariant across the collapse), commits `tools/worn-fixture-scan-output.txt` (the MOVED SET + per-site before/after record values); zero engine/harness bytes

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 45-02-PLAN.md — The collapse, ONE commit: `newRun` always reconciles (no option, zero draws), `validateSave`/`rehydrate` unconditional with one return shape, adapter + `RUN_FLAGS = { storeRoll: true }`; harness `dropEmptyWorn` replaces the Phase 37 carve-out, exactly the MOVED SET declared with `items`/`worn` before≠after records, new `divergence-records.test.js` (declared == measured), every option-off/legacy pin re-pinned, the HEDGE-01/HEDGE-02 no-option pins added; scan AFTER byte-identical

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 45-03-PLAN.md — Close: FIXTURE-INVENTORY.md Phase 45 section (+ regenerated roster), GEAR-SLOTS.md §2/§3/§5/§7 prose corrected, 143-cell × 3-seed smoke (0 stuck, `Bot:` line = v1.5 AFTER pin modulo `seeds=`, readout in scratch), ROADMAP criteria 1–5 verified verbatim, closing SUMMARY with the deferred Pixel 7 items

### Phase 46: Honest Names, Dead Exports & the Tutorial Decision

**Goal**: Every surviving module and export is named for what it does today, nothing unreachable stays exported, and the one ambiguous module (`tutorial.js`) has a recorded decision instead of a parked question.
**Depends on**: Phase 45 (`wornSlots` is gone, so NAME-02's zero-straggler grep is achievable). Sequencing gate applies (edits `engine/` for `winGame`/`state.won` and the shell's import sites).
**Requirements**: NAME-01, NAME-02, DEAD-04, DEAD-05
**Baseline (2026-09-19)**: `src/browser/toasts.js` imported from 35 files (5 `src/`, the shell, 28 tests, the voice scan); ~30 `winGame`/`state.won`/`.won` lines across `engine/movement.js`, `engine.js`, `saveState.js`, `death.js` and 7 test files; `flightLeft|flightCooldown|c.ether` ×80 across shell/src/engine/content/test/tools (most inside `foldLegacyCounters` tolerant-load and its tests); `tutorial.js` referenced only by `test/unit/tutorial.test.js` and a comment in `icons.js`; 209 `toast` mentions in shell/src/engine/content.
**Success Criteria** (what must be TRUE):

  1. `src/browser/toasts.js` does not exist; `src/browser/narrationLines.js` exports `LINE_FOR`, `linesForAction`, `dispatchWithNarration` and nothing named `MAX_TOASTS`, `TOAST_*_MS` or `toastLifetime`; `grep -rnE "toasts\.js|TOAST_FOR|toastsForAction|dispatchWithToasts|toastLifetime|MAX_TOASTS" src/ mazeworld.html test/ tools/` returns 0; the coverage guards (`LINE_FOR` ⊎ `ORACLE_ONLY` = every `EVENT_NARRATION` type) still hold under the new names; each rename is its own commit.
  2. `grep -rnE "winGame|state\.won|\.won\b" engine/ src/ mazeworld.html test/ tools/ test/parity/harness/` returns 0; `saveState.js` no longer serializes or validates a `won` field and a stale save carrying `won: true` still loads (tolerant); the `engine.js` abandon guard reads `dead` alone; the parity comparables carry no `won` handling.
  3. A recorded grep over `src/`, `engine/`, `content/`, `tools/` and the shell for `toast`, `dpad|d-pad`, `flightLeft|flightCooldown`, `c\.ether`, `wornSlots` returns 0 identifier hits — the only allowed survivors are tolerant-load reads of legacy save keys (`foldLegacyCounters`, `validateSave`) and lines that state a retirement, each listed in the summary with its reason. (Test file names and describe strings are Phase 48's.)
  4. `src/browser/tutorial.js` is in exactly one of two states — deleted together with `test/unit/tutorial.test.js` and the `icons.js` comment, with a "UX-06 rebuilds on the Phase 47 modular shell" note in PROJECT.md's Key Decisions and the UX-06 backlog row; or kept with a file header stating it is unreferenced, why, and which phase revives it — and the choice is recorded in the phase summary and PROJECT.md.
  5. `npm test` fail 0 with no test deleted except `tutorial.test.js` (if the module is deleted); `engine/` diff limited to the `winGame`/`won` removal; zero fixture moves; master hash unchanged; `build:www` green.

**Discuss**: Worth one short round — DEAD-05 is the user's call (delete and rebuild for UX-06 vs park with a header), and the user may want a say on the final module name (`narrationLines.js` is the proposal's; `narration.js` collides with `eventNarration.js`). Nothing else in the phase needs a decision.
**Plans**: 4 plans (sequential waves 1–4 — one rename per commit; every commit gated by `npm test` over the shared tree, so no wave runs in parallel; phase-start baseline 2026-09-19 at `39c5a0f`: 3,242 tests, `TOAST_FOR` 250 keys / `ORACLE_ONLY` 21, 35 `toasts.js` importers, master hash `a1f4d0dc`)

Plans:
**Wave 1**

- [x] 46-01-PLAN.md — `git mv src/browser/toasts.js → narrationLines.js` with `TOAST_FOR → LINE_FOR`, `toastsForAction → linesForAction`, `narrativeToastText → narrativeLineText`, the six dead lifetime exports and the two consumer-less re-exports deleted, all 35 importers moved, five `*toast*.test.js` files `git mv`'d (commit 1); the shell's `dispatchWithToasts → dispatchWithNarration` (commit 2); before/after fold dump byte-identical (NAME-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 46-02-PLAN.md — `winGame`/`won` removal in two layered commits: the shell (won card, `.stone.won` + `.deathcard` CSS, resume/title/rail/stair/snapshot reads → `dead` alone) then engine (six `won` files: movement/engine/saveState/state/events/death) + narration entries + tools + tests, with a stale `won: true` save pinned tolerant; the harness gains ONE prototype-side retired-field strip (`won` destructured out in the six comparables — no carve-out existed to remove; recorded as a premise correction), zero fixture moves, STOP rule if parity needs more (DEAD-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 46-03-PLAN.md — `controlScheme` setting deleted (four-field settings model; old blobs drop the key on read, pinned with fragment-built literals) (commit 5); `src/browser/tutorial.js` deleted, `tutorial.test.js` `git mv`'d to `icons.test.js` keeping its 15 icons.js pins (10 tutorial tests removed), decision recorded in PROJECT.md Key Decisions + onboarding row and the REQUIREMENTS.md UX-06 row (commit 6) (NAME-02 D-pad row, DEAD-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 46-04-PLAN.md — Close: `tools/ident-sweep.mjs` (comment-stripped identifier grep over src/engine/content/tools/shell with `--self-test`) and the recorded NAME-02 run (only survivors: the five `foldLegacyCounters` tolerant-load reads), ROADMAP criteria 1–5 verified verbatim, consolidated test ledger (3,242 → 3,231, every delta explained), closing SUMMARY with the deferred Pixel 7 batch (NAME-02 close)

### Phase 47: Shell Modularisation

**Goal**: The Gear tab, Hero tab and Store screen each render from a named `src/browser/` module with its own source-pin test, and `mazeworld.html` is a mount point under 5,000 lines whose module bridge is listed in one place — so later phases and the UX-06 tutorial edit small named files, and executors stop colliding in one 8k-line file mid-wave.
**Depends on**: Phase 44 (only live code gets carved), Phase 45 (the Gear module is born on the single worn path), Phase 46 (new modules import `narrationLines.js`, not a file about to be renamed). Sequencing gate applies (edits `mazeworld.html`).
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04
**Baseline (2026-09-19)**: 20 modules in `src/browser/` (6,831 lines); `paint()` at shell line 3224 and `draw()` at 2722 own the tab bodies inline; 51 unique `window.__mz*` bridge names across the shell and `src/browser/`; existing precedents `combatPanel.js`, `combatMenu.js`, `rail.js`, `viewModels.js` with their `shell-*.test.js` source-pin suites.
**Success Criteria** (what must be TRUE):

  1. `src/browser/gearTab.js`, `src/browser/heroTab.js` and `src/browser/storeScreen.js` exist, each with its own `test/unit/*.test.js` source-pin suite in the `combatPanel.js`/`rail.js` pattern; `paint()` in `mazeworld.html` contains no Gear/Hero/Store render body — one mount call per surface — and the existing `shell-company-panel`, gear-row/worn-slot and store pins are re-pointed at the modules and green.
  2. `wc -l mazeworld.html` < 5,000.
  3. A source-pin test proves the shell declares no duplicate of any `src/browser/` export or `content/` table (Phase 44's `SUB_NOTE` pin widened to the whole surface) — `grep -cE "^const (WEAPONS|ARMOR|SPELLS|JEWELRY|CLOAKS|STAVES|SUB_NOTE|RACES|SUBS)\b" mazeworld.html` is 0 and the test names every table it checks.
  4. Every `window.__mz*` bridge name (51 today) appears in one registry — a `## Module bridge` section in a doc or a `src/browser/bridge.js` map — with its owning module and consumer; a test fails when the shell or any module defines a `__mz*` name the registry does not list.
  5. Pixel-identical: the Gear tab (ON YOU / BAG, equip/use/drop/swap confirms), Hero tab (sheet, dossier, Company, Grimoire, RATIONS, abilities) and Store (buy/sell/repair rows, usable-by) render the same DOM before and after the phase — pinned by the moved tests plus one 3-screen smoke added to the milestone-close Pixel 7 batch; `engine/`, `content/`, parity fixtures and the master hash untouched.

**Discuss**: Worth a round before planning — the module boundaries are the one real design question of the milestone: what stays in `viewModels.js` vs moves into each tab module; whether the mount contract is `renderX(host, state)` like `combatPanel.js` or a `mountX(host)` that reads `window.__mzState`; whether the bridge registry is a doc section or a `bridge.js` map (SHELL-04 accepts either); whether the store's repair rows and the drop shelf ride with `storeScreen.js`/`gearTab.js` or stay shared.
**Plans**: TBD
**UI hint**: yes
(Annotation is for the keyword scan only — the phase is pixel-identical by construction and `ui_phase` is off; a UI-SPEC is not warranted.)

### Phase 48: Stale Docs, Comments & Test Names Purge

**Goal**: Every comment, doc page, CLAUDE.md row and test name describes the game as it is — nothing anywhere in the repo describes a pattern the game no longer employs — proven by a recorded grep list over the final code layout.
**Depends on**: Phases 44–47 (the sweep runs over the FINAL layout: the mirrors, hedges, old names and inline tab bodies are already gone, so what remains is what the code deletions did not take with them). Sequencing gate applies (touches comments in `mazeworld.html` and `engine/`).
**Placement rationale**: the proposal offered this as a mid-milestone phase or a closing sweep; closing sweep chosen. Each earlier phase takes the comments of the code it deletes (the "goes with the code" rule in the milestone gates), so a purge before Phase 47 would sweep the Gear/Hero/Store bodies once in the shell and again in their new modules, and would leave the modules' fresh headers unswept. After Phase 47 there is one layout to grep and only Phase 49 follows — which adds a single doc that describes the current game.
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Baseline (2026-09-19)**: 26 `iOS|Xcode|Apple|macOS` lines in `.claude/CLAUDE.md`; 15 `docs/*.md`; 9 `d-pad|dpad` and 209 `toast` mentions across shell/src/engine/content (most retired by Phase 46's renames); 115 `test(`/`describe(` strings mentioning toast/D-pad; five `test/unit/*toast*.test.js` files.
**Success Criteria** (what must be TRUE):

  1. The phase summary records the grep list and its zeros: `d-pad|dpad`, `toast` (as a UI surface), `dead classic|classic script|classic engine`, `wornSlots`, `flightLeft|flightCooldown|c\.ether`, `recent(er|re).*(every|each) step` across `mazeworld.html`, `src/`, `engine/`, `content/` and `test/` (comments included) — the only survivors are lines that assert a retirement (the Phase 35 invariant suite, "toasts were retired in Phase 35"-style notes) and the tolerant-load legacy-key reads, each listed.
  2. `.claude/CLAUDE.md` has zero `iOS|Xcode|Apple|macOS|App Store` lines (rows deleted, not marked out of scope — the "SCOPE OVERRIDE" banner goes with them); its stack notes describe tap-to-move + the rail, not a D-pad + toasts; `docs/*.md` each describe the current game or are deleted, with the deletion list and reasons in the summary.
  3. No test file name, `test(...)` or `describe(...)` string references a retired mechanism: `ls test/unit | grep -iE "toast|dpad"` is empty (five files today) and `grep -rniE "^\s*(test|describe|it)\(.*(toast|d-pad|dpad)" test/` returns 0 except strings that assert the absence of the mechanism, each listed.
  4. `npm test` fail 0 with the pass count equal to the phase-start count (renames only — no test deleted without its reason in the summary); `engine/`, `content/`, fixtures and the master hash unchanged except for comment lines (the diff contains no non-comment code change — proven by a stripped-comments diff recorded in the summary).

**Discuss**: Not worth a round — the sweep is mechanical; the one judgment (which `docs/*.md` only documented dead code) is recorded in the summary for the user to reverse.
**Plans**: TBD

### Phase 49: Measure-First Perf Pass

**Goal**: The shell's per-step cost is known in numbers on the Pixel 7, and only a measured hotspot — or a jank the user confirms on device — changes code; if nothing qualifies, the phase closes with the baseline and no diff.
**Depends on**: Phase 47 (measure the final shell, not one about to be rearranged) and Phase 48 (nothing left that re-touches the shell). Hard device dependency: the user's Pixel 7 — the one phase in the milestone that needs the phone, so it closes the milestone alongside the debug APK build.
**Requirements**: PERF-01, PERF-02
**Baseline (2026-09-19)**: no `performance.now()` marks anywhere in the shell or `src/browser/`; no `docs/PERF-BASELINE.md`; the only perf finding on record is the v1.4 device round's party-pulse `box-shadow` repaint (fixed in 260917-bbs); `npm test` ≈ 24 s; `www/` 4.8 MB.
**Success Criteria** (what must be TRUE):

  1. `docs/PERF-BASELINE.md` exists and records `paint()` re-render and `draw()` per-step timings (median and p95 over at least 50 steps, on a floor with water and a dark region) captured on the Pixel 7 from the milestone-close debug APK, with the method (Chrome remote profiling or in-app `performance.now()` marks), the build commit and the device build number.
  2. Every code change in the phase cites a baseline row that measured ≥ 16 ms per step or a jank the user confirmed on device; if no row qualifies, the phase's whole diff is the doc — zero code — and the summary says so in those words.
  3. If a fix landed, the same doc carries an AFTER row showing the hotspot below 16 ms with no other row slower, and the fix is presentation-only (`engine/`, `content/`, fixtures, master untouched).
  4. No timing instrumentation ships: any `performance.now()` marks are behind the existing `dev` gate or removed before the phase closes, proven by a grep of `www/` after `build:www`.

**Discuss**: Not worth a round — "measure first, fix only what is measured" is the whole rule; the user's input (confirming a visible jank) happens on the device during the phase, not before it.
**Plans**: TBD

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

- **v1.5 Pixel 7 UAT batch** — 140 checks in `docs/UAT-v1.5.md`, on its own track against a post-quick-task debug APK; findings become quick tasks or the next milestone, not v1.6 phases.
- **UX-06** first-run tutorial — deliberately last; rebuilt on the Phase 47 modular shell (the reason SHELL-01..03 exist). Includes the UIF-04 on/off toggle dropped from v1.3.
- **STR-01..04/06** Google Play production launch (Data Safety audit, privacy page, listing, IARC, pricing, rollout).
- **TUNE-06/07** human DR round of the difficulty retune and the tier-3/5 roster decision (`docs/DIFFICULTY-RETUNE.md`); `storeRoll` for the bots; the two structural v1.5 AFTER patterns (Magic Users gain nothing from the class-gated ability system; Wilmsry's racial edge).
- Store screen restyle to the dark vocabulary (Phase 47 moves the store into `storeScreen.js` unchanged — the restyle edits that module later).
- Dice-mode setting.
- Haptics polish; the unguarded button set from 32-03 (store rows, drop shelf, `a-evt`, `btn-again`, spell menu).
- Climb dice payload (`roll`/`need` on the four climb events) — carried over from v1.4 as a post-UAT quick task.
- Shell debt noted in the v1.5 audit but not in v1.6's requirements: the unreachable parley fluency-2 branch (`canParley`'s Magical tier, `wilmsryVsMagical`) and the `railCardFor` tie-break — fold into Phase 44's orphan sweep if they fall out for free, otherwise a quick task.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 44. Retire the Classic Engine from the Shell | v1.6 | 4/4 | Complete    | 2026-09-19 |
| 45. Collapse the Phase 37 Hedges | v1.6 | 3/3 | Complete    | 2026-09-19 |
| 46. Honest Names, Dead Exports & the Tutorial Decision | v1.6 | 2/4 | In Progress|  |
| 47. Shell Modularisation | v1.6 | 0/TBD | Not started (discuss recommended: module boundaries) | - |
| 48. Stale Docs, Comments & Test Names Purge | v1.6 | 0/TBD | Not started | - |
| 49. Measure-First Perf Pass | v1.6 | 0/TBD | Not started (needs the Pixel 7) | - |
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
| Next tuning pass (TUNE-06/07) | Post-v1.3 | 0/1 | Deferred by user (2026-09-15) | - |

## Backlog

### Phase 999.1: Transitions & Sounds (BACKLOG)

**Goal:** [Captured 2026-09-19 for future planning — user's words] Map the sound clips in `sfx/` (31 MP3s the user added: `walk1-3`, `walk-water1-3`, `hit1-2`, `miss1-2`, `hurt1-3`, `foe-die`, `enemy-{batrat,beast,demon,human,undead}`, `spell`, `resist`, `heal`, `drink`, `chest`, `gold`, `trap`, `jump`, `stairs`, `levelup`, `death`, `ui-tap`) to game actions and engine events; and make the shell's transitions smooth — map panning, rail show/hide, opening menu items — "not jarring and immediate". Slow the fight responses down so there are transitions between exchanges and the player can process each one. Animate on-screen text as if quickly typed out (fast, not slow). Dial back the black circle around the party marker — the party is already highlighted, the ring is too stark.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** sound = a `src/browser/sfx.js` event→clip table played through Web Audio (`AudioContext` + `decodeAudioData`, unlocked by the first tap), wired beside `hapticForEvents(events)` in the dispatch path — engine untouched, mute toggle by the settings gear, clips bundled in `www/` (Android WebView plays MP3 offline, no plugin). Transitions: the rail is a flex sibling that reflows the viewport today (see todo `2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — overlay + slide is the fix, land together); map pan goes through `cameraPan()`/`keepInViewAxis` (`src/browser/controls.js`) with no easing; `.mw-rail-new` has a 0.18 s rise (`mazeworld.html` CSS ~L707) and combat has `mwStrikePop`/`mwRoundTick` keyframes but no inter-exchange pacing in `combatPanel.js`. Typed-text effect belongs to the rail/encounter line renderers (`renderRail`, `renderEncounter`), must respect the rail hold/dismiss rules and TalkBack (`#mw-rail-live` announcer gets the full text at once). Party marker ring: `PLAYER_MARKER_ICON`/`draw()`. Sequence AFTER v1.6 Phase 47 (shell modularisation) so the effects land in the new `src/browser/` modules, not the old `paint()` bodies; each effect gets a settings-respecting reduced-motion path.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.2: Joiner level capped by floor depth (BACKLOG)

**Goal:** [Captured 2026-09-19 for future planning — user's words] A Joiner's level should never be higher than the level of the floor you are on — a level V Joiner can never show up unless you are at least on floor 5.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** today `engine/encounters.js#meetJoiner` rolls `lvl = SPELL_LEVEL_TABLE[rng.d(10) - 1]` (`content/misc-tables.js:27`, the canon d10 Level Table p.46: 1,1,2,2,3,3,4,4,5,5) with no depth term — identical to the prototype (`prototype-master.js.txt` ~L1760). The cap is a deliberate canon divergence: `lvl = Math.min(rolled, state.floor.depth)` keeps the draw count and cursor unchanged (one d10, then the two d20 wp rolls) so only fixtures that actually meet a Joiner on a floor shallower than the rolled level move — declare each with before/after per the greenfield ruling and regenerate `FIXTURE-INVENTORY.md`. `joinerMet`/`joinerRefused` event payloads carry `lvl`, so narration (`toasts.js`/`narrationLines.js` after Phase 46) and the rail card need no shape change. Check `grantLevelAbilities(joinerChar, …, lvl)` receives the capped level, and the wp formula `20 * lvl + d20` uses it too. Bot/class-pass readouts will shift slightly (weaker early Joiners) — a small `tune-classes` smoke before/after belongs in the plan. Gameplay change → outside v1.6 (cleanup-only); a quick task or the next tuning pass.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.3: Dungeon set dressing (BACKLOG)

**Goal:** [Captured 2026-09-19 for future planning — user's words] Add set dressing to the dungeon using the new optimized `icons/optimized/set_dungeon_*.png` icons (54 of them: ash pile, banners, barrels/crates/sacks, bones/skulls/skeleton, blood, book/scrolls, boulder/rocks/rubble, braziers/torches/candles/sconce, cobwebs, mushrooms/moss/fern/roots/vines, grate/hatch/pit, puddles/slime, rat, shackles, …). Use them for random dungeon set items — on walls, or on paths provided they are DIMMED so they are never confused with the real encounter icons. Set dressing only: not interactable, no rules effect, pure ambiance.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** rendering-only, engine untouched — the placement must be deterministic per floor (derive from `makeRng(hash(seed, "dressing", depth))` in the SHELL/`src/browser/` layer, never a draw off the engine's main stream, so no fixture moves and the engine stays pure), keyed off the generated grid (`engine/maze.js` cells `{ wall, seen, feat }`; walls are the majority of the 21×21 grid) and revealed with `c.seen`. Draw in `draw()` (`mazeworld.html` ~L1931; feature icons at ~L1998-2002 via `iconsApi.drawFeatureIcon(ctx, img, x, y, CELL, dir, 0.75)`) BEFORE the feature/party layer: wall items at full or near-full alpha on wall cells; path items at low alpha (≈0.3-0.4) so `featureKeyForCell` encounter icons stay unmistakable; never on a cell that has a `feat`, the stairs, or the party. Density is a tunable (a handful per floor, rarer on deep floors?). `preloadIcons("./icons/optimized")` already loads the directory — check `icons.js`'s manifest approach so 54 extra images don't slow the first paint (lazy or a sprite). Respect the 260918-vm3 stationary camera and Phase 35 map palette; a settings toggle ("set dressing off") is cheap. Land after v1.6 Phase 47 (draw code may move into a module) and alongside 999.1's party-marker frames. The raw `icons/*.png` sheets the user added (`dungeon_dressing.png`, `encounters.png`, …) are sources — only `icons/optimized/` ships in `www/`.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)
