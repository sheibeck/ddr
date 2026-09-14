# Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 17 (5 new, 12 modified)
**Analogs found:** 17 / 17 (RESEARCH.md already pinned exact insertion points/line numbers for every engine file; this document adds the concrete copy-from excerpts for content, tests, narration, and parity strippers)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `content/foe-abilities.js` (new) | config/data | transform (pure lookup table) | `content/spells.js` (`SPELLS[]`) | exact |
| `engine/foeAbilities.js` (new) | service/resolver | event-driven | `engine/foeDamage.js` (`damageFoe` seam) + `engine/magic.js` (`castSpell` effect switch) | exact (composite) |
| `test/determinism/foe-abilities.test.js` (new) | test | request-response (replay) | `test/determinism/*.test.js` (existing suite) | exact |
| `test/unit/foe-abilities.test.js` (new) | test | CRUD/event-driven | `test/unit/foe-damage.test.js` (fakeRng style) + `test/unit/party-combat.test.js` (`pickFoeTarget` fixtures) | exact |
| `test/unit/save-validation.test.js` (v1.0 round-trip case, new test) | test | file-I/O (serialize/deserialize) | existing inline-synthetic-save tests in same file | exact |
| `content/bestiary.js` (modified) | config/data | transform | itself (add `abilities: [ids]` to 7 entries) | exact |
| `content/index.js` (modified) | config/data | transform (barrel) | itself (add one `export *`) | exact |
| `engine/combat.js` (modified) | service/controller | event-driven | itself (`foeTurn`, `startCombat`, `flee`, `endCombat`, `applyFoeDamageToPlayer`, `playerStrike`) | exact |
| `engine/magic.js` (modified) | service | event-driven | itself (`castSpell`'s inline resist block, refactor call site only) | exact |
| `engine/derived.js` (modified) | utility | transform | itself (`conditionsOf`, `toHit`) — new `resistRoll` leaf export | exact |
| `engine/saveState.js` (modified) | service | file-I/O | itself (`rehydrate`'s `combat: null` reset line) | exact |
| `test/parity/harness/comparables.js` (modified) | test/utility | transform | itself (`stripDarkForField`/`stripFlightFields`/`stripFoeDamageClosures` family) | exact |
| `src/browser/eventNarration.js` (modified) | presentation | transform | itself (`EVENT_NARRATION` map — `allyJoined`, `struckByFoe`, `spellResisted`, `foeFled`) | exact |
| `mazeworld.html` (`CONDITION_COPY`/`paintConditions`, modified) | presentation | transform | itself (existing `affliction`/`phobia` special-case branches) | exact |
| `test/unit/foe-turn-draw-count.test.js` (modified) | test | request-response (draw-count pins) | itself (`countingRng` pattern) | exact |
| `test/unit/conditions.test.js` (modified) | test | transform | itself (existing condition-entry assertions) | exact |
| `test/unit/content-tables.test.js` (modified) | test | transform | itself (existing bestiary/spell shape assertions) | exact |

## Pattern Assignments

### `content/foe-abilities.js` (config/data, transform)

**Analog:** `content/spells.js` (`SPELLS[]`, pure-data array, no functions — enforced by `content-is-pure-data.test.js`)

**Core pattern** — flat array of plain-object descriptors, dice as `{n, sides, bonus}` notation (never a closure), a `txt` flavor string per entry, referenced by id (mirrors how `content/bestiary.js` entries reference spell names, not spell objects):

```js
// content/foe-abilities.js — full shape confirmed workable in RESEARCH.md Code Examples
export const FOE_ABILITIES = [
  { id: "krupkeFreeze",  kind: "bolt",   lvl: 1, dmg: { n: 1, sides: 6, bonus: 0 }, txt: "a chill spreads from an outstretched hand" },
  { id: "krupkeWeaken",  kind: "debuff", lvl: 1, effect: "weakened", txt: "your grip loosens, mid-swing" },
  { id: "drudgeFireball", kind: "bolt",  lvl: 3, dmg: { n: 2, sides: 10, bonus: 4 }, txt: "a wordless gesture, and the air catches fire" },
  { id: "drudgeLightning", kind: "bolt", lvl: 4, dmg: { n: 1, sides: 10, bonus: 6 }, txt: "a crack of ozone and light" },
  { id: "drakeBreath",   kind: "bolt",   lvl: 4, dmg: { n: 2, sides: 10, bonus: 4 }, every: 4, txt: "the Drake inhales, and you remember you are flammable" },
  { id: "vampireDrain",  kind: "drain",  lvl: 5, dmg: { n: 2, sides: 6, bonus: 0 }, txt: "cold fingers close, and something is taken" },
  { id: "vampireSummon", kind: "summon", lvl: 5, effect: { type: "Walking Dead", tier: 2 }, txt: "the Vampire gestures, unbothered, and the dead oblige" },
  { id: "stalkaHeal",    kind: "heal",   lvl: 5, dmg: { n: 1, sides: 10, bonus: 0 }, txt: "wounds knit themselves shut, unimpressed" },
  // + Djinni bolt(s)/daze debuff with `uses: 4`
];
```

**Existing precedent for `every`-style bounded item effects** (`content/treasure-tables.js:17,21,27,28,32`): the codebase already models "every N squares" cooldowns as a plain numeric field on a data descriptor, consumed elsewhere by engine code — `foe-abilities.js`'s `every`/`uses` fields follow the exact same "plain number on the descriptor, engine owns the countdown state" split:
```js
{ n: "Pendant of Fortitude", eff: {}, use: "half", every: 100, txt: "half damage from one attack, once every 100 squares" },
```
Also note `content/bestiary.js:42` already carries the CURRENT (pre-Phase-19) Drake shape to modify: `sp: { dmg: { n: 2, sides: 10, bonus: 4 }, every: 4, note: "breathes fire every four rounds" }` — this `sp.every` is presently unread by any engine code (CANON-02 gap); Phase 19 either wires this existing field into `f.cd` bookkeeping directly or migrates the value onto the new `drakeBreath` ability descriptor's own `every: 4` and drops it from `sp` — planner's call, but the number (4) is already canon-confirmed in content.

---

### `engine/foeAbilities.js` (new resolver, event-driven)

**Analogs:** `engine/foeDamage.js` (seam-only pure function style) + `engine/magic.js#castSpell` (effect-kind switch + resist block) + `engine/combat.js` (`pickFoeTarget`, `applyFoeDamageToPlayer`, `downMember`, the `c.pendingAlly → C.ally` join)

RESEARCH.md's Pattern 1–4 and "Code Examples" section already contain a complete, line-cited resolver skeleton (`firstReadyAbility`, `tickAbilityCooldowns`, `resolveFoeAbility`) — copy that skeleton verbatim as the starting point; do not re-derive it. Key excerpts to carry over:

**The deferred-join precedent to mirror for `C.pendingFoes`** (`engine/combat.js:169-172`):
```js
if (c.pendingAlly) {
  state.combat.ally = c.pendingAlly;
  c.pendingAlly = null;
  events.push({ type: "allyJoined", name: state.combat.ally.name });
}
```
Summon resolution follows this shape exactly but targets an array (`C.pendingFoes`) instead of a single slot, and the drain-to-`C.foes` happens at the TOP of the NEXT `foeTurn` call (not inside the current one) — see RESEARCH.md Pattern 1's exact code block.

**The fled-without-XP precedent** (`content/bestiary.js`'s Knight/Con-Artist branches, `engine/combat.js:213-221`, and `engine/magic.js:298-302`) — reuse this exact two-line shape for Djinni's flee-at-low-HP exit:
```js
f.alive = false; f.fled = true;
events.push({ type: "foeFled", name: f.name /* + reason */ });
```
`foeFled` already has an `EVENT_NARRATION` entry (`src/browser/eventNarration.js:136`) — no new event type needed for this call site.

**Imports** — mirror `engine/magic.js`'s import block style (named imports from sibling engine modules + content barrel):
```js
import { FOE_ABILITIES, BESTIARY } from "../content/index.js";
import { rollDice } from "./dice.js";
import { resistRoll } from "./derived.js";
import { pickFoeTarget, applyFoeDamageToPlayer, downMember } from "./combat.js";
```
Note: `downMember` (currently module-private in `combat.js`, line ~820) must gain an `export` keyword — zero-behavior-change visibility change only.

---

### `engine/combat.js` (modified — `foeTurn`, `startCombat`, `flee`, `endCombat`, `applyFoeDamageToPlayer`, `playerStrike`)

**Analog:** itself — every insertion point is pinned to an exact line range in RESEARCH.md Patterns 1, 2, 5, 6. Copy those code blocks directly:
- Ability-attempt gate inserted in `foeTurn`, between the `f.asleep` check and the `swings` computation (RESEARCH.md Pattern 1, ~line 1023).
- `C.pendingFoes` drain at the very top of `foeTurn`, before the `c.regen` check (RESEARCH.md Pattern 1, lines 231-252) — same placement style as the `startCombat` `c.pendingAlly` join above.
- `applyFoeDamageToPlayer` additive `ignoresArmor`/`ability`/`applied` extension (RESEARCH.md Pattern 2) — existing callers (`struckByFoe` path) untouched.
- `c.foeEffect` weakened-halving inserted immediately before `damageFoe(...)` in `playerStrike`, mirroring the EXISTING foe-side halving already in this same file:
```js
// existing foe-side precedent, combat.js ~1069 — mirror for the hero-side debuff
if (C.weakened) dmg = Math.ceil(dmg / 2);
```
- `c.foeEffect` tick alongside the existing ward/mirror tick at the end of `foeTurn` (RESEARCH.md Pattern 5).
- `endCombat`'s existing unconditional reset block (already resets `c.regen`/`c.ward`/`c.mirror`/`c.senses`) gains one more line, `state.c.foeEffect = null;`, in the same style.
- `flee()`'s four success exits each gain a `spectrePursuitStrike(...)` call before `endCombat` (RESEARCH.md Pattern 6) — mirror the existing `if (hit.died) return events;` short-circuit already used at combat.js:1073 for the analogous "died mid-swing" case.

---

### `engine/magic.js` (modified — `castSpell`'s resist block)

**Analog:** itself, refactored in place. Current inline block (magic.js:88-100) becomes a call to the relocated `resistRoll` (now homed in `engine/derived.js` per D-17/RESEARCH.md Pattern 4, NOT `magic.js`, to avoid the `combat.js ↔ foeAbilities.js ↔ magic.js` import cycle). RESEARCH.md Pattern 4 has the exact before/after code — copy verbatim; the refactor must be draw-neutral (same single `rng.d(20)`, same event names `spellResisted`/`resistFailed`).

---

### `engine/derived.js` (modified — new `resistRoll` export, `conditionsOf`, `toHit`)

**Analog:** itself. `resistRoll(rng, intel)` is a new dependency-free leaf export alongside existing pure helpers (`intelBonus`, `armorSoak`). `conditionsOf` gains one more `out.push(...)` line following its existing pattern (RESEARCH.md Pattern 5):
```js
if (c.foeEffect && c.foeEffect.rounds > 0) {
  out.push({ key: "foeEffect", polarity: "bad", kind: c.foeEffect.kind, remaining: c.foeEffect.rounds });
}
```
`toHit` gains the dazed penalty right after its existing `h += eff(c, "toHit");` line (RESEARCH.md Pattern 5).

---

### `engine/saveState.js` (modified — `rehydrate`)

**Analog:** itself — the existing unconditional `combat: null` reset line in `rehydrate()` gains a sibling reset, `state.c.foeEffect = null;`, same defensive-load style (never trust a mid-combat-only field to survive a save/load round trip — RESEARCH.md Pitfall 5).

---

### `test/parity/harness/comparables.js` (modified — new strip helpers)

**Analog:** the `stripDarkForField` / `stripFlightFields` / `stripBagField` / `stripFoeDamageClosures` family already in this file. Copy this exact shape and JSDoc convention for each new carve-out:

```js
// existing precedent to mirror (comparables.js:63-67)
function stripDarkForField(c) {
  if (!c || !("darkFor" in c)) return c;
  const { darkFor, ...rest } = c;
  return rest;
}
```
```js
// existing per-foe-array precedent to mirror (comparables.js:158-...)
export function stripFoeDamageClosures(combat) {
  if (!combat || !Array.isArray(combat.foes)) return combat;
  const foes = combat.foes.map((f) => {
    const next = { ...f };
    // strip the un-comparable field(s) per foe, e.g. f.abilities/f.cd/f.uses if needed
    return next;
  });
  return { ...combat, foes };
}
```
New strippers needed (per RESEARCH.md D-14/FID-04): a `c.foeEffect` carve-out (mirrors `stripDarkForField`'s single-field pattern) wired into ALL THREE `*Comparable()` functions' existing `stripNameField(stripFlightFields(stripDarkForField(stripBagField(...))))` composition chains (movementComparable:150, combatComparable:191, economyComparable:288); a `combat.pendingFoes` carve-out mirroring `stripFoeDamageClosures`'s "operate on the `combat` object, strip an array-shaped engine-only field" style, wired into `combatComparable`'s existing `rest.combat = stripFoeDamageClosures(combatRest);` line (comparables.js:189); and per-foe `abilities`/`cd`/`uses` field strips folded into `stripFoeDamageClosures`'s existing per-foe `.map()` (since it already produces a shallow-copied foe object).

---

### `src/browser/eventNarration.js` (modified — 8-11 new entries)

**Analog:** itself — the existing map's per-entry style (arrow function returning an HTML-flavored template string, using `e.field ?? fallback` for every interpolated value, `<span class="roll">`/`<span class="hurt">`/`<span class="hit">`/`<span class="beat">` classes for roll/damage/positive/neutral beats respectively):

```js
// existing precedents to mirror exactly
allyJoined: (e) => `<span class="hit">${e.name ?? "An ally"} falls in beside you.</span>`,
foeFled: (e) => `<span class="hit">${e.name ?? "It"} thinks better of it and leaves.</span>`,
struckByFoe: (e) =>
  `<span class="roll">${e.roll ?? "?"}</span> vs ${e.need ?? "?"}. ${e.critical ? '<span class="hurt">Critical!</span> ' : ""}${e.name ?? "It"} hits you for <span class="hurt">${e.dmg ?? 0} hp</span>.`,
spellResisted: (e) => `${e.target ?? "It"} shrugs it off. <span class="roll">${e.roll ?? "?"}</span> vs intel ${e.intel ?? "?"}.`,
resistFailed: (e) => `${e.target ?? "It"} tries to resist and fails. <span class="roll">${e.roll ?? "?"}</span>.`,
```
New entries follow this same shape: `foeCast`, `foeBolted` (or reuse `struckByFoe` + an `ability` field), `foeDrained`, `foeDebuffed`, `foeHealed`, `foeSummoned`, `foeEffectFaded`, `heroResisted`, `heroResistFailed` (mirror `spellResisted`/`resistFailed` but hero-as-subject), `foePursued`, `foeOutOfSpells`. Remember: `test/unit/formatEventsCoverage.test.js` derives its coverage list from source, so every emitted `type` needs a matching key here or the coverage guard fails — and `test/voice/safety-scan.test.js`'s Corpus 3 needs a new `FOE_ABILITIES.forEach((a) => push(a.txt))`-style line (it does NOT auto-discover new content modules — RESEARCH.md Pitfall 7).

---

### `mazeworld.html` (`CONDITION_COPY`/`paintConditions`, modified)

**Analog:** itself — the existing `affliction`/`phobia` special-case branches in `paintConditions()` (~line 2786-2817). RESEARCH.md Pattern 5 has the exact patch:
```js
let label = cn.key === "affliction" ? (cn.kind || "Afflicted")
  : cn.key === "phobia" ? `Phobia: ${cn.phobia || "Fear"}`
  : cn.key === "foeEffect" ? (FOE_EFFECT_LABEL[cn.kind] || cn.kind)   // NEW
  : (CONDITION_COPY[cn.key]?.label || cn.key);
// where: const FOE_EFFECT_LABEL = { weakened: "Weakened", dazed: "Dazed" };
```
This is a REQUIRED edit (D-21) — the engine-side `conditionsOf` test alone will not catch a missing label (RESEARCH.md Pitfall 6).

---

### Test files (new/modified)

**`test/unit/foe-abilities.test.js`** — analog `test/unit/foe-damage.test.js`'s "seam-only invariant" style (construct a minimal state, a `fakeRng` with scripted return values, assert on the resulting event list and state deltas) combined with `test/unit/party-combat.test.js`'s `fixedFighter`/`fixedFloor`/party-member fixture-building helpers for the D-13 member-path cases.

**`test/determinism/foe-abilities.test.js`** — analog: the existing `test/determinism/*.test.js` suite's shape (pinned seed → run full encounter → assert replayed events/state are byte-identical on a second run with the same seed). Force the five encounter types named in D-15 (Magical/Demons/Walking Dead/Humans-tier-2/Beasts-tier-5).

**`test/unit/foe-turn-draw-count.test.js`** (modified) — analog: itself, `countingRng` pattern (an rng wrapper that counts draws instead of returning real values) — add cases pinning zero-extra-draws for ability-less foes and the exact per-caster draw counts for casters with exhausted kits (RESEARCH.md Pitfall 3).

**`test/unit/save-validation.test.js`** (new v1.0 fixture case) — analog: itself's existing inline-synthetic-save-object test pattern (no dedicated v1.0 JSON fixture file exists today — build the v1.0-shaped object inline, as prior tests in this file already do) — assert `rehydrate`/`validateSave` tolerate the ABSENCE of `abilities`/`cd`/`uses`/`c.foeEffect`/`combat.pendingFoes` and default them correctly (FID-04).

**`test/unit/conditions.test.js`** (modified) — analog: itself's existing per-condition assertion style — add one case for the `foeEffect` chip shape (`{key:"foeEffect", polarity:"bad", kind, remaining}`).

**`test/unit/content-tables.test.js`** (modified) — analog: itself's existing bestiary/spell shape-validation assertions — add assertions that every id in a bestiary entry's `abilities: [...]` array resolves to a real `FOE_ABILITIES` entry, and that `content-is-pure-data.test.js` picks up the new module via the barrel with zero extra wiring.

## Shared Patterns

### Zero-draw structural gate
**Source:** `engine/combat.js` (`f.acid`, `f.asleep`, `C.allies` — all gated on field PRESENCE, not a flag check)
**Apply to:** `engine/foeAbilities.js`'s entire ability-attempt block in `foeTurn` — `f.abilities` absent on every pre-Phase-19 bestiary entry must short-circuit with EXACTLY zero rng draws (FID-02 pins depend on this).

### Deferred-join queue
**Source:** `engine/combat.js:169-172` (`c.pendingAlly → C.ally`)
**Apply to:** `C.pendingFoes → C.foes` (summon kind) — queue at cast time, drain at the START of the next `foeTurn`, never mid-loop (RESEARCH.md Pitfall 4).

### Fled-without-XP exit
**Source:** `content/bestiary.js` Knight/Con-Artist branches + `engine/combat.js:213-221` + `engine/magic.js:298-302` (`f.alive=false; f.fled=true; events.push({type:"foeFled",...})`)
**Apply to:** Djinni's low-HP flee — reuses the EXISTING `foeFled` event type, no new narration entry required for this specific call site.

### Named parity carve-outs
**Source:** `test/parity/harness/comparables.js`'s `stripDarkForField`/`stripFlightFields`/`stripBagField`/`stripFoeDamageClosures` family
**Apply to:** every new serialized field (`f.abilities`/`f.cd`/`f.uses`, `c.foeEffect`, `combat.pendingFoes`) — must be threaded into all three `*Comparable()` functions' existing strip-composition chains, never left uncovered.

### EVENT_NARRATION coverage + safety-scan discovery
**Source:** `src/browser/eventNarration.js` (map completeness enforced by `test/unit/formatEventsCoverage.test.js`) and `test/voice/safety-scan.test.js`'s `collectAuthoredStrings()` (enumerates named content banks, does NOT auto-discover new modules)
**Apply to:** every new event type from D-16, AND a new explicit `FOE_ABILITIES.forEach(...)` line added to the safety-scan's Corpus 3 (RESEARCH.md Pitfall 7 — easy to silently miss).

## No Analog Found

None — RESEARCH.md's direct-code-read confidence is HIGH for every file in scope; every mechanic this phase needs (zero-draw gates, deferred-join queues, fled-without-XP exits, a shared hero-damage pipeline, named parity strippers) already has an in-repo precedent cited above.

## Metadata

**Analog search scope:** `engine/*.js`, `content/*.js`, `src/browser/eventNarration.js`, `test/parity/harness/comparables.js`, `test/unit/*.js`, `test/determinism/*.js`, `mazeworld.html` (chip renderer only)
**Files scanned:** 12 read/grepped directly this session (`engine/combat.js`, `test/parity/harness/comparables.js`, `src/browser/eventNarration.js`, `content/treasure-tables.js`, `content/bestiary.js`, `content/index.js`, `content/spells.js`, `content/skills.js`, `content/flavor.js`, `content/epitaphs.js`, `content/safety-wordlist.js`) plus the full RESEARCH.md (already containing direct-read excerpts for every `engine/*.js` file in scope)
**Pattern extraction date:** 2026-09-13
