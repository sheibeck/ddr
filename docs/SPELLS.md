# Spells (Phase 40 ledger)

**Phase:** 40-spell-rework
**Date:** 2026-09-18

> **Status (v1.6, Phase 48):** design record of Phase 40; the spell table and mechanics are live. "What stays for the cleanup milestone" is done — Phase 44 deleted the classic `SPELLS`/`castSpell`/`rollGrimoire` duplicates.
>
> **Status (Phase 79, plan 79-12):** the spell texts quoted below are Phase 40's. Phase 79 rewrote several roll-high or to match the engine (Mirror Self, Weaken, Sense Danger); `content/spells.js` is the live text, and `test/unit/roll-phrasing.test.js` guards it.

This ledger declares Phase 40's spell-table reshape: the 33-row niche
contract (SPELL-01), Detect Magic's rename to Map the Floor (SPELL-05), the
new Lesser Summon row and the day-one damage guarantee (SPELL-04), and the
full measured divergence table the reshape's parity carve-out depends on.
Five plans build this phase; Plan 01 (this document's author) covers the
content reshape and the day-one guarantee. Plans 02-05 append sections
below (offense mechanics, utility visibility + scrolls, the Map the Floor
re-fog Key Decision, the shell close) — this file is never rewritten
wholesale.

## Canon change

The prototype's spell list (mazeworld.html's `SPELLS` array, ~line
831-864) is canon: 32 rows spanning offense/healing/protection/divination/
illusion/special schools. Phase 40's ROADMAP goal is that combat spells are
differentiated by NICHE, not by a flat damage ladder — "a player can tell
two same-level spells solve different problems" — and that every Magic User
sub-class starts day one with a spell that can actually hurt something.

The user's Area 3 ruling, verbatim (40-CONTEXT.md, 2026-09-18):

> "Give the summoner a level 1 summon. Summoning less strong than the level
> 2 summon. Then you can keep level 1 spells without the bad gate"

Applied: a new level-1 special-school row, Lesser Summon, conjures a
WEAKER ally than the level-2 Summon (lower level, shorter duration, no
Summoner doubling/backfire — "the safe, small trick"), the Summoner is
deterministically granted it, and the Phase 23
`SPELL_LEVEL_OVERRIDES.Summoner = { Summon: 1 }` entry is retired — Summon
is spell level 2 for everyone again, and the Summoner's offense gate stays
3 (its documented "bad" — the user's own point: add a new spell, don't
touch the existing gate). **Superseded by Phase 75 (RULES-03, see the
Summoner section below):** the offense gate is removed outright, and the
Summoner's "bad" is now its own halved healing.

The once-a-day rule (standing ruling, 2026-09-18) governs any spell whose
effect has a squares cadence: it must be usable at least once per 100-square
day. Map the Floor's reveal window (Plan 04) is scoped ≤ 100 squares under
this rule.

## The table — before / after

All 33 rows of `content/spells.js`. Array position, `lvl`, and `s` (school)
for rows 0-31 are byte-identical to the pre-Phase-40 table — only `n` (row
5), `kind` (row 13), `txt` (every row), the three new data flags, and the
appended row 32 changed. `txt` is transcribed verbatim from the live
content module (not hand-typed).

| idx | Name (before -> after) | lvl | school | kind (before -> after) | txt (before -> after) | flags |
|---|---|---|---|---|---|---|
| 0 | Heal | 1 | healing | heal | `d10 wp` -> `healing · you · d10 hp` | — |
| 1 | Shield | 1 | protection | ward | `soaks 50 wp, 5 rounds` -> `defensive · you · soaks 50 hp for 5 rounds` | — |
| 2 | Strength | 1 | offense | might | `+d10 damage till tomorrow` -> `buff · you · +d10 damage till tomorrow` | — |
| 3 | Doze | 1 | offense | status | `sleep d4 rounds` -> `control · one foe · asleep d4 rounds` | — |
| 4 | Freeze | 1 | offense | thrown | `d6, thrown` -> `burst · one foe · d6, and frozen solid on a hit` | onHit: "freeze" |
| 5 | Detect Magic -> **Map the Floor** | 1 | divination | reveal | `the floor lays itself out` -> `sight · the whole floor · mapped for 40 squares, then the map forgets what it was told` | — |
| 6 | Mirror Self | 1 | illusion | mirror | `foes need a 1 for d6 rounds` -> `defensive · you · foes need a 1 to hit, d6 rounds` | — |
| 7 | Stun | 1 | offense | stun | `d6 creatures stunned d4 rounds` -> `control · up to d6 foes · asleep d4 rounds` | — |
| 8 | Weaken | 1 | offense | weaken | `they hit on a 3 and do half` -> `control · every foe · they hit on a 3 and do half, d4+1 rounds` | — |
| 9 | Acid | 2 | offense | acid | `2d6+2 a round for d6 rounds` -> `damage over time · one foe · 2d6+2 a round, d6 rounds` | — |
| 10 | Stupidity | 2 | offense | stupid | `intelligence to 1; it can do nothing` -> `control · one foe · does nothing at all for the rest of the fight` | — |
| 11 | Blind | 3 | offense | blind | `blind for life, thrown` -> `control · one foe · blind for life, which in here means the fight` | — |
| 12 | Shrink | 3 | offense | shrink | `two sizes down, half wp and damage` -> `control · up to d6 foes · half hp and half damage, the fight` | — |
| 13 | Ice | 3 | offense | thrown -> **dot** | `d6 a round, then frozen` -> `damage over time · one foe · d6 a round for d4+1 rounds, then frozen solid` | — |
| 14 | Earthquake | 4 | offense | quake | `3d10+8 to everything, you included` -> `multi-target · every foe and you · 3d10+8, half to you unless warded` | — |
| 15 | Noxious Vapor | 4 | offense | vapor | `a d6 of very bad outcomes` -> `chaos · every foe · a d6 of very bad outcomes` | — |
| 16 | Fireballs | 4 | offense | volley | `d8 balls at d10+2 each` -> `multi-target · d8 bolts · d10+2 each, spread across the foes` | — |
| 17 | Petrify | 5 | offense | petrify | `encased in stone for five days` -> `control · one foe · stone for five days; no spoils` | — |
| 18 | Insane | 2 | offense | insane | `one foe rolls on the madness table` -> `chaos · one foe · rolls on the madness table` | — |
| 19 | Summon | 2 | special | summon | `something fights beside you` -> `summon · one ally · fights beside you d4+2 rounds` | — |
| 20 | Fireball | 3 | offense | thrown | `2d10+4` -> `burst · one foe · 2d10+4` | — |
| 21 | Major Heal | 3 | healing | heal | `3d10 wp` -> `healing · you · 3d10 hp` | — |
| 22 | Bubble | 3 | protection | ward | `soaks 100 wp and reflects` -> `defensive · you · soaks 100 hp and reflects, 12 rounds` | — |
| 23 | Sense Danger | 3 | divination | foresee | `read the next encounter` -> `sight · the next encounter · names it before you meet it, and you act first` | — |
| 24 | Turn Walking Dead | 2 | protection | turn | `the dead of your level or lower are sent back` -> `answer · every Walking Dead of your level or lower · sent back` | — |
| 25 | Plane Gate | 3 | protection | gate | `d6 demons or dead vanquished to The Planes` -> `answer · d6 Demons or Walking Dead · vanquished to The Planes` | — |
| 26 | Sense Presence | 2 | protection | senses | `see in the dark; never surprised` -> `sight · you · fight in the dark at full skill and nothing gets the jump on you, till your next fight ends` | — |
| 27 | Phantom Host | 3 | illusion | summon | `a host that isn't there` -> `summon · one ally · a host that isn't there, d4+2 rounds` | — |
| 28 | Lightning | 4 | offense | thrown | `d10+6, every foe` -> `multi-target · every foe · d10+6 each` | aoe: "all" |
| 29 | Regeneration | 4 | healing | regen | `d8 wp a round this fight` -> `healing · you · d8 hp a round, this fight` | — |
| 30 | Mangle | 5 | offense | thrown | `2d20+15` -> `burst · one foe · 2d20+15` | — |
| 31 | Death | 5 | offense | death | `one foe dies, costs 25 wp` -> `burst · one foe · dies outright; costs you 25 hp` | — |
| 32 | (new) **Lesser Summon** | 1 | special | (new) **summon** | `summon · one small ally · a level under yours, d4 rounds, never backfires` | lesser: true, roll: "derived", combatOnly: false |

`NICHE_LABELS` (frozen, exported from `content/spells.js`): burst →
"burst" · dot → "damage over time" · multi → "multi-target" · control →
"control" · defensive → "defensive" · chaos → "chaos" · buff → "buff" ·
healing → "healing" · answer → "answer" · sight → "sight" · summon →
"summon". Every row's `txt` starts with `NICHE_LABELS[niche] + " · "` —
machine-checked (`test/unit/spell-table.test.js`).

## Niche map by level (offense)

The SPELL-01 proof — at every offense-school level with 2 or more spells,
at least 2 distinct niches are represented (`test/unit/spell-table.test.js`):

| Level | Niches present | Spells |
|---|---|---|
| 1 | buff, control, burst | Strength (buff), Doze/Stun/Weaken (control), Freeze (burst) |
| 2 | dot, control, chaos | Acid (dot), Stupidity (control), Insane (chaos) |
| 3 | control, dot, burst | Blind/Shrink/Petrify (control), Ice (dot), Fireball/Mangle (burst) |
| 4 | multi, chaos | Earthquake/Fireballs/Lightning (multi), Noxious Vapor (chaos) |
| 5 | control, burst | Petrify (control), Mangle/Death (burst) |

Noxious Vapor and Insane are labelled `chaos` rather than forced into the
five core niches — "their gamble is the point" (40-CONTEXT.md Area 2).
Death is `burst` (the single-target damage ceiling); Petrify is `control`
(a removal that pays no spoils — the Death-vs-Petrify trade-off is stated
in both spells' own `txt`).

## Day-one grimoire (SPELL-04)

**Why a derived stream, not a lengthened main-rng shuffle.** Adding Lesser
Summon directly into `rollGrimoire`'s main-rng-shuffled pools (`low`/`high`/
`spare`) would lengthen the Fisher-Yates shuffle by one draw for every sub
that can learn the special school — reordering the ENTIRE subsequent
chargen draw sequence (stats already rolled earlier are unaffected, but
every LATER field — including floor generation via `newRun`) for those
subs' seeds. That would break the initial-boot-state parity of the
`heal`/`scroll`/`cast-damage`/`lose-apprentice` parity scenarios (and every
other fixture seed rolling one of the 5 special-school subs) in a way no
existing declaration mechanism covers cleanly — a single new row would move
dozens of unrelated fixture bytes. Instead, `content/spells.js` flags the
row `roll: "derived"`; `engine/character.js#rollGrimoire` filters it out of
the main-rng pools entirely and splices it in AFTER each shuffle completes,
at a position drawn from a completely separate `derivedRng` stream
(`engine/rng.js`) keyed on the main cursor (`rng.getState()`) plus
`"grimoire"` plus the sub name. The main rng draw COUNT and every seed's
chargen cursor stay byte-identical — proven by
`test/unit/chargen-rng-pin.test.js` (unedited, green) and
`test/unit/day-one-damage.test.js`'s zero-draw proof (200 seeds × 8 subs).

**The Summoner's grant.** Independently of the derived splice, the Summoner
is deterministically granted Lesser Summon (`if (sub === "Summoner" &&
!book.includes("Lesser Summon")) book.push("Lesser Summon")`) — zero rng
draws, guaranteed every seed. It still also gets Summon (unaffected, the
existing Phase 23 grant line).

**The damage walk.** `engine/derived.js#dealsDamage(sp)` replaces Phase
23's `isAttackSpell` for the day-one top-up: `DAMAGE_SPELL_KINDS =
{thrown, dot, acid, volley, quake, death}`, OR `sp.lesser === true`.
Deliberate exclusions: Doze/Stun/Weaken (`status`/`stun`/`weaken`) no
longer count — they disable, they never move a foe's wp; Summon/Phantom
Host (`summon`, without `lesser`) don't count on their own — the
Summoner's damage source is specifically the GRANTED Lesser Summon, not
"any summon spell". The top-up walks the already-shuffled `spare` array
(post-splice) with zero further rng draws, appending the first
`dealsDamage` spell not already known, until the grimoire holds one.

**Per-sub day-one damage source** (measured over 200 seeds,
`test/unit/day-one-damage.test.js`):

| Sub | Special school? | Day-one damage source |
|---|---|---|
| Wizard | yes | Freeze (offense gate 1, full access) — occasionally already Lesser Summon from the low/high splice |
| Warlock | no (special: null) | Freeze — never sees Lesser Summon |
| Sorcerer | yes | Freeze/Fireball (existing guaranteed grant) |
| Summoner | yes | Lesser Summon (deterministic grant, always present) |
| Cleric | no (special: null) | Freeze — never sees Lesser Summon |
| Illusionist | yes | Freeze, or Lesser Summon when the derived splice lands it in the day-one pool (measured: present in the majority, absent in a real minority of seeds) |
| Court Mage | no (special: null) | Freeze — never sees Lesser Summon |
| Apprentice | yes | Freeze, or Lesser Summon (varies by seed, same as Illusionist) |

Every one of the 8 subs holds a castable `dealsDamage` spell on day one,
proven over 200 seeds each with zero failures
(`test/unit/day-one-damage.test.js`, `test/unit/guaranteed-attack-spell.test.js`).
No duplicate grimoire entries across any sub/seed. The Summoner's offense
gate stays 3 (`castableAttackSpells` is still `[]` at level 1 — the
identity-contract "bad" is untouched, verified byte-identical against the
plan's start commit).

## Declared divergences (Plan 01)

Every fixture the rename and/or the day-one guarantee moves, measured live
(never hand-typed) against `loadPrototypeSandbox`/`newRun`. Full mechanism
and per-field before/after tables: `test/parity/FIXTURE-INVENTORY.md`'s
"Phase 40: spell table reshape + day-one damage" section.

| Fixture | Scenario / seed | Hero | grimoire before | grimoire after | Cause |
|---|---|---|---|---|---|
| chargen | seed 7 | Wizard | `[Sense Presence, Mirror Self, Stun, Heal]` | `[..., Lesser Summon]` | SPELL-04: derived splice satisfies the damage guarantee (no damage spell in the ready book) |
| chargen | seed 15 (updated) | Summoner | `[Stupidity, Stun, Shield, Summon, Heal]` | `[Stupidity, Stun, Lesser Summon, Shield, Summon]` | SPELL-04: override retired, derived splice + grant |
| chargen | seed 24 (updated) | Apprentice | `[Heal, Strength, Stupidity, Detect Magic, Sense Presence]` | `[..., Map the Floor, ..., Freeze]` | SPELL-05 rename + SPELL-04 damage top-up (same outcome as the old attack top-up for this seed) |
| chargen | seed 29 | Warlock | `[Detect Magic, ...]` | `[Map the Floor, ...]` | SPELL-05 rename only (no special-school access) |
| magic | `heal`, seed 7 (chargenDivergence) | Wizard | as chargen seed 7 | as chargen seed 7 | same cause, chargen-time only — the cast itself (Heal) is unaffected |
| magic | `scroll`, seed 7 (chargenDivergence) | Wizard | as chargen seed 7 | as chargen seed 7 | same cause; `readScroll`'s own pick is unaffected for this seed (measured) |
| combat | `lose-apprentice`, seed 127 (chargenDivergence) | Apprentice | `[Strength, Shield, Detect Magic, Heal, Stun]` | `[..., Map the Floor, ..., Freeze]` | SPELL-05 rename + SPELL-04 (Stun no longer counts as damage) |

Measured, not assumed: the plan's own predicted moved set was chargen
seeds 7/8/15/19/24/29; live measurement found seeds 8 (Illusionist) and 19
(Sorcerer) are actually BYTE-IDENTICAL — their seed-specific derived-splice
position happened to land outside the day-one/spare cutoff for those two
particular seeds. No fixture-seed set was trimmed or re-picked.
`newRun(seed).rngState` is unchanged for every seed
(`test/unit/chargen-rng-pin.test.js`, byte-unedited).

## Corrections to CONTEXT (verified in code)

1. **The chargen pin does not move.** 40-CONTEXT.md's standing ruling
   anticipated re-pinning `test/unit/chargen-rng-pin.test.js` if a spell
   add/remove moved a day-one pool's shuffle length. Verified in code: the
   derived stream keeps EVERY main-rng cursor unchanged — no pin value was
   re-measured or edited, only that file's own third test's
   independently-derived formula gained a `sp.roll !== "derived"` filter.
2. **Shrink is up-to-d6-foes in code**, not single-target. 40-CONTEXT.md's
   Area 2 axis list wrote "Shrink (single, the fight)" when laying out the
   control scope×duration axis; `engine/magic.js`'s shrink branch is
   `liveFoes(state).slice(0, rng.d(6))` — multi-target, matching the
   `txt`'s own "up to d6 foes". This phase's table keeps Shrink multi-target
   deliberately, so level 3's control niche offers BOTH single (Blind) and
   multi (Shrink) — a real scope choice, not a duplicate.
3. **Sense Presence's "never surprised" had no engine read before this
   phase** — only the in-dark to-hit cap consulted `c.senses`. Its `txt`
   ("nothing gets the jump on you, till your next fight ends") states the
   intended meaning now; Plan 03 is responsible for giving it an actual
   initiative-side engine effect.
4. **Ice's DOT keeps the canon d6-a-round** and gains the promised
   freeze-on-expiry (per its own `txt`, "then frozen solid") — Plan 02
   wires the real per-round tick; this plan only changed `kind` (thrown ->
   dot) and `txt`, per the frozen array-position/lvl/s invariant.

## Offense mechanics (Plan 02)

Plan 01 reshaped the TABLE (niches, flags, Ice's `kind`, the new Lesser
Summon row). Plan 02 wires the MECHANICS those flags/kinds promise —
`engine/magic.js#castSpell` and `engine/combat.js#foeTurn` now read data,
never a spell's name (research Pitfall 2).

### Data flags — the sites that read them

| Flag | Row | Site | Retired name check |
|---|---|---|---|
| `onHit: "freeze"` | Freeze | `magic.js`'s thrown branch (freeze var); `combat.js#allyCast`'s thrown branch; `tools/lib/tuning-bot.mjs#chooseSpell`'s KILL tier | `sp.n === "Freeze"` (three sites) |
| `aoe: "all"` | Lightning | `magic.js`'s thrown branch (`targets`); `tuning-bot.mjs#chooseSpell`'s DAMAGE tier multiplier | `sp.n === "Lightning"` (two sites) |
| `lesser: true` | Lesser Summon | `magic.js`'s summon branch (`doubled`/`lvl`/`rounds`/name table/event key) | — (new spell, no prior check to retire) |

`grep -rn 'sp\.n === "' engine/ tools/lib/` now prints zero matches anywhere
in the engine or bot.

### Ice — the area freeze (`kind: "blast"`, Phase 90 plan 05)

Superseded. Phase 40 made Ice a real damage-over-time spell (an `f.dot` record, a per-round
d6 tick and a frozen-solid payoff when the last tick left the foe standing). The user ruled
otherwise on 2026-09-30 (SPELL-12, Q5 A): "Ice is an area d10 to every foe with a chance to freeze
each target 1d4 rounds" — the area version of the level-1 Freeze. Ice is now kind `"blast"` with
`aoe: "all"`, `onHit: "freeze"` and `dmg` a d10, and `combat.js#iceStorm` resolves it for the
hero's cast (a scroll's free cast included) and for a Joiner Magic User alike:

- **No roll to hit and no up-front resist.** Every live foe, in `C.foes` order, takes its OWN
  `d10 + level²` (plus Strength's d10 under Q1 A and any spell-damage item; Afraid halves the hero's
  cast), through `damageFoe`.
- **Then the freeze, foe by foe.** A foe the damage kills is a normal kill (no freeze line). A
  survivor goes through `freezeFoe` exactly like a Freeze's: a d4 right after the damage, the ONE
  depth-rising resist (which stops only the freeze, the damage already landed), then a `frozen`
  hold for the d4's rounds. Damage, that foe's freeze, then the next foe.
- **A hit wakes a dozing foe**, so Ice on a Doze sleeper wakes it with the damage and may freeze
  it (the hold wins).
- **Gone with the dot:** the `dot` kind, `castSpell`'s dot branch, `iceApplied`, foeTurn's ice
  payoff and `frozenSolid`, the scroll fumble's `then: "heavy"` hand-off (a fumbled Ice is an area
  damage row, Lightning's shape, hitting the reader's side) and the Ice foe chip. Poisoned Edge's
  `f.dot` tick stays.
- **Attack spell.** `"blast"` joins `ATTACK_SPELL_KINDS` and `DAMAGE_SPELL_KINDS` (so a Wizard
  with Ice refuses melee, and a Joiner may pick it); `"dot"` left `DAMAGE_SPELL_KINDS`.
- **The bot** scores Ice in the DAMAGE tier per live foe, like Lightning (never as a Freeze-style
  hold: it has Freeze's `onHit` flag but also `aoe`).

The roll draws are in docs/ROLL-LEDGER.md "Phase 90 plan 05".

### Lesser Summon — small, safe, its own thing

`castSpell`'s summon branch now reads `sp.lesser === true` to pick between
two entirely separate tracks:

| | Summon / Phantom Host | Lesser Summon |
|---|---|---|
| Summoner doubling | yes (`c.sub === "Summoner"`) | **never** |
| Backfire (1-in-8) | yes, when doubled | **never** — the `d8` check is skipped outright |
| `lvl` | `min(5, c.level + (doubled ? 1 : 0))` | `clamp(c.level - 1, 1, 3)` — one level UNDER the caster, floored at 1, capped at 3 |
| `rounds` | `(doubled ? 2 : 1) * d4 + 2` | a plain `d4` — shorter, never doubled/+2 |
| Name table | `ALLY_NAMES` (unchanged, 4 entries) | `LESSER_ALLY_NAMES` (new, 4 entries, smaller and sillier) |
| Event payload | `allySummoned`/`allyPending` (no `lesser` key) | the same two events, `lesser: true` added — the ally object itself (`C.ally`/`c.pendingAlly`) gains NO new field |

**Draw statement:** Lesser Summon — a plain `d4` (rounds) + the name pick
(one production-rng draw; a test-harness `pick` that returns `arr[0]` by
convention draws nothing observable). Summon by a Summoner — the `d8`
backfire check, then (on a non-backfire) the doubled `d4` + the pick — one
MORE draw than Lesser Summon ever makes, and the one Lesser Summon can never
trigger.

### The control axis — scope x duration, made explicit

| Spell | Scope | Duration | Mechanism |
|---|---|---|---|
| Doze | one foe | d4 rounds | `t.asleep = d4` — a timed nap (`foeTurn`'s existing `f.asleep` skip) |
| Stun | up to d6 foes | d4 rounds | same `asleep` mechanism, multiple targets |
| Weaken | every foe | **d4+1 rounds** (new, was undefined) | `C.weakened`/`C.foeToHitPenalty` + a `spell:weaken` rounds-cadence timer |
| Stupidity | one foe | **the rest of the fight** (new — was a d10 nap) | `t.stupid` — `foeTurn`'s own per-round skip, no counter, no expiry. **Superseded by Phase 90 plan 04:** `t.intel = 1` for the fight, the foe keeps acting (see "Phase 90: one resist, no floor-12 extras" below) |
| Blind | one foe | the fight | `t.blind = true` — unchanged. **Phase 90 plan 04:** also never crits, and the top-face cap is the last term of a foe swing |
| Shrink | up to d6 foes | the fight | `f.shrunk` — halves wp (Plan 01) AND now, for real, halves the foe's own melee damage |
| Petrify | one foe | removal (five days, no spoils) | unchanged. **Superseded by Phase 90 plan 04:** the foe dies through `killFoe` with spoils off (experience paid, Q2 A) |

**Weaken's timer lifecycle.** `castSpell`'s weaken branch draws `rng.d(4) +
1` and calls `engine/effects.js#startEffect(c, "spell:weaken", { rounds
})`, on top of the existing `C.weakened = true; C.foeToHitPenalty = 3`.
ONE-TICK-ALREADY-SPENT INVARIANT (38-03 SUMMARY, restated here for a spell
timer instead of an ability cooldown): a cast IS the round's action, so the
SAME dispatch's own `afterPlayerAction` -> `foeTurn` tail always ticks a
freshly-started `c.timers` record once before `castSpell` returns — a
Weaken cast that just drew "3 rounds" is therefore already reading `left: 2`
by the time the caller observes it from outside. `combat.js#foeTurn`'s tail
captures the SAME `tickRounds(c)` call's transitions for both the generic
item/ability narration (`narrateTimerTransitions`, unchanged) and a
spell-specific check: on the `spell:weaken` record's `effect -> null`
transition, it clears `C.weakened`/`C.foeToHitPenalty` and narrates
`weakenFaded` — the round's own foe damage was already computed (and
halved) BEFORE this tail runs, so the expiring round still lands soft.
Re-casting mid-window overwrites the record (a plain `startEffect` call —
refresh, never stack). A member's own Weaken cast (`combat.js#allyCast`)
draws its own `d4+1` and starts the identical `spell:weaken` record on the
HERO's `state.c` (party-wide duration lives in one place); its
`allySpellHit` event carries `rounds` too.

**Stupidity's rules change.** The old `t.asleep = Math.max(t.asleep,
rng.d(10))` line is deleted outright — Stupidity no longer naps the foe for
a random handful of rounds. `t.stupid = true` is the only mutation now;
`foeTurn` skips a stupid foe's entire turn every round (placed directly
after the asleep block, mirroring Pommel Strike's `f.stunned` skip — no
counter, the flag never clears itself, so it lasts exactly as long as the
foe does or the fight does). `playerStrike`'s to-hit floor (`need =
Math.max(need, 5)`, "5 to hit a dozing creature") now also applies to a
stupid foe — struck exactly like a dozing one.

**Shrink's real half damage.** Three foe-melee damage sites gain `if
(f.shrunk) dmg = Math.ceil(dmg / 2)` (resp. `mDmg`, and `pursuer.shrunk` in
`pursuitStrike`), each placed immediately after the existing `C.weakened`
halving — a foe that is both shrunk AND weakened is quartered (`ceil`
applied twice, independently). Zero draws; `false` on every fixture.

### The bot repoints

(Phase 90 plan 05: the Ice `dot` scoring below is gone with the dot kind; Ice is scored as area
damage per live foe, like Lightning. See "Ice — the area freeze" above.)

`tools/lib/tuning-bot.mjs#chooseSpell`'s KILL tier reads `sp.onHit ===
"freeze"` (was `sp.n === "Freeze"`); the DAMAGE tier's every-foe multiplier
reads `sp.aoe === "all"` (was `sp.n === "Lightning"`); the DAMAGE tier now
scores `kind === "dot"` (Ice) with its OWN documented constant — `expected
*= 3`, the mean tick count of the real `d4+1` duration (3.5), rounded like
Acid's own `x2` — and skips a target that already carries `dot`, mirroring
Acid's own already-ticking skip. Measured (not assumed) ordering at level 5
vs 1 foe: Mangle (burst, highest) > Fireball(s) > Acid (318, `x2`) > Ice
(310.5, `x3`) — Acid still edges out Ice even under Ice's real tick count,
because Acid's own `2d6+2` base is heavier than Ice's `1d6`.

### Byte-identical elsewhere

No fixture casts Ice, Weaken, Stupidity, Shrink, Lightning, or Lesser Summon
— the only spell any parity fixture casts that this plan touches is Freeze
(`action-script.magic.json`'s `cast-damage` scenario, seed 8), and its
`onHit === "freeze"` flag path draws and resolves byte-identically to the
`sp.n === "Freeze"` check it replaces (same variable, same value, same
branch — a pure repoint, not a behavior change). `npm test`: 2739/2739,
`# fail 0` (2711 baseline + 28 new tests in
`test/unit/spell-mechanics.test.js`); `test/parity/prototype-master.js.txt`
hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`);
`git status --porcelain test/parity/fixtures` empty.

## Utility visibility and scrolls (Plan 03)

Plan 01/02 reshaped and wired the OFFENSE school. Plan 03 closes the
research's own "Utility Spell Audit" (SPELL-02) — the ten utility kinds
(`heal`/`ward`/`might`/`mirror`/`senses`/`foresee`/`regen`/`summon`/`turn`/
`gate`) — and fixes the scroll scribing bug (SPELL-07).

### The ten-kind utility audit, closed out

| Kind | Spell(s) | Effect | Surface (chip / events) | Expiry |
|---|---|---|---|---|
| `heal` | Heal, Major Heal | `wp += dice` | `healed` event; `wp` bar moves | instant, no chip needed |
| `ward` | Shield, Bubble | soak pool + rounds | `ward` chip (Phase 31, unchanged) | `wardFaded` on the per-foeTurn countdown |
| `might` | Strength | one-time `+dice` maxWP/might boost | `might` chip (unchanged) | lasts the day, no expiry event |
| `mirror` | Mirror Self | foes need a natural 1 to hit the hero, d6 rounds | **NEW `mirror` chip** `{remaining}` | `mirrorFaded` — per-foeTurn countdown (existing) OR endCombat if still running when the fight ends (new) |
| `senses` | Sense Presence | waives the in-dark to-hit cap AND (new, this plan) every forced foe-first initiative rule, till the next fight ends | **NEW `senses` chip** (flat boolean) | `sensesFaded` — endCombat's own unconditional reset (new) |
| `foresee` | Sense Danger | arms `c.foresight`; narrates the next encounter type on cast; consumed by the next `rollInitiative` | **NEW `foresight` chip** (flat boolean, while armed) | consumed silently by `rollInitiative` (always sets it back to `false`); no separate expiry event needed — the cast's own `senseDanger` line already told the player what to expect |
| `regen` | Regeneration | `d8`/round heal, ticks only inside `foeTurn` | **NEW `regen` chip** (flat boolean) | `regenFaded` — endCombat's own unconditional reset (new) |
| `summon` | Summon, Phantom Host, Lesser Summon | spawns an ally | `allySummoned`/`allyPending` (unchanged, Plan 02 added `lesser`) | ally's own `rounds` countdown (unchanged) |
| `turn` | Turn Walking Dead | situational multi-target removal | `walkingDeadTurned`/`nothingToTurn` (unchanged) | instant |
| `gate` | Plane Gate | situational multi-target removal | `planeGated`/`gateRefused` (unchanged) | instant |

Three kinds (`mirror`/`senses`/`regen`) had a real engine effect but zero
chip before this plan — the research's "cheapest SPELL-02 fix in the whole
phase," confirmed: `engine/derived.js#conditionsOf` gains four new `if`
blocks, copying the `might`/`ward` precedent verbatim, in a fixed order
**after `ward`, before `flight`**: `mirror -> senses -> regen -> foresight`.
All four are pure reads of fields the engine already writes — no rng, no
mutation, no new serialized field, so no comparables carve-out is needed.

### Sense Presence's rules change — a real initiative effect

Sense Presence's canon "never surprised" (`txt`: "fight in the dark at full
skill and nothing gets the jump on you, till your next fight ends") had no
engine read before this phase beyond the in-dark to-hit waiver. Now, while
`c.senses` is truthy, `engine/combat.js#rollInitiative`'s forced-foe-first
clause (`samurai || slow || knightBig || courtMage`) is ALSO waived — the
character's own d20 pair decides the roll like anyone else's, instead of the
result being forced to `"foe"`. **The two d20s are still always drawn** —
this is a branch change, never a draw-count change, so no fixture moves. A
foreseen character (`c.foresight`) still always goes first regardless,
exactly as before. `engine/combat.js#fight`'s own `combatJoined` event gains
an additive `senses: true` key, spread in ONLY when `c.senses` is up AND it
is the reason the roll went the hero's way (`first === "you"`) — a plain win
with no senses, or a senses-carrying character who still lost the fair roll,
keeps the byte-identical pre-Phase-40 event shape. `c.senses` itself clears
at `endCombat` exactly as before (unconditional reset, unchanged) — "till
your next fight ends" is now a literal engine guarantee, not just flavor
text.

> **RULES-05 update (Phase 75, user 2026-09-25):** the waiver above stopped
> a FORCED foe-first roll, but left the fair d20 pair as a coin flip — a
> sensed character could still LOSE that roll and go second, which
> contradicted "nothing gets the jump on you" outright (a device report: a
> depth-8 Court Mage with senses up lost initiative 2 vs 17 in the dark and
> died). `c.senses` now joins `foreseen`/`acuteHearing` in the UNCONDITIONAL
> "you go first" branch of `resolveInitiative`'s ternary — see "Phase 75
> (RULES-05, RULES-14)" below for the full account, including the dark-crit
> waiver and the verdict line's new wording.

### The endCombat expiry lines

`engine/combat.js#endCombat` now narrates the expiry of any of the three
utility effects still running when the fight ends, **before** its existing
unconditional resets (`regen = false`, `ward = null`, `mirror = 0`, `senses
= 0`) wipe them — in order `regenFaded`, `sensesFaded`, `mirrorFaded`, then
the existing `combatEnded`. A mirror that already ran out mid-fight (the
existing per-foeTurn countdown) already narrated its own `mirrorFaded` and
is `0` by the time `endCombat` runs, so this never double-narrates — only a
STILL-RUNNING effect at fight-end reaches the new lines. A bare character
(nothing live) pushes none of the three; every pre-existing `endCombat`
event pin holds byte-identical.

### The scroll rule (SPELL-07)

`engine/magic.js#readScroll`'s copy-to-grimoire condition used to check only
`canLearn(c.sub, sp) && sp.lvl <= c.level` — the spell's raw PRINTED level
against the caster's own level, **never** `schoolGate`. `canCast` (what
actually gates whether a scribed spell can be cast) checks THREE things:
known in grimoire, `spellLevelFor(sub, sp) <= level`, AND `level >=
schoolGate(sub, sp.s)`. The gap let a scroll scribe a spell whose SCHOOL was
gated higher than its printed level, permanently uncastable until the
caster's level caught up — five reachable level-1 cases (40-RESEARCH.md
"Scroll Scribing Bug"): Warlock+Heal (healing gate 3), Court Mage+Map the
Floor (divination gate 4), Apprentice+Map the Floor (divination gate 3),
Illusionist+Shield (protection gate 3), Summoner+Freeze (offense gate 3 —
**superseded by Phase 75**, the offense gate is removed; see the Summoner
section below).

The scribe gate is now exactly `canCast`'s own two checks:
`spellLevelFor(c.sub, sp) <= c.level && c.level >= schoolGate(c.sub, sp.s)`.
When they pass, the spell is scribed exactly as before — a scribed spell is
therefore ALWAYS castable immediately. When they fail, the scroll is NOT
scribed — it pushes `scrollTooAdvanced { spell, need, have, school }` (`need`
is the higher of `spellLevelFor` and `schoolGate`) and falls through to the
EXISTING free-cast path unchanged (the scroll still pays for itself once, in
or out of combat, exactly as a spell the caster's sub could never learn at
all already did). A spell the sub cannot learn (`canLearn` false) is
unaffected either way — same free cast as always, no `scrollTooAdvanced`. A
spell already in the grimoire is never re-scribed and never
`scrollTooAdvanced` — the outer `!c.grimoire.includes(sp.n)` gate short-
circuits first, falling straight to the free cast.

**Tolerant old-grimoire proof.** A pre-Phase-40 save whose grimoire already
holds a scribed-but-uncastable entry (scribed under the old, buggier check)
is untouched by this plan — no migration runs. The next time that spell is
cast, `canCast` refuses it with the existing `spellSchoolLocked`/
`spellAboveLevel` event, which already names the level needed. Verified live
(`test/unit/spell-utility.test.js`'s "tolerant proof" test): a level-1
Warlock with `grimoire: ["Heal"]` calling `castSpell` gets exactly
`{ type: "spellSchoolLocked", spell: "Heal", school: "healing", need: 3,
have: 1 }` — no crash, no mutation of the grimoire entry itself.

### Byte-identical elsewhere

No fixture casts a utility spell (Mirror Self, Sense Presence, Regeneration,
Sense Danger) or reaches the new `scrollTooAdvanced` branch — the `scroll`
scenario's seed-7 Wizard has every school at gate 1 (`MU_CHART.Wizard` has
no `.gate` object) and no `SPELL_LEVEL_OVERRIDES` entry, so
`spellLevelFor(sub, sp) === sp.lvl` for every row and `schoolGate` is always
`1` — the new two-check condition collapses to the OLD `sp.lvl <= c.level`
check for this Wizard specifically, arithmetically identical, confirmed by
`test/parity/magic-parity.test.js` replaying byte-identical with no new
declaration needed. `npm test`: 2773/2773, `# fail 0` (2739 baseline + 34
new tests: 29 in the new `test/unit/spell-utility.test.js`, 3 in
`conditions.test.js`, 1 in `combat.test.js`, 1 in `cast-refusals.test.js`);
`test/parity/prototype-master.js.txt` hash unchanged
(`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); `git status --porcelain
test/parity/fixtures` empty.

## Scroll reading and fumbles (Phase 75.1, RULES-10)

Plan 02 of Phase 75.1 (`pilfer-fumbles-scroll-reading`) replaces the old
class/skill scroll gate (`canRead`, and the Pilfer's lockout) with an
intelligence roll anyone can attempt, and pins — as pure content data, not
engine logic — exactly what a fumbled scroll does to each of the 33 spells.
This section documents the read rule; `engine/scrollFumble.js` (Plan 05)
resolves it against the table below.

### Who reads

- **A Magic User** always succeeds: cast, plus the grimoire copy when
  learnable. Unchanged from before this phase.
- **A non-Magic-User holding Runes/Signs** always succeeds too, but gets
  the free cast only — the grimoire copy stays Magic-User-only.
- **Everyone else** rolls a d20 against their own intelligence. There is no
  intel-12 floor (canon's resist gate never carried over here, and it is
  retired everywhere since quick 260928-hrs) — low intelligence just means
  worse odds.

### The target, roll-high

The lowest winning face is `22 − intel` (`intel − 1` winning faces —
`resistRoll`'s own shape, minus its floor). A **fumble** is a roll below
half that target: the reader avoids a fumble at `ceil(target / 2)` or
better.

Worked examples:

| Intel | Target (lowest win) | Fumble band | Plain-failure band | Win band |
|---|---|---|---|---|
| 14 | 8 | 1–3 | 4–7 | 8–20 |
| 13 | 9 | 1–4 | 5–8 | 9–20 |
| 20 | 2 | never | 1 | 2–20 |
| 1 | 21 | 1–10 | 11–20 | never |

A roll landing exactly on `ceil(target / 2)` is a plain failure, not a
fumble (intel 14: a roll of 4 against target 8 fails plainly). Intel 20
can never fumble; intel 1 can never successfully read a scroll and fumbles
on 1–10.

### Consumption, fizzles and the Pilfer

The scroll is consumed on **every** attempt, success or failure. A plain
failure casts nothing (the reader squints at runes they can't make out
while the scroll crumbles). A fumble **outside combat** simply fizzles: no
effect, and the scroll is still destroyed. The intelligence roll is drawn
from its own derived rng stream, so the main stream is never reordered. A
Pilfer reads scrolls under this same rule, unchanged — the Pilfer's RULES-09
d10 item-explosion blast never applies to scrolls.

### The fumble table

| # | Spell | kind | side | effect | extras |
|---|-------|------|------|--------|--------|
| 0 | Heal | heal | helpful | heal | |
| 1 | Shield | ward | helpful | ward | |
| 2 | Strength | might | helpful | might | |
| 3 | Doze | status | harmful | out | kind "asleep", rounds d4 |
| 4 | Freeze | thrown (onHit freeze) | harmful | heavy | how "frozen" |
| 5 | Map the Floor | reveal | helpful | wasted | |
| 6 | Mirror Self | mirror | helpful | mirror | rounds d6 |
| 7 | Stun | stun | harmful | out | kind "asleep", rounds d4 |
| 8 | Weaken | weaken | harmful | weakened | rounds d4+1 |
| 9 | Acid | acid | harmful | dot | rounds d6 |
| 10 | Stupidity | stupid | harmful | out | kind "stupefied", rounds d4 |
| 11 | Blind | blind | harmful | blind | |
| 12 | Shrink | shrink | harmful | shrink | |
| 13 | Ice | dot | harmful | dot | rounds d4+1, then "heavy" |
| 14 | Earthquake | quake | area | damage | once true |
| 15 | Noxious Vapor | vapor | harmful | vapor | rounds d4 (the sleeping face) |
| 16 | Fireballs | volley | area | volley | |
| 17 | Petrify | petrify | harmful | heavy | how "stone" |
| 18 | Insane | insane | harmful | out | kind "maddened", rounds d4 |
| 19 | Summon | summon | helpful | summon | |
| 20 | Fireball | thrown | harmful | damage | |
| 21 | Major Heal | heal | helpful | heal | |
| 22 | Bubble | ward | helpful | ward | |
| 23 | Sense Danger | foresee | helpful | wasted | |
| 24 | Turn Walking Dead | turn | harmful | none | |
| 25 | Plane Gate | gate | harmful | none | |
| 26 | Sense Presence | senses | helpful | senses | |
| 27 | Phantom Host | summon | helpful | summon | |
| 28 | Lightning | thrown (aoe all) | area | damage | |
| 29 | Regeneration | regen | helpful | regen | |
| 30 | Mangle | thrown | harmful | damage | |
| 31 | Death | death | harmful | heavy | how "death" |
| 32 | Lesser Summon | summon (lesser) | helpful | summon | |

Pinned as `content/scroll-fumbles.js#SCROLL_FUMBLE`, keyed by each spell's
exact name (`test/unit/scroll-fumble-table.test.js` fails on a rename or an
unclassified addition).

What each effect means:

- harmful **damage**: the reader takes the spell's own damage expression as
  `castSpell` computes it for a target (thrown: dice × `max(1, level −
  spell level)`); it always lands — armor and wards do not soak it.
- harmful **heavy** (no fumble kills outright): in place of an instant kill
  (frozen solid, turned to stone, the Death spell), the reader takes `d10 +
  depth` unsoaked damage from a derived stream and becomes Afraid; only the
  normal death path can kill, so a wounded reader can die of it but never
  automatically.
- harmful **dot**: the reader burns for the spell's per-round dice for
  `rounds` rounds; Ice's `then: "heavy"` lands the heavy blow (how "frozen")
  if the burn runs out while the fight is still on.
- harmful **out** (disabling spells cost turns, at most d4): the hero
  cannot act and loses d4 turns (Doze, Stun, Stupidity, Insane). Nothing
  wakes the hero early, foes hit the hero normally (no easier-hit bonus),
  and it never outlasts the fight.
- harmful **blind** (works as on a foe): the hero's weapon to-hit drops to
  one winning face (the top face) for the rest of the fight — no turns are
  lost.
- harmful **shrink** (same ruling): current hp halved, rounding up (so it
  cannot kill), and the hero's landed weapon damage halved for the rest of
  the fight; max hp is untouched — no turns are lost.
- harmful **weakened**: the hero's existing foe-inflicted hex (half damage)
  for `rounds`. Plan 76-06's dispatch (user ruling 2026-09-26, "weaken the
  reader"): the code now does what this line says, `c.foeEffect { kind:
  "weakened", rounds }` on the reader. Until then it set the foe-side
  `C.weakened` / `C.foeToHitPenalty` / `spell:weaken` fields, so the fumble
  helped the reader (ROLL-LEDGER audit row X8).
- harmful **vapor**: the vapor table as `castSpell` rolls it (level 5+
  always 4, else a d6); a 4 is a heavy blow (how "vapor") unless a d10
  shows 1; anything else puts the reader to sleep (out, asleep) for d4
  turns (`castSpell`'s foe sleep is d6+2; every turn-loss fumble here is
  capped at d4).
- harmful **none**: Turn Walking Dead and Plane Gate have nothing to act on
  in a living reader.
- area **damage** / **volley**: every live party member, the summoned
  ally and the reader, each as if targeted (Lightning rolls per target,
  Earthquake once for all, Fireballs spreads d8 bolts in turn); a summoned
  ally has no hit points, so any hit unmakes it.
- helpful **heal** / **regen** / **ward** / **might** / **mirror** /
  **senses** / **summon**: the targeted foe gains the spell's own effect
  (heals, regenerates d8 a round, is warded by Shield or bubbled by Bubble,
  gains Strength's damage and doubled hp, is mirrored so strikes need the
  top face, gains senses, or gets the summoned creature as a
  reinforcement).
- helpful **wasted**: Map the Floor and Sense Danger give a foe nothing it
  can use — the scroll is simply spent on the wrong side.

### The severity rulings (user, 2026-09-25)

- **No scroll fumble kills outright.** Freeze, Petrify and Death are
  `heavy` (d10 + depth, unsoaked, plus Afraid) instead of an instant kill;
  Ice's end-of-burn and Noxious Vapor's killing face resolve the same way.
- **Disabling spells cost the hero turns, at most d4.** Doze, Stun,
  Stupidity and Insane are `out` rows — a deliberate, scroll-fumble-only
  exception to the Phase 31 "penalties, never a no-actions state" ruling.
  No such effect may outlast the fight, and foes do **not** get an
  easier-hit bonus against a hero who can't act.
- **Blind and Shrink work on the hero as on a foe and cost no turns.**
  Blind is a to-hit penalty; Shrink halves current hp and weapon damage.
  Neither loses a turn.
- **A fumbled Summon joins the foes** as a reinforcement, capped at 4 live
  foes.

### Remaining flagged calls (Claude's discretion, flagged for the user)

- **Noxious Vapor's sleep is d4 on the hero**, not the foe-facing d6+2 —
  every turn-loss fumble here is capped at d4. Flagged for the user.
- **Hero Shrink never touches max hp** (a foe's max hp halves too, but on
  the hero that would outlast the fight), and **hero Blind affects weapon
  strikes only** (a blind foe's spells are unaffected). Flagged for the
  user.
- **Only area-damage spells are area.** Stun, Weaken, Shrink and Noxious
  Vapor act on the reader alone. Flagged for the user.
- **Fumbles always land and bypass armor and wards** (no to-hit roll), like
  the Apprentice backfire. Flagged for the user.
- **Helpful spells with nothing for a foe are wasted** (Map the Floor,
  Sense Danger); Sense Presence gives the foe its senses flag, which has no
  further mechanic once a fight has begun. Flagged for the user.

## Map the Floor — Key Decision: re-fog provenance (Plan 04)

Plans 01-03 renamed the spell and reshaped everything ELSE about the
grimoire; Plan 04 turns Map the Floor into the time-boxed, re-fogging
reveal SPELL-05 actually asks for (the prototype's Detect Magic was a
permanent, one-way whole-floor `seen=true` sweep with no re-fog mechanism
at all).

### The Key Decision, verbatim (40-CONTEXT.md Area 1, user-chosen, ratified)

> The renamed reveal spell marks every cell it reveals with a per-cell
> provenance flag (e.g. `cell.spellSeen = true`) and starts
> `c.timers["spell:reveal"]` with `cadence: "squares"`, `left: N` (N stated
> in the grimoire text; ≤ 100). Normal walking during the window clears the
> flag on the cells it sees (they become permanently seen). At expiry, ONE
> sweep re-fogs cells still flagged (`seen = false`, flag cleared) and
> narrates `revealFaded`; the sweep runs once at expiry, never per step
> (research Pitfall 4). Re-casting during the window extends/refreshes the
> timer, never double-marks.

In one sentence, for PROJECT.md's Key Decisions at phase close: "Only what the spell alone showed" re-fogs — a cell the player actually walked to
during the window is never taken away from them, even though the spell's
own temporary light over the rest of the floor fades right on schedule.

### The two research options, and why A won

`40-RESEARCH.md`'s "Detect Magic / Map Reveal (SPELL-05)" section laid out
two mechanisms for telling "seen because the player walked here" apart from
"seen only because the spell's window is open":

- **Option A — per-cell provenance mark (chosen).** A lazily-set
  `cell.spellSeen` flag, cleared the instant real exploration (`reveal()`)
  touches the cell, swept once at the window's expiry. Correctly satisfies
  the requirement's literal wording — including a cell that BOTH the spell
  AND normal walking would have revealed during the window (it graduates
  the moment either happens, whichever comes first).
- **Option B — snapshot diff.** Capture the `seen` grid as a coordinate set
  at cast time; revert every cell NOT in that snapshot back to `false` at
  expiry. Rejected: this loses any cell the player genuinely walked to
  during the window unless a SECOND live diff is computed at expiry —
  which is mechanically identical to Option A's provenance mark, just
  computed lazily instead of maintained incrementally. Strictly more
  complex for zero behavioral benefit.

Option A won on directness: one lazy field, one graduation point (the
existing `reveal()` call every move/teleport/descend site already makes),
one sweep function, no second data structure to keep in sync.

### The mechanism

- **Cast** (`engine/magic.js`'s `reveal` kind branch): every cell that is
  `!wall && !seen` gets BOTH `seen = true` and `spellSeen = true`; a cell
  already seen (walked earlier, or already spell-marked by an earlier cast
  this window) is left completely alone — no double-marking, and the
  `floorMapped { squares, cells }` event's `cells` count is only the
  NEWLY-marked cells. `startEffect(c, "spell:reveal", { squares: sp.squares })`
  starts the window; `SPELLS[5].squares === 40` (the txt already states the
  same number; ≤ 100 per the once-a-day rule below).
- **Graduation** (`engine/maze.js#reveal`, the shared function EVERY
  move/teleport/descend/newRun call already routes through): after marking
  a touched cell `seen = true`, `if (cell.spellSeen) delete cell.spellSeen;`
  — a cell the player actually sees, by any means, leaves the spell's
  provenance and becomes ordinary permanent memory. A no-op delete on a
  cell that never carried the flag, so every fixture floor (none ever casts
  the reveal spell) stays byte-identical.
- **The one sweep** (`engine/maze.js#refogSpellSeen`, called from
  `engine/movement.js`'s per-step tick site): reacts to the ONE
  `{ id: "spell:reveal", from: "effect", to: null }` transition
  `tickSquares` returns on the exact step the window's `left` hits 0 —
  never a per-step poll of the record (research Pitfall 4, the pitfall this
  plan was explicitly warned about). Every cell still carrying `spellSeen`
  at that instant becomes `seen = false` with the flag removed; the count
  is narrated as `revealFaded { cells }`. This step's own `reveal()` call
  (the player's normal per-step exploration) runs BEFORE the tick site, so
  a cell the player walks onto on the exact 40th step is already graduated
  and never re-fogs, even on the step the window closes.
- **Recast** overwrites the timer via `startEffect`'s own overwrite
  semantics — `left` resets to 40, and because the cast branch only marks
  cells that are NOT already `seen`, a recast on an unchanged floor marks
  zero new cells and never double-flags one already flagged.
- **Descend** (`engine/movement.js#descend`): a live `spell:reveal` record
  is deleted silently — no sweep, no `revealFaded` — before the new floor
  is even generated. The mapped floor is behind you; the chip simply
  disappears with the floor, by design. **Teleport does NOT touch the
  record** — it graduates whatever cells its own `reveal()` call touches
  (like any move), but never ticks or clears the window itself.
- **The once-a-day rule** (standing ruling, 2026-09-18): any squares-cadence
  effect must be usable at least once per 100-square day. 40 ≤ 100 —
  Map the Floor can be recast well within a single day's walking.

### The chip

`engine/derived.js#conditionsOf` gains the `reveal` chip
(`{ key: "reveal", polarity: "good", remaining: <left>, cadence: "squares" }`)
in the FIXED order after `foresight`, before `flight` — reading the SAME
`spell:reveal` record, only while `phase === "effect"` and `left > 0` (a
cooldown-phase or already-expired record — neither of which this id ever
actually reaches, since the record has no `cd` and is deleted outright at
expiry — would correctly show nothing either way). Pure read, no new
serialized field.

### Tolerant load

- **Stale flags, no live record** (`engine/saveState.js#clearStaleSpellSeen`,
  wired into BOTH `validateSave` and `rehydrate`, mirroring `clearStaleTimers`'s
  exact discipline, T-40-07): a floor whose grid carries `spellSeen` flags
  with NO live `spell:reveal` record on `c` has every flag stripped —
  `seen` is left EXACTLY as saved (a cell the player genuinely walked
  during a previous session is never re-fogged by a tolerant load; worst
  case a cell the player never walked stays lit one load longer, corrected
  by the next live sweep or the next cast). A floor with a LIVE record
  (`phase: "effect", left > 0`) is left completely untouched.
- **The retired spell name** (`engine/saveState.js#migrateSpellNames`,
  wired the same way): a grimoire entry named "Detect Magic" is rewritten
  to "Map the Floor" in place — position preserved, first-occurrence
  dedupe if both names were somehow present — no card, no narration, no
  rng. `engine/saveState.js` is the ONLY place in `engine/` the retired
  name survives at all (grep-verified).

### The harness carve-out

`spellSeen` is a brand-new, lazily-set, engine-only per-cell field with NO
prototype-side equivalent — exactly the same structural-tripwire shape as
`c.timers`/`c.worn`/`c.abilities` before it. `test/parity/harness/
comparables.js#stripSpellSeen(floor)` strips it (a cheap same-object no-op
when nothing is flagged), wired into all three exported comparables
(`movementComparable`/`combatComparable`/`economyComparable`) AND mirrored
into the three per-domain local `comparable()` duplicates
(`combat-parity.test.js`/`magic-parity.test.js`/`movement-parity.test.js`),
per Phase 21's own "keep the local duplicates in sync" lesson.

### Byte-identical elsewhere

No parity fixture ever casts the reveal spell — `reveal()`'s graduation
`delete cell.spellSeen` is a no-op on every cell in every fixture floor
(none ever carries the flag to begin with), so this is a **structural**
carve-out, not a measured content divergence: zero fixture moves. `npm
test`: 2800/2800, `# fail 0` (2782 baseline + 18 new tests in the new
`test/unit/map-reveal.test.js`, plus 8 more in `save-validation.test.js`);
`test/parity/prototype-master.js.txt` hash unchanged
(`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); `git status --porcelain
test/parity/fixtures` empty.

### Phase 41 note (orthogonal, not designed here)

Phase 41's darkness rework is explicitly a RENDER-TIME filter over `seen`
("the engine's `seen` memory is unchanged" — 40-RESEARCH.md) limiting the
visible window while standing on a dark square. This plan changes what
`seen` actually CONTAINS (temporarily, for a spell-lit cell); Phase 41
changes what's RENDERED from whatever `seen` already contains. The two are
orthogonal — the shell's `draw()` reads `cell.seen` fresh every paint
(verified), so a re-fog sweep is picked up immediately with no coupling
needed. Plan 05 (this phase) paints spell-only cells in their own distinct
map tint; Phase 41's later filter simply applies on top, unmodified.

### Plan 76-06 amendment (user ruling 2026-09-26): the window lasts until you move

The user: "revealing the dungeon spell should last only until you move. Then
you lose focus and map stops being revealed. it's pretty powerful to be able
to map your way around and move." (76-CONTEXT.md, "User rulings after
planning".)

- **The rule.** After a cast the whole floor stays shown while the hero stands
  still. The hero's FIRST step onto another square ends the window and the
  floor re-fogs; every cell the hero walked or saw normally stays seen. The
  spell is a snapshot you study, not a map you navigate by.
- **The seam.** `SPELLS[5].squares` is now **1**, on the same squares timer and
  the same one sweep described above: the first step's `tickSquares` produces
  the `spell:reveal` effect-to-null transition, `refogSpellSeen` runs and
  `revealFaded` fires. Every step costs at least 1 (a water step costs 2), so
  any step ends it. No new flag and no new expiry code.
- **Only movement ends it.** `engine/movement.js#move` is the only `tickSquares`
  call site in `engine/` (pinned by `test/unit/map-until-move.test.js`).
  Casting any spell, reading a scroll, using an item, camping, a fight that
  starts and ends on the same square, a flee attempt, a refused step (a wall
  bump, a one-way door, the hazard-choice card) and opening any tab leave the
  window alone. A teleport is not a step (it never ticks the window). Stepping
  onto the stairs sweeps first, then descends.
- **Recast** rewrites the one-square record: an open window stays open (and
  marks nothing twice), a closed one reopens and the next step closes it. A
  scroll of Map the Floor resolves through the same cast branch, so it follows
  the same rule.
- **Relaunch.** The squares-cadence record survives both load chains (squares
  records are never cleared by `clearStaleTimers`), `clearStaleSpellSeen` keeps
  the flags while the record is live, and 76-03's resumed fight carries a
  window cast on the fight's square. The first step after the relaunch sweeps.
- **Old saves.** `engine/saveState.js#clampRevealWindow`, wired into both load
  chains next to `clearStaleTimers`, loads a live record with more than one
  square left as `left: 1` (no event, no narration). Any other record shape is
  left to the existing handling. It is a no-op for every state the new engine
  produces.
- **The event and the chip.** `floorMapped` is `{ type, cells }` (no squares
  count). The `reveal` chip is `{ key: "reveal", polarity: "good" }` with no
  countdown; the shell's `CONDITION_COPY.reveal` carries the fixed detail
  "until you move", and the Gear kit row reads the same.
- **Superseded above:** the 40-square numbers (`SPELLS[5].squares === 40`, the
  "exact 40th step" wording), the recast-resets-to-40 refresh, the chip's
  `remaining`/`cadence` fields and the once-a-day note (a one-square window
  needs none). The Phase 40 rename table stays as the historical record.
- **Balance.** Measured once in the Phase 79.1 end-of-milestone bot pass, not
  here (user ruling 2026-09-26).

## UI (Plan 05)

Plans 01-04 built every engine surface this phase promises; Plan 05 puts all
of it on screen and closes the ledger.

### The niche line, on both spell surfaces

`content/spells.js#SPELLS[i].txt` already begins with `NICHE_LABELS[niche]
+ " · "` (Plan 01's contract). Both places a player reads a spell now carry
the KEY, not just the pre-formatted string, so the shell (or a future UI)
can group/badge by niche without parsing `txt`:

- `src/browser/viewModels.js#grimoireViewModel` — the Hero-tab Grimoire
  rows each gain `niche`/`nicheLabel` beside the existing `name`/`lvl`/
  `txt`/`combatOnly`/`castable`/`disabledReason` fields; `txt` itself is
  unchanged (already niche-first). `mazeworld.html#renderGrimoire`'s
  `<i>${row.txt}</i>` line needed no markup change — the niche is already
  the first thing the row renders.
- `src/browser/combatMenu.js`'s SPELLS submenu rows gain the identical two
  fields; `desc` stays `sp.txt`.

### The chip table (`CONDITION_COPY`/`CONDITION_TONE`/`CONDITION_EXPLAIN`)

Five new rows, copying the `might`/`ward` precedent Phase 31/39 established
(one object-literal entry per key, read by the generic
`typeof cn.remaining === "number"` detail branch — no chip needed a special
case):

| Chip key | Label | Detail (generic branch) | Tone | Explanation (tap) |
|---|---|---|---|---|
| `mirror` | Mirrored | `{n} rds` | good | "They swing at a reflection for a few rounds. Try not to look smug." |
| `senses` | Senses | (flat, no count) | good | "You fight in the dark at full skill and nothing gets the jump on you, until this fight ends." |
| `regen` | Regenerating | (flat, no count) | good | "Wounds close on their own every round of this fight. It is not a licence." |
| `foresight` | Forewarned | (flat, no count) | odd | "You already know what the next encounter is. Whether that helps is up to you." |
| `reveal` | Mapped | `{n} sq` | odd | "The floor is on loan. When the squares run out, the parts you never walked go dark again." |

### The Hero-tab kit rows

> **Phase 62 update (2026-09-23, v1.9):** these rows no longer live on the
> Hero tab's `#s-kit` list — the rebuilt Gear tab's ALSO ON YOU list
> (`#gear-kit`) is now their one home, built from
> `src/browser/gearTab.js#gearKitRows` with copy in `GEAR_COPY.kit`. Same
> fields, same gates (`c.ward`, `c.mirror > 0`, `c.senses`, `c.foresight`,
> the live `c.timers["spell:reveal"]` record), same values — only the
> mount point moved.

`mazeworld.html`'s `#s-kit` list (built in `paint()`):

- **Shield row (SPELL-06):** `[c.ward.name, "${pool} hp left · ${rounds}
  rds"]` — was pool-only before this plan; now matches the map-HUD `ward`
  chip's own `{pool, remaining}` shape exactly, and (per `conditions.
  test.js`'s explicit `combat: null` proof) the chip already showed outside
  combat before this plan — SPELL-06 was purely a Hero-tab display gap.
- **Four new rows**, each gated on the SAME field the condition chip reads:
  `["Mirror Self", "{n} rds"]` (`c.mirror > 0`), `["Sense Presence", "till
  the fight ends"]` (`c.senses`), `["Sense Danger", "armed"]`
  (`c.foresight`), `["Map the Floor", "{n} sq"]` (a live
  `c.timers["spell:reveal"]` record, `phase === "effect" && left > 0`) —
  placed after the existing Regeneration row.

### The foe badges

`mazeworld.html#foeStatusBadges(f)`:

- **Weakened · N** — the existing `S.combat.weakened` combat-wide flag chip
  now reads the hero's own `c.timers["spell:weaken"]` record for its
  duration (`Weakened · ${wk.left}` when a live record exists, plain
  `"Weakened"` as a fallback for a legacy mid-fight state with no record).
- **Ice · N / Poison · N** — a foe's `f.dot` record (the shared
  `{left, dmg, by}` shape Ice and Poisoned Edge both write, `engine/
  combat.js`) now surfaces beside the existing Acid badge: `by === "ice"`
  reads "Ice", anything else (Poisoned Edge's `by: "poisonedEdge"`, and any
  future dot source) reads "Poison" — `by` is the only switch, matching the
  engine's own `by`-gated ice-freeze payoff (Plan 02).

### The spell-seen map tint (SPELL-05)

`src/browser/mapMarks.js#MAP_PALETTE.floorSpell` (`#4e5a6a`, a cool
"borrowed sight" tint distinct from `floor`/`floorDark`/`fog`) is mirrored
byte-identically into `mazeworld.html#draw()`'s own fallback palette
literal (used only if the ESM module bridge is somehow absent) so a missing
module never paints an undefined `fillStyle`. `draw()`'s floor-fill line
becomes `ctx.fillStyle = c.spellSeen ? P.floorSpell : (c.dark ? P.floorDark
: P.floor)` — `spellSeen` takes priority over `dark`, since the tint IS the
"this will re-fog" signal. `draw()` already re-reads `cell.seen`/
`cell.spellSeen` fresh every paint (Plan 04's own note), so the one expiry
sweep (`engine/maze.js#refogSpellSeen`) is picked up immediately with zero
shell-side coupling — the tinted cells simply repaint as ordinary fog (or
floor, if walked) the instant the sweep clears the flag.

### What stays for the cleanup milestone

Done in v1.6 — Phase 44 (DEAD-01/DEAD-02) deleted the classic `SPELLS` table duplicate, `castSpell()` and `rollGrimoire()`.

## Requirements map (Plan 05)

| Requirement | Landed in | Proof |
|---|---|---|
| SPELL-01 | Plans 01 (the 33-row niche/txt table) / 02 (the mechanics the niches promise) / 05 (the niche line rendered on both spell surfaces) | `test/unit/spell-table.test.js`; `test/unit/spell-mechanics.test.js`; `test/unit/grimoireViewModel.test.js`; `test/unit/combatMenu.test.js` |
| SPELL-02 | Plan 03 (the four new `conditionsOf` chips + Sense Presence's initiative effect) / Plan 05 (the chip copy + Hero-tab rows rendered) | `test/unit/spell-utility.test.js`; `test/unit/conditions.test.js`; `test/unit/shell-spells-40.test.js` |
| SPELL-03 | Plan 01 (every declared fixture divergence, measured and recorded) — Plan 02's zero-fixture-move offense mechanics and Plan 04's structural `spellSeen` carve-out are both additionally covered by SPELL-05 | `test/parity/FIXTURE-INVENTORY.md`'s Phase 40 sections; `npm test` full parity glob green throughout |
| SPELL-04 | Plan 01 (Lesser Summon, the Summoner's deterministic grant, `dealsDamage`'s damage-walk) | `test/unit/day-one-damage.test.js`; `test/unit/guaranteed-attack-spell.test.js` |
| SPELL-05 | Plan 01 (the rename) / Plan 04 (the re-fog provenance mechanism, the Key Decision, tolerant load, the harness carve-out) / Plan 05 (the spell-seen map tint) | `test/unit/map-reveal.test.js`; `test/unit/save-validation.test.js`; `test/unit/mapMarks.test.js`; `test/unit/shell-spells-40.test.js` |
| SPELL-06 | Plan 05 (the Hero-tab row gains rounds; `conditions.test.js`'s explicit `combat: null` proof that the map-HUD chip already showed outside combat) | `test/unit/conditions.test.js`; `test/unit/shell-spells-40.test.js` |
| SPELL-07 | Plan 03 (`readScroll`'s scribe gate aligned with `canCast`'s two checks; `scrollTooAdvanced`) | `test/unit/spell-utility.test.js`; `test/unit/cast-refusals.test.js` |
| ROADMAP SC-1: a player can tell two same-level spells solve different problems | Plan 01 (the niche map) + Plan 02 (the mechanics) | `test/unit/spell-table.test.js` (niche-map proof); `test/unit/spell-mechanics.test.js` |
| ROADMAP SC-2: every utility spell has an observable effect | Plan 03 (the chips + narration) | `test/unit/spell-utility.test.js`; `test/unit/conditions.test.js` |
| ROADMAP SC-3: every Magic User sub starts day one with a spell that deals damage | Plan 01 | `test/unit/day-one-damage.test.js` |
| ROADMAP SC-4: Map the Floor's window is legible and re-fogs only what it alone showed | Plan 04 (the mechanism) + Plan 05 (the map tint) | `test/unit/map-reveal.test.js`; `test/unit/mapMarks.test.js` |
| ROADMAP SC-5: a scroll's refusal is visible and names the level needed | Plan 03 | `test/unit/spell-utility.test.js` (the `readScroll` gate matrix, including `scrollTooAdvanced`) |
| ROADMAP SC-6: Shield's pool + rounds are visible on the Hero sheet and as a map-HUD chip, outside combat too | Plan 05 (the Hero-tab row) + Plan 03/31's pre-existing `conditionsOf` ward chip (no-combat proof added this plan) | `test/unit/conditions.test.js`; `test/unit/shell-spells-40.test.js` |

## Phase 75 (RULES-05, RULES-14) — Sense Presence & Bubble rules changes (2026-09-25)

Two combat-spell rules corrected against the game's own text, landed in Plan
06 of Phase 75 (`engine-rules-character-economy-grimoire-combat-bugs`). This
file is still never rewritten wholesale — the table above stays the Phase 40
record; only these two spells' RUNTIME rules move again, here.

### RULES-05: Sense Presence wins initiative outright

Phase 40 (see "Sense Presence's rules change" above) waived Sense Presence's
FORCED foe-first clause but left the roll itself a fair coin-flip — a Court
Mage with senses up could still lose the d20 pair and go second, which
contradicted the spell's own "nothing gets the jump on you" text (a device
report: a depth-8 Court Mage with senses up lost initiative 2 vs 17 in the
dark and died). `engine/combat.js#resolveInitiative` now joins `c.senses` to
the unconditional "you go first" branch, beside Foresight and Acute Hearing:
`foreseen || acuteHearing || c.senses`. The two initiative d20s are still
always drawn — this is a branch change, never a draw-count change, so no
fixture moves (no replay fixture ever casts Sense Presence). The `why`
chain's order is unchanged (Foresight, then Acute Hearing, then senses), so
a foreseen-AND-sensed hero still reports `why: "foreseen"`.

The dark rules also honour senses now, matching the spell's own "full skill
in the dark" text: `fight()`'s `combatInDark` push ("You cannot see what you
are fighting") and `playerStrike`'s dark no-crit clause both gain a
`&& !c.senses` term, mirroring `derived.js#toHit`'s existing dark-cap waiver
(unchanged by this phase). `narrationLines.js#initiativeVerdictText`'s
`"senses"` case now reads "You felt them coming. You go first." on both the
Oracle and the rail/fight log.

### RULES-14: Bubble is a one-shot mirror, not a bigger Shield

Bubble used to be strictly better than Shield (100 hp for 12 rounds, PLUS a
reflect) — the user's own verdict. It is now a one-shot mirror: the NEXT
blow that reaches the caster's damage pipeline (a foe swing, a pursuit
strike, or a foe ability bolt — everything `applyFoeDamageToPlayer` already
sees) is reflected in FULL at its attacker through `damageFoe` (`kind:
"reflect"`) — the caster takes none of it — then the ward pops into a plain
25 hp pool (`popPool`, the user's recommended half-of-Shield value) for the
REST of that round only. There is no more 12-round duration: an armed
mirror's `rounds` is `null` and never ticks; the popped pool's `rounds` is
always `1`, so `foeTurn`'s per-foeTurn tail tick always fades it at the end
of the SAME foe turn it popped in (`wardFaded`) — "a small soak pool for
that round," literally.

`content/spells.js`'s Bubble row: `{ kind: "ward", mirror: true, popPool: 25
}` — the old `pool`/`rounds`/`reflect` keys are gone (greenfield). Shield is
completely unchanged (`{ pool: 50, rounds: 5 }`, no reflect key ever). The
old "reflect the ward's soaked SHARE" branch in `applyFoeDamageToPlayer` is
deleted outright — the new mirror check sits at the very TOP of the
pipeline, ahead of Hardiness, the Fridgian hide, the Pendant of Fortitude's
`halfNext`, and Brace, so the FULL blow reflects and none of those
single-charge buffers is spent on a mirrored blow. A reflect that kills the
attacker still runs `killFoe` and the swing loop continues to the next foe,
exactly as the old reflect-kill contract did.

`c.ward`'s shape while armed: `{ name: "Bubble", mirror: true, pool: 0,
popPool: 25, rounds: null }`. After the pop: `{ name: "Bubble", pool: 25,
rounds: 1 }` — from there it behaves exactly like Shield's own absorb/
shatter path (`wardAbsorbed`/`wardShattered`). `engine/derived.js#
conditionsOf`'s ward chip now also fires for an armed mirror (`pool > 0 ||
mirror`), carrying `mirror: true` and no `remaining` (rounds is `null`); the
shell's chip reads the ward's own name (falling back to "Shield") and shows
"next hit" for an armed mirror instead of the pool/rounds text.
`engine/magic.js`'s Earthquake self-damage check (`if (!c.ward)`) is
unchanged — it still counts an armed OR popped Bubble as "warded," since
`c.ward` is truthy in both states.

An old save whose `c.ward` still carries `{ reflect: true, ... }`
(pre-Phase-75) tolerant-loads as the armed mirror
(`engine/saveState.js#sanitizeWard`, `popPool` read from the LIVE SPELLS
Bubble row); any other ward simply loses a stray `reflect` key. Measured: no
parity fixture ever casts Bubble or Shield (`test/parity/
FIXTURE-INVENTORY.md`'s roster never reaches a `wardRaised` event), so this
phase moves zero fixtures. A 200-seed bot readout (Bubble is the bot's
ward-opener) is recorded before/after in `tools/readouts/75-06-before.txt`
/ `tools/readouts/75-06-after.txt`.

**Phase 75.1 handoff:** RULES-10's fumbled Bubble scroll can land the spell
on a FOE instead of the caster. The mirror lives only on the HERO's own
damage pipeline (`applyFoeDamageToPlayer`) — Phase 75.1 must add a matching
foe-side mirror check to `engine/foeDamage.js#damageFoe` (or an equivalent
foe-ward seam) before a fumbled Bubble can protect a foe the same way.

### Summoner (Phase 75, RULES-03)

Two Phase 75 changes together replace the Summoner's original trade-off
(the retired offense gate, see the superseded lines above and in the
scroll-rule section below):

- **The offense gate is removed.** A level-1 Summoner rolls and casts
  offense normally — `MU_CHART.Summoner` carries no `gate` key at all, so
  `schoolGate("Summoner", "offense")` reads the default `1`.
- **Its own healing spells restore half.** Any healing-school spell the
  Summoner ITSELF casts (Heal, Major Heal, and its own Regeneration tick,
  each round) restores `floor(amount * 0.5)`, minimum 1 — applied LAST,
  after the Cleric's +3 bonus and a heal2x race's doubling. This is a
  chart data flag (`MU_CHART.Summoner.healMul: 0.5`), read by
  `engine/derived.js#healMulFor`/`applyCasterHealMul`, never a name check.
  Potions, staff heals, and a heal cast by anyone else ON the Summoner are
  unaffected; the summon backfire (one Summon in eight turns turns on its
  caster) stays. The Oracle and rail show the true, halved amount — the
  `healed`/`regenerated` events carry an additive `halved: true` only when
  the amount actually changed. No parity fixture moves (the only
  `magic#heal` fixture is cast by a Wizard); measured, with a 200-seed
  readout before/after in `tools/readouts/75-10-before.txt` /
  `tools/readouts/75-10-after.txt`.

The two Phase 40 lines above stating "the Summoner's offense gate stays 3"
and "Summoner+Freeze (offense gate 3)" are **superseded by Phase 75** —
kept as history of the Phase 40 design, not current behavior.

## Phase 75.3 (RULES-18): control at depth

**Superseded for every SPELL by Phase 90 plan 04** (user 2026-09-30: "rising resists ... should apply to ALL spells ... remove the floor-12 special effects only"): no spell rolls the control resist or keeps a hold, a cap or a three-round timer any more; every spell rolls the one depth-rising resist. Read the "Phase 90: one resist, no floor-12 extras" section at the end of this file for the current rule. Only the Bard's songs still use the machinery below (Phase 91, IDENT-17); the item half was superseded by Phase 89 plan 08. What follows is kept as history.

User ruling 2026-09-25 (75.3-CONTEXT): from past floor 12, foes increasingly
shrug off control, and the "forever" controls stop being forever. The dial
is `CONTROL_AT_DEPTH` in `engine/difficulty.js`
(`{ kneeDepth: 12, resistPerDepth: 1, resistCap: 15, holdRounds: 3 }`).

- **The knee.** Floors 1-12 are exactly as before: no resist roll, no hold,
  no draw. Floor 13 is the first floor where anything changes.
- **The resist.** Past the knee, every control rolls a roll-high d20 for
  the foe (`engine/derived.js#controlResistCheck`) whose winning faces grow
  one per floor past the knee, from the start value (`resistPerDepth: 1`),
  capped at `resistCap` and, structurally, at 19 (a d20's top face always
  lands the control). The roll comes from its own derived stream, so the
  main dice never move because of it. A foe that shakes a control off gets
  an Oracle line (`controlResisted`, printing the roll and its range), a
  rail line and an **Unmoved** chip. The intelligence resist still runs
  first (since quick 260927-rsx, every foe rolls it: see below) and is a
  separate check.
- **The hold.** Past the knee, a control that used to kill, remove or last
  the whole fight holds the foe for `holdRounds` (three) rounds instead:
  a Freeze or Ice payoff (held frozen), Petrify and the stone items (held as
  stone), Stupidity (held stupid). A held foe skips its turns and shows a
  **Held** chip; the cast's own dispatch spends the first held turn. A
  Freeze blow that already drops the foe to 0 hp still kills, at any depth.
  A stone-held foe that is later killed pays like any other kill; a floor
  1-12 Petrify still removes the foe with no spoils.
- **Timed instead of forever.** Blind lasts three rounds past the knee (the
  existing `blindFor` countdown); the Birch Staff's freeze and the Cedar
  Staff's gas sleep three rounds, not 99; the Walnut Staff's weaken runs on
  a three-round `spell:weaken` timer instead of the whole fight.
- **Short controls keep their dice.** Doze, Stun, Noxious Vapor's sleep and
  Insane's sleep face keep their rolled durations; they only gain the
  resist. Shrink resists per foe and halves the rest.
- **One roll for the room.** Weaken (the spell, a Joiner's, and the Walnut
  Staff) rolls once against the foe it was aimed at; a resist marks every
  live foe Unmoved and weakens nobody.

Which effects are in (the control audit, 75.3-04-PLAN.md): C1 Freeze, C2 a
Joiner's Freeze, C3 Ice's last tick, C4 the Birch Staff, C5 Petrify, C6 the
Oak Staff and Amulet of Stone, C7 Doze, C8 Stun, C9 a Joiner's Doze / Stun,
C10 Noxious Vapor's sleep, C11 Insane's sleep face, C12 the Cedar Staff,
C13 the Bard's Lullaby and Thunder, C14 Weaken, C15 a Joiner's Weaken, C16
the Walnut Staff, C17 Stupidity, C18 Blind, C19 Shrink. Out: X1 Death (an
instant kill), X2 Vapor's and Insane's kill / flee faces (chaos-table
outcomes), X3 Turn Walking Dead and Plane Gate (answers, not control), X4
the Bard's level-5 song, X5 Pommel Strike and Dirty Trick, X6 Hamstring,
Mark, Acid and Poisoned Edge, X7 foe abilities on the hero.

Texts: Freeze, Ice, Stupidity, Blind and Petrify, and the Birch, Oak and
Cedar staves and the Amulet of Stone, each say what changes past floor 12
and name the three rounds (the Walnut Staff's text never promised a
duration, so it is unchanged; its timed weaken shows in play as the
`weakenFaded` line) (`test/unit/control-spells-depth.test.js` ties
the words to the dial; the Phase 40 txt tables above record the texts as
they were then, without the clause). The resist itself is not written into every text;
the Oracle, the rail and the Unmoved chip teach it in play. The bot plays
the new rules: past the knee it scores Freeze as a disable, not a kill
(`tools/lib/tuning-bot.mjs#chooseSpell`).

## Out of scope / next

- Bot casting tactics by niche (choosing WHICH spell to cast for a given
  situation) — landed (Phase 42): `chooseSpell` now reads `sp.niche` for a
  DOT-vs-toughness skip and a burst-finish score, on top of the kind-generic
  scoring this phase already shipped; see `docs/CLASS-PASS.md`
  `### Phase 42 tactics (BAL-01 second half)`.
- Darkness/light interplay with the reveal window (Phase 41's render-time
  `seen` filter) — orthogonal to this phase's `spellSeen` provenance model,
  documented in Plan 04's own "Phase 41 note" above.
- Spell cooldowns / a mana model — not in v1.5; spells stay per-day
  slot-casts as canon (40-CONTEXT.md "Deferred Ideas").
- (done — see above)

## Every spell cast on a foe can be resisted (quick 260927-rsx, user ruling 2026-09-27)

"Every spell cast on an enemy should have a chance to be resisted based on
their intelligence. High intelligence is more chance to resist." Every foe a
spell targets rolls a d20 and resists on the top `max(1, round(intel / 2))`
faces: intel 1–2 on 20 (5%), 3 on 19–20, 6 on 18–20, 10 on 16–20 (25%), 16
on 13–20 (40%). No intel-12 gate, and thrown damage spells are included. A
resisted spell does nothing to that foe; the turn and the charge are spent.
A room spell rolls per foe (a Weaken lands on the foes that did not resist).
The hero, a Joiner, a scroll and the foe-targeted staves and amulet all
follow it; self and ally spells (Heal, Shield, Bubble, Strength, Regenerate,
Map the Floor, Sense Danger, Sense Presence, Mirror Self, the summons) never
roll. A foe casting at the HERO used canon p.25 (intel 12+ only) until quick
260928-hrs (user ruling 2026-09-28, "Use the same half-intel scale for heroes
now"): the hero now resists a foe's bolt, drain or debuff on the same scale,
every hero rolling (`engine/derived.js#resistRoll`, one helper for both
sides). Since quick 260928-nrf (user ruling 2026-09-28, "Yes, same scale") a
Joiner a foe's bolt or drain lands on resists the same way, on its own intel
(`engine/foeAbilities.js#memberResist`; see the section at the end). Every
roll, either way, is an Oracle line. The foe card and each
foe-targeted spell row state the range. See docs/ROLL-LEDGER.md for the site,
the stream and the draw order.

## Freeze deals its damage, then freezes 1d4 rounds (user rulings 2026-09-28)

The user ruled: "freeze should never kill outright. It should deal its damage
and freeze an enemy for 1d4 rounds." Then: "if it hits and resists, deal
damage, but no freeze." Folded into plan 79.2-01, before its START
measurement.

- **A hit deals its damage** (d6 × the level multiplier), as before. If that
  kills the foe, it is a normal kill: no frozen-solid, at any depth.
- **A survivor is frozen for 1d4 rounds** (it skips that many turns, and it
  is easier to hit meanwhile), then it thaws. The d4 is drawn right after the
  damage.
- **Resists.** The foe's intel resist (2026-09-27) is rolled after the damage,
  never before the throw, and a resist stops only the freeze: the damage
  stays. Past floor 12 the RULES-18 control resist also applies to the
  freeze. A miss rolls no resist.
- **Everywhere Freeze is cast**: the hero, a scroll's free cast, a Joiner's
  cast (`combat.js#allyCast`) and the Birch Staff's freeze power
  (`items.js`, no to-hit and no damage: each foe it reaches rolls its resists
  and is frozen for its own d4). One shared tail, `combat.js#freezeFoe`;
  the hold die is `FREEZE_HOLD_DIE` (4).
- **The bot** (`tools/lib/tuning-bot.mjs#chooseSpell`) scores Freeze in the
  DISABLE tier (Stun's score) at every depth; its old KILL tier below the
  knee is gone with the rule.
- **Text.** Freeze's `txt` is quick 260928-tsx's ("…for d6 damage; unless it
  resists, a survivor is frozen for d4 rounds…"). The Birch Staff's now
  reads "freezes up to 2 squares of opponents for d4 rounds apiece, unless
  they resist; then they are just cold and angry".

Row 4 of the table above ("frozen solid on a hit") and the Phase 75.3
section's Freeze rows are history. See docs/ROLL-LEDGER.md for the draw order.

## Spell damage adds level² (quick 260928-sq2, user ruling 2026-09-28)

The user asked: "What if we square spell damage just like we do with weapons
damage. Having every spell be resistable then helps offset that if it's too
powerful." They chose **dice + level²** and **each foe gets it**.

- **The formula.** An offensive spell's damage is its dice (plus any flat
  bonus in its `dmg`) + the CASTER's level squared, the same `levelSq` term a
  weapon strike gets (`engine/derived.js#spellLevelSq`, beside
  `weaponDamageTerms`). It replaces canon p.26's × max(1, caster level −
  spell level) for damage. A thrown spell still adds a `spellDmg` item bonus
  after it; the result then passes through `spellDamageFor` (the MU spell
  power dial), `afraidDamage` and `damageFoe` exactly as before.
- **Who the caster is.** The hero (a cast or a scroll's free cast) uses
  `c.level`; a Joiner (`combat.js#allyCast`) uses its own level (`ally.lvl`,
  through its member view).
- **Each foe gets it, once per cast.** Freeze, Fireball and Mangle: the one
  foe hit. Lightning: each foe its own throw hits. Earthquake: its one roll +
  level² to every foe. Fireballs: the first bolt to strike each foe adds
  level²; later bolts on the same foe are their dice alone. Acid and Ice
  (damage over time): the first tick adds level² (stored on the record as
  `levelSq`, spent by that tick); later ticks are their dice alone.
- **What keeps the p.26 multiplier.** Everything that is not damage: Stun's
  reach (d6 × max(1, level − spell level) foes). Freeze's hold is its own d4
  (`FREEZE_HOLD_DIE`).
- **What never adds level².** Heals (Heal, Major Heal, Regeneration);
  Earthquake's backlash on the caster (half the roll alone); an Apprentice's
  backfire (half the dice); a fumbled scroll's hurt to the reader and the
  reader's side (`engine/scrollFumble.js` keeps its dice × the p.26
  multiplier, since that damage is self-inflicted).
- **Not a spell's damage.** The Pine Staff's fireballs are item damage
  (`kind: "item"`, soakable, no caster identity, a free action), so they add
  no level²; Noxious Vapor deals no damage (it kills or sleeps).
- **No new draw.** The level² is arithmetic on the rolled dice; the draw
  order is unchanged.
- **Text.** Each damage spell's `txt` now says "<dice> + your level²
  damage" (an area spell's "… apiece" or "once to each foe struck", a DOT's
  "the first round adds your level²"). The Oracle's hit line reads "(the
  roll +N, for your level)" from the event's `levelSq`, where it used to
  print "×mult". test/unit/authored-ranges.test.js section 9 pins every
  text against the engine.

The "d6 × the level multiplier" wording in the Freeze section above is
history: Freeze's damage is now d6 + level².

## Joiners resist foe spells and abilities (quick 260928-nrf, user ruling 2026-09-28)

Asked whether Joiners should resist foe spells and abilities on the same
half-intel scale as the hero and the foes, the user said "Yes, same scale."

- **Which effects.** A foe's bolt or drain that `pickFoeTarget` aims at a
  live Joiner (a debuff is hero-only and never targets a Joiner; heals and
  summons are never resisted by anyone). Every foe spell and ability is a
  content/foe-abilities.js kit entry of one of those five kinds.
- **The roll.** `resistRoll(rng, intel)` on the Joiner's OWN intel (its
  persistent sheet; a sheet with no intel reads 0, one face): resisted on the
  top `resistFaces(intel) = max(1, round(intel / 2))` faces of a d20. Intel
  1–2 resists on 20 (5%), 6 on 18–20 (15%), 10 on 16–20 (25%), 16 on 13–20
  (40%), 20 on 11–20 (50%). The hero's intel never reaches a Joiner's roll.
- **What a resist blocks.** Everything the hero's does: no damage, and no
  drain heal for the foe. The turn is still the foe's.
- **The draw.** One main-rng d20 in the hero's slot: after the ability gate's
  d6 and the target pick, before the damage dice. A Joiner-targeted bolt or
  drain draws one more d20 than it did.
- **The lines.** `memberResisted`: "Ada resists Krupke's spell. 16 vs 16–20
  (intel 10). Somebody on your side was paying attention." (rail: "Ada
  resists Krupke's spell (16 vs 16–20, intel 10).").
  `memberResistFailed`: "Ada fails to resist Krupke's spell. 12 vs 16–20
  (intel 10). Shrugging it off is harder than it looks." (rail: "Krupke gets
  through — Ada fails to resist (12 vs 16–20, intel 10).").

See docs/ROLL-LEDGER.md (`[resist:member-intel]`) for the site and the draw
order.

## Phase 90: Strength (SPELL-09) and spell-sourced timed effects

Report #8: "Strength spell says +d10 damage until tomorrow. But casting it actually grants you
hit points instead." The user's 2026-09-30 ruling (docs/SPELL-AUDIT.md "## Rulings", Q1 A):
Strength is **an extra d10 on every damage roll the hero makes, for 100 squares from the cast,
with no hit points**, and casting it again restarts the 100.

### The rule

- **The record.** Casting Strength starts one `c.timers["spell:Strength"]` squares record of
  100 (`{ cadence: "squares", left: 100, phase: "effect" }`, no cooldown) through
  `combat.js#startSpellEffect`, and pushes `strengthCast { squares, restarted }`. A recast
  while it is live overwrites the record (`restarted: true`): never two records, never two dice.
  The cast never touches `maxWP` or `wp` and rolls nothing.
- **The clock.** 100 squares walked from the cast, whenever it is cast. Making camp and a new day
  neither end nor shorten it (`movement.js#newDay` no longer touches it); the step that walks the
  100th square deletes the record and pushes `spellEffectFaded { spell: "Strength", kind:
  "strength" }` before that step's encounter events. A 2-square water step with 1 left ends it
  with no negative count.
- **The reach (Q1 A).** Each time the hero deals damage, one d10 joins that roll
  (`derived.js#strengthRoll`, a derived stream: docs/ROLL-LEDGER.md "Phase 90 plan 03"): every
  weapon blow (both blows of a double strike, Sweep, Riposte), a thrown spell's hit, each foe
  Lightning reaches, Earthquake's one roll, each Fireballs bolt. A damage-over-time tick (Acid, Ice)
  gets none. It is added before the Sorcerer's cap of 9, the floor of 1, Afraid halving and the
  damage multiplier. The hero sheet's damage range (`weaponDamageRange`) grows by 1 to 10 while it
  is live; the chip reads Strength with its squares left; the Gear tab's kit row reads the same.
- **Three separate sources.** The Strength spell, the Strength potion (+8 for 25 squares,
  `potionMight`) and the phobia rage (`c.might`, a flat d10 till the day ends) are independent and
  all add at once. `c.might` is only the rage's now.
- **The retired doubling.** The old spell doubled maximum and current hit points
  (`c.strengthBoost`). That field is gone from the hero, from a fumbled scroll's foe (a fumbled
  Strength now only gives the foe a flat d10, `f.might`, on each landed blow for the fight), and
  from the chip tables. A save carrying it loads tolerantly: `saveState.js` subtracts it from
  `maxWP` (never below 1), clamps `wp`, and drops the field, for the hero and for every foe of a
  saved fight; a save without it is byte-identical after load.

### Spell-sourced timed effects (the mechanism the SPELL-10 slate reuses)

- **`act` on a SPELLS row.** A row carrying `act: { kind, effect, ... }` is a spell-sourced
  timed effect (Strength: `{ kind: "strength", effect: 100, dice: { n: 1, sides: 10, bonus: 0 } }`).
  `derived.js#SPELL_ACT_OF` is the frozen map of spell name to `act`.
- **One starter.** `combat.js#startSpellEffect(sheet, sp, events, opts)` starts the `spell:<n>`
  squares record (`opts.squares` overrides `act.effect`, for the school bonus stretch); it pushes
  nothing. It serves the hero now and a Joiner's own sheet and the slate later.
- **One reader.** `derived.js#liveItemEffects` also returns live `spell:<name>` records whose
  name has an `act`, each entry tagged `source: "spell"` (item entries `source: "item"`), so
  `eff`, `itemEffectActive`, `critWardOf` and `conditionsOf` read them with no spell-specific
  code. A `spell:` record with no `act` (`spell:weaken`, `spell:reveal`) is ignored. Phase 88's
  `endSourceEffects` walks `item:` ids only and never touches a spell record.
- **One expiry line.** `items.js#narrateTimerTransitions` pushes `spellEffectFaded { spell, kind,
  member? }` when such a record runs out; the Oracle and rail name the spell and say what stops per
  kind (Strength: the extra d10 goes), and a kind with no clause just wears off.
- Pins: `test/unit/strength-spell.test.js` and `test/unit/spell-effect-records.test.js`.

## Phase 90: one resist, no floor-12 extras; Petrify, Blind, Stupidity (SPELL-12, plan 90-04)

The control axis above (a past-floor-12 control resist, a three-round hold or cap on a landed
control) is gone for every spell. User 2026-09-30, at the Phase 89 checkpoint: "rising resists on
higher floors should apply to ALL spells and spell-like effects (staves included) ... remove the
floor-12 special effects only." Every spell a foe can resist rolls ONE resist, rising with depth
(`derived.js#risingResistFaces`, rolled by `combat.js#foeResistsSpell` = `foeResistsEffect`):
the foe's half-intelligence faces up to floor 12, more each floor after it (intelligence 10:
16–20 up to floor 12, 15–20 at floor 13, 10–20 at floor 20). A landed spell is its floor-1 effect
at every depth. The combat menu's resist hint and the foe card show the same range.

- **Petrify** (level 5): turns one foe to stone and it dies, both lives of a kill-twice foe; the
  foe may still resist; you get the foe's experience (Q2 A) and no coin, treasure or cooking.
- **Stupidity** (level 2): the foe you picked (Q7 A) drops to intelligence 1 for the fight, so it
  resists on a 20 on a d20 (more as you go deeper); it keeps acting and is no easier to hit.
- **Blind** (level 3): the foe hits only on its die's top face and never lands a critical, for the
  fight at every depth. A flagged assumption for the user: the cap is applied after an insult, so
  an insulted party still faces only the top face.
- **Ice** kept its dot and its freeze-solid payoff at every depth until 90-05 reworked it (below).

## Phase 90: Doze and Stun swapped, Ice freezes the room (SPELL-11, SPELL-12, plan 90-05)

User 2026-09-30 (SPELL-11): "Doze sleeps d4 foes for d4 rounds and a hit wakes a dozing foe; Stun
holds one foe for d4 rounds and a hit does not end it." The rulings Q3 A, Q4 A and Q5 A
(docs/SPELL-AUDIT.md "## Rulings") fix the branches. Each effect lives in a shared tail in
`engine/combat.js`, so the hero, a scroll and a Joiner cast it the same way.

- **Doze** (level 1, `dozeFoes`): sleeps **exactly d4 foes** (no level multiplier), your target
  first and then the other live foes in order; each reached foe rolls the one depth-rising resist,
  and one that fails it sleeps **its own d4 rounds** (a longer sleep it already had stands) and is
  marked `dozing`. **A hit wakes a dozing foe**: the first damage it takes (a blow, a spell, a burn,
  from anyone) ends its sleep at once (`foeWoke`), unless the hit killed it. Only Doze's sleep wakes
  on a hit (Q3 A); Noxious Vapor's, Insane's nap, a staff's gas and a song stay plain sleeps. A
  cast that sleeps nobody says so in one line (`dozeFailed`). The foe chip reads **Dozing** (a hit
  wakes it) instead of Asleep.
- **Stun** (level 1, `stunFoe`): holds **one foe**, the one you picked, for **d4 rounds** after its
  one resist. It is the existing hold (`holdFoe`, kind `stunned`): the foe skips that many of its
  turns, is struck on at least 5 winning faces, and **a hit does not end the hold**. A new hold never
  shortens a longer one still running. The foe chip reads **Stunned · N**.
- **Ice** (level 3): see "Ice — the area freeze" above.
- **Scroll fumbles.** Doze and Stun stay `out` asleep d4 rows (a fumbled one costs the reader up
  to d4 turns); Ice is an area damage row.

A flagged assumption for the user (probe SPELL-11): "a hit wakes it" means ANY damage the dozing foe
takes through the damage seam, whoever deals it; "d4 foes" starts at the hero's target; each sleeper
rolls its own d4; Stun's "one foe" is the hero's current target.

## Phase 90: Lesser Summon and Phantom Host removed, Summon from level 1, Wizards lose Illusion, the school-gate guard (SPELL-12, SPELL-10, plan 90-06)

User 2026-09-30 (SPELL-12): "Lesser Summon is removed and the Summoner casts the level-2 Summon from
level 1 ... Phantom Host is removed", and "Illusion is the Illusionist's alone (rulebook p.17): Wizards
lose the Illusion school; the Illusionist and the Apprentice keep it." SPELL-10 asks that every new
Special and Illusion spell is born gated, so a sub-class or race that cannot cast a school is never
dealt, offered, able to copy or able to cast it.

- **The list.** `SPELLS` holds 31 rows (33 less Lesser Summon and Phantom Host); `SCROLL_FUMBLE` has
  the same 31 names. Lightning, Regeneration, Mangle and Death sit one row earlier (they keep their
  relative order; nothing indexes past row 26 any more, every test and tool looks a spell up by name).
  `roll: "derived"` stays as the zero-draw chargen path for the rows the next plans append; no row
  uses it now. Nothing in `engine/` or `content/` names a removed spell except the save load's
  rename table (`engine/saveState.js#RETIRED_SPELL_NAMES`).
- **The Summoner's exception is data.** `content/spell-level-overrides.js` is
  `{ Summoner: { Summon: 1 } }`, read only through `derived.js#spellLevelFor`: a level-1 Summoner's
  Summon passes `canCast` and every other sub-class's still needs level 2. The summon rules are
  unchanged (a Summoner's ally is level + 1, its rounds are doubled, one cast in eight backfires). The
  Grimoire row and the combat menu print the effective level (L1 for the Summoner), and the identity
  footer's override line generates itself ("Summon castable from level 1 (level 2 for everyone else)").
  The Summoner's day-one book holds Summon (the unchanged must-have grant); a summon never counts as
  damage (`dealsDamage`), so its day-one damage guarantee comes from the same top-up as every other
  sub-class's.
- **The Wizard's chart.** `MU_CHART.Wizard.illusion` is `null`: a Wizard never learns Mirror Self or
  any later Illusion spell (its generated footer reads "never learns illusion spells"). The
  Illusionist and the Apprentice keep the school; an Apprentice revealed as a Wizard drops its
  Illusion spells, as an Illusionist keeps them.
- **`canCast` re-checks the school.** `derived.js#canCast` returns false for a spell whose school a
  Magic User sub-class can never learn (`schoolClosed`: a sub-class with no chart row is not a Magic
  User and is not touched), so an old or tampered book never casts or lists one. `castSpell` names
  the refusal `spellSchoolLocked` with `forbidden: true` (no level opens it), the Grimoire row reads
  "Not your school", and the combat menu never lists it.
- **The tolerant load.** `saveState.js#migrateSpellNames` runs for the hero, every Joiner sheet and a
  pending Joiner, in both load chains: "Lesser Summon" becomes "Summon" (one copy, at the first one's
  place), "Phantom Host" and any name no `SPELLS` row carries are dropped, and a spell whose school the
  sheet's sub-class can never learn is dropped; the surviving names keep their saved order; a book
  with none of these is untouched. Silent: no event, no rng.
- **The guard.** `test/unit/school-gates.test.js` sweeps every Magic User sub-class over seeds and
  levels 1-5 through every path that hands out a spell: chargen `rollGrimoire` (hero, the Wizard's
  day-one pool, a Joiner's book, `meetJoiner` into `resolveJoiner`), the Sorcerer's level-up picks and
  the Apprentice reveal, `findGrimoire`, `readScroll`'s copy into the book (a store or loot scroll
  holds no spell until it is read, so this is the one path a scroll hands a spell to a book) and the
  combat spell menu over a book holding every spell. It iterates `SPELLS`, never a list of names, so it
  keeps proving the gates as the ten slate spells are appended. One-shot scroll READING stays RULES-10
  (anyone may try; the scroll pool is every row, the new schools included): only the copy obeys the
  gates. A content guard fails when a spell's school is missing from any `MU_CHART` row, when a chart
  row lacks one of the six schools, or when an override names an unknown sub-class, spell or a school
  that sub-class cannot learn (its own negative cases prove it can fail).

**Fixtures this moved** (measured, declared and regenerated alone; docs in
test/parity/FIXTURE-INVENTORY.md "Phase 90 plan 06"): chargen draws fewer main-rng values for a
Wizard (39 to 36), an Illusionist (34 to 33) and an Apprentice (38 to 37), so chargen seeds 7, 8 and
24 move and every parity scenario on such a seed was re-picked or re-declared; a scroll's pick comes
from 31 rows, which moved four bot pins.


## Phase 90: Open/Lock, Fly, Enchant Character and Speed of Sound (SPELL-10, plan 90-07)

User 2026-09-30 (SPELL-10): the slate in `90-SPELL-SLATE-DRAFT.md` is "accepted as drafted", and Q6 A
(`docs/SPELL-AUDIT.md` Rulings) stretches the new spells by the school bonus: each point adds +10 squares to
a square-timed spell. These are the four Special spells that buff and travel, built on 90-03's
spell-sourced timed effect (an `act` record on the SPELLS row, one `spell:<name>` squares record, read back
through `derived.js#liveItemEffects`).

- **The rows.** Four rows are appended after Death (35 rows), each `s: "special"`, `kind: "timed"`, with an
  `act` record, `stretch: "squares"`, `roll: "derived"` and `combatOnly: false` (castable anywhere):

  | Spell | Lvl | `act` | Window | Niche |
  |---|---|---|---|---|
  | Open/Lock | 1 | `{ kind: "unlock", effect: 100 }` | 100 squares | utility |
  | Fly | 2 | `{ kind: "fly", effect: 30 }` | 30 squares | utility |
  | Enchant Character | 4 | `{ kind: "enchant", effect: 50, eff: { toHit: 2, foeToHit: -2, critWard: 1 } }` | 50 squares | buff |
  | Speed of Sound | 5 | `{ kind: "haste", effect: 50, eff: { first: 1 } }` | 50 squares | buff |

  `utility` is a new niche (`NICHE_LABELS.utility`, the orchestrator's default for Open/Lock and Fly). Each
  text starts with its niche label and says "+10 squares per school bonus point".
- **The school stretch.** `derived.js#SCHOOL_STRETCH_SQUARES` is 10 (Q6 A; it would be 1 under B).
  `spellEffectSquares(sub, sp)` is `sp.act.effect` plus, for a `stretch: "squares"` row, the chart's bonus
  for the spell's school times the step; `spellEffectRounds(sub, sp, base)` is the round-timed twin (+1 round
  a point; 90-08 uses it). A Wizard or Apprentice (+0) gets the base window, a Sorcerer or Summoner (+1) one
  step more (Fly 40), an Illusionist (+4) four steps more (Fly 70, Open/Lock 140, Enchant Character and
  Speed of Sound 90). A scroll's free cast by a non-Magic-User has no chart row, so it gets the base.
  `schoolBonus` is read for the first time outside a thrown spell, so the identity footer's "the engine
  reads schoolBonus only in the thrown-spell branches" test now counts two more readers in `derived.js`;
  whether a footer line states the Special stretch is Phase 91's (91-02) call.
- **The cast.** `magic.js#castSpell`'s `timed` branch starts the stretched record through
  `combat.js#startSpellEffect` (an overwrite: a recast restarts the window, never stacks, and the
  `c.timers` key order is unchanged, so chips keep their order) and pushes `spellEffectStarted { spell, kind,
  squares, restarted }`. `timed` is in `SPELL_SELF_KINDS`: never resisted. No draw.
- **Open/Lock (wiring E).** `encounters.js#openChest` checks, right after the Pilfer branch, for a live
  `unlock` effect: the chest opens with no lock roll and no lock draw (the first draw is the gold d10), for
  any class, lockpicks or none; `spell:Open/Lock` is deleted and `chestOpened { reason: "openLock" }` is
  pushed. A Pilfer's free open is checked first and never spends it. A window that meets no chest fades
  with its line.
- **Fly.** The `fly` kind is the Cloak of Flying's: `isFlying`, `moveCost` and the climb and gorge branch
  of `movement.js#move` already read it, so a climb or gorge tile is flown over with no roll and no card
  (`flownOver`) and water costs one square. The arrow pad and tap-to-move both dispatch the same `move`
  action, so both work (pinned both ways). It does nothing in a fight. A live Cloak of Flying and the spell
  are two records: taking the cloak off ends only the item record (`endSourceEffects` walks `item:` ids) and
  the hero keeps flying on the spell.
- **Enchant Character.** `toHit` reads `eff(c, "toHit")` (+2), `foeToHitVs` reads `eff(body, "foeToHit")`
  (-2 faces for the foe) and `critWardOf` names "Enchant Character", so a foe's top-face roll against the
  hero is an ordinary hit (the Oracle line names the spell, not a cloak). With a Cloak of Strength both
  ward crits and either alone does.
- **Speed of Sound.** `playerStrike` already reads `haste` (two blows; a Speed potion gives two, not
  three). `combat.js#resolveInitiative` reads the new `first` payload through `eff`: a live Speed of Sound
  joins foresight and senses in the unconditional "you go first" branch AND waives every forced foe-first
  rule (Samurai, a slow race, a Knight facing a big foe, a Court Mage). `why` is "speed" when it decided
  (foresight and Acute Hearing name themselves first). The two initiative d20s are still always drawn.
- **Scrolls and fumbles.** The four join the scroll pool at their level (`readScroll`'s
  `SPELLS.filter(sp => sp.lvl <= min(5, depth + 1))`: 17, 25, 31 and 35 spells at depths 1 to 4+). A
  fumbled Open/Lock, Fly or Enchant Character is `wasted`; a fumbled Speed of Sound is the new helpful
  effect `frenzy`: the target foe swings twice a turn for the fight (`f.frenzied`, the flag the Insane
  table's 5 sets).
- **The gates.** Nothing extra: each row carries `s: "special"`, so only sub-classes whose MU_CHART Special
  school is open (Wizard, Sorcerer, Illusionist, Summoner, Apprentice) learn, are dealt, copy or cast them;
  `test/unit/school-gates.test.js` iterates SPELLS and passes unchanged.
- **The chips and words.** `spellEffectStarted` has an Oracle line and a rail twin per kind
  (`eventNarration.js#SPELL_START`, `narrationLines.js`), the fade clauses name what stops, `chestOpened` has
  its `openLock` reason, `combatJoined`'s `why: "speed"` its own verdict and `fumbleOnFoe` its `frenzy` line.
  Open/Lock (`unlock`) and Enchanted (`enchant`) have chips of their own; Fly reads as Flying and Speed of
  Sound as Hasted, with the spell named as the source. The Grimoire shows the `utility` label.

**Fixtures this moved** (measured, declared and regenerated alone; docs in test/parity/FIXTURE-INVENTORY.md
"Phase 90 plan 07"): the rows are `roll: "derived"`, so no chargen cursor moved; chargen seeds 15 and 24
and the magic `cast-damage` book changed in content only, the magic `scroll` scenario was re-picked (a
longer scroll pool), five roll-high state pins and two bot pins moved, and the Hero-tab snapshot for seed 3's
Wizard shows Fly.

## Phase 90: Stop Time, Senseless and Duplicate Foe, and the misdirected swing (SPELL-10, plan 90-08)

User 2026-09-30 (SPELL-10): the slate in `90-SPELL-SLATE-DRAFT.md` is "accepted as drafted", and Q6 A
stretches a round-timed new spell by the school bonus: each point adds +1 round
(`derived.js#spellEffectRounds`). These are the control spells: one Special, two Illusion tricks that turn
a foe's blows away from your side.

- **The rows.** Three rows are appended after Speed of Sound (38 rows), each `stretch: "rounds"`,
  `roll: "derived"`, `niche: "control"`, `combatOnly: true`:

  | Spell | Lvl | School | Kind | What it does |
  |---|---|---|---|---|
  | Stop Time | 3 | special | `timestop` (`holdRounds: 2`) | every foe stops for 2 rounds (+1 a bonus point), unless it resists |
  | Senseless | 2 | illusion | `misdirect` (`at: "friends"`, `rounds` d4) | one foe swings at its own side for d4 rounds, never yours |
  | Duplicate Foe | 5 | illusion | `misdirect` (`at: "self"`, `rounds` d4+1) | one foe fights its double for d4+1 rounds, every swing on itself |

  The school gates need no code: Stop Time reaches the Special sub-classes (Wizard, Sorcerer, Illusionist,
  Summoner, Apprentice), Senseless and Duplicate Foe only the Illusionist and the Apprentice (the Wizard has
  no Illusion), and `school-gates.test.js` passes unchanged with them in `SPELLS`. The Bard's song pool
  (Phase 91) excludes Special and Illusion spells.
- **The stretch.** Stop Time: 2 rounds for a Wizard or Apprentice, 3 for a Sorcerer or Summoner, 6 for an
  Illusionist. The chart gives the Illusion school +0 to both sub-classes that learn it, so Senseless and
  Duplicate Foe get no stretch from it today (the Illusionist's +4 is Special, so it stretches Stop Time and
  the 90-07 spells, not these). A scroll's free cast by a non-Magic-User reads the base.
- **Stop Time** (`combat.js#stopTime`, wiring B). Every live foe, in `C.foes` order, rolls the one
  depth-rising resist; each that fails is held kind `"time"` (`holdFoe`): it takes no turns, a blow neither
  ends nor restarts it, strikes against it land on at least the top five faces (`targetStrikeFaces`, as for a
  sleeper), and a longer live hold (a Stun of 4 rounds) is never shortened. Every foe resisting says so in one
  line (`timeStopped { count: 0 }`). No main-rng draw.
- **Senseless and Duplicate Foe** (`combat.js#misdirectFoe` and `resolveMisdirectedTurn`, wiring C, the one
  new combat system). The picked foe's resist is rolled up front; a landed spell sets `f.misdirect = { at,
  left }` (one main-rng draw: the duration dice). On each turn the foe takes (a held, sleeping or stunned
  turn does not count) every swing it has rolls its own to-hit and deals its own damage at the first OTHER
  live foe (Senseless; natural armour may soak it, as Insane's blow) or at itself (Duplicate Foe), never at
  you or a Joiner; a Senseless foe with nobody else to hit swings at the air and the turn is lost. A hit on
  it does not end the spell. A kill pays you its experience and spoils (`killFoe`). To-hit uses the foe's own
  die and `5 + FOE_ACCURACY`, with no body's defences; a blind misdirected foe hits only on its top face and
  never crits; Weaken, Shrink and Hamstring halve its blows. Draws and positions: docs/ROLL-LEDGER.md "Phase
  90 plan 08".
- **Fumbles and scrolls.** The three join the scroll pool at their level (18, 27, 33 and 38 rows at depths 1
  to 4+). A fumbled Stop Time stops the READER for two turns (`heroOut` kind `"stopped"`, a flat 2); a
  fumbled Senseless or Duplicate Foe maddens the reader for d4 or d4+1 turns (`maddened`, clamped to
  `HERO_OUT_MAX`).
- **Surfaces.** Foe chips Stopped (the hold, `held.kind` "time"), Senseless and Fighting its double (the
  `misdirect` record, rounds left), each with a one-line rule; the hero chip kind Stopped (combat menu
  STOPPED, shell label and tap card). Oracle lines and rail twins for `timeStopped`, `foeMisdirected`,
  `foeMisdirectedHit`, `foeMisdirectedMiss`, `foeSwingsAtAir` and `foeMisdirectEnded`, and the `time` kind of
  `controlHeld`, `foeStillHeld` and `foeHoldBroken`. `docs/narrative-pass/why/90-08.json` has 23 rows.
- **Flagged for the user.** (1) Weaken's to-hit cap (top three faces) is not applied to a misdirected swing,
  only its damage halving; the plan reads "Weaken halves its blows". (2) A new misdirect never shortens a
  longer live one, and keeps that record's aim (a 1-round Senseless over a 5-round Duplicate Foe changes
  nothing): the plan wrote `{ at: sp.at, left: max }`, which would let a short cast change the aim of a long
  one. (3) The chart's Illusion bonus is +0 for the Illusionist and the Apprentice, so the Q6 A stretch is
  nothing for the two Illusion tricks until the chart changes. (4) Joiner Magic Users do not cast these yet
  (90-10 owns the Joiner caster policy); the tails take a `by` for them.

**Fixtures this moved** (measured, declared and regenerated alone; docs in test/parity/FIXTURE-INVENTORY.md
"Phase 90 plan 08"): the rows are `roll: "derived"`, so no chargen cursor moved; chargen seed 24 and the
combat `lose-apprentice` book changed in content only, three roll-high state pins and two bot pins moved,
and `roll-high-guard` gained one `rollCheck` and one `amount` draw for the misdirected swing.

## Phase 90: Door Illusion, Chameleon Tongue, Size of the Behemoth, the Illusionist's book and the scroll table (SPELL-10, plan 90-09)

User 2026-09-30 (SPELL-10): the slate in `90-SPELL-SLATE-DRAFT.md` is "accepted as drafted"; this plan appends
the last three of its ten (the Illusion spells that end or tilt a fight), completes the Illusionist's three
illusions (canon p.17) and pins the scroll roll table the user asked for ("Make sure that the scroll roll
table now includes the two new schools of spell as options").

- **The rows.** Three rows are appended after Duplicate Foe (41 rows), each `roll: "derived"`,
  `combatOnly: true`, school `illusion`, none stretched (the chart gives the Illusion school +0 to both
  sub-classes that learn it):

  | Spell | Lvl | Kind | Niche | What it does |
  |---|---|---|---|---|
  | Door Illusion | 1 | `door` | defensive | the fight ends at once through the flee path Smoke uses: no flee roll, no parting blow, spoils left behind; the cleverest foe rolls one resist and may see through it (then the turn is spent) |
  | Chameleon Tongue | 3 | `tongue` (`fluency: 2`) | answer | the fight's one parley, made at fluency 2: +4 on the roll, Magical foes can be talked to, the Walking Dead never |
  | Size of the Behemoth | 4 | `behemoth` | control | every foe rolls its resist; a failer below your level flees (no experience, no spoils), every other failer cowers for the fight: top three numbers, half damage |

  The school gates need no code: all three reach only the Illusionist and the Apprentice, and
  `school-gates.test.js` passes unchanged with them in `SPELLS`.
- **Door Illusion** (`combat.js#doorIllusionEscape`). The cleverest live foe (highest intelligence; the
  first in `C.foes` order on a tie) rolls the one depth-rising resist. A resist pushes `doorIllusionSeen` and
  the foes take their turn; a failure ends the fight (`fled { reason: "door" }`), the pending spoils are
  forfeited as in any flee, and a Joiner in the party leaves with the hero. `combat.js#fleeRefusal(state)`
  is the one never-flee predicate (`"samurai"` today; Phase 91's IDENT-16 extends it): `flee()` reads it,
  and so does `castSpell`, which refuses a Door Illusion from a hero it names with `castRefused { reason }`
  BEFORE the charge is spent. A scroll's free cast of it is still consumed (RULES-10), and the line says why.
- **Chameleon Tongue** (`magic.js` tongue branch). `derived.js#fluency(c, combat)` is the larger of the item
  source (the Helm of Knowledge, 1) and the fight-scoped `C.tongue` the cast sets (2); they never stack.
  The cast pushes `tongueCast` and calls `parley()`, which pays what parley pays (Phase 91's PARLEY-01 sets
  the rewards): a level-3 caster against level-3 Humans parleys on 8–20 (13 winning faces, 65%; the cap
  is 17 faces, 85%); a failure insults the foes and runs the foes' turn itself, so `castSpell` returns
  without a second one. `combat.js#parleyBlockedReason(state, fluencyOverride)` is the one predicate for
  "why can this fight not be parleyed": `"parleySpent"`, `"ninja"`, `"masterOfArms"`, `"walkingDead"`,
  `"noTalk"` (canParley's gate at that fluency) and `"wilmsryVsMagical"`, in `parley()`'s order. `parley()`
  and `castSpell` (before the charge) read it, and so does the combat menu, which greys the Tongue row with
  the reason (the row stays tappable, so the engine's own refusal line explains).
- **Size of the Behemoth** (`combat.js#behemothRoar`). Each live foe, in `C.foes` order, rolls the one
  resist. A foe that fails and is BELOW the caster's level flees (`alive = false`, `fled = true`: no
  `foeKilled`, no experience, no spoils); a foe exactly at the level, or above it, cowers. The cower is a
  per-foe `cowering` flag, deliberately not the room's Weaken fields: `derived.js#foeSwingChain` caps its
  swings at 3 faces (`COWER_FACES`) and `foeWeakened` halves its damage, and a later Weaken running out never
  clears it. When the rout empties the room the encounter clears through the usual path.
- **The Illusionist's book** (`character.js#rollGrimoire`). A new Illusionist holds Mirror Self, Door
  Illusion and one more Illusion spell it did not roll (canon p.17: three illusion spells on top of the
  beginning roll), appended at the very end of the function: the rolled book and every day-one top-up are
  untouched, no main-rng draw is made (the pick is on the call's derived stream, after its last existing
  draw), and a pick above the Illusionist's level waits in the book until it levels. `SUB_NOTE.Illusionist`
  says so.
- **Scroll fumbles.** A fumbled Door Illusion does nothing (the door does not open); a fumbled Chameleon
  Tongue insults the room (the new `insulted` effect sets the parley insult, +1 on every foe's winning faces
  for the fight); a fumbled Size of the Behemoth weakens the reader (the existing `weakened` effect, d4+1
  rounds).
- **The scroll roll table, by depth band** (`magic.js#readScroll` rolls `SPELLS.filter(sp => sp.lvl <=
  min(5, depth + 1))`; `test/unit/scroll-pool.test.js` pins it): 

  | Depth | Rows | Slate spells in the pool |
  |---|---|---|
  | 1 | 19 | Open/Lock, Door Illusion, Fly, Senseless |
  | 2 | 29 | those four, plus Stop Time and Chameleon Tongue |
  | 3 | 36 | those six, plus Enchant Character and Size of the Behemoth |
  | 4 and deeper | 41 | all ten, plus Speed of Sound and Duplicate Foe |

  Every band holds at least one Special and one Illusion spell; Lesser Summon and Phantom Host are in none.
  Reading follows RULES-10: any reader may try a Special or Illusion scroll (a read scroll is consumed), and a
  Magic User copies it into the book only when its sub-class can learn the school and can already cast it (a
  Warlock free-casts an Illusion scroll and never copies it; a Wizard copies Special but not Illusion; an
  Illusionist copies an Illusion scroll it is high enough for).
- **Surfaces.** The Cowering foe chip; the Oracle and rail lines for `doorIllusionSeen`, `tongueCast`,
  `foeRouted`, `foeCowers`, `behemothCast`, the door flee (`fled` reason `door`), the new `castRefused`
  reasons and the `insulted` fumble; a failed resist folds behind a foe's own rout or cower line and behind
  the door escape on the rail. `docs/narrative-pass/why/90-09.json` has the ledger rows.
- **Flagged for the user.** (1) The Illusionist's two grants come AFTER the day-one top-ups, not with Mirror
  Self: put with Mirror Self, Door Illusion would count as a second ready level-1 spell and shrink the
  top-up, which would change the rolled part of every Illusionist's book. (2) A Door Illusion row is never
  actually greyed in the menu for a Samurai (a Samurai is not a Magic User); the refusal exists for a
  Samurai who reads a Door Illusion scroll. (3) The Chameleon Tongue pays whatever `parley()` pays today:
  Phase 91's PARLEY-01 rewards apply to it unchanged.

**Fixtures this moved** (measured, declared and regenerated alone; docs in test/parity/FIXTURE-INVENTORY.md
"Phase 90 plan 09"): the rows are `roll: "derived"`, so no chargen cursor moved; chargen seed 8 (an
Illusionist), two roll-high state pins (`solo-magicuser-sorcerer`, `deep-8`) and one bot pin (the Pilfer
trio's seed 2) moved, and `roll-high-guard` gained one derived `selection` draw.

## Phase 90 plan 10: Joiner Magic Users cast from their own book, and three audit fixes (SPELL-10, SPELL-08)

- **The Joiner caster policy** (`engine/combat.js#pickMemberSpell`, pure, no rng): see docs/SPELL-AUDIT.md "Joiner casters" for the order (a heal at or below half hit points; a room control against three or more foes; a round-1 buff; a single control on a strong foe; else the best attack spell, Ice included; else the staff) and the per-spell casts-or-never table. A pick resolves through the hero's own shared tails with the Joiner's name on every event and the charge paid from the Joiner's own sheet. The Joiner heal's dice come from a derived stream (`derivedRng(cursor, "memberHeal", round, partyIdx, charges)`), so it adds no main-rng draw; the shared tails draw what they always drew (Stop Time and Behemoth none, Duplicate Foe and Senseless their duration dice, Stun and Doze their d4s).
- **Lightning for a Joiner** (Q8 A): `allyCast`'s `aoe: "all"` branch reaches every live foe, each its own resist, to-hit roll and damage (`allyThrow`).
- **Death** (Q7 A): kills the foe you picked; a dead pick falls to the first live foe (`SINGLE_TARGET_KINDS` death is `"target"`).
- **Turn Walking Dead** (Q9 B, canon): `pickFoeTarget` reads a foe's `fixated` flag; a fixated Walking Dead swings only at the caster, a Joiner is never picked while one lives (the pick die is still drawn, so the party-mode stream does not move).

## Phase 90 close (SPELL-08, plan 90-12)

Phase 90 audited every spell and every skill and ability, fixed what the audit found and pinned each fix. This is the spell side of the close: every rule the phase changed, every spell's rolls in roll-high form, the school gates, the scroll pool, and the guards that keep them true. The audit tables are `docs/SPELL-AUDIT.md` (the verdict and the pin of every row) and `docs/SKILL-AUDIT.md`; the text-vs-engine guard is `test/unit/spell-skill-text-engine.test.js`.

### What Phase 90 changed

- **Strength (SPELL-09, plan 90-03, Q1 A).** +d10 on every damage roll the hero makes (each weapon blow, each damage spell's roll as it lands: each foe of an area spell, each Fireballs bolt; never a damage-over-time tick), for 100 squares from the cast, no hit points; a recast restarts the 100. A `spell:Strength` squares record; the d10 comes from a derived stream (`strengthRoll`).
- **One depth-rising resist for every spell (plan 90-04, user 2026-09-30).** Every spell a foe can resist rolls `risingResistFaces(depth, intel)` once per targeted foe; no spell keeps a "past floor 12" hold, cap or second resist. Petrify (Q2 A) kills the foe, pays its experience and drops no coin or treasure; Blind caps a foe to its die's top face for the fight (after the insult) and it never crits; Stupidity sets the foe's intelligence to 1 and it keeps swinging; Stupidity and Death hit the foe you picked (Q7 A, 90-04 and 90-10).
- **Doze, Stun and Ice (plan 90-05, Q3 A, Q4 A, Q5 A).** Doze sleeps d4 foes (your target first) for a d4 each and a hit wakes a dozing foe (only Doze's sleep wakes); Stun holds one foe for d4 rounds and a hit does not end it; Ice is the area freeze (a d10 + level² to every foe, no roll to hit, a survivor frozen d4 rounds unless it resists).
- **Removals, the Summoner and the school gates (plan 90-06).** Lesser Summon and Phantom Host are gone (an old save loads tolerantly); the Summoner casts Summon from level 1 as the one named exception to the gates; the Wizard lost the Illusion school; a guard (`test/unit/school-gates.test.js`) sweeps every path that hands out a spell.
- **The ten-spell slate (SPELL-10, plans 90-07 to 90-09, Q6 A).** Open/Lock, Fly, Enchant Character, Speed of Sound (Special, spell-sourced timed effects); Stop Time, Senseless, Duplicate Foe (control, with the misdirected swing); Door Illusion, Chameleon Tongue, Size of the Behemoth (escape, talk, rout); the Illusionist starts with Mirror Self, Door Illusion and one random Illusion spell. Each point of the chart's school bonus stretches a new spell: +10 squares on a square-timed one, +1 round on a round-timed one.
- **Joiner casters and three audit fixes (plan 90-10).** A Magic User Joiner casts from its own book by a pure policy (a heal at half hp, a room control, a round-1 buff, a single control, then its best attack spell, then its staff); a Joiner's Lightning hits every foe (Q8 A); Turn Walking Dead fixates the Walking Dead left standing on the caster (Q9 B).
- **TEXT-01 (plan 90-11).** No spell text speaks in faces: a shift is "+N to hit", a hard cap names its range on a d20; every spell a foe can resist says so on its Grimoire and combat-menu rows.
- **The guard (plan 90-12).** Every number a spell text states is claimed by a fact and equals what the engine rolls; the audit tables are closed (no open verdict, every pin a real test).

### Every spell's rolls, in roll-high form

Generated from the Rolls cells of `docs/SPELL-AUDIT.md` (`test/unit/spell-audit.test.js` regenerates it from the audit and fails if this table differs). Every to-hit and resist reads "hits on X–20 (d20)" or "+N to hit"; a damage die never reads like a to-hit roll.

<!-- phase90-close:rolls:start -->
| Spell | Lvl · School | To hit | Resist | Damage | Duration, reach and effect | Backfire | Scroll fumble |
|---|---|---|---|---|---|---|---|
| Heal | 1 · healing | no to-hit roll | never resisted (`SPELL_SELF_KINDS`) | no damage; heals d10 hp (1–10, a Cleric d10+3) | instant | Apprentice backfire 1 in 8 (a 1 on a d8) and the heal is lost | scroll fumble row helpful/heal (it heals the nearest foe instead) |
| Shield | 1 · protection | no to-hit roll | never resisted | absorbs up to 50 hp of landed damage | 5 rounds | Apprentice backfire 1 in 8 | scroll fumble row helpful/ward (it shields the nearest foe) |
| Strength | 1 · offense | no to-hit roll | never resisted | no damage of its own; an extra d10 (1–10) on every damage roll for 100 squares (Q1 A) | — | Apprentice backfire 1 in 8 | scroll fumble row helpful/might (a foe's blows gain a flat d10 for the fight, no hit points) |
| Doze | 1 · offense | no to-hit roll | per reached foe one depth-rising resist (intelligence 10 resists on 16–20, 25%, up to floor 12; 15–20 at floor 13, 10–20 at floor 20) and a d4 sleep (1–4 foe visits) each | no damage | the reach is a d4 of foes (1–4, the target first, never more than the live foes; Q4 A: no level multiplier); any damage the sleeper takes wakes it (Q3 A: only Doze's sleep does) | Apprentice backfire 1 in 8 | scroll fumble row harmful/out (the reader loses up to d4 turns) |
| Freeze | 1 · offense | to hit: 6 winning faces on a d10, so hits on 5–10 (60%) before bonuses (Wizard +3 hits on 2–10, Warlock or Sorcerer +4 on 1–10, Court Mage +2 on 3–10) | resist after a hit: half-intelligence faces (intelligence 10: 16–20) rising past floor 12 (floor 20, intelligence 10: 10–20, 55%), and it stops only the freeze; the resist hint reads the same depth-rising faces the engine rolls (90-04) | damage d6 + level² (Strength adds its d10 per Q1, 90-03) | frozen d4 rounds (1–4) | Apprentice backfire 1 in 8 and a thrown backfire also costs half the damage roll | scroll fumble row harmful/heavy (a d10 + depth blow on the reader, plus Afraid) |
| Map the Floor | 1 · divination | no to-hit roll | never resisted | no damage | lasts until the first step | Apprentice backfire 1 in 8 | scroll fumble row helpful/wasted |
| Mirror Self | 1 · illusion | no to-hit roll | never resisted | no damage | every foe hits you only on a 20 on a d20 (5%), 19–20 if insulted; d6 foe turns (1–6) | Apprentice backfire 1 in 8 | scroll fumble row helpful/mirror (the nearest foe gets d6 rounds) |
| Stun | 1 · offense | no to-hit roll (the rulebook calls Stun a thrown spell, the prototype never rolls to hit) | one foe's depth-rising resist (intelligence 10 resists on 16–20 up to floor 12) | no damage | held d4 foe visits (1–4; a d4 of 4 holds exactly four turns) | Apprentice backfire 1 in 8 | scroll fumble row harmful/out (the reader loses up to d4 turns) |
| Weaken | 1 · offense | no to-hit roll for you | resist per foe: half-intelligence faces (intelligence 10 resists on 16–20) rising past floor 12 (floor 20: 10–20); the resist hint reads the same depth-rising faces the engine rolls (90-04) | no damage | foes then hit only on 18–20 on a d20 (6–8 on a d8) and do half; d4+1 rounds (2–5) | Apprentice backfire 1 in 8 | scroll fumble row harmful/weakened (the reader is weakened d4+1 rounds) |
| Acid | 2 · offense | no to-hit roll | foe resist rising with depth, one roll (intelligence 10: 16–20 up to floor 12; the Pine Staff's 25% to 55% rise since 90-04 reaches Acid too) | damage 2d6+2 (4–14) a tick for d6 ticks (1–6), level² once on the first | a damage-over-time tick is not a new damage roll, so Strength's d10 does not join it (Q1) | Apprentice backfire 1 in 8 (not a thrown spell, so no self-damage) | scroll fumble row harmful/dot (the reader burns d6 rounds) |
| Stupidity | 2 · offense | no to-hit roll | foe resist rising with depth, one roll (intelligence 10: 16–20 up to floor 12, 10–20 at floor 20); afterwards the foe resists on a 20 on a d20 (intelligence 1) up to floor 12, 19–20 at floor 13, 12–20 at floor 20 | no damage | the fight at every depth; a foe already at intelligence 1 still lands it and the line says so | Apprentice backfire 1 in 8 | scroll fumble row harmful/out (the reader is stupefied up to d4 turns) |
| Blind | 3 · offense | no to-hit roll | foe resist rising with depth, one roll (intelligence 10: 16–20 up to floor 12, 10–20 at floor 20) | no damage | the blind foe hits only on its die's top face, a 20 on a d20 (8 on a d8), 5% or 12.5%, and never crits, for the fight at every depth; FLAGGED ASSUMPTION for the user (90-04): "hits only on the maximum roll" is read as a hard cap applied AFTER the insult, so an insulted party still faces only the top face | Apprentice backfire 1 in 8 | scroll fumble row harmful/blind (the reader is blind the fight, no turns lost) |
| Shrink | 3 · offense | no to-hit roll | foe resist per foe, one depth-rising roll (intelligence 10: 16–20 up to floor 12); one depth-rising resist and no floor-12 extras (built in 90-04) | no damage | reach d6 foes (every foe of a three-foe fight on 4 rolls in 6); half hp and half damage for the fight | Apprentice backfire 1 in 8 | scroll fumble row harmful/shrink (the reader's hp halves) |
| Ice | 3 · offense | no to-hit roll and no up-front resist (Q5 A) | a survivor's freeze resist is the one depth-rising roll (intelligence 10: 16–20 up to floor 12) and stops only the freeze | damage d10 + level² to EVERY live foe (1–10 plus the square) | frozen d4 rounds (1–4) | Apprentice backfire 1 in 8 | scroll fumble row area/damage (the reader and the party take its d10, each its own roll) |
| Earthquake | 4 · offense | no to-hit roll | foe resist per foe (intelligence 10: 16–20) rising with depth, one roll and no floor-12 extras since 90-04 (15–20 at floor 13, 10–20 at floor 20) | damage 3d10+8 (11–38) + level² to each foe, you take half of the 3d10+8 (6–19) unless warded | Strength adds its d10 to the one roll every foe takes (Q1); instant | Apprentice backfire 1 in 8 (no self-damage, not thrown) | scroll fumble row area/damage (the reader and the party take it once) |
| Noxious Vapor | 4 · offense | no to-hit roll | foe resist per foe (intelligence 10: 16–20); one depth-rising resist and no floor-12 extras (built in 90-04) | kill chance: a 1 in 6 that the table shows 4 (certain from level 5, where you choose it), then 9 in 10 per foe | otherwise asleep d6+2 foe visits (3–8) | Apprentice backfire 1 in 8 | scroll fumble row harmful/vapor |
| Fireballs | 4 · offense | no to-hit roll per bolt (the rulebook rolls each ball; the prototype and the engine never do) | foe resist per foe (intelligence 10: 16–20) rising with depth, one roll and no floor-12 extras since 90-04 (15–20 at floor 13, 10–20 at floor 20) | damage d10+2 (3–12) per bolt, level² once per foe struck | Strength adds its d10 to each bolt (Q1); bolts 1–8 | Apprentice backfire 1 in 8 | scroll fumble row area/volley (the reader and the party take it) |
| Petrify | 5 · offense | no to-hit roll (the rulebook calls Petrify thrown, the prototype never rolls to hit) | foe resist rising with depth, one roll (intelligence 10: 16–20 up to floor 12, 10–20 at floor 20) | no damage, an outright kill that pays its experience (Q2 A) and drops no coin or treasure | — | Apprentice backfire 1 in 8 | scroll fumble row harmful/heavy (a d10 + depth blow on the reader, plus Afraid) |
| Insane | 2 · offense | no to-hit roll | foe resist (intelligence 10: 16–20); one depth-rising resist and no floor-12 extras (built in 90-04) | damage on a 2 is the maddened foe's own level² + d6 to a neighbour | d6 table, each face 1 in 6; sleep d4 on a 4 | Apprentice backfire 1 in 8 | scroll fumble row harmful/out (the reader is maddened up to d4 turns) |
| Summon | 2 · special | no to-hit roll for you | never resisted | no damage roll of your own (the ally hits on 5 winning faces of its die and deals level² + d6) | d4+2 rounds (3–6), a Summoner's 2×d4+2 (4–10) at level + 1 | backfire: Apprentice 1 in 8 and a Summoner's summon 1 in 8 (hurt level² + d6) | scroll fumble row helpful/summon (the summon joins the foes) |
| Fireball | 3 · offense | to hit: 4 winning faces on a d8, so hits on 5–8 (50%) before bonuses (Wizard +3 hits on 2–8, Warlock or Sorcerer +4 on 1–8, Court Mage +2 on 3–8) | foe resist first (intelligence 10: 16–20) rising with depth, one roll and no floor-12 extras since 90-04 (15–20 at floor 13, 10–20 at floor 20) | damage 2d10+4 (6–24) + level² (Strength adds its d10 per Q1) | instant | Apprentice backfire 1 in 8 and the spell turns on you for half its damage roll | scroll fumble row harmful/damage (2d10+4 × the caster's level over the spell's, to the reader) |
| Major Heal | 3 · healing | no to-hit roll | never resisted | no damage; heals 3d10 (3–30), a Cleric +3 | instant | Apprentice backfire 1 in 8 | scroll fumble row helpful/heal |
| Bubble | 3 · protection | no to-hit roll | never resisted | no damage of its own: the next landed blow is reflected in full, then 25 hp absorbed for the rest of that round | armed until a blow lands or the fight ends | Apprentice backfire 1 in 8 | scroll fumble row helpful/ward |
| Sense Danger | 3 · divination | no to-hit roll | never resisted | no damage | one fight | Apprentice backfire 1 in 8 | scroll fumble row helpful/wasted |
| Turn Walking Dead | 2 · protection | no to-hit roll | foe resist per foe (intelligence 10: 16–20) rising with depth, one roll and no floor-12 extras since 90-04 (15–20 at floor 13, 10–20 at floor 20) | no damage | reach every Walking Dead of your level or lower, permanent; Q9 B (canon): every Walking Dead left standing swings only at you for the rest of the fight, so a Joiner is never picked while one lives | Apprentice backfire 1 in 8 | scroll fumble row harmful/none |
| Plane Gate | 3 · protection | no to-hit roll | foe resist per foe (intelligence 10: 16–20) rising with depth, one roll and no floor-12 extras since 90-04 (15–20 at floor 13, 10–20 at floor 20) | no damage | reach d6 foes (1–6), every foe of a three-foe fight on 4 rolls in 6; permanent | Apprentice backfire 1 in 8 | scroll fumble row harmful/none |
| Sense Presence | 2 · protection | no to-hit roll | never resisted | no damage | until your next fight ends | Apprentice backfire 1 in 8 | scroll fumble row helpful/senses (the nearest foe gets it) |
| Lightning | 4 · offense | to hit per foe: 4 winning faces on a d8, hits on 5–8 (50%) before bonuses | foe resist per foe (intelligence 10: 16–20) rising with depth, one roll and no floor-12 extras since 90-04 (15–20 at floor 13, 10–20 at floor 20) | damage d10+6 (7–16) + level² to each foe hit, Strength's d10 to each (Q1) | Q8 A: a Joiner's Lightning hits every foe like the hero's, each on its own roll; instant | Apprentice backfire 1 in 8 and half the damage roll on you | scroll fumble row area/damage |
| Regeneration | 4 · healing | no to-hit roll | never resisted | no damage; heals d8 (1–8) every foe turn for the fight | — | Apprentice backfire 1 in 8 | scroll fumble row helpful/regen (the nearest foe regains d8 a turn) |
| Mangle | 5 · offense | to hit: 5–8 on a d8 (50%) before bonuses (Wizard +3 hits on 2–8) | foe resist first (intelligence 10: 16–20) rising with depth, one roll and no floor-12 extras since 90-04 (15–20 at floor 13, 10–20 at floor 20) | damage 2d20+15 (17–55) + level² (Strength's d10 per Q1) | instant | Apprentice backfire 1 in 8 and half the damage roll on you | scroll fumble row harmful/damage |
| Death | 5 · offense | no to-hit roll | foe resist (intelligence 10: 16–20) rising with depth, one roll and no floor-12 extras since 90-04 (15–20 at floor 13, 10–20 at floor 20) | no damage roll, an outright kill of the foe you picked (Q7 A) | costs 25 hp | Apprentice backfire 1 in 8 | scroll fumble row harmful/heavy (a d10 + depth blow on the reader, plus Afraid) |
| Open/Lock | 1 · special | no to-hit roll | never resisted | no damage | the next chest within 100 squares opens with no lock roll (today a Magic User with no lockpicks opens one on 13–20 on a d20, 12–20 at intelligence 15 or more, and a failed roll loses the chest); Q6: +10 squares per school bonus point of the Special school (Illusionist +4: 140 squares; Sorcerer or Summoner +1: 110) | Apprentice backfire 1 in 8 | scroll fumble row helpful/wasted (the foe's copy does nothing) |
| Fly | 2 · special | no to-hit roll | never resisted | no damage | 30 squares with no roll to cross (Q6: +10 squares per Special bonus point: Illusionist 70, Sorcerer or Summoner 40) | Apprentice backfire 1 in 8 | scroll fumble row helpful/wasted (the foe's copy does nothing) |
| Enchant Character | 4 · special | no to-hit roll of its own: +2 to hit with your weapon (a level-4 Magic User's 6–8 on a d8 becomes 4–8), foes −2 to hit you (a foe hitting on 4–8 on a d8 needs 6–8), no critical lands on you | never resisted | no damage | 50 squares (Q6: Illusionist 90) | Apprentice backfire 1 in 8 | scroll fumble row helpful/wasted (the foe's copy does nothing) |
| Speed of Sound | 5 · special | no to-hit roll of its own (each blow rolls normally) | never resisted | no damage of its own | 50 squares (Q6: Illusionist 90), two blows a swing and you act first | Apprentice backfire 1 in 8 | scroll fumble row helpful/frenzy (the foe swings twice a turn) |
| Stop Time | 3 · special | no to-hit roll | foe resist per foe (intelligence 10: 16–20) -> the shared depth-rising helper (on every spell since 90-04) | no damage | stopped 2 foe turns (Q6: +1 round per Special bonus point: Illusionist 6 rounds, Sorcerer or Summoner 3); a hit does not wake it | Apprentice backfire 1 in 8 | scroll fumble row harmful/out (the reader is stopped exactly two turns) |
| Senseless | 2 · illusion | no to-hit roll for you | foe resist (intelligence 10: 16–20) -> the shared depth-rising helper (on every spell since 90-04) | no damage of its own (the foe's own blows land on its side) | d4 rounds (1–4), +1 per Illusion bonus point under Q6 (every sub-class that can learn Illusion has +0 today) | Apprentice backfire 1 in 8 | scroll fumble row harmful/out (the reader is maddened up to d4 turns) |
| Duplicate Foe | 5 · illusion | no to-hit roll for you | foe resist (intelligence 10: 16–20) -> the shared depth-rising helper (on every spell since 90-04) | no damage of its own (the foe's own blows land on itself, and you collect its experience if it dies) | d4+1 rounds (2–5) | Apprentice backfire 1 in 8 | scroll fumble row harmful/out (the reader is maddened up to d4+1 turns, clamped) |
| Door Illusion | 1 · illusion | no to-hit roll | the cleverest foe resists on half its intelligence (intelligence 16: 13–20, 40%, so the escape works 60%; intelligence 1–3: 90 to 95%) -> the shared depth-rising helper (on every spell since 90-04) | no damage | instant | Apprentice backfire 1 in 8 | scroll fumble row built: the door does not open (`none`) |
| Chameleon Tongue | 3 · illusion | no to-hit roll | never resisted (the parley is the roll): it succeeds on the top (9 + bonus) numbers of a d20, capped at 17, so a level-3 caster against level-3 foes needs 8–20 (13 numbers, 65%) and the best case is 4–20 (85%) | no damage | a failure insults the foes; what a successful parley pays is PARLEY-01 (Phase 91) | Apprentice backfire 1 in 8 | scroll fumble row harmful/insulted: the room takes it personally (the parley insult) |
| Size of the Behemoth | 4 · illusion | no to-hit roll | foe resist per foe (intelligence 10: 16–20) -> the shared depth-rising helper (on every spell since 90-04) | no damage | a failing foe below your level leaves with no experience and no spoils, every other failing foe hits only on 18–20 on a d20 and deals half for the whole fight | Apprentice backfire 1 in 8 | scroll fumble row built: the reader is weakened (`weakened`, d4+1 rounds) |
<!-- phase90-close:rolls:end -->

### The removed spells

- **Lesser Summon** (the Summoner's level-1 small ally, a Phase 40 addition): removed in 90-06; an old save's Lesser Summon loads as Summon, one copy at the first one's place.
- **Phantom Host** (a prototype-only level-3 Illusion summon, not in the rulebook): removed in 90-06; an old save's Phantom Host is dropped. The Illusion school gets real Illusion spells instead.

Both are pinned by `test/unit/removed-spells-load.test.js` and absent from every scroll band (`test/unit/scroll-pool.test.js`).

### The school gates and the named exception

The school bonus and gate of every Magic User sub-class, read from the live `content/mu-chart.js#MU_CHART` ("never" is `null`: the sub-class may never learn that school; "gate N" is the level the school opens at). `test/unit/spell-audit.test.js` regenerates this table from the chart.

<!-- phase90-close:gates:start -->
| Sub-class | Offense | Protection | Healing | Divination | Special | Illusion |
|---|---|---|---|---|---|---|
| Wizard | +3 | +0 | +0 | +0 | +0 | never |
| Warlock | +4 | +0 (gate 4) | +0 (gate 3) | +2 | never | never |
| Sorcerer | +4 | +1 | +0 (gate 4) | +3 | +1 | never |
| Court Mage | +2 | +2 | +1 | +0 (gate 4) | never | never |
| Illusionist | +0 | +0 (gate 3) | never | +1 | +4 | +0 |
| Cleric | +0 | +3 | +4 | +0 (gate 3) | never | never |
| Summoner | +0 | +2 | +0 | +4 | +1 | never |
| Apprentice | +0 | +0 | +0 | +0 (gate 3) | +0 | +0 |
<!-- phase90-close:gates:end -->

The one **named exception** is the Summoner's Summon: `content/spell-level-overrides.js` holds `{ Summoner: { Summon: 1 } }`, read only through `derived.js#spellLevelFor`, so a level-1 Summoner casts the level-2 Summon (everyone else needs level 2). The Wizard's Illusion is `null`. The Illusion school's bonus is 0 for both sub-classes that learn it (the Illusionist and the Apprentice), so Q6's stretch gives an Illusion spell nothing today (a Phase 91.1 value call). The sweep (`test/unit/school-gates.test.js`) proves no path (chargen, a Joiner, a level-up, a find, a scroll copy, the combat menu) ever hands a sub-class a spell its chart forbids.

### The scroll pool by depth band

A scroll's spell is `rng.pick(SPELLS.filter(sp => sp.lvl <= min(5, depth + 1)))`: 41 spells in the table, none of them a removed spell. `test/unit/spell-audit.test.js` regenerates this table from `SPELLS`; `test/unit/scroll-pool.test.js` pins it (both new schools at every band the level allows, the removed spells never).

<!-- phase90-close:pool:start -->
| Depth | Spell levels | Spells in the pool | Added at this depth |
|---|---|---|---|
| 1 | 1 to 2 | 19 | Heal, Shield, Strength, Doze, Freeze, Map the Floor, Mirror Self, Stun, Weaken, Acid, Stupidity, Insane, Summon, Turn Walking Dead, Sense Presence, Open/Lock, Fly, Senseless, Door Illusion |
| 2 | 1 to 3 | 29 | Blind, Shrink, Ice, Fireball, Major Heal, Bubble, Sense Danger, Plane Gate, Stop Time, Chameleon Tongue |
| 3 | 1 to 4 | 36 | Earthquake, Noxious Vapor, Fireballs, Lightning, Regeneration, Enchant Character, Size of the Behemoth |
| 4 and deeper | 1 to 5 | 41 | Petrify, Mangle, Death, Speed of Sound, Duplicate Foe |
<!-- phase90-close:pool:end -->

### Where each rule is pinned

`docs/SPELL-AUDIT.md` names, per spell, the test that would fail if the fix were reverted (a `Pinned by` cell of `test/unit/<file>.test.js: <title>` pins, each read by `test/unit/spell-audit.test.js`); the text-vs-engine guard `test/unit/spell-skill-text-engine.test.js` pins every number a spell text states to the engine.
