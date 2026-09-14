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

## DR checklist — TUNE-04 sign-off (21-05)

*Filled by plan 21-05.*
