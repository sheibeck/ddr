# Project Research Summary

**Project:** Delve, Die, Repeat (Mazeworld) — "Joiners / Party System" milestone
**Domain:** Persistent single-player party/companion system inside a deterministic, parity-frozen, fully-serializable turn-based roguelike engine
**Researched:** 2026-09-09
**Confidence:** HIGH (all four research tracks are grounded in direct primary-source reads of the actual engine, save layer, parity harness, frozen golden master, rulebook PDF, and the design mock)

## Executive Summary

This milestone introduces the party system the engine was always designed to support: NPC "Joiners" who fight alongside the still-solo hero. It is **not** a technology-adoption effort — no library, plugin, or SDK is added (the offline/paid-upfront/zero-SDK constraint is fully honored). It is internal engine work that generalizes two disconnected, half-built ally footholds — the inert persistent `c.joiner` summary set by `meetJoiner`, and the invulnerable combat-scoped `C.ally` summon striker — into a real, damageable, serialized party roster. All four researchers converged independently and unanimously on the same shape, the same dominant hazard, and the same build spine, which is why overall confidence is HIGH.

The recommended approach is a **strangler-fig generalization, not a bolt-on**: add a persistent party (a new top-level `state.party[]` of full `rollCharacter`-shaped sheets, kept out of the parity-FROZEN `c.joiner` / `C.ally` shapes), sync it into combat at `startCombat` exactly as `pendingAlly → C.ally` already does (COMBAT-scoped `C.allies[]`), generalize the single-ally turn/target logic into a bounded multi-combatant loop, wire `meetJoiner` into real accept/decline recruitment, and turn on the design mock's already-built party rail. The rulebook is canon and explicit here: there is a dedicated JOINERS section (roll on the Level Table, accept/decline, roll up a full sheet per joiner; 4 WP/day upkeep — Dwarf 1, Troll 15; XP split among participants; wandering-monster level scales off the highest party member; the Cutthroat sacrifices a joiner — "Tough cookies!" — so joiners are canonically expendable, a ready-made dark-comedy hook).

The dominant risk is **determinism/parity**. The engine is byte-compared against a frozen `prototype-master.js.txt` that must never be edited, and the whole test strategy pins exact RNG draw-order. Every new party dice draw (member strikes, foe target choice, recruit rolls) must be **gated behind party existence** so an empty party stays byte-identical to the frozen master; new serialized fields need a `strip*` carve-out in `comparables.js` (never a master edit); and new event types need `EVENT_NARRATION` entries or the coverage guard fails the build. The second-order risk is **balance**: extra bodies trivialize the Phase-3-tuned difficulty curve, and Joiners is only 1 of 3 balance-touching milestones (with Economy & Item Balancing and Monster Balancing) that all point at `engine/difficulty.js`. The mitigation is unanimous: build the mechanics with party-power exposed as a conservative lever, and defer the global dial retune to a single consolidated pass done LAST, coordinated across the three milestones — each milestone touches only its own local knobs.

## Key Findings

### Recommended Stack

No new dependencies. This is internal engine-state work riding the existing `ddr.delve.v1` save blob through the already-`@capacitor/preferences`-backed `mzStorage`. The "stack" is the set of engine-state seams the party rides on. Persistence is nearly free: `serializeRun()` already spreads `{...state}`, so the only save-layer edit is ~2 lines — add `party` (default `[]`) to the explicit whitelists in `validateSave()` and `rehydrate()` in `engine/saveState.js`. **No `STATE_VERSION` bump is required** (additive-with-default field; old saves default to an empty party) — though a bump to 2 is a harmless documentation choice. Fail-open on malformed party data (default to `[]`, drop bad members) rather than nuking an in-progress run.

**Core technologies (engine-state mechanisms):**
- **Top-level `state.party[]`** (persistent roster of full `rollCharacter`-shaped sheets) — peers of the hero, not a property of `c`; strips in one place like `beats`; rides the save spread for free.
- **Combat-scoped `C.allies[]`** synced in at `startCombat` — mirrors today's `pendingAlly → C.ally` handoff; in-fight state is transient (reload nulls `combat`), so persistent roster lives on `c`/top-level state and only in-fight sub-state lives on combat.
- **Reuse of existing pure `rollCharacter(rng)`** — `meetJoiner` *already rolls a full sheet and discards it*; capturing it costs ZERO new RNG.
- **Guarded `partyTurn`/`alliesTurn`** and **`comparables.js` strip carve-out** — the two load-bearing determinism seams (see Pitfalls).

> **State-model tension, reconciled:** STACK framed the roster as top-level `state.party`; ARCHITECTURE framed it as `c.party` (because `rehydrate` always nulls `combat`). These agree on the substance: the **persistent** roster must live somewhere that survives reload (`c` or top-level state — NOT `state.combat`), and only the **combat-scoped** `C.allies[]` is transient and rebuilt each fight. Requirements author to pick top-level `state.party` vs `c.party`; both strip cleanly, top-level mirrors `state.combat`.

### Expected Features

Canon + code inspection define a tight, shippable v1. The `meetJoiner` seam is a dead stub (rolls a full character, keeps only a 7-field summary, nothing consumes it) and `C.ally` is an invulnerable single-slot summon striker — the milestone lights up and generalizes both.

**Must have (table stakes — a party feels broken without these):**
- Party model (`state.party[]`) + save migration — the foundation everything depends on.
- Accept/Decline recruitment (canon: "If the party accepts the Joiner, roll up a new character") — stop auto-setting `c.joiner`.
- Joiner keeps its full rolled sheet (class/race/level/gear/HP) — stop discarding `rollCharacter` output.
- Joiner auto-acts in combat each round using its own strike math.
- Joiner HP + foe targeting across the party + death/departure — a party of invulnerable bodies is a non-game.
- Party rail UI turned on (already mocked, gated OFF behind `partyOn`).
- XP split among participants + per-member upkeep (rations) — the two **[BALANCE]** counterweights; ship WITH combat, not after.

**Should have (differentiators — lean into identity):**
- Sarcastic joiner barks on join/kill/down/leave (reuse rolled `temperament`/`motive`) — cheap, core-identity payoff, family-friendly dark comedy.
- Impermanence by design ("joins you for a while") — transient tenure keeps sessions short and caps snowball.
- Class-flavored behavior (MU joiner casts; the Cutthroat sacrifice gag).

**Defer (v2+ / anti-features for a 5–10 min mobile roguelike):**
- Manual per-member control (contradicts the no-choice identity + session length) — auto-resolve instead.
- Large parties (4–6) / formations / party-splitting-by-size — cap at 1 for v1, build the array for N.
- Per-member inventories/bags/equip screens — hero holds all loot (shared pool).
- Networked multiplayer — the deferred milestone this is the solo on-ramp to.

### Architecture Approach

A strangler-fig integration that absorbs both existing ally paths into ONE party mechanism, one turn function, one targeting helper, one death helper — never parallel `allyTurn` + `partyTurn`. The persistent roster syncs into a unified combat combatant list at `startCombat`; the turn loop iterates it in fixed order; foes gain a target pool `[hero] + live members`; member damage takes a **simplified** branch (no ward/armor/mirror — those are hero-only) and member death sets `status:"downed"` and departs — it must **never** route into the hero's run-ending `die()`. All party events flow through the existing event → `formatEvent` → narration path, so once `EVENT_NARRATION` has entries, the Oracle log renders them with zero extra UI wiring; only the rail and member sheets are net-new DOM, driven data-drivenly by `party.length` (not the mock's demo `partyOn` toggle).

**Major components (with file:line seams):**
1. **`state.party[]` / `C.allies[]`** — persistent roster + combat-scoped synced list; save-migration in `saveState.js` (~2 lines) — foundation.
2. **`combat.js` turn loop** — `startCombat` (~163, sync party in), `allyTurn`→generalized iterate (~646), `foeTurn` (~674-790; today every foe hits ONLY the hero at ~768 — becomes a hero+members target pool with a simplified member-damage branch), `endCombat` (~584, sync member HP back), `afterPlayerAction` (guarded party turn).
3. **`encounters.js` `meetJoiner` (~397-407)** — wire real accept/decline recruitment; keep setting `c.joiner` identically (frozen), additionally push the already-rolled full sheet into the roster (zero new RNG).
4. **UI: party rail + member sheets** in `mazeworld.html` via the `window.__mzState` bridge (no new bridge); reuse Phase-4 status chips; `eventNarration.js` builders reusing the `ally*` family.
5. **`difficulty.js`** — party-aware, but ONLY in the deferred consolidated balance phase.

### Critical Pitfalls

1. **New RNG draws shift the seeded cursor and break the parity suite.** Gate every new draw (member strike, foe target choice, recruit roll) behind party existence (`state.party?.length` / `pool.length > 1`), exactly as the phobia-Hardiness `rng.d(2)` and today's null-`C.ally` `allyTurn` already do. Never add an unconditional draw to `startCombat`/`foeTurn`/`playerStrike`/`afterPlayerAction`. Signature of failure: a cascade of many parity fields go red at once while unit tests pass.
2. **New engine-only party fields aren't carved out of `comparable()` → permanent false parity failures.** Add a `stripPartyField`/top-level `party` strip to all three `*Comparable()` fns in `comparables.js` (mirroring `stripDarkForField`), document the deliberate-divergence rationale, and NEVER edit `prototype-master.js.txt`. Keep party events additive new types (reuse `ally*` where shape matches) so no existing event-shape assertion breaks.
3. **Extra bodies trivialize combat and the difficulty curve is done 3×.** Party power must be a designed-in lever (P1/P2) but the global `difficulty.js` retune is deferred to ONE consolidated pass done LAST, coordinated with Economy & Monster milestones — each milestone touches only local knobs. XP-split (canon) + upkeep (canon) are the built-in counterweights; recommend joiners do NOT accrue XP/loot in v1 (hired muscle), hero holds all loot.
4. **Combat loop drags past the 5–10 min session or infinite-loops.** Model party turns as a bounded `for` over a snapshot (never a `while`), guard dead/no-target cases, re-check `liveFoes()` after every actor so combat ends the instant foes clear, cap party size, add a hard round ceiling.
5. **Save migration + member death semantics.** Persistent party must live on `c`/top-level (combat is nulled on reload); default missing party to `[]` everywhere; validate/clamp member fields fail-closed. A downed member departs the run and must fork AWAY from the hero's `die()` — never end the run when a companion falls.

## Implications for Roadmap

All four tracks independently produced the **same dependency-ordered spine**: Party Model → Party Combat → Joiner Acquisition → Party UI → Balance (deferred) → Death Semantics. This is "make it work → make it visible → make it fair." Suggested phases:

### Phase 1: Party Model + Migration + Parity Carve-outs
**Rationale:** Zero upstream deps; unblocks everything. Highest-leverage, highest-risk piece.
**Delivers:** Persistent `state.party[]` (full sheets), the ~2-line `saveState.js` whitelist migration (default `[]`, no `STATE_VERSION` bump needed), the `comparables.js` strip carve-out, and a save round-trip test. Party still inert in combat.
**Addresses:** Party model + "joiner keeps own sheet" (FEATURES table stakes).
**Avoids:** Pitfall 2 (carve-out defined the moment the field lands), Pitfall 8 (persistent-on-`c`, fail-open migration), Pitfall 10 (absorb `C.ally`, don't duplicate).
**Gate:** empty/one-member party ⇒ existing tests byte-identical.

### Phase 2: Party Combat (turn order, targeting, RNG gating, loop termination)
**Rationale:** The mechanical heart; needs a roster to read.
**Delivers:** `startCombat` syncs `party → C.allies`; `endCombat` syncs HP back; generalized `alliesTurn`; `foeTurn` target-pool + simplified member-damage branch + member down (never `die()`); new events + `EVENT_NARRATION` builders.
**Uses:** existing `STRIKE_DICE`/strike math; `window.__mzState` unchanged; `applyAction` switch UNTOUCHED (auto-resolved members).
**Avoids:** Pitfalls 1, 6, 7, 11 (gated draws, bounded loops, one target/death helper, member-death fork).
**Gate:** full parity suite green; solo fixtures draw ZERO new RNG; `combatEnded` always reached.

### Phase 3: Joiner Acquisition (wire `meetJoiner` recruitment)
**Rationale:** Combat must exist before recruits are meaningful.
**Delivers:** accept/decline gate on the `Joiner` encounter; capture `meetJoiner`'s already-rolled sheet into the roster (zero new RNG); respect a party-size cap; keep `c.joiner` set identically (frozen).
**Addresses:** Accept/Decline (canon-required agency).
**Avoids:** Pitfall 1 (recruit draws gated to the non-chargen encounter path), Pitfall 10 (absorb `meetJoiner`).

### Phase 4: Party UI (turn the rail on)
**Rationale:** UI needs live combat/party state to render.
**Delivers:** party rail over `C.allies` (per mock, drop the `partyOn` toggle — data-drive on `party.length`); member sheets on the HERO screen; compact status chips (reuse Phase-4 combat-UX pattern); tap-to-expand.
**Implements:** the design mock's already-built rail; presentation-only over engine state.
**Avoids:** Pitfall 9 (fixed-cap rail, portrait-legible) — with a device-review checkpoint on the Pixel 7.

### Phase 5: Balance (deferred consolidated retune)
**Rationale:** You cannot tune against a party that doesn't yet exist; and Joiners is 1 of 3 balance milestones. Do the global `difficulty.js` retune ONCE, LAST.
**Delivers:** party-power input to `difficultyCurve`; XP-÷-party; ration upkeep — coordinated with Economy & Item Balancing (shared playtest pass, shared reward numbers).
**Avoids:** Pitfalls 3 & 4 (curve invalidation, triple-retune). Each earlier milestone touches only its local knobs.

### Phase 6: Death / Permadeath Semantics
**Rationale:** Finalize the lifecycle knob once combat + UI expose it.
**Delivers:** downed-member departs-the-run (no hero `die()`, no run-end), roster/save cleanup of dead members, on-tone dark-humor departure lines. May fold into Phase 2's combat branch if kept minimal.

### Phase Ordering Rationale
- **Data before behavior before visibility before balance** — the unanimous dependency chain; matches the proposed-milestone's own candidate order.
- **Balance is deliberately last and shared** — the single most important sequencing decision; prevents tuning `difficulty.js` 2–3× against stale assumptions.
- **Every phase carries a determinism gate** in its success criteria (empty party ⇒ byte-identical), because parity is the dominant hazard.

### Research Flags
Phases likely needing deeper research during planning (`/gsd-plan-phase --research-phase`):
- **Phase 2 (Combat):** the highest-parity-sensitivity change (`foeTurn` retrofit, RNG gating, loop termination) — worth a focused pre-plan pass over the exact draw sites even though the seams are already mapped.
- **Phase 5 (Balance):** genuinely cross-milestone; needs the Economy/Monster ordering decided and the tuning harness re-run with party scenarios — coordinate, don't research in isolation.

Phases with standard/well-documented patterns (skip research-phase):
- **Phase 1 (Model/Migration):** the save/parity seams are documented to file:line; it's mechanical.
- **Phase 3 (Acquisition):** a single-seam wire-up of an already-analyzed stub.
- **Phase 4 (UI):** the rail is already designed in the mock and the bridge is known.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct read of the engine + save layer + parity harness; no new deps; seams cited to file:line. |
| Features | HIGH | Rulebook canon read directly (JOINERS §, line-cited) + line-by-line code inspection + genre patterns. |
| Architecture | HIGH | Every integration point cited to file:line across engine, bridge, and the design mock. |
| Pitfalls | HIGH | Grounded in the frozen master + harness + save layer; each pitfall maps to a phase + verification. |

**Overall confidence:** HIGH — remarkable four-way convergence on state shape, the parity hazard, and the build spine.

### Gaps to Address
Open questions for the requirements author (research recommendations in parentheses):
- **Party-size cap for v1** — (recommend 1 joiner; build the array for N).
- **State home for the persistent roster** — top-level `state.party` vs `c.party` (both strip cleanly; top-level mirrors `state.combat`; must NOT be on `state.combat`).
- **Joiner lifecycle** — permadeath-on-downed vs leave-after-N vs both (recommend BOTH: downed departs the run; transient tenure caps snowball).
- **Does a temporary joiner count for the XP split** — (recommend yes, while present).
- **Foe-targeting rule** — draw-free fixed rule vs gated random (either is fine; gate any draw behind `party.length > 0`).
- **Reconcile the `meetJoiner` `maxWP` double-roll quirk** in the master — fix deliberately, behind the non-chargen gate (itself a Pitfall-1 event).
- **Final ordering of the 3 balance milestones** — decide at milestone-planning; global `difficulty.js` retune reserved for one consolidated pass.

## Sources

### Primary (HIGH confidence)
- `engine/combat.js` — `startCombat` (~163), `allyTurn` (~646), `foeTurn` (~674-790, hero-only hit at ~768), `afterPlayerAction`, `endCombat` (~584), guarded-RNG precedents.
- `engine/saveState.js` — `serializeRun` spread, `validateSave`/`rehydrate` whitelists (the ~2-line migration), `STATE_VERSION`, combat-reset-on-load.
- `engine/encounters.js:397-407` (`meetJoiner` dead stub), `engine/magic.js:99-123` (summon `C.ally`), `engine/character.js:140-218` (`rollCharacter`), `engine/state.js` (`newRun`), `engine/difficulty.js` (pure curve).
- `test/parity/harness/comparables.js` (`stripDarkForField` carve-out pattern) and `test/parity/prototype-master.js.txt` (FROZEN — `c.joiner`/`C.ally` verbatim; `maxWP` double-roll quirk).
- `mazeworld.pdf` rulebook — JOINERS § (line 5615), Level Table (~5645), upkeep (582/719/732/1309), XP split (1368), initiative (1342), member-target resolution (1311), wandering-monster scaling (1319), Cutthroat sacrifice (1177).
- `design/Mazeworld Mobile.dc.html` (party rail, `partyOn` gate), `mazeworld.html` (`__mzState` bridge :2053, combat render, save/load), `src/browser/eventNarration.js` (coverage guard + `ally*` family).
- `.planning/PROJECT.md`, `.claude/CLAUDE.md`, `.planning/proposed-milestone-joiners-party-system.md` — constraints, voice, balance-coupling.

### Secondary (MEDIUM confidence)
- Genre companion patterns (NetHack pets, DCSS summons, Darkest Dungeon provisions/party) — established turn-based roguelike design.

### Tertiary (LOW confidence)
- None — all findings trace to primary sources.

---
*Research completed: 2026-09-09*
*Ready for roadmap: yes*
