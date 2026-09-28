---
phase: 73-engine-roll-high-mirror
status: passed
verified: 2026-09-25
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 1/1 requirements
human_verification:
  - "Oracle and fight log: every roll line reads high-is-good in the form '17 vs 18–20 (mods)' — your strikes, members' and allies' strikes, thrown spells, foe swings at you and at members, pursuit, resistance, flee, parley, traps, locks, climbs, leaps, the cure — and no line mixes a flipped roll with an old 'need N or less' number (modifier signs are still the roller's until Phase 74)"
  - "On a d20 at level 1 a caster hits on 18–20, a thief on 17–20 and a fighter on 16–20 (as shown in the strike lines; the hero sheet and combat menu switch to ranges in Phase 74)"
  - "The best face now means the TOP face: a Skeleton shatters on a natural 20 (the strike die's top face), weapon crits land on 20 (19–20 for precise blades), and a smoked-and-insulted hero is found on 19–20"
  - "Play feels identical to before the switch: same fights, same outcomes (the engine change is representation-only; this is a sanity check, not a balance check)"
---

# Phase 73: Engine Roll-High Mirror: Verification

**Verdict:** passed on automated evidence. The device checks above are batched for the milestone-close Pixel 7 checklist.

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| ROLL-05 | 73-01: one helper (`rollCheck`, `atLeastFor`, `rollFields`) and the build-failing guard. 73-02: the baselines (state-hash pins, pre-switch save, readout) and the runtime invariant. 73-03: `rollRange.js` and a per-site verdict for every ledger site. 73-04..73-09: every check site converted, with events carrying `{roll, atLeast, dieN}` and `need` retired, `isBestFace` → `roll === dieN`, mishap gates kept on the 1, and already-high sites (flee) folding their bonus into the threshold. 73-09: `ALL_ENFORCED = true` (24/24 engine files) and invariant `COMPLETE = true`. 73-10: the three proofs recorded, the ledger finalized, the comment sweep | ✓ |

## The three proofs (all hold)

1. **Byte-identical parity:** 52/52 parity tests pass, and zero fixtures, divergence records or comparable carve-outs moved. The prototype master hash is unchanged. A standing test asserts that no divergence record anywhere declares Phase 73.
2. **The Phase 72 direction tests are unchanged:** the odds-based tests pass untouched.
3. **The readout is identical:** the 200-seed `tune-difficulty` readout matches the 73-02 base byte-for-byte and every recorded line of Phase 72's AFTER block (`docs/DIFFICULTY-RETUNE.md`, the Phase 73 H2).

## Automated gates

- Full `npm test` on master after the final merge: **5752/5752 pass, 0 fail, 0 todo**. `npm run boot:check`: PASS.
- **Deviations** (all mechanical, documented in the SUMMARYs): test files outside the declared scope were updated with the mirror/rename rule (never loosened), a line-count pin was adjusted (rations-audit), and 73-08 committed combat.js in one pass.
- **Orchestrator fix e52f711:** the FLEE/CLASS-PASS ledger tests were made CRLF-tolerant after a merge re-checked-out `docs/FLEE.md` with CRLF. This also retired the worktree-only noise.
- **Handoffs:**
  - Phase 74: re-sign modifiers from the player's view, and extend ranges to the hero sheet, combat menu and foe details.
  - Phase 79: roll-under prose in content, including the Lockpicks item text.
