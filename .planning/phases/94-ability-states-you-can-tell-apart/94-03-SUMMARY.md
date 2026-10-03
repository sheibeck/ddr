---
phase: 94-ability-states-you-can-tell-apart
plan: 03
subsystem: ui
tags: [copy, voice-corpus, ability-states, ASTATE-01, ASTATE-02, ASTATE-03]
requires: [94-01]
provides:
  - "ABILITY_STATE_COPY (frozen, with a frozen reason map) from src/browser/abilityStates.js"
  - "abilityStateLabel(st, meta) -> string"
  - "voice-corpus registration, hp-not-wp coverage, x-94-03 ledger (12 new-line rows)"
affects: [94-04, 94-05]
tech-stack:
  added: []
  patterns: ["one pure copy module read by both surfaces", "reason map pinned to the engine's reason lists by a coverage test"]
key-files:
  created: [src/browser/abilityStates.js, test/unit/ability-state-copy.test.js, docs/narrative-pass/why/x-94-03.json]
  modified: [tools/lib/voice-corpus.mjs, test/unit/hp-not-wp.test.js, docs/NARRATIVE-PASS.md, docs/narrative-pass/review.html]
key-decisions:
  - "Wording: notLowEnough NEEDS A QUARTER HP OR LESS (26 chars, the cap), notInCombat NOT IN A FIGHT, notFought FIGHT FIRST, unknown NOT ONE OF YOURS, wrongClass NOT FOR YOU, noTarget NO FOE IN REACH; tooFewFoes and alreadyOn kept"
  - "An unlisted reason string falls back to the unknown words"
  - "The Sing row uses the common words (READY IN N, SPENT THIS FIGHT), no Sing-specific copy"
requirements-completed: []
status: complete
duration: ~20 min
completed: 2026-10-03
---

# Phase 94 Plan 03: Ability-state words Summary

One frozen copy bank, `ABILITY_STATE_COPY`, and a pure `abilityStateLabel(st, meta)` turn the engine's `{ state, roundsLeft, reason }` into the plain upper-case label for every ability row; the bank is registered with the voice corpus and the hp scan and its twelve new lines are on the narrative review page.

BASE (HEAD at plan start): `5911a6f9d3169f2c5e5a7ea648f2287748b3723e`.

## Exported copy API (94-04 imports these)

From `src/browser/abilityStates.js` (no imports of its own, no DOM):

- `export const ABILITY_STATE_COPY` : frozen `{ ready, readyOnce, recharging, spent, reason }`; `reason` is a frozen map of eight keys (the union of `ABILITY_UNAVAILABLE_REASONS` and `SING_UNAVAILABLE_REASONS`)
- `export function abilityStateLabel(st, meta)` : `st` is an `abilityState` / `singState` result; `meta` is the catalog entry `ABILITY_BY_ID[key]` or `null` (Sing). Ready returns `READY · ONCE PER FIGHT` when `meta.cd === "fight"`, else `READY`; recharging returns `READY IN {roundsLeft}`; spent returns `SPENT THIS FIGHT`; anything else returns `reason[st.reason]`, falling back to `NOT ONE OF YOURS`.

## Final label table

| State or reason | Words | Where it shows |
| --- | --- | --- |
| ready | READY | combat ABILITIES row, Sing row, Hero tab |
| ready, `cd: "fight"` | READY · ONCE PER FIGHT (U+00B7) | once-a-fight abilities (e.g. Last Stand) |
| recharging (cooldown or songResting) | READY IN {n} (READY IN 1, no plural) | ability rows, Sing row; also a running duration effect (94-01 Pitfall 8) |
| spent (spent or sungThisFight) | SPENT THIS FIGHT | once-a-fight abilities, Sing row |
| unavailable: noTarget | NO FOE IN REACH | foe abilities with no live foe |
| unavailable: tooFewFoes | NEEDS TWO OR MORE FOES | kept from the old menu copy |
| unavailable: alreadyOn | ALREADY ON IT | kept from the old menu copy |
| unavailable: notLowEnough | NEEDS A QUARTER HP OR LESS | Last Stand above a quarter hp |
| unavailable: notInCombat | NOT IN A FIGHT | never in play (RESEARCH table) |
| unavailable: notFought | FIGHT FIRST | never in play |
| unavailable: unknown | NOT ONE OF YOURS | never in play; also the fallback |
| unavailable: wrongClass (Sing) | NOT FOR YOU | never in play |

Every label is upper case, at most 26 characters, only A-Z, digits, space, U+00B7 and the `{n}` slot.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1 | `5cd02353` | `src/browser/abilityStates.js` and `test/unit/ability-state-copy.test.js` (10 tests: reason map equals the engine union, frozen, exact words, ready/once/recharging/spent/unavailable mapping, distinct categories, house style and length, purity) |
| 2 | `6ae2533d` | `ABILITY_STATE_COPY` BANK_REGISTRY row (first, combat-screen), module added to the combat-screen RAW_SURFACES row and the 79-07 OWNER_RULES list (3 occurrences), hp-not-wp walks the bank, `x-94-03.json` (12 rows, all `before ""`), NARRATIVE-PASS.md and review.html regenerated |

## Verification

- `node tools/voice-inventory.mjs --check-ledgers --plan x-94-03 --after`: 0 errors. `node tools/narrative-review.mjs --check`: pages are in sync (870 rows, 12 ABILITY_STATE_COPY rows on the page).
- Targeted voice run (voice-corpus, hp-not-wp, narrative-review, roll-phrasing, authored-ranges, stale-terms, safety-scan, ability-state-copy): 151/151.
- Full `npm test`: 10265 tests, 10257 pass, 0 fail, 8 skipped (baseline 10255 / 10247 / 0 / 8; +10 = the new test file).

## Deviations from Plan

None - plan executed as written. Test-authoring detail: the house-style regex strips the `{n}` slot before matching, because the slot's lowercase `n` is by design outside A-Z. Task 1 wrote the module and the test in the same step rather than seeing the test fail first (the fail-first run was skipped; the test was run green immediately and its coverage assertions were checked against the engine lists).

## Known Stubs

None. Nothing reads the bank yet; 94-04 wires the combat menu, the Sing row and the Hero tab to it and retires `COMBAT_MENU_COPY.abilityReady*` / `abilityTooFewFoes` / `abilityAlreadyOn` and `ABILITY_VIEW_COPY`'s old state words.

## Threat Flags

None.

## Self-Check: PASSED

- `src/browser/abilityStates.js`, `test/unit/ability-state-copy.test.js`, `docs/narrative-pass/why/x-94-03.json` exist.
- Commits `5cd02353` and `6ae2533d` exist and carry both trailers.
