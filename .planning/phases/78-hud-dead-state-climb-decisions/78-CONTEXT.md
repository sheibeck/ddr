# Phase 78: HUD, Dead State & Climb Decisions - Context

**Gathered:** 2026-09-25 (collected ahead, while Phase 72 wave 5 executed)
**Status:** Ready for planning

<domain>
## Phase Boundary

- The HUD tells the truth at a glance: the band-1 identity line.
- The dead state locks down cleanly and offers a read-only final sheet.
- Settings behave: text size scales every font token, and sheet drags never scrub a volume slider.
- A stairs descent fades.
- Acute Hearing gains "hear the next room".
- Crossing a wall or crevice is a decision made BEFORE any dice: CLIMB-01/02.

This covers HUD-01..07 and CLIMB-01/02.

**Scope correction to the roadmap:** the roadmap says "Depends on: Nothing (shell/presentation-only, zero fixture moves)". Two items make that no longer true:
- The user chose an ENGINE pending decision for the climb card (below), so CLIMB-01 is engine-gated. Movement fixtures crossing walls get a declared harness reconcile.
- The climb card prints odds in Phase 74's range format.

So Phase 78 depends on Phase 73/74 (it runs after them anyway, in numeric order), and follows the engine gate for CLIMB. HUD-07's "heard" squares come from a PURE engine derived function (no state change, zero fixture moves).
</domain>

<decisions>
## Implementation Decisions

### The climb/leap decision card — CLIMB-01/02 (user accepted 2026-09-25)
- **The decision lives in the ENGINE, as one pending decision for every wall and crevice.** Today only a tool carrier gets `state.pendingHazard` + `hazardChoice` (engine/movement.js ~L225-245).
  - Generalise it: every step toward a wall or crevice sets `pendingHazard` (the tool is optional) and emits the choice event, with NO dice drawn.
  - The player then commits: CLIMB IT / LEAP IT, USE LADDER / USE ROPE (only when carried, doing what the tool does today), or TURN BACK.
  - The bot (`tools/lib/tuning-bot.mjs`) plays through the decision, always committing, so the difficulty curve doesn't move.
  - This is one path for tool and no-tool cases (greenfield, no dual path).
- **TURN BACK costs nothing:** no step, no time, no roll, no cadence tick. It clears `pendingHazard`, and the hero stays where they stood.
- **The card shows each option's odds** in Phase 74's range format, e.g. "CLIMB IT: 6–10 on a d10 for each 10 ft" and the leap's range for the hero's class, with armor-bulk and phobia penalties folded in. A plain warning says a fall hurts. USE ROPE / USE LADDER states what the tool does.
- **The Heights phobia** (`noteHeightsAttempt`, Phase 41 "fires on the ATTEMPT") now arms only when the player COMMITS to the climb. TURN BACK costs no fear either. `heightsPenalty`/`waterPenalty` still apply to the roll itself. This is a declared rules-timing change.
- **When the card appears:** every step toward a wall or crevice, including right after TURN BACK. It clears on crossing (success or the one-and-done failed crossing), so no stale retry card can ever appear.
- The crevice/wall copy in `src/browser/mapMarks.js` describes one-and-done (Phase 54's ruling).
- **Engine gate:** a new pending state plus a new commit/cancel action, with `EVENT_NARRATION` entries.
  - Movement fixtures that step into walls or crevices would now pause. Reconcile in the harness (the CMB-01 `reconcilePendingFight` pattern: an auto-commit reconcile for comparison), OR declare and regenerate the moved set.
  - Measure first, never edit the prototype master, and carve any new serialized field out of the comparables.

### Dead state, HUD and feel (user accepted 2026-09-25)
- **Added 2026-09-25 (user report; todo `2026-09-25-rail-line-when-a-spell-charge-is-regained`):** a regained spell charge gets a rail toast line again. `spellChargeRecovered` sits in `narrationLines.js` ORACLE_ONLY because "the HUD charge display already shows this", but the HUD no longer shows charges. Move it to LINE_FOR (toast, not card) with the count, and audit ORACLE_ONLY for other stale "the HUD shows this" reasons. Presentation-only.
- **HUD-01:** band 1 reads "Race Sub-class · Lvl N" (e.g. "Dwarf Pickpocket · Lvl 3"), with no parent class and no parentheses.
- **HUD-02:** once the hero is dead, only the Oracle, the DEAD/Leaderboards screen and the ☰ menu (Settings, the way back to the title; the account rows stay in ☰ per the standing ruling) accept input. Map taps, the other tabs, camp, marks and centre-map are inert.
- **HUD-03:** a **FINAL SHEET** button on the DEAD screen opens the Hero tab's character sheet (`src/browser/heroTab.js#characterSheetViewModel`) in READ-ONLY mode: stats, level, gear, grimoire and the epitaph, with no action buttons. It is for the run that just ended.
- **HUD-04:** the Settings text-size choice (S/M/L) scales EVERY `--mw-font-*` token. Pin it with a test that walks all tokens.
- **HUD-05:** a vertical drag anywhere on the settings sheet scrolls it. A volume slider moves ONLY on a deliberate sideways drag that STARTS on the slider, or on a tap on its track. A drag that starts vertical never changes a volume.
- **HUD-06:** a stairs descent fades to black in about 0.6s under the stairs sound, then fades in on the new floor in about 0.4s. With reduced motion there is an instant cut, and the sound still plays.
- **HUD-07 "hear the next room":** a hero with Acute Hearing sees a faint "something's there" mark on the 4 orthogonally adjacent squares that hold something ALIVE: foes/encounters with creatures, would-be joiners and the faerie. Traps, chests and objects stay silent.
  - It works THROUGH walls (it's hearing).
  - The mark never says what it is, and it fades once the square is revealed or the encounter resolves.
  - A pure engine derived function (e.g. `heardSquares(state)`) supplies the squares, with no state change and no rng.
  - Acute Hearing keeps "never surprised". Its description states the new ability, written roll-high-aware. Phase 72 already dropped the dead "3 to hit the unseen" clause.

### Movement setting — HUD-08 (user, 2026-09-25; added to v2.1 on request; todo `2026-09-25-setting-tap-to-move-or-on-screen-arrow-pad`)
- A Settings choice, **Movement: TAP TO MOVE (default) | ARROWS**. With ARROWS, a second choice places the pad **BOTTOM LEFT | BOTTOM RIGHT** of the map. Both are stored in the settings record with a tolerant load (unknown values fall back to tap-to-move).
- **Arrow mode:** a 4-way on-screen pad overlays the map in the chosen bottom corner. Each press takes ONE step through the same `stepNow(dir)` path (mazeworld.html ~L7697), so there's no second movement path. Hardware keyboard arrow keys also step while arrow mode is on.
- Map taps NEVER move the party in arrow mode: tap-to-move is ENTIRELY disabled. Non-movement map taps (marks and the like) keep working unless they conflict.
- **Auto-scroll:** `keepPartyInView()` (~L5657-5706) treats the pad's on-screen rect as a visible edge, so the map scrolls before the party slips under it. The pad may overlap the map otherwise.
- **Defaults** (recommended, set by the orchestrator; the planner may refine): one step per press (no hold-to-repeat); the pad scales with the S/M/L text size; TalkBack labels like "Step north"; reduced motion honoured. The dead state, combat and open sheets disable the pad exactly as they disable map taps.
- Presentation/shell only (the engine already takes one-step moves), so zero fixture moves.

### Claude's Discretion
- The card layout, the fade implementation (CSS or canvas), the mark's visual (within the parchment palette and PNG-icons canon), and the exact voice lines.
- Plan split: the climb card (engine + UI), dead state + final sheet, settings (font + drag), stairs fade, hearing, band 1. Several of these are independent.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/movement.js`:
  - the `pendingHazard`/`hazardChoice` flow (~L200-245, cleared ~L342, ~L881);
  - `noteHeightsAttempt`;
  - the climb loop (~L258-275, per-10-ft d10 vs `CLIMB_TABLE[kind].success`, with the armor-bulk + heights penalty);
  - the leap (~L277-290, d10 vs `LEAP_TABLE` row by class).
- `engine/actions.js:69`: the comment on the pre-roll decision card half (`state.pendingHazard`).
- `src/browser/mapMarks.js`: the crevice/wall copy.
- `src/browser/heroTab.js:165` `characterSheetViewModel(state)` (also used by `combatMenu.js`).
- `src/browser/sfx.js`: the stairs sound.
- The `--mw-font-*` tokens in `mazeworld.html`.
- `content/skills.js:51`: Acute Hearing's text (72-07 removes "3 to hit the unseen").

### Established Patterns
- The pending-decision pattern (pendingFight/pendingLoot/pendingFind/pendingHazard), with harness reconciles in `test/parity/harness/comparables.js`.
- Reduced motion is honoured across the shell.
- Standing rulings: the account lives in the ☰ button, tap-to-move only (no D-pad), and "HP not WP".

### Integration Points
- Phase 73's roll-high helper for the climb/leap checks.
- Phase 74's range formatter for the card's odds.
- Phase 76's relaunch persistence must carry `pendingHazard` (already decided there).
</code_context>

<specifics>
## Specific Ideas

- The user's ruling (milestone scoping): "option B": a pre-roll card with CLIMB/LEAP IT, USE LADDER/ROPE and TURN BACK, no rng until commit, and TURN BACK costs nothing.
- The Pixel 7 checks at milestone close:
  - the dead-state lockdown;
  - FINAL SHEET;
  - the settings drag;
  - text size;
  - the stairs fade (with and without reduced motion);
  - the climb card (TURN BACK costs nothing, no stale card);
  - the hearing marks.
</specifics>

<deferred>
## Deferred Ideas

- None.
</deferred>
