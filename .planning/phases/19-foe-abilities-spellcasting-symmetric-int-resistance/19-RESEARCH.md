# Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance - Research

**Researched:** 2026-09-13
**Domain:** Deterministic combat-engine feature work (no external libraries) — a data-driven foe-ability resolver, symmetric INT resistance, and CANON-02 fixes, layered onto the Phase 17/18 seams (`pickFoeTarget`, `applyFoeDamageToPlayer`, `damageFoe`) inside a parity-frozen, permadeath roguelike.
**Confidence:** HIGH (every claim below is grounded in a direct read of the cited `engine/*.js`/`content/*.js`/`test/*.js` file:line, cross-checked against the Phase 17/18 SUMMARYs and the milestone's own ARCHITECTURE/PITFALLS/FEATURES research). One structural finding (the `resistRoll` home) deviates from CONTEXT.md's literal wording and is flagged prominently.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ability Model & Canon Kits (FOE-01, FOE-05, FOE-06)**
- **D-01:** Registry = `content/foe-abilities.js`, a flat PURE-DATA array of descriptors `{ id, kind, lvl, dmg?, effect?, every?, uses?, txt }` (no functions — `content-is-pure-data` guard). Bestiary entries reference abilities by id via a new `abilities: [ids]` array; the field is ABSENT on every non-caster creature and is the structural zero-draw gate. `sp.caster` stays inert (never read by code).
- **D-02:** Five ability kinds: **bolt** (dice damage delivered through `applyFoeDamageToPlayer` — ward/armor/Hardiness/halfNext apply), **drain** (WP drain: bypasses armor but not ward; heals the foe by the amount applied, capped at `maxWP`), **debuff** (timed `c.foeEffect`), **heal** (self, dice, capped at `maxWP`), **summon** (one reinforcement joining next round).
- **D-03:** Canon kits, rulebook-first, with every single ability's expected damage capped at ~50% of a level-N hero's expected HP at that tier (use `tools/bestiary-yardstick.mjs`'s hero HP figures): Krupke (lvl 1–2: Freeze bolt d6, Weaken debuff) · Drudge (lvl 1–4: Freeze / Fireball / Lightning bolts + Weaken; `never_melee`) · Djinni (lvl 1–4 bolts + a daze debuff, `uses: 4` per ability per encounter, **flees at <25% HP** — a `foeFled` exit that removes it from the fight, no XP) · Vampire (drain + Fireball/Lightning bolts + summon a Walking Dead tier-2) · Stalka Beast (lvl 1–5 bolts + heal, unlimited) · Drake (fire-breath bolt `every: 4`, CANON-02). Exact dice per ability at planner discretion within the cap; no Mangle-class one-shots.
- **D-04:** Cast policy: on its turn a foe WITH `abilities` and at least one ready ability rolls `rng.d(6)`: ≤ 4 → cast the FIRST ready ability in kit order (deterministic, no pick roll), else melee as today. `never_melee` foes always cast without the d6; if nothing is ready they emit `foeOutOfSpells` and skip (no draw). Foes without `abilities` take the exact pre-Phase-19 path (zero extra draws — FID-02 pins must stay identical).

**Bounds, Telegraph & Resistance (FOE-06, FOE-07, CANON-02)**
- **D-05:** Cooldown/cap state lives on the foe, created lazily on first cast: `f.cd = { [id]: roundsLeft }` for `every: N` abilities (ticks down each foe turn) and `f.uses = { [id]: n }` for `uses: N` caps. "Per day" (Djinni 4×/day) is approximated as per ENCOUNTER.
- **D-06:** Telegraph = the turn an ability fires, push `foeCast { name, ability, kind }` BEFORE its effect events (Oracle: "The Drudge's fingers crackle… → Lightning: 11"). No one-round-ahead charging state. Fairness valve = the D-03 ~50%-HP cap.
- **D-07:** ONE shared resistance helper `resistRoll(rng, intel) → { resisted, roll }` exported from `engine/magic.js`; `castSpell`'s existing inline foe-resist block (`t.intel >= 12 → rng.d(20) < t.intel`) is refactored to call it with the SAME single d20 (draw-neutral; parity byte-identical). Foe abilities call it for the hero: `c.intel >= 12 → d20 < c.intel`, and the roll fires ONLY when a resistible ability actually fires. Resistible kinds: bolt, drain, debuff (a resisted bolt/drain does 0, a resisted debuff does nothing). heal/summon are self-targeted — no roll.
- **D-08 (CANON-02):** Drake — breath is a `bolt` with `every: 4` (fires rounds 4, 8, …). Drudge — `never_melee` → always casts (D-04). Spectre — `sp.pursues`: when the hero SUCCEEDS at fleeing from a fight containing a live `pursues` foe, that foe gets ONE free melee strike as the hero leaves (drawn only in that branch; `foePursued` event); no re-engagement state.

**Debuff, Drain, Heal & Summon Semantics (FOE-02, FOE-03, FOE-04, FOE-08)**
- **D-09:** `c.foeEffect` is ONE slot `{ kind, rounds }` (default `null`): a new debuff replaces the old (same kind refreshes rounds); ticks down at the END of each foe turn; cleared in `endCombat` (combat-scoped — never leaks between fights); surfaced by `conditionsOf` as `{ key: "foeEffect", polarity: "bad", kind, remaining }` so the existing chip row renders it with zero new UI; `foeEffectFaded` event when it expires.
- **D-10:** Two debuff kinds: **weakened** — the hero's dealt damage is halved (`Math.ceil`, mirror of the foe-side `C.weakened`); **dazed** — the hero's to-hit need is lowered by 2 (min 1). Duration `d4` rounds (drawn only when the debuff lands).
- **D-11:** Drain = WP only (no attribute drain in v1.1). Dice damage through the ward but bypassing armor (no soak roll), can reduce the hero to 0 (it is damage → `die` path), heals the foe by the amount actually applied.
- **D-12:** Summon = descriptor `{ kind: "summon", type, tier }`; the resolver `rng.pick`s a bestiary entry of that type/tier (gated draw) and queues it on `C.pendingFoes`; at the START of the next `foeTurn` (before any foe acts) it is appended to `C.foes` — mirrors the `c.pendingAlly → C.ally` precedent — with `lvl = max(1, summonerLvl − 1)`, no `abilities` (no recursion), full normal accounting (kills, XP split, parley). Caps: at most 1 pending at a time; no summon when live foes ≥ 4.

**Party, Parity, Saves & Narration (FOE-09, FID-04, FOE-08)**
- **D-13:** Targeting: bolt and drain pick their target through the existing `pickFoeTarget` (hero or a live party member). On a member they use the simplified member path (no ward/armor/resist roll — members have no `intel` check) and can down the member exactly like a melee hit. Debuffs (and the drain's heal side) always target the hero; heal/summon are untargeted. Each ability's plan states its member behavior explicitly.
- **D-14:** New serialized state — foe: `abilities` (copied from the bestiary entry at `startCombat` ONLY when the entry has it), lazy `cd` / `uses`; hero: `c.foeEffect` (null default); combat: `C.pendingFoes`. All carved out in `combatComparable` / `movementComparable` / `economyComparable` via named strippers (pattern: `stripDarkForField` in `test/parity/harness/comparables.js`); `saveState` loading tolerates their absence (old saves default them); a v1.0-shaped save JSON fixture round-trips in a test (FID-04). `test/parity/prototype-master.js.txt` and fixtures untouched.
- **D-15:** Determinism proof: new `test/determinism/foe-abilities.test.js` forcing Magical / Demons / Walking Dead / Humans-tier-2 / Beasts-tier-5 encounters at pinned seeds, asserting replay-identical events + state and pinning each caster's per-turn draw counts; the FID-02 `countingRng` test gains cases proving ability-less foes still draw exactly the baseline (0/1/2/2/3/6 and 12/101/111/66/32 unchanged).
- **D-16:** Narration — new event types each with a sarcastic, family-friendly `EVENT_NARRATION` line (coverage guard + voice safety scan): `foeCast` (generic + per-kind flavor using the ability's `txt`), `foeBolted` (only if not reusing `struckByFoe`), `foeDrained`, `foeDebuffed`, `foeHealed`, `foeSummoned`, `foeEffectFaded`, `heroResisted`, `heroResistFailed`, `foeFled`, `foePursued`, `foeOutOfSpells`. A bolt that lands may reuse the existing `struckByFoe` event/toast with an `ability` field rather than a new type — planner's call, but every new type needs an entry.

### Claude's Discretion
- Exact dice per ability within the D-03 cap; exact registry ids; whether `engine/foeAbilities.js` resolves everything itself or delegates bolts to `applyFoeDamageToPlayer` and drains to a small shared helper; test file layout; the order of `C.pendingFoes` join vs. regen/acid ticks at the top of `foeTurn` (must be before any foe acts and must not change draw order for ability-less fights).
- Whether Djinni's flee check happens at the start of its own turn (recommended: yes, before casting) or after taking damage.

### Deferred Ideas (OUT OF SCOPE)
- Attribute drain (Strength/Intelligence, restored at `newDay`) → backlog.
- Incapacitation state machines (grapple / entangle / possess / enthrall / awe-as-stun) → FOE-V2-01.
- One-round-ahead "charging" telegraph → revisit in Phase 21 if the DR round finds bolts feel unfair.
- Spectre re-engagement (`pendingPursuer`) → backlog if the free strike feels too weak.
- Party members resisting spells / having `intel` → FOE-V2 / Phase 21.
- Formal threat budget → FOE-V2-04.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOE-01 | Data-driven ability kit resolved by a pure `engine/foeAbilities.js`, `sp.caster` stays inert | Architecture Patterns 1–2; `content/foe-abilities.js` registry shape; `startCombat`'s conditional `abilities` copy (Q5/D-14 section) |
| FOE-02 | Offensive bolt spells through the shared damage pipeline (ward/armor/conditions) | Architecture Pattern 2 (bolt delivery); `applyFoeDamageToPlayer` extension proposal |
| FOE-03 | Drain / debuff / heal, deterministic + narrated | Architecture Pattern 3 (drain semantics, `c.foeEffect`); Narration section |
| FOE-04 | Summon reinforcements next round via a designed mutation pattern | Architecture Pattern 4 (`C.pendingFoes` join); Common Pitfalls #4 |
| FOE-05 | The five canon casters wired rulebook-first | Dice Budget table; Canon Ability Inventory cross-reference (research/FEATURES.md) |
| FOE-06 | Bounded usage (cooldowns/caps), every ability telegraphed | Architecture Pattern 1 (cast-policy gate); `f.cd`/`f.uses` lazy-init proposal |
| FOE-07 | Symmetric INT resistance, ONE shared helper, gated roll | Architecture Pattern 5 (`resistRoll` extraction + the module-cycle finding) |
| FOE-08 | Foe debuffs via `conditionsOf`, no new UI; every new event narrated | `conditionsOf`/chip-renderer section; Narration section |
| FOE-09 | Party members targetable via `pickFoeTarget`; new determinism tests for untested encounter types | Architecture Pattern 6 (member path); Determinism Tests section |
| CANON-02 | Spectre pursues on flee; Drudge never melees; Drake's breath on an `every`-N cooldown | Architecture Pattern 7 (flee/pursue); Pattern 1 (never_melee gate); `f.cd` every-N math |
| FID-04 | Every new field carved out in all 3 `*Comparable()`; a v1.0 save round-trips | Serialization & Carve-Outs section |
</phase_requirements>

## Summary

This phase adds a small, self-contained ability system to the foe side of combat without touching `castSpell` at all — exactly the "separate resolver, not a generalized caster" boundary the milestone's own architecture research already locked in Phase 17/18. Every mechanic this phase needs already has a proven, in-repo precedent to mirror: `f.acid`/`c.regen`/`C.allies` for the zero-draw gate discipline, `c.pendingAlly → C.ally` for a deferred-join queue, `f.alive=false; f.fled=true` for a foe that leaves without paying XP, and `applyFoeDamageToPlayer`/`damageFoe` for the hero/foe damage pipelines a bolt and a drain need to reuse. The design in CONTEXT.md is unusually precise (16 locked decisions), so this research is mostly about pinning EXACT insertion points, EXACT function signatures, and one real structural risk this research surfaces that CONTEXT.md does not address: **`resistRoll` cannot live in `engine/magic.js` as literally specified in D-07, because `magic.js` already imports from `combat.js`, and `combat.js` must import the new `engine/foeAbilities.js`, which needs `resistRoll` — that's an import cycle.** The fix is cheap (home `resistRoll` in `engine/derived.js`, a dependency-free leaf module that already hosts `intelBonus`/`armorSoak`/`conditionsOf`), but it must be decided before planning locks file boundaries.

The other load-bearing finding is that `applyFoeDamageToPlayer`'s `{ dmg, roll, need }` options are ONLY consumed for the `struckByFoe` narration payload (not for hit/miss gating — that's already resolved by the caller before this helper is ever invoked), so a bolt/drain can call it safely with synthetic values, but the helper needs two small, additive extensions to serve both new kinds correctly: (1) an `ignoresArmor` override so a **drain** can skip the armor-soak block even though the foe itself has no `sp.noArmor` flag, and (2) an `applied` field on its return object so a **drain** can heal the foe by the amount that actually landed post-Hardiness/ward. Both are backward-compatible additions (existing callers only read `.died`/`.onArmour` and never pass `ignoresArmor`).

**Primary recommendation:** insert the ability-attempt gate in `foeTurn` between the existing `asleep` check and the `swings` computation (exactly where Phase 17/18's own architecture research already flagged the slot); home `resistRoll` in `engine/derived.js` (not `magic.js`, to avoid a module cycle); extend `applyFoeDamageToPlayer`'s options/return shape additively for bolt/drain reuse; and build the summon join as a `state.combat.pendingFoes` array drained at the very top of `foeTurn` (before the regen tick), so a summoned foe becomes an ordinary `C.foes` entry with zero special-casing anywhere else.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ability definitions (dice/kind/cooldowns) | Content (`content/foe-abilities.js`) | — | Pure data, mirrors `content/spells.js`'s `SPELLS[]` — no functions, no rng |
| Ability resolution (cast policy, cooldown bookkeeping, effect dispatch) | Engine (`engine/foeAbilities.js`, new) | `engine/combat.js` (the per-foe loop that calls it) | A foe-scoped resolver kept separate from `castSpell` per the milestone's own Anti-Pattern 1 (never generalize `castSpell`) |
| Bolt/drain delivery to the hero | Engine (`engine/combat.js#applyFoeDamageToPlayer`, extended) | `engine/foeAbilities.js` (caller) | Reuses the Phase 17 damage pipeline instead of duplicating ward/armor/Hardiness logic |
| Symmetric INT resistance | Engine (`engine/derived.js#resistRoll`, new home) | `engine/magic.js` (refactored caller), `engine/foeAbilities.js` (new caller) | Must live in a dependency-free leaf module — see the module-cycle finding above |
| Foe-inflicted player debuff state (`c.foeEffect`) | Engine (`engine/combat.js` writer, `engine/derived.js` reader) | — | Mirrors `c.ward`/`c.mirror`'s existing per-fight slot shape and end-of-foeTurn tick |
| Debuff surfacing to the player | Engine (`derived.js#conditionsOf`) | Presentation (`mazeworld.html`'s `CONDITION_COPY`/`paintConditions`) | `conditionsOf` is the single canonical read; the HTML chip table needs ONE new label mapping, not a new component |
| Summon queue → roster append | Engine (`engine/combat.js#foeTurn`, top-of-function drain) | — | Mirrors the `c.pendingAlly → C.ally` precedent already in `startCombat` (combat.js:169-173) |
| Flee/pursue resolution | Engine (`engine/combat.js#flee`) | — | New branch inside the existing 4 success exits, before each `endCombat` call |
| Event narration | Presentation (`src/browser/eventNarration.js`) | Content (`content/foe-abilities.js`'s `txt`, referenced by narration builders) | Coverage guard + safety scan are both derive-from-source, zero manual registration beyond adding the entries |
| Parity carve-outs | Test harness (`test/parity/harness/comparables.js`) | — | New fields must be stripped in ALL THREE comparable functions per the milestone's hard gate |

## Standard Stack

No new libraries, packages, or external dependencies. This phase is pure additions to the existing engine (`engine/*.js`) and content (`content/*.js`) modules, following patterns already established in Phases 17–18. `content-is-pure-data.test.js` already enforces the "no functions in `content/`" guard the new `content/foe-abilities.js` must satisfy.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. (`npm view`/`package-legitimacy` checks are skipped; nothing to audit.)

## Architecture Patterns

### System Architecture Diagram

```
foeTurn(state, rng, events)                         [engine/combat.js]
 │
 ├─ (NEW, top of fn) drain state.combat.pendingFoes → C.foes  (0 draws — mirrors c.pendingAlly→C.ally)
 │
 ├─ c.regen tick (unchanged)
 │
 └─ for each live foe f in C.foes:
      ├─ f.acid tick (unchanged, gated on f.acid)
      ├─ f.asleep check (unchanged, gated on f.asleep>0)
      │
      ├─ (NEW) ability-attempt gate — gated on f.abilities.length > 0
      │    │
      │    ├─ hasReadyAbility(f)?  [pure, 0 draws — checks f.cd / f.uses]
      │    │
      │    ├─ never_melee → always attempt (no d6); nothing ready → foeOutOfSpells, skip
      │    ├─ else → rng.d(6) ≤4 → attempt; else → fall through to melee (unchanged)
      │    │
      │    └─ resolveFoeAbility(state, f, ability, rng, events)   [engine/foeAbilities.js, NEW]
      │         ├─ foeCast event (telegraph, BEFORE effect)
      │         ├─ pickFoeTarget(state, rng)  [reused from combat.js, Phase 17]
      │         ├─ target === hero? → resistRoll(rng, state.c.intel)  [engine/derived.js, NEW home]
      │         │      resisted → heroResisted event, 0 effect, return
      │         ├─ kind: "bolt"  → applyFoeDamageToPlayer(...) [extended, reused]
      │         ├─ kind: "drain" → applyFoeDamageToPlayer(..., {ignoresArmor:true}) → foe.wp += applied
      │         ├─ kind: "debuff" → c.foeEffect = {kind, rounds: d4}  (hero-only, no pickFoeTarget)
      │         ├─ kind: "heal"  → foe.wp = min(foe.maxWP, foe.wp + dice)  (self, untargeted)
      │         └─ kind: "summon" → rng.pick bestiary entry → C.pendingFoes.push(...)  (gated: <1 pending, live foes <4)
      │
      └─ swings loop (UNCHANGED — reached only when no ability fired)

 end-of-foeTurn: ward/mirror tick (unchanged) + (NEW) c.foeEffect tick, alongside it
```

### Recommended Project Structure
```
engine/
├── combat.js          # MODIFIED: foeTurn ability-attempt gate + pendingFoes drain + c.foeEffect tick;
│                       #   flee() pursuit-strike branch; applyFoeDamageToPlayer extended
├── foeAbilities.js     # NEW: resolveFoeAbility(state, foe, ability, rng, events); readiness helpers
├── derived.js          # MODIFIED: + resistRoll(rng, intel); + conditionsOf's foeEffect entry;
│                       #   + toHit's dazed penalty; (weaponDamage stays untouched — weakened
│                       #   halving is applied at the playerStrike call site, see Pattern 3)
├── magic.js            # MODIFIED: castSpell's inline resist block calls the relocated resistRoll
├── saveState.js         # MODIFIED: rehydrate() explicitly nulls c.foeEffect on load (new migration)
content/
├── foe-abilities.js    # NEW: pure-data ability registry, id → {kind, dmg?, effect?, every?, uses?, txt}
├── bestiary.js          # MODIFIED: `abilities: [ids]` added to Krupke/Djinni x2/Drudge x2/Vampire/
│                        #   Stalka Beast/Drake; Drake's sp.dmg lowered off the breath-tier value (CANON-02)
├── index.js              # MODIFIED: + `export * from "./foe-abilities.js";`
src/browser/
├── eventNarration.js    # MODIFIED: + 8-11 new entries (see Narration section)
mazeworld.html
│                        # MODIFIED: CONDITION_COPY/paintConditions gains a foeEffect→label mapping
test/
├── unit/foe-abilities.test.js         # NEW: resolver unit tests (all 5 kinds, resist gate, cooldowns)
├── unit/foe-turn-draw-count.test.js   # MODIFIED: + ability-attempt-gate draw pins; restated baseline
├── unit/save-validation.test.js       # MODIFIED: + synthetic v1.0-shaped save round-trip
├── unit/conditions.test.js            # MODIFIED: + foeEffect entry test
├── determinism/foe-abilities.test.js  # NEW: forced Magical/Demons/Walking Dead/Humans-t2/Beasts-t5 replay
├── voice/safety-scan.test.js           # MODIFIED: + content/foe-abilities.js's txt strings in Corpus 3
test/parity/harness/
├── comparables.js       # MODIFIED: + stripFoeAbilityFields, stripFoeEffectField, pendingFoes strip (x3 fns)
```

### Pattern 1: The ability-attempt gate — exact insertion point and cast policy

**What:** `engine/combat.js#foeTurn` (992-1082) has this exact shape today (line numbers from the current file):

```js
export function foeTurn(state, rng, events = []) {
  const C = state.combat;                                    // 993-994
  if (!C) return events;
  const c = state.c;
  if (c.regen) { ... }                                        // 996-1002 (hero regen tick, unconditional check)
  for (const f of C.foes) {                                   // 1003
    if (f.acid && f.acid.rounds > 0) { ... }                  // 1004-1017 (acid tick, gated on f.acid)
    if (!f.alive) continue;                                    // 1018
    if (f.asleep > 0) { f.asleep--; ...; continue; }           // 1019-1023
    // <<< D-04's ability-attempt gate goes HERE, before line 1024 >>>
    const swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1);  // 1024
    for (let s = 0; s < swings; s++) { ... }                   // 1025-1074 (unchanged swing loop)
  }
  if (c.ward && --c.ward.rounds <= 0) { ... }                  // 1076-1079
  if (c.mirror > 0 && --c.mirror <= 0) { ... }                 // 1080
  // <<< D-09's c.foeEffect tick goes HERE, alongside ward/mirror >>>
  return events;
}
```

This is the exact slot the Phase 17/18 ARCHITECTURE.md already identified as the correct location: after the sleep check (an asleep foe never casts either), before the melee swing count is computed. The recommended shape:

```js
if (!f.alive) continue;
if (f.asleep > 0) { f.asleep--; events.push({ type: "foeSlept", name: f.name }); continue; }

// D-04/D-05: the ability-attempt gate — structural zero-draw guard on f.abilities.
// Every existing BESTIARY entry has no `abilities` field, so f.abilities is
// undefined for them and this ENTIRE block is skipped with ZERO rng draws,
// leaving the swing loop below byte-identical to today (FID-02).
if (f.abilities && f.abilities.length) {
  const ready = firstReadyAbility(f);              // pure, 0 draws — checks f.cd/f.uses
  const neverMelee = !!(f.sp && f.sp.never_melee);
  if (ready && (neverMelee || rng.d(6) <= 4)) {
    resolveFoeAbility(state, f, ready, rng, events);
    tickAbilityCooldowns(f);                        // pure arithmetic, 0 draws, once per this foe's visit
    continue;                                        // ability REPLACES melee this round
  }
  if (neverMelee) {
    events.push({ type: "foeOutOfSpells", name: f.name });
    tickAbilityCooldowns(f);
    continue;                                        // never_melee foe with nothing ready — no swing, no draw
  }
  tickAbilityCooldowns(f);                            // rolled >4, or nothing ready but not never_melee — falls to melee
}

const swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1);
```

**Critical draw-order detail:** the `rng.d(6)` cast-check roll is ONLY drawn when `ready` is truthy (i.e., at least one ability is off cooldown/has uses left) AND the foe is not `never_melee`. A caster with an ability kit but nothing currently ready (e.g. Djinni after 4 casts) draws **zero** extra rng and falls straight to the unmodified melee path — this must be preserved exactly, or a caster that has exhausted its kit would silently change draw parity partway through a long fight.

**Cooldown/uses lazy-init (D-05), concretely:**
- `f.uses[id]` (Djinni's `uses: 4`): absent = full allowance available; on cast, `f.uses[id] = (f.uses[id] ?? N) - 1`; ready while `(f.uses[id] ?? N) > 0`.
- `f.cd[id]` (Drake's `every: 4`, "fires rounds 4, 8, …"): this needs an explicit off-by-one choice CONTEXT.md does not spell out. Recommended algorithm to hit exactly rounds 4/8/…: initialize `f.cd[id] = every - 1` the FIRST time this foe's ability readiness is checked (i.e., lazily, on the first `firstReadyAbility` call for that foe) — round 1: cd=3 (not ready), decrement each subsequent visit — round 2: cd=2, round 3: cd=1, round 4: cd=0 → ready, fires, reset `f.cd[id] = every - 1` again. **[ASSUMED — not specified in CONTEXT.md; flag for planner sign-off, since a different off-by-one would fire on round 3 or 5 instead of 4.]**
- Cooldown/uses decrements are **pure arithmetic, never an rng draw** — safe to run unconditionally once per foe per `foeTurn` visit, mirroring the existing ward/mirror tick's "once per `foeTurn` invocation" discipline (PITFALLS.md Pitfall 2 — a foe can be visited twice in one round via the "ROUND-COUNT FIX" reroll at combat.js:731-738, and cooldowns must decay at the SAME cadence the foe itself is actually evaluated, not the global round counter).

**`C.pendingFoes` join point (D-12):** place the drain at the VERY TOP of `foeTurn`, before the `c.regen` check (994, before line 996) — not because order relative to `c.regen` matters mechanically (a summoned foe doesn't affect the hero's own regen), but so a fresh reader sees "new foes join before anything else happens this turn," mirroring the `c.pendingAlly → C.ally` precedent's own placement at the top of `startCombat` (combat.js:169-173):

```js
export function foeTurn(state, rng, events = []) {
  const C = state.combat;
  if (!C) return events;
  const c = state.c;
  // D-12: a pending summon (queued by a foe's ability last turn) joins at the
  // START of this foeTurn, before any foe (including itself) acts. Pure data
  // append — 0 rng draws (the summoned foe's identity was already rng.pick'd
  // at QUEUE time, inside resolveFoeAbility's summon branch). Every existing
  // fight has C.pendingFoes === undefined, so this is a complete no-op for
  // every ability-less fixture (FID-02).
  if (C.pendingFoes && C.pendingFoes.length) {
    for (const nf of C.pendingFoes) {
      C.foes.push(nf);
      events.push({ type: "foeSummoned", name: nf.name, by: nf.summonedBy });
    }
    C.pendingFoes = null;
  }
  if (c.regen) { ... }
  for (const f of C.foes) { ... }
  ...
}
```

Because the append happens strictly BEFORE the `for (const f of C.foes)` loop begins iterating, this sidesteps PITFALLS.md's Pitfall 5 concern entirely (a foe pushed mid-loop-iteration would be visited in the SAME pass and could act the instant it appears) — the summoned foe becomes a completely ordinary member of `C.foes` for the loop that is ABOUT to start, i.e. it acts on the very foeTurn call following the one that queued it, exactly matching D-12's "at the START of the next foeTurn."

**Trade-off:** none — this is strictly additive, matching the codebase's own "zero-draw gate" architectural pattern (ARCHITECTURE.md Pattern 1) used by every prior feature (`c.regen`, `f.acid`, `C.allies`).

### Pattern 2: Bolt/drain delivery through an extended `applyFoeDamageToPlayer`

**What:** `applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, need })` (combat.js:896-981) is called ONLY after a hit is already decided by its caller — `roll`/`need` are NEVER used for a hit/miss gate inside this function; the only place they are read is the `struckByFoe` event's payload at lines 967-975 (`roll, need, critical: roll === 1`), purely for narration/UI. This means a bolt can call this helper safely without a melee-style to-hit roll of its own — D-02 says a bolt is "dice damage delivered through `applyFoeDamageToPlayer`," not "a bolt that rolls to hit," and CONTEXT.md never mentions a foe-bolt accuracy roll (unlike the player's own `thrown` spells in `magic.js`, which DO roll `d(dieN) <= target`). **[ASSUMED: a foe bolt has no separate to-hit roll — resistance (D-07) is its only counterplay. Flag for planner confirmation; the alternative is porting the player's `thrown`-kind accuracy roll, which would add one more gated draw per bolt.]**

Two additive extensions are needed to make the helper cover D-02's drain semantics ("bypasses armor but not ward") and to let a drain heal the foe by the ACTUAL applied amount:

```js
// engine/combat.js — extended signature (backward compatible: existing callers
// pass neither ignoresArmor nor read .applied, so this changes nothing for them)
export function applyFoeDamageToPlayer(state, foe, rng, events, { dmg, roll, need, ignoresArmor, ability } = {}) {
  ...
  const ignores = ignoresArmor ?? (foe.sp && foe.sp.noArmor);   // was: `foe.sp && foe.sp.noArmor` only
  ...
  if (onArmour) {
    events.push({ type: "armorSoaked", name: foe.name, amount: blocked });
    return { died: false, onArmour: true, applied: 0 };          // NEW: applied field
  }
  c.wp -= dmg;
  events.push(ability
    ? { type: "foeBolted", name: foe.name, ability, dmg, ignoresArmor: !!ignores, critical: false }
    : { type: "struckByFoe", name: foe.name, roll, need, dmg, ignoresArmor: !!ignores, critical: roll === 1 });
  if (c.wp <= 0) {
    die(state, "combat", foe.name, rng, events);
    return { died: true, onArmour: false, applied: dmg };        // NEW: applied field
  }
  return { died: false, onArmour: false, applied: dmg };          // NEW: applied field
}
```

Per D-02/D-11's explicit per-kind rules on which sub-pipelines apply:

| Ability kind | Hardiness | halfNext | ward | armor soak d20 | narration |
|---|---|---|---|---|---|
| **bolt** | applies (generic "reduce incoming blow") | applies | applies | **applies** (normal `ignoresArmor` = foe's own `sp.noArmor`, unchanged) | `foeBolted` (or `struckByFoe` with `ability` field — planner's call per D-16) |
| **drain** | applies [ASSUMED — CONTEXT doesn't exclude it; Hardiness/halfNext are generic "any landed blow" mitigations, not armor-specific] | applies | **applies** (ward eats it first, same as any other blow) | **skipped** (`ignoresArmor: true` passed explicitly — D-11 "bypasses armor but not ward") | `foeDrained` |

A bolt landing on armor still draws the gated `rng.d(20)` soak roll exactly like a melee hit — this is a NEW draw for any fight where a bolt targets an armored hero, but it is fully gated behind the ability actually firing (zero draws for every ability-less fixture, per FID-02).

**Drain's foe-side heal:** after the call, `foe.wp = Math.min(foe.maxWP, foe.wp + result.applied)` — using `applied` (post-Hardiness/ward, and always 0 if armor somehow still triggered, which it won't for a drain since `ignoresArmor:true` is passed) rather than the raw pre-mitigation `dmg`, so a warded/Hardiness-reduced drain heals the foe by only what it actually stole.

### Pattern 3: The member path (D-13) — reuse the existing simplified branch verbatim

**What:** `foeTurn`'s existing member branch (combat.js:1032-1057) is a SEPARATE, deliberately simplified pipeline (no ward/armor/Hardiness/die — see the branch's own header comment at 1034-1036 and the 17-02 SUMMARY's explicit note that this asymmetry is intentional, not an oversight). D-13 says bolts/drains on a member reuse this exact path: "straight `member.wp -= dmg`, `downMember`," with **no resist roll** (members carry no `intel` field at all — confirmed: `fixedAlly`/`C.allies` entries only ever have `{partyIdx, name, lvl, sub, wp, maxWP}`).

**Recommendation:** in `resolveFoeAbility`, after `pickFoeTarget(state, rng)` returns a non-null `member`:

```js
if (member) {
  // D-13: no resist roll (members have no intel); no ward/armor/Hardiness
  // (mirrors foeTurn's own simplified member branch exactly).
  let dmg = rollDice(rng, ability.dmg);
  member.wp -= dmg;
  events.push({ type: kind === "drain" ? "foeDrained" : "foeBolted", name: f.name, member: member.name, dmg });
  if (kind === "drain") f.wp = Math.min(f.maxWP, f.wp + dmg);   // drain heals off the RAW dmg for a member (no ward to net out)
  if (member.wp <= 0) downMember(state, member, events);
  return events;
}
// (hero path: resistRoll gate, then applyFoeDamageToPlayer, as in Pattern 2)
```

Debuffs and heal/summon never call `pickFoeTarget` at all (D-13: "Debuffs... always target the hero; heal/summon are untargeted"), so they cannot draw the party-targeting roll — this preserves the zero-draw gate for solo fixtures exactly as `pickFoeTarget`'s own JSDoc already documents (combat.js:840-847).

### Pattern 4: Symmetric resistance — `resistRoll` extraction, and the module-cycle it must avoid

**What (current code, exact):** `magic.js#castSpell`'s inline block (magic.js:88-100):

```js
if (C && !RESIST_IMMUNE_KINDS.has(sp.kind)) {
  const t = liveFoes(state)[0];
  if (t && (t.intel ?? 0) >= 12) {
    const r = rng.d(20);
    if (r < t.intel) {
      events.push({ type: "spellResisted", target: t.name, spell: sp.n, roll: r, intel: t.intel });
      afterPlayerAction(state, rng, events);
      return events;
    }
    events.push({ type: "resistFailed", target: t.name, roll: r });
  }
}
```

**Draw-neutral refactor:**

```js
// engine/derived.js — NOT engine/magic.js (see the module-cycle finding below)
export function resistRoll(rng, intel) {
  if ((intel ?? 0) < 12) return { rolled: false, resisted: false, roll: undefined };
  const roll = rng.d(20);
  return { rolled: true, resisted: roll < intel, roll };
}
```

```js
// magic.js's castSpell, refactored call site — byte-identical control flow/events
if (C && !RESIST_IMMUNE_KINDS.has(sp.kind)) {
  const t = liveFoes(state)[0];
  if (t) {
    const { rolled, resisted, roll } = resistRoll(rng, t.intel);
    if (rolled) {
      if (resisted) {
        events.push({ type: "spellResisted", target: t.name, spell: sp.n, roll, intel: t.intel });
        afterPlayerAction(state, rng, events);
        return events;
      }
      events.push({ type: "resistFailed", target: t.name, roll });
    }
  }
}
```

**Parity proof:** the `cast-damage` magic fixture (seed 8, Beasts, forces a Shriek — `content/bestiary.js:26`, `i: 1`) never enters the `rolled` branch at all (`1 < 12`), on EITHER side of the refactor — the outer `if (t.intel >= 12)` gate and the new `if ((intel ?? 0) < 12) return {rolled:false}` early-out are the exact same boolean test, just relocated. No byte can move for this fixture.

**Callers after this phase:** (1) `magic.js#castSpell` (foe resists player, reads `foe.intel`, unchanged event names) and (2) `engine/foeAbilities.js#resolveFoeAbility` (player resists foe, reads `state.c.intel`, NEW events `heroResisted`/`heroResistFailed`).

**⚠️ Module-cycle finding (not addressed in CONTEXT.md — surface to the planner):** D-07 literally says `resistRoll` is "exported from `engine/magic.js`." But `engine/magic.js` already imports `liveFoes`/`killFoe`/`afterPlayerAction` FROM `engine/combat.js` (magic.js:25). This phase's `engine/combat.js#foeTurn` must call `resolveFoeAbility` from the NEW `engine/foeAbilities.js`. If `foeAbilities.js` in turn imports `resistRoll` from `magic.js`, the dependency graph becomes `combat.js → foeAbilities.js → magic.js → combat.js` — a circular ES-module import. (Even the simpler alternative — `combat.js` importing `resistRoll` from `magic.js` directly — is ALSO already circular today, since `magic.js → combat.js` exists.) **Recommendation: home `resistRoll` in `engine/derived.js` instead** — `derived.js` imports only `content/index.js` and `dice.js` (zero engine-internal imports), making it the only truly cycle-safe leaf module, and it already hosts the other character-stat-derived pure helpers (`intelBonus`, `armorSoak`, `conditionsOf`). Both `magic.js` and `foeAbilities.js` import it from there with no cycle. This is a deviation from D-07's literal file path but preserves its full intent (one shared helper, one d20 shape, reused both directions) — flag it for the planner/discuss-phase to explicitly re-confirm before locking task file lists.

### Pattern 5: `c.foeEffect` — write sites, read sites, tick, and clear

**Write (debuff kind, hero-only, D-09/D-10):**
```js
c.foeEffect = { kind: ability.effect, rounds: rng.d(4) };  // "weakened" | "dazed"; new debuff replaces old (same shape overwrite)
events.push({ type: "foeDebuffed", name: f.name, kind: ability.effect, rounds: c.foeEffect.rounds });
```

**Read site 1 — dealt-damage halving ("weakened"):** `playerStrike` computes `dmg` at combat.js:345 (`let dmg = weaponDamage(c, rng);`) then doubles on crit at line 406 (`if (crit) dmg *= 2;`), then calls `damageFoe` at line 412. Insert the halving right before the `damageFoe` call:
```js
if (c.foeEffect && c.foeEffect.kind === "weakened" && c.foeEffect.rounds > 0) dmg = Math.ceil(dmg / 2);
const landed = damageFoe(state, t, dmg, { kind: "melee", ... }, rng, events);
```
This mirrors the foe-side `C.weakened` halving already present at combat.js:1069 (`if (C.weakened) dmg = Math.ceil(dmg / 2);`) — same rounding, opposite direction.

**Read site 2 — to-hit penalty ("dazed"):** `derived.js#toHit(state)` (284-296) computes `h` then applies several additive/clamping adjustments; insert after `h += eff(c, "toHit");` (line 293) and before the in-dark clamp:
```js
if (c.foeEffect && c.foeEffect.kind === "dazed" && c.foeEffect.rounds > 0) h = Math.max(1, h - 2);
```
(`toHit`'s local `c` IS `state.c`, already in scope.)

**Tick (once per `foeTurn` call, alongside ward/mirror):** insert right after combat.js:1080 (`if (c.mirror > 0 && --c.mirror <= 0) events.push(...)`):
```js
if (c.foeEffect && --c.foeEffect.rounds <= 0) {
  events.push({ type: "foeEffectFaded", kind: c.foeEffect.kind });
  c.foeEffect = null;
}
```

**Clear (combat-scoped, D-09):** `endCombat` (658-682) already resets `c.regen`/`c.ward`/`c.mirror`/`c.senses` unconditionally — add `state.c.foeEffect = null;` to that same block.

**`conditionsOf` (derived.js:139-193):** add one BAD-condition line, following the file's existing pattern:
```js
if (c.foeEffect && c.foeEffect.rounds > 0) {
  out.push({ key: "foeEffect", polarity: "bad", kind: c.foeEffect.kind, remaining: c.foeEffect.rounds });
}
```

**⚠️ UI chip finding (must not be skipped — flag prominently):** `mazeworld.html`'s `paintConditions()` (2786-2817) resolves a chip's label via `CONDITION_COPY[cn.key]?.label || cn.key` UNLESS the key is `affliction` or `phobia`, which get a hand-written special case (`Phobia: ${cn.phobia}`). A raw `{key:"foeEffect", kind:"weakened"}` descriptor with NO matching special case would render the literal string `"foeEffect"` as the chip label — a visible, unpolished regression. This requires a small edit to the EXISTING chip renderer (not a new UI element — same track, same mechanism, satisfying "no new screens"):
```js
// CONDITION_COPY additions are insufficient alone (kind-specific, not key-specific) — add a case:
let label = cn.key === "affliction" ? (cn.kind || "Afflicted")
  : cn.key === "phobia" ? `Phobia: ${cn.phobia || "Fear"}`
  : cn.key === "foeEffect" ? (FOE_EFFECT_LABEL[cn.kind] || cn.kind)   // NEW
  : (CONDITION_COPY[cn.key]?.label || cn.key);
// where: const FOE_EFFECT_LABEL = { weakened: "Weakened", dazed: "Dazed" };
```

### Pattern 6: Flee/pursue (D-08, CANON-02's Spectre clause)

**What:** `flee()` (combat.js:487-517) has FOUR distinct success exits, each calling `endCombat` directly: Samurai refusal is a FAILURE (not relevant); Cloaker's unconditional escape (495-499); a round-1 tracked withdrawal (500-504); and the roll-based success (`roll + bonus >= 11`, 508-512). D-08 says "when the hero SUCCEEDS at fleeing from a fight containing a live `pursues` foe, that foe gets ONE free melee strike as the hero leaves" — CONTEXT does not scope this to only the roll-based success, so the safest reading is ALL FOUR success paths trigger it (a Spectre "follows" regardless of how cleanly the hero thinks they got away).

**Recommendation:** factor a tiny local helper called at the top of each success branch, before `endCombat`:
```js
function spectrePursuitStrike(state, rng, events) {
  const pursuer = liveFoes(state).find((f) => f.sp && f.sp.pursues);
  if (!pursuer) return false; // 0 draws — the overwhelmingly common case
  const dieN = foeDie(state.c, pursuer);
  const roll = rng.d(dieN);
  const need = foeToHitVs(state);
  events.push({ type: "foePursued", name: pursuer.name });
  if (roll > need) { events.push({ type: "foeMissed", name: pursuer.name, roll, need }); return false; }
  const dmg = pursuer.lvl * pursuer.lvl + (pursuer.sp?.dmg ? rollDice(rng, pursuer.sp.dmg) : rng.d(6));
  const hit = applyFoeDamageToPlayer(state, pursuer, rng, events, { dmg, roll, need });
  return hit.died; // true means die() already ran and nulled state.combat — caller MUST NOT call endCombat
}
```
Each success branch becomes: `if (spectrePursuitStrike(state, rng, events)) return events; /* died mid-flee */ endCombat(state, events);`

**[ASSUMED]** — CONTEXT.md doesn't specify whether the pursuit strike auto-hits or rolls to-hit normally; the above assumes a normal rolled swing (to-hit + damage), matching every other foe attack in the engine. An auto-hit variant is simpler but has no precedent to mirror; flag for planner confirmation.

**Critical control-flow note (mirrors the 17-02 Pitfall exactly):** `applyFoeDamageToPlayer`'s `died: true` means `die()` already ran and nulled `state.combat` — a fleeing hero CAN die to the pursuit strike instead of escaping. `flee()` must check this and return immediately without a second `endCombat(state, events)` call, exactly as `foeTurn`'s own `if (hit.died) return events;` pattern already does at combat.js:1073.

### Pattern 7: Djinni's flee-without-XP exit (D-03) — an existing, proven precedent

**What:** the "leave the fight, pay no XP" mechanic ALREADY exists in three call sites today, unmodified:
- `startCombat`'s Knight/Con-Artist branches (combat.js:213-221): `f.alive = false; f.fled = true; events.push({type:"foeFled", ...})`.
- `magic.js#castSpell`'s `insane` kind, roll 3 or 6 (magic.js:298-302): identical `alive=false; fled=true` shape.

Both rely on `liveFoes(state)` filtering purely on `f.alive` (combat.js:65-67), and `killFoe` is never called on this path (so no XP/loot/wilmst rolls happen — those all live inside `killFoe`). `afterPlayerAction`'s cleared-encounter check (`!liveFoes(state).length`) already treats an all-fled roster as `encounterCleared` correctly with zero code changes needed. `foeFled` ALREADY has an `EVENT_NARRATION` entry (eventNarration.js:136) — Djinni's low-HP flee needs **no new event type**, only a new call site inside `resolveFoeAbility` (checked at the start of the Djinni's own turn, per CONTEXT's "Claude's Discretion" recommendation, before the d6 cast-check):
```js
if (f.name === "Djinni" && f.wp < f.maxWP * 0.25) {
  f.alive = false; f.fled = true;
  events.push({ type: "foeFled", name: f.name, reason: "lowHp" });
  continue; // no swing, no cast — the Djinni is gone
}
```
This check is keyed on `f.name === "Djinni"` (or a dedicated `sp.fleesAtLowHp` flag set only on the Djinni bestiary entries) rather than a generic mechanic, matching FEATURES.md's own finding that canon assigns specials per-NAMED-creature, not per encounter type.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hero-damage pipeline (ward/armor/Hardiness) for a foe bolt | A parallel damage-application function inside `foeAbilities.js` | Extended `applyFoeDamageToPlayer` (Pattern 2) | Duplicating this pipeline risks a subtle divergence (e.g. forgetting the Pendant of Fortitude's `halfNext` or a ward-reflect kill) that only surfaces in a rare item/spell combo |
| Foe-vs-foe or foe-vs-hero damage math (soak/multiplier) | A second "spell damage to hero" formula | `damageFoe` is NOT reused directly for foe→hero damage (it's foe-damage-taken only); `applyFoeDamageToPlayer` is the correct existing seam | `damageFoe`'s module header explicitly scopes it to damage a foe TAKES, never damage a hero takes |
| Party-member targeting for a bolt/drain | A second target-pool roll inside `foeAbilities.js` | `pickFoeTarget(state, rng)` (Pattern 3) | Already tested, already the single source of the "hero vs. live member" die-size math |
| Symmetric resist math | A second, hand-copied `d20 < intel` check inside `foeAbilities.js` | The relocated `resistRoll` (Pattern 4) | PITFALLS.md Pitfall 9's own explicit warning: "two separate, hand-written checks... could silently diverge on a later edit" |
| Summon roster append | A parallel `C.foeAllies`/second array | `C.foes.push(...)` at the top of the NEXT `foeTurn` (Pattern 1) | ARCHITECTURE.md's own Anti-Pattern 3: a summoned creature IS a foe — reuse `killFoe`/`liveFoes`/targeting unmodified |

**Key insight:** every mechanic this phase needs is a small variation on a pattern the engine already implements correctly and has already unit-tested (zero-draw gates, deferred-join queues, fled-without-XP exits, a shared damage pipeline). The main risk in this phase is NOT inventing new mechanics — it's threading five kinds through the EXISTING seams without breaking their contracts (draw order, return shapes, event narration coverage).

## Common Pitfalls

### Pitfall 1: The `resistRoll` home creates an import cycle if placed exactly where D-07 says
**What goes wrong:** `engine/foeAbilities.js` imports `resistRoll` from `engine/magic.js`, which already imports from `engine/combat.js`, which must import `resolveFoeAbility` from `engine/foeAbilities.js` — a 3-file cycle that either throws at module load (depending on evaluation order) or silently resolves to `undefined` for one of the bindings.
**How to avoid:** home `resistRoll` in `engine/derived.js` instead (Pattern 4). Both `magic.js` and `foeAbilities.js` import it from there with zero risk.
**Warning signs:** `npm test` fails with "Cannot access 'X' before initialization" or a function import resolving to `undefined` only in specific test-file import orders.

### Pitfall 2: `applyFoeDamageToPlayer`'s `roll`/`need` are load-bearing for narration, not gating — passing garbage values still "works" but produces a nonsense event
**What goes wrong:** since `roll`/`need` are never used for hit/miss inside the helper, it's tempting to pass `{roll: 0, need: 0}` for a bolt and reuse `struckByFoe` verbatim — this renders "0 vs 0. It hits you for X hp," a visibly broken narration line that would still pass the coverage guard (a non-empty string) and possibly the safety scan (no banned words), shipping silently.
**How to avoid:** extend the helper with an `ability` option that switches to a NEW `foeBolted` event omitting the roll/need fields entirely (Pattern 2), rather than stuffing dummy values into `struckByFoe`'s existing shape.
**Warning signs:** a DR-round playtest log showing "0 vs 0" text; a code review that doesn't read the actual rendered narration string, only checks the test is green.

### Pitfall 3: A caster with an exhausted ability kit must fall through to melee with ZERO extra draws
**What goes wrong:** if the `rng.d(6)` cast-check roll is drawn UNCONDITIONALLY whenever `f.abilities.length > 0` (rather than gated on `hasReadyAbility(f)` first), a Djinni that has used all 4 charges of every ability still draws an extra d6 every remaining round of the fight, silently diverging any test that pins a caster's total draw count for a long fight.
**How to avoid:** the readiness check (`firstReadyAbility`) must run BEFORE the d6 roll and gate it — see Pattern 1's exact code shape.
**Warning signs:** a determinism test pinning a caster's full-fight draw count fails only on long fights (many rounds after the kit is exhausted), not short ones.

### Pitfall 4: The `C.pendingFoes` join must never happen mid-loop
**What goes wrong:** if the summon-queue drain is placed INSIDE the `for (const f of C.foes)` loop (e.g., right after the summon ability resolves, appending directly to `C.foes` mid-iteration), the newly-pushed foe is visited by the SAME `for...of` pass (arrays grow-safe iteration in JS) and could act in the same round it was summoned — violating D-12 ("joins on the FOLLOWING round") and PITFALLS.md's Pitfall 5.
**How to avoid:** the summon ability ONLY ever pushes to `state.combat.pendingFoes` (a separate array); the actual `C.foes.push(...)` happens exclusively at the TOP of the NEXT `foeTurn` call, strictly before the loop starts (Pattern 1).
**Warning signs:** a summoned foe's very first event-log appearance is also a `foeMissed`/a swing event in the SAME action's event list as the `foeSummoned` event.

### Pitfall 5: `c.foeEffect` surviving a save/load with a stale value
**What goes wrong:** `saveState.js#rehydrate` always force-resets `combat: null` (line 203) but has NO analogous reset for `c.foeEffect` — if a save is somehow captured while `c.foeEffect` is non-null (mid-combat), reload nulls `state.combat` but leaves the stale debuff active on `state.c`, silently halving the hero's damage or lowering their to-hit forever (since the debuff's own decrement only happens inside `foeTurn`, which will never run again without a fight).
**How to avoid:** add `state.c.foeEffect = null;` to `rehydrate()` right beside the existing `combat: null` reset, and mirror it in `validateSave`'s returned `value.c` if `migrateCarry`-style normalization is used there too.
**Warning signs:** a save/load round-trip test that never sets `c.foeEffect` in the first place would NOT catch this — the test must explicitly construct a save object with a non-null `c.foeEffect` to prove the reset works (an easy gap to leave uncovered).

### Pitfall 6: A raw `"foeEffect"` string ships as the chip label
See Pattern 5's UI chip finding above — this is a real, easy-to-miss gap since `conditionsOf`'s own unit tests (engine-side) would pass perfectly with zero HTML changes; only a DR-round visual check or a `mazeworld.html`-level test would catch the missing label mapping.

### Pitfall 7: `content/foe-abilities.js`'s `txt` strings are NOT auto-covered by the safety scan
**What goes wrong:** `test/voice/safety-scan.test.js`'s Corpus 3 (`collectAuthoredStrings`) enumerates specific content banks by name (`SPELLS.forEach(...)`, `POTIONS.forEach(...)`, etc.) — it does NOT dynamically discover new content modules. A new `content/foe-abilities.js` with unvetted `txt` flavor strings ships with zero automated family-friendly coverage unless a new `FOE_ABILITIES.forEach((a) => push(...))` line is explicitly added to `collectAuthoredStrings()`.
**How to avoid:** add that line as part of the narration task, not as an afterthought — treat it as an acceptance criterion of D-16's "every new event type needs an entry," extended to "every new content bank needs a Corpus-3 line."
**Warning signs:** the safety-scan test suite stays green (it can't fail on strings it never sees) while the actual `foe-abilities.js` copy is never scanned — a false sense of coverage.

### Pitfall 8 (inherited from PITFALLS.md — still applies): party-member interaction needs its own dedicated tests
Every ability's plan must state explicitly how it behaves against a live party member (bolt/drain reuse the simplified path per Pattern 3; debuff/heal/summon never target a member at all) — and since NO parity fixture exercises a non-empty party, this can ONLY be caught by new, dedicated unit tests (`test/unit/party-combat.test.js` or a new `foe-abilities.test.js` section), not by the parity suite.

## Code Examples

### `content/foe-abilities.js` — pure-data registry shape (D-01)
```js
// content/foe-abilities.js
// Pure-data ability registry, referenced by id from content/bestiary.js's
// new `abilities: [id, ...]` array. No functions (content-is-pure-data guard).
export const FOE_ABILITIES = [
  { id: "krupkeFreeze",  kind: "bolt",   lvl: 1, dmg: { n: 1, sides: 6, bonus: 0 }, txt: "a chill spreads from an outstretched hand" },
  { id: "krupkeWeaken",  kind: "debuff", lvl: 1, effect: "weakened", txt: "your grip loosens, mid-swing" },
  { id: "drudgeFireball", kind: "bolt",  lvl: 3, dmg: { n: 2, sides: 10, bonus: 4 }, every: undefined, txt: "a wordless gesture, and the air catches fire" },
  { id: "drudgeLightning", kind: "bolt", lvl: 4, dmg: { n: 1, sides: 10, bonus: 6 }, txt: "a crack of ozone and light" },
  { id: "drakeBreath",   kind: "bolt",   lvl: 4, dmg: { n: 2, sides: 10, bonus: 4 }, every: 4, txt: "the Drake inhales, and you remember you are flammable" },
  { id: "vampireDrain",  kind: "drain",  lvl: 5, dmg: { n: 2, sides: 6, bonus: 0 }, txt: "cold fingers close, and something is taken" },
  { id: "vampireSummon", kind: "summon", lvl: 5, effect: { type: "Walking Dead", tier: 2 }, txt: "the Vampire gestures, unbothered, and the dead oblige" },
  { id: "stalkaHeal",    kind: "heal",   lvl: 5, dmg: { n: 1, sides: 10, bonus: 0 }, txt: "wounds knit themselves shut, unimpressed" },
];
```

### `engine/foeAbilities.js` — the resolver skeleton (Pattern 1/2/3 wired together)
```js
// engine/foeAbilities.js
import { FOE_ABILITIES, BESTIARY } from "../content/index.js";
import { rollDice } from "./dice.js";
import { resistRoll } from "./derived.js";
import { pickFoeTarget, applyFoeDamageToPlayer, downMember } from "./combat.js"; // downMember needs exporting (currently module-private)

const RESISTIBLE_KINDS = new Set(["bolt", "drain", "debuff"]);
const byId = new Map(FOE_ABILITIES.map((a) => [a.id, a]));

export function firstReadyAbility(f) {
  for (const id of f.abilities || []) {
    const a = byId.get(id);
    if (a.every !== undefined && (f.cd?.[id] ?? 0) > 0) continue;
    if (a.uses !== undefined && (f.uses?.[id] ?? a.uses) <= 0) continue;
    return a;
  }
  return null;
}

export function tickAbilityCooldowns(f) {
  if (!f.cd) return;
  for (const id of Object.keys(f.cd)) if (f.cd[id] > 0) f.cd[id]--;
}

export function resolveFoeAbility(state, f, ability, rng, events) {
  const c = state.c;
  events.push({ type: "foeCast", name: f.name, ability: ability.id, kind: ability.kind });

  if (ability.kind === "heal") {
    const amt = rollDice(rng, ability.dmg);
    f.wp = Math.min(f.maxWP, f.wp + amt);
    events.push({ type: "foeHealed", name: f.name, amount: amt });
    return events;
  }
  if (ability.kind === "summon") {
    if ((state.combat.pendingFoes?.length ?? 0) >= 1) return events;        // D-12 cap: 1 pending at a time
    if (state.combat.foes.filter((x) => x.alive).length >= 4) return events; // D-12 cap: live foes < 4
    const roster = BESTIARY[ability.effect.type][ability.effect.tier - 1];
    const picked = rng.pick(roster);
    const nf = { name: picked.n, type: ability.effect.type, lvl: Math.max(1, f.lvl - 1), size: picked.sz,
      intel: picked.i, wp: picked.wp, maxWP: picked.wp, alive: true, asleep: 0, sp: picked.sp || {}, lives: 1,
      summonedBy: f.name };
    state.combat.pendingFoes = [...(state.combat.pendingFoes || []), nf];
    events.push({ type: "foeSummoned", name: nf.name, by: f.name, pending: true });
    return events;
  }

  // bolt / drain / debuff — resist-gated, target-aware
  const member = ability.kind === "debuff" ? null : pickFoeTarget(state, rng);
  if (!member) {
    // hero-targeted (bolt/drain always try hero unless a member was picked; debuff is hero-only by construction)
    if (RESISTIBLE_KINDS.has(ability.kind)) {
      const { rolled, resisted, roll } = resistRoll(rng, c.intel);
      if (rolled) {
        events.push(resisted
          ? { type: "heroResisted", ability: ability.id, roll, intel: c.intel }
          : { type: "heroResistFailed", ability: ability.id, roll });
        if (resisted) return events; // 0 effect
      }
    }
    if (ability.kind === "debuff") {
      c.foeEffect = { kind: ability.effect, rounds: rng.d(4) };
      events.push({ type: "foeDebuffed", name: f.name, kind: ability.effect, rounds: c.foeEffect.rounds });
      return events;
    }
    const dmg = rollDice(rng, ability.dmg);
    const opts = ability.kind === "drain" ? { dmg, ignoresArmor: true, ability: ability.id } : { dmg, ability: ability.id };
    const hit = applyFoeDamageToPlayer(state, f, rng, events, opts);
    if (ability.kind === "drain" && hit.applied) f.wp = Math.min(f.maxWP, f.wp + hit.applied);
    return events;
  }
  // member-targeted bolt/drain — Pattern 3
  const dmg = rollDice(rng, ability.dmg);
  member.wp -= dmg;
  events.push({ type: ability.kind === "drain" ? "foeDrained" : "foeBolted", name: f.name, member: member.name, dmg });
  if (ability.kind === "drain") f.wp = Math.min(f.maxWP, f.wp + dmg);
  if (member.wp <= 0) downMember(state, member, events);
  return events;
}
```
*(`downMember` is currently a module-private function in `combat.js` — line 820, no `export` keyword. It needs to become an exported function for `foeAbilities.js` to reuse it, exactly the same "extract and export" step Phase 17 already applied to `pickFoeTarget`/`applyFoeDamageToPlayer`.)*

## Runtime State Inventory

Not applicable — this is a greenfield feature-addition phase (new abilities, new resistance direction), not a rename/refactor/migration phase. No existing runtime state (stored data, live service config, OS-registered state, secrets, build artifacts) needs auditing.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A foe bolt has no separate to-hit roll (only the INT resist gates it) | Pattern 2 | If a to-hit roll is actually wanted, `applyFoeDamageToPlayer`'s call site needs an extra gated `rng.d()` draw added before it, changing the draw-count pins in Pattern 1/Determinism Tests |
| A2 | Hardiness and `c.halfNext` (Pendant of Fortitude) apply to drain damage, only the armor-soak is skipped | Pattern 2 | If drain should bypass Hardiness/halfNext too, the extension needs a second override flag rather than reusing the existing pipeline order |
| A3 | Drake's `every:4` cooldown initializes to `every - 1` on first check (first breath at round 4, not round 1 or 5) | Pattern 1 | An off-by-one here changes WHEN Drake's breath first fires — directly testable/pinnable, but wrong without an explicit CONTEXT ruling |
| A4 | The Spectre pursuit strike rolls normally (to-hit + damage) rather than auto-hitting | Pattern 6 | If it should auto-hit, the draw count for a successful flee-with-pursuer changes (fewer draws: just the damage roll, no to-hit roll) |
| A5 | The pursuit strike fires on ALL FOUR flee-success exits (Cloaker/tracked/roll-based), not only the roll-based one | Pattern 6 | If CANON-02 only intends it for the ordinary roll-based flee, Cloaker/tracked-round-1 fixtures (if any exist) would need to stay pursuit-free |
| A6 | `resistRoll` is relocated to `engine/derived.js` instead of `engine/magic.js` as D-07 literally states | Pattern 4 | This is a structural necessity (avoids an import cycle), not a stylistic choice — low risk of being "wrong," but it IS a deviation from the locked decision's literal wording that needs explicit sign-off |
| A7 | Djinni's "flees at <25% HP" check runs at the START of its own turn, before the d6 cast-check (CONTEXT's own stated recommendation under "Claude's Discretion") | Pattern 7 | If checked after a swing/cast instead, a Djinni could act once more below the threshold before fleeing |
| A8 | The dice-per-ability table in the Dice Budget section (below) is the planner's actual chosen numbers | Dice Budget | CONTEXT explicitly leaves "exact dice per ability" to planner discretion within the ~50% cap — these are illustrative, not locked |

**If this table is empty:** N/A — see rows above; every assumption is either a structural necessity (A6) or an explicitly-deferred discretionary choice CONTEXT.md itself flags as open (A1, A3, A4, A5, A7, A8), or a reasonable default that should be confirmed once (A2).

## Open Questions

1. **Does a foe bolt roll its own to-hit, or is INT resistance its only counterplay?**
   - What we know: D-02 only says "dice damage delivered through `applyFoeDamageToPlayer`"; the player's own `thrown` spells DO roll a separate accuracy check.
   - What's unclear: whether omitting a to-hit roll makes bolts feel too reliable/unfair without the fairness valve of a miss chance.
   - Recommendation: default to no separate roll (matches D-02's literal wording, keeps the draw count minimal); revisit in the Phase 21 DR round if bolts feel unfairly reliable.

2. **Should the Spectre pursuit strike apply to the Cloaker/tracked-round-1 "free" flee exits, or only the ordinary roll-based one?**
   - What we know: D-08 says "when the hero SUCCEEDS at fleeing... that foe gets ONE free melee strike."
   - What's unclear: whether a Cloaker's or a tracked round-1's "clean, no-roll" escape should still eat a pursuit strike (thematically it's a weaker escape than a Cloaker deserves).
   - Recommendation: apply it to all four exits for simplicity and consistency (Pattern 6); flag as a discuss-phase confirmation point if the planner wants to carve out an exception.

3. **Where exactly does `downMember` need to become exported, and does that risk any parity surface?**
   - What we know: `downMember` (combat.js:820, currently module-private) is needed by `foeAbilities.js` for a member-targeted bolt/drain that downs a party member.
   - What's unclear: none functionally — exporting a previously-private function is a zero-risk, additive change (it changes no behavior, only visibility).
   - Recommendation: export it in the same commit that adds the ability-attempt gate, mirroring how `pickFoeTarget`/`applyFoeDamageToPlayer` were extracted-and-exported in Phase 17.

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependencies beyond the project's existing Node.js + `node:test` toolchain, already verified working (per STATE.md: `npm test` 796/796 passing as of Phase 18's close).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node.js built-in, no external test runner) |
| Config file | none — `package.json`'s `"test": "node --test"` script |
| Quick run command | `node --test test/unit/foe-abilities.test.js` (Windows: use the explicit file path, never a bare directory arg — see Phase 17 SUMMARY's noted Git-Bash quirk) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOE-01 | Ability-less foe draws zero extra rng | unit | `node --test test/unit/foe-turn-draw-count.test.js` | ✅ (extend) |
| FOE-01 | `content/foe-abilities.js` is pure data | unit | `node --test test/determinism/content-is-pure-data.test.js` | ✅ (auto-covers new module via barrel) |
| FOE-02 | Bolt damage goes through ward/armor/Hardiness | unit | `node --test test/unit/foe-abilities.test.js` (new) | ❌ Wave 0 |
| FOE-03 | Drain heals foe by applied amount; debuff sets/ticks/clears `c.foeEffect`; heal caps at maxWP | unit | `node --test test/unit/foe-abilities.test.js` | ❌ Wave 0 |
| FOE-04 | Summon queues, joins next `foeTurn`, doesn't act same round, respects caps | unit | `node --test test/unit/foe-abilities.test.js` | ❌ Wave 0 |
| FOE-05 | Each canon caster's kit matches its bestiary `abilities` entry | unit | `node --test test/unit/content-tables.test.js` (extend) | ✅ (extend) |
| FOE-06 | Cooldown/uses gating; `every:4` fires on rounds 4/8; `foeOutOfSpells` on exhaustion | unit | `node --test test/unit/foe-abilities.test.js` | ❌ Wave 0 |
| FOE-07 | `resistRoll` shared by both directions; gated on intel>=12; `cast-damage` fixture unaffected | unit + parity | `node --test test/unit/foe-abilities.test.js` + `node --test "test/parity/**/*.test.js"` | ❌ Wave 0 (unit) / ✅ (parity) |
| FOE-08 | `conditionsOf` surfaces `foeEffect`; every new event type narrated + safety-scanned | unit | `node --test test/unit/conditions.test.js` + `node --test test/unit/formatEventsCoverage.test.js` + `node --test test/voice/safety-scan.test.js` | ✅ (extend all three) |
| FOE-09 | Member-targeted bolt/drain; determinism on Magical/Demons/Walking Dead/Humans-t2/Beasts-t5 | unit + determinism | `node --test test/unit/foe-abilities.test.js` + `node --test test/determinism/foe-abilities.test.js` | ❌ Wave 0 (both) |
| CANON-02 | Spectre pursuit strike on flee; Drudge never melees; Drake's `every:4` breath | unit | `node --test test/unit/combat.test.js` (extend, flee section) + `test/unit/foe-abilities.test.js` | ⚠️ combat.test.js exists, extend; foe-abilities.test.js Wave 0 |
| FID-04 | All 3 `*Comparable()` carve-outs; v1.0 save round-trips | unit + parity | `node --test test/unit/save-validation.test.js` (extend) + `node --test "test/parity/**/*.test.js"` | ✅ (extend save-validation.test.js) |

### Sampling Rate
- **Per task commit:** `node --test <the file(s) touched by that task>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (`npm test`) before `/gsd-verify-work`, plus `node --test "test/parity/**/*.test.js"` explicitly re-run and confirmed byte-identical (30/30) with zero fixture/master/comparables-rationale-free edits.

### Wave 0 Gaps
- [ ] `test/unit/foe-abilities.test.js` — the resolver's own unit tests (all 5 kinds, resist gate, cooldown/uses lazy-init, member path) — covers FOE-01..04, FOE-06, FOE-07, FOE-09
- [ ] `test/determinism/foe-abilities.test.js` — forced-encounter-type replay-identity + draw-count pins for Magical/Demons/Walking Dead/Humans-tier-2/Beasts-tier-5 — covers FOE-09/D-15
- [ ] Framework install: none — `node:test` is already the project's only test runner

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | offline, single-player, no accounts |
| V3 Session Management | no | offline, no sessions |
| V4 Access Control | no | single local player, no privilege boundaries |
| V5 Input Validation | yes | `validateSave`/`rehydrate`'s existing fail-closed shape checks must extend to tolerate (not crash on) a save with a tampered/malformed `c.foeEffect`, `f.abilities`, `f.cd`, `f.uses`, or `combat.pendingFoes` — see Pitfall 5 |
| V6 Cryptography | no | no crypto in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A tampered/malformed save with `c.foeEffect.rounds` set to a non-number (e.g. `"999"` or `-Infinity`) | Tampering | `c.foeEffect` is never actually persisted through a real save cycle mid-combat today (combat always resets), and this phase should FORCE it to `null` on load (Pitfall 5) rather than trust/sanitize an arbitrary saved value — the cheapest, most correct mitigation is "never let it survive a load" rather than validating its shape |
| An unbounded summon count (a malformed/tampered save somehow reviving a mid-fight `pendingFoes` array with many entries) | Denial of Service (runaway array growth) | The `<1 pending` and `live foes < 4` caps (D-12) are enforced at QUEUE time inside `resolveFoeAbility`, which only ever runs from live gameplay (never from save data) — combined with `combat` always being nulled on load, this is a non-issue for the save-tampering threat model; the caps exist purely for gameplay balance, not security |

## Sources

### Primary (HIGH confidence — direct code read)
- `engine/combat.js` (full file: `startCombat` 98-276, `playerStrike` 287-418, `killFoe` 426-479, `flee` 487-517, `canParley`/`parley` 523-593, `pickFoeTarget` 853-860, `applyFoeDamageToPlayer` 896-981, `foeTurn` 992-1082, `downMember` 820-831) — every insertion point and existing contract cited above
- `engine/magic.js` (full file: `castSpell` 48-376, the resist block 88-100, `RESIST_IMMUNE_KINDS` 36)
- `engine/foeDamage.js` (full file: `multiplierFor`/`damageFoe`)
- `engine/derived.js` (full file: `conditionsOf` 139-193, `toHit` 284-296, `intelBonus` 391-394, `armorSoak` 216-227)
- `engine/death.js`, `engine/saveState.js` (full files)
- `test/parity/harness/comparables.js` (full file — every `strip*Field` precedent and its rationale)
- `content/bestiary.js`, `content/spells.js`, `content/index.js` (full files)
- `tools/bestiary-yardstick.mjs` (full file — `HERO_HP` tier table, `computeYardstick`/`computeRow` formulas)
- `test/parity/FIXTURE-INVENTORY.md` (full file — the parity-exposed roster and FID-02 draw-count baseline)
- `test/unit/foe-turn-draw-count.test.js` (full file — `countingRng`, `fakeRng`, `runFullFight` patterns to model new tests on)
- `test/unit/party-combat.test.js` (`pickFoeTarget` test section)
- `test/unit/foe-damage.test.js` (the Phase 18 seam-only invariant test pattern)
- `test/unit/save-validation.test.js` (existing round-trip/old-shape-save test patterns; confirmed NO dedicated v1.0 fixture file exists — synthetic objects are built inline)
- `test/unit/formatEventsCoverage.test.js`, `test/voice/safety-scan.test.js` (full files — coverage-guard derivation mechanism, safety-scan Corpus 1/2/3 structure)
- `src/browser/eventNarration.js` (relevant sections: combat.js-sourced entries lines 120-231, magic.js-sourced resist entries 230-231/266-267)
- `mazeworld.html` (lines 2766-2817 — `CONDITION_COPY`/`paintConditions`, confirming the fallback-label gap)
- `.planning/phases/17-fixture-inventory-foe-turn-refactors/17-02-SUMMARY.md`, `17-03-SUMMARY.md` — the extraction precedent and draw-count baseline provenance
- `.planning/phases/18-bestiary-rebalance-canon-combat-fixes/18-02-SUMMARY.md`, `18-03-SUMMARY.md`, `18-06-SUMMARY.md` — the `damageFoe` seam and its invariant test pattern
- `.planning/phases/19-.../19-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md` — full reads, cross-referenced throughout
- `.planning/config.json` — confirmed `nyquist_validation: true`, `security_enforcement: true` (both sections included above)

### Secondary (MEDIUM confidence)
- None — no web search was performed (all external search providers are disabled in `.planning/config.json`: `brave_search`/`exa_search`/`tavily_search`/`firecrawl`/`ref_search`/`perplexity`/`jina` all `false`); this phase introduces zero external dependencies, so direct code research was the correct and sufficient method.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no external dependencies this phase
- Architecture: HIGH — every insertion point is cited to an exact file:line in the current codebase, cross-checked against the Phase 17/18 SUMMARYs that already proved the seams behave as documented
- Pitfalls: HIGH for the two structural findings (module cycle, chip-label gap) — both are logically necessary consequences of the current code, not speculative; MEDIUM/ASSUMED for the gameplay-feel judgment calls (Assumptions Log A1/A3/A4/A5/A7/A8), which CONTEXT.md itself explicitly defers to planner discretion

**Research date:** 2026-09-13
**Valid until:** 30 days (stable, internal engine codebase; no external API/library drift risk)
