# Requirements: Delve, Die, Repeat — v2.4 Fit & Finish

**Defined:** 2026-10-03
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Milestone goal:** the game works on every screen size, shows its state at a glance, and tells its story in fantasy voice instead of rulebook text.

Sources: backlog 999.17, 999.18, 999.20 (ROADMAP.md) and the todos `2026-10-02-bad-condition-chips-first`, `2026-10-02-cloak-regeneration-tick-on-use`, `2026-10-02-player-facing-descriptions-fantasy-flavor`.

## v2.4 Requirements

### Large screens (999.17)

- [ ] **SCREEN-01**: The app installs and runs with no orientation, resizability or max-aspect restriction in the manifest (Play's large-screen notice on 2.3.0 clears)
- [ ] **SCREEN-02**: On a phone, the player gets the rotation behaviour ruled in discuss-phase (portrait-only as a runtime preference, or free rotation)
- [ ] **SCREEN-03**: The player can play a full run in landscape — maze viewport, rail, HUD, tabs and sheets all fit and stay usable
- [ ] **SCREEN-04**: On a 10" tablet, a foldable (folded and unfolded) and a Chromebook-sized window, the layout uses the space sensibly (not a stretched phone column)
- [ ] **SCREEN-05**: Rotation, fold/unfold, resizing and multi-window never restart or lose a run, a combat or an open store
- [ ] **SCREEN-06**: Safe areas and system bars are correct in every orientation; shell snapshots and the perf baseline are updated

### Ability states (999.20)

- [x] **ASTATE-01**: The player sees each ability row in one of four states — Ready, Recharging, Can't use now, Spent this fight — each with its own colour token plus a non-colour cue (icon or label)
- [x] **ASTATE-02**: A Recharging ability shows its countdown ("ready in N")
- [x] **ASTATE-03**: A Can't-use-now ability shows the gate's reason on the row (e.g. "no foe in reach", "needs a weapon")
- [x] **ASTATE-04**: The engine exposes each ability row's state category and rounds left, so the view never infers it
- [x] **ASTATE-05**: The states are readable in the shipped (dark) theme and for colour-blind players, pinned by shell snapshot and a11y tests (user 2026-10-03: no light theme ships, so "light and dark" became the shipped theme)

### Condition chips (todo)

- [x] **CHIP-01**: Harmful condition chips (disease, poison, any `tone: "bad"`) always render first (far left), with a stable order within each group; done in the view layer so engine `conditionsOf` order and fixtures don't move

### Cloak of Regeneration (todo)

- [x] **ITEM-08**: Using the Cloak of Regeneration heals one tick immediately, then continues the every-N-squares ticks (ruling A — one of the three — or B — a fourth — decided in discuss-phase); the tick draws from the heal-over-time stream, never the main rng; Joiners follow the same rule; item text, chip, narration + rail twin, ITEM-AUDIT row, patch notes and the fair bot's cloak model are updated; any moved fixture is declared

### Joiner level (user, added 2026-10-03)

- [x] **JOIN-01**: A Joiner's level follows the floor it is met on, one level per three floors, at least 1 and at most 5 (floors 1–3 → 1, 4–6 → 2, 7–9 → 3, 10–12 → 4, 13+ → 5; exact or as a cap on today's roll, ruled in discuss-phase); its hp, abilities, Joiner lines, the fair bot and the patch notes follow, and any moved fixture is declared

### Gauntlet of the Giant (player report #6, added 2026-10-03)

- [x] **ITEM-09**: Using the Gauntlet of the Giant is worth its downside: its size step's damage bonus (ruled in discuss-phase, with the Enlarge potion's 2.3.0 fix as the yardstick) makes foes +1 to hit you a fair trade; the item text, chip, ITEM-AUDIT row, patch notes and the fair bot follow, Joiners get the same numbers, and any moved fixture is declared; GitHub issue #6 closes when the fix ships

### Fantasy-flavour text (todo)

- [x] **FLAVOR-01**: Spell and scroll descriptions shown to the player read as fantasy flavour, not rules text
- [x] **FLAVOR-02**: Equipment, magic-item and potion descriptions shown to the player read as fantasy flavour
- [x] **FLAVOR-03**: Race and sub-class blurbs read as fantasy flavour and still convey each one's good and bad
- [x] **FLAVOR-04**: Ability rows and condition-chip explanations (CONDITION_EXPLAIN) read as fantasy flavour
- [x] **FLAVOR-05**: Exact rules and numbers live in a separate technical layer, reachable in game where discuss-phase decides; the v2.3 truth-in-advertising guards (item-text-engine, authored-ranges, spell-audit, skill-audit, value-identity, identity tests) re-pin to that layer with no guard lost
- [x] **FLAVOR-06**: All new player text passes the family-friendly safety scan and the narrative review, in the house sarcastic voice

### Store & website screenshots (999.18) — after the large-screen work

- [ ] **SHOTS-01**: An agreed shot list is captured on the current build — phone, 7" tablet, 10" tablet, and landscape where it fits
- [ ] **SHOTS-02**: The Play listing screenshots (`store-listing/screenshots/`) are replaced, exported to Play's size rules, and `store-listing/LISTING.md` is updated
- [ ] **SHOTS-03**: The darktierstudios.com shots and `featured.webp` are replaced as webp with updated alt text, and the site is deployed

## Future Requirements

- **Active ability state** — a fifth state for an effect already running (Taunt up, Brace, buffs); deferred, chips already show these
- **Ability states on spells** — same visual language for no-charges / school-gated spells
- **999.19** — a Joiner's Stealth crit logged as the hero's (not reproduced; needs the user's save)
- **999.12** — achievements track (its own milestone)

## Out of Scope

| Feature | Reason |
|---------|--------|
| iOS | Android/Google Play only (project-wide) |
| Rewriting Oracle/combat narration lines | This milestone rewrites descriptions only; narration was reviewed in v2.1 Phase 79 |
| Chip-row overflow handling, Joiner/foe chip ordering | User, 2026-10-03: CHIP-01 (hero chips, bad first) is enough |
| Changing any rule or number in the flavour pass | FLAVOR is a text-layer split; the engine and its numbers stay put |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHIP-01 | Phase 93 | Complete |
| ITEM-08 | Phase 93 | Complete |
| ITEM-09 | Phase 93.1 | Complete |
| ASTATE-01 | Phase 94 | Complete |
| ASTATE-02 | Phase 94 | Complete |
| ASTATE-03 | Phase 94 | Complete |
| ASTATE-04 | Phase 94 | Complete |
| ASTATE-05 | Phase 94 | Complete |
| JOIN-01 | Phase 94.1 | Complete |
| FLAVOR-01 | Phase 95 | Complete |
| FLAVOR-02 | Phase 95 | Complete |
| FLAVOR-05 | Phase 95 | Complete |
| FLAVOR-03 | Phase 96 | Complete |
| FLAVOR-04 | Phase 96 | Complete |
| FLAVOR-06 | Phase 96 | Complete |
| SCREEN-01 | Phase 97 | Pending |
| SCREEN-02 | Phase 97 | Pending |
| SCREEN-03 | Phase 97 | Pending |
| SCREEN-04 | Phase 97 | Pending |
| SCREEN-05 | Phase 97 | Pending |
| SCREEN-06 | Phase 97 | Pending |
| SHOTS-01 | Phase 98 | Pending |
| SHOTS-02 | Phase 98 | Pending |
| SHOTS-03 | Phase 98 | Pending |

**Coverage:** 24 requirements — mapped: 24 — unmapped: 0 (roadmap created 2026-10-03; ITEM-09 added 2026-10-03 with inserted Phase 93.1; JOIN-01 added 2026-10-03 with inserted Phase 94.1)

---
*Requirements defined: 2026-10-03*
*Traceability filled: 2026-10-03 (roadmap Phases 93–98, plus 93.1)*
