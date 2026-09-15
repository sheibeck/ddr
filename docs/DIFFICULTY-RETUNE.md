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
