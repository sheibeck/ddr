// content/abilities.js
//
// Phase 38 (ABIL-01/02/03) — the 20-entry active-ability catalog: 11 "table"
// actives (the reshaped Special Skills entries that used to be dull
// passives — see content/skills.js's header) plus 9 "pool" actives (rolled
// — never chosen — from a per-class level pool: one guaranteed at level 1
// and one more per level-up, until the pool is exhausted; see
// engine/character.js's grantLevelAbilities/rollPoolAbility). Pure data —
// no closures, no functions (test/determinism/content-is-pure-data.test.js
// scans every content/ module automatically).
//
// Field meanings:
//   id        - stable identifier; the c.abilities array entry and
//               ABILITY_BY_ID's key.
//   name      - display name (Hero tab, combat submenu row, fight-log/rail
//               narration).
//   cls       - "Fighter" | "Thief" (Magic User abilities are out of scope
//               here — spells are Phase 40; Bard's Sing stays as-is).
//   source    - "table" (rolled at chargen via the Special Skills tables,
//               content/skills.js's `active` markers) or "pool" (rolled
//               from the per-class level pool below, never from a table).
//   skillKey  - present ONLY on a "table" entry: the FIGHTER_SKILLS/
//               THIEF_SKILLS key whose entry carries `active: "<this id>"`
//               and an identical `txt`.
//   cd        - cooldown in rounds (a positive integer), or the literal
//               string "fight" (once-a-fight; the Plan 03 dispatcher maps
//               this to ONCE_A_FIGHT rounds, cleared by endCombat's
//               existing clearRoundTimers, so every ability is READY when a
//               fresh fight starts).
//   target    - "foe" | "self" | "foes"; drives the Plan 03 dispatcher's
//               noTarget refusal check.
//   tag       - "opener" | "damage" | "defensive"; drives the Plan 04
//               Joiner's class-driven use policy (an opener in round 1, a
//               damage ability when the target is above half hp, a
//               defensive one when the member itself is below half).
//   txt       - the canon one-line effect text (verbatim from
//               38-CONTEXT.md's catalog; scanned by
//               test/voice/safety-scan.test.js).

export const ABILITIES = [
  { id: "kata", name: "Kata", cls: "Fighter", source: "table", skillKey: "Kata", cd: 3, target: "foe", tag: "damage", txt: "one perfect form: this strike cannot miss and adds your level in damage" },
  { id: "deathTouch", name: "Death Touch", cls: "Fighter", source: "table", skillKey: "Death Touch", cd: 5, target: "foe", tag: "damage", txt: "call it: your next landed blow doubles, and finishes anything under 15 hp" },
  { id: "sidestep", name: "Sidestep", cls: "Fighter", source: "table", skillKey: "Sidestep", cd: 4, target: "self", tag: "defensive", txt: "two rounds of not being where the blade is: every foe needs two better" },
  { id: "pommelStrike", name: "Pommel Strike", cls: "Fighter", source: "table", skillKey: "Pommel Strike", cd: 4, target: "foe", tag: "opener", txt: "the blunt end, to the temple: the target loses its next turn" },
  { id: "battleRoar", name: "Battle Roar", cls: "Fighter", source: "table", skillKey: "Battle Roar", cd: 5, target: "self", tag: "opener", txt: "loud enough to matter: for two rounds every foe needs two better to hit anyone on your side" },
  { id: "secondWind", name: "Second Wind", cls: "Fighter", source: "table", skillKey: "Second Wind", cd: "fight", target: "self", tag: "defensive", txt: "remember why you came: heal d8 + level" },
  { id: "sweep", name: "Sweep", cls: "Fighter", source: "table", skillKey: "Sweep", cd: 4, target: "foes", tag: "damage", txt: "one wide arc: every living foe takes half damage" },
  { id: "brace", name: "Brace", cls: "Fighter", source: "pool", cd: 3, target: "self", tag: "defensive", txt: "halve the next blow that lands on you" },
  { id: "riposte", name: "Riposte", cls: "Fighter", source: "pool", cd: 4, target: "self", tag: "defensive", txt: "for one round every foe that misses you eats your weapon damage" },
  { id: "taunt", name: "Taunt", cls: "Fighter", source: "pool", cd: 4, target: "self", tag: "defensive", txt: "every foe swings at you this round and your armour soaks double" },
  { id: "overheadBlow", name: "Overhead Blow", cls: "Fighter", source: "pool", cd: 3, target: "foe", tag: "damage", txt: "everything into one swing: double damage, but you need two better to land it" },
  { id: "lastStand", name: "Last Stand", cls: "Fighter", source: "pool", cd: "fight", target: "foe", tag: "damage", txt: "under a quarter hp: three attacks this round" },
  { id: "silentStep", name: "Silent Step", cls: "Thief", source: "table", skillKey: "Silent Step", cd: 4, target: "foe", tag: "opener", txt: "nobody heard that: your next attack is an automatic critical, any round" },
  { id: "feint", name: "Feint", cls: "Thief", source: "table", skillKey: "Feint", cd: 3, target: "foe", tag: "damage", txt: "look left, stab right: this strike cannot miss and adds your level" },
  { id: "dirtyTrick", name: "Dirty Trick", cls: "Thief", source: "table", skillKey: "Dirty Trick", cd: 4, target: "foe", tag: "opener", txt: "sand, thumb, elbow: the target is blinded for two rounds" },
  { id: "smoke", name: "Smoke", cls: "Thief", source: "table", skillKey: "Smoke", cd: "fight", target: "self", tag: "defensive", txt: "gone: for two rounds foes need a natural 1 to find you, and a flee during it just works" },
  { id: "cutpurse", name: "Cutpurse", cls: "Thief", source: "pool", cd: "fight", target: "foe", tag: "damage", txt: "lift d10 × level gold off the target mid-fight; it has other problems" },
  { id: "poisonedEdge", name: "Poisoned Edge", cls: "Thief", source: "pool", cd: 5, target: "foe", tag: "damage", txt: "the blade weeps: d4 a round to the target for three rounds" },
  { id: "hamstring", name: "Hamstring", cls: "Thief", source: "pool", cd: "fight", target: "foe", tag: "opener", txt: "cut the tendon: the target's blows do half damage for the rest of the fight" },
  { id: "mark", name: "Mark", cls: "Thief", source: "pool", cd: "fight", target: "foe", tag: "opener", txt: "study it: every strike on the target adds +2 for the rest of the fight" },
];

/** ABILITY_BY_ID — a frozen id -> catalog-entry lookup map. */
export const ABILITY_BY_ID = Object.freeze(Object.fromEntries(ABILITIES.map((a) => [a.id, a])));

/**
 * ABILITY_POOL — the per-class level-pool roll order (canonical order; the
 * derived stream in engine/character.js#rollPoolAbility picks from the
 * still-open subset of this array — see engine/rng.js#derivedRng).
 */
export const ABILITY_POOL = Object.freeze({
  Fighter: Object.freeze(["brace", "riposte", "taunt", "overheadBlow", "lastStand"]),
  Thief: Object.freeze(["cutpurse", "poisonedEdge", "hamstring", "mark"]),
});

/** ONCE_A_FIGHT — the rounds value a `cd: "fight"` ability maps to; large
 * enough to never tick down mid-fight, cleared by endCombat's existing
 * clearRoundTimers so the ability is READY again at the next fight. */
export const ONCE_A_FIGHT = 999;
