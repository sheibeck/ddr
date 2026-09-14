# Parley Rebalance (Phase 20) — before/after ledger

Phase 20 (PARLEY-01, PARLEY-02, PARLEY-03, PARLEY-04, LANG-01, LANG-02) rewrites
parley's payout formula, tightens the Humans wilmst-bonus odds, caps parley to
one attempt per encounter with a failure-aggro cost, retunes the Con Artist's
odds, and wires Language/Helm-of-Knowledge fluency into the same bonus term so
it is never balanced twice. Every number recorded in this document is
**informational** (D-15, the `content/BESTIARY-REBALANCE.md` / 18-06
precedent) — this plan makes **no difficulty-dial or economy-number change**;
Phase 21 owns the one consolidated retune.

## What changes (locked decisions)

| Rule | Before (prototype / pre-Phase-20 engine) | After (Phase 20) | Decision |
|---|---|---|---|
| SP payout formula | `round(Σ(d6 × f.lvl) × 2.5)` | `round(Σ killSpFor(c, f, d6) × 0.5)` — structurally derived from the SAME formula `killFoe` uses | D-01, D-02 |
| Humans wilmst bonus check | `d6 >= 4` (50% fire chance) | `d6 === 6` (~17% fire chance); the amount formula `d6 × 100 × depth` is untouched | D-03 |
| Draw shape | one d6 per live foe (SP), one d6 wilmst check, one more d6 only if it fires | unchanged — only VALUES diverge, never the rng stream position for a given outcome | D-04 |
| Attempts per encounter | unlimited, zero cost | one attempt; `C.parleyTried` set on any attempt (success or failure); a re-sent `parley` after that is rejected with `parleyExhausted`, zero rng draws | D-05 |
| Failure aggro | none | `C.parleyInsulted = true` on failure; every foe to-hit roll in `foeTurn` gets `need += 1` / `mNeed += 1` for the rest of the fight (zero extra draws); cleared with `state.combat` at `endCombat` | D-06, D-20 |
| Con Artist parley bonus | `+6` | `+4`; documented target ~60-65% success at even level vs. a solo foe (`need = 9 + 4 + level - top`) | D-07 |
| Need ceiling | none | `need = min(9 + bonus, 17)` — an 85% success ceiling regardless of how many bonuses stack | D-08 |
| Language / Helm gate | boolean OR (`skill(c,"Language") || eff(c,"tongue") > 0`) | graduated `fluency(c)` (0/1/2): 1 if either, 2 if both — single source of truth for BOTH the availability gate and the bonus term | D-09, D-10 |
| Bonus term | no fluency contribution | `+2 × fluency(c)` added into the same `bonus` sum, before the D-08 clamp | D-10 |
| Encounter types opened by fluency | Language/Helm (boolean) opens the TALKATIVE set (Humans, Demons, Lair Beasts, Beasts); Magical always refused | fluency ≥ 1 opens TALKATIVE; fluency 2 additionally opens Magical ("perfect fluency in one language"); Walking Dead never parleys for anyone | D-11 |
| Wilmsry vs. Magical | `canParley` already excludes Magical unconditionally, so the `parleyRefused wilmsryVsMagical` branch in `parley()` is dead code | a fluency-2 Wilmsry now passes `canParley` for Magical, and `parley()` refuses with the canon grudge line — a reachable refusal that does NOT consume the one-attempt cap | D-12 |
| Con Artist pre-fight talkdown | `startCombat`'s `f.lvl <= 1 && d6 <= 4` foe-flees check | unchanged; not gated by the one-attempt flag, does not scale with fluency | D-16 |

## Seed-303 fixture (the one parity-exposed parley)

**Character** (`newRun(303)`, `[VERIFIED: engine run against the pre-Phase-20
engine]`): Wilmsry, Thief, sub Con Artist, level 1, starting `sp: 0`, `gold: 50`,
no `Language` skill, no `tongue` effect (`fluency(c) === 0`).

**`startCombat(false, "Humans")`:** rolls 2× Dante (Humans, level 1); the
Con Artist pre-fight talkdown (D-16, untouched by this phase) fires and one
Dante flees, leaving 1 live foe at parley time.

**Exact draw sequence at the `parley` action** (`d20=2, d6=5, d6=5, d6=2`):

| Draw # | Die | Value | Purpose (BEFORE code) |
|---|---|---|---|
| 1 | d20 | 2 | `parleyRolled` roll |
| 2 | d6 | 5 | per-live-foe SP roll (1 live foe) |
| 3 | d6 | 5 | Humans wilmst-bonus check |
| 4 | d6 | 2 | wilmst amount (drawn only because check #3 fired under the OLD `>=4` rule) |

BEFORE: `bonus` = 6 (Con Artist) + 4 (Wilmsry) + 1 (level) − 1 (top) = 10 →
`need 19`; roll 2 ≤ 19 → success; SP formula `round((5×1) × 2.5) = 13`;
wilmst check `5 >= 4` fires, amount `2 × 100 × 1 = 200`; final `c.sp = 13`,
`c.gold = 250`.

The AFTER column is **computed** from the locked D-01/D-02/D-03/D-07/D-08
formulas against the SAME draws above (need 17, sp 7, gold unchanged at 50,
only 3 draws since the wilmst check no longer fires) and will be
re-measured against the landed code and pinned in
`test/parity/FIXTURE-INVENTORY.md`'s "Phase 20 parley divergence" section by
20-03 — see that heading there for the final numbers.

## tune-difficulty BEFORE (pre-Phase-20 engine)

Measured with `node tools/tune-difficulty.mjs --seeds=200` against the engine
at commit `04eb229` (engine/, content/, src/, mazeworld.html identical to
that commit for this entire plan — confirmed by `git diff --quiet 04eb229 --
engine content src mazeworld.html`), captured 2026-09-14.

```
tune-difficulty: 200 seeded auto-play run(s)
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=1  p90=2  max=4

Action-count distribution:
  min=12  p50=189  p90=4094  max=20000

Death-cause breakdown:
  starved in the dark  42 (21.0%)
  fell off a wall      31 (15.5%)
  cut down by a Dante  23 (11.5%)
  undone by a trap     23 (11.5%)
  maxActionsHit        15 (7.5%)
  came up short on a leap 12 (6.0%)
  cut down by a Gremlin 12 (6.0%)
  spent by the dungeon itself 11 (5.5%)
  cut down by a Philly 6 (3.0%)
  cut down by a Drekk  5 (2.5%)
  cut down by a Pogo   4 (2.0%)
  cut down by a Shriek 2 (1.0%)
  cut down by a Shadow 2 (1.0%)
  cut down by a Viper  2 (1.0%)
  cut down by a Bat/Rat 1 (0.5%)
  cut down by a M&M    1 (0.5%)
  cut down by a Google 1 (0.5%)
  cut down by a Trachea 1 (0.5%)
  cut down by a Werebeast 1 (0.5%)
  cut down by a China Wolf 1 (0.5%)
  cut down by a Poltergeist 1 (0.5%)
  cut down by a Hair   1 (0.5%)
  cut down by a Drake  1 (0.5%)
  cut down by a Hobgoblin 1 (0.5%)

Parley (D-15 readout — informational, not a gate):
  attempts=151  successes=87 (57.6%)  failures=64  refused=0  exhausted=0
  runs with >=1 attempt: 52 of 200
  SP from parley: 1010 of 27008 total SP (3.7%)

Outcome: 185 dead, 0 won (legacy floor-5 Gate), 15 hit MAX_ACTIONS
```

**Headline BEFORE numbers:** across 200 seeds, 52 runs (26%) attempted at
least one parley, for 151 total attempts (bot re-tries after every failure
— unlimited retries is exactly the free-scouting behavior D-05 closes),
57.6% succeeded, and parley supplied 1010 of 27008 total SP earned (3.7%
share). `parleyExhausted` reads 0, as expected — that event type does not
exist until 20-02 lands.

## tune-difficulty AFTER (Phase 20 engine)

_Pending — filled by 20-03 after the engine rules land._

## Comparison

_Pending — 20-03._

## Deferred to Phase 21

- Retuning the Humans wilmst bonus AMOUNT (`d6 × 100 × depth`) — this phase
  only retunes the CHANCE it fires (D-03), never the payout formula itself.
- Any difficulty-dial consequence of parley being a less-lucrative,
  once-per-encounter choice (economy owns whether anything else needs to
  move to compensate) — the consolidated retune (Phase 21) is where every
  power-changing milestone's numbers get folded together, so this phase's
  parley change is measured, not compensated for, here.
