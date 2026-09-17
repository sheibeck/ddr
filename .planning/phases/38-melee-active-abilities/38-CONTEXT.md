# Phase 38: Melee Active Abilities - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run, `defer uat to end`) — 3 grey areas; Area 2 reworked with the user ("more actives, fewer dull passives, fun over symmetry"); all accepted

<domain>
## Phase Boundary

Combat is more than pressing STRIKE for melee classes. Fighters and Thieves get activated combat abilities with round cooldowns, surfaced in the combat ABILITIES submenu; the Special Skills tables are reshaped so only the passives that are truly felt survive and dull ones become actives; a per-class level pool of extra actives is rolled (never chosen) — one guaranteed at level 1 and one more at every level-up; everything is legible ("READY" / "N ROUNDS", named refusal on cooldown); melee-class Joiners use their own abilities by the same class-driven policy they already fight with.

Requirements: ABIL-01, ABIL-02, ABIL-03, ABIL-04, ABIL-05.

Out of scope here: teaching the tuning bot *when* to use abilities (Phase 42, before the ONE consolidated AFTER matrix), Magic User abilities (spells are Phase 40), Bard's Sing (already in the ABILITIES slot — keep it), any pick-one UI (everything is rolled — the "100 %-dice-rolled" Key Decision).

</domain>

<decisions>
## Implementation Decisions

### MILESTONE-WIDE RULING (user, 2026-09-17, during this discuss): greenfield — no legacy behaviour
- The app is greenfield. **New rules are the only rules.** Do NOT gate new behaviour behind lazy fields (`if (c.abilities)`) or shell-only `newRun` options; do NOT keep old passive branches alive "for fixtures".
- Where a deliberate change moves a prototype-parity fixture, **declare the divergence with a before/after rationale and regenerate that fixture** — only the fixtures the change actually moves, never a silent blanket regeneration. `test/parity/prototype-master.js.txt` is still never edited; new serialized fields are still carved out of the three `*Comparable()` fns (that is the comparison harness, not a hedge).
- Old saves: a **tolerant load only** (missing fields get rolled/defaulted deterministically); no reconcile-and-narrate ceremony.
- The tuning bot always plays the new rules (it gets abilities automatically; tactics come in Phase 42).
- Prefer a **derived rng stream** (`makeRng(hash(seed, purpose, …))`) for new rolls that would otherwise reorder floor generation — the cheapest way to leave unrelated fixtures alone, not a legacy hedge.
- Phase 37's `wornSlots` option / two-path `eff()` are shipped as-is; unifying them is a cleanup-milestone candidate, not rework now.

### Rolled Ability Pool (ABIL-01/03)
- **Two sources of actives per class:** (a) the reshaped Special Skills table (chargen roll, unchanged mechanics — `rollSkills` still shuffles the table with the existing `vp` budget, so the draw count stays 12 Fighter / 9 Thief and no floor layout moves); (b) a per-class **level pool** of extra actives rolled from a **derived stream** `makeRng(hash(seed, "abilities", level))`: **one at level 1 — guaranteed, so every fresh Fighter/Thief has at least one active even if chargen rolled only passives (SC-3)** — and one more at every level-up in `checkLevel`, no repeats, until the pool is exhausted. Joiners roll theirs at `meetJoiner` from the same derived stream (keyed by the joiner's name + depth).
- **Storage:** `c.abilities` — an ordered array of ability ids the character has (table actives are recorded there too when rolled, so the submenu reads one list); carved out of all three comparables + local duplicates as a structural tripwire. Old saves: tolerant load rolls the missing level-pool entries from the derived stream (as many as the level earned) and lists any table actives already in `c.skills`.
- **Cooldowns:** rounds-based on Phase 36's `c.timers` (`ability:<id>`, `cadence: "rounds"`, 2–5 rounds; "once a fight" = a rounds record with a large `left` cleared at `endCombat`). `clearRoundTimers` at `endCombat` means every ability is READY when a fight starts.
- **Action economy:** using an ability is the round's action (it replaces STRIKE; foes get their turn after), via a new engine action `useAbility { key }` in `engine/abilities.js`, parallel to `magic.js#castSpell`, registered in `engine/actions.js` + `engine/engine.js`.
- **Rng:** the derived stream never touches `state.rngState`; ability *effects* that need dice (Second Wind's d8, Poisoned Edge's d4, Cutpurse's d10, the auto-hit strikes' damage dice) draw from the run's main rng inside the action like any other combat action — new actions add draws only on their own dispatch, so no existing fixture's draw sequence moves.

### Special Skills Reshape + Level Pool (ABIL-02/03) — the user's direction: more actives, only felt passives, fun over equality, on-tone
- **Passives kept (5 per class):** Fighter — Hardiness, Ambidextrous, Stealth, Runes/Signs, Cooking. Thief — Night Vision, Heft, Acute Hearing, Locks, Sewing.
- **Dropped outright (both classes where present):** Language, Tracking, Climbing, Leaping. Their engine reads (`skill(c, "Language")` in parley fluency, `skill(c, "Tracking")` at the encounter read, `skill(c, "Climbing")` / `"Leaping"` in the climb/leap rolls) are removed; the fixtures whose chargen rolled one of these get declared divergences + regeneration.
- **Converted (passive branch deleted, active added):** Fighter Death-touch → **Death Touch**, Fighter Agility → **Sidestep**, Fighter Kata → **Kata**, Thief Silence → **Silent Step**, Thief Kata → **Feint**.
- **Fighter table (12 entries: 5 passives + 7 actives):** Death Touch — call it: your next landed blow doubles, and finishes anything under 15 hp (cd 5) · Sidestep — two rounds of not being where the blade is: every foe needs two better (cd 4) · Kata — one perfect form: this strike cannot miss and adds your level in damage (cd 3) · Pommel Strike — the blunt end, to the temple: the target loses its next turn (cd 4) · Battle Roar — loud enough to matter: for two rounds every foe needs two better to hit anyone on your side (cd 5) · Second Wind — remember why you came: heal d8 + level (once a fight) · Sweep — one wide arc: every living foe takes half damage (cd 4).
- **Fighter level pool (5):** Brace — halve the next blow that lands on you (cd 3) · Riposte — for one round every foe that misses you eats your weapon damage (cd 4) · Taunt — every foe swings at you this round and your armour soaks double (cd 4; matters with a Joiner) · Overhead Blow — everything into one swing: double damage, but you need two better to land it (cd 3) · Last Stand — under a quarter hp: three attacks this round (once a fight).
- **Thief table (9 entries: 5 passives + 4 actives):** Silent Step — nobody heard that: your next attack is an automatic critical, any round (cd 4) · Feint — look left, stab right: this strike cannot miss and adds your level (cd 3) · Dirty Trick — sand, thumb, elbow: the target is blinded for two rounds (reuse `f.blind`) (cd 4) · Smoke — gone: for two rounds foes need a natural 1 to find you, and a flee during it just works (once a fight).
- **Thief level pool (4):** Cutpurse — lift d10 × level gold off the target mid-fight; it has other problems (once a fight) · Poisoned Edge — the blade weeps: d4 a round to the target for three rounds — the DOT mechanism Phase 40's spells will share (cd 5) · Hamstring — cut the tendon: the target's blows do half damage for the rest of the fight (once a fight) · Mark — study it: every strike on the target adds +2 for the rest of the fight (once a fight).
- **Skill costs** for the new table entries are set by the planner to keep each class's `vp` budget (Fighter 8 / Thief 12) yielding roughly the same number of rolled skills as today; the names/effect lines above are the canon voice (researcher/planner may tune numbers against the depth-20 yardstick, not the flavor).
- **Sub-class identity:** none of the kept/converted/dropped skills is a sub's good/bad (those are `c.sub` rules — Guard's "one better" is separate from Agility); the identity-contract suite is extended **in this phase** with a test that every Fighter/Thief sub still shows one good + one bad (SC-4). Sub-class rules are untouched.

### Legibility & Joiners (ABIL-04/05)
- **Submenu rows** reuse the SPELLS row shape in `src/browser/combatMenu.js`: `{ id, label, cost: "READY" | "N ROUNDS", desc: one-line effect, enabled: true, dispatch: { type: "useAbility", key } }` — a third branch beside `isCaster` / `isBard`; the Bard keeps Sing. Rows stay **tappable on cooldown**: the dispatch yields a named `abilityRefused { key, reason: "cooldown", left }` fight-log line (never a silent no-op); other reasons: `unknown` (not owned), `noTarget`, `notLowEnough` (Last Stand above a quarter hp).
- **Events:** `abilityUsed { key, name }` plus effect events that reuse existing vocabulary where it exists (auto-hit/crit strikes flow through the normal strike events with `critBy: "ability"` / `via: key`; foe control via `f.blind` / a new one-turn `f.stunned` flag honoured in `foeTurn`; party-wide need shifts via a `c.timers` record read by `foeToHitVs`; DOT via a per-foe `f.dot = { left, dmg }` ticked in `foeTurn`); level-up → `abilityLearned { key, name, txt }` folded into the SKILL LEVEL N rail card; a fresh run's level-1 pool roll is narrated once on the first paint (rail card). Every new event type gets `EVENT_NARRATION` + toast-table + rail entries (coverage guards green); every new line passes the voice scan.
- **Hero tab:** abilities listed beside Special skills with their effect line and, in combat, cooldown text; skill rows for converted entries show the active form.
- **Joiners (ABIL-05):** Fighter/Thief party members carry `abilities` on their sheet (rolled at `meetJoiner`) and `alliesTurn`'s class policy uses a READY ability by a simple rule — an opener-type ability in round 1, a damage ability when the target is above half hp, a defensive one when the member is below half — the Phase 25.1 "fight by class" pattern; member ability cooldowns live on the member sheet's own `timers`.
- **Balance:** no matrix run in this phase; the bot gains abilities automatically and Phase 42 gives it a use policy before the ONE AFTER matrix (BAL-02).

### Claude's Discretion
- File layout: `content/abilities.js` (catalog: id, name, cls, source `"table" | "pool"`, cd, txt, effect descriptor) vs. extending `content/skills.js`; `engine/abilities.js` for the dispatcher and effect resolution.
- The hash function for the derived stream (a small FNV-1a over `${seed}:abilities:${level}` is fine) and whether it lives in `engine/rng.js`.
- Exact `vp` costs, cooldown lengths within the stated ranges, and DOT/stun/need-shift internals — tuned by the planner from the researcher's findings.
- Plan decomposition; sequential waves are fine.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content/skills.js` FIGHTER_SKILLS / THIEF_SKILLS (12 / 9 rows, `cost`, `up`, `txt`); `engine/character.js:143` `rollSkills` (shuffle + budget; draw count = table length), `:435` `checkLevel` (level-up site — the pool roll goes here), `rollCharacter`; `engine/rng.js` `makeRng` (a second, derived instance is the pattern for the level pool).
- `engine/effects.js` (Phase 36): `startEffect/startCooldown/tickRounds/remaining/isReady/clearRoundTimers` on `c.timers` — the cooldown home; `tickRounds` already runs at `foeTurn`'s tail and `clearRoundTimers` at `endCombat`.
- `engine/magic.js#castSpell` — the action shape to mirror for `useAbility` (target resolution via `normalizeTarget`, refusal events, draws inside the action); `engine/combat.js` `playerStrike` (auto-hit / crit paths, `critBy`), `foeToHitVs`/`foeToHitBreakdown` in `derived.js:547-560` (need shifts — Agility's `-1` is here and is deleted), `foeTurn` (where `f.asleep`/`f.blind` are honoured — add `f.stunned`, `f.dot`), `alliesTurn`/`memberStrike` (`combat.js:1259-1360`, the Joiner class policy).
- Skill reads to delete/convert: `skill(c,"Agility")` (derived.js:558 + combat), `skill(c,"Death-touch")`, `skill(c,"Kata")` ×2, `skill(c,"Silence")` ×3, `skill(c,"Language")` (parley fluency, engine/derived.js `fluency`), `skill(c,"Tracking")`, `skill(c,"Climbing")`, `skill(c,"Leaping")` ×2 — grep `skill(c, "` for the full list.
- `src/browser/combatMenu.js:82-130` — the slot-2 branch (`isCaster` → SPELLS rows with `dispatch: { type: "castSpell", idx }`; `isBard` → Sing; else the disabled `noAbilities` fallback) and the submenu renderer in `mazeworld.html` that dispatches whatever `row.dispatch` supplies (zero shell changes for the submenu itself); `src/browser/rail.js:149` `leveled` SKILL LEVEL card; `mazeworld.html:3172` `#s-skills` Hero-tab list.
- Existing foe flags: `f.asleep` (gas), `f.blind`; foe-side timers precedent `f.cd`.
- Tests to extend: `test/unit/identity-contract.test.js`, `chargen-rng-pin.test.js` (the pins must stay identical — table sizes unchanged), `combatMenu.test.js`, `party-combat.test.js`, coverage + voice guards; `docs/CLASS-PASS.md` good/bad table (unchanged) and a new `docs/ABILITIES.md` ledger (catalog + declared divergences).

### Established Patterns
- Engine pure/deterministic; actions push named refusal events (FEED-02); `normalizeTarget` for target resolution; timers on `c.timers`; every new event type narrated in three tables; HP not WP; rail is the one out-of-combat feedback surface, the › fight log the in-combat one.
- Declared divergences: a before/after table per affected fixture in the phase ledger, regenerate only those fixtures, rationale recorded (Phase 31's three action-path divergences are the template).

### Integration Points
- `content/skills.js` (reshaped tables), new `content/abilities.js` + `engine/abilities.js`, `engine/character.js` (`checkLevel` pool roll, level-1 roll in `rollCharacter`/`newRun` via the derived stream, tolerant load in `saveState.js`), `engine/combat.js` (strike hooks, `foeTurn` flags, `alliesTurn` policy), `engine/derived.js` (need shifts, `fluency` Language removal), `engine/movement.js` (Tracking/Climbing/Leaping reads), `engine/encounters.js` (`meetJoiner` pool roll), `engine/actions.js` + `engine/engine.js` (`useAbility`), `test/parity/harness/comparables.js` (+3 dupes: `abilities`, member `timers`), `src/browser/combatMenu.js`, `eventNarration.js`, `toasts.js`, `rail.js`, `mazeworld.html` (Hero-tab abilities list, first-paint pool card), `docs/ABILITIES.md`.

</code_context>

<specifics>
## Specific Ideas

- The catalog's one-line effect texts above are the canon voice — deadpan, the joke on the adventurer ("It has other problems." / "Remember why you came.").
- Refusal line register: "Pommel Strike: three rounds. Your arm has opinions." — name the ability and the rounds left.
- Level-up card: the existing SKILL LEVEL N rail card gains a second line: "New trick: {name} — {txt}".
- Kept passives read exactly as today on the Hero tab; converted ones show "(active)" and their cooldown.

</specifics>

<deferred>
## Deferred Ideas

- Bot use policy for abilities and spells — Phase 42 (BAL-02 prep).
- Unifying Phase 37's `wornSlots` option / two-path `eff()` into a single path under the greenfield ruling — cleanup-milestone candidate.
- Magic User actives beyond spells — not requested.
- A merged "Sure-footed" passive for the dropped Climbing/Leaping — rejected for now (dull); Phase 39's rope/ladder tools cover the hazard answer.

</deferred>
