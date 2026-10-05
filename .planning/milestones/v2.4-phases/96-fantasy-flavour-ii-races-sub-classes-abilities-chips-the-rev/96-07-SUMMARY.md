---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 07
subsystem: ui
tags: [flavour, condition-chips, rail, rules-layer, ability-pool]

requires:
  - phase: 96-04
    provides: flavorOfChip and the 47 chip lines
  - phase: 96-06
    provides: flavorOfAbility surfaces and the flavour-first, RULES-behind pattern
  - phase: 95-05
    provides: the rail line's rules property (mounted behind a RULES toggle, never typed or announced)
provides:
  - railLineCard and conditionCard take an optional trailing flavour spec { line, id, name }; the exact old line rides on lines[0].rules
  - abilityPoolFlavor(c) in rail.js
  - chipFlavorSpec in the shell; window.mzRailLine and window.mzConditionCard forward a trailing flavour argument
  - every chip tap card (HUD strip out of a fight, combat condition card, YOUR LOT hero and Joiner, Company panel) leads with the flavour line, the whole conditionTapText behind RULES
  - the first-paint UP YOUR SLEEVE card reads "New trick: <name> - <flavour>" with the exact old line behind RULES
affects: [96-08]

tech-stack:
  added: []
  patterns:
    - "Call sites keep passing the exact old text as the second argument and gain one trailing flavour spec; one pure function in rail.js swaps lead and rules"
    - "Fail-open flavour spec: chipFlavorSpec returns null for a missing bridge, an unknown key or a throwing descriptor, and the card is today's card with no toggle"

key-files:
  created: []
  modified:
    - src/browser/rail.js
    - src/browser/heroTab.js
    - src/browser/bridge.js
    - mazeworld.html
    - test/unit/harness/shellSandbox.js
    - test/unit/rail.test.js
    - test/unit/rules-surfaces.test.js
    - test/unit/shell-company-items.test.js
    - test/unit/shell-gear-39.test.js
    - test/unit/shell-map-hud.test.js
    - test/unit/status-chit-combat.test.js
    - test/unit/shell-abilities.test.js
    - test/unit/shell-worn-slots.test.js
    - test/unit/shell-map-rail.test.js

key-decisions:
  - "The chip id is chip:<key>[:<ability|kind>][:<source|item>][:member], so a hero's and a Joiner's open RULES body never collide"
  - "surfaceAbilityPool logs the flavour line (not the rules text) to the Oracle log when the ability has one, as flagged in the plan; the one-line revert is `flavor ? flavor.line : card.line` back to `card.line`"

patterns-established:
  - "A shell chip entry carries an optional flavor spec; heroTab hands it to deps.railInfo as a third argument and a missing one is simply undefined"

requirements-completed: [FLAVOR-04]

coverage:
  - id: D1
    description: "Every chip tap card on four paths leads with the flavour line and holds the whole conditionTapText byte for byte behind RULES; the chip label and count are untouched"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/rules-surfaces.test.js (z1) (z2) (z3) (z4) (z5); test/unit/rail.test.js; test/unit/shell-company-items.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "A RULES tap on a chip card never dismisses, pulses, aims or dispatches; a repaint keeps the body open; Always show the rules drops the toggle"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/rules-surfaces.test.js (z1) (z2) (z3) via assertRulesTapStaysPut"
        status: pass
    human_judgment: false
  - id: D3
    description: "A chip with no flavour (unknown key) raises exactly today's card, no toggle"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/rules-surfaces.test.js (z6); test/unit/rail.test.js Test 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "UP YOUR SLEEVE reads New trick: <name> - <flavour> with the exact old line behind RULES; a Magic User raises no card"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/rules-surfaces.test.js (z7); test/unit/rail.test.js abilityPoolFlavor cases; abilityPoolCard pins unedited"
        status: pass
    human_judgment: false
  - id: D5
    description: "conditionTapText, explainCondition, CONDITION_COPY, CONDITION_EXPLAIN and every chip guard are byte-identical; no fixture, engine byte or serialized field moves"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "authored-ranges, item-text-wording, spell-skill-text-wording, hero-conditions, flavor-lines-not-serialized: unedited and green"
        status: pass
    human_judgment: false
  - id: D6
    description: "How the flavour-first chip card reads and holds on a real phone, with RULES open"
    requirement: FLAVOR-04
    verification: []
    human_judgment: true
    rationale: "Hold time with the body open, touch targets and text fit are device judgments; deferred to the end-of-run walk"

duration: 55min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 07: Chip tap cards and UP YOUR SLEEVE Summary

**Every condition-chip tap card (HUD strip, combat condition card, YOUR LOT hero and Joiner, Company panel) now leads with the chip's flavour line and keeps the whole old tap text behind the shared RULES toggle, reusing the rail line's `rules` property; the first-paint UP YOUR SLEEVE card does the same. No fixture, engine byte or number moved.**

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `2b74d86f` | railLineCard and conditionCard flavour spec, chipFlavorSpec, mzRailLine and mzConditionCard trailing flavour, HUD strip and YOUR LOT call sites, flavorOfChip on `__mzRules` and the sandbox mirror, declared re-pins |
| 2 | `6803f861` | memberChipsFor flavour, tabDeps railInfo forwarding, heroTab passes ch.flavor, railInfo pin re-pinned, pass-through case |
| 3 | `024d1733` | abilityPoolFlavor, surfaceAbilityPool, surface cases (z1)-(z7), three more declared re-pins |

## What changed

- **rail.js:** `railLineCard(title, line, tone, hold, icon, iconKey, flavor = null)` and `conditionCard(title, line, flavor = null)`. A spec with a non-empty string `line` makes `lines[0] = { text: flavour, roll: null, rules: <exact line>, rulesId, rulesName }`; anything else leaves the card byte-identical to today's. New pure `abilityPoolFlavor(c)` returns `{ line: "New trick: <name> - <flavour>", id: "pool:<id>", name }` for the same ability `abilityPoolCard` picks, or null (Magic User, table-only list, unknown id, no flavour, bad input). `abilityPoolCard` and `RAIL_COPY` are untouched. rail.js now imports `flavorOfAbility` from flavorText.js (no cycle).
- **mazeworld.html:** classic `chipFlavorSpec(cn, label, member)` beside `conditionTapText` (fail-open); `paintConditions` passes it on both branches of the guarded tap; `yourLotChipsFor` and `memberChipsFor` entries gain `flavor`; `renderYourLot` passes `chip.flavor`; `tabDeps().railInfo(title, text, flavor)`; module `window.mzRailLine(..., iconKey = null, flavor = null)` and `window.mzConditionCard(title, text, flavor = null)` forward it; `flavorOfChip` imported and added to the frozen `window.__mzRules`; `abilityPoolFlavor` imported and used by `surfaceAbilityPool`.
- **heroTab.js:** the Company chip tap calls `deps.railInfo(label, ch.tapText(), ch.flavor)`.
- **shellSandbox.js, bridge.js:** the sandbox `__mzRules` mirror gains `flavorOfChip`; the bridge entry names the chip tap-card consumer.

## Declared re-pins (each carries a "Phase 96 (FLAVOR-04): declared re-pin" comment)

| File | Test | What moved |
| ---- | ---- | ---------- |
| test/unit/shell-gear-39.test.js | chip explain card hold literal (line ~194) | the rail line call now ends `"·", null, chipFlavor)` |
| test/unit/shell-map-hud.test.js | (f) paintConditions wiring (lines ~404-405) | both calls gain the trailing `chipFlavor`; explainText stays second |
| test/unit/status-chit-combat.test.js | guardInfoTap both-branches pin; mzConditionCard signature pin; beside-mzInspectFoe pin | trailing `chipFlavor`; `(title, text, flavor = null)` and `conditionCard(title, text, flavor)`; the "two mzConditionCard callers" pin stays two |
| test/unit/shell-company-items.test.js | tabDeps forwarding pin | `railInfo: (title, text, flavor) => ... "·", null, flavor)`; member entry pin gains `flavor: chipFlavorSpec(cn, label, true)` |
| test/unit/shell-abilities.test.js | surfaceAbilityPool pin | forwards `abilityPoolFlavor(state.c)`, logs `flavor ? flavor.line : card.line`, import line gains `abilityPoolFlavor` |
| test/unit/shell-worn-slots.test.js | rail.js import-line pin | `abilityPoolCard, abilityPoolFlavor }` |
| test/unit/shell-map-rail.test.js | (q) mzRailLine forwards the trailing iconKey | signature `iconKey = null, flavor = null` and `railLineCard(..., iconKey, flavor)` |

The last three were not named in the plan; they failed once and were re-pinned (the plan said to re-pin only what fails). The other tests that mirror the module entry points (status-chit-combat rig, your-lot-chips, darkness-vignette, size-voice) pass two arguments and needed no edit.

## New tests

- rail.test.js: railLineCard with no, empty, non-string and malformed flavour equals today's card; with a spec it leads with the flavour and carries the exact line on `rules`; conditionCard forwards it and keeps kind "cond"; abilityPoolFlavor for a Fighter (Brace), Magic User, table-only, unknown id and bad input (49 tests, 49 pass).
- shell-company-items.test.js: a chip with a flavour spec hands `(title, text, flavor)` to `deps.railInfo`, a chip without one hands undefined.
- rules-surfaces.test.js cases (z1)-(z7) over the real classic paint and real `renderRail`: harmful (darkness) and helpful (might, senses) chips on the HUD strip out of a fight; Afraid and might in a fight on the combat condition card; the hero's Smoke and a Joiner's Sidestep in YOUR LOT (member wording only inside the body); the ability chip's own line and txt; the darkness waiver sentence, dazed, weakened and a mirror Bubble; an unknown-key chip (today's card, no toggle, no throw); source pins on the entry points; the fresh Fighter and Thief pool card and the Magic User with none. Each asserts the RULES body equals the full `conditionTapText`, the toggle stays collapsed until tapped, a RULES tap never dismisses (also through the rail's own onclick after the arm window), never changes state, never dispatches, a repaint keeps the body open, and Always show the rules drops the toggle.

## Tests run (targeted only, no full suite, no bot runs)

- Task 1 set (rail, shell-map-hud, shell-gear-39, status-chit-combat, your-lot-chips, darkness-vignette, size-voice, hero-conditions, bridge-registry, shell-no-content-copies, authored-ranges, item-text-wording, spell-skill-text-wording): 317 tests, 317 pass.
- Task 2 set (shell-company-items, shell-company-panel, shell-party-camp, heroTab, status-chit-combat, hero-conditions): 99 tests, 99 pass.
- Task 3 set (rail, rules-surfaces, status-chit-combat, your-lot-chips, shell-map-hud, shell-gear-39, shell-company-items, ability-pool, shell-abilities, flavor-text, chip-flavor, shell-worn-slots, perfMarks, bridge-registry, shell-no-content-copies, flavor-lines-not-serialized): 278 tests, 278 pass. The plan's name-filter command on rules-surfaces: 10 pass.
- Guard sweeps over every other test that names rail.js or the touched functions (two batches, 31 files incl. shell-map-rail, typed-text, rail-dismiss, find-card-*, dismiss-joiner, hp-not-wp, stale-terms, voice-corpus, content-is-pure-data, shell-tab-snapshots): all pass after the shell-map-rail re-pin.
- `git diff --ignore-cr-at-eol --stat 01c3237c -- test/unit/fixtures/shell-snapshots engine test/parity test/determinism` prints nothing: no fixture, engine file or parity/determinism file moved in this plan. No `MZ_SNAPSHOT_UPDATE` run was needed.
- No CRLF-related failures. The worktree checks every file out as CRLF (index LF); every edit was written CRLF and `git ls-files --eol` shows `w/crlf` (never mixed) for all touched files, including rules-surfaces.test.js which the plan listed as LF.

## Deviations from Plan

**1. [Rule 3 - Blocking] Three source pins outside the plan's list.** `shell-abilities.test.js`, `shell-worn-slots.test.js` (the rail.js import line and the surfaceAbilityPool call) and `shell-map-rail.test.js` (the mzRailLine signature) pinned the exact text of lines this plan changes. Each was re-pinned with a declared comment; no behaviour changed.

**2. rail.js gained a flavorText.js import** so `abilityPoolFlavor` can read the ability's own line (the plan did not say where the lookup lives). flavorText.js imports only content and heroConditions, so there is no cycle, and the rail module stays pure.

**3. TDD note:** as in 96-01 to 96-06, implementation and tests landed together per task, so there is no separate failing-test commit.

## Known Stubs

None.

## Threat Flags

None. T-96-19: the rail's onclick already returns early for `.mw-rules-btn` (95-05); the (z1)/(z2)/(z3) cases call that handler after the arm window and assert the card stays, state is unchanged and nothing dispatches. T-96-20: `chipFlavorSpec` wraps `flavorOfChip` (which never throws) in a try/catch and returns null, so a hostile descriptor falls back to today's card (z6). T-96-21: the whole `conditionTapText` is the RULES body, compared byte for byte in every case, and the chip still shows its label and countdown (asserted in z1 and z3).

## Human verification (deferred to end of run)

Pixel 7 walk:
- Tap a harmful chip (for example Darkness, Afraid) and a helpful chip (Strong, a worn-item effect) on the HUD strip out of a fight, and again in a fight (the combat condition card); in YOUR LOT on the hero and on a Joiner; and on the Hero tab's Company panel.
- The card reads the flavour line first and a harmful chip's line still reads as trouble; RULES opens the exact old text (effect, explanation, how long, where from).
- A RULES tap never dismisses the card, never aims or ends a round; check the card's hold time with RULES open (it should stay readable).
- Always show the rules On shows the body at once with no toggle.
- The first-paint UP YOUR SLEEVE card on a fresh Fighter and a fresh Thief: "New trick: <name> - <flavour>", RULES opens the old line; the Oracle log shows the flavour line (if the old text is preferred there, it is the one-line change in `surfaceAbilityPool`).

## Self-Check: PASSED

- Files found: src/browser/rail.js (abilityPoolFlavor, flavor spec), mazeworld.html (chipFlavorSpec), src/browser/heroTab.js (ch.flavor), test/unit/rules-surfaces.test.js (z1-z7), the seven re-pinned test files.
- Commits found: 2b74d86f, 6803f861, 024d1733.
- STATE.md, ROADMAP.md and REQUIREMENTS.md untouched.
