---
phase: 26-mass-playtest-class-pass-ledger
verified: 2026-09-15T17:00:00Z
status: passed
score: 2/2 requirements verified
behavior_unverified: 0
overrides_applied: 0
human_verification: []
gaps: []
---

# Phase 26 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-15)

Goal-backward check of the phase goal: *capture the AFTER matrix on the post-pass engine at BEFORE volume, rank every sub-class and race with a fun-band verdict, assert zero cannot-act cells, and complete the class-pass ledger with a Phase 27 handoff — measuring and judging, changing no engine code.*

## Automated evidence (re-run by the orchestrator after 26-04)

- `npm test`: **1421/1421** (1397 at phase start → +12 diff-script tests, +1 gap-closure regression, +11 ledger guard). Parity **33/33**, `test/parity/prototype-master.js.txt` untouched.
- AFTER capture on pin **`d1e3235`**: natural 143 × 40 = 5,720 runs (1108.5 s), depth-20 143 × 10 = 1,430 runs (59.4 s); `Bot:` lines byte-identical to BEFORE apart from `seeds=`/`startDepth=`; harness `tools/tune-classes.mjs` + `tools/lib` byte-identical to the BEFORE pin `5565b22`; `git diff --quiet d1e3235 -- engine content src mazeworld.html tools` clean after the final commit.
- Cannot-act gate: **0 of 143** cells (`node tools/class-pass-diff.mjs --gate`), 0 stuck runs across both slices; asserted permanently by `test/unit/class-pass-ledger.test.js`.
- Four plans with SUMMARY.md, no `Self-Check: FAILED`; working tree clean.

## The one engine change, and why it is not a phase violation

The first 26-02 capture (pin `620e1df`) tripped the hard gate on one run in 5,720: Fighter/Samurai/Dwarven seed 197976 stuck. Diagnosis (orchestrator, replaying the seed): a Samurai never strikes first, the Shadow's opening blow reflected off a Bubble ward and killed it, and `startCombat` had no cleared-encounter check after its inline `foeTurn` (the one `afterPlayerAction` has after both of its calls) — combat stayed open with nothing alive and every later action was a no-op. A human player would have been stranded on the combat screen. The bug predates this milestone (original combat port); Phase 24's Samurai rule plus shifted dice exposed it. Fixed at `d1e3235` (mirror of the existing check, zero rng, parity 33/33 byte-identical, seed-scanning regression test that fails on the old engine). That is exactly what the gate exists to catch — the milestone's promise is that every combination can act — so the fix was applied as a gap closure, the capture re-run from scratch on the new pin, and the first attempt recorded in `26-02-SUMMARY.md`. No balance or class-specific change was made.

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | AFTER matrix captured at BEFORE volume/seeds/parameters on a proven pin | Verified | `docs/class-pass/after.json`, `after-depth20.json` (`meta.commit d1e3235`); meta parity modulo commit asserted by the ledger test. |
| 2 | Every sub-class and race ranked with a fun-band verdict; cannot-act = 0 | Verified | μ (run-weighted) 3.08, bands <2.31 / 2.31–4.15 / >4.15; 30 rows: one out of band (Ninja, too strong 4.33, **accepted** — the opener is the identity); Wilmsry in band at 3.92 (accepted, deferred trims closed); all eight caster subs in band (2.35–2.88); 113/143 cells in band, 30 listed unjudged in the appendix; revisit list empty. |
| 3 | Ledger complete: AFTER, comparison tables, outliers with levers, handoff | Verified | `docs/CLASS-PASS.md` sections in fixed order (Bot proxy → How to reproduce → BEFORE → Outliers/Findings → Rulings → AFTER → Outliers (revisit) → Handoff to Phase 27); numbers machine-derived by `tools/class-pass-diff.mjs`, editorial column in `docs/class-pass/verdicts.json`; handoff carries by-class/sub/race roll-ups, reach ≥5/≥10, depth-20 floors-gained/encounters-survived by class/sub/race, accepted-but-strong list. |
| 4 | Standing guard | Verified | `test/unit/class-pass-ledger.test.js` (11): sections, 30-row table once, IDENT-05/06/07/10 ruling headings, commit hash equality, meta parity, Outliers ↔ verdicts revisit set, zero cannot-act. |

## Requirements

| ID | Status | Evidence |
|---|---|---|
| PLAY-02 | Verified | Criteria 1–2. |
| PLAY-03 | Verified | Criteria 3–4. |

## Headline for the user

Rank order unchanged (Thief 3.51 > Fighter 3.16 > Magic User 2.55 mean death depth) but the gap narrowed; Magic User kills nearly doubled (2.41 → 4.99); Summoner posted the largest gain (+0.53). No sub-class or race is too weak. Depth-20 yardstick for Phase 27: a forced depth-20 start gains 0.07–0.30 floors on average (median 0) and survives about one encounter — reaching 20 is already a unicorn; Phase 27 tunes the road to it, not the floor itself.

## Findings carried forward

- Depth-20 slice: `meanFloorsGained` ≈ 0.1 and p50 = 0 for every class — past 20 the curve is already "wrap up naturally"; Phase 27 should leave it alone per the user's rule and focus on the 5–15 band (reach ≥10 is 0.3% pooled).
- Con Artist reaches depth 4.07 with 1.75 kills — talks its way down; in band and consistent with its identity, but worth a glance when Phase 27 shifts the difficulty curve (parley-heavy runs respond differently to foe-count dials).
- Executors' `docs(...)` commits made via the SDK helper lack the session footer; feature commits carry it.

_Verified: 2026-09-15 — orchestrator (Claude), no verifier agent._
