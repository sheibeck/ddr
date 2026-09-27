---
phase: 76-darkness-unification-relaunch-persistence
status: passed
verified: 2026-09-26
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 5/5 requirements
human_verification:
  - "Dark patch, no light: only the 3x3 around the party is revealed. With a torch lit, squares two away are revealed as you walk; with the Amulet of Light, three away. The explored map stays visible."
  - "A fight on a dark patch with no light shows 'You cannot see what you are fighting.' and caps the odds. With a torch lit there is no such line, and the odds match a lit square."
  - "A Darkness-phobic hero entering the dark with a torch lit is not frightened; with no light they are."
  - "The DARK chip, its tap card, the vignette and the dark map squares all agree. A light source reads '… is holding it back', and dark squares take a faint warm tint that still reads as dark."
  - "Save & quit mid-fight, or swipe the app away mid-fight: relaunch returns the same fight (foes, HP, round, effects). The Oracle says 'Still here. Still fighting. Round N…', and moving is still refused."
  - "Relaunch with the store open: the same store with the same stock, and the Oracle says 'The shopkeeper has not moved…'. Relaunch during a pending find, hazard, tile or Joiner offer: the same decision is waiting."
  - "A deep hero carrying more gold than the bag cap keeps it all across a relaunch."
  - "Force-close between an action and its save write (not reproducible in tests): the relaunch lands on the last saved state, with no duplicated or lost turn."
  - "Cast Map the Floor: the whole floor shows and the chip reads 'Mapped · until you move'. Tabs, camping and a fight on the same square keep it. One step fogs back the parts you never walked, and the Oracle and rail say your focus broke. A recast shows it again, and a relaunch mid-window keeps it. A Map the Floor scroll behaves the same."
  - "A fumbled Weaken scroll in a fight puts a Weakened chip on YOU, halves your blows, and puts no weakened badge on any foe."
  - "The full item-by-item list is in 76-05-SUMMARY '## Phase 76 device checklist' (22 items) and 76-06-SUMMARY's Plan 06 addendum (7 items)."
---

# Phase 76: Darkness Unification & Relaunch Persistence — Verification

**Verdict:** passed on automated evidence. The device checks above are batched into the milestone-close Pixel 7 checklist.

## Requirement coverage

| Req | Evidence | Status |
|-----|----------|--------|
| DARK-01 | 76-01 adds `DARK_WAIVERS`, `darkWaiver`, `darkWaived` and `darkLimited` in engine/derived.js. `revealRadius`, `mapViewRadius`, the dark to-hit cap, `combatInDark`, no-crit-in-the-dark and both Darkness-phobia triggers now read one predicate, covering the "combat too" ruling. Tested by `test/unit/dark-waiver.test.js`, the new ledger rows, and a Phase 76 exposure guard in divergence-records | ✓ |
| DARK-02 | 76-02: the DARK chip, its tap card, the vignette and draw()'s dark tiles read `darkWaiver(S.c)` through the bridge, and the shell computes no waiver of its own. Adds the lit-dark tile tint, honest copy (Sense Presence stated as fight-only) and the draw() hash re-pinned with its cause | ✓ |
| DARK-03 | 76-06, user ruling 2026-09-26: Map the Floor lasts only until you move. It gets a one-square window on the existing squares timer, with `move` as the only tick site (pinned). The chip has no countdown, and `clampRevealWindow` handles old saves. All copy says "until you move". The bot plays the new rule. 16 tests in `test/unit/map-until-move.test.js` | ✓ |
| SAV-06 | 76-03 validates and resumes the live fight on load, keeping `resumedSubState` whole or dropping it; `beats` is null and the load draws no rng. 76-04 adds `takeBootResumeEvents()`, the adapter relaunch proofs, and the every-key-path relaunch walk (742 states from a 16-run bot corpus). 76-05 adds the Oracle resume line | ✓ |
| SAV-07 | Same chain for the open store, the pending find, hazard, tile and Joiner offer (the 2026-09-25 persist ruling) | ✓ |

## Also shipped in this phase
- **Weaken-fumble fix** (user ruling 2026-09-26; found by 75.3-07's guard): a fumbled Weaken now puts `c.foeEffect {kind:"weakened"}` on the reader instead of weakening the foes. ROLL-LEDGER X8 is resolved and its exemption removed from the control guard.
- **Purse-clamp fix** (76-04, Rule 1): a load no longer trims an over-cap purse. The trim runs only when an old save's gear migration spills an item into the bag.

## Automated gates (master 9d14dd54, after merging 76-06 alongside 77-05/06 and 78-02)
- `npm test`: **6980/6980**. Parity: **64/64**. `boot:check`: PASS.
- The prototype master hash is unchanged. **Zero parity fixtures moved across the phase.** No state pin, pre-switch save or shell snapshot moved. Two bot-tactics Magic User seeds shortened after the Map the Floor change and are declared in the FIXTURE-INVENTORY Plan 06 subsection; both still die naturally, so no seed was swapped.
- No bot balance runs, per the user ruling. The Phase 76 stub in DIFFICULTY-RETUNE.md points to Phase 79.1.
