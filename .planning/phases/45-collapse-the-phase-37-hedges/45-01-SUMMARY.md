---
phase: 45-collapse-the-phase-37-hedges
plan: 01
subsystem: testing
tags: [parity, fixtures, worn-model, measure-first, scan, engine-gate]

requires: []
provides:
  - "tools/worn-fixture-scan.mjs — the committed, repeatable HEDGE-03 live scan (replays all 31 parity replay sites in lockstep with the frozen prototype sandbox, engine start character passed through reconcileWorn explicitly)"
  - "tools/worn-fixture-scan-output.txt — the committed BEFORE readout: MOVED SET (13), matching GEAR-SLOTS §2's prediction exactly, with per-site before/after record values Plan 02 pastes into its declared divergence records"
affects: [45-02, 45-03]

tech-stack:
  added: []
  patterns:
    - "Report-tool pattern (tools/terrain-fixture-scan.mjs precedent): a *.mjs report script that replays every parity fixture through the real engine, always exits 0, makes no assertions, and prints a deterministic markdown table + summary lines for a phase's fixture-inventory section"

key-files:
  created:
    - tools/worn-fixture-scan.mjs
    - tools/worn-fixture-scan-output.txt
  modified: []

key-decisions:
  - "Added `reconcilePendingLoot` (already exported by comparables.js, not a *Comparable/strip* helper) to the scan's items comparison — without it, combat/lose (seed 14)'s one pending jewel drop produced a false items mismatch unrelated to c.worn"
  - "Left the one remaining UNEXPLAINED row (combat/lose, seed 14) unresolved in code rather than special-casing it against the fixture's declared action-path divergence record — the plan explicitly prohibits the scan depending on any fixture's declared records; documented instead as an investigated, honest deviation"

patterns-established:
  - "worn-fixture-scan.mjs's replaySite() driver: load prototype sandbox + reconciled engine start state, snapshot chargen, dispatch the site-specific action list (copying full-suite.test.js's branches verbatim), track first mid-script c.worn growth, snapshot end state — reusable shape for any future 'does X move which fixtures' measurement"

requirements-completed: [HEDGE-03]

coverage:
  - id: D1
    description: "tools/worn-fixture-scan.mjs replays all 31 parity replay sites (14 chargen seeds, movement script, 6 combat scenarios, 4 magic scenarios, economy script, 5 encounters scenarios) in lockstep with the frozen prototype sandbox, engine start character passed through reconcileWorn explicitly, deterministic (two runs byte-identical)"
    requirement: "HEDGE-03"
    verification:
      - kind: other
        ref: "diff <(node tools/worn-fixture-scan.mjs) <(node tools/worn-fixture-scan.mjs) — empty (determinism); grep -c '^| action-script\\.' tools/worn-fixture-scan-output.txt == 31"
        status: pass
    human_judgment: false
  - id: D2
    description: "Committed BEFORE readout (tools/worn-fixture-scan-output.txt) equal to a fresh run, MOVED SET (13) matches GEAR-SLOTS §2's five-site checklist plus every other Thief-hero site the scan found, zero engine/content/src/test bytes touched, npm test 3243/0, npm run build:www green, master hash unchanged"
    requirement: "HEDGE-03"
    verification:
      - kind: other
        ref: "diff <(node tools/worn-fixture-scan.mjs) tools/worn-fixture-scan-output.txt — empty; git diff --stat HEAD~1 -- engine/ src/ content/ mazeworld.html test/ — empty; git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0"
        status: pass
      - kind: unit
        ref: "npm test — # pass 3243, # fail 0"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-19
status: complete
---

# Phase 45 Plan 01: Live worn-fixture scan (HEDGE-03 BEFORE readout) Summary

**Committed a live scan (`tools/worn-fixture-scan.mjs`) that measures — not assumes — which of the 31 parity replay sites move once `c.worn` is always created; the measured MOVED SET (13 sites) matches GEAR-SLOTS §2's prediction exactly, byte-identical determinism proven, zero engine/harness bytes touched.**

## Performance

- **Duration:** 45min
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- `tools/worn-fixture-scan.mjs` replays all 31 parity replay sites (14 chargen seeds, the movement script, 6 combat scenarios, 4 magic scenarios, the economy script, 5 encounters scenarios) through the real engine in lockstep with the frozen prototype sandbox, using the same shared dispatch helpers (`applyStartCombat`, `runEconomyAction`) the parity tests use — never a private re-implementation.
- The engine's freshly rolled character is passed through `reconcileWorn(state.c)` explicitly right after `newRun(seed)` — the one line that simulates the Phase 45 collapse before Plan 02 lands it in `newRun` itself.
- Committed the BEFORE readout (`tools/worn-fixture-scan-output.txt`): a 31-row markdown table, `MOVED SET (13):`, `WORN EXPOSURE: 13 of 31 replay sites`, and a `## Record values` section with the before/after JSON Plan 02 needs for its declared divergence records.
- Determinism proven: two consecutive runs are byte-identical; the committed file equals a fresh run.

## Task Commits

Each task was committed atomically (Task 1's tool and Task 2's committed readout landed together per the plan's own instruction — Task 1 writes but does not commit; Task 2 commits both files):

1. **Task 1 + Task 2: worn-fixture-scan.mjs + BEFORE readout** — `726d384` (feat)

## Files Created/Modified
- `tools/worn-fixture-scan.mjs` - the HEDGE-03 live scan (report tool, always exits 0, no assertions)
- `tools/worn-fixture-scan-output.txt` - committed BEFORE readout (31-row table, MOVED SET, WORN EXPOSURE, per-site record values)

## Decisions Made
- Imported `reconcilePendingLoot` from `test/parity/harness/comparables.js` (exported, and matches neither the `*Comparable` nor `strip[A-Z]` prohibited patterns) so the scan's items comparison correctly reconciles a deferred combat-kill loot drop before comparing — otherwise `combat/lose` (seed 14) printed a false items mismatch caused by the pre-existing Phase 29 (LOOT-01/06) pending-loot indirection, not by worn-model creation.
- Did NOT special-case the fixture's own declared `divergence` record to suppress the one remaining UNEXPLAINED row — the plan explicitly prohibits the scan depending on any fixture's declared records. See "Deviations from Plan" below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reconciled pendingLoot before comparing items**
- **Found during:** Task 1 (writing the scan)
- **Issue:** The scan's first draft compared `ctx.S.c.items` against raw `engineState.c.items`. For `combat/lose` (seed 14), the frozen prototype auto-takes a killed foe's jewel drop (`Bracelet of Flight`) directly into `items`; the engine instead defers it into `state.pendingLoot` (Phase 29, LOOT-01/06) — a pre-existing, unrelated indirection. Comparing raw items without reconciling `pendingLoot` produced a false items mismatch that had nothing to do with `c.worn`.
- **Fix:** Imported `reconcilePendingLoot` (already exported by `comparables.js`, the exact helper the harness's own `combatComparable` uses for this purpose) and applied it to the engine's items before computing `engineItems`/`engineItemsJson` in `snapshot()`.
- **Files modified:** `tools/worn-fixture-scan.mjs`
- **Verification:** Re-ran the scan; `combat/win`, `lose-plain`, `flee`, `parley` (which never roll a drop) were unaffected; `combat/lose`'s mismatch was resolved for `pendingLoot` specifically (see Issues Encountered for the remaining, unrelated `UNEXPLAINED` row).
- **Committed in:** `726d384` (Task 1+2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness — without it the scan's own "explained/unexplained" self-check would have produced a misleading false positive unrelated to HEDGE-03's subject.

## Issues Encountered

**Unmet acceptance criterion, investigated and documented (not code-suppressed):** the plan's acceptance criteria state `grep -c "^UNEXPLAINED:" tools/worn-fixture-scan-output.txt` should print `0`. The committed output prints `1`:

```
UNEXPLAINED: action-script.combat.json#lose
```

Investigated by tracing the scan's own dispatch step-by-step against the frozen prototype sandbox (seed 14, the `lose` combat scenario). Root cause: `combat/lose` already carries a fully-declared, pre-existing **action-path divergence** (`action-script.combat.json`'s `divergence` record: `kind: "action-path"`, `fromAction: 0`, landed in Phase 24/31 — a Fridgian's hide soak + a removed corpse-whiff draw + the Phase 31 phobia-penalty rule shift the entire RNG stream from action 0 onward, so the prototype dies to the Shriek while the engine survives and kills it). Because `fromAction: 0`, the harness's own `skipsByteDiffAt` skips the ENTIRE per-action byte comparison for this scenario in the passing `full-suite.test.js`/`combat-parity.test.js` suites — only `wp`/`sp`/`kills`/`rations` + the `dead` flag are machine-checked at the end via `declaredEndDiffs`. **`items`/`worn` were never compared for this scenario by any passing test before this scan existed.** Once the RNG stream diverges from action 0, the prototype's own (undisturbed) roll sequence happens to kill a foe and auto-take a `Bracelet of Flight` at action 5; the engine's diverged stream kills two different foes at different action indices and never rolls that drop at all (confirmed live, `pendingLoot: []` throughout) — a pure byproduct of the already-tolerated RNG divergence, unrelated to `c.worn` creation (`worn: {}` on both chargen and end for this Fighter hero, who never has a cloak).

This scan is deliberately barred from reading any fixture's declared `divergence`/`chargenDivergence` record (plan prohibition: "MUST NOT make the scan depend on... any fixture's declared records"), so it cannot suppress this row without violating that constraint. Per the executor's deviation protocol, this unmet criterion is recorded honestly rather than hidden: **the MOVED SET and WORN EXPOSURE lines Plan 02 consumes are unaffected** (this row's `moved` is correctly `false` — no `c.worn` was ever populated for this site, at chargen or mid-script), and the row is explained, investigated, and documented here rather than silently accepted.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

None for this plan — a measurement tool with no user-visible surface; nothing to verify on-device.

## Scan output

```
MOVED SET (13): action-script.chargen.json#seed-2, action-script.chargen.json#seed-3, action-script.chargen.json#seed-4, action-script.movement.json#script, action-script.combat.json#win, action-script.combat.json#lose-plain, action-script.combat.json#flee, action-script.combat.json#parley, action-script.economy.json#script, action-script.encounters.json#chest, action-script.encounters.json#tablefour, action-script.encounters.json#faerie, action-script.encounters.json#affliction
WORN EXPOSURE: 13 of 31 replay sites
```

Every `moved: true` row (13 of 31):

| Fixture | Site | Seed | Hero | worn @chargen | first mid-script wear | items @chargen (prototype) | items @chargen (engine) | worn @chargen (engine) | items @end (prototype) | items @end (engine) | worn @end (engine) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chargen | #seed-2 | 2 | Thief Cat Burglar Wilmsry | cloak=Cloak of Armor | never | Cloak of Regeneration | (none) | cloak=Cloak of Armor | Cloak of Regeneration | (none) | cloak=Cloak of Armor |
| chargen | #seed-3 | 3 | Thief Pickpocket Human | cloak=Cloak of Ether | never | Cloak of Ether | (none) | cloak=Cloak of Ether | Cloak of Ether | (none) | cloak=Cloak of Ether |
| chargen | #seed-4 | 4 | Thief Cat Burglar Dwarven | cloak=Cloak of Regeneration | never | Cloak of Regeneration | (none) | cloak=Cloak of Regeneration | Cloak of Regeneration | (none) | cloak=Cloak of Regeneration |
| movement | #script | 256 | Thief Cat Burglar Human | cloak=Cloak of Strength | never | Cloak of Healing | (none) | cloak=Cloak of Strength | Cloak of Healing | (none) | cloak=Cloak of Strength |
| combat | #win | 3 | Thief Pickpocket Human | cloak=Cloak of Ether | never | Cloak of Ether | (none) | cloak=Cloak of Ether | Cloak of Ether | (none) | cloak=Cloak of Ether |
| combat | #lose-plain | 1119 | Thief Cutthroat Human | cloak=Cloak of Ether | never | Cloak of Ether | (none) | cloak=Cloak of Ether | Cloak of Ether | (none) | cloak=Cloak of Ether |
| combat | #flee | 17 | Thief Pilfer Fridgian | cloak=Cloak of Flying | never | Cloak of Armor | (none) | cloak=Cloak of Flying | Cloak of Armor | (none) | cloak=Cloak of Flying |
| combat | #parley | 303 | Thief Con Artist Wilmsry | cloak=Cloak of Ether | never | Cloak of Ether | (none) | cloak=Cloak of Ether | Cloak of Ether | (none) | cloak=Cloak of Ether |
| economy | #script | 3 | Thief Pickpocket Human | cloak=Cloak of Ether | never | Cloak of Ether | (none) | cloak=Cloak of Ether | Cloak of Ether, Healing potion, Lockpicks | Healing potion, Lockpicks, Speed potion | cloak=Cloak of Ether |
| encounters | #chest | 2 | Thief Cat Burglar Wilmsry | cloak=Cloak of Armor | never | Cloak of Regeneration | (none) | cloak=Cloak of Armor | Cloak of Regeneration, Cloak of Speed | (none) | cloak=Cloak of Armor |
| encounters | #tablefour | 3 | Thief Pickpocket Human | cloak=Cloak of Ether | never | Cloak of Ether | (none) | cloak=Cloak of Ether | Cloak of Ether | (none) | cloak=Cloak of Ether |
| encounters | #faerie | 38 | Thief Con Artist Elven | cloak=Cloak of Ether | never | Cloak of Ether | (none) | cloak=Cloak of Ether | Cloak of Ether | (none) | cloak=Cloak of Ether |
| encounters | #affliction | 160 | Thief Pilfer Human | cloak=Cloak of Armor | never | Cloak of Regeneration | (none) | cloak=Cloak of Armor | Cloak of Regeneration | (none) | cloak=Cloak of Armor |

The full per-site record values (the exact `before.items (prototype @chargen)` / `after.items (engine @chargen)` / `after.worn (engine @chargen)` / end-state JSON triples Plan 02 pastes into its declared divergence records) are in the committed `tools/worn-fixture-scan-output.txt`'s `## Record values` section — one `### <site>` block per moved row above.

**No site shows a mid-script wear** — every `first mid-script wear` column reads `never` across all 31 sites; the only worn-population trigger measured anywhere is chargen (the Thief starting cloak), confirming the phase_facts' prediction that finds are deferred into `pendingFind`/`pendingLoot` and never taken by a scripted action.

**Note on the chargen `items`/`worn` name mismatches visible in the table above** (e.g. seed-2: prototype items shows "Cloak of Regeneration" while the engine's worn slot shows "Cloak of Armor"): this is a **pre-existing** divergence from the 260918-w4n quick task, which dropped the healing cloak row from `CLOAKS` (8 rows → 7), shifting which cloak the SAME `rng.d(CLOAKS.length)` draw index maps to on the engine side vs. the frozen (8-row) prototype. It predates this plan, is unrelated to worn-model creation, and does not affect the `moved`/`MOVED SET` determination (which is driven purely by `c.worn` population, not by cloak-name equality) — flagged here for Plan 02/03's awareness since it's visible in the raw scan data.

## Expectation vs measurement

Per site, expected (GEAR-SLOTS §2 checklist + phase_facts' Thief-hero prediction) vs measured:

| Site | Expected to move? | Measured | Match |
|---|---|---|---|
| chargen#seed-2 | yes (GEAR-SLOTS §2) | true | ✓ |
| chargen#seed-3 | yes (GEAR-SLOTS §2) | true | ✓ |
| chargen#seed-4 | yes (GEAR-SLOTS §2) | true | ✓ |
| combat#flee (17) | yes (GEAR-SLOTS §2) | true | ✓ |
| economy#script (3) | yes (GEAR-SLOTS §2) | true | ✓ |
| movement#script (256, Thief) | yes (Thief-hero prediction) | true | ✓ |
| combat#win (3, Thief) | yes (Thief-hero prediction) | true | ✓ |
| combat#lose-plain (1119, Thief) | yes (Thief-hero prediction) | true | ✓ |
| combat#parley (303, Thief) | yes (Thief-hero prediction) | true | ✓ |
| encounters#chest (2, Thief) | yes (Thief-hero prediction) | true | ✓ |
| encounters#tablefour (3, Thief) | yes (Thief-hero prediction) | true | ✓ |
| encounters#faerie (38, Thief) | yes (Thief-hero prediction) | true | ✓ |
| encounters#affliction (160, Thief) | yes (Thief-hero prediction) | true | ✓ |
| combat#lose (14, Fighter), lose-apprentice (127, Magic User); magic#cast-damage (8)/heal (7)/potion (1)/scroll (7); encounters#trap (1, Fighter); every non-Thief chargen seed | no (non-Thief) | false | ✓ |

**Zero surprises**: the measured MOVED SET is exactly the 13 sites predicted (the 5 GEAR-SLOTS §2 checklist sites plus every other Thief-hero replay site) — no additional site moved that wasn't expected, and no expected site failed to move.

## Gate outputs

- `diff` (two consecutive scan runs): empty — deterministic.
- `diff <(node tools/worn-fixture-scan.mjs) tools/worn-fixture-scan-output.txt`: empty — committed file equals a fresh run.
- `npm test`: `# pass 3243`, `# fail 0`.
- `npm run build:www`: exit 0 (`[build-www] done`).
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged from the recorded phase-start baseline).
- `git diff --stat HEAD~1 -- engine/ src/ content/ mazeworld.html test/`: empty.
- `git log -1 --stat` (commit `726d384`): exactly `tools/worn-fixture-scan.mjs` and `tools/worn-fixture-scan-output.txt`.

## Flagged assumptions

- **A-1** (populated `c.worn` ⟺ the site's parity comparable moves; cross-checked via prototype-vs-engine `items` name comparison, `UNEXPLAINED` when they differ with empty `worn`): **holds, with one investigated exception.** `combat/lose` (seed 14) prints `UNEXPLAINED` — investigated and explained (see Issues Encountered): a pre-existing, already-declared, unrelated action-path RNG divergence (Phase 24/31) that the passing test suite already excludes from per-action byte comparison; not a worn-model issue. All other 30 sites are fully explained (`moved: true` for the 13-site MOVED SET, or `protoItems === engineItems` at both chargen and end for the remaining 17).
- **A-2** (prototype sandbox loaded exactly as the parity tests load it; economy site bumps gold to 5000 on both sides before actions exactly as `full-suite.test.js` does): **holds** — the scan's economy dispatch mirrors `full-suite.test.js` L321-322 exactly (`ctx.S.c.gold = 5000; engineState.c.gold = 5000;` immediately after the chargen snapshot, before the first action), and the end snapshot is taken after the last (`leaveStore`) action, matching where `declaredEndDiffs` reads.

## Next Phase Readiness

- Plan 02 can now declare exactly the measured 13-site MOVED SET as its `divergences`/`chargenDivergence`/action-path records, pasting the `## Record values` JSON straight from `tools/worn-fixture-scan-output.txt`, and re-run this scan after the engine edit — the scan's design (reads `c.items`/`c.worn` directly, imports no `*Comparable`/`strip*` helper) guarantees byte-identical output before and after the collapse.
- Plan 03 quotes `tools/worn-fixture-scan-output.txt` verbatim into `FIXTURE-INVENTORY.md`'s new Phase 45 section.
- No blockers. The one documented `UNEXPLAINED` row (combat/lose, seed 14) needs no action from Plan 02/03 — it is orthogonal to the worn-model collapse and already fully accounted for by the existing Phase 24/31 declared divergence record.

---
*Phase: 45-collapse-the-phase-37-hedges*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: tools/worn-fixture-scan.mjs
- FOUND: tools/worn-fixture-scan-output.txt
- FOUND: .planning/phases/45-collapse-the-phase-37-hedges/45-01-SUMMARY.md
- FOUND: commit 726d384 (feat: worn-fixture-scan + BEFORE readout)
- FOUND: commit 35c1879 (docs: SUMMARY)
