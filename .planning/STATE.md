---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Class Pass & Mass Playtest
status: executing
stopped_at: Completed 25-05-PLAN.md
last_updated: "2026-09-15T13:40:49.479Z"
last_activity: 2026-09-15
last_activity_desc: Phase 25.1 planned and execution started
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 27
  completed_plans: 20
  percent: 57
current_phase: 25.1
current_phase_name: Device Feedback Batch (INSERTED; runs before Phase 26)
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-14 for v1.2)

**Core value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Current focus:** Phase 25.1 — Device Feedback Batch (card vs toast, Joiner swap, class-based allies, camp numbers, Oracle scroll)

## Current Position

Phase: 25.1 — Device Feedback Batch (INSERTED; runs before Phase 26)
Plan: 1 of 3
Status: Executing (wave 1 of 3)
Last activity: 2026-09-15 — Phase 25.1 planned (3 plans, 3 waves, 65fb83c); execution started

## Ground Truth (durable facts every session needs)

**App identity:** "Delve, Die, Repeat", appId `com.darktierstudios.delvedierepeat` (PERMANENT — published). Player-facing text uses "Dungeon"/"Game Master". The old working-title string survives only in filenames (`mazeworld.html`, `mazeworld.pdf`), code ids, and storage-key history — do not reintroduce it anywhere player-facing or in docs.

**Google Play:** store entry EXISTS; app is on the **internal-testing track** with friends as testers (first upload 2026-09-10, versionCode 1, built BEFORE DR18). **STANDING RULE (user, 2026-09-13): after every update batch, ASK whether to push a Play internal-testing build** (`npm run play:release` → drop the AAB in Play Console; Developer-API upload not set up yet — `docs/RELEASING.md`). A signed versionCode-2 AAB with DR17+DR18 was built 2026-09-13 13:48 and handed to the user to upload.

**Build/env:** `npm test` (951/951 as of v1.1 close) · `npm run android:debug` (debug APK) · `npm run play:release` (bump `android/version.properties` → build www → cap sync → pin-jdk → signed `bundleRelease`; keystore creds in git-ignored `android/keystore.properties`, alias `key0`, keystore `C:/Users/Dell/android_store_keys/delvedierepeat.jks`). All JDK paths resolve to `JAVA_HOME` = `C:/Program Files/Microsoft/jdk-21.0.10.7-hotspot/` (gradle.properties pin + Studio's gradleJvm=#JAVA_HOME). `tools/gradle.mjs` runs the wrapper (this machine sets `NoDefaultCurrentDirectoryInExePath=1`). `npx cap sync` wipes `org.gradle.java.home`; pin-jdk re-applies it. AGP 8.13.0 / Gradle 8.14.3 — don't let Studio upgrade.

**Device:** Pixel 7 wireless adb (`adb-28051FDH200H0R`, 10.0.0.175:<port rotates>; rediscover via `adb mdns services`). Deploy = `adb install -r` + `am force-stop` + `monkey` relaunch (install alone doesn't reload the WebView). A Play-installed build and a local build have different signers — uninstall one before installing the other (Preferences data is lost on uninstall). Screenshots via screencap usually hit the lock screen — the user reviews and reports.

**Engine gate (non-negotiable, every change):** engine pure/deterministic; parity byte-identical for solo/empty-party play; new rng draws only behind new-feature guards; new serialized fields carved out in all 3 `*Comparable()` fns (`test/parity/harness/comparables.js`); `test/parity/prototype-master.js.txt` NEVER edited; every new event type gets an `EVENT_NARRATION` entry (coverage guard). Deliberate divergences regenerate only their specific fixtures, with rationale. (Also stated in `ROADMAP.md` as the Engine Gate preamble.)

**v1.1 phase order (ROADMAP.md, archived):** 17 Fixture Inventory & Foe-Turn Refactors → 18 Bestiary Rebalance & Canon Combat Fixes → 19 Foe Abilities/Spellcasting/Symmetric INT Resistance (`--research-phase` recommended) → 20 Parley Balance & Language System → 21 Consolidated Difficulty Retune (`--research-phase` recommended; TUNE-04 human DR sign-off came back tune-again, deferred to v1.2).

**v1.2 phase order (ROADMAP.md):** 22 Class-Aware Harness & BEFORE Matrix (HARN-01..04, PLAY-01 — must land first; the BEFORE matrix is impossible to recover later without git archaeology) → 23 Casters Can Act (IDENT-01..04, FID-06 — Wizard/Summoner/Illusionist "cannot act" fixes + guaranteed attack spell) → 24 Every Sub-class and Race: One Good, One Bad (IDENT-05..10, FID-07; `--research-phase` recommended) → 25 Nothing Happens Silently / Feature Feedback (FEED-01..06) → 26 Mass Playtest & Class-Pass Ledger (PLAY-02/03) → 27 Delve-to-Death Retune (TUNE-05..07; `--research-phase` recommended; TUNE-05 target band + TUNE-07 human DR round are both `/gsd-discuss-phase` candidates before planning).

**Working method:** GSD phases (autonomous runs) for systems work; on-device DR rounds (small user-directed batches, each with a `DR*-SUMMARY.md`) for UX. Commit per batch — do not let the tree sit uncommitted for days. Remote: `origin` = https://github.com/sheibeck/ddr (public). Push is a user-run step (`! git push`) — the auto-mode classifier blocks pushes from Claude.

## Accumulated Context

### Blockers/Concerns (open)

- [Balance]: Phase 21 (v1.1) landed the deep-floor scaling knobs (foe cap 5 / power ×1.6 / ability cadence ×2 past floor 5) and the dev start-at-depth harness, but the human DR round (2026-09-14) found depth 20 "instant death on any combat" → TUNE-04 verdict **tune-again, DEFERRED by the user** until player power moves. This retune now lands as **Phase 27 of v1.2**, after the identity pass (Phases 23–24) and mass playtest (Phase 26) give it a corrected yardstick. Ledger: `docs/DIFFICULTY-RETUNE.md`.
- [Play launch]: target-API level, Data Safety fields, and IARC questions shift yearly — re-verify against current Play Console Help right before the production phase. Repo-side: a dependency/SDK audit proving "no data collected" is still owed.
- [Tutorial]: `04-10-PLAN.md` (archived) predates the DR-era UI — re-plan, don't execute as-is.
- [Play testers]: internal testers are on the pre-DR18 build until the versionCode-2 AAB is uploaded.
- [Baseline caveat]: the 400-seed pre-milestone bot baseline (`docs/CLASS-PASS.md` once written) casts only thrown spells, so caster sub-classes were under-measured before Phase 22's harness fix — treat pre-Phase-22 numbers as a floor, not a true reading.

### Pending Todos

- Set up Play Developer API upload (service account) so `play:release` can push to the internal track without Console drag-and-drop — user steps in `docs/RELEASING.md`.

### Roadmap Evolution

- Phase 25.1 inserted after Phase 25: Device Feedback Batch (user, 2026-09-15): card only for decisions, toast-only minor events with narrative text, longer tap-to-dismiss toasts, teleport toast, Oracle fills screen + opens at newest, Joiner swap with snark, Joiners fight by class, camp refusal shows need/have and counts the party (URGENT)

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-09-13 (v1.0 override closeout):

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 01/02/03 VERIFICATION.md `human_needed` | accepted — end-of-milestone UAT satisfied by DR1–DR18 on-device play + Play internal testers |
| quick_task | rules-text-audit-pass (20260909) | missing SUMMARY → shipped as Phase 04.2 |
| quick_task | 260908-kkq-rename-product-to-delve-die-repeat-and-s | partial → landed in f81942f |
| requirement | UX-06 first-run tutorial (04-10) | user-deferred until the UI settles (build LAST, after v1.1/v1.2) |
| requirement | STR-01..04, STR-06 production launch | in progress by the user; repo-side audit owed; after v1.1/v1.2 |
| requirement | PARTY-10 consolidated difficulty retune | landed in Phase 21 (v1.1); TUNE-04 re-attempt now Phase 27 (v1.2) |
| v2 | Networked multiplayer (MP-01/02) | post-launch; party layer already shipped as its foundation |
| v2 | DR16-G "squares of opponents" / Amulet of Stone 4-target | tracked as UI-V2-03 in REQUIREMENTS.md v2 Requirements |

## Session Continuity

Last session: 2026-09-15T06:35:26.266Z
Stopped at: Completed 25-05-PLAN.md
Resume file: None

## Operator Next Steps

- Start Phase 22 (Class-Aware Harness & BEFORE Matrix): `/gsd-plan-phase 22` (or `/gsd-discuss-phase 22` first if more context is wanted — it's dev-tooling, discuss is optional here).
- Phase 24 and Phase 27 are flagged `--research-phase` at planning time.
- Phase 27 is also a `/gsd-discuss-phase` candidate before planning: TUNE-05 needs a target band agreed with the user, and TUNE-07 is a human DR round (`human_verify_mode: end-of-phase`).

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 17 P01 | 30min | 2 tasks | 4 files |
| Phase 17 P02 | 20min | 2 tasks | 3 files |
| Phase 17 P03 | 25min | 2 tasks | 2 files |
| Phase 18 P01 | 28min | 2 tasks | 3 files |
| Phase 18 P02 | 20min | 2 tasks | 6 files |
| Phase 18 P03 | 25min | 2 tasks | 3 files |
| Phase 18 P04 | 30min | 2 tasks | 4 files |
| Phase 18 P05 | 20min | 2 tasks | 2 files |
| Phase 18 P06 | 45min | 2 tasks | 3 files |
| Phase 19 P01 | 25min | 2 tasks | 5 files |
| Phase 19 P02 | 30min | 3 tasks | 9 files |
| Phase 19 P03 | 45min | 3 tasks | 5 files |
| Phase 19 P04 | 55min | 3 tasks | 5 files |
| Phase 20 P01 | 35min | 3 tasks | 6 files |
| Phase 20 P02 | 55min | 3 tasks | 7 files |
| Phase 20 P03 | 50min | 3 tasks | 4 files |
| Phase 21 P01 | 50min | 3 tasks | 5 files |
| Phase 21 P02 | 45min | 2 tasks | 4 files |
| Phase 21 P03 | 15min | 3 tasks | 13 files |
| Phase 21 P04 | 70min | 2 tasks | 4 files |
| Phase 21 P05 | 35min | 2 tasks | 1 files |
| Phase 22 P01 | 25min | 2 tasks | 3 files |
| Phase 22 P02 | 40min | 3 tasks | 2 files |
| Phase 22 P03 | 20min | 3 tasks | 4 files |
| Phase 22 P04 | 21min | 3 tasks | 3 files |
| Phase 23 P01 | 25min | 3 tasks | 5 files |
| Phase 23 P02 | 13min | 3 tasks | 7 files |
| Phase 23 P03 | 12min | 3 tasks | 5 files |
| Phase 23 P04 | 20min | 3 tasks | 8 files |
| Phase 24 P01 | 55min | 3 tasks | 7 files |
| Phase 24 P02 | 20min | 2 tasks | 6 files |
| Phase 24 P03 | 50min | 3 tasks | 9 files |
| Phase 24 P04 | 35min | 2 tasks | 4 files |
| Phase 24 P05 | 45min | 3 tasks | 7 files |
| Phase 24 P06 | 70min | 3 tasks | 1 files |
| Phase 24 P07 | 40min | 3 tasks | 2 files |
| Phase 25 P01 | 30min | 3 tasks | 9 files |
| Phase 25 P02 | 25min | 3 tasks | 7 files |
| Phase 25 P03 | 20min | 3 tasks | 2 files |
| Phase 25 P04 | 35min | 3 tasks | 2 files |
| Phase 25 P05 | 20min | 2 tasks | 2 files |

## Decisions

- 2026-09-14 (v1.2, Phase 22): **Difficulty target is depth 20, not infinite depth — and reaching 20 is a unicorn run, rare not expected** (too much RNG to define a "competent player"; band = median death depth well below 20 + a small reach-20 rate). Past 20: imminent death expected, but no dial-back and no artificial death — the run wraps up naturally on the existing curve. Governs Phase 27 TUNE-05's target band; the depth-20 matrix slice is the yardstick.

- [Phase ?]: 17-01: fixtureRoster.js replays fixtures via applyStartCombat/applyAction/runEconomyAction rather than re-deriving startCombat math; foes snapshotted only on the null->non-null state.combat transition (once per script/scenario)
- [Phase ?]: 17-02: applyFoeDamageToPlayer avoids an internal f=foe alias so its killFoe/die call sites read as the literal parameter name, matching the plan's textual acceptance-criteria greps
- [Phase ?]: 17-02: options-object signature (state, foe, rng, events, { dmg, roll, need }) locked per CONTEXT.md's small-rng-explicit-signature preference over RESEARCH.md's positional draft
- [Phase ?]: 17-03: pinned draw-count integers measured by actually running countingRng against the post-17-02 engine (not hand-traced); matched the plan's PRE-Phase-17 numbers exactly, confirming 17-02's extraction is draw-for-draw identical
- [Phase ?]: 18-01: Werebeast's TTK ratio computes to exactly 2.0 (unflagged) while lethality 2.60 flags it, matching the plan's strict boundary rule precisely; Philly's ttkRatio floats to 2.0000000000000004 due to the twice-doubling path (cosmetic, handled via the curated Review Verdicts disposition, not a code fix)
- [Phase ?]: 18-01: CANON-04's damage-source x creature-type multiplier is out of tools/bestiary-yardstick.mjs's melee-only scope (depends on caster class, not modeled by the composite hero) — documented explicitly in content/BESTIARY-REBALANCE.md
- [Phase ?]: 18-02: implemented damageFoe/multiplierFor exactly per plan's locked order (multiplier -> halfDmg -> soak); no call site routed yet (18-03/18-04 do the routing)
- [Phase ?]: 18-03: reflect damage routed as kind:"reflect" (physical for armor-soak, never multiplier-eligible); ally/member strikes routed as kind:"ally" so D-20 (no Fighter-vs-Trachea doubling for allies) holds structurally
- [Phase ?]: 18-03: renamed playerStrike's damageFoe result binding from the plan's suggested 'hit' to 'landed' to avoid colliding with the pre-existing to-hit boolean of the same name
- [Phase ?]: 18-04: quake's per-foe damageFoe call captures no return value — earthquake.amount reports the single rolled base, not a per-foe applied amount (locked event-shape decision)
- [Phase ?]: 18-04: insaneStruckAlly is now guarded on !hit.soaked — a fully-soaked foe-on-foe blow emits only foeArmorSoaked
- [Phase ?]: D-18: Drake wp 135->38, Werebeast dmg bonus 5->0 (outlier fixes)
- [Phase ?]: D-03: five caster foes (Djinni x2, Krupke, Drudge x2, Vampire, Stalka Beast) get -25% wp pre-ability discount, one dice-step lower melee
- [Phase ?]: 18-06: seam-only invariant test (D-09 promote) proves damageFoe is the ONLY foe-wp decrement site; zero violations found
- [Phase ?]: 18-06: AFTER yardstick table generated verbatim and machine-checked (D-04 doc-consistency test); change ledger records every measured ratio and defers canon-mode consequences (Sterling, five sp.ar creatures) to Phase 21
- [Phase ?]: 18-06: tune-difficulty AFTER readout is within noise of BEFORE (informational only, D-16) — bot never reaches the tier-4/5 creatures this phase retuned
- [Phase ?]: 19-01: lvl on each FOE_ABILITIES descriptor assigned per the canon SPELLS level it borrows (Freeze 1, Weaken/Daze 1-2, Fireball 3, Lightning 4, drain/heal/summon 5, breath 4) — informational only, never read by engine code
- [Phase ?]: 19-01: FOE-06's bounded-strongest-bolt test scoped to kits with 2+ bolt descriptors — Krupke's single bolt (krupkeFreeze, 1d6) is the plan's own locked dice-budget-table unbounded case, not a spam risk
- [Phase ?]: 19-02: resistRoll homed in engine/derived.js (not magic.js as D-07 literally says) per D-17 — the only cycle-free leaf, avoiding the combat.js/foeAbilities.js/magic.js import cycle
- [Phase ?]: 19-02: clearFoeEffect nulls a PRESENT c.foeEffect on load but never injects the key onto a save lacking it, mirroring migrateCarry's additive-with-default discipline
- [Phase ?]: 19-02: stripFoeAbilityState wired into all three parity comparables (movement/combat/economy), not just combatComparable, so D-14 holds structurally even where no fixture currently drives a live combat
- [Phase ?]: 19-03: heroResist pushes heroResisted/heroResistFailed via literal type strings (not a ternary) so the plan's grep-based acceptance check finds both distinct event types
- [Phase ?]: 19-03: test 16 (summoned foe accounting) calls killFoe directly on the joined Skeleton rather than chaining playerStrike through a full rng-heavy kill, proving the same 'ordinary foe entry' claim with a far shorter sequence
- [Phase ?]: 19-04: all five D-15 pinned seeds measured to seed 1 (self-derived by the suite's own firstCasterSeed test, never hand-adjusted); VISITS stayed at 12 (bolt/drain/debuff/summon all covered, no need to raise to 24)
- [Phase ?]: 19-04: Section 4 of test/unit/foe-turn-draw-count.test.js is the append-only home for the D-04 gated-draw-per-ability-kind table; Sections 1-3 remain byte-unchanged since d5fc90a
- [Phase ?]: 20-01: stripParleyDivergence placed directly after stripRationsField in comparables.js, mirroring its exact deliberate-permanent-divergence JSDoc shape
- [Phase ?]: 20-01: full-suite.test.js's carve-out comment avoids the literal function name a third time so grep -c 'stripParleyDivergence' stays exactly 2 (import + wrapper) per the plan's acceptance criteria
- [Phase ?]: 20-01: tools/tune-difficulty.mjs's parley tally is a new counter block + separate parleySummary aggregator beside causeBreakdown; decideAction's policy, MAX_ACTIONS, and the seed stride are byte-for-byte unchanged
- [Phase ?]: 20-02: killSpFor/fluency homed in engine/derived.js directly after resistRoll (cycle-free leaf precedent)
- [Phase ?]: 20-02: parley's wilmsryVsMagical refusal fires BEFORE C.parleyTried=true so a refusal never consumes the one attempt (D-12)
- [Phase ?]: 20-02: C.parleyTried/C.parleyInsulted are lazily written, never initialised in startCombat -- startCombat/pursuitStrike md5 pins unchanged (D-16/D-19)
- [Phase ?]: 20-02: mazeworld.html's classic canParley()/fluency() mirror landed in the same commit as the engine rewrite (D-17); the dead classic parley() re-verified hash-identical
- [Phase ?]: 20-03: expectedCanParley oracle is a prose restatement of D-11/D-12 (never calls canParley), verified against all 576 live cases (mismatches=0, magicalTrue=24, wdTrue=0, plainHumanSoldierTrue=0)
- [Phase ?]: 20-03: parley-button-mirror.test.js extracts mazeworld.html's LIVE classic fluency()/canParley() with fs.readFileSync+new Function and replays the same 576-case matrix — zero disagreements; tripwire confirmed on a scratch copy (flu<2 -> flu<1 drift caught)
- [Phase ?]: 20-03: seed-303 AFTER numbers (need 17, sp 7, gold 50, draws d20=2 d6=5 d6=5) taken from the passing test/unit/parley.test.js D-21 test, not hand-computed, before writing FIXTURE-INVENTORY.md's divergence table
- [Phase ?]: 20-03: tune-difficulty AFTER readout (200 seeds) measured attempts 151->97, success 57.6%->60.8%, SP share 3.7%->2.3% -- informational only, no dial changed, Phase 21 owns the retune
- [Phase ?]: 21-01: findCastableAttackSpell scoped to cls==="Magic User" — canCast itself has no class check, so the guard is required to honor D-05's own (Magic Users) wording
- [Phase ?]: 21-01: bot decideAction gained ctx.parleyBlocked (Rule 1 fix) — the wilmsryVsMagical parley branch refuses without consuming C.parleyTried by design, so the bot must fall through to flee instead of retrying parley forever
- [Phase ?]: 21-02: every new constant (FOE_CAP_MAX/FOE_POWER_MAX/ABILITY_THREAT_MAX) is identity (=== its BASE) in this plan — difficultyCurve(depth) returns foeCap:3/foePower:1/abilityThreat:1 at EVERY depth until 21-04 retunes
- [Phase ?]: 21-02: foeDmgBonusFor scales the lvl*lvl base term of a foe melee swing (not sp.dmg dice), keeping damageFoe the one foe-wp decrement seam and adding zero new draws
- [Phase ?]: 21-02: the summon literal in foeAbilities.js#resolveFoeAbility is deliberately not routed through foeWpFor — reinforcements are already tier-limited weak foes; scaling them is a 21-04-only option
- [Phase ?]: 21-03: startAt sanitisation reuses difficultyCurve's own safeDepth clamp rather than a bespoke clamp — 0/-3/NaN/1.5/Infinity/'abc'/undefined all sanitize to 1 for free
- [Phase ?]: 21-03: three per-domain parity test files (movement/combat/magic-parity.test.js) carry their own local comparable() duplicates predating the shared harness extraction — these needed the same dev carve-out or parity dropped to 21/30 (Rule 1 fix)
- [Phase ?]: 21-04: retuned FOE_CAP_MAX=5/FOE_POWER_MAX=1.6/ABILITY_THREAT_MAX=2.0 (iteration 1) and raised FOE_POWER_SOFT_K/ABILITY_THREAT_SOFT_K (iteration 2, per D-11) — confirmed via real re-run that the D-09 median/p90/actions-per-floor targets can't move because the bot rarely survives past depth 5-10; both conditional counterweights (lootDepth, memberUpkeepScale) never fired, so neither was added
- [Phase ?]: 21-05: curve values for the DR checklist's three run tables (depth 20/35/50) were computed by running difficultyCurve() directly against the frozen engine via node -e, not hand-derived
- [Phase ?]: 21-05: the 21-30/31-50 depth bands have zero bot samples in every readout across the phase's ledger, so Run 2/3's 'What to expect here' lines say so explicitly rather than inventing a caster-encounter-rate expectation
- [Phase ?]: 21-05: adb was unreachable from this shell and this plan's own project notes forbid the executor from deploying to the device itself — recorded the debug APK's build success and path instead of attempting adb install
- [Phase ?]: 22-01: normalizeForce infers cls from sub, guards sub-forced/race-natural-Fridgian before the reroll loop; pinned seeds 7920/23758/31677 (one per class) proven byte-identical to forced-with-own-combo
- [Phase ?]: 22-02: chooseSpell (kill/damage/disable/heal/ward-opener tiers) replaces the thrown-only cast rule; ctx.fleeBlocked/strikeBlocked mirror the parleyBlocked Rule-1 pattern to fix the Samurai/Wizard refusal loops plus a third loop (Mirror Self opener missing a charges-left guard) found during self-verification
- [Phase ?]: 22-02: playRun forwards opts.startDepth/opts.force to newRun (HARN-04) and returns stuck/outcome/startDepth/floorsGained/encountersSurvived; reachTable/actionsPerFloorDist exclude stuck runs, botLine is the single emitter of the ledger's Bot: line
- [Phase ?]: 22-03: resolveForce (CLI-facing) lives in class-matrix.mjs, infers cls from sub, refuses Fridgian Samurai before newRun; distinct from engine/character.js's normalizeForce
- [Phase ?]: 22-03: matrix work distributed BY CELL through a main-thread worker_threads queue -- confirmed byte-identical cells/rollups under --workers 1 vs 4 (--race Troll --seeds 2); JSON carries no timing field (elapsed goes to stderr only)
- [Phase ?]: 22-03: tune-difficulty's death-cause pct denominator kept as results.length (unchanged wording); only the underlying cause/depth source switched to completed (non-stuck) runs
- [Phase ?]: 22-04: BEFORE matrix captured 0 stuck across 5720+1430 runs (Plan 22-02's fixes hold at full scale); pin 5565b22 proven byte-identical to 1b4daed except the dev-only force option; IDENT-01 finding (Wizard/caster cannot melee with charges but no attack spell) documented, deferred to Phase 23
- [Phase ?]: 23-01: spellLevelFor/ATTACK_SPELL_KINDS/isAttackSpell/castableAttackSpells homed in engine/derived.js (cycle-free leaf) so Plan 02/character.js and Plan 03/combat.js can both import them without an import cycle
- [Phase ?]: 23-01: castableAttackSpells deliberately ignores remaining charges; the charge check stays at Plan 03's Wizard-refusal call site
- [Phase ?]: 23-01: rng-pin test (Task 1) committed strictly before any engine/content edit; all 20 rollCharacter/newRun cursor pins and 8 per-sub rollGrimoire draw-count pins independently re-measured against the untouched engine and matched the plan's table exactly
- [Phase ?]: 23-02: dayOnePool (spare pool predicate) frozen byte-identical; usableNow (ready-count only) routed through spellLevelFor; attack top-up walks the already-shuffled spare list with zero new rng draws
- [Phase ?]: 23-02: Summoner exempt from attack top-up (belt-and-braces guard; spare structurally never has an attack-kind spell for it anyway)
- [Phase ?]: 23-02: fixed cross-realm assert.deepStrictEqual failure comparing vm-sandboxed prototype values against plain JSON values in the new chargen divergence assertions -- switched to diffState (structuredClone-based), matching the rest of the parity harness
- [Phase ?]: 23-02: measured chargen fixture divergence set is exactly {15, 24} as predicted; declared in a new divergences block (chargenDivergenceFor/stripDeclaredFields) rather than a blanket regeneration
- [Phase ?]: 23-03: castableAttackSpells(state) is the single Wizard-refusal gate; combat.js imports it rather than re-declaring the attack-kind set
- [Phase ?]: 23-03: IDENT-03/04 in-combat Summon/Phantom Host tests use an empty foe list so afterPlayerAction's encounterCleared short-circuit keeps the rng sequence to exactly the summon-branch draws, while still exercising the real C.ally assignment via a locally-captured combat reference
- [Phase ?]: 23-03: reused test/unit/combat.test.js's lethal-hit rng sequence ([1,3,4,5,20,1]) verbatim for every 'the caster still swings' assertion -- sub-agnostic since cls Magic User never enters the Thief-only backstab/heavy-armor branches
- [Phase ?]: 23-04: Freeze routes through killFoe (frozenSolid before killFoe; kill-twice foe revived, unfrozen); spellAboveLevel reads spellLevelFor; magic cast-damage divergence declared/machine-checked under FID-06
- [Phase ?]: 23-04: stripScenarioDivergence added as the scenario-scoped analog of chargenDivergenceFor/stripDeclaredFields, applied at both magic parity replay sites
- [Phase ?]: Phase 24-01: Court Mage boredom draw sequence measured with a permissive looseRng fallback rather than hand-verifying the full content-driven killFoe/foeTurn tail
- [Phase ?]: Phase 24-01: Bard party targeting reinterprets pickFoeTarget's existing draw (intel<=3 foe targets Bard outright) rather than skipping the mechanic, per plan discretion
- [Phase ?]: Phase 24-01: dropped two pre-existing unit-test fixtures' foe maxWP to 19 to avoid an incidental collision with the new Knight-vs-big-foe initiative rule
- [Phase ?]: 24-02: stockMarkupDiff imported aliased (stockMarkupDiff as checkStockMarkup) in economy-parity.test.js/full-suite.test.js to satisfy the plan's literal grep -c == 1 acceptance criterion while still genuinely importing and calling it
- [Phase ?]: Fridgian hide stacks with Hardiness as a second Math.max(1, dmg-N) step; Dwarven armorWear applies only to the subtracted durability amount, not the soak gate.
- [Phase ?]: combat/lose (seed 14) declared action-path divergence (fromAction 1, died->won); lose-apprentice (seed 127) restores death-path parity coverage.
- [Phase ?]: 24-04: priceFor/sellPriceFor gain an optional third sub argument (default null) for a Pickpocket's x1.25 buy / x0.75 sell markup; sellPriceFor's internal priceFor call omits sub so the markdown never compounds with the markup
- [Phase ?]: 24-04: economy fixture (seed 3, Human Pickpocket) declared an action-path divergence (fromAction 0, stockCostMul 1.25) — store roll proven byte-identical via stockMarkupDiff while gold/weapon/items diverge because purchases run dry two items earlier on the engine side
- [Phase ?]: 24-05: pinned Wilmsry-vs-Magic-User joiner seeds (1 refused, 5 accepted) via a live 1..500 scan, following the project's measured-not-hand-computed pin convention
- [Phase ?]: 24-05: armorRefusalReason checks noArmor -> woodsman -> tooHeavy -> null in that order so a Woodsman's Mail/Plate refusal fires even though the generic class/Heft rule would otherwise call it legal
- [Phase ?]: 24-05: openStore's armour filter gates on canEquipArmor directly so a Woodsman is never offered an illegal armour line (vs. buy-then-reject)
- [Phase ?]: Race rows in the identity-contract table are ordered Human-first (matching Object.keys(RACES)'s real declaration order), not narrative Human-last
- [Phase ?]: identity-contract's hero() neutralizes only cosmetic/transient chargen fields (skills, phobia, buffs, pendingJoiner); sub/race/class-driven rollCharacter output stays real
- [Phase ?]: 24-07: good/bad table and smoke-readout table separator rows use spaced '| --- |' cells (not the doc's usual bare '|---|') so the plan's literal grep -c line-count acceptance criteria count them correctly
- [Phase ?]: 25-01: foeToHitVs left untouched; foeToHitBreakdown added as a proven-identical narration twin instead
- [Phase ?]: 25-01: weaponRefusalReason mirrors armorRefusalReason; Acrobat dagger-only rule now reports reason 'acrobat' instead of generic 'wrongClass'
- [Phase ?]: 25-01: readScroll's combined silent guard split into two named scrollRefused reasons (noScrolls/pilfer/noRunes), zero draws, no mutation
- [Phase ?]: heroResistFailed's toast text starts with the foe's name (must_haves FEED-03 contract), not the action-body's 'You fail to resist' illustrative wording
- [Phase ?]: TOAST_FOR is exactly 189 entries — the verified set-complement of ORACLE_ONLY (21) within EVENT_NARRATION's 209-type universe
- [Phase ?]: spellChain borrows the spell name from the originating spellThrown event (engine spellHit/spellMissed carry none of their own) rather than adding a new engine field
- [Phase ?]: spellResisted's wording dropped its trailing period to match the no-period aggregate-format convention; toastTable.test.js's pin uses .includes() so it stays compatible
- [Phase ?]: Hoisted the toasts.js import to the top of the module script to escape a pre-existing false block-comment span (a doc comment mentioning @capacitor/* reads as an unterminated /* to a naive comment-stripping source scan)
- [Phase ?]: Split the CSS-tone and dispatchWithToasts/switch-deletion work into two commits along the diff's natural hunk boundaries rather than exact plan task numbering — all acceptance criteria still satisfied
- [Phase ?]: 25-05: No toasts.js fix needed — 25-02/25-03 already satisfied the exact TOAST_FOR/ORACLE_ONLY partition and FEATURE_EVENTS coverage this plan's guards assert; toastsCoverage.test.js turns those one-off facts into standing tests.
- [Phase ?]: 25-05: eventNarration.js re-exports TOAST_FOR/ORACLE_ONLY/FEATURE_EVENTS/toastsForAction from toasts.js (one-directional, no import cycle) so both tables are reachable from one module.

### Blockers

- None open for v1.2 planning — Phase 21's TUNE-04 human_needed blocker resolved into the v1.2 milestone itself (retune now scheduled as Phase 27, after the identity pass gives it a corrected yardstick).
