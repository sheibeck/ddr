# Phase 100: In-Game Achievements: Unlock Toasts & the ☰ List - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Shell only: no engine bytes change. The phase has two parts:
- the unlock banner (AUI-01), shown when an achievement is earned;
- the ☰ achievements list (AUI-02, AUI-03), which works in every layout class.

It reads two sources:
- the Phase 99 adapter API: `setAchievementListener(fn)` with payload `{ unlocks:[{id,at}], reveals:[id], progress:[{id,value,steps}] }`, `getAchievementRecord()`, and `progressFor(record, entry)` from `src/browser/achievementTracker.js`;
- the Phase 98 catalog (`content/achievements.js`): names, lines, descriptions, listOrder, the hidden set and the `achievements/ingame/` 144 × 144 icons.

**Out of scope:** Play Games, including the AUI-04 row for Play's own achievements screen, which is Phase 101.

</domain>

<decisions>
## Implementation Decisions

### The unlock banner (AUI-01)
- **Surface:** each unlock is a **rail card of a new "achievement" kind**. The user's ruling stands: the rail is the one feedback surface for minor events, and a dismissible card is only for decisions. The game's old toasts were retired into the rail.
  - The card shows the in-game icon, the title ACHIEVEMENT, the achievement name and its sarcastic `line`.
  - It is dismissible and never a decision card.
  - It holds long, per the user's "about twice as long, tap to dismiss" ruling. Use `RAIL_HOLD` / `holdForCard`.
- **During a fight:** the card is **held until the fight ends**, then shown. The fight's rail stays reserved for the combat card kinds (`COMBAT_CARD_KINDS`: foe and cond), so an unlock never interrupts a turn or blocks input.
- **On death:** the rail is hidden when the hero is dead. **The death screen therefore shows an "Earned" strip** (icon and name) for the achievements that death earned, plus anything still queued from the final fight. It must never block the death screen's controls.
- **In a store:** the card behaves as the rail does on that screen today. It never steals the screen.
- **Several at once:** one card per unlock, in catalog list order, each with its own hold.
  - **More than 3 queued at once collapse into one card** that lists the names. Tapping it opens the achievements list.
  - None is ever lost.
- **No unlock fires on reveals alone.** A reveal updates the list (the secret becomes a greyed, readable row) without showing a card.
- **The stale-terms tripwire forbids "toast" in raw .js/.mjs lines** under src/engine/content/tools/test. Name things "achievement card" or "banner" in code. The requirement text keeps its word.

### The ☰ achievements list (AUI-02, AUI-03)
- **The ☰ row:**
  - It is labelled **ACHIEVEMENTS** and carries an earned/total count ("12 / 77").
  - It is placed **after MARKS**, giving the order camp, marks, achievements, settings, report, notes.
  - It is always enabled, dead or alive, like REPORT A BUG and PATCH NOTES.
  - It is added to `HUD_MENU_ITEMS` and `hudMenuRowStates` in `src/browser/hudMenu.js`.
- **Shape: one row per track, 36 rows,** grouped under the 7 catalog blocks:
  1. The descent
  2. Dressing for it
  3. Who you are
  4. Staying alive
  5. Company
  6. Body counts
  7. Dying
- **A tiered track** shows:
  - the icon of the highest tier earned, or tier I greyed if none;
  - an I–IV ladder;
  - the next rung's progress, for example "37 / 50 kills", with units: floor, days, wilmst held, kills, deaths, Joiners, parleys won, traps survived, sub-classes.
  - Tapping it expands every tier with its date earned. The depth ladder and Unicorn! read as one track of four rungs.
- **Locked rows** are greyed and show the Play `description` (how to earn it), plus progress where the entry has some.
- **Unlocked rows** show the sarcastic `line` and the date earned.
- **Hidden rows** read as a "Secret" teaser with a silhouette icon until they unlock or their revealer reveals them. After that they read as a normal locked or unlocked row. The list header counts the secrets still undiscovered.
- **Progress for the single-run tracks** (depth, days, wilmst) is the **best single run so far**, for example "best: floor 7 / 10". This is the same value Play's set-steps will show.
- **Conventions:**
  - Open it as a sheet in the house style, the way Settings and Patch Notes open.
  - Android back closes it.
  - It works in every layout class from `src/browser/layoutClass.js` (short, compact, medium, expanded): one column on phones, two columns where wide. Check it with `npm run layout:check`.
  - Under TalkBack each row reads its name, state (earned on a date / locked / secret) and progress.
  - It respects reduced motion.
  - The list scrolls on its own; the page never scrolls sideways.
- **Icons** come from `achievements/ingame/`. They must ship in the web bundle (`tools/build-www.mjs`), and `www/` must include them.

### Claude's Discretion
- The module split, for example `src/browser/achievementsSheet.js` (a pure view model plus a renderer) and `src/browser/achievementCard.js` (the rail card builder and queue).
- The exact glyph for the ☰ row and the visual styling, within the house vocabulary.
- The queue mechanics for holding cards during a fight and handing them to the death strip.
- The copy for chrome strings: list header, "Secret" teaser text, "Earned" strip label. Write it in the house voice and register it with the safety scan and voice corpus.
- Snapshot and shell tests in the existing style.
- Plan split. Expect 2–3 plans: the card and queue with the death strip; the ☰ row and the list sheet; the layout and accessibility checks, the www bundling and docs.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/rail.js`:
  - holds: `RAIL_HOLD`, `holdForCard`, `HOLD_MIN` / `HOLD_MAX`;
  - card builders: `railLineCard`, `railCardFor`;
  - the rail itself: `railPush`, `emptyRail`, `railDismissKind`;
  - combat cards: `COMBAT_CARD_KINDS` / `isCombatCard` (the rail stays hidden in combat except for these).
- `mazeworld.html`:
  - `renderRail`, around line 6176–6210: `railEl.hidden = (S.combat && !combatCardUp) || S.dead || ...`;
  - `window.__mzRailVM`, around line 7820.
- `src/browser/hudMenu.js`: `HUD_MENU_ITEMS`, `hudMenuRowStates`, `hudMenuNext`.
- Sheet precedents: `src/browser/patchNotes.js`, `src/browser/reportSheet.js`, `src/browser/settings.js`.
- `src/browser/layoutClass.js` and `npm run layout:check` (`tools/layout-check.mjs`).
- `src/browser/engineAdapter.js`: `setAchievementListener`, `getAchievementRecord`, `loadAchievements` (awaited by `boot`). Register the listener before the first action.
- `content/achievements.js` `ACHIEVEMENTS`. `src/browser/achievementTracker.js` `progressFor`.
- `test/voice/safety-scan.test.js` `collectAuthoredStrings` and `tools/lib/voice-corpus.mjs` `BANK_REGISTRY`: register any new copy bank.

### Established Patterns
- Card vs banner rule: cards are for decisions and big updates, and minor events are rail-only with a long hold and tap to dismiss.
- Every surface works under both movement modes (arrows and tap).
- Shell snapshots: regenerate only the fixtures this phase changes, and declare each one.
- Executors run targeted tests only. The orchestrator runs the full suite at phase close. No bots.

### Integration Points
- Phase 101 adds a Play Games row (AUI-04) beside the ACHIEVEMENTS row, and registers its mirror on the same achievement listener. Phase 100 must leave room for that: either a listener fan-out or a small multiplexer, so two consumers can subscribe.
- Phase 102 screenshots the list.

</code_context>

<specifics>
## Specific Ideas
- The death screen's Earned strip makes Special Snowflake's "You're a special snowflake." land right where the player is looking.
- The ☰ count ("12 / 77") gives a next goal at a glance.

</specifics>

<deferred>
## Deferred Ideas
- The Play Games achievements row and Play's own screen are Phase 101.

</deferred>
