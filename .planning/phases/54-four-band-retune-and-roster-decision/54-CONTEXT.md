# Phase 54: Four-Band Retune & Roster Decision - Context

**Gathered:** 2026-09-21
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run) — 3 areas / 9 questions; Areas 1 and 3 recommended answers accepted, Area 2 Q1 overridden by the user ("Full readout every rung")

<domain>
## Phase Boundary

`engine/difficulty.js#difficultyCurve` is reshaped toward the four recorded bands (Filter 1–4 / Wall 5–8 / Breakaway 9–15 / Endgame 16–20) so the bot's average run ends floor 5–7, every dial move gated on a full bot readout; the tier-3/5 roster question (Herman, Drarl, Vampire, Djinni) is closed with a recorded per-creature decision; the 65 curve-height cells Phase 52 handed here are re-measured on the AFTER curve and re-dispositioned. Requirements BAND-01, BAND-02, BAND-03, TUNE-08. Resolves todo `2026-09-20-average-run-ends-floor-5-7-four-band-difficulty-shape.md`.

**Baseline (BEFORE = Phase 53 AFTER at `78572c5`, reused — already in `docs/DIFFICULTY-RETUNE.md` `### v1.7 · Phase 53 — Joiner level cap`):** solo death depth min/p50/p90/max **1/4/6/9**, reach ≥5 33.0 % / ≥10 0.0 % / ≥20 0.0 %; `--party` p50/p90 5/6, stuck 59/200; class smoke pooled mean 3.96 (715 runs). Death causes ≈ 60 % combat (Dante, Werebeast, Poltergeist, Philly, Rinkle, Drarl lead), ≈ 25 % hazards (fell off a wall 7 %, trap 6.5 %, leap 4 %), ≈ 10 % starvation / exhaustion. Caster-encounter rate 2.8 % on floors 1–5, 44.9 % on 6–10.

</domain>

<decisions>
## Implementation Decisions

### Area 1 — Curve shape (all recommended answers accepted)
- **Floors 1–4 keep Phase 27's existing ramps** (`FOE_GRACE_AT_2 = 0.5` → 1.0 at `FOE_GRACE_CANON_FROM_DEPTH = 5`; `HAZARD_SCALE_AT_START = 0.5` flat through 3, canon at 5). "Identity-ish through floor 4" is read as **no NEW floor 1–4 dials**, not "delete the cushion". Floor 1 stays exact identity: `FOE_GRACE_AT_1 = 1.0` and `HAZARD_FROM_DEPTH >= 2` are untouchable (every fixture-exposed fight is on floor 1).
- **Floors 5–15 may go sub-identity in combat** — today they are exact canon (`COMBAT_SCALE_FROM_DEPTH = 21`). Rung 1 of the ladder is a band-shaped piecewise `foePower` (and, if needed, `abilityThreat`) curve on 5–15: a step at 5 (the Wall — foePower steps UP from the floor-4 grace value but may land below 1.0), an eased slope through 9–15, and **exactly `1.0` from floor 16 onward** so the `--start-depth 20` slice is byte-identical (BAND-01's deep-lethality yardstick). Keep the structural-identity technique (`>=` guard returning the literal `1`, as `graceFor` and `hazardScale` do) so 16–20 is identity by construction, not by float rounding. `COMBAT_SCALE_FROM_DEPTH` stays 21 (21+ ramp untouched — Phase 27's "may only ever move up").
- **Non-combat dials are rung 2**, taken only if rung 1 alone does not reach the bands: encounter-dot density (`ENCOUNTER_DOT_*`, `DENSITY_CANON_THROUGH_DEPTH = 2` respected — floors 1–2 canon), darkness (`DARK_*`), hazards on 5–8 (a second hazard band is allowed since falls/traps/leaps are ≈ 25 % of deaths), water. Breather floors (`BREATHER_EVERY = 5`) stay.
- **No flat-damage nerf to chase the median** (BAND-02, ROADMAP SC5): no bestiary dice trims, no `foeDmgBonusFor` shape change, no hero-side buffs. The curve's `foePower` already scales wp and the `lvl²` melee term together — that is the allowed lever.
- **The bands are bot numbers.** The tuning bot's policy is frozen for the whole phase (no Joiner acceptance, potion/camp/flee thresholds unchanged — a moved instrument is unreadable). Targets as numbers: solo median death depth **5–7**, p90 **≈ 10–13**, reach-16 a few percent, reach-20 well under 1 %; the class matrix (`tune-classes`) is the second yardstick (pooled mean should move into the same band; no class cell may collapse below its Phase 53 value by more than the pooled shift). Misses are recorded per BAND-03 with the untaken rung and the reason.

### Area 2 — Iteration protocol (Q1 USER OVERRIDE: full readout every rung; Q2, Q3 recommended answers accepted)
- **Every rung gets the FULL readout** — `node tools/tune-difficulty.mjs --seeds=200` (solo, ~1.5 min), `node tools/tune-difficulty.mjs --seeds=200 --party` (~21 min; ~60/200 stuck at the 20,000-action cap is normal, own bucket), and `node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p54-rungN-smoke.json` (~1.5 min), plus `node tools/tune-difficulty.mjs --seeds=50 --start-depth=20` (the deep-lethality slice — must be byte-identical to BEFORE on every rung, since 16+ is identity). Budget ≈ 25 min of bot time per rung; **ladder cap 4 rungs**, then stop and record the misses. The executor runs the `--party` run in the background (Bash `run_in_background`, output to a file in the phase dir, poll the file — the tool's own 10-min timeout is shorter than the run) and sequences solo → smoke → start-depth-20 while it runs. Each rung's four transcripts are committed under the ledger (see below); the rung's dial values are cited against the readout that motivated them (BAND-02 "every dial change cited against a bot readout that moved toward the bands").
- **A rung that would touch floor 1 is escalated, not taken** (`FOE_GRACE_AT_1`, `HAZARD_FROM_DEPTH`, floor-1 dots/dark): the executor stops, records the rung as untaken with the reason "floor-1 parity", and the orchestrator surfaces it. Expected parity outcome: **MOVED SET (0)** — measured with `tools/initiative-fixture-scan.mjs` Part B and the full parity suite on the AFTER curve, declared in a `FIXTURE-INVENTORY.md` Phase 54 section with a `BAND-02` MOVED SET guard in `divergence-records.test.js` (Phase 53's JOIN-02 guard is the pattern). If a fixture unexpectedly moves, declare + regenerate per the engine gate; `test/parity/prototype-master.js.txt` (hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`) and `comparables.js` are never edited.
- **The 65 curve-height cells (Phase 52 hand-off):** no per-row dice trims. After the curve lands, re-run `node tools/damage-curve-audit.mjs` (both `--rule=whole|dice` as the tool takes them), commit the output, record the new flagged-cell count in the ledger, and refresh each remaining row's Disposition in `content/BESTIARY-REBALANCE.md` (a Phase 54 addendum). A row is retuned **only** if it is still a **≥ 100 % one-shot** (crit ≥ the band's max HP bar) at its own tier's band after the curve — and then by a `strikesAs` / dice-shape change in the Herman style, declared per row. Note the audit's HP bars may need the band's new foePower folded in (the tool reads the curve — verify it does).

### Area 3 — Roster decision, TUNE-08 (all recommended answers accepted)
- **Per creature, from the AFTER audit + a forced-20 bot slice** (`--seeds=50 --start-depth=20`, the same slice as above, with the per-foe death-cause breakdown): Herman, Drarl, Vampire, Djinni each get one of `stays — deliberate deep-tier threat` (the default), or `retuned in place` (only if still a ≥ 100 % one-shot at its own tier's band after the curve; `strikesAs` / dice shape, never a tier move — tier moves re-roll the encounter tables). Herman is already retuned (Phase 52, `strikesAs: 5`, crit 37) and is expected to record as "stays". Today's Endgame-bar readings to re-measure: Drarl tier-5 crit 62 (116 %), Vampire tier-5 crit 58 × `atk: 2` (108 %), Djinni tier-5 crit 58 (108 %).
- **The forced-20 untaken rungs are the deliberate Endgame shape**: floors gained p50 0 / mean 0.84 and reach ≥ 20 0.1 % are recorded as intended (victory rare and celebrated); no further 21+ easing (`FOE_POWER_MAX`, `ABILITY_THREAT_MAX`, `FOE_CAP_MAX` untouched); the depth-20 slice is the yardstick that proves 16–20 did not move.
- **Any roster change is measured with the fixture scan and declared** per the engine gate — expected zero (no fixture meets these four).

### Ledger & records
- `docs/DIFFICULTY-RETUNE.md`: a new H3 `### v1.7 · Phase 54 — four-band retune & roster decision` under the existing `## v1.7 tuning pass (Phases 51–54) — per-phase bot readouts` H2 (which must stay immediately before `## v1.2 retune (Phase 27) — TUNE-05..07`; pinned by `test/unit/difficulty-retune-ledger.test.js`). Inside it: (1) **the four bands verbatim** from the todo's quoted user text plus the numeric targets (BAND-01); (2) a **change table with one row per constant, before → after** (BAND-03); (3) one `#### Rung N` per iteration with the four transcripts and the reading; (4) the **miss table** (each target not met → untaken rung + reason); (5) the **roster table** (four rows, decision + evidence); (6) the depth-20 slice identity proof.
- `content/BESTIARY-REBALANCE.md`: Phase 54 addendum — audit cell count before/after the curve, refreshed dispositions, any in-place retune with before/after.
- `engine/difficulty.js`: every changed or added constant carries a `DELIBERATE RULES CHANGE (Phase 54, BAND-02, 2026-09-21)` JSDoc in the Phase 27 style (the readout that motivated it, the rung, the identity guarantees kept); `test/difficulty/difficulty.test.js` PARITY GUARD and identity pins are re-pinned to measured values, never loosened; new pins: floor 1 exact identity, `foePower === 1` literal for every depth ≥ 16, `--start-depth 20` curve object byte-identical to Phase 53's.
- Class-pass smoke files: `docs/class-pass/v17-p54-rung{1..4}-smoke.json` and `docs/class-pass/v17-p54-after-smoke.json` (the final rung's copy); `test/unit/class-pass-ledger.test.js` heading pin respected.

### Claude's Discretion
- The exact piecewise shape and constant names for the 5–15 band curve (e.g. `WALL_FROM_DEPTH = 5`, `WALL_FOE_POWER`, `BREAKAWAY_TO_DEPTH = 15`, `ENDGAME_CANON_FROM_DEPTH = 16`) — planner decides, in the Phase 27 naming style; a single `bandFoePowerFor(d)` helper next to `graceFor(d)` is fine.
- Rung ordering after rung 1 (which non-combat dial second) — driven by the death-cause breakdown of the previous rung (hazard deaths → hazard band; starvation → not a difficulty.js dial, record as a miss reason if it dominates).
- Whether `abilityThreat` gets the same band shape as `foePower` or stays identity through 20 — measure first (caster-encounter rate jumps to 45 % on floors 6–10).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/difficulty.js` (500 lines): `difficultyCurve(depth)` returns `{ depth, breather, dots, darkBlobs, darkRadius, foeCap, foeBonus, foeLvlBias, foePower, hazardScale, abilityThreat, waterPools }`; `graceFor(d)` (floors 2–4 sub-identity, literal 1 from `FOE_GRACE_CANON_FROM_DEPTH`), `softCapFloat`, `isBreather`; application helpers `foeCountFor`, `foeWpFor`, `foeDmgBonusFor`, `scaleHazard`, `abilityCadenceFor`. Consumers: `engine/combat.js:234`, `engine/encounters.js:89`, `engine/foeAbilities.js:57/80/161`, `engine/maze.js:119/306`, `engine/movement.js:295`. Draw-free by design.
- Constants today: `COMBAT_SCALE_FROM_DEPTH 21`, `FOE_CAP_BASE 3 / MAX 4 / SOFT_K 20`, `FOE_POWER_BASE 1.0 / MAX 1.15 / SOFT_K 35`, `ABILITY_THREAT_BASE 1.0 / MAX 1.3 / SOFT_K 30`, `FOE_GRACE_AT_1 1.0`, `FOE_GRACE_AT_2 0.5`, `FOE_GRACE_CANON_FROM_DEPTH 5`, `HAZARD_FROM_DEPTH 2`, `HAZARD_SCALE_AT_START 0.5`, `HAZARD_FLAT_THROUGH_DEPTH 3`, `HAZARD_CANON_FROM_DEPTH 5`, `ENCOUNTER_DOT_BASE 9 / CAP 13 / SOFT_K 12`, `DENSITY_CANON_THROUGH_DEPTH 2`, `DARK_BLOB_CAP 3`, `DARK_HOLD_THROUGH_DEPTH 3`, `BREATHER_EVERY 5`, `WATER_POOL_*`.
- Bot tools: `tools/tune-difficulty.mjs` (`--seeds`, `--party`, `--start-depth=N`; prints death-depth distribution, reach table, death-cause breakdown, caster-encounter rate by band, parley/foe-ability readouts), `tools/tune-classes.mjs` (`--seeds --workers --out`), `tools/class-pass-diff.mjs`. Bot policy: `tools/lib/tuning-bot.mjs` (frozen this phase).
- Audit tools: `tools/damage-curve-audit.mjs` (+ committed output; `FLAGGED: 65 rows across 209 row×band cells` today), `tools/cadence-audit.mjs`, `tools/initiative-fixture-scan.mjs` (Part B generic first-divergent-action — Phase 53 reused it for a measured zero).
- Tests: `test/difficulty/difficulty.test.js` (PARITY GUARD + identity pins), `test/unit/difficulty-retune-ledger.test.js`, `test/unit/class-pass-ledger.test.js`, `test/parity/divergence-records.test.js` (INIT-01 / DMG-02 / JOIN-02 MOVED SET guards).
- Ledgers: `docs/DIFFICULTY-RETUNE.md` (Phase 27 iteration-log style with rungs and "what to turn next"; v1.7 H2 with Phase 51/52/53 H3s), `content/BESTIARY-REBALANCE.md` (Phase 27 and Phase 52 addenda), `test/parity/FIXTURE-INVENTORY.md` (Phase 51/52/53 sections).

### Established Patterns
- Phase 27's ladder discipline: one rung per readout, constants moved by notches, each notch's JSDoc cites the readout; identity outside the band is structural (`>=` guard, literal `1`); "may only ever move up" on `COMBAT_SCALE_FROM_DEPTH`.
- Engine gate + greenfield ruling (measure → declare → regenerate only movers; no dual paths; bot plays the new rules).
- Report tools exit 0 with committed output; invariants pinned in unit tests; SUMMARY ends with `## Human verification (deferred to end of run)`.

### Integration Points
- `engine/difficulty.js` (constants + curve), `test/difficulty/difficulty.test.js` (re-pins + new pins), `test/parity/FIXTURE-INVENTORY.md` + `divergence-records.test.js` (Phase 54 section + BAND-02 guard), `docs/DIFFICULTY-RETUNE.md` (Phase 54 H3), `content/BESTIARY-REBALANCE.md` (Phase 54 addendum), `docs/class-pass/v17-p54-*.json`, `tools/damage-curve-audit-output.txt` (re-committed). Possibly `content/bestiary.js` (only for an in-place roster retune). No shell/UI changes.

</code_context>

<specifics>
## Specific Ideas

- BAND-01 verbatim text (from the todo, quote exactly in the ledger): "For a 20-floor dungeon designed to be highly challenging, the average run should end around floor 5 to 7 — a sharp early curve where failure is common, so breaking deeper feels earned. … Four bands: Floors 1–4, The Filter — high variance; a few bad drops or early mistakes mean a quick death; cleared consistently only after mastering the basics. Floors 5–8, The Wall — where the average run dies; difficulty spikes; surviving needs skill or an item synergy. Floors 9–15, The Breakaway Zone — a strong run; still brutal, but the build gives a fighting chance. Floors 16–20, The Endgame — the true test; victory rare and celebrated."
- The Wall's "spike" is relative to the Filter's graced floors: foePower at 5 steps up from the floor-4 grace value; it does not have to reach 1.0 at 5 — the slope through 5–8 and 9–15 is the dial, 16 is where the literal 1.0 returns.
- Expected first-rung direction: p50 4 → 5–7 needs floors 5–8 more survivable than canon for the bot (canon identity at 5 is currently the cliff the median dies on: reach ≥5 is 33 %, reach ≥10 is 0 %).
- Time budget: 4 rungs × ~25 min bot time ≈ 1.7 h plus the BEFORE (reused) — the executor should start each rung's `--party` run first and work the fast readouts while it runs.

</specifics>

<deferred>
## Deferred Ideas

- Teaching the bot to accept in-run Joiners or use potions/camps better — a harness change; not this phase (the instrument is frozen).
- Starvation / exhaustion tuning (food economy) — not a `difficulty.js` dial; if starvation dominates a rung's misses, record it as the reason and leave for a later pass.
- Tier moves for any roster creature — explicitly excluded (re-rolls encounter tables).
- Hero-side buffs or bestiary dice trims to chase the median — excluded by BAND-02.

</deferred>

## USER RULINGS at plan approval (2026-09-21) — supersede the matching Area 1 / Area 2 lines above

- **Filter dials are movable.** The planner showed that with floors 1–4 byte-identical, only 33 % of solo runs reach floor 5, so the median is pinned at 4 by construction. Ruling: the ladder MAY move the EXISTING Phase 27 floor 2–4 dials — `FOE_GRACE_AT_2` (0.5 → as low as Phase 27's noted 0.35 ceiling) and `HAZARD_SCALE_AT_START` (0.5 → lower) — as rungs. Floor 1 stays exact identity (`FOE_GRACE_AT_1 = 1.0`, `HAZARD_FROM_DEPTH >= 2`, floor-1 dots/dark canon — parity); the ramps still reach exactly 1.0 at their existing canon-from depths; no NEW floor 1–4 dials. Reach ≥ 5 becomes a per-rung target, not an invariant; the floors-1-untouched check is `difficultyCurve(1)` byte-identity + the depth-20 slice + the floor-1 fixture scan.
- **The ≥ 100 % one-shot rule applies to the Drake.** Under the dice rule the four roster creatures read 62–69 % of the Endgame bar (the 108–116 % figures above were the whole-sum rule); the Drake (Beasts tier 4, 2d10+4) reads 120–139 % in every band. Ruling: apply the in-place retune to the Drake (2d10+4 → 2d8+2, `drakeBreath` untouched, declared end-to-end); Herman / Drarl / Vampire / Djinni record "stays".
- Two commits per rung (`feat` constants+pins, then `docs` readouts) accepted — every readout provably taken on the tree carrying the dial.

## USER RULING C (2026-09-21, mid-ladder after rung 2) — the target is a per-floor survival CURVE, not bands as numbers

The rung 1/2 readouts showed the bot's per-floor survival is ~90/89/81 % on floors 1–3, then **55 % / 37 % / 37 % / 20 %** on 4–7 — "that curve is not a curve, that's a wall." The user replaced BAND-01's numeric targets (median 5–7, p90 10–13, reach-20 well under 1 %) with this table — **verbatim, the tuning target for the rest of Phase 54** (individual survival `p_L` = chance of surviving floor L given you reached it; cumulative `S_L` = chance a run reaches the end of floor L):

| Floor | p_L | S_L | Note |
|---|---|---|---|
| 1 | 98.8 % | 98.8 % | High early survival |
| 2 | 96.3 % | 95.1 % | |
| 3 | 93.1 % | 88.6 % | Degradation accelerates |
| 4 | 89.9 % | 79.7 % | |
| 5 | 86.9 % | 69.2 % | |
| 6 | 84.3 % | 58.4 % | The 50/50 flip occurs here |
| 7 | 82.2 % | 48.0 % | |
| 8 | 80.6 % | 38.7 % | Maximum bottleneck pressure |
| 9 | 79.5 % | 30.8 % | Lowest individual survival |
| 10 | 78.9 % | 24.3 % | Less than 1 in 4 remain |
| 11 | 78.7 % | 19.1 % | Curve stabilizes |
| 12 | 78.8 % | 15.1 % | |
| 13 | 79.1 % | 11.9 % | |
| 14 | 79.6 % | 9.5 % | Single-digit survival begins |
| 15 | 80.2 % | 7.6 % | |
| 16 | 81.0 % | 6.2 % | |
| 17 | 81.8 % | 5.0 % | |
| 18 | 82.7 % | 4.2 % | |
| 19 | 83.6 % | 3.5 % | |
| 20 | 84.5 % | 5.0 % / 3.0 % | 🦄 The Unicorn Milestone (the user's note was not included; treat 3–5 % as the pass band) |
| 21 | 85.4 % | 2.5 % | The infinite crawl begins |
| 22 | 86.4 % | 2.2 % | |
| 23 | 87.2 % | 1.9 % | Less than 2 % survival |
| 24 | 88.1 % | 1.7 % | |
| 25 | 88.9 % | 1.5 % | |

Consequences (orchestrator's reading, to be honoured by the re-planned ladder):
- **Rules fidelity is relaxed for survival rates** — the user's words: "It's ok if we diverge from the actual rules we have enclosed in the pdf for survival rates." Dials may leave canon at any depth ≥ 2 by any amount the readout justifies; the engine gate still applies (measure → declare → regenerate movers; master never edited). Floor 1 stays parity-exact unless the ladder proves floor 1 itself is off-curve (today 90 % vs 98.8 % target) — then a floor-1 rung is an ESCALATION to the user with the fixture exposure named, not taken silently.
- **The shape has three parts:** floors 1–4 need to go UP to 99/96/93/90 % (today 90/89/81/55 %); floors 5–10 need ~87 → 79 % (today 37 % at 5–6, 20 % at 7, ~0 % reach at 9+); floors 11–25 need ~79 → 89 % (a *rising* p_L — the Endgame is *not* steeper; the depth-20 slice yardstick is superseded: `--start-depth 20` should read p_L ≈ 84.5 %, not "unchanged"). `ENDGAME_CANON_FROM_DEPTH` / the literal-1 guard from 16 and `COMBAT_SCALE_FROM_DEPTH = 21` are no longer sacred — they may move if the readout says so, with the Phase 27 "may only move up" note superseded by this ruling.
- **The readout is now the per-floor survival table**: `p_L` = 1 − deaths_at_L / runs_reaching_L, `S_L` cumulative, from the death-depth histogram (`tools/lib/band-readout.mjs` gains a `per-floor survival` block printing p_L / S_L next to the target and the delta). Stop rule: every floor 1–10 within ±8 points of the target `S_L` and floors 11–20 within ±3 points of `S_L` (or the executor records the miss with the untaken rung); reach-20 in 3–5 %.
- **Ladder discipline is relaxed**: notches are whatever the fit needs (the executor may compute a per-band foePower / hazard value from the previous rung's p_L ratio rather than stepping 0.05); ladder cap 6 rungs; full readout every rung still (user override stands); the bot policy stays frozen, but `--max-actions` may be raised (it is a run cap, not policy) if deep runs start hitting it.
- Rungs 1–2 stand (`b0facb6`, `850f176`, raw readouts `27e209c`); the ledger's rung-2 section and the target table are rewritten by the re-planned Plan 02.

## USER RULING D (2026-09-21, after rung 5) — STOP the floor-range ladder; Phase 54 becomes the GLOBAL DIFFICULTY MODEL

The user's words: "Remove one-off hacks and bandaids that try to get bands by floor ranges, and establish dials that work on the dungeon as a whole." and "we've reached a point where [staying true to the source] won't get us the difficulty curve we want … holistically as a game design we probably need to deviate from core." **Yes to all three** orchestrator questions: (a) foe level is derived from DEPTH, not the hero's level; (b) hero-side tuning (HP, regen) is in scope; (c) the bot is made a fair player first (fresh BEFORE).

### The system, as measured (why floor bands could never work)
- Foe level = `min(heroLevel, depth)` (−1 on a d4 = 1): difficulty is a function of the HERO's level; depth stops mattering once the hero out-levels it (~floor 3). Kill SP ≈ lvl², thresholds 201/501/901/1501 → the bot is level 3 by floor 4, 4–5 by the Wall, which is exactly when tier-3/4/5 rosters (Drarl, Herman, Drake) appear in the death list.
- Foe damage per hit = `lvl² + dmgBonus + dice`; every `difficulty.js` knot scaled only the `lvl²` term (and foe HP). Dice (Werebeast 2×d10, Dante ×3, Gremlin +3, Drake 2d10+4) were untouched → the ladder saturated (floor 4: 55 → 63 → 71 % then flat; floors 1–3 byte-identical across rungs 3–4).
- Foe count steps 2 → 3 when the hero reaches level 3 (~floor 4) — a second level-keyed cliff.
- No regeneration; encounter dots 10 → 13 with depth; hazards (falls d6+d6 per 10 ft, traps) ≈ 25 % of deaths (half of floor 1's 19 deaths); starvation/exhaustion ≈ 10–15 % and rising as foes soften.

### Remove (every value keyed to a floor range)
`WALL_*`, `BREAKAWAY_*`, `ENDGAME_*` knots and `knotFoePowerFor/knotHazardFor/knotAbilityThreatFor`; `FOE_GRACE_AT_1..4` and `graceFor`; `HAZARD_SCALE_AT_*`, `HAZARD_FROM_DEPTH`, `WALL_HAZARD_SCALE`; `COMBAT_SCALE_FROM_DEPTH` and the 21+ soft-cap ramp (`FOE_POWER_MAX/SOFT_K`, `ABILITY_THREAT_MAX/SOFT_K`, `FOE_CAP_MAX/SOFT_K`); `DENSITY_CANON_THROUGH_DEPTH`; `DARK_HOLD_THROUGH_DEPTH`. Keep breather floors (`BREATHER_EVERY`, rhythm not difficulty), water pools, dark radius, and all measurement machinery.

### Add — global dials, each ONE number or `{ base, perDepth }` (a smooth slope over depth, never a range)
| Dial | Engine hook | Purpose |
|---|---|---|
| `FOE_LEVEL` `{ base, perDepth }` → `foeLevel = clamp(round(base + perDepth × depth), 1, 5)` (−1 on d4 = 1 kept) | `engine/combat.js` `maxLvl` (replaces `min(c.level, depth)`) | depth becomes the difficulty axis; out-leveling the dungeon is how a strong run breaks away |
| `FOE_HIT_SCALE` `{ base, perDepth }` applied to the WHOLE hit (`lvl² + dice`, crit included) after the roll | `engine/combat.js` hero / member / pursuit damage sites (one helper) | the dominant term gets a dial |
| `FOE_HP_SCALE` `{ base, perDepth }` | `foeWpFor` | fight length / attrition |
| `FOE_COUNT_SKEW` (one number: shifts P(1/2/3 foes); cap 3, no level-keyed cap) | `engine/combat.js` `n` (canon d4 ternary replaced by a weighted pick with the same draw count) | removes the level-3 body cliff |
| `ROUND_DAMAGE_CEILING` (fraction of a level-appropriate hero's MEAN max HP a single foe may deal per round, incl. multi-attack) | damage helper, post-scale clamp | cliffs (Werebeast, Dante, Drake, Herman) become curve height, not one-shots — replaces per-monster triage; Ruling B's Drake trim is superseded by this rule |
| `HERO_HP_SCALE` (base HP and per-level gain multiplier) and `HERO_REGEN_PER_FLOOR` (fraction of max HP restored on arriving at a new floor) | `engine/character.js` rollCharacter / checkLevel; `engine/movement.js` or the floor-arrival path | the other side of every fight; cheapest lever for floors 1–3 |
| `ENCOUNTER_DOTS` `{ base, perDepth }` (replaces `ENCOUNTER_DOT_BASE/CAP/SOFT_K`) | `difficultyCurve.dots` | attrition and time |
| `HAZARD_SCALE` `{ base, perDepth }` (falls, traps, leaps — floor 1 included) | `scaleHazard` | ≈ 25 % of deaths |
| `FOOD_CLOCK` (starting rations and/or drain rate multiplier) | economy/derived ration path | starvation ≈ 10–15 % |
| `ABILITY_THREAT` `{ base, perDepth }` (keep, as a global) | `abilityCadenceFor` | caster kits |

`difficultyCurve(depth)` returns the evaluated globals for that depth (still draw-free, still the single lookup every consumer reads).

### Bug fix folded in (user, 2026-09-21): walls and crevices are ONE AND DONE
Today a failed climb/leap hurts you and leaves you on the near side to retry (each retry rolls and can hurt again). New rule, user-chosen: **one roll per feature — success crosses clean; failure takes the fall damage and you STILL end up on the far side** (the feature is cleared either way: `there.feat = null` and the move completes on both branches; death on the fall still ends the run in place). `engine/movement.js` climb/gorge block (the `if (!ok) { … return events; }` early return goes away) and the tool branch unchanged. Narration: `fellClimbing` / `fellInGorge` keep their copy but now precede `climbedOver` / `leaptOver`-equivalent movement — planner decides whether to add a "…and dragged yourself over" line (in voice, BANNED-scanned). Declared divergence; fixtures with a failed climb/leap move and are regenerated.

### Bot fairness first (fresh BEFORE)
`tools/lib/tuning-bot.mjs` policy: potion threshold 0.5 → 0.6, flee 0.3 → 0.4 (caster 0.5 → 0.6), accept a Joiner when the party is empty (D-20 superseded), camp when rations allow and HP < 0.5. One commit, then a fresh BEFORE readout (solo / party / class smoke / depth-20 slice with the per-floor survival block) on the untouched engine — every later number compares to THAT.

### Fitting, not laddering
A committed calibration script (`tools/fit-difficulty.mjs`) evaluates a candidate dial set with the solo 200-seed run (~90 s) and reports the per-floor S_L error vs the Ruling C curve; coordinate search over the ~10 dials (bounded, deterministic order, ≤ ~40 evaluations ≈ 1 h) from a planner-chosen starting point; the best set is committed with its fit log; THEN one full readout (solo / party / class smoke / depth-20) and the ledger. Pass bands as Ruling C (±8 pts S_L on 1–10, ±3 on 11–20, reach-20 3–5 %); misses recorded per floor with the reason.

### Parity under this ruling
Every fixture will move (floor 1 changes). Measure with the scan and the parity suite, declare ONE `global-difficulty` divergence record (kind `action-path`, fromAction per fixture, measured before/after) plus the one-and-done climb record, regenerate all movers; the prototype master (`a1f4d0dc…`) stays the historic reference and is never edited; comparables untouched. The engine gate becomes "everything that moves is declared", not "nothing moves".

### Rungs 1–5 and the knot table
Stand in history (commits `b0facb6` … `1cb56c6`, readouts in `readouts/`); the ledger's Phase 54 H3 keeps them as the record of why floor bands failed (one paragraph), and the global model's sections follow. Plan 03's roster/audit work is re-scoped: the round-damage ceiling replaces per-creature retunes; Herman/Drarl/Vampire/Djinni/Drake are recorded under the ceiling with before/after numbers.

### Roster depth question (user, 2026-09-21) — answered, recorded
54 creatures, 6 types × 5 tiers (12/11/12/12/7). Under foe-level-from-depth each tier covers ~4 floors with the d4 = 1 overlap; the global HP/hit slopes scale the same creature with depth, so no new content is needed to ship the curve. Tier 5 (7 creatures) is thin for the Endgame/infinite crawl — recorded as a **v1.8 content candidate** ("Endgame roster: +5–8 tier-5 creatures, ≥ 1 per type"), not Phase 54 work.

### USER APPROVAL of the global-model plans (2026-09-21) — with three cuts
Plans 54-04 (fair bot + readouts + fresh BEFORE + ledger opener) → 54-05 (engine model at identity, remove list, one-and-done climbs, declared movers) → 54-06 (remaining dials, CLASS_MITIGATION, fit tool) → 54-07 (fit, AFTER, roster under the ceiling, ledger close). Cuts, applied to the plans: (1) the automated search covers the CORE 10 coordinates only — FOE_LEVEL.perDepth/base, HERO_SP_SCALE, FOE_HIT_SCALE.base/perDepth, FOE_HP_SCALE.base, HERO_HP_SCALE, HERO_REGEN_PER_FLOOR, HAZARD_SCALE.base, ENCOUNTER_DOTS.base; every other dial is implemented and HELD at its start value ("held (available)"), the miss table names which held dial would be released next; (2) MAZE_SIZE is cut from this phase (21×21 stays; v1.8 candidate); (3) the fit objective and pass/fail cover floors 1–12 at 200 seeds; floors 13–20 and reach-20 are measured at AFTER with a 1,000-seed solo run and a `--start-depth=10` slice and reported as the tail (dS only, not pass/fail). Starting values as in the planner's dial table (54-06 `## The dial table`).

## USER RULING E (2026-09-21 16:10, mid-54-07) — fit budget 40, seeds stay 200

Measured on the fair bot at the identity point, one 200-seed evaluation of `tools/fit-difficulty.mjs` takes **6–10 min** on this 4-core i5-2400 (the bot now survives to floor ~10, so each run is ~3× the old 1.5-min figure), not the ~1.5 min the plan budgeted. A budget-80 search would run ~12 h. The user chose **`--budget=40`, `--seeds=200`, `--workers=4`** (2 probes per CORE-10 coordinate per pass instead of 4; per-floor SE stays ≈ 3.5 pts against the ±8 pass band) over budget 80 / 100 seeds / pausing. The search RESUMES from the existing `fit/fit-log.jsonl` (evaluations n=1..3 — the identity point and two class-fairness-rejected FOE_LEVEL probes — are reused, never re-played). Everything else in 54-07 stands: the CORE 10 in two passes, every other dial held, objective = floors 1–12, the manual-notch rule ≤ 2, the full AFTER at 200 seeds, the tail measured not fitted. Record the cut in the ledger's `#### Fit` section next to the budget line.

## USER RULING F (2026-09-21 19:40, mid-54-07) — the fit runs in checkpoints: stop on a failure pattern, adjust, rerun; run out the budget only when converging

After 27 evaluations of the budget-40 search only 3 distinct points were feasible (#1 identity 237, #5 135, #18 64 — all MISS, ~15–20 pts too easy on every floor 5–12 against the Ruling C S_L curve); 22 of 25 rejections were the class-fairness guardrail on the Magic User (10× reach-5 > 12 pts below the pool, 10× p50 > 1 floor below the pool) — every dial that hardens floors 1–8 collapses the caster pool first, and the one dial that could prop it up (`CLASS_MITIGATION["Magic User"].spellPower`) sat outside the CORE 10. The user's words: *"stop and adjust. Run again after adjusting until you see a failure pattern begin to be apparent, then stop and adjust again. The only time you want to keep going toward maximum runs (40) is when we're clearly meeting our goal so that we can print it out."*

**Adjustment 1 (taken now):** add `{ path: ["CLASS_MITIGATION", "Magic User", "spellPower"], step: 0.15, lo: 1.0, hi: 2.0 }` to `tools/lib/fit-score.mjs#SEARCH_PLAN` as the 11th coordinate (the CORE-10 cut of the plan approval is amended by this ruling; `HELD_DIALS` loses that row; identity stays 1). Resume from the existing `fit/fit-log.jsonl` (the 27 logged points stay valid — spellPower was 1 in every one).

**Checkpoint protocol (every rerun):** the search runs in blocks of 10 evaluations (`--budget` = logged + 10, same log, same seeds 200 / workers 4). After each block the executor reads the block and classifies it:
- **Failure pattern** — any of: feasible rate in the block < 40 %; the best feasible score did not improve by ≥ 10 % over the previous block; one constraint rejected ≥ 6 of the 10. → STOP the search, do not continue; return a `checkpoint:decision` to the orchestrator with the block table, the pattern, and ONE proposed adjustment (a coordinate to add/release, a bound/step to widen, or a constraint threshold to relax — with the reason). The orchestrator brings it to the user; the next dispatch carries the ruling.
- **Converging** — best feasible score improving block over block AND the best point has ≥ 8 of floors 1–12 inside their pass band (or verdict PASS). → continue to the full budget (40 from the restart point) and finish 54-07 as planned (AFTER, tail, audit, roster, ledger, SUMMARY).
- **Neither** (improving but not yet ≥ 8 floors in band) → run one more block, then re-classify.
Each stop/adjust cycle is recorded in the ledger's `#### Fit` section as its own row (block, best score, pattern, adjustment, ruling).

## USER RULING G (2026-09-21 22:50, mid-54-07, cycle 3) — fix the Table-4 HP-dot compounding, loosen the class guardrails, drop the spellPower coordinate, restart from the cycle-2 best

Cycle 2 (blocks 1–2 from `start-block1.json`, log `fit/fit-log-block1.jsonl`, 20 rows / 9 feasible) reached **#6 score 10.83** (foe level `0.9 + 0.26·d`, HERO_HP_SCALE 1.25, HERO_REGEN 0.25, HERO_SP 0.28, LOOT 0.8; floors 8–12 in band, floor 5 +8, floor 6 +16, floor 7 +13) and then produced a clear failure pattern — nine probes after #6 with zero improvement, seven vetoed by the class guardrails (Thief/MU p50 more than 1 floor from the pool, MU reach-5 more than 12 pts, Fighter dmgTakenPerFight). Two root causes were identified and the user chose to fix both before the next block:

1. **Engine (USER-RULED rules change, BAND-02):** 54-05's Table-4 ±HP dots as fractions of the hero's CURRENT maxWP compound — the "+25 HP" row's `maxWP += round(0.6 × maxWP)` is a permanent ×1.6 per pull (three pulls ≈ ×4; the Pixel 7 showed a 140-hp "-15 HP" toll on floor 6). Replace with the **canon flat values scaled once by HERO_HP_SCALE** — `+25 → round(25 × HERO_HP_SCALE)`, `-15 → round(15 × HERO_HP_SCALE)`, and the "small" row likewise — no feedback from the pool into itself; `DOT_HP_FRACTION` is retired from `DIALS` (export-key-set pin re-measured) or kept only as documentation. Declare the `encounters.json#tablefour` mover again with this rationale (it was already a 54-05 declared mover), re-pin `test/unit/encounters.test.js`, camp heals stay as 54-05 landed them unless they show the same feedback (check `CAMP_HEAL_FRACTION`'s consumer — a fraction of maxWP as a HEAL is fine because it never changes maxWP).
2. **Search (standing authority granted — see below):** class guardrails loosen to **p50 within 2 floors of the pooled median and reach-5 within 20 pts** (the user ruled class pools are not meant to be equal; a 1-floor tolerance on integer medians vetoed ~60 % of candidates); the `CLASS_MITIGATION["Magic User"].spellPower` coordinate is **dropped** from `SEARCH_PLAN` (proved a structural no-op at step 0.15 across 200 seeds — the per-floor survival metric does not register a +1 on half the bolts; `HELD_DIALS` regains its row); the fit-tool replay bug is fixed first (`+Infinity` serialises as `null`, so a resumed walk diverges after the first infeasible row — rehydrate it in `readLog`) so blocks within a cycle continue ONE walk; per-block stdout is appended (`>>`), never truncated.
3. **Restart** from `fit/start-block3.json` (= the cycle-2 best #6 dials) in a fresh log `fit/fit-log-block3.jsonl`, blocks of 10, USER RULING F classification after each block.

**Standing authority (user, 2026-09-21):** for the rest of Phase 54 the orchestrator may make SEARCH-PARAMETER adjustments on a failure pattern without asking — constraint thresholds, coordinate set/order, steps and bounds, start point, block size — recording each as its own ruling-F row in the ledger. ENGINE rules changes (anything that moves a fixture or a canon value) still come to the user first. Cycle-2 evidence (`fit-log-block1.jsonl`, `best-block1.json`, `search-stdout-block1.txt`) is committed as history.
