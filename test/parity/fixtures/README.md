# Parity Fixtures

This directory holds the seeded action-script fixtures the prototype-parity
harness replays through both the frozen prototype and (once it exists) the
extracted engine. See `action-script.schema.md` for the exact JSON shape and
the reserved `type` vocabulary.

## Why these exist

01-RESEARCH.md's core recommendation for ENG-05 ("zero gameplay regressions")
is a golden-master harness: run the *same* seeded action script through the
unmodified prototype (`test/parity/prototype-master.js.txt`, sandboxed headless
via `test/parity/harness/sandboxPrototype.js`) and the new engine, and diff
state after every action (`test/parity/harness/diffState.js`). A fixture file
here is one such script — the shared input both sides replay.

## Adding a new fixture

1. Pick a filename that names the rule area it exercises, matching the
   locked extraction order (e.g. `action-script.movement.json`,
   `action-script.combat.json`, `action-script.economy.json`,
   `action-script.chargen.json`). Build fixtures incrementally, alongside the
   plan that extracts the matching engine slice — not all up front.
2. Write `{ "seed": <int>, "actions": [...] }` per `action-script.schema.md`.
   Pick a seed that, given the current prototype, exercises the specific
   rule paths the fixture is meant to cover (e.g. a seed known to roll a
   Fighter for a combat fixture). If a new action `type` or field is needed,
   add it to `action-script.schema.md`'s vocabulary table in the same change.
3. Confirm the fixture actually runs against the frozen prototype without
   throwing: `node -e "import('../harness/sandboxPrototype.js').then(async m => { const ctx = m.loadPrototypeSandbox({seed: <seed>}); for (const a of <actions>) { /* dispatch a.type to ctx.move/act/etc. */ } })"` (or, once
   the plan authoring the fixture also writes a parity test, just run that
   test).
4. Do not edit `test/parity/prototype-master.js.txt` to make a fixture pass — it
   is the frozen golden master (see its header comment). If a fixture seems
   to require prototype behavior that doesn't exist, the fixture itself is
   wrong, not the golden master.

## Running the harness

- Smoke test only (proves the sandbox harness itself works, no fixtures
  needed): `node --test test/parity/harness/smoke.test.js`
- Full parity suite (once fixtures + an engine slice exist):
  `node --test test/parity`
