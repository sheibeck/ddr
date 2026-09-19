# Terrain, Darkness & Phobias (Phase 41 ledger)

**Phase:** 41-terrain-darkness-phobias
**Date:** 2026-09-18

This ledger declares Phase 41's terrain work: water pools on a derived rng
stream (TERR-01), the one-tap two-square water move cost (TERR-02), armed
Afraid phobia regions (TERR-04/05), and the 3x3 darkness render filter
(TERR-03). Four plans build this phase; Plan 01 (this document's author)
covers water generation. Plans 02-04 append their own sections below — this
file is never rewritten wholesale.

## Canon change

The frozen prototype (`test/parity/prototype-master.js.txt` — NEVER edited)
has no water terrain of any kind — no cell ever carries a water field, no
movement cost varies by tile. Water is a deliberate NEW rule for every run,
not a port of existing prototype behavior.

Per the user's 2026-09-17 greenfield ruling (quoted verbatim in
`41-CONTEXT.md`):

> "Water in `genFloor`" — the roadmap's original wording ("generated behind a
> new `state.terrainRoll` run flag, mirroring `storeRoll`, so every existing
> fixture, bot and old save generates identically") describes exactly the
> dual-path pattern the user forbade. Water is generated for **every** run —
> fixture, bot, and old save alike — with **no run flag**. The technique is a
> **derived rng stream** (`derivedRng(rng.getState(), "terrain", depth)`),
> read AFTER every existing `genFloor` draw, so the main seeded cursor never
> moves; the grid field (`cell.water`) is a structural harness carve-out
> exactly like Phase 40's `spellSeen`.

The roadmap's `state.terrainRoll` wording (ROADMAP.md's original Phase 41
goal text) is **superseded** by this ruling and must not be implemented
literally.

## Pool curve (Plan 01)

Five constants in `engine/difficulty.js`, mirroring the existing
`darkBlobs`/`darkRadius` depth-curve pattern:

| Constant | Value | Meaning |
|---|---|---|
| `WATER_POOL_MIN` | 1 | pool count on floor 1 and every breather floor |
| `WATER_POOL_CAP` | 3 | pool count ceiling |
| `WATER_POOL_GROWTH_EVERY` | 4 | depths per +1 pool (capped at `WATER_POOL_CAP`) |
| `WATER_POOL_SIZE_MIN` | 3 | a pool's minimum cell count |
| `WATER_POOL_SIZE_MAX` | 8 | a pool's maximum cell count |

`difficultyCurve(depth).waterPools` = `WATER_POOL_MIN` on a breather floor,
else `min(WATER_POOL_MIN + floor((depth-1) / WATER_POOL_GROWTH_EVERY), WATER_POOL_CAP)`.
Consumes zero rng — a pure lookup on `depth`, exactly like every other knob
in this module.

The real breather cadence (`engine/difficulty.js#isBreather`,
`BREATHER_EVERY = 5`) puts the first breather at depth **6** (then 11, 16,
21, ...) — not at depth 5/10/15/20. The measured table (live, not hand-typed
— `test/unit/terrain.test.js`'s own pin):

| Depth | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12-15 | 16 | 17-20 | 21 | 50 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `waterPools` | 1 | 1 | 1 | 1 | 2 | 1 | 2 | 2 | 3 | 3 | 1 | 3 | 1 | 3 | 1 | 3 |

(6, 11, 16, 21, ... are breathers → 1; every other depth eases from 1 toward
the 3 cap.)

**Eligibility rules** — a cell `(x, y)` is eligible for water iff:
- `!g[y][x].wall` (open)
- `!g[y][x].feat` (no feature — dot/tele/chest/trap/climb/gorge/exit/one-way door)
- `dist[y][x] > 4` from spawn (the SAME `far`-list threshold `genFloor`'s own
  feature scatter already uses — the spawn cell and its first corridor are
  never wet)
- not already water
- not orthogonally adjacent to the exit tile (Manhattan distance exactly 1;
  diagonal neighbours are fine)

Water is always passable (never blocks a path), so no placement here can
ever make a floor unsolvable — the only design axis is "detour vs. slog".

**Placement algorithm (`engine/maze.js#placeWater`)** — per pool: re-scan the
eligible list (row-major, excluding already-water cells), pick a seed cell,
draw a target size in `[WATER_POOL_SIZE_MIN, WATER_POOL_SIZE_MAX]`, mark the
seed water, then grow via a discovery-order-deduplicated frontier of
eligible orthogonal neighbours until the target size is reached or the
frontier is exhausted (a pool can legitimately end up smaller than its
target — this is the design, not a bug).

**Draw order on the derived stream:** `rng.pick(seeds)` (seed), `rng.d(...)`
(size), then `rng.pick(frontier)` once per growth step. Proven by
`test/unit/terrain.test.js`'s scripted-rng test against a hand-built
corridor grid.

**The key:** `genFloor` calls `placeWater(g, dc.depth, derivedRng(rng.getState(), "terrain", dc.depth))`
as the LAST pass, after every existing draw (backtracker, loop-carving,
feature scatter, dark blobs, one-way doors) — so the derived key is read
from the main rng's cursor AFTER it has already advanced past every existing
draw, and `placeWater` itself never touches the main rng at all (it only
ever sees the derived stream instance as its `rng` parameter). Zero main-rng
draws — proven byte-for-byte by `test/unit/floor-gen-rng-pin.test.js`'s
98-entry (seed, depth) pin, measured at HEAD before this plan's first engine
edit and unchanged since.

## Declared divergences (Plan 01)

Zero fixture moves this plan. `cell.water` is a structural carve-out
(`stripWaterField`, wired into all three exported `*Comparable()` functions
plus the three per-domain local `comparable()` duplicates in
movement/combat/magic-parity.test.js) — the field is compared NOWHERE on
ANY fixture. The live fixture-roster scan (`tools/terrain-fixture-scan.mjs`)
measured `WATER HITS: 0` for `action-script.movement.json` (seed 256, its
101-action scripted path) — no fixture ever steps onto a water cell, so
Plan 02 (the move cost) declares nothing new for this fixture either. Full
measurement recorded in `test/parity/FIXTURE-INVENTORY.md`'s "Phase 41:
water terrain" section.

## Water cost — Key Decision (Plan 02)

**"One tap, two squares of time"** (user-chosen, ratified — `41-CONTEXT.md`
Area 1, 2026-09-18):

> A single `move` onto a water cell advances `state.steps` by 2 and runs
> every per-square system twice: `tickSquares(c, 2)` (item/spell/ability/
> torch timers, the Map the Floor window), hunger, `c.darkFor`, the
> encounter clock, member timers — one dispatch, no partial-move state. The
> HUD square counter jumps by 2. Leaving water (stepping onto a dry cell)
> costs the normal 1. Flying/ethereal (`isFlying`, ether) skip the surcharge
> ("walls and crevices are nothing" — water too).

### Mechanism

- `engine/derived.js#moveCost(state, cell)` — a pure derived read: `1` for a
  normal/missing cell, `WATER_MOVE_COST` (`2`) for `cell.water === true`,
  with the flight/ether exemption below. The ONE step-cost site
  (`engine/movement.js#move`) computes it once, before `f.px = nx`.
- `state.steps += cost` (not `state.steps++`), and a local `crossings(n) =
  Math.floor(state.steps / n) - Math.floor(stepsBefore / n)` cadence helper
  — for `cost === 1` this is algebraically identical to the old `state.steps
  % n === 0` test (0 or 1, since a +1 step crosses at most one boundary), so
  every dry step stays byte-identical to before this plan. For `cost === 2`
  a crossed boundary fires exactly once and is never skipped (`99 -> 101`
  still rolls the day; `19 -> 21` still recovers a spell charge / heals a
  cloak tick).
- `tickSquares(c, cost)` — called ONCE per step, `n = cost` (research
  Pitfall 3: never call it twice to "double" a tick — `n` already carries
  the full cost).
- `waded { cost }` — pushed ONLY on genuine entry (`cost > 1 && !here.water`,
  where `here` is the departure cell) — one line per wade, not per step, so
  crossing an 8-cell pool never stacks eight toasts. The HUD counter still
  carries the per-step cost regardless of whether the narration fires.

### Exemption table

| Carrier state | Cost on water |
|---|---|
| A LIVE `fly` item effect (a started Cloak of Flying OR Bracelet of Flight window) | 1 |
| A LIVE `ether` item effect (a started Cloak of Ether window) | 1 |
| A READY-but-unstarted Cloak of Flying / Bracelet of Flight (no live record) | 2 — **not spent on a puddle.** 260918-w4n (use-activated-only, user ruling 2026-09-18): the old auto-activation (`flyOver()` starting a fresh Cloak-of-Flying window the instant a Cloak-only character reached a wall/crevice) and the Bracelet's old unconditional-flight special case are BOTH retired — only `useItem` on a WORN flight item ever starts a record. A water step never calls `startEffect` either way; the item's charge is a wall/crevice resource, not a puddle one. |

### Per-square systems this cost widens (one dispatch)

| System | Site |
|---|---|
| HUD SQUARES counter | `state.steps` itself |
| Affliction cadence | a `crossings(af.per)`-counted loop over the existing tick body, stopping the instant the affliction clears inside it (a `per:1` affliction ticks TWICE on one 2-cost water step) |
| `c.darkFor` | `Math.max(0, c.darkFor - cost)`, same clamp-at-0-with-one-event discipline |
| `c.timers` (ability/item/spell-reveal timers) | `tickSquares(c, cost)`, once |
| Magic User spell-charge recovery (20-square) | `crossings(20) > 0` |
| `newDay` (100-square, "once-a-day") | `crossings(100) > 0` |

**CONTEXT-vs-code correction:** `41-CONTEXT.md`'s own Area 1 wording lists
"the encounter clock" and "member timers" as per-square systems this cost
should widen. Verified against the live engine: neither has a separate
per-square counterpart. The wandering-monster check is entirely `newDay`'s
own roll (already covered by `crossings(100)`, not a second site), and party
members carry no squares-cadence state of their own (`state.party` sheets
have no `timers`/cadence fields the exploration step tick reads). The table
above is therefore the complete set — nothing was left unwired.

### Declared divergence

**Measured zero.** `tools/terrain-fixture-scan.mjs`, re-run after this
plan's engine edits landed, still reports `WATER HITS: 0` —
`action-script.movement.json` (seed 256) never steps onto a water cell, so
no `action-path` divergence record exists on it. Full measurement in
`test/parity/FIXTURE-INVENTORY.md`'s "Plan 02 — the move cost: measured,
zero fixture moves" subsection.

### Phase 42 note

Water's time cost (2 squares per wade instead of 1) shifts the hunger/depth
curve — rations burn faster, torches/timers expire sooner, days roll over
sooner — on any run whose path crosses a pool. This is expected, not a bug;
Phase 42 (the next tuning pass) measures the drift against the v1.5 BEFORE
pin (`docs/class-pass/v15-before*.json`) rather than this plan re-tuning any
dial blind.

## Phobia triggers — Key Decision (Plan 03)

**"Arm Afraid for the next fight"** (user-chosen, ratified — `41-CONTEXT.md`
Area 3, 2026-09-18):

> A fresh terrain-phobia trigger: (1) narrates immediately on the rail with
> the trigger named (`phobiaTriggered { phobia, trigger }` — e.g. "Water.
> You knew this was coming."), (2) sets a zero-rng `c.fearArmed = { phobia,
> trigger }` flag that `fight()`'s existing Afraid trigger check reads as
> one more OR-condition, so the NEXT fight opens Afraid through the real
> mechanism; the flag clears when that fight ends [planner ruling: clears at
> `fight()` itself, consumed whether or not Hardiness shrugs it off — not on
> leaving the region, not at `endCombat`/`descend`]. Never a lost action.
> Existing mechanics stay as-is and are NOT double-counted:
> `heightsPenalty`/`waterPenalty` still land on the climb/leap roll itself;
> Being-trapped keeps its existing flat hp loss (`trappedPanic`) and gains
> only the fresh-entry debounce + narration.

**CONTEXT clarification (planner interpretation, binding for this plan):**
ALL FIVE terrain phobias arm Afraid for the next fight (TERR-05's literal
text) — "Being-trapped keeps its existing flat hp loss and gains only the
fresh-entry debounce + narration" means the hp loss is retained and NOT
replaced; the arm applies to it like the other four.

### Trigger table

| Phobia | Trigger key | Region model | Re-arm rule | Existing mechanic kept |
|---|---|---|---|---|
| Bodies of water | `water` | `cell.water === true` at the hero's tile | leaving the water cell | none (no prior standalone mechanic) |
| Darkness | `dark` | `inDark(state)` (tile `.dark` OR `c.darkFor > 0`) | leaving dark (`inDark` false) | none (`heightsFear`/`waterFear` are Heights/Water only) |
| Heights | `heights` | a tile-key string on the ATTEMPTED climb/gorge tile | more than 1 square (Manhattan) from that tile | `heightsPenalty` still lands on the climb roll itself |
| Being trapped | `deadEnd` | `isDeadEnd(f, px, py)` (<=1 open orthogonal neighbour) | leaving the dead end | `trappedPanic`'s flat hp loss (its own per-tile debounce, unchanged) |
| Death | `nearDeath` | hp <= 25% of maxWP (`DEATH_PANIC_THRESHOLD`) | hp climbs back ABOVE 50% (`DEATH_REARM_FRACTION`) | `fight()`'s existing `nearDeathPanic` start-of-combat check, unaffected |

### `fearArmed` lifecycle

- **Set** by `armFear(state, trigger, events)` (engine/phobias.js) — the ONE
  push site for `{ type: "phobiaTriggered", phobia, trigger }` in the whole
  engine.
- **Read + consumed** at `engine/combat.js#fight()`, BEFORE the trigger
  check: `armed = fearArmed && fearArmed.phobia === c.phobia`, then
  `delete c.fearArmed` unconditionally (spent whether or not Hardiness then
  shrugs off the resulting Afraid effect, and even when the arm is STALE —
  a `newPhobia` reroll between the trigger and the fight drops a now-
  mismatched arm here too, via the same phobia-match guard).
- **Survives** `endCombat` and `descend()` — deliberately, so a Death
  crossing mid-fight (or a wade with no fight on that floor) still lands on
  the NEXT fight, not just the current floor.
- **Additive event shape:** `phobiaAfraid` gains a `trigger` key ONLY when
  armed (`{ ...(armedTrigger ? { trigger: armedTrigger } : {}) }`) — the
  pre-Phase-41 shape (`{ type, rounds }`) is byte-identical for every
  non-armed trigger (every parity fixture).
- Hardiness's existing `rng.d(2)` shrug-off check is UNCHANGED — still drawn
  only when some OR-condition (now four instead of three) is already true.

### The Heights tile-key model and the one-square leave rule

Heights is the one phobia whose region is not a plain boolean: `noteHeights
Attempt(state, x, y, events)` (called from the climb/gorge roll branch,
BEFORE the roll, for every attempt regardless of phobia) stores
`c.phobiaState.Heights = "x,y"` (via `tileKey`) on a FRESH tile only — a
retry of the identical tile is silent. `checkTerrainPhobias`'s own Heights
branch runs ONLY the leave-check: once the hero's current position is more
than 1 square (Manhattan distance) from the stored tile, the key flips to
`false`, so a later attempt (even at the SAME tile) fires again. The
`hazardChoice` pending pre-check (a carried rope/ladder) never reaches
`noteHeightsAttempt` — only the declined ("CLIMB IT"/"LEAP IT") retry does;
the flyOver/ether/tool branches never reach it either (all three are
alternate branches inside the SAME climb/gorge block, exclusive of the roll
branch `noteHeightsAttempt` sits in).

### The dead-end definition

`isDeadEnd(f, x, y)` (moved verbatim from `engine/movement.js` into
`engine/phobias.js` — `trappedPanic`'s own entry check now imports it from
there too): a cell with AT MOST one non-wall orthogonal neighbour. Unchanged
from the 04.1-06 PHOBIA-01 definition; `trappedPanic`'s existing per-TILE
debounce (`there.trapPanicked`) is completely independent of the region
model's per-CHARACTER `c.phobiaState["Being trapped"]` toggle — the two can
diverge (trappedPanic silent on a re-entry into the SAME dead end;
phobiaTriggered fires again, since leaving the tile already reset the
region).

### The Death hysteresis

`checkDeathPhobia(state, events)` — called both from `checkTerrainPhobias`
(the movement/teleport fresh-entry site) and directly from
`engine/combat.js#foeTurn`'s tail (after the allies ability-cooldown loop,
before `return events`) — is the in-combat half of the same trigger: a
foe's blows can cross the 25%/50% lines mid-fight, not just at `fight()`'s
own start-of-combat `nearDeathPanic` check. `was`/`enter`/`stay` compute the
hysteresis: enters at/below 25% of maxWP, stays armed until hp climbs back
ABOVE 50% — a deliberately wide band so a hero hovering near 25% does not
re-trigger on every single hp tick. Zero rng draws either way.

### Harness/tolerant-load rules

`c.phobiaState`/`c.fearArmed` are a STRUCTURAL parity carve-out
(`stripPhobiaFields`, `test/parity/harness/comparables.js`), the same
category as `stripTimersField`/`stripWornField`/`stripAbilitiesField` — no
fixture hero with a terrain phobia ever has a `move` action in its script
(measured: `TERRAIN TRIGGER EXPOSURE: 0`, `tools/terrain-fixture-scan.mjs`;
full table in `test/parity/FIXTURE-INVENTORY.md`'s Plan 03 section), so this
is a tripwire for a future phobia-driving fixture, not a declared, measured
divergence. `engine/saveState.js#sanitizePhobiaFields` mirrors
`clearStaleTimers`/`sanitizeWorn`'s exact discipline: a present-but-tampered
value is neutralised (a non-object `phobiaState` deleted outright; a
non-boolean/non-string entry inside a genuine map dropped; a `fearArmed`
missing a string `phobia`/`trigger` deleted), absent is NEVER injected —
wired into both `validateSave` and `rehydrate`'s `migratedC` chains, right
after `clearFoeEffect`.

### "Never a lost action"

Every trigger in this plan (including the Death crossing mid-fight) only
ever ARMS a flag or narrates — nothing here refuses an action, matching the
Phase 31 ruling (user, 2026-09-16: "Phobia should be penalties, never a no
actions state"). See `test/unit/afraid.test.js` (iv)'s action list (strike/
cast/drink/read/use/flee/parley/sing, all never refused for fear) — this
plan's own tests re-prove the same guarantee for an armed-then-fought
character (`test/unit/phobia-triggers.test.js`).

## Darkness filter, map paint and UI (Plan 04)

### The darkness render filter (TERR-03)

`engine/derived.js#mapViewRadius(state)` / `#inViewWindow(state, x, y)` — a
PURE render-time filter, never a mutation of `cell.seen`/`cell.spellSeen`:

- `mapViewRadius(state)` returns `Infinity` (show every already-`seen` cell)
  UNLESS the player is currently `inDark(state)` (a `.dark` tile, or
  `c.darkFor > 0` — the persistent-darkness counter) AND carries none of the
  established waivers, in which case it returns `DARK_VIEW_RADIUS` (`1` — a
  3x3 window).
- **The waiver set is the SAME one every other darkness consumer in this
  codebase already uses** — "a light effect" means one thing everywhere:
  Night Vision (`skill(c, "Night Vision")`, `revealRadius`'s own waiver),
  a live Amulet of Light (`eff(c, "light") > 0`, the exact same read
  `engine/movement.js`'s `darkFor`-dispel check uses), or a lit torch
  (`itemEffectActive(c, "lit")`, the Torch's `ACTIVATION_OF.Torch = { kind:
  "lit", effect: 40 }` record).
- `inViewWindow(state, x, y)` is `true` for every cell when the radius is
  `Infinity`; when it is `1`, `true` only for the 3x3 cells around the
  party (Chebyshev distance <= 1 from `state.floor.px/py`) — `false` for
  every other cell, **including a cell already `seen`** (the window hides
  previously-explored cells too, not just gates new reveals).

**Why a render filter, not a `seen` mutation:** the Phase 40 orthogonality
note (SPELLS.md's "Phase 41 note") is honoured exactly — Map the Floor's
`spell:reveal` window keeps counting its own squares-cadence countdown
under this filter; the filter only HIDES what's already explored, it never
pauses or resets any other system. `draw()` re-reads `mapViewRadius`/
`inViewWindow` fresh on EVERY paint (research Pitfall 4: never a stored
flag) — so leaving the dark square restores the FULL explored view for
free, because nothing was ever taken away from `seen` in the first place.

**Shell wiring:** `window.__mzMapView = { mapViewRadius, inViewWindow }` —
the same read-only bridge pattern as `window.__mzConditionsOf`. `draw()`
builds `const visible = (x, y) => !view || view.inViewWindow(S, x, y);`
(fail-open on a missing bridge, matching the fallback-palette discipline)
and gates BOTH the floor-fill loop (after `if (!c.seen) continue;`) and the
feature-icon pass (after `if (!c.seen || !c.feat) continue;`) on it. The
party marker, glow and `positionCanvas()` are untouched — the party is
always inside its own window.

### The water palette (TERR-01)

`src/browser/mapMarks.js#MAP_PALETTE` gains two hexes: `water: "#2f5f7a"`
(a lit pool) and `waterDark: "#1f3a4a"` (a pool on a `.dark` tile) — both
distinct from every other palette key, frozen alongside the rest. `draw()`'s
existing Phase 40 fill line (`ctx.fillStyle = c.spellSeen ? P.floorSpell :
(c.dark ? P.floorDark : P.floor);`) stays BYTE-IDENTICAL (the
`test/unit/shell-spells-40.test.js` pin still matches); a water OVERRIDE
line follows it: `if (c.water && !c.spellSeen) ctx.fillStyle = c.dark ?
P.waterDark : P.water;` — the spellSeen "borrowed sight" tint keeps
priority over either water shade, since it IS the "this will re-fog"
signal (unchanged from Phase 40).

### The water hold-inspect (TERR-01/02)

`src/browser/rail.js#RAIL_COPY.water = { title: "WATER", line: "Two
squares a step, and your boots never dry. Wade, or go around." }`.
`src/browser/tapStep.js#inspectCell` reads it AFTER the `cell.feat` branch
(a water cell that somehow also carries a feature keeps the feature's own
legend row) and BEFORE the EMPTY CORRIDOR fallback — so a seen, non-wall,
feat-less water cell names itself and its cost on a hold; an unseen water
cell still returns UNWALKED (fog never reveals water).

### The Rattled chip (TERR-05)

`c.fearArmed` (Plan 03's region model) already emits a `fearArmed` chip via
`conditionsOf` — this plan adds its shell copy row, mirroring the flat
`foresight`/"Forewarned" precedent (no count, the generic detail branch
renders nothing extra):

- `CONDITION_COPY.fearArmed = { label: "Rattled" }`
- `CONDITION_TONE.fearArmed = "warn"`
- `CONDITION_EXPLAIN.fearArmed = "Something out there got to you. The next
  fight opens Afraid — harder to hit, softer blows — until it passes."`

The chip shows between the trigger moment and the next fight; it vanishes
the instant `fight()` consumes `c.fearArmed` (Plan 03), at which point the
in-fight `afraid` chip takes over instead.

### What stays for the cleanup milestone

The shell's own legacy classic `move()`/`reveal()` function bodies
(mazeworld.html) are DEAD CODE — superseded by `engine/movement.js`'s real
`move()`/`reveal()` long before this phase — and are explicitly NOT touched
by this plan (`test/unit/shell-terrain-41.test.js` pins that neither body
references `mapViewRadius` nor `moveCost`). They remain owned by the
pending "Shell Debt & Dead Code" cleanup milestone (STATE.md Pending
Todos), not this phase.

## Requirements map (Plan 04)

| Requirement | Landed in | Proof |
|---|---|---|
| TERR-01 (water pools, blue on the map) | Plan 01 (generation) + Plan 04 (map paint + hold-inspect) | `test/unit/terrain.test.js`; `test/unit/floor-gen-rng-pin.test.js`; `test/unit/mapMarks.test.js`; `test/unit/tapStep.test.js`; `test/unit/shell-terrain-41.test.js` |
| TERR-02 (2-square water move cost, HUD/timers reflect it) | Plan 02 | `test/unit/water-cost.test.js`; `test/unit/tuning-bot.test.js` |
| TERR-03 (the 3x3 darkness render filter) | Plan 04 | `test/unit/darkness-filter.test.js`; `test/unit/shell-terrain-41.test.js`; the parity suite (zero new serialized field — a pure derived read) |
| TERR-04 (every phobia has a real trigger) | Plan 03 | `test/unit/phobia-triggers.test.js` |
| TERR-05 (fresh-entry-only, arms Afraid, trigger named in the rail) | Plan 03 (engine) + Plan 04 (the Rattled chip's shell copy) | `test/unit/phobia-triggers.test.js`; `test/unit/conditions.test.js`; `test/unit/shell-terrain-41.test.js` |

## Out of scope / next

- **Phase 42** owns bot tactics around water/fear (the tuning bot already
  paths across water and never stalls on a phobia — Plan 02/03 — but no
  water-cost-aware routing preference or phobia-avoidance heuristic exists
  yet) and the AFTER matrix re-measurement against
  `docs/class-pass/v15-before*.json` (water's 2-square cost is expected to
  shift the hunger/depth curve — measured there, not retuned here).
- **Swimming/drowning rules, water-breathing items** — deferred, not in
  v1.5 (`41-CONTEXT.md`'s Deferred Ideas).
- **New terrain kinds beyond water (lava, ice, etc.)** — backlog.
- **The tutorial** — out of scope for this phase; a future onboarding pass
  should mention water's cost and the darkness window once they exist to
  explain.
