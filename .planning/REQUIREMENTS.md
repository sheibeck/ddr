# Requirements: Delve, Die, Repeat — v1.6 Shell Debt & Dead Code

**Defined:** 2026-09-19
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown.
**Milestone goal:** Delete the code the game no longer runs, give the surviving modules honest names, collapse the remaining dual-path hedges, purge every doc and comment that describes a pattern we no longer employ, and split the 8.6k-line shell into named `src/browser/` modules — with zero gameplay change and the engine/parity suite green throughout.

**Engine gate (applies to every requirement):** no rule changes — the engine's observable behaviour (events, state, rng draw order) is identical before and after every phase; `test/parity/prototype-master.js.txt` is never edited; the only fixtures that may move are the ones the CLEAN-HEDGE collapse is declared to move (regenerated with a rationale record, never gated); `npm test` fail 0 and `npm run build:www` green at every commit; the debug APK that closes the milestone is byte-for-byte the same game as the one before it, minus dead weight.

**Sequencing gate:** every phase that edits `mazeworld.html` or `engine/` starts only after the five 2026-09-18/19 quick tasks (260918-vm3, -vvt, -w4n, -wy1, 260919-00d) have landed on master — a purge mid-quick-task would collide.

## v1.6 Requirements

### Dead code (DEAD)

- [x] **DEAD-01**: `mazeworld.html` no longer defines any of the 16 pre-extraction classic-engine mirrors (`castSpell`, `parley`, `startCombat`, `meetJoiner`, `genFloor`, `rollCharacter`, `descend`, `makeCamp`, `takeItem`, `useItem`, `playerStrike`, `foeTurn`, `killFoe`, `openStore`, `readScroll`, `drinkPotion`) nor any helper, table or constant that only they referenced; the game plays identically through `engine/`
- [x] **DEAD-02**: The Hero-tab dossier text is read from `content/flavor.js` (single source) — the classic `SUB_NOTE` table and its 13 drifted rows are gone, and a source-pin test proves the shell has no second copy of any `content/` table
- [x] **DEAD-03**: Every test that `new Function`-extracts a classic helper from the shell as a drift tripwire (`parley-button-mirror`, the classic `eff(key)`, `canParley`/`fluency`, the classic CLOAKS/Cloak of Armor txt mirror, …) is re-pointed at the `engine/`/`content/` implementation it was guarding, or deleted with its reason recorded; `shell-map-invariants` stays green
- [ ] **DEAD-04**: `winGame()` / `state.won` and their parity carve-out are removed (RUN-04 made them unreachable); the harness no longer strips a `won` field
- [ ] **DEAD-05**: `src/browser/tutorial.js` is either deleted (with a note that UX-06 rebuilds on the modular shell) or parked with a header stating why it is unreferenced — decided in the phase, not left ambiguous

### Names & exports (NAME)

- [ ] **NAME-01**: `src/browser/toasts.js` is renamed to `narrationLines.js` and its exports to what they are (`TOAST_FOR` → `LINE_FOR`, `toastsForAction` → `linesForAction`, `dispatchWithToasts` → `dispatchWithNarration`); every import site, bridge and test pin follows; the dead lifetime exports (`MAX_TOASTS`, `TOAST_*_MS`, `toastLifetime()`) are deleted
- [ ] **NAME-02**: No surviving identifier in `src/`, `engine/` or the shell is named after a retired mechanism (toasts as UI, D-pad, `flightLeft`/`flightCooldown`, `c.ether`, `wornSlots`) — each rename is its own commit with the grep that proves zero stragglers

### Dual-path hedges (HEDGE)

- [ ] **HEDGE-01**: `newRun` always creates `c.worn` (the Thief's starting cloak worn) — the shell-only `{ wornSlots }` run option and every branch keyed on it are gone from `engine/`, the shell, the tuning bot and the tests
- [ ] **HEDGE-02**: The worn-model save migration in `engine/saveState.js` runs unconditionally on load (no option gate); a v1.4-era save still loads with its items reconciled
- [x] **HEDGE-03**: The fixtures the collapse moves (the chargen/economy seeds `docs/GEAR-SLOTS.md` lists) are declared with a before/after divergence record and regenerated; every other fixture is byte-identical and `test/parity/FIXTURE-INVENTORY.md` is regenerated

### Stale docs & comments (DOCS)

- [ ] **DOCS-01**: No comment in `mazeworld.html`, `src/`, `engine/`, `content/` or `test/` describes a pattern the game no longer employs — D-pad movement, toasts as a UI surface, the "dead classic X()" mirrors, `wornSlots`, the retired per-step item counters, the pre-Phase-35 recentre-on-every-step camera — verified by a grep list recorded in the phase summary
- [ ] **DOCS-02**: `docs/*.md` and `.claude/CLAUDE.md` describe the game as it is: the stack notes' D-pad / toast references are rewritten to tap-to-move + rail, the iOS/Xcode rows are deleted outright (not just marked out of scope), and any doc that only documented dead code is deleted
- [ ] **DOCS-03**: Test names and describe-strings no longer reference retired mechanisms (a test called "toast …" that pins a rail line is renamed to say so)

### Shell modularisation (SHELL)

- [ ] **SHELL-01**: The Gear tab (ON YOU / BAG panels, equip/use/drop/swap confirms) renders from a `src/browser/gearTab.js` module with its own source-pin test, and `mazeworld.html` only mounts it
- [ ] **SHELL-02**: The Hero tab (sheet, dossier, Company panel, Grimoire) renders from a `src/browser/heroTab.js` module with its own source-pin test
- [ ] **SHELL-03**: The Store screen renders from a `src/browser/storeScreen.js` module with its own source-pin test
- [ ] **SHELL-04**: `mazeworld.html` is under 5,000 lines with no classic-script duplicate of any `src/browser/` or `content/` table, and the module bridge (`window.__mz*`) surface is listed in one place with each entry's owner

### Performance (PERF)

- [ ] **PERF-01**: `paint()` re-render and `draw()` per step are measured on the Pixel 7 (Chrome remote profiling or in-app `performance.now()` marks) with the numbers recorded in `docs/PERF-BASELINE.md`
- [ ] **PERF-02**: Only a measured hotspot (≥ 16 ms per step, or a visible jank the user confirms on device) gets a code change; if nothing qualifies the phase closes with the baseline and no code

## Future Requirements

Deferred — tracked, not in this roadmap.

- **UX-06** first-run tutorial (rebuilt on the modular shell — the reason SHELL-01..03 exist)
- **STR-01..04/06** Google Play production launch
- **TUNE-06/07** human DR round + tier-3/5 roster decision
- Store restyle to the dark vocabulary; dice-mode setting; haptics polish; climb dice payload

## Out of Scope

| Feature | Reason |
|---------|--------|
| Any gameplay or balance change | Cleanup milestone — the engine gate says behaviour is identical; balance lives in the deferred tuning pass |
| Refactoring `engine/` module boundaries | The engine is already the clean, tested seam; the debt is in the shell |
| A build step / bundler / TypeScript migration | The vanilla-JS, no-build dev loop is a deliberate constraint (CLAUDE.md); modularisation stays ESM-in-browser |
| Perf work without a measurement | PERF-02 — the game is turn-based and nothing is known to be slow |
| The v1.5 Pixel 7 UAT batch | Runs on its own track against a post-quick-task debug APK; not a v1.6 phase |

## Traceability

Filled at roadmap creation (2026-09-19). Phase order: 44 dead code → 45 hedges → 46 names/dead exports → 47 modularisation → 48 docs purge → 49 perf. The hedge collapse precedes the names phase because NAME-02 lists `wornSlots`, which only HEDGE-01 removes; the docs purge runs after modularisation so the grep list covers the final layout.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEAD-01 | Phase 44 | Complete |
| DEAD-02 | Phase 44 | Complete |
| DEAD-03 | Phase 44 | Complete |
| DEAD-04 | Phase 46 | Pending |
| DEAD-05 | Phase 46 | Pending |
| NAME-01 | Phase 46 | Pending |
| NAME-02 | Phase 46 | Pending |
| HEDGE-01 | Phase 45 | Pending |
| HEDGE-02 | Phase 45 | Pending |
| HEDGE-03 | Phase 45 | Complete |
| DOCS-01 | Phase 48 | Pending |
| DOCS-02 | Phase 48 | Pending |
| DOCS-03 | Phase 48 | Pending |
| SHELL-01 | Phase 47 | Pending |
| SHELL-02 | Phase 47 | Pending |
| SHELL-03 | Phase 47 | Pending |
| SHELL-04 | Phase 47 | Pending |
| PERF-01 | Phase 49 | Pending |
| PERF-02 | Phase 49 | Pending |

**Coverage:**

- v1.6 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-19*
*Last updated: 2026-09-19 — traceability filled at roadmap creation (Phases 44–49)*
