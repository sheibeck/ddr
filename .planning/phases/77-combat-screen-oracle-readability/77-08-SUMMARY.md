---
phase: 77-combat-screen-oracle-readability
plan: 08
subsystem: combat-ui
status: complete
tags: [CMBUI-13, conditions, chips, your-lot, tap-sheet, dazed-honesty]
requires:
  - 77-03 (conditionsOf/memberConditionsOf keys; heroConditions.js lotChips/chipText/chipSheetFacts)
  - 77-04 (foe chips)
  - 77-06 (combatPanel.js foeFamily)
  - 76-06 (countdown-free reveal chip, the CONDITION_COPY fixed-detail slot)
  - 78-02 (text-scale rule for mazeworld.html font sizes)
provides:
  - "YOUR LOT chip rows (.cb-lot-chips / .cb-lot-chip) under the hero and each party member"
  - "mazeworld.html conditionLabel(cn) and conditionTapText(cn, label, state, opts), shared by the HUD strip and YOUR LOT"
  - "CONDITION_COPY/TONE/EXPLAIN rows for ability, braced, inspired, halfNext, strengthBoost, nightVision, fightDark, insulted, selfDot; ABILITY_CHIP_LABEL; FOE_EFFECT_EXPLAIN"
  - "combatPanel.js#yourLotViewModel(state, opts) with opts.chipsFor"
  - "window.__mzMemberConditionsOf and window.__mzHeroChips bridges"
  - "test/unit/your-lot-chips.test.js; the shell-table guard in test/unit/hero-conditions.test.js"
affects:
  - "the HUD condition strip's tap text (now adds how long and where from)"
  - "beatHurryTap (a YOUR LOT chip tap passes through)"
tech-stack:
  added: []
  patterns: [one label/tap-text composition for two surfaces, view-model chips via opts.chipsFor, shell-table coverage guard]
key-files:
  created:
    - test/unit/your-lot-chips.test.js
  modified:
    - mazeworld.html
    - src/browser/combatPanel.js
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/combatPanel.test.js
    - test/unit/hero-conditions.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/shell-spells-40.test.js
    - test/unit/status-chit-combat.test.js
decisions:
  - "A tap sheet reads: the measured lead, what it does, then '<how long>, <where from>.' from chipSheetFacts; an item-sourced chip skips the facts (explainCondition already names the item and its count)"
  - "A member chip's sheet has no measured lead (conditionEffectText measures the hero) and its source reads 'from their X', not 'from your X'"
  - "A YOUR LOT chip tap mid-beat is an inspection: beatHurryTap lets a .cb-lot-chip tap through, so the card rises and the round keeps playing (Phase 71 R-29)"
  - "heroOut keeps its shipped 'Can't act' label (RULES-10, pinned in shell-combat-actions.test.js); the guard's one-word rule exempts it with a reason"
  - "Explanations no longer repeat how long an effect lasts (might, senses, heroBlind, heroShrunk and the new keys), since the facts line says it"
  - "The chip CSS follows 78-02's text-scale rule (calc(<N/16>rem * var(--mw-text-scale))), not the plan's 'fixed px' assumption, which 78-02 superseded"
metrics:
  duration: "~70 min"
  completed: 2026-09-26
  tasks: 3
  files: 11
---

# Phase 77 Plan 08: YOUR LOT effect chips and their tap sheets (Summary)

During a fight, every live effect now shows as a chip under the hero's and each party member's card in YOUR LOT. Smoke, for example, shows as "Smoke · 1" the round it's used and clears when it ends. Tapping a chip opens the combat-legal condition card. The card gives the measured effect, what the effect does, how long it lasts and where it came from. It never aims, acts or dispatches. The HUD strip and YOUR LOT get their labels and tap text from the same two shell helpers, so a chip reads the same wherever it's tapped.

**Plan base SHA:** `e8bd4808afa8efafef6bf628f08f313f521b0576`

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | e4042711 | yourLotViewModel carries chips through opts.chipsFor; `__mzMemberConditionsOf` and `__mzHeroChips` bridged, registered, documented and twinned in the sandbox |
| 2 | 7863d3da | chip rows, conditionLabel/conditionTapText, copy for every key, shell-table guard, re-pins |
| 3 | 0856d1df | sandbox proofs on the real combat screen |

## What was built

- **`src/browser/combatPanel.js`:** `yourLotViewModel(state, opts = {})`. Every card now has `chips`.
  - The hero card gets `chipsFor({kind:"hero"})`.
  - Each member card gets `chipsFor({kind:"member", partyIdx})`.
  - The ally card always gets `[]`.
  - If chipsFor throws or returns something other than an array, that card gets `[]`.
- **mazeworld.html (classic):**
  - **`conditionLabel(cn)`:** paintConditions' label chain, moved verbatim, plus an ability branch that reads `ABILITY_CHIP_LABEL[cn.ability]`.
  - **`conditionTapText(cn, label, state, opts)`:** the one tap text, built as:
    - the measured lead;
    - then the darkness waiver sentence, or the ability's own content text, or explainCondition;
    - then " <How long>, <where from>."
  - **`darkWaiverOf(state)`:** the darkness waiver read, shared by the chip detail and the tap text.
  - **`sentenceCase`:** a small text helper.
  - **explainCondition:** a foeEffect chip now reads `FOE_EFFECT_EXPLAIN[cn.kind]` first, through `EXPLAIN_BY_KIND`.
  - **paintConditions:** now uses both helpers. Its chips, details and tone are unchanged.
  - **renderYourLot:** draws a `.cb-lot-chips` row of `<button class="cb-lot-chip" data-tone data-key>` under any card that has chips. Each chip goes through `guardInfoTap(..., lotChipArmed)` and opens `window.mzConditionCard(LABEL, chip.tapText())`. The arm stamp `lotChipArmedAt` resets when the YOUR LOT chip set changes.
  - **`yourLotChipsFor(V, ref)`:** reads V, the same view state the cards use. It maps `lotChips(conditionsOf(V))` or `lotChips(memberConditionsOf(V, i))` to `{text, tone, label, cn, tapText}`.
  - **renderEncounter:** passes `{ chipsFor: (ref) => yourLotChipsFor(V, ref) }`.
  - **beatHurryTap:** returns early when the tap target is inside `.cb-lot-chip`.
  - **CSS:** new `.cb-lot-chips` and `.cb-lot-chip` rules, with good/bad tone edge and ink, a minimum height of 22px, and wrapping text. The font size is scaled per 78-02.
  - **Module script:** imports `memberConditionsOf` and `lotChips/chipText/chipSheetFacts`, and assigns `window.__mzMemberConditionsOf` and `window.__mzHeroChips`.
  - **Comment fix:** the stale "(now 19–20)" comment now reads "(19–20 instead of 16–20)".

## Labels and explanations (for the Phase 79 narrative pass)

### New keys

| key | label | tone | CONDITION_EXPLAIN |
|-----|-------|------|-------------------|
| ability | Ability (fallback; ABILITY_CHIP_LABEL first) | good | "One of your own tricks, still working. The ability itself says what it does." (fallback; the sheet reads the ability's own content text) |
| braced | Bracing | good | "The next blow that lands on you does half damage. Planning ahead, for once." |
| inspired | Inspired | good | "The song is still ringing in everyone's ears, so every swing lands a little easier." |
| halfNext | Fortified | good | "The next blow that lands on you does half damage. The Pendant takes the other half personally." |
| strengthBoost | Bolstered | good | "Your hit points are doubled. When the day ends the extra goes, whether you spent it or not." |
| nightVision | Nightsight | good | "Your own eyes see in the dark, so the dark cannot make your strikes harder to land. Everyone else is squinting." |
| fightDark | Dark | bad | "You are fighting in the dark: every strike is harder to land and none of them can be critical. A light or Sense Presence would fix that." |
| insulted | Provoked | bad | "You insulted them and they took it personally: every foe finds it one face easier to hit you and yours." |
| selfDot | Burning (unit rds) | bad | "Your own fumbled scroll is still eating at you: a little damage every round until it runs out." |

### Ability labels and foe-effect sentences

- **ABILITY_CHIP_LABEL:**
  - sidestep: Sidestep
  - battleRoar: Roaring
  - riposte: Riposte
  - taunt: Taunting
  - smoke: Smoke
- **FOE_EFFECT_EXPLAIN:**
  - dazed: "Your head is ringing: every swing needs a better roll to hit until it clears."
  - weakened: "Your arms have gone soft: your blows do half damage until it wears off."

### Changed existing copy (effect audit)

- **Relabelled:** darkness "In the dark" is now "Dark".
- **invis:** "They swing at where you were: only a foe's very best roll finds you. Enjoy it; it wears off."
- **afraid:** "Harder to land a blow, and the ones that land do half damage, until it passes. Nobody is proud of this."
- **mirror:** "They swing at a reflection: only a foe's very best roll finds the real you, for a few rounds. Try not to look smug."
- **lit / glow:** now say the dark cannot make your strikes harder to land.
- **might:** "Extra damage on every blow. Hit things."
- **senses / heroBlind / heroShrunk:** the "for the rest of this fight" and "until this fight ends" clauses were dropped, because the facts line now says it.

### Example tap texts

- **Smoke (hero):** "+N vs their swings. Gone: for two rounds foes need a natural 1 to find you (…), and a flee during it just works. 1 more round, from your Smoke."
- **Dazed (L1 Human Fighter, Club):** "−2 to hit (18–20 instead of 16–20). Your head is ringing: … 2 more rounds, from a foe's power."
- **A member's Sidestep:** "Two rounds of not being where the blade is: every foe needs two better. 1 more round, from their Sidestep."

## Re-pinned tests (each with a CMBUI-13 comment)

- **combatPanel.test.js:** the hero, member and ally card deepEquals gain `chips: []`. It also gains 3 new chipsFor tests.
- **status-chit-combat.test.js:**
  - (a) Afraid: the tap text gains " 2 more rounds, from your fear.", cross-checked against `conditionTapText`.
  - (b) Might: the tap text gains " Until the day ends, from a spell."
  - (h) `AWAITING_77_08` is deleted, and the scan now reads `liveAbilityChips` and `memberConditionsOf` too, so it sees ability and braced.
  - The `mzConditionCard?.(` caller count goes from 1 to 2: the HUD chip and the YOUR LOT chip.
- **shell-map-hud.test.js (f):** paintConditions is pinned to `const label = conditionLabel(cn);` and `conditionTapText(cn, label, S)`. The explainCondition call and the affliction → foeEffect → fallback order are now pinned in their new functions.
- **shell-spells-40.test.js:** the voice list's senses sentence is updated.
- **hero-conditions.test.js:** new section (f), the shell-table guard. It has 5 tests:
  - every table key has a label or a documented label rule, and its own explanation;
  - every fight key has a tone, and every static fight label is one capitalised word (heroOut is exempt, with a reason);
  - `ABILITY_CHIP_LABEL` keys equal the DURATION_ROUNDS ids;
  - FOE_EFFECT_EXPLAIN matches FOE_EFFECT_LABEL, with the Weakened "half damage" and Dazed "hit" checks;
  - a BANNED and HP-not-WP scan over the new copy.
- **foe-effect-chip.test.js:** left untouched. It still passes, because the foeEffect label branch appears exactly once, inside conditionLabel.

## Verification

- **`node --test test/unit/your-lot-chips.test.js`:** 8/8 pass. The cases are:
  - Smoke appears and clears;
  - a member's Sidestep and the ally card;
  - the tap sheet, including no aim, no dispatch and the arm window;
  - Dazed and Weakened;
  - the mid-beat view state and a chip tap mid-beat that doesn't hurry;
  - relaunch through `boot()`;
  - the HUD and YOUR LOT share labels and tap text;
  - conditionLabel for every key.
- **Plan verify set:** hero-conditions, shell-map-hud, shell-spells-40, status-chit-combat, foe-effect-chip, hp-not-wp, voice safety-scan, text-scale, combat-beat-shell, combat-lock-shell, darkness-vignette, shell-combat-actions and shell-combat-screen give 213/213.
- **`npm test`:** 6996/6996 pass, 0 fail. That is the base's 6980 plus 16 new tests, parity included.
- **`npm run boot:check`:** PASS (no-uncaught, painted, graves, title). It ran against a temporary www/ build and a node_modules junction, both removed afterwards.
- **Engine and fixtures:** `git diff --quiet e8bd480 -- engine/` passes, so the engine and prototype are untouched. No fixture or shell snapshot moved, so no FIXTURE-INVENTORY entry was needed. No bot or balance runs, per the user ruling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] beatHurryTap swallowed a YOUR LOT chip tap mid-beat**
- **Found during:** Task 2.
- **Issue:** #enc-panel's capture-phase `beatHurryTap` stops every click inside the combat panel while a beat plays, and hurries the round. A chip tap mid-round would therefore have skipped the playback without opening the card. That contradicts Phase 71 R-29: reading a status is an inspection, the card rises and the round keeps playing.
- **Fix:** beatHurryTap returns early when `e.target.closest(".cb-lot-chip")`. It fails open, so an event with no target or no closest still hurries.
- **Test:** your-lot-chips (e).
- **Commit:** 7863d3da.

**2. [Rule 1 - Copy] The facts line repeated durations already in some explanations**
- **Issue:** "Extra damage until the day ends. … Until the day ends, from a spell."
- **Fix:** trimmed the duration clause from might, senses, heroBlind and heroShrunk, and wrote the new keys without one.

**3. [Rule 2 - Correctness] A member chip's sheet**
- **Issue:** `conditionTapText` would have put the hero's measured lead on a member chip, with a "from your X" source.
- **Fix:** `opts.member` drops the lead and reads "from their X", per 77-03's handoff note.

**4. [Plan assumption superseded] Chip font sizing**
- **Issue:** The plan assumed the combat screen keeps fixed px sizes.
- **Fix:** 78-02 already moved the whole shell, the combat screen included, to scaled rems. The chip CSS follows that rule, and text-scale.test.js passes.

**5. [Guard exemption] heroOut's "Can't act"**
- **Issue:** The label is two words, but it was shipped and pinned by `shell-combat-actions.test.js`, which is outside this plan's files.
- **Fix:** Kept the label. The one-word guard carries a reasoned `LABEL_STYLE_EXEMPT` entry, flagged for Phase 79.

No architectural changes. prototype-master.js.txt and engine/ are unchanged.

## Pixel 7 checklist (CMBUI-13, milestone close)

- **Smoke:** use Smoke in a fight. The hero card shows "SMOKE · n" right away, counts down each round, and is gone when the effect ends.
- **Smoke chip tap:** a card explains it, in this order:
  - how much harder you are to hit;
  - what Smoke does;
  - how many rounds are left;
  - that it came from your ability.

  The fight does not act or re-aim. A tap during the round's playback opens the card without skipping the round.
- **Dazed:** get dazed. The Dazed chip's card says "−2 to hit (… instead of …)" and the rounds left. A Weakened chip's card says your blows do half damage.
- **Joiner:** with a Joiner in the party using Sidestep, its chip shows under the Joiner's card, not the hero's.
- **Relaunch:** relaunch the app mid-fight. The chips are still there.
- **Fit (backstop):** the chip rows are readable at a glance, fit under their cards without pushing the action area off screen, and each chip is comfortable to tap. The minimum height is 22px, and the text wraps inside a 96px card.

## Known Stubs

None.

## Threat Flags

None. There are no new network, auth or storage surfaces. The two bridges are pure, read-only functions.

## Self-Check: PASSED

- FOUND: test/unit/your-lot-chips.test.js, mazeworld.html (`function conditionTapText` x1, `function conditionLabel` x1, `const FOE_EFFECT_EXPLAIN` x1, `cb-lot-chip` 2+), src/browser/bridge.js (`__mzHeroChips` x1, `__mzMemberConditionsOf` x1), docs/SHELL-MODULES.md (`__mzHeroChips`)
- FOUND commits: e4042711, 7863d3da, 0856d1df
