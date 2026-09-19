---
phase: 40-spell-rework
plan: 05
subsystem: ui
tags: [shell, grimoire, combat-menu, condition-chips, hero-tab, map-tint, docs-ledger, phase-close, deferred-uat]

# Dependency graph
requires:
  - phase: 40-spell-rework plan 01
    provides: "content/spells.js's niche/txt contract, NICHE_LABELS export"
  - phase: 40-spell-rework plan 02
    provides: "the f.dot shared shape (Ice's {left,dmg,by}); the spell:weaken c.timers record"
  - phase: 40-spell-rework plan 03
    provides: "engine/derived.js#conditionsOf's mirror/senses/regen/foresight chips"
  - phase: 40-spell-rework plan 04
    provides: "the spell:reveal c.timers record; conditionsOf's reveal chip; cell.spellSeen"
provides:
  - "src/browser/viewModels.js#grimoireViewModel rows carry niche/nicheLabel"
  - "src/browser/combatMenu.js SPELLS submenu rows carry niche/nicheLabel"
  - "src/browser/mapMarks.js#MAP_PALETTE.floorSpell — the spell-revealed 'borrowed sight' tint"
  - "mazeworld.html: 5 new CONDITION_COPY/TONE/EXPLAIN chip rows (mirror/senses/regen/foresight/reveal); the Hero-tab Shield row reads pool AND rounds (SPELL-06); 4 new Hero-tab kit rows (Mirror Self/Sense Presence/Sense Danger/Map the Floor); foeStatusBadges reads spell:weaken + f.dot; draw() paints cell.spellSeen in P.floorSpell"
  - "test/unit/shell-spells-40.test.js (new, 10 tests) — source pins for every mazeworld.html surface above"
  - "docs/SPELLS.md: UI (Plan 05) + Requirements map (Plan 05) + Out of scope / next sections — the ledger is closed"
  - ".planning/REQUIREMENTS.md: SPELL-01..07 marked complete — Phase 40 fully closed"
affects: ["41 (darkness/terrain — the spell-seen tint is orthogonal, unmodified by the later render filter)", "42 (bot casting tactics by niche; the tuning-bot stays kind-generic this phase)", "milestone-close UAT batch"]

tech-stack:
  added: []
  patterns:
    - "niche/nicheLabel is carried on BOTH spell-row view models (grimoireViewModel + combatMenu.js) as a data pair beside the pre-formatted txt string, so a future UI can group/badge by niche without parsing txt — mirrors the Phase 39 itemRowState precedent of computing state once and reading it from two independent consumers"
    - "the chip copy table (CONDITION_COPY/TONE/EXPLAIN) grows by one object-literal row per new engine-emitted conditionsOf key, read by the SAME generic detail branch every prior chip uses — no new special case needed for a flat-boolean or a remaining-count chip"
    - "the map's fallback palette literal (draw()'s no-module branch) is kept byte-identical to src/browser/mapMarks.js#MAP_PALETTE by test assertion, not just convention — a missing ESM bridge can never paint an undefined fillStyle"

key-files:
  created:
    - test/unit/shell-spells-40.test.js
  modified:
    - src/browser/viewModels.js
    - src/browser/combatMenu.js
    - src/browser/mapMarks.js
    - mazeworld.html
    - test/unit/grimoireViewModel.test.js
    - test/unit/combatMenu.test.js
    - test/unit/mapMarks.test.js
    - test/unit/conditions.test.js
    - docs/SPELLS.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The ward chip's outside-combat visibility (SPELL-06's other half) needed NO engine change — engine/derived.js#conditionsOf's existing ward block only ever read state.c (never state.combat), so it already showed outside combat before this plan. The plan's own conditions.test.js task added an EXPLICIT `combat: null` proof rather than a fix; the only real SPELL-06 gap was the Hero-tab row missing rounds, which this plan closes."
  - "The generic conditionsOf detail branch (`typeof cn.remaining === 'number' -> '${remaining} ${unit}'`) already covers mirror (rds) and reveal (sq) — no special-case branch was added to paintConditions for either, keeping the five new chips a pure copy-table addition with zero new control flow."
  - "test/unit/shell-map-hud.test.js needed NO edit — its CONDITION_TONE/CONDITION_EXPLAIN check is already a generic subset assertion (every CONDITION_TONE key must be a CONDITION_COPY key or 'affliction'; every CONDITION_TONE key must have a CONDITION_EXPLAIN entry), so it validates the five new rows automatically without a plan-specific update. Left off this plan's key-files list in practice despite being named in the plan's own frontmatter `files_modified`."
  - "f.dot's 'Poison' label branches on `by !== 'ice'` rather than `by === 'poisonedEdge'` — Poisoned Edge's own `by` value IS the literal string 'poisonedEdge' (not 'poison'), but the badge's job is 'name the two dot SOURCES the player can meet,' not echo the internal field verbatim; a future third dot source falls through to 'Poison' too, matching the plan's own worked example text exactly ('an f.dot badge reads Ice · N / Poison · N')."

requirements-completed: [SPELL-01, SPELL-02, SPELL-05, SPELL-06, SPELL-07]

coverage:
  - id: D1
    description: "Both spell-row view models (grimoireViewModel, combatMenu.js SPELLS submenu) carry niche + nicheLabel beside the existing fields; every row's txt begins with nicheLabel + ' · ' (proven across one representative spell per niche)"
    requirement: "SPELL-01"
    verification:
      - kind: unit
        ref: "test/unit/grimoireViewModel.test.js (niche/nicheLabel row-shape + full-niche-coverage tests); test/unit/combatMenu.test.js (SPELLS-order test extended)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Five new condition chips (mirror/senses/regen/foresight/reveal) render with a label, a tone, and a tap explanation; the Hero-tab kit gains matching Mirror Self/Sense Presence/Sense Danger/Map the Floor rows"
    requirement: "SPELL-02"
    verification:
      - kind: unit
        ref: "test/unit/shell-spells-40.test.js (CONDITION_COPY/TONE/EXPLAIN + Hero-tab kit rows sections)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A spell-revealed (cell.spellSeen) floor cell paints in a distinct 'borrowed sight' tint (MAP_PALETTE.floorSpell, mirrored into draw()'s fallback literal); the tint disappears the instant the one expiry sweep clears the flag, since draw() re-reads spellSeen fresh every paint"
    requirement: "SPELL-05"
    verification:
      - kind: unit
        ref: "test/unit/mapMarks.test.js (floorSpell distinctness + frozen-palette test); test/unit/shell-spells-40.test.js (draw()'s spellSeen branch + fallback-hex-parity test)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Hero-tab Shield row reads pool AND rounds ('34 hp left · 3 rds'); conditionsOf's ward chip is proven to surface outside combat (explicit combat: null case)"
    requirement: "SPELL-06"
    verification:
      - kind: unit
        ref: "test/unit/shell-spells-40.test.js (Hero-tab ward-row test); test/unit/conditions.test.js (the new no-combat ward proof)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Foe badges carry durations: a Weakened badge reads the hero's own spell:weaken record ('Weakened · N'); an f.dot badge reads 'Ice · N' (by === 'ice') or 'Poison · N' (any other by)"
    verification:
      - kind: unit
        ref: "test/unit/shell-spells-40.test.js (foeStatusBadges section)"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/SPELLS.md's UI + Requirements map + Out of scope sections are filled (no placeholders remain); .planning/REQUIREMENTS.md marks SPELL-01..07 complete; the whole-phase gate is green with every number recorded"
    requirement: "SPELL-07"
    verification:
      - kind: unit
        ref: "npm test (2813/2813, # fail 0); git hash-object prototype-master.js.txt unchanged; test/parity/fixtures porcelain empty; npm run build:www exit 0; fonts.googleapis count 0; chargen-rng-pin.test.js green with zero pin-value diff since f14a8f2; package.json/package-lock.json/docs/class-pass/ absent from the cumulative diff"
        status: pass
    human_judgment: false
  - id: D7
    description: "The aggregated, plan-grouped, continuously-numbered Pixel 7 checklist (24 items across all 5 plans) exists in this SUMMARY for the milestone-close UAT batch (never executed in this run)"
    verification: []
    human_judgment: true
    rationale: "On-device verification is explicitly deferred to the milestone-close UAT batch per this run's 'defer uat to end' protocol — no device steps, no adb, no APK build in this run."

duration: 95min
completed: 2026-09-18
status: complete
---

# Phase 40 Plan 05: Shell Close + Phase Close Summary

**Every Phase 02-04 engine surface put on screen — the niche line on both spell surfaces, five new condition chips with copy/tone/explanation, the Hero-tab Shield row now showing pool AND rounds plus four new utility rows, foe badges naming their durations, and a distinct map tint for a spell-revealed cell — then the ledger closed, all seven SPELL requirements marked complete, and the phase's full aggregated Pixel 7 checklist assembled for milestone-close UAT.**

## Performance

- **Duration:** ~95 min
- **Tasks:** 3
- **Files modified:** 10 (1 new, 9 modified)

## Accomplishments

- `src/browser/viewModels.js#grimoireViewModel` and `src/browser/combatMenu.js`'s SPELLS submenu rows both gain `niche`/`nicheLabel` fields beside their existing fields (`txt` unchanged — it already begins with `nicheLabel + " · "`, Plan 01's contract); a test builds a grimoire with one representative spell per every distinct niche and proves `row.txt.startsWith(row.nicheLabel + " · ")` for all of them, not just a single hand-picked row.
- `src/browser/mapMarks.js#MAP_PALETTE` gains `floorSpell: "#4e5a6a"` — a cool "borrowed sight" tint distinct from `floor`/`floorDark`/`fog`, still frozen with every prior key/value unchanged.
- `test/unit/conditions.test.js` gains an explicit `combat: null` proof that `conditionsOf`'s existing ward chip already surfaced pool AND rounds outside combat (SPELL-06's engine half needed no fix — only the Hero-tab row did).
- `mazeworld.html`: five new `CONDITION_COPY`/`CONDITION_TONE`/`CONDITION_EXPLAIN` rows (`mirror`/`senses`/`regen`/`foresight`/`reveal`) render through the existing generic detail branch with zero new special-case code; the Hero-tab Shield row now reads `"{pool} hp left · {rounds} rds"` (was pool-only); four new Hero-tab kit rows (`Mirror Self`/`Sense Presence`/`Sense Danger`/`Map the Floor`) appear exactly while their matching condition is live; `foeStatusBadges` reads the hero's own `spell:weaken` timer for a live `"Weakened · N"` duration and a foe's shared `f.dot` record for `"Ice · N"`/`"Poison · N"`; `draw()`'s floor fill paints a `cell.spellSeen` cell in `P.floorSpell` (both the live ESM palette and the fallback literal, kept hex-parity-tested), taking priority over the dark-tile fill since the tint IS the "this will re-fog" signal.
- `test/unit/shell-spells-40.test.js` (new, 10 tests): source pins for every `mazeworld.html` surface above, mirroring `test/unit/shell-gear-39.test.js`'s `fs.readFileSync` + comment-strip + `sliceBetween` pattern — the five chip rows, the Hero-tab ward/utility rows, the foe-badge duration reads, the `draw()`/fallback-palette hex parity, a voice-safety pass over every new sentence, and a `www/index.html` build-artefact sanity check.
- `docs/SPELLS.md`'s "UI (Plan 05)" section documents the niche line, the chip table, the Hero-tab rows, the foe badges, the map tint, and what stays for the cleanup milestone (the classic script's dead `SPELLS`/`castSpell`/`rollGrimoire` duplicates); "Requirements map (Plan 05)" closes SPELL-01..07 and all six ROADMAP success criteria to their proving tests; "Out of scope / next" lists bot tactics (Phase 42), darkness interplay (Phase 41), and the no-mana-model decision.
- `.planning/REQUIREMENTS.md`: SPELL-01..07 all marked `[x]` complete (checkboxes + traceability table) — Phase 40 is fully closed.
- Whole-phase gate reverified green (BASE `f14a8f2`): `npm test` 2813/2813 (`# fail 0`); `npm run build:www` exit 0; `test/parity/fixtures` porcelain empty; `prototype-master.js.txt` hash unchanged (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`); `fonts.googleapis` count 0; `test/unit/chargen-rng-pin.test.js` green with a ZERO pin-value diff since `f14a8f2` (the only diff is Plan 01's already-declared formula filter, not a value); `package.json`/`package-lock.json`/`docs/class-pass/` absent from the cumulative `f14a8f2..HEAD` diff (20 files: `content/`, `docs/`, `engine/`, `mazeworld.html`, `src/browser/`, `tools/` — zero new dependencies); `store-listing/`/`tools/store-screenshots/` never touched this phase.

## Task Commits

Each task was committed atomically:

1. **Task 1: niche on both spell-row view models, the map palette tint, the outside-combat ward-chip proof — pure modules, tests first** — `3999a4d` (test)
2. **Task 2: mazeworld.html — chip copy rows, Hero-tab ward rounds + spell rows, foe-badge durations, spell-seen map tint** — `08a56cd` (feat)
3. **Task 3: ledger close (UI + requirements map), REQUIREMENTS.md, whole-phase gate** — `f5689c7` (docs)

**Plan metadata:** this commit (SUMMARY only; `commit_docs: true` in `.planning/config.json`, so the final metadata commit still fires for `.planning/` docs — the orchestrator owns STATE.md/ROADMAP.md per this run's instructions).

## Files Created/Modified

- `src/browser/viewModels.js` — `grimoireViewModel`'s row literal gains `niche`/`nicheLabel`
- `src/browser/combatMenu.js` — the SPELLS submenu row literal gains the identical two fields
- `src/browser/mapMarks.js` — `MAP_PALETTE.floorSpell`
- `mazeworld.html` — the five chip copy rows, the Hero-tab ward/utility rows, `foeStatusBadges`'s two new reads, `draw()`'s spellSeen branch + fallback-palette hex
- `test/unit/shell-spells-40.test.js` (new, 10 tests) — source pins for every `mazeworld.html` surface above
- `test/unit/grimoireViewModel.test.js`, `test/unit/combatMenu.test.js`, `test/unit/mapMarks.test.js`, `test/unit/conditions.test.js` — the Task 1 TDD extensions
- `docs/SPELLS.md` — "UI (Plan 05)" + "Requirements map (Plan 05)" + "Out of scope / next"
- `.planning/REQUIREMENTS.md` — SPELL-01..07 marked complete

## Decisions Made

See frontmatter `key-decisions` — the ward chip's outside-combat visibility needing no engine fix (only a Hero-tab display gap), the generic-detail-branch reuse for mirror/reveal (no new special-case control flow), `shell-map-hud.test.js` needing no edit (its own check is already generic), and the `f.dot.by !== "ice"` (not `=== "poisonedEdge"`) branching rule for the "Poison" fallback label are all recorded there with rationale.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance-criteria grep, every test count, and every gate number matched the plan's own specified literals and thresholds on the first pass; no Rule 1/2/3 auto-fixes were needed. One process note: `test/unit/shell-map-hud.test.js` was named in the plan's own `files_modified` frontmatter but required no edit — its `CONDITION_TONE`/`CONDITION_EXPLAIN` coverage check is already a generic subset assertion that validated the five new rows automatically (documented as a key-decision above, not a deviation from behavior).

## Issues Encountered

None. The plan's exhaustive `<action>`/acceptance-criteria text (exact literal strings, exact grep counts) made every implementation mechanical — re-derive the expected value from the documented spec, never guessed.

## User Setup Required

None — no external service configuration required.

## Success Criteria Map (ROADMAP SC-1..6)

| SC | Text | Landed in | Proof |
|----|------|-----------|-------|
| 1 | A player can tell two same-level spells solve different problems (the niche line) | Plan 01 (the niche map) + Plan 05 (the niche line rendered on both spell surfaces) | `test/unit/spell-table.test.js` (niche-map proof); `test/unit/grimoireViewModel.test.js`; `test/unit/combatMenu.test.js` |
| 2 | Every utility spell has an observable effect (a condition chip) | Plan 03 (the chips + narration) + Plan 05 (the chip copy/tone/explanation rendered) | `test/unit/spell-utility.test.js`; `test/unit/conditions.test.js`; `test/unit/shell-spells-40.test.js` |
| 3 | Every Magic User sub starts day one with a spell that deals damage | Plan 01 | `test/unit/day-one-damage.test.js` |
| 4 | Map the Floor's window is legible and re-fogs only what it alone showed | Plan 04 (the mechanism) + Plan 05 (the map tint) | `test/unit/map-reveal.test.js`; `test/unit/mapMarks.test.js`; `test/unit/shell-spells-40.test.js` |
| 5 | A scroll's refusal is visible and names the level needed | Plan 03 | `test/unit/spell-utility.test.js` (the `readScroll` gate matrix, including `scrollTooAdvanced`) |
| 6 | Shield's pool + rounds are visible on the Hero sheet and as a map-HUD chip, outside combat too | Plan 05 (the Hero-tab row) + the pre-existing `conditionsOf` ward chip (no-combat proof added this plan) | `test/unit/conditions.test.js`; `test/unit/shell-spells-40.test.js` |

## Key Decisions for PROJECT.md (orchestrator)

Two call-outs this plan surfaces for PROJECT.md's Key Decisions ledger at phase close (this plan does NOT edit PROJECT.md — that is the orchestrator's job):

1. **Map the Floor's re-fog provenance (Plan 04's ratified Key Decision, verbatim):** "Only what the spell alone showed" re-fogs — a cell the player actually walked to during the window is never taken away from them, even though the spell's own temporary light over the rest of the floor fades right on schedule. Mechanism: a per-cell `cell.spellSeen` provenance flag, set only by a live cast, cleared the instant normal exploration (`reveal()`) touches the cell (graduating it to permanent memory), swept exactly once at the window's expiry (never per-step). This plan (05) makes the window's own light visible on the map itself — a distinct "borrowed sight" tint (`MAP_PALETTE.floorSpell`) over every still-spell-only cell, so the player can see at a glance what will re-fog before it does.
2. **Phase 23's `SPELL_LEVEL_OVERRIDES.Summoner` is superseded by Phase 40.** The Phase 23 `Summoner: { Summon: 1 }` override (letting the Summoner cast the level-2 Summon spell at level 1) is retired outright — Summon is spell level 2 for everyone again. In its place, Phase 40 (Plan 01, per the user's Area 3 ruling) adds a genuine new level-1 special-school spell, Lesser Summon, deterministically granted to every Summoner: a WEAKER ally than Summon (lower level, shorter duration, no doubling/backfire — "the safe, small trick"), satisfying the same day-one-damage need the old override existed for, without touching the Summoner's offense-gate-3 "bad" the override used to work around. PROJECT.md's Phase 23 row should gain a "superseded by Phase 40" note pointing here.

## Human verification (deferred to end of run)

Per this run's `defer uat to end` standing instruction, no device steps were taken this plan (or anywhere in Phase 40). This is the phase's full aggregated Pixel 7 checklist, grouped by plan and numbered continuously, for the milestone-close UAT batch. Items that named a "wait for Plan 05" caveat in their originating plan's own SUMMARY are stated here without that caveat — Plan 05 has now landed.

### Plan 01

1. Hero-tab Grimoire rows read as one niche line each — e.g. Freeze's row reads "burst · one foe · d6, and frozen solid on a hit" (not the old bare "d6, thrown").
2. A fresh Summoner's grimoire lists Lesser Summon (castable) and Summon (reads "Needs level 2") — roll a few fresh Summoner characters (dev start-at-depth or new-character) and confirm the Hero tab shows both spells with this exact split.
3. Detect Magic no longer appears anywhere in the UI — every surface (Hero tab, combat SPELLS menu, any scroll/shop copy) reads "Map the Floor" instead.

### Plan 02

4. Cast Ice on a tough foe — the fight log shows "Ice climbs …" then a d6 tick each round ("… takes N from the ice") and "freezes solid" at the end, with the kill paid (sp/gold/loot as normal).
5. Cast Weaken — the fight log shows "They hit softer now, for N rounds." and, when it runs out, "Their arms remember how to swing." A re-cast mid-window should read a fresh rounds count, not stack.
6. Cast Stupidity on a foe, then watch it for several rounds — every round after the cast, the foe "stands there, thinking about nothing" and never swings or casts, for the rest of that fight.
7. A level-1 Summoner's Lesser Summon brings a small ally (a "sort of"/"in a small way" line) for at most 4 rounds and never backfires, even on repeated casts.
8. Lightning still hits every foe in a multi-foe fight — one roll per foe, independent hit/miss.
9. Shrink a foe and let it swing — its blow should visibly land softer than an equivalent unshrunk foe's; if it is also Weakened, softer still.

### Plan 03

10. Cast Mirror Self / Sense Presence / Regeneration outside a fight — each shows a condition chip on the map HUD, with a tap giving a plain-language explanation (Plan 05's chip copy).
11. With Sense Presence up, a forced-foe-first race (e.g. a Samurai's own "They move first.") should no longer be forced — the Fight! line should instead read "You move first. Nothing gets the jump on you." whenever the fair roll goes the hero's way.
12. After the fight ends, if Sense Presence or Regeneration was still active, the fight log should show "Your senses dull back to normal." / "The wounds stop closing on their own." exactly once.
13. A level-1 Warlock reading a Heal scroll should see "Heal needs level 3; you are 1. The scroll reads itself once and crumbles." and then be healed once — Heal should NOT appear in the Hero-tab grimoire afterward.

### Plan 04

14. Cast Map the Floor — the whole floor appears at once, the rail says "The floor lays itself out in your head — every corridor on this level, for 40 squares," a MAPPED chip shows 40 squares counting down, and every cell the spell alone lit (not yet walked) paints in a visibly distinct "borrowed sight" tint on the map.
15. Walk 40 squares after casting — the corridors actually walked stay lit and their tint reverts to the ordinary floor color as you walk them; everything else fogs back with the rail line "The map forgets what it was told," and the MAPPED chip disappears.
16. Recast at, say, 20 squares into the window — the chip resets to counting down from 40 and nothing on the map flickers or re-fogs early.
17. Descend mid-window — the MAPPED chip vanishes immediately, and the new floor behaves completely normally (no leftover reveal state or stray tint).
18. Resume a pre-Phase-40 save that had Detect Magic in the grimoire — the Hero-tab grimoire row now reads "Map the Floor," with no card or popup announcing the rename.

### Plan 05

19. The Hero tab's Shield row shows BOTH hp and rounds (e.g. "34 hp left · 3 rds") while the map-HUD Shield chip shows the same pool AND rounds outside combat, matching each other exactly.
20. The Hero tab shows Mirror Self / Sense Presence / Sense Danger (armed) / Map the Floor rows while each is up, and each row disappears the instant its matching condition chip does.
21. Tap each of the five new condition chips (Mirrored/Senses/Regenerating/Forewarned/Mapped) — each shows the correct detail (rounds/flat/flat/flat/squares) and a plain-language tap explanation in the family-friendly deadpan tone.
22. Fight a foe under Weaken — its badge reads "Weakened · N" and counts down; fight a foe under Ice (or a Thief's Poisoned Edge) — its badge reads "Ice · N" (or "Poison · N") beside the existing Acid badge style.
23. TalkBack reads the five new condition chips' labels/details and the four new Hero-tab kit rows.
24. A voice spot-check of every new line in real play (the five chip explanations, the four Hero-tab rows, the two foe-badge phrasings) for the family-friendly deadpan tone, not just the synthetic safety-scan corpus.

## Next Phase Readiness

- Phase 40 is fully closed: all seven SPELL requirements (SPELL-01..07) are complete, `npm test` is green at 2813/2813, and the parity master/fixtures are byte-identical to before the phase.
- Every engine surface (Plans 01-04) and every shell surface (this plan) needed for the spell rework is complete and reusable as-is.
- `docs/SPELLS.md` is the living reference for the full SPELL-01..07 ledger, the niche map, the offense mechanics, the utility/scroll fixes, the re-fog Key Decision, and the UI conventions this phase established.
- The 24-item aggregated Pixel 7 checklist above is queued for the milestone-close UAT batch — no device steps or APK build were taken in this phase, per the standing `defer uat to end` protocol.
- Two Key Decisions above are handed to the orchestrator for PROJECT.md at phase close (the re-fog provenance decision; the Phase 23 Summoner override superseded note).
- No blockers.

---
*Phase: 40-spell-rework*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `src/browser/viewModels.js`, `src/browser/combatMenu.js`, `src/browser/mapMarks.js`, `mazeworld.html`, `test/unit/shell-spells-40.test.js`, `test/unit/grimoireViewModel.test.js`, `test/unit/combatMenu.test.js`, `test/unit/mapMarks.test.js`, `test/unit/conditions.test.js`, `docs/SPELLS.md` ("## UI (Plan 05)" and "## Requirements map (Plan 05)" filled, no `(appended by Plan` placeholders left), `.planning/REQUIREMENTS.md` (SPELL-01..07 all `[x]` complete) all exist with the expected content.
Verified in git log: `3999a4d`, `08a56cd`, `f5689c7` all present on `master`.
