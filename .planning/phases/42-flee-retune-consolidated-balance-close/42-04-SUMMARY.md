---
phase: 42-flee-retune-consolidated-balance-close
plan: 04
subsystem: tools
tags: [class-matrix, after-pin, verdicts, depth-20-target, ledger, phase-close, deferred-uat, requirements]

# Dependency graph
requires:
  - phase: 42-flee-retune-consolidated-balance-close plan 01
    provides: "content/flee.js, engine/derived.js#fleeBreakdown, engine/combat.js#flee's fleeRolled event, docs/FLEE.md — the flee retune this AFTER matrix measures inside"
  - phase: 42-flee-retune-consolidated-balance-close plan 02
    provides: "tools/lib/tuning-bot.mjs#chooseAbility/chooseCombatItem/chooseFieldItem/RUN_FLAGS — the ability/item tactics and shipped run-rules flags this AFTER matrix plays with"
  - phase: 42-flee-retune-consolidated-balance-close plan 03
    provides: "tools/lib/tuning-bot.mjs#chooseSpell's niche rules, tallyUsage/makeTallies().usage, tools/class-pass-usage.mjs, the 143x3 tactics smoke proving reachability before this plan's real 40-seed run"
  - phase: 36-balance-foundation-effect-timers-small-independent-wins plan 01
    provides: "docs/class-pass/v15-before.json / v15-before-depth20.json — the BAL-01 BEFORE pin this plan diffs against, never regenerated"
provides:
  - "docs/class-pass/v15-after.json (143 cells x 40 seeds, start depth 1) and v15-after-depth20.json (143 x 10, start depth 20) — the milestone's ONE consolidated AFTER class-matrix pair, at the BEFORE pins' exact parameters, meta.runFlags = { storeRoll: true, wornSlots: true }"
  - "docs/class-pass/v15-verdicts.json (schema class-pass-verdicts/1) — the machine-built BEFORE/AFTER diff with hand-authored verdict/reason for every out-of-band row"
  - "docs/CLASS-PASS.md's tenth H2, '## v1.5 AFTER — commit 38a08cd... (Phase 42 — BAL-02)' — pin/provenance, what-the-bot-now-does, pooled rollups, depth-20 target verdict (PASS), out-of-band verdicts, pick-rates, both transcripts"
  - "test/unit/class-pass-ledger.test.js re-pinned to 20 tests (9->10 H2 headings, 6 new v1.5 AFTER tests)"
  - ".planning/REQUIREMENTS.md: FLEE-01, FLEE-02, BAL-02 marked complete; Phase 42 fully closed"
affects: ["43-clarity-pass", "milestone-close UAT batch", "the next tuning milestone (Wilmsry racial strength, Magic-User ability-gate structural weakness — both flagged, not fixed, this phase)"]

tech-stack:
  added: []
  patterns:
    - "The AFTER matrix's harness code (tuning-bot.mjs/class-matrix.mjs) is EXPECTED to differ from the BEFORE pin's harness — that is the entire point of BAL-01's second half (teaching the bot). The invariant this plan holds is PARAMETER parity (seeds/workers/maxActions/exploreBudget/startDepth/Bot: line text), not harness-byte parity, unlike the v1.2/v1.5 BEFORE precedent."
    - "Out-of-band cell-appendix verdicts are written as ONE group verdict per pattern (too-weak Magic-User-heavy cells; too-strong Wilmsry cells), not per cell — per CONTEXT Area 2's explicit instruction, distinct from the per-row sub/race verdicts which stay one-per-row."

key-files:
  created:
    - docs/class-pass/v15-verdicts.json
  modified:
    - docs/class-pass/v15-after.json
    - docs/class-pass/v15-after-depth20.json
    - docs/CLASS-PASS.md
    - docs/FLEE.md
    - test/unit/class-pass-ledger.test.js
    - .planning/REQUIREMENTS.md

key-decisions:
  - "No one-knob tune ran. Both out-of-band sub-class rows (Summoner, Apprentice — both Magic User, both too weak) and both cell-appendix patterns (17 too-weak Magic-User-heavy cells; 7 too-strong Wilmsry cells) trace to STRUCTURAL or PRE-EXISTING causes, not a single content number: the new ability system is Fighter/Thief-gated by Phase 38's own design (Magic User gets none of this phase's biggest power add), and Wilmsry's racial strength / the weakest races' bottom cells were already the same shape in the v1.5 BEFORE table. Per CONTEXT Area 2, tuning is reserved for a row a SINGLE content number clearly explains — neither pattern qualifies, so every row is 'accept' with a written reason, listed for the user's device round."
  - "The plan's own literal acceptance criterion `grep -c \"^### Pick-rates — abilities\" docs/CLASS-PASS.md == 1` does not hold: Plan 03's own '### Phase 42 tactics' addendum already contains one instance of that exact heading text INSIDE a pre-existing fenced code block (its 3-seed smoke transcript, lines 294-375, committed before this plan ran) — a plan-authoring blind spot, not a defect in this plan's own render. The real, live Markdown heading this plan adds is correctly singular (grep count 2 total: 1 inert transcript artifact + 1 live heading); the depth-20 slice's own nested pick-rate headings were demoted to #### (not left at ###) specifically to avoid a GENUINE collision with the natural block's ### headings, which is the acceptance criterion's actual semantic intent."
  - "The depth-20 target thresholds (reach20 <= 1.0%, depth-20 meanFloorsGained <= 2.0, reach10 0.5%-10%) are stated in the ledger as Claude's Discretion, not a prior ledger convention — the plan authorized the planner/executor to set these numbers against the standing 'tune toward depth 20, not infinite; 20 is a unicorn' memory ruling."

requirements-completed: [FLEE-01, FLEE-02, BAL-02, BAL-01]

coverage:
  - id: D1
    description: "The ONE consolidated AFTER class-matrix pair (143x40 natural, 143x10 depth-20) run at the BEFORE pins' exact parameters against the fully-landed v1.5 engine (abilities+gear+spells+terrain+flee+taught bot), zero stuck, zero cannot-act, meta.bot byte-identical to the BEFORE pins, meta.runFlags = shipped run rules"
    requirement: "BAL-02"
    verification:
      - kind: unit
        ref: "test/unit/class-pass-ledger.test.js (v1.5 AFTER hash/meta-parity/runFlags/cell-keys/cannot-act tests, 3 tests)"
        status: pass
      - kind: other
        ref: "node tools/class-pass-diff.mjs --gate --after docs/class-pass/v15-after.json (cannot-act cells: 0 of 143, exit 0); git diff --quiet HEAD -- docs/class-pass/v15-before*.json (exit 0, BEFORE pins byte-unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/class-pass/v15-verdicts.json + docs/CLASS-PASS.md's v1.5 AFTER section: every out-of-band sub/race row (2) and cell-appendix pattern (2 groups, 24 cells) carries a written verdict+reason against the depth-20 target; the depth-20 target verdict itself (PASS on all 3 thresholds); no one-knob tune ran (none qualified)"
    requirement: "BAL-02"
    verification:
      - kind: unit
        ref: "test/unit/class-pass-ledger.test.js (verdicts.json editorial-completeness test, byte-identical-fresh-render test, pretune-absence test — 3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pick-rates for every ability/spell/item, natural + depth-20 slice, rendered by tools/class-pass-usage.mjs and pasted verbatim into docs/CLASS-PASS.md"
    requirement: "BAL-02"
    verification:
      - kind: other
        ref: "node tools/class-pass-usage.mjs --after docs/class-pass/v15-after.json --deep docs/class-pass/v15-after-depth20.json (byte-stable across two runs, confirmed via cmp)"
        status: pass
    human_judgment: false
  - id: D4
    description: "FLEE-01/FLEE-02/BAL-02 marked complete in REQUIREMENTS.md; whole-phase gate green (npm test 3002/3002 # fail 0, master hash unchanged, build:www exit 0, fixtures clean, BEFORE pins unchanged, package.json/lock unchanged)"
    requirement: "FLEE-01"
    verification:
      - kind: other
        ref: "npm test (3002/3002, # fail 0); git hash-object test/parity/prototype-master.js.txt (a1f4d0dc29782218d8e5aab65bc5989c33f917f0, unchanged); npm run build:www (exit 0); git status --porcelain test/parity/fixtures (empty); git diff --stat HEAD -- package.json package-lock.json (empty)"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-09-18
status: complete
---

# Phase 42 Plan 04: v1.5 AFTER Class-Matrix, Verdicts, Depth-20 Target, Phase Close Summary

**The milestone's one consolidated AFTER class-matrix (143x40 natural + 143x10 depth-20) measures every power-adding phase together — abilities, gear, spells, terrain, and this phase's own flee retune, with the newly-taught bot playing the shipped game's rules — and clears the depth-20 target on all three thresholds (reach20 0%, depth-20 meanFloorsGained 0.66, reach10 0.5%) with zero one-knob tunes needed: both out-of-band patterns (Magic-User-heavy weak cells, Wilmsry-heavy strong cells) trace to structural/pre-existing causes rather than a single content number, and are accepted with written reasons for the user's device round.**

## Performance

- **Duration:** ~90 min (including ~12 min of background matrix wall time: 667.2s natural + 61.8s depth-20)
- **Tasks:** 3
- **Files modified:** 6 (1 new: `docs/class-pass/v15-verdicts.json`; 5 modified)

## Accomplishments

- Ran both AFTER matrices in the background (natural: `node tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000 --out docs/class-pass/v15-after.json`, 667.2s, EXIT=0; depth-20: `--seeds 10 --start-depth 20`, 61.8s, EXIT=0) at commit `38a08cd`, sequentially, natural first, both against the fully-landed v1.5 engine.
- `node tools/class-pass-diff.mjs --gate --after docs/class-pass/v15-after.json` — `cannot-act cells: 0 of 143`, exit 0; zero stuck across both matrices (5720 + 1430 runs); `meta.bot` byte-identical to the matching BEFORE pin's `meta.bot` in both files; `meta.runFlags = { storeRoll: true, wornSlots: true }` present on both (the bot now plays the shipped game's rules, not the legacy bag-summed model the BEFORE pin measured against).
- `docs/class-pass/v15-before.json`/`v15-before-depth20.json` confirmed byte-unchanged (`git diff --quiet HEAD`) before, during, and after this entire plan.
- Diffed BEFORE vs AFTER via `class-pass-diff.mjs`: pooled mu dropped slightly (BEFORE 3.75 → AFTER 3.60) even with every new ability/item/spell landed — the flee retune's honestly-lower base rate (35%, down from 50%) and water's movement tax offset the new power. 24 out-of-band cells (17 too weak, 7 too strong) and 2 out-of-band sub-class rows (Summoner, Apprentice — both Magic User, both too weak); zero out-of-band race rows.
- Every out-of-band row/pattern verdicted **accept** with a substantive written reason: the 2 sub rows and the 17-cell too-weak group trace to the ability system's Fighter/Thief gate (Phase 38's own design — Magic User gets zero benefit from this phase's biggest power add); the 7-cell too-strong group is Wilmsry's pre-existing racial strength (already the top of the v1.5 BEFORE table). No single content number explains either pattern, so no one-knob tune ran — CONTEXT Area 2's "accept with written reason" branch, not the "tune" branch.
- **Depth-20 target verdict: PASS** on all three planner-set thresholds — pooled natural `reach20` 0% (≤ 1.0% target), depth-20 slice pooled `meanFloorsGained` 0.66 (≤ 2.0 target), pooled natural `reach10` 0.5% (0.5%-10% healthy band, at the floor).
- `docs/CLASS-PASS.md` gained its tenth H2, `## v1.5 AFTER — commit 38a08cdcc68538c47ee573e7a02c1dba32ada4ba (Phase 42 — BAL-02)`: pin/provenance (explicitly noting the harness itself changed by design, unlike prior BEFORE/AFTER pairs — only PARAMETER parity is the invariant), a "what the bot now does" interpretability paragraph per area, the pooled-rollups BEFORE→AFTER→Δ table, the depth-20 target verdict, the full `--section after` render (by-class/sub/race tables, reach table, depth-20 slice, out-of-band appendix), the out-of-band verdicts table plus two cell-group verdicts, "one-knob tuning: none", four pick-rate tables (natural) plus the depth-20 slice's pick-rate tables demoted to keep headings unique, a device-round bullet list, and both transcripts verbatim.
- `docs/FLEE.md` gained a concrete cross-link to the new AFTER section.
- `test/unit/class-pass-ledger.test.js`: heading-count test updated (9→10, v1.5 AFTER last); 6 new tests added mirroring the v1.2 AFTER pin tests (hash/meta-parity/runFlags, cell-keys/cannot-act, verdicts.json editorial completeness, byte-identical fresh render, pretune-absence check) — 20 tests total in this file (was 14).
- `.planning/REQUIREMENTS.md`: FLEE-01, FLEE-02, BAL-02 flipped to complete; their traceability rows flipped to `Complete`.
- Whole-phase gate: `npm test` 3002/3002 (`# fail 0`); `git hash-object test/parity/prototype-master.js.txt` unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); `npm run build:www` exit 0; `test/parity/fixtures` clean; `package.json`/`package-lock.json` unchanged; `git status --porcelain` fully clean (no untracked/modified files beyond the plan's own commits) — the two protected user directories (`store-listing/`, `tools/store-screenshots/`) were never touched.

## Task Commits

1. **Task 1: The ONE AFTER matrix pair, gated and committed** - `cb98577` (feat)
2. **Task 2: BEFORE→AFTER diff, out-of-band verdicts, `## v1.5 AFTER` ledger, ledger test re-pin** - `d39eb29` (docs)
3. **Task 3 (part 1): REQUIREMENTS.md FLEE-01/FLEE-02/BAL-02 complete** - `524f21d` (docs)

**Plan metadata:** this commit (SUMMARY only; the orchestrator owns STATE.md/ROADMAP.md writes per this run's instructions).

## Files Created/Modified

- `docs/class-pass/v15-after.json` (new) — the 143×40 natural AFTER matrix
- `docs/class-pass/v15-after-depth20.json` (new) — the 143×10 depth-20 AFTER slice
- `docs/class-pass/v15-verdicts.json` (new) — the machine-built diff with hand-authored editorial fields
- `docs/CLASS-PASS.md` — the tenth H2, `## v1.5 AFTER`
- `docs/FLEE.md` — the AFTER-section cross-link
- `test/unit/class-pass-ledger.test.js` — re-pinned (14 → 20 tests)
- `.planning/REQUIREMENTS.md` — FLEE-01/FLEE-02/BAL-02 complete

## Decisions Made

See frontmatter `key-decisions` — the "no one-knob tune ran" reasoning (both out-of-band patterns are structural/pre-existing, not a single-number fix), the plan's own inconsistent `grep -c` acceptance criterion (resolved in favor of the criterion's semantic intent, documented rather than silently worked around), and the depth-20 target thresholds being stated as Claude's Discretion are all recorded there with rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's own acceptance criteria] `grep -c "^### Pick-rates — abilities" docs/CLASS-PASS.md == 1` does not hold literally**

- **Found during:** Task 2 (verifying the acceptance criteria after appending the `## v1.5 AFTER` section)
- **Issue:** The plan's Task 2 acceptance criteria assert this grep count is exactly 1. After appending the new section, the actual count is 2: one live Markdown heading (this plan's own `### Pick-rates — abilities`, line ~2664) and one INERT occurrence already present since Plan 03 — inside a fenced code block (Plan 03's own 3-seed tactics-smoke transcript, `### Phase 42 tactics` addendum, lines 294-375, committed at `d53c1c0` before this plan ran). The plan's acceptance criterion did not anticipate that Plan 03's transcript would itself contain the literal string `### Pick-rates — abilities` inside a code fence.
- **Fix:** Verified the actual semantic intent behind the criterion — that the depth-20 slice's own nested pick-rate headings (which `tools/class-pass-usage.mjs --deep` renders at the SAME `###` level as the natural block's headings) must not collide with the natural block's headings within this plan's own new section. Demoted the depth-20 slice's four nested headings to `####` (not `###`) specifically to prevent that genuine collision, and documented the pre-existing transcript artifact inline in the Task 2 commit message and here, rather than silently editing Plan 03's committed transcript (which would corrupt an already-verified, machine-produced artifact) or weakening this plan's own render to force a literal count of 1.
- **Files modified:** None beyond the already-planned `docs/CLASS-PASS.md` edit — no additional file was touched to "fix" this; it is a documentation-only reconciliation.
- **Verification:** `grep -c "^### Pick-rates — abilities" docs/CLASS-PASS.md` prints 2 (1 live heading + 1 pre-existing transcript artifact); `grep -c "^#### Pick-rates — abilities" docs/CLASS-PASS.md` prints 1 (the depth-20 slice's demoted heading, correctly distinct); the byte-identical-fresh-render ledger test (test 19) confirms the live section is exactly what `class-pass-diff.mjs` produces, so the live heading's uniqueness within THIS plan's contribution is proven by construction.
- **Committed in:** `d39eb29` (Task 2 commit, with the deviation documented in the commit message body)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a plan-authoring blind spot in the plan's own literal acceptance criterion, not a defect introduced by this plan's work; resolved in favor of the criterion's semantic intent)
**Impact on plan:** No scope creep, no architectural change, no engine-rule change — the fix is documentation of an inconsistency already present in the committed baseline, with the genuinely-at-risk collision (the depth-20 slice's nested headings) correctly prevented via the `####` demotion this plan's own Task 2 action already specified.

## Issues Encountered

None beyond the deviation above. Both background matrix runs completed cleanly on the first attempt (`EXIT=0`, zero stuck, zero cannot-act); the verdict-authoring pass found no cell requiring a second AFTER run.

## User Setup Required

None — no external service configuration required.

## Success Criteria Map (ROADMAP SC-1..4)

| SC | Text | Landed in | Proof |
|----|------|-----------|-------|
| 1 | Attempting to flee shows the roll, modifiers, and the number needed in the fight log before it resolves | Plan 01 | `test/unit/flee-retune.test.js` (narration section), `test/unit/toastsForAction.test.js`, `test/unit/combatMenu.test.js`, `test/unit/rail.test.js` |
| 2 | Base flee success noticeably below the old 50%, Thief edge still meaningfully better, before/after table as a declared canon divergence | Plan 01 | `docs/FLEE.md` (35% base / Thief 60% / Plate 25% / the 11-row before/after table); `test/unit/flee-ledger.test.js`; the seed-17 live measurement (outcome unchanged, no fixture regenerated) |
| 3 | A failed flee still hands every foe its swing, unchanged from today | Plan 01 | `test/unit/flee-retune.test.js` (failure-path byte-identical assertion, one-draw proof) |
| 4 | One consolidated AFTER class-matrix run (post spells + abilities + gear) reports pick-rates for every new spell/ability and a fun-band verdict per sub-class in `docs/CLASS-PASS.md`; any out-of-band row is tuned or explicitly accepted with a written reason against the depth-20 target | This plan (Plan 04) | `docs/class-pass/v15-after.json`/`v15-after-depth20.json`, `docs/class-pass/v15-verdicts.json`, `docs/CLASS-PASS.md`'s `## v1.5 AFTER` section (pick-rate tables, out-of-band verdicts, depth-20 target verdict: PASS), `test/unit/class-pass-ledger.test.js` |

## For PROJECT.md

Three items this phase hands to the orchestrator for `PROJECT.md`'s Key Decisions ledger at phase close (this plan does NOT edit `PROJECT.md` — that is the orchestrator's job):

1. **Flee canon change (FLEE-01/02, ratified 2026-09-18):** `d20 + Thief(+5, kept) + FLEE_CLASS_MOD[cls] + FLEE_RACE_MOD[race] - armorBulk(c) >= 14` — a 35% base rate for a plain Human Fighter in no armor (down from 50%), 60% for a Thief in light armor, 25% for a Fighter in Plate. Every class/race modifier is bounded to ±2 and named in a `fleeRolled` event (`roll`, `mods: [{ name, delta }]`, `total`, `need`) narrated on the Oracle sentence, the fight-log fold, a toast, and the combat submenu's honest pre-roll cost — all BEFORE the outcome resolves. A failed flee is unchanged (every live foe still swings). See `docs/FLEE.md` for the full modifier table and before/after ledger.
2. **v1.5 AFTER verdict headline (BAL-02, ratified 2026-09-18):** the milestone's ONE consolidated AFTER class-matrix (abilities + gear + spells + terrain + the flee retune, measured together with the newly-taught bot playing the shipped game's rules) shows pooled `meanDepth` **3.75 → 3.60** (Δ -0.15), `reach5` **30.6% → 28.4%**, `reach10` **0.7% → 0.5%**, `reach20` **0.1% → 0%** — the dungeon did not get meaningfully easier despite every new ability/item/spell landing, because the flee retune's lower base rate and water's movement tax offset the new power. The depth-20 target verdict is **PASS** on all three thresholds (reach20 ≤ 1.0%, depth-20 `meanFloorsGained` ≤ 2.0, reach10 in the 0.5%-10% healthy band). Of 24 out-of-band cells and 2 out-of-band sub-class rows, **all were accepted with a written reason; zero were tuned** — both patterns (Magic-User-heavy weak cells, Wilmsry-heavy strong cells) trace to the Fighter/Thief-gated ability system's structural design and Wilmsry's pre-existing racial strength, not a single content number. See `docs/CLASS-PASS.md`'s `## v1.5 AFTER — commit 38a08cd... (Phase 42 — BAL-02)` section.
3. **The bot now plays the shipped game.** `tools/lib/tuning-bot.mjs`'s tuning bot uses its own class-driven ability kit, drinks/pops potions and fires staves by policy, takes the victory loot pile it ignored since v1.3, lights torches in the dark, casts spells by niche (DOT-vs-toughness, burst-finish, Lesser-Summon-then-Summon tiering, Map the Floor once per floor), and plays the shipped `storeRoll`/`wornSlots` run rules instead of the legacy bag-summed model every prior tuning-bot readout (including the v1.5 BEFORE pin) measured against. See `docs/CLASS-PASS.md`'s `### Phase 42 tactics (BAL-01 second half)`.

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device pauses occurred anywhere in Phase 42. This is the phase's full aggregated Pixel 7 checklist, grouped by plan and numbered continuously, for the milestone-close UAT batch. Plans 02 and 03 recorded "none" (dev harness/ledger work only, no `mazeworld.html`/`src/browser` edits) — kept honest here rather than invented.

### Plan 01

1. In a fight, the SOCIAL → FLEE row shows the honest pre-roll cost/desc for the current character — e.g. a plain Fighter reads "d20, 14+"; a Thief reads "d20+5, 14+" with "(Thief +5)" appended to the description; a heavily-modified character (e.g. a Troll in Plate) reads "d20−3, 14+" with both modifiers named.
2. After tapping FLEE, the fight log's newest line reads "Flee: N (modifiers) = T vs 14." followed immediately by the outcome sentence ("You get clear." / "You do not make it."), and tapping the line reveals the Oracle's own fuller sentence with the dice.
3. A failed flee still visibly hands every live foe its swing (a `struckByFoe`/`foeMissed` line appears) and the round counter advances — exactly as before this phase.
4. Sub-class flavour is unchanged on-device: a Samurai still refuses to flee outright; a fresh (unseen) Cloaker still vanishes for free with no roll shown; a round-1 tracked encounter still offers a clean WITHDRAW with no roll.
5. A voice read of the new fleeRolled line (Oracle, toast, and submenu desc) confirms the tone stays deadpan/family-friendly and the minus sign renders correctly (not a stray hyphen or mojibake) on-device.

### Plan 02

6. None — dev harness only (`tools/`, `test/`, `.planning/`); the Pixel 7 checklist gains nothing from this plan.

### Plan 03

7. None — dev harness and ledger docs only (`tools/`, `test/`, `docs/`); the Pixel 7 checklist gains nothing from this plan.

### Plan 04

8. Play three fights and flee in each with different characters (e.g. a plain Fighter, a Thief, a heavily-armored Fighter) — the shown need in each case matches `docs/FLEE.md`'s before/after table for that character (35%/60%/25% anchors, or the character's own computed row).
9. **Summoner** (sub-class) — the v1.5 AFTER matrix shows this sub notably weaker than the v1.5 BEFORE pin (AFTER meanDepth 2.65 vs BEFORE 3.37); one short play session with a Summoner to feel whether this reads as "no benefit from the new ability system" (the accepted explanation) or something rougher on-device.
10. **Apprentice** (sub-class) — similarly weaker (AFTER 2.60 vs BEFORE 2.94); one short play session to sanity-check the accepted "known floor of the class" explanation feels right in hand-play.
11. **The 17 too-weak Magic-User-heavy cells** (Summoner/Apprentice/Wizard/Illusionist/Cleric/Court Mage × Elven/Dwarven/Fridgian/Human, plus two weak-race outliers) — a short session with any Magic User of a non-Wilmsry, non-Troll race to feel whether the caster-vs-race combination reads as unfairly hard.
12. **The 7 too-strong Wilmsry cells** (Acrobat/Ninja/Con Artist/Woodsman/Sorcerer/Pilfer/Knight, all Wilmsry) — a short session with a Wilmsry character of any sub-class to feel whether the racial edge reads as too easy; this is a pre-existing pattern from the v1.5 BEFORE table, not new to this phase, but the device round is the right place to weigh it against a future racial-tune candidate.

## Corrections to CONTEXT

Aggregated from Plans 01-03 (Plan 04 found nothing new beyond the acceptance-criteria inconsistency documented in Deviations above):

1. **Races (Plan 01):** the six real races are Human, Elven, Dwarven, Wilmsry, Fridgian, Troll (`content/races.js`). CONTEXT Area 1's illustrative "Halfling +2, Elf +1, ... Dwarf −1, Ogre/large −1" example names races that do not exist in this codebase — the plan's own Action A had already corrected this to the six real races before execution began.
2. **Combat submenu (Plan 01):** CONTEXT Area 1 described the fight-log line as the only surface needing the new event; `src/browser/combatMenu.js`'s SOCIAL → FLEE row also carried the OLD hard-coded need/bonus string, which the plan's own Task 2 scope already covered.
3. **Seed-17 reading (Plan 01):** CONTEXT's planning-time prediction (roll 18, mods +5/−1, total 22 vs need 14, outcome `fled`) was confirmed exactly by the live Task 1 measurement — no divergence record was needed.
4. **The bot's ignored loot pile and legacy run flags (Plan 02):** the bot never took the victory loot pile since it was offered (Phase 29, v1.3) — its `decideAction` chain simply never checked for it. The bot also ran every prior tuning-bot readout (including the v1.5 BEFORE pin) with no `storeRoll`/`wornSlots` options, meaning it measured the legacy bag-summed `eff()`/fixed-store model, not the worn-slot model or depth-rolled store real players see. `RUN_FLAGS` closes this gap starting with this plan's AFTER pair.
5. **`maxActions` budget (Plan 02):** the pre-existing Phase 41 water test's budget was raised 1000→1500, measured live, after the new ability policy legitimately let one seed's Fighter survive longer (not a routing stall).
6. **Plan-authoring `grep -c` inconsistency (Plan 04):** see Deviations above — the plan's own acceptance criterion for the `### Pick-rates — abilities` heading count did not anticipate that Plan 03's committed transcript already contained the same literal text inside a fenced code block.

## Next Phase Readiness

- Phase 42 is fully closed: FLEE-01, FLEE-02, BAL-02 (and BAL-01, already complete since Phase 36) are all `[x]` in `.planning/REQUIREMENTS.md`; `npm test` is green at 3002/3002; the parity master hash and fixtures are byte-identical to before the phase; the v1.5 BEFORE pins are byte-unchanged.
- `docs/CLASS-PASS.md` now carries the full v1.2 → v1.5 BEFORE → v1.5 AFTER lineage in ten H2 sections, all machine-rendered and pinned by `test/unit/class-pass-ledger.test.js` (20 tests) so none of it can silently drift.
- Two flagged-but-not-fixed balance patterns are handed to the NEXT tuning milestone (explicitly out of this phase's one-knob scope per CONTEXT Area 2): (a) the Fighter/Thief-only ability gate leaves Magic User subs (especially Summoner/Apprentice) unable to benefit from Phase 38's power add — a candidate for a future MU-facing ability, spell buff, or explicit acceptance as permanent class-design; (b) Wilmsry's racial strength has topped every class-pass table since v1.2 — a candidate for a future racial-tune pass. Neither is an engine-rule change and neither was touched this phase.
- Phase 43 (Clarity Pass) inherits: every costly line names its cause (the `fleeRolled` mods and item/ability refusal reasons are already payload-sourced, ready to reuse); the milestone-close UAT batch now holds Phases 36-42's aggregated Pixel 7 checklists; the "Shell Debt & Dead Code" milestone still owns the legacy shell copies.
- No blockers.

---
*Phase: 42-flee-retune-consolidated-balance-close*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `docs/class-pass/v15-after.json`, `docs/class-pass/v15-after-depth20.json`, `docs/class-pass/v15-verdicts.json`, `docs/CLASS-PASS.md` (`## v1.5 AFTER — commit 38a08cd...` present, ten H2 headings total), `docs/FLEE.md` (cross-link present), `test/unit/class-pass-ledger.test.js` (20 tests), `.planning/REQUIREMENTS.md` (FLEE-01/FLEE-02/BAL-02 all `[x]`/Complete) all exist with the expected content.
Verified in git log: `cb98577`, `d39eb29`, `524f21d` all present on `master`.
