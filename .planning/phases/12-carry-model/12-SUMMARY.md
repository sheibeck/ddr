---
phase: "12"
name: Carry Model + Migration (Economy A)
status: complete
completed: 2026-09-09
tests: 617/617 (parity byte-identical)
requirements: [ECON-01, ECON-02]
---

# Phase 12: Carry Model + Migration — SUMMARY

**Complete + verified 2026-09-09.** `npm test` = **617/617** (606 + 11), parity byte-identical, no rng added, no `STATE_VERSION` bump. Data-model only — no behavior/UI change (invisible on-device). Deployed to the Pixel 7 alongside the generalized death-on-move beat fix.

## What landed
- **`content/bags.js`** (+ `content/index.js` re-export) — `BAGS`: small {slots:4, wilmst:2000, rations:10} · medium {6,5000,20} · large {8,8000,40} · exlarge {10,10000,60}. Pure data.
- **`engine/character.js`** — `c.bag` plain class-derived assignment (`Fighter → "medium"`, else `"small"`) in the character literal beside `flightCooldown` (NO rng — proven by a twin-`rollCharacter` cursor test); `clampCarry(c)` called once at end of chargen (a no-op there).
- **`engine/state.js`** — `pendingFind: null` in `newRun` (sibling of combat/store/party).
- **`engine/derived.js`** — `clampCarry(c)`: clamps items/gold/rations to `BAGS[c.bag]` caps; **no-op when `!c.bag`** (never called from ported giveItem/gainWilmst paths).
- **`engine/saveState.js`** — `defaultBagForClass` + `migrateCarry`; `validateSave`/`rehydrate` migrate a missing `c.bag` (Fighter→medium, else/unknown→small); `pendingFind`→null on rehydrate.
- **Parity carve-outs** — `stripBagField(c.bag)` in the 3 harness comparators + the 3 local comparables + the 2 chargen shape checks (mirrors the `name` footprint); `pendingFind` stripped at the 6 sites beside `party`/`pendingJoiner`. `prototype-master.js.txt` untouched.
- **`test/unit/carry-model.test.js`** (11 tests): BAGS, class bag, plain-assignment determinism, pendingFind round-trip/null, migration defaults, clampCarry no-op/clamp.

## Requirements: ECON-01 ✅ (bags + caps model), ECON-02 ✅ (persist + migrate). No behavior yet (Phase 13 wires the actions).
## Next: Phase 13 — Inventory Actions + UI (replaces auto-take-best).
