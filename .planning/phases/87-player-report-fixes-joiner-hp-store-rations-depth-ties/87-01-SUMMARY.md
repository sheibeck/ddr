---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 01
subsystem: ui
tags: [party, joiner, combat-panel, hero-tab, view-helper, player-report-5]
requires: []
provides:
  - "memberLiveWp(state, partyIdx) -> { wp, maxWP, down }: the one live-hp read for a Joiner"
affects: [phase-88, phase-89]
tech-stack:
  added: []
  patterns: ["presentation-layer helper reads the engine's fight roster entry; engine untouched"]
key-files:
  created:
    - src/browser/partyHp.js
    - test/unit/joiner-live-hp.test.js
  modified:
    - src/browser/combatPanel.js
    - src/browser/heroTab.js
key-decisions:
  - "Fix report #5 in the presentation layer: both party displays read state.combat.allies by partyIdx during a fight, the sheet otherwise"
  - "Joiner armour never soaks a foe hit: recorded as a finding for Phase 89 (ITEM-06), nothing built"
requirements-completed: [PARTY-11]
duration: ~25 min
completed: 2026-09-29
status: complete
---

# Phase 87 Plan 01: Joiner live hp (PARTY-11, report #5) Summary

**A Joiner's card now shows every foe hit at once: one pure helper, `memberLiveWp`, reads the fight's roster entry (by `partyIdx`) and both YOUR LOT and the Hero Company panel use it, with zero engine bytes changed.**

## Root cause (re-confirmed against the #5 Oracle log)

1. **Not an armour soak.** The log's last lines are `8 vs 7–12 (size −1). Cave Bear turns on Zell Bonecrack for 11 hp.` with no "Your armour takes ..." line for Zell, and `foeTurn`'s member branch (`engine/combat.js` ~L3347-3446) has no armour soak: it goes `mDmg` -> halvings -> round cap -> `member.wp -= mDmg`. The user's "armor soaking a hit" theory is ruled out.
2. **Roster-vs-sheet desync.** The member branch subtracts from the fight's roster entry (`state.combat.allies[k]`, built in `startCombat` ~L413 with a `partyIdx` back-reference). The persistent sheet `state.party[i].wp` is only synced from the roster in `endCombat` (~L1811-1813). YOUR LOT (`combatPanel.js`) and the Hero Company panel (`heroTab.js`) both read the sheet, so mid-fight they showed the pre-fight number (30/30 after an 11 hp hit). `downMember` also sets the sheet's `status: "downed"` and splices the roster entry, which is why the helper looks up by `partyIdx`, never by position.

## What changed

- `src/browser/partyHp.js` (new, pure, no engine import): `memberLiveWp(state, partyIdx)` returns `{ wp, maxWP, down }`. Roster entry by `partyIdx` during a fight; the sheet outside a fight, in a solo fight (no `allies` key) or with no matching entry; `status: "downed"` reads wp 0 / down; a missing state, party or sheet reads `{ wp: 0, maxWP: 1, down: true }` and never throws.
- `src/browser/combatPanel.js`: a separate import line, and `yourLotViewModel`'s member cards use `const { wp, maxWP: max, down } = memberLiveWp(state, partyIdx);`. Every other card field is unchanged.
- `src/browser/heroTab.js`: a separate import line, and `renderPartyRoster` uses `const { wp, maxWP, down: downed } = memberLiveWp(state, idx);`. Card class, HP line, Downed chip, Weapon/Eats lines and DISMISS unchanged.
- `test/unit/joiner-live-hp.test.js` (new, 15 tests): 8 helper pins (sheet fallback, roster read, 1 hp / 0 / negative, downed sheet, two-Joiner lookup by `partyIdx`, no-throw edges, solo-fight fallback, no mutation) and 7 end-to-end pins (real `foeTurn` Cave Bear hit through both displays, the literal 19/30 report numbers, DOWN never 0/30 plus the Downed chip, 1 hp, two Joiners with the first downed and spliced, no Joiners, agreement after `endCombat`).

TDD: the helper tests ran red (module missing, then the 5 display assertions failed against the sheet reads), then green. The test file was committed in two stages so each task commit is coherent.

## Party displays found

Grep of `src/browser/*.js` and `mazeworld.html` for Joiner hp reads found exactly two: YOUR LOT (`combatPanel.js`) and the Hero Company panel (`heroTab.js`). `viewModels.js` `.wp` hits are item wear, not party hp; `mazeworld.html` `S.party` uses are the Joiner-offer swap and the walker read (no hp). Long-press details are foe-only. No third display exists.

## Finding for Phase 89 (ITEM-06, missing systems)

**Joiner armour never soaks a foe hit.** The hero's armour absorbs damage and wears ("Your armour takes 3 from Ned so you do not have to"); a Joiner has no such step in `foeTurn`'s member branch, so its armour (if it has any) does nothing. Deliberately not built here (CONTEXT decision); the Phase 89 audit should pick it up.

## Deviations from Plan

None. The plan asked for a seed search to drive `memberStruck`; the house `fakeRng` sequence (`[2, 3, 4]`: pick member, hit, damage die) drives the real `foeTurn` deterministically, and the test asserts against that event's own `dmg`, so the intent (real engine path, no hand-computed dice) holds.

Neighbouring suites (combatPanel, heroTab, shell-company-panel, shell-party-camp, your-lot-chips, shell-tab-snapshots, party-combat, bridge-registry, shell-no-content-copies) passed unchanged; no pin needed editing.

## Fixtures and gates

- `git diff --stat -- engine/ test/parity/ firebase/` prints nothing. No fixture moved or regenerated. No rng draw added. No `__mz` bridge names.
- Full `npm test`: tests 8081, **pass 8079, fail 0**, skipped 2 (baseline 8064 pass / 0 fail / 2 skipped; +15 = the new file).
- Commits (each with both trailer lines): `fbc2afb0` (helper + unit pins), `2b9b022b` (wiring + end-to-end pins).

## Known Stubs

None.

## Threat Flags

None.

## Human verification (deferred to end of run)

- [ ] With a Joiner in the party, start a fight; when the Oracle says a foe hits the Joiner, YOUR LOT's Joiner card drops by that amount on the same beat.
- [ ] Mid-fight, open the Hero tab: the Company panel shows the same hp as YOUR LOT.
- [ ] A Joiner knocked to 0 shows DOWN on its card, never "0/30"; after the fight, both displays still agree.

## Self-Check: PASSED

- FOUND: src/browser/partyHp.js, test/unit/joiner-live-hp.test.js
- FOUND commits: fbc2afb0, 2b9b022b
