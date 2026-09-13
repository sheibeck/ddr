# Bestiary Rebalance — before/after stat table (BEST-01, BEST-02, D-04)

This document is the committed before/after stat table BEST-01 requires: every
one of the 53 rows in `content/bestiary.js` is reviewed against its bestiary
tier (1-5) using a reproducible yardstick (`tools/bestiary-yardstick.mjs`),
outliers are named with an explicit disposition, and the pre-ability discount
(BEST-02) numbers are recorded before they land. It is the artifact Phase 21's
consolidated difficulty retune starts from, and it is referenced from
`content/bestiary.js`'s own header comment (18-05 adds the reference once the
numbers actually move). Phase 18-01 fills the BEFORE half (this table, the
verdicts, the pre-ability discount plan, the tune-difficulty BEFORE readout);
Phase 18-06 fills the AFTER half once CANON-01/03/04/05 land in the engine and
18-05 applies the number changes named below.

## Method (D-01)

A bestiary tier N is meant to be a **fair fight for a level-N hero** — the
same clamp `startCombat` itself uses to pick a foe's level:

```
foeLevel = clamp(min(heroLevel, floorDepth), 1, 5)
```

The yardstick models a **composite hero**: the average of the Magic User,
Fighter, and Thief classes at chargen plus average level-ups, Human race, no
store purchases, no skills. Concretely (18-RESEARCH.md "Hero-side formulas"):

- `heroHP = [41.7, 46.2, 50.0, 54.5, 60.0]` (levels 1-5, averaged maxWP across
  the three classes' chargen + level-up gains)
- `avgDmg(level) = level^2 + 4.69` (the per-level base-damage term plus the
  three classes' averaged weapon+proficiency bonus)
- a generic to-hit need of 4 on `STRIKE_DICE = [20, 12, 10, 8, 6]` (the
  midpoint of MU=3 / Fighter=5 / Thief=4), adjusted per-creature when the
  foe's own `sp.toHit` / `sp.fast` / `sp.magicOnly` changes what the hero
  needs to land a blow

The foe side mirrors `engine/combat.js#foeTurn`'s actual damage formula
exactly: `dmg = foeLevel^2 + (sp.dmg ? rollDice(sp.dmg) : d6-fallback)`,
multiplied by `sp.atk` swings per round, using the engine's own `foeDie =
max(8, STRIKE_DICE[level-1])` and a flat need-of-5 to hit an unarmoured,
unskilled Human hero (`engine/derived.js#foeToHitVs`'s baseline):

```
foeDPR = atk * (tier^2 + avgDiceOrFallback) * 6 / foeDie
```

**TTK** (time-to-kill) is how many rounds the hero needs to kill the foe:
`wp / heroExpectedDamagePerSwing`, doubled for `sp.twice` creatures. **RTD**
(rounds-to-die) is how many rounds the foe needs to kill the hero:
`heroHP[tier] / foeDPR`. Both are expected-value approximations, not
simulated outcomes — they are meant to catch order-of-magnitude outliers
(D-02), not to replace an actual playtest.

**Simplifications explicitly assumed, not hidden:** no player armor is
modeled in RTD (a worst-case, no-armor-benefit baseline); no player skills
(Hardiness, Agility, etc.); Human race only. `sp.never_melee` (Drudge) is
still **inert** until Phase 19's ability system lands — Drudge is scored as
it actually fights TODAY (a plain melee-capable row with no `sp.dmg`), not as
its eventual caster-only design; this is deliberate, not an oversight.

**How to regenerate:** run `node tools/bestiary-yardstick.mjs
--mechanics=prototype` for the BEFORE table (mechanics as they exist before
this phase's canon modifiers land) or `node tools/bestiary-yardstick.mjs`
(canon, the default) for the AFTER table, then paste the stdout verbatim
between the matching HTML-comment marker pair bracketing the BEFORE or AFTER
table below, replacing the existing block. Phase 21 re-runs this exact
command for its consolidated retune.

## The outlier rule (D-02) and its direction

A row is flagged **`over-tier`** when its TTK is more than **2.0x** its
tier's median TTK (too tanky relative to its peers) OR its lethality
(`medianRTD / RTD`) exceeds **2.0x** (too deadly relative to its peers). The
comparison is **strict greater-than** — a row landing at exactly 2.00x is NOT
flagged (see Werebeast below: its TTK ratio is exactly 2.00 and is unflagged
on that axis; only its lethality ratio of 2.60 flags it). Medians are
computed per tier, over **finite** TTKs only (a `magicOnly` creature's
Infinite TTK is excluded so it can never skew a tier's median).

A row is flagged **`under-tier`** when its TTK ratio or lethality ratio falls
below **0.5x** — e.g. Bat/Rat, Zit, Shadow, Stink Bug, Wolf, Floater, Flube,
and Drarl (tier 5).

**This is a conservative pass: it fixes OVER-tier outliers only.** Under-tier
rows are recorded in the table below with the disposition "under-tier — no
buff in a conservative pass, Phase 21", never buffed in this phase. This
follows D-02's own stated intent — keep prototype numbers everywhere else so
Phase 21 retunes from a stable baseline — and every locked fix this phase
DOES make (the D-03 pre-ability discount, the D-18 Drake/Werebeast fixes)
moves a number DOWN, never up. Making a trivial creature harder is a buff,
and a buff pass is explicitly Phase 21's call, not this phase's.

## tune-difficulty readout (D-16) — informational, not a gate

`tools/tune-difficulty.mjs` is a heuristic auto-play bot, not a pass/fail
gate — its own header says so, and this document repeats it: the bot's play
skill is arbitrary (it may flee too eagerly or too rarely), and it is blind
to abilities until Phase 21. Both readouts below are a rough sanity signal
only, read for gross shape (does the death-depth distribution move at all?),
never as proof of "balanced."

### BEFORE (captured against the unmodified phase-start tree, commit `e01ac46`, `--seeds=200`)

```
tune-difficulty: 200 seeded auto-play run(s)
(TUNING PROXY ONLY — not a pass/fail gate, not a substitute for human playtest)

Death-depth distribution:
  min=1  p50=1  p90=2  max=6

Action-count distribution:
  min=13  p50=179  p90=2544  max=20000

Top 5 death causes:
  starved in the dark          34 (17.0%)
  undone by a trap              30 (15.0%)
  cut down by a Dante          28 (14.0%)
  fell off a wall               27 (13.5%)
  maxActionsHit                 13 (6.5%)

Outcome: 187 dead, 0 won (legacy floor-5 Gate), 13 hit MAX_ACTIONS
```

### AFTER

_Filled by 18-06 after the rebalance and the canon modifiers land._

## BEFORE — full table (mechanics=prototype, 53 rows)

Generated from `content/bestiary.js` at commit `e01ac46` (the unmodified
phase-start tree) via `node tools/bestiary-yardstick.mjs
--mechanics=prototype` — mechanics as they ACTUALLY behave today: `sp.ar`,
`sp.slow`, and `sp.halfDmg` are all inert (CANON-01/03/05 have not landed
yet).

<!-- yardstick:before:begin -->
Mechanics: prototype | T1 med TTK=3.51 RTD=30.89 | T2 med TTK=3.31 RTD=10.87 | T3 med TTK=2.34 RTD=5.56 | T4 med TTK=1.43 RTD=3.73 | T5 med TTK=1.62 RTD=2.81
| Tier | Type | Creature | wp | atk | dmg | toHit | ar | flags | heroE | TTK | xTTKmed | foeDPR | RTD | xLethal | Flag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Beasts | Bat/Rat | 1.00 | 2 | 0d0+1 |  |  |  | 1.42 | 0.70 | 0.20 | 1.20 | 34.75 | 0.89 | under-tier |
| 1 | Beasts | Shriek | 3.00 | 1 | d6* |  |  |  | 1.42 | 2.11 | 0.60 | 1.35 | 30.89 | 1.00 |  |
| 1 | Beasts | Viper | 3.00 | 1 | d6* |  |  |  | 1.42 | 2.11 | 0.60 | 1.35 | 30.89 | 1.00 |  |
| 2 | Beasts | Cave Bear | 25.00 | 1 | 1d8+0 |  |  |  | 3.62 | 6.90 | 2.08 | 4.25 | 10.87 | 1.00 | over-tier |
| 2 | Beasts | Zit | 4.00 | 1 | d6* | 4.00 |  |  | 3.62 | 1.10 | 0.33 | 3.75 | 12.32 | 0.88 | under-tier |
| 3 | Beasts | Drat | 26.00 | 1 | d6* | 5.00 | 12.00 |  | 6.85 | 3.80 | 1.63 | 7.50 | 6.67 | 0.83 |  |
| 3 | Beasts | Flube | 7.00 | 1 | d6* |  |  |  | 6.85 | 1.02 | 0.44 | 7.50 | 6.67 | 0.83 | under-tier |
| 3 | Beasts | Rast | 12.00 | 1 | 1d8+4 |  |  |  | 6.85 | 1.75 | 0.75 | 10.50 | 4.76 | 1.17 |  |
| 3 | Beasts | Sterling | 35.00 | 1 | 1d12+0 |  |  | halfDmg | 6.85 | 5.11 | 2.19 | 9.30 | 5.38 | 1.03 | over-tier |
| 3 | Beasts | Wolf | 6.00 | 1 | 1d6+2 |  |  |  | 6.85 | 0.88 | 0.38 | 8.70 | 5.75 | 0.97 | under-tier |
| 4 | Beasts | Drake | 135.00 | 1 | 2d10+4 |  |  |  | 12.93 | 10.44 | 7.30 | 23.25 | 2.34 | 1.59 | over-tier |
| 4 | Beasts | Stink Bug | 4.00 | 1 | d6* | 2.00 |  |  | 7.76 | 0.52 | 0.36 | 14.63 | 3.73 | 1.00 | under-tier |
| 5 | Beasts | Dread Lock | 40.00 | 1 | d6* |  |  |  | 24.74 | 1.62 | 1.00 | 21.38 | 2.81 | 1.00 |  |
| 5 | Beasts | Stalka Beast | 125.00 | 2 | d6* |  |  |  | 24.74 | 5.05 | 3.13 | 42.75 | 1.40 | 2.00 | over-tier |
| 1 | Demons | Gremlin | 8.00 | 1 | 1d6+3 |  |  |  | 1.42 | 5.62 | 1.60 | 2.25 | 18.53 | 1.67 |  |
| 2 | Demons | Poltergeist | 10.00 | 2 | d6* |  |  |  | 3.62 | 2.76 | 0.83 | 7.50 | 6.16 | 1.76 |  |
| 3 | Demons | Rinkle | 16.00 | 1 | d6* |  |  |  | 6.85 | 2.34 | 1.00 | 7.50 | 6.67 | 0.83 |  |
| 4 | Demons | Djinni | 86.00 | 1 | d6* |  |  | caster | 12.93 | 6.65 | 4.65 | 14.63 | 3.73 | 1.00 | over-tier |
| 4 | Demons | Ghost | 28.00 | 1 | d6* |  |  | magicOnly | 0.00 | inf | inf | 14.63 | 3.73 | 1.00 | infinite |
| 4 | Demons | Spectre | 32.00 | 1 | d6* |  |  | magicOnly | 0.00 | inf | inf | 14.63 | 3.73 | 1.00 | infinite |
| 5 | Demons | Djinni | 86.00 | 1 | d6* |  |  | caster | 24.74 | 3.48 | 2.15 | 21.38 | 2.81 | 1.00 | over-tier |
| 1 | Humans | Dante | 20.00 | 3 | d6* |  |  |  | 1.42 | 14.06 | 4.00 | 4.05 | 10.30 | 3.00 | over-tier |
| 2 | Humans | China Wolf | 16.00 | 2 | 1d6+0 |  |  |  | 3.62 | 4.42 | 1.33 | 7.50 | 6.16 | 1.76 |  |
| 2 | Humans | Krupke | 23.00 | 1 | 1d8+2 |  | 12.00 | caster | 3.62 | 6.35 | 1.92 | 5.25 | 8.80 | 1.24 |  |
| 3 | Humans | Frank | 20.00 | 1 | 1d8+6 |  |  |  | 6.85 | 2.92 | 1.25 | 11.70 | 4.27 | 1.30 |  |
| 3 | Humans | Primp | 18.00 | 1 | 1d8+2 |  |  |  | 6.85 | 2.63 | 1.13 | 9.30 | 5.38 | 1.03 |  |
| 4 | Humans | Craig | 24.00 | 1 | 1d12+0 |  | 15.00 |  | 12.93 | 1.86 | 1.30 | 16.88 | 3.23 | 1.15 |  |
| 4 | Humans | Herman | 36.00 | 1 | 0d0+25 |  | 15.00 |  | 12.93 | 2.78 | 1.95 | 30.75 | 1.77 | 2.10 | over-tier |
| 5 | Humans | Herman | 36.00 | 1 | 0d0+25 |  | 15.00 |  | 24.74 | 1.46 | 0.90 | 37.50 | 1.60 | 1.75 |  |
| 1 | Lair Beasts | Dog Face | 6.00 | 1 | 1d6+0 |  |  |  | 1.42 | 4.22 | 1.20 | 1.35 | 30.89 | 1.00 |  |
| 1 | Lair Beasts | Goblin | 4.00 | 1 | d6* |  |  |  | 1.42 | 2.81 | 0.80 | 1.35 | 30.89 | 1.00 |  |
| 1 | Lair Beasts | Hobgoblin | 5.00 | 1 | 1d6+1 |  |  |  | 1.42 | 3.51 | 1.00 | 1.65 | 25.27 | 1.22 |  |
| 1 | Lair Beasts | M&M | 3.00 | 1 | d6* |  |  |  | 1.42 | 2.11 | 0.60 | 1.35 | 30.89 | 1.00 |  |
| 1 | Lair Beasts | Pogo | 4.00 | 1 | 1d6+4 |  |  | fast | 1.14 | 3.51 | 1.00 | 2.55 | 16.35 | 1.89 |  |
| 2 | Lair Beasts | Hair | 12.00 | 1 | 1d6+0 |  |  |  | 3.62 | 3.31 | 1.00 | 3.75 | 12.32 | 0.88 |  |
| 2 | Lair Beasts | Trachea | 8.00 | 1 | 1d10+0 |  |  |  | 3.62 | 2.21 | 0.67 | 4.75 | 9.73 | 1.12 |  |
| 3 | Lair Beasts | Blumble | 16.00 | 1 | 1d12+0 |  |  |  | 6.85 | 2.34 | 1.00 | 9.30 | 5.38 | 1.03 |  |
| 4 | Lair Beasts | Drarl | 19.00 | 1 | d6* |  |  |  | 12.93 | 1.47 | 1.03 | 14.63 | 3.73 | 1.00 |  |
| 5 | Lair Beasts | Drarl | 19.00 | 1 | d6* |  |  |  | 24.74 | 0.77 | 0.47 | 21.38 | 2.81 | 1.00 | under-tier |
| 1 | Magical | Drekk | 7.00 | 1 | d6* |  |  |  | 1.42 | 4.92 | 1.40 | 1.35 | 30.89 | 1.00 |  |
| 2 | Magical | Shadow | 4.00 | 1 | d6* |  |  |  | 3.62 | 1.10 | 0.33 | 3.75 | 12.32 | 0.88 | under-tier |
| 3 | Magical | Werebeast | 32.00 | 2 | 1d10+5 |  |  |  | 6.85 | 4.67 | 2.00 | 23.40 | 2.14 | 2.60 | over-tier |
| 4 | Magical | Drudge | 12.00 | 1 | d6* |  |  | caster,never_melee | 12.93 | 0.93 | 0.65 | 14.63 | 3.73 | 1.00 |  |
| 5 | Magical | Drudge | 12.00 | 1 | d6* |  |  | caster,never_melee | 24.74 | 0.49 | 0.30 | 21.38 | 2.81 | 1.00 | under-tier |
| 1 | Walking Dead | Philly | 5.00 | 1 | 1d4+2 |  |  | twice,slow | 1.42 | 7.03 | 2.00 | 1.65 | 25.27 | 1.22 | over-tier |
| 2 | Walking Dead | Google | 19.00 | 1 | 1d8+0 |  | 15.00 |  | 3.62 | 5.25 | 1.58 | 4.25 | 10.87 | 1.00 |  |
| 2 | Walking Dead | Skeleton | 6.00 | 1 | d6* | 4.00 |  | twice | 3.62 | 3.31 | 1.00 | 3.75 | 12.32 | 0.88 |  |
| 3 | Walking Dead | Ghoul | 15.00 | 1 | 1d6+0 |  |  |  | 6.85 | 2.19 | 0.94 | 7.50 | 6.67 | 0.83 |  |
| 3 | Walking Dead | Zombie | 12.00 | 1 | d6* |  |  |  | 6.85 | 1.75 | 0.75 | 7.50 | 6.67 | 0.83 |  |
| 4 | Walking Dead | Bones | 14.00 | 1 | d6* |  |  |  | 12.93 | 1.08 | 0.76 | 14.63 | 3.73 | 1.00 |  |
| 4 | Walking Dead | Floater | 8.00 | 1 | d6* |  |  |  | 12.93 | 0.62 | 0.43 | 14.63 | 3.73 | 1.00 | under-tier |
| 4 | Walking Dead | Undead | 18.00 | 1 | d6* |  |  |  | 12.93 | 1.39 | 0.97 | 14.63 | 3.73 | 1.00 |  |
| 5 | Walking Dead | Vampire | 95.00 | 2 | d6* |  |  | caster | 24.74 | 3.84 | 2.38 | 42.75 | 1.40 | 2.00 | over-tier |
<!-- yardstick:before:end -->

## Review verdicts (BEST-01)

| Creature | Tier / Type | Prototype TTK (xmed) | Prototype RTD (xlethal) | Verdict | Planned change (18-05) | Reason |
|---|---|---|---|---|---|---|
| Dante | T1 Humans | 14.06 (4.00x) | 10.30 (3.00x) | DEFERRED to Phase 21 | no change this phase | fixture-exposed (D-14) — no carve-out this phase |
| Cave Bear | T2 Beasts | 6.90 (2.08x) | 10.87 (1.00x) | UNCHANGED, borderline | no change | within the composite-hero approximation error (18-RESEARCH A1: single-digit %); noted for Phase 21 — the research-resolved follow-ups (D-18) added only Drake and Werebeast |
| Philly | T1 Walking Dead | 7.03 (2.00x) | 25.27 | UNCHANGED — exactly at the strict threshold | no wp change | CANON-05 slow (18-03) lowers its canon TTK to 3.84 (1.09x) |
| Sterling | T3 Beasts | 5.11 (2.19x) | 5.38 | UNCHANGED wp 35 (D-19) | no wp change; wire `halfDmg` (CANON-03) | halfDmg roughly doubles TTK to ~10.23 (4.38x): canon-intended two hearts — revisit in Phase 21 |
| Werebeast | T3 Magical | 4.67 (2.00x) | 2.14 (2.60x lethal) | FIX (D-18) | `sp.dmg` 1d10+5 → 1d10+0, keep `atk:2` | expected RTD 2.87 (1.94x lethal); note text "two attacks at d10+5" → "two attacks at d10" so the note stays truthful (D-02's own contradiction clause) |
| Drake | T4 Beasts | 10.44 (7.30x) | 2.34 | FIX (D-18) | wp 135 → 38 | expected TTK 2.94 (2.05x — the ~2x band D-18 targets, not the median); stays the single tankiest tier-4 body (Herman 36); fire breath cooldown is CANON-02 / Phase 19 |
| Herman | T4 Humans | 2.78 (1.95x) | 1.77 (2.10x lethal) | UNCHANGED | no change | flat 25 base damage is explicit rulebook text ("strikes as a level five"); its own TTK 1.95x makes the fight self-consistent (2-3 rounds either way); see canon-mode note below (its `sp.ar` raises canon TTK to 5.06) |
| Djinni | T4 and T5 Demons | 6.65 (4.65x) / 3.48 (2.15x) | 3.73 / 2.81 | FIX (D-03) | wp 86 → 65, add `sp.dmg` 1d4+0 | pre-ability discount — revisit Phase 21 |
| Krupke | T2 Humans | 6.35 (1.92x) | 8.80 | FIX (D-03, not itself an outlier) | wp 23 → 17, `sp.dmg` 1d8+2 → 1d6+2 | pre-ability discount |
| Drudge | T4 and T5 Magical | 0.93 / 0.49 | 3.73 / 2.81 | FIX (D-03, HP only) | wp 12 → 9 | never melees per canon so no dice step |
| Vampire | T5 Walking Dead | 3.84 (2.38x) | 1.40 (2.00x) | FIX (D-03) | wp 95 → 71, add `sp.dmg` 1d4+0 | pre-ability discount |
| Stalka Beast | T5 Beasts | 5.05 (3.13x) | 1.40 (2.00x) | FIX (D-03) | wp 125 → 94, add `sp.dmg` 1d4+0 | still ~2.35x after — the D-03 discount is the locked treatment; Phase 21 owns the rest |
| Ghost | T4 Demons | infinite | 3.73 | UNCHANGED, by design | no change | magicOnly canon gate — the creature is intentionally unhittable without a magic weapon |
| Spectre | T4 Demons | infinite | 3.73 | UNCHANGED, by design | no change | magicOnly canon gate, same as Ghost |
| Bat/Rat | T1 Beasts | 0.70 (0.20x) | 34.75 | under-tier — no buff in a conservative pass, Phase 21 | no change | fixture-exposed (D-14) as well as under-tier — no carve-out needed since no change is planned |
| Zit | T2 Beasts | 1.10 (0.33x) | 12.32 | under-tier — no buff in a conservative pass, Phase 21 | no change | canon-correct filler ("hittable only on a 4") |
| Shadow | T2 Magical | 1.10 (0.33x) | 12.32 | under-tier — no buff in a conservative pass, Phase 21 | no change | canon-correct filler (`daggerOnly` gimmick) |
| Stink Bug | T4 Beasts | 0.52 (0.36x) | 3.73 | under-tier — no buff in a conservative pass, Phase 21 | no change | canon-correct filler (WP 4 is the rulebook's literal number, offset by `toHit:2`) |
| Wolf | T3 Beasts | 0.88 (0.38x) | 5.75 | under-tier — no buff in a conservative pass, Phase 21 | no change | canon-correct filler ("nothing special... +2 damage") |
| Floater | T4 Walking Dead | 0.62 (0.43x) | 3.73 | under-tier — no buff in a conservative pass, Phase 21 | no change | filler tier-4 body |
| Flube | T3 Beasts | 1.02 (0.44x) | 6.67 | under-tier — no buff in a conservative pass, Phase 21 | no change | armour-piercing/blind gimmick offsets low WP |
| Drarl (T5) | T5 Lair Beasts | 0.77 (0.47x) | 2.81 | under-tier — no buff in a conservative pass, Phase 21 | no change | filler tier-5 body |
| Drudge (T5) | T5 Magical | 0.49 (0.30x) | 2.81 | under-tier — no buff in a conservative pass, Phase 21 | wp 12 → 9 (D-03, HP-only) | pre-ability discount lowers it further (0.30x → 0.22x); never melees so it stays a caster-only under-tier body by design |
| All other rows | — | — | — | within band — unchanged | no change | every row not named above falls within the conservative pass's tolerance band on both axes |

## Canon modifiers and the AFTER table (CANON-01/03/04/05)

18-06 will paste the `--mechanics=canon` output between the AFTER marker
comment pair below (both marker lines are already in place, bracketing a
placeholder). Two consequences the planner already knows about, ahead of
that table landing:

- **Foe natural armor (D-05, no durability)** raises the melee-only TTK of
  the five `sp.ar` creatures purely by existing — no `wp` is lowered to
  compensate (D-02's conservative pass is about the MECHANIC being new, not
  a prototype number moving): Drat 3.80 → 5.93 (2.54x — using its
  UNCHANGED wp), Krupke (after the D-03 discount) → recompute in 18-06,
  Craig 1.86 → 3.37 (2.36x), Herman T4 2.78 → 5.06 (3.54x), Google 5.25 →
  9.54 (2.88x). Recorded as "canon natural armor (D-05) — melee yardstick
  only, spells bypass (D-06); revisit Phase 21" — the same treatment D-19
  gives Sterling.
- **Damage-source x creature-type multipliers (CANON-04)** are NOT modeled
  by this melee-only yardstick — they depend on the caster's class, which
  this script's composite-hero abstraction doesn't carry. 18-06's AFTER
  table therefore under-states the true canon damage against Demons (from
  Cleric spells) and Walking Dead (from any spell); this is a known,
  documented scope limit of the tool, not a balance gap in the engine.

<!-- yardstick:after:begin -->
_Filled by 18-06._
<!-- yardstick:after:end -->

## Pre-ability discount (D-03, BEST-02)

**Rounding convention:** `Math.round(wp * 0.75)` — a -25% HP cut, matching
the codebase's established convention for every other HP-affecting derived
value (`checkLevel`'s `Math.round(gain * R.wpMul)`, `killFoe`'s
`Math.round(raw * mul)`).

**Dice-step ladder for "one dice-step lower melee damage":** the standard
polyhedral progression `d12 -> d10 -> d8 -> d6 -> d4` (floor at d4). A
creature with NO existing `sp.dmg` field falls back to the engine's generic
`rng.d(6)` (a d6) — for those creatures, "one step down" means authoring
`sp.dmg: {n:1, sides:4, bonus:0}` (a d4) so its currently-inert (pre-Phase-19)
melee swing is a genuine step down from the d6 fallback the moment it ever
swings.

| Creature | Old wp | New wp (-25%, rounded) | Old melee dmg | New melee dmg (one step down) | Notes |
|---|---|---|---|---|---|
| Djinni (Demons T4) | 86 | 65 | none (d6 fallback) | `{1,4,0}` (d4) | pre-ability discount — revisit Phase 21 |
| Djinni (Demons T5) | 86 | 65 | none (d6 fallback) | `{1,4,0}` (d4) | duplicate entry, same fix — pre-ability discount — revisit Phase 21 |
| Krupke (Humans T2) | 23 | 17 | `{1,8,2}` (d8+2) | `{1,6,2}` (d6+2) | pre-ability discount — revisit Phase 21 |
| Drudge (Magical T4) | 12 | 9 | none (never melees per canon) | unchanged — HP-only discount | pre-ability discount — revisit Phase 21 |
| Drudge (Magical T5) | 12 | 9 | none | unchanged | duplicate entry, same fix — pre-ability discount — revisit Phase 21 |
| Vampire (Walking Dead T5) | 95 | 71 | none (d6 fallback) | `{1,4,0}` (d4) | pre-ability discount — revisit Phase 21 |
| Stalka Beast (Beasts T5) | 125 | 94 | none (d6 fallback) | `{1,4,0}` (d4) | pre-ability discount — revisit Phase 21 |

All five recommendations flow directly from the yardstick table above, which
independently confirms all five (except Drudge, whose weakness is already an
intentional never-melee design, and Krupke, whose numbers are not yet a >2x
outlier) as genuine current-state TTK outliers — reinforcing that this is a
real, presently-measurable balance fix, not merely future-proofing.

## Parity carve-outs (BEST-03 / FID-05)

**ZERO.** The four fixture-exposed creatures — Bat/Rat, Shriek, Viper, Dante
(all level 1, per `test/parity/FIXTURE-INVENTORY.md`) — are untouched by this
phase's number changes, so **no `comparables.js` carve-out is added and no
fixture is regenerated**. `test/parity/fixture-inventory.test.js` and
`test/unit/foe-turn-draw-count.test.js`'s FULL_FIGHTS pins are the proof:
both stay green, unmodified, through every plan in this phase.

Every new canon mechanic (`sp.ar`, `sp.slow`, `sp.halfDmg`, and the
type/name-keyed damage multipliers) is gated on a flag that none of the four
fixture-exposed creatures carries (D-15) — Bat/Rat, Shriek, and Viper have no
`sp.ar`/`sp.slow`/`sp.halfDmg` field at all, and Dante is a plain
three-attack Human with none of those flags either. Zero draw-order risk,
zero fixture drift.

## Change ledger

_Filled by 18-06 (a table of every number that actually moved, cross-checked
against this document's Review verdicts and Pre-ability discount sections)._
