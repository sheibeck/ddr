# Phase 84: Leaderboards Panel v3 - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

The DEAD tab and the title's VIEW THE DEAD open one Leaderboards panel built to the v3 mock (`design/Mazeworld Boards Panel v3.dc.html`, wrapper `design/Mazeworld Leaderboards v3.dc.html`): LEADERBOARD (everyone's dead, top ten, read from our Firebase board through Phase 83's `boardClient`) or YOUR DEAD (just your runs, from a new local per-run history), switched by the YOURS › / EVERYONE › box, ranked by DEPTH / DAYS / KILLS / WILMST with RACE and SUB-CLASS filters. It replaces the old panel entirely (board rail, LEANEST/LINEAGE/GRAVEYARD boards, the Play Games global seam). Requirements BOARD-18..BOARD-27.

Not this phase: removing Play Games modules, wiring the submission queue at death, the ☰ account rows, "you placed X", and the boot-time backfill call (all Phase 85). This phase may leave the old Play Games modules in place but must not depend on them (boardsView's `scoreFallback` import from boardScores.js goes).

</domain>

<decisions>
## Implementation Decisions

### Views, navigation and states (area 1)
- **Dead-hero dock stays.** The mock drops Phase 78's FINAL SHEET / BURY THEM dock; keep it under the list when the DEAD tab is opened with a dead hero (needed to finish that run). `routeFromBoards` (finalSheet/bury/title/dungeon/roll) keeps working.
- **LEADERBOARD states are in-voice notes inside the list** (the mock has none; BOARD-25): loading → a "counting the dead" note; offline or unreachable with a cached copy → show the cached top ten plus a small stale line saying how old it is; unreachable with no cache → an in-voice note and a **SEE YOUR DEAD** button that switches views. YOUR DEAD never waits on the network.
- **Season line:** "SEASON OF THE ALPHA" is a small line under the LEADERBOARD title, board view only (BOARD-27). The name comes from a new season-name table in `content/season.js` next to `SEASON` (`{1: "Season of the Alpha"}`); the integer stays the key everywhere else.
- **Remembered between opens: the RANK BY stat only** (the user first picked "Everything", then chose "Stat only" once the question was explained). Race and sub-class filters reset on every open; the starting view follows Compete (ON → LEADERBOARD, OFF → YOUR DEAD). Reuse the existing panel-preference key `ddr.boards.last.v1` for the stat (tolerant load: an old value naming a retired board falls back to DEPTH).

### Board data and counts (area 2)
- **No per-option counts on LEADERBOARD.** The RACE and SUB-CLASS sheets on the board list plain options (no count, nothing dimmed). Counts, and dimmed zero-count options (still tappable, as the mock does), appear on **YOUR DEAD only**, computed locally. BOARD-20 is amended accordingly. No count queries beyond `total()` for the EVERYONE › box.
- **"Your best" on LEADERBOARD = your best run actually on the board** under the current stat and filters, with its real rank from the server (`rankOf`). Find it from your own runs on the board (`ownRunsQuery(uid)`, cached like the other reads) filtered locally by race/sub; then `rankOf(stat, key, race, sub)`. It drives the NOT IN THE TOP TEN · YOUR BEST row and the standing card ("{handle}'s best, of N interred as …" / "None of yours on this board yet.").
- **YOURS › count = your runs in the local history** (instant, offline). **EVERYONE › count** = the board's current-season total, unfiltered (one `total()` read, cached).
- **Store the killer's name on board runs.** Add the RunSummary's `note` (the foe name) to the run document so board rows read "killed by a Werebeast" instead of a generic cause. This touches Phase 83's contract: `src/browser/runDoc.js` (field list, validate, build), `firebase/firestore.rules` **and** `firebase/firestore.transition.rules` (kept byte-identical by test), the fake server, the rules/runDoc tests, the runbook field table, and a live **transition-rules** redeploy (`--config firebase.transition.json --project delve-die-repeat-6ba5f`). Bound the string like `cause`/`epitaph` (length cap, family-friendly content comes from the bestiary, not free text).

### YOUR DEAD history on the phone (area 3)
- **New local per-run history, cap 500 runs** (newest kept). An adapter-owned key (e.g. `ddr.runs.v1`), lean per-run records written at death alongside `persistGrave`'s write batch (the RunSummary fields the panel needs, plus the app `version` string read from `#mw-app-version` and `when`). Dev runs never enter it (same `state.dev` skip).
- **Import once from the old stores with the 2.1.0 cutoff** (BOARD-26, user rulings 2026-09-28): on first launch, import graveyard stones and `ddr.bests.v1` runs with `when >= BACKFILL_SINCE_MS` (import the constant from `src/browser/runBackfill.js`), deduplicated by hash, and mark the import done. Nothing older is shown; the INTERRED count is the history's length (the old lifetime total is not used). The old keys stay on the device untouched (RETIRE-03).
- **Imported runs carry version "2.1.0 (11)"** (the cutoff guarantees they were played on 2.1.0, same label as the board upload).
- **VIEW THE DEAD on the title shows when you have at least one run in the history OR Compete is ON** (the board has other players' runs even on a fresh install). `refreshTitleDead` moves off `getGraveyard().total`.
- **NEW PERSONAL BEST compares against the new history** (runs from 2.1.0 on), so bests restart with the new boards. Do this in the shell/browser layer; the engine stays untouched (`engine/records.js` bests logic is not edited — if its board lists become dead code, leave removal to a later cleanup rather than touch the engine gate).

### Look and house rules (area 4)
- **The ▼ picker caret and the ◆ selected-option mark are CSS shapes**, not text glyphs and not new PNGs. The ◀ back button keeps shipping as it does today.
- **YOUR DEAD ranks DAYS with the same anti-farming cap as the board** (`daysKey = min(day, 10*floor)`, ties by floor — Phase 82's rule, `runDoc.daysKeyOf`), so a run holds the same place in both views; the row and chips still show the true day count. Use one shared rank-key function for both views (DEPTH: floor desc, fewer squares; KILLS: kills desc, deeper floor; WILMST: gold desc).
- **Avatar initials: one per handle word** — @lanternjaw → "LJ" (split against `HANDLE_FIRST`/`HANDLE_SECOND` in `content/handles.js`; fall back to the first two letters if a handle doesn't split). YOUR DEAD rows (hero names) keep the existing initials rule. Avatar colours: the mock's six-colour hash, already ported in `boardsView.js`.
- **Expanded row date line: "Died 28 Sep 2026 · 2.1.0 (11)"** (BOARD-22). Local rows use `when`; board rows use the run's death time — add `when` (the death time in ms, plausibility-bounded ≤ request time) to the run doc alongside `note` in the same contract change, falling back to `createdAt` for runs submitted before the field exists.

### Mock-to-canon mapping (carried from the milestone)
- The mock is the UX/visual spec only. Its toy races/classes/sub-classes (Gnollish, Halfling, Berserker, Warrior, Ranger…) map to canon: 6 races (Human, Elven, Dwarven, Wilmsry, Fridgian, Troll), 3 classes × 8 sub-classes = 24. Squares → `steps`, WILMST → `gold` (board stat id stays `purse`), EXP → `sp`, Roman level. The SUB-CLASS sheet has 25 rows and scrolls.
- House rules win: PNG icons for existing icon slots, the rail as the one feedback surface, tap-to-move and arrow pad, HP never WP. No toasts from the panel.

### Claude's Discretion
- Exact in-voice copy for the loading / stale / unreachable notes, the season line styling, the YOUR DEAD empty-state line (mock: "You haven't lost a hero as {lineName}."), within the house voice and the voice-corpus/safety tests.
- Where the pure history module lives (a new `src/browser/runHistory.js`-style module with its sanitiser is the expected shape) and how `boardsView`/`boardsPanel` are split (rewrite vs. replace files), as long as the view stays a pure, DOM-free function and the panel follows the existing `createBoardsPanel` seams the shell uses (`openFromTab`, `openFromTitle`, `onDeadTab`, `back`, `refresh`).
- Which old panel tests are deleted vs. rewritten (about 270 pin the old panel).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/boardClient.js` — `createBoardClient({fetchFn, config, competeOn, …})` → `topTen(stat, race?, sub?)`, `total(…)`, `rankOf(stat, key, race?, sub?)`, `clear()`; 5-minute cache, stale fallback, shared in-flight reads; stat ids `deep/days/kills/purse`; reasons `off|offline|server|refused|invalid|unavailable`.
- `src/browser/runDoc.js` — rank-key formulas (`deepKey`, `daysKeyOf`, `killsKey`, `goldKey`), `ownRunsQuery(uid)`, the doc field list and JS mirror of the rules.
- `src/browser/fakeBoardServer.js` — the in-memory board for tests and the browser dev loop.
- `src/browser/firebaseAuth.js` — `snapshot()` → `{handle, uid}` (YOU detection: `row.uid === uid`).
- `src/browser/runBackfill.js` — `BACKFILL_SINCE_MS`, `BACKFILL_VERSION`.
- `src/browser/boardsView.js` — avatar colour hash, INITIALS, ORD already ported from the mock.
- `content/boards.js` — `BOARDS_PANEL_COPY` (six stat labels), standing/new-best/first-death banks; old global loading/unreachable lines can seed the new states.

### Established Patterns
- Pure DOM-free view model (`boardsView(input)`) + a thin DOM renderer/controller (`createBoardsPanel`) + shell wiring in `mazeworld.html`; tests split into pure view tests, DOM tests and shell-string tests.
- Adapter-owned cross-run storage in `engineAdapter.js` through `storage.js` (Preferences with a localStorage mirror), batched writes in `persistGrave`, never in GameState.
- Content banks in `content/*` audited by `test/unit/voice-corpus.test.js` and `test/voice/safety-scan.test.js`.

### Integration Points
- `mazeworld.html`: imports ~6981-6983; `readBoardsData` ~7330; `createBoardsPanel` wiring ~7355-7380 (`global: globalBoards.view` goes); `#screen-dead` ~2786; DEAD tab ~2826; `refreshTitleDead` ~9430; VIEW THE DEAD click ~9820; `routeFromBoards` ~9757; Android back → `boardsPanel.back()` ~9945. The shared identity currently has `competeOn: () => false` (~7816) until Phase 85 — Phase 84 wires a board client that reads the real Compete setting (`settings.js` `compete`), so LEADERBOARD works in the dev loop against the fake server and on device against the live board.
- `engineAdapter.js`: `recordDeath` ~463, `persistGrave` ~511, dev skip ~735 — the history write joins these.
- `settings.js` `EXISTING_INSTALL_KEYS` / `patchNotes.js` `NOTES_PRIOR_DATA_KEYS` read the old keys for install detection — leave them.

</code_context>

<specifics>
## Specific Ideas

- The mock's exact copy: "Everyone's dead. Top ten shown." / "Only your heroes. Nobody else's business." / "Compete is off. Only your heroes." / "NOT IN THE TOP TEN · YOUR BEST" / "{handle}'s best, of {N} interred as {race}, {sub-class}." / "None of yours on this board yet." / "NOBODY YET" / "Nobody has died as {lineName}." / "CLEAR FILTERS" (clears race and sub, not the stat). RANK BY sub-lines: DEPTH "Lowest floor reached. Ties go to fewer squares walked.", DAYS "Days survived underground.", KILLS "Things killed before being killed.", WILMST "Carried at the moment of death. All of it still down there."
- Stat colours from the mock: DEPTH #d3c49f, DAYS #8fb08a, KILLS #e07260, WILMST #e8c97a; the top row wears the stat colour; your own row a gold left bar; YOU tag gold, board view only.
- Six expanded chips: FLOOR, DAYS, SQUARES, KILLS, EXP, WILMST.
- Footer routing from the title: no hero → BACK TO TITLE + ROLL A NEW HERO; with a hero → BACK TO THE DUNGEON; in game no footer.

</specifics>

<deferred>
## Deferred Ideas

- Per-option counts on the LEADERBOARD sheets (dropped by the user; could return if the board grows and the quota allows).
- Removing now-unused board lists from `engine/records.js` (engine gate this milestone).

</deferred>
