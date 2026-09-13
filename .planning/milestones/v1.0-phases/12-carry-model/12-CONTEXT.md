# Phase 12: Carry Model + Migration (Economy A) — Context

**Gathered:** 2026-09-09 (autonomous). **Requirements:** ECON-01, ECON-02.
**Research (authoritative):** `.planning/research/economy-SUMMARY.md` §1, §2, §6-A. **Roadmap:** ROADMAP Phase 12. Baseline: `npm test` = **606/606**, parity byte-identical.

## Phase boundary
- **DOES:** add the carry-capacity DATA MODEL — a `BAGS` content table, a class-derived `c.bag` field, a `state.pendingFind` field, a gated `clampCarry(c)` helper, save migration + parity carve-outs. NO behavior change yet (inventory actions/UI are Phase 13; the clamp is a no-op until wired).
- **Does NOT:** change take/drop/equip behavior (Phase 13), store (14), items (15), or numbers (16).

## Locked decisions (research + user "mechanics + conservative")
- **BAGS table** (new `content/bags.js` or in an existing content file): `small {slots:4, wilmst:2000, rations:10}`, `medium {6, 5000, 20}`, `large {8, 8000, 40}`, `exlarge {10, 10000, 60}`. All three are documented tuning knobs (final numbers Phase 16). The book's raw item column (1/2/3/4) is rescaled to 4/6/8/10 per the spec.
- **`c.bag`** — a string (`"small"|"medium"|"large"|"exlarge"`), assigned at chargen by class (`engine/character.js`): Magic User = `small`, Fighter = `medium`, Thief = `small` (rulebook p.10). Set as a PLAIN ASSIGNMENT with NO rng draw — mirror `darkFor`/`flightLeft` (`character.js:200,213`) so chargen rng order is unchanged.
- **Equipped gear is slot-free:** `c.weapon`/`c.armor` are scalar, NOT in `c.items`. The bag = `c.items` (already exists). "Every item takes a slot" = `c.items.length` counts against `BAGS[c.bag].slots`. The Thief's seeded cloak already lives in `c.items`.
- **`state.pendingFind`** — a NEW top-level nullable field (the stash for "found an item, awaiting player choice"), exactly like `state.pendingJoiner`. Init `null`; nulled on `rehydrate` like `combat`/`store`.
- **`clampCarry(c)`** — a pure helper that enforces the caps (items ≤ slots, gold ≤ wilmst cap, rations ≤ rations cap). **GATED: a complete no-op when `!c.bag`** (so every frozen parity fixture — which has no `c.bag` after stripping — is byte-identical). In THIS phase it exists but is only called where safe (e.g. after chargen); it is NOT retrofitted into the ported `giveItem`/`gainWilmst` paths (that would change fixture behavior). Phase 13+ calls it from the new gated action handlers.

## Save migration (`engine/saveState.js`)
Additive-with-default, mirror the `sanitizeParty` precedent (PARTY-02): `validateSave`/`rehydrate` default a missing `c.bag` to a bag (class-derived if the class is known, else `"small"`); `pendingFind` defaults to `null` and is nulled on rehydrate like `combat`. NO `STATE_VERSION` bump (additive default).

## Parity carve-out (`test/parity/harness/comparables.js` + the 3 local comparables)
- Add `stripBagField(c)` (mirror `stripDarkForField`/`stripFlightFields`) stripping `c.bag`, applied in `movementComparable`/`combatComparable`/`economyComparable`.
- Strip top-level `state.pendingFind` at the destructure beside `party`/`pendingJoiner` — in the harness 3 comparators AND the 3 local `comparable()` in `movement`/`combat`/`magic`-parity (same 6-site pattern as `party`/`pendingJoiner`).
- NEVER edit `prototype-master.js.txt`.

## Success criteria (gate)
1. `BAGS` table + class-derived `c.bag` at chargen (no rng) + `state.pendingFind` field exist and serialize/rehydrate losslessly.
2. Old saves (no `c.bag`) migrate to a default bag; `pendingFind`→null. No STATE_VERSION bump.
3. `clampCarry(c)` is a no-op when `!c.bag`; unit tests cover the caps (items/gold/rations clamp when a bag is set).
4. **PARITY GATE:** full `npm test` byte-identical to 606/606 — `c.bag` + `pendingFind` stripped everywhere; chargen-parity green (bag stripped, no rng added); clamp no-op on all frozen fixtures.

## Hard constraints
Engine pure/deterministic; NO new rng (bag is a plain assignment); clamp gated + not in ported paths; new fields carved out (6 sites for pendingFind, 3 for c.bag); no field/event renames; no git; no build/deploy (orchestrator); no SUMMARY.md (policy).
