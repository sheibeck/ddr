# Phase 70: Device-Round Polish - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning
**Mode:** Rulings captured directly from the user's first Pixel 7 session on the 2.0.0 debug build (no separate discuss pass: every grey area below was answered in conversation). The user asked for these to run through `/gsd-autonomous` as an official part of v2.0.

<domain>
## Phase Boundary

Four device-round fixes on the finished v2.0 build: the title theme, the ☰ button as the account surface, the ☰ available everywhere with the quit actions, and a real LINEAGE board. Presentation and records only.

**Not in this phase:** new gameplay, engine rules, network behaviour, or the milestone close (the user stopped the lifecycle after the audit; it resumes after this phase).

</domain>

<decisions>
## Implementation Decisions

### Title theme (POLISH-01) — being delivered by quick task 260924-51h
- **D-01 — Delivered by the in-flight quick task:** `.planning/quick/260924-51h-loop-theme-mp3-on-the-title-screen-v2-0/` (plan + executor already running when this phase was created). The planner MUST NOT re-implement it; Phase 70 plans only fold its SUMMARY into verification and resolve any merge interaction with the other plans. If 51h has not merged when execution starts, the first wave waits on it.
- **D-02 — Behaviour (user rulings):** starts as soon as the title screen shows at launch — Capacitor sets `setMediaPlaybackRequiresUserGesture(false)` (Bridge.java:592) so no tap is needed on device; falls back silently to the first tap if playback is refused (and in the browser dev loop). It continues unbroken from the title into the character roller and over title-opened panels/sheets; fades out (~500 ms, instant under reduced motion) on reaching the map; restarts from the top when the title or roller shows again; respects Sound; stops in the background. Streamed through an HTMLAudioElement routed into the existing Web Audio gain path (not a full PCM decode). `sfx/theme.mp3` committed byte-for-byte; AUD-06 pins 30 clips + 1 music track.

### The ☰ as the account surface (POLISH-02)
- **D-03 — Supersedes 67 D-05:** the separate band-2 account chip is removed (greenfield, no dual path); band-2 counters get their gap back. The ☰ button face is the initials avatar (gold ring, same look as the chip avatar) when signed in, the plain ☰ icon when signed out, signing in or Compete OFF. aria-label names the player when signed in.
- **D-04 — ACCOUNT block at the top of the ☰ dropdown:** identity line, Sign in (`silent: false`) / Stop competing / disabled pending, helper line, Compete ON/OFF — reusing ACCOUNT_COPY and the existing controller. The title screen keeps its corner chip opening the account sheet (no ☰ on the title); the "?" nobody face remains only there and on the signed-out Leaderboards strip.
- **D-05 — Draft plan available:** `.planning/quick/260924-56z-merge-the-account-chip-into-the-hamburge/260924-56z-PLAN.md` (validated, not executed) implements D-03/D-04/D-06/D-07 in detail, including its DISC-1..DISC-5 decisions — reuse it as the basis of this phase's plan(s); DISC-3 is resolved by D-08 below.

### ☰ everywhere + quit actions (POLISH-03)
- **D-06 — Save & quit and Abandon move into the ☰:** delete the HERO tab's Delve panel and both buttons. Dropdown order: ACCOUNT block, existing ☰ rows, SAVE & QUIT, then ABANDON THIS CHARACTER last in the danger style. Save & quit has no confirm (its old dialog is removed). Abandon is two-tap armed in the row ("TAP AGAIN TO BURY THEM", reverts after ~3 s or on menu close; the Confirm-before-quit setting governs the arm per 56z DISC-1), no modal; when the hero is dead the row is NEW CHARACTER (mzStartRoll).
- **D-07 — The menu closes before any row's action runs.**
- **D-08 — ☰ opens on every screen (user ruling):** map, combat and every other encounter, the Oracle, all tabs, and while dead. Today `hasActiveEncounter()` (which includes `S.dead`) blocks it — lift that gate for opening the menu. Rows whose action is not valid in the current context are shown **disabled** (dimmed, not hidden, with no action): e.g. MAKE CAMP and anything the engine would refuse mid-encounter. Save & quit and Abandon stay available everywhere (resume must restore exactly where the player was, including mid-encounter — verify with the existing persist/boot path and a test); Settings and the ACCOUNT block are always available. The ☰ dropdown must layer above combat/encounter overlays and the death panel; Android back closes it first.

### LINEAGE board (POLISH-04)
- **D-09 — Selector + top 10:** race and sub-class selectors at the top of LINEAGE (chip rows, 44px targets, fits 411px at S/M/L); the list is the top 10 runs of that lineage in DEEPEST order; "NOT IN THE TOP TEN · YOUR BEST RUN" pin; a lineage standing card; in-voice empty note.
- **D-10 — Lineage = race + sub (the displayed "RACE SUB"), not race + cls;** `lineageKey` changes accordingly.
- **D-11 — Default:** the active hero's race + sub; with no live hero, the most recent run's lineage; with no runs, the first in content order. Re-defaults on every panel open.
- **D-12 — Local storage:** `engine/records.js` prune keeps each lineage's top 10 runs in `ddr.bests.v1` (no GameState change, parity untouched, old saves tolerant-load); the Phase 65 `lineage {count, best}` map is retired; LINEAGE new-best keeps the 65 D-14 strict-beat rule computed from the kept runs.
- **D-13 — Global:** filter the existing cached 25-entry DEEPEST sample (plugin cap) to the selected lineage; honest footnote; no new network calls.
- **D-14 — Draft plan available:** `.planning/quick/260924-5b8-lineage-board-race-and-sub-class-selecto/260924-5b8-PLAN.md` (validated, not executed) implements D-09..D-13 — reuse it as the basis of this phase's plan.

### Close-out
- **D-15 — Device build:** after the last plan merges, rebuild the debug APK and install it on the connected Pixel 7 with `adb install -r` (same debug signer — keeps the save); fold every Phase 70 device check into `docs/UAT-v2.0.md`. No AAB rebuild in this phase unless the user asks (the 2.0.0/vc9 AAB is built but not uploaded; a rebuild would reuse vc9 only if it has not been uploaded — ask).

### Claude's Discretion
- Plan split and waves (the three areas touch `mazeworld.html` in different regions: title-music wiring, the HUD band-2/☰ dropdown, the boards-panel options + `.mw-bd-*` CSS), exact disabled-row styling, and in-voice copy wording (must pass the voice safety + HP-not-WP scans).

</decisions>

<code_context>
## Existing Code Insights

- ☰ menu: `mazeworld.html` band-2 HUD, `src/browser/hudMenu.js`; encounter gate `hasActiveEncounter()`; `hasOpenModal` / `closeModal` back-button handling.
- Account: `src/browser/account.js`, `src/browser/accountChip.js`, `content/account.js`, controller wiring from 67-08.
- Quit actions: `window.mzAbandonRun`, `window.mzAbandonCharacter`, `window.mzStartRoll`; HERO tab Delve panel (`#btn-save-quit`, `#btn-abandon-character`), label flip in `heroTab.js`/`paint()`.
- LINEAGE: `engine/records.js` (`lineageKey`, prune, lineage map), `src/browser/boardsView.js` (`buildLineageRows`, `lineageGroups`, `buildGlobalLineageRows`), `src/browser/boardsPanel.js`, `content/boards.js`.
- Title music: `src/browser/sfx.js`, `src/browser/nativeChrome.js`, `src/browser/titleMusic.js` (new, from 51h).

</code_context>

<deferred>
## Deferred Ideas

- The title chip's "?" face could become a person icon or SIGN IN label — offered to the user, not yet chosen; leave as is unless they answer.

</deferred>
