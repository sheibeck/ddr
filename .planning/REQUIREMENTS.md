# Requirements: Delve, Die, Repeat — v1.4 Combat Screen

**Defined:** 2026-09-16
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown. A fight must read in one place, in one voice, with one thumb.
**Milestone goal:** Replace the combat UX with the Claude Design "Mazeworld Combat" screen (`design/Mazeworld Combat Panel.dc.html`, imported 2026-09-16 from https://claude.ai/design/p/fed8909e-860d-496e-9d31-04dd31f14a3c) — foes, your lot, a › fight log and a four-action bar on one dark screen — while keeping the engine, parity, the Fight! gate, refusals, loot, joiners and the input guards exactly as v1.3 shipped them.

**Grounding (2026-09-16, code read):**

- **Combat surface today** (`mazeworld.html#renderEncounter`, Phases 25.1/29/31/32): `#enc-panel`/`.mw-overlay` over the map; head (type / foe count / to-hit), foe roster, Round Card (`window.__mzRoundCard`, current round only, uncapped), `.actions` bar (Strike/Potion/Flee/Parley/Sing/Scroll/Spells/Items), Fight! gate on `combat.pending`, loot card (Phase 29), joiner/find/death cards, `#enc-dismiss-slot`; `guardTap`/`encArmed`/`encounterSettled` (Phase 32) on every decision button.
- **Engine surface** (unchanged by this milestone): `fight`, `attack`, `castSpell`, `useItem`, `drinkPotion`, `readScroll`, `sing`, `flee`, `parley`, `retarget`, `takeLoot/leaveLoot/takeAllLoot/leaveAllLoot`, joiner accept/decline; events via `toastsForAction` groupers; refusals at `PRIORITY.block`; `conditionsOf`; foe data carries `sz`, `i`, `sp.note`, `wp`/max; party members in `state.party` (auto-acting).
- **Fonts already bundled** (`www/fonts`): `press-start-2p-400.woff2`, `courier-prime-400/700.woff2` — the mock's two faces, offline-safe.
- **The mock is a toy** (its own dice, 4 actions, player-controlled party turns, no Fight! gate, no loot card): its STYLE OBJECTS and COPY TONE are the spec; our engine, gate and cards are the behaviour.

## v1.4 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Combat screen (CSCR)

- [ ] **CSCR-01**: The encounter panel is rebuilt as the mock's full-screen layout — header (ENCOUNTER · ROUND N · N STANDING), a scrollable middle (foes → YOUR LOT → › log), and a fixed action area — using the mock's palette, the bundled Press Start 2P / Courier Prime faces, spacing and borders; no map/D-pad visible beneath it.
- [ ] **CSCR-02**: Foe cards render name, glyph, the `sz · INT i · sp.note` meta line, `wp / max`, a red hp bar, and a tag (TARGET when >1 alive / DOWN / status chips); tapping a live foe retargets through the engine; dead foes dim and stay listed.
- [ ] **CSCR-03**: YOUR LOT shows the hero (gold, active) and every joiner as side-by-side cards with `wp/max`, a green/red bar and the VP/charges line; the strip scrolls horizontally when it overflows so more party members can join later; solo reads "JUST YOU · NOBODY TO BLAME".
- [ ] **CSCR-04**: The › fight log replaces the Round Card: every in-combat non-refusal narrative line for the WHOLE fight, newest first, with the light › mark; tapping an entry reveals its dice/roll detail line; the log clears at fight end; refusals stay toasts; the Oracle stays the complete log; `toastsForAction` routing and the Phase 32 exclusivity invariants hold.
- [ ] **CSCR-05**: Four actions — 1·STRIKE, 2·SPELLS (labelled ABILITIES for a hero with no spells; lists spells or Sing), 3·ITEMS (potions, scrolls, staffs, every usable), 4·SOCIAL (Flee, Parley) — in the mock's 2×2 grid with sub-lines (to-hit/damage, VP left, charges left, flee odds); SPELLS/ITEMS/SOCIAL open the mock's submenu (title · BACK, item label/cost/desc, scrollable); unavailable actions render disabled but tappable so the engine's refusal toast explains; number keys and Enter/Space keep working.
- [ ] **CSCR-06**: The Fight! gate folds into the screen — pre-Fight!, foes + YOUR LOT + the encounter line in the log render and the action area is one full-width FIGHT! button; nothing else is offered until Fight! (Phase 31 rule).
- [ ] **CSCR-07**: Fight end folds into the screen's over-panel — THEY ARE DOWN (with the Phase 29 loot rows, Take all / Leave all and the victory report inside) / YOU GOT OUT (flee) / THAT IS THAT (death, keeping the death card's epitaph, Review the Oracle and Confirm); the joiner offer and find cards keep their behaviour in the same styling.
- [ ] **CSCR-08**: Phase 32's guards survive intact — every decision button on the new screen (actions, submenu rows, FIGHT!, loot rows, Take all/Leave all, over-panel button, joiner accept/decline, death Review/Confirm) goes through `guardTap`/`ARM_DELAY_MS`; `DISMISS_SETTLE_MS` still gates `window.move`; no tap-anywhere-to-dismiss; `aria-live` announcer preserved.
- [ ] **CSCR-09**: Engine, content and parity are untouched (`git diff -- engine content test/parity` empty; master fixture hash unchanged); every existing shell test is re-pinned or replaced with an equivalent; `npm test` green; `npm run build:www` exit 0; voice scan on all new copy.
- [ ] **CSCR-10**: The rebuilt combat screen is validated in an on-device DR round on the Pixel 7 (installed debug build) before the milestone closes.

## Out of scope (this milestone)

- Engine or rules changes of any kind; the mock's toy mechanics (its dice, "gets up again", hex/slow) are not ported.
- Player-controlled joiner turns (joiners keep auto-acting; their lines appear in the log).
- A dice-mode setting (tap-to-reveal is the only mode; "always/never" may come later).
- Haptics, the 32-03 unguarded store/spell buttons, the UX-06 tutorial.

## Traceability

| Req | Phase | Status |
|-----|-------|--------|
| CSCR-01 | Phase 34 | Pending |
| CSCR-02 | Phase 34 | Pending |
| CSCR-03 | Phase 34 | Pending |
| CSCR-04 | Phase 34 | Pending |
| CSCR-05 | Phase 34 | Pending |
| CSCR-06 | Phase 34 | Pending |
| CSCR-07 | Phase 34 | Pending |
| CSCR-08 | Phase 34 | Pending |
| CSCR-09 | Phase 34 | Pending |
| CSCR-10 | Phase 34 | Pending |
