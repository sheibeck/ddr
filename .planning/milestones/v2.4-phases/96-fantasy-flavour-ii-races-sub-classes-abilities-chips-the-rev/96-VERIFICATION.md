---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
status: passed
verified: 2026-10-04
verifier: orchestrator (deferred-UAT protocol)
requirements: [FLAVOR-03, FLAVOR-04, FLAVOR-06]
full_suite: "10,567 tests / 10,559 pass / 0 fail / 8 skipped after one declared re-pin (shell-clarity-43 hero paint region end marker, 0d35cce3); the first phase-close run was 10,558 / 1 fail on that marker. PHASE_BASE bc1fc900."
human_verification:
  - "(96) Roller reveal at text size L: flavour first, RULES chip per group, DESCEND reachable, RULES never rolls/commits; Always show the rules On/Off (96-05)."
  - "(96) Hero tab: dossier and trait-line RULES, ability and special-skill lists Off then On; mono footer style on opened dossier bodies (96-05, 96-06)."
  - "(96) Combat ABILITIES and SING at text size L in the 206 px list: flavour + RULES fit, the four state words still read apart, RULES tap never uses the ability (96-06)."
  - "(96) Chip taps on HUD strip, combat condition card, YOUR LOT, Company panel: flavour first, harmful chips read as trouble, RULES opens the exact old text, hold time readable (96-07)."
  - "(96) UP YOUR SLEEVE card on a fresh Fighter and Thief; the Oracle log now shows the flavour line (96-07)."
  - "(96) Final Sheet after a death: tricks, worn and bag sections Off and On; bag notes fit at the largest text size (96-06, 96-12)."
  - "(96) Buy an active skill (Kata, Smoke) and read its Hero row Off then On (96-12)."
  - "(96) Screen walk for any rulebook sentence left: Gear, store, loot/find, drop shelf, Grimoire, combat SPELLS/ITEMS/ABILITIES, Hero, chips, title/roller (96-10)."
  - "(96) Read docs/narrative-pass/review.html: all 236 Phase 95+96 lines with verdicts, the 3 selfChecked rows (Death Touch, Second Wind, Feint), pass-with-note lines and voice watch items (96-11 SUMMARY item 9)."
  - "(96, decision) Confirm or overrule the discretion calls: trait-line race note behind RULES, Final Sheet flavour-only with exact text only when Always on, UP YOUR SLEEVE and its Oracle line, strict no-number-words for blurbs."
  - "(96, decision) Samurai canon SUB_NOTE still contains 'suicidal' (safety wordlist bans the stem); edit the canon text or keep it; Play content-rating answers may need it."
  - "(96, decision) One standard on vague counts: round 2 failed 'a few rounds', round 1 passed 'a few Demons' (Plane Gate)."
---
# Phase 96 Verification

Orchestrator-authored on automated evidence (verifier agents are off by user ruling); hand checks are batched into the v2.4 milestone device checklist.

1. **Race and sub-class blurbs read as flavour and keep their good and bad (FLAVOR-03): passed.**
   - `RACE_FLAVOR` (6, Human neutral), `SUB_FLAVOR` (24) and `CLASS_FLAVOR` (3 live classes) are `{ line, good, bad }` records; `identity-flavor.test.js` fails any race or sub-class blurb without at least one real good and one real bad id from `identityEntries`.
   - The roller reveal and the Hero dossier/trait line show flavour first with `RACE_NOTE`/`SUB_NOTE`/`CLASS_NOTE` and the footer byte-identical behind RULES (96-05).
2. **Ability descriptions and chip explanations read as flavour (FLAVOR-04): passed.**
   - `ABILITY_FLAVOR` (21, Sing included), `SKILL_FLAVOR` (21: 10 passive + 11 active, the actives added by gap plan 96-12), `CHIP_FLAVOR` (47 incl. 5 variants) with `flavorOfChip`; the shell coverage test fails a chip explanation with no flavour key.
   - Combat ABILITIES/SING, Hero ability and skill lists, Final Sheet (tricks, worn, bag), every chip-tap path and UP YOUR SLEEVE lead with flavour; exact `txt` / `CONDITION_EXPLAIN` text sits behind RULES. Phase 94 state labels unchanged.
3. **Every new line passes the safety scan and the narrative review (FLAVOR-06): passed.**
   - Round 1 (96-08, fresh reviewer): 211 pass / 14 revise; 96-09 (a different agent) rewrote the 14; round 2 (96-11, a third agent) passed all 14 and 8 of the 11 late lines, self-fixed 3 (recorded `selfChecked`, listed for the user). `flavor-review --closed`: all 236 lines pass at current wording; review.html lists each line with its verdict.
   - `voice-inventory --roll-under --hygiene --safety --count` = 0; `--check-ledgers --after` 0 errors.
4. **No rulebook sentence left, no rule moved, guards green: passed.**
   - `flavor-sweep.test.js` paints 20 surfaces through the real shell (S1 number-free flavour, S2 no rules sentence outside RULES, S3 RULES body equals unchanged rules text, S4 toggle/Always contract), with teeth and a TEXT-LAYERS coverage test; its two findings were closed by 96-12 (todo 0).
   - Engine, parity, determinism, the 22 guard/pin files and the five audit docs are byte-identical to PHASE_BASE; only the four declared fixtures moved (thief.hero, mu.hero, fighter.abilities-states, fighter.hero-in-combat). Three new drift proofs (CONDITION_EXPLAIN giant, Kata, Troll) show a drifted rules number still fails the real guards.

**Known debt (non-blocking):** `voice-inventory --check-ledgers --after --coverage` reports 329 errors (328 pre-existing at PHASE_BASE from Phases 80–92 copy keys; +1 for the raw lookup key `"haste/Speed of Sound"` in `flavorOfChip`).
