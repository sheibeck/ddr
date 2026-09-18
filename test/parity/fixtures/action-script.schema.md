# Action-Script Fixture Format

Fixtures under `test/parity/fixtures/*.json` are the seeded, hand-authored (or
seeded-generated) scripts the prototype-parity harness replays through both
the frozen prototype (`test/parity/prototype-master.js.txt`, via
`test/parity/harness/sandboxPrototype.js`) and, once it exists, the extracted
engine (`engine/applyAction`). Both sides see the exact same seed and the
exact same ordered action list, so any divergence in resulting state (per
`test/parity/harness/diffState.js`) is a regression signal.

## Shape

```json
{
  "seed": 20260907,
  "actions": [
    { "type": "move", "dir": "N" },
    { "type": "attack" }
  ]
}
```

- `seed` (integer, required) — passed to `loadPrototypeSandbox({ seed })` on
  the prototype side and to the engine's `newRun(seed)`/equivalent on the
  engine side. Both sides must start from the identical seed for a fixture
  to be meaningful.
- `actions` (array, required) — an ordered list of action objects, replayed
  in order. Each action's own fields depend on `type` (see vocabulary below).
  An empty `actions` array is valid (a fixture that only exercises chargen +
  boot).
- `divergences` (object, optional; Phase 23, FID-06) — a top-level map, keyed
  by seed (as a string), for a SEED-SET fixture (e.g.
  `action-script.chargen.json`) whose per-seed result was DELIBERATELY
  changed by a documented rules change. Each record is
  `{ phase, requirements, fields, before, after, rationale }`:
  `fields` names the exact top-level character/state fields that diverge
  (e.g. `["grimoire"]`); `before`/`after` carry ONLY those fields, taken
  verbatim from `loadPrototypeSandbox({seed}).S.c`/`newRun(seed).c`, never
  hand-typed; `rationale` is a one-paragraph explanation naming the
  requirement(s) that justify the change. The harness asserts
  `prototype === before` and `engine === after` for each named field BEFORE
  stripping them from both sides ahead of `diffState` — so a divergence
  record is a stronger check than a blanket carve-out, not a weaker one. A
  seed with no record in `divergences` is compared byte-identically with NO
  strip.
- `divergence` (object, optional) — the same shape as one entry of
  `divergences` above, but attached directly to a single SCENARIO object
  (used by scenario-based fixtures, e.g. `action-script.magic.json`, where
  fixtures are keyed by scenario name rather than by seed).
- `divergence` with `kind: "action-path"` (object, optional; Phase 24, FID-07)
  — a second, generic `divergence` shape for a divergence whose consequence
  is a CHANGED ACTION PATH (a flipped combat outcome, an unaffordable
  purchase) rather than a field that simply differs at the end while the
  action-by-action byte diff still holds throughout. This is the one case
  Phase 23's field-strip records (`divergences`/`divergence` above) cannot
  express, because the per-action byte diff itself would fail partway through
  the scenario — before any end-of-scenario field comparison is ever reached.
  It may sit on a scenario object (e.g. a combat fixture's scenario) OR on a
  script fixture's own top level (e.g. the economy fixture, which is keyed by
  a single `seed`/`actions` pair, not by scenario). Fields:
  - `kind` (required) — the literal string `"action-path"`. A record without
    this field (every Phase 23 record) is NOT an action-path record — the
    two kinds are mutually exclusive on any one holder.
  - `phase`, `requirements`, `rationale` — same meaning as the Phase 23
    record shape above.
  - `fromAction` (integer, required) — the 0-based index into `actions` from
    which the per-action byte diff is declared off (inclusive); every action
    before this index is still compared byte-for-byte as normal.
  - `fields` (array of strings, required, non-empty) — the `state.c`-level
    field names pinned at the end of the scenario, taken verbatim from both
    sides, never hand-typed.
  - `before` / `after` — objects carrying ONLY the keys named in `fields`:
    the prototype's measured end-of-scenario values (`before`) and the
    engine's (`after`).
  - `stateFields` (array of strings, optional) — additional TOP-LEVEL state
    field names to pin alongside `fields` (e.g. `"dead"`), for a divergence
    whose consequence reaches outside `state.c`.
  - `stateBefore` / `stateAfter` (optional) — the same shape as `before`/
    `after`, but for the keys named in `stateFields`.
  - `stockCostMul` (number, optional; economy fixtures only) — the exact
    store-roll price-multiplier relation checked at the `openStore` action:
    every `PRICEFOR_ROUTED_EFFECTS` line's engine cost must equal
    `Math.max(1, Math.round(prototypeCost * stockCostMul))`, every other
    line's cost must be unchanged, and the store roll itself (names, order,
    subs) must be byte-identical — see `stockMarkupDiff` in
    `test/parity/harness/comparables.js`. Superseded by `stockNames`/
    `stockAfter` below whenever the CONTENT prices themselves diverge from
    the prototype (a flat multiplier off the prototype's own frozen cost no
    longer describes the engine's line prices in that case) — a record
    carries one or the other, never both.
  - `stockNames` (array of strings, optional; economy fixtures only; Phase
    39, GEAR-01) — the store roll's IDENTITY at the `openStore` action: the
    stock's `n` values, in order, after both sides are run through
    `stripStoreClosures` (Rations dropped, `wp`→`hp` normalized) — proves the
    roll itself (which items, what order, which subs) is still byte-identical
    to the prototype even when the line COSTS have moved.
  - `stockAfter` (array of `[name, cost]` pairs, optional; economy fixtures
    only; Phase 39, GEAR-01) — a direct snapshot of the ENGINE's own raw
    stock at the `openStore` action (including the engine-only Rations
    line), pinning the actual re-priced numbers so a content-table typo
    fails the suite instead of passing silently. See `declaredStockDiffs` in
    `test/parity/harness/comparables.js` — it checks `stockNames` against
    BOTH sides and `stockAfter` against the engine alone; a caller asserts
    both results are `null`.

  The harness helpers for this record kind live in
  `test/parity/harness/comparables.js`: `actionPathDivergenceOf(holder)` looks
  up the record (returning `null` for a holder with no `divergence` or a
  Phase-23-shaped one lacking `kind`); `skipsByteDiffAt(divergence, i)` tells a
  replay loop whether to skip the per-action byte diff at index `i`;
  `declaredEndDiffs(protoState, engineState, divergence)` machine-checks both
  sides' end-of-scenario state against the declared `before`/`after` (and
  `stateBefore`/`stateAfter`) — a caller asserts both results are `null`
  BEFORE relying on the record at all, exactly like the Phase 23 record
  shape's own before/after assertions. It is declared, measured, and
  asserted — never a blanket skip, and never a substitute for comparing every
  action before `fromAction` byte-for-byte as normal.
- `chargenDivergence` (object, optional; Phase 38, ABIL-02) — the scenario-
  scoped/script-top-level analog of `divergences` above, for a combat/magic/
  economy/encounters/movement fixture whose HERO's CHARGEN-TIME `c.skills`
  the Special Skills table reshape moved (a table-active key left `c.skills`
  for `c.abilities`). Same record shape as a `divergences` entry
  (`{ phase, requirements, fields, before, after, rationale }`), attached
  directly to a scenario object (e.g. a combat/magic/encounters scenario) OR
  a script fixture's own top level (e.g. the economy/movement fixtures,
  keyed by a single `seed`, not by scenario). It is a SEPARATE key from
  `divergence` — the two record kinds are never combined on one holder; a
  `chargenDivergence` declares a field that diverges from the moment the
  hero is rolled (before any action runs), while `divergence`/`divergence
  {kind:"action-path"}` declare a field/action-path that diverges as a
  CONSEQUENCE of the scenario's actions. The harness helpers live beside the
  Phase 23/24 ones in `test/parity/harness/comparables.js`:
  `chargenShiftOf(holder)` looks up the record (`holder?.chargenDivergence
  ?? null`); `stripChargenShift(state, record)` strips the declared fields
  from `state.c` (reusing `stripScenarioDivergence`'s mechanism); and
  `chargenShiftDiffs(protoC, engineC, record)` machine-checks BOTH
  already-rolled characters against the record's `before`/`after` — a caller
  asserts both results are `null` BEFORE stripping, exactly like every other
  divergence record kind. Applied at the fixture's initial-boot comparison,
  wrapping the scenario's own `divergence`/`scenario.divergence` handling
  OUTERMOST (a `chargenDivergence`'s field diverges from boot onward, so its
  strip must survive every later per-action byte diff too).
- **The rule:** a `divergences`/`divergence`/`chargenDivergence` record is the ONLY sanctioned
  way to keep a deliberately-changed fixture result in the parity suite.
  `test/parity/prototype-master.js.txt` (the frozen golden master) is NEVER
  edited, and a fixture's `seeds`/`actions`/`scenarios` are NEVER trimmed or
  rewritten just to dodge a diff — every changed result must be declared,
  measured, and asserted before it is stripped.

## Reserved `type` Vocabulary

This is the closed set of action types later slices (01-05 through 01-10)
will populate fixtures against, mirroring the prototype's actual player
inputs (`move()`, `act(playerStrike)`, `act(drinkPotion)`, etc.):

| `type` | Prototype call it mirrors | Notes |
|--------|---------------------------|-------|
| `move` | `move(dir)` | requires `dir`: one of `"N"`, `"S"`, `"E"`, `"W"` |
| `startCombat` | `startCombat(wandering, forced)` | **not** in engine/actions.js's validated `ACTION_TYPES` — an internal function other rule domains call (movement's wandering-monster check, the encounters domain's dot tile), not a player action. A fixture that needs a deterministic encounter (01-08's combat fixture) uses this to force one; the harness special-cases it (clone/rng-rehydrate/persist by hand, the same shape `applyAction` uses, since there's no `applyAction(state, {type:"startCombat"})` to call). Requires `wandering` (bool) and `forced` (an `ENC_TYPES` string, or `null` to let the rng pick). |
| `attack` | `act(playerStrike)` | player's strike in combat |
| `castSpell` | `act(castSpell)` (Magic User) | requires `idx`: the spell's index into `content/spells.js`'s `SPELLS` array (matches `engine/actions.js`'s `castSpell.idx` validation) |
| `drinkPotion` | `act(drinkPotion)` | |
| `flee` | `act(flee)` | |
| `parley` | `act(parley)` | requires `canParley()` to be true in current state |
| `sing` | `act(sing)` | requires `songReady()` |
| `readScroll` | `act(readScroll)` | requires `S.c.scrolls && canRead()` |
| `buyItem` | `buyFrom(state, idx)` | requires `idx`: the index into `state.store.stock`; requires a store to be open |
| `leaveStore` | `leaveStore()` | closes the open store |
| `useItem` | `act(() => useItem(i))` | requires an item index field |
| `camp` | `makeCamp()` | rests, consumes rations |
| `newGame` | `newGame()` | starts a fresh run mid-script (rare; mostly a script's implicit first step) |
| `openStore` | `openStore()` | **not** in engine/actions.js's validated `ACTION_TYPES` — an internal function, like `startCombat` below, that a fixture calls directly to force a deterministic store visit without needing to walk onto a "Store"-rolling dot tile first. Added in 01-10 (`action-script.economy.json`). |
| `springTrap` | `springTrap()` | **not** a validated action — an internal function call, like `openStore` above, forcing a deterministic trap without walking onto a "trap" tile. Added in 01-10 (`action-script.encounters.json`). |
| `openChest` | `openChest()` | **not** a validated action — an internal function call forcing a deterministic chest without walking onto a "chest" tile. Added in 01-10 (`action-script.encounters.json`). |
| `encounterDot` | `encounterDot()` | **not** a validated action — an internal function call forcing a deterministic encounter-dot resolution without walking onto a "dot" tile (the specific outcome — Faerie/Disease/a Table Four row/etc. — is entirely a function of the seed). Added in 01-10 (`action-script.encounters.json`). |
| `descend` | `descend()` | **not** a validated action — an internal function call that advances straight to the next floor without needing a walked path to an "exit" tile first. Added in 01-10; was used by `action-script.win.json` to skip quickly to floor 5 before BFS-walking the last leg to the Gate, but that fixture was DELIBERATELY RETIRED in 03-02 (endless descent — the frozen prototype still wins at the floor-5 Gate, but genFloor never emits "gate" anymore). `descend` is still used directly by economy/encounters round-trip scenarios. |

Additional fields per action `type` (e.g. `dir` for `move`) are added by the
plan that first authors a fixture exercising that action, and should be
documented here at that time rather than speculatively defined now (per
01-RESEARCH.md Open Question 2: build fixtures incrementally, matching the
locked extraction order).

## Comparison Rules

- **State is asserted strictly.** After every action, `diffState(prototypeState, engineState)`
  (or the round-trip equivalent) must return `null` once both sides' state is
  passed through `stripVolatileFields` — this is the actual ENG-02/ENG-04/
  ENG-05 determinism/parity guarantee.
- **Events are asserted loosely, for now.** Only the sequence of event
  `type`s needs to match, not full field-by-field equality — the event
  schema is new surface area (the prototype never had structured events, only
  raw HTML `say()`/`evt()` calls) and is expected to evolve as Phase 4/5
  presentation consumers stabilize (01-RESEARCH.md Open Question 1).
- Volatile wall-clock fields (`deathAt`, graveyard `when`) are stripped
  before every comparison via `stripVolatileFields` — never compared, on
  either side (see `diffState.js`'s header comment for the full rationale).

See `README.md` in this directory for how to add a new fixture.
