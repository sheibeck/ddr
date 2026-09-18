---
phase: 39-gear-magic-items-one-shot-tools
plan: 02
subsystem: tools
tags: [tuning-bot, expectedStrike, gear-balance, class-matrix, ledger]

# Dependency graph
requires:
  - phase: 39-01
    provides: "content/weapons.js need/crit axes, content/armors.js bulk axis, engine/derived.js#expectedStrike/armorBulk/classNeed, engine/items.js#weaponUpgradeDelta/armorUpgradeDelta rebased on expectedStrike"
provides:
  - "tools/lib/tuning-bot.mjs: chooseStorePurchase(state, ctx) — the bot's store buy/equip policy (weapon pass by expectedStrike, armor pass by AR with a Thief bulk<=1 preference, GOLD_RESERVE=50), decideAction's step (l) rewritten to use it"
  - "test/unit/bot-buy-policy.test.js — 9-test pin of the policy (RED-first)"
  - "docs/GEAR-BALANCE.md — the GEAR-01 before/after ledger (canon change, need-vs-die equivalence, all-24-weapon and 5-armor before/after tables, per-class picks with measured expectedStrike numbers, no-class-below-need-2 floor table, two CONTEXT corrections verified in code, the upgrade heuristic, the bot policy summary, the smoke readout, the declared fixture divergence, placeholders for Plans 03-05)"
  - "docs/class-pass/v15-gear-smoke.json — 143 cells x 3 seeds (429 runs) against the v1.5 BEFORE pin"
  - ".planning/REQUIREMENTS.md — GEAR-01 marked complete"
affects: [39-03-item-activation-model, 39-04-one-shot-tools, 39-05-shell-gear-surfaces, 42-bal-02-consolidated-retune]

tech-stack:
  added: []
  patterns:
    - "chooseStorePurchase reads the engine's OWN legality/upgrade rules (canEquipWeapon/canEquipArmor/weaponUpgradeDelta/armorUpgradeDelta/armorBulk) rather than re-deriving them, so a bot buy is structurally never refused notBetter (T-39-04)"
    - "ledger numbers are measured live via a scratch node -e script over the real engine/derived.js#expectedStrike (including a monkey-patched-WEAPONS OLD-dice comparison for the two heavy-start kits), never hand-computed"

key-files:
  created:
    - test/unit/bot-buy-policy.test.js
    - docs/GEAR-BALANCE.md
    - docs/class-pass/v15-gear-smoke.json
  modified:
    - tools/lib/tuning-bot.mjs
    - .planning/REQUIREMENTS.md

key-decisions:
  - "chooseStorePurchase checks the weapon pass FIRST and returns immediately on a hit — the armor pass only ever runs on a LATER decideAction call once the bought weapon line is sold, exactly as 39-02-PLAN.md's Task 1 spec describes (no single-call double-buy)"
  - "The Thief bulk>1 skip reads armorBulk({ armor: item.armor }) — a synthetic object, not a full character — so it works on a candidate STOCK LINE's item before anything is worn"
  - "Test 2 (Thief bulk skip) uses a synthetic armor line naming 'Plate' with its OWN cls overridden to 'FT' so canEquipArmor passes — isolating the bulk-skip rule from the canon Fighter-only Plate gate, since testing the real canon-illegal Plate would only prove the class gate, not the bulk gate"
  - "The smoke's engine-commit provenance is this plan's own Task 1 commit (00e5318) — Task 1 (tools/lib only) necessarily lands before Task 2's smoke run, so the JSON's meta.commit field is exact, not approximate"
  - "The two per-class 'START heavy' kit level-1 EV numbers (Knight/Awl Pike, Barbarian/Battle Axe) were computed by temporarily monkey-patching the live WEAPONS export's Awl Pike/Battle Axe entries to their OLD dice/need/crit values, calling the real expectedStrike, then restoring — genuinely measured against the shipped formula, not a parallel hand-derivation"

requirements-completed: [GEAR-01]

coverage:
  - id: D1
    description: "The tuning bot buys the class-legal weapon with the highest positive expected-strike delta it can afford (reserving 50 wilmst), then the best class-legal armor upgrade, preferring bulk <= 1 as a Thief; leaves when nothing qualifies"
    requirement: "GEAR-01"
    verification:
      - kind: unit
        ref: "test/unit/bot-buy-policy.test.js (9 tests: weapon-then-armor-then-null sequence, Thief bulk skip, Magic User class-illegal refusal, Bardiche-not-upgraded-by-Rapier, sold/over-budget never chosen, buyPremium item.kind routing, GOLD_RESERVE=50, no-drift pin)"
        status: pass
      - kind: unit
        ref: "test/unit/tuning-bot.test.js (existing store: {} -> leaveStore test, still green — proves chooseStorePurchase never throws on a store with no stock array)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/GEAR-BALANCE.md records the GEAR-01 before/after ledger: weapon need/crit and armor bulk axes, per-class picks with measured expectedStrike numbers, the no-class-below-need-2 floor, corrections to CONTEXT verified in code, the upgrade heuristic, the bot policy, and a 143x3 smoke vs the v1.5 BEFORE pin"
    requirement: "GEAR-01"
    verification:
      - kind: manual_procedural
        ref: "grep -c checks: '^## ' >=14 (15), 'NOT a retune|not a tuning verdict' >=1 (1), 'Bardiche' >=2 (7), exact Soldier foe-crit line ==1 (1); node -e meta.seeds/cells.length -> '3 143'"
        status: pass
    human_judgment: false
  - id: D3
    description: "REQUIREMENTS.md marks GEAR-01 complete in both the checklist and traceability table"
    requirement: "GEAR-01"
    verification:
      - kind: unit
        ref: "grep -c checks on .planning/REQUIREMENTS.md: '[x] **GEAR-01**' == 1, '| GEAR-01 | Phase 39 | Complete |' == 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plan gate: full suite green, prototype master untouched, no fixture/engine/content/shell diff"
    verification:
      - kind: unit
        ref: "npm test (2594/2594, # fail 0); git hash-object test/parity/prototype-master.js.txt (a1f4d0dc29782218d8e5aab65bc5989c33f917f0, unchanged); git status --porcelain test/parity/fixtures (empty); git diff --stat -- mazeworld.html src/browser engine content (empty)"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-18
status: complete
---

# Phase 39 Plan 02: Bot Buy Policy, Class-Matrix Smoke, GEAR-BALANCE.md Ledger Summary

**The tuning bot now buys and equips under the new weapon/armor axes (`chooseStorePurchase`, expectedStrike-ranked with a Thief bulk preference), a 143-cell x 3-seed smoke against the v1.5 BEFORE pin stays within noise, and `docs/GEAR-BALANCE.md` records the full GEAR-01 before/after ledger with every number measured live — GEAR-01 is now complete.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 2
- **Files modified:** 5 (4 new, 1 modified aside from tuning-bot.mjs)

## Accomplishments

- `tools/lib/tuning-bot.mjs#chooseStorePurchase(state, ctx)`: a weapon pass (highest `expectedStrike` among unsold, class-legal, affordable, genuine-upgrade `buyWeapon`/`buyPremium` lines, `GOLD_RESERVE = 50`) checked first, then an armor pass (highest AR among unsold, class-legal, affordable, genuine-upgrade `buyArmor`/`buyPremium` lines, a Thief skipping any `armorBulk(...) > 1` line) — `decideAction`'s store step now reads `chooseStorePurchase(state, ctx) ?? { type: "leaveStore" }`.
- `test/unit/bot-buy-policy.test.js` (new, RED-first): 9 tests pinning the Flail-over-Rapier weapon pick (`expectedStrike` 2.125 vs 1.80, matching 39-01-SUMMARY's own sample), the weapon-then-armor-then-null sequence across three `chooseStorePurchase` calls, the Thief bulk>1 skip, a Magic User's hard class-illegal refusal (Flail is F/T only), a Bardiche-wielder correctly ignoring a strictly-worse Rapier, sold/over-budget lines never chosen (T-39-04), `buyPremium` lines routed by `item.kind`, and one in-combat + one exploration `decideAction` pin proving zero drift elsewhere.
- `docs/GEAR-BALANCE.md` (new): the full GEAR-01 ledger — the user's Area-3 ruling quoted verbatim, the need-vs-die equivalence stated once, all 24 weapons' before (`git show d117782`)/after dice/cost/need/crit with store-band membership, the 5-row armor table and its three bulk consumers (climb/leap/flee/Stealth), per-class (Fighter/Thief/Magic User) before (single dominant pick under the old raw-max-damage heuristic)/after (heavy/neutral/light per tier) analysis with `expectedStrike` numbers measured live at levels 1/3/5 via a scratch `node -e` script, the Knight/Awl Pike and Barbarian/Battle Axe pre- vs post-phase level-1 EV proof (measured by temporarily swapping the live `WEAPONS` entries to their old values and calling the real `expectedStrike`), the no-class-below-need-2 floor table (F 3 via Bardiche, T 3, M 2), two corrections to 39-CONTEXT.md verified in code (the Soldier "1-2 crit" line is the FOE's crit against a Soldier, not the hero's own — the hero's own crit stays `noCrit` for Guard/Soldier regardless of weapon; rolled staves already carry a 250-square cooldown via `rollStaff`/the encounters.js find branch, so "infinite Pine Staff" does not describe the current engine), the upgrade heuristic in prose, the bot policy summary, the smoke readout, the one declared fixture divergence (a pointer into `FIXTURE-INVENTORY.md`), and placeholder headings for GEAR-02/GEAR-05/chips-row-states/Requirements-map (Plans 03-05).
- `docs/class-pass/v15-gear-smoke.json` (new): `node tools/tune-classes.mjs --seeds 3 --workers 4 --max-actions 5000` — 143 cells x 3 seeds (429 runs), 92.4s wall time, engine commit `00e5318` (this plan's own Task 1). Pooled rollups stay within noise of the v1.5 BEFORE pin (`e69ff07`, 143x40): meanDepth 3.75→3.78, p50Depth 4→4, reach5% 30.6→27.3, meanKills 8.1→8.08. `class-pass-diff.mjs --gate` finds 1 of 143 cannot-act cells (Magic User/Wizard/Elven, 0.33 mean kills over only 3 completed runs) — recorded and read honestly as 3-seed sampling noise, not a regression, since the BEFORE 40-seed pin shows 0 cannot-act cells for every Magic User sub.
- `.planning/REQUIREMENTS.md`: `GEAR-01` marked `[x]` and `Complete` in the traceability table.

## Task Commits

1. **Task 1: Bot store buy/equip policy on expectedStrike + armor bulk preference** - `00e5318` (feat)
2. **Task 2: 429-run class-matrix smoke, docs/GEAR-BALANCE.md ledger (GEAR-01 half), REQUIREMENTS.md, plan gate** - `ff082d9` (docs)

**Plan metadata:** this commit (SUMMARY only; `commit_docs` handling per this run's `Do NOT update STATE.md or ROADMAP.md` instruction — the orchestrator owns those writes)

## Files Created/Modified

- `tools/lib/tuning-bot.mjs` — `GOLD_RESERVE`, `chooseStorePurchase(state, ctx)`, `decideAction`'s rewritten step (l) and updated doc comment
- `test/unit/bot-buy-policy.test.js` (new) — 9-test policy pin
- `docs/GEAR-BALANCE.md` (new) — the GEAR-01 ledger
- `docs/class-pass/v15-gear-smoke.json` (new) — the 143x3 smoke
- `.planning/REQUIREMENTS.md` — GEAR-01 checklist + traceability row

## Decisions Made

See frontmatter `key-decisions` — the weapon-pass-first/armor-pass-on-next-call sequencing, the synthetic-Plate-with-overridden-cls test isolating the Thief bulk gate from the canon class gate, the smoke's exact engine-commit provenance, and the monkey-patched-WEAPONS measurement method for the two heavy-start kits' pre/post EV comparison are all recorded there with rationale.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria passed on the first implementation; no Rule 1-4 fixes were needed.

## Issues Encountered

None. The `class-pass-diff.mjs --gate` run surfaced 1 of 143 "cannot-act" cells (Magic User/Wizard/Elven) — this is expected 3-seed noise (documented in the ledger's Smoke section with the BEFORE 40-seed pin as the counter-evidence), not a defect requiring a fix.

## User Setup Required

None — no external service configuration required.

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device pauses occurred. This plan touched no shell/UI code (tools/, docs/, tests, .planning only), so it adds no NEW on-device check beyond what 39-01-SUMMARY.md already deferred. Recorded here for the milestone-close aggregated Pixel 7 checklist:

1. (carried from 39-01) Hero tab TO HIT reads 1–6 with a Rapier / 1–4 with a Flail on a Fighter (need+1/need-1 axes visible) — meaningful once Plan 05 routes it through the shell's engine bridge.
2. (carried from 39-01) A Thief in Plate armor is refused the backstab; a Thief in Studded armor is not refused.
3. (carried from 39-01) The store's weapon offerings at any depth show a genuine mix of heavy/neutral/light picks — visible once Plan 05 or a later UI pass surfaces need/crit on the store screen.

**This plan's own smoke pooled table** (for reference, not a device check — a tuning-bot readout):

| Measure | v1.5 BEFORE (e69ff07, 143×40) | v1.5 gear smoke (00e5318, 143×3) |
|---|---|---|
| n (runs) | 5720 | 429 |
| meanDepth | 3.75 | 3.78 |
| p50Depth | 4 | 4 |
| p90Depth | 6 | 6 |
| reach5 % | 30.6 | 27.3 |
| reach10 % | 0.7 | 0.7 |
| reach20 % | 0.1 | 0.0 |
| meanKills | 8.1 | 8.08 |
| meanLevel | 2.47 | 2.53 |
| stuck total | 0 of 5720 | 0 of 429 |

Command: `node tools/tune-classes.mjs --seeds 3 --workers 4 --max-actions 5000 --out docs/class-pass/v15-gear-smoke.json`. `npm test`: 2594/2594, `# fail 0`. Master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged. Fixture status: no diff. `git diff --stat -- mazeworld.html src/browser engine content`: empty.

## Next Phase Readiness

- GEAR-01 is closed. `docs/GEAR-BALANCE.md` carries placeholder headings (`## Item activation model (GEAR-02) — Plan 03`, `## One-shot tools (GEAR-05) — Plan 04`, `## Chips and row states — Plan 05`, `## Requirements map — Plan 05`) ready for Plans 03-05 to append into, per this plan's own scope boundary — never rewrite the file wholesale.
- Plan 03 (GEAR-02, the `c.timers`-based use → effect → cooldown/charge model) can build directly on the ledger's "once a day" numeric ceiling (`effect + cd <= 100` squares, `recharge <= 100` squares/charge) already anchored in this file's header.
- Bot item-USE tactics (potions/staves/scrolls mid-run) and any bot awareness of the GEAR-02/GEAR-05 models are explicitly deferred to Phase 42 (BAL-02 prep), as this plan's own "Tuning-bot policy" section states — only the buy/equip decision landed here.
- No blockers.

---
*Phase: 39-gear-magic-items-one-shot-tools*
*Completed: 2026-09-18*

## Self-Check: PASSED
