---
phase: 44-retire-the-classic-engine-from-the-shell
verified: 2026-09-19T16:40:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (re-run by the orchestrator after 44-04); every on-device check is deferred to the end-of-run Pixel 7 batch per the deferred-UAT protocol
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7 (cold boot, no save): launch → title → ENTER → roller → map; no classic roll runs behind the title (the classic cold-boot character roll is retired — engineAdapter.js#boot() is the one live path)", "Pixel 7 (resume): force-stop + relaunch with a live (not dead/won) save → title → ENTER resumes into the map, and the Oracle's newest entries read 'Delve resumed.' then '{name}, {race} {sub}, skill level {roman}, on floor {depth} of the dungeon.' — now emitted from the module boot, text indistinguishable from before", "Pixel 7 (death): dying still buries the character (graves path untouched); the death card's CONFIRM returns to the title (window.mzReturnToTitle, no classic fallback); the graveyard stones show 'lvl I' etc. via window.__mzTables.ROMAN", "Pixel 7 (save & quit / abandon): 'Save & quit' returns to the title and the run resumes; 'Abandon this character' while alive buries the current character and starts fresh; while dead the same button (relabeled 'New Character') rerolls — no dead-end on any of the five former else-newGame() sites", "Pixel 7 (Hero-tab dossier, DEAD-02): for a Thief, a Fighter and a Magic User the race/class/sub-class paragraphs are present and show the content/flavor.js wording (Cloaker's flee-after-first-blow clause, Knight's large-monsters-come-straight-at-you clause), not the older classic prose", "Pixel 7 (Hero-tab skills): the Fighter/Thief skills list shows the post-Phase-38 content/skills.js actives (Sidestep, Pommel Strike, Battle Roar, Second Wind, Sweep; Dirty Trick, Smoke, Silent Step), not Language/Tracking/Climbing/Leaping", "Pixel 7 (HUD): the level readout reads 'Lvl I' etc. (window.__mzTables.ROMAN)", "Pixel 7 (Gear tab): a weapon's worn-slot row shows current content/weapons.js values (Bastard Sword 2d8+1, not the classic 2d6)", "Pixel 7 (movement): tap-to-move and BT-keyboard arrows still step the party (explicit window.move bridge); MAKE CAMP → SLEEP still camps (single window.mzMakeCamp() call)", "Pixel 7 (encounters): a trap / chest / find / faerie reached by walking still resolves through the engine's rail cards; a fight reached through SPELLS / PARLEY / SING / USE / DRINK / READ still resolves through the engine with no dead button"]
gaps: []
---

# Phase 44 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-19)

Goal-backward check of the phase goal: *`mazeworld.html` carries only the live shell — the game plays identically through `engine/` with no second engine defined beside it, and nothing in the repo reads the classic script as a source of rules.*

Zero rule changes by construction: the engine gate's byte fence (`engine/`, `content/`, `test/parity/fixtures/`, `test/parity/prototype-master.js.txt`) was empty at every one of the phase's 14 commits.

## Automated evidence (re-run by the orchestrator after 44-04, HEAD `a022be3`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | `grep -cE "^\s*function (castSpell\|parley\|…\|drinkPotion)\s*\(" mazeworld.html` = 0; orphan sweep listed; shell parses and boots | **0** (16 at phase start); consolidated deleted-symbol list in `44-04-SUMMARY.md` §"All deleted symbols (phase total)"; `npm run build:www` exit 0; `npm run boot:check` **4/4 PASS** (no-uncaught, painted, graves, title) |
| 2 | `wc -l mazeworld.html` ≥ 2,000 below phase start (≤ 6,710 from 8,710) | **6,356** (−2,354) |
| 3 | Dossier byte-equal to `content/flavor.js`; classic `SUB_NOTE` gone; source-pin test against any second copy of a `content/` table | classic `SUB_NOTE`/`RACE_NOTE`/`CLASS_NOTE` declarations: **0**; `test/unit/shell-no-content-copies.test.js` 5/5 (name set derived from `content/index.js`'s 79 exports; 24/6/3 `===` byte-equality; fail-first proven on a scratch copy) |
| 4 | Zero `new Function` extractions in `test/`; each tripwire re-pointed or deleted with reason; `shell-map-invariants` + full suite fail 0 | `grep -rl "new Function" test/` **empty**; per-test reason lines consolidated in `44-04-SUMMARY.md`; `shell-map-invariants.test.js` 38/38; `npm test` **3243/3243, fail 0** |
| 5 | Engine gate diff empty; debug build plays the same game | `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` **empty**; device play batched to the Pixel 7 round (frontmatter list) |

## What changed, by plan

- **44-01** — `tools/shell-boot-check.mjs` (headless Chrome `--dump-dom` boot gate, `npm run boot:check`, fail-first self-test) and `tools/shell-sweep.mjs` (`refs` zero-reference gate, reachability-aware; `orphans` advisory); `parley-button-mirror` folded into `parley.test.js` as a 504-case matrix against the prose oracle, `spell-menu-mirror` deleted; the 16 mirrors + 16 combat-cluster helpers + classic `canCast` + `window.__mzCanCast` deleted (8,710 → 7,670).
- **44-02** — classic movement/encounter engine, `die`/`bury`/`EPITAPHS`, treasure rollers, orphaned content tables and combat-math helpers deleted; the two bare `move(` calls rewritten to `window.move(`; `else makeCamp()` collapsed; `reveal()` deliberately kept until 44-04 (still called by the resume branch) (→ 6,600).
- **44-03** — `window.__mzTables` bridge (`RACE_NOTE`, `CLASS_NOTE`, `SUB_NOTE`, `ROMAN`, `THRESHOLDS`, `WEAPONS`, `FIGHTER_SKILLS`, `THIEF_SKILLS`, `RACES` from `content/index.js`); nine drifted classic copies deleted; `shell-no-content-copies.test.js` added (→ 6,493).
- **44-04** — classic `save`/`load`/`SAVE_KEY`/`newGame`/`classicNewGame`, the five `else newGame()` fallbacks and the callerless `window.newGame` override deleted; `__mzClassicBoot` slimmed to graves + fit + paint; the two "Delve resumed." lines re-homed in the module boot gated on `hadSaveAtLaunch`; dual-write test/harness graves-only; fixed-point sweep found five more zero-reference declarations (`D`, `reveal`, `act`, `newBeat`, `say`) (→ 6,356).

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| DEAD-01 | Complete | criteria 1, 2, 5 |
| DEAD-02 | Complete | criterion 3 |
| DEAD-03 | Complete | criterion 4 |

## Deferred to the milestone-close Pixel 7 batch

The `human_verification` list in the frontmatter (10 items, consolidated from the four SUMMARYs). None blocks `phase.complete` under the deferred-UAT protocol; findings become a quick task or the next milestone.
