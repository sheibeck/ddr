# Gear Balance (Phase 39 ledger)

**Phase:** 39-gear-magic-items-one-shot-tools
**Date:** 2026-09-18

> **Status (v1.6, Phase 48):** design record of Phase 39; the rules are live. "What stays for the cleanup milestone" is done — Phases 44/47 deleted the classic duplicates it names; the old toast module and its builder table are `narrationLines.js`/`LINE_FOR` since Phase 46, and toasts gave way to the RAIL in Phase 35.

This ledger declares Phase 39's GEAR-01 before/after — the weapon `need`/
`crit` axes, the armor `bulk` axis, the `expectedStrike` upgrade heuristic,
the tuning bot's new buy/equip policy, and a 143-cell × 3-seed smoke run
against the v1.5 BEFORE pin. Plans 03–05 append their own sections below
this one (GEAR-02 activation model, GEAR-05 one-shot tools, chips/row
states, the Requirements map) — this file is never rewritten wholesale.

**Once-a-day ruling (user, 2026-09-18):** 100 squares is one day. Every
activatable item this milestone adds — cloaks, jewelry, staff charges,
potions with a duration, the GEAR-05 tools — must be usable at least once a
day: `effect + cd <= 100` squares for a duration+cooldown item, `recharge
<= 100` squares per charge for a staff. This is a GEAR-02 (Plan 03) number;
recorded here once so Plan 03 has the ledger anchor (39-CONTEXT.md
"Post-planning ruling — ONCE A DAY").

## Canon change (GEAR-01)

> "The problem with - to hit is that our current hit ranges are lowest
> never hits. A range of 1-6 is a hit with a to hit penalty is brutal at
> low levels. But still seems best. Remember, that would make it a + to
> hit as a penalty instead of minus. So, go with option #1" — user,
> 39-CONTEXT.md Area 3

Weapons gain a to-hit `need` axis (`-2..+1`) and a `crit` axis (`1|2`);
armor gains a `bulk` axis (`0|1|2`).

- **`need`** is a modifier on the to-hit NEED, never on the roll — the
  to-hit is a LOW range (`roll <= need` lands a blow), so a light weapon's
  bonus is `need: +1` (raises the need, easier to hit) and a heavy
  weapon's penalty is `need: -1`/`-2` (lowers the need, harder to hit),
  floored at 1 after every class's base need. This is the exact arithmetic
  direction the Phase 31 `afraidNeed` penalty already uses ("penalties
  shrink the need") — see "Need vs die" below.
- **`crit`** is the die-roll range (1 or 2) that doubles the character's
  own weapon damage. Five precise blades — Rapier, Katana, Wakazashi,
  Ninja-to, Dagger — crit on a roll of 1 OR 2; every other weapon
  (including the Whip, a light weapon that is not a blade) still crits
  only on a natural 1.
- **`bulk`** (armor) is added to the climb/leap roll comparison the way
  `heightsPenalty`/`waterPenalty` already are (`engine/movement.js`),
  subtracted from the flee roll (`engine/combat.js#flee`,
  `roll + bonus - bulk >= 11`), and `bulk >= 2` gates the Thief
  Stealth/backstab "heavy armor" checks — a generalization of the old
  hard-coded Plate-name check, not a new rule (Studded/Mail, bulk 1,
  behave exactly as before).

## Need vs die — the equivalence, once

"+1 to hit" seen from the die is the same rule as "+1 to the need" seen
from the target number — a bigger number to roll under is a bonus, a
smaller one is a penalty. This project writes every to-hit modifier on the
NEED, never on the roll. Nobody re-litigates this.

## Weapons — before / after

All 24 `content/weapons.js` rows. BEFORE is `git show d117782:content/weapons.js`
(the last pre-phase commit — 39-01-PLAN.md's own frozen baseline). `need`/
`crit` are the two new AFTER-only axes. `T0..T3` mark the AFTER cost's
membership in `STORE_WEAPON_BANDS` (`[0,250] [100,500] [200,700] [400,900]`,
inclusive — a class's own store roll may still fall back to "every legal
weapon <= hi" when fewer than 2 legal weapons sit in a band, per
`engine/economy.js#storeWeaponPool`'s documented fallback).

| Weapon | cls | before dice (mean) | before cost | after dice (mean) | after cost | need | crit | T0 | T1 | T2 | T3 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Axe | FTM | d6 (3.5) | 50 | d6 (3.5) | 50 | +0 | 1 | ✓ | | | |
| Bastard Sword | F | 2d6 (7.0) | 675 | 2d8+1 (10.0) | 650 | -1 | 1 | | | ✓ | ✓ |
| Battle Axe | F | d6+1 (4.5) | 250 | 2d6+1 (8.0) | 325 | -1 | 1 | | ✓ | ✓ | |
| Broadsword | F | d10+2 (7.5) | 500 | d10+2 (7.5) | 550 | +0 | 1 | | | ✓ | ✓ |
| Claymore | F | d12 (6.5) | 800 | d12+2 (8.5) | 800 | +0 | 1 | | | | ✓ |
| Dagger | FTM | d6/2 (2.0, halved) | 75 | d6/2 (2.0, halved) | 75 | +1 | 2 | ✓ | | | |
| Katana | FT | d10 (5.5) | 525 | d10+1 (6.5) | 650 | +1 | 2 | | | ✓ | ✓ |
| Kopesh Sword | F | d10 (5.5) | 525 | d12+3 (9.5) | 500 | -1 | 1 | | ✓ | ✓ | |
| Long Sword | FT | d8 (4.5) | 500 | d8+2 (6.5) | 400 | +0 | 1 | | ✓ | ✓ | ✓ |
| Ninja-to | FT | d8+1 (5.0) | 450 | d8+1 (5.5) | 475 | +1 | 2 | | ✓ | ✓ | ✓ |
| Rapier | FTM | d6 (3.5) | 200 | d6 (3.5) | 200 | +1 | 2 | ✓ | ✓ | ✓ | |
| Short Sword | FTM | d6+1 (4.0) | 250 | d6+2 (5.5) | 250 | +0 | 1 | ✓ | ✓ | ✓ | |
| Wakazashi | FT | d6+1 (4.0) | 300 | d6+1 (4.5) | 350 | +1 | 2 | | ✓ | ✓ | |
| Club | FTM | d6 (3.5) | 25 | d6 (3.5) | 25 | +0 | 1 | ✓ | | | |
| Flail | FT | d8+2 (6.5) | 175 | d10+2 (7.5) | 250 | -1 | 1 | ✓ | ✓ | ✓ | |
| Mace | FT | d6+2 (5.5) | 125 | d8+1 (5.5) | 125 | -1 | 1 | ✓ | ✓ | | |
| Morning Star | FT | d8+1 (5.5) | 150 | d8+2 (6.5) | 175 | -1 | 1 | ✓ | ✓ | | |
| Quarter Staff | FTM | d6 (3.5) | 25 | d6 (3.5) | 25 | +0 | 1 | ✓ | | | |
| Spiked Staff | FTM | d8 (4.5) | 150 | d8 (4.5) | 100 | -1 | 1 | ✓ | ✓ | | |
| Whip | FT | d6/2 (2.0, halved) | 35 | d6/2 (2.0, halved) | 35 | +1 | 1 | ✓ | | | |
| Awl Pike | FT | d8+2 (6.5) | 400 | 2d6+2 (9.0) | 400 | -1 | 1 | | ✓ | ✓ | ✓ |
| Bardiche | F | 2d8 (9.0) | 900 | 2d10+2 (13.0) | 900 | -2 | 1 | | | | ✓ |
| Naganita | F | 2d6+1 (8.0) | 600 | 2d8+2 (11.0) | 750 | -1 | 1 | | | | ✓ |
| Spear | FTM | d8 (4.5) | 150 | d8 (4.5) | 150 | +0 | 1 | ✓ | ✓ | | |

`WEAPON_MAX` was recomputed from the AFTER dice; the 24 keys, their
object-literal order, and every `cls` string are pinned byte-identical
between BEFORE and AFTER (load-bearing — `openStore`'s shuffle and
`rollBlade`'s pick both index `Object.keys(WEAPONS)` by position).

## Armor — before / after

Only `bulk` is new; `cost`/`wp`/`ar`/`cls`/`min` are unchanged from
`git show d117782:content/armors.js`.

| Armor | cls | min | AR | WP | cost | bulk (new) |
|---|---|---|---|---|---|---|
| Cloth | FTM | 1 | 3 | 12 | 300 | 0 |
| Leather | FT | 1 | 6 | 15 | 500 | 0 |
| Studded | FT | 2 | 10 | 18 | 750 | 1 |
| Mail | F | 3 | 12 | 30 | 1000 | 1 |
| Plate | F | 4 | 15 | 45 | 2000 | 2 |

Bulk's three consumers:

| Consumer | File:line | Effect |
|---|---|---|
| Climb roll | `engine/movement.js` (the climb `r` comparison, alongside `heightsPenalty`/`waterPenalty`) | `armorBulk(state.c)` added to `r` |
| Leap roll | `engine/movement.js` (the leap `r` comparison) | `armorBulk(state.c)` added to `r` |
| Flee roll | `engine/combat.js#flee` | `roll + fleeBreakdown(c).bonus >= 14` (bulk is one of the named modifiers — see docs/FLEE.md) |
| Thief Stealth/backstab gate (hero + member) | `engine/combat.js` (heavy-armor gate, hero strike and member strike) | denied when `armorBulk(c) >= 2` |

## Weapons/armor — per-class picks

**BEFORE** (single dominant pick per tier, the old raw-max-damage
heuristic — no need/crit axis existed, so hit chance was flat across every
weapon and only `WEAPON_MAX` mattered): for Fighter/Thief tier 0–1, the
**Flail** (`d8+2`, max 10, cost 175) strictly dominates every cheaper or
similarly-priced FT weapon — Mace (max 8, 125), Morning Star (max 9, 150),
and even the pricier Long Sword (max 8, cost 500) — there was no reason to
buy anything else at that price point. The same pattern holds everywhere:
whichever weapon has the single highest `WEAPON_MAX` at or under a given
budget is *the* pick, full stop — there was never a second genuinely
different option.

**AFTER** (`expectedStrike` at level 1/3/5 — `d20`/`d10`/`d6` strike dice —
for a Human of the class with prof 0, measured live via a `node -e` script
over `engine/derived.js#expectedStrike`, never hand-computed): every tier
now offers a heavy (need < 0), a neutral (need 0) and a light/precise
(need +1, crit 2) role, and which one wins moves with level.

### Fighter (classNeed 5)

Tier 0 (cost ≤ 250) — heavy Flail (250), neutral Short Sword (250), light
Rapier (200):

| Weapon | L1 | L3 | L5 |
|---|---|---|---|
| Flail (heavy) | 2.125 | 8.250 | 27.083 |
| Short Sword (neutral) | 1.950 | 8.700 | 30.500 |
| Rapier (light) | 1.800 | 10.000 | 38.000 |

Tier 3 (cost 400–900) — heavy Bardiche (900), neutral Claymore (800),
light Katana (650):

| Weapon | L1 | L3 | L5 |
|---|---|---|---|
| Bardiche (heavy) | 2.800 | 8.800 | 25.333 |
| Claymore (neutral) | 2.850 | 10.500 | 33.500 |
| Katana (light) | 3.000 | 12.400 | 42.000 |

Reading: at level 1 the three roles sit within ~20% of each other (Flail
2.125 vs Rapier 1.80 in tier 0 — Flail is 18% ahead; Bardiche/Claymore/
Katana are within 7% of each other in tier 3, the flat `level*level` term
already dominating). By level 5 the precise blade is clearly ahead in both
tiers (Rapier 38.0 vs Flail 27.1 — 40% ahead; Katana 42.0 vs Bardiche 25.3
— 66% ahead): the +1 need and crit-2 scale with the shrinking strike die
while flat damage (`level*level`) swamps the dice, so the heavy weapons
read as the early-game budget damage and the precise blades as the
investment.

**The two kits that START heavy (Knight/Awl Pike, Barbarian/Battle Axe)**
net out AT OR ABOVE their pre-phase level-1 EV, because their dice rose
more than the need fell (measured live via the same `expectedStrike` call
with the OLD dice/need/crit swapped in for the one comparison, then
restored):

| Kit | Pre-phase L1 EV | Post-phase L1 EV |
|---|---|---|
| Knight / Awl Pike | 2.250 | 2.500 |
| Barbarian / Battle Axe | 1.650 | 2.250 |

### Thief (classNeed 4)

Tier 0 (cost ≤ 250) — heavy Flail (250), neutral Short Sword (250), light
Rapier (200):

| Weapon | L1 | L3 | L5 |
|---|---|---|---|
| Flail (heavy) | 1.700 | 6.600 | 21.667 |
| Short Sword (neutral) | 1.625 | 7.250 | 25.417 |
| Rapier (light) | 1.575 | 8.750 | 33.250 |

Tier 3 (cost 400–900) — heavy Awl Pike (400), neutral Long Sword (400),
light Katana (650):

| Weapon | L1 | L3 | L5 |
|---|---|---|---|
| Awl Pike (heavy) | 2.000 | 7.200 | 22.667 |
| Long Sword (neutral) | 1.875 | 7.750 | 26.250 |
| Katana (light) | 2.625 | 10.850 | 36.750 |

Same crossover shape as Fighter (a Thief's lower classNeed shrinks every
number but not the ordering).

### Magic User (classNeed 3)

Tier 0 (cost ≤ 250) — heavy Spiked Staff (100), neutral Short Sword (250)
or Spear (150), light Rapier (200):

| Weapon | L1 | L3 | L5 |
|---|---|---|---|
| Spiked Staff (heavy) | 0.825 | 4.050 | 14.750 |
| Spear (neutral) | 1.100 | 5.400 | 19.667 |
| Short Sword (neutral) | 1.300 | 5.800 | 20.333 |
| Rapier (light) | 1.350 | 7.500 | 28.500 |

**Honest finding, not fixed this plan:** every Magic User-legal weapon
costs 250 wilmst or less — none reaches the 400-wilmst floor of tier 3, so
a Magic User's store roll at tier 3 falls back to "every legal weapon
costing ≤ 900" (the same list as tier 0–2) per `storeWeaponPool`'s
documented fewer-than-2-legal-weapons fallback. A Magic User's weapon
choice never actually deepens past tier 0's own three roles. This is a
content-table gap (no M-legal weapon exists in the 300–900 range), not a
`chooseStorePurchase` bug — flagged for whoever tunes weapon rebanding
next, out of this plan's scope.

## No class below need 2

`CLASSES[cls].toHit + weaponNeedMod(weapon)`, minimum over every
CLASS-LEGAL weapon (proved by `test/unit/gear-axes.test.js`'s "Test 3:
floor guarantee — no legal (class, weapon) pair yields a base need below
2"):

| Class | Base need | Heaviest legal weapon | Need mod | Floor |
|---|---|---|---|---|
| Fighter | 5 | Bardiche | -2 | **3** |
| Thief | 4 | (several, e.g. Awl Pike/Flail/Mace) | -1 | **3** |
| Magic User | 3 | Spiked Staff | -1 | **2** |

No legal (class, weapon) pair ever produces a need below 2 — the Bardiche
is the sole `-2` weapon in the whole table and it is Fighter-only.

## Corrections to CONTEXT (verified in code)

**(a) The hero's own crit does NOT stack for a Soldier wielding a precise
blade.** The hero's crit line (`engine/combat.js`, `playerStrike`) is
`roll <= weaponCrit(c) && !noCrit`, and `noCrit` is true for
`c.sub === "Soldier"` (and `"Guard"`, and darkness without Night Vision,
and, until quick 260928-cos, a `noCrit`-carrying item — that clause was the
inverted Cloak of Strength and is gone) — a Soldier's own blows NEVER crit,
regardless of the weapon's `crit` axis. The line
`roll <= 2 && c.sub === "Soldier"` (`engine/combat.js`, the foe-turn
damage-doubling check) is the FOE'S crit chance AGAINST a Soldier hero
(the sub's documented "bad" in `docs/CLASS-PASS.md`'s good/bad table) —
not the hero's own crit range. 39-CONTEXT.md's "Soldier stacks to 1–3"
reading does not apply and is not implemented.

**(b) Rolled staves already carry a cooldown today.** `engine/items.js`'s
`rollStaff` (line 116) and `engine/encounters.js`'s find-a-Staff branch
(line 403) both construct every rolled staff as
`Object.assign({ kind: "staff", every: 250 }, STAVES[...])` — a 250-square
single cooldown already exists. 39-CONTEXT.md's "infinite Pine Staff
fireballs" reading described `itemReady`'s pre-Phase-36 behaviour when
`every` is ABSENT, which is not the case for a rolled staff. Plan 03's
charge-pool model (GEAR-02) REPLACES this single 250-square cooldown with
a small per-staff charge pool that recharges one charge every ≤ 100
squares (the once-a-day ruling above) — recorded there, not here.

## Upgrade heuristic

`expectedStrike(c, base, bonus, prof)` (`engine/derived.js`) is the ONE
"how good is this weapon for this character, right now" number: expected
damage PER SWING, folding hit chance, crit chance, and average damage
together —

```
need  = max(1, classNeed(c) + weaponNeedMod(base))
hitP  = min(1, need / strikeDie(c))
critP = noCrit(c) ? 0 : min(hitP, weaponCrit(base) / strikeDie(c))
avg   = mean of the weapon's dice (halve-aware)
flat  = level² + race dmg/wpnBonus + Heft(2) + Master of Arms(2) + eff dmg/size − Guard's early penalty
EV    = (hitP + critP) * max(1, flat + avg + bonus + prof)
```

`weaponUpgradeDelta(c, it)` (`engine/items.js`) = `expectedStrike` of the
candidate item minus `expectedStrike` of the currently-wielded weapon,
rounded to 2 decimals — the ONE "is this weapon better" rule `takeItem`,
`lootCompare` ("+N a swing" line), and the tuning bot's
`chooseStorePurchase` (below) all share.

## Tuning-bot policy (Plan 02)

`chooseStorePurchase(state, ctx)` (`tools/lib/tuning-bot.mjs`) replaces the
bot's pre-Phase-39 "always leave a store" step. Weapon pass first: among
unsold `buyWeapon`/`buyPremium` lines, legal via `canEquipWeapon`,
affordable (`cost <= c.gold - 50`, `GOLD_RESERVE`), and a genuine upgrade
(`weaponUpgradeDelta(c, item) > 0`) — buys the highest
`expectedStrike(c, item.base, item.bonus||0, 0)`, ties broken by lower
cost. Armor pass (only once the weapon pass finds nothing): among unsold
`buyArmor`/`buyPremium` lines, legal via `canEquipArmor`, a genuine upgrade
(`armorUpgradeDelta(c, item) > 0`), a Thief additionally skipping any line
whose `armorBulk({ armor: item.armor }) > 1` — buys the highest AR, ties
broken by lower cost. `null` when nothing qualifies — the bot leaves the
store exactly as before Phase 39. Because the policy reads the engine's OWN
`weaponUpgradeDelta`/`canEquip*`/`armorBulk` functions, a buy it chooses is
never refused `notBetter` by the engine's own `takeItem` (T-39-04).

**Landed (Phase 42):** item-USE tactics (when to pop a potion/staff/scroll
mid-run) and bot awareness of the GEAR-02 duration/cooldown/charge model
and the GEAR-05 one-shot tools — see `docs/CLASS-PASS.md`
`### Phase 42 tactics (BAL-01 second half)`. `tools/lib/tuning-bot.mjs`'s
own cell rows still carry no "bought" counter — the closed gap was the
item-USE timing, not a store-purchase tally.

## Smoke — 143 cells × 3 seeds vs the v1.5 BEFORE pin

A 3-seed smoke is a direction check for the ledger, not a tuning verdict —
the ONE consolidated v1.5 AFTER matrix is Phase 42 (BAL-02). This is NOT a
retune, and NOT a substitute for the Phase 27 human DR round either. A
3-seed smoke's per-cell noise is real (see the cannot-act note below) —
read the POOLED row only.

**Command:** `node tools/tune-classes.mjs --seeds 3 --workers 4
--max-actions 5000 --out docs/class-pass/v15-gear-smoke.json`
(143 cells × 3 seeds = 429 runs). **Wall time:** 92.4s. **Engine commit at
run time:** `00e5318` (this plan's own Task 1 commit — `tools/lib/`-only,
no engine/content/src/shell bytes since the v1.5 BEFORE pin `e69ff07`
other than the Phase 39-01 weapon/armor/derived/combat/movement/items
changes already reflected in the pin's own successor commits).

| Measure | JSON path | v1.5 BEFORE (e69ff07, 143×40) | v1.5 gear smoke (00e5318, 143×3) |
|---|---|---|---|
| n (runs) | rollups.pooled.n | 5720 | 429 |
| meanDepth | rollups.pooled.meanDepth | 3.75 | 3.78 |
| p50Depth | rollups.pooled.p50Depth | 4 | 4 |
| p90Depth | rollups.pooled.p90Depth | 6 | 6 |
| reach5 % | rollups.pooled.reach5 | 30.6 | 27.3 |
| reach10 % | rollups.pooled.reach10 | 0.7 | 0.7 |
| reach20 % | rollups.pooled.reach20 | 0.1 | 0.0 |
| meanKills | rollups.pooled.meanKills | 8.1 | 8.08 |
| meanLevel | rollups.pooled.meanLevel | 2.47 | 2.53 |
| stuck total | sum of cells[].stuck | 0 of 5720 | 0 of 429 |
| top death causes | rollups.pooled.topCauses | starved in the dark, cut down by a Poltergeist, cut down by a Werebeast | starved in the dark, cut down by a Werebeast, cut down by a Poltergeist |

Within-noise of the BEFORE pin at 10× the seed count — the weapon/armor
rebalance plus the new buy/equip policy did not visibly shift the class
matrix's overall shape at this proxy's resolution. `reach20` reading 0.0%
at 429 runs vs 0.1% at 5720 runs is sampling noise (a 0.1% event needs far
more than 429 runs to show up reliably), not a regression.

**`node tools/class-pass-diff.mjs --gate --after
docs/class-pass/v15-gear-smoke.json`** (exit 0): `cannot-act cells: 1 of
143` — `Magic User/Wizard/Elven kills=0.33 stuck=0 completed=3`. This is
the exact 3-seed noise this section's opening paragraph warns about: 3
completed runs averaging 0.33 kills is one kill in three runs, not a
"cannot act" class — the v1.5 BEFORE 40-seed pin shows every Magic User
sub in-band (`docs/CLASS-PASS.md`'s "v1.5 BEFORE" section, 0 cannot-act
cells of 143). Not a regression; not actioned this plan.

## Declared divergences (GEAR-01)

Copied verbatim from 39-01-PLAN.md's own fixture work
(`test/parity/FIXTURE-INVENTORY.md`, "## Phase 39: gear axes (GEAR-01) —
declared divergences" section) — the full before/after detail lives there;
this is the pointer table the ledger promises:

| Fixture | Scenario / seed | What moved |
|---|---|---|
| `action-script.economy.json` | script top level / seed 3, Human Pickpocket | The store roll's IDENTITY (names/order/subs) stays byte-identical to the prototype (machine-checked both sides via `declaredStockDiffs`), but every routed line's COST moved with the re-priced weapon/armor tables (Katana 525→650, the premium Casket's Broadsword base 500→550); the re-based `weaponUpgradeDelta` also flips one Axe purchase from an accepted upgrade to a `notBetter` rejection on BOTH sides |

Every other parity fixture scenario (chargen, `movement.json`, `combat.json`'s
flee/parley scenarios) re-ran byte-identical after Phase 39-01 — see
`test/parity/FIXTURE-INVENTORY.md`'s "Byte-identical elsewhere (Phase 39,
GEAR-01)" subsection for why each one never reaches the new axes.

## Item activation model (GEAR-02) — Plan 03

### The user's ruling, verbatim

> "Every activated item gets an effect that counts with chip. The effect
> lasts for x (number of squares moved), upon expiration the cooldown is x
> number of squares before reuse is available. Items with charges recharge
> every x squares. Consumables are one time uses that effect last for x
> squares. Staves, cloaks, jewelry, everything that has an effect on use."

### Post-planning ruling — ONCE A DAY (2026-09-18)

> "100 squares is one day. Given that, items should be usable at least once
> a day."

Applied: `effect + cd <= 100` squares for every duration+cooldown
activation; `recharge <= 100` squares per charge for every staff. Three rows
were re-authored to fit (both `every` AND `txt`, so the flavor text stays
true — never a stale number left in prose): **Amulet of Stone** `every` 200
-> 100 (instant effect, so this is purely the cooldown); **Cloak of
Invisibility** `every`/effect 100/100 -> 50/50 (50+50 = one day); **Cloak of
Ether** `every` 100 -> 80 (effect stays 20; 20+80 = one day, txt unchanged
since it already read "once every 100 squares" describing the total cycle,
not the literal cooldown). Every other row already fit and kept its literal
canon/prototype value.

### Use-activated only (user ruling 2026-09-18, quick 260918-w4n)

> "Items that are equipable must be equipped to be used. Items that are not
> equipable can be used from the bag."

> "Every cloak must have a Use button; it's only active when you use it.
> Same for every staff, amulet, etc. Nothing works without using it, which
> triggers its cooldown."

Staff amendment, verbatim: "A magic staff is a usable item, but not
equipable. Staff should not be an equipment slot. It just takes up a bag
slot and is usable from the bag."

And: "Drop Cloak of Healing" — the item leaves the game outright.

Applied: every JEWELRY/CLOAKS row now carries an `act` block — **there are
no passive rows any more**. An `eff` map is a PAYLOAD applied only while the
item's own `item:<name>` c.timers record is live (`engine/derived.js#eff`
sums it there, and nowhere else) — a bagged or worn-but-unused item grants
nothing. There is no auto-activation: the Cloak of Flying no longer starts
its own flight window on a climb/gorge tile — only `useItem` on a WORN item
starts the record, which then starts the cooldown. A staff leaves the
worn-slot taxonomy entirely: it lives in `c.items` (one bag slot), used by
bag index, keeping its charges+recharge model unchanged.

~~Cloak of Healing~~ — removed from the game (user, 2026-09-18); CLOAKS
drops from d8 to d7. The three cloak rolls (Thief starting cloak, the Cloak
find, `rollCloak`) now draw `rng.d(CLOAKS.length)` instead of a literal 8 —
still ONE `gen.next()` draw, so the rng cursor never shifts, only the row a
given draw lands on can change. A save carrying the dropped cloak loads it
as an inert cloak: `slotFor` still resolves it by kind, but `activationFor`
is null (no Use button, no effect, no throw).

> **260918-wy1 update (2026-09-19):** the eight JEWELRY rows' worn SLOT
> collapsed from four sub-slots (ring/bracelet/amulet/helm) into one family,
> `jewelry`, holding up to two pieces at once. This activation-model section
> (act.kind/effect/cd) is unaffected — the jewelry merge only changes WHERE
> an item wears, never how its activation works. See `docs/GEAR-SLOTS.md`
> §8 for the full ruling and model.

### The three tables

**Duration + cooldown** (every JEWELRY/CLOAKS row — all are act-only now) —
source: canon `every`/duration text, re-authored per the once-a-day rule
where noted above:

| Row | act.kind | effect (squares) | cd (squares) | source |
|---|---|---|---|---|
| Pendant of Fortitude | half | 0 (instant: `c.halfNext = true`) | 100 | canon `every: 100`, unchanged |
| Amulet of Stone | stone | 0 (instant, AoE 4 kill) | 100 | once-a-day rule, was 200 |
| Cloak of Invisibility | invis | 50 | 50 | once-a-day rule, was 100/100 |
| Cloak of Speed | haste | 50 | 50 | canon `every: 50`, unchanged |
| Cloak of Ether | ether | 10 | 80 | 260919-00d: 10-square wall-walk window; cd unchanged (10 + 80 <= 100) |
| Cloak of Flying | fly | 20 | 50 | canon "once every 50" — the row has no `every` field, so `act.cd: 50` is the explicit override; 260918-w4n removes the auto-activation on a climb/gorge tile — a ready-but-unstarted Cloak of Flying is not flying, only `useItem` on the worn cloak starts the record |
| Ring of Power (260918-w4n) | power | 50 | 50 | `{ dmg: 1 }` while live — outside the orchestrator's originally-proposed list, but inside the rule as the user stated it ("ring... amulet, etc") |
| Gauntlet of the Giant (260918-w4n) | giant | 50 | 50 | `{ size: 1 }` while live — RULES-11 (Phase 75.2, Plan 02): a +1 size step, race base plus items, never masked; +2 damage, one face easier for foes to hit |
| Amulet of Light (260918-w4n) | glow | 50 | 50 | `{ sight: 1, light: 1 }` while live; dispels `c.darkFor` the instant it is used |
| Anklet of Invisibility (260918-w4n) | unseen | 50 | 50 | `{ foeToHit: -2 }` while live |
| Helm of Knowledge (260918-w4n) | tongue | 50 | 50 | `{ tongue: 1 }` while live |
| Bracelet of Flight (260918-w4n) | fly | 20 | 50 | `{ fly: 1 }` while live — mirrors the Cloak of Flying exactly |
| Cloak of Regeneration (260918-w4n; Phase 88; Phase 93) | knit | 30 (heal-over-time: a d6 at once on use, then at 10, 20 and 30 squares, derived stream) | 50 | Phase 88 (ITEM-03), user 2026-09-30: "The cloak should be active for 30 squares, healing 1d6 every 10 squares. Then it goes on cooldown for 50 squares." Was 0 effect (an instant `rng.d(6)`) / 20 cd; 30 + 50 = 80 keeps the once-a-day rule. Phase 93 (ITEM-08), user ruling B 2026-10-03: a fourth d6 at once on use (`act.hot.onUse`); price unchanged (1,400). |
| Cloak of Strength (260918-w4n; quick 260928-cos) | critWard (was brace) | 50 | 50 | `{ critWard: 1 }` while live: a foe's critical on the wearer lands as an ordinary hit (was `{ noCrit: 1 }`, misread as the wearer's own crit ban) |
| Cloak of Armor (260918-w4n) | plate | 50 | 50 | `{ cloakArmor: 1 }` while live |

**Heal-over-time (Phase 88, ITEM-03).** An activation may carry
`act.hot = { every, ticks, heal: { n, sides, bonus } }`: a `heal` die every
`every` squares of the live window, `ticks` times, read by the one squares tick
(`engine/items.js#tickHealOverTime`, called once per step from `move` before
`tickSquares`). For every hot row `every * ticks` equals the effect length and
`effect + cd <= 100`. Each die comes from a derived stream keyed
`"healTick"`, never the main stream; a 2-square water step that crosses a mark
ticks once; there are no walking ticks in a fight. The Cloak of Regeneration is the
first hot row (`every 10, ticks 3, heal 1d6`). Phase 93 (ITEM-08): `act.hot.onUse: true`
adds one tick at the use itself, in or out of a fight, from the same stream (tick key 0);
`ticks` stays the walking count, so `every * ticks` still equals the effect length. The
Cloak of Regeneration is `every 10, ticks 3, onUse, heal 1d6`: four d6 a use.

**Charges + recharge** (STAVES rows; `effect` only where the use has its
own duration) — source: Claude's discretion per the CONTEXT's explicit
grant, a deliberate mild buff correcting the prototype's `every: 250`
(effectively-infinite reuse) into a real, scarce resource for the Magic
User's one weapon:

| Row | act.kind | charges | recharge (squares) | effect |
|---|---|---|---|---|
| Rowan Staff | dome | 2 | 100 | instant |
| Birch Staff | freeze | 2 | 100 | instant |
| Walnut Staff | weaken | 2 | 80 | instant |
| Oak Staff | stone | 1 | 100 | instant |
| Crystal Staff | invis | 2 | 100 | `{ n: 1, sides: 10, bonus: 5 }` squares (canon "d10+5 squares") |
| Poplar Staff | heal | 3 | 60 | instant |
| Pine Staff | fire | 1 | 100 | instant |
| Cedar Staff | gas | 1 | 100 | instant |

260918-w4n (staff amendment): staves are not equipable — a staff is a bag
item, used from the bag by index, Magic User only; it has no worn slot
anywhere.

**Consumables** (POTIONS rows; consumed on use; no cd) — source: canon
duration text verbatim:

| Row | act.kind | effect | extra |
|---|---|---|---|
| Speed | haste | 50 squares | |
| Strength | might | 25 squares | `might: 8` |
| Enlarge | enlarge | 50 squares | `eff: { size: 1 }` — RULES-11 (Phase 75.2, Plan 02, user ruling 2026-09-25): no longer a `might`-kind payload; exactly a +1 size step (+2 damage, one face easier for foes to hit), stacking with a live Gauntlet of the Giant record to +2 steps |
| Acuteness | acute | `{ n: 1, sides: 8, bonus: 0 }` rounds | `cadence: "rounds"` |
| Invisible | invis | 100 squares | canon text says "a day"; the prototype set 100 — kept |

Healing / Xtra Healing / Cure Poison / Cure Disease / Death: instant, no
`act`. There are no passive rows any more (260918-w4n) — every JEWELRY/
CLOAKS row carries an `act` block; see the duration+cooldown table above.

### The representation

Every live effect or cooldown is ONE `c.timers[id]` record on Phase 36's
`engine/effects.js` (`startEffect`/`startCooldown`/`tickRounds`/
`tickSquares`/`remaining`/`isReady`), keyed `item:<name>` (a duration+
cooldown jewelry/cloak, or a consumable potion's own effect) or
`charges:<name>` (a staff's recharge countdown — always a cooldown record,
never an effect). `content/activations.js#ACTIVATION_OF` (merged from
`content/treasure-tables.js#TREASURE_ACTIVATION_OF` and `content/potions.js#
POTION_ACTIVATION_OF`) is the pure-data declaration; `engine/derived.js`'s
`activationKeyFor`/`activationFor`/`itemTimerId`/`chargesTimerId`/
`liveItemEffects`/`itemEffectActive`/`potionMight` are the ONLY readers.

A staff's charge COUNT rides the item object itself (`it.charges`) — not a
`c.timers` record — because it travels with the physical staff: drop it,
sell it, hand it to a Joiner, and the remaining charges go with it. Only the
COUNTDOWN to the next charge (`charges:<name>`) lives on the character, since
recharging is something the character's own attunement does, not the item.
When a staff's charge pool is not full, `engine/items.js#
narrateTimerTransitions` restarts the countdown the instant the previous one
expires — charges refill CONTINUOUSLY (one every `recharge` squares) until
the pool is full, never all at once.

### Retired fields — where each consumer now reads

| Retired field | Old writer(s) | New read |
|---|---|---|
| `c.haste` | `engine/items.js#useItem` (`speed`/`haste` cases) | `engine/combat.js#playerStrike` — `itemEffectActive(c, "haste")` (double attacks) |
| `c.invis` | `engine/items.js#useItem` (`invis` case) | `engine/derived.js#foeToHitVs`/`foeToHitBreakdown` — `itemEffectActive(c, "invis")` (h = 1) |
| `c.ether` | `engine/items.js#useItem` (`ether` case) | `engine/movement.js`'s climb/gorge block — `itemEffectActive(c, "ether")` (phase through) |
| `c.acute` | `engine/items.js#useItem` (`acute` case) | `engine/derived.js#strikeDie` — `itemEffectActive(c, "acute")` (strike on a d6) |
| `c.might` (potion writes only — the SPELL's own `c.might` write is untouched) | `engine/items.js#useItem` (`strength`/`enlarge` cases, `+= 8`/`+= 4`, never expiring) | `engine/derived.js#weaponDamage`, `src/browser/viewModels.js#damageBracket` — `potionMight(c)`, additive alongside the spell's `c.might` |
| `c.flightLeft`/`c.flightCooldown` | `engine/character.js#rollCharacter` (init), `engine/movement.js` (climb block + per-step tick) | `engine/derived.js#isFlying`/`conditionsOf` — `itemEffectActive(c, "fly")` / `isReady(c, "item:Cloak of Flying")` |
| `it.usedAt` (every activatable item) | `engine/items.js#useItem` (unconditional stamp before the retired `!itemReady` block) | `engine/items.js#itemReady` — `isReady(state.c, itemTimerId(it))` (cd items) / `Number.isInteger(it.charges) && it.charges > 0` (staves) |
| `it.every` (STAVES rows only — JEWELRY/CLOAKS rows keep `every` as legitimate fallback-default content, read only by `buildActivation` when `act.cd` is absent) | `content/treasure-tables.js` STAVES rows, `engine/items.js#rollStaff` | retired outright — a staff's readiness is `it.charges`, never a squares-since-use gate |

### Refusal vocabulary (new/changed rows)

| Reason | Item class | Payload | Line |
|---|---|---|---|
| `cooldown` | duration+cooldown jewelry/cloak, still cooling or mid-effect | `{ left, phase }` | "{item}: {left} squares. It is not a vending machine." |
| `recharging` | an EMPTY staff (0 charges) | `{ left, charges, max }` | "{item}: {left} squares to the next charge. Patience is also a spell." |

### New events

`itemEffectStarted { item, kind, left, cadence, might?, size?, step?, sizeDmg? }`
— a use started a timed effect (kind-keyed narration: haste/invis/ether/
acute/might/fly each get their own line; an unrecognized kind falls back
to "{item}: {n} squares."). RULES-11 (Phase 75.2, Plan 02): `size`/`step`/
`sizeDmg` appear only for a size-stepping item (the Gauntlet of the
Giant, Enlarge) — `size` is the hero's CURRENT total size name
(`heroSize(c).name`, after the record starts), `step` is that ITEM's own
±1 step, `sizeDmg` is `SIZE_DAMAGE_PER_STEP × step`. `itemEffectFaded {
item, kind }` — an effect record expired
(from either the `item:` phase-effect->deleted OR phase-effect->cooldown
transition — a duration+cooldown item narrates the SAME event whether it is
now fully spent or has simply moved into its cooldown). `itemCooled { item
}` — a duration+cooldown item's cooldown phase finished; it is ready again.
`staffRecharged { item, charges, max }` — a staff regained one charge.

### Tolerant-load fold

`engine/saveState.js#foldLegacyCounters(c, steps)` runs LAST in both load
chains (`validateSave`/`rehydrate`, after `ensureCharacterAbilities`).
Items are folded FIRST (a captured `it.usedAt` on a duration+cooldown item
reconstructs a COOLDOWN record scaled by elapsed squares; a staff loses its
legacy `every`/`usedAt` outright and gets a full charge pool if its
`charges` field is missing or a tampered non-integer, T-39-06), then the six
character-level counters SECOND — an active (positive) counter always wins,
overwriting whatever cooldown the item pass reconstructed for the same id
(`startEffect` always overwrites). The six legacy keys are always deleted
when present; nothing is ever injected when there is nothing to fold.

**The one accepted loss:** a mid-fight, rounds-cadence Acuteness effect does
NOT survive a save/load round-trip. `combat` is always reset to `null` on
load (unconditionally, long before this phase), and Phase 36's own
`clearStaleTimers` clears every ROUNDS-cadence `c.timers` record on load
for exactly that reason — Acuteness now ticks ONLY inside `foeTurn` (never
per exploration step, a deliberate behavior change from the old dual-tick
model), so it is combat-scoped exactly like every other rounds-cadence
timer and pays the same reload cost. This mirrors the `c.ward`/`c.foeEffect`
precedent (both also die on reload) rather than inventing a new rule.

### Joiners use their items (Phase 89, ITEM-07)

> "let joiners use items they have, and let their armor soak damage. Just
> like players." — user, 2026-09-30

This replaces the Phase 39 rule "Members never activate items" (at Phase 39
`alliesTurn`/`memberStrike` had no item-use branch, so a party member never
carried an `item:`/`charges:` timer record). A Joiner is now its own body:
its items start, tick, heal and end on its own sheet, exactly as the hero's
do, through the same internal functions (`applyActivation`,
`narrateTimerTransitions` and `tickHealOverTime` take an optional trailing
`sheet` that defaults to the hero, so every hero call is unchanged). Every
event a Joiner causes carries the additive `member` field (its name); no new
roll touches the main rng (every Joiner roll comes from a derived stream).

**Wear on joining (89-05).** A cloak or jewel in a Joiner's bag (the Thief's
starting cloak) goes into a free slot when it joins (`resolveJoiner` runs
`reconcileWorn` on the pending sheet; `joinerJoined.wore` names what it put
on), and a saved Joiner is dressed the same way on load. A worn slot is what
makes an item work, so the Joiner can use it the turn it joins.

**The use path (89-05).** One action, `memberUseItem { i, potion: true }` or
`{ i, slot }` (`engine/items.js#memberUseItem`, over `memberDrinkPotion` and
`memberUseWorn`). A potion is the Joiner's own: 2d10+5 hp, doubled for a
heal-twice race, from the derived stream `memberPotion`, clamped to its
maximum; the hero's potions never move. A worn item starts the same
`item:<key>` record, cooldown and `src` link on the Joiner's sheet, so taking
it off, a swap or destruction ends it through Phase 88's `endSourceEffects`
and the use stays spent. The refusals are named, zero-draw and mutation-free:
`noMember` (none, or downed), `inCombat` (a fight or a pending one: the fight
runs itself), `noPotions`, `fullHealth`, `leaderOnly` (below), `combatOnly`
(a targeted item outside a fight) and `cooldown`. The Hero tab's Company
panel offers DRINK and USE outside a fight (89-07) and shows each Joiner's
armour, potions, worn items and item chips (`heroTab.js#companyItemsModel`,
`derived.js#memberConditionsOf`).

**In a fight (89-06, accepted 2026-09-30).** On its own turn, in
`engine/combat.js#alliesTurn`, a classed Joiner: in round 1 uses the first
ready worn item of a combat kind as a free use (`pickMemberItem`: Speed,
Strength's cloak, Armor, Anklet, Ring of Power, Gauntlet, invisibility, the
Pendant); at or below a third of its HP (`wp * 3 <= maxWP`) drinks one of its
own potions instead of acting; and under its own live Speed swings twice on a
plain strike (a cast or an ability stays single, as the hero's). The policy
is pure and draws nothing. One item per Joiner in round 1.

**Item timers and heal-over-time (89-05).** Every Joiner's `c.timers` tick on
every step after the hero's (water included), and its Cloak of Regeneration
heals a d6 at 10, 20 and 30 squares from the member-keyed derived stream. Phase 93 (ITEM-08): since then a Joiner's own cloak also heals a d6 at once on use (member-keyed stream, tick key 0).

**Joiner armour soaks like the hero's (89-04).** A foe's swing or bolt on a
Joiner goes through `engine/combat.js#applyFoeDamageToMember`, the twin of
the hero's damage pipeline: its own armed Pendant halves the blow, its Brace
halves it again, then a d20 from the derived stream `memberSoak` against
`armorSoak(sheet)` (the Cloak of Armor's plate and the Fighter multiplier
included) soaks the whole blow, wearing the Joiner's own armour by the hero's
rule and destroying it at 0. A drain, a no-armour foe and a Joiner with no
armour draw no soak die. Hardiness and the Fridgian hide are not applied to a
Joiner (Phase 91's to decide, IDENT-20).

**The rulings that shape it (docs/ITEM-AUDIT.md "## Rulings", 2026-09-30).**
Q2 = A: a Joiner cannot use the items whose effect belongs to the one leading
the party (Cloak of Flying, Cloak of Ether, Bracelet of Flight, Amulet of
Light, Helm of Knowledge, Amulet of Stone: `MEMBER_LEADER_KINDS`); it is
refused `leaderOnly` and the Company panel says why in one line. Q3 = A: a
Magic User Joiner reads its starting scroll when it joins (a spell it can
learn and cast at its level, from a derived stream, into its book; the scroll
is spent even if nothing is learnable). Q4 = A: each store offers a repair
line for each hurt Joiner's armour on the hero's rule (a tenth of the armour's
cost per point, the hero's price modifiers applying). GIVE (the hero handing
an item to a Joiner) stays deferred.

### The `txt` note

Every JEWELRY/CLOAKS/STAVES row's flavor `txt` field is left BYTE-IDENTICAL
on export (`content/treasure-tables.js#dropAuthored` strips `slot` and `act`
the same way Phase 37 stripped `slot` alone) — seven parity fixtures carry a
starting cloak's `txt` in their compared `c.items`/`c.worn` shape, so
editing it would move fixtures this plan explicitly declares untouched. The
Gear tab's row state (Plan 05) renders the LIVE numbers (remaining/cooldown/
charges) instead of relying on the static flavor text to stay accurate.

### Cloak of Ether — through the stone (user ruling 2026-09-19, quick 260919-00d)

> "The Cloak of Ether should literally let you traverse through the stone
> walls. It makes it so you are not limited to the paths and travel on any
> squares. Limit it to 10 squares of movement. If your movement ends when
> you are in a wall, you die." — user, 2026-09-19
>
> Correction (same day): "there is no d-pad, we are fully tap to move now."

**The rule.** While the Cloak of Ether's own `item:Cloak of Ether` effect
record is live (`engine/derived.js#itemEffectActive(c, "ether")`),
`engine/movement.js#move` accepts a step onto ANY in-bounds cell — wall or
not, the 21x21 border ring included. Feature tiles (climb/gorge) still
phase exactly as before this change (mirrors `isFlying`). With no live
ether record, a wall step is the unchanged silent no-op (no mutation, no
event, no rng draw) — every parity fixture takes this exact path. The
window shrank from 20 to 10 squares (`act.effect` in
`content/treasure-tables.js`); the cooldown stays 80 (the user's own
instruction) — 10 + 80 = 90, inside the once-a-day rule (<= 100). The row's
exported shape (`every`/`use`/`txt`) is byte-identical, so the frozen
economy fixture's declared Cloak of Ether object never moves.

**The tick-end death.** The ONLY path that ends a squares-cadence item
effect is `engine/effects.js#tickSquares`, called from exactly one site —
`move`'s per-step `c.timers` block. The instant the ether record transitions
out of its "effect" phase there, `engine/movement.js#resolveEtherEnd(state,
rng, events, now)` runs: a no-op unless the party's CURRENT cell is solid
rock (`engine/derived.js#inStone`), in which case it pushes `entombed` and
calls the same permadeath terminator every other cause uses —
`die(state, "entombed", ...)`. New content: `CAUSE_TEXT.entombed` ("became a
permanent architectural feature") and a four-line `EPITAPHS.entombed` bank
(headline: "Became a permanent architectural feature."). `resolveEtherEnd`
is deliberately its own exported function — the ONE home of the rule — so
any future early-end path (a dispel, a destroyed cloak) must call it rather
than re-implementing the in-stone check.

**Nothing in the rock.** `move`'s feature dispatch gains an explicit
`!cell.wall` gate (genFloor never scatters a feature onto a wall cell
anyway, but the rule is now stated, not merely implied); `newDay`'s
wandering-monster roll still draws its eight per-hour d20s in the same
order (the rng cursor is unchanged) but skips starting the fight while
`inStone(state)` is true.

**Tap-to-move (the only movement surface).** There is no D-pad and no
multi-step route builder — every tap is ONE adjacent step toward the tapped
cell (`src/browser/tapStep.js#resolveStep`). The shell's `isOpen` predicate
(`mazeworld.html#tapStep`) accepts any in-bounds cell while
`window.__mzEther.itemEffectActive(S.c, "ether")` is true; a tap on a wall
cell — adjacent or ten squares away — resolves one step toward it, same as
any other tap. Because there is no route preview and no multi-square walk,
there is nothing to cap: a route that would "outlast the remaining squares"
cannot exist. Hold-inspect (`inspectCell`) shows the plain SOLID ROCK card
normally, and `RAIL_COPY.rockEther` ("Passable, for the moment. Do not be
inside it when the moment ends.") while ethereal — an unseen wall stays
UNWALKED either way (fog never reveals rock). The Ethereal chip's `N sq`
countdown turns warn-toned while the party is currently standing in rock
(`mazeworld.html#paintConditions`); the activation rail line and the Oracle line
both restate the fatal-end warning in voice.

**Accepted edge behaviours.** A Being-trapped-phobic hero stepping into
solid rock (0 open neighbours) takes the existing deterministic
`trappedPanic` hit and arms Afraid, exactly as any other dead-end entry
would — thematically apt, no new field. Camping inside rock is not refused:
the ether record is squares-cadence (a camp doesn't advance it) and the
in-stone wandering-monster skip covers the camped `newDay` too — solid rock
is the safest bed in the dungeon for as long as the cloak holds. One-way
doors are unaffected either way (ether does not override a door; a wall
cell has `feat: null` anyway).

**The bot.** `tools/lib/tuning-bot.mjs#canStep` refuses any wall destination
unconditionally — it reads only the floor, never `c.timers` — and no bot
policy ever activates an ether-kind item. The bot can never be entombed;
pinned by `test/unit/ether-wallwalk.test.js`.

**Old saves.** Tolerant load only: `engine/saveState.js#foldLegacyCounters`
already rehydrates a pre-Phase-39 `c.ether` counter into an
`item:Cloak of Ether` effect record; that record (whatever `left` it
carries) simply obeys the new rule going forward. No dual path.

**Parity.** Zero fixture drift: no parity fixture ever carries a `c.timers`
key or calls `useItem`, so every fixture takes the byte-identical wall
refusal this plan left untouched for the no-live-effect case. Proof:
`grep -l useItem test/parity/fixtures/*.json` and
`grep -l '"timers"' test/parity/fixtures/*.json` are both empty.

### Effect sources (Phase 88, ITEM-02)

> "when you use an item and then take that item off, you should lose the
> items benefit. For instance, if I wear the cloak of flying and use it, I
> gain flying, and then if I take it off, I should lose that flying
> condition. We don't want people just putting everything on and stacking
> benefits without actually wearing the item for the benefit." — user,
> backlog 999.16, 2026-09-28

**What is linked.** Using one of the twelve worn items that start a timed
effect (Cloaks of Strength, Invisibility, Speed, Armor, Flying and Ether;
Ring of Power, Gauntlet of the Giant, Amulet of Light, Anklet of
Invisibility, Helm of Knowledge, Bracelet of Flight) from its worn slot, or a
wielded Crystal Staff from the weapon slot (user, 2026-09-30: its party
invisibility is linked too), stamps the timer record with its source:
`src: { slot, n }`, where `slot` is `jewelry1`, `jewelry2`, `cloak` or
`weapon` (`engine/derived.js#SOURCE_SLOTS`) and `n` is the item's display
name. Potions and the Torch are used up on use, so they carry no `src` and
their effects run their course whatever the gear does.

**The end rule.** One helper, `engine/items.js#endSourceEffects`, ends a
linked effect the moment its item leaves the slot: take off (`unequipSlot`,
the weapon slot for a staff included), swap (`equipItem`, `wearItem`,
`takeItem`, `takeLoot`, an identical copy included), or destruction (the
Pilfer fumble). Drop and sell only address bag rows, so a slotted item
reaches them through the take-off; both still run the helper's sweep. Wearing
an item into the OTHER jewelry slot leaves the effect running. A refused
change (bag full, the combat gear lock) ends nothing. The end is narrated by
one `itemEffectEnded` event, on the Oracle and the rail.

**The use is spent.** An early end turns the record into a cooldown of
(effect squares left + `cd`), so the item is ready again exactly when it
would have been had the effect run its full length; putting it back on never
brings the effect back and never readies it sooner. A charged staff has no
cooldown: its record is removed, the charge it cost stays spent and its
`charges:` recharge countdown is untouched. The natural effect-to-cooldown
flip in `engine/effects.js` drops `src`, so a cooling record is byte-identical
to the pre-link shape.

**Ether in rock.** Taking the Cloak of Ether off, or swapping it, while
standing in rock entombs the hero through `engine/movement.js#resolveEtherEnd`
(`itemEffectEnded`, `entombed`, `died`), with no refusal and no warning (user
ruling 2026-09-30, consistent with "if your movement ends when you are in a
wall, you die"). A flight that ends early strands nothing: the climb and leap
checks run as a step enters a tile.

**Joiners.** The link and the helper work on any character sheet (a Joiner's
event carries `member` and never entombs anyone). Phase 88 had no item-use
path for a Joiner, so nothing started an effect on one; since Phase 89
(ITEM-07, "Joiners use their items" above) a Joiner's used items carry `src`
and end through the same helper, tested with the hero's.

### Phase 89: items that do what they say (ITEM-01, ITEM-05, ITEM-06, ITEM-07)

The rule (CONTEXT, 2026-09-30): the item's text is the promise to the player,
so the engine does what the text says unless the text is a typo or the user
ruled otherwise. `docs/ITEM-AUDIT.md` has one row per item (text, engine,
canon, verdict, pin), closed by plan 89-10, and
`test/unit/item-text-engine.test.js` fails the day any number in an item's
text and the number the engine uses drift apart.

**Enlarge is Troll-sized (ITEM-05, 89-02).** User, report #6: "Enlarge potion
send worthless. +2 damage to get hit now often? Should be more in alignment
with troll +11 to damage." Now: +11 damage (the one size step's +2,
`SIZE_DAMAGE_PER_STEP`, plus +9 bulk carried as `act.eff.dmg`, the term the
Ring of Power's +1 rides), foes +1 to hit the drinker (`SIZE_FACES_PER_STEP`
x one step; the +9 adds no cost), 50 squares, price 75 to 150 so +11 for 50
squares does not undercut the Strength potion (+8 for 25 squares at 100). A
Troll drinking it stacks (+11 on its own +11, size Large to Huge). The Gauntlet
of the Giant is unchanged (+2, foes +1 to hit, 50 squares every 100). Phase 92
may retune the price with the store economy.

**The Poplar Staff heals the party (ITEM-01, ITEM-06, 89-03).** User,
2026-09-30: it heals every party member d20+10 each (the party is the hero and
at most one Joiner), rolled from a derived stream. Its kind is its own
`partyHeal` (it used to fall into the Healing potion's d10+2, hero only), the
dice live on the activation record (`act.heal`), and an old save's staff heals
the party with no migration. 3 charges, one back every 60 squares.

**The Pendant disarms when it comes off (89-03).** User, 2026-09-30: keep the
one blow, disarm it when the pendant comes off, add it to the Phase 88 source
link, leave the use spent. The armed charge is `halfNext = { slot, n }`;
`endSourceEffects` disarms it on take-off, swap, destruction and the load
sweep with one `itemEffectEnded` (kind `half`), and its 100-square cooldown
runs on.

**The depth-rising resist applies to every item effect (89-08, Q1, Q5, Q6).**
Q1, user, 2026-09-30: "rising resists on higher floors should apply to ALL
spells and spell-like effects (staves included). That shouldn't be limited to
just these items anyway. remove the floor-12 special effects only." The floor-12
special effects (the three-round hold, the extra control resist) are gone from
the Amulet of Stone, Oak Staff, Cedar Staff, Birch Staff and Walnut Staff: a
landed stone kills and a landed gas sleeps for the whole fight at any depth.
Every item effect a foe can resist (those five and the Pine Staff's fire) rolls
ONE resist, `derived.js#risingResistFaces`, folding the old two chances (the
half-intel faces `a`, the floor's faces `c`) into one d20 of `a + c - a*c/20`
faces (capped at 19), so a deep foe resists as often as it did and never more
often than the two rolls did. Q5 (Cure Poison and Cure Disease each cure only
their own kind; against the wrong affliction, or none, the potion is refused
and kept) and Q6 B (the Walnut Staff casts the full Weaken: half damage and
foes hit only on their top three faces, for the whole fight) are built in the
same plan. The spell side of the same rule is Phase 90's.

**Plain words (TEXT-01, 89-09).** Item texts state signed to-hit ("foes −2 to
hit you"), d20 ranges ("20 on a d20; 19–20 if you insulted them") and foe counts
("up to 4 foes"), never faces or squares of foes; every staff states its charges
and its recharge; the Helm of Knowledge says it lets you always parley and
what a parley is; the Death potion reads "you're dead!"; a weapon states its
to-hit and crit, a bulky armour its cost, a bag its caps. A saved game's items
load with the current words (`saveState.js#refreshItemTexts`).

## One-shot tools (GEAR-05) — Plan 04

Three hazard tools — Rope, Ladder, Torch — each answer exactly one hazard,
consumed on use, appearing as loot and store stock at depth-appropriate
tiers (`content/tools.js#TOOLS`).

### The three tools

| Tool   | Cost | Store tier | Loot weight | Answers                              | Consumed when |
|--------|------|------------|-------------|---------------------------------------|---------------|
| Torch  | 25   | 0 (depth 1+) | 4 (commonest) | `c.darkFor` darkness (not a movement tile) | Used from the Gear tab / a Darkness card while `inDark(state)` — `useItem`, `use: "light"` |
| Rope   | 60   | 0 (depth 1+) | 3           | a `gorge` movement tile               | `useTool` at the pending gorge decision, or via the CLIMB IT retry card's LEAP IT/USE ROPE choice |
| Ladder | 150  | 1 (depth 2+) | 1 (rarest)  | a `climb` movement tile               | `useTool` at the pending climb decision, or the retry card's CLIMB IT/USE LADDER choice |

One bag slot each (`slotItems` counts a tool like any other gear/treasure
item — `bagCap` applies); never stacks — a second copy is refused
(`itemRejected {reason:"haveOne"}`), mirroring the Lockpicks `kind:"picks"`
precedent (`engine/items.js#hasPicks`). Sell price on floors 1-4 is half the buy cost
(`sellPriceFor`/`baseValueFor`, same `SELL_SPREAD` every other item uses,
rounded): Rope sells for 30, Ladder for 75, Torch for 13. (Since 92-03 the
fraction is a depth-shaped dial, `DIALS.SELL_FRACTION`: 0.5 on floors 1-4,
0.375 on 5, 0.25 on 6, 0.125 from floor 7.)

### The decision-point design (CONTEXT Area 1)

Stepping onto a climbable wall while carrying a ladder, or a gorge while
carrying a rope, PAUSES before any roll — a pre-roll card (the shell half,
Plan 05) with USE LADDER/CLIMB IT or USE ROPE/LEAP IT. Choosing the tool
consumes it and passes the tile with NO roll and NO fall damage; the other
button runs today's synchronous roll unchanged. The SAME choice re-appears
on the existing post-fall CLIMB IT/LEAP IT retry card when the tool is
carried — you fell, you're still standing there, the tool is still the way
past. The Torch instead gets a dark card: `USE TORCH` when a Darkness table
result fires (or from the Gear tab / ITEMS submenu any time `inDark(state)`
is true) — using it clears the CURRENT darkness and grants a 40-square lit
window during which a LATER Darkness result is suppressed entirely.

### `state.pendingHazard` — shape and lifecycle

```
state.pendingHazard = null                                    // no decision pending
state.pendingHazard = { feat, dir, tool, declined: false }     // a decision IS pending
```

- **Created**: `engine/movement.js#move`'s climb/gorge block, the roll
  branch's pre-check — ONLY when the hero carries the matching tool
  (`hasTool(state.c, toolFor)`) and there is no already-pending record at
  this exact tile/direction. Pushes `hazardChoice { feat, dir, tool }` and
  returns WITHOUT moving or rolling — zero rng draws, zero mutation besides
  the pending record itself.
- **Declined**: a second `move(dir)` at the SAME pending tile/direction (the
  CLIMB IT/LEAP IT button) flips `declined: true` in place and falls
  through to the SAME roll code path that always ran here — the pending
  record deliberately stays on the tile (never cleared by the decline
  itself) so a FAILED roll's retry card can offer both buttons again with
  no second prompt.
- **Cleared**: any genuine successful step (`move`'s normal step-tail, right
  after `f.px`/`f.py` are assigned), a `useTool` spend (the tool branch,
  explicitly), a `teleport`, or a `descend` — all four reset it to `null`.
  A FAILED roll does NOT clear it (the character never left the tile).
- **Never rehydrated**: `state.pendingHazard` is transient like
  `pendingFind` — both `engine/state.js#newRun` and
  `engine/saveState.js#validateSave`/`rehydrate` always set it to `null`,
  regardless of what a save file claims (T-39-11 — a tampered/stale save-
  side value is never trusted; the engine re-derives the decision on the
  next step).

### The zero-draw invariant and the derived-stream loot row

Two structurally separate "zero new main-rng draws" guarantees:

1. **The hazard pre-check** (`engine/movement.js`) never draws — the
   `hasTool`/pending-record logic is pure reads/writes; a character without
   the matching tool never enters either branch, so movement stays
   byte-identical to before this plan.
2. **The loot row** (`engine/items.js#rollTreasureItem`) runs a derived
   stream check — `derivedRng(rng.getState(), "tool", depth)` — immediately
   after the lockpick gate and BEFORE the main `rng.d(10)` table roll. This
   is a FULLY SEPARATE rng instance (the Phase 38 milestone-wide
   "`derivedRng` for a roll that must not reorder an existing seeded draw
   sequence" pattern): it never draws from the caller's `rng`. The no-fire
   path therefore advances the main rng by EXACTLY the same number of draws
   as before this plan; when it fires, the main rng advances by exactly the
   ONE lockpick `d(12)` draw already spent above (the tool row's own `d(8)`
   and any weighted candidate pick both run on the separate stream). See
   `test/parity/FIXTURE-INVENTORY.md`'s Phase 39 GEAR-05 section for the
   measured proof (200-seed replay + the one exposed fixture call).

### The torch's exact scope

The torch touches ONLY `c.darkFor` — the persistent darkness counter
`engine/encounters.js#fallDark` sets and `engine/movement.js`'s per-step
tick decrements. It does NOT touch a tile's own `.dark` flag or the
reveal-radius/fog-of-war model — that is Phase 41's territory
(TERR-02/the map-reveal rework), explicitly out of scope here. Using the
torch while `inDark(state)` (true for EITHER a live `c.darkFor` counter OR
the current tile's own `.dark` flag — `inDark`'s existing definition,
unchanged) clears `c.darkFor` to 0 and starts a 40-square `lit` effect
(`content/tools.js#TOOL_ACTIVATION_OF.Torch = { kind: "lit", effect: 40 }`,
spread into `content/activations.js#ACTIVATION_OF` — the SAME
`c.timers["item:Torch"]` activation model every other magic item uses,
Phase 39 GEAR-02). While that effect is live, `fallDark` checks
`itemEffectActive(state.c, "lit")` FIRST and, if true, emits
`darknessResisted { by: "torch" }` and returns WITHOUT painting any tile
dark or touching `c.darkFor` at all — a later Darkness table result is
completely suppressed for the window's duration. 40 squares comfortably
satisfies the once-a-day rule (`effect <= 100`; the torch carries no
cooldown at all — a fresh torch must be bought/found again).

### The refusal vocabulary

| Event | reason | Fires when |
|-------|--------|-----------|
| `toolRefused` | `noTool` | `useTool` targets a tool not carried |
| `toolRefused` | `noHazard` | the target tile is missing/a wall/not the matching feat |
| `toolRefused` | `unknown` | `tool` is not a recognized hazard tool (torch, or a malformed value — `validateAction` already blocks this on the wire) |
| `useRefused` | `notDark` | the torch is used while NOT `inDark(state)` — not consumed |
| `itemRejected` | `haveOne` | a second copy of an already-carried tool is offered (loot, store, or a direct `takeItem`) |

### Events

`hazardChoice { feat, dir, tool }` — the pre-roll pause (rail decision card
IS the UI; SILENT on the narration-line side, like `findOffered`). `toolUsed
{ tool, feat, item }` — the tool was spent, tile passed. `toolRefused
{ tool, reason }`. `torchLit { left, wasDark }` — the torch cleared a live
darkness. `darknessResisted { by: "torch" }` — a LATER `fallDark` held off.
All five (plus the two reason-only additions to the pre-existing
`useRefused`/`itemRejected` types) are narrated in
`src/browser/eventNarration.js` (Oracle), `src/browser/narrationLines.js`
(LINE_FOR/ORACLE_ONLY/FEATURE_EVENTS), and `src/browser/rail.js`
(RAIL_FAMILY, plus `toolUsed`'s one `RAIL_FEATURE_ICON` exception — its
icon depends on the raw event's own `.feat`, climb -> wall / gorge ->
crevice, read directly at `railCardFor`'s one lookup site since the table
itself is keyed by event type only).

### The bot's pending-hazard handler

`tools/lib/tuning-bot.mjs#decideAction`: `if (state.pendingHazard &&
!state.pendingHazard.declined) return { type: "useTool", tool:
state.pendingHazard.tool, dir: state.pendingHazard.dir };` — placed right
after the `pendingJoiner`/`pendingFind` checks. This is a PENDING-STATE
handler (answering a decision the engine itself already parked in one
dispatch, avoiding a wasted decline-then-reroll round trip), NOT a timing
tactic. The bot does not buy or carry a tool today
(`chooseStorePurchase` only scans `buyWeapon`/`buyArmor`/`buyPremium`
lines, never `giveTool`), so this handler is currently reachable only via a
hand-built pending state in a unit test in THIS plan's own scope, but is
now real and reachable in a live bot run — see `docs/CLASS-PASS.md`
`### Phase 42 tactics (BAL-01 second half)`: `chooseFieldItem` lights a bag
torch while `inDark`, and the 143×3 tactics smoke measured
`tool:torch`/`tool:rope`/`tool:ladder` all with non-zero uses. The bot
still does not BUY a tool from the store (`chooseStorePurchase` scans only
`buyWeapon`/`buyArmor`/`buyPremium` lines) — every torch/rope/ladder used
in that smoke came from loot/find, never a purchase; a store-buy policy for
tools remains unaddressed, tracked as a follow-up, not this note's own
scope (this note's own ask — WHEN-to-use-it timing for an already-carried
tool — is closed).

## Chips and row states — Plan 05

### The one row-state rule

`src/browser/viewModels.js#itemRowState(state, it)` is the ONE rule the Gear
tab's worn/carried rows AND the ITEMS combat submenu (`src/browser/
combatMenu.js`) both read — mirroring the Phase 38 ability-row precedent
(`READY`/`N ROUNDS`/`ONCE A FIGHT · USED` lives in exactly one place).
Returns `{ text, kind, remaining? }`, reading `state.c.timers` ONLY through
`engine/effects.js#remaining`/`isReady` and the item's own activation via
`engine/derived.js#activationFor` — never `it.usedAt`/`it.every` (the
counter-based fields Plan 03 already retired engine-side):

| State | `text` | `kind` |
|---|---|---|
| not activatable (no `use`, not a potion — weapon/armor/rope/ladder/passive jewel) | `""` | `none` |
| a one-shot consumable (a potion, or the torch — the one `kind:"tool"` item with a `use`) | `""` | `consumable` |
| a duration+cooldown item, no `item:<key>` record | `ITEM_STATE_COPY.ready` = `"READY"` | `ready` |
| a duration+cooldown item, mid-effect | `ITEM_STATE_COPY.squares` = `"{n} SQ"` (singular `"1 SQ"` at exactly 1) | `effect` |
| a duration+cooldown item, cooling | `ITEM_STATE_COPY.cooling` = `"cd {n} SQ"` | `cooldown` |
| a staff at full charges, no recharge record | `ITEM_STATE_COPY.ready` = `"READY"` | `ready` |
| a staff recharging (`k` may be 0) | `ITEM_STATE_COPY.charges` = `"{k}/{max} · {n} SQ"` | `charges` |

Every activatable row (Gear-tab worn/carried, ITEMS submenu) stays
`enabled: true` regardless of this state — the Phase 38 ruling, carried
forward: a tap on cooldown/recharging dispatches exactly like a ready one,
and the engine's own named `useRefused {reason:"cooldown"|"recharging"}`
line lands in the fight log/Oracle rather than a disabled no-op. A tool with
no `use` (rope/ladder) never appears as an ITEMS submenu row or a Gear-tab
"Use" button — unchanged from before this plan (the combat-menu `carriedRows`
filter and the Gear-tab row's `it.use` gate are both untouched).

### The condition-chip strip

`engine/derived.js#conditionsOf(state)` (Plan 03) already enumerates one
chip per live item effect (`haste`/`invis`/`acute`/`ether`/`might`/`lit`, via
`liveItemEffects`), one `itemCooldown` chip per cooling duration+cooldown
item, and one `staffCharges` chip per recharging staff. This plan wires the
shell's copy tables and tap explanation onto that shape (`mazeworld.html`'s
`CONDITION_COPY`/`CONDITION_TONE`/`CONDITION_EXPLAIN`, `paintConditions`):

| Chip key | Label | Detail | Tone |
|---|---|---|---|
| `lit` (the torch) | `Lit` | `{n} sq` | good |
| `itemCooldown` | the item's OWN name (`cn.item`, no fixed label) | `cd {n} sq` | odd |
| `staffCharges` | the staff's OWN name (`cn.item`) | `{charges}/{max} · {n} sq` | odd |
| `might` (now ALSO a timed Strength potion effect, not only the untimed spell buff — RULES-11, Phase 75.2, Plan 02: Enlarge no longer contributes here, it is a size step instead, see the `giant`/`enlarge` size-chip fields below) | `Strong` | `{n} sq` when the chip carries a live `remaining` (a potion effect); nothing when it doesn't (the spell buff, lasts the day, unchanged) | good |
| `acute` | `Acute` | `{n} rds` in combat, `{n} sq` outside — now read from the chip's OWN `cadence` field (Acuteness's potion activation declares `cadence:"rounds"`), not a live-`S.combat` guess | good |

Tapping any chip pushes a one-line rail explanation via
`explainCondition(cn, label)` (new): for an ITEM-sourced chip (one carrying
`cn.source` — a live item effect — or `cn.item` — `itemCooldown`/
`staffCharges`) the line names the item and what's counting first —
`"{Item} — {what}, {n} {squares|rounds}."` (`what` is `"cooling"` for
`itemCooldown`, `"{k} of {max} charges, next in"` for `staffCharges`, else
the chip's own label lower-cased) — then appends the plain
`CONDITION_EXPLAIN[cn.key]` sentence, e.g. `"Cloak of Speed — cooling, 41
squares. Used, and not ready to be used again. Squares fix that."` or
`"Cloak of Speed — hasted, 23 squares. Two strikes a round while it lasts.
Spend them on something that deserves it."` (matching the CONTEXT.md
specifics example verbatim for the cooling case). A non-item chip (ward,
darkness, afraid, the spell might buff, a foe debuff, an affliction) falls
straight through to the plain `CONDITION_EXPLAIN` sentence, unchanged from
before this plan.

### The three rail cards

1. **Hazard pre-roll decision** (`S.pendingHazard`, set by `engine/
   movement.js` per Plan 04) — a fresh wall/gorge tile with the matching
   tool carried pauses BEFORE any roll: `RAIL_COPY.hazard.title = "A
   CHOICE"`, buttons `USE LADDER`/`USE ROPE` (`window.mzUseTool(tool, dir)`,
   zero roll, zero fall damage) beside `CLIMB IT`/`LEAP IT` (`window.
   move(dir)`, the same synchronous roll as always). Wins over an older
   joiner/find card (a fresh movement decision), gated `!S.combat && !S.store`.
2. **Retry with tool** (`window.__mzRail.pending.kind === "climb"`) — the
   existing post-fall CLIMB IT/LEAP IT card now ALSO offers `USE LADDER`/
   `USE ROPE` when the matching tool is carried, via `window.
   __mzHasTool(S.c, tool)`; the retry label itself reads the pending
   record's own `feat` (`CLIMB IT` for a wall, `LEAP IT` for a gorge,
   falling back to the plain `RAIL_COPY.climb.retry` when `feat` is
   somehow absent).
3. **Dark with torch** (`window.__mzRail.pending.kind === "dark"`, gated on
   a still-live `S.c.darkFor` AND a carried torch) — a fresh `darknessFell`
   offers `USE TORCH` (`RAIL_COPY.dark.torch`), dispatching `window.
   mzUseItem(window.__mzToolIndex(S.c, "torch"))` — the bag index is
   resolved at TAP time, never stashed (T-39-15), so a stale card can never
   dispatch a wrong slot.

`stepNow(dir)` was refactored into `stepWith(action)` — the action-agnostic
dispatch body (`dispatchWithNarration`, `noteCombat`, haptics, the pending-rail
computation, the pre-death beat, narration stash, paint/draw/log, the
moved-event recenter) `stepNow`/`window.mzUseTool` both call, so a spent
tool goes through the EXACT same post-dispatch pipeline a normal step does.

### The Hero-tab to-hit routing

`#s-die`/`#s-hit` now read `window.__mzStrikeDie(S.c)`/`window.
__mzToHit(S)` — the SAME `engine/derived.js#strikeDie`/`toHit` functions
`engine/combat.js`'s own strike resolution reads — instead of the classic
script's stale `strikeDie()`/`toHit()` duplicates (left in place, unread,
as dead code for the cleanup milestone's classic-duplicate deletion). This
is what makes the weapon `need` axis (Plan 01) and Acuteness's crit-die
swap visible on the sheet: a Fighter with a Rapier (`need: +1`) now shows
`1–6`, a Flail (`need: -1`) shows `1–4`.

### What stays for the cleanup milestone

Done in v1.6 — Phase 44 (DEAD-01) and Phase 47 deleted the classic `strikeDie()`/`toHit()`/`useItem()` duplicates.

## Requirements map — Plan 05

| Requirement | Landed in | Proof |
|---|---|---|
| GEAR-01 | Plan 01 (weapon need/crit + armor bulk axes, expectedStrike) + Plan 02 (bot buy policy, the ledger) | `test/unit/gear-axes.test.js`; `test/unit/bot-buy-policy.test.js` |
| GEAR-02 | Plan 03 (the `c.timers` activation model — use → effect → cooldown/charges, the four narrated transitions, tolerant load) + Plan 05 (the rendered row states + chips, satisfying the requirement's own "shown on the item and as a condition chip" text) | `test/unit/item-activation.test.js`; `test/unit/itemRowState.test.js`; `test/unit/conditions.test.js`; `test/unit/shell-gear-39.test.js` |
| GEAR-05 | Plan 04 (the tools content, the `pendingHazard` pre-roll engine, the torch's `lit` effect) + Plan 05 (the rendered decision-point cards, satisfying the requirement's own "offered at the matching decision point" text) | `test/unit/tools.test.js`; `test/unit/shell-gear-39.test.js` |
| SC-1: store and loot present meaningful weapon/armor trade-offs, recorded as a before/after ledger | Plan 01 + Plan 02 | `test/unit/gear-axes.test.js` (band role coverage); this ledger's per-class table |
| SC-2: an activated item shows its effect-remaining, then its cooldown-remaining, as a condition chip until it's usable again | Plan 03 (the timer records) + Plan 05 (the chip render + row-state rule) | `test/unit/item-activation.test.js` (effect → cooldown records); `test/unit/itemRowState.test.js`; `test/unit/conditions.test.js` (chips) |
| SC-3: a one-shot tool is offered and consumed at its decision point (e.g. the CLIMB IT rail card) | Plan 04 (the engine's `pendingHazard`/`useTool`/torch model) + Plan 05 (the actual cards) | `test/unit/tools.test.js` (hazardChoice/useTool/torch sections); `test/unit/shell-gear-39.test.js` (the card wiring) |
| SC-4: tools appear as loot and store stock at depth-appropriate tiers | Plan 04 | `test/unit/tools.test.js` (loot row + store tiers sections) |

## Out of scope / next

- Spells and scrolls sharing the same `c.timers` model — Phase 40.
- The torch vs. the map reveal/timed-light rework — Phase 41 (this phase's
  torch only ever touches `c.darkFor`, never the reveal-radius model).
- Tuning-bot tactics for timing a carried tool and for popping an item
  mid-run at the right moment — landed: see `docs/CLASS-PASS.md`
  `### Phase 42 tactics (BAL-01 second half)`. Buying/carrying a tool from
  the store specifically (a `chooseStorePurchase` extension) remains
  unaddressed — a follow-up, not this phase's scope.
- (done — see above)
