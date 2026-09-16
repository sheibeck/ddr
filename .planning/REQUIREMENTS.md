# Requirements: Delve, Die, Repeat — v1.4 Combat & Map Screens

**Defined:** 2026-09-16
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown. A fight must read in one place, in one voice, with one thumb.
**Milestone goal:** Replace the combat AND map UX with the Claude Design "Mazeworld Combat" and "Mazeworld Map" screens (`design/Mazeworld Combat Panel.dc.html`, `design/Mazeworld Map.dc.html` + `Mazeworld Map Panel.dc.html`, imported 2026-09-16 from https://claude.ai/design/p/fed8909e-860d-496e-9d31-04dd31f14a3c): one dark combat screen (foes, your lot, › fight log, four actions) and a map screen with no D-pad and no toasts — tap-to-step, a bottom rail card that carries every event and decision, a full-screen major overlay for encounters (FIGHT IT OUT) and descents, and HUD + condition chips — while keeping the engine, parity, refusals, loot, joiners and the input guards exactly as v1.3 shipped them.

**Grounding (2026-09-16, code read):**

- **Combat surface today** (`mazeworld.html#renderEncounter`, Phases 25.1/29/31/32): `#enc-panel`/`.mw-overlay` over the map; head (type / foe count / to-hit), foe roster, Round Card (`window.__mzRoundCard`, current round only, uncapped), `.actions` bar (Strike/Potion/Flee/Parley/Sing/Scroll/Spells/Items), Fight! gate on `combat.pending`, loot card (Phase 29), joiner/find/death cards, `#enc-dismiss-slot`; `guardTap`/`encArmed`/`encounterSettled` (Phase 32) on every decision button.
- **Engine surface** (unchanged by this milestone): `fight`, `attack`, `castSpell`, `useItem`, `drinkPotion`, `readScroll`, `sing`, `flee`, `parley`, `retarget`, `takeLoot/leaveLoot/takeAllLoot/leaveAllLoot`, joiner accept/decline; events via `toastsForAction` groupers; refusals at `PRIORITY.block`; `conditionsOf`; foe data carries `sz`, `i`, `sp.note`, `wp`/max; party members in `state.party` (auto-acting).
- **Fonts already bundled** (`www/fonts`): `press-start-2p-400.woff2`, `courier-prime-400/700.woff2` — the mock's two faces, offline-safe.
- **The mock is a toy** (its own dice, 4 actions, player-controlled party turns, no Fight! gate, no loot card): its STYLE OBJECTS and COPY TONE are the spec; our engine, gate and cards are the behaviour.

## v1.4 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Combat screen (CSCR)

- [x] **CSCR-01**: The encounter panel is rebuilt as the mock's full-screen layout — header (ENCOUNTER · ROUND N · N STANDING), a scrollable middle (foes → YOUR LOT → › log), and a fixed action area — using the mock's palette, the bundled Press Start 2P / Courier Prime faces, spacing and borders; no map/D-pad visible beneath it.
- [x] **CSCR-02**: Foe cards render name, glyph, the `sz · INT i · sp.note` meta line, `wp / max`, a red hp bar, and a tag (TARGET when >1 alive / DOWN / status chips); tapping a live foe retargets through the engine; dead foes dim and stay listed.
- [x] **CSCR-03**: YOUR LOT shows the hero (gold, active) and every joiner as side-by-side cards with `wp/max`, a green/red bar and the VP/charges line; the strip scrolls horizontally when it overflows so more party members can join later; solo reads "JUST YOU · NOBODY TO BLAME".
- [x] **CSCR-04**: The › fight log replaces the Round Card: every in-combat narrative line for the WHOLE fight, newest first, with the light › mark; tapping an entry reveals its dice/roll detail line; REFUSALS (`PRIORITY.block`) become dull-toned › entries in the same log (user decision 2026-09-16 — no toasts anywhere); the log clears at fight end; the Oracle stays the complete log; `toastsForAction` routing and the Phase 32 exclusivity invariants hold (every event → exactly one of log-narrative / log-dull).
- [x] **CSCR-05**: Four actions — 1·STRIKE, 2·SPELLS (labelled ABILITIES for a hero with no spells; lists spells or Sing), 3·ITEMS (potions, scrolls, staffs, every usable), 4·SOCIAL (Flee, Parley) — in the mock's 2×2 grid with sub-lines (to-hit/damage, VP left, charges left, flee odds); SPELLS/ITEMS/SOCIAL open the mock's submenu (title · BACK, item label/cost/desc, scrollable); unavailable actions render disabled but tappable so the engine's refusal explains (as a dull › log entry); number keys and Enter/Space keep working.
- [x] **CSCR-06**: The Fight! gate is the map screen's MAJOR OVERLAY (MAP-05): on `combat.pending` the overlay shows the encounter icon, "SOMETHING IS HERE" / "THEY ARE ALREADY HERE", the encounter line naming the foes, the roll note, and one FIGHT IT OUT button that dispatches `fight`; the combat screen only ever renders a fought combat (round ≥ 1). Nothing resolves before the tap (Phase 31 rule).
- [ ] **CSCR-07**: Fight end folds into the screen's over-panel — THEY ARE DOWN (with the Phase 29 loot rows, Take all / Leave all and the victory report inside) / YOU GOT OUT (flee) / THAT IS THAT (death, keeping the death card's epitaph, Review the Oracle and Confirm); the joiner offer and find cards keep their behaviour in the same styling.
- [ ] **CSCR-08**: Phase 32's guards survive intact — every decision button on the new screen (actions, submenu rows, FIGHT!, loot rows, Take all/Leave all, over-panel button, joiner accept/decline, death Review/Confirm) goes through `guardTap`/`ARM_DELAY_MS`; `DISMISS_SETTLE_MS` still gates `window.move`; no tap-anywhere-to-dismiss; `aria-live` announcer preserved.
- [x] **CSCR-09**: Engine, content and parity are untouched (`git diff -- engine content test/parity` empty; master fixture hash unchanged); every existing shell test is re-pinned or replaced with an equivalent; `npm test` green; `npm run build:www` exit 0; voice scan on all new copy.
- [ ] **CSCR-10**: The rebuilt combat screen is validated in an on-device DR round on the Pixel 7 (installed debug build) before the milestone closes.

### Map screen (MAP)

- [ ] **MAP-01**: The map tab is rebuilt as the mock's column — HUD strip (FLOOR · DAY · SQUARES · RATIONS, red ≤ 2; WP x/y + tone bar right), a condition-chip strip directly beneath it (tone-colored chips with a remaining count, tap to explain; hidden when empty), the map viewport, and the bottom rail — using the mock's palette, faces, spacing and borders; the app's tab bar stays.
- [ ] **MAP-02**: Movement is tap-to-step: a tap anywhere on the viewport moves one square toward the tap (dominant axis first, the other axis as fallback; both blocked → a dull rail line); hold ≥ 450 ms inspects the square (unwalked / rock / mark legend / empty corridor lines); drag pans; pinch zooms (0.6–2.0, origin on the party); a move recenters. TAP-TO-STEP IS DISABLED while any rail decision or obstacle is pending (user ruling 2026-09-16: "never move past an active choice"): taps then re-show the pending rail card (no step), and a wall/crevice square holds the party until a successful roll. The D-pad and its footer are removed; keyboard arrows remain for desktop; every existing move guard (encounter, settle window) still applies.
- [ ] **MAP-03**: The bottom RAIL replaces every out-of-combat toast: icon · title · line · dice line, toned info/good/bad/odd/dull, auto-clearing after the mock's hold times; idle it reads "FLOOR N · NOTHING IS HAPPENING" + the how-to line; every event still reaches the Oracle unabridged; `#mw-toast-host`, `mzToast` and the toast lifetimes are retired (no toast anywhere in the app).
- [ ] **MAP-04**: Decisions live in the rail's action row — joiner offer (take along / leave), find / locked box (pick the lock / leave it), crevice and wall-type obstacles (CLIMB IT only — no go-round; dice shown; the square stays blocked until a success), and any other yes/no the engine offers; NOTHING can be skipped — movement stays disabled until the choice is answered or the obstacle is crossed (the mock's walk-away-declines rule is REJECTED by the user); the Move-on cards for level-up and floor arrival are gone (rail lines, level-up with a longer hold).
- [ ] **MAP-05**: The MAJOR OVERLAY handles the big moments full-screen: the encounter (FIGHT IT OUT → `fight`), the stair down (GO DOWN / NOT YET), and death outside combat (THAT IS THAT variant with Review the Oracle / Bury them); it is the only surface that blocks the map.
- [ ] **MAP-06**: MARKS opens the "WHAT THE MARKS MEAN" bottom sheet (glyph · name · description rows, scrim tap closes); CENTRE recenters; MAKE CAMP opens the camp sheet (copy, SLEEP 1 RATION / WALK ON) and a refused camp (no food, party appetites) is a bad-toned rail line — all three as the mock's top chips over the viewport.
- [ ] **MAP-07**: The canvas maze renderer keeps its engine-fed drawing but adopts the mock's palette (fog / wall / floor / border), the colored mark glyphs, the gold pulsing party marker and the inset vignette; fog-of-war and marks behave as today.
- [ ] **MAP-08**: Phase 32's guards survive: every rail/overlay/sheet button goes through `guardTap`; the settle window still gates movement after an overlay/sheet closes; `aria-live` announces new rail lines once; no tap-anywhere-to-dismiss except the sheets' scrim.
- [ ] **MAP-09**: Engine, content and parity untouched; every shell test re-pinned or replaced (toast wiring, D-pad/controls, party-camp, Move-on/beats, HUD, marks legend); `npm test` green; `npm run build:www` exit 0; voice scan on all new copy.
- [ ] **MAP-10**: The rebuilt map screen is validated in an on-device DR round on the Pixel 7 before the milestone closes.

## Out of scope (this milestone)

- Engine or rules changes of any kind; the mock's toy mechanics (its dice, "gets up again", hex/slow) are not ported.
- Player-controlled joiner turns (joiners keep auto-acting; their lines appear in the log).
- A dice-mode setting (tap-to-reveal is the only mode; "always/never" may come later).
- Porting the mock's DOM grid renderer, sprites or its toy dice — the canvas renderer and the engine stay.
- Haptics, the 32-03 unguarded store/spell buttons, the UX-06 tutorial.

## Traceability

| Req | Phase | Status |
|-----|-------|--------|
| CSCR-01 | Phase 34 | Complete |
| CSCR-02 | Phase 34 | Complete |
| CSCR-03 | Phase 34 | Complete |
| CSCR-04 | Phase 34 | Complete |
| CSCR-05 | Phase 34 | Complete |
| CSCR-06 | Phase 34 | Complete |
| CSCR-07 | Phase 34 | Pending |
| CSCR-08 | Phase 34 | Pending |
| CSCR-09 | Phase 34 | Complete |
| CSCR-10 | Phase 34 | Pending |
| MAP-01 | Phase 35 | Pending |
| MAP-02 | Phase 35 | Pending |
| MAP-03 | Phase 35 | Pending |
| MAP-04 | Phase 35 | Pending |
| MAP-05 | Phase 35 | Pending |
| MAP-06 | Phase 35 | Pending |
| MAP-07 | Phase 35 | Pending |
| MAP-08 | Phase 35 | Pending |
| MAP-09 | Phase 35 | Pending |
| MAP-10 | Phase 35 | Pending |
