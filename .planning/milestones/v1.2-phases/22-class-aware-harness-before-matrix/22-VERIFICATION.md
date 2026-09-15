---
phase: 22-class-aware-harness-before-matrix
verified: 2026-09-14T16:55:00Z
status: passed
score: 5/5 requirements verified
behavior_unverified: 0
overrides_applied: 0
human_verification: []
gaps: []
---

# Phase 22 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-14)

Goal-backward check of the phase goal: *the tuning harness can force any class/sub-class/race combination and play it with a sub-class-aware policy, producing a ranked 143-combo matrix — and a BEFORE snapshot is captured against the pre-identity-pass engine before any identity change lands.*

## Automated evidence (checked by the orchestrator after 22-04)

- `npm test`: **989/989** pass (951 at v1.1 close → +9 forced-chargen, +18 bot-policy, +11 class-matrix). Parity suite 30/30; `test/parity/prototype-master.js.txt`, `test/parity/harness/comparables.js`, and `test/parity/fixtures` are byte-identical to v1.1 close (`1b4daed`) — no carve-out was needed because the `force` option adds no serialized field.
- Engine diff since v1.1 close is exactly `engine/character.js` + `engine/state.js` (the dev-only `force` option); `content/`, `src/`, `mazeworld.html` untouched. The BEFORE capture pinned `5565b22` and proved `git diff --quiet 5565b22 -- engine content src mazeworld.html` clean before and after the capture.
- All four plans have SUMMARY.md with no `Self-Check: FAILED`; every task committed atomically (19 commits `1b4daed..HEAD`).
- `tools/build-www.mjs` references `tools/` only in comments — the harness is not in the shipped `www/` copy list. No new npm dependency (`worker_threads` is Node built-in).

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Force any class/sub/race triple through a documented harness-only seam; every other draw keeps its order | Verified | `normalizeForce` + `rollCharacter(rng, exclude, force)` + `newRun(seed, exclude, {startDepth, force})`; `test/determinism/forced-chargen.test.js` (9): pinned + swept byte-identity vs natural rolls, default-path invariance, draw-count parity, all 143 combos, Fridgian Samurai / unknown-name rejection. CLI resolves names case-insensitively (`tools/lib/class-matrix.mjs`). |
| 2 | Sub-class-aware policy: Summon, Bard sing, Mirror Self, disables, heals, parley; still drinks/camps/flees | Verified | `chooseSpell` scoring table + round-1 openers + talk-first parley + scroll reading in `tools/lib/tuning-bot.mjs`; `test/unit/tuning-bot.test.js` (29, +18) pins every branch on synthetic states. Samurai `fleeRefused` and Wizard `strikeRefused` bot loops fixed (plus a third Mirror-Self zero-charge loop found and fixed in-plan). |
| 3 | `tools/tune-classes.mjs` runs all 143 combos × N seeds, ranked matrix as text and `--json`, reproducible | Verified | Flags `--seeds --workers --max-actions --start-depth --explore-budget --cls --sub --race --json --out`; `test/unit/class-matrix.test.js` (11) incl. documented tie-break; `--workers 1` vs `4` JSON byte-identity acceptance run; atomic `--out`. |
| 4 | `--start-depth` via the Settings dev-toggle seam | Verified | `playRun(opts.startDepth)` → `newRun(seed, [], {startDepth})`; exposed on `tune-classes.mjs` and `tune-difficulty.mjs` (4 references); deep runs report `meanFloorsGained` / `meanEncountersSurvived`. |
| 5 | BEFORE matrix committed against the pinned engine before Phase 23 | Verified | `docs/CLASS-PASS.md` (Bot proxy, reproduce, BEFORE 143×40 natural + 143×10 depth-20 verbatim, Outliers/Findings, Rulings/AFTER placeholders) + `docs/class-pass/before.json` + `before-depth20.json`, commit `d708d80`; 0 stuck runs in 7,150. No Phase 23 commit exists yet. |

## Requirements

| ID | Status | Evidence |
|---|---|---|
| HARN-01 | Verified | Criterion 1 (22-01 seam + 22-03 CLI resolver). |
| HARN-02 | Verified | Criterion 2 (22-02). Flagged planner assumption stands as recorded: threshold NUMBERS are Claude's discretion and are documented in the ledger's Bot proxy section; only branch firing is test-verified. |
| HARN-03 | Verified | Criterion 3 (22-03). Matrix has 143 cells; Fridgian Samurai excluded with footnote and `meta.excluded`. |
| HARN-04 | Verified | Criterion 4 (22-02 plumbing, 22-03 CLI). |
| PLAY-01 | Verified | Criterion 5 (22-04). |

## BEFORE headline (for Phases 23–27; full tables in `docs/CLASS-PASS.md`)

- Natural start, 143 × 40: Thief mean depth 3.42 / reach-5 24.6% · Fighter 3.05 / 16.2% · Magic User 2.44 / 7.7%. Bottom five subs are all casters (Summoner 2.18, Illusionist 2.20, Apprentice 2.40, Cleric 2.42, Wizard 2.48); top three Ninja 4.22, Con Artist 4.08, Acrobat 3.71. Wilmsry (3.93) leads races; Fridgian (2.46) and Dwarven (2.45) trail.
- Depth-20 slice, 143 × 10: mean floors gained 0.15; 56 of 143 cells gain zero floors; mean encounters survived 1.32 (best cell 5.9). This is the class-aware form of the TUNE-04 "depth 20 is instant death" finding — the yardstick for Phase 27 under the user's depth-20 target (decision 2026-09-14).

## Findings carried forward (not gaps in this phase)

- IDENT-01 engine finding recorded in the ledger: a Wizard (or any caster) with charges but no castable attack spell cannot melee — Phase 23's first target. Engine deliberately untouched here.

_Verified: 2026-09-14 — orchestrator (Claude), no verifier agent._
