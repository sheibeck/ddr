# Abilities (Phase 38 ledger)

**Phase:** 38-melee-active-abilities
**Date:** 2026-09-17

> **Status (Phase 79, plan 79-12):** a design record. The `txt` column below quotes the Phase 38 catalog as it shipped then; several of those lines were rewritten roll-high in Phase 79 (Smoke, Sidestep, Battle Roar, Overhead Blow). `content/abilities.js` is the live text, and `test/unit/roll-phrasing.test.js` guards it.

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
| kata | Kata | Fighter | table | fight | foe | damage | one perfect form: your die has three more faces that land this strike, and it adds your level in damage; once per fight |
| deathTouch | Death Touch | Fighter | table | 5 | foe | damage | call it: your next landed blow doubles, and finishes anything under 15 hp |
| sidestep | Sidestep | Fighter | table | 4 | self | defensive | two rounds of not being where the blade is: every foe needs two better |
| pommelStrike | Pommel Strike | Fighter | table | 4 | foe | opener | the blunt end, to the temple: a normal strike, and a hit also costs the target its next turn |
| battleRoar | Battle Roar | Fighter | table | 5 | self | opener | loud enough to matter: for two rounds every foe needs two better to hit anyone on your side |
| secondWind | Second Wind | Fighter | table | fight | self | defensive | remember why you came: heal d8 + level |
| sweep | Sweep | Fighter | table | 4 | foes | damage | one wide arc: every living foe takes half damage; needs two or more foes |
| brace | Brace | Fighter | pool | 3 | self | defensive | halve the next blow that lands on you |
| riposte | Riposte | Fighter | pool | 4 | self | defensive | for one round every foe that misses you eats your weapon damage |
| taunt | Taunt | Fighter | pool | 4 | self | defensive | every foe swings at you this round and your armour soaks double |
| overheadBlow | Overhead Blow | Fighter | pool | 3 | foe | damage | everything into one swing: double damage, but you need two better to land it |
| lastStand | Last Stand | Fighter | pool | fight | foe | damage | under a quarter hp: three attacks this round |
| silentStep | Silent Step | Thief | table | 4 | foe | opener | nobody heard that: your next attack is an automatic critical, any round |
| feint | Feint | Thief | table | fight | foe | damage | look left, stab right: your die has three more faces that land this strike, and it adds your level in damage; once per fight |
| dirtyTrick | Dirty Trick | Thief | table | 4 | foe | opener | sand, thumb, elbow: the target is blinded for two rounds |
| smoke | Smoke | Thief | table | fight | self | defensive | gone: for two rounds foes need a natural 1 to find you (a 1–2 if you insulted them), and a flee during it just works |
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

## Retired passives (Plan 02)

Plan 01 reshaped the tables and split table actives into `c.abilities`;
Plan 02 deletes every OLD passive read the reshape retired and installs the
hooks the actives (Plan 03) will drive. Seven read sites gone, zero
replacement, plus two converted passives now resolve through a descriptor:

| Skill | Old read site (file#function) | Disposition |
|-------|-------------------------------|-------------|
| Agility | `engine/derived.js#foeToHitVs`/`#foeToHitBreakdown` | Dropped; replaced by Sidestep's `abilityEffectActive` term |
| Silence (in-dark) | `engine/derived.js#foeToHitVs`/`#foeToHitBreakdown` | Dropped; replaced by Smoke's `abilityEffectActive` term |
| Silence (opening strike) | `engine/combat.js#playerStrike` | Dropped outright — the plain Thief backstab fallback already crits an opening strike with neither Silence nor Stealth, so removing this branch changes only the emitted event (`silenceStrike` → `backstab`), never `crit`/`dmg` |
| Death-touch | `engine/combat.js#playerStrike` | Dropped; replaced by Death Touch's `finishUnder`/`forceCrit` descriptor fields |
| Kata (Fighter, `toHit`) | `engine/derived.js#toHit` | Dropped outright — Kata is now descriptor-driven (an `autoHit` until quick 260928-nrf, `needShift: +3` since), never a standing to-hit bonus |
| Kata (Fighter, `weaponDamage`) | `engine/derived.js#weaponDamage` | Dropped outright — Kata's `+level` damage is now `bonusDmg`, resolved per-strike |
| Kata (member, `memberToHit`) | `engine/derived.js#memberToHit` | Dropped outright — no member equivalent of the descriptor exists yet (Plan 04) |
| Tracking | `engine/combat.js#startCombat` | Dropped outright — `let tracked = false;` and every downstream `tracked` reader (`C.tracked`, the `trackable` event, flee's round-1 clean withdrawal) survive as dormant machinery; nothing sets it true until a future source does |
| Climbing (fall-damage halving) | `engine/movement.js` (climb branch AND the leap/gorge branch — a pre-existing prototype quirk where the leap branch also checked "Climbing") | Dropped outright, both branches |
| Climbing/Leaping (roll bonus) | `engine/movement.js` (`climbBonus`/`leapBonus`) | Dropped outright — no replacement; Phase 39's rope/ladder tools are the hazard answer |
| Agility/Leaping (trap dodge) | `engine/encounters.js#springTrap` | Dropped outright — only the Acrobat sub bonus (`+3`) remains in `nimble` |
| Language | `engine/derived.js#fluency` (parley fluency gate/bonus) | Dropped outright — see "Fluency ceiling" below |

### The `state.combat.abilityStrike` descriptor

`playerStrike` reads a transient, zero-persisted descriptor Plan 03's
`useAbility` sets immediately before delegating to it, and clears again
right after its own attack loop (never visible to `afterPlayerAction` or
any later dispatch):

```
{ key, autoHit?: true, forceCrit?: true, finishUnder?: number,
  bonusDmg?: number, dmgMul?: number, needShift?: number, attacks?: number }
```

- `attacks` raises the swing count via `Math.max` (never stacks additively
  with a Fridgian's frenzy or Ambidextrous/haste).
- `needShift` moves the strike's own need by that many faces (floored at 1,
  and since quick 260928-nrf a positive shift is capped at the die; it never
  revives a `magicOnly`/untouchable need-0 foe, for the hero or a Joiner),
  narrated as a needMods entry alongside any Afraid penalty: `{ name:
  "overhead", delta }` for Overhead Blow (−2), `{ name: "Kata" | "Feint",
  delta }` for Kata and Feint (+3).
- `autoHit` never touches `C.opened` — the Cat Burglar/Ninja free opener
  (`subAuto`) is a structurally separate flag from an ability's own auto-hit.
- `forceCrit` obeys the Guard/Soldier/dark rule (the noCrit-gear clause was
  retired by quick 260928-cos) exactly like a
  natural 1 (a Guard's Death Touch still finishes under 15 via `finishUnder`,
  it just never doubles); Silent Step's forced crit is additionally denied by
  heavy armour on a Thief, exactly like the old Silence branch, pushing
  `backstabDenied` only once per attack even when the opening-strike heavy
  check already fired it.
- `finishUnder` (Death Touch) ignores `noCrit` entirely — the finish always
  fires under the threshold, on any sub.
- `bonusDmg`/`dmgMul` stack additively/multiplicatively after `weaponDamage`
  and the natural crit doubling, in that order; `t.marked` (Mark, a Thief
  level-pool active) adds a flat +2 AFTER both, for every landed hero strike
  regardless of any descriptor.
- Every read above is additive and zero-draw — it only reinterprets the roll
  `playerStrike` already makes for an ordinary STRIKE.

### Need-shift actives (`foeToHitVs`/`foeToHitBreakdown`)

`abilityEffectActive(c, key)` reads a live `c.timers["ability:"+key]` record
in `phase: "effect"` with `left > 0` (a cooldown-phase record reads false).
Three terms, read in this order, after the existing gear term and before the
mirror/invis/floor overrides: Battle Roar (-2, any `vs`), Sidestep (-2,
`vs === "hero"` only), Smoke (override to `h = 1`, `vs === "hero"` only).
`vs = "member"` is the new second parameter `foeTurn`'s party-member branch
passes so Battle Roar still shields the whole side while Sidestep/Smoke stay
the hero's own body. Battle Roar's -2 stacks additively with the Guard -1,
exactly the way Agility used to.

### Fluency ceiling: 2 → 1 (gameplay change, flagged)

`fluency(c)` now reads `eff(c, "tongue")` alone — a tongue-effect item (the
Helm of Knowledge). The "both skill and item" fluency-2 tier is
**structurally unreachable** until a future fluency source exists; canParley's
`flu >= 2` Magical branch is therefore dead in practice, and the Wilmsry-vs-
Magical `parleyRefused` branch inside `parley()` (which sits BEHIND
`canParley`) is now unreachable too. Both are left in place (data-driven
thresholds, not dead reads) rather than deleted — this is Claude's Discretion
per the plan, not a requested removal. `mazeworld.html`'s classic
canParley()/fluency() duplicate is UNCHANGED (out of this plan's scope,
prohibited by name) — harmless in real play since chargen can no longer
grant the retired skill on either script.

### Climbing/leaping (gameplay change, flagged)

Every character, regardless of skill, now rolls the climb/leap check with no
bonus and takes full fall damage on a failure — the halving is gone for
everyone, not just non-Climbing characters. No current fixture reaches this
code path (movement fixture's own `_note` documents its 101-action path as
deliberately climb/gorge-avoiding).

## Play rules (Plan 03)

`engine/abilities.js#useAbility(state, key, rng, events)` — the ABILITIES
submenu's action, parallel to `engine/magic.js#castSpell`.

### The ladder

Each refusal is a single `abilityRefused` event and nothing else — no draw,
no timer, `combat.round` unchanged:

1. **`notFought`** (`refuseIfPending`, first) — the encounter is a preview,
   Fight! not yet pressed.
2. **`unknown`** — `key` is not in the catalog, or the character never
   rolled/learned it (`c.abilities` doesn't include it).
3. **`notInCombat`** — no active encounter.
4. **`cooldown { left, name }`** — `!isReady(c, "ability:"+key)`; `left` is
   `abilityRoundsLeft`.
5. **`noTarget`** — a `foe`/`foes`-target ability with nothing to aim at.
   Structurally unreachable in real play, same reasoning `castSpell`'s own
   comment documents: `normalizeTarget` always finds a live foe while
   `state.combat` exists (an empty encounter has already cleared) — only a
   hand-built zero-foe combat reaches this branch.
6. **`notLowEnough { have, max }`** — Last Stand's own gate: `c.wp > c.maxWP
   * DEATH_PANIC_THRESHOLD` (0.25) refuses.

Canon refusal register: `"<Name>: N round(s). Your arm has opinions."` for
`cooldown` (singular "round" at exactly 1); every other reason names the
ability without a rounds figure.

### The cooldown model

`engine/effects.js`'s Phase 36 `c.timers`, id `ability:<key>`:

- **Immediate kind** (everything except sidestep/battleRoar/riposte/taunt/
  smoke): `startCooldown(c, id, { rounds: cd })`, or `{ rounds:
  ONCE_A_FIGHT }` when `cd === "fight"` (Second Wind, Last Stand, Cutpurse,
  Hamstring, Mark).
- **Duration kind** (sidestep 2/4, battleRoar 2/5, riposte 1/4, taunt 1/4):
  `startEffect(c, id, { rounds: N, cd })` — flips from `"effect"` phase to
  its own `cd`-round `"cooldown"` phase the instant the duration ticks to 0
  (`effects.js`'s own transition, no bespoke bookkeeping). Smoke is a
  duration kind with `cd: "fight"` — `startEffect(c, id, { rounds: 2, cd:
  ONCE_A_FIGHT })`.
- **Once a fight** (`ONCE_A_FIGHT = 999`) is cleared unconditionally by
  `endCombat`'s existing `clearRoundTimers`, so every ability is READY at
  the start of every fight.
- **The one-tick invariant:** using an ability IS the round's action — the
  SAME dispatch's own `afterPlayerAction` → `foeTurn` call always ticks
  every `c.timers` "rounds" record once before `useAbility` returns. A
  duration-1 ability (riposte, taunt) is therefore ALREADY in its cooldown
  phase by the time the dispatch returns — its one-round window IS that
  same foeTurn, not a window you can observe from outside afterward.
  `abilityRoundsLeft(c, key)` = the effect phase's remaining rounds + its
  `cd`, or just the cooldown's own remaining rounds.
- **Quick 260928-hrs (user report and ruling 2026-09-28), superseding the
  lengths above:** "Smoke ability says it lasts for 2 rounds, but whenever I
  use it, the chit shows 1 rds." The one-tick invariant meant a "for two
  rounds" ability covered the use round's foe turn plus only ONE more, and
  its chip first read 1; Riposte ("for one round") covered only the use
  round and never showed a chip. `engine/abilities.js#abilityEffectTicks`
  now starts a "for N rounds" ability at N + 1: it still covers the foes'
  swing in the round it was used, then N full rounds after it, and the chip
  reads N right after use (N → … → 1 → gone). Taunt ("every foe swings at you
  this round", `THIS_ROUND_ABILITIES`) keeps covering exactly the use round.
  A Joiner's timer (`combat.js#startMemberAbilityTimer`) uses the same
  length. `DURATION_ROUNDS` still holds the stated rounds (the events'
  `rounds`, the text).

  | Ability | Text | Foe turns covered before (use round + after) | After | Chip right after use, before → after |
  |---|---|---|---|---|
  | Sidestep | two rounds | 2 (1 + 1) | 3 (1 + 2) | 1 → 2 |
  | Battle Roar | two rounds | 2 (1 + 1) | 3 (1 + 2) | 1 → 2 |
  | Smoke | two rounds; a flee during it just works | 2 (1 + 1); 1 free flee | 3 (1 + 2); 2 free flees | 1 → 2 |
  | Riposte | for one round | 1 (1 + 0) | 2 (1 + 1) | none → 1 |
  | Taunt | this round | 1 (1 + 0) | 1 (unchanged) | none → none |

  Pinned by `test/unit/ability-duration-rounds.test.js` (the hero and a
  Joiner).

### Per-ability resolution (condensed — see `ability_effects_spec` in
38-03-PLAN.md for the verbatim table)

| Key | Kind | Resolution |
|---|---|---|
| kata / feint | strike | `abilityStrike = { needShift: 3, bonusDmg: c.level }` → `playerStrike` (an `autoHit` until quick 260928-nrf) |
| deathTouch | strike | `{ forceCrit: true, finishUnder: 15 }` |
| silentStep | strike | `{ autoHit: true, forceCrit: true }` |
| overheadBlow | strike | `{ dmgMul: 2, needShift: -2 }` |
| lastStand | strike | gated by `notLowEnough`; `lastStandCalled` then `{ attacks: 3 }` |
| pommelStrike | strike | `{ key, stunOnHit: true }` (Phase 90, ABIL-07, report #4) → `playerStrike`: the plain strike, then if any blow landed and the target still stands, `applyPommel(t)` (`t.stunned = true`) and one `pommelStruck` after the hit events. cd 4 spent on use, hit or miss. A double strike stuns once; a killing blow, a shatter or a miss stuns nobody; no draw of its own |
| dirtyTrick | foe | `t.blind = true; t.blindFor = 2` → `dirtyTrickLanded` |
| poisonedEdge | foe | `t.dot = { left: 3, dmg: {n:1,sides:4,bonus:0}, by: "poisonedEdge" }` → `poisonedEdgeApplied` |
| hamstring | foe | `t.hamstrung = true` → `hamstrung` |
| mark | foe | `t.marked = true` → `marked` (already read by `playerStrike`'s +2 since Plan 02) |
| cutpurse | foe | `rng.d(10) * c.level` gold → `cutpursed` + `gainWilmst(..., "cutpurse", ...)` |
| secondWind | self | `rng.d(8) + c.level`, capped at `maxWP` → `secondWindHealed` |
| sweep | foes | refused `tooFewFoes` with fewer than two live foes (quick 260928-nrf); else `ceil(weaponDamage(c,rng)/2)` to every live foe via `damageFoe` → `swept`/`sweptFoe` |
| brace | self | `C.braced = true` → `braced` |
| riposte / taunt / sidestep / battleRoar / smoke | self | starts the timer → `riposteReady`/`taunted`/`sidestepped`/`battleRoarRaised`/`smokeThrown` |

Strike-kind abilities (Kata, Feint, Death Touch, Silent Step, Overhead Blow, Last Stand and, since Phase 90, Pommel Strike) delegate ENTIRELY to `combat.js#playerStrike` (which
already tail-calls `afterPlayerAction`) — `useAbility` never also calls
`afterPlayerAction` on that branch (would double-run the foe's turn). Every
other kind resolves its own effect and calls `afterPlayerAction` itself,
exactly once, at its own tail — mirroring `castSpell`'s exact pattern.

### The Task 2 combat.js hooks

- **`foeTurn`**: the `f.dot` tick (Poisoned Edge, the `f.acid` template,
  spell-kind damage so it bypasses armour) directly after the acid block;
  the `f.stunned` skip (Pommel Strike, the `f.asleep` template) directly
  after the asleep check; `f.hamstrung` halving at both the hero-branch and
  member-branch damage sites, right after the existing `C.weakened`
  halving; a hero-branch miss's Riposte counter (`abilityEffectActive(c,
  "riposte")`, a `weaponDamage` counter-hit via `damageFoe`) — member
  misses never trigger it; the `f.blindFor` countdown (Dirty Trick) at the
  END of each foe's own visit, after its swings — a spell-blinded foe with
  no `blindFor` stays blind indefinitely.
- **`pickFoeTarget`**: `abilityEffectActive(state.c, "taunt")` returns
  `null` before the target die is drawn — zero draws while active.
- **`applyFoeDamageToPlayer`**: Brace's single-charge halving (the Pendant
  of Fortitude's `c.halfNext` pattern, `state.combat.braced`) right after
  the `halfNext` block; Taunt doubles the armour-soak target (`soakAr =
  min(20, av.ar * 2)`), the `av.ar > 0` GATE itself unchanged.
- **`flee`**: `abilityEffectActive(c, "smoke")` — an unconditional escape,
  no roll, no pursuit strike, `fled { reason: "smoke" }`.

Every hook is a pure read, false/absent on every existing fixture — only
`useAbility`'s own cases ever set these fields/timers.

### Draw statement

No ability adds a draw outside its own `useAbility` dispatch or the
foeTurn/pickFoeTarget/applyFoeDamageToPlayer/flee hooks above, and every one
of those hooks fires ONLY when its flag/timer is present (never on an
existing fixture). Draws inside a dispatch: Second Wind (`rng.d(8)`),
Poisoned Edge's per-tick `d4` (foeTurn), Cutpurse (`rng.d(10)`, plus the
Pickpocket bonus draws inside `gainWilmst`), Sweep (one `weaponDamage` roll
shared by every foe, plus each `sp.ar` foe's own armour `d20` inside
`damageFoe`), Riposte's counter (`weaponDamage` + the target's own armour
`d20` inside `damageFoe`), and the five strike-modifier abilities' exact
`playerStrike` draw sequence (zero NEW draws — they only reinterpret the
roll `playerStrike` already makes).

## Joiners (Plan 04)

A melee-class Joiner (Fighter/Thief party member) fights by class AND by
kit: its own `sheet.abilities` (rolled at `meetJoiner`, the same catalog and
level-pool mechanism as the hero's) are used through the exact class-driven
policy the phase's CONTEXT locked, checked BEFORE the Magic User cast branch
in `alliesTurn`:

- **Round 1** — the first READY ability tagged `opener` (`sheet.abilities`
  order breaks ties).
- **Else, the live target above half hp** — the first READY ability tagged
  `damage` (Last Stand excluded unless the member itself is at/below the
  death-panic threshold, 25% of its own `maxWP` — it is a desperation move,
  not a plain damage pick).
- **Else, the member itself below half hp** — the first READY ability
  tagged `defensive`.
- **Else** — nothing; falls through to today's plain strike/cast, byte-
  identical.

"READY" means owned, resolves in the catalog for the member's OWN class
(an id belonging to the other class, or an unknown id, is silently
ignored — T-38-09), and has no live `sheet.timers["ability:<id>"]` record
(Phase 36). The pick itself is PURE — zero rng draws for the decision.

### Sheet timers vs. transient combat-entry flags

A member's ability cooldowns live on its own PERSISTENT sheet
(`state.party[i].timers`, Phase 36's shape) — never on the transient
`C.allies` combat entry. `ally.braced` is the one transient flag this plan
adds (mirroring `ally.backstabUsed`'s existing precedent): rebuilt by every
`startCombat`, never synced to the sheet, gone with the combat on load.

**Post-research ruling: Joiner ability cooldowns clear at `endCombat`**,
exactly like the hero's — a per-member `clearRoundTimers` call sits beside
the hero's own inside `endCombat`'s existing `C.allies` sync block (only for
a SURVIVING member; a downed member's sheet is about to be dropped from
`state.party` entirely, never ticked/cleared). A per-member `tickRounds`
call sits beside the hero's own at `foeTurn`'s tail, once per call, skipping
a downed member (`wp <= 0`). Both are guarded on `sheet.timers` being
present — a sheet with no ability ever set stays a no-op forever. Net
effect: every Joiner ability is READY at the start of every fight.

### Shared primitives — one implementation, not two

Every one of the 20 abilities resolves for a member through the SAME
primitives the hero's `useAbility` uses:

| Kind | Member resolution |
|------|--------------------|
| kata / feint | `memberStrike(..., { needShift: 3, bonusDmg: ally.lvl })` (an `autoHit` until quick 260928-nrf) |
| deathTouch | `memberStrike(..., { forceCrit: true, finishUnder: 15 })` |
| silentStep | `memberStrike(..., { autoHit: true, forceCrit: true })` (denied by the same heavy-armor list) |
| overheadBlow | `memberStrike(..., { dmgMul: 2, needShift: -2 })` |
| lastStand | up to 3 `memberStrike` calls while the target is alive (the loop is the CALLER's — `mod.attacks` is never read inside `memberStrike`) |
| pommelStrike | `memberStrike(..., { key, stunOnHit: true })` (Phase 90, ABIL-07): one blow, and a landed blow that leaves the target standing applies `applyPommel`; `pommelStruck` carries `member` |
| dirtyTrick / poisonedEdge / hamstring / mark | the shared `applyDirtyTrick`/`applyPoison`/`applyHamstring`/`applyMark` appliers (Plan 03), same foe fields, event gains `member` |
| cutpurse | `rng.d(10) * ally.lvl` gold, paid to the HERO via `gainWilmst` |
| secondWind | `rng.d(8) + ally.lvl`, capped at the member's own `maxWP` |
| sweep | never picked with fewer than two live foes (`pickMemberAbility`, quick 260928-nrf); else `ceil(weaponDamage(view, rng) / 2)` to every live foe via `damageFoe` |
| brace | `ally.braced = true` (the transient flag above) |
| riposte / taunt / sidestep / battleRoar / smoke | starts the timer on the member's own sheet; the effect is read at the SAME sites the hero's is |

`memberStrike`'s new `mod` parameter (default `null`, leaving every existing
call byte-identical) is the member analog of `playerStrike`'s transient
`C.abilityStrike` descriptor — passed directly as a function argument rather
than stashed on a shared combat-scoped slot, since a Joiner never dispatches
`useAbility`. `t.marked`'s +2 applies unconditionally (hero or member
striker alike), matching `playerStrike`'s own rule.

### foeTurn / pickFoeTarget hooks — a member's own body

- **Sidestep / Smoke**: shift the member's OWN need in `foeTurn`'s member
  branch, exactly like the hero's equivalent terms in `foeToHitVs("hero")`
  (which the member branch's `vs = "member"` call never reads) — read
  directly off the member's own `sheet.timers`.
- **Riposte**: a miss on THAT specific member, with that member's OWN
  Riposte active, counters with `weaponDamage(memberView(mSheet, member),
  rng)` through `damageFoe` (`memberRiposted`). A miss on the hero or a
  DIFFERENT member never triggers it.
- **Brace**: a single-charge halving of the next landed blow on that member
  (`member.braced`), mirroring `applyFoeDamageToPlayer`'s `state.combat.
  braced` pattern exactly (`braceHeld`, additive `member` field).
- **Taunt**: `pickFoeTarget` returns the taunting member with ZERO draws,
  checked AFTER the hero's own Taunt (the hero's own Taunt still wins if
  both are active).
- **Battle Roar**: `derived.js#partyEffectActive(state, key)` — true when
  ANY live member's own sheet carries the effect — extends BOTH
  `foeToHitVs`/`foeToHitBreakdown`'s Battle Roar term so a Joiner's Battle
  Roar covers the whole side exactly like the hero's.

### Narration

The four new member-only events (no hero equivalent exists for these):
`memberAbilityUsed` ("{name} calls {ability}."), `memberSecondWind`,
`memberSwept`, `memberRiposted`. Every Plan 03 activation/effect event a
member's ability use can also reach (`braced`/`braceHeld`/`pommelStruck`/
`dirtyTrickLanded`/`poisonedEdgeApplied`/`hamstrung`/`marked`/`cutpursed`/
`riposteReady`/`taunted`/`sidestepped`/`battleRoarRaised`/`smokeThrown`/
`lastStandCalled`) gains an additive `${e.member ? \`${e.member}: \` : ""}`
prefix in BOTH tables — absent (byte-identical) for a hero-cast use.
`allyStruck`/`allyMissed` gain an optional trailing clause naming the
ability (its canon catalog name) behind a member's strike-kind ability use.

## UI (Plan 05)

### Submenu rows

`src/browser/combatMenu.js#abilityRows(c)` — one row per `c.abilities`
catalog id, in `c.abilities` order: `{ id: "ability-<key>", label:
<NAME UPPERCASE>, cost, desc: <catalog txt>, enabled: true, dispatch: {
type: "useAbility", key } }`. Every row is `enabled: true` — a deliberate
departure from the SPELLS rows' castable-gated `enabled`: a row on cooldown
stays tappable, and the engine's own `abilityRefused { reason: "cooldown" }`
lands the canon refusal line ("<Name>: N round(s). Your arm has opinions.")
in the fight log instead of a disabled/greyed row.

Cost vocabulary: `READY` when `isReady(c, "ability:"+key)`; `"ONCE A FIGHT ·
USED"` for a `cd: "fight"` ability that is not ready (regardless of its
remaining phase); otherwise `"N ROUNDS"` (`"1 ROUND"` at exactly 1),
`abilityRoundsLeft(c, key)`. This branch replaces the disabled `NOTHING UP
YOUR SLEEVE` fallback for any Fighter/Thief with a non-empty `c.abilities` —
an empty/absent `c.abilities` keeps today's fallback unchanged.

The grid's slot-2 sub-line reads `"{ready}/{n} READY"` — `ready` counts rows
whose cost is `READY`, `n` is the row count.

**The Bard ruling:** Sing stays the FIRST row of the ABILITIES submenu
(CONTEXT: "Bard's Sing — keep it"); because a Bard is a Fighter it also
rolls abilities, so `[sing row, ...abilityRows(c)]` — nothing a Bard rolled
is unreachable, and the sing row/sub-line are byte-identical to before this
plan.

### Hero tab

A new `#s-abilities` list sits directly beside `#s-skills` ("Special
skills"), rendered by `mazeworld.html`'s paint-local `renderAbilityRows(c)`
via the `window.__mzAbilities` bridge (`byId`, `roundsLeft`, `isReady`,
`sheet: characterSheetViewModel`) — createElement/textContent only, no
innerHTML in the region (T-38-11). One row per `characterSheetViewModel(state)
.abilities` entry: `<b>{name}</b>`, a provenance `<small>` tag (`"special
skill · active"` for a `source: "table"` entry, `"trick"` for `"pool"`), the
catalog `<i>{description}</i>`, and a `<span>{state}</span>` suffix. A Magic
User's list shows the single none row `"Spells are the trick."`.
`src/browser/viewModels.js#characterSheetViewModel(...).abilities` is
`{ id, name, description, source, state }[]` — `source` is the catalog's
own literal `"table"` | `"pool"` (the tag-text mapping is the shell's job,
never re-derived twice). `state`: in combat, `"READY"` / `"{n} rounds"` /
`"once a fight · used"` (mirrors the submenu's own rule); out of combat, the
ability's OWN declared cooldown length — `"cd {n} rounds"` / `"once a
fight"` — never a live timer read, since `c.timers` is combat-scoped and
cleared every fight anyway. `#s-skills` above is untouched — passives-only,
byte-identical.

### First paint

A fresh run's guaranteed level-1 pool pick (SC-3) is narrated exactly once:
`commitRolledState(state)` (the roll-screen commit) and
`window.mzDevStartAtDepth` (the dev start-at-depth path) both call
`surfaceAbilityPool(state)` as their tail step, which reads
`src/browser/rail.js#abilityPoolCard(state.c)` — the FIRST `source: "pool"`
id in `c.abilities` (chargen's own roll order) — and, when non-null, pushes
it via `window.mzRailLine?.(card.title, card.line, card.tone, card.hold,
card.icon)` and logs the same line to the Oracle. `RAIL_COPY.abilityPool =
{ title: "UP YOUR SLEEVE", line: "New trick: {name} — {txt}" }`. `null` for
a Magic User (no pool pick) — nothing is pushed.

### Level-up folding and the fight report

A level-up's `abilityLearned` event already folds into the same SKILL LEVEL
N rail card as `leveled` (Plan 01: `RAIL_FAMILY.abilityLearned` is
identical to `RAIL_FAMILY.leveled`). The end-of-fight victory report
(`window.mzCombatReport`) gains a `"New trick: {name}."` line per
`d.learned` entry, right after the "Now skill level N." line;
`noteCombat`'s report `data` carries `learned: events.filter((e) => e.type
=== "abilityLearned").map((e) => e.name)`.

## Requirements map

| Requirement | Landed in | Proof |
|---|---|---|
| ABIL-01 | Plan 03 (`useAbility`, the refusal ladder, all 20 resolutions) + Plan 05 (the submenu row that dispatches it, so it is actually "shown and used from the ABILITIES submenu") | `test/unit/abilities.test.js`; `test/unit/combatMenu.test.js` (ABILITIES-branch section); `test/unit/shell-abilities.test.js` |
| ABIL-02 | Plan 01 (table reshape, catalog) + Plan 02 (retired-passive deletion, the strike descriptor, the need-shift actives) | `test/unit/abilities-catalog.test.js`; `test/unit/ability-strike.test.js`; `test/unit/identity-contract.test.js` (SC-4) |
| ABIL-03 | Plan 01 (the level pool: level-1 guarantee, per-level-up roll, Joiner roll, all from a derived rng stream, narrated) | `test/unit/ability-pool.test.js`; `test/unit/chargen-rng-pin.test.js` (rngState unchanged) |
| ABIL-04 | Plan 03 (the named refusal register) + Plan 05 (the submenu's READY/N ROUNDS/ONCE A FIGHT · USED legibility, the Hero-tab list's mirrored state text) | `test/unit/abilities.test.js` (refusal ladder); `test/unit/combatMenu.test.js` + `test/unit/characterSheetViewModel.test.js` (ABILITIES-branch/abilities[] sections) |
| ABIL-05 | Plan 04 (the Joiner class-driven use policy, all 20 member resolutions) | `test/unit/party-abilities.test.js` |
| SC-1: a Fighter/Thief opens the ABILITIES submenu mid-combat and sees at least one usable ability with a clear "ready" / "N rounds" state | Plan 05 | `test/unit/combatMenu.test.js` ("Fighter with c.abilities = ['kata', 'brace']..." section) |
| SC-2: using an ability on cooldown produces a named refusal in the fight log, never a silent no-op | Plan 03 | `test/unit/abilities.test.js` (refusal ladder section) |
| SC-3: a fresh level-1 Fighter/Thief already has a rolled ability; each skill-level gain can add another, narrated when it happens | Plan 01 (the level-1 guarantee + per-level-up roll) + Plan 05 (the first-paint rail card narrating the level-1 pick; the level-up "New trick" line already folded into the SKILL LEVEL N card) | `test/unit/ability-pool.test.js`; `test/unit/rail.test.js` (abilityPoolCard section) |
| SC-4: every sub-class that had one good/one bad still has both after any passive-to-active conversion | Plan 02 (the Guard→Sidestep stacking proof; the identity-contract SC-4 guard, updated in the same phase) | `test/unit/identity-contract.test.js` |
| SC-5: a melee-class Joiner in the party uses its own abilities by the same class-driven policy Joiners already fight with | Plan 04 | `test/unit/party-abilities.test.js` (policy matrix) |

## Out of scope / next

- The combat submenu, Hero-tab ability list, and first-paint pool card
  (Plan 05).
- Magic User actives beyond spells (not requested this phase — spells are
  Phase 40).
- Bot use policy for abilities — landed: see `docs/CLASS-PASS.md`
  `### Phase 42 tactics (BAL-01 second half)`.

## Class trims (quick 260928-nrf, user rulings 2026-09-28)

The 260928-abl Fighter/Thief ability audit found no one ability that
explains the class gap, and offered nerf options; the user picked option (a)
for each. Riposte is unchanged (the user kept its "for N rounds" rule from
quick 260928-hrs).

| Rule | Before | After | Where |
|---|---|---|---|
| Kata and Feint | auto-hit (`autoHit: true`) + level damage, once per fight | roll to hit with three more winning faces (`needShift: +3`, `KATA_FEINT_NEED_SHIFT`, capped at the die) + level damage, once per fight; a miss is an ordinary miss, names the ability, and still spends the use | `engine/abilities.js`, `engine/combat.js#playerStrike`/`#memberStrike` (the shared `shiftedFaces`) |
| Sweep | half weapon damage to every living foe, one foe or many | refuses `tooFewFoes` with fewer than two living foes (`SWEEP_MIN_FOES`): no turn, no cooldown, no draw | `engine/abilities.js#abilityShortfall` / `#abilityUnavailableReason`, read by `useAbility`, `pickMemberAbility`, the combat menu and the bot |
| Acrobat, being struck | foes land on their top 3 faces | their top 4 (`ACROBAT_FOE_FACES`); the Acrobat's own strike need (5, "as a fighter with the dagger") is a different rule and is unchanged | `engine/derived.js#foeToHitVs` / `#foeToHitBreakdown` |
| Thief flee bonus | +5 (canon) | +3 | `content/flee.js`; see docs/FLEE.md |

- **The menu.** A ready Sweep with one living foe reads "NEEDS TWO OR MORE
  FOES" and is disabled-styled (`enabled: false`), not counted in the "N/M
  READY" sub-line, and stays tappable so the engine's refusal explains:
  "Sweep: needs two or more foes, and there is only one. A wide arc at a
  single foe is a swing with extra steps." (rail: "Sweep: needs two or more
  foes.").
- **A missed Kata or Feint** reads, for example, "7 vs 9–12 (Kata +3). You
  miss Viper. Kata is spent all the same: one perfect form, one imperfect
  result." (rail: "You miss Viper with Kata, spent anyway"). No text says or
  implies either ability cannot miss.
- **The bot** needs no new valuation: `chooseAbility` has no expected-value
  table for strike abilities (Overhead Blow's −2 is read nowhere in the bot
  either); it picks by the Joiner policy and the engine rolls the real
  chance. It reads `abilityUnavailableReason`, so it never presses Sweep
  against a lone foe.
- **A Joiner's need shift** now skips an untouchable (0-face) foe, like the
  hero's always did; before, a Joiner's Overhead Blow could lift 0 faces to
  1.

## Phase 90 plan 10: Joiners use their combat passives, and Dirty Trick counts every visit (ABIL-06, Q10 A)

User ruling 2026-09-30 (docs/SKILL-AUDIT.md "Rulings", Q10 A): "a Joiner uses a skill the way its text describes". Three Fighter passives were the hero's alone; they now reach a Joiner Fighter's body. All three are pure reads (no draw), pinned by `test/unit/spell-skill-audit-fixes.test.js`.

| Passive | Joiner rule (engine site) | Edges |
|---|---|---|
| Stealth | `combat.js#memberStrike`: the Joiner's OWN opening landed blow (a transient `ally.opened` flag on its combat entry, like `backstabUsed`, never synced to the sheet) crits on a roll in its die's top two numbers (`atLeastFor(2, dieN)`), doubling its damage; a `stealthStrike` line carries `member` | never in plate (`armorBulk(view) >= 2`), never in the dark (`darkLimited(state)` unless the leader's Sense Presence is up), never for a Guard or Soldier (their blows never crit); a missed first swing does not open the fight; only the opening landed blow |
| Hardiness | `combat.js#applyFoeDamageToMember`: −3 on every landed blow that reaches the Joiner (a swing or a foe ability's bolt), floor 1, a blow of 0 stays 0, BEFORE the Pendant and Brace (the hero's order) | the Fridgian hide for a Joiner stays Phase 91's (IDENT-20); the phobia half is the hero's |
| Ambidextrous | `combat.js#alliesTurn`: a Joiner Fighter swings twice on a plain strike, the same two-swing loop its Speed uses (`skill(view, "Ambidextrous") \|\| itemEffectActive(sheet, "haste")`), so the two never stack | an ability use or a cast stays one action (as Phase 89's Joiner haste read); the second swing is skipped once the first has felled the target |

**Dirty Trick** (docs/SKILL-AUDIT.md, `fix engine`): its two-round blindness (`f.blindFor = 2`) used to count down only on a foe visit that reached its swings, so a blinded foe that lost turns to a sleep, a stun or a hold stayed blind longer than two rounds. `combat.js#tickBlindFor` now runs at the end of every visit a LIVE foe's turn takes (a swing, or a hold, a sleep, a stun, a misdirection, a cast ability, an empty spell kit). A spell-blinded foe has no `blindFor` and stays blind for the fight. `abilities.js#applyDirtyTrick` returns the rounds it put on the foe (2, or 0 for a foe already blind for the fight), and `dirtyTrickLanded.rounds` carries it, so the line never promises "two rounds" it did not add.

## Phase 90 close (ABIL-06, plan 90-12)

Phase 90 audited every Fighter skill, every Thief skill, every pool ability and the Bard's Sing against its text and its engine, fixed what the audit found and pinned each fix. This is the skill side of the close: every rule the phase changed, who can use each skill, and the guards that keep them true. The audit table is `docs/SKILL-AUDIT.md` (the verdict and the pin of every row); the spell side is the close section of `docs/SPELLS.md`.

### What Phase 90 changed

- **Pommel Strike (ABIL-07, plan 90-02, report #4).** It is a real strike that also stuns: the hero swings as normal (the to-hit roll, full weapon damage, crits and extra attacks) and a landed blow that leaves the target standing also costs it its next turn (a double strike stuns once; a killing blow, a shatter or a miss stuns nobody). The cooldown stays 4 rounds and is spent hit or miss. A Joiner Fighter uses it the same way, as its round-1 opener, and it draws exactly what a plain strike draws.
- **Dirty Trick (plan 90-10).** Its two-round blindness counts down on every visit the foe takes (a swing, or a visit lost to a hold, a sleep, a stun, a misdirection, a cast ability or an empty spell kit), so sight returns after two foe turns whatever the foe did; a foe already blind for the fight (the Blind spell) gets no countdown and the line says so.
- **Stealth, Hardiness and Ambidextrous for a Joiner (Q10 A, plan 90-10).** A Joiner Fighter uses its combat passives as their text describes: Stealth (its own opening landed blow crits on the top two numbers of its die, never in plate, never in the dark, never for a Guard or Soldier), Hardiness (3 less from every landed blow, never below 1) and Ambidextrous (two swings on a plain strike; it does not stack with Speed).
- **Death Touch (Q11 A, plan 90-11).** The engine is unchanged and the text now says what it does: one swing, rolled as normal; if it lands it doubles and finishes anything under 15 hp; once per fight.
- **TEXT-01 (plan 90-11).** No skill or ability text speaks in faces: a shift is "+3 to hit" (Kata, Feint), "−2 to hit" (Overhead Blow), "foes −2 to hit you" (Sidestep) or "foes −2 to hit anyone on your side" (Battle Roar); a hard cap names its range on a d20 (Smoke, Dirty Trick, Stealth); every once-per-fight ability says "once per fight" in its text; Cooking, Locks, Sewing and Silent Step say what the engine does.
- **The guard (plan 90-12).** Every number a skill or ability text states (dice, rounds, shifts, ranges, counts, "once per fight") is claimed by a fact in `test/unit/spell-skill-text-engine.test.js` and equals what the engine uses; the audit table is closed.

### Joiner use, per skill

A Joiner uses a skill the way its text describes (`engine/combat.js#pickMemberAbility`, no rng): in round 1 the first ready ability tagged opener; else against a foe above half hp the first ready ability tagged damage (Last Stand only at or below a quarter of its hp); else, below half its own hp, the first ready ability tagged defensive; else a plain strike (or a spell, for a Magic User). A Joiner uses only abilities of its own class that its sheet owns. The table says, per skill, what the rule is and where a Joiner uses it, or why it cannot (an exploration or upkeep job the hero does). It is generated from the Rule and Joiner cells of `docs/SKILL-AUDIT.md` (`test/unit/skill-audit.test.js` regenerates it from the audit and fails if this table differs).

<!-- phase90-close:skills:start -->
| Skill | Kind · Class | Rule | Joiner use | Verdict |
|---|---|---|---|---|
| Kata | table active · Fighter | once per fight; no auto-hit: +3 to hit on the one swing, +level damage; a miss still spends it | `resolveMemberAbility` cases kata and feint -> `memberStrike` with `needShift: 3` and `bonusDmg` the Joiner's level; tag damage (a target above half hp) | fixed text (90-11) |
| Stealth | passive · Fighter | passive; the first landed blow of a fight crits on a roll in the top two numbers of your strike die (19–20 on a d20, 7–8 on a d8); never in plate | `combat.js#memberStrike` since 90-10 (Q10 A): the Joiner's OWN opening landed blow (a transient `ally.opened` flag on its combat entry, no draw) crits on a roll in its die's top two numbers, never in plate (`armorBulk`), never in the dark (`darkLimited` unless the leader's Sense Presence is up) and never for a Guard or Soldier; a `stealthStrike` line names it | fixed engine (90-10) |
| Death Touch | table active · Fighter | once per fight; no to-hit shift, no auto-hit; a landed blow doubles and finishes anything under 15 hp; a miss spends it | `resolveMemberAbility` case deathTouch -> `memberStrike` with `forceCrit` and `finishUnder: 15`; tag damage | ruled (Q11, 2026-09-30) -> 90-11 built (text only, no engine change) |
| Sidestep | table active · Fighter | cd 4 rounds counted after the 2-round effect (ready again 7 foe turns after the use); foes −2 to hit you for the use round and two more; no roll | `resolveMemberAbility` case sidestep (event; the timer on the Joiner's own sheet makes `foeToHitVs` read it for that Joiner); tag defensive (below half hp) | fixed text (90-11) |
| Hardiness | passive · Fighter | passive; −3 to each landed blow and trap hit (floor 1); phobia penalties halved | `combat.js#applyFoeDamageToMember` since 90-10 (Q10 A): −3 on every landed blow that reaches it (a swing or a foe ability's bolt), floor 1, a blow of 0 stays 0, ahead of the Pendant and Brace as the hero's order; the Fridgian hide for a Joiner stays Phase 91's (IDENT-20) | fixed engine (90-10) |
| Ambidextrous | passive · Fighter | passive; two swings per strike action, each rolling to hit and for damage as normal | `combat.js#alliesTurn` since 90-10 (Q10 A): a Joiner Fighter with it swings twice on a plain strike, the same two-swing loop as its Speed (the two do not stack); a cast or an ability use stays one action, as the hero's Phase 89 haste read | fixed engine (90-10) |
| Cooking | passive · Fighter | passive; every beast kill heals a quarter of its max hp (minimum 1) and gives a ration | cannot: the kill feeds the hero's hp and rations; no Joiner code reads its Cooking | fixed text (90-11) |
| Pommel Strike | table active · Fighter | cd 4 rounds, spent on use hit or miss; the plain strike's roll and damage; a landed blow that leaves the target standing also costs it its next turn (a double strike stuns once; a killing blow, a shatter or a miss stuns nobody); no draw of its own | `resolveMemberAbility` case pommelStrike: `memberStrike` with `mod { key, stunOnHit: true }` (one blow; the same stun rule, `pommelStruck` carries `member`); tag opener, so a round-1 opener | fixed engine (90-02) |
| Runes/Signs | passive · Fighter | passive; reads automatically, no roll, no fumble | cannot: the hero reads the party's scrolls (a Magic User Joiner reads its own starting scroll once on joining, 89-05) | match |
| Battle Roar | table active · Fighter | cd 5 rounds after the 2-round effect; foes −2 to hit anyone on your side for the use round and two more | `resolveMemberAbility` case battleRoar (its own timer); tag opener | fixed text (90-11) |
| Second Wind | table active · Fighter | once per fight; heals d8 + level (level 3: 4–11) | `resolveMemberAbility` case secondWind: heals the Joiner d8 + its level; tag defensive (below half hp) | match |
| Sweep | table active · Fighter | cd 4 rounds; no to-hit roll; half of one weapon damage roll to each foe; two or more living foes | `resolveMemberAbility` case sweep (the same, kind ally); `pickMemberAbility` skips it with fewer than two foes; tag damage | match |
| Feint | table active · Thief | once per fight; no auto-hit: +3 to hit on the one swing, +level damage; a miss still spends it | `resolveMemberAbility` cases kata and feint -> `memberStrike`; tag damage | fixed text (90-11) |
| Locks | passive · Thief | passive; tier 1 opens on 6–10 on a d10, tier 2 on 4–10, plus one tier for lockpicks and the intelligence bonus | cannot: the hero opens the chests | fixed text (90-11) |
| Sewing | passive · Thief | passive; once per fed day while the armour is hurt, d6 back (tier 2: d6+3), 4 times (6) | cannot: the hero's armour only (a Joiner's armour is mended at a store, 89-08) | fixed text (90-11) |
| Night Vision | passive · Thief | passive; no dark penalty | cannot: the dark is the hero's rule; no code reads a Joiner's Night Vision | match |
| Heft | passive · Thief | passive; +2 damage per blow, mail legal, half upkeep | +2 damage (`weaponDamageTerms` reads the Joiner's own skills) and mail legality at wear (`armorRefusalReason` reads the sheet); the upkeep is the hero's own cost, so nothing for a Joiner | match |
| Acute Hearing | passive · Thief | passive | cannot: initiative and exploration are the hero's | match |
| Dirty Trick | table active · Thief | cd 4 rounds; no roll; blind for 2 foe visits, every visit counting; the foe hits only on a 20 on a d20 | `resolveMemberAbility` case dirtyTrick (`applyDirtyTrick`); tag opener | fixed engine (90-10) |
| Smoke | table active · Thief | once per fight; foes hit you only on a 20 on a d20 (19–20 if insulted) for the use round and two more; a flee in that window always works | `resolveMemberAbility` case smoke: foes hit that Joiner only on the top face; the flee clause is the hero's action, so a Joiner's Smoke gives none; tag defensive | fixed text (90-11) |
| Silent Step | table active · Thief | once per fight; auto-hit; a forced critical (damage ×2) with those exceptions | `resolveMemberAbility` case silentStep -> `memberStrike` with `autoHit` and `forceCrit` and the same heavy-armour denial; tag opener | fixed text (90-11) |
| Brace | pool active · Fighter | cd 3 rounds; the next landed blow halved; no roll | `resolveMemberAbility` case brace sets `ally.braced`; `applyFoeDamageToMember` halves its next blow; tag defensive | match |
| Riposte | pool active · Fighter | cd 4 rounds after the effect; each miss on you costs the foe your weapon damage | `resolveMemberAbility` case riposte; `foeTurn`'s Joiner branch counters a miss on that Joiner (`memberRiposted`); tag defensive | match |
| Taunt | pool active · Fighter | cd 4 rounds; one round; with no Joiner only the armour soak changes | `resolveMemberAbility` case taunt: every foe picks that Joiner and its soak doubles (`applyFoeDamageToMember`); tag defensive | match |
| Overhead Blow | pool active · Fighter | once per fight; −2 to hit; ×2 damage (a critical makes it ×4) | `resolveMemberAbility` case overheadBlow -> `memberStrike` with `dmgMul: 2` and `needShift: −2`; tag damage | fixed text (90-11) |
| Last Stand | pool active · Fighter | once per fight; at or below a quarter hp; three swings this round | `resolveMemberAbility` case lastStand: three `memberStrike` calls; `pickMemberAbility` offers it only at or below a quarter of the Joiner's hp; tag damage | match |
| Cutpurse | pool active · Thief | once per fight; d10 × level (level 3: 3–30); no roll | `resolveMemberAbility` case cutpurse: d10 × the Joiner's level goes to the hero's purse; tag damage | match |
| Poisoned Edge | pool active · Thief | cd 5 rounds; three ticks of d4 (3–12 in all); no to-hit roll | `resolveMemberAbility` case poisonedEdge (the same record); tag damage | match |
| Hamstring | pool active · Thief | once per fight; half damage from that foe for the fight; no roll | `resolveMemberAbility` case hamstring; tag opener | match |
| Mark | pool active · Thief | once per fight; +2 damage per strike from you and your Joiner for the fight; no roll | `resolveMemberAbility` case mark; tag opener | match |
| Sing | class action · Bard | once per 100 squares; Soothe sends Beasts away, Inspire gives +1 to hit for the fight, Lullaby sleeps d6 foes of your level or lower, Cry of Thunder d12 foes for d8 rounds, An Ode to Death drops foes of your level or lower to 1 hp | cannot: no Joiner code sings | Phase 91 (IDENT-17) |
<!-- phase90-close:skills:end -->

### Where each rule is pinned

`docs/SKILL-AUDIT.md` names, per skill, the test that would fail if the fix were reverted (a `Pinned by` cell of `test/unit/<file>.test.js: <title>` pins, each read by `test/unit/skill-audit.test.js`); the text-vs-engine guard `test/unit/spell-skill-text-engine.test.js` pins every number a skill or ability text states to the engine.
