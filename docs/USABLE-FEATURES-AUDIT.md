# Usable Features Audit (Phase 31, CMB-02)

**Phase:** 31-combat-start-gating-effect-hygiene, Plan 02
**Date:** 2026-09-16

> **Status (v1.6, Phase 48):** audit record of Phase 31; the refusal vocabulary and every row are live. Refusals surface as RAIL lines / dull fight-log entries since Phase 35 (the toasts this doc cites were retired); the old toast module is `narrationLines.js` since Phase 46; §6's `c.haste`/`c.invis`/`c.ether`/`c.flightLeft`/`c.flightCooldown` rows name pre-Phase-39 counters that are `c.timers` records now (`foldLegacyCounters` folds a legacy save).

> A blocked button stays visible; tapping it dispatches; the engine's refusal
> event names the why; refusals are `PRIORITY.block` narration lines — a dull
> fight-log entry in combat, a RAIL line outside it — as direct replies to a
> tap.

This ledger enumerates every usable spell, item, gear piece, and class/race/
sub-class active feature, by circumstance, with the engine's refusal reason
for each blocked circumstance and (§6) an expiry entry for every timed
effect. `test/unit/usable-features-audit.test.js` is a table-driven,
doc-synced test that exercises each row and keeps this document honest.

## §1. Refusal vocabulary

One shared vocabulary across every gated action. Every reason below has its
own narration line + Oracle line (`src/browser/narrationLines.js` / `eventNarration.js`) —
never a generic "you can't do that."

| Reason | Carried by | Meaning | Event type(s) |
|---|---|---|---|
| `notFought` | `castRefused`, `useRefused`, `scrollRefused`, `actionRefused`, `strikeRefused`, `fleeRefused`, `parleyRefused` | the encounter is still a preview — Fight! has not been pressed | every combat-gated action, via the single `refuseIfPending` guard |
| `combatOnly` | `castRefused`, `useRefused` | a combat-only spell/targeted item used with no active encounter | `castRefused`, `useRefused` |
| `cooldown {left}` | `useRefused`, `actionRefused` | (Phase 39, GEAR-02: a `c.timers` duration+cooldown jewelry/cloak still cooling), or a Bard's song, still counting down; `left` is the exact squares remaining | `useRefused`, `actionRefused` |
| `recharging {left,charges,max}` | `useRefused` | (Phase 39, GEAR-02) an EMPTY staff still refilling its charge pool — `left` is the squares to the next charge, `charges`/`max` the current/full pool | `useRefused` |
| `wrongClass` | `useRefused`, `actionRefused` | a staff used by a non-Magic-User; Sing attempted by a non-Bard | `useRefused`, `actionRefused` |
| `noCharges` | (its own event, not this reason string) | see `noChargesLeft` below | `noChargesLeft` |
| `noTarget` | (mostly its own dedicated event) | a targeted effect with nothing to target | `nothingToThrowAt`, `insaneNoTarget`, `nothingToTurn`, `gateRefused` — **unreachable for the four common targeted kinds (thrown/acid/blind/petrify) in combat**: `castSpell` retargets a dead `C.target` onto the first live foe exactly like `playerStrike`, the same way a Strike never whiffs on a corpse |
| `pilfer` | *(superseded, Phase 75.1)* | **Superseded by Phase 75.1 (RULES-09/RULES-10):** the `useRefused pilfer` heal-only refusal AND the `scrollRefused pilfer` refusal are BOTH gone — a Pilfer uses every magic item under the normal rules (see `pilferFumbled` below for its new risk) and reads every scroll under the same intelligence rule as everyone else (see the Scrolls section below) | *(retired)* |
| *(its own event, not a reason string)* | `pilferFumbled` | (RULES-09, Phase 75.1) a Pilfer's use of a jewel/cloak/staff rolls a derived d20; on a 1 the use fails, the item explodes for a d10 to the Pilfer only (no armor/ward soak) and turns to dust — potions, scrolls and tools never roll this die | `pilferFumbled` |
| notWorn | useRefused | (Phase 37, GEAR-03; 260918-w4n) a cloak/jewelry activatable used from the BAG while the character is on the worn-slot model — activatables must be worn to work; legacy states (no c.worn) keep bag-use. A staff is NEVER refused this way (it has no `c.worn` slot; see `notWielded` below for its own bag-use refusal) | useRefused |
| `notWielded` | `useRefused` | (RULES-13, Phase 75, user 2026-09-25) a staff addressed by BAG INDEX that is not the currently-wielded one (`wieldedStaff(c) !== it`) — a staff's charged power works only while equipped into the weapon slot; reverses the 2026-09-18 bag-use amendment. The wielded staff, addressed via `{ slot: "weapon" }`, is unaffected | `useRefused` |
| `exploreOnly` | *(reserved)* | no current engine emitter uses this reason — every existing combat-flavored action is gated the other direction (`combatOnly`), not this one | — |
| `abilityRefused` reasons | `abilityRefused` | (Phase 38, ABIL-01/04) the ABILITIES submenu's own ladder: `unknown` (not in the catalog, or not owned) · `cooldown {left}` (rounds remaining — the canon "Your arm has opinions." line) · `notInCombat` (no active encounter) · `noTarget` (structurally unreachable in combat, same reasoning as `castSpell`'s own retarget) · `notLowEnough` (Last Stand above a quarter hp, payload `have`/`max`) — plus the shared `notFought` above. Every reason names the ability; rows stay TAPPABLE on cooldown (never disabled) — the dispatch itself is the refusal | `abilityRefused` |

`noChargesLeft` / `spellNotKnown` / `spellAboveLevel` / `spellSchoolLocked`
already self-explain via their OWN dedicated event type + copy — they are
NOT folded into `castRefused` (RESEARCH §2: "extend, don't replace"; four
already-tested, already-narrated shapes with no clarity gain from a rename).

**Fear is a penalty, not a refusal — see §5b.** No refusal reason anywhere
in the engine is named after fear (`frozen`/`afraid` never appear as a
`reason` value); grep confirms zero occurrences in `engine/*.js`.

## §2. Spells (`content/spells.js`, 33 rows — Phase 40 adds Lesser Summon)

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
| Map the Floor (was Detect Magic) | 1 | divination | reveal | false | `detectMagic` | `detectMagic` | `castRefused notFought` | casts at the penalty |
| Mirror Self | 1 | illusion | mirror | false | `mirrorSelf` | `mirrorSelf` | `castRefused notFought` | casts at the penalty |
| Stun | 1 | offense | stun | true | `castRefused combatOnly` | `stunned` | `castRefused notFought` | casts at the penalty |
| Weaken | 1 | offense | weaken | true | `castRefused combatOnly` | `weakened` | `castRefused notFought` | casts at the penalty |
| Acid | 2 | offense | acid | true | `castRefused combatOnly` | `acidApplied` | `castRefused notFought` | casts at the penalty |
| Stupidity | 2 | offense | stupid | true | `castRefused combatOnly` | `stupefied` | `castRefused notFought` | casts at the penalty |
| Blind | 3 | offense | blind | true | `castRefused combatOnly` | `blinded` | `castRefused notFought` | casts at the penalty |
| Shrink | 3 | offense | shrink | true | `castRefused combatOnly` | `shrunk` | `castRefused notFought` | casts at the penalty |
| Ice | 3 | offense | dot | true | `castRefused combatOnly` | `iceApplied` (Plan 02) | `castRefused notFought` | need −3 (6→3), dmg halved |
| Earthquake | 4 | offense | quake | true | `castRefused combatOnly` | `earthquake` | `castRefused notFought` | dmg (incl. self-dmg) halved |
| Noxious Vapor | 4 | offense | vapor | true | `castRefused combatOnly` | `vaporRolled` | `castRefused notFought` | casts at the penalty (no direct hero damage) |
| Fireballs | 4 | offense | volley | true | `castRefused combatOnly` | `volley` | `castRefused notFought` | each bolt's dmg halved |
| Petrify | 5 | offense | petrify | true | `castRefused combatOnly` | `petrified` | `castRefused notFought` | casts at the penalty |
| Insane | 2 | offense | insane | true | `castRefused combatOnly` | `insaneRolled` | `castRefused notFought` | casts at the penalty |
| Summon | 2 | special | summon | false | `allyPending` | `allySummoned` | `castRefused notFought` | casts at the penalty |
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
| Lesser Summon (new, Phase 40) | 1 | special | summon | false | `allyPending` | `allySummoned` | `castRefused notFought` | casts at the penalty |

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

**RULES-09 (Phase 75.1):** a potion never fumbles, for a Pilfer or anyone —
the "Pilfer" column below is allowed for every row (identical to any other
sub-class); the superseded per-row `useRefused pilfer` refusal is gone.

| Potion | eff | Explore | Combat | Pending | Pilfer |
|---|---|---|---|---|---|
| Healing | heal | `healed` | `healed` | `useRefused notFought` | allowed |
| Cure Poison | poison | `cured` | `cured` | `useRefused notFought` | allowed |
| Speed | speed | `itemUsed` (haste=50) | same | `useRefused notFought` | allowed |
| Xtra Healing | full | `healed` | `healed` | `useRefused notFought` | allowed |
| Strength | strength | `itemUsed` (might+8) | same | `useRefused notFought` | allowed |
| Cure Disease | disease | `cured` | `cured` | `useRefused notFought` | allowed |
| Enlarge | enlarge | `itemUsed` (might+4) | same | `useRefused notFought` | allowed |
| Acuteness | acute | `itemUsed` (acute=d8) | same | `useRefused notFought` | allowed |
| Death | death | `died` | `died` | `useRefused notFought` | allowed |
| Invisible | invis | `itemUsed` (invis=100) | same | `useRefused notFought` | allowed |

## §4. Items with `use` (staves, cloaks, jewelry, scrolls, lockpicks)

**Staves (8, `content/treasure-tables.js`):** every staff is `kind:"staff"`
— refused `wrongClass` for a non-Magic-User (`c.cls !== "Magic User"`),
regardless of combat state. None of the eight carry an `every` cooldown in
current content data (only cloaks/jewelry do), so a staff is always ready
once class-eligible; the `cooldown {left}` mechanism is still exercised (a
future staff, or a save carrying one, could set `every`). RULES-13 (Phase
75, Plan 09): a staff's charged power works ONLY while WIELDED
(`c.weapon`/`c.staff`, addressed via `useItem({ slot: "weapon" })`) — the
"Outside combat (MU)" / "In combat (MU)" columns below assume the staff is
wielded. Addressed by BAG INDEX instead, any staff (any class, any combat
state) is refused `notWielded` before any side effect — see §1.

| Staff | use | Outside combat (MU, wielded) | In combat (MU, wielded) | Non-MU | Bagged, unwielded (any class) |
|---|---|---|---|---|---|
| Rowan Staff | dome | works (ward set) | works | `wrongClass` | `useRefused notWielded` |
| Birch Staff | freeze | `useRefused combatOnly` | works (up to 2 asleep) | `wrongClass` | `useRefused notWielded` |
| Walnut Staff | weaken | `useRefused combatOnly` | works (`weakened`) | `wrongClass` | `useRefused notWielded` |
| Oak Staff | stone | `useRefused combatOnly` | works (`foeStoned`, up to 2) | `wrongClass` | `useRefused notWielded` |
| Crystal Staff | invis | works (invis=100) | works | `wrongClass` | `useRefused notWielded` |
| Poplar Staff | heal | works (`healed`) | works | `wrongClass` | `useRefused notWielded` |
| Pine Staff | fire | `useRefused combatOnly` | works (`itemBurned`) | `wrongClass` | `useRefused notWielded` |
| Cedar Staff | gas | `useRefused combatOnly` | works (up to all asleep) | `wrongClass` | `useRefused notWielded` |

**RULES-09 (Phase 75.1):** a staff is one of the three `PILFER_FUMBLE_KINDS`,
but a Pilfer is a Thief — `wrongClass` always fires first, so a Pilfer's
staff fumble is a flagged assumption, never reachable in play.

**Cloaks (7 — the dropped healing cloak was removed by the user on
2026-09-18, quick 260918-w4n; CLOAKS was 8):** 260918-w4n (use-activated-
only): every row is act-only now — there are no more passive `eff` flags.
Worn AND used starts the item's own `item:<name>` c.timers record, which
then starts the cooldown; a bagged or worn-but-unused cloak grants nothing.
All seven work from ANY class (not staff-gated), open outside combat (none
are `TARGETED_KINDS`); on cooldown, `useRefused cooldown {left}`:

- Cloak of Strength (`brace`, effect 50 / cd 50 — no critical lands on you)
- Cloak of Invisibility (`invis`, every 100)
- Cloak of Speed (`haste`, every 50)
- Cloak of Regeneration (`knit`, effect 0 / cd 20 — a flat d6 hp back on use)
- Cloak of Armor (`plate`, effect 50 / cd 50 — soaks as Plate while live)
- Cloak of Flying (`fly`, effect 20 / cd 50 — the old climb/gorge
  auto-activation is REMOVED; only `useItem` on the worn cloak starts flight)
- Cloak of Ether (`ether`, 10 squares through solid stone, cd 80; fatal if it ends inside a wall — 260919-00d)

**Jewelry (8):** 260918-w4n: Ring of Power (`power`, effect 50 / cd 50),
Gauntlet of the Giant (`giant`, effect 50 / cd 50), Amulet of Light
(`glow`, effect 50 / cd 50 — also dispels `c.darkFor` at once), Anklet of Invisibility
(`unseen`, effect 50 / cd 50), Helm of Knowledge (`tongue`, effect 50 / cd
50), and Bracelet of Flight (`fly`, effect 20 / cd 50 — mirrors the Cloak
of Flying exactly, same auto-activation removal) are ALL act-only now, worn
AND used, same as the cloaks above — there are no more passive `eff` flags
anywhere in JEWELRY either. Pendant of Fortitude (`use:"half"`, every 100,
`c.halfNext=true`) is open anywhere. Amulet of Stone (`use:"stone"`, every
200, `aoe:4`) is `TARGETED_KINDS` — `useRefused combatOnly` outside combat;
in combat, stones up to 4 foes (§6, CMB-06).

**Staff amendment, REVERSED (RULES-13, Phase 75, user 2026-09-25):** the
260918-w4n amendment above ("a staff is not equipable at all") is reversed.
A Magic User equips a staff into the WEAPON slot (`equipItem`/`takeLoot`,
displacing the current weapon to the bag); it fights as a flat d8 melee
weapon (need 0, crit 1, max 8) and its charged power is usable ONLY from
that wielded slot (`useItem({ slot: "weapon" })`). A staff is still never a
`c.worn` entry — it lives on the scalar `c.weapon`/`c.staff` pair, tracked
independently of the cloak/jewelry worn-slot model. A staff left in
`c.items` (unequipped) is refused `notWielded` when used by bag index — see
§1 and the table above. Charges/recharge are unchanged either way.

**Jewelry merge (260918-wy1):** the former four jewelry sub-slots
(ring/bracelet/amulet/helm) are gone — `WORN_SLOTS` is now three keys:
`jewelry1`/`jewelry2`/`cloak`. A character can wear worn (jewelry) — up to
two pieces, any combination of the 8 JEWELRY rows — plus one cloak; see
`docs/GEAR-SLOTS.md` §8 for the full model.

**Scrolls (RULES-10, Phase 75.1 — `canRead` is gone):** `readScroll` — no
scrolls → `scrollRefused noScrolls`; Fight!-pending →
`scrollRefused notFought`. Those are the ONLY two `scrollRefused` reasons
left: **anyone** may now attempt any scroll, and the scroll is consumed on
every attempt, success or failure. `scrollReaderOf(c)` picks the path: a
Magic User always reads automatically (`scrollRead {reader:"magicUser"}`,
unchanged); a non-Magic-User carrying Runes/Signs also reads automatically
(`scrollRead {reader:"runes"}`, no grimoire copy); everyone else — including
a Pilfer, whose old blanket refusal is retired — rolls their own
intelligence (`scrollRead {reader:"intel"}`) on a d20 via a derived stream
(`scrollReadRng`), against `scrollReadBands(c.intel)` (no intel-12 floor: low
intel just means worse odds, all the way down). At or above the target it
decrypts (`scrollDeciphered`) and casts free; below that but at or above
half the target (rounded up) it garbles (`scrollGarbled` — a plain failure,
never worded as a refusal, never naming the spell, casts nothing); below
half it fumbles (`scrollFumbled` — outside combat it just fizzles,
`fizzled: true`; in combat `engine/scrollFumble.js#resolveScrollFumble` turns
it against the reader, their whole side, or the combat's targeted foe). A
plain failure or a fumble in combat still spends the reader's turn (the foes
act) exactly like a successful read would. An afraid reader's scroll still
casts (or garbles/fumbles) normally — never `scrollRefused` for fear. A
combat-only spell unrolled outside combat is still consumed (the scroll and
its narration stay spent) but the CAST itself refuses `castRefused
combatOnly` (the guard lives inside `castSpell`, reached via `readScroll`'s
internal call) — `spellsUsed` is restored to its pre-scroll value either
way.

**Scroll scribing gate (Phase 40, SPELL-07):** a scroll's spell is copied
into a Magic User's grimoire ONLY when it is already castable — the exact
same two checks `canCast` uses (`spellLevelFor(c.sub, sp) <= c.level && c.level
>= schoolGate(c.sub, sp.s)`). When the caster can learn the school but is not
yet leveled or gated enough, the scroll is NOT scribed — it pushes
`scrollTooAdvanced { spell, need, have, school }` (`need` is the higher of the
two checks) and falls through to the existing free-cast path unchanged (the
scroll still pays for itself once). A spell the caster's sub cannot learn at
all (`canLearn` false) is unaffected — same free cast as always, no
`scrollTooAdvanced`. Old saves that already carry a scribed-but-uncastable
entry from before this phase are untouched (tolerant, no migration) — the
next cast attempt refuses with the existing `spellSchoolLocked`/
`spellAboveLevel`, which already names the level needed.

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
| `c.haste` (pre-Phase-39 counter — now a `c.timers` record) | squares | per exploration step | reaches 0 naturally | unchanged |
| `c.invis` (pre-Phase-39 counter — now a `c.timers` record) | squares | per exploration step | reaches 0 naturally | unchanged |
| `c.ether` (pre-Phase-39 counter — now a `c.timers` record) | squares | per exploration step | reaches 0 naturally | unchanged |
| `c.might` | "until tomorrow" | n/a | `newDay` (unconditional `c.might = 0`) | unchanged |
| `c.halfNext` (Pendant of Fortitude) | one-shot, not round-based | n/a — consumed on the NEXT hit received | consumed by `applyFoeDamageToPlayer` | out of CMB-05's round-based scope — a one-shot flag, not a timer |
| `c.flightLeft` / `c.flightCooldown` (Cloak of Flying; pre-Phase-39 counters — now a `c.timers` record) | squares | per exploration step | reaches 0 naturally | unchanged — not a combat effect at all |

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
  countdown; tapping it on cooldown/wrongClass/combatOnly explains via a rail line.
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
