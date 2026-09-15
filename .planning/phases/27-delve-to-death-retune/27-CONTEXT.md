# Phase 27: Delve-to-Death Retune - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas put to the user; every decision below is the user's answer or its direct consequence.

<domain>
## Phase Boundary

The deferred TUNE-04 retune lands on the corrected player power from Phases 23–25.1 (Phase 26 handoff: μ 3.08, rank order Thief 3.51 > Fighter 3.16 > Magic User 2.55, 0 cannot-act, depth-20 forced start survives 1.3 encounters / gains 0.14 floors). Three deliverables: (TUNE-05) the target band recorded in `docs/DIFFICULTY-RETUNE.md` BEFORE any constant moves; (TUNE-06) `engine/difficulty.js` retuned — plus ONE deliberate canon deviation (Dante) — with BEFORE/AFTER transcripts under identical bot parameters; (TUNE-07) a human DR round on the Pixel 7 that re-issues the TUNE-04 verdict; the milestone closes only on "tuned" or a user-recorded deferral.

Requirements: TUNE-05, TUNE-06, TUNE-07.

Standing user rules (2026-09-14): depth 20 is THE tuning target, not infinite depth; reaching 20 is a unicorn run; past 20 nothing is dialed back and no mechanic forces death — the run wraps up naturally on the existing curve. "Competent player" cannot be quantified in a game this RNG-heavy, so the bot proxy sets rarity floors; the human DR round is the real verdict.

</domain>

<decisions>
## Implementation Decisions

### The target band (TUNE-05) — user decisions 2026-09-15
Measured with the Phase 22 harness at BEFORE parameters (`tools/tune-classes.mjs` natural 143 × 40 seeds `i*7919+1`, `--max-actions 5000`, party off; forced-start slices 143 × 10) and `tools/tune-difficulty.mjs --seeds=200` for the actions-per-floor / cause readouts. Recorded in `docs/DIFFICULTY-RETUNE.md` under a new `## v1.2 retune (Phase 27)` section before tuning begins.

| Measure | Current (Phase 26 AFTER, pin d1e3235) | Target |
|---|---|---|
| Natural bot median death depth | 3 (mean 3.08) | **5–6** ("whole curve": the shallow end is eased too, not only the ramp) |
| Reach ≥ 10 (pooled) | 0.3 % | ≈ 10–20 % (consistency-derived from the two user pins on either side, not a user pin itself; state it as a corridor) |
| Reach ≥ 20 (pooled, bot) | ~0 | **1–2 %** (the unicorn — the bot's number is a rarity floor; humans play better) |
| Forced start at 20, level-5 hero | 1.3 encounters survived, 0.14 floors gained (p50 0) | **3–5 encounters survived; floors gained median ≥ 1, mean 1–2** ("dangerous, not hopeless") |
| Past 20 (forced 35 / 50) | — | descriptive only: floors gained and encounters survived are REPORTED as the wrap-up measure; no target, no dial-back, no forced death |
| Cannot-act cells | 0 | 0 (hard gate, `tools/class-pass-diff.mjs --gate`) |

The Phase 21 D-09 targets (median 8–15, p90 ≥ 25) are superseded by this band and must be marked as such in the ledger.

### Levers (TUNE-06)
1. **Global depth dials in `engine/difficulty.js` — the whole curve.** Combat knobs (`FOE_POWER_MAX`/`_SOFT_K`, `ABILITY_THREAT_MAX`/`_SOFT_K`, `FOE_CAP_MAX`/`_SOFT_K`, `COMBAT_SCALE_FROM_DEPTH`) for the ramp 6→20, guided by the v1.1 DR lead ("the depth-20 band — foe cap 4, power ≈1.21×, cadence ≈1.39× — is already lethal for a level-5 hero: pull `FOE_POWER_MAX`/`ABILITY_THREAT_MAX` down and/or push `*_SOFT_K` out, and consider capping foes-per-encounter growth below 5"). Non-combat knobs (`ENCOUNTER_DOT_*`, `DARK_BLOB_CAP`, `DARK_RADIUS_*`) may ease depths 2–5 (darkness arriving later/smaller, encounter density ramping a floor later) — "starved in the dark" is the #3 killer (300 tallies). Combat knobs stay at identity for depths 1–5 (`COMBAT_SCALE_FROM_DEPTH` may only move UP, never below 6): canon runs untouched at the shallow end.
2. **Touch Dante — ONE deliberate canon deviation (user decision 2026-09-15).** "Cut down by a Dante" is the #1 death cause (724 tallies, more than traps 333 + starvation 300 combined). Dante is the ONLY level-1 "Humans" foe (`content/bestiary.js`: sz H, i 12, wp 20, `sp.atk: 3` — three strikes a round) and is met on floor 1 by level-1 characters. Demote it: the exact form is Claude's discretion (e.g. two strikes a round at tier 1, or wp 20 → lower, or move Dante to tier 2 with a replacement tier-1 Humans entry) — choose the SMALLEST change that removes the floor-1 spike while keeping Dante recognisably Dante ("twins, four arms") deeper. Record it as `DELIBERATE RULES CHANGE (Phase 27, 2026-09-15, TUNE-06)` in the bestiary with the numbers, and update `content/flavor.js` blurbs / foe notes if they state the strike count. Dante is fixture-exposed (`action-script.combat.json` scenario `parley`, seed 303, Dante ×2 — see `test/parity/FIXTURE-INVENTORY.md`): the change diverges that scenario and MUST be handled the Phase 23/24 way — a declared, machine-checked divergence record (`stripScenarioDivergence` / `actionPathDivergenceOf` / `declaredEndDiffs` in `test/parity/harness/comparables.js`), never an edit to `test/parity/prototype-master.js.txt`, never a silently re-pinned fixture; `FIXTURE-INVENTORY.md` gets a Phase 27 section. Every other parity scenario stays byte-identical.
3. **Nothing else.** No class-specific change (Phase 26's revisit list is empty), no upkeep/economy dial unless a counterweight trigger from `docs/DIFFICULTY-RETUNE.md`'s existing rules fires (record it if it does), no change to `engine/character.js`, spells, or items.

### Method (TUNE-06)
- **Iterate, don't guess once.** Each iteration: change constants → cheap smoke (`tune-difficulty --seeds=200` natural + `--start-depth=20`, plus a `tune-classes` subset such as `--seeds 10`) → read median / reach / depth-20 survival against the band → record the iteration in the ledger's iteration log (constants, readout, what moved, what to turn next). Stop when the smoke lands inside the band or after a bounded number of iterations (plan a cap, e.g. 4) — then take the FULL AFTER: `tune-classes` natural 143 × 40 and forced 20 143 × 10 (identical Bot lines to Phase 26), plus forced 35 and 50 `tune-difficulty --seeds=200` readouts as the descriptive past-20 measure. Long runs in the background with an `EXIT=` sentinel and bounded polling (Phase 22/26 precedent; ~18 min + ~1 min on 4 workers).
- **Do not overwrite Phase 26's artifacts.** `docs/class-pass/after.json` / `after-depth20.json` / `verdicts.json` and the `## AFTER — commit d1e3235` section of `docs/CLASS-PASS.md` are the Phase 26 record and are guarded by `test/unit/class-pass-ledger.test.js`. Phase 27 writes NEW files (`docs/class-pass/retune-after.json`, `retune-after-depth20.json`) and appends its transcripts to `docs/DIFFICULTY-RETUNE.md` (BEFORE = the Phase 26 AFTER transcripts referenced by pin, not re-run; AFTER = the retuned pin). The cannot-act gate runs on the retune AFTER.
- **Engine gate as always:** parity byte-identical except the ONE declared Dante divergence; no new rng draws outside existing gates (constants are draw-free; a Dante stat change adds no draw); `npm test` green (floor 1421) with the ledger test still passing; voice scan if any copy changes.

### The human DR round (TUNE-07)
- After the full AFTER lands: `npm run android:debug` → `adb install -r` → force-stop → relaunch on the Pixel 7 (`adb-28051FDH200H0R`, adb at `C:/Users/Dell/AppData/Local/Android/Sdk/platform-tools/adb.exe`), and a DR checklist appended to `docs/DIFFICULTY-RETUNE.md`: Run 1 forced 20, Run 2 forced 35, Run 3 forced 50 (dev start-at-depth toggle), Run 4 natural — what to look for at each, with the band's numbers as the yardstick and the user's own words from the v1.1 verdict ("instant death on any combat") as the thing that must no longer be true at 20.
- **This is a blocking human checkpoint.** The plan's final task ends by handing the build and checklist to the user; the verdict ("tuned" / "tune-again" / "deferred") is written by the user (or by the orchestrator quoting the user verbatim). "Tune-again" → one more bounded iteration inside this phase; "deferred" → recorded with the user's reason and the milestone closes on it. Standing rule: after the update batch, ASK whether to push a Play internal-testing build (`node tools/bump-version.mjs` + `npm run android:release`).

### Claude's Discretion
- Exact Dante demotion form (bounded above), exact constant values and iteration order, whether `COMBAT_SCALE_FROM_DEPTH` moves.
- Ledger layout for the v1.2 section (mirror the v1.1 sections: band, bot proxy, BEFORE-by-reference, change table, iteration log, AFTER transcripts, comparison vs band, not-changed-and-why, DR checklist, verdict).
- Whether the reach ≥ 10 corridor is tightened after iteration 1 shows the tail's real shape (record the reasoning).

</decisions>

<code_context>
## Existing Code Insights

- `engine/difficulty.js` (254 lines): constants above; `difficultyCurve(depth)` → `{dots, darkBlobs, darkRadius, foeCap, foeBonus, foePower, abilityThreat}` via `softCap`/`softCapFloat` with `over = max(0, depth - (COMBAT_SCALE_FROM_DEPTH - 1))`; consumers `engine/combat.js#startCombat` (foe count/wp/dmg bonus), `engine/foeAbilities.js` (cadence), `engine/maze.js` (dots/darkness). Breather floors every 5 (`isBreather`).
- `content/bestiary.js` "Humans" tier 1 = `[Dante]` only; tier 2 = China Wolf etc. Fixture exposure: `test/parity/FIXTURE-INVENTORY.md` rows for combat/parley seed 303.
- Harness: `tools/tune-difficulty.mjs` (`--seeds --start-depth --party`), `tools/tune-classes.mjs` (matrix, `--start-depth`, `--json --out`), `tools/class-pass-diff.mjs --gate`; `docs/DIFFICULTY-RETUNE.md` v1.1 structure and the D-16 "what happens next" block; `.planning/phases/21-*/` plans for the iteration discipline; `.planning/phases/26-*/26-02-SUMMARY.md` for the capture procedure and sentinel polling.
- Phase 24 precedent for declared divergences: `.planning/phases/24-*/24-02-SUMMARY.md` (combat seed 14, economy seed 3) and Phase 23's `lose-apprentice` seed 127.
- Tests to keep green: `test/unit/difficulty*.test.js`, `test/unit/class-pass-ledger.test.js`, `test/parity/**` (33 files), voice scan.

</code_context>

<specifics>
## Specific Ideas

- The user's v1.1 words are the acceptance bar at 20: "Level 20, way overtuned. It's instant death on any combat." After the retune a level-5 hero at 20 should get 3–5 fights, not one.
- Keep the opening honest: floor 1 should still kill careless level-1 characters (traps, starvation, a bad fight) — the change is that ONE canon foe no longer does it three times a round.
- The tail matters more than the middle: 1–2 % reach 20 means the curve must keep steepening past ~10 while the median sits at 5–6.

</specifics>

<deferred>
## Deferred Ideas

- Class-specific tuning — v1.3 if the DR round names a class (Phase 26 found none).
- Economy/upkeep counterweights — only if their recorded triggers fire.
- Con Artist's talk-heavy runs (4.07 depth, 1.75 kills) — watch, don't touch.

</deferred>
