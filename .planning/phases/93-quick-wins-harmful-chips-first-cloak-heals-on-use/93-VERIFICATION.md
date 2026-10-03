---
phase: 93-quick-wins-harmful-chips-first-cloak-heals-on-use
status: passed
verified: 2026-10-03
verifier: orchestrator (deferred-UAT protocol)
requirements: [CHIP-01, ITEM-08]
full_suite: "10,213 tests / 10,205 pass / 0 fail / 8 skipped (after 93-03; baseline at phase start 10,183 / 10,175 / 0 / 8). Orchestrator re-run of the 9 phase test files: 183 / 183 pass."
human_verification:
  - "(93) Poisoned or Diseased while buffed: the harmful chip is the first chip on the strip under the HUD; in a fight, Dazed/Weakened leads the strip and the hero's YOUR LOT card; a Joiner's card keeps its old order."
  - "(93) Use a worn Cloak of Regeneration while hurt: hp rises at once ('Tick 1 of 4', rail '(1/4)'), then ticks 2-4 at 10/20/30 squares; the chip counts 3, 2, 1; the start line says a d6 now, then 3 more walking."
  - "(93) Use the cloak mid-fight from ITEMS: hp rises at once, the fight goes on, no more ticks until you walk. At full hp: 'Nothing left to knit.' and the chip still shows 3."
  - "(93) Use a Joiner's cloak from the Company panel: that Joiner heals at once, by name."
  - "(93) The cloak's Gear card, store line and find card all read 'a d6 hp back at once, and again every ten squares you walk, three more times'."
---
# Phase 93 Verification

Goal-backward check against the four ROADMAP success criteria.

1. **Harmful chips first (CHIP-01): passed.** `harmfulFirst` (src/browser/heroConditions.js:235) is a pure, stable partition on engine `polarity === "bad"`. It is applied in `paintConditions` (mazeworld.html:3963) and on the hero branch only of `yourLotChipsFor` (mazeworld.html:5124), and bridged on `window.__mzHeroChips`. Engine `conditionsOf` order and its fixtures don't move. Pinned by hero-conditions.test.js and your-lot-chips.test.js section (h), including a Joiner control.
2. **Cloak heals on use, ruling (B): passed.** The item carries `hot: { every: 10, ticks: 3, onUse: true }` and the txt "used, a d6 hp back at once, and again every ten squares you walk, three more times; …". `applyActivation` fires the instant tick (engine/items.js:1501), with events `itemEffectStarted { now: true }` then `healTick` 1 of 4. The Oracle and rail start lines, `CONDITION_EXPLAIN.knit`, the ITEM-AUDIT row and ruling, and the cards all state one count. That agreement is pinned by the new test/unit/cloak-one-rule.test.js.
3. **Joiners: passed.** A Joiner's use heals at once from the member-keyed stream (key 0), by name (joiner-item-use.test.js). Taking the cloak off still stops the walking ticks left. `knit` stays out of `MEMBER_COMBAT_KINDS`.
4. **Rng, fixtures, bot, paperwork: passed.**
   - The instant tick reads the main cursor only (heal-over-time.test.js cursor-only test). `prototype-master.js.txt` and `engine/economy.js` are untouched (price 1,400).
   - Moved fixtures were measured against a `git archive` of BASE and declared in `test/parity/FIXTURE-INVENTORY.md` ("Phase 93 plan 02"): chargen seed 4 cloak txt (text only), roll-high `party-1` (text only, proven by re-hash), and `deep-14` (behaviour: a Thief's cloak use now heals at once, so the run takes 47 → 48 actions).
   - `knitWindowHeal` = 14 (bot-balance-close.test.js).
   - `docs/patch-notes/2.4.0.md` is a DRAFT carrying both lines; `tools/patch-notes.mjs --check` stays green on 2.3.0.

The hand checks above are batched into the v2.4 device checklist (`docs/UAT-v2.4.md` at milestone close), following the project's deferred-UAT protocol.

Paperwork note: commit a0c5626d (the 93-02 docs commit) lacks the Co-Authored-By and Claude-Session trailers. It was not amended, per project rule.
