# Phase 77: Combat Screen & Oracle Readability - Context

**Gathered:** 2026-09-25 (collected ahead, while Phase 72 wave 5 executed)
**Status:** Ready for planning

<domain>
## Phase Boundary

Everything the player reads during a fight is legible, correctly ordered and honest, and it shows what effects are live on them, their party or their foes (CMBUI-07..13).

**In scope:**
- Submenu row fit and spell order.
- The foe family on foe cards.
- Oracle chronological order.
- The scroll-in-combat refusal line.
- The oldest fight-log row being tappable.
- Live effect indicators on the hero/party side, plus full coverage on the foe side.

**Not in scope:**
- Roll/modifier formatting (Phase 74 owns the formatter; this phase reuses it).
- Content prose rewrites (Phase 79).
- The HUD/dead-state work (Phase 78).
</domain>

<decisions>
## Implementation Decisions

### Live effect indicators — CMBUI-13 (user accepted 2026-09-25)
- **ONE source, no parallel chip system (orchestrator scout, 2026-09-25).** Hero status chips already exist:
  - the pure enumerator is `engine/derived.js:581` `conditionsOf(state)`, bridged as `window.__mzConditionsOf`;
  - the labels live in `mazeworld.html` `CONDITION_COPY` (~L3013);
  - they paint through `paintConditions` (~L3227) into `#mm-conditions`;
  - the Phase 71 POLISH-11 tap-for-description card in combat is `src/browser/rail.js` `conditionCard`/`COMBAT_CARD_KINDS`.
  They cover conditions, the ward (Shield), flight, item cooldowns, affliction and `foeEffect`, but NOT ability effects like Smoke, which is the user's report.

  CMBUI-13's hero/member side EXTENDS that one enumerator and copy table to cover every ability/spell effect. The YOUR LOT chip row below renders from the SAME enumerator. Extending `conditionsOf` is a pure derived-function change (no state, no rng, no fixture moves). The coverage guard (below) is written against it.
- **Hero and party side:** a chip row under the hero AND under each party member in YOUR LOT.
  - The chips use the same house style as Phase 71's foe chips: one capitalised word, with " · n" when timed ("Smoke · 2", "Sidestep · 1", "Shield · 3", "Senses"). Tone good/bad follows the chip's effect on the player.
  - A TAP on a hero or member chip opens a small description sheet with what it does, the rounds left and where it came from (ability, spell, item, foe power, scroll). YOUR LOT is not a targeting surface, so tap is free.
- **Foe side:** keep Phase 71's model. A tap on a foe card (including its chips) AIMS at that foe, and a foe effect's description stays on LONG-PRESS (the foe details card). Extend coverage so every foe-side effect has a chip, including effects from this milestone (a foe shielded by a fumbled scroll, Phase 75.1).
- **What counts:** every effect that changes a roll or the flow of this fight, whatever its source, buffs and debuffs alike:
  - abilities (Smoke, Sidestep, Battle Roar, Riposte, Taunt, Guard …)
  - spells (Shield, Sense Presence, Mirror Self, invisibility …)
  - conditions (Afraid, Dazed, Inspired …)
  - a foe's power on you (Weaken, Freeze …)
  - item-driven effects that matter in a fight (Night Vision, or a lit torch in a dark fight)
  - scroll-fumble effects.
- **Coverage guard:** a hero-side coverage test, mirroring `test/unit/foe-conditions.test.js`, scans the engine for every hero/member effect field, timer and combat flag. Each must map to a chip entry or sit on a reasoned NOT_A_CONDITION list. A new effect with no chip fails the build, and the engine is never edited to satisfy it.
- **Rounds:** " · n" for timed effects. There is no number for until-end-of-fight or conditional effects ("until you're found", "your next hit"); the tap sheet explains those. The chip clears the moment the effect ends.
- Chip numbers and signs use Phase 74's formatter (player-view signs; ranges like "18–20" where a chip states odds).

### Readability fixes — CMBUI-07..12 (user accepted 2026-09-25)
- **User report 2026-09-25:** Lesser Summon (lvl 1, SPELLS row 32) must list with the level-1 spells. The CMBUI-08 sort covers it; pin it with a test. (The "summon missing from YOUR LOT" report was WITHDRAWN by the user: it does show.)
- **CMBUI-14 (user, 2026-09-25; todo `2026-09-25-combat-items-mark-equipped-grey-out-unusable-bag-gear`):** in the combat ITEMS submenu (`combatMenu.js` ~L254-326):
  - worn rows show EQUIPPED;
  - bag rows whose activation needs the item worn (jewelry, cloak, staff) are DISABLED with a reason ("NOT EQUIPPED · can't swap mid-fight");
  - bag potions and consumables stay enabled;
  - the "N USABLE" header counts only enabled rows.
  Presentation only.
- **CMBUI-07/08:**
  - Every combat submenu row (spells, abilities, items, social) GROWS to fit its full label and description on the Pixel 7, with no clipping and no truncation. Today `.cb-row-label` has `overflow:hidden` and the list is capped at `max-height 206px`.
  - Spell rows sort by spell level ascending, then A–Z. (Level-locked spells are already hidden by Phase 75's RULES-04.)
- **CMBUI-09:** each foe card shows the bestiary family after the name on the name line, e.g. "ZIT · BEASTS". The family comes from the spawned foe record's `type` (Beasts / Demons / Humans / Lair Beasts / Magical / Walking Dead). It stays HIDDEN while the foe is an unidentified "SOMETHING", matching foe details' FAMILY UNKNOWN.
- **CMBUI-10:** the Oracle prints combat lines strictly in the order they happened. Only back-to-back identical lines fold ("×2"). Today `narrationLines.js` sorts the fold by PRIORITY then index; time must become the key.
- **CMBUI-11:** a scroll read in combat that casts never narrates a refusal. At most, AFTER the cast, it says "too advanced to copy into your book" (the `scrollTooAdvanced` line, in `narrationLines.js:1473` and `eventNarration.js:783`). This must stay coherent with Phase 75.1's new read/fumble lines.
- **CMBUI-12:** the oldest (last) row of THE FIGHT SO FAR can be tapped to reveal its roll like every other row.

### Claude's Discretion
- The chip sheet's visual design (within the parchment UI and PNG-icons canon; reuse existing icons where they exist).
- How the hero-side chip table is structured (mirror `foeConditions.js`'s one-table rule).
- Plan split: the indicators are one plan pair (table + guard, then the YOUR LOT UI), and the five readability fixes are independent small plans.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/foeConditions.js` (Phase 71 POLISH-09): the one table of foe conditions, with house label style, `FOE_CONDITION_DESC` one-line descriptions, tone good/bad, and the coverage guard `test/unit/foe-conditions.test.js`. This is the template for the hero side.
- `src/browser/combatPanel.js`: the foes view-model; `opts.chipsFor(foe)` from the shell's `foeStatusBadges`.
- `src/browser/foeDetails.js`: the long-press card (`FOE_DETAILS_COPY`, "FAMILY UNKNOWN").
- `src/browser/narrationLines.js`: PRIORITY (L63-67), the fold (~L360-380, ~L966).
- `src/browser/fightLog.js`: THE FIGHT SO FAR.
- `src/browser/combatMenu.js:150-166`: spell rows, built in SPELLS array order.
- `mazeworld.html`:
  - `.cb-row` ~L644 and `.cb-row-label` ~L647 CSS.
  - `renderActionArea` ~L3171-3200.
  - `renderFoeCards` ~L2956-2995.
  - The fight-log sheet ~L1767-1788, ~L2056-2075, ~L3848-3915, ~L5473-5520.

### Established Patterns
- One-table rule and coverage guards for chips. Voice-scanned frozen copy objects. "HP not WP". PNG icons are canon.
- Rail and Oracle split: a card only for decisions and big updates; minor events are toast-only.

### Integration Points
- Phase 74's formatter for any number or sign on a chip.
- Phase 76's rehydrated combat, so chips must render correctly after a relaunch mid-fight.
- Phase 75.1's scroll read/fumble lines, which must read coherently with CMBUI-11.
</code_context>

<specifics>
## Specific Ideas

- The user's trigger: "When I use the ability smoke, I have no indication on myself or the enemies that it's active. I only know it by going into my ability list. Abilities and spells all need to have some sort of active indicator while in combat."
- The Pixel 7 checks at milestone close:
  - submenu rows are fully legible;
  - Smoke shows "Smoke · n" on the hero and clears when it ends;
  - the foe family shows;
  - Oracle order is correct;
  - the oldest log row is tappable.
</specifics>

<deferred>
## Deferred Ideas

- None.
</deferred>
