# Combat log audit — floor 13, Human Samurai (2026-09-21, build `dbcdd66`)

User asked: "Analyze for errors so we can make sure combat is actually weighing correctly." Full Oracle log for one encounter (Cave Bear, Rast, Rast), read chronologically:

| Step | Line(s) | Verdict |
|---|---|---|
| Encounter + initiative | you 14 / them 12, "Samurai honour — they go first" | correct — the Samurai's one-bad rule overrides a won initiative by design |
| Phobia | afraid 2 rounds, "rattled from the dark" | correct (dark + phobia trigger) |
| Round 1 foe turn | Bear 8 vs 5 miss · Rast 7 vs 5 miss · Rast 4 vs 5 hit for 15 | correct — ONE swing per foe (Phase 52 cadence), roll-under need 5 consistent across all six swings |
| Your action | You call Riposte (1 round) | correct |
| Round 2 foe turn | Bear 7v5 miss → pays 37 → falls (+20 XP) · Rast 7v5 miss → pays 40 → falls (+90 XP) · Rast 9v5 miss → pays 37 → falls (+45 XP) | correct — every miss during the riposte round pays weapon damage; the `break` after a riposte kill (engine/combat.js:2584) exits only the dead foe's SWING loop (line 2413), the foe loop continues (all three foes acted). An earlier read of this as "remaining foes skip their swing" was WRONG and its todo was withdrawn. |
| Per-kill loot | +1 / +2 / +3 wilmst, Cedar Staff, 2× ration | correct — per-kill, not end-of-fight |
| XP | +20 / +90 / +45 | correct — `killSpFor` = d-roll × foe level × 5 (canon): two level-3 Rasts rolled 6 and 3 |
| Fight end | "The fear passes" → "Nothing left standing" | correct — afraid timer released at fight end |

**No mechanical defect.** What the log does show is the TUNING story, not a rules error: on floor 13 the hero took ONE hit (15 hp) from six foe swings and killed all three foes with ripostes of 37–40 in two rounds. That is the identity `DIALS` build (foe level `0.6 + 0.2·d` ≈ 3 on floor 13, riposte one-shotting a 12-wp Rast) plus the Table-4 HP-dot compounding inflating the hero — exactly what 54-07's fit (cycle 3, USER RULING G) is moving. Related todos: the HP-dot regression (fix in flight), wilmst economy (per-kill +1..3 vs a 300 × depth cache), Oracle line order.

## Fight 2 — floor 15, same Human Samurai (died)

Table 2 roll 8 → Humans: Craig, Primp, Frank. Initiative you 12 / them 19. Chronological:

| Round | Foe turn | Your action | Check |
|---|---|---|---|
| 1 | Craig 8v5 miss · Primp 2v5 hit 13 · Frank 8v5 miss | call Riposte | one swing per foe ✓ |
| 2 | Craig 4v5 hit 20 · Primp 5v5 hit 15 · Frank 9v5 miss → pays 36 → falls (+75 XP, +29 w) | call Sidestep | roll = need hits (consistent with every log) ✓ |
| 3 | Craig 2v3 hit 23 · Primp 10v3 miss ("needs 3: Sidestep −2") | blow rings off Craig's armor | Sidestep applied ✓ |
| 4 | Craig 5v3 miss · Primp 4v3 miss | blow rings off Craig's armor | ✓ |
| 5 | Craig 3v5 hit 26 · Primp 3v5 hit 19 | 1v6 Critical 72 → Craig falls (+80 XP, +48 w, Cloak of Strength) | Sidestep expired on time; crit bypasses the soak ✓ |
| 6 | Primp 4v5 hit 17 → You have died | — | ✓ |

- "Your blow rings off Craig's armor" ×2 = `engine/foeDamage.js` step (3): a d20 ≤ the foe's natural `sp.ar` soaks the whole physical blow (canon p.44 mirror, D-05..07); a critical ignores it — the log matches (two soaks, then the roll-1 crit lands 72). Not a defect.
- Damage taken: 7 hits × 13–26 = 133 over 6 rounds; smooth (Phase 52 ceiling holds), ~50 % foe hit rate at need 5, one swing per foe per round.
- XP roll × level × 5 (Frank lvl 3 roll 5; Craig lvl 4 roll 4); Humans carry real coin (+29 / +48) — the beast +1..3 vs cache 300 × depth gap is the wilmst todo.
- Ability turns (Riposte, Sidestep) replaced swings (Phase 52) ✓.

**Verdict: no mechanical defect.** Tuning readout: a death on floor 15 (Breakaway; Ruling C target S_15 ≈ 7.6 %) with no spike — the shape the curve wants at that depth. The floor-13 fight (too easy) and this one (fatal) bracket what cycle 3's fit is shaping in between.
