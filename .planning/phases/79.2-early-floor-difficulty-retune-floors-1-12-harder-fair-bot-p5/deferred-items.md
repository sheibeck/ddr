# Phase 79.2: deferred items (found during 79.2-04, out of scope)

## 1. The two committed fixture-scan outputs are stale, and not because of the early-floor lock

Found while running 79.2-04's scan step. The lock is not the cause: the same diffs appear when the scans are run under the pre-lock dials (`setDialsForTuning(fit/start.json)`).

### `tools/initiative-fixture-scan-output.txt`

**What is stale.** The live scan reports `action-script.magic.json#cast-damage` as initiative-exposed (maxRound 2), so the live `MOVED SET` has 4 holders. The committed file has 3.

**Why.** This has held since the 79.2-01 Freeze ruling ("deals its damage, then freezes 1d4 rounds"). The Shriek survives the Freeze and the fight reaches round 2.

**Why it is not regenerated.** Regenerating the file would make `divergence-records.test.js`'s INIT-01 test ("the holders declaring Phase 51 are exactly the initiative scan's MOVED SET") require a Phase 51 declaration on cast-damage.

**Decision needed** (orchestrator or user): either declare "51" on cast-damage's action-path record and regenerate the file, or keep the committed file as is. 79.2-04 did neither, because this belongs to the Freeze ruling, not to the lock.

**What the lock itself moves in this file:** only the `fields.after (engine @end)` lines of lose, lose-apprentice and lose-plain, plus the phase column (`+79.2`).

### `tools/worn-fixture-scan-output.txt`

**What is stale.** The economy `end.after.items` line still shows the old Lockpicks `txt` ("1–5 on d10 against any lock"). The live engine says "6–10 on d10 against any lock".

**Why.** The text was changed by an earlier roll-high reword. The parity harness carves this text out (`stripCloakArmorTxt`).

**Effect.** The file's MOVED SET line is correct, and HEDGE-03 passes. The lock moves nothing in this scan.
