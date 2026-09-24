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

One row per modifier source per site, keyed by the `[site:source]` id the 72-02/72-03 direction tests use (the ledger and the tests share ids so `test/unit/roll-ledger-sync.test.js`, built in 72-07, can guard them). Columns: `Id | Site | Source | Kind | Claimed direction (quote + file:line) | Verified today | Phase 73 reading | Verdict`.

### Hero to-hit (`engine/combat.js#playerStrike`, `engine/derived.js#toHit`)

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[hero-strike:class-fighter]` | hero-strike | class base need | class | Fighter `toHit:5` (best) vs Magic User `toHit:3` (worst), `content/classes.js`; "three swings in four hit nothing" (Fighter) / "six swings in seven are decorative" (MU), `content/flavor.js` | Fighter's higher base need widens the hit range vs an MU of the same race | Fighter hits on more of the top face-values than an MU | OK |
| `[hero-strike:elven]` | hero-strike | race `toHit:5` override | race | "hits on 5 whatever the class," `content/races.js:22` | Elven MU's need is raised to 5, matching a Fighter's base, widening the range vs a Human MU | Elven MU hits on more top faces than a Human MU | OK |
| `[hero-strike:acrobat]` | hero-strike | sub `toHit` override | sub-class | Acrobat's `Math.max` override raises the need over a plain Thief sub | widens the hit range | more top faces succeed | OK |
| `[hero-strike:cleric]` | hero-strike | sub `toHit` override | sub-class | Cleric's `Math.max` override raises the need over a plain MU sub | widens the hit range | more top faces succeed | OK |
| `[hero-strike:inspired]` | hero-strike | Bard song `C.inspired` | ability | a Bard's song raises the singer's `toHit` in the light | widens the hit range in the light; the dark cap absorbs it (`Math.min(h,2)`) so it never worsens odds in the dark | more top faces succeed in the light; unchanged in the dark | OK, dark case `OK (clamp)` |
| `[hero-strike:weapon-light]` | hero-strike | `weaponNeedMod` (light weapon, `need:+1`) | weapon | a light/fast weapon's `+1` need, `content/weapons.js` | raises the need, widens the hit range | more top faces succeed | OK |
| `[hero-strike:weapon-heavy]` | hero-strike | `weaponNeedMod` (heavy weapon, `need:-1/-2`) | weapon | "−2 to hit" on the device (the phase trigger); heavy weapons narrow the range, `content/weapons.js` | lowers the need, narrows the hit range | fewer top faces succeed | OK — **the confirmed device-trigger case; see `## The device trigger`** |
| `[hero-strike:dazed]` | hero-strike | `dazed` condition, `-2` | condition | dazed narrows the hero's odds | lowers the need | fewer top faces succeed | OK |
| `[hero-strike:dark-cap]` | hero-strike | dark-tile cap, `Math.min(h,2)` | terrain | fighting blind in the dark is worse | caps the need at 2 regardless of class, narrowing a Fighter's odds sharply | at most the bottom 2 faces succeed | OK |
| `[hero-strike:night-vision]` | hero-strike | Night Vision skill (waives the dark cap) | skill | Night Vision lets you fight in the dark as if lit | removes the cap, restoring full-need odds | full range restored | OK |
| `[hero-strike:senses]` | hero-strike | `c.senses` (waives the dark cap) | ability | same relief as Night Vision, granted by an item/effect | removes the cap | full range restored | OK |
| `[hero-strike:dozing]` | hero-strike | `t.asleep` (dozing foe), `Math.max(need,5)` | condition (target) | a sleeping target is easier to hit | raises the need to at least 5 for a class below it (e.g. MU); a Fighter (already ≥5) is unaffected | more faces succeed for a low-need class; unchanged for a Fighter | OK, Fighter case `OK (clamp)` |
| `[hero-strike:stupid]` | hero-strike | `t.stupid` (same clamp as dozing) | condition (target) | same as dozing | same as dozing | same as dozing | OK, Fighter case `OK (clamp)` |
| `[hero-strike:hard-to-hit]` | hero-strike | `t.sp.toHit` (e.g. Zit "hittable only on a 4") | foe-trait | the bestiary note states the exact cap | `Math.min(need, t.sp.toHit)` caps the need down, narrowing a Fighter's odds; an MU already below the cap is unaffected | fewer top faces succeed for a Fighter; unchanged for an MU already under the cap | OK, MU case `OK (clamp)` |
| `[hero-strike:fast]` | hero-strike | `t.sp.fast` (e.g. Pogo), `Math.max(1,need-1)` | foe-trait | a fast foe is harder to land a blow on | lowers the need by 1, floored at 1 | one fewer top face succeeds, never below the single best face | OK |
| `[hero-strike:magic-only]` | hero-strike | `t.sp.magicOnly` (e.g. Ghost) | foe-trait | "only magic touches it" | need forced to 0 (untouchable) without a magic weapon; restored with one (`c.magicWpn`) | zero faces succeed without a magic weapon; normal range with one | OK |
| `[hero-strike:overhead-blow]` | hero-strike | Overhead Blow ability, `AS.needShift` | ability | a heavy telegraphed swing trades accuracy for damage | narrows the need | fewer top faces succeed | OK |
| `[hero-strike:afraid]` | hero-strike | `C.afraid`, `afraidNeed` (last modifier, `-3`) | condition | a frightened hero swings worse | lowers the need by 3 (floored) | fewer top faces succeed | OK |
| `[hero-strike:afraid-vs-untouchable]` | hero-strike | `magicOnly` + `afraid` | foe-trait + condition | Afraid "never revives an untouchable" target | a need-0 (magicOnly, no magic weapon) target stays at need 0 under Afraid — the floor never lifts a 0 to 1 | zero faces, unchanged | OK (clamp) |
| `[hero-strike:floor-clamp]` | hero-strike | Overhead Blow + Afraid stacked | ability + condition | stacked penalties never erase a touchable target's last face | the floor keeps need ≥ 1 while the target is touchable | at least the single best face still succeeds | OK (clamp) |
| `[hero-strike:philly-slow]` | hero-strike | Philly `sp.slow` (keep the lower of two dice) | foe-trait | a Philly is slow to react, so the hero's second die helps | `Math.min(roll, rng.d(dieN))` — a second draw can only IMPROVE (lower) the effective strike-die roll | strictly better odds over one draw (the joint-odds view) | OK |
| `[hero-strike:auto-hit]` | hero-strike | Cat Burglar/Ninja opener, `subAuto` | sub-class | an opening backstab always connects | bypasses the to-hit comparison entirely on the first strike (`C.opened` false) | every face succeeds | OK |
| `[hero-strike:level-die]` | hero-strike | level-based `strikeDie` shrink | class | a higher-level hero swings a smaller (better) die | `STRIKE_DICE` shrinks with level | fewer total faces, same or more succeed proportionally | OK |
| `[hero-strike:elven-strike-step]` | hero-strike | Elven `strikeStep` | race | Elven swings a die better | shrinks the strike die one step early | smaller die, better proportion | OK |
| `[hero-strike:illusionist-d20]` | hero-strike | Illusionist d20-until-level-3 | sub-class | an Illusionist is a weaker fighter early | keeps the strike die at d20 (worse) until level 3 | worst die of any class at low level | OK |
| `[hero-strike:acuteness]` | hero-strike | Potion of Acuteness effect | item | the potion sharpens the swing | a live effect improves the strike die/need | better odds while active | OK |
| `[hero-strike:frenzy-second-swing]` | hero-strike | Fridgian frenzy, second swing | race | frenzy's second swing is a declared canon divergence (CONTEXT (b)): the normal to-hit narrowed by one face, never a hard-set need 3 | **today** the code hard-sets `need = a===1 && R.frenzy ? 3 : toHit(state)` regardless of whether the actual frenzy swing fired, so a fighter's frenzy swing WORSENS (5→3) instead of narrowing by exactly one (5→4), and a non-frenzy second attack (Barbarian/haste/Ambidextrous/Last Stand) wrongly gets frenzy odds too (Finding F4) | wrong today; after the fix, one fewer top face than the normal swing, floored at the single best face | **BUG → 72-05** (known fix b, F4 ruled fix, same edit) |
| `[hero-strike:frenzy-dark-cap]` | hero-strike | frenzy second swing + dark cap | race + terrain | the narrowed swing still respects the dark cap | today's hard-set need 3 can accidentally read HIGHER than a dark-capped normal swing (need 2) for some classes, contradicting "never above the normal capped odds" | after the fix, the narrowed swing's odds sit at or below the dark-capped normal swing | **BUG → 72-05** |

### Hero crit

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[hero-crit:precise-blade]` | hero-crit | `weaponCrit` (crit:2 vs crit:1) | weapon | a precision weapon crits more often | `roll <= weaponCrit(c)` — crit:2 covers two faces instead of one | two top faces crit instead of one | OK |
| `[hero-crit:no-crit-sub]` | hero-crit | Guard/Soldier `noCritFor` | sub-class | Guard/Soldier never land a crit (a documented BAD trait) | crit forced to zero faces | never crits | OK |
| `[hero-crit:dark]` | hero-crit | dark without Night Vision/`senses` | terrain | you can't line up a precise blow you can't see | crit forced to zero faces in the dark unless waived | never crits in the dark without the waiver | OK |
| `[hero-crit:stealth]` | hero-crit | Stealth opener, `roll<=2` | skill | an unseen opening blow lands harder | widens the crit window to two faces | two top faces crit | OK |
| `[hero-crit:ninja]` | hero-crit | Ninja non-opening strike, `roll<=2` | sub-class | a Ninja crits more often even outside an opener | widens the crit window to two faces | two top faces crit | OK |

### Foe vs hero (`engine/derived.js#foeToHitVs`, `engine/combat.js#foeTurn` hero branch)

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[foe-vs-hero:elven]` | foe-vs-hero | race `foeToHit:+1` | race | "thin-boned and easy to hit," `content/races.js` | `+1` to the foe's need, a bonus to the foe (bad for the hero) | foe finds an Elven hero on one more top face | OK (deliberate, Phase 31 — fixes 31-ROLL-DIRECTION-AUDIT.md Finding 1's inherited `-1`) |
| `[foe-vs-hero:acrobat]` | foe-vs-hero | Acrobat override | sub-class | an Acrobat is hard to pin down | lowers the foe's need (penalty to the foe) | foe finds an Acrobat on fewer top faces | OK |
| `[foe-vs-hero:guard]` | foe-vs-hero | Guard `-1` | sub-class | Guard is defensively sound (identity-contract GOOD entry) | lowers the foe's need | one fewer top face for the foe | OK |
| `[foe-vs-hero:gear-foe-to-hit]` | foe-vs-hero | Anklet of Invisibility, `foeToHit:-2` | item | "foes need two better to land" | lowers the foe's need by 2 | two fewer top faces for the foe | OK |
| `[foe-vs-hero:foe-accuracy]` | foe-vs-hero | `FOE_ACCURACY` dial | dial | identity 0 is a structural no-op; a positive value should sharpen every foe | at identity, no change; with a positive tuning override, raises the foe's need (bonus to the foe) | identity: unchanged; tuned: foe finds the hero on more top faces | OK (identity no-op, direction confirmed under a tuning probe) |
| `[foe-vs-hero:battle-roar]` | foe-vs-hero | hero's own Battle Roar, `-2` | ability | Battle Roar cows nearby foes | lowers the foe's need | fewer top faces for the foe | OK |
| `[foe-vs-hero:party-battle-roar]` | foe-vs-hero | a member's Battle Roar, party-wide | ability | the roar covers the whole party | lowers the foe's need against the hero too | fewer top faces for the foe | OK |
| `[foe-vs-hero:sidestep]` | foe-vs-hero | Sidestep, `-2` (hero-only inside `foeToHitVs`) | ability | a dodge maneuver | lowers the foe's need | fewer top faces for the foe | OK |
| `[foe-vs-hero:smoke]` | foe-vs-hero | Smoke override to 1 | ability | "foes need a natural 1 to find you" | overrides the foe's need to the single best face | the foe finds the hero only on the best face | OK |
| `[foe-vs-hero:mirror-self]` | foe-vs-hero | Mirror Self override to 1 | spell | duplicates confuse the foe's aim | same override as Smoke | same as Smoke | OK |
| `[foe-vs-hero:invisibility]` | foe-vs-hero | an invis item effect, override to 1 | item | can't hit what you can't see | same override | same as Smoke | OK |
| `[foe-vs-hero:blind]` | foe-vs-hero | `f.blind` flag, override to 1 | condition (foe) | a blinded foe swings almost at random | same override | same as Smoke | OK |
| `[foe-vs-hero:weaken]` | foe-vs-hero | Weaken spell, `C.foeToHitPenalty=3` | spell | "they need a 3 to hit" | caps the foe's need at 3 via `Math.min` | the foe finds the hero on at most its bottom 3 faces | OK |
| `[foe-vs-hero:insult]` | foe-vs-hero | a failed parley, `parleyInsulted`, `+1` | condition (player action) | an insulted foe tries harder | raises the foe's need by exactly one face | one more top face for the foe | OK |
| `[foe-vs-hero:insult-after-smoke]` | foe-vs-hero | Smoke + insulted, ORDER-DEPENDENT | ability + condition | CONTEXT (a): the insult stacks on TOP of the override, applied LAST — need 1→2, "19–20 on a d20 after Phase 73" | the hero branch already applies overrides then insulted-last: `foeToHitVs` overrides → blind → penalty → insulted (`engine/combat.js` ~L2549-2564) | exactly two faces (19–20 on a d20) find a smoked-and-insulted hero | OK — **the hero branch is the reference implementation `[foe-vs-member:insult-after-member-smoke]` must match** |
| `[foe-vs-hero:insult-after-mirror]` | foe-vs-hero | Mirror Self + insulted | spell + condition | same ordering claim as Smoke | same order, same result | exactly two faces | OK |
| `[foe-vs-hero:insult-after-invisibility]` | foe-vs-hero | invisibility + insulted | item + condition | same ordering claim | same order, same result | exactly two faces | OK |
| `[foe-vs-hero:insult-after-blind]` | foe-vs-hero | blind + insulted | condition + condition | same ordering claim | same order, same result | exactly two faces | OK |
| `[foe-vs-hero:dwarven-foe-strike-step]` | foe-vs-hero | Dwarven `foeStrikeStep` | race | "foes strike at a better die" against a Dwarf | shrinks the foe's die one step early | smaller die, foe's proportional odds rise | OK |
| `[foe-vs-hero:foe-level-die]` | foe-vs-hero | `foeDie` level scaling | foe-trait | a tougher foe swings a better (smaller) die, floored at d8 | `max(d8, level die + step)` | smaller die for a higher-tier foe, floored | OK |
| `[foe-vs-hero:thief-evasion]` | foe-vs-hero | `classEvasionFor` (Thief), `engine/difficulty.js` | dial | JSDoc/dial intent: a positive evasion value should make Thieves HARDER to hit | **today `classEvasionFor` is ADDED into the foe's need** (`h += classEvasionFor(c)` at `engine/derived.js:1229`), so a positive value makes the foe's need RISE — easier for the foe to hit a Thief, the opposite of "evasion." At identity (0) nothing moves | wrong today (a positive dial value is a bonus TO THE FOE, not a penalty); after the fix, a positive evasion subtracts from the foe's need | **BUG → 72-04** (known fix d) |

### Foe crit vs hero

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[foe-crit-vs-hero:soldier]` | foe-crit-vs-hero | Soldier's widened crit-taken window | sub-class | a documented BAD trait — Soldier is easier to crit | `roll===1 \|\| (roll<=2 && Soldier)` widens the foe's crit window to two faces against a Soldier | the foe crits a Soldier on two top faces instead of one | OK |

### Foe vs member (`engine/derived.js#foeToHitVs(state,"member")`, `engine/combat.js#foeTurn` member branch)

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[foe-vs-member:battle-roar]` | foe-vs-member | the member's own or the hero's Battle Roar (party-wide) | ability | same claim as the hero-side row | lowers the foe's need against the member | fewer top faces for the foe | OK |
| `[foe-vs-member:member-sidestep]` | foe-vs-member | the member's own Sidestep | ability | same claim as the hero-side row | lowers the foe's need, but APPLIED AFTER the Weaken cap on the member branch (see Finding O2, out of scope) | fewer top faces, order caveat recorded under O2 | OK (order caveat: `## New findings` O2) |
| `[foe-vs-member:member-smoke]` | foe-vs-member | the member's own Smoke | ability | override to the single best face | same override as the hero branch | one face | OK |
| `[foe-vs-member:blind]` | foe-vs-member | `f.blind` | condition (foe) | same claim as the hero-side row | same override | one face | OK |
| `[foe-vs-member:weaken]` | foe-vs-member | Weaken vs a member | spell | "they need a 3 to hit" | same cap as the hero-side row | at most the bottom 3 faces | OK |
| `[foe-vs-member:insult]` | foe-vs-member | failed parley vs a member target | condition (player action) | same claim as the hero-side row | raises the foe's need by one face | one more top face | OK |
| `[foe-vs-member:foe-accuracy]` | foe-vs-member | `FOE_ACCURACY` dial vs a member | dial | same claim as the hero-side row | identity no-op; tuned value raises the foe's need | identity unchanged; tuned: one more top face | OK |
| `[foe-vs-member:hero-only-terms]` | foe-vs-member | the hero's OWN Sidestep/Smoke timer | ability | `foeToHitVs`'s `vs` parameter scopes hero-only terms away from member rolls | the hero's personal timers leave the member's odds unchanged | unchanged | OK (scope, by design) |
| `[foe-vs-member:insult-after-member-smoke]` | foe-vs-member | member Smoke + insulted, ORDER-DEPENDENT | ability + condition | CONTEXT (a): the insult must apply LAST here too, matching the hero branch — need 1→2 | **today the member branch (`engine/combat.js` ~L2436-2466) applies insulted BEFORE the member's own Sidestep/Smoke**, so a member's own Smoke resets the need back to 1 and SWALLOWS the insult entirely | wrong today (insulted has no effect on a smoked member); after the fix, exactly two faces, matching `[foe-vs-hero:insult-after-smoke]` | **BUG → 72-04** (known fix a) |
| `[foe-crit-vs-member:natural-best]` | foe-crit-vs-member | member crit window | condition | a landed swing on a member can crit on the die's best face, same as the hero | `mRoll === 1` | one top face | OK |

### Pursuit (`engine/combat.js#pursuitStrike`, inside `#flee`)

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[pursuit:blind]` | pursuit | `f.blind` on the pursuer | condition (foe) | same claim as foe-vs-hero blind | override to one face | one face | OK |
| `[pursuit:weaken]` | pursuit | Weaken on the pursuer | spell | "they need a 3 to hit" | caps the need at 3 | at most the bottom 3 faces | OK |
| `[pursuit:insult]` | pursuit | failed parley, insulted pursuer | condition | same claim as foe-vs-hero insult | raises the need by one face | one more top face | OK |
| `[pursuit:insult-after-blind]` | pursuit | blind + insulted, ORDER-DEPENDENT | condition + condition | same ordering claim, mirrored in `pursuitStrike`'s own chain (`blind→1`, then `insulted: need+1`, same shape as the hero/member branches) | insulted applied after the override, exactly two faces | exactly two faces | OK |

### Member and ally strikes

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[member-strike:class-fighter]` | member-strike | class base need (`memberToHit`) | class | same claim as hero-strike class-fighter, member mirror | Fighter member's higher need widens the hit range vs an MU member | more top faces succeed | OK |
| `[member-strike:elven]` | member-strike | race `toHit` override | race | same claim as hero-strike elven | widens the range | more top faces succeed | OK |
| `[member-strike:acrobat]` | member-strike | sub override | sub-class | same claim as hero-strike acrobat | widens the range | more top faces succeed | OK |
| `[member-strike:cleric]` | member-strike | sub override | sub-class | same claim as hero-strike cleric | widens the range | more top faces succeed | OK |
| `[member-strike:level-die]` | member-strike | level-based strike-die shrink | class | same claim as hero-strike level-die | smaller die at a higher level | better proportional odds | OK |
| `[member-strike:per-target-rules]` | member-strike | dozing/`sp.toHit`/`sp.fast`/`sp.magicOnly`/Philly `slow` | condition/foe-trait (member roller) | `playerStrike`'s full per-target chain is a stated rule for "anyone" landing a blow, per the bestiary notes' plain wording, not "the hero specifically" | **today `memberStrike`, the legacy `alliesTurn` strike and `allyTurn`'s summon strike apply NONE of these per-target terms** — a member swings at a dozing/stupid foe, a `sp.toHit`-capped foe, a `fast` foe or a `magicOnly` foe (Ghost/Spectre) exactly as if the target were plain, which silently swings party balance against exactly the foes these rules exist to gate | wrong today; after the fix, a member/ally needs the same per-target adjustment the hero gets | **FINDING F1 → NEEDS RULING → user ruled FIX, applied by 72-07** (local, in `memberStrike`/legacy `alliesTurn`/`allyTurn`; a `--gaps` follow-up if it proves non-local) |
| `[ally-strike:ally-level-die]` | ally-strike | summon `C.ally.lvl` strike-die scaling | ability (summon) | a higher-level summon swings a better die | `STRIKE_DICE[lvl-1]` shrinks with level | smaller die, non-worsening at minimum | OK |

### Skeleton shatter, thrown-spell variants (known fix c)

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[shatter:hero-strike]` | shatter | Skeleton `sp.critOn:1` ("a 1 shatters it") | foe-trait | rolling the die's best face shatters the Skeleton outright, both lives, on any LANDED hero strike | **today `critOn:1` only feeds the ordinary crit-damage-multiplier path** (`roll===1` doubles/triples damage, the same as every other `critOn:1` foe) — it does NOT shatter, kill both lives, or do anything the Skeleton's own note promises beyond a normal crit | wrong today (no shatter exists); after 72-06 wires `shatterOnBest`, a best-face landed strike shatters it in one call | **BUG → 72-06** (known fix c) |
| `[shatter:member-strike]` | shatter | same, via `memberStrike` | foe-trait | "your dice" (CONTEXT's Claude's Discretion) covers party-member strikes too | same gap as above | same fix | **BUG → 72-06** |
| `[shatter:ally-strike]` | shatter | same, via `allyTurn`/legacy `alliesTurn` | foe-trait | summoned and legacy ally strikes count as "your dice" | same gap | same fix | **BUG → 72-06** |
| `[shatter:thrown]` | shatter | same, via the hero's `castSpell` thrown attack | foe-trait | a thrown attack spell that lands is still a to-hit die drawn against the Skeleton | same gap | same fix | **BUG → 72-06** |
| `[shatter:ally-thrown]` | shatter | same, via `allyCast` | foe-trait | a member's thrown attack spell counts too | same gap | same fix | **BUG → 72-06** |

### Hero soak / foe soak

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[hero-soak:armor-ar]` | hero-soak | `ARMORS` row `ar` | armor | a higher-AR armor soaks more often | raises `soakAr`, widening the soak range | more top faces soak | OK |
| `[hero-soak:cloak-of-armor]` | hero-soak | Cloak of Armor, take-the-better | item | the cloak improves soak over a light armor | raises effective `ar` when it beats the worn armor | more top faces soak | OK |
| `[hero-soak:taunt]` | hero-soak | Taunt, double soak (capped at the die ceiling) | ability | "your armour soaks double" | doubles `soakAr`, capped so it never exceeds the die's max face | more top faces soak, capped, never worse | OK |
| `[hero-soak:fighter-armor-mul]` | hero-soak | `CLASS_MITIGATION.Fighter.armorMul` | dial | identity 1 is a no-op; a value above 1 should help a Fighter's soak specifically | at identity, unchanged; a value above 1 raises a Fighter's `soakAr`, not a non-Fighter's | identity unchanged; tuned: more top faces soak for a Fighter only | OK |
| `[hero-soak:no-armor-foe]` | hero-soak | a `noArmor`-ignoring foe (e.g. Flube, Poltergeist) | foe-trait | some foes bypass armor entirely | the soak d20 is never drawn against a `noArmor`-ignoring foe's blow | no soak roll requested; damage always lands | OK |
| `[foe-soak:natural-ar]` | foe-soak | bestiary `sp.ar` | foe-trait | a naturally-armored foe (Google, Krupke, Drat, Craig, Herman) soaks the hero's blow | `roll <= foe.sp.ar`, a higher `sp.ar` widens the foe's soak range | more top faces soak for the foe | OK |
| `[foe-soak:crit-bypass]` | foe-soak | a hero crit | condition | a crit punches through armor | the soak draw is never requested on a crit | no soak roll on a crit; the blow always lands | OK |

### Thrown spells

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[thrown:school-bonus]` | thrown | `content/mu-chart.js` offense-school bonus | sub-class | an offense-leaning sub (Warlock, Sorcerer, Wizard) throws better | `roll - bonus <= target`, a higher bonus subtracts more from the roll, easier hit | wider effective hit range for an offense-leaning sub | OK |
| `[thrown:afraid]` | thrown | `C.afraid` | condition | fear pulls the throw | `afraidDamage`/`afraidNeed` narrows the effective target | narrower range while afraid | OK |
| `[ally-thrown:school-bonus]` | ally-thrown | same, via `allyCast` for a member MU | sub-class | same claim as the hero row | same mechanism, mirrored for a member | wider range for an offense-leaning member sub | OK |

### Resistance and initiative

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[resist:intel]` | resist | `intel` stat | stat | a smarter resistor shrugs off more effects, p.25 canon | `resisted = roll < intel`; a higher intel widens the resisting range | wider resist range for a higher-intel character | OK |
| `[resist:intel-gate]` | resist | `intel >= 12` gate | stat | below the threshold, resistance is never rolled for | no draw at all below the gate | no resist attempt below intel 12 | OK |
| `[initiative:samurai]` | initiative | Samurai forced-foe | sub-class | Samurai never gets the jump on a fight's first round (a documented BAD trait) | forces `first="foe"` | the foe always acts first | OK |
| `[initiative:fridgian-slow]` | initiative | Fridgian `slow` forced-foe | race | Fridgians are slow to react | forces `first="foe"` | the foe always acts first | OK |
| `[initiative:knight-big-foe]` | initiative | Knight vs a big foe, forced-foe | sub-class | a Knight is cautious against a large foe | forces `first="foe"` | the foe always acts first | OK |
| `[initiative:court-mage]` | initiative | Court Mage round 1, forced-foe | sub-class | a Court Mage is caught off guard in the opening round | forces `first="foe"` (round 1 only) | the foe always acts first in round 1 | OK |
| `[initiative:foresight]` | initiative | `c.foresight` (a cast Foresee spell) | spell | knowing what's coming means acting first | forces `first="you"` | the hero always acts first | OK |
| `[initiative:acute-hearing]` | initiative | Acute Hearing, "never surprised" | skill | never caught flat-footed | forces `first="you"` | the hero always acts first | OK |
| `[initiative:senses]` | initiative | `c.senses` (waives a forced-foe result) | ability | keen senses overcome even a forced-foe scenario | waives the forced-foe override, restoring the normal roll | the roll is contested normally instead of a guaranteed foe-first | OK |

### Flee, parley

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[flee:thief]` | flee | `FLEE_THIEF_BONUS`, `+5` | sub-class | "getting out is the Thief's whole trade" | added to the roll, easier to clear the flee threshold | wider success range | OK |
| `[flee:class-mod]` | flee | `FLEE_CLASS_MOD` (MU `-1`) | class | a Magic User is slower afoot than a Fighter | subtracted from the roll, narrower | narrower success range for an MU | OK |
| `[flee:race-mod-elven]` | flee | `FLEE_RACE_MOD` (Elven `+1`) | race | Elves flee well | added to the roll, wider | wider success range | OK |
| `[flee:race-mod-heavy]` | flee | `FLEE_RACE_MOD` (Dwarven/Fridgian/Troll `-1`) | race | the heavier races flee poorly | subtracted from the roll, narrower | narrower success range | OK |
| `[flee:armor-bulk]` | flee | armor bulk penalty | armor | bulky armor slows a retreat | subtracted from the roll, narrower | narrower success range in bulky armor | OK |
| `[flee:flee-need-mod]` | flee | `FLEE_NEED_MOD` dial | dial | identity 0 is a no-op; "up = harder" per the dial table | at identity unchanged; a positive value is ADDED TO THE NEED (not the roll), narrowing the success range — correctly matching "up = harder" | identity unchanged; tuned: narrower range at a positive value | OK |
| `[flee:smoke]` | flee | a live Smoke effect | ability | Smoke guarantees an escape | flee succeeds automatically with no draw | always succeeds, no roll | OK |
| `[parley:con-artist]` | parley | Con Artist bonus, `+4` | sub-class | a Con Artist talks its way out of anything | raises the need ceiling (capped at 17), wider success range | wider range | OK |
| `[parley:woodsman]` | parley | Woodsman bonus vs Beasts, `+3` | sub-class | a Woodsman reasons with animals | raises the need, wider | wider range vs Beasts | OK |
| `[parley:wilmsry]` | parley | Wilmsry bonus, `+4` | race | Wilmsry are natural negotiators | raises the need, wider | wider range | OK |
| `[parley:elven-humans]` | parley | Elven-vs-Humans bonus, `+3` | race | Elves and Humans get along | raises the need, wider vs Humans | wider range vs Humans | OK |
| `[parley:fluency]` | parley | Helm of Knowledge fluency, `2×fluency` | item | the helm helps you talk, and opens TALKATIVE foe types | raises the need, wider; also expands `canParley`'s eligible types | wider range, more eligible foes | OK |
| `[parley:level]` | parley | `+level` | stat | experience helps negotiation | raises the need with level, wider | wider range at higher level | OK |
| `[parley:top-foe-level]` | parley | `-topFoeLvl` | foe-trait | a tougher room is harder to talk down | lowers the need, narrower vs stronger foes | narrower range vs a higher-tier foe | OK |
| `[parley:ceiling]` | parley | `min(9+bonus,17)` cap | dial/clamp | a maximal stack never guarantees success | the ceiling caps the need at 17 regardless of how high the bonus stack climbs; one more bonus term beyond the cap never worsens | never below the pre-cap odds, never exceeds the cap | OK (clamp) |
| `[parley:parley-need-mod]` | parley | `PARLEY_NEED_MOD` dial, `parleyNeedModFor` | dial | JSDoc and `docs/DIFFICULTY-RETUNE.md`'s dial table both document "up = harder" | **today the value is ADDED into a roll-under need** (`need = min(9+bonus,17) + PARLEY_NEED_MOD`), so a POSITIVE value makes the need bigger — WIDER, i.e. EASIER — the exact opposite of the documented "up = harder." Identity 0 means no fixture moves | wrong today (the same latent inversion as known fix (d)); after the fix, a positive value subtracts from the need, correctly narrowing it | **FINDING F5 → SIGN BUG (text-backed, local) → BUG → 72-07** (no ruling needed; fixed without asking per CONTEXT's "text-backed and local" rule) |

### Traps, locks, climbs, leaps

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[trap:acrobat]` | trap | Acrobat `+3` | sub-class | Acrobats dodge traps well | raises `nimble`, wider dodge range | wider range | OK |
| `[trap:thief-trap-avoid]` | trap | `CLASS_MITIGATION.Thief.trapAvoid` dial | dial | identity 0 no-op; a Thief-flavored trap-sense dial | at identity unchanged; a positive value on a Thief raises `nimble`, wider; a non-Thief unaffected | identity unchanged; tuned: wider range for a Thief only | OK |
| `[lock:locks-tier]` | lock | Locks skill tier 1 | skill | a trained lockpick opens more chests | raises the tiered need, wider | wider range | OK |
| `[lock:locks-tier-2]` | lock | Locks skill tier 2 | skill | more training, more success | raises the need further at tier 2 vs tier 1 | wider still | OK |
| `[lock:lockpicks]` | lock | carried lockpicks (no Locks skill) | item | picks help even without training | grants the tiered roll instead of the bare-d20 path, effectively wider | wider range than the bare-d20 baseline | OK |
| `[lock:intel-bonus]` | lock | `intelBonus(c)` | stat | RULE-01 (Phase 4.1): a smarter character reads a lock better | raises the need in both the tiered and bare paths | wider range at higher intel | OK |
| `[lock:pilfer]` | lock | Pilfer sub, free open | sub-class | Pilfer opens chests without a roll | `opened=true`, no draw requested | always opens, no roll | OK |
| `[climb:heights]` | climb | Heights phobia penalty | condition | a phobia makes the climb harder | raises `r` (a higher r is worse, `r<=success`), narrowing the pass range | narrower range with the phobia | OK |
| `[climb:hardiness-halving]` | climb | Hardiness halves the phobia penalty | skill | Hardiness takes the edge off a phobia | lowers `r` relative to the phobia-alone case (never below the phobia-free baseline) | improves on the phobia-alone case, never worse than baseline | OK (clamp: never turns the phobia bonus negative) |
| `[climb:armor-bulk]` | climb | armor bulk penalty | armor | bulky armor makes climbing harder | raises `r`, narrower | narrower range in bulky armor | OK |
| `[leap:water]` | leap | Bodies-of-water phobia penalty | condition | a phobia makes the leap harder | raises `r`, narrower (fail if `r>need`) | narrower range with the phobia | OK |
| `[leap:armor-bulk]` | leap | armor bulk penalty | armor | bulky armor makes leaping harder | raises `r`, narrower | narrower range in bulky armor | OK |

### Cure, wake, drop

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[cure:hardiness]` | cure | Hardiness, `+4` | skill | Hardiness helps shake off an affliction | raises the threshold, wider cure range | wider range | OK |
| `[wake:bard]` | wake | Bard's widened wake window (a documented BAD trait) | sub-class | a Bard's songs and chatter wake the dungeon more often | raises `wakeOn`, a bonus TO THE DUNGEON (bad for the hero) | the dungeon wakes on more of its hourly faces with a Bard along | OK |
| `[wake:wander-rate]` | wake | `WANDER_RATE` dial | dial | identity (shipped value) is the baseline; a higher value should mean more wandering encounters | at the shipped value, unchanged; a value above it raises `wakeOn`, more wandering | shipped baseline unchanged; tuned: more wandering at a higher dial value | OK |
| `[drop:foe-level]` | drop | foe level, `2+f.lvl` | foe-trait | "a tougher foe carries better loot" | a higher foe level raises the drop-roll's need, wider loot-drop range | more top faces drop loot from a tougher foe | OK |

## Known fixes (a)–(d)

Each quotes the user's 2026-09-24 ruling verbatim (CONTEXT "The known fixes"), states the current wrong behaviour, the target behaviour in both today's need arithmetic and the Phase 73 roll-high face count, and the plan that lands it.

**(a) The parley insult vs the "only a perfect roll finds you" overrides — the insult stacks, applied LAST.**
> "a smoked hero is found on 1–2 means max die − 1. So on a d20 a 19–20 is a find. The bonus then is a literal +1 when insulted."

Current wrong behaviour: the party-member branch of `foeToHit` construction (`engine/combat.js` ~L2436-2466) applies `insulted` BEFORE the member's own Sidestep/Smoke override, so a member's own Smoke resets the need to 1 and swallows the insult entirely — the insult has zero effect on a smoked member, contradicting the hero branch's own order. Target: both branches share one order — overrides and conditions first, the insulted +1 LAST. Today's need arithmetic: 1 → 2. Phase 73 face count: 19–20 on a d20 (two faces find a smoked-and-insulted hero or member). Landed by **72-04**. `[foe-vs-member:insult-after-member-smoke]`.

**(b) Fridgian frenzy's second swing = your normal to-hit, one worse.**

Replace the canon hard-set `need = a===1 && R.frenzy ? 3 : toHit(state)` (`engine/combat.js` ~L611; prototype-master L1909) with the normal to-hit narrowed by one, `Math.max(1, toHit(state) - 1)`. All the per-target and condition rules already applied after it (dozing, `sp.toHit`, `fast`, `magicOnly`, Overhead Blow, Afraid, dark cap via `toHit`) keep applying. This is a DECLARED divergence from the 1994 rules: canon `3` → fighters' frenzy swing improves 3→4, magic users' drops 3→2. The floor stays at 1 unless the target is untouchable (need 0). Landed by **72-05**, in the same edit as **F4** (frenzy odds apply ONLY to the actual frenzy swing, not every second attack — "Frenzy swing only (Recommended)"). `[hero-strike:frenzy-second-swing]`, `[hero-strike:frenzy-dark-cap]`.

**(c) Skeleton shatter: rolling the best face of your die shatters it.**
> "Rolling max on your dice triggers the shatter."

Any to-hit roll against a Skeleton (`sp.critOn:1`) that shows its die's best face (a natural 1 in today's roll-under engine, the max face after Phase 73) destroys it outright, including its second `twice` life. `critOn` is wired as an engine field with an event and narration line (renamed `shatterOnBest` per CONTEXT's discretion). M&M's "criticals on a 1" clause is dropped from its note — every foe is already crittable on a best roll, so the note promises nothing special. Today's need arithmetic: N/A (a new outright-kill branch, not a to-hit modifier). Phase 73 face count: the single best face of whichever die is drawn. Landed by **72-06**. `[shatter:hero-strike]`, `[shatter:member-strike]`, `[shatter:ally-strike]`, `[shatter:thrown]`, `[shatter:ally-thrown]`.

**(d) Thief `evasion` dial: flip its sign now.**

`classEvasionFor` (`engine/difficulty.js` ~L591) is ADDED into the foe's need in `foeToHitVs`/`foeToHitBreakdown` (`engine/derived.js` L1229, ~L1291), so a positive "evasion" value would make Thieves EASIER to hit — the opposite of the dial's name and JSDoc intent. Fix: a positive evasion SUBTRACTS from the foe's need (harder to hit). The value is 0 at identity (`CLASS_MITIGATION.Thief.evasion: 0`), so behaviour is unchanged today and no fixture moves. The JSDoc is fixed too. Landed by **72-04**. `[foe-vs-hero:thief-evasion]`.

## New findings

Every planner pre-scan item (F1–F5, O1–O4) verified against the code and text at commit `9197002`. Class is one of `SIGN BUG (text-backed, local)` (72-07 fixes without asking), `NEEDS RULING` (text vs canon, or a noticeable difficulty swing) or `OUT OF SCOPE` (recorded only). A dead claim (text promises a modifier the engine never applies) is a direction finding, never `OUT OF SCOPE`.

| Fn | Finding | Evidence (function + text quote) | Class | Proposed disposition |
|---|---|---|---|---|
| F1 | Member, legacy-ally and summoned-ally strikes apply NONE of the per-target to-hit rules `playerStrike` applies (dozing/stupid floor, `sp.toHit` cap, `sp.fast` narrowing, `sp.magicOnly` untouchability, Philly `slow`) | `engine/combat.js#memberStrike` (~L1799), `#alliesTurn` legacy (~L1522), `#allyTurn` (~L1460) never read `t.asleep`/`t.stupid`/`t.sp.toHit`/`t.sp.fast`/`t.sp.magicOnly`/`t.sp.slow`; every bestiary note ("hittable only on a 4," "only magic touches it") is written for "a strike," not "the hero's strike" | **SIGN BUG (text-backed, local)** — confirmed exercised and local to three functions | **User ruled FIX.** Applied by 72-07 (kept from planner's proposal, verified local; a `--gaps` follow-up only if it proves non-local) |
| F2 | Acute Hearing's "3 to hit the unseen" (`content/skills.js:51`) has no engine effect — no unseen-foe to-hit mechanic exists anywhere in `engine/derived.js#toHit`/`#foeToHitVs` | `content/skills.js:51` `txt: "never surprised; 3 to hit the unseen"`; a repo-wide read of `toHit`/`foeToHitVs`/`foeToHitBreakdown` shows no `"unseen"`/`invis`-vs-hero to-hit branch that Acute Hearing's clause could be feeding | **SIGN BUG (text-backed, dead claim)** — the bonus never narrows or widens anything; it is a promise the engine has never kept | **User ruled TEXT.** Drop the dead clause; keep "never surprised." Applied by 72-07 (text only, `content/skills.js`). The requested replacement mechanic ("Hear the next room" — squares next to the party holding an encounter show a faint mark before stepping in) is OUT of Phase 72's scope; tracked as **HUD-07 in Phase 78** |
| F3 | Shadow's "only a dagger or magic touches it" (`sp.daggerOnly`, `content/bestiary.js:137`) is inert — no engine site reads `sp.daggerOnly` anywhere | `content/bestiary.js:137` `sp: { daggerOnly: true, dark: true, note: "only a dagger or magic touches it" }`; a repo-wide `grep -rn "daggerOnly" engine/` returns zero hits — only content declares the field, nothing consumes it | **SIGN BUG (text-backed, dead claim)** — a written penalty claim the engine never enforces | **User ruled FIX.** Becomes real: a strike on a Shadow needs a dagger or a magic weapon, else need 0 (untouchable), exactly like `magicOnly`, for hero AND members/allies (consistent with F1). A declared canon divergence (the prototype leaves it inert); applied by **72-07**, measured and declared in `test/parity/FIXTURE-INVENTORY.md` |
| F4 | The frenzy-odds second swing is keyed on `a===1 && R.frenzy` (a Fridgian race check), not on the frenzy having actually fired, so a Fridgian's OTHER second attacks (Barbarian extra attack, haste, Ambidextrous, Last Stand) also take the frenzy odds even when the d8<=5 frenzy trigger never rolled | `engine/combat.js` ~L611 (the need-3 hard-set); the condition tests race+swing-index, not "the frenzy actually triggered" | **NEEDS RULING** — canon behaviour, but text makes no claim either way; a difficulty-affecting design call | **User ruled FIX ("Frenzy swing only").** Frenzy odds apply ONLY to the actual frenzy swing (d8<=5 fired). Applied by **72-05**, same edit as known fix (b) |
| F5 | `PARLEY_NEED_MOD` is documented "up = harder" (`engine/difficulty.js#parleyNeedModFor` JSDoc; `docs/DIFFICULTY-RETUNE.md`'s dial table) but `engine/combat.js#parley` ADDS it to a roll-under need, so a positive value makes parley EASIER — the same latent inversion as known fix (d) | `engine/difficulty.js` ~L679-684; `engine/combat.js#parley` `need = min(9+bonus,17) + PARLEY_NEED_MOD` where `roll<=need` succeeds | **SIGN BUG (text-backed, local)** — 0 at identity, so zero fixtures move | Fixed by **72-07** without a ruling (text-backed and local, per CONTEXT). `[parley:parley-need-mod]` is pinned RED in `test/unit/rollDirection-checks.test.js` until then |
| — | (No new findings beyond F1–F5 turned up by this audit's wider non-combat sweep.) | The trap/lock/climb/leap/cure/wake/drop/soak/thrown/resist/initiative sites (`## Site inventory` rows 30-46) and every modifier folded into them (`## Modifier ledger`) were checked against their content claims and found correctly signed; no additional text-vs-canon conflict or dead-claim was found | n/a | n/a |
| O1 | The hero's Mirror Self and invisibility item effects also shield party members (`foeToHitVs(state,"member")` reads the hero's `c.mirror`/invis). Mirror Self's text says "you"; the Crystal Staff's text says "party invisible" (a mismatch between the two items' own claimed scope) | `engine/derived.js#foeToHitVs` reads `c.mirror`/invis unconditionally regardless of the `vs` parameter | **OUT OF SCOPE** — not a sign or direction issue (the party-wide shielding is a scope/wording mismatch between two items' texts, not a bonus/penalty pointing the wrong way) | Recorded only, per CONTEXT's not-in-scope list |
| O2 | The member branch applies the member's own Sidestep AFTER the Weaken cap; the hero branch applies Sidestep BEFORE it (inside `foeToHitVs`). Sidestep plus Weaken gives a member 1 face and the hero 3 faces | `engine/combat.js#foeTurn` member branch (~L2428) vs `engine/derived.js#foeToHitVs` (hero path, ~L1217) | **OUT OF SCOPE** — a magnitude/order asymmetry, not a sign inversion (both terms still move the odds the RIGHT direction; only the combined MAGNITUDE differs by branch) | Recorded only; flagged for a future balance pass, not this phase's ROLL-01 scope |
| O3 | `needModsClause` (`src/browser/eventNarration.js:87`) prints need deltas in the SAME visual sense (`+`/`−`) on both hero-need lines (`struck`/`strikeMissed`, where a `+` is good news for the hero) and foe-need lines (`foeMissed`/`struckByFoe`/`memberStruck`, where a `+` is BAD news for the hero — the foe's need went up) | `src/browser/eventNarration.js:83-89`; see `## Handoffs → Phase 74` for the worked example | Display-sign, not an engine direction bug | Handed to **Phase 74** per CONTEXT; not fixed here |
| O4 | Every "need a 1"/"hit on a 3" style phrase becomes imprecise once the Phase 73 mirror lands, and is already imprecise under the insult stack today: Mirror Self "foes need a 1 to hit," the Crystal Staff "enemies need a 1," Weaken "they hit on a 3" | `content/spells.js` (Mirror Self), `content/treasure-tables.js` (Crystal Staff), `content/spells.js`/ability text (Weaken) — all state a single roll-under face count that changes meaning after the mirror, and none of them account for the insult stacking one worse | Roll-direction phrasing, not an engine direction bug | Handed to **Phase 79** per CONTEXT; not fixed here |

## Rulings

_(Filled by Task 3 of this plan.)_

## Skeleton shatter scope

Per CONTEXT's Claude's Discretion for known fix (c) ("which to-hit rolls count as 'your dice' against a Skeleton"): **"your dice" means every drawn to-hit die aimed at a shatter-flagged foe (`sp.shatterOnBest`) whose strike LANDS** — the hero's weapon strikes (including ability strikes and auto-hit openers, because the die is still drawn even though the comparison is bypassed), party-member strikes, summoned and legacy ally strikes, and hero and member thrown attack spells (`castSpell`/`allyCast`).

Two exceptions:
- A Con Artist's opening warning blow never shatters, because by rule it deals no injury — there is no landed strike to shatter on.
- An untouchable (need 0) target never shatters, because the strike never lands in the first place (a need-0 comparison can never succeed).

The shatter pre-empts the damage roll entirely: no `weaponDamage` (or spell-damage) draw happens on a shatter, and it routes directly through `killFoe` with the foe's `lives` (its `twice` flag) set to 1 so both lives go in the same call, matching "kill it twice; a 1 shatters it" — the note's own claim that a shatter skips the normal two-lives requirement.

## Handoffs → Phase 74 (display signs)

**`needModsClause`** (`src/browser/eventNarration.js:87-89`) prints every need modifier's delta in the same raw `+`/`−` sense regardless of which side's need it modifies, but a `+` means opposite things depending on the line kind:

- **Hero-need lines** (`strikeMissed`, `struck` — the hero's own to-hit roll): a `+` delta is GOOD NEWS for the hero (the need went up, widening the hero's hit range). Example: `struck`'s needMods might read `(needs 6: weapon-light +1)` — the light weapon raised the hero's need, an easier hit.
- **Foe-need lines** (`foeMissed`, `struckByFoe`, `memberStruck` — a foe's roll against the hero or a member): a `+` delta is BAD NEWS for the hero (the foe's need went up, widening the FOE's hit range). Example: `struckByFoe`'s needMods might read `(needs 2: insulted +1)` — the insult raised the FOE's need, a worse outcome for the hero, using the exact same visual `+` a bonus uses on the hero's own line.

Any other surface printing a modifier's sign inherits the same ambiguity if it reuses `needModsText`/`needModsClause` verbatim for both line kinds — grep `needModsClause(` in `src/browser/eventNarration.js` for every call site before Phase 74 starts (currently `strikeMissed`, `struck`, `memberStruck`, `foeMissed`, `struckByFoe`, `spellThrown`). This is the same category of ambiguity as the phase's own device trigger (`## The device trigger` above) — the underlying numbers are correct, only the sign's meaning shifts by context and nothing on screen says so.

## Handoffs → Phase 79 (roll-direction phrasing)

Every player-facing string this audit saw that encodes a roll-under face count, and will read wrong (or misleadingly incomplete) once Phase 73's roll-high mirror lands and/or once the insult stack is accounted for:

- Mirror Self: "foes need a 1 to hit" (`content/spells.js`) — becomes "foes need a 20" after the mirror; also silently becomes "a 1–2" under an insult today (and "19–20" after the mirror) with no text acknowledging the insult stacks on top.
- The Crystal Staff: "enemies need a 1" (`content/treasure-tables.js`) — same mirror and insult-stacking gaps as Mirror Self.
- Weaken: "they hit on a 3" / "they need a 3 to hit" (spell/ability text) — becomes "hit on an 18, 19 or 20" after the mirror.
- Acute Hearing (post-F2 text edit, `content/skills.js`): whatever replacement text Phase 78's "Hear the next room" mechanic uses should be written with the mirror in mind from the start, since it lands after Phase 73.
- Every `sp.toHit`/`sp.fast`/`hard-to-hit` bestiary note phrased as "hittable only on a 4" or similar (Zit, Drat, Stink Bug, Skeleton, and — after F3 lands — the Shadow's "only a dagger or magic touches it," which is a targeting restriction rather than a face count but still reads roll-under) needs a mirror-aware rewrite pass.
- The device-trigger class of text: any weapon/armor/ability description that states a bare signed number ("−2 to hit," "+1 to hit") without a "roll under" or "roll over" cue is a phrasing risk under the mirror even where the number itself is correct today (see `## The device trigger`).
- Smoke's own text (`content/abilities.js:56`, `content/skills.js:53`), updated by known fix (a) to "foes need a natural 1 to find you (a 1–2 if you insulted them)" — Phase 79 re-phrases this to the roll-high reading once the mirror lands; it is written roll-under for now per CONTEXT.

## Bot readout

The Phase 72 BEFORE/AFTER bot readouts live in `docs/DIFFICULTY-RETUNE.md` under the H2 `## v2.1 roll-direction pass (Phase 72) — bot readouts`, inserted immediately before `## v1.2 retune (Phase 27) — TUNE-05..07` (which stays the ledger's last H2 per `test/unit/difficulty-retune-ledger.test.js`'s guard). This plan (72-01) records the BEFORE readout, taken on the untouched engine at commit `9197002`; 72-07 records the AFTER readout once the four known fixes and the F1/F3/F5/F4 rulings have landed.

