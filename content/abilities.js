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
//
// Quick 260927-opf (user ruling 2026-09-27: "Skills that can essentially one
// shot should be once per combat"): the strike abilities one use of which
// can plausibly kill a same-depth foe at full HP — Kata, Death Touch, Overhead
// Blow (borderline, flagged to the user), Silent Step and Feint, beside Last
// Stand (already once a fight) — are `cd: "fight"`, and their text says so.
// Pommel Strike keeps its cooldown (Phase 90, ABIL-07: it is now a real strike that also stuns on a hit, still cd 4).
//
// Phase 91.1 plan 02 (user rulings V1 to V5, 2026-10-01, docs/VALUE-LEDGER.md):
// the 2026-09-27 once-per-fight list was asked again and part of it came back.
// Kata, Feint, Overhead Blow and Last Stand are ready again 4 rounds after the
// use (`cd: 4`), Second Wind after 5, Hamstring and Mark after 3 (and only on a
// foe that does not already carry the effect: engine/abilities.js#
// abilityTargetShortfall), and Smoke 6 rounds after the use: Smoke is a
// duration ability (effect first, three ticks, then its cooldown), so its
// `cd: 3` after those three ticks is the ruled six. Death Touch, Silent Step
// and Cutpurse stay `cd: "fight"`. engine/abilities.js#abilityReadyAfter is the
// ONE read of "ready again N rounds after the use" that the text guard checks.
//
// Phase 91.1 plan 02 part B (user rulings V8 to V14, 2026-10-01): Brace halves the
// next two blows that land and Taunt lasts two rounds (this one and the next);
// Poisoned Edge ticks d4 + the user's level a round for three rounds; Mark adds
// the marker's level per strike instead of +2; Cutpurse is a normal strike that
// also lifts d10 × level gold when it lands (still once per fight). The numbers
// live in engine/abilities.js (BRACE_BLOWS, DURATION_ROUNDS.taunt, POISON_ROUNDS,
// markBonus, cutpurseGold) and the text guard reads them there.
//
// Quick 260928-nrf (user rulings 2026-09-28, after the 260928-abl audit):
// Kata and Feint roll to hit with three more winning faces instead of never
// missing (engine/abilities.js#KATA_FEINT_NEED_SHIFT), and Sweep needs two or
// more living foes (engine/abilities.js#SWEEP_MIN_FOES). Their text says so;
// no text may promise a Kata or Feint cannot miss.

export const ABILITIES = [
  { id: "kata", name: "Kata", cls: "Fighter", source: "table", skillKey: "Kata", cd: 4, target: "foe", tag: "damage", txt: "one perfect form: +3 to hit on this strike, and it adds your level in damage; ready again 4 rounds after you use it" },
  { id: "deathTouch", name: "Death Touch", cls: "Fighter", source: "table", skillKey: "Death Touch", cd: "fight", target: "foe", tag: "damage", txt: "call it: one swing, rolled as normal; if it lands it doubles and finishes anything under 15 hp; once per fight" },
  { id: "sidestep", name: "Sidestep", cls: "Fighter", source: "table", skillKey: "Sidestep", cd: 4, target: "self", tag: "defensive", txt: "two rounds of not being where the blade is: foes −2 to hit you" },
  { id: "pommelStrike", name: "Pommel Strike", cls: "Fighter", source: "table", skillKey: "Pommel Strike", cd: 4, target: "foe", tag: "opener", txt: "the blunt end, to the temple: a normal strike, and a hit also costs the target its next turn" },
  { id: "battleRoar", name: "Battle Roar", cls: "Fighter", source: "table", skillKey: "Battle Roar", cd: 5, target: "self", tag: "opener", txt: "loud enough to matter: for two rounds foes −2 to hit anyone on your side" },
  { id: "secondWind", name: "Second Wind", cls: "Fighter", source: "table", skillKey: "Second Wind", cd: 5, target: "self", tag: "defensive", txt: "remember why you came: heal d8 + level; ready again 5 rounds after you use it" },
  { id: "sweep", name: "Sweep", cls: "Fighter", source: "table", skillKey: "Sweep", cd: 4, target: "foes", tag: "damage", txt: "one wide arc: every living foe takes half damage; needs two or more foes" },
  { id: "brace", name: "Brace", cls: "Fighter", source: "pool", cd: 3, target: "self", tag: "defensive", txt: "halve the next two blows that land on you" },
  { id: "riposte", name: "Riposte", cls: "Fighter", source: "pool", cd: 4, target: "self", tag: "defensive", txt: "for one round every foe that misses you eats your weapon damage" },
  { id: "taunt", name: "Taunt", cls: "Fighter", source: "pool", cd: 4, target: "self", tag: "defensive", txt: "every foe swings at you this round and the next, and your armour soaks double both times" },
  { id: "overheadBlow", name: "Overhead Blow", cls: "Fighter", source: "pool", cd: 4, target: "foe", tag: "damage", txt: "everything into one swing: double damage, but −2 to hit; ready again 4 rounds after you use it" },
  { id: "lastStand", name: "Last Stand", cls: "Fighter", source: "pool", cd: 4, target: "foe", tag: "damage", txt: "under a quarter hp: three attacks this round; ready again 4 rounds after you use it" },
  { id: "silentStep", name: "Silent Step", cls: "Thief", source: "table", skillKey: "Silent Step", cd: "fight", target: "foe", tag: "opener", txt: "nobody heard that: your next attack never misses and doubles its damage, any round; once per fight; heavy armour, the dark (without a light), a Guard or a Soldier keep the hit and lose the doubling" },
  { id: "feint", name: "Feint", cls: "Thief", source: "table", skillKey: "Feint", cd: 4, target: "foe", tag: "damage", txt: "look left, stab right: +3 to hit on this strike, and it adds your level in damage; ready again 4 rounds after you use it" },
  { id: "dirtyTrick", name: "Dirty Trick", cls: "Thief", source: "table", skillKey: "Dirty Trick", cd: 4, target: "foe", tag: "opener", txt: "sand, thumb, elbow: the target is blinded for two rounds, so it hits only on its best roll (20 on a d20) and never lands a critical" },
  { id: "smoke", name: "Smoke", cls: "Thief", source: "table", skillKey: "Smoke", cd: 3, target: "self", tag: "defensive", txt: "gone: for two rounds foes hit you only on their best roll (20 on a d20; 19–20 if you insulted them), and a flee during it just works; ready again 6 rounds after you use it" },
  { id: "cutpurse", name: "Cutpurse", cls: "Thief", source: "pool", cd: "fight", target: "foe", tag: "damage", txt: "a normal strike that also lifts d10 × level gold off the target when it lands; it has other problems; once per fight" },
  { id: "poisonedEdge", name: "Poisoned Edge", cls: "Thief", source: "pool", cd: 5, target: "foe", tag: "damage", txt: "the blade weeps: d4 + your level a round to the target for three rounds" },
  { id: "hamstring", name: "Hamstring", cls: "Thief", source: "pool", cd: 3, target: "foe", tag: "opener", txt: "cut the tendon: the target's blows do half damage for the rest of the fight; ready again 3 rounds after you use it, on a foe that is not already hamstrung" },
  { id: "mark", name: "Mark", cls: "Thief", source: "pool", cd: 3, target: "foe", tag: "opener", txt: "study it: every strike on the target adds your level in damage for the rest of the fight; ready again 3 rounds after you use it, on a foe that is not already marked" },
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
