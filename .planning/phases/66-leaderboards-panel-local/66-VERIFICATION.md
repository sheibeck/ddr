---
phase: 66-leaderboards-panel-local
status: passed
verified: 2026-09-23
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 8/8 requirements
human_verification:
  - "66-02: voice read-through of the panel copy on device (rule lines, footnotes, standing lines)"
  - "66-03: the active chip glides to the centre of the rail on a board switch; jumps instantly with OS reduce-motion on"
  - "66-03: tapping a row deep in a long GRAVEYARD list expands it in place without the list jumping to the top"
  - "66-04: after a few real deaths each board's order reads right; LEANEST visibly rewards short efficient runs over merely deep ones"
  - "66-04: the standing card's place and 'of N' read sensibly right after a fresh death"
  - "66-05: the panel matches the mock at text size M"
  - "66-05: at the largest text size the header, strip and rail don't crowd out the list"
  - "66-05: rail chips and row tap targets are comfortable on a real device"
  - "66-06: the DEAD tab shows the panel with the tab bar visible and DEAD lit, no chevron"
  - "66-06: after a death the DEAD tab lists the new run at once and INTERRED rises by one"
  - "66-06: the DEAD tab reopens on the last board viewed"
  - "66-06: every board renders, empty or not, in airplane mode"
  - "66-06: the title's View the Dead appears after the first-ever death without a restart"
  - "66-07: with no live hero, View the Dead opens on GRAVEYARD with the chevron, BACK TO TITLE and ROLL A NEW HERO, no tab bar"
  - "66-07: BACK TO TITLE returns to the title and ENTER still rolls a new hero"
  - "66-07: ROLL A NEW HERO opens the roller and lands on the map after commit"
  - "66-07: after Save & quit, View the Dead shows a single BACK TO THE DUNGEON that resumes the same run"
  - "66-07: Android back on the title-opened panel mirrors the chevron; on the DEAD tab it behaves as before"
---

# Phase 66: Leaderboards Panel (Local) — Verification

**Verdict:** passed on automated evidence. The device checks above are deferred to the milestone's batched Pixel 7 checklist (Phase 69, `docs/UAT-v2.0.md`) per the deferred-UAT protocol.

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| BOARD-01 | Panel replaces the DEAD screen; DEAD-tab entry (66-06) and title-mode entry with chevron / BACK TO TITLE / ROLL A NEW HERO / BACK TO THE DUNGEON and Android back mirroring the chevron (66-07); `shell-boards-panel.test.js`, `shell-boards-entry.test.js` (12) | ✓ (device look deferred) |
| BOARD-02 | Header (LEADERBOARDS, scope line, INTERRED), identity strip and ALL/FRIENDS toggle in a deliberate signed-out state (66-02, 66-03, 66-05); `boardsPanel-dom.test.js`, `boards-copy.test.js` | ✓ |
| BOARD-03 | Seven-board rail with the active chip centred, per-board mark/title/rule line; LEANEST re-ranked by squares per floor (66-01, 66-03, 66-04); `boardsView.test.js`, `boardsPanel.test.js`, `records.test.js` | ✓ |
| BOARD-04 | Top-ten rows from canon fields (rank, avatar, handle, YOU tag, name, `RACE SUB · LVL n`, value bar, value + unit) (66-03, 66-04, 66-05) | ✓ |
| BOARD-05 | "NOT IN THE TOP TEN · YOUR BEST RUN" divider for a best run outside the top ten (66-03, 66-04) | ✓ |
| BOARD-06 | Row tap expands in place: cause, epitaph, FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST chips (66-03, 66-05); `hp-not-wp.test.js` scan | ✓ |
| BOARD-07 | Standing card ("your place · of N") and per-board footnotes in voice, GRAVEYARD's verbatim (66-02, 66-04); voice safety scan | ✓ |
| BOARD-08 | Local-only data with zero network calls; `getGraveyard()` and `ddr.bests.v1` as the only sources; the classic graveyard loader, sentinel and persistence harness retired (66-01, 66-02, 66-07); `graveyard-adapter.test.js`, `dual-write-convergence.test.js` | ✓ |

## Automated gates

- Full `npm test` on master after the final merge (636353b): **4466/4467 pass**. The one failure is `test/unit/sfx-assets.test.js` AUD-06 set equality. It is caused by the user's untracked `sfx/theme.mp3` (the 31st file in `sfx/`), not by Phase 66 code. A clean checkout of 636353b has 30 clips and passes. The theme-music todo updates the expected set when it commits the file.
- Worktree-only: 7 CRLF doc-ledger failures (known `core.autocrlf` artifact), passing on master.
- Engine gate: `engine/` untouched except 66-01's LEANEST comparator in `engine/records.js` (records only, no GameState or parity fixture impact); `test/parity/prototype-master.js.txt` untouched; no fixture regenerated.
- `node tools/bridge-doc.mjs --check` passes; `docs/SHELL-MODULES.md` regenerated.

## Notes

- 66-07 fixed a stale Phase 44 comment above `#btn-save-quit` that its own deletion would have made false (Rule 1).
- Global ALL/FRIENDS rows, the live identity strip and ranks arrive in Phases 67–68 through the `boardsView` seam.
