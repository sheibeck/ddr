# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Delve, Die, Repeat: Android build & internal testing

**Shipped:** 2026-09-13 (override closeout — internal testing live; production launch + tutorial carried forward)
**Phases:** 17 | **Plans:** 37 (+18 device-review rounds) | **Sessions:** ~8 over 7 days | **Tests:** 683

### What Was Built
- The 1994 tabletop prototype extracted into a pure, deterministic, serializable `applyAction` engine, byte-identical to a frozen golden master on every commit.
- A native Capacitor Android app with durable saves, lifecycle handling, offline fonts, haptics, and a signed CLI release pipeline — on the Play internal-testing track with real testers.
- Endless descent, a dark torch-lit mobile UX built from the Claude Design mock, a rules-fidelity sweep (phobias, stats, terminology), the Joiner party system, a real loot economy, the Oracle voice + safety scan.

### What Worked
- **Frozen golden master + parity harness first (Phase 1).** Every later system (party, economy, phobias, flight) landed with "byte-identical for solo play" as a mechanical gate, so "prototype is canon" never degraded into vibes.
- **Wrap, don't port.** The same JS ran in a browser (Claude-in-Chrome measured layouts on a :5599 static server) and in the WebView; native issues were isolated to Capacitor config.
- **Device-review (DR) rounds.** Small user-directed batches, built + sideloaded + reviewed live on the Pixel 7, converged the UX in 18 rounds. The user's play was the UAT; formal per-phase human verification would have been slower and less honest.
- **Autonomous milestone runs for systems work** (`/gsd-autonomous --from 7 --to 11`, `--from 12`) with executor-per-phase + immediate parity verification: Joiners and Economy each shipped in a day.
- **Zero-dependency discipline.** No bundler, no runtime deps beyond Capacitor plugins — Data Safety is a truthful "no data collected" and builds never broke on upstream churn.

### What Was Inefficient
- **GSD bookkeeping drifted from reality.** DR rounds and quick-task batches wrote SUMMARYs but no PLAN/VERIFICATION files, so gsd-tools saw finished phases (04.2, 5, 7–16) as "partial"; the closeout needed a manual reconciliation pass. Decide up front whether a batch is a GSD phase (full artifacts) or a DR round (summary only) and mark the roadmap accordingly.
- **Token-limit cutoffs without a snapshot.** The 09-10 session died after writing DR18 but before building; the next session reconstructed state from file mtimes. Write the STATE snapshot *before* the last big edit batch, not after.
- **Unbuilt source drift.** `www/` and the device fell behind source twice; the Play AAB shipped without DR18. `play:release` now rebuilds `www/` unconditionally.
- **Three JDK 21s** (Temurin pin, Microsoft `JAVA_HOME`, Studio's JBR) plus `cap sync` wiping `gradle.properties` produced recurring "which JDK" churn — fixed only at the end by pointing everything at `JAVA_HOME`.
- **Working tree uncommitted for 5 days** (117 files) by convention — a `git checkout .` away from losing everything. Commit at least per DR round.

### Patterns Established
- Parity gate for engine changes: new rng draws only behind new-feature guards; new serialized fields carved out in all three `*Comparable()` fns; `prototype-master.js.txt` never edited; regenerate only the specific fixtures a *deliberate* divergence changes, with rationale.
- `EVENT_NARRATION` as the single data-driven narration table with a coverage guard — a new engine event type fails a test until narrated.
- `window.__mz*` / `window.mz*` bridges between the classic (non-module) script and the pure ES modules; the classic gameplay functions are strangler-fig'd dead code.
- Presentation flags on `state.combat`/`state.beats` (e.g. `awaitingFight`) rather than engine changes when the UX needs a gate the rules don't have.
- Release: `android/version.properties` is the single version source; `npm run play:release` bumps → builds → signs; `docs/RELEASING.md` is the runbook.

### Key Lessons
1. Build the determinism/parity harness before touching rules — it turned every "did this break canon?" question into a test result.
2. Treat the device as the spec for UX; treat the frozen master as the spec for rules. Different verification modes for different work.
3. When an autonomous run finishes a phase via a non-GSD path (DR/quick), immediately reconcile the roadmap or the next autonomous run will try to redo it.
4. Any store-signed install blocks local sideloads (signer mismatch) — plan the tester track and the dev loop as two separate install paths.
5. One consolidated balance retune after all power-changing systems land (party, economy, monsters) — never per-system.

### Cost Observations
- Model mix: predominantly Opus (1M context) main sessions with GSD executor/verifier subagents on the balanced profile.
- Sessions: ~8; two ended on the token limit.
- Notable: parity failures were the cheapest bugs of the project (caught at commit, root-caused by diffState); UX churn was the most expensive (18 rounds, all necessary).

---

## Milestone: v1.1 — Monster Balancing & Abilities

**Shipped:** 2026-09-14 (override closeout) · 5 phases / 21 plans / 50 tasks · 683 → 951 tests

### What Worked
- Baseline-first phases (fixture inventory, draw-count pins, BEFORE readouts captured before any engine change) made every deliberate rule change provable and every parity break attributable within minutes.
- Smart-discuss batch tables + research-resolved follow-ups: research corrected four CONTEXT premises (parley was never 2.5×; no hire cost; no store depth-pricing; foe count physically capped at 3) before a single plan was written.
- Code review + verifier earned their cost twice (Vampire-summon level bug; the pursuit-strike insult gap, where the verifier caught the orchestrator's own wrong "unreachable" call — the Spectre is a Demon).

### What Didn't
- Harness targets (D-09) were set for a bot that can survive floors 1–5; it can't, so the deep-scaling dials were invisible to the proxy and the retune shipped untested by the bot — then failed the human round (depth 20 instant death). Lesson: validate the proxy's reach before setting targets on it, or tune with the dev start-at-depth harness from the start.
- Usage: verification agents ≈ 28% of per-phase tokens and the Opus planner ≈ 20%; the user hit weekly limits mid-Phase-21 and turned verification off globally.

### Cost Observations
- Sessions: 1 long autonomous session for Phases 19–21 (Opus 1M orchestrator; Sonnet executors; Opus planner). Verification agents disabled from Phase 21 wave 1 onward.

---

## v1.2 Class Pass & Mass Playtest (2026-09-14 → 2026-09-15)

**What worked**
- Baseline-first again: the BEFORE matrix (Phase 22) made every later class change measurable, and the AFTER matrix answered the milestone question with numbers instead of impressions.
- A hard gate that stops the phase (cannot-act = 0) found a real player-facing bug (a foe killed by ward reflection on its opening turn left combat open with nothing alive) that no test and no play session had caught.
- Inserting a device-feedback phase (25.1) between 25 and 26 kept the on-device notes from piling up and let the AFTER matrix see the party changes.
- Declared, machine-checked parity divergences scaled: four deliberate canon deviations across the milestone, each one scenario, each provable — the fidelity contract still means something.
- Putting the planner's calibration in front of the user BEFORE execution (three rounds on the retune band) avoided an hour of bot runs chasing a target the proxy could not reach.

**What did not**
- The retune band was set before anyone knew the shallow game's ceiling; two user rounds were spent walking the target back. Next time: calibrate the levers' ceiling first, then ask for the band.
- The bot proxy plays the early floors badly (walks off walls, starves in the dark), so its median under-reads a human's; the human DR round is the only real verdict and it was deferred twice (v1.1 and v1.2) — build the round into the milestone's middle, not its tail, when the phone is available.
- Executors pause when their own background bot run outlives a turn (three times this milestone); the orchestrator has to poll and nudge.
- GSD state tools do not resolve decimal phase numbers (25.1); STATE.md was patched by hand twice.

**Numbers:** 7 phases, 31 plans, 85 tasks, 161 commits; tests 951 → 1448; parity 33/33; matrix runs 7,150 BEFORE + 7,150 AFTER + 7,150 retune AFTER.

## v1.4 Combat & Map Screens (2026-09-16, one day)

**What was built**
- Combat screen rebuilt to the imported Claude Design mock: dark three-band panel, foe cards with guarded tap-to-target, YOUR LOT strip, newest-first › fight log with tap-to-reveal dice (refusals as dull entries), 2×2 STRIKE / SPELLS-or-ABILITIES / ITEMS / SOCIAL grid with per-class submenus, the Fight! gate as a reusable MAJOR OVERLAY, and the won / stand-down / fled / dead endings folded into one over-panel.
- Map screen rebuilt: HUD strip + condition chips, tap-to-step viewport (D-pad gone), the bottom RAIL replacing every toast in the app and carrying every decision under a global movement lock, the stair-down overlay, MARKS / CENTRE / MAKE CAMP chips + sheets, canvas on the mock palette with glyph marks.
- Six new pure presentation modules (`fightLog`, `combatMenu`, `combatPanel`, `rail`, `tapStep`, `mapMarks`), nine new shell test suites incl. a phase-wide invariant sweep; engine/content/parity untouched for the whole milestone.

**What worked**
- Importing a Claude Design mock as the spec (template + style objects in a trailing comment) gave the planner exact colours/fonts/copy; the user answered the open questions in CONTEXT before the run, so both phases went discuss-free.
- Pure-module-first waves (34-01, 35-01) let the view-model layer be unit-tested before a single `mazeworld.html` line moved, and every later shell wave imported rather than re-derived.
- One plan per wave for the 7k-line `mazeworld.html` on the main tree (worktree base-check degraded to sequential) — zero merge conflicts across ten plans.
- Research caught three CONTEXT inaccuracies before planning (no engine `retarget`, no `pickLock`, climb rolls synchronous inside `move`), and the orchestrator decided them up front so no executor guessed.
- "Defer UAT to end" with orchestrator-authored VERIFICATION.md files kept the run moving with the phone offline; the one APK built after the last edit was installed the moment the phone came back.
- Phase-wide invariant suites (34-05 gate, 35-05 `shell-map-invariants`) turned "no toast anywhere / no D-pad anywhere" from a claim into 37 standing tests.

**What did not**
- Two plans wrote literal grep acceptance criteria that collided with pre-existing dead code (`if (S.dead) {` in the unreachable classic `move()`) — documented, not fixed; grep-count criteria need a scoped region, not a whole-file count.
- Collateral test breakage in files outside a plan's `files_modified` (35-02 → `shell-armor-display`, 35-04 → `shell-map-rail`, `shell-map-hud`) — the planner should list every suite that slices a region an edit can shift.
- The mock's toy mechanics leaked into CONTEXT (pick-the-lock, pre-roll climb preview); the climb dice payload is now a post-UAT quick task instead of landing in-phase.
- STATE.md still pointed at the archived v1.3 when the run started (the new milestone was scaffolded by hand) — phase discovery returned zero phases until the frontmatter was patched.

**Numbers:** 2 phases, 10 plans, 28 tasks, 55 commits; tests 1955 → 2170; parity master untouched; 54 Pixel 7 checks deferred to the milestone-close batch.

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 17 | GSD phases for systems + on-device DR rounds for UX; autonomous runs per inserted milestone; human UAT deferred to milestone end |
| v1.1 | 1 (autonomous) | 5 | Baseline-first phases; smart discuss + research-resolved follow-ups; verification agents switched off for cost; retune deferred after human tune-again |
| v1.2 | 1 (autonomous, compacted once) | 7 (one inserted) | Hard gates that stop the phase; planner calibration before user decisions; device-feedback phases inserted mid-milestone; DR verdict deferred by the user |
| v1.3 | 1 (autonomous) | 6 | Research phase (30) before a UI build; override closeout with the device batch deferred |
| v1.4 | 1 (autonomous, no compaction) | 2 | Claude Design mocks as specs; pure-module-first waves; orchestrator-authored VERIFICATION with deferred UAT; APK built once after the last edit |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 683 | parity byte-identical (solo); every event type narrated (guarded); all copy safety-scanned | 0 runtime deps beyond Capacitor plugins |
| v1.1 | 951 | parity 30/30 with one documented divergence (seed-303 parley); determinism suites for caster encounters; draw-count pins | 0 |
| v1.2 | 1448 | parity 33/33 with four declared divergences (chargen 15/24, combat 14, economy 3, parley 303); class identity contract (70); toast-table partition guard; ledger guards for class pass and retune | 0 |
| v1.3 | 1955 | parity byte-identical (storeRoll carved out); armor/loot/fight-gate suites | 0 |
| v1.4 | 2170 | parity master untouched; 9 new shell suites incl. phase-wide invariant sweeps (no toast / no D-pad / guards / no S-resident presentation state) | 0 |

### Top Lessons (Verified Across Milestones)

1. Determinism harness first — (v1.0; re-verify in Monster Balancing when foes start drawing rng).
2. Reconcile GSD artifacts immediately after non-GSD execution paths — (v1.0).
