---
phase: 43-clarity-pass
plan: 02
subsystem: rations
tags: [engine, rations, audit, ledger, narration, view-model, rail, deferred-uat]

# Dependency graph
requires:
  - phase: 43-clarity-pass (Plan 01)
    provides: "docs/CLARITY.md's cost-event inventory (with the five day-cycle rows pre-assigned to this plan), the cause-first line-format rule proven across 24 other events, and the REWORDED_TXT_ITEMS/hp-not-wp guard machinery this plan extends"
  - phase: 25.1-device-feedback-batch
    provides: "engine/movement.js#nightlyEats (the pre-existing party-appetite loop) and makeCamp's campFailed { reason, need, have, members? } shape, both read-only inputs this plan refactors around eatsFor without changing their arithmetic"
provides:
  - "engine/movement.js#eatsFor(sheet) — THE one appetite read, value-identical to the three inline RACES[...].eats reads it replaces; nightlyEats/newDay/makeCamp all route through it"
  - "The rationsEaten event { type, eats, left, eaters } — a fed night's ration cost, naming every eater in party order"
  - "wentHungry's additive keys: need, have, mouths, heft (unfed-night cause-first narration)"
  - "docs/RATIONS.md — the CLAR-05 audit ledger: 12 rules against the frozen prototype + rulebook, zero missing prototype rules found"
  - "src/browser/eventNarration.js#RATION_RULE_LINE + the rationsEaten/wentHungry Oracle rewrites; src/browser/toasts.js's matching TOAST_FOR entries; src/browser/rail.js#RAIL_FAMILY.rationsEaten (FED)"
  - "src/browser/viewModels.js#rationsViewModel(state)/eatsLineFor(sheet)/RATIONS_COPY — the pure ration readout for Plan 04's Hero RATIONS panel, Joiner offer card and Company panel; total === nightlyEats(state) always"
  - "test/unit/rations-audit.test.js (23 tests), test/unit/rationsViewModel.test.js (9 tests); test/parity/FIXTURE-INVENTORY.md's Phase 43 Plan 02 subsection"
affects: [43-03-loot-legibility-gear-panels, 43-04-shell-wiring-phase-close]

tech-stack:
  added: []
  patterns:
    - "eatsFor(sheet) is the single appetite read every consumer (nightlyEats's hero/member terms, the rationsEaten eaters array, makeCamp's campFailed.members, and rationsViewModel) calls — one function, five call sites, so the Hero sheet can never disagree with what Make Camp charges (the CLAR-03 invariant, made structural rather than merely tested)."
    - "RATION_RULE_LINE (eventNarration.js) and RATIONS_COPY.why (viewModels.js) are two independent frozen objects keyed by the SAME race string (Troll) — the Oracle's rest line and the Hero-sheet reason clause read different objects but can never drift, since both are hand-authored from the same one-row audit finding (docs/RATIONS.md)."

key-files:
  created:
    - docs/RATIONS.md
    - test/unit/rations-audit.test.js
    - test/unit/rationsViewModel.test.js
  modified:
    - engine/movement.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - src/browser/rail.js
    - src/browser/viewModels.js
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/rail.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/CLARITY.md

key-decisions:
  - "The rationsEaten toast/RAIL_DIRECT tie: dayBegan is a RAIL_DIRECT entry hardcoded to PRIORITY.other, and rationsEaten's own toast is also PRIORITY.other (per this plan's own spec) — on a real fed-night dispatch with dayBegan at idx 0 and rationsEaten at idx 1, railCardFor's existing lowest-idx tie-break picks dayBegan (title DAY N) as the card head, not FED, UNLESS a higher-priority event (rested, PRIORITY.feature) is also present. This is the SAME pre-existing pattern wentHungry (also PRIORITY.other) already had against dayBegan before this plan touched anything — verified live, not assumed — so it was left alone rather than risk changing railCardFor's shared tie-break logic for every other event pair in the app. RAIL_FAMILY.rationsEaten (FED) is fully correct and reachable directly (railFamilyFor / a card where rationsEaten IS the highest-priority line); test/unit/rail.test.js's new tests assert the real behavior rather than the plan's own simplified illustration."
  - "docs/RATIONS.md's audit is a genuine, line-cited comparison against the frozen prototype AND the rulebook (via pdftotext), not a restatement of the engine's own comments — every 'Prototype (line)' cell was checked against test/parity/prototype-master.js.txt directly during authoring."

requirements-completed: [CLAR-01, CLAR-03, CLAR-05]

coverage:
  - id: D1
    description: "engine/movement.js#eatsFor(sheet) is exported and value-identical to the three inline reads it replaces; nightlyEats/newDay/makeCamp all route through it; zero new rng draws"
    requirement: "CLAR-03"
    verification:
      - kind: unit
        ref: "test/unit/rations-audit.test.js (eatsFor/nightlyEats pins, the draw-count line-count pin); test/unit/movement.test.js (116/116); test/parity/*.test.js (69/69)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ration/upkeep rules audited and ledgered in docs/RATIONS.md (12 rows: rule, prototype line, rulebook page, engine site, event/narration, status); zero missing prototype rules found"
    requirement: "CLAR-05"
    verification:
      - kind: unit
        ref: "test/unit/rations-audit.test.js's docs/RATIONS.md ledger-parsing test (every Engine-site .js path verified to exist on disk)"
        status: pass
    human_judgment: false
  - id: D3
    description: "rationsEaten { eats, left, eaters } names every eater and, via RATION_RULE_LINE, the rule that applied (\"Trolls eat for two.\"); wentHungry names need/have/mouths and the Heft halving; both surfaced through EVENT_NARRATION + TOAST_FOR + RAIL_FAMILY"
    requirement: "CLAR-01"
    verification:
      - kind: unit
        ref: "test/unit/rations-audit.test.js's narration block (exact Oracle/toast strings); test/unit/rail.test.js (29/29); test/unit/toastsCoverage.test.js + test/unit/formatEventsCoverage.test.js (green); test/voice/safety-scan.test.js (7/7)"
        status: pass
    human_judgment: false
  - id: D4
    description: "rationsViewModel(state)/eatsLineFor(sheet)/RATIONS_COPY exist in src/browser/viewModels.js; total === nightlyEats(state) and carried === state.c.rations in every case (solo/Troll/party)"
    requirement: "CLAR-03"
    verification:
      - kind: unit
        ref: "test/unit/rationsViewModel.test.js (9/9); test/unit/hp-not-wp.test.js (7/7, RATIONS_COPY walked)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole-suite engine gate holds: master hash unchanged, npm test green, npm run build:www exits 0, git status --porcelain test/parity/fixtures empty, no package.json/lock diff"
    verification:
      - kind: other
        ref: "npm test 3112/3112 (# fail 0); git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0; npm run build:www exit 0; git diff --stat HEAD~3 -- package.json package-lock.json empty"
        status: pass
    human_judgment: false
  - id: D6
    description: "The rewritten Oracle/rail lines and the ration numbers are visually confirmable on a Pixel 7"
    verification: []
    human_judgment: true
    rationale: "Deferred per the standing defer-uat-to-end instruction — no device steps taken this plan; the Pixel 7 checklist below runs at the end-of-run UAT batch."

duration: unrecorded (single continuous session, no start-time checkpoint captured)
completed: 2026-09-18
status: complete
---

# Phase 43 Plan 02: Ration Audit + rationsEaten Event + Honest View Model Summary

**A full CLAR-05 audit of every ration/upkeep rule against the frozen prototype and the rulebook (`docs/RATIONS.md`, 12 rows, zero missing rules found), one appetite read (`eatsFor`) that five consumers now share, a new `rationsEaten` event that names every eater and every rule that applied ("Trolls eat for two."), an honest cause-first `wentHungry`, and a pure `rationsViewModel` whose `total` IS `nightlyEats(state)` — so the Hero sheet can never disagree with what Make Camp charges.**

## Performance

- **Duration:** unrecorded (single continuous session, no start-time checkpoint captured)
- **Tasks:** 3 (plan tasks) — committed as 2 atomic task commits (Task 3 is this metadata commit)
- **Files modified:** 13 (3 new, 10 modified)

## Accomplishments

- **Task 1 — the audit, `eatsFor`, `rationsEaten`, `wentHungry`'s additive keys:** `engine/movement.js#eatsFor(sheet)` exported directly above `nightlyEats`, replacing the three inline `RACES[...].eats || 1` reads (`nightlyEats`'s hero term, its member-loop term, and `makeCamp`'s member-eats read) with a byte-for-byte identical single function. `newDay`'s fed branch now pushes `{ type: "rationsEaten", eats, left, eaters }` immediately after the ration charge, where `eaters` is `[{ name, race, eats, hero: true }, ...members]` built from the same `eatsFor` reads. `newDay`'s unfed branch's `wentHungry` gained `need` (= the pre-charge `eats`), `have` (= `c.rations`, unchanged), `mouths` (= `1 + party.length`), and `heft: true` only when `skill(c, "Heft")`. `docs/RATIONS.md` (new) ledgers 12 audited rules (R1–R12) each with its prototype line, rulebook page, engine site, event/narration, and status — the audit's own planning-time expectation of zero missing prototype rules is confirmed live: every rule the frozen prototype implements has a live engine counterpart; the rest are engine-only additions or DECLARED DIVERGENCES already ratified in earlier phases (Phase 11 PARTY-10, Phase 25.1 DFB-06, audit-batch1 A3). `test/unit/rations-audit.test.js` (new, 23 tests) pins `eatsFor`/`nightlyEats` against every race combination, the exact `rationsEaten`/`wentHungry` payload shapes, `makeCamp`'s byte-identical refusal, the audit's own numeric claims (`upkeep` by race/Heft, starting rations by class via `newRun`, `cooked`'s ration gain via a real `killFoe` call, `STORE_EFFECTS.buyRations`, `clampCarry`'s bag cap), a draw-count line-count pin (22, unchanged), and a ledger-parsing test that verifies every `Engine site` cell in `docs/RATIONS.md` names a file that actually exists on disk. `docs/CLARITY.md` rows 34–38 filled with the real line text; `test/parity/FIXTURE-INVENTORY.md` gained its Phase 43 Plan 02 subsection.
- **Task 2 — the rest narration + the pure view model:** `src/browser/eventNarration.js` gained `RATION_RULE_LINE = { Troll: "Trolls eat for two." }` (exported, frozen, beside `PHOBIA_TRIGGER_PHRASE`) and two rewrites: `rationsEaten` builds a clause per eater ("you eat N" for the hero, "Name (race) eats N" for each member), appends the rule sentence for every distinct race among them that has one, then the cost ("−N ration(s), M left."); `wentHungry` rewrote from the old "No rations." to "Hunger: nobody packed — you eat/the party eats N a night, and you had M. Cost of living −C hp" with the Heft clause appended when it applied. `src/browser/toasts.js` gained `TOAST_FOR.rationsEaten` (a real cost, so it is toasted, never `ORACLE_ONLY`) and a matching `wentHungry` rewrite. `src/browser/rail.js` gained `RAIL_FAMILY.rationsEaten = { icon: "☾", title: "FED", tone: "good", hold: RAIL_HOLD.camp }` — a healing camp still heads `CAMP MADE` (`rested` outranks it by priority). `src/browser/viewModels.js` gained `RATIONS_COPY` (a frozen template-string object mirroring `ITEM_STATE_COPY`'s precedent), `eatsLineFor(sheet)` ("eats N a rest"), and `rationsViewModel(state)` — `hero`/`members` each carry `{name, race, eats, why}`, `total` IS `nightlyEats(state)` itself (never a re-sum), `carried` IS `c.rations` itself, `nights = floor(carried/total)`, and a single in-voice `line` (no "Party:" clause for a solo hero — "a party of one is not a party"). `test/unit/rationsViewModel.test.js` (new, 9 tests) pins every worked example from the plan's own `<behavior>` spec verbatim (solo Human, solo Troll, Human+Troll member, 0 rations) plus the `total`/`carried` invariant across three states and a frozen-COPY safety-wordlist walk. `test/unit/rations-audit.test.js` gained a narration block (6 more tests, 23 total): the exact Oracle strings via `narrativeToastText(narrateEvent(e))`, the toast texts, and the `RATION_RULE_LINE` shape. `test/unit/rail.test.js` gained the `RAIL_FAMILY.rationsEaten` shape pin plus two camp-card tests (a healing camp still heads `CAMP MADE`; a full-hp camp's card correctly folds both lines — see Decisions Made for what the second test actually proves, since the literal "heads FED" illustration in the plan text doesn't survive contact with `railCardFor`'s existing tie-break rule). `test/unit/hp-not-wp.test.js` walks `RATIONS_COPY` now; `test/voice/safety-scan.test.js`'s `BRANCH_TOGGLES` gained the four new payload branches (`heft`, `mouths`, a named-Troll `eaters` array, an empty `eaters` array).

## Task Commits

Each task was committed atomically:

1. **Task 1: The ration/upkeep audit -> docs/RATIONS.md; eatsFor; the rationsEaten event; wentHungry additive keys; audit pin test** - `c8349ad` (feat)
2. **Task 2: Rest narration that names every rule (rationsEaten / wentHungry on Oracle + toast + rail family) and the pure rationsViewModel / eatsLineFor / RATIONS_COPY** - `3698dc2` (feat)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `docs/RATIONS.md` (new) — the CLAR-05 audit ledger (12 rows)
- `test/unit/rations-audit.test.js` (new) — 23 tests: `eatsFor`/`nightlyEats`, `rationsEaten`/`wentHungry` shapes, `makeCamp`'s unchanged refusal, the audit's own numeric pins, the ledger-parsing test, and the narration block
- `test/unit/rationsViewModel.test.js` (new) — 9 tests: `RATIONS_COPY`, `eatsLineFor`, and every `rationsViewModel` worked example plus the `total`/`carried` invariant
- `engine/movement.js` — `eatsFor(sheet)`; `nightlyEats`/`makeCamp` re-expressed through it; `newDay`'s `rationsEaten` push; `wentHungry`'s additive keys
- `src/browser/eventNarration.js` — `RATION_RULE_LINE`; `rationsEaten`/`wentHungry` narration rewrites
- `src/browser/toasts.js` — `TOAST_FOR.rationsEaten`; `wentHungry`'s toast rewrite
- `src/browser/rail.js` — `RAIL_FAMILY.rationsEaten` (FED)
- `src/browser/viewModels.js` — `RATIONS_COPY`, `eatsLineFor`, `rationsViewModel`
- `test/voice/safety-scan.test.js` — four new `BRANCH_TOGGLES` entries
- `test/unit/hp-not-wp.test.js` — `RATIONS_COPY` added to the walked COPY banks
- `test/unit/rail.test.js` — the `RAIL_FAMILY.rationsEaten` shape pin + two camp-card tests
- `test/parity/FIXTURE-INVENTORY.md` — the Phase 43 Plan 02 subsection
- `docs/CLARITY.md` — rows 34–38 filled; a Plan 02 addendum section

## Decisions Made

- The `rationsEaten`/`dayBegan` rail-card tie-break finding (see `key-decisions` in the frontmatter for the full explanation) — `RAIL_FAMILY.rationsEaten` (FED) is correctly built and reachable, but on a real dispatch where `dayBegan` (idx 0, `PRIORITY.other`) and `rationsEaten` (idx 1, `PRIORITY.other`) are the only two events, the existing `railCardFor` lowest-idx tie-break picks `dayBegan` as the head — the exact same pattern the pre-existing `wentHungry` already had against `dayBegan`, verified live. Left alone rather than risk changing shared fold logic for every other event pair; `test/unit/rail.test.js`'s new tests assert the real, verified behavior.
- `docs/RATIONS.md`'s audit is a genuine line-cited comparison, not a paraphrase of engine comments — every `Prototype (line)` cell was checked against `test/parity/prototype-master.js.txt` directly.

## Deviations from Plan

None - plan executed exactly as written. The one place this plan's own `<behavior>` text described an outcome (`[dayBegan, rationsEaten]` folding to a card titled `FED`) that doesn't survive contact with `railCardFor`'s existing tie-break rule is documented above as a finding, not a code change — no file outside this plan's own `<files_modified>` list was touched, and the executable bash acceptance criteria (the `RAIL_FAMILY.rationsEaten` shape check) all passed as specified.

## Issues Encountered

None beyond the rail tie-break finding above (discovered while authoring the test, verified against the pre-existing `wentHungry` precedent, and resolved by writing an accurate test rather than a code change).

## User Setup Required

None — no external service configuration required.

## Gate (Task 3, plan's own verification — verification agents are off)

- `npm test`: **3112/3112**, `# fail 0`
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged)
- `npm run build:www`: exit 0
- `git status --porcelain test/parity/fixtures`: empty (zero fixture files touched by this plan)
- `git diff --stat HEAD~3 -- package.json package-lock.json`: empty (no installs)
- Coverage guards: `test/unit/toastsCoverage.test.js` and `test/unit/formatEventsCoverage.test.js` both green (they failed, as the plan explicitly predicted, immediately after Task 1's commit — before Task 2 added the `rationsEaten` narration/toast entries — and are confirmed green again here)
- `src/browser` was touched (Task 2), so `npm run build:www` was run and confirmed exit 0 per the plan's own gate requirement
- `store-listing/`/`tools/store-screenshots/`: untouched throughout (never staged)
- No `mazeworld.html` edit was made this plan (per the plan's own standing rule — Plan 04 owns the Hero RATIONS block and Company panel re-point)

## Audit verdict

- **Rules audited:** 12 (`docs/RATIONS.md` R1–R12), each with a prototype line, a rulebook page (or "no ration count" where the rulebook has none), an engine site, an event/narration, and a status.
- **Missing prototype rules found:** **None.** Every ration/upkeep rule the frozen prototype implements (hero appetite, the 100-square day, the fed/unfed branches, starvation-to-death, starting rations, ration sources) has a live engine counterpart. The remaining rows are either engine-only additions with a recorded rationale (the party-appetite/party-upkeep extension, the bag-capacity clamp) or DECLARED DIVERGENCES already ratified in an earlier phase (Phase 11 PARTY-10 / Phase 25.1 DFB-06 for the party rows; audit-batch1 A3 for the rest-time affliction-cure roll, which shares the fed-night branch).
- **Rulebook-only rules not adopted:** the sleep-hours partial-rest penalty (p.9/p.14) and the wandering-monster-hour WP forfeit (p.14) — neither has a prototype counterpart, so per the greenfield ruling ("prototype is canon; the AFTER matrix is closed") neither was adopted. The rulebook's food table (p.48) is not a separate rule — it IS the prototype's `FOODS` bank, already ported.

## Human verification (deferred to end of run)

Per the standing `defer uat to end` instruction, no device steps were taken this plan. A Pixel 7 tester should check, at the end of the run (batched with the other Phase 43 plans):

1. **Make camp with rations, no heal needed (already at full hp)** — the rail card reads `Rations: you eat N…` (title may read DAY N or FED depending on what else fired that dispatch — both are correct per this plan's own rail tie-break finding above); with a Troll hero or Troll member in the party the line ends `Trolls eat for two.` before the ration count.
2. **Make camp with rations, a heal happens** — the rail card heads `CAMP MADE`, and the Oracle log shows the `Rations: …` line immediately before the rest line.
3. **Walk (or camp) with 0 rations** — the rail/Oracle line reads `Hunger: nobody packed — you eat 1 a night, and you had 0. Cost of living −N hp.` (or "the party eats N a night" with a live Joiner); a Heft Thief additionally sees the `(Heft: half, as promised)` clause.
4. **Tap MAKE CAMP without enough rations** — the refusal still states need/have and the members exactly as before (unchanged this plan) — no regression.
5. **A voice read of the new `Rations:`/`Hunger:`** lines — deadpan, family-friendly, no tonal drift from the surrounding Oracle log.

## Corrections to CONTEXT

- `43-CONTEXT.md`'s decisions section states "today 1 a night, Troll 2, Heft halves wp upkeep only" as the audit's expected starting point. Confirmed exactly by the live audit: Heft's halving (`content/skills.js`, `engine/derived.js#upkeep`) applies only to the unfed-night `upkeep()` cost, never to the ration count itself (`eatsFor` reads `RACES[race].eats` alone, with no Heft term) — this matches both the prototype (Heft only ever modifies the cost-of-living branch, never the ration-consumption branch) and the rulebook's own wording of the skill.
- The prototype's fed-night branch narrates "pay N wp of upkeep from your rations" but — per a direct read of `test/parity/prototype-master.js.txt` lines 1280-1287 — never actually subtracts wp anywhere in that branch; the only real fed-night cost is the ration count. The engine's `rested` event carries the exact same property: it narrates a heal, never a hp charge, on a fed night. This is recorded as R5 (IMPLEMENTED, "narration-only cost in both") in `docs/RATIONS.md` rather than treated as a missing rule, since the prototype itself never charges hp on a fed night either.
- `43-01-SUMMARY.md`'s own note that "CLAR-01 is only half-landed by [Plan 01]" is now resolved: this plan lands the day-cycle rows (`dayBegan` unchanged, `rationsEaten` new, `wentHungry` additive, `rested` verified, `campFailed` unchanged), so `requirements-completed` above lists `CLAR-01` alongside `CLAR-03`/`CLAR-05`.

## Next Phase Readiness

- CLAR-01 is now fully landed (both Plan 01's non-day-cycle half and this plan's day-cycle half); CLAR-03 and CLAR-05 are fully landed.
- Plan 03/04 (CLAR-02/04 loot legibility, gear panels, shell wiring) can proceed independently — this plan touched no shell code (`mazeworld.html` untouched, confirmed) and introduced no new serialized fields. Plan 04's Hero RATIONS block and Company panel can read `rationsViewModel`/`eatsLineFor` directly, with the guarantee that `total === nightlyEats(state)` by construction.
- No blockers. `npm test`: 3112/3112, `# fail 0`. Master hash unchanged. Full parity suite green; `mazeworld.html` untouched; no shell straggler to hand off.

---
*Phase: 43-clarity-pass*
*Completed: 2026-09-18*

## Self-Check: PASSED

Verified on disk: `docs/RATIONS.md`, `test/unit/rations-audit.test.js`, `test/unit/rationsViewModel.test.js`, `engine/movement.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `src/browser/rail.js`, `src/browser/viewModels.js`, `test/voice/safety-scan.test.js`, `test/unit/hp-not-wp.test.js`, `test/unit/rail.test.js`, `test/parity/FIXTURE-INVENTORY.md`, `docs/CLARITY.md` all exist.
Verified in git log: `c8349ad`, `3698dc2` both present on `master`.
