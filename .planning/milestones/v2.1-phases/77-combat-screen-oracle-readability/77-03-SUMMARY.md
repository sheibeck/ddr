---
phase: 77-combat-screen-oracle-readability
plan: 03
subsystem: combat-ui-data
status: complete
tags: [CMBUI-13, conditions, chips, coverage-guard, roll-display]
requires:
  - engine/derived.js#conditionsOf (DR15-B, 74-07, 75.1-04, 76-01 darkLimited/darkWaiver)
  - src/browser/foeConditions.js (the one-table template)
  - src/browser/rollOdds.js#heroHitOdds, src/browser/rollRange.js
provides:
  - conditionsOf descriptors ability, braced, inspired, halfNext, strengthBoost, nightVision, fightDark, insulted, selfDot
  - engine/derived.js#memberConditionsOf(state, partyIdx)
  - src/browser/heroConditions.js (HERO_CONDITIONS, HERO_CHIP_COPY, LASTS, SOURCES, lotChips, chipText, chipSheetFacts)
  - conditionEffects.js WHAT_IF.ability/inspired/fightDark/nightVision and the "(live instead of without)" lead
  - test/unit/hero-conditions.test.js (hero/member engine-scan coverage guard)
affects:
  - 77-08 (draws YOUR LOT chips and the tap sheet from these)
  - the HUD condition strip (mazeworld.html paintConditions shows the new keys raw until 77-08)
tech-stack:
  added: []
  patterns: [one-table rule, engine-scan coverage guard, shallow what-if measurement]
key-files:
  created:
    - src/browser/heroConditions.js
    - test/unit/hero-conditions.test.js
  modified:
    - engine/derived.js
    - src/browser/conditionEffects.js
    - test/unit/conditions.test.js
    - test/unit/conditionEffects.test.js
    - test/unit/status-chit-combat.test.js
    - test/unit/roll-sign-consistency.test.js
    - test/unit/hp-not-wp.test.js
decisions:
  - "Hero ability chips (and member chips) are fight-only: an ability:<id> record in phase effect with left > 0 shows only while state.combat exists"
  - "fightDark shows only with no darkFor counter running (the darkness chip covers that case) and only while toHit's dark cap is live (darkLimited and no Sense Presence)"
  - "nightVision shows in a fight whenever inDark holds and darkWaiver reports nightVision (a running darkFor counter included)"
  - "The Dazed lead is pinned to the engine's measured '−2 to hit (18–20 instead of 16–20)', not the plan's illustrative '(19–20 instead of 17–20)'"
  - "status-chit-combat (h) carries an exact AWAITING_77_08 exemption for the 8 new keys until 77-08 writes their shell copy"
metrics:
  duration: "~27 min"
  completed: 2026-09-26
  tasks: 3
  files: 9
---

# Phase 77 Plan 03: Hero and party effect indicators (data half) Summary

`conditionsOf` now lists every live hero effect that changes a roll or the flow of a fight. That includes Smoke, Sidestep, Battle Roar, Riposte, Taunt, Brace, Inspire, a parley insult, a fumbled scroll's burn, the Pendant, Strength and fighting in the dark. A new sibling, `memberConditionsOf`, does the same for each party member. `heroConditions.js` is the one table that says how each chip is shown, and an engine-scan guard fails the build when a new effect has no chip. Every chip that moves a to-hit roll now states the live range and the range without the effect, both measured from the engine.

**Plan base SHA:** `b7d33827ad6a5429ed2e38011ea8470030de81bf`

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | dd587c99 | conditionsOf covers every live hero effect; memberConditionsOf for the party |
| 2 | 19240899 | heroConditions.js, the one hero/member chip table, and its coverage guard |
| 3 | e542c7e0 | measured effects for the new chips and the "instead of" lead |

## New descriptors (engine/derived.js)

The new descriptors are appended in fixed places. Every older descriptor keeps its exact shape and relative order, and no pre-existing `conditions.test.js` pin moved.

| key | polarity | shape | where | fight | lasts | source |
|-----|----------|-------|-------|-------|-------|--------|
| ability | good | `{ability, remaining, cadence:"rounds"}` | right after the live item effects, c.timers order; fight-only | true | rounds | ability ("from your Smoke") |
| braced | good | `{}` | end of good block; fight-only (C.braced, or a member's allies entry) | true | nextBlow | ability ("from your Brace") |
| inspired | good | `{amount}` | end of good block; fight-only | true | fight | song |
| halfNext | good | `{}` | end of good block; anywhere | true | nextBlow | item ("from Pendant of Fortitude") |
| strengthBoost | good | `{amount}` | end of good block; anywhere | true | day | spell |
| nightVision | good | `{}` | last of good block, before itemCooldown/staffCharges; fight-only | true | fight | trait ("from your own eyes") |
| fightDark | bad | `{}` | end of bad block; fight-only, no darkFor, cap live | true | fight | dark |
| insulted | bad | `{}` | end of bad block; fight-only | true | fight | insult |
| selfDot | bad | `{remaining, by, spell}` | last of bad block; fight-only, left > 0 | true | rounds | scroll |

`memberConditionsOf(state, i)` returns the member's live ability chips from `state.party[i].timers`, then `braced` from the `state.combat.allies` entry with that partyIdx. It returns `[]` for a missing combat, member or timers, a bad index, or a malformed state, and it never throws.

### The full HERO_CONDITIONS table (fight / lasts / source)

- **Live item effects:**
  - haste T/squares/item
  - invis T/squares/item
  - acute T/rounds/item
  - ether F/squares/item
  - enlarge T/squares/item
  - giant T/squares/item
  - glow T/squares/item
  - unseen T/squares/item
  - tongue F/squares/item
  - brace (Cloak of Strength) T/squares/item
  - plate T/squares/item
  - power T/squares/item
  - lit T/squares/item
  - flight F/squares/item
- **Abilities and spells:**
  - ability T/rounds/ability
  - might T/day (squares when potion)/spell (item when potion)
  - ward T/rounds (nextBlow for an armed mirror)/spell
  - mirror T/rounds/spell
  - senses T/fight/spell
  - regen T/fight/spell
  - foresight F/nextFight/spell
  - reveal F/squares/spell
- **Other good effects:**
  - braced T/nextBlow/ability
  - inspired T/fight/song
  - halfNext T/nextBlow/item
  - strengthBoost T/day/spell
  - nightVision T/fight/trait
- **Cooldowns and charges:**
  - itemCooldown F/squares/item
  - staffCharges F/charges/item
- **Bad effects:**
  - affliction F/untilCured/mishap
  - foeEffect T/rounds/foe
  - darkness T/squares/dark
  - fearArmed F/nextFight/fear
  - afraid T/rounds/fear
  - heroOut T/rounds/scroll
  - heroBlind T/fight/scroll
  - heroShrunk T/fight/scroll
  - fightDark T/fight/dark
  - insulted T/fight/insult
  - selfDot T/rounds/scroll

## NOT_A_CONDITION (test/unit/hero-conditions.test.js)

- **Hero sheet:**
  - wp, maxWP: the HP bar shows them. Strength's doubling has its own strengthBoost chip.
  - sp: the SP bar shows it.
  - vp: the sheet shows it.
  - level: the sheet shows it.
  - name: the hero's name.
  - sub: identity, not an effect.
  - abilities: the list known. A live one shows as its ability chip.
  - grimoire: the SPELLS menu lists them.
  - spellsUsed: the SPELLS menu's cost line counts them.
  - gold, rations: the HUD shows them.
  - potions, scrolls, items, patches: the ITEMS menu shows them.
  - worn, bag: the gear screen shows them.
  - staff: its charges show through staffCharges.
  - weapon, prof, magicWpn, armor, ar, armorMin, armorMax, armorWP: the sheet shows them.
  - kills: the graveyard count.
- **Hero bookkeeping:**
  - joiner: a party member gets its own YOUR LOT card.
  - phobiaType: a trait. It shows as Afraid only when it bites.
  - phobiaState: the terrain-phobia bookkeeping behind fearArmed.
  - dupAt: loot duplicate bookkeeping.
  - songAt: the once-a-day song bookkeeping.
  - pendingAlly: appears as its own card when the next fight starts.
  - scrollCast: set and cleared inside one read.
- **The fight:**
  - allies: each member has its own YOUR LOT card.
  - ally: its own YOUR LOT card with its rounds.
  - abilityStrike: consumed inside the same action.
  - cut, opened, opened2: spent openers, narrated by their own lines.
  - first: initiative.
  - target: the foe card shows it.
  - round: the header shows it.
  - pending: the pre-join marker.
  - pendingFoes: they arrive as foe cards.
  - spellOpen: the submenu flag.
  - parleyTried: the one parley attempt is spent.
  - foeToHitPenalty: the foe cards' Weakened chip shows it.
- **Member:**
  - backstabUsed: the once-a-fight backstab is spent.
- **Timers:**
  - Excused: `joiner:*`, a derived rng stream key rather than a timer.
  - Shown by the foe table: `spell:weaken`, as Weakened.
- **Covered through the foe table:** `weakened`.
- **Covered by hero entries:** `phobia`, via afraid's fields, and `skills`, via nightVision.

## Re-pinned lead strings (old → new)

| Test | Old | New |
|------|-----|-----|
| conditionEffects afraid (L1 Fighter) and the frozen-state test | −3 to hit (now 19–20) | −3 to hit (19–20 instead of 16–20) |
| conditionEffects afraid (L1 Magic User) | −2 to hit (now 20) | −2 to hit (20 instead of 18–20) |
| conditionEffects dazed | −2 to hit (now 18–20) | −2 to hit (18–20 instead of 16–20) |
| conditionEffects darkness | −3 to hit (now 19–20) | −3 to hit (19–20 instead of 16–20) |
| conditionEffects senses | +3 to hit (now 16–20) | +3 to hit (16–20 instead of 19–20) |
| conditionEffects heroBlind | −4 to hit (now 20) | −4 to hit (20 instead of 16–20) |
| status-chit-combat (a) AFRAID_LEAD (L3, d10) | −3 to hit (now 9–10) | −3 to hit (9–10 instead of 6–10) |

`roll-sign-consistency.test.js` had no old-lead string. Its afraid scenario gained a range-shape assertion (`/^−3 to hit \(… instead of …\)$/`).

The new measured leads are:
- Sidestep and Battle Roar: "+2 vs their swings".
- Smoke: "+(base−1) vs their swings", the measured override.
- Inspired: "+1 to hit (15–20 instead of 16–20)".
- fightDark: "−3 to hit (19–20 instead of 16–20)".
- nightVision: "+3 to hit (16–20 instead of 19–20)", or null when a torch or the Amulet also holds the dark back.
- Riposte, Taunt, braced, halfNext, selfDot, insulted and strengthBoost: null.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] status-chit-combat (h) R-32 guard failed on the new keys**
- **Found during:** Task 1
- **Issue:** Test (h) requires every key `conditionsOf` emits to have its own `CONDITION_EXPLAIN` sentence in mazeworld.html. That file belongs to 77-01 in this wave, and to 77-08, which writes these sentences in wave 3.
- **Fix:** Added an exact `AWAITING_77_08` list covering braced, fightDark, halfNext, inspired, insulted, nightVision, selfDot and strengthBoost. Any other key with no sentence still fails. The test also fails, and asks for the key to be dropped from the list, the moment 77-08 explains one of them. No assertion was weakened for any existing key.
- **Files modified:** test/unit/status-chit-combat.test.js (in this plan's files_modified)
- **Commit:** dd587c99

**2. [Measured value] The Dazed pin reads "−2 to hit (18–20 instead of 16–20)"**
- The plan's behaviour line gave "(19–20 instead of 17–20)" for a level-1 Human Fighter on a Club. That string is CONTEXT's illustration. heroHitOdds measures 3 live faces against 5 without the effect, so it gives 18–20 against 16–20. Phase 74's own pin already read "(now 18–20)". The test pins the engine's measured value and cross-checks the face counts through afraidNeed/toHit.

**3. [Process] Task 2 was not run RED first**
- In Task 2, heroConditions.js was written before test/unit/hero-conditions.test.js. The tests were never run against a missing module. Tasks 1 and 3 did run RED first (a missing export, then 14 failing cases).

No other deviations. No fixture moved, and no parity or state pin moved. prototype-master.js.txt and engine/abilities|combat|magic|items.js are unchanged since the base (`git diff --quiet` passes). FIXTURE-INVENTORY needed no entry.

## Verification

- `node --test test/unit/conditions.test.js …afraid/spell-utility/worn-model… "test/parity/**/*.test.js" test/unit/roll-high-state-pins.test.js`: 200/200 pass.
- `node --test test/unit/hero-conditions.test.js test/unit/hp-not-wp.test.js test/unit/foe-conditions.test.js`: 72/72 pass.
- `node --test test/unit/conditionEffects.test.js test/unit/status-chit-combat.test.js test/unit/roll-sign-consistency.test.js test/unit/rollOdds.test.js`: 80/80 pass.
- `npm test` after Task 3: 6816/6816 pass, 0 fail. After Task 1 it was 6785/6785.
- Acceptance greps: memberConditionsOf 1, HERO_CONDITIONS 1, lotChips 1, HERO_CHIP_COPY in hp-not-wp 5, "instead of" 4, "ability:" 4.
- Per the user ruling, no bot or balance runs were made.

## Notes for 77-08 (the drawing half)

- **Exports:**
  - `engine/derived.js`: `conditionsOf`, `memberConditionsOf(state, partyIdx)`. Both need bridging (for example `window.__mzMemberConditionsOf`).
  - `src/browser/heroConditions.js`: `HERO_CONDITIONS`, `HERO_CHIP_COPY`, `LASTS`, `SOURCES`, `lotChips(conds)` → `{key, sub, tone, rounds, cn}`, `chipText(label, chip)` → "Smoke · 2", and `chipSheetFacts(cn)` → `{lasts, source, detail}`. `detail` is ABILITY_BY_ID[id].txt for an ability chip.
  - `src/browser/conditionEffects.js`: `conditionEffectText(cn, state)`, which now handles `ability` / `inspired` / `fightDark` / `nightVision`.
- **Shell copy (mazeworld.html):**
  - Add a label and an explanation to `CONDITION_COPY` and `CONDITION_EXPLAIN` for every new key: ability, braced, inspired, halfNext, strengthBoost, nightVision, fightDark, insulted, selfDot.
  - An `ability` chip's label should come from an ability label table keyed by the ability id, or from ABILITY_BY_ID[id].name. Do not use the generic key.
  - Until then, the HUD strip shows these keys raw.
- **Tests to update:**
  - Remove each key from `AWAITING_77_08` in test/unit/status-chit-combat.test.js as it gets explained. The list must end empty, and then be deleted.
  - (h)'s vocabulary scan reads only the `conditionsOf` body, so it does not see `ability`, which is emitted from `liveAbilityChips`. Extend it to read `liveAbilityChips` and `memberConditionsOf`, as hero-conditions.test.js#emittableKeys already does.
- **Guard:** extend test/unit/hero-conditions.test.js so every HERO_CONDITIONS key with `fight: true` also has a shell label and explanation (CONDITION_COPY / CONDITION_EXPLAIN), and every DURATION_ROUNDS id has an ability label.
- **Member chips:** they carry no measured lead, because conditionEffectText measures the hero. The member sheet shows `chipSheetFacts(cn).detail`, plus lasts and source.
- **Stale docs:** mazeworld.html's comment near `__mzConditionEffect` and docs/ROLL-LEDGER.md still quote the "(now 19–20)" lead. Both are outside this plan's files.

## Known Stubs

None. The raw-key HUD strip between this plan and 77-08 is planned (flagged assumption) and tracked above.

## Self-Check: PASSED

- FOUND: src/browser/heroConditions.js
- FOUND: test/unit/hero-conditions.test.js
- FOUND: dd587c99, 19240899, e542c7e0
