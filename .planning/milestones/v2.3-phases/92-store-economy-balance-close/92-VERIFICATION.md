---
phase: 92-store-economy-balance-close
status: passed
verified: 2026-10-01
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 3/3 (ECON-11 readout recorded; ECON-12 PASS at depth 7, 98% -> 42.0%; TUNE-10 pass run once and drift ruled by the user: accept and record)
full_suite: 10,086 tests / 10,084 pass / 0 fail / 2 skipped (phase close, 2026-10-01)
human_verification:
  - "(92) Play to depth 7 and open a store: you can afford part of the shelf (about a third to a half, selling the bag), not all of it; floor-1 prices look as before."
  - "(92) Sell buttons on floors 1-4 show the same prices as before (half of base); on floor 7 or deeper about an eighth (a Cloak of Armor sells for 313, not 1,250)."
  - "(92) On floors 8 and up, say whether the sell prices and what you can afford feel right (the floors 8-12 overshoot is accepted and recorded, to revisit after this playthrough)."
  - "(92) Over two or three debug-APK runs, note where they end: the fair bot dies around floor 5, which is about floor 7-9 for a human; flag a run that ends far earlier or later, with class and race (the accepted D1/D2 drift)."
  - "(92) Note whether you ever run short of rations with the store's d10 supply (the bot starves in 10.6% of deaths, mostly Troll and Thief)."
  - "(92) If you play an Illusionist: does Door Illusion feel like a free escape (about 9 in 10 casts end the fight for the bot), and does the class feel strong or weak next to the other Magic Users?"
  - "(92) Skim docs/DIFFICULTY-RETUNE.md (### Phase 92 — ruling, final reading, and the 92-01 bot-plays-the-rules table) and docs/ECONOMY-READOUT.md (Reading, Ruling, Accepted overshoot): they read as you ruled."
---

# Phase 92 Verification

- **ECON-11:** `tools/tune-economy.mjs` readout, floors 1-12, gold income by source, recorded in docs/ECONOMY-READOUT.md (92-02).
- **ECON-12:** lever S, depth-shaped `DIALS.SELL_FRACTION` (0.5 on floors 1-4, falling to 0.125 from floor 7). Fresh 1,000-seed readout: the depth-7 with-bag median share is 42.0% (band 33-50%), PASS. No fixture moved (92-03).
- **TUNE-10:** one fair-bot pass on the finished rules (92-04): p50 death 5 against [3,4], starvation 10.6%, tail all PASS, watch list clean. The user ruled D1/D2 accept and record (92-05). The docs and audits are closed.
- **Gates:** `prototype-master.js.txt` untouched, no `save` run, the full suite is green.
