# Phase 20: Parley Balance & Language System - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 9 (5 modified engine/browser files, 4 test/tooling files, several test files extended)
**Analogs found:** 9 / 9 (this phase edits files in place; every "analog" is the CURRENT version of the same function/file, since this is a rules-rewrite phase, not a new-feature phase)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `engine/combat.js` (`canParley`, `parley` rewrite) | service (rules engine) | request-response (pure fn over `state`) | itself, current `canParley`/`parley` (lines 602-672) — this is an in-place rewrite | exact |
| `engine/combat.js` (`killFoe` → call `killSpFor`) | service | request-response | itself, current `killFoe` (lines 450-465) | exact |
| `engine/combat.js` (`foeTurn` insulted `+1`) | service | request-response | itself, current `foeTurn` to-hit lines (1199-1223) + existing `Agility`/`foeToHitPenalty` precedent | exact |
| `engine/derived.js` (`fluency(c)`, `killSpFor(c,f,roll)` — new pure helpers) | utility (pure leaf helper) | transform | `resistRoll(rng, intel)` (lines 414-444) — same file, same "single shared pure helper, JSDoc explains WHY this file avoids an import cycle" pattern | exact |
| `src/browser/eventNarration.js` (2 new entries, 1 changed) | component (narration map) | transform (event → string) | existing `parleyRolled`/`parleyRefused`/`parleyFailed` entries (lines 182-190), same file | exact |
| `mazeworld.html` classic `canParley()`/`fluency()` duplicate (~L4200) | controller (classic non-module script) | request-response | itself, current classic `canParley()` (L4200) + DR8 comment (L3738) documenting the duplicate-maintenance pattern | exact |
| `test/parity/harness/comparables.js` (`stripParleyDivergence`, scenario-scoped) | utility (test harness stripper) | transform | `stripRationsField(c)` (lines 298-314) — the precedent for a DELIBERATE PERMANENT divergence stripper with the exact same JSDoc rationale shape | exact |
| `test/parity/combat-parity.test.js` (local `comparable()`, parley scenario) | test | request-response | itself, its own local `comparable()` (line 89) + existing `scenario.name === "parley"` branch (line 192) | exact |
| `test/parity/full-suite.test.js` (combat scenario loop) | test | request-response | itself, `combatComparable(engineState)` call inside the `for (const scenario of COMBAT_FIXTURE.scenarios)` loop (lines 114-133) | exact |
| `test/parity/FIXTURE-INVENTORY.md` (before/after table) | config/doc | transform | Phase 18's 18-06 before/after readout precedent (`.planning/phases/18-.../18-06-SUMMARY.md`) | role-match |
| `tools/tune-difficulty.mjs` (readout extension) | utility (dev tool) | batch | itself, existing `canParley(state)` import + parley-preferring bot policy (lines 27, 130-133) | exact |
| `test/unit/combat.test.js` (extend gate-matrix + parley tests, new fluency/clamp/exhausted/insulted tests) | test | request-response | itself, existing `canParley`/`parley` test block (lines 782-839) | exact |

## Pattern Assignments

### `engine/derived.js` — new `fluency(c)` and `killSpFor(c, f, roll)`

**Analog:** `resistRoll(rng, intel)` at `engine/derived.js:440-444`, preceded by its JSDoc block at lines 414-439.

**Why this is the analog:** it is the most recent precedent in this exact file for "a pure, cycle-free, dependency-light helper extracted so two call sites in different modules stay structurally in sync," with a JSDoc block that explicitly states WHY it lives in `derived.js` and not `combat.js`/`magic.js` (avoiding an import cycle). Use the identical JSDoc shape for `fluency`/`killSpFor`.

**Core pattern to copy** (`engine/derived.js:440-444`):
```javascript
export function resistRoll(rng, intel) {
  if ((intel ?? 0) < 12) return { rolled: false, resisted: false, roll: undefined };
  const roll = rng.d(20);
  return { rolled: true, resisted: roll < intel, roll };
}
```

**Apply as** (per RESEARCH.md's already-verified formulas — copy these verbatim, they were checked against `killFoe`'s current inline formula at `engine/combat.js:461-465`):
```javascript
export function killSpFor(c, f, roll) {
  const R = RACES[c.race];
  const raw = roll * f.lvl;
  const mul = 5 * (R.spMul || 1) * (c.sub === "Barbarian" ? 0.5 : 1) * (c.sub === "Apprentice" && c.level < 3 ? 2 : 1);
  return Math.round(raw * mul);
}

export function fluency(c) {
  return (skill(c, "Language") ? 1 : 0) + (eff(c, "tongue") > 0 ? 1 : 0);
}
```
`RACES` is already imported in `derived.js` context (verify import at top of file — `skill`/`eff` are already defined in this same file at lines 34+, confirm no re-import needed since they're local functions).

**`killFoe` call-site change** (`engine/combat.js:461-465`, CURRENT code to replace):
```javascript
const roll = rng.d(6);
const raw = roll * f.lvl;
const R = RACES[c.race];
const mul = 5 * (R.spMul || 1) * (c.sub === "Barbarian" ? 0.5 : 1) * (c.sub === "Apprentice" && c.level < 3 ? 2 : 1);
const gained = Math.round(raw * mul);
```
becomes:
```javascript
const roll = rng.d(6);
const gained = killSpFor(c, f, roll);
```
Same draw, same die, same order — `killFoe`'s own draw/result must stay byte-identical (D-01 constraint, verified by every combat fixture).

---

### `engine/combat.js` — `canParley` / `parley` rewrite

**Analog:** the current `canParley` (`engine/combat.js:602-623`) and `parley` (`engine/combat.js:630-672`) — this is an in-place rewrite of the SAME functions, not a copy from elsewhere. The DELIBERATE RULES CHANGE comment block precedent at lines 610-616 (the Phase 15 Helm-of-Knowledge wiring note) is the exact comment style to extend/replace for D-09/D-10/D-11's fluency change.

**Current `canParley`** (engine/combat.js:602-623, to be replaced per D-05/D-11/D-12 — exact target code is in RESEARCH.md lines 216-241, verified against this file):
```javascript
export function canParley(state) {
  if (!state.combat) return false;
  const c = state.c;
  const t = state.combat.type;
  if (t === "Walking Dead" || t === "Magical") return false;
  if (c.sub === "Con Artist") return true;
  if (c.sub === "Woodsman" && (t === "Beasts" || t === "Lair Beasts")) return true;
  if (c.sub === "Bard" && t === "Humans") return true;
  if ((skill(c, "Language") || eff(c, "tongue") > 0) && TALKATIVE.includes(t)) return true;
  if (c.race === "Wilmsry" && t !== "Magical") return true;
  if (c.race === "Elven" && t === "Humans") return true;
  return false;
}
```
Rewrite inserts `if (state.combat.parleyTried) return false;` (D-05), replaces the `t === "Magical"` unconditional deny with `fluency(c) < 2` gating (D-11), and widens the fluency branch's `talkable` array to include `"Magical"` at `flu >= 2`. Use RESEARCH.md's verified "AFTER" block (lines 224-240) as the literal target — it was traced against this exact file's Wilmsry/Elven branch ordering, confirming D-12's dead-branch-reachable behavior falls out correctly.

**Current `parley`** (engine/combat.js:630-672) — key lines to change:
- Line 642-645 (`wilmsryVsMagical` refusal): keep, but it now only fires because `canParley` lets a fluency-2 Wilmsry reach `Magical` (D-12) — do NOT set `C.parleyTried` on this branch (refusal, not an attempt).
- Line 646-652 (`bonus` calc): `Con Artist ? 6 : 0` → `Con Artist ? 4 : 0` (D-07); add `+ 2 * fluency(c)` (D-10).
- Line 654 (`need = 9 + bonus`): becomes `need = Math.min(9 + bonus, 17)` (D-08 clamp).
- Line 655 (`parleyRolled` push): add `fluency: flu` field (D-14 annotation support).
- Line 657 (`sp` formula, `× 2.5` literal): replace with `killSpFor`-summed `combatEquivalent × 0.5` (D-01/D-02) — see RESEARCH.md "Payout" code block (lines 256-271), already checked against this exact line.
- Line 660 (`rng.d(6) >= 4` wilmst check): → `rng.d(6) === 6` (D-03).
- Before line 653's draw: add `if (C.parleyTried) return events;` early-out (no push, D-05 says exhausted retry gets `parleyExhausted` event — this early-out belongs ahead of the `canParley` re-check, since `canParley` itself will already be false once tried, making the Parley button disappear; the explicit `parleyExhausted` push is for a directly-dispatched action bypassing the button).
- After line 655/656 (before returning): set `C.parleyTried = true` (D-05) — must happen AFTER the `wilmsryVsMagical` refusal check, BEFORE the `rng.d(20)` roll.
- Line 669 (`parleyFailed` push): add `C.parleyInsulted = true;` and `events.push({ type: "parleyInsulted" });` right after (D-06), before `afterPlayerAction(...)`.

---

### `engine/combat.js` — `foeTurn` insulted `+1`

**Analog:** the file's OWN existing precedent two lines above each insertion point — `if (f.blind) need = 1;` / `if (C.foeToHitPenalty) need = Math.min(need, C.foeToHitPenalty);` (member branch: `engine/combat.js:1200-1201`; hero branch: `engine/combat.js:1222-1223`). This is the exact "adjust `need`/`mNeed`, never `roll`" pattern the phase must follow (RESEARCH.md Pitfall 4).

**Current code, member branch** (`engine/combat.js:1199-1201`):
```javascript
let mNeed = foeToHitVs(state);
if (f.blind) mNeed = 1;
if (C.foeToHitPenalty) mNeed = Math.min(mNeed, C.foeToHitPenalty);
```
Add immediately after: `if (C.parleyInsulted) mNeed += 1;`

**Current code, hero branch** (`engine/combat.js:1221-1223`):
```javascript
let need = foeToHitVs(state);
if (f.blind) need = 1;
if (C.foeToHitPenalty) need = Math.min(need, C.foeToHitPenalty);
```
Add immediately after: `if (C.parleyInsulted) need += 1;`

Zero extra draws — purely arithmetic on the already-computed threshold, matching the two existing lines directly above each insertion point.

---

### `src/browser/eventNarration.js` — new/changed entries

**Analog:** the existing three parley entries in the SAME file (`src/browser/eventNarration.js:182-190`):
```javascript
parleyRefused: () => `<span class="miss">Not this time, not with them.</span>`,
parleyRolled: (e) => `Talk it down: <span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}.`,
parleyFailed: () => `<span class="miss">They are not buying it.</span>`,
```

**Apply:**
- `parleyRolled` gains the fluency annotation (D-14: "need 15 (+2 tongue)") — extend the template literal to append `${e.fluency ? ` (+${e.fluency*2} tongue)` : ""}` after the `need` value, keeping the exact `<span class="roll">` wrapping convention.
- Add `parleyInsulted: () => `<span class="miss">That went over about as well as you'd expect.</span>`,` (exact wording is Claude's Discretion per D-14/CONTEXT.md — keep the family-friendly, sarcastic voice matching `parleyFailed`'s tone).
- Add `parleyExhausted: () => `<span class="miss">You already tried talking. They're done listening.</span>`,` (same tone/wrapping convention).
- Both new entries MUST land in the `EVENT_NARRATION` map object (same object `parleyRefused` etc. live in) so the coverage-guard test (`test/unit/formatEventsCoverage.test.js`) and the voice safety-scan (`test/voice/safety-scan.test.js`) pick them up automatically — no separate registration needed, confirmed by RESEARCH.md's Phase Requirements → Test Map.

---

### `mazeworld.html` classic `canParley()` duplicate

**Analog:** itself — the CURRENT classic `canParley()` at `mazeworld.html:4200` and the DR8 comment block at `mazeworld.html:3738` explaining WHY this duplicate exists and must be hand-kept-in-sync (this is the established pattern for `songReady`/`canRead`/`canCast` too, per that same comment).

**Current call sites that depend on this function** (all confirmed present, do not change their shape):
- `mazeworld.html:4981` — `(canParley() ? `<button id="a-talk">5 · Parley</button>` : "")`
- `mazeworld.html:5337` — `else if (k === "5" && canParley()) { e.preventDefault(); window.mzParley?.(); }`
- `mazeworld.html:6261` — `window.mzParley = () => engineCombatAction("parley");` (this is the REAL dispatcher — the classic `parley()` at `mazeworld.html:4214-4215` is confirmed dead code per the DR8 comment, do not need to update it for correctness, optional hygiene only).

**Apply:** mirror the exact `fluency()` + `canParley()` rewrite shown in RESEARCH.md lines 300-322 (already traced against these three call sites) — reads `S.combat`/`S.c` directly (classic script scope, no ES module `import`), same logical branches as the `engine/combat.js` rewrite (`parleyTried` gate, `flu < 2` Magical gate, widened `talkable` array).

---

### `test/parity/harness/comparables.js` — new scenario-scoped `stripParleyDivergence`

**Analog:** `stripRationsField(c)` at `test/parity/harness/comparables.js:298-314` — the established precedent for a DELIBERATE PERMANENT (not temporary/migratory) gameplay divergence stripper, used inside `economyComparable`. Same JSDoc shape required: cite the requirement ID, explain WHY this is deliberate (not a fidelity bug), name the exact fields stripped, and note which OTHER comparables/fixtures stay untouched.

**Current code to copy the shape of** (`test/parity/harness/comparables.js:310-314`):
```javascript
function stripRationsField(c) {
  if (!c || !("rations" in c)) return c;
  const { rations, ...rest } = c;
  return rest;
}
```

**Apply as** (scenario-scoped, NOT unconditional — RESEARCH.md Pitfall 2 is explicit that `combatComparable` is shared with the magic fixture and must not blind that comparison):
```javascript
/** stripParleyDivergence(state) — PARLEY-01..04 (Phase 20, D-13) deliberately
 * changes parley's SP/gold payout formula and adds two new combat-scoped
 * flags (C.parleyTried/C.parleyInsulted). Applied ONLY to the combat
 * fixture's "parley" scenario (seed 303) — every other combat scenario, the
 * magic fixture, and prototype-master.js.txt stay byte-identical. Mirrors
 * stripRationsField's "deliberate permanent divergence" shape above. */
export function stripParleyDivergence(state) {
  const rest = { ...state };
  if (rest.c) {
    const { sp, gold, ...c } = rest.c;
    rest.c = c;
  }
  if (rest.combat) {
    const { parleyTried, parleyInsulted, ...combat } = rest.combat;
    rest.combat = combat;
  }
  return rest;
}
```
Export it. Both call sites below must apply it — combining with `combatComparable(state)` — ONLY when `scenario.name === "parley"`.

---

### `test/parity/combat-parity.test.js` — local `comparable()`, parley scenario

**Analog:** itself — the file's own local `comparable()` (`test/parity/combat-parity.test.js:89`) and existing `scenario.name === "parley"` branch (`test/parity/combat-parity.test.js:192-193`, currently asserting `engineState.combat === null` after a successful parley).

**Apply:** wrap the comparison for the parley scenario's actions with `stripParleyDivergence` before diffing, e.g. `diffState(stripParleyDivergence(comparable(ctx.S)), stripParleyDivergence(comparable(engineState)))` — but ONLY inside the `scenario.name === "parley"` branch; every other scenario keeps calling bare `comparable(...)`.

---

### `test/parity/full-suite.test.js` — combat scenario loop

**Analog:** itself — `test/parity/full-suite.test.js:114-133`, the `for (const scenario of COMBAT_FIXTURE.scenarios)` loop currently calling bare `combatComparable(ctx.S)` / `combatComparable(engineState)` at lines 118 and 129, unconditionally for every scenario including `parley`.

**Apply (Pitfall 2, mandatory):** inside this SAME loop, branch on `scenario.name === "parley"` and apply `stripParleyDivergence` on top of `combatComparable(...)` for that scenario only — the magic-fixture loop at lines 135-155 reuses `combatComparable` too and must NOT get the strip (it never hits the parley scenario, but do not make the strip unconditional inside `combatComparable` itself — keep it as a separate wrapper call in the combat loop, per RESEARCH.md's explicit warning).

---

### `test/unit/combat.test.js` — extend gate-matrix + parley tests

**Analog:** itself — the existing block at `test/unit/combat.test.js:782-839` (`canParley` gate-matrix test at 782, Con Artist success at 801, failure→foe-turn at 814, LO-03 zero-foe guard at 832), using the file's own `fixedState`/`fixedFoe`/`fixedCombat`/`fakeRng` fixtures.

**New assertions to add in the same style:**
- Extend the gate-matrix test (line 782) with fluency-tier cases (skill only, Helm only, both, neither) × TALKATIVE types, and the now-reachable Wilmsry-vs-Magical-at-fluency-2 case (D-12) — asserting `canParley` returns `true` for the gate but `parley()` refuses without setting `parleyTried`.
- New test: `parleyTried` gate rejects a second attempt with a `parleyExhausted` event and zero rng draws (`fakeRng([])`), mirroring the LO-03 test's `fakeRng([])` pattern at line 836.
- New test: a failed parley sets `C.parleyInsulted` and the NEXT `foeTurn` call's `need`/`mNeed` reflects `+1` — reuse `fakeRng` sequencing exactly like the existing failure test at line 814-825.
- New test: Con Artist `need = 13` at even level vs solo foe (D-07: `4 + level - top = 4` → `9+4=13`), and a stacked-bonus clamp test asserting `need` never exceeds 17 (D-08) regardless of combined sub/race/fluency bonuses.
- Update the EXISTING Con Artist success test (line 801-812) — its bonus/need/sp numbers (`6`→`15`, `sp=8`) are now WRONG under the new formulas; recompute using D-07's `+4` and D-01/D-02's `killSpFor×0.5`, matching the seed-303 table's methodology in RESEARCH.md's Seed-303 section (re-derive with `fakeRng`'s scripted values, don't literally reuse seed 303's numbers since this is a synthetic `fixedFoe`, not the real fixture).

## Shared Patterns

### Deliberate-divergence documentation
**Source:** `test/parity/harness/comparables.js:298-309` (stripRationsField JSDoc), `engine/combat.js:610-616` (Phase 15 Helm-of-Knowledge DELIBERATE RULES CHANGE comment)
**Apply to:** every rewritten formula/gate in `engine/combat.js` (the `× 2.5` → `× 0.5` swap, the `d6>=4` → `d6===6` swap, the `Con Artist +6` → `+4` swap) AND the new `stripParleyDivergence` — each needs an inline comment naming the requirement ID (PARLEY-01/02/03/04, LANG-01/02), stating this is deliberate not a regression, and citing the CONTEXT.md decision ID (D-01..D-21).

### "Adjust the threshold, never the roll" (D-06/Pitfall 4)
**Source:** `engine/combat.js:1200-1201`, `1222-1223` (`f.blind`/`foeToHitPenalty` precedent)
**Apply to:** the new `C.parleyInsulted` check in `foeTurn` — MUST be `need += 1` / `mNeed += 1`, never a mutation of the drawn `roll`, to stay consistent with every other to-hit modifier in this function and keep narrated `roll` values matching the literal die result.

### Dual test-file coverage for parity carve-outs (Pitfall 2)
**Source:** `test/parity/combat-parity.test.js` (local `comparable()`) vs `test/parity/full-suite.test.js` (shared `combatComparable`)
**Apply to:** `stripParleyDivergence` — must be wired into BOTH files' comparison calls for the `parley` scenario, or `npm test`'s full-suite run stays red even after `combat-parity.test.js` alone passes.

### Single source of truth for a gate + its bonus term (D-09/D-10)
**Source:** `engine/derived.js`'s existing leaf-helper pattern (`resistRoll`, `intelBonus`)
**Apply to:** `fluency(c)` — called from BOTH `canParley`'s availability gate and `parley`'s `bonus` sum (and mirrored into `mazeworld.html`'s classic duplicate) so skill/Helm fluency is never balanced twice, per the phase's own stated principle.

## No Analog Found

None — every file in this phase's scope is an in-place edit to an existing, already-read function/file, or a direct extension of an existing test file using existing fixtures. No wholly new module is created.

## Metadata

**Analog search scope:** `engine/combat.js`, `engine/derived.js`, `src/browser/eventNarration.js`, `mazeworld.html`, `test/parity/harness/comparables.js`, `test/parity/combat-parity.test.js`, `test/parity/full-suite.test.js`, `test/unit/combat.test.js`, `tools/tune-difficulty.mjs`
**Files scanned:** 9 (all read directly this session, line numbers verified against current source, not RESEARCH.md's cached claims alone)
**Pattern extraction date:** 2026-09-14
