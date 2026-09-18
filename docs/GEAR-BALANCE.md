# Gear Balance (Phase 39 ledger)

**Phase:** 39-gear-magic-items-one-shot-tools
**Date:** 2026-09-18

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
| Flee roll | `engine/combat.js#flee` | `roll + bonus - bulk >= 11` (bulk subtracted) |
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
and a `noCrit`-carrying item) — a Soldier's own blows NEVER crit,
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

**Deferred to Phase 42 (BAL-02 prep):** item-USE tactics (when to pop a
potion/staff/scroll mid-run) and any bot awareness of the GEAR-02
duration/cooldown/charge model or the GEAR-05 one-shot tools — this plan
only teaches the bot to BUY/EQUIP under the new weapon/armor axes, so the
smoke below is honest. `tools/lib/tuning-bot.mjs`'s own cell rows carry no
"bought" counter today — a Phase 42 harness ask, not added here (out of
this plan's own file list).

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

### The three tables

**Duration + cooldown** (JEWELRY/CLOAKS rows with a `use`, plus the
auto-activating Cloak of Flying) — source: canon `every`/duration text,
re-authored per the once-a-day rule where noted above:

| Row | act.kind | effect (squares) | cd (squares) | source |
|---|---|---|---|---|
| Pendant of Fortitude | half | 0 (instant: `c.halfNext = true`) | 100 | canon `every: 100`, unchanged |
| Amulet of Stone | stone | 0 (instant, AoE 4 kill) | 100 | once-a-day rule, was 200 |
| Cloak of Invisibility | invis | 50 | 50 | once-a-day rule, was 100/100 |
| Cloak of Speed | haste | 50 | 50 | canon `every: 50`, unchanged |
| Cloak of Ether | ether | 20 | 80 | once-a-day rule, cd was 100 |
| Cloak of Flying | fly | 20 | 50 | canon "once every 50" — the row has no `every` field (it auto-activates, no `use`), so `act.cd: 50` is the explicit override |

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

**Consumables** (POTIONS rows; consumed on use; no cd) — source: canon
duration text verbatim:

| Row | act.kind | effect | extra |
|---|---|---|---|
| Speed | haste | 50 squares | |
| Strength | might | 25 squares | `might: 8` |
| Enlarge | might | 50 squares | `might: 4` |
| Acuteness | acute | `{ n: 1, sides: 8, bonus: 0 }` rounds | `cadence: "rounds"` |
| Invisible | invis | 100 squares | canon text says "a day"; the prototype set 100 — kept |

Healing / Xtra Healing / Cure Poison / Cure Disease / Death: instant, no
`act`. Passive rows (Ring of Power, Gauntlet, Amulet of Light, Anklet, Helm,
Bracelet of Flight, Cloak of Healing/Strength/Regeneration/Armor): no `act`.

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

`itemEffectStarted { item, kind, left, cadence, might? }` — a use started a
timed effect (kind-keyed narration: haste/invis/ether/acute/might/fly each
get their own line; an unrecognized kind falls back to "{item}: {n}
squares."). `itemEffectFaded { item, kind }` — an effect record expired
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

### Members never activate items

`alliesTurn`/`memberStrike` (`engine/combat.js`) have no item-use branch —
verified by grepping `useItem` across `engine/combat.js`. Party members
therefore never carry an `item:`/`charges:` timer record on their own
sheet; their passive `eff(view, …)` reads (worn-item flat bonuses) are
completely untouched by this plan.

### The `txt` note

Every JEWELRY/CLOAKS/STAVES row's flavor `txt` field is left BYTE-IDENTICAL
on export (`content/treasure-tables.js#dropAuthored` strips `slot` and `act`
the same way Phase 37 stripped `slot` alone) — seven parity fixtures carry a
starting cloak's `txt` in their compared `c.items`/`c.worn` shape, so
editing it would move fixtures this plan explicitly declares untouched. The
Gear tab's row state (Plan 05) renders the LIVE numbers (remaining/cooldown/
charges) instead of relying on the static flavor text to stay accurate.

## One-shot tools (GEAR-05) — Plan 04

Appended by Plan 04.

## Chips and row states — Plan 05

Appended by Plan 05.

## Requirements map — Plan 05

Appended by Plan 05.
