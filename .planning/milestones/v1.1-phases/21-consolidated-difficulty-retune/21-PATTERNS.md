# Phase 21: Consolidated Difficulty Retune - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 13 (new/modified)
**Analogs found:** 13 / 13 (all in-repo — this phase extends existing seams, no unfamiliar-domain code)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `engine/difficulty.js` (extend `difficultyCurve`) | service (pure fn) | transform | itself — `dots`/`darkBlobs` fields already use `softCap` | exact (self-extension) |
| `engine/combat.js#startCombat` | service | CRUD (build combat state) | itself — per-foe copy loop, lines 116-152 | exact (self-extension) |
| `engine/foeAbilities.js#tickAbilityCooldowns` | service | transform | itself + sibling `firstReadyAbility(state, f)` (already state-aware) | exact (signature copy) |
| `engine/state.js#newRun` | service/model | CRUD (factory) | itself, lines 63-104 | exact (self-extension) |
| `engine/saveState.js` (`dev` field) | model/validation | transform | `dead`/`won` boolean-coercion precedent, lines 195-196/244-245 | exact |
| `test/parity/harness/comparables.js` (`dev` strip) | test/utility | transform | `party`/`pendingJoiner`/`pendingFind` top-level strip destructure | exact |
| `tools/lib/tuning-bot.mjs` (NEW shared module) | utility | event-driven (bot policy) | `tools/tune-difficulty.mjs#decideAction` (lines 125-141) | exact (extraction source) |
| `tools/tune-difficulty.mjs` (consume shared module) | utility/CLI | batch | itself, current `decideAction`/`autoPlayOnce` | exact (self-extension) |
| `tools/tune-economy.mjs` (consume shared module) | utility/CLI | batch | `tune-difficulty.mjs`'s near-duplicate `decideAction` | role-match (sibling tool) |
| `mazeworld.html` — Settings version line + long-press dev field | component (DOM) | event-driven | `#mw-settings-rows` existing rows (Handedness/Sound/Haptics), lines 1184-1229 | role-match (new row, no long-press precedent) |
| `src/browser/engineAdapter.js` — `startNewRun`/`persistGrave`/`recordBest` gating + `startDepth` threading | provider/service | request-response | itself, lines 262-281 (`startNewRun`) / 181-259 (`recordBest`/`persistGrave`) | exact (self-extension) |
| `docs/DIFFICULTY-RETUNE.md` (NEW) | doc/ledger | batch (before/after report) | `docs/PARLEY-REBALANCE.md` (Phase 20 ledger format) | exact |
| `test/unit/difficulty.test.js` (or similar, NEW) | test | transform (unit assertions) | existing `test/difficulty/difficulty.test.js` (PARITY GUARD pattern referenced in `softCap`'s doc comment) | exact |

## Pattern Assignments

### `engine/difficulty.js` (service, transform)

**Analog:** itself — the file's own `softCap`/`dots`/`darkBlobs` pattern (lines 24-118, this session's read)

**Existing soft-cap pattern to copy** (lines 58-64):
```javascript
function softCap(base, cap, depth, k) {
  return Math.round(base + (cap - base) * (1 - Math.exp(-depth / k)));
}
```
**IMPORTANT (Assumption A4 in RESEARCH.md):** this helper rounds — fine for integer `dots`/`darkBlobs`, WRONG for fractional `foePower`/`abilityThreat` (would flatten 1.0→1.6 into whole steps). Add a non-rounding sibling, e.g. `softCapFloat(base, cap, depth, k)` without the `Math.round`, and use it for `foePower`/`abilityThreat`; keep `Math.round` only for `foeCap` (an integer count).

**Existing curve-object return shape to extend** (lines 108-118):
```javascript
export function difficultyCurve(depth) {
  const d = safeDepth(depth);
  const breather = isBreatherOfSafeDepth(d);
  return {
    depth: d,
    breather,
    dots: breather ? ENCOUNTER_DOT_BASE : softCap(ENCOUNTER_DOT_BASE, ENCOUNTER_DOT_CAP, d, ENCOUNTER_DOT_SOFT_K),
    darkBlobs: breather ? 0 : Math.min(Math.max(0, d - 1), DARK_BLOB_CAP),
    darkRadius: Math.min(DARK_RADIUS_BASE + d, DARK_RADIUS_CAP),
    // NEW (Phase 21, D-01): foeCap, foeLvlBias, foePower, abilityThreat —
    // identity through depth <= 5 (D-19/Pitfall 7), asymptotic beyond it.
  };
}
```
**Identity boundary (D-19/Pitfall 7):** all four new fields must equal their depth<=5 identity value (`foeCap=3`, `foeLvlBias=0`, `foePower=1.0`, `abilityThreat=1.0`) — proven by `test/determinism/foe-abilities.test.js`'s tier 2/4/5 pins, not just depth 1. Follow `safeDepth`'s guard pattern (lines 47-51) — no new validation needed, `d` is already sanitized.

---

### `engine/combat.js#startCombat` (service, CRUD)

**Analog:** itself, lines 108-161 (this session's read)

**Foe-count draw — DO NOT touch the draw shape** (line 132):
```javascript
const n = wandering ? 1 : Math.min(cap, rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3);
```
**Pitfall 1 fix pattern** — add a zero-new-draw arithmetic bonus BEFORE `Math.min`:
```javascript
const curve = difficultyCurve(state.floor.depth); // 0 rng draws, safe unconditionally
const baseRoll = rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3; // UNCHANGED draw shape
const bonus = Math.max(0, Math.round(curve.foeCap) - 3);   // 0 at depth<=5
const n = wandering ? 1 : Math.min(curve.foeCap, baseRoll + bonus);
```

**Per-foe instance copy — where `foePower` applies** (lines 133-152, the `foes.push({...})` block):
```javascript
for (let i = 0; i < n; i++) {
  const lvl = clamp(maxLvl - (rng.d(4) === 1 ? 1 : 0), 1, 5); // UNCHANGED
  const roster = BESTIARY[type][lvl - 1];
  const picked = rng.pick(roster); // UNCHANGED draw
  const scaledWp = Math.round(picked.wp * curve.foePower); // ===picked.wp when foePower===1.0
  foes.push({
    name: picked.n, type, lvl, size: picked.sz, intel: picked.i,
    wp: scaledWp, maxWP: scaledWp,
    alive: true, asleep: 0, sp: picked.sp || {},
    lives: picked.sp && picked.sp.twice ? 2 : 1,
    ...(picked.abilities ? { abilities: picked.abilities.slice() } : {}),
  });
}
```
Verify `Math.round(picked.wp * 1.0) === picked.wp` for all four fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante — `test/parity/FIXTURE-INVENTORY.md`) as a unit assertion.

**Import to add** (top of file, near line 59 where `foeAbilities.js` is imported):
```javascript
import { difficultyCurve } from "./difficulty.js"; // already imported by movement.js/maze.js
```

---

### `engine/foeAbilities.js#tickAbilityCooldowns` (service, transform)

**Analog:** sibling function in the same file, `firstReadyAbility(state, f)` (lines 68+), already `state`-aware.

**Current signature to change** (lines 46-53):
```javascript
export function tickAbilityCooldowns(f) {
  for (const id of f.abilities) {
    const a = BY_ID.get(id);
    if (!a || a.every === undefined) continue;
    if (!f.cd) f.cd = {};
    if (f.cd[id] === undefined) f.cd[id] = a.every; // D-20 lazy init
    f.cd[id] = Math.max(0, f.cd[id] - 1);
  }
}
```
**New shape (D-18):**
```javascript
export function tickAbilityCooldowns(state, f) {
  const threat = difficultyCurve(state.floor.depth).abilityThreat; // 1.0 at depth<=5
  for (const id of f.abilities) {
    const a = BY_ID.get(id);
    if (!a || a.every === undefined) continue;
    if (!f.cd) f.cd = {};
    if (f.cd[id] === undefined) f.cd[id] = Math.max(1, Math.round(a.every / threat)); // ===a.every at threat===1
    f.cd[id] = Math.max(0, f.cd[id] - 1);
  }
}
```
**Call site to update** — `engine/combat.js#foeTurn`, line 1227:
```javascript
tickAbilityCooldowns(f);   // BEFORE
tickAbilityCooldowns(state, f);  // AFTER
```
Needs `import { difficultyCurve } from "./difficulty.js"` added to `engine/foeAbilities.js`.

---

### `engine/state.js#newRun` (service/model, CRUD factory)

**Analog:** itself, lines 63-104 (this session's read)

**Current signature/body:**
```javascript
export function newRun(seed, exclude = []) {
  const rng = makeRng(seed);
  const c = rollCharacter(rng, exclude);
  const floor = genFloor(1, rng);
  reveal(floor, revealRadius({ floor, c }));
  return {
    version: STATE_VERSION, seed, rngState: rng.getState(), c, floor,
    day: 1, steps: 0, combat: null, store: null, beats: null,
    party: [], pendingFind: null, dead: false, won: false, deathNote: "", epitaph: "",
  };
}
```
**New shape (D-13/D-14, Pattern 4 from RESEARCH.md):**
```javascript
export function newRun(seed, exclude = [], { startDepth = 1 } = {}) {
  const rng = makeRng(seed);
  const c = rollCharacter(rng, exclude);          // UNCHANGED draw order when startDepth===1
  const floor = genFloor(startDepth, rng);        // genFloor(1, rng) identical when omitted
  reveal(floor, revealRadius({ floor, c }));

  const state = { version: STATE_VERSION, seed, rngState: rng.getState(), c, floor, day: 1, steps: 0,
    combat: null, store: null, beats: null, party: [], pendingFind: null,
    dead: false, won: false, deathNote: "", epitaph: "" };

  if (startDepth > 1) {
    // DEV-ONLY PATH (D-14) — never reached by any fixture/default caller.
    const events = [];
    c.sp = THRESHOLDS[Math.min(startDepth, 5) - 1];
    checkLevel(state, rng, events);
    gainWilmst(state, WILMST_CACHE_PER_DEPTH * startDepth, "dev start", rng, events);
    state.dev = true;
  }
  return state;
}
```
Keep the 3-arg additive form (`exclude` stays a positional array) so all existing 1-2-arg callers (`initRun`, `boot`) need zero changes. Watch for a new `state.js -> items.js` import edge (`gainWilmst`) — verify no cycle with `grep -n "state.js" engine/items.js`.

---

### `engine/saveState.js` (`dev` field) (model, transform)

**Analog:** the `dead`/`won` boolean-coercion precedent, `validateSave` line 195-196 and `rehydrate` line 244-245:
```javascript
party: sanitizeParty(obj.party),
dead: !!obj.dead,
won: !!obj.won,
```
**Pattern to copy — add alongside them in BOTH functions:**
```javascript
dev: !!obj.dev,
```
Both `validateSave`/`rehydrate` build an explicit whitelist (no spread), so this is a required additive line in both, not just a comparables strip (per RESEARCH Open Question 3).

---

### `test/parity/harness/comparables.js` (`dev` strip) (test, transform)

**Analog:** the existing top-level strip destructure shared by `movementComparable` (line ~163) and `combatComparable` (line ~219):
```javascript
const { beats, seed, rngState, version, party, pendingJoiner, pendingFind, ...state0 } = state;
```
**Pattern to copy — add `dev` to the destructure in ALL THREE `*Comparable()` fns** (`movementComparable`, `combatComparable`, `economyComparable`, per D-14's "all three"):
```javascript
const { beats, seed, rngState, version, party, pendingJoiner, pendingFind, dev, ...state0 } = state;
```

---

### `tools/lib/tuning-bot.mjs` (NEW shared module) (utility, event-driven)

**Analog:** `tools/tune-difficulty.mjs#decideAction` (lines 125-141, this session's read) — the extraction source, near-duplicated in `tools/tune-economy.mjs`.

**Current function to extract and extend (D-05/D-06):**
```javascript
function decideAction(state, policyRng) {
  if (state.combat) {
    const c = state.c;
    const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
    if (ratio < 0.3) {
      if (canParley(state)) return { type: "parley" };
      return { type: "flee" };
    }
    return { type: "attack" };
  }
  if (state.store) return { type: "leaveStore" };
  const dir = nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
  return { type: "move", dir };
}
```
**Extend per D-05/D-06 (priority order, per RESEARCH.md Pattern 2):**
```javascript
export function decideAction(state, policyRng) {
  if (state.combat) {
    const c = state.c;
    const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
    const anyCaster = state.combat.foes.some((f) => f.abilities?.length); // D-06, public state
    const fleeThreshold = anyCaster ? 0.5 : 0.3;
    if (ratio < fleeThreshold) {
      if (canParley(state)) return { type: "parley" };
      return { type: "flee" };
    }
    const castIdx = findCastableAttackSpell(state); // NEW helper
    if (castIdx !== null) return { type: "castSpell", idx: castIdx };
    return { type: "attack" };
  }
  if (state.store) return { type: "leaveStore" };
  const c = state.c;
  if (c.wp / c.maxWP < 0.5 && c.potions > 0) return { type: "drinkPotion" };
  if (c.wp / c.maxWP < 0.5 && c.rations >= 1) return { type: "camp" };
  if (floorHasNoDots(state.floor) || explorationBudgetExceeded) {
    const dir = dirTowardExit(state) || nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
    return { type: "move", dir };
  }
  const dir = nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
  return { type: "move", dir };
}
```
Both `tools/tune-difficulty.mjs` and `tools/tune-economy.mjs` should `import { decideAction, ... } from "./lib/tuning-bot.mjs"` instead of each keeping its own copy (RESEARCH Open Question 1 recommendation: extract, don't duplicate).

**Runtime budget guard (Pitfall 4)** — copy the existing safety-stop constant pattern:
```javascript
const MAX_ACTIONS = 20000; // tools/tune-difficulty.mjs line 29 — hard safety stop
```
Consider lowering per-run budget or backgrounding with the `EXIT=` sentinel precedent (per `18-06-SUMMARY.md`) since D-05 policies make bots survive longer.

---

### `mazeworld.html` — Settings version line + long-press dev field (component, event-driven)

**Analog:** existing `#mw-settings-rows` row markup, e.g. the Haptics row (lines 1222-1228):
```html
<div class="mw-settings-row">
  <span class="mw-settings-label">Haptics</span>
  <div class="mw-settings-options" data-setting="haptics">
    <button type="button" class="mw-settings-opt" data-value="true">On</button>
    <button type="button" class="mw-settings-opt" data-value="false">Off</button>
  </div>
</div>
```
**Pattern to copy for the NEW version-line row** — same `.mw-settings-row` wrapper shape, but with a plain text span (no `data-setting` options group) plus a hidden depth-input field revealed by long-press:
```html
<div class="mw-settings-row" id="mw-settings-version-row">
  <span class="mw-settings-label" id="mw-settings-version">v0.0.0</span>
  <!-- dev-only field, hidden by default; revealed via long-press handler -->
  <input type="number" id="mw-dev-start-depth" hidden min="1" />
</div>
```
**No reusable long-press helper exists** (Pitfall 6) — `src/browser/controls.js#classifyPointerGesture` is maze-viewport-specific (tap-vs-drag thresholds tuned for D-pad movement) and explicitly leaves long-press unbound. Write a small standalone handler local to this element:
```javascript
let pressTimer = null;
document.getElementById("mw-settings-version")?.addEventListener("pointerdown", () => {
  pressTimer = setTimeout(() => {
    document.getElementById("mw-dev-start-depth").hidden = false;
  }, 1200);
});
["pointerup", "pointercancel"].forEach((ev) =>
  document.getElementById("mw-settings-version")?.addEventListener(ev, () => clearTimeout(pressTimer))
);
```
**Existing settings-row click-delegation pattern** to mirror for wiring (line 5562):
```javascript
document.getElementById("mw-settings-rows")?.addEventListener("click", async (e) => { /* ... */ });
```

---

### `src/browser/engineAdapter.js` (provider/service, request-response)

**Analog:** itself, `startNewRun` (lines 271-281) and `recordBest`/`persistGrave` call sites (lines 181-259).

**Current `startNewRun`:**
```javascript
export async function startNewRun(seed) {
  if (currentState) {
    await recordBest(currentState.floor.depth);
  }
  const safeSeed = Number.isInteger(seed) ? seed : Date.now();
  const exclude = await readRecentNames();
  const state = initRun(safeSeed, exclude);
  persist();
  return state;
}
```
**Pattern to copy for `startDepth` threading + `dev` exclusion:**
```javascript
export async function startNewRun(seed, { startDepth } = {}) {
  if (currentState && !currentState.dev) {          // NEW: don't record a dev run's depth as "best"
    await recordBest(currentState.floor.depth);
  }
  const safeSeed = Number.isInteger(seed) ? seed : Date.now();
  const exclude = await readRecentNames();
  const state = initRun(safeSeed, exclude, { startDepth }); // thread through to newRun
  persist();
  return state;
}
```
**`dispatch()`'s death-handling gate to mirror** (line ~355-360, `if (diedEvent) track(persistGrave(...))`):
```javascript
if (diedEvent && !currentState.dev) track(persistGrave(currentState, diedEvent.cause)); // NEW: exclude dev runs from graveyard
```
`initRun(seed, exclude = [])` (line 137) needs its own 3rd-arg passthrough to `engine/state.js#newRun`'s new `options` param.

---

### `docs/DIFFICULTY-RETUNE.md` (NEW) (doc/ledger, batch)

**Analog:** `docs/PARLEY-REBALANCE.md` (Phase 20's ledger) — read its section structure (BEFORE readout → change table with rationale per knob → AFTER readout) and mirror it exactly; this phase's D-11 explicitly names this precedent. Also mirror `content/BESTIARY-REBALANCE.md`'s ledger format if `PARLEY-REBALANCE.md` is thinner than needed.

---

## Shared Patterns

### Depth-based scaling — always route through `difficultyCurve`
**Source:** `engine/difficulty.js`
**Apply to:** `startCombat`, `foeAbilities.js`, any future depth-scaled combat term.
Never inline a second depth formula in a consumer — `difficultyCurve(depth)` is the single source of truth (D-01). Call it once per consumer function, it's pure/0-rng so calling unconditionally is always safe.

### Zero-new-draw scaling on fixture-exposed paths
**Source:** `engine/combat.js#startCombat`'s existing `d4`/`d4` short-circuit comment (lines 128-131) and D-02/D-17/D-19.
**Apply to:** any new arithmetic added to `startCombat`, `foeAbilities.js`. Any new rng draw on a path a parity/determinism fixture exercises breaks the suite — new scaling must be purely arithmetic on values already drawn, gated to be a no-op at depth<=5/level 1.

### New serialized top-level field → 3-place carve-out
**Source:** `engine/saveState.js` (`dead`/`won` boolean coercion) + `test/parity/harness/comparables.js` (top-level destructure strip) — precedent set by `party`/`pendingJoiner`/`pendingFind`.
**Apply to:** `state.dev`. Every new top-level field needs: (1) explicit line in `validateSave` AND `rehydrate` (both build from a whitelist, no spread), (2) strip in ALL THREE `*Comparable()` fns, (3) default-false-when-absent via `!!obj.field`.

### "DELIBERATE RULES CHANGE" comment blocks
**Source:** referenced throughout `engine/combat.js` (e.g. line ~356) and `engine/difficulty.js`'s own header comments.
**Apply to:** every constant/behavior change site in this retune — mark why the number was chosen and what it replaces, feeding directly into the `docs/DIFFICULTY-RETUNE.md` change table.

### Tuning tools stay proxies, never CI gates
**Source:** both tools' own file-header comments (`tools/tune-difficulty.mjs`, `tools/tune-economy.mjs`).
**Apply to:** `tools/lib/tuning-bot.mjs` and both consumers — dev-only, not `node:test` files, never wired into `npm test`.

## No Analog Found

None — every file in scope extends an existing, already-read seam in this codebase. The two genuinely-new UI elements (Settings version line, long-press handler) have a structural analog (`.mw-settings-row` markup) even though no long-press gesture precedent exists to reuse (documented above under Pitfall 6 / the `mazeworld.html` pattern assignment).

## Metadata

**Analog search scope:** `engine/`, `tools/`, `test/parity/harness/`, `test/determinism/`, `src/browser/`, `mazeworld.html`, `docs/`
**Files scanned:** `engine/difficulty.js`, `engine/combat.js`, `engine/foeAbilities.js`, `engine/state.js`, `engine/saveState.js`, `test/parity/harness/comparables.js`, `tools/tune-difficulty.mjs`, `mazeworld.html`, `src/browser/engineAdapter.js`
**Pattern extraction date:** 2026-09-14
