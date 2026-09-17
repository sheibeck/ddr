# Usable Features Audit (Phase 31, CMB-02)

**Phase:** 31-combat-start-gating-effect-hygiene, Plan 02
**Date:** 2026-09-16

> A blocked button stays visible; tapping it dispatches; the engine's refusal
> event names the why; refusals are toasts — and stay toasts after Phase 32's
> Round Card ships (the design doc §4.2 already routes `PRIORITY.block`
> refusals to toasts as direct replies to a tap).

This ledger enumerates every usable spell, item, gear piece, and class/race/
sub-class active feature, by circumstance, with the engine's refusal reason
for each blocked circumstance and (§6) an expiry entry for every timed
effect. `test/unit/usable-features-audit.test.js` is a table-driven,
doc-synced test that exercises each row and keeps this document honest.

## §1. Refusal vocabulary

One shared vocabulary across every gated action. Every reason below has its
own toast + Oracle line (`src/browser/toasts.js` / `eventNarration.js`) —
never a generic "you can't do that."

| Reason | Carried by | Meaning | Event type(s) |
|---|---|---|---|
| `notFought` | `castRefused`, `useRefused`, `scrollRefused`, `actionRefused`, `strikeRefused`, `fleeRefused`, `parleyRefused` | the encounter is still a preview — Fight! has not been pressed | every combat-gated action, via the single `refuseIfPending` guard |
| `combatOnly` | `castRefused`, `useRefused` | a combat-only spell/targeted item used with no active encounter | `castRefused`, `useRefused` |
| `cooldown {left}` | `useRefused`, `actionRefused` | an `every`-N-squares item, or a Bard's song, still counting down; `left` is the exact squares remaining | `useRefused`, `actionRefused` |
| `wrongClass` | `useRefused`, `actionRefused` | a staff used by a non-Magic-User; Sing attempted by a non-Bard | `useRefused`, `actionRefused` |
| `noCharges` | (its own event, not this reason string) | see `noChargesLeft` below | `noChargesLeft` |
| `noTarget` | (mostly its own dedicated event) | a targeted effect with nothing to target | `nothingToThrowAt`, `insaneNoTarget`, `nothingToTurn`, `gateRefused` — **unreachable for the four common targeted kinds (thrown/acid/blind/petrify) in combat**: `castSpell` retargets a dead `C.target` onto the first live foe exactly like `playerStrike`, the same way a Strike never whiffs on a corpse |
| `pilfer` | `useRefused`, `scrollRefused` | a Pilfer cannot use a non-heal magic item or read a scroll | `useRefused`, `scrollRefused` |
| notWorn | useRefused | (Phase 37, GEAR-03) a cloak/jewelry/staff activatable used from the BAG while the character is on the worn-slot model — activatables must be worn to work; legacy states (no c.worn) keep bag-use | useRefused |
| `exploreOnly` | *(reserved)* | no current engine emitter uses this reason — every existing combat-flavored action is gated the other direction (`combatOnly`), not this one | — |

`noChargesLeft` / `spellNotKnown` / `spellAboveLevel` / `spellSchoolLocked`
already self-explain via their OWN dedicated event type + copy — they are
NOT folded into `castRefused` (RESEARCH §2: "extend, don't replace"; four
already-tested, already-narrated shapes with no clarity gain from a rename).

**Fear is a penalty, not a refusal — see §5b.** No refusal reason anywhere
in the engine is named after fear (`frozen`/`afraid` never appear as a
`reason` value); grep confirms zero occurrences in `engine/*.js`.

## §2. Spells (`content/spells.js`, 32 rows)

Every spell's `combatOnly` flag classifies it as castable from the Hero tab
outside an encounter (`false`) or requiring an active encounter to have any
real effect (`true`). Columns: level (★ = `SPELL_LEVEL_OVERRIDES` lowers the
effective level for one sub-class), school, kind, combatOnly, and the
outcome for every gated circumstance.

| Spell | Lvl | School | Kind | combatOnly | Explore | Combat | Fight!-pending | Afraid |
|---|---|---|---|---|---|---|---|---|
| Heal | 1 | healing | heal | false | `healed` | `healed` | `castRefused notFought` | casts at the penalty |
| Shield | 1 | protection | ward | false | `wardRaised` | `wardRaised` | `castRefused notFought` | casts at the penalty |
| Strength | 1 | offense | might | false | `strengthCast` | `strengthCast` | `castRefused notFought` | casts at the penalty |
| Doze | 1 | offense | status | true | `castRefused combatOnly` | `dozed` | `castRefused notFought` | casts at the penalty |
| Freeze | 1 | offense | thrown | true | `castRefused combatOnly` | `spellThrown`/`spellHit`/`frozenSolid` | `castRefused notFought` | need −3 (6→3), dmg halved |
| Detect Magic | 1 | divination | reveal | false | `detectMagic` | `detectMagic` | `castRefused notFought` | casts at the penalty |
| Mirror Self | 1 | illusion | mirror | false | `mirrorSelf` | `mirrorSelf` | `castRefused notFought` | casts at the penalty |
| Stun | 1 | offense | stun | true | `castRefused combatOnly` | `stunned` | `castRefused notFought` | casts at the penalty |
| Weaken | 1 | offense | weaken | true | `castRefused combatOnly` | `weakened` | `castRefused notFought` | casts at the penalty |
| Acid | 2 | offense | acid | true | `castRefused combatOnly` | `acidApplied` | `castRefused notFought` | casts at the penalty |
| Stupidity | 2 | offense | stupid | true | `castRefused combatOnly` | `stupefied` | `castRefused notFought` | casts at the penalty |
| Blind | 3 | offense | blind | true | `castRefused combatOnly` | `blinded` | `castRefused notFought` | casts at the penalty |
| Shrink | 3 | offense | shrink | true | `castRefused combatOnly` | `shrunk` | `castRefused notFought` | casts at the penalty |
| Ice | 3 | offense | thrown | true | `castRefused combatOnly` | `spellThrown`/`spellHit`/`frozenSolid` | `castRefused notFought` | need −3 (6→3), dmg halved |
| Earthquake | 4 | offense | quake | true | `castRefused combatOnly` | `earthquake` | `castRefused notFought` | dmg (incl. self-dmg) halved |
| Noxious Vapor | 4 | offense | vapor | true | `castRefused combatOnly` | `vaporRolled` | `castRefused notFought` | casts at the penalty (no direct hero damage) |
| Fireballs | 4 | offense | volley | true | `castRefused combatOnly` | `volley` | `castRefused notFought` | each bolt's dmg halved |
| Petrify | 5 | offense | petrify | true | `castRefused combatOnly` | `petrified` | `castRefused notFought` | casts at the penalty |
| Insane | 2 | offense | insane | true | `castRefused combatOnly` | `insaneRolled` | `castRefused notFought` | casts at the penalty |
| Summon | 2 (★ Summoner: 1) | special | summon | false | `allyPending` | `allySummoned` | `castRefused notFought` | casts at the penalty |
| Fireball | 3 | offense | thrown | true | `castRefused combatOnly` | `spellThrown`/`spellHit` | `castRefused notFought` | need −3 (4→1), dmg halved |
| Major Heal | 3 | healing | heal | false | `healed` | `healed` | `castRefused notFought` | casts at the penalty |
| Bubble | 3 | protection | ward | false | `wardRaised` | `wardRaised` | `castRefused notFought` | casts at the penalty |
| Sense Danger | 3 | divination | foresee | false | `senseDanger` | `senseDanger` | `castRefused notFought` | casts at the penalty |
| Turn Walking Dead | 2 | protection | turn | true | `castRefused combatOnly` | `walkingDeadTurned` (else `nothingToTurn`) | `castRefused notFought` | casts at the penalty |
| Plane Gate | 3 | protection | gate | true | `castRefused combatOnly` | `planeGated` (else `gateRefused`) | `castRefused notFought` | casts at the penalty |
| Sense Presence | 2 | protection | senses | false | `sensesGained` | `sensesGained` | `castRefused notFought` | casts at the penalty |
| Phantom Host | 3 (★ Illusionist: 1) | illusion | summon | false | `allyPending` | `allySummoned` | `castRefused notFought` | casts at the penalty |
| Lightning | 4 | offense | thrown | true | `castRefused combatOnly` | `spellThrown`/`spellHit` | `castRefused notFought` | need −3 (4→1), dmg halved |
| Regeneration | 4 | healing | regen | false | `regenerationCast` | `regenerationCast` | `castRefused notFought` | casts at the penalty |
| Mangle | 5 | offense | thrown | true | `castRefused combatOnly` | `spellThrown`/`spellHit` | `castRefused notFought` | need −3 (4→1), dmg halved |
| Death | 5 | offense | death | true | `castRefused combatOnly` | `deathCast` | `castRefused notFought` | casts at the penalty |

Every combat-only cast outside combat is `castRefused {spell, reason:
"combatOnly"}` — no charge spent, zero rng, and (Earthquake/Death) no
self-harm for nothing (RESEARCH §4.4, closed this phase). No charges left →
`noChargesLeft`; unknown → `spellNotKnown`; above level → `spellAboveLevel`
(via `spellLevelFor`, override-aware); school not yet open → `spellSchoolLocked`.
Guard ladder order: `notFought` → `noChargesLeft` → `spellNotKnown` →
`spellAboveLevel` → `spellSchoolLocked` → `combatOnly`, then the cast.

## §3. Potions (`content/potions.js`, 10 rows)

Every potion is a buff/heal/curse effect usable from Gear **anywhere** —
outside combat, inside combat, and while pending (refused `notFought` like
every other combat action; a genuinely free action once Fight! is pressed).

| Potion | eff | Explore | Combat | Pending | Pilfer |
|---|---|---|---|---|---|
| Healing | heal | `healed` | `healed` | `useRefused notFought` | allowed (heals) |
| Cure Poison | poison | `cured` | `cured` | `useRefused notFought` | `useRefused pilfer` |
| Speed | speed | `itemUsed` (haste=50) | same | `useRefused notFought` | `useRefused pilfer` |
| Xtra Healing | full | `healed` | `healed` | `useRefused notFought` | allowed (heals) |
| Strength | strength | `itemUsed` (might+8) | same | `useRefused notFought` | `useRefused pilfer` |
| Cure Disease | disease | `cured` | `cured` | `useRefused notFought` | `useRefused pilfer` |
| Enlarge | enlarge | `itemUsed` (might+4) | same | `useRefused notFought` | `useRefused pilfer` |
| Acuteness | acute | `itemUsed` (acute=d8) | same | `useRefused notFought` | `useRefused pilfer` |
| Death | death | `died` | `died` | `useRefused notFought` | `useRefused pilfer` |
| Invisible | invis | `itemUsed` (invis=100) | same | `useRefused notFought` | `useRefused pilfer` |

## §4. Items with `use` (staves, cloaks, jewelry, scrolls, lockpicks)

**Staves (8, `content/treasure-tables.js`):** every staff is `kind:"staff"`
— refused `wrongClass` for a non-Magic-User (`c.cls !== "Magic User"`),
regardless of combat state. None of the eight carry an `every` cooldown in
current content data (only cloaks/jewelry do), so a staff is always ready
once class-eligible; the `cooldown {left}` mechanism is still exercised (a
future staff, or a save carrying one, could set `every`).

| Staff | use | Outside combat (MU) | In combat (MU) | Non-MU |
|---|---|---|---|---|
| Rowan Staff | dome | works (ward set) | works | `wrongClass` |
| Birch Staff | freeze | `useRefused combatOnly` | works (up to 2 asleep) | `wrongClass` |
| Walnut Staff | weaken | `useRefused combatOnly` | works (`weakened`) | `wrongClass` |
| Oak Staff | stone | `useRefused combatOnly` | works (`foeStoned`, up to 2) | `wrongClass` |
| Crystal Staff | invis | works (invis=100) | works | `wrongClass` |
| Poplar Staff | heal | works (`healed`) | works | `wrongClass` |
| Pine Staff | fire | `useRefused combatOnly` | works (`itemBurned`) | `wrongClass` |
| Cedar Staff | gas | `useRefused combatOnly` | works (up to all asleep) | `wrongClass` |

**Cloaks (8):** `cloakHeal`/`noCrit`/`cloakRegen`/`cloakArmor`/`fly` are
passive `eff` flags (no refusal concept — always on). Three carry a `use` +
`every` cooldown, open to EVERY class (not staff-gated):

- Cloak of Invisibility (`invis`, every 100)
- Cloak of Speed (`haste`, every 50)
- Cloak of Ether (`ether`, every 100)

None of the three are in `TARGETED_KINDS`, so all three work outside combat
too; on cooldown, `useRefused cooldown {left}`.

**Jewelry (8):** Ring of Power/Gauntlet of the Giant/Amulet of Light/Anklet
of Invisibility/Helm of Knowledge/Bracelet of Flight are passive `eff`
flags. Pendant of Fortitude (`use:"half"`, every 100, `c.halfNext=true`) is
open anywhere. Amulet of Stone (`use:"stone"`, every 200, `aoe:4`) is
`TARGETED_KINDS` — `useRefused combatOnly` outside combat; in combat, stones
up to 4 foes (§6, CMB-06).

**Scrolls:** `readScroll` — no scrolls → `scrollRefused noScrolls`; a Pilfer
→ `scrollRefused pilfer`; no Magic-User class and no Runes/Signs skill →
`scrollRefused noRunes`; Fight!-pending → `scrollRefused notFought`. An
afraid reader's scroll still casts normally — never `scrollRefused` for
fear. A combat-only spell unrolled outside combat is still consumed (the
scroll and its narration stay spent) but the CAST itself refuses
`castRefused combatOnly` (the guard lives inside `castSpell`, reached via
`readScroll`'s internal call) — `spellsUsed` is restored to its pre-scroll
value either way.

**Lockpicks:** passive (`hasPicks`), no `use`/refusal concept — consumed by
`openChest`'s lock-roll gate, not by `useItem`.

## §5. Class/race/sub-class active features

**Strike:** refused `wizard` (an attack-spell charge is available and
castable right now — melee with the staff instead once none is); afraid: to-hit
need −3, damage halved, never refused.

**Flee:** refused `samurai` (never flees). Cloaker: a free vanish before its
first landed blow (`fled {reason:"cloaker"}`); once opened, falls through to
the ordinary Thief roll. Round-1 tracked withdrawal: a clean `fled
{reason:"tracked"}` for most classes; a Master of Arms is denied
(`withdrawalDenied {reason:"masterOfArms"}`) and falls through to the
ordinary roll.

**Parley:** refused `ninja` (never speaks) and `masterOfArms` (attacks
without question) — narrated directly, before the one-attempt flag is set.
A second attempt in the same encounter → `parleyExhausted` (its own
self-explaining type, no `reason` field). Walking Dead is never-eligible —
`canParley` returns false silently for EVERYONE (canon, unconditional; no
button ever renders, so no refusal event is needed). A Wilmsry vs. Magical
→ `parleyRefused wilmsryVsMagical` (reachable only at full fluency, since
`canParley` itself blocks Magical below fluency 2).

**Sing (Bard only):** non-Bard → `actionRefused wrongClass`; still cooling
down (100-square cadence) → `actionRefused cooldown {left}`; ready → `sang`.

**Withdraw (Tracking skill):** the Tracking skill's own round-1 clean-exit
branch of Flee, above — no separate action, no separate refusal.

**Make Camp:** not enough rations for the whole party's night →
`campFailed {reason:"noRations", need, have, members?}`; otherwise a camped
`newDay`.

**Abandon:** always succeeds (routes straight to `die(..., "abandon", ...)`)
unless the run is already over (dead/won) — no refusal concept.

**Passive skills carry no refusal at all** (`content/skills.js`'s twelve
Fighter skills and nine Thief skills: Kata, Stealth, Death-touch, Agility,
Hardiness, Ambidextrous, Cooking, Language, Runes/Signs, Tracking, Climbing,
Leaping, Locks, Sewing, Night Vision, Heft, Acute Hearing, Silence) — they
are always-on modifiers to another roll (to-hit, dodge, lock-tier, etc.),
never a player-dispatched action with a button of their own.

## §5b. Penalties (not refusals) — Afraid

**Phobia = penalty, never a lost action** (D, user ruling 2026-09-16). This
is the ONE mechanic in this ledger that is deliberately absent from every
refusal table above.

- **Trigger:** a type-matched phobia, or Darkness while in the dark, or
  near-death (≤ `DEATH_PANIC_THRESHOLD` of maxWP) from the Death phobia —
  Hardiness halves the odds (a gated `rng.d(2)`).
- **Effect:** `combat.afraid = AFRAID_ROUNDS` (2). Every attack roll the
  player makes — strike AND thrown-spell — is HARDER: the game's to-hit is
  a LOW range (hit on roll ≤ need), so the target number SHRINKS by
  `AFRAID_TO_HIT_PENALTY` (3), floor 1 (`afraidNeed`). Every point of
  damage the hero deals directly — weapon strikes, thrown/Earthquake/Volley
  spell damage, the Pine Staff's fire — is halved (`AFRAID_DMG_DIV`=2,
  `Math.ceil`, floor 1, `afraidDamage`).
- **What stays fully allowed:** everything. Strike, cast, drink, read, use,
  flee, parley, sing — an afraid character does every one of these
  normally, at the penalty where one applies, and NEVER receives a
  `*Refused` event whose reason names fear.
- **Countdown:** ticks once per `foeTurn` round (the tail: ward → mirror →
  acute → foeEffect → afraid), `fearPassed` exactly once at 0; clears
  unconditionally with the combat at `endCombat`.
- **Chip:** `conditionsOf` surfaces `{key:"afraid", polarity:"bad",
  remaining, phobia}` — "Afraid · N rds".
- **Events:** `phobiaAfraid {rounds}` (trigger), `fearPassed` (countdown
  hits 0).
- **Declared fixtures:** `combat/lose` (seed 14), `combat/lose-apprentice`
  (seed 127), `magic/cast-damage` (seed 8) — action-path divergence records
  from action 0, landed in Plan 01; a new `combat/lose-plain` scenario (seed
  1119) restores byte-identical death-path coverage.

## §6. Effect expiry

Every timed field, its unit, where it ticks, where it clears, and this
phase's change (if any).

| Field | Unit | Ticks | Clears | Phase 31 change |
|---|---|---|---|---|
| `c.acute` (Acuteness) | rounds | per `foeTurn` round AND per exploration step (`move()`) | `endCombat` (unconditional) | **NEW — the headline fix.** Was set once (`rng.d(8)`) and never decremented or cleared; now finally counts down and clears. Key Decision: it starts counting the moment it's drunk from Gear (per-step tick), not only once a fight begins. |
| `c.ward` (Shield/Bubble/dome) | rounds (+ an hp pool) | per `foeTurn` round | `endCombat` (unconditional); self-clears via `wardShattered` at pool ≤ 0 | unchanged — now also surfaced as a `conditionsOf` chip (CMB-04) |
| `c.mirror` (Mirror Self) | rounds | per `foeTurn` round | `endCombat` (unconditional) | unchanged |
| `c.foeEffect` (a foe-inflicted debuff) | rounds | per `foeTurn` round (guarded against a same-turn double-tick) | `endCombat` (conditional) | unchanged |
| `c.regen` (Regeneration) | boolean, no round count | n/a — a flat per-`foeTurn` roll while true | `endCombat` (unconditional) | unchanged |
| `c.senses` (Sense Presence) | boolean, no round count | n/a | `endCombat` (unconditional) | unchanged |
| `combat.weakened` / `combat.foeToHitPenalty` (Weaken) | n/a — lives on `state.combat`, not `c` | n/a | implicitly, when `state.combat` is nulled | unchanged |
| `combat.afraid` (Phobia = penalty) | rounds | per `foeTurn` round (LAST in the tail) | `endCombat` (unconditional, with the combat object) | Phase 31 NEW (see §5b) |
| `c.haste` | squares | per exploration step | reaches 0 naturally | unchanged |
| `c.invis` | squares | per exploration step | reaches 0 naturally | unchanged |
| `c.ether` | squares | per exploration step | reaches 0 naturally | unchanged |
| `c.might` | "until tomorrow" | n/a | `newDay` (unconditional `c.might = 0`) | unchanged |
| `c.halfNext` (Pendant of Fortitude) | one-shot, not round-based | n/a — consumed on the NEXT hit received | consumed by `applyFoeDamageToPlayer` | out of CMB-05's round-based scope — a one-shot flag, not a timer |
| `c.flightLeft` / `c.flightCooldown` (Cloak of Flying) | squares | per exploration step | reaches 0 naturally | unchanged — not a combat effect at all |

## §7. Verified — not bugs

- **`itemReady`'s `state.steps`-keyed cooldown:** measured in squares
  walked, not combat rounds — a second use of an `every`-gated item within
  the SAME fight is correctly refused if the squares haven't elapsed. This
  is working as designed (every item's own flavor text says "once every N
  squares"), not the CMB-02 "always not ready" bug (that bug lived entirely
  in two PRESENTATION-layer copies — the Hero tab's collapsed
  `grimoireViewModel` reason string and the classic in-combat spell-menu
  filter's stale, override-unaware `canCast` — both outside this plan's
  engine-only scope, tracked for Plan 03's shell wiring).
- **The Hero-tab "On the combat screen" Grimoire message:** routing (cast
  from the combat menu instead), not a refusal.

## §8. Declared divergences

- **The three phobia fixtures** (`combat/lose`, `combat/lose-apprentice`,
  `magic/cast-damage`) — action-path records from action 0 under the Afraid
  ruling (Plan 01); this plan (02) adds NO new divergence — the thrown-spell
  penalty leaves `cast-damage`'s measured end state exactly as declared (the
  record is RE-VERIFIED, not re-measured: seed 8's d10 roll of 1 still lands
  at the shrunk need 3, and Freeze kills through `killFoe` regardless of the
  halved hp).
- **The Elven `foeToHit` flip** (−1 → +1, `content/races.js`) — a
  DELIBERATE canon deviation from the frozen 1994 prototype (the prototype's
  −1 made Elves HARDER to hit, contradicting its own flavor text and every
  design doc; see the DELIBERATE RULES CHANGE comment on the row itself).
  NO fixture impact: the only two Elven heroes in any parity fixture
  (chargen seed 13, encounters/faerie seed 38) never reach `foeToHitVs` —
  neither enters combat. Before/after: a plain Elf's foe-need was 5 (same as
  a Human, net-zero after the sign inversion), now 6 (genuinely one HIGHER
  — easier to hit, matching "thin-boned and easy to hit").
- `c.foresight` is consumed at Fight!-time (inside the `fight` action), not
  at the moment the encounter is glimpsed — a Plan 01 timing shift, zero
  fixture impact (nothing reads `c.foresight` between those two points).
- `encounterStarted` no longer carries `first`; the new `combatJoined
  {first}` event (pushed by `fight`) carries it instead.

## §9. Shell obligations for Plan 03

- Use button always visible (never omitted for a cooldown item); shows the
  countdown; tapping it on cooldown/wrongClass/combatOnly explains via toast.
- The in-combat SPELLS menu bridged to the engine's own `canCast`/
  `spellLevelFor` (closing the stale classic-script duplicate, RESEARCH §3.2)
  — the Grimoire's reason string split into its three distinct diagnostics
  instead of one collapsed "Not ready yet."
- Sing button with its cooldown countdown.
- The ward chip: "Shield · 34 hp · 3 rds" (both numbers at once, mirroring
  the existing `flight` two-number chip precedent).
- An "Acute" chip that visibly counts down, in and out of combat, and
  disappears with "The Acuteness wears off." when a fight ends or the
  counter hits 0.
