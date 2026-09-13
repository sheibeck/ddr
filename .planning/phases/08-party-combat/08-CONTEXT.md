# Phase 8: Party Combat — Context

**Gathered:** 2026-09-09 (autonomous). **Requirements:** PARTY-03, PARTY-04, PARTY-05, PARTY-06.
**Research:** `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS}.md`. **Depends on:** Phase 7 (`state.party[]` exists, 574/574, parity byte-identical).

## Phase boundary
- **DOES:** make the persistent `state.party` fight — members auto-act each round; foes can target hero OR a member; members have HP, can be downed; a downed member departs the run (NEVER the hero's `die()`); XP from kills splits among participants; hero keeps all loot.
- **Does NOT:** recruitment UI/accept-decline (Phase 9), party rail UI (Phase 10), difficulty retune (Phase 11). Does NOT touch the existing summon `C.ally` path except to leave it working.

## The seams (current line numbers, `engine/combat.js`)
- **`startCombat` (~160-167):** today syncs `c.pendingAlly → C.ally`. ADD: sync `state.party → C.allies` (an array of combat-scoped member refs, each carrying `{ ref to the persistent member, wp, maxWP, name, lvl, sub, ... }`). Combat-scoped only (reload nulls combat).
- **`allyTurn` (646-665):** the single-`C.ally` summon striker. LEAVE IT WORKING for the summon. ADD a NEW `alliesTurn(state, rng, events)` that iterates `C.allies[]` (party members) with member strike math; call it in the same place `allyTurn` is called in `afterPlayerAction`. GATE: if `C.allies` is empty/absent, `alliesTurn` returns immediately drawing NO rng.
- **`foeTurn` (674-790):** today every foe swings at the HERO only — damage applied at `c.wp -= dmg` (768) and `die(state,"combat",...)` at 779. CHANGE: each foe swing picks a target from the pool `[hero] + live members`. The HERO branch (ward 719-739, armor soak 753-767, `struckByFoe`, `die()` 778-781) stays EXACTLY as-is when the hero is the target. A MEMBER target takes a SIMPLIFIED branch: no ward/armor/mirror, subtract from the member's `wp`, emit a member-struck event, and on `wp<=0` mark the member downed + depart (see below) — NEVER call `die()`.
- **`endCombat` (~584):** sync surviving members' `wp` back to `state.party`; drop downed/departed members from `state.party`.
- **`killFoe` SP/XP award:** split among participants (hero + members who were in the fight) per canon; hero keeps all wilmst/loot (members get no loot/XP progression in v1).

## ⚠ DETERMINISM / PARITY — THE DOMINANT CONSTRAINT (read twice)
Baseline: **574/574, parity byte-identical.** The parity suite byte-compares against the FROZEN `prototype-master.js.txt`. An EMPTY party MUST draw the EXACT same rng sequence as today in `startCombat`/`foeTurn`/`afterPlayerAction`/`killFoe`. Therefore:
- **Every new rng draw is GATED behind party presence** (`state.party?.length`/`C.allies?.length`/`pool.length > 1`). Model the guard on the existing null-`C.ally` early-return in `allyTurn` and the phobia `rng.d(2)` gate.
- **foe target selection:** when there are NO live members, the foe hits the hero with NO extra draw (the code path must be byte-identical to today — do the target-pool draw ONLY when live members exist).
- **killFoe XP split:** when no members participated, the award + its rng draw are IDENTICAL to today; split logic (and any new draw) fires only when members participated.
- New serialized fields: none expected beyond `state.party` (already carved out) + `C.allies` (combat-scoped, and `state.combat` is already stripped/handled by `combatComparable` — VERIFY `C.allies` doesn't leak into a compared field; if a new combat sub-field is compared, extend the combat strip, never edit the master).
- New event types (memberStruck/memberDowned/memberDeparted/allyStruck-family reuse) each need an `EVENT_NARRATION` entry (formatEventsCoverage build guard) — reuse the `ally*` family shape where possible.
- **Run the FULL parity suite after each sub-change.** Any parity red = a missing party-presence gate; fix by adding the guard, NEVER by editing the master or loosening the comparable beyond the top-level party strip.

## Success criteria (verification gate)
1. A party member syncs into combat, auto-acts each round (own strike math), and its hits/misses narrate.
2. Foes target hero-or-member; a member has its own HP and can reach 0.
3. A downed member departs the run and NEVER triggers the hero's `die()`/run-end; combat still ends the instant `liveFoes()` clears (bounded loops, hard round ceiling).
4. XP splits among participants; loot all to hero.
5. **PARITY GATE:** with an empty party, full `npm test` + parity byte-identical to the 574/574 baseline (solo fixtures draw ZERO new rng).

## Hard constraints
Engine pure/deterministic; gated draws; no field/event renames; additive events with narration; no git commits; no build/deploy (orchestrator handles). The summon `C.ally` path keeps working.
