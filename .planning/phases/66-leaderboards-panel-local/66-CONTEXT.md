# Phase 66: Leaderboards Panel — Local - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous v2.0 run). The user accepted every recommendation in all four areas.

<domain>
## Phase Boundary

The DEAD screen becomes the mock's Leaderboards panel. It is fully offline and fed only by the local records Phase 65 built:

- the `ddr.bests.v1` record (top ten per ranked board plus the LINEAGE aggregates);
- the stored graveyard (up to 60 stones);
- the lifetime total (`ddr.graveyard.total.v1`).

The panel opens from the in-game DEAD tab and from the title screen's VIEW THE DEAD, and its back affordances return to wherever it was opened from.

**Not in this phase:** Play Games sign-in, the account chip (Phase 67), any network call or global/friends rows (Phase 68), and the death-panel "you placed X" line (Phase 68). The identity strip and the ALL/FRIENDS toggle ship in a deliberate signed-out state that Phases 67/68 bring to life behind the same seam.

**UX spec:** `design/Mazeworld Boards Panel.dc.html` (the panel) and `design/Mazeworld Leaderboards.dc.html` (entry points and back navigation), imported in commit 0d7a922. The mock stance holds: the iOS frame is preview chrome. Toy fields map to canon: squares → `steps`, WILMST → `gold`, EXP → `sp`, lvl → Roman `level`. The standing rulings win: the rail is the one feedback surface, the shipped tab set stays, and player text says HP, never WP.

</domain>

<decisions>
## Implementation Decisions

### Entry and navigation (BOARD-01)
- **D-01 — Opened from the title:** matches the mock's title frame. The header gets a ◀ back chevron (44×44 target). The bottom bar shows **BACK TO TITLE** plus **ROLL A NEW HERO** when there is no live hero, or a single **BACK TO THE DUNGEON** when a live hero exists. The game tab bar stays hidden while the panel is title-opened.
- **D-02 — Opened from the DEAD tab:** the game tab bar stays visible with DEAD active, and there is no chevron (the mock's in-game frame).
- **D-03 — Android back button:** mirrors the chevron. A title-opened panel returns to the title, or to the dungeon when a live hero exists. A tab-opened panel keeps the existing tab back behaviour (`src/browser/nativeChrome.js`).
- **D-04 — First board shown:** a title entry opens on **GRAVEYARD** (the button says "View the Dead", and it is the mock's default). The DEAD tab opens on the board last viewed (a per-viewer localStorage convenience, wrapped in try/catch), falling back to **DEEPEST**.

### Local-only rendering (BOARD-02, BOARD-04, BOARD-07, BOARD-08)
- **D-05 — Row identity offline:** every local row is yours, so the adventurer is the identity. The avatar initials and colour come from the adventurer's name, through the mock's `AVATAR`/`INITIALS` hash. The headline is the adventurer's name, followed by the `RACE SUB · LVL n` line in Roman numerals. There is no handle and no YOU tag. The handle, YOU and FRIEND styling switch on only when global rows exist (Phase 68), through the same row component.
- **D-06 — Identity strip and ALL/FRIENDS when signed out:** the strip shows a deliberate "nobody" avatar glyph, the label **PLAY GAMES · SIGNED OUT**, and the source line "Your dead only". The ALL and FRIENDS chips are visible but dimmed. Tapping either replaces the rows with an in-panel note in voice, for example "Nobody out there can see you yet.", without touching the rail and with zero network calls. The local list is the default view.
- **D-07 — Standing card offline:** the standing card shows where your **most recent run** landed among your own dead on the active board, for example "4TH · of 37 of yours", plus one quip from a new `content/` bank. LINEAGE reads "of N combinations". GRAVEYARD uses its own mock card: "INTERRED N" and "rolled, delved, and buried. Deepest was X on floor F."
- **D-08 — INTERRED count:** the header shows the lifetime total (`ddr.graveyard.total.v1`), not the number of stored stones.

### Board definitions (BOARD-03, BOARD-05, BOARD-06)
- **D-09 — LEANEST is re-ranked:** by **squares per floor** (`steps / floor`, lower is better, ties go to the deeper floor, then fewer steps). It still displays `floor · sq`, and its rule line is re-voiced to match. This is a deliberate fix to the mock, where LEANEST duplicated DEEPEST's ordering. It is a comparator change in `engine/records.js` (pure). Re-ranking the stored `lean` list when an older record loads is part of the change.
- **D-10 — GRAVEYARD board:** rows, not stone cards (the mock disabled its stones). It lists every stored dead run (up to 60), deepest first, then fewer steps. The rows are not ranked, and they swap in the yard-specific name/line/detail order from the mock.
- **D-11 — Marks, colours, rule lines and footnotes come verbatim from the mock:** ▼ DEEPEST `#d3c49f`, ▪ LEANEST `#e8c97a`, ◆ LINEAGE `#b9a4ef`, ⧗ LONGEST `#8fb08a`, ✕ BUTCHERY `#e07260`, ● PURSE `#e8c97a`, ✝ GRAVEYARD `#c9bda0`. The footnotes are the ranked-board line and the GRAVEYARD line ("Epitaphs are written by the dungeon, not by you. There is no appeal."). LEANEST's rule line is the one re-voice (D-09). Marks and colours extend `content/boards.js` (Phase 65's copy table).
- **D-12 — Empty boards:** each board has one deliberate empty state in voice ("Nobody of yours has qualified for this board yet."), INTERRED shows 0, and the standing card reads "NO ENTRY". No board is hidden.
- **D-13 — Rows and interactions per the mock:** the top ten, rank, avatar, identity, the `RACE SUB · LVL n` line, a min–max value bar, and value + unit (PURSE digit-grouped, LEANEST `floor · sq`). Tapping a row expands it to show the cause, the epitaph and FLOOR / DAYS / SQUARES / KILLS / EXP / WILMST chips, with one row open at a time. The active board chip auto-centres in the horizontally scrolling rail, and prefers-reduced-motion is respected. Offline, your best run is always inside your own top ten. The "NOT IN THE TOP TEN · YOUR BEST RUN" divider is built into the row list now and becomes reachable with global rows in Phase 68.

### Build shape
- **D-14 — Module:** a new `src/browser/boardsPanel.js`, following the Phase 47 modular-shell pattern (like `gearTab.js`, `heroTab.js`), reached through a registered bridge (`src/browser/bridge.js` registry plus the `docs/SHELL-MODULES.md` table). It replaces `#screen-dead`'s markup. The classic `renderGraves`/`renderGravesLoading` renderers and the "Showing last 5 of N" copy are deleted (greenfield, no dual path). `loadGraves` keeps feeding `__mzGravesCount` for the title gate, or that gate moves to the new data seam.
- **D-15 — Data seam:** a pure view-model function (for example `boardsView({ bests, graves, total, board, scope, recentHash, signedIn })`) builds everything the panel renders, with unit tests over it. The renderer never reads storage directly. Phase 68 adds global/friends sources behind the same seam.
- **D-16 — Tests:** unit tests on the view model (every board's ordering, the LEANEST re-rank, GRAVEYARD, the empty states, the standing card, the signed-out strip), plus shell tests on the DOM through the existing `shellSandbox`/`recordingDom` harness (entry from the title and the tab, chevron and bottom-bar routing, tap-expand, rail centring hook). The device look goes into the Phase 69 UAT batch.

### Claude's Discretion
- CSS class names and structure (reuse the `--mw-*` tokens and the dark palette already used by THAT IS THAT), the exact quip bank sizes (at least 6 standing quips is a sensible floor), and the signed-out note's exact wording.
- Whether LINEAGE re-derives its view from the stored aggregates or from the runs table, provided the output matches the mock's grouping (race + cls, best floor, then fewer steps, count of dead).
- How the "most recent run" is identified for D-07: the newest graveyard stone's hash is the natural key.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/records.js` (Phase 65): the board ids, `compareRuns`, `boardValue`, `lineageKey`, `sortGraveyard`, `updateBests` and `sanitizeBests`. D-09's comparator change lands here.
- `content/boards.js` (Phase 65): `BOARD_COPY` (tab/title/rule/unit/unitOne per board) and the quip banks. It extends with marks, colours and footnotes (D-11).
- `src/browser/newBest.js` (Phase 65): the precedent for a pure view-model module plus its unit test.
- `src/browser/engineAdapter.js` (Phase 65-04): the in-memory bests record loaded at boot, the 60-stone graveyard, and the lifetime total. The panel reads through the adapter/bridge, never storage directly.
- The mock's `AVATAR`, `INITIALS` and `ORD` helpers in `design/Mazeworld Boards Panel.dc.html`: port them, don't reinvent.

### Established Patterns
- **Modular shell:** screen modules under `src/browser/` (`gearTab.js`, `heroTab.js`, `storeScreen.js`) reached through `src/browser/bridge.js`'s frozen registry (consumers + purpose) and documented in `docs/SHELL-MODULES.md`.
- **Tab routing:** `mazeworld.html:2148` `showTab(name)`, exposed as `window.__mzShowTab` (2252). The `name === "dead"` branch at about 2246 calls `loadGraves().then(renderGraves)`.
- **Title screen:** `mazeworld.html` around 1505–1509 holds the `#mw-title-dead` button. `hideTitleScreen` (6611), `refreshTitleDead` (6625, which gates the button on `__mzGravesCount`), the button's onclick (about 6967, `hideTitleScreen(); __mzShowTab("dead")`) and `window.mzReturnToTitle` (6933) are the pieces to reuse.
- **The DEAD screen markup** is at `mazeworld.html` about 1994–2003 (`#screen-dead`, `#yard`, `#yard-count`). The classic graveyard code is at about 3200–3310 (`loadGraves`/`saveGraves`/`renderGraves`).
- **Android back:** `src/browser/nativeChrome.js`, where the `App.addListener("backButton")` handler (about 255) consults `getGameContext()`.
- **Tests:** `test/unit/*` shell tests use `shellSandbox.js` plus `recordingDom.js`. Voice copy must pass `test/voice/safety-scan.test.js`.

### Integration Points
- `showTab("dead")` → the panel renders (tab-opened mode).
- The title's `#mw-title-dead` onclick → the panel in title-opened mode (D-01), which hides the tab bar.
- The chevron and bottom bar → `mzReturnToTitle()` / resume the dungeon / `mzStartRoll()` (ROLL A NEW HERO).
- The adapter read seam feeds `boardsView(...)`.

</code_context>

<specifics>
## Specific Ideas

- Port the mock's row, strip, rail, standing card and footnote structure and its inline styles into shell CSS. The fonts are already in the app (Press Start 2P, Courier Prime).
- Scope line offline: "Your own dead. Nobody else's business." (the mock's GRAVEYARD line) works for every board while signed out. The ranked boards could instead say "Your dead only. The world has not been told." (planner's choice, in voice).
- LEANEST's re-voiced rule line, for example: "Squares walked per floor descended. Efficiency, of a sort."

</specifics>

<deferred>
## Deferred Ideas

- Global ALL/FRIENDS rows, the handle/YOU/FRIEND tags on global rows, and the reachable "NOT IN THE TOP TEN" pin → Phase 68.
- The account chip and sign-in → Phase 67.
- Tombstone share → a later milestone (already deferred at milestone scoping).

</deferred>
