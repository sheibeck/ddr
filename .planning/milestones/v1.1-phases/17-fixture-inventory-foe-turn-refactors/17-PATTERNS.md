# Phase 17: Fixture Inventory & Foe-Turn Refactors - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 5 (1 modified engine file, 4 new test/doc files)
**Analogs found:** 5 / 5 (all files have a strong same-repo analog; RESEARCH.md itself already contains verbatim target code, which is preferred over re-deriving it)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `engine/combat.js` (add `pickFoeTarget`, `applyFoeDamageToPlayer` exports; `foeTurn` calls them) | service (pure engine function, extraction) | transform (state → state + events) | `engine/combat.js` itself — `liveFoes` (line 59), `killFoe` (line 409), `downMember` (line 799) as sibling exported pure helpers in the same file | exact (self-file precedent) |
| `test/unit/foe-turn-draw-count.test.js` | test (unit, regression) | transform (rng draws → count) | `test/unit/rng.test.js` (counting/comparing two rng streams) + `test/unit/party-combat.test.js` (fakeRng throw-on-underflow pattern, fixedState/fixedFighter/fixedFloor helpers) | role-match (combination of both) |
| `test/unit/combat.test.js` (extended with direct `pickFoeTarget`/`applyFoeDamageToPlayer` unit cases) | test (unit, behavior-preserving) | request-response (call helper, assert exact output) | itself — existing `fakeRng`/`fixedFighter`/`fixedFloor` helper block (top of file) | exact |
| `test/unit/party-combat.test.js` (extended with `pickFoeTarget` party-pool cases) | test (unit, behavior-preserving) | request-response | itself — existing file header + `fakeRng` (throws on underflow) pattern | exact |
| `test/parity/FIXTURE-INVENTORY.md` | config/doc (committed markdown reference) | batch (one-time generated table) | `test/parity/README.md` and `test/parity/action-script.schema.md` (existing committed markdown docs describing fixture shapes) | role-match |
| `test/parity/fixture-inventory.test.js` (new, recommended) | test (parity, pinned enumeration) | batch (replay fixtures → assert roster) | `test/parity/combat-parity.test.js` / `test/parity/full-suite.test.js` (fixture replay via harness) + `test/parity/harness/comparables.js#applyStartCombat` (the exact function to reuse, not reimplement) | exact |

## Pattern Assignments

### `engine/combat.js` — add `pickFoeTarget(state, rng)` (service, transform)

**Analog:** the file's own existing exported pure helpers (`liveFoes` line 59, `killFoe` line 409, `downMember` line 799) — same file, same signature convention `(state, ...)` or `(state, rng, events)`.

**Current inline code to replace** (`engine/combat.js:860-865`, verbatim — RESEARCH.md Pattern 1):
```js
const liveMembers = C.allies ? C.allies.filter((a) => a.wp > 0) : [];
let member = null;
if (liveMembers.length) {
  const pick = rng.d(liveMembers.length + 1);
  if (pick > 1) member = liveMembers[pick - 2];
}
```

**Extraction target** (export, place near other foe-turn helpers in `engine/combat.js`):
```js
export function pickFoeTarget(state, rng) {
  const C = state.combat;
  const liveMembers = C.allies ? C.allies.filter((a) => a.wp > 0) : [];
  if (!liveMembers.length) return null;
  const pick = rng.d(liveMembers.length + 1);
  return pick > 1 ? liveMembers[pick - 2] : null;
}
```
Call site: `const member = pickFoeTarget(state, rng);` — same draw count/order, `null` = hero.

**Zero-draw gate pattern to preserve** (matches project convention at `engine/combat.js:170-182`): every extra RNG draw is gated on a field that's absent on parity paths — here, `liveMembers.length`. Comment the gate explicitly, mirroring existing style.

---

### `engine/combat.js` — add `applyFoeDamageToPlayer(state, foe, dmg, roll, need, rng, events)` (service, transform)

**Analog:** same file's `die()` call convention (`engine/death.js`, imported into `combat.js`) and `killFoe` (line 409) for the "helper does state mutation + event push, caller controls loop flow" shape.

**Boundary and full body:** RESEARCH.md's Pattern 2 (lines 260-333 of `17-RESEARCH.md`) already contains the exact, line-mapped extraction target ported verbatim from `engine/combat.js:892-981` — Hardiness reduction, `c.halfNext` (Pendant), ward absorb/reflect/shatter (including the `killFoe(...)` + early non-death return on a reflect-kill), armor-soak `rng.d(20)` via `armorSoak(c)`, `c.wp -= dmg` + `struckByFoe` event, and `die()` on lethal. Copy that code as the implementation baseline; do not re-derive it from scratch.

**Result-object contract (critical, do not deviate):**
```js
// caller (foeTurn) call site:
const result = applyFoeDamageToPlayer(state, f, dmg, roll, need, rng, events);
if (result.onArmour) continue;
if (result.died) return events;
```
`died` must be set ONLY at the `c.wp <= 0` branch — never at the ward-reflect `f.wp <= 0` branch (that path returns `{ onArmour: false, died: false }` so the swing loop `continue`s). See RESEARCH.md Pitfall 1/2 for why this ordering is load-bearing (`state.combat` becomes `null` after `die()`).

**Signature note:** pass `need` as an explicit extra parameter (RESEARCH.md Assumption A1/Open Question 1 — recommended resolution) so the `struckByFoe` event shape (`combat.js:973`) stays unchanged.

**Untouched sibling:** the simplified member-damage branch (`engine/combat.js:867-889`, no ward/armor/Hardiness) stays separate and is NOT routed through this helper — do not "unify for consistency."

---

### `test/unit/foe-turn-draw-count.test.js` (test, batch/regression)

**Analog A — counting wrapper style:** `test/unit/rng.test.js` (imports `makeRng`, drives two parallel rng streams and asserts equality call-by-call).

**Analog B — throw-on-underflow fixture pattern:** `test/unit/party-combat.test.js` lines 1-40 — `fakeRng(seq)` that throws on sequence exhaustion, `fixedFighter(overrides)`/`fixedFloor(overrides)` builder helpers. Reuse these helper shapes rather than inventing new fixture builders.

**Imports pattern** (from `test/unit/party-combat.test.js` lines 20-24):
```js
import test from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../../engine/rng.js";
import { startCombat, alliesTurn, foeTurn, killFoe, endCombat, afterPlayerAction } from "../../engine/combat.js";
```

**Core pattern** (from RESEARCH.md Code Examples, lines 393-420 of `17-RESEARCH.md`) — a `countingRng(seed)` wrapper around `makeRng` that increments a counter on every `.d`/`.pick`/`.shuffle`/`.next` call, then asserts `rng.draws` equals a pinned count after a `foeTurn` call against a fixed single-foe, no-party, no-abilities state. Copy verbatim; only the pinned integer needs confirming by actually running the test once written (RESEARCH.md flags this as MEDIUM confidence — "must run the real test once written to get the true pinned count").

---

### `test/unit/combat.test.js` and `test/unit/party-combat.test.js` (extended, test/request-response)

**Analog:** the files' own existing `fakeRng`/`fixedFighter`/`fixedFloor` helpers (see excerpt above) — add new `test(...)` blocks alongside existing ones, do not create new helper infrastructure.

**pickFoeTarget test pattern** (RESEARCH.md Code Examples, lines 425-444):
```js
import { pickFoeTarget } from "../../engine/combat.js";

test("pickFoeTarget: empty/absent party draws ZERO rng and returns null", () => {
  const state = { combat: { allies: [] } };
  const rng = fakeRng([]); // throws on ANY draw
  assert.equal(pickFoeTarget(state, rng), null);
});

test("pickFoeTarget: pick===1 targets the hero (null); pick>1 targets liveMembers[pick-2]", () => {
  const members = [fixedAlly({ name: "Ada" }), fixedAlly({ name: "Beo", wp: 5 })];
  const state = { combat: { allies: members } };
  assert.equal(pickFoeTarget(state, fakeRng([1])), null);
  assert.equal(pickFoeTarget(state, fakeRng([2])).name, "Ada");
  assert.equal(pickFoeTarget(state, fakeRng([3])).name, "Beo");
});
```

**Error handling:** `fakeRng`'s throw-on-underflow IS the error-handling/assertion convention here — no try/catch needed; a thrown "sequence exhausted" error surfaces as a failing test, which is the intended zero-extra-draw proof.

---

### `test/parity/FIXTURE-INVENTORY.md` (doc, batch)

**Analog:** `test/parity/README.md` and `test/parity/action-script.schema.md` — existing committed markdown docs in the same directory describing fixture shapes/conventions. Match their heading/table style.

**Content is already fully specified** in RESEARCH.md's "Fixture Inventory (FID-01) — Verified Results" section (lines 72-125 of `17-RESEARCH.md`): the fixture → scenario → seed → forced-type → foes-rolled table, the "complete parity-exposed bestiary surface" conclusion (Beasts: `Bat/Rat`, `Shriek`, `Viper`; Humans: `Dante`, all level 1), and a "how to regenerate" pointer to the enumeration script. Transcribe that table directly; it was generated by actual execution, not projection — do not re-derive it.

**Enumeration method to cite in the doc** (RESEARCH.md lines 78-92):
```js
import { newRun } from "../../engine/engine.js";
import { applyStartCombat } from "./harness/comparables.js";

function inspect(label, seed, actions) {
  const startAction = actions.find((a) => a.type === "startCombat");
  if (!startAction) { console.log(`${label}: no startCombat action`); return; }
  const { state } = applyStartCombat(newRun(seed), startAction.wandering, startAction.forced);
  console.log(label, state.combat ? state.combat.foes.map((f) => `${f.name} (lvl ${f.lvl}, wp ${f.wp}, type ${f.type})`) : "cleared immediately");
}
```

---

### `test/parity/fixture-inventory.test.js` (new, recommended; test/parity, batch)

**Analog:** `test/parity/combat-parity.test.js` / `test/parity/full-suite.test.js` for the "load fixture json, replay via harness, assert" shape; `test/parity/harness/comparables.js#applyStartCombat` (already exported, lines 199-206) is the exact function to call — do NOT reimplement `startCombat`/rng-rehydrate logic.

**Core pattern:** reuse the `inspect`-style enumeration above but with `assert.deepStrictEqual` against the pinned roster array matching `FIXTURE-INVENTORY.md`'s table. Comment clearly per RESEARCH.md: "if this breaks after an intentional fixture/seed change, regenerate FIXTURE-INVENTORY.md too — do not just update the pinned array."

**Import pattern:**
```js
import test from "node:test";
import assert from "node:assert/strict";
import { newRun } from "../../engine/engine.js";
import { applyStartCombat } from "./harness/comparables.js";
```

---

## Shared Patterns

### Zero-draw determinism gates
**Source:** `engine/combat.js:170-182, 857-866` (existing comment convention).
**Apply to:** `pickFoeTarget` and any new gated logic — every extra RNG draw must be gated on a field/condition absent on parity paths (empty party, no `abilities`, no `ward`), and the gate should be called out in a comment the same way existing gates are (`c.regen`, `f.acid`, `C.allies`, `c.halfNext`).

### `fakeRng` / throw-on-underflow test helper
**Source:** `test/unit/party-combat.test.js` (top of file, `fakeRng(seq)`).
**Apply to:** all new unit tests in `test/unit/combat.test.js` and `test/unit/party-combat.test.js` — reuse this exact helper (already imported/defined in those files) rather than writing a new mock rng.

### `applyStartCombat` harness reuse
**Source:** `test/parity/harness/comparables.js:199-206`.
**Apply to:** both the `FIXTURE-INVENTORY.md` generation method and `test/parity/fixture-inventory.test.js` — this is the one non-negotiable "don't hand-roll" pattern per RESEARCH.md; it is the identical clone/rehydrate-rng/persist-cursor shape `engine/engine.js#applyAction` uses internally.

### `{ onArmour, died }` result-object signaling
**Source:** new pattern introduced by this phase itself (RESEARCH.md Pattern 2), but structurally mirrors how `killFoe` (line 409) and `die()` (`engine/death.js`) already communicate terminal state changes back to callers rather than controlling caller loop flow directly.
**Apply to:** `applyFoeDamageToPlayer` only; the member-damage branch (`combat.js:867-889`) is explicitly NOT touched by this pattern.

### Comment discipline for deliberate scope boundaries
**Source:** existing `DELIBERATE RULES CHANGE (Phase N, REQ)` inline-comment convention used elsewhere in `engine/combat.js`.
**Apply to:** the extraction's doc-comments on `pickFoeTarget`/`applyFoeDamageToPlayer` should state explicitly (as RESEARCH.md's proposed JSDoc already does) that behavior is unchanged and cite the original line numbers, so a future reviewer can diff intent against implementation.

## No Analog Found

None. Every file in scope has a same-repo analog, and for the two `engine/combat.js` extractions, RESEARCH.md provides a verbatim target implementation superior to any external analog (it IS the current code, pre-verified line-by-line).

## Metadata

**Analog search scope:** `engine/combat.js`, `engine/rng.js`, `engine/death.js`, `test/unit/combat.test.js`, `test/unit/party-combat.test.js`, `test/unit/rng.test.js`, `test/parity/harness/*.js`, `test/parity/README.md`, `test/parity/*.test.js`
**Files scanned:** ~12 (via RESEARCH.md's own direct-read sourcing, cross-checked with 2 targeted reads in this pass: `test/unit/party-combat.test.js` header, `test/unit/rng.test.js` header)
**Pattern extraction date:** 2026-09-13
