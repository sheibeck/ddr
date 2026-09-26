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

**Per-run notes above complete:** not played — the user was away from the Pixel 7 at hand-off (device unreachable over wireless adb); the four runs stay in this checklist for the next tuning pass, to be played on whichever build carries it.
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

## v1.7 tuning pass (Phases 51–54) — per-phase bot readouts

This H2 is the v1.7 measurement-gate ledger — every rule-changing phase of
the tuning pass records BEFORE and AFTER under identical parameters here,
so Phase 54's four-band retune inherits a known baseline rather than a
moving one. It sits above the v1.2 section because
`test/unit/difficulty-retune-ledger.test.js` pins `## v1.2 retune (Phase
27)` as the ledger's last H2 (sections below it are older); this section,
and every later Phase 51–54 subsection appended to it, stays above that
pin.

### v1.7 · Phase 51 — initiative once

**Rule change:** initiative is now rolled once per fight in `fight()`
(`C.first` holds for the whole encounter) instead of being re-rolled every
round in `afterPlayerAction`. The per-round re-roll and its pre-emptive foe
turn are deleted from `afterPlayerAction`, so a foe never takes two turns
back to back — per-round order is a strict alternation seeded by the single
roll. This is INIT-01/INIT-02, a deliberate canon p.24 divergence under the
greenfield ruling (2026-09-17): measured first, declared per moved fixture,
only those fixtures regenerated.

**Parameters (identical BEFORE/AFTER):**
- `node tools/tune-difficulty.mjs --seeds=200` (solo)
- `node tools/tune-difficulty.mjs --seeds=200 --party`
- `node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p51-before-smoke.json` (BEFORE) / `v17-p51-after-smoke.json` (AFTER)

#### BEFORE — commit d5d8c10f64bc9dca33605d82350a93f5083bded3 (phase start, no engine edit)

`node tools/tune-difficulty.mjs --seeds=200` (solo):

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=5  max=7

Action-count distribution:
  min=36  p50=354  p90=593  max=771

Death-cause breakdown:
  starved in the dark  20 (10.0%)
  cut down by a Werebeast 18 (9.0%)
  cut down by a Poltergeist 16 (8.0%)
  fell off a wall      14 (7.0%)
  undone by a trap     12 (6.0%)
  cut down by a Dante  12 (6.0%)
  spent by the dungeon itself 10 (5.0%)
  cut down by a Gremlin 10 (5.0%)
  cut down by a Trachea 7 (3.5%)
  cut down by a Philly 5 (2.5%)
  cut down by a Rinkle 5 (2.5%)
  cut down by a Blumble 4 (2.0%)
  cut down by a Ned    4 (2.0%)
  cut down by a Pogo   4 (2.0%)
  came up short on a leap 4 (2.0%)
  cut down by a Cave Bear 4 (2.0%)
  cut down by a China Wolf 4 (2.0%)
  cut down by a Zit    3 (1.5%)
  cut down by a Ghoul  3 (1.5%)
  cut down by a Sterling 3 (1.5%)
  cut down by a Herman 3 (1.5%)
  cut down by a Zombie 2 (1.0%)
  cut down by a M&M    2 (1.0%)
  cut down by a Drarl  2 (1.0%)
  cut down by a Bones  2 (1.0%)
  cut down by a Floater 2 (1.0%)
  cut down by a Frank  2 (1.0%)
  cut down by a Djinni 2 (1.0%)
  cut down by a Primp  2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Hair   2 (1.0%)
  cut down by a Google 2 (1.0%)
  cut down by a Drekk  2 (1.0%)
  cut down by a Ghost  1 (0.5%)
  cut down by a Undead 1 (0.5%)
  cut down by a Drat   1 (0.5%)
  cut down by a Wolf   1 (0.5%)
  cut down by a Flube  1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Stink Bug 1 (0.5%)
  cut down by a Spectre 1 (0.5%)
  cut down by a Skeleton 1 (0.5%)
  cut down by a Vampire 1 (0.5%)
  cut down by a Krupke 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=267  successes=167 (62.5%)  failures=100  refused=0  exhausted=0
  runs with >=1 attempt: 62 of 200
  SP from parley: 2254 of 96252 total SP (2.3%)

Reach table (% of runs reaching floor N):
  >=5: 21.0%  >=10: 0.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=36  p50=104  p90=134  max=175

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 50/1708 (2.9%)
  6-10: 7/41 (17.1%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=113  foeBolted=32  foeDrained=1  foeDebuffed=11  foeHealed=0  foeSummoned=0
  heroResisted=58  heroResistFailed=18
  ability damage: 211 of 16431 total damage taken (1.3%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 200 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

`node tools/tune-difficulty.mjs --seeds=200 --party`:

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=6  max=14

Action-count distribution:
  min=21  p50=535  p90=20000  max=20000

Death-cause breakdown:
  starved in the dark  23 (11.5%)
  fell off a wall      16 (8.0%)
  cut down by a Werebeast 14 (7.0%)
  undone by a trap     8 (4.0%)
  cut down by a Poltergeist 7 (3.5%)
  cut down by a Dante  6 (3.0%)
  cut down by a Shadow 6 (3.0%)
  spent by the dungeon itself 5 (2.5%)
  cut down by a Herman 5 (2.5%)
  cut down by a Blumble 5 (2.5%)
  cut down by a Drarl  5 (2.5%)
  cut down by a Rinkle 4 (2.0%)
  came up short on a leap 4 (2.0%)
  cut down by a Flube  3 (1.5%)
  cut down by a Rast   3 (1.5%)
  cut down by a Zombie 3 (1.5%)
  cut down by a Skeleton 2 (1.0%)
  cut down by a Djinni 2 (1.0%)
  cut down by a Trachea 2 (1.0%)
  cut down by a Frank  2 (1.0%)
  cut down by a Sterling 2 (1.0%)
  cut down by a Primp  2 (1.0%)
  cut down by a Wolf   2 (1.0%)
  cut down by a Gremlin 2 (1.0%)
  cut down by a Zit    2 (1.0%)
  cut down by a Dread Lock 1 (0.5%)
  cut down by a Ghoul  1 (0.5%)
  cut down by a Spectre 1 (0.5%)
  cut down by a Drekk  1 (0.5%)
  eaten by their own summoning 1 (0.5%)
  cut down by a Drake  1 (0.5%)
  cut down by a Google 1 (0.5%)
  cut down by a Stalka Beast 1 (0.5%)
  cut down by a Cave Bear 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=324  successes=203 (62.7%)  failures=121  refused=0  exhausted=0
  runs with >=1 attempt: 73 of 200
  SP from parley: 3062 of 111983 total SP (2.7%)

Reach table (% of runs reaching floor N):
  >=5: 41.0%  >=10: 2.8%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=21  p50=103  p90=134  max=166

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 51/1931 (2.6%)
  6-10: 32/109 (29.4%)
  11-20: 9/12 (75.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=152  foeBolted=81  foeDrained=1  foeDebuffed=18  foeHealed=1  foeSummoned=0
  heroResisted=45  heroResistFailed=11
  ability damage: 181 of 8523 total damage taken (2.1%)

Party (--party, D-12/D-20):
  member forced at run start in 192/200 runs; member alive at run end: 155 (77.5%)

Stuck: 56 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 144 dead, 56 stuck (hit maxActions=20000; excluded from depth stats)
```

`node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p51-before-smoke.json` (stdout — the ranked matrix; stderr's elapsed line `elapsed: 90.6s  workers=4  runs=715` is not quoted, per this ledger's own convention):

```
tune-classes: 143 cells x 5 seeds (715 runs) — start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
1  Thief  Ninja  Human  5  0  6.20  6.0  10.0  80.0  20.0  15.40  3.80  649.20  cut down by a Craig(1),cut down by a Ghost(1),cut down by a Google(1)
2  Thief  Pilfer  Wilmsry  5  0  6.20  5.0  11.0  100.0  20.0  8.80  3.40  644.80  cut down by a Primp(2),cut down by a Frank(1),cut down by a Sterling(1)
3  Thief  Cloaker  Wilmsry  5  0  6.00  6.0  9.0  80.0  0.0  6.00  3.20  605.20  cut down by a Werebeast(2),cut down by a Cave Bear(1),cut down by a Primp(1)
4  Thief  Ninja  Wilmsry  5  0  6.00  6.0  8.0  80.0  0.0  15.40  3.60  585.00  cut down by a Drarl(1),cut down by a Ghost(1),cut down by a Werebeast(1)
5  Thief  Acrobat  Wilmsry  5  0  5.40  6.0  8.0  60.0  0.0  4.00  3.00  498.60  cut down by a Blumble(1),cut down by a Drat(1),cut down by a Gremlin(1)
6  Magic User  Warlock  Wilmsry  5  0  5.40  6.0  7.0  60.0  0.0  8.60  3.00  714.20  cut down by a Drarl(1),cut down by a Google(1),cut down by a Herman(1)
7  Fighter  Barbarian  Wilmsry  5  0  5.40  5.0  8.0  80.0  0.0  6.60  3.00  555.60  cut down by a Drarl(1),cut down by a Frank(1),cut down by a Poltergeist(1)
8  Thief  Ninja  Dwarven  5  0  5.40  5.0  8.0  80.0  0.0  14.60  3.80  545.20  cut down by a Drake(1),cut down by a Dread Lock(1),fell off a wall(1)
9  Fighter  Knight  Wilmsry  5  0  5.20  5.0  7.0  80.0  0.0  4.20  3.00  497.60  cut down by a Werebeast(4),cut down by a Poltergeist(1)
10  Thief  Con Artist  Wilmsry  5  0  5.00  5.0  6.0  80.0  0.0  2.80  2.80  469.80  cut down by a Blumble(1),cut down by a Shadow(1),cut down by a Werebeast(1)
11  Thief  Pickpocket  Wilmsry  5  0  5.00  5.0  8.0  60.0  0.0  5.40  3.20  504.40  cut down by a Herman(1),cut down by a Poltergeist(1),cut down by a Stalka Beast(1)
12  Fighter  Woodsman  Wilmsry  5  0  5.00  4.0  8.0  40.0  0.0  7.40  3.00  532.20  cut down by a Dread Lock(1),cut down by a Krupke(1),cut down by a Werebeast(1)
13  Fighter  Knight  Human  5  0  4.60  5.0  5.0  80.0  0.0  7.60  3.00  483.20  cut down by a Drarl(1),cut down by a Krupke(1),cut down by a Poltergeist(1)
14  Fighter  Bard  Wilmsry  5  0  4.60  5.0  6.0  60.0  0.0  5.60  2.80  493.40  cut down by a Werebeast(2),cut down by a Ghoul(1),cut down by a Poltergeist(1)
15  Thief  Con Artist  Troll  5  0  4.60  5.0  6.0  60.0  0.0  4.40  2.80  462.00  cut down by a Shadow(2),cut down by a Drarl(1),cut down by a Poltergeist(1)
16  Magic User  Summoner  Wilmsry  5  0  4.60  4.0  6.0  40.0  0.0  4.40  2.40  506.00  fell off a wall(2),came up short on a leap(1),cut down by a Blumble(1)
17  Thief  Acrobat  Elven  5  0  4.40  5.0  6.0  60.0  0.0  12.00  3.20  464.20  cut down by a Blumble(1),cut down by a Djinni(1),cut down by a Drarl(1)
18  Fighter  Knight  Fridgian  5  0  4.40  5.0  5.0  60.0  0.0  4.60  2.80  420.40  cut down by a Blumble(1),cut down by a Dante(1),cut down by a Poltergeist(1)
19  Fighter  Master of Arms  Wilmsry  5  0  4.40  5.0  6.0  60.0  0.0  13.60  2.60  556.00  cut down by a Dante(1),cut down by a Frank(1),cut down by a Ghoul(1)
20  Thief  Acrobat  Troll  5  0  4.40  4.0  6.0  40.0  0.0  11.60  3.00  406.00  fell off a wall(2),cut down by a Craig(1),starved in the dark(1)
21  Thief  Cat Burglar  Troll  5  0  4.40  4.0  6.0  40.0  0.0  10.60  3.00  425.60  cut down by a Drarl(1),cut down by a Zit(1),spent by the dungeon itself(1)
22  Magic User  Wizard  Troll  5  0  4.20  5.0  5.0  60.0  0.0  10.80  3.00  484.20  came up short on a leap(1),cut down by a Bones(1),cut down by a Drarl(1)
23  Thief  Con Artist  Human  5  0  4.20  4.0  5.0  40.0  0.0  2.40  2.60  461.00  cut down by a Blumble(1),cut down by a Krupke(1),cut down by a Poltergeist(1)
24  Fighter  Guard  Wilmsry  5  0  4.20  4.0  5.0  40.0  0.0  5.60  2.60  467.40  cut down by a Werebeast(3),cut down by a Google(1),cut down by a Poltergeist(1)
25  Thief  Ninja  Troll  5  0  4.00  4.0  5.0  40.0  0.0  12.00  2.80  450.00  cut down by a Dante(1),cut down by a Primp(1),fell off a wall(1)
26  Magic User  Sorcerer  Troll  5  0  4.00  4.0  6.0  40.0  0.0  8.80  2.60  407.60  starved in the dark(2),cut down by a Shriek(1),cut down by a Spectre(1)
27  Magic User  Warlock  Troll  5  0  4.00  4.0  6.0  40.0  0.0  14.00  3.40  446.00  cut down by a Drake(2),cut down by a Herman(1),cut down by a Poltergeist(1)
28  Fighter  Barbarian  Dwarven  5  0  4.00  4.0  6.0  20.0  0.0  11.40  2.20  463.80  cut down by a Bat/Rat(1),cut down by a Blumble(1),cut down by a Dante(1)
29  Thief  Cutthroat  Wilmsry  5  0  4.00  4.0  6.0  20.0  0.0  4.20  2.20  424.80  cut down by a Poltergeist(2),cut down by a China Wolf(1),fell off a wall(1)
30  Fighter  Samurai  Troll  5  0  4.00  4.0  5.0  20.0  0.0  9.80  2.40  392.20  cut down by a Skeleton(2),cut down by a Undead(1),fell off a wall(1)
31  Fighter  Soldier  Human  5  0  4.00  4.0  6.0  20.0  0.0  8.20  2.60  390.80  cut down by a Rinkle(2),cut down by a China Wolf(1),cut down by a Poltergeist(1)
32  Thief  Con Artist  Fridgian  5  0  4.00  4.0  4.0  0.0  0.0  3.80  2.00  424.20  undone by a trap(2),cut down by a Cave Bear(1),cut down by a Hobgoblin(1)
33  Magic User  Sorcerer  Wilmsry  5  0  4.00  4.0  4.0  0.0  0.0  6.80  2.40  504.00  fell off a wall(2),starved in the dark(2),cut down by a Poltergeist(1)
34  Magic User  Warlock  Fridgian  5  0  3.80  5.0  5.0  60.0  0.0  12.20  2.80  488.80  cut down by a Primp(2),cut down by a Drarl(1),cut down by a Zombie(1)
35  Thief  Acrobat  Fridgian  5  0  3.80  4.0  6.0  40.0  0.0  7.80  2.60  427.60  cut down by a Gremlin(1),cut down by a Rinkle(1),cut down by a Werebeast(1)
36  Magic User  Warlock  Human  5  0  3.80  4.0  5.0  40.0  0.0  12.00  2.80  469.40  cut down by a Gremlin(1),cut down by a Primp(1),cut down by a Rinkle(1)
37  Fighter  Barbarian  Troll  5  0  3.80  4.0  5.0  20.0  0.0  8.60  2.20  371.00  cut down by a Trachea(2),starved in the dark(2),cut down by a Poltergeist(1)
38  Magic User  Court Mage  Dwarven  5  0  3.80  4.0  5.0  20.0  0.0  11.00  2.80  355.60  cut down by a Poltergeist(2),cut down by a Craig(1),cut down by a Google(1)
39  Magic User  Court Mage  Troll  5  0  3.80  4.0  5.0  20.0  0.0  12.20  2.80  411.40  cut down by a Dante(1),cut down by a Drudge(1),cut down by a Flube(1)
40  Fighter  Knight  Troll  5  0  3.80  4.0  5.0  20.0  0.0  4.00  2.40  377.00  cut down by a Hair(1),cut down by a Poltergeist(1),cut down by a Werebeast(1)
41  Fighter  Soldier  Wilmsry  5  0  3.80  4.0  5.0  20.0  0.0  5.20  2.60  407.60  cut down by a Cave Bear(1),cut down by a Ghoul(1),cut down by a Skeleton(1)
42  Thief  Pickpocket  Troll  5  0  3.80  4.0  4.0  0.0  0.0  12.40  2.80  388.40  starved in the dark(2),cut down by a Blumble(1),cut down by a Trachea(1)
43  Magic User  Illusionist  Troll  5  0  3.80  3.0  7.0  20.0  0.0  8.20  2.40  457.20  cut down by a Djinni(1),cut down by a Krupke(1),cut down by a Poltergeist(1)
44  Thief  Pickpocket  Human  5  0  3.80  3.0  7.0  20.0  0.0  10.60  2.60  407.60  cut down by a Dread Lock(1),cut down by a Flube(1),cut down by a Google(1)
45  Fighter  Woodsman  Fridgian  5  0  3.80  3.0  6.0  20.0  0.0  7.00  2.40  357.60  cut down by a Dante(1),cut down by a Frank(1),cut down by a Poltergeist(1)
46  Thief  Cat Burglar  Dwarven  5  0  3.60  4.0  5.0  40.0  0.0  7.20  2.00  355.00  fell off a wall(2),cut down by a China Wolf(1),cut down by a Gremlin(1)
47  Fighter  Barbarian  Human  5  0  3.60  4.0  5.0  20.0  0.0  7.80  2.20  347.40  cut down by a Cave Bear(1),cut down by a Drat(1),cut down by a Google(1)
48  Fighter  Guard  Troll  5  0  3.60  4.0  5.0  20.0  0.0  6.60  2.20  352.60  starved in the dark(3),cut down by a Blumble(1),cut down by a Primp(1)
49  Thief  Pickpocket  Dwarven  5  0  3.60  4.0  6.0  20.0  0.0  8.00  2.20  352.80  cut down by a Philly(2),cut down by a Blumble(1),cut down by a Cave Bear(1)
50  Fighter  Soldier  Troll  5  0  3.60  4.0  5.0  20.0  0.0  8.00  2.40  358.80  came up short on a leap(1),cut down by a Frank(1),cut down by a Philly(1)
51  Magic User  Wizard  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  5.20  2.00  369.80  cut down by a Hobgoblin(1),cut down by a Krupke(1),cut down by a Primp(1)
52  Fighter  Master of Arms  Fridgian  5  0  3.60  4.0  4.0  0.0  0.0  8.40  2.40  348.60  cut down by a Flube(1),cut down by a Google(1),cut down by a Gremlin(1)
53  Fighter  Soldier  Fridgian  5  0  3.60  4.0  4.0  0.0  0.0  7.80  2.40  381.00  cut down by a Frank(1),cut down by a Google(1),cut down by a Poltergeist(1)
54  Thief  Pilfer  Dwarven  5  0  3.60  3.0  6.0  40.0  0.0  6.60  2.20  371.60  cut down by a Hobgoblin(1),cut down by a Undead(1),cut down by a Werebeast(1)
55  Fighter  Guard  Fridgian  5  0  3.60  3.0  5.0  20.0  0.0  9.20  2.40  371.40  cut down by a China Wolf(2),cut down by a Poltergeist(1),cut down by a Rast(1)
56  Thief  Ninja  Fridgian  5  0  3.60  3.0  5.0  20.0  0.0  10.00  2.80  420.60  cut down by a Frank(2),cut down by a China Wolf(1),cut down by a Rast(1)
57  Thief  Cat Burglar  Wilmsry  5  0  3.40  4.0  5.0  40.0  0.0  1.80  2.20  287.40  undone by a trap(2),cut down by a Blumble(1),cut down by a Rinkle(1)
58  Magic User  Cleric  Wilmsry  5  0  3.40  4.0  5.0  40.0  0.0  4.60  2.00  342.60  cut down by a Zit(2),cut down by a Gremlin(1),fell off a wall(1)
59  Thief  Acrobat  Dwarven  5  0  3.40  4.0  5.0  20.0  0.0  8.60  2.60  324.00  cut down by a Drarl(1),cut down by a Poltergeist(1),cut down by a Shadow(1)
60  Magic User  Court Mage  Fridgian  5  0  3.40  4.0  5.0  20.0  0.0  10.40  2.40  345.60  cut down by a Gremlin(1),cut down by a Hair(1),cut down by a Primp(1)
61  Magic User  Cleric  Troll  5  0  3.40  4.0  4.0  0.0  0.0  7.20  2.20  359.20  came up short on a leap(1),cut down by a Blumble(1),cut down by a Poltergeist(1)
62  Magic User  Sorcerer  Human  5  0  3.40  4.0  4.0  0.0  0.0  9.80  2.40  341.40  cut down by a Blumble(1),cut down by a China Wolf(1),cut down by a Dante(1)
63  Magic User  Apprentice  Fridgian  5  0  3.40  3.0  5.0  20.0  0.0  5.60  2.40  340.00  cut down by a Blumble(1),cut down by a Philly(1),cut down by a Rinkle(1)
64  Fighter  Barbarian  Elven  5  0  3.40  3.0  6.0  20.0  0.0  8.40  2.00  356.00  cut down by a Djinni(1),cut down by a Hair(1),cut down by a Ned(1)
65  Fighter  Bard  Troll  5  0  3.40  3.0  5.0  20.0  0.0  6.20  2.20  391.00  cut down by a Ghoul(1),cut down by a Poltergeist(1),cut down by a Trachea(1)
66  Fighter  Knight  Dwarven  5  0  3.40  3.0  5.0  20.0  0.0  5.20  2.20  389.20  cut down by a Dante(1),cut down by a Google(1),cut down by a Hair(1)
67  Fighter  Knight  Elven  5  0  3.40  3.0  5.0  20.0  0.0  3.40  2.00  343.00  cut down by a Ned(1),cut down by a Rinkle(1),cut down by a Trachea(1)
68  Thief  Pilfer  Human  5  0  3.40  3.0  6.0  20.0  0.0  10.20  2.40  344.00  cut down by a Blumble(1),cut down by a China Wolf(1),cut down by a Gremlin(1)
69  Fighter  Samurai  Wilmsry  5  0  3.40  3.0  5.0  20.0  0.0  8.20  2.00  406.40  cut down by a Dante(1),cut down by a Google(1),cut down by a Pogo(1)
70  Magic User  Warlock  Dwarven  5  0  3.40  3.0  7.0  20.0  0.0  8.80  2.40  403.20  cut down by a Blumble(1),cut down by a Herman(1),cut down by a Philly(1)
71  Fighter  Bard  Fridgian  5  0  3.40  3.0  4.0  0.0  0.0  8.60  2.80  366.60  cut down by a Blumble(2),cut down by a Dante(1),cut down by a Drat(1)
72  Fighter  Bard  Human  5  0  3.40  3.0  4.0  0.0  0.0  11.40  2.40  417.80  cut down by a China Wolf(2),cut down by a Poltergeist(1),cut down by a Primp(1)
73  Magic User  Court Mage  Human  5  0  3.40  3.0  4.0  0.0  0.0  11.60  2.40  394.20  cut down by a Gremlin(2),cut down by a Poltergeist(2),cut down by a China Wolf(1)
74  Thief  Ninja  Elven  5  0  3.40  3.0  4.0  0.0  0.0  10.40  2.60  341.40  cut down by a Dante(1),cut down by a Ghoul(1),cut down by a Primp(1)
75  Thief  Pickpocket  Elven  5  0  3.40  3.0  4.0  0.0  0.0  9.80  2.40  393.60  cut down by a Blumble(1),cut down by a Poltergeist(1),cut down by a Skeleton(1)
76  Fighter  Samurai  Human  5  0  3.40  3.0  4.0  0.0  0.0  8.80  2.60  327.60  cut down by a Frank(2),came up short on a leap(1),cut down by a Dante(1)
77  Magic User  Sorcerer  Fridgian  5  0  3.40  3.0  4.0  0.0  0.0  12.00  2.60  408.20  cut down by a Blumble(1),cut down by a Cave Bear(1),cut down by a Drarl(1)
78  Fighter  Woodsman  Elven  5  0  3.40  3.0  4.0  0.0  0.0  5.40  2.80  346.00  cut down by a Poltergeist(2),cut down by a Blumble(1),cut down by a Ghoul(1)
79  Thief  Cutthroat  Human  5  0  3.40  2.0  7.0  20.0  0.0  8.20  2.40  330.40  cut down by a Craig(1),cut down by a Gremlin(1),cut down by a Pogo(1)
80  Thief  Cloaker  Fridgian  5  0  3.20  4.0  5.0  20.0  0.0  5.40  2.00  339.00  fell off a wall(2),cut down by a Primp(1),starved in the dark(1)
81  Magic User  Court Mage  Wilmsry  5  0  3.20  4.0  4.0  0.0  0.0  5.60  2.00  294.00  cut down by a Dante(1),cut down by a Google(1),cut down by a Ned(1)
82  Magic User  Apprentice  Wilmsry  5  0  3.20  3.0  5.0  40.0  0.0  3.20  2.00  330.40  cut down by a Blumble(1),cut down by a Ned(1),cut down by a Philly(1)
83  Thief  Cloaker  Human  5  0  3.20  3.0  5.0  20.0  0.0  6.80  1.80  349.80  fell off a wall(2),undone by a trap(2),cut down by a Krupke(1)
84  Magic User  Illusionist  Wilmsry  5  0  3.20  3.0  5.0  20.0  0.0  6.40  1.80  355.40  cut down by a China Wolf(1),cut down by a Drekk(1),cut down by a Google(1)
85  Fighter  Master of Arms  Troll  5  0  3.20  3.0  5.0  20.0  0.0  5.00  2.00  322.40  cut down by a Blumble(1),cut down by a Dante(1),cut down by a Gremlin(1)
86  Thief  Pickpocket  Fridgian  5  0  3.20  3.0  5.0  20.0  0.0  7.60  1.80  340.40  fell off a wall(2),came up short on a leap(1),cut down by a Skeleton(1)
87  Thief  Pilfer  Troll  5  0  3.20  3.0  6.0  20.0  0.0  9.60  2.40  373.00  fell off a wall(2),cut down by a China Wolf(1),cut down by a Poltergeist(1)
88  Fighter  Bard  Elven  5  0  3.20  3.0  4.0  0.0  0.0  7.80  2.20  350.00  cut down by a Poltergeist(2),cut down by a Google(1),cut down by a Shadow(1)
89  Fighter  Master of Arms  Human  5  0  3.20  3.0  4.0  0.0  0.0  10.20  2.40  362.00  cut down by a Google(1),cut down by a Poltergeist(1),cut down by a Skeleton(1)
90  Magic User  Apprentice  Troll  5  0  3.20  2.0  5.0  40.0  0.0  8.20  2.80  334.40  cut down by a Craig(1),cut down by a Frank(1),cut down by a Philly(1)
91  Magic User  Sorcerer  Dwarven  5  0  3.00  4.0  4.0  0.0  0.0  9.40  2.40  325.20  cut down by a Dante(1),cut down by a Gremlin(1),cut down by a Primp(1)
92  Thief  Acrobat  Human  5  0  3.00  3.0  5.0  20.0  0.0  7.20  2.20  307.20  cut down by a Cave Bear(1),cut down by a Drarl(1),cut down by a Poltergeist(1)
93  Thief  Cat Burglar  Fridgian  5  0  3.00  3.0  6.0  20.0  0.0  7.40  1.80  296.40  cut down by a Poltergeist(2),cut down by a Pogo(1),starved in the dark(1)
94  Magic User  Summoner  Troll  5  0  3.00  3.0  5.0  20.0  0.0  5.40  1.80  334.80  cut down by a Gremlin(2),cut down by a Dante(1),eaten by their own summoning(1)
95  Fighter  Barbarian  Fridgian  5  0  3.00  3.0  4.0  0.0  0.0  8.00  1.80  345.20  undone by a trap(2),cut down by a Skeleton(1),cut down by a Trachea(1)
96  Magic User  Cleric  Fridgian  5  0  3.00  3.0  4.0  0.0  0.0  7.00  2.20  267.80  cut down by a China Wolf(1),cut down by a Dante(1),cut down by a Poltergeist(1)
97  Fighter  Guard  Human  5  0  3.00  3.0  4.0  0.0  0.0  10.20  2.40  397.60  cut down by a China Wolf(1),cut down by a Dante(1),cut down by a Frank(1)
98  Fighter  Master of Arms  Dwarven  5  0  3.00  3.0  4.0  0.0  0.0  9.40  2.00  309.00  cut down by a Dante(2),cut down by a Blumble(1),starved in the dark(1)
99  Thief  Pilfer  Fridgian  5  0  3.00  3.0  3.0  0.0  0.0  8.40  2.20  296.40  cut down by a China Wolf(1),cut down by a Dante(1),cut down by a Frank(1)
100  Fighter  Samurai  Dwarven  5  0  3.00  3.0  4.0  0.0  0.0  8.20  2.60  325.20  cut down by a Poltergeist(1),cut down by a Primp(1),cut down by a Trachea(1)
101  Fighter  Woodsman  Human  5  0  3.00  3.0  4.0  0.0  0.0  7.20  2.20  320.20  cut down by a Cave Bear(1),cut down by a Dante(1),cut down by a Werebeast(1)
102  Fighter  Woodsman  Troll  5  0  3.00  3.0  3.0  0.0  0.0  2.80  2.00  267.60  cut down by a Poltergeist(2),cut down by a Google(1),cut down by a Ned(1)
103  Thief  Pilfer  Elven  5  0  3.00  2.0  5.0  40.0  0.0  5.00  1.80  323.60  came up short on a leap(1),cut down by a Blumble(1),cut down by a Drekk(1)
104  Thief  Cat Burglar  Human  5  0  2.80  3.0  5.0  20.0  0.0  4.80  1.80  246.60  undone by a trap(3),cut down by a Primp(1),cut down by a Skeleton(1)
105  Magic User  Court Mage  Elven  5  0  2.80  3.0  5.0  20.0  0.0  6.20  1.80  285.40  cut down by a Drekk(1),cut down by a Google(1),fell off a wall(1)
106  Thief  Cutthroat  Dwarven  5  0  2.80  3.0  5.0  20.0  0.0  4.60  1.80  306.40  cut down by a Dante(1),cut down by a Hair(1),cut down by a Rinkle(1)
107  Thief  Cutthroat  Fridgian  5  0  2.80  3.0  5.0  20.0  0.0  6.80  2.00  318.20  cut down by a Cave Bear(1),cut down by a Hair(1),cut down by a Philly(1)
108  Magic User  Summoner  Elven  5  0  2.80  3.0  5.0  20.0  0.0  4.80  1.80  341.60  cut down by a Philly(2),cut down by a Cave Bear(1),eaten by their own summoning(1)
109  Magic User  Summoner  Fridgian  5  0  2.80  3.0  5.0  20.0  0.0  5.80  1.80  367.20  cut down by a Gremlin(1),cut down by a Krupke(1),cut down by a Poltergeist(1)
110  Magic User  Wizard  Wilmsry  5  0  2.80  3.0  5.0  20.0  0.0  2.60  2.00  308.40  cut down by a Flube(1),cut down by a Google(1),cut down by a Gremlin(1)
111  Thief  Cloaker  Elven  5  0  2.80  3.0  4.0  0.0  0.0  6.60  2.00  300.20  cut down by a Blumble(1),cut down by a Dante(1),cut down by a Drekk(1)
112  Thief  Cloaker  Troll  5  0  2.80  3.0  4.0  0.0  0.0  5.40  1.80  325.40  starved in the dark(3),fell off a wall(1),undone by a trap(1)
113  Thief  Con Artist  Elven  5  0  2.80  3.0  4.0  0.0  0.0  3.20  2.20  301.60  came up short on a leap(1),cut down by a Cave Bear(1),cut down by a Ghoul(1)
114  Thief  Cutthroat  Troll  5  0  2.80  3.0  4.0  0.0  0.0  4.40  2.20  291.00  starved in the dark(3),cut down by a Werebeast(1),spent by the dungeon itself(1)
115  Fighter  Guard  Elven  5  0  2.80  3.0  3.0  0.0  0.0  4.60  1.80  275.00  cut down by a Cave Bear(3),cut down by a Poltergeist(1),starved in the dark(1)
116  Fighter  Soldier  Elven  5  0  2.80  3.0  4.0  0.0  0.0  5.80  2.00  270.40  cut down by a Cave Bear(2),cut down by a Blumble(1),cut down by a Drekk(1)
117  Magic User  Wizard  Elven  5  0  2.80  3.0  4.0  0.0  0.0  4.60  1.80  335.80  cut down by a Drekk(1),cut down by a Gremlin(1),cut down by a Hair(1)
118  Fighter  Woodsman  Dwarven  5  0  2.80  3.0  4.0  0.0  0.0  3.80  1.80  294.00  cut down by a Poltergeist(2),cut down by a Drekk(1),cut down by a Gremlin(1)
119  Thief  Cloaker  Dwarven  5  0  2.80  2.0  7.0  20.0  0.0  3.60  1.80  304.60  cut down by a Craig(1),cut down by a Gremlin(1),cut down by a Philly(1)
120  Thief  Con Artist  Dwarven  5  0  2.80  2.0  5.0  20.0  0.0  0.80  1.60  257.40  cut down by a Gremlin(1),cut down by a Krupke(1),cut down by a Ned(1)
121  Magic User  Wizard  Human  5  0  2.80  2.0  6.0  20.0  0.0  6.80  1.80  337.00  fell off a wall(2),cut down by a Poltergeist(1),spent by the dungeon itself(1)
122  Magic User  Cleric  Dwarven  5  0  2.60  3.0  4.0  0.0  0.0  7.40  2.00  239.20  cut down by a Gremlin(1),cut down by a Ned(1),cut down by a Rinkle(1)
123  Fighter  Guard  Dwarven  5  0  2.60  3.0  4.0  0.0  0.0  9.40  2.20  307.00  cut down by a Drekk(1),cut down by a Google(1),cut down by a Shadow(1)
124  Magic User  Illusionist  Fridgian  5  0  2.60  3.0  3.0  0.0  0.0  6.80  1.80  294.60  cut down by a Dante(1),cut down by a Drekk(1),cut down by a Poltergeist(1)
125  Magic User  Illusionist  Human  5  0  2.60  3.0  3.0  0.0  0.0  8.60  2.20  292.60  cut down by a Cave Bear(1),cut down by a Dante(1),cut down by a Drekk(1)
126  Fighter  Master of Arms  Elven  5  0  2.60  3.0  4.0  0.0  0.0  7.80  2.00  343.20  cut down by a Poltergeist(2),cut down by a Google(1),fell off a wall(1)
127  Magic User  Warlock  Elven  5  0  2.60  3.0  3.0  0.0  0.0  7.80  2.20  359.40  cut down by a Bat/Rat(1),cut down by a Cave Bear(1),cut down by a Poltergeist(1)
128  Magic User  Cleric  Human  5  0  2.60  2.0  5.0  20.0  0.0  5.80  2.00  249.40  came up short on a leap(1),cut down by a Gremlin(1),cut down by a Skeleton(1)
129  Magic User  Summoner  Human  5  0  2.60  2.0  5.0  20.0  0.0  5.00  1.60  267.00  cut down by a Drekk(1),cut down by a Google(1),cut down by a Pogo(1)
130  Fighter  Bard  Dwarven  5  0  2.60  2.0  4.0  0.0  0.0  5.20  2.40  237.80  cut down by a Bat/Rat(1),cut down by a China Wolf(1),cut down by a Philly(1)
131  Magic User  Illusionist  Elven  5  0  2.40  3.0  3.0  0.0  0.0  4.20  1.60  259.20  cut down by a Gremlin(1),cut down by a Philly(1),cut down by a Skeleton(1)
132  Fighter  Samurai  Elven  5  0  2.40  2.0  4.0  0.0  0.0  5.20  1.80  244.60  fell off a wall(2),cut down by a Cave Bear(1),cut down by a Philly(1)
133  Thief  Cutthroat  Elven  5  0  2.20  2.0  4.0  0.0  0.0  6.00  1.80  209.60  cut down by a Ned(1),cut down by a Poltergeist(1),cut down by a Shadow(1)
134  Magic User  Wizard  Dwarven  5  0  2.20  2.0  4.0  0.0  0.0  3.60  1.60  225.60  starved in the dark(2),cut down by a Drekk(1),cut down by a Gremlin(1)
135  Magic User  Illusionist  Dwarven  5  0  2.00  2.0  3.0  0.0  0.0  2.60  1.20  184.60  cut down by a Gremlin(2),cut down by a Philly(2),cut down by a Poltergeist(1)
136  Magic User  Sorcerer  Elven  5  0  2.00  2.0  3.0  0.0  0.0  4.40  1.20  215.00  cut down by a Drekk(1),cut down by a Philly(1),cut down by a Pogo(1)
137  Magic User  Summoner  Dwarven  5  0  2.00  2.0  3.0  0.0  0.0  4.00  1.20  223.80  cut down by a Ned(2),cut down by a China Wolf(1),cut down by a Hobgoblin(1)
138  Fighter  Soldier  Dwarven  5  0  1.80  2.0  3.0  0.0  0.0  6.60  1.60  217.00  cut down by a Gremlin(2),cut down by a China Wolf(1),cut down by a Poltergeist(1)
139  Thief  Cat Burglar  Elven  5  0  1.80  1.0  5.0  20.0  0.0  2.00  1.40  138.80  undone by a trap(3),cut down by a Philly(1),starved in the dark(1)
140  Magic User  Apprentice  Dwarven  5  0  1.60  2.0  2.0  0.0  0.0  2.80  1.20  173.60  cut down by a China Wolf(1),cut down by a Gremlin(1),cut down by a Hobgoblin(1)
141  Magic User  Apprentice  Elven  5  0  1.60  2.0  2.0  0.0  0.0  2.60  1.20  153.80  cut down by a Bat/Rat(1),cut down by a Gremlin(1),cut down by a Hobgoblin(1)
142  Magic User  Apprentice  Human  5  0  1.60  1.0  3.0  0.0  0.0  2.80  1.40  185.20  cut down by a Gremlin(1),cut down by a Hobgoblin(1),cut down by a Philly(1)
143  Magic User  Cleric  Elven  5  0  1.40  1.0  3.0  0.0  0.0  3.80  1.20  154.40  cut down by a Viper(2),cut down by a Dante(1),cut down by a M&M(1)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Thief  240  0  3.74  4.0  6.0  30.8  0.8  7.30  2.43  383.13  undone by a trap(30),fell off a wall(26),starved in the dark(21)
Fighter  235  0  3.51  3.0  5.0  17.9  0.0  7.23  2.34  371.43  cut down by a Poltergeist(33),cut down by a Werebeast(23),cut down by a Dante(13)
Magic User  240  0  3.06  3.0  5.0  16.3  0.0  6.93  2.10  338.40  cut down by a Gremlin(20),cut down by a Poltergeist(20),fell off a wall(19)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Ninja  30  0  4.77  5.0  8.0  50.0  3.3  12.97  3.23  498.57  fell off a wall(3),cut down by a Dante(2),cut down by a Frank(2)
Knight  30  0  4.13  4.0  5.0  46.7  0.0  4.83  2.57  418.40  cut down by a Werebeast(8),cut down by a Poltergeist(5),cut down by a Dante(2)
Acrobat  30  0  4.07  4.0  6.0  40.0  0.0  8.53  2.77  404.60  undone by a trap(5),cut down by a Drarl(3),fell off a wall(3)
Con Artist  30  0  3.90  4.0  5.0  33.3  0.0  2.90  2.33  396.00  cut down by a Shadow(4),cut down by a Blumble(2),cut down by a Cave Bear(2)
Barbarian  30  0  3.87  4.0  6.0  26.7  0.0  8.47  2.23  406.50  cut down by a Poltergeist(4),cut down by a Trachea(3),fell off a wall(3)
Warlock  30  0  3.83  4.0  7.0  36.7  0.0  10.57  2.77  480.17  cut down by a Herman(3),cut down by a Primp(3),fell off a wall(3)
Pickpocket  30  0  3.80  4.0  6.0  20.0  0.0  8.97  2.50  397.87  fell off a wall(6),cut down by a Blumble(3),cut down by a Philly(2)
Pilfer  30  0  3.73  3.0  6.0  36.7  3.3  8.10  2.40  392.23  cut down by a China Wolf(3),fell off a wall(3),spent by the dungeon itself(3)
Woodsman  30  0  3.50  3.0  5.0  10.0  0.0  5.60  2.37  352.93  cut down by a Poltergeist(7),cut down by a Dante(2),cut down by a Werebeast(2)
Cloaker  30  0  3.47  4.0  6.0  23.3  0.0  5.63  2.10  370.70  starved in the dark(6),undone by a trap(6),fell off a wall(5)
Bard  30  0  3.43  3.0  5.0  13.3  0.0  7.47  2.47  376.10  cut down by a Poltergeist(5),cut down by a China Wolf(3),cut down by a Trachea(3)
Court Mage  30  0  3.40  4.0  5.0  13.3  0.0  9.50  2.37  347.70  cut down by a Poltergeist(5),cut down by a Google(3),cut down by a Gremlin(3)
Master of Arms  30  0  3.33  3.0  5.0  13.3  0.0  9.07  2.23  373.53  cut down by a Dante(4),starved in the dark(4),cut down by a Google(3)
Sorcerer  30  0  3.30  4.0  4.0  6.7  0.0  8.53  2.27  366.90  starved in the dark(4),cut down by a Blumble(2),cut down by a Dante(2)
Guard  30  0  3.30  3.0  5.0  13.3  0.0  7.60  2.27  361.83  cut down by a Werebeast(4),starved in the dark(4),cut down by a Cave Bear(3)
Soldier  30  0  3.27  3.0  5.0  10.0  0.0  6.93  2.27  337.60  cut down by a Poltergeist(4),cut down by a Cave Bear(3),cut down by a China Wolf(2)
Samurai  25  0  3.24  3.0  4.0  8.0  0.0  8.04  2.28  339.20  fell off a wall(4),cut down by a Werebeast(3),cut down by a Dante(2)
Cat Burglar  30  0  3.17  3.0  5.0  30.0  0.0  5.63  2.03  291.63  undone by a trap(10),starved in the dark(4),fell off a wall(3)
Wizard  30  0  3.07  3.0  5.0  20.0  0.0  5.60  2.03  343.47  cut down by a Gremlin(3),starved in the dark(3),cut down by a Drekk(2)
Cutthroat  30  0  3.00  3.0  5.0  13.3  0.0  5.70  2.07  313.40  starved in the dark(4),undone by a trap(4),cut down by a Poltergeist(3)
Summoner  30  0  2.97  3.0  5.0  20.0  0.0  4.90  1.77  340.07  cut down by a Gremlin(3),fell off a wall(3),cut down by a Ned(2)
Illusionist  30  0  2.77  3.0  4.0  6.7  0.0  6.13  1.83  307.27  cut down by a Philly(4),cut down by a Poltergeist(4),cut down by a Drekk(3)
Cleric  30  0  2.73  3.0  5.0  10.0  0.0  5.97  1.93  268.77  fell off a wall(5),cut down by a Gremlin(3),came up short on a leap(2)
Apprentice  30  0  2.43  2.0  5.0  16.7  0.0  4.20  1.83  252.90  cut down by a Philly(4),cut down by a Gremlin(3),cut down by a Hobgoblin(3)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Wilmsry  120  0  4.45  4.0  7.0  47.5  0.8  6.13  2.62  470.47  cut down by a Werebeast(20),cut down by a Poltergeist(10),fell off a wall(10)
Troll  120  0  3.66  4.0  5.0  24.2  0.0  8.18  2.48  382.87  starved in the dark(25),cut down by a Poltergeist(12),fell off a wall(9)
Fridgian  115  0  3.39  3.0  5.0  16.5  0.0  7.64  2.27  362.42  cut down by a Poltergeist(11),undone by a trap(10),fell off a wall(8)
Human  120  0  3.38  3.0  5.0  19.2  0.8  8.31  2.33  361.61  cut down by a Poltergeist(10),fell off a wall(10),undone by a trap(10)
Dwarven  120  0  2.99  3.0  5.0  14.2  0.0  6.78  2.08  312.12  cut down by a Gremlin(12),cut down by a Poltergeist(10),fell off a wall(10)
Elven  120  0  2.76  3.0  4.0  8.3  0.0  5.91  1.95  296.08  cut down by a Poltergeist(13),undone by a trap(11),fell off a wall(10)

POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  top causes
715  0  3.44  3.0  5.0  21.7  0.3  0.0  7.15  2.29  364.27  cut down by a Poltergeist(66),fell off a wall(57),starved in the dark(50)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 715 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=5  workers=4  startDepth=1
```

The full BEFORE matrix, `meta`, and `rollups` (including `rollups.pooled`) are also preserved verbatim in `docs/class-pass/v17-p51-before-smoke.json`. Plan 02's AFTER block compares against the same file's `docs/class-pass/v17-p51-after-smoke.json` counterpart.

#### AFTER — commit 608a0e58046177c1dd1f225a40c3f63d402f31e1 (initiative once per fight)

`node tools/tune-difficulty.mjs --seeds=200` (solo):

```

tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=6  max=9

Action-count distribution:
  min=36  p50=425  p90=654  max=967

Death-cause breakdown:
  fell off a wall      14 (7.0%)
  starved in the dark  14 (7.0%)
  undone by a trap     13 (6.5%)
  cut down by a Werebeast 13 (6.5%)
  cut down by a Dante  11 (5.5%)
  cut down by a Poltergeist 11 (5.5%)
  cut down by a Rinkle 10 (5.0%)
  cut down by a Philly 9 (4.5%)
  cut down by a Blumble 9 (4.5%)
  spent by the dungeon itself 9 (4.5%)
  cut down by a Drarl  7 (3.5%)
  cut down by a Google 6 (3.0%)
  cut down by a Craig  6 (3.0%)
  cut down by a Frank  5 (2.5%)
  came up short on a leap 4 (2.0%)
  cut down by a Hair   4 (2.0%)
  cut down by a Gremlin 4 (2.0%)
  cut down by a Shadow 4 (2.0%)
  cut down by a Drake  3 (1.5%)
  cut down by a Drat   3 (1.5%)
  cut down by a China Wolf 3 (1.5%)
  cut down by a Primp  3 (1.5%)
  cut down by a Trachea 2 (1.0%)
  cut down by a Djinni 2 (1.0%)
  cut down by a Pogo   2 (1.0%)
  cut down by a Stink Bug 2 (1.0%)
  cut down by a Sterling 2 (1.0%)
  cut down by a Zit    2 (1.0%)
  cut down by a Drekk  2 (1.0%)
  cut down by a Dog Face 2 (1.0%)
  cut down by a Herman 2 (1.0%)
  cut down by a Cave Bear 1 (0.5%)
  cut down by a Krupke 1 (0.5%)
  cut down by a Spectre 1 (0.5%)
  cut down by a Shriek 1 (0.5%)
  cut down by a Rast   1 (0.5%)
  cut down by a Skeleton 1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)
  cut down by a Floater 1 (0.5%)
  cut down by a Zombie 1 (0.5%)
  cut down by a Ghost  1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Dread Lock 1 (0.5%)
  cut down by a M&M    1 (0.5%)
  cut down by a Goblin 1 (0.5%)
  cut down by a Undead 1 (0.5%)
  cut down by a Ned    1 (0.5%)
  cut down by a Ghoul  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=293  successes=184 (62.8%)  failures=109  refused=0  exhausted=0
  runs with >=1 attempt: 67 of 200
  SP from parley: 2567 of 119226 total SP (2.2%)

Reach table (% of runs reaching floor N):
  >=5: 31.0%  >=10: 0.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=33  p50=108  p90=145  max=187

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 46/1874 (2.5%)
  6-10: 24/75 (32.0%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=99  foeBolted=37  foeDrained=2  foeDebuffed=18  foeHealed=0  foeSummoned=0
  heroResisted=34  heroResistFailed=6
  ability damage: 171 of 15041 total damage taken (1.1%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 200 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)

```

`node tools/tune-difficulty.mjs --seeds=200 --party`:

```

tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=5  p90=7  max=9

Action-count distribution:
  min=21  p50=648  p90=20000  max=20000

Death-cause breakdown:
  starved in the dark  15 (7.5%)
  fell off a wall      14 (7.0%)
  cut down by a Werebeast 9 (4.5%)
  undone by a trap     8 (4.0%)
  came up short on a leap 7 (3.5%)
  cut down by a Drarl  7 (3.5%)
  spent by the dungeon itself 7 (3.5%)
  cut down by a Herman 6 (3.0%)
  cut down by a Blumble 4 (2.0%)
  cut down by a Rinkle 4 (2.0%)
  cut down by a Dante  4 (2.0%)
  cut down by a Gremlin 4 (2.0%)
  cut down by a Ghost  4 (2.0%)
  cut down by a Drekk  3 (1.5%)
  cut down by a Craig  3 (1.5%)
  cut down by a Drake  3 (1.5%)
  cut down by a Primp  2 (1.0%)
  cut down by a Frank  2 (1.0%)
  cut down by a Ghoul  2 (1.0%)
  cut down by a Rast   2 (1.0%)
  cut down by a Drudge 2 (1.0%)
  cut down by a Wolf   2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Zit    2 (1.0%)
  cut down by a Undead 2 (1.0%)
  cut down by a Skeleton 2 (1.0%)
  cut down by a Floater 1 (0.5%)
  cut down by a Djinni 1 (0.5%)
  cut down by a Philly 1 (0.5%)
  cut down by a Google 1 (0.5%)
  cut down by a Sterling 1 (0.5%)
  cut down by a Trachea 1 (0.5%)
  cut down by a China Wolf 1 (0.5%)
  cut down by a Dread Lock 1 (0.5%)
  cut down by a Poltergeist 1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=351  successes=230 (65.5%)  failures=121  refused=0  exhausted=0
  runs with >=1 attempt: 73 of 200
  SP from parley: 4253 of 130745 total SP (3.3%)

Reach table (% of runs reaching floor N):
  >=5: 60.6%  >=10: 0.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=21  p50=104  p90=134  max=166

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 48/2078 (2.3%)
  6-10: 34/148 (23.0%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=123  foeBolted=64  foeDrained=2  foeDebuffed=13  foeHealed=0  foeSummoned=0
  heroResisted=30  heroResistFailed=8
  ability damage: 146 of 8037 total damage taken (1.8%)

Party (--party, D-12/D-20):
  member forced at run start in 192/200 runs; member alive at run end: 155 (77.5%)

Stuck: 68 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 132 dead, 68 stuck (hit maxActions=20000; excluded from depth stats)

```

`node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p51-after-smoke.json` (stdout — the ranked matrix; stderr's elapsed line `elapsed: 107.5s  workers=4  runs=715` is not quoted, per this ledger's own convention):

```
tune-classes: 143 cells x 5 seeds (715 runs) — start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
1  Thief  Ninja  Wilmsry  5  0  6.80  7.0  10.0  100.0  20.0  18.00  4.00  690.80  cut down by a Craig(1),cut down by a Drake(1),cut down by a Herman(1)
2  Thief  Acrobat  Wilmsry  5  0  6.40  6.0  8.0  100.0  0.0  7.80  3.40  650.00  cut down by a Werebeast(2),cut down by a Rinkle(1),cut down by a Undead(1)
3  Thief  Con Artist  Wilmsry  5  0  6.20  7.0  8.0  80.0  0.0  2.80  3.40  686.20  came up short on a leap(3),spent by the dungeon itself(1),starved in the dark(1)
4  Fighter  Bard  Wilmsry  5  0  5.80  5.0  10.0  80.0  20.0  11.80  3.20  611.80  cut down by a Frank(1),cut down by a Poltergeist(1),cut down by a Rinkle(1)
5  Thief  Ninja  Dwarven  5  0  5.40  6.0  7.0  60.0  0.0  12.20  3.80  533.20  cut down by a Ghost(1),cut down by a Ghoul(1),cut down by a Herman(1)
6  Fighter  Bard  Fridgian  5  0  5.00  5.0  6.0  80.0  0.0  9.20  3.20  495.80  cut down by a Werebeast(2),cut down by a Drarl(1),cut down by a Hair(1)
7  Thief  Cloaker  Troll  5  0  5.00  5.0  6.0  60.0  0.0  11.80  3.40  523.00  starved in the dark(2),cut down by a Blumble(1),cut down by a Bones(1)
8  Thief  Ninja  Human  5  0  5.00  5.0  7.0  60.0  0.0  11.20  3.40  470.40  cut down by a Blumble(1),cut down by a Poltergeist(1),cut down by a Rinkle(1)
9  Thief  Ninja  Troll  5  0  5.00  5.0  6.0  60.0  0.0  16.40  3.60  579.40  starved in the dark(2),cut down by a Craig(1),cut down by a Rinkle(1)
10  Thief  Pilfer  Wilmsry  5  0  5.00  5.0  7.0  60.0  0.0  8.40  3.00  580.40  cut down by a Poltergeist(2),cut down by a Werebeast(2),cut down by a Drarl(1)
11  Fighter  Guard  Wilmsry  5  0  5.00  4.0  9.0  40.0  0.0  6.60  2.60  563.80  cut down by a Bat/Rat(1),cut down by a Krupke(1),cut down by a Stalka Beast(1)
12  Fighter  Soldier  Wilmsry  5  0  5.00  4.0  8.0  40.0  0.0  5.80  3.20  522.00  cut down by a Drat(1),cut down by a Dread Lock(1),cut down by a Poltergeist(1)
13  Thief  Cat Burglar  Wilmsry  5  0  4.80  5.0  7.0  80.0  0.0  5.60  2.80  470.00  undone by a trap(3),cut down by a Drarl(1),cut down by a Ghoul(1)
14  Fighter  Samurai  Wilmsry  5  0  4.80  5.0  6.0  80.0  0.0  11.20  3.00  539.20  cut down by a Werebeast(2),cut down by a Sterling(1),cut down by a Undead(1)
15  Fighter  Woodsman  Wilmsry  5  0  4.80  5.0  5.0  80.0  0.0  6.80  3.00  533.00  cut down by a Blumble(2),cut down by a Werebeast(2),cut down by a Sterling(1)
16  Fighter  Knight  Fridgian  5  0  4.80  5.0  6.0  60.0  0.0  7.00  2.80  541.60  cut down by a Cave Bear(1),cut down by a Frank(1),cut down by a Poltergeist(1)
17  Fighter  Master of Arms  Wilmsry  5  0  4.80  5.0  6.0  60.0  0.0  15.00  3.40  569.80  cut down by a Drake(1),cut down by a Frank(1),cut down by a Rinkle(1)
18  Magic User  Sorcerer  Human  5  0  4.80  5.0  6.0  60.0  0.0  15.40  3.60  587.80  cut down by a Drake(1),cut down by a Drarl(1),cut down by a Rast(1)
19  Thief  Cloaker  Wilmsry  5  0  4.80  4.0  9.0  40.0  0.0  8.40  3.00  570.80  cut down by a Blumble(1),cut down by a Dante(1),cut down by a Frank(1)
20  Fighter  Knight  Wilmsry  5  0  4.80  4.0  7.0  40.0  0.0  3.00  2.60  515.80  cut down by a Cave Bear(2),cut down by a Blumble(1),cut down by a Djinni(1)
21  Magic User  Summoner  Fridgian  5  0  4.80  4.0  7.0  40.0  0.0  11.20  3.20  594.00  cut down by a Blumble(1),cut down by a Rast(1),eaten by their own summoning(1)
22  Thief  Cutthroat  Wilmsry  5  0  4.80  4.0  9.0  20.0  0.0  8.00  3.00  558.80  cut down by a Drarl(1),cut down by a Skeleton(1),cut down by a Stink Bug(1)
23  Magic User  Court Mage  Human  5  0  4.60  5.0  6.0  80.0  0.0  11.80  3.20  485.60  fell off a wall(2),cut down by a Blumble(1),cut down by a Craig(1)
24  Magic User  Warlock  Wilmsry  5  0  4.60  4.0  7.0  40.0  0.0  10.20  2.80  635.40  cut down by a Cave Bear(1),cut down by a Drarl(1),cut down by a Herman(1)
25  Fighter  Master of Arms  Human  5  0  4.60  4.0  8.0  20.0  0.0  14.40  3.60  492.20  cut down by a Drake(1),cut down by a Hair(1),cut down by a Herman(1)
26  Magic User  Illusionist  Troll  5  0  4.60  3.0  9.0  40.0  0.0  9.20  2.60  477.40  cut down by a Dante(1),cut down by a Dread Lock(1),cut down by a Goblin(1)
27  Fighter  Barbarian  Troll  5  0  4.40  5.0  5.0  80.0  0.0  11.00  2.60  453.00  fell off a wall(2),cut down by a Blumble(1),cut down by a Poltergeist(1)
28  Fighter  Barbarian  Human  5  0  4.40  5.0  5.0  60.0  0.0  15.80  2.80  497.20  cut down by a Cave Bear(1),cut down by a Poltergeist(1),cut down by a Sterling(1)
29  Magic User  Court Mage  Fridgian  5  0  4.40  5.0  5.0  60.0  0.0  15.00  3.40  412.00  cut down by a Drarl(1),cut down by a Krupke(1),cut down by a Poltergeist(1)
30  Fighter  Knight  Human  5  0  4.40  5.0  5.0  60.0  0.0  7.00  3.60  466.20  cut down by a Drarl(1),cut down by a Frank(1),cut down by a Poltergeist(1)
31  Magic User  Sorcerer  Troll  5  0  4.40  5.0  6.0  60.0  0.0  14.40  3.00  517.20  came up short on a leap(1),cut down by a Ghoul(1),cut down by a Shriek(1)
32  Thief  Con Artist  Dwarven  5  0  4.40  4.0  7.0  40.0  0.0  1.60  2.40  496.60  cut down by a Bones(1),cut down by a Dante(1),cut down by a Gremlin(1)
33  Thief  Pilfer  Fridgian  5  0  4.40  4.0  5.0  40.0  0.0  11.80  2.60  524.20  cut down by a Cave Bear(1),cut down by a Rast(1),cut down by a Rinkle(1)
34  Fighter  Soldier  Fridgian  5  0  4.40  4.0  6.0  40.0  0.0  10.80  3.20  449.60  cut down by a Dante(1),cut down by a Drarl(1),cut down by a Rinkle(1)
35  Magic User  Sorcerer  Wilmsry  5  0  4.40  4.0  8.0  20.0  0.0  8.80  2.60  522.80  cut down by a China Wolf(1),cut down by a Google(1),cut down by a Gremlin(1)
36  Fighter  Woodsman  Fridgian  5  0  4.40  4.0  7.0  20.0  0.0  8.00  3.20  423.40  cut down by a Frank(1),cut down by a Primp(1),cut down by a Werebeast(1)
37  Magic User  Cleric  Troll  5  0  4.20  5.0  6.0  60.0  0.0  9.00  2.80  431.00  cut down by a Ghost(1),cut down by a Poltergeist(1),cut down by a Spectre(1)
38  Magic User  Warlock  Human  5  0  4.20  5.0  6.0  60.0  0.0  13.40  3.00  491.40  cut down by a Cave Bear(1),cut down by a Philly(1),cut down by a Spectre(1)
39  Fighter  Woodsman  Troll  5  0  4.20  5.0  5.0  60.0  0.0  5.40  2.60  387.40  cut down by a Blumble(1),cut down by a Cave Bear(1),cut down by a Google(1)
40  Fighter  Barbarian  Fridgian  5  0  4.20  4.0  5.0  40.0  0.0  12.00  2.60  476.80  cut down by a China Wolf(1),cut down by a Dante(1),cut down by a Google(1)
41  Fighter  Guard  Troll  5  0  4.20  4.0  5.0  40.0  0.0  9.00  2.80  492.40  cut down by a Blumble(1),cut down by a Frank(1),cut down by a Zombie(1)
42  Fighter  Master of Arms  Troll  5  0  4.20  4.0  6.0  40.0  0.0  7.80  2.60  442.60  cut down by a Poltergeist(3),cut down by a Herman(1),spent by the dungeon itself(1)
43  Thief  Ninja  Fridgian  5  0  4.20  4.0  5.0  40.0  0.0  14.20  3.20  472.60  cut down by a Frank(1),cut down by a Rinkle(1),cut down by a Skeleton(1)
44  Fighter  Soldier  Human  5  0  4.20  4.0  7.0  40.0  0.0  9.20  3.20  462.20  cut down by a Werebeast(2),cut down by a Dante(1),cut down by a Floater(1)
45  Fighter  Soldier  Troll  5  0  4.20  4.0  5.0  40.0  0.0  9.20  2.80  418.20  cut down by a Bones(1),cut down by a Frank(1),cut down by a Gremlin(1)
46  Magic User  Summoner  Human  5  0  4.20  4.0  7.0  40.0  0.0  11.80  3.20  566.20  cut down by a Werebeast(2),cut down by a Floater(1),cut down by a Ghoul(1)
47  Magic User  Wizard  Fridgian  5  0  4.20  4.0  5.0  40.0  0.0  8.80  2.80  492.40  cut down by a Drat(2),cut down by a Dante(1),cut down by a Zit(1)
48  Magic User  Wizard  Troll  5  0  4.20  4.0  6.0  40.0  0.0  11.40  3.40  521.40  fell off a wall(2),cut down by a Drake(1),cut down by a Google(1)
49  Magic User  Wizard  Wilmsry  5  0  4.20  4.0  7.0  40.0  0.0  4.40  2.60  532.00  cut down by a Gremlin(1),cut down by a Primp(1),cut down by a Shadow(1)
50  Thief  Acrobat  Fridgian  5  0  4.20  4.0  6.0  20.0  0.0  12.00  3.20  429.40  cut down by a Drake(1),cut down by a Rast(1),cut down by a Undead(1)
51  Thief  Cat Burglar  Troll  5  0  4.20  4.0  6.0  20.0  0.0  14.80  3.20  447.00  cut down by a Drake(1),cut down by a Frank(1),cut down by a Werebeast(1)
52  Magic User  Warlock  Dwarven  5  0  4.20  4.0  5.0  20.0  0.0  15.20  3.20  517.40  cut down by a Rinkle(2),cut down by a Cave Bear(1),cut down by a Drarl(1)
53  Thief  Acrobat  Troll  5  0  4.00  4.0  6.0  40.0  0.0  13.20  3.40  470.80  cut down by a Blumble(1),cut down by a Dante(1),cut down by a Herman(1)
54  Fighter  Barbarian  Wilmsry  5  0  4.00  4.0  6.0  40.0  0.0  7.40  2.20  510.60  cut down by a Dante(1),cut down by a Philly(1),cut down by a Primp(1)
55  Thief  Con Artist  Human  5  0  4.00  4.0  6.0  40.0  0.0  2.80  2.20  465.80  came up short on a leap(1),cut down by a Gremlin(1),cut down by a Shadow(1)
56  Magic User  Court Mage  Troll  5  0  4.00  4.0  6.0  40.0  0.0  12.60  3.00  431.00  cut down by a Craig(1),cut down by a Sterling(1),cut down by a Undead(1)
57  Magic User  Sorcerer  Fridgian  5  0  4.00  4.0  6.0  40.0  0.0  12.60  2.80  444.20  cut down by a Flube(1),cut down by a Philly(1),cut down by a Poltergeist(1)
58  Magic User  Warlock  Troll  5  0  4.00  4.0  7.0  40.0  0.0  10.20  2.80  437.80  starved in the dark(2),cut down by a Stalka Beast(1),cut down by a Trachea(1)
59  Thief  Cloaker  Fridgian  5  0  4.00  4.0  6.0  20.0  0.0  8.80  2.60  396.00  cut down by a Blumble(1),cut down by a Dante(1),cut down by a Drake(1)
60  Fighter  Guard  Fridgian  5  0  4.00  4.0  5.0  20.0  0.0  12.40  3.20  426.80  cut down by a Drat(1),cut down by a Primp(1),cut down by a Skeleton(1)
61  Fighter  Knight  Troll  5  0  4.00  4.0  5.0  20.0  0.0  2.60  2.20  371.00  cut down by a Google(2),fell off a wall(2),came up short on a leap(1)
62  Fighter  Samurai  Troll  5  0  4.00  4.0  5.0  20.0  0.0  12.40  3.00  451.20  cut down by a Blumble(1),cut down by a Sterling(1),cut down by a Zombie(1)
63  Magic User  Warlock  Fridgian  5  0  4.00  4.0  5.0  20.0  0.0  11.60  3.20  491.40  cut down by a Werebeast(2),cut down by a Dante(1),cut down by a Drake(1)
64  Magic User  Wizard  Elven  5  0  4.00  4.0  4.0  0.0  0.0  12.20  2.80  555.00  cut down by a Blumble(1),cut down by a Drat(1),cut down by a Frank(1)
65  Thief  Cutthroat  Human  5  0  4.00  3.0  8.0  20.0  0.0  10.80  2.60  468.60  cut down by a Blumble(1),cut down by a Cave Bear(1),cut down by a Craig(1)
66  Magic User  Cleric  Wilmsry  5  0  3.80  4.0  6.0  40.0  0.0  5.40  2.20  360.60  fell off a wall(3),cut down by a Cave Bear(1),cut down by a Werebeast(1)
67  Magic User  Illusionist  Wilmsry  5  0  3.80  4.0  5.0  40.0  0.0  6.00  2.20  407.20  cut down by a Dante(1),cut down by a Google(1),cut down by a M&M(1)
68  Thief  Cloaker  Human  5  0  3.80  4.0  5.0  20.0  0.0  10.60  2.40  417.60  cut down by a Poltergeist(2),came up short on a leap(1),fell off a wall(1)
69  Thief  Con Artist  Troll  5  0  3.80  4.0  5.0  20.0  0.0  3.20  2.20  451.80  cut down by a Poltergeist(2),cut down by a Dante(1),cut down by a Hair(1)
70  Magic User  Illusionist  Fridgian  5  0  3.80  4.0  5.0  20.0  0.0  11.40  2.60  428.60  cut down by a Drarl(1),cut down by a Philly(1),cut down by a Rast(1)
71  Fighter  Master of Arms  Fridgian  5  0  3.80  4.0  5.0  20.0  0.0  9.80  2.80  397.40  cut down by a China Wolf(1),cut down by a Herman(1),cut down by a Werebeast(1)
72  Thief  Pilfer  Dwarven  5  0  3.80  4.0  7.0  20.0  0.0  7.00  2.40  382.20  cut down by a Frank(1),cut down by a Gremlin(1),cut down by a Poltergeist(1)
73  Thief  Pilfer  Human  5  0  3.80  4.0  5.0  20.0  0.0  7.20  2.20  447.60  cut down by a Philly(1),cut down by a Poltergeist(1),cut down by a Primp(1)
74  Fighter  Samurai  Dwarven  5  0  3.80  4.0  5.0  20.0  0.0  11.80  3.20  378.40  cut down by a Craig(1),cut down by a Ghoul(1),cut down by a Shadow(1)
75  Thief  Acrobat  Human  5  0  3.80  4.0  4.0  0.0  0.0  11.00  3.00  371.60  cut down by a Werebeast(2),cut down by a Drarl(1),cut down by a Frank(1)
76  Thief  Cutthroat  Fridgian  5  0  3.80  4.0  4.0  0.0  0.0  8.80  2.60  381.20  cut down by a Blumble(1),cut down by a Ghoul(1),cut down by a Poltergeist(1)
77  Fighter  Soldier  Dwarven  5  0  3.80  4.0  4.0  0.0  0.0  12.00  3.00  478.40  cut down by a Blumble(1),cut down by a Frank(1),cut down by a Ghoul(1)
78  Fighter  Bard  Human  5  0  3.80  3.0  5.0  40.0  0.0  10.20  2.80  423.20  cut down by a Werebeast(2),cut down by a Cave Bear(1),cut down by a Philly(1)
79  Thief  Acrobat  Dwarven  5  0  3.80  3.0  6.0  20.0  0.0  10.20  2.60  404.20  cut down by a Frank(1),cut down by a Stink Bug(1),fell off a wall(1)
80  Thief  Ninja  Elven  5  0  3.80  3.0  7.0  20.0  0.0  13.20  3.00  356.40  cut down by a Cave Bear(1),cut down by a Drake(1),cut down by a Hair(1)
81  Magic User  Court Mage  Wilmsry  5  0  3.60  4.0  5.0  40.0  0.0  5.40  2.20  307.00  cut down by a Blumble(1),cut down by a Dante(1),cut down by a Google(1)
82  Magic User  Wizard  Human  5  0  3.60  4.0  5.0  40.0  0.0  8.60  2.40  423.20  cut down by a Bat/Rat(1),cut down by a Gremlin(1),cut down by a Rinkle(1)
83  Thief  Acrobat  Elven  5  0  3.60  4.0  5.0  20.0  0.0  12.60  2.80  385.80  cut down by a Werebeast(3),cut down by a Poltergeist(1),fell off a wall(1)
84  Magic User  Apprentice  Wilmsry  5  0  3.60  4.0  5.0  20.0  0.0  5.40  2.40  377.80  cut down by a China Wolf(1),cut down by a Drat(1),cut down by a Drekk(1)
85  Magic User  Cleric  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  9.40  2.20  384.00  cut down by a China Wolf(1),cut down by a Flube(1),cut down by a Shadow(1)
86  Fighter  Knight  Dwarven  5  0  3.60  4.0  5.0  20.0  0.0  5.40  2.40  417.40  cut down by a Drat(1),cut down by a Poltergeist(1),fell off a wall(1)
87  Fighter  Knight  Elven  5  0  3.60  4.0  5.0  20.0  0.0  3.40  2.20  405.40  cut down by a Cave Bear(1),cut down by a Rinkle(1),cut down by a Sterling(1)
88  Fighter  Master of Arms  Dwarven  5  0  3.60  4.0  4.0  0.0  0.0  12.00  3.00  418.60  cut down by a Dante(1),cut down by a Drake(1),cut down by a Frank(1)
89  Magic User  Apprentice  Elven  5  0  3.60  3.0  7.0  40.0  0.0  9.40  3.00  436.60  cut down by a China Wolf(1),cut down by a Djinni(1),cut down by a Hobgoblin(1)
90  Fighter  Barbarian  Dwarven  5  0  3.60  3.0  5.0  40.0  0.0  10.80  2.40  398.60  cut down by a Blumble(1),cut down by a Google(1),cut down by a Hair(1)
91  Magic User  Cleric  Human  5  0  3.60  3.0  7.0  40.0  0.0  6.80  2.40  327.20  cut down by a Frank(1),cut down by a Google(1),cut down by a Gremlin(1)
92  Magic User  Apprentice  Fridgian  5  0  3.60  3.0  6.0  20.0  0.0  8.80  2.80  406.00  starved in the dark(2),cut down by a Google(1),cut down by a Herman(1)
93  Magic User  Apprentice  Troll  5  0  3.60  3.0  6.0  20.0  0.0  10.80  3.40  397.00  cut down by a Drarl(1),cut down by a Ghoul(1),cut down by a Google(1)
94  Thief  Cutthroat  Troll  5  0  3.60  3.0  6.0  20.0  0.0  10.00  2.40  388.20  starved in the dark(2),cut down by a Drarl(1),cut down by a Rinkle(1)
95  Thief  Pilfer  Troll  5  0  3.60  3.0  5.0  20.0  0.0  10.00  2.40  410.40  cut down by a Poltergeist(2),starved in the dark(2),cut down by a Blumble(1)
96  Magic User  Sorcerer  Dwarven  5  0  3.60  3.0  7.0  20.0  0.0  10.60  2.40  438.40  cut down by a China Wolf(1),cut down by a Dante(1),cut down by a Djinni(1)
97  Thief  Cat Burglar  Fridgian  5  0  3.40  4.0  5.0  20.0  0.0  7.80  2.00  325.60  cut down by a Dante(1),cut down by a Gremlin(1),cut down by a Krupke(1)
98  Fighter  Guard  Dwarven  5  0  3.40  4.0  5.0  20.0  0.0  8.80  2.80  368.00  cut down by a Drat(1),cut down by a Herman(1),cut down by a Shadow(1)
99  Thief  Pickpocket  Fridgian  5  0  3.40  4.0  5.0  20.0  0.0  8.00  2.40  333.00  cut down by a Rinkle(2),cut down by a Poltergeist(1),starved in the dark(1)
100  Magic User  Apprentice  Human  5  0  3.40  3.0  5.0  40.0  0.0  7.40  2.60  363.00  cut down by a Blumble(1),cut down by a Drake(1),cut down by a Hair(1)
101  Fighter  Bard  Troll  5  0  3.40  3.0  5.0  20.0  0.0  6.00  2.00  386.00  cut down by a Philly(1),cut down by a Shadow(1),cut down by a Skeleton(1)
102  Thief  Pickpocket  Wilmsry  5  0  3.40  3.0  5.0  20.0  0.0  5.00  2.20  403.40  cut down by a Poltergeist(1),cut down by a Rinkle(1),cut down by a Werebeast(1)
103  Thief  Pilfer  Elven  5  0  3.40  3.0  7.0  20.0  0.0  6.60  2.40  387.40  cut down by a Drarl(1),cut down by a Ned(1),cut down by a Stink Bug(1)
104  Fighter  Woodsman  Human  5  0  3.40  3.0  4.0  0.0  0.0  8.80  2.80  374.80  cut down by a Poltergeist(2),cut down by a Frank(1),cut down by a Stink Bug(1)
105  Magic User  Court Mage  Dwarven  5  0  3.20  4.0  5.0  20.0  0.0  7.60  2.00  295.00  cut down by a Dante(1),cut down by a Gremlin(1),cut down by a Hobgoblin(1)
106  Magic User  Summoner  Elven  5  0  3.20  4.0  5.0  20.0  0.0  8.00  2.00  373.60  cut down by a Werebeast(2),cut down by a Gremlin(1),cut down by a Skeleton(1)
107  Magic User  Summoner  Troll  5  0  3.20  4.0  4.0  0.0  0.0  9.60  2.20  411.60  cut down by a Blumble(1),cut down by a Google(1),cut down by a Gremlin(1)
108  Fighter  Barbarian  Elven  5  0  3.20  3.0  6.0  20.0  0.0  9.60  2.00  333.60  cut down by a Cave Bear(2),cut down by a Skeleton(1),cut down by a Sterling(1)
109  Fighter  Bard  Elven  5  0  3.20  3.0  5.0  20.0  0.0  9.60  2.80  345.80  cut down by a Poltergeist(2),came up short on a leap(1),cut down by a Drake(1)
110  Fighter  Master of Arms  Elven  5  0  3.20  3.0  6.0  20.0  0.0  10.40  2.60  375.80  cut down by a Cave Bear(1),cut down by a China Wolf(1),cut down by a Poltergeist(1)
111  Fighter  Woodsman  Elven  5  0  3.20  3.0  5.0  20.0  0.0  4.60  2.20  322.40  cut down by a Blumble(1),cut down by a China Wolf(1),cut down by a Goblin(1)
112  Fighter  Guard  Human  5  0  3.20  3.0  4.0  0.0  0.0  9.80  2.40  387.60  came up short on a leap(1),cut down by a Poltergeist(1),cut down by a Shadow(1)
113  Fighter  Samurai  Human  5  0  3.20  3.0  4.0  0.0  0.0  12.60  2.60  345.40  cut down by a Frank(1),cut down by a Ghoul(1),cut down by a Poltergeist(1)
114  Magic User  Summoner  Wilmsry  5  0  3.20  2.0  5.0  40.0  0.0  3.40  1.80  343.60  cut down by a Gremlin(1),cut down by a M&M(1),cut down by a Philly(1)
115  Thief  Cat Burglar  Human  5  0  3.00  3.0  5.0  20.0  0.0  8.80  2.20  338.20  cut down by a Drat(1),cut down by a Gremlin(1),fell off a wall(1)
116  Magic User  Wizard  Dwarven  5  0  3.00  3.0  6.0  20.0  0.0  5.40  2.00  337.20  cut down by a Gremlin(2),cut down by a Blumble(1),cut down by a Poltergeist(1)
117  Thief  Pickpocket  Elven  5  0  3.00  3.0  4.0  0.0  0.0  7.80  2.20  384.00  cut down by a Flube(1),cut down by a Google(1),cut down by a Rinkle(1)
118  Magic User  Warlock  Elven  5  0  3.00  3.0  4.0  0.0  0.0  9.40  2.40  382.60  cut down by a Poltergeist(2),cut down by a Trachea(1),cut down by a Wolf(1)
119  Magic User  Cleric  Dwarven  5  0  2.80  3.0  5.0  20.0  0.0  8.40  2.00  274.00  cut down by a Blumble(1),cut down by a China Wolf(1),cut down by a Google(1)
120  Thief  Pickpocket  Human  5  0  2.80  3.0  5.0  20.0  0.0  7.80  1.80  327.80  cut down by a Philly(1),cut down by a Werebeast(1),cut down by a Zit(1)
121  Thief  Con Artist  Fridgian  5  0  2.80  3.0  3.0  0.0  0.0  3.00  1.80  292.40  cut down by a Cave Bear(1),cut down by a Dante(1),cut down by a Gremlin(1)
122  Thief  Cutthroat  Elven  5  0  2.80  3.0  4.0  0.0  0.0  7.40  2.00  337.00  cut down by a Dante(1),cut down by a Poltergeist(1),cut down by a Rinkle(1)
123  Magic User  Illusionist  Human  5  0  2.80  3.0  4.0  0.0  0.0  7.80  2.00  283.80  cut down by a Google(1),cut down by a Philly(1),cut down by a Poltergeist(1)
124  Thief  Pickpocket  Troll  5  0  2.80  3.0  3.0  0.0  0.0  10.00  2.00  305.40  fell off a wall(2),cut down by a Rast(1),cut down by a Zit(1)
125  Thief  Con Artist  Elven  5  0  2.60  3.0  5.0  20.0  0.0  0.80  2.00  335.80  starved in the dark(3),cut down by a Philly(1),cut down by a Rinkle(1)
126  Thief  Cat Burglar  Dwarven  5  0  2.60  3.0  4.0  0.0  0.0  6.20  2.00  264.60  cut down by a Rinkle(1),cut down by a Skeleton(1),cut down by a Werebeast(1)
127  Fighter  Soldier  Elven  5  0  2.60  3.0  4.0  0.0  0.0  7.20  2.20  271.80  cut down by a Ghoul(1),cut down by a Poltergeist(1),cut down by a Sterling(1)
128  Magic User  Cleric  Elven  5  0  2.60  2.0  5.0  20.0  0.0  6.00  1.80  248.60  starved in the dark(3),cut down by a Shadow(1),fell off a wall(1)
129  Thief  Cloaker  Dwarven  5  0  2.60  2.0  5.0  20.0  0.0  7.40  1.40  343.40  fell off a wall(2),cut down by a Gremlin(1),cut down by a Werebeast(1)
130  Fighter  Woodsman  Dwarven  5  0  2.60  2.0  5.0  20.0  0.0  6.60  1.80  277.60  cut down by a Blumble(1),cut down by a Cave Bear(1),cut down by a Gremlin(1)
131  Fighter  Bard  Dwarven  5  0  2.60  2.0  4.0  0.0  0.0  8.00  1.80  306.00  cut down by a Poltergeist(2),cut down by a Blumble(1),cut down by a Dog Face(1)
132  Thief  Cloaker  Elven  5  0  2.60  2.0  4.0  0.0  0.0  6.00  2.00  304.40  cut down by a Gremlin(1),cut down by a Poltergeist(1),cut down by a Rinkle(1)
133  Thief  Cutthroat  Dwarven  5  0  2.60  2.0  4.0  0.0  0.0  8.00  1.60  320.60  cut down by a Dog Face(1),cut down by a Frank(1),cut down by a Gremlin(1)
134  Thief  Cat Burglar  Elven  5  0  2.40  3.0  4.0  0.0  0.0  6.80  2.00  216.40  undone by a trap(3),cut down by a Cave Bear(1),cut down by a Ghoul(1)
135  Magic User  Sorcerer  Elven  5  0  2.40  3.0  3.0  0.0  0.0  6.60  1.60  283.40  came up short on a leap(1),cut down by a China Wolf(1),cut down by a Drekk(1)
136  Thief  Pickpocket  Dwarven  5  0  2.40  2.0  4.0  0.0  0.0  6.80  1.80  271.20  spent by the dungeon itself(2),undone by a trap(2),cut down by a Werebeast(1)
137  Fighter  Samurai  Elven  5  0  2.40  2.0  3.0  0.0  0.0  6.00  1.80  247.60  cut down by a Cave Bear(1),cut down by a Google(1),cut down by a Poltergeist(1)
138  Magic User  Summoner  Dwarven  5  0  2.40  2.0  4.0  0.0  0.0  7.40  1.80  285.60  cut down by a Ned(2),cut down by a Rinkle(1),cut down by a Shadow(1)
139  Fighter  Guard  Elven  5  0  2.20  3.0  3.0  0.0  0.0  6.00  1.80  235.40  cut down by a Bat/Rat(1),cut down by a Blumble(1),cut down by a Google(1)
140  Magic User  Court Mage  Elven  5  0  2.20  2.0  4.0  0.0  0.0  5.20  1.40  203.80  cut down by a Drekk(2),cut down by a Philly(1),fell off a wall(1)
141  Magic User  Illusionist  Elven  5  0  2.20  2.0  4.0  0.0  0.0  4.60  1.60  229.40  cut down by a Gremlin(1),cut down by a Philly(1),cut down by a Shriek(1)
142  Magic User  Illusionist  Dwarven  5  0  2.00  2.0  3.0  0.0  0.0  5.20  1.40  212.00  cut down by a Pogo(2),cut down by a China Wolf(1),cut down by a Google(1)
143  Magic User  Apprentice  Dwarven  5  0  2.00  1.0  5.0  20.0  0.0  4.60  2.00  220.40  cut down by a Hobgoblin(2),came up short on a leap(1),cut down by a Craig(1)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Fighter  235  0  3.91  4.0  5.0  31.9  0.4  8.94  2.69  425.72  cut down by a Werebeast(28),cut down by a Poltergeist(25),fell off a wall(19)
Thief  240  0  3.88  4.0  6.0  27.9  0.4  8.72  2.58  424.41  starved in the dark(24),fell off a wall(22),cut down by a Werebeast(21)
Magic User  240  0  3.61  4.0  6.0  29.2  0.0  9.04  2.52  408.01  fell off a wall(19),cut down by a Werebeast(17),cut down by a Gremlin(14)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Ninja  30  0  5.03  5.0  7.0  56.7  3.3  14.20  3.50  517.13  cut down by a Rinkle(3),cut down by a Undead(3),cut down by a Werebeast(3)
Acrobat  30  0  4.30  4.0  6.0  33.3  0.0  11.13  3.07  451.97  cut down by a Werebeast(8),fell off a wall(4),cut down by a Frank(2)
Knight  30  0  4.20  4.0  5.0  36.7  0.0  4.73  2.63  452.90  fell off a wall(5),cut down by a Cave Bear(4),cut down by a Poltergeist(4)
Master of Arms  30  0  4.03  4.0  6.0  26.7  0.0  11.57  3.00  449.40  cut down by a Poltergeist(4),cut down by a Drake(3),cut down by a Herman(3)
Soldier  30  0  4.03  4.0  6.0  26.7  0.0  9.03  2.93  433.70  cut down by a Werebeast(5),cut down by a Poltergeist(3),cut down by a Rinkle(3)
Pilfer  30  0  4.00  4.0  7.0  30.0  0.0  8.50  2.50  455.37  cut down by a Poltergeist(6),starved in the dark(4),cut down by a Drarl(2)
Warlock  30  0  4.00  4.0  7.0  30.0  0.0  11.67  2.90  492.67  cut down by a Werebeast(4),cut down by a Cave Bear(3),cut down by a Trachea(3)
Barbarian  30  0  3.97  4.0  5.0  46.7  0.0  11.10  2.43  444.97  cut down by a Cave Bear(3),cut down by a Werebeast(3),fell off a wall(3)
Bard  30  0  3.97  4.0  6.0  40.0  3.3  9.13  2.63  428.10  cut down by a Poltergeist(6),cut down by a Werebeast(5),cut down by a Philly(2)
Con Artist  30  0  3.97  4.0  7.0  33.3  0.0  2.37  2.33  454.77  starved in the dark(5),came up short on a leap(4),spent by the dungeon itself(4)
Sorcerer  30  0  3.93  4.0  6.0  33.3  0.0  11.40  2.67  465.63  cut down by a China Wolf(3),came up short on a leap(2),cut down by a Gremlin(2)
Wizard  30  0  3.87  4.0  6.0  30.0  0.0  8.47  2.67  476.87  cut down by a Gremlin(4),cut down by a Drat(3),fell off a wall(3)
Cloaker  30  0  3.80  4.0  6.0  26.7  0.0  8.83  2.47  425.87  fell off a wall(5),cut down by a Blumble(3),cut down by a Poltergeist(3)
Woodsman  30  0  3.77  4.0  5.0  33.3  0.0  6.70  2.60  386.43  cut down by a Blumble(5),cut down by a Werebeast(5),cut down by a Poltergeist(3)
Court Mage  30  0  3.67  4.0  5.0  40.0  0.0  9.60  2.53  355.73  fell off a wall(5),cut down by a Blumble(2),cut down by a Craig(2)
Guard  30  0  3.67  4.0  5.0  20.0  0.0  8.77  2.60  412.33  fell off a wall(4),cut down by a Werebeast(3),cut down by a Bat/Rat(2)
Samurai  25  0  3.64  4.0  5.0  24.0  0.0  10.80  2.72  392.36  cut down by a Sterling(3),cut down by a Ghoul(2),cut down by a Poltergeist(2)
Cutthroat  30  0  3.60  3.0  6.0  10.0  0.0  8.83  2.37  409.07  starved in the dark(4),cut down by a Poltergeist(3),fell off a wall(3)
Summoner  30  0  3.50  4.0  6.0  23.3  0.0  8.57  2.37  429.10  cut down by a Werebeast(5),cut down by a Gremlin(4),spent by the dungeon itself(3)
Cleric  30  0  3.43  3.0  6.0  33.3  0.0  7.50  2.23  337.57  fell off a wall(5),starved in the dark(4),undone by a trap(3)
Cat Burglar  30  0  3.40  4.0  5.0  23.3  0.0  8.33  2.37  343.63  undone by a trap(8),fell off a wall(4),cut down by a Ghoul(2)
Apprentice  30  0  3.30  3.0  6.0  26.7  0.0  7.73  2.70  366.80  cut down by a Hobgoblin(3),starved in the dark(3),cut down by a China Wolf(2)
Illusionist  30  0  3.20  3.0  5.0  16.7  0.0  7.37  2.07  339.73  cut down by a Philly(4),cut down by a Google(3),cut down by a Dante(2)
Pickpocket  30  0  2.97  3.0  5.0  10.0  0.0  7.57  2.07  337.47  cut down by a Rinkle(4),starved in the dark(4),undone by a trap(4)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Wilmsry  120  0  4.68  5.0  7.0  51.7  1.7  7.53  2.78  519.28  cut down by a Werebeast(15),fell off a wall(8),cut down by a Poltergeist(6)
Fridgian  115  0  4.05  4.0  5.0  30.4  0.0  10.10  2.80  435.58  cut down by a Werebeast(14),cut down by a Dante(7),fell off a wall(7)
Troll  120  0  4.03  4.0  6.0  35.8  0.0  10.00  2.77  441.76  starved in the dark(20),fell off a wall(16),cut down by a Poltergeist(10)
Human  120  0  3.86  4.0  6.0  32.5  0.0  10.04  2.75  428.53  cut down by a Werebeast(15),cut down by a Poltergeist(12),fell off a wall(9)
Dwarven  120  0  3.24  3.0  5.0  16.7  0.0  8.30  2.30  359.96  fell off a wall(11),cut down by a Gremlin(10),undone by a trap(9)
Elven  120  0  2.96  3.0  5.0  10.8  0.0  7.48  2.19  331.58  cut down by a Poltergeist(11),undone by a trap(10),fell off a wall(9)

POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  top causes
715  0  3.80  4.0  6.0  29.7  0.3  0.0  8.90  2.60  419.34  cut down by a Werebeast(66),fell off a wall(60),cut down by a Poltergeist(51)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 715 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=5  workers=4  startDepth=1
```

#### Reading (BEFORE → AFTER)

| Metric | BEFORE (d5d8c10, phase start) | AFTER (608a0e5, initiative once) |
|---|---|---|
| Solo death-depth min/p50/p90/max | 1 / 4 / 5 / 7 | 1 / 4 / 6 / 9 |
| Solo action-count p50 | 354 | 425 |
| Party death-depth min/p50/p90/max | 1 / 4 / 6 / 14 | 1 / 5 / 7 / 9 |
| Party action-count p50 | 535 | 648 |
| Solo top 3 death causes | starved in the dark 20 (10.0%); cut down by a Werebeast 18 (9.0%); cut down by a Poltergeist 16 (8.0%) | fell off a wall 14 (7.0%); starved in the dark 14 (7.0%); undone by a trap 13 (6.5%) |
| Party top 3 death causes | starved in the dark 23 (11.5%); fell off a wall 16 (8.0%); cut down by a Werebeast 14 (7.0%) | starved in the dark 15 (7.5%); fell off a wall 14 (7.0%); cut down by a Werebeast 9 (4.5%) |
| Party stuck (hit maxActions) | 56 of 200 | 68 of 200 |
| Class smoke overall mean depth (pooled, 715 runs) | 3.44 | 3.80 |
| Class smoke overall mean depth (mean of 143 cell means) | 3.438 | 3.803 |
| 3 largest movers UP (cell mean depth) | — | Thief Cloaker Troll 2.8→5.0 (+2.20); Magic User Summoner Fridgian 2.8→4.8 (+2.00); Magic User Apprentice Elven 1.6→3.6 (+2.00) |
| 3 largest movers DOWN (cell mean depth) | — | Thief Pickpocket Wilmsry 5.0→3.4 (−1.60); Fighter Barbarian Wilmsry 5.4→4.0 (−1.40); Magic User Summoner Wilmsry 4.6→3.2 (−1.40) |

Every readout moves in the expected direction for "the foe never gets two
turns back to back": solo and party median/p90 death depth rise (fewer
consecutive foe turns means less cumulative incoming damage per exchange, so
the bot survives a bit longer before the same causes catch it), action
counts rise proportionally (more of the same fights survived a round or two
longer), and the class-smoke pooled/mean-of-means depth both rise by roughly
0.35–0.4. The per-cell movers are noisy at n=5 seeds/cell (a smoke, not a
gate) — no single sub/race combination is flagged as newly broken or newly
dominant; the top-cause tables stay dominated by the same handful of names
(Werebeast, Poltergeist, environmental causes), just redistributed slightly.
This is read in the tuning-proxy register only: no constant changes here:
Phase 52's foe-attack-cadence work and Phase 54's four-band retune are
measured on top of this baseline, not against the original BEFORE numbers.

### v1.7 · Phase 52 — cadence & damage curve

**Rule change:** (a) cadence is UNCHANGED and now pinned: a plain foe makes
exactly one ordinary attack per foe turn, an `sp.atk: 2` foe exactly two,
and a frenzied foe doubles its own swing count (`swings = (frenzied?2:1) *
(sp.atk||1)`, `engine/combat.js:2373`, unchanged since before this phase);
an ability turn already replaced every swing before this phase (the ability
gate `continue`s after `resolveFoeAbility`) — pinned by
`test/unit/foe-cadence.test.js` (CAD-01/CAD-02/CAD-03) rather than changed.
(b) A foe critical hit now doubles the DAMAGE DICE only, not the whole
`lvl^2 + dmgBonus + dice` sum (`crit -> lvl^2 + dmgBonus + 2*dice`), at all
three foe-damage sites (the hero branch and member branch of
`engine/combat.js#foeTurn`, and `pursuitStrike`) via a shared
`foeLevelBase(f)` helper. (c) Herman (both Humans tiers 4 and 5) carries
`sp.strikesAs: 5` in place of the old flat `dmg: {n:0,sides:0,bonus:25}`
notation — his rulebook note "strikes as a level five" is now exactly what
the code does. (d) The checkpoint ruling on every row the AFTER
damage-curve audit still flags after (b)/(c): NO dice trims land in this
phase — every still-flagged row gets an explicit per-row ruling instead
(tier-5 rows: "left as a deliberate deep-tier threat (Endgame band)"; tier
2-4 rows: "curve height — a Phase 54 dial (four-band retune), not a Phase
52 cliff"), recorded in `content/BESTIARY-REBALANCE.md`'s Phase 52
addendum (its `#### Still flagged after the fixes (rule=dice) — ruled`
table, with a `Disposition` cell on every one of its 65 rows).

**Parameters (identical BEFORE/AFTER):**
- `node tools/tune-difficulty.mjs --seeds=200` (solo)
- `node tools/tune-difficulty.mjs --seeds=200 --party`
- `node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p51-after-smoke.json` (BEFORE, reused by reference) / `v17-p52-after-smoke.json` (AFTER)

#### BEFORE — by reference: Phase 51 AFTER, commit 608a0e58046177c1dd1f225a40c3f63d402f31e1 (initiative once per fight)

BEFORE is not re-run — per the measurement gate (D-11), Phase 51's own
AFTER readout (commit `608a0e5`, quoted verbatim under
`### v1.7 · Phase 51 — initiative once`, `#### AFTER — commit
608a0e5804...`, above) is reused as this phase's BEFORE: solo death-depth
min/p50/p90/max 1/4/6/9, solo action-count p50 425, party death-depth
min/p50/p90/max 1/5/7/9, party action-count p50 648, class-smoke pooled
mean depth (715 runs) 3.80 (mean of 143 cell means 3.803). Same bot flags,
same seeds, same `docs/class-pass/v17-p51-after-smoke.json` file this
phase's own damage-curve audit already used as its band-level yardstick
(52-CONTEXT.md).

#### AFTER — commit 049ab5011212a8c6a4bea0f7ee4757dd1923c1b7 (crit doubles the dice; Herman strikes as a level five)

`node tools/tune-difficulty.mjs --seeds=200` (solo):

```

tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=6  max=9

Action-count distribution:
  min=36  p50=432  p90=645  max=983

Death-cause breakdown:
  fell off a wall      14 (7.0%)
  cut down by a Dante  13 (6.5%)
  cut down by a Werebeast 13 (6.5%)
  undone by a trap     13 (6.5%)
  cut down by a Poltergeist 12 (6.0%)
  starved in the dark  11 (5.5%)
  spent by the dungeon itself 9 (4.5%)
  cut down by a Philly 8 (4.0%)
  came up short on a leap 8 (4.0%)
  cut down by a Rinkle 8 (4.0%)
  cut down by a Drarl  8 (4.0%)
  cut down by a Blumble 7 (3.5%)
  cut down by a Frank  6 (3.0%)
  cut down by a Drake  4 (2.0%)
  cut down by a Shadow 4 (2.0%)
  cut down by a Trachea 4 (2.0%)
  cut down by a Gremlin 4 (2.0%)
  cut down by a Skeleton 4 (2.0%)
  cut down by a Cave Bear 3 (1.5%)
  cut down by a Primp  3 (1.5%)
  cut down by a Dog Face 3 (1.5%)
  cut down by a Craig  3 (1.5%)
  cut down by a Zombie 3 (1.5%)
  cut down by a Herman 3 (1.5%)
  cut down by a Hair   3 (1.5%)
  cut down by a China Wolf 3 (1.5%)
  cut down by a Krupke 2 (1.0%)
  cut down by a Flube  2 (1.0%)
  cut down by a Djinni 2 (1.0%)
  cut down by a Google 2 (1.0%)
  cut down by a Ghost  2 (1.0%)
  cut down by a Drekk  2 (1.0%)
  cut down by a Undead 2 (1.0%)
  cut down by a Stalka Beast 1 (0.5%)
  cut down by a Rast   1 (0.5%)
  cut down by a Viper  1 (0.5%)
  cut down by a Zit    1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)
  cut down by a Spectre 1 (0.5%)
  cut down by a Pogo   1 (0.5%)
  cut down by a Stink Bug 1 (0.5%)
  cut down by a M&M    1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Drat   1 (0.5%)
  cut down by a Ghoul  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=296  successes=186 (62.8%)  failures=110  refused=0  exhausted=0
  runs with >=1 attempt: 65 of 200
  SP from parley: 2586 of 126539 total SP (2.0%)

Reach table (% of runs reaching floor N):
  >=5: 33.0%  >=10: 0.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=33  p50=106  p90=145  max=187

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 55/1965 (2.8%)
  6-10: 35/78 (44.9%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=138  foeBolted=44  foeDrained=2  foeDebuffed=19  foeHealed=0  foeSummoned=0
  heroResisted=61  heroResistFailed=16
  ability damage: 256 of 15573 total damage taken (1.6%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 200 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

`node tools/tune-difficulty.mjs --seeds=200 --party`:

```

tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=5  p90=7  max=12

Action-count distribution:
  min=21  p50=703  p90=20000  max=20000

Death-cause breakdown:
  starved in the dark  16 (8.0%)
  cut down by a Werebeast 9 (4.5%)
  fell off a wall      9 (4.5%)
  undone by a trap     8 (4.0%)
  came up short on a leap 6 (3.0%)
  cut down by a Drarl  6 (3.0%)
  cut down by a Drake  5 (2.5%)
  cut down by a Blumble 4 (2.0%)
  cut down by a Primp  4 (2.0%)
  spent by the dungeon itself 4 (2.0%)
  cut down by a Dante  4 (2.0%)
  cut down by a Ghost  4 (2.0%)
  cut down by a Spectre 3 (1.5%)
  cut down by a Ghoul  3 (1.5%)
  cut down by a Gremlin 3 (1.5%)
  cut down by a Craig  3 (1.5%)
  cut down by a Herman 3 (1.5%)
  cut down by a Drudge 3 (1.5%)
  cut down by a Google 3 (1.5%)
  cut down by a Drekk  2 (1.0%)
  cut down by a Frank  2 (1.0%)
  cut down by a Dread Lock 2 (1.0%)
  cut down by a Vampire 2 (1.0%)
  cut down by a Poltergeist 2 (1.0%)
  cut down by a Trachea 2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Zit    2 (1.0%)
  cut down by a Djinni 2 (1.0%)
  cut down by a Undead 2 (1.0%)
  cut down by a Rinkle 1 (0.5%)
  cut down by a Wolf   1 (0.5%)
  cut down by a Philly 1 (0.5%)
  cut down by a Sterling 1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=361  successes=231 (64.0%)  failures=130  refused=0  exhausted=0
  runs with >=1 attempt: 74 of 200
  SP from parley: 4123 of 137954 total SP (3.0%)

Reach table (% of runs reaching floor N):
  >=5: 62.4%  >=10: 0.8%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=21  p50=104  p90=133  max=166

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 50/2111 (2.4%)
  6-10: 52/193 (26.9%)
  11-20: 1/4 (25.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=141  foeBolted=78  foeDrained=3  foeDebuffed=13  foeHealed=0  foeSummoned=0
  heroResisted=37  heroResistFailed=12
  ability damage: 231 of 8210 total damage taken (2.8%)

Party (--party, D-12/D-20):
  member forced at run start in 192/200 runs; member alive at run end: 153 (76.5%)

Stuck: 75 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 125 dead, 75 stuck (hit maxActions=20000; excluded from depth stats)
```

`node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p52-after-smoke.json` (stdout — the ranked matrix; stderr's elapsed line `elapsed: 106.8s  workers=4  runs=715` is not quoted, per this ledger's own convention):

```
tune-classes: 143 cells x 5 seeds (715 runs) — start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
1  Thief  Con Artist  Wilmsry  5  0  6.80  7.0  10.0  80.0  20.0  2.80  3.60  731.20  came up short on a leap(3),cut down by a Drarl(1),starved in the dark(1)
2  Thief  Ninja  Wilmsry  5  0  6.20  6.0  8.0  100.0  0.0  15.80  3.60  635.60  cut down by a Blumble(1),cut down by a Djinni(1),cut down by a Drake(1)
3  Thief  Acrobat  Wilmsry  5  0  6.00  6.0  8.0  100.0  0.0  7.40  3.20  617.60  cut down by a Werebeast(2),cut down by a Rinkle(1),cut down by a Wolf(1)
4  Fighter  Knight  Wilmsry  5  0  5.80  6.0  7.0  80.0  0.0  4.00  3.20  617.20  cut down by a Blumble(3),cut down by a Djinni(1),cut down by a Werebeast(1)
5  Thief  Cloaker  Wilmsry  5  0  5.60  6.0  9.0  60.0  0.0  10.20  3.40  630.60  cut down by a Craig(1),cut down by a Drake(1),cut down by a Poltergeist(1)
6  Magic User  Warlock  Dwarven  5  0  5.60  4.0  9.0  40.0  0.0  17.00  3.80  693.80  cut down by a Cave Bear(1),cut down by a Djinni(1),cut down by a Rinkle(1)
7  Thief  Ninja  Human  5  0  5.40  5.0  8.0  80.0  0.0  12.80  3.60  562.80  cut down by a Drarl(1),cut down by a Drudge(1),cut down by a Primp(1)
8  Thief  Cutthroat  Wilmsry  5  0  5.40  5.0  9.0  60.0  0.0  8.60  3.40  580.40  cut down by a Shadow(1),cut down by a Undead(1),cut down by a Vampire(1)
9  Thief  Ninja  Troll  5  0  5.20  6.0  6.0  60.0  0.0  16.20  3.60  573.40  cut down by a Blumble(1),cut down by a Craig(1),cut down by a Drudge(1)
10  Fighter  Bard  Wilmsry  5  0  5.20  5.0  7.0  80.0  0.0  11.20  3.20  585.40  cut down by a Frank(1),cut down by a Poltergeist(1),cut down by a Primp(1)
11  Thief  Ninja  Dwarven  5  0  5.20  5.0  7.0  60.0  0.0  10.80  3.40  490.00  cut down by a Primp(2),cut down by a Drake(1),cut down by a Ghost(1)
12  Magic User  Warlock  Wilmsry  5  0  5.20  4.0  9.0  40.0  0.0  10.60  3.00  719.60  cut down by a Drudge(1),cut down by a Philly(1),cut down by a Poltergeist(1)
13  Fighter  Woodsman  Wilmsry  5  0  5.00  5.0  6.0  80.0  0.0  6.60  3.00  568.20  cut down by a Blumble(1),cut down by a Werebeast(1),cut down by a Zit(1)
14  Thief  Con Artist  Dwarven  5  0  5.00  5.0  7.0  60.0  0.0  1.80  3.00  549.00  cut down by a Werebeast(2),cut down by a Dante(1),fell off a wall(1)
15  Magic User  Court Mage  Fridgian  5  0  5.00  5.0  8.0  60.0  0.0  17.40  3.60  482.00  cut down by a Bones(1),cut down by a Djinni(1),cut down by a Flube(1)
16  Thief  Pilfer  Wilmsry  5  0  5.00  5.0  7.0  60.0  0.0  8.20  3.20  545.00  cut down by a Ghoul(2),cut down by a Poltergeist(1),cut down by a Stink Bug(1)
17  Magic User  Warlock  Troll  5  0  4.80  6.0  7.0  60.0  0.0  13.20  3.40  555.20  starved in the dark(2),cut down by a Drake(1),cut down by a Herman(1)
18  Fighter  Knight  Fridgian  5  0  4.80  5.0  5.0  80.0  0.0  6.80  3.00  511.80  cut down by a Frank(3),cut down by a Cave Bear(1),cut down by a Rinkle(1)
19  Magic User  Warlock  Fridgian  5  0  4.80  5.0  5.0  80.0  0.0  12.00  3.40  561.20  cut down by a Werebeast(2),cut down by a Drarl(1),cut down by a Spectre(1)
20  Magic User  Wizard  Fridgian  5  0  4.80  5.0  6.0  80.0  0.0  7.00  3.00  535.20  cut down by a Drake(2),cut down by a Gremlin(1),cut down by a Zombie(1)
21  Thief  Cat Burglar  Wilmsry  5  0  4.80  5.0  7.0  60.0  0.0  5.80  2.80  505.20  cut down by a Rinkle(2),undone by a trap(2),cut down by a Drudge(1)
22  Thief  Con Artist  Human  5  0  4.80  5.0  7.0  60.0  0.0  2.20  3.00  551.40  fell off a wall(2),came up short on a leap(1),cut down by a Ghoul(1)
23  Fighter  Knight  Human  5  0  4.80  5.0  6.0  60.0  0.0  9.00  4.00  519.20  cut down by a Werebeast(2),cut down by a Bones(1),cut down by a Drarl(1)
24  Thief  Ninja  Fridgian  5  0  4.80  5.0  6.0  60.0  0.0  13.20  3.40  527.60  cut down by a Rinkle(2),cut down by a Drake(1),cut down by a Frank(1)
25  Fighter  Woodsman  Troll  5  0  4.80  5.0  7.0  60.0  0.0  6.60  3.00  437.00  cut down by a Werebeast(2),starved in the dark(2),cut down by a Blumble(1)
26  Thief  Acrobat  Dwarven  5  0  4.80  4.0  7.0  40.0  0.0  15.00  3.20  492.20  cut down by a Google(1),cut down by a Stink Bug(1),cut down by a Trachea(1)
27  Fighter  Bard  Fridgian  5  0  4.80  4.0  6.0  40.0  0.0  7.20  3.40  464.80  cut down by a Drarl(1),cut down by a Rinkle(1),cut down by a Spectre(1)
28  Magic User  Illusionist  Troll  5  0  4.80  4.0  9.0  40.0  0.0  10.20  2.80  512.80  cut down by a Cave Bear(1),cut down by a Drat(1),cut down by a Dread Lock(1)
29  Fighter  Soldier  Human  5  0  4.80  4.0  7.0  40.0  0.0  11.20  3.80  591.20  cut down by a Frank(1),cut down by a Hair(1),fell off a wall(1)
30  Fighter  Barbarian  Troll  5  0  4.60  5.0  5.0  80.0  0.0  11.80  2.80  475.80  cut down by a Blumble(1),cut down by a Frank(1),cut down by a Poltergeist(1)
31  Fighter  Guard  Troll  5  0  4.60  5.0  5.0  60.0  0.0  9.60  3.40  534.00  starved in the dark(2),cut down by a Craig(1),cut down by a Ghost(1)
32  Thief  Cloaker  Troll  5  0  4.60  4.0  6.0  40.0  0.0  12.40  3.20  484.20  starved in the dark(3),cut down by a Blumble(1),fell off a wall(1)
33  Magic User  Sorcerer  Fridgian  5  0  4.60  4.0  6.0  40.0  0.0  15.60  3.20  483.00  cut down by a Werebeast(2),cut down by a Frank(1),cut down by a Undead(1)
34  Magic User  Sorcerer  Human  5  0  4.60  4.0  6.0  40.0  0.0  14.40  3.40  585.00  cut down by a Rast(1),cut down by a Spectre(1),cut down by a Trachea(1)
35  Fighter  Woodsman  Fridgian  5  0  4.60  4.0  7.0  40.0  0.0  7.00  3.00  442.60  cut down by a Rinkle(2),cut down by a Frank(1),cut down by a Poltergeist(1)
36  Magic User  Sorcerer  Dwarven  5  0  4.40  6.0  7.0  60.0  0.0  14.00  3.20  527.80  cut down by a China Wolf(1),cut down by a Dread Lock(1),cut down by a Frank(1)
37  Thief  Cloaker  Human  5  0  4.40  5.0  5.0  60.0  0.0  11.00  3.00  487.60  starved in the dark(2),came up short on a leap(1),cut down by a Poltergeist(1)
38  Thief  Con Artist  Troll  5  0  4.40  5.0  5.0  60.0  0.0  3.20  2.60  488.80  starved in the dark(3),cut down by a Poltergeist(1),cut down by a Rast(1)
39  Magic User  Warlock  Human  5  0  4.40  5.0  6.0  60.0  0.0  14.60  3.20  507.40  cut down by a Philly(1),cut down by a Rinkle(1),cut down by a Spectre(1)
40  Thief  Acrobat  Fridgian  5  0  4.40  4.0  5.0  40.0  0.0  12.40  3.20  459.20  cut down by a Craig(1),cut down by a Frank(1),cut down by a Poltergeist(1)
41  Fighter  Barbarian  Fridgian  5  0  4.40  4.0  7.0  40.0  0.0  12.60  2.60  528.20  came up short on a leap(2),cut down by a Cave Bear(1),cut down by a Drarl(1)
42  Thief  Cat Burglar  Troll  5  0  4.40  4.0  6.0  40.0  0.0  14.00  3.40  502.00  cut down by a Bones(1),cut down by a Drake(1),cut down by a Rinkle(1)
43  Magic User  Court Mage  Dwarven  5  0  4.40  4.0  8.0  40.0  0.0  11.20  2.60  441.60  cut down by a Dante(1),cut down by a Hobgoblin(1),cut down by a Shriek(1)
44  Fighter  Guard  Wilmsry  5  0  4.40  4.0  7.0  40.0  0.0  7.00  2.20  486.00  cut down by a Bat/Rat(1),cut down by a Dante(1),cut down by a Werebeast(1)
45  Fighter  Master of Arms  Troll  5  0  4.40  4.0  6.0  40.0  0.0  8.80  3.00  454.40  cut down by a Poltergeist(2),cut down by a Herman(1),fell off a wall(1)
46  Fighter  Soldier  Troll  5  0  4.40  4.0  5.0  40.0  0.0  9.00  3.00  404.80  cut down by a Bones(1),cut down by a Frank(1),cut down by a Poltergeist(1)
47  Magic User  Wizard  Troll  5  0  4.40  4.0  7.0  40.0  0.0  11.20  3.20  511.20  cut down by a Herman(1),cut down by a Primp(1),cut down by a Rinkle(1)
48  Fighter  Barbarian  Human  5  0  4.20  4.0  5.0  40.0  0.0  18.20  2.80  499.40  cut down by a Blumble(1),cut down by a Dante(1),cut down by a Frank(1)
49  Fighter  Bard  Human  5  0  4.20  4.0  6.0  40.0  0.0  10.80  3.00  466.00  cut down by a Werebeast(2),cut down by a Philly(1),cut down by a Poltergeist(1)
50  Fighter  Samurai  Wilmsry  5  0  4.20  4.0  5.0  40.0  0.0  10.60  2.60  460.40  cut down by a China Wolf(2),cut down by a Werebeast(2),cut down by a Rinkle(1)
51  Fighter  Soldier  Wilmsry  5  0  4.20  4.0  6.0  40.0  0.0  4.80  2.60  427.20  cut down by a Poltergeist(1),cut down by a Rinkle(1),cut down by a Werebeast(1)
52  Magic User  Sorcerer  Troll  5  0  4.20  4.0  6.0  40.0  0.0  13.00  3.00  460.60  cut down by a Blumble(1),cut down by a Floater(1),cut down by a Poltergeist(1)
53  Magic User  Wizard  Wilmsry  5  0  4.20  4.0  7.0  40.0  0.0  4.40  2.60  522.80  cut down by a Drarl(1),cut down by a Gremlin(1),cut down by a Primp(1)
54  Thief  Acrobat  Human  5  0  4.20  4.0  6.0  20.0  0.0  14.60  3.20  433.20  cut down by a Werebeast(2),cut down by a Herman(1),cut down by a Sterling(1)
55  Thief  Cloaker  Elven  5  0  4.20  4.0  5.0  20.0  0.0  9.40  2.80  468.20  cut down by a Poltergeist(1),cut down by a Primp(1),cut down by a Rinkle(1)
56  Magic User  Cleric  Troll  5  0  4.00  5.0  5.0  60.0  0.0  8.60  2.60  450.00  fell off a wall(2),cut down by a Gremlin(1),cut down by a Poltergeist(1)
57  Magic User  Court Mage  Human  5  0  4.00  5.0  6.0  60.0  0.0  10.40  2.80  401.80  fell off a wall(3),cut down by a Craig(1),cut down by a Drarl(1)
58  Magic User  Illusionist  Wilmsry  5  0  4.00  5.0  5.0  60.0  0.0  6.60  2.40  455.80  cut down by a Google(1),cut down by a M&M(1),cut down by a Primp(1)
59  Magic User  Wizard  Human  5  0  4.00  5.0  6.0  60.0  0.0  9.00  2.60  431.00  cut down by a Blumble(1),cut down by a Gremlin(1),cut down by a Sterling(1)
60  Magic User  Cleric  Wilmsry  5  0  4.00  4.0  7.0  40.0  0.0  5.40  2.40  397.80  fell off a wall(2),came up short on a leap(1),cut down by a Dante(1)
61  Fighter  Master of Arms  Fridgian  5  0  4.00  4.0  5.0  40.0  0.0  11.40  3.20  435.80  cut down by a China Wolf(1),cut down by a Craig(1),cut down by a Drake(1)
62  Thief  Pilfer  Human  5  0  4.00  4.0  5.0  40.0  0.0  8.00  2.40  402.40  cut down by a Blumble(1),cut down by a Primp(1),cut down by a Rinkle(1)
63  Fighter  Samurai  Dwarven  5  0  4.00  4.0  5.0  40.0  0.0  12.20  3.40  404.60  cut down by a Craig(1),cut down by a Floater(1),cut down by a Sterling(1)
64  Magic User  Apprentice  Wilmsry  5  0  4.00  4.0  5.0  20.0  0.0  6.00  2.60  418.40  cut down by a China Wolf(1),cut down by a Rinkle(1),cut down by a Shadow(1)
65  Fighter  Knight  Troll  5  0  4.00  4.0  5.0  20.0  0.0  2.80  2.20  375.40  cut down by a Google(2),fell off a wall(2),cut down by a Frank(1)
66  Fighter  Master of Arms  Human  5  0  4.00  4.0  5.0  20.0  0.0  12.80  3.40  428.80  cut down by a Craig(1),cut down by a Drake(1),cut down by a Drat(1)
67  Fighter  Master of Arms  Wilmsry  5  0  4.00  4.0  5.0  20.0  0.0  12.00  3.20  444.60  cut down by a Sterling(2),cut down by a Frank(1),cut down by a Primp(1)
68  Fighter  Soldier  Fridgian  5  0  4.00  4.0  5.0  20.0  0.0  13.60  3.20  460.80  cut down by a Werebeast(2),cut down by a Frank(1),cut down by a Rast(1)
69  Fighter  Soldier  Dwarven  5  0  4.00  4.0  4.0  0.0  0.0  10.80  3.00  474.60  cut down by a Blumble(1),cut down by a Cave Bear(1),cut down by a Frank(1)
70  Magic User  Summoner  Fridgian  5  0  4.00  4.0  4.0  0.0  0.0  10.00  2.60  456.80  cut down by a Blumble(1),cut down by a Poltergeist(1),cut down by a Werebeast(1)
71  Thief  Cutthroat  Human  5  0  4.00  3.0  7.0  20.0  0.0  11.60  2.80  459.80  cut down by a Dante(1),cut down by a Drake(1),cut down by a Shadow(1)
72  Fighter  Guard  Fridgian  5  0  4.00  3.0  7.0  20.0  0.0  11.40  3.00  475.20  cut down by a Drarl(1),cut down by a Drat(1),cut down by a Krupke(1)
73  Thief  Cutthroat  Troll  5  0  3.80  4.0  5.0  40.0  0.0  12.20  2.60  429.20  cut down by a Rinkle(2),came up short on a leap(1),cut down by a Ghost(1)
74  Fighter  Knight  Elven  5  0  3.80  4.0  5.0  40.0  0.0  3.80  2.40  414.20  came up short on a leap(1),cut down by a Flube(1),cut down by a Poltergeist(1)
75  Thief  Pickpocket  Wilmsry  5  0  3.80  4.0  5.0  40.0  0.0  5.60  2.40  428.40  fell off a wall(2),cut down by a Frank(1),cut down by a Werebeast(1)
76  Magic User  Apprentice  Human  5  0  3.80  4.0  6.0  20.0  0.0  10.60  2.80  473.20  cut down by a Blumble(1),cut down by a Krupke(1),cut down by a Rinkle(1)
77  Fighter  Barbarian  Wilmsry  5  0  3.80  4.0  6.0  20.0  0.0  7.40  2.20  476.00  cut down by a Dante(1),cut down by a Philly(1),cut down by a Primp(1)
78  Fighter  Bard  Troll  5  0  3.80  4.0  5.0  20.0  0.0  7.60  2.40  439.00  cut down by a Cave Bear(1),cut down by a Flube(1),cut down by a Philly(1)
79  Magic User  Court Mage  Troll  5  0  3.80  4.0  6.0  20.0  0.0  12.00  2.80  407.80  cut down by a Floater(1),cut down by a Werebeast(1),cut down by a Wolf(1)
80  Thief  Pilfer  Fridgian  5  0  3.80  4.0  5.0  20.0  0.0  10.40  2.40  422.60  cut down by a Frank(1),cut down by a Google(1),cut down by a Gremlin(1)
81  Thief  Pilfer  Troll  5  0  3.80  4.0  5.0  20.0  0.0  10.40  2.40  437.80  starved in the dark(2),cut down by a Cave Bear(1),cut down by a Poltergeist(1)
82  Fighter  Samurai  Troll  5  0  3.80  4.0  5.0  20.0  0.0  12.20  2.60  399.80  starved in the dark(2),cut down by a Blumble(1),cut down by a Rinkle(1)
83  Magic User  Sorcerer  Wilmsry  5  0  3.80  4.0  5.0  20.0  0.0  6.40  2.20  440.80  cut down by a China Wolf(1),cut down by a Google(1),cut down by a Gremlin(1)
84  Magic User  Summoner  Human  5  0  3.80  4.0  7.0  20.0  0.0  11.40  3.00  515.20  cut down by a China Wolf(1),cut down by a Floater(1),cut down by a Gremlin(1)
85  Magic User  Apprentice  Elven  5  0  3.80  3.0  7.0  40.0  0.0  9.60  3.20  456.40  cut down by a Blumble(1),cut down by a Djinni(1),cut down by a Hobgoblin(1)
86  Magic User  Cleric  Human  5  0  3.80  3.0  8.0  40.0  0.0  7.40  2.60  364.00  cut down by a Google(1),cut down by a Herman(1),cut down by a Vampire(1)
87  Fighter  Barbarian  Elven  5  0  3.80  3.0  8.0  20.0  0.0  10.20  2.20  411.40  cut down by a Cave Bear(2),cut down by a Drarl(1),cut down by a Skeleton(1)
88  Thief  Cloaker  Fridgian  5  0  3.80  3.0  6.0  20.0  0.0  8.60  2.60  394.60  cut down by a Dante(1),cut down by a Djinni(1),cut down by a Poltergeist(1)
89  Thief  Ninja  Elven  5  0  3.80  3.0  7.0  20.0  0.0  12.40  2.60  367.80  cut down by a Cave Bear(1),cut down by a China Wolf(1),cut down by a Drake(1)
90  Thief  Cat Burglar  Human  5  0  3.60  4.0  5.0  40.0  0.0  10.40  2.40  394.00  fell off a wall(2),cut down by a Drarl(1),cut down by a Werebeast(1)
91  Magic User  Court Mage  Wilmsry  5  0  3.60  4.0  5.0  40.0  0.0  7.00  2.20  333.80  cut down by a Dante(1),cut down by a Frank(1),cut down by a Ned(1)
92  Thief  Pickpocket  Fridgian  5  0  3.60  4.0  5.0  40.0  0.0  6.40  2.40  316.40  cut down by a Rinkle(2),cut down by a Blumble(1),spent by the dungeon itself(1)
93  Magic User  Apprentice  Troll  5  0  3.60  4.0  6.0  20.0  0.0  10.40  3.00  433.60  cut down by a Drarl(1),cut down by a Gremlin(1),cut down by a Werebeast(1)
94  Magic User  Cleric  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  9.40  2.20  374.20  cut down by a China Wolf(1),cut down by a Primp(1),cut down by a Shadow(1)
95  Thief  Cutthroat  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  9.40  2.80  411.20  cut down by a Flube(1),cut down by a Ned(1),cut down by a Sterling(1)
96  Magic User  Illusionist  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  12.20  2.60  409.80  cut down by a Ghoul(1),cut down by a Philly(1),cut down by a Shriek(1)
97  Fighter  Master of Arms  Dwarven  5  0  3.60  4.0  5.0  20.0  0.0  12.40  3.20  423.80  cut down by a Werebeast(2),cut down by a Dante(1),cut down by a Poltergeist(1)
98  Fighter  Guard  Dwarven  5  0  3.60  4.0  4.0  0.0  0.0  11.00  2.60  391.60  cut down by a Dante(1),cut down by a Google(1),cut down by a Primp(1)
99  Magic User  Wizard  Elven  5  0  3.60  4.0  4.0  0.0  0.0  11.20  2.40  497.40  cut down by a Frank(1),cut down by a Rast(1),cut down by a Rinkle(1)
100  Fighter  Woodsman  Human  5  0  3.60  4.0  4.0  0.0  0.0  9.40  3.00  391.40  cut down by a Frank(1),cut down by a Ghost(1),cut down by a Poltergeist(1)
101  Thief  Acrobat  Troll  5  0  3.60  3.0  6.0  20.0  0.0  13.20  2.80  407.80  starved in the dark(3),cut down by a Drarl(1),undone by a trap(1)
102  Fighter  Woodsman  Elven  5  0  3.60  3.0  6.0  20.0  0.0  5.00  2.60  349.00  cut down by a Goblin(1),cut down by a Poltergeist(1),cut down by a Stink Bug(1)
103  Thief  Acrobat  Elven  5  0  3.40  4.0  5.0  20.0  0.0  12.20  2.80  365.40  cut down by a Werebeast(3),cut down by a Rinkle(1),fell off a wall(1)
104  Thief  Cloaker  Dwarven  5  0  3.40  4.0  5.0  20.0  0.0  6.80  1.80  383.60  cut down by a Google(1),cut down by a Gremlin(1),cut down by a Poltergeist(1)
105  Magic User  Illusionist  Human  5  0  3.40  4.0  5.0  20.0  0.0  10.80  2.60  393.80  cut down by a Blumble(1),cut down by a Djinni(1),cut down by a Philly(1)
106  Thief  Pickpocket  Dwarven  5  0  3.40  4.0  5.0  20.0  0.0  6.80  2.40  379.60  cut down by a Shadow(1),cut down by a Werebeast(1),spent by the dungeon itself(1)
107  Thief  Pilfer  Elven  5  0  3.40  4.0  5.0  20.0  0.0  8.40  2.40  410.60  cut down by a Blumble(1),cut down by a Drarl(1),cut down by a Trachea(1)
108  Fighter  Barbarian  Dwarven  5  0  3.40  3.0  5.0  20.0  0.0  9.40  2.20  339.80  cut down by a Dante(1),cut down by a Drat(1),cut down by a Werebeast(1)
109  Fighter  Bard  Elven  5  0  3.40  3.0  6.0  20.0  0.0  9.60  2.80  342.80  cut down by a Poltergeist(2),came up short on a leap(1),cut down by a Google(1)
110  Fighter  Master of Arms  Elven  5  0  3.40  3.0  6.0  20.0  0.0  9.40  3.00  363.00  cut down by a Cave Bear(1),cut down by a Poltergeist(1),cut down by a Vampire(1)
111  Thief  Pickpocket  Human  5  0  3.40  3.0  6.0  20.0  0.0  9.40  2.40  390.40  undone by a trap(2),cut down by a Floater(1),cut down by a Google(1)
112  Magic User  Summoner  Troll  5  0  3.40  3.0  6.0  20.0  0.0  8.80  2.40  429.60  cut down by a Dante(1),cut down by a Google(1),cut down by a Gremlin(1)
113  Fighter  Knight  Dwarven  5  0  3.40  3.0  4.0  0.0  0.0  6.20  2.40  421.80  fell off a wall(2),cut down by a Dante(1),cut down by a Poltergeist(1)
114  Thief  Pickpocket  Elven  5  0  3.40  3.0  4.0  0.0  0.0  9.80  2.60  394.00  cut down by a Google(2),cut down by a Werebeast(2),starved in the dark(1)
115  Magic User  Summoner  Elven  5  0  3.20  4.0  5.0  20.0  0.0  7.80  2.00  371.80  cut down by a Gremlin(1),cut down by a Rinkle(1),cut down by a Skeleton(1)
116  Thief  Con Artist  Fridgian  5  0  3.20  3.0  6.0  20.0  0.0  2.80  2.20  359.20  spent by the dungeon itself(3),cut down by a Gremlin(1),undone by a trap(1)
117  Thief  Pilfer  Dwarven  5  0  3.20  3.0  5.0  20.0  0.0  7.20  2.00  334.60  cut down by a Gremlin(1),cut down by a Hair(1),cut down by a Pogo(1)
118  Fighter  Samurai  Human  5  0  3.20  3.0  4.0  0.0  0.0  13.40  2.80  356.00  cut down by a Drarl(1),cut down by a Frank(1),cut down by a Poltergeist(1)
119  Magic User  Court Mage  Elven  5  0  3.00  4.0  5.0  20.0  0.0  7.40  2.00  256.40  cut down by a Werebeast(2),came up short on a leap(1),cut down by a Drekk(1)
120  Thief  Cat Burglar  Dwarven  5  0  3.00  4.0  4.0  0.0  0.0  8.40  2.20  306.20  undone by a trap(2),cut down by a Rinkle(1),cut down by a Sterling(1)
121  Magic User  Cleric  Dwarven  5  0  3.00  3.0  5.0  40.0  0.0  8.60  2.20  281.00  cut down by a China Wolf(1),cut down by a Drarl(1),cut down by a Google(1)
122  Magic User  Illusionist  Dwarven  5  0  3.00  3.0  6.0  20.0  0.0  6.20  1.80  346.20  cut down by a China Wolf(1),cut down by a Philly(1),cut down by a Rinkle(1)
123  Magic User  Apprentice  Fridgian  5  0  3.00  3.0  4.0  0.0  0.0  7.40  2.40  360.00  cut down by a Poltergeist(2),cut down by a Google(1),cut down by a Werebeast(1)
124  Fighter  Bard  Dwarven  5  0  3.00  3.0  4.0  0.0  0.0  8.60  2.20  326.60  cut down by a Poltergeist(3),cut down by a Rast(1),cut down by a Skeleton(1)
125  Thief  Cutthroat  Dwarven  5  0  3.00  3.0  4.0  0.0  0.0  8.40  2.40  376.80  came up short on a leap(2),cut down by a Shadow(1),cut down by a Skeleton(1)
126  Fighter  Guard  Human  5  0  3.00  3.0  4.0  0.0  0.0  8.40  2.00  370.00  cut down by a Poltergeist(2),fell off a wall(2),cut down by a Werebeast(1)
127  Magic User  Warlock  Elven  5  0  3.00  3.0  4.0  0.0  0.0  9.40  2.40  382.80  cut down by a Poltergeist(2),cut down by a Trachea(1),cut down by a Wolf(1)
128  Thief  Cat Burglar  Fridgian  5  0  2.80  4.0  4.0  0.0  0.0  7.80  2.00  284.20  undone by a trap(2),cut down by a Frank(1),cut down by a Gremlin(1)
129  Thief  Cat Burglar  Elven  5  0  2.80  3.0  5.0  20.0  0.0  7.40  2.20  249.80  undone by a trap(3),cut down by a Cave Bear(1),cut down by a Craig(1)
130  Thief  Con Artist  Elven  5  0  2.80  3.0  5.0  20.0  0.0  1.00  2.00  380.60  starved in the dark(4),cut down by a Rinkle(1)
131  Thief  Pickpocket  Troll  5  0  2.80  3.0  4.0  0.0  0.0  8.60  2.20  306.20  cut down by a Frank(1),cut down by a Rast(1),cut down by a Shriek(1)
132  Fighter  Soldier  Elven  5  0  2.80  3.0  4.0  0.0  0.0  8.00  2.20  303.00  cut down by a Cave Bear(1),cut down by a China Wolf(1),cut down by a Rinkle(1)
133  Magic User  Wizard  Dwarven  5  0  2.80  2.0  6.0  20.0  0.0  4.80  1.80  308.40  cut down by a Gremlin(2),cut down by a Blumble(1),cut down by a Philly(1)
134  Thief  Cutthroat  Elven  5  0  2.60  3.0  3.0  0.0  0.0  9.40  2.20  338.60  cut down by a Poltergeist(2),cut down by a Dante(1),cut down by a Frank(1)
135  Fighter  Guard  Elven  5  0  2.60  3.0  4.0  0.0  0.0  6.80  1.80  256.00  fell off a wall(2),cut down by a Blumble(1),cut down by a Poltergeist(1)
136  Magic User  Illusionist  Elven  5  0  2.60  3.0  4.0  0.0  0.0  6.80  1.80  299.40  cut down by a Gremlin(2),cut down by a Shriek(1),cut down by a Werebeast(1)
137  Fighter  Samurai  Elven  5  0  2.60  3.0  3.0  0.0  0.0  6.40  2.00  257.40  cut down by a Cave Bear(1),cut down by a Google(1),cut down by a Poltergeist(1)
138  Magic User  Cleric  Elven  5  0  2.60  2.0  5.0  20.0  0.0  6.20  1.80  250.40  starved in the dark(3),cut down by a Gremlin(1),fell off a wall(1)
139  Magic User  Summoner  Wilmsry  5  0  2.60  2.0  5.0  20.0  0.0  3.00  1.40  292.00  cut down by a Gremlin(2),cut down by a M&M(1),cut down by a Philly(1)
140  Fighter  Woodsman  Dwarven  5  0  2.60  2.0  5.0  20.0  0.0  6.20  1.80  281.00  cut down by a Blumble(1),cut down by a Pogo(1),cut down by a Skeleton(1)
141  Magic User  Sorcerer  Elven  5  0  2.40  3.0  3.0  0.0  0.0  6.60  1.80  278.60  came up short on a leap(1),cut down by a China Wolf(1),cut down by a Gremlin(1)
142  Magic User  Apprentice  Dwarven  5  0  2.40  2.0  5.0  20.0  0.0  4.60  2.00  235.00  cut down by a Hobgoblin(2),cut down by a Cave Bear(1),cut down by a Craig(1)
143  Magic User  Summoner  Dwarven  5  0  2.40  2.0  4.0  0.0  0.0  7.40  1.60  283.60  cut down by a Ned(2),cut down by a Dante(1),cut down by a Google(1)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Thief  240  0  4.11  4.0  6.0  36.3  0.4  9.18  2.75  446.81  starved in the dark(29),cut down by a Werebeast(23),undone by a trap(20)
Fighter  235  0  3.98  4.0  6.0  30.6  0.0  9.17  2.78  431.64  cut down by a Werebeast(30),cut down by a Poltergeist(26),cut down by a Frank(16)
Magic User  240  0  3.79  4.0  6.0  32.1  0.0  9.48  2.59  428.88  cut down by a Werebeast(21),fell off a wall(19),cut down by a Gremlin(17)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Ninja  30  0  5.10  5.0  7.0  63.3  0.0  13.53  3.37  526.20  cut down by a Drake(4),cut down by a Primp(3),cut down by a Blumble(2)
Warlock  30  0  4.63  4.0  9.0  46.7  0.0  12.80  3.20  570.00  cut down by a Poltergeist(3),cut down by a Werebeast(3),cut down by a Philly(2)
Con Artist  30  0  4.50  5.0  7.0  50.0  3.3  2.30  2.73  510.03  starved in the dark(8),came up short on a leap(4),spent by the dungeon itself(4)
Knight  30  0  4.43  4.0  6.0  46.7  0.0  5.43  2.87  476.60  cut down by a Frank(4),fell off a wall(4),cut down by a Blumble(3)
Acrobat  30  0  4.40  4.0  6.0  40.0  0.0  12.47  3.07  462.57  cut down by a Werebeast(8),starved in the dark(3),undone by a trap(3)
Cloaker  30  0  4.33  4.0  6.0  36.7  0.0  9.73  2.80  474.80  starved in the dark(7),cut down by a Poltergeist(5),fell off a wall(3)
Bard  30  0  4.07  4.0  6.0  33.3  0.0  9.17  2.83  437.43  cut down by a Poltergeist(7),cut down by a Werebeast(4),cut down by a Philly(2)
Barbarian  30  0  4.03  4.0  6.0  36.7  0.0  11.60  2.47  455.10  cut down by a Cave Bear(3),cut down by a Dante(3),cut down by a Werebeast(3)
Woodsman  30  0  4.03  4.0  6.0  36.7  0.0  6.80  2.73  411.53  cut down by a Werebeast(4),cut down by a Blumble(3),cut down by a Poltergeist(3)
Soldier  30  0  4.03  4.0  5.0  23.3  0.0  9.57  2.97  443.60  cut down by a Frank(4),cut down by a Werebeast(4),cut down by a Rinkle(3)
Sorcerer  30  0  4.00  4.0  6.0  33.3  0.0  11.67  2.80  462.63  cut down by a China Wolf(3),cut down by a Werebeast(3),cut down by a Frank(2)
Court Mage  30  0  3.97  4.0  6.0  40.0  0.0  10.90  2.67  387.23  fell off a wall(5),cut down by a Werebeast(3),cut down by a Dante(2)
Wizard  30  0  3.97  4.0  6.0  40.0  0.0  7.93  2.60  467.67  cut down by a Gremlin(5),starved in the dark(3),cut down by a Blumble(2)
Master of Arms  30  0  3.90  4.0  5.0  26.7  0.0  11.13  3.17  425.07  cut down by a Werebeast(5),cut down by a Poltergeist(4),cut down by a Craig(2)
Pilfer  30  0  3.87  4.0  5.0  30.0  0.0  8.77  2.47  425.50  cut down by a Poltergeist(3),starved in the dark(3),cut down by a Blumble(2)
Cutthroat  30  0  3.73  4.0  5.0  23.3  0.0  9.93  2.70  432.67  fell off a wall(4),came up short on a leap(3),cut down by a Shadow(3)
Guard  30  0  3.70  4.0  6.0  20.0  0.0  9.03  2.50  418.80  cut down by a Poltergeist(4),fell off a wall(4),cut down by a Werebeast(3)
Cat Burglar  30  0  3.57  4.0  6.0  26.7  0.0  8.97  2.50  373.57  undone by a trap(10),cut down by a Rinkle(4),cut down by a Werebeast(3)
Illusionist  30  0  3.57  3.0  6.0  26.7  0.0  8.80  2.33  402.97  cut down by a Philly(3),cut down by a Gremlin(2),cut down by a Shriek(2)
Samurai  25  0  3.56  4.0  5.0  20.0  0.0  10.96  2.68  375.64  cut down by a Werebeast(4),cut down by a China Wolf(2),cut down by a Poltergeist(2)
Cleric  30  0  3.50  3.0  6.0  36.7  0.0  7.60  2.30  352.90  fell off a wall(7),starved in the dark(4),cut down by a China Wolf(2)
Apprentice  30  0  3.43  3.0  6.0  20.0  0.0  8.10  2.67  396.10  cut down by a Werebeast(4),cut down by a Hobgoblin(3),cut down by a Blumble(2)
Pickpocket  30  0  3.40  3.0  5.0  20.0  0.0  7.77  2.40  369.17  cut down by a Werebeast(4),starved in the dark(4),undone by a trap(4)
Summoner  30  0  3.23  4.0  5.0  13.3  0.0  8.07  2.17  391.50  cut down by a Gremlin(5),cut down by a Werebeast(4),cut down by a Dante(2)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Wilmsry  120  0  4.65  5.0  7.0  51.7  0.8  7.39  2.78  513.33  cut down by a Werebeast(14),fell off a wall(9),cut down by a Rinkle(8)
Troll  120  0  4.17  4.0  6.0  38.3  0.0  10.25  2.85  454.60  starved in the dark(26),fell off a wall(9),cut down by a Poltergeist(8)
Fridgian  115  0  4.09  4.0  6.0  34.8  0.0  10.09  2.84  441.58  cut down by a Werebeast(14),cut down by a Frank(10),undone by a trap(9)
Human  120  0  4.06  4.0  6.0  35.8  0.0  10.91  2.94  457.29  fell off a wall(15),cut down by a Werebeast(13),cut down by a Poltergeist(7)
Dwarven  120  0  3.61  4.0  6.0  23.3  0.0  8.99  2.51  395.55  cut down by a Werebeast(12),fell off a wall(9),cut down by a Poltergeist(8)
Elven  120  0  3.19  3.0  5.0  14.2  0.0  8.09  2.33  352.71  cut down by a Werebeast(14),cut down by a Poltergeist(12),starved in the dark(11)

POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  top causes
715  0  3.96  4.0  6.0  33.0  0.1  0.0  9.28  2.71  435.80  cut down by a Werebeast(74),fell off a wall(50),starved in the dark(50)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 715 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=5  workers=4  startDepth=1
```

#### Reading (BEFORE → AFTER)

| Metric | BEFORE (608a0e5, Phase 51 AFTER) | AFTER (049ab50, crit doubles the dice) |
|---|---|---|
| Solo death-depth min/p50/p90/max | 1 / 4 / 6 / 9 | 1 / 4 / 6 / 9 |
| Solo action-count p50 | 425 | 432 |
| Party death-depth min/p50/p90/max | 1 / 5 / 7 / 9 | 1 / 5 / 7 / 12 |
| Party action-count p50 | 648 | 703 |
| Solo top 3 death causes | fell off a wall 14 (7.0%); starved in the dark 14 (7.0%); undone by a trap 13 (6.5%) | fell off a wall 14 (7.0%); cut down by a Dante 13 (6.5%); cut down by a Werebeast 13 (6.5%) |
| Party top 3 death causes | starved in the dark 15 (7.5%); fell off a wall 14 (7.0%); cut down by a Werebeast 9 (4.5%) | starved in the dark 16 (8.0%); cut down by a Werebeast 9 (4.5%); fell off a wall 9 (4.5%) |
| Party stuck (hit maxActions) | 68 of 200 | 75 of 200 |
| Class smoke overall mean depth (pooled, 715 runs) | 3.80 | 3.96 |
| Class smoke overall mean depth (mean of 143 cell means) | 3.803 | 3.959 |
| 3 largest movers UP (cell mean depth) | — | Thief Cloaker Elven 2.6→4.2 (+1.60); Magic User Warlock Dwarven 4.2→5.6 (+1.40); Magic User Court Mage Dwarven 3.2→4.4 (+1.20) |
| 3 largest movers DOWN (cell mean depth) | — | Magic User Summoner Fridgian 4.8→4.0 (−0.80); Fighter Master of Arms Wilmsry 4.8→4.0 (−0.80); Fighter Soldier Wilmsry 5.0→4.2 (−0.80) |

Every readout is flat to a small upward drift: solo min/p50/p90/max death
depth is unchanged (1/4/6/9 both sides — a foe crit was never a dominant
term in most fights the bot survives to see), solo action-count p50 ticks
up by 7 (432 vs 425, within seed-to-seed noise at n=200), and party
death-depth p90/max rises a little (7→7 unchanged, max 9→12 — a few more
runs now survive a foe crit that used to be an instant near-kill), with
party stuck runs rising from 68 to 75 of 200 (surviving longer means more
runs hit the 20000-action cap before dying, an expected consequence of a
smaller crit ceiling, not a new failure mode). The class-smoke pooled mean
depth rises from 3.80 to 3.96 (+0.16) — a small, expected improvement from
removing the Herman/level-base crit cliffs, read in the tuning-proxy
register only: no constants changed here beyond the crit-rule and Herman
fixes themselves. Phase 54's four-band retune is measured on top of this
baseline, not against the original Phase 51 (or Phase 50) BEFORE numbers.

#### Cadence readout (CAD-03 / SC3)

Attacks per player action for Bat/Rat and China Wolf at depth 5 are <= the
foe's own `sp.atk` (2), <= 2x if frenzied (no wandering encounter ever
starts frenzied — see `test/unit/foe-cadence.test.js`'s CAD-01 pins for
that shape); the cadence audit is byte-identical before and after this
phase's crit-rule and Herman edits (`node tools/cadence-audit.mjs | diff -
tools/cadence-audit-output.txt` empty — the crit rule changes damage, not
attack counts):

```
# cadence-audit — Phase 52 (CAD-03): attacks per player action, depth 5, single foe

Hero setup: each seed's own `newRun(seed)` character (real chargen — class/sub/race vary by seed, hit points as rolled, never raised); `state.floor.depth` set to 5 directly (never `newRun`'s `startDepth` option). Hero level is left at 1 (fresh-character default) for the Bat/Rat sample, and set to `state.c.level = 2` for the China Wolf sample (a tier-2 row needs hero level >= 2). N = 40 seeds (`i * 7919 + 1`, i = 0..39). Every fight is single-foe (`wandering=true` forces n=1). A seed whose roster pick is not the target creature is a roster miss (counted, not sampled). Per fight: `fight()` (the opener) then `playerStrike()` in a loop (cap 60), each call's own events array counted separately as one segment (`foeMissed` + `struckByFoe` + `armorSoaked` + `memberStruck`).

## Bat/Rat

| seed | hero | actions | max attacks/action | mean attacks/action | outcome |
|---|---|---|---|---|---|
| 15839 | Fridgian Fighter/Barbarian | 3 | 2 | 1.33 | won |
| 23758 | Human Fighter/Master of Arms | 6 | 2 | 1.67 | won |
| 39596 | Troll Thief/Ninja | 2 | 0 | 0.00 | won |
| 47515 | Wilmsry Fighter/Woodsman | 7 | 2 | 1.43 | won |
| 71272 | Fridgian Magic User/Wizard | 61 | 2 | 0.03 | capped |
| 102948 | Wilmsry Fighter/Soldier | 5 | 2 | 1.20 | won |
| 134624 | Human Thief/Pilfer | 3 | 2 | 0.67 | won |
| 253409 | Elven Thief/Pickpocket | 3 | 2 | 0.67 | won |
| 285085 | Fridgian Thief/Pilfer | 5 | 2 | 1.60 | won |
| 308842 | Human Thief/Cloaker | 3 | 2 | 0.67 | won |

Bat/Rat: sampled 10 of 40 seeds (roster misses 30) — max attacks per player action 2, mean 0.47
INVARIANT attacks per player action <= 2 (sp.atk 2, unfrenzied): HOLDS

## China Wolf

| seed | hero | actions | max attacks/action | mean attacks/action | outcome |
|---|---|---|---|---|---|
| 39596 | Troll Thief/Ninja | 2 | 0 | 0.00 | won |
| 71272 | Fridgian Magic User/Wizard | 61 | 2 | 0.03 | capped |
| 102948 | Wilmsry Fighter/Soldier | 4 | 2 | 1.00 | won |
| 253409 | Elven Thief/Pickpocket | 5 | 2 | 1.40 | died |
| 285085 | Fridgian Thief/Pilfer | 2 | 2 | 1.00 | won |
| 308842 | Human Thief/Cloaker | 6 | 2 | 1.33 | won |

China Wolf: sampled 6 of 40 seeds (roster misses 34) — max attacks per player action 2, mean 0.29
INVARIANT attacks per player action <= 2 (sp.atk 2, unfrenzied): HOLDS

Reading: over 40 seeds each, Bat/Rat's overall max attacks per player action is 2 and China Wolf's is 2 — both at or under their own `sp.atk` of 2, as expected on the post-INIT engine. A frenzied foe (spell-only; no wandering encounter ever starts frenzied) would legitimately double these counts — see test/unit/foe-cadence.test.js's CAD-01 pins for that shape.
```

#### Damage-curve audit (DMG-01 / SC4)

BEFORE (`--rule=whole`, today's pre-Phase-52 rule — a foe crit doubles the
WHOLE `lvl^2 + dmgBonus + dice` sum) — the full `## Flagged (rule=whole)`
table and counts line, quoted verbatim from `tools/damage-curve-audit-output.txt`:

```
## Flagged (rule=whole)

band | tier | type | name | dice | maxSingleHit | MU bar | % | category | wouldBeTrim
---|---|---|---|---|---|---|---|---|---
Filter | 2 | Beasts | Cave Bear | 1d8+0 | 22 | 35.0 | 63% | row-dice | 1d6+0
Filter | 3 | Beasts | Drat | d6 (default) | 26 | 39.5 | 66% | level-base | -
Filter | 3 | Beasts | Flube | d6 (default) | 26 | 39.5 | 66% | level-base | -
Filter | 3 | Beasts | Rast | 1d8+4 | 38 | 39.5 | 96% | level-base | -
Filter | 3 | Beasts | Sterling | 1d12+0 | 38 | 39.5 | 96% | level-base | -
Filter | 3 | Beasts | Wolf | 1d6+2 | 30 | 39.5 | 76% | level-base | -
Filter | 4 | Beasts | Drake | 2d10+4 | 74 | 46.0 | 161% | level-base | -
Filter | 4 | Beasts | Stink Bug | d6 (default) | 38 | 46.0 | 83% | level-base | -
Filter | 3 | Demons | Rinkle | d6 (default) | 26 | 39.5 | 66% | level-base | -
Filter | 4 | Demons | Djinni | 1d4+0 | 34 | 46.0 | 74% | level-base | -
Filter | 4 | Demons | Ghost | d6 (default) | 38 | 46.0 | 83% | level-base | -
Filter | 4 | Demons | Spectre | d6 (default) | 38 | 46.0 | 83% | level-base | -
Filter | 2 | Humans | Krupke | 1d6+2 | 22 | 35.0 | 63% | row-dice | 1d6+1
Filter | 3 | Humans | Frank | 1d8+6 | 42 | 39.5 | 106% | level-base | -
Filter | 3 | Humans | Primp | 1d8+2 | 34 | 39.5 | 86% | level-base | -
Filter | 4 | Humans | Craig | 1d12+0 | 50 | 46.0 | 109% | level-base | -
Filter | 4 | Humans | Herman | flat+25 | 76 | 46.0 | 165% | level-base | -
Filter | 1 | Lair Beasts | Pogo | 1d6+4 | 22 | 35.0 | 63% | row-dice | 1d6+3
Filter | 2 | Lair Beasts | Trachea | 1d10+0 | 26 | 35.0 | 74% | row-dice | 1d6+0
Filter | 3 | Lair Beasts | Blumble | 1d12+0 | 38 | 39.5 | 96% | level-base | -
Filter | 4 | Lair Beasts | Drarl | d6 (default) | 38 | 46.0 | 83% | level-base | -
Filter | 3 | Magical | Werebeast | 1d10+0 | 34 | 39.5 | 86% | level-base | -
Filter | 4 | Magical | Drudge | d6 (default) | 38 | 46.0 | 83% | level-base | -
Filter | 2 | Walking Dead | Google | 1d8+0 | 22 | 35.0 | 63% | row-dice | 1d6+0
Filter | 3 | Walking Dead | Ghoul | 1d6+0 | 26 | 39.5 | 66% | level-base | -
Filter | 3 | Walking Dead | Zombie | d6 (default) | 26 | 39.5 | 66% | level-base | -
Filter | 4 | Walking Dead | Bones | d6 (default) | 38 | 46.0 | 83% | level-base | -
Filter | 4 | Walking Dead | Floater | d6 (default) | 38 | 46.0 | 83% | level-base | -
Filter | 4 | Walking Dead | Undead | d6 (default) | 38 | 46.0 | 83% | level-base | -
Wall | 2 | Beasts | Cave Bear | 1d8+0 | 24 | 39.5 | 61% | row-dice | 1d6+0
Wall | 3 | Beasts | Drat | d6 (default) | 30 | 39.5 | 76% | level-base | -
Wall | 3 | Beasts | Flube | d6 (default) | 30 | 39.5 | 76% | level-base | -
Wall | 3 | Beasts | Rast | 1d8+4 | 42 | 39.5 | 106% | level-base | -
Wall | 3 | Beasts | Sterling | 1d12+0 | 42 | 39.5 | 106% | level-base | -
Wall | 3 | Beasts | Wolf | 1d6+2 | 34 | 39.5 | 86% | level-base | -
Wall | 4 | Beasts | Drake | 2d10+4 | 80 | 46.0 | 174% | level-base | -
Wall | 4 | Beasts | Stink Bug | d6 (default) | 44 | 46.0 | 96% | level-base | -
Wall | 5 | Beasts | Dread Lock | d6 (default) | 62 | 53.5 | 116% | deep-tier | -
Wall | 5 | Beasts | Stalka Beast | 1d4+0 | 58 | 53.5 | 108% | deep-tier | -
Wall | 3 | Demons | Rinkle | d6 (default) | 30 | 39.5 | 76% | level-base | -
Wall | 4 | Demons | Djinni | 1d4+0 | 40 | 46.0 | 87% | level-base | -
Wall | 4 | Demons | Ghost | d6 (default) | 44 | 46.0 | 96% | level-base | -
Wall | 4 | Demons | Spectre | d6 (default) | 44 | 46.0 | 96% | level-base | -
Wall | 5 | Demons | Djinni | 1d4+0 | 58 | 53.5 | 108% | deep-tier | -
Wall | 2 | Humans | Krupke | 1d6+2 | 24 | 39.5 | 61% | row-dice | 1d6+1
Wall | 3 | Humans | Frank | 1d8+6 | 46 | 39.5 | 116% | level-base | -
Wall | 3 | Humans | Primp | 1d8+2 | 38 | 39.5 | 96% | level-base | -
Wall | 4 | Humans | Craig | 1d12+0 | 56 | 46.0 | 122% | level-base | -
Wall | 4 | Humans | Herman | flat+25 | 82 | 46.0 | 178% | level-base | -
Wall | 5 | Humans | Herman | flat+25 | 100 | 53.5 | 187% | deep-tier | -
Wall | 2 | Lair Beasts | Trachea | 1d10+0 | 28 | 39.5 | 71% | row-dice | 1d6+0
Wall | 3 | Lair Beasts | Blumble | 1d12+0 | 42 | 39.5 | 106% | level-base | -
Wall | 4 | Lair Beasts | Drarl | d6 (default) | 44 | 46.0 | 96% | level-base | -
Wall | 5 | Lair Beasts | Drarl | d6 (default) | 62 | 53.5 | 116% | deep-tier | -
Wall | 3 | Magical | Werebeast | 1d10+0 | 38 | 39.5 | 96% | level-base | -
Wall | 4 | Magical | Drudge | d6 (default) | 44 | 46.0 | 96% | level-base | -
Wall | 5 | Magical | Drudge | d6 (default) | 62 | 53.5 | 116% | deep-tier | -
Wall | 2 | Walking Dead | Google | 1d8+0 | 24 | 39.5 | 61% | row-dice | 1d6+0
Wall | 3 | Walking Dead | Ghoul | 1d6+0 | 30 | 39.5 | 76% | level-base | -
Wall | 3 | Walking Dead | Zombie | d6 (default) | 30 | 39.5 | 76% | level-base | -
Wall | 4 | Walking Dead | Bones | d6 (default) | 44 | 46.0 | 96% | level-base | -
Wall | 4 | Walking Dead | Floater | d6 (default) | 44 | 46.0 | 96% | level-base | -
Wall | 4 | Walking Dead | Undead | d6 (default) | 44 | 46.0 | 96% | level-base | -
Wall | 5 | Walking Dead | Vampire | 1d4+0 | 58 | 53.5 | 108% | deep-tier | -
Breakaway | 3 | Beasts | Rast | 1d8+4 | 42 | 53.5 | 79% | row-dice | 1d6+0
Breakaway | 3 | Beasts | Sterling | 1d12+0 | 42 | 53.5 | 79% | row-dice | 1d6+0
Breakaway | 3 | Beasts | Wolf | 1d6+2 | 34 | 53.5 | 64% | row-dice | 1d6+1
Breakaway | 4 | Beasts | Drake | 2d10+4 | 80 | 53.5 | 150% | level-base | -
Breakaway | 4 | Beasts | Stink Bug | d6 (default) | 44 | 53.5 | 82% | level-base | -
Breakaway | 5 | Beasts | Dread Lock | d6 (default) | 62 | 53.5 | 116% | deep-tier | -
Breakaway | 5 | Beasts | Stalka Beast | 1d4+0 | 58 | 53.5 | 108% | deep-tier | -
Breakaway | 4 | Demons | Djinni | 1d4+0 | 40 | 53.5 | 75% | level-base | -
Breakaway | 4 | Demons | Ghost | d6 (default) | 44 | 53.5 | 82% | level-base | -
Breakaway | 4 | Demons | Spectre | d6 (default) | 44 | 53.5 | 82% | level-base | -
Breakaway | 5 | Demons | Djinni | 1d4+0 | 58 | 53.5 | 108% | deep-tier | -
Breakaway | 3 | Humans | Frank | 1d8+6 | 46 | 53.5 | 86% | row-dice | 1d6+0
Breakaway | 3 | Humans | Primp | 1d8+2 | 38 | 53.5 | 71% | row-dice | 1d6+0
Breakaway | 4 | Humans | Craig | 1d12+0 | 56 | 53.5 | 105% | level-base | -
Breakaway | 4 | Humans | Herman | flat+25 | 82 | 53.5 | 153% | level-base | -
Breakaway | 5 | Humans | Herman | flat+25 | 100 | 53.5 | 187% | deep-tier | -
Breakaway | 3 | Lair Beasts | Blumble | 1d12+0 | 42 | 53.5 | 79% | row-dice | 1d6+0
Breakaway | 4 | Lair Beasts | Drarl | d6 (default) | 44 | 53.5 | 82% | level-base | -
Breakaway | 5 | Lair Beasts | Drarl | d6 (default) | 62 | 53.5 | 116% | deep-tier | -
Breakaway | 3 | Magical | Werebeast | 1d10+0 | 38 | 53.5 | 71% | row-dice | 1d6+0
Breakaway | 4 | Magical | Drudge | d6 (default) | 44 | 53.5 | 82% | level-base | -
Breakaway | 5 | Magical | Drudge | d6 (default) | 62 | 53.5 | 116% | deep-tier | -
Breakaway | 4 | Walking Dead | Bones | d6 (default) | 44 | 53.5 | 82% | level-base | -
Breakaway | 4 | Walking Dead | Floater | d6 (default) | 44 | 53.5 | 82% | level-base | -
Breakaway | 4 | Walking Dead | Undead | d6 (default) | 44 | 53.5 | 82% | level-base | -
Breakaway | 5 | Walking Dead | Vampire | 1d4+0 | 58 | 53.5 | 108% | deep-tier | -
Endgame | 3 | Beasts | Rast | 1d8+4 | 42 | 53.5 | 79% | row-dice | 1d6+0
Endgame | 3 | Beasts | Sterling | 1d12+0 | 42 | 53.5 | 79% | row-dice | 1d6+0
Endgame | 3 | Beasts | Wolf | 1d6+2 | 34 | 53.5 | 64% | row-dice | 1d6+1
Endgame | 4 | Beasts | Drake | 2d10+4 | 80 | 53.5 | 150% | level-base | -
Endgame | 4 | Beasts | Stink Bug | d6 (default) | 44 | 53.5 | 82% | level-base | -
Endgame | 5 | Beasts | Dread Lock | d6 (default) | 62 | 53.5 | 116% | deep-tier | -
Endgame | 5 | Beasts | Stalka Beast | 1d4+0 | 58 | 53.5 | 108% | deep-tier | -
Endgame | 4 | Demons | Djinni | 1d4+0 | 40 | 53.5 | 75% | level-base | -
Endgame | 4 | Demons | Ghost | d6 (default) | 44 | 53.5 | 82% | level-base | -
Endgame | 4 | Demons | Spectre | d6 (default) | 44 | 53.5 | 82% | level-base | -
Endgame | 5 | Demons | Djinni | 1d4+0 | 58 | 53.5 | 108% | deep-tier | -
Endgame | 3 | Humans | Frank | 1d8+6 | 46 | 53.5 | 86% | row-dice | 1d6+0
Endgame | 3 | Humans | Primp | 1d8+2 | 38 | 53.5 | 71% | row-dice | 1d6+0
Endgame | 4 | Humans | Craig | 1d12+0 | 56 | 53.5 | 105% | level-base | -
Endgame | 4 | Humans | Herman | flat+25 | 82 | 53.5 | 153% | level-base | -
Endgame | 5 | Humans | Herman | flat+25 | 100 | 53.5 | 187% | deep-tier | -
Endgame | 3 | Lair Beasts | Blumble | 1d12+0 | 42 | 53.5 | 79% | row-dice | 1d6+0
Endgame | 4 | Lair Beasts | Drarl | d6 (default) | 44 | 53.5 | 82% | level-base | -
Endgame | 5 | Lair Beasts | Drarl | d6 (default) | 62 | 53.5 | 116% | deep-tier | -
Endgame | 3 | Magical | Werebeast | 1d10+0 | 38 | 53.5 | 71% | row-dice | 1d6+0
Endgame | 4 | Magical | Drudge | d6 (default) | 44 | 53.5 | 82% | level-base | -
Endgame | 5 | Magical | Drudge | d6 (default) | 62 | 53.5 | 116% | deep-tier | -
Endgame | 4 | Walking Dead | Bones | d6 (default) | 44 | 53.5 | 82% | level-base | -
Endgame | 4 | Walking Dead | Floater | d6 (default) | 44 | 53.5 | 82% | level-base | -
Endgame | 4 | Walking Dead | Undead | d6 (default) | 44 | 53.5 | 82% | level-base | -
Endgame | 5 | Walking Dead | Vampire | 1d4+0 | 58 | 53.5 | 108% | deep-tier | -

FLAGGED: 116 rows across 209 row×band cells (deep-tier 21, level-base 72, row-dice 23, bolt 0)
NOTED: 0 rows

## Herman

Herman is content/bestiary.js's Humans tier-4 AND tier-5 row (the SC4 anchor — the user's pasted 'Herman hits for 80 on floor 5' log). Both rows share the same stat block (`sp.dmg: {n:0, sides:0, bonus:25}`, no strikesAs field yet in this BEFORE run — Plan 02 adds `sp.strikesAs: 5`).

band | tier | hitMax | critMax
---|---|---|---
Filter | 4 | 38 | 76
Wall | 4 | 41 | 82
Wall | 5 | 50 | 100
Breakaway | 4 | 41 | 82
Breakaway | 5 | 50 | 100
Endgame | 4 | 41 | 82
Endgame | 5 | 50 | 100
```

AFTER (`--rule=dice`, the Phase 52 rule — a foe crit doubles the DICE only)
— the final `## Flagged (rule=dice)` table and counts line, quoted
verbatim:

```
## Flagged (rule=dice)

band | tier | type | name | dice | maxSingleHit | MU bar | % | category | wouldBeTrim
---|---|---|---|---|---|---|---|---|---
Filter | 3 | Beasts | Rast | 1d8+4 | 31 | 39.5 | 78% | row-dice | 1d8+0
Filter | 3 | Beasts | Sterling | 1d12+0 | 31 | 39.5 | 78% | row-dice | 1d8+0
Filter | 4 | Beasts | Drake | 2d10+4 | 61 | 46.0 | 133% | row-dice | 1d6+0
Filter | 3 | Humans | Frank | 1d8+6 | 35 | 39.5 | 89% | row-dice | 1d8+0
Filter | 3 | Humans | Primp | 1d8+2 | 27 | 39.5 | 68% | row-dice | 1d8+0
Filter | 4 | Humans | Craig | 1d12+0 | 37 | 46.0 | 80% | row-dice | 1d6+0
Filter | 4 | Humans | Herman | d6 (default) | 34 | 46.0 | 74% | level-base | -
Filter | 1 | Lair Beasts | Pogo | 1d6+4 | 21 | 35.0 | 60% | row-dice | 1d6+3
Filter | 2 | Lair Beasts | Trachea | 1d10+0 | 23 | 35.0 | 66% | row-dice | 1d8+0
Filter | 3 | Lair Beasts | Blumble | 1d12+0 | 31 | 39.5 | 78% | row-dice | 1d8+0
Filter | 3 | Magical | Werebeast | 1d10+0 | 27 | 39.5 | 68% | row-dice | 1d8+0
Wall | 3 | Beasts | Rast | 1d8+4 | 33 | 39.5 | 84% | row-dice | 1d6+0
Wall | 3 | Beasts | Sterling | 1d12+0 | 33 | 39.5 | 84% | row-dice | 1d6+0
Wall | 3 | Beasts | Wolf | 1d6+2 | 25 | 39.5 | 63% | row-dice | 1d6+1
Wall | 4 | Beasts | Drake | 2d10+4 | 64 | 46.0 | 139% | level-base | -
Wall | 4 | Beasts | Stink Bug | d6 (default) | 28 | 46.0 | 61% | level-base | -
Wall | 5 | Beasts | Dread Lock | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Wall | 5 | Beasts | Stalka Beast | 1d4+0 | 33 | 53.5 | 62% | deep-tier | -
Wall | 4 | Demons | Ghost | d6 (default) | 28 | 46.0 | 61% | level-base | -
Wall | 4 | Demons | Spectre | d6 (default) | 28 | 46.0 | 61% | level-base | -
Wall | 5 | Demons | Djinni | 1d4+0 | 33 | 53.5 | 62% | deep-tier | -
Wall | 3 | Humans | Frank | 1d8+6 | 37 | 39.5 | 94% | row-dice | 1d6+0
Wall | 3 | Humans | Primp | 1d8+2 | 29 | 39.5 | 73% | row-dice | 1d6+0
Wall | 4 | Humans | Craig | 1d12+0 | 40 | 46.0 | 87% | level-base | -
Wall | 4 | Humans | Herman | d6 (default) | 37 | 46.0 | 80% | level-base | -
Wall | 5 | Humans | Herman | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Wall | 2 | Lair Beasts | Trachea | 1d10+0 | 24 | 39.5 | 61% | row-dice | 1d8+0
Wall | 3 | Lair Beasts | Blumble | 1d12+0 | 33 | 39.5 | 84% | row-dice | 1d6+0
Wall | 4 | Lair Beasts | Drarl | d6 (default) | 28 | 46.0 | 61% | level-base | -
Wall | 5 | Lair Beasts | Drarl | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Wall | 3 | Magical | Werebeast | 1d10+0 | 29 | 39.5 | 73% | row-dice | 1d6+0
Wall | 4 | Magical | Drudge | d6 (default) | 28 | 46.0 | 61% | level-base | -
Wall | 5 | Magical | Drudge | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Wall | 4 | Walking Dead | Bones | d6 (default) | 28 | 46.0 | 61% | level-base | -
Wall | 4 | Walking Dead | Floater | d6 (default) | 28 | 46.0 | 61% | level-base | -
Wall | 4 | Walking Dead | Undead | d6 (default) | 28 | 46.0 | 61% | level-base | -
Wall | 5 | Walking Dead | Vampire | 1d4+0 | 33 | 53.5 | 62% | deep-tier | -
Breakaway | 3 | Beasts | Rast | 1d8+4 | 33 | 53.5 | 62% | row-dice | 1d8+3
Breakaway | 3 | Beasts | Sterling | 1d12+0 | 33 | 53.5 | 62% | row-dice | 1d10+0
Breakaway | 4 | Beasts | Drake | 2d10+4 | 64 | 53.5 | 120% | row-dice | 1d6+0
Breakaway | 5 | Beasts | Dread Lock | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Breakaway | 5 | Beasts | Stalka Beast | 1d4+0 | 33 | 53.5 | 62% | deep-tier | -
Breakaway | 5 | Demons | Djinni | 1d4+0 | 33 | 53.5 | 62% | deep-tier | -
Breakaway | 3 | Humans | Frank | 1d8+6 | 37 | 53.5 | 69% | row-dice | 1d8+3
Breakaway | 4 | Humans | Craig | 1d12+0 | 40 | 53.5 | 75% | row-dice | 1d8+0
Breakaway | 4 | Humans | Herman | d6 (default) | 37 | 53.5 | 69% | level-base | -
Breakaway | 5 | Humans | Herman | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Breakaway | 3 | Lair Beasts | Blumble | 1d12+0 | 33 | 53.5 | 62% | row-dice | 1d10+0
Breakaway | 5 | Lair Beasts | Drarl | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Breakaway | 5 | Magical | Drudge | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Breakaway | 5 | Walking Dead | Vampire | 1d4+0 | 33 | 53.5 | 62% | deep-tier | -
Endgame | 3 | Beasts | Rast | 1d8+4 | 33 | 53.5 | 62% | row-dice | 1d8+3
Endgame | 3 | Beasts | Sterling | 1d12+0 | 33 | 53.5 | 62% | row-dice | 1d10+0
Endgame | 4 | Beasts | Drake | 2d10+4 | 64 | 53.5 | 120% | row-dice | 1d6+0
Endgame | 5 | Beasts | Dread Lock | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Endgame | 5 | Beasts | Stalka Beast | 1d4+0 | 33 | 53.5 | 62% | deep-tier | -
Endgame | 5 | Demons | Djinni | 1d4+0 | 33 | 53.5 | 62% | deep-tier | -
Endgame | 3 | Humans | Frank | 1d8+6 | 37 | 53.5 | 69% | row-dice | 1d8+3
Endgame | 4 | Humans | Craig | 1d12+0 | 40 | 53.5 | 75% | row-dice | 1d8+0
Endgame | 4 | Humans | Herman | d6 (default) | 37 | 53.5 | 69% | level-base | -
Endgame | 5 | Humans | Herman | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Endgame | 3 | Lair Beasts | Blumble | 1d12+0 | 33 | 53.5 | 62% | row-dice | 1d10+0
Endgame | 5 | Lair Beasts | Drarl | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Endgame | 5 | Magical | Drudge | d6 (default) | 37 | 53.5 | 69% | deep-tier | -
Endgame | 5 | Walking Dead | Vampire | 1d4+0 | 33 | 53.5 | 62% | deep-tier | -

FLAGGED: 65 rows across 209 row×band cells (deep-tier 21, level-base 14, row-dice 30, bolt 0)
NOTED: 0 rows

## Herman

Herman is content/bestiary.js's Humans tier-4 AND tier-5 row (the SC4 anchor — the user's pasted 'Herman hits for 80 on floor 5' log). Both rows now carry `sp.strikesAs: 5` (Phase 52, DMG-02) instead of the old flat-25 notation — the level-base term reads 25 (5^2), the damage die is the default d6 (see engine/combat.js#foeLevelBase).

band | tier | hitMax | critMax
---|---|---|---
Filter | 4 | 28 | 34
Wall | 4 | 31 | 37
Wall | 5 | 31 | 37
Breakaway | 4 | 31 | 37
Breakaway | 5 | 31 | 37
Endgame | 4 | 31 | 37
Endgame | 5 | 31 | 37
```

**Herman, the SC4 anchor** (the user's pasted "Herman hits for 80 on floor
5" log): BEFORE, Herman's tier-4 `critMax` was 82 and tier-5 was 100
(`flat+25` notation, doubled whole-sum on crit). AFTER, both tiers' crit
max is 37 (`sp.strikesAs: 5` + the dice-only crit rule) — down from 82/100
to 37/37 across every band.

**Yardstick** (unchanged since Plan 01, restated for context): band hero
levels are the median `meanLevel` from `docs/class-pass/v17-p51-after-smoke.json`
(commit 608a0e5) — Filter (depth 1-4) hero level 2, Wall (depth 5-8) hero
level 3, Breakaway (depth 9-15)/Endgame (depth 16-20) hero level 5 (no
smoke cell yet reaches those depths, defaults to the level cap). A row is
flagged when its max single hit is >= 60% of the Magic User HP bar
(`25 + d10` base plus mean gains) at that band's hero level.

FLAGGED went from **116 rows across 209 row×band cells** (BEFORE:
deep-tier 21, level-base 72, row-dice 23, bolt 0) to **65 rows across 209
row×band cells** (AFTER: deep-tier 21, level-base 14, row-dice 30, bolt 0)
— the crit-rule and Herman fixes together cleared 51 flagged cells (all
from the `level-base` category, which the crit-rule change shrinks
directly). Every one of the 65 still-flagged cells carries an explicit
per-row `Disposition` in `content/BESTIARY-REBALANCE.md`'s Phase 52
addendum (tier-5 rows: "left as a deliberate deep-tier threat (Endgame
band)"; tier 2-4 `level-base`/`row-dice` rows: "curve height — a Phase 54
dial (four-band retune), not a Phase 52 cliff") — no row is silently
skipped (D-07), and the 44 `level-base`/`row-dice` rows are handed to
Phase 54's TUNE-08 (per-creature stays/moves/retune decision) with their
`wouldBeTrim` notations as input. Pointer:
`content/BESTIARY-REBALANCE.md`, `### Phase 52 addendum (DMG-02,
2026-09-20)`.

### v1.7 · Phase 53 — Joiner level cap

**Rule change:** `engine/encounters.js#meetJoiner` now reads `const lvl =
Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1], state.floor.depth);` — a
Joiner's level never exceeds the floor it is met on; the d10 is still drawn
first, then `rollCharacter`, then the two `20 * lvl + d20` rolls (the
second discarded), so the draw count and cursor are byte-identical.
`grantLevelAbilities`, both wp rolls, `c.joiner`, `state.pendingJoiner`
and the `joinerMet`/`joinerRefused` payloads receive the capped level;
the pre-cap value is remembered nowhere. JOIN-02, a deliberate canon
divergence under the greenfield ruling (2026-09-17), measured zero parity
fixture moves (no replay site meets a Joiner — `test/parity/FIXTURE-INVENTORY.md`
Phase 53 section, JOIN-02 guard in `test/parity/divergence-records.test.js`),
pinned by `test/unit/joiner-level-cap.test.js` (SC1–SC3).

**Parameters (identical BEFORE/AFTER):**
- `node tools/tune-difficulty.mjs --seeds=200` (solo)
- `node tools/tune-difficulty.mjs --seeds=200 --party`
- `node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p52-after-smoke.json` (BEFORE, reused by reference) / `v17-p53-after-smoke.json` (AFTER)

#### BEFORE — by reference: Phase 52 AFTER, commit 049ab5011212a8c6a4bea0f7ee4757dd1923c1b7 (crit doubles the dice; Herman strikes as a level five)

BEFORE is not re-run — per the measurement gate, Phase 52's own AFTER
readout (commit `049ab50`, quoted verbatim under `### v1.7 · Phase 52 —
cadence & damage curve`, `#### AFTER — commit 049ab5011212a8c6a4bea0f7ee4757dd1923c1b7`,
above) is reused as this phase's BEFORE: solo death-depth min/p50/p90/max
1/4/6/9, solo action-count p50 432, party death-depth min/p50/p90/max
1/5/7/12, party action-count p50 703, party stuck 75 of 200, party member
forced at run start in 192/200 runs (member alive at run end 153, 76.5%),
class-smoke pooled mean depth (715 runs) 3.96 (mean of 143 cell means
3.959). Same bot flags, same seeds, same `docs/class-pass/v17-p52-after-smoke.json`
file.

#### AFTER — commit 78572c5115014b581fb2084b7588141122d56101 (Joiner level capped by floor depth)

`node tools/tune-difficulty.mjs --seeds=200` (solo):

```

tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=6  max=9

Action-count distribution:
  min=36  p50=432  p90=645  max=983

Death-cause breakdown:
  fell off a wall      14 (7.0%)
  cut down by a Dante  13 (6.5%)
  cut down by a Werebeast 13 (6.5%)
  undone by a trap     13 (6.5%)
  cut down by a Poltergeist 12 (6.0%)
  starved in the dark  11 (5.5%)
  spent by the dungeon itself 9 (4.5%)
  cut down by a Philly 8 (4.0%)
  came up short on a leap 8 (4.0%)
  cut down by a Rinkle 8 (4.0%)
  cut down by a Drarl  8 (4.0%)
  cut down by a Blumble 7 (3.5%)
  cut down by a Frank  6 (3.0%)
  cut down by a Drake  4 (2.0%)
  cut down by a Shadow 4 (2.0%)
  cut down by a Trachea 4 (2.0%)
  cut down by a Gremlin 4 (2.0%)
  cut down by a Skeleton 4 (2.0%)
  cut down by a Cave Bear 3 (1.5%)
  cut down by a Primp  3 (1.5%)
  cut down by a Dog Face 3 (1.5%)
  cut down by a Craig  3 (1.5%)
  cut down by a Zombie 3 (1.5%)
  cut down by a Herman 3 (1.5%)
  cut down by a Hair   3 (1.5%)
  cut down by a China Wolf 3 (1.5%)
  cut down by a Krupke 2 (1.0%)
  cut down by a Flube  2 (1.0%)
  cut down by a Djinni 2 (1.0%)
  cut down by a Google 2 (1.0%)
  cut down by a Ghost  2 (1.0%)
  cut down by a Drekk  2 (1.0%)
  cut down by a Undead 2 (1.0%)
  cut down by a Stalka Beast 1 (0.5%)
  cut down by a Rast   1 (0.5%)
  cut down by a Viper  1 (0.5%)
  cut down by a Zit    1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)
  cut down by a Spectre 1 (0.5%)
  cut down by a Pogo   1 (0.5%)
  cut down by a Stink Bug 1 (0.5%)
  cut down by a M&M    1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Drat   1 (0.5%)
  cut down by a Ghoul  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=296  successes=186 (62.8%)  failures=110  refused=0  exhausted=0
  runs with >=1 attempt: 65 of 200
  SP from parley: 2586 of 126539 total SP (2.0%)

Reach table (% of runs reaching floor N):
  >=5: 33.0%  >=10: 0.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=33  p50=106  p90=145  max=187

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 55/1965 (2.8%)
  6-10: 35/78 (44.9%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=138  foeBolted=44  foeDrained=2  foeDebuffed=19  foeHealed=0  foeSummoned=0
  heroResisted=61  heroResistFailed=16
  ability damage: 256 of 15573 total damage taken (1.6%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 200 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

`node tools/tune-difficulty.mjs --seeds=200 --party`:

```

tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=5  p90=6  max=12

Action-count distribution:
  min=21  p50=580  p90=20000  max=20000

Death-cause breakdown:
  starved in the dark  17 (8.5%)
  fell off a wall      17 (8.5%)
  cut down by a Werebeast 12 (6.0%)
  undone by a trap     10 (5.0%)
  cut down by a Dante  7 (3.5%)
  cut down by a Drarl  6 (3.0%)
  cut down by a Drake  5 (2.5%)
  cut down by a Frank  5 (2.5%)
  cut down by a Blumble 5 (2.5%)
  cut down by a Herman 5 (2.5%)
  spent by the dungeon itself 4 (2.0%)
  cut down by a Google 4 (2.0%)
  cut down by a Primp  3 (1.5%)
  cut down by a Spectre 3 (1.5%)
  cut down by a Dread Lock 3 (1.5%)
  cut down by a Floater 3 (1.5%)
  came up short on a leap 2 (1.0%)
  cut down by a Rast   2 (1.0%)
  cut down by a Drekk  2 (1.0%)
  cut down by a Gremlin 2 (1.0%)
  cut down by a Wolf   2 (1.0%)
  cut down by a Undead 2 (1.0%)
  cut down by a Poltergeist 2 (1.0%)
  cut down by a Trachea 2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Zit    2 (1.0%)
  cut down by a Sterling 2 (1.0%)
  cut down by a Zombie 1 (0.5%)
  cut down by a Rinkle 1 (0.5%)
  cut down by a Ghoul  1 (0.5%)
  cut down by a Djinni 1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Philly 1 (0.5%)
  cut down by a Bat/Rat 1 (0.5%)
  cut down by a Viper  1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)
  cut down by a Skeleton 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=334  successes=208 (62.3%)  failures=126  refused=0  exhausted=0
  runs with >=1 attempt: 69 of 200
  SP from parley: 3052 of 123864 total SP (2.5%)

Reach table (% of runs reaching floor N):
  >=5: 55.3%  >=10: 1.4%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=21  p50=104  p90=136  max=229

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 47/2060 (2.3%)
  6-10: 27/111 (24.3%)
  11-20: 1/4 (25.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=119  foeBolted=54  foeDrained=1  foeDebuffed=13  foeHealed=0  foeSummoned=0
  heroResisted=47  heroResistFailed=20
  ability damage: 184 of 9815 total damage taken (1.9%)

Party (--party, D-12/D-20):
  member forced at run start in 192/200 runs; member alive at run end: 125 (62.5%)

Stuck: 59 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 141 dead, 59 stuck (hit maxActions=20000; excluded from depth stats)
```

`node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p53-after-smoke.json` (stdout — the ranked matrix; stderr's elapsed line `elapsed: 88.3s  workers=4  runs=715` is not quoted, per this ledger's own convention):

```
tune-classes: 143 cells x 5 seeds (715 runs) — start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
1  Thief  Con Artist  Wilmsry  5  0  6.80  7.0  10.0  80.0  20.0  2.80  3.60  731.20  came up short on a leap(3),cut down by a Drarl(1),starved in the dark(1)
2  Thief  Ninja  Wilmsry  5  0  6.20  6.0  8.0  100.0  0.0  15.80  3.60  635.60  cut down by a Blumble(1),cut down by a Djinni(1),cut down by a Drake(1)
3  Thief  Acrobat  Wilmsry  5  0  6.00  6.0  8.0  100.0  0.0  7.40  3.20  617.60  cut down by a Werebeast(2),cut down by a Rinkle(1),cut down by a Wolf(1)
4  Fighter  Knight  Wilmsry  5  0  5.80  6.0  7.0  80.0  0.0  4.00  3.20  617.20  cut down by a Blumble(3),cut down by a Djinni(1),cut down by a Werebeast(1)
5  Thief  Cloaker  Wilmsry  5  0  5.60  6.0  9.0  60.0  0.0  10.20  3.40  630.60  cut down by a Craig(1),cut down by a Drake(1),cut down by a Poltergeist(1)
6  Magic User  Warlock  Dwarven  5  0  5.60  4.0  9.0  40.0  0.0  17.00  3.80  693.80  cut down by a Cave Bear(1),cut down by a Djinni(1),cut down by a Rinkle(1)
7  Thief  Ninja  Human  5  0  5.40  5.0  8.0  80.0  0.0  12.80  3.60  562.80  cut down by a Drarl(1),cut down by a Drudge(1),cut down by a Primp(1)
8  Thief  Cutthroat  Wilmsry  5  0  5.40  5.0  9.0  60.0  0.0  8.60  3.40  580.40  cut down by a Shadow(1),cut down by a Undead(1),cut down by a Vampire(1)
9  Thief  Ninja  Troll  5  0  5.20  6.0  6.0  60.0  0.0  16.20  3.60  573.40  cut down by a Blumble(1),cut down by a Craig(1),cut down by a Drudge(1)
10  Fighter  Bard  Wilmsry  5  0  5.20  5.0  7.0  80.0  0.0  11.20  3.20  585.40  cut down by a Frank(1),cut down by a Poltergeist(1),cut down by a Primp(1)
11  Thief  Ninja  Dwarven  5  0  5.20  5.0  7.0  60.0  0.0  10.80  3.40  490.00  cut down by a Primp(2),cut down by a Drake(1),cut down by a Ghost(1)
12  Magic User  Warlock  Wilmsry  5  0  5.20  4.0  9.0  40.0  0.0  10.60  3.00  719.60  cut down by a Drudge(1),cut down by a Philly(1),cut down by a Poltergeist(1)
13  Fighter  Woodsman  Wilmsry  5  0  5.00  5.0  6.0  80.0  0.0  6.60  3.00  568.20  cut down by a Blumble(1),cut down by a Werebeast(1),cut down by a Zit(1)
14  Thief  Con Artist  Dwarven  5  0  5.00  5.0  7.0  60.0  0.0  1.80  3.00  549.00  cut down by a Werebeast(2),cut down by a Dante(1),fell off a wall(1)
15  Magic User  Court Mage  Fridgian  5  0  5.00  5.0  8.0  60.0  0.0  17.40  3.60  482.00  cut down by a Bones(1),cut down by a Djinni(1),cut down by a Flube(1)
16  Thief  Pilfer  Wilmsry  5  0  5.00  5.0  7.0  60.0  0.0  8.20  3.20  545.00  cut down by a Ghoul(2),cut down by a Poltergeist(1),cut down by a Stink Bug(1)
17  Magic User  Warlock  Troll  5  0  4.80  6.0  7.0  60.0  0.0  13.20  3.40  555.20  starved in the dark(2),cut down by a Drake(1),cut down by a Herman(1)
18  Fighter  Knight  Fridgian  5  0  4.80  5.0  5.0  80.0  0.0  6.80  3.00  511.80  cut down by a Frank(3),cut down by a Cave Bear(1),cut down by a Rinkle(1)
19  Magic User  Warlock  Fridgian  5  0  4.80  5.0  5.0  80.0  0.0  12.00  3.40  561.20  cut down by a Werebeast(2),cut down by a Drarl(1),cut down by a Spectre(1)
20  Magic User  Wizard  Fridgian  5  0  4.80  5.0  6.0  80.0  0.0  7.00  3.00  535.20  cut down by a Drake(2),cut down by a Gremlin(1),cut down by a Zombie(1)
21  Thief  Cat Burglar  Wilmsry  5  0  4.80  5.0  7.0  60.0  0.0  5.80  2.80  505.20  cut down by a Rinkle(2),undone by a trap(2),cut down by a Drudge(1)
22  Thief  Con Artist  Human  5  0  4.80  5.0  7.0  60.0  0.0  2.20  3.00  551.40  fell off a wall(2),came up short on a leap(1),cut down by a Ghoul(1)
23  Fighter  Knight  Human  5  0  4.80  5.0  6.0  60.0  0.0  9.00  4.00  519.20  cut down by a Werebeast(2),cut down by a Bones(1),cut down by a Drarl(1)
24  Thief  Ninja  Fridgian  5  0  4.80  5.0  6.0  60.0  0.0  13.20  3.40  527.60  cut down by a Rinkle(2),cut down by a Drake(1),cut down by a Frank(1)
25  Fighter  Woodsman  Troll  5  0  4.80  5.0  7.0  60.0  0.0  6.60  3.00  437.00  cut down by a Werebeast(2),starved in the dark(2),cut down by a Blumble(1)
26  Thief  Acrobat  Dwarven  5  0  4.80  4.0  7.0  40.0  0.0  15.00  3.20  492.20  cut down by a Google(1),cut down by a Stink Bug(1),cut down by a Trachea(1)
27  Fighter  Bard  Fridgian  5  0  4.80  4.0  6.0  40.0  0.0  7.20  3.40  464.80  cut down by a Drarl(1),cut down by a Rinkle(1),cut down by a Spectre(1)
28  Magic User  Illusionist  Troll  5  0  4.80  4.0  9.0  40.0  0.0  10.20  2.80  512.80  cut down by a Cave Bear(1),cut down by a Drat(1),cut down by a Dread Lock(1)
29  Fighter  Soldier  Human  5  0  4.80  4.0  7.0  40.0  0.0  11.20  3.80  591.20  cut down by a Frank(1),cut down by a Hair(1),fell off a wall(1)
30  Fighter  Barbarian  Troll  5  0  4.60  5.0  5.0  80.0  0.0  11.80  2.80  475.80  cut down by a Blumble(1),cut down by a Frank(1),cut down by a Poltergeist(1)
31  Fighter  Guard  Troll  5  0  4.60  5.0  5.0  60.0  0.0  9.60  3.40  534.00  starved in the dark(2),cut down by a Craig(1),cut down by a Ghost(1)
32  Thief  Cloaker  Troll  5  0  4.60  4.0  6.0  40.0  0.0  12.40  3.20  484.20  starved in the dark(3),cut down by a Blumble(1),fell off a wall(1)
33  Magic User  Sorcerer  Fridgian  5  0  4.60  4.0  6.0  40.0  0.0  15.60  3.20  483.00  cut down by a Werebeast(2),cut down by a Frank(1),cut down by a Undead(1)
34  Magic User  Sorcerer  Human  5  0  4.60  4.0  6.0  40.0  0.0  14.40  3.40  585.00  cut down by a Rast(1),cut down by a Spectre(1),cut down by a Trachea(1)
35  Fighter  Woodsman  Fridgian  5  0  4.60  4.0  7.0  40.0  0.0  7.00  3.00  442.60  cut down by a Rinkle(2),cut down by a Frank(1),cut down by a Poltergeist(1)
36  Magic User  Sorcerer  Dwarven  5  0  4.40  6.0  7.0  60.0  0.0  14.00  3.20  527.80  cut down by a China Wolf(1),cut down by a Dread Lock(1),cut down by a Frank(1)
37  Thief  Cloaker  Human  5  0  4.40  5.0  5.0  60.0  0.0  11.00  3.00  487.60  starved in the dark(2),came up short on a leap(1),cut down by a Poltergeist(1)
38  Thief  Con Artist  Troll  5  0  4.40  5.0  5.0  60.0  0.0  3.20  2.60  488.80  starved in the dark(3),cut down by a Poltergeist(1),cut down by a Rast(1)
39  Magic User  Warlock  Human  5  0  4.40  5.0  6.0  60.0  0.0  14.60  3.20  507.40  cut down by a Philly(1),cut down by a Rinkle(1),cut down by a Spectre(1)
40  Thief  Acrobat  Fridgian  5  0  4.40  4.0  5.0  40.0  0.0  12.40  3.20  459.20  cut down by a Craig(1),cut down by a Frank(1),cut down by a Poltergeist(1)
41  Fighter  Barbarian  Fridgian  5  0  4.40  4.0  7.0  40.0  0.0  12.60  2.60  528.20  came up short on a leap(2),cut down by a Cave Bear(1),cut down by a Drarl(1)
42  Thief  Cat Burglar  Troll  5  0  4.40  4.0  6.0  40.0  0.0  14.00  3.40  502.00  cut down by a Bones(1),cut down by a Drake(1),cut down by a Rinkle(1)
43  Magic User  Court Mage  Dwarven  5  0  4.40  4.0  8.0  40.0  0.0  11.20  2.60  441.60  cut down by a Dante(1),cut down by a Hobgoblin(1),cut down by a Shriek(1)
44  Fighter  Guard  Wilmsry  5  0  4.40  4.0  7.0  40.0  0.0  7.00  2.20  486.00  cut down by a Bat/Rat(1),cut down by a Dante(1),cut down by a Werebeast(1)
45  Fighter  Master of Arms  Troll  5  0  4.40  4.0  6.0  40.0  0.0  8.80  3.00  454.40  cut down by a Poltergeist(2),cut down by a Herman(1),fell off a wall(1)
46  Fighter  Soldier  Troll  5  0  4.40  4.0  5.0  40.0  0.0  9.00  3.00  404.80  cut down by a Bones(1),cut down by a Frank(1),cut down by a Poltergeist(1)
47  Magic User  Wizard  Troll  5  0  4.40  4.0  7.0  40.0  0.0  11.20  3.20  511.20  cut down by a Herman(1),cut down by a Primp(1),cut down by a Rinkle(1)
48  Fighter  Barbarian  Human  5  0  4.20  4.0  5.0  40.0  0.0  18.20  2.80  499.40  cut down by a Blumble(1),cut down by a Dante(1),cut down by a Frank(1)
49  Fighter  Bard  Human  5  0  4.20  4.0  6.0  40.0  0.0  10.80  3.00  466.00  cut down by a Werebeast(2),cut down by a Philly(1),cut down by a Poltergeist(1)
50  Fighter  Samurai  Wilmsry  5  0  4.20  4.0  5.0  40.0  0.0  10.60  2.60  460.40  cut down by a China Wolf(2),cut down by a Werebeast(2),cut down by a Rinkle(1)
51  Fighter  Soldier  Wilmsry  5  0  4.20  4.0  6.0  40.0  0.0  4.80  2.60  427.20  cut down by a Poltergeist(1),cut down by a Rinkle(1),cut down by a Werebeast(1)
52  Magic User  Sorcerer  Troll  5  0  4.20  4.0  6.0  40.0  0.0  13.00  3.00  460.60  cut down by a Blumble(1),cut down by a Floater(1),cut down by a Poltergeist(1)
53  Magic User  Wizard  Wilmsry  5  0  4.20  4.0  7.0  40.0  0.0  4.40  2.60  522.80  cut down by a Drarl(1),cut down by a Gremlin(1),cut down by a Primp(1)
54  Thief  Acrobat  Human  5  0  4.20  4.0  6.0  20.0  0.0  14.60  3.20  433.20  cut down by a Werebeast(2),cut down by a Herman(1),cut down by a Sterling(1)
55  Thief  Cloaker  Elven  5  0  4.20  4.0  5.0  20.0  0.0  9.40  2.80  468.20  cut down by a Poltergeist(1),cut down by a Primp(1),cut down by a Rinkle(1)
56  Magic User  Cleric  Troll  5  0  4.00  5.0  5.0  60.0  0.0  8.60  2.60  450.00  fell off a wall(2),cut down by a Gremlin(1),cut down by a Poltergeist(1)
57  Magic User  Court Mage  Human  5  0  4.00  5.0  6.0  60.0  0.0  10.40  2.80  401.80  fell off a wall(3),cut down by a Craig(1),cut down by a Drarl(1)
58  Magic User  Illusionist  Wilmsry  5  0  4.00  5.0  5.0  60.0  0.0  6.60  2.40  455.80  cut down by a Google(1),cut down by a M&M(1),cut down by a Primp(1)
59  Magic User  Wizard  Human  5  0  4.00  5.0  6.0  60.0  0.0  9.00  2.60  431.00  cut down by a Blumble(1),cut down by a Gremlin(1),cut down by a Sterling(1)
60  Magic User  Cleric  Wilmsry  5  0  4.00  4.0  7.0  40.0  0.0  5.40  2.40  397.80  fell off a wall(2),came up short on a leap(1),cut down by a Dante(1)
61  Fighter  Master of Arms  Fridgian  5  0  4.00  4.0  5.0  40.0  0.0  11.40  3.20  435.80  cut down by a China Wolf(1),cut down by a Craig(1),cut down by a Drake(1)
62  Thief  Pilfer  Human  5  0  4.00  4.0  5.0  40.0  0.0  8.00  2.40  402.40  cut down by a Blumble(1),cut down by a Primp(1),cut down by a Rinkle(1)
63  Fighter  Samurai  Dwarven  5  0  4.00  4.0  5.0  40.0  0.0  12.20  3.40  404.60  cut down by a Craig(1),cut down by a Floater(1),cut down by a Sterling(1)
64  Magic User  Apprentice  Wilmsry  5  0  4.00  4.0  5.0  20.0  0.0  6.00  2.60  418.40  cut down by a China Wolf(1),cut down by a Rinkle(1),cut down by a Shadow(1)
65  Fighter  Knight  Troll  5  0  4.00  4.0  5.0  20.0  0.0  2.80  2.20  375.40  cut down by a Google(2),fell off a wall(2),cut down by a Frank(1)
66  Fighter  Master of Arms  Human  5  0  4.00  4.0  5.0  20.0  0.0  12.80  3.40  428.80  cut down by a Craig(1),cut down by a Drake(1),cut down by a Drat(1)
67  Fighter  Master of Arms  Wilmsry  5  0  4.00  4.0  5.0  20.0  0.0  12.00  3.20  444.60  cut down by a Sterling(2),cut down by a Frank(1),cut down by a Primp(1)
68  Fighter  Soldier  Fridgian  5  0  4.00  4.0  5.0  20.0  0.0  13.60  3.20  460.80  cut down by a Werebeast(2),cut down by a Frank(1),cut down by a Rast(1)
69  Fighter  Soldier  Dwarven  5  0  4.00  4.0  4.0  0.0  0.0  10.80  3.00  474.60  cut down by a Blumble(1),cut down by a Cave Bear(1),cut down by a Frank(1)
70  Magic User  Summoner  Fridgian  5  0  4.00  4.0  4.0  0.0  0.0  10.00  2.60  456.80  cut down by a Blumble(1),cut down by a Poltergeist(1),cut down by a Werebeast(1)
71  Thief  Cutthroat  Human  5  0  4.00  3.0  7.0  20.0  0.0  11.60  2.80  459.80  cut down by a Dante(1),cut down by a Drake(1),cut down by a Shadow(1)
72  Fighter  Guard  Fridgian  5  0  4.00  3.0  7.0  20.0  0.0  11.40  3.00  475.20  cut down by a Drarl(1),cut down by a Drat(1),cut down by a Krupke(1)
73  Thief  Cutthroat  Troll  5  0  3.80  4.0  5.0  40.0  0.0  12.20  2.60  429.20  cut down by a Rinkle(2),came up short on a leap(1),cut down by a Ghost(1)
74  Fighter  Knight  Elven  5  0  3.80  4.0  5.0  40.0  0.0  3.80  2.40  414.20  came up short on a leap(1),cut down by a Flube(1),cut down by a Poltergeist(1)
75  Thief  Pickpocket  Wilmsry  5  0  3.80  4.0  5.0  40.0  0.0  5.60  2.40  428.40  fell off a wall(2),cut down by a Frank(1),cut down by a Werebeast(1)
76  Magic User  Apprentice  Human  5  0  3.80  4.0  6.0  20.0  0.0  10.60  2.80  473.20  cut down by a Blumble(1),cut down by a Krupke(1),cut down by a Rinkle(1)
77  Fighter  Barbarian  Wilmsry  5  0  3.80  4.0  6.0  20.0  0.0  7.40  2.20  476.00  cut down by a Dante(1),cut down by a Philly(1),cut down by a Primp(1)
78  Fighter  Bard  Troll  5  0  3.80  4.0  5.0  20.0  0.0  7.60  2.40  439.00  cut down by a Cave Bear(1),cut down by a Flube(1),cut down by a Philly(1)
79  Magic User  Court Mage  Troll  5  0  3.80  4.0  6.0  20.0  0.0  12.00  2.80  407.80  cut down by a Floater(1),cut down by a Werebeast(1),cut down by a Wolf(1)
80  Thief  Pilfer  Fridgian  5  0  3.80  4.0  5.0  20.0  0.0  10.40  2.40  422.60  cut down by a Frank(1),cut down by a Google(1),cut down by a Gremlin(1)
81  Thief  Pilfer  Troll  5  0  3.80  4.0  5.0  20.0  0.0  10.40  2.40  437.80  starved in the dark(2),cut down by a Cave Bear(1),cut down by a Poltergeist(1)
82  Fighter  Samurai  Troll  5  0  3.80  4.0  5.0  20.0  0.0  12.20  2.60  399.80  starved in the dark(2),cut down by a Blumble(1),cut down by a Rinkle(1)
83  Magic User  Sorcerer  Wilmsry  5  0  3.80  4.0  5.0  20.0  0.0  6.40  2.20  440.80  cut down by a China Wolf(1),cut down by a Google(1),cut down by a Gremlin(1)
84  Magic User  Summoner  Human  5  0  3.80  4.0  7.0  20.0  0.0  11.40  3.00  515.20  cut down by a China Wolf(1),cut down by a Floater(1),cut down by a Gremlin(1)
85  Magic User  Apprentice  Elven  5  0  3.80  3.0  7.0  40.0  0.0  9.60  3.20  456.40  cut down by a Blumble(1),cut down by a Djinni(1),cut down by a Hobgoblin(1)
86  Magic User  Cleric  Human  5  0  3.80  3.0  8.0  40.0  0.0  7.40  2.60  364.00  cut down by a Google(1),cut down by a Herman(1),cut down by a Vampire(1)
87  Fighter  Barbarian  Elven  5  0  3.80  3.0  8.0  20.0  0.0  10.20  2.20  411.40  cut down by a Cave Bear(2),cut down by a Drarl(1),cut down by a Skeleton(1)
88  Thief  Cloaker  Fridgian  5  0  3.80  3.0  6.0  20.0  0.0  8.60  2.60  394.60  cut down by a Dante(1),cut down by a Djinni(1),cut down by a Poltergeist(1)
89  Thief  Ninja  Elven  5  0  3.80  3.0  7.0  20.0  0.0  12.40  2.60  367.80  cut down by a Cave Bear(1),cut down by a China Wolf(1),cut down by a Drake(1)
90  Thief  Cat Burglar  Human  5  0  3.60  4.0  5.0  40.0  0.0  10.40  2.40  394.00  fell off a wall(2),cut down by a Drarl(1),cut down by a Werebeast(1)
91  Magic User  Court Mage  Wilmsry  5  0  3.60  4.0  5.0  40.0  0.0  7.00  2.20  333.80  cut down by a Dante(1),cut down by a Frank(1),cut down by a Ned(1)
92  Thief  Pickpocket  Fridgian  5  0  3.60  4.0  5.0  40.0  0.0  6.40  2.40  316.40  cut down by a Rinkle(2),cut down by a Blumble(1),spent by the dungeon itself(1)
93  Magic User  Apprentice  Troll  5  0  3.60  4.0  6.0  20.0  0.0  10.40  3.00  433.60  cut down by a Drarl(1),cut down by a Gremlin(1),cut down by a Werebeast(1)
94  Magic User  Cleric  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  9.40  2.20  374.20  cut down by a China Wolf(1),cut down by a Primp(1),cut down by a Shadow(1)
95  Thief  Cutthroat  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  9.40  2.80  411.20  cut down by a Flube(1),cut down by a Ned(1),cut down by a Sterling(1)
96  Magic User  Illusionist  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  12.20  2.60  409.80  cut down by a Ghoul(1),cut down by a Philly(1),cut down by a Shriek(1)
97  Fighter  Master of Arms  Dwarven  5  0  3.60  4.0  5.0  20.0  0.0  12.40  3.20  423.80  cut down by a Werebeast(2),cut down by a Dante(1),cut down by a Poltergeist(1)
98  Fighter  Guard  Dwarven  5  0  3.60  4.0  4.0  0.0  0.0  11.00  2.60  391.60  cut down by a Dante(1),cut down by a Google(1),cut down by a Primp(1)
99  Magic User  Wizard  Elven  5  0  3.60  4.0  4.0  0.0  0.0  11.20  2.40  497.40  cut down by a Frank(1),cut down by a Rast(1),cut down by a Rinkle(1)
100  Fighter  Woodsman  Human  5  0  3.60  4.0  4.0  0.0  0.0  9.40  3.00  391.40  cut down by a Frank(1),cut down by a Ghost(1),cut down by a Poltergeist(1)
101  Thief  Acrobat  Troll  5  0  3.60  3.0  6.0  20.0  0.0  13.20  2.80  407.80  starved in the dark(3),cut down by a Drarl(1),undone by a trap(1)
102  Fighter  Woodsman  Elven  5  0  3.60  3.0  6.0  20.0  0.0  5.00  2.60  349.00  cut down by a Goblin(1),cut down by a Poltergeist(1),cut down by a Stink Bug(1)
103  Thief  Acrobat  Elven  5  0  3.40  4.0  5.0  20.0  0.0  12.20  2.80  365.40  cut down by a Werebeast(3),cut down by a Rinkle(1),fell off a wall(1)
104  Thief  Cloaker  Dwarven  5  0  3.40  4.0  5.0  20.0  0.0  6.80  1.80  383.60  cut down by a Google(1),cut down by a Gremlin(1),cut down by a Poltergeist(1)
105  Magic User  Illusionist  Human  5  0  3.40  4.0  5.0  20.0  0.0  10.80  2.60  393.80  cut down by a Blumble(1),cut down by a Djinni(1),cut down by a Philly(1)
106  Thief  Pickpocket  Dwarven  5  0  3.40  4.0  5.0  20.0  0.0  6.80  2.40  379.60  cut down by a Shadow(1),cut down by a Werebeast(1),spent by the dungeon itself(1)
107  Thief  Pilfer  Elven  5  0  3.40  4.0  5.0  20.0  0.0  8.40  2.40  410.60  cut down by a Blumble(1),cut down by a Drarl(1),cut down by a Trachea(1)
108  Fighter  Barbarian  Dwarven  5  0  3.40  3.0  5.0  20.0  0.0  9.40  2.20  339.80  cut down by a Dante(1),cut down by a Drat(1),cut down by a Werebeast(1)
109  Fighter  Bard  Elven  5  0  3.40  3.0  6.0  20.0  0.0  9.60  2.80  342.80  cut down by a Poltergeist(2),came up short on a leap(1),cut down by a Google(1)
110  Fighter  Master of Arms  Elven  5  0  3.40  3.0  6.0  20.0  0.0  9.40  3.00  363.00  cut down by a Cave Bear(1),cut down by a Poltergeist(1),cut down by a Vampire(1)
111  Thief  Pickpocket  Human  5  0  3.40  3.0  6.0  20.0  0.0  9.40  2.40  390.40  undone by a trap(2),cut down by a Floater(1),cut down by a Google(1)
112  Magic User  Summoner  Troll  5  0  3.40  3.0  6.0  20.0  0.0  8.80  2.40  429.60  cut down by a Dante(1),cut down by a Google(1),cut down by a Gremlin(1)
113  Fighter  Knight  Dwarven  5  0  3.40  3.0  4.0  0.0  0.0  6.20  2.40  421.80  fell off a wall(2),cut down by a Dante(1),cut down by a Poltergeist(1)
114  Thief  Pickpocket  Elven  5  0  3.40  3.0  4.0  0.0  0.0  9.80  2.60  394.00  cut down by a Google(2),cut down by a Werebeast(2),starved in the dark(1)
115  Magic User  Summoner  Elven  5  0  3.20  4.0  5.0  20.0  0.0  7.80  2.00  371.80  cut down by a Gremlin(1),cut down by a Rinkle(1),cut down by a Skeleton(1)
116  Thief  Con Artist  Fridgian  5  0  3.20  3.0  6.0  20.0  0.0  2.80  2.20  359.20  spent by the dungeon itself(3),cut down by a Gremlin(1),undone by a trap(1)
117  Thief  Pilfer  Dwarven  5  0  3.20  3.0  5.0  20.0  0.0  7.20  2.00  334.60  cut down by a Gremlin(1),cut down by a Hair(1),cut down by a Pogo(1)
118  Fighter  Samurai  Human  5  0  3.20  3.0  4.0  0.0  0.0  13.40  2.80  356.00  cut down by a Drarl(1),cut down by a Frank(1),cut down by a Poltergeist(1)
119  Magic User  Court Mage  Elven  5  0  3.00  4.0  5.0  20.0  0.0  7.40  2.00  256.40  cut down by a Werebeast(2),came up short on a leap(1),cut down by a Drekk(1)
120  Thief  Cat Burglar  Dwarven  5  0  3.00  4.0  4.0  0.0  0.0  8.40  2.20  306.20  undone by a trap(2),cut down by a Rinkle(1),cut down by a Sterling(1)
121  Magic User  Cleric  Dwarven  5  0  3.00  3.0  5.0  40.0  0.0  8.60  2.20  281.00  cut down by a China Wolf(1),cut down by a Drarl(1),cut down by a Google(1)
122  Magic User  Illusionist  Dwarven  5  0  3.00  3.0  6.0  20.0  0.0  6.20  1.80  346.20  cut down by a China Wolf(1),cut down by a Philly(1),cut down by a Rinkle(1)
123  Magic User  Apprentice  Fridgian  5  0  3.00  3.0  4.0  0.0  0.0  7.40  2.40  360.00  cut down by a Poltergeist(2),cut down by a Google(1),cut down by a Werebeast(1)
124  Fighter  Bard  Dwarven  5  0  3.00  3.0  4.0  0.0  0.0  8.60  2.20  326.60  cut down by a Poltergeist(3),cut down by a Rast(1),cut down by a Skeleton(1)
125  Thief  Cutthroat  Dwarven  5  0  3.00  3.0  4.0  0.0  0.0  8.40  2.40  376.80  came up short on a leap(2),cut down by a Shadow(1),cut down by a Skeleton(1)
126  Fighter  Guard  Human  5  0  3.00  3.0  4.0  0.0  0.0  8.40  2.00  370.00  cut down by a Poltergeist(2),fell off a wall(2),cut down by a Werebeast(1)
127  Magic User  Warlock  Elven  5  0  3.00  3.0  4.0  0.0  0.0  9.40  2.40  382.80  cut down by a Poltergeist(2),cut down by a Trachea(1),cut down by a Wolf(1)
128  Thief  Cat Burglar  Fridgian  5  0  2.80  4.0  4.0  0.0  0.0  7.80  2.00  284.20  undone by a trap(2),cut down by a Frank(1),cut down by a Gremlin(1)
129  Thief  Cat Burglar  Elven  5  0  2.80  3.0  5.0  20.0  0.0  7.40  2.20  249.80  undone by a trap(3),cut down by a Cave Bear(1),cut down by a Craig(1)
130  Thief  Con Artist  Elven  5  0  2.80  3.0  5.0  20.0  0.0  1.00  2.00  380.60  starved in the dark(4),cut down by a Rinkle(1)
131  Thief  Pickpocket  Troll  5  0  2.80  3.0  4.0  0.0  0.0  8.60  2.20  306.20  cut down by a Frank(1),cut down by a Rast(1),cut down by a Shriek(1)
132  Fighter  Soldier  Elven  5  0  2.80  3.0  4.0  0.0  0.0  8.00  2.20  303.00  cut down by a Cave Bear(1),cut down by a China Wolf(1),cut down by a Rinkle(1)
133  Magic User  Wizard  Dwarven  5  0  2.80  2.0  6.0  20.0  0.0  4.80  1.80  308.40  cut down by a Gremlin(2),cut down by a Blumble(1),cut down by a Philly(1)
134  Thief  Cutthroat  Elven  5  0  2.60  3.0  3.0  0.0  0.0  9.40  2.20  338.60  cut down by a Poltergeist(2),cut down by a Dante(1),cut down by a Frank(1)
135  Fighter  Guard  Elven  5  0  2.60  3.0  4.0  0.0  0.0  6.80  1.80  256.00  fell off a wall(2),cut down by a Blumble(1),cut down by a Poltergeist(1)
136  Magic User  Illusionist  Elven  5  0  2.60  3.0  4.0  0.0  0.0  6.80  1.80  299.40  cut down by a Gremlin(2),cut down by a Shriek(1),cut down by a Werebeast(1)
137  Fighter  Samurai  Elven  5  0  2.60  3.0  3.0  0.0  0.0  6.40  2.00  257.40  cut down by a Cave Bear(1),cut down by a Google(1),cut down by a Poltergeist(1)
138  Magic User  Cleric  Elven  5  0  2.60  2.0  5.0  20.0  0.0  6.20  1.80  250.40  starved in the dark(3),cut down by a Gremlin(1),fell off a wall(1)
139  Magic User  Summoner  Wilmsry  5  0  2.60  2.0  5.0  20.0  0.0  3.00  1.40  292.00  cut down by a Gremlin(2),cut down by a M&M(1),cut down by a Philly(1)
140  Fighter  Woodsman  Dwarven  5  0  2.60  2.0  5.0  20.0  0.0  6.20  1.80  281.00  cut down by a Blumble(1),cut down by a Pogo(1),cut down by a Skeleton(1)
141  Magic User  Sorcerer  Elven  5  0  2.40  3.0  3.0  0.0  0.0  6.60  1.80  278.60  came up short on a leap(1),cut down by a China Wolf(1),cut down by a Gremlin(1)
142  Magic User  Apprentice  Dwarven  5  0  2.40  2.0  5.0  20.0  0.0  4.60  2.00  235.00  cut down by a Hobgoblin(2),cut down by a Cave Bear(1),cut down by a Craig(1)
143  Magic User  Summoner  Dwarven  5  0  2.40  2.0  4.0  0.0  0.0  7.40  1.60  283.60  cut down by a Ned(2),cut down by a Dante(1),cut down by a Google(1)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Thief  240  0  4.11  4.0  6.0  36.3  0.4  9.18  2.75  446.81  starved in the dark(29),cut down by a Werebeast(23),undone by a trap(20)
Fighter  235  0  3.98  4.0  6.0  30.6  0.0  9.17  2.78  431.64  cut down by a Werebeast(30),cut down by a Poltergeist(26),cut down by a Frank(16)
Magic User  240  0  3.79  4.0  6.0  32.1  0.0  9.48  2.59  428.88  cut down by a Werebeast(21),fell off a wall(19),cut down by a Gremlin(17)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Ninja  30  0  5.10  5.0  7.0  63.3  0.0  13.53  3.37  526.20  cut down by a Drake(4),cut down by a Primp(3),cut down by a Blumble(2)
Warlock  30  0  4.63  4.0  9.0  46.7  0.0  12.80  3.20  570.00  cut down by a Poltergeist(3),cut down by a Werebeast(3),cut down by a Philly(2)
Con Artist  30  0  4.50  5.0  7.0  50.0  3.3  2.30  2.73  510.03  starved in the dark(8),came up short on a leap(4),spent by the dungeon itself(4)
Knight  30  0  4.43  4.0  6.0  46.7  0.0  5.43  2.87  476.60  cut down by a Frank(4),fell off a wall(4),cut down by a Blumble(3)
Acrobat  30  0  4.40  4.0  6.0  40.0  0.0  12.47  3.07  462.57  cut down by a Werebeast(8),starved in the dark(3),undone by a trap(3)
Cloaker  30  0  4.33  4.0  6.0  36.7  0.0  9.73  2.80  474.80  starved in the dark(7),cut down by a Poltergeist(5),fell off a wall(3)
Bard  30  0  4.07  4.0  6.0  33.3  0.0  9.17  2.83  437.43  cut down by a Poltergeist(7),cut down by a Werebeast(4),cut down by a Philly(2)
Barbarian  30  0  4.03  4.0  6.0  36.7  0.0  11.60  2.47  455.10  cut down by a Cave Bear(3),cut down by a Dante(3),cut down by a Werebeast(3)
Woodsman  30  0  4.03  4.0  6.0  36.7  0.0  6.80  2.73  411.53  cut down by a Werebeast(4),cut down by a Blumble(3),cut down by a Poltergeist(3)
Soldier  30  0  4.03  4.0  5.0  23.3  0.0  9.57  2.97  443.60  cut down by a Frank(4),cut down by a Werebeast(4),cut down by a Rinkle(3)
Sorcerer  30  0  4.00  4.0  6.0  33.3  0.0  11.67  2.80  462.63  cut down by a China Wolf(3),cut down by a Werebeast(3),cut down by a Frank(2)
Court Mage  30  0  3.97  4.0  6.0  40.0  0.0  10.90  2.67  387.23  fell off a wall(5),cut down by a Werebeast(3),cut down by a Dante(2)
Wizard  30  0  3.97  4.0  6.0  40.0  0.0  7.93  2.60  467.67  cut down by a Gremlin(5),starved in the dark(3),cut down by a Blumble(2)
Master of Arms  30  0  3.90  4.0  5.0  26.7  0.0  11.13  3.17  425.07  cut down by a Werebeast(5),cut down by a Poltergeist(4),cut down by a Craig(2)
Pilfer  30  0  3.87  4.0  5.0  30.0  0.0  8.77  2.47  425.50  cut down by a Poltergeist(3),starved in the dark(3),cut down by a Blumble(2)
Cutthroat  30  0  3.73  4.0  5.0  23.3  0.0  9.93  2.70  432.67  fell off a wall(4),came up short on a leap(3),cut down by a Shadow(3)
Guard  30  0  3.70  4.0  6.0  20.0  0.0  9.03  2.50  418.80  cut down by a Poltergeist(4),fell off a wall(4),cut down by a Werebeast(3)
Cat Burglar  30  0  3.57  4.0  6.0  26.7  0.0  8.97  2.50  373.57  undone by a trap(10),cut down by a Rinkle(4),cut down by a Werebeast(3)
Illusionist  30  0  3.57  3.0  6.0  26.7  0.0  8.80  2.33  402.97  cut down by a Philly(3),cut down by a Gremlin(2),cut down by a Shriek(2)
Samurai  25  0  3.56  4.0  5.0  20.0  0.0  10.96  2.68  375.64  cut down by a Werebeast(4),cut down by a China Wolf(2),cut down by a Poltergeist(2)
Cleric  30  0  3.50  3.0  6.0  36.7  0.0  7.60  2.30  352.90  fell off a wall(7),starved in the dark(4),cut down by a China Wolf(2)
Apprentice  30  0  3.43  3.0  6.0  20.0  0.0  8.10  2.67  396.10  cut down by a Werebeast(4),cut down by a Hobgoblin(3),cut down by a Blumble(2)
Pickpocket  30  0  3.40  3.0  5.0  20.0  0.0  7.77  2.40  369.17  cut down by a Werebeast(4),starved in the dark(4),undone by a trap(4)
Summoner  30  0  3.23  4.0  5.0  13.3  0.0  8.07  2.17  391.50  cut down by a Gremlin(5),cut down by a Werebeast(4),cut down by a Dante(2)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Wilmsry  120  0  4.65  5.0  7.0  51.7  0.8  7.39  2.78  513.33  cut down by a Werebeast(14),fell off a wall(9),cut down by a Rinkle(8)
Troll  120  0  4.17  4.0  6.0  38.3  0.0  10.25  2.85  454.60  starved in the dark(26),fell off a wall(9),cut down by a Poltergeist(8)
Fridgian  115  0  4.09  4.0  6.0  34.8  0.0  10.09  2.84  441.58  cut down by a Werebeast(14),cut down by a Frank(10),undone by a trap(9)
Human  120  0  4.06  4.0  6.0  35.8  0.0  10.91  2.94  457.29  fell off a wall(15),cut down by a Werebeast(13),cut down by a Poltergeist(7)
Dwarven  120  0  3.61  4.0  6.0  23.3  0.0  8.99  2.51  395.55  cut down by a Werebeast(12),fell off a wall(9),cut down by a Poltergeist(8)
Elven  120  0  3.19  3.0  5.0  14.2  0.0  8.09  2.33  352.71  cut down by a Werebeast(14),cut down by a Poltergeist(12),starved in the dark(11)

POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  top causes
715  0  3.96  4.0  6.0  33.0  0.1  0.0  9.28  2.71  435.80  cut down by a Werebeast(74),fell off a wall(50),starved in the dark(50)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 715 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=5  workers=4  startDepth=1
```

#### Reading (BEFORE → AFTER)

| Metric | BEFORE (049ab50, Phase 52 AFTER) | AFTER (78572c5, Joiner level cap) |
|---|---|---|
| Solo death-depth min/p50/p90/max | 1 / 4 / 6 / 9 | 1 / 4 / 6 / 9 |
| Solo action-count p50 | 432 | 432 |
| Party death-depth min/p50/p90/max | 1 / 5 / 7 / 12 | 1 / 5 / 6 / 12 |
| Party action-count p50 | 703 | 580 |
| Solo top 3 death causes | fell off a wall 14 (7.0%); cut down by a Dante 13 (6.5%); cut down by a Werebeast 13 (6.5%) | fell off a wall 14 (7.0%); cut down by a Dante 13 (6.5%); cut down by a Werebeast 13 (6.5%) |
| Party top 3 death causes | starved in the dark 16 (8.0%); cut down by a Werebeast 9 (4.5%); fell off a wall 9 (4.5%) | starved in the dark 17 (8.5%); fell off a wall 17 (8.5%); cut down by a Werebeast 12 (6.0%) |
| Party stuck (hit maxActions) | 75 of 200 | 59 of 200 |
| Party member forced at run start / alive at run end | 192/200 forced; 153 alive (76.5%) | 192/200 forced; 125 alive (62.5%) |
| Class smoke overall mean depth (pooled, 715 runs) | 3.96 | 3.96 |
| Class smoke overall mean depth (mean of 143 cell means) | 3.959 | 3.959 |
| 3 largest movers UP (cell mean depth) | — | — (cells byte-identical to Phase 52's AFTER) |
| 3 largest movers DOWN (cell mean depth) | — | — (cells byte-identical to Phase 52's AFTER) |
| Party forced-ally level at run start (histogram L1/L2/L3/L4/L5, refused) | 55 / 45 / 26 / 33 / 41 (refused 0 of these — the Level Table roll happens regardless of the Wilmsry-vs-Magic-User refusal check below it; refusal is level-independent) | 192 / 0 / 0 / 0 / 0 (refused 8 — the SAME 8 seeds as BEFORE would refuse, since `meetJoiner`'s Wilmsry-vs-Magic-User refusal reads `c.race`/`joinerChar.cls`, never `lvl`) |

Solo is flat — byte-identical to Phase 52's AFTER on every field (death-depth
1/4/6/9 both sides, action-count p50 432 both sides, identical top-3 death
causes): the bot never recruits mid-run (it declines every in-run Joiner),
so a solo seed's trajectory can never reach `meetJoiner` at all, and this
is confirmed rather than assumed — see "Solo play untouched" below. The
`--party` column is where the rule shows: party death-depth p90 drops from
7 to 6 (max unchanged at 12), party action-count p50 drops sharply from 703
to 580, party stuck runs drop from 75 to 59 of 200, and the member-alive-at-
end rate drops from 76.5% (153/200) to 62.5% (125/200) — a level-1 ally is
a much weaker combatant and protector than the old 1–5 spread, so parties
lean on it less effectively and both die a little sooner (fewer runs
survive long enough to hit the 20000-action stuck cap) and lose their ally
more often. The forced-ally level histogram is the direct cause: BEFORE
spread across the full Level Table (1/1/2/2/3/3/4/4/5/5 draw odds, roughly
55/45/26/33/41 across levels 1–5 over 200 seeds); AFTER every non-refused
seed's ally is capped to depth 1, so all 192 read level 1. The refused
count (8/200, Wilmsry hero + Magic User joiner) is unchanged by this phase
— `meetJoiner`'s refusal check never reads `lvl`.

#### The --party shift (JOIN-03) — by design

`tools/lib/tuning-bot.mjs#forceParty` (unmodified) calls the engine's own
`meetJoiner` + `resolveJoiner(accept)` on a fresh depth-1 run, so under the
cap every `--party` run now starts with a level-1 ally (histogram: 192/200
non-refused runs at level 1) where it used to start with a Level-Table 1–5
ally (histogram BEFORE: 55/45/26/33/41 across levels 1–5). The `--party`
BEFORE → AFTER movement under identical flags IS the early-Joiner power
shift JOIN-03 asks to record — a by-design distribution change, not a
harness bug; nobody should "fix" `forceParty` to restore the old spread.
Party death-depth p90 fell from 7 to 6, action-count p50 fell from 703 to
580, stuck runs fell from 75 to 59 of 200, and the member-alive-at-end rate
fell from 153/200 (76.5%) to 125/200 (62.5%) — all consistent with a
weaker starting ally giving the party less staying power, exactly the
early-Joiner power shift the rule intends.

#### Solo play untouched — class-smoke identity

The bot declines every in-run Joiner (`tools/lib/tuning-bot.mjs` L1034,
policy D-20), so no solo or class-smoke run ever exercises the cap — the
AFTER smoke's `cells` array is byte-identical to Phase 52's
(`node -e` comparison of `docs/class-pass/v17-p52-after-smoke.json` and
`docs/class-pass/v17-p53-after-smoke.json`: `cellsIdentical true`), with
meta-parity `true` on every key except `commit` (`metaParity true []`).
This identity is the evidence that solo play is untouched by this phase —
combined with the solo bot readout above (byte-identical to Phase 52's
AFTER on every metric), there is no path in ordinary solo play that ever
reaches `meetJoiner` with a capped level, since the bot never accepts one
in the first place. Deferred idea (unchanged from 53-CONTEXT.md): teaching
the bot to accept in-run Joiners is a harness capability, not this rule —
a Phase 54 measurement candidate if the four-band retune wants a
Joiner-sensitive solo/class smoke.

### v1.7 · Phase 54 — four-band retune & roster decision

This H3 opens the four-band retune: `difficultyCurve` is reshaped toward
the user's four recorded bands (Filter 1-4 / Wall 5-8 / Breakaway 9-15 /
Endgame 16-20) on floors 5-15; floors 1-4 keep Phase 27's existing ramps;
16+ stays identity by construction so the `--start-depth 20` slice remains
the deep-lethality yardstick. Requirements BAND-01, BAND-02, BAND-03,
TUNE-08. Resolves todo
`2026-09-20-average-run-ends-floor-5-7-four-band-difficulty-shape.md`. Rung
sections, the change table, the miss table, the depth-20 identity proof and
the parity declaration are appended by Plan 02; the damage-curve audit and
the roster decision by Plan 03.

#### Target — the four bands, verbatim (BAND-01)

The user's stated tuning shape (2026-09-20), quoted verbatim from the todo:

> For a 20-floor dungeon designed to be highly challenging, the **average run should end around floor 5 to 7** — a sharp early curve where failure is common, so breaking deeper feels earned. Roguelike golden ratio: a standard run ends within the first 25–35% of total depth → floors 5, 6, 7. If players average floor 12, reaching 15 is nothing; if they usually die on 6, reaching 14 is an adrenaline run. Early deaths keep runs short — "just one more game".
>
> Four bands: **Floors 1–4, The Filter** — high variance; a few bad drops or early mistakes mean a quick death; cleared consistently only after mastering the basics. **Floors 5–8, The Wall** — where the average run dies; difficulty spikes; surviving needs skill or an item synergy. **Floors 9–15, The Breakaway Zone** — a strong run; still brutal, but the build gives a fighting chance. **Floors 16–20, The Endgame** — the true test; victory rare and celebrated.

#### Target as numbers (BAND-01)

**SUPERSEDED 2026-09-21 by USER RULING C — kept as history; the live target is the per-floor survival curve in the next section.**

| Measure | BEFORE (78572c5, Phase 53 AFTER) | Target | How measured | Edge rule |
|---|---|---|---|---|
| Solo median death depth | 4 | **5–7** | `tune-difficulty --seeds=200` p50 | closed, integer (a LIVE target: the Filter rungs of USER RULING A are the lever — see the bound section below) |
| Solo reach ≥ 5 | 33.0 % | recorded per rung (no BAND-01 number; Phase 27's ≥ 25 % floor stays the sanity floor; it moves ONLY when a Filter rung lands) | the readout's `>=5` | 1 dp |
| Solo p90 | 6 | **≈ 10–13** (closed 10..13) | p90 | integer |
| Solo reach ≥ 16 | 0.0 % (derived: reach ≥ 10 is 0.0 % and max is 9) | **a few percent = 2.0–6.0 %** | the Four-band readout `reach: >=16` | 1 dp |
| Solo reach ≥ 20 | 0.0 % | **well under 1 % = ≤ 0.5 %** (0–1 run of 200) | `>=20` | 1 dp |
| `--party` median | 5 | 5–7 | `--party` p50 | integer |
| `--party` p90 | 6 | ≈ 10–13 | advisory (the party instrument shifted by design in Phase 53) | — |
| class smoke pooled mean depth | 3.96 (715 runs) | moves toward the band (advisory direction; no class cell may collapse below its Phase 53 value by more than the pooled shift — violators listed per rung) | `rollups.pooled.meanDepth` of `v17-p54-rungN-smoke.json` | 2 dp |
| depth-20 slice | the BEFORE transcript below | **byte-identical on every rung** (hard) | `diff` against `readouts/before-start-depth-20.txt` | empty diff |

The ladder stops when the solo median is 5–7, solo p90, reach ≥ 16 and reach
≥ 20 are all inside the band, and the party median is 5–7; or at rung 4; or
when the only remaining move would touch floor 1 or add a NEW floor 1–4
dial (recorded as untaken, reason "floor-1 parity" / "no new Filter dial").
Rung 1 is the 5–15 band curve; if the solo median is still ≤ 4 after it,
rung 2 is a Filter rung (`FOE_GRACE_AT_2` down one notch, 0.5 → 0.4, and/or
`HAZARD_SCALE_AT_START` down when hazards are ≥ 20 % of floor 2–4 deaths),
then the ladder alternates by the readout. Misses are recorded per BAND-03
with the untaken rung and the reason.

#### Target — the per-floor survival curve (USER RULING C, 2026-09-21)

Mid-ladder (after rung 2), the user replaced BAND-01's numeric targets with
a per-floor survival CURVE — the rung 1/2 readouts showed the bot's
per-floor survival is ~90/89/81 % on floors 1–3, then **55 % / 37 % / 37 % /
20 %** on floors 4–7 — in the user's words: **"that curve is not a curve,
that's a wall."** The tuning target for the rest of Phase 54 is this table,
verbatim (individual survival `p_L` = chance of surviving floor L given you
reached it; cumulative `S_L` = chance a run reaches the end of floor L):

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
| 20 | 84.5 % | 5.0 % / 3.0 % | 🦄 The Unicorn Milestone (treat 3–5 % as the pass band) |
| 21 | 85.4 % | 2.5 % | The infinite crawl begins |
| 22 | 86.4 % | 2.2 % | |
| 23 | 87.2 % | 1.9 % | Less than 2 % survival |
| 24 | 88.1 % | 1.7 % | |
| 25 | 88.9 % | 1.5 % | |

**Pass bands:** floors 1–10 within ±8 points of the target `S_L`; floors
11–19 within ±3 points of `S_L`; runs reaching floor 20 within **3.0–5.0 %**
of all runs (the readout's `reach-20`, a rate, not a delta on `S_L` itself);
floors 21–25 are informational, read from the `--start-depth=20` slice; p_L
at 20+ is read against 84.5 % → 88.9 %, never diffed against BEFORE.

**The readout:** `tools/lib/band-readout.mjs`'s `Per-floor survival` block —
`p_L = 1 − deaths_L / reached_L`, `S_L = Π p_k` from the start depth, stuck
runs count as reached at every floor ≤ their current depth and never as a
death. Stop rule: the block's `verdict:` line is empty (every floor 1–19
inside its pass band and reach-20 inside 3.0–5.0 %), or six rungs have been
taken, or a floor-1 escalation fires (floors 2–20 on-curve but `p_1` still
< 95 % — the ladder stops and the exposure is written up for the user
instead of dialing floor 1).

**Relaxed discipline (USER RULING C, superseding the matching Area 1/Area 2
language above):** "Rules fidelity is relaxed for survival rates … It's ok
if we diverge from the actual rules we have enclosed in the pdf for
survival rates." Dials may leave canon at any depth ≥ 2 by any amount a
readout justifies; the engine gate still applies (measure → declare →
regenerate movers; the master file is never edited). Floor 1 stays
parity-exact unless the ladder itself proves floor 1 is off-curve. Rungs
are fits, not fixed notches; `ENDGAME_CANON_FROM_DEPTH` (renamed
`ENDGAME_FROM_DEPTH`), the literal-1 guard from floor 16, and
`COMBAT_SCALE_FROM_DEPTH = 21` are no longer sacred — Phase 27's "may only
ever move up" note on the 21+ ramp is superseded by this ruling.
`--max-actions` may be raised (a run cap, not policy) if deep runs start
hitting it. Ladder cap: **six rungs total** (rungs 1–2 already stand).

**The fit rule (deterministic; applied from the previous rung's SOLO
`Per-floor survival` table and the `--start-depth=20` slice; any override
needs a one-sentence recorded reason):** for each foePower knot K at depth
`d_K` ∈ {2, 3, 4, 5, 8, 9, 15, 16, 20}: `p_meas(K)` = the solo table's `p_L`
at `L = d_K` when `reached_L ≥ 10`; for K ∈ {16, 20} with fewer than 10
natural runs reaching 16, `p_meas` = the `--start-depth=20` slice's `p_20`
(used for both Endgame knots until natural data exists); any other knot
with `reached_L < 10` inherits `f_K` from the nearest shallower knot.
`Δ_K = p_target(d_K) − p_meas(K)` in points. `f_K = clamp(1 − Δ_K / 100,
0.6, 1.25)`. `next = round2(clamp(cur × f_K, 0.25, 1.5))`. The band's
hazard knot(s) move with the SAME `f_K` whenever hazard deaths (`fell off a
wall`, `undone by a trap`, `came up short on a leap`) are ≥ 15 % of that
band's deaths, clamped to `[0.25, 1.0]`; the band's ability knots move with
`f_K` only when kit-bearing foes are ≥ 25 % of the band's deaths, clamped
to `[0.5, 1.0]`. A band whose deaths are ≥ 50 % starvation/exhaustion gets
`f_K = 1` that rung (recorded `food economy` — never chased with a
`difficulty.js` dial). Overshoot self-corrects (Δ < 0 → f > 1). Secondary
group: when a band's foePower knot is already ≤ 0.5 and its hazard knot ≤
0.5 and the band still misses by > 8 points after two consecutive fits,
that rung moves `ENCOUNTER_DOT_CAP` by −1 and/or `DARK_BLOB_CAP` by −1
(floors 1–2 stay canon by construction), recorded as the secondary group.

**The knot design:** every existing constant name is kept and becomes a
knot — `FOE_GRACE_AT_1` (depth 1, never moves), `FOE_GRACE_AT_2` (2), NEW
`FOE_GRACE_AT_3` (3), NEW `FOE_GRACE_AT_4` (4), `WALL_FOE_POWER_AT_START`
(5), `WALL_FOE_POWER_AT_END` (8), `BREAKAWAY_FOE_POWER_AT_START` (9),
`BREAKAWAY_FOE_POWER_AT_END` (15), NEW `ENDGAME_FOE_POWER_AT_START` (16),
NEW `ENDGAME_FOE_POWER_AT_END` (20) — `bandLerp` between adjacent knots;
from `COMBAT_SCALE_FROM_DEPTH` (21) on, `ENDGAME_FOE_POWER_AT_END ×
softCapFloat(...)` (the Phase 21 ramp, now RELATIVE to the floor-20 value).
Hazard knots: floor 1 literal 1; `HAZARD_SCALE_AT_START` (2); NEW
`HAZARD_SCALE_AT_3` (3); NEW `HAZARD_SCALE_AT_4` (4); `WALL_HAZARD_SCALE`
flat 5–8; NEW `BREAKAWAY_HAZARD_SCALE` flat 9–15; NEW `ENDGAME_HAZARD_SCALE`
flat 16+. Ability knots: literal 1 on 1–4; the existing WALL/BREAKAWAY
pairs; NEW `ENDGAME_ABILITY_THREAT_AT_START/END` (16/20); 21+ = END × the
Phase 21 ability ramp. `ENDGAME_CANON_FROM_DEPTH` is renamed
`ENDGAME_FROM_DEPTH` (16) with a new `ENDGAME_TO_DEPTH` (20);
`FOE_GRACE_CANON_FROM_DEPTH`, `HAZARD_FLAT_THROUGH_DEPTH`,
`HAZARD_CANON_FROM_DEPTH` are RETIRED (replaced by the knot table; history
kept in the change table). `bandFoePowerFor`/`graceFor`/
`bandAbilityThreatFor` are replaced by `knotFoePowerFor(d)`/
`knotHazardFor(d)`/`knotAbilityThreatFor(d)`.

Rulings A and B stand; Ruling A's 0.35 / 0.3 ceilings are superseded by the
clamps above. Rungs 1–2 (`b0facb6`, `850f176`) STAND — see `#### Rung 2`
below, written retroactively from the committed raw readouts (`27e209c`).

#### Structural bound — reach ≥ 5 is fixed by floors 1–4

Under a 5–15-only dial, the bot's runs are byte-identical through floor 4
(`difficultyCurve` is consulted per current depth), so solo reach ≥ 5 would
stay exactly 33.0 % (party 55.3 %) and the solo MEDIAN death depth would be
bounded at 4 by construction. Phase 27's own calibration note (`#### Planner
calibration (2026-09-15, directional)`) measured the full early-floor
ladder's ceiling at bot median 4 with reach ≥ 5 ≈ 35 % — the same ceiling
this plan's objective derives independently. USER RULING C (2026-09-21)
replaces the numeric bands with the per-floor curve; the median is now
implied by the curve (S_L crosses 50 % between floors 6 and 7).

**USER RULING A (2026-09-21)** — supersedes the matching Area 1 / Area 2
lines in 54-CONTEXT.md: the ladder MAY move the EXISTING Phase 27 floor 2–4
dials — `FOE_GRACE_AT_2` (0.5 → as far as 0.35) and `HAZARD_SCALE_AT_START`
(0.5, may drop) — as rungs. Floor 1 stays exact identity (`FOE_GRACE_AT_1 =
1.0`, `HAZARD_FROM_DEPTH >= 2`, floor-1 dots/dark canon — parity); the
grace/hazard ramps still reach exactly 1.0 at their existing canon-from
depths (`FOE_GRACE_CANON_FROM_DEPTH` / `HAZARD_CANON_FROM_DEPTH` = 5); and
NO new floor 1–4 dials (no density/dark change on 1–4).

Consequences: the solo median 5–7 is a LIVE target; reach ≥ 5 is a per-rung
recorded number, not an invariant; the "floors 1–4 did not move" proof
becomes a FLOOR-1-untouched proof (the depth-20 slice still identity, a
`difficultyCurve(1)` literal pin, and the fixture scan Part B on the
floor-1 fixtures diffing empty — measured per rung); floors 2–4 literals
become re-pinnable per Filter rung and never loosened. This plan (54-01)
lands NO Filter move — it only pins floor 1 and the Filter values as they
stand at `78572c5`.

**Parameters (identical on every rung):**
- `node tools/tune-difficulty.mjs --seeds=200` (solo)
- `node tools/tune-difficulty.mjs --seeds=200 --party`
- `node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p54-rungN-smoke.json` (N = the rung; the final rung's file is copied to `v17-p54-after-smoke.json`)
- `node tools/tune-difficulty.mjs --seeds=50 --start-depth=20`

`tools/tune-difficulty.mjs` now prints an always-on `Four-band readout`
block (Task 1, BAND-01) — reach ≥16/≥20, band share of deaths, and per-band
top death causes over completed runs; `tools/lib/tuning-bot.mjs` (the bot
policy) is frozen for the whole phase.

#### BEFORE — by reference: Phase 53 AFTER, commit 78572c5115014b581fb2084b7588141122d56101 (Joiner level capped by floor depth) + the --start-depth=20 slice

BEFORE is not re-run for solo/`--party`/class smoke — per the measurement
gate, Phase 53's own AFTER readout (quoted verbatim under `### v1.7 · Phase
53 — Joiner level cap`, `#### AFTER — commit
78572c5115014b581fb2084b7588141122d56101`, above) is reused as this
phase's BEFORE: solo death-depth min/p50/p90/max 1/4/6/9, reach ≥5 33.0 % /
≥10 0.0 % / ≥20 0.0 %, solo action-count p50 432; party death-depth
min/p50/p90/max 1/5/6/12, reach ≥5 55.3 % / ≥10 1.4 %, party stuck 59 of
200; class smoke pooled mean depth (715 runs) 3.96 (`docs/class-pass/v17-p53-after-smoke.json`).
Same bot flags, same seeds, same files.

`node tools/tune-difficulty.mjs --seeds=50 --start-depth=20` — run ONCE on
the untouched engine (commit A, `git diff --stat 78572c5 -- engine/
content/` empty):

```

tune-difficulty: 50 seeded auto-play run(s), start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=20  p50=20  p90=22  max=27

Action-count distribution:
  min=9  p50=104  p90=331  max=690

Death-cause breakdown:
  cut down by a Herman 11 (22.0%)
  cut down by a Stalka Beast 9 (18.0%)
  cut down by a Drarl  9 (18.0%)
  cut down by a Vampire 8 (16.0%)
  cut down by a Dread Lock 4 (8.0%)
  cut down by a Djinni 4 (8.0%)
  fell off a wall      2 (4.0%)
  starved in the dark  1 (2.0%)
  cut down by a Drake  1 (2.0%)
  cut down by a Spectre 1 (2.0%)

Parley (D-15 readout — informational, not a gate):
  attempts=36  successes=26 (72.2%)  failures=10  refused=0  exhausted=0
  runs with >=1 attempt: 11 of 50
  SP from parley: 979 of 110636 total SP (0.9%)

Reach table (% of runs reaching floor N):
  >=5: 100.0%  >=10: 100.0%  >=20: 100.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=0  p50=5  p90=15  max=26

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 0/0 (0.0%)
  6-10: 0/0 (0.0%)
  11-20: 71/109 (65.1%)
  21-30: 47/85 (55.3%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=229  foeBolted=70  foeDrained=11  foeDebuffed=2  foeHealed=5  foeSummoned=0
  heroResisted=134  heroResistFailed=37
  ability damage: 688 of 4750 total damage taken (14.5%)

Stuck: 0 of 50 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=50  startDepth=20

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 20:32  21:7  22:7  23:2  25:1  27:1
  mean death depth=20.78  floors gained p50=0 mean=0.78  encounters survived mean=2.94
  reach: >=5 100.0%  >=8 100.0%  >=9 100.0%  >=10 100.0%  >=13 100.0%  >=16 100.0%  >=20 100.0%
  band share of deaths: Filter 1-4 0.0% | Wall 5-8 0.0% | Breakaway 9-15 0.0% | Endgame 16-20 64.0% | beyond 20 36.0%
  top causes — Filter: (none)
  top causes — Wall: (none)
  top causes — Breakaway: (none)
  top causes — Endgame: cut down by a Herman 8, cut down by a Stalka Beast 8, cut down by a Djinni 4, cut down by a Drarl 4, cut down by a Vampire 4

Outcome: 50 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)

```

**Curve at 1..25, 35, 50 (Phase 53, commit 78572c5 — byte-identical at the scaffold commit)**

| d | dots | darkBlobs | darkRadius | foePower | hazardScale | foeCap | abilityThreat |
|---|---|---|---|---|---|---|---|
| 1 | 10 | 0 | 4 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 2 | 11 | 1 | 5 | 0.5000 | 0.5000 | 3 | 1.0000 (exact) |
| 3 | 11 | 1 | 6 | 0.6667 | 0.5000 | 3 | 1.0000 (exact) |
| 4 | 11 | 2 | 7 | 0.8333 | 0.7500 | 3 | 1.0000 (exact) |
| 5 | 11 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 6 | 9 | 0 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 7 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 8 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 9 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 10 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 11 | 9 | 0 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 12 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 13 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 14 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 15 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 16 | 9 | 0 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 17 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 18 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 19 | 13 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 20 | 13 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 21 | 9 | 0 | 7 | 1.0042 | 1.0000 (exact) | 3 | 1.0098 |
| 22 | 13 | 3 | 7 | 1.0083 | 1.0000 (exact) | 3 | 1.0193 |
| 23 | 13 | 3 | 7 | 1.0123 | 1.0000 (exact) | 3 | 1.0285 |
| 24 | 13 | 3 | 7 | 1.0162 | 1.0000 (exact) | 3 | 1.0374 |
| 25 | 13 | 3 | 7 | 1.0200 | 1.0000 (exact) | 3 | 1.0461 |
| 35 | 13 | 3 | 7 | 1.0523 | 1.0000 (exact) | 4 | 1.1180 |
| 50 | 13 | 3 | 7 | 1.0863 | 1.0000 (exact) | 4 | 1.1896 |

#### Scaffold — commit 258e04dc3572714e2c717ebf9aaf3256c5fba154 (band constants at identity; curve byte-identical)

| Constant | Value (scaffold) | Band | Identity guarantee |
|---|---|---|---|
| `WALL_FROM_DEPTH` | 5 | Wall | must equal `FOE_GRACE_CANON_FROM_DEPTH` — the grace band hands straight to the Wall |
| `WALL_TO_DEPTH` | 8 | Wall | — |
| `WALL_FOE_POWER_AT_START` | 1.0 | Wall | identity (foePower at WALL_FROM_DEPTH) |
| `WALL_FOE_POWER_AT_END` | 1.0 | Wall | identity (foePower at WALL_TO_DEPTH) |
| `BREAKAWAY_FROM_DEPTH` | 9 | Breakaway | — |
| `BREAKAWAY_TO_DEPTH` | 15 | Breakaway | — |
| `BREAKAWAY_FOE_POWER_AT_START` | 1.0 | Breakaway | identity |
| `BREAKAWAY_FOE_POWER_AT_END` | 1.0 | Breakaway | identity |
| `ENDGAME_CANON_FROM_DEPTH` | 16 | Endgame | the literal `1` by the `>=` guard (structural, not rounding) |
| `WALL_HAZARD_SCALE` | 1.0 | Wall | identity — the literal `1` for `scaleHazard`'s `=== 1` fast path |
| `WALL_ABILITY_THREAT_AT_START` | 1.0 | Wall | identity |
| `WALL_ABILITY_THREAT_AT_END` | 1.0 | Wall | identity |
| `BREAKAWAY_ABILITY_THREAT_AT_START` | 1.0 | Breakaway | identity |
| `BREAKAWAY_ABILITY_THREAT_AT_END` | 1.0 | Breakaway | identity |

`bandLerp(a, b, t)` is the endpoint-exact linear interpolation the band
curve uses: when `a === b` it returns `a` for ANY `t` (identity by
construction, no float drift — the same discipline
`COMBAT_SCALE_FROM_DEPTH`'s `over` guard and `graceFor`'s `>=` guard use),
and is exact at `t = 0`/`t = 1` otherwise.

Byte-identity evidence: a `node -e` capture of `difficultyCurve(d)` for
d in [1..25, 35, 50] on the untouched engine (commit `78572c5`) diffed
empty against the same capture on the scaffolded engine (commit
258e04dc3572714e2c717ebf9aaf3256c5fba154) — see the curve table above, generated from the SAME captured
JSON both times. Structural pins: `test/difficulty/difficulty.test.js`'s
`Phase 54 (BAND-02) structural pins…`, `…floor-1 parity…`, `…Filter
cushion 2..4…`, `…Endgame identity…`, `…band curve 5..15…`, `…the Wall
steps UP…`, `…stays draw-free…`; `test/unit/combat-scaling.test.js`'s
`PHASE_54_PINS`, `band 5..15 (Phase 54, BAND-02)…`, `Endgame identity band
(Phase 54, BAND-01)…`, `band wiring (Phase 54, BAND-02)…`.

Pin discipline: the 5..15 block (`BAND_PINS` in
`test/difficulty/difficulty.test.js`, `PHASE_54_PINS` in
`test/unit/combat-scaling.test.js`) is re-pinned by band rungs and the 2..4
block (`FILTER_PINS`; `PHASE_27_PINS.FOE_GRACE_AT_2` /
`.HAZARD_SCALE_AT_START` in combat-scaling; the depth-2 hazard pins in
`test/unit/movement.test.js` and `test/unit/encounters.test.js`; the
`humans-t2` / `magical-t4` determinism specs) by Filter rungs — never
loosened, always citing the rung; the floor-1 literal and the 16+ block are
never re-pinned this phase.

#### Rung 1 — commit b0facb6216eb23a1f45bda33bae3c7e99780112e (Wall foePower 0.85 -> 0.95 on 5-8; Breakaway 0.95 -> 1.0 on 9-15; literal 1 from 16)

The prescribed starting notch (54-CONTEXT Area 1 / constraint 11): a step at
5 that lands below identity (the Wall) easing back to exactly 1.0 by 15
(the Breakaway), 16+ untouched.

**Constants (Old -> New):**

| Constant | Old | New |
|---|---|---|
| `WALL_FOE_POWER_AT_START` | 1.0 | 0.85 |
| `WALL_FOE_POWER_AT_END` | 1.0 | 0.95 |
| `BREAKAWAY_FOE_POWER_AT_START` | 1.0 | 0.95 |

(`BREAKAWAY_FOE_POWER_AT_END` unchanged at 1.0 — not moved this rung; hazardScale/abilityThreat band constants unchanged at identity this rung.)

**Curve 4..16 (foePower / hazardScale / abilityThreat), measured via `node -e` against the R1A commit:**

| d | dots | darkBlobs | darkRadius | foePower | hazardScale | foeCap | abilityThreat |
|---|---|---|---|---|---|---|---|
| 4 | 11 | 2 | 7 | 0.8333 | 0.7500 | 3 | 1.0000 (exact) |
| 5 | 11 | 3 | 7 | 0.8500 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 6 | 9 | 0 | 7 | 0.8833 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 7 | 12 | 3 | 7 | 0.9167 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 8 | 12 | 3 | 7 | 0.9500 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 9 | 12 | 3 | 7 | 0.9500 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 10 | 12 | 3 | 7 | 0.9583 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 11 | 9 | 0 | 7 | 0.9667 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 12 | 12 | 3 | 7 | 0.9750 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 13 | 12 | 3 | 7 | 0.9833 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 14 | 12 | 3 | 7 | 0.9917 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 15 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 16 | 9 | 0 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |

**`node tools/tune-difficulty.mjs --seeds=200` (solo, on commit b0facb6216eb23a1f45bda33bae3c7e99780112e):**

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=6  max=10

Action-count distribution:
  min=36  p50=432  p90=649  max=991

Death-cause breakdown:
  fell off a wall      13 (6.5%)
  cut down by a Dante  13 (6.5%)
  cut down by a Werebeast 13 (6.5%)
  cut down by a Poltergeist 11 (5.5%)
  undone by a trap     11 (5.5%)
  cut down by a Rinkle 10 (5.0%)
  starved in the dark  10 (5.0%)
  spent by the dungeon itself 9 (4.5%)
  cut down by a Philly 8 (4.0%)
  cut down by a Drarl  8 (4.0%)
  came up short on a leap 7 (3.5%)
  cut down by a Blumble 6 (3.0%)
  cut down by a Shadow 6 (3.0%)
  cut down by a Frank  5 (2.5%)
  cut down by a Craig  5 (2.5%)
  cut down by a Drake  4 (2.0%)
  cut down by a Primp  4 (2.0%)
  cut down by a Trachea 4 (2.0%)
  cut down by a Gremlin 4 (2.0%)
  cut down by a Cave Bear 3 (1.5%)
  cut down by a Stink Bug 3 (1.5%)
  cut down by a Google 3 (1.5%)
  cut down by a Djinni 3 (1.5%)
  cut down by a Dog Face 3 (1.5%)
  cut down by a Zombie 3 (1.5%)
  cut down by a Herman 3 (1.5%)
  cut down by a Skeleton 3 (1.5%)
  cut down by a Hair   3 (1.5%)
  cut down by a China Wolf 3 (1.5%)
  cut down by a Krupke 2 (1.0%)
  cut down by a Flube  2 (1.0%)
  cut down by a Ghost  2 (1.0%)
  cut down by a Drekk  2 (1.0%)
  cut down by a Rast   1 (0.5%)
  cut down by a Viper  1 (0.5%)
  cut down by a Zit    1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)
  cut down by a Spectre 1 (0.5%)
  cut down by a Pogo   1 (0.5%)
  cut down by a M&M    1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Sterling 1 (0.5%)
  cut down by a Drat   1 (0.5%)
  cut down by a Ghoul  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=309  successes=193 (62.5%)  failures=116  refused=0  exhausted=0
  runs with >=1 attempt: 66 of 200
  SP from parley: 2894 of 127811 total SP (2.3%)

Reach table (% of runs reaching floor N):
  >=5: 33.0%  >=10: 0.5%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=33  p50=106  p90=145  max=187

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 51/1967 (2.6%)
  6-10: 36/83 (43.4%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=137  foeBolted=49  foeDrained=1  foeDebuffed=20  foeHealed=1  foeSummoned=0
  heroResisted=51  heroResistFailed=14
  ability damage: 294 of 15505 total damage taken (1.9%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 1:19  2:19  3:39  4:57  5:38  6:16  7:6  8:2  9:3  10:1
  mean death depth=3.92  floors gained p50=3 mean=2.92  encounters survived mean=9.50
  reach: >=5 33.0%  >=8 3.0%  >=9 2.0%  >=10 0.5%  >=13 0.0%  >=16 0.0%  >=20 0.0%
  band share of deaths: Filter 1-4 67.0% | Wall 5-8 31.0% | Breakaway 9-15 2.0% | Endgame 16-20 0.0% | beyond 20 0.0%
  top causes — Filter: cut down by a Dante 12, cut down by a Poltergeist 11, fell off a wall 9, undone by a trap 9, cut down by a Philly 8
  top causes — Wall: cut down by a Drarl 7, cut down by a Craig 5, cut down by a Werebeast 5, came up short on a leap 4, cut down by a Frank 4
  top causes — Breakaway: cut down by a Djinni 2, cut down by a Drarl 1, cut down by a Herman 1
  top causes — Endgame: (none)

Outcome: 200 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

**`node tools/tune-difficulty.mjs --seeds=200 --party` (on commit b0facb6216eb23a1f45bda33bae3c7e99780112e):**

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=5  p90=7  max=12

Action-count distribution:
  min=21  p50=586  p90=20000  max=20000

Death-cause breakdown:
  fell off a wall      16 (8.0%)
  starved in the dark  15 (7.5%)
  cut down by a Werebeast 14 (7.0%)
  undone by a trap     11 (5.5%)
  cut down by a Drarl  10 (5.0%)
  cut down by a Dante  7 (3.5%)
  came up short on a leap 4 (2.0%)
  cut down by a Drake  4 (2.0%)
  cut down by a Blumble 4 (2.0%)
  cut down by a Primp  3 (1.5%)
  cut down by a Frank  3 (1.5%)
  cut down by a Zombie 3 (1.5%)
  spent by the dungeon itself 3 (1.5%)
  cut down by a Trachea 3 (1.5%)
  cut down by a Google 3 (1.5%)
  cut down by a Rast   2 (1.0%)
  cut down by a Drekk  2 (1.0%)
  cut down by a Craig  2 (1.0%)
  cut down by a Herman 2 (1.0%)
  cut down by a Gremlin 2 (1.0%)
  cut down by a Undead 2 (1.0%)
  cut down by a Wolf   2 (1.0%)
  cut down by a Djinni 2 (1.0%)
  cut down by a Skeleton 2 (1.0%)
  cut down by a Poltergeist 2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Zit    2 (1.0%)
  cut down by a Sterling 2 (1.0%)
  cut down by a Stalka Beast 1 (0.5%)
  cut down by a Rinkle 1 (0.5%)
  cut down by a Ghoul  1 (0.5%)
  cut down by a Ghost  1 (0.5%)
  cut down by a Bones  1 (0.5%)
  cut down by a Spectre 1 (0.5%)
  cut down by a Philly 1 (0.5%)
  cut down by a Floater 1 (0.5%)
  cut down by a Dread Lock 1 (0.5%)
  cut down by a Bat/Rat 1 (0.5%)
  cut down by a Viper  1 (0.5%)
  cut down by a Stink Bug 1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=343  successes=217 (63.3%)  failures=126  refused=0  exhausted=0
  runs with >=1 attempt: 70 of 200
  SP from parley: 3167 of 130559 total SP (2.4%)

Reach table (% of runs reaching floor N):
  >=5: 55.6%  >=10: 1.4%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=21  p50=106  p90=138  max=229

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 49/2059 (2.4%)
  6-10: 41/147 (27.9%)
  11-20: 1/4 (25.0%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=179  foeBolted=62  foeDrained=1  foeDebuffed=13  foeHealed=3  foeSummoned=2
  heroResisted=87  heroResistFailed=33
  ability damage: 212 of 9836 total damage taken (2.2%)

Party (--party, D-12/D-20):
  member forced at run start in 192/200 runs; member alive at run end: 124 (62.0%)

Stuck: 58 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 1:8  2:12  3:14  4:29  5:43  6:18  7:12  8:4  10:1  12:1
  mean death depth=4.58  floors gained p50=4 mean=3.58  encounters survived mean=11.39
  reach: >=5 55.6%  >=8 4.2%  >=9 1.4%  >=10 1.4%  >=13 0.0%  >=16 0.0%  >=20 0.0%
  band share of deaths: Filter 1-4 44.4% | Wall 5-8 54.2% | Breakaway 9-15 1.4% | Endgame 16-20 0.0% | beyond 20 0.0%
  top causes — Filter: starved in the dark 11, fell off a wall 8, undone by a trap 7, cut down by a Dante 6, cut down by a Google 3
  top causes — Wall: cut down by a Werebeast 11, cut down by a Drarl 9, fell off a wall 8, cut down by a Blumble 4, cut down by a Drake 4
  top causes — Breakaway: cut down by a Drarl 1, cut down by a Herman 1
  top causes — Endgame: (none)

Outcome: 142 dead, 58 stuck (hit maxActions=20000; excluded from depth stats)
```

**`node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p54-rung1-smoke.json` (stdout — the ranked matrix; stderr's elapsed line `elapsed: 133.0s workers=4 runs=715` is not quoted, per this ledger's own convention):**

```
tune-classes: 143 cells x 5 seeds (715 runs) — start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
1  Thief  Ninja  Wilmsry  5  0  6.80  7.0  8.0  100.0  0.0  18.00  4.00  736.80  cut down by a Djinni(1),cut down by a Drake(1),cut down by a Drarl(1)
2  Thief  Con Artist  Wilmsry  5  0  6.80  7.0  10.0  80.0  20.0  2.80  3.60  735.20  came up short on a leap(2),cut down by a Craig(1),cut down by a Drarl(1)
3  Thief  Ninja  Human  5  0  6.20  5.0  9.0  80.0  0.0  14.20  4.00  626.60  cut down by a Drarl(1),cut down by a Drudge(1),cut down by a Herman(1)
4  Thief  Acrobat  Wilmsry  5  0  6.00  6.0  8.0  100.0  0.0  7.60  3.20  626.00  cut down by a Werebeast(2),cut down by a Rast(1),cut down by a Rinkle(1)
5  Fighter  Knight  Wilmsry  5  0  5.80  6.0  7.0  80.0  0.0  4.00  3.20  617.40  cut down by a Blumble(3),cut down by a Djinni(1),cut down by a Werebeast(1)
6  Magic User  Warlock  Dwarven  5  0  5.60  4.0  9.0  40.0  0.0  18.40  3.80  679.40  cut down by a Vampire(2),cut down by a Cave Bear(1),cut down by a Rinkle(1)
7  Fighter  Woodsman  Wilmsry  5  0  5.40  5.0  7.0  80.0  0.0  7.40  3.20  625.60  cut down by a Drarl(1),cut down by a Werebeast(1),cut down by a Zit(1)
8  Thief  Cutthroat  Wilmsry  5  0  5.40  5.0  9.0  60.0  0.0  8.60  3.40  580.40  cut down by a Shadow(1),cut down by a Undead(1),cut down by a Vampire(1)
9  Thief  Cloaker  Wilmsry  5  0  5.20  6.0  9.0  60.0  0.0  10.20  3.40  600.20  cut down by a Drake(1),cut down by a Drarl(1),cut down by a Poltergeist(1)
10  Thief  Ninja  Troll  5  0  5.20  6.0  6.0  60.0  0.0  16.20  3.60  573.40  cut down by a Blumble(1),cut down by a Craig(1),cut down by a Drudge(1)
11  Thief  Ninja  Dwarven  5  0  5.20  5.0  7.0  60.0  0.0  11.40  3.40  513.20  cut down by a Primp(2),cut down by a Drake(1),cut down by a Ghoul(1)
12  Fighter  Bard  Wilmsry  5  0  5.00  5.0  6.0  80.0  0.0  11.00  3.00  593.60  cut down by a Frank(1),cut down by a Poltergeist(1),cut down by a Primp(1)
13  Magic User  Wizard  Fridgian  5  0  5.00  5.0  7.0  80.0  0.0  7.00  3.20  556.80  cut down by a Drake(2),cut down by a Blumble(1),cut down by a Gremlin(1)
14  Thief  Con Artist  Dwarven  5  0  5.00  5.0  7.0  60.0  0.0  1.80  3.20  577.80  cut down by a Dante(1),cut down by a Werebeast(1),fell off a wall(1)
15  Fighter  Knight  Human  5  0  5.00  5.0  7.0  60.0  0.0  9.80  4.20  559.20  cut down by a Drarl(2),cut down by a Werebeast(2),cut down by a Primp(1)
16  Thief  Pilfer  Wilmsry  5  0  5.00  5.0  7.0  60.0  0.0  8.20  3.20  570.20  cut down by a Ghoul(1),cut down by a Poltergeist(1),cut down by a Zombie(1)
17  Fighter  Bard  Fridgian  5  0  5.00  4.0  7.0  40.0  0.0  8.20  3.40  494.60  cut down by a Herman(1),cut down by a Rinkle(1),cut down by a Spectre(1)
18  Magic User  Warlock  Wilmsry  5  0  5.00  4.0  9.0  40.0  0.0  10.00  3.00  702.80  cut down by a Dread Lock(1),cut down by a Drudge(1),cut down by a Philly(1)
19  Fighter  Knight  Fridgian  5  0  4.80  5.0  5.0  80.0  0.0  7.00  3.00  516.00  cut down by a Frank(3),cut down by a Cave Bear(1),fell off a wall(1)
20  Magic User  Warlock  Fridgian  5  0  4.80  5.0  5.0  80.0  0.0  12.00  3.40  563.00  cut down by a Werebeast(3),cut down by a Spectre(1),spent by the dungeon itself(1)
21  Thief  Cat Burglar  Wilmsry  5  0  4.80  5.0  7.0  60.0  0.0  5.60  2.80  512.00  undone by a trap(2),cut down by a Craig(1),cut down by a Rinkle(1)
22  Thief  Con Artist  Human  5  0  4.80  5.0  7.0  60.0  0.0  2.20  3.00  551.40  fell off a wall(2),came up short on a leap(1),cut down by a Ghoul(1)
23  Magic User  Court Mage  Fridgian  5  0  4.80  5.0  6.0  60.0  0.0  15.20  3.60  451.40  cut down by a Bones(1),cut down by a Drarl(1),cut down by a Drat(1)
24  Thief  Ninja  Fridgian  5  0  4.80  5.0  6.0  60.0  0.0  14.00  3.60  535.60  cut down by a Rinkle(2),cut down by a Craig(1),cut down by a Drake(1)
25  Fighter  Woodsman  Troll  5  0  4.80  5.0  7.0  60.0  0.0  6.60  3.00  437.00  cut down by a Werebeast(2),starved in the dark(2),cut down by a Blumble(1)
26  Thief  Cloaker  Troll  5  0  4.80  4.0  7.0  40.0  0.0  12.60  3.20  507.00  starved in the dark(3),cut down by a Blumble(1),fell off a wall(1)
27  Fighter  Soldier  Human  5  0  4.80  4.0  7.0  40.0  0.0  11.60  3.80  594.00  cut down by a Drake(1),cut down by a Frank(1),cut down by a Hair(1)
28  Magic User  Sorcerer  Fridgian  5  0  4.80  4.0  7.0  40.0  0.0  16.00  3.20  516.60  cut down by a Werebeast(2),cut down by a Drudge(1),cut down by a Frank(1)
29  Magic User  Warlock  Troll  5  0  4.60  6.0  7.0  60.0  0.0  12.80  3.40  520.20  starved in the dark(2),came up short on a leap(1),cut down by a Drake(1)
30  Fighter  Barbarian  Troll  5  0  4.60  5.0  5.0  80.0  0.0  11.80  2.80  476.00  cut down by a Blumble(1),cut down by a Frank(1),cut down by a Poltergeist(1)
31  Magic User  Court Mage  Human  5  0  4.60  5.0  8.0  60.0  0.0  11.00  3.00  448.20  fell off a wall(3),cut down by a Drarl(1),cut down by a Herman(1)
32  Fighter  Guard  Troll  5  0  4.60  5.0  5.0  60.0  0.0  9.80  3.40  529.40  starved in the dark(2),cut down by a Craig(1),cut down by a Ghost(1)
33  Thief  Acrobat  Dwarven  5  0  4.60  4.0  6.0  40.0  0.0  14.80  3.20  483.40  cut down by a Craig(1),cut down by a Google(1),cut down by a Trachea(1)
34  Fighter  Bard  Human  5  0  4.60  4.0  8.0  40.0  0.0  11.40  3.20  516.80  cut down by a Werebeast(2),cut down by a Philly(1),cut down by a Poltergeist(1)
35  Fighter  Guard  Wilmsry  5  0  4.60  4.0  8.0  40.0  0.0  8.00  2.40  501.80  came up short on a leap(1),cut down by a Bat/Rat(1),cut down by a Dante(1)
36  Magic User  Illusionist  Troll  5  0  4.60  4.0  8.0  40.0  0.0  9.40  2.80  485.80  cut down by a Cave Bear(1),cut down by a Drat(1),cut down by a Hobgoblin(1)
37  Fighter  Master of Arms  Troll  5  0  4.60  4.0  7.0  40.0  0.0  9.60  3.20  480.80  cut down by a Herman(2),cut down by a Poltergeist(2),starved in the dark(1)
38  Magic User  Sorcerer  Human  5  0  4.60  4.0  6.0  40.0  0.0  14.40  3.40  585.00  cut down by a Rast(1),cut down by a Spectre(1),cut down by a Trachea(1)
39  Magic User  Wizard  Troll  5  0  4.60  4.0  7.0  40.0  0.0  11.40  3.40  542.60  cut down by a Herman(1),cut down by a Primp(1),cut down by a Rinkle(1)
40  Fighter  Woodsman  Fridgian  5  0  4.60  4.0  7.0  40.0  0.0  7.00  3.00  442.60  cut down by a Rinkle(2),cut down by a Frank(1),cut down by a Poltergeist(1)
41  Magic User  Sorcerer  Wilmsry  5  0  4.60  4.0  9.0  20.0  0.0  7.40  2.60  493.60  cut down by a China Wolf(1),cut down by a Djinni(1),cut down by a Google(1)
42  Magic User  Sorcerer  Dwarven  5  0  4.40  6.0  7.0  60.0  0.0  14.00  3.20  527.80  cut down by a China Wolf(1),cut down by a Dread Lock(1),cut down by a Frank(1)
43  Thief  Cloaker  Human  5  0  4.40  5.0  5.0  60.0  0.0  11.00  3.00  487.60  starved in the dark(2),came up short on a leap(1),cut down by a Poltergeist(1)
44  Thief  Con Artist  Troll  5  0  4.40  5.0  5.0  60.0  0.0  3.40  2.60  487.00  starved in the dark(3),cut down by a Poltergeist(1),undone by a trap(1)
45  Magic User  Warlock  Human  5  0  4.40  5.0  6.0  60.0  0.0  14.60  3.20  507.40  cut down by a Philly(1),cut down by a Rinkle(1),cut down by a Spectre(1)
46  Thief  Acrobat  Fridgian  5  0  4.40  4.0  5.0  40.0  0.0  12.40  3.20  455.60  cut down by a Craig(1),cut down by a Frank(1),cut down by a Poltergeist(1)
47  Thief  Cat Burglar  Troll  5  0  4.40  4.0  6.0  40.0  0.0  14.00  3.40  502.00  cut down by a Bones(1),cut down by a Drake(1),cut down by a Rinkle(1)
48  Fighter  Samurai  Wilmsry  5  0  4.40  4.0  6.0  40.0  0.0  11.20  2.80  482.80  cut down by a China Wolf(2),cut down by a Rinkle(1),fell off a wall(1)
49  Fighter  Soldier  Troll  5  0  4.40  4.0  5.0  40.0  0.0  9.00  3.00  405.40  cut down by a Bones(1),cut down by a Frank(1),cut down by a Poltergeist(1)
50  Thief  Acrobat  Human  5  0  4.40  4.0  7.0  20.0  0.0  13.60  3.20  454.00  cut down by a Werebeast(2),cut down by a Floater(1),cut down by a Sterling(1)
51  Magic User  Illusionist  Wilmsry  5  0  4.20  5.0  6.0  60.0  0.0  6.60  2.40  466.20  cut down by a Google(1),cut down by a M&M(1),cut down by a Primp(1)
52  Fighter  Barbarian  Fridgian  5  0  4.20  4.0  6.0  40.0  0.0  12.80  2.60  519.60  came up short on a leap(1),cut down by a Cave Bear(1),cut down by a Drake(1)
53  Fighter  Barbarian  Human  5  0  4.20  4.0  5.0  40.0  0.0  18.60  3.00  504.20  cut down by a Blumble(2),cut down by a Dante(1),cut down by a Frank(1)
54  Magic User  Court Mage  Dwarven  5  0  4.20  4.0  7.0  40.0  0.0  11.40  2.60  431.80  cut down by a Dante(1),cut down by a Drudge(1),cut down by a Hobgoblin(1)
55  Fighter  Soldier  Wilmsry  5  0  4.20  4.0  6.0  40.0  0.0  4.80  2.60  428.20  cut down by a Poltergeist(1),cut down by a Werebeast(1),cut down by a Zit(1)
56  Magic User  Wizard  Wilmsry  5  0  4.20  4.0  7.0  40.0  0.0  4.40  2.60  522.80  cut down by a Drarl(1),cut down by a Gremlin(1),cut down by a Primp(1)
57  Thief  Cloaker  Elven  5  0  4.20  4.0  5.0  20.0  0.0  9.40  2.80  468.20  cut down by a Poltergeist(1),cut down by a Primp(1),cut down by a Rinkle(1)
58  Magic User  Cleric  Troll  5  0  4.00  5.0  5.0  60.0  0.0  8.60  2.60  450.20  fell off a wall(2),cut down by a Gremlin(1),cut down by a Poltergeist(1)
59  Magic User  Wizard  Human  5  0  4.00  5.0  6.0  60.0  0.0  9.00  2.60  434.20  cut down by a Blumble(1),cut down by a Drarl(1),cut down by a Gremlin(1)
60  Magic User  Cleric  Wilmsry  5  0  4.00  4.0  7.0  40.0  0.0  5.40  2.40  397.80  fell off a wall(2),came up short on a leap(1),cut down by a Dante(1)
61  Thief  Cutthroat  Troll  5  0  4.00  4.0  6.0  40.0  0.0  12.40  3.00  451.20  came up short on a leap(1),cut down by a Drarl(1),cut down by a Ghost(1)
62  Fighter  Master of Arms  Fridgian  5  0  4.00  4.0  5.0  40.0  0.0  11.40  3.20  434.00  cut down by a China Wolf(1),cut down by a Craig(1),cut down by a Werebeast(1)
63  Thief  Pilfer  Human  5  0  4.00  4.0  5.0  40.0  0.0  8.00  2.40  402.40  cut down by a Blumble(1),cut down by a Primp(1),cut down by a Rinkle(1)
64  Fighter  Samurai  Dwarven  5  0  4.00  4.0  5.0  40.0  0.0  12.20  3.40  404.60  cut down by a Craig(1),cut down by a Floater(1),cut down by a Sterling(1)
65  Magic User  Sorcerer  Troll  5  0  4.00  4.0  5.0  40.0  0.0  12.60  3.00  452.60  cut down by a Bones(1),cut down by a Floater(1),cut down by a Primp(1)
66  Magic User  Apprentice  Wilmsry  5  0  4.00  4.0  5.0  20.0  0.0  6.00  2.60  418.40  cut down by a China Wolf(1),cut down by a Rinkle(1),cut down by a Shadow(1)
67  Fighter  Knight  Troll  5  0  4.00  4.0  5.0  20.0  0.0  2.80  2.20  375.60  cut down by a Google(2),fell off a wall(2),cut down by a China Wolf(1)
68  Fighter  Master of Arms  Human  5  0  4.00  4.0  5.0  20.0  0.0  12.80  3.40  428.80  cut down by a Craig(1),cut down by a Drake(1),cut down by a Drat(1)
69  Fighter  Master of Arms  Wilmsry  5  0  4.00  4.0  5.0  20.0  0.0  12.00  3.20  444.60  cut down by a Sterling(2),cut down by a Frank(1),cut down by a Primp(1)
70  Fighter  Soldier  Fridgian  5  0  4.00  4.0  5.0  20.0  0.0  13.60  3.20  460.80  cut down by a Werebeast(2),cut down by a Frank(1),cut down by a Rast(1)
71  Fighter  Soldier  Dwarven  5  0  4.00  4.0  4.0  0.0  0.0  10.80  3.00  474.60  cut down by a Blumble(1),cut down by a Cave Bear(1),cut down by a Frank(1)
72  Magic User  Summoner  Fridgian  5  0  4.00  4.0  4.0  0.0  0.0  10.00  2.60  456.80  cut down by a Blumble(1),cut down by a Poltergeist(1),cut down by a Werebeast(1)
73  Magic User  Apprentice  Elven  5  0  4.00  3.0  8.0  40.0  0.0  9.60  3.20  468.00  cut down by a Blumble(1),cut down by a Djinni(1),cut down by a Hobgoblin(1)
74  Thief  Cutthroat  Human  5  0  4.00  3.0  7.0  20.0  0.0  11.60  2.80  459.80  cut down by a Dante(1),cut down by a Drake(1),cut down by a Shadow(1)
75  Fighter  Guard  Fridgian  5  0  4.00  3.0  7.0  20.0  0.0  12.20  3.00  490.20  cut down by a Drarl(1),cut down by a Drat(1),cut down by a Krupke(1)
76  Thief  Cat Burglar  Human  5  0  3.80  4.0  6.0  40.0  0.0  10.40  2.40  413.20  fell off a wall(2),undone by a trap(2),cut down by a Werebeast(1)
77  Fighter  Knight  Elven  5  0  3.80  4.0  5.0  40.0  0.0  3.80  2.40  414.20  came up short on a leap(1),cut down by a Flube(1),cut down by a Poltergeist(1)
78  Thief  Pickpocket  Wilmsry  5  0  3.80  4.0  5.0  40.0  0.0  5.60  2.40  428.40  fell off a wall(2),cut down by a Frank(1),cut down by a Werebeast(1)
79  Magic User  Apprentice  Human  5  0  3.80  4.0  6.0  20.0  0.0  10.60  2.80  473.20  cut down by a Blumble(1),cut down by a Krupke(1),cut down by a Rinkle(1)
80  Fighter  Barbarian  Wilmsry  5  0  3.80  4.0  6.0  20.0  0.0  7.80  2.20  468.60  cut down by a Werebeast(2),cut down by a Dante(1),cut down by a Philly(1)
81  Fighter  Bard  Troll  5  0  3.80  4.0  5.0  20.0  0.0  7.60  2.40  439.00  cut down by a Cave Bear(1),cut down by a Flube(1),cut down by a Philly(1)
82  Magic User  Court Mage  Troll  5  0  3.80  4.0  6.0  20.0  0.0  12.00  2.80  411.00  cut down by a Werebeast(1),cut down by a Wolf(1),cut down by a Zit(1)
83  Thief  Pilfer  Fridgian  5  0  3.80  4.0  5.0  20.0  0.0  10.40  2.40  422.60  cut down by a Frank(1),cut down by a Google(1),cut down by a Gremlin(1)
84  Thief  Pilfer  Troll  5  0  3.80  4.0  5.0  20.0  0.0  10.40  2.40  437.80  starved in the dark(2),cut down by a Cave Bear(1),cut down by a Poltergeist(1)
85  Fighter  Samurai  Troll  5  0  3.80  4.0  5.0  20.0  0.0  12.20  2.60  399.80  starved in the dark(2),cut down by a Blumble(1),cut down by a Rinkle(1)
86  Magic User  Summoner  Human  5  0  3.80  4.0  7.0  20.0  0.0  11.40  3.00  515.20  cut down by a China Wolf(1),cut down by a Floater(1),cut down by a Gremlin(1)
87  Magic User  Cleric  Human  5  0  3.80  3.0  8.0  40.0  0.0  7.40  2.60  364.00  cut down by a Google(1),cut down by a Herman(1),cut down by a Vampire(1)
88  Fighter  Barbarian  Elven  5  0  3.80  3.0  8.0  20.0  0.0  10.20  2.20  405.20  cut down by a Cave Bear(2),cut down by a Drarl(1),cut down by a Skeleton(1)
89  Thief  Cloaker  Fridgian  5  0  3.80  3.0  6.0  20.0  0.0  8.60  2.60  394.60  cut down by a Dante(1),cut down by a Djinni(1),cut down by a Poltergeist(1)
90  Thief  Ninja  Elven  5  0  3.80  3.0  7.0  20.0  0.0  12.40  2.60  367.80  cut down by a Cave Bear(1),cut down by a China Wolf(1),cut down by a Drake(1)
91  Magic User  Court Mage  Wilmsry  5  0  3.60  4.0  5.0  40.0  0.0  7.00  2.20  333.80  cut down by a Dante(1),cut down by a Frank(1),cut down by a Ned(1)
92  Thief  Pickpocket  Fridgian  5  0  3.60  4.0  5.0  40.0  0.0  6.60  2.40  321.20  cut down by a Blumble(1),cut down by a Hair(1),cut down by a Rinkle(1)
93  Magic User  Apprentice  Troll  5  0  3.60  4.0  6.0  20.0  0.0  10.40  3.00  433.60  cut down by a Drarl(1),cut down by a Gremlin(1),cut down by a Werebeast(1)
94  Magic User  Cleric  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  9.40  2.20  374.20  cut down by a China Wolf(1),cut down by a Primp(1),cut down by a Shadow(1)
95  Thief  Cutthroat  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  9.40  2.80  411.20  cut down by a Flube(1),cut down by a Ned(1),cut down by a Sterling(1)
96  Magic User  Illusionist  Fridgian  5  0  3.60  4.0  5.0  20.0  0.0  12.80  2.80  418.40  cut down by a Drake(1),cut down by a Ghoul(1),cut down by a Philly(1)
97  Magic User  Illusionist  Human  5  0  3.60  4.0  6.0  20.0  0.0  11.40  2.60  411.00  cut down by a Blumble(1),cut down by a Philly(1),cut down by a Poltergeist(1)
98  Fighter  Master of Arms  Dwarven  5  0  3.60  4.0  5.0  20.0  0.0  12.40  3.20  426.20  cut down by a Werebeast(2),cut down by a Dante(1),cut down by a Poltergeist(1)
99  Thief  Pilfer  Elven  5  0  3.60  4.0  6.0  20.0  0.0  8.80  2.60  432.40  cut down by a Drarl(1),cut down by a Trachea(1),cut down by a Werebeast(1)
100  Fighter  Guard  Dwarven  5  0  3.60  4.0  4.0  0.0  0.0  11.00  2.60  391.60  cut down by a Dante(1),cut down by a Google(1),cut down by a Primp(1)
101  Magic User  Wizard  Elven  5  0  3.60  4.0  4.0  0.0  0.0  11.20  2.40  497.40  cut down by a Frank(1),cut down by a Rast(1),cut down by a Rinkle(1)
102  Fighter  Woodsman  Human  5  0  3.60  4.0  4.0  0.0  0.0  9.40  3.00  391.40  cut down by a Frank(1),cut down by a Ghost(1),cut down by a Poltergeist(1)
103  Thief  Acrobat  Troll  5  0  3.60  3.0  6.0  20.0  0.0  13.20  2.80  407.80  starved in the dark(3),cut down by a Drarl(1),undone by a trap(1)
104  Fighter  Woodsman  Elven  5  0  3.60  3.0  6.0  20.0  0.0  5.00  2.60  349.00  cut down by a Goblin(1),cut down by a Poltergeist(1),cut down by a Stink Bug(1)
105  Thief  Acrobat  Elven  5  0  3.40  4.0  5.0  20.0  0.0  12.20  2.80  368.60  cut down by a Werebeast(2),cut down by a Blumble(1),cut down by a Rinkle(1)
106  Thief  Cloaker  Dwarven  5  0  3.40  4.0  5.0  20.0  0.0  6.80  1.80  383.60  cut down by a Google(1),cut down by a Gremlin(1),cut down by a Poltergeist(1)
107  Thief  Pickpocket  Dwarven  5  0  3.40  4.0  5.0  20.0  0.0  6.80  2.40  379.60  cut down by a Shadow(1),cut down by a Werebeast(1),spent by the dungeon itself(1)
108  Fighter  Barbarian  Dwarven  5  0  3.40  3.0  5.0  20.0  0.0  9.40  2.20  339.80  cut down by a Dante(1),cut down by a Drat(1),cut down by a Werebeast(1)
109  Fighter  Bard  Elven  5  0  3.40  3.0  6.0  20.0  0.0  9.60  2.80  342.80  cut down by a Poltergeist(2),came up short on a leap(1),cut down by a Google(1)
110  Thief  Con Artist  Fridgian  5  0  3.40  3.0  7.0  20.0  0.0  2.80  2.20  367.00  spent by the dungeon itself(2),cut down by a Djinni(1),cut down by a Gremlin(1)
111  Fighter  Master of Arms  Elven  5  0  3.40  3.0  6.0  20.0  0.0  9.00  3.00  364.40  cut down by a Cave Bear(1),cut down by a Craig(1),cut down by a Poltergeist(1)
112  Thief  Pickpocket  Human  5  0  3.40  3.0  6.0  20.0  0.0  9.60  2.40  395.20  undone by a trap(2),cut down by a Djinni(1),cut down by a Google(1)
113  Magic User  Summoner  Troll  5  0  3.40  3.0  6.0  20.0  0.0  8.80  2.40  429.60  cut down by a Dante(1),cut down by a Google(1),cut down by a Gremlin(1)
114  Fighter  Knight  Dwarven  5  0  3.40  3.0  4.0  0.0  0.0  6.20  2.40  421.80  fell off a wall(2),cut down by a Dante(1),cut down by a Poltergeist(1)
115  Thief  Pickpocket  Elven  5  0  3.40  3.0  4.0  0.0  0.0  9.80  2.60  394.00  cut down by a Google(2),cut down by a Werebeast(2),starved in the dark(1)
116  Magic User  Summoner  Elven  5  0  3.20  4.0  5.0  20.0  0.0  7.80  2.00  371.80  cut down by a Gremlin(1),cut down by a Rinkle(1),cut down by a Skeleton(1)
117  Thief  Pilfer  Dwarven  5  0  3.20  3.0  5.0  20.0  0.0  7.20  2.00  334.60  cut down by a Gremlin(1),cut down by a Hair(1),cut down by a Pogo(1)
118  Fighter  Samurai  Human  5  0  3.20  3.0  4.0  0.0  0.0  13.40  2.80  356.00  cut down by a Drarl(1),cut down by a Frank(1),cut down by a Poltergeist(1)
119  Magic User  Court Mage  Elven  5  0  3.00  4.0  5.0  20.0  0.0  7.40  2.00  256.40  cut down by a Werebeast(2),came up short on a leap(1),cut down by a Drekk(1)
120  Thief  Cat Burglar  Dwarven  5  0  3.00  4.0  4.0  0.0  0.0  8.40  2.20  306.20  undone by a trap(2),cut down by a Rinkle(1),cut down by a Sterling(1)
121  Magic User  Cleric  Dwarven  5  0  3.00  3.0  5.0  40.0  0.0  8.60  2.20  281.00  cut down by a China Wolf(1),cut down by a Drarl(1),cut down by a Google(1)
122  Magic User  Illusionist  Dwarven  5  0  3.00  3.0  6.0  20.0  0.0  6.20  1.80  346.40  cut down by a China Wolf(1),cut down by a Philly(1),cut down by a Rinkle(1)
123  Magic User  Apprentice  Fridgian  5  0  3.00  3.0  4.0  0.0  0.0  7.40  2.40  360.00  cut down by a Poltergeist(2),cut down by a Google(1),cut down by a Werebeast(1)
124  Fighter  Bard  Dwarven  5  0  3.00  3.0  4.0  0.0  0.0  8.60  2.20  326.60  cut down by a Poltergeist(3),cut down by a Rast(1),cut down by a Skeleton(1)
125  Thief  Cutthroat  Dwarven  5  0  3.00  3.0  4.0  0.0  0.0  8.40  2.40  376.80  came up short on a leap(2),cut down by a Shadow(1),cut down by a Skeleton(1)
126  Fighter  Guard  Human  5  0  3.00  3.0  4.0  0.0  0.0  8.40  2.00  370.00  cut down by a Poltergeist(2),fell off a wall(2),cut down by a Werebeast(1)
127  Magic User  Warlock  Elven  5  0  3.00  3.0  4.0  0.0  0.0  9.40  2.40  382.80  cut down by a Poltergeist(2),cut down by a Trachea(1),cut down by a Wolf(1)
128  Thief  Cat Burglar  Fridgian  5  0  2.80  4.0  4.0  0.0  0.0  7.80  2.00  284.20  undone by a trap(2),cut down by a Frank(1),cut down by a Gremlin(1)
129  Thief  Cat Burglar  Elven  5  0  2.80  3.0  5.0  20.0  0.0  7.40  2.20  249.80  undone by a trap(3),cut down by a Cave Bear(1),cut down by a Craig(1)
130  Thief  Con Artist  Elven  5  0  2.80  3.0  5.0  20.0  0.0  1.00  2.00  380.60  starved in the dark(4),cut down by a Rinkle(1)
131  Thief  Pickpocket  Troll  5  0  2.80  3.0  4.0  0.0  0.0  8.60  2.20  306.20  cut down by a Frank(1),cut down by a Rast(1),cut down by a Shriek(1)
132  Fighter  Soldier  Elven  5  0  2.80  3.0  4.0  0.0  0.0  8.00  2.20  303.00  cut down by a Cave Bear(1),cut down by a China Wolf(1),cut down by a Rinkle(1)
133  Magic User  Apprentice  Dwarven  5  0  2.80  2.0  7.0  20.0  0.0  5.80  2.20  271.00  cut down by a Hobgoblin(2),cut down by a Cave Bear(1),cut down by a Dread Lock(1)
134  Magic User  Wizard  Dwarven  5  0  2.80  2.0  6.0  20.0  0.0  4.80  1.80  313.60  cut down by a Gremlin(2),cut down by a Philly(1),cut down by a Poltergeist(1)
135  Thief  Cutthroat  Elven  5  0  2.60  3.0  3.0  0.0  0.0  9.40  2.20  338.60  cut down by a Poltergeist(2),cut down by a Dante(1),cut down by a Frank(1)
136  Fighter  Guard  Elven  5  0  2.60  3.0  4.0  0.0  0.0  6.80  1.80  256.00  fell off a wall(2),cut down by a Blumble(1),cut down by a Poltergeist(1)
137  Magic User  Illusionist  Elven  5  0  2.60  3.0  4.0  0.0  0.0  6.80  1.80  299.40  cut down by a Gremlin(2),cut down by a Shriek(1),cut down by a Werebeast(1)
138  Fighter  Samurai  Elven  5  0  2.60  3.0  3.0  0.0  0.0  6.40  2.00  257.40  cut down by a Cave Bear(1),cut down by a Google(1),cut down by a Poltergeist(1)
139  Magic User  Cleric  Elven  5  0  2.60  2.0  5.0  20.0  0.0  6.20  1.80  250.40  starved in the dark(3),cut down by a Gremlin(1),fell off a wall(1)
140  Magic User  Summoner  Wilmsry  5  0  2.60  2.0  5.0  20.0  0.0  3.00  1.40  292.00  cut down by a Gremlin(2),cut down by a M&M(1),cut down by a Philly(1)
141  Fighter  Woodsman  Dwarven  5  0  2.60  2.0  5.0  20.0  0.0  6.20  1.80  281.00  cut down by a Blumble(1),cut down by a Pogo(1),cut down by a Skeleton(1)
142  Magic User  Sorcerer  Elven  5  0  2.40  3.0  3.0  0.0  0.0  6.60  1.80  278.60  came up short on a leap(1),cut down by a China Wolf(1),cut down by a Gremlin(1)
143  Magic User  Summoner  Dwarven  5  0  2.40  2.0  4.0  0.0  0.0  7.40  1.60  283.60  cut down by a Ned(2),cut down by a Dante(1),cut down by a Google(1)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Thief  240  0  4.15  4.0  6.0  36.3  0.4  9.29  2.79  454.15  starved in the dark(31),undone by a trap(23),cut down by a Werebeast(20)
Fighter  235  0  4.01  4.0  6.0  30.6  0.0  9.34  2.80  437.06  cut down by a Werebeast(28),cut down by a Poltergeist(26),fell off a wall(17)
Magic User  240  0  3.83  4.0  6.0  32.1  0.0  9.52  2.62  431.83  cut down by a Werebeast(21),fell off a wall(19),cut down by a Gremlin(17)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Ninja  30  0  5.33  5.0  8.0  63.3  0.0  14.37  3.53  558.90  cut down by a Drake(4),cut down by a Craig(2),cut down by a Drarl(2)
Warlock  30  0  4.57  4.0  8.0  46.7  0.0  12.87  3.20  559.27  cut down by a Werebeast(4),cut down by a Poltergeist(3),cut down by a Philly(2)
Con Artist  30  0  4.53  5.0  7.0  50.0  3.3  2.33  2.77  516.50  starved in the dark(8),came up short on a leap(3),fell off a wall(3)
Knight  30  0  4.47  4.0  6.0  46.7  0.0  5.60  2.90  484.03  fell off a wall(5),cut down by a Blumble(3),cut down by a Frank(3)
Acrobat  30  0  4.40  4.0  6.0  40.0  0.0  12.30  3.07  465.90  cut down by a Werebeast(7),starved in the dark(3),undone by a trap(3)
Cloaker  30  0  4.30  4.0  6.0  36.7  0.0  9.77  2.80  473.53  starved in the dark(7),cut down by a Poltergeist(5),fell off a wall(3)
Bard  30  0  4.13  4.0  6.0  33.3  0.0  9.40  2.83  452.23  cut down by a Poltergeist(7),cut down by a Werebeast(4),cut down by a Philly(2)
Sorcerer  30  0  4.13  4.0  7.0  33.3  0.0  11.83  2.87  475.70  cut down by a China Wolf(3),cut down by a Werebeast(3),cut down by a Frank(2)
Woodsman  30  0  4.10  4.0  7.0  36.7  0.0  6.93  2.77  421.10  cut down by a Werebeast(4),cut down by a Poltergeist(3),fell off a wall(3)
Wizard  30  0  4.03  4.0  7.0  40.0  0.0  7.97  2.67  477.90  cut down by a Gremlin(5),starved in the dark(3),cut down by a Blumble(2)
Soldier  30  0  4.03  4.0  5.0  23.3  0.0  9.63  2.97  444.33  cut down by a Frank(4),cut down by a Werebeast(4),cut down by a Cave Bear(2)
Court Mage  30  0  4.00  4.0  6.0  40.0  0.0  10.67  2.70  388.77  fell off a wall(5),cut down by a Werebeast(3),cut down by a Dante(2)
Barbarian  30  0  4.00  4.0  6.0  36.7  0.0  11.77  2.50  452.23  cut down by a Werebeast(4),cut down by a Blumble(3),cut down by a Cave Bear(3)
Master of Arms  30  0  3.93  4.0  5.0  26.7  0.0  11.20  3.20  429.80  cut down by a Werebeast(5),cut down by a Poltergeist(4),cut down by a Craig(3)
Pilfer  30  0  3.90  4.0  6.0  30.0  0.0  8.83  2.50  433.33  starved in the dark(4),cut down by a Poltergeist(3),cut down by a Gremlin(2)
Cutthroat  30  0  3.77  4.0  6.0  23.3  0.0  9.97  2.77  436.33  fell off a wall(4),came up short on a leap(3),cut down by a Shadow(3)
Guard  30  0  3.73  4.0  6.0  20.0  0.0  9.37  2.53  423.17  cut down by a Poltergeist(4),fell off a wall(4),cut down by a Dante(2)
Cat Burglar  30  0  3.60  4.0  6.0  26.7  0.0  8.93  2.50  377.90  undone by a trap(11),cut down by a Rinkle(3),cut down by a Werebeast(3)
Samurai  25  0  3.60  4.0  5.0  20.0  0.0  11.08  2.72  380.12  starved in the dark(3),cut down by a China Wolf(2),cut down by a Poltergeist(2)
Illusionist  30  0  3.60  3.0  6.0  26.7  0.0  8.87  2.37  404.53  cut down by a Philly(3),cut down by a Gremlin(2),cut down by a Shriek(2)
Apprentice  30  0  3.53  3.0  6.0  20.0  0.0  8.30  2.70  404.03  cut down by a Werebeast(4),cut down by a Hobgoblin(3),cut down by a Blumble(2)
Cleric  30  0  3.50  3.0  6.0  36.7  0.0  7.60  2.30  352.93  fell off a wall(7),starved in the dark(4),cut down by a China Wolf(2)
Pickpocket  30  0  3.40  3.0  5.0  20.0  0.0  7.83  2.40  370.77  cut down by a Werebeast(4),starved in the dark(4),undone by a trap(4)
Summoner  30  0  3.23  4.0  5.0  13.3  0.0  8.07  2.17  391.50  cut down by a Gremlin(5),cut down by a Werebeast(4),cut down by a Dante(2)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Wilmsry  120  0  4.72  5.0  7.0  51.7  0.8  7.61  2.83  524.13  cut down by a Werebeast(11),fell off a wall(10),undone by a trap(8)
Troll  120  0  4.18  4.0  6.0  38.3  0.0  10.26  2.88  455.88  starved in the dark(27),fell off a wall(8),cut down by a Poltergeist(7)
Human  120  0  4.17  4.0  6.0  35.8  0.0  11.08  2.99  468.70  fell off a wall(15),cut down by a Werebeast(13),cut down by a Poltergeist(7)
Fridgian  115  0  4.10  4.0  6.0  34.8  0.0  10.17  2.87  445.52  cut down by a Werebeast(14),cut down by a Frank(11),cut down by a Poltergeist(8)
Dwarven  120  0  3.61  4.0  6.0  23.3  0.0  9.13  2.53  398.17  cut down by a Werebeast(11),fell off a wall(10),cut down by a Poltergeist(8)
Elven  120  0  3.21  3.0  5.0  14.2  0.0  8.09  2.34  354.03  cut down by a Werebeast(14),cut down by a Poltergeist(12),starved in the dark(12)

POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  top causes
715  0  4.00  4.0  6.0  33.0  0.1  0.0  9.38  2.74  441.04  cut down by a Werebeast(69),starved in the dark(55),fell off a wall(53)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 715 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=5  workers=4  startDepth=1
elapsed: 133.0s  workers=4  runs=715
```

**`node tools/tune-difficulty.mjs --seeds=50 --start-depth=20` (on commit b0facb6216eb23a1f45bda33bae3c7e99780112e):**

```
tune-difficulty: 50 seeded auto-play run(s), start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=20  p50=20  p90=22  max=27

Action-count distribution:
  min=9  p50=104  p90=331  max=690

Death-cause breakdown:
  cut down by a Herman 11 (22.0%)
  cut down by a Stalka Beast 9 (18.0%)
  cut down by a Drarl  9 (18.0%)
  cut down by a Vampire 8 (16.0%)
  cut down by a Dread Lock 4 (8.0%)
  cut down by a Djinni 4 (8.0%)
  fell off a wall      2 (4.0%)
  starved in the dark  1 (2.0%)
  cut down by a Drake  1 (2.0%)
  cut down by a Spectre 1 (2.0%)

Parley (D-15 readout — informational, not a gate):
  attempts=36  successes=26 (72.2%)  failures=10  refused=0  exhausted=0
  runs with >=1 attempt: 11 of 50
  SP from parley: 979 of 110636 total SP (0.9%)

Reach table (% of runs reaching floor N):
  >=5: 100.0%  >=10: 100.0%  >=20: 100.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=0  p50=5  p90=15  max=26

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 0/0 (0.0%)
  6-10: 0/0 (0.0%)
  11-20: 71/109 (65.1%)
  21-30: 47/85 (55.3%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=229  foeBolted=70  foeDrained=11  foeDebuffed=2  foeHealed=5  foeSummoned=0
  heroResisted=134  heroResistFailed=37
  ability damage: 688 of 4750 total damage taken (14.5%)

Stuck: 0 of 50 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=50  startDepth=20

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 20:32  21:7  22:7  23:2  25:1  27:1
  mean death depth=20.78  floors gained p50=0 mean=0.78  encounters survived mean=2.94
  reach: >=5 100.0%  >=8 100.0%  >=9 100.0%  >=10 100.0%  >=13 100.0%  >=16 100.0%  >=20 100.0%
  band share of deaths: Filter 1-4 0.0% | Wall 5-8 0.0% | Breakaway 9-15 0.0% | Endgame 16-20 64.0% | beyond 20 36.0%
  top causes — Filter: (none)
  top causes — Wall: (none)
  top causes — Breakaway: (none)
  top causes — Endgame: cut down by a Herman 8, cut down by a Stalka Beast 8, cut down by a Djinni 4, cut down by a Drarl 4, cut down by a Vampire 4

Outcome: 50 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

**Identity checks:**
- `diff readouts/before-start-depth-20.txt readouts/rung1-start-depth-20.txt`: **empty** (16+ byte-identical to BEFORE).
- `node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt`: **empty** (floor-1 fixtures untouched).
- `node --test test/difficulty/difficulty.test.js`: 18/18 green (the floor-1 literal pin, `Phase 54 (BAND-01) floor-1 parity`, holds).
- metaParity vs `v17-p53-after-smoke.json`: `metaParity true []`, cells 143, `meta.commit` = `b0facb6`.
- solo reach >=5: **33.0%** (unchanged from BEFORE — a 5-15-only dial cannot move it, as predicted by the structural bound). party reach >=5: **55.6%** (BEFORE 55.3%; the tiny shift is NOT a floor-1-4 regression — it comes from one run flipping between "stuck" (hit maxActions=20000) and "completed" once floor-5+ fight outcomes changed for the party runs that reach that far, reshuffling which of the 200 seeds falls in each bucket; solo never had a stuck run in either reading, so its reach >=5 stayed byte-exact).

**Reading table:**

| Measure | BEFORE (78572c5) | Rung 1 (R1A) | Target | In band? |
|---|---|---|---|---|
| solo p50 | 4 | 4 | 5-7 | NO (unchanged — structural: a 5-15 dial cannot move floors 1-4) |
| solo p90 | 6 | 6 | 10-13 | NO |
| solo reach >=5 | 33.0% | 33.0% | recorded (target-side, moves only on a Filter rung) | n/a |
| solo reach >=10 | 0.0% | 0.5% | — | — |
| solo reach >=16 | 0.0% | 0.0% | 2.0-6.0% | NO |
| solo reach >=20 | 0.0% | 0.0% | <=0.5% | YES |
| solo mean death depth | 3.92 (BEFORE ledger did not carry this figure explicitly; Phase 53 p50/p90 4/6 implies a similar mean) | 3.92 | — | — |
| party p50 | 5 | 5 | 5-7 | YES (already in band, unaffected by this rung — floors 1-4 untouched) |
| party p90 | 6 | 7 | advisory | — |
| party reach >=5 | 55.3% | 55.6% | recorded | n/a |
| party stuck | 59/200 | 58/200 | — | — |
| pooled smoke mean | 3.96 | 4.00 | moves toward band | flat (+0.04) |
| pooled smoke p50 | 4.0 (derived) | 4.0 | — | — |
| pooled smoke reach5 | 33.0% (derived, Phase 53) | 33.0% | — | — |
| depth-20 slice | — | identical | byte-identical | YES |
| scan Part B | — | identical | empty diff | YES |

**Class-cell collapse check** (`b.rollups.pooled.meanDepth - a.rollups.pooled.meanDepth` where a = v17-p53-after-smoke.json, b = v17-p54-rung1-smoke.json):

```
pooledShift 0.04 collapsed 10
Thief|Cloaker|Wilmsry 5.6->5.2
Fighter|Bard|Wilmsry 5.2->5
Magic User|Warlock|Wilmsry 5.2->5
Magic User|Court Mage|Fridgian 5->4.8
Magic User|Warlock|Troll 4.8->4.6
Thief|Acrobat|Dwarven 4.8->4.6
Magic User|Illusionist|Troll 4.8->4.6
Fighter|Barbarian|Fridgian 4.4->4.2
Magic User|Court Mage|Dwarven 4.4->4.2
Magic User|Sorcerer|Troll 4.2->4
```

At n=5 seeds per cell every drop here is 0.2-0.4 mean depth against a near-zero pooled shift (0.04) — consistent with seed noise past floor 4 rather than a real regression (none of these ten cells' top causes shifted to a Wall-band-specific cause in the per-cell breakdown); no rollback indicated.

**What moved:** The Wall/Breakaway foePower notch (0.85 at 5 easing to 0.95 at 8; 0.95 at 9 easing to 1.0 at 15) softened floors 5-8 combat enough to flip the walking-dead-t5 determinism fixture (depth-5 Vampire pair) from "died" to "won" and nudge solo reach >=8/9/10 up from zero, but — exactly as the structural bound predicted — the solo median stayed pinned at 4 and reach >=5 stayed exactly 33.0%, because a floor 5-15 dial cannot reach back into floors 1-4. Party's p50 was already in-band (5) before this rung and stays there; its tiny reach >=5 shift (55.3% -> 55.6%) is a stuck/completed bucket reshuffle, not a floor 1-4 regression.

**What to turn next:** Since the solo median is still <= 4 after rung 1, USER RULING A applies: rung 2 IS a Filter rung. This rung's own Filter top causes (`top causes — Filter: cut down by a Dante 12, cut down by a Poltergeist 11, fell off a wall 9, undone by a trap 9, cut down by a Philly 8`) put hazards (fell off a wall 9 + undone by a trap 9 = 18) at ~13.4% of the ~134 Filter-band deaths (67.0% of 200) — below the 20% threshold that would additionally justify `HAZARD_SCALE_AT_START`. Rung 2 therefore moves `FOE_GRACE_AT_2` alone, one notch: 0.5 -> 0.4.

#### Rung 2 — commit 850f17681e06def889f22236679f8cf66cdee52b (Filter rung — FOE_GRACE_AT_2 0.5 -> 0.4, USER RULING A; raw readouts committed 27e209c; ledger section written retroactively under USER RULING C)

The ladder halted after this rung's raw transcripts were committed (`27e209c`) so the ladder could be re-planned to USER RULING C's per-floor survival curve; this section fills in the deferred reading, computed from the committed histograms via the new `survivalFromHistogram` instrument (Task 0).

**Constants (Old -> New):**

| Constant | Old | New |
|---|---|---|
| `FOE_GRACE_AT_2` | 0.4 (rung 1 value) | 0.4 -> 0.5 -> 0.4 (net: rung 1's Phase-27 value 0.5 moved to 0.4 this rung — the Filter rung notch) |
| `HAZARD_SCALE_AT_START` | 0.5 | 0.5 (unchanged — Filter hazard share ~13.4% of Filter deaths, below the 20% threshold) |

Floors 2-4 foePower: 0.5/0.667/0.833 -> 0.4/0.6/0.8 (measured live via `node -e`, never hand-computed). Floor 1 untouched (`FOE_GRACE_AT_1` stays exactly 1.0). `WALL_FOE_POWER_AT_START` (0.85, unchanged this rung) still clears `graceFor(4) = 0.8`.

**Curve at 1..16 (foePower / hazardScale / abilityThreat), measured via `node -e` against the 850f176 commit:**

| d | dots | darkBlobs | darkRadius | foePower | hazardScale | foeCap | abilityThreat |
|---|---|---|---|---|---|---|---|
| 1 | 10 | 0 | 4 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 2 | 11 | 1 | 5 | 0.4000 | 0.5000 | 3 | 1.0000 (exact) |
| 3 | 11 | 1 | 6 | 0.6000 | 0.5000 | 3 | 1.0000 (exact) |
| 4 | 11 | 2 | 7 | 0.8000 | 0.7500 | 3 | 1.0000 (exact) |
| 5 | 11 | 3 | 7 | 0.8500 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 6 | 9 | 0 | 7 | 0.8833 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 7 | 12 | 3 | 7 | 0.9167 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 8 | 12 | 3 | 7 | 0.9500 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 9 | 12 | 3 | 7 | 0.9500 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 10 | 12 | 3 | 7 | 0.9583 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 11 | 9 | 0 | 7 | 0.9667 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 12 | 12 | 3 | 7 | 0.9750 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 13 | 12 | 3 | 7 | 0.9833 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 14 | 12 | 3 | 7 | 0.9917 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 15 | 12 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 16 | 9 | 0 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |

**`node tools/tune-difficulty.mjs --seeds=200` (solo, committed `27e209c`):**

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=6  max=9

Action-count distribution:
  min=36  p50=425  p90=663  max=1036

Death-cause breakdown:
  cut down by a Werebeast 16 (8.0%)
  undone by a trap     15 (7.5%)
  spent by the dungeon itself 14 (7.0%)
  starved in the dark  13 (6.5%)
  fell off a wall      12 (6.0%)
  cut down by a Rinkle 10 (5.0%)
  cut down by a Blumble 10 (5.0%)
  cut down by a Drarl  9 (4.5%)
  cut down by a Dante  9 (4.5%)
  cut down by a Philly 8 (4.0%)
  cut down by a Poltergeist 7 (3.5%)
  cut down by a Gremlin 7 (3.5%)
  cut down by a China Wolf 6 (3.0%)
  cut down by a Craig  5 (2.5%)
  cut down by a Drake  4 (2.0%)
  cut down by a Hair   4 (2.0%)
  cut down by a Primp  4 (2.0%)
  cut down by a Djinni 4 (2.0%)
  (33 more causes, 1-3 each — see the committed transcript for the full list)

Parley (D-15 readout — informational, not a gate):
  attempts=310  successes=194 (62.6%)  failures=116  refused=0  exhausted=0
  runs with >=1 attempt: 70 of 200
  SP from parley: 2645 of 126061 total SP (2.1%)

Reach table (% of runs reaching floor N):
  >=5: 36.0%  >=10: 0.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 1:19  2:20  3:30  4:59  5:45  6:17  7:8  8:1  9:1
  mean death depth=3.93  floors gained p50=3 mean=2.93  encounters survived mean=9.56
  reach: >=5 36.0%  >=8 1.0%  >=9 0.5%  >=10 0.0%  >=13 0.0%  >=16 0.0%  >=20 0.0%
  band share of deaths: Filter 1-4 64.0% | Wall 5-8 35.5% | Breakaway 9-15 0.5% | Endgame 16-20 0.0% | beyond 20 0.0%
  top causes — Filter: undone by a trap 11, cut down by a Dante 8, cut down by a Philly 8, cut down by a Werebeast 8, fell off a wall 8
  top causes — Wall: cut down by a Drarl 8, cut down by a Werebeast 8, starved in the dark 7, spent by the dungeon itself 6, cut down by a Rinkle 5
  top causes — Breakaway: cut down by a Djinni 1
  top causes — Endgame: (none)

Outcome: 200 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

**`node tools/tune-difficulty.mjs --seeds=200 --party` (party — regenerated on this rung's tree, `engine/` byte-identical to `850f176`, since the originally-committed `27e209c` party transcript was 0 bytes; see the Deviations section):**

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=5  p90=7  max=12

Action-count distribution:
  min=21  p50=587  p90=20000  max=20000

Death-cause breakdown:
  fell off a wall      19 (9.5%)
  starved in the dark  15 (7.5%)
  cut down by a Werebeast 13 (6.5%)
  undone by a trap     12 (6.0%)
  cut down by a Dante  7 (3.5%)
  came up short on a leap 7 (3.5%)
  cut down by a Poltergeist 6 (3.0%)
  cut down by a Drarl  5 (2.5%)
  cut down by a Blumble 5 (2.5%)
  cut down by a Primp  4 (2.0%)
  (28 more causes, 1-3 each — see the committed transcript for the full list)

Parley (D-15 readout — informational, not a gate):
  attempts=335  successes=205 (61.2%)  failures=130  refused=0  exhausted=0
  runs with >=1 attempt: 73 of 200
  SP from parley: 2972 of 128440 total SP (2.3%)

Reach table (% of runs reaching floor N):
  >=5: 53.1%  >=10: 1.4%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Party (--party, D-12/D-20):
  member forced at run start in 192/200 runs; member alive at run end: 128 (64.0%)

Stuck: 57 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 1:8  2:11  3:10  4:38  5:46  6:15  7:8  8:4  9:1  10:1  12:1
  mean death depth=4.55  floors gained p50=4 mean=3.55  encounters survived mean=11.40
  reach: >=5 53.1%  >=8 4.9%  >=9 2.1%  >=10 1.4%  >=13 0.0%  >=16 0.0%  >=20 0.0%
  band share of deaths: Filter 1-4 46.9% | Wall 5-8 51.0% | Breakaway 9-15 2.1% | Endgame 16-20 0.0% | beyond 20 0.0%
  top causes — Filter: fell off a wall 11, starved in the dark 9, cut down by a Dante 7, undone by a trap 7, cut down by a Poltergeist 5
  top causes — Wall: cut down by a Werebeast 10, fell off a wall 8, starved in the dark 6, undone by a trap 5, cut down by a Drarl 4
  top causes — Breakaway: cut down by a Drarl 1, cut down by a Herman 1, cut down by a Vampire 1
  top causes — Endgame: (none)

Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):
  L=1  reached=200  deaths=8 (hazard 6 / starvation 0 / combat 2)  p_L=96.0%  S_L=96.0%  target p_L=98.8%  target S_L=98.8%  dS=-2.8  PASS
  L=2  reached=187  deaths=11 (hazard 2 / starvation 5 / combat 4)  p_L=94.1%  S_L=90.4%  target p_L=96.3%  target S_L=95.1%  dS=-4.7  PASS
  L=3  reached=171  deaths=10 (hazard 4 / starvation 2 / combat 4)  p_L=94.2%  S_L=85.1%  target p_L=93.1%  target S_L=88.6%  dS=-3.5  PASS
  L=4  reached=150  deaths=38 (hazard 10 / starvation 4 / combat 24)  p_L=74.7%  S_L=63.5%  target p_L=89.9%  target S_L=79.7%  dS=-16.2  MISS
  L=5  reached=94  deaths=46 (hazard 11 / starvation 6 / combat 29)  p_L=51.1%  S_L=32.4%  target p_L=86.9%  target S_L=69.2%  dS=-36.8  MISS
  L=6  reached=34  deaths=15 (hazard 4 / starvation 1 / combat 10)  p_L=55.9%  S_L=18.1%  target p_L=84.3%  target S_L=58.4%  dS=-40.3  MISS
  L=7  reached=16  deaths=8 (hazard 0 / starvation 0 / combat 8)  p_L=50.0%  S_L=9.1%  target p_L=82.2%  target S_L=48.0%  dS=-38.9  MISS
  L=8  reached=7  deaths=4 (hazard 1 / starvation 0 / combat 3)  p_L=42.9%  S_L=3.9%  target p_L=80.6%  target S_L=38.7%  dS=-34.8  MISS
  L=9  reached=3  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=66.7%  S_L=2.6%  target p_L=79.5%  target S_L=30.8%  dS=-28.2  MISS
  L=10  reached=2  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=50.0%  S_L=1.3%  target p_L=78.9%  target S_L=24.3%  dS=-23.0  MISS
  L=11  reached=1  deaths=0 (hazard 0 / starvation 0 / combat 0)  p_L=100.0%  S_L=1.3%  target p_L=78.7%  target S_L=19.1%  dS=-17.8  MISS
  L=12  reached=1  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=0.0%  S_L=0.0%  target p_L=78.8%  target S_L=15.1%  dS=-15.1  MISS
  reach-20: 0.0% (band 3.0-5.0%) MISS
  verdict: floors outside the pass band: 4 (dS -16.2), 5 (dS -36.8), 6 (dS -40.3), 7 (dS -38.9), 8 (dS -34.8), 9 (dS -28.2), 10 (dS -23.0), 11 (dS -17.8), 12 (dS -15.1); reach-20 MISS

Outcome: 143 dead, 57 stuck (hit maxActions=20000; excluded from depth stats)
```

Note: because this transcript was regenerated on the CURRENT tree (which already carries Task 0's survival instrument), its `Per-floor survival` block is EXACT — a real per-run result set, stuck runs correctly counted as reached-not-dead — not a histogram reconstruction. This is a strict improvement over the plan's anticipated "approximate — excludes stuck runs" framing for the party table.

**`node tools/tune-difficulty.mjs --seeds=50 --start-depth=20` (slice, committed `27e209c`):**

```
tune-difficulty: 50 seeded auto-play run(s), start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=20  p50=20  p90=22  max=27

Death-cause breakdown:
  cut down by a Herman 11 (22.0%)
  cut down by a Stalka Beast 9 (18.0%)
  cut down by a Drarl  9 (18.0%)
  cut down by a Vampire 8 (16.0%)
  cut down by a Dread Lock 4 (8.0%)
  cut down by a Djinni 4 (8.0%)
  fell off a wall      2 (4.0%)
  starved in the dark  1 (2.0%)
  cut down by a Drake  1 (2.0%)
  cut down by a Spectre 1 (2.0%)

Reach table (% of runs reaching floor N):
  >=5: 100.0%  >=10: 100.0%  >=20: 100.0%  >=30: 0.0%  >=50: 0.0%

Stuck: 0 of 50 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=50  startDepth=20

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 20:32  21:7  22:7  23:2  25:1  27:1
  mean death depth=20.78  floors gained p50=0 mean=0.78  encounters survived mean=2.94
  reach: >=5 100.0%  >=8 100.0%  >=9 100.0%  >=10 100.0%  >=13 100.0%  >=16 100.0%  >=20 100.0%
  band share of deaths: Filter 1-4 0.0% | Wall 5-8 0.0% | Breakaway 9-15 0.0% | Endgame 16-20 64.0% | beyond 20 36.0%

Outcome: 50 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

Identical to `readouts/before-start-depth-20.txt` and `readouts/rung1-start-depth-20.txt` (`diff` empty) — 16+ was still identity by construction at this rung (the knot restructure lands one rung later, at rung 3a, still at these same values).

**`node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p54-rung2-smoke.json`** (`docs/class-pass/v17-p54-rung2-smoke.json`, 143 cells; committed `27e209c`): POOLED `n=715 stuck=0 mean=4.15 p50=4.0 p90=6.0 >=5%=38.3 >=10%=0.3 kills=9.80 lvl=2.83 actions=460.10`; top causes `cut down by a Werebeast(73), starved in the dark(62), fell off a wall(58)`. `metaParity` vs `v17-p54-rung1-smoke.json`: `true []`.

**RETRO per-floor survival (USER RULING C target), computed from the committed solo histogram via `survivalFromHistogram` — exact (200 runs, 0 stuck):**

```
Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):
  L=1  reached=200  deaths=19 (hazard 0 / starvation 0 / combat 19)  p_L=90.5%  S_L=90.5%  target p_L=98.8%  target S_L=98.8%  dS=-8.3  MISS
  L=2  reached=181  deaths=20 (hazard 0 / starvation 0 / combat 20)  p_L=89.0%  S_L=80.5%  target p_L=96.3%  target S_L=95.1%  dS=-14.6  MISS
  L=3  reached=161  deaths=30 (hazard 0 / starvation 0 / combat 30)  p_L=81.4%  S_L=65.5%  target p_L=93.1%  target S_L=88.6%  dS=-23.1  MISS
  L=4  reached=131  deaths=59 (hazard 0 / starvation 0 / combat 59)  p_L=55.0%  S_L=36.0%  target p_L=89.9%  target S_L=79.7%  dS=-43.7  MISS
  L=5  reached=72  deaths=45 (hazard 0 / starvation 0 / combat 45)  p_L=37.5%  S_L=13.5%  target p_L=86.9%  target S_L=69.2%  dS=-55.7  MISS
  L=6  reached=27  deaths=17 (hazard 0 / starvation 0 / combat 17)  p_L=37.0%  S_L=5.0%  target p_L=84.3%  target S_L=58.4%  dS=-53.4  MISS
  L=7  reached=10  deaths=8 (hazard 0 / starvation 0 / combat 8)  p_L=20.0%  S_L=1.0%  target p_L=82.2%  target S_L=48.0%  dS=-47.0  MISS
  L=8  reached=2  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=50.0%  S_L=0.5%  target p_L=80.6%  target S_L=38.7%  dS=-38.2  MISS
  L=9  reached=1  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=0.0%  S_L=0.0%  target p_L=79.5%  target S_L=30.8%  dS=-30.8  MISS
  reach-20: 0.0% (band 3.0-5.0%) MISS
  verdict: floors outside the pass band: 1 (dS -8.3), 2 (dS -14.6), 3 (dS -23.1), 4 (dS -43.7), 5 (dS -55.7), 6 (dS -53.4), 7 (dS -47.0), 8 (dS -38.2), 9 (dS -30.8); reach-20 MISS
```

Note the cause split is `unknown` for every death in this RETRO solo table (`survivalFromHistogram` rebuilds a synthetic result set from the histogram alone — the committed transcript's death-cause breakdown lines are the real split; the hazard/starvation/combat counts above are 0/0/N as an artifact of the histogram-only reconstruction, not a claim that every death was combat). The regenerated party transcript above, by contrast, carries the REAL cause split (hazard/starvation/combat) directly, since it was produced by a live re-run against the current instrument, not reconstructed. Rungs 3+ carry the split live from `survivalReadout` for both solo and party.

**Slice per-floor readout (USER RULING C, informational — NOT diffed against BEFORE from this rung on):**

```
Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):
  L=20  reached=50  deaths=32 (hazard 0 / starvation 0 / combat 32)  p_L=36.0%  S_L=36.0%  target p_L=84.5%  target S_L=3.0%  dS=+33.0  MISS
  L=21  reached=18  deaths=7 (hazard 0 / starvation 0 / combat 7)  p_L=61.1%  S_L=22.0%  target p_L=85.4%  target S_L=2.5%  dS=+19.5  info
  L=22  reached=11  deaths=7 (hazard 0 / starvation 0 / combat 7)  p_L=36.4%  S_L=8.0%  target p_L=86.4%  target S_L=2.2%  dS=+5.8  info
  L=23  reached=4  deaths=2 (hazard 0 / starvation 0 / combat 2)  p_L=50.0%  S_L=4.0%  target p_L=87.2%  target S_L=1.9%  dS=+2.1  info
  L=24  reached=2  deaths=0 (hazard 0 / starvation 0 / combat 0)  p_L=100.0%  S_L=4.0%  target p_L=88.1%  target S_L=1.7%  dS=+2.3  info
  L=25  reached=2  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=50.0%  S_L=2.0%  target p_L=88.9%  target S_L=1.5%  dS=+0.5  info
  verdict: all floors 1-19 inside the pass band; reach-20 MISS
```

(The slice's `S_L` chain resets at the start depth (20), so its `dS` column is not a like-for-like comparison against the absolute-start-of-dungeon `S_L` target — read `p_L` directly against the target `p_L` column instead: p_20 36.0% vs target 84.5%, a large miss, but on only 50 runs; this is the ENDGAME knots' `p_meas` input for rung 3's fit until natural floor-16+ data exists.)

**Reading table (floors 1-10, solo):**

| Floor | p_L rung 2 | target p_L | S_L rung 2 | target S_L | ΔS | verdict |
|---|---|---|---|---|---|---|
| 1 | 90.5% | 98.8% | 90.5% | 98.8% | -8.3 | MISS |
| 2 | 89.0% | 96.3% | 80.5% | 95.1% | -14.6 | MISS |
| 3 | 81.4% | 93.1% | 65.5% | 88.6% | -23.1 | MISS |
| 4 | 55.0% | 89.9% | 36.0% | 79.7% | -43.7 | MISS |
| 5 | 37.5% | 86.9% | 13.5% | 69.2% | -55.7 | MISS |
| 6 | 37.0% | 84.3% | 5.0% | 58.4% | -53.4 | MISS |
| 7 | 20.0% | 82.2% | 1.0% | 48.0% | -47.0 | MISS |
| 8 | 50.0% | 80.6% | 0.5% | 38.7% | -38.2 | MISS (n=2, low-confidence) |
| 9 | 0.0% | 79.5% | 0.0% | 30.8% | -30.8 | MISS (n=1, low-confidence) |
| 10 | n/a (0 runs reached) | 78.9% | n/a | 24.3% | n/a | no data — this is "that curve is not a curve, that's a wall" |

**Re-pin ledger (from `850f176`'s commit message):** `FILTER_PINS` (test/difficulty/difficulty.test.js), `PHASE_27_PINS.FOE_GRACE_AT_2` (test/unit/combat-scaling.test.js), the depth-2 negative-dmgBonus test (a lvl-1 foe now also carries a -1 dmgBonus at this notch); `movement.test.js`/`encounters.test.js` depth-2 hazard pins and the `humans-t2`/`magical-t4` determinism specs unaffected (hazardScale untouched this rung). `npm test` 3401/3401 fail 0; `build:www` exit 0; master hash unchanged.

**Parity:** scan diff empty at this rung's commit (no fixture reaches floor 5, per the BAND-02 guard's replay proof); no divergence declared.

**What to turn next:** USER RULING C (2026-09-21) — the ladder is re-planned to the per-floor survival curve; rung 3a (this plan's Task 1) lands the knot table at these exact values (byte-identical, proven by capture diff) so the first fit is attributable; rung 3b (Task 2) is the first FIT, computed from this rung's own per-floor table above plus the slice's p_20 (36.0%) for the Endgame knots.

#### Rung 3 — commit a78bef5 (first FIT: F2/F3/F4 0.37/0.53/0.52; Wall 0.51/0.57; Breakaway 0.57/0.6; Endgame 0.6/0.6; hazard F2/F3/F4 0.46/0.44/0.49, Wall 0.6)

The first deterministic FIT, computed from rung 2's own solo per-floor survival table (retro) plus the `--start-depth=20` slice's p_20, per the fit rule in `#### Target — the per-floor survival curve` above.

**Fit table (from rung 2's readouts):**

| Depth | Constant | cur | p_meas | source | target p_L | Δ | f_K | next |
|---|---|---|---|---|---|---|---|---|
| 2 | FOE_GRACE_AT_2 | 0.4 | 89.0% | solo L=2 (reached 181) | 96.3% | 7.3 | 0.927 | 0.37 |
| 3 | FOE_GRACE_AT_3 | 0.6 | 81.4% | solo L=3 (reached 161) | 93.1% | 11.7 | 0.883 | 0.53 |
| 4 | FOE_GRACE_AT_4 | 0.8 | 55.0% | solo L=4 (reached 131) | 89.9% | 34.9 | 0.651 | 0.52 |
| 5 | WALL_FOE_POWER_AT_START | 0.85 | 37.5% | solo L=5 (reached 72) | 86.9% | 49.4 | 0.6 (floor-clamped from 0.506) | 0.51 |
| 8 | WALL_FOE_POWER_AT_END | 0.95 | n/a (reached 2 < 10) | inherits f from knot 5 | 80.6% | — | 0.6 | 0.57 |
| 9 | BREAKAWAY_FOE_POWER_AT_START | 0.95 | n/a (reached 1 < 10) | inherits f from knot 5 | 79.5% | — | 0.6 | 0.57 |
| 15 | BREAKAWAY_FOE_POWER_AT_END | 1.0 | n/a (reached 0 < 10) | inherits f from knot 5 | 80.2% | — | 0.6 | 0.6 |
| 16 | ENDGAME_FOE_POWER_AT_START | 1.0 | 36.0% | `--start-depth=20` slice p_20 (< 10 natural @16) | 81.0% | 45.0 | 0.6 (floor-clamped from 0.55) | 0.6 |
| 20 | ENDGAME_FOE_POWER_AT_END | 1.0 | 36.0% | slice p_20 | 84.5% | 48.5 | 0.6 (floor-clamped from 0.515) | 0.6 |

Hazard knots (band hazard share from the REGENERATED party transcript's real per-floor split — the retro solo table lacks per-floor cause data; rungs 4+ use solo's own live split):

| Constant | cur | band hazard share | f_K | next |
|---|---|---|---|---|
| HAZARD_SCALE_AT_START (2) | 0.5 | Filter 32.8% (>= 15%) | 0.927 | 0.46 |
| HAZARD_SCALE_AT_3 (3) | 0.5 | Filter 32.8% | 0.883 | 0.44 |
| HAZARD_SCALE_AT_4 (4) | 0.75 | Filter 32.8% | 0.651 | 0.49 |
| WALL_HAZARD_SCALE (5-8) | 1.0 | Wall 21.9% (>= 15%) | 0.6 | 0.6 |
| BREAKAWAY_HAZARD_SCALE (9-15) | 1.0 | Breakaway 0% (< 15%) | unchanged | 1.0 |
| ENDGAME_HAZARD_SCALE (16+) | 1.0 | no data | unchanged | 1.0 |

Ability knots: all six (`WALL_ABILITY_THREAT_AT_START/END`, `BREAKAWAY_ABILITY_THREAT_AT_START/END`, `ENDGAME_ABILITY_THREAT_AT_START/END`) unchanged at 1.0 — no per-band kit-bearing-foe DEATH share is recorded by rung 2's transcripts (only caster-ENCOUNTER rate by depth band, a different metric); the >= 25% condition cannot be shown true this rung.

Starvation ("food economy") check: Filter 16.4% (party), Wall 9.6% (party) — both < 50%, no override. Secondary group: not triggered (first fit rung; the rule requires two consecutive fits).

**Constants (Old -> New):**

| Constant | Old | New |
|---|---|---|
| `FOE_GRACE_AT_2` | 0.4 | 0.37 |
| `FOE_GRACE_AT_3` | 0.6 | 0.53 |
| `FOE_GRACE_AT_4` | 0.8 | 0.52 |
| `WALL_FOE_POWER_AT_START` | 0.85 | 0.51 |
| `WALL_FOE_POWER_AT_END` | 0.95 | 0.57 |
| `BREAKAWAY_FOE_POWER_AT_START` | 0.95 | 0.57 |
| `BREAKAWAY_FOE_POWER_AT_END` | 1.0 | 0.6 |
| `ENDGAME_FOE_POWER_AT_START` | 1.0 | 0.6 |
| `ENDGAME_FOE_POWER_AT_END` | 1.0 | 0.6 |
| `HAZARD_SCALE_AT_START` | 0.5 | 0.46 |
| `HAZARD_SCALE_AT_3` | 0.5 | 0.44 |
| `HAZARD_SCALE_AT_4` | 0.75 | 0.49 |
| `WALL_HAZARD_SCALE` | 1.0 | 0.6 |
| `BREAKAWAY_HAZARD_SCALE` | 1.0 | 1.0 (unchanged) |
| `ENDGAME_HAZARD_SCALE` | 1.0 | 1.0 (unchanged) |
| all six ability knots | 1.0 | 1.0 (unchanged) |

**Curve at 1..25 (foePower / hazardScale / abilityThreat), measured via `node -e` against the `a78bef5` commit:**

| d | dots | darkBlobs | darkRadius | foePower | hazardScale | foeCap | abilityThreat |
|---|---|---|---|---|---|---|---|
| 1 | 10 | 0 | 4 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 2 | 11 | 1 | 5 | 0.3700 | 0.4600 | 3 | 1.0000 (exact) |
| 3 | 11 | 1 | 6 | 0.5300 | 0.4400 | 3 | 1.0000 (exact) |
| 4 | 11 | 2 | 7 | 0.5200 | 0.4900 | 3 | 1.0000 (exact) |
| 5 | 11 | 3 | 7 | 0.5100 | 0.6000 | 3 | 1.0000 (exact) |
| 6 | 9 | 0 | 7 | 0.5300 | 0.6000 | 3 | 1.0000 (exact) |
| 7 | 12 | 3 | 7 | 0.5500 | 0.6000 | 3 | 1.0000 (exact) |
| 8 | 12 | 3 | 7 | 0.5700 | 0.6000 | 3 | 1.0000 (exact) |
| 9 | 12 | 3 | 7 | 0.5700 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 10 | 12 | 3 | 7 | 0.5750 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 11 | 9 | 0 | 7 | 0.5800 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 12 | 12 | 3 | 7 | 0.5850 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 13 | 12 | 3 | 7 | 0.5900 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 14 | 12 | 3 | 7 | 0.5950 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 15 | 12 | 3 | 7 | 0.6000 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 16 | 9 | 0 | 7 | 0.6000 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 17 | 12 | 3 | 7 | 0.6000 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 18 | 12 | 3 | 7 | 0.6000 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 19 | 13 | 3 | 7 | 0.6000 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 20 | 13 | 3 | 7 | 0.6000 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 21 | 9 | 0 | 7 | 0.6025 | 1.0000 (exact) | 3 | 1.0098 |
| 22 | 13 | 3 | 7 | 0.6050 | 1.0000 (exact) | 3 | 1.0193 |
| 23 | 13 | 3 | 7 | 0.6074 | 1.0000 (exact) | 3 | 1.0285 |
| 24 | 13 | 3 | 7 | 0.6097 | 1.0000 (exact) | 3 | 1.0374 |
| 25 | 13 | 3 | 7 | 0.6120 | 1.0000 (exact) | 3 | 1.0461 |

**`node tools/tune-difficulty.mjs --seeds=200` (solo, committed on `a78bef5`):**

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=7  max=10

Action-count distribution:
  min=36  p50=467  p90=756  max=1020

Death-cause breakdown:
  starved in the dark  20 (10.0%)
  spent by the dungeon itself 15 (7.5%)
  cut down by a Werebeast 13 (6.5%)
  undone by a trap     10 (5.0%)
  cut down by a Blumble 8 (4.0%)
  cut down by a Gremlin 8 (4.0%)
  cut down by a Frank  7 (3.5%)
  cut down by a Dante  7 (3.5%)
  cut down by a Drarl  7 (3.5%)
  (34 more causes, 1-3 each — see the committed transcript for the full list)

Parley (D-15 readout — informational, not a gate):
  attempts=345  successes=219 (63.5%)  failures=126  refused=0  exhausted=0
  runs with >=1 attempt: 73 of 200
  SP from parley: 3341 of 154216 total SP (2.2%)

Reach table (% of runs reaching floor N):
  >=5: 43.0%  >=10: 2.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 1:19  2:19  3:26  4:50  5:38  6:22  7:16  8:4  9:2  10:4
  mean death depth=4.30  floors gained p50=3 mean=3.30  encounters survived mean=10.75
  reach: >=5 43.0%  >=8 5.0%  >=9 3.0%  >=10 2.0%  >=13 0.0%  >=16 0.0%  >=20 0.0%
  band share of deaths: Filter 1-4 57.0% | Wall 5-8 40.0% | Breakaway 9-15 3.0% | Endgame 16-20 0.0% | beyond 20 0.0%
  top causes — Filter: undone by a trap 9, cut down by a Gremlin 8, cut down by a Werebeast 8, cut down by a Dante 7, starved in the dark 7
  top causes — Wall: starved in the dark 11, spent by the dungeon itself 9, cut down by a Drake 6, cut down by a Drarl 5, cut down by a Werebeast 5
  top causes — Breakaway: cut down by a Drudge 2, cut down by a Stalka Beast 2, starved in the dark 2
  top causes — Endgame: (none)

Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):
  L=1  reached=200  deaths=19 (hazard 8 / starvation 1 / combat 10)  p_L=90.5%  S_L=90.5%  target p_L=98.8%  target S_L=98.8%  dS=-8.3  MISS
  L=2  reached=181  deaths=19 (hazard 3 / starvation 3 / combat 13)  p_L=89.5%  S_L=81.0%  target p_L=96.3%  target S_L=95.1%  dS=-14.1  MISS
  L=3  reached=162  deaths=26 (hazard 1 / starvation 3 / combat 22)  p_L=84.0%  S_L=68.0%  target p_L=93.1%  target S_L=88.6%  dS=-20.6  MISS
  L=4  reached=136  deaths=50 (hazard 4 / starvation 6 / combat 40)  p_L=63.2%  S_L=43.0%  target p_L=89.9%  target S_L=79.7%  dS=-36.7  MISS
  L=5  reached=86  deaths=38 (hazard 1 / starvation 10 / combat 27)  p_L=55.8%  S_L=24.0%  target p_L=86.9%  target S_L=69.2%  dS=-45.2  MISS
  L=6  reached=48  deaths=22 (hazard 3 / starvation 5 / combat 14)  p_L=54.2%  S_L=13.0%  target p_L=84.3%  target S_L=58.4%  dS=-45.4  MISS
  L=7  reached=26  deaths=16 (hazard 0 / starvation 3 / combat 13)  p_L=38.5%  S_L=5.0%  target p_L=82.2%  target S_L=48.0%  dS=-43.0  MISS
  L=8  reached=10  deaths=4 (hazard 0 / starvation 2 / combat 2)  p_L=60.0%  S_L=3.0%  target p_L=80.6%  target S_L=38.7%  dS=-35.7  MISS
  L=9  reached=6  deaths=2 (hazard 0 / starvation 1 / combat 1)  p_L=66.7%  S_L=2.0%  target p_L=79.5%  target S_L=30.8%  dS=-28.8  MISS
  L=10  reached=4  deaths=4 (hazard 0 / starvation 1 / combat 3)  p_L=0.0%  S_L=0.0%  target p_L=78.9%  target S_L=24.3%  dS=-24.3  MISS
  reach-20: 0.0% (band 3.0-5.0%) MISS
  verdict: floors outside the pass band: 1 (dS -8.3), 2 (dS -14.1), 3 (dS -20.6), 4 (dS -36.7), 5 (dS -45.2), 6 (dS -45.4), 7 (dS -43.0), 8 (dS -35.7), 9 (dS -28.8), 10 (dS -24.3); reach-20 MISS

Outcome: 200 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

**`node tools/tune-difficulty.mjs --seeds=200 --party` (party, committed on `a78bef5`):**

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=5  p90=7  max=15

Action-count distribution:
  min=21  p50=621  p90=20000  max=20000

Death-cause breakdown:
  starved in the dark  16 (8.0%)
  fell off a wall      16 (8.0%)
  cut down by a Werebeast 14 (7.0%)
  undone by a trap     12 (6.0%)
  cut down by a Primp  7 (3.5%)
  (34 more causes, 1-6 each — see the committed transcript for the full list)

Parley (D-15 readout — informational, not a gate):
  attempts=382  successes=231 (60.5%)  failures=151  refused=0  exhausted=0
  runs with >=1 attempt: 71 of 200
  SP from parley: 3837 of 149813 total SP (2.6%)

Reach table (% of runs reaching floor N):
  >=5: 58.7%  >=10: 2.8%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Party (--party, D-12/D-20):
  member forced at run start in 192/200 runs; member alive at run end: 128 (64.0%)

Stuck: 57 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 1:8  2:9  3:8  4:34  5:35  6:23  7:13  8:6  9:3  10:3  15:1
  mean death depth=4.97  floors gained p50=4 mean=3.97  encounters survived mean=12.66
  reach: >=5 58.7%  >=8 9.1%  >=9 4.9%  >=10 2.8%  >=13 0.7%  >=16 0.0%  >=20 0.0%
  band share of deaths: Filter 1-4 41.3% | Wall 5-8 53.8% | Breakaway 9-15 4.9% | Endgame 16-20 0.0% | beyond 20 0.0%
  top causes — Filter: starved in the dark 10, fell off a wall 9, undone by a trap 5, cut down by a Dante 4, cut down by a Poltergeist 4
  top causes — Wall: cut down by a Werebeast 12, fell off a wall 7, undone by a trap 7, cut down by a Blumble 5, cut down by a Primp 5
  top causes — Breakaway: cut down by a Drarl 2, cut down by a Vampire 2, cut down by a Djinni 1, cut down by a Stink Bug 1, starved in the dark 1
  top causes — Endgame: (none)

Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):
  L=1  reached=200  deaths=8 (hazard 6 / starvation 0 / combat 2)  p_L=96.0%  S_L=96.0%  target p_L=98.8%  target S_L=98.8%  dS=-2.8  PASS
  L=2  reached=187  deaths=9 (hazard 2 / starvation 4 / combat 3)  p_L=95.2%  S_L=91.4%  target p_L=96.3%  target S_L=95.1%  dS=-3.7  PASS
  L=3  reached=171  deaths=8 (hazard 3 / starvation 4 / combat 1)  p_L=95.3%  S_L=87.1%  target p_L=93.1%  target S_L=88.6%  dS=-1.5  PASS
  L=4  reached=155  deaths=34 (hazard 6 / starvation 4 / combat 24)  p_L=78.1%  S_L=68.0%  target p_L=89.9%  target S_L=79.7%  dS=-11.7  MISS
  L=5  reached=106  deaths=35 (hazard 5 / starvation 2 / combat 28)  p_L=67.0%  S_L=45.5%  target p_L=86.9%  target S_L=69.2%  dS=-23.7  MISS
  L=6  reached=56  deaths=23 (hazard 5 / starvation 4 / combat 14)  p_L=58.9%  S_L=26.8%  target p_L=84.3%  target S_L=58.4%  dS=-31.6  MISS
  L=7  reached=28  deaths=13 (hazard 3 / starvation 0 / combat 10)  p_L=53.6%  S_L=14.4%  target p_L=82.2%  target S_L=48.0%  dS=-33.6  MISS
  L=8  reached=14  deaths=6 (hazard 1 / starvation 0 / combat 5)  p_L=57.1%  S_L=8.2%  target p_L=80.6%  target S_L=38.7%  dS=-30.5  MISS
  L=9  reached=8  deaths=3 (hazard 0 / starvation 0 / combat 3)  p_L=62.5%  S_L=5.1%  target p_L=79.5%  target S_L=30.8%  dS=-25.7  MISS
  L=10  reached=4  deaths=3 (hazard 0 / starvation 1 / combat 2)  p_L=25.0%  S_L=1.3%  target p_L=78.9%  target S_L=24.3%  dS=-23.0  MISS
  L=11  reached=1  deaths=0 (hazard 0 / starvation 0 / combat 0)  p_L=100.0%  S_L=1.3%  target p_L=78.7%  target S_L=19.1%  dS=-17.8  MISS
  L=12  reached=1  deaths=0 (hazard 0 / starvation 0 / combat 0)  p_L=100.0%  S_L=1.3%  target p_L=78.8%  target S_L=15.1%  dS=-13.8  MISS
  L=13  reached=1  deaths=0 (hazard 0 / starvation 0 / combat 0)  p_L=100.0%  S_L=1.3%  target p_L=79.1%  target S_L=11.9%  dS=-10.6  MISS
  L=14  reached=1  deaths=0 (hazard 0 / starvation 0 / combat 0)  p_L=100.0%  S_L=1.3%  target p_L=79.6%  target S_L=9.5%  dS=-8.2  MISS
  L=15  reached=1  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=0.0%  S_L=0.0%  target p_L=80.2%  target S_L=7.6%  dS=-7.6  MISS
  reach-20: 0.0% (band 3.0-5.0%) MISS
  verdict: floors outside the pass band: 4 (dS -11.7), 5 (dS -23.7), 6 (dS -31.6), 7 (dS -33.6), 8 (dS -30.5), 9 (dS -25.7), 10 (dS -23.0), 11 (dS -17.8), 12 (dS -13.8), 13 (dS -10.6), 14 (dS -8.2), 15 (dS -7.6); reach-20 MISS

Outcome: 143 dead, 57 stuck (hit maxActions=20000; excluded from depth stats)
```

The party readout's floors 1-3 already PASS (dS -2.8/-3.7/-1.5, all within the ±8 band) — the party harness's own recruited member absorbs enough early damage that the Filter cushion is already close to the target curve; floors 4+ are still MISS at the same magnitude as solo.


**`node tools/tune-difficulty.mjs --seeds=50 --start-depth=20` (slice, committed on `a78bef5`):**

```
tune-difficulty: 50 seeded auto-play run(s), start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):
  L=20  reached=50  deaths=19 (hazard 0 / starvation 0 / combat 19)  p_L=62.0%  S_L=62.0%  target p_L=84.5%  target S_L=3.0%  dS=+59.0  MISS
  L=21  reached=31  deaths=8 (hazard 2 / starvation 2 / combat 4)  p_L=74.2%  S_L=46.0%  target p_L=85.4%  target S_L=2.5%  dS=+43.5  info
  L=22  reached=23  deaths=13 (hazard 2 / starvation 2 / combat 9)  p_L=43.5%  S_L=20.0%  target p_L=86.4%  target S_L=2.2%  dS=+17.8  info
  L=23  reached=10  deaths=3 (hazard 0 / starvation 2 / combat 1)  p_L=70.0%  S_L=14.0%  target p_L=87.2%  target S_L=1.9%  dS=+12.1  info
  L=24  reached=7  deaths=4 (hazard 0 / starvation 0 / combat 4)  p_L=42.9%  S_L=6.0%  target p_L=88.1%  target S_L=1.7%  dS=+4.3  info
  L=25  reached=3  deaths=0 (hazard 0 / starvation 0 / combat 0)  p_L=100.0%  S_L=6.0%  target p_L=88.9%  target S_L=1.5%  dS=+4.5  info
  verdict: all floors 1-19 inside the pass band; reach-20 MISS

Outcome: 50 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

The slice's p_20 rose from 36.0% (rung 2) to 62.0% this rung — the Endgame knots' first fit (1.0 -> 0.6) is already a large directional gain toward the 84.5% target; this is the p_meas input for rung 4's Endgame-knot fit (still < 10 natural runs reaching floor 16, so the slice is used again).

**`node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p54-rung3-smoke.json`** (143 cells; committed): POOLED `n=715 stuck=0 mean=4.50 p50=4.0 p90=7.0 >=5%=45.0 >=10%=1.5 kills=10.89 lvl=3.01 actions=500.95`; top causes `starved in the dark(76), cut down by a Werebeast(62), fell off a wall(44)`. `metaParity` vs `v17-p54-rung2-smoke.json`: `true []`. `meta.commit` = `a78bef5`.

**Checks:** floor-1 pin holds (`difficultyCurve(1)` byte-identical); `node tools/initiative-fixture-scan.mjs | diff -` empty (no fixture moved); `npm test` 3403/3403 fail 0; `build:www` exit 0; master hash unchanged.

**What moved:** the first fit pushed every Filter/Wall/Breakaway/Endgame foePower and the Filter/Wall hazard knots down together (the shared band-level `f_K` from the floor-clamp at 0.6 for every Wall/Breakaway/Endgame knot this rung, since rung 2 had almost no data past floor 7). Solo p_4 rose 55.0% -> 63.2%, p_5 37.5% -> 55.8%, reach>=5 36.0% -> 43.0%, reach>=10 0.0% -> 2.0%; the slice's p_20 rose 36.0% -> 62.0%. Every floor is STILL a MISS (the curve needed a much bigger first move than a single fit can supply from thin rung-2 data), but every ΔS moved in the right direction. **Class-cell collapse check** (`b.rollups.pooled.meanDepth - a.rollups.pooled.meanDepth` where a = `v17-p54-rung2-smoke.json`, b = `v17-p54-rung3-smoke.json`): `pooledShift +0.35, collapsed 27` (27 of 143 cells dipped at n=5 seeds against a positive pooled shift) — consistent with seed noise at this sample size rather than a regression (the pooled direction is UP, matching the solo/slice readouts above); no rollback indicated.

**What to turn next:** rung 3's own `verdict:` is non-empty (every floor MISS) — the ladder continues to rung 4, computed from THIS rung's own solo per-floor table (now with real per-floor cause splits, not a retro reconstruction) and this rung's slice p_20 (62.0%, still the Endgame p_meas since floor 16 reached_16 is still 0 natural runs).

#### Rung 4 — commit 09b944b (second FIT: F2/F3/F4 0.34/0.48/0.38; Wall 0.35/0.45; Breakaway 0.45/0.48; Endgame 0.49/0.47; hazard/ability knots unchanged)

The second FIT, computed from rung 3's own LIVE solo per-floor table (real per-run cause splits, not a retro reconstruction) plus the `--start-depth=20` slice's p_20 (62.0%).

**Fit table (from rung 3's readouts):**

| Depth | Constant | cur | p_meas | source | target p_L | Δ | f_K | next |
|---|---|---|---|---|---|---|---|---|
| 2 | FOE_GRACE_AT_2 | 0.37 | 89.5% | solo L=2 (reached 181) | 96.3% | 6.8 | 0.932 | 0.34 |
| 3 | FOE_GRACE_AT_3 | 0.53 | 84.0% | solo L=3 (reached 162) | 93.1% | 9.1 | 0.909 | 0.48 |
| 4 | FOE_GRACE_AT_4 | 0.52 | 63.2% | solo L=4 (reached 136) | 89.9% | 26.7 | 0.733 | 0.38 |
| 5 | WALL_FOE_POWER_AT_START | 0.51 | 55.8% | solo L=5 (reached 86) | 86.9% | 31.1 | 0.689 (not clamped) | 0.35 |
| 8 | WALL_FOE_POWER_AT_END | 0.57 | 60.0% | solo L=8 (reached 10, exactly the threshold — first independent measurement) | 80.6% | 20.6 | 0.794 | 0.45 |
| 9 | BREAKAWAY_FOE_POWER_AT_START | 0.57 | n/a (reached 6 < 10) | inherits f from knot 8 (0.794) | 79.5% | — | 0.794 | 0.45 |
| 15 | BREAKAWAY_FOE_POWER_AT_END | 0.6 | n/a (reached 0 < 10) | inherits f via knot 9's chain (0.794) | 80.2% | — | 0.794 | 0.48 |
| 16 | ENDGAME_FOE_POWER_AT_START | 0.6 | 62.0% | `--start-depth=20` slice p_20 (0 natural runs @16) | 81.0% | 19.0 | 0.81 | 0.49 |
| 20 | ENDGAME_FOE_POWER_AT_END | 0.6 | 62.0% | slice p_20 | 84.5% | 22.5 | 0.775 | 0.47 |

Hazard knots (band hazard share from rung 3's own LIVE solo per-floor split — the first genuine, non-substituted reading, correcting rung 3's own party-transcript-derived estimate):

| Band | deaths | hazard | share | vs 15% threshold | knots |
|---|---|---|---|---|---|
| Filter (1-4) | 114 | 16 | 14.05% | below — unchanged | HAZARD_SCALE_AT_START/AT_3/AT_4 stay 0.46/0.44/0.49 |
| Wall (5-8) | 80 | 4 | 5.0% | below — unchanged | WALL_HAZARD_SCALE stays 0.6 |
| Breakaway (9-10, partial) | 6 | 0 | 0% | below — unchanged | BREAKAWAY_HAZARD_SCALE stays 1.0 |
| Endgame | 0 | 0 | no data | unchanged | ENDGAME_HAZARD_SCALE stays 1.0 |

Ability knots: all six unchanged — still no per-band kit-bearing-foe DEATH share is recorded (only caster-ENCOUNTER rate, a different metric). Starvation check: Filter 12.3%, Wall 7.5% (both < 50%, no food-economy override). Secondary group: not yet triggerable (this is fit #2 — the rule requires two CONSECUTIVE fits before the check is assessable; re-evaluated at rung 5).

**Constants (Old -> New):**

| Constant | Old | New |
|---|---|---|
| `FOE_GRACE_AT_2` | 0.37 | 0.34 |
| `FOE_GRACE_AT_3` | 0.53 | 0.48 |
| `FOE_GRACE_AT_4` | 0.52 | 0.38 |
| `WALL_FOE_POWER_AT_START` | 0.51 | 0.35 |
| `WALL_FOE_POWER_AT_END` | 0.57 | 0.45 |
| `BREAKAWAY_FOE_POWER_AT_START` | 0.57 | 0.45 |
| `BREAKAWAY_FOE_POWER_AT_END` | 0.6 | 0.48 |
| `ENDGAME_FOE_POWER_AT_START` | 0.6 | 0.49 |
| `ENDGAME_FOE_POWER_AT_END` | 0.6 | 0.47 |
| hazard/ability knots | — | unchanged |

**Curve at 1..25 (foePower / hazardScale / abilityThreat), measured via `node -e` against the `09b944b` commit:**

| d | dots | darkBlobs | darkRadius | foePower | hazardScale | foeCap | abilityThreat |
|---|---|---|---|---|---|---|---|
| 1 | 10 | 0 | 4 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 2 | 11 | 1 | 5 | 0.3400 | 0.4600 | 3 | 1.0000 (exact) |
| 3 | 11 | 1 | 6 | 0.4800 | 0.4400 | 3 | 1.0000 (exact) |
| 4 | 11 | 2 | 7 | 0.3800 | 0.4900 | 3 | 1.0000 (exact) |
| 5 | 11 | 3 | 7 | 0.3500 | 0.6000 | 3 | 1.0000 (exact) |
| 6 | 9 | 0 | 7 | 0.3833 | 0.6000 | 3 | 1.0000 (exact) |
| 7 | 12 | 3 | 7 | 0.4167 | 0.6000 | 3 | 1.0000 (exact) |
| 8 | 12 | 3 | 7 | 0.4500 | 0.6000 | 3 | 1.0000 (exact) |
| 9 | 12 | 3 | 7 | 0.4500 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 10 | 12 | 3 | 7 | 0.4550 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 11 | 9 | 0 | 7 | 0.4600 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 12 | 12 | 3 | 7 | 0.4650 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 13 | 12 | 3 | 7 | 0.4700 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 14 | 12 | 3 | 7 | 0.4750 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 15 | 12 | 3 | 7 | 0.4800 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 16 | 9 | 0 | 7 | 0.4900 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 17 | 12 | 3 | 7 | 0.4850 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 18 | 12 | 3 | 7 | 0.4800 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 19 | 13 | 3 | 7 | 0.4750 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 20 | 13 | 3 | 7 | 0.4700 | 1.0000 (exact) | 3 | 1.0000 (exact) |
| 21 | 9 | 0 | 7 | 0.4720 | 1.0000 (exact) | 3 | 1.0098 |
| 22 | 13 | 3 | 7 | 0.4739 | 1.0000 (exact) | 3 | 1.0193 |
| 23 | 13 | 3 | 7 | 0.4758 | 1.0000 (exact) | 3 | 1.0285 |
| 24 | 13 | 3 | 7 | 0.4776 | 1.0000 (exact) | 3 | 1.0374 |
| 25 | 13 | 3 | 7 | 0.4794 | 1.0000 (exact) | 3 | 1.0461 |

**`node tools/tune-difficulty.mjs --seeds=200` (solo, committed on `09b944b`):**

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=7  max=11

Action-count distribution:
  min=36  p50=512  p90=866  max=1092

Death-cause breakdown:
  cut down by a Werebeast 19 (9.5%)
  starved in the dark  16 (8.0%)
  spent by the dungeon itself 15 (7.5%)
  cut down by a Drarl  15 (7.5%)
  undone by a trap     15 (7.5%)
  cut down by a Herman 13 (6.5%)
  (37 more causes, 1-8 each — see the committed transcript for the full list)

Parley (D-15 readout — informational, not a gate):
  attempts=355  successes=228 (64.2%)  failures=127  refused=0  exhausted=0
  runs with >=1 attempt: 73 of 200
  SP from parley: 3635 of 168530 total SP (2.2%)

Reach table (% of runs reaching floor N):
  >=5: 48.0%  >=10: 2.0%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 1:19  2:19  3:26  4:40  5:40  6:21  7:16  8:12  9:3  10:3  11:1
  mean death depth=4.49  floors gained p50=3 mean=3.49  encounters survived mean=11.22
  reach: >=5 48.0%  >=8 9.5%  >=9 3.5%  >=10 2.0%  >=13 0.0%  >=16 0.0%  >=20 0.0%
  band share of deaths: Filter 1-4 52.0% | Wall 5-8 44.5% | Breakaway 9-15 3.5% | Endgame 16-20 0.0% | beyond 20 0.0%
  top causes — Filter: cut down by a Gremlin 8, cut down by a Werebeast 8, starved in the dark 8, undone by a trap 8, cut down by a Dante 6
  top causes — Wall: cut down by a Drarl 13, cut down by a Werebeast 11, cut down by a Herman 10, spent by the dungeon itself 8, starved in the dark 8
  top causes — Breakaway: cut down by a Dread Lock 2, undone by a trap 2, cut down by a Djinni 1, cut down by a Herman 1, spent by the dungeon itself 1
  top causes — Endgame: (none)

Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):
  L=1  reached=200  deaths=19 (hazard 8 / starvation 1 / combat 10)  p_L=90.5%  S_L=90.5%  target p_L=98.8%  target S_L=98.8%  dS=-8.3  MISS
  L=2  reached=181  deaths=19 (hazard 3 / starvation 3 / combat 13)  p_L=89.5%  S_L=81.0%  target p_L=96.3%  target S_L=95.1%  dS=-14.1  MISS
  L=3  reached=162  deaths=26 (hazard 1 / starvation 4 / combat 21)  p_L=84.0%  S_L=68.0%  target p_L=93.1%  target S_L=88.6%  dS=-20.6  MISS
  L=4  reached=136  deaths=40 (hazard 3 / starvation 6 / combat 31)  p_L=70.6%  S_L=48.0%  target p_L=89.9%  target S_L=79.7%  dS=-31.7  MISS
  L=5  reached=96  deaths=40 (hazard 6 / starvation 7 / combat 27)  p_L=58.3%  S_L=28.0%  target p_L=86.9%  target S_L=69.2%  dS=-41.2  MISS
  L=6  reached=56  deaths=21 (hazard 3 / starvation 3 / combat 15)  p_L=62.5%  S_L=17.5%  target p_L=84.3%  target S_L=58.4%  dS=-40.9  MISS
  L=7  reached=35  deaths=16 (hazard 0 / starvation 4 / combat 12)  p_L=54.3%  S_L=9.5%  target p_L=82.2%  target S_L=48.0%  dS=-38.5  MISS
  L=8  reached=19  deaths=12 (hazard 1 / starvation 2 / combat 9)  p_L=36.8%  S_L=3.5%  target p_L=80.6%  target S_L=38.7%  dS=-35.2  MISS
  L=9  reached=7  deaths=3 (hazard 1 / starvation 0 / combat 2)  p_L=57.1%  S_L=2.0%  target p_L=79.5%  target S_L=30.8%  dS=-28.8  MISS
  L=10  reached=4  deaths=3 (hazard 1 / starvation 1 / combat 1)  p_L=25.0%  S_L=0.5%  target p_L=78.9%  target S_L=24.3%  dS=-23.8  MISS
  L=11  reached=1  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=0.0%  S_L=0.0%  target p_L=78.7%  target S_L=19.1%  dS=-19.1  MISS
  reach-20: 0.0% (band 3.0-5.0%) MISS
  verdict: floors outside the pass band: 1 (dS -8.3), 2 (dS -14.1), 3 (dS -20.6), 4 (dS -31.7), 5 (dS -41.2), 6 (dS -40.9), 7 (dS -38.5), 8 (dS -35.2), 9 (dS -28.8), 10 (dS -23.8), 11 (dS -19.1); reach-20 MISS

Outcome: 200 dead, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

**`node tools/tune-difficulty.mjs --seeds=200 --party` (party, committed on `09b944b`):**

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=5  p90=8  max=15

Action-count distribution:
  min=21  p50=651  p90=20000  max=20000

Death-cause breakdown:
  starved in the dark  21 (10.5%)
  fell off a wall      13 (6.5%)
  undone by a trap     8 (4.0%)
  cut down by a Werebeast 8 (4.0%)
  cut down by a Drarl  7 (3.5%)
  (33 more causes, 1-7 each — see the committed transcript for the full list)

Parley (D-15 readout — informational, not a gate):
  attempts=393  successes=239 (60.8%)  failures=154  refused=0  exhausted=0
  runs with >=1 attempt: 72 of 200
  SP from parley: 4122 of 178440 total SP (2.3%)

Reach table (% of runs reaching floor N):
  >=5: 62.2%  >=10: 7.4%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Party (--party, D-12/D-20):
  member forced at run start in 192/200 runs; member alive at run end: 119 (59.5%)

Stuck: 52 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 1:8  2:9  3:7  4:32  5:32  6:20  7:12  8:14  9:3  10:6  11:2  12:1  14:1  15:1
  mean death depth=5.41  floors gained p50=4 mean=4.41  encounters survived mean=13.87
  reach: >=5 62.2%  >=8 18.9%  >=9 9.5%  >=10 7.4%  >=13 1.4%  >=16 0.0%  >=20 0.0%
  band share of deaths: Filter 1-4 37.8% | Wall 5-8 52.7% | Breakaway 9-15 9.5% | Endgame 16-20 0.0% | beyond 20 0.0%
  top causes — Filter: fell off a wall 8, starved in the dark 6, undone by a trap 5, cut down by a Dante 4, came up short on a leap 3
  top causes — Wall: starved in the dark 14, cut down by a Drarl 6, cut down by a Werebeast 6, cut down by a Djinni 5, fell off a wall 5
  top causes — Breakaway: cut down by a Vampire 4, cut down by a Drudge 2, cut down by a Herman 2, cut down by a Bones 1, cut down by a Craig 1
  top causes — Endgame: (none)

Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths):
  L=1  reached=200  deaths=8 (hazard 6 / starvation 0 / combat 2)  p_L=96.0%  S_L=96.0%  target p_L=98.8%  target S_L=98.8%  dS=-2.8  PASS
  L=2  reached=187  deaths=9 (hazard 2 / starvation 3 / combat 4)  p_L=95.2%  S_L=91.4%  target p_L=96.3%  target S_L=95.1%  dS=-3.7  PASS
  L=3  reached=171  deaths=7 (hazard 3 / starvation 3 / combat 1)  p_L=95.9%  S_L=87.6%  target p_L=93.1%  target S_L=88.6%  dS=-1.0  PASS
  L=4  reached=155  deaths=32 (hazard 5 / starvation 3 / combat 24)  p_L=79.4%  S_L=69.5%  target p_L=89.9%  target S_L=79.7%  dS=-10.2  MISS
  L=5  reached=112  deaths=32 (hazard 7 / starvation 4 / combat 21)  p_L=71.4%  S_L=49.7%  target p_L=86.9%  target S_L=69.2%  dS=-19.5  MISS
  L=6  reached=68  deaths=20 (hazard 1 / starvation 8 / combat 11)  p_L=70.6%  S_L=35.1%  target p_L=84.3%  target S_L=58.4%  dS=-23.3  MISS
  L=7  reached=43  deaths=12 (hazard 0 / starvation 2 / combat 10)  p_L=72.1%  S_L=25.3%  target p_L=82.2%  target S_L=48.0%  dS=-22.7  MISS
  L=8  reached=30  deaths=14 (hazard 0 / starvation 3 / combat 11)  p_L=53.3%  S_L=13.5%  target p_L=80.6%  target S_L=38.7%  dS=-25.2  MISS
  L=9  reached=15  deaths=3 (hazard 0 / starvation 1 / combat 2)  p_L=80.0%  S_L=10.8%  target p_L=79.5%  target S_L=30.8%  dS=-20.0  MISS
  L=10  reached=11  deaths=6 (hazard 0 / starvation 0 / combat 6)  p_L=45.5%  S_L=4.9%  target p_L=78.9%  target S_L=24.3%  dS=-19.4  MISS
  L=11  reached=5  deaths=2 (hazard 0 / starvation 0 / combat 2)  p_L=60.0%  S_L=2.9%  target p_L=78.7%  target S_L=19.1%  dS=-16.2  MISS
  L=12  reached=3  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=66.7%  S_L=2.0%  target p_L=78.8%  target S_L=15.1%  dS=-13.1  MISS
  L=13  reached=2  deaths=0 (hazard 0 / starvation 0 / combat 0)  p_L=100.0%  S_L=2.0%  target p_L=79.1%  target S_L=11.9%  dS=-9.9  MISS
  L=14  reached=2  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=50.0%  S_L=1.0%  target p_L=79.6%  target S_L=9.5%  dS=-8.5  MISS
  L=15  reached=1  deaths=1 (hazard 0 / starvation 0 / combat 1)  p_L=0.0%  S_L=0.0%  target p_L=80.2%  target S_L=7.6%  dS=-7.6  MISS
  reach-20: 0.0% (band 3.0-5.0%) MISS
  verdict: floors outside the pass band: 4 (dS -10.2), 5 (dS -19.5), 6 (dS -23.3), 7 (dS -22.7), 8 (dS -25.2), 9 (dS -20.0), 10 (dS -19.4), 11 (dS -16.2), 12 (dS -13.1), 13 (dS -9.9), 14 (dS -8.5), 15 (dS -7.6); reach-20 MISS

Outcome: 148 dead, 52 stuck (hit maxActions=20000; excluded from depth stats)
```

Floors 1-3 PASS again on the party readout (dS -2.8/-3.7/-1.0); floor 4 nearly passes (dS -10.2, close to the ±8 band); floors 5+ still MISS by 8-25 points.


**`node tools/tune-difficulty.mjs --seeds=50 --start-depth=20` (slice, committed on `09b944b`) — p_20 readout (informational, USER RULING C):** p_20 = 64.0% (reached 50, deaths 18), up from 62.0% at rung 3; still far from the 84.5% target — this is the p_meas input for rung 5's Endgame-knot fit (still no natural runs reach floor 16).

**`node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p54-rung4-smoke.json`** (143 cells; committed): POOLED `n=715 stuck=0 mean=4.71 p50=4.0 p90=8.0 >=5%=47.7 >=10%=2.8 kills=11.67 lvl=3.11 actions=530.17`; top causes `starved in the dark(78), fell off a wall(53), undone by a trap(47)`. `metaParity` vs `v17-p54-rung3-smoke.json`: `true []`. `meta.commit` = `09b944b`. **Class-cell collapse check:** `pooledShift +0.21, collapsed 34` — the pooled direction stays UP; consistent with seed noise at n=5 rather than a regression.

**Checks:** floor-1 pin holds; `node tools/initiative-fixture-scan.mjs | diff -` empty; `npm test` 3403/3403 fail 0; `build:www` exit 0; master hash unchanged.

**What moved:** floors 1-3 held flat (byte-identical reached/deaths to rung 3 — the small Filter-dial nudges did not flip any of these 200 seeds' fates at those shallow floors); floor 4 improved (63.2% -> 70.6%); floors 5-7 improved modestly (55.8%->58.3%, 54.2%->62.5%, 38.5%->54.3%); floor 8 WORSENED (60.0% -> 36.8%, but n grew 10 -> 19 so this is a noisier, now-more-representative reading, not a direction reversal per se — the Wall knots dropped sharply this rung, 0.57->0.45, and floor 8's own hazard/foePower cut may have overshot). The slice's p_20 nudged up (62.0% -> 64.0%). Every floor is STILL a MISS.

**What to turn next:** rung 4's verdict is non-empty — the ladder continues to rung 5, computed from THIS rung's own solo per-floor table and this rung's slice p_20 (64.0%). The secondary-group check ("a band's foePower AND hazard knot both <= 0.5, still missing by > 8 points after two consecutive fits") becomes assessable at rung 5 for the Filter/Wall bands (both fitted at rungs 3 and 4 now).

#### Why floor bands failed (rungs 1–5) — USER RULING D (2026-09-21)

The user's ruling, after rung 5, stopped the floor-range ladder entirely: "Remove one-off hacks and bandaids that try to get bands by floor ranges, and establish dials that work on the dungeon as a whole" and "we've reached a point where [staying true to the source] won't get us the difficulty curve we want ... holistically as a game design we probably need to deviate from core." The system, as measured across rungs 1-4 (54-CONTEXT.md's `### The system, as measured`), explains why: foe level was `min(heroLevel, depth)` (-1 on a d4 = 1), so difficulty was a function of the HERO's own level, not depth — the bot reaches level 3 by floor 4 and 4-5 by the Wall on kill-SP alone (SP ~ lvl^2, thresholds 201/501/901/1501), which is exactly when the tier-3/4/5 roster (Drarl, Herman, Drake) starts appearing in the death list, and depth stopped mattering once the hero out-leveled it (~floor 3); every floor-band knot (the Filter/Wall/Breakaway/Endgame constants above) scaled only the `lvl^2` term and foe HP — the DICE (Werebeast 2xd10, Dante x3, Gremlin +3, Drake 2d10+4) were never touched, so the ladder saturated by rung 4 (floor 4: 55% -> 63% -> 71% then flat; floors 1-3 byte-identical across rungs 3-4); foe count stepped 2 -> 3 at hero level 3, a second level-keyed cliff; and with no regeneration, encounter dots climbing 10 -> 13 with depth, hazards (falls, traps) at ~25% of deaths and starvation/exhaustion at ~10-15% and rising as foes softened, four consecutive fits (rungs 2-4) never closed the gap on floors 5+. Rung 5's constants were committed at `1cb56c6` (F2/F3/F4 0.32/0.44/0.31; Wall 0.25/0.27; Breakaway 0.27/0.29; Endgame 0.41/0.37; `ENCOUNTER_DOT_CAP` 13->12) and its readouts were never run — `readouts/rung5-solo.txt` / `rung5-party.txt` are empty by design, kept as history; the knot table itself is removed in 54-05.

#### Global model (USER RULING D) — the dial table

The governing principle (user, 2026-09-21, orchestrator's reading, ratified at plan approval): **FOE-side power keys to DEPTH; HERO-side power keys to the hero's LEVEL, paced by HERO_SP_SCALE; the ECONOMY keys to depth through foe tier (LOOT_SCALE); the fit sets the gap between the ramps.** All three USER RULING D questions were answered yes: (a) foe level is derived from DEPTH, not the hero's level; (b) hero-side tuning (HP, regen) is in scope; (c) the bot is made a fair player first (this plan's Task 1/3).

| Dial | Engine hook | Identity value | Starting value | Search bounds (step) | Search order | Direction (↑ =) |
|---|---|---|---|---|---|---|
| `FOE_LEVEL { base, perDepth }` | `foeLevelFor(depth)` -> combat.js `maxLvl` (replaces `min(c.level, depth)`; d4 bleed kept) | none — starting map | `{ base: 0.6, perDepth: 0.2 }` (tiers 1/1/1/1 · 2x5 · 3x5 · 4x5 · 5 from 20) | perDepth [0.12, 0.30] (0.03); base [0.3, 1.0] (0.15) | 1 (perDepth), 2 (base) | harder |
| `HERO_SP_SCALE` | `heroSpFor` at kill / parley / descend bonus / ±XP dots | 1 | 0.28 (est.: level 2 by ~5, 3 by ~9, 4 by ~12, 5 by ~16 from the measured kill rate ≈ 2.5 fights/floor × 1.5 foes × 17.5 SP × tier + the 40 + 30·d descend bonus; the fit moves it) | [0.15, 0.6] (0.05) | 3 | easier |
| `FOE_HIT_SCALE { base, perDepth }` | `foeHitFor` on the WHOLE hit at hero / member / pursuit | `{ 1, 0 }` | `{ base: 0.6, perDepth: 0.02 }` (0.62 at 1 -> 1.0 at 20 -> 1.2 at 30) | base [0.4, 1.0] (0.08); perDepth [0, 0.05] (0.01) | 4 (base), 5 (perDepth) | harder |
| `FOE_HP_SCALE { base, perDepth }` | `foeWpFor` | `{ 1, 0 }` | `{ base: 0.8, perDepth: 0.015 }` (0.815 -> 1.1 at 20) | base [0.5, 1.2] (0.1); perDepth held at 0.015 (available) | 6 (base) | harder |
| `HERO_HP_SCALE` | `heroMaxWpFor` at chargen + every level-up gain | 1 | 1.25 | [1.0, 1.8] (0.15) | 7 | easier |
| `HERO_REGEN_PER_FLOOR` | `heroRegenFor` in `descend` (hero only, once per arrival) | 0 | 0.25 | [0, 0.5] (0.1) | 8 | easier |
| `HAZARD_SCALE { base, perDepth }` | `scaleHazard` (traps, falls, leaps — floor 1 included) | `{ 1, 0 }` | `{ base: 0.5, perDepth: 0.02 }` | base [0.3, 1.0] (0.1); perDepth held at 0.02 (available) | 9 (base) | harder |
| `ENCOUNTER_DOTS { base, perDepth }` | `difficultyCurve.dots` (breather = base) | `{ 9, 1 }` (= canon 9 + d) | `{ base: 7, perDepth: 0.3 }` (7 -> 13 at 20) | base [5, 10] (1); perDepth held at 0.3 (available) | 10 (base) | harder |
| `LOOT_SCALE` | `lootFor` at kill purse / chest / faerie (Phase 75, RULES-02: the wilmst cache is its OWN `WILMST_CACHE_PER_DEPTH` constant, 100 × depth — it still passes THROUGH `lootFor`, but no longer rides `LOOT_SCALE` alone; see `## v2.1 engine rules (Phase 75)` below) | 1 | 0.8 ("already too much money") | held (available); [0.4, 1.5] if released | — | easier |
| `CAMP_HEAL_FRACTION` | `campHealFor` in `newDay` (fed night; same d10 as variance; doublers stay) | none — 0.17 mean-matched | 0.2 | held (available); [0.15, 0.5] if released | — | easier |
| `ROUND_DAMAGE_CEILING` | `roundDamageCapFor(c.level)` — per foe per visit, all swings, post-scale, pre-pipeline | 0 (off) | 0.5 (of `heroMeanMaxWpFor(level)`: 21 at L1, 30 at L5 with HERO_HP_SCALE 1) | held (available); [0.3, 1.0] if released | — | harder |
| `FOE_COUNT_SKEW` | `FOE_COUNT_TABLE[skew]` on the second d4 (canon draw shape) | 0 (P 1/2/3 = .500/.375/.125) | 1 (.625/.250/.125) | held (available); 0..4 if released | — | easier |
| `FOOD_CLOCK` | `startingRationsFor` (chargen rations × clock; small-bag cap 10) | 1 | 1.5 (Fighter 9 / Thief 8 / MU 6) | held (available); [1.0, 1.6] if released | — | easier |
| `ABILITY_THREAT { base, perDepth }` | `abilityCadenceFor` | `{ 1, 0 }` | `{ base: 1.0, perDepth: 0 }` | held (available); base [0.6, 1.2] if released | — | harder |
| `STORE_TIER { base, perDepth }` | `difficultyCurve.storeTier` -> `economy.js storeTier(depth)` (clamp 0..3) | `{ 0, 0.3 }` (= today's ladder) | `{ base: 0, perDepth: 0.3 }` | held (available); perDepth [0.15, 0.6] if released | — | easier |
| `FIGHT_SHARE` (= `DOT_MIX.fight`) | `remapEncounterResult` after the d8×d10 (same two draws) | 1.0 (= canon mix, 43/80 fights) | 1.0 | held (available); [0.6, 1.2] if released | — | harder |
| `WANDER_RATE` | `wanderWakeFacesFor(sub)` — d20 faces per hour slept that wake you | 1 | 1 | held (available); {0, 1, 2} if released | — | harder |
| `FOE_ACCURACY` | `foeAccuracyFor()` added to `foeToHitVs` need (+ breakdown) | 0 | 0 | held (available); −3..+3 if released | — | harder |
| `DARK_BLOBS { base, perDepth }` + `DARK_BLOB_CAP` | `difficultyCurve.darkBlobs` | `{ −0.4, 0.7 }` + 3 (map `012233333333`) | same | held (available); perDepth [0.3, 1.0] if released | — | harder |
| `DARK_RADIUS { base, perDepth }` + `DARK_RADIUS_CAP` | `difficultyCurve.darkRadius` | `{ 3, 1 }` + 7 (= today) | same | held (available) | — | harder |
| `DOT_HP_FRACTION { small, mid, large }` | `dotHpFor` at the ±10 / −15 / +25 HP dots | none — `{ 0.24, 0.36, 0.6 }` mean-matched at L1 | same | held (available) | — | harder (the −HP rows) |
| `TIER_SPREAD` | `tierSpreadFor()` — d4 faces that bleed one tier down | 1 | 1 | available, canon | — | easier (more bleed) |
| `DOT_MIX.harm / loot / help` | `remapEncounterResult` | 1.0 each | 1.0 | available, canon | — | harm ↑ harder; loot/help ↑ easier |
| `FLEE_NEED_MOD` / `PARLEY_NEED_MOD` | added to the flee need (`fleeBreakdown`) / the parley need | 0 / 0 | 0 / 0 | available, canon | — | harder |
| `STARTING_GOLD` / `STARTING_POTION_BONUS` | `rollCharacter` | 50 / 0 | 50 / 0 | available, canon | — | easier |
| `CLASS_MITIGATION` | `Fighter { hpMul 1, armorMul 1, killSpeed 1 (≤ 1 allowed) }`, `Thief { evasion 0, fleeBonus = FLEE_THIEF_BONUS, trapAvoid 0, killSpeed 1 (≥ 1 allowed) }`, `"Magic User" { spellPower 1 }` | identity rows | identity rows | manual knob only (max two notches per phase; first candidate Thief `evasion: -1` — the base Thief has no innate evasion today, only Acrobat / pool abilities) | — | per row |
| `MAZE_SIZE` | — (CUT from Phase 54: no dial, no engine/shell/bot grid change; `GW`/`GH` stay 21) | — | — | available, not implemented (v1.8 candidate) | — | harder |

**The class-pool ruling:** race / class / sub-class combinations are NOT meant to be equal — the random draw is part of the design; the fairness and identity constraints apply ONLY to the three class pools (Fighter/Thief/Magic User); the per-cell spread (`tools/lib/class-matrix.mjs`'s `rollups.byClass[].spread`, `tools/lib/band-readout.mjs`'s `classSpreadReadout`) is a recorded readout, never a target; never a race- or sub-class-keyed constant.

**The roster note:** 54 creatures, 6 types × 5 tiers (12/11/12/12/7); under the starting `FOE_LEVEL` map (`0.6 + 0.2·depth`: tier 1 on floors 1-4, tier 2 on 5-9, tier 3 on 10-14, tier 4 on 15-19, tier 5 from 20) tier 5 (7 creatures) appears from floor 20 only — recorded as a v1.8 content candidate ("Endgame roster: +5-8 tier-5 creatures, ≥ 1 per type") if the fit ends up pulling tier 5 shallower than ~17.

**The target:** `#### Target — the per-floor survival curve (USER RULING C, 2026-09-21)` (above, this same H3) stands as the fit's objective — the 25-row p_L/S_L curve is unchanged by USER RULING D.

**Cuts at plan approval (2026-09-21):** (1) the automated fit searches the CORE 10 coordinates only (`FOE_LEVEL.perDepth/base`, `HERO_SP_SCALE`, `FOE_HIT_SCALE.base/perDepth`, `FOE_HP_SCALE.base`, `HERO_HP_SCALE`, `HERO_REGEN_PER_FLOOR`, `HAZARD_SCALE.base`, `ENCOUNTER_DOTS.base`, named in order above) — every other dial is implemented and HELD at its start value ("held (available)"); the miss table names which held dial would be released next; (2) `MAZE_SIZE` is cut from this phase (21x21 stays; v1.8 candidate); (3) the fit objective and pass/fail cover floors 1-12 at 200 seeds (±8 on 1-10, ±3 on 11-12, `SURVIVAL_PASS.deepFloors = [11, 12]`); floors 13-20 and reach-20 are measured at AFTER with a 1,000-seed solo run and a `--start-depth=10` slice, recorded with dS only (the TAIL, `SURVIVAL_PASS.tailFloors = [13, 20]`).

#### BEFORE (global model) — commit 8e43ad651ba5e390f3918c4f16abf91b044b517a (fair bot; untouched engine at `1cb56c6`'s knot values)

**Parameters:** `node tools/tune-difficulty.mjs --seeds=200` (solo), `node tools/tune-difficulty.mjs --seeds=200 --party` (backgrounded), `node tools/tune-difficulty.mjs --seeds=50 --start-depth=20` (slice), `node tools/tune-classes.mjs --seeds 5 --workers 4 --out docs/class-pass/v17-p54-global-before-smoke.json` (smoke). No `--max-actions` override needed — solo's 30/200 stuck and party's 61/200 stuck stayed within the normal ~15-30% bucket, own bucket, excluded from depth stats. `git diff --stat 5550002 -- engine/ content/` empty at run time on every transcript.

**Bot line (identical on every transcript):** `Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.4/0.6(caster)  potion<0.6  camp<0.5  seeds=200  startDepth=1`

**Solo (`readouts/global-before-solo.txt`) — Death-depth distribution:** `min=1  p50=4  p90=8  max=12`. **Death-cause breakdown (top 12):**

```
  starved in the dark  32 (16.0%)
  fell off a wall      13 (6.5%)
  undone by a trap     12 (6.0%)
  spent by the dungeon itself 10 (5.0%)
  cut down by a Herman 9 (4.5%)
  cut down by a Frank  7 (3.5%)
  cut down by a Werebeast 6 (3.0%)
  cut down by a Drarl  6 (3.0%)
  cut down by a Rinkle 5 (2.5%)
  cut down by a Dante  5 (2.5%)
  cut down by a Poltergeist 5 (2.5%)
  cut down by a Djinni 5 (2.5%)
```

**Solo — Per-floor survival:**

```
  L=1  reached=200  deaths=15 (combat 7 / dot 8 / starvation-exhaustion 0 / other 0)  p_L=92.5%  S_L=92.5%  target p_L=98.8%  target S_L=98.8%  dS=-6.3  PASS
  L=2  reached=182  deaths=21 (combat 10 / dot 5 / starvation-exhaustion 6 / other 0)  p_L=88.5%  S_L=81.8%  target p_L=96.3%  target S_L=95.1%  dS=-13.3  MISS
  L=3  reached=160  deaths=16 (combat 9 / dot 3 / starvation-exhaustion 4 / other 0)  p_L=90.0%  S_L=73.6%  target p_L=93.1%  target S_L=88.6%  dS=-15.0  MISS
  L=4  reached=141  deaths=34 (combat 25 / dot 6 / starvation-exhaustion 3 / other 0)  p_L=75.9%  S_L=55.9%  target p_L=89.9%  target S_L=79.7%  dS=-23.8  MISS
  L=5  reached=99  deaths=24 (combat 11 / dot 6 / starvation-exhaustion 7 / other 0)  p_L=75.8%  S_L=42.3%  target p_L=86.9%  target S_L=69.2%  dS=-26.9  MISS
  L=6  reached=69  deaths=24 (combat 15 / dot 5 / starvation-exhaustion 4 / other 0)  p_L=65.2%  S_L=27.6%  target p_L=84.3%  target S_L=58.4%  dS=-30.8  MISS
  L=7  reached=43  deaths=14 (combat 9 / dot 2 / starvation-exhaustion 3 / other 0)  p_L=67.4%  S_L=18.6%  target p_L=82.2%  target S_L=48.0%  dS=-29.4  MISS
  L=8  reached=26  deaths=9 (combat 7 / dot 1 / starvation-exhaustion 1 / other 0)  p_L=65.4%  S_L=12.2%  target p_L=80.6%  target S_L=38.7%  dS=-26.5  MISS
  L=9  reached=15  deaths=5 (combat 3 / dot 0 / starvation-exhaustion 2 / other 0)  p_L=66.7%  S_L=8.1%  target p_L=79.5%  target S_L=30.8%  dS=-22.7  MISS
  L=10  reached=9  deaths=4 (combat 3 / dot 1 / starvation-exhaustion 0 / other 0)  p_L=55.6%  S_L=4.5%  target p_L=78.9%  target S_L=24.3%  dS=-19.8  MISS
  L=11  reached=4  deaths=2 (combat 1 / dot 0 / starvation-exhaustion 1 / other 0)  p_L=50.0%  S_L=2.3%  target p_L=78.7%  target S_L=19.1%  dS=-16.8  MISS
  L=12  reached=2  deaths=2 (combat 1 / dot 0 / starvation-exhaustion 1 / other 0)  p_L=0.0%  S_L=0.0%  target p_L=78.8%  target S_L=15.1%  dS=-15.1  MISS
  reach-20: 0.0% (band 3.0-5.0%, reported — tail)
  verdict: floors outside the pass band: 2 (dS -13.3), 3 (dS -15.0), 4 (dS -23.8), 5 (dS -26.9), 6 (dS -30.8), 7 (dS -29.4), 8 (dS -26.5), 9 (dS -22.7), 10 (dS -19.8), 11 (dS -16.8), 12 (dS -15.1)
```

No natural solo run reached floor 13+ this cycle (max death depth 12) — the TAIL (13-20) is measured by the party transcript and the depth-20 slice below, not by solo.

**Solo — Pace (whole block):**

```
  L=1  n=200  level=1.05  gold=128.74  ar=5.76  weapon=177.75  maxWP=45.72  potions=1.24  afraid=71  diedAfraid=0
  L=2  n=182  level=1.36  gold=273.99  ar=5.24  weapon=183.52  maxWP=48.80  potions=0.86  afraid=81  diedAfraid=1
  L=3  n=160  level=2.14  gold=531.46  ar=5.00  weapon=189.69  maxWP=54.50  potions=0.69  afraid=76  diedAfraid=0
  L=4  n=141  level=2.70  gold=821.44  ar=4.73  weapon=203.19  maxWP=57.52  potions=0.48  afraid=63  diedAfraid=1
  L=5  n=99  level=3.30  gold=1052.26  ar=5.05  weapon=222.98  maxWP=61.87  potions=0.37  afraid=34  diedAfraid=2
  L=6  n=69  level=3.78  gold=1462.55  ar=5.12  weapon=221.74  maxWP=67.58  potions=0.33  afraid=26  diedAfraid=1
  L=7  n=43  level=4.35  gold=1814.70  ar=4.56  weapon=250.58  maxWP=73.98  potions=0.21  afraid=20  diedAfraid=0
  L=8  n=26  level=4.69  gold=2375.54  ar=4.08  weapon=237.50  maxWP=77.00  potions=0.15  afraid=12  diedAfraid=0
  L=9  n=15  level=5.00  gold=2691.67  ar=4.33  weapon=188.33  maxWP=80.27  potions=0.07  afraid=11  diedAfraid=2
  L=10  n=9  level=5.00  gold=2767.00  ar=3.00  weapon=172.22  maxWP=84.89  potions=0.00  afraid=3  diedAfraid=1
  L=11  n=4  level=5.00  gold=3598.50  ar=4.50  weapon=187.50  maxWP=96.00  potions=0.00  afraid=1  diedAfraid=0
  L=12  n=2  level=5.00  gold=3979.00  ar=3.00  weapon=162.50  maxWP=87.00  potions=0.00  afraid=2  diedAfraid=0
```

**Solo — Class identity (whole block):**

```
  Fighter  n=69  p50=5  reach5=55.6%  reach10=3.7%  reach20=0.0%  dmgTaken/fight=4.86  rounds/fight=2.51  foeMiss=69.5%  casts(def/off)=0/0  potions/run=1.10  backstabs/run=0.00  flees/run=0.99
  Thief  n=72  p50=4  reach5=49.2%  reach10=6.3%  reach20=0.0%  dmgTaken/fight=5.21  rounds/fight=2.90  foeMiss=73.2%  casts(def/off)=0/0  potions/run=1.96  backstabs/run=6.19  flees/run=2.46
  Magic User  n=59  p50=4  reach5=43.4%  reach10=3.8%  reach20=0.0%  dmgTaken/fight=5.85  rounds/fight=2.51  foeMiss=68.3%  casts(def/off)=167/897  potions/run=2.98  backstabs/run=0.00  flees/run=0.68
```

**Solo — Stuck / Bot lines:** `Stuck: 30 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)`; `Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.4/0.6(caster)  potion<0.6  camp<0.5  seeds=200  startDepth=1`.

**Party (`readouts/global-before-party.txt`) — survival + class identity + Stuck:**

```
  (L=1 floor-1 parity: 200 runs reach it, 96.5% survive it — the same "every run reaches floor 1" shape the solo block above shows)
  L=4  reached=137  deaths=20 (combat 13 / dot 3 / starvation-exhaustion 4 / other 0)  p_L=85.4%  S_L=69.4%  target p_L=89.9%  target S_L=79.7%  dS=-10.3  MISS
  L=8  reached=28  deaths=9 (combat 7 / dot 2 / starvation-exhaustion 0 / other 0)  p_L=67.9%  S_L=17.3%  target p_L=80.6%  target S_L=38.7%  dS=-21.4  MISS
  L=12  reached=7  deaths=2 (combat 1 / dot 1 / starvation-exhaustion 0 / other 0)  p_L=71.4%  S_L=5.4%  target p_L=78.8%  target S_L=15.1%  dS=-9.7  MISS
  L=13..20 tail (party reached at most n=1 by L=15-20 — a single long-lived run; 13-20 print tail, never PASS/MISS)
  reach-20: 0.5% (band 3.0-5.0%, reported — tail)
  verdict: floors outside the pass band: 4 (dS -10.3), 5 (dS -18.2), 6 (dS -25.2), 7 (dS -22.5), 8 (dS -21.4), 9 (dS -16.4), 10 (dS -15.6), 11 (dS -11.5), 12 (dS -9.7)

Class identity (class pools only):
  Fighter  n=69  p50=5  reach5=63.0%  reach10=11.1%  reach20=1.9%  dmgTaken/fight=3.77  rounds/fight=2.40  foeMiss=66.6%  potions/run=1.06  backstabs/run=0.00  flees/run=1.28
  Thief  n=72  p50=5.5  reach5=78.6%  reach10=7.1%  reach20=0.0%  dmgTaken/fight=2.90  rounds/fight=2.23  foeMiss=70.8%  potions/run=2.13  backstabs/run=6.40  flees/run=1.54
  Magic User  n=59  p50=4  reach5=39.5%  reach10=11.6%  reach20=0.0%  dmgTaken/fight=3.30  rounds/fight=1.82  foeMiss=61.1%  casts(def/off)=80/854  potions/run=2.97  backstabs/run=0.00  flees/run=0.69

Stuck: 61 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)
Outcome: 139 dead, 61 stuck (hit maxActions=20000; excluded from depth stats)
```

**Depth-20 slice (`readouts/global-before-start-depth-20.txt`) — survival block:**

```
  L=20  reached=50  deaths=16 (combat 15 / dot 1 / starvation-exhaustion 0 / other 0)  p_L=68.0%  S_L=68.0%  target p_L=84.5%  target S_L=3.0%  dS=+65.0  tail
  reach-20: 100.0% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band
```

(No floors 1-12 exist on this slice — a `--start-depth=20` run never visits them; the verdict prints its own vacuous-true "all floors 1-12 inside the pass band" since `missing` is empty over an empty domain.) Death-cause breakdown leads with `cut down by a Herman 9 (18.0%)`, `starved in the dark 5 (10.0%)`, `cut down by a Stalka Beast 5 (10.0%)`, `cut down by a Vampire 5 (10.0%)`, `cut down by a Drarl 4 (8.0%)`, `cut down by a Drake 3 (6.0%)` — the tier-4/5 roster the roster note above discusses.

**Smoke (`docs/class-pass/v17-p54-global-before-smoke.json`, `readouts/global-before-smoke.txt`) — pooled line + Class spread:**

```
POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  top causes
715  86  4.79  4.0  8.0  49.6  4.1  0.0  11.10  3.03  537.98  starved in the dark(106),fell off a wall(50),undone by a trap(46)

Class spread (recorded, not a target):
  Fighter  p50Depth min=2.0 (Barbarian/Elven) max=9.0 (Woodsman/Wilmsry)  reach5 min=0.0 (Woodsman/Elven) max=100.0 (Knight/Human)
  Thief  p50Depth min=2.0 (Pilfer/Elven) max=9.0 (Cat Burglar/Wilmsry)  reach5 min=0.0 (Pilfer/Elven) max=100.0 (Cutthroat/Wilmsry)
  Magic User  p50Depth min=1.0 (Cleric/Dwarven) max=8.0 (Warlock/Troll)  reach5 min=0.0 (Sorcerer/Dwarven) max=80.0 (Warlock/Wilmsry)
```

`meta.commit` = `8e43ad6` (Task 2's commit); `cells.length` = 143.

**Floors 1-12 (solo) — compact table:**

| Floor | p_L | S_L | target S_L | dS | combat/dot/starve | level | gold | maxWP | verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 92.5% | 92.5% | 98.8% | -6.3 | 7/8/0 | 1.05 | 128.74 | 45.72 | PASS |
| 2 | 88.5% | 81.8% | 95.1% | -13.3 | 10/5/6 | 1.36 | 273.99 | 48.80 | MISS |
| 3 | 90.0% | 73.6% | 88.6% | -15.0 | 9/3/4 | 2.14 | 531.46 | 54.50 | MISS |
| 4 | 75.9% | 55.9% | 79.7% | -23.8 | 25/6/3 | 2.70 | 821.44 | 57.52 | MISS |
| 5 | 75.8% | 42.3% | 69.2% | -26.9 | 11/6/7 | 3.30 | 1052.26 | 61.87 | MISS |
| 6 | 65.2% | 27.6% | 58.4% | -30.8 | 15/5/4 | 3.78 | 1462.55 | 67.58 | MISS |
| 7 | 67.4% | 18.6% | 48.0% | -29.4 | 9/2/3 | 4.35 | 1814.70 | 73.98 | MISS |
| 8 | 65.4% | 12.2% | 38.7% | -26.5 | 7/1/1 | 4.69 | 2375.54 | 77.00 | MISS |
| 9 | 66.7% | 8.1% | 30.8% | -22.7 | 3/0/2 | 5.00 | 2691.67 | 80.27 | MISS |
| 10 | 55.6% | 4.5% | 24.3% | -19.8 | 3/1/0 | 5.00 | 2767.00 | 84.89 | MISS |
| 11 | 50.0% | 2.3% | 19.1% | -16.8 | 1/0/1 | 5.00 | 3598.50 | 96.00 | MISS |
| 12 | 0.0% | 0.0% | 15.1% | -15.1 | 1/0/1 | 5.00 | 3979.00 | 87.00 | MISS |
| 13-20 | — | — | — | — | (no solo runs reached — party/slice tail only) | — | — | — | tail |

**Reading:** The fair bot's solo p50 stays 4 (unchanged from rung 4's own p50), but reach >=5 recovers to 49.4% (vs rung 4's 48.3%) and reach >=10 nearly doubles (4.7% vs rung 4's ~2%) — the higher flee/potion thresholds keep more runs alive through the mid-floors even though the underlying floor-band knots (frozen at rung 5's `1cb56c6` values) are untouched; the death-class share shifts too — dot deaths (traps/falls/the maze's own -HP dot) now read cleanly separated from starvation (16.0% starvation vs ~17.5% dot vs ~66.5% combat), a genuinely new instrument rather than a moved number, since the old hazard/starvation split filed "spent by the dungeon itself" under starvation. The pace table shows the hero racing far ahead of USER RULING C's intended curve: the bot is already level 2.70 by floor 4 (target ~2 by floor 4, roughly on pace) but hits the level cap (5) by floor 9 (target says level 5 only by ~18) — HERO_SP_SCALE (identity 1, the dial table's #3 search coordinate) is the lever 54-06/54-07 release to slow this down. The class-pool p50 spread is narrow at BEFORE (Fighter 5, Thief 4, Magic User 4 solo; Fighter 5, Thief 5.5, Magic User 4 party) — no class pool is starkly ahead or behind, consistent with the class-pool ruling that the fit's fairness constraint is a pool-level check, not a per-cell target.

#### Identity commit — commit 3226c20e6f48d0283eb837a3a9e4dcd2b31d0bfd (the global model landed at identity; USER RULING D)

54-05 lands the global-model dial table above (`#### Global model (USER
RULING D) — the dial table`) in the engine, at every dial's own identity
value, with the one-and-done climb/leap bug fix folded in. No dial is
fitted this plan — 54-06/54-07 wire the remaining dials and run the fit;
this commit is the byte-identity proof plus the measured, declared,
regenerated identity-commit movers.

**Removed (every floor-range constant/helper):**

| Name | Was | Replaced by |
|---|---|---|
| `COMBAT_SCALE_FROM_DEPTH` | 21 — the deep-ramp band boundary | no boundary — `FOE_HIT_SCALE`/`FOE_HP_SCALE`/`ABILITY_THREAT` are smooth `{ base, perDepth }` slopes at every depth |
| `FOE_CAP_BASE` / `FOE_CAP_MAX` / `FOE_CAP_SOFT_K` | 3 / 4 / 20 — the soft-capped foe-count ceiling | `FOE_COUNT_TABLE` (a fixed 5×4 table indexed by `FOE_COUNT_SKEW`) |
| `FOE_POWER_BASE` / `FOE_POWER_MAX` / `FOE_POWER_SOFT_K` | 1.0 / 1.15 / 35 — the deep-ramp wp/hit multiplier | `FOE_HIT_SCALE` / `FOE_HP_SCALE` `{ base, perDepth }` |
| `ABILITY_THREAT_BASE` / `_MAX` / `_SOFT_K` | 1.0 / 1.3 / 30 | `ABILITY_THREAT { base, perDepth }` |
| `FOE_LVL_BIAS` | 0 (reserved) | gone — `FOE_LEVEL` is the sole depth->tier map |
| `FOE_GRACE_AT_1..4` + `graceFor` | 1.0 / 0.32 / 0.44 / 0.31 — the floor 2-4 grace ramp | gone — `FOE_HIT_SCALE`/`FOE_HP_SCALE` are identity at every floor 1-4 (no grace needed once foe level itself keys to depth) |
| `HAZARD_FROM_DEPTH` | 2 — the first depth hazardScale could leave identity | gone — `HAZARD_SCALE` covers floor 1 too |
| `HAZARD_SCALE_AT_START` / `_AT_3` / `_AT_4` | 0.46 / 0.44 / 0.49 | `HAZARD_SCALE { base, perDepth }` |
| `WALL_FROM_DEPTH` / `_TO_DEPTH` / `_FOE_POWER_AT_START` / `_AT_END` / `_HAZARD_SCALE` / `_ABILITY_THREAT_AT_START` / `_AT_END` | the Wall band (5-8) knot pair set | gone — no band; the smooth slopes cover this range |
| `BREAKAWAY_*` (same shape, 9-15) | the Breakaway band knot pair set | gone |
| `ENDGAME_FROM_DEPTH` / `_TO_DEPTH` / `_FOE_POWER_AT_START` / `_AT_END` / `_HAZARD_SCALE` / `_ABILITY_THREAT_AT_START` / `ENDGAME_ABILITY_THREAT_AT_END` | the Endgame band knot pair set (16-20) | gone |
| `ENCOUNTER_DOT_BASE` / `_CAP` / `_SOFT_K` | 9 / 12 / 12 — the soft-capped dot count | `ENCOUNTER_DOTS { base, perDepth }` (uncapped, `9 + depth`) |
| `DENSITY_CANON_THROUGH_DEPTH` | 2 — the floor 1-2 canon-by-construction guard | gone — `ENCOUNTER_DOTS` is canon (`9+d`) at EVERY depth by formula, no guard needed |
| `DARK_HOLD_THROUGH_DEPTH` | 3 — the floor 2-3 dark-blob hold | gone — `DARK_BLOBS { base: -0.4, perDepth: 0.7 }` reproduces the same floors 1/2/4/5+ by formula (floor 3 moves 1->2, not fixture-exposed) |
| `DARK_RADIUS_BASE` | 3 (a bare literal) | folded into `DARK_RADIUS.base` |
| `softCap` / `softCapFloat` | the asymptotic soft-cap curve helpers | gone — every dial is a plain linear `{ base, perDepth }` slope, no asymptote |
| `bandLerp` | the endpoint-exact knot interpolator | gone — no knots to interpolate between |
| `knotFoePowerFor` / `knotHazardFor` / `knotAbilityThreatFor` | the per-floor knot-table lookups (USER RULING C ladder) | `difficultyCurve`'s own inline `scaleField` evaluation of each `{ base, perDepth }` dial |
| `foeDmgBonusFor` | the flat lvl²-only bonus term | `foeHitFor` (scales the WHOLE hit: `foeLevelBase + dice`, crit included) |
| combat.js `Math.min(c.level, state.floor.depth)` | the hero-level-keyed foe tier | `curve.foeLevel` (via `foeLevelFor(depth)`) |
| combat.js `c.level <= 2 ? 2 : 3` | the level-keyed foe-count cap | `foeCountFor` / `FOE_COUNT_TABLE` (cap 3 everywhere, identity) |
| combat.js `dmgBonus` key + `(f.dmgBonus \|\| 0)` (3 sites) | the flat per-foe damage bonus | `foeHitFor(raw, curve)` applied to the whole hit at each of the 3 sites |

**Landed (identity column):**

| Dial | Value | Identity? | Note |
|---|---|---|---|
| `FOE_LEVEL` | `{ base: 0.6, perDepth: 0.2 }` | no identity — the starting map | map(1..25) = `1111222223333344444555555`; replaces `min(c.level, depth)` |
| `TIER_SPREAD` | 1 | yes (canon d4-bleed face) | |
| `FOE_HIT_SCALE` | `{ base: 1, perDepth: 0 }` | yes | |
| `FOE_HP_SCALE` | `{ base: 1, perDepth: 0 }` | yes | |
| `FOE_COUNT_SKEW` | 0 | yes (canon draw shape, row 0) | |
| `ROUND_DAMAGE_CEILING` | 0 | yes (off) | `Infinity` cap at identity |
| `ABILITY_THREAT` | `{ base: 1, perDepth: 0 }` | yes | |
| `HERO_HP_SCALE` | 1 | yes | |
| `HERO_REGEN_PER_FLOOR` | 0 | yes (no regen) | |
| `HERO_SP_SCALE` | 1 | yes | |
| `CAMP_HEAL_FRACTION` | 0.17 | no identity — mean-matched | level-1 mean maxWP 41.67: `round(0.17*41.67)+d10-5` has mean 7.6 vs canon `d10+2` mean 7.5 |
| `DOT_HP_FRACTION` | `{ small: 0.24, mid: 0.36, large: 0.6 }` | no identity — mean-matched | 10/15/25 ÷ 41.67 |
| `FOOD_CLOCK` | 1 | yes | |
| `ENCOUNTER_DOTS` | `{ base: 9, perDepth: 1 }` | yes (= canon `9+depth`, uncapped) | |
| `HAZARD_SCALE` | `{ base: 1, perDepth: 0 }` | yes (floor 1 included) | |
| `DARK_BLOBS` | `{ base: -0.4, perDepth: 0.7 }` | yes for floors 1/2/4/5+ | floor 3 reads 2, was 1 under the retired hold (not fixture-exposed) |
| `DARK_BLOB_CAP` | 3 | yes | |
| `DARK_RADIUS` | `{ base: 3, perDepth: 1 }` | yes (= canon `3+depth`) | |
| `DARK_RADIUS_CAP` | 7 | yes (= today) | |
| `STORE_TIER` | `{ base: 0, perDepth: 0.3 }` | yes (reproduces today's BAG_FLOORS ladder) | map 1..12 = `011122223333` |
| `LOOT_SCALE` | 1 | yes | held (available); 54-06 wires the consumer |
| `FOE_ACCURACY` | 0 | yes | held (available) |
| `DOT_MIX` | `{ fight:1, harm:1, loot:1, help:1 }` | yes | held (available) |
| `WANDER_RATE` | 1 | yes | held (available) |
| `FLEE_NEED_MOD` / `PARLEY_NEED_MOD` | 0 / 0 | yes | held (available) |
| `STARTING_GOLD` / `STARTING_POTION_BONUS` | 50 / 0 | yes | held (available) |
| `CLASS_MITIGATION` | identity rows (seeded from `content/flee.js#FLEE_THIEF_BONUS`) | yes | held (available) |

**What moved at identity, and why:** exactly the five things the objective named — (1) `FOE_LEVEL` has no identity (it IS the depth axis now; foeLevelFor(1)=1 keeps every floor-1 fight, so no fixture moves from this cause alone); (2) the level-keyed foe-count cap is gone (cap 3 everywhere via `FOE_COUNT_TABLE` row 0) — measured moved set: `action-script.combat.json#lose-apprentice` (Bat/Rat, Shriek, Shriek — was Bat/Rat, Shriek) and `action-script.combat.json#flee` (Viper, Shriek, Shriek — was Viper, Shriek), a **level-cap** cause; (3) the table-four HP dots are now fractions of `c.maxWP` — measured moved set: `action-script.encounters.json#tablefour` (`+25 HP` row: `c.maxWP`/`c.wp` 65->64), a **dot-hp** cause; (4) the rested-night camp heal (`CAMP_HEAL_FRACTION`) — measured EXPOSURE zero (the one fixture site with a fed night, `action-script.movement.json#script`, happens to land on the same wp value either formula produces — see the predictor table in `FIXTURE-INVENTORY.md`'s Phase 54 section — a **camp-heal** cause with zero fixture-visible movers this commit); (5) the one-and-done climb/leap rule — measured EXPOSURE zero (no fixture-exposed site ever rolls a failed climb/leap), a **one-and-done** cause with zero fixture-visible movers this commit. A **foe-level** cause (a fight at depth >= 2) is impossible this commit — every fixture-exposed fight is floor 1, where `FOE_LEVEL`'s own map already reads identity.

**Curve table (d = 1..25, identity column, via `node -e`):**

| d | dots | darkBlobs | darkRadius | storeTier | foeLevel | foeHitScale | foeHpScale | hazardScale | abilityThreat |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 0 | 4 | 0 | 1 | 1 | 1 | 1 | 1 |
| 2 | 11 | 1 | 5 | 1 | 1 | 1 | 1 | 1 | 1 |
| 3 | 12 | 2 | 6 | 1 | 1 | 1 | 1 | 1 | 1 |
| 4 | 13 | 2 | 7 | 1 | 1 | 1 | 1 | 1 | 1 |
| 5 | 14 | 3 | 7 | 2 | 2 | 1 | 1 | 1 | 1 |
| 6 | 9 | 0 | 7 | 2 | 2 | 1 | 1 | 1 | 1 |
| 7 | 16 | 3 | 7 | 2 | 2 | 1 | 1 | 1 | 1 |
| 8 | 17 | 3 | 7 | 2 | 2 | 1 | 1 | 1 | 1 |
| 9 | 18 | 3 | 7 | 3 | 2 | 1 | 1 | 1 | 1 |
| 10 | 19 | 3 | 7 | 3 | 3 | 1 | 1 | 1 | 1 |
| 11 | 9 | 0 | 7 | 3 | 3 | 1 | 1 | 1 | 1 |
| 12 | 21 | 3 | 7 | 3 | 3 | 1 | 1 | 1 | 1 |
| 13 | 22 | 3 | 7 | 3 | 3 | 1 | 1 | 1 | 1 |
| 14 | 23 | 3 | 7 | 3 | 3 | 1 | 1 | 1 | 1 |
| 15 | 24 | 3 | 7 | 3 | 4 | 1 | 1 | 1 | 1 |
| 16 | 9 | 0 | 7 | 3 | 4 | 1 | 1 | 1 | 1 |
| 17 | 26 | 3 | 7 | 3 | 4 | 1 | 1 | 1 | 1 |
| 18 | 27 | 3 | 7 | 3 | 4 | 1 | 1 | 1 | 1 |
| 19 | 28 | 3 | 7 | 3 | 4 | 1 | 1 | 1 | 1 |
| 20 | 29 | 3 | 7 | 3 | 5 | 1 | 1 | 1 | 1 |
| 21 | 9 | 0 | 7 | 3 | 5 | 1 | 1 | 1 | 1 |
| 22 | 31 | 3 | 7 | 3 | 5 | 1 | 1 | 1 | 1 |
| 23 | 32 | 3 | 7 | 3 | 5 | 1 | 1 | 1 | 1 |
| 24 | 33 | 3 | 7 | 3 | 5 | 1 | 1 | 1 | 1 |
| 25 | 34 | 3 | 7 | 3 | 5 | 1 | 1 | 1 | 1 |

**Re-pin ledger:**

| File | Test | Old | New | Source |
|---|---|---|---|---|
| `test/difficulty/difficulty.test.js` | entire file rewritten (24 tests) | the five-rung knot-ladder pins | the identity-column DIALS/curve/helper pins above | `node -e` against `engine/difficulty.js` |
| `test/unit/combat-scaling.test.js` | entire file rewritten (17 tests) | Phase 21/27/54-ladder combat-dial pins | identity wiring (foeLevelFor, FOE_COUNT_TABLE, foeHitFor, roundDamageCapFor) | direct `startCombat`/`foeTurn` replays with `fakeRng` |
| `test/unit/movement.test.js` | 6 climb/gorge + newDay/descend tests rewritten, 3 new tests added | "leaves the feature in place" / flat `d10+2*level` heal | one-and-done crossing + `campHealFor`/`heroRegenFor`/`heroSpFor` | direct `move`/`newDay` replays |
| `test/unit/encounters.test.js` | `tableFour`/`springTrap` hazard tests rewritten, 2 new tests added | flat ±10/-15/+25 HP, flat hazard knot | `dotHpFor`/identity `hazardScale` | direct `tableFour`/`springTrap` replays |
| `test/unit/foe-turn-draw-count.test.js` | `FULL_FIGHTS` seeds 17/127, `OPENER_DRAWS` seeds 17/127 | 2-foe rosters (88/45 draws, 14/8 opener) | 3-foe rosters (88/83 draws, 13/10 opener) | `runFullFight`/opener replays via `countingRng` |
| `test/determinism/foe-abilities.test.js` | `ENCOUNTERS`/`FULL_FIGHT_PINS`/`PER_VISIT_PINS` (all 5 encounters) | tier-forced via `c.level=floor.depth=tier` at the old knot values | depth re-anchored via `firstDepthOfTier(tier)`; every pin re-measured at full canon strength (no grace) | `firstCasterSeed`/`runFullFight`/`runVisits` replays |
| `test/parity/divergence-records.test.js` | the BAND-02 guard | `EXPECTED = []` + `WALL_FROM_DEPTH`/floor-2 exposure checks | `EXPECTED` = the 3-holder measured moved set + floor-1 identity pin + the count-roll canon-draw-shape proof (every `FOE_COUNT_SKEW` row) | the guard's own replay + `foeCountFor` unit checks |
| `test/parity/fixture-inventory.test.js` | `lose-apprentice`/`flee` pinned rosters | 2-foe rosters | 3-foe rosters (a third Shriek each) | `enumerateFixtureRoster` live replay |
| `test/parity/FIXTURE-INVENTORY.md` | the generated fixture-roster table | 2-foe rosters for `lose-apprentice`/`flee` | 3-foe rosters | `node tools/fixture-inventory.mjs` |
| `test/unit/maze.test.js` | depths 3-5's dot counts | `11/11/11` (soft-capped) | `12/13/14` (uncapped `9+depth`) | direct `genFloor` replay |
| `test/unit/floor-gen-rng-pin.test.js` | `FLOOR_GEN_PIN`'s `:3` entries (14 seeds) | the soft-capped draw counts/cursors | the uncapped draw counts/cursors (depth 3 places one more dot; depths 4/5/10/20 are grid-capacity-bounded at the same count either way) | `countingRng(genFloor(...))` replay |
| `test/unit/foe-abilities.test.js` | `startCombat copies the kit only for caster rows` | `s.c.level=2; s.floor.depth=2` | `s.floor.depth=5` (the first depth whose `foeLevelFor` reads tier 2) | direct `startCombat` replay |
| `test/unit/foe-cadence.test.js` | the Bat/Rat CAD-03 test | `state.floor.depth=5` | `state.floor.depth=1` (tier 1's own floor under the identity map) | direct `startCombat`/`fight` replay |
| `test/unit/phobia-triggers.test.js` | two heights-retry tests | "same tile retry is silent" / "step away and back fires again" via `move()` | `noteHeightsAttempt` direct-call debounce test + a two-DIFFERENT-tiles `move()` test (a same-tile retry is now unreachable via `move()` under one-and-done) | direct `noteHeightsAttempt`/`move` calls |
| `test/unit/tools.test.js` | the declined-fellClimbing pendingHazard test | "pendingHazard survives, a third move rolls again" | "pendingHazard clears, the hero crosses, draggedOver fires" (one and done) | direct `move` replay |
| `test/unit/tuning-bot.test.js` | the TERR-02 water-routing seed set | seeds 1/2/3 | seeds 1/4/5 (seeds 2/3 now genuinely never resolve at full canon strength pre-fit; re-measured live up to 20,000 actions) | `playRun` replay |
| `test/unit/bot-tactics.test.js` | the nine-forced-cell no-stall test | Thief/MU/Fighter × seeds 1-3 uniformly | per-force seed trios avoiding two now-unresolvable (seed, force) pairs | `playRun` replay up to 5,000/30,000 actions |

**Draw shape:** the count roll keeps the EXACT canon draw shape at every `FOE_COUNT_SKEW` row — `foeCountFor(rng.d(4), () => rng.d(4))` draws one d4 when the first roll is <= 2, exactly one MORE (two total) when it is > 2, pinned by `divergence-records.test.js`'s guard looping 0..4. The one-and-done climb/leap block's draws per attempt are UNCHANGED — the retry LOOP is gone, not any individual roll (same rolls, same order, same count). `newDay`'s d10 stays the SAME single draw in the SAME position (`campHealFor(maxWP, rng.d(10))`); `difficultyCurve` stays draw-free (arity 1, zero rng).

**Gates:** `npm test` 3427/3427 (fail 0) at this commit; `npm run build:www` exit 0; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `git diff --stat 78a4a15 -- content/ tools/lib/tuning-bot.mjs test/parity/harness/comparables.js test/parity/prototype-master.js.txt` empty.

#### Hero-side / late dials + the fit tool — commit `720e697` (Task 1: economy/class/accuracy/exposed dials), `59a81e1` (Task 2: DOT_MIX/FIGHT_SHARE + WANDER_RATE), and this Task 3 commit (the fit tool)

54-06 completes the global model so the fit tool can see ALL of it. **Task 1** wired the economy/class/accuracy/exposed dials the identity commit had landed but left un-hooked: `lootFor` (the kill purse, the chest, the wilmst cache, and the faerie's `d10x100` — never the Pickpocket extra, the cutpurse ability, the grimoire flat 150, or the dev-start purse); `storeTier(depth)` now reads `difficultyCurve(depth).storeTier` (retiring `STORE_TIER_FLOORS`/`BAG_FLOORS`, reproducing the identical `011122223333` ladder by formula); `CLASS_MITIGATION`'s seven hooks (Thief `evasion`/`trapAvoid`/backstab-opener `killSpeed`; Fighter `hpMul` (54-05)/`armorMul`/every-melee `killSpeed`; MU `spellPower` through the ONE `spellDamageFor(n, c)` helper, wired at four sites: the stun spell's affected-count roll, and the quake/volley/thrown bolt damage — never healing, never self-inflicted backfire damage); `FOE_ACCURACY` (both `vs="hero"` and `"member"`); `FLEE_NEED_MOD`/`PARLEY_NEED_MOD`; `STARTING_GOLD`/`STARTING_POTION_BONUS`; `TIER_SPREAD` (confirmed already wired, 54-05). **Task 2** wired the late dials with the SAME draw counts: `DOT_MIX`/`FIGHT_SHARE` — `DOT_MIX_FAMILIES` partitions every one of `ENCOUNTER_TABLES`' 80 cells into exactly one of `fight` (43 cells)/`harm`/`loot`/`help`; `conversionTableFor(mix)` remaps AFTER the SAME two draws (the d8 table roll + the d10 cell roll) — a family below 1.0 shrinks toward its row-neighbours (row-major order, converted to the next non-family cell to the right, wrapping), a family above 1.0 grows by borrowing the dominant other family's cells per row, each becoming the nearest same-family cell to its right (wrapping); `WANDER_RATE` — the SAME eight per-hour d20 draws, a wider or narrower face count wakes the party, a Bard's canon `+1` stays additive on top (capped at 20). `MAZE_SIZE` is CUT from this phase entirely (user, 2026-09-21) — no dial, no grid change; `GW`/`GH` stay 21 (pinned absent from `DIALS` and `difficultyCurve`).

**Parity — measured (Tasks 1 and 2):** `tools/initiative-fixture-scan.mjs` byte-identical to the committed `tools/initiative-fixture-scan-output.txt` after EACH task's commit (SCAN-CLEAN both times — every hook is a structural identity fast path); `node --test test/parity/*.test.js` green (43/43) both times; zero new records in `test/parity/fixtures/`; `git diff --stat` on `engine/maze.js`/`mazeworld.html`/`src/browser/`/`tools/lib/tuning-bot.mjs` empty after Task 2. No divergence record needed — nothing moved.

**Task 3 — the fit tool.** `tools/lib/fit-score.mjs` (pure, no engine import — see its own module header for why): `scoreSurvival(survival)` reads `tools/lib/band-readout.mjs#survivalReadout`'s own return shape and scores floors 1-12 ONLY against the Ruling C `S_L` curve (`Σ_{1..10} ((S_L-T_L)/8)² + Σ_{11..12} ((S_L-T_L)/3)²`; floors 13-20 and reach-20 are reported as the measured TAIL, dS only, never scored or verdicted — the plan-approval cut); `classConstraints(classIdentity)` — the four fairness/identity rules (`|p50-pooled|<=1.0`, `|reach5-pooled|<=12`, Fighter `dmgTakenPerFight>=` Thief's, Thief `roundsPerFight<=` Fighter's), a pool under 20 runs is unconstrained; `SEARCH_PLAN` = the CORE 10 coordinates in the user's order (`FOE_LEVEL.perDepth/base`, `HERO_SP_SCALE`, `FOE_HIT_SCALE.base/perDepth`, `FOE_HP_SCALE.base`, `HERO_HP_SCALE`, `HERO_REGEN_PER_FLOOR`, `HAZARD_SCALE.base`, `ENCOUNTER_DOTS.base`); `HELD_DIALS` names every other dial, its held `--start` value, and its release note; `applyStep` moves ONE coordinate, clamped, rounded to 4dp, `null` at a bound. `tools/fit-difficulty.mjs`: `--dials=<json|path>` (one evaluation) or `--search` (bounded coordinate descent — PASS 1 full step, PASS 2 half step, over the SAME 10 coordinates, in order; each coordinate probes `+1` first, accepting and continuing up to 3 total steps while the score improves, else probing `-1` the same way); every evaluation plays the fair bot's SOLO run (the SAME `i*7919+1` seed list `tools/tune-difficulty.mjs` uses) in-process across `worker_threads` — each worker calls `setDialsForTuning(candidate)` once (fresh module instance per worker, so no candidate's override ever leaks into another worker or another evaluation), plays its own seed slice through `playRun`, and posts plain-object rows back; the main thread concatenates in SLICE order (never completion order) for scheduling-independent determinism, then runs `survivalReadout`/`classIdentityReadout`/`paceReadout` and scores. A constraint-rejected candidate is logged at `score: +Infinity`, `verdict: "MISS"`, with a `reason` (the plan's own REJECTED rule). The JSONL log (`--log`) is append-only and RESUMABLE: a `--search` run reading an existing log replays the SAME deterministic candidate sequence, reusing each already-logged row verbatim (by its position `n` — the walk is a pure function of prior evaluate() outputs, so the nth candidate is provably identical on replay) until it reaches un-probed territory, logging a `{ resumed: true, fromN }` marker first; verified live (a 3-then-5-budget two-run smoke replays n=1-3 with zero new bot time and continues live at n=4-5). The class smoke (`tune-classes`) is NEVER run by the fit (`grep -c tune-classes tools/fit-difficulty.mjs` = 0) — the constraints read the solo run's own per-class pools.

**Dry-run proof (not committed — the log path was a scratch tmp file):** `node tools/fit-difficulty.mjs --dials='{}' --seeds=8 --workers=2 --max-actions=1500` printed `#1 score=161.8442 verdict=MISS pass=1 S5=42.9 S8=0.0 S10=0.0 S12=0.0 tail S15=0.0 S20=0.0 reach20=0.0 classes F/T/M p50=3/5.5/5 ok=true`. The identity-equivalence proof: `node tools/tune-difficulty.mjs --seeds=20 --max-actions=3000 --json` and `node tools/fit-difficulty.mjs --dials='{}' --seeds=20 --workers=4 --max-actions=3000` were run against the SAME 20-seed list; every one of `tune-difficulty`'s `survival.floors[].pL` values (10 reached floors) matched `fit-difficulty`'s own per-floor `pL` exactly (`ALL MATCH`, verified programmatically, not by eye).

**`fit/start.json`** (`.planning/phases/54-four-band-retune-and-roster-decision/fit/start.json`): the planner's `Starting value` column from the dial table above, as a complete partial-`DIALS` JSON (the core 10's starting values AND every held dial's held value) — no `MAZE_SIZE` key. `node -e` against the committed file prints `0.6 0.2 0.28 0.8 0.6 1.25 0.25 0.5 1 0.5 7 1.5` for `FOE_LEVEL.base/perDepth, HERO_SP_SCALE, LOOT_SCALE, FOE_HIT_SCALE.base, HERO_HP_SCALE, HERO_REGEN_PER_FLOOR, ROUND_DAMAGE_CEILING, FOE_COUNT_SKEW, HAZARD_SCALE.base, ENCOUNTER_DOTS.base, FOOD_CLOCK`, matching the dial table exactly.

**Gates:** `npm test` green at every commit (3427 -> 3439 -> 3445 -> 3458, +31 new tests across the three commits); `npm run build:www` exit 0 at every commit; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `git diff --stat 7b03404 -- content/ test/parity/harness/comparables.js test/parity/prototype-master.js.txt` empty.

#### USER RULINGS E/F/G — checkpointed fit, cycle 3 (2026-09-21, mid-54-07)

54-07's own dispatch ran the fit in THREE cycles, each a standing-authority
checkpoint (USER RULING F): stop on a failure pattern, adjust ONE thing,
resume — never burn the full budget blind.

**Cycle 1** (plan-10's own committed evidence, `fit/fit-log-plan10.jsonl`,
`fit/search-stdout-plan10.txt`, budget 80 from `fit/start.json`): 27
evaluations, only 3 distinct feasible points (#1 identity 237, #5 135, #18
64 — all MISS, floors 5-12 ~15-20 pts too easy), 22 of 25 rejections the
class-fairness guardrail on the Magic User. **USER RULING E**: budget 40 (not
80/100), seeds stay 200 — a single 200-seed evaluation measured 6-10 min on
this 4-core i5-2400 (3x the plan's own estimate), so budget 80 would run
~12h.

**Cycle 2** (`fit/fit-log-block1.jsonl`, `fit/best-block1.json`,
`fit/search-stdout-block1.txt`, `fit/start-block1.json`): USER RULING F
"Adjustment 1" promoted `CLASS_MITIGATION["Magic User"].spellPower` into
`SEARCH_PLAN` as an 11th coordinate (probed first) — the one dial that could
prop the MU pool back up, previously outside the CORE 10. Block 1 (10 rows)
reached **#6, score 10.83** (`FOE_LEVEL {0.9, 0.26}`, `HERO_HP_SCALE 1.25`,
`HERO_REGEN 0.25`, `HERO_SP_SCALE 0.28`, `LOOT_SCALE 0.8`; floors 8-12 in
band, floor 5 +8, floor 6 +16, floor 7 +13) then produced a clear failure
pattern over the next 9 evaluations — zero improvement, 7 of 9 vetoed by the
SAME class guardrails, floor-6/7 misses unmoved. **Two root causes**
identified: (1) a Table-4 HP-dot compounding bug (54-05's
`DOT_HP_FRACTION` — a fraction of the hero's own CURRENT `maxWP` — fed the
"+25 HP" row's own output back into its next input, ~×4 across three pulls,
surfaced on a Pixel 7 device run as a 140-hp "-15 HP" toll); (2) the
class-fairness tolerances themselves (1.0-floor `p50` delta, 12-point
`reach5` delta) were too tight for a 200-seed/class sample — a 1-floor
median swing is common noise, not a real fairness violation. Adjustment 1's
`spellPower` coordinate proved a structural no-op across every probed
value (the per-floor survival metric never registers a change from it
alone).

**USER RULING G "Adjustment 2"** (engine, ruled by the user): retires
`DOT_HP_FRACTION` — `dotHpFor(kind)` now reads `DOT_HP_BASE`'s flat canon
table (10/15/25), scaled ONCE by `HERO_HP_SCALE`, never by the hero's own
maxWP. `content/bestiary.js` untouched. Commit `88b081e`.

**USER RULING G "Adjustment 3"** (search, standing authority): (a)
`classConstraints` tolerances loosened — `p50` 1.0 -> 2.0 floors, `reach5`
12 -> 20 points (`CLASS_P50_TOLERANCE`/`CLASS_REACH5_TOLERANCE`); (b)
`SEARCH_PLAN` drops the `spellPower` coordinate again (proved a no-op),
returning it to `HELD_DIALS` at identity; (c) the fit-tool replay-resume
bug fixed — a rejected candidate's `score: Infinity` silently serializes as
`"score":null` (JSON has no Infinity literal); the OLD `readLog` handed
that `null` straight into `row.score < baseScore`, where `null` coerces to
`0`, so a resumed walk reusing an infeasible logged row would look like the
BEST score of the entire search, silently diverging from the original
walk. `tools/lib/fit-resume.mjs` (new, pure, engine-free) fixes this via
`rehydrateRow`, proven by a dedicated regression test (a synthetic search
resumed from a log containing an infeasible row reproduces the original
walk byte-for-byte); (d) per-block stdout append (`>>`), never truncate.
Commit `6b48281`.

**Cycle 3** (`fit/fit-log.jsonl` = `fit/fit-log-block3.jsonl`, `fit/fit-log.md`,
`fit/best.json`, `fit/search-stdout-block3.txt`, restart from
`fit/start-block3.json` = the cycle-2 best #6's dials): block 1 (budget 10)
converged strongly — ZERO constraint rejections across all 10 evaluations
(vs cycle 1's 22/25, cycle 2's 7/9), the block's own #1 (the cycle-2 best
re-evaluated on the corrected engine, score 9.8073 — the engine fix alone
moved the SAME dials from 10.83 to 9.8073) improved to #2's 7.1327 (27%),
and 10 of 12 floors landed in band. Per USER RULING F this continues in the
SAME log — block 2 (budget 20, resumed) found a full **PASS at evaluation
#13, score 2.7113**, every floor 1-12 inside its Ruling C tolerance band,
zero class-pool rejections across the whole 13-row walk. The tool exits at
the first PASS+ok candidate (10 of 20 unused in block 2). Full evaluation
table: `fit/fit-log.md`.

#### Fit — commit `7db833e` (bounded coordinate search over SEARCH_PLAN; cycle 3, budget 20/block, resumed; 4 workers; 200 seeds)

**Parameters:** `node tools/fit-difficulty.mjs --search --start=fit/start-block3.json --budget=10 --seeds=200 --workers=4 --log=fit/fit-log-block3.jsonl --out=fit/best-block3.json`, then the same command with `--budget=20` (resumed, one continuous walk per the Adjustment-3(c) fix). Stop reason: `pass` (evaluation #13).

**What the fit moved** (vs `fit/start-block3.json`, three of the core-10 coordinates — the other seven land unmoved at their cycle-2-carried start value):
- `FOE_LEVEL.perDepth` 0.26 -> 0.29 (harder: foe level climbs faster with depth)
- `FOE_HIT_SCALE.perDepth` 0.02 -> 0.01 (easier: the whole-hit scale grows more slowly with depth)
- `FOE_HP_SCALE.base` 0.8 -> 0.9 (harder: foes start with more relative HP, slightly longer fights)

**Notch record:** none — every evaluated candidate in cycle 3 satisfied `constraints.ok` without any `CLASS_MITIGATION` adjustment; the best pooled candidate (#13) is ALSO the best constrained candidate.

**Full evaluation table** (13 rows, `fit/fit-log.md` verbatim):

| # | score | verdict | S1 | S4 | S5 | S8 | S10 | S12 | tail S15 | tail S20 | reach20 | F/T/M p50 | F/T/M reach5 | ok/reason | vs start |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 9.8073 | MISS | 99.5 | 85.3 | 76.9 | 45.7 | 23.4 | 16.2 | 3.8 | 1.2 | 0.5 | 8/9/7 | 87.1/86.4/74.0 | ok | (= start) |
| 2 | 7.1327 | MISS | 99.5 | 85.3 | 76.9 | 42.7 | 21.5 | 12.1 | 3.2 | 0.8 | 1.0 | 8/8/7 | 87.3/86.9/74.5 | ok | FOE_LEVEL perDepth 0.29 |
| 3 | 13.8735 | MISS | 99.5 | 80.8 | 76.1 | 37.3 | 17.5 | 7.2 | 2.9 | 1.0 | 0.5 | 7/8/6 | 81.0/84.5/67.9 | ok | FOE_LEVEL perDepth 0.30 |
| 4 | 11.7791 | MISS | 99.5 | 80.8 | 76.1 | 37.3 | 17.5 | 8.5 | 4.3 | 1.7 | 1.5 | 7/8/6 | 81.0/84.7/67.9 | ok | FOE_LEVEL base 1.0 |
| 5 | 9.8073 | MISS | 99.5 | 85.3 | 76.9 | 45.7 | 23.4 | 16.2 | 4.6 | 2.3 | 2.0 | 8/9/7 | 87.1/86.7/74.0 | ok | FOE_LEVEL base 0.75 |
| 6 | 8.5242 | MISS | 99.5 | 85.8 | 80.6 | 42.8 | 22.6 | 13.3 | 2.9 | 1.9 | 0.5 | 8/8/6.5 | 87.3/86.0/75.0 | ok | + HERO_SP_SCALE 0.33 |
| 7 | 16.3402 | MISS | 99.5 | 84.8 | 75.9 | 36.1 | 13.3 | 8.9 | 1.4 | 0.0 | 0.0 | 7/7/6 | 87.9/87.1/70.8 | ok | + HERO_SP_SCALE 0.23 |
| 8 | 22.9586 | MISS | 99.0 | 82.8 | 72.4 | 33.6 | 16.3 | 6.6 | 1.4 | 0.0 | 0.0 | 7/8/6 | 84.6/88.5/69.6 | ok | + FOE_HIT_SCALE base 0.68 |
| 9 | 7.9637 | MISS | 99.5 | 87.9 | 81.7 | 46.7 | 22.3 | 15.9 | 3.7 | 1.8 | 2.0 | 8/9/6 | 90.3/91.7/75.5 | ok | + FOE_HIT_SCALE base 0.52 |
| 10 | 17.3641 | MISS | 99.5 | 80.7 | 72.4 | 38.0 | 14.7 | 8.0 | 2.9 | 0.0 | 1.0 | 8/8/6 | 83.1/85.0/67.9 | ok | + FOE_HIT_SCALE perDepth 0.03 |
| 11 | 5.0468 | MISS | 99.5 | 84.9 | 79.6 | 44.7 | 23.2 | 17.0 | 6.0 | 1.3 | 1.0 | 7/9/7 | 82.3/92.1/73.6 | ok | + FOE_HIT_SCALE perDepth 0.01 |
| 12 | 11.9797 | MISS | 99.5 | 87.9 | 83.3 | 46.4 | 26.2 | 15.2 | 5.7 | 0.0 | 0.5 | 8/9/6 | 89.1/91.7/76.5 | ok | + FOE_HIT_SCALE perDepth 0 |
| 13 | **2.7113** | **PASS** | 99.5 | 82.9 | 75.0 | 41.3 | 21.2 | 14.3 | 7.3 | 3.5 | 1.5 | 7/8/7 | 82.3/88.7/68.0 | ok | + FOE_HP_SCALE base 0.9 |

`BEST #13 score=2.7113`; `elapsed: 995.6s workers=4 evaluations=13 stopped=pass`.

#### AFTER (global model) — commit `7db833e` (readouts committed at `3e25980`)

**Solo (200 seeds):** `Death-depth distribution: min=1 p50=7 p90=12 max=30`. `Reach table: >=5: 80.5% >=10: 23.6% >=20: 1.1% >=30: 0.6% >=50: 0.0%`. `Death-cause breakdown` top entries: starved in the dark 21 (10.5%), cut down by a Werebeast 15 (7.5%), undone by a trap 12 (6.0%), cut down by a Dante 9 (4.5%), spent by the dungeon itself 9 (4.5%). `Class identity`: Fighter n=69 p50=7 reach5=82.3% dmgTaken/fight=11.15; Thief n=72 p50=8 reach5=88.7% dmgTaken/fight=7.78; Magic User n=59 p50=7 reach5=68.0% dmgTaken/fight=7.71. `Stuck: 26 of 200`. `Bot: exploreBudget=50 maxActions=20000 party=off flee=0.4/0.6(caster) potion<0.6 camp<0.5 seeds=200 startDepth=1`. **Verdict: all floors 1-12 inside the pass band.**

**--party (200 seeds):** `Death-depth distribution: min=2 p50=7 p90=12 max=25`. `Class identity`: Fighter reach5=84.8%, Thief reach5=86.7% reach20=3.3%, Magic User reach5=81.4% reach20=2.3%. `Stuck: 51 of 200`.

**--start-depth=20 slice (50 seeds):** `Death-depth distribution: min=20 p50=21 p90=24 max=37`. `Per-floor survival` at L=20: `reached=50 deaths=13 p_L=74.0% target p_L=84.5%`.

**Class smoke** (`docs/class-pass/v17-p54-global-after-smoke.json`, `meta.commit 7db833e`, 143 cells x 5 seeds = 715 runs): `POOLED n=715 stuck=88 mean=7.92 p50=7.0 p90=13.0 >=5%=82.3 >=10%=23.1 >=20%=2.2`.

**Per-floor table** (floors 1-12 from the 200-seed solo, PASS/MISS; floors 13-20 from the 1000-seed tail, `tail`, dS only):

| Floor | p_L | S_L | target S_L | dS | combat/dot/starve | level | gold | maxWP | verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 99.5% | 99.5% | 98.8% | +0.7 | 1/0/0 | 1.05 | 113 | 56.6 | PASS |
| 2 | 99.0% | 98.5% | 95.1% | +3.4 | 0/1/1 | 1.11 | 240 | 58.3 | PASS |
| 3 | 91.9% | 90.5% | 88.6% | +1.9 | 15/0/1 | 1.13 | 413 | 60.1 | PASS |
| 4 | 91.6% | 82.9% | 79.7% | +3.2 | 10/5/0 | 1.22 | 623 | 62.1 | PASS |
| 5 | 90.5% | 75.0% | 69.2% | +5.8 | 7/6/2 | 1.64 | 875 | 67.1 | PASS |
| 6 | 85.1% | 63.8% | 58.4% | +5.4 | 15/1/5 | 2.18 | 1255 | 72.8 | PASS |
| 7 | 76.3% | 48.7% | 48.0% | +0.7 | 21/4/3 | 2.36 | 1694 | 74.8 | PASS |
| 8 | 84.9% | 41.3% | 38.7% | +2.6 | 6/4/3 | 2.67 | 2166 | 80.8 | PASS |
| 9 | 69.9% | 28.9% | 30.8% | -1.9 | 17/1/4 | 3.01 | 2605 | 85.9 | PASS |
| 10 | 73.5% | 21.2% | 24.3% | -3.1 | 9/3/1 | 3.35 | 3078 | 90.9 | PASS |
| 11 | 76.5% | 16.2% | 19.1% | -2.9 | 7/0/1 | 3.74 | 3848 | 99.6 | PASS |
| 12 | 88.0% | 14.3% | 15.1% | -0.8 | 3/0/0 | 3.92 | 4889 | 105.1 | PASS |
| 13 | 78.9% | 10.0%* | 11.9% | -1.9 | tail (1000-seed) | 4.09 | 6096 | 112.0 | tail |
| 14 | 80.9% | 8.1%* | 9.5% | -1.4 | tail | 4.13 | 6231 | 117.8 | tail |
| 15 | 85.2% | 6.9%* | 7.6% | -0.7 | tail | 4.58 | 7568 | 122.8 | tail |
| 16 | 82.6% | 5.7%* | 6.2% | -0.5 | tail | — | — | — | tail |
| 17 | 78.9% | 4.5%* | 5.0% | -0.5 | tail | — | — | — | tail |
| 18 | 72.4% | 3.3%* | 4.2% | -0.9 | tail | — | — | — | tail |
| 19 | 84.2% | 2.7%* | 3.5% | -0.8 | tail | — | — | — | tail |
| 20 | 93.3% | 2.6%* | 3.0% | -0.4 | tail | — | — | — | tail |

`* S_L for floors 13-20 is read from the 1000-seed tail run's own S_L (product from depth 1, not re-based on the 200-seed run's S_12) — see the Tail section below for the exhaustive per-floor breakdown, including combat/dot/starvation-exhaustion splits.`

**Class-pool table** (200-seed solo):

| Class | n | p50 | reach5 | reach10 | dmg taken/fight | rounds/fight | foe miss % | casts def/off | potions | ok |
|---|---|---|---|---|---|---|---|---|---|---|
| Fighter | 69 | 7 | 82.3% | 17.7% | 11.15 | 4.43 | 66.4% | 0/0 | 1.06 | yes |
| Thief | 72 | 8 | 88.7% | 30.6% | 7.78 | 3.22 | 69.8% | 0/0 | 2.07 | yes |
| Magic User | 59 | 7 | 68.0% | 22.0% | 7.71 | 3.03 | 66.9% | 249/1338 | 3.61 | yes |

**Recorded spread** (class smoke, 143 cells): Thief p50Depth min 4.0 (Pilfer/Elven) max 14.0 (Ninja/Human), reach5 min 33.3% (Pilfer/Elven) max 100.0% (Pickpocket/Human); Magic User p50Depth min 3.0 (Summoner/Elven) max 17.0 (Court Mage/Fridgian), reach5 min 0.0% (Summoner/Elven) max 100.0% (Wizard/Wilmsry); Fighter p50Depth min 4.0 (Barbarian/Elven) max 11.0 (Master of Arms/Elven), reach5 min 40.0% (Barbarian/Elven) max 100.0% (Guard/Dwarven). Intended; no fix column (the loosened class-fairness constraints, USER RULING G, accept this spread as "the hand you're dealt").

**Reading:** the fit PASSes every floor 1-12 at the 200-seed solo (and the 1000-seed tail independently confirms the SAME 12 floors stay inside band at 10x the sample) — a clean win against the Ruling C target, a first for this phase after three failed cycles. BEFORE (Phase 53 AFTER, `78572c5`) read p50/p90 4/6, reach>=5 33.0%, reach>=10/20 0.0%; AFTER reads p50/p90 7/12, reach>=5 80.5%, reach>=10 23.6%, reach>=20 1.1% — every headline number moved toward the Ruling C target, most dramatically reach>=5 (33% -> 80.5%) and reach>=10 (0% -> 23.6%). The pace table shows the hero crossing level 2 around floor 6 and level 3 around floor 9 — Wall-band leveling lines up with the Wall's own difficulty step (`FOE_LEVEL` crosses tier 3 at depth 6 too).

#### Tail — measured, not fitted (1,000-seed solo; --start-depth=10 slice) — user cut 2026-09-21

**1,000-seed solo** (`readouts/global-after-solo-1000.txt`): `Death-depth distribution: min=1 p50=7 p90=12 max=45`. `Per-floor survival` (verbatim, floors 13-20 + reach-20):

| Floor | reached (of 1000) | p_L | S_L | target S_L | dS | note |
|---|---|---|---|---|---|---|
| 13 | 90 | 78.9% | 10.0% | 11.9% | -1.9 | tail |
| 14 | 68 | 80.9% | 8.1% | 9.5% | -1.4 | tail |
| 15 | 54 | 85.2% | 6.9% | 7.6% | -0.7 | tail |
| 16 | 46 | 82.6% | 5.7% | 6.2% | -0.5 | tail |
| 17 | 38 | 78.9% | 4.5% | 5.0% | -0.5 | tail |
| 18 | 29 | 72.4% | 3.3% | 4.2% | -0.9 | tail |
| 19 | 19 | 84.2% | 2.7% | 3.5% | -0.8 | tail |
| 20 | 15 | 93.3% | 2.6% | 3.0% | -0.4 | tail |

`reach-20: 1.5% — reported, not pass/fail (band 3.0-5.0%)`. Floors 1-12 at 1000 seeds independently confirm PASS (all 12 within their `dS` tolerance — see the AFTER per-floor table above, which already folds this run's own floors 1-12 in as a cross-check; the two runs' floors 1-12 verdicts agree floor-for-floor).

**--start-depth=10 slice (200 seeds)** (`readouts/global-after-start-depth-10.txt`): `Death-depth distribution: min=10 p50=12 p90=17 max=24` — informational, p_L 10-20 read against the curve, not scored.

Floors 13-20 and reach-20 are not in the fit's objective or the verdict; they are recorded here as measured.

#### Change table (BAND-03)

**Removed (USER RULING D, landed 54-05):** `WALL_*`, `BREAKAWAY_*`, `ENDGAME_*` knots, `knotFoePowerFor`/`knotHazardFor`/`knotAbilityThreatFor`, `FOE_GRACE_AT_1..4`, `graceFor`, `HAZARD_SCALE_AT_*`, `HAZARD_FROM_DEPTH`, `WALL_HAZARD_SCALE`, `COMBAT_SCALE_FROM_DEPTH` + the 21+ soft-cap ramp (`FOE_POWER_MAX/SOFT_K`, `ABILITY_THREAT_MAX/SOFT_K`, `FOE_CAP_MAX/SOFT_K`), `DENSITY_CANON_THROUGH_DEPTH`, `DARK_HOLD_THROUGH_DEPTH`, `foeDmgBonusFor` (all → removed). `DOT_HP_FRACTION` (landed 54-05) → removed at 54-07 (USER RULING G) — replaced by the flat, non-dial `DOT_HP_BASE` content table.

| Constant / dial | File | Before (5550002) | Identity commit | Fitted / held (7db833e) | Searched? | Direction | Record |
|---|---|---|---|---|---|---|---|
| `COMBAT_SCALE_FROM_DEPTH` | difficulty.js | 21 | removed | removed | n/a | n/a | identity commit `3226c20` |
| `FOE_GRACE_AT_2` | difficulty.js | 0.5 | removed | removed | n/a | n/a | identity commit `3226c20` |
| `WALL_FOE_POWER_AT_START` | difficulty.js | 0.85 (rung1) | removed | removed | n/a | n/a | rung history (retired ladder) |
| `ENDGAME_FOE_POWER_AT_END` | difficulty.js | 1.0 | removed | removed | n/a | n/a | rung history (retired ladder) |
| `ENCOUNTER_DOT_CAP` | difficulty.js | 13 | removed | removed | n/a | n/a | identity commit `3226c20` |
| `DARK_HOLD_THROUGH_DEPTH` | difficulty.js | 3 | removed | removed | n/a | n/a | identity commit `3226c20` |
| `knotFoePowerFor` | difficulty.js | fn | removed | removed | n/a | n/a | identity commit `3226c20` |
| `foeDmgBonusFor` | difficulty.js | fn | removed | removed | n/a | n/a | identity commit `3226c20` |
| `DOT_HP_FRACTION` | difficulty.js | n/a | `{0.24,0.36,0.6}` | removed (→ `DOT_HP_BASE` flat) | n/a | n/a | this commit `88b081e` (USER RULING G) |
| `FOE_LEVEL` | difficulty.js | n/a (new) | `{0.6, 0.2}` | fitted `{0.9, 0.29}` | yes | ↑ harder | `fit/fit-log.jsonl #13` |
| `HERO_SP_SCALE` | difficulty.js | n/a (new) | 1 | fitted 0.28 (unmoved from start-block3) | yes | ↓ easier XP pace | `fit/fit-log.jsonl #13` |
| `LOOT_SCALE` | difficulty.js | n/a (new) | 1 | held 0.8 | held | ↓ less coin | held (available) |
| `FOE_HIT_SCALE` | difficulty.js | n/a (new) | `{1, 0}` | fitted `{0.6, 0.01}` | yes | ↓ easier hits | `fit/fit-log.jsonl #13` |
| `FOE_HP_SCALE` | difficulty.js | n/a (new) | `{1, 0}` | fitted `{0.9, 0.015}` | yes | ↑ tankier foes | `fit/fit-log.jsonl #13` |
| `HERO_HP_SCALE` | difficulty.js | n/a (new) | 1 | fitted 1.25 (unmoved from start-block3) | yes | ↑ tankier hero | `fit/fit-log.jsonl #13` |
| `HERO_REGEN_PER_FLOOR` | difficulty.js | n/a (new) | 0 | fitted 0.25 (unmoved) | yes | ↑ easier | `fit/fit-log.jsonl #13` |
| `CAMP_HEAL_FRACTION` | difficulty.js | n/a (new) | 0.17 | held 0.2 | held | ↑ easier | held (available) |
| `ROUND_DAMAGE_CEILING` | difficulty.js | n/a (new) | 0 | held 0.5 | held | ↑ easier (softer) | held (available); TUNE-08 roster |
| `FOE_COUNT_SKEW` | difficulty.js | n/a (new) | 0 | held 1 | held | ↑ more bodies | held (available); 0..4 if released |
| `HAZARD_SCALE` | difficulty.js | n/a (new) | `{1, 0}` | fitted base 0.6 (unmoved), perDepth held 0.02 | base: yes | ↓ easier hazards | `fit/fit-log.jsonl #13` |
| `ENCOUNTER_DOTS` | difficulty.js | n/a (new) | `{9, 1}` | fitted base 7 (unmoved), perDepth held 0.3 | base: yes | ↓ less attrition | `fit/fit-log.jsonl #13` |
| `FOOD_CLOCK` | difficulty.js | n/a (new) | 1 | held 1.5 | held | ↑ more rations | held (available); [1.0,1.6] if released |
| `ABILITY_THREAT` | difficulty.js | n/a (new) | `{1, 0}` | held `{1, 0}` | held | ↑ more caster acts | held (available); base [0.6,1.2] if released |
| `STORE_TIER` | difficulty.js | n/a (canon) | `{0, 0.3}` | held `{0, 0.3}` | held | ↑ richer stores sooner | available, canon |
| `FIGHT_SHARE` (`DOT_MIX.fight`) | difficulty.js | n/a (new) | 1.0 | held 1.0 | held | ↑ more fights | held (available); [0.6,1.2] if released |
| `WANDER_RATE` | difficulty.js | n/a (new) | 1 | held 1 | held | ↑ more wandering checks | held (available); {0,1,2} if released |
| `FOE_ACCURACY` | difficulty.js | n/a (new) | 0 | held 0 | held | ↑ harder to-hit | held (available); -3..+3 if released |
| `MAZE_SIZE` | difficulty.js | n/a | n/a (cut) | n/a (cut) | n/a | n/a | available, not implemented (v1.8 candidate) |
| `DARK_BLOBS` | difficulty.js | n/a (canon) | `{-0.4, 0.7}` | held `{-0.4, 0.7}` | held | ↑ more darkness | held (available) |
| `CLASS_MITIGATION` | difficulty.js | n/a (new) | every row 1/0 | identity (no notch) | Magic User.spellPower: yes (cycle 2 only, dropped cycle 3) | n/a | held (available); TIER_SPREAD-adjacent |
| `TIER_SPREAD` | difficulty.js | 1 (canon d4=1) | 1 | held 1 | held | ↑ more bleed | available, canon |

#### Miss table (BAND-03)

**Floors 1-12: none — every floor 1-12 inside its band** (the AFTER solo verdict is PASS; `misses: []` at `fit/fit-log.jsonl #13`).

**Tail rows (13-20, dS only, no verdict):**

| Floor | dS | note |
|---|---|---|
| 13 | -1.9 | tail |
| 14 | -1.4 | tail |
| 15 | -0.7 | tail |
| 16 | -0.5 | tail |
| 17 | -0.5 | tail |
| 18 | -0.9 | tail |
| 19 | -0.8 | tail |
| 20 | -0.4 | tail |
| reach-20 | 1.5% vs 3.0-5.0% | tail, reported |

Every tail `dS` is small (largest magnitude -1.9 at floor 13) and the SAME sign (slightly under target) across all 8 floors — a mild, consistent undershoot past floor 12, not a structural miss; no held dial is named to release, since the fit's own objective never scored these floors (releasing a held dial to chase the tail would risk re-opening floors 1-12, which are currently clean).

#### Roster under the ceiling (TUNE-08)

| Creature | Type / tier | First floor | Raw max/round | foeHitScale | Scaled max | Hero level | Ceiling | Clamped max | Depth-20 deaths (n/50) | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| Herman | Humans t5 | 13 | 25+12=37 | 0.73 | 27 | 4 | 34 | 27 | 9 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |
| Drarl | Lair Beasts t5 | 13 | 25+12=37 | 0.73 | 27 | 4 | 34 | 27 | 11 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |
| Vampire | Walking Dead t5 | 13 | (25+8)×2=66 | 0.73 | 24×2=48 | 4 | 34 | **34** | 6 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |
| Djinni | Demons t5 | 13 | 25+8=33 | 0.73 | 24 | 4 | 34 | 24 | 6 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |
| Drake | Beasts t4 | 9 | 16+48=64 | 0.69 | 44 | 3 | 31 | **31** | 1 | stays — capped by ROUND_DAMAGE_CEILING 0.5 |

**Ruling B superseded:** the Drake trim USER RULING B proposed mid-phase (2d10+4 -> 2d8+2, under the old whole-sum rule's 116% reading) is NOT applied — `ROUND_DAMAGE_CEILING` bounds the Drake's crit to 31 regardless of dice notation; the ceiling is the mechanism, not a bestiary edit. The forced-20 slice reads p_20 74.0% vs the Ruling C 84.5% target (the Endgame shape is measured, not fitted — the tail's own reach-20 1.5% vs 3.0-5.0% band agrees this is a harder-than-target Endgame, recorded not chased). Tier-5 roster: 7 creatures (Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead, Demons — 6 types x tiers, tier 5 has 7 rows); first floor of tier 5 under the fitted map is depth 13 — unchanged from the v1.8 content-candidate note (54-CONTEXT.md's "Roster depth question").

#### Depth-20 slice — p_L readout (USER RULING C)

`Per-floor survival` (50 seeds, `--start-depth=20`): L=20 p_L=74.0% (target 84.5%, dS +71.0 vs the tail's own S_L base — informational only, this column reads the SLICE's own S_L which restarts at depth 20, not the full-run S_L); L=21 p_L=64.9%; L=22 p_L=69.6%; L=23 p_L=53.3%; L=24 p_L=57.1%; L=25 p_L=66.7% (target p_L 88.9%). Every floor 21-25 reads well below the Ruling C target — this is the SAME pattern the 1000-seed tail's own floors 21+ (`info`, not scored) show, confirming the Endgame is harder than Ruling C's own curve past floor 20 under this fit; recorded, not chased (BAND-01's Endgame band is "victory rare and celebrated" — a harder-than-target deep Endgame is consistent with that spirit, not a defect).

#### Parity — measured set (BAND-02)

Scan: `node tools/initiative-fixture-scan.mjs | diff - tools/initiative-fixture-scan-output.txt` clean (regenerated at commit `7db833e`). Suite: `node --test test/parity/*.test.js` green (43+/43+). **MOVED SET (26 declared holders across three mechanisms)**: 31 `chargenDivergence` holders (all 14 chargen seeds + movement#script + economy#script + 6 combat scenarios + 4 magic scenarios + 5 encounters scenarios — HERO_HP_SCALE/FOOD_CLOCK), 17 `floorFeatureShift` holders (ENCOUNTER_DOTS remap, a new record kind), 9 `divergence` (action-path) holders with `phase` containing `54` (win/chest/movement#script new; lose/lose-apprentice/lose-plain/flee/parley/cast-damage re-measured) — see `test/parity/FIXTURE-INVENTORY.md`'s `### Fitted dials — measured set` section for the full per-mechanism accounting and `test/parity/divergence-records.test.js`'s `BAND-02 (USER RULING D/G)` guard for the machine-checked EXPECTED set. `grep -rc '"BAND-02"' test/parity/fixtures/*.json` > 0 across all six fixture files. Master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `test/parity/harness/comparables.js` untouched (every `applyFloorFeatureShift` copy is LOCAL to its own test file, per the engine gate).

## v2.1 roll-direction pass (Phase 72) — bot readouts

### Rule changes under measurement

- **(a)** Parley insult applied LAST on the party-member branch, matching the hero branch (need 1→2, 19–20 on a d20 after Phase 73). Landed by 72-04.
- **(b)** Fridgian frenzy's second swing becomes the normal to-hit narrowed by one face (`Math.max(1, toHit(state)-1)`), replacing the canon hard-set need-3, and applies ONLY to the actual frenzy swing (F4). Landed by 72-05. This is the one fix expected to move difficulty measurably (Fridgian heroes only).
- **(c)** Skeleton shatter: a best-face landed to-hit roll against a Skeleton destroys it outright (both lives). Landed by 72-06.
- **(d)** Thief `evasion` dial sign flipped so a positive value subtracts from the foe's need (harder to hit); 0 at identity, so no fixture moves. Landed by 72-04.
- Plus F1 (member/ally strikes apply the hero's per-target to-hit rules), F3 (Shadow's `daggerOnly` becomes real) and F5 (`PARLEY_NEED_MOD` sign flipped, 0 at identity) — all landed by 72-07.

### Parameters

`node tools/tune-difficulty.mjs --seeds=200` (solo bot, `--start-depth=1`, no `--party`).

### BEFORE — commit 9197002 (phase start, no engine edit)

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=7  p90=12  max=30

Action-count distribution:
  min=187  p50=887  p90=20000  max=20000

Death-cause breakdown:
  starved in the dark  21 (10.5%)
  cut down by a Werebeast 15 (7.5%)
  undone by a trap     12 (6.0%)
  cut down by a Dante  9 (4.5%)
  spent by the dungeon itself 9 (4.5%)
  cut down by a Poltergeist 7 (3.5%)
  cut down by a Blumble 7 (3.5%)
  cut down by a Cave Bear 7 (3.5%)
  cut down by a Frank  6 (3.0%)
  cut down by a Drudge 6 (3.0%)
  cut down by a Drarl  6 (3.0%)
  cut down by a Trachea 5 (2.5%)
  cut down by a Herman 5 (2.5%)
  came up short on a leap 4 (2.0%)
  cut down by a Skeleton 4 (2.0%)
  cut down by a Craig  4 (2.0%)
  cut down by a Floater 4 (2.0%)
  cut down by a Stink Bug 4 (2.0%)
  cut down by a Drake  4 (2.0%)
  cut down by a Primp  4 (2.0%)
  cut down by a Djinni 3 (1.5%)
  cut down by a Google 3 (1.5%)
  cut down by a Ghoul  2 (1.0%)
  cut down by a Bones  2 (1.0%)
  cut down by a Hair   2 (1.0%)
  cut down by a Spectre 2 (1.0%)
  cut down by a Rinkle 2 (1.0%)
  cut down by a Drat   2 (1.0%)
  cut down by a Vampire 2 (1.0%)
  cut down by a Undead 2 (1.0%)
  fell off a wall      2 (1.0%)
  cut down by a Shadow 1 (0.5%)
  cut down by a Dread Lock 1 (0.5%)
  cut down by a Ghost  1 (0.5%)
  cut down by a China Wolf 1 (0.5%)
  cut down by a Ned    1 (0.5%)
  cut down by a Gremlin 1 (0.5%)
  cut down by a Sterling 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=564  successes=346 (61.3%)  failures=218  refused=0  exhausted=0
  runs with >=1 attempt: 76 of 200
  SP from parley: 1841 of 119708 total SP (1.5%)

Reach table (% of runs reaching floor N):
  >=5: 80.5%  >=10: 23.6%  >=20: 1.1%  >=30: 0.6%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=53  p50=115  p90=135  max=187

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 62/2082 (3.0%)
  6-10: 99/1021 (9.7%)
  11-20: 162/358 (45.3%)
  21-30: 41/63 (65.1%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=625  foeBolted=215  foeDrained=18  foeDebuffed=51  foeHealed=2  foeSummoned=4
  heroResisted=301  heroResistFailed=111
  ability damage: 1179 of 31172 total damage taken (3.8%)

Stuck: 26 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.4/0.6(caster)  potion<0.6  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 1:1  2:2  3:16  4:15  5:15  6:21  7:28  8:13  9:22  10:13  11:8  12:3  13:4  14:4  15:2  16:1  17:3  18:1  28:1  30:1
  mean death depth=7.74  floors gained p50=6 mean=6.74  encounters survived mean=16.65
  reach: >=5 80.5%  >=8 43.7%  >=9 36.2%  >=10 23.6%  >=13 9.8%  >=16 4.0%  >=20 1.1%
  band share of deaths: Filter 1-4 19.5% | Wall 5-8 44.3% | Breakaway 9-15 32.2% | Endgame 16-20 2.9% | beyond 20 1.1%
  top causes — Filter: cut down by a Dante 7, cut down by a Poltergeist 6, cut down by a Cave Bear 4, spent by the dungeon itself 3, cut down by a Hair 2
  top causes — Wall: cut down by a Werebeast 13, starved in the dark 13, cut down by a Blumble 7, undone by a trap 7, spent by the dungeon itself 5
  top causes — Breakaway: starved in the dark 6, cut down by a Drarl 5, cut down by a Drudge 5, cut down by a Herman 5, cut down by a Craig 4
  top causes — Endgame: came up short on a leap 1, cut down by a Drarl 1, cut down by a Dread Lock 1, cut down by a Drudge 1, cut down by a Floater 1

Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths; deaths split combat/dot/starvation-exhaustion/other):
  L=1  reached=200  deaths=1 (combat 1 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=99.5%  S_L=99.5%  target p_L=98.8%  target S_L=98.8%  dS=+0.7  PASS
  L=2  reached=199  deaths=2 (combat 0 / dot 1 / starvation-exhaustion 1 / other 0)  p_L=99.0%  S_L=98.5%  target p_L=96.3%  target S_L=95.1%  dS=+3.4  PASS
  L=3  reached=197  deaths=16 (combat 15 / dot 0 / starvation-exhaustion 1 / other 0)  p_L=91.9%  S_L=90.5%  target p_L=93.1%  target S_L=88.6%  dS=+1.9  PASS
  L=4  reached=178  deaths=15 (combat 10 / dot 5 / starvation-exhaustion 0 / other 0)  p_L=91.6%  S_L=82.9%  target p_L=89.9%  target S_L=79.7%  dS=+3.2  PASS
  L=5  reached=158  deaths=15 (combat 7 / dot 6 / starvation-exhaustion 2 / other 0)  p_L=90.5%  S_L=75.0%  target p_L=86.9%  target S_L=69.2%  dS=+5.8  PASS
  L=6  reached=141  deaths=21 (combat 15 / dot 1 / starvation-exhaustion 5 / other 0)  p_L=85.1%  S_L=63.8%  target p_L=84.3%  target S_L=58.4%  dS=+5.4  PASS
  L=7  reached=118  deaths=28 (combat 21 / dot 4 / starvation-exhaustion 3 / other 0)  p_L=76.3%  S_L=48.7%  target p_L=82.2%  target S_L=48.0%  dS=+0.7  PASS
  L=8  reached=86  deaths=13 (combat 6 / dot 4 / starvation-exhaustion 3 / other 0)  p_L=84.9%  S_L=41.3%  target p_L=80.6%  target S_L=38.7%  dS=+2.6  PASS
  L=9  reached=73  deaths=22 (combat 17 / dot 1 / starvation-exhaustion 4 / other 0)  p_L=69.9%  S_L=28.9%  target p_L=79.5%  target S_L=30.8%  dS=-1.9  PASS
  L=10  reached=49  deaths=13 (combat 9 / dot 3 / starvation-exhaustion 1 / other 0)  p_L=73.5%  S_L=21.2%  target p_L=78.9%  target S_L=24.3%  dS=-3.1  PASS
  L=11  reached=34  deaths=8 (combat 7 / dot 0 / starvation-exhaustion 1 / other 0)  p_L=76.5%  S_L=16.2%  target p_L=78.7%  target S_L=19.1%  dS=-2.9  PASS
  L=12  reached=25  deaths=3 (combat 3 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=88.0%  S_L=14.3%  target p_L=78.8%  target S_L=15.1%  dS=-0.8  PASS
  L=13  reached=22  deaths=4 (combat 4 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=81.8%  S_L=11.7%  target p_L=79.1%  target S_L=11.9%  dS=-0.2  tail
  L=14  reached=16  deaths=4 (combat 4 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=75.0%  S_L=8.8%  target p_L=79.6%  target S_L=9.5%  dS=-0.7  tail
  L=15  reached=12  deaths=2 (combat 2 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=83.3%  S_L=7.3%  target p_L=80.2%  target S_L=7.6%  dS=-0.3  tail
  L=16  reached=10  deaths=1 (combat 1 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=90.0%  S_L=6.6%  target p_L=81.0%  target S_L=6.2%  dS=+0.4  tail
  L=17  reached=9  deaths=3 (combat 3 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=66.7%  S_L=4.4%  target p_L=81.8%  target S_L=5.0%  dS=-0.6  tail
  L=18  reached=5  deaths=1 (combat 0 / dot 1 / starvation-exhaustion 0 / other 0)  p_L=80.0%  S_L=3.5%  target p_L=82.7%  target S_L=4.2%  dS=-0.7  tail
  L=19  reached=4  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=3.5%  target p_L=83.6%  target S_L=3.5%  dS=+0.0  tail
  L=20  reached=3  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=3.5%  target p_L=84.5%  target S_L=3.0%  dS=+0.5  tail
  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

Class identity (class pools only — Fighter = ABSORB, Thief = AVOID, Magic User = CHOOSE; race/sub cells are not targets):
  Fighter  n=69  p50=7  reach5=82.3%  reach10=17.7%  reach20=0.0%  dmgTaken/fight=11.15  rounds/fight=4.43  foeMiss=66.4%  casts(def/off)=0/0  potions/run=1.06  backstabs/run=0.00  flees/run=1.91
  Thief  n=72  p50=8  reach5=88.7%  reach10=30.6%  reach20=1.6%  dmgTaken/fight=7.78  rounds/fight=3.22  foeMiss=69.8%  casts(def/off)=0/0  potions/run=2.07  backstabs/run=11.29  flees/run=3.56
  Magic User  n=59  p50=7  reach5=68.0%  reach10=22.0%  reach20=2.0%  dmgTaken/fight=7.71  rounds/fight=3.03  foeMiss=66.9%  casts(def/off)=249/1338  potions/run=3.61  backstabs/run=0.00  flees/run=1.41

Outcome: 174 dead, 26 stuck (hit maxActions=20000; excluded from depth stats)

EXIT=0
```

Full raw output archived at the scratchpad path used during this run; the table above is verbatim from the tool's own stdout (Pace and the L=21+ info-only rows of Per-floor survival trimmed for length — both are unaffected by the four fixes under measurement, which are combat/parley mechanics, not floor-pacing mechanics).

### AFTER — commit d2adfd6 (all Phase 72 fixes)

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=2  p50=7  p90=13  max=40

Action-count distribution:
  min=212  p50=886  p90=20000  max=20000

Death-cause breakdown:
  cut down by a Werebeast 25 (12.5%)
  starved in the dark  18 (9.0%)
  undone by a trap     11 (5.5%)
  cut down by a Dante  10 (5.0%)
  spent by the dungeon itself 8 (4.0%)
  cut down by a Blumble 7 (3.5%)
  cut down by a Cave Bear 7 (3.5%)
  cut down by a Vampire 7 (3.5%)
  cut down by a Drarl  6 (3.0%)
  cut down by a Poltergeist 6 (3.0%)
  came up short on a leap 6 (3.0%)
  cut down by a Craig  6 (3.0%)
  cut down by a Drudge 4 (2.0%)
  cut down by a Spectre 4 (2.0%)
  cut down by a Drake  4 (2.0%)
  cut down by a Herman 4 (2.0%)
  cut down by a Floater 3 (1.5%)
  fell off a wall      3 (1.5%)
  cut down by a Skeleton 3 (1.5%)
  cut down by a Frank  3 (1.5%)
  cut down by a Shadow 3 (1.5%)
  cut down by a Rinkle 3 (1.5%)
  cut down by a Google 3 (1.5%)
  cut down by a Primp  3 (1.5%)
  cut down by a Djinni 2 (1.0%)
  cut down by a Trachea 2 (1.0%)
  cut down by a Bones  2 (1.0%)
  cut down by a Stink Bug 2 (1.0%)
  cut down by a Drat   2 (1.0%)
  cut down by a Ghoul  2 (1.0%)
  cut down by a Ghost  1 (0.5%)
  cut down by a Dread Lock 1 (0.5%)
  cut down by a China Wolf 1 (0.5%)
  cut down by a Hair   1 (0.5%)
  cut down by a Ned    1 (0.5%)
  cut down by a Sterling 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=571  successes=365 (63.9%)  failures=206  refused=0  exhausted=0
  runs with >=1 attempt: 79 of 200
  SP from parley: 1949 of 119425 total SP (1.6%)

Reach table (% of runs reaching floor N):
  >=5: 80.6%  >=10: 24.6%  >=20: 1.1%  >=30: 0.6%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=53  p50=115  p90=136  max=165

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 62/2075 (3.0%)
  6-10: 93/1035 (9.0%)
  11-20: 156/340 (45.9%)
  21-30: 41/66 (62.1%)
  31-50: 19/40 (47.5%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=646  foeBolted=259  foeDrained=19  foeDebuffed=58  foeHealed=0  foeSummoned=4
  heroResisted=276  heroResistFailed=115
  ability damage: 1367 of 32475 total damage taken (4.2%)

Stuck: 25 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.4/0.6(caster)  potion<0.6  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 2:2  3:18  4:14  5:13  6:28  7:23  8:11  9:23  10:13  11:5  12:4  13:7  14:5  15:4  17:1  18:2  28:1  40:1
  mean death depth=7.87  floors gained p50=6 mean=6.87  encounters survived mean=17.01
  reach: >=5 80.6%  >=8 44.0%  >=9 37.7%  >=10 24.6%  >=13 12.0%  >=16 2.9%  >=20 1.1%
  band share of deaths: Filter 1-4 19.4% | Wall 5-8 42.9% | Breakaway 9-15 34.9% | Endgame 16-20 1.7% | beyond 20 1.1%
  top causes — Filter: cut down by a Dante 7, cut down by a Poltergeist 6, cut down by a Cave Bear 4, spent by the dungeon itself 3, starved in the dark 3
  top causes — Wall: cut down by a Werebeast 21, starved in the dark 8, cut down by a Blumble 7, undone by a trap 5, came up short on a leap 3
  top causes — Breakaway: starved in the dark 7, cut down by a Craig 6, cut down by a Drarl 6, cut down by a Vampire 6, cut down by a Drake 4
  top causes — Endgame: came up short on a leap 1, cut down by a Drudge 1, cut down by a Vampire 1

Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths; deaths split combat/dot/starvation-exhaustion/other):
  L=1  reached=200  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=100.0%  target p_L=98.8%  target S_L=98.8%  dS=+1.2  PASS
  L=2  reached=200  deaths=2 (combat 0 / dot 1 / starvation-exhaustion 1 / other 0)  p_L=99.0%  S_L=99.0%  target p_L=96.3%  target S_L=95.1%  dS=+3.9  PASS
  L=3  reached=198  deaths=18 (combat 15 / dot 1 / starvation-exhaustion 2 / other 0)  p_L=90.9%  S_L=90.0%  target p_L=93.1%  target S_L=88.6%  dS=+1.4  PASS
  L=4  reached=177  deaths=14 (combat 9 / dot 5 / starvation-exhaustion 0 / other 0)  p_L=92.1%  S_L=82.9%  target p_L=89.9%  target S_L=79.7%  dS=+3.2  PASS
  L=5  reached=160  deaths=13 (combat 7 / dot 3 / starvation-exhaustion 3 / other 0)  p_L=91.9%  S_L=76.1%  target p_L=86.9%  target S_L=69.2%  dS=+6.9  PASS
  L=6  reached=144  deaths=28 (combat 22 / dot 2 / starvation-exhaustion 4 / other 0)  p_L=80.6%  S_L=61.3%  target p_L=84.3%  target S_L=58.4%  dS=+2.9  PASS
  L=7  reached=114  deaths=23 (combat 18 / dot 4 / starvation-exhaustion 1 / other 0)  p_L=79.8%  S_L=49.0%  target p_L=82.2%  target S_L=48.0%  dS=+1.0  PASS
  L=8  reached=85  deaths=11 (combat 7 / dot 4 / starvation-exhaustion 0 / other 0)  p_L=87.1%  S_L=42.6%  target p_L=80.6%  target S_L=38.7%  dS=+3.9  PASS
  L=9  reached=74  deaths=23 (combat 19 / dot 1 / starvation-exhaustion 3 / other 0)  p_L=68.9%  S_L=29.4%  target p_L=79.5%  target S_L=30.8%  dS=-1.4  PASS
  L=10  reached=49  deaths=13 (combat 7 / dot 5 / starvation-exhaustion 1 / other 0)  p_L=73.5%  S_L=21.6%  target p_L=78.9%  target S_L=24.3%  dS=-2.7  PASS
  L=11  reached=34  deaths=5 (combat 5 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=85.3%  S_L=18.4%  target p_L=78.7%  target S_L=19.1%  dS=-0.7  PASS
  L=12  reached=29  deaths=4 (combat 4 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=86.2%  S_L=15.9%  target p_L=78.8%  target S_L=15.1%  dS=+0.8  PASS
  L=13  reached=24  deaths=7 (combat 5 / dot 0 / starvation-exhaustion 2 / other 0)  p_L=70.8%  S_L=11.2%  target p_L=79.1%  target S_L=11.9%  dS=-0.7  tail
  L=14  reached=16  deaths=5 (combat 5 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=68.8%  S_L=7.7%  target p_L=79.6%  target S_L=9.5%  dS=-1.8  tail
  L=15  reached=11  deaths=4 (combat 3 / dot 0 / starvation-exhaustion 1 / other 0)  p_L=63.6%  S_L=4.9%  target p_L=80.2%  target S_L=7.6%  dS=-2.7  tail
  L=16  reached=7  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=4.9%  target p_L=81.0%  target S_L=6.2%  dS=-1.3  tail
  L=17  reached=7  deaths=1 (combat 1 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=85.7%  S_L=4.2%  target p_L=81.8%  target S_L=5.0%  dS=-0.8  tail
  L=18  reached=6  deaths=2 (combat 1 / dot 1 / starvation-exhaustion 0 / other 0)  p_L=66.7%  S_L=2.8%  target p_L=82.7%  target S_L=4.2%  dS=-1.4  tail
  L=19  reached=4  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=2.8%  target p_L=83.6%  target S_L=3.5%  dS=-0.7  tail
  L=20  reached=3  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=2.8%  target p_L=84.5%  target S_L=3.0%  dS=-0.2  tail
  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

Class identity (class pools only — Fighter = ABSORB, Thief = AVOID, Magic User = CHOOSE; race/sub cells are not targets):
  Fighter  n=69  p50=7  reach5=81.0%  reach10=19.0%  reach20=0.0%  dmgTaken/fight=11.90  rounds/fight=4.87  foeMiss=65.5%  casts(def/off)=0/0  potions/run=1.09  backstabs/run=0.00  flees/run=2.43
  Thief  n=72  p50=8  reach5=90.2%  reach10=32.8%  reach20=1.6%  dmgTaken/fight=7.45  rounds/fight=3.26  foeMiss=70.0%  casts(def/off)=0/0  potions/run=2.04  backstabs/run=10.04  flees/run=3.51
  Magic User  n=59  p50=6  reach5=68.6%  reach10=21.6%  reach20=2.0%  dmgTaken/fight=8.15  rounds/fight=3.00  foeMiss=66.4%  casts(def/off)=270/1412  potions/run=3.59  backstabs/run=0.00  flees/run=1.34

Outcome: 175 dead, 25 stuck (hit maxActions=20000; excluded from depth stats)

EXIT=0
```

L=21+ info-only rows and the Pace table are trimmed for length, matching the BEFORE block's own trim (both are unaffected by any of this phase's fixes, which are combat/parley mechanics, not floor-pacing mechanics).

### Reading (BEFORE → AFTER)

| Metric | BEFORE (9197002) | AFTER (d2adfd6) | Δ |
|---|---|---|---|
| Death-depth min/p50/p90/max | 1/7/12/30 | 2/7/13/40 | p50 unchanged; p90/max drift up (tail noise, n=200) |
| Action-count p50 | 887 | 886 | -1, noise |
| Reach ≥5/≥10/≥20/≥30 | 80.5%/23.6%/1.1%/0.6% | 80.6%/24.6%/1.1%/0.6% | flat to +1.0pp |
| Stuck runs (of 200) | 26 (13.0%) | 25 (12.5%) | -1, noise |
| Mean death depth (completed runs) | 7.74 | 7.87 | +0.13, noise |
| Band share — Filter/Wall/Breakaway/Endgame/beyond-20 | 19.5%/44.3%/32.2%/2.9%/1.1% | 19.4%/42.9%/34.9%/1.7%/1.1% | a few points shift Wall→Breakaway (noise-band) |
| Parley attempts / success rate | 564 / 61.3% | 571 / 63.9% | +7 attempts, +2.6pp — downstream RNG-divergence noise (PARLEY_NEED_MOD is 0 at identity in the shipped dials; the sign flip cannot itself move this) |
| Fighter / Thief / Magic User p50 | 7 / 8 / 7 | 7 / 8 / 6 | Magic User p50 -1, within seed-to-seed noise for n=59 |
| Skeleton / Shadow death-cause share | 2.0% / 0.5% | 1.5% / 1.5% | Shadow's share triples (1→3 of 200) — the one death-cause line plausibly touched by a real mechanical change (F3, see below); still a tiny n |

**Reading.** The headline curve (reach table, four-band shares, per-floor survival PASS/tail verdicts, stuck rate) is statistically flat between BEFORE and AFTER — every difference above sits well inside ordinary seed-to-seed noise for a 200-seed sample, and the per-floor survival table's PASS verdict for floors 1-12 is unchanged. This matches expectations for a phase whose landed fixes are almost entirely SIGN corrections and reachability corrections, not magnitude changes:
- **(a)** the parley-insult reorder and **(d)** the Thief evasion sign only ever touch a party-member branch or a dial that is 0 at identity — this solo bot readout (`party=off`) never reaches either code path at all, so they contribute nothing directly.
- **(b)** Fridgian frenzy's second swing (narrowed by one face instead of the canon hard-set need-3) is the one fix with a REAL magnitude effect, but only for Fridgian heroes on their second swing — a small slice of a 200-seed mixed-race sample, and not visible as a distinct line in this run's own aggregate breakdown.
- **(c)** the Skeleton shatter mechanic and **F3** the Shadow's `daggerOnly` are both new SUCCESS/FAILURE branches on rolls that already happened — they can only ever redirect an existing to-hit roll's outcome, never add or remove a roll. The Shadow death-cause share moving from 1 (0.5%) to 3 (1.5%) is the one line in this readout plausibly touched by F3 (a bot with no dagger and no magic weapon cannot land a hit on a Shadow at all, so a Shadow it can't parley/flee past now sometimes grinds it down instead of dying itself) — but n=1→3 is far too small to call a trend on its own.
- **F1** (member/legacy/summon per-target rules) is entirely INERT in this readout — the bot runs `party=off`, so `memberStrike`/`alliesTurn`'s legacy branch/`allyTurn` never fire (the same reachability argument `test/parity/divergence-records.test.js`'s extended guard proves for the 31 parity replay sites). F1's real-playthrough effect is documented instead in `test/unit/bot-tactics.test.js`'s no-stall proof (a forced Magic User/Sorcerer/Human party build) — see that file's own Phase 72 comment for the bisected, measured account.
- **F5** (`PARLEY_NEED_MOD` sign) is 0 at identity in the shipped dials both before and after — any parley-attempts/success-rate drift above is pure downstream RNG-divergence noise from earlier rolls in the SAME run resolving differently once F1/F3 change an outcome, not a direct effect of the dial itself.

Every number above is well inside the kind of run-to-run variance already documented for the BEFORE readout's own predecessor comparisons (see the v1.2 retune section's own BEFORE/AFTER methodology below) — this phase closes with no difficulty retune owed.

### Sign notes against the historical dial table

The Phase 54 historical dial table (`## v1.2 retune (Phase 27)`'s own BEFORE/AFTER material, and the frozen table referenced from `## The device trigger` in `docs/ROLL-LEDGER.md`) states two rows that this phase's audit corrected:
- **Thief `evasion`** — the historical table's "first candidate Thief evasion −1" now reads **+1** (a positive evasion value is harder to hit, matching the dial's own name) after fix (d)'s sign flip (72-04). The historical row is left unedited (it is a record of what shipped at the time, not a live spec); this note is the correction.
- **`PARLEY_NEED_MOD`** — the historical table's `FLEE_NEED_MOD / PARLEY_NEED_MOD … harder` annotation is now TRUE for both dials (it was already true for `FLEE_NEED_MOD`; `PARLEY_NEED_MOD` was silently inverted until F5, 72-07). Both dials share one direction now: up = harder, down = easier, for flee and parley alike.

## v2.1 roll-high mirror (Phase 73) — bot readout

### Change under measurement

Phase 73 (ROLL-05) switches the whole ENGINE — not a display adapter — to roll-high: every CHECK now reads the same rng draw `r` on an N-sided die as `roll = (N+1) - r`, and succeeds when `roll >= atLeast` (the lowest winning face). Every modifier folds into the threshold as a signed bonus to the roller, the two pre-existing roll-high exceptions (flee, initiative) keep their modifiers aligned to the same convention, and content numbers (weapon `need`, `sp.toHit`, `sp.ar`, and the like) keep their old values — counts of winning faces — so no save requires a conversion step. This is a **representation change only**: the same `rng.d(N)` draw fires in the same position, in the same order, for every seed, so every outcome is predicted to be byte-identical to the pre-phase engine. See `docs/ROLL-LEDGER.md`'s `## Phase 73 mirror verdicts (ROLL-05)` for the full per-site conversion table and `test/parity/FIXTURE-INVENTORY.md`'s `## Phase 73: engine roll-high mirror (ROLL-05)` section for the measured-zero proof this readout is the third leg of (alongside the byte-identical parity suite and the unchanged Phase 72 direction tests).

### Parameters

`node tools/tune-difficulty.mjs --seeds=200` (solo bot, `--start-depth=1`, no `--party`) — identical parameters to the Phase 72 H2 above, so this readout is directly comparable to that one's own AFTER block.

### AFTER — commit ad78215 (all nine Phase 73 conversion plans, 73-01 through 73-09, landed)

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=2  p50=7  p90=13  max=40

Action-count distribution:
  min=212  p50=886  p90=20000  max=20000

Death-cause breakdown:
  cut down by a Werebeast 25 (12.5%)
  starved in the dark  18 (9.0%)
  undone by a trap     11 (5.5%)
  cut down by a Dante  10 (5.0%)
  spent by the dungeon itself 8 (4.0%)
  cut down by a Blumble 7 (3.5%)
  cut down by a Cave Bear 7 (3.5%)
  cut down by a Vampire 7 (3.5%)
  cut down by a Drarl  6 (3.0%)
  cut down by a Poltergeist 6 (3.0%)
  came up short on a leap 6 (3.0%)
  cut down by a Craig  6 (3.0%)
  cut down by a Drudge 4 (2.0%)
  cut down by a Spectre 4 (2.0%)
  cut down by a Drake  4 (2.0%)
  cut down by a Herman 4 (2.0%)
  cut down by a Floater 3 (1.5%)
  fell off a wall      3 (1.5%)
  cut down by a Skeleton 3 (1.5%)
  cut down by a Frank  3 (1.5%)
  cut down by a Shadow 3 (1.5%)
  cut down by a Rinkle 3 (1.5%)
  cut down by a Google 3 (1.5%)
  cut down by a Primp  3 (1.5%)
  cut down by a Djinni 2 (1.0%)
  cut down by a Trachea 2 (1.0%)
  cut down by a Bones  2 (1.0%)
  cut down by a Stink Bug 2 (1.0%)
  cut down by a Drat   2 (1.0%)
  cut down by a Ghoul  2 (1.0%)
  cut down by a Ghost  1 (0.5%)
  cut down by a Dread Lock 1 (0.5%)
  cut down by a China Wolf 1 (0.5%)
  cut down by a Hair   1 (0.5%)
  cut down by a Ned    1 (0.5%)
  cut down by a Sterling 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=571  successes=365 (63.9%)  failures=206  refused=0  exhausted=0
  runs with >=1 attempt: 79 of 200
  SP from parley: 1949 of 119425 total SP (1.6%)

Reach table (% of runs reaching floor N):
  >=5: 80.6%  >=10: 24.6%  >=20: 1.1%  >=30: 0.6%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=53  p50=115  p90=136  max=165

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 62/2075 (3.0%)
  6-10: 93/1035 (9.0%)
  11-20: 156/340 (45.9%)
  21-30: 41/66 (62.1%)
  31-50: 19/40 (47.5%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=646  foeBolted=259  foeDrained=19  foeDebuffed=58  foeHealed=0  foeSummoned=4
  heroResisted=276  heroResistFailed=115
  ability damage: 1367 of 32475 total damage taken (4.2%)

Stuck: 25 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.4/0.6(caster)  potion<0.6  camp<0.5  seeds=200  startDepth=1

Four-band readout (BAND-01 — Filter 1-4 / Wall 5-8 / Breakaway 9-15 / Endgame 16-20; completed runs only):
  death-depth histogram: 2:2  3:18  4:14  5:13  6:28  7:23  8:11  9:23  10:13  11:5  12:4  13:7  14:5  15:4  17:1  18:2  28:1  40:1
  mean death depth=7.87  floors gained p50=6 mean=6.87  encounters survived mean=17.01
  reach: >=5 80.6%  >=8 44.0%  >=9 37.7%  >=10 24.6%  >=13 12.0%  >=16 2.9%  >=20 1.1%
  band share of deaths: Filter 1-4 19.4% | Wall 5-8 42.9% | Breakaway 9-15 34.9% | Endgame 16-20 1.7% | beyond 20 1.1%
  top causes — Filter: cut down by a Dante 7, cut down by a Poltergeist 6, cut down by a Cave Bear 4, spent by the dungeon itself 3, starved in the dark 3
  top causes — Wall: cut down by a Werebeast 21, starved in the dark 8, cut down by a Blumble 7, undone by a trap 5, came up short on a leap 3
  top causes — Breakaway: starved in the dark 7, cut down by a Craig 6, cut down by a Drarl 6, cut down by a Vampire 6, cut down by a Drake 4
  top causes — Endgame: came up short on a leap 1, cut down by a Drudge 1, cut down by a Vampire 1

Per-floor survival (USER RULING C target — p_L = 1 - deaths_L / reached_L; S_L = product of p_k from the start depth; stuck runs count as reached, never as deaths; deaths split combat/dot/starvation-exhaustion/other):
  L=1  reached=200  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=100.0%  target p_L=98.8%  target S_L=98.8%  dS=+1.2  PASS
  L=2  reached=200  deaths=2 (combat 0 / dot 1 / starvation-exhaustion 1 / other 0)  p_L=99.0%  S_L=99.0%  target p_L=96.3%  target S_L=95.1%  dS=+3.9  PASS
  L=3  reached=198  deaths=18 (combat 15 / dot 1 / starvation-exhaustion 2 / other 0)  p_L=90.9%  S_L=90.0%  target p_L=93.1%  target S_L=88.6%  dS=+1.4  PASS
  L=4  reached=177  deaths=14 (combat 9 / dot 5 / starvation-exhaustion 0 / other 0)  p_L=92.1%  S_L=82.9%  target p_L=89.9%  target S_L=79.7%  dS=+3.2  PASS
  L=5  reached=160  deaths=13 (combat 7 / dot 3 / starvation-exhaustion 3 / other 0)  p_L=91.9%  S_L=76.1%  target p_L=86.9%  target S_L=69.2%  dS=+6.9  PASS
  L=6  reached=144  deaths=28 (combat 22 / dot 2 / starvation-exhaustion 4 / other 0)  p_L=80.6%  S_L=61.3%  target p_L=84.3%  target S_L=58.4%  dS=+2.9  PASS
  L=7  reached=114  deaths=23 (combat 18 / dot 4 / starvation-exhaustion 1 / other 0)  p_L=79.8%  S_L=49.0%  target p_L=82.2%  target S_L=48.0%  dS=+1.0  PASS
  L=8  reached=85  deaths=11 (combat 7 / dot 4 / starvation-exhaustion 0 / other 0)  p_L=87.1%  S_L=42.6%  target p_L=80.6%  target S_L=38.7%  dS=+3.9  PASS
  L=9  reached=74  deaths=23 (combat 19 / dot 1 / starvation-exhaustion 3 / other 0)  p_L=68.9%  S_L=29.4%  target p_L=79.5%  target S_L=30.8%  dS=-1.4  PASS
  L=10  reached=49  deaths=13 (combat 7 / dot 5 / starvation-exhaustion 1 / other 0)  p_L=73.5%  S_L=21.6%  target p_L=78.9%  target S_L=24.3%  dS=-2.7  PASS
  L=11  reached=34  deaths=5 (combat 5 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=85.3%  S_L=18.4%  target p_L=78.7%  target S_L=19.1%  dS=-0.7  PASS
  L=12  reached=29  deaths=4 (combat 4 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=86.2%  S_L=15.9%  target p_L=78.8%  target S_L=15.1%  dS=+0.8  PASS
  L=13  reached=24  deaths=7 (combat 5 / dot 0 / starvation-exhaustion 2 / other 0)  p_L=70.8%  S_L=11.2%  target p_L=79.1%  target S_L=11.9%  dS=-0.7  tail
  L=14  reached=16  deaths=5 (combat 5 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=68.8%  S_L=7.7%  target p_L=79.6%  target S_L=9.5%  dS=-1.8  tail
  L=15  reached=11  deaths=4 (combat 3 / dot 0 / starvation-exhaustion 1 / other 0)  p_L=63.6%  S_L=4.9%  target p_L=80.2%  target S_L=7.6%  dS=-2.7  tail
  L=16  reached=7  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=4.9%  target p_L=81.0%  target S_L=6.2%  dS=-1.3  tail
  L=17  reached=7  deaths=1 (combat 1 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=85.7%  S_L=4.2%  target p_L=81.8%  target S_L=5.0%  dS=-0.8  tail
  L=18  reached=6  deaths=2 (combat 1 / dot 1 / starvation-exhaustion 0 / other 0)  p_L=66.7%  S_L=2.8%  target p_L=82.7%  target S_L=4.2%  dS=-1.4  tail
  L=19  reached=4  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=2.8%  target p_L=83.6%  target S_L=3.5%  dS=-0.7  tail
  L=20  reached=3  deaths=0 (combat 0 / dot 0 / starvation-exhaustion 0 / other 0)  p_L=100.0%  S_L=2.8%  target p_L=84.5%  target S_L=3.0%  dS=-0.2  tail
  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

Class identity (class pools only — Fighter = ABSORB, Thief = AVOID, Magic User = CHOOSE; race/sub cells are not targets):
  Fighter  n=69  p50=7  reach5=81.0%  reach10=19.0%  reach20=0.0%  dmgTaken/fight=11.90  rounds/fight=4.87  foeMiss=65.5%  casts(def/off)=0/0  potions/run=1.09  backstabs/run=0.00  flees/run=2.43
  Thief  n=72  p50=8  reach5=90.2%  reach10=32.8%  reach20=1.6%  dmgTaken/fight=7.45  rounds/fight=3.26  foeMiss=70.0%  casts(def/off)=0/0  potions/run=2.04  backstabs/run=10.04  flees/run=3.51
  Magic User  n=59  p50=6  reach5=68.6%  reach10=21.6%  reach20=2.0%  dmgTaken/fight=8.15  rounds/fight=3.00  foeMiss=66.4%  casts(def/off)=270/1412  potions/run=3.59  backstabs/run=0.00  flees/run=1.34

Outcome: 175 dead, 25 stuck (hit maxActions=20000; excluded from depth stats)

EXIT=0
```

L=21+ info-only rows and the Pace table are trimmed for length, matching the Phase 72 H2's own AFTER block trim (both are unaffected by a representation-only change) — the fully untrimmed run was verified byte-for-byte against `tools/roll-high-baseline-readout.txt` via `node tools/readout-compare.mjs --exact` before trimming for this record.

### Reading

This readout is **identical, byte for byte (after CRLF normalisation), to the Phase 73 base readout** (`tools/roll-high-baseline-readout.txt`, recorded at the phase's start commit before any conversion plan landed) — verified via `node tools/readout-compare.mjs --exact tools/roll-high-baseline-readout.txt <this-run>`, which reports zero differing lines across the full untrimmed transcript (200 seeds, every section, including the trimmed-here L=21+ rows and Pace table).

It is also identical to **every recorded line of the Phase 72 `### AFTER — commit d2adfd6` block above**, verified via `node tools/readout-compare.mjs --recorded docs/DIFFICULTY-RETUNE.md "### AFTER — commit d2adfd6" <this-run>`, which confirms every one of that block's non-blank lines (the Phase 72 fixes already baked in) appears, in order, in this run — because Phase 73's base commit IS Phase 72's close commit, the two readouts describe the exact same engine state read two different ways.

**No difficulty change and no retune owed.** This is exactly the outcome CONTEXT Area 3 predicts for a representation-only mirror: every `rng.d(N)` draw fires in the same position, in the same order, for every one of the 200 seeds, and every check's outcome (`roll >= atLeast`) is the arithmetic mirror of the old outcome (`r <= need`) for the SAME raw draw `r` — there is no path by which reading the die differently could move a death depth, a reach percentage, a per-floor survival number, or a death-cause count. This readout is the third and final proof (alongside the byte-identical parity suite and the unchanged Phase 72 direction tests) that Phase 73 changed representation, never outcome.

## v2.1 engine rules (Phase 75) — bot readouts

### Change under measurement

Six balance-moving Phase 75 plans, each committing its own before/after
readout independently (parallel waves never collided on this shared
ledger — this section consolidates them once, from the committed files):

- **75-02 (RULES-01/RULES-02):** the wilmst cache cut, `WILMST_CACHE_PER_DEPTH` 300 → 100 (still through `lootFor`); RULES-01 was verified, not fixed (no engine change).
- **75-05 (RULES-03, first half):** the Summoner's offense school gate removed (`content/mu-chart.js`), plus grant-time legality (`grantableAt`) wired into all four grimoire grant paths for the six subs that keep a gate.
- **75-06 (RULES-05/RULES-14):** Sense Presence wins initiative outright and lifts the dark penalties; Bubble becomes a one-shot mirror (reflect the next blow, then a 25 hp/1-round pool) instead of a bigger Shield.
- **75-09 (RULES-13, bag-inert half):** a bagged staff's charged power is inert (`notWielded` refusal); the tuning bot equips and wields its own staff.
- **75-10 (RULES-03, second half):** the Summoner's healing-school spells (cast or regenerated) restore half, floored, minimum 1 (`healMul: 0.5`).
- **75-12 (RULES-12/RULES-15):** a wanderer-interrupted feature tile resumes after the fight instead of being dropped; spell books refill only on a fed day.

### Parameters

`node tools/tune-difficulty.mjs --seeds=200` (solo bot, `--start-depth=1`, no `--party`) — the same command and dial set the Phase 72/73 sections above use.

### Plan 02 — BEFORE

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=40

  mean death depth=7.87  floors gained p50=6 mean=6.87  encounters survived mean=17.01
  reach: >=5 80.6%  >=8 44.0%  >=9 37.7%  >=10 24.6%  >=13 12.0%  >=16 2.9%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=68.6%  reach10=21.6%  reach20=2.0%  dmgTaken/fight=8.15  rounds/fight=3.00  foeMiss=66.4%  casts(def/off)=270/1412  potions/run=3.59  backstabs/run=0.00  flees/run=1.34

Outcome: 175 dead, 25 stuck (hit maxActions=20000; excluded from depth stats)
```

### Plan 02 — AFTER

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=40

  mean death depth=7.88  floors gained p50=6 mean=6.88  encounters survived mean=16.99
  reach: >=5 80.6%  >=8 44.6%  >=9 37.7%  >=10 24.6%  >=13 12.0%  >=16 2.9%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=68.6%  reach10=21.6%  reach20=2.0%  dmgTaken/fight=8.15  rounds/fight=3.00  foeMiss=66.4%  casts(def/off)=270/1412  potions/run=3.59  backstabs/run=0.00  flees/run=1.34

Outcome: 175 dead, 25 stuck (hit maxActions=20000; excluded from depth stats)
```

**Reading.** The death-depth/reach/verdict/Magic-User/Outcome lines are noise-identical (the one visible move, `reach8` 44.0%→44.6%, is a single-run tail flip at n=200). This matches 75-02's own SUMMARY exactly: RULES-01 needed no engine change (verified only), and RULES-02's cache cut is a pure gold-on-hand lever the solo-bot mean-death-depth proxy was never going to see — 75-02's own before/after economy readout (Pace table) is where the real effect shows: gold-on-hand at L20 falls 11584→9664, L10 3325→2878, with the survival curve held flat by design.

### Plan 05 — BEFORE

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=40

  mean death depth=7.88  floors gained p50=6 mean=6.88  encounters survived mean=16.99
  reach: >=5 80.6%  >=8 44.6%  >=9 37.7%  >=10 24.6%  >=13 12.0%  >=16 2.9%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=68.6%  reach10=21.6%  reach20=2.0%  dmgTaken/fight=8.15  rounds/fight=3.00  foeMiss=66.4%  casts(def/off)=270/1412  potions/run=3.59  backstabs/run=0.00  flees/run=1.34

Outcome: 175 dead, 25 stuck (hit maxActions=20000; excluded from depth stats)
```

### Plan 05 — AFTER

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=40

  mean death depth=7.84  floors gained p50=6 mean=6.84  encounters survived mean=16.76
  reach: >=5 80.2%  >=8 44.1%  >=9 37.3%  >=10 24.9%  >=13 10.7%  >=16 2.8%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=68.5%  reach10=22.2%  reach20=1.9%  dmgTaken/fight=8.02  rounds/fight=2.96  foeMiss=65.0%  casts(def/off)=262/1450  potions/run=3.69  backstabs/run=0.00  flees/run=1.00

Outcome: 177 dead, 23 stuck (hit maxActions=20000; excluded from depth stats)
```

**Reading.** p50 death depth is unchanged at 7; mean drifts 7.88→7.84 (noise). The Magic User pool's `casts(def/off)` moves 270/1412→262/1450 — more offense casts overall, exactly the expected direction once a level-1 Summoner can cast offense from the start — with no material survival shift (reach5/reach10 both move under 1pp). Matches 75-05's own SUMMARY: "death-depth p50 unchanged at 7... no material balance shift."

### Plan 06 — BEFORE

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=40

  mean death depth=7.88  floors gained p50=6 mean=6.88  encounters survived mean=16.99
  reach: >=5 80.6%  >=8 44.6%  >=9 37.7%  >=10 24.6%  >=13 12.0%  >=16 2.9%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=68.6%  reach10=21.6%  reach20=2.0%  dmgTaken/fight=8.15  rounds/fight=3.00  foeMiss=66.4%  casts(def/off)=270/1412  potions/run=3.59  backstabs/run=0.00  flees/run=1.34

Outcome: 175 dead, 25 stuck (hit maxActions=20000; excluded from depth stats)
```

### Plan 06 — AFTER

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=40

  mean death depth=7.85  floors gained p50=6 mean=6.85  encounters survived mean=16.89
  reach: >=5 80.2%  >=8 43.5%  >=9 37.3%  >=10 24.9%  >=13 11.9%  >=16 2.8%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=67.9%  reach10=20.8%  reach20=1.9%  dmgTaken/fight=8.01  rounds/fight=2.92  foeMiss=66.1%  casts(def/off)=246/1417  potions/run=3.53  backstabs/run=0.00  flees/run=1.20

Outcome: 177 dead, 23 stuck (hit maxActions=20000; excluded from depth stats)
```

**Reading.** Mean death depth 7.88→7.85 (noise); the Magic User pool's `dmgTaken/fight` moves 8.15(75-02 base)→8.01 slightly DOWN, consistent with the intended shape of the Bubble nerf (a reflected blow now costs the caster nothing at all, vs. the old ward's partial soak) landing alongside the Sense Presence buff (fewer surprise-lost initiatives in the dark). Matches 75-06's own SUMMARY: "mean death depth 7.88 → 7.85... the Bubble nerf is noise-level at the aggregate difficulty-curve level."

### Plan 09 — BEFORE

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=40

  mean death depth=7.79  floors gained p50=6 mean=6.79  encounters survived mean=16.66
  reach: >=5 79.2%  >=8 43.3%  >=9 37.1%  >=10 25.3%  >=13 10.7%  >=16 2.8%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=65.5%  reach10=21.8%  reach20=1.8%  dmgTaken/fight=8.02  rounds/fight=2.93  foeMiss=64.7%  casts(def/off)=237/1444  potions/run=3.61  backstabs/run=0.00  flees/run=0.90

Outcome: 178 dead, 22 stuck (hit maxActions=20000; excluded from depth stats)
```

### Plan 09 — AFTER

```
Death-depth distribution:
  min=2  p50=7  p90=12  max=28

  mean death depth=7.51  floors gained p50=6 mean=6.51  encounters survived mean=15.90
  reach: >=5 78.0%  >=8 42.2%  >=9 35.8%  >=10 23.7%  >=13 9.8%  >=16 2.3%  >=20 0.6%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=60.0%  reach10=16.0%  reach20=0.0%  dmgTaken/fight=7.94  rounds/fight=3.25  foeMiss=65.6%  casts(def/off)=224/1255  potions/run=3.49  backstabs/run=0.00  flees/run=0.86

Outcome: 173 dead, 27 stuck (hit maxActions=20000; excluded from depth stats)
```

**Reading.** The one measurable move of the six plans: mean death depth 7.79→7.51 (−0.28), Magic User reach5 65.5%→60.0% and reach10 21.8%→16.0%, both down. This is the expected, one-action-later cost of a Magic User's bagged staff no longer benefiting from its charged power until the bot's own new equip step wields it — 75-09's own SUMMARY calls this "a small, expected difficulty effect... well inside the readout's own informational-proxy framing," and the per-floor-survival verdict stays "all floors 1-12 inside the pass band" both before and after.

### Plan 10 — BEFORE

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=40

  mean death depth=7.79  floors gained p50=6 mean=6.79  encounters survived mean=16.66
  reach: >=5 79.2%  >=8 43.3%  >=9 37.1%  >=10 25.3%  >=13 10.7%  >=16 2.8%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=65.5%  reach10=21.8%  reach20=1.8%  dmgTaken/fight=8.02  rounds/fight=2.93  foeMiss=64.7%  casts(def/off)=237/1444  potions/run=3.61  backstabs/run=0.00  flees/run=0.90

Outcome: 178 dead, 22 stuck (hit maxActions=20000; excluded from depth stats)
```

### Plan 10 — AFTER

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=40

  mean death depth=7.79  floors gained p50=6 mean=6.79  encounters survived mean=16.65
  reach: >=5 79.2%  >=8 43.3%  >=9 37.1%  >=10 25.3%  >=13 10.7%  >=16 2.8%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=65.5%  reach10=21.8%  reach20=1.8%  dmgTaken/fight=8.02  rounds/fight=2.90  foeMiss=64.5%  casts(def/off)=235/1442  potions/run=3.61  backstabs/run=0.00  flees/run=0.90

Outcome: 178 dead, 22 stuck (hit maxActions=20000; excluded from depth stats)
```

**Reading.** Byte-for-byte flat on every reach/verdict/Outcome line; the Magic User pool's `casts(def/off)` moves by 2 casts of noise (237/1444→235/1442). Matches 75-10's own SUMMARY: "Death-depth distribution is identical... well within run-to-run seed noise for a 200-seed sample, not a balance regression." The Summoner healing weakness is real but too thin a slice of a 59-Magic-User sample to move the pool aggregate.

### Plan 12 — BEFORE

```
Death-depth distribution:
  min=2  p50=7  p90=12  max=28

  mean death depth=7.51  floors gained p50=6 mean=6.51  encounters survived mean=15.89
  reach: >=5 78.0%  >=8 42.2%  >=9 35.8%  >=10 23.7%  >=13 9.8%  >=16 2.3%  >=20 0.6%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=60.0%  reach10=16.0%  reach20=0.0%  dmgTaken/fight=7.93  rounds/fight=3.22  foeMiss=65.3%  casts(def/off)=222/1253  potions/run=3.49  backstabs/run=0.00  flees/run=0.86

Outcome: 173 dead, 27 stuck (hit maxActions=20000; excluded from depth stats)
```

### Plan 12 — AFTER

```
Death-depth distribution:
  min=2  p50=7  p90=12  max=28

  mean death depth=7.54  floors gained p50=6 mean=6.54  encounters survived mean=16.32
  reach: >=5 78.2%  >=8 42.0%  >=9 35.6%  >=10 23.6%  >=13 9.8%  >=16 2.3%  >=20 1.1%

  reach-20: 1.0% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Magic User  n=59  p50=6  reach5=59.2%  reach10=16.3%  reach20=0.0%  dmgTaken/fight=8.21  rounds/fight=3.30  foeMiss=65.2%  casts(def/off)=199/1214  potions/run=3.54  backstabs/run=0.00  flees/run=0.85

Outcome: 174 dead, 26 stuck (hit maxActions=20000; excluded from depth stats)
```

**Reading.** Mean death depth ticks UP 7.51→7.54 — the interrupted-tile resume (RULES-12) hands back a chest/dot/exit a bot playthrough would otherwise have lost, a small net-positive that outweighs the fed-only book refill's (RULES-15) small net-negative on a starving Magic User. Matches 75-12's own SUMMARY: "no meaningful difficulty-curve shift... both readouts pass every floor-1–12 survival band."

### Phase 75 — BEFORE (75-02 base)

```
  min=2  p50=7  p90=13  max=40

Reach table (% of runs reaching floor N):
  >=5: 80.6%  >=10: 24.6%  >=20: 1.1%  >=30: 0.6%  >=50: 0.0%

  mean death depth=7.87  floors gained p50=6 mean=6.87  encounters survived mean=17.01
  reach: >=5 80.6%  >=8 44.0%  >=9 37.7%  >=10 24.6%  >=13 12.0%  >=16 2.9%  >=20 1.1%

  reach-20: 1.5% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Fighter  n=69  p50=7  reach5=81.0%  reach10=19.0%  reach20=0.0%  dmgTaken/fight=11.90  rounds/fight=4.87  foeMiss=65.5%  casts(def/off)=0/0  potions/run=1.09  backstabs/run=0.00  flees/run=2.43
  Thief  n=72  p50=8  reach5=90.2%  reach10=32.8%  reach20=1.6%  dmgTaken/fight=7.45  rounds/fight=3.26  foeMiss=70.0%  casts(def/off)=0/0  potions/run=2.04  backstabs/run=10.04  flees/run=3.51
  Magic User  n=59  p50=6  reach5=68.6%  reach10=21.6%  reach20=2.0%  dmgTaken/fight=8.15  rounds/fight=3.00  foeMiss=66.4%  casts(def/off)=270/1412  potions/run=3.59  backstabs/run=0.00  flees/run=1.34

Outcome: 175 dead, 25 stuck (hit maxActions=20000; excluded from depth stats)
```

### Phase 75 — FINAL

```
  min=2  p50=7  p90=12  max=28

Reach table (% of runs reaching floor N):
  >=5: 78.2%  >=10: 23.6%  >=20: 1.1%  >=30: 0.0%  >=50: 0.0%

  mean death depth=7.54  floors gained p50=6 mean=6.54  encounters survived mean=16.32
  reach: >=5 78.2%  >=8 42.0%  >=9 35.6%  >=10 23.6%  >=13 9.8%  >=16 2.3%  >=20 1.1%

  reach-20: 1.0% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Fighter  n=69  p50=7  reach5=81.0%  reach10=25.4%  reach20=0.0%  dmgTaken/fight=11.91  rounds/fight=4.83  foeMiss=64.9%  casts(def/off)=0/0  potions/run=1.10  backstabs/run=0.00  flees/run=2.48
  Thief  n=72  p50=8  reach5=90.3%  reach10=27.4%  reach20=3.2%  dmgTaken/fight=7.40  rounds/fight=3.36  foeMiss=70.1%  casts(def/off)=0/0  potions/run=2.07  backstabs/run=10.19  flees/run=3.82
  Magic User  n=59  p50=6  reach5=59.2%  reach10=16.3%  reach20=0.0%  dmgTaken/fight=8.21  rounds/fight=3.30  foeMiss=65.2%  casts(def/off)=199/1214  potions/run=3.54  backstabs/run=0.00  flees/run=0.85

Outcome: 174 dead, 26 stuck (hit maxActions=20000; excluded from depth stats)
```

### Reading — the phase BEFORE → FINAL, against the depth-20 unicorn and the floor 5–7 average target

The whole-phase move, end to end: mean death depth 7.87→7.54 (−0.33), p50 held flat at 7 the entire way, reach-20 1.5%→1.0% (still inside the informational 1.0-2.0% unicorn band this ledger's own Phase 27 target table names — "the unicorn; the bot's number is a rarity floor"), and the per-floor-survival verdict is "all floors 1-12 inside the pass band" at both ends. Fighter and Thief both trend slightly EASIER (Fighter reach10 19.0%→25.4%, Thief reach20 1.6%→3.2%), while Magic User trends HARDER (reach5 68.6%→59.2%, reach10 21.6%→16.3%, reach20 2.0%→0.0%) — almost entirely the RULES-13 staff-inert cost measured in Plan 09's own reading above, since the Summoner-side RULES-03 changes (75-05/75-10) roughly cancel each other (an easier day-one offense spell against a harder healing spell) within the same 59-Magic-User pool.

**Against the depth-20 unicorn:** reach-20 stays inside the 1.0-2.0% band this ledger's Phase 27 target table already calls the unicorn rate — unchanged in kind (still rare, still celebrated, never expected) across the whole phase.

**Against the floor 5–7 average run ending:** p50 death depth is 7 at every single measurement point across all six plans and the whole-phase BEFORE/FINAL — never left the floor 5–7 band for even one plan. Mean death depth ranges 7.51-7.88 across the phase, sitting at or just above the top of that band throughout, consistent with the pre-Phase-75 baseline (mean 7.87) and never crossing meaningfully out of it. **No flag for the user is needed** — the average run ending held inside floors 5-7 (by p50) for the whole phase, and this plan does not retune any dial regardless.

## v2.1 Pilfer fumbles & scroll reading (Phase 75.1) — bot readouts

### Change under measurement

Two balance-moving Phase 75.1 plans, each committing its own before/after
readout independently (parallel waves never collided on this shared
ledger — this section consolidates them once, from the committed files):

- **75.1-01 (RULES-09):** the Pilfer's heal-only `useItem` refusal is
  replaced by a derived-stream d20 fumble risk on jewelry/cloaks/staves (a
  roll of 1 fails the use, blasts the Pilfer for an unsoaked d10 and dusts
  the item); the round-1 buff tier's Pilfer skip is removed from the bot, so
  a Pilfer now buffs like anyone.
- **75.1-06 (RULES-10):** `canRead` is gone — anyone may attempt any scroll.
  A Magic User and a Runes/Signs holder still read automatically; everyone
  else (including a Pilfer) rolls intelligence on its own derived stream,
  with a plain failure crumbling honestly and a fumble backfiring in combat
  or fizzling outside it. The bot now reads a carried scroll out of combat
  for EVERY class, not only a Magic User/Runes holder.

Plans 02–05, 07 and 09 (the fumble classification table, the foe-side and
reader-side fumble mechanics, the resolver, the reader's odds display, and
the hero-cannot-act combat-menu shell) are each either pure content,
presentation-only, or reachable ONLY through an in-combat scroll fumble —
and **the bot never reads a scroll in combat** (a flagged assumption this
phase's own CONTEXT.md states up front). None of those six plans can move a
bot readout by construction, so none records its own before/after here;
each one's own SUMMARY.md instead states "no readout exists yet" or
equivalent.

### Parameters

`node tools/tune-difficulty.mjs --seeds=200` (solo bot, `--start-depth=1`,
no `--party`) — the same command and dial set the Phase 72/73/75 sections
above use.

### Plan 01 (75.1) — BEFORE

```
Death-depth distribution:
  min=2  p50=7  p90=12  max=28

Reach table (% of runs reaching floor N):
  >=5: 78.2%  >=10: 23.6%  >=20: 1.1%  >=30: 0.0%  >=50: 0.0%

  mean death depth=7.54  floors gained p50=6 mean=6.54  encounters survived mean=16.32
  reach: >=5 78.2%  >=8 42.0%  >=9 35.6%  >=10 23.6%  >=13 9.8%  >=16 2.3%  >=20 1.1%

  reach-20: 1.0% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Fighter  n=69  p50=7  reach5=81.0%  reach10=25.4%  reach20=0.0%  dmgTaken/fight=11.91  rounds/fight=4.83  foeMiss=64.9%  casts(def/off)=0/0  potions/run=1.10  backstabs/run=0.00  flees/run=2.48
  Thief  n=72  p50=8  reach5=90.3%  reach10=27.4%  reach20=3.2%  dmgTaken/fight=7.40  rounds/fight=3.36  foeMiss=70.1%  casts(def/off)=0/0  potions/run=2.07  backstabs/run=10.19  flees/run=3.82
  Magic User  n=59  p50=6  reach5=59.2%  reach10=16.3%  reach20=0.0%  dmgTaken/fight=8.21  rounds/fight=3.30  foeMiss=65.2%  casts(def/off)=199/1214  potions/run=3.54  backstabs/run=0.00  flees/run=0.85

Outcome: 174 dead, 26 stuck (hit maxActions=20000; excluded from depth stats)
```

### Plan 01 (75.1) — AFTER

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=28

Reach table (% of runs reaching floor N):
  >=5: 78.3%  >=10: 24.0%  >=20: 1.1%  >=30: 0.0%  >=50: 0.0%

  mean death depth=7.65  floors gained p50=6 mean=6.65  encounters survived mean=16.53
  reach: >=5 78.3%  >=8 43.4%  >=9 37.1%  >=10 24.0%  >=13 10.3%  >=16 2.9%  >=20 1.1%

  reach-20: 1.0% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Fighter  n=69  p50=7  reach5=81.0%  reach10=25.4%  reach20=0.0%  dmgTaken/fight=11.91  rounds/fight=4.83  foeMiss=64.9%  casts(def/off)=0/0  potions/run=1.10  backstabs/run=0.00  flees/run=2.48
  Thief  n=72  p50=8  reach5=90.5%  reach10=28.6%  reach20=3.2%  dmgTaken/fight=7.56  rounds/fight=3.34  foeMiss=70.4%  casts(def/off)=0/0  potions/run=2.06  backstabs/run=10.67  flees/run=3.75
  Magic User  n=59  p50=6  reach5=59.2%  reach10=16.3%  reach20=0.0%  dmgTaken/fight=8.21  rounds/fight=3.30  foeMiss=65.2%  casts(def/off)=199/1214  potions/run=3.54  backstabs/run=0.00  flees/run=0.85

Outcome: 175 dead, 25 stuck (hit maxActions=20000; excluded from depth stats)
```

**Reading.** Mean death depth ticks up 7.54→7.65 (+0.11), entirely inside the
Thief pool (`dmgTaken/fight` 7.40→7.56, `backstabs/run` 10.19→10.67) — the
Pilfer's item uses now genuinely resolve (or fumble) instead of silently
no-opping. The AFTER death-cause breakdown's one new row ("fiddled with a
Cloak of Regeneration until it came apart", 1 of 200) confirms the mechanic
fired live in the sweep. Fighter and Magic User are byte-identical
(neither pool is touched by this rule). The per-floor-survival verdict is
unchanged ("all floors 1-12 inside the pass band"). Matches 75.1-01's own
SUMMARY: "a small, expected effect... well inside the readout's own
'informational proxy, not a gate' framing."

### Plan 06 (75.1) — BEFORE

```
Death-depth distribution:
  min=2  p50=7  p90=13  max=28

Reach table (% of runs reaching floor N):
  >=5: 78.3%  >=10: 24.0%  >=20: 1.1%  >=30: 0.0%  >=50: 0.0%

  mean death depth=7.65  floors gained p50=6 mean=6.65  encounters survived mean=16.53
  reach: >=5 78.3%  >=8 43.4%  >=9 37.1%  >=10 24.0%  >=13 10.3%  >=16 2.9%  >=20 1.1%

  reach-20: 1.0% (band 3.0-5.0%, reported — tail)
  verdict: all floors 1-12 inside the pass band

  Fighter  n=69  p50=7  reach5=81.0%  reach10=25.4%  reach20=0.0%  dmgTaken/fight=11.91  rounds/fight=4.83  foeMiss=64.9%  casts(def/off)=0/0  potions/run=1.10  backstabs/run=0.00  flees/run=2.48
  Thief  n=72  p50=8  reach5=90.5%  reach10=28.6%  reach20=3.2%  dmgTaken/fight=7.56  rounds/fight=3.34  foeMiss=70.4%  casts(def/off)=0/0  potions/run=2.06  backstabs/run=10.67  flees/run=3.75
  Magic User  n=59  p50=6  reach5=59.2%  reach10=16.3%  reach20=0.0%  dmgTaken/fight=8.21  rounds/fight=3.30  foeMiss=65.2%  casts(def/off)=199/1214  potions/run=3.54  backstabs/run=0.00  flees/run=0.85

Outcome: 175 dead, 25 stuck (hit maxActions=20000; excluded from depth stats)
```

### Plan 06 (75.1) — AFTER

```
Death-depth distribution:
  min=2  p50=7  p90=12  max=19

Reach table (% of runs reaching floor N):
  >=5: 78.5%  >=10: 25.4%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

  mean death depth=7.60  floors gained p50=6 mean=6.60  encounters survived mean=16.59
  reach: >=5 78.5%  >=8 48.0%  >=9 37.9%  >=10 25.4%  >=13 9.6%  >=16 1.7%  >=20 0.0%

  reach-20: 0.0% (band 3.0-5.0%, reported — tail)
  verdict: floors outside the pass band: 11 (dS -4.0)

  Fighter  n=69  p50=8  reach5=85.9%  reach10=29.7%  reach20=0.0%  dmgTaken/fight=11.88  rounds/fight=4.64  foeMiss=64.8%  casts(def/off)=0/0  potions/run=1.14  backstabs/run=0.00  flees/run=2.64
  Thief  n=72  p50=8  reach5=85.9%  reach10=28.1%  reach20=0.0%  dmgTaken/fight=7.62  rounds/fight=3.40  foeMiss=70.0%  casts(def/off)=0/0  potions/run=1.99  backstabs/run=9.64  flees/run=3.54
  Magic User  n=59  p50=6  reach5=59.2%  reach10=16.3%  reach20=0.0%  dmgTaken/fight=8.21  rounds/fight=3.30  foeMiss=65.2%  casts(def/off)=199/1214  potions/run=3.54  backstabs/run=0.00  flees/run=0.85

Outcome: 177 dead, 23 stuck (hit maxActions=20000; excluded from depth stats)
```

**Reading.** This is the phase's one measurable move: mean death depth ticks
DOWN 7.65→7.60, reach-20 1.1%→0.0%, and `Outcome` moves 175/25→177/23
dead/stuck. Fighter's own numbers move EASIER (reach5 81.0%→85.9%, reach10
25.4%→29.7% — a Fighter reading a carried scroll out of combat for the
first time occasionally nets a free useful cast), while Thief moves HARDER
in the tail (reach20 3.2%→0.0%) even though its early reach5/reach10 both
tick up too — a small-sample tail swing (a 200-seed reach-20 count moves by
single digits either way). The per-floor-survival verdict moves from "all
floors 1-12 inside the pass band" to one genuine MISS at **L=11**
(`dS -4.0`, on a 31-reached/6-death sample). Matches 75.1-06's own SUMMARY,
which already logged this exact MISS as "a small-sample swing on a purely
informational proxy... not a tuning regression this plan is responsible
for correcting."

### Phase 75.1 — FINAL

```
Death-depth distribution:
  min=2  p50=7  p90=12  max=19

Reach table (% of runs reaching floor N):
  >=5: 78.5%  >=10: 25.4%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

  mean death depth=7.60  floors gained p50=6 mean=6.60  encounters survived mean=16.59
  reach: >=5 78.5%  >=8 48.0%  >=9 37.9%  >=10 25.4%  >=13 9.6%  >=16 1.7%  >=20 0.0%

  reach-20: 0.0% (band 3.0-5.0%, reported — tail)
  verdict: floors outside the pass band: 11 (dS -4.0)

  Fighter  n=69  p50=8  reach5=85.9%  reach10=29.7%  reach20=0.0%  dmgTaken/fight=11.88  rounds/fight=4.64  foeMiss=64.8%  casts(def/off)=0/0  potions/run=1.14  backstabs/run=0.00  flees/run=2.64
  Thief  n=72  p50=8  reach5=85.9%  reach10=28.1%  reach20=0.0%  dmgTaken/fight=7.62  rounds/fight=3.40  foeMiss=70.0%  casts(def/off)=0/0  potions/run=1.99  backstabs/run=9.64  flees/run=3.54
  Magic User  n=59  p50=6  reach5=59.2%  reach10=16.3%  reach20=0.0%  dmgTaken/fight=8.21  rounds/fight=3.30  foeMiss=65.2%  casts(def/off)=199/1214  potions/run=3.54  backstabs/run=0.00  flees/run=0.85

Outcome: 177 dead, 23 stuck (hit maxActions=20000; excluded from depth stats)
```

**Reading — the phase BEFORE → FINAL, against the depth-20 unicorn and the
floor 5–7 average target.** The whole-phase move, end to end: mean death
depth 7.54→7.60 (+0.06, noise-level across the two plans' opposing nudges),
p50 held flat at 7 the entire way, reach-20 1.0%→0.0% (still a tail
statistic at n=200 — one fewer run out of 200 reaching floor 20). The FINAL
readout is BYTE-IDENTICAL to Plan 06's own AFTER block above — confirmed by
direct comparison of the two committed files — because no plan landing
after 75.1-06 (the fumble table, the foe/reader-side mechanics, the
resolver, the odds display, the hero-cannot-act shell) changes anything the
bot's own decision policy or the engine's non-combat-fumble path can reach;
the fumble effects themselves (75.1-02 through 75.1-05) never fire in a bot
readout at all, since the bot never reads a scroll in combat.

**Against the depth-20 unicorn:** reach-20 moves 1.0%→0.0% across the
phase — still read as a tail/rarity statistic (single-digit run counts at
n=200), not a meaningful departure from the informational 1.0-2.0% unicorn
band this ledger's own Phase 27 target table names.

**Against the floor 5–7 average run ending:** p50 death depth is 7 at every
single measurement point across both plans and the whole-phase BEFORE/FINAL
— never left the floor 5–7 band. Mean death depth ranges 7.54-7.65 across
the phase, sitting just above the top of that band throughout, consistent
with the pre-Phase-75.1 baseline and never crossing meaningfully out of it.

**Flag for the user.** The per-floor-survival verdict's floor-11 MISS
(`dS -4.0`, `reached=31`, `deaths=6`) introduced by 75.1-06's AFTER readout
is still present, unchanged, in this phase's own FINAL readout — it is a
genuine, reproducible band failure at this commit, not a transient artifact
that a later plan happened to fix. Per the checkpointed fit protocol and
this plan's own flagged assumption ("readings are recorded, not acted
on"), **this plan does not retune any dial to correct it** — the
per-floor-survival target band itself is a proxy the user has ruled on
before (no compensation ruling exists for a single-floor, small-sample
MISS), and correcting it is an engine-change decision reserved for the
user, not something an executor infers from one readout. Every other floor
(1-10, 12-19) stays inside its own target band at both BEFORE and FINAL.

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

**Landed form: C (recommended).** Dante is moved to the END of Humans tier
2 (stats and note byte-identical: `sz H, i 12, wp 20, sp.atk 3, "twins, four
arms: three strikes a round"`); the new tier-1 Humans row is `Ned`: `{ n:
"Ned", sz: "H", i: 8, wp: 8, sp: { note: "a bandit: one knife, one grudge,
no plan" } }`.

**Decision-rule sim (executor's own scratch sim, `newRun(seed) ->
startCombat(state, false, TYPE, rng, []) -> playerStrike` until resolution
or death, cap 200 strikes, seeds 1..2000):**

| | Floor-1 death rate |
|---|---|
| Canon (Dante, tier 1) | 61.57 % |
| Landed (Ned, tier 1) | **14.73 %** |
| Demons (reference, next-deadliest tier-1 type) | 25.72 % |

The rule (landed form must bring the floor-1 Humans death rate to <= the
Demons reference) is met with 11 points to spare.

**Yardstick rows (canon mode, `tools/bestiary-yardstick.mjs`):**

| Creature | Tier | wp | TTK | xTTKmed | RTD | xLethal | Flag |
|---|---|---|---|---|---|---|---|
| Ned | T1 Humans | 8.00 | 5.62 | 1.60x | 30.89 | 1.00 | (unflagged) |
| Dante | T2 Humans | 20.00 | 5.52 | 1.67x | 4.11 | 2.65 | over-tier |

Tier medians are UNCHANGED (T1 med TTK=3.51 RTD=30.89; T2 med TTK=3.31
RTD=10.87) — Dante keeps its `over-tier` flag one tier deeper (was 4.00x/
RTD 3.00x at T1; now 1.67x/lethality 2.65x at T2), consistent with "keeps
Dante recognisably Dante, just no longer punching three tiers down."

**Parity record (the phase's only declared divergence — seed 303,
`parley` scenario, `test/parity/fixtures/action-script.combat.json`):**

```
kind: "action-path", fromAction: 0
fields: ["wp", "sp", "gold", "kills", "rations"]
before (prototype, Dante x2): { wp: 40, sp: 13, gold: 250, kills: 0, rations: 5 }
after  (engine, Ned x2):      { wp: 40, sp: 7,  gold: 50,  kills: 0, rations: 5 }
stateFields: ["dead"] — before/after both false
```

Full per-action table, rationale, and the four pre-enumerated escalation
records (hazard-from-1, darkness-from-4, rations+N, floor-1 grace) live in
`test/parity/FIXTURE-INVENTORY.md`'s "## Phase 27 early-floor divergences
(TUNE-06)" section. `node --test "test/parity/**/*.test.js"`: 33/33, with
this the ONLY divergence.

**Re-measured pins (file: old -> new, cause):**

| File | Pin | Old | New | Cause |
|---|---|---|---|---|
| `test/unit/content-tables.test.js` | Humans tier lengths | `[1,2,2,2,1]` | `[1,3,2,2,1]` | Dante appended to tier 2 |
| `test/unit/content-tables.test.js` | total rows | 53 | 54 | Ned added |
| `test/unit/content-tables.test.js` | rows without abilities | 45 | 46 | Ned (no kit) added |
| `test/unit/bestiary-yardstick.test.js` | `rows.length` | 53 | 54 | Ned added |
| `test/unit/bestiary-yardstick.test.js` | tier-1 fixture filter | `Dante` (wp 20) | `Ned` (wp 8) | Dante no longer tier 1 |
| `test/unit/foe-turn-draw-count.test.js` | `FULL_FIGHTS[303]` | `["Dante","Dante"]`, 66 draws, 6 attacks, won | `["Ned","Ned"]`, 66 draws (unchanged), 10 attacks, won | seed 303 now rolls Ned |
| `test/unit/parley.test.js` | Test 14 foe name | `Dante` | `Ned` | same seed, new tier-1 roll; dice/need/sp/gold unchanged |
| `test/determinism/foe-abilities.test.js` | `humans-t2` seed | 1 (Dante x2, no Krupke) | 3 (Krupke) | tier-2 `rng.pick` roster grew — re-measured TWICE: once here for the Dante move (Krupke x1, 17 draws, 1 attack, won), once more in Task 3 for foe grace (wp 17->13, dmgBonus -1, draws/attacks unchanged) |
| `test/parity/fixture-inventory.test.js` | FID-01 roster/names | `Humans:Dante`, wp 20 x2 | `Humans:Ned`, wp 8 x2 | seed 303 rolls Ned |

The other four determinism specs (`magical-t4`, `demons-t5`,
`walking-dead-t5`, `beasts-t5`) were confirmed byte-unchanged by the Dante
move (only `humans-t2`'s tier-2 roster grew).

### Change table (27-02 / 27-03)

| Knob | File | Before (Phase 26 AFTER, pin d1e3235) | After (final, pin 39bfecf) | Rationale | Record |
|---|---|---|---|---|---|
| `COMBAT_SCALE_FROM_DEPTH` | engine/difficulty.js | 6 | 21 | forced-20 band: identity-from-6 gave depth 20 only 1.3 encounters survived / 0.14 floors gained; pushing identity through depth 20 entirely is the calibrated ceiling of this dial | 27-03 iterations 1-2, parity-clean |
| `FOE_CAP_MAX` | engine/difficulty.js | 5 | 4 | paired with COMBAT_SCALE_FROM_DEPTH's move — a smaller foes-per-encounter ceiling so the softened deep band isn't also facing more bodies | 27-03 iteration 1, parity-clean |
| `FOE_CAP_SOFT_K` | engine/difficulty.js | 20 | 20 (unchanged) | tried-and-kept — no change needed once FOE_CAP_MAX moved | unchanged |
| `FOE_POWER_MAX` | engine/difficulty.js | 1.6 | 1.15 | iteration 1 (1.6->1.3) paired with the COMBAT_SCALE_FROM_DEPTH move; iteration 4 (1.3->1.15) flattens the post-20 ramp further after floors-gained still missed | 27-03 iterations 1 and 4, parity-clean |
| `FOE_POWER_SOFT_K` | engine/difficulty.js | 35 | 35 (unchanged) | same K, gentler MAX already softens the curve | unchanged |
| `ABILITY_THREAT_MAX` | engine/difficulty.js | 2.0 | 1.3 | iteration 1 (2.0->1.5) paired with the COMBAT_SCALE_FROM_DEPTH move; iteration 4 (1.5->1.3) same rationale as FOE_POWER_MAX | 27-03 iterations 1 and 4, parity-clean |
| `ABILITY_THREAT_SOFT_K` | engine/difficulty.js | 30 | 30 (unchanged) | same K, gentler MAX already softens the curve | unchanged |
| `FOE_LVL_BIAS` | engine/difficulty.js | 0 | 0 (unchanged, reserved) | not needed this retune | unchanged |
| `DENSITY_CANON_THROUGH_DEPTH` | engine/difficulty.js | — (new) | 2 | structural-identity gate so floors 1-2 reproduce the canon `9+depth` dot formula by construction | 27-02, parity-clean |
| `ENCOUNTER_DOT_CAP` | engine/difficulty.js | 24 | 13 | 27-02 (24->15): smaller ceiling for the widened early-floor easing; 27-03 iteration 3 (15->13): forced-20 floors-gained still missed after the deep-dial moves — fewer encounter triggers per floor from depth 3 on gives more of the bot's action budget to descending | 27-02 + 27-03 iteration 3, parity-clean (no fixture reaches depth 3+) |
| `ENCOUNTER_DOT_SOFT_K` | engine/difficulty.js | 12 | 12 (unchanged) | tried-and-kept | unchanged |
| `ENCOUNTER_DOT_BASE` | engine/difficulty.js | 9 | 9 (unchanged, canon literal) | matches the prototype's original `9` | unchanged |
| `DARK_BLOB_CAP` | engine/difficulty.js | 6 | 3 | fewer dark-zone seed blobs at the eased depths | 27-02, parity-clean |
| `DARK_RADIUS_CAP` | engine/difficulty.js | 9 | 7 | smaller per-blob reveal radius ceiling at the eased depths | 27-02, parity-clean |
| `DARK_RADIUS_BASE` | engine/difficulty.js | 3 | 3 (unchanged, canon literal) | matches the prototype's original `3` | unchanged |
| `DARK_HOLD_THROUGH_DEPTH` | engine/difficulty.js | — (new) | 3 | landed form (darkness holds its floor-2 canon blob count through depth 3, then resumes growth) — the parity-clean form; the from-floor-4 form (`DARK_FROM_DEPTH`) was considered but NOT taken (see "Not changed, and why") | 27-02, parity-clean; movement fixture seed 256 confirmed byte-unchanged |
| `BREATHER_EVERY` | engine/difficulty.js | 5 | 5 (unchanged) | not part of this retune | unchanged |
| `FOE_GRACE_AT_1` | engine/difficulty.js | — (new) | 1.0 (canon, unchanged this plan) | floor 1 stays exactly canon — the structural guarantee that Dante->Ned is the only parity divergence | 27-02, MUST stay 1.0 |
| `FOE_GRACE_AT_2` | engine/difficulty.js | — (new) | 0.5 | 27-02 landed 0.75; 27-03 iteration 2 took the ladder's second notch (0.75->0.5) — the natural median was still 3 (< the target 4) after iteration 1's deep-dial-only move; this notch alone reached the target (median 4, reach>=5 25.9-29.0%) | 27-02 (0.75) + 27-03 iteration 2 (0.5), parity-clean; `humans-t2`/`magical-t4` determinism pins re-measured live, no draws/attacks/outcome changed |
| `FOE_GRACE_CANON_FROM_DEPTH` | engine/difficulty.js | — (new) | 5 (unchanged this plan) | the grace band's canon floor | 27-02 |
| `HAZARD_FROM_DEPTH` | engine/difficulty.js | — (new) | 2 (unchanged this plan) | floor 1 stays canon; the ladder's cap explicitly excludes the from-floor-1 rung this plan | 27-02; NOT escalated (available, not taken) |
| `HAZARD_SCALE_AT_START` | engine/difficulty.js | — (new) | 0.5 (unchanged this plan) | landed value held; not re-tuned this plan | 27-02 |
| `HAZARD_FLAT_THROUGH_DEPTH` | engine/difficulty.js | — (new) | 3 (unchanged this plan) | landed value held | 27-02 |
| `HAZARD_CANON_FROM_DEPTH` | engine/difficulty.js | — (new) | 5 (unchanged this plan) | landed value held | 27-02 |
| `STARTING_RATIONS_BONUS` | engine/character.js | — (never added) | 0 (rung not taken) | the ladder cap (orchestrator decision, context commit `4d18e80`) explicitly excludes the rations rung regardless of what the smoke reads | NOT taken (available, not taken) |
| Dante (bestiary) | content/bestiary.js | tier 1 Humans, `wp 20, sp.atk 3` | tier 2 Humans, byte-identical stats/note | 27-02's landed decision (Form C) — unchanged by this plan | 27-02, declared divergence (seed 303) |
| Ned (bestiary) | content/bestiary.js | — (did not exist) | tier 1 Humans, `wp 8`, one swing a round | 27-02's landed decision — unchanged by this plan | 27-02, declared divergence (seed 303) |

**Curve at 1..5 / 10 / 15 / 20 / 35 / 50 (final, pin 39bfecf)** — dots / darkBlobs / darkRadius / foePower / hazardScale / foeCap / abilityThreat:

| d | dots | darkBlobs | darkRadius | foePower | hazardScale | foeCap | abilityThreat |
|---|---|---|---|---|---|---|---|
| 1 | 10 | 0 | 4 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 |
| 2 | 11 | 1 | 5 | 0.5000 | 0.5000 | 3 | 1.0000 |
| 3 | 11 | 1 | 6 | 0.6667 | 0.5000 | 3 | 1.0000 |
| 4 | 11 | 2 | 7 | 0.8333 | 0.7500 | 3 | 1.0000 |
| 5 | 11 | 3 | 7 | 1.0000 (exact) | 1.0000 (exact) | 3 | 1.0000 |
| 10 | 12 | 3 | 7 | 1.0000 | 1.0000 | 3 | 1.0000 |
| 15 | 12 | 3 | 7 | 1.0000 | 1.0000 | 3 | 1.0000 |
| 20 | 13 | 3 | 7 | 1.0000 (exact) | 1.0000 | 3 | 1.0000 (exact) |
| 35 | 13 | 3 | 7 | 1.0523 | 1.0000 | 4 | 1.1180 |
| 50 | 13 | 3 | 7 | 1.0863 | 1.0000 | 4 | 1.1896 |

### Iteration log

**Iteration 0 (27-02) — Dante demotion + the parity-clean early-floor set;
deep combat dials untouched.**

Constants landed this iteration (`engine/difficulty.js`):

| Constant | Old | New |
|---|---|---|
| `ENCOUNTER_DOT_CAP` | 24 | 15 |
| `DARK_BLOB_CAP` | 6 | 3 |
| `DARK_RADIUS_CAP` | 9 | 7 |
| `DENSITY_CANON_THROUGH_DEPTH` | — (new) | 2 |
| `DARK_HOLD_THROUGH_DEPTH` | — (new) | 3 |
| `FOE_GRACE_AT_2` | — (new) | 0.75 |
| `FOE_GRACE_CANON_FROM_DEPTH` | — (new) | 5 |
| `FOE_GRACE_AT_1` | — (new) | 1.0 (canon) |
| `HAZARD_FROM_DEPTH` | — (new) | 2 |
| `HAZARD_SCALE_AT_START` | — (new) | 0.5 |
| `HAZARD_FLAT_THROUGH_DEPTH` | — (new) | 3 |
| `HAZARD_CANON_FROM_DEPTH` | — (new) | 5 |

Combat dials (`COMBAT_SCALE_FROM_DEPTH` 6, `FOE_CAP_MAX` 5, `FOE_POWER_MAX`
1.6, `ABILITY_THREAT_MAX` 2.0) are the 21-04 values, untouched.

**Curve table** (`difficultyCurve(d)`, dots / darkBlobs / darkRadius /
foePower / hazardScale / foeCap / abilityThreat):

| d | dots | darkBlobs | darkRadius | foePower | hazardScale | foeCap | abilityThreat |
|---|---|---|---|---|---|---|---|
| 1 | 10 | 0 | 4 | 1 (exact) | 1 (exact) | 3 | 1 |
| 2 | 11 | 1 | 5 | 0.75 | 0.5 | 3 | 1 |
| 3 | 11 | 1 | 6 | 0.8333 | 0.5 | 3 | 1 |
| 4 | 12 | 2 | 7 | 0.9167 | 0.75 | 3 | 1 |
| 5 | 12 | 3 | 7 | 1 (exact) | 1 (exact) | 3 | 1 |
| 10 | 13 | 3 | 7 | 1.0799 | 1 | 3 | 1.1535 |
| 20 | 14 | 3 | 7 | 1.2091 | 1 | 4 | 1.3935 |
| 35 | 15 | 3 | 7 | 1.3454 | 1 | 5 | 1.6321 |
| 50 | 15 | 3 | 7 | 1.4341 | 1 | 5 | 1.7769 |

**Iteration-0 smoke readout** (`tools/tune-classes.mjs --seeds 3 --workers 4
--max-actions 5000`, 143 x 3 pooled; `tools/tune-difficulty.mjs
--seeds=200`; all read via `rollups.pooled` / the tune-difficulty text
report — directional only, per the iteration protocol above):

*Natural (`rollups.pooled`, n=429):* meanDepth 3.56, **p50Depth 3**, p90Depth
6, **reach5 23.3 %**, reach10 0.9 %, reach20 0 %, meanFloorsGained 2.56 /
p50 2, meanEncountersSurvived 8.83. Top causes: starved in the dark (53),
undone by a trap (31), cut down by a Poltergeist (30) — **"cut down by a
Dante" no longer appears in the pooled top 3** (it was the #1 Phase-26
cause at scale, 724 tallies).

*Forced start at 20 (`rollups.pooled`, n=429):* meanDepth 20.37 (p50 20,
p90 21 — the harness always starts at 20, so these confirm the dev-start
clamp), reach5/10/20 all 100 % (trivially true — the run already starts at
20), **meanEncountersSurvived 1.56**, **meanFloorsGained 0.37 / p50
FloorsGained 0**. Top causes at 20: cut down by a Drarl (102), a Herman
(99), a Stalka Beast (49) — canon tier-4/5 Humans/Lair-Beasts bodies, not
the eased early-floor mechanics (expected: this band is owned by the deep
combat dials, untouched this plan).

*`tune-difficulty --seeds=200` (natural, single-run cause table, a
DIFFERENT 200-seed sample than the pooled 429 above):* Death-depth
min=1 p50=3 p90=6 max=10. Reach table: >=5 28.0 %, >=10 1.0 %, >=20/30/50
0.0 %. Top 5 causes: Werebeast 18 (9.0 %), Poltergeist 15 (7.5 %), "spent
by the dungeon itself" 13 (6.5 %), Dante 12 (6.0 %, tied with "starved in
the dark" and "fell off a wall"). Parley: 322 attempts, 66.5 % success
rate, 3.1 % of total SP. Cannot-act: not measured this iteration (smoke
only; the full gate runs on the eventual retune AFTER).

**Honest note on Dante's residual presence:** the sim/pooled readouts show
Dante's floor-1 spike is gone (not in the pooled top 3 of 429 runs), but
this 200-seed tune-difficulty sample still shows 12 Dante deaths (6.0 %) —
Dante is now a TIER-2 creature, reachable by any level-2+ hero on floor 2+
(and, per its yardstick row, still `over-tier` there by design — "twins,
four arms" stays a real threat one tier deeper, just no longer a floor-1
ambush for a level-1 character). This is the intended outcome of Form C,
not a residual bug.

**What moved vs. the Phase 26 AFTER (BEFORE-by-reference above):** pooled
reach >= 5 17.2 % -> 23.3 % (+6.1 pts, still short of the amended 25 %
target — expected, see the planner calibration note above); pooled reach
>= 10 0.3 % -> 0.9 %; forced-20 meanEncountersSurvived 1.32 -> 1.56;
forced-20 meanFloorsGained 0.14 -> 0.37 (p50 FloorsGained stays 0). Median
death depth stays 3 (natural pooled p50Depth 3, tune-difficulty p50 3) —
the amended band's "bot median 4" row is NOT yet reached at this smoke
scale; per the target band's own note, the widened-lever ladder's
calibrated CEILING is bot median 4 / reach>=5 ≈ 35 %, so 27-03's job is to
confirm this reading at full scale and escalate only as far as the smoke
justifies, recording a miss/near-miss honestly if the ceiling is not
enough.

#### Planner calibration (2026-09-15, directional)

Copied verbatim from this plan's `<early_floor_levers>` table (each lever
added on top of S0 = Dante Form C + dots cap 15 / dark 3/7 + the 27-03 deep-
dial start values; matrix reach5/mu is the 143 x 3 pooled readout, td200 is
`tune-difficulty --seeds=200`):

| Set | reach5 (matrix) | mu | td200 p50 / reach5 |
|---|---|---|---|
| S0: Dante + dots 15 / dark 3-7 + deep-dial start values | 17.0 % | 3.24 | 3 / 24.0 % |
| S0 + grace 0.75 (2-4) | 22.8 % | 3.48 | 3 / 23.0 % |
| S0 + darkness from 4 | 21.7 % | 3.39 | 3 / 23.5 % |
| S0 + hazard 0.5 on floors 1-3 (0.75 at 4) | 24.0 % | 3.51 | 4 / 31.5 % |
| S0 + grace 0.75 + darkness from 4 | 25.9 % | 3.58 | 4 / 28.5 % |
| S0 + grace 0.75 + darkness held through 3 | 18.4 % | 3.32 | 3 / 20.0 % |
| T1: S0 + hazard from floor 2 (1 / 0.5 / 0.5 / 0.75) | 22.4 % | 3.44 | 4 / 29.5 % |
| T2: S0 + grace 0.5 (0.5 / 0.65 / 0.85) + hold through 3 + hazard from 2 — the strongest parity-clean set | 24.7 % | 3.60 | 4 / 27.5 % |
| T3: T2 + starting rations +2 | 30.8 % | 3.76 | 4 / 31.5 % |
| T4: grace 0.5 + darkness from 4 + hazard from floor 1 + rations +2 (every rung but floor-1 grace) | 35.4 % | 3.96 | 4 / 36.0 % |
| T5: T4 + floor-1 grace 0.85 (last resort) | 34.7 % | 4.00 | 4 / 34.0 % |

**Reading:** each lever adds ≈ 3-7 points of reach5 and the FULL ladder —
every rung including the last resort — tops out near 35 % reach5 (bot
median 4, mean ≈ 4.0); floor-1 grace adds nothing measurable once Dante is
gone (its spike WAS Dante). This plan lands the set actually specified in
Task 3 (grace 0.75 at floors 2-4 + darkness held through 3 + hazard ramp
from floor 2 at 0.5) — a slightly milder grace than the T2 row's 0.5, so
this iteration's OWN measured smoke (23.3 % pooled reach5, td200 28.0 %)
is the number of record for what actually landed, not a table lookup.

**What to turn next:** iteration 1 (27-03) confirms this set at full scale
(143 x 40 natural, 143 x 10 forced-20), then escalates in the user's order
only while the smoke median is < 5 — grace deeper (`FOE_GRACE_AT_2` 0.75 ->
0.5) -> darkness from 4 (movement record) -> hazard from floor 1
(encounters record) -> rations +1/+2 (14 chargen records) -> floor-1 grace
0.85 (last resort) — and turns the deep ramp (`COMBAT_SCALE_FROM_DEPTH` 16,
`FOE_CAP_MAX` 4, `FOE_POWER_MAX` 1.3, `ABILITY_THREAT_MAX` 1.5) for the
forced-20 band in parallel.

**Orchestrator ladder cap (2026-09-15, context commit `4d18e80`):** 27-03
climbs ONLY the parity-clean rungs — foe grace at floors 2-4 may take its
notches (0.75 -> 0.5 -> 0.35; floor 1 stays exactly 1.0), plus the deep
dials, dots/darkness caps, and hazard ramp VALUES from floor 2 (not
`HAZARD_FROM_DEPTH` itself). The rations rung, the hazard-from-floor-1
rung, the darkness-from-4 rung and the floor-1-grace rung are NOT taken
this plan regardless of what the smoke reads — recorded under "Not
changed, and why" below as "available, not taken" with the planner's
calibration numbers. Because none of the rungs actually turned this plan
touch a fixture, parity stays 33/33 with the same single declared
divergence (seed 303, Dante -> Ned) throughout every iteration below — no
new divergence record was needed.

**Iteration 1 (27-03)** — rung turned: none (confirms 27-02's landed
parity-clean set at full smoke scale); deep dials: set to the planner's
iteration-1 start values (`COMBAT_SCALE_FROM_DEPTH` 6 -> 16,
`FOE_CAP_MAX` 5 -> 4, `FOE_POWER_MAX` 1.6 -> 1.3, `ABILITY_THREAT_MAX`
2.0 -> 1.5; the three `*_SOFT_K` siblings unchanged). Constants: early-floor
levers unchanged from iteration 0 (`FOE_GRACE_AT_2` 0.75, `HAZARD_FROM_DEPTH`
2, `HAZARD_SCALE_AT_START` 0.5, `DARK_HOLD_THROUGH_DEPTH` 3,
`ENCOUNTER_DOT_CAP` 15). Curve at d=20/35/50: foePower 1.0399/1.3454/1.4341,
abilityThreat 1.3935/1.6321/1.7769, foeCap 4/5/5 (matches the planner's
calibration almost exactly at these start values). Smoke (143 x 3 pooled,
n=429; `tools/tune-difficulty.mjs --seeds=200`): natural p50Depth **3**
(OUT — target exactly 4), reach5 23.3 % (OUT — target >= 25 %), reach20
0.0 % (OUT — target 1.0-2.0 %, but 0.2 % resolution at this scale); forced-20
meanEncountersSurvived **2.85** (OUT — target 3.0-5.0), meanFloorsGained
**0.78** / p50FloorsGained **0** (OUT — target mean 1.0-2.0, p50 >= 1).
What moved vs iteration 0: forced-20 meanEncountersSurvived 1.56 -> 2.85,
meanFloorsGained 0.37 -> 0.78 (deep-dial softening working as calibrated);
natural median/reach5 unchanged (deep dials don't touch depths <= 15).
What to turn next: natural median still short of 4 -> turn ladder rung 1
(`FOE_GRACE_AT_2` deeper, parity-clean, permitted by the ladder cap);
forced-20 still short on all three sub-rows, priority is the user's actual
complaint -> turn `COMBAT_SCALE_FROM_DEPTH` up (option 1 of the miss table)
to push depth 20 fully into identity.

**Iteration 2 (27-03)** — rung turned: 1, notch 2 (`FOE_GRACE_AT_2`
0.75 -> 0.5 — parity-clean, floor 1 stays exactly `FOE_GRACE_AT_1` 1.0;
`humans-t2`/`magical-t4` determinism pins re-measured live, no draws/
attacks/outcome changed at either depth); deep dials: `COMBAT_SCALE_FROM_DEPTH`
16 -> 21 (depth 20 is now fully canon combat identity — the calibrated
ceiling of what these dials alone can give that depth). Constants: as
iteration 1 plus the two moves above. Curve at d=20/35/50: foePower
1.0000/1.1046/1.1727, abilityThreat 1.0000/1.1967/1.3161, foeCap 3/4/4 (depth
20 is now exact identity by construction). Smoke: natural p50Depth **4**
(**IN** — hits the target exactly), reach5 25.9 % pooled / 29.0 % td200
(**IN** — both clear the >= 25 % edge), reach20 0.0 % pooled / 2.0 % td200
(directional; OUT at pooled resolution, borderline-high at td200 — noise at
this scale); forced-20 meanEncountersSurvived **2.87** (OUT, but within
noise of the 3.0 edge), meanFloorsGained **0.76** / p50FloorsGained **0**
(OUT). What moved vs iteration 1: natural median 3 -> 4, reach5 23.3 % ->
25.9 % (rung 1 alone crossed both natural band rows); forced-20 barely
moved (meanEncountersSurvived 2.85 -> 2.87 — pushing identity through depth
20 mostly helped iteration 1's earlier move already; this iteration's
COMBAT_SCALE_FROM_DEPTH change mattered more for isolating depth 20 as a
clean baseline than for moving the number further). What to turn next: the
natural row is now IN BAND — no further early-floor rung is needed (rung 1
notch 3, 0.5 -> 0.35, stays available but unused, per "back off/stop once
in band"); forced-20 still misses on all three sub-rows -> turn the next
miss-table option: `ENCOUNTER_DOT_CAP` down by 2 (fewer encounter triggers
per floor from depth 3 on, more of the bot's action budget spent
descending instead of fighting).

**Iteration 3 (27-03)** — rung turned: none this iteration (the natural
row stays in band with iteration 2's landed rung 1; no further early-floor
escalation needed); deep dials: `ENCOUNTER_DOT_CAP` 15 -> 13 (miss-table
option 2 for the forced-20 band — parity-clean, no fixture reaches depth
3+; depths 4-5's dots drop 12 -> 11, re-measured live in
`test/unit/maze.test.js`/`combat-scaling.test.js`/`difficulty.test.js`).
Curve dots at d=4/5/10/20/35/50: 11/11/12/13/13/13 (was 12/12/13/14/15/15).
Smoke: natural p50Depth **4** (**IN**), reach5 26.8 % pooled / 28.5 % td200
(**IN**), reach20 0.0 % pooled / **1.0 %** td200 (directional; the td200
reading now sits inside the 1.0-2.0 % target, pooled 429 is still 0 % —
resolution noise, the full AFTER decides); forced-20
meanEncountersSurvived **3.24** (**IN** — clears the 3.0 edge),
meanFloorsGained **0.83** / p50FloorsGained **0** (OUT — closer to the 1.0
mean edge but still short, p50 still 0). What moved vs iteration 2:
forced-20 meanEncountersSurvived 2.87 -> 3.24 (now in band), meanFloorsGained
0.76 -> 0.83; reach20 (td200) 2.0 % -> 1.0 % (still in the target corridor,
noise); natural unchanged (dot-cap easing at depth 3+ barely touches the
natural pooled numbers, which are dominated by depths <= 5). What to turn
next: encounters-survived is now in band; floors-gained still misses on
both sub-rows -> the forced-20 top causes (Herman/Drarl/Vampire, all
canon tier-4/5 combat, no "starved in the dark" in the top 3) rule out the
dark-cap option (miss-table option 3 is conditioned on that cause
appearing); turn option 4 instead — `FOE_POWER_MAX`/`ABILITY_THREAT_MAX`
down, now that `COMBAT_SCALE_FROM_DEPTH` is >= 21 — to flatten the ramp a
level-5 hero faces immediately past depth 20, giving the post-20 floors a
better chance to be gained at all.

**Iteration 4 (27-03)** — rung turned: none (natural stays in band); deep
dials: `FOE_POWER_MAX` 1.3 -> 1.15, `ABILITY_THREAT_MAX` 1.5 -> 1.3 (paired
move, miss-table option 4). Curve at d=20/25/30/35/50: foePower
1.0000/1.0200/1.0373/1.0523/1.0863, abilityThreat
1.0000/1.0461/1.0850/1.1180/1.1896, foeCap 3/3/3/4/4 (a visibly flatter
ramp than iteration 3's). Smoke: natural unchanged (p50Depth 4, reach5
26.8 %/28.5 %, both **IN** — this move doesn't touch depths <= 15);
forced-20 meanEncountersSurvived **3.35** (**IN**), meanFloorsGained
**0.87** / p50FloorsGained **0** (OUT — inched up from 0.83 but still short
of the 1.0 mean edge and the p50 >= 1 edge); reach20 0.0 % pooled / 1.0 %
td200 (unchanged, still directional). What moved vs iteration 3:
meanEncountersSurvived 3.24 -> 3.35, meanFloorsGained 0.83 -> 0.87 — a real
but small gain; the deep-ramp softening is now well past the point of
diminishing returns for this metric within the sanctioned dial set (the
remaining floors-gained shortfall is dominated by canon tier-4/5 combat
lethality just past depth 20, not by the *_MAX/*_SOFT_K dials, which are
already close to their BASE values through the 21-30 range).

**STOP: iteration cap reached (4 of 4) — proceeding to the full AFTER.**
Final readout at this smoke scale: natural median death depth **IN band**
(p50 4, reach >= 5 26.8-29.0 %, both clearing their edges); reach >= 20
**directional, likely in band** (td200 1.0 %, pooled 0 % — resolution
noise at 429/200 runs, the 40-seed x 143-cell full AFTER has ~17x finer
resolution and decides); forced-20 encounters survived **IN band** (3.24-3.35
across iterations 3-4); forced-20 floors gained **RECORDED AS A MISS** —
mean 0.87 (target 1.0-2.0) and p50 0 (target >= 1) both fall short after
every sanctioned lever available to this plan (COMBAT_SCALE_FROM_DEPTH
pushed through depth 20, ENCOUNTER_DOT_CAP eased, FOE_POWER_MAX/
ABILITY_THREAT_MAX flattened) — handed to the DR round (TUNE-07, 27-04)
with the ladder's ceiling stated: the residual lethality just past depth 20
is canon tier-4/5 combat (Herman, Drarl, Vampire — none of them "starved in
the dark", so the darkness/rations rungs the ladder cap already excludes
would not have helped this row even if taken). No early-floor rung beyond
notch 2 (`FOE_GRACE_AT_2` 0.5) was needed — the natural band was met after
iteration 2's single notch.

Pin for the AFTER: 39bfecf23ffc8e4b06f09d5ac70b4d269ecaa213

### AFTER readouts — retuned engine — commit 39bfecf

Captured 2026-09-15 on pin `39bfecf23ffc8e4b06f09d5ac70b4d269ecaa213` (`git status --porcelain` empty; `npm test` 1441/1441 green; `tools/lib/tuning-bot.mjs` byte-identical to `5565b22`) — the last constants commit from the iteration log above. HEAD did not move between this commit and the captures below (no intervening commit); every JSON's `meta.commit` equals this pin's first 7 characters.

Cannot-act gate (run BEFORE any ledger edit, per the plan's gate-before-ledger order): `node tools/class-pass-diff.mjs --gate --after docs/class-pass/retune-after.json` printed:

```
cannot-act cells: 0 of 143
```

Elapsed per capture (from each command's own stderr `elapsed:` line, tune-classes only — tune-difficulty/tune-economy print no timing field): natural matrix (143 x 40, 5720 runs) 790.0s on 4 workers; forced-20 matrix (143 x 10, 1430 runs) 165.8s on 4 workers; the six tune-difficulty/tune-economy 200-seed reports ran to completion without incident (party mode's heavier per-run simulation was the long pole among them).

#### tune-classes natural 143 x 40 (docs/class-pass/retune-after.json)

```
tune-classes: 143 cells x 40 seeds (5720 runs) — start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
1  Thief  Ninja  Human  40  0  7.08  6.0  10.0  72.5  10.0  23.65  3.88  726.50  cut down by a Drarl(7),cut down by a Herman(3),undone by a trap(3)
2  Thief  Ninja  Wilmsry  40  0  6.43  6.0  10.0  85.0  12.5  21.48  3.65  669.65  cut down by a Werebeast(5),cut down by a Herman(4),cut down by a Drake(3)
3  Thief  Acrobat  Wilmsry  40  0  6.20  6.0  9.0  75.0  7.5  8.93  3.38  649.53  cut down by a Poltergeist(4),cut down by a Werebeast(4),undone by a trap(4)
4  Thief  Con Artist  Wilmsry  40  0  5.50  5.0  8.0  77.5  5.0  2.38  2.88  580.35  cut down by a Werebeast(6),starved in the dark(5),spent by the dungeon itself(4)
5  Fighter  Woodsman  Wilmsry  40  0  5.43  5.0  7.0  67.5  2.5  6.40  3.05  579.17  cut down by a Werebeast(7),starved in the dark(5),cut down by a Blumble(3)
6  Thief  Ninja  Troll  40  0  5.40  5.0  8.0  62.5  2.5  15.88  3.70  545.95  cut down by a Herman(5),starved in the dark(5),undone by a trap(4)
7  Thief  Ninja  Dwarven  40  0  5.35  5.0  8.0  57.5  5.0  17.20  3.60  542.03  cut down by a Drarl(5),cut down by a Werebeast(4),cut down by a Herman(3)
8  Fighter  Guard  Wilmsry  40  0  5.25  5.0  7.0  65.0  5.0  7.40  3.03  557.53  undone by a trap(5),cut down by a Werebeast(4),cut down by a Blumble(3)
9  Thief  Ninja  Elven  40  0  5.20  5.0  7.0  65.0  2.5  17.80  3.73  547.45  undone by a trap(4),cut down by a Drarl(3),cut down by a Dread Lock(3)
10  Thief  Pilfer  Wilmsry  40  0  5.08  5.0  8.0  62.5  0.0  6.90  2.95  555.53  cut down by a Werebeast(7),cut down by a Drarl(4),came up short on a leap(3)
11  Fighter  Knight  Wilmsry  40  0  5.03  5.0  7.0  72.5  0.0  3.65  2.83  519.28  cut down by a Werebeast(11),cut down by a Frank(4),cut down by a Gremlin(2)
12  Fighter  Barbarian  Wilmsry  40  0  5.03  5.0  7.0  60.0  2.5  8.05  2.90  516.08  cut down by a Werebeast(7),cut down by a Dante(3),cut down by a Stink Bug(3)
13  Thief  Cat Burglar  Wilmsry  40  0  4.97  5.0  9.0  50.0  5.0  7.53  2.80  519.03  undone by a trap(12),cut down by a Drarl(6),cut down by a Werebeast(4)
14  Thief  Acrobat  Troll  40  0  4.93  5.0  7.0  62.5  2.5  14.55  3.48  525.98  starved in the dark(15),cut down by a Drarl(4),came up short on a leap(3)
15  Thief  Cat Burglar  Human  40  0  4.90  4.0  7.0  42.5  2.5  15.18  2.90  509.08  undone by a trap(8),cut down by a Drarl(4),cut down by a Blumble(2)
16  Fighter  Barbarian  Elven  40  0  4.88  5.0  8.0  57.5  2.5  12.90  2.95  487.55  cut down by a Werebeast(5),cut down by a Rinkle(4),cut down by a Cave Bear(3)
17  Thief  Ninja  Fridgian  40  0  4.85  4.0  7.0  42.5  5.0  14.13  3.28  464.85  cut down by a Drarl(5),cut down by a Werebeast(5),cut down by a Blumble(4)
18  Thief  Acrobat  Human  40  0  4.80  5.0  8.0  52.5  2.5  14.38  3.25  514.50  cut down by a Frank(4),starved in the dark(4),fell off a wall(3)
19  Fighter  Bard  Wilmsry  40  0  4.78  5.0  7.0  50.0  0.0  5.65  2.90  499.10  undone by a trap(5),cut down by a Google(4),cut down by a Werebeast(4)
20  Fighter  Master of Arms  Wilmsry  40  0  4.72  5.0  7.0  57.5  0.0  14.60  3.05  506.08  cut down by a Drarl(5),cut down by a Werebeast(4),starved in the dark(4)
21  Thief  Pickpocket  Wilmsry  40  0  4.70  5.0  8.0  57.5  2.5  6.20  2.83  502.50  cut down by a Werebeast(4),cut down by a Cave Bear(3),cut down by a Dante(3)
22  Thief  Con Artist  Troll  40  0  4.70  4.0  7.0  45.0  5.0  2.40  2.63  503.05  starved in the dark(8),spent by the dungeon itself(5),cut down by a Cave Bear(3)
23  Thief  Cloaker  Wilmsry  40  0  4.65  5.0  7.0  62.5  0.0  5.85  2.73  506.55  cut down by a Werebeast(4),undone by a trap(4),cut down by a Poltergeist(3)
24  Thief  Cat Burglar  Troll  40  0  4.65  4.0  7.0  40.0  0.0  13.98  3.33  478.40  starved in the dark(10),undone by a trap(6),cut down by a Herman(5)
25  Fighter  Knight  Fridgian  40  0  4.63  5.0  7.0  55.0  0.0  6.30  2.85  473.23  cut down by a Werebeast(5),cut down by a Drarl(4),fell off a wall(3)
26  Thief  Con Artist  Human  40  0  4.60  5.0  6.0  62.5  0.0  2.50  2.70  486.20  cut down by a Werebeast(6),starved in the dark(4),fell off a wall(3)
27  Thief  Con Artist  Dwarven  40  0  4.55  5.0  6.0  52.5  0.0  2.03  2.55  470.63  cut down by a Werebeast(6),spent by the dungeon itself(4),cut down by a Poltergeist(3)
28  Fighter  Knight  Elven  40  0  4.50  4.0  7.0  47.5  0.0  5.48  2.78  438.18  cut down by a Poltergeist(4),spent by the dungeon itself(4),cut down by a Rinkle(3)
29  Fighter  Knight  Human  40  0  4.50  4.0  7.0  42.5  0.0  5.33  2.70  457.43  cut down by a Poltergeist(5),cut down by a Dante(4),undone by a trap(4)
30  Thief  Acrobat  Elven  40  0  4.45  4.0  7.0  40.0  5.0  10.98  2.98  439.08  fell off a wall(4),cut down by a Werebeast(3),cut down by a Blumble(2)
31  Fighter  Knight  Dwarven  40  0  4.38  4.0  7.0  37.5  0.0  5.88  2.60  476.48  cut down by a Blumble(4),cut down by a Poltergeist(4),undone by a trap(4)
32  Thief  Acrobat  Dwarven  40  0  4.35  4.0  7.0  42.5  2.5  11.85  2.80  423.43  undone by a trap(4),cut down by a China Wolf(3),cut down by a Drarl(3)
33  Magic User  Summoner  Wilmsry  40  0  4.33  4.0  7.0  45.0  0.0  6.30  2.58  458.30  cut down by a Poltergeist(5),cut down by a Gremlin(4),fell off a wall(4)
34  Thief  Pilfer  Troll  40  0  4.25  4.0  7.0  40.0  2.5  9.63  2.63  470.45  starved in the dark(12),spent by the dungeon itself(5),came up short on a leap(4)
35  Fighter  Barbarian  Human  40  0  4.25  4.0  7.0  30.0  0.0  14.70  2.65  456.40  cut down by a Trachea(4),cut down by a Ghoul(3),cut down by a Poltergeist(3)
36  Thief  Cutthroat  Elven  40  0  4.20  4.0  7.0  37.5  7.5  11.43  2.80  442.68  cut down by a Drarl(3),spent by the dungeon itself(3),starved in the dark(3)
37  Thief  Cutthroat  Wilmsry  40  0  4.20  4.0  7.0  32.5  0.0  5.65  2.48  466.78  cut down by a Poltergeist(5),cut down by a Google(4),cut down by a Blumble(3)
38  Fighter  Master of Arms  Elven  40  0  4.18  4.0  6.0  37.5  0.0  12.88  2.93  421.53  cut down by a Werebeast(5),cut down by a Google(3),cut down by a Primp(3)
39  Fighter  Knight  Troll  40  0  4.15  5.0  5.0  50.0  0.0  5.55  2.65  414.53  starved in the dark(8),cut down by a Poltergeist(3),cut down by a Werebeast(3)
40  Thief  Cat Burglar  Elven  40  0  4.15  4.0  8.0  37.5  5.0  10.75  2.73  416.95  undone by a trap(12),cut down by a Google(5),cut down by a Werebeast(4)
41  Thief  Con Artist  Elven  40  0  4.13  4.0  7.0  47.5  0.0  2.13  2.42  422.28  undone by a trap(5),cut down by a Werebeast(4),cut down by a Blumble(3)
42  Thief  Cat Burglar  Dwarven  40  0  4.13  4.0  7.0  42.5  0.0  12.53  2.90  427.53  undone by a trap(10),cut down by a Dante(2),cut down by a Drarl(2)
43  Magic User  Cleric  Wilmsry  40  0  4.13  4.0  6.0  42.5  0.0  5.28  2.45  442.63  cut down by a Werebeast(4),cut down by a Zit(3),starved in the dark(3)
44  Thief  Con Artist  Fridgian  40  0  4.13  4.0  5.0  40.0  0.0  1.93  2.38  418.93  cut down by a Poltergeist(6),cut down by a Werebeast(4),undone by a trap(4)
45  Fighter  Soldier  Wilmsry  40  0  4.13  4.0  6.0  40.0  0.0  5.60  2.50  421.53  cut down by a China Wolf(4),cut down by a Poltergeist(4),cut down by a Werebeast(4)
46  Magic User  Sorcerer  Wilmsry  40  0  4.13  4.0  7.0  37.5  0.0  5.90  2.58  421.08  undone by a trap(4),cut down by a Ghoul(3),cut down by a Poltergeist(3)
47  Fighter  Barbarian  Fridgian  40  0  4.05  4.0  6.0  40.0  0.0  12.30  2.50  447.13  starved in the dark(6),fell off a wall(4),cut down by a Poltergeist(3)
48  Thief  Pilfer  Elven  40  0  4.05  4.0  7.0  37.5  2.5  10.15  2.80  430.43  cut down by a Drarl(4),cut down by a Blumble(3),cut down by a Gremlin(3)
49  Thief  Cat Burglar  Fridgian  40  0  4.03  4.0  7.0  40.0  0.0  11.15  2.93  404.60  undone by a trap(7),cut down by a Drarl(6),cut down by a Werebeast(4)
50  Thief  Acrobat  Fridgian  40  0  4.03  4.0  6.0  37.5  0.0  11.13  2.83  410.88  starved in the dark(5),cut down by a Drarl(4),cut down by a Gremlin(4)
51  Thief  Pickpocket  Troll  40  0  4.00  4.0  6.0  35.0  2.5  8.85  2.42  423.55  starved in the dark(9),undone by a trap(8),spent by the dungeon itself(5)
52  Fighter  Master of Arms  Human  40  0  4.00  4.0  6.0  22.5  0.0  12.13  2.85  418.38  cut down by a Werebeast(5),cut down by a Poltergeist(4),starved in the dark(4)
53  Fighter  Master of Arms  Dwarven  40  0  3.98  4.0  6.0  30.0  0.0  10.05  2.75  403.18  cut down by a Blumble(4),cut down by a Poltergeist(4),cut down by a Drarl(3)
54  Fighter  Barbarian  Troll  40  0  3.95  4.0  5.0  35.0  0.0  11.70  2.38  400.83  starved in the dark(11),cut down by a Poltergeist(5),came up short on a leap(3)
55  Magic User  Summoner  Troll  40  0  3.93  4.0  6.0  35.0  0.0  11.75  2.73  416.85  starved in the dark(10),undone by a trap(3),cut down by a Skeleton(2)
56  Fighter  Bard  Human  40  0  3.93  4.0  5.0  32.5  2.5  9.32  2.58  414.45  cut down by a Poltergeist(5),cut down by a Werebeast(4),fell off a wall(4)
57  Fighter  Guard  Human  40  0  3.90  4.0  6.0  27.5  0.0  11.40  2.80  417.55  cut down by a Werebeast(5),cut down by a Cave Bear(3),undone by a trap(3)
58  Thief  Cloaker  Human  40  0  3.85  4.0  6.0  37.5  0.0  8.18  2.48  412.98  cut down by a Poltergeist(5),cut down by a Blumble(4),came up short on a leap(3)
59  Thief  Cutthroat  Troll  40  0  3.85  4.0  7.0  32.5  0.0  8.65  2.45  417.70  starved in the dark(11),fell off a wall(3),spent by the dungeon itself(3)
60  Thief  Cloaker  Fridgian  40  0  3.85  4.0  5.0  27.5  5.0  8.57  2.50  410.50  cut down by a Frank(5),starved in the dark(4),cut down by a Gremlin(3)
61  Fighter  Bard  Elven  40  0  3.83  4.0  6.0  32.5  0.0  9.18  2.70  400.63  undone by a trap(4),cut down by a Cave Bear(3),cut down by a Gremlin(3)
62  Fighter  Samurai  Wilmsry  40  0  3.83  4.0  5.0  22.5  2.5  6.20  2.25  390.75  cut down by a Skeleton(5),cut down by a Cave Bear(3),cut down by a Philly(3)
63  Magic User  Court Mage  Wilmsry  40  0  3.75  4.0  7.0  30.0  0.0  6.05  2.20  383.58  fell off a wall(6),undone by a trap(5),cut down by a Poltergeist(4)
64  Fighter  Guard  Troll  40  0  3.75  4.0  6.0  25.0  0.0  10.15  2.65  392.48  starved in the dark(9),cut down by a Dante(3),fell off a wall(3)
65  Fighter  Samurai  Elven  40  0  3.75  4.0  5.0  20.0  0.0  9.32  2.65  371.93  cut down by a Werebeast(7),cut down by a Google(4),cut down by a Poltergeist(4)
66  Thief  Pilfer  Human  40  0  3.70  4.0  6.0  35.0  0.0  8.38  2.55  419.13  cut down by a Werebeast(4),cut down by a Pogo(3),cut down by a Poltergeist(3)
67  Magic User  Illusionist  Wilmsry  40  0  3.68  4.0  6.0  35.0  0.0  5.05  2.25  400.45  cut down by a Poltergeist(5),cut down by a Werebeast(5),cut down by a Dante(4)
68  Fighter  Barbarian  Dwarven  40  0  3.68  4.0  6.0  30.0  0.0  11.23  2.45  378.28  cut down by a Dante(5),cut down by a Poltergeist(4),cut down by a Trachea(4)
69  Thief  Pilfer  Fridgian  40  0  3.68  4.0  5.0  30.0  0.0  8.78  2.48  401.63  cut down by a Poltergeist(4),cut down by a Werebeast(4),fell off a wall(3)
70  Fighter  Guard  Elven  40  0  3.68  4.0  6.0  27.5  0.0  9.05  2.50  377.88  cut down by a Cave Bear(3),cut down by a Google(3),cut down by a Poltergeist(3)
71  Fighter  Woodsman  Fridgian  40  0  3.68  4.0  5.0  27.5  0.0  7.13  2.48  382.00  starved in the dark(5),cut down by a Gremlin(4),cut down by a Blumble(3)
72  Thief  Cloaker  Troll  40  0  3.65  4.0  6.0  30.0  0.0  8.48  2.40  394.53  starved in the dark(13),undone by a trap(6),fell off a wall(4)
73  Fighter  Master of Arms  Troll  40  0  3.65  4.0  6.0  25.0  0.0  8.88  2.48  368.25  starved in the dark(11),spent by the dungeon itself(3),undone by a trap(3)
74  Magic User  Sorcerer  Troll  40  0  3.65  4.0  5.0  20.0  0.0  10.68  2.53  386.58  starved in the dark(9),came up short on a leap(3),cut down by a Blumble(3)
75  Fighter  Bard  Fridgian  40  0  3.65  3.0  6.0  25.0  0.0  7.95  2.40  367.58  fell off a wall(7),cut down by a Poltergeist(5),cut down by a Zit(3)
76  Fighter  Woodsman  Troll  40  0  3.65  3.0  6.0  25.0  0.0  5.48  2.30  349.95  starved in the dark(14),undone by a trap(4),cut down by a Werebeast(3)
77  Thief  Cutthroat  Fridgian  40  0  3.65  3.0  6.0  20.0  0.0  9.20  2.42  389.78  starved in the dark(6),cut down by a Werebeast(5),fell off a wall(3)
78  Magic User  Wizard  Troll  40  0  3.65  3.0  6.0  20.0  0.0  8.40  2.48  372.95  starved in the dark(7),cut down by a Poltergeist(4),cut down by a Drarl(3)
79  Thief  Pickpocket  Elven  40  0  3.63  3.0  6.0  27.5  2.5  8.75  2.38  373.40  undone by a trap(6),cut down by a Poltergeist(5),cut down by a Drarl(3)
80  Fighter  Soldier  Fridgian  40  0  3.60  4.0  5.0  25.0  0.0  9.35  2.45  368.83  cut down by a Poltergeist(5),cut down by a Frank(3),cut down by a Gremlin(3)
81  Thief  Pilfer  Dwarven  40  0  3.60  3.0  6.0  32.5  0.0  7.78  2.40  367.38  starved in the dark(4),cut down by a Gremlin(3),cut down by a Poltergeist(3)
82  Fighter  Bard  Troll  40  0  3.58  4.0  6.0  15.0  0.0  6.95  2.40  360.50  starved in the dark(14),cut down by a Shadow(3),cut down by a Werebeast(3)
83  Thief  Pickpocket  Human  40  0  3.58  3.0  7.0  32.5  2.5  8.80  2.35  403.73  fell off a wall(5),spent by the dungeon itself(4),cut down by a Dante(3)
84  Fighter  Soldier  Elven  40  0  3.55  4.0  5.0  25.0  0.0  8.90  2.60  368.35  cut down by a Werebeast(9),cut down by a Gremlin(5),cut down by a Cave Bear(3)
85  Fighter  Woodsman  Human  40  0  3.50  4.0  5.0  20.0  0.0  7.05  2.50  361.03  cut down by a Poltergeist(6),cut down by a Blumble(3),fell off a wall(3)
86  Thief  Cutthroat  Human  40  0  3.50  3.0  7.0  30.0  0.0  9.03  2.40  386.98  undone by a trap(4),cut down by a Gremlin(3),cut down by a Herman(3)
87  Fighter  Master of Arms  Fridgian  40  0  3.50  3.0  5.0  15.0  0.0  8.50  2.42  348.90  cut down by a Dante(6),cut down by a Gremlin(4),starved in the dark(4)
88  Fighter  Woodsman  Elven  40  0  3.43  4.0  5.0  22.5  0.0  6.10  2.38  350.30  cut down by a Gremlin(5),cut down by a Werebeast(5),cut down by a Poltergeist(4)
89  Fighter  Woodsman  Dwarven  40  0  3.43  3.0  6.0  20.0  0.0  6.13  2.35  358.03  cut down by a Google(6),undone by a trap(5),cut down by a Gremlin(3)
90  Magic User  Cleric  Troll  40  0  3.43  3.0  6.0  15.0  0.0  8.13  2.33  366.25  starved in the dark(11),cut down by a Poltergeist(4),cut down by a Dante(2)
91  Magic User  Summoner  Fridgian  40  0  3.40  4.0  5.0  15.0  0.0  8.75  2.33  350.75  undone by a trap(4),cut down by a Trachea(3),cut down by a Werebeast(3)
92  Magic User  Warlock  Troll  40  0  3.40  3.0  5.0  22.5  0.0  8.28  2.33  370.85  starved in the dark(17),cut down by a Werebeast(4),undone by a trap(3)
93  Magic User  Illusionist  Troll  40  0  3.40  3.0  5.0  17.5  0.0  8.10  2.25  361.20  starved in the dark(9),spent by the dungeon itself(5),came up short on a leap(3)
94  Fighter  Guard  Fridgian  40  0  3.38  3.0  5.0  22.5  0.0  8.78  2.35  358.55  starved in the dark(5),spent by the dungeon itself(4),cut down by a Wolf(3)
95  Magic User  Court Mage  Troll  40  0  3.35  4.0  4.0  5.0  0.0  7.70  2.28  341.75  starved in the dark(9),cut down by a Poltergeist(5),came up short on a leap(2)
96  Fighter  Soldier  Human  40  0  3.35  3.0  5.0  15.0  0.0  9.10  2.38  336.53  cut down by a Werebeast(4),cut down by a Blumble(3),cut down by a Dante(3)
97  Fighter  Soldier  Dwarven  40  0  3.33  4.0  5.0  22.5  0.0  7.88  2.20  341.65  cut down by a Gremlin(9),undone by a trap(4),cut down by a Werebeast(3)
98  Magic User  Warlock  Wilmsry  40  0  3.33  3.0  5.0  27.5  0.0  4.35  1.98  338.33  cut down by a Gremlin(4),fell off a wall(4),cut down by a Drekk(3)
99  Magic User  Cleric  Human  40  0  3.33  3.0  5.0  17.5  0.0  8.63  2.30  348.75  cut down by a Poltergeist(4),came up short on a leap(3),fell off a wall(3)
100  Thief  Cloaker  Elven  40  0  3.30  3.0  5.0  22.5  0.0  8.25  2.30  354.63  cut down by a Dante(4),spent by the dungeon itself(4),undone by a trap(4)
101  Fighter  Soldier  Troll  40  0  3.30  3.0  5.0  17.5  0.0  8.20  2.28  322.48  starved in the dark(8),cut down by a Werebeast(4),fell off a wall(4)
102  Fighter  Samurai  Troll  40  0  3.30  3.0  6.0  15.0  0.0  9.03  2.23  312.75  starved in the dark(6),cut down by a Cave Bear(3),cut down by a Poltergeist(3)
103  Magic User  Wizard  Wilmsry  40  0  3.28  3.0  5.0  20.0  0.0  3.55  2.05  321.55  cut down by a Poltergeist(5),cut down by a Drekk(4),cut down by a Gremlin(4)
104  Magic User  Sorcerer  Fridgian  40  0  3.25  3.0  5.0  17.5  0.0  8.32  2.23  304.90  fell off a wall(4),starved in the dark(4),cut down by a China Wolf(3)
105  Magic User  Sorcerer  Human  40  0  3.25  3.0  7.0  17.5  2.5  8.68  2.20  329.83  cut down by a Gremlin(4),cut down by a Ned(4),cut down by a Philly(3)
106  Magic User  Illusionist  Human  40  0  3.25  3.0  4.0  7.5  2.5  8.63  2.30  353.50  cut down by a Werebeast(4),fell off a wall(4),starved in the dark(4)
107  Magic User  Summoner  Human  40  0  3.20  3.0  5.0  20.0  0.0  9.30  2.38  341.63  cut down by a Rinkle(6),cut down by a Werebeast(4),undone by a trap(4)
108  Thief  Cloaker  Dwarven  40  0  3.20  3.0  5.0  17.5  2.5  6.13  2.00  337.18  spent by the dungeon itself(5),came up short on a leap(4),cut down by a Philly(4)
109  Magic User  Apprentice  Troll  40  0  3.20  3.0  5.0  15.0  0.0  7.25  2.65  339.90  starved in the dark(6),cut down by a Poltergeist(4),undone by a trap(3)
110  Thief  Pickpocket  Fridgian  40  0  3.18  3.0  5.0  15.0  0.0  7.85  2.17  338.20  spent by the dungeon itself(7),starved in the dark(5),cut down by a Gremlin(4)
111  Magic User  Apprentice  Wilmsry  40  0  3.15  3.0  5.0  22.5  0.0  3.43  2.13  313.95  fell off a wall(5),cut down by a Drekk(4),undone by a trap(3)
112  Fighter  Guard  Dwarven  40  0  3.13  3.0  5.0  20.0  0.0  7.30  2.15  322.33  cut down by a Gremlin(5),cut down by a Werebeast(3),undone by a trap(3)
113  Magic User  Warlock  Fridgian  40  0  3.13  3.0  5.0  12.5  0.0  7.70  2.28  314.77  cut down by a Poltergeist(5),cut down by a Gremlin(3),undone by a trap(3)
114  Magic User  Court Mage  Fridgian  40  0  3.13  3.0  5.0  10.0  0.0  8.78  2.33  332.85  cut down by a Skeleton(3),cut down by a Werebeast(3),starved in the dark(3)
115  Thief  Cutthroat  Dwarven  40  0  3.10  3.0  5.0  22.5  0.0  6.60  2.00  333.68  fell off a wall(5),came up short on a leap(3),cut down by a Gremlin(3)
116  Fighter  Samurai  Human  40  0  3.10  3.0  4.0  7.5  0.0  9.82  2.30  297.77  cut down by a Poltergeist(7),cut down by a Google(5),cut down by a China Wolf(3)
117  Fighter  Bard  Dwarven  40  0  3.03  3.0  5.0  22.5  0.0  6.05  1.98  286.40  cut down by a Gremlin(6),cut down by a Poltergeist(4),starved in the dark(4)
118  Magic User  Sorcerer  Elven  40  0  3.03  3.0  5.0  12.5  0.0  7.63  2.17  301.27  cut down by a Blumble(5),fell off a wall(4),undone by a trap(4)
119  Magic User  Cleric  Fridgian  40  0  3.00  3.0  4.0  7.5  0.0  7.45  2.13  306.50  cut down by a Gremlin(4),cut down by a Poltergeist(4),cut down by a Skeleton(3)
120  Magic User  Apprentice  Human  40  0  2.98  3.0  5.0  22.5  0.0  6.65  2.40  324.77  cut down by a Gremlin(5),fell off a wall(4),cut down by a Drekk(3)
121  Magic User  Warlock  Human  40  0  2.95  3.0  5.0  15.0  0.0  6.23  1.98  297.10  cut down by a Poltergeist(7),cut down by a Gremlin(4),undone by a trap(3)
122  Magic User  Summoner  Dwarven  40  0  2.88  3.0  5.0  10.0  0.0  7.30  2.08  274.00  cut down by a Poltergeist(6),cut down by a Philly(3),cut down by a Bat/Rat(2)
123  Magic User  Sorcerer  Dwarven  40  0  2.88  3.0  4.0  7.5  0.0  7.70  2.13  292.70  cut down by a Gremlin(4),cut down by a Poltergeist(4),cut down by a Trachea(4)
124  Magic User  Illusionist  Fridgian  40  0  2.85  3.0  5.0  15.0  0.0  6.53  1.95  291.50  fell off a wall(6),cut down by a Gremlin(4),cut down by a Philly(3)
125  Magic User  Wizard  Fridgian  40  0  2.85  3.0  5.0  10.0  0.0  6.63  2.03  281.50  cut down by a Dante(6),cut down by a Gremlin(5),cut down by a Philly(5)
126  Fighter  Samurai  Dwarven  40  0  2.85  3.0  4.0  7.5  0.0  8.88  2.05  279.23  cut down by a Drekk(4),cut down by a Werebeast(4),cut down by a Ned(3)
127  Magic User  Cleric  Dwarven  40  0  2.80  3.0  5.0  20.0  0.0  6.95  1.98  283.25  came up short on a leap(4),cut down by a Cave Bear(4),cut down by a Drarl(3)
128  Magic User  Warlock  Elven  40  0  2.80  3.0  5.0  15.0  0.0  6.00  2.13  262.65  cut down by a Gremlin(4),undone by a trap(4),cut down by a Blumble(3)
129  Magic User  Apprentice  Fridgian  40  0  2.80  2.0  6.0  17.5  0.0  5.65  2.23  264.15  cut down by a Poltergeist(5),cut down by a Craig(3),cut down by a Dante(3)
130  Thief  Pickpocket  Dwarven  40  0  2.75  3.0  5.0  17.5  0.0  5.60  1.80  283.02  cut down by a Gremlin(6),undone by a trap(5),cut down by a Blumble(3)
131  Magic User  Summoner  Elven  40  0  2.68  3.0  5.0  10.0  0.0  6.28  1.93  266.33  eaten by their own summoning(5),undone by a trap(5),cut down by a Gremlin(4)
132  Magic User  Wizard  Human  40  0  2.68  2.0  5.0  10.0  0.0  5.03  1.75  272.68  cut down by a Ned(6),cut down by a Dante(4),cut down by a Gremlin(4)
133  Magic User  Court Mage  Human  40  0  2.65  2.0  5.0  12.5  0.0  7.33  1.95  296.25  cut down by a Gremlin(8),cut down by a Philly(4),starved in the dark(4)
134  Magic User  Illusionist  Elven  40  0  2.63  2.0  5.0  17.5  0.0  5.48  1.95  261.75  cut down by a Gremlin(5),cut down by a Poltergeist(5),spent by the dungeon itself(5)
135  Magic User  Warlock  Dwarven  40  0  2.50  2.0  5.0  12.5  0.0  4.65  1.73  235.08  cut down by a Gremlin(6),undone by a trap(5),cut down by a Ned(4)
136  Magic User  Illusionist  Dwarven  40  0  2.45  3.0  4.0  7.5  0.0  5.13  1.80  255.33  cut down by a Ned(7),cut down by a Drekk(5),cut down by a Philly(4)
137  Magic User  Wizard  Elven  40  0  2.45  2.0  4.0  5.0  0.0  4.70  1.75  234.68  cut down by a Gremlin(7),cut down by a Ned(3),cut down by a Philly(3)
138  Magic User  Cleric  Elven  40  0  2.38  2.0  5.0  10.0  0.0  5.70  1.73  226.88  cut down by a Gremlin(6),spent by the dungeon itself(6),cut down by a Poltergeist(4)
139  Magic User  Court Mage  Elven  40  0  2.38  2.0  4.0  7.5  0.0  5.70  1.68  226.90  spent by the dungeon itself(6),cut down by a Gremlin(4),undone by a trap(4)
140  Magic User  Wizard  Dwarven  40  0  2.30  2.0  4.0  7.5  0.0  3.90  1.60  223.53  undone by a trap(5),cut down by a Gremlin(4),cut down by a Ned(3)
141  Magic User  Apprentice  Elven  40  0  2.17  2.0  4.0  5.0  0.0  3.95  1.88  199.65  undone by a trap(5),cut down by a Gremlin(4),cut down by a Philly(4)
142  Magic User  Court Mage  Dwarven  40  0  2.15  2.0  4.0  5.0  0.0  4.25  1.55  198.45  cut down by a Ned(5),cut down by a Gremlin(4),cut down by a Philly(4)
143  Magic User  Apprentice  Dwarven  40  0  2.10  2.0  4.0  2.5  0.0  2.98  1.55  180.85  cut down by a Drekk(5),cut down by a Gremlin(5),cut down by a Philly(4)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Thief  1920  0  4.35  4.0  7.0  43.1  2.3  9.58  2.76  456.66  starved in the dark(182),undone by a trap(171),cut down by a Werebeast(139)
Fighter  1880  0  3.92  4.0  6.0  32.1  0.4  8.51  2.55  401.68  starved in the dark(165),cut down by a Werebeast(160),cut down by a Poltergeist(136)
Magic User  1920  0  3.06  3.0  5.0  16.5  0.1  6.64  2.13  311.89  cut down by a Gremlin(148),cut down by a Poltergeist(138),starved in the dark(127)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Ninja  240  0  5.72  5.0  8.0  64.2  6.3  18.35  3.64  582.74  cut down by a Drarl(24),cut down by a Werebeast(22),undone by a trap(18)
Acrobat  240  0  4.79  5.0  7.0  51.7  3.3  11.97  3.12  493.90  starved in the dark(31),cut down by a Drarl(18),cut down by a Werebeast(16)
Con Artist  240  0  4.60  5.0  6.0  54.2  1.7  2.23  2.59  480.24  cut down by a Werebeast(29),starved in the dark(22),undone by a trap(22)
Knight  240  0  4.53  5.0  6.0  50.8  0.0  5.36  2.73  463.18  cut down by a Werebeast(27),cut down by a Poltergeist(20),starved in the dark(18)
Cat Burglar  240  0  4.47  4.0  7.0  42.1  2.1  11.85  2.93  459.26  undone by a trap(55),starved in the dark(22),cut down by a Drarl(21)
Barbarian  240  0  4.30  4.0  7.0  42.1  0.8  11.81  2.64  447.71  starved in the dark(22),cut down by a Poltergeist(19),cut down by a Werebeast(18)
Pilfer  240  0  4.06  4.0  6.0  39.6  0.8  8.60  2.63  440.75  starved in the dark(24),cut down by a Werebeast(20),cut down by a Poltergeist(15)
Master of Arms  240  0  4.00  4.0  6.0  31.3  0.0  11.17  2.75  411.05  starved in the dark(24),cut down by a Werebeast(19),cut down by a Poltergeist(17)
Guard  240  0  3.85  4.0  6.0  31.3  0.8  9.01  2.58  404.38  starved in the dark(22),undone by a trap(20),cut down by a Werebeast(18)
Woodsman  240  0  3.85  4.0  6.0  30.4  0.4  6.38  2.51  396.75  starved in the dark(28),cut down by a Werebeast(20),undone by a trap(19)
Bard  240  0  3.80  4.0  6.0  29.6  0.4  7.52  2.49  388.11  starved in the dark(26),cut down by a Poltergeist(21),cut down by a Werebeast(14)
Cloaker  240  0  3.75  4.0  6.0  32.9  1.3  7.58  2.40  402.73  starved in the dark(25),undone by a trap(21),cut down by a Poltergeist(16)
Cutthroat  240  0  3.75  4.0  6.0  29.2  1.3  8.43  2.42  406.26  starved in the dark(23),spent by the dungeon itself(18),fell off a wall(17)
Pickpocket  240  0  3.64  3.0  6.0  30.8  1.7  7.68  2.33  387.40  undone by a trap(26),spent by the dungeon itself(23),starved in the dark(23)
Soldier  240  0  3.54  4.0  5.0  24.2  0.0  8.17  2.40  359.89  cut down by a Werebeast(25),cut down by a Gremlin(24),cut down by a Poltergeist(16)
Summoner  240  0  3.40  3.0  6.0  22.5  0.0  8.28  2.33  351.31  undone by a trap(20),cut down by a Poltergeist(16),eaten by their own summoning(15)
Samurai  200  0  3.37  3.0  5.0  14.5  0.5  8.65  2.30  330.49  cut down by a Werebeast(19),cut down by a Poltergeist(17),cut down by a Skeleton(13)
Sorcerer  240  0  3.36  3.0  5.0  18.8  0.4  8.15  2.30  339.39  starved in the dark(18),undone by a trap(17),cut down by a Poltergeist(16)
Cleric  240  0  3.18  3.0  5.0  18.8  0.0  7.02  2.15  329.04  starved in the dark(19),cut down by a Gremlin(18),cut down by a Poltergeist(18)
Illusionist  240  0  3.04  3.0  5.0  16.7  0.4  6.48  2.08  320.62  fell off a wall(21),cut down by a Poltergeist(19),cut down by a Gremlin(17)
Warlock  240  0  3.02  3.0  5.0  17.5  0.0  6.20  2.07  303.13  cut down by a Gremlin(21),cut down by a Poltergeist(20),starved in the dark(20)
Court Mage  240  0  2.90  3.0  5.0  11.7  0.0  6.63  2.00  296.63  cut down by a Gremlin(22),starved in the dark(19),cut down by a Poltergeist(17)
Wizard  240  0  2.87  3.0  5.0  12.1  0.0  5.37  1.94  284.48  cut down by a Gremlin(26),cut down by a Poltergeist(16),fell off a wall(16)
Apprentice  240  0  2.73  3.0  5.0  14.2  0.0  4.98  2.14  270.55  cut down by a Gremlin(18),undone by a trap(18),fell off a wall(17)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  top causes
Wilmsry  960  0  4.57  4.0  7.0  49.9  1.9  6.76  2.68  479.97  cut down by a Werebeast(99),undone by a trap(72),cut down by a Poltergeist(63)
Troll  960  0  3.86  4.0  6.0  29.4  0.6  9.11  2.58  401.57  starved in the dark(242),undone by a trap(64),spent by the dungeon itself(59)
Human  960  0  3.78  4.0  6.0  28.5  1.0  9.56  2.52  399.30  cut down by a Poltergeist(70),cut down by a Werebeast(60),undone by a trap(53)
Fridgian  920  0  3.58  3.0  5.0  24.7  0.4  8.38  2.43  366.63  starved in the dark(67),cut down by a Poltergeist(62),cut down by a Werebeast(60)
Elven  960  0  3.56  3.0  6.0  27.8  1.1  8.31  2.45  359.30  undone by a trap(84),cut down by a Werebeast(72),cut down by a Gremlin(66)
Dwarven  960  0  3.29  3.0  5.0  22.8  0.4  7.33  2.21  332.23  cut down by a Gremlin(78),undone by a trap(68),cut down by a Poltergeist(67)

POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  top causes
5720  0  3.77  4.0  6.0  30.6  0.9  0.1  8.24  2.48  390.00  starved in the dark(474),undone by a trap(394),cut down by a Werebeast(381)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 5720 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=40  workers=4  startDepth=1
elapsed: 790.0s  workers=4  runs=5720
```

#### tune-classes forced 20 — 143 x 10 (docs/class-pass/retune-after-depth20.json)

```
tune-classes: 143 cells x 10 seeds (1430 runs) — start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

#  class  sub  race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
1  Thief  Ninja  Troll  10  0  24.10  21.0  39.0  100.0  100.0  10.60  5.00  541.40  4.10  1.0  13.20  starved in the dark(4),cut down by a Djinni(1),cut down by a Drarl(1)
2  Thief  Cat Burglar  Wilmsry  10  0  23.60  22.0  33.0  100.0  100.0  6.70  5.00  471.70  3.60  2.0  11.10  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Herman(2)
3  Thief  Ninja  Wilmsry  10  0  23.50  22.0  34.0  100.0  100.0  10.80  5.00  456.40  3.50  2.0  11.60  cut down by a Herman(4),cut down by a Vampire(3),cut down by a Drarl(1)
4  Thief  Acrobat  Wilmsry  10  0  23.10  23.0  27.0  100.0  100.0  2.50  5.00  421.00  3.10  3.0  9.40  cut down by a Vampire(3),cut down by a Drarl(2),cut down by a Djinni(1)
5  Thief  Ninja  Human  10  0  23.10  22.0  34.0  100.0  100.0  9.30  5.00  396.00  3.10  2.0  10.20  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drarl(1)
6  Thief  Cat Burglar  Troll  10  0  23.00  22.0  32.0  100.0  100.0  8.10  5.00  398.10  3.00  2.0  10.20  cut down by a Herman(3),cut down by a Djinni(2),starved in the dark(2)
7  Thief  Ninja  Dwarven  10  0  22.90  21.0  36.0  100.0  100.0  9.20  5.00  386.20  2.90  1.0  10.10  cut down by a Herman(4),cut down by a Stalka Beast(2),cut down by a Drarl(1)
8  Thief  Acrobat  Troll  10  0  22.40  23.0  25.0  100.0  100.0  6.20  5.00  365.70  2.40  3.0  9.50  starved in the dark(4),cut down by a Herman(2),came up short on a leap(1)
9  Thief  Cloaker  Wilmsry  10  0  22.30  21.0  32.0  100.0  100.0  1.60  5.00  301.80  2.30  1.0  6.00  cut down by a Herman(3),cut down by a Djinni(2),cut down by a Drake(1)
10  Thief  Acrobat  Dwarven  10  0  21.80  22.0  24.0  100.0  100.0  6.10  5.00  310.50  1.80  2.0  6.20  cut down by a Herman(5),cut down by a Stink Bug(2),cut down by a Djinni(1)
11  Thief  Acrobat  Human  10  0  21.80  22.0  25.0  100.0  100.0  5.00  5.00  279.90  1.80  2.0  6.30  cut down by a Herman(4),cut down by a Stink Bug(3),cut down by a Djinni(1)
12  Thief  Cat Burglar  Dwarven  10  0  21.80  22.0  28.0  100.0  100.0  3.50  5.00  258.70  1.80  2.0  5.40  cut down by a Herman(3),cut down by a Stalka Beast(2),cut down by a Drarl(1)
13  Fighter  Master of Arms  Wilmsry  10  0  21.70  22.0  25.0  100.0  100.0  4.60  5.00  196.50  1.70  2.0  5.20  cut down by a Dread Lock(3),cut down by a Vampire(3),cut down by a Herman(2)
14  Magic User  Summoner  Wilmsry  10  0  21.70  22.0  25.0  100.0  100.0  3.40  5.00  229.70  1.70  2.0  5.30  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Dread Lock(2)
15  Fighter  Woodsman  Wilmsry  10  0  21.70  22.0  24.0  100.0  100.0  2.30  5.00  247.40  1.70  2.0  5.80  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Herman(2)
16  Thief  Cat Burglar  Human  10  0  21.60  22.0  27.0  100.0  100.0  3.00  5.00  246.50  1.60  2.0  5.00  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Dread Lock(1)
17  Thief  Con Artist  Wilmsry  10  0  21.60  22.0  23.0  100.0  100.0  0.60  5.00  255.30  1.60  2.0  4.80  cut down by a Djinni(3),cut down by a Drarl(2),cut down by a Herman(2)
18  Thief  Pickpocket  Wilmsry  10  0  21.60  22.0  24.0  100.0  100.0  1.70  5.00  245.40  1.60  2.0  4.60  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Stalka Beast(2)
19  Thief  Cutthroat  Wilmsry  10  0  21.60  21.0  25.0  100.0  100.0  1.00  5.00  234.70  1.60  1.0  4.50  cut down by a Herman(3),cut down by a Djinni(2),cut down by a Vampire(2)
20  Fighter  Guard  Wilmsry  10  0  21.60  21.0  28.0  100.0  100.0  2.50  5.00  223.10  1.60  1.0  6.10  cut down by a Herman(3),cut down by a Djinni(2),cut down by a Drarl(2)
21  Fighter  Barbarian  Wilmsry  10  0  21.30  21.0  24.0  100.0  100.0  1.90  5.00  172.10  1.30  1.0  3.70  cut down by a Vampire(3),cut down by a Djinni(2),cut down by a Drarl(2)
22  Thief  Ninja  Fridgian  10  0  21.30  21.0  26.0  100.0  100.0  2.90  5.00  179.40  1.30  1.0  4.00  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Djinni(1)
23  Thief  Pilfer  Wilmsry  10  0  21.30  21.0  24.0  100.0  100.0  1.50  5.00  195.80  1.30  1.0  4.00  cut down by a Drarl(4),cut down by a Vampire(3),cut down by a Djinni(1)
24  Fighter  Bard  Wilmsry  10  0  21.20  21.0  24.0  100.0  100.0  1.90  5.00  173.20  1.20  1.0  5.10  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Djinni(1)
25  Magic User  Illusionist  Wilmsry  10  0  21.20  21.0  23.0  100.0  100.0  1.80  5.00  214.70  1.20  1.0  4.10  cut down by a Drarl(3),cut down by a Stalka Beast(2),cut down by a Djinni(1)
26  Fighter  Samurai  Wilmsry  10  0  21.10  21.0  23.0  100.0  100.0  2.20  5.00  179.80  1.10  1.0  3.80  cut down by a Drarl(2),cut down by a Drudge(2),cut down by a Herman(2)
27  Fighter  Master of Arms  Elven  10  0  21.10  20.0  26.0  100.0  100.0  1.10  5.00  108.50  1.10  0.0  2.20  cut down by a Djinni(3),cut down by a Vampire(2),cut down by a Bones(1)
28  Thief  Con Artist  Dwarven  10  0  21.00  21.0  23.0  100.0  100.0  0.10  5.00  143.80  1.00  1.0  2.20  cut down by a Herman(4),undone by a trap(2),cut down by a Djinni(1)
29  Thief  Con Artist  Human  10  0  21.00  21.0  23.0  100.0  100.0  0.10  5.00  143.80  1.00  1.0  2.20  cut down by a Herman(4),undone by a trap(2),cut down by a Djinni(1)
30  Thief  Con Artist  Troll  10  0  21.00  21.0  22.0  100.0  100.0  0.50  5.00  155.60  1.00  1.0  3.10  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drarl(1)
31  Magic User  Court Mage  Troll  10  0  21.00  21.0  23.0  100.0  100.0  4.00  5.00  197.00  1.00  1.0  4.00  cut down by a Djinni(2),cut down by a Herman(2),cut down by a Drarl(1)
32  Fighter  Knight  Wilmsry  10  0  21.00  21.0  22.0  100.0  100.0  1.70  5.00  154.70  1.00  1.0  3.40  cut down by a Djinni(5),cut down by a Herman(2),cut down by a Stalka Beast(1)
33  Fighter  Soldier  Wilmsry  10  0  21.00  21.0  22.0  100.0  100.0  1.70  5.00  154.70  1.00  1.0  3.40  cut down by a Djinni(5),cut down by a Herman(2),cut down by a Stalka Beast(1)
34  Magic User  Sorcerer  Troll  10  0  21.00  21.0  24.0  100.0  100.0  3.80  5.00  187.20  1.00  1.0  4.30  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drarl(1)
35  Magic User  Summoner  Dwarven  10  0  21.00  21.0  22.0  100.0  100.0  2.80  5.00  176.20  1.00  1.0  2.50  cut down by a Vampire(3),cut down by a Djinni(2),cut down by a Herman(2)
36  Magic User  Summoner  Human  10  0  21.00  21.0  22.0  100.0  100.0  2.80  5.00  176.20  1.00  1.0  2.50  cut down by a Vampire(3),cut down by a Djinni(2),cut down by a Herman(2)
37  Fighter  Master of Arms  Human  10  0  21.00  20.0  25.0  100.0  100.0  3.10  5.00  142.40  1.00  0.0  4.10  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Djinni(2)
38  Thief  Acrobat  Fridgian  10  0  20.90  21.0  23.0  100.0  100.0  1.90  5.00  134.10  0.90  1.0  3.40  cut down by a Dread Lock(2),cut down by a Herman(2),cut down by a Stalka Beast(2)
39  Magic User  Cleric  Wilmsry  10  0  20.90  21.0  23.0  100.0  100.0  2.20  5.00  159.60  0.90  1.0  5.10  cut down by a Herman(2),cut down by a Vampire(2),came up short on a leap(1)
40  Thief  Cloaker  Troll  10  0  20.90  21.0  23.0  100.0  100.0  3.80  5.00  172.60  0.90  1.0  4.10  cut down by a Craig(2),cut down by a Dread Lock(2),cut down by a Stalka Beast(2)
41  Magic User  Sorcerer  Wilmsry  10  0  20.90  21.0  24.0  100.0  100.0  1.80  5.00  166.30  0.90  1.0  3.70  cut down by a Dread Lock(2),cut down by a Drudge(2),cut down by a Drake(1)
42  Magic User  Warlock  Troll  10  0  20.90  21.0  23.0  100.0  100.0  2.30  5.00  159.60  0.90  1.0  3.40  cut down by a Herman(4),cut down by a Stalka Beast(2),cut down by a Djinni(1)
43  Fighter  Barbarian  Troll  10  0  20.80  21.0  22.0  100.0  100.0  3.50  5.00  133.60  0.80  1.0  3.10  cut down by a Djinni(2),cut down by a Herman(2),cut down by a Vampire(2)
44  Thief  Con Artist  Fridgian  10  0  20.80  21.0  22.0  100.0  100.0  0.50  5.00  128.60  0.80  1.0  2.10  cut down by a Drarl(3),cut down by a Herman(3),came up short on a leap(1)
45  Fighter  Guard  Troll  10  0  20.80  21.0  24.0  100.0  100.0  2.80  5.00  150.40  0.80  1.0  3.20  cut down by a Herman(3),cut down by a Vampire(2),came up short on a leap(1)
46  Fighter  Master of Arms  Dwarven  10  0  20.80  21.0  23.0  100.0  100.0  2.50  5.00  114.10  0.80  1.0  3.00  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Djinni(1)
47  Fighter  Master of Arms  Fridgian  10  0  20.80  21.0  23.0  100.0  100.0  1.60  5.00  111.30  0.80  1.0  2.70  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Stink Bug(2)
48  Fighter  Master of Arms  Troll  10  0  20.80  21.0  23.0  100.0  100.0  3.40  5.00  135.60  0.80  1.0  3.20  cut down by a Herman(5),cut down by a Vampire(2),cut down by a Drarl(1)
49  Thief  Ninja  Elven  10  0  20.80  21.0  23.0  100.0  100.0  2.60  5.00  131.50  0.80  1.0  2.80  cut down by a Dread Lock(3),cut down by a Herman(3),cut down by a Vampire(2)
50  Thief  Pickpocket  Troll  10  0  20.80  21.0  23.0  100.0  100.0  2.70  5.00  145.50  0.80  1.0  3.50  cut down by a Stalka Beast(2),starved in the dark(2),cut down by a Djinni(1)
51  Fighter  Samurai  Dwarven  10  0  20.80  21.0  22.0  100.0  100.0  3.20  5.00  135.50  0.80  1.0  2.60  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Vampire(2)
52  Fighter  Woodsman  Human  10  0  20.80  21.0  22.0  100.0  100.0  1.20  5.00  114.80  0.80  1.0  1.90  cut down by a Herman(4),cut down by a Vampire(3),cut down by a Drarl(1)
53  Fighter  Woodsman  Troll  10  0  20.80  21.0  22.0  100.0  100.0  2.30  5.00  157.20  0.80  1.0  4.30  cut down by a Herman(4),cut down by a Vampire(2),cut down by a Djinni(1)
54  Thief  Cat Burglar  Fridgian  10  0  20.80  20.0  24.0  100.0  100.0  1.60  5.00  142.00  0.80  0.0  2.50  cut down by a Herman(4),cut down by a Craig(1),cut down by a Djinni(1)
55  Thief  Cutthroat  Elven  10  0  20.80  20.0  25.0  100.0  100.0  2.40  5.00  136.80  0.80  0.0  2.80  cut down by a Stalka Beast(4),cut down by a Djinni(3),cut down by a Drarl(1)
56  Magic User  Warlock  Fridgian  10  0  20.80  20.0  26.0  100.0  100.0  2.20  5.00  144.80  0.80  0.0  2.50  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Djinni(1)
57  Magic User  Illusionist  Fridgian  10  0  20.70  21.0  22.0  100.0  100.0  2.40  5.00  147.50  0.70  1.0  3.00  cut down by a Djinni(4),cut down by a Drarl(3),cut down by a Herman(1)
58  Thief  Pilfer  Elven  10  0  20.70  21.0  22.0  100.0  100.0  1.80  5.00  118.30  0.70  1.0  2.40  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Herman(2)
59  Fighter  Woodsman  Dwarven  10  0  20.70  21.0  22.0  100.0  100.0  1.20  5.00  112.00  0.70  1.0  2.10  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Drarl(1)
60  Fighter  Woodsman  Fridgian  10  0  20.70  21.0  22.0  100.0  100.0  2.10  5.00  114.40  0.70  1.0  3.60  cut down by a Herman(5),cut down by a Undead(2),cut down by a Djinni(1)
61  Fighter  Barbarian  Human  10  0  20.70  20.0  22.0  100.0  100.0  1.80  5.00  118.40  0.70  0.0  2.20  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Stalka Beast(2)
62  Thief  Cat Burglar  Elven  10  0  20.70  20.0  24.0  100.0  100.0  1.30  5.00  127.90  0.70  0.0  2.40  cut down by a Herman(3),cut down by a Dread Lock(2),cut down by a Djinni(1)
63  Fighter  Guard  Dwarven  10  0  20.70  20.0  23.0  100.0  100.0  1.80  5.00  107.40  0.70  0.0  2.50  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Herman(2)
64  Thief  Pickpocket  Elven  10  0  20.70  20.0  24.0  100.0  100.0  1.40  5.00  120.30  0.70  0.0  2.20  cut down by a Dread Lock(2),cut down by a Herman(2),cut down by a Stalka Beast(2)
65  Magic User  Wizard  Troll  10  0  20.70  20.0  23.0  100.0  100.0  2.30  5.00  164.50  0.70  0.0  2.60  cut down by a Herman(2),cut down by a Stalka Beast(2),cut down by a Vampire(2)
66  Thief  Con Artist  Elven  10  0  20.60  21.0  22.0  100.0  100.0  0.30  5.00  125.20  0.60  1.0  1.90  cut down by a Vampire(3),cut down by a Djinni(2),cut down by a Dread Lock(1)
67  Thief  Pickpocket  Dwarven  10  0  20.60  21.0  22.0  100.0  100.0  1.50  5.00  112.80  0.60  1.0  1.90  cut down by a Herman(5),cut down by a Drarl(3),cut down by a Vampire(2)
68  Magic User  Summoner  Elven  10  0  20.60  21.0  22.0  100.0  100.0  2.50  5.00  127.00  0.60  1.0  2.00  cut down by a Djinni(3),eaten by their own summoning(3),cut down by a Drarl(2)
69  Magic User  Apprentice  Troll  10  0  20.60  20.0  22.0  100.0  100.0  1.80  5.00  131.00  0.60  0.0  2.80  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
70  Magic User  Apprentice  Wilmsry  10  0  20.60  20.0  23.0  100.0  100.0  1.30  5.00  114.50  0.60  0.0  2.80  cut down by a Drarl(5),cut down by a Herman(2),cut down by a Vampire(2)
71  Fighter  Barbarian  Elven  10  0  20.60  20.0  23.0  100.0  100.0  1.30  5.00  89.10  0.60  0.0  1.60  cut down by a Drarl(2),cut down by a Ghost(2),cut down by a Stalka Beast(2)
72  Magic User  Cleric  Troll  10  0  20.60  20.0  22.0  100.0  100.0  2.60  5.00  179.50  0.60  0.0  3.90  cut down by a Herman(3),cut down by a Drarl(2),came up short on a leap(1)
73  Thief  Cloaker  Elven  10  0  20.60  20.0  23.0  100.0  100.0  1.80  5.00  106.50  0.60  0.0  2.20  cut down by a Stalka Beast(4),cut down by a Djinni(3),cut down by a Herman(1)
74  Fighter  Knight  Dwarven  10  0  20.60  20.0  22.0  100.0  100.0  1.60  5.00  100.90  0.60  0.0  2.00  cut down by a Vampire(3),cut down by a Drarl(2),cut down by a Herman(2)
75  Thief  Pilfer  Dwarven  10  0  20.60  20.0  24.0  100.0  100.0  1.50  5.00  119.00  0.60  0.0  1.90  cut down by a Herman(3),cut down by a Vampire(2),cut down by a Craig(1)
76  Thief  Pilfer  Fridgian  10  0  20.60  20.0  22.0  100.0  100.0  2.10  5.00  124.20  0.60  0.0  3.10  cut down by a Herman(4),cut down by a Vampire(3),cut down by a Djinni(1)
77  Thief  Pilfer  Human  10  0  20.60  20.0  24.0  100.0  100.0  1.50  5.00  119.00  0.60  0.0  1.90  cut down by a Herman(3),cut down by a Vampire(2),cut down by a Craig(1)
78  Fighter  Samurai  Human  10  0  20.60  20.0  22.0  100.0  100.0  2.70  5.00  99.00  0.60  0.0  2.10  cut down by a Stalka Beast(3),cut down by a Dread Lock(2),cut down by a Djinni(1)
79  Fighter  Soldier  Dwarven  10  0  20.60  20.0  22.0  100.0  100.0  1.60  5.00  100.90  0.60  0.0  2.00  cut down by a Vampire(3),cut down by a Drarl(2),cut down by a Herman(2)
80  Magic User  Sorcerer  Elven  10  0  20.60  20.0  22.0  100.0  100.0  3.00  5.00  108.70  0.60  0.0  2.70  cut down by a Herman(3),cut down by a Djinni(2),cut down by a Stalka Beast(2)
81  Magic User  Sorcerer  Human  10  0  20.60  20.0  22.0  100.0  100.0  3.70  5.00  124.30  0.60  0.0  2.90  cut down by a Djinni(2),cut down by a Dread Lock(2),cut down by a Vampire(2)
82  Magic User  Warlock  Dwarven  10  0  20.60  20.0  22.0  100.0  100.0  1.60  5.00  127.70  0.60  0.0  2.00  cut down by a Drarl(5),cut down by a Herman(2),came up short on a leap(1)
83  Magic User  Warlock  Human  10  0  20.60  20.0  22.0  100.0  100.0  1.70  5.00  130.20  0.60  0.0  2.10  cut down by a Drarl(5),came up short on a leap(1),cut down by a Bones(1)
84  Magic User  Warlock  Wilmsry  10  0  20.60  20.0  22.0  100.0  100.0  1.60  5.00  142.30  0.60  0.0  2.20  cut down by a Drarl(3),cut down by a Stalka Beast(2),cut down by a Drudge(1)
85  Magic User  Wizard  Wilmsry  10  0  20.60  20.0  22.0  100.0  100.0  1.10  5.00  131.90  0.60  0.0  2.40  cut down by a Herman(3),cut down by a Stalka Beast(2),cut down by a Vampire(2)
86  Magic User  Illusionist  Elven  10  0  20.50  21.0  21.0  100.0  100.0  2.10  5.00  120.80  0.50  1.0  2.30  cut down by a Djinni(3),cut down by a Drake(1),cut down by a Dread Lock(1)
87  Magic User  Apprentice  Fridgian  10  0  20.50  20.0  23.0  100.0  100.0  1.10  5.00  80.50  0.50  0.0  1.80  cut down by a Herman(4),cut down by a Vampire(3),cut down by a Dread Lock(1)
88  Fighter  Barbarian  Dwarven  10  0  20.50  20.0  22.0  100.0  100.0  1.50  5.00  77.80  0.50  0.0  1.40  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Vampire(2)
89  Fighter  Bard  Dwarven  10  0  20.50  20.0  22.0  100.0  100.0  2.10  5.00  89.80  0.50  0.0  2.30  cut down by a Drarl(3),cut down by a Ghost(2),cut down by a Craig(1)
90  Magic User  Cleric  Elven  10  0  20.50  20.0  24.0  100.0  100.0  2.10  5.00  96.70  0.50  0.0  2.80  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Djinni(1)
91  Magic User  Court Mage  Dwarven  10  0  20.50  20.0  22.0  100.0  100.0  2.40  5.00  116.30  0.50  0.0  2.80  cut down by a Djinni(3),cut down by a Herman(3),cut down by a Drarl(2)
92  Magic User  Court Mage  Fridgian  10  0  20.50  20.0  22.0  100.0  100.0  1.80  5.00  110.00  0.50  0.0  2.30  cut down by a Djinni(3),cut down by a Drarl(2),cut down by a Herman(2)
93  Magic User  Court Mage  Human  10  0  20.50  20.0  22.0  100.0  100.0  2.40  5.00  116.30  0.50  0.0  2.80  cut down by a Djinni(3),cut down by a Herman(3),cut down by a Drarl(2)
94  Magic User  Court Mage  Wilmsry  10  0  20.50  20.0  22.0  100.0  100.0  1.60  5.00  126.00  0.50  0.0  2.80  cut down by a Herman(5),cut down by a Vampire(2),cut down by a Drarl(1)
95  Thief  Cutthroat  Fridgian  10  0  20.50  20.0  22.0  100.0  100.0  1.60  5.00  101.80  0.50  0.0  2.60  cut down by a Herman(3),cut down by a Drarl(2),cut down by a Djinni(1)
96  Thief  Cutthroat  Troll  10  0  20.50  20.0  23.0  100.0  100.0  3.20  5.00  121.90  0.50  0.0  3.00  cut down by a Stalka Beast(3),cut down by a Craig(1),cut down by a Djinni(1)
97  Fighter  Guard  Elven  10  0  20.50  20.0  22.0  100.0  100.0  1.10  5.00  90.80  0.50  0.0  1.90  cut down by a Drarl(2),cut down by a Ghost(2),cut down by a Herman(2)
98  Fighter  Guard  Fridgian  10  0  20.50  20.0  22.0  100.0  100.0  1.20  5.00  85.40  0.50  0.0  2.20  cut down by a Herman(4),cut down by a Djinni(1),cut down by a Drarl(1)
99  Fighter  Guard  Human  10  0  20.50  20.0  23.0  100.0  100.0  1.50  5.00  95.30  0.50  0.0  2.60  cut down by a Herman(4),cut down by a Drarl(3),cut down by a Vampire(2)
100  Fighter  Knight  Fridgian  10  0  20.50  20.0  22.0  100.0  100.0  1.30  5.00  88.30  0.50  0.0  2.10  cut down by a Herman(3),cut down by a Ghost(2),cut down by a Djinni(1)
101  Fighter  Knight  Human  10  0  20.50  20.0  22.0  100.0  100.0  1.30  5.00  98.40  0.50  0.0  1.50  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Djinni(1)
102  Thief  Pickpocket  Human  10  0  20.50  20.0  22.0  100.0  100.0  1.20  5.00  92.60  0.50  0.0  1.60  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Drudge(2)
103  Thief  Pilfer  Troll  10  0  20.50  20.0  23.0  100.0  100.0  2.40  5.00  115.80  0.50  0.0  2.60  cut down by a Drarl(3),cut down by a Herman(2),cut down by a Craig(1)
104  Fighter  Soldier  Fridgian  10  0  20.50  20.0  22.0  100.0  100.0  1.30  5.00  88.30  0.50  0.0  2.10  cut down by a Herman(3),cut down by a Ghost(2),cut down by a Djinni(1)
105  Fighter  Soldier  Human  10  0  20.50  20.0  22.0  100.0  100.0  1.30  5.00  98.40  0.50  0.0  1.50  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Djinni(1)
106  Magic User  Sorcerer  Fridgian  10  0  20.50  20.0  22.0  100.0  100.0  2.80  5.00  108.30  0.50  0.0  3.20  cut down by a Drarl(4),cut down by a Stalka Beast(2),cut down by a Vampire(2)
107  Magic User  Summoner  Fridgian  10  0  20.50  20.0  22.0  100.0  100.0  1.30  5.00  131.90  0.50  0.0  1.60  cut down by a Craig(2),cut down by a Djinni(2),cut down by a Ghost(2)
108  Fighter  Woodsman  Elven  10  0  20.50  20.0  22.0  100.0  100.0  0.50  5.00  79.50  0.50  0.0  1.10  cut down by a Drarl(4),cut down by a Djinni(2),cut down by a Drudge(1)
109  Fighter  Barbarian  Fridgian  10  0  20.40  20.0  21.0  100.0  100.0  1.10  5.00  68.60  0.40  0.0  2.10  cut down by a Herman(4),cut down by a Ghost(2),cut down by a Drarl(1)
110  Thief  Cloaker  Fridgian  10  0  20.40  20.0  22.0  100.0  100.0  1.40  5.00  115.30  0.40  0.0  2.70  cut down by a Drarl(3),cut down by a Herman(3),cut down by a Djinni(1)
111  Thief  Cutthroat  Dwarven  10  0  20.40  20.0  22.0  100.0  100.0  1.50  5.00  79.30  0.40  0.0  1.50  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Stalka Beast(2)
112  Thief  Cutthroat  Human  10  0  20.40  20.0  22.0  100.0  100.0  1.50  5.00  79.30  0.40  0.0  1.50  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Stalka Beast(2)
113  Magic User  Illusionist  Dwarven  10  0  20.40  20.0  21.0  100.0  100.0  1.70  5.00  112.40  0.40  0.0  1.80  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Drake(1)
114  Magic User  Illusionist  Human  10  0  20.40  20.0  21.0  100.0  100.0  1.70  5.00  112.40  0.40  0.0  1.80  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Drake(1)
115  Magic User  Illusionist  Troll  10  0  20.40  20.0  22.0  100.0  100.0  1.80  5.00  149.90  0.40  0.0  2.20  cut down by a Herman(3),cut down by a Vampire(3),cut down by a Drake(1)
116  Fighter  Knight  Elven  10  0  20.40  20.0  22.0  100.0  100.0  0.80  5.00  65.40  0.40  0.0  2.30  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Herman(2)
117  Fighter  Knight  Troll  10  0  20.40  20.0  22.0  100.0  100.0  2.20  5.00  85.20  0.40  0.0  2.30  cut down by a Djinni(3),cut down by a Drarl(2),cut down by a Herman(2)
118  Fighter  Soldier  Elven  10  0  20.40  20.0  22.0  100.0  100.0  0.80  5.00  65.40  0.40  0.0  2.30  cut down by a Drarl(3),cut down by a Djinni(2),cut down by a Herman(2)
119  Fighter  Soldier  Troll  10  0  20.40  20.0  22.0  100.0  100.0  2.20  5.00  85.20  0.40  0.0  2.30  cut down by a Djinni(3),cut down by a Drarl(2),cut down by a Herman(2)
120  Magic User  Sorcerer  Dwarven  10  0  20.40  20.0  22.0  100.0  100.0  3.20  5.00  102.00  0.40  0.0  2.50  cut down by a Vampire(3),cut down by a Dread Lock(2),cut down by a Djinni(1)
121  Magic User  Summoner  Troll  10  0  20.40  20.0  21.0  100.0  100.0  1.90  5.00  113.90  0.40  0.0  2.60  cut down by a Herman(5),cut down by a Drarl(2),cut down by a Drake(1)
122  Thief  Acrobat  Elven  10  0  20.30  20.0  22.0  100.0  100.0  0.70  5.00  80.20  0.30  0.0  1.20  cut down by a Dread Lock(3),cut down by a Djinni(2),cut down by a Drarl(2)
123  Fighter  Bard  Fridgian  10  0  20.30  20.0  21.0  100.0  100.0  0.80  5.00  51.30  0.30  0.0  1.40  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Herman(2)
124  Fighter  Bard  Human  10  0  20.30  20.0  21.0  100.0  100.0  1.20  5.00  74.30  0.30  0.0  1.80  cut down by a Drarl(2),cut down by a Herman(2),cut down by a Craig(1)
125  Fighter  Bard  Troll  10  0  20.30  20.0  21.0  100.0  100.0  1.90  5.00  93.40  0.30  0.0  1.80  cut down by a Drarl(2),cut down by a Dread Lock(2),cut down by a Stink Bug(2)
126  Magic User  Cleric  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  1.10  5.00  80.90  0.30  0.0  1.90  cut down by a Drarl(2),cut down by a Drudge(2),cut down by a Ghost(2)
127  Thief  Cloaker  Dwarven  10  0  20.30  20.0  22.0  100.0  100.0  1.40  5.00  82.70  0.30  0.0  1.70  cut down by a Craig(2),cut down by a Stalka Beast(2),cut down by a Vampire(2)
128  Thief  Cloaker  Human  10  0  20.30  20.0  22.0  100.0  100.0  1.40  5.00  82.60  0.30  0.0  1.70  cut down by a Herman(2),cut down by a Stalka Beast(2),cut down by a Vampire(2)
129  Magic User  Court Mage  Elven  10  0  20.30  20.0  21.0  100.0  100.0  1.60  5.00  109.50  0.30  0.0  2.20  cut down by a Vampire(3),cut down by a Ghost(2),cut down by a Herman(2)
130  Thief  Pickpocket  Fridgian  10  0  20.30  20.0  21.0  100.0  100.0  1.10  5.00  79.20  0.30  0.0  1.60  cut down by a Herman(4),cut down by a Vampire(3),cut down by a Craig(1)
131  Fighter  Samurai  Troll  10  0  20.30  20.0  22.0  100.0  100.0  1.50  5.00  75.70  0.30  0.0  1.10  cut down by a Djinni(2),cut down by a Drarl(2),cut down by a Bones(1)
132  Magic User  Apprentice  Dwarven  10  0  20.20  20.0  21.0  100.0  100.0  1.70  5.00  75.40  0.20  0.0  2.10  cut down by a Dread Lock(3),cut down by a Herman(2),cut down by a Drarl(1)
133  Magic User  Apprentice  Elven  10  0  20.20  20.0  22.0  100.0  100.0  1.20  5.00  71.00  0.20  0.0  1.70  cut down by a Djinni(2),cut down by a Drake(2),cut down by a Drarl(2)
134  Magic User  Apprentice  Human  10  0  20.20  20.0  21.0  100.0  100.0  1.70  5.00  75.40  0.20  0.0  2.10  cut down by a Dread Lock(3),cut down by a Herman(2),cut down by a Drarl(1)
135  Fighter  Bard  Elven  10  0  20.20  20.0  21.0  100.0  100.0  0.60  5.00  58.10  0.20  0.0  1.30  cut down by a Drarl(2),cut down by a Drudge(2),cut down by a Vampire(2)
136  Magic User  Cleric  Fridgian  10  0  20.20  20.0  22.0  100.0  100.0  0.60  5.00  63.70  0.20  0.0  1.30  cut down by a Drarl(3),cut down by a Djinni(1),cut down by a Drake(1)
137  Magic User  Cleric  Human  10  0  20.20  20.0  21.0  100.0  100.0  0.90  5.00  79.40  0.20  0.0  2.40  cut down by a Herman(4),cut down by a Drarl(2),cut down by a Djinni(1)
138  Magic User  Warlock  Elven  10  0  20.20  20.0  21.0  100.0  100.0  1.60  5.00  98.40  0.20  0.0  2.00  cut down by a Drarl(3),cut down by a Drake(2),cut down by a Herman(2)
139  Magic User  Wizard  Dwarven  10  0  20.20  20.0  21.0  100.0  100.0  1.10  5.00  82.10  0.20  0.0  1.40  cut down by a Herman(3),cut down by a Stalka Beast(3),cut down by a Djinni(2)
140  Magic User  Wizard  Human  10  0  20.20  20.0  21.0  100.0  100.0  1.10  5.00  82.10  0.20  0.0  1.40  cut down by a Herman(3),cut down by a Stalka Beast(3),cut down by a Djinni(2)
141  Fighter  Samurai  Elven  10  0  20.10  20.0  21.0  100.0  100.0  1.60  5.00  48.80  0.10  0.0  1.10  cut down by a Drarl(3),cut down by a Vampire(3),cut down by a Djinni(1)
142  Magic User  Wizard  Elven  10  0  20.10  20.0  21.0  100.0  100.0  0.80  5.00  61.30  0.10  0.0  0.90  cut down by a Djinni(4),cut down by a Herman(2),cut down by a Drarl(1)
143  Magic User  Wizard  Fridgian  10  0  20.10  20.0  21.0  100.0  100.0  1.20  5.00  82.30  0.10  0.0  1.80  cut down by a Herman(4),cut down by a Djinni(3),cut down by a Drarl(2)

BY CLASS:
class  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Thief  480  0  21.28  21.0  23.0  100.0  100.0  2.86  5.00  197.56  1.28  1.0  4.30  cut down by a Herman(120),cut down by a Vampire(62),cut down by a Drarl(59)
Fighter  470  0  20.70  20.0  22.0  100.0  100.0  1.82  5.00  112.99  0.70  0.0  2.63  cut down by a Herman(109),cut down by a Drarl(79),cut down by a Vampire(75)
Magic User  480  0  20.56  20.0  22.0  100.0  100.0  1.98  5.00  124.99  0.56  0.0  2.57  cut down by a Herman(99),cut down by a Drarl(85),cut down by a Vampire(66)

BY SUBCLASS:
sub  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Ninja  60  0  22.62  21.0  27.0  100.0  100.0  7.57  5.00  348.48  2.62  1.0  8.65  cut down by a Herman(19),cut down by a Stalka Beast(7),cut down by a Dread Lock(6)
Cat Burglar  60  0  21.92  21.0  24.0  100.0  100.0  4.03  5.00  274.15  1.92  1.0  6.10  cut down by a Herman(18),cut down by a Drarl(7),cut down by a Djinni(6)
Acrobat  60  0  21.72  21.0  25.0  100.0  100.0  3.73  5.00  265.23  1.72  1.0  6.00  cut down by a Herman(13),cut down by a Vampire(9),cut down by a Drarl(6)
Master of Arms  60  0  21.03  20.0  23.0  100.0  100.0  2.72  5.00  134.73  1.03  0.0  3.40  cut down by a Herman(17),cut down by a Vampire(13),cut down by a Dread Lock(7)
Con Artist  60  0  21.00  21.0  22.0  100.0  100.0  0.35  5.00  158.72  1.00  1.0  2.72  cut down by a Herman(18),cut down by a Djinni(9),cut down by a Vampire(8)
Summoner  60  0  20.87  21.0  22.0  100.0  100.0  2.45  5.00  159.15  0.87  1.0  2.75  cut down by a Herman(12),cut down by a Djinni(11),cut down by a Drarl(10)
Woodsman  60  0  20.87  21.0  22.0  100.0  100.0  1.60  5.00  137.55  0.87  1.0  3.13  cut down by a Herman(19),cut down by a Drarl(11),cut down by a Vampire(10)
Cloaker  60  0  20.80  20.0  22.0  100.0  100.0  1.90  5.00  143.58  0.80  0.0  3.07  cut down by a Stalka Beast(12),cut down by a Herman(10),cut down by a Djinni(8)
Guard  60  0  20.77  20.0  22.0  100.0  100.0  1.82  5.00  125.40  0.77  0.0  3.08  cut down by a Herman(18),cut down by a Drarl(11),cut down by a Vampire(9)
Pickpocket  60  0  20.75  20.0  22.0  100.0  100.0  1.60  5.00  132.63  0.75  0.0  2.57  cut down by a Herman(17),cut down by a Drarl(9),cut down by a Vampire(8)
Barbarian  60  0  20.72  20.0  22.0  100.0  100.0  1.85  5.00  109.93  0.72  0.0  2.35  cut down by a Herman(14),cut down by a Vampire(11),cut down by a Drarl(10)
Pilfer  60  0  20.72  20.0  22.0  100.0  100.0  1.80  5.00  132.02  0.72  0.0  2.65  cut down by a Herman(15),cut down by a Vampire(12),cut down by a Drarl(11)
Cutthroat  60  0  20.70  20.0  22.0  100.0  100.0  1.87  5.00  125.63  0.70  0.0  2.65  cut down by a Stalka Beast(13),cut down by a Herman(10),cut down by a Djinni(9)
Sorcerer  60  0  20.67  20.0  22.0  100.0  100.0  3.05  5.00  132.80  0.67  0.0  3.22  cut down by a Herman(11),cut down by a Vampire(11),cut down by a Drarl(8)
Warlock  60  0  20.62  20.0  22.0  100.0  100.0  1.83  5.00  133.83  0.62  0.0  2.37  cut down by a Drarl(18),cut down by a Herman(12),cut down by a Stalka Beast(5)
Illusionist  60  0  20.60  20.0  22.0  100.0  100.0  1.92  5.00  142.95  0.60  0.0  2.53  cut down by a Djinni(12),cut down by a Drarl(11),cut down by a Vampire(8)
Samurai  50  0  20.58  20.0  22.0  100.0  100.0  2.24  5.00  107.76  0.58  0.0  2.14  cut down by a Drarl(11),cut down by a Vampire(7),cut down by a Herman(6)
Knight  60  0  20.57  20.0  22.0  100.0  100.0  1.48  5.00  98.82  0.57  0.0  2.27  cut down by a Herman(14),cut down by a Djinni(12),cut down by a Drarl(9)
Soldier  60  0  20.57  20.0  22.0  100.0  100.0  1.48  5.00  98.82  0.57  0.0  2.27  cut down by a Herman(14),cut down by a Djinni(12),cut down by a Drarl(9)
Court Mage  60  0  20.55  20.0  22.0  100.0  100.0  2.30  5.00  129.18  0.55  0.0  2.82  cut down by a Herman(17),cut down by a Djinni(11),cut down by a Drarl(9)
Bard  60  0  20.47  20.0  21.0  100.0  100.0  1.42  5.00  90.02  0.47  0.0  2.28  cut down by a Drarl(14),cut down by a Herman(7),cut down by a Vampire(7)
Cleric  60  0  20.45  20.0  22.0  100.0  100.0  1.58  5.00  109.97  0.45  0.0  2.90  cut down by a Drarl(13),cut down by a Herman(11),cut down by a Vampire(7)
Apprentice  60  0  20.38  20.0  22.0  100.0  100.0  1.47  5.00  91.30  0.38  0.0  2.22  cut down by a Herman(13),cut down by a Drarl(11),cut down by a Vampire(10)
Wizard  60  0  20.32  20.0  21.0  100.0  100.0  1.27  5.00  100.70  0.32  0.0  1.75  cut down by a Herman(17),cut down by a Djinni(11),cut down by a Stalka Beast(11)

BY RACE:
race  n  stuck  mean  p50  p90  >=5%  >=10%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
Wilmsry  240  0  21.51  21.0  24.0  100.0  100.0  2.50  5.00  223.69  1.51  1.0  5.04  cut down by a Herman(50),cut down by a Drarl(43),cut down by a Vampire(40)
Troll  240  0  20.98  20.0  23.0  100.0  100.0  3.24  5.00  175.65  0.98  0.0  4.01  cut down by a Herman(58),cut down by a Drarl(30),cut down by a Stalka Beast(25)
Dwarven  240  0  20.76  20.0  22.0  100.0  100.0  2.33  5.00  133.52  0.76  0.0  2.74  cut down by a Herman(59),cut down by a Vampire(42),cut down by a Drarl(40)
Human  240  0  20.75  20.0  22.0  100.0  100.0  2.21  5.00  132.38  0.75  0.0  2.75  cut down by a Herman(64),cut down by a Drarl(36),cut down by a Vampire(36)
Fridgian  230  0  20.57  20.0  22.0  100.0  100.0  1.56  5.00  107.88  0.57  0.0  2.42  cut down by a Herman(65),cut down by a Drarl(36),cut down by a Djinni(26)
Elven  240  0  20.50  20.0  22.0  100.0  100.0  1.46  5.00  97.74  0.50  0.0  2.01  cut down by a Djinni(40),cut down by a Drarl(38),cut down by a Vampire(37)

POOLED (all cells, run-weighted over completed runs):
n  stuck  mean  p50  p90  >=5%  >=10%  >=20%  kills  lvl  actions  gained(mean)  gained(p50)  survived  top causes
1430  0  20.84  20.0  22.0  100.0  100.0  100.0  2.22  5.00  145.40  0.84  0.0  3.17  cut down by a Herman(328),cut down by a Drarl(223),cut down by a Vampire(203)

* Fighter Samurai Fridgian omitted: canon-impossible: Fridges don't wear any armor (the prototype rerolls the sub)
Stuck: 0 of 1430 runs hit maxActions=5000 (own bucket; excluded from depth stats)
Bot: exploreBudget=50  maxActions=5000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=10  workers=4  startDepth=20
elapsed: 165.8s  workers=4  runs=1430
```

#### tune-difficulty --seeds=200 (natural)

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=4  p90=6  max=30

Action-count distribution:
  min=11  p50=359  p90=682  max=3018

Death-cause breakdown:
  starved in the dark  17 (8.5%)
  fell off a wall      17 (8.5%)
  cut down by a Werebeast 12 (6.0%)
  cut down by a Poltergeist 12 (6.0%)
  spent by the dungeon itself 12 (6.0%)
  cut down by a Philly 9 (4.5%)
  cut down by a Dante  8 (4.0%)
  cut down by a Gremlin 8 (4.0%)
  cut down by a Shadow 8 (4.0%)
  undone by a trap     7 (3.5%)
  cut down by a Spectre 7 (3.5%)
  cut down by a China Wolf 7 (3.5%)
  cut down by a Cave Bear 6 (3.0%)
  cut down by a Rinkle 6 (3.0%)
  cut down by a Trachea 5 (2.5%)
  cut down by a Blumble 5 (2.5%)
  cut down by a Herman 4 (2.0%)
  cut down by a Drarl  4 (2.0%)
  cut down by a Zombie 4 (2.0%)
  cut down by a Pogo   3 (1.5%)
  cut down by a Frank  3 (1.5%)
  cut down by a Primp  3 (1.5%)
  came up short on a leap 3 (1.5%)
  cut down by a Rast   2 (1.0%)
  cut down by a Hair   2 (1.0%)
  cut down by a Stink Bug 2 (1.0%)
  cut down by a Hobgoblin 2 (1.0%)
  cut down by a Shriek 2 (1.0%)
  cut down by a Ned    2 (1.0%)
  cut down by a Drake  2 (1.0%)
  cut down by a Google 2 (1.0%)
  cut down by a Ghost  1 (0.5%)
  cut down by a Dog Face 1 (0.5%)
  cut down by a Stalka Beast 1 (0.5%)
  cut down by a Krupke 1 (0.5%)
  cut down by a Sterling 1 (0.5%)
  cut down by a Flube  1 (0.5%)
  cut down by a Dread Lock 1 (0.5%)
  cut down by a Goblin 1 (0.5%)
  cut down by a Drat   1 (0.5%)
  cut down by a Zit    1 (0.5%)
  cut down by a Skeleton 1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a Viper  1 (0.5%)
  cut down by a Drekk  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=329  successes=217 (66.0%)  failures=112  refused=0  exhausted=0
  runs with >=1 attempt: 77 of 200
  SP from parley: 3217 of 138246 total SP (2.3%)

Reach table (% of runs reaching floor N):
  >=5: 28.5%  >=10: 1.0%  >=20: 1.0%  >=30: 0.5%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=11  p50=102  p90=138  max=182

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 46/1840 (2.5%)
  6-10: 39/95 (41.1%)
  11-20: 32/59 (54.2%)
  21-30: 19/30 (63.3%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=230  foeBolted=60  foeDrained=9  foeDebuffed=12  foeHealed=6  foeSummoned=0
  heroResisted=98  heroResistFailed=34
  ability damage: 373 of 20759 total damage taken (1.8%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 200 dead, 0 won, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

#### tune-difficulty --seeds=200 --start-depth=20

```
tune-difficulty: 200 seeded auto-play run(s), start depth 20
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=20  p50=20  p90=22  max=28

Action-count distribution:
  min=7  p50=75  p90=330  max=1041

Death-cause breakdown:
  cut down by a Herman 52 (26.0%)
  cut down by a Drarl  39 (19.5%)
  cut down by a Djinni 18 (9.0%)
  cut down by a Vampire 18 (9.0%)
  cut down by a Stalka Beast 14 (7.0%)
  cut down by a Dread Lock 14 (7.0%)
  cut down by a Ghost  8 (4.0%)
  cut down by a Spectre 6 (3.0%)
  cut down by a Drudge 5 (2.5%)
  undone by a trap     5 (2.5%)
  cut down by a Drake  4 (2.0%)
  cut down by a Undead 4 (2.0%)
  cut down by a Craig  4 (2.0%)
  cut down by a Stink Bug 3 (1.5%)
  cut down by a Floater 3 (1.5%)
  fell off a wall      1 (0.5%)
  came up short on a leap 1 (0.5%)
  starved in the dark  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=123  successes=78 (63.4%)  failures=45  refused=0  exhausted=0
  runs with >=1 attempt: 51 of 200
  SP from parley: 3898 of 436882 total SP (0.9%)

Reach table (% of runs reaching floor N):
  >=5: 100.0%  >=10: 100.0%  >=20: 100.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=0  p50=4  p90=15  max=39

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 0/0 (0.0%)
  6-10: 0/0 (0.0%)
  11-20: 224/419 (53.5%)
  21-30: 136/290 (46.9%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=822  foeBolted=295  foeDrained=41  foeDebuffed=19  foeHealed=11  foeSummoned=5
  heroResisted=371  heroResistFailed=122
  ability damage: 2736 of 19393 total damage taken (14.1%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=20

Outcome: 200 dead, 0 won, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

#### tune-difficulty --seeds=200 --start-depth=35

```
tune-difficulty: 200 seeded auto-play run(s), start depth 35
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=35  p50=35  p90=36  max=39

Action-count distribution:
  min=5  p50=52  p90=184  max=632

Death-cause breakdown:
  cut down by a Drarl  47 (23.5%)
  cut down by a Herman 40 (20.0%)
  cut down by a Vampire 26 (13.0%)
  cut down by a Djinni 26 (13.0%)
  cut down by a Dread Lock 19 (9.5%)
  cut down by a Stalka Beast 15 (7.5%)
  cut down by a Drudge 5 (2.5%)
  cut down by a Ghost  5 (2.5%)
  cut down by a Drake  4 (2.0%)
  cut down by a Spectre 4 (2.0%)
  cut down by a Stink Bug 2 (1.0%)
  cut down by a Craig  2 (1.0%)
  starved in the dark  2 (1.0%)
  cut down by a Undead 1 (0.5%)
  undone by a trap     1 (0.5%)
  cut down by a Floater 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=101  successes=66 (65.3%)  failures=35  refused=0  exhausted=0
  runs with >=1 attempt: 49 of 200
  SP from parley: 3986 of 389955 total SP (1.0%)

Reach table (% of runs reaching floor N):
  >=5: 100.0%  >=10: 100.0%  >=20: 100.0%  >=30: 100.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=0  p50=1  p90=5  max=16

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 0/0 (0.0%)
  6-10: 0/0 (0.0%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 231/437 (52.9%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=785  foeBolted=270  foeDrained=29  foeDebuffed=15  foeHealed=9  foeSummoned=6
  heroResisted=407  heroResistFailed=126
  ability damage: 2550 of 18897 total damage taken (13.5%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=35

Outcome: 200 dead, 0 won, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

#### tune-difficulty --seeds=200 --start-depth=50

```
tune-difficulty: 200 seeded auto-play run(s), start depth 50
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=50  p50=50  p90=51  max=54

Action-count distribution:
  min=5  p50=52  p90=169  max=632

Death-cause breakdown:
  cut down by a Drarl  52 (26.0%)
  cut down by a Herman 36 (18.0%)
  cut down by a Vampire 25 (12.5%)
  cut down by a Djinni 25 (12.5%)
  cut down by a Dread Lock 22 (11.0%)
  cut down by a Stalka Beast 14 (7.0%)
  cut down by a Spectre 5 (2.5%)
  cut down by a Drudge 4 (2.0%)
  cut down by a Ghost  4 (2.0%)
  cut down by a Drake  3 (1.5%)
  cut down by a Stink Bug 3 (1.5%)
  starved in the dark  3 (1.5%)
  undone by a trap     1 (0.5%)
  cut down by a Floater 1 (0.5%)
  cut down by a Undead 1 (0.5%)
  cut down by a Craig  1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=103  successes=64 (62.1%)  failures=39  refused=0  exhausted=0
  runs with >=1 attempt: 50 of 200
  SP from parley: 3940 of 417787 total SP (0.9%)

Reach table (% of runs reaching floor N):
  >=5: 100.0%  >=10: 100.0%  >=20: 100.0%  >=30: 100.0%  >=50: 100.0%

Actions per floor (actions / death depth, per run):
  min=0  p50=1  p90=3  max=12

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 0/0 (0.0%)
  6-10: 0/0 (0.0%)
  11-20: 0/0 (0.0%)
  21-30: 0/0 (0.0%)
  31-50: 182/334 (54.5%)
  51+: 49/97 (50.5%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=758  foeBolted=258  foeDrained=27  foeDebuffed=16  foeHealed=12  foeSummoned=6
  heroResisted=383  heroResistFailed=116
  ability damage: 2433 of 18682 total damage taken (13.0%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=50

Outcome: 200 dead, 0 won, 0 stuck (hit maxActions=20000; excluded from depth stats)
```

#### tune-difficulty --seeds=200 --party (party trigger)

```
tune-difficulty: 200 seeded auto-play run(s), start depth 1
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=5  p90=8  max=13

Action-count distribution:
  min=21  p50=565  p90=20000  max=20000

Death-cause breakdown:
  starved in the dark  17 (8.5%)
  undone by a trap     11 (5.5%)
  cut down by a Werebeast 11 (5.5%)
  fell off a wall      10 (5.0%)
  cut down by a Herman 9 (4.5%)
  spent by the dungeon itself 8 (4.0%)
  cut down by a Drarl  7 (3.5%)
  cut down by a Poltergeist 6 (3.0%)
  cut down by a Sterling 5 (2.5%)
  cut down by a Blumble 5 (2.5%)
  cut down by a Spectre 5 (2.5%)
  cut down by a Dante  5 (2.5%)
  cut down by a Ghoul  4 (2.0%)
  cut down by a Primp  3 (1.5%)
  cut down by a Trachea 3 (1.5%)
  cut down by a Philly 2 (1.0%)
  cut down by a Ghost  2 (1.0%)
  cut down by a Bones  2 (1.0%)
  cut down by a Craig  2 (1.0%)
  cut down by a Cave Bear 2 (1.0%)
  cut down by a Frank  2 (1.0%)
  cut down by a Google 2 (1.0%)
  came up short on a leap 2 (1.0%)
  cut down by a Rast   2 (1.0%)
  cut down by a Zombie 2 (1.0%)
  cut down by a Krupke 2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Drat   2 (1.0%)
  cut down by a Gremlin 1 (0.5%)
  cut down by a Vampire 1 (0.5%)
  cut down by a Flube  1 (0.5%)
  cut down by a Stalka Beast 1 (0.5%)
  cut down by a Dog Face 1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)
  cut down by a Ned    1 (0.5%)
  cut down by a Floater 1 (0.5%)
  cut down by a Drudge 1 (0.5%)
  cut down by a M&M    1 (0.5%)
  cut down by a Rinkle 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=400  successes=266 (66.5%)  failures=134  refused=0  exhausted=0
  runs with >=1 attempt: 78 of 200
  SP from parley: 5106 of 146863 total SP (3.5%)

Reach table (% of runs reaching floor N):
  >=5: 54.8%  >=10: 3.4%  >=20: 0.0%  >=30: 0.0%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=21  p50=104  p90=125  max=209

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 55/2086 (2.6%)
  6-10: 68/214 (31.8%)
  11-20: 7/18 (38.9%)
  21-30: 0/0 (0.0%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=189  foeBolted=78  foeDrained=8  foeDebuffed=15  foeHealed=1  foeSummoned=0
  heroResisted=48  heroResistFailed=19
  ability damage: 362 of 11774 total damage taken (3.1%)

Party (--party, D-12/D-20):
  member forced at run start in 184/200 runs; member alive at run end: 128 (64.0%)

Stuck: 54 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=on  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1

Outcome: 146 dead, 0 won, 54 stuck (hit maxActions=20000; excluded from depth stats)
```

#### tune-economy --seeds=200 (economy trigger)

```
tune-economy: 200 seeded auto-play run(s)
(SCAFFOLD STUB / TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Wilmst earned per run:
  min=0  p50=410  p90=1903  max=49939

Peak wilmst held per run:
  min=50  p50=456  p90=1893  max=49989

Wilmst held at run end:
  min=50  p50=456  p90=1893  max=49989

Reached depth:
  min=1  p50=4  p90=6  max=30

Income by source (goldGained.why):
  chest              110405 (55.3%)
  tableFour           54644 (27.4%)
  off the body        12483 (6.3%)
  parley               9400 (4.7%)
  grimoire             6534 (3.3%)
  pickpocket           3151 (1.6%)
  faerie               3100 (1.6%)

Reach table (% of runs reaching floor N):
  >=5: 28.5%  >=10: 1.0%  >=20: 1.0%  >=30: 0.5%  >=50: 0.0%

Actions per floor (actions / death depth, per run):
  min=11  p50=102  p90=138  max=182

Caster-encounter rate by depth band (encounters with >=1 kit-bearing live foe):
  1-5: 46/1840 (2.5%)
  6-10: 39/95 (41.1%)
  11-20: 32/59 (54.2%)
  21-30: 19/30 (63.3%)
  31-50: 0/0 (0.0%)
  51+: 0/0 (0.0%)

Foe abilities (D-07 readout — informational, not a gate):
  foeCast=230  foeBolted=60  foeDrained=9  foeDebuffed=12  foeHealed=6  foeSummoned=0
  heroResisted=98  heroResistFailed=34
  ability damage: 373 of 20759 total damage taken (1.8%)

Stuck: 0 of 200 runs hit maxActions=20000 (own bucket; excluded from depth stats)

Bot: exploreBudget=50  maxActions=20000  party=off  flee=0.3/0.5(caster)  potion<0.5  camp<0.5  seeds=200  startDepth=1
```

#### Class matrix — Phase 26 AFTER -> retune AFTER (tools/class-pass-diff.mjs --section after)

The Verdict / Reason columns below are Phase 26's editorial machinery (`--out-verdicts`, never invoked here) and are deliberately empty — Phase 27 issues no class verdicts; class-specific tuning is explicitly deferred (27-CONTEXT.md's Deferred Ideas, Phase 26's empty revisit list). The table is included verbatim for the DR round's reference only.

```
**Zero cannot-act cells.** 0 of 143 AFTER natural-start cells have meanKills < 0.5 or stuck > 0 (0 of 5720 natural-start runs stuck; depth-20 slice: 0 of 1430 runs stuck).
**Parameter parity (BEFORE vs AFTER, modulo commit):** natural pair identical; deep pair identical.
**mu (mean death depth over all completed AFTER natural-start runs) = 3.78** (BEFORE mu 3.08, delta +0.70). Bands relative to AFTER mu: too weak < 2.83 (0.75mu) · fine 2.83–5.10 (closed) · too strong > 5.10 (1.35mu) · cannot act = meanKills < 0.5 or stuck > 0. mu is run-weighted: sum(meanDepth x completed) / sum(completed) over the 143 cells.

### By class — BEFORE → AFTER
| # | Class | BEFORE mean | AFTER mean | Δ | BEFORE p50 | AFTER p50 | BEFORE ≥5 | AFTER ≥5 | AFTER ≥10 | AFTER kills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Thief | 3.51 | 4.35 | +0.84 | 3.0 | 4.0 | 26.3 | 43.1 | 2.3 | 9.58 |
| 2 | Fighter | 3.16 | 3.92 | +0.76 | 3.0 | 4.0 | 16.9 | 32.1 | 0.4 | 8.51 |
| 3 | Magic User | 2.55 | 3.06 | +0.51 | 2.0 | 3.0 | 8.5 | 16.5 | 0.1 | 6.64 |

### Sub-classes — bottom five and top five (AFTER)
**Bottom five**

| # | Sub | Class | BEFORE | AFTER | Δ | Band | Verdict | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | Illusionist | Magic User | 2.41 | 3.04 | +0.63 | fine |  |  |
| 21 | Warlock | Magic User | 2.56 | 3.02 | +0.46 | fine |  |  |
| 22 | Court Mage | Magic User | 2.45 | 2.90 | +0.45 | fine |  |  |
| 23 | Wizard | Magic User | 2.46 | 2.87 | +0.41 | fine |  |  |
| 24 | Apprentice | Magic User | 2.35 | 2.73 | +0.38 | too weak | (verdict pending) |  |

**Top five**

| # | Sub | Class | BEFORE | AFTER | Δ | Band | Verdict | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ninja | Thief | 4.33 | 5.72 | +1.39 | too strong | (verdict pending) |  |
| 2 | Acrobat | Thief | 3.89 | 4.79 | +0.90 | fine |  |  |
| 3 | Con Artist | Thief | 4.07 | 4.60 | +0.53 | fine |  |  |
| 4 | Knight | Fighter | 3.30 | 4.53 | +1.23 | fine |  |  |
| 5 | Cat Burglar | Thief | 3.40 | 4.47 | +1.07 | fine |  |  |

### Races — BEFORE → AFTER (Human is the control)
| # | Race | BEFORE | AFTER | Δ | ≥5 BEFORE | ≥5 AFTER | Band | Verdict | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Wilmsry | 3.92 | 4.57 | +0.65 | 36.4 | 49.9 | fine |  |  |
| 2 | Troll | 3.26 | 3.86 | +0.60 | 17.0 | 29.4 | fine |  |  |
| 3 | Human | 2.89 | 3.78 | +0.89 | 11.6 | 28.5 | fine |  |  |
| 4 | Fridgian | 2.90 | 3.58 | +0.68 | 12.2 | 24.7 | fine |  |  |
| 5 | Elven | 2.86 | 3.56 | +0.70 | 15.1 | 27.8 | fine |  |  |
| 6 | Dwarven | 2.61 | 3.29 | +0.68 | 11.0 | 22.8 | fine |  |  |

### Sub-classes — all 24 rows (AFTER rank order)
| # | Sub | Class | BEFORE | AFTER | Δ | ≥5 BEFORE | ≥5 AFTER | Band | Verdict | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ninja | Thief | 4.33 | 5.72 | +1.39 | 42.5 | 64.2 | too strong | (verdict pending) |  |
| 2 | Acrobat | Thief | 3.89 | 4.79 | +0.90 | 31.7 | 51.7 | fine |  |  |
| 3 | Con Artist | Thief | 4.07 | 4.60 | +0.53 | 37.1 | 54.2 | fine |  |  |
| 4 | Knight | Fighter | 3.30 | 4.53 | +1.23 | 20.0 | 50.8 | fine |  |  |
| 5 | Cat Burglar | Thief | 3.40 | 4.47 | +1.07 | 25.4 | 42.1 | fine |  |  |
| 6 | Barbarian | Fighter | 3.66 | 4.30 | +0.64 | 29.6 | 42.1 | fine |  |  |
| 7 | Pilfer | Thief | 3.35 | 4.06 | +0.71 | 24.2 | 39.6 | fine |  |  |
| 8 | Master of Arms | Fighter | 3.22 | 4.00 | +0.78 | 14.2 | 31.3 | fine |  |  |
| 9 | Guard | Fighter | 3.13 | 3.85 | +0.72 | 14.6 | 31.3 | fine |  |  |
| 10 | Woodsman | Fighter | 3.13 | 3.85 | +0.72 | 17.5 | 30.4 | fine |  |  |
| 11 | Bard | Fighter | 3.03 | 3.80 | +0.77 | 13.3 | 29.6 | fine |  |  |
| 12 | Cloaker | Thief | 2.99 | 3.75 | +0.76 | 13.8 | 32.9 | fine |  |  |
| 13 | Cutthroat | Thief | 3.11 | 3.75 | +0.64 | 17.9 | 29.2 | fine |  |  |
| 14 | Pickpocket | Thief | 2.94 | 3.64 | +0.70 | 17.9 | 30.8 | fine |  |  |
| 15 | Soldier | Fighter | 2.98 | 3.54 | +0.56 | 15.4 | 24.2 | fine |  |  |
| 16 | Summoner | Magic User | 2.71 | 3.40 | +0.69 | 9.6 | 22.5 | fine |  |  |
| 17 | Samurai | Fighter | 2.76 | 3.37 | +0.61 | 9.0 | 14.5 | fine |  |  |
| 18 | Sorcerer | Magic User | 2.88 | 3.36 | +0.48 | 12.5 | 18.8 | fine |  |  |
| 19 | Cleric | Magic User | 2.62 | 3.18 | +0.56 | 9.2 | 18.8 | fine |  |  |
| 20 | Illusionist | Magic User | 2.41 | 3.04 | +0.63 | 8.8 | 16.7 | fine |  |  |
| 21 | Warlock | Magic User | 2.56 | 3.02 | +0.46 | 9.2 | 17.5 | fine |  |  |
| 22 | Court Mage | Magic User | 2.45 | 2.90 | +0.45 | 6.7 | 11.7 | fine |  |  |
| 23 | Wizard | Magic User | 2.46 | 2.87 | +0.41 | 7.1 | 12.1 | fine |  |  |
| 24 | Apprentice | Magic User | 2.35 | 2.73 | +0.38 | 5.4 | 14.2 | too weak | (verdict pending) |  |

### Reach table (AFTER natural, pooled over completed runs)
| Floor | BEFORE | AFTER |
| --- | --- | --- |
| ≥5 | 17.2 | 30.6 |
| ≥10 | 0.3 | 0.9 |
| ≥20 | n/a | n/a |

≥20 is not carried per cell by the Phase 22 harness JSON (reach5/reach10 only); the highest per-cell p90 in the AFTER matrix is 10.0, so no cell reaches 20 in 10% or more of its runs; the depth-20 slice below is the ≥20 yardstick.

### Depth-20 slice — Phase 27's yardstick (no verdicts)
**By class**

| # | Class | floors gained BEFORE | AFTER | Δ | encounters survived BEFORE | AFTER | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Thief | 0.25 | 1.28 | +1.03 | 1.72 | 4.30 | +2.58 |
| 2 | Fighter | 0.10 | 0.70 | +0.60 | 1.17 | 2.63 | +1.46 |
| 3 | Magic User | 0.07 | 0.56 | +0.49 | 1.07 | 2.57 | +1.50 |

**By sub-class**

| # | Sub | floors gained BEFORE | AFTER | Δ | encounters survived BEFORE | AFTER | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Ninja | 0.27 | 2.62 | +2.35 | 1.28 | 8.65 | +7.37 |
| 2 | Cat Burglar | 0.33 | 1.92 | +1.59 | 1.57 | 6.10 | +4.53 |
| 3 | Acrobat | 0.30 | 1.72 | +1.42 | 1.25 | 6.00 | +4.75 |
| 4 | Master of Arms | 0.05 | 1.03 | +0.98 | 0.82 | 3.40 | +2.58 |
| 5 | Con Artist | 0.40 | 1.00 | +0.60 | 3.52 | 2.72 | -0.80 |
| 6 | Summoner | 0.00 | 0.87 | +0.87 | 1.03 | 2.75 | +1.72 |
| 7 | Woodsman | 0.13 | 0.87 | +0.74 | 1.73 | 3.13 | +1.40 |
| 8 | Cloaker | 0.15 | 0.80 | +0.65 | 1.58 | 3.07 | +1.49 |
| 9 | Guard | 0.23 | 0.77 | +0.54 | 1.43 | 3.08 | +1.65 |
| 10 | Pickpocket | 0.12 | 0.75 | +0.63 | 1.18 | 2.57 | +1.39 |
| 11 | Barbarian | 0.10 | 0.72 | +0.62 | 1.38 | 2.35 | +0.97 |
| 12 | Pilfer | 0.18 | 0.72 | +0.54 | 1.77 | 2.65 | +0.88 |
| 13 | Cutthroat | 0.22 | 0.70 | +0.48 | 1.62 | 2.65 | +1.03 |
| 14 | Sorcerer | 0.18 | 0.67 | +0.49 | 1.33 | 3.22 | +1.89 |
| 15 | Warlock | 0.03 | 0.62 | +0.59 | 0.90 | 2.37 | +1.47 |
| 16 | Illusionist | 0.05 | 0.60 | +0.55 | 1.23 | 2.53 | +1.30 |
| 17 | Samurai | 0.02 | 0.58 | +0.56 | 0.68 | 2.14 | +1.46 |
| 18 | Knight | 0.07 | 0.57 | +0.50 | 0.93 | 2.27 | +1.34 |
| 19 | Soldier | 0.07 | 0.57 | +0.50 | 0.93 | 2.27 | +1.34 |
| 20 | Court Mage | 0.03 | 0.55 | +0.52 | 1.17 | 2.82 | +1.65 |
| 21 | Bard | 0.10 | 0.47 | +0.37 | 1.38 | 2.28 | +0.90 |
| 22 | Cleric | 0.00 | 0.45 | +0.45 | 0.68 | 2.90 | +2.22 |
| 23 | Apprentice | 0.05 | 0.38 | +0.33 | 1.23 | 2.22 | +0.99 |
| 24 | Wizard | 0.22 | 0.32 | +0.10 | 0.95 | 1.75 | +0.80 |

**By race**

| # | Race | floors gained BEFORE | AFTER | Δ | encounters survived BEFORE | AFTER | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Wilmsry | 0.30 | 1.51 | +1.21 | 2.22 | 5.04 | +2.82 |
| 2 | Troll | 0.13 | 0.98 | +0.85 | 1.35 | 4.01 | +2.66 |
| 3 | Dwarven | 0.12 | 0.76 | +0.64 | 1.18 | 2.74 | +1.56 |
| 4 | Human | 0.13 | 0.75 | +0.62 | 1.07 | 2.75 | +1.68 |
| 5 | Fridgian | 0.07 | 0.57 | +0.50 | 1.18 | 2.42 | +1.24 |
| 6 | Elven | 0.09 | 0.50 | +0.41 | 0.93 | 2.01 | +1.08 |

### Out-of-band cells (appendix)
In band: 117 of 143 cells (fine).

| Band | # | Class | Sub | Race | BEFORE | AFTER | Δ | AFTER kills |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| too weak | 127 | Magic User | Cleric | Dwarven | 2.13 | 2.80 | +0.67 | 6.95 |
| too weak | 128 | Magic User | Warlock | Elven | 2.40 | 2.80 | +0.40 | 6.00 |
| too weak | 129 | Magic User | Apprentice | Fridgian | 2.17 | 2.80 | +0.63 | 5.65 |
| too weak | 130 | Thief | Pickpocket | Dwarven | 2.13 | 2.75 | +0.62 | 5.60 |
| too weak | 131 | Magic User | Summoner | Elven | 2.45 | 2.68 | +0.23 | 6.28 |
| too weak | 132 | Magic User | Wizard | Human | 2.13 | 2.68 | +0.55 | 5.03 |
| too weak | 133 | Magic User | Court Mage | Human | 2.58 | 2.65 | +0.07 | 7.33 |
| too weak | 134 | Magic User | Illusionist | Elven | 2.28 | 2.63 | +0.35 | 5.48 |
| too weak | 135 | Magic User | Warlock | Dwarven | 2.15 | 2.50 | +0.35 | 4.65 |
| too weak | 136 | Magic User | Illusionist | Dwarven | 2.10 | 2.45 | +0.35 | 5.13 |
| too weak | 137 | Magic User | Wizard | Elven | 2.17 | 2.45 | +0.28 | 4.70 |
| too weak | 138 | Magic User | Cleric | Elven | 2.30 | 2.38 | +0.08 | 5.70 |
| too weak | 139 | Magic User | Court Mage | Elven | 1.83 | 2.38 | +0.55 | 5.70 |
| too weak | 140 | Magic User | Wizard | Dwarven | 2.05 | 2.30 | +0.25 | 3.90 |
| too weak | 141 | Magic User | Apprentice | Elven | 1.88 | 2.17 | +0.29 | 3.95 |
| too weak | 142 | Magic User | Court Mage | Dwarven | 1.98 | 2.15 | +0.17 | 4.25 |
| too weak | 143 | Magic User | Apprentice | Dwarven | 1.85 | 2.10 | +0.25 | 2.98 |
| too strong | 1 | Thief | Ninja | Human | 4.80 | 7.08 | +2.28 | 23.65 |
| too strong | 2 | Thief | Ninja | Wilmsry | 5.00 | 6.43 | +1.43 | 21.48 |
| too strong | 3 | Thief | Acrobat | Wilmsry | 5.10 | 6.20 | +1.10 | 8.93 |
| too strong | 4 | Thief | Con Artist | Wilmsry | 4.97 | 5.50 | +0.53 | 2.38 |
| too strong | 5 | Fighter | Woodsman | Wilmsry | 4.45 | 5.43 | +0.98 | 6.40 |
| too strong | 6 | Thief | Ninja | Troll | 4.60 | 5.40 | +0.80 | 15.88 |
| too strong | 7 | Thief | Ninja | Dwarven | 3.93 | 5.35 | +1.42 | 17.20 |
| too strong | 8 | Fighter | Guard | Wilmsry | 4.60 | 5.25 | +0.65 | 7.40 |
| too strong | 9 | Thief | Ninja | Elven | 3.68 | 5.20 | +1.52 | 17.80 |
```

### Comparison vs band

| Measure | JSON path | Phase 26 AFTER (d1e3235) | Retune AFTER (39bfecf) | Target | In band? |
|---|---|---|---|---|---|
| Natural median death depth (bot) | `retune-after.json` `rollups.pooled.p50Depth` | 3 | **4** | exactly 4 | **IN** |
| Natural pooled reach >= 5 | `retune-after.json` `rollups.pooled.reach5` | 17.2 % | **30.6 %** | >= 25 % | **IN** |
| Forced-20 encounters survived (mean) | `retune-after-depth20.json` `rollups.pooled.meanEncountersSurvived` | 1.32 | **3.17** | 3.0-5.0 | **IN** |
| Forced-20 floors gained (p50) | `retune-after-depth20.json` `rollups.pooled.p50FloorsGained` | 0 | **0** | >= 1 | **OUT** |
| Forced-20 floors gained (mean) | `retune-after-depth20.json` `rollups.pooled.meanFloorsGained` | 0.14 | **0.84** | 1.0-2.0 | **OUT** |
| Cannot-act cells | `tools/class-pass-diff.mjs --gate --after retune-after.json` | 0 of 143 | **0 of 143** | 0 (hard gate) | **IN** |

Informational rows (never pass/fail):

- Reach >= 10 (pooled, natural) — `rollups.pooled.reach10` — 0.3 % (Phase 26) -> **0.9 %** (retune). ADVISORY corridor 10-20 %; still well below it, as expected (this corridor is consistency-derived, not itself a lever this plan turns).
- Reach >= 20 (pooled, natural) — `rollups.pooled.reach20` — n/a in the Phase 26 JSON (0.0 % in every v1.1 200-seed readout) -> **0.1 %** (retune, 5720 runs — 1 dp resolution ≈ 0.02 %, so this reading is real, not rounding noise). Target 1.0-2.0 %; **OUT** — recorded as a miss (see "Per-measure reading" below). The 200-seed `tune-difficulty` natural sample separately read 1.0 % (directional, coarser resolution); the class-pass matrix's finer-grained 5720-run pooled figure (0.1 %) is the number of record per the plan's own "every band number is copied from rollups.pooled" rule.
- Pooled mean depth (mu) and p90 — `rollups.pooled.meanDepth`/`p90Depth` — 3.08 / p90 n/a (Phase 26 handoff cites mu only) -> **3.77 / p90 6** (retune; `tools/class-pass-diff.mjs --section after`'s own mu computation reads 3.78, a rounding-path difference from `rollups.pooled.meanDepth`'s 3.77 — both cited, `rollups.pooled` is the number of record).
- By-class means and rank order — Phase 26: Thief 3.51 > Fighter 3.16 > Magic User 2.55. Retune: **Thief 4.35 > Fighter 3.92 > Magic User 3.06** — the rank order SURVIVED (every class gained, Thief the most in absolute terms but the smallest relative gain; Magic User gained the largest relative jump, 2.55 -> 3.06, +20 %).
- Floors 1-4 kill share — the CONTEXT kill table (Phase 26 AFTER cells) read 20 % dead by floor 1, 66 % by floor 3, 85 % by floor 4. The retune AFTER JSON does not carry a per-depth cumulative death table (only `reach5`/`reach10`/`reach20`), so the closest available proxy is "died before reaching floor 5" = `100 - reach5`: Phase 26 82.8 % -> retune **69.4 %** — directionally consistent with the CONTEXT table's shape (most deaths still cluster in floors 1-4, but a meaningfully smaller share of them). The pooled top-3 causes shifted from "cut down by a Dante" (724, Phase 26's #1 at scale) to **starved in the dark (474), undone by a trap (394), cut down by a Werebeast (381)** — Dante no longer appears in the natural pooled top 3 (27-02's demotion holds at full AFTER scale).
- The 200-seed `tune-difficulty` natural sample (a DIFFERENT, smaller sample than the 5720-run pooled matrix above): death-depth p50 **4** (was 3 in the v1.1-era readout), reach table >=5 28.5 % / >=10 1.0 % / >=20 1.0 % / >=30 0.5 % / >=50 0.0 %. Top-5 causes: starved in the dark and fell off a wall tied at 17 (8.5 % each), cut down by a Werebeast and a Poltergeist tied at 12 (6.0 % each), spent by the dungeon itself 12 (6.0 %) — "cut down by a Dante" drops to 8 (4.0 %), well down from its Phase-26-era dominance and now a mid-table cause among many canon tier-2/3/4/5 foes, exactly the intended shape of the demotion (Dante still kills, just not disproportionately on floor 1).
- Forced 35 / 50 (`tune-difficulty --seeds=200 --start-depth=35`/`=50`) — DESCRIPTIVE ONLY, no target, no move made: at 35, death-depth p50 **35** (min 35, p90 36, max 39 — i.e. floors gained p50 **0**, max **4**), top causes Drarl 23.5 % / Herman 20.0 % / Vampire 13.0 % / Djinni 13.0 % / Dread Lock 9.5 %. At 50, death-depth p50 **50** (min 50, p90 51, max 54 — floors gained p50 **0**, max **4**), top causes Drarl 26.0 % / Herman 18.0 % / Vampire 12.5 % / Djinni 12.5 % / Dread Lock 11.0 %. Both bands are dominated by the same handful of canon tier-4/5 foes as the forced-20 slice (Herman, Drarl, Vampire, Djinni, Dread Lock, Stalka Beast) — the curve's own monotone-past-20 guarantee (no dial-back, no forced death) holds by construction; these numbers are reported for the DR round, not judged.

**What the numbers say:** every sanctioned lever this plan was permitted to turn (foe-grace notches, the deep combat dials, `ENCOUNTER_DOT_CAP`) landed exactly where the bounded 4-iteration loop's smoke predicted at full AFTER scale — the natural median hit its target (4) and reach >= 5 cleared its edge by a wide margin (30.6 % vs the 25 % floor), and forced-20 encounters-survived crossed into its band (3.17, up from 1.32). The by-class rank order (Thief > Fighter > Magic User) survived the retune unchanged, and Dante's demotion holds at scale — it no longer appears in the natural pooled top-3 causes at all.

**What the numbers cannot say:** a heuristic bot's play skill is arbitrary (it is a PROXY, not a gate) — these numbers say the mechanical curve moved in the intended direction and by roughly the calibrated amount, not that a human will find depth 20 "dangerous, not hopeless" in the way the user's v1.1 verdict demanded. The two remaining forced-20 misses (floors gained mean 0.84, p50 0) mean the bot rarely survives to a NEW floor past depth 20 even though it now survives more fights there — that gap between "more encounters survived" and "more floors gained" is a real, measured signal, but only the DR round (TUNE-07, 27-04) can say whether a human, playing better than the bot's fixed flee/potion/camp thresholds, actually experiences depth 20 as survivable-with-effort rather than a wall.

**Per-measure reading for every miss:**

- Forced-20 floors gained, p50 (target >= 1, measured 0): every sanctioned lever available to this plan (COMBAT_SCALE_FROM_DEPTH pushed to full identity at depth 20, ENCOUNTER_DOT_CAP eased twice, FOE_POWER_MAX/ABILITY_THREAT_MAX flattened past identity) moved the MEAN (0.14 -> 0.84) without moving the MEDIAN off zero — more than half of forced-20 runs still die on floor 20 itself before ever reaching floor 21. The residual lethality is canon tier-4/5 combat (Herman, Drarl, Vampire — none of them "starved in the dark", so the ladder cap's excluded darkness/rations rungs would not have helped this row even if taken) — handed to the DR round (TUNE-07, 27-04).
- Forced-20 floors gained, mean (target 1.0-2.0, measured 0.84): short of the lower edge by 0.16 after every sanctioned move; same root cause as the p50 miss above — handed to the DR round.
- Reach >= 20 (target 1.0-2.0 %, measured 0.1 % at 5720 runs): reaching depth 20 naturally requires surviving floors 1-19 first, which this plan deliberately did NOT ease past floor 5 (the deep dials only soften depths >= `COMBAT_SCALE_FROM_DEPTH`, now 21, so depths 6-20 are still full canon-plus-Phase-21 combat) — the natural median row and the reach>=20 row pull in different directions by design (the user's own priority order puts the median/reach5 shallow rows and the forced-20 rows ahead of reach>=20). Handed to the DR round with the ladder's ceiling stated: reaching reach>=20's 1.0-2.0% target without also raising the natural median further would require a lever this plan's ladder cap does not sanction (e.g. easing depths 6-19, which was never in scope — only depths 2-4's early-floor levers and the >=`COMBAT_SCALE_FROM_DEPTH` deep dials were).

### Counterweight triggers (measured)

| Trigger | Measured (AFTER, pin 39bfecf) | Threshold (v1.1) | Fired? |
|---|---|---|---|
| Economy | `tune-economy --seeds=200` peak wilmst held, p50 = **456** | > 5000 | **NOT fired** (well below — 456 vs 5000) |
| Party | `tune-difficulty --seeds=200 --party` death-depth p50 = **5**; solo (`--seeds=200`, no `--party`) death-depth p50 = **4**; 1.5x solo p50 = 6 | party p50 > 1.5x solo p50 | **NOT fired** (5 < 6) |

Neither counterweight trigger fired — no upkeep/economy dial is touched this plan (CONTEXT lever 4). If a future DR round or a later milestone re-measures either trigger and finds it fired, the v1.1 recipe (lootDepth routing for the economy trigger, memberUpkeepScale for the party trigger — both documented at 21-04 Task 2) is the follow-up; it is out of scope for this constants-only pass.

### Not changed, and why

- **Darkness from floor 4** (`DARK_FROM_DEPTH` form) — NOT taken. The ladder cap (orchestrator decision, context commit `4d18e80`) permits only the landed "hold through floor 3" form, which is parity-clean; the from-floor-4 form was never on the table for 27-03 regardless of the smoke reading. Planner calibration: this rung alone (on top of S0) measured ≈ 21.7 % reach5 / p50 3 — a smaller gain than the grace notches actually taken.
- **Trap/wall-fall ramp from floor 1** (`HAZARD_FROM_DEPTH` 2 -> 1) — NOT taken. Excluded by the same ladder cap regardless of the smoke reading; this plan only tunes the hazard ramp's VALUES from floor 2 (unchanged this plan: `HAZARD_SCALE_AT_START` 0.5, `HAZARD_FLAT_THROUGH_DEPTH` 3, `HAZARD_CANON_FROM_DEPTH` 5), never `HAZARD_FROM_DEPTH` itself. Planner calibration: hazard-from-1 alone measured ≈ 24.0 % reach5 / p50 4 (a real gain, but the excluded rung's own fixture cost — the encounters `trap` scenario, seed 1, plus ~12 depth-1 unit pins — was never worth paying once the grace notch alone reached the target).
- **Starting rations +1/+2** (`STARTING_RATIONS_BONUS`) — NOT taken. Excluded by the ladder cap; would have diverged all 14 chargen fixture seeds. Planner calibration: rations+2 on top of the strongest parity-clean set measured ≈ 30.8 % reach5 / p50 4 — a real gain, but again not needed once the grace notch alone met the target, and the ladder cap forbids it regardless.
- **Floor-1 foe grace** (`FOE_GRACE_AT_1` < 1.0, the LAST RESORT rung) — NOT taken (and never would have been reached even under the plan's own unrestricted ladder: the planner's own calibration note already flagged that this rung "adds nothing measurable once Dante is gone" — 34.7 % reach5 at T5 vs 35.4 % at T4, i.e. a small REGRESSION, not a gain). `FOE_GRACE_AT_1` stays exactly 1.0; floor 1 remains canon-by-construction, the single structural guarantee that Dante->Ned (seed 303) is still the phase's only declared parity divergence.
- **`FOE_GRACE_AT_2`'s third notch** (0.5 -> 0.35) — available (permitted by the ladder cap, which allows up to three notches) but NOT taken: the natural band was already IN (median 4, reach5 30.6 %) after the second notch (0.5); turning a third notch risked overshooting past the "back off if > 6" guidance for no required gain.
- **Bot parameters and `tools/lib/tuning-bot.mjs`** — byte-identical to `5565b22` (verified via `git diff --quiet`); the only harness change across Phase 27 is 27-01's additive `rollups.pooled`/`reach20` readout, which changes no run, no draw, and no `Bot:` line.
- **Floor 1-2 non-combat knobs and floor-1 combat** — canon by construction (`DENSITY_CANON_THROUGH_DEPTH` = 2, `FOE_GRACE_AT_1` = 1.0, `HAZARD_FROM_DEPTH` >= 2); the movement fixture's floor-2 darkness is unchanged (`DARK_HOLD_THROUGH_DEPTH`'s landed form holds floor 2's canon single blob).
- **Class / race / sub-class features** — Phase 26's revisit list was empty; this plan issues no class-specific verdicts (the class-pass-diff `--section after` rendering's Verdict/Reason columns are deliberately blank). If the DR round names a specific class or sub-class as an outlier, that is a v1.3 follow-up, not this plan's scope.
- **Spells, items** — untouched; out of scope for a constants-only difficulty retune.
- **Upkeep / economy code** — untouched; both counterweight triggers measured above did NOT fire, so no v1.1 recipe (lootDepth routing, memberUpkeepScale) was implemented.
- **`FOE_LVL_BIAS`** — stays reserved at 0; not needed this retune.
- **`BREATHER_EVERY`** — stays 5; not part of this retune.
- **The curve past depth 20** — monotone non-decreasing by construction (verified by Task 1's automated monotone check across depths 1-200); no dial-back, no forced death — the user's standing rule, upheld structurally, not by convention.
- **The bestiary beyond Dante/Ned** — untouched this plan; 27-02's landed demotion (Form C) is unchanged.
- **Con Artist's talk-heavy runs** — watched, not touched (Deferred Ideas); the retune AFTER's by-sub-class table shows Con Artist at 4.60 mean depth (was 4.07), a modest gain in line with every other sub-class, not a special case requiring intervention.

### DR checklist — TUNE-07

This round is the phase's exit criterion (D-16) — the retuned constants under
test are the final `### Change table (27-02 / 27-03)` values: `COMBAT_SCALE_FROM_DEPTH` 21,
`FOE_CAP_MAX` 4, `FOE_POWER_MAX` 1.15, `ABILITY_THREAT_MAX` 1.3 (with their unchanged
`*_SOFT_K` pairs: `FOE_CAP_SOFT_K` 20, `FOE_POWER_SOFT_K` 35, `ABILITY_THREAT_SOFT_K` 30),
plus the non-combat caps `ENCOUNTER_DOT_CAP` 13, `DARK_BLOB_CAP` 3, `DARK_RADIUS_CAP` 7,
and `FOE_GRACE_AT_2` 0.5. The curve this produces at 20 / 35 / 50 (foeCap / foePower /
abilityThreat / dots / darkBlobs / darkRadius, from the change table's curve row):

| d | foeCap | foePower | abilityThreat | dots | darkBlobs | darkRadius |
|---|---|---|---|---|---|---|
| 20 | 3 | 1.0000 (exact) | 1.0000 (exact) | 13 | 3 | 7 |
| 35 | 4 | 1.0523 | 1.1180 | 13 | 3 | 7 |
| 50 | 4 | 1.0863 | 1.1896 | 13 | 3 | 7 |

The retune AFTER band verdicts (from `### Comparison vs band` above), one line each:

- Natural median death depth (bot): **4** — target exactly 4 — **IN**
- Natural pooled reach >= 5: **30.6%** — target >= 25% — **IN**
- Forced-20 encounters survived (mean): **3.17** — target 3.0-5.0 — **IN**
- Forced-20 floors gained (p50): **0** — target >= 1 — **OUT**
- Forced-20 floors gained (mean): **0.84** — target 1.0-2.0 — **OUT**
- Cannot-act cells: **0 of 143** — hard gate — **IN**
- Reach >= 20 (pooled, informational): **0.1%** — target 1.0-2.0% — **OUT**

The bot is a rarity floor, not the verdict — a human plays better than its fixed
flee/potion/camp thresholds. The tester is the user, on the Pixel 7, and only
the tester fills in the Verdict block below.

#### Build under test

- Commit: `91c5b13064e9b33d8670d42729ee13a9be4deebb` (full hash; this plan makes NO
  engine/content/src/mazeworld.html/tools/test change — `git diff --quiet 39bfecf -- engine content src mazeworld.html tools test`
  exits 0, so this is the 27-03 pin's tree).
- APK: `android/app/build/outputs/apk/debug/app-debug.apk` — 9,452,268 bytes,
  2026-09-15 18:21:05.114258600 -0400.
- Version: 1.2.0 (3) (`android/version.properties`).
- `npm test`: 1448/1448 green; parity: 33/33 green (`node --test test/parity/*.test.js test/parity/harness/*.test.js`).
- **Device unreachable this session:** `adb devices` and `adb mdns services` both
  returned empty lists (retried once after `adb kill-server`/`start-server`, per
  protocol) — the Pixel 7 (`adb-28051FDH200H0R`) did not answer over wireless adb.
  The build was NOT installed or relaunched. Per the no-uninstall prohibition,
  nothing was touched on the phone. No signer mismatch was observed (install
  was never attempted). To install once the phone is reachable again (wake
  the screen / re-enable wireless debugging on the Pixel 7), run:
  1. `"C:/Users/Dell/AppData/Local/Android/Sdk/platform-tools/adb.exe" devices` (or
     `adb mdns services` if the port rotated — rediscover per STATE.md's Device notes)
  2. `"C:/Users/Dell/AppData/Local/Android/Sdk/platform-tools/adb.exe" -s <serial> install -r android/app/build/outputs/apk/debug/app-debug.apk`
  3. `"C:/Users/Dell/AppData/Local/Android/Sdk/platform-tools/adb.exe" -s <serial> shell am force-stop com.darktierstudios.delvedierepeat`
     then `"C:/Users/Dell/AppData/Local/Android/Sdk/platform-tools/adb.exe" -s <serial> shell monkey -p com.darktierstudios.delvedierepeat -c android.intent.category.LAUNCHER 1`
  4. Verify: `"C:/Users/Dell/AppData/Local/Android/Sdk/platform-tools/adb.exe" -s <serial> shell dumpsys package com.darktierstudios.delvedierepeat | grep -E "versionName|lastUpdateTime"`
     — `lastUpdateTime` should read later than the APK's 2026-09-15 18:21 timestamp
     and `versionName` should read `1.2.0`.

#### Starting a run at depth N

1. Start (or resume) a run.
2. Tap the HUD gear icon → **Settings**.
3. Press and **HOLD** the last row, "Version 1.2.0 (3)" (≈ 1.2 s — a plain tap
   does nothing).
4. The hidden **"Start at depth (dev)"** row appears.
5. Type the depth (20, 35, or 50).
6. Tap **Start**.
7. The sheet closes, the log shows "Floor N." with the dev banner ("A dev
   run. The graveyard has agreed to look the other way."), and the HUD
   shows a **DEV chip**. The hero is level 5 with a `300 x N` wilmst purse.
   This run is never buried and never counts as a best depth.

Each forced run below is a **fresh dev start** — die or abandon the current
run between them; don't chain all three off one dev start.

#### Run 1 — forced 20 (the acceptance bar)

**what should be true:** the v1.1 words "instant death on any combat" must no
longer be true — a level-5 hero should get 3-5 fights, not one (band:
encounters survived 3.0-5.0; retune AFTER **3.17**); clearing floor 20 should
be possible but not expected (band: floors gained p50 >= 1, mean 1.0-2.0;
retune AFTER p50 **0** / mean **0.84** — both recorded misses, so clearing
even one floor already beats the bot). The curve here (from the change
table): cap **3**, power **1.0000 (exact)**, cadence **1.0000 (exact)**, dots
**13**, blobs **3**, radius **7** — depth 20 is now full canon identity, no
combat bonus at all.

| Check | Tester's notes |
|---|---|
| Fights before death (count) | (to be filled by the tester) |
| Floors cleared from 20 | (to be filled by the tester) |
| Did any single fight feel like a coin flip or a wall? (name the foe) | (to be filled by the tester) |
| Session length (start/end clock) | (to be filled by the tester) |
| Ended for a reason I understood — yes/no + epitaph | (to be filled by the tester) |
| Free notes | (to be filled by the tester) |

#### Run 2 — forced 35

**what should be true:** descriptive only — the run should wrap up naturally
(no dial-back, no forced death); death should come from the curve (foe cap
**4**, power **1.0523**, cadence **1.1180**, from the change table), not from
a cliff; report floors gained and fights survived. The bot's tune-difficulty
readout at this depth is the yardstick: death-depth p50 **35** (min 35, p90
36, max 39 — floors gained p50 **0**, max **4**), top causes Drarl 23.5% /
Herman 20.0% / Vampire 13.0% / Djinni 13.0% / Dread Lock 9.5% — expect the
same handful of canon tier-4/5 foes.

| Check | Tester's notes |
|---|---|
| Fights before death (count) | (to be filled by the tester) |
| Floors cleared from 35 | (to be filled by the tester) |
| Did any single fight feel like a coin flip or a wall? (name the foe) | (to be filled by the tester) |
| Session length (start/end clock) | (to be filled by the tester) |
| Ended for a reason I understood — yes/no + epitaph | (to be filled by the tester) |
| Free notes | (to be filled by the tester) |

#### Run 3 — forced 50

**what should be true:** descriptive only — the run should wrap up naturally
(no dial-back, no forced death); death should come from the curve (foe cap
**4**, power **1.0863**, cadence **1.1896**, from the change table), not from
a cliff; report floors gained and fights survived. The bot's tune-difficulty
readout at this depth is the yardstick: death-depth p50 **50** (min 50, p90
51, max 54 — floors gained p50 **0**, max **4**), top causes Drarl 26.0% /
Herman 18.0% / Vampire 12.5% / Djinni 12.5% / Dread Lock 11.0% — same
handful of canon tier-4/5 foes as the forced-20/35 slices.

| Check | Tester's notes |
|---|---|
| Fights before death (count) | (to be filled by the tester) |
| Floors cleared from 50 | (to be filled by the tester) |
| Did any single fight feel like a coin flip or a wall? (name the foe) | (to be filled by the tester) |
| Session length (start/end clock) | (to be filled by the tester) |
| Ended for a reason I understood — yes/no + epitaph | (to be filled by the tester) |
| Free notes | (to be filled by the tester) |

#### Run 4 — natural (floor 1 onward)

**what should be true:** floor 1 still kills careless level-1 characters
(traps, starvation, a bad fight), but no longer three-strikes-a-round from
one canon foe — Dante is now met from tier 2 (level 2+ / depth 2+) and Ned
holds tier 1; darkness arrives smaller from floor 3 (blobs capped at 3,
radius capped at 7) and density ramps a floor later (dots hold at floor-2's
canon count through floor 3). The band's natural median is 5-6 in the
human's own words (retune AFTER pooled bot p50 **4**, reach >= 10 **0.9%**,
reach >= 20 **0.1%**) — a human, playing better than the bot's fixed
thresholds, should typically outlast it.

| Check | Tester's notes |
|---|---|
| Death depth | (to be filled by the tester) |
| First Humans encounter (who, which floor, how did it go) | (to be filled by the tester) |
| Darkness / starvation felt (floors 3-5) | (to be filled by the tester) |
| First fight that felt like the ramp (floor) | (to be filled by the tester) |
| Session length (start/end clock) | (to be filled by the tester) |
| Ended for a reason I understood — yes/no + epitaph | (to be filled by the tester) |
| Free notes | (to be filled by the tester) |

#### Flag if noticed (observations, not tasks)

- Any class that feels wrong at depth 20 (Phase 26's revisit list is empty —
  name it here and it becomes a v1.3 candidate).
- Con Artist talk-heavy runs (watch, don't touch — a Deferred Idea).
- The Oracle voice slipping out of family-friendly sarcasm.
- Ned's line landing flat.

### Verdict (TUNE-07)

**Overall verdict:** **deferred** (user, 2026-09-15)

**Per-run notes above complete:** (to be filled by the tester)

**If deferred — the user's reason, verbatim:** "Let's defer. We'll have more tuning eventually. For now, what is left to wrap up? I have another milestone of fixes, questions that might affect tuning to sure degree, so let's move on for now. I'm away and so my phone isn't available until i return." — The retuned constants (pin 39bfecf: canon through depth 20, foe grace ×0.5 at floors 2–4, dot cap 13, Dante tier 2 / Ned tier 1) SHIP as landed; the two recorded bot misses (forced-20 floors gained p50 0 / mean 0.84; reach ≥ 20 0.1 %) and the unplayed DR round carry into the next tuning pass after the user's next milestone of fixes.

**Gate at hand-off:** npm test 1448/1448, parity 33/33, pin 91c5b13, APK
2026-09-15 18:21:05 (build succeeded; NOT installed — device unreachable this
session, see `#### Build under test` above for the install commands) —
2026-09-15.

**What happens next:** tuned → TUNE-07 closes the milestone's deferred
TUNE-04 verdict; the phase's VERIFICATION flips to passed on the user's
word; per the standing rule the assistant then ASKS whether to push a
versionCode-bumped signed AAB to the Play internal-testing track (`node tools/bump-version.mjs`
+ `npm run android:release`) — never unasked. tune-again → ONE more bounded
iteration inside this phase: 27-03's iteration protocol on `engine/difficulty.js`
constants only (+ `PHASE_27_PINS`), a `#### Addendum — tune-again iteration`
under the change table with before/after values and a rationale, a fresh
smoke, a rebuild, and a second round of this same checklist; no re-plan.
deferred → the user's reason is recorded verbatim above and the milestone
closes on it; the shipping constants stay as pinned. The phase cannot be
marked complete while the verdict is blank.
