# Spells (Phase 40 ledger)

**Phase:** 40-spell-rework
**Date:** 2026-09-18

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
touch the existing gate).

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

### Ice — the real DOT (`kind: "dot"`)

`castSpell`'s new `dot` branch, a peer of `acid`, not a rewrite of the
thrown branch: `t.dot = { left: rng.d(4) + 1, dmg: sp.dmg, by: "ice" }` on
`C.foes[C.target]` — one draw, no to-hit roll (like Acid), guarded on
`sp.dmg` being present (T-40-03: a tampered/unknown `dot` row missing it
never writes a broken record). `"dot"` is absent from `RESIST_IMMUNE_KINDS`,
so an intel >= 12 target still gets its resist d20 exactly like Acid.
Recasting on a foe already carrying an ice dot REFRESHES `left` (a plain
overwrite — the record is replaced, never stacked).

`combat.js#foeTurn`'s existing `f.dot` tick block (Phase 38, Poisoned
Edge's own template) already ran the per-round `d6` and the kill check; this
plan adds the payoff directly after it: when the tick that just ran leaves
`left <= 0` (the record about to be deleted) AND `by === "ice"` AND the foe
is still alive, it freezes solid (`f.frozen = true`, `frozenSolid`) and dies
through `killFoe` — paid exactly like a melee kill (sp/gold/kill count/loot
roll), mirroring the thrown Freeze branch's own frozen/killFoe/revive lines
(a kill-twice `lives` foe survives the freeze once and is unfrozen). `by` is
the ONLY switch — a Poisoned Edge dot running out is completely unaffected,
and Ice's own tick that itself kills the foe (wp reaches 0 on the DAMAGE,
not the expiry) pays through the ordinary dot-kill path with no
`frozenSolid` at all.

**Draw statement:** cast — one `d4` (the duration). Per tick — one `d6` (the
damage; `damageFoe`'s own draw count is zero for a `kind: "spell"` hit,
since the natural-armor soak only ever fires for a physical source). Payoff
— zero extra draws; `killFoe`'s own draws (sp `d6`, coin `d10`, treasure
`d20`, an optional Beasts/Lair-Beasts cooking `d6`) are the only ones.

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
| Stupidity | one foe | **the rest of the fight** (new — was a d10 nap) | `t.stupid` — `foeTurn`'s own per-round skip, no counter, no expiry |
| Blind | one foe | the fight | `t.blind = true` — unchanged |
| Shrink | up to d6 foes | the fight | `f.shrunk` — halves wp (Plan 01) AND now, for real, halves the foe's own melee damage |
| Petrify | one foe | removal (five days, no spoils) | unchanged |

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
Illusionist+Shield (protection gate 3), Summoner+Freeze (offense gate 3).

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

## Map the Floor — Key Decision: re-fog provenance (Plan 04)

(appended by Plan 04)

## UI (Plan 05)

(appended by Plan 05)

## Requirements map (Plan 05)

(appended by Plan 05)
