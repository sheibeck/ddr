# Spells (Phase 40 ledger)

**Phase:** 40-spell-rework
**Date:** 2026-09-18

> **Status (v1.6, Phase 48):** design record of Phase 40; the spell table and mechanics are live. "What stays for the cleanup milestone" is done — Phase 44 deleted the classic `SPELLS`/`castSpell`/`rollGrimoire` duplicates.

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
