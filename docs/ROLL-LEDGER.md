# ROLL-LEDGER — Phase 72 roll-direction sign audit (ROLL-01)

**Audited:** 2026-09-24 (Phase 72, commit `9197002` / `91970020af122246a72e7601eeea93a90ed7af14` — engine and content untouched at audit start).
**Extends:** `.planning/milestones/v1.3-phases/31-combat-start-gating-effect-hygiene/31-ROLL-DIRECTION-AUDIT.md` (34-site inventory, commit b92ce09, audited 2026-09-16). This ledger carries every Phase 31 site forward and adds every die check Phase 31's narrower combat-only scope did not cover (thrown spells, resistance, traps, locks, climbs, leaps, cures, wake, loot drops, chargen selection gates).
**Method:** code read plus the odds-based direction test 72-02/72-03 build alongside this ledger (`test/unit/rollDirection.test.js`, `test/unit/rollDirection-checks.test.js`). No engine, content or src file is touched by this plan — audit and record only.

## How to read this ledger

Today's engine is **roll-under almost everywhere**: a d-die is drawn and compared to a "need" (or a foe's "need"), and success is `roll <= need`. A **higher need is better for the roller**. The two exceptions are flee and initiative, which are **roll-high**: `roll (+ bonus) >= a target` (flee) or `mine >= theirs` (initiative), where a **higher roll is better**.

- **A hero hit** is `roll <= toHit(state)` (or `memberToHit`/`strikeDie` combinations) — a bigger `toHit` number is a bonus.
- **A foe miss** (good for the hero) is `roll > foeToHitVs(state)` — a *smaller* `foeToHitVs` number is a bonus to the hero (harder for the foe to land a blow). A larger `foeToHitVs` number is a bonus *to the foe*.
- **Flee and initiative** are the roll-high exceptions: a bigger roll (or a positive additive bonus) is good for the roller in both.

**The Phase 73 roll-high reading.** Phase 73 mirrors the whole engine so every draw's outcome stays byte-identical, but the way a human reads the die changes: a draw `r` on an N-sided die is read as `(N+1) - r` against a high target. A roll-under need of `k` on a dN becomes "succeed on `(N+1-k)` through `N`" after the mirror. Worked example: the parley insult today narrows the foe's find-window from need 1 (find only on a natural 1) to need 2 (find on a 1 or a 2) on a d20. After Phase 73's mirror the SAME two draws that found the hero before are read as **19–20** on a d20 — "smoked and insulted, foes find you on a 19 or a 20."

**Verdict vocabulary used throughout this ledger:**
- `OK` — the modifier's claimed direction and its verified engine effect agree.
- `OK (clamp)` — a clamp (a floor, a ceiling, or an override to a single face) absorbs the modifier so it never worsens the roller's odds, even though the raw arithmetic would otherwise combine with something else. A clamp never turns a bonus into a penalty.
- `OK (deliberate, Phase N)` — the modifier's sign was deliberately changed from the frozen prototype's value in a numbered phase, and that change is intentional, not a bug (e.g. Elven `foeToHit +1`, Phase 31 Finding 1's fix).
- `N/A (no modifier)` — a flat gate (a fixed threshold with no character-derived modifier folded in). It gets a site row but no modifier row.
- `BUG → 72-0N` — a text-backed sign or ordering bug this phase found, fixed by the named plan.
- `FINDING Fn` — a new-findings-table row; see `## New findings` for its classification and disposition.

## The device trigger

The phase's trigger event: a hero dropped a heavy weapon and the device read "−2 to hit," and the user could not tell from that number alone whether the drop made the character better or worse at hitting things. **The audit confirms the modifier itself was correct**: `weaponNeedMod` for a heavy weapon is `-1` or `-2`, and it is *subtracted* from the hero's `toHit` need in `engine/derived.js#toHit` (`content/weapons.js`'s heavy rows, e.g. Warhammer/Maul/Two-Handed Sword, carry a negative `need`). A lower `toHit` need narrows the range of rolls that succeed (roll-under: fewer face values ≤ need), so "−2 to hit" was a real, correctly-signed penalty — heavy weapons ARE worse to swing, exactly as the flavor text for every heavy weapon says ("slow and punishing to wield," etc.). **Only the presentation was ambiguous**: the device showed a bare signed number with no unit or direction cue, so a −2 read exactly like it could have meant "2 easier" to a player unfamiliar with the convention. That ambiguity is a display/narration problem, not a rules bug, and its fix belongs to Phase 74 (`## Handoffs → Phase 74` below carries it forward).

## Site inventory

Columns: `# | Site (file#function) | Die | Who rolls | Success means | Roll-high today? | Modifier sources ([site:source] ids) | Phase 31 # | Verdict`.

One row per **CHECK site** — a die roll compared against a threshold that decides success/failure for a roller. `SELECTION` (a table/target pick) and `AMOUNT` (a damage/heal/duration/count draw) draws are not checks; they are inventoried separately in `## Not-a-check draws` below. 42 CHECK sites are catalogued (line numbers are current at commit `9197002`; later plans will shift them, so sites are keyed by function name first).

| # | Site (file#function) | Die | Who rolls | Success means | Roll-high today? | Modifier sources | Phase 31 # | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | combat.js#resolveInitiative (L181-182) | 2×d20 | hero vs foe | `mine >= theirs` | YES (own subsystem) | `[initiative:samurai]`, `[initiative:fridgian-slow]`, `[initiative:knight-big-foe]`, `[initiative:court-mage]` (forced-foe overrides), `[initiative:foresight]`, `[initiative:acute-hearing]` (forced-you), `[initiative:senses]` (waives forced-foe) | 1 | OK |
| 2 | combat.js — Tracking (retired) | — | — | — | — | none | 2 | REMOVED (Phase 38, ABIL-02) — the Tracking read was retired; no current site replaces it as a standalone CHECK. Recorded so the count reconciles. |
| 3 | combat.js#startCombat foe count (L247) | d4 | n/a (table pick, not a check) | n/a | n/a | `curve.foeBonus` applied AFTER the roll via `foeCountFor`, not a to-hit-style modifier | 3 | OK / N/A (SELECTION, see appendix) |
| 4 | combat.js#startCombat Con Artist weak-foe flee (L365) | d6 | hero | `<= 4` | LOW | none (flat sub gate) | 4 | OK |
| 5 | combat.js#startCombat Court Mage boredom (L372) | d12 | hero | `<= 2` | LOW | none (flat sub gate) | 5 | OK |
| 6 | combat.js#fight phobia Hardiness shrug (L481) | d2 | hero | `=== 1` | LOW | none (flat, gated on Hardiness skill) | — | OK (new since Phase 31; a flat gate, N/A modifier) |
| 7 | combat.js#playerStrike frenzy trigger (L597) | d8 | hero (Fridgian) | `<= 5` | LOW | none (flat race gate) | 6 | OK |
| 8 | combat.js#playerStrike strike die (L604, Philly L610) | d(strikeDie) | hero | `roll <= toHit(state)`, then per-target overrides | LOW | `[hero-strike:class-*]`, `[hero-strike:elven]`, `[hero-strike:acrobat]`, `[hero-strike:cleric]`, `[hero-strike:inspired]`, `[hero-strike:weapon-light/heavy]`, `[hero-strike:dazed]`, `[hero-strike:dark-cap]`, `[hero-strike:night-vision]`, `[hero-strike:senses]`, `[hero-strike:dozing]`, `[hero-strike:stupid]`, `[hero-strike:hard-to-hit]`, `[hero-strike:fast]`, `[hero-strike:magic-only]`, `[hero-strike:overhead-blow]`, `[hero-strike:afraid]`, `[hero-strike:floor-clamp]`, `[hero-strike:philly-slow]`, `[hero-strike:auto-hit]`, `[hero-strike:level-die]`, `[hero-strike:elven-strike-step]`, `[hero-strike:illusionist-d20]`, `[hero-strike:acuteness]`, `[hero-strike:frenzy-second-swing]`, `[hero-strike:frenzy-dark-cap]` | 7 | OK, except **BUG → 72-05** (frenzy-second-swing/frenzy-dark-cap, known fix b) |
| 9 | combat.js#playerStrike Stealth crit (L721) | reuses strike roll | hero | `<= 2` | LOW | `[hero-crit:stealth]` | 8 | OK |
| 10 | combat.js#playerStrike Ninja crit (L731) | reuses strike roll | hero | `<= 2` | LOW | `[hero-crit:ninja]` | 9 | OK |
| 11 | combat.js#playerStrike weapon crit (L678-ish, `weaponCrit`) | reuses strike roll | hero | `roll <= weaponCrit(c)` unless `noCrit` | LOW | `[hero-crit:precise-blade]`, `[hero-crit:no-crit-sub]`, `[hero-crit:dark]` | — | OK (new site row split out of Phase31 #7 for clarity) |
| 12 | combat.js#killFoe loot drop (L871) | d20 | n/a (loot table gate) | `<= 2+f.lvl` | n/a (drop table) | `[drop:foe-level]` (foe level raises the chance — tougher foe, better odds) | 10 | OK / N/A |
| 13 | combat.js#killFoe bag-upgrade drop (L874) | d20 | n/a | `<= BAG_DROP_UNDER` | n/a | none (flat) | 11 | OK / N/A |
| 14 | combat.js#killFoe cooking (L884) | d6 | n/a | `>= 4` | n/a | none (flat) | — | OK / N/A (new since Phase 31) |
| 15 | combat.js#pursuitStrike (L934) | d(foeDie) | pursuing foe | `roll <= foeToHitVs(state)` then blind/Weaken/insulted | LOW | `[pursuit:blind]`, `[pursuit:weaken]`, `[pursuit:insult]`, `[pursuit:insult-after-blind]` | 12 | OK |
| 16 | combat.js#pursuitStrike Soldier crit-taken (L968) | reuses pursuer roll | n/a (victim-side) | `roll===1 \|\| (roll<=2 && Soldier)` | n/a | Soldier's own BAD trait widens the crit window against them | 13 | OK |
| 17 | combat.js#flee (L1068) | d20 | hero | `roll + bonus >= need` | YES (own subsystem) | `[flee:thief]`, `[flee:class-mod]`, `[flee:race-mod-elven]`, `[flee:race-mod-heavy]`, `[flee:armor-bulk]`, `[flee:flee-need-mod]`, `[flee:smoke]` | 14 | OK |
| 18 | combat.js#parley (L1226) | d20 | hero | `roll <= min(9+bonus,17) + PARLEY_NEED_MOD` | LOW | `[parley:con-artist]`, `[parley:woodsman]`, `[parley:wilmsry]`, `[parley:elven-humans]`, `[parley:fluency]`, `[parley:level]`, `[parley:top-foe-level]`, `[parley:ceiling]`, `[parley:parley-need-mod]` | 15 | OK, except **BUG → 72-07** (`[parley:parley-need-mod]`, Finding F5) |
| 19 | combat.js#parley Humans payout (L1238) | d6 | n/a | `=== 6` | n/a | none (flat) | — | OK / N/A (new since Phase 31) |
| 20 | combat.js#allyTurn summon strike (L1460) | d(STRIKE_DICE[lvl-1]) | summon | `<= 5` | LOW | `[ally-strike:ally-level-die]` | 16 | OK |
| 21 | combat.js#alliesTurn legacy strike (L1522) | d(STRIKE_DICE[lvl-1]) | legacy ally | `<= 5` | LOW | none (flat) | 17 | OK |
| 22 | combat.js#memberStrike (L1799) | d(strikeDie(view)) | party member | `roll <= memberToHit(view)` | LOW | `[member-strike:class-fighter]`, `[member-strike:elven]`, `[member-strike:acrobat]`, `[member-strike:cleric]`, `[member-strike:level-die]` | 18 | OK, except **F1 (needs ruling → user ruled FIX, applied by 72-07)**: member/legacy/summoned strikes skip the per-target rules `playerStrike` applies (dozing/stupid, `sp.toHit`, `sp.fast`, `sp.magicOnly`, Philly `slow`) |
| 23 | combat.js#allyCast thrown (L1884) | d8/d10 | member (MU) | `roll - bonus <= need` | LOW | `[ally-thrown:school-bonus]` | 19 | OK |
| 24 | combat.js#applyFoeDamageToPlayer armor soak (L2169) | d20 | hero (soak wanted) | `soak <= soakAr` | LOW (soak wanted) | `[hero-soak:armor-ar]`, `[hero-soak:cloak-of-armor]`, `[hero-soak:taunt]`, `[hero-soak:fighter-armor-mul]`, `[hero-soak:no-armor-foe]` | 20 | OK |
| 25 | combat.js#foeTurn ability gate (L2398) | d6 | n/a (AI gate) | `<= 4` | n/a | none | 21 | OK / N/A |
| 26 | combat.js#foeTurn member branch (L2428) | d(mDieN) | foe vs member | `roll <= foeToHitVs(state,"member")` then blind/Weaken/insulted/Sidestep/Smoke | LOW | `[foe-vs-member:battle-roar]`, `[foe-vs-member:member-sidestep]`, `[foe-vs-member:member-smoke]`, `[foe-vs-member:blind]`, `[foe-vs-member:weaken]`, `[foe-vs-member:insult]`, `[foe-vs-member:foe-accuracy]`, `[foe-vs-member:hero-only-terms]`, `[foe-vs-member:insult-after-member-smoke]` | 24 | OK, except **BUG → 72-04** (`[foe-vs-member:insult-after-member-smoke]`, known fix a) |
| 27 | combat.js#foeTurn member crit (L2428 area) | reuses mRoll | foe vs member | `mRoll === 1` | LOW | `[foe-crit-vs-member:natural-best]` | — | OK (new site row split out of #26) |
| 28 | combat.js#foeTurn hero branch (L2549) | d(dieN) | foe vs hero | `roll <= foeToHitVs(state)` then blind/Weaken/insulted | LOW | `[foe-vs-hero:elven]`, `[foe-vs-hero:acrobat]`, `[foe-vs-hero:guard]`, `[foe-vs-hero:gear-foe-to-hit]`, `[foe-vs-hero:foe-accuracy]`, `[foe-vs-hero:battle-roar]`, `[foe-vs-hero:party-battle-roar]`, `[foe-vs-hero:sidestep]`, `[foe-vs-hero:smoke]`, `[foe-vs-hero:mirror-self]`, `[foe-vs-hero:invisibility]`, `[foe-vs-hero:blind]`, `[foe-vs-hero:weaken]`, `[foe-vs-hero:insult]`, `[foe-vs-hero:insult-after-smoke]`, `[foe-vs-hero:insult-after-mirror]`, `[foe-vs-hero:insult-after-invisibility]`, `[foe-vs-hero:insult-after-blind]`, `[foe-vs-hero:dwarven-foe-strike-step]`, `[foe-vs-hero:foe-level-die]`, `[foe-vs-hero:thief-evasion]` | 22 | OK, except **BUG → 72-04** (`[foe-vs-hero:thief-evasion]`, known fix d) |
| 29 | combat.js#foeTurn Soldier crit-taken, hero variant (L2600) | reuses roll | foe vs hero | `roll===1 \|\| (roll<=2 && Soldier)` | n/a | `[foe-crit-vs-hero:soldier]` | 23 | OK |
| 30 | encounters.js#springTrap dodge (L71) | d20 | hero | `<= nimble` | LOW | `[trap:acrobat]`, `[trap:thief-trap-avoid]` | 25 | OK |
| 31 | encounters.js#openChest chest scroll (L148) | d6 | n/a | `>= 3` | n/a | none | — | OK / N/A (new since Phase 31) |
| 32 | encounters.js#openChest tiered (L131) | d10 | hero | `<= [0,5,7,8][tier] + intelBonus` | LOW | `[lock:locks-tier]`, `[lock:locks-tier-2]`, `[lock:lockpicks]`, `[lock:intel-bonus]`, `[lock:pilfer]` | 26 | OK |
| 33 | encounters.js#openChest bare (L136) | d20 | hero | `<= 8 + intelBonus` | LOW | `[lock:intel-bonus]` | 27 | OK |
| 34 | foeDamage.js natural-armor soak (L97) | d20 | foe (soak wanted) | `roll <= foe.sp.ar` | LOW (soak wanted) | `[foe-soak:natural-ar]`, `[foe-soak:crit-bypass]` | 28 | OK |
| 35 | magic.js#castSpell Apprentice backfire (L128) | d8 | hero (self-harm gate) | `=== 1` | n/a | none (flat sub gate) | — | OK / N/A (new since Phase 31) |
| 36 | magic.js#castSpell doubled backfire (L176) | d8 | hero (self-harm gate) | `=== 1` | n/a | none (flat) | — | OK / N/A (new since Phase 31) |
| 37 | magic.js#castSpell thrown (L506) | d8/d10 | hero | `roll - bonus <= target` | LOW | `[thrown:school-bonus]`, `[thrown:afraid]` | 29 | OK |
| 38 | magic.js#castSpell vapor roll (L310) | d6 | n/a (outcome table, kill-branch gate) | `=== 4` routes to the kill sub-check | n/a | none (flat; `c.level>=5` clamps to a guaranteed 4) | — | OK / N/A (new since Phase 31; classified per interfaces "classify it") |
| 39 | magic.js#castSpell vapor kill-save (L313) | d10 | foe (resists the kill) | survives on `!== 1` | n/a | none (flat) | — | OK / N/A (new since Phase 31; classified per interfaces "classify it") |
| 40 | movement.js climb (L270) | d10 | hero | `r <= tbl.success` | LOW | `[climb:heights]`, `[climb:hardiness-halving]`, `[climb:armor-bulk]` | 30 | OK |
| 41 | movement.js climb fall-per-segment (L273) | d20 | hero (avoids extra fall dmg) | `> 2` avoids the segment's fall damage | LOW | none (flat) | — | OK / N/A (new since Phase 31; classified per interfaces "classify it") |
| 42 | movement.js leap (L285) | d10 | hero | fail if `r > need` | LOW | `[leap:water]`, `[leap:armor-bulk]` | 31 | OK |
| 43 | movement.js affliction cure (L708) | d20 | hero | `<= 10 + (Hardiness?4:0)` | LOW | `[cure:hardiness]` | 32 | OK |
| 44 | movement.js wandering wake (L785, ×8/hour) | d20 | n/a (bad for hero) | `<= wakeOn` | n/a | `[wake:bard]`, `[wake:wander-rate]` | 33 | OK |
| 45 | movement.js d20===1 event (L950) | d20 | n/a | `=== 1` | n/a | none (flat; classified per interfaces "classify it" — a rare wandering/travel event gate) | — | OK / N/A (new since Phase 31) |
| 46 | derived.js#resistRoll (L1429) | d20 | resistor (hero or foe) | `roll < intel`, gated `intel>=12` | YES (resistor wants a LOW roll under intel — a roll-high-style "beat the stat" read) | `[resist:intel]`, `[resist:intel-gate]` | 34 | OK |
| 47 | items.js lockpick wear (L250) | d12 | n/a (item-loss gate) | `=== 1` (gated `!hasPicks`) | n/a | none (flat) | — | OK / N/A (new since Phase 31) |
| 48 | character.js#checkLevel Sorcerer spell-loss (L657) | d8 | n/a (chargen/level-up gate) | `=== 1` | n/a | none (flat) | — | OK / N/A (new since Phase 31; not a combat/dungeon check, included for CONTEXT's "every non-comment `rng.d(` call" completeness) |

**Site total: 48 rows (34 Phase 31 sites carried forward — one, Tracking, marked REMOVED; plus 15 new rows this audit's wider scope adds, split out for clarity or found beyond Phase 31's combat-only reach).** Every category CONTEXT names is covered: to-hit both ways (#8/#22/#26/#28), soak both ways (#24/#34), thrown spells (#23/#37), resistance (#46), initiative (#1), flee (#17), parley (#18), traps (#30), locks (#32/#33), climbs/leaps (#40/#42), cures (#43), wake (#44), drops (#12/#13), gates (#4/#5/#6/#25/#35/#36), summons (#20/#21) and crits (#9/#10/#11/#27/#29).

## Not-a-check draws (completeness appendix)

Every remaining non-comment `rng.d(` call, listed as `file#function — SELECTION (table/target pick)` or `AMOUNT (damage/heal/duration/count)`.

### SELECTION draws

- combat.js#startCombat foe count/tier (L247, L250) — table pick, foe count and tier-drop gate.
- combat.js#allyTurn/#sing lullaby target counts are AMOUNT (see below); Bard song table dispatch is a `song.lvl` branch, not an rng draw.
- combat.js#pickFoeTarget (L2008) — which live member is targeted.
- encounters.js#springTrap trap-kind pick (L80, `TRAPS[r-1]`).
- encounters.js#encounterDot table×table pick (L186 `t`, L187 `r`).
- encounters.js#newDay food pick (L357, `FOODS[rng.d(6)-1]`).
- encounters.js#findMisc misc-magic pick (L411), potion pick (L419), cloak pick (L430), jewelry pick (L437).
- encounters.js#meetFaerie gift-table pick (L449, `FAERIE[r-1]`).
- encounters.js#learnSpells spell-level table pick (L532).
- encounters.js#catchAffliction affliction-kind pick (L633), phobia pick (L637, and the second catchAffliction-family phobia pick at L678).
- encounters.js#goInsane insanity-table pick (L657).
- magic.js#castSpell insane outcome-table pick (L423, `r` 1-6 dispatch).
- items.js#pickLootTool-adjacent category pick (L260, `r<=3/5/7/9` blade/mail/jewel/cloak/staff dispatch), jewelry pick (L132), cloak pick (L140), staff pick (L144), weapon-bonus table pick (L155, feeds an AMOUNT via `rollDice`), armor-bonus table pick (L168).
- movement.js climb-height pick (L265, 20 or 30 ft), leap-table pick (L281), wandering direction picks (L839, L840).
- character.js#rollCharacter class pick (L490), sub pick (L492), race pick (L494), the Fridgian-Samurai reroll's sub pick (L505), phobia pick (L534), temperament pick (L542), motive pick (L543), starting cloak pick (L559, Thief only), name-combo pick (L441, `nameFor` — a single draw over `first×sur` combos, an intentional cosmetic-only divergence from the frozen prototype's flat pool, carved out of chargen parity).
- character.js#checkLevel Apprentice sub-reroll pick (L647).
- economy.js#rollMagicItem premium-kind pick (L411, blade vs mail).

### AMOUNT draws

- combat.js#killFoe kill-XP roll (L832, `killSpFor`'s shared input), coin amount (L861), Humans wilmst payout amount (L1240).
- combat.js#sing Bard lullaby target count (L1304) and rounds (L1310, L1311).
- combat.js#allyTurn summon damage add (L1462), heal amount (L1712), heal roll (L1718).
- combat.js#alliesTurn legacy summon damage add (L1524).
- combat.js#useAbility rounds (L1916) and asleep amount (L1924).
- combat.js#foeTurn regen amount (L2295), member-branch damage fallback (L2505), hero-branch damage fallback (L2601).
- combat.js#pursuitStrike pursuer damage fallback (L969).
- encounters.js#openChest gold amount (L147); #newDay learnable-spell count (L377); #meetFaerie base-HP boon (L457) and bane (L462), gold amount (L476); #learnSpells wp amount (L534) and discarded-max amount (L536); #catchAffliction affliction duration (L643); #goInsane self-harm/ally-damage add (in `magic.js#castSpell` insane branch — see below), (encounters.js `might` roll L668).
- magic.js#castSpell: backfire damage add (L177), effect rounds (L192, ×2 branches), spell-damage multiplier draw (L207), sleep duration (L210), rounds (L227), shrink target count (L252), acid rounds (L263), ice-dot duration (L279), vapor sleep duration (L317), volley bolt count (L321), gate target count (L363), Mirror Self rounds (L402), insane ally-damage add (L431), insane sleep duration (L445), Weaken-family sleep duration (L475), spell-boon amount (L567).
- movement.js climb fall damage (L288, ×2), camp heal amount (L687), newday tier amounts (L737, L742), travel distance (L844).
- items.js gift amount (L115, ×3 combined into one formula), tool-charge amount (L1355), item-heal amount (L1405), fire-bolt count (L1480), fire-bolt damage (L1488).
- character.js grimoire starting-spell count (L325), intel stat roll (L507), starting potion count (L547).
- abilities.js Overhead-Blow-family amount (L228) and heal (L234).
- dice.js#rollDice — the shared n-dice-summing primitive every other AMOUNT above ultimately composes with (L18).
- economy.js#rollMagicItem premium-select gate reused as part of the pick above (no separate AMOUNT draw beyond the pick itself).
- foeAbilities.js foe-effect rounds (L209).
- foeDamage.js — no AMOUNT draws (its one draw is CHECK site #34 above).
- maze.js water-pool size (L342).

### Per-file count table

| File | CHECK draws | SELECTION | AMOUNT | Total |
|---|---|---|---|---|
| engine/abilities.js | 0 | 0 | 2 | 2 |
| engine/character.js | 1 | 10 | 3 | 14 |
| engine/combat.js | 23 | 4 | 17 | 44 |
| engine/derived.js | 1 | 0 | 0 | 1 |
| engine/dice.js | 0 | 0 | 1 | 1 |
| engine/economy.js | 0 | 1 | 0 | 1 |
| engine/encounters.js | 4 | 14 | 9 | 27 |
| engine/foeAbilities.js | 0 | 0 | 1 | 1 |
| engine/foeDamage.js | 1 | 0 | 0 | 1 |
| engine/items.js | 1 | 6 | 7 | 14 |
| engine/magic.js | 5 | 1 | 17 | 23 |
| engine/maze.js | 0 | 0 | 1 | 1 |
| engine/movement.js | 6 | 4 | 7 | 17 |
| **Total** | **42** | **40** | **65** | **147** |

Live-count reconciliation: `for f in engine/*.js; do n=$(grep -v '^\s*//\|^\s*\*' "$f" | grep -o 'rng\.d(' | wc -l); [ "$n" -gt 0 ] && echo "$f $n"; done` at commit `9197002` produces exactly these 13 files with these totals (verified during this task). The 42 CHECK draws above map onto the 42 CHECK-site rows in `## Site inventory` above minus double-counted paired draws recorded as one row (initiative's two d20s, Philly's second strike die, the vapor roll+save pair) — see each site row's die column for how many draws it consumes.

## Modifier ledger

_(Filled by Task 2 of this plan.)_

## Known fixes (a)–(d)

_(Filled by Task 2 of this plan.)_

## New findings

_(Filled by Task 2 of this plan.)_

## Rulings

_(Filled by Task 3 of this plan.)_

## Skeleton shatter scope

_(Filled by Task 2 of this plan.)_

## Handoffs → Phase 74 (display signs)

_(Filled by Task 2 of this plan.)_

## Handoffs → Phase 79 (roll-direction phrasing)

_(Filled by Task 2 of this plan.)_

## Bot readout

_(Filled by Task 2 of this plan.)_

