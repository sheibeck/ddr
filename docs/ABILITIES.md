# Abilities (Phase 38 ledger)

**Phase:** 38-melee-active-abilities
**Date:** 2026-09-17

This ledger declares Phase 38's Special Skills reshape, the 20-entry active
ability catalog, the level-pool mechanism, the FREE_SKILL same-position
rule, and the full measured divergence table the reshape's parity carve-out
depends on. Plans 02-05 append sections below (play rules, submenu,
Joiner policy) — this file is never rewritten wholesale.

## Canon change

Fighters and Thieves get activated combat abilities instead of a table full
of dull, rarely-felt passives. Under the milestone-wide greenfield ruling
("new rules are the only rules — no legacy behaviour"), the Special Skills
tables are reshaped rather than extended: **Language, Tracking, Climbing,
Leaping are dropped outright** (both classes, where present) because they
gate mechanics nobody misses (parley fluency, a redundant encounter read,
climb/leap bonuses Phase 39's rope/ladder tools will answer instead), and
**Death-touch/Agility/Kata (Fighter)** and **Kata/Silence (Thief)** are
converted from passive branches into active abilities with the exact same
names. Five passives per class survive verbatim (Fighter: Hardiness,
Ambidextrous, Stealth, Runes/Signs, Cooking; Thief: Night Vision, Heft,
Acute Hearing, Locks, Sewing) — the ones the user judged "fun over
symmetry" kept.

Every Fighter/Thief also gets a **per-class level pool** of extra actives,
rolled — never chosen — from a derived rng stream: one guaranteed at level
1 (so a fresh adventurer who rolled only passives at chargen still has at
least one active, ROADMAP SC-3) and one more at every level-up, until the
pool of 5 (Fighter) / 4 (Thief) is exhausted. Joiners roll theirs the same
way at recruitment.

## Catalog

`content/abilities.js`'s `ABILITIES` (20 entries): `cd` is rounds, or the
literal `"fight"` (once a fight — cleared at `endCombat` like every other
cooldown); `target` is `foe` / `self` / `foes`; `tag` is `opener` / `damage`
/ `defensive` (drives the Joiner's class-driven use policy, Plan 04).

| id | name | cls | source | cd | target | tag | txt |
|---|---|---|---|---|---|---|---|
| kata | Kata | Fighter | table | 3 | foe | damage | one perfect form: this strike cannot miss and adds your level in damage |
| deathTouch | Death Touch | Fighter | table | 5 | foe | damage | call it: your next landed blow doubles, and finishes anything under 15 hp |
| sidestep | Sidestep | Fighter | table | 4 | self | defensive | two rounds of not being where the blade is: every foe needs two better |
| pommelStrike | Pommel Strike | Fighter | table | 4 | foe | opener | the blunt end, to the temple: the target loses its next turn |
| battleRoar | Battle Roar | Fighter | table | 5 | self | opener | loud enough to matter: for two rounds every foe needs two better to hit anyone on your side |
| secondWind | Second Wind | Fighter | table | fight | self | defensive | remember why you came: heal d8 + level |
| sweep | Sweep | Fighter | table | 4 | foes | damage | one wide arc: every living foe takes half damage |
| brace | Brace | Fighter | pool | 3 | self | defensive | halve the next blow that lands on you |
| riposte | Riposte | Fighter | pool | 4 | self | defensive | for one round every foe that misses you eats your weapon damage |
| taunt | Taunt | Fighter | pool | 4 | self | defensive | every foe swings at you this round and your armour soaks double |
| overheadBlow | Overhead Blow | Fighter | pool | 3 | foe | damage | everything into one swing: double damage, but you need two better to land it |
| lastStand | Last Stand | Fighter | pool | fight | foe | damage | under a quarter hp: three attacks this round |
| silentStep | Silent Step | Thief | table | 4 | foe | opener | nobody heard that: your next attack is an automatic critical, any round |
| feint | Feint | Thief | table | 3 | foe | damage | look left, stab right: this strike cannot miss and adds your level |
| dirtyTrick | Dirty Trick | Thief | table | 4 | foe | opener | sand, thumb, elbow: the target is blinded for two rounds |
| smoke | Smoke | Thief | table | fight | self | defensive | gone: for two rounds foes need a natural 1 to find you, and a flee during it just works |
| cutpurse | Cutpurse | Thief | pool | fight | foe | damage | lift d10 × level gold off the target mid-fight; it has other problems |
| poisonedEdge | Poisoned Edge | Thief | pool | 5 | foe | damage | the blade weeps: d4 a round to the target for three rounds |
| hamstring | Hamstring | Thief | pool | fight | foe | opener | cut the tendon: the target's blows do half damage for the rest of the fight |
| mark | Mark | Thief | pool | fight | foe | opener | study it: every strike on the target adds +2 for the rest of the fight |

`ABILITY_POOL = { Fighter: [brace, riposte, taunt, overheadBlow, lastStand], Thief: [cutpurse, poisonedEdge, hamstring, mark] }`
(canonical roll order — the derived stream picks from the still-open
subset). `ABILITY_BY_ID` is a frozen id→entry map. `ONCE_A_FIGHT = 999`.

## Table reshape

Positional, cost-preserving reshape (RESEARCH Option A): object-literal
position 1..N, old key → new key, cost unchanged, `active` id where the
entry becomes an active.

**FIGHTER_SKILLS (12):** 1 Kata → Kata (4, active `kata`) · 2 Stealth kept
(3) · 3 Death-touch → Death Touch (4, `deathTouch`) · 4 Agility → Sidestep
(5, `sidestep`) · 5 Hardiness kept (6) · 6 Ambidextrous kept (4) · 7 Cooking
kept (3) · 8 Language → Pommel Strike (1, `pommelStrike`) · 9 Runes/Signs
kept (2) · 10 Tracking → Battle Roar (4, `battleRoar`) · 11 Climbing →
Second Wind (2, `secondWind`) · 12 Leaping → Sweep (2, `sweep`).

**THIEF_SKILLS (9):** 1 Kata → Feint (5, `feint`) · 2 Locks kept (2, up 1) ·
3 Sewing kept (4, up 2) · 4 Night Vision kept (3) · 5 Heft kept (5) · 6 Acute
Hearing kept (5) · 7 Climbing → Dirty Trick (3, `dirtyTrick`) · 8 Leaping →
Smoke (4, `smoke`) · 9 Silence → Silent Step (6, `silentStep`).

**FREE_SKILL same position rule:** Cat Burglar → "Dirty Trick" (position 7,
where Climbing was), Acrobat → "Smoke" (position 8, where Leaping was),
Ninja → "Silent Step" (position 9, where Silence was) — repointed in the
SAME commit as the table reshape. The rule: the replacement is the key at
the OLD free key's exact position, because `rollSkills` builds
`pool = Object.keys(table).filter((k) => !c.skills[k])` and Fisher-Yates
permutes INDICES — excluding a different position with the same draw count
would permute a different element set and change which skills every Cat
Burglar/Acrobat/Ninja seed rolls. "Any still-valid key is structurally
safe" is WRONG for the shuffle outcome — only the same-position key is.

`engine/character.js#splitTableAbilities(c)` moves every `c.skills` key
whose table entry has `active` into `c.abilities` (in `c.skills` key
order), deleting the key from `c.skills`. `c.vp` is untouched. Idempotent.
A no-op for a Magic User (no table).

## Level pool

- **Level-1 guarantee (SC-3):** `engine/state.js#newRun` calls
  `grantLevelAbilities(c, String(seed), 1)` directly after `rollCharacter` —
  every fresh Fighter/Thief already has at least one active even if chargen
  rolled only passives.
- **Per-level-up:** `engine/character.js#checkLevel` calls
  `rollPoolAbility(c, String(state.seed), c.level)` once per level crossed,
  pushing an `abilityLearned { key, name, txt, level }` event directly after
  each `leveled` event (folded into the same SKILL LEVEL N rail card).
- **Joiner:** `engine/encounters.js#meetJoiner` calls
  `grantLevelAbilities(joinerChar, `joiner:${name}:${depth}`, lvl)` — the
  Joiner's table actives (from its own `rollCharacter` roll) plus its
  level-pool picks, before `pendingJoiner` is stashed.
- **Derived-stream key formats:** `<seed>:abilities:<level>` (the hero),
  `joiner:<name>:<depth>:abilities:<level>` (a live Joiner roll — the key
  passed to `grantLevelAbilities` is `joiner:<name>:<depth>`, then
  `derivedRng` appends `:abilities:<level>` internally).
- **Zero main-rng draws:** every roll above uses `engine/rng.js#derivedRng`
  — a fresh `makeRng(hashString(key))` instance per call — which never
  reads or writes the run's `state.rngState`. `newRun(seed).rngState` and
  `rollCharacter`'s cursor stay pinned exactly as before this phase
  (`test/unit/chargen-rng-pin.test.js`, unchanged and green).
- **Old saves: a tolerant load only.** `engine/character.js#ensureAbilities`
  rebuilds a missing/tampered `c.abilities` deterministically
  (`migrateLegacySkills` renames/drops legacy skill keys → `splitTableAbilities`
  → `grantLevelAbilities` up to the character's current level). Wired into
  both `engine/saveState.js` load chains (`validateSave`/`rehydrate`) for
  the hero (`base = String(seed)`) and every party member
  (`base = joiner:<name>:0`). A `c.abilities` that is already an array is
  never re-derived.

## Storage

`c.abilities` — an ordered array of catalog ids, present on EVERY character
(a plain `[]` on a Magic User, assigned as a plain literal in
`rollCharacter` beside `bag`/`darkFor`, no draw). Party member sheets carry
the same field. Carved out of `movementComparable`/`combatComparable`/
`economyComparable` via `stripAbilitiesField` plus the three local
comparable() duplicates and both chargen replay sites —
`state.party`/`state.pendingJoiner` are already stripped wholesale, so
member sheets need no per-field carve-out.

## Declared divergences

20 measured records: 7 chargen seeds (1, 2, 3, 4, 6, 13, 32) in
`action-script.chargen.json`'s `divergences` map, plus 13 scenario/script
`chargenDivergence` records (combat win/lose/lose-plain/flee/parley, magic
potion, the economy script, encounters trap/chest/tablefour/faerie/
affliction, the movement script). Field: `skills` only — every other
chargen field, `c.vp`, and every seed's `rngState` stay byte-identical. See
`test/parity/FIXTURE-INVENTORY.md`'s "Phase 38" section for the full
measured before/after table (reproduced from the same live measurement
against `loadPrototypeSandbox`/`newRun`).

## Out of scope / next

- The `useAbility` action, cooldown dispatch, and effect resolution
  (Plan 03); the strike-modifying hooks in `engine/combat.js`/`derived.js`
  and the four dropped-skill engine reads (Plan 02); Joiner class-driven use
  policy (Plan 04); the combat submenu, Hero-tab list, and first-paint pool
  card (Plan 05).
- Magic User actives beyond spells (not requested this phase — spells are
  Phase 40).
- Bot use policy for abilities — Phase 42 (BAL-02 prep), before the
  consolidated AFTER matrix.
