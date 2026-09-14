# Phase 20: Parley Balance & Language System - Research

**Researched:** 2026-09-14
**Domain:** Deterministic engine rules balancing (combat sub-system: parley payout/odds/failure-cost) + a small pure derived-stat helper (fluency) — no new libraries, no new UI.
**Confidence:** HIGH (every claim below is grounded in a direct read of the current source and/or an actual run of the current engine against the fixture seed; nothing in this phase depends on external documentation or a library that could drift)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Payout & Combat-Equivalent (PARLEY-01)**
- **D-01:** "Combat-equivalent value" = the exact `killFoe` SP formula per live foe, summed: `Σ round(d6 × f.lvl × 5 × raceSpMul × subMul)`. Extract it into ONE shared pure helper (e.g. `killSpFor(c, f, roll)` in `engine/derived.js` or a combat-local helper) that BOTH `killFoe` and `parley` call, so the ≤ relationship is structural. `killFoe`'s own draw/result must stay byte-identical (every combat fixture pins it).
- **D-02:** SP payout ratio stays **0.5×** the combat-equivalent (canon "half the skill points"), now computed as `round(combatEquivalent × 0.5)` rather than the literal `× 2.5`. Test: parley payout ≤ combat-equivalent for every roll (property-style over all d6 values / foe levels).
- **D-03:** Humans wilmst bonus fires on **`d6 === 6`** (~17%, down from `d6 >= 4` = 50%). The amount formula `d6 × 100 × depth` is untouched (economy owns the number; Phase 21 may retune).
- **D-04:** Draw shape unchanged: one `d6` per live foe for SP, then one `d6` wilmst check, then one more `d6` only if it fires. Only VALUES diverge from the prototype, never the rng stream position for a given outcome.

**Cost of Failure & Con Artist Odds (PARLEY-02, PARLEY-03)**
- **D-05:** **One parley attempt per encounter.** New serialized combat flag `C.parleyTried` (set true on any attempt, success or failure; initialised false/absent at `startCombat`). `canParley` returns false once tried → the Parley button disappears and a re-sent `parley` action is rejected with a `parleyExhausted` event (no rng draw). Plus, on failure, the foes still get their free turn via `afterPlayerAction` (as today).
- **D-06:** Aggro on failure: a failed parley marks the group **insulted** — new serialized flag `C.parleyInsulted = true`; while set, every foe to-hit roll in `foeTurn` gets **+1** for the rest of the fight (applied as post-draw arithmetic on the existing roll — zero extra draws). Emits `parleyInsulted` (narrated). Cleared with the combat object at `endCombat`.
- **D-07:** Con Artist parley bonus **+6 → +4**. Documented target: **~60% success at even level vs a solo foe** (need = 9 + 4 + level − top = 13 → 13/20 = 65% at even level; ~60% once a typical +1 top-foe gap is included). Still the best talker in the game; the level-1 pre-fight talkdown is untouched.
- **D-08:** Sub + race bonuses stack as canon (Con Artist Wilmsry ≈ 4+4 = +8 → need 17 at even level), but `need` is **clamped to ≤ 17** (85% ceiling) so no combination is an auto-win. Clamp is arithmetic on `need` only (no draw change).

**Language as Fluency (LANG-01, LANG-02)**
- **D-09:** New pure helper `fluency(c)` in `engine/derived.js`: **0** = neither; **1** = Language skill OR Helm of Knowledge (`eff(c,"tongue") > 0`); **2** = both. Single source of truth for BOTH the availability gate and the bonus term. `skill()`/`eff()` reads only — no rng, no mutation. Data keys `Language` / `tongue` are NOT renamed.
- **D-10:** Bonus term (Option B): `+2 × fluency(c)` added into the same `bonus` sum (skill alone +2, Helm alone +2, both +4), before the D-08 clamp. The prior "Language OR Helm" boolean gate line in `canParley` is replaced by the fluency read.
- **D-11:** Encounter types opened by fluency: **fluency ≥ 1** → the existing TALKATIVE set (Humans, Demons, Lair Beasts, Beasts); **fluency 2** → additionally **Magical** ("perfect fluency in one language"). **Walking Dead never parley** for anyone (rulebook line stands). Availability test matrix: every race × sub × {no skill, skill} × {no Helm, Helm} × encounter type.
- **D-12 (PARLEY-04):** The dead `parleyRefused wilmsryVsMagical` branch is **made reachable, not deleted**: a Wilmsry with fluency 2 passes `canParley` for Magical (D-11), and `parley()` then refuses with the canon grudge line ("Magic Users hate the Wilmsry. There is nothing to discuss.") — no rng draw, and it does NOT consume the D-05 attempt (it is a refusal, not an attempt). Every `canParley` gate — including this one — gets explicit test coverage.

**Parity Divergence, Feedback & Tuning Proof**
- **D-13:** Deliberate divergence handled as a **scenario-scoped carve-out**: a named stripper (e.g. `stripParleyDivergence`) applied ONLY to the combat fixture's `parley` scenario, removing `c.sp`, `c.gold`, and the new `C.parleyTried` / `C.parleyInsulted` flags from the comparison. Everything else in that scenario stays compared (the `canParley` gate, `combatEnded`, the prototype's draw shape). `test/parity/FIXTURE-INVENTORY.md` gains a before/after table for seed 303 (need 19 → 17 after D-07/D-08; sp 13 → new value; gold 200 → new value/none) with rationale. The other four combat scenarios, all other fixtures, `prototype-master.js.txt`, and the FID-02 draw pins stay byte-identical; the fixture-inventory pin is unchanged (roster didn't move).
- **D-14:** New narrated events (each with an `EVENT_NARRATION` line in the game's voice, family-friendly): `parleyInsulted` (failure aggro), `parleyExhausted` (retry refused / button gone), and the `parleyRolled` line now shows the fluency contribution when non-zero (e.g. "need 15 (+2 tongue)"). The success line reflects the reduced wilmst odds. `parleyRefused` keeps its canon text.
- **D-15:** Tuning proof: extend `tools/tune-difficulty.mjs`'s bot to REPORT parley attempts / successes / SP-from-parley share per run, and commit a before/after readout (informational, like 18-06). **No dial or economy-number changes in this phase** — Phase 21 owns the one consolidated retune.
- **D-16:** Con Artist's pre-fight `lvl ≤ 1` talkdown in `startCombat` is untouched (identity + fixture-exposed at seed 303; its `d6` draws stay exactly where they are). It is NOT gated by the one-attempt flag and does not scale with fluency.

### Claude's Discretion
- Exact home of the shared kill-SP helper (derived.js leaf vs. combat-local) — must not create an import cycle and must keep `killFoe`'s draw and result byte-identical.
- Whether `C.parleyTried` / `C.parleyInsulted` are initialised explicitly in `startCombat` or lazily on first write (either way: absent/false must be indistinguishable in the comparables carve-out and in save validation — old saves must load).
- Exact wording of the new narration lines and the fluency annotation format.
- Test file layout (extend `test/unit/combat.test.js` vs. a new `test/unit/parley.test.js`).

### Deferred Ideas (OUT OF SCOPE)
- Retuning the Humans wilmst bonus AMOUNT and any difficulty-dial consequence of parley being less lucrative → Phase 21 (consolidated retune).
- Non-parley uses of fluency (reading tablets/signs, comprehension flavor) → out of scope; note for a future content phase.
- "Can't flee for a round after insulting them" alternative aggro → not chosen; revisit only if the +1 to-hit proves invisible in play.
- Party members contributing to parley (a Bard member, etc.) → v2 party depth.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARLEY-01 | Successful parley pays XP ≤ combat-equivalent (no longer 2.5×); Humans wilmst odds tuned here | D-01/D-02 formula extraction design (`killSpFor`) below; seed-303 before/after table; property-test guidance |
| PARLEY-02 | Real cost of failure — per-encounter cap and/or aggro | D-05/D-06 exact flag placement in `parley()`/`foeTurn()`; ordering vs. D-12's refusal (must NOT consume the attempt) |
| PARLEY-03 | Con Artist odds retuned to a stated target | D-07/D-08 bonus/clamp arithmetic verified against the seed-303 character; 65%/60% math checked |
| PARLEY-04 | Dead `parleyRefused wilmsryVsMagical` branch made reachable, every gate tested | Exact `canParley()` rewrite (Magical gate moved behind `fluency(c) < 2`) that makes the branch reachable without touching the Wilmsry racial line |
| LANG-01 | Language skill + Helm `tongue` feed the SAME parley bonus term | `fluency(c)` helper design (D-09/D-10), placement in `engine/derived.js`, no import cycle |
| LANG-02 | Fluency widens talkable types; availability test per race/class/skill/Helm | `canParley()` rewrite; test matrix guidance; **mazeworld.html's classic duplicate `canParley()` must be updated too** (see Pitfall 1 below) — this is the biggest non-obvious finding of this research |
</phase_requirements>

## Summary

This is a pure engine-rules-balancing phase: no new libraries, no new files of consequence beyond a couple of test files and one doc table. Every mechanic touched already exists and is fully read in this research pass — `engine/combat.js`'s `canParley`/`parley`/`foeTurn`/`killFoe`/`startCombat`, `engine/derived.js`'s leaf helpers, the parity harness's comparable functions, and `mazeworld.html`'s button-gating. The work is almost entirely arithmetic and control-flow surgery on functions that are already read end-to-end below, plus two genuinely new pure helpers (`fluency(c)`, `killSpFor(c, f, roll)`) that belong in `engine/derived.js` (confirmed cycle-free: `derived.js` imports nothing from `combat.js` or `foeAbilities.js` today).

The single most important non-obvious finding: **`mazeworld.html` maintains its own hand-duplicated copy of `canParley()`** (line ~4200, reading `S.combat`/`S.c` directly) that is explicitly documented as NOT dead code (DR8 comment, line ~3738) — it is what `renderEncounter()` actually calls to decide whether to render the `5 · Parley` button. `engine/combat.js`'s `canParley(state)` is a *separate* implementation used by `engine/engine.js`'s dispatcher (indirectly, since `parley()` calls it) and by `tools/tune-difficulty.mjs`'s bot. **Both copies must be updated identically** — the fluency widening, the `C.parleyTried` gate, and the Magical-only-at-fluency-2 change all need to land in both places, or the button will show/hide inconsistently with what the engine actually accepts. This is not covered explicitly by CONTEXT.md's grounding facts and must be a task in the plan.

The second non-obvious finding: **the "parley" scenario's `c.sp`/`c.gold` divergence is exercised by TWO test files, not one.** `test/parity/combat-parity.test.js` keeps its own local `comparable()` (as CONTEXT.md notes), but `test/parity/full-suite.test.js` (the phase-gate test) replays the *same* `action-script.combat.json` fixture — including the `parley` scenario — through the *shared* `combatComparable` in `test/parity/harness/comparables.js`. A scenario-scoped stripper added only to `combat-parity.test.js`'s local `comparable()` will leave `full-suite.test.js` red. The stripper (or a scenario-aware wrapper around `combatComparable`) must be applied at both call sites.

Both the exact "before" draw sequence for the seed-303 parley fixture and the exact "after" values (computed from the locked D-01..D-08/D-03 formulas) are captured below with full provenance, so the planner can write the FIXTURE-INVENTORY.md table and the parity carve-out without re-deriving anything.

**Primary recommendation:** Extract `killSpFor(c, f, roll)` and add `fluency(c)` to `engine/derived.js`; rewrite `canParley`/`parley` in `engine/combat.js` per the exact code shown below; mirror both functions' logic into `mazeworld.html`'s classic duplicate `canParley()`; add the D-06 insulted `+1` as arithmetic on `need`/`mNeed` in `foeTurn` (not on the drawn `roll`, to match the file's own established pattern — see Pitfall 4); add a scenario-scoped stripper used by both `combat-parity.test.js` and `full-suite.test.js`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parley payout formula (SP/gold) | Engine (`engine/combat.js`) | Content data (`content/races.js` spMul) | Pure rules computation; no UI/DB involvement |
| Parley odds / bonus / clamp | Engine (`engine/combat.js`) | — | Same function, same tier |
| Fluency derivation | Engine leaf (`engine/derived.js`) | Content data (`content/skills.js`, `content/treasure-tables.js`) | Pure read of `c.skills`/`c.items`; must stay a dependency-free leaf to avoid an import cycle with `combat.js`/`foeAbilities.js` |
| Failure-cost flags (`parleyTried`/`parleyInsulted`) | Engine (`engine/combat.js` state mutation on `state.combat`) | — | Combat-scoped, transient (never persisted — see Pitfall 3) |
| Button visibility (Parley button shown/hidden) | Presentation (`mazeworld.html`'s classic `canParley()` duplicate) | Engine (`engine/combat.js`'s `canParley(state)`, the authoritative copy) | **Two independent implementations exist today; both must move together (Pitfall 1)** |
| Narration | Presentation (`src/browser/eventNarration.js`) | Engine (event `type` literals) | Existing `EVENT_NARRATION` + coverage-guard pattern |
| Tuning readout | Dev tooling (`tools/tune-difficulty.mjs`) | Engine (`canParley`, `applyAction`) | Informational only, not a gate (D-15/D-16 precedent) |
| Parity safety | Test harness (`test/parity/harness/comparables.js`, two `*.test.js` files) | — | Must be updated in **both** the shared harness AND the local `combat-parity.test.js` comparable (Pitfall 2) |

## Standard Stack

No new libraries. This phase touches only existing, already-vetted engine/content/test files:

| File | Role this phase |
|------|------------------|
| `engine/combat.js` | `canParley`, `parley`, `foeTurn` (insulted `+1`), `startCombat` (flag init, discretionary) — all rewritten in place |
| `engine/derived.js` | New `fluency(c)` and `killSpFor(c, f, roll)` pure helpers |
| `mazeworld.html` | Classic `canParley()` duplicate (line ~4200) updated to mirror the engine; button already renders conditionally |
| `src/browser/eventNarration.js` | 2 new entries (`parleyInsulted`, `parleyExhausted`), 1 changed entry (`parleyRolled`) |
| `test/parity/harness/comparables.js` | New scenario-scoped stripper, exported for reuse |
| `test/parity/combat-parity.test.js` | Local `comparable()` updated to apply the stripper for the `parley` scenario only |
| `test/parity/full-suite.test.js` | Combat-scenario loop updated to apply the SAME stripper for the `parley` scenario only |
| `test/parity/FIXTURE-INVENTORY.md` | New before/after table for seed 303 |
| `tools/tune-difficulty.mjs` | New parley-attempt/success/SP-share tally in the readout |

## Package Legitimacy Audit

Not applicable — this phase installs no new npm packages. Every file touched already exists in the repository; `package.json` dependencies are unchanged.

## Architecture Patterns

### System Flow: a parley attempt, start to finish

```
Player taps "5 · Parley" (mazeworld.html #a-talk button)
        │  (only rendered because the CLASSIC canParley() duplicate,
        │   reading S.combat/S.c directly, returned true)
        ▼
window.mzParley() → engineCombatAction("parley")
        │  (dispatches {type:"parley"} through engineAdapter.js)
        ▼
engine/engine.js#applyAction
        │  1. validateAction (generic shape check only — "parley" carries
        │     no extra fields, so this never rejects an eligibility case)
        │  2. structuredClone(state) → next
        │  3. rng = makeRng(next.rngState)
        ▼
engine/combat.js#parley(next, rng, events)
        │
        ├─ if C.parleyTried  ───────────────► push "parleyExhausted", return
        │                                      (0 draws — D-05 retry rejection)
        │
        ├─ if !canParley(state) ───────────► return silently (0 events)
        │                                      (existing behavior: never-eligible
        │                                       sub/race/type — button was never shown)
        │
        ├─ compute top = max(liveFoes.lvl)
        ├─ if Wilmsry && Magical ──────────► push "parleyRefused" (reason:
        │                                      wilmsryVsMagical), return
        │                                      (0 draws, does NOT set parleyTried —
        │                                       D-12, now reachable via fluency-2)
        │
        ├─ C.parleyTried = true   (D-05: the ONE attempt is now spent)
        ├─ flu = fluency(c)       (engine/derived.js — pure read)
        ├─ bonus = subclass/race/level/top terms + 2×flu
        ├─ need = min(9 + bonus, 17)   (D-08 clamp)
        ├─ roll = rng.d(20)
        ├─ push "parleyRolled" {roll, need, fluency: flu}
        │
        ├─ roll <= need? ──YES──► combatEquivalent = Σ killSpFor(c, f, rng.d(6))
        │                          sp = round(combatEquivalent * 0.5)
        │                          c.sp += sp; push "spGained"
        │                          if Humans && rng.d(6) === 6:
        │                            gold = rng.d(6)*100*depth; push "goldGained"
        │                          checkLevel(); endCombat()  ← nulls state.combat
        │                          (parleyTried/parleyInsulted vanish WITH it)
        │
        └─ roll > need? ───NO───► push "parleyFailed"
                                   C.parleyInsulted = true   (D-06)
                                   push "parleyInsulted"
                                   afterPlayerAction(state, rng, events)
                                     └─ foeTurn(state, rng, events)
                                          └─ every hero/member to-hit check:
                                             need/mNeed += 1 if C.parleyInsulted
                                             (post-draw arithmetic, 0 extra draws)
        ▼
engine/engine.js persists next.rngState, returns {state: next, events}
        ▼
engineAdapter.js syncs `S = next` → mazeworld.html re-renders
        │  (classic canParley() duplicate now reads S.combat.parleyTried
        │   and returns false → button disappears, D-05 satisfied)
```

### Recommended helper placement

```
engine/derived.js  (leaf — no combat.js/foeAbilities.js import; safe home)
  ├─ export function fluency(c) { ... }        // D-09
  └─ export function killSpFor(c, f, roll) { ... }  // D-01 (discretionary home,
                                                       // recommended here to sit
                                                       // beside fluency and every
                                                       // other pure c-scoped helper)

engine/combat.js
  ├─ import { ..., fluency, killSpFor } from "./derived.js";
  ├─ killFoe(...)   — now calls killSpFor(c, f, roll) instead of inlining the formula
  ├─ canParley(...) — rewritten (Magical gate moved behind fluency<2; TALKATIVE
  │                    widened to include Magical at fluency===2)
  └─ parley(...)    — rewritten per the flow above
```

### Code Examples

**`killSpFor` extraction (D-01) — behavior-preserving, `killFoe` must stay byte-identical:**
```js
// engine/derived.js
export function killSpFor(c, f, roll) {
  const R = RACES[c.race];
  const raw = roll * f.lvl;
  const mul = 5 * (R.spMul || 1) * (c.sub === "Barbarian" ? 0.5 : 1) * (c.sub === "Apprentice" && c.level < 3 ? 2 : 1);
  return Math.round(raw * mul);
}
```
```js
// engine/combat.js killFoe() — the ONLY change: inline formula → helper call.
// `roll` is still drawn at the exact same call site, same die, same order.
const roll = rng.d(6);
const gained = killSpFor(c, f, roll); // was: Math.round(roll * f.lvl * mul) inline
```

**`fluency` (D-09):**
```js
// engine/derived.js
export function fluency(c) {
  return (skill(c, "Language") ? 1 : 0) + (eff(c, "tongue") > 0 ? 1 : 0);
}
```

**`canParley` rewrite (D-11/D-12) — the exact minimal diff that makes the dead branch reachable:**
```js
// BEFORE:
if (t === "Walking Dead" || t === "Magical") return false;
// ...
if ((skill(c, "Language") || eff(c, "tongue") > 0) && TALKATIVE.includes(t)) return true;

// AFTER:
if (!state.combat) return false;
if (state.combat.parleyTried) return false;               // D-05
if (t === "Walking Dead") return false;                     // unconditional, canon
const flu = fluency(c);
if (t === "Magical" && flu < 2) return false;                // D-11: only full fluency opens Magical
// ... (Con Artist / Woodsman / Bard checks unchanged) ...
const talkable = flu >= 2 ? [...TALKATIVE, "Magical"] : TALKATIVE;
if (flu >= 1 && talkable.includes(t)) return true;
if (c.race === "Wilmsry" && t !== "Magical") return true;   // UNCHANGED — still excludes
                                                              // Magical; this is exactly why
                                                              // a Wilmsry with fluency 2 reaches
                                                              // Magical via the FLUENCY branch
                                                              // above, not this racial branch —
                                                              // and parley() then refuses it
                                                              // canon-flavor (D-12).
if (c.race === "Elven" && t === "Humans") return true;
return false;
```
Trace for D-12's exact scenario (Wilmsry, fluency 2, vs Magical, sub not Con Artist/Woodsman/Bard): the top `Magical`-gate no longer returns false (flu===2); Con Artist/Woodsman/Bard checks don't apply; the fluency branch's `talkable` array includes `"Magical"` and `flu>=1` is true → **returns `true`**. `parley()`'s explicit `if (c.race === "Wilmsry" && C.type === "Magical")` check then fires before any draw, pushes `parleyRefused`, and returns without setting `C.parleyTried` — exactly D-12's contract.

**Bonus/need arithmetic (D-07/D-08/D-10):**
```js
const bonus =
  (c.sub === "Con Artist" ? 4 : 0) +           // D-07: was 6
  (c.sub === "Woodsman" ? 3 : 0) +
  (c.race === "Wilmsry" ? 4 : 0) +
  (c.race === "Elven" && C.type === "Humans" ? 3 : 0) +
  2 * fluency(c) +                              // D-10
  c.level - top;
const need = Math.min(9 + bonus, 17);           // D-08 clamp
```

**Payout (D-01/D-02/D-03):**
```js
if (roll <= need) {
  const combatEquivalent = liveFoes(state).reduce((sum, f) => sum + killSpFor(c, f, rng.d(6)), 0);
  const sp = Math.round(combatEquivalent * 0.5);   // D-02
  c.sp += sp;
  events.push({ type: "spGained", amount: sp, reason: "parley" });
  if (C.type === "Humans" && rng.d(6) === 6) {      // D-03: was >= 4
    const wm = rng.d(6) * 100 * state.floor.depth;
    c.gold += wm;
    events.push({ type: "goldGained", amount: wm, why: "parley" });
  }
  checkLevel(state, rng, events);
  endCombat(state, events);
  return events;
}
```

**Failure/insult (D-05/D-06):**
```js
events.push({ type: "parleyFailed" });
C.parleyInsulted = true;
events.push({ type: "parleyInsulted" });
afterPlayerAction(state, rng, events);
return events;
```

**`foeTurn` insulted `+1` — TWO call sites (hero swing AND member swing):**
```js
// member branch (foeTurn, ~line 1199):
let mNeed = foeToHitVs(state);
if (f.blind) mNeed = 1;
if (C.foeToHitPenalty) mNeed = Math.min(mNeed, C.foeToHitPenalty);
if (C.parleyInsulted) mNeed += 1;              // NEW — D-06, post-draw arithmetic, 0 draws

// hero branch (foeTurn, ~line 1221):
let need = foeToHitVs(state);
if (f.blind) need = 1;
if (C.foeToHitPenalty) need = Math.min(need, C.foeToHitPenalty);
if (C.parleyInsulted) need += 1;               // NEW — same placement, same reasoning
```
See Pitfall 4 for why `need += 1` (not `roll -= 1`) is the recommended reading of D-06's "+1 to the to-hit roll."

**mazeworld.html's classic `canParley()` duplicate — MUST mirror the engine (Pitfall 1):**
```js
// mazeworld.html, ~line 4200 (classic, non-module scope; reads S directly)
function fluency() {
  return (skill("Language") ? 1 : 0) + (eff("tongue") > 0 ? 1 : 0);
}
function canParley() {
  if (!S.combat) return false;
  const C = S.combat;
  if (C.parleyTried) return false;                       // D-05
  const t = C.type;
  if (t === "Walking Dead") return false;
  const flu = fluency();
  if (t === "Magical" && flu < 2) return false;           // D-11
  if (S.c.sub === "Con Artist") return true;
  if (S.c.sub === "Woodsman" && (t === "Beasts" || t === "Lair Beasts")) return true;
  if (S.c.sub === "Bard" && t === "Humans") return true;
  const talkable = flu >= 2 ? [...TALKATIVE, "Magical"] : TALKATIVE;
  if (flu >= 1 && talkable.includes(t)) return true;
  if (S.c.race === "Wilmsry" && t !== "Magical") return true;
  if (S.c.race === "Elven" && t === "Humans") return true;
  return false;
}
```
The classic `parley()` duplicate at ~line 4214 is confirmed **dead code** (DR8 comment, unreachable from the live UI — `window.mzParley` is what actually fires). It does not need to change for correctness, but consider updating it too for documentation consistency (low priority, non-load-bearing).

### Anti-Patterns to Avoid
- **Editing only `engine/combat.js`'s `canParley`:** the button-visibility gate in `mazeworld.html` will silently drift out of sync (Pitfall 1) — the button would show/hide based on stale logic even though the dispatched action behaves correctly (or vice versa).
- **Adding the scenario-scoped stripper to only one test file:** `full-suite.test.js` independently replays the same fixture through the shared `combatComparable` (Pitfall 2) and will fail if the stripper isn't applied there too.
- **Persisting `C.parleyTried`/`C.parleyInsulted` handling into `saveState.js`:** unnecessary — `state.combat` is unconditionally nulled on every load (both `validateSave` and `rehydrate` — see Pitfall 3), so these flags can never survive a save/load round-trip regardless.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Combat-equivalent SP math | A second, parallel SP formula inside `parley()` | The extracted `killSpFor(c, f, roll)` helper, called by both `killFoe` and `parley` | D-01's whole point: the ≤ relationship between parley and combat payout must be *structural* (same formula), not two formulas someone has to remember to keep proportional |
| Fluency gate | Inline `skill(c,"Language") || eff(c,"tongue")>0` scattered in two places (canParley's gate AND the bonus term) | The single `fluency(c)` helper (D-09) | Exactly the "don't balance it twice" instruction in the phase boundary — one function, two call sites, always in sync |
| Save-compatibility handling for the two new combat flags | A `saveState.js` migration/strip function | Nothing — `state.combat` is already unconditionally nulled on every load path | Confirmed by direct read (Pitfall 3); adding migration code here would be pure, unneeded ceremony |

**Key insight:** every "don't hand-roll" item in this phase is really the same principle stated three ways: this phase's whole purpose is to stop two independently-tuned numbers (parley vs. kill SP; skill vs. Helm fluency) from silently drifting apart. Any implementation that reintroduces a second formula/gate defeats the phase's own goal even if it happens to produce correct numbers today.

## Common Pitfalls

### Pitfall 1: mazeworld.html's classic `canParley()` duplicate is NOT dead code
**What goes wrong:** A plan that only touches `engine/combat.js` will make the *engine* reject/accept parley correctly, but the Parley button's visibility (rendered by `renderEncounter()` calling the classic, non-module `canParley()` at mazeworld.html ~line 4200) will not reflect the new rules — e.g., the button could stay visible after the one attempt is spent (D-05), or never appear for a fluency-2 Wilmsry vs. Magical (D-11/D-12).
**Why it happens:** Phase 4's DR8 pass deliberately left a *second*, hand-maintained copy of `canParley`/`songReady`/`canRead`/`canCast` in the classic (non-module) script block, because that code runs synchronously in the same render tick and can't easily `await` an ES module import. This is a known, intentional, documented pattern in this codebase (see the comment at mazeworld.html ~3718-3741) — not a bug to "fix" by unifying the two, just a duplicate that must be updated in lockstep.
**How to avoid:** Update `mazeworld.html`'s classic `canParley()` (not the dead `parley()` beside it) with the exact same fluency/parleyTried logic as `engine/combat.js`'s `canParley`, in the same commit/task. Verify with a manual/DR-style check that the button disappears after one attempt and appears for a fluency-2 Wilmsry facing Magical.
**Warning signs:** A `grep -n "function canParley" mazeworld.html engine/combat.js` returning two hits is the standing signal this pair must be kept in sync; a future phase touching parley eligibility should re-check both.

### Pitfall 2: two independent parity test files replay the SAME parley fixture
**What goes wrong:** Adding the D-13 scenario-scoped stripper only to `test/parity/combat-parity.test.js`'s local `comparable()` (as CONTEXT.md's phrasing suggests) leaves `test/parity/full-suite.test.js` — the phase-gate test — red, because it independently drives `action-script.combat.json`'s `parley` scenario through the *shared* `combatComparable` from `test/parity/harness/comparables.js`, which has no such carve-out.
**Why it happens:** `combatComparable` is shared between the combat fixture AND the magic fixture (both call it in `full-suite.test.js`); a global, unconditional strip of `c.sp`/`c.gold` there would blind the magic-fixture comparison too. The strip must be conditioned on the scenario/fixture, not applied unconditionally inside `combatComparable`.
**How to avoid:** Export a named, scenario-aware wrapper from `test/parity/harness/comparables.js` (e.g. `combatComparableForScenario(state, scenarioName)` that calls `combatComparable(state)` then additionally strips `c.sp`/`c.gold`/`combat.parleyTried`/`combat.parleyInsulted` only when `scenarioName === "parley"`), and call it from BOTH `combat-parity.test.js`'s local comparable (which can wrap it, or keep its own logic in sync) AND `full-suite.test.js`'s combat-scenario loop (passing `scenario.name`).
**Warning signs:** `npm test` passing locally after editing only `combat-parity.test.js` is not sufficient evidence — always run the FULL suite (`npm test`, currently 882/882 green as of this research) before considering the phase gate met.

### Pitfall 3: no save/load migration is needed for the two new combat flags (confirmed, not a gap)
**What goes wrong:** A plan might over-engineer a `validateSave`/`rehydrate` change for `C.parleyTried`/`C.parleyInsulted`, assuming they need the same `clearFoeEffect`-style tolerance Phase 19's `c.foeEffect` needed.
**Why it happens:** Phase 19's FID-04 precedent (stripping a stale `c.foeEffect` on load) makes "new combat-scoped state needs a load-time clear" look like the default pattern.
**How to avoid:** It does not apply here. Direct read of `engine/saveState.js` confirms `rehydrate(obj)` sets `combat: null` unconditionally on EVERY load (the prototype's own `load()` never resumed mid-combat either), and `validateSave`'s returned `value` never even includes a `combat` field. Since `C.parleyTried`/`C.parleyInsulted` live on `state.combat` (not `state.c`), they are structurally impossible to persist across a save/load boundary — no migration code is needed, no test is needed beyond the existing "combat resets to null on load" coverage.
**Warning signs:** None — this is a non-issue confirmed by source read, included here so the plan doesn't spend a task on it.

### Pitfall 4: "+1 to the to-hit roll" is ambiguous between `roll` and `need`; the engine's own convention picks `need`
**What goes wrong:** D-06's wording — "every foe to-hit roll in foeTurn gets +1 ... applied as post-draw arithmetic on the existing roll" — could be read as literally mutating the drawn `roll` variable (e.g. `roll = Math.max(1, roll - 1)`, since lower rolls are better for the foe in this engine's `roll <= need` convention) rather than the `need` threshold.
**Why it happens:** Traditional tabletop language ("+1 to hit") describes a bonus to the attacker's roll; this engine encodes the identical mechanical effect as a widened `need` threshold instead (see the file's own precedent: `Agility` subtracts 1 from `need` as a hero-favorable defense bonus, `foeToHitPenalty` clamps `need` down; nothing in `foeTurn`/`derived.js` currently modifies a `roll` value post-draw for a persistent flag).
**How to avoid:** Implement as `need += 1` / `mNeed += 1` (shown in the Code Examples above), matching the two existing patterns in the exact same lines of code (`if (f.blind) need = 1;` and `if (C.foeToHitPenalty) need = Math.min(need, C.foeToHitPenalty);`), both of which adjust `need`, never `roll`. This is the internally-consistent reading and requires zero new draws either way.
**Warning signs:** If a future test asserts a specific `roll` value in an event payload for an insulted fight and it doesn't match what was drawn, that's a sign the wrong variable was mutated — `roll` in `foeMissed`/`memberStruck`/etc. events should always be the literal die result, only `need`/`mNeed` should reflect the insulted bonus.

### Pitfall 5: the wilmst-bonus draw count changes for THIS fixture, but the shape rule (D-04) is still satisfied
**What goes wrong:** A naive reading of "draw shape unchanged" might expect the exact same number of `rng.d()` calls before and after the change for seed 303's parley scenario. It is NOT the same count (4 draws before, 3 after) — this is correct, not a bug.
**Why it happens:** The wilmst-check draw at seed 303 rolled a `5`. Under the OLD rule (`>= 4`) that fires (draws a 4th die for the amount); under the NEW rule (`=== 6`, D-03) it does NOT fire, so the conditional 4th draw never happens. D-04's guarantee is about the position of a draw for a GIVEN outcome (e.g., the SP roll is always the 2nd draw, always one-per-live-foe), not about the total draw count when the outcome itself changes.
**How to avoid:** Document this explicitly in the FIXTURE-INVENTORY.md before/after table (see below) rather than treating a draw-count difference as a regression.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. No stored data, external service config, OS-registered state, or renamed secrets are involved.

## Seed-303 Fixture: Exact Before/After (for FIXTURE-INVENTORY.md)

**Character (seed 303, `newRun(303)`):** Wilmsry, Thief, sub **Con Artist**, level 1, starting `sp: 0`, `gold: 50`, skills `{Leaping, Heft, Locks}` (no `Language`), items `[Cloak of Ether]` (no `tongue` effect) → **`fluency(c) === 0`** for this character (confirmed by direct read of rolled state — `[VERIFIED: engine run, seed 303]`).

**`startCombat(false, "Humans")`:** rolls 2× Dante (Humans, lvl 1, wp 20 each); the Con Artist pre-fight talkdown (D-16, untouched) fires and one Dante flees (`foeFled reason:"conArtist"`), leaving **1 live foe** at parley time.

**Exact draw sequence at the `parley` action** (captured by instrumenting `rng.d()` against the CURRENT engine, `[VERIFIED: engine run]`):

| Draw # | Die | Value | Purpose (current code) |
|---|---|---|---|
| 1 | d20 | 2 | `parleyRolled` roll |
| 2 | d6 | 5 | per-live-foe SP roll (1 live foe) |
| 3 | d6 | 5 | Humans wilmst-bonus check |
| 4 | d6 | 2 | wilmst amount (only drawn because check #3 fired under the OLD `>=4` rule) |

| Field | BEFORE (current code, `[VERIFIED: engine run]`) | AFTER (computed from locked D-01/D-02/D-03/D-07/D-08 formulas against the SAME draws above, `[VERIFIED: computed from locked formulas]` — not yet run against implemented code; re-verify with the new unit/parity test once written) |
|---|---|---|
| `bonus` | 6 (ConArtist) + 4 (Wilmsry) + 1 (level) − 1 (top) = 10 | 4 (ConArtist, D-07) + 4 (Wilmsry) + 1 (level) − 1 (top) + 0 (fluency=0) = 8 |
| `need` | 9 + 10 = **19** | min(9 + 8, 17) = **17** (D-08 clamp is a no-op here — lands exactly at the ceiling) |
| `roll` (draw #1) | 2 | 2 (unchanged draw) |
| outcome | 2 ≤ 19 → success | 2 ≤ 17 → success (same outcome) |
| SP formula | `round(Σ(d6×lvl) × 2.5)` = `round((5×1) × 2.5)` = `round(12.5)` = **13** | `round(combatEquivalent × 0.5)` where `combatEquivalent = killSpFor(c, Dante, 5) = round(5×1 × 5×0.5×1×1) = round(12.5) = 13`; `sp = round(13 × 0.5) = round(6.5)` = **7** |
| Humans wilmst check (draw #3 = 5) | `5 >= 4` → **fires** | `5 === 6` → **does not fire** (D-03) |
| wilmst amount (draw #4) | drawn: 2 → `gold += 2×100×1` = **+200** | **not drawn** (draw #4 never happens — see Pitfall 5) |
| final `c.sp` | 0 + 13 = 13 | 0 + 7 = 7 |
| final `c.gold` | 50 + 200 = 250 | 50 + 0 = 50 |
| events emitted | `parleyRolled{roll:2,need:19}`, `spGained{amount:13}`, `goldGained{amount:200}`, `combatEnded` | `parleyRolled{roll:2,need:17,fluency:0}`, `spGained{amount:7}`, `combatEnded` (no `goldGained`) |
| `combat.parleyTried`/`parleyInsulted` | fields don't exist yet | `parleyTried:true` set transiently, but `endCombat()` nulls `state.combat` before the action returns — **neither flag is ever visible in the final compared state for this scenario** (success path only; see note below) |

**Note on the D-13 stripper for this specific fixture:** because this scenario is a *successful* parley, `state.combat` is null by the time any post-action comparison happens (both before and after this phase's changes — the prototype also nulls `S.combat` on success). The ONLY fields that actually diverge for seed 303 are `c.sp` (13→7) and `c.gold` (250→50, i.e. no wilmst payout). The `C.parleyTried`/`C.parleyInsulted` strip in the D-13 stripper is defensive/forward-looking (protects any FUTURE fixture that captures state mid-fight or after a failed attempt) rather than strictly required by this one fixture — document this nuance in the FIXTURE-INVENTORY.md table so a future reader doesn't wonder why those flags never show up in the diff.

## Common Pitfalls (continued — parity mechanics)

### Draw-count baseline (FID-02) is unaffected
`test/unit/foe-turn-draw-count.test.js`'s pinned totals (e.g. "combat/parley, seed 303, 6 attacks, 66 draws") measure a *different* scenario entirely — repeatedly calling `playerStrike()` against the 2 Dantes, never invoking `parley()` at all. Since `C.parleyInsulted` is always falsy/absent in that test (no parley ever attempted there), the new `if (C.parleyInsulted) need += 1;` line is a guaranteed no-op and these pins do not need to change. Confirmed by direct read — no `parley` reference anywhere in `test/unit/foe-turn-draw-count.test.js`.

## Code Examples (tests)

**Existing test fixtures to reuse** (from `test/unit/combat.test.js`, confirmed at lines 782-839): `fixedState`, `fixedFoe`, `fixedCombat`, `fakeRng` — a scripted rng returning a fixed sequence. The existing `canParley` gate-matrix test (line 782) and the two `parley()` behavior tests (lines 801, 814) are the natural place to extend coverage for every gate D-12 calls out, plus the LO-03 zero-foe guard (line 832) which must keep passing unchanged.

**Property-style payout test sketch (PARLEY-01/D-02):**
```js
// for every foe level 1-5 and every d6 roll 1-6, parley's payout formula
// (round(combatEquivalent * 0.5)) must never exceed combatEquivalent itself.
for (let lvl = 1; lvl <= 5; lvl++) {
  for (let roll = 1; roll <= 6; roll++) {
    const eq = killSpFor(someC, { lvl }, roll);
    const payout = Math.round(eq * 0.5);
    assert.ok(payout <= eq);
  }
}
```

**Con Artist odds test sketch (PARLEY-03/D-07):**
```js
// even level vs a solo foe (level === top): bonus = 4 (ConArtist) + level - top = 4
// need = min(9+4, 17) = 13 -> 13/20 = 65% (the "~60% once a +1 gap is typical" framing
// from D-07 is a design NOTE about typical play, not a literal 60% assertion target —
// assert the exact need=13 arithmetic, not a probability float).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Parley SP = `round(Σ(d6×lvl) × 2.5)` (a standalone formula, ~half of killFoe's own ~5x-ish payout by coincidence of the constants, not by structure) | Parley SP = `round(killSpFor-summed-combat-equivalent × 0.5)` (structurally derived from the SAME formula `killFoe` uses) | This phase (D-01/D-02) | Payout can never silently exceed the kill-equivalent again; any future bestiary/race SP retune automatically flows into parley's payout too |
| Humans wilmst bonus fires on `d6 >= 4` (50%) | Fires on `d6 === 6` (~17%) | This phase (D-03) | Removes zero-risk gold-farming via repeated Humans parleys; amount formula itself untouched (Phase 21 territory) |
| Parley retry: unlimited, zero cost | One attempt per encounter; failure applies a persistent +1-to-hit aggro debuff for the rest of the fight | This phase (D-05/D-06) | Parley becomes a real risk/reward choice instead of a free scouting action |
| `canParley`'s Language/Helm gate: boolean OR | Graduated `fluency(c)` (0/1/2) feeding BOTH the gate and the bonus term | This phase (D-09/D-10/D-11) | Single source of truth; Helm of Knowledge becomes mechanically meaningful beyond the boolean gate it already had since Phase 15 |

**Deprecated/outdated:** the literal `× 2.5` SP multiplier and the `d6 >= 4` wilmst threshold are the two numeric constants this phase deliberately retires (with rationale, not silently).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-06's "+1 to the to-hit roll" should be implemented as `need += 1` (not `roll -= 1`) | Pitfall 4 / Code Examples | Low — either implementation produces an identical probability shift (the foe is 1/20 more likely to hit); choosing `roll -= 1` instead would still satisfy "zero extra draws" and the observable `struck`/`foeMissed` win/loss outcome would be the same, but the RAW `roll` value logged in narration events would differ, which could look odd in the Oracle log ("rolled a 3, needed a 12" vs. narrating a roll that was silently pre-adjusted). Recommend confirming this reading during planning/discuss if there is any remaining doubt; the arithmetic-on-`need` reading matches every existing precedent in the same function. |
| A2 | mazeworld.html's classic `canParley()` duplicate at ~line 4200 must be updated for correctness (not the dead `parley()` beside it) | Pitfall 1 | Medium if missed — the button-visibility bug would not be caught by any existing automated test (no test exercises mazeworld.html's classic script block directly), only by manual/DR-style on-device play. Flag as an explicit plan task with an explicit manual-verification note. |
| A3 | `full-suite.test.js` needs the SAME scenario-scoped stripper as `combat-parity.test.js`, not just the latter | Pitfall 2 | High if missed — `npm test` would fail on the phase gate (full-suite.test.js is part of the standard `npm test` run), not silently pass. Low risk of shipping broken, but wastes a debug cycle if not anticipated. |

**If this table is empty:** N/A — see entries above; all three are implementation-detail risks (not data-integrity/compliance risks), each with a stated low-to-medium blast radius that a first test run will surface immediately.

## Open Questions

1. **Should the classic `parley()` duplicate in mazeworld.html (confirmed dead code) also be updated for documentation consistency?**
   - What we know: it is unreachable from the live UI (DR8 comment confirms `window.mzParley` is the real call path); updating it has zero behavioral effect.
   - What's unclear: whether the team prefers dead-code hygiene (update it so a future reader isn't confused by a doubly-stale duplicate) vs. minimal diff (leave dead code alone, per the DR8 precedent of "don't delete a classic rule cluster in the same commit that rewires its call sites").
   - Recommendation: low priority; the plan should treat this as optional polish, not a gated task. The LIVE `canParley()` duplicate (Pitfall 1) is the one that must change.

2. **Exact wording of the `parleyRolled` fluency annotation (D-14: "need 15 (+2 tongue)")** — cosmetic only, left to Claude's Discretion per CONTEXT.md; no research risk.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (via `node --test`), no external test runner |
| Config file | None — `package.json` scripts drive glob-based discovery |
| Quick run command | `npm run test:quick` (runs `test/unit/**`, `test/determinism/**`, `test/roundtrip/**` — covers unit-level combat/derived tests, excludes the slower parity/voice suites) |
| Full suite command | `npm test` (currently **882/882 passing**, ~11.3s, measured directly this session `[VERIFIED: npm test run]`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARLEY-01 | Payout ≤ combat-equivalent for every roll/foe-level combo | unit (property-style) | `node --test test/unit/combat.test.js` (or new `test/unit/parley.test.js`) | ✅ extend existing file, or ❌ Wave 0 if a new file is chosen |
| PARLEY-01 | `killFoe`'s draw/result stays byte-identical after `killSpFor` extraction | parity + unit | `npm test` (full-suite + combat-parity + magic-parity all touch `killFoe`) | ✅ existing |
| PARLEY-02 | One attempt per encounter; retry rejected with `parleyExhausted`, 0 draws | unit | `node --test test/unit/combat.test.js` | ✅ extend existing `parley()` tests (lines 801/814) |
| PARLEY-02 | Failed parley sets `parleyInsulted`; `foeTurn` to-hit gets +1 for the rest of the fight | unit | `node --test test/unit/combat.test.js` | ✅ extend; new assertions on `need`/`mNeed` via `fakeRng` |
| PARLEY-02 | FID-02 draw-count pins unaffected by the insulted change | regression | `node --test test/unit/foe-turn-draw-count.test.js` | ✅ existing, must stay green with zero edits |
| PARLEY-03 | Con Artist need=13 at even level vs solo foe (65%, documented target) | unit | `node --test test/unit/combat.test.js` | ✅ extend |
| PARLEY-03 | D-08 clamp: need never exceeds 17 for any stacked bonus combo | unit | `node --test test/unit/combat.test.js` | ✅ extend |
| PARLEY-04 | Every `canParley` gate tested, including the now-reachable Wilmsry-vs-Magical refusal | unit | `node --test test/unit/combat.test.js` | ✅ extend the existing gate-matrix test (line 782) |
| PARLEY-04 | Wilmsry-vs-Magical refusal does NOT consume the D-05 attempt | unit | `node --test test/unit/combat.test.js` | ❌ Wave 0 — new assertion |
| LANG-01 | `fluency(c)` returns 0/1/2 correctly for skill/Helm/both/neither | unit | `node --test test/unit/derived.test.js` (if it exists) or a new small test | check — see Wave 0 gaps below |
| LANG-02 | Availability matrix: race × sub × {skill} × {Helm} × encounter type | unit (table-driven) | `node --test test/unit/combat.test.js` (or new `test/unit/parley.test.js`) | ❌ Wave 0 — new table-driven test |
| PARLEY-01/D-13 | Seed-303 parley scenario stays byte-identical elsewhere; only `c.sp`/`c.gold` diverge, documented | parity | `node --test test/parity/combat-parity.test.js` AND `node --test test/parity/full-suite.test.js` (both, per Pitfall 2) | ✅ existing files, edited |
| all | New event types (`parleyExhausted`, `parleyInsulted`) narrated + safety-scanned | coverage | `node --test test/unit/formatEventsCoverage.test.js`, `node --test test/voice/safety-scan.test.js` | ✅ existing, auto-covering (derives event types from source, iterates `EVENT_NARRATION` automatically) |
| PARLEY-01/03 | Fixture-inventory roster pin stays green (roster unchanged, only numbers inside the fixture behavior change) | doc-consistency | `node --test test/parity/fixture-inventory.test.js` | ✅ existing, should require zero edits |
| D-15 | Tuning readout (informational) | manual/dev-tool | `node tools/tune-difficulty.mjs --seeds=200` (out-of-band, ~5-6 min per the 18-06 precedent — run in background) | ✅ existing tool, extended with new tally fields |

### Sampling Rate
- **Per task commit:** `npm run test:quick`
- **Per wave merge:** `npm test` (full suite, including parity — parley touches parity-sensitive code every time)
- **Phase gate:** `npm test` full green (baseline 882/882 plus new tests) before `/gsd-verify-work`; the `tune-difficulty.mjs` readout is informational (D-15/D-16 precedent — not a pass/fail gate)

### Wave 0 Gaps
- [ ] A test asserting `parley()`'s Wilmsry-vs-Magical refusal does NOT set `C.parleyTried` (no existing test covers this distinction)
- [ ] A table-driven availability test for LANG-02's race × sub × skill × Helm × type matrix (no existing file covers this combinatorial shape — decide combat.test.js extension vs. new `test/unit/parley.test.js` per Claude's Discretion)
- [ ] Confirm whether `test/unit/derived.test.js` exists for `fluency`/`killSpFor` unit coverage, or whether these are better tested indirectly via `combat.test.js`'s parley tests (either is acceptable; note the decision)
- [ ] The scenario-aware stripper export in `test/parity/harness/comparables.js` (new code, not currently present)

*(Framework install: none needed — `node --test` is already the project's only test runner.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-player, fully offline, no accounts (project constraint) |
| V3 Session Management | No | No sessions; a "run" is local game state only |
| V4 Access Control | No | No multi-user boundary in v1 |
| V5 Input Validation | Yes (already satisfied, unchanged) | The `parley` action carries no new fields; `engine/actions.js`'s `validateAction` allowlist and `ACTION_TYPES` set are unchanged by this phase — no new validation surface is introduced. The `parleyExhausted`/`parleyInsulted` rejections happen INSIDE `parley()` (post-dispatch), not via a new action-shape check, and are themselves side-effect-free (no rng draw) per D-05/D-12, closing off any "spam parley to see extra events" concern. |
| V6 Cryptography | No | No secrets/crypto touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Repeated-action farming (a player mashing "parley" for free information/rng manipulation) | Elevation of Privilege / Repudiation (loosely — really a game-balance concern, not a security one in a fully offline single-player game) | D-05's `C.parleyTried` gate + the `parleyExhausted` 0-draw rejection already closes this; no additional engine-level mitigation is needed beyond what this phase already implements |
| State corruption via a malformed/replayed save carrying a stale `parleyTried`/`parleyInsulted` | Tampering | Not exploitable — `state.combat` (where both flags live) is unconditionally nulled by both `validateSave` and `rehydrate` on every load (Pitfall 3); no attacker-controlled save can inject a live combat flag |

This phase's security surface is minimal by nature (offline, single-player, no network, no new user-facing input fields) — the only genuinely relevant control is the existing `engine/actions.js` allowlist, which this phase does not modify.

## Sources

### Primary (HIGH confidence — direct source reads this session)
- `engine/combat.js` (canParley/parley/foeTurn/killFoe/startCombat/afterPlayerAction/endCombat) — full read, lines 1-450, 598-826, 1105-1249
- `engine/derived.js` — full read (skill/eff/resistRoll/conditionsOf and every existing leaf helper pattern)
- `engine/engine.js`, `engine/actions.js` — dispatch/validation surface for the `parley` action type
- `engine/saveState.js` — `validateSave`/`rehydrate`, confirming `state.combat` is unconditionally nulled on load (Pitfall 3)
- `test/parity/harness/comparables.js` — every existing stripper pattern (`stripFoeEffectField`, `stripFoeAbilityState`, `stripRationsField`, etc.) and the shared `combatComparable`
- `test/parity/combat-parity.test.js` — local `comparable()`, confirming it is independent of the shared harness
- `test/parity/full-suite.test.js` — confirming it independently replays `action-script.combat.json` through the shared `combatComparable` (Pitfall 2's source)
- `test/parity/fixtures/action-script.combat.json` — the exact 4-scenario fixture, `parley` scenario (seed 303, forced "Humans")
- `test/parity/FIXTURE-INVENTORY.md` — roster/draw-count baseline tables
- `test/unit/combat.test.js` (lines 760-850) — existing parley/canParley test coverage and fixtures (`fixedState`, `fixedFoe`, `fixedCombat`, `fakeRng`)
- `test/unit/foe-turn-draw-count.test.js` — confirmed no `parley` reference (Pitfall on draw-count baseline)
- `mazeworld.html` (lines 3700-3745, 4190-4234, 4980-5065, 5330-5340, 5410-5436, 6260) — the classic `canParley()`/`parley()` duplicate, the DR8 dead-code comment, the button-render/keybinding wiring, and the trailing module script's import surface (Pitfall 1's source)
- `src/browser/eventNarration.js` (lines 160-200) — existing `parleyRolled`/`parleyRefused`/`parleyFailed` narration entries
- `content/skills.js`, `content/treasure-tables.js`, `content/races.js` — `Language` skill (cost 1), Helm of Knowledge (`eff:{tongue:1}`), Wilmsry `spMul: 0.5`
- `tools/tune-difficulty.mjs` (lines 1-190) — bot policy already imports/calls `canParley(state)` directly (no duplicate-maintenance risk there); reporting/readout structure to extend
- `.planning/phases/18-bestiary-rebalance-canon-combat-fixes/18-06-SUMMARY.md` — the tune-difficulty BEFORE/AFTER readout precedent (background run, ~5-6 min, transcribed verbatim, informational framing)
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — engine gate, phase sequencing, requirement text
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true` (both sections included above)

### Verified via tool execution this session
- `node .tmp_research/parley_probe.mjs` / `parley_probe2.mjs` (deleted after use) — ran `newRun(303)` → `startCombat(false,"Humans")` → `applyAction({type:"parley"})` against the CURRENT (pre-Phase-20) engine, confirming the exact character rolled, the exact draw sequence (2, 5, 5, 2), and the exact current output (need 19, sp 13, gold 200) — this is the "BEFORE" half of the FIXTURE-INVENTORY.md table above.
- `npm test` — full suite, 882/882 passing, ~11.3s, confirming the current baseline this phase must not regress.

### Secondary/Tertiary
None — this phase required no external documentation or web research; every claim traces to a direct codebase read or an actual engine run performed this session. `.planning/config.json` has every external search provider (`exa_search`/`brave_search`/`firecrawl`/`tavily_search`/`ref_search`/`perplexity`/`jina`) disabled, consistent with this phase needing none of them.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no new libraries) — HIGH confidence there is nothing to research here
- Architecture (canParley duplication, parity double-coverage, save-load nulling): HIGH — confirmed by direct source reads, not inference
- Seed-303 before/after numbers: HIGH for the "before" half (actual engine run); HIGH-but-unverified-against-implementation for the "after" half (deterministic arithmetic from the LOCKED formulas, but the code implementing those formulas doesn't exist yet — re-confirm with the first new unit/parity test written)
- Pitfalls: HIGH — three of five are confirmed by direct source read (not speculative), one is an explicit ambiguity flagged with a recommendation (Pitfall 4), one is a measured fact about an unrelated test file (Pitfall 5)

**Research date:** 2026-09-14
**Valid until:** Until Phase 20 lands (this research is scoped to the current commit `a465b00`; any further engine changes before Phase 20 executes should trigger a quick re-read of `engine/combat.js`'s current parley/canParley functions before implementing)
