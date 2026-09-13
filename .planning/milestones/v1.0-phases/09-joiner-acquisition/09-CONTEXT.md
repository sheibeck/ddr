# Phase 9: Joiner Acquisition + Voice — Context

**Gathered:** 2026-09-09 (autonomous). **Requirements:** PARTY-01 (engine half), PARTY-09.
**Depends on:** Phase 7 (`state.party[]`), Phase 8 (party combat). Baseline: **587/587, parity 25/25 byte-identical**.

## Phase boundary
- **DOES (ENGINE layer):** turn the `meetJoiner` encounter into a real accept/decline recruitment at the engine level — stash the rolled joiner as a pending candidate, add a `resolveJoiner{accept}` action that either adds it to `state.party` (cap 1) or discards it; add sarcastic join/decline/kill/downed voice narration.
- **Does NOT:** the mazeworld.html accept/decline PROMPT UI or the party rail — those are Phase 10 (Party UI). This phase makes the recruitment ENGINE contract exist + testable; Phase 10 wires the buttons.

## Current `meetJoiner` (engine/encounters.js:397-407) — DO NOT change its rng draws
```
lvl = SPELL_LEVEL_TABLE[rng.d(10)-1];          // draw 1
joinerChar = rollCharacter(rng);                // draws (full char)
wp = 20*lvl + rng.d(20);                         // draw 2
discardedMaxWP = 20*lvl + rng.d(20);             // draw 3 (discarded for fidelity — KEEP IT)
c.joiner = {name,race,sub,cls,lvl,wp,maxWP:wp}; // FROZEN shape, compared by parity — keep identical
events.push({type:"joinerMet", ...});
```
These draws are in the frozen `prototype-master.js.txt` encounter fixtures. Keep them EXACTLY (order + count). `c.joiner` stays set identically.

## Tasks
1. **Stash a pending candidate (no new rng):** in `meetJoiner`, ALSO set `state.pendingJoiner = { ...joinerChar full sheet..., lvl, wp, maxWP: wp }` (the full `rollCharacter`-shaped sheet PLUS the joiner-specific lvl/wp so it can fight per Phase 8's `alliesTurn`, which reads member `level`/`lvl`, `wp`, `maxWP`, `sub`). No extra draw — reuse the already-rolled `joinerChar` + the already-drawn `wp`. Keep `c.joiner` + `joinerMet` exactly as they are.
2. **Parity carve-out for `state.pendingJoiner`:** it's a NEW top-level field set DURING encounter fixtures, so it MUST be stripped in ALL the same places `state.party` is stripped (the 3 harness `*Comparable` fns in `comparables.js` + the 3 local `comparable()` in `movement`/`combat`/`magic`-parity). Mirror the Phase-7 party strip exactly. NEVER edit the master.
3. **`resolveJoiner` action (pure, no rng):** add `"resolveJoiner"` to `engine/actions.js` (validate a boolean `accept`) and a case in `engine/engine.js` → a handler that: on `accept` truthy, if `state.pendingJoiner` and party under `PARTY_CAP`, `addPartyMember(state, state.pendingJoiner)` (reuse Phase 7's helper) and emit a `joinerJoined` event; on decline (or cap full), emit a `joinerDeclined` event; ALWAYS clear `state.pendingJoiner = null`. No rng. This action is NOT in parity fixtures, so it introduces no draw-order risk — but keep it pure anyway.
3b. Ensure the party MEMBER shape you add is exactly what Phase 8's `startCombat`/`alliesTurn` expects (it reads `m.level ?? m.lvl`, `wp`, `maxWP`, `name`, `sub`). Set the member's combat level to the joiner `lvl`. Add a quick integration test that a recruited joiner actually fights in the next combat (syncs into `C.allies`, strikes).
4. **Voice (PARTY-09):** add sarcastic, family-friendly `EVENT_NARRATION` entries (or reuse) for `joinerJoined` ("...falls in beside you, already regretting it." — write your own, in the game's deadpan voice) and `joinerDeclined` ("...you wave them off; the dungeon will find another use for them."). `joinerMet` already narrates. `memberDowned`/`memberStruck` got lines in Phase 8 — confirm they read on-tone; adjust if flat. Keep every new event type's narration present (formatEventsCoverage guard).

## Success criteria (gate)
1. `meetJoiner` sets `state.pendingJoiner` (full sheet) WITHOUT changing its rng draws; `c.joiner` + `joinerMet` unchanged.
2. `resolveJoiner{accept:true}` adds the joiner to `state.party` (respecting cap 1) and it fights in the next combat; `{accept:false}` discards it; both clear `pendingJoiner`.
3. Sarcastic on-tone narration for join/decline (+ confirm kill/downed lines).
4. **PARITY GATE:** full `npm test` + parity byte-identical to the 587/587 baseline (pendingJoiner stripped; meetJoiner draws unchanged).

## Hard constraints
Engine pure/deterministic; meetJoiner draws verbatim; new top-level `pendingJoiner` carved out everywhere `party` is; `resolveJoiner` pure; additive events with narration; no field/existing-event renames; NO git; NO build/deploy; no SUMMARY.md (policy).
