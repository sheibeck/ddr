---
phase: "7"
name: Party Model + Save Migration + Parity Carve-outs
status: complete
completed: 2026-09-09
tests: 574/574 (parity byte-identical)
requirements: [PARTY-02, PARTY-08]
---

# Phase 7: Party Model + Save Migration + Parity Carve-outs — SUMMARY

**Complete + verified 2026-09-09.** Full `npm test` = **574/574** (baseline 567 + 7 new party tests), parity byte-identical (empty-party gate holds). No rng-order change, no `STATE_VERSION` bump. Not yet built to device (party still inert in combat — device build deferred to a later party phase per the autonomous plan).

## What landed
- **`engine/state.js`** — `newRun()` returns a top-level `party: []` (sibling of `c`/`combat`, after `beats`), plain assignment, no rng draw. Added `PARTY_CAP = 1` + `addPartyMember(state, member)` (bounded append written for N, fail-open) — not wired to gameplay yet.
- **`engine/saveState.js`** — `sanitizeParty(raw)` (fail-open: non-array→`[]`, drops members failing `isValidCharacter`); added `party: sanitizeParty(obj.party)` to both `validateSave()` and `rehydrate()` whitelists. `serializeRun()` persists it via its existing spread. Old saves (no `party`) → `party: []`.
- **Parity carve-out** — top-level `state.party` stripped at the state destructure (where `beats`/`seed`/`rngState`/`version` are dropped; top-level analog of `stripDarkForField`) in `test/parity/harness/comparables.js` (movement/combat/economy) AND the three parity test files with their own local `comparable()` (`movement`/`combat`/`magic`-parity). `c.joiner`/`C.ally` untouched; `prototype-master.js.txt` NOT edited.
- **`test/unit/party-model.test.js`** (7 tests) — determinism (byte-identical `newRun(seed)`), serialization round-trip, migration (missing→`[]`), fail-open (malformed party), cap enforcement.

## Requirements: PARTY-02 ✅ (persist + migrate), PARTY-08 ✅ (cap 1, model for N).
## Next: Phase 8 — Party Combat (the parity-sensitive one).
