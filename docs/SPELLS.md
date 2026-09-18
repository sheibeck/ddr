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

(appended by Plan 02)

## Utility visibility and scrolls (Plan 03)

(appended by Plan 03)

## Map the Floor — Key Decision: re-fog provenance (Plan 04)

(appended by Plan 04)

## UI (Plan 05)

(appended by Plan 05)

## Requirements map (Plan 05)

(appended by Plan 05)
