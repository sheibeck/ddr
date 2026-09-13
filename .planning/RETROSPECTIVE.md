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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 17 | GSD phases for systems + on-device DR rounds for UX; autonomous runs per inserted milestone; human UAT deferred to milestone end |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 683 | parity byte-identical (solo); every event type narrated (guarded); all copy safety-scanned | 0 runtime deps beyond Capacitor plugins |

### Top Lessons (Verified Across Milestones)

1. Determinism harness first — (v1.0; re-verify in Monster Balancing when foes start drawing rng).
2. Reconcile GSD artifacts immediately after non-GSD execution paths — (v1.0).
