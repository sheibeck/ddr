---
phase: 42-flee-retune-consolidated-balance-close
verified: 2026-09-18T23:40:00Z
status: passed
score: 4/4 success criteria verified on automated evidence; the player-facing flee checks and the four "feel" sessions for the accepted out-of-band rows are deferred to the end-of-run Pixel 7 batch per the user's "defer uat to end" instruction
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7 (FLEE-02, submenu): in a fight the SOCIAL → FLEE row shows the honest pre-roll cost/desc — a plain Fighter 'd20, 14+'; a Thief 'd20+5, 14+' with '(Thief +5)'; a Troll in Plate 'd20−3, 14+' with both modifiers named", "Pixel 7 (FLEE-02, log): after tapping FLEE the fight log's newest line reads 'Flee: N (modifiers) = T vs 14.' followed by the outcome ('You get clear.' / 'You do not make it.'); tapping the line reveals the Oracle's fuller sentence with the dice", "Pixel 7 (FLEE-02, failure): a failed flee still hands every live foe its swing and the round counter advances — exactly as before", "Pixel 7 (FLEE-01, flavour): a Samurai still refuses to flee; a fresh Cloaker still vanishes for free with no roll; a round-1 tracked encounter still offers a clean WITHDRAW with no roll", "Pixel 7 (voice/glyph): the fleeRolled line reads deadpan/family-friendly on Oracle, toast and submenu, and the minus sign renders correctly", "Pixel 7 (FLEE-01, table): flee with three different characters (plain Fighter, Thief, heavily armored Fighter) — the shown need matches docs/FLEE.md's before/after table (35% / 60% / 25% anchors)", "Pixel 7 (BAL-02, feel): one short Summoner session — does 'no benefit from the Fighter/Thief-gated ability system' (the accepted reason for AFTER meanDepth 2.65 vs BEFORE 3.37) read fair in hand-play, or rougher?", "Pixel 7 (BAL-02, feel): one short Apprentice session (AFTER 2.60 vs BEFORE 2.94) — does the 'known floor of the class' reason hold up?", "Pixel 7 (BAL-02, feel): one short session with a non-Wilmsry, non-Troll Magic User — does the caster × weak-race combination read as unfairly hard? (17 accepted too-weak cells)", "Pixel 7 (BAL-02, feel): one short session with any Wilmsry character — does the racial edge read as too easy? (7 accepted too-strong cells; a pre-existing pattern from the BEFORE table, candidate for a future racial tune)"]
gaps: []
---

# Phase 42 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-18)

Goal-backward check of the phase goal: *flee is transparently fair — a lower, honestly-shown baseline with the Thief edge kept and small class/race modifiers — and the milestone's ONE consolidated AFTER class-matrix run verifies the combined effect of every power-adding phase against the depth-20 target, closing the loop BAL-01 opened.*

## Automated evidence (re-run by the orchestrator after 42-04)

- `npm test`: **3002/3002, 0 failures** (2915 at phase start → 2935 after 42-01 → 2967 after 42-02 → 2996 after 42-03 → 3002 after 42-04). `npm run build:www` exit 0; `package.json`/lock unchanged.
- Engine gate: `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged); `git status --porcelain test/parity/fixtures` empty — the one fixture that flees (combat seed 17: Fridgian Thief, roll 18, mods Thief +5 / Fridgian −1, total 22 vs need 14 → still `fled`) was measured live and did not move, so no divergence was declared. `docs/class-pass/v15-before.json` and `v15-before-depth20.json` byte-identical to `b1c024b` (the BEFORE pins were never regenerated). Only ONE `rng.d(20)` in `flee()`, at the same position.
- Cumulative `git diff --stat b1c024b -- engine content src mazeworld.html docs tools test/parity/fixtures` = 21 files, 60768+/102− (the bulk is the two AFTER matrix JSONs + the tactics smoke); `mazeworld.html` untouched in this phase.
- The AFTER pair ran with the BEFORE's exact parameters (`--seeds 40 --workers 4 --max-actions 5000`; `--seeds 10 --start-depth 20`): 667.2 s natural + 61.8 s depth-20; `class-pass-diff.mjs --gate` → `cannot-act cells: 0 of 143`; `meta.runFlags = { storeRoll: true, wornSlots: true }` records that the bot now plays the shipped run rules.
- Bot teaching (BAL-01 second half): the 143×3 tactics smoke shows 3464 ability / 2254 spell / 383 item uses, 0 stuck, 0 cannot-act; the frozen `Bot:` parameter line stays byte-equal to the BEFORE pin's `meta.bot` (tactics numbers live in `BOT_TACTICS`).
- Four plans, four SUMMARY.md files, all `## Self-Check: PASSED`; working tree clean at HEAD `9fc1188` apart from the two untracked user directories outside the phase.

## Success criteria → evidence

| # | Success criterion (ROADMAP) | Evidence |
|---|-----------------------------|----------|
| 1 | Attempting to flee shows the roll, modifiers, and the number needed in the fight log before it resolves | `fleeRolled { roll, mods: [{ name, delta }], total, need }` emitted before `fled`/`fleeFailed`; narrated on the Oracle sentence, the fight-log fold (roll-first), the toast and the combat submenu's pre-roll cost (`fleeBreakdown`); `flee-retune.test.js` (14) + re-pinned narration tests. |
| 2 | Base flee success is noticeably below the old 50%, the Thief edge is still meaningfully better, and a before/after table records the change as a declared canon divergence | `content/flee.js`: `FLEE_NEED = 14`, `FLEE_THIEF_BONUS = 5`, bounded `FLEE_CLASS_MOD` (Magic User −1) / `FLEE_RACE_MOD` (Elven +1, Dwarven −1, Fridgian −1, Troll −1); Human Fighter 35%, Thief in light armor 60%, Fighter in Plate 25%; `docs/FLEE.md` 11-row before/after table with computed percentages; `flee-ledger.test.js` pins the ledger to the content table. |
| 3 | A failed flee still hands every foe its swing, unchanged from today | `flee()`'s failure path (`fleeFailed` → `foeTurn` → cleared-check → round++) byte-identical; pinned in `flee-retune.test.js`. |
| 4 | One consolidated AFTER class-matrix run reports pick-rates for every new spell/ability and a fun-band verdict per sub-class; out-of-band rows tuned or explicitly accepted against the depth-20 target | `docs/class-pass/v15-after.json` + `v15-after-depth20.json`; `docs/CLASS-PASS.md` `## v1.5 AFTER — commit 38a08cd… (Phase 42 — BAL-02)` with pooled rollups, per-sub bands, pick-rates (`class-pass-usage.mjs`), and a verdict/reason/lever for every out-of-band row (test-enforced). Headline: meanDepth 3.75 → 3.60, reach5 30.6% → 28.4%, reach10 0.7% → 0.5%, reach20 0.1% → 0%, depth-20 meanFloorsGained 0.79 → 0.66 — **depth-20 target PASS** on all three thresholds. 24 out-of-band cells + 2 sub rows (Summoner, Apprentice) all ACCEPTED with written reasons; zero one-knob tunes (both patterns are structural: the Fighter/Thief-gated ability system and Wilmsry's pre-existing racial strength). |

## Requirements

FLEE-01 ✓ · FLEE-02 ✓ · BAL-02 ✓ (BAL-01 already ✓, second half delivered here) — automated halves verified; on-device halves in the frontmatter `human_verification` list (10 items, from the 12-item aggregated checklist in 42-04-SUMMARY.md; Plans 02/03 honestly recorded "none").

## Accepted planner/executor deviations (recorded in plan/SUMMARY frontmatter)

- Planner corrections to CONTEXT: the six real races (CONTEXT's Halfling/Ogre were illustrative); the combat submenu's FLEE row also carried the old hard-coded need; the bot had never taken the victory loot pile and ran without `storeRoll`/`wornSlots` — both fixed so the AFTER measures the shipped game (recorded in `meta.runFlags`).
- 42-01: a `<behavior>` bullet miscomputed Troll Fighter in Plate (3/20 vs the table's own 4/20) — implemented per the locked table.
- 42-02: Phase 41's water test `maxActions` 1000 → 1500 (the ability policy lets seed 2 live longer).
- 42-04: a literal grep count collided with Plan 03's committed transcript; nested depth-20 pick-rate headings demoted to `####`.

## Follow-ups noted (not gaps)

- Two structural balance patterns handed to the next tuning milestone: Magic Users gain nothing from the Fighter/Thief-gated ability system (Summoner/Apprentice weakest); Wilmsry's racial edge (7 too-strong cells) — both also on the device round as "feel" sessions.
- TUNE-06/07 human DR round and the tier-3/5 roster decision remain deferred (`docs/DIFFICULTY-RETUNE.md`).
