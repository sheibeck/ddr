# v1.6 Pixel 7 UAT Batch — consolidated checklist

**Build:** debug APK from the Phase 49 measurement build (commit recorded in `docs/PERF-BASELINE.md`), installed via `adb install -r`, app force-stopped and relaunched.

**Protocol:** deferred-UAT — no device pause was taken in Phases 44–48; this is the one batch, run in the same session as the Phase 49 perf measurement. Mark each ✅ / ❌ (with a note) / ⏭ (skipped, why). v1.6 changed no rules: every item below is "looks and behaves exactly as before" — a ❌ is a regression, not a design question.

**Suggested order:** the perf protocol first (Start-at-depth dev run, ≥ 50 steps — see `docs/PERF-BASELINE.md`), then a fresh Thief run for the Gear/Hero/Store items (47), a Magic User run for the Grimoire item (47), a fight and a camp for the rail/fight-log wording items (46), then resume the pre-v1.6 on-device save last (the tolerant-load items in 45/46).

**Still open from v1.5:** the 140-item batch in `docs/UAT-v1.5.md` was never run on device; it stands separately and can share this session.

## Phase 44 — Retire the Classic Engine from the Shell (10)

1. [ ] Pixel 7 (cold boot, no save): launch → title → ENTER → roller → map; no classic roll runs behind the title (the classic cold-boot character roll is retired — engineAdapter.js#boot() is the one live path)
2. [ ] Pixel 7 (resume): force-stop + relaunch with a live (not dead/won) save → title → ENTER resumes into the map, and the Oracle's newest entries read 'Delve resumed.' then '{name}, {race} {sub}, skill level {roman}, on floor {depth} of the dungeon.' — now emitted from the module boot, text indistinguishable from before
3. [ ] Pixel 7 (death): dying still buries the character (graves path untouched); the death card's CONFIRM returns to the title (window.mzReturnToTitle, no classic fallback); the graveyard stones show 'lvl I' etc. via window.__mzTables.ROMAN
4. [ ] Pixel 7 (save & quit / abandon): 'Save & quit' returns to the title and the run resumes; 'Abandon this character' while alive buries the current character and starts fresh; while dead the same button (relabeled 'New Character') rerolls — no dead-end on any of the five former else-newGame() sites
5. [ ] Pixel 7 (Hero-tab dossier, DEAD-02): for a Thief, a Fighter and a Magic User the race/class/sub-class paragraphs are present and show the content/flavor.js wording (Cloaker's flee-after-first-blow clause, Knight's large-monsters-come-straight-at-you clause), not the older classic prose
6. [ ] Pixel 7 (Hero-tab skills): the Fighter/Thief skills list shows the post-Phase-38 content/skills.js actives (Sidestep, Pommel Strike, Battle Roar, Second Wind, Sweep; Dirty Trick, Smoke, Silent Step), not Language/Tracking/Climbing/Leaping
7. [ ] Pixel 7 (HUD): the level readout reads 'Lvl I' etc. (window.__mzTables.ROMAN)
8. [ ] Pixel 7 (Gear tab): a weapon's worn-slot row shows current content/weapons.js values (Bastard Sword 2d8+1, not the classic 2d6)
9. [ ] Pixel 7 (movement): tap-to-move and BT-keyboard arrows still step the party (explicit window.move bridge); MAKE CAMP → SLEEP still camps (single window.mzMakeCamp() call)
10. [ ] Pixel 7 (encounters): a trap / chest / find / faerie reached by walking still resolves through the engine's rail cards; a fight reached through SPELLS / PARLEY / SING / USE / DRINK / READ still resolves through the engine with no dead button
## Phase 45 — Collapse the Phase 37 Hedges (3)

11. [ ] Pixel 7 (HEDGE-01): a freshly rolled Thief starts with the starting cloak in the Gear tab's WORN row (c.worn.cloak), not in the BAG
12. [ ] Pixel 7 (HEDGE-02): resuming the current on-device save shows the worn-reconciliation rail card ONCE if the migration bagged an extra (plus the matching Oracle line), or NO card if the save was already migrated / nothing was bagged — never a card on every launch
13. [ ] Pixel 7 (HEDGE-01): a Fighter's or Magic User's Gear tab shows empty worn slots (c.worn = {}) and an unchanged bag — no phantom item, no error
## Phase 46 — Honest Names, Dead Exports & the Tutorial Decision (6)

14. [ ] Pixel 7 (NAME-01, pure rename): on a step, a fight round and a camp the RAIL card lines and the fight-log lines read exactly as before this build — no wording, tone, priority or ordering change
15. [ ] Pixel 7 (DEAD-04, tolerant load): a save from the current Play build (which serialized won: false) still resumes and plays on — the dropped key is silently ignored
16. [ ] Pixel 7 (DEAD-04): 'THEY ARE DOWN' still shows after a WON FIGHT — the fight-outcome copy key COMBAT_COPY.over.won is untouched; the graveyard renders every stone's note
17. [ ] Pixel 7 (NAME-02, controlScheme): Settings shows exactly four rows — sound, haptics, text size, confirm-before-quit — each persisting across a relaunch
18. [ ] Pixel 7 (NAME-02, tolerant load): an old persisted settings blob still carrying controlScheme/'dpad' loads without error and surfaces no control for the dropped field
19. [ ] Pixel 7 (DEAD-05): nothing tutorial-related is visible on first run — the 04-era sequencer was never wired; UX-06 rebuilds on the modular shell after v1.6
## Phase 47 — Shell Modularisation (7)

20. [ ] Pixel 7 (SHELL-01): Gear tab ON YOU (wielded weapon, worn armor, jewelry/cloak rows, empty-slot rows in voice) and BAG rows look exactly as before; Use/Equip/Unequip taps dispatch once, no dead buttons
21. [ ] Pixel 7 (SHELL-01): the Drop two-tap confirm and the jewelry/cloak Swap confirm still arm, revert on the timer, and act on Yes
22. [ ] Pixel 7 (SHELL-01): the victory loot card's Stow / Equip now / Leave rows and the store's sell list (both via the shared carried list) render and dispatch identically, incl. the bag-full Drop button
23. [ ] Pixel 7 (SHELL-02): Hero sheet stats, trait line, RATIONS readout, special skills / abilities (READY / N ROUNDS / ONCE A FIGHT · USED in combat), dossier sections all read as before
24. [ ] Pixel 7 (SHELL-02): Grimoire rows sort by level then name; Cast buttons enable/disable with the right hint; Company panel shows the joiner with DISMISS working (two-tap)
25. [ ] Pixel 7 (SHELL-03): Store buy/sell/repair rows (price, sold/disabled state, repair sub-line, usable-by suffixes) and the roll copy header render as before; buying, selling and repairing still dispatch
26. [ ] Pixel 7 (SHELL-01..03): switching Gear ↔ Hero ↔ Store (and into/out of the Store overlay) shows no flash, no missing panel, no stale content

---
**Total: 26 checks.** Record ❌ items as a list (phase, item number, what you saw) and hand them back — fixes go through a UAT gap plan after the milestone closes, never as ad-hoc edits.
