---
phase: 51-initiative-once-per-combat
plan: 03
subsystem: ui
tags: [narration, oracle, fight-log, voice, shell, safety-wordlist]

# Dependency graph
requires:
  - phase: 51-initiative-once-per-combat
    plan: 02
    provides: "combatJoined additive fields (mine, theirs, why, foe) from resolveInitiative/fight(), fired exactly once per fight"
provides:
  - "EVENT_NARRATION.combatJoined(e) — the Oracle's once-per-fight 'Initiative — you N, {foe|them} M. <verdict>' line, dice in two .roll spans"
  - "LINE_FOR.combatJoined(e) — the roll-free 'Initiative — <verdict>' rail/fight-log text, tone hit/hurt"
  - "narrationLines.js#initiativeVerdictText(e) — the ONE why/senses/first-keyed verdict table shared by both narration modules"
  - "test/unit/initiative-line.test.js — 5 pins: per-why voice+BANNED scan, foe-name rule, .roll reveal, SC3 once-per-fight replay, legacy no-dice shape"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared pure verdict helper (initiativeVerdictText) exported from narrationLines.js and imported into eventNarration.js (which already imports slotWord from the same module) — no new cross-module dependency, and the Oracle/fight-log verdict wording can never drift apart"

key-files:
  created:
    - test/unit/initiative-line.test.js
  modified:
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js

key-decisions:
  - "initiativeVerdictText lives in narrationLines.js (not duplicated) since eventNarration.js already has a precedent cross-import of slotWord from narrationLines.js — adding a second named import from the same module is not a NEW cross-module dependency, satisfying the plan's own constraint"
  - "Exact verdict wording (Claude's discretion per CONTEXT.md): samurai 'Samurai honour — they go first.'; slow 'Too slow off the mark — they go first.'; foreseen 'Foresight — you go first.'; acuteHearing 'Acute Hearing — you go first.'; senses 'You go first. Nothing gets the jump on you.' (legacy substring preserved); knight 'A Knight's welcome — it comes straight at you.' (verbatim from CONTEXT.md); courtMage 'Court Mage — you talk first, they swing first.' (verbatim from CONTEXT.md); no-why 'You go first.'/'They go first.'"
  - "The Oracle html template places the two dice .roll spans first, then ONE verdict span (class beat for you-first, hurt for foe-first) — stripping tags via oracleDetailText reproduces the prototype's exact 'Initiative — you 14, Stalka Beast 9. You go first.' shape byte-for-byte"

requirements-completed: [INIT-02]

coverage:
  - id: D1
    description: "Oracle's combatJoined renders the once-per-fight dice line with two .roll spans and an in-voice verdict keyed on why/senses/first; foe named when a single live foe, 'them' for a group; legacy no-dice/senses shapes still render without throwing"
    requirement: "INIT-02"
    verification:
      - kind: unit
        ref: "test/unit/initiative-line.test.js (all 5 tests) + test/unit/spell-utility.test.js's senses pin"
        status: pass
    human_judgment: false
  - id: D2
    description: "LINE_FOR.combatJoined renders the SAME verdict, roll-free, tone hit/hurt, shared with the Oracle via initiativeVerdictText so the two surfaces can never disagree"
    requirement: "INIT-02"
    verification:
      - kind: unit
        ref: "test/unit/initiative-line.test.js 'every why branch renders in voice...' + test/unit/fightLog.test.js, test/unit/narrationLinesCoverage.test.js, test/unit/shell-fight-log.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "SC3: the initiative line appears exactly once per fight in both the Oracle and the fight log, proven over a real 3-round engine replay (fight() + three playerStrike calls on one shared fakeRng)"
    requirement: "INIT-02"
    verification:
      - kind: unit
        ref: "test/unit/initiative-line.test.js 'once-per-fight, over a real engine replay (SC3)'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every why branch's copy passes the family-friendly BANNED scan (content/safety-wordlist.js)"
    requirement: "INIT-02"
    verification:
      - kind: unit
        ref: "test/unit/initiative-line.test.js's assertClean() calls in the per-why test"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pixel 7 device confirmation that the line reads correctly and dice are tap-revealable in the live combat screen"
    verification: []
    human_judgment: true
    rationale: "Requires a physical device session (Oracle/fight-log rendering, tap-to-reveal interaction) — deferred to the Phase 55 end-of-run UAT batch per the project's deferred-UAT protocol; unit tests already prove the underlying string/HTML contract."

# Metrics
duration: ~40min
completed: 2026-09-20
status: complete
---

# Phase 51 Plan 03: Initiative Line — Oracle & Fight Log Summary

**Extended the existing `combatJoined` entries in `eventNarration.js` and `narrationLines.js` (no new event type, no new EVENT_NARRATION key) to render the prototype's once-per-fight "Initiative — you N, {foe|them} M. `<verdict>`" line, with the verdict spoken in voice via a new shared pure helper (`initiativeVerdictText`) whenever an override (Samurai, slow race, foresight, Acute Hearing, senses, Knight, Court Mage) decided the roll — pinned by five new tests including a real 3-round engine replay proving the line fires exactly once.**

## Performance

- **Duration:** ~40min
- **Completed:** 2026-09-20
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- **Task 1 (narration):** `src/browser/eventNarration.js`'s `combatJoined(e)` now renders `Initiative — you <span class="roll">{mine}</span>, {foe|them} <span class="roll">{theirs}</span>. <span class="beat|hurt">{verdict}</span>`, with `mine`/`theirs` falling back to `"?"` and `foe` falling back to `"them"`. `src/browser/narrationLines.js`'s `LINE_FOR.combatJoined(e)` renders the roll-free `Initiative — {verdict}` with `tone` "hit"/"hurt". Both read the verdict from a single new export, `narrationLines.js#initiativeVerdictText(e)`, keyed on `e.why` first, then the legacy `e.senses` flag, then `e.first` — so the Oracle and the fight log can never disagree about the wording. `eventNarration.js` already imports `slotWord` from `narrationLines.js`, so importing `initiativeVerdictText` too added no new cross-module dependency (the plan's own constraint). Every existing pin — `spell-utility.test.js`'s `senses: true` short form, `fightLog.test.js`'s dice-free `combatJoined` event, `narrationLinesCoverage.test.js`'s FEATURE_EVENTS/ORACLE_ONLY partition — stayed green untouched.
- **Task 2 (pins + gates):** Wrote `test/unit/initiative-line.test.js` (5 tests, pure imports, `fixedState`/`fixedFoe`/`fixedCombat`/`fakeRng` copied verbatim from `test/unit/combat.test.js`): (1) every `why` branch (`samurai`, `slow`, `foreseen`, `acuteHearing`, `senses`, `knight`, `courtMage`, and the two bare you-first/foe-first cases) renders in voice on both modules, agrees on tone, and passes the BANNED scan (`content/safety-wordlist.js`, the same word-boundary `MATCHERS` pattern as `test/unit/rail.test.js`); (2) the foe's name appears when `e.foe` is present, `"them"` otherwise; (3) `oracleDetailText(narrateEvent(e))` reproduces the prototype's exact shape — `"Initiative — you 14, Stalka Beast 9. You go first."` — with `narrativeLineText` stripping both dice; (4) **SC3**: a real `fight()` + three `playerStrike()` replay of Plan 02's own Samurai-vs-999-wp-foe scenario (one shared `fakeRng([10, 1, 20, 20, 20, 20, 20, 20, 20])`) proves the Oracle shows the line exactly once and the fight log shows it exactly once, with the revealed roll matching `"Initiative — you 10, Target 1. Samurai honour — they go first."` verbatim; (5) a legacy `{ type: "combatJoined", first: "you" }` (no dice) renders without throwing, both roll spans showing `"?"`.

## Task Commits

Each task was committed atomically:

1. **Task 1: the initiative line — Oracle html and roll-free rail/fight-log text** - `5236345` (feat)
2. **Task 2: pins — per-why snapshot + BANNED scan, .roll reveal, once-per-fight replay** - `7203466` (feat)

**Plan metadata:** (this commit) — SUMMARY + STATE + ROADMAP

## Files Created/Modified

- `src/browser/eventNarration.js` — `combatJoined(e)` extended to the once-per-fight dice line with a why-keyed verdict span; imports `initiativeVerdictText` from `narrationLines.js`.
- `src/browser/narrationLines.js` — new export `initiativeVerdictText(e)` (the shared verdict table); `LINE_FOR.combatJoined` rewritten to use it.
- `test/unit/initiative-line.test.js` — new file, 5 tests covering voice/BANNED, foe-name rule, `.roll` reveal, SC3 once-per-fight replay, legacy no-dice shape.

## Decisions Made

- `initiativeVerdictText` homed in `narrationLines.js` (not a third shared module) — `eventNarration.js` already imports `slotWord` from that module, so this is a same-direction addition, not a new dependency edge.
- Exact verdict copy (Claude's discretion within the plan's voice rules, family-friendly, BANNED-clean):
  - Samurai: **"Samurai honour — they go first."**
  - Slow race: **"Too slow off the mark — they go first."**
  - Foresight: **"Foresight — you go first."**
  - Acute Hearing: **"Acute Hearing — you go first."**
  - Senses (legacy `senses: true` short form): **"You go first. Nothing gets the jump on you."**
  - Knight vs. big foe: **"A Knight's welcome — it comes straight at you."**
  - Court Mage: **"Court Mage — you talk first, they swing first."**
  - No override: **"You go first."** / **"They go first."**
- `why` omission convention (CONTEXT's "Claude's Discretion"): the plain bare cases carry no `why` key at all (`Object.hasOwn(joined, "why") === false`, per Plan 02's own pin) — `initiativeVerdictText` treats `undefined` the same as omitted via its `?? (e?.senses ? "senses" : null)` fallback, so both shapes hit the same `default` branch.

## Deviations from Plan

None — plan executed exactly as written. One self-correction during authoring (not a deviation from the plan's *behavior*, only from a draft comment in the test file): an early draft of `test/unit/initiative-line.test.js` had the string `"INIT-02 (SC3)"` appear twice (once in a section comment, once in the `test()` name), which would have made the plan's own acceptance-criteria grep (`grep -c "INIT-02 (SC3)" ... prints 1`) fail. Reworded the section comment before running any test to keep the literal grep count at exactly 1 — caught and fixed before the Task 2 commit, so no separate fix commit was needed.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- INIT-02 is fully landed: the Oracle and fight log both show the once-per-fight initiative line, in voice, with dice revealable, matching the prototype's `C.initNote` shape.
- Phase 51 (Initiative Once Per Combat) is now complete — both INIT-01 (Plan 02, engine cut) and INIT-02 (this plan, narration) requirements are satisfied.
- `npm test` and `npm run build:www` both green; `engine/`, `content/`, and `test/parity/` are byte-untouched by this plan (master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged).
- No blockers for Phase 52 (Foe Attack Cadence), which measures on top of this phase's AFTER bot readout.

## Gates

- `npm test` (final line): `# tests 3351` / `# pass 3351` / `# fail 0`
- `npm run build:www`: exits 0 (`[build-www] done`)
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `git diff --stat -- engine/ content/ test/parity/`: empty (shell-only plan, verified before and after both commits)

## Human verification (deferred to end of run)

Owed to the Phase 55 end-of-run Pixel 7 UAT batch (per the deferred-UAT protocol — no device pauses mid-run):

1. After tapping Fight!, the Oracle shows exactly one "Initiative — you N, `<foe>` M. …" line per fight, and it does not repeat on later rounds.
2. In the fight log, the initiative entry reads roll-free ("Initiative — You go first." / the override's verdict), and tapping it reveals both dice via the existing `.roll` fold.
3. A Samurai fight's line reads "Samurai honour — they go first." and the foe's turn follows immediately, matching the alternation SC2 already proved in Plan 02.

## Self-Check: PASSED

- FOUND: src/browser/eventNarration.js
- FOUND: src/browser/narrationLines.js
- FOUND: test/unit/initiative-line.test.js
- FOUND commit: 5236345 (Task 1)
- FOUND commit: 7203466 (Task 2)
