# Architecture Research

**Domain:** Foe abilities/spellcasting, symmetric INT resistance, parley/Language rebalance, bestiary rebalance, consolidated difficulty retune — integration into an existing deterministic roguelike rules engine
**Researched:** 2026-09-13
**Confidence:** HIGH (direct code read of every integration point below; file:line cited throughout) / MEDIUM on the two open design calls flagged explicitly (foe-ability targeting-pool extraction, threat-budget vs. hand-tuned bestiary)

## Standard Architecture (current, as-built)

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  src/browser/  (adapter, view-models, EVENT_NARRATION — presentation)  │
├───────────────────────────────────────────────────────────────────────┤
│  engine/engine.js  applyAction(state, action) → {state, events}       │
│  (THE single chokepoint: validate → structuredClone → rehydrate rng    │
│   from state.rngState → dispatch by action.type → persist rng cursor)  │
├───────────────────┬───────────────┬───────────────┬───────────────────┤
│ engine/combat.js   │ engine/magic.js│ engine/         │ engine/         │
│ startCombat        │ castSpell      │ difficulty.js   │ encounters.js   │
│ playerStrike       │ (PLAYER-only;  │ difficultyCurve │ encounterDot    │
│ foeTurn ◄── foe    │  foe.intel     │ (pure fn of     │ meetJoiner/     │
│   ability slots in │  resists it)   │  depth; floor-  │ meetFaerie/etc  │
│ afterPlayerAction  │ drinkPotion    │  gen knobs ONLY,│                 │
│ killFoe/liveFoes   │ readScroll     │  NOT foe power) │                 │
│ allyTurn/alliesTurn│                │                 │                 │
├───────────────────┴───────────────┴───────────────┴───────────────────┤
│ engine/derived.js — strikeDie/toHit/foeDie/foeToHitVs/conditionsOf/eff │
├─────────────────────────────────────────────────────────────────────── ┤
│ content/*.js — pure data tables (BESTIARY, SPELLS, ENC_TYPES, …)       │
│ barrel: content/index.js  (export * from "./X.js" per module)         │
├─────────────────────────────────────────────────────────────────────── ┤
│ engine/rng.js — seeded mulberry32; state.rngState persists the cursor  │
└───────────────────────────────────────────────────────────────────────┘
```

Every rule domain is a pure function of `(state, rng, events)` — no DOM, no `Math.random`, no global `S`. `state.combat.foes[]` and `state.c` (the player character) are the two objects every new mechanic in this milestone reads and writes.

### Component Responsibilities (current vs. what this milestone touches)

| Component | Current Responsibility | Touched by this milestone |
|-----------|------------------------|----------------------------|
| `engine/combat.js` `foeTurn` (819-990) | Per-foe melee swing(s): sleep/acid checks, target selection (hero vs. live party members), to-hit, damage, ward/armor soak, death | **MODIFIED** — new ability-attempt branch inserted per foe, before the swing loop |
| `engine/combat.js` (new) `pickTarget` | *(does not exist as a standalone export — the hero-vs-member targeting roll is inlined at 858-865)* | **NEW export** — extracted so both melee swings and foe abilities share identical, already-tested targeting logic |
| `engine/magic.js` `castSpell` | Player-only spell resolution over `SPELLS[]`, keyed by grimoire/charges/school gates | **UNTOUCHED** — see "Pattern 2" below for why generalizing it is explicitly rejected |
| `engine/foeAbilities.js` | *(does not exist)* | **NEW module** — small, foe-scoped ability resolver |
| `content/bestiary.js` | `BESTIARY[type][level-1] → [{n, sz, i, wp, sp}]`; `sp.*` flags are flavor-only today (per combat.js's own header comment, lines 25-34) | **MODIFIED** (rebalanced wp/dmg/toHit/ar) + **NEW** `abilities: [id, …]` field added to the subset of entries that get real abilities |
| `content/foe-abilities.js` | *(does not exist)* | **NEW module** — ability-kind registry, referenced by id from bestiary entries (mirrors `SPELLS[]` + `c.grimoire` name-reference pattern already used for the player) |
| `engine/derived.js` `conditionsOf` (139-193) | Enumerates the player's active good/bad status chips (haste/invis/affliction/darkness/phobia…) | **MODIFIED** — new bad-condition entries for foe-inflicted debuffs |
| `engine/difficulty.js` `difficultyCurve` | Pure fn of `depth` → floor-gen knobs ONLY (`dots`, `darkBlobs`, `darkRadius`); **does not touch monster power at all** | **MODIFIED/EXTENDED** — becomes the single source of truth for combat-scaling knobs too (foe count/level, now + an ability-threat weight) |
| `engine/combat.js` `startCombat` (98-270) | Inline foe-count/level rolls (`cap`, `rng.d(4)` ternary chain, `maxLvl`) — **not sourced from difficulty.js today** | **MODIFIED** — roster composition consults the new difficulty.js budget function |
| `tools/tune-difficulty.mjs` | Headless auto-play, reports death-depth/action-count distributions only | **MODIFIED** — tallies ability-driven events per run |
| `engine/combat.js` `canParley`/`parley` (506-576) | Gates on sub/race/skill/`eff(c,"tongue")`; success `d20 ≤ 9+bonus`; reward `~2.5×Σ(d6×lvl)` XP, no failure cost | **MODIFIED** — odds/reward/failure-cost retune; Language skill's `TALKATIVE` reach may widen |
| `engine/magic.js` `castSpell` resistance block (85-97) | Foe resists PLAYER spells via `foe.intel` | **MIRRORED, not reused** — a new, separate resistance check in `foeAbilities.js` using `state.c.intel` |
| `src/browser/eventNarration.js` `EVENT_NARRATION` | Coverage-guarded map, every engine event type MUST have an entry | **MODIFIED** — new entries for every new event type (build fails otherwise, per its own coverage test) |
| `test/parity/harness/comparables.js` | Carves engine-only fields out of the frozen-prototype comparison | **MODIFIED** — new carve-outs for ability runtime fields AND (separately, see Pitfall below) rebalanced bestiary numeric fields |

## Recommended Project Structure (additions only)

```
engine/
├── combat.js            # MODIFIED: foeTurn ability-attempt branch; pickTarget extracted
├── magic.js              # UNCHANGED (player castSpell untouched)
├── foeAbilities.js       # NEW: resolveFoeAbility(state, foe, ability, rng, events)
├── difficulty.js          # MODIFIED: + combat-scaling knobs (foe budget, ability threat weight)
content/
├── bestiary.js            # MODIFIED: rebalanced stats + new `abilities` field on select entries
├── foe-abilities.js       # NEW: ability-kind registry (id → {kind, dmg, effect, txt})
├── index.js               # MODIFIED: + `export * from "./foe-abilities.js";`
src/browser/
├── eventNarration.js      # MODIFIED: + entries for every new event type
test/parity/harness/
├── comparables.js         # MODIFIED: + carve-outs (ability runtime fields, rebalanced foe stats)
tools/
├── tune-difficulty.mjs    # MODIFIED: + ability-threat tallying in the report
```

### Structure Rationale

- **`engine/foeAbilities.js` as its own file, not folded into `combat.js` or `magic.js`:** `combat.js` is already the largest, hottest-path module (foeTurn is "the single hottest parity loop in the engine," per its own comment at 851-859); adding ~5 ability-kind branches inline would bloat an already-dense function. A separate module also makes the new mechanic's parity-relevant surface easy to grep/audit in isolation, matching this codebase's established one-domain-per-file convention (`combat.js`/`magic.js`/`encounters.js`/`economy.js`/`death.js` are all narrow, single-purpose slices).
- **`content/foe-abilities.js` as a registry, not inline `abilities:[{...}]` literals on every bestiary entry:** several existing creatures already carry the flavor-only `sp.caster: true` flag with near-identical prose ("casts every spell of levels 1 to 4" — Djinni; "casts every offensive spell, 1 to 4, without limit" — Drudge/Vampire). A shared registry keyed by id lets multiple creatures reference the same ability definition (dice, kind, resistance behavior) without duplicating it, exactly the way `content/spells.js`'s `SPELLS[]` is a single table every Magic User subclass references by name via `c.grimoire`. Bestiary entries carry only `abilities: ["boltFire", …]` (an array of ids), not full descriptors.

## Architectural Patterns

### Pattern 1: The zero-draw gate (how every new mechanic stays parity-safe)

**What:** Every conditional branch that can consume `rng` in this codebase is gated on a *structural* check of already-serialized data that is `undefined`/`false`/empty for every character or foe that doesn't opt into the feature — never on a value computed *after* an rng draw. Concrete precedents already in `engine/combat.js`:
- `if (c.regen) { const r = rng.d(8); … }` (823) — only draws when `c.regen` was set by a spell.
- `if (f.acid && f.acid.rounds > 0) { … rollDice(rng, f.acid.dmg) … }` (831) — only draws when a prior acid-spell application set `f.acid`.
- `if (state.party?.length) { state.combat.allies = … }` (183) and the member-targeting roll at 860-865, gated on `C.allies` and `liveMembers.length` — an empty/absent party draws zero extra rng, "exactly the path every solo parity fixture already exercises" (per the module's own comment, 855-859).

**When to use:** Every new ability-attempt roll, every new foe-summon roll, every new player-INT-resists-foe-spell roll.

**Trade-off:** None — this is strictly additive and is the ONLY pattern that keeps `test/parity/prototype-master.js.txt` byte-identical for every existing fixture while still allowing new mechanics to draw rng when they DO apply.

**Concrete slot for the foe-ability check** — insert into `foeTurn` (`engine/combat.js:819-990`) immediately after the existing sleep check and BEFORE the `swings` computation:

```js
for (const f of C.foes) {
  if (f.acid && f.acid.rounds > 0) { /* unchanged */ }
  if (!f.alive) continue;
  if (f.asleep > 0) { f.asleep--; events.push({ type: "foeSlept", name: f.name }); continue; }

  // NEW — gate is a pure structural read of content-driven data; every
  // existing BESTIARY entry has no `abilities` field, so `f.abilities` is
  // `undefined` for them and this whole block is skipped with ZERO rng
  // draws, leaving the swing loop below byte-identical to today.
  if (f.abilities && f.abilities.length && (f.abilityCooldown ?? 0) <= 0) {
    const attemptRoll = rng.d(FOE_ABILITY_ATTEMPT_DIE);
    if (attemptRoll <= FOE_ABILITY_ATTEMPT_THRESHOLD) {
      resolveFoeAbility(state, f, rng, events); // engine/foeAbilities.js — may itself draw more rng
      continue; // an ability REPLACES this foe's melee swings this round (mirrors the Wizard "does not stoop to fisticuffs while a spell remains" precedent, combat.js:286-289)
    }
  }
  if (f.abilityCooldown > 0) f.abilityCooldown--; // decays even on a round the check fails/skips

  const swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1);
  // … unchanged melee loop …
}
```

Only foes carrying a NEW `abilities` array (never `sp.caster`, which stays inert — see Pitfall 1) ever reach `rng.d()` here. This is the direct answer to "where does an ability check slot in so RNG order for ability-less foes is unchanged."

### Pattern 2: A separate foe-ability resolver, NOT a generalized `castSpell`

**What:** `engine/magic.js#castSpell` (45-361) is deeply player-shaped: it reads `c.spellsUsed`/`maxCharges(c)`/`c.grimoire`/`c.sub` (Apprentice backfire, school gates), targets via `C.foes[C.target]` (the player's manually-selected foe), and writes effects onto `c.*` (ward/regen/mirror/might) across ~20 `sp.kind` branches. Generalizing it to accept an arbitrary "caster" would require threading a caster parameter through every one of those branches and inverting every targeting assumption (a foe's ability targets the PLAYER, not `C.foes[C.target]`) — a large, high-risk refactor touching the function every existing spell-parity/unit test exercises.

**Recommendation:** Write a new, small, foe-scoped resolver instead:

```js
// engine/foeAbilities.js
export function resolveFoeAbility(state, foe, rng, events = []) {
  const ability = FOE_ABILITIES[rng.pick(foe.abilities)]; // or a fixed/weighted pick — a data decision, not an architectural one
  foe.abilityCooldown = ability.cooldown ?? 3;

  // Symmetric INT resistance (mirrors magic.js:85-97's foe-resists-player
  // block exactly, but the READER is now state.c.intel, the player's own
  // stat, wired per RULE-01 Option A — see Pattern 3).
  if (!FOE_RESIST_IMMUNE_KINDS.has(ability.kind) && (state.c.intel ?? 0) >= 12) {
    const r = rng.d(20);
    if (r < state.c.intel) {
      events.push({ type: "foeSpellResisted", name: foe.name, ability: ability.n, roll: r, intel: state.c.intel });
      return events;
    }
    events.push({ type: "foeResistFailed", name: foe.name, roll: r });
  }

  events.push({ type: "foeCast", name: foe.name, ability: ability.n });
  switch (ability.kind) {
    case "bolt": /* damage to a picked target, reusing combat.js's pickTarget (Pattern 4) */ break;
    case "drain": /* damage + self-heal */ break;
    case "debuff": /* sets a NEW c.foeEffect slot — see Pattern 3's serialized-state section */ break;
    case "summon": /* pushes a new entry into C.foes — reuses killFoe/liveFoes untouched */ break;
    case "heal": /* heals foe or an ally foe */ break;
  }
  afterPlayerAction is NOT called here — foeTurn's own caller chain already
  // continues the loop and the round; resolveFoeAbility is called FROM
  // inside foeTurn, one foe at a time, matching every other per-foe branch.
  return events;
}
```

**Trade-off:** A second, smaller vocabulary of effect kinds (bolt/drain/debuff/summon/heal — 5, not 20) duplicates a little logic (e.g., damage application, ward/soak interaction on the player side should still apply — a foe's `bolt` should go through the SAME ward/armor-soak/Hardiness pipeline `foeTurn`'s melee branch already implements at 906-967, not bypass it). **Recommendation:** factor the melee branch's post-hit pipeline (ward absorb/reflect → armor soak → `c.wp -= dmg` → `struckByFoe`/die) into a small shared helper (e.g. `applyFoeDamageToPlayer(state, foe, dmg, rng, events, {ignoresArmor})`) that BOTH the existing melee swing and the new `bolt`/`drain` ability kinds call — this is a second, low-risk, behavior-preserving extraction (see Pattern 4) that avoids either duplicating the ward/armor pipeline or reimplementing it slightly differently (a correctness risk).

### Pattern 3: Symmetric player-INT resistance and foe-inflicted player conditions

**What:** The player's `c.intel` (rolled at chargen, `intelBonus(c)` in `derived.js:391-394`) currently has exactly one mechanical read (chest-lock threshold, `encounters.js:122/127`) besides feeding `intelBonus`. The 04.1 audit's deferred RULE-01 Option A ("once foes cast, let the player's Intelligence resist") is unlocked directly by this milestone.

**Design:** Do NOT touch `magic.js`'s existing `RESIST_IMMUNE_KINDS`/resistance block (that gates FOES resisting the PLAYER's spells and must stay untouched for parity). Add a **new, separate** resistance check inside `foeAbilities.js` (shown in Pattern 2 above) that mirrors the shape (`d20 < intel` beats the ability) but reads `state.c.intel` instead of `foe.intel`. This is a pure logic mirror, not a shared function — the two checks read different objects (`state.c` vs. a foe) and belong to different modules that must each stay independently auditable for parity.

**New serialized state — foe-inflicted player debuffs:** model as a single new slot on the character, mirroring the proven `c.ward = {pool, rounds, reflect, name}` shape (`magic.js:255-257`) rather than one boolean field per debuff kind:

```js
c.foeEffect = { kind: "weaken" | "blind" | "stun" | "drain", roundsLeft: N, magnitude?: N };
```

Combat-domain readers that already exist and would need to consult it: `toHit(state)` (derived.js:284-296, for a `blind`-equivalent to-hit penalty), `weaponDamage`/`strikeDie` (for a `weaken` analog of `C.weakened`/`C.foeToHitPenalty`, which today are combat-scoped fields the PLAYER's own `weaken` spell sets on `C` — `magic.js:131-136` — a foe-authored weaken should very plausibly reuse `C.weakened`/`C.foeToHitPenalty` directly, since those are already combat-scoped and already read by `foeTurn` FOR the foe's own to-hit math... but the player's OWN outgoing to-hit doesn't currently read `C.weakened`, so a "foe weakens the PLAYER" effect needs its own read site in `toHit()`/`weaponDamage()`, not a reuse of `C.weakened`). Recommend `c.foeEffect` as the single new slot, decremented once per round inside `foeTurn`'s existing per-round housekeeping (alongside the `c.ward`/`c.mirror` countdown at combat.js:984-988).

**`conditionsOf` integration (`derived.js:139-193`):** add one new bad-condition entry, following the file's own established pattern exactly:

```js
if (c.foeEffect && c.foeEffect.roundsLeft > 0) {
  out.push({ key: "foeEffect", polarity: "bad", kind: c.foeEffect.kind, remaining: c.foeEffect.roundsLeft });
}
```

This is the ONLY UI hook needed — the milestone's scope boundary ("no new screens") is satisfied because the existing status-chip tracker automatically surfaces the new debuff once it's added here, exactly like `darkness`/`affliction`/`phobia` do today.

**New event types needed** (must each get an `EVENT_NARRATION` entry or the coverage test fails, per `eventNarration.js:1-9`):
`foeCast`, `foeSpellResisted`, `foeResistFailed`, `foeAbilityHit` (or reuse `struckByFoe`'s shape for `bolt`/`drain` — recommended, since it's already narrated and already understood by the UI), `foeDrained` (self-heal-from-damage flavor), `foeEffectApplied` (weaken/blind/stun onto the player), `foeEffectFaded` (mirrors `wardFaded`/`mirrorFaded`), `foeSummonedAlly` (a foe adds a new foe to `C.foes`), `foeHealedSelf`/`foeHealedAlly`.

### Pattern 4: Extract `pickTarget` so foe abilities are party-aware for free

**What:** `foeTurn`'s melee swing loop already implements hero-vs-party-member targeting inline (combat.js:860-865): a `rng.d(liveMembers.length + 1)` roll picks the hero (roll `1`) or a specific live member (`2..N+1`), gated on `C.allies` existing (zero rng draw with no party, per the DETERMINISM GATE comment at 851-859).

**Recommendation:** extract this into a small, pure, exported helper — e.g. `pickFoeTarget(state, rng) → { isHero: bool, member: object|null }` — called from BOTH the existing melee branch and the new `resolveFoeAbility`'s `bolt`/`drain` kinds. This is a **behavior-preserving refactor** (must ship with its own unit test proving byte-identical output for every existing seed before any new caller uses it) that:
1. Guarantees foe abilities respect the exact same "party members can be targeted" rule the milestone's joiner-interaction question asks about, with no duplicated/divergent logic.
2. Keeps the new ability code from needing to re-derive `liveMembers`/the targeting roll shape itself.

**Trade-off:** A small pre-requisite refactor lands before the ability feature itself — but it is low-risk (pure extraction, no behavior change) and directly de-risks the "how does the party member interact with foe abilities" question by construction rather than by parallel reimplementation.

AoE/multi-target foe abilities (a foe-side "Lightning"/"Earthquake" equivalent hitting the hero AND every live member) do not need `pickTarget` — they iterate `[hero, ...liveMembers]` directly, mirroring `magic.js`'s own `volley`/`quake` kinds which already iterate `liveFoes(state)` unconditionally.

### Pattern 5: Difficulty retune — extend `difficultyCurve`'s scope, don't bolt a second system beside it

**What:** `engine/difficulty.js` is currently scoped ONLY to floor-generation knobs (`dots`, `darkBlobs`, `darkRadius` — see its own header, lines 1-22: "bounds the two floor-generation knobs"). Foe count/level scaling lives entirely inline in `combat.js#startCombat` (98-138: `maxLvl = clamp(min(c.level, floor.depth), 1, 5)`; `cap = c.level <= 2 ? 2 : 3`; the `rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3` foe-count ternary; per-foe `rng.d(4) === 1 ? -1 : 0` level jitter) and is **never sourced from `difficulty.js` today** — confirmed by grep: `combat.js` imports `BESTIARY, ENC_TYPES, RACES, WEAPON_MAX, STRIKE_DICE` from `content/index.js` but nothing from `engine/difficulty.js`.

**Recommendation:** add new pure (no-rng) exports to `difficulty.js` alongside `difficultyCurve`:

```js
// engine/difficulty.js — NEW exports
export function abilityThreatWeight(ability) {
  // pure lookup/formula over a content/foe-abilities.js descriptor's kind —
  // e.g. bolt: +4, drain: +5, debuff: +3, summon: +6, heal: +2 (starting
  // constants; this IS a tuning knob, like ENCOUNTER_DOT_BASE above it)
}
export function foeThreatBudget(depth) {
  // pure fn of depth — the "how much foe power is this floor allowed to
  // spend" cap, mirroring softCap()'s asymptotic shape already used for dots
}
```

`combat.js#startCombat`'s roster-build loop then consults `foeThreatBudget(state.floor.depth)` the same way `maze.js#genFloor` already consults `difficultyCurve(depth).dots` (`maze.js:111`) — called BEFORE any rng draw for the encounter, so it never perturbs RNG order; it only changes what count/level VALUES the existing rolls are compared against or capped by (a pure comparison-threshold change, the same category of change `intelBonus`'s chest-lock-threshold precedent already established as parity-safe: "callers apply it to a comparison threshold, never to the rng draw itself" — `derived.js:387-389`).

**Simpler fallback (lower risk, may be sufficient for v1.1):** skip the full threat-budget system; instead hand-tune BESTIARY's per-creature stats so an ability-bearing foe's raw `wp`/`dmg` is proportionally LOWER than a same-level non-caster (the ability itself is the "extra" power budget), verified purely via `tools/tune-difficulty.mjs`'s existing death-depth distribution. **This is the recommended v1.1 scope** — the full budget system is a natural v1.2+ refinement once real ability-bearing creatures exist to calibrate against. Flag both options to the roadmapper; do not commit to the heavier system without a research spike proving the simpler hand-tuned approach is insufcient.

**`tools/tune-difficulty.mjs` measurement hook:** `autoPlayOnce` (152-169) currently discards each action's `events` array (`({ state } = applyAction(state, action))`). To measure ability threat, capture and tally instead:

```js
let abilityCasts = 0, abilityDamage = 0;
while (!state.dead && !state.won && actions < MAX_ACTIONS) {
  const action = decideAction(state, policyRng);
  const result = applyAction(state, action);
  state = result.state;
  for (const e of result.events) {
    if (e.type === "foeCast") abilityCasts++;
    if (e.type === "struckByFoe" && e.fromAbility) abilityDamage += e.dmg ?? 0; // needs a new `fromAbility` flag on the reused struckByFoe event (Pattern 2)
  }
  actions++;
}
```

Then extend `printReport`/the `--json` output with `abilityCasts`/`abilityDamage` distributions alongside the existing death-depth/action-count ones — directly answering "how tools/tune-difficulty.mjs can measure [ability threat]."

## Data Flow

### Foe-turn sequence, before vs. after this milestone

```
BEFORE (today):
foeTurn(state, rng, events)
  for each live foe f:
    acid tick (gated)          ← 0 draws if !f.acid
    asleep check (gated)        ← 0 draws if !f.asleep
    for each swing:
      target pick (gated)       ← 0 draws if no party
      to-hit roll                ← ALWAYS 1 draw per swing
      damage roll                 ← ALWAYS ~1 draw per swing
      armor-soak roll (gated)     ← 0 draws if no armor/ignoresArmor

AFTER (this milestone, for a foe WITHOUT `abilities` — UNCHANGED):
  same as above — the new ability-attempt gate is `f.abilities && f.abilities.length`,
  false for every existing BESTIARY entry ⇒ zero new draws, identical order.

AFTER (for a foe WITH `abilities` — NEW path, only reachable via new content):
  for each live foe f:
    acid tick (gated)
    asleep check (gated)
    ability-attempt roll (NEW)          ← 1 draw, only when f.abilities.length > 0
      if attempted:
        resolveFoeAbility():
          ability pick (rng.pick)        ← 1 draw
          INT-resist roll (gated on kind + c.intel>=12)  ← 0-1 draws
          effect-kind resolution          ← 0-N draws depending on kind
        continue (skip melee swings this round)
      else: fall through to unchanged melee swing loop
```

### Key data flows

1. **Ability definition → runtime foe state:** `content/foe-abilities.js` (static registry) → `content/bestiary.js`'s `abilities: [id,…]` reference → `startCombat`'s foe-build loop (`combat.js:124-136`) copies the id list onto the spawned foe object + initializes `abilityCooldown: 0` → `foeTurn`'s new gate reads `f.abilities`/`f.abilityCooldown` every round.
2. **Foe ability → player state → UI:** `resolveFoeAbility` writes `c.foeEffect` (new) or `c.wp` (damage) → `derived.js#conditionsOf` reads `c.foeEffect` every render → `src/browser`'s existing status-chip UI (already wired to `conditionsOf`) shows it — **no new screen or component**, satisfying the milestone's scope boundary.
3. **Difficulty retune → both generation and combat:** `engine/difficulty.js` becomes the single import both `maze.js#genFloor` (existing) and `combat.js#startCombat` (new) consult for their respective depth-scaled knobs — one source of truth, one file for `tools/tune-difficulty.mjs`/`tools/tune-economy.mjs` to point at when re-running the retune.
4. **Parley retune → no new engine seam, only value/threshold changes:** `canParley`/`parley` (combat.js:506-576) keep their existing shape; the retune changes constants (the `9 + bonus` threshold, the `2.5×` reward multiplier, and possibly adds a `C.parleyAttempts` counter for a per-encounter cap — a new, engine-only `state.combat` field needing a `comparables.js` carve-out the same way `combat.initNote`/`combat.round` are already carved out today, combat-parity.test.js:98-100).

## New Serialized State — Full Inventory

| Field | Location | Set by | Parity carve-out needed? |
|-------|----------|--------|---------------------------|
| `f.abilities` | `state.combat.foes[i]` | `startCombat`, copied from bestiary content | **Yes** — new field, absent on every existing fixture roster entry today; needs stripping from `combatComparable`/`stripFoeDamageClosures`-style helper (or a new `stripFoeAbilityFields`) the moment ANY ability-bearing creature can be rolled by a fixture seed |
| `f.abilityCooldown` / `f.abilityCharges` | `state.combat.foes[i]` | `startCombat` init, decremented in `foeTurn` | **Yes** — same carve-out as above |
| new foe entries pushed by a `summon` ability | `state.combat.foes[]` (array grows mid-combat) | `resolveFoeAbility`'s `summon` kind | **Yes** — array length/shape divergence; carve out via the same per-foe field-stripping approach, or flag summoned entries (`f.summonedBy`) and exclude them from length-sensitive comparisons |
| `c.foeEffect` | `state.c` | `resolveFoeAbility`'s `debuff`/`weaken`/`blind`/`stun` kinds | **Yes** — new `c.*` field, mirror `stripDarkForField`/`stripFlightFields` precedent exactly (comparables.js:63-84) |
| `C.parleyAttempts` (if a per-encounter cap is adopted) | `state.combat` | `parley()` | **Yes** — mirror the existing `combat.round`/`combat.initNote` carve-out (combat-parity.test.js:99) |
| Rebalanced `wp`/`sp.dmg`/`sp.toHit`/`ar` values on EXISTING bestiary entries | `content/bestiary.js` (static data, not runtime state) | the bestiary rebalance itself | **Yes — see Pitfall 1, this is the highest-risk carve-out of the whole milestone** |

## Anti-Patterns

### Anti-Pattern 1: Generalizing `castSpell` into a caster-agnostic function

**What people would do:** thread a `caster` parameter through `magic.js#castSpell`'s ~20 `sp.kind` branches so both the player and foes call the same function.
**Why it's wrong:** every branch assumes player-shaped state (`c.spellsUsed`, `c.grimoire`, `C.foes[C.target]` as the manually-selected target, `c.sub === "Apprentice"` backfire) — inverting all of it is a large refactor of the single most spell-parity-tested function in the engine, for a foe vocabulary that only needs ~5 effect kinds, not ~20.
**Do this instead:** the new, small `engine/foeAbilities.js` resolver (Pattern 2), sharing only the low-level primitives (`liveFoes`, `killFoe`, a new `pickFoeTarget`, a new `applyFoeDamageToPlayer`) that were already designed to be reused across domains.

### Anti-Pattern 2: Keying the new ability system off the existing `sp.caster`/`sp.*` flavor flags

**What people would do:** treat `sp.caster: true` (already present on Djinni/Krupke/Drudge/Vampire in `content/bestiary.js`) as "this creature already has abilities, just wire it up."
**Why it's wrong:** `combat.js`'s own header (lines 25-34) documents that these flags are flavor-only in BOTH the engine's bestiary AND the frozen prototype (`prototype-master.js.txt` has its own independent, byte-identical `BESTIARY` copy at line 304 — confirmed by direct read). Making `sp.caster` mechanically active is a "deliberate rules change" exactly like every other one already logged in this codebase, but unlike those (which changed VALUES on paths no frozen fixture exercises), turning ON casting for a creature that a parity fixture might roll adds a NEW rng draw mid-fixture — an un-gated, un-guarded divergence the parity harness has no existing carve-out for.
**Do this instead:** a brand-new `abilities` field (Pattern 1's gate), populated only on entries whose fixture-exposure has been checked (see Pitfall 1), leaving every `sp.*` flag exactly as inert as it is today.

### Anti-Pattern 3: A parallel `C.foeAllies` structure for foe-summoned creatures

**What people would do:** mirror the player's `C.ally`/`C.allies` shape with a new `C.foeAllies` array for foe-summoned reinforcements, to keep "whose side is this creature on" unambiguous.
**Why it's wrong:** it would require teaching `playerStrike`, `killFoe`, `liveFoes`, and the entire targeting UI a second "enemy" collection to check everywhere `C.foes`/`liveFoes(state)` is read today — a wide, error-prone surface change for a purely cosmetic distinction.
**Do this instead:** push summoned creatures directly into `C.foes` (they ARE foes — the player fights them with the exact same `playerStrike`/`killFoe` code, unmodified) and flag them with a narration-only marker field (`f.summonedBy: "<foe name>"`) if the Oracle log wants to call out "reinforcements arrive."

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `combat.js#foeTurn` ↔ `foeAbilities.js#resolveFoeAbility` | Direct function call, `(state, foe, rng, events)` | New; foeTurn owns the per-foe loop and the ability-attempt gate/cooldown bookkeeping; the resolver owns effect application only |
| `foeAbilities.js` ↔ `combat.js`'s exported `liveFoes`/`killFoe`/(new)`pickFoeTarget`/(new)`applyFoeDamageToPlayer` | Import, reuse | Mirrors `magic.js`'s existing reuse of `combat.js`'s `liveFoes`/`killFoe`/`afterPlayerAction` (magic.js:25) |
| `content/bestiary.js` ↔ `content/foe-abilities.js` | Bestiary entries reference ability ids by string; resolved at `startCombat` foe-build time | Mirrors `c.grimoire` (array of spell names) ↔ `SPELLS[]` (lookup-by-name) — an established, proven pattern in this codebase, not a new one |
| `engine/difficulty.js` ↔ `engine/maze.js#genFloor` (existing) and `engine/combat.js#startCombat` (new) | Both call pure difficulty.js exports BEFORE drawing any rng for that floor/encounter | Preserves the "difficulty knobs are a pure function of depth, consulted before any roll" invariant the module's own header already establishes |
| `engine/derived.js#conditionsOf` ↔ `src/browser` status-chip UI (existing, unmodified) | `conditionsOf(state)` is the UI's one canonical read | New `c.foeEffect` entry slots into the existing array shape — zero UI code changes needed |
| Everything new ↔ `src/browser/eventNarration.js#EVENT_NARRATION` | Every new event `type` needs a builder entry | **Hard gate** — `test/unit/formatEventsCoverage.test.js` derives the full event-type vocabulary from `engine/*.js` source and fails the build if any is missing (eventNarration.js:6-9) |
| Everything new ↔ `test/parity/harness/comparables.js` | New fields/array-length changes must be carved out | **Hard gate** — `test/parity/prototype-master.js.txt` is frozen; any un-carved-out divergence fails `full-suite.test.js` |

## Pitfalls Specific to This Migration

### Pitfall 1 (CRITICAL): The bestiary rebalance breaks combat/magic parity fixtures independently of the ability-RNG question

`test/parity/harness/sandboxPrototype.js` runs `test/parity/prototype-master.js.txt` — a **complete, independent, frozen copy of the OLD prototype**, including its OWN embedded `BESTIARY` table (verified: `const BESTIARY = {` at prototype-master.js.txt:304, structurally identical to and the direct source of `content/bestiary.js`). The four `combat-parity.test.js` fixtures (win/lose/flee/parley) and the magic-parity fixtures roll specific foes via `rng.pick(roster)` at specific seeds. **The instant `content/bestiary.js`'s numeric fields (`wp`, `sp.dmg`, `sp.toHit`, etc.) diverge from the frozen sandbox's copy for any creature a fixture's seed actually rolls, the parity comparison fails on that creature's stats** — this is entirely independent of the ability-RNG-order concern (Pattern 1) and would happen even for a value-only rebalance that draws no new rng at all.

**This has an established precedent and fix in this exact codebase:** `stripFoeDamageClosures` (comparables.js:154-173) already carves the un-comparable `sp.dmg`/`acid.dmg` **closure-vs-data** representation out of the comparison "because the two representations can never be structurally compared anyway... stripping the un-comparable 'recipe' field... loses no real parity coverage." **Recommendation:** extend the exact same reasoning to rebalanced VALUE fields: before rebalancing, inventory which BESTIARY entries the frozen fixtures' seeds actually roll (a one-time grep/run of the fixtures with logging); for any creature that IS exercised, either (a) leave its stats untouched in this milestone, or (b) add a documented, narrow carve-out (`stripRebalancedFoeStats`, listing exactly which fields/creatures diverge and why) mirroring `stripFoeDamageClosures`'s own precedent and comment style. **Do not attempt a full bestiary rebalance without first running this inventory** — it directly gates the "bestiary rebalance" build-order step below.

### Pitfall 2: `f.abilityCooldown` decrementing on the WRONG turn boundary breaks the "once per round" invariant

`foeTurn` is called once per COMBAT ROUND per the surrounding `afterPlayerAction` logic (674-724), but can be called TWICE in one round if foes win the fresh initiative reroll (707-720, the documented "ROUND-COUNT FIX" behavior). Decrement `abilityCooldown` exactly once per `foeTurn` invocation (not per swing, not per foe-loop-iteration-that-didn't-cast) to avoid abilities coming off cooldown twice as fast as intended when foes act twice in a round — mirror `c.ward`/`c.mirror`'s existing once-per-foeTurn-call decrement pattern at combat.js:984-988 exactly.

### Pitfall 3: Language/parley retune and the symmetric INT resistance are two independent value changes that must not be tuned in isolation

Per the milestone brief itself (proposed-milestone-monster-balancing.md:27): "Tune Language's parley reach together with this parley balance pass so they aren't balanced twice." The same logic extends to INT resistance: widening `TALKATIVE`/Language's reach makes MORE encounters avoidable (reducing exposure to foe abilities), while symmetric INT resistance makes the encounters players DO fight less punishing for high-INT characters. Both dials affect the same `tools/tune-difficulty.mjs` death-depth signal — retune them together, in the same tuning pass, not sequentially.

## Recommended Build Order

Dependencies flow left→right; items on the same line have no ordering constraint between them.

1. **Bestiary-fixture inventory (research spike, no code)** — grep/run the 4 combat-parity + magic-parity fixture seeds, log exactly which `BESTIARY[type][level]` entries they roll. This is a hard prerequisite for step 3 (gates which creatures are "safe" to rebalance without a new carve-out) and should happen before any bestiary edits land.
2. **Low-risk refactors (parity-neutral, unit-tested before any new feature depends on them):**
   - Extract `pickFoeTarget(state, rng)` out of `foeTurn`'s inline targeting roll (Pattern 4).
   - Extract `applyFoeDamageToPlayer(state, foe, dmg, rng, events, opts)` out of `foeTurn`'s ward/armor/Hardiness pipeline (Pattern 2's trade-off note).
   - Both ship with tests proving byte-identical behavior to today before anything new calls them.
3. **Bestiary rebalance** (depends on step 1's inventory) — adjust wp/dmg/toHit/ar per creature vs. intended depth; add the required `comparables.js` carve-out(s) for any fixture-exercised creature whose stats changed (Pitfall 1).
4. **Difficulty retune, phase A: extend `difficulty.js`'s scope to combat scaling** (depends on step 3 — needs final bestiary numbers to tune against) — wire `startCombat`'s foe-count/level rolls to consult new `difficulty.js` exports (Pattern 5); re-run `tools/tune-economy.mjs`/`tools/tune-difficulty.mjs` against the rebalanced bestiary alone (no abilities yet) to get a clean baseline.
5. **Foe ability content + engine (depends on steps 2 and 4's baseline):**
   - `content/foe-abilities.js` registry + `abilities` field added to a small, deliberately narrow set of bestiary entries (the existing `sp.caster` creatures are strong content candidates, since their flavor text already describes the intended ability — but they get a NEW `abilities` field, `sp.caster` itself stays untouched, per Anti-Pattern 2).
   - `engine/foeAbilities.js#resolveFoeAbility` + the `foeTurn` ability-attempt gate (Pattern 1).
   - Symmetric player-INT resistance (Pattern 3) — lands together with the resolver since it's a branch inside it, not a separate seam.
   - New `c.foeEffect` slot + `conditionsOf` entry (Pattern 3).
   - New `EVENT_NARRATION` entries (hard gate, Integration Points table).
   - New `comparables.js` carve-outs for `f.abilities`/`f.abilityCooldown`/`c.foeEffect`/summoned-foe entries (New Serialized State table).
6. **Difficulty retune, phase B: fold ability threat into the budget** (depends on step 5 existing) — add `abilityThreatWeight`/`foeThreatBudget` to `difficulty.js` (or confirm the simpler hand-tuned fallback suffices, per Pattern 5's two-option flag); extend `tools/tune-difficulty.mjs` to tally `foeCast`/ability-damage events (Pattern 5's measurement hook); re-run the full tuning pass ONE more time with abilities live.
7. **Parley + Language rebalance** (can start in parallel with step 5, but its FINAL numbers depend on step 6's tuning pass being done, per Pitfall 3) — retune `canParley`/`parley`'s odds/reward/failure-cost constants; widen Language/`tongue` reach if desired; add a `C.parleyAttempts` cap + its carve-out if adopted.
8. **Final consolidated tuning pass** — one more `tools/tune-difficulty.mjs`/`tools/tune-economy.mjs` run across the fully-landed feature set (bestiary + abilities + parley + Language), closing PARTY-10/ECON-deep-tuning/Phase-3-feel-tuning as the milestone's single retune.

## Sources

- Direct read of `engine/combat.js` (foeTurn 819-990, startCombat 98-270, killFoe 409-462, parley/canParley 502-576) — CONFIDENCE: HIGH, primary source
- Direct read of `engine/magic.js` (castSpell 45-361, resistance block 85-97) — CONFIDENCE: HIGH, primary source
- Direct read of `engine/difficulty.js` (full file, confirms floor-gen-only scope) and `engine/maze.js:111` (genFloor's consumption site) — CONFIDENCE: HIGH, primary source
- Direct read of `engine/derived.js` (conditionsOf 139-193, intelBonus 376-394) — CONFIDENCE: HIGH, primary source
- Direct read of `content/bestiary.js` and `content/spells.js` (confirms `sp.caster` flavor-only flags, SPELLS[]/grimoire reference pattern) — CONFIDENCE: HIGH, primary source
- Direct read of `test/parity/harness/comparables.js`, `test/parity/combat-parity.test.js`, and `test/parity/harness/sandboxPrototype.js` (confirms the frozen prototype has its own independent embedded BESTIARY at prototype-master.js.txt:304 — the basis for Pitfall 1) — CONFIDENCE: HIGH, primary source
- Direct read of `tools/tune-difficulty.mjs` (confirms events are currently discarded, not tallied) — CONFIDENCE: HIGH, primary source
- `.planning/proposed-milestone-monster-balancing.md` and `.planning/PROJECT.md` — milestone scope/constraints — CONFIDENCE: HIGH, primary source

---
*Architecture research for: Mazeworld / Delve, Die, Repeat — v1.1 Monster Balancing & Abilities*
*Researched: 2026-09-13*
