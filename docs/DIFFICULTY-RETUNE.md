# Consolidated Difficulty Retune (Phase 21) — before/after ledger

This is the ONE retune across party power, economy, monster power, ability
threat, and parley numbers (TUNE-01..04) — the single tuning exercise that
closes PARTY-10, ECON deep tuning, and the Phase 3 feel-tuning debt in one
pass rather than three. This document is the ledger: BEFORE readout (this
plan, 21-01) → change table with a rationale per knob → AFTER readout →
comparison against the D-09 targets → DR checklist (21-04/21-05). The D-09
targets below are a **sanity floor, never the exit criterion** — the actual
exit criterion is the human DR round (TUNE-04, D-15) at the end of the
milestone; bot numbers only earn the right to ask for that round.

## Scope and method (D-10, D-11)

Constants in scope for the single retune pass:

- `engine/difficulty.js`'s existing floor-generation knobs (`ENCOUNTER_DOT_*`,
  `DARK_BLOB_CAP`, `DARK_RADIUS_*`) plus the NEW combat-scaling fields this
  phase adds to `difficultyCurve` (D-01): `foeCap`, `foeBonus`, `foeLvlBias`,
  `foePower`, `abilityThreat`.
- `abilityThreat`'s cadence effect at the four `tickAbilityCooldowns`/
  `firstReadyAbility` call sites (D-03).
- Depth-scaled economy sources: the wilmst-cache row, the parley Humans
  bonus amount (`d6 × 100 × depth`), the chest amount table.
- Party power counterweight: `upkeep(c)` by race/depth and PARTY-06's
  existing XP-share damping — **not** a new hire-cost mechanic (D-20: no
  hire action exists; a party member joins for free via a random Joiner
  encounter, so there is nothing to retune there).

Explicit **NOT-in-scope** list this phase does not touch: bestiary base
stats (Phase 18's `content/BESTIARY-REBALANCE.md` ledger stands as-is);
class/race/sub-class features; store price scaling by depth (D-21: no such
mechanic exists — `openStore` reads `state.floor.depth` only for the
premium item's enchant roll, never for pricing); as read-only context,
`LOOT_DIVISOR` and the purse table sit on fixture-exposed paths and stay
flat.

Method (D-11): at most **two** harness iterations to land inside the D-09
targets, then stop — the DR round decides the rest. Every change to a
fixture-exposed path is gated on depth ≤ 5 / level 1 (D-04/D-19) so the
parity suite stays byte-identical with zero new scaling carve-outs.

## Targets (D-09) — a sanity floor, never the exit criterion

Measured with the upgraded bot (this plan) at 200 seeds:

| Metric | Target |
|---|---|
| Median death depth | 8–15 |
| p90 death depth | ≥ 25 |
| Runs past floor 50 | < 2% |
| Median actions per floor | 40–80 (≈ 3–6 floors per 5–10 minute session) |

## Bot proxy (TUNE-02)

The upgraded bot (`tools/lib/tuning-bot.mjs`, shared by both tools per D-23)
now: casts an attack spell when a Magic User has charges (D-05), drinks a
healing potion below 50% wp when carried, camps outside combat below 50% wp
when rations allow, heads for the exit once a floor's encounter dots are
cleared or a 50-action exploration budget is spent, raises its flee/parley
threshold to 50% against any kit-bearing live foe (D-06, vs. 30% against a
plain group), takes an offered find (leaves only on a full bag), declines
every Joiner offer (hiring policy is a Deferred Idea — `--party` is the only
member source, D-20), and always leaves a store. It routes around a SEEN
climb/gorge/trap cell when an alternative path exists, crossing one only
when no detour does (an UNSEEN hazard is never avoided — the bot only uses
information a player has).

Bot parameters (BEFORE and AFTER **must** use identical values — the
`Bot:` line inside every transcript below records them verbatim so a reader
can grep-diff the two ledgers):

| Parameter | Value | Decision |
|---|---|---|
| Seeds per readout | 200 (`i * 7919 + 1`) | D-08/D-09 |
| Exploration budget per floor | 50 actions | D-05 + Claude's Discretion |
| Per-run action cap | 20000 | Pitfall 4 |
| Flee/parley threshold | 0.3 plain / 0.5 vs. any kit-bearing live foe | D-06 |
| Potion / camp thresholds | wp/maxWP < 0.5 | D-05 + Claude's Discretion |
| Party | `--party` forces one member at run start via the documented `forceParty` harness-only bypass | D-12/D-20 |

`--party` is its own distribution, not a paired diff against the solo seed
list — `forceParty`'s `meetJoiner`/`resolveJoiner` draws shift every
subsequent rng draw in the run, so a `--party` seed's exploration path
diverges from the same seed's solo path from the first step onward.

## BEFORE readout — upgraded bot, post-Phase-20 engine (commit bd0ba7c)

Captured 2026-09-14. `git diff --quiet bd0ba7c -- engine content src
mazeworld.html` exited 0 both before these three runs were launched and
again after this plan's final commit — the engine, content, `src/`, and
`mazeworld.html` are byte-identical to commit `bd0ba7c7bed5f601752f5ea77a82126cceacd697`
for this entire plan. Each run was launched with Bash `run_in_background`,
writing to its own scratchpad file with an `EXIT=<code>` sentinel appended
on completion, and polled in bounded ≤30s checks (never a foreground wait)
until each sentinel appeared; none exceeded the 20-minute abort threshold
(the longest of the three took a little under 4 minutes).

While transcribing these three runs, the BEFORE run surfaced a real bug in
the bot's own policy (Rule 1, auto-fixed before the readout below was
captured): `parley()`'s `wilmsryVsMagical` branch refuses without ever
setting `C.parleyTried` (Phase 20 D-12 — a refusal is not a spent attempt),
so `canParley` stays true forever for a fluency-2 Wilmsry vs. a Magical
foe. A bot that always prefers parley over flee below the flee threshold
therefore re-picked `{ type: "parley" }` every turn for the rest of that
fight, burning almost an entire run's `maxActions` budget on a no-progress
loop. `tools/lib/tuning-bot.mjs`'s `decideAction` now falls through to
flee for the rest of an encounter once a parley attempt has been refused
(`ctx.parleyBlocked`, set on `parleyRefused`, cleared on the next
`encounterStarted`) — the three transcripts below are the readout captured
**after** that fix, so the numbers below reflect the intended bot, not the
stuck one.

### tune-difficulty --seeds=200

```
tune-difficulty: 200 seeded auto-play run(s)
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=3  p90=5  max=10

Action-count distribution:
  min=15  p50=293  p90=659  max=20000

Death-cause breakdown:
  cut down by a Dante  34 (17.0%)
  cut down by a Poltergeist 15 (7.5%)
  starved in the dark  15 (7.5%)
  undone by a trap     12 (6.0%)
  cut down by a Gremlin 12 (6.0%)
  fell off a wall      10 (5.0%)
  maxActionsHit        10 (5.0%)
  cut down by a Werebeast 9 (4.5%)
  spent by the dungeon itself 7 (3.5%)
  cut down by a Drarl  6 (3.0%)
  cut down by a Pogo   5 (2.5%)
  cut down by a Philly 5 (2.5%)
  came up short on a leap 5 (2.5%)
  cut down by a Hair   4 (2.0%)
  cut down by a China Wolf 4 (2.0%)
  cut down by a Drekk  3 (1.5%)
  cut down by a Shadow 3 (1.5%)
  cut down by a Blumble 3 (1.5%)
  cut down by a Skeleton 3 (1.5%)
  cut down by a Rinkle 3 (1.5%)
  cut down by a Herman 3 (1.5%)
  cut down by a Cave Bear 3 (1.5%)
  cut down by a Dog Face 2 (1.0%)
  cut down by a Shriek 2 (1.0%)
  cut down by a Trachea 2 (1.0%)
  cut down by a M&M    2 (1.0%)
  cut down by a Goblin 2 (1.0%)
  cut down by a Frank  2 (1.0%)
  cut down by a Zombie 2 (1.0%)
  cut down by a Sterling 2 (1.0%)
  cut down by a Zit    2 (1.0%)
  cut down by a Google 1 (0.5%)
  cut down by a Drat   1 (0.5%)
  cut down by a Primp  1 (0.5%)
  cut down by a Ghost  1 (0.5%)
  cut down by a Wolf   1 (0.5%)
  cut down by a Flube  1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)
  cut down by a Ghoul  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=158  successes=94 (59.5%)  failures=64  refused=1  exhausted=0
  runs with >=1 attempt: 73 of 200
  SP from parley: 1493 of 72163 total SP (2.1%)

Reach table (% of runs reaching floor N):
  >=5: 15.0%  >=10: 0.5%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=15  p50=98  p90=137  max=20000

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 36/1461 (2.5%)
  6-10: 17/62 (27.4%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=157  foeBolted=28  foeDrained=2  foeDebuffed=24  foeHealed=0  foeSummoned=0
  heroResisted=74  heroResistFailed=24
  ability damage: 110 of 19478 total damage taken (0.6%)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5

Outcome: 190 dead, 0 won, 10 hit maxActions
```

### tune-difficulty --seeds=200 --party

```
tune-difficulty: 200 seeded auto-play run(s)
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=3  p90=6  max=14

Action-count distribution:
  min=21  p50=368  p90=669  max=20000

Death-cause breakdown:
  starved in the dark  64 (32.0%)
  undone by a trap     21 (10.5%)
  cut down by a Werebeast 12 (6.0%)
  cut down by a Dante  11 (5.5%)
  spent by the dungeon itself 8 (4.0%)
  maxActionsHit        7 (3.5%)
  fell off a wall      7 (3.5%)
  cut down by a Spectre 6 (3.0%)
  cut down by a Drake  5 (2.5%)
  cut down by a Poltergeist 5 (2.5%)
  cut down by a Cave Bear 5 (2.5%)
  cut down by a Google 4 (2.0%)
  cut down by a Frank  4 (2.0%)
  cut down by a Drarl  3 (1.5%)
  cut down by a Primp  3 (1.5%)
  cut down by a Pogo   3 (1.5%)
  cut down by a Sterling 3 (1.5%)
  cut down by a Trachea 3 (1.5%)
  cut down by a Herman 2 (1.0%)
  cut down by a Blumble 2 (1.0%)
  cut down by a China Wolf 2 (1.0%)
  came up short on a leap 2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Skeleton 2 (1.0%)
  cut down by a Ghoul  2 (1.0%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Vampire 1 (0.5%)
  cut down by a Drekk  1 (0.5%)
  cut down by a Rast   1 (0.5%)
  cut down by a Craig  1 (0.5%)
  cut down by a Goblin 1 (0.5%)
  cut down by a Philly 1 (0.5%)
  cut down by a Zit    1 (0.5%)
  cut down by a Wolf   1 (0.5%)
  cut down by a Gremlin 1 (0.5%)
  cut down by a Rinkle 1 (0.5%)
  cut down by a Krupke 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=96  successes=68 (70.8%)  failures=28  refused=0  exhausted=0
  runs with >=1 attempt: 52 of 200
  SP from parley: 1955 of 100990 total SP (1.9%)

Reach table (% of runs reaching floor N):
  >=5: 31.5%  >=10: 1.5%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=21  p50=101  p90=134  max=20000

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 48/1846 (2.6%)
  6-10: 37/101 (36.6%)
  11-20: 14/23 (60.9%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=206  foeBolted=80  foeDrained=9  foeDebuffed=26  foeHealed=0  foeSummoned=0
  heroResisted=66  heroResistFailed=24
  ability damage: 259 of 12053 total damage taken (2.1%)

Party (--party, D-12/D-20):
  member forced at run start in 200/200 runs; member alive at run end: 133 (66.5%)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5

Outcome: 193 dead, 0 won, 7 hit maxActions
```

### tune-economy --seeds=200

```
tune-economy: 200 seeded auto-play run(s)
(SCAFFOLD STUB / TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Wilmst earned per run:
  min=0  p50=218  p90=1134  max=3815

Peak wilmst held per run:
  min=50  p50=249  p90=1184  max=3865

Wilmst held at run end:
  min=50  p50=249  p90=1184  max=3865

Reached depth:
  min=1  p50=3  p90=5  max=10

Income by source (goldGained.why):
  chest               48175 (59.0%)
  tableFour           17100 (20.9%)
  off the body         6238 (7.6%)
  grimoire             5583 (6.8%)
  parley               1900 (2.3%)
  pickpocket           1337 (1.6%)
  faerie               1300 (1.6%)

Reach table (% of runs reaching floor N):
  >=5: 15.0%  >=10: 0.5%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=15  p50=98  p90=137  max=20000

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 36/1461 (2.5%)
  6-10: 17/62 (27.4%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=157  foeBolted=28  foeDrained=2  foeDebuffed=24  foeHealed=0  foeSummoned=0
  heroResisted=74  heroResistFailed=24
  ability damage: 110 of 19478 total damage taken (0.6%)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5
```

**Headline BEFORE numbers:**

- Death depth (solo): min=1, p50=3, p90=5, max=10 — **p50 = 3 vs. target
  8–15 (well short)**, **p90 = 5 vs. target ≥ 25 (far short)**. Runs past
  floor 50: 0% (well within the < 2% target, trivially — nothing scales
  past floor 5-10 yet). Party (`--party`): p50=3, p90=6, max=14 — a member
  helps a little (higher max, higher `>=10` reach: 1.5% vs. 0.5% solo) but
  the shape is the same "the curve stops scaling around floor 5" story.
- Reach table (solo): ≥5 floors 15.0%, ≥10 floors 0.5%, ≥20/≥30/≥50 all
  0.0% — confirms the depth-scaling gap `startCombat`'s canon `maxLvl`
  clamp/`cap=3` ceiling leaves past floor 5 (RESEARCH.md Pitfall 1): there
  is currently nothing in the engine to die TO past that point except
  starvation, traps, and falls.
- Median actions per floor (solo): 98 — **above the 40–80 target band**,
  meaning even at this shallow average depth the bot is spending MORE
  actions per floor than the target session-length band implies, mostly
  because most runs never leave floors 1–5 (the exploration budget/dot-
  clearing loop repeats at the same difficulty for a long time before a
  death finally lands).
- Caster-encounter rate: 2.5% in the 1-5 band, jumping to 27.4% in the 6-10
  band (solo) / 36.6% (party) — casters are already common the moment a
  run survives past floor 5, well before any `abilityThreat` scaling is
  applied (identity at depth ≤ 5, D-19). The 11-20 band only has samples in
  the `--party` run (14/23, 60.9%) — the deeper bands (21-30/31-50/51+)
  have zero samples in any of the three runs, exactly as expected: nothing
  in the BEFORE engine gets the bot that deep.
- Ability damage share: 0.6% (solo) / 2.1% (party) of all damage taken —
  small but non-zero; casters exist and occasionally land a bolt, but they
  are not yet a meaningful threat contributor at these shallow depths.
- `--party` vs. solo p50: 3 vs. 3 (tied) — a forced member at floor 1
  barely moves the median death depth this early, though it does raise
  the max (14 vs. 10) and the ≥10 reach (1.5% vs. 0.5%).
- Economy: peak wilmst p50=249, p90=1184 — chests (59.0%) and `tableFour`
  encounters (20.9%) dominate income; parley supplies only 2.3% of gold and
  1.9-2.1% of SP across the two tune-difficulty runs, confirming Phase 20's
  parley-dominance fix holds at these depths.
- Contrast with the pre-bot-upgrade (dumb, attack-only) readout
  (`docs/PARLEY-REBALANCE.md`: death-depth p50 **1**, p90 **2**, max **4**):
  the bot upgrade ALONE — before any engine constant moves — roughly
  triples the median death depth (1 → 3) and more than doubles p90 (2 → 5),
  simply by surviving longer (camping, drinking, casting, heading to the
  exit) rather than exposing any new engine capability. This is exactly
  the D-08 goal: a usable proxy for the retune, not yet evidence that the
  curve itself has changed.

## Change table (21-04)

| Knob | File | Before | After | Rationale | Decision |
|---|---|---|---|---|---|
| `FOE_CAP_MAX` | `engine/difficulty.js` | 3 (identity) | 5 | Bigger fights deep — the count ceiling soft-caps toward 5 (≈4 by the mid-teens, ≈5 by the low thirties), applied as a zero-new-draw additive bonus on top of the canon `d4`/`d4` roll (D-17). Identity at depth ≤ 5. | D-02 |
| `FOE_POWER_MAX` | `engine/difficulty.js` | 1.0 (identity) | 1.6 | ≈ +35% hit points and flat melee damage at depth 20, ≈ +50% at depth 40, never above +60%. Applied at `startCombat` copy time to `wp`/`maxWP` and a `dmgBonus` key consumed as post-draw arithmetic in the three melee sites. Identity at depth ≤ 5. | D-02 |
| `ABILITY_THREAT_MAX` | `engine/difficulty.js` | 1.0 (identity) | 2.0 | A caster kit's `every: 2` effectively becomes "every visit" (every: 1) from ≈ depth 25 onward; `uses` doubles at the asymptote. Read via `abilityCadenceFor` in `tickAbilityCooldowns`/`firstReadyAbility`/`resolveFoeAbility`. Identity at depth ≤ 5. | D-03 |
| `FOE_CAP_SOFT_K` | `engine/difficulty.js` | 20 | 20 (unchanged) | 21-02's illustrative k already gives the intended ≈4-by-mid-teens/≈5-by-low-thirties ramp against `FOE_CAP_MAX=5`; iteration 1's readout did not ask for a steeper/gentler ramp. | D-02 / Claude's Discretion |
| `FOE_POWER_SOFT_K` | `engine/difficulty.js` | 25 | 35 (iteration 2) | Iteration 1's readout missed median/p90 (both too low); this plan's own "what to turn" table directs raising `FOE_POWER_SOFT_K` (slower ramp) before lowering a MAX. Iteration 2's readout confirmed this had no measurable effect (numbers unchanged within noise) — see the Comparison table's reading. | D-02 / D-11 |
| `ABILITY_THREAT_SOFT_K` | `engine/difficulty.js` | 20 | 30 (iteration 2) | Same trigger and same "what to turn" guidance as `FOE_POWER_SOFT_K` above; same confirmed-no-effect result. | D-03 / D-11 |
| `FOE_LVL_BIAS` | `engine/difficulty.js` | 0 | 0 (reserved, unused) | No signal in the iteration-1 readout asked for a tier bias on top of the canon `maxLvl` clamp; left reserved for a future D-16 pass if the DR round asks. | D-01 |
| `ENCOUNTER_DOT_CAP` / `ENCOUNTER_DOT_SOFT_K` / `DARK_*` | `engine/difficulty.js` | unchanged | unchanged | Iteration 1's median actions-per-floor number (see below) did not miss the D-09 band in the direction that this table's "what to turn" guidance ties to dot density; no change made. | D-10 |
| `lootDepth` (economy counterweight) | `engine/difficulty.js` / `engine/encounters.js` / `engine/combat.js` | — | **not applied** | Trigger did not fire in either iteration: tune-economy `peakGold p50` stayed at 249 (BEFORE and both AFTER iterations), nowhere near the 5000 trigger. Files byte-unchanged since BASE. | D-10 / D-21 |
| `memberUpkeepScale` (party counterweight) | `engine/difficulty.js` / `engine/movement.js` | — | **not applied** | Trigger did not fire in either iteration: `--party` p50 (3) never exceeded 1.5 × solo p50 (4.5) in BEFORE or either AFTER iteration. PARTY-06's XP-share damping sufficed; `engine/movement.js` byte-unchanged since BASE. | D-12 / D-20 |

### Iteration log

**Iteration 1** — constants: `FOE_CAP_MAX=5` (k=20), `FOE_POWER_MAX=1.6` (k=25), `ABILITY_THREAT_MAX=2.0` (k=20), `FOE_LVL_BIAS=0` (reserved). Three 200-seed background runs launched with the exact BEFORE command lines and bot parameters (`tools/tune-difficulty.mjs --seeds=200`, `--seeds=200 --party`, `tools/tune-economy.mjs --seeds=200`), each ending in an `EXIT=<code>` sentinel, polled in bounded checks. Result (see the readout below): median death depth 3 (missed, target 8-15), p90 5 (missed, target ≥25), runs past floor 50 0% (met, target <2%), median actions/floor 98 (missed, target 40-80) — byte-for-byte unchanged from BEFORE. Neither conditional trigger fired (economy peakGold p50=249, nowhere near the 5000 trigger; `--party` p50=3 vs. solo p50=3, nowhere near the 1.5x-solo trigger). Reading: the retuned dials are identity through depth 5 (D-19) and only 0.5-2.0% of runs ever reach depth 10 — a dial that only activates past floor 5 cannot move a distribution whose median/p90 sit at floors 3/5. Proceeding to Iteration 2 per D-11 with the one directed, identity-safe knob (raise `FOE_POWER_SOFT_K`/`ABILITY_THREAT_SOFT_K`) to confirm this reading before stopping.

**Iteration 2 (final)** — constants: `FOE_POWER_SOFT_K` 25→35, `ABILITY_THREAT_SOFT_K` 20→30 (the "median < 8 / p90 < 25 → raise SOFT_K" guidance from this plan's own "what to turn" table); `FOE_CAP_MAX`/`FOE_POWER_MAX`/`ABILITY_THREAT_MAX`/`FOE_CAP_SOFT_K`/`FOE_LVL_BIAS` unchanged from iteration 1. `ENCOUNTER_DOT_CAP` (the actions-per-floor guidance) was assessed and explicitly NOT applied — see the "assessed and declined" note above the iteration-1 readout for the fixture-risk and structural-non-effect reasoning. `npm test` re-verified green (951/951) before re-running the three 200-seed background readouts with the identical BEFORE/iteration-1 command lines and bot parameters. Result: median death depth 3 (still missed), p90 5/6 (still missed), runs past floor 50 0% (still met), median actions/floor 98/101 (still missed) — all four numbers effectively unchanged from iteration 1 (within seed-level noise: solo p90 unchanged at 5, party max shifted 15→12, one caster-band sample count shifted by 1-3 — expected run-to-run noise at n=200, not a directional trend). This CONFIRMS the iteration-1 reading: the D-09 median/p90/actions-per-floor targets are governed by depth 1-5 lethality/exploration texture, which this phase deliberately does not touch (the user's own directive: keep floors 1-3 dangerous but readable). Per D-11, this is iteration 2 of at most 2 — STOPPING here. The three misses are RECORDED in the Comparison table below with this reading, and handed to the DR round (D-16) rather than chased with a third iteration.

## AFTER readout — retuned engine (iteration 1)

Captured 2026-09-14 against the retuned engine (`FOE_CAP_MAX=5`, `FOE_POWER_MAX=1.6`,
`ABILITY_THREAT_MAX=2.0`; `*_SOFT_K` unchanged from 21-02's illustrative values).
Same three background-run/EXIT=/bounded-poll discipline as BEFORE; all three
completed with `EXIT=0` within the poll window.

### tune-difficulty --seeds=200

```
tune-difficulty: 200 seeded auto-play run(s)
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=3  p90=5  max=10

Action-count distribution:
  min=15  p50=293  p90=659  max=20000

Death-cause breakdown:
  cut down by a Dante  34 (17.0%)
  cut down by a Poltergeist 15 (7.5%)
  starved in the dark  15 (7.5%)
  undone by a trap     12 (6.0%)
  cut down by a Gremlin 12 (6.0%)
  fell off a wall      10 (5.0%)
  maxActionsHit        10 (5.0%)
  cut down by a Werebeast 9 (4.5%)
  spent by the dungeon itself 7 (3.5%)
  cut down by a Drarl  6 (3.0%)
  cut down by a Pogo   5 (2.5%)
  cut down by a Philly 5 (2.5%)
  came up short on a leap 5 (2.5%)
  cut down by a Hair   4 (2.0%)
  cut down by a China Wolf 4 (2.0%)
  cut down by a Drekk  3 (1.5%)
  cut down by a Shadow 3 (1.5%)
  cut down by a Blumble 3 (1.5%)
  cut down by a Skeleton 3 (1.5%)
  cut down by a Rinkle 3 (1.5%)
  cut down by a Herman 3 (1.5%)
  cut down by a Cave Bear 3 (1.5%)
  cut down by a Dog Face 2 (1.0%)
  cut down by a Shriek 2 (1.0%)
  cut down by a Trachea 2 (1.0%)
  cut down by a M&M    2 (1.0%)
  cut down by a Goblin 2 (1.0%)
  cut down by a Frank  2 (1.0%)
  cut down by a Zombie 2 (1.0%)
  cut down by a Sterling 2 (1.0%)
  cut down by a Zit    2 (1.0%)
  cut down by a Google 1 (0.5%)
  cut down by a Drat   1 (0.5%)
  cut down by a Primp  1 (0.5%)
  cut down by a Ghost  1 (0.5%)
  cut down by a Wolf   1 (0.5%)
  cut down by a Flube  1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)
  cut down by a Ghoul  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=159  successes=94 (59.1%)  failures=65  refused=1  exhausted=0
  runs with >=1 attempt: 74 of 200
  SP from parley: 1493 of 73026 total SP (2.0%)

Reach table (% of runs reaching floor N):
  >=5: 15.0%  >=10: 0.5%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=15  p50=98  p90=137  max=20000

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 36/1461 (2.5%)
  6-10: 21/68 (30.9%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=181  foeBolted=41  foeDrained=1  foeDebuffed=26  foeHealed=3  foeSummoned=0
  heroResisted=74  heroResistFailed=24
  ability damage: 190 of 19559 total damage taken (1.0%)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5

Outcome: 190 dead, 0 won, 10 hit maxActions
```

### tune-difficulty --seeds=200 --party

```
tune-difficulty: 200 seeded auto-play run(s)
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=3  p90=6  max=15

Action-count distribution:
  min=21  p50=368  p90=670  max=20000

Death-cause breakdown:
  starved in the dark  63 (31.5%)
  undone by a trap     21 (10.5%)
  cut down by a Werebeast 12 (6.0%)
  cut down by a Dante  11 (5.5%)
  spent by the dungeon itself 7 (3.5%)
  maxActionsHit        7 (3.5%)
  fell off a wall      7 (3.5%)
  cut down by a Drake  5 (2.5%)
  cut down by a Poltergeist 5 (2.5%)
  cut down by a Spectre 5 (2.5%)
  cut down by a Cave Bear 5 (2.5%)
  cut down by a Google 4 (2.0%)
  cut down by a Frank  4 (2.0%)
  cut down by a Drarl  3 (1.5%)
  cut down by a Primp  3 (1.5%)
  cut down by a Pogo   3 (1.5%)
  cut down by a Sterling 3 (1.5%)
  cut down by a Trachea 3 (1.5%)
  cut down by a Herman 2 (1.0%)
  cut down by a Blumble 2 (1.0%)
  cut down by a Vampire 2 (1.0%)
  cut down by a China Wolf 2 (1.0%)
  came up short on a leap 2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Skeleton 2 (1.0%)
  cut down by a Dread Lock 2 (1.0%)
  cut down by a Ghoul  2 (1.0%)
  cut down by a Craig  1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Drekk  1 (0.5%)
  cut down by a Rast   1 (0.5%)
  cut down by a Goblin 1 (0.5%)
  cut down by a Philly 1 (0.5%)
  cut down by a Zit    1 (0.5%)
  cut down by a Wolf   1 (0.5%)
  cut down by a Gremlin 1 (0.5%)
  cut down by a Rinkle 1 (0.5%)
  cut down by a Krupke 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=90  successes=63 (70.0%)  failures=27  refused=0  exhausted=0
  runs with >=1 attempt: 51 of 200
  SP from parley: 1660 of 104611 total SP (1.6%)

Reach table (% of runs reaching floor N):
  >=5: 31.5%  >=10: 2.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=21  p50=101  p90=134  max=20000

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 48/1846 (2.6%)
  6-10: 37/111 (33.3%)
  11-20: 15/21 (71.4%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=263  foeBolted=88  foeDrained=5  foeDebuffed=26  foeHealed=3  foeSummoned=3
  heroResisted=102  heroResistFailed=35
  ability damage: 295 of 12432 total damage taken (2.4%)

Party (--party, D-12/D-20):
  member forced at run start in 200/200 runs; member alive at run end: 131 (65.5%)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5

Outcome: 193 dead, 0 won, 7 hit maxActions
```

### tune-economy --seeds=200

```
tune-economy: 200 seeded auto-play run(s)
(SCAFFOLD STUB / TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Wilmst earned per run:
  min=0  p50=218  p90=1134  max=5725

Peak wilmst held per run:
  min=50  p50=249  p90=1184  max=5775

Wilmst held at run end:
  min=50  p50=249  p90=1184  max=5775

Reached depth:
  min=1  p50=3  p90=5  max=10

Income by source (goldGained.why):
  chest               48805 (57.5%)
  tableFour           19500 (23.0%)
  off the body         6336 (7.5%)
  grimoire             5733 (6.8%)
  parley               1900 (2.2%)
  pickpocket           1337 (1.6%)
  faerie               1300 (1.5%)

Reach table (% of runs reaching floor N):
  >=5: 15.0%  >=10: 0.5%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=15  p50=98  p90=137  max=20000

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 36/1461 (2.5%)
  6-10: 21/68 (30.9%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=181  foeBolted=41  foeDrained=1  foeDebuffed=26  foeHealed=3  foeSummoned=0
  heroResisted=74  heroResistFailed=24
  ability damage: 190 of 19559 total damage taken (1.0%)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5
```

**Headline iteration-1 AFTER numbers (vs. BEFORE):**

- Death depth (solo): min=1, p50=3, p90=5, max=10 — **byte-for-byte identical
  to BEFORE's solo distribution.** Party (`--party`): p50=3, p90=6 (was 6),
  max=15 (was 14) — a slightly higher max but the same p50/p90 story.
- Reach table (solo): ≥5 15.0% (unchanged), ≥10 0.5% (unchanged), ≥20/≥30/≥50
  all 0.0% (unchanged). The retuned dials (`foeCap`/`foePower`/
  `abilityThreat`) are identity through depth 5 by construction (D-19) and
  **only 0.5% of solo runs, 2.0% of `--party` runs, ever reach depth 10** —
  the vast majority of the death/action distribution never leaves the
  identity band, so the retuned dials have essentially nothing to act on yet.
- Median actions per floor: 98 (solo), 101 (`--party`) — unchanged from
  BEFORE. Confirms the same read: this metric is computed as actions ÷
  death-depth, and with p50 death depth pinned at 3, the number is a depth
  1-5 exploration/lethality characteristic, not something the depth 6+ dials
  can move.
- Economy: peak wilmst p50=249 (unchanged), p90=1184 (unchanged); max rose
  from 3865 to 5775 (one long `--party`-adjacent run reaching depth 10 with a
  bigger purse) — **p50 is nowhere near the 5000 economy trigger.**
- Caster-encounter rate by band: 1-5 unchanged (2.5%/2.6%); 6-10 rose slightly
  (27.4%→30.9% solo, 36.6%→33.3% party — noise at this sample size); 11-20
  only sampled in `--party` (60.9%→71.4%, still noisy — n=21-23). Ability
  damage share ticked up (0.6%→1.0% solo, 2.1%→2.4% party) — a small, expected
  effect of `abilityThreat` leaving identity at depth 6, but the encounters
  that see it remain rare (this same 6-10 band the BEFORE readout already
  flagged).
- **This is the expected, structurally-explained result, not a bug:** the
  retuned combat dials only diverge from identity at depth ≥ 6 (D-19), and
  the upgraded bot's own BEFORE readout already showed 0% of runs reaching
  floor 10+ and 0% reaching floor 20+. A dial that only activates past floor
  5 cannot move a distribution whose median/p90 sit at floors 3/5. The four
  D-09 targets (median 8-15, p90 ≥25, <2% past 50, actions/floor 40-80) are
  themselves computed over the SAME distribution — see the Iteration-1 D-09
  check below.

**Iteration-1 D-09 check (informational — Task 2 finalises the Comparison table):**

| Target | BEFORE | Iteration 1 AFTER | Met? |
|---|---|---|---|
| Median death depth 8-15 | 3 | 3 | **Missed** |
| p90 death depth ≥ 25 | 5 | 5 | **Missed** |
| Runs past floor 50 < 2% | 0% | 0% | Met |
| Median actions/floor 40-80 | 98 | 98 | **Missed** |

**Iteration-1 trigger check (D-10/D-12/D-20/D-21):**

- Economy trigger (peakGold p50 > 5000): p50 = 249. **Not triggered.**
- Party trigger (`--party` p50 > 1.5 × solo p50): 3 > 1.5×3=4.5? No.
  **Not triggered.**

**Iteration 2 decision (recorded in the Iteration log below):** three of the
four D-09 targets missed and both conditional triggers stayed cold. Per D-11
("at most two harness iterations... then stop"), Task 2 applies the "median
< 8 / p90 < 25" guidance (raise `FOE_POWER_SOFT_K`/`ABILITY_THREAT_SOFT_K`)
as the one directed, identity-safe adjustment, re-takes the readout once, and
then finalises the ledger's honest reading regardless of whether the numbers
move — this is exactly D-11's designed stopping point, not a bug to keep
chasing.

**On `ENCOUNTER_DOT_CAP` (the "actions per floor > 80" guidance) — assessed
and declined, not applied:** the plan's "what to turn" table also lists
"median actions per floor > 80 -> lower `ENCOUNTER_DOT_CAP`" as a candidate
fix. This was evaluated and NOT applied, for two concrete reasons recorded
here rather than silently skipped:
1. **Fixture risk.** `ENCOUNTER_DOT_CAP`/`ENCOUNTER_DOT_SOFT_K` are the
   pre-Phase-21 floor-generation knobs; `dots(depth)` is NOT gated to
   identity at depth <= 5 the way this phase's new combat fields are — it
   already varies with depth starting at floor 1 (`dots(1..5) === 9+d`
   today, matching the frozen prototype's original formula exactly, per
   `test/unit/combat-scaling.test.js`'s own D-19 identity test and this
   module's header comment). Verified numerically: `softCap(9, CAP, d, 12)`
   only reproduces `9+d` for d=1..5 at the CURRENT (24, 12) pair by
   construction — lowering `CAP` alone (e.g. to 20) changes `dots(3)` from
   12 to 11, which would change WHICH cells on a depth-1..5 floor receive
   `dot`/`tele`/`chest`/`trap`/`climb`/`gorge` features (`engine/maze.js`'s
   `genFloor` places these off a fixed shuffled-cell offset, not new rng
   draws) — i.e. it would silently regenerate the depth-1 fixture layout,
   which this plan's own prohibitions forbid.
2. **Would not move the target even if done safely.** `median actions per
   floor` is `actions / death depth` aggregated across all 200 runs; with
   `p50` death depth pinned at 3 (a depth <= 5 characteristic this phase
   does not touch), the median of that ratio is dominated by depth 1-5 runs
   where `dots` is identity-protected by construction — a change bounded to
   depth > 5 could not move the AGGREGATE median regardless of fixture
   safety.

This is exactly the kind of finding D-11's two-iteration cap and D-16's
DR-round hand-off exist for: the actions-per-floor miss is a depth 1-5
exploration/lethality characteristic, not a depth 6-50 scaling gap, so no
in-scope knob closes it this pass.

## AFTER readout — retuned engine (iteration 2, final)

Captured 2026-09-14 against `FOE_POWER_SOFT_K=35`, `ABILITY_THREAT_SOFT_K=30`
(everything else unchanged from iteration 1). Same background-run/EXIT=/
bounded-poll discipline; all three completed with `EXIT=0`.

### tune-difficulty --seeds=200

```
tune-difficulty: 200 seeded auto-play run(s)
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=3  p90=5  max=10

Action-count distribution:
  min=15  p50=293  p90=659  max=20000

Death-cause breakdown:
  cut down by a Dante  34 (17.0%)
  cut down by a Poltergeist 15 (7.5%)
  starved in the dark  15 (7.5%)
  undone by a trap     12 (6.0%)
  cut down by a Gremlin 12 (6.0%)
  fell off a wall      10 (5.0%)
  maxActionsHit        10 (5.0%)
  cut down by a Werebeast 9 (4.5%)
  spent by the dungeon itself 7 (3.5%)
  cut down by a Drarl  6 (3.0%)
  cut down by a Pogo   5 (2.5%)
  cut down by a Philly 5 (2.5%)
  came up short on a leap 5 (2.5%)
  cut down by a Hair   4 (2.0%)
  cut down by a China Wolf 4 (2.0%)
  cut down by a Drekk  3 (1.5%)
  cut down by a Shadow 3 (1.5%)
  cut down by a Blumble 3 (1.5%)
  cut down by a Skeleton 3 (1.5%)
  cut down by a Rinkle 3 (1.5%)
  cut down by a Herman 3 (1.5%)
  cut down by a Cave Bear 3 (1.5%)
  cut down by a Dog Face 2 (1.0%)
  cut down by a Shriek 2 (1.0%)
  cut down by a Trachea 2 (1.0%)
  cut down by a M&M    2 (1.0%)
  cut down by a Goblin 2 (1.0%)
  cut down by a Frank  2 (1.0%)
  cut down by a Zombie 2 (1.0%)
  cut down by a Sterling 2 (1.0%)
  cut down by a Zit    2 (1.0%)
  cut down by a Google 1 (0.5%)
  cut down by a Drat   1 (0.5%)
  cut down by a Primp  1 (0.5%)
  cut down by a Ghost  1 (0.5%)
  cut down by a Wolf   1 (0.5%)
  cut down by a Flube  1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)
  cut down by a Ghoul  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=159  successes=94 (59.1%)  failures=65  refused=1  exhausted=0
  runs with >=1 attempt: 74 of 200
  SP from parley: 1493 of 73026 total SP (2.0%)

Reach table (% of runs reaching floor N):
  >=5: 15.0%  >=10: 0.5%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=15  p50=98  p90=137  max=20000

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 36/1461 (2.5%)
  6-10: 21/69 (30.4%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=182  foeBolted=42  foeDrained=1  foeDebuffed=26  foeHealed=3  foeSummoned=0
  heroResisted=74  heroResistFailed=24
  ability damage: 204 of 19601 total damage taken (1.0%)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5

Outcome: 190 dead, 0 won, 10 hit maxActions
```

### tune-difficulty --seeds=200 --party

```
tune-difficulty: 200 seeded auto-play run(s)
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=3  p90=6  max=12

Action-count distribution:
  min=21  p50=368  p90=670  max=20000

Death-cause breakdown:
  starved in the dark  63 (31.5%)
  undone by a trap     21 (10.5%)
  cut down by a Werebeast 12 (6.0%)
  cut down by a Dante  11 (5.5%)
  spent by the dungeon itself 7 (3.5%)
  maxActionsHit        7 (3.5%)
  fell off a wall      7 (3.5%)
  cut down by a Drake  5 (2.5%)
  cut down by a Poltergeist 5 (2.5%)
  cut down by a Spectre 5 (2.5%)
  cut down by a Cave Bear 5 (2.5%)
  cut down by a Google 4 (2.0%)
  cut down by a Frank  4 (2.0%)
  cut down by a Drarl  3 (1.5%)
  cut down by a Primp  3 (1.5%)
  cut down by a Pogo   3 (1.5%)
  cut down by a Sterling 3 (1.5%)
  cut down by a Trachea 3 (1.5%)
  cut down by a Herman 2 (1.0%)
  cut down by a Blumble 2 (1.0%)
  cut down by a Dread Lock 2 (1.0%)
  cut down by a China Wolf 2 (1.0%)
  came up short on a leap 2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Skeleton 2 (1.0%)
  cut down by a Ghoul  2 (1.0%)
  cut down by a Craig  1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Vampire 1 (0.5%)
  cut down by a Drekk  1 (0.5%)
  cut down by a Rast   1 (0.5%)
  cut down by a Goblin 1 (0.5%)
  cut down by a Philly 1 (0.5%)
  cut down by a Zit    1 (0.5%)
  cut down by a Wolf   1 (0.5%)
  cut down by a Stalka Beast 1 (0.5%)
  cut down by a Gremlin 1 (0.5%)
  cut down by a Rinkle 1 (0.5%)
  cut down by a Krupke 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=90  successes=63 (70.0%)  failures=27  refused=0  exhausted=0
  runs with >=1 attempt: 51 of 200
  SP from parley: 1660 of 101478 total SP (1.6%)

Reach table (% of runs reaching floor N):
  >=5: 31.5%  >=10: 2.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=21  p50=101  p90=134  max=20000

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 48/1846 (2.6%)
  6-10: 39/114 (34.2%)
  11-20: 8/12 (66.7%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=205  foeBolted=81  foeDrained=5  foeDebuffed=23  foeHealed=0  foeSummoned=0
  heroResisted=70  heroResistFailed=26
  ability damage: 240 of 12340 total damage taken (1.9%)

Party (--party, D-12/D-20):
  member forced at run start in 200/200 runs; member alive at run end: 132 (66.0%)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5

Outcome: 193 dead, 0 won, 7 hit maxActions
```

### tune-economy --seeds=200

```
tune-economy: 200 seeded auto-play run(s)
(SCAFFOLD STUB / TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Wilmst earned per run:
  min=0  p50=218  p90=1134  max=5725

Peak wilmst held per run:
  min=50  p50=249  p90=1184  max=5775

Wilmst held at run end:
  min=50  p50=249  p90=1184  max=5775

Reached depth:
  min=1  p50=3  p90=5  max=10

Income by source (goldGained.why):
  chest               48805 (57.5%)
  tableFour           19500 (23.0%)
  off the body         6341 (7.5%)
  grimoire             5733 (6.8%)
  parley               1900 (2.2%)
  pickpocket           1337 (1.6%)
  faerie               1300 (1.5%)

Reach table (% of runs reaching floor N):
  >=5: 15.0%  >=10: 0.5%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=15  p50=98  p90=137  max=20000

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 36/1461 (2.5%)
  6-10: 21/69 (30.4%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=182  foeBolted=42  foeDrained=1  foeDebuffed=26  foeHealed=3  foeSummoned=0
  heroResisted=74  heroResistFailed=24
  ability damage: 204 of 19601 total damage taken (1.0%)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5
```

**Headline iteration-2 (final) numbers:** median death depth 3 (solo)/3
(party), p90 5 (solo)/6 (party), runs past floor 50 0%, median actions per
floor 98 (solo)/101 (party), peak wilmst p50 249 — every number is
unchanged from iteration 1 within normal seed-level noise (party max
15→12, a couple of caster-band sample counts shifted by 1-3 at n<25 —
expected noise, not a trend). Raising `FOE_POWER_SOFT_K`/
`ABILITY_THREAT_SOFT_K` had no measurable effect, confirming the iteration-1
reading: these three targets are governed by depth 1-5 lethality/
exploration, not depth 6+ combat scaling.

## Comparison vs D-09 (21-04)

| Target | BEFORE | AFTER (iteration 1) | AFTER (iteration 2, final) | Met? |
|---|---|---|---|---|
| Median death depth 8-15 | 3 | 3 | 3 | **Missed** |
| p90 death depth ≥ 25 | 5 | 5 | 5 (solo) / 6 (party) | **Missed** |
| Runs past floor 50 < 2% | 0% | 0% | 0% | Met |
| Median actions/floor 40-80 | 98 | 98 | 98 (solo) / 101 (party) | **Missed** |

Informational rows (not D-09 gates):

| Metric | BEFORE | AFTER (final) |
|---|---|---|
| Reach ≥10 (solo) | 0.5% | 0.5% |
| Reach ≥20 / ≥30 / ≥50 (solo) | 0.0% / 0.0% / 0.0% | 0.0% / 0.0% / 0.0% |
| Caster-encounter rate, deepest populated band (11-20, `--party` only) | n/a (0 samples) | 66.7% (8/12) |
| Ability damage share (solo / party) | 0.6% / 2.1% | 1.0% / 1.9% |
| `--party` p50 vs. solo p50 | 3 vs. 3 | 3 vs. 3 |
| Economy peak wilmst p50 / p90 | 249 / 1184 | 249 / 1184 |

**What the numbers say:** the retuned combat dials (`foeCap`/`foePower`/
`abilityThreat`, identity through depth 5 by construction) demonstrably work
as designed at the depths they can reach — `difficultyCurve(30)` produces a
4-foe cap, ≈1.38x foe power, and ≈1.7x ability cadence (verified directly in
`test/unit/combat-scaling.test.js`'s cap-boundary and depth-6-divergence
tests) — but the upgraded bot's own BEFORE readout already showed that
**99.5% of solo runs and 98% of `--party` runs never survive past floor 10**,
and 0% ever reach floor 20+. A dial that only diverges from identity past
floor 5 cannot move a death-depth distribution whose median and 90th
percentile sit at floors 3 and 5-6. Ability damage share (1.0%/1.9%) and the
11-20 caster-encounter rate (66.7% in the one band with samples) show the
dials ARE being exercised by the rare run that gets that deep — just not by
enough runs to move the aggregate median/p90/actions-per-floor numbers.

**What the numbers cannot say:** the bot's own play skill is arbitrary (it
never buys, upgrades gear, or plays optimally around a specific foe's
ability) — a human player who survives past floor 10 more often than this
bot does would exercise the retuned dials far more, and the deep-band
numbers above (n=12-69) are too small to be more than a rough sanity signal.
**This is a PROXY, not a gate** — the real verdict is the human DR round
(TUNE-04, D-15, 21-05) at depths 20/35/50 via the dev start-at-depth toggle
(21-03), which bypasses the bot's shallow-survival ceiling entirely.

**Per-target reading (median / p90 / actions-per-floor missed):** all three
misses share the same root cause — the bot's death distribution is
dominated by depth 1-5 outcomes (canon monster power, starvation, traps,
falls), which this retune deliberately does not touch (the user's own
directive: keep floors 1-3 dangerous but readable, spend the effort on
floors 6-50). Depth 6+ scaling is real and verified (see "What the numbers
say" above) but the bot practically never lives to exercise it at scale.
**D-16 hand-off:** these three misses are handed to the DR round, not
chased with a third iteration (D-11's hard cap). If the DR round's human
playtester at depth 20/35/50 finds the depth 6+ scaling itself feels wrong
(too soft or too harsh), that is the "tune again" trigger (D-16) — a
follow-up constants-only pass, not a re-plan.

## Not changed, and why (21-04)

- **Store price scaling by depth (D-21):** does not exist in the codebase
  (`openStore` reads `state.floor.depth` only for the premium item's enchant
  roll, never for pricing) and was not added this phase — adding one would
  be a new mechanic, out of TUNE-03's scope.
- **Hire cost (D-20):** does not exist — party members join for free via a
  random Joiner encounter (`resolveJoiner(true)`), no gold changes hands.
  Nothing to retune; PARTY-06's existing XP-share damping remains the
  primary party-power counterweight.
- **`LOOT_DIVISOR` / the `killFoe` purse table / base prices:** flat
  constants that sit on fixture-exposed paths (depth-1/level-1 fixtures) —
  left untouched (`grep -c 'export const LOOT_DIVISOR = 10;' engine/items.js`
  = 1, confirmed).
- **Bestiary base stats:** Phase 18's `content/BESTIARY-REBALANCE.md` ledger
  stands as-is; out of this phase's scope.
- **Summoned reinforcements:** the Djinni/Vampire/Stalka Beast/Krupke/
  Drudge/Drake summon literal in `foeAbilities.js#resolveFoeAbility` is
  deliberately not routed through `foeWpFor` — 21-02's own discretion
  (reinforcements are already tier-limited weak foes); unchanged this plan.
- **Class/race/sub-class features:** out of scope; untouched.
- **The Phase-20-deferred parley Humans wilmst bonus AMOUNT:** resolved by
  inaction — kept as `d6 × 100 × depth` (unchanged). The economy trigger
  (tune-economy AFTER `peakGold p50 > 5000`) did NOT fire in either
  iteration (p50 stayed at 249, nowhere close to 5000), so the `lootDepth`
  routing (D-10/D-21) that would have touched this amount was never applied
  — `engine/encounters.js` and `engine/combat.js` are byte-unchanged since
  `BASE` (`git diff --quiet` confirmed).
- **Party upkeep by depth / `memberUpkeepScale` (D-12/D-20):** the party
  trigger (`--party` AFTER death-depth p50 > 1.5 × solo p50) did NOT fire in
  either iteration (3 vs. 4.5 required) — PARTY-06's existing XP-share
  damping sufficed; no upkeep change was made. `engine/movement.js` is
  byte-unchanged since `BASE`.
- **`ENCOUNTER_DOT_CAP` (the actions-per-floor "what to turn" candidate):**
  assessed and declined — see the note above the iteration-1 AFTER readout
  for the fixture-risk (would change which depth 1-5 cells receive
  dot/tele/chest/trap/climb/gorge features) and structural-non-effect
  (median actions/floor is dominated by depth <= 5 runs a depth > 5 knob
  cannot reach) reasoning.
- **The 18-06 "deferred to 21" canon-mode items** (Sterling and the five
  `sp.ar` creatures' canon-mode consequences): still deferred — Deferred
  Ideas per 21-CONTEXT.md; revisit only if the DR round flags them,
  otherwise next milestone.

## DR checklist — TUNE-04 sign-off

This round is the phase's exit criterion (D-15) — everything above is a
sanity floor, never the exit criterion. The two AFTER readouts above show
the retuned combat dials are real and verified in unit tests
(`difficultyCurve(30)`: ≈4-foe cap, ≈1.38x foe power, ≈1.7x ability cadence)
but that the bot proxy structurally never lives long enough to feel them —
99.5% of solo runs and 98% of `--party` runs die by floor 10. The retune
under test in this checklist is the final constant block: `FOE_CAP_MAX=5`,
`FOE_POWER_MAX=1.6`, `ABILITY_THREAT_MAX=2.0` (iteration 1), plus
`FOE_POWER_SOFT_K=35` / `ABILITY_THREAT_SOFT_K=30` (iteration 2 — confirmed
no measurable effect on the bot, but still the constants shipping). The
tester is the user, playing on the Pixel 7 — the verdict below is either
**pass** or **tune-again**, and only the tester fills it in.

### Getting the build on the device

1. Build the debug APK: `npm run android:debug` (produces
   `android/app/build/outputs/apk/debug/app-debug.apk`; JDK/gradle pin
   notes live in `docs/RELEASING.md` and `.planning/STATE.md`'s
   "Build/env" ground truth).
2. If a Play-installed build is on the phone, uninstall it first — a
   Play build and a locally-signed debug build have different signers,
   and the phone can't hold both. Uninstalling loses the app's
   Preferences data, which is fine for a dev round.
3. Rediscover the wireless device: `adb devices` (or `adb mdns services`
   if the port has rotated — the Pixel 7 is `adb-28051FDH200H0R`,
   `10.0.0.175:<port rotates>` per STATE.md's Device notes).
4. Install: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
5. Relaunch (install alone does not reload the WebView):
   `adb shell am force-stop com.darktierstudios.delvedierepeat` then
   `adb shell monkey -p com.darktierstudios.delvedierepeat 1`.

### Starting a run at depth N

1. Start (or resume) a normal run.
2. Tap the HUD gear icon → **Settings**.
3. Press and **HOLD** the last row, "Version 1.0.1 (2)" (≈ 1.2 s — a
   plain tap does nothing).
4. The hidden **"Start at depth (dev)"** row appears.
5. Type the depth (20, 35, or 50).
6. Tap **Start**.
7. The sheet closes, the log shows "Floor N." with the dev banner ("A
   dev run. The graveyard has agreed to look the other way."), and the
   HUD shows a **DEV chip**. The hero is level 5 with a `300 × N` wilmst
   purse. This run is never buried and never counts as a best depth
   (D-13).

Each of the three runs below is a **fresh dev start** — die or abandon
the current run between them; don't try to chain all three off one dev
start.

### Run 1 — depth 20

**What to expect here:** `difficultyCurve(20)` → foe cap 4 (foeBonus +1
over the canon roll), foe power ≈1.21x, ability cadence ≈1.39x. The
AFTER readout's only populated caster band past floor 10 (11-20,
`--party` only, n=12) showed a 66.7% caster-encounter rate — expect
casters to show up more often than at floor 1-10 (2.5-2.6% there).

| Check | Tester's notes |
|---|---|
| Session-length feel — start/end clock, floors cleared, did 5–10 minutes feel right? | (to be filled by the tester) |
| One caster fight — which caster; bolt / drain / debuff legible? did the resist (or resist-failed) feel fair? | (to be filled by the tester) |
| One parley attempt + one parley failure — did the success line read right? did the failure's insulted aggro get noticed? | (to be filled by the tester) |
| Party affordability — a Joiner met/accepted? did feeding the party (rations/wp) bite? (no hire cost exists per D-20 — joining is free) | (to be filled by the tester) |
| Ended for a reason I understood — yes/no + the epitaph | (to be filled by the tester) |
| Free notes | (to be filled by the tester) |

### Run 2 — depth 35

**What to expect here:** `difficultyCurve(35)` → foe cap 5 (foeBonus
+2), foe power ≈1.35x, ability cadence ≈1.63x. No bot samples exist in
the 21-30/31-50 bands (0/0 in every readout) — there is no empirical
caster-encounter-rate signal at this depth; the dials are verified by
unit test only (`test/unit/combat-scaling.test.js`), not by bot play.

| Check | Tester's notes |
|---|---|
| Session-length feel — start/end clock, floors cleared, did 5–10 minutes feel right? | (to be filled by the tester) |
| One caster fight — which caster; bolt / drain / debuff legible? did the resist (or resist-failed) feel fair? | (to be filled by the tester) |
| One parley attempt + one parley failure — did the success line read right? did the failure's insulted aggro get noticed? | (to be filled by the tester) |
| Party affordability — a Joiner met/accepted? did feeding the party (rations/wp) bite? (no hire cost exists per D-20 — joining is free) | (to be filled by the tester) |
| Ended for a reason I understood — yes/no + the epitaph | (to be filled by the tester) |
| Free notes | (to be filled by the tester) |

### Run 3 — depth 50

**What to expect here:** `difficultyCurve(50)` → foe cap 5 (foeBonus
+2, already asymptoted), foe power ≈1.43x, ability cadence ≈1.78x —
both `foePower` and `abilityThreat` are approaching their `_MAX` values
(1.6 / 2.0) by this depth. Same caveat as Run 2: no bot samples past
floor 20, so this is the deepest, least bot-verified band — the DR
round's own judgment carries the most weight here.

| Check | Tester's notes |
|---|---|
| Session-length feel — start/end clock, floors cleared, did 5–10 minutes feel right? | (to be filled by the tester) |
| One caster fight — which caster; bolt / drain / debuff legible? did the resist (or resist-failed) feel fair? | (to be filled by the tester) |
| One parley attempt + one parley failure — did the success line read right? did the failure's insulted aggro get noticed? | (to be filled by the tester) |
| Party affordability — a Joiner met/accepted? did feeding the party (rations/wp) bite? (no hire cost exists per D-20 — joining is free) | (to be filled by the tester) |
| Ended for a reason I understood — yes/no + the epitaph | (to be filled by the tester) |
| Free notes | (to be filled by the tester) |

### Flag if noticed (observations, not tasks)

- Sterling's `halfDmg` time-to-kill (canon-mode TTK ≈10.23 rounds, the
  "two hearts" intent) feeling too tanky or too fast (18-06 deferred to
  Phase 21 — revisit only if flagged here, otherwise next milestone).
- The Djinni / Stalka Beast pre-ability wp discount (D-03) feeling
  under- or over-tuned in canon mode (18-06 deferred).
- Bolts feeling unfair without a one-round-ahead telegraph (19 deferred
  — only act on this if it actually feels unfair in play).
- Anything about summoned reinforcements (deliberately unscaled by
  design — 21-02's discretion).
- Any place the Oracle voice slipped out of family-friendly sarcasm.

### Verdict

**Overall verdict:** **tune-again** (user, 2026-09-14) — "Level 20, way overtuned. It's instant death on any combat." Run 1 (depth 20) was enough to call it; runs 2/3 not played. **Retune deferred by the user** to a later milestone, after upcoming cleanup and class fixes/updates land (those change player power, so tuning now would be tuned twice). The shipping constants stay as landed in 21-04 until then; the dev start-at-depth toggle remains the test harness for the next attempt. Concrete lead for that pass: the depth-20 band (foe cap 4, power ≈1.21×, cadence ≈1.39×) is already lethal for a level-5 hero with a 6,000-wilmst purse — start by pulling `FOE_POWER_MAX`/`ABILITY_THREAT_MAX` down and/or pushing `*_SOFT_K` out, and consider capping foes-per-encounter growth below 5.

**Per-run notes above complete:** (to be filled by the tester)
**Gate at hand-off:** npm test 951/951, parity 30/30, frozen files identical to 04eb229, build stamped 1.0.1 (2), APK: android/app/build/outputs/apk/debug/app-debug.apk (build succeeded, no wireless adb device reachable from this shell — install per "Getting the build on the device" above) — 2026-09-14.

### What happens next (D-16)

- **pass:** TUNE-04 closes the milestone's deferred UAT; the phase's
  VERIFICATION flips from `human_needed` to `passed` on the user's
  word. Per the standing rule (STATE.md, 2026-09-13), the assistant
  then **ASKS** whether to push a versionCode-bumped signed AAB to the
  Play internal-testing track (`npm run play:release`, see
  `docs/RELEASING.md`) — it never pushes unasked.
- **tune-again:** ONE `/gsd-quick` pass editing only
  `engine/difficulty.js` constants (plus a `### Addendum` appended
  under the Change table above, with before/after values and a
  rationale), then a second DR round using this same checklist. No
  re-plan.

## v1.2 retune (Phase 27) — TUNE-05..07

The deferred TUNE-04 retune lands on the corrected player power from Phases
23–25.1 (Phase 26 handoff: mu 3.08, rank order Thief 3.51 > Fighter 3.16 >
Magic User 2.55, 0 cannot-act, depth-20 forced start survives 1.3
encounters / gains 0.14 floors). This section records the target band
(TUNE-05) BEFORE any constant or bestiary change lands, so 27-02/27-03 tune
against a fixed, committed target rather than a moving one.

### Why again — the v1.1 verdict, verbatim

**Verdict (user, 2026-09-14):** "Level 20, way overtuned. It's instant death on any combat." Run 1 (depth 20) was enough to call it; runs 2/3 not played. Retune deferred until player power moved (Phases 23–25.1); it has now moved (Phase 26 handoff above).

**D-16 lead (carried forward from the v1.1 ledger's "What happens next"):** "the depth-20 band (foe cap 4, power ≈1.21×, cadence ≈1.39×) is already lethal for a level-5 hero with a 6,000-wilmst purse — start by pulling `FOE_POWER_MAX`/`ABILITY_THREAT_MAX` down and/or pushing `*_SOFT_K` out, and consider capping foes-per-encounter growth below 5."

**Acceptance bar at 20, in the user's own words:** a level-5 hero at depth
20 should get 3–5 fights, not one.

### Standing rules (user, 2026-09-14 / 2026-09-15)

- Depth 20 is THE tuning target, not infinite depth.
- Reaching 20 is a unicorn run — rare, celebrated, not expected.
- Past 20, nothing is dialed back and no mechanic forces death — the run
  wraps up naturally on the existing curve.
- "Competent player" cannot be quantified in a game this RNG-heavy, so the
  bot proxy sets rarity floors and the human DR round (TUNE-07) is the real
  verdict — never the proxy alone.
- Keep the opening honest: floor 1 still kills careless level-1 characters
  (traps, starvation, a bad fight). The change this phase makes is that ONE
  canon foe no longer does it three times a round.
- The tail matters more than the middle: 1–2 % reach 20 means the curve
  keeps steepening past ~10 while the median sits at 5–6.

### Target band (TUNE-05) — supersedes D-09

| Measure | Phase 26 AFTER (pin d1e3235) | Target | How measured | Edge rule |
|---|---|---|---|---|
| Natural median death depth | 3 (class p50 Thief 3 / Fighter 3 / Magic User 2; pooled mean 3.08) | **Bot: median 4, pooled reach >= 5 at >= 25 %** — the measured ceiling of the sanctioned levers (planner calibration 2026-09-15: every rung of the widened ladder, floor-1 grace included, tops out at bot median 4 / reach >= 5 ≈ 35 %; what remains at floors 2-4 is canon tier-2/3 combat, starvation and falls, which the bot plays badly). **Human expectation: median 5-6**, judged by the DR round (TUNE-07), not the bot proxy. (User decision 2026-09-15, third round: "Bot median 4, human 5-6" — this supersedes this row's original "5-6" bot target from the plan; the context's amendment wins.) | `rollups.pooled.p50Depth` (bot median) and `rollups.pooled.reach5` (>= 25 % threshold) of `docs/class-pass/retune-after.json` — `tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000` (143 x 40, seeds `i*7919+1`, Bot line identical to Phase 26); the human median 5-6 is read from the TUNE-07 DR checklist, never from this JSON | bot median: pass at exactly 4 (a measured ceiling, not a range); reach >= 5: closed, >= 25 % passes, 1 dp; human median 5-6 is a DR-round qualitative judgment, not a numeric pass/fail edge |
| Reach >= 10 (pooled) | 0.3 % | ≈ 10-20 % | `rollups.pooled.reach10` | ADVISORY corridor, consistency-derived from the two user pins on either side — never pass/fail |
| Reach >= 20 (pooled, bot) | n/a in the Phase 26 JSON (0.0 % in every v1.1 200-seed readout) | **1.0-2.0 %** (the unicorn; the bot's number is a rarity floor — humans play better) | `rollups.pooled.reach20` (added by this plan) | closed: 1.0 and 2.0 pass; 1 dp |
| Forced start at 20, level-5 hero: encounters survived | 1.32 (pooled mean; Thief 1.72 / Fighter 1.17 / Magic User 1.07) | **3.0-5.0** ("dangerous, not hopeless") | `rollups.pooled.meanEncountersSurvived` of `docs/class-pass/retune-after-depth20.json` — `tools/tune-classes.mjs --seeds 10 --workers 4 --max-actions 5000 --start-depth 20` (143 x 10) | closed; 2 dp |
| Forced start at 20: floors gained | mean 0.14, p50 0 | **p50 >= 1 AND mean 1.0-2.0** | `rollups.pooled.p50FloorsGained` / `rollups.pooled.meanFloorsGained` (same file) | both conditions; closed; p50 integer, mean 2 dp |
| Past 20 (forced 35 / 50) | — | descriptive only: floors gained (= death depth − start) and causes are REPORTED; no target, no dial-back, no forced death | `node tools/tune-difficulty.mjs --seeds=200 --start-depth=35` and `--start-depth=50` death-depth distribution + cause table | none (reported) |
| Cannot-act cells | 0 of 143 | **0** (hard gate) | `node tools/class-pass-diff.mjs --gate --after docs/class-pass/retune-after.json` exits 0 | evaluated FIRST; a failing gate stops the retune before the band is read |

(a) **Precision:** numbers are compared at the precision the harness prints
— means 2 dp, reach 1 dp, p50 integer; no hidden rounding.

(b) **Pooling:** every pooled number is run-weighted — `summarizeRows` over
the concatenation of all 143 cells' rows (`rollups.pooled`, added by
27-01); a cell with zero completed runs contributes nothing, never NaN; the
cannot-act gate runs before the band is evaluated.

(c) **Superseding:** the Phase 21 D-09 targets above (median death depth
8-15, p90 >= 25, < 2 % of runs past floor 50, median 40-80 actions per
floor) are SUPERSEDED by this table as of 2026-09-15 — they were set for an
infinite-depth curve the user has since rejected; only this band is
evaluated from here on.

(d) **Cheap smoke proxy note:** during iterations `node
tools/tune-difficulty.mjs --seeds=200` (natural) and `tools/tune-classes.mjs
--seeds 3` slices are directional readouts only; the band is judged on the
full AFTER.

**Note on this row's provenance:** 27-CONTEXT.md was amended AFTER this
plan was written (commit `4d18e80`) to replace the natural median death
depth row's original "5-6" bot target with the two-part reading above (bot
median 4 / reach >= 5 >= 25 %, human 5-6 judged by the DR round). This
ledger records the amended band, not the plan's original text — see this
plan's SUMMARY for the substitution note.

### Bot proxy and parameters (identical to Phase 26)

The harness is `tools/tune-classes.mjs` on `tools/lib/tuning-bot.mjs`
(Phase 22, byte-identical to pin `5565b22` — no bot policy changes this
phase). The two Phase 26 Bot lines, quoted verbatim from
`docs/class-pass/after.json` / `after-depth20.json`'s `meta.bot`:

```
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=40  workers=4  startDepth=1
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=10  workers=4  startDepth=20
```

27-03's AFTER JSONs must carry these strings byte-for-byte (`metaParity`
modulo commit). This plan's only harness change is the additive pooled
readout (`reach20`, `rollups.pooled`, the `POOLED` text block), which
changes no run, no draw and no Bot line.

### BEFORE — by reference (not re-run)

BEFORE for this retune IS the Phase 26 AFTER: `docs/class-pass/after.json`
and `after-depth20.json` (meta.commit `d1e3235`), their verbatim
transcripts under `## AFTER — commit d1e3235...` in `docs/CLASS-PASS.md`,
and the `## Handoff to Phase 27` yardstick (mu 3.08; Thief 3.51 > Fighter
3.16 > Magic User 2.55; reach >= 5 17.2 / >= 10 0.3; depth-20 floors gained
0.25 / 0.10 / 0.07, encounters survived 1.72 / 1.17 / 1.07 by class;
cannot-act 0). Top death causes at scale (from the Phase 26 AFTER cells'
topCauses — quoted from the Phase 26 handoff/CONTEXT figures): "cut down by
a Dante" 724 tallies, "undone by a trap" 333, "starved in the dark" 300.

### Levers and the Dante decision (TUNE-06)

Three levers, in escalation order:

1. **Global depth dials in `engine/difficulty.js` — the whole curve.**
   Combat knobs (`COMBAT_SCALE_FROM_DEPTH` may only move UP, never below 6;
   `FOE_CAP_MAX`/`_SOFT_K`, `FOE_POWER_MAX`/`_SOFT_K`,
   `ABILITY_THREAT_MAX`/`_SOFT_K`) for the ramp toward 20, identity through
   at least depth 5. Non-combat knobs (`ENCOUNTER_DOT_*`, `DARK_BLOB_CAP`,
   `DARK_RADIUS_*`) may ease depths 3-5 — NOT depth 2: the movement parity
   fixture (seed 256) descends to floor 2 and compares that floor
   byte-for-byte, so floors 1-2 are canon by construction (a
   `DENSITY_CANON_THROUGH_DEPTH = 2` gate, landed in 27-02).

2. **The Dante demotion (a deliberate canon deviation).** See the decision
   rule below.

3. **The WIDENED early-floor levers (user decision 2026-09-15, CONTEXT
   Levers §3 — after the planner's calibration showed dials + Dante alone
   leave the bot median at 3: kill table 20 % dead on floor 1, 66 % by
   floor 3, 85 % by floor 4)**, as further deliberate canon deviations,
   each behind its own draw-free `difficultyCurve` field and each with a
   declared divergence record where it touches a fixture:
   - **Foe grace at floors 2-4** (`foePower` < 1 only at depths 2-4; floor
     1 exactly 1.0).
   - **A trap/wall-fall damage ramp** (a new `hazardScale` field consumed
     by `movement.js` and `encounters.js`; starts at floor 2 unless the
     median still misses — a floor-1 start diverges the encounters trap
     scenario, seed 1, and is declared).
   - **Starvation relief** (darkness later — the parity-clean form holds
     one blob through floor 3; the from-floor-4 form diverges the movement
     fixture, seed 256, and is declared — then starting rations +1/+2 only
     if the median still misses, 14 chargen records).
   - **Floor-1 foe grace as LAST RESORT only** (orchestrator decision),
     after everything else has been tried and measured.
   - **Escalation order** (smallest set that reaches median >= 5): Dante →
     foe grace 2-4 → darkness later → trap/fall ramp → rations → floor-1
     grace, one rung per iteration, each measured with the smoke and
     recorded with a `DELIBERATE RULES CHANGE (Phase 27, 2026-09-15,
     TUNE-06)` comment, a change-table row and its divergence record.
   - **Ladder cap (user decision 2026-09-15, third round):** land the
     PARITY-CLEAN set only — Dante Form C, foe grace at floors 2-4 (up to
     x0.5 permitted, floor 1 exactly 1.0), darkness HELD through floor 3
     (not the from-floor-4 form, which diverges movement seed 256),
     trap/fall hazard ramp FROM FLOOR 2 (floor 1 canon). The rations rung,
     the hazard-from-floor-1 rung, the darkness-from-4 rung and the
     floor-1 grace rung are NOT climbed — recorded here as "available, not
     taken" with the calibration numbers below, so the fidelity contract
     keeps exactly one declared divergence (seed 303).

4. **Nothing else.** No class change, no upkeep/economy dial unless a v1.1
   counterweight trigger fires (economy: tune-economy `peakGold p50 >
   5000`; party: `--party` p50 > 1.5 x solo p50 — both are MEASURED in the
   AFTER and recorded; if one fires it is reported to the orchestrator as a
   follow-up, not implemented inside the constants-only pass), no change to
   `engine/character.js`, spells or items.

**Dante — the decision rule (recorded before the change):** Dante is the
only tier-1 Humans entry (sz H, i 12, wp 20, `sp.atk 3` — three strikes a
round) and the #1 killer; the demotion form is chosen by ONE measurable
rule — an attack-only level-1 hero on floor 1 forced into a Humans
encounter (2,000 seeds, `newRun(seed)` → `startCombat(state, false,
"Humans", rng)` → `playerStrike` until resolved) must die no more often
than against the next-deadliest tier-1 type (Demons, ≈ 25 %) — with the
planner's calibration table (2026-09-15, same sim): canon wp 20 / atk 3 →
hero dies 59.8 % (two-Dante fights are 51 % of Humans encounters and are
won 16.7 %); Form A `sp.atk` 3 → 2 → 51.4 %; Form B wp 20 → 12 → 46.8 % (wp
10 → 42.8 %); A+B (atk 2, wp 12) → 37.4 %; Form C — Dante moved to tier 2
with stats and note byte-identical, and a plain new tier-1 Humans entry (wp
8, one swing a round) → 14.3 % (Beasts 6.8 / Lair Beasts 13.2 / Magical
13.3 / Walking Dead 15.6 / Demons 25.1), while depth-2 Humans fights for a
level-2 hero move 40.8 % → 42.2 % (Dante fits tier 2 without opening a new
spike). Only Form C satisfies the rule; it is the planner's recommendation
and 27-02's default; 27-02 records the landed numbers under `### Dante
demotion — landed (27-02)`.

### Iteration protocol (TUNE-06)

Cap of FOUR constant iterations after iteration 0 (27-02: Dante +
non-combat easing, combat untouched); each iteration = change constants →
update the test pins → `node --test test/difficulty test/unit/combat-scaling.test.js
test/unit/maze.test.js` → smoke (background + `EXIT=` sentinel, bounded
polling): `tools/tune-classes.mjs --seeds 3 --workers 4 --max-actions 5000
--json --out <scratch>/iterN-nat.json` (pooled p50 / reach10 / reach20 /
causes) and `--start-depth 20 --seeds 3 ... --out <scratch>/iterN-d20.json`
(pooled encounters survived / floors gained), plus `tools/tune-difficulty.mjs
--seeds=200` for the cause table → read against the band → log entry
(constants; readout numbers; what moved; what to turn next, one rationale
sentence per knob) → stop when the smoke lands inside the band or at
iteration 4, then the FULL AFTER on a proven pin. Missed measures after the
cap are RECORDED with the executor's one-line reading and handed to the DR
round — never chased with a fifth iteration.

**Planner's calibration note (directional, 143 x 3 + 200-seed natural,
2026-09-15):** at full combat identity the level-5 bot at depth 20 survives
≈ 3.0 encounters and gains ≈ 0.4 floors (p50 0) — identity is the ceiling
of what the deep combat dials can do; fewer deep encounter dots and less
darkness lift floors gained toward ≈ 1 (dots 12, blobs 3, radius 7 → ≈ 0.97
floors, ≈ 3.1 encounters). For the median: with dials + Dante alone the bot
median stayed 3 (pooled reach >= 5 ≈ 17 %); the widened early-floor levers
each add ≈ 3-7 points of reach >= 5 (foe grace 0.75 at 2-4: 22.8 %;
darkness from 4: 21.7 %; trap/fall ramp 0.5: 24.0 %; grace 0.5 + darkness
hold + ramp from floor 2: 24.7 %; + rations +2: 30.8 %; + darkness from 4 +
ramp from floor 1: 35.4 %; + floor-1 grace 0.85: 34.7 %) — the full ladder
tops out near 35 % (bot median 4, mean ≈ 4.0), so the median row is
expected to be recorded as a miss (or a near-miss, per the amended target
band above) with the ladder's ceiling stated unless the executor's smoke
says otherwise. The parity-clean set (grace 0.5 + darkness hold + ramp from
floor 2, WITHOUT rations/darkness-from-4/floor-1-grace) measures ≈ 24.7 %
reach >= 5 — just under the amended 25 % target, and is the set actually
landed per the ladder cap decision above. The escalation order and the
"turn a rung only where a gain is predicted" rule live in 27-03. A median
miss after the cap is a recorded outcome, not a reason for a fifth
iteration.

### Dante demotion — landed (27-02)

(filled by plan 27-02)

### Change table (27-02 / 27-03)

(filled by plan 27-03)

### Iteration log

(filled by plans 27-02 and 27-03)

### AFTER readouts — retuned engine

(filled by plan 27-03)

### Comparison vs band

(filled by plan 27-03)

### Counterweight triggers (measured)

(filled by plan 27-03)

### Not changed, and why

(filled by plan 27-03)

### DR checklist — TUNE-07

(filled by plan 27-04)

### Verdict (TUNE-07)

**Overall verdict:** (to be filled by the tester — tuned / tune-again / deferred)
