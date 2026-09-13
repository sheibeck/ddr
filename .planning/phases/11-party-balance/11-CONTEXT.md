# Phase 11: Party Balance (party-local; global retune DEFERRED) — Context

**Gathered:** 2026-09-09 (autonomous). **Requirements:** PARTY-10 (party-local portion; the consolidated cross-milestone retune is deferred).
**User decision (2026-09-09):** do **party-LOCAL tuning now, DEFER the global dial retune** to when Economy & Monster Balancing land (avoids double-tuning; research-backed).
**Depends on:** Phases 7–10. Baseline: **596/596, parity byte-identical.**

## Phase boundary
- **DOES:** add the canon party counterweight — **a party eats more** (per-member upkeep/rations in `newDay`) — and confirm the Phase-8 **XP-split** damps the hero's gain sanely, so a joiner is a MEANINGFUL COST, not free power. Add a focused test/verification that a party run stays in the 5–10 min band.
- **Does NOT (DEFERRED — document it):** the global `difficulty.js` curve/foe-scaling retune. That is the single consolidated pass coordinated with Economy & Monster Balancing; doing it now would be redone later. **Do NOT edit `engine/difficulty.js`** this phase (it also carries a parity guard). Record the deferral in the SUMMARY + a `>>> DEFERRED` note in the roadmap.

## Grounding
- **Upkeep model:** `upkeep(c)` in `engine/derived.js:239` = `max(1, round(RACES[race].upkeep × (Heft?0.5:1)) + eff(c,"upkeep"))` — wp/day; consumed in `engine/movement.js` `newDay` (`cost = upkeep(c)`, ~line 327; `c.rations -= eats`; starve → `die("starve")`). Today only the HERO's upkeep is charged.
- **XP-split (already implemented, Phase 8 `killFoe` ~line 417):** `heroShare = shares>1 ? round(gained/shares) : gained`; members' shares discarded; gated on `shares > 1`. Empty party = byte-identical.

## Tasks
1. **Party upkeep in `newDay`:** each live party member adds to the daily food/upkeep cost — a party eats more. Use the member's own `upkeep` (reuse `upkeep(member)` on the member's race, or the canon flat 4 WP/day per member — pick and document; prefer reusing `upkeep()` for consistency). Fold into the existing `cost`/`eats`/`c.rations` calculation so the party's rations drain faster and an unfed party starves the hero the same way. **GATE behind `state.party?.length`** — with no party, the upkeep math + any consumption is byte-identical to today (no new rng; this is pure arithmetic, but keep the empty-party numbers identical). Downed/departed members (already removed from `state.party` in `endCombat`) don't eat.
2. **Confirm XP-split is sane** (Phase 8): with a live member, a kill gives the hero `round(gained / (1+members))`; verify it reads correctly and feels like a real cost. Only tune the NUMBER if it's clearly off — otherwise leave it (global tuning is deferred).
3. **Verification:** if the Phase-3 difficulty tuning harness exists (`test/difficulty/` or a headless sim), run/extend it with a 1-joiner party scenario to confirm a run still resolves in ~5–10 min and isn't trivialized. Otherwise add a unit test: a party member increases daily ration consumption (party drains rations faster than solo) and the empty-party path is unchanged.
4. **Document the deferral:** SUMMARY + roadmap note that the global `difficulty.js` retune is DEFERRED to the consolidated cross-milestone balance pass (with Economy & Monster).

## Success criteria (gate)
1. A party member measurably increases daily upkeep/ration drain (a party is a real resource cost); the hero starves normally when the party is unfed.
2. XP-split confirmed damping the hero's gain with a member present.
3. The global difficulty-curve retune is explicitly DEFERRED and documented (not silently skipped).
4. **PARITY GATE:** empty-party full `npm test` + parity byte-identical to the 596/596 baseline (upkeep change gated behind party presence; `difficulty.js` untouched).

## Hard constraints
Engine pure/deterministic; party-upkeep gated so empty-party is byte-identical; NO `difficulty.js` edit (deferred + parity guard); no field/event renames; no new rng; no git; no build/deploy (orchestrator); no SUMMARY.md (policy).
