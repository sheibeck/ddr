# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/MILESTONES.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- 🚧 **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (current, started 2026-09-14; requirements: `.planning/REQUIREMENTS.md`)
- 📋 **v1.0 launch tail** — first-run tutorial (04-10 / UX-06) + Google Play production launch (STR-01..04, STR-06); deferred by user until after v1.1

## Engine Gate (non-negotiable, every phase — established in v1.1)

Every phase in this milestone touches combat RNG and/or the bestiary the frozen prototype embeds its own copy of. The gate, carried from `STATE.md`:

- Engine stays pure/deterministic.
- Parity stays byte-identical for solo/empty-party play against the frozen `test/parity/prototype-master.js.txt`.
- New RNG draws fire only behind new-feature guards (e.g. a new `abilities` field) — never unconditionally.
- Every new serialized field (per-foe ability state, foe-inflicted player effects, summoned foes) is carved out in all three `*Comparable()` functions (`test/parity/harness/comparables.js`) and round-trips through save/load.
- `test/parity/prototype-master.js.txt` is NEVER edited.
- Every new event type gets an `EVENT_NARRATION` entry (coverage-guard stays green, family-friendly voice-safety scan stays green).
- Deliberate divergences from the prototype (bestiary numbers, parley formula) regenerate only their specific fixtures, each with a documented before/after table and rationale — never a blanket fixture regeneration.

## Phases

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

<details>
<summary>✅ v1.1 Monster Balancing & Abilities (Phases 17–21) — SHIPPED 2026-09-14 (override closeout: TUNE-04 retune deferred)</summary>

Full details: `.planning/milestones/v1.1-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.1-phases/`.

- [x] **Phase 17: Fixture Inventory & Foe-Turn Refactors** - Document which bestiary creatures each parity fixture rolls and extract shared foe-turn helpers before any bestiary or ability behavior changes land (completed 2026-09-13)
- [x] **Phase 18: Bestiary Rebalance & Canon Combat Fixes** - Review every creature's stats against its intended depth band and land canon-accurate combat modifiers (armor, half-damage, type multipliers, slow) (completed 2026-09-13)
- [x] **Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance** - Foes cast, drain, debuff, heal, and summon via a data-driven ability system; the player's Intelligence resists incoming foe magic (completed 2026-09-14)
- [x] **Phase 20: Parley Balance & Language System** - Fix parley's payout/spam dominance and wire Language/Helm-of-Knowledge fluency into the same bonus term (completed 2026-09-14)
- [x] **Phase 21: Consolidated Difficulty Retune** - The ONE retune across party power, economy, monster power, ability threat, and parley numbers, closed out by a human DR-round sign-off (completed 2026-09-14)

</details>

### 🚧 v1.2 Class Pass & Mass Playtest (In Progress)

**Milestone Goal:** Every class, sub-class, and race is fun to be dealt — one solid good, one solid bad, no "cannot act" states — then a class-aware mass playtest ranks who over/under-performs, and the deferred difficulty retune (TUNE-04) lands on the corrected player power. Balance is NOT the goal — fun is.

- [x] **Phase 22: Class-Aware Harness & BEFORE Matrix** - Force any class/sub-class/race through the bot with a sub-class-aware policy, print a ranked 144-combo matrix, and capture the BEFORE snapshot before any identity change lands (completed 2026-09-14)
- [x] **Phase 23: Casters Can Act (Wizard/Summoner/Illusionist + Guaranteed Attack Spell)** - Fix the three "cannot act" states and guarantee every fresh Magic User a day-one attack spell (completed 2026-09-14)
- [ ] **Phase 24: Every Sub-class and Race: One Good, One Bad** - Every sub-class and race gets a code-verified good and bad, flavor text matches the mechanics, and an identity-contract test proves it
- [ ] **Phase 25: Nothing Happens Silently (Feature Feedback)** - Every class/sub-class/racial feature that fires or blocks is narrated in the Oracle and as a toast; enemy hits are unmistakable from player hits/misses
- [ ] **Phase 26: Mass Playtest & Class-Pass Ledger** - An AFTER matrix on the post-pass engine ranks over/under-performers with a fun-band verdict per row, committed to `docs/CLASS-PASS.md`
- [ ] **Phase 27: Delve-to-Death Retune** - The deferred TUNE-04 re-attempt on the corrected player power, closed by a human DR round on the Pixel 7

## Phase Details

<details>
<summary>v1.0 phase details (Phases 1–16 + 04.1/04.2) — archived, see `.planning/milestones/v1.0-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.0 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.1 phase details (17–21) — archived</summary>

See `.planning/milestones/v1.1-ROADMAP.md`.

</details>

### Phase 22: Class-Aware Harness & BEFORE Matrix

**Goal**: The tuning harness can force any class/sub-class/race combination and play it with a sub-class-aware policy, producing a ranked 144-combo matrix — and a BEFORE snapshot is captured against the pre-identity-pass engine before any identity change lands, since it is impossible to recover that baseline later without git archaeology.
**Depends on**: Phase 21 (v1.1) — extends the existing `tools/lib/tuning-bot.mjs` and `difficultyCurve`'s start-at-depth seam; first phase of v1.2.
**Requirements**: HARN-01, HARN-02, HARN-03, HARN-04, PLAY-01
**Success Criteria** (what must be TRUE):

  1. A developer can force any specific class/sub-class/race triple (e.g. `--cls "Magic User" --sub Summoner --race Troll`) through a documented, harness-only chargen seam, and every other RNG draw stays in the same order as a naturally rolled character.
  2. The bot's policy casts Summon before/at combat start, sings as a Bard when ready, opens with Mirror Self as an Illusionist, uses non-thrown combat spells (Doze/Stun/Weaken/Acid/Shield/Heal) at sane thresholds, and parleys when available — casters are no longer under-measured.
  3. `tools/tune-classes.mjs` runs all 144 sub-class × race combinations for N seeds each and prints a ranked matrix (mean/p50 death depth, reach ≥5/≥10, kills, level, top death causes) as text and `--json`, reproducible from the same seed list.
  4. The harness can start a run at a chosen depth (`--start-depth`) using the same seam as the Settings dev toggle, so deep-floor lethality is measurable by the bot.
  5. A BEFORE matrix is run against the commit-pinned pre-identity-pass engine and committed to the class-pass ledger before Phase 23's changes land.

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 22-01-PLAN.md — Dev-only `force` option on `rollCharacter`/`newRun` (substitutes class/sub/race draw RESULTS, consumes the draws) + forced-chargen determinism test (HARN-01)
- [x] 22-02-PLAN.md — Sub-class-aware bot policy (`chooseSpell` scoring table, openers, talk-first parley, sing, summon), Samurai/Wizard refusal-loop fixes, `stuck` bucket, `startDepth`/`force` through `playRun` (HARN-02, HARN-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-03-PLAN.md — `tools/lib/class-matrix.mjs` + `tools/tune-classes.mjs` (143-cell worker_threads matrix, `--json`/`--out`, `--cls/--sub/--race`, `--start-depth`) + `tune-difficulty` `--start-depth`/stuck bucket (HARN-03, HARN-04, HARN-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 22-04-PLAN.md — BEFORE capture LAST: pinned engine, 143x40 natural matrix + 143x10 depth-20 slice, `docs/CLASS-PASS.md` + `docs/class-pass/before*.json` (PLAY-01)

**Engine gate reminder**: the harness lives entirely in `tools/` — dev-only, never shipped, never a CI gate; it must not add new engine RNG draws outside existing feature guards, and the forced-chargen seam must not perturb the RNG order Fighters/Thieves already rely on.

### Phase 23: Casters Can Act (Wizard/Summoner/Illusionist + Guaranteed Attack Spell)

**Goal**: No Magic User sub-class can be dealt a character that cannot fight — a Wizard fights with the staff whenever no attack spell is castable, every fresh Magic User has a day-one attack spell, a level-1 Summoner can summon, and a level-1 Illusionist has a way to win a fight, not only stall it.
**Depends on**: Phase 22 — the BEFORE matrix (PLAY-01) must be captured against the pre-change engine before any of this phase's fixes land.
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, FID-06
**Success Criteria** (what must be TRUE):

  1. A Wizard with no castable attack spell right now (charges remain AND a known, level-legal, school-legal attack spell is in the grimoire) fights with the staff instead of refusing to act; when the refusal does fire, it names its reason.
  2. Every freshly rolled Magic User's grimoire contains at least one level-1, day-one-castable attack spell (thrown/status/stun/weaken) drawn from the sub-class's own legal schools.
  3. A level-1 Summoner can cast Summon (Summon treated as level-1 for the sub-class, or an equivalent grant), keeping doubled strength, the out-of-combat pending ally, and the one-in-eight backfire as the bad.
  4. A level-1 Illusionist has an illusion-school way to WIN a fight (an attack/pressure spell or Phantom Host usable at level 1), while keeping the d20 strike die until level 3 as the bad.
  5. Chargen-parity fixtures affected by the guaranteed-attack-spell change are regenerated narrowly, each with a before/after note and rationale; every fixture NOT touched stays byte-identical, and Fighter/Thief RNG-consumption order is unchanged.

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 23-01-PLAN.md — Pre-change chargen rng pins (20 fixture seeds + per-sub rollGrimoire draw counts, committed BEFORE any engine edit) + `content/spell-level-overrides.js` (Summoner/Summon 1, Illusionist/Phantom Host 1) + `engine/derived.js` `spellLevelFor`/`ATTACK_SPELL_KINDS`/`castableAttackSpells`, `canCast` override-aware; canCast diff-walk test (IDENT-01 helper, IDENT-03, IDENT-04, FID-06)

**Wave 2** *(blocked on Wave 1 completion; 02 and 03 run in parallel)*

- [x] 23-02-PLAN.md — `rollGrimoire` zero-draw guaranteed day-one attack top-up (Summoner exempt; `spare` pool predicate frozen so the shuffle draw count is unchanged) + >=200-forced-seed tests + FID-06 chargen `divergences` records (measured: seeds 24 gains Freeze, 15 drops Heal) asserted at both chargen parity sites (IDENT-02, IDENT-03, FID-06)
- [x] 23-03-PLAN.md — Wizard refuses to strike only while a castable attack spell exists and charges remain; `strikeRefused` gains `spell`; narration names it; L1 Summon (doubled/backfire kept) and L1 Phantom Host (not doubled, d20 kept) tests; Wizard/Summoner/Illusionist `SUB_NOTE` (IDENT-01, IDENT-03, IDENT-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 23-04-PLAN.md — Freeze kills route through `killFoe` (user decision: Freeze pays out) + `spellAboveLevel` via `spellLevelFor` + FID-06 magic `cast-damage` (seed 8) `divergence` record at both magic parity sites + FIXTURE-INVENTORY.md "Phase 23 caster divergences" + smoke readout note in docs/CLASS-PASS.md (IDENT-01..04, FID-06)

**Engine gate reminder**: chargen changes are narrow, documented fixture regenerations only (FID-06) — the frozen prototype master is never edited, and parity for untouched fixtures stays byte-identical.

### Phase 24: Every Sub-class and Race: One Good, One Bad

**Goal**: Every one of the 24 sub-classes and 6 races has a code-verified one solid good and one solid bad, flavor text matches the implemented mechanics, and an identity-contract test proves both fire under a forced scenario.
**Depends on**: Phase 23 — the caster "cannot act" fixes and the fixture-regeneration discipline land first, since this phase touches the remaining sub-classes and races broadly.
**Requirements**: IDENT-05, IDENT-06, IDENT-07, IDENT-08, IDENT-09, IDENT-10, FID-07
**Research flag**: `--research-phase` recommended during planning — IDENT-05/06 design new mechanics from flavor text for sub-classes with no existing bad or good (Court Mage, Pickpocket, Cutthroat bads; Guard's good), mirroring v1.1's precedent for open design forks.
**Success Criteria** (what must be TRUE):

  1. Every sub-class currently missing a bad (Knight, Master of Arms, Court Mage, Pickpocket, Cutthroat, Ninja, Bard) has one implemented and felt in play — taken from its own flavor text where the text promises one, designed fresh where it does not.
  2. Guard gains a real good and Court Mage's good is made felt, so no sub-class is penalties-only.
  3. Flavor-only restrictions (Woodsman no mail/plate/shield, Pilfer no non-healing magic items, Cloaker's bad) are enforced in the engine or reworded, so every promise on the sheet is true.
  4. An identity-contract test table asserts, for all 24 sub-classes and the 5 non-Human races, that the named good AND the named bad each fire under a forced scenario; Human is asserted neutral (control race, user decision 2026-09-14).
  5. `SUB_NOTE`/`RACE_NOTE` text matches implemented mechanics for every sub-class and race; the level-1 Thief dagger-damage question is recorded as a deliberate ruling with rationale in the class-pass ledger; every new serialized field is carved out in all three `*Comparable()` functions and every new event type gets an `EVENT_NARRATION` entry, voice safety scan green.

**Plans**: 7 plans (4 waves)

Plans:
- [ ] 24-01-PLAN.md — Combat-side sub-class mechanics: Knight never-first vs maxWP >= 20, Court Mage talk-first + boredom 1-in-6 + parley Humans, Ninja/MoA cannot parley (+ mazeworld.html mirror, 1008-case mirror test), MoA no clean withdrawal, Guard -1 to be hit, Cloaker vanish only while unseen, Bard party targeting; narration (IDENT-05/06/07, FID-07) — wave 1
- [ ] 24-02-PLAN.md — Parity harness: generic `kind: "action-path"` divergence record (actionPathDivergenceOf / skipsByteDiffAt / declaredEndDiffs / stockMarkupDiff) wired at every replay site as a no-op + schema doc + synthetic unit test (FID-07) — wave 1
- [ ] 24-03-PLAN.md — Race pass in combat.js as RACES flags (Fridgian `hide: 2`, frenzy never wasted on a corpse — d10 removed; Dwarven `armorWear: 0.5`) + MEASURED combat/lose (seed 14) action-path divergence declared + new `lose-apprentice` (seed 127) death-path scenario + FID-02 pins re-measured + inventory roster regenerated (IDENT-08/09, FID-07) — wave 2
- [ ] 24-04-PLAN.md — Pickpocket bad: buy x1.25 / sell x0.75 via priceFor/sellPriceFor (+ sell-label bridge) + MEASURED economy fixture (seed 3) action-path divergence declared with store-roll relation check (IDENT-05, FID-07) — wave 2
- [ ] 24-05-PLAN.md — World-side mechanics: Cutthroat / Wilmsry-vs-Magic-User joinerRefused (rolled first), Woodsman ar > 10 gate (take/equip/store), Pilfer heal-kind-only useItem, Bard camp wake on 1-2; narration; the 30-blurb SUB_NOTE/RACE_NOTE sweep (IDENT-05/07/09, FID-07) — wave 3
- [ ] 24-06-PLAN.md — Identity-contract test: ONE table, 24 subs + 5 races good/bad + Human neutral, forced heroes via newRun(seed, [], { force }), boundaries at the decided thresholds, completeness meta-test vs CLASSES/RACES (IDENT-08) — wave 4
- [ ] 24-07-PLAN.md — Ledger: docs/CLASS-PASS.md Rulings section (every decision + rationale, IDENT-10 dagger KEEP ruling, Freeze-pays-out entry, good/bad table, FID-07 posture, smoke readout — AFTER untouched) + FIXTURE-INVENTORY.md Phase 24 divergences section (IDENT-10, FID-07) — wave 4

**Engine gate reminder**: every new serialized field carved out in all 3 `*Comparable()` fns (FID-07), every new event type narrated, voice safety scan green, parity byte-identical throughout. Phase 24 planning MEASURED two fixture action-path divergences (combat/lose seed 14 — Fridgian hide + whiff removal; economy seed 3 — Pickpocket markup); both are declared records, never regenerations; every other fixture stays byte-identical.

### Phase 25: Nothing Happens Silently (Feature Feedback)

**Goal**: Nothing a class, race, or sub-class does happens silently — every feature that fires or blocks is narrated in the Oracle and as a toast, enemy hits are visually unmistakable from player hits/misses, multi-attack rounds aggregate into one toast, and every spell/item effect in either direction is legible.
**Depends on**: Phase 24 — so the new goods/bads from the identity pass get narrated once, not twice.
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06
**Success Criteria** (what must be TRUE):

  1. Every class/sub-class/racial feature that fires (frenzy, Warlock boost, Knight/Con Artist talk-down, boredom kill, backstab, Ninja opener, Cutthroat crit, Pickpocket take, Pilfer disarm, potion duplication, Soldier double heal, Samurai never-first, and every new v1.2 good/bad) produces an Oracle line AND an on-screen toast saying what happened and why.
  2. Every action a class/sub-class/race BLOCKS (Wizard won't strike, Samurai won't flee, Ninja won't parley, Acrobat can't equip, Pilfer can't read, Fridgian can't wear armor, Woodsman can't wear mail) tells the player what was refused and why, in voice.
  3. Enemy hits toast RED and read "X hits you (N)"; player hits and misses stay green and read "You hit / You miss X" — the two are never confusable.
  4. A multi-attack foe's round aggregates into one toast — "X hits you 2 of 4 times (N)" — instead of one toast per swing; early-combat misses draw from a varied, voice-safe corpus instead of repeating "Miss".
  5. Every spell, scroll, and item effect in EITHER direction (yours on them, theirs on you) is legible as an event + toast, including resisted/failed/nothing-to-target outcomes.

**Plans**: TBD
**Engine gate reminder**: every new event type gets an `EVENT_NARRATION` entry and the voice safety scan stays green; this is presentation/narration work — it must not introduce new engine RNG draws.

### Phase 26: Mass Playtest & Class-Pass Ledger

**Goal**: An AFTER matrix on the post-identity-pass, post-feedback engine ranks over- and under-performers by sub-class and by race with a written fun-band verdict per row, and the full class-pass ledger is committed.
**Depends on**: Phase 25 (feature feedback landed so the mass playtest's findings are legible) and Phase 22 (the harness that produces the matrix).
**Requirements**: PLAY-02, PLAY-03
**Success Criteria** (what must be TRUE):

  1. An AFTER matrix is captured on the post-identity-pass, post-feedback engine using the Phase 22 harness, at the same volume and seed list as the BEFORE matrix.
  2. Over- and under-performers are ranked by sub-class and by race, each row given a written fun-band verdict (fine / too strong / too weak / cannot act).
  3. Every "cannot act" row is zero.
  4. `docs/CLASS-PASS.md` documents the per-sub-class/race good+bad table, before/after numbers, every ruling (IDENT-05/06/07/10) with rationale, and lists the remaining outliers as candidates for the next milestone.

**Plans**: TBD
**Engine gate reminder**: the harness is dev-only (`tools/`), never shipped, never a CI gate — bot numbers are a sanity floor, not a substitute for the human DR round in Phase 27.

### Phase 27: Delve-to-Death Retune

**Goal**: The deferred TUNE-04 retune (v1.1 verdict: tune-again) lands on the corrected player power from the identity pass, targeting a band agreed with the user, and closes on a human DR-round verdict.
**Target (user decision 2026-09-14):** tune toward **depth 20**, not infinite depth — and 20 is a **unicorn run**, rare rather than expected (the game is too RNG-heavy to define a "competent player"; the band is set by median death depth and a small reach-20 rate). Past 20, expect imminent death but do not engineer it — no softening of `engine/difficulty.js` beyond 20 and no forced-death mechanic; let the run wrap up naturally. The class matrix's `--start-depth 20` slice (`docs/class-pass/before-depth20.json`) is the deep yardstick.
**Depends on**: Phase 26 — the AFTER matrix and ledger are the retune's yardstick.
**Requirements**: TUNE-05, TUNE-06, TUNE-07
**Research flag**: `--research-phase` recommended during planning, mirroring v1.1 Phase 21's precedent. TUNE-05 (agreeing the target band) and TUNE-07 (the human DR round, `human_verify_mode: end-of-phase`) are both flagged as `/gsd-discuss-phase` candidates before planning this phase.
**Success Criteria** (what must be TRUE):

  1. A delve-to-death target band (median death depth, reach-table shape, and what "survivable at depth 20" means for a mid-level character) is agreed with the user and recorded in `docs/DIFFICULTY-RETUNE.md` before tuning begins.
  2. `engine/difficulty.js` is retuned on the post-pass engine so the class matrix and the start-at-depth readout land inside the agreed band, with BEFORE/AFTER transcripts appended to the ledger under identical bot parameters.
  3. A human DR round on the Pixel 7 (start-at-depth 20/35/50 plus a natural run) re-issues the TUNE-04 verdict.
  4. The milestone closes only on "tuned" or a user-recorded deferral.

**Plans**: TBD
**Engine gate reminder**: engine stays pure/deterministic and parity byte-identical throughout the retune — these are dial changes only, no new rng draws.

## Carried-forward work (not yet phases)

| Item | Origin | Notes |
|------|--------|-------|
| First-run tutorial (04-10, UX-06) | Phase 4 | Plan exists in `milestones/v1.0-phases/04-.../04-10-PLAN.md` (stale vs. the DR-era UI — re-plan). Build LAST, once the UI settles — after v1.1/v1.2. |
| Production launch (Phase 6 tail) | Phase 6 | Repo-side: dependency/SDK audit for Data Safety, privacy-policy page, listing copy/screenshots, `versionCode` bump + `npm run play:release`. Console-side (user): Data Safety form, IARC, paid pricing, production rollout. See `docs/RELEASING.md`. Deferred until after v1.1/v1.2. |

Notes: PARTY-10 / ECON deep tuning / Phase 3 feel-tuning landed in Phase 21 (v1.1). DR15-A "Language as a system" landed in Phase 20 (v1.1). DR16-G "N squares of opponents" is tracked as `UI-V2-03` in `.planning/REQUIREMENTS.md` v2 Requirements (backlog). TUNE-04's deferred retune verdict now lands as Phase 27 of v1.2. The "Feedback, Feel & Polish" remainder (inventory integrity, UI layout, combat-start gating, store stock) is parked for a v1.3 candidate milestone — see `.planning/proposed-milestone-feedback-feel-polish.md`.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 22. Class-Aware Harness & BEFORE Matrix | v1.2 | 4/4 | Complete    | 2026-09-14 |
| 23. Casters Can Act | v1.2 | 4/4 | Complete    | 2026-09-14 |
| 24. Every Sub-class and Race: One Good, One Bad | v1.2 | 0/TBD | Not started | - |
| 25. Nothing Happens Silently (Feature Feedback) | v1.2 | 0/TBD | Not started | - |
| 26. Mass Playtest & Class-Pass Ledger | v1.2 | 0/TBD | Not started | - |
| 27. Delve-to-Death Retune | v1.2 | 0/TBD | Not started | - |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.1/v1.2 | - |
