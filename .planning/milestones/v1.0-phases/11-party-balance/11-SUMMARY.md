---
phase: "11"
name: Party Balance (party-local; global retune deferred)
status: complete
completed: 2026-09-09
tests: 599/599 (parity byte-identical)
requirements: [PARTY-10 (party-local portion; global retune deferred)]
---

# Phase 11: Party Balance — SUMMARY

**Complete + verified 2026-09-09.** `npm test` = **599/599** (596 + 3 new), parity byte-identical for an empty party. `engine/difficulty.js` NOT touched.

## What landed (`engine/movement.js` + `test/unit/movement.test.js`)
- **Party upkeep in `newDay`** (~line 327): `cost`/`eats` become `let`; then, gated `if (state.party?.length)`, each live member adds `upkeep(m)` to the day's WP cost and `RACES[m.race]?.eats||1` to rations consumed. Reused the hero's `upkeep()` model (not a flat 4/day) for consistency. A fed party drains rations faster; an unfed party burns the hero into `die("starve")` sooner. Members are already pruned to live-only in `endCombat`. **No new rng; empty party byte-identical.**
- **XP-split** (Phase 8, `killFoe`) confirmed sane (`heroShare = shares>1 ? round(gained/shares) : gained`), left as-is (number tuning deferred).
- **Tests:** solo day drains exactly 1 ration (byte-identical); one Human member ⇒ 2 rations; unfed party starves the hero faster (wp 5: solo survives, +member dies).

## DEFERRED (documented): the global `engine/difficulty.js` curve/foe-scaling retune → the consolidated cross-milestone balance pass (with Economy & Item Balancing + Monster Balancing), per the user's "party-local now, defer global" decision. difficulty.js untouched (parity guard intact).

## Requirements: PARTY-10 party-local ✅ (upkeep counterweight + XP-split confirmed); global retune DEFERRED.
## Milestone Joiners = CODE-COMPLETE (Phases 7–11). Pending: Pixel 7 deploy + device review (blocked on wireless adb).
