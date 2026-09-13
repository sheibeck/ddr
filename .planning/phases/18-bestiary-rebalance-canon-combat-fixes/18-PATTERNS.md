# Phase 18: Bestiary Rebalance & Canon Combat Fixes - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 12 (4 modified engine, 1 modified content data, 2 modified test, 1 modified narration, 4 new files)
**Analogs found:** 12 / 12 (all files have a direct or role-match analog; RESEARCH.md's own line-numbered insertion points are treated as primary evidence since they were verified against the live files during this mapping pass)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `engine/foeDamage.js` (new) | service (pure combat-math seam) | transform | `engine/combat.js`'s `applyFoeDamageToPlayer` (player-side armor soak) | role-match (mirror-image of an existing function in the same file) |
| `engine/combat.js` (modified: `playerStrike`, `allyTurn`, `alliesTurn`, `applyFoeDamageToPlayer` ward-reflect branch) | service (combat resolution) | transform / event-driven | itself, pre-Phase-18 (adding call-outs to the new seam at existing mutation sites) | exact |
| `engine/magic.js` (modified: `quake`/`volley`/`thrown`/`insane` damage sites) | service (spell resolution) | transform / event-driven | `engine/combat.js` `playerStrike`'s post-seam pattern (once written) | role-match |
| `engine/items.js` (modified: `"fire"` item effect, ~line 593) | service (item effect resolution) | transform / event-driven | same seam call pattern as `magic.js` | role-match |
| `content/bestiary.js` (modified: numbers only) | config/data table | CRUD (static data) | itself, pre-Phase-18 (no shape change, D-17) | exact |
| `content/damage-multipliers.js` (new) | config/data table | transform (pure lookup) | `content/afflictions.js` / `content/potions.js` (flat array-of-objects tables) | role-match |
| `content/BESTIARY-REBALANCE.md` (new) | documentation (generated/committed artifact) | batch (one-time write, versioned) | `test/parity/FIXTURE-INVENTORY.md` (Phase 17's committed before/after-style doc) | role-match |
| `tools/bestiary-yardstick.mjs` (new) | utility (CLI/offline analysis script) | batch | `tools/tune-difficulty.mjs` (headless bot script) | role-match |
| `src/browser/eventNarration.js` (modified: + `foeArmorSoaked` entry) | component (presentation/string-builder) | transform | existing `armorSoaked` entry (line 209, same file) | exact |
| `test/unit/content-tables.test.js` (modified: new pins) | test | CRUD (assertion pins) | itself, pre-Phase-18 (existing `BESTIARY`/`ARMORS` pin style) | exact |
| `test/unit/foe-turn-draw-count.test.js` (modified: zero-draw cases) | test | event-driven (draw-count assertions) | itself, pre-Phase-18 (`countingRng`/`fakeRng` pattern, lines 40-90) | exact |
| `test/unit/foe-damage.test.js` (new) | test | transform (unit, fakeRng) | `test/unit/party-combat.test.js` (fakeRng helper usage, lines 26-38) | role-match |

## Pattern Assignments

### `engine/foeDamage.js` (new service, transform)

**Analog:** `engine/combat.js`'s `applyFoeDamageToPlayer` (lines 875-956, direct read) — the player-side armor-soak function this seam mirrors for the foe side, plus RESEARCH.md's own fully-specified design (Architectural Diagram + Pattern 2/3/4, verified against the live file in this pass).

**Imports pattern** (mirror the sibling module style used by `engine/combat.js`, which imports pure helpers from `engine/derived.js`/`engine/dice.js`):
```javascript
import { rollDice } from "./dice.js";
import { multiplierFor } from "../content/damage-multipliers.js"; // or a co-located pure fn — planner's call
```

**Core transform pattern** (signature and body per RESEARCH.md's verified insertion-point analysis; confirmed line numbers below are live, not stale):
```javascript
// engine/foeDamage.js
// damageFoe(state, foe, rawDmg, source, rng, events) -> { applied, soaked }
// source: { kind: "melee"|"spell"|"reflect"|"item", casterClass, casterSub, foeType/foeName implied by `foe`, crit }
export function damageFoe(state, foe, rawDmg, source, rng, events) {
  let dmg = rawDmg;
  // 1. multiplier lookup — spell-side (and the one named melee-side Fighter/Trachea row) only
  const mult = multiplierFor(source, foe);
  if (mult !== 1) dmg = Math.round(dmg * mult);
  // 2. Sterling halfDmg — applies to EVERYTHING, before the armor roll
  if (foe.sp && foe.sp.halfDmg) dmg = Math.ceil(dmg / 2);
  // 3. armor soak — physical sources only, crit bypasses, zero-draw gate
  let soaked = false;
  const isPhysical = source.kind !== "spell";
  if (isPhysical && !source.crit && foe.sp && foe.sp.ar) {
    const roll = rng.d(20);
    if (roll <= foe.sp.ar) { soaked = true; dmg = 0; events.push({ type: "foeArmorSoaked", name: foe.name, amount: rawDmg }); }
  }
  foe.wp -= dmg;
  return { applied: dmg, soaked };
}
```

**Zero-draw gate pattern** — copy verbatim from the existing sibling `applyFoeDamageToPlayer`'s own player-armor-soak gate (`engine/combat.js` ~lines 875-905, direct read confirms the same `if (c.sp && c.sp.ar)`-style structural gate already exists on the player side): only call `rng.d(20)` when `foe.sp.ar` is truthy, so every non-`ar` foe (including all four fixture-exposed creatures) produces byte-identical draw counts to pre-Phase-18.

**Kill-accounting boundary (critical anti-pattern to avoid):** `damageFoe` must NEVER call `killFoe` — every call site keeps its own existing `if (t.wp <= 0) killFoe(state, t, rng, events)` immediately after the seam call, unchanged in position.

---

### `engine/combat.js` (modified — 4 call sites)

**Analog:** itself. Confirmed live line numbers (direct grep in this pass): `t.wp -= dmg;` (395, `playerStrike`), `t.wp -= d;` (738, `allyTurn`), `t.wp -= d;` (781, `alliesTurn`), `foe.wp -= warded;` (899, ward-reflect branch), `f.wp -= d;` (981, acid tick in `foeTurn`).

**Core pattern — `playerStrike` (around line 395):**
```javascript
// before:
if (crit) dmg *= 2;
t.wp -= dmg;
events.push({ type: "struck", target: t.name, roll, dmg, critical: crit });
if (t.wp <= 0) killFoe(state, t, rng, events);

// after:
if (crit) dmg *= 2;
const result = damageFoe(state, t, dmg, { kind: "melee", casterClass: c.cls, casterSub: c.sub, crit }, rng, events);
events.push({ type: "struck", target: t.name, roll, dmg: result.applied, critical: crit });
if (t.wp <= 0) killFoe(state, t, rng, events);
```
**Caution (verify before landing):** check `test/unit/combat.test.js` for any assertion on `struck.dmg` equal to the pre-seam raw value — RESEARCH.md flags this as a payload-shape risk since `dmg` becomes post-soak/post-multiplier.

**Slow (CANON-05) insertion** — same function, the strike-die roll a few lines earlier:
```javascript
// before:
const dieN = strikeDie(c);
const roll = rng.d(dieN);

// after:
const dieN = strikeDie(c);
let roll = rng.d(dieN);
if (t.sp && t.sp.slow) roll = Math.min(roll, rng.d(dieN));
```

**`allyTurn`/`alliesTurn` pattern (lines ~738, ~781):** route identically, no caster identity available today:
```javascript
const result = damageFoe(state, t, d, { kind: "melee", casterClass: undefined, crit: roll === 1 }, rng, events);
t is the target foe; result.applied replaces the direct `t.wp -= d;`
```

**Ward-reflect pattern (line ~899):**
```javascript
// before: foe.wp -= warded;
const result = damageFoe(state, foe, warded, { kind: "reflect", crit: false }, rng, events);
events.push({ type: "wardReflected", target: foe.name, amount: result.applied });
```

**Acid-tick pattern (line ~981, inside `foeTurn`):**
```javascript
// before: f.wp -= d;
const result = damageFoe(state, f, d, { kind: "spell", school: "acid", casterSub: c.sub }, rng, events);
```

---

### `engine/magic.js` (modified — 4 damage sites)

**Analog:** itself, pre-Phase-18. Confirmed live line numbers (direct grep): `f.wp -= d;` (169, quake), `t.wp -= d;` (201, volley), `o.wp -= d;` (283, insane r=2 foe-on-foe), `t.wp -= dmg;` (341, thrown).

**Core pattern (identical shape at all 4 sites)** — `state.c` is already in scope, so `{ kind: "spell", school: sp.kind, casterSub: c.sub }` is constructible with zero new plumbing:
```javascript
// before: f.wp -= d;  (or t.wp -= d; / o.wp -= d; / t.wp -= dmg;)
const result = damageFoe(state, f, d, { kind: "spell", school: sp.kind, casterSub: c.sub }, rng, events);
```
For the `insane` r=2 foe-on-foe branch (line 283, `o.wp -= d`) use `{ kind: "melee", casterClass: undefined }` — this is a foe hitting another foe, physically shaped, so it remains soakable by the victim's own `sp.ar`.

---

### `engine/items.js` (modified — 1 damage site, ~line 593)

**Analog:** the `magic.js` sites above (same seam call shape, `kind: "item"` per RESEARCH.md's design call — treated as physical for armor-soak purposes).
```javascript
// before: t.wp -= dmg;
const result = damageFoe(state, t, dmg, { kind: "item" }, rng, events);
```

---

### `content/bestiary.js` (modified — numbers only)

**Analog:** itself. No shape change (D-17) — every changed row keeps its existing flat `wp`/`sp.dmg`/`sp.ar`/`sp.toHit`/`sp.atk` field shape. Apply the exact new numbers from RESEARCH.md's tables:
- Pre-ability discount (D-03): Djinni (both tiers) 86→65, `dmg: {n:1,sides:4,bonus:0}`; Krupke 23→17, `dmg: {n:1,sides:6,bonus:2}`; Drudge (both tiers) 12→9, HP-only; Vampire 95→71, `dmg:{1,4,0}`; Stalka Beast 125→94, `dmg:{1,4,0}`.
- Additional outliers (D-18): Drake `wp: 135` → ~60-70 (final number at planner discretion within D-02's spirit); Werebeast `dmg` bonus reduced (e.g. `{1,10,5}` → `{1,10,2}`, per RESEARCH.md's worked recommendation).
- Sterling (D-19): `wp: 35` left UNCHANGED; only `sp.halfDmg` gets wired through the new seam.
- The four fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante) — DO NOT TOUCH (D-14).

---

### `content/damage-multipliers.js` (new content table)

**Analog:** `content/potions.js` (lines 7-13) and `content/afflictions.js` (lines 8-14) — both flat exported arrays of small object literals, the established shape for a "pure content table" in this codebase.

**Imports pattern:** none needed — a pure ESM array export, no imports (matches `potions.js`/`afflictions.js`, which import nothing).

**Core pattern:**
```javascript
export const DAMAGE_MULTIPLIERS = [
  { sourceKind: "spell", casterSub: "Cleric", foeType: "Demons", mult: 2 },
  { sourceKind: "spell", casterSub: null, foeType: "Walking Dead", mult: 2 },
  { sourceKind: "melee", casterClass: "Fighter", foeName: "Trachea", mult: 2 },
];

export function multiplierFor(source, foe) {
  const row = DAMAGE_MULTIPLIERS.find((r) =>
    r.sourceKind === source.kind &&
    (r.foeType ? r.foeType === foe.type : true) &&
    (r.foeName ? r.foeName === foe.name : true) &&
    (r.casterSub !== undefined ? r.casterSub === null || r.casterSub === source.casterSub : true) &&
    (r.casterClass ? r.casterClass === source.casterClass : true)
  );
  return row ? row.mult : 1;
}
```
Must be re-exported from `content/index.js` alongside every other content table (barrel-export pattern — confirmed via `content-tables.test.js`'s own import line: `WEAPONS, CLASSES, RACES, RACE_D8, ARMORS, BESTIARY, ENC_TYPES, SPELLS` all come from `content/index.js`).

---

### `content/BESTIARY-REBALANCE.md` (new doc)

**Analog:** `test/parity/FIXTURE-INVENTORY.md` — a committed, human-readable markdown table documenting a data-driven decision, referenced from code via a header comment (Phase 17's precedent for "the doc IS the deliverable, not just a summary").

**Pattern:** one row per changed creature (tier, type, before → after for wp/dmg/toHit/ar/atk, yardstick TTK/RTD, one-line rationale: "unchanged" / "outlier: 7.3x tier-4 TTK median" / "pre-ability discount — revisit Phase 21"). Reference it from `content/bestiary.js`'s file header comment, mirroring how other content files cross-reference doc artifacts.

---

### `tools/bestiary-yardstick.mjs` (new CLI script)

**Analog:** `tools/tune-difficulty.mjs` — the existing headless, no-network, pure-computation script pattern for offline balance analysis.

**Pattern:** a `.mjs` script (matches the existing `.mjs` extension convention in `tools/`), imports content tables directly (`content/bestiary.js`, `content/classes.js`, etc.) with zero rng, computes TTK/RTD per the formulas in RESEARCH.md's "Rebalance Yardstick" section, and prints a table to stdout — same "informational readout, not a test gate" status as `tune-difficulty.mjs` (D-16).

---

### `src/browser/eventNarration.js` (modified — 1 new entry)

**Analog:** the existing `armorSoaked` entry, same file, line 209 (verified live):
```javascript
armorSoaked: (e) => `Your armor takes ${e.amount ?? 0} from ${e.name ?? "it"} so you do not have to.`,
```

**New entry to add (foe-side sibling, distinct name and copy per D-08):**
```javascript
foeArmorSoaked: (e) => `Your blow rings off the ${e.name ?? "foe"}'s hide. It looks bored.`,
```
Defensive `??` on all fields matches every other entry in the file (confirmed pattern across `wardReflected`/`wardAbsorbed`/`damageHalved` — lines 205-212, all use the same `?? ` fallback style). No manual test wiring needed — `test/voice/safety-scan.test.js` auto-iterates `EVENT_NARRATION` and `test/unit/formatEventsCoverage.test.js` auto-derives required event types by scanning top-level `.js` files under `engine/` (confirms a new `engine/foeDamage.js` is automatically covered).

---

### `test/unit/content-tables.test.js` (modified — new pins)

**Analog:** itself, pre-Phase-18. Confirmed live import/assertion style (lines 9-59, direct read):
```javascript
import assert from "node:assert/strict";
import { WEAPONS, CLASSES, RACES, RACE_D8, ARMORS, BESTIARY, ENC_TYPES, SPELLS, /* ...+ POTIONS, EPITAPHS, CAUSE_TEXT */ } from "../../content/index.js";

test("...", () => {
  assert.equal(ARMORS.length, 5);
  const plate = ARMORS.find((a) => a.n === "Plate");
  assert.ok(plate, "Plate armor row must exist");
  assert.equal(plate.cost, 2000);
});
```
**Pattern for new BESTIARY pins:** one `test(...)` block per changed creature (or a small grouped block), each assertion with a one-line rationale comment per D-17, e.g.:
```javascript
test("BESTIARY Djinni pre-ability discount (D-03, Phase 18)", () => {
  // -25% HP (86 -> 65) + one dice-step lower melee (d6 fallback -> d4)
  assert.equal(BESTIARY.Demons[3].wp, 65);
  assert.deepEqual(BESTIARY.Demons[3].sp.dmg, { n: 1, sides: 4, bonus: 0 });
});
```
Plus a new pin locking `DAMAGE_MULTIPLIERS`'s exact 3 rows (import from `content/index.js`, `assert.equal(DAMAGE_MULTIPLIERS.length, 3)` + `assert.deepEqual` on each row).

---

### `test/unit/foe-turn-draw-count.test.js` (modified — zero-draw cases)

**Analog:** itself, pre-Phase-18. Confirmed live pattern (lines 40-90, direct read): `countingRng(inner)` wraps any rng and tallies `.d()`/`.pick()`/`.next()` calls; `fakeRng(seq)` pops sequentially and throws on underflow (making it double as a "no extra draws" assertion).
```javascript
function countingRng(inner) { /* tallies every draw call */ }
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) { /* throws on overflow */ }
```
**Pattern for new cases:** add a case using a foe WITHOUT `sp.ar`/`sp.slow` and assert the tally is UNCHANGED from the pre-Phase-18 pinned baseline; add a separate case WITH `sp.ar` set and assert the count is exactly ONE HIGHER (the armor-soak `rng.d(20)`); same treatment for `sp.slow` (+1 draw only when set).

---

### `test/unit/foe-damage.test.js` (new)

**Analog:** `test/unit/party-combat.test.js` (lines 26-38, `fakeRng` helper usage pattern) combined with the `countingRng`/`fakeRng` machinery already duplicated in `foe-turn-draw-count.test.js`.

**Pattern:** dedicated `fakeRng`-driven unit tests per D-13, one `test(...)` block per mechanic: armor-soak gate (roll ≤ ar fully blocks, roll > ar passes through, zero draw when `!foe.sp.ar`), crit bypasses soak, Sterling `halfDmg` (`Math.ceil`), and the multiplier table (Cleric/Demons, any-spell/Walking-Dead, Fighter-melee/Trachea), each calling `damageFoe(state, foe, dmg, source, fakeRng([...]), events)` directly and asserting on the returned `{ applied, soaked }` plus any pushed `foeArmorSoaked` event.

## Shared Patterns

### Zero-draw gate discipline
**Source:** `engine/combat.js`'s existing player-side armor-soak gate inside `applyFoeDamageToPlayer` (lines 875-905) and the established convention documented in RESEARCH.md's "Pattern 1."
**Apply to:** `engine/foeDamage.js` (armor-soak `rng.d(20)`, slow re-roll `rng.d(dieN)`) — every new rng draw must be gated on a structural, already-serialized flag (`foe.sp.ar`, `t.sp.slow`) that is falsy for every fixture-exposed creature, guaranteeing zero draw-order change for `test/parity/*`.

### Kill-accounting stays at the call site
**Source:** every existing `if (t.wp <= 0) killFoe(state, t, rng, events)` line in `engine/combat.js` (395, 738, 781, 899, 981) and `engine/magic.js`.
**Apply to:** every call site that adopts `damageFoe` — the seam returns `{ applied, soaked }` only; it never touches `killFoe`.

### EVENT_NARRATION entry + auto-coverage
**Source:** `src/browser/eventNarration.js` (existing entries, e.g. `armorSoaked` line 209) plus the two auto-scanning tests (`test/unit/formatEventsCoverage.test.js`, `test/voice/safety-scan.test.js`).
**Apply to:** the new `foeArmorSoaked` entry — write family-friendly, deadpan copy; no manual test wiring beyond the entry itself.

### Content-table shape: flat array of small object literals, zero imports
**Source:** `content/potions.js` (line 7), `content/afflictions.js` (line 8).
**Apply to:** `content/damage-multipliers.js` — same shape, re-exported through `content/index.js`'s barrel pattern.

## No Analog Found

None — every file in scope has at least a role-match analog in the existing codebase (this phase is explicitly "new DATA + one new PURE FUNCTION over existing infrastructure," per RESEARCH.md's own "Don't Hand-Roll" section).

## Metadata

**Analog search scope:** `engine/`, `content/`, `src/browser/`, `test/unit/`, `test/parity/`, `tools/` (directories named in RESEARCH.md's Architectural Responsibility Map and Project Structure sections; confirmed against live source via targeted `Grep`/`Read` in this session, not solely inherited from RESEARCH.md).
**Files scanned:** `engine/combat.js`, `engine/magic.js`, `engine/items.js`, `src/browser/eventNarration.js`, `content/potions.js`, `content/afflictions.js`, `test/unit/content-tables.test.js`, `test/unit/foe-turn-draw-count.test.js` (all directly read/grepped this session to confirm live line numbers match RESEARCH.md's citations — no drift found).
**Pattern extraction date:** 2026-09-13
