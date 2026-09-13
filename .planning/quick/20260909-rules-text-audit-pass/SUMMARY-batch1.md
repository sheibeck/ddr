# Batch 1 (rules) — Summary

**Completed:** 2026-09-09 · `npm test` **545/545** (was 535; +10 tests). No commits (working tree).

## A2 — Flying wired (charge/cooldown version)
- New `isFlying(state)` + `hasItemNamed(c,name)` in `engine/derived.js`. `eff(c,"fly")` items now do something.
- **Bracelet of Flight** = unconditional always-on (never touches counters).
- **Cloak of Flying** = real resource: `c.flightLeft` (20-square charge) + `c.flightCooldown` (50-square cooldown), new serialized fields. Constants `FLIGHT_CHARGE_SQUARES=20`, `FLIGHT_COOLDOWN_SQUARES=50` in `engine/movement.js`.
- `engine/movement.js` climb/gorge block: when flying, skip roll + fall-damage (no rng), push new **`flownOver`** event, clear tile; Cloak banks a charge on first use, burns 1/step, then cools down. Per-step tick alongside haste/invis.
- Chargen inits `flightLeft:0, flightCooldown:0` (plain literals, no rng) in `engine/character.js`.

## A3 — Rest cure roll
- `engine/movement.js` `newDay()`: `rng.d(20) <= 10 + (Hardiness?4:0)` → cure (50% base / 70% w/ Hardiness), else new **`afflictionLingers`** event. Draw fires only when `c.affliction` exists (determinism-safe).

## A1 (engine half)
- `afflictionPassed`/`afflictionCured`/`afflictionLingers` now carry `kind`. (Narration wording + "Disease"→"Ailment" = Batch 2.)

## New narration (terse; Batch 2 polishes)
- `flownOver`: "You simply fly over it." · `afflictionLingers`: "You rest, but whatever this is rides out the night with you."

## Parity/tests
- `test/parity/harness/comparables.js` new `stripFlightFields` + the 5 parity files' `CHARACTER_FIELDS`/`comparable()` updated (mirrors 04.1-05 `stripDarkForField`). Golden master untouched.
- 10 new unit tests (flight charge/cooldown/bracelet/both-items; cure success/lingers/Hardiness) + 1 extended (`afflictionPassed.kind`).
- Chargen RNG order unchanged (chargen-parity/full-suite/same-seed all green).

## Files
`engine/character.js`, `engine/derived.js`, `engine/movement.js`, `src/browser/eventNarration.js`, 6 parity/test files, `test/unit/movement.test.js`, `test/unit/combat.test.js`.
