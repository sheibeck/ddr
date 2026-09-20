# Requirements: Delve, Die, Repeat — v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve

**Defined:** 2026-09-20
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Milestone goal:** Make floors 1–7 die for legible reasons — initiative fixed for the whole fight, honest foe attack cadence, a smooth single-hit damage curve, depth-capped Joiners — then reshape `engine/difficulty.js` toward the four-band curve (average run ends floor 5–7; depth 20 stays the unicorn), close the TUNE-06 tier-3/5 roster decision, and end on the twice-deferred TUNE-07 human DR round.

**Engine gate (applies to every requirement):** every rule change here is a *deliberate* canon divergence under the greenfield ruling (2026-09-17) — no dual-path or run-option gating; the moved parity fixtures are **measured first** (a `tools/worn-fixture-scan.mjs`-style scan listing every replay site whose comparables move), each declared with before/after in `test/parity/FIXTURE-INVENTORY.md`, and only those regenerated; `test/parity/prototype-master.js.txt` is never edited; the draw-count pins (`test/unit/foe-turn-draw-count.test.js`, `combat.test.js`) are re-pinned with the new sequences, not loosened; `npm test` fail 0 and `npm run build:www` green at every commit; the bot plays the new rules.

**Sequencing gate:** the phases land in the order INIT → CAD/DMG → JOIN → BAND/TUNE, and the retune is measured only after the earlier phases are on master — each of them moves floors 1–7 by itself, and the curve must be tuned once, on the corrected cadence, not twice.

**Measurement gate:** every phase that changes a rule records a bot readout BEFORE and AFTER under identical parameters (`tools/tune-difficulty.mjs --seeds=200` solo + `--party`; `tools/tune-classes.mjs` matrix or its smoke) in `docs/DIFFICULTY-RETUNE.md`, so the four-band phase inherits a known baseline.

## v1.7 Requirements

### Character roller (ROLL)

- [x] **ROLL-01**: The character the roller screen reveals (race / class / sub-class reels, name, quirk) is the character that lands on the Hero tab — the reels lock on and the CTA commits the SAME rolled state (no second `startNewRun()` on the path, no stale `rollerPendingState` from a superseded roll, no label drift between the reel labels and `characterSheetViewModel`), pinned by a test; shell-only, engine and fixtures untouched

### Initiative (INIT)

- [x] **INIT-01**: Initiative is rolled once per combat (in `startCombat` / the `fight` action) and `C.first` holds for the whole fight — the per-round re-roll in `afterPlayerAction` (`engine/combat.js:1341`) is deleted, so a foe never takes two turns back to back; Samurai / slow / foresight / Acute Hearing overrides apply to that single roll; the p.24 divergence is declared with its moved fixtures
- [x] **INIT-02**: The player can see the initiative result — one line per fight in the Oracle and the fight log ("Initiative — you 14, Stalka Beast 9. You go first." in voice, with the dice revealable like other log entries); `C.initNote` is emitted once, not per round

### Foe attack cadence (CAD)

- [ ] **CAD-01**: A foe makes exactly one ordinary attack per round unless its bestiary `sp.atk` says otherwise (`atk: 2` keeps two swings); frenzy still doubles the count; the swing count is pinned by test for a plain foe, an `atk: 2` foe and a frenzied foe
- [ ] **CAD-02**: A foe ability that fires (bolt, drain, debuff, heal, summon, frost…) REPLACES that turn's ordinary swings — never stacks on them — decided per kit in `content/foe-abilities.js` with a resolver test on the Stalka Beast (two hits + frost in one turn is impossible after this)
- [ ] **CAD-03**: The Bat/Rat and China Wolf floor-5 fights the user reported are re-measured by the bot after INIT + CAD: attacks-per-player-action is ≤ the foe's `sp.atk` (≤ 2× if frenzied), recorded in `docs/DIFFICULTY-RETUNE.md`

### Damage curve (DMG)

- [ ] **DMG-01**: A bot readout of max single-hit damage by depth for every bestiary foe exists (`tools/` script, committed output in `docs/DIFFICULTY-RETUNE.md`), flagging any hit ≥ 60 % of a level-appropriate character's max HP at that foe's depth band
- [ ] **DMG-02**: Every flagged cliff is fixed so the curve is smooth — flat-damage foes (Herman's `dmg.bonus: 25` "strikes as a level five") get a die or a capped multiplier so a floor-5 crit cannot one-shot a full-HP level-5 character; each change has a before/after row in `content/BESTIARY-REBALANCE.md`

### Joiners (JOIN)

- [ ] **JOIN-02**: A Joiner's level never exceeds the floor it is met on — `meetJoiner` applies `lvl = min(rolled, state.floor.depth)` after the canon d10 Level Table roll, keeping the draw count and cursor unchanged (one d10, then the two d20 wp rolls); `grantLevelAbilities` and the `20 * lvl + d20` wp formula receive the capped level; `joinerMet`/`joinerRefused` payloads carry the capped `lvl` so narration and the rail card need no shape change
- [ ] **JOIN-03**: Only the fixtures that meet a Joiner on a floor shallower than its rolled level move — each declared with before/after and regenerated, `FIXTURE-INVENTORY.md` regenerated; a `tune-classes` smoke before/after records the early-Joiner power shift

### Four-band curve (BAND)

- [ ] **BAND-01**: The four bands are recorded as the measurable tuning target in `docs/DIFFICULTY-RETUNE.md` with the user's text verbatim — Filter 1–4 (high variance), Wall 5–8 (where the average run dies), Breakaway 9–15, Endgame 16–20 — as numbers: median death depth 5–7, p90 ≈ 10–13, reach-16 a few percent, reach-20 well under 1 % (the unicorn), depth-20 slice (`--start-depth 20`) unchanged as the deep-lethality yardstick
- [ ] **BAND-02**: `engine/difficulty.js`'s `difficultyCurve` is reshaped to that target — identity-ish through floor 4 (variance from drops and dice, not dials), a step at 5–8, slope eases through 9–15, steepens 16–20, breather floors kept, `DENSITY_CANON_THROUGH_DEPTH = 2` respected — with every dial change gated on the bot readout moving toward the bands and no flat damage nerfs to chase the median
- [ ] **BAND-03**: The AFTER readout (solo + `--party`, 200 seeds, plus the class matrix) lands inside BAND-01's numbers or each miss is recorded with the untaken rung and a reason; the ledger's change table has a row per constant with before/after

### Tuning close (TUNE)

- [ ] **TUNE-08**: The tier-3/5 roster decision is made and recorded — the two open band rows from v1.2 (forced-20 floors gained p50 0 / mean 0.84; reach ≥ 20 0.1 %) are canon tier-3/5 combat (Herman, Drarl, Vampire, Djinni); decide per creature whether it stays, moves tier, or is retuned (the DMG-02 rows feed this), declare any parity divergence, and record the untaken rungs so the Endgame band is a deliberate shape
- [ ] **TUNE-09**: A human DR round on the Pixel 7 (start-at-depth 20/35/50 plus a natural run, the checklist in `docs/DIFFICULTY-RETUNE.md`) is run once at milestone close against a debug APK built after the last wave, together with any pending UAT batch; the verdict is recorded verbatim and the milestone closes only on "tuned" or a user-recorded deferral

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

- **999.1 Transitions & Sounds** and **999.3 Dungeon set dressing** — feel/polish milestone (backlog phases, unblocked since Phase 47)
- **Rail overlays the map without reflow, tap-to-dismiss, longer hold** — UI quick task (`.planning/todos/pending/2026-09-19-rail-overlays-*`)
- **`storeRoll` for the bots** — the tuning harness still plays the frozen store roll
- **The two structural v1.5 AFTER patterns** — Magic Users gain nothing from the class-gated ability system; Wilmsry's racial edge
- **UX-06** first-run tutorial; **STR-01..04/06** production launch — the v1.0 launch tail, after this pass
- **SEED-001** leaderboards & share — dormant

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Any shell/UI change beyond the initiative line (INIT-02) | This is an engine/content/tuning pass; UI feel work is 999.1 + the rail todo |
| New foe abilities, spells, gear or classes | The pass tunes what exists; new content would move the curve again |
| Player-side attack cadence (multi-attack classes, Fighter extra swings) | Only foe cadence was ruled on; player power is measured by the class matrix, not changed |
| Depth-20+ endless-curve changes | v1.2 ruling stands — no mechanic forces death past 20, the ramp past 20 is untouched |
| Editing `test/parity/prototype-master.js.txt` | Master is never edited; divergences are declared, fixtures regenerated |
| Balancing classes against each other | Fun is the goal, not parity (v1.2 ruling); the matrix is a readout, not a target |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROLL-01 | Phase 50 | Complete |
| INIT-01 | Phase 51 | Complete |
| INIT-02 | Phase 51 | Complete |
| CAD-01 | Phase 52 | Pending |
| CAD-02 | Phase 52 | Pending |
| CAD-03 | Phase 52 | Pending |
| DMG-01 | Phase 52 | Pending |
| DMG-02 | Phase 52 | Pending |
| JOIN-02 | Phase 53 | Pending |
| JOIN-03 | Phase 53 | Pending |
| BAND-01 | Phase 54 | Pending |
| BAND-02 | Phase 54 | Pending |
| BAND-03 | Phase 54 | Pending |
| TUNE-08 | Phase 54 | Pending |
| TUNE-09 | Phase 55 | Pending |

**Coverage:**

- v1.7 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-09-20*
*Last updated: 2026-09-20 — roadmap created (Phases 50–55), ROLL-01 added mid-roadmap-creation per scope change*
