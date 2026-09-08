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

## Reserved `type` Vocabulary

This is the closed set of action types later slices (01-05 through 01-10)
will populate fixtures against, mirroring the prototype's actual player
inputs (`move()`, `act(playerStrike)`, `act(drinkPotion)`, etc.):

| `type` | Prototype call it mirrors | Notes |
|--------|---------------------------|-------|
| `move` | `move(dir)` | requires `dir`: one of `"N"`, `"S"`, `"E"`, `"W"` |
| `attack` | `act(playerStrike)` | player's strike in combat |
| `castSpell` | `act(castSpell)` (Magic User) | may require a `spell` or target field once the combat/magic slice defines its action shape |
| `drinkPotion` | `act(drinkPotion)` | |
| `flee` | `act(flee)` | |
| `parley` | `act(parley)` | requires `canParley()` to be true in current state |
| `sing` | `act(sing)` | requires `songReady()` |
| `readScroll` | `act(readScroll)` | requires `S.c.scrolls && canRead()` |
| `buyItem` | `buyFrom(state, idx)` | requires a store to be open; needs an index/id field once the economy slice defines it |
| `leaveStore` | `leaveStore()` | closes the open store |
| `useItem` | `act(() => useItem(i))` | requires an item index field |
| `camp` | `makeCamp()` | rests, consumes rations |
| `newGame` | `newGame()` | starts a fresh run mid-script (rare; mostly a script's implicit first step) |

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
