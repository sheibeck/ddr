---
phase: 94-ability-states-you-can-tell-apart
status: passed
verified: 2026-10-03
verifier: orchestrator (deferred-UAT protocol)
requirements: [ASTATE-01, ASTATE-02, ASTATE-03, ASTATE-04, ASTATE-05]
full_suite: "10,283 tests / 10,275 pass / 0 fail / 8 skipped (phase start 10,226 / 10,218 / 0 / 8). Orchestrator re-run of the 7 ability-state, combat-menu and snapshot files: 119 / 119 pass. build:www exit 0; boot:check's 'graves' leg flaked (pre-existing, logged in STATE)."
human_verification:
  - "(94) In a fight, the ABILITIES submenu shows READY (solid edge, lime), READY IN N (dashed, amber; N drops each round), the gate's reason e.g. NEEDS TWO OR MORE FOES (hatched, rust) and SPENT THIS FIGHT (faded grey); judge the lime ink and the 12% hatch on the Pixel 7."
  - "(94) Tapping any non-ready row logs a refusal that matches its words; a READY row acts."
  - "(94) Last Stand reads NEEDS A QUARTER HP OR LESS above a quarter hp and READY at or below it."
  - "(94) The Hero tab's abilities list shows the same words and edges in a fight and is unchanged out of a fight."
  - "(94) A Bard's SING row reads READY IN N between songs and SPENT THIS FIGHT after the second."
---
# Phase 94 Verification

1. **Four states with distinct cues (ASTATE-01): passed.**
   - Rows carry `data-state` ready, recharging, unavailable or spent, with four `--mw-ast-*` tokens and four edge styles (solid, dashed, hatched, faded).
   - The labels come from the shared `src/browser/abilityStates.js`.
   - Pinned by the declared snapshots `fighter.abilities-states.txt` and `fighter.hero-in-combat.txt`, and by `shell-ability-states.test.js`.
   - The snapshot's `aria-disabled` is the shell's existing post-render arm-window marker, also present in older snapshots. It is not the new states.
2. **"Ready in N" (ASTATE-02): passed.** Recharging reads `READY IN {roundsLeft}`, with `roundsLeft` from the engine (`ability-state.test.js`, `ability-state-view.test.js`).
3. **Reason on the row (ASTATE-03): passed.** Every engine refusal reason has a plain label: NO FOE IN REACH, NEEDS TWO OR MORE FOES, ALREADY ON IT, NEEDS A QUARTER HP OR LESS, and more. The copy test pins the reason map to the engine's `ABILITY_UNAVAILABLE_REASONS` plus `SING_UNAVAILABLE_REASONS`.
4. **Engine-owned state, tap agrees (ASTATE-04): passed.**
   - `abilityState(state, sheet, key)` and `singState(state)` are pure, draw no rng and serialize nothing.
   - `useAbility` and `sing()` read them. 429 scenarios produced byte-identical refusal payloads before and after the refactor.
   - Parity, determinism, round-trip and roll-high pins are unchanged since c1b31539.
   - The tap-agrees-with-label sweep covers all 20 abilities and Sing.
   - Joiners are engine-pinned only, because no screen lists a Joiner's abilities. That was the user's "where listed" ruling.
5. **Readable in the shipped theme and for colour-blind players (ASTATE-05): passed.**
   - `ability-state-a11y.test.js` checks text contrast of at least 4.5:1, a greyscale luminance ratio of at least 1.36, and ΔE76 of at least 21.0 under protanopia and at least 22.0 under deuteranopia. The edge styles are all distinct.
   - Fail-first checks prove that the old inks and a doctored edge fail.
   - The snapshot check is the declared snapshots above.

The hand checks above are batched into the v2.4 device checklist at milestone close. The 2.4.0 DRAFT notes carry the four-states and Last Stand lines.
