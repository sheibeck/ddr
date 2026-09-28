---
phase: 79-content-narrative-pass
plan: 07
subsystem: combat-screen copy
status: complete
tags: [VOX-05, ROLL-04, narrative-pass, chips, combat-menu]
requires: [79-01, 79-03, 79-05]
provides:
  - audited combat-screen copy (chips, tap cards, the foe card, the combat menu)
  - docs/narrative-pass/why/79-07.json
affects: [79-09, 79-12, 79-13]
tech-stack:
  added: []
  patterns: ["a chip label per kind lives inside its CONDITION_COPY row (heroOut.kinds), read first by conditionLabel"]
key-files:
  created:
    - docs/narrative-pass/why/79-07.json
  modified:
    - mazeworld.html
    - src/browser/combatMenu.js
    - src/browser/foeConditions.js
    - src/browser/heroConditions.js
    - test/unit/combatMenu.test.js
    - test/unit/foe-conditions.test.js
    - test/unit/hero-conditions.test.js
    - test/unit/shell-combat-actions.test.js
decisions:
  - "heroOut chip: the two-word \"Can't act\" becomes one word per kind (Asleep/Stupefied/Maddened, fallback Helpless); the tap card now opens \"You cannot act:\""
  - "A foe's scaling die is described in faces (\"its die's top face\", \"top three faces\"), never a d20 range"
  - "The combat potion row keeps its own truthful line; the Gear tab's identical twin (79-09's gearTab.js) is handed on, not edited out of turn"
metrics:
  duration: ~55 min
  completed: 2026-09-27
  tasks: 2
  files: 9
---

# Phase 79 Plan 07: Combat-screen copy narrative pass Summary

Nineteen combat-screen strings were rewritten to match what the engine does. They cover the chip tap cards, the heroOut chip, the foe-card lines for Blind and Weakened, and the potion, flee, parley, sing and locked-spells menu rows. Every other string in 79-07's worklist passed the rubric and is unchanged. The owner's roll-under, hygiene and safety checks all read 0.

**Plan base:** `08969929` (master at dispatch).

## What changed (before → after)

### mazeworld.html: CONDITION_COPY and conditionLabel
| Key | Before | After |
|---|---|---|
| heroOut label | `Can't act` | `Asleep` / `Stupefied` / `Maddened` by `cn.kind` (`CONDITION_COPY.heroOut.kinds`), fallback `Helpless` |

`conditionLabel` has one new branch (`cn.key === "heroOut"`), placed before the generic fallback. This is the verdict on the 77-08 flag. The old label said what was happening but not why, and it was the one two-word chip. The tap card now opens with the fact the label used to carry.

### mazeworld.html: CONDITION_EXPLAIN
| Key | Before | After | Why |
|---|---|---|---|
| acute | You strike first on a d6. The maze is briefly unfair in your favour. | You strike on a d6, the best die there is, while it lasts. The maze is briefly unfair in your favour. | Acuteness swaps the strike die (strikeDie); it does not affect initiative |
| affliction | It takes a bite out of you on a schedule. Find a cure before it finds the rest. | It takes a few hit points as you walk, but never your last one. That is the nicest thing about it. | Ticks happen on steps and are floored at 1 hp |
| foresight | You already know what the next encounter is. Whether that helps is up to you. | You act first in your next fight, whatever turns up. Whether the warning helps beyond that is up to you. | The armed effect is only "you act first"; the named type is not bound to the fight |
| fearArmed | Something out there got to you. The next fight opens Afraid — harder to hit, softer blows — until it passes. | Something out there got to you: your next fight opens Afraid, −3 to hit and half damage on your blows until it passes, unless Hardiness shrugs it off. | "Harder to hit" read as a buff |
| unseen | They need two better to land a blow, and they know it. | Every foe has two fewer faces that hit you, and they know it. | ROLL-04 (ROLL-LEDGER (g)); matches the Anklet's 79-05 item text |
| tongue | You understand them perfectly. Whether that helps is up to them. | You can try a parley with anything but the Magical and the Walking Dead, and the roll gets two more faces. Whether they listen is up to them. | The old line gave no result |
| plate | Weightless plate over whatever you wear. It still will not make you graceful. | You soak blows as plate, or as your own armour if that is better, and none of it wears out. It still will not make you graceful. | armorSoak takes the better of the two; it does not stack |
| heroOut | The round goes on without you. … | You cannot act: the round goes on without you. … | The label now names the kind, so the card states the fact |
| heroBlind | Only the very best swing of the die lands. | Only your die's top face lands. | Stilted wording; now uses the faces phrasing |
| braced | The next blow that lands on you does half damage. Planning ahead, for once. | The next blow that lands does half damage. Planning ahead, for once. | A member's Brace chip reads the same line, so "on you" named the wrong body |
| inspired | The song is still ringing in everyone's ears, so every swing lands a little easier. | Your song is still ringing in your ears: your own strikes land one face easier. The party is pretending not to have heard it. | +1 goes to the hero's toHit only |

### src/browser/combatMenu.js: COMBAT_MENU_COPY
| Key | Before | After |
|---|---|---|
| potionDesc | Heals. Wasted at full health. | Heals 2d10+5 hp, doubled for a Wilmsry, and takes your turn. Greyed out at full health, where it would be wasted. |
| fleeDesc | Run. They get one swing at your back. | Roll to run. Fail and they all get a turn; get away and the loot stays behind. |
| parleyDesc | Talk it down. An insult is permanent. | One try per fight. Fail and they take it personally: every foe hits you and yours one face easier until it ends. |
| singDesc | One song per hundred squares. Pick the moment. | Sings the best song your level knows, then a hundred squares before the next. Pick the moment. |
| noCastableDesc | Your book holds spells above your level or school. Grow into them. | Every spell in your book is above your level or behind your school's level gate. Grow into them. |

### src/browser/foeConditions.js: FOE_CONDITION_DESC
| Key | Before | After |
|---|---|---|
| blind | It swings at where you were a moment ago and almost never lands. A count on the chip is how long until it can see again. | It hits only on its die's top face until it can see again: the count on the chip, or the whole fight if there is none. It is swinging at where you were a moment ago. |
| weakened | Every one of them does half damage while it lasts. They are not taking it well. | Every one of them hits on no more than its die's top three faces, and does half damage, while it lasts. They are not taking it well. |

### src/browser/heroConditions.js: HERO_CHIP_COPY
| Key | Before | After |
|---|---|---|
| lasts.untilCured | until something cures it | until it runs its course or something cures it |

Code comments in the HERO_CONDITIONS table were also updated to read roll-high (invis, unseen, mirror). The heroShrunk comment said "a size step down" and now says "your own blows halved"; the inspired comment now says the +1 is the hero's own.

### Judged and unchanged (passes the rubric)
- COMBAT_PANEL_COPY, all of it.
- FOE_DETAILS_COPY, all of it.
- CONDITION_EFFECT_COPY (the formatter-built clause templates).
- FOE_CONDITION_COPY labels and RESIST_EFFECT_WORD.
- COMBAT_COPY (the potion refusals and the fight-over lines).
- FOE_EFFECT_LABEL, FOE_EFFECT_EXPLAIN (77's Dazed wording), WAIVER_LABEL and ABILITY_CHIP_LABEL.
- The remaining CONDITION_EXPLAIN lines: haste, invis, ether, might, flight, darkness, afraid, ward, foeEffect, lit, itemCooldown, staffCharges, mirror, senses, regen, reveal, power, giant, enlarge, glow, brace, heroShrunk, ability, halfNext, strengthBoost, nightVision, fightDark, insulted, selfDot and default.
- Every other FOE_CONDITION_DESC line.
- The remaining COMBAT_MENU_COPY rows and HERO_CHIP_COPY phrases.
- The raw literals in combatMenu.js, combatPanel.js and conditionEffects.js.

## Verification
- `node tools/voice-inventory.mjs --owner 79-07 --roll-under --hygiene --safety --count` prints **0**. At the base it was 1: the unseen "need two better" line.
- `node tools/voice-inventory.mjs --check-ledgers --plan 79-07 --after` reports **0 errors**, and `node --test test/unit/voice-corpus.test.js` passes 27/27.
- `test/unit/roll-sign-consistency.test.js` passes and is unedited. The chip coverage guards (hero-conditions and foe-conditions) are green.
- `git diff --quiet 08969929 -- engine content test/parity src/browser/rollRange.js src/browser/rollOdds.js` exits 0, so the change stayed presentation-only.
- Full suite (`node --test`): **7,408/7,408 pass**, 0 fail.
- No shell snapshot, event-order corpus or fixture moved. None of the changed strings appear in `test/unit/fixtures/`, so nothing was regenerated and there is no FIXTURE-INVENTORY subsection.
- No bot runs, per the user ruling.

## Re-pinned tests
- `test/unit/hero-conditions.test.js`:
  - The affliction `lasts` phrase is re-pinned.
  - `LABEL_STYLE_EXEMPT` is now empty (heroOut was the last exemption).
  - A new check requires `CONDITION_COPY.heroOut.kinds` to cover every `effect: "out"` kind in content/scroll-fumbles.js, plus Vapor's asleep, with each label one word.
- `test/unit/shell-combat-actions.test.js`: the heroOut row pins the `Helpless` + `kinds` shape and the conditionLabel branch, and the tap-text pin now requires the "You cannot act" lead.
- `test/unit/combatMenu.test.js` (new pin): the potion, flee, parley and sing rows state the engine's rules.
- `test/unit/foe-conditions.test.js` (new pin): the blind and weakened lines state their to-hit effect roll-high, before the flavour.

## Deviations from Plan
The only deviation is on scope. `combatPanel.js`, `conditionEffects.js` and `foeDetails.js` needed no copy change. Of the plan's listed tests, only four needed edits: combatPanel, conditionEffects, foeDetails, status-chit-combat, your-lot-chips, hero-out-shell and combat-items-equipped all stayed green untouched. `hero-out-shell.test.js` never pinned "Can't act"; only `shell-combat-actions.test.js` and the `hero-conditions.test.js` exemption did.

## Handed on
- **79-09 (gearTab.js `GEAR_COPY.healingDesc`)**: this is the Gear tab's twin of the old potion row, "Heals. Wasted at full health.", pinned in `gear-panels.test.js`, `gear-view-models.test.js` and the `mu.gear` / `thief.gear` shell snapshots. It is inaccurate in the same way: it gives no heal amount and no turn cost, and the row is disabled at full HP. Bring it in line with the combat row: "Heals 2d10+5 hp, doubled for a Wilmsry, and takes your turn. Greyed out at full health, where it would be wasted." Note that the Gear tab may not spend a turn outside a fight, so adjust that clause if needed.
- **79-12 (content:SPELLS.Sense Danger.txt, owned by 79-05)**: the text says "names it before you meet it". But `engine/magic.js`'s foresee branch names `rng.pick(ENC_TYPES)`, which is never bound to the next encounter, so the name can be wrong. Only "you act first" is real. The Oracle's `senseDanger` line ("a bad feeling about the next …") is soft enough to stand.
- **79-12 (test/unit/shell-spells-40.test.js:226)**: its safety-wordlist phrase list still carries the old foresight sentence. It is a literal list checked only against BANNED, so it still passes, but it is stale.
- **79-10 (raw:mazeworld.html#markup)**: OWNER_RULES assigns the combat screen's static markup to 79-10, so this plan audited only the consts and conditionLabel.

## Known Stubs
None.

## Self-Check: PASSED
- FOUND: docs/narrative-pass/why/79-07.json
- FOUND: commit 99129192 (Task 1: the copy)
- FOUND: commit 4be96bc3 (Task 2: the re-pins and the ledger)
