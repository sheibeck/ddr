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

(appended by Plan 02)

## Phobia triggers — Key Decision (Plan 03)

(appended by Plan 03)

## Darkness filter, map paint and UI (Plan 04)

(appended by Plan 04)

## Requirements map (Plan 04)

(appended by Plan 04)
