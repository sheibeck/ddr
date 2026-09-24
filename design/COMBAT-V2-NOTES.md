# Combat panel v2 mock: behavior notes

Source: claude.ai/design project `fed8909e-860d-496e-9d31-04dd31f14a3c`, "Mazeworld Combat v2.dc.html". That file wraps "Mazeworld Combat Panel v2.dc.html" in an iOS frame at 402×874, with props `foeCount` 1–5 (default 3), `partyMode` and `diceMode` ("on tap" | "always" | "never", default "on tap"). The markup is saved verbatim in `design/Mazeworld Combat Panel v2.dc.html`. Imported 2026-09-24 for Phase 71 D-05..D-07, the user's updated round-summary mock.

The mock's sample content (foe names, spells, gear, dice, the "wp" field name) is illustrative only. The game keeps its real engine, content and wording, and always shows **HP**, never WP.

## Layout, top to bottom
1. **Header, fixed:** `ENCOUNTER` on the left; `ROUND {n}` and `{n} STANDING` on the right.
2. **Scrollable middle** (`flex:1; overflow:auto`), with two sections:
   - **Foes:** the aim hint on the left ("TAP A FOE TO AIM AT IT", or "ONE LEFT. AIM IS SIMPLE."); the threat label on the right ("THEY STRIKE FIRST").
     - Each foe card shows its glyph, NAME, a meta line (size · INT · note) and HP `n / max`.
     - Under the HP, a tag line shows the foe's **conditions in purple** (`#a78ce8`, e.g. `HEXED · SLOWED`), otherwise `TARGET` in gold on the selected foe, or `DOWN`.
     - An HP bar, `steps(6)` transition.
     - The selected card has a gold border; a dead card fades to 0.45 opacity.
   - **Party:** "YOUR LOT · EACH ROLLS THEIR OWN" or "JUST YOU · NOBODY TO BLAME". Member cards sit in a row, the active member in gold.
3. **"What happened" strip, fixed** (`flex:none`, directly above the actions, background `#16120c`, top border 3px `#3a3226`). This is the round summary band.
   - **Label:** `ROUND {n} · WHAT HAPPENED` in `#a89c82`. While a round is resolving it reads `RESOLVING` in `#e07260` and pulses (`mwtorch .9s steps(2) infinite`; drop the pulse under reduced motion).
   - **Right chip:** `FULL LOG · {count} ›`.
   - **Body:** a fixed **78px** box, bottom-aligned, with a top fade mask (`linear-gradient(transparent 0, #000 22px)`). It shows at most the **last 3 lines of the latest round**. The newest line is bright (`#e6ddc6`) and rises in (`mwrise .22s`); older lines are dim (`#8f856f`). Text is 14px bold with 1.4 line-height.
   - **Tapping the strip** opens the full-log sheet.
4. **Action area, fixed:**
   - **Prompt:** `{NAME}'S TURN · PICK YOUR MISTAKE` in gold (the name prefix only with a party). While busy it reads **`HOLD · THE DICE ARE STILL OUT`** in dim `#8f856f`.
   - **2×2 grid** (STRIKE / SPELL / GEAR / RUN, with RUN in the red accent). **While busy, every button is disabled**: its taps are ignored (not queued), with no raised shadow and dim colors.
   - Submenus rise in (`mwrise .16s`) with a BACK button and a max-height of 206px, scrolling inside. The end state shows the title, a line and one button.
5. **Full-log sheet, modal:** a scrim (`rgba(10,8,6,.72)`) with a bottom sheet (max-height 74%).
   - Title `THE FIGHT SO FAR`, with the hint `TAP A LINE FOR ITS DICE` when dice mode is "on tap", and a CLOSE button.
   - Entries are newest first, grouped under `ROUND n` headers.
   - Tapping a line reveals its dice/roll text in gold below it (dice mode "on tap"). Tapping the scrim closes the sheet; taps inside the sheet don't.

## Behavior the mock pins (maps to D-05..D-07)
- **D-05:** `busy` is true from the moment an action is taken until the foes' turn has fully played out and the next actor is up. While busy, the prompt reads HOLD, all four actions are disabled and inert (no queuing), and the strip label reads RESOLVING.
- **D-06 (tap to skip)** is not in the mock. It's the user's standing ruling: a tap during playback fast-forwards to the result. It must coexist with the strip's tap-to-open-log. A tap on the strip while resolving should skip, not open the log. The planner/executor records the ruling.
- **D-07:** the round summary band IS the "What happened" strip. It sits at a fixed height above the actions, so foe count never pushes it off-screen. The foes and party scroll in the middle region instead.
- The foe-condition tags in purple on the card link up with D-14 (every foe condition shows) and D-09 (the long-press card reads the same condition table).
- Dice detail per line ("on tap") is part of the full-log sheet. If the engine's round events already carry roll text, surface it. Otherwise the reveal is omitted, and the planner records this, since the game's own log lines may not carry roll strings. Don't invent dice.
