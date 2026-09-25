---
phase: 72-roll-direction-sign-audit-fixes
status: passed
verified: 2026-09-25
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 1/1 requirements
human_verification:
  - "Smoke + insult (72-04): the Smoke skill/ability card reads 'foes need a natural 1 to find you (a 1–2 if you insulted them)'; in a fight, after a parley insult, a smoked hero or party member can be found on a 1 or a 2 (the insult still counts after the member's own Smoke)"
  - "Fridgian frenzy (72-05): on a dark square, the frenzy second swing's Oracle line shows the hero's normal to-hit narrowed by one (not a flat 3), and it applies only when the frenzy actually fires"
  - "Skeleton shatter (72-06): a natural 1 on your strike die against a Skeleton shatters it outright, both lives, with its own Oracle line; M&M's note no longer promises 'criticals on a 1'"
  - "F1 (72-07): a party member swinging at a hard-to-hit foe (Zit, Stink Bug, a dozing foe, a magic-only foe) obeys the same limits the hero does"
  - "F3 (72-07): the Shadow can only be hurt by a dagger or a magic weapon, for the hero and party members alike"
  - "F2 (72-07): Acute Hearing's skill card reads 'never surprised' with no '3 to hit the unseen' clause"
---

# Phase 72: Roll-Direction Sign Audit & Fixes: Verification

**Verdict:** passed on automated evidence. The device checks above are batched into the milestone-close Pixel 7 checklist, per the deferred-UAT protocol.

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| ROLL-01 | 72-01 `docs/ROLL-LEDGER.md`: 48 check sites, the modifier ledger, rulings F1–F4. 72-02/72-03: 139 odds-based direction rows (`test/unit/rollDirection.test.js`, `rollDirection-checks.test.js`) on `test/unit/harness/rollOdds.js`. 72-04: the evasion sign flipped, and the member-branch insult applied last. 72-05: frenzy = normal to-hit − 1, only on the actual frenzy swing. 72-06: `shatterIfBest` with `isBestFace` on six strikers. 72-07: F1/F2/F3/F5, the AFTER readout, a finalized ledger, and the `roll-ledger-sync` guard | ✓ (device look deferred) |

## Automated gates

- Full `npm test` on master after the final merge (16e6d0d): **5658/5658 pass, 0 fail, 0 todo**.
- Engine gate:
  - Every fix was measured at **zero moved parity fixtures**, declared in `test/parity/FIXTURE-INVENTORY.md` (Phase 72 section) and proven live by `ROLL01_EXPECTED_HOLDERS = []` plus parts (d)/(e) in `divergence-records.test.js`.
  - The prototype master hash is unchanged (`a1f4d0dc…`).
  - Two non-parity pins moved, both measured and explained in their SUMMARYs: the seed-17 Beasts draw count (72-05) and the bot-tactics seed 1 → 4 (72-07, where F1 reroutes a Joiner run).
- Bot readout: the BEFORE (9197002) and AFTER (d2adfd6) readouts are recorded in `docs/DIFFICULTY-RETUNE.md`. The curve is statistically flat, so no retune is owed.
- The direction tests assert on odds only, so Phase 73 can run them unchanged. The ledger↔tests sync guard shows no pending rows.
