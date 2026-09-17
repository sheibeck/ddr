---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Meaningful Choices — Spells, Gear & Abilities
current_phase: 38
current_phase_name: Melee Active Abilities
status: planning
stopped_at: "Completed 37-04-PLAN.md (Phase 37 closed: shell worn rows, EQUIP swap confirm, mzUseItem/COMBAT_DISPATCH slot forms, resume reconciliation card, docs/GEAR-SLOTS.md canon ledger)"
last_updated: "2026-09-17T20:15:13.006Z"
last_activity: 2026-09-17
last_activity_desc: Phase 37 complete, transitioned to Phase 38
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 10
  completed_plans: 10
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-17 after Phase 37)

**Core value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Current focus:** Phase 38 — Melee Active Abilities (v1.5; Phases 36–37 done)

## Current Position

Phase: 38 — Melee Active Abilities
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-17 — Phase 37 complete, transitioned to Phase 38

## Ground Truth (durable facts every session needs)

**App identity:** "Delve, Die, Repeat", appId `com.darktierstudios.delvedierepeat` (PERMANENT — published). Player-facing text uses "Dungeon"/"Game Master". The old working-title string survives only in filenames (`mazeworld.html`, `mazeworld.pdf`), code ids, and storage-key history — do not reintroduce it anywhere player-facing or in docs.

**Google Play:** store entry EXISTS; app is on the **internal-testing track** with friends as testers. Latest upload: **1.4.0, versionCode 5 (2026-09-17)** — the v1.4 combat + map screens with every DR-round fix. **STANDING RULE (user, 2026-09-13): after every update batch, ASK whether to push a Play internal-testing build** (`npm run play:release` → drop the AAB in Play Console; Developer-API upload not set up yet — `docs/RELEASING.md`).

**Build/env:** `npm test` (1448/1448 as of v1.2 close) · `npm run android:debug` (debug APK) · `npm run play:release` (bump `android/version.properties` → build www → cap sync → pin-jdk → signed `bundleRelease`; keystore creds in git-ignored `android/keystore.properties`, alias `key0`, keystore `C:/Users/Dell/android_store_keys/delvedierepeat.jks`). All JDK paths resolve to `JAVA_HOME` = `C:/Program Files/Microsoft/jdk-21.0.10.7-hotspot/` (gradle.properties pin + Studio's gradleJvm=#JAVA_HOME). `tools/gradle.mjs` runs the wrapper (this machine sets `NoDefaultCurrentDirectoryInExePath=1`). `npx cap sync` wipes `org.gradle.java.home`; pin-jdk re-applies it. AGP 8.13.0 / Gradle 8.14.3 — don't let Studio upgrade.

**Device:** Pixel 7 wireless adb (`adb-28051FDH200H0R`, 10.0.0.175:<port rotates>; rediscover via `adb mdns services`). Deploy = `adb install -r` + `am force-stop` + `monkey` relaunch (install alone doesn't reload the WebView). A Play-installed build and a local build have different signers — uninstall one before installing the other (Preferences data is lost on uninstall). Screenshots via screencap usually hit the lock screen — the user reviews and reports.

**Engine gate (non-negotiable, every change):** engine pure/deterministic; parity byte-identical for solo/empty-party play; new rng draws only behind new-feature guards; new serialized fields carved out in all 3 `*Comparable()` fns (`test/parity/harness/comparables.js`); `test/parity/prototype-master.js.txt` NEVER edited; every new event type gets an `EVENT_NARRATION` entry (coverage guard). Deliberate divergences regenerate only their specific fixtures, with rationale. (Also stated in `ROADMAP.md` as the Engine Gate preamble.)

**Engine gate AMENDMENT (user ruling 2026-09-17, Phase 38 discuss — "greenfield, no legacy behaviour"):** new rules are the only rules — do NOT gate new behaviour behind lazy fields or shell-only `newRun` options and do NOT keep old branches alive for fixtures. Where a deliberate change moves a prototype-parity fixture, DECLARE the divergence (before/after rationale) and regenerate that fixture — only the fixtures the change moves, never a silent blanket. Old saves: tolerant load only. The bot always plays the new rules. Prefer a derived rng stream (`makeRng(hash(seed, purpose, …))`) for new rolls that would otherwise reorder floor generation. Master file still never edited; new fields still carved out of the comparables (that is the harness, not a hedge).

**v1.1 phase order (ROADMAP.md, archived):** 17 Fixture Inventory & Foe-Turn Refactors → 18 Bestiary Rebalance & Canon Combat Fixes → 19 Foe Abilities/Spellcasting/Symmetric INT Resistance (`--research-phase` recommended) → 20 Parley Balance & Language System → 21 Consolidated Difficulty Retune (`--research-phase` recommended; TUNE-04 human DR sign-off came back tune-again, deferred to v1.2).

**v1.2 phase order (ROADMAP.md):** 22 Class-Aware Harness & BEFORE Matrix (HARN-01..04, PLAY-01 — must land first; the BEFORE matrix is impossible to recover later without git archaeology) → 23 Casters Can Act (IDENT-01..04, FID-06 — Wizard/Summoner/Illusionist "cannot act" fixes + guaranteed attack spell) → 24 Every Sub-class and Race: One Good, One Bad (IDENT-05..10, FID-07; `--research-phase` recommended) → 25 Nothing Happens Silently / Feature Feedback (FEED-01..06) → 26 Mass Playtest & Class-Pass Ledger (PLAY-02/03) → 27 Delve-to-Death Retune (TUNE-05..07; `--research-phase` recommended; TUNE-05 target band + TUNE-07 human DR round are both `/gsd-discuss-phase` candidates before planning).

**Working method:** GSD phases (autonomous runs) for systems work; on-device DR rounds (small user-directed batches, each with a `DR*-SUMMARY.md`) for UX. Commit per batch — do not let the tree sit uncommitted for days. Remote: `origin` = https://github.com/sheibeck/ddr (public). Claude pushes `master` + release tags at milestone close (user authorization 2026-09-17); if the auto-mode classifier blocks it, retry once, then hand the user `! git push`.

## Accumulated Context

### Blockers/Concerns (open)

- [Balance]: Phase 21 (v1.1) landed the deep-floor scaling knobs (foe cap 5 / power ×1.6 / ability cadence ×2 past floor 5) and the dev start-at-depth harness, but the human DR round (2026-09-14) found depth 20 "instant death on any combat" → TUNE-04 verdict **tune-again, DEFERRED by the user** until player power moves. This retune now lands as **Phase 27 of v1.2**, after the identity pass (Phases 23–24) and mass playtest (Phase 26) give it a corrected yardstick. Ledger: `docs/DIFFICULTY-RETUNE.md`.
- [Play launch]: target-API level, Data Safety fields, and IARC questions shift yearly — re-verify against current Play Console Help right before the production phase. Repo-side: a dependency/SDK audit proving "no data collected" is still owed.
- [Tutorial]: `04-10-PLAN.md` (archived) predates the DR-era UI — re-plan, don't execute as-is.
- [Play testers]: internal testers are on the pre-DR18 build until the versionCode-2 AAB is uploaded.
- [Baseline caveat]: the 400-seed pre-milestone bot baseline (`docs/CLASS-PASS.md` once written) casts only thrown spells, so caster sub-classes were under-measured before Phase 22's harness fix — treat pre-Phase-22 numbers as a floor, not a true reading.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260916-w0c | v1.4 UAT fixes: tap-to-move bridge timing (classic IIFE captured the module bridge before assignment), v1.3 PNG map icons restored (user reversed Phase 35 decision 3), settings gear moved to a chip right of MAKE CAMP, RAIL is a map-tab element | 2026-09-16 | c0e8032 | [260916-w0c-v1-4-uat-fixes-tap-to-move-bridge-timing](./quick/260916-w0c-v1-4-uat-fixes-tap-to-move-bridge-timing/) |
| 2 | fast: boot crash fix — showTab's renderRail call guarded on window.__mzState (hoisted classic global read S in its TDZ; black screen after splash) \| 2026-09-17 \| 7ab68d3 \| inline (/gsd-fast) | 2026-09-17 | 7ab68d3 | — |
| 3 | fast: stuck-after-win fix — renderCombatOver attaches mid before fillMid; won-branch loot hosts resolved inside wrap \| 2026-09-17 \| 49e01fc \| inline (/gsd-fast) | 2026-09-17 | 49e01fc | — |
| 4 | fast: player-facing WP -> HP (HUD readout + rules note) \| 2026-09-17 \| 67192d5 \| inline (/gsd-fast) | 2026-09-17 | 67192d5 | — |
| 5 | 260917-bbs \| v1.4 UAT fixes round 2: composited party pulse + paused under the encounter panel, idle rail hidden while a panel is up, joiner strip off map/combat → Hero-tab Company panel, no inline bag-full line on the loot screen, PNG icons on feature rail cards / hold-inspect / encounter+stair overlays \| 2026-09-17 \| f3cc7e2 \| [260917-bbs-v1-4-uat-fixes-round-2](./quick/260917-bbs-v1-4-uat-fixes-round-2/) | 2026-09-17 | f3cc7e2 | — |
| 6 | fast: rail global — visible on any tab only when it has a card; idle hides everywhere (reverses map-tab-only) \| 2026-09-17 \| a0d7747 \| inline (/gsd-fast) | 2026-09-17 | a0d7747 | — |

### Pending Todos

- (dropped 2026-09-17, user) Play Developer API upload — the user uploads the AAB manually in Play Console when needed.
- 2026-09-17 — Stand up the "Shell Debt & Dead Code" cleanup milestone after v1.5 (`.planning/proposed-milestone-shell-cleanup.md`; todo `todos/pending/2026-09-17-shell-debt-and-dead-code-cleanup-milestone.md`)

### Roadmap Evolution

- Phase 25.1 inserted after Phase 25: Device Feedback Batch (user, 2026-09-15): card only for decisions, toast-only minor events with narrative text, longer tap-to-dismiss toasts, teleport toast, Oracle fills screen + opens at newest, Joiner swap with snark, Joiners fight by class, camp refusal shows need/have and counts the party (URGENT)

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-09-13 (v1.0 override closeout):

| Category | Item | Status |
|----------|------|--------|
| verification | Phases 01/02/03 VERIFICATION.md `human_needed` | accepted — end-of-milestone UAT satisfied by DR1–DR18 on-device play + Play internal testers |
| quick_task | rules-text-audit-pass (20260909) | missing SUMMARY → shipped as Phase 04.2 |
| quick_task | 260908-kkq-rename-product-to-delve-die-repeat-and-s | partial → landed in f81942f |
| requirement | UX-06 first-run tutorial (04-10) | user-deferred until the UI settles (build LAST, after v1.1/v1.2/v1.3) |
| requirement | STR-01..04, STR-06 production launch | in progress by the user; repo-side audit owed; after v1.1/v1.2/v1.3 |
| requirement | PARTY-10 consolidated difficulty retune | landed in Phase 21 (v1.1); TUNE-04 re-attempt now Phase 27 (v1.2) |
| v2 | Networked multiplayer (MP-01/02) | post-launch; party layer already shipped as its foundation |
| v2 | DR16-G "squares of opponents" / Amulet of Stone 4-target | tracked as UI-V2-03 in REQUIREMENTS.md v2 Requirements |

Items acknowledged and deferred at milestone close on 2026-09-16 (v1.4 override closeout — `defer uat to end`):

| Category | Item | Status |
|----------|------|--------|
| requirement | CSCR-10 combat screen DR round (Phase 34) | DONE 2026-09-17 — user-run Pixel 7 round; findings fixed (260916-w0c, 260917-bbs, fast fixes); shipped as 1.4.0 (5) |
| requirement | MAP-10 map screen DR round (Phase 35) | DONE 2026-09-17 — user-run Pixel 7 round; findings fixed; shipped as 1.4.0 (5) |
| follow-up | Climb dice payload (`roll`/`need` on the four climb events) | quick task after UAT — additive, parity-safe; rail already renders it |
| follow-up | ⧗ crevice glyph tofu risk | MOOT — PNG icons restored 2026-09-16 (user ruling) |
| quick_task | rules-text-audit-pass (20260909), 260908-kkq-rename… | stale records, both shipped (re-acknowledged) |

## Session Continuity

Last session: 2026-09-17T20:12:49.666Z
Stopped at: Phase 37 complete (autonomous run, defer-UAT-to-end; 14 Pixel 7 checks queued in 37-VERIFICATION.md), ready to discuss/plan Phase 38
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone

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
| Phase 25.1 P01 | 35min | 3 tasks | 6 files |
| Phase 25.1 P02 | 50min | 3 tasks | 9 files |
| Phase 25.1 P03 | 65min | 3 tasks | 7 files |
| Phase 26 P01 | 40min | 2 tasks | 2 files |
| Phase 26 P02 | 50min | 3 tasks | 3 files |
| Phase 26 P03 | 30min | 2 tasks | 2 files |
| Phase 26 P04 | 40min | 2 tasks | 1 files |
| Phase 27 P01 | 55min | 3 tasks | 5 files |
| Phase 27 P02 | 65min | 4 tasks | 20 files |
| Phase 27 P03 | 72min | 3 tasks | 9 files |
| Phase 28 P01 | 25min | 3 tasks | 4 files |
| Phase 28 P02 | 35min | 3 tasks | 7 files |
| Phase 28 P03 | 30min | 3 tasks | 3 files |
| Phase 29 P01 | 55min | 3 tasks | 9 files |
| Phase 29 P02 | 95min | 3 tasks | 17 files |
| Phase 29 P03 | 50min | 3 tasks | 3 files |
| Phase 30 P01 | 40min | 3 tasks | 1 files |
| Phase 31 P01 | 50min | 3 tasks | 33 files |
| Phase 31 P02 | 55min | 3 tasks | 19 files |
| Phase 31 P03 | 45min | 3 tasks | 8 files |
| Phase 32 P01 | 5min | 2 tasks | 3 files |
| Phase 32 P02 | 12min | 3 tasks | 4 files |
| Phase 32 P03 | 18min | 3 tasks | 3 files |
| Phase 33 P01 | 35min | 3 tasks | 14 files |
| Phase 33 P02 | 19min | 3 tasks | 4 files |
| Phase 33 P03 | 25min | 3 tasks | 3 files |
| Phase 34 P01 | 35min | 3 tasks | 7 files |
| Phase 34 P02 | 19min | 3 tasks | 4 files |
| Phase 34 P03 | 40min | 3 tasks | 4 files |
| Phase 34 P04 | 55min | 3 tasks | 6 files |
| Phase 34 P05 | 55min | 3 tasks | 4 files |
| Phase 35 P01 | 25min | 2 tasks | 6 files |
| Phase 35 P02 | 30min | 3 tasks | 11 files |
| Phase 35 P03 | 50min | 3 tasks | 3 files |
| Phase 35 P04 | 45min | 3 tasks | 5 files |
| Phase 35 P05 | 15min | 2 tasks | 1 files |
| Phase 36 P01 | 27min | 2 tasks | 4 files |
| Phase 36 P02 | 22min | 3 tasks | 9 files |
| Phase 36 P03 | 16min | 3 tasks | 5 files |
| Phase 36 P04 | 24min | 3 tasks | 11 files |
| Phase 36 P05 | 9min | 2 tasks | 9 files |
| Phase 36 P06 | 12min | 3 tasks | 2 files |
| Phase 37 P01 | 22min | 3 tasks | 7 files |
| Phase 37 P02 | 40min | 3 tasks | 8 files |
| Phase 37 P03 | 15min | 3 tasks | 8 files |
| Phase 37 P04 | 25min | 3 tasks | 4 files |

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
- [Phase ?]: narrativeToastText decodes entities amp-last so escaped markup never re-decodes into a live tag; tags stripped before entities decoded
- [Phase ?]: tableFour/tableFourNoop toast the engine's own prose result unchanged rather than deriving a shorter table phrase
- [Phase ?]: campFailed.members is conditionally spread so the solo event shape stays byte-identical to the pre-plan payload
- [Phase ?]: The camp button is dimmed via data-short/CSS, never disabled, so a refused tap still surfaces the campFailed toast
- [Phase ?]: DFB-05: memberView read pattern (default sparse sheet fields) + self-contained allyCast mirror of castSpell's dice shapes in combat.js (magic.js already imports combat.js) + transient C.allies backstabUsed flag
- [Phase ?]: 26-01: verdicts.json carries supplementary classes/rollups fields beyond the documented schema so renderMarkdown(verdicts, section) never needs the raw before/after reports
- [Phase ?]: 26-02: AFTER matrix re-captured on gap-closure pin d1e3235 — cannot-act gate PASSED (0 of 143), supersedes the blocked 620e1df attempt
- [Phase ?]: Only Ninja (too strong) and Wilmsry (fine, named exception) carry an editorial verdict; both accepted -- the caster problem is gone (all 8 Magic User subs land in the fine band).
- [Phase ?]: 26-04: no ledger fix needed; the plan's own f7f294b-based commit-range check is stale (Phase 25.1 interleaved before Phase 26's real execution) — the true engine-touch is the single, already-reviewed d1e3235 gap-closure fix, which IS the AFTER pin; documented in SUMMARY rather than worked around.
- [Phase ?]: 27-01: band substitution per amended 27-CONTEXT.md (4d18e80) — bot median 4 / pooled reach>=5 >=25%, human 5-6 judged by DR round, replacing the plan's original flat 5-6 bot target
- [Phase ?]: Landed Dante Form C (tier-2 demotion + Ned at tier 1) — the only form meeting the decision rule; followed Task 3's literal dial values (FOE_GRACE_AT_2 0.75) over the calibration table's stronger T2 row (0.5).
- [Phase ?]: 27-03: bounded 4-iteration retune landed COMBAT_SCALE_FROM_DEPTH 6->21, FOE_GRACE_AT_2 0.75->0.5, ENCOUNTER_DOT_CAP 15->13, FOE_POWER_MAX/ABILITY_THREAT_MAX flattened to 1.15/1.3 — natural median/reach and forced-20 encounters-survived in band; forced-20 floors-gained recorded as a miss for the DR round
- [Phase ?]: Assumption A1 accepted: combat's armorDestroyed path still leaves c.ar/c.armor/c.armorMax untouched; the destroyed-armor guard lives entirely in wornArmorItem + unequipSlot
- [Phase ?]: rollMailPiece's txt unit token changed from 'wp' to 'hp' for consistency (parity-safe via comparables.js's existing normalizeHpUnit)
- [Phase ?]: 28-02: armorDisplay's current/max always reflect the WORN piece's own pool, never the cloak's — the cloak's magic plate has no separate durability pool to show
- [Phase ?]: 28-02: Cloak of Armor txt rewrite is a genuine but purely cosmetic content divergence from the frozen prototype; carved out via a new stripCloakArmorTxt comparables helper (mirrors stripNameField) rather than editing prototype-master.js.txt or any fixture
- [Phase ?]: 28-03: store repair row relabelling stays entirely in the shell (armorDisplay(S.c).wornSub), never touching engine/economy.js's parity-compared stock sub string
- [Phase ?]: 28-03: findSub/biSub computed as local consts (not inline ternaries) so the find-card/drop-shelf bagArmorText wiring matches the plan's literal grep acceptance criteria verbatim
- [Phase ?]: 29-01: stowItem's potion exemption applies to the refusal check itself (not just the have count) — a potion always stows even at a gear-full bag
- [Phase ?]: 29-01: weaponUpgradeDelta/armorUpgradeDelta return signed deltas so takeItem (<=0 rejects) and lootCompare (>0 upgrade) share one arithmetic source
- [Phase ?]: Plan 29-02: pendingLoot replaces the mid-fight auto-take (offerLoot/takeLoot/leaveLoot/takeAllLoot/leaveAllLoot), forfeited via one hook on flee/die, reconciled byte-identically in all three parity comparables (plus their own local dupes) with zero fixture edits.
- [Phase ?]: Loot screen: window.__mzBagUsage is the ONE capacity readout in the shell (gear panel, find card, loot screen, store) — no raw array-length count survives
- [Phase ?]: noteCombat hands the end-of-fight report to window.__mzLootReport instead of building a 'Move on' beat when drops are pending — the loot card folds the report and the decision into one card (RESEARCH Pitfall 4)
- [Phase ?]: renderDropShelf(shelf, items) extracted from the find card's inline loop, shared by the find card and the new loot screen
- [Phase ?]: 30-01: live re-verification found the toast/Oracle-pinning test total is 89 (15/21/37/8/8), not RESEARCH.md's assumed 98 — doc uses the live count per its own re-verify-before-writing instruction
- [Phase ?]: 31-01: startCombat splits at the roster (pending:true); fight() carries initiative/phobia/pre-emptive-strike in the prototype's exact draw order
- [Phase ?]: 31-01: a triggered phobia sets combat.afraid=2 (a -3 to-hit-need penalty, floor 1, half damage) instead of freezing the hero for a lost turn (user ruling 2026-09-16)
- [Phase ?]: 31-01: the Fight! split reorders the Knight/Con Artist/Court Mage removal loop ahead of initiative (kept its existing code position) -- discovered and re-measured a 4th rng-reordering divergence (combat/parley seed 303) beyond the plan's three declared phobia records
- [Phase ?]: 31-01: lose-plain (seed 1119) restores the byte-identical death-path parity coverage the Afraid ruling took from lose-apprentice (seed 127)
- [Phase ?]: 31-02: Acuteness ticks both per foeTurn round AND per exploration step, clearing unconditionally at endCombat
- [Phase ?]: 31-02: Afraid's damage halving reuses the same post-halved value for Earthquake's self-damage (deliberate reuse per plan text)
- [Phase ?]: 31-02: Elven foeToHit flipped -1 to +1 (DELIBERATE RULES CHANGE, user decision 2026-09-16) at the data layer only; zero fixture impact
- [Phase ?]: 31-03: the dead classic castSpell()'s error-message branch reordered off a stale sp.lvl compare onto the still-valid schoolGate check, so no copy of the fixed IDENT-03/04 bug survives anywhere in the file, live or dead
- [Phase ?]: 31-03: Sing/Scroll button visibility relaxed to the structural gate (Bard; scrolls > 0), not full readiness — songReady()/canRead() still gate the internal countdown math but no longer hide the button, matching the CMB-02 refusal-vocabulary design
- [Phase ?]: inputGuards fail-open resolved by direct short-circuit on non-finite first arg (not coerce-to-0-then-subtract), matching the plan's own behavior spec
- [Phase ?]: Round Card routing uses post-dispatch state.combat (not pre-dispatch wasCombat) so the action that ends combat still toasts its own final-round lines
- [Phase ?]: window.__mzRoundCard is presentation-only, module-scope state (like window.__mzLootReport), never an S field, since serializeRun spreads S wholesale
- [Phase ?]: 32-03: guardTap's internal check written as if (encArmed()) fn(); to satisfy the plan's own literal grep-count acceptance criteria without changing behavior
- [Phase ?]: storeRoll follows the dev boolean precedent exactly (unconditional-on-fresh-state, tolerant-default-false on load, plain destructure-and-drop in comparables) rather than pendingLoot's reconcile pattern
- [Phase ?]: Confirmed 33-RESEARCH.md assumption A2 correction: parity fixtures are newRun(seed) output, so the six-line comparables carve-out (storeRoll) is required, not optional
- [Phase ?]: Armor-cap enforcement can shrink the flag-on stock array by exactly one line (when the flag-off upgrade no longer fits the tier's cap) but never grows it
- [Phase ?]: Drop confirm's Yes handler reverts the armed row before dispatching mzDropItem so a paint() re-render never finds a stale armed confirm
- [Phase ?]: gearRow re-parents already-built buttons into .mw-gear-actions post-loop rather than reordering the actions array, keeping every non-gear renderCarriedList host byte-identical
- [Phase ?]: writeSetting('handedness', ...) is now a no-op (unrecognized key) rather than a schema migration; a stale persisted handedness value is never read back or rewritten
- [Phase ?]: Store stock rolled by depth behind a run flag (state.storeRoll, v1.3 Phase 33): parity stays byte-identical for fixtures/old saves; a newRun option only the shell sets keeps every fixture/bot/pre-Phase-33 save on the frozen roll
- [Phase ?]: 34-01: toastsForAction gains opts.withIdx (Phase 32 opts.limit precedent) + oracleDetailText — fight-log lines sourced from the folded toast pipeline, not raw event HTML, to preserve the 'log line count = folded count' pin
- [Phase ?]: 34-01: combatMenu.js's flee/WITHDRAW cost text mirrors engine/combat.js's own roll logic as display-only — no new engine action added
- [Phase ?]: 34-01: combatPanel.js's YOUR LOT 3-joiner overflow tested via a synthetic state.party array (PARTY_CAP=1 today)
- [Phase ?]: 34-02: window.__mzFightEnd is populated only when the ending dispatch is both wasCombat and no-longer-inCombat; a fresh fight (noteCombat's fresh-fight branch) clears any stale parcel from a previous fight.
- [Phase ?]: 34-02: the flee ending reuses the existing beats surface (after.beats = { groups: [{title:"You got out",tone:"moss",lines:[]}], over:"fled" }) rather than inventing a new presentation channel — Plan 05's beats-branch renders any beats.over as the over-panel.
- [Phase ?]: 34-03 Decision 2: built renderMajorOverlay(host, spec) as a fully generic, parameterised MAJOR OVERLAY function now (icon/title/line/roll/primary+optional-secondary), reused unchanged by Phase 35 for the stair-down and out-of-combat death
- [Phase ?]: 34-03 Decision 3: no engine retarget action exists or was added — foe-card targeting stays the presentation mutation S.combat.target = i; renderEncounter(), now wrapped in guardTap (a real CSCR-08 fix; it was previously unguarded)
- [Phase ?]: 34-04: dropped dead-code spellOpen writes in classic startCombat()/castSpell() (unread, pre-Phase-31 dead code) to satisfy the retired presentation flag's zero-occurrence pin; ITEMS submenu rows reuse cbRow() rather than a fifth renderCarriedList host; a disabled grid button with no opens is a guarded no-op
- [Phase ?]: Phase 34 (CSCR-07/08) closed: fight endings fold into one renderCombatOver over-panel; joiner/find restyled dark; dismissal clears window.__mzFightEnd/__mzCombatMenu. CSCR-10 (on-device DR round) deferred to milestone close per the 27-item aggregated Pixel 7 checklist in 34-05-SUMMARY.md.
- [Phase ?]: Phase 35 Plan 01: rail.js/tapStep.js/mapMarks.js built pure per orchestrator decisions 1/3/4 (no climb-dice engine change, colored glyphs replace PNG marks, no PICK THE LOCK action) — 39 new tests, engine/content/parity/toasts.js/controls.js/icons.js untouched
- [Phase ?]: Phase 35 Plan 02: railLocked() (orchestrator decision 2) locks EVERY movement path globally on a pending joiner/find or a failed climb; joiner/find/climb moved from renderEncounter into renderRail's own decision cards; the Phase 25.1 toast host and Move-on card (CARD_EVENTS/FEATURE_EVENT_TITLE/beatsTitleFor/a-next/stepping()) are fully retired — zero occurrences anywhere in mazeworld.html
- [Phase ?]: Phase 35 Plan 02: MAP-05/MAP-08 deliberately left unmarked in REQUIREMENTS.md despite being in this plan's own frontmatter — their full text spans Plan 03/04 work (stair-down overlay, sheets) not yet built, mirroring 34-02-SUMMARY's identical CSCR-08 precedent
- [Phase ?]: Phase 35 Plan 03: decision 3 (colored glyphs replace PNG marks in draw()/legend) and ruling 5 (condition chips + party rail move out of the HUD into their own strips) landed exactly as specified; the camp chip's onclick was retargeted from a direct dispatch to openCampSheet(), deleting the old assignment outright to keep shell-gear-toolbar's singular-onclick pin intact.
- [Phase ?]: 35-04: stair-down gate is a SHELL pre-dispatch interception (stepTargetsExit peeks read-only before dispatch); the D-pad/control bar are fully retired, tap-to-step/hold-to-inspect replace them; ZOOM_MAX re-ranged 2.4->2.0
- [Phase ?]: Phase 35 closed: shell-map-invariants.test.js (37 tests) proves the whole-phase sweep with zero fixes needed; full executor gate green (npm test 2170/2170, build:www exit 0, engine/content/parity diff empty, master hash unchanged, no new packages/fonts); the v1.4 milestone debug APK built (1.2.0 (3), 9,474,974 bytes) with no adb install attempted; MAP-09 marked complete, MAP-10 deferred with the 27-item aggregated Pixel 7 checklist
- [Phase ?]: 36-01: v1.5 BEFORE class-matrix pin (BAL-01) captured against e69ff07 (byte-identical to v1.4.0) — docs/class-pass/v15-before*.json + docs/CLASS-PASS.md ninth H2 + additive ledger-guard extension
- [Phase ?]: 36-02: engine/effects.js — one plain-JSON c.timers shape, seven pure functions, tick sites wired behind if(c.timers) guards; zero player-visible behaviour, zero draw/parity drift
- [Phase ?]: 36-02: stripTimersField carved into all three *Comparable() fns + the three local comparable() duplicates (combat/magic/movement-parity.test.js), mirroring stripFoeEffectField's structural-tripwire pattern
- [Phase ?]: 36-03: hero() test helper uses sub names (Soldier/Sorcerer), not class names, matching rollCharacter's force-sub validation
- [Phase ?]: 36-03: castSpell retarget test seeds a third live foe + high looseRng fallback so a thrown-kind attack spell's possible kill never clears the encounter before the retarget can be asserted
- [Phase ?]: 36-03: playerStrike draw-count identity test uses a measured (not hand-computed) draw count of 6 via looseRng, since the seed-1 Soldier hero swings more than a bare roll+damage pair
- [Phase ?]: 36-04: Task order (murder mechanics first, refusal reversal second) kept the suite green at every commit — cutthroatMurderCheck landed reachable only via a planted party while the old refusal still stood, then Task 2 flipped the ternary and rewrote every refusal-dependent test in the same commit
- [Phase ?]: 36-04: identity-contract's Cutthroat BAD entry now drives the full accept-then-murder lifecycle (meetJoiner -> resolveJoiner -> cutthroatMurderCheck) instead of a bare refusal assertion, with a Soldier control proving the murder check is Cutthroat-only
- [Phase ?]: 36-05: The plan's own surfaced assumption (dismissRefused as a genuine third event type, not a silent no-op) was implemented exactly as specified — every refusal in this codebase is an event with a toast-table block() entry (FEED-02), so a silent return would have regressed that standing contract.
- [Phase ?]: 36-05: applyAction's rngState-unchanged proof needed a one-time makeRng round-trip normalization on a freshly-captured newRun() cursor before snapshotting 'before' state — mulberry32's constructor coerces a signed seed to unsigned via >>> 0, so the FIRST makeRng() call on a fresh cursor can change getState()'s numeric representation (bit-identical, JS-number-different) even with zero draws. Pre-existing engine/rng.js artifact, not a dismissJoiner defect.
- [Phase ?]: 36-06: DISMISS/confirm controls built via document.createElement/textContent (not template-string innerHTML), matching the Drop confirm's construction style; a local mkConfirmBtn closure was written since mkBtn is local to renderCarriedList
- [Phase ?]: 36-06: 13 other classic-script SUB_NOTE rows remain drifted from content/flavor.js (measured via live node diff) — only Cutthroat was in this plan's CUT-01 scope; logged as a Clarity-phase (43) or quick-task follow-up
- [Phase ?]: 37-01: SLOT_OF derived from the same *_ROWS arrays that build JEWELRY/CLOAKS/STAVES so the taxonomy and exported tables can never drift apart
- [Phase ?]: 37-01: reconcileWorn refuses to re-migrate a c that already carries an own worn key (even empty {}) — proven by a dedicated test, not just documented
- [Phase ?]: 37-01: eff()'s legacy branch left byte-for-byte identical to the pre-refactor loop; new defensive guards apply only to the new worn-path branch
- [Phase ?]: 37-02: itemEquipped.replaced is additive, built conditionally so a no-swap event carries no replaced key at all (not null)
- [Phase ?]: 37-02: notWorn refusal fires after wrongClass, before pilfer, on useRefused; verified by a dedicated ordering test
- [Phase ?]: 37-02: useItem's ref resolution treats bag index 0 correctly (typeof 0 !== object), never misread as a slot form
- [Phase ?]: 37-02: Task 3 legacy-identity sweep uses measured before/after assertions on real newRun(3) output rather than hand-typed literal pins, to avoid a mistyped magic-string pin on non-trivial chargen data
- [Phase ?]: 37-03: the declared engineAdapter.test.js boot-rehydrates-a-save assertion update landed exactly as pre-authorized (boot() now migrates every legacy save, state.c gains worn: {})
- [Phase ?]: 37-03: wornReconcileCard is a standalone directly-built rail card (mirrors railLineCard), not routed through railCardFor's applyAction fold pipeline, since the migration is a load-time event
- [Phase ?]: 37-03: combatMenu's worn-row-ordering test asserts the full row-id array including the always-present potion row, since combatMenu.js unconditionally renders it whenever usableCount !== 0 regardless of c.potions
- [Phase ?]: 37-04: the swap confirm's unarmed button reads Equip (not a pre-labelled Swap) — mirrors the empty-slot Equip button until tapped
- [Phase ?]: 37-04: wornSlotRowRegion() in the new test file is a narrower slice than the full paint-carry region so the once pins on window.mzUnequip?.(slot)/window.mzUseItem?.({ slot }) aren't confused by wornRow's own pre-existing identical call
- [Phase ?]: 37-04: docs/GEAR-SLOTS.md's locked reconciliation copy lives in a markdown blockquote, not inline prose, so the sentence is never word-wrapped across a line break and the doc's own acceptance-criteria grep stays exact

### Blockers

- open for v1.2 planning — Phase 21's TUNE-04 human_needed blocker resolved into the v1.2 milestone itself (retune now scheduled as Phase 27, after the identity pass gives it a corrected yardstick).
