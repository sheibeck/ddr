# Architecture Research

**Domain:** Persistent single-player party system inside a pure/serializable roguelike engine (strangler-fig migration)
**Researched:** 2026-09-09
**Confidence:** HIGH (primary-source read of the actual engine + bridge + mock; every claim below is cited to file:line)

## Executive Framing

The engine already contains **two disconnected proto-party mechanisms** that this milestone unifies:

1. **`c.joiner`** — a *persistent* NPC set by `meetJoiner` (`engine/encounters.js:397-407`), shape `{name, race, sub, cls, lvl, wp, maxWP}`. It survives across floors in `state.c`, **but nothing in combat ever reads it.** It is a dead-end field today: acquired, narrated (`joinerMet`), then inert.
2. **`C.ally`** — a *combat-scoped* transient set by the summon spell (`engine/magic.js:111-122`), shape `{lvl, rounds, name}`. It strikes once per round (`allyTurn`, `engine/combat.js:646-665`) and departs after `C.ally.rounds` hits. Reaches combat via the `c.pendingAlly → C.ally` one-shot handoff (`engine/combat.js:163-167`).

**The milestone = promote `c.joiner` (single) into a real persistent `c.party[]` roster, sync it into combat the way `pendingAlly` already syncs, and generalize the single-`C.ally` turn/target logic into a multi-combatant loop — without breaking determinism, the EVENT_NARRATION coverage guard, or the classic↔module bridge.**

The design authority (`design/Mazeworld Mobile.dc.html`) already contains the target UI: a **party rail** gated behind `s.partyOn` (default OFF, `:383` `partyOn: !!props.partyMode`), showing up to three members each with their own WP and an active-turn highlight (`:700-706`), plus the map marker "THE PARTY … one dot, until something finds you and makes it three" (`:800`). Turning that rail on is the UI half of this milestone.

## Standard Architecture

### System Overview (current strangler-fig, with party additions marked ★)

```
┌──────────────────────────────────────────────────────────────────────┐
│  mazeworld.html  (single-page: classic dead code + live <script module>)│
│  ┌────────────────────┐        ┌──────────────────────────────────┐   │
│  │ classic renderers  │◄──────►│  window.__mzState  {get,set}      │   │
│  │ renderEncounter()  │  reads │  (the ONLY state bridge, :2053)   │   │
│  │  reads S.combat    │  S     └──────────────────────────────────┘   │
│  │  ★ render C.allies │              ▲  window.mzAttack / mzToast etc. │
│  │  ★ party rail       │              │                                 │
│  └────────────────────┘              │                                 │
├──────────────────────────────────────┼─────────────────────────────────┤
│  src/browser/  (adapters — presentation only, never mutate state)      │
│  ┌──────────────────┐   ┌──────────────────────────────────────────┐  │
│  │ engineAdapter.js │──►│ dispatch(action) → applyAction(state,act) │  │
│  │  formatEvent()   │◄──│   returns {state, events}                 │  │
│  └────────┬─────────┘   └──────────────────────────────────────────┘  │
│           │ delegates to                                                │
│  ┌────────▼──────────────────────────────────────────────────────┐    │
│  │ eventNarration.js  EVENT_NARRATION{}  (coverage-guarded table) │    │
│  │  ★ every NEW event type needs an entry or the test fails       │    │
│  └───────────────────────────────────────────────────────────────┘    │
├────────────────────────────────────────────────────────────────────────┤
│  engine/  (PURE: no DOM, no I/O; applyAction(state,action)→{state,events})│
│  ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ engine.js │ │ combat.js │ │encounters│ │ magic.js │ │difficulty.js│  │
│  │ dispatch  │ │ ★turn loop│ │ meetJoiner│ │ summon   │ │ ★party-aware│  │
│  │ switch    │ │ ★foe tgt  │ │ →★c.party │ │ →C.ally  │ │ retune      │  │
│  └───────────┘ └───────────┘ └──────────┘ └──────────┘ └────────────┘  │
│           state.c (player + ★c.party[])   state.combat (C + ★C.allies)  │
│           state.rngState  (persisted deterministic cursor)             │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (party-relevant)

| Component | Owns today | Party change |
|-----------|-----------|--------------|
| `state.c` | player character fields incl. single `c.joiner` (`encounters.js:404`) | **NEW** `c.party[]` roster; `c.joiner` deprecated/migrated into it |
| `state.combat` (`C`) | `C.foes[]`, `C.target`, `C.round`, `C.first`, single `C.ally` | **NEW** `C.allies[]` (party synced in + transient summons) |
| `combat.js` `startCombat` (:163-167) | one-shot `pendingAlly → C.ally` handoff | **MODIFIED** sync `c.party[] → C.allies[]` (and keep summon path) |
| `combat.js` `allyTurn` (:646-665) | single ally strikes `liveFoes[0]`, decrements rounds | **MODIFIED → `alliesTurn`** iterate `C.allies[]` |
| `combat.js` `afterPlayerAction` (:601-640) | turn loop: ally → foe → round++/init | **MODIFIED** call `alliesTurn`; re-check clears after it |
| `combat.js` `foeTurn` (:674-790) | every foe attacks **the player only** (`c.wp -= dmg`, :768) | **MODIFIED** choose target among player + live party members |
| `combat.js` `endCombat` (:584-592) | tears down `state.combat` | **MODIFIED** sync surviving `C.allies` HP back to `c.party[]` |
| `encounters.js` `meetJoiner` (:397-407) | sets single `c.joiner` | **MODIFIED** push into `c.party[]` (respect a party-size cap) |
| `magic.js` summon (:111-122) | sets `C.ally` / `c.pendingAlly` | **MODIFIED** target `C.allies[]` / a pending-summon list |
| `difficulty.js` `difficultyCurve` (:108-118) | pure depth→knobs, party-blind | **MODIFIED (balance phase)** account for party power |
| `eventNarration.js` `EVENT_NARRATION` | ~162-type coverage-guarded table | **MODIFIED** add an entry per new event type |
| `mazeworld.html` `renderEncounter` (~:4480-4527) | renders `C.ally` card (:4502-4509), foes, actions | **MODIFIED** render `C.allies[]`; party rail; member sheets |

## Recommended State Model

### Where the party lives

```
state.c                       # the player = de-facto party leader (unchanged)
  ├── wp, maxWP, ward, mirror, armorWP …   # player-only defensive machinery
  ├── party: [                ★ NEW: persistent roster (generalizes c.joiner)
  │     { id, name, race, sub, cls, lvl,
  │       wp, maxWP,          # survives across floors, mended by rest
  │       status: "ok"|"downed",   # v1 death semantics knob
  │       origin: "joiner" }  # provenance (joiner vs future recruit)
  │   ]
  └── joiner: null            # DEPRECATED — migrated into party[] (see below)

state.combat (C)              # combat-scoped, rebuilt every fight
  ├── foes: [ … ]
  ├── target                  # player's chosen foe index (playerStrike :271)
  ├── allies: [               ★ NEW: unified combatant list for this fight
  │     { ref: "party", id }  #   — a live view/sync of a c.party[] member
  │     { ref: "summon", lvl, rounds, name }  # transient summon (old C.ally)
  │   ]
  └── first, round …
```

**Design decision — keep persistent party and transient summons in ONE combat list (`C.allies`) but tagged by `ref`.** Persistent members sync HP back out at `endCombat`; `ref:"summon"` members are discarded (they only ever lived in `C`, exactly like today's `C.ally`). This preserves the existing summon semantics (`magic.js:111-122`, departs after `rounds`) while letting the turn loop iterate a single array.

### Save migration (mandatory, one-time)

Old saves carry `c.joiner` (single object or `null`) and no `c.party`. On load:

```
c.party = Array.isArray(c.party) ? c.party
        : c.joiner ? [ {...c.joiner, id: 0, status: "ok", origin: "joiner"} ]
        : [];
c.joiner = null;
```

Follow the codebase's existing save-migration discipline (`mazeworld.html` save/load routes through `window.mzStorage`, :4599-4615). Because saves are serialized JSON and the engine is `structuredClone`-based (`engine.js:44`), the party array serializes for free — the "multiplayer-ready" property PROJECT.md protects (`CLAUDE.md` "state serializable") already covers it.

## The Combat-Loop Extension (the core engine change)

### Turn order today (`afterPlayerAction`, combat.js:601-640)

```
player acts (playerStrike/castSpell/…)   ← the dispatched action
  → clear? end : allyTurn (single C.ally)   :609
  → clear? end : foeTurn (all foes hit player)  :615
  → clear? end : round++ ; rollInitiative       :627-628
  → if first==="foe": foeTurn again ; round++    :629-637
```

### Recommended extension

1. **`allyTurn` → `alliesTurn(state, rng, events)`** — iterate `C.allies` in **fixed array order** (party members first in roster order, then summons). Each member reuses the existing strike math verbatim (`combat.js:651-656`): roll `STRIKE_DICE[lvl-1]`, hit on `roll ≤ 5`, dmg `lvl*lvl + d6`, `killFoe` on `wp ≤ 0`. Summons additionally decrement `rounds` and depart at 0 (the current `:660-662` logic, applied per-summon). Emit one strike/miss event **per member**.

2. **Targeting for allies** — v1: keep the current "hit `liveFoes(state)[0]`" default (`combat.js:649`). Cheapest, matches the mock's auto-resolved "EACH ROLLS THEIR OWN" (`:697`). A `memberId → foe index` map is a later refinement, not v1.

3. **Foe targeting (`foeTurn`, combat.js:674-790)** — today every foe unconditionally lands on the player (`c.wp -= dmg`, :768; `die(...)` on `c.wp ≤ 0`, :778-781). Generalize to a **target pool** = `[player] + livePartyMembers`. Recommended v1 rule: each foe picks a target by a *deterministic* roll over the pool size (e.g. `rng.d(pool.length)`), so bodies genuinely soak hits (the whole balance point). Then **branch damage application**:
   - target = player → the full existing pipeline (ward → armor soak → `c.wp`), unchanged.
   - target = party member → a **simplified** pipeline in v1: `member.wp -= dmg` (no ward/armor/mirror — those are player-only fields). Member death → set `status:"downed"`, remove from `C.allies`, emit an event. **Do NOT call `die()`** for a member (`die()` is the run-ending player terminator, `death.js`).

4. **Determinism guard (critical).** The engine is seeded and parity-tested against the solo prototype (`difficulty.js` header; `structuredClone` + `rngState` in `engine.js:44-48,103`). New `rng` draws in `alliesTurn`/`foeTurn` **must be gated so an empty party consumes zero extra RNG** — i.e. `if (C.allies.length)` around ally draws, and only widen the foe-target roll when `pool.length > 1`. This mirrors exactly how phobia/darkness code (`combat.js:203-218`) and `difficulty.js` were added without perturbing the seeded stream. An empty `c.party` ⇒ byte-identical behavior to today ⇒ existing parity/round-trip/determinism tests stay green.

### New engine actions — only if members are player-directed

The mock is **auto-resolved** (party members roll their own strikes; the only party-aware button change is the strike label showing whose turn it is, `:710`). **Recommendation for v1: auto-resolve, add NO new player-facing actions** — `alliesTurn` runs inside `afterPlayerAction` just like `allyTurn` does now. This keeps the `applyAction` switch (`engine.js:51-99`) untouched and is faithful to the prototype's "no party micromanagement" solo conversion (`mazeworld.html:1409`).

If player-directed control is later desired, add a pure action e.g. `{type:"partyStrike", memberId, targetIdx}` to the switch (`engine.js`), handled like `attack`/`castSpell`, emitting events — but treat that as a **separate, optional milestone**, not v1.

### New event types → EVENT_NARRATION entries are MANDATORY

`test/unit/formatEventsCoverage.test.js` derives the full event vocabulary from `engine/*.js` source and asserts **every** type has a non-null `EVENT_NARRATION` entry (`eventNarration.js:6-9`). Any new `events.push({type:"…"})` **fails the build** until a builder is added.

**Minimize new types by reusing the existing `ally*` family** (`eventNarration.js:184-186,127`): `allyStruck`, `allyMissed`, `allyDeparted`, `allyJoined` already carry `{name, target, dmg}` and render generically — party members can emit these directly. New types likely still needed, each requiring a builder:

| New event | When | Reuse instead? |
|-----------|------|----------------|
| `partyMemberJoined` | `meetJoiner` adds to roster | maybe reuse `joinerMet` (:290) |
| `partyMemberHurt` | foe hits a member | NEW (foe→member has no analog; `struckByFoe` is player-only, :196) |
| `partyMemberDowned` / `partyMemberDied` | member `wp ≤ 0` | NEW (death semantics knob) |
| `partyMemberLeft` | summon rounds expire | reuse `allyDeparted` (:186) |

Keep new types **few and additive**; do not remove `ally*` entries (the coverage test also forbids dead/typo entries, :29-34).

## UI Integration (turning the rail on)

### Bridge constraint

The live module cannot see classic block-scoped consts; the **only** state channel is `window.__mzState = {get,set}` (`mazeworld.html:2053`), and classic renderers read `S` while module actions are exposed as `window.mz*` (e.g. `window.mzAttack`, `mzToast`, `mzCombatFeedback`, `mzCombatReport`, wired at :4575-4594). Party rendering therefore must:

1. Read party from live state: `S.c.party` and `S.combat.allies` via the same `S` the classic `renderEncounter` already reads.
2. Render the **party rail** (currently the summon `C.ally` card, `mazeworld.html:4502-4509`) as a list over `C.allies`, styled per the mock's rail (`design/…dc.html:240-244,700-706`) — each member: name, WP, active-turn highlight.
3. Add out-of-combat party display on the HERO/character screen (member sheets: race/sub/cls/lvl/HP) sourced from `S.c.party`.
4. Show **joiner status during combat** (rounds left for summons; HP for persistent members) — extend the existing `.foe.ally` card (CSS at `mazeworld.html:535`).

The mock's toggle (`partyOn`, `togglePartyMode` :813) is a **mock-only demo affordance**; in the real game the rail visibility is driven by `S.c.party.length > 0`, not a manual toggle. Do not port the toggle button.

### Feedback plumbing

Combat action feedback already rides fixed toasts / a victory report, not in-panel badges (`mazeworld.html:4498-4500`, `window.mzToast` :2532, `mzCombatReport` :2599). Party strike/hurt lines flow through the **same event → `formatEvent` → narration** path as everything else, so once `EVENT_NARRATION` has the entries, the Oracle log renders party events with zero extra UI wiring. Only the *rail* and *sheets* are net-new DOM.

## Difficulty-Dial Interaction & Retune Sequencing

`engine/difficulty.js` is a **pure `difficultyCurve(depth)`** (`:108-118`) that bounds encounter-dot count and darkness — it is **party-blind**. Adding N extra bodies that strike every round and soak foe hits makes every fight materially easier at a given depth, flattening the Phase-3-tuned curve.

Interacting balance surfaces (all touched by party size):
- **Combat lethality** — foes now split damage across the pool (`foeTurn` change above); the curve was tuned for one target.
- **XP economy** — the prototype divides XP by party size (`mazeworld.html:1411`, "÷ party"); solo hard-codes party=1 (×5). More members change `spGained` math.
- **Rations/upkeep** — "a party eats more" (proposed-milestone `:13`); `wentHungry` (`eventNarration.js:91`) pressure scales with mouths to feed.

**Recommended sequencing (do the retune LAST, and only once):**

1. Land party **data model + combat + UI first** with `difficultyCurve` **unchanged**. Fights will be temporarily too easy — accept that; you cannot tune against a party that does not yet exist.
2. Then a **single balance phase** that (a) adds a party-power input to `difficultyCurve` (e.g. a `partyStrength` argument or a post-curve multiplier — keep it a *pure function of party composition + depth*, no RNG, preserving the module's determinism contract, `:9-13`), and (b) revisits XP-÷-party and ration upkeep together.
3. **Coordinate with the "Economy & Item Balancing" milestone** (proposed-milestone `:27-28`): both retune the same curve/economy. Sequence them adjacent and share one playtest pass so the curve is not tuned twice. This is explicitly **1 of 3 balance-touching milestones** — treat the difficulty retune as a shared, sequenced concern, not a party-local edit.

Keep the retune's constants where Phase-3 left its knobs (`difficulty.js:24-39`) so there is one source of difficulty truth.

## New vs Modified — component ledger

**NEW**
- `state.c.party[]` roster (state shape) + save-migration shim.
- `state.combat.allies[]` unified combatant list.
- `alliesTurn` (generalized from `allyTurn`) — or a rewrite of `allyTurn` in place.
- Foe target-selection branch + member-damage pipeline in `foeTurn`.
- Party-hurt/downed/died event types + their `EVENT_NARRATION` builders.
- Party rail DOM + member sheets in `mazeworld.html` (rail styled per mock).
- Party-power input to `difficultyCurve` (balance phase).

**MODIFIED**
- `combat.js` `startCombat` (:163-167) — sync `c.party → C.allies` alongside the summon handoff.
- `combat.js` `afterPlayerAction` (:601-640) — call `alliesTurn`; keep clear-checks.
- `combat.js` `endCombat` (:584-592) — persist member HP back to `c.party`.
- `encounters.js` `meetJoiner` (:397-407) — append to `c.party` (with cap) instead of overwriting `c.joiner`.
- `magic.js` summon (:111-122) — write into `C.allies` / a pending-summon list.
- `eventNarration.js` — add builders; reuse `ally*` where possible.
- `mazeworld.html` `renderEncounter` (~:4480-4527) + character screen — read `C.allies` / `S.c.party`.
- `difficulty.js` (:108-118) — party-aware, in the balance phase only.

**UNCHANGED (must stay so)**
- `engine.js` `applyAction` switch (:51-99) — untouched if party is auto-resolved (recommended v1).
- `window.__mzState` bridge (:2053) — the party reuses it; no new bridge.
- Determinism/parity contract — guarded by the empty-party RNG gate.

## Recommended Build Order (dependency-ordered phases)

```
Phase A — DATA MODEL (foundation, no behavior change)
  • Add c.party[]; migrate c.joiner→c.party on load; meetJoiner appends (cap).
  • Serialization + save-migration tests. Party still inert in combat.
  • Gate: empty/one-member party ⇒ existing tests byte-identical.
        ↓ (combat needs a roster to read)
Phase B — COMBAT (the mechanical heart)
  • startCombat syncs c.party→C.allies; endCombat syncs HP back.
  • allyTurn→alliesTurn (iterate C.allies, per-member strike).
  • foeTurn target-selection + member-damage branch; member down/death.
  • New events + EVENT_NARRATION builders (coverage test must pass).
  • Determinism gate: empty party = zero extra RNG draws.
        ↓ (UI needs the live C.allies / c.party to render)
Phase C — UI (turn the rail on)
  • Party rail over C.allies (per mock); member sheets on HERO screen;
    joiner/summon status in combat. All via window.__mzState; no new bridge.
  • Party events already narrate through formatEvent (from Phase B).
        ↓ (balance needs a real, playable party to tune against)
Phase D — BALANCE (retune, do ONCE, coordinate with Economy milestone)
  • Party-power input to difficultyCurve; XP-÷-party; ration upkeep.
  • Shared playtest pass with the Economy & Item Balancing milestone.
```

**Rationale:** data model has no upstream deps and unblocks everything; combat depends on the roster; UI depends on live combat/party state; balance depends on a working, playable party to tune against (you cannot tune a party that does not exist yet). This is the classic "make it work, make it visible, make it fair" ordering and it matches the proposed-milestone's own candidate-scope order (`proposed-milestone…:19-26`).

## Anti-Patterns (specific to this integration)

### Anti-Pattern 1: Routing foe damage to party members through the player's defensive pipeline
**What people do:** reuse `foeTurn`'s ward/armor/mirror/`die()` block for members.
**Why it's wrong:** `c.ward`, `c.armorWP`, `c.mirror` are **player-only** fields (`combat.js:719-788`), and `die()` ends the *run* (`death.js`). Applying them to a member either crashes or kills the player when a companion falls.
**Instead:** a simplified `member.wp -= dmg` branch; member death sets `status:"downed"` and emits a party event — never `die()`.

### Anti-Pattern 2: Adding RNG draws that fire even when the party is empty
**What people do:** unconditionally roll ally strikes / foe-target selection.
**Why it's wrong:** perturbs the seeded cursor (`engine.js:48,103`), breaking parity/determinism tests against the solo prototype.
**Instead:** gate every new draw behind `C.allies.length` / `pool.length > 1`, exactly as phobia/darkness (`combat.js:203-218`) and `difficulty.js` were introduced.

### Anti-Pattern 3: Emitting new event types without an EVENT_NARRATION builder
**What people do:** `events.push({type:"partyMemberHurt", …})` and move on.
**Why it's wrong:** `formatEventsCoverage.test.js` fails the build (`eventNarration.js:6-9`); the render loop would also silently drop the line.
**Instead:** add the builder in the same change; reuse the `ally*` family where the shape matches.

### Anti-Pattern 4: Tuning `difficultyCurve` inside the combat/UI phases
**What people do:** nudge difficulty constants while building party combat.
**Why it's wrong:** you are tuning against a moving target and will redo it; it also collides with the Economy milestone's curve edits.
**Instead:** defer all curve/economy edits to the single Phase-D balance pass, coordinated with the Economy milestone.

### Anti-Pattern 5: Porting the mock's `partyOn` toggle as a real feature
**What people do:** ship a "make this a party" toggle button.
**Why it's wrong:** it is a mock demo affordance (`design/…dc.html:813`); real party presence is data-driven (`c.party.length`).
**Instead:** derive rail visibility from `S.c.party.length > 0`.

## Integration Points (quick reference)

| Boundary | File:line | Change |
|----------|-----------|--------|
| pendingAlly→combat handoff | `engine/combat.js:163-167` | add `c.party→C.allies` sync |
| single ally strike | `engine/combat.js:646-665` | generalize to `alliesTurn` over `C.allies` |
| turn loop | `engine/combat.js:601-640` | call `alliesTurn`; keep clear-checks |
| foe damage → player only | `engine/combat.js:674-790` (apply :768,778) | target pool + member-damage branch |
| combat teardown | `engine/combat.js:584-592` | sync member HP back to `c.party` |
| joiner acquisition | `engine/encounters.js:397-407` | append to `c.party` (cap) |
| summon | `engine/magic.js:111-122` | write `C.allies` / pending-summon |
| narration table | `src/browser/eventNarration.js:127,184-186,290` | reuse `ally*`; add party builders |
| state bridge | `mazeworld.html:2053` | reuse `window.__mzState` (no new bridge) |
| combat render (ally card) | `mazeworld.html:4502-4509` | render `C.allies[]` as rail |
| party rail (design authority) | `design/Mazeworld Mobile.dc.html:240-244,700-706` | port styling; drop the toggle |
| difficulty curve | `engine/difficulty.js:108-118` | party-aware (balance phase only) |

## Sources

- Direct read of `engine/combat.js` (turn loop :601-640, `allyTurn` :646-665, `foeTurn` :674-790, `startCombat` :163-167, `endCombat` :584-592, `rollInitiative` :69-88) — CONFIDENCE: HIGH (primary source)
- Direct read of `engine/encounters.js` `meetJoiner` :397-407, `engine/magic.js` summon :111-122, `engine/engine.js` `applyAction` :33-105 — CONFIDENCE: HIGH
- Direct read of `engine/difficulty.js` (pure curve, determinism contract) — CONFIDENCE: HIGH
- Direct read of `src/browser/eventNarration.js` (coverage guard :6-9; `ally*`/`joinerMet` entries) — CONFIDENCE: HIGH
- Direct read of `mazeworld.html` (`__mzState` bridge :2053, combat render :4480-4538, ally card :4502-4509, `window.mz*` wiring :4575-4594, save/load :4599-4615, dead classic party code :3443-3446,3798,4095-4105) — CONFIDENCE: HIGH
- Direct read of `design/Mazeworld Mobile.dc.html` (party rail :240-244,697-710,800; `partyOn` :383,813) — CONFIDENCE: HIGH
- `.planning/proposed-milestone-joiners-party-system.md`, `.planning/PROJECT.md`, `.claude/CLAUDE.md` (scope, serializability/multiplayer-ready constraint, balance-milestone coordination) — CONFIDENCE: HIGH

---
*Architecture research for: persistent single-player party system integration*
*Researched: 2026-09-09*
