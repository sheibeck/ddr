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
| Kata (Fighter, `toHit`) | `engine/derived.js#toHit` | Dropped outright — Kata's auto-hit is now descriptor-driven (`autoHit`), never a standing to-hit bonus |
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
- `needShift` widens the strike's own need (floored at 1, never revives a
  `magicOnly`/untouchable need-0 foe), narrated as a `{ name: "overhead",
  delta }` needMods entry alongside any Afraid penalty.
- `autoHit` never touches `C.opened` — the Cat Burglar/Ninja free opener
  (`subAuto`) is a structurally separate flag from an ability's own auto-hit.
- `forceCrit` obeys the Guard/Soldier/dark/noCrit-gear rule exactly like a
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

### Per-ability resolution (condensed — see `ability_effects_spec` in
38-03-PLAN.md for the verbatim table)

| Key | Kind | Resolution |
|---|---|---|
| kata / feint | strike | `abilityStrike = { autoHit: true, bonusDmg: c.level }` → `playerStrike` |
| deathTouch | strike | `{ forceCrit: true, finishUnder: 15 }` |
| silentStep | strike | `{ autoHit: true, forceCrit: true }` |
| overheadBlow | strike | `{ dmgMul: 2, needShift: -2 }` |
| lastStand | strike | gated by `notLowEnough`; `lastStandCalled` then `{ attacks: 3 }` |
| pommelStrike | foe | `t.stunned = true` → `pommelStruck` |
| dirtyTrick | foe | `t.blind = true; t.blindFor = 2` → `dirtyTrickLanded` |
| poisonedEdge | foe | `t.dot = { left: 3, dmg: {n:1,sides:4,bonus:0}, by: "poisonedEdge" }` → `poisonedEdgeApplied` |
| hamstring | foe | `t.hamstrung = true` → `hamstrung` |
| mark | foe | `t.marked = true` → `marked` (already read by `playerStrike`'s +2 since Plan 02) |
| cutpurse | foe | `rng.d(10) * c.level` gold → `cutpursed` + `gainWilmst(..., "cutpurse", ...)` |
| secondWind | self | `rng.d(8) + c.level`, capped at `maxWP` → `secondWindHealed` |
| sweep | foes | `ceil(weaponDamage(c,rng)/2)` to every live foe via `damageFoe` → `swept`/`sweptFoe` |
| brace | self | `C.braced = true` → `braced` |
| riposte / taunt / sidestep / battleRoar / smoke | self | starts the timer → `riposteReady`/`taunted`/`sidestepped`/`battleRoarRaised`/`smokeThrown` |

Strike-kind abilities delegate ENTIRELY to `combat.js#playerStrike` (which
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
| kata / feint | `memberStrike(..., { autoHit: true, bonusDmg: ally.lvl })` |
| deathTouch | `memberStrike(..., { forceCrit: true, finishUnder: 15 })` |
| silentStep | `memberStrike(..., { autoHit: true, forceCrit: true })` (denied by the same heavy-armor list) |
| overheadBlow | `memberStrike(..., { dmgMul: 2, needShift: -2 })` |
| lastStand | up to 3 `memberStrike` calls while the target is alive (the loop is the CALLER's — `mod.attacks` is never read inside `memberStrike`) |
| pommelStrike / dirtyTrick / poisonedEdge / hamstring / mark | the shared `applyPommel`/`applyDirtyTrick`/`applyPoison`/`applyHamstring`/`applyMark` appliers (Plan 03), same foe fields, event gains `member` |
| cutpurse | `rng.d(10) * ally.lvl` gold, paid to the HERO via `gainWilmst` |
| secondWind | `rng.d(8) + ally.lvl`, capped at the member's own `maxWP` |
| sweep | `ceil(weaponDamage(view, rng) / 2)` to every live foe via `damageFoe` |
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
- Bot use policy for abilities — Phase 42 (BAL-02 prep), before the
  consolidated AFTER matrix.
