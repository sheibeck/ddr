# Phase 21: Consolidated Difficulty Retune - Research

**Researched:** 2026-09-14
**Domain:** Deterministic combat/economy engine tuning (no external libraries) — extending `engine/difficulty.js` with combat-scaling knobs, upgrading two Node-script tuning harnesses into usable bot proxies, retuning constants across five subsystems in one pass, and adding a dev-only "start at depth N" affordance for the human sign-off round. Zero new dependencies (`.planning/config.json` has every external search provider disabled, matching the Phase 20 precedent).
**Confidence:** HIGH for every claim about current engine/tool behavior (all directly read/grepped this session, several confirmed by running `npm test`). MEDIUM-LOW for the exact numeric constants the retune should land on (that is explicitly the planner/executor's tuning job, not something research can pre-compute) — flagged in the Assumptions Log.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Depth Scaling Model (TUNE-01)**
- **D-01:** `engine/difficulty.js#difficultyCurve(depth)` gains combat-scaling fields — `foeCap` (max foes per encounter), `foeLvlBias` (reserved; 0 unless the retune needs it), `foePower` (multiplier applied to foe `wp`/`maxWP` and flat damage bonus), `abilityThreat` (cadence scalar for caster kits) — alongside the existing floor-generation knobs. `engine/combat.js#startCombat` reads ONLY the curve for these (no depth math of its own beyond the canon `maxLvl` clamp). One source of truth.
- **D-02:** Threat past floor 5 grows two ways: **soft-capped foe count** (`foeCap`: 3 at ≤ 5 → asymptotically 5 by ~floor 30, using the existing `softCap` helper) and **soft-capped `foePower`** (1.0 at ≤ 5 → ~1.6 by ~floor 40), applied at `startCombat` copy time to the per-foe instance (`f.wp`, `f.maxWP`, flat `dmg` bonus) so `damageFoe`, the yardstick, and fixtures see plain numbers. The level-1 `cap = 2` rule and the prototype's `d4`/`d4` count draws are preserved; `foeCap` only raises the `Math.min` ceiling, so draw shape never changes.
- **D-03:** `abilityThreat` scales caster cadence by depth band: `firstReadyAbility` reads the curve and reduces effective `every` (e.g. 2 → 1 rounds between casts deep) / raises `uses` — the kits in `content/foe-abilities.js` are unchanged data. Zero effect at `abilityThreat === 1`.
- **D-04:** Parity discipline: every new term is **identity at depth ≤ 1 / level 1** (`foeCap` 2/3 as today, `foePower` 1.0, `abilityThreat` 1). A unit test pins `difficultyCurve(1)` to the exact pre-Phase-21 object plus the identity values, and the parity suite stays 30/30 with **zero new carve-outs** for scaling. (The only new carve-out in this phase is the D-14 `dev` flag.)

**Making the Bot a Usable Proxy (TUNE-02)**
- **D-05:** The bot in BOTH tools gains four deterministic policies on the separate policy rng: **cast an attack spell** when the character has charges (Magic Users), **drink a healing potion** below ~50% wp when one is carried, **make camp** outside combat when wp < 50% and rations ≥ 1, **descend when the floor's encounter dots are cleared** (or after a bounded exploration budget). Store shopping and hiring stay out of scope for the proxy.
- **D-06:** Caster reaction: when any live foe has `abilities` and wp < 50%, prefer **parley** (if `canParley`) else **flee** — i.e. the flee threshold rises from 0.3 to 0.5 against caster groups.
- **D-07:** Ability tallies in both tools, text and `--json`: `foeCast`, `foeBolted`, `foeDrained`, `foeDebuffed`, `foeHealed`, `foeSummoned`, `heroResisted`, `heroResistFailed`, plus damage-from-abilities as a share of all damage taken.
- **D-08:** Readout shape: death-depth distribution **plus** a reach table (% of runs reaching floors 5 / 10 / 20 / 30 / 50), median actions per floor (session-length proxy), and per-depth-band caster-encounter rate. Committed BEFORE (post-Phase-20 engine, upgraded bot) and AFTER, verbatim, in the ledger.

**Targets & the One Retune (TUNE-03)**
- **D-09:** Harness targets (a sanity floor, never the exit criterion), measured with the upgraded bot at 200 seeds: **median death depth 8–15**, **p90 ≥ 25**, **< 2% of runs past floor 50**, **median 40–80 actions per floor** (≈ 3–6 floors per 5–10 minute session).
- **D-10:** Constants in scope for the single pass: `difficulty.js` (new D-01 knobs + existing dot/dark knobs), the party-power counterweight (hire cost / upkeep by depth; PARTY-06's XP-share damping stays primary — PARTY-10), economy deep-band numbers (`LOOT_DIVISOR`, the purse table, store price scaling, the wilmst cache row, the parley Humans bonus amount `d6 × 100 × depth` — ECON), ability cadence via `abilityThreat`. **NOT** in scope: bestiary base stats (Phase 18's ledger stands), class/race/sub-class features.
- **D-11:** Method: one committed ledger `docs/DIFFICULTY-RETUNE.md` — BEFORE readout → change table with a rationale per knob → AFTER readout; at most **two** harness iterations to land inside D-09, then stop (the DR round decides the rest). Every change to a fixture-exposed path is gated on depth/level so the parity suite stays byte-identical.
- **D-12:** Party power: the bot doesn't hire, so add a `--party` harness flag that starts the run with one hired member (deterministic, via the public action surface); retune **hire cost and upkeep by depth** only if the `--party` readout blows past the soft cap relative to solo.

**The Sign-off DR Round (TUNE-04)**
- **D-13:** Dev-only **"start at depth N"**: a hidden Settings affordance (long-press the version line reveals a depth field) that starts a new run via `newRun(seed, { startDepth })` — generates floor N, levels the rolled character to the SP threshold for `min(N, 5)` (same `checkLevel` path, no new rng draws in chargen), and grants a depth-scaled purse via the existing wilmst-cache row. The run is flagged `state.dev = true` and is **excluded from the graveyard and high score**. Never reachable in normal play.
- **D-14:** Parity/save discipline for the dev start: `startDepth` defaults to 1 and every fixture calls `newRun(seed)` → byte-identical; the `dev` flag is a new serialized top-level field → stripped in all three `*Comparable()` fns and tolerated by `validateSave`/`rehydrate` (absent = false), mirroring the `c.bag` / `darkFor` precedent.
- **D-15:** The DR checklist lives in `docs/DIFFICULTY-RETUNE.md`: **three runs** at depths **20, 35, 50** — for each: session-length feel, one caster fight (bolt / drain / debuff legible, resist feels fair), one parley attempt + one failure, party hire affordability, and "did the run end for a reason I understood"; the user reports per-run notes and a **pass / tune-again** verdict. The phase's VERIFICATION ends `human_needed` on exactly this item.
- **D-16:** If the verdict is "tune again": ONE follow-up `/gsd-quick` pass editing only `difficulty.js` constants (+ a ledger addendum), then a second DR round. No re-plan. If "pass": TUNE-04 closes the milestone's deferred UAT.

### Claude's Discretion
- Exact soft-cap constants / `k` values for `foeCap`, `foePower`, `abilityThreat` and the depth bands — chosen during the retune against D-09, recorded in the ledger.
- Where `foePower` applies its damage bonus (flat `+n` on `pursuer.lvl*lvl` base vs. multiplying `sp.dmg` dice) — must not add draws and must respect `damageFoe` being the only foe-wp decrement seam.
- Bot exploration budget per floor before descending, and the exact potion/camp thresholds.
- The hidden-toggle gesture and the dev-run visual marker (a small "DEV" chip is fine; no new screen).
- Test file layout.

### Deferred Ideas (OUT OF SCOPE)
- Canon-mode consequences for Sterling and the five `sp.ar` creatures (18-06) — revisit only if the DR round flags them; otherwise next milestone.
- One-round-ahead bolt telegraph (19 deferred) — only if the DR round says bolts feel unfair.
- Party members resisting spells / member `intel` — FOE-V2.
- Bot store shopping / hiring policies — proxy scope creep; not needed for the sanity floor.
- A player-facing "start deeper" mode (New Game+) — v2 idea; the D-13 toggle is dev-only by design.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TUNE-01 | `difficulty.js` owns combat-scaling knobs (foe count/level/ability threat by depth) | Architecture Pattern 1 (`difficultyCurve` extension), Pitfall 1 (the foeCap draw-shape ceiling), Pitfall 2 (the `tickAbilityCooldowns` signature gap) |
| TUNE-02 | Both tuning tools tally foe-ability events; bot policy reacts to casters | Architecture Pattern 2 (bot upgrade), Pitfall 3 (no `hire` action exists — Joiner is opportunistic, not forced), Pitfall 4 (runtime budget) |
| TUNE-03 | The curve is retuned ONCE across party/economy/monster/ability axes | Architecture Pattern 3 (constants inventory + exact file:line for every knob in scope), Pitfall 5 (store "price scaling by depth" does not exist today) |
| TUNE-04 | Human DR sign-off at depth 20–50+ via a dev-only start-at-depth toggle | Architecture Pattern 4 (`newRun`/`state.dev` wiring), Pitfall 6 (no version line or high-score feature exists yet to hang the toggle/exclusion off), Runtime State Inventory below |
</phase_requirements>

## Summary

This phase touches five already-well-factored engine seams (`difficulty.js`, `startCombat`, `foeAbilities.js`, two Node tuning scripts, `newRun`) plus one that does not exist yet in the shape CONTEXT.md assumes (a "hire" mechanic) and one UI affordance that does not exist at all yet (a Settings-sheet version line). None of this requires a new library — `.planning/config.json` disables every external search provider and this phase installs no packages, so the Package Legitimacy Audit below is N/A. The work is a constants-and-wiring pass, not new architecture: `difficultyCurve(depth)` already returns a plain object every consumer destructures, so adding `foeCap`/`foeLvlBias`/`foePower`/`abilityThreat` fields is additive and low-risk. The two tuning scripts already have a working policy-rng/engine-rng separation and a `decideAction` switch that is trivial to extend with new branches (cast/drink/camp).

The two most important non-obvious findings, both load-bearing for the plan: (1) `startCombat`'s foe-count draw (`rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3`) can **never produce a value above 3** no matter how high `foeCap` is raised — the "D-02 raises the `Math.min` ceiling" framing only works if a depth-scaled, **zero-new-draw**, purely-arithmetic bonus is added on top of the existing roll before the `Math.min(foeCap, ...)` clamp; raising `foeCap` alone from 3 to 5 is a silent no-op. (2) `tickAbilityCooldowns(f)` does not currently take `state`, so it cannot read `abilityThreat` from the curve — a one-line signature change (`tickAbilityCooldowns(state, f)`, updating the one call site in `foeTurn`) is required before D-03 can be implemented at all, and this is exactly the kind of surgical, easy-to-miss precondition a plan should call out as its own task.

Two of CONTEXT.md's D-10/D-12/D-13 assumptions describe mechanics that do not exist in the codebase today: there is no "hire cost" (party members join for free via a random `Joiner` encounter + `resolveJoiner(true)`, no gold changes hands) and there is no "store price scaling by depth" (the store's `openStore` reads `state.floor.depth` only for the premium item's enchant-bonus roll and an informational event field — `rollBlade(rng, depth, magical)` accepts a `depth` parameter it never reads). Neither blocks the phase, but the plan must decide explicitly whether to (a) treat these as "nothing to retune here, note it and move on" or (b) treat them as new mechanics this phase adds. Given TUNE-03's explicit exclusion of new gameplay features ("closing PARTY-10, ECON deep tuning... NOT in scope: class/race/sub-class features"), (a) is the lower-risk reading — flagged as an Assumption for user confirmation.

**Primary recommendation:** Extend `difficultyCurve` with the four new fields (identity at depth ≤ 5 for `abilityThreat`, ≤ 1 for `foeCap`/`foePower`); thread the curve into `startCombat`'s per-foe copy loop and into `foeAbilities.js` via a `state`-aware `tickAbilityCooldowns`; upgrade both tuning bots with the four D-05/D-06 policies plus the D-12 opportunistic-Joiner `--party` flag; do the constants pass against the D-09 targets in ≤2 harness iterations; then wire `newRun(seed, exclude, { startDepth })` + `state.dev` + the three comparable strippers + a brand-new Settings version-line element with its own long-press handler (no reusable gesture helper exists for this — `controls.js`'s `classifyPointerGesture` is maze-viewport-specific and explicitly leaves long-press unbound).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Combat-scaling knobs (foeCap/foePower/abilityThreat) | API/Backend (engine) | — | `engine/difficulty.js` is a pure function of depth; no UI or storage involvement |
| Foe-count/power application at encounter start | API/Backend (engine) | — | `engine/combat.js#startCombat`'s per-foe copy loop; already the sole place foe instances are built |
| Ability cadence scaling | API/Backend (engine) | — | `engine/foeAbilities.js`; reads the curve via `state.floor.depth`, mutates only foe-local `f.cd`/`f.uses` |
| Tuning bot policy/tallies | Dev tooling (Node scripts, not shipped) | — | `tools/tune-difficulty.mjs` / `tools/tune-economy.mjs`; explicitly "NOT shipped, NOT a node:test file" |
| Economy constants (LOOT_DIVISOR, purse table, wilmst cache, parley bonus) | API/Backend (engine) | — | Plain constants/literals in `engine/items.js`, `engine/combat.js#killFoe`/`#parley`, `engine/encounters.js#tableFour` |
| Dev start-at-depth (`newRun` option, `state.dev`) | API/Backend (engine) | Frontend Server/Client (mazeworld.html) | `newRun` factory owns generation; the hidden Settings gesture that calls it is client-side |
| Graveyard/high-score exclusion | Client (browser adapter) | — | `src/browser/engineAdapter.js`'s `persistGrave`/`recordBest` call sites — storage-adjacent, not engine |
| Hidden dev-toggle UI (version line, long-press, depth field) | Client (browser, `mazeworld.html`) | — | New DOM element + local event listener; no server/API tier in this offline app |

## Standard Stack

No new external dependency is introduced by this phase. The project's existing, unchanged stack applies:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| Node.js built-in `node:test` | (bundled with the project's Node) | The only test runner (`npm test` = `node --test`) [VERIFIED: `package.json` read this session, `npm test` run this session — 912/912 passing, ~20.6s] | Zero-dependency project convention, unchanged since Phase 1 |
| Plain ESM `.mjs` scripts | — | `tools/tune-difficulty.mjs` / `tools/tune-economy.mjs` — "zero-dependency Node ESM script" per their own header [VERIFIED: file read] | Matches the project's "no new dependencies" constraint for dev tooling |

### Supporting
None — this phase adds no new runtime or dev dependency.

### Alternatives Considered
Not applicable — no library choice is being made this phase.

**Installation:** None required.

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** No `npm install`/`pip install`/`cargo add` of any kind is part of this phase's scope; every change is to existing engine modules, existing dev-only tooling, and `mazeworld.html`. The Package Legitimacy Gate protocol is skipped accordingly (nothing to check).

## Architecture Patterns

### System Architecture Diagram (retune data flow)

```
depth (state.floor.depth)
   │
   ▼
difficultyCurve(depth)  [engine/difficulty.js — PURE, 0 rng]
   │  { depth, breather, dots, darkBlobs, darkRadius,
   │    foeCap, foeLvlBias, foePower, abilityThreat }   <-- Phase 21 adds these 4
   │
   ├──► startCombat(state, wandering, forced, rng, events)  [engine/combat.js]
   │        1. maxLvl = clamp(min(c.level, depth), 1, 5)      (unchanged canon clamp)
   │        2. cap = c.level<=2 ? 2 : 3                        (unchanged canon literal)
   │        3. n = min( <NEW: foeCap-clamped>, baseRoll(rng.d(4)...) + <NEW: depth bonus, 0 draws> )
   │        4. per foe i in 0..n: pick from BESTIARY[type][lvl-1]
   │              f.wp = f.maxWP = Math.round(picked.wp * foePower)   <-- D-02 copy-time scaling
   │              (flat dmg bonus applied at melee-damage-roll time, NOT here — see Pitfall 1b)
   │        5. state.combat = { foes, ... }
   │
   ├──► foeTurn(state, rng, events)  [engine/combat.js]
   │        tickAbilityCooldowns(state, f)   <-- NEW: needs `state` to read abilityThreat
   │        firstReadyAbility(state, f)       (already state-aware — reads curve here)
   │        resolveFoeAbility(state, f, a, rng, events)  (already state-aware)
   │
   └──► damageFoe(state, foe, rawDmg, source, rng, events)  [engine/foeDamage.js]
            (UNCHANGED — the ONE foe-wp decrement seam; foePower never bypasses it,
             it only changes the STARTING wp/maxWP the seam decrements FROM)

Dev start-at-depth (D-13):
mazeworld.html Settings sheet
   │  (NEW) version-line element + long-press handler (no existing gesture helper reusable)
   ▼
engineAdapter.startNewRun(seed, { startDepth })   <-- signature grows a 2nd param
   ▼
engine/state.js#newRun(seed, exclude, { startDepth } = {})
   │   rollCharacter(rng, exclude)      (UNCHANGED draw order when startDepth omitted/1)
   │   genFloor(startDepth ?? 1, rng)
   │   IF startDepth > 1: checkLevel-to-threshold (NEW rng draws — fine, dev-only)
   │                       gainWilmst(depth-scaled purse)  (NEW rng draws — fine, dev-only)
   │   state.dev = startDepth > 1   (or an explicit boolean the caller passes)
   ▼
persistGrave() / recordBest()  [src/browser/engineAdapter.js]
   │  gate BOTH call sites on `!currentState.dev` (see exact lines in Pitfall 6)
```

### Recommended Project Structure

No new directories. Files touched:
```
engine/difficulty.js        # + foeCap/foeLvlBias/foePower/abilityThreat fields, + constants, + k values
engine/combat.js            # startCombat foe-count/power application; foeTurn's tickAbilityCooldowns call site
engine/foeAbilities.js      # tickAbilityCooldowns(state, f) signature change; firstReadyAbility/resolveFoeAbility
                             #   already take `state` — just read the curve inside them
engine/state.js             # newRun(seed, exclude, options) — startDepth + state.dev
engine/items.js             # LOOT_DIVISOR (if retuned)
engine/combat.js            # killFoe's purse table, parley's wilmst-bonus formula (if retuned)
engine/encounters.js        # WILMST_CACHE_PER_DEPTH (if retuned)
test/parity/harness/comparables.js  # strip `dev` alongside `party`/`pendingJoiner`/`pendingFind` in all 3 fns
engine/saveState.js         # validateSave/rehydrate: dev defaults to false when absent (additive-with-default,
                             #   mirrors migrateCarry/clearFoeEffect precedent — likely NO code change needed since
                             #   both functions already spread only whitelisted fields; confirm during planning)
tools/tune-difficulty.mjs   # decideAction: cast/drink/camp/descend-toward-exit branches; --party flag; new tallies
tools/tune-economy.mjs      # same decideAction upgrade (mirrors tune-difficulty); same tallies where relevant
docs/DIFFICULTY-RETUNE.md   # NEW — the before/after ledger (mirrors docs/PARLEY-REBALANCE.md's structure)
mazeworld.html              # NEW version-line element in the Settings sheet; long-press handler; depth input;
                             #   "DEV" chip marker in the HUD when state.dev is true
src/browser/engineAdapter.js # gate recordBest()/persistGrave() on !state.dev; thread startDepth through startNewRun
```

### Pattern 1: Extending `difficultyCurve` with combat-scaling knobs
**What:** Add four fields to the object `difficultyCurve(depth)` returns, using the existing `softCap(base, cap, depth, k)` helper for `foeCap`/`foePower`/`abilityThreat` exactly the way `dots` already uses it.
**When to use:** Any consumer that currently hard-codes a depth-independent combat constant (`startCombat`'s `cap`/`n`, `foeAbilities.js`'s cooldown countdown).
**Example (illustrative shape, not the final tuned constants):**
```javascript
// Source: engine/difficulty.js (this session's read, lines 24-118) — the existing pattern
// softCap(base, cap, depth, k) already reproduces "9 + depth" exactly for depth 1-5;
// the SAME technique keeps foeCap/foePower/abilityThreat identity at their own bands.
export const FOE_CAP_BASE = 3;      // matches today's c.level<=2?2:3 ceiling at depth<=5... see Pitfall 1
export const FOE_CAP_MAX = 5;
export const FOE_CAP_SOFT_K = 20;   // tuning knob — pick against D-09 during the retune

export const FOE_POWER_BASE = 1.0;
export const FOE_POWER_MAX = 1.6;
export const FOE_POWER_SOFT_K = 25;

export const ABILITY_THREAT_BASE = 1.0;
export const ABILITY_THREAT_MAX = 2.0;   // e.g. "every: 2" effectively becomes "every: 1" at the asymptote
export const ABILITY_THREAT_SOFT_K = 20;

// inside difficultyCurve(depth), alongside the existing dots/darkBlobs/darkRadius:
foeCap: breather ? FOE_CAP_BASE : Math.min(FOE_CAP_MAX, softCapValue(...)),
foeLvlBias: 0, // reserved, D-01 — unused unless the retune needs it
foePower: softCapValue(FOE_POWER_BASE, FOE_POWER_MAX, d, FOE_POWER_SOFT_K),
abilityThreat: softCapValue(ABILITY_THREAT_BASE, ABILITY_THREAT_MAX, d, ABILITY_THREAT_SOFT_K),
```
Note `softCap()` as currently written ROUNDS its result (`Math.round(...)`) — appropriate for integer `dots`/`darkBlobs`, but `foePower`/`abilityThreat` are meant to be fractional multipliers (1.0 → 1.6). The plan should either add a non-rounding variant or inline the asymptotic formula directly for these two fields — using the existing `softCap` verbatim on a multiplier would truncate `1.3` to `1`, silently flattening the whole curve.

### Pattern 2: Bot policy upgrade (D-05/D-06) — extending `decideAction`
**What:** `decideAction(state, policyRng)` in both tools is a single `if/else` chain gated on `state.combat`/`state.store`/else-explore. Add branches BEFORE the existing combat/explore checks, in priority order: (1) in combat + caster-aware flee/parley threshold (D-06), (2) in combat + has a castable attack spell + not already fleeing → cast, (3) out of combat + wp low + potion carried → drink, (4) out of combat + wp low + no potion + rations ≥ 1 → camp, (5) out of combat + floor clear of dots → head toward the floor's "exit" tile instead of nearest-unseen, (6) fallback to today's explore-nearest-unseen.
**When to use:** Both `tools/tune-difficulty.mjs` and `tools/tune-economy.mjs` share this policy function nearly verbatim today (confirmed by diff-reading both files this session) — extend both, or better, extract the shared policy into one module both scripts import (reduces drift risk; currently the two copies are already slightly diverged, e.g. the economy tool's policy also handles `state.pendingFind`).
**Example:**
```javascript
// Source: tools/tune-difficulty.mjs (this session's read, lines 125-143) — the exact function to extend
function decideAction(state, policyRng) {
  if (state.combat) {
    const c = state.c;
    const ratio = c.maxWP > 0 ? c.wp / c.maxWP : 0;
    const anyCaster = liveFoesHaveAbilities(state); // NEW: state.combat.foes.some(f => f.abilities?.length)
    const fleeThreshold = anyCaster ? 0.5 : 0.3;     // D-06
    if (ratio < fleeThreshold) {
      if (canParley(state)) return { type: "parley" };
      return { type: "flee" };
    }
    const castIdx = findCastableAttackSpell(state); // NEW: canCast + maxCharges-c.spellsUsed>0 + kind:"thrown"
    if (castIdx !== null) return { type: "castSpell", idx: castIdx };
    return { type: "attack" };
  }
  if (state.store) return { type: "leaveStore" };
  const c = state.c;
  if (c.wp / c.maxWP < 0.5 && c.potions > 0) return { type: "drinkPotion" };       // D-05
  if (c.wp / c.maxWP < 0.5 && c.rations >= 1) return { type: "camp" };             // D-05
  if (floorHasNoDots(state.floor) || explorationBudgetExceeded) {                  // D-05
    const dir = dirTowardExit(state) || nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
    return { type: "move", dir };
  }
  const dir = nearestUnseenDir(state) || pickFallbackDir(state, policyRng);
  return { type: "move", dir };
}
```
`liveFoesHaveAbilities`/`floorHasNoDots`/`dirTowardExit` are all readable from PUBLIC state (`state.combat.foes[].abilities`, `state.floor.g[y][x].feat`) — no engine-internal import needed, consistent with the tools' own "public applyAction/newRun/makeRng surface" constraint.

### Pattern 3: The `--party` flag (D-12) — opportunistic, not forced
**What:** There is no "hire" action in `engine/actions.js`'s `ACTION_TYPES` set and no gold cost anywhere for adding a party member. The ONLY way a member joins is: a random `Joiner` encounter fires from `ENCOUNTER_TABLES` (2 of its 80 cells — `[1][4]` and `[5][9]`, `content/encounters.js`), which pushes a `joinerMet` event and stashes `state.pendingJoiner`; the player then sends `{ type: "resolveJoiner", accept: true }`.
**When to use:** For `--party`, the bot cannot FORCE a member at run start through the public `applyAction`/`newRun` surface the tools are constrained to (their own header comment: "never engine internals directly"). The only public-surface-compliant approach is opportunistic: keep exploring normally, and the instant any `move` action's returned events include `joinerMet`, immediately issue `{ type: "resolveJoiner", accept: true }` as the very next action. This means `--party` runs are **not** "solo seed N vs. party seed N" — they are a genuinely different rng-consuming trajectory (the exploration path differs the moment a member accepts), so the `--party` readout is its own separate distribution, not a paired diff against the solo readout for the same seed list.
**Alternative (if the planner wants a GUARANTEED party member):** Import `meetJoiner`/`resolveJoiner` directly from `engine/encounters.js` (bypassing `applyAction`) the same way `test/parity/harness/comparables.js`'s `applyStartCombat` bypasses `applyAction` to call `startCombat` directly for test-fixture setup. This is a deliberate, precedented exception to the tools' "public surface only" rule — the plan should state explicitly which approach it picks, since it changes both the tool's import list and the meaning of the `--party` readout.

### Pattern 4: Dev start-at-depth wiring (D-13/D-14)
**What:** `engine/state.js#newRun(seed, exclude = [])` currently takes exactly two positional params. CONTEXT.md's literal `newRun(seed, { startDepth })` phrasing collides with the existing `exclude` array parameter — the signature must become `newRun(seed, exclude = [], options = {})` (or fold `exclude` into `options` and update the one caller, `src/browser/engineAdapter.js#initRun`). Recommend the 3-arg form: it is additive, and `initRun(seed, exclude)` / `startNewRun(seed)` / `boot(freshSeed)` (all three call `initRun`/`newRun` with 1-2 args today) need zero changes to keep working.
**When to use:** Exactly once, in `newRun`.
**Example:**
```javascript
// Source: engine/state.js (this session's read, lines 63-105) — exact current signature/body
export function newRun(seed, exclude = [], { startDepth = 1 } = {}) {
  const rng = makeRng(seed);
  const c = rollCharacter(rng, exclude);          // UNCHANGED draw order when startDepth === 1
  const floor = genFloor(startDepth, rng);        // genFloor(1, rng) when startDepth omitted — byte-identical
  reveal(floor, revealRadius({ floor, c }));

  const state = { version: STATE_VERSION, seed, rngState: rng.getState(), c, floor, day: 1, steps: 0,
                   combat: null, store: null, beats: null, party: [], pendingFind: null,
                   dead: false, won: false, deathNote: "", epitaph: "" };

  if (startDepth > 1) {
    // DEV-ONLY PATH — never reached by any fixture/default caller, so new rng draws here
    // are safe (D-14). checkLevel needs `state` + `events` shaped as its other callers use it.
    const events = [];
    c.sp = THRESHOLDS[Math.min(startDepth, 5) - 1]; // content/misc-tables.js THRESHOLDS = [0,201,501,901,1501]
    checkLevel(state, rng, events);                  // draws gain-dice rng per level, exactly like a real climb
    gainWilmst(state, WILMST_CACHE_PER_DEPTH * startDepth, "dev start", rng, events); // depth-scaled purse
    state.dev = true;
  }
  return state;
}
```
`checkLevel` expects `state.c`/mutates in place and needs `rng`/`events` — it is already exported from `engine/character.js` and already imported by `engine/movement.js`'s `descend`, so importing it into `state.js` is a new import, not a new module. Watch the import-cycle direction: `state.js` currently imports from `maze.js`/`character.js`/`derived.js` only — importing `checkLevel` (already in `character.js`) and `gainWilmst` (in `items.js`) may introduce a NEW edge `state.js → items.js`; confirm no cycle forms (items.js does not appear to import state.js directly, based on this session's reads, but verify with a grep before landing).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Asymptotic depth scaling | A hand-rolled clamp/lerp for `foeCap`/`foePower`/`abilityThreat` | The existing `softCap(base, cap, depth, k)` helper (or a non-rounding variant of it) | It is already the project's one documented pattern for "grows toward a cap, never reaches it, stays smooth" (`ENCOUNTER_DOT_CAP`/`darkBlobs` already use it) — reinventing a second curve shape here would be an inconsistent second source of truth |
| "Which floors need a party-member gesture" for `--party` | A new synthetic/mocked Joiner injection path | The existing `meetJoiner`/`resolveJoiner` pair (either via natural encounter roll, opportunistically, or via the precedented `applyStartCombat`-style direct-import bypass) | Both paths already exist, are already tested, and are already parity-safe; a mock risks drifting from the real mechanic's odds/costs |
| Long-press gesture detection for the hidden dev toggle | A generic reusable "long-press any element" utility, mirroring `controls.js`'s `classifyPointerGesture` | A small, local `pointerdown` + `setTimeout` + `pointerup`/`pointercancel`-clears-timer handler scoped to the one new version-line element | `classifyPointerGesture` is purpose-built for the maze viewport's tap-vs-drag classification (uses `TAP_MOVE_THRESHOLD_PX`/`TAP_MAX_DURATION_MS` tuned for D-pad movement) and explicitly "reserves long-press with no bound action" — repurposing it for a Settings-sheet button would couple two unrelated UI surfaces for no benefit |

**Key insight:** every "don't hand-roll" here is really "don't hand-roll a SECOND version of a pattern this codebase already has one of" — the risk in this phase is drift/duplication, not missing infrastructure.

## Common Pitfalls

### Pitfall 1: `foeCap` cannot raise the foe count above 3 by itself
**What goes wrong:** `startCombat`'s foe-count roll is `Math.min(cap, rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3)`. The ternary's own maximum output is literally `3` — there is no branch that can ever produce `4` or `5`. Raising `foeCap` from `3` to `5` and plugging it into `Math.min(foeCap, thatRoll)` changes nothing (`Math.min(5, x)` where `x ≤ 3` always equals `x`).
**Why it happens:** D-02's phrasing ("foeCap only raises the Math.min ceiling") describes the INTENT (bigger fights deep) but not a mechanism that actually achieves it given the existing draw shape, which the same decision also requires to stay byte-identical ("the prototype's d4/d4 count draws are preserved... draw shape never changes").
**How to avoid:** Add a second, purely-arithmetic (zero new rng draws) depth-derived bonus BEFORE the `Math.min`, e.g. `const bonus = Math.max(0, Math.round(foeCap) - 3); const n = wandering ? 1 : Math.min(foeCap, baseRoll + bonus);` — at depth ≤ 5, `foeCap === 3` so `bonus === 0` and `n` is byte-identical to today; at depth 30, `foeCap → 5` so `bonus → 2`, letting `n` reach up to 5 without ever touching the rng stream differently.
**Warning signs:** A "foeCap increased but tune-difficulty's foe-count readout didn't move" result during the retune iteration.

### Pitfall 2: `tickAbilityCooldowns(f)` cannot read `abilityThreat` without a signature change
**What goes wrong:** `firstReadyAbility(state, f)` and `resolveFoeAbility(state, f, a, rng, events)` both already receive `state` and could read `difficultyCurve(state.floor.depth).abilityThreat` directly. `tickAbilityCooldowns(f)` — called immediately before `firstReadyAbility` in `foeTurn` — takes ONLY `f`. If the scaling is implemented by changing the effective cooldown countdown (the natural place, since it lazily inits `f.cd[id] = a.every`), it needs the curve too.
**Why it happens:** This function was written in Phase 19 before Phase 21's scaling requirement existed; nothing about it is wrong for its original job.
**How to avoid:** Change the one declaration (`export function tickAbilityCooldowns(state, f)`) and the one call site (`engine/combat.js#foeTurn`, currently `tickAbilityCooldowns(f);`) to `tickAbilityCooldowns(state, f);`. Compute the lazy-init value as `f.cd[id] = Math.max(1, Math.round(a.every / difficultyCurve(state.floor.depth).abilityThreat))` so `abilityThreat === 1` (depth ≤ 5, per D-04) reproduces `a.every` exactly, preserving every D-15 pinned cooldown number untouched.
**Warning signs:** `test/determinism/foe-abilities.test.js`'s D-15 pins (which set `state.floor.depth` directly to 2/4/5 to force casters — see Pitfall 7) turning red the moment `abilityThreat` stops being pure identity at those depths.

### Pitfall 3: no "hire" mechanic exists — D-12's framing needs a translation, not a literal build
**What goes wrong:** Building a literal "hire cost" feature (a new store/action to pay gold for a party member) would be new gameplay scope, which TUNE-03 explicitly excludes ("NOT in scope: class/race/sub-class features") and CONTEXT.md's Deferred Ideas list ("Bard/hire" is not deferred, but no such mechanic is described anywhere in the codebase or the milestone's prior phases).
**Why it happens:** The `killFoe` comment "Members are hired muscle in v1 (no XP progression)" is flavor text describing the party's ROLE, not an actual economic transaction — there genuinely is no gold-for-member exchange anywhere in `engine/`.
**How to avoid:** Read D-12 as: "retune `upkeep()` by race/depth **only if** the opportunistic `--party` readout shows the free member is too strong relative to solo" — i.e., the counterweight in scope is the EXISTING `upkeep(c)` function (`engine/derived.js`, race-based flat `wp`/day cost) and PARTY-06's XP-share damping (already implemented, `engine/combat.js#killFoe`'s `heroShare = Math.round(gained/shares)`), not a brand-new cost-to-recruit mechanic. Confirm this reading with the user before planning — flagged in the Assumptions Log.
**Warning signs:** A plan task titled "add hire cost to the store" — that is new scope this phase's requirements do not authorize.

### Pitfall 4: bot runtime budget — a smarter bot lives longer, and 200 seeds already took 5-6 minutes pre-upgrade
**What goes wrong:** `18-06-SUMMARY.md` records `tools/tune-difficulty.mjs --seeds=200` taking ~5-6 minutes even with the DUMB (attack-only) bot. Adding camp/drink/cast/descend-toward-exit policies means runs survive longer (by design — that is the whole point of D-05), so wall-clock time per run goes UP, not down. `MAX_ACTIONS = 20000` is the hard safety stop in both scripts today.
**Why it happens:** More surviving actions per run × 200 seeds, with no change to the per-action cost (still a full `structuredClone` + `applyAction` per step).
**How to avoid:** As the phase description's own "Specific Ideas" section anticipates, add a bounded per-run action cap tuned so the readout stays under ~10 minutes at the default `--seeds`, OR lower the default `--seeds` count, OR run the readout in the background with the `EXIT=` sentinel precedent (`18-06-SUMMARY.md`: "polling it in bounded ≤120s checks until its EXIT=0 sentinel appeared") rather than blocking in the foreground.
**Warning signs:** An executor stalling mid-task waiting in the foreground for a multi-minute tuning run — exactly the failure mode `18-06-SUMMARY.md` documents happening once already.

### Pitfall 5: "store price scaling by depth" does not exist today
**What goes wrong:** D-10 lists "store price scaling" among the constants in scope to retune, implying an existing depth-scaled pricing formula. `engine/economy.js#openStore` reads `state.floor.depth` (`const d = state.floor.depth;`) but the ONLY use of `d` is passing it into `rollBlade(rng, d, true)` for the premium item roll and into the `storeOpened` event as an informational field — `rollBlade(rng, depth, magical)`'s own body (`engine/items.js`) never reads its `depth` parameter at all. Every stock item's `cost` comes from `priceFor(base, race)` (race-only) and flat base costs in `content/*.js` — no floor-depth multiplier exists anywhere in the pricing path.
**Why it happens:** Likely a carry-forward assumption from `.planning/research/SUMMARY.md`'s ECON deep-tuning framing, or conflated with `rollTreasureItem(rng, state.floor.depth, c)` (`engine/combat.js#killFoe`), which DOES scale loot-roll value by depth — a different code path (found-item value, not store price).
**How to avoid:** Confirm with the user whether this phase should (a) leave store pricing flat (matching "NOT in scope: new features") or (b) add depth scaling as new work. Given TUNE-03's explicit constant list doesn't authorize new mechanics, (a) — document in the ledger as "no depth-scaled store pricing exists; not added this phase" — is the lower-risk default, flagged in the Assumptions Log.
**Warning signs:** A plan task that edits `openStore`'s cost formula expecting an existing depth multiplier to tune, and finding none.

### Pitfall 6: no version line and no reusable long-press gesture exist for the D-13 hidden toggle
**What goes wrong:** CONTEXT.md's D-13 says "long-press the version line reveals a depth field," implying a version-line element already exists in the Settings sheet. It does not — `mazeworld.html`'s `#mw-settings-sheet` (`.mw-settings-rows`) currently has exactly five rows: Handedness, Text size, Confirm before quit, Sound, Haptics. No version string is displayed anywhere in the app today (grepped for `version`/`Version` outside code comments — zero UI hits). Separately, `src/browser/controls.js`'s `classifyPointerGesture` is the only long-press-adjacent logic in the codebase, and it is scoped to the maze viewport's tap-vs-drag movement classification, not to arbitrary buttons — plus its own doc comment says long-press is explicitly unbound.
**Why it happens:** CONTEXT.md's phrasing describes the INTENDED final UX, written before this session's direct-source confirmation that the underlying element doesn't exist yet.
**How to avoid:** The plan must include a task to ADD a version-line row/element to `#mw-settings-rows` (reading the app version from wherever `android/version.properties`/`package.json` exposes it, or a hardcoded display string — confirm source) plus a small standalone `pointerdown`/`setTimeout`/`pointerup` handler on that new element (NOT a reuse of `classifyPointerGesture`).
**Warning signs:** A plan task that says "wire the long-press to the existing version line" without a preceding task to create that element.

### Pitfall 7: D-15's existing determinism pins already prove the depth ≤ 5 identity boundary — use it, don't re-derive it
**What goes wrong:** Re-deriving from scratch whether `abilityThreat` needs to be identity through depth 5 (vs. depth 1) risks getting the boundary wrong and either breaking `test/determinism/foe-abilities.test.js` or being needlessly conservative (identity only at depth 1, unnecessarily limiting where the new scaling can start).
**Why it happens:** CONTEXT.md's D-04 says "identity at depth ≤ 1 / level 1," which sounds like the boundary is exactly 1, but the actual proof artifact goes further.
**How to avoid:** `test/determinism/foe-abilities.test.js`'s five `ENCOUNTERS` specs each set `state.c.level = state.floor.depth = tier` where `tier` ranges 2, 4, 5 (to force each canon caster's roster tier via `startCombat`'s own `maxLvl` clamp) — these pinned per-visit draw counts and cooldown-ready/not-ready decisions were measured against the CURRENT (identity, `abilityThreat === 1` implicit) engine at depths 2/4/5, not just depth 1. So the real, already-proven-safe identity band is **depth ≤ 5** (which not coincidentally matches `BREATHER_EVERY = 5`'s existing "floors 1-5 don't need scaling yet" framing and the canon tier cap of 5). `abilityThreat` (and `foeCap`/`foePower`, which the SAME encounters exercise via `startCombat`) must equal their identity value at depth ≤ 5, not just depth 1, and can begin scaling only from depth 6 onward.
**Warning signs:** `foeAbilities.test.js` failing at depth 4-5 specifically (not depth 1) after the scaling lands — a strong signal the identity band was set too narrow.

## Code Examples

### Reading the curve inside `startCombat` (illustrative — exact wiring is the executor's task)
```javascript
// Source: engine/combat.js (this session's read, lines 116-161) + engine/difficulty.js
import { difficultyCurve } from "./difficulty.js"; // already imported by movement.js/maze.js; NEW import for combat.js

export function startCombat(state, wandering, forced, rng, events = []) {
  const c = state.c;
  const curve = difficultyCurve(state.floor.depth); // 0 rng draws — pure, safe to call unconditionally
  // ... existing tracked/maxLvl/cap logic unchanged ...
  const baseRoll = rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3; // UNCHANGED draw shape
  const bonus = Math.max(0, Math.round(curve.foeCap) - 3);    // 0 at depth<=5 (curve.foeCap===3) — see Pitfall 1
  const n = wandering ? 1 : Math.min(curve.foeCap, baseRoll + bonus);
  for (let i = 0; i < n; i++) {
    const lvl = clamp(maxLvl - (rng.d(4) === 1 ? 1 : 0), 1, 5); // UNCHANGED
    const roster = BESTIARY[type][lvl - 1];
    const picked = rng.pick(roster); // UNCHANGED — same draw, same roster
    const scaledWp = Math.round(picked.wp * curve.foePower); // curve.foePower===1.0 at depth<=1 => Math.round(x*1)===x
    foes.push({
      name: picked.n, type, lvl, size: picked.sz, intel: picked.i,
      wp: scaledWp, maxWP: scaledWp, // <-- the D-02 copy-time scaling
      alive: true, asleep: 0, sp: picked.sp || {}, lives: picked.sp && picked.sp.twice ? 2 : 1,
      ...(picked.abilities ? { abilities: picked.abilities.slice() } : {}),
    });
  }
  // ...
}
```
**IMPORTANT — verify `Math.round(picked.wp * 1.0) === picked.wp` for every fixture-exposed creature.** All four fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante — per `test/parity/FIXTURE-INVENTORY.md`) have integer `wp`, so `Math.round(wp * 1.0)` is trivially identity; still worth an explicit unit assertion since `foePower` is a float field and this is exactly the kind of `Math.round` edge the phase description's own research questions flag ("watch Math.round on wp").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Floor-generation-only `difficultyCurve` (dots/darkBlobs/darkRadius) | Combat-scaling-aware `difficultyCurve` (+foeCap/foeLvlBias/foePower/abilityThreat) | This phase (Phase 21) | `startCombat`/`foeAbilities.js` gain a single source of truth for depth-based combat scaling, closing the gap the phase description identifies ("no combat-scaling knob yet") |
| Tuning bots that only attack/flee/parley/explore/leave-stores | Bots that also cast/drink/camp/head-to-exit and react to caster foes | This phase | Turns the harness from "blind to floor 30-50 casters" (18-06's own finding) into a usable proxy for the retune |
| `newRun(seed)` always starts floor 1 | `newRun(seed, exclude, { startDepth })` dev-only option | This phase | Enables the TUNE-04 human DR round without a 5-10 minute per-session climb to reach floor 20-50 |

**Deprecated/outdated:** None — this phase extends existing patterns, it does not retire any.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-12's "hire cost and upkeep by depth" refers to retuning the EXISTING `upkeep()` function/PARTY-06 XP damping, not building a new gold-for-member mechanic (none exists today) | Pitfall 3 | If the user actually wants a new hire-cost feature, this phase's scope silently expands beyond TUNE-03's "not in scope: new features" exclusion — needs explicit confirmation before planning tasks around it |
| A2 | D-10's "store price scaling by depth" should be documented as "does not exist, not added this phase" rather than built as new work | Pitfall 5 | If store depth-pricing is actually wanted, it's a new mechanic requiring its own design (which base price? which scaling curve?) — currently zero code exists to retune |
| A3 | The version-line UI element for D-13's hidden toggle should be newly added to the Settings sheet (reading some existing version string, TBD source) rather than assumed pre-existing | Pitfall 6 | If the plan assumes the element exists, the executor will hit a missing-DOM-node failure on the very first UI task |
| A4 | `foePower`/`abilityThreat` should use a non-rounding (or differently-rounded) variant of `softCap` since they are fractional multipliers, not integer counts like `dots` | Pattern 1 | Using the existing integer-rounding `softCap` verbatim would flatten `foePower` to whole-number multiples (1, 2, 3...) instead of a smooth 1.0→1.6 curve, defeating the "smooth soft-cap" rationale the phase inherits from `difficultyCurve`'s own header comment |
| A5 | The exact numeric constants (`FOE_CAP_MAX`, `FOE_POWER_MAX`, `ABILITY_THREAT_MAX`, their `k` values, and every economy-constant retune amount) are Claude's Discretion per CONTEXT.md and are properly the retune's own iterative output, not something research should pre-select | Pattern 1, D-10 | None if respected — flagged only so the planner doesn't mistake the illustrative example constants above for locked values |

**If this table is empty:** N/A — see rows above; A1/A2/A3 in particular should be raised with the user (or at minimum stated explicitly in the plan's own assumptions) before task-level planning locks them in.

## Open Questions (RESOLVED — see CONTEXT.md D-20, D-23)

1. **Should `tools/tune-difficulty.mjs` and `tools/tune-economy.mjs` share one policy module, or stay independently duplicated?**
   - What we know: both already implement nearly identical `decideAction`/`nearestUnseenDir`/`canStep`/`legalDirs` functions (confirmed by direct diff-reading both files this session); they have already drifted slightly (the economy tool also handles `state.pendingFind`, the difficulty tool does not).
   - What's unclear: whether extracting a shared `tools/tune-shared.mjs` is worth the churn for a dev-only, unshipped pair of scripts, versus just duplicating the D-05/D-06 upgrade into both files a second time (continuing the existing pattern).
   - Recommendation: extract a shared module — the D-05/D-06/D-07 upgrade is substantial enough (4 new policies + tallies) that duplicating it verbatim into two files roughly doubles the diff size and doubles future-maintenance risk, for zero shipped-code benefit either way.

2. **Does `--party`'s opportunistic-Joiner approach (Pattern 3) satisfy D-12's intent, or does the plan need the direct-import bypass instead?**
   - What we know: the public `applyAction`/`newRun` surface has no way to force a party member at run start; the direct-import bypass (mirroring `applyStartCombat`'s precedent) WOULD guarantee one but breaks the tools' own "public surface only" self-imposed rule.
   - What's unclear: whether CONTEXT.md's author considered this constraint when writing D-12, or assumed a "hire" action existed.
   - Recommendation: default to the opportunistic approach (lower-risk, no precedent-breaking) and document the tradeoff (readout is a genuinely different rng trajectory, not a solo/party diff) explicitly in `docs/DIFFICULTY-RETUNE.md`; escalate to the direct-import bypass only if the opportunistic approach yields too few `--party` samples to be useful (a real risk given the `Joiner` cell only occupies 2/80 of the encounter table).

3. **Where exactly should `dev` be added to `saveState.js`'s `validateSave`/`rehydrate`?**
   - What we know: both functions build their return value from an explicit whitelist of fields (`version, seed, rngState, c, floor, day, steps, party, dead, won, deathNote, epitaph`, plus conditionally `deathAt`/`lastWords`) — neither spreads the raw input object, so a NEW field like `dev` needs an explicit added line in both, not just a strip in `comparables.js`.
   - What's unclear: whether `dev` should default to `false` (safe, matches `!!obj.dead` pattern) or be omitted entirely when falsy (mirroring `deathAt`'s "only added when present" pattern).
   - Recommendation: `dev: !!obj.dev` in both, mirroring the existing `dead`/`won` boolean-coercion pattern exactly (rather than the conditional-presence pattern used for `deathAt`/`lastWords`, since `dev` is a boolean flag every state has, not an optional terminal-run field).

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the project's existing Node.js + `node:test` setup, already verified present and working (`npm test`: 912/912 passing this session).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (via `node --test`), no external test runner [VERIFIED: `package.json` scripts, `npm test` run this session] |
| Config file | None — `package.json` scripts drive glob-based discovery |
| Quick run command | `npm run test:quick` (`test/unit/**`, `test/determinism/**`, `test/roundtrip/**`) |
| Full suite command | `npm test` (currently **912/912 passing, ~20.6s**, measured directly this session `[VERIFIED: npm test run]`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| TUNE-01 | `difficultyCurve(1)` (and every depth ≤ 5) pins its exact pre-Phase-21 object plus the new identity values (`foeCap:2or3, foePower:1.0, abilityThreat:1.0`) | unit | `node --test test/unit/difficulty.test.js` | check — likely ✅ existing file to extend (Phase 3 created `difficulty.js`'s own test file) |
| TUNE-01 | `startCombat` at depth 10/30 scales `n`/`wp` per the curve, with `countingRng` draw-shape EQUAL to depth-1's draw shape (same number/type of draws, different resulting values only) | unit + determinism | `node --test test/unit/foe-turn-draw-count.test.js` (extend Section 4/new section) | ✅ extend existing |
| TUNE-01 | `abilityThreat`/`foeCap`/`foePower` are identity through depth ≤ 5 — `test/determinism/foe-abilities.test.js`'s five D-15 pinned specs (tiers 2/4/5) stay green with ZERO edits | regression | `npm test test/determinism/foe-abilities.test.js` | ✅ existing, must require zero edits (Pitfall 7) |
| TUNE-01 | Parity suite (30/30) stays byte-identical with zero new carve-outs for the scaling fields themselves (only `dev` is a new carve-out, per D-14) | parity | `npm test` (full-suite + all 4 parity files) | ✅ existing |
| TUNE-02 | Both tools' new policies (cast/drink/camp/descend-toward-exit, caster-aware flee threshold) exercised at least once across a sample of seeds | manual/dev-tool | `node tools/tune-difficulty.mjs --seeds=200` / `node tools/tune-economy.mjs --seeds=200` (background, `EXIT=` sentinel pattern per Pitfall 4) | ✅ existing tools, extended |
| TUNE-02 | New ability tallies (`foeCast`/`foeBolted`/.../`heroResistFailed`) appear correctly in both `--json` and text output | manual/dev-tool | Same commands, `--json` flag; spot-check against a run's raw event stream | ✅ existing tools, extended |
| TUNE-03 | Every changed economy/party/ability constant is recorded in `docs/DIFFICULTY-RETUNE.md` with a BEFORE/AFTER readout and a rationale per knob | doc-consistency | Manual review + (optionally) a doc-consistency test mirroring `18-06`'s "AFTER table generated verbatim and machine-checked" precedent | ❌ Wave 0 if a machine-checked table is chosen; manual review is also acceptable per D-11's own "informational, not a gate" framing |
| TUNE-04 | Human DR sign-off at depth 20/35/50 via the dev toggle | **human-only** — no automated test exists or should exist for subjective "did this feel fair" judgment | N/A — `human_needed`, per D-15's own explicit statement | N/A |
| D-13/D-14 | `newRun(seed)` (no options) stays byte-identical to today; `newRun(seed, exclude, {startDepth:1})` is identical to `newRun(seed, exclude)`; `newRun(seed, exclude, {startDepth:20})` sets `state.dev=true`, `state.floor.depth===20`, and grants a level/purse per the SP-threshold formula | unit | `node --test test/unit/state.test.js` (extend, or new) | check — likely ✅ existing `newRun` tests to extend |
| D-14 | `dev` is stripped in `movementComparable`/`combatComparable`/`economyComparable`; a v1.0-shaped save JSON (no `dev` key) round-trips with `dev===false` after `validateSave`+`rehydrate` | parity + roundtrip | `npm test` (parity suite) + `node --test test/roundtrip/**` | ✅ extend existing files |
| D-13 | Graveyard/high-score exclusion: a dev run's death does NOT call `persistGrave`/`recordBest` | unit | `node --test` a new or existing `engineAdapter.test.js` covering `dispatch()`'s death path with `state.dev===true` | check — confirm `engineAdapter.js` has an existing test file to extend |

### Sampling Rate
- **Per task commit:** `npm run test:quick`
- **Per wave merge:** `npm test` (full suite — every wave here touches parity-adjacent or save-adjacent code)
- **Phase gate:** `npm test` full green (baseline 912/912 plus new tests) before `/gsd-verify-work`; the two tuning-tool readouts are informational per their own headers (never a pass/fail gate); TUNE-04's DR round is the phase's genuine, deliberate `human_needed` exit condition — do not attempt to automate it away

### Wave 0 Gaps
- [ ] Confirm whether `test/unit/difficulty.test.js` exists (Phase 3 likely created it) — extend it for the new curve fields rather than creating a duplicate
- [ ] Confirm whether an `engineAdapter.js`-focused test file exists to extend for the `state.dev` graveyard/high-score exclusion, or whether a new `test/unit/engineAdapter-dev.test.js` is warranted
- [ ] A doc-consistency test for `docs/DIFFICULTY-RETUNE.md`'s AFTER table, IF the planner chooses the machine-checked precedent (18-06) over a manually-reviewed table (D-11 permits either)
- [ ] The shared-vs-duplicated tuning-tool policy module decision (Open Question 1) affects test file layout — resolve before writing Wave 0 test scaffolding for TUNE-02

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Single-player, fully offline, no accounts (project constraint, unchanged) |
| V3 Session Management | No | No sessions; a "run" is local game state only |
| V4 Access Control | No | No multi-user boundary |
| V5 Input Validation | Yes (unchanged surface + one new consideration) | The `newRun(seed, exclude, { startDepth })` `startDepth` parameter is caller-supplied but NEVER attacker-reachable through `engine/actions.js`'s validated action surface — it can only be invoked from the hidden dev-toggle's own trusted client code (`src/browser/engineAdapter.js#startNewRun`), which should still clamp/sanitize `startDepth` (integer, ≥ 1, reasonable upper bound e.g. ≤ 999) the same way `difficulty.js#safeDepth` already guards `state.floor.depth` elsewhere, so a corrupted/malicious value typed into the dev depth field can never produce `NaN`/negative floor generation |
| V6 Cryptography | No | No secrets/crypto touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| A tampered/replayed save carrying `dev: true` to dodge future graveyard/leaderboard-adjacent logic | Tampering | Low severity (fully offline, single-player, no shared leaderboard) — `dev` only ever suppresses THIS player's own `recordBest`/`persistGrave` calls; there is no adversarial party who benefits from spoofing it. `validateSave` should still coerce it to a strict boolean (`!!obj.dev`) rather than trusting an arbitrary truthy value, mirroring the existing `dead`/`won` coercion |
| A malformed `startDepth` (negative, non-integer, absurdly large) reaching `genFloor`/`checkLevel`/`gainWilmst` | Tampering / Denial of Service (local) | Reuse `difficulty.js#safeDepth`'s existing guard pattern (`Math.floor` + `Number.isFinite` + `Math.max(1, ...)`) at the `newRun` entry point before using `startDepth` in `genFloor`/`THRESHOLDS` indexing — an out-of-range index into `THRESHOLDS[Math.min(startDepth,5)-1]` could otherwise read `THRESHOLDS[-1]` (`undefined`) for a `startDepth ≤ 0` |

This phase's security surface remains minimal (offline, single-player, no network) — the one genuinely new consideration is sanitizing the dev-only `startDepth` input at the point it enters the engine, consistent with the codebase's existing `safeDepth` pattern rather than introducing a new validation style.

## Sources

### Primary (HIGH confidence — direct source reads this session)
- `engine/difficulty.js` — full read: `softCap`, `isBreather`, `difficultyCurve`, `safeDepth`
- `engine/combat.js` — `startCombat` (lines 109-236), `killFoe` (444-502), `pursuitStrike` (504-538), `pickFoeTarget`/`applyFoeDamageToPlayer` (996-1146), `foeTurn` (1148-1306), `parley`'s Humans-wilmst-bonus line (712)
- `engine/foeAbilities.js` — full read: `tickAbilityCooldowns`, `firstReadyAbility`, `heroResist`, `resolveFoeAbility`
- `engine/foeDamage.js` — full read: `multiplierFor`, `damageFoe`
- `engine/character.js` — full read: `rollCharacter`, `checkLevel`, THRESHOLDS usage
- `engine/actions.js` — full read: `ACTION_TYPES` (confirms no `hire` action exists)
- `engine/state.js` — full read: `newRun`, `addPartyMember`, `PARTY_CAP`
- `engine/engine.js` — full read: `applyAction` dispatcher (confirms no explicit "descend" action — descent is automatic via `move()` onto an `exit` tile)
- `engine/movement.js` — `move` (108-368), `makeCamp` (513-522), `descend`/`winGame` (627-680)
- `engine/magic.js` — `castSpell` (48-90), `drinkPotion` (390-400), `readScroll` (420-441)
- `engine/economy.js` — `priceFor`, `openStore` (215-301) (confirms `depth` is read but only feeds the premium-item roll/event, never a price multiplier)
- `engine/items.js` — `LOOT_DIVISOR` (77), `gainWilmst` (81-...), `rollBlade`/`rollMailPiece` (117-...) (confirms `rollBlade`'s `depth` param is never read in its body)
- `engine/derived.js` — `levelFromSP`/THRESHOLDS usage (478-490)
- `engine/saveState.js` — full read: `validateSave`, `rehydrate`, `migrateCarry`, `clearFoeEffect`, `sanitizeParty` (the explicit-whitelist pattern new fields must join)
- `engine/encounters.js` — `encounterDot` dispatch (168-210), `tableFour`'s `WILMST_CACHE_PER_DEPTH = 300` (235-259)
- `content/encounters.js` — `ENCOUNTER_TABLES` (confirms `Joiner` occupies exactly 2 of 80 cells)
- `content/foe-abilities.js` — full read: `FOE_ABILITIES` registry shape, dice budget commentary
- `content/misc-tables.js` — `THRESHOLDS = [0, 201, 501, 901, 1501]`
- `test/parity/harness/comparables.js` — full strip-pattern read: `movementComparable`/`combatComparable`/`economyComparable` (exact destructure lines where `dev` must join `party`/`pendingJoiner`/`pendingFind`)
- `test/parity/FIXTURE-INVENTORY.md` — confirms every fixture is a level-1 character on floor 1
- `test/unit/foe-turn-draw-count.test.js` — FID-02 baseline pins, Section 4's ability-gate identity tests
- `test/determinism/foe-abilities.test.js` — full read of the `ENCOUNTERS` spec list and its header (confirms D-15's pinned tests exercise depth/tier 2, 4, 5 — establishing the true identity boundary at depth ≤ 5, see Pitfall 7)
- `tools/tune-difficulty.mjs` — full read: `decideAction`, `autoPlayOnce`, `MAX_ACTIONS`, CLI parsing
- `tools/tune-economy.mjs` — full read: near-duplicate policy, gold-tracking readout
- `mazeworld.html` — grepped Settings-sheet markup (`#mw-settings-sheet`, `.mw-settings-rows`, lines 1184-1234, confirming no version-line element exists) and version/graveyard references
- `src/browser/controls.js` — `classifyPointerGesture` (confirms long-press is maze-viewport-scoped and explicitly unbound)
- `src/browser/engineAdapter.js` — full read of `recordBest`/`persistGrave`/`startNewRun`/`boot`/`dispatch`/`initRun` (exact call sites for the D-13 graveyard/high-score exclusion gate)
- `docs/PARLEY-REBALANCE.md` — ledger format precedent + the exact `d6 × 100 × depth` Humans wilmst bonus formula/deferral note
- `content/BESTIARY-REBALANCE.md` — deferred-to-Phase-21 canon-mode items (Sterling `halfDmg` TTK, Djinni/Stalka Beast pre-ability discount)
- `.planning/phases/19-.../19-RESEARCH.md`, `.planning/phases/20-parley-balance-language-system/20-RESEARCH.md` — format/section precedent (Validation Architecture, Security Domain, Sources structure)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` — requirement text, engine gate, phase sequencing
- `.planning/config.json` — confirms `nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1`, and every external search provider (`exa_search`/`brave_search`/`firecrawl`/`tavily_search`/`ref_search`/`perplexity`/`jina`) disabled

### Verified via tool execution this session
- `npm test` — full suite, **912/912 passing**, ~20.6s, the current baseline this phase must not regress
- `grep`/direct file reads confirming: no `hire` action type in `engine/actions.js`; no version-line element in `mazeworld.html`'s Settings sheet; no `score`/`highScore` string anywhere except the existing "best depth" (`BEST_KEY`/`recordBest`) feature; `rollBlade`'s unused `depth` parameter

### Secondary/Tertiary
None — this phase required no external documentation or web research, consistent with `.planning/config.json` having every external search provider disabled and the phase touching zero new libraries.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, unchanged Node/`node:test` baseline confirmed by a live `npm test` run
- Architecture (curve extension, startCombat/foeAbilities wiring, newRun signature): HIGH for what exists today (every claim traces to a direct file:line read); MEDIUM for the exact scaling-formula shape (softCap rounding issue, foeCap draw-shape ceiling) since these are genuine implementation-design findings the planner must act on, not settled facts
- Bot/tooling upgrade: HIGH for current behavior; MEDIUM for runtime-budget estimates (no live timing of the UPGRADED bot was possible this session — only the pre-upgrade `18-06` precedent (~5-6 min/200 seeds, dumb bot) is measured)
- Economy/party constants inventory: HIGH for what exists (LOOT_DIVISOR, purse table, wilmst cache, parley bonus all confirmed by file:line); the "hire cost" and "store price scaling by depth" items are flagged LOW/absent — see Assumptions Log A1/A2
- Dev toggle UI wiring: MEDIUM — the engine-side wiring (newRun/state.dev/saveState/comparables) is HIGH confidence; the UI-side wiring (version line, long-press gesture) is a from-scratch addition with no existing element to anchor to, so its exact shape is genuinely Claude's Discretion per CONTEXT.md, not a research-settled fact

**Research date:** 2026-09-14
**Valid until:** This is a terminal, milestone-closing phase with no planned follow-up retune ("Per-milestone difficulty retunes" is explicitly out of scope per REQUIREMENTS.md) — treat this research as valid through the end of this phase's execution; no freshness window applies beyond that.
