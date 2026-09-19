# Phase 41: Terrain, Darkness & Phobias - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run, `defer uat to end`) — research first (`41-RESEARCH.md`, roadmap-flagged), then one batched question with three areas; all three answered with the recommended option. Pool density/size decided by the orchestrator as routine (research Decision 2, Option A).

<domain>
## Phase Boundary

Water and darkness become real, felt terrain: floors can contain multi-square water pools; stepping onto water costs two squares of time; a dark square without Night Vision or a light effect shows only the 3×3 area around the party; every phobia fires once on fresh entry into its trigger — never every step inside a region — arming the existing Afraid penalty for the next fight, never a lost action, with the trigger named in the rail line.

Requirements: TERR-01 … TERR-05.

Out of scope: new terrain kinds beyond water (lava, ice, etc.), swimming/drowning rules, the reveal-radius model (Phase 40's Map the Floor stays orthogonal — the darkness filter only hides at render time), bot *tactics* around water/fear (Phase 42 — but the bot must path across water and keep running), the tutorial.

</domain>

<decisions>
## Implementation Decisions

### Standing rulings that bind this phase
- **Greenfield, no legacy paths (user, 2026-09-17) — SUPERSEDES the roadmap's `state.terrainRoll` gate.** The roadmap/requirements text ("gated behind a run flag mirroring `storeRoll`, so every existing fixture, bot and old save generates identically") describes exactly the dual path the user forbade, and the user named "water in `genFloor`" as the example where fixtures follow. So: **water is generated for every run, fixture and bot — no run flag.** Technique: place water from a **derived rng stream** (`derivedRng(rng.getState(), "terrain", depth)`) AFTER every existing `genFloor` draw, so no main-rng draw moves; the grid field (`cell.water`) is a structural harness carve-out exactly like Phase 40's `spellSeen`; the only fixtures that diverge are those whose scripted actions step onto a water cell (their `state.steps`/`c.timers` move) — MEASURE them live (research Pitfall 1 recipe), declare each with before/after, regenerate only those. `test/parity/prototype-master.js.txt` never edited. Old saves: tolerant load — a floor saved without water stays waterless until the next descent; no card.
- **Once-a-day rule (100 squares = one day)**; **deferred UAT**; **rail is the one feedback surface** (phobia triggers are narrative lines, not cards, unless a decision is involved); every new event → `EVENT_NARRATION` + `TOAST_FOR` + `RAIL_FAMILY`; voice scan; HP not WP.
- **Depth-20 target**; the v1.5 BEFORE pin is the yardstick; Phase 42 owns the AFTER matrix (water's time cost will shift hunger/depth — expected, measured there).

### Area 1 — TERR-02 water cost: **One tap, two squares of time** (user-chosen; ratified Key Decision — record in PROJECT.md at phase close)
- A single `move` onto a water cell advances `state.steps` by 2 and runs every per-square system twice: `tickSquares(c, 2)` (item/spell/ability/torch timers, the Map the Floor window), hunger, `c.darkFor`, the encounter clock, member timers — one dispatch, no partial-move state. The HUD square counter jumps by 2. Leaving water (stepping onto a dry cell) costs the normal 1. Flying/ethereal (`isFlying`, ether) skip the surcharge ("walls and crevices are nothing" — water too).
- Implement as a `moveCost(state, cell)` derived read (1 or 2) consumed at the one step-cost site; no second code path.

### Area 2 — TERR-01 pools (orchestrator decision from research, Option A)
- Depth-curved like `darkBlobs`/`darkRadius` in `engine/difficulty.js`: pool count from 1 at shallow depths easing to a low cap (planner picks; suggest 1 → 3 by depth 10, flat after), bounded flood-fill size 3–8 cells, only on `!wall && !feat` cells, never the spawn cell, never adjacent to the exit stairs; water is always passable so a floor can never become unsolvable. Drawn blue (`MAP_PALETTE.water`), with a distinct dark-water shade when fogged/remembered.
- Zero main-rng draws; the pool roll is the derived stream's only consumer.

### Area 3 — TERR-04/05 terrain phobias: **Arm Afraid for the next fight** (user-chosen)
- Afraid (`afraidNeed`/`afraidDamage`, Phase 31) exists only inside `state.combat`. A fresh terrain-phobia trigger: (1) narrates immediately on the rail with the trigger named (`phobiaTriggered { phobia, trigger }` — e.g. "Water. You knew this was coming."), (2) sets a zero-rng `c.fearArmed = { phobia, trigger }` flag that `fight()`'s existing Afraid trigger check reads as one more OR-condition, so the NEXT fight opens Afraid through the real mechanism; the flag clears when that fight ends or when the region is left without a fight (planner decides which; suggest: clears at `endCombat` or on leaving the region, whichever first). Never a lost action.
- Existing mechanics stay as-is and are NOT double-counted: `heightsPenalty`/`waterPenalty` still land on the climb/leap roll itself (a different roll from the Afraid to-hit); Being-trapped keeps its existing flat hp loss (`trappedPanic`) and gains only the fresh-entry debounce + narration.
- **Fresh entry = region model:** a small `c.phobiaState` map (`{ [phobia]: inRegion: bool }`) — a trigger fires when the condition becomes true from false; stays silent while it remains true; re-arms when it becomes false (left the water / left the dark / left the dead end / hp recovered above the re-arm line). Cleared on descend. Serialized field → comparables carve-out.
- Triggers:
  - **Bodies of water:** entering a water cell (region = contiguous water).
  - **Darkness:** entering an unlit square (`inDark`) — as well as the existing dark-combat trigger.
  - **Heights:** a climb/gorge tile attempt (fires on the attempt, before the roll; region = that tile).
  - **Being trapped:** a dead end (a cell with exactly one open neighbour), on entering it.
  - **Death:** **HP at or below 25% of max** (user-chosen), in or out of combat, fires once on crossing; re-arms only after HP climbs back above 50%.
  - The six combat-type phobias: unchanged (fire at `fight()` as today).

### Routine decisions (orchestrator)
- **TERR-03 darkness render filter:** a pure `mapViewRadius(state)` (or `visibleCells`) in `engine/derived.js` — `1` (3×3) when `inDark(state)` and no Night Vision / torch `lit` / Amulet of Light, otherwise the normal view; `draw()` consumes it as a render filter over `seen` cells; the engine's `seen`/`spellSeen` memory is untouched and Map the Floor's window keeps counting (the filter just hides). Leaving the dark square restores the full explored view.
- Bot: paths over water (cost-aware if cheap, otherwise just pays the 2), never stalls on a phobia; keep `docs/class-pass/` pins untouched.

### Claude's Discretion (planner)
- Exact pool curve numbers, the water palette shades, the rail lines per phobia (in voice), the `fearArmed` clear rule, the dead-end definition edge cases (corridor ends vs rooms).
- Plan split; suggested waves: (1) water generation on the derived stream + `cell.water` carve-out + palette + tolerant load + measured fixture declarations; (2) move cost 2 (Key Decision) + every per-square tick site + HUD counter + bot pathing; (3) phobia region model + `fearArmed` + triggers + narration; (4) shell: darkness 3×3 render filter, water painting, rail lines, `docs/TERRAIN.md` ledger + requirements map, whole-phase gate + aggregated Pixel 7 checklist.

</decisions>

<code_context>
## Existing Code Insights (from 41-RESEARCH.md, verified 2026-09-18)

- `engine/maze.js` `genFloor` draw order, cell shape (`wall`, `feat`, `seen`, `spellSeen`), `reveal()`; `engine/difficulty.js` `darkBlobs`/`darkRadius` depth curves (the pattern for pools).
- `engine/movement.js` step site: `state.steps++`, hunger tick, `if (c.timers) narrateTimerTransitions(state, tickSquares(c, 1), events)`, `c.darkFor` tick, the climb/gorge block with `heightsPenalty`/`waterPenalty`, `pendingHazard` (Phase 39), `trappedPanic` (dead-end hp loss, already per-tile debounced); a code comment already anticipates a per-cell move cost.
- `engine/combat.js` `fight()` Afraid trigger check (the six combat-type phobias + dark), `afraidNeed`/`afraidDamage` (Phase 31: penalty shrinks the need, never a lost action), `endCombat`.
- `engine/encounters.js` `fallDark`, `DARKNESS_DURATION`, `newPhobia` + the phobia table (Bodies of water, Darkness, Heights, Being trapped, Death, six combat types).
- `engine/derived.js` `inDark`, `conditionsOf`, `isFlying`; Phase 39 `itemEffectActive(c, "lit")`, Amulet of Light `eff(c, "light")`.
- Shell: `mazeworld.html` `draw()` `if (!c.seen) continue` loop, `src/browser/mapMarks.js` `MAP_PALETTE` (Phase 40 added `floorSpell`), HUD square counter in `viewModels.js`.
- Parity: `test/parity/harness/comparables.js` (`stripSpellSeen` precedent), `action-script.movement.json` (seed 256) compared per action — the one fixture most likely to step on water; determinism floor-gen draw-count pins.
- Bot: `tools/lib/tuning-bot.mjs` pathing (BFS over open cells).
- Tests: 2813 green at `05c9ff2`; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.

</code_context>

<specifics>
## Specific Ideas

- Rail lines in voice: water "Water. You knew this was coming. Your knees did too."; darkness "The dark. It was always going to be the dark."; heights "That is a long way down. Your stomach has already left."; trapped "Four walls and one door you already used."; death "You can hear your own pulse. It sounds unimpressed."
- Water step line (minor, narrative only): "Wading. Everything takes twice as long and smells worse."
- Ledger `docs/TERRAIN.md`: the two Key Decisions (water cost; arm-Afraid shape), the pool curve, the phobia trigger table, declared fixture divergences.

</specifics>

<deferred>
## Deferred Ideas

- Bot tactics around fear/water → Phase 42.
- Swimming items, water-breathing, drowning → not in v1.5.
- Lava/ice/other terrain → backlog.

</deferred>

---

*Phase: 41-terrain-darkness-phobias*
*Context gathered: 2026-09-18 via research + autonomous smart discuss (one batched question, three areas)*
