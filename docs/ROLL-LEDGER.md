# ROLL-LEDGER — Phase 72 roll-direction sign audit (ROLL-01)

**Audited:** 2026-09-24 (Phase 72, commit `9197002` / `91970020af122246a72e7601eeea93a90ed7af14` — engine and content untouched at audit start).
**Finalized:** 2026-09-24/25 (72-07, commit `d2adfd6`) — every known fix (a)-(d) and every ruled finding (F1-F5) carries a final `FIXED`/`RULED: text` verdict with a linked Fixture outcome (or `DEFERRED`/`FOLLOW-UP`; none of this phase's findings needed either). No `todo` row remains in `test/unit/rollDirection.test.js`/`test/unit/rollDirection-checks.test.js`, and `test/unit/roll-ledger-sync.test.js` (72-07, Task 3) is a standing guard keeping this ledger and those two files in lockstep.
**Extends:** `.planning/milestones/v1.3-phases/31-combat-start-gating-effect-hygiene/31-ROLL-DIRECTION-AUDIT.md` (34-site inventory, commit b92ce09, audited 2026-09-16). This ledger carries every Phase 31 site forward and adds every die check Phase 31's narrower combat-only scope did not cover (thrown spells, resistance, traps, locks, climbs, leaps, cures, wake, loot drops, chargen selection gates).
**Method:** code read plus the odds-based direction test 72-02/72-03 build alongside this ledger (`test/unit/rollDirection.test.js`, `test/unit/rollDirection-checks.test.js`). No engine, content or src file is touched by this plan — audit and record only.
**Phase 73 (ROLL-05):** switched the whole engine to roll-high — every CHECK now reads a draw `r` on an N-sided die as `roll = (N+1) - r` against a high `atLeast` threshold, byte-identical to the pre-Phase-73 engine. See `## Phase 73 mirror verdicts (ROLL-05)` below for the per-site conversion table, the per-file draw-kind tally near the end of that section, and `## Handoffs → Phase 74` / `## Handoffs → Phase 79` for what the mirror hands off next.

## How to read this ledger

Today's engine is **roll-under almost everywhere**: a d-die is drawn and compared to a "need" (or a foe's "need"), and success is `roll <= need`. A **higher need is better for the roller**. The two exceptions are flee and initiative, which are **roll-high**: `roll (+ bonus) >= a target` (flee) or `mine >= theirs` (initiative), where a **higher roll is better**. (This paragraph describes the reading before Phase 73 — since Phase 73 (ROLL-05) landed, the whole engine reads roll-high, and the Modifier ledger's own "Phase 73 reading" column below is the live reading, not a preview.)

- **A hero hit** is `roll <= toHit(state)` (or `memberToHit`/`strikeDie` combinations) — a bigger `toHit` number is a bonus.
- **A foe miss** (good for the hero) is `roll > foeToHitVs(state)` — a *smaller* `foeToHitVs` number is a bonus to the hero (harder for the foe to land a blow). A larger `foeToHitVs` number is a bonus *to the foe*.
- **Flee and initiative** are the roll-high exceptions: a bigger roll (or a positive additive bonus) is good for the roller in both.

**The Phase 73 roll-high reading.** Phase 73 mirrors the whole engine so every draw's outcome stays byte-identical, but the way a human reads the die changes: a draw `r` on an N-sided die is read as `(N+1) - r` against a high target. A roll-under need of `k` on a dN becomes "succeed on `(N+1-k)` through `N`" after the mirror. Worked example: the parley insult today narrows the foe's find-window from need 1 (find only on a natural 1) to need 2 (find on a 1 or a 2) on a d20. After Phase 73's mirror the SAME two draws that found the hero before are read as **19–20** on a d20 — "smoked and insulted, foes find you on a 19 or a 20."

**Verdict vocabulary used throughout this ledger:**
- `OK` — the modifier's claimed direction and its verified engine effect agree.
- `OK (clamp)` — a clamp (a floor, a ceiling, or an override to a single face) absorbs the modifier so it never worsens the roller's odds, even though the raw arithmetic would otherwise combine with something else. A clamp never turns a bonus into a penalty.
- `OK (deliberate, Phase N)` — the modifier's sign was deliberately changed from the frozen prototype's value in a numbered phase, and that change is intentional, not a bug (e.g. Elven `foeToHit +1`, Phase 31 Finding 1's fix).
- `N/A (no modifier)` — a flat gate (a fixed threshold with no character-derived modifier folded in). It gets a site row but no modifier row.
- `FIXED (72-0N, <sha>)` — a text-backed sign or ordering bug this phase found and fixed, landed by the named plan at the given commit. (During the audit, before a row's fix landed, this ledger used an interim "still-open, fixing plan named" marker; every such marker is now resolved to `FIXED` — none remain.)
- `RULED: text (<sha>)` — a finding the user ruled "text" (a content/copy edit, not an engine change), landed at the given commit.
- `DEFERRED (backlog)` / `FOLLOW-UP (gaps)` — a finding the user ruled "defer", or one this phase's budget valve pushed to a `/gsd-plan-phase 72 --gaps` follow-up; recorded but not applied here.
- `FINDING Fn` — a new-findings-table row; see `## New findings` for its classification and disposition. (Final verdicts above supersede this marker once a finding is resolved.)

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
| 8 | combat.js#playerStrike strike die (L604, Philly L610) | d(strikeDie) | hero | `roll <= toHit(state)`, then per-target overrides | LOW | `[hero-strike:class-*]`, `[hero-strike:elven]`, `[hero-strike:acrobat]`, `[hero-strike:cleric]`, `[hero-strike:inspired]`, `[hero-strike:weapon-light/heavy]`, `[hero-strike:dazed]`, `[hero-strike:dark-cap]`, `[hero-strike:night-vision]`, `[hero-strike:senses]`, `[hero-strike:torch]`, `[hero-strike:amulet-light]`, `[hero-strike:dozing]`, `[hero-strike:stupid]`, `[hero-strike:hard-to-hit]`, `[hero-strike:fast]`, `[hero-strike:magic-only]`, `[hero-strike:dagger-only]`, `[hero-strike:overhead-blow]`, `[hero-strike:afraid]`, `[hero-strike:floor-clamp]`, `[hero-strike:philly-slow]`, `[hero-strike:auto-hit]`, `[hero-strike:level-die]`, `[hero-strike:elven-strike-step]`, `[hero-strike:illusionist-d20]`, `[hero-strike:acuteness]`, `[hero-strike:frenzy-second-swing]`, `[hero-strike:frenzy-dark-cap]` | 7 | OK, except **FIXED (72-05, f71f733)** (frenzy-second-swing/frenzy-dark-cap, known fix b) and **FIXED (72-07, d2adfd6)** (dagger-only, Finding F3) |
| 9 | combat.js#playerStrike Stealth crit (L721) | reuses strike roll | hero | `<= 2` | LOW | `[hero-crit:stealth]` | 8 | OK |
| 10 | combat.js#playerStrike Ninja crit (L731) | reuses strike roll | hero | `<= 2` | LOW | `[hero-crit:ninja]` | 9 | OK |
| 11 | combat.js#playerStrike weapon crit (L678-ish, `weaponCrit`) | reuses strike roll | hero | `roll <= weaponCrit(c)` unless `noCrit` | LOW | `[hero-crit:precise-blade]`, `[hero-crit:no-crit-sub]`, `[hero-crit:dark]`, `[hero-crit:light]` | — | OK (new site row split out of Phase31 #7 for clarity) |
| 12 | combat.js#killFoe loot drop (L871) | d20 | n/a (loot table gate) | `<= 2+f.lvl` | n/a (drop table) | `[drop:foe-level]` (foe level raises the chance — tougher foe, better odds) | 10 | OK / N/A |
| 13 | combat.js#killFoe bag-upgrade drop (L874) | d20 | n/a | `<= BAG_DROP_UNDER` | n/a | none (flat) | 11 | OK / N/A |
| 14 | combat.js#killFoe cooking (L884) | d6 | n/a | `>= 4` | n/a | none (flat) | — | OK / N/A (new since Phase 31) |
| 15 | combat.js#pursuitStrike (L934) | d(foeDie) | pursuing foe | `roll <= foeToHitVs(state)` then blind/Weaken/insulted | LOW | `[pursuit:blind]`, `[pursuit:weaken]`, `[pursuit:insult]`, `[pursuit:insult-after-blind]` | 12 | OK |
| 16 | combat.js#pursuitStrike Soldier crit-taken (L968) | reuses pursuer roll | n/a (victim-side) | `roll===1 \|\| (roll<=2 && Soldier)` | n/a | Soldier's own BAD trait widens the crit window against them | 13 | OK |
| 17 | combat.js#flee (L1068) | d20 | hero | `roll + bonus >= need` | YES (own subsystem) | `[flee:thief]`, `[flee:class-mod]`, `[flee:race-mod-elven]`, `[flee:race-mod-heavy]`, `[flee:armor-bulk]`, `[flee:flee-need-mod]`, `[flee:smoke]` | 14 | OK |
| 18 | combat.js#parley (L1226) | d20 | hero | `roll <= min(9+bonus,17) + PARLEY_NEED_MOD` | LOW | `[parley:con-artist]`, `[parley:woodsman]`, `[parley:wilmsry]`, `[parley:elven-humans]`, `[parley:fluency]`, `[parley:level]`, `[parley:top-foe-level]`, `[parley:ceiling]`, `[parley:parley-need-mod]` | 15 | OK, except **FIXED (72-07, d2adfd6)** (`[parley:parley-need-mod]`, Finding F5) |
| 19 | combat.js#parley Humans payout (L1238) | d6 | n/a | `=== 6` | n/a | none (flat) | — | OK / N/A (new since Phase 31) |
| 20 | combat.js#allyTurn summon strike (L1460) | d(STRIKE_DICE[lvl-1]) | summon | `<= 5` | LOW | `[ally-strike:ally-level-die]` | 16 | OK |
| 21 | combat.js#alliesTurn legacy strike (L1522) | d(STRIKE_DICE[lvl-1]) | legacy ally | `<= 5` | LOW | none (flat) | 17 | OK |
| 22 | combat.js#memberStrike (L1799) | d(strikeDie(view)) | party member | `roll <= memberToHit(view)` | LOW | `[member-strike:class-fighter]`, `[member-strike:elven]`, `[member-strike:acrobat]`, `[member-strike:cleric]`, `[member-strike:level-die]` | 18 | OK, except **FIXED (72-07, d2adfd6)** (Finding F1): member/legacy/summoned strikes now apply the same per-target rules `playerStrike` applies (dozing/stupid, `sp.toHit`, `sp.fast`, `sp.magicOnly`/`sp.daggerOnly`, Philly `slow`) |
| 23 | combat.js#allyCast thrown (L1884) | d8/d10 | member (MU) | `roll - bonus <= need` | LOW | `[ally-thrown:school-bonus]` | 19 | OK |
| 24 | combat.js#applyFoeDamageToPlayer armor soak (L2169) | d20 | hero (soak wanted) | `soak <= soakAr` | LOW (soak wanted) | `[hero-soak:armor-ar]`, `[hero-soak:cloak-of-armor]`, `[hero-soak:taunt]`, `[hero-soak:fighter-armor-mul]`, `[hero-soak:no-armor-foe]` | 20 | OK |
| 25 | combat.js#foeTurn ability gate (L2398) | d6 | n/a (AI gate) | `<= 4` | n/a | none | 21 | OK / N/A |
| 26 | combat.js#foeTurn member branch (L2428) | d(mDieN) | foe vs member | `roll <= foeToHitVs(state,"member")` then blind/Weaken/insulted/Sidestep/Smoke | LOW | `[foe-vs-member:battle-roar]`, `[foe-vs-member:member-sidestep]`, `[foe-vs-member:member-smoke]`, `[foe-vs-member:blind]`, `[foe-vs-member:weaken]`, `[foe-vs-member:insult]`, `[foe-vs-member:foe-accuracy]`, `[foe-vs-member:hero-only-terms]`, `[foe-vs-member:insult-after-member-smoke]`, `[foe-vs-member:hero-defences]`, `[foe-vs-member:elven]`, `[foe-vs-member:acrobat]`, `[foe-vs-member:guard]`, `[foe-vs-member:gear-foe-to-hit]`, `[foe-vs-member:mirror-self]`, `[foe-vs-member:invisibility]`, `[foe-vs-member:party-invisibility]`, `[foe-vs-member:thief-evasion]`, `[foe-vs-member:dwarven-foe-strike-step]` | 24 | OK, except **FIXED (72-04, 6484f48)** (`[foe-vs-member:insult-after-member-smoke]`, known fix a) and **FIXED (79-02b)** (user ruling 2026-09-27: the need is now `foeSwingVsMember(state, f, sheet)` and the die `foeDie(sheet, f)`, both read from the Joiner's own sheet) |
| 27 | combat.js#foeTurn member crit (L2428 area) | reuses mRoll | foe vs member | `mRoll === 1` | LOW | `[foe-crit-vs-member:natural-best]` | — | OK (new site row split out of #26) |
| 28 | combat.js#foeTurn hero branch (L2549) | d(dieN) | foe vs hero | `roll <= foeToHitVs(state)` then blind/Weaken/insulted | LOW | `[foe-vs-hero:elven]`, `[foe-vs-hero:acrobat]`, `[foe-vs-hero:guard]`, `[foe-vs-hero:gear-foe-to-hit]`, `[foe-vs-hero:foe-accuracy]`, `[foe-vs-hero:battle-roar]`, `[foe-vs-hero:party-battle-roar]`, `[foe-vs-hero:sidestep]`, `[foe-vs-hero:smoke]`, `[foe-vs-hero:mirror-self]`, `[foe-vs-hero:invisibility]`, `[foe-vs-hero:blind]`, `[foe-vs-hero:weaken]`, `[foe-vs-hero:insult]`, `[foe-vs-hero:insult-after-smoke]`, `[foe-vs-hero:insult-after-mirror]`, `[foe-vs-hero:insult-after-invisibility]`, `[foe-vs-hero:insult-after-blind]`, `[foe-vs-hero:dwarven-foe-strike-step]`, `[foe-vs-hero:foe-level-die]`, `[foe-vs-hero:thief-evasion]` | 22 | OK, except **FIXED (72-04, c8cd666)** (`[foe-vs-hero:thief-evasion]`, known fix d) |
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
| 46 | derived.js#resistRoll (L1429) | d20 | resistor (hero or foe) | `roll < intel`, gated `intel>=12` (quick 260928-hrs: now roll-high `roll >= 21 - resistFaces(intel)`, half-intel faces, no gate, both sides; quick 260928-nrf: Joiners too) | YES (resistor wants a LOW roll under intel — a roll-high-style "beat the stat" read) | `[resist:intel]`, `[resist:foe-intel]`, `[resist:member-intel]` (`[resist:intel-gate]` retired) | 34 | OK |
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
| `[hero-strike:dark-cap]` | hero-strike | dark cap, `Math.min(h,2)`, in the dark with no light waiver (Night Vision, a lit torch, a live Amulet) and no Sense Presence (`darkLimited(state) && !c.senses`, DARK-01 Phase 76) | terrain | fighting blind in the dark is worse | caps the need at 2 regardless of class, narrowing a Fighter's odds sharply | at most the bottom 2 faces succeed | OK |
| `[hero-strike:night-vision]` | hero-strike | Night Vision skill (waives the dark cap) | skill | Night Vision lets you fight in the dark as if lit | removes the cap, restoring full-need odds | full range restored | OK |
| `[hero-strike:senses]` | hero-strike | `c.senses` (waives the dark cap) | ability | same relief as Night Vision, granted by an item/effect | removes the cap | full range restored | OK |
| `[hero-strike:torch]` | hero-strike | a lit torch (`item:Torch` effect live; waives the dark cap through `darkLimited`) | item | DARK-01 (Phase 76, user ruling 2026-09-25 "combat too"): a light that lights the map lights the fight | removes the cap, restoring full-need odds | full range restored | OK |
| `[hero-strike:amulet-light]` | hero-strike | a live Amulet of Light (`eff(c,"light") > 0`; waives the dark cap through `darkLimited`) | item | DARK-01 (Phase 76): the Amulet's light lifts the dark in a fight as on the map | removes the cap, restoring full-need odds | full range restored | OK |
| `[hero-strike:dozing]` | hero-strike | `t.asleep` (dozing foe), `Math.max(need,5)` | condition (target) | a sleeping target is easier to hit | raises the need to at least 5 for a class below it (e.g. MU); a Fighter (already ≥5) is unaffected | more faces succeed for a low-need class; unchanged for a Fighter | OK, Fighter case `OK (clamp)` |
| `[hero-strike:stupid]` | hero-strike | `t.stupid` (same clamp as dozing) | condition (target) | same as dozing | same as dozing | same as dozing | OK, Fighter case `OK (clamp)` |
| `[hero-strike:hard-to-hit]` | hero-strike | `t.sp.toHit` (e.g. Zit "hittable only on a 4") | foe-trait | the bestiary note states the exact cap | `Math.min(need, t.sp.toHit)` caps the need down, narrowing a Fighter's odds; an MU already below the cap is unaffected | fewer top faces succeed for a Fighter; unchanged for an MU already under the cap | OK, MU case `OK (clamp)` |
| `[hero-strike:fast]` | hero-strike | `t.sp.fast` (e.g. Pogo), `Math.max(1,need-1)` | foe-trait | a fast foe is harder to land a blow on | lowers the need by 1, floored at 1 | one fewer top face succeeds, never below the single best face | OK |
| `[hero-strike:magic-only]` | hero-strike | `t.sp.magicOnly` (e.g. Ghost) | foe-trait | "only magic touches it" | need forced to 0 (untouchable) without a magic weapon; restored with one (`c.magicWpn`) | zero faces succeed without a magic weapon; normal range with one | OK |
| `[hero-strike:dagger-only]` | hero-strike | `t.sp.daggerOnly` (the Shadow) | foe-trait | "only a dagger or magic touches it" | the field was declared in `content/bestiary.js` but no engine site ever read it — a dead claim, not a sign inversion (Finding F3) | fixed: need forced to 0 (untouchable) without a dagger or a magic weapon, exactly like `magicOnly`; restored with either | **FIXED (72-07, d2adfd6)** (Finding F3, user-ruled fix — a declared canon divergence, the prototype leaves `daggerOnly` inert) |

**Fixture outcome (F3):** `test/parity/FIXTURE-INVENTORY.md`'s "### Plan 07" section — measured moved set of **zero** (the complete parity-exposed bestiary surface, per `## Parity-exposed bestiary surface`, contains no Shadow; `test/parity/divergence-records.test.js`'s `ROLL-01 (Phase 72)` guard's part (e) proves this live). Also reachable in real gameplay — the AFTER bot readout's death-cause breakdown shows the Shadow's death share moving from 1 (0.5%) to 3 (1.5%) of 200 seeds, the one line plausibly touched by this fix (see `docs/DIFFICULTY-RETUNE.md`'s Phase 72 H2 Reading).
| `[hero-strike:overhead-blow]` | hero-strike | Overhead Blow ability, `AS.needShift` | ability | a heavy telegraphed swing trades accuracy for damage | narrows the need | fewer top faces succeed | OK |
| `[hero-strike:kata-feint]` | hero-strike | Kata and Feint, `AS.needShift: +3` (`KATA_FEINT_NEED_SHIFT`) | ability | quick 260928-nrf (user ruling 2026-09-28): "your die has three more faces that land this strike", replacing the old auto-hit | widens the need by three faces, capped at the die | more top faces succeed; a miss is still possible | OK (quick 260928-nrf) |
| `[hero-strike:afraid]` | hero-strike | `C.afraid`, `afraidNeed` (last modifier, `-3`) | condition | a frightened hero swings worse | lowers the need by 3 (floored) | fewer top faces succeed | OK |
| `[hero-strike:afraid-vs-untouchable]` | hero-strike | `magicOnly` + `afraid` | foe-trait + condition | Afraid "never revives an untouchable" target | a need-0 (magicOnly, no magic weapon) target stays at need 0 under Afraid — the floor never lifts a 0 to 1 | zero faces, unchanged | OK (clamp) |
| `[hero-strike:floor-clamp]` | hero-strike | Overhead Blow + Afraid stacked | ability + condition | stacked penalties never erase a touchable target's last face | the floor keeps need ≥ 1 while the target is touchable | at least the single best face still succeeds | OK (clamp) |
| `[hero-strike:philly-slow]` | hero-strike | Philly `sp.slow` (keep the lower of two dice) | foe-trait | a Philly is slow to react, so the hero's second die helps | `Math.min(roll, rng.d(dieN))` — a second draw can only IMPROVE (lower) the effective strike-die roll | strictly better odds over one draw (the joint-odds view) | OK |
| `[hero-strike:auto-hit]` | hero-strike | Cat Burglar/Ninja opener, `subAuto` | sub-class | an opening backstab always connects | bypasses the to-hit comparison entirely on the first strike (`C.opened` false) | every face succeeds | OK |
| `[hero-strike:level-die]` | hero-strike | level-based `strikeDie` shrink | class | a higher-level hero swings a smaller (better) die | `STRIKE_DICE` shrinks with level | fewer total faces, same or more succeed proportionally | OK |
| `[hero-strike:elven-strike-step]` | hero-strike | Elven `strikeStep` | race | Elven swings a die better | shrinks the strike die one step early | smaller die, better proportion | OK |
| `[hero-strike:illusionist-d20]` | hero-strike | Illusionist d20-until-level-3 | sub-class | an Illusionist is a weaker fighter early | keeps the strike die at d20 (worse) until level 3 | worst die of any class at low level | OK |
| `[hero-strike:acuteness]` | hero-strike | Potion of Acuteness effect | item | the potion sharpens the swing | a live effect improves the strike die/need | better odds while active | OK |
| `[hero-strike:frenzy-second-swing]` | hero-strike | Fridgian frenzy, second swing | race | frenzy's second swing is a declared canon divergence (CONTEXT (b)): the normal to-hit narrowed by one face, never a hard-set need 3 | the code hard-set `need = a===1 && R.frenzy ? 3 : toHit(state)` regardless of whether the actual frenzy swing fired, so a fighter's frenzy swing WORSENED (5→3) instead of narrowing by exactly one (5→4), and a non-frenzy second attack (Barbarian/haste/Ambidextrous/Last Stand) wrongly got frenzy odds too (Finding F4) | fixed: one fewer top face than the normal swing, floored at the single best face | **FIXED (72-05, f71f733)** (known fix b, F4 ruled fix, same edit) |
| `[hero-strike:frenzy-dark-cap]` | hero-strike | frenzy second swing + dark cap | race + terrain | the narrowed swing still respects the dark cap | the old hard-set need 3 could accidentally read HIGHER than a dark-capped normal swing (need 2) for some classes, contradicting "never above the normal capped odds" | fixed: the narrowed swing's odds sit at or below the dark-capped normal swing | **FIXED (72-05, f71f733)** |

**Fixture outcome ((b)/F4):** `test/parity/FIXTURE-INVENTORY.md`'s "### Plan 05" section — measured moved set of **zero** parity fixtures (the one Fridgian hero whose action script reaches a second strike, `combat#lose` seed 14, fires frenzy 4 times but every swing-2 roll lands on the same side of both the old and new need); one draw-count pin (`test/unit/foe-turn-draw-count.test.js`'s `FULL_FIGHTS` seed 17/Beasts row) was re-measured live, not a parity fixture.

### Hero crit

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[hero-crit:precise-blade]` | hero-crit | `weaponCrit` (crit:2 vs crit:1) | weapon | a precision weapon crits more often | `roll <= weaponCrit(c)` — crit:2 covers two faces instead of one | two top faces crit instead of one | OK |
| `[hero-crit:no-crit-sub]` | hero-crit | Guard/Soldier `noCritFor` | sub-class | Guard/Soldier never land a crit (a documented BAD trait) | crit forced to zero faces | never crits | OK |
| `[hero-crit:dark]` | hero-crit | in the dark with no light waiver (Night Vision, a lit torch, a live Amulet) and no Sense Presence (`darkLimited(state) && !c.senses`, DARK-01 Phase 76) | terrain | you can't line up a precise blow you can't see | crit forced to zero faces in the dark unless waived | never crits in the dark without the waiver | OK |
| `[hero-crit:light]` | hero-crit | a lit torch in the dark (waives the crit ban through `darkLimited`) | item | DARK-01 (Phase 76, user ruling 2026-09-25 "combat too"): a light restores the crits the dark denies | the precise blade's crit faces return in the dark | top faces crit again | OK |
| `[hero-crit:stealth]` | hero-crit | Stealth opener, `roll<=2` | skill | an unseen opening blow lands harder | widens the crit window to two faces | two top faces crit | OK |
| `[hero-crit:ninja]` | hero-crit | Ninja non-opening strike, `roll<=2` | sub-class | a Ninja crits more often even outside an opener | widens the crit window to two faces | two top faces crit | OK |
| `[hero-crit:silent-step]` | hero-crit | Silent Step ability, `mod.forceCrit`/`AS.forceCrit` | skill | "nobody heard that: your next attack is an automatic critical, any round" | the forced descriptor makes the strike a critical on every face, bypassing the roll entirely (`engine/abilities.js:184`, wired through `playerStrike`'s `AS.forceCrit`) | every face crits | OK (added to the sync guard, 72-07; a T3 gap-fill row, not a sign bug) |

### Foe vs hero (`engine/derived.js#foeToHitVs`, `engine/combat.js#foeTurn` hero branch)

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[foe-vs-hero:elven]` | foe-vs-hero | race `foeToHit:+1` | race | "thin-boned and easy to hit," `content/races.js` | `+1` to the foe's need, a bonus to the foe (bad for the hero); the Small face axis is masked by the signature rule (RULES-11, Phase 75.2), so this row still measures thin bones alone | foe finds an Elven hero on one more top face | OK (deliberate, Phase 31 — fixes 31-ROLL-DIRECTION-AUDIT.md Finding 1's inherited `-1`) |
| `[foe-vs-hero:acrobat]` | foe-vs-hero | Acrobat override (`ACROBAT_FOE_FACES`, 4 since quick 260928-nrf; canon 3) | sub-class | an Acrobat is hard to pin down | lowers the foe's need (penalty to the foe) | foe finds an Acrobat on fewer top faces (four, not five) | OK |
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
| `[foe-vs-hero:dwarven-foe-strike-step]` | foe-vs-hero | Dwarven `foeStrikeStep` | race | "foes strike at a better die" against a Dwarf | shrinks the foe's die one step early, isolated from the Dwarf's own size face step with a live Gauntlet record (RULES-11, Phase 75.2) | smaller die, foe's proportional odds rise | OK |
| `[foe-vs-hero:size-large]` | foe-vs-hero | Troll `Large` size step (+1) | race | RULES-11: "each step up, foes hit one face more easily" — Large stacks with the Troll's own traits (the signature ruling) | raises the foe's need by SIZE_FACES_PER_STEP, a signed `size` mod | one more top face for the foe | OK (RULES-11, Phase 75.2)
| `[foe-vs-hero:size-small]` | foe-vs-hero | Dwarven `Small` size step (-1), face axis unmasked | race | RULES-11 + the signature ruling: Small's harder-to-hit face axis is NOT dropped for Dwarven (only the damage axis is, protecting the Dwarven +2 dmg trait) | lowers the foe's need by SIZE_FACES_PER_STEP | one fewer top face for the foe | OK (RULES-11, Phase 75.2)
| `[foe-vs-hero:size-item]` | foe-vs-hero | a live Gauntlet of the Giant record, `+1` step | item | RULES-11: an item's size step always applies in full, on both axes, never masked | raises the foe's need by SIZE_FACES_PER_STEP | one more top face for the foe | OK (RULES-11, Phase 75.2)
| `[foe-vs-hero:size-signature]` | foe-vs-hero | Elven + a live Gauntlet record | race + item | RULES-11 signature ruling: the item's step lands in full even though the Elven base face axis is masked | raises the foe's need by SIZE_FACES_PER_STEP despite the masked race base | one more top face for the foe | OK (RULES-11, Phase 75.2)
| `[foe-vs-hero:foe-level-die]` | foe-vs-hero | `foeDie` level scaling | foe-trait | a tougher foe swings a better (smaller) die, floored at d8 | `max(d8, level die + step)` | smaller die for a higher-tier foe, floored | OK |
| `[foe-vs-hero:thief-evasion]` | foe-vs-hero | `classEvasionFor` (Thief), `engine/difficulty.js` | dial | JSDoc/dial intent: a positive evasion value should make Thieves HARDER to hit | `classEvasionFor` was ADDED into the foe's need (`h += classEvasionFor(c)` at `engine/derived.js:1229`), so a positive value made the foe's need RISE — easier for the foe to hit a Thief, the opposite of "evasion." At identity (0) nothing moved | fixed: a positive evasion now SUBTRACTS from the foe's need | **FIXED (72-04, c8cd666)** (known fix d) |

**Fixture outcome ((d)):** `test/parity/FIXTURE-INVENTORY.md`'s "### Plan 04" section — measured moved set of **zero** (the dial is 0 at identity everywhere in every fixture; behaviour is byte-identical).

### Foe crit vs hero

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[foe-crit-vs-hero:soldier]` | foe-crit-vs-hero | Soldier's widened crit-taken window | sub-class | a documented BAD trait — Soldier is easier to crit | `roll===1 \|\| (roll<=2 && Soldier)` widens the foe's crit window to two faces against a Soldier | the foe crits a Soldier on two top faces instead of one | OK |

### Foe vs member (`engine/derived.js#foeToHitVs(state,"member")`, `engine/combat.js#foeTurn` member branch)

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[foe-vs-member:size]` | foe-vs-member | a Joiner's own race size step (signature mask applied) | race | RULES-11: "a Joiner gets size too... by the same rule" — a Troll member is one face easier to hit, a Dwarven member one face harder | raises/lowers the foe's need against THAT member by SIZE_FACES_PER_STEP | a Troll member: one more top face; a Dwarven member: one fewer | OK (RULES-11, Phase 75.2)
| `[foe-vs-member:battle-roar]` | foe-vs-member | the member's own or the hero's Battle Roar (party-wide) | ability | same claim as the hero-side row | lowers the foe's need against the member | fewer top faces for the foe | OK |
| `[foe-vs-member:member-sidestep]` | foe-vs-member | the member's own Sidestep | ability | same claim as the hero-side row | lowers the foe's need; since 79-02b it sits inside `foeToHitVs(state,"member",sheet)`, BEFORE the Weaken cap, exactly as the hero's does (Finding O2 resolved) | fewer top faces | OK (O2 resolved by 79-02b) |
| `[foe-vs-member:member-smoke]` | foe-vs-member | the member's own Smoke | ability | override to the single best face | same override as the hero branch | one face | OK |
| `[foe-vs-member:blind]` | foe-vs-member | `f.blind` | condition (foe) | same claim as the hero-side row | same override | one face | OK |
| `[foe-vs-member:weaken]` | foe-vs-member | Weaken vs a member | spell | "they need a 3 to hit" | same cap as the hero-side row | at most the bottom 3 faces | OK |
| `[foe-vs-member:insult]` | foe-vs-member | failed parley vs a member target | condition (player action) | same claim as the hero-side row | raises the foe's need by one face | one more top face | OK |
| `[foe-vs-member:foe-accuracy]` | foe-vs-member | `FOE_ACCURACY` dial vs a member | dial | same claim as the hero-side row | identity no-op; tuned value raises the foe's need | identity unchanged; tuned: one more top face | OK |
| `[foe-vs-member:hero-only-terms]` | foe-vs-member | the hero's OWN Sidestep/Smoke timer | ability | `foeToHitVs`'s `vs` parameter scopes hero-only terms away from member rolls | the hero's personal timers leave the member's odds unchanged | unchanged | OK (scope, by design) |
| `[foe-vs-member:insult-after-member-smoke]` | foe-vs-member | member Smoke + insulted, ORDER-DEPENDENT | ability + condition | CONTEXT (a): the insult must apply LAST here too, matching the hero branch — need 1→2 | the member branch (`engine/combat.js` ~L2436-2466) applied insulted BEFORE the member's own Sidestep/Smoke, so a member's own Smoke reset the need back to 1 and SWALLOWED the insult entirely | fixed: insulted has effect again (exactly two faces), matching `[foe-vs-hero:insult-after-smoke]` | **FIXED (72-04, 6484f48)** (known fix a) |
| `[foe-vs-member:hero-defences]` | foe-vs-member | the HERO's own Acrobat, Guard, gear (Anklet), Mirror Self, Cloak invisibility and Dwarven foe die | sub-class + gear + spell + race | user ruling 2026-09-27: "none of the hero's personal defences protect a Joiner" | before 79-02b, `foeToHitVs(state,"member")` read the hero's Acrobat override, Guard −1, `eff(c,"foeToHit")`, `c.mirror` and invisibility, and the member die was `foeDie(c, f)` | the member's odds are unchanged by any of them | **FIXED (79-02b)** |
| `[foe-vs-member:elven]` | foe-vs-member | the member's own Elven thin-boned trait (`raceFoeToHit(sheet)`) | race | same claim as `[foe-vs-hero:elven]`, for the Joiner's own body | raises the foe's need against an Elven member | one more top face | OK (79-02, re-homed into `foeToHitVs` by 79-02b) |
| `[foe-vs-member:acrobat]` | foe-vs-member | the member's own Acrobat (need 4 since quick 260928-nrf; was 3) | sub-class | same claim as `[foe-vs-hero:acrobat]`, for the Joiner's own body | the member's own Acrobat override now applies | fewer top faces for the foe | **FIXED (79-02b)** |
| `[foe-vs-member:guard]` | foe-vs-member | the member's own Guard (−1) | sub-class | same claim as `[foe-vs-hero:guard]` | the member's own Guard −1 now applies | one fewer top face | **FIXED (79-02b)** |
| `[foe-vs-member:gear-foe-to-hit]` | foe-vs-member | a live `foeToHit` item effect on the member's own sheet | gear | same claim as `[foe-vs-hero:gear-foe-to-hit]` | `eff(sheet,"foeToHit")` now applies (structurally 0 today: a Joiner starts no item effect) | two fewer top faces | **FIXED (79-02b)** |
| `[foe-vs-member:mirror-self]` | foe-vs-member | the member's own `mirror` count | spell | Mirror Self: "you" — the caster's own body | `sheet.mirror > 0` overrides to one face (structurally 0 today: a Joiner casts attack spells only) | one face | **FIXED (79-02b)** |
| `[foe-vs-member:invisibility]` | foe-vs-member | a live invis item effect on the member's own sheet | gear | same claim as `[foe-vs-hero:invisibility]` | `itemEffectActive(sheet,"invis")` overrides to one face | one face | **FIXED (79-02b)** |
| `[foe-vs-member:party-invisibility]` | foe-vs-member | the HERO's live Crystal Staff (`PARTY_WIDE_ITEM_EFFECTS`) | gear (party-wide) | "party invisible d10+5 squares; enemies need a 1" | the one hero item effect that still covers a Joiner, read from content-backed `PARTY_WIDE_ITEM_EFFECTS` | one face | OK (party-wide by its own text, Finding O1 resolved) |
| `[foe-vs-member:thief-evasion]` | foe-vs-member | `CLASS_MITIGATION.Thief.evasion` on a Thief member | dial | same claim as `[foe-vs-hero:thief-evasion]`, for the Joiner's own class | identity no-op; a positive value lowers the foe's need against a Thief member only | identity unchanged; tuned: one fewer top face | **FIXED (79-02b)** |
| `[foe-vs-member:dwarven-foe-strike-step]` | foe-vs-member | the member's own Dwarven `foeStrikeStep` | race | same claim as `[foe-vs-hero:dwarven-foe-strike-step]`, for the Joiner's own body | the foe die is `foeDie(sheet, f)`: a Dwarven member draws the better foe die, a Dwarven hero's die never reaches a Joiner | smaller die, the foe's proportional odds rise | **FIXED (79-02b)** |

**Fixture outcome ((a)):** `test/parity/FIXTURE-INVENTORY.md`'s "### Plan 04" section — measured moved set of **zero** (no fixture ever populates `state.party`/`combat.allies`, so the member branch never runs against any of the 31 replay sites; `test/parity/divergence-records.test.js`'s `ROLL-01 (Phase 72)` guard proves this live).
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
| `[member-strike:per-target-rules]` | member-strike | dozing/`sp.toHit`/`sp.fast`/`sp.magicOnly`/`sp.daggerOnly`/Philly `slow` | condition/foe-trait (member roller) | `playerStrike`'s full per-target chain is a stated rule for "anyone" landing a blow, per the bestiary notes' plain wording, not "the hero specifically" | `memberStrike`, the legacy `alliesTurn` strike and `allyTurn`'s summon strike applied NONE of these per-target terms — a member swung at a dozing/stupid foe, a `sp.toHit`-capped foe, a `fast` foe or a `magicOnly` foe (Ghost/Spectre) exactly as if the target were plain, which silently swung party balance against exactly the foes these rules exist to gate | fixed: a member/ally now gets the same per-target adjustment the hero gets (all local, in `memberStrike`/legacy `alliesTurn`/`allyTurn`; no non-local follow-up needed) | **FIXED (72-07, d2adfd6)** (Finding F1, user-ruled fix) |

**Fixture outcome (F1):** `test/parity/FIXTURE-INVENTORY.md`'s "### Plan 07" section — measured moved set of **zero parity fixtures** (no fixture ever populates `state.party`/`combat.allies`/`combat.ally`; `test/parity/divergence-records.test.js`'s `ROLL-01 (Phase 72)` guard's part (d) proves this live). F1's fix IS reachable outside the parity fixtures, in real (non-scripted) gameplay: `test/unit/bot-tactics.test.js`'s no-stall proof (a forced Magic User/Sorcerer/Human party build) hit a pre-existing bot-AI `campFailed` loop earlier along a diverged RNG path once this fix landed; re-measured live and the pinned seed was swapped (bisected to confirm F1, not F3 or F5, was the cause — see that file's own Phase 72 comment).
| `[ally-strike:ally-level-die]` | ally-strike | summon `C.ally.lvl` strike-die scaling | ability (summon) | a higher-level summon swings a better die | `STRIKE_DICE[lvl-1]` shrinks with level | smaller die, non-worsening at minimum | OK |

### Skeleton shatter, thrown-spell variants (known fix c)

| Id | Site | Source | Kind | Claimed direction | Verified today | Phase 73 reading | Verdict |
|---|---|---|---|---|---|---|---|
| `[shatter:hero-strike]` | shatter | Skeleton `sp.critOn:1` ("a 1 shatters it") | foe-trait | rolling the die's best face shatters the Skeleton outright, both lives, on any LANDED hero strike | `critOn:1` only fed the ordinary crit-damage-multiplier path (`roll===1` doubles/triples damage, the same as every other `critOn:1` foe) — it did NOT shatter, kill both lives, or do anything the Skeleton's own note promised beyond a normal crit | fixed: `shatterOnBest` wires the shatter; a best-face landed strike shatters it in one call | **FIXED (72-06, ed4d076)** (known fix c) |
| `[shatter:hero-strike-second-life]` | shatter | same, on the Skeleton's SECOND (kill-twice) life | foe-trait | "kill it twice; a 1 shatters it" — the shatter skips the normal two-lives requirement outright, even on the last life | same gap as above; a kill-twice foe on its last life would otherwise still need an ordinary second kill | fixed: the shatter destroys the second life outright in the same call, no second strike needed | **FIXED (72-06, ed4d076)** (known fix c, a T3 gap-fill row, 72-07) |
| `[shatter:member-strike]` | shatter | same, via `memberStrike` | foe-trait | "your dice" (CONTEXT's Claude's Discretion) covers party-member strikes too | same gap as above | same fix | **FIXED (72-06, ed4d076)** |
| `[shatter:ally-strike]` | shatter | same, via `allyTurn`/legacy `alliesTurn` | foe-trait | summoned and legacy ally strikes count as "your dice" | same gap | same fix | **FIXED (72-06, ed4d076)** |
| `[shatter:thrown]` | shatter | same, via the hero's `castSpell` thrown attack | foe-trait | a thrown attack spell that lands is still a to-hit die drawn against the Skeleton | same gap | same fix | **FIXED (72-06, ed4d076)** |
| `[shatter:ally-thrown]` | shatter | same, via `allyCast` | foe-trait | a member's thrown attack spell counts too | same gap | same fix | **FIXED (72-06, ed4d076)** |

**Fixture outcome ((c)):** `test/parity/FIXTURE-INVENTORY.md`'s "### Plan 06" section — measured moved set of **zero** (the complete parity-exposed bestiary surface is Beasts lvl 1 and Humans lvl 1; no fixture ever meets a Skeleton or M&M, and none dispatches a Vampire summon).

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
| `[resist:intel]` | resist | the hero's `intel` against a foe's spell or ability | stat | a smarter hero shrugs off more effects; quick 260928-hrs (user ruling 2026-09-28): the same half-intel scale a foe resists on | roll-high: `resisted = roll >= 21 - faces`, `faces = resistFaces(intel) = max(1, round(intel / 2))`, every hero rolls (no gate) | wider resist range for a higher-intel hero; intel 1–2 still resists on one face | OK (quick 260928-hrs) |
| `[resist:intel-gate]` | resist | `intel >= 12` gate | stat | below the threshold, resistance is never rolled for | retired: every hero rolls since quick 260928-hrs | no gate | N/A (retired by quick 260928-hrs, user ruling 2026-09-28: the gate no longer exists, so there is nothing to probe) |
| `[resist:depth]` | resist | floor depth past CONTROL_AT_DEPTH.kneeDepth | depth | RULES-18 (Phase 75.3, user ruling 2026-09-25): from floor 12, foes increasingly RESIST control | roll-high: `resisted = roll >= 21 - faces`, faces growing with depth past the knee | wider resist range for a deeper foe past the knee | OK (RULES-18, Phase 75.3) |
| `[resist:foe-intel]` | resist | a foe's `intel` against a spell cast on it | stat | quick 260927-rsx (user ruling 2026-09-27): every spell cast on an enemy can be resisted, more often by a smarter foe; half-intel scale | roll-high: `resisted = roll >= 21 - faces`, `faces = max(1, round(intel / 2))`, every foe rolls (no gate) | wider resist range for a higher-intel foe; intel 1–2 still resists on one face | OK (quick 260927-rsx) | Phase 90 plan 04 (SPELL-12): the faces are `risingResistFaces(depth, intel)`, the half-intel faces up to floor 12 and rising with depth after it, rolled by the one gate `combat.js#foeResistsEffect` (`foeResistsSpell` is its spell name); no spell rolls the RULES-18 `[resist:depth]` extra resist any more.
| `[resist:member-intel]` | resist | a Joiner's own `intel` against a foe's bolt or drain | stat | quick 260928-nrf (user ruling 2026-09-28, Joiners resist: "Yes, same scale"): a smarter Joiner shrugs off more, on the scale the hero and foes use | roll-high: `resisted = roll >= 21 - faces`, `faces = resistFaces(intel)`, every Joiner rolls (no gate); main rng, between the target pick and the damage dice | wider resist range for a higher-intel Joiner; intel 1–2 still resists on one face | OK (quick 260928-nrf) |
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
| `[flee:thief]` | flee | `FLEE_THIEF_BONUS`, `+3` (canon `+5`; quick 260928-nrf, user ruling 2026-09-28) | sub-class | "getting out is the Thief's whole trade" | added to the roll, easier to clear the flee threshold | wider success range | OK |
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
| `[parley:parley-need-mod]` | parley | `PARLEY_NEED_MOD` dial, `parleyNeedModFor` | dial | JSDoc and `docs/DIFFICULTY-RETUNE.md`'s dial table both document "up = harder" | the value was ADDED into a roll-under need (`need = min(9+bonus,17) + PARLEY_NEED_MOD`), so a POSITIVE value made the need bigger — WIDER, i.e. EASIER — the exact opposite of the documented "up = harder." Identity 0 meant no fixture moved | fixed: a positive value now SUBTRACTS from the need, correctly narrowing it | **FIXED (72-07, d2adfd6)** (Finding F5 — no ruling needed; fixed without asking per CONTEXT's "text-backed and local" rule) |

**Fixture outcome (F5):** `test/parity/FIXTURE-INVENTORY.md`'s "### Plan 07" section — measured moved set of **zero** (the dial defaults to 0 in every fixture; `- 0` is byte-identical to `+ 0` regardless of whether a fixture calls parley).

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
| F1 | Member, legacy-ally and summoned-ally strikes apply NONE of the per-target to-hit rules `playerStrike` applies (dozing/stupid floor, `sp.toHit` cap, `sp.fast` narrowing, `sp.magicOnly` untouchability, Philly `slow`) | `engine/combat.js#memberStrike` (~L1799), `#alliesTurn` legacy (~L1522), `#allyTurn` (~L1460) never read `t.asleep`/`t.stupid`/`t.sp.toHit`/`t.sp.fast`/`t.sp.magicOnly`/`t.sp.slow`; every bestiary note ("hittable only on a 4," "only magic touches it") is written for "a strike," not "the hero's strike" | **SIGN BUG (text-backed, local)** — confirmed exercised and local to three functions | **User ruled FIX.** Applied by 72-07 (kept from planner's proposal, verified local — no non-local follow-up was needed). **FIXED (72-07, d2adfd6).** |
| F2 | Acute Hearing's "3 to hit the unseen" (`content/skills.js:51`) has no engine effect — no unseen-foe to-hit mechanic exists anywhere in `engine/derived.js#toHit`/`#foeToHitVs` | `content/skills.js:51` `txt: "never surprised; 3 to hit the unseen"`; a repo-wide read of `toHit`/`foeToHitVs`/`foeToHitBreakdown` shows no `"unseen"`/`invis`-vs-hero to-hit branch that Acute Hearing's clause could be feeding | **SIGN BUG (text-backed, dead claim)** — the bonus never narrows or widens anything; it is a promise the engine has never kept | **User ruled TEXT.** Drop the dead clause; keep "never surprised." Applied by 72-07 (text only, `content/skills.js`). The requested replacement mechanic ("Hear the next room" — squares next to the party holding an encounter show a faint mark before stepping in) is OUT of Phase 72's scope; tracked as **HUD-07 in Phase 78**. **RULED: text (72-07, d2adfd6).** |
| F3 | Shadow's "only a dagger or magic touches it" (`sp.daggerOnly`, `content/bestiary.js:137`) is inert — no engine site reads `sp.daggerOnly` anywhere | `content/bestiary.js:137` `sp: { daggerOnly: true, dark: true, note: "only a dagger or magic touches it" }`; a repo-wide `grep -rn "daggerOnly" engine/` returns zero hits — only content declares the field, nothing consumes it | **SIGN BUG (text-backed, dead claim)** — a written penalty claim the engine never enforces | **User ruled FIX.** Becomes real: a strike on a Shadow needs a dagger or a magic weapon, else need 0 (untouchable), exactly like `magicOnly`, for hero AND members/allies (consistent with F1). A declared canon divergence (the prototype leaves it inert); applied by **72-07**, measured and declared in `test/parity/FIXTURE-INVENTORY.md`. **FIXED (72-07, d2adfd6).** |
| F4 | The frenzy-odds second swing is keyed on `a===1 && R.frenzy` (a Fridgian race check), not on the frenzy having actually fired, so a Fridgian's OTHER second attacks (Barbarian extra attack, haste, Ambidextrous, Last Stand) also take the frenzy odds even when the d8<=5 frenzy trigger never rolled | `engine/combat.js` ~L611 (the need-3 hard-set); the condition tests race+swing-index, not "the frenzy actually triggered" | **NEEDS RULING** — canon behaviour, but text makes no claim either way; a difficulty-affecting design call | **User ruled FIX ("Frenzy swing only").** Frenzy odds apply ONLY to the actual frenzy swing (d8<=5 fired). Applied by **72-05**, same edit as known fix (b). **FIXED (72-05, f71f733).** |
| F5 | `PARLEY_NEED_MOD` is documented "up = harder" (`engine/difficulty.js#parleyNeedModFor` JSDoc; `docs/DIFFICULTY-RETUNE.md`'s dial table) but `engine/combat.js#parley` ADDS it to a roll-under need, so a positive value makes parley EASIER — the same latent inversion as known fix (d) | `engine/difficulty.js` ~L679-684; `engine/combat.js#parley` `need = min(9+bonus,17) + PARLEY_NEED_MOD` where `roll<=need` succeeds | **SIGN BUG (text-backed, local)** — 0 at identity, so zero fixtures move | Fixed by **72-07** without a ruling (text-backed and local, per CONTEXT). `[parley:parley-need-mod]`'s `todo` option is removed from `test/unit/rollDirection-checks.test.js`. **FIXED (72-07, d2adfd6).** |
| — | (No new findings beyond F1–F5 turned up by this audit's wider non-combat sweep.) | The trap/lock/climb/leap/cure/wake/drop/soak/thrown/resist/initiative sites (`## Site inventory` rows 30-46) and every modifier folded into them (`## Modifier ledger`) were checked against their content claims and found correctly signed; no additional text-vs-canon conflict or dead-claim was found | n/a | n/a |
| O1 | The hero's Mirror Self and invisibility item effects also shield party members (`foeToHitVs(state,"member")` reads the hero's `c.mirror`/invis). Mirror Self's text says "you"; the Crystal Staff's text says "party invisible" (a mismatch between the two items' own claimed scope) | `engine/derived.js#foeToHitVs` reads `c.mirror`/invis unconditionally regardless of the `vs` parameter | **OUT OF SCOPE** — not a sign or direction issue (the party-wide shielding is a scope/wording mismatch between two items' texts, not a bonus/penalty pointing the wrong way) | Recorded only, per CONTEXT's not-in-scope list. **RESOLVED (79-02b, user ruling 2026-09-27):** Mirror Self and the Cloak/potion invisibility now shield only the body that carries them; the Crystal Staff stays party-wide through `PARTY_WIDE_ITEM_EFFECTS` (`[foe-vs-member:party-invisibility]`). |
| O2 | The member branch applies the member's own Sidestep AFTER the Weaken cap; the hero branch applies Sidestep BEFORE it (inside `foeToHitVs`). Sidestep plus Weaken gives a member 1 face and the hero 3 faces | `engine/combat.js#foeTurn` member branch (~L2428) vs `engine/derived.js#foeToHitVs` (hero path, ~L1217) | **OUT OF SCOPE** — a magnitude/order asymmetry, not a sign inversion (both terms still move the odds the RIGHT direction; only the combined MAGNITUDE differs by branch) | Recorded only; flagged for a future balance pass, not this phase's ROLL-01 scope. **RESOLVED (79-02b):** the member's Sidestep/Smoke now sit inside `foeToHitVs(state,"member",sheet)`, so both bodies take one order (Sidestep before the Weaken cap). |
| O3 | `needModsClause` (`src/browser/eventNarration.js:87`) prints need deltas in the SAME visual sense (`+`/`−`) on both hero-need lines (`struck`/`strikeMissed`, where a `+` is good news for the hero) and foe-need lines (`foeMissed`/`struckByFoe`/`memberStruck`, where a `+` is BAD news for the hero — the foe's need went up) | `src/browser/eventNarration.js:83-89`; see `## Handoffs → Phase 74` for the worked example | Display-sign, not an engine direction bug | Handed to **Phase 74** per CONTEXT; not fixed here |
| O4 | Every "need a 1"/"hit on a 3" style phrase becomes imprecise once the Phase 73 mirror lands, and is already imprecise under the insult stack today: Mirror Self "foes need a 1 to hit," the Crystal Staff "enemies need a 1," Weaken "they hit on a 3" | `content/spells.js` (Mirror Self), `content/treasure-tables.js` (Crystal Staff), `content/spells.js`/ability text (Weaken) — all state a single roll-under face count that changes meaning after the mirror, and none of them account for the insult stacking one worse | Roll-direction phrasing, not an engine direction bug | Handed to **Phase 79** per CONTEXT; not fixed here |

## Rulings

The `## New findings` table above has four NEEDS-RULING rows: F1, F2, F3, F4 (F5 is a SIGN BUG — text-backed and local — so CONTEXT lets it be fixed without a ruling; it carries no row here). The orchestrator took all four rulings from the user BEFORE this plan executed (`.planning/phases/72-roll-direction-sign-audit-fixes/72-RULINGS.md`, 2026-09-24), specifically so this checkpoint could resolve without a stop. This audit's own sweep of every remaining die-check and modifier source (`## Site inventory`, `## Modifier ledger`) turned up no NEW findings requiring a ruling beyond these four — O1-O4 are OUT OF SCOPE or Phase 74/79 handoffs, not rulings, and F5 is a SIGN BUG, not a ruling. **No new checkpoint fired.**

| Fn | Ruling | Applied by | Date | User's words |
|----|--------|------------|------|------------------------|
| F1 | **fix**: party members, summoned allies and legacy allies obey the same per-target to-hit rules as the hero (dozing/stupid ≥ floor, `sp.toHit` "hittable only on a 4", `sp.fast` "strike one higher", `sp.magicOnly` "only magic touches it" — a member needs a magic weapon, Philly `slow` if it applies to the attacker's roll). | 72-07 (local, in `memberStrike` / `alliesTurn` legacy / `allyTurn`). If it proves non-local, a `--gaps` follow-up is recorded instead. | 2026-09-24 | "Fix (Recommended)" |
| F2 | **text**: drop the dead "3 to hit the unseen" clause from Acute Hearing (`content/skills.js` ~L51). Acute Hearing keeps "never surprised". The replacement mechanic, **"Hear the next room"** (squares next to the party that hold an encounter show a faint "something's there" mark before stepping in), is a new map feature OUT of Phase 72's scope — tracked as **HUD-07 in Phase 78**. Phase 72 only removes the dead clause. | 72-07 (text only) | 2026-09-24 | "Drop it, but replace it with some other mechanic" → chose "Hear the next room" |
| F3 | **fix**: the Shadow's "only a dagger or magic touches it" (`sp.daggerOnly`) becomes real. A strike on a Shadow needs a dagger or a magic weapon, otherwise need 0 (untouchable), exactly like the `magicOnly` rule, for the hero AND members/allies (consistent with F1). A declared canon divergence (the prototype leaves `daggerOnly` inert); measure, declare and regenerate moved fixtures. | 72-07 | 2026-09-24 | "Fix (Recommended)" |
| F4 | **fix**: the frenzy odds (normal to-hit narrowed by one) apply ONLY to the actual frenzy swing, i.e. when the d8 ≤ 5 frenzy fired. A Fridgian's other second attacks (Barbarian extra attack, haste, Ambidextrous, Last Stand) use the normal to-hit. | 72-05 (same edit as fix (b)) | 2026-09-24 | "Frenzy swing only (Recommended)" |

Each finding's `## New findings` Proposed disposition row already reflects the ruling above (both were written from the same source, `72-RULINGS.md`); no further edit to that table is needed.

**F4 applied (2026-09-24):** landed by 72-05 in the same edit as known fix (b) — `engine/combat.js#playerStrike` gates the narrowed frenzy need on a local `frenzyFired` boolean captured at the trigger draw, not the Fridgian race flag, so a Fridgian's non-frenzy second attack (Barbarian, haste, Ambidextrous, Last Stand) uses the normal to-hit; `test/unit/rollDirection.test.js`'s two frenzy rows are green.

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

**Phase 73 close-out addendum (ROLL-05, 73-10).** Every roll-carrying event now carries a fixed field contract Phase 74 builds directly on top of:

- **The triple:** `roll` (the mirrored, high-is-good face), `atLeast` (the lowest winning face — named `atLeast` rather than `target`, since `target` already names the victim on about 48 event pushes) and `dieN` (sides on the check die). The old roll-under `need` field is gone from every event (greenfield, no dual fields).
- **`mods`** (renamed from `needMods`): `{ name, delta }` entries, values UNCHANGED and still signed for the ROLLER (`+1` face = `+1` to hit, whichever side is rolling). Phase 74's own display-sign pass (the `needModsClause` ambiguity documented above) is the ONE place that re-signs a delta from the player's point of view — negating it on a foe-roll line so a `+` always reads as good news for the hero, never touching the stored `mods` value itself.
- **`rolls`:** an array of faces when one event reports several draws of the same check (climb segments, the eight wandering-wake hours).
- **`critAtLeast`:** present when a critical came from the die itself (the weapon crit, Stealth, Ninja, a foe's natural best face, the Soldier's extra crit face) — the top-face threshold a landed roll had to clear to crit.
- **`auto: true`:** the to-hit comparison was bypassed entirely (an auto-hit opener or a forced-crit ability); the roll is still reported for narration.
- **Nested `soak` / `bag`:** a second check reported on the SAME event, `{ roll, atLeast, dieN }` (a failed armor soak on a landed blow; the bag-upgrade gate on a loot drop).
- **The faces-returning derived functions** (`toHit`, `foeToHitVs`, `memberToHit`, `fleeBreakdown`, `parley`'s need) are UNCHANGED — they still return a count of winning faces, not a threshold. Phase 74's surfaces convert a faces count `f` on a dN to a display range the same way `atLeastFor` does: the range is `(N + 1 - f)–N` (a single face when `f === 1`, "nothing" when `f <= 0`). `src/browser/rollRange.js`'s `rangeText(atLeast, dieN)`/`rollVsText(roll, atLeast, dieN)` (73-03) is the ONE place Phase 73's event-driven consumers write that range, and Phase 74 extends the same module with the player-side signed-modifier formatter rather than re-deriving the range math anywhere else.

## Handoffs → Phase 79 (roll-direction phrasing)

Every player-facing string this audit saw that encodes a roll-under face count, and will read wrong (or misleadingly incomplete) once Phase 73's roll-high mirror lands and/or once the insult stack is accounted for:

- Mirror Self: "foes need a 1 to hit" (`content/spells.js`) — becomes "foes need a 20" after the mirror; also silently becomes "a 1–2" under an insult today (and "19–20" after the mirror) with no text acknowledging the insult stacks on top.
- The Crystal Staff: "enemies need a 1" (`content/treasure-tables.js`) — same mirror and insult-stacking gaps as Mirror Self.
- Weaken: "they hit on a 3" / "they need a 3 to hit" (spell/ability text) — becomes "hit on an 18, 19 or 20" after the mirror.
- Acute Hearing (post-F2 text edit, `content/skills.js`): whatever replacement text Phase 78's "Hear the next room" mechanic uses should be written with the mirror in mind from the start, since it lands after Phase 73.
- Every `sp.toHit`/`sp.fast`/`hard-to-hit` bestiary note phrased as "hittable only on a 4" or similar (Zit, Drat, Stink Bug) needs a mirror-aware rewrite pass. **The Skeleton's own note is DONE** — 72-06 already wrote it digit-free ("kill it twice; your best roll shatters it"), so it needs no Phase 79 pass. The Shadow's "only a dagger or magic touches it" (F3, landed 72-07) is also already digit-free — a targeting restriction, not a face count — so it needs no Phase 79 pass either.
- The device-trigger class of text: any weapon/armor/ability description that states a bare signed number ("−2 to hit," "+1 to hit") without a "roll under" or "roll over" cue is a phrasing risk under the mirror even where the number itself is correct today (see `## The device trigger`).
- Smoke's own text (`content/abilities.js:56`, `content/skills.js:53`), updated by known fix (a) to "foes need a natural 1 to find you (a 1–2 if you insulted them)" — Phase 79 re-phrases this to the roll-high reading once the mirror lands; it is written roll-under for now per CONTEXT.

**Phase 73 close-out addendum (ROLL-05, 73-10).** The comment sweep (Task 1) confirmed every remaining player-facing roll-direction string is already on this list above, plus the one Task 1 was explicitly told not to touch:

- The Lockpicks item text, `engine/items.js#rollTreasureItem`: **"1–5 on d10 against any lock"** — authored prose describing a game rule to the player (site 47 in `## Site inventory`; NOT A CHECK, a treasure-kind selection draw), left untouched by 73-01/73-10 per CONTEXT's "authored player-facing prose is untouched and handed to Phase 79" rule. Reads correctly TODAY under the roll-under convention it was written in; Phase 79 rewrites it to the roll-high reading alongside every other string on this list.
- No other player-facing string surfaced during the Phase 73 comment sweep — every comment this phase's plans touched was engine-internal (JSDoc, inline reasoning), never a string literal shown to the player; content/weapons.js's own comment block (the `need`/`crit` field documentation) was rewritten to the current faces/roll-high reading directly by 73-10 (it is a code comment, not authored player-facing copy).

## Bot readout

The Phase 72 BEFORE/AFTER bot readouts live in `docs/DIFFICULTY-RETUNE.md` under the H2 `## v2.1 roll-direction pass (Phase 72) — bot readouts`, inserted immediately before `## v1.2 retune (Phase 27) — TUNE-05..07` (which stays the ledger's last H2 per `test/unit/difficulty-retune-ledger.test.js`'s guard). 72-01 recorded the BEFORE readout on the untouched engine at commit `9197002`; 72-07 recorded the AFTER readout at commit `d2adfd6`, once every known fix (a)-(d) and every ruled finding (F1-F5) had landed.

**Headline (200 seeds, solo bot, `--start-depth=1`):** death-depth p50 unchanged at 7 (min 1→2, p90 12→13, max 30→40 — tail noise); reach ≥5 80.5%→80.6%, ≥10 23.6%→24.6%, ≥20 1.1%→1.1% (flat); stuck runs 26→25 of 200; per-floor survival keeps its PASS verdict for floors 1-12 unchanged. The curve is statistically flat — see `docs/DIFFICULTY-RETUNE.md`'s own `### Reading (BEFORE → AFTER)` for the full table and the per-fix reachability reasoning (F1 is inert in this solo-bot readout since it never populates a party; F3's Shadow death-share moving 1→3 of 200 is the one line plausibly touched by a real mechanical change; F5 and (d) are literal no-ops at identity). **No difficulty retune is owed by this phase.**

## Phase 73 mirror verdicts (ROLL-05)

**Recorded:** 2026-09-25 (73-03). Every site in `## Site inventory` above, plus the not-a-check appendix's chargen/tool/premium draws, gets a mirror verdict for Phase 73's engine switch to roll-high. **The rule (CONTEXT Area 1):** high is good for whoever rolls, and a 1 is always the worst face. Only a CHECK whose winning faces sit at the BOTTOM of the die today gets mirrored. A check already read high (flee, initiative, cooking `>= 4`, the chest scroll `>= 3`, the climb fall-avoid `> 2`, the Humans parley payout `=== 6`) stays as it is. A mishap gate that fires on a natural 1 (the Apprentice/doubled backfire, the vapor kill-save, the Sorcerer spell-loss, the rare d20 travel murder check) stays on the 1 — "1 is always the worst face" is the same convention either way, so these need no mirror. SELECTION and AMOUNT draws (table picks, damage, durations) are not checks and are untouched. A roll with no obvious roller (a loot drop, the bag-upgrade gate, the wandering wake, the rare d20 travel event) is read from the HERO's side, so a high roll is good news for the hero; that is why the loot/bag drops mirror (good news moves to the top) while the wandering wake does not (the bad news already sits at the bottom, oriented against the hero).

**The mechanism:** `engine/dice.js#rollCheck` (73-01) draws exactly the same `rng.d(N)` call, in the same order, as today's engine — it changes only how the draw is READ. A raw draw `r` on an N-sided die becomes `roll = N + 1 - r`; a roll-under `need` of `k` winning faces becomes a roll-high `atLeast = N + 1 - k` (`atLeastFor(faces, N) = N + 1 - faces`, 73-01). Because `r` is unchanged and every comparison flips consistently, every seed resolves identically — the parity suite stays byte-identical, and the 200-seed bot readout (`## Bot readout` above) must match unchanged once every site below has been converted.

### Verdict per site

The `#` column matches `## Site inventory`'s numbering; `3b` and `A1`-`A3` are new rows this phase's mirror scope adds (the startCombat tier-bleed gate, and three of the appendix's selection draws called out for the corrections below). `Status` reads `done <plan>` on every row (73-10) now that every conversion plan (the `Plan` column) has landed; the one exception is row 2 (Tracking), `n/a — removed (Phase 38)`, since it was never a Phase 73 conversion target.

| # | Site | Verdict | Roll-high check | Event(s) carrying roll/atLeast/dieN | Plan | Status |
|---|---|---|---|---|---|---|
| 1 | combat.js#resolveInitiative 2×d20 | ALREADY HIGH (contested, `mine >= theirs`, the hero wins ties) | both draws tagged already-high | combatJoined keeps mine/theirs (contested, no atLeast) | 73-08 | done 73-08 |
| 2 | Tracking | REMOVED (Phase 38) | — | — | — | n/a — removed (Phase 38) |
| 3 | combat.js#startCombat foe count d4 + difficulty.js#foeCountFor | NOT A CHECK (selection: the count table) | draws and the `firstRoll <= 2` dispatch tagged selection | — | 73-01 / 73-08 | done 73-01 / 73-08 |
| 3b | combat.js#startCombat tier bleed `rng.d(4) <= tierSpreadFor()` | MIRROR (hero-side: a lower-tier foe is good news) | rollCheck(rng, 4, atLeastFor(tierSpreadFor(), 4)) | none | 73-08 | done 73-08 |
| 4 | Con Artist weak-foe flee d6 `<= 4` | MIRROR | rollCheck(rng, 6, atLeastFor(4, 6)) = 3–6 | foeFled {reason: "conArtist"} | 73-08 | done 73-08 |
| 5 | Court Mage boredom d12 `<= 2` | MIRROR | rollCheck(rng, 12, atLeastFor(2, 12)) = 11–12 | foeBored | 73-08 | done 73-08 |
| 6 | fight phobia Hardiness shrug d2 `=== 1` | MIRROR | rollCheck(rng, 2, atLeastFor(1, 2)) = 2 | phobiaAfraid (when the shrug die was drawn and failed) | 73-08 | done 73-08 |
| 7 | playerStrike frenzy trigger d8 `<= 5` | MIRROR | rollCheck(rng, 8, atLeastFor(5, 8)) = 4–8 | frenzy | 73-04 | done 73-04 |
| 8 | playerStrike strike die (Philly two dice) | MIRROR | rollCheck(rng, dieN, atLeastFor(faces, dieN)); Philly keeps Math.max of two mirrored faces | struck / strikeMissed | 73-04 | done 73-04 |
| 9 | Stealth crit `<= 2` | MIRROR | roll >= atLeastFor(2, dieN) | struck.critAtLeast | 73-04 | done 73-04 |
| 10 | Ninja crit `<= 2` | MIRROR | roll >= atLeastFor(2, dieN) | struck.critAtLeast | 73-04 | done 73-04 |
| 11 | weapon crit `<= weaponCrit(c)` | MIRROR | roll >= atLeastFor(weaponCrit(c), dieN) | struck.critAtLeast | 73-04 | done 73-04 |
| 12 | killFoe loot drop d20 `<= 2 + f.lvl` | MIRROR (hero-side good news) | rollCheck(rng, 20, atLeastFor(2 + f.lvl, 20)) | lootDropped (kill drop) | 73-08 | done 73-08 |
| 13 | killFoe bag drop d20 `<= BAG_DROP_UNDER` | MIRROR; the constant is renamed BAG_DROP_FACES | rollCheck(rng, 20, atLeastFor(BAG_DROP_FACES, 20)) | lootDropped.bag (nested) | 73-08 | done 73-08 |
| 14 | killFoe cooking d6 `>= 4` | ALREADY HIGH | tagged already-high | — | 73-08 | done 73-08 |
| 15 | pursuitStrike | MIRROR | rollCheck(rng, foeDie, atLeastFor(faces, dieN)) | foeMissed / struckByFoe | 73-07 | done 73-07 |
| 16 | pursuit Soldier crit-taken | MIRROR | roll >= atLeastFor(Soldier ? 2 : 1, dieN) | struckByFoe.critAtLeast | 73-07 | done 73-07 |
| 17 | flee d20 `roll + bonus >= need` | ALREADY HIGH; the bonus folds into the threshold: roll >= need - bonus | raw draw tagged already-high | fleeRolled {roll, atLeast, dieN, mods} (total removed) | 73-08 | done 73-08 |
| 18 | parley d20 `<= min(9+bonus,17) - dial` | MIRROR | rollCheck(rng, 20, atLeastFor(faces, 20)) | parleyRolled | 73-08 | done 73-08 |
| 19 | parley Humans payout d6 `=== 6` | ALREADY HIGH | tagged already-high | — | 73-08 | done 73-08 |
| 20 | allyTurn summon strike | MIRROR | rollCheck on STRIKE_DICE[lvl-1]; Philly Math.max | allyStruck / allyMissed | 73-05 | done 73-05 |
| 21 | alliesTurn legacy strike | MIRROR | same | allyStruck / allyMissed | 73-05 | done 73-05 |
| 22 | memberStrike (+ member crit on the best face) | MIRROR | rollCheck(rng, dieN, atLeastFor(faces, dieN)); crit isBestFace | allyStruck / allyMissed | 73-05 | done 73-05 |
| 23 | allyCast thrown `roll - bonus <= need` | MIRROR, bonus folded | rollCheck(rng, dieN, atLeastFor(need + bonus, dieN)) | allyCast | 73-05 | done 73-05 |
| 24 | applyFoeDamageToPlayer hero armor soak d20 `<= soakAr` | MIRROR | rollCheck(rng, 20, atLeastFor(soakAr, 20)) | armorSoaked (success); struckByFoe.soak (failure) | 73-07 | done 73-07 |
| 25 | foeTurn ability gate d6 `<= 4` | MIRROR (the foe is the roller; using its ability is its success) | rollCheck(rng, 6, atLeastFor(4, 6)) = 3–6 | foeCast | 73-08 | done 73-08 |
| 26 | foeTurn member branch | MIRROR | rollCheck(rng, mDieN, atLeastFor(faces, mDieN)) | foeMissed {member} / memberStruck | 73-07 | done 73-07 |
| 27 | member crit natural best | MIRROR | roll === dieN (isBestFace) | memberStruck.critAtLeast | 73-07 | done 73-07 |
| 28 | foeTurn hero branch | MIRROR | rollCheck(rng, dieN, atLeastFor(faces, dieN)) | foeMissed / struckByFoe | 73-07 | done 73-07 |
| 29 | hero Soldier crit-taken | MIRROR | roll >= atLeastFor(Soldier ? 2 : 1, dieN) | struckByFoe.critAtLeast | 73-07 | done 73-07 |
| 30 | springTrap dodge d20 `<= nimble` | MIRROR | rollCheck(rng, 20, atLeastFor(nimble, 20)) | trapAvoided (success); trapSprung, trapDisarmed (failure) | 73-09 | done 73-09 |
| 31 | openChest scroll d6 `>= 3` | ALREADY HIGH | tagged already-high | — | 73-09 | done 73-09 |
| 32 | openChest tiered lock d10 | MIRROR | rollCheck(rng, 10, atLeastFor(need, 10)) | chestLockRolled | 73-09 | done 73-09 |
| 33 | openChest bare lock d20 | MIRROR | rollCheck(rng, 20, atLeastFor(need, 20)) | chestLockRolled | 73-09 | done 73-09 |
| 34 | foeDamage.js natural-armor soak d20 `<= sp.ar` | MIRROR | rollCheck(rng, 20, atLeastFor(foe.sp.ar, 20)) | foeArmorSoaked (success); struck.soak, allyStruck.soak (failure) | 73-04 | done 73-04 |
| 35 | castSpell Apprentice backfire d8 `=== 1` | MISHAP ON 1 | tagged mishap-on-1 | spellBackfired {roll: 1, atLeast: 2, dieN: 8} | 73-06 | done 73-06 |
| 36 | castSpell doubled backfire d8 `=== 1` | MISHAP ON 1 | tagged mishap-on-1 | summonBackfired {roll: 1, atLeast: 2, dieN: 8} | 73-06 | done 73-06 |
| 37 | castSpell thrown `roll - bonus <= target` | MIRROR, bonus folded | rollCheck(rng, dieN, atLeastFor(target + bonus, dieN)) | spellThrown | 73-05 | done 73-05 |
| 38 | castSpell vapor roll d6 | NOT A CHECK (selection: the outcome table) | tagged selection | vaporRolled keeps its table roll | 73-06 | done 73-06 |
| 39 | castSpell vapor kill-save d10 `!== 1` | MISHAP ON 1 (the foe's save; a 1 fails) | tagged mishap-on-1 | none | 73-06 | done 73-06 |
| 40 | movement climb d10 + penalties `<= success` | MIRROR, penalties folded | rollCheck(rng, 10, atLeastFor(success - penalty, 10)) per segment | climbedOver / fellClimbing (roll and rolls) | 73-09 | done 73-09 |
| 41 | climb fall-avoid d20 `> 2` | ALREADY HIGH | tagged already-high | — (hurt) | 73-09 | done 73-09 |
| 42 | movement leap d10 + penalties, fail `> need` | MIRROR, penalties folded | rollCheck(rng, 10, atLeastFor(need - penalty, 10)) | leaptOver / fellInGorge | 73-09 | done 73-09 |
| 43 | newDay affliction cure d20 `<= 10 (+4)` | MIRROR | rollCheck(rng, 20, atLeastFor(10 + hardiness, 20)) | afflictionCured / afflictionLingers | 73-09 | done 73-09 |
| 44 | newDay wandering wake d20 `<= wakeOn`, ×8 | ALREADY ORIENTED (bad news sits at the bottom): the hero's quiet check is roll >= wakeOn + 1, no mirror | raw draws tagged already-high | wanderingMonster {rolls, atLeast, dieN} | 73-09 | done 73-09 |
| 45 | cutthroatMurderCheck d20 `=== 1` (the rare d20 travel event) | MISHAP ON 1 (bad news for the hero on the 1) | tagged mishap-on-1 | joinerMurdered {roll: 1, atLeast: 2, dieN: 20} | 73-09 | done 73-09 |
| 46 | derived.js#resistRoll d20 `< intel` | MIRROR | rollCheck(rng, 20, atLeastFor(intel - 1, 20)) = 22 - intel | spellResisted, resistFailed, heroResisted, heroResistFailed, allySpellMissed {resisted: true} | 73-06 | done 73-06 |
| 47 | items.js#rollTreasureItem `rng.d(12) === 1` | NOT A CHECK (selection: the treasure is Lockpicks; correction below) | tagged selection | — | 73-01 | done 73-01 |
| 48 | character.js#checkLevel Sorcerer spell loss d8 `=== 1` | MISHAP ON 1 | tagged mishap-on-1 | none (no event today) | 73-01 | done 73-01 |
| A1 | items.js tool-loot gate `toolRng.d(8) === 1`, weighted tool pick, and the r<=3/5/7/9 category ladder | NOT A CHECK (selection) | every draw and ladder line tagged selection | — | 73-01 | done 73-01 |
| A2 | economy.js premium `rng.d(2) === 1` | NOT A CHECK (selection) | tagged selection | — | 73-01 | done 73-01 |
| A3 | every other appendix draw | NOT A CHECK (selection or amount, per the appendix) | tagged | selection events keep a bare table roll | per file | done per file |

### Event fields (Phase 73)

Every roll-carrying event's field contract, and its outcome rule for `test/parity/roll-high-invariant.test.js`'s runtime check that every roll-carrying event satisfies `1 <= roll <= dieN` and its success/failure equals `roll >= atLeast`.

- Every roll-carrying event carries `roll` (the high-is-good face), `atLeast` (the lowest winning face — the threshold gets its own name because `target` already names the victim on about 48 event pushes) and `dieN`. `need` is removed from every roll-carrying event. Events that are not rolls keep their own `need` (hunger's ration count, the spell-level gates).
- `mods` replaces `needMods`: `{ name, delta }` with the same values, signed for the ROLLER (+1 face = +1 to hit). Phase 74 re-signs them from the player's side.
- `rolls`: an array of faces when one event reports several draws of the same check (climb segments, the eight wake hours).
- `critAtLeast`: present when a critical came from the die (weapon crit, Stealth, Ninja, a foe's natural best, the Soldier's extra face).
- `auto: true`: the to-hit comparison was bypassed (an auto-hit opener or ability); the roll is still reported.
- Nested `soak` / `bag`: a second check reported on the same event, `{ roll, atLeast, dieN }` (a failed armor soak on a landed blow; the bag-upgrade gate on a loot drop).

| Event | Roller | Outcome rule | Plan |
|---|---|---|---|
| struck / strikeMissed | hero | SUCCESS on struck, FAILURE on strikeMissed | 73-04 |
| allyStruck / allyMissed | member / summon / legacy ally | SUCCESS on allyStruck, FAILURE on allyMissed | 73-05 |
| memberStruck | member (foe's roll) | SUCCESS | 73-07 |
| foeMissed / struckByFoe | foe vs hero or member | SUCCESS on struckByFoe, FAILURE on foeMissed | 73-07 |
| frenzy | hero (Fridgian trigger) | SUCCESS | 73-04 |
| foeShattered | hero/member/ally (shatter-on-best) | SUCCESS | 73-04 |
| foeArmorSoaked / struck.soak / allyStruck.soak | foe (nested soak) | SUCCESS on foeArmorSoaked, FAILURE on a nested soak | 73-04 |
| armorSoaked / struckByFoe.soak | hero (nested soak) | SUCCESS on armorSoaked, FAILURE on a nested soak | 73-07 |
| trapAvoided / trapSprung / trapDisarmed | hero | SUCCESS on trapAvoided, FAILURE on trapSprung/trapDisarmed | 73-09 |
| leaptOver / fellInGorge | hero | SUCCESS on leaptOver, FAILURE on fellInGorge | 73-09 |
| climbedOver / fellClimbing | hero | SUCCESS on climbedOver, FAILURE on fellClimbing | 73-09 |
| afflictionCured / afflictionLingers | hero | SUCCESS on afflictionCured, FAILURE on afflictionLingers | 73-09 |
| foeFled | foe (hero-side good news) | SUCCESS | 73-08 |
| foeBored | foe (hero-side good news) | SUCCESS | 73-08 |
| lootDropped (+ nested bag) | n/a (hero-side good news) | SUCCESS; a nested bag SUCCESS when the dropped item is a bag | 73-08 |
| foeCast | foe (its own success) | SUCCESS | 73-08 |
| spellResisted / resistFailed | resistor (hero or foe) | SUCCESS on spellResisted, FAILURE on resistFailed | 73-06 |
| heroResisted / heroResistFailed | hero (resisting a foe's effect) | SUCCESS on heroResisted, FAILURE on heroResistFailed | 73-06 |
| allySpellMissed {resisted} | member (resisted by a foe) | SUCCESS when resisted is true, else FAILURE | 73-06 |
| spellThrown / spellMissed (same target) | hero | succeeds unless spellMissed for the same target follows in the same action before the next event of the same type | 73-05 |
| allyCast / allySpellMissed {resisted: false} | member (MU) | succeeds unless allySpellMissed{resisted:false} follows the same way | 73-05 |
| fleeRolled / fleeFailed | hero | succeeds unless fleeFailed follows in the same action before the next fleeRolled | 73-08 |
| parleyRolled / parleyFailed | hero | succeeds unless parleyFailed follows in the same action before the next parleyRolled | 73-08 |
| chestLockRolled | hero | SUCCESS when `opened` | 73-09 |
| wanderingMonster {rolls, atLeast, dieN} | n/a (hero-side bad news, already oriented) | `hours` equals the count of `rolls` below `atLeast` | 73-09 |
| phobiaAfraid | hero (Hardiness shrug failed) | FAILURE | 73-08 |
| spellBackfired / summonBackfired | hero (mishap on 1) | FAILURE | 73-06 |
| joinerMurdered | n/a (mishap on 1, bad news for the hero) | FAILURE | 73-09 |

### Corrections to the Phase 72 inventory

- **Site 47 correction (confirmed against `engine/items.js:249-251` at this plan's HEAD):** `rollTreasureItem`'s `if (!hasPicks(c || {}) && rng.d(12) === 1) { return { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" }; }` is a treasure-kind SELECTION — the draw decides WHICH item drops (Lockpicks), not whether an item is worn down. There is no lockpick-wear mechanic anywhere in the engine; site 47's earlier "lockpick wear" label was a misreading of this gate. CONTEXT's outcome for it (stays on the 1, a mishap-shaped gate in narration) holds either way, because the item text itself ("1–5 on d10 against any lock") is authored prose carried forward to Phase 79 (ROLL-04), not this phase.
- **The appendix's "tier-drop gate" (startCombat) is a binary good-news gate for the hero**, so it is classified as a CHECK and mirrored (row 3b above: `rng.d(4) <= tierSpreadFor()`, a lower-tier foe is good news for the hero); the foe COUNT draw (row 3, the d4 table pick that decides how many foes appear) stays a SELECTION — the two draws share a function (`startCombat`) but are different mechanics.
- **A player-facing roll-under string lives in `engine/items.js`** (the Lockpicks item text "1–5 on d10 against any lock", the same string site 47 returns). It is authored prose describing a game rule to the player, not an engine comparison this phase converts, so it goes to Phase 79 (ROLL-04) alongside every other roll-direction phrasing fix, not here.

### Phase 73 draw inventory

Copied live from `test/unit/roll-high-guard.test.js`'s `DRAW_INVENTORY` (73-10, once `ALL_ENFORCED` was true) — the count of `.d(` occurrences per tagged kind, per `engine/*.js` file. `rollCheck` counts calls to the one roll-high check helper (`engine/dice.js#rollCheck`); `primitive` is the raw `rng.d(N)` draw, allowed only inside `engine/dice.js` itself (`rollDice`'s loop and `rollCheck`'s own draw). A row of all zeros means the file holds no `.d(` calls at all (still `ENFORCED`, contributing an empty inventory the guard still checks on every run).

| File | rollCheck | amount | selection | mishap-on-1 | already-high | primitive |
|---|---|---|---|---|---|---|
| engine/abilities.js | 0 | 2 | 0 | 0 | 0 | 0 |
| engine/character.js | 0 | 3 | 13 | 1 | 0 | 0 |
| engine/combat.js | 22 | 17 | 3 | 0 | 5 | 0 |
| engine/derived.js | 1 | 0 | 0 | 0 | 0 | 0 |
| engine/dice.js | 0 | 0 | 0 | 0 | 0 | 2 |
| engine/economy.js | 0 | 0 | 1 | 0 | 0 | 0 |
| engine/encounters.js | 3 | 10 | 13 | 0 | 1 | 0 |
| engine/maze.js | 0 | 1 | 0 | 0 | 0 | 0 |
| engine/difficulty.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/items.js | 0 | 7 | 9 | 0 | 0 | 0 |
| engine/actions.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/death.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/effects.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/engine.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/events.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/foeAbilities.js | 0 | 1 | 0 | 0 | 0 | 0 |
| engine/foeDamage.js | 1 | 0 | 0 | 0 | 0 | 0 |
| engine/magic.js | 1 | 17 | 2 | 3 | 0 | 0 |
| engine/movement.js | 3 | 7 | 4 | 1 | 2 | 0 |
| engine/phobias.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/records.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/rng.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/saveState.js | 0 | 0 | 0 | 0 | 0 | 0 |
| engine/state.js | 0 | 0 | 0 | 0 | 0 | 0 |

**Totals:** 31 `rollCheck` calls, 65 `amount` draws, 45 `selection` draws, 5 `mishap-on-1` draws, 8 `already-high` draws, 2 `primitive` draws — 156 `.d(` occurrences across the 24 `ENFORCED` files, every one tagged or routed through `rollCheck`, with zero shape/mirror/tag violations (`test/unit/roll-high-guard.test.js`, `ALL_ENFORCED = true`).

## Phase 74 display closure (ROLL-02/03)

**Closed:** 2026-09-25 (74-01 through 74-08). Every roll, range and modifier the player sees is now a direct, honest read of the engine's own roll-high numbers, closing ROADMAP Phase 74 success criteria 1-3 and this ledger's own `## Handoffs → Phase 74` item (O3, `needModsClause`) and `## The device trigger`.

### (a) The sign rule

Every displayed modifier is signed from the PLAYER's side: `+` is always better for the player, `−` (U+2212) is always worse — on EVERY surface, including a foe's own line. The engine's `mods` deltas stay signed for the ROLLER (unchanged, per Phase 73's field contract); `src/browser/rollRange.js`'s `playerDelta(delta, roller)` is the ONE place a delta is flipped, keyed on an explicit roller:

| Roller | `playerDelta` | Example |
|---|---|---|
| `ROLLERS.you` (the hero's own roll) | passthrough, unchanged | `afraid −3` (a real penalty reads as a real minus) |
| `ROLLERS.ally` (a party member's/summon's own roll) | passthrough, unchanged | same convention as `you` |
| `ROLLERS.foe` (a foe's roll against the hero or a member) | negated | `Sidestep +2` (the engine's stored delta is `−2`, favorable to the hero, so it negates to a player-signed `+2`) |

### (b) The non-event ("right now") surfaces

`src/browser/rollOdds.js` (74-04) is the ONE module every non-event odds reading is computed through — `heroHitOdds`, `heroHitOddsVs`, `foeHitOddsVs`, `fleeOdds` — each a pure read of the engine's own derived functions (`engine/derived.js#toHit`/`afraidNeed`/`strikeDie`/`foeDie`/`fleeBreakdown`, and 74-01's pure extraction `targetStrikeFaces`/`heroStrikeFacesVs`/`foeSwingVsHero`), formatted only through `rollRange.js`. Zero fixtures moved for 74-01's extraction (the same arithmetic, same order, pulled into three named functions `engine/combat.js` now calls instead of inlining).

One example per consuming surface:
- The hero sheet's TO HIT row (`heroTab.js`, 74-04): `heroHitOdds(state).text` — "16–20 (d20)" for a level-1 Human Fighter on a Club.
- The combat menu's STRIKE sub (`combatMenu.js`, 74-04): filled from the SAME sheet value, so the two can never disagree.
- Foe details' two-way odds line (`foeDetails.js`, 74-06): "You hit it on 17–20 (d20) · it hits you on 16–20 (d20; Sidestep +2, insulted −1)".
- The hero condition chips' measured effect (`conditionEffects.js`, 74-07): "−3 to hit (now 19–20)" for Afraid, diffed against a what-if state with the condition dropped — never a restated formula.
- Item/loot/store/find comparisons (`upgradeWhy.js`/`viewModels.js#lootCompare`, 74-05): "−2 to hit, worse than your Club".

### (c) The O3 / needModsClause handoff — CLOSED by 74-03

`needModsClause` (the old module-private formatter this ledger's `## Handoffs → Phase 74` flagged) is deleted outright. Every Oracle/rail roll line (`eventNarration.js`/`narrationLines.js`) now imports and calls `rollRange.js`'s shared `modsClause`/`modsText` directly with an explicit roller, so a foe-need `+` and a hero-need `+` can never again mean opposite things on screen.

### (d) The device trigger — CLOSED by 74-05

The dropped heavy weapon's "−2 to hit" now reads "−2 to hit, worse than your Club" everywhere it appears (`lootCompare`, `EVENT_NARRATION.purchaseBagged`, `LINE_FOR.purchaseBagged`) — the exact case that opened this ledger's `## The device trigger` section.

### (e) The consistency guard

`test/unit/roll-sign-consistency.test.js` (74-08) is the build-failing guard: 11 tests drive the real engine (`playerStrike`/`foeTurn`/`flee`) and assert the SAME player-signed token appears on every surface for insulted/Guard/Sidestep, Weaken, Battle Roar, Elven, afraid, a weapon comparison, flee and heights; a range-format pin for the level-1 class ranges; and a source scan proving exactly one formatter (`rollRange.js`) exists in `src/browser/`. Sanity-checked with a temporary roller flip on `foeMissed` (4 of 11 tests failed, then reverted byte-identical) — the guard has teeth.

### (f) Hooks left for Phase 77 and Phase 78

- Phase 77 (CMBUI-13 effect indicators): reuse `rollRange.js`'s formatter and `rollOdds.js` directly; `conditionEffects.js`'s `WHAT_IF` map and `foeDetails.js`'s `foeConditionEffect` are both designed to take a new ability-timer key (Smoke/Sidestep/Battle Roar) as one more entry, not a second what-if mechanism.
- Phase 78 (the climb card): reuses this phase's range format (`rangeText`/`facesRangeText`) for any climb/leap odds the card decides to show.

### (g) What stays for Phase 79

Beyond this ledger's existing `## Handoffs → Phase 79` list (Mirror Self/Crystal Staff/Weaken prose, the Lockpicks item text, Smoke's own text), Phase 74 leaves these authored-prose sites untouched, on purpose (this phase changes computed NUMBERS and SIGNS, never authored TEXT):
- The Smoke and Battle Roar ability/spell narration prose (`eventNarration.js#battleRoarRaised`, `content/abilities.js`) — "for two rounds they all need two better to hit anyone on your side."
- The "They need two better" chip and narration lines for the Anklet/Cloak of Invisibility (`eventNarration.js`/`narrationLines.js`'s `unseen` lines, `content/treasure-tables.js`).
- The authored `CONDITION_EXPLAIN` sentences (mazeworld.html's classic script) and `FOE_CONDITION_DESC` sentences (`src/browser/foeConditions.js`) — every chip's own one-line description, distinct from this phase's computed effect clause that now precedes it.
- Every bestiary note phrased as a face count ("hittable only on a 4," etc.) not already flagged in the existing Phase 79 list.

## Phase 75.1 check sites (RULES-09, RULES-10)

Two new derived-stream check sites join the roll-high engine (Phase 73's
convention: `roll = (N+1) - r`, `atLeast` is the winning threshold),
closing this phase's own two new mechanics. Neither reads a mid-check
modifier — both are plain, unmodified `rollCheck` draws.

| Site | Draw | atLeast | Fumble face | Stream |
|---|---|---|---|---|
| Pilfer steady hands (`engine/items.js#pilferFumbleRng`, 75.1-01) | d20 | 2 (any face but a 1 succeeds) | 1 | `pilferFumble` |
| Scroll read (`engine/magic.js#scrollReadRng`, 75.1-06) | d20 | `22 − intel` (reading faces `intel − 1`) | below `ceil(atLeast / 2)` | `scrollRead` |

- **Pilfer steady hands.** `rollCheck(fumbleRng, 20, atLeastFor(19, 20))` — a
  roll of exactly 1 is the only failing face (`atLeast 2`); the d10 blast
  that follows a fumble draws from the SAME `pilferFumble` stream,
  sequentially, never the main rng.
- **Scroll read.** `rollCheck(scrollRng, 20, bands.atLeast)` where
  `bands.atLeast = 22 − intel` (so the winning faces are `intel − 1` in
  count, matching the pre-Phase-73 roll-under shape `roll < intel`); a roll
  below `bands.fumbleAtLeast` (`ceil(atLeast / 2)`) is a fumble rather than
  a plain failure. Every draw the fumble effects themselves make (the
  area/helpful/harmful resolver in `engine/scrollFumble.js`) reuses this
  SAME `scrollRead` stream — no third stream for the fumble's own
  aftermath.
- **The heavy blow.** The ONE replacement for every instant-kill scroll
  fumble (`engine/combat.js#fumbleHeavyBlow`, 75.1-04/75.1-05) draws its
  d10 (`+ depth`, unsoaked) from its OWN derived stream, `fumbleBlow` — not
  `scrollRead` — keyed on `(main cursor, "fumbleBlow", state.acts, C.round)`.

## Phase 75.2 hero size (RULES-11)

**Closed:** 2026-09-26 (75.2-01 through 75.2-05). Race sets a character's
base size step (`content/races.js`'s existing `size` field, keyed through
`SIZE_STEP_OF`) and any live size-stepping item (the Gauntlet of the Giant,
Enlarge) adds to it; each resolved step moves weapon damage by
`SIZE_DAMAGE_PER_STEP` (2) and a foe's winning faces against that body by
`SIZE_FACES_PER_STEP` (1), floored the same way every other damage/face
term already is. **The signature rule** (user ruling 2026-09-25, "Race
signatures and Joiners"): when a race's own BASE size step and one of that
race's own defining traits push the SAME axis (damage or face) in OPPOSITE
directions, the race trait wins and that axis of the base step is dropped
for that race — recorded as `sizeAxes` masks on the Dwarven (`{dmg:false}`,
protects the Dwarven `+2` damage trait) and Elven (`{face:false}`, protects
the Elven thin-boned `+1 foeToHit` trait) rows; Human, Wilmsry, Fridgian and
Troll carry no mask. **Item steps are never masked** — they always apply in
full, on both axes, on top of the resolved race base. The foe's need is
signed for the foe as `{name:"size", delta}` in `mods`, so Phase 74's
formatter shows it correctly from the player's own side on every surface.
**Joiners get size too, by the identical rule**, read from the Joiner's own
sheet (never the hero's, and vice versa). Zero new rng draws — every size
term is pure arithmetic over already-derived race/item state.

### Size modifier sites

| Site | Reads | Notes |
|---|---|---|
| Hero damage | `engine/derived.js#weaponDamage`, `#expectedStrike` (via `sizeDamage(c)`) | The damage axis (`sizeAxisStep(c, "dmg")`), signature mask applied to the race base only; item steps always in full |
| Foe vs hero | `engine/derived.js#foeToHitVs`, `#foeToHitBreakdown`, `#foeSwingVsHero` | `[foe-vs-hero:size-large]`, `[foe-vs-hero:size-small]`, `[foe-vs-hero:size-item]`, `[foe-vs-hero:size-signature]` — the face axis (`sizeAxisStep(c, "face")`), `vs === "hero"` only |
| Foe vs member | `engine/combat.js#foeTurn`'s member branch | `[foe-vs-member:size]` — a Joiner's OWN race's face axis, read from the member's own sheet, never the hero's |

### The size-rule audit (copied verbatim from 75.2-01-PLAN.md, "The size-rule audit")

| Id | Rule | Where | Keys on today | Hero-size reading | Verdict |
|---|---|---|---|---|---|
| S1 | Weapon damage per size step | engine/derived.js#weaponDamage, #expectedStrike | the Gauntlet's item effect only | race base (damage axis, unless masked) plus items, ±2 per step, floor 1 | APPLIED here |
| S2 | How easily foes hit you | engine/derived.js#foeToHitVs, #foeToHitBreakdown (vs hero, and vs member on the Joiner's own sheet since 79-02b, via engine/combat.js#foeTurn member branch → foeSwingVsMember) | nothing | race base (face axis, unless masked) plus items, ±1 foe face per step, `size` mod | APPLIED here (hero and Joiners) |
| S3 | Knight: foes under 5 hp flee | engine/combat.js#startCombat | foe maxWP < 5 | the text keys on hit points ("Nothing under 5 hp") | NO CHANGE (hit-point rule; user ruling: audit only) |
| S4 | Knight: foes with 20+ hp act first | engine/combat.js#knightFacesBigFoe, #resolveInitiative | foe maxWP ≥ 20 | the text keys on hit points ("20 hit points or more") | NO CHANGE (hit-point rule; user ruling: audit only) |
| S5 | Stink Bug "small: strike as one level lower" | content/bestiary.js note | inert: no engine read; only its `sp.toHit` is live | a Small hero striking a level lower would add a penalty beyond the ruled step | NO CHANGE (inert note; Phase 79 candidate) |
| S6 | Foe size `sz` (T/S/H/L/XL/B/G) | engine/combat.js#startCombat, engine/foeAbilities.js summon (`size: picked.sz`), foe card and foe details | display only, no rule reads it | the hero sheet shows SIZE the same way (75.2-03) | DISPLAY PARITY |
| S7 | Shrink ("two sizes down") | engine/magic.js shrink branch; 75.1's hero Shrink (`combat.heroShrunk`) | halves hp and blows; never touches `f.size` | hero Shrink mirrors the foe spell and takes no size step (user ruling) | NO SIZE STEP; composes (half of the size-adjusted blow) |
| S8 | Elven thin bones (`foeToHit: 1`) | content/races.js, foeToHitVs | race | Small's face axis would oppose it | SIGNATURE WINS: `sizeAxes: { face: false }` drops Small's face axis; Small's −2 damage applies |
| S9 | Dwarven `dmg: 2` | content/races.js, weaponDamage | race | Small's damage axis would oppose it | SIGNATURE WINS: `sizeAxes: { dmg: false }` drops Small's damage axis; Small's harder-to-hit face applies |
| S10 | Troll `dmg: 6`, `wpnBonus: 3` | content/races.js, weaponDamage | race | Large points the same way | STACKS: +11 damage, one face easier to hit |
| S11 | Flee race mods (Dwarven "short-legged", Troll "Large") | content/flee.js | race (comments cite build) | race-keyed; an item step does not change flee odds | NO CHANGE |
| S12 | Dwarven `foeStrikeStep` | engine/derived.js#foeDie | race | not a size rule | NO CHANGE |
| S13 | Lesser Summon "one small ally" | content/spells.js | flavor | none | NO CHANGE |
| S14 | Gauntlet of the Giant, Enlarge | content/treasure-tables.js, content/potions.js | `eff: { size: 1 }` / a separate damage payload | exactly +1 step each, in full on both axes | APPLIED in 75.2-02 |

**The standing guard.** `test/unit/hero-size-rules.test.js` (75.2-05) scans
every comment-stripped `engine/*.js` file and asserts the ONLY
`eff(sheet, "size")` call sits inside `derived.js#itemSizeStep`, the ONLY
`SIZE_STEP_OF` read sits inside `derived.js#raceSizeStep`, the ONLY
`sizeAxes` read sits inside `derived.js#sizeAxisStep`, and every
`sizeAxisStep(` call site is one of `derived.js`'s own
`heroSize`/`sizeDamage`/`foeToHitVs`/`foeToHitBreakdown` or
`combat.js#foeTurn`'s member branch — plus that no engine file ever reads
`.size` off a foe-like binding (a foe's own size lives on `.sz`, read only
by the two `picked.sz` record builders) and that `sizeAxisStep` itself never
names a race to decide its own mask. A doctored source string carrying a
second, unaudited size read is caught by the same scanning primitive
("has teeth"), proving the guard would fail on a future size rule that
skips this seam — its own failure message names the fix: read size through
`sizeAxisStep` and add the new rule's row to this table (S15+).

## Phase 75.3 control at depth (RULES-18)

**Closed:** 2026-09-26 (75.3-04 and 75.3-05; audited and guarded by
75.3-07). From floor 13 (the knee, `CONTROL_AT_DEPTH.kneeDepth` 12, the
same knee as RULES-17's curve), foes increasingly shake off control. Every
control in the audit below first meets a resist: a roll-high d20 drawn from
the `controlResist` derived stream (never the main rng), where the foe
resists on `roll >= 21 - faces` and
`faces = min(resistCap, 19, resistPerDepth × (depth - kneeDepth))` (1 face
at floor 13, growing by 1 a floor to the `resistCap` of 15 at floor 27; the
19 is a structural ceiling, never a dial, so a d20's top face always lands
the control). At or below the knee there are 0 faces and no roll at all.
A landed Freeze, Ice's last tick, Petrify, the stone items and Stupidity
HOLD the foe (`foe.held = { kind, left }`) for `holdRounds` (3) instead of
killing, removing or locking it for the whole fight; `foeTurn`'s held skip
counts it down and breaks it. Only the indefinite controls are capped (the
Birch and Cedar staves' 99-round sleep, the Lullaby's 24, Blind, the Walnut
Staff's weaken, all to `holdRounds`); short rolled durations keep their
roll. A lethal Freeze still kills. Every draw a control site makes of its
own stays in its old position, so the main rng is at the same cursor
whichever way the resist goes.

### Depth-resist site

| Site | Draw | Resistor | Resisted when | Direction row | Stream | Events |
|---|---|---|---|---|---|---|
| `engine/derived.js#controlResistCheck` (wrapping `controlResistRoll`), reached only through `engine/combat.js#resistControl` | d20 (`rollCheck`) | the foe | `roll >= 21 - faces` (`atLeast = 21 - faces`), faces by floor as above | `[resist:depth]` (Modifier ledger, 75.3-04) | `controlResist`, keyed `(main cursor, "controlResist", "<effect>:<source>", acts, round, foe index)` | `controlResisted` (with the roll, `atLeast`, `dieN`, depth); `controlHeld`, `foeStillHeld`, `foeHoldBroken` for the hold |

A resist is never silent: `resistControl` either returns false with no
mutation (a miss, or no roll at the knee or above it) or marks
`foe.resisted = effect` (the Unmoved chip) and pushes `controlResisted`.

### The control audit (copied from 75.3-04-PLAN.md, "The control audit", with each row's verdict)

"Past the knee" means floor 13 and deeper at the shipped values.

| Id | Effect | Source | Where | Rule past the knee | Verdict | Landed |
|---|---|---|---|---|---|---|
| C1 | freeze | Freeze (hero) | magic.js castSpell thrown `onHit` | resist; a hold instead of the kill | APPLIED: resist, then a frozen hold; a blow that leaves the foe at 0 hp still kills. SUPERSEDED (Phase 89 plan 08, ITEM-01, user Q1 2026-09-30): `freezeFoe` rolls the one depth-rising resist (`foeResistsEffect`), no separate control resist | 75.3-05 |
| C2 | freeze | Freeze (Joiner) | combat.js allyCast | resist; a hold instead of the kill | APPLIED: resist, then a frozen hold. SUPERSEDED (Phase 89 plan 08, ITEM-01, user Q1 2026-09-30): the same `freezeFoe` tail | 75.3-04 |
| C3 | freeze | Ice's last tick | combat.js foeTurn dot payoff | resist; a hold instead of the kill | APPLIED: resist, then a frozen hold. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): no knee branch: an iced foe that survives its last tick freezes solid and dies at every depth; the one resist it rolled was the cast's own SUPERSEDED AGAIN (Phase 90 plan 05, SPELL-12, Q5 A): Ice is the area freeze, so `foeTurn` has no Ice payoff at all (no dot, no `frozenSolid`); an Ice survivor's freeze is `combat.js#freezeFoe` (its resist after its own damage, a d4 hold). See the Phase 90 plan 05 section. | 75.3-04 |
| C4 | freeze (asleep 99) | Birch Staff | items.js freeze | resist per foe; asleep capped (was 99) | APPLIED: resist per foe; a landed sleep lasts `controlCapRounds(depth, 99)`. SUPERSEDED (Phase 89 plan 08, ITEM-01, user Q1 2026-09-30): the staff's freeze is `freezeFoe` (its d4 hold at every depth since 2026-09-28) with the one depth-rising resist; see X9 | 75.3-05 |
| C5 | stone | Petrify | magic.js petrify | resist; a stone hold instead of the removal | APPLIED: resist, then a stone hold. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): one depth-rising resist, then a kill through `killFoe` with spoils off (the experience is paid, Q2 A); no hold at any depth | 75.3-05 |
| C6 | stone | Oak Staff, Amulet of Stone | items.js stone | resist per foe; a stone hold instead of the kill | APPLIED: resist per target, then a stone hold; `foeStoned` names only the killed foes. SUPERSEDED (Phase 89 plan 08, ITEM-01, user Q1 2026-09-30): one depth-rising resist per target, then the stone KILLS at every depth; no hold; see X9 | 75.3-05 |
| C7 | sleep | Doze | magic.js status | resist (its d4 stays) | APPLIED: the d4 is drawn, then the resist. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): one depth-rising resist BEFORE the d4, no second control resist; a resisted Doze draws no d4 SUPERSEDED AGAIN (Phase 90 plan 05, SPELL-11, Q4 A): Doze is `combat.js#dozeFoes`: the d4 REACH is drawn first, then for each reached foe (the target first) the one resist and, when it fails, that foe's own sleeping d4; a resisted foe draws none. See the Phase 90 plan 05 section. | 75.3-05 |
| C8 | sleep | Stun | magic.js stun | resist per foe (its d4 stays) | APPLIED: resist per foe; `stunned.count` counts only the foes that slept. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): one depth-rising resist per foe before its d4, no second control resist SUPERSEDED AGAIN (Phase 90 plan 05, SPELL-11): Stun holds ONE foe: the aimed foe's one resist up front, then `combat.js#stunFoe`'s d4 and a held `stunned` hold; the per-foe reach and `stunned.count` are gone. See the Phase 90 plan 05 section. | 75.3-05 |
| C9 | sleep | Doze / Stun (Joiner) | combat.js allyCast | resist (its d4 stays) | APPLIED: the d4 is drawn, then the resist. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): one depth-rising resist (foeResistsSpell, keyed on the Joiner's name) before the d4, no second control resist SUPERSEDED AGAIN (Phase 90 plan 05, SPELL-11, SPELL-12): a Joiner's Doze, Stun and Ice go through the same shared tails (`dozeFoes`, `stunFoe`, `iceStorm`), the Joiner's name on every line; its Doze draws the d4 reach first. | 75.3-04 |
| C10 | sleep | Noxious Vapor's sleep outcome | magic.js vapor | resist per foe (its d6+2 stays) | APPLIED: resist per foe. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): one depth-rising resist per foe before its d6, no second control resist | 75.3-05 |
| C11 | sleep | Insane's sleep face | magic.js insane | resist (its d4 stays) | APPLIED: the d4 is drawn, then the resist. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): the one depth-rising resist is rolled up front (SINGLE_TARGET_KINDS) before the madness d6; the nap's d4 has no second resist | 75.3-05 |
| C12 | sleep | Cedar Staff gas | items.js gas | resist per foe; asleep capped (was 99) | APPLIED: resist per foe; a landed sleep lasts `controlCapRounds(depth, 99)`. SUPERSEDED (Phase 89 plan 08, ITEM-01, user Q1 2026-09-30): one depth-rising resist per foe, then asleep for the fight (99) at every depth; see X9 | 75.3-05 |
| C13 | sleep | Bard's Lullaby and Thunder songs | combat.js sing | resist per foe; the Lullaby's 24 capped, Thunder's d8 stays | APPLIED: resist per foe; the Lullaby lasts `controlCapRounds(depth, 24)` | 75.3-04 |
| C14 | weaken | Weaken (hero) | magic.js weaken | one resist for the room (its d4+1 stays) | APPLIED: one resist keyed on the aimed foe; shaken off, every live foe is marked Unmoved. SUPERSEDED (Phase 89 plan 08, ITEM-01, user Q1 2026-09-30): `roomWeakenResists` has each live foe roll its own depth-rising resist and no extra room resist; no Unmoved marks | 75.3-05 |
| C15 | weaken | Weaken (Joiner) | combat.js allyCast | one resist for the room (its d4+1 stays) | APPLIED: one resist for the room, as C14. SUPERSEDED (Phase 89 plan 08, ITEM-01, user Q1 2026-09-30): the same `roomWeakenResists` tail | 75.3-04 |
| C16 | weaken | Walnut Staff | items.js weaken | one resist for the room; timed (was the whole fight) | APPLIED: one resist for the room; a landed weaken starts a `holdRounds` `spell:weaken` timer. SUPERSEDED (Phase 89 plan 08, ITEM-01, user Q1 2026-09-30): the staff casts the full Weaken (half damage and `foeToHitPenalty` 3) for the whole fight at every depth, no timer (Q6 B); see X9 | 75.3-05 |
| C17 | stupid | Stupidity | magic.js stupid | resist; a stupid hold (was the whole fight) | APPLIED: resist, then a stupid hold. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): Stupidity drops the foe's intelligence to 1 for the fight; no hold, no cap | 75.3-05 |
| C18 | blind | Blind | magic.js blind | resist; timed blind (was the whole fight) | APPLIED: resist; a landed Blind lasts `blindFor` = `holdRounds` and `blinded` carries `rounds`. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): Blind is blindness for the fight at every depth, no blindFor, no rounds on the line | 75.3-05 |
| C19 | shrink | Shrink | magic.js shrink | resist per foe (an instant halving; nothing to cap) | APPLIED: resist per foe; `shrunk.count` counts only the halved. SUPERSEDED (Phase 90 plan 04, SPELL-12, user 2026-09-30): one depth-rising resist per foe, no second control resist | 75.3-05 |
| X1 | kill outright | Death | magic.js death | OUT: an instant kill, not control (flagged) | OUT (flagged for the user) | — |
| X2 | kill / flee faces | Noxious Vapor's face 4, Insane's faces 1, 3, 6 | magic.js | OUT: chaos-table outcomes (flagged) | OUT (flagged for the user) | — |
| X3 | sent away | Turn Walking Dead, Plane Gate | magic.js | OUT: answers, not control (flagged) | OUT (flagged for the user) | — |
| X4 | hp to 1 | Bard's level-5 song | combat.js sing | OUT: damage, not control (flagged) | OUT (flagged for the user) | — |
| X5 | one turn / two rounds | Pommel Strike, Dirty Trick | abilities.js | OUT: short ability effects | OUT; exempt in the guard (`applyPommel`, `applyDirtyTrick`) | — |
| X6 | debuffs | Hamstring, Mark, Acid, Poisoned Edge | abilities.js, magic.js | OUT: damage and debuffs, not control | OUT | — |
| X7 | on the hero | foe abilities (c.foeEffect) | foeAbilities.js | OUT: the hero's own intel resist governs | OUT | — |
| X8 | weaken | a fumbled Weaken scroll (Phase 75.1) | scrollFumble.js resolveHarmful, case `weakened` | OUT: a fumble effect (the scroll misfiring), not the hero's control | RESOLVED (user ruling 2026-09-26, "weaken the reader"; Plan 76-06's dispatch). Found by 75.3-07's scan: it used to set the foe-side `C.weakened` / `C.foeToHitPenalty` / `spell:weaken` fields, so the harmful fumble helped the reader. It now sets the reader's own `c.foeEffect` `{ kind: "weakened", rounds }` (d4+1), the debuff a foe's Weaken inflicts, and assigns no foe control, so the guard exemption is gone. Out of combat the fumble still fizzles (Phase 75.1) | 76-06 |
| X9 | item controls | Amulet of Stone, Oak Staff, Cedar Staff, Birch Staff, Walnut Staff (and Pine Staff's fire resist) | items.js useItem | OUT of RULES-18: no floor-12 knee, no hold, no separate control resist (user Q1, 2026-09-30) | RESOLVED: every item effect a foe can resist rolls the one depth-rising resist (`combat.js#foeResistsEffect`, `derived.js#risingResistFaces`), not `resistControl`; `items.js#useItem` is exempt in the guard for that reason. Phase 90 moves the spells onto the same helper | 89-08 |
| X10 | spell controls | every spell a foe can resist (the hero's, a scroll's free cast, a Joiner's) and foeTurn's Ice payoff | magic.js castSpell, combat.js allyCast and foeTurn | OUT of RULES-18: no floor-12 knee, no hold, no cap, no separate control resist (user 2026-09-30, "rising resists ... should apply to ALL spells ... remove the floor-12 special effects only") | RESOLVED: every spell rolls the one depth-rising resist (`combat.js#foeResistsSpell`, which IS `foeResistsEffect`; `derived.js#risingResistFaces`), not `resistControl`; `castSpell`, `allyCast` and `foeTurn` are exempt in the guard for that reason. Only the Bard's `sing` still calls `resistControl` (Phase 91, IDENT-17) UPDATED (Phase 90 plan 05): `dozeFoes` is now an audited site (after the one resist per reached foe) and `foeTurn` assigns no control any more (Ice's payoff is gone); `holdFoe` is the one hold, shared by Freeze, Ice and Stun. | 90-04 |

**The standing guard.** `test/unit/control-at-depth-rules.test.js`
(75.3-07) scans every comment-stripped `engine/*.js` file and fails when a
foe-control assignment (`asleep` or `held` set to a live value, or
`stupid`, `frozen`, `blind`, `shrunk`, `stunned` or `weakened` set true)
sits in a function that does not also call `resistControl(`, outside the
audited exemptions (`holdFoe` itself, whose callers resist first; X5's
`applyPommel` and `applyDirtyTrick`; X8's `resolveHarmful` exemption was
removed in Plan 76-06, when the fumble stopped assigning foe control). It also pins
`controlResistCheck(` to `combat.js#resistControl`, `controlResistRoll(` to
`derived.js#controlResistCheck`, and the one `"controlResist"` stream to
`derived.js#controlResistCheck`, and checks this section lists C1-C19 and
X1-X8. Doctored sources prove it has teeth. Its failure message names the
fix: send the new control through `resistControl` (and `holdFoe` for a
hold) and add its row here (C20+), or an X row plus a guard exemption for a
control deliberately outside the rule.

## Phase 78 note (CLIMB-01)

**Closes** Phase 74's `(f) Hooks left for Phase 77 and Phase 78` climb-card item. Since 78-01 every step toward a wall or crevice pauses on one engine decision (`state.pendingHazard`, a `hazardChoice` event, no die drawn), and the roll runs only on the commit (`resolveHazard { cross: true }`), draw for draw the roll the old single step made.

- **The card's odds.** The pre-roll climb card (78-03) reads `src/browser/rollOdds.js#hazardOddsText`, which formats `engine/movement.js#hazardOdds` through `rollRange.js`'s range format. `hazardOdds` takes its winning faces from `climbFacesFor` / `leapFacesFor`, the same helpers the roll itself calls, so the card and the roll can never disagree on a face, a penalty (Heights, Bodies of water, armour bulk) or the die.
- **No new check site.** The climb, climb fall-avoid and leap checks keep their rows above (sites 40, 41 and 42, and their Phase 73 mirror verdicts: roll-high, main rng); only when the roll happens moved, from the step to the commit. The pause and TURN BACK draw nothing.
- **Relaunch.** A pending climb or leap survives a relaunch unchanged, and the commit after it draws the same die (`test/roundtrip/resume-roundtrip.test.js`, CLIMB-02, 78-04).

## Phase 79 roll phrasing closure (ROLL-04)

**Closed:** 2026-09-27 (79-01 to 79-12). No player-facing string reads roll-under any more, and a doc-synced test pins it: `test/unit/roll-phrasing.test.js` runs every pattern below over the live narration corpus (`tools/lib/voice-corpus.mjs#buildCorpus`: every Oracle and rail builder rendered through the synthetic events, every registered copy bank, every content text field and the raw literal sweep of `src/browser`, `engine` and `mazeworld.html`) and fails on any hit outside the Exceptions table. It also fails when this section's pattern ids or exceptions differ from `tools/lib/voice-checks.mjs`, when an example here stops tripping its own pattern, when an exception stops matching a live string, when the corpus falls below its per-surface floors, and when the Closure list drops a handoff or the plan that closed it. `node tools/voice-inventory.mjs --roll-under --count` prints 0.

### The phrasing rule

Every check is roll-high (Phase 73): a higher face is always better, so a 1 is always the worst face.

- **A fixed die states the Phase 74 range.** d20 checks and d10 locks and climbs: "foes find you only on a 20 (19–20 if you insulted them)", "6–10 on d10 against any lock", "16–20 on a d20 avoids it". The range is written by `src/browser/rollRange.js` (`rangeText`, `facesRangeText`).
- **A die that scales speaks in faces.** The hero's strike die runs d20 to d6 with level and a foe's runs d20 to d8 with its level (`engine/derived.js#strikeDie`, `#foeDie`), so a face number would be wrong at most levels: "only their die's top face", "two fewer faces", "at best your die's top four faces hit it".
- **A mishap on a low face is canon.** "A natural 1 fumbles the pick" and "a scroll fumbles on 1–3" name the worst faces as the bad outcome, which is roll-high phrasing.
- **A signed modifier is Phase 74's display.** "+2 to hit" and "−2 to hit" are signed from the player's side and stay.

### Patterns

| Id | What it catches | Violation example | Roll-high replacement shape |
|---|---|---|---|
| `need-face` | a need phrase with a face count | "foes need a 1 to hit" | "foes hit you only on their die's top face" (scaling) or "only on a 20" (fixed) |
| `natural-low` | a natural-low success phrase (a mishap on a 1 is canon) | "foes need a natural 1 to find you" | "foes find you only on their die's top face" |
| `low-range` | a low range tied to a roll | "1–5 on d10 against any lock" | "6–10 on d10 against any lock" (the Phase 74 range) |
| `or-under` | N or under, less, lower or below (a stat threshold such as "wit of 6 or under" is not a roll) | "hits on a 5 or under" | "hits on 16–20" or "its die's top five faces" |
| `face-to-hit` | a bare face count to hit (a signed modifier is legal) | "a 5 to hit" | "your top five faces hit" |
| `single-low-face` | a single low face that hits or crits | "hittable only on a 4" | "at best your die's top four faces hit it" |
| `penalty-to-hit` | a penalty written on to-hit | "−3 on to-hit" | "−3 to hit (19–20 instead of 16–20)" (the signed display) |
| `need-better` | need(s) N better | "every foe needs two better" | "every foe has two fewer faces that hit you" |

### Exceptions

| Key | Phrase | Reason |
|---|---|---|
| *(none)* | | |

Every hit the patterns found at the phase base was a genuine roll-under phrase, so each was rewritten rather than excused. An exception is only ever for a phrase that is not about a roll.

### Closure list

Every item this ledger's `## Handoffs → Phase 79 (roll-direction phrasing)` list and `### (g) What stays for Phase 79` hand on, with the plan that closed it.

| Item | Source | Closed by | How |
|---|---|---|---|
| Mirror Self | Handoffs → Phase 79 | 79-05, 79-08 | The spell text reads "foes hit you only on their die's top face (the top two faces if you insulted them)" (79-05); the Oracle and rail `mirrorSelf` lines say the same (79-08). |
| Crystal Staff | Handoffs → Phase 79 | 79-05, 79-02b | The staff text reads "party invisible d10+5 squares: foes hit only on their die's top face (the top two faces if you insulted them)" (79-05). It stays party-wide: 79-02b's `PARTY_WIDE_ITEM_EFFECTS` keeps the staff's invisibility on every Joiner, so "party" is accurate. |
| Weaken | Handoffs → Phase 79 | 79-05, 79-07, 79-08 | "no more than their die's top three faces hit" in the spell text (79-05), the foe chip's description (79-07) and the `weakened` lines (79-08). |
| Acute Hearing | Handoffs → Phase 79 | 78-09 | Phase 78's new text ("never surprised; hears an encounter up to three squares away…") was written without a face count; the corpus scan confirms it. |
| Bestiary face counts (Zit, Drat, Stink Bug) | Handoffs → Phase 79 | 79-05 | Zit and Stink Bug read "at best your die's top N faces hit it"; Drat's note ("natural mail; may break your weapon") was already digit-free. |
| Skeleton and Shadow notes | Handoffs → Phase 79 | 72-06, 72-07 | Already digit-free before Phase 79 (recorded in the handoff itself); the corpus scan confirms it. |
| Bare signed numbers (the device trigger) | Handoffs → Phase 79 | 74-05, 79-12 | 74-05 gave every signed weapon number its comparison ("−2 to hit, worse than your Club"); 79-12's `test/unit/authored-ranges.test.js` pins every signed number and face count the narration, chips, blurbs, legend and epitaphs state against the engine. |
| Smoke | Handoffs → Phase 79 | 79-05, 79-04 | The ability and skill texts (79-05) and the `smokeThrown` lines (79-04) read "foes find you only on their die's top face (the top two if you insulted them)". |
| Lockpicks | Handoffs → Phase 79 | 79-05 | `engine/items.js#rollTreasureItem` and `engine/economy.js#openStore` read "6–10 on d10 against any lock" and "opens boxes on 6–10". |
| Smoke and Battle Roar narration | (g) What stays for Phase 79 | 79-04, 79-05 | `battleRoarRaised` and `sidestepped` read "every foe has two fewer faces to hit…" (79-04); the ability texts read the same (79-05). |
| Invisibility lines (Anklet, Cloak) | (g) What stays for Phase 79 | 79-05, 79-11, 79-07, 79-12 | The Anklet's text (79-05), `itemEffectStarted` (79-11) and the `unseen` chip sentence (79-07) read "every foe has two fewer faces that hit you"; the Cloak and potion read "only on their die's top face". 79-12 relabels the Anklet's foe-swing modifier from "gear" to "unseen", the chip's own name (below). |
| CONDITION_EXPLAIN and FOE_CONDITION_DESC | (g) What stays for Phase 79 | 79-07 | Every chip sentence was audited; the roll-under ones now speak in faces. |
| Every other bestiary face count | (g) What stays for Phase 79 | 79-05 | Pogo reads "your die has one face fewer that hits it"; the size-rule audit's S5 Stink Bug note ("strike as one level lower") was replaced by the faces reading. |
| Trap and lock ranges outside content | 79-01 base worklist | 79-06, 79-10 | The trap epitaph reads "16–20 on a d20 avoids it" (79-06); the MARKS legend reads "16–20 dodges it (13–20 for an Acrobat)" and "6–10 on a d10 opens it" (79-10). |
| Class, sub-class and race blurbs | 79-01 base worklist | 79-03 | The Fighter, Magic User, Cleric, Acrobat, Guard, Soldier and Elven blurbs speak in faces ("your top five faces to hit — 16–20 on the d20 at skill level I"). |
| The hidden rulebook-notes section | 79-10 handoff | 79-12 | Its "dodged on 1–5" line sat in a `<section hidden>` nothing ever showed; 79-12 deleted the stale section outright (greenfield). |

### Corrections to earlier sections (append-only)

- **(b), the condition chip example.** The chip's measured lead now reads "−3 to hit (19–20 instead of 16–20)" for Afraid (Phase 77, CMBUI-13), not "(now 19–20)". `test/unit/roll-sign-consistency.test.js` pins the "(… instead of …)" shape.
- **Phase 77's audit gaps (77-07).** Acuteness swaps the strike die to a d6 rather than moving the face count, so it has no signed modifier; every roll line already prints the die and its range, and the chip's measured lead states it. Not a gap. The Anklet of Invisibility's foe-swing term (`engine/derived.js#foeToHitBreakdown`'s summed `foeToHit` gear effect, which only the Anklet carries) read "gear +2" on every roll line and the foe card; 79-12 relabels it "unseen +2" through `src/browser/rollRange.js#MOD_LABEL`, the name on the Anklet's own chip. `test/unit/roll-sign-consistency.test.js` fails if a second item ever gains a `foeToHit` effect and the label would stop being true.
- **Phase 77's `heroOut` label (77-08).** "Can't act" states what happened to whom, so it passes the Phase 79 rubric and stays; its exemption from the one-word label style keeps its reason.

## Quick 260927-rsx: every spell cast on a foe can be resisted (user ruling 2026-09-27)

**The ruling.** "Every spell cast on an enemy should have a chance to be
resisted based on their intelligence. High intelligence is more chance to
resist. I'd like this in now. I want the resist rolls noted in the Oracle,
too." A resisted damage spell has no effect; scale half-intel. A deliberate
change from canon p.25 (only an intel >= 12 target resisted, and never a
thrown spell).

**The rule.** Every foe a spell targets rolls a roll-high d20 and resists on
`roll >= 21 - faces`, `faces = max(1, round(intel / 2))`: intel 1–2 resist on
20 (5%), 3 on 19–20 (10%), 6 on 18–20 (15%), 10 on 16–20 (25%), 16 on 13–20
(40%). No gate: every foe rolls. A resisted spell does nothing to that foe
(damage included); the caster's turn and charge are spent. Spells that do
not target a foe (`engine/derived.js#SPELL_SELF_KINDS`: Summon, ward, Strength,
Regenerate, Heal, Map the Floor, Foresee, Mirror Self, Sense Presence) never
roll.

### Spell-resist site

| Site | Draw | Resistor | Resisted when | Direction row | Stream | Events |
|---|---|---|---|---|---|---|
| `engine/derived.js#foeSpellResistCheck` (wrapping `foeSpellResistRoll`), reached only through `engine/combat.js#foeResistsSpell` | d20 (`rollCheck`) | the foe | `roll >= 21 - faces` (`atLeast = 21 - faces`), `faces = foeSpellResistFaces(intel)` | `[resist:foe-intel]` (Modifier ledger) | `spellResist`, keyed `(main cursor, "spellResist", <spell or item name>, <caster: "you" or the Joiner's name>, acts, round, foe index)` | `spellResisted` / `resistFailed`, both with `{ target, spell, by?, roll, atLeast, dieN, intel, faces }` — every roll, either way, is its own Oracle line |

**Callers.** The hero's `castSpell` (a one-foe spell rolls before its kind
branch, where canon's check sat; a room spell rolls per foe inside its
branch), a scroll's free cast (the same `castSpell`), a Joiner's `allyCast`,
and the foe-targeted staff and amulet powers in `engine/items.js#useItem`
(Birch freeze, Walnut weaken, Oak and Amulet of Stone, Pine fire, Cedar gas).
A fumbled scroll (`engine/scrollFumble.js`) is not a spell cast on a foe (it
turns on the reader, or helps the foe) and never rolls.

**Draw order.** The resist itself never touches the main rng. A resisting
foe takes none of the draws that were only for it (a thrown spell's to-hit
and damage, Doze's and Stun's d4, Noxious Vapor's d10 or d6, a Fireballs or
Pine Staff ball's damage). Draws that belong to the whole cast stay first and
unchanged (Stun's and Shrink's reach, Weaken's d4 + 1, Earthquake's damage,
the Fireballs count, Noxious Vapor's table roll, Plane Gate's reach).

**Stacking with RULES-18.** The intel resist comes first; the depth resist
(`[resist:depth]`, `resistControl`) is unchanged and is reached only for a
control the foe did not resist. A room Weaken (`engine/combat.js#roomWeakenResists`)
rolls every live foe's intel resist, then the room's one depth resist keyed
on the aimed foe exactly as before; a landed Weaken skips each foe that
resisted it (`f.weakenResisted`, read by `derived.js#foeWeakened` and the
`foeToHitPenalty` cap).

**The hero side is unchanged.** Row 46 and `[resist:intel]` / `[resist:intel-gate]`
now describe the HERO resisting a foe's spell or ability
(`engine/foeAbilities.js#heroResist` → `resistRoll`, intel >= 12, canon). The
foe side reads the separate function above, so neither can drift with the
other.

## User rulings 2026-09-28: Freeze deals its damage, then freezes 1d4 rounds (plan 79.2-01)

The user ruled: "freeze should never kill outright. It should deal its damage
and freeze an enemy for 1d4 rounds." and "if it hits and resists, deal damage,
but no freeze." Every Freeze (the hero's cast, a scroll's free cast, a
Joiner's `allyCast`, and the Birch Staff's freeze power) now resolves through
`engine/combat.js#freezeFoe`, in this order:

1. **To-hit**, as before (d10, six winning faces plus the school and throw
   bonuses). The staff has no to-hit.
2. **Damage** on a hit, as before (d6 × the level multiplier, through
   `damageFoe`). The staff has no damage. A blow that drops the foe to 0 hp is
   a normal kill (`killFoe`, no `frozenSolid`), and nothing below is drawn.
3. **The hold's d4** — ONE NEW main-rng draw, `rng.d(FREEZE_HOLD_DIE)`
   (`FREEZE_HOLD_DIE = 4`, exported from `engine/combat.js`, tagged
   `// roll:amount`). It is taken right after the damage, whenever the hit
   foe survives, resisted or not (the RULES-18 main-draw parity: a resisted
   and a landed Freeze take the same main draws, like Doze's d4). The staff
   draws one per foe it reaches.
4. **The intel resist** (`[resist:foe-intel]`, `foeResistsSpell`, the
   2026-09-27 derived stream). For Freeze it is no longer rolled before the
   throw: it comes after the damage and the d4, so its stream key reads the
   main cursor at that point. A resist stops only the freeze; the damage
   already landed. The event carries `freeze: true` when the hit did damage,
   and the line reads "<foe> resists the freeze: the damage lands, the ice
   doesn't." A miss rolls no resist at all.
5. **The control resist** past the knee (`[resist:depth]`, `resistControl`),
   unchanged: shaken off means no freeze.
6. **Frozen** — `holdFoe(..., { rounds })`: `foe.held = { kind: "frozen",
   left: <the d4> }` at EVERY depth (it was `controlHoldRoundsFor(depth)`,
   past the knee only), and `controlHeld` carries `freeze: true` (plus `dmg`
   on a spell hit). The foe skips that many of its own visits
   (`foeStillHeld`), then thaws (`foeHoldBroken`).

**Retired.** The frozen-solid kill at or below the knee (the Phase 23
`killFoe` route, audit rows C1 and C2) and the staff's `asleep = 99` (row C4)
are gone. (`frozenSolid` stayed for Ice's last tick (C3) until Phase 90 plan 05 retired it with Ice's burn: nothing emits it now.)

**Draw count.** A hit that leaves the foe standing now takes to-hit, damage
and the d4 (3 main draws, was 2 past the knee); a Freeze kill takes to-hit,
damage and killFoe's reward draws, as before. The Birch Staff takes one d4
per foe it reaches (was none). `engine/combat.js`'s tagged amount-draw count
rises by one (`test/unit/roll-high-guard.test.js#DRAW_INVENTORY`). The
per-file count table above is the Phase 72 snapshot at `9197002` and is not
re-stated.

The 2026-09-27 section above still holds for every other spell: a resist
means no effect, and a resisting foe takes none of the draws that were only
for it.

## User ruling 2026-09-28: spell damage adds level² (quick 260928-sq2)

"What if we square spell damage just like we do with weapons damage." An
offensive spell's damage is now **its dice + the caster's level²**
(`engine/derived.js#spellLevelSq`, the weapon's `levelSq` term), replacing
canon p.26's `× max(1, caster level − spell level)` for damage. Stun's reach
kept the multiplier (it is not damage) until Phase 90 plan 05 made Stun hold one foe. **No new draw anywhere**: the level²
is added to dice that were already rolled, so every site's draw order and
count are unchanged, and `test/unit/roll-high-guard.test.js#DRAW_INVENTORY`
does not move.

| Site | Before | After |
|---|---|---|
| magic.js thrown (Freeze, Fireball, Mangle, Lightning per foe) | `rollDice(dmg) × mult + spellDmg` | `rollDice(dmg) + level² + spellDmg` |
| magic.js quake (Earthquake) | every foe `rollDice(dmg) × mult`; self `ceil(that / 2)` | every foe `roll + level²`; self `ceil(roll / 2)` (no level²) |
| magic.js volley (Fireballs) | each bolt `rollDice(dmg)` | each bolt `rollDice(dmg)`, the first bolt to strike each foe `+ level²` |
| magic.js acid / dot (Acid, Ice) | each tick `rollDice(dmg)` | the first tick `+ level²` (the record's `levelSq`, then deleted); Phase 90 plan 05: Ice left this row (it is `iceStorm`: each foe `rollDice(d10) + level²`) |
| combat.js allyCast (a Joiner's thrown spell) | `rollDice(dmg) × max(1, level − spell level) + spellDmg` | `rollDice(dmg) + level² + spellDmg`, the Joiner's own level |
| magic.js stun | `d6 × mult` foes | unchanged (Phase 90 plan 05: Stun holds one foe, `combat.js#stunFoe`; no reach) |
| magic.js heal, backfire; scrollFumble.js | — | unchanged (self and healing never add level²) |

Every amount still passes through `spellDamageFor` / `afraidDamage` (hero
casts) and `damageFoe` exactly as before. The `spellHit` event's `mult`
field is replaced by `levelSq` (the term added), which the Oracle and rail
lines print as "the roll +N, for your level"; `iceApplied` gains `levelSq`
for the same reason. Step 2 of the Freeze section above ("d6 × the level
multiplier") now reads d6 + level².

## Quick 260928-cos: the Cloak of Strength wards foe crits (user-approved fix 2026-09-28)

The user, on a Pixel 7: "the cloak of strength is supposed to stop critical
hits, but I'm still getting critted. just now I had Braced on from my cloak,
and I took a critical hit from a [wolf]." The cloak's text is "used, no
critical damage lands on you for fifty squares". Since Phase 15 (ECON-08),
`combat.js#playerStrike` had read its `eff: { noCrit: 1 }` as the WEARER's
own crit ban (the `[hero-crit:*]` family's fourth clause), so the cloak
stopped the hero's crits while every foe crit still landed.

The fix. The cloak's payload is now `critWard` under its own activation kind
`critWard` (it was `brace`, which the Fighter's Brace also uses).
`engine/derived.js#critWardOf(body)` names the live item that wards `body`. At
each foe-crit site, a crit the foe **rolled** against a warded body is dropped
to an ordinary hit, and one `critWarded` event is told before the blow lands.

**No draw moves.** The crit is read off the to-hit roll that was already
drawn, and the damage dice are drawn once in the same position whether they
count once or twice. The ward only chooses "once". `DRAW_INVENTORY` does not
move.

| Site | Before | After |
|---|---|---|
| combat.js#foeTurn hero branch (#26/#29) | `crit = roll >= atLeastFor(Soldier ? 2 : 1, dieN)` | the same roll decides `rolledCrit`; `crit = rolledCrit && !critWardOf(c)` |
| combat.js#foeTurn member branch (#27) | `mCritical = isBestFace(mRoll, mDieN)` | `mCritical = rolled && !critWardOf(memberSheet)`: the Joiner's own sheet, never the hero's |
| combat.js#pursuitStrike (#16) | the hero-branch rule | the hero-branch rule, warded the same way |
| combat.js#playerStrike own crit (#11) | banned for Guard/Soldier, the dark, **or `eff(c,"noCrit")`** | banned for Guard/Soldier and the dark only (`[hero-crit:no-crit-sub]`, `[hero-crit:dark]` unchanged) |
| derived.js#noCritFor (gear compare) | Guard/Soldier or `eff(c,"noCrit")` | Guard/Soldier |

`struckByFoe` / `memberStruck` carry `critical: false`, no `critAtLeast` or
`soldierCrit`, and `critWarded: true` for a warded blow. The `critWarded
{ name, item, roll, dieN, member? }` event reads roll-high on the Oracle
("… turns the Wolf's critical aside: 20 on the d20, an ordinary hit
instead") and on the rail. An old save loads unchanged. Its worn item may
still carry the retired `eff.noCrit`, but `eff()` and `critWardOf()` read the
content payload through the live `item:Cloak of Strength` timer record, so
the stale copy on the item is inert. Pinned in
`test/unit/cloak-crit-ward.test.js`.

## User ruling 2026-09-28: the hero resists on the half-intel scale (quick 260928-hrs)

"Use the same half-intel scale for heroes now." When a foe's bolt, drain or
debuff (`engine/foeAbilities.js#heroResist`) lands on the hero, the hero now
resists exactly as a foe resists a spell cast on it: a roll-high d20,
`resisted = roll >= 21 - faces`, `faces = resistFaces(intel) = max(1,
round(intel / 2))`. Intel 1–2 resists on 20 (5%), 6 on 18–20 (15%), 10 on
16–20 (25%), 12 on 15–20 (30%), 16 on 13–20 (40%), 18 on 12–20 (45%), 20 on
11–20 (50%). There is no intel-12 gate any more, so every hero has at least
5%. This retires canon p.25 (only intel >= 12 rolled, on `intel - 1` faces:
intel 12 used to resist on 10–20, 55%, and intel 18 on 4–20, 85%), which is
the "the hero side is unchanged" paragraph of the 2026-09-27 section above.

**One helper.** `engine/derived.js#resistFaces` and `#resistRoll` are the
one scale and the one roll for both sides. `foeSpellResistFaces` and
`foeSpellResistRoll` were folded into them (renamed, since they are no
longer foe-only); the old gated `resistRoll` body is gone.
`foeSpellResistCheck` keeps its name: it is still the foe-only derived-stream
wrapper.

**Draw position (the stream question).** The two sides draw from different
streams, and each keeps its own:

| Side | Stream | Position | Change |
|---|---|---|---|
| A foe resisting a spell cast on it | derived (`spellResist`, via `foeSpellResistCheck`) | never on the main rng | none |
| The hero resisting a foe's bolt, drain or debuff | MAIN rng | after the ability gate's d6 (or first, for a never-melee caster), before the effect's own dice (damage, the debuff's d4) | an intel 12+ hero draws exactly where it always did, and only the threshold moved; a hero below intel 12 now draws one d20 in that same slot, where canon drew nothing |

Moving the hero onto a derived stream was the other option. It would have
taken the d20 away from every intel 12+ hero and moved their rng instead, so
the main-rng slot canon already used was kept. A member-targeted bolt or
drain still has no resist (unchanged: `pickFoeTarget` picks the member before
the resist, and a member never rolls).

**Rows.** Row 46 and `[resist:intel]` above now describe this rule;
`[resist:intel-gate]` is retired (N/A). `test/unit/roll-high-guard.test.js`'s
DRAW_INVENTORY drops one `rollCheck` call in derived.js (3 → 2), the merge.
The Oracle line for `heroResisted` / `heroResistFailed` already printed the
roll, the event's range and the intel; the rail twins now print them too
(`test/unit/authored-ranges.test.js` pins both against the engine's range).

## User rulings 2026-09-28: class trims and Joiner resist (quick 260928-nrf)

The user picked option (a) for each trim the 260928-abl Fighter/Thief ability
audit offered, and said "Yes, same scale" to Joiners resisting. Five rules
change; every one is roll-high and draws exactly where the old rule drew,
except the Joiner resist, which adds one main-rng d20.

| Rule | Id | Before | After | Draws |
|---|---|---|---|---|
| Thief flee bonus | `[flee:thief]` | `+5` (canon): a Human Thief in light armour escapes on 9–20 | `+3`: 11–20 (a deliberate deviation from canon; docs/FLEE.md) | unchanged: the one flee d20 |
| Sweep | (a refusal, not a roll) | used against any number of living foes | refuses `tooFewFoes` with fewer than two: no turn, no cooldown, no draw | none on a refusal |
| Kata and Feint | `[hero-strike:kata-feint]` | `autoHit`: the strike die is drawn and ignored | `needShift: +3`: three more winning faces, capped at the die; an untouchable foe stays untouchable | unchanged: the strike die, then the damage die on a hit (a miss draws no damage die) |
| Acrobat, as the target | `[foe-vs-hero:acrobat]`, `[foe-vs-member:acrobat]` | foes land on their top 3 faces | their top 4 (`ACROBAT_FOE_FACES`) | unchanged |
| Joiner resist | `[resist:member-intel]` | a foe's bolt or drain at a Joiner was never resisted | the Joiner rolls `resistRoll(rng, intel)` on its own intel, `faces = resistFaces(intel)`: intel 1–2 resists on 20, 6 on 18–20, 10 on 16–20, 16 on 13–20, 20 on 11–20. A resist blocks the whole effect (no damage, no drain) | +1 main-rng d20 per bolt or drain aimed at a Joiner, after the ability gate and the `pickFoeTarget` die, before the damage dice: the hero's slot |

**The Joiner's stream.** The hero's resist has drawn from the main rng in
this slot since quick 260928-hrs, and a foe's from a derived stream. The
Joiner follows the hero: the target pick already draws on the main rng
there, and a Joiner's resist is the target's roll, like the hero's.

**Events.** `memberResisted` / `memberResistFailed` carry the hero events'
fields (`name` is the foe, `ability`, `roll`, `atLeast`, `dieN`, `intel`,
`faces`) plus `member`, the Joiner's name. Both are OUTCOME rows in
`test/parity/roll-high-invariant.test.js` (success / failure). The Oracle and
rail lines name the Joiner and print the roll, the range and the intel
(`test/unit/class-trims-nrf-copy.test.js`).

**A missed Kata or Feint** is an ordinary `strikeMissed` with `via` and a
`{ name: "Kata" | "Feint", delta: +3 }` mod entry, so the roll line reads
"7 vs 9–12 (Kata +3)". The use is spent either way.

**Direction probes.** `[hero-strike:kata-feint]` (a strict bonus, and a miss
is still possible) and `[resist:member-intel]` are new rows in
`test/unit/rollDirection.test.js` / `rollDirection-checks.test.js`;
`[flee:thief]` and the two Acrobat rows keep their direction and change only
their numbers.

## Phase 88 plan 04: heal-over-time and the Cloak of Regeneration (ITEM-03, user 2026-09-30)

"The cloak should be active for 30 squares, healing 1d6 every 10 squares. Then
it goes on cooldown for 50 squares."

- **The use-time main d6 is gone.** `useItem`'s `knit` case used to roll
  `rng.d(6)` (tagged `roll:amount`) from the main stream and heal at once.
  Using the cloak now only starts the 30-square window, with zero draws. The
  roll-high draw inventory for `engine/items.js` drops one `amount` (8 to 7).
- **Each heal tick is a derived-stream d6.** `tickHealOverTime` rolls
  `rollDice(derivedRng(<main rng cursor>, "healTick", <item>, <tick>,
  <state.steps>), { n: 1, sides: 6, bonus: 0 })`, so it is an amount roll by
  construction (`rollDice`), reads the main cursor without advancing it, and
  reorders no existing draw or floor.
- **No check-direction change.** No check or threshold was added or flipped;
  the tick is a plain heal die, clamped to max hp, and a tick at full hp is
  narrated and spent.

## Phase 89 plan 03: the Poplar Staff heals the party (ITEM-01, ITEM-06, user 2026-09-30)

"Engine to text: it heals every party member (hero and Joiner) d20+10 each.
Heal rolls from a derived stream." Canon (mazeworld.pdf p.46): "Healing staff,
adds 1d20+10 WP to 1d6".

- **One amount roll per body, from one derived stream.** `useItem`'s
  `partyHeal` case rolls `rollDice(healRng, act.heal)` (1d20+10, read from the
  activation record) for the hero first, then once per living Joiner in
  `state.party` order, where `healRng = derivedRng(<main rng cursor>,
  "partyHeal", <state.acts>, <item name>)`. The main rng is only READ for its
  cursor and never advanced, so no existing draw reorders. A solo hero draws
  exactly one die; a downed or departed Joiner draws none.
- **Before, it was a main-stream d10.** The Poplar used to fall into the
  Healing-potion branch (`rng.d(10) + 2`, hero only, main stream). That tagged
  potion line is unchanged and still the potion's.
- **Roll-high draw inventory for `engine/items.js` does not move** (rollCheck
  1, amount 7, selection 9): the dice go through `rollDice`, so there is no
  `.d(` occurrence in `engine/items.js` and nothing to tag.
- **No check-direction change.** No check or threshold was added or flipped;
  a heal at full hp gains 0 and is still narrated.
- **The Pendant of Fortitude adds no roll.** Its armed charge is bookkeeping
  (`halfNext = { slot, n }`); disarming draws nothing.

## Phase 89 plan 04: a Joiner's armour soaks foe hits (ITEM-07, user 2026-09-30)

"Let their armor soak damage. Just like players."

- **One soak die per landed blow on an armoured Joiner, from a derived
  stream.** `applyFoeDamageToMember` (engine/combat.js) rolls the Joiner's
  soak d20 through `rollCheck(derivedRng(<main rng cursor>, "memberSoak",
  <C.round>, <foe index>, <swing>, <party index>), 20, atLeastFor(soakAr,
  20))`, roll-high, the same check the hero's soak is (`armorSoak(sheet)` on
  the Joiner's own sheet, doubled to a cap of 20 under its own Taunt). The
  main rng is only READ for its cursor, never advanced, so no existing draw
  reorders. A melee swing passes its swing index; a bolt passes -1.
- **No die when there is nothing to soak with.** A Joiner with no armour
  (AR 0 or 0 durability, a Fridgian), a drain, a no-armour foe, and a blow
  that arrives at 0 draw no soak die. A solo fight never reaches the helper.
- **Roll-high draw inventory for `engine/combat.js` moves one:** rollCheck
  22 -> 23 (the soak call). `engine/foeAbilities.js` does not move (the
  member bolt's damage die is the same `rollDice` call, same position).
- **The check direction is the hero's.** Roll at or above the threshold
  soaks, a die exactly at the threshold soaks; no new check was flipped.
- **The pipeline order moved for a Joiner only.** The round-damage ceiling
  now sits before the Brace (the hero's order) instead of after it: a Brace
  halves the ceilinged blow, and the Pendant halves it first.

## Phase 89 plan 05: Joiners use their own items (ITEM-07, user 2026-09-30)

"Let joiners use items they have ... Just like players."

- **A Joiner's healing potion (`memberPotion`).** `memberDrinkPotion`
  (engine/items.js) rolls the hero's stock potion, `2 * d10 + 5`, doubled for
  a heal-twice race (`RACES[race].heal2x`), from `derivedRng(<main rng
  cursor>, "memberPotion", <state.acts>, <party index>, <potions before the
  drink>)`. The main rng is only READ for its cursor, never advanced, so no
  existing draw reorders. A refusal (no such Joiner, in a fight, no potions,
  full hp) draws nothing.
- **A Joiner's heal-over-time tick (`healTick`, member form).** The hero's
  key stays exactly `derivedRng(cursor, "healTick", <item>, <tick>,
  <state.steps>)`; a Joiner's appends `"member", <party index>`, so a Joiner's
  Cloak of Regeneration rolls its own d6 and the hero's is not disturbed.
- **A Joiner's Pilfer fumble (`pilferFumble`, member form).** Keyed
  `derivedRng(cursor, "pilferFumble", <state.acts>, <item name>, "member",
  <party index>)`; the hero's key is unchanged. The d20 steady-hands check and
  the d10 blast are one shared helper (`rollPilferFumble`) for the hero and a
  Joiner, so neither adds a `rollCheck` or a `.d(` occurrence.
- **The Magic User Joiner's starting scroll (`joinerScroll`, ruling Q3 = A).**
  `resolveJoiner` (engine/encounters.js) picks the spell the Joiner copies
  into its book with `derivedRng(<state.rngState>, "joinerScroll", <name>,
  <floor depth>).pick(<the spells it can learn at its level that its book
  lacks>)`. `resolveJoiner` has no rng argument, so the cursor is read off the
  state. `.pick` is not a `.d(` draw; nothing to tag.
- **Roll-high draw inventory for `engine/items.js` moves one:** amount 7 -> 8
  (the `memberPotion` `.d(10)`, tagged `roll:amount`). `rollCheck` stays 1 and
  `engine/encounters.js` does not move.
- **No check-direction change.** The Pilfer fumble is the hero's own check
  (roll-high, only a natural 1 fails); no check or threshold was added or
  flipped.
- **Nothing is drawn on the main stream** by any Joiner path: wear-on-join
  (`reconcileWorn`), the tick loop, the refusals and the effect starts are all
  bookkeeping or derived.

## Phase 89 plan 08: the depth-rising resist for items and staves (ITEM-01, ITEM-06, user 2026-09-30)

The user's ruling (Q1, docs/ITEM-AUDIT.md `## Rulings`): "rising resists on
higher floors should apply to ALL spells and spell-like effects (staves
included) ... remove the floor-12 special effects only." Phase 89 built it for
every item and staff effect a foe can resist; Phase 90 moves the spells onto
the same helper.

- **The one helper.** `engine/derived.js#risingResistFaces(depth, intel)` is
  the foe's winning faces on one d20: its half-intel faces `a`
  (`resistFaces`) and the depth faces `c` (`difficulty.js#controlResistFacesFor`,
  none at or below floor 12, +1 a floor, dial cap 15) folded into the odds the
  old two rolls gave, `round(a + c - a*c/20)`, capped at 19
  (`RISING_RESIST_CEILING`). At or below floor 12 it is exactly
  `resistFaces(intel)`. `engine/derived.js#foeRisingResistCheck` rolls it and
  `engine/combat.js#foeResistsEffect` is the gate (always narrated, like
  `foeResistsSpell`). **One roll, not two:** the separate control resist and
  its `resistControl` call are gone from every item.
- **Stream: unchanged.** The roll is on the `spellResist` derived stream with
  the same key `foeSpellResistCheck` uses, `(main cursor, "spellResist",
  <item or spell name>, <caster>, acts, round, foe index)`, one `rollCheck`
  d20 through the shared `resistRollFaces`. The main rng is never touched, and
  at or below floor 12 the roll and its result are identical to the old intel
  resist, so every shallow fixture is byte-identical.
- **Event:** `spellResisted` / `resistFailed` gain the additive field
  `depthFaces` (faces the floor added), present only when it is above 0.
- **Sites moved onto it:** the Amulet of Stone and Oak Staff stone (a foe that
  fails it is stoned outright at any depth: no hold, no `controlResisted`),
  the Cedar Staff gas (asleep the fight, 99 rounds, at any depth), the Pine
  Staff fire, and the two `engine/combat.js` tails items share with spells:
  `freezeFoe` (the Birch Staff, the hero's and a Joiner's Freeze: one resist
  after the damage, then the d4 hold) and `roomWeakenResists` (the Walnut Staff,
  the hero's and a Joiner's Weaken: each live foe rolls its own, and the extra
  room resist is gone).
- **The Walnut Staff (Q6 B)** sets `combat.weakened` and
  `combat.foeToHitPenalty = 3` for the whole fight, at every depth (no timer;
  a running `spell:weaken` timer is ended so its expiry cannot clear the
  staff's). No new draw.
- **Draws:** no main-rng draw added, removed or reordered. The Birch Staff's
  per-foe d4 stays where it was. The removed pieces are derived-stream rolls
  (the second `controlResist` roll and the hold), never main draws.
- **Cure Poison and Cure Disease (Q5)** refuse with `useRefused { reason:
  "nothingToCure", need, have }` before `itemUsed`: no draw, no change, the
  potion kept.
- **Joiner armour repair (Q4)** adds store lines (`repairArmor` with `{ member,
  name }`): no draw; `openStore` draws exactly as before.

## Phase 90 plan 03: the Strength spell's d10 (SPELL-09, user 2026-09-30)

"Strength spell says +d10 damage until tomorrow. But casting it actually grants you hit points
instead." (report #8) and the Q1 A ruling: Strength adds a d10 to every damage roll the hero
makes, for 100 squares, no hit points, a recast restarts it.

- **The d10 is an AMOUNT draw on a derived stream, never the main rng.**
  `derived.js#strengthRoll(sheet, rng)` returns 0 unless a live `spell:Strength` record
  (act kind `"strength"`) is on the sheet; otherwise
  `rollDice(derivedRng(<main rng cursor, or 0 for a test double with no getState>, "strength"),
  { n: 1, sides: 10, bonus: 0 })`. The main rng is only READ for its cursor; no existing draw
  moves, and a run with no live record draws nothing at all. It is called right AFTER a damage
  roll's own dice are drawn, so the cursor has moved since the previous roll and each roll gets
  its own d10 (both blows of a double strike, each foe a Lightning bolt reaches, each Fireballs
  bolt).
- **Its sites, under the ruled reach (Q1 A).** `weaponDamage` (every weapon blow: the strike,
  both blows of a double strike, Sweep, Riposte, a Joiner's blow on its own sheet), then the
  spell damage rolls in `magic.js#castSpell`: the thrown hit (and so each foe of Lightning),
  Earthquake's one roll (every foe takes it; the caster's own backlash stays the dice alone) and
  each Fireballs bolt. A damage-over-time tick (Acid, Ice, Poisoned Edge) is not a new damage
  roll and calls nothing. The d10 joins the roll before the Sorcerer's cap of 9, the floor of 1,
  Afraid halving and the damage multiplier seam; a critical doubles the roll with the d10 in it.
- **The cast draws nothing.** The old cast rolled one main-rng d10 into `c.might`
  (`rollDice(rng, sp.dmg)`); the new cast starts a timer record and draws no die. The `magic.js`
  AMOUNT draw count drops by one (the might branch), and the fumbled-scroll Strength rolls its
  foe's flat d10 from the fumble stream (`srng`) as before.
- **No check-direction change.** No check or threshold was added or flipped.

## Phase 90 plan 04: one depth-rising resist for every spell; Petrify, Blind, Stupidity (SPELL-12, user 2026-09-30)

"Rising resists on higher floors should apply to ALL spells and spell-like effects (staves
included) ... remove the floor-12 special effects only." (the Phase 89 checkpoint, confirmed
for damage spells after 89-08: "I'm good with that"). Phase 89 plan 08 built the shared helper
for items and staves; this plan moves every spell onto it.

- **The spell resist row.** Every spell a foe can resist (the hero's cast, a scroll's free cast,
  a Joiner's `allyCast`) rolls `combat.js#foeResistsSpell`, which now IS
  `foeResistsEffect`: `derived.js#risingResistFaces(depth, intel)` on the `spellResist`
  derived stream (faces = `min(19, round(a + c - a*c/20))`, `a` the half-intel faces, `c` the
  floor faces from floor 13). At or below floor 12 it is `resistFaces(intel)` byte for byte.
  Intelligence 10: 16–20 up to floor 12, 15–20 at floor 13, 10–20 at floor 20. No spell rolls
  the RULES-18 control resist (`resistControl`) any more, and no spell keeps a hold (`holdFoe`
  with `controlHoldRoundsFor`) or a cap (`controlCapRounds`); the Bard's `sing` is the one
  caller left (Phase 91, IDENT-17). Display: the combat menu's resist hint and the foe card read
  `risingResistFaces(depth, intel)`.
- **Main-rng draws that moved (floors 13 and deeper only).** The one resist is a derived-stream
  roll, so it draws nothing itself. What moved is WHEN a resisted foe stops drawing: the old
  past-floor-12 control resist came AFTER the effect's own draw (a Doze's d4, a Stun or Shrink or
  Noxious Vapor foe's d4 / d6, Insane's nap d4), so a control-resisted foe still consumed it; the
  one resist comes BEFORE it, so a resisted foe draws none of them. At or below floor 12 nothing
  moved (the half-intel resist already came first).
- **Petrify (Q2 A) skips draws.** A landed Petrify calls `killFoe(..., { spoils: false })`: the
  experience `rng.d(6)` ([roll:amount], unchanged position) is taken, and the coin
  `rng.d(10)`, the treasure gate d20, the bag gate d20 and the cooking d6 are NOT. The old
  removal (no `killFoe`) drew nothing. Net: a Petrify takes one main draw more than before and
  three to five fewer than a normal kill of the same foe. `DRAW_INVENTORY`'s tagged draws are
  unmoved (`killFoe`'s lines keep their tags; the skip is an early return).
- **Stupidity** sets `t.intel = 1` (no draw) and no longer skips the foe's turn: a stupid
  foe's `foeTurn` now takes its to-hit draw and its damage draw like any foe (before: none).
  **Blind** deletes `blindFor` and never lets a blind foe crit (no draw changes: the to-hit and
  damage draws are unchanged, only the doubling is dropped).
- **Check direction.** No check or threshold was flipped. The blind cap moved from the first term
  of `foeSwingChain` to the last, so an insulted party faces one winning face (the top face) of a
  blind foe where it used to face two; the `foeToHitVs` mods read `penalty`, `insulted`,
  `blind` in that order. FLAGGED ASSUMPTION for the user's review.

## Phase 90 plan 05: Doze and Stun swapped, Ice freezes the room (SPELL-11, SPELL-12, user 2026-09-30)

The user's rulings (docs/SPELL-AUDIT.md "## Rulings", Q3 A, Q4 A, Q5 A) and the SPELL-11 and
SPELL-12 lines: "Doze sleeps d4 foes for d4 rounds and a hit wakes a dozing foe; Stun holds one
foe for d4 rounds and a hit does not end it." "Ice is an area d10 to every foe with a chance to
freeze each target 1d4 rounds." Three shared tails in `engine/combat.js` (the hero's cast, a
scroll's free cast and a Joiner's `allyCast` all call them, the Joiner's name on every line) and
one new line in the damage seam.

- **Doze: `combat.js#dozeFoes`** (the old castSpell status branch, a first-live-foe single d4, and
  allyCast's single nap are gone). Draw order: (1) the REACH, one `rng.d(4)` [roll:amount], drawn
  first on the main rng; no level multiplier (Q4 A: exactly d4 foes); (2) the reached foes are the
  aimed foe when it is alive, then the other live foes in `C.foes` order, the first `reach` of
  them; (3) per reached foe in that order the ONE depth-rising resist (`foeResistsSpell`, a
  derived stream: no main draw) and, only when it fails, that foe's own `rng.d(4)` [roll:amount];
  `f.asleep = max(f.asleep, d4)` (a longer sleep it already has stands) and `f.dozing = true`.
  A cast that sleeps nobody pushes one `dozeFailed` line. `f.dozing` is the one new serialized
  field (combat-scoped, on a foe); it is carved out of ALL THREE `*Comparable()` functions
  (`stripFoeAbilityState`'s per-foe destructure) and tolerant on load (absent means a plain sleep).
- **The wake: `foeDamage.js#damageFoe`.** After the damage is applied, a foe with `dozing` loses its
  sleep (`asleep = 0`, the mark deleted) and a `foeWoke` line is pushed unless the hit killed it. A
  blow the ward or the natural armour absorbed returns earlier and wakes nobody. No draw. Any
  damage through the seam wakes it, whoever deals it (a blow, a spell, an acid tick, a Joiner).
  Q3 A: only Doze sets `dozing`; Noxious Vapor's, Insane's, a staff's and a song's sleeps stay
  plain sleeps a hit does not wake. `foeTurn` clears the mark when the sleep runs out (the asleep
  skip and the held skip).
- **Stun: `combat.js#stunFoe`.** The old branch (`d6 × max(1, level − spell level)` foes, a resist
  and a d4 each, `stunned { count }`) is gone. Stun is a single-target spell
  (`SINGLE_TARGET_KINDS.stun = "target"`): the aimed foe's one resist up front (a dead pick falls to
  the first live foe), then ONE `rng.d(4)` [roll:amount] and `holdFoe` kind `stunned`. A Joiner
  rolls the resist in `allyCast` and then calls the same tail. The hold is the existing held skip:
  the foe loses that many of its own turns, a held foe is struck on at least 5 winning faces, and a
  blow never ends it.
- **`holdFoe` never shortens.** `holdFoe(state, foe, kind, source, events, { rounds, freeze?, dmg?, by? })`:
  `rounds` is required (the `controlHoldRoundsFor` depth default is gone). When the foe already
  holds with MORE rounds left than the new cast's, the longer hold (its kind and its rounds) stands
  and the new cast's line still names the hold in force. No draw.
- **Ice: `combat.js#iceStorm`** (kind `blast`, `aoe: "all"`, `onHit: "freeze"`, `dmg` d10; the old `dot`
  kind, its `f.dot` record, `iceApplied` and foeTurn's frozen-solid payoff are gone; a fumbled Ice
  is an area damage row, Lightning's shape). No to-hit roll and no up-front resist. For each live
  foe in `C.foes` order: `rollDice(d10) + strengthRoll + level² + spellDmg` (Strength adds its d10
  per Q1 A, from its derived stream; Afraid and the difficulty seam apply to the hero's cast only,
  like a thrown spell), then `damageFoe`; a foe the damage kills is a normal `killFoe` (no freeze
  line); a survivor goes through `freezeFoe`: its existing d4 [roll:amount] right after the
  damage, then the one resist (which stops only the freeze), then a `frozen` hold. The foe-by-foe
  order is damage, that foe's freeze, then the next foe. `iceStorm` adds no `.d(` of its own.
- **`DRAW_INVENTORY`.** `combat.js` amount 20 → 22 (+3 tagged draws: the Doze reach, the per-sleeper
  d4 and the Stun hold d4; −1: allyCast's old sleeping d4); `magic.js` amount 17 → 13 (−4: Stun's
  d6 reach and per-foe d4, Doze's d4, the dot branch's duration d4). Every other count is unmoved.
- **Main-rng draws that moved.** Doze: one d4 (the reach) before the first resist; a resisted
  reached foe draws no sleeping d4. Stun: one d4 total (before: a d6 and a d4 per foe that failed
  its resist). Ice: one damage die and, for a survivor, one freeze d4 PER FOE (before: one d4 for
  the whole dot's duration). A Joiner's Doze and Stun likewise. At floor 12 and below the one
  resist already came first, so only these counts moved.
- **Check direction.** None flipped; no check was added (Ice has none, Stun and Doze never rolled one).
  The one resist is unchanged (`risingResistFaces`).

## Phase 90 plan 08: Stop Time, Senseless, Duplicate Foe, and the misdirected swing (SPELL-10, user 2026-09-30)

The accepted slate (`90-SPELL-SLATE-DRAFT.md` wiring B and C) with Q6 A (+1 round per school bonus
point on a round-timed new spell, `derived.js#spellEffectRounds`). Two shared tails in
`engine/combat.js` (the hero's cast and a scroll's free cast call them now; a Joiner's cast will in
90-10) and one new turn shape in `foeTurn`.

- **Stop Time: `combat.js#stopTime`.** No main-rng draw at all. For each live foe in `C.foes` order, the
  ONE depth-rising resist (`foeResistsSpell`, a derived stream); a foe that fails it is held kind
  `"time"` for `holdRounds` (2) + the caster's Special school bonus (`holdFoe`, never shortening a
  longer live hold). One closing `timeStopped { count, rounds }` line (count 0 when every foe resisted).
- **Senseless and Duplicate Foe: `combat.js#misdirectFoe`.** NEW main-rng draw: the duration dice
  (`rollDice(rng, sp.rounds)`: d4 for Senseless, d4+1 for Duplicate Foe), drawn once at the cast after the
  picked foe's up-front resist (`SINGLE_TARGET_KINDS.misdirect = "target"`, a derived stream; a Joiner's
  cast rolls it inside the tail). `rollDice` goes through `dice.js`, so the line has no `.d(` of its own
  and no roll tag. Duration = the dice + the caster's Illusion school bonus (+0 for the Illusionist and
  the Apprentice, the only sub-classes that learn the school). The record is `f.misdirect = { at, left }`
  (`at` "friends" or "self"); a longer live record stands (its aim and rounds).
- **The misdirected turn: `combat.js#resolveMisdirectedTurn`**, called from `foeTurn` right after the
  held, asleep and stunned skips (a turn those take never spends `left`) and before the flee check and the
  ability gate (a caster does not cast). Per swing (`frenzied` doubles, `sp.atk` multiplies, as the foe's
  own turn), in the same positions the foe's own hero swing draws:
  1. the to-hit, one `rollCheck(rng, foeDie(null, f), atLeastFor(faces, dieN))` on the MAIN rng
     [rollCheck call, +1 in `engine/combat.js`]. `faces` is `derived.js#foeSwingVsFoe`: `5 + FOE_ACCURACY`,
     no body's defences (no race, size, class, gear, Mirror Self or invisibility of anyone's), blind caps
     it to 1 (the top face). Weaken's `foeToHitPenalty` cap is NOT applied (a Weaken halves the foe's blows,
     below).
  2. on a hit, the damage dice, `rollDice(rng, f.sp.dmg)` or `rng.d(6)` [roll:amount, +1 in
     `engine/combat.js`], exactly as the normal swing: a top-face roll is a crit that doubles the dice
     unless the foe is blind (a blind misdirected foe never crits); `foeHitFor(foeLevelBase(f) + dice, curve,
     elite)`, then Weaken's, Shrink's and Hamstring's halving (each `ceil(/2)`, independent). The per-round
     damage ceiling is NOT applied: it guards the hero's side, and this blow is aimed at a foe.
  3. the blow goes through `damageFoe` (kind `"foe"`: the victim's natural armour may soak it, one more
     gated d20 exactly as Insane's strike-an-ally; a ward may absorb it) and a kill through `killFoe`, so
     the hero is paid its experience and spoils.
  The victim is `f` itself (`at: "self"`) or the first other live foe in `C.foes` order (`at: "friends"`, the
  pick Insane's strike-an-ally makes: deterministic, no draw). With no other foe the foe swings at the air
  once (`foeSwingsAtAir`, no draw) and the turn is lost. `pickFoeTarget` is never called, so no blow
  reaches the hero or a Joiner. After the swings `left` counts down once; at 0 the record goes with one
  `foeMisdirectEnded` line.
- **Draw order, summed.** Cast: [the picked foe's resist: derived, no main draw], then the duration dice
  (one main draw per die). Each later foe turn the foe takes: to-hit (1), then, on a hit, the damage dice
  (1 for `rng.d(6)`, or the foe's `sp.dmg` dice), then, only if the victim has natural armour and the
  blow is no crit, the soak d20. Before this plan a misdirected foe did not exist, so no existing run's
  draw stream moved: only a book or a scroll that reaches one of the three spells changes a run.
- **DRAW_INVENTORY** (`test/unit/roll-high-guard.test.js`): `engine/combat.js` `rollCheck` 23 -> 24 and
  `amount` 22 -> 23.
- **Check direction.** One new check, the misdirected to-hit, read roll-high through `rollCheck` like every
  other foe swing (a bigger need is more winning faces, the foe's); nothing flipped. The resist is the one
  shared rising resist, no floor-12 extras.

## Phase 90 plan 09: Door Illusion, Chameleon Tongue, Size of the Behemoth, and the Illusionist's book (SPELL-10, user 2026-09-30)

The last three of the accepted slate (`90-SPELL-SLATE-DRAFT.md` wiring D: the flee path Smoke uses,
`parley()` at fluency 2, Insane's flee outcome) and the Illusionist's canon p.17 grants. No new main-rng draw
anywhere in the three spells.

- **Door Illusion: `combat.js#doorIllusionEscape`.** No main-rng draw. The cleverest live foe (highest
  `intel`, the first in `C.foes` order on a tie) rolls the one depth-rising resist (`foeResistsSpell`, a
  derived stream); a resist is `doorIllusionSeen` and nothing else, otherwise the Smoke flee path: no flee
  roll, no `pursuitStrike` (no parting blow), `forfeitLoot`, `fled { reason: "door" }`, `endCombat`. A hero
  `combat.js#fleeRefusal` names (the Samurai) is refused in `castSpell` before the charge, with no draw.
- **Chameleon Tongue.** The cast sets the fight-scoped `C.tongue = 2` and calls `parley()`, which draws
  exactly what an ordinary parley draws, in the same positions: the parley roll (one `rollCheck` on a d20,
  `engine/combat.js`, an existing site), then, on a success, the experience d6 per foe (`killSpFor`) and, for
  Humans, the wilmst `d6 === 6` check and its amount. `fluency(c, C)` is 2, so the roll's bonus has `2 × 2`
  = +4 and the Magical gate opens. `castSpell` returns after `parley()`: a failed parley already runs the
  foes' turn (`afterPlayerAction`), so it is never run twice. A cast `parleyBlockedReason` refuses is
  refused before the charge and draws nothing.
- **Size of the Behemoth: `combat.js#behemothRoar`.** No main-rng draw. Each live foe in `C.foes` order rolls
  the one resist; a failer below the caster's level is routed (`alive = false`, `fled = true`), any other
  failer gets `f.cowering = true` (no draw: `derived.js#foeSwingChain` caps its swings at 3 faces and
  `foeWeakened` halves its damage, a swing it takes draws exactly what its normal swing draws).
- **The Illusionist's book: `character.js#rollGrimoire`.** One new DERIVED draw, `dr.d(rest.length)`
  [roll:selection, +1 in `engine/character.js`], the pick of one Illusion spell the book does not hold, made
  at the very end of the function (after every existing `dr` draw, so none of them moves; the main rng is
  untouched, `chargen-rng-pin` stays 33 for the Illusionist). Door Illusion is pushed with no draw when it
  was not rolled.
- **A fumbled scroll.** `insulted` (a fumbled Chameleon Tongue) sets `C.parleyInsulted`, no draw; a fumbled
  Behemoth is the existing `weakened` effect (one d4+1 on the fumble's own derived stream); a fumbled Door
  Illusion draws nothing.
- **DRAW_INVENTORY** (`test/unit/roll-high-guard.test.js`): `engine/character.js` `selection` 13 -> 14.
- **Check direction.** The Tongue's parley check is the existing roll-high parley; nothing flipped. Every
  resist is the one shared rising resist, no floor-12 extras.
