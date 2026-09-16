# Roll-Direction Audit — Bonus/Penalty Inversions

**Audited:** 2026-09-16
**Scope:** every `rng.d(N)`-vs-threshold comparison and every modifier folded into either side, across `engine/*.js`, cross-checked against `test/parity/prototype-master.js.txt` (canonical implementation) and the design docs (`content/races.js`, `content/classes.js`, `content/flavor.js`, `docs/CLASS-PASS.md`, the Phase 24 identity-contract summaries).
**Baseline:** `npm test` — 1593/1593 passing, recorded once before this audit, repo left untouched (no code/test edits made).
**Method:** CODE READ ONLY. No web research. No files modified except this report.

## How the system works (confirmed from code + rulebook)

Mazeworld is a **LOW-roll-good** system almost everywhere a d-die is compared to a "need"/target number:

- Player to-hit: `roll <= toHit(state)` — a **higher** `toHit` number is **better** (more roll values succeed). `content/classes.js` confirms this empirically: Fighter `toHit: 5` (best), Thief `toHit: 4`, Magic User `toHit: 3` (worst) — exactly matching `content/flavor.js`'s "three swings in four hit nothing" (Fighter, 5/20) and "six swings in seven are decorative" (Magic User, 3/20).
- Foe-vs-player to-hit: `roll > need` → miss, where `need = foeToHitVs(state)` — a **lower** `need` is **better for the player** (harder for the foe to land a blow). Confirmed by `content/treasure-tables.js`'s Anklet of Invisibility (`foeToHit:-2`, "foes need two better to land") and by the Phase 24 identity-contract table itself, which labels Guard's `foeToHitVs -1` a **GOOD** entry.
- Strike die (`strikeDie`) and foe die (`foeDie`): **lower die is better for the roller** (`STRIKE_DICE = [20,12,10,8,6]`, index rises = die shrinks = better).
- Armor soak (`soak <= ar`): higher AR is better (more likely to soak).
- Two flee/initiative subsystems (`rollInitiative`, `flee`) are the sole **HIGH-roll-good** exceptions, confirmed self-consistent (see sites #1 and #14 below).

Every one of the ~34 roll-vs-threshold sites below was checked against this model.

## Roll-Comparison Site Inventory

| # | Site (file:line) | Roll | Good direction | Target expr | Modifiers folded in | Verdict |
|---|---|---|---|---|---|---|
| 1 | combat.js:118-134 `rollInitiative` | `mine=d20`, `theirs=d20` | HIGH (own subsystem) | `mine >= theirs` | none (samurai/slow/knightBig/courtMage/foreseen/Acute Hearing are overrides, not additive mods) | OK |
| 2 | combat.js:160 `startCombat` Tracking | `r=d20` | LOW | `r <= 5` | none (flat, gated on skill possession) | OK |
| 3 | combat.js:176 `startCombat` foe count | `d4` (short-circuit) | n/a (count table) | canon ternary | `curve.foeBonus` added **after** the roll via `foeCountFor` — not a to-hit style bonus | OK / N/A |
| 4 | combat.js:297 Con Artist weak-foe flee | `d6` | LOW | `<= 4` | none (flat sub ability) | OK |
| 5 | combat.js:304 Court Mage boredom | `d12` | LOW | `<= 2` | none | OK |
| 6 | combat.js:434 Fridgian frenzy | `d8` | LOW | `<= 5` | none | OK |
| 7 | combat.js:448-455 `playerStrike` | `d(strikeDie)` | LOW | `need = toHit(state)`, then `Math.max(need,5)` vs a dozing foe, `Math.min(need, t.sp.toHit)` vs a hard-to-hit foe, `Math.max(1,need-1)` vs a `fast` foe, `need=0` vs `magicOnly` w/o magic weapon | sleep raises need (easier, correct); `t.sp.toHit` caps need down (harder, correct — matches bestiary notes e.g. Zit "hittable only on a 4"); `fast` lowers need (harder, correct, matches prototype verbatim); `magicOnly` zeroes need (untouchable, correct) | OK |
| 8 | combat.js:505 Stealth crit | roll | LOW | `<= 2` | none | OK |
| 9 | combat.js:515 Ninja crit | roll | LOW | `<= 2` | none | OK |
| 10 | combat.js:605 loot drop | `d20` | n/a (loot table) | `<= 2+f.lvl` | foe level raises chance — intended (tougher foe = better loot) | OK / N/A |
| 11 | combat.js:608 bag-upgrade drop | `d20` | n/a | `<= BAG_DROP_UNDER` | none | OK / N/A |
| 12 | combat.js:651-673 `pursuitStrike` | `d(foeDie)` | LOW | `need = foeToHitVs(state)` then blind→1, `Math.min(need, C.foeToHitPenalty)`, `insulted: need+1` | blind lowers need (correct), Weaken's penalty caps need down (correct, "they need a 3 to hit"), a failed parley's insult raises need (correct, worse for player) | OK |
| 13 | combat.js:679 Soldier crit-taken | roll | n/a (victim-side) | `roll===1 \|\| (roll<=2 && Soldier)` | Soldier's documented BAD trait widens the crit window against them — correct direction | OK |
| 14 | combat.js:744-747 `flee` | `d20` | HIGH (own subsystem) | `roll+bonus >= 11` | Thief `bonus=5` (documented "getting out is the Thief's whole trade") raises the roll, easier success — correct | OK |
| 15 | combat.js:884-897 `parley` | `d20` | LOW | `need = min(9+bonus, 17)` | `bonus` built from Con Artist(+4)/Woodsman(+3)/Wilmsry(+4)/Elven-vs-Humans(+3)/`2*fluency`/`+level`/`-topFoeLvl` — every term raises `need` (easier) in the direction its own description implies; top foe level lowers it (harder vs strong foes) | OK |
| 16 | combat.js:1087 `allyTurn` (summon) | `d(STRIKE_DICE[lvl-1])` | LOW | `<= 5` | none | OK |
| 17 | combat.js:1149 `alliesTurn` legacy | same | LOW | `<= 5` | none | OK |
| 18 | combat.js:1209-1213 `memberStrike` | `d(strikeDie(view))` | LOW | `need = memberToHit(view)` | class/race/sub/Kata only — mirrors `toHit` exactly | OK |
| 19 | combat.js:1259-1269 `allyCast` thrown | `d8`/`d10` | LOW | `need`, compared as `roll-bonus <= need` | `bonus = schoolBonus + eff(throw)` — subtracts from roll, easier hit — mirrors `castSpell`'s thrown branch exactly | OK |
| 20 | combat.js:1509-1511 `applyFoeDamageToPlayer` armor soak | `d20` | LOW (soak wanted) | `soak <= av.ar` | `armorSoak(c)` (Cloak of Armor take-the-better) raises effective `ar` — correct (better armor, more soak) | OK |
| 21 | combat.js:1669 foe-ability cast gate | `d6` | n/a (AI gate) | `<= 4` | none | OK |
| 22 | combat.js:1751-1771 `foeTurn` (hero swing) | `d(foeDie)` | LOW | same shape as #12 (blind/penalty/insulted) | same as #12 | OK |
| 23 | combat.js:1778 Soldier crit-taken (foeTurn variant) | roll | n/a | same as #13 | same as #13 | OK |
| 24 | combat.js:1694-1715 `foeTurn` (member swing) | `d(foeDie)` | LOW | `mNeed = foeToHitVs(state)` + blind/penalty/insulted | identical shape to #12/#22, targeting a party member instead of the hero | OK |
| 25 | encounters.js:64-69 `springTrap` dodge | `d20` | LOW | `dodge <= nimble`, `nimble = 5 + Agility(2) + Leaping(1) + Acrobat(3)` | every skill/sub adds positively to `nimble` (easier dodge) — correct | OK |
| 26 | encounters.js:109-129 `openChest` tiered | `d10` | LOW | `need = [0,5,7,8][tier] + intelBonus(c)` | higher Locks tier and higher intel both raise `need` (easier open) — correct, matches derived.js's own RULE-01 rationale | OK |
| 27 | encounters.js:109-135 `openChest` bare | `d20` | LOW | `need = 8 + intelBonus(c)` | intel raises need (easier) — correct | OK |
| 28 | foeDamage.js:96-98 natural-armor soak | `d20` | LOW (soak wanted) | `roll <= foe.sp.ar` | none (foe's own bestiary `sp.ar` constant; no character modifier stacks here) | OK |
| 29 | magic.js:339-360 thrown spell vs armor | `d8`/`d10` | LOW | `roll - bonus <= target` | `bonus = schoolBonus(sub,school) + eff(c,"throw")` subtracts from roll, easier hit — matches prototype `roll - bonus <= target` verbatim; MU_CHART's offense-school values are all positive for offense-leaning subs (Warlock 4, Wizard 3, Sorcerer 4 highest) | OK |
| 30 | movement.js:174-186 climb | `d10` | LOW | `r <= tbl.success`, `r = d10 - climbBonus(c) + heightsPenalty(c)` | Climbing skill (`-4`) lowers `r` (easier); Heights phobia (`+2`, halved by Hardiness) raises `r` (harder) — both correct | OK |
| 31 | movement.js:187-198 leap | `d10` | LOW | fail if `r > need`, `r = d10 - leapBonus(c) + waterPenalty(c)` | Leaping skill (`-2`) lowers `r` (easier); water phobia (`+2`, halved by Hardiness) raises `r` (harder) — both correct | OK |
| 32 | movement.js:461-463 affliction cure | `d20` | LOW | `<= 10 + (Hardiness ? 4 : 0)` | Hardiness raises threshold (easier cure) — correct | OK |
| 33 | movement.js:526-534 wandering-monster wake | `d20` per hour | n/a (bad-outcome trigger) | `<= wakeOn`, `wakeOn = Bard?2:1` | Bard's documented BAD trait doubles the wake window — correct direction (worse) | OK |
| 34 | derived.js:561-564 `resistRoll` (shared hero/foe intel resistance) | `d20` | HIGH (resistor wants roll < intel) | `resisted = roll < intel`, gated `intel >= 12` | no stacking modifier exists in current content on either the hero's or a foe's `intel`; matches prototype `r < t.intel` verbatim (p.25 canon) | OK |

**34 roll-comparison sites audited.** 32 = OK (including 8 marked OK/N/A — no character-derived bonus/penalty modifies the comparison at all, so there is no direction to invert). **0 sites classified DEAD** (every modifier read by combat.js/derived.js/magic.js/movement.js/encounters.js has at least one content source that sets it, *except* `eff(c,"toHit")` — see Finding 3 below, which is a "no current source" note rather than a direction bug). **2 sites classified INVERTED/AMBIGUOUS at the DATA layer** (not the roll-comparison arithmetic itself — see Findings 1 and 2).

## Findings

### Finding 1 — INVERTED (data-layer, inherited from the frozen 1994 prototype): Elven `foeToHit: -1`

**Site:** `content/races.js:9` — `"Elven": { ..., foeToHit: -1, toHit: 5, note: "Strikes a die better and hits on 5 whatever the class — but thin-boned and easy to hit." }`, consumed by `engine/derived.js#foeToHitVs`: `if (R.foeToHit) h += R.foeToHit;`

**What the code does:** `foeToHitVs` is what a foe needs to roll to hit the player — **lower is better for the player** (confirmed by site #12/#22/#24 above, by the Anklet of Invisibility's `foeToHit:-2` = "foes need two better to land", and by the Phase 24 identity-contract table itself labeling Guard's `-1` a **GOOD** entry). Elven's `foeToHit: -1` therefore makes elves **harder to hit** than a Human baseline (`foeToHitVs` 4 vs 5) — mechanically a **defensive bonus**.

**What every design source says the trait should be:** Elven is supposed to be the race's downside/BAD trait, not a bonus:
- `content/races.js`'s own note: "thin-boned and **easy to hit**"
- `content/flavor.js:26`: "Thin-boned, **easy to hit**, and carrying not much more than half a person's Hit Points"
- `docs/CLASS-PASS.md:802` and `.planning/milestones/v1.2-phases/24-…/24-06-SUMMARY.md:136`, both under the explicit GOOD/BAD identity-contract columns: `| Elven | Strikes a die better and hits at 5 whatever the class | 0.6x wp and **easier to hit** |`
- The Phase 24 identity-contract test plan itself (`24-06-PLAN.md:141`) files `foeToHitVs` = 4 under Elven's **`bad:`** scenario key — i.e. the test suite's own authors treated a *lower* `foeToHitVs` number as the intended-bad outcome, apparently assuming "lower number = worse" without checking that this system's `foeToHitVs` is LOW-good. This is the same reasoning slip baked into the original 1994 rule.

**Verdict: INVERTED at the design-intent level.** The sign should be `foeToHit: +1` (or some other positive value) to make Elves genuinely easier to hit, matching every prose description of the race across three independent documentation sources and the flavor text carried in both the port and the original prototype. As implemented, an Elf's supposed glass-cannon downside is *silently also a defensive upside* — every Elf is measurably harder to land a blow on than a Human (need 4 vs 5, i.e. roughly a 20% relative reduction in foe hit-rate at the base value), which is never told to the player and contradicts the character's own flavor text.

**Provenance — this is NOT an engine-port regression.** `test/parity/prototype-master.js.txt:280-281` carries the byte-identical `foeToHit: -1` value and the byte-identical "thin-boned and easy to hit" note — this sign error is **inherited verbatim from the original 1994 prototype/tabletop port**, not introduced by any engine-porting phase. Per the fidelity rule ("the prototype's rules are canon; deviations must be deliberate design decisions, not accidental regressions"), the engine is *correctly* byte-matching a design bug that predates this codebase. Fixing it is therefore a genuine **canon rules deviation requiring an explicit user decision** (same category as the previously-declared PHOBIA-01/RULE-01/RULE-02 deliberate rules changes), not a silent bugfix.

**Parity implication if fixed:** flipping the sign changes `foeToHitVs` for every Elven character (any combat fixture using an Elven hero) and would require updating `test/unit/identity-contract.test.js`'s Elven `bad:` assertion (currently asserts `foeToHitVs === 4`) plus `docs/CLASS-PASS.md`/`24-06-SUMMARY.md` prose only if the numeric value in the doc table changes (currently the docs already describe the *intended* direction correctly — only the code and the test assertion would need to move). No parity/chargen-parity fixture is affected (no frozen fixture uses an Elven hero in combat per the existing divergence records), but a live confirmation via `grep -rn "Elven" test/parity/` is recommended before any fix lands.

**Proposed fix (for planning purposes only — not applied by this audit):** change `content/races.js`'s Elven entry from `foeToHit: -1` to `foeToHit: 1` (or a tuned value the balance pass agrees on), update the `24-06`-era identity-contract assertion for the Elven `bad:` case, and re-verify docs/CLASS-PASS.md's number stays accurate.

---

### Finding 2 — INVERTED (UI display only, zero gameplay impact): character-sheet "TO HIT" label

**Site:** `src/browser/viewModels.js:244` — `{ key: "toHit", label: "TO HIT", value: `${toHit(state)}+` }`

**What it renders:** e.g. `TO HIT 5+` for a level-1 Fighter.

**Why this is backwards:** the actual rule is `roll <= toHit(state)` (LOW-roll-good — see the "How the system works" section above and site #7). A `5` means "hit on 1 through 5," never "hit on 5 or higher." The `+` suffix implies the opposite polarity (HIGH-roll-good), which is actively misleading to the player reading their own character sheet.

**What the frozen prototype did instead:** `test/parity/prototype-master.js.txt:1076` (and `mazeworld.html:2950`): `document.getElementById("s-hit").textContent = "1–" + toHit();` — i.e. the original UI correctly rendered `TO HIT 1–5`, matching the LOW-good rule exactly. The `${toHit(state)}+` formatting in `src/browser/viewModels.js` is a **UI-copy regression introduced during the port** (not inherited from the prototype like Finding 1) — the underlying `toHit(state)` **computation** is correct (verified OK at site #7); only the display template's suffix is wrong.

**Verdict: INVERTED (display-only).** No `test/parity/*` fixture is affected (parity fixtures never assert against rendered UI strings), and no gameplay math changes — this is purely a cosmetic mislabeling that tells the player the wrong rule.

**Proposed fix (for planning purposes only):** change `` `${toHit(state)}+` `` to `` `1–${toHit(state)}` `` in `src/browser/viewModels.js:244`, matching the prototype's own sheet text exactly. This is the ONE UI site in the current codebase that prints a `toHit`-derived number (confirmed via `grep -rn "toHit" src/browser/*.js` — no other occurrence).

---

### Finding 3 — Not a direction bug, but worth noting: `eff(c, "toHit")` has no current content source

**Site:** `engine/derived.js:338` — `h += eff(c, "toHit");` inside `toHit(state)`.

`eff(c, "toHit")` sums an item effect key named `"toHit"` across the player's carried items. A repo-wide search (`grep -rn "\"toHit\"\|toHit:" content/*.js`) confirms **no item, cloak, jewel, potion, or staff in `content/treasure-tables.js` (or any other content file) currently sets this key** — every item that touches to-hit-adjacent numbers uses `foeToHit` (defense) instead, never offensive `toHit`. This is not a direction inversion (the `+=` is correctly additive/positive-direction, matching every other verified bonus in `toHit`), just a latent hook with zero current data behind it. No action required unless a future item is meant to use it — flagged here only because the audit's method explicitly asked to check for DEAD modifier paths, and this is the one candidate found.

## Verified OK (compact list)

Every one of the following was checked for (a) correct roll-vs-threshold polarity and (b) correct sign on every modifier folded into either side, and found consistent with the LOW-roll-good (or, where noted, HIGH-roll-good) model and with `test/parity/prototype-master.js.txt`:

- Player `toHit` (class base, Elven/Cleric/Acrobat/Kata overrides via `Math.max`, `inspired` bonus, `eff(c,"toHit")`, dazed `-2`, in-dark cap `Math.min(h,2)`) — `engine/derived.js#toHit`
- `memberToHit` (party-member mirror of the above, minus hero-only terms) — `engine/derived.js#memberToHit`
- `foeToHitVs` (base 5, Acrobat override, Agility `-1`, Guard `-1`, `eff(c,"foeToHit")`, Silence-in-dark/Mirror/Invis overrides to `1`, floor at 1) — `engine/derived.js#foeToHitVs`, and its narration mirror `foeToHitBreakdown`
- `strikeDie`/`foeDie` (Elven `strikeStep`, Illusionist d20-until-3, Acuteness d6, Dwarven `foeStrikeStep`) — `engine/derived.js`
- `weaponDamage` (level², prof, magicWpn, race dmg/wpnBonus, might, Kata, Heft, Master of Arms +2, Gauntlet of the Giant size, Guard penalty, Sorcerer cap) — direction of every additive term matches its documented polarity
- `armorSoak`/Cloak of Armor take-the-better logic — `engine/derived.js#armorSoak`
- `resistRoll` (shared hero/foe intel resistance, p.25) — `engine/derived.js#resistRoll`
- `killSpFor`/parley's shared payout formula — no roll-direction risk (pure post-draw arithmetic)
- `playerStrike`'s full to-hit chain including dozing/hard-to-hit/`fast`/`magicOnly` foe overrides — `engine/combat.js`
- `foeTurn`/`pursuitStrike`/member-targeted swings' blind/`foeToHitPenalty`/`parleyInsulted` chain — `engine/combat.js`
- Weaken spell's `C.foeToHitPenalty = 3` (both `engine/magic.js` and the ally-cast mirror in `engine/combat.js#allyCast`) — correctly narrated "they need a 3 to hit"
- Armor-soak d20 rolls, both the player's (`applyFoeDamageToPlayer`) and a foe's natural armor (`engine/foeDamage.js`)
- Thrown-spell vs "armor" to-hit (`roll - bonus <= target`), both the hero's (`engine/magic.js#castSpell`) and the ally mirror (`engine/combat.js#allyCast`) — `schoolBonus`/`MU_CHART` values are all non-negative and correctly reduce the roll
- `springTrap` dodge (Agility/Leaping/Acrobat) — `engine/encounters.js`
- `openChest` lock rolls, both tiered and bare (Locks skill tier, lockpicks, `intelBonus`) — `engine/encounters.js`
- Climb/leap rolls (Climbing/Leaping skill bonuses, Heights/Bodies-of-water phobia penalties, Hardiness halving) — `engine/movement.js`
- Newday affliction-cure roll (Hardiness bonus) — `engine/movement.js`
- Wandering-monster wake roll (Bard's widened window) — `engine/movement.js`
- `flee`'s HIGH-good roll+bonus subsystem (Thief `+5`) — self-consistent, verified separately from the LOW-good majority
- `rollInitiative`'s HIGH-good `mine >= theirs` subsystem — self-consistent
- `parley`'s bonus stack (Con Artist/Woodsman/Wilmsry/Elven-vs-Humans/fluency/level, minus top foe level) — every term's sign matches its documented effect
- `content/mu-chart.js`'s per-subclass offense-school bonus table — all positive, highest for the most offense-leaning subs (Warlock/Sorcerer)
- `content/treasure-tables.js`'s Anklet of Invisibility (`foeToHit:-2`) — correctly worded and correctly signed
- Guard's `-1 foeToHitVs` — correctly signed and correctly labeled GOOD in the identity-contract table (the CONTRAST case that exposes Finding 1: an identical negative sign on the identical field is GOOD for Guard but WRONG for Elven, because the docs disagree about which direction Elven is supposed to move)
- Every `sp.toHit` bestiary override (Zit, Drat, Stink Bug, Skeleton) consumed via `Math.min(need, t.sp.toHit)` — correctly makes the creature harder to hit, matching each creature's own flavor note
- Soldier's widened crit-taken window (`roll<=2` instead of `roll===1`) in both `playerStrike`'s victim-side callback... (n/a, this is foe-side) — confirmed in `foeTurn`/`pursuitStrike` — correctly a BAD trait
- `damageFoe`'s natural-armor soak and `DAMAGE_MULTIPLIERS` lookup — no roll-direction risk (multiplier magnitude, not a comparison operator)
- `difficulty.js`'s `foeWpFor`/`foeDmgBonusFor`/`abilityCadenceFor` — all scale foe threat UP with depth and DOWN on grace floors, correct direction (not a to-hit comparison, but audited per the task's explicit request re: FOE_POWER/ABILITY_THREAT)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Finding 1's proposed fix value (`foeToHit: +1`) is a placeholder, not a balance recommendation — the correct MAGNITUDE (not just sign) is a design call outside this audit's scope | Finding 1 | A future balance pass could pick a different magnitude than `+1`; this audit only asserts the SIGN is wrong, not the specific replacement number |
| A2 | No parity fixture currently exercises an Elven hero in a `foeToHitVs`-sensitive path (asserted from `test/parity/FIXTURE-INVENTORY.md`'s absence of an Elven-combat divergence record, not from an exhaustive fixture-by-fixture read of every seed) | Finding 1 | If a fixture does pin an Elven `foeToHitVs`, fixing the sign would require a declared parity divergence record before landing |

## Sources

### Primary (HIGH confidence — direct code/doc read this session)
- `engine/derived.js`, `engine/combat.js`, `engine/foeAbilities.js`, `engine/foeDamage.js`, `engine/magic.js`, `engine/items.js`, `engine/encounters.js`, `engine/movement.js`, `engine/economy.js`, `engine/character.js`, `engine/difficulty.js` — full reads
- `content/classes.js`, `content/races.js`, `content/mu-chart.js`, `content/flavor.js`, `content/spells.js`, `content/treasure-tables.js`, `content/foe-abilities.js`, `content/bestiary.js` (grep + targeted reads)
- `test/parity/prototype-master.js.txt` — grepped and read at every site cross-checked (rollInitiative, foeToHitVs, foeToHitPenalty/weaken, thrown-spell to-hit, fast-monster to-hit, Elven race row, TO HIT sheet rendering)
- `docs/CLASS-PASS.md`, `.planning/milestones/v1.2-phases/24-every-sub-class-and-race-one-good-one-bad/24-06-PLAN.md`, `.planning/milestones/v1.2-phases/24-every-sub-class-and-race-one-good-one-bad/24-06-SUMMARY.md`
- `npm test` baseline run: 1593/1593 passing (recorded once, no repo mutation)

## Metadata

**Confidence breakdown:**
- Roll-comparison arithmetic (the 34-site inventory): HIGH — every site read directly in `engine/*.js` and cross-checked against the frozen prototype's exact line
- Finding 1 (Elven inversion): HIGH — triangulated across four independent sources (races.js note, flavor.js note, CLASS-PASS.md, 24-06-SUMMARY.md) all agreeing on the intended direction, against the one code site that implements the opposite
- Finding 2 (UI label): HIGH — direct diff against the prototype's own sheet-rendering line

**Research date:** 2026-09-16
**Valid until:** stable until `engine/derived.js#foeToHitVs`/`toHit`, `content/races.js`, or `src/browser/viewModels.js`'s sheet stats are next touched
