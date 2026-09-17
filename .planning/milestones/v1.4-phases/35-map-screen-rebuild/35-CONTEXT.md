# Phase 35: Map Screen Rebuild - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning
**Mode:** User-driven redesign — the user imported a Claude Design mock and ruled on the open questions directly

<domain>
## Phase Boundary

Rebuild the map tab to the imported Claude Design spec **`design/Mazeworld Map.dc.html`** (HUD + condition chips, mounts the map panel and — in a fight — the combat panel) and **`design/Mazeworld Map Panel.dc.html`** (viewport interaction, the RAIL, the MAJOR OVERLAY, the MARKS / CENTRE / MAKE CAMP chips and sheets; every style value is recorded in the file's trailing comment block). The mock's DOM-grid renderer, sprites and toy dice are NOT the spec — our canvas renderer and engine are. Requirements MAP-01..10. **Shell + presentation + tests only — no engine/content/parity changes.** Depends on Phase 34 (the combat screen the FIGHT IT OUT overlay hands to; the log-routing seam).

Out of scope: rules changes; the store screen; a dice-mode setting; haptics; UX-06 tutorial.

</domain>

<decisions>
## Implementation Decisions

### User rulings (2026-09-16) — override the mock where they differ
1. **Toasts are gone everywhere.** Out of combat → the RAIL. In combat → the › log (refusals as dull entries, Phase 34). `#mw-toast-host`, `mzToast`, `toastLifetime`, `MAX_TOASTS` and the toast CSS are retired; `toastsForAction` stays as the pure event→line folder feeding both surfaces.
2. **Tap to move replaces the arrows** — "saves real estate and makes play smoother." The D-pad, `.mazefoot` and `src/browser/controls.js`' D-pad wiring go; keyboard arrows stay for desktop.
3. **Never move past an active choice.** Tap-to-step is DISABLED while a rail decision (joiner, find, climb…) or an obstacle (wall/crevice) is pending: a tap re-shows/pulses the pending card and does not step; a wall/crevice square holds the party until a successful roll. The mock's "walking away declines" is REJECTED.
4. **Crevices/walls: climb only.** No "go round". The rail shows the roll (e.g. `climb d20+4 · 9 to clear`) and the outcome with dice; failure re-offers CLIMB IT (with any damage line) until success.
5. **Condition chips live in the HUD**, in a strip directly under FLOOR/DAY/SQUARES/RATIONS (the user updated the mock): chips `flex:none`, `border 1px <tone.edge>`, bg `#1b170f`, padding `3px 5px`, Press Start 2P 5.5px, tone ink (bad `#a63a2c/#e07260`, warn `#6b5c3c/#e8c97a`, odd `#5b4a86/#b9a4ef`, good `#5e7a3c/#a8cc72`), a remaining-count suffix (Courier 700 10px `#8f856f`) when the condition has one; tap a chip → its explanation in the rail (info tone). Strip hidden when empty. Source: `conditionsOf` (Phase 31 shapes incl. `afraid`, `ward {pool, remaining}`, `acute`). Armor and gold move to the Hero tab only.

### HUD (MAP-01)
- Strip (flex:none, bg `#1b170f`, `border-bottom 3px #3a3226`, padding `8px 14px 9px`): left = `FLOOR n` (value gold), `DAY n`, `SQUARES n`, `RATIONS n` (red `#e05a48` when ≤ 2) — labels Press Start 2P 6.5px `#9a8f76`, values Courier 700 16px, `margin-left:-6px`; right = `x/y WP` (red when ≤ 25 %) over a 64×5 bar (`#7f9d4e` > 50 %, `#e8c97a` > 22 %, else `#e05a48`). `SQUARES` = the run's squares walked (existing counter). The app's tab bar stays below the rail.

### Viewport & movement (MAP-02, MAP-07)
- Canvas renderer kept; adopt the palette: fog `#0b0a08`, wall `#2c261c` with the inset bevel, floor `#645c48`, border `#443a26`, party marker `#f4dc94` with the gold pulse (`mwglow`, respects reduced motion), colored mark glyphs (● `#e05a48` encounter, ◆ `#a78ce8` teleport, ▲ `#8ec06a` one-way door, ✕ `#e05a48` trap, ▪ `#d3c49f` box, ⧗ crevice, ▼ descent) at ~60 % of the cell, inset vignette `0 0 70px 26px rgba(8,7,5,.92)`.
- Pointer model on the viewport (`touch-action:none`): tap (≤ 10 px travel, one finger, < 450 ms) = one step toward the tapped square — dominant axis first, other axis as fallback, both blocked → rail dull "NO WAY THAT DIRECTION"; tap on the party's square → "YOU ARE HERE"; hold ≥ 450 ms = inspect (unwalked / rock / mark legend line / empty corridor); drag = pan; two fingers = pinch (0.6–2.0, existing clamp constants may be re-ranged), origin on the party; a step resets pan and recenters (Phase 33 recenter hooks stay).
- Every step still dispatches the engine's `move`; the existing guards (`hasActiveEncounter`, `encounterSettled`, the new pending-decision lock) run before any step.
- Chips over the viewport (top-left MARKS, CENTRE; top-right MAKE CAMP) per the spec block; the Phase 33 `.mw-viewport-chips` row is replaced by these.

### The RAIL (MAP-03, MAP-04)
- One persistent element under the viewport (flex:none, `min-height 132`, padding `14px 16px 30px`, `border-top 3px <tone.edge>`, bg `#1b170f` active / `#161209` idle), `aria-live="polite"`: icon · title (Press Start 2P 8px) · line (Courier 700 14.5px) · roll line (Courier 700 13.5px tone ink) · idle peek hint (`TAP TO STEP` / `PINCH OUT`). Tones info/good/bad/odd/dull per the spec block.
- Source = the same folded lines `toastsForAction` produces for the action (uncapped), mapped to `{icon, title, line, roll, tone, hold}` by a pure `src/browser/rail.js` view-model (title = the event family's headline copy, line = the narrative sentence, roll = the dice payload when present, tone by event family: damage/hunger/refusal = bad, finds/camp/level-up = good, teleport/door/floor = odd, moves/rock = dull, everything else info). Events without actions auto-clear after `hold` (default 4200; dull 2200–3400; level-up ~6000). Multiple lines from one action stack newest-first inside the card (the card grows; still one card).
- Decisions = rail cards with an action row: joiner offer (TAKE THEM ALONG / LEAVE THEM), find / locked box (PICK THE LOCK / LEAVE IT — using the existing find/pick actions), climb (CLIMB IT only), any other engine yes/no. While such a card is up: movement locked (ruling 3), the card persists until answered, the primary button is tone-ink.
- Every rail line still reaches the Oracle exactly as today (the Oracle path is untouched).
- The Move-on `S.beats` cards (floor change / level-up) are retired: level-up → good rail card with a longer hold; floor arrival → odd rail card ("FLOOR N · The air changes…").

### MAJOR OVERLAY (MAP-05)
- Full-screen over the map (bg `#0d0b08`, column centered, padding `28px 22px`): icon 54px, title Press Start 2P 15px gold, line Courier 700 17px, roll line, stacked buttons (primary gold / secondary bordered). Used for: encounter (`combat.pending` — built in Phase 34: SOMETHING IS HERE / THEY ARE ALREADY HERE, foes named, FIGHT IT OUT → `fight`), the stair down (THE STAIR DOWN, "Floor N+1 is colder, longer…", GO DOWN → the existing descend action / NOT YET), and out-of-combat death (THAT IS THAT variant: cause + epitaph, REVIEW THE ORACLE / BURY THEM). It is the only surface that blocks the map; it is guarded.

### Sheets (MAP-06)
- MARKS → bottom sheet "WHAT THE MARKS MEAN" (rows glyph · name · description from the existing legend data restyled; scrim tap closes). CENTRE → `mzCenterMap`. MAKE CAMP → bottom sheet with the mock copy and SLEEP 1 RATION / WALK ON; the existing refusal ("You eat N a night, you have M") → bad rail card "NOTHING TO EAT"; the camp result → good rail card with the mend/ambush dice.

### Guards & tests (MAP-08, MAP-09)
- `guardTap` on every rail/overlay/sheet button; `DISMISS_SETTLE_MS` gates the first step after an overlay/sheet closes; `aria-live` announces a new rail card once (seq-gated, like Phase 32's announcer); no tap-anywhere-to-dismiss except the sheets' scrim.
- Retire/re-pin: `shell-toast-wiring`, `narrativeToasts` (keep the text helper), `toastTable`/`toastsCoverage` partition invariants (keep — now "rail or log"), `shell-party-camp`, D-pad/controls tests, beats/Move-on tests, HUD tests, marks-legend tests, `shell-map-store-polish` recenter pins (keep). Add: rail view-model tests (tone/hold per family, roll extraction, stacking), movement-lock tests (pending card / obstacle ⇒ no step), tap-to-step axis tests (pure helper), HUD/chip source assertions, overlay/sheet source assertions, voice scan on all new copy.
- Gate: `npm test` green, `npm run build:www` exit 0, `git diff -- engine content test/parity` empty, master hash `a1f4d0dc…`.

### Claude's Discretion
- The exact title/tone table per event family (must stay family-friendly sarcasm); where the tap-to-step helper lives (`src/browser/controls.js` refit vs a new `src/browser/tapStep.js`); how the pending-decision lock is represented (a `window.__mzRail` state with `pending: true`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/toasts.js` (`toastsForAction` + groupers, `PRIORITY`, `TOAST_FOR`/`ORACLE_ONLY`/`FEATURE_EVENTS`/`CARD_EVENTS`, `narrativeToastText`) — becomes the folder for the rail; `mazeworld.html#dispatchWithToasts` — the single routing seam (Phase 32) → now rail vs fight log.
- `src/browser/controls.js` (`TAP_MOVE_THRESHOLD_PX = 10`, `TAP_MAX_DURATION_MS = 350`, tap/drag classification, D-pad wiring), the viewport pointer handlers + pinch (`release`, `wasPinch`), `zoom`/`clampZoom`, `window.mzCenterMap`, `fit()`.
- `renderEncounter` branches for joiner/find/beats/death (Phase 34 rewrites the combat ones), `S.beats`, `hasActiveEncounter`, `guardTap`/`encArmed`/`encounterSettled`, `#enc-round-live` announcer pattern, `mzMakeCamp` + the party-appetite refusal, the Marks legend data, `CONDITION_COPY`/`conditionsOf`, the HUD (`#s-arm` etc.), `src/browser/icons.js` mark glyphs.
- `design/Mazeworld Map.dc.html`, `design/Mazeworld Map Panel.dc.html` — the spec.

### Established Patterns
- Source-assertion tests, BANNED voice scan, `window.__mz*` bridges, `Date.now()` guards only, executor gate.

### Integration Points
- `dispatchWithToasts` → rail (out of combat) / fight log (in combat); movement entry (`engineMove`) → pending-decision lock; `noteCombat`/`startCombat` → major overlay; descend/death paths → major overlay; Make Camp → sheet + rail; Marks → sheet.

</code_context>

<specifics>
## Specific Ideas

- User: "We're getting rid of toasts entirely, the movement arrows, and then having a card-type near the bottom that has information about what's happening. Notice this UX mock has the FIGHT button that begins combat in it."
- User: "Tap to move instead of the arrow keys. This saves real estate and really makes the play more smooth."
- User: "We should never be able to move past an icon and skip some choice… disable tap to move until the current thing is dealt with."
- User: "There are no options to 'go around' a crevice or wall. It's climb it. I like that it shows you the dice rolls."

</specifics>

<deferred>
## Deferred Ideas

- Dice-mode setting (always/never) for rail and log — later.
- Store screen restyle to the same vocabulary — later.
- Porting the mock's pixel sprites (moss/rubble/torch/bone) onto the canvas — optional flourish, not required.

</deferred>
