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
