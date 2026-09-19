# Phase 38: Melee Active Abilities - Research

**Researched:** 2026-09-17
**Domain:** Deterministic character-progression/combat-action engine extension (rolled ability pools, round-based cooldowns, passive-to-active skill conversion) in a shipped, parity-gated JS roguelike
**Confidence:** HIGH — every claim below is a direct code read (file:line) or a live measurement (`node` script run against the current engine); no web lookups were needed or used this pass (all `*_search` config flags are `false` and this is pure codebase archaeology).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**MILESTONE-WIDE RULING (user, 2026-09-17, during this discuss): greenfield — no legacy behaviour**
- The app is greenfield. New rules are the only rules. Do NOT gate new behaviour behind lazy fields (`if (c.abilities)`) or shell-only `newRun` options; do NOT keep old passive branches alive "for fixtures".
- Where a deliberate change moves a prototype-parity fixture, declare the divergence with a before/after rationale and regenerate that fixture — only the fixtures the change actually moves, never a silent blanket regeneration. `test/parity/prototype-master.js.txt` is still never edited; new serialized fields are still carved out of the three `*Comparable()` fns (that is the comparison harness, not a hedge).
- Old saves: a tolerant load only (missing fields get rolled/defaulted deterministically); no reconcile-and-narrate ceremony.
- The tuning bot always plays the new rules (it gets abilities automatically; tactics come in Phase 42).
- Prefer a derived rng stream (`makeRng(hash(seed, purpose, …))`) for new rolls that would otherwise reorder floor generation — the cheapest way to leave unrelated fixtures alone, not a legacy hedge.
- Phase 37's `wornSlots` option / two-path `eff()` are shipped as-is; unifying them is a cleanup-milestone candidate, not rework now.

**Rolled Ability Pool (ABIL-01/03)**
- Two sources of actives per class: (a) the reshaped Special Skills table (chargen roll, unchanged mechanics — `rollSkills` still shuffles the table with the existing `vp` budget, so the draw count stays 12 Fighter / 9 Thief and no floor layout moves); (b) a per-class level pool of extra actives rolled from a derived stream `makeRng(hash(seed, "abilities", level))`: one at level 1 — guaranteed, so every fresh Fighter/Thief has at least one active even if chargen rolled only passives (SC-3) — and one more at every level-up in `checkLevel`, no repeats, until the pool is exhausted. Joiners roll theirs at `meetJoiner` from the same derived stream (keyed by the joiner's name + depth).
- Storage: `c.abilities` — an ordered array of ability ids the character has (table actives are recorded there too when rolled, so the submenu reads one list); carved out of all three comparables + local duplicates as a structural tripwire. Old saves: tolerant load rolls the missing level-pool entries from the derived stream (as many as the level earned) and lists any table actives already in `c.skills`.
- Cooldowns: rounds-based on Phase 36's `c.timers` (`ability:<id>`, `cadence: "rounds"`, 2–5 rounds; "once a fight" = a rounds record with a large `left` cleared at `endCombat`). `clearRoundTimers` at `endCombat` means every ability is READY when a fight starts.
- Action economy: using an ability is the round's action (it replaces STRIKE; foes get their turn after), via a new engine action `useAbility { key }` in `engine/abilities.js`, parallel to `magic.js#castSpell`, registered in `engine/actions.js` + `engine/engine.js`.
- Rng: the derived stream never touches `state.rngState`; ability effects that need dice (Second Wind's d8, Poisoned Edge's d4, Cutpurse's d10, the auto-hit strikes' damage dice) draw from the run's main rng inside the action like any other combat action — new actions add draws only on their own dispatch, so no existing fixture's draw sequence moves.

**Special Skills Reshape + Level Pool (ABIL-02/03)**
- Passives kept (5 per class): Fighter — Hardiness, Ambidextrous, Stealth, Runes/Signs, Cooking. Thief — Night Vision, Heft, Acute Hearing, Locks, Sewing.
- Dropped outright (both classes where present): Language, Tracking, Climbing, Leaping. Their engine reads (`skill(c, "Language")` in parley fluency, `skill(c, "Tracking")` at the encounter read, `skill(c, "Climbing")` / `"Leaping"` in the climb/leap rolls) are removed; the fixtures whose chargen rolled one of these get declared divergences + regeneration.
- Converted (passive branch deleted, active added): Fighter Death-touch → Death Touch, Fighter Agility → Sidestep, Fighter Kata → Kata, Thief Silence → Silent Step, Thief Kata → Feint.
- Fighter table (12 entries: 5 passives + 7 actives): Death Touch — call it: your next landed blow doubles, and finishes anything under 15 hp (cd 5) · Sidestep — two rounds of not being where the blade is: every foe needs two better (cd 4) · Kata — one perfect form: this strike cannot miss and adds your level in damage (cd 3) · Pommel Strike — the blunt end, to the temple: the target loses its next turn (cd 4) · Battle Roar — loud enough to matter: for two rounds every foe needs two better to hit anyone on your side (cd 5) · Second Wind — remember why you came: heal d8 + level (once a fight) · Sweep — one wide arc: every living foe takes half damage (cd 4).
- Fighter level pool (5): Brace — halve the next blow that lands on you (cd 3) · Riposte — for one round every foe that misses you eats your weapon damage (cd 4) · Taunt — every foe swings at you this round and your armour soaks double (cd 4; matters with a Joiner) · Overhead Blow — everything into one swing: double damage, but you need two better to land it (cd 3) · Last Stand — under a quarter hp: three attacks this round (once a fight).
- Thief table (9 entries: 5 passives + 4 actives): Silent Step — nobody heard that: your next attack is an automatic critical, any round (cd 4) · Feint — look left, stab right: this strike cannot miss and adds your level (cd 3) · Dirty Trick — sand, thumb, elbow: the target is blinded for two rounds (reuse `f.blind`) (cd 4) · Smoke — gone: for two rounds foes need a natural 1 to find you, and a flee during it just works (once a fight).
- Thief level pool (4): Cutpurse — lift d10 × level gold off the target mid-fight; it has other problems (once a fight) · Poisoned Edge — the blade weeps: d4 a round to the target for three rounds — the DOT mechanism Phase 40's spells will share (cd 5) · Hamstring — cut the tendon: the target's blows do half damage for the rest of the fight (once a fight) · Mark — study it: every strike on the target adds +2 for the rest of the fight (once a fight).
- Skill costs for the new table entries are set by the planner to keep each class's `vp` budget (Fighter 8 / Thief 12) yielding roughly the same number of rolled skills as today; the names/effect lines above are the canon voice (researcher/planner may tune numbers against the depth-20 yardstick, not the flavor).
- Sub-class identity: none of the kept/converted/dropped skills is a sub's good/bad (those are `c.sub` rules — Guard's "one better" is separate from Agility); the identity-contract suite is extended in this phase with a test that every Fighter/Thief sub still shows one good + one bad (SC-4). Sub-class rules are untouched.

**Legibility & Joiners (ABIL-04/05)**
- Submenu rows reuse the SPELLS row shape in `src/browser/combatMenu.js`: `{ id, label, cost: "READY" | "N ROUNDS", desc: one-line effect, enabled: true, dispatch: { type: "useAbility", key } }` — a third branch beside `isCaster` / `isBard`; the Bard keeps Sing. Rows stay tappable on cooldown: the dispatch yields a named `abilityRefused { key, reason: "cooldown", left }` fight-log line (never a silent no-op); other reasons: `unknown` (not owned), `noTarget`, `notLowEnough` (Last Stand above a quarter hp).
- Events: `abilityUsed { key, name }` plus effect events that reuse existing vocabulary where it exists (auto-hit/crit strikes flow through the normal strike events with `critBy: "ability"` / `via: key`; foe control via `f.blind` / a new one-turn `f.stunned` flag honoured in `foeTurn`; party-wide need shifts via a `c.timers` record read by `foeToHitVs`; DOT via a per-foe `f.dot = { left, dmg }` ticked in `foeTurn`); level-up → `abilityLearned { key, name, txt }` folded into the SKILL LEVEL N rail card; a fresh run's level-1 pool roll is narrated once on the first paint (rail card). Every new event type gets `EVENT_NARRATION` + toast-table + rail entries (coverage guards green); every new line passes the voice scan.
- Hero tab: abilities listed beside Special skills with their effect line and, in combat, cooldown text; skill rows for converted entries show the active form.
- Joiners (ABIL-05): Fighter/Thief party members carry `abilities` on their sheet (rolled at `meetJoiner`) and `alliesTurn`'s class policy uses a READY ability by a simple rule — an opener-type ability in round 1, a damage ability when the target is above half hp, a defensive one when the member is below half — the Phase 25.1 "fight by class" pattern; member ability cooldowns live on the member sheet's own `timers`.
- Balance: no matrix run in this phase; the bot gains abilities automatically and Phase 42 gives it a use policy before the ONE AFTER matrix (BAL-02).

### Claude's Discretion
- File layout: `content/abilities.js` (catalog: id, name, cls, source `"table" | "pool"`, cd, txt, effect descriptor) vs. extending `content/skills.js`; `engine/abilities.js` for the dispatcher and effect resolution.
- The hash function for the derived stream (a small FNV-1a over `${seed}:abilities:${level}` is fine) and whether it lives in `engine/rng.js`.
- Exact `vp` costs, cooldown lengths within the stated ranges, and DOT/stun/need-shift internals — tuned by the planner from the researcher's findings.
- Plan decomposition; sequential waves are fine.

### Deferred Ideas (OUT OF SCOPE)
- Teaching the tuning bot to use abilities and spells — Phase 42 (BAL-02 prep).
- Unifying Phase 37's `wornSlots` option / two-path `eff()` into a single path under the greenfield ruling — cleanup-milestone candidate.
- Magic User actives beyond spells — not requested.
- A merged "Sure-footed" passive for the dropped Climbing/Leaping — rejected for now (dull); Phase 39's rope/ladder tools cover the hazard answer.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ABIL-01 | Fighters and Thieves have activated combat abilities with cooldowns in rounds, shown and used from the ABILITIES submenu of the combat grid | Research Questions 4, 5, 7 — existing `combatMenu.js` seam, `engine/effects.js` timer model (already built), `useAbility` action contract design |
| ABIL-02 | A chosen subset of existing passive Special Skills becomes activated abilities; unconverted skills stay passive and every sub-class keeps one good and one bad | Research Questions 2, 3 — table reshape draw-count invariant, `c.skills`/`c.abilities` split mechanism, identity-contract test collisions (line 479-480), FREE_SKILL fix |
| ABIL-03 | A class-flavored active-ability pool is rolled (never chosen) — one at level 1 and one more at each skill level, narrated with the ability's effect | Research Question 1 — derived rng stream design, `state.seed` availability at `checkLevel`, tolerant-load reproducibility |
| ABIL-04 | Each ability's effect, cooldown and readiness are legible in the submenu ("ready"/"N rounds"), and using one on cooldown is a named refusal in the fight log | Research Questions 5, 7 — refusal ordering, cost-string rules, `isReady`/`remaining` API already built |
| ABIL-05 | Party Joiners of melee classes use their own abilities by the same class-driven policy Joiners already use to fight | Research Question 6 — `alliesTurn`/`memberStrike` integration point, `sheet.timers` storage, new per-ally tick-site gap identified |
</phase_requirements>

## Summary

Phase 38 is mechanically small (one new engine module, one new action type, a data-table reshape) but the **chargen shuffle mechanics make the blast radius far larger than a shallow reading of CONTEXT.md suggests.** `rollSkills` (`engine/character.js:143-160`) shuffles `Object.keys(table)` with the SAME rng draw count regardless of what the table contains, provided the table's **length** and **per-position cost** are preserved — so the phase's own "declare only the fixtures the change moves" discipline is achievable, but only if the planner treats table-reshape as a *positional* edit (replace a dropped entry with its active replacement in the exact same object-literal slot, same `cost`), not a free rewrite. Live measurement (this research) proves **every Fighter/Thief seed across the entire parity harness** (14 of the ~20 non-Magic-User seeds) will show a chargen-field divergence once table actives are carved out of `c.skills` into `c.abilities` — this is expected and matches the milestone-wide greenfield ruling, but the *scale* (essentially all Fighter/Thief fixtures, not a small subset) must be budgeted for up front, not discovered mid-phase.

The single most important non-obvious finding: **`content/kit.js`'s `FREE_SKILL` table** (`{ "Cat Burglar": "Climbing", "Acrobat": "Leaping", "Ninja": "Silence" }`) grants three sub-classes a guaranteed, cost-free skill by NAME, checked via `table[FREE_SKILL[c.sub]]` — a check that silently returns `undefined`/false if the named key no longer exists in the reshaped table. Two of those three names (Climbing, Leaping) are **outright dropped**, and the third (Silence) is **renamed**. If `FREE_SKILL` is not updated in lockstep, Cat Burglar/Acrobat/Ninja characters silently lose their guaranteed free skill AND — because the free grant is excluded from the shuffle pool before it runs — the shuffle pool's **length** changes for those three subs specifically, shifting the rng cursor for every draw AFTER the skill shuffle (phobia, temperament, motive, potions, cloak, grimoire, name). This would turn a scoped "skills field changed" divergence into "the entire character is a different roll" for three named sub-classes, none of which are fixture-exposed today except Cat Burglar (seeds 2, 4, 256) — but the fix (repoint `FREE_SKILL` to a still-valid key at the SAME position semantics) is cheap and mandatory regardless of fixture exposure, since it also governs any future/live Cat Burglar, Acrobat, or Ninja roll.

The ability-effect mechanics themselves are all reachable through existing hooks: `f.asleep`'s skip-a-turn pattern (`combat.js:1764-1768`) is the template for a new `f.stunned` (Pommel Strike); `f.blind`'s `need=1` foe-miss pattern (`combat.js:1824,1880`) is already exactly Dirty Trick's mechanism; `foeToHitVs`/`foeToHitBreakdown` (`derived.js:552-565,582-...`) are the twin functions a Battle Roar need-shift must extend identically in both (Phase 25's own contract); and the Thief "opening strike" branch (`combat.js:581-595`) already crits on `c.cls === "Thief"` alone as a fallback — meaning removing Silence's passive branch does **not** change whether the strike crits (a plain Thief backstab already does), only which EVENT TYPE narrates it (`silenceStrike` → `backstab`), a clean, low-risk declared divergence.

**Primary recommendation:** implement the table reshape as a strict positional/cost-preserving edit (Option A in the Table Reshape section below); implement `useAbility` for the five "this strike" abilities (Death Touch/Sidestep/Kata/Feint/Silent Step) as a single dispatch that sets a transient `C.abilityStrike` flag and immediately calls the existing `playerStrike` (not a separate flag-for-later-strike scheme) so the round economy, event narration, and draw sequence all come from code that already exists and is already pinned; fix `FREE_SKILL` in the same commit as the table reshape, before any fixture is re-measured.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ability catalog (id/name/cls/cd/txt/effect) | Content (`content/abilities.js`, new) | — | Pure data, mirrors `content/skills.js`/`content/spells.js` |
| Reshaped Special Skills tables | Content (`content/skills.js`) | — | Existing file, entries gain `active: true` marker |
| Ability dispatch/effect resolution | Engine (`engine/abilities.js`, new) | Engine `combat.js` (strike hooks), `derived.js` (need-shift reads) | Mirrors `engine/magic.js#castSpell`'s role as the non-strike action template |
| Cooldown/duration bookkeeping | Engine (`engine/effects.js`, existing, Phase 36) | — | Already built, zero changes needed — only new callers |
| Level-1/level-up pool rolls | Engine (`engine/character.js#rollCharacter`/`#checkLevel`) | Engine `engine/rng.js` (derived-stream hash) | Same module that already owns `rollSkills`/leveling |
| Joiner ability rolls + cooldowns | Engine (`engine/encounters.js#meetJoiner`, `engine/combat.js#alliesTurn`) | — | Existing Joiner lifecycle owner |
| ABILITIES submenu rows | Shell view-model (`src/browser/combatMenu.js`) | Shell (`mazeworld.html` Hero tab) | Existing SPELLS-branch seam, zero new DOM machinery |
| Narration (refusal/use/learn events) | Shell (`src/browser/eventNarration.js`, `toasts.js`, `rail.js`) | — | Existing three-table coverage-guarded system |
| Parity carve-out | Test harness (`test/parity/harness/comparables.js`) | Per-domain local `comparable()` duplicates | New fields: `c.abilities`, member `sheet.abilities`/`sheet.timers` |

## Standard Stack

No new libraries. This phase is a pure extension of the existing hand-rolled engine (`engine/*.js`, plain-JSON state, `mulberry32` rng) and content tables (`content/*.js`). No `npm install` of any kind is required or appropriate.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. No registry check, no `npm view`, no legitimacy gate needed.

## Research Question 1 — Derived RNG Stream

**Confirmed [VERIFIED: direct code read]:**

- `engine/rng.js#makeRng(seedOrState)` accepts any 32-bit-coercible integer and returns a fresh, independent generator (`mulberry32` closes over its own `a` state) — calling `makeRng(X)` a second time with a DIFFERENT seed than the one driving `state.rngState` produces a stream that shares no state with the main cursor. `engine/state.js:151-176` confirms `state.seed` (the raw integer passed to `newRun`) is stored on state permanently (`seed,` at line 175) alongside `rngState` (the *cursor*, `rng.getState()`) — so any later engine function with access to `state` (which `checkLevel(state, rng, events)`, `engine/character.js:435`, already has) can read `state.seed` to build a derived key.
- **Hash function:** no hash utility exists yet in `engine/rng.js`. A small FNV-1a over a string key (`${state.seed}:abilities:${level}`) is the standard, dependency-free choice CONTEXT.md's discretion section names — implement as `hashString(str)` in `engine/rng.js` (co-located with `makeRng`, since both are pure rng infrastructure), returning a `>>> 0`-coerced 32-bit integer suitable for `makeRng`'s seed argument. FNV-1a is: `let h = 0x811c9dc5; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0;` — 8 lines, zero imports, deterministic across platforms (pure integer arithmetic, no float/locale dependence).
- **Never touches `state.rngState`:** `makeRng(hashString(...))` constructs a wholly separate `mulberry32` closure; nothing about calling it reads or writes `rng.getState()`/`rng.setState()` on the MAIN rng object threaded through `applyAction`. The derived stream is created fresh, drawn from once (or a few times, e.g. `rng2.pick(pool)`), and discarded — it is never serialized, never round-tripped, never advanced across calls. This is the exact reason it adds zero parity risk: it is **regenerated from `(seed, purpose, level)` every time it's needed**, not persisted as a cursor.
- **Joiners keyed by name+depth:** `engine/encounters.js#meetJoiner` (465-491) has both the candidate's rolled `name` (a joiner sheet field) and `state.floor.depth` in scope at the point the Joiner is constructed. The derived key becomes `` `${name}:${depth}:abilities:${level}` `` (or a fixed `level` of 1, since a Joiner is rolled once, at `meetJoiner` time, per CONTEXT — "Joiners roll theirs at `meetJoiner` from the same derived stream"). No dependency on `state.seed` at all for Joiners — this is deliberate: a Joiner's name+depth pairing is unique enough per run (and reroll-stable, so accept/decline/retry logic never sees a different ability set for the same offered Joiner) without needing the hero's seed.
- **Tolerant load reproducing the same rolls for an old save:** because the stream is a PURE FUNCTION of `(seed, "abilities", level)` (hero) or `(name, depth, "abilities", level)` (Joiner), an old save's tolerant-load step can re-derive the EXACT same level-pool entries a fresh character would have gotten, for every level already earned, with zero persisted intermediate state — call the same roll function once per level `1..c.level` (deduping already-known ids) at load time. This is why CONTEXT.md can promise "old saves: tolerant load rolls the missing level-pool entries... deterministically" with **no reconcile-and-narrate ceremony** (per the milestone-wide ruling) — the roll is byte-reproducible, not a guess.

**Recommendation:** add `hashString` next to `makeRng` in `engine/rng.js` (both are rng infrastructure, keeping `engine/character.js`/`engine/abilities.js` free of hash-implementation detail); export it from `engine/rng.js` only (not `content/index.js` — it is not data).

## Research Question 2 — Table Reshape Mechanics (draw-count preservation)

**Confirmed [VERIFIED: direct code read + live trace]:**

`rollSkills(rng, c)` (`engine/character.js:143-160`):
```js
const pool = Object.keys(table).filter((k) => !c.skills[k]);
rng.shuffle(pool);
for (const n of pool) if (table[n].cost <= vp) { c.skills[n] = 1; vp -= table[n].cost; }
```
- `rng.shuffle(arr)` is Fisher-Yates (`engine/rng.js:66-72`): for a fixed array LENGTH, it consumes exactly `length - 1` draws, and the (index → index) swap sequence produced by those draws is **independent of the array's contents** — only the length matters for draw count, and the resulting PERMUTATION OF POSITIONS is fixed for a given length + draw sequence.
- Therefore: **`FIGHTER_SKILLS` at 12 entries and `THIEF_SKILLS` at 9 entries will draw exactly the same number of random values as today (11 and 8 respectively) as long as the object literal keeps exactly 12/9 top-level keys.** This is confirmed by counting the current tables (`content/skills.js:8-33`): Fighter has 12 keys, Thief has 9. CONTEXT.md's plan (Fighter: 5 kept + 3 converted + 4 new = 12; Thief: 5 kept + 2 converted + 2 new = 9) preserves both counts exactly.
- **Costs never draw** — confirmed: the only rng call in the whole function is the one `shuffle`. The `for` loop that follows is pure arithmetic (`table[n].cost <= vp`). This means changing a `cost` value changes WHICH skills a character ends up with (the greedy affordability walk), but NEVER changes the draw count.
- **The subtlety CONTEXT.md does not spell out:** because the greedy loop is a knapsack walk over the SHUFFLED SEQUENCE, changing the `cost` at ANY position ripples forward — every later-in-shuffled-order item's affordability depends on how much `vp` earlier items consumed. **Renaming a key while preserving its exact `cost` value at the exact same object-literal position leaves the entire knapsack outcome — the SET of skills chosen, by position — byte-identical**; the resulting object's KEYS differ only where a key was actually renamed/replaced. Changing a cost, even at ONE position, can silently alter which skills a hero of a COMPLETELY UNRELATED shuffled draw ends up with, for every seed of that class — not just seeds that touch the renamed skill.

**Recommendation (Option A — minimal-footprint reshape, RECOMMENDED):**
1. Keep `Object.keys(FIGHTER_SKILLS)`/`Object.keys(THIEF_SKILLS)` at exactly 12/9 entries, in the SAME insertion order as today for every entry that is merely being converted (rename or re-flavor) in place.
2. For "Fighter Kata → Kata" (name UNCHANGED): edit the entry's `txt`/behavior in place; zero effect on chargen (same key, same position, same cost=4).
3. For "Death-touch → Death Touch", "Agility → Sidestep" (Fighter) and "Silence → Silent Step", "Kata → Feint" (Thief): rename the KEY at the SAME array position, preserving the EXACT `cost` value the old key had (Death-touch cost 4 → Death Touch cost 4; Agility cost 5 → Sidestep cost 5; Silence cost 6 → Silent Step cost 6; Thief Kata cost 5 → Feint cost 5). Tag each with a new `active: true` marker (see the c.skills/c.abilities split below).
4. For the 4 (Fighter: Language, Tracking, Climbing, Leaping) / 2 (Thief: Climbing, Leaping) TRULY DROPPED entries: replace each, AT ITS EXACT ORIGINAL POSITION, with one of the "new" table actives (Pommel Strike/Battle Roar/Second Wind/Sweep for Fighter; Dirty Trick/Smoke for Thief), reusing the EXACT cost value the dropped entry had (Language's cost 1 → whichever new active lands there keeps cost 1; Tracking's cost 4 → cost 4; Fighter Climbing's cost 2 → cost 2; Fighter Leaping's cost 2 → cost 2; Thief Climbing's cost 3 → cost 3; Thief Leaping's cost 4 → cost 4).
5. With steps 2-4 followed literally, `rollSkills`'s OUTPUT — which POSITIONS get picked, how much `vp` remains, whether an `up`-skill fires — is **byte-identical for every seed** to before this phase; the only difference is that some `c.skills[key]` entries now carry a DIFFERENT STRING KEY (a renamed/replaced active) than before. This is what makes the fixture blast radius (Research Question 3) tractable and narrow: it is scoped to "the KEY of an entry changed" plus "a table active must move to `c.abilities`", never to "an unrelated skill was picked instead."

**`c.skills` / `c.abilities` split — the mechanism CONTEXT.md's storage decision requires but does not spell out:**
`rollSkills` itself should stay UNTOUCHED (it is unit-tested, pinned, and its job — spend `vp` across a shuffled pool — has nothing to do with where the result eventually lives). Add a new, separate post-pass (call it from `rollCharacter` right after `rollSkills(rng, c)` returns, and from the tolerant-load path for old saves):
```js
export function splitTableAbilities(c) {
  const table = skillTable(c.cls);
  if (!table) return; // Magic User: no table, nothing to split
  c.abilities = c.abilities || [];
  for (const key of Object.keys(c.skills)) {
    if (table[key] && table[key].active) {
      c.abilities.push(key);
      delete c.skills[key];
    }
  }
}
```
This is a pure, zero-draw, zero-mutation-of-`rollSkills` step — `c.vp`/`c.skills`'s SIZE-before-split are exactly what `rollSkills` already produces and are already pinned by `test/unit/chargen-rng-pin.test.js`; only the FINAL RESIDENT of each key (`c.skills` vs `c.abilities`) changes. **This is also where `FREE_SKILL`'s pre-populated grant gets correctly routed** — since the free skill is written into `c.skills` before the shuffle even runs, if `FREE_SKILL["Ninja"]` is repointed to `"Silent Step"` (recommended below), the split step above naturally moves it into `c.abilities` like any other active.

## FREE_SKILL — a required, non-obvious fix (content/kit.js:19)

**[VERIFIED: direct code read]** `export const FREE_SKILL = { "Cat Burglar": "Climbing", "Acrobat": "Leaping", "Ninja": "Silence" };` — consumed at `engine/character.js:146`:
```js
if (FREE_SKILL[c.sub] && table && table[FREE_SKILL[c.sub]]) c.skills[FREE_SKILL[c.sub]] = 1;
```
The guard `table[FREE_SKILL[c.sub]]` silently evaluates to `undefined` (falsy) the moment the named key is no longer present in the table — **no error, no warning, just a quietly-skipped grant.** This has TWO compounding effects that are easy to miss:

1. **The character loses the flavor grant entirely** (Cat Burglar no longer starts with a free skill; same for Acrobat/Ninja) — a real, if minor, identity regression not called for by any CONTEXT.md decision (none of these three grants are part of the good/bad identity-contract table — confirmed by grepping `docs/CLASS-PASS.md`'s good/bad table, lines 774-807: Cat Burglar's row is "first strike always lands / traps deal double", Acrobat's is "harder to land a blow / dagger only", Ninja's is "opener always lands / never speaks" — none mention a free skill).
2. **The rng cursor shifts for that sub specifically** — because the free-skill grant is excluded from the shuffle pool BEFORE the shuffle runs (`pool = Object.keys(table).filter((k) => !c.skills[k])`), losing the grant means the pool is ONE ENTRY LONGER than before, so `rng.shuffle(pool)` draws ONE MORE random value than it used to for that sub. Every downstream chargen draw (phobia d10, temperament d12, motive d12, potions d6/cloak d8 for a Thief, grimoire, name) shifts by one position — turning a scoped "this character's skills field is different" divergence into "this character is a completely different roll from the same seed," for **every Cat Burglar, Acrobat, and Ninja seed, fixture-exposed or not.**

**Live fixture exposure (measured):** of the 14 Fighter/Thief seeds this research traced across every parity fixture, exactly **3 are Cat Burglar** (seeds 2, 4, 256 — see the fixture table below) and **0 are Acrobat or Ninja**. So the mandatory fix's fixture-blast-radius impact is currently limited to Cat Burglar, but the fix itself is required regardless (any future/live roll of these three subs needs it), and the identity-contract SC-4 test (which likely constructs sub-forced heroes directly) will also expose it.

**Recommendation:** in the SAME commit as the table reshape, update `content/kit.js`'s `FREE_SKILL`:
- `"Ninja": "Silent Step"` — the renamed key is thematically perfect for a Ninja (a guaranteed opener ability) and requires zero further reasoning.
- `"Cat Burglar": <a still-existing key>` and `"Acrobat": <a still-existing key>` — since Climbing/Leaping are dropped with no direct single-word replacement, repoint these to any STILL-VALID key in the reshaped THIEF_SKILLS table (a kept passive, e.g. `"Night Vision"`/`"Heft"`, OR one of the new actives, e.g. `"Dirty Trick"`/`"Smoke"` — either is structurally safe; a new active is arguably more thematic for these agile subs, and the split step above will correctly route it into `c.abilities`). This is genuinely Claude's Discretion (flavor only) — the ONLY hard requirement is that `table[FREE_SKILL[sub]]` must evaluate truthy against the POST-reshape table, preserving the exact "excluded from shuffle pool, pool length unchanged" mechanic.

## Research Question 3 — Fixture Blast Radius (measured, not guessed)

Live trace via `newRun(seed).c` for every seed appearing in any parity fixture (`node` run against the current engine, this research session):

| Seed | Fixture(s) | Class/Sub/Race | Current skills | Reshape-affected? | Divergence kind |
|------|-----------|-----------------|-----------------|--------------------|------------------|
| 1 | chargen, encounters(`trap`), magic | Fighter Knight Fridgian | Climbing, Ambidextrous, Runes/Signs | Climbing dropped | Chargen-only (skills field: Climbing slot now holds its replacement active). `springTrap`'s dodge formula (`encounters.js:66`) reads only Agility/Leaping — Climbing is irrelevant there, so the `trap` scenario itself is NOT action-path affected. |
| 2 | chargen, encounters(`chest`) | Thief Cat Burglar Wilmsry | Climbing, Acute Hearing, Leaping, Night Vision | Climbing AND Leaping dropped; **FREE_SKILL collision** (Cat Burglar's free grant was Climbing) | Chargen-only for `openChest` (no skill read there) — BUT REQUIRES the `FREE_SKILL` fix (see above) or this seed's entire post-skills roll (phobia onward) diverges, not just `skills`. |
| 3 | chargen, combat(`win`), economy, encounters | Thief Pickpocket Human | Heft, Silence | Silence renamed → Silent Step | **Action-path (event-type only) in the `win` combat scenario**: the single `attack` action is the Thief's OPENING strike. `combat.js:581-595`'s branch order is `Silence → Stealth → plain-Thief-backstab`; a plain Thief with NEITHER Silence nor Stealth still crits via the `c.cls === "Thief"` fallback (`crit=true`). So removing Silence's passive branch **does not change `crit`/`dmg` for this fixture** — it only changes the emitted event from `silenceStrike` to `backstab`. Declare as an event-type divergence with `before`/`after` naming the two event types; no HP/gold/kill-count field differs. |
| 4 | chargen | Thief Cat Burglar Dwarven | Climbing, Acute Hearing, Silence | Climbing dropped + Silence renamed; **FREE_SKILL collision** (same as seed 2) | Chargen-only, requires the FREE_SKILL fix. |
| 6 | chargen | Fighter Knight Troll | Hardiness, Leaping | Leaping dropped | Chargen-only (no action script; chargen fixture has empty `actions`). |
| 13 | chargen | Fighter Woodsman Elven | Death-touch, Tracking | Death-touch renamed → Death Touch; Tracking dropped | Chargen-only. |
| 14 | combat(`lose`, 10 attacks) | Fighter Soldier Fridgian | Stealth, Cooking, Leaping | Leaping dropped (Stealth/Cooking kept, unaffected) | Chargen-field only — Leaping has no read site inside `playerStrike`/`foeTurn`; the 10-attack combat loss sequence is untouched. |
| 17 | combat(`flee`) | Thief Pilfer Fridgian | Heft, Silence | Silence renamed | Chargen-field only — the `flee` scenario is `startCombat` + `flee`, never reaching `playerStrike`'s opening-strike branch; Silence's passive never fires. |
| 32 | chargen | Fighter Samurai Wilmsry | Agility, Runes/Signs, Language | Agility renamed → Sidestep; Language dropped | Chargen-only. Language's removal also means `fluency(c)` (`derived.js:763-764`) for this hero drops from up-to-2 to up-to-1 — irrelevant here since the chargen fixture has no parley action, but flag for any FUTURE fixture using this seed in a parley scenario. |
| 38 | encounters(`faerie`, `encounterDot`) | Thief Con Artist Elven | Silence, Kata | Both renamed (Silence→Silent Step, Kata→Feint) | Chargen-field only — `encounterDot`'s resolution path does not read combat skills. |
| 127 | combat(`lose-apprentice`) | Magic User Apprentice Human | (none — no skill table) | Not affected | No impact whatsoever — Magic Users never touch `skillTable`. |
| 160 | encounters(`affliction`, `encounterDot`) | Thief Pilfer Human | Acute Hearing, Kata, Locks | Kata renamed → Feint | Chargen-field only. |
| 256 | movement | Thief Cat Burglar Human | Climbing, Night Vision, Kata, Leaping | Climbing+Leaping dropped, Kata renamed; **FREE_SKILL collision** | Chargen-field only for the movement script — confirmed by reading the fixture's own `_note` (`test/parity/fixtures/action-script.movement.json:1`): the 101-action BFS path is explicitly built to AVOID climb/gorge/trap/dot/chest/tele tiles, so neither `climbBonus`/`leapBonus` (`movement.js:44-45`) nor their fall-damage-halving reads (`movement.js:186,197`) ever fire in this script. Still requires the FREE_SKILL fix. |
| 303 | combat(`parley`) | Thief Con Artist Wilmsry | Leaping, Heft, Locks | Leaping dropped | Chargen-field only — `parley`'s fluency check does not read Leaping, and this hero has no Language skill to lose either. |
| 1119 | combat(`lose-plain`, 7 attacks) | Thief Cutthroat Human | Leaping, Sewing, Night Vision | Leaping dropped (Sewing/Night Vision kept) | Chargen-field only. |

**Summary of the measured blast radius:**
- **Every non-Magic-User seed in the parity harness (13 of 14) shows a `c.skills` content change** once table actives are carved into `c.abilities` — this is EXPECTED under the greenfield ruling and does not by itself require per-fixture investigation beyond "the skills field differs, here is why."
- **Exactly one fixture (seed 3, combat `win`) has a genuine action-path consequence**, and it is a narrow, well-understood one (an event TYPE renames, no numeric field changes) — this is the only combat/movement/encounters scenario out of 11 non-chargen, non-Magic-User scenarios where a passive's removal actually fires during the scripted actions. This should reassure the planner that the "greenfield, no legacy" ruling's fixture cost is real but bounded — one action-path divergence, not eleven.
- **Three seeds (2, 4, 256) require the `FREE_SKILL` fix as a hard prerequisite**, or their divergence widens from "skills field" to "the whole character," which is NOT what CONTEXT.md's "declare only the fixtures the change moves" principle intends.
- **A fourth risk not yet exercised by any fixture but real for future play:** `movement.js:186,197`'s `if (skill(state.c, "Climbing")) hurt = Math.ceil(hurt/2);` appears in BOTH the climb branch (186) AND the leap/gorge branch (197) — a pre-existing prototype-matched quirk (the leap branch checks "Climbing", not "Leaping") that this phase's removal of Climbing entirely will delete outright (per CONTEXT's own "Climbing... ×2" read-site list). No current fixture reaches this code path, but the planner should note it as a genuine (if currently untested) gameplay change: any live Fighter/Thief who currently has Climbing loses its fall-damage halving on BOTH climbs and leaps.

**Methodology note for the planner:** the table above was produced by running `newRun(seed)` directly against the current (pre-Phase-38) engine and reading the resulting `c.cls`/`c.sub`/`c.race`/`c.skills`, then cross-referencing each seed's specific fixture SCRIPT (not just its existence) against the exact engine read-sites named in CONTEXT.md's Existing Code Insights. This is the "measure, don't guess" discipline PITFALLS.md's Pitfall 1 demands — re-run the same trace after the actual table reshape lands, before declaring any fixture divergence final, since the EXACT replacement-active-per-slot choice (Claude's Discretion) determines which NEW key name appears in each seed's `c.skills`/`c.abilities`.

## Research Question 4 — Effect Mechanics Per Ability (existing hooks to reuse)

| Ability | Class/Source | Mechanism | Existing hook (file:line) | New state needed |
|---------|-------------|-----------|---------------------------|-------------------|
| Death Touch | Fighter table | Next strike: a natural 1 finishes a target under 15 hp, doubles otherwise | `combat.js:562-568` (`skill(c,"Death-touch")` — rename to an ability-flag read) | None — the `roll===1` check is already inside `playerStrike`'s existing loop; useAbility sets a transient `C.abilityStrike = "deathTouch"` flag then calls `playerStrike` |
| Sidestep | Fighter table | Self-buff: 2 rounds, every foe needs "two better" (a -2 need shift specifically on YOU, not party-wide) | `foeToHitVs`/`foeToHitBreakdown` (`derived.js:552-565,582-...`) already stack Agility(-1)/Guard(-1) additively | `startEffect(c, "ability:sidestep", { rounds: 2, cd: 4 })`; add a `remaining(c,"ability:sidestep")>0 ? -2 : 0` term to BOTH `foeToHitVs` and `foeToHitBreakdown` (Phase 25's twin-function contract) |
| Kata (Fighter) / Feint (Thief) | Table (both classes, same mechanic, different names) | This strike cannot miss, +level damage | Same `C.abilityStrike` pattern as Death Touch | None beyond the flag |
| Pommel Strike | Fighter level pool | Target loses its next turn | `f.asleep`'s skip-turn pattern, `combat.js:1764-1768` (`if (f.asleep>0){f.asleep--; push event; continue;}`) | New `f.stunned` boolean (single-turn, no counter needed — clear it the instant it's consumed in `foeTurn`'s per-foe loop, mirroring how `f.asleep` decrements) |
| Battle Roar | Fighter level pool | 2 rounds, every foe needs "two better" to hit ANYONE on your side (party-wide) | Same `foeToHitVs`/`foeToHitBreakdown` mechanism as Sidestep, but ALSO the member-strike need computation at `combat.js:1829-1832` (`mNeedMods`) — both read sites need the same `-2` term | `startEffect(c, "ability:battleRoar", { rounds: 2, cd: 5 })`; **do NOT reuse `C.foeToHitPenalty`/`C.weakened`** (see note below) — add an independent, additive term reading `remaining(c,"ability:battleRoar")` |
| Second Wind | Fighter level pool | Heal d8+level, once a fight | New `rollDice`/`rng.d(8)` draw inside `useAbility`; heal is plain `c.wp = Math.min(c.maxWP, c.wp+amt)` (mirrors `regen`'s heal-cap pattern) | `startCooldown(c, "ability:secondWind", { rounds: 999 })` — "once a fight" = an oversized rounds record cleared unconditionally by `endCombat`'s existing `clearRoundTimers(state.c)` call (`combat.js:1138`, ALREADY WIRED since Phase 36 — zero new engine wiring needed here) |
| Sweep | Fighter level pool | Every living foe takes half your weapon damage | `weaponDamage(c,rng)` (existing), then a loop over `liveFoes(state)` calling `damageFoe(state, f, Math.ceil(dmg/2), { kind:"physical" }, rng, events)` per foe (mirrors Earthquake's per-foe loop shape in `magic.js`, per ARCHITECTURE.md §18-04's note that `earthquake`'s per-foe `damageFoe` call captures no return value) | None — single new weapon-damage draw, no ability-specific state |
| Brace | Fighter level pool | Halve next incoming blow | A one-shot flag read at the FOE-hits-hero damage-application site (`combat.js` around the `applyFoeDamageToPlayer`-equivalent) | `startEffect(c, "ability:brace", { rounds: 2, cd: 3 })` or a rounds:1 flag consumed on the very next foe hit and cleared early (needs the planner to pick "expires after N rounds" vs "expires on first hit, whichever comes first" — flag as an Open Question below) |
| Riposte | Fighter level pool | 1 round: every foe that misses you eats your weapon damage | New counter-attack branch inside the FOE-miss event path (`strikeMissed`'s FOE-side mirror — i.e. `foeTurn`'s `if (roll > need)` miss branches, `combat.js:~1846,~1900`) | `startEffect(c, "ability:riposte", { rounds: 1, cd: 4 })`; each foe-miss-vs-hero event during that round triggers one `weaponDamage(c,rng)` counter-hit via `damageFoe` |
| Taunt | Fighter level pool | Every foe targets you this round; your armor soaks double | Combat-scoped: force `pickFoeTarget` to always resolve the hero (not a member) for 1 round; double the `armorSoak(c)` read at the hero-hit site (`combat.js:~1633`) | `startEffect(c, "ability:taunt", { rounds: 1, cd: 4 })`; `pickFoeTarget` needs a `state.combat.taunted` combat-scoped read (separate from the timers record, since `pickFoeTarget` is state/combat-scoped, not character-scoped) OR read `remaining(c,"ability:taunt")>0` directly since it already takes `state` |
| Last Stand | Fighter level pool | 3 attacks this round, once a fight, only under 25% hp | `DEATH_PANIC_THRESHOLD`-style gate (`derived.js:23`, reuse the SAME 0.25 threshold constant) for the `notLowEnough` refusal; the 3-attack economy reuses `playerStrike`'s existing `attacks` variable (`combat.js:488-503`, already supports `attacks=2` for Barbarian/Ambidextrous/haste — extend the same `Math.max` chain to 3 via the transient flag) | `startCooldown(c, "ability:lastStand", { rounds: 999 })` (once-a-fight, cleared at `endCombat`) |
| Silent Step | Thief table | Next attack is an automatic critical, ANY round (no "opening only" restriction) | Same `C.abilityStrike` flag pattern, but note this is BROADER than the existing opening-strike-only Silence branch — it applies even on a non-opening strike | None beyond the flag |
| Dirty Trick | Thief level pool | Target blinded 2 rounds | `f.blind` — ALREADY EXISTS and is ALREADY read at both hero-hit (`derived.js`'s `foeToHitVs`/breakdown, via `inDark && skill(...)`) and foe-turn sites (`combat.js:1824,1880`, sets `need=1` for a blind foe attacking) | Set `f.blind = 2` (or reuse whatever counter shape existing gas-blind uses, if one exists — grep `f.blind` assignment sites before deciding int-vs-bool) directly on the target foe object; decrement in `foeTurn`'s per-foe loop mirroring `f.asleep--` |
| Smoke | Thief level pool | 2 rounds: foes need a natural 1 to find you; a flee during it always works, once a fight | `foeToHitVs`-style need floor (foes need `roll<=1`, i.e. `need=1` from the FOE's perspective attacking the hero) — reuses the SAME mechanism as `f.blind`'s `need=1` pattern but applied unconditionally to the HERO's defense rather than a per-foe flag; flee's success gate (`combat.js:~801-842`) needs a bypass read | `startCooldown(c, "ability:smoke", { rounds: 999 })` combined with a `startEffect(c,"ability:smokeActive",{rounds:2})` OR fold both into one `phase:"effect"→"cooldown"` record with `cd` set to a large number (matches the built-in duration→cooldown transition `effects.js` already supports) |
| Cutpurse | Thief level pool | Steal d10×level gold, once a fight | New `rng.d(10)` draw inside `useAbility`; `t.gold` read/write if foes carry gold, else a flat gold-add to `c.gold` (check `content/bestiary.js` for a foe gold field before assuming one exists) | `startCooldown(c, "ability:cutpurse", { rounds: 999 })` |
| Poisoned Edge | Thief level pool | d4/round DOT, 3 rounds | New per-foe `f.dot = { left: 3, dmg: {n:1,sides:4,bonus:0} }`, ticked in `foeTurn`'s per-foe loop (mirrors the EXISTING `f.acid` tick pattern at `combat.js:1749-1762` almost verbatim — acid is the direct precedent for a foe-side DOT, not a new invention) | `startCooldown(c, "ability:poisonedEdge", { rounds: 5 })` on the CASTER; `f.dot` lives on the FOE, not the caster — this is Phase 40's shared DOT mechanism per CONTEXT, so name it generically (`f.dot`) rather than ability-specifically |
| Hamstring | Thief level pool | Target's blows do half damage, rest of fight | A persistent per-foe flag (`f.hamstrung = true`) read wherever `foeTurn` computes `mDmg`/`dmg` for that foe's own attacks (`combat.js:~1856,~1902` — the `if (C.weakened) dmg = Math.ceil(dmg/2)` sites are the exact pattern, but PER-FOE not combat-wide) | `startCooldown(c, "ability:hamstring", { rounds: 999 })` on the caster; `f.hamstrung` on the target, cleared naturally when the foe dies (never explicitly cleared otherwise) |
| Mark | Thief level pool | +2 damage vs target, rest of fight | A persistent per-foe flag (`f.marked = true`) read at the hero's OWN damage-dealing sites (`playerStrike`'s `dmg` computation) when `t === marked foe` | `startCooldown(c, "ability:mark", { rounds: 999 })` on the caster; `f.marked` on the target |

**Where each draws its dice:** every table above uses the MAIN `rng` parameter already threaded into `useAbility(state, key, rng, events)` — matching CONTEXT's explicit rule ("ability *effects* that need dice... draw from the run's main rng inside the action like any other combat action"). None of the strike-modifying abilities (Death Touch/Sidestep/Kata/Feint/Silent Step/Overhead Blow) draw NEW dice beyond what `playerStrike` already draws for a normal strike — they only change how the EXISTING roll is interpreted (auto-hit, bonus damage, guaranteed crit).

**Important caution — do NOT reuse `C.foeToHitPenalty`/`C.weakened`:** `engine/combat.js:1421-1422` (inside `resolveFoeAbility`, per `foeAbilities.js`'s own header comment referencing them) already sets these two combat-scoped fields as part of an EXISTING foe-cast "Weaken"-style ability that reduces the FOE's own future to-hit/damage against the party. Battle Roar's need-shift MUST be its own independent, additive term (reading a `c.timers` record, per CONTEXT's own explicit instruction) rather than writing into these pre-existing fields — colliding with them risks silently overwriting or double-stacking an unrelated foe ability's debuff. This is a genuinely non-obvious collision risk worth flagging to the planner explicitly.

## Research Question 5 — `useAbility` Action Contract

**Recommended signature:** `useAbility(state, key, rng, events = [], now = Date.now)` — positional args matching `castSpell(state, idx, rng, events, now)`'s exact shape (`engine/magic.js:48`), for consistency with the one other non-strike player action.

**Refusal ordering (mirrors `castSpell`'s own ordering exactly, CMB-01 discipline):**
1. `refuseIfPending(state, events, "abilityRefused", { key })` — FIRST, before anything else (the universal Fight!-gate check every player combat action already applies).
2. `unknown` — `key` not present in `c.abilities` (the character never rolled/learned this ability). Mirrors `spellNotKnown`.
3. `cooldown` — `!isReady(c, \`ability:${key}\`)`; refusal event carries `{ key, reason: "cooldown", left: remaining(c, \`ability:${key}\`) }` per CONTEXT's exact shape.
4. `notLowEnough` — ability-specific gate (Last Stand's 25% hp threshold) checked AFTER cooldown (an on-cooldown Last Stand should say "cooldown", not "you're not hurt enough," matching the general principle that the CHEAPEST/most-structural refusal wins first — mirrors `castSpell`'s own ordering where `noChargesLeft` precedes the more specific `spellNotKnown`/`spellAboveLevel` distinctions).
5. `noTarget` — for any ability requiring a live foe, mirror `castSpell`'s pattern EXACTLY: `if (C) normalizeTarget(C);` (already exported per Phase 36's TGT-01 work, `combat.js`) BEFORE resolving the target, so `noTarget` is structurally unreachable in combat (the same reasoning `magic.js:89-96`'s comment already documents for spells) — every table/pool ability that needs a foe should call `normalizeTarget` first, exactly like `castSpell` does.

**Event shapes:**
- `abilityUsed { key, name }` — the generic "you used it" event (CONTEXT's exact naming), pushed once per successful use, BEFORE the effect-specific events (mirrors `castSpell`'s `c.spellsUsed++` placement, which happens before any kind-specific branch).
- Strike-modifying abilities: no separate "ability landed" event — the existing `strikeHit`/`critBy`/`struck` events already carry everything; add `via: key` (or reuse `critBy: "ability"` per CONTEXT) as an ADDITIVE field, never a new event type, so the fight log's existing strike narration handles it for free.
- Foe-control abilities (Pommel Strike/Dirty Trick): a NEW, distinct event per ability is warranted here since these are novel mechanics (`pommelStruck { target }`, `dirtyTrickLanded { target }`) — each needs its own `EVENT_NARRATION`/toast-table entry.
- Party-wide abilities (Battle Roar/Taunt/Smoke): one event per activation (`battleRoarRaised`, `tauntCalled`, `smokeThrown`), no per-foe events needed since the effect is a passive shift read elsewhere.

**Composing with `playerStrike` — the recommended design (RESOLVES CONTEXT's open question):**

CONTEXT.md explicitly asks the planner to choose between "a one-shot flag consumed by the NEXT strike" vs. "performing the strike themselves," and to recommend the option with the fewest new draws and cleanest narration. Given the phase's OWN action-economy rule ("using an ability is the round's action... foes get their turn after"), a design where the ability tap sets a flag for a LATER, separate STRIKE tap would spend the ability's round doing NOTHING visible, then require a second player action next round to actually land the blow — with a full foe turn in between that could kill the hero before the buffed strike ever lands. This contradicts "this strike" language in every one of CONTEXT's own ability descriptions (Kata: "this strike cannot miss"; Death Touch: "your next landed blow" — note Death Touch specifically says "next landed blow," suggesting it MAY be intended as a persistent flag rather than an immediate strike; re-confirm this specific wording with the user/CONTEXT before implementation if it matters for feel).

**Recommendation: `useAbility` performs the strike itself, inline, in the SAME dispatch — do not implement a "flag for later" scheme.** Concretely:
```js
// inside useAbility's per-ability branch for a strike-modifying ability:
state.combat.abilityStrike = { autoHit: true, bonusDmg: c.level, critBy: "ability", key };
playerStrike(state, rng, events); // reuses the EXISTING draw sequence, hooks, narration, afterPlayerAction tail
delete state.combat.abilityStrike;
```
`playerStrike`'s existing per-attack loop (`combat.js:505-641`) needs exactly THREE additive reads of this transient flag (none of which are new draws):
- `const auto = (c.sub === "Cat Burglar" || c.sub === "Ninja") && !C.opened || (C.abilityStrike && C.abilityStrike.autoHit);` (line 526's existing `auto` computation, OR'd)
- `dmg += C.abilityStrike?.bonusDmg || 0;` (added once, after `weaponDamage` is drawn)
- `critBy = C.abilityStrike ? C.abilityStrike.critBy : critBy;` (or fold into the existing `critBy` assignment chain)

This means: **zero new draws beyond what `playerStrike` already consumes for a normal strike** (Death Touch/Kata/Feint/Sidestep/Silent Step/Overhead Blow add no `rng` calls of their own — they only reinterpret the existing roll), the round economy is correct for free (`playerStrike` already calls `afterPlayerAction` at its tail, `combat.js:641`, which runs the foe's turn — `useAbility` must NOT also call `afterPlayerAction` itself when it delegates to `playerStrike`, to avoid double-running the foe turn), and the fight log narrates a completely normal strike with one additive `via`/`critBy` tag — no new narration plumbing beyond adding the `key` field to the existing strike-event shapes.

For NON-strike abilities (Pommel Strike, Battle Roar, Second Wind, Sweep, Brace, Riposte, Taunt, Dirty Trick, Smoke, Cutpurse, Poisoned Edge, Hamstring, Mark), `useAbility` resolves the effect directly (per the table in Research Question 4) and calls `if (state.combat) afterPlayerAction(state, rng, events);` at its own tail — mirroring `castSpell`'s exact tail-call pattern (`magic.js:440`-equivalent).

## Research Question 6 — Joiner Policy (zero draws when no abilities)

`alliesTurn` (`combat.js:1259-1317`) and `memberStrike` (`combat.js:1334-1367`) are the exact integration points. The existing structure already branches on `sheet.cls === "Magic User"` (casting) vs. falling through to `memberStrike` (melee) — a THIRD branch, checked BEFORE the Magic-User cast check (so a melee Joiner's ability-use decision happens before its plain-strike fallback), fits the same `if/else if` chain:

```js
if (sheet.abilities && sheet.abilities.length) {
  const ready = firstReadyMemberAbility(sheet, ally.round /* or C.round */, view);
  if (ready) { resolveMemberAbility(state, ally, sheet, view, ready, rng, events); continue; }
}
```

- **Zero new draws when the member has no abilities:** the guard `sheet.abilities && sheet.abilities.length` is a structural, zero-draw check — exactly the FID-02 pattern already used for foe abilities (`combat.js:1790`, `if (f.abilities && f.abilities.length)`) and explicitly named as the precedent to follow. A member sheet without `abilities` (every pre-Phase-38 save, and any Magic User/Bard sheet) falls through unchanged.
- **Cooldown storage: `sheet.timers`, NOT `ally.timers`.** `ally` (the transient `C.allies` entry) is rebuilt every `startCombat` and discarded at `endCombat` (per `memberStrike`'s own header comment describing `ally.backstabUsed` as "transient COMBAT state... rebuilt by every startCombat, never synced to the persistent sheet"). Ability cooldowns must PERSIST across fights (matching item-cooldown precedent, which lives on the persistent character), so they belong on `sheet` — the object living in `state.party[i]`, synced in/out at `startCombat`/`endCombat` exactly like `sheet.wp` already is (`combat.js:1108-1109`, `endCombat`'s `state.party[ally.partyIdx].wp = ally.wp` sync-out).
- **New tick-site gap identified by this research (not covered by any existing CONTEXT.md decision):** the hero's own `c.timers` is ticked via `tickRounds(c)` at `foeTurn`'s tail (`combat.js:1918`, per the Phase 36 SUMMARY). **No equivalent per-ally tick exists.** The planner must add a loop ticking each LIVE ally's `sheet.timers` at the SAME tail site: `for (const ally of C.allies || []) { const sheet = state.party[ally.partyIdx]; if (sheet && sheet.timers) tickRounds(sheet.timers); }` — guarded so a sheet without `timers` (every current member, every fixture) is a zero-cost no-op. Similarly, `endCombat` should clear each live member's `sheet.timers` via `clearRoundTimers` (mirroring the hero's own `endCombat` clear at `combat.js:1138`) so a Joiner's abilities are READY at the start of every fight, matching SC-1's "every ability is READY when a fight starts" for the hero — the natural reading of ABIL-05 ("Joiners use their own abilities by the same class-driven policy") implies the SAME legibility guarantee should extend to them, though this is not explicitly stated in CONTEXT.md and should be confirmed as an assumption (see Assumptions Log).
- **Selection rule (per CONTEXT, verbatim):** "an opener-type ability in round 1, a damage ability when the target is above half hp, a defensive one when the member is below half" — this requires each catalog entry to carry a simple TAG (`opener`/`damage`/`defensive`) alongside its `cd`/`txt`, so `firstReadyMemberAbility` can filter by tag + round/hp condition without any new dice. Zero draws: the policy is a pure conditional selection over an already-known, already-tagged list.
- **Effect resolution reuse:** `resolveMemberAbility` should reuse the SAME per-ability effect logic as the hero's `useAbility` where possible (e.g., a member's Kata/Feint should modify `memberStrike`'s own roll/damage the same additive way `playerStrike` was extended — a `view.abilityStrike` flag passed into `memberStrike`), rather than a parallel, hand-duplicated implementation per ability. This keeps the "20 abilities × 2 (hero + member)" surface area from becoming 40 independent implementations.

## Research Question 7 — Submenu + Hero Tab

**`combatMenu.js`'s exact seam** (`src/browser/combatMenu.js:62-148`): the `isCaster`/`isBard`/`else` chain building `secondAction`/`submenus.abilities` is the ENTIRE integration point. A Fighter/Thief with `c.abilities.length > 0` needs a FOURTH branch (checked before the current `else` fallback, which becomes the true empty-fallback for a caster/Bard with literally zero abilities — should not happen for Fighter/Thief post-Phase-38 given the level-1 guarantee, but IS still reachable for a Magic User, who has no abilities system at all and correctly falls to the disabled `noAbilities` row):

```js
} else if (c.abilities && c.abilities.length) {
  secondAction = { key: "abilities", num: 2, label: COMBAT_MENU_COPY.abilities,
    sub: `${c.abilities.filter(k => isReady(c, `ability:${k}`)).length}/${c.abilities.length} READY`,
    enabled: true, accent: false, opens: "abilities" };
  const rows = c.abilities.map((key) => {
    const meta = ABILITIES[key];
    const ready = isReady(c, `ability:${key}`);
    return {
      id: `ability-${key}`,
      label: meta.name.toUpperCase(),
      cost: ready ? "READY" : `${remaining(c, `ability:${key}`)} ROUNDS`,
      desc: meta.txt,
      enabled: true, // CONTEXT: rows stay TAPPABLE on cooldown — the dispatch itself refuses
      dispatch: { type: "useAbility", key },
    };
  });
  submenus.abilities = { title: `${heroName} · ABILITIES`, rows };
}
```
- **`cost` string rule** (CONTEXT's exact vocabulary): `"READY"` when `isReady(c, id)` is true; else `` `${remaining} ROUNDS` `` regardless of whether the record is in `"effect"` or `"cooldown"` phase (the player only needs "how long until I can press this again," not which internal phase it's in). "ONCE A FIGHT · USED" is the special-case display for a once-a-fight ability currently in its (very long) cooldown phase — detect this by comparing `remaining(c,id)` against a known "once-a-fight" sentinel (e.g. `>= 900`, matching the `rounds: 999` convention) rather than a new field, OR add a `once: true` marker to the catalog entry and special-case the display string when `!isReady && meta.once`.
- **`enabled: true` even on cooldown** is DELIBERATE per CONTEXT — "rows stay tappable on cooldown: the dispatch yields a named `abilityRefused`... never a silent no-op" — this is a genuine departure from the SPELLS branch's `enabled: canCast(state, sp) && charges > 0` pattern (which DISABLES an uncastable spell row) and must not be copy-pasted from that precedent by accident.
- **Bard coexistence:** the Bard's Sing branch (`combatMenu.js:111-133`) is untouched — Bard never reaches the new `c.abilities` branch because `isBard` is checked BEFORE it in the `if/else if` chain (preserve this ordering exactly).
- **Hero tab (`mazeworld.html:3172-3188`):** the current `#s-skills` render loop iterates `Object.keys(c.skills||{})` ONLY. Add a SECOND loop directly after it (or interleaved, per CONTEXT's "abilities listed beside Special skills") iterating `c.abilities||[]`, rendering each via the `content/abilities.js` catalog's `name`/`txt`, with a cooldown suffix ONLY when `state.combat` is truthy (out of combat, abilities are always conceptually "ready" for next fight since `endCombat` clears them — showing "READY" outside combat for every entry would be redundant noise; CONTEXT's own wording — "in combat, cooldown text" — implies the cooldown display is combat-only). A converted skill (Kata/Death Touch/etc.) shown here should read differently from a passive: CONTEXT's Specifics section states "converted ones show '(active)' and their cooldown" — implement via `table[key].active` (the SAME marker driving the `c.skills`/`c.abilities` split) to decide which of the two lists (and which render style) a given key belongs to; since converted actives ALREADY live in `c.abilities` post-split, this falls out naturally — the Hero tab's abilities loop simply needs a small "(from Special Skills)" vs. "(rolled)" distinction if the UI wants to show provenance (`source: "table" | "pool"` on the catalog entry, per CONTEXT's Discretion section — this is optional flavor, not a hard requirement).

## Research Question 8 — Validation Architecture (which tests re-pin, which are new)

**Existing tests that MUST be re-pinned (not rewritten from scratch) in this phase:**
- `test/unit/chargen-rng-pin.test.js` — the draw-count pins themselves stay UNCHANGED if Option A (position/cost-preserving reshape) is followed exactly (table LENGTH unchanged → shuffle draw count unchanged). Re-run this suite FIRST, before any content edit, to reconfirm the CURRENT pins (per Pitfall 1's "measure, don't guess" discipline) — if this file starts failing after the table edit, the reshape violated the length/shuffle invariant and must be corrected, not the test.
- `test/unit/identity-contract.test.js` — TWO known collision points found by this research, both requiring explicit updates in this phase (not deferrable):
  - **Line 479-480**: `guard.c.skills = { Agility: 1 }; assert.equal(foeToHitVs(guard), foeToHitVs(control) - 2, "Agility stacks with the Guard -1")` — this test directly exercises the PASSIVE Agility mechanic being deleted. Since Agility no longer has a `skill(c,"Agility")` read site in `foeToHitVs` after this phase, this specific assertion must be REWRITTEN to instead prove Sidestep's ACTIVE need-shift stacks with Guard's -1 (`startEffect(c, "ability:sidestep", {rounds:2}); assert stacks`), preserving the SPIRIT of the original test (two independent -1/-2 sources compose additively) rather than being deleted outright.
  - **Lines 614, 874**: `state.c.skills = { Language: 1 }` — both exercise the now-deleted Language/fluency mechanic (`fluency(c)` at `derived.js:763-764` drops its `skill(c,"Language")` term entirely). These two test cases test DEAD functionality post-phase and should be removed (not rewritten — there is no active replacement for "Language" per CONTEXT, it is simply gone) OR repurposed to prove `fluency(c)` now returns AT MOST 1 (from `eff(c,"tongue")` alone) for a character with no tongue-effect item, whichever better matches the surrounding test's intent — read the full test bodies before deciding.
  - **New assertion required (SC-4):** "every Fighter/Thief sub still shows one good + one bad" after the conversion — add this as an explicit, dedicated test (not a side-effect of the existing rows) proving NONE of the good/bad table's 27 entries (`docs/CLASS-PASS.md:774-807`) reference Agility/Kata/Death-touch/Silence/Language/Tracking/Climbing/Leaping by name (this research already confirmed by direct grep that none currently do — the new test should assert this stays true going forward, a regression guard, not just a one-time check).
- `test/unit/combatMenu.test.js` — the ABILITIES branch's row shape/ordering needs new assertions mirroring the existing SPELLS-branch test patterns (row `id`/`label`/`cost`/`dispatch` shape, the Bard-branch untouched, the empty-fallback still correct for a Magic User).
- `test/unit/party-combat.test.js` — `alliesTurn`'s new ability-branch ordering (before the Magic-User cast check, per Research Question 6) and the zero-draw-when-no-abilities guard.
- Coverage guards (`test/unit/toastsCoverage.test.js`, `test/unit/formatEventsCoverage.test.js`) — MUST stay green after every new event type (`abilityUsed`, `abilityRefused`, `abilityLearned`, `pommelStruck`, `dirtyTrickLanded`, `battleRoarRaised`, `tauntCalled`, `smokeThrown`, plus any per-ability event this research's Question 4 table implies) is added to BOTH `EVENT_NARRATION` and the toast/Oracle tables — run these guards after EVERY new event type is added, not once at phase close (Pitfall 11's exact warning).
- `test/voice/safety-scan.test.js` — every new flavor line (20 ability `txt` strings, refusal lines, the level-1/level-up narration) must pass; per Pitfall 12, also budget a human tone read for the higher-visibility lines (the level-up "New trick: {name} — {txt}" card, since it fires on every level for every Fighter/Thief).

**New test files this phase should plan:**
- `test/unit/abilities.test.js` (or `engine/abilities.js`'s own co-located suite) — the `useAbility` action's refusal ordering, the strike-modifying `C.abilityStrike` flag composition with `playerStrike` (zero new draws, correct `crit`/`dmg`), and each non-strike ability's effect (Pommel Strike sets `f.stunned`, Poisoned Edge sets `f.dot`, etc.) in isolation.
- `test/unit/free-skill-collision.test.js` (or fold into `chargen-rng-pin.test.js`) — a dedicated regression test forcing a Cat Burglar/Acrobat/Ninja hero and asserting (a) the free-skill grant still lands on a VALID, still-existing key, and (b) the shuffle pool length for that sub matches the non-free-skill sub's pool length minus exactly 1 (the invariant this research identified as fragile).
- `test/unit/ability-split.test.js` — `splitTableAbilities`'s pure behavior: every `active: true` table entry ends up in `c.abilities`, every non-active entry stays in `c.skills`, `c.vp` is untouched, and running it twice is idempotent (in case a future load-path calls it defensively).
- Parity: extend `test/parity/harness/comparables.js` with a new `stripAbilitiesField` (mirroring `stripWornField`/`stripTimersField`'s exact structural-tripwire shape) applied to all three `*Comparable()` functions PLUS the three per-domain local `comparable()` duplicates (combat/magic/movement-parity.test.js) — and a corresponding carve-out for party member sheets' `abilities`/`timers` fields wherever `state.party` is compared (confirm whether `state.party` is currently INSIDE or OUTSIDE the three comparables' scope before assuming a carve-out site — `state.js`'s own comment describes `party` as a top-level sibling stripped the same way `beats` is, which may mean it needs NO carve-out at all if it's already excluded wholesale; verify this in Task 1 rather than assuming either way).

## Architecture Patterns

### System Architecture Diagram

```
Player taps ABILITIES → combatMenu.js builds rows from c.abilities + effects.js#isReady/remaining
        │
        ▼
mazeworld.html dispatches { type: "useAbility", key } through the existing applyAction() bridge
        │
        ▼
engine/engine.js "useAbility" case → engine/abilities.js#useAbility(state, key, rng, events)
        │
        ├─ refuseIfPending / unknown / cooldown / notLowEnough checks (named refusal events)
        │
        ├─ STRIKE-MODIFYING branch (Death Touch/Sidestep/Kata/Feint/Silent Step/Overhead Blow/Last Stand):
        │     set state.combat.abilityStrike flag → call engine/combat.js#playerStrike (existing,
        │     unmodified draw sequence + afterPlayerAction tail) → clear the flag
        │
        └─ NON-STRIKE branch (Pommel Strike/Battle Roar/Second Wind/Sweep/Brace/Riposte/Taunt/
              Dirty Trick/Smoke/Cutpurse/Poisoned Edge/Hamstring/Mark):
              resolve effect directly (f.stunned/f.blind/f.dot flags, c.timers records via
              engine/effects.js#startEffect/startCooldown, damageFoe/heal arithmetic)
              → own afterPlayerAction(state, rng, events) tail call

Every round: engine/combat.js#foeTurn tail → effects.js#tickRounds(c) [hero, EXISTING since Phase 36]
                                            → NEW: tickRounds(sheet.timers) per live ally
Every fight end: engine/combat.js#endCombat → effects.js#clearRoundTimers(c) [hero, EXISTING]
                                             → NEW: clearRoundTimers(sheet.timers) per live ally

Level-up: engine/character.js#checkLevel's while-loop → makeRng(hashString(`${state.seed}:abilities:${c.level}`))
              → pick one unrolled pool ability → push to c.abilities → abilityLearned event
Chargen:  engine/character.js#rollCharacter → rollSkills (UNCHANGED) → splitTableAbilities (NEW)
              → level-1 guaranteed pool roll (same derived-stream mechanism, level=1)
Joiner:   engine/encounters.js#meetJoiner → makeRng(hashString(`${name}:${depth}:abilities:1`))
              → sheet.abilities populated at recruitment time
```

### Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ability cooldown/duration tracking | A bespoke `c.abilityCooldowns` map or per-ability scalar fields | `engine/effects.js`'s existing `startEffect`/`startCooldown`/`tickRounds`/`remaining`/`isReady` (Phase 36, already built, already tested) | This is the ENTIRE reason Phase 36 landed first — building a parallel timer shape here would directly contradict the milestone's own stated purpose for that module |
| Foe "loses next turn" | A new per-foe counter/state machine | The existing `f.asleep` skip-turn pattern (`combat.js:1764-1768`) — copy its shape for `f.stunned` | Identical semantics (skip this foe's turn once), already proven correct and narrated |
| Foe "harder to hit the party" | A bespoke per-foe or per-combat miss-injection | The existing `f.blind`/`C.foeToHitPenalty` PATTERN (not the same fields — see the caution above) — a `need=1`-style floor read at the same two call sites (`combat.js:1824-1832,1880-1888`) | Two existing precedents already prove this exact mechanism works and is already narrated at both hero- and member-targeting sites |
| A foe-side damage-over-time tick | A new generic "status effect" engine | The existing `f.acid` tick pattern (`combat.js:1749-1762`) as the direct template for `f.dot` | `f.acid` already proves the exact shape (per-round `rollDice`, `damageFoe` call, `killFoe` on death, decrement, delete-at-zero) this DOT needs — and CONTEXT explicitly names it as the mechanism Phase 40's spells will later share |
| Ability catalog lookups by string key | Duplicating ability metadata inline at every call site | One `content/abilities.js` export (mirrors `content/spells.js`'s `SPELLS` array / `content/skills.js`'s tables) | Single source of truth for `name`/`txt`/`cd`/`cls`/tag, read by the engine, the submenu, and the Hero tab alike |

## Common Pitfalls

(See `.planning/research/PITFALLS.md` Pitfalls 1, 2, 5, 9, 10 — all directly applicable to this phase; the phase-specific instances found by this research are called out inline above. Restated briefly for this phase's own plan:)

### Pitfall: Table reshape silently reorders EVERY Fighter/Thief seed's chargen, not just seeds with a dropped skill
**What goes wrong:** Treating "reshape the table" as a free content rewrite (changing costs freely, reordering entries for readability) changes the shuffled knapsack outcome for every seed of that class, not just seeds touching a renamed skill.
**How to avoid:** Follow Option A (Research Question 2) literally — preserve object-literal insertion order and per-position `cost` for every entry, converting/replacing IN PLACE only.
**Warning sign:** A Fighter/Thief chargen fixture's `c.vp` or a DIFFERENT skill (one that should have been unaffected) changes after the reshape — this means a cost or position shifted.

### Pitfall: FREE_SKILL silently breaks for three sub-classes
**What goes wrong:** Covered in full above — a silently-skipped free-skill grant shifts the rng cursor for Cat Burglar/Acrobat/Ninja specifically.
**How to avoid:** Update `content/kit.js`'s `FREE_SKILL` in the SAME commit as the table reshape; add the dedicated regression test named in Research Question 8.

### Pitfall: `useAbility` double-runs the foe's turn
**What goes wrong:** If `useAbility`'s strike-modifying branch calls BOTH `playerStrike` (which already tail-calls `afterPlayerAction`) AND its own `afterPlayerAction`, foes get two turns for one player action.
**How to avoid:** The strike-modifying branch delegates ENTIRELY to `playerStrike` and does not call `afterPlayerAction` itself; only the non-strike branch does.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Joiner ability cooldowns should clear at `endCombat` (mirroring the hero's own `c.timers` clear) so a Joiner's abilities are READY at the start of every fight, matching the hero's own SC-1 guarantee | Research Question 6 | If the intent was instead for Joiner cooldowns to persist across fights (unlike the hero's), a Joiner could enter a fight with an ability still on cooldown from the previous encounter — a genuinely different design; low risk either way (both are internally consistent), but should be confirmed with the user/CONTEXT before locking the plan |
| A2 | Brace's duration model ("halve the next blow that lands on you") is a rounds-limited window (e.g. 2 rounds) rather than "persists until the first hit lands, however long that takes" | Research Question 4 | If Brace should persist indefinitely until consumed by a hit (not expire after N rounds), the `startEffect`/rounds-cadence model needs an extra "consumed-on-hit" clear call instead of relying on the tick-to-zero expiry; low implementation cost either way, but changes the cooldown-display text shown in the submenu while Brace is active |
| A3 | Cutpurse's gold steal reads/writes a per-foe gold field on the bestiary entry; if foes do not carry a `gold` field today, Cutpurse instead grants a flat `d10 × level` gold bonus with no foe-side deduction | Research Question 4 | Not verified against `content/bestiary.js` in this research pass (out of scope for the time budget) — the planner's Task 1 should grep `content/bestiary.js` for a gold/loot field on foe entries before finalizing Cutpurse's exact mechanic |
| A4 | Death Touch's CONTEXT wording ("your next landed blow doubles") is functionally equivalent to "this strike, resolved immediately" (the `useAbility`-performs-the-strike design), not a flag that survives until whatever your NEXT separately-tapped STRIKE happens to be | Research Question 5 | If the user's actual intent was a genuine "next strike, whenever it happens" buff (surviving a full foe turn), the recommended inline-call design under-delivers; this is the single largest open design fork in the whole phase and should be explicitly confirmed, not inferred, before planning |

**If this table is empty:** N/A — see above; these four items should be confirmed or explicitly accepted as the planner's own call before PLAN.md is written.

## Open Questions

1. **Does "next landed blow" (Death Touch) mean literally the NEXT strike action, however many rounds away, or "this activation resolves as a strike right now"?**
   - What we know: CONTEXT's other four strike-modifying abilities all use "this strike" language (Kata, Feint, Sidestep is a self-buff not a strike-modifier, Silent Step says "your next attack... any round" which explicitly implies IT CAN BE LATER).
   - What's unclear: Death Touch and Silent Step use "next" language that could survive across rounds, while Kata/Feint use "this strike" language implying immediate resolution — these may not all be the SAME mechanism after all.
   - Recommendation: treat Silent Step as a genuine "flag survives until your next STRIKE action, whichever round that is" (since its own text explicitly says "any round"), and Kata/Feint/Death Touch/Overhead Blow as "the ability activation IS the strike" (immediate, single-round) — i.e., THIS RESEARCH'S EARLIER RECOMMENDATION APPLIES TO KATA/FEINT/DEATH-TOUCH/OVERHEAD-BLOW ONLY; Silent Step needs the OTHER design (a `c.timers` flag with a generous `rounds` window, e.g. 4, consumed by the NEXT `playerStrike` call regardless of how it's invoked — STRIKE button or otherwise). This split reading should be explicitly confirmed with the user before planning, since it changes Silent Step's implementation shape from every other strike-modifier.

2. **Should a Joiner's ability cooldowns persist across fights or clear at `endCombat` like the hero's?**
   - What we know: CONTEXT says only "member ability cooldowns live on the member sheet's own `timers`" — silent on the clear-at-endCombat question.
   - What's unclear: whether ABIL-05's "same class-driven policy" implies the SAME legibility guarantee (always ready at fight start) the hero enjoys.
   - Recommendation: clear them (Assumption A1) for consistency and simplicity — flag for confirmation.

## Sources

### Primary (HIGH confidence — direct code reads this session)
- `content/skills.js` (FIGHTER_SKILLS/THIEF_SKILLS full tables), `content/kit.js:19` (FREE_SKILL)
- `engine/character.js:50-160` (skillTable, rollSkills), `:435-465` (checkLevel)
- `engine/rng.js` (makeRng/mulberry32 full file)
- `engine/state.js:151-231` (newRun, seed/rngState storage)
- `engine/effects.js` (full file — the timer model this phase builds on)
- `engine/derived.js:1-70,460-625,754-765` (skill/skillTier/eff, toHit/foeToHitVs/foeToHitBreakdown, memberToHit, fluency)
- `engine/combat.js:429-650,1097-1141,1259-1367,1722-1920` (refuseIfPending, playerStrike, endCombat, alliesTurn/memberStrike, foeTurn)
- `engine/movement.js:44-65,125-220` (climbBonus/leapBonus, climb/gorge/leap resolution)
- `engine/encounters.js:55-95,160-180` (springTrap, encounter-read Tracking site)
- `engine/magic.js:48-150` (castSpell as the non-strike action template)
- `engine/actions.js:1-135`, `engine/engine.js` action dispatch (castSpell/useItem/dismissJoiner cases as the useAbility wiring template)
- `engine/saveState.js:138-180` (clearFoeEffect/clearStaleTimers as the tolerant-load template)
- `src/browser/combatMenu.js:55-215` (the ABILITIES submenu seam)
- `src/browser/rail.js:149` (leveled card)
- `mazeworld.html:3160-3199` (#s-skills Hero-tab render)
- `test/unit/identity-contract.test.js:479-480,614,874` (existing tests that collide with this phase's skill removals)
- `docs/CLASS-PASS.md:774-807` (good/bad identity table — confirms none of the reshaped skills are identity-contract-tested)
- `test/parity/fixtures/*.json` + a live `newRun(seed)` trace script run this session (fixture blast-radius table)
- `.planning/phases/38-melee-active-abilities/38-CONTEXT.md` (locked decisions), `.planning/REQUIREMENTS.md` (ABIL-01..05), `.planning/ROADMAP.md` (Phase 38 section), `.planning/STATE.md` (engine gate + amendment)
- `.planning/phases/36-.../36-02-SUMMARY.md`, `36-CONTEXT.md`, `.planning/phases/37-.../37-04-SUMMARY.md` (as-built precedent this phase must match)
- `.planning/research/ARCHITECTURE.md`, `PITFALLS.md`, `FEATURES.md` (milestone-wide research, §1/§4 and Pitfalls 1/2/5/9/10 specifically)

### Secondary / Tertiary
None — no web search was performed or needed for this phase (pure internal codebase research); all `*_search` config flags are `false` for this project.

## Metadata

**Confidence breakdown:**
- RNG derived-stream mechanism: HIGH — directly proven from `makeRng`'s implementation and `state.seed`'s storage
- Table reshape draw-count invariant: HIGH — directly proven from `rng.shuffle`'s Fisher-Yates implementation and `rollSkills`'s exact loop structure
- FREE_SKILL collision: HIGH — directly proven from `content/kit.js`/`engine/character.js`'s exact guard condition
- Fixture blast radius table: HIGH for the 14 measured seeds (live-traced this session); MEDIUM for exactly which NEW active ends up at which table position (depends on the planner's own Claude's-Discretion choice, not yet made)
- Ability-mechanism-to-existing-hook mapping: HIGH for the 12 abilities with a direct, already-proven precedent (f.asleep/f.blind/f.acid/C.foeToHitPenalty-adjacent); MEDIUM for Cutpurse (foe gold field unverified) and Brace/Riposte (exact duration model is an open design question)
- useAbility/playerStrike composition design: MEDIUM — the recommended "inline call" design is well-grounded in the existing code shape and round-economy rule, but Open Question 1 (Death Touch/Silent Step's "next" wording) means the SAME design may not apply uniformly to all five strike-modifiers without user confirmation

**Research date:** 2026-09-17
**Valid until:** Stable until Phase 38 lands (this is an internal, non-external-dependency codebase study — no expiry from external API drift). Re-verify the fixture blast-radius table live after the actual table-reshape edit lands, since the exact replacement choices are not yet made.
