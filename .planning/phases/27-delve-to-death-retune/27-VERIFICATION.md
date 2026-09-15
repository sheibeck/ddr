---
phase: 27-delve-to-death-retune
verified: 2026-09-15T23:00:00Z
status: passed
score: 3/3 requirements verified (TUNE-07 closed by a user-recorded deferral, as the requirement allows)
behavior_unverified: 1
overrides_applied: 0
human_verification: ["DR round (forced 20/35/50 + natural) not played — user away from the Pixel 7; carried to the next tuning pass"]
gaps: []
---

# Phase 27 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-15)

Goal-backward check of the phase goal: *the deferred TUNE-04 retune lands on the corrected player power, targeting a band agreed with the user, and closes on a human DR-round verdict — "tuned" or a user-recorded deferral.*

## Automated evidence (re-run by the orchestrator after 27-04)

- `npm test`: **1448/1448** (1421 at phase start → +9 band/pooled readout, +11 pin restructures, +7 ledger guard). Parity **33/33** with exactly ONE declared divergence (combat/parley seed 303: Dante → Ned, action-path record from action 0); every other scenario byte-identical; `test/parity/prototype-master.js.txt` and `harness/comparables.js` untouched. `npm run build:www` green; voice scan green (Ned's note).
- Retune pin **`39bfecf`**; AFTER captured at BEFORE parameters (natural 143 × 40 = 5,720 runs, forced-20 143 × 10 = 1,430 runs) into NEW files `docs/class-pass/retune-after.json` / `retune-after-depth20.json`; Phase 26's `after*.json`, `verdicts.json`, `docs/CLASS-PASS.md` byte-identical and its ledger test green. Cannot-act gate **0 of 143**.
- Four plans with SUMMARY.md; 27-04's status is `checkpoint` by design; working tree clean; the user's verdict written verbatim at `a2a3f6f`.

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Target band agreed with the user and recorded before tuning (TUNE-05) | Verified | Three user rounds (2026-09-15): whole curve, forced-20 = 3–5 fights / ≥ 1 floor median, reach ≥ 20 = 1–2 %, then widened early-floor levers, then bot median 4 / reach ≥ 5 ≥ 25 % as the levers' measured ceiling with human 5–6 judged by DR. Recorded in `docs/DIFFICULTY-RETUNE.md` `## v1.2 retune (Phase 27)` at `7e8ecbe` BEFORE any constant moved; D-09 marked superseded; guarded by `test/unit/difficulty-retune-ledger.test.js` (13). |
| 2 | `engine/difficulty.js` retuned so the matrix and start-at-depth readout land inside the band, BEFORE/AFTER under identical bot parameters (TUNE-06) | Verified (two rows recorded as misses) | Change table: `COMBAT_SCALE_FROM_DEPTH` 6 → 21 (canon through depth 20), `FOE_CAP_MAX` 5 → 4, `FOE_POWER_MAX` 1.6 → 1.15, `ABILITY_THREAT_MAX` 2.0 → 1.3, `ENCOUNTER_DOT_CAP` 24 → 13, `FOE_GRACE_AT_2` 0.5 (floor 1 exactly 1.0), hazard ramp ×0.5 from floor 2, darkness held through 3, dots canon through 2; Dante → Humans tier 2, Ned tier 1. Bounded 4 iterations logged. AFTER vs band: median **4** IN; reach ≥ 5 **30.6 %** IN; forced-20 encounters **3.17** IN; forced-20 floors gained mean 0.84 / p50 0 OUT; reach ≥ 20 0.1 % OUT; cannot-act 0 IN. Rank order preserved (Thief 4.35 > Fighter 3.92 > Magic User 3.06). Counterweight triggers measured, neither fired. Ladder rungs not taken (rations, hazard-from-1, darkness-from-4, floor-1 grace) recorded with calibration numbers. |
| 3 | Human DR round re-issues the TUNE-04 verdict; milestone closes only on "tuned" or a user-recorded deferral (TUNE-07) | Verified — **deferred** | Debug APK built from `91c5b13` (1.2.0 (3), 2026-09-15 18:21); Pixel 7 unreachable over wireless adb (user away); DR checklist (forced 20 / 35 / 50 + natural) appended to the ledger; verdict block filled with the user's words: *"Let's defer. We'll have more tuning eventually … I have another milestone of fixes, questions that might affect tuning … I'm away and so my phone isn't available until i return."* The retuned constants ship as landed. |

## Requirements

| ID | Status | Evidence |
|---|---|---|
| TUNE-05 | Verified | Criterion 1. |
| TUNE-06 | Verified | Criterion 2 (misses recorded, not chased — per the band's own rule). |
| TUNE-07 | Verified (deferral) | Criterion 3. |

## Carried forward to the next tuning pass

- The unplayed DR round: forced 20 (acceptance bar — "instant death on any combat" must no longer be true), 35, 50, natural. Checklist and dev start-at-depth how-to stay in the ledger.
- Two bot misses that no sanctioned dial can close: forced-20 floors gained (p50 0, mean 0.84 vs ≥ 1 / 1–2) and reach ≥ 20 (0.1 % vs 1–2 %) — the residual lethality at 6–19 and past 20 is canon tier-3/5 combat (Herman, Drarl, Vampire, Djinni). Closing them means touching those rosters, which needs a new user decision.
- Available-but-untaken rungs with calibration numbers (rations +2, hazard from floor 1, darkness from 4, floor-1 grace) and the third grace notch (×0.35).
- The Play internal-testing upload for 25.1 + the retune (versionCode 4) — offer when the user is back with the phone.

_Verified: 2026-09-15 — orchestrator (Claude), no verifier agent._
