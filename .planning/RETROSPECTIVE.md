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

## v1.6 Shell Debt & Dead Code (2026-09-19 → 2026-09-20)

*(v1.5 "Meaningful Choices" — 2026-09-17 → 2026-09-18, 8 phases, 37 plans, tests 2,179 → 3,168 — has no entry of its own; its audit is in `.planning/milestones/v1.5-MILESTONE-AUDIT.md`.)*

**What was built**
- The classic engine retired from the shell (16 mirrors, the cold-boot chargen, the `new Function` tripwires), with `npm run boot:check` and `tools/shell-sweep.mjs refs|orphans` as standing gates; shell 8,710 → 5,682 lines over the milestone.
- One worn-model path (the Phase 37 hedges collapsed): exactly 13 fixture sites moved, each measured by a committed scan and declared with before/after — the milestone's only fixture change.
- Honest names and dead exports: `toasts.js` → `narrationLines.js`, `winGame`/`won` and `controlScheme` and `tutorial.js` gone, `tools/ident-sweep.mjs` proving zero retired identifiers.
- Gear, Hero and Store as `src/browser/` modules behind one `window.__mzTabs` mount each; 18 dead bridges + 7 classic wrappers deleted; `src/browser/bridge.js` as the one `__mz*` registry (45 names, set-equality test, generated doc); a `node:vm` DOM-snapshot harness that proved every carve byte-equal.
- Stale docs/comments/test names purged with `tools/stale-terms.mjs` (11 rows, classed allow-list, pinned) reading zero; CLAUDE.md Android-only.
- A perf baseline measured on the Pixel 7 with dev-gated marks; two step-path fixes (hidden tabs not rebuilt per step; the duplicate canvas draw removed) — step 14.2 / 28.9 → 11.5 / 19.8 ms (med / p95), paint halved.

**What worked**
- **Measure-first everywhere, not just Phase 49.** Phase 45's fixture scan, Phase 47's BEFORE snapshots, Phase 48's stale-terms table and Phase 49's marks each captured a number *before* the change and compared after — every "did this change behaviour?" question had a mechanical answer, and three shortfalls (the line budget, the p95, the n=47 walk) were recorded as numbers rather than argued.
- **The DOM-snapshot harness paid for itself four times:** three carves and two perf fixes landed with the seven fixtures byte-equal; two harness bugs (node re-parenting, `innerHTML` not invalidating ids) were caught by the plan's own idempotency check before the fixtures were captured.
- **Standing tripwires instead of one-off greps:** `boot:check`, `shell-sweep`, `ident-sweep`, the bridge registry test, `stale-terms` — each phase's closing grep became a test the next phase runs for free.
- **Honest-shortfall protocol.** 47-05 recorded "NOT MET — 5,621" with a classified breakdown instead of chasing the number; the user re-baselined in one question. Same for Phase 49's p95: the rule said revert, the numbers said keep, the user ruled, the doc says both.
- **Sequential executors on the main tree with a stall watch keyed on commits + file mtimes** (transcript mtime proved unreliable) — 23 plans, zero merge conflicts, one restart (a session end, not a hang) with nothing lost.
- **Device rounds only where the phase IS the device** (Phase 49): three APK installs over the sideloaded build kept the on-device save alive for the UAT batch.

**What did not**
- **Planning estimates for line counts were wrong twice** (ROADMAP's "< 5,000" and the CONTEXT's "≈ 400+ lines of Hero"); the fallback lever (move private helpers) had nothing in scope. A line budget should be measured from a scouted deletion set, not guessed.
- **The perf rule ("< 16 ms or revert") was written before the measurement existed** and turned out to be the wrong shape: the remaining p95 is route variance plus the real cost of the dark-region draw, not waste. Rules that gate on a single threshold need a variance clause.
- **Planners over-delivered plan counts** (5 instead of 3–4 in both 47 and 48) — accepted each time because the measured work justified it, but the CONTEXT's "recommended slicing" was never once followed.
- **Two executor process slips:** a `git stash` round-trip in 48-05 (against the workflow rules; only line endings were touched, caught by `bridge-doc --check`) and `state.advance-plan` failing on the free-form "Plan:" line every phase (executors patched STATE by hand).
- **The test-body boundary needed a ruling mid-plan:** "titles and comments only" could not reach zero; the bounded rule (local identifiers + messages, assertion counts pinned) was invented by the planner and accepted after the fact.
- **Both UAT batches (v1.5's 140, v1.6's 26) are still unrun** — the deferred-UAT protocol keeps the run moving, but two milestones of device checks are now stacked on one APK.

**Numbers:** 6 phases, 23 plans, 56 tasks, 136 commits, one session with two compactions and one restart; tests 2,924 → 3,315; parity master untouched; 3 Pixel 7 rounds in-phase; 26 device checks deferred.

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 17 | GSD phases for systems + on-device DR rounds for UX; autonomous runs per inserted milestone; human UAT deferred to milestone end |
| v1.1 | 1 (autonomous) | 5 | Baseline-first phases; smart discuss + research-resolved follow-ups; verification agents switched off for cost; retune deferred after human tune-again |
| v1.2 | 1 (autonomous, compacted once) | 7 (one inserted) | Hard gates that stop the phase; planner calibration before user decisions; device-feedback phases inserted mid-milestone; DR verdict deferred by the user |
| v1.3 | 1 (autonomous) | 6 | Research phase (30) before a UI build; override closeout with the device batch deferred |
| v1.4 | 1 (autonomous, no compaction) | 2 | Claude Design mocks as specs; pure-module-first waves; orchestrator-authored VERIFICATION with deferred UAT; APK built once after the last edit |
| v1.5 | 1 (autonomous) | 8 | BEFORE/AFTER class-matrix pins around every power change; greenfield ruling (no dual paths); deferred-UAT with orchestrator VERIFICATION |
| v1.6 | 1 (autonomous, 2 compactions, 1 restart) | 6 | Cleanup-only milestone under an engine fence; measure-first gates per phase (fixture scan, DOM snapshots, stale-terms, perf marks); honest-shortfall protocol with user re-baselining; device rounds only inside the phase that is the device |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 683 | parity byte-identical (solo); every event type narrated (guarded); all copy safety-scanned | 0 runtime deps beyond Capacitor plugins |
| v1.1 | 951 | parity 30/30 with one documented divergence (seed-303 parley); determinism suites for caster encounters; draw-count pins | 0 |
| v1.2 | 1448 | parity 33/33 with four declared divergences (chargen 15/24, combat 14, economy 3, parley 303); class identity contract (70); toast-table partition guard; ledger guards for class pass and retune | 0 |
| v1.3 | 1955 | parity byte-identical (storeRoll carved out); armor/loot/fight-gate suites | 0 |
| v1.4 | 2170 | parity master untouched; 9 new shell suites incl. phase-wide invariant sweeps (no toast / no D-pad / guards / no S-resident presentation state) | 0 |
| v1.5 | 3168 | parity byte-identical with declared divergences; BEFORE/AFTER class matrix 143 × 40; effect-timer, worn-slot, ability, spell, terrain suites | 0 |
| v1.6 | 3315 | parity master untouched; 13 declared worn-model fixture moves; DOM-snapshot lock for 3 screens; bridge registry set-equality; stale-terms tripwire; comment-only-diff proof; 7 dev-gated perf lines pinned | 0 |

### Top Lessons (Verified Across Milestones)

1. Determinism harness first — (v1.0; re-verify in Monster Balancing when foes start drawing rng).
2. Reconcile GSD artifacts immediately after non-GSD execution paths — (v1.0).
