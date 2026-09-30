---
phase: 89-item-audit-fixes
plan: 07
subsystem: ui
tags: [joiner, items, company-panel, chips, bot, view-model, fixtures, q2-ruling]
requires:
  - phase: 89-05
    provides: the memberUseItem action, its refusals and MEMBER_LEADER_KINDS (Q2)
  - phase: 89-06
    provides: memberConditionsOf reports a Joiner's item chips anywhere
provides:
  - "src/browser/heroTab.js: COMPANY_COPY and companyItemsModel(state, idx); renderPartyRoster draws the Armour line, the chip row, the potion row and the worn rows with DRINK / USE"
  - "mazeworld.html: window.mzMemberUseItem bridge, tabDeps memberUseItem / memberChipsFor / railInfo, the Company item CSS"
  - "tools/lib/tuning-bot.mjs: chooseMemberItem, the bot's out-of-fight Joiner item policy"
affects: [89-08, phase-91, phase-92-bot-pass]
tech-stack:
  added: []
  patterns:
    - "one pure view model (companyItemsModel) decides every row, label and enabled state; the renderer only draws it (the gearTab / viewModels pattern)"
    - "a disabled control shows its one-line reason in place of the button; results are told on the rail only"
key-files:
  created:
    - test/unit/company-items-model.test.js
    - test/unit/shell-company-items.test.js
    - test/unit/bot-joiner-items.test.js
  modified:
    - src/browser/heroTab.js
    - mazeworld.html
    - tools/lib/tuning-bot.mjs
    - tools/lib/voice-corpus.mjs
    - test/unit/shell-company-panel.test.js
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
    - test/parity/FIXTURE-INVENTORY.md
key-decisions:
  - "The model mirrors the engine's own refusal ladder in the engine's order (inFight, downed, leaderOnly, wantsTarget, not ready) and a test runs memberUseItem against every cloak and jewel, ready and cooling, to keep the two in step"
  - "Chips reuse the YOUR LOT chip look (.cb-lot-chip) and the HUD's label and tap text (conditionLabel, conditionTapText with member: true); out-of-fight entries (cooling, armed Pendant) are kept because the Company panel is where they are read; a tap raises the text on the rail through deps.railInfo"
  - "An armed Pendant of Fortitude reads 'live (armed)' and its USE is off with 'already armed'"
  - "In a fight the carry rows stay (what they hold and their state) but every button and hint goes, replaced by one line saying the fight is automatic"
  - "The bot's Joiner policy is pure, per-Joiner (potion first, then a ready Cloak of Regeneration), and skips anything the engine would refuse or ctx.itemBlocked carries, so it cannot loop on a refusal"
patterns-established:
  - "COMPANY_COPY: a frozen copy bank registered in the voice corpus"
requirements-completed: [ITEM-07]
status: complete
duration: ~1h45m
completed: 2026-09-30
---

# Phase 89 Plan 07: The Company panel's Joiner items and chips Summary

**Each Joiner's card on the Hero tab now lists its armour, its healing potions and every worn cloak or jewel with its state (ready, live N sq, cooling N sq, armed), shows its live item chips, and outside a fight offers DRINK and USE that run the engine's `memberUseItem` and tell the result on the rail; the bot plays the same rule.**

## What changed

- **`companyItemsModel(state, idx)` and `COMPANY_COPY` (`src/browser/heroTab.js`).** One pure model returns `{ armour, potions, worn, inFight }`.
  - `armour`: `{ name, ar, left, max, destroyed }` from the sheet's armour fields, or `null`.
  - `potions`: `{ n, canDrink, reason }`.
  - `worn`: one row per worn slot in `WORN_SLOTS` order: `{ slot, name, effect, status, statusText, left, canUse, reason }`. `effect` is the item's own `itemStatLines` effect text (the store and Gear tab read the same words).
  - The reason ladder follows the engine's: in a fight, downed, `MEMBER_LEADER_KINDS` (the Q2 line: "Only the one in front can use this. It moves or leads the party."), a targeted kind outside a fight, then live / armed / cooling ("cooling for N squares"). Potions: no potions left, already at full HP.
  - Never throws on a bad index, a missing state, or a sheet without `worn`, `timers` or `potions`; never mutates.
- **`renderPartyRoster`.** After Eats: the Armour line (in the `ITEM_STAT_COPY` words: `Leather · AR 6 · 12/15 hp`, or `destroyed`), the chip row, the potion row with DRINK, one row per worn item with USE, then DISMISS (unchanged). A disabled control shows its reason in place of the button. In a fight there are no buttons or hints and one line says they handle their own items. Every sheet string goes through `escText`.
- **`mazeworld.html`.** `window.mzMemberUseItem(i, ref)` dispatches `{ type: "memberUseItem", i, potion: true }` or `{ i, slot }` through `dispatchWithNarration` in `mzDismissJoiner`'s order (set state, `logLine` each line, `paint()`, `renderEncounter()`). `tabDeps()` gains `memberUseItem`, `memberChipsFor` (reads `memberConditionsOf` through `conditionLabel` / `conditionTapText`) and `railInfo` (the rail's info card for a chip tap). Seven `.mw-party-*` CSS rules, once each, no transition or animation.
- **`tools/lib/tuning-bot.mjs`.** `chooseMemberItem(state, ctx)`: walking the party in order, a standing Joiner at or below a third of its HP (`wp * 3 <= maxWP`) with potions drinks; else one below `potionThreshold` wearing a ready Cloak of Regeneration uses it. `decideAction` calls it out of a fight right after `chooseFieldItem`, before the hero's own potion and camp. Pure, no rng; the bot's camp gate is untouched (the known Joiner camp stall stays for Phase 92).
- **Voice corpus.** `COMPANY_COPY` registered (the completeness guard requires every frozen copy bank). `docs/narrative-pass` needed no ledger row (583 rows unchanged; `narrative-review --check` in sync).

## Tasks and commits

| Task | Name | Commit |
|------|------|--------|
| 1 | The Company panel shows each Joiner's armour, potions, worn items and chips, with DRINK and USE outside a fight | `0bb32449` |
| 2 | The bot has a low Joiner drink and a hurt Joiner use its Cloak of Regeneration; measure and declare | `8f5d5064` |

## Results

- `npm test` (final full run, after the last code change): 8,567 tests, **8,565 pass, 0 fail, 2 skipped** (base 8,522 / 8,520 / 0 / 2; +45 new: 18 in `company-items-model.test.js`, 14 in `shell-company-items.test.js`, 13 in `bot-joiner-items.test.js`). No CRLF doc-ledger failures appeared in this worktree run.
- `node --test "test/parity/**/*.test.js"`: 66 / 66, zero drift. `node tools/narrative-review.mjs --check`: in sync.
- Acceptance greps: `export function companyItemsModel` 1, `export const COMPANY_COPY` 1, `window.mzMemberUseItem` in `mazeworld.html` 2 (the bridge and the `tabDeps` forward), `memberUseItem: (i, ref)` 1, `memberChipsFor` in `heroTab.js` 2, `export function chooseMemberItem` 1, `type: "memberUseItem"` in `tuning-bot.mjs` 4 (two actions plus their doc lines), `### Phase 89 plan 07` in FIXTURE-INVENTORY 1. `git diff --stat -- engine test/parity/prototype-master.js.txt` is empty: **no engine file changed**.
- The model is tested against the engine, not just against itself: for every cloak and jewel, ready and cooling, `canUse` equals "`memberUseItem` does not refuse", and DRINK's enabled state equals the engine's across full HP, no potions and downed.

## Fixture drift (bot Joiner policy)

Predicted: zero parity drift; state pins moved wherever a pinned run has, outside a fight, a Joiner at a third of its HP with potions or a hurt one with a ready Cloak of Regeneration; the Hero-tab snapshot with a joined member. Measured:

- **Parity fixtures:** 66 / 66, zero drift; comparables unchanged (no new serialized field).
- **Bot state pins: 0 of 8 moved.** `roll-high-state-pins.test.js` and `roll-high-save-compat.test.js` pass unchanged (13 / 13). A temporary counter at the call site (removed before the commit) showed `chooseMemberItem` consulted 2,032 times across the eight pinned runs (202, 257, 328, 348, 344, 322, 205, 26) and never returning an action. No pin was re-recorded; `roll-high-baseline.mjs save` was not run. The policy is pinned by `bot-joiner-items.test.js` instead.
- **Hero-tab snapshot moved: 1 of 8**, regenerated alone (`MZ_SNAPSHOT_UPDATE=1`; the seven rewritten-identical files were restored, not committed): `test/unit/fixtures/shell-snapshots/mu.hero.txt`. Before: the Company card's html ended at `Eats 1 a rest`, then DISMISS. After: the html gains the `mw-party-armour` line (`Armour: Leather · AR 6 · 15/15 hp`) and the card gains one `mw-party-items` row (`Healing potions: 2`, hint `already at full HP`) before DISMISS. `thief.hero` (no party) is byte-identical.
- **Unit pin moved (before -> after):** `shell-company-panel.test.js` "Sheet order": name, sub/race, class/level, HP, Weapon, Eats, DISMISS -> name, sub/race, class/level, HP, Weapon, Eats, **Armour, chips, items**, DISMISS. Every other pin in that file is unchanged.
- Full rationale is in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 89 plan 07").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The voice-corpus completeness guard and the stale-terms scan**
- **Found during:** Task 1 verify
- **Issue:** `voice-corpus.test.js` refused the unregistered `COMPANY_COPY`; `stale-terms.test.js` flagged the word "toast" in my own test title.
- **Fix:** registered `COMPANY_COPY` in `tools/lib/voice-corpus.mjs` (plan step 4 anticipated this); reworded the test title.
- **Commit:** `0bb32449`

**2. [Rule 3 - Blocking] The `mu.hero` snapshot**
- **Found during:** full-suite run after Task 1 (not in the plan's file list)
- **Issue:** the joined-Thief Company card in the snapshot now has the new rows.
- **Fix:** regenerated that one fixture; declared above.
- **Commit:** `0bb32449`

### Plan adjustments (not bugs)

- **Extra model fields and deps.** `worn` rows carry `statusText` (the renderer stays dumb) and `tabDeps` gains `railInfo` (the plan said "if deps offers it"); a chip tap uses it and does nothing without it.
- **Status for an armed Pendant.** The plan's status enum has no "armed"; an armed Pendant reads `live` with the text "armed" and the reason "already armed".
- **TDD order.** Task 1's tests were written first but the red run was not separately recorded (the model tests passed on the first implementation run); Task 2's red was seen (the import of `chooseMemberItem` failed) before the implementation. Each task is one `feat` commit with its tests, as in 89-05 and 89-06.
- **No state pin moved**, where the plan predicted some might (see the drift section).

## Notes for later plans

- **Bot usage tally (Phase 92):** `tallyUsage` counts any `itemUsed`, so a Joiner's (member-tagged) item uses, in a fight since 89-06 and out of one now, are tallied as the hero's. Left as is (no bot work in this phase).
- **Q4 (Joiner armour repair at the store)** is not a Company-panel item; this plan adds no repair line.

## Known Stubs

None.

## Threat Flags

None. A validated action the engine already owns (`memberUseItem`, 89-05), a read-only view model and a rail info tap; no new network, auth or file surface.

## Human verification (deferred to end of run)

1. Open the Hero tab with a Joiner: its card shows its armour (AR and durability), its healing potions, its worn cloak with a state, and its chips.
2. Out of a fight, tap DRINK on a hurt Joiner: the rail names it and its HP bar rises; DRINK is disabled at full HP with the reason shown.
3. Tap USE on a Joiner's ready Cloak of Strength: the rail says it used it, a Crit-proof chip appears on its card, and USE now shows "live" then "cooling".
4. During a fight the Company card shows the one-line note and no buttons; YOUR LOT shows the Joiner's chips.
5. Tap/arrow movement both still work with the Company panel open and closed.
6. (From 89-05) A Joiner wearing a Cloak of Flying or Cloak of Ether shows the "Only the one in front can use this" line in place of USE.
7. Tap a Joiner chip on the Company card: the rail shows the same tap text the hero's chip shows.

## Self-Check: PASSED

- Files exist: `src/browser/heroTab.js` (exports `companyItemsModel`, `COMPANY_COPY`), `mazeworld.html` (`mzMemberUseItem`), `tools/lib/tuning-bot.mjs` (exports `chooseMemberItem`), `test/unit/company-items-model.test.js`, `test/unit/shell-company-items.test.js`, `test/unit/bot-joiner-items.test.js`.
- Commits `0bb32449` and `8f5d5064` exist on `worktree-agent-a2410cbe4e749c75c`; the final full `npm test` is green (8,565 pass, 0 fail, 2 skipped); `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `engine/` and `test/parity/prototype-master.js.txt` were not touched.
