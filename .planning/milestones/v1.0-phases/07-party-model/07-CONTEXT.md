# Phase 7: Party Model + Save Migration + Parity Carve-outs — Context

**Gathered:** 2026-09-09 (autonomous, adapted flow — executor-per-phase + immediate parity/full-suite verification, per the device-review workflow that delivered 04.1/04.2).
**Status:** Ready for execution.
**Requirements:** PARTY-02, PARTY-08.
**Research (authoritative):** `.planning/research/SUMMARY.md` + `STACK.md` (four-way HIGH-confidence convergence). Read them before executing.

## Phase boundary (what this phase DOES / does NOT do)
- **DOES:** introduce a persistent, serialized party roster and make it survive save/reload, with the parity suite byte-identical for an empty party. Party is still **inert in combat** after this phase.
- **Does NOT:** touch combat, foe targeting, recruitment UI, or the party rail (those are Phases 8–10). No balance changes (Phase 11).

## Locked decisions (from research + user, 2026-09-09)
- **Roster home:** a NEW **top-level `state.party` array** (sibling of `state.c`/`state.combat`), each member a full `rollCharacter()`-shaped sheet. NOT on `state.combat` (rehydrate nulls combat); top-level mirrors `state.combat` and strips cleanly at the state destructure. Leave the parity-FROZEN `c.joiner` and `C.ally`/`c.pendingAlly` shapes UNTOUCHED and additive.
- **v1 cap = 1 joiner**, but the model + all iteration written for N (PARTY-08).
- **Migration:** add `party` (default `[]`) to the explicit whitelists in `validateSave()` and `rehydrate()` in `engine/saveState.js`. `serializeRun()` already spreads state, so persistence is otherwise free. **No `STATE_VERSION` bump required** (additive-with-default). Fail-open on malformed party data (default `[]`, drop bad members) — never nuke an in-progress run.
- **Init:** `newRun`/`rollCharacter` path initializes `party: []` as a plain assignment (like `darkFor`/`flightLeft`) — **NO rng draw** during chargen.
- **Parity carve-out:** because `state.party` is top-level, strip it at the state destructure in `test/parity/harness/comparables.js` (the same place `beats`/`lastExchange` are dropped), added to `movementComparable`/`combatComparable`/`economyComparable` — the top-level analog of `stripDarkForField`. Do NOT strip `c.joiner`/`C.ally` (must keep matching the master). NEVER edit `prototype-master.js.txt`.

## Success criteria (the verification gate for this phase)
1. `state.party[]` exists, holds full `rollCharacter`-shaped sheets, serializes/rehydrates losslessly (round-trip test green).
2. Pre-existing saves (no `party`) load with `party: []` and zero data loss; malformed party data fails open to `[]`.
3. Cap enforced at 1 in v1; iteration written for N.
4. **PARITY GATE:** with an empty party, the FULL `npm test` + parity suite are byte-identical to pre-change (new field stripped in all three `*Comparable()` fns). Current baseline: **567/567, parity 25/25.**

## Hard constraints
Engine pure/deterministic; no new chargen rng; no renames of existing state fields/events; no new event types needed here; no git commits (device-review tree). Work is additive.

## Open grey area (resolved)
- Top-level `state.party` vs `c.party`: **RESOLVED → top-level `state.party`** (research recommendation; must not live on `state.combat`). No user input needed.
