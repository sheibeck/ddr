---
phase: 95-fantasy-flavour-i-the-text-layer-spells-scrolls-items
plan: 01
subsystem: shell text layer (flavour lookup, guards, voice tooling)
tags: [flavour, text-layer, guards, voice-corpus, drift-test]
requires:
  - phase: 94.1
    provides: baseline (Joiner level rule, engine/encounters.js, roll-high tests, docs)
provides:
  - src/browser/flavorText.js (FLAVOR_DOMAINS, flavorKeyOf, flavorOf, flavorOfItem, flavorOfSpell, flavorOfScroll, everyFlavorLine)
  - flavor-text, flavor-layer, flavor-drift unit tests and the flavor-not-serialized roundtrip test
  - nine pre-registered voice-corpus banks and the FLAVOR_DOMAINS non-copy row
  - docs/TEXT-LAYERS.md (the model Phase 96 reuses)
affects: [95-02, 95-03, 95-04, 95-05, 95-06, 95-07, 95-08, 96]
tech-stack:
  added: []
  patterns: [keyed frozen flavour maps plus a pure name lookup (no serialized field), table-driven domain guards, temp-mirror drift test]
key-files:
  created:
    - src/browser/flavorText.js
    - test/unit/flavor-text.test.js
    - test/unit/flavor-layer.test.js
    - test/unit/flavor-drift.test.js
    - test/roundtrip/flavor-not-serialized.test.js
    - docs/TEXT-LAYERS.md
  modified:
    - tools/lib/voice-corpus.mjs
    - docs/narrative-pass/README.md
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js
key-decisions:
  - "Flavour lives in one keyed frozen map per content file and is looked up by name at draw time; items never carry it (rows are spread onto rolled items, so a field would be serialized into saves)."
  - "Special skills are not a flavour domain in this phase."
  - "Absent maps are skipped by name in flavor-layer until 95-08 makes absence a failure."
requirements-completed: [FLAVOR-05, FLAVOR-01, FLAVOR-02]
status: complete
duration: ~30 min
completed: 2026-10-03
---

# Phase 95 Plan 01: The two-layer data shape, guards and voice registration Summary

A pure name-to-flavour lookup over eight keyed domains (111 content keys), the guards that prove every map complete and number-free, a fail-first drift test proving a drifted rules number still fails its v2.3 guard, and all nine new banks pre-registered in the voice corpus. Zero engine and content bytes changed.

## Plan base (for every later Phase 95 plan)

- PHASE_BASE: `cb5f77ecc7e08943939f9111fec2321d23f83feb` (HEAD at plan start, after Phase 94.1)
- Audit row counts (`grep -c '^| '`), unchanged at the end: docs/ITEM-AUDIT.md 121, docs/SPELL-AUDIT.md 112, docs/SKILL-AUDIT.md 32, docs/IDENTITY-AUDIT.md 168, docs/VALUE-LEDGER.md 100.

## Tasks and commits

| Task | Commit | What |
| --- | --- | --- |
| 1. Pure flavour lookup and not-serialized guard | d5be08ab | `src/browser/flavorText.js`, `flavor-text.test.js`, `flavor-not-serialized.test.js` (RED confirmed first: ERR_MODULE_NOT_FOUND with the module moved aside, then GREEN) |
| 2. Flavour guards and fail-first drift test | 3cfb6984 | `flavor-layer.test.js`, `flavor-drift.test.js` |
| 3. Register banks, extend scans, model doc | f0734574 | `tools/lib/voice-corpus.mjs` (9 bank rows + 1 non-copy row), README "No new banks" amendment, `safety-scan` and `hp-not-wp` walk `everyFlavorLine()`, `docs/TEXT-LAYERS.md` |

## Drift test measurements

- Heal d10 -> d12 in a temp mirror: `test/unit/spell-skill-text-engine.test.js` ran 3.2 s, exit 1, failing title `Heal: every number the text states is claimed by one fact and equals the engine`.
- Ring of Power "for fifty squares" -> "for sixty squares": `test/unit/item-text-engine.test.js` ran 2.0 s, exit 1, failing titles `truth: every stated number equals the engine's, for every row` and also `the guard fails a CHANGED number, an ADDED number and a VANISHED sentence (it is not vacuous)`.
- The plan predicted 15-25 s per child; the measured runs were 2-3 s (the guards are faster than predicted). Not a behaviour change.
- Extra files the mirror needed beyond the plan's list: none. The mirror copies `engine/`, `content/`, `src/`, `test/unit/harness/`, `package.json` and the one guard file; both guards ran with a real assertion failure, never an import error.
- Each mutation asserts its anchor occurs exactly once (Heal: `healing · you · d10 hp` in content/spells.js; Ring: `for fifty squares` inside the Ring row only), so a reword cannot make the test vacuous.

## Verification results

- Full `npm test`: tests 10339, pass 10299, fail 0, skipped 40 (32 of the skips are the flavor-layer per-domain tests, skipped by name because no `*_FLAVOR` export exists yet; the other 8 predate this plan), duration about 235 s.
- `node tools/voice-inventory.mjs --check-ledgers --after`: 58 ledger files, 0 errors. `node tools/narrative-review.mjs --check`: pages in sync. `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count`: 0.
- `auditRegistry()`: no unregistered exports, no import failures.
- `git diff --stat cb5f77ec -- engine content`, the 18 guard files, the five audit docs, `docs/NARRATIVE-PASS.md` and `docs/narrative-pass/review.html`: empty.
- Line endings: the four CRLF files (`voice-corpus.mjs`, narrative-pass `README.md`, `safety-scan.test.js`, `hp-not-wp.test.js`) edited through a CRLF-preserving script and still report `w/crlf`, never `w/mixed`; the new files are LF in the working copy.

## Deviations from Plan

None - plan executed as written. Adaptations within the plan's intent, all documented above: the drift children ran faster than the plan's 15-25 s estimate; a self-inflicted label bug in the first draft of the hostile-value test (a `JSON.stringify` of the throwing Proxy in the assertion message) was fixed before the commit.

## Known Stubs

None. The flavour lookup returns `""` until the maps land; that is the designed behaviour (the surface then shows its rules text as today), and the per-domain guards skip by name until 95-08.

## Threat Flags

None. No network, auth, file-access or schema surface was added; the drift test writes only to an `os.tmpdir()` mirror it removes in a `finally` block.

## Self-Check: PASSED

- FOUND: src/browser/flavorText.js, test/unit/flavor-text.test.js, test/unit/flavor-layer.test.js, test/unit/flavor-drift.test.js, test/roundtrip/flavor-not-serialized.test.js, docs/TEXT-LAYERS.md
- FOUND commits: d5be08ab, 3cfb6984, f0734574
