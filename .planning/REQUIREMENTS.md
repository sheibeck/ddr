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

- [ ] **ASTATE-01**: The player sees each ability row in one of four states — Ready, Recharging, Can't use now, Spent this fight — each with its own colour token plus a non-colour cue (icon or label)
- [ ] **ASTATE-02**: A Recharging ability shows its countdown ("ready in N")
- [ ] **ASTATE-03**: A Can't-use-now ability shows the gate's reason on the row (e.g. "no foe in reach", "needs a weapon")
- [ ] **ASTATE-04**: The engine exposes each ability row's state category and rounds left, so the view never infers it
- [ ] **ASTATE-05**: The states are readable in light and dark themes and for colour-blind players, pinned by shell snapshot and a11y tests

### Condition chips (todo)

- [ ] **CHIP-01**: Harmful condition chips (disease, poison, any `tone: "bad"`) always render first (far left), with a stable order within each group; done in the view layer so engine `conditionsOf` order and fixtures don't move
### Cloak of Regeneration (todo)

- [ ] **ITEM-08**: Using the Cloak of Regeneration heals one tick immediately, then continues the every-N-squares ticks (ruling A — one of the three — or B — a fourth — decided in discuss-phase); the tick draws from the heal-over-time stream, never the main rng; Joiners follow the same rule; item text, chip, narration + rail twin, ITEM-AUDIT row, patch notes and the fair bot's cloak model are updated; any moved fixture is declared

### Fantasy-flavour text (todo)

- [ ] **FLAVOR-01**: Spell and scroll descriptions shown to the player read as fantasy flavour, not rules text
- [ ] **FLAVOR-02**: Equipment, magic-item and potion descriptions shown to the player read as fantasy flavour
- [ ] **FLAVOR-03**: Race and sub-class blurbs read as fantasy flavour and still convey each one's good and bad
- [ ] **FLAVOR-04**: Ability rows and condition-chip explanations (CONDITION_EXPLAIN) read as fantasy flavour
- [ ] **FLAVOR-05**: Exact rules and numbers live in a separate technical layer, reachable in game where discuss-phase decides; the v2.3 truth-in-advertising guards (item-text-engine, authored-ranges, spell-audit, skill-audit, value-identity, identity tests) re-pin to that layer with no guard lost
- [ ] **FLAVOR-06**: All new player text passes the family-friendly safety scan and the narrative review, in the house sarcastic voice

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
| (filled by the roadmapper) | | |

**Coverage:** 22 requirements — mapped: 0 (pending roadmap)

---
*Requirements defined: 2026-10-03*
