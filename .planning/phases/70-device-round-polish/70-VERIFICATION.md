---
phase: 70-device-round-polish
status: passed
verified: 2026-09-24
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 4/4 requirements
human_verification:
  - "docs/UAT-v2.0.md section L (29 rows) plus Z2 — the full Phase 70 device batch, source-mapped to the 51h and 70-01..70-04 SUMMARYs"
  - "Theme: audible at cold launch with no tap; continuous from title into the roller; fades on reaching the map; restarts after BURY THEM / Save & quit; Sound Off cuts, On restarts on the same tap; silent in the background; no gap at the ~2:25 loop seam"
  - "☰: initials avatar when signed in, plain ☰ otherwise; ACCOUNT block first; dropdown fits and scrolls at S/M/L; band-2 counters no longer crowded"
  - "☰ opens on the map, in combat and every encounter, on the Oracle, on all five tabs including DEAD, and while dead; MAKE CAMP / CENTRE MAP dimmed where they can't act; Android back closes the menu first"
  - "SAVE & QUIT with no dialog resumes exactly in session; ABANDON arms on the first tap (TAP AGAIN TO BURY THEM, reverts after ~3 s), NEW CHARACTER when dead; the HERO tab's Delve panel is gone"
  - "Known limitation (backlog 999.10): after a relaunch a live fight or open store is cleared; loot piles survive"
  - "LINEAGE: race + sub-class chip rows default to the live hero; top 10 per lineage; empty lineage shows the in-voice note; the chip rail centres the active chip"
---

# Phase 70: Device-Round Polish — Verification

**Verdict:** passed on automated evidence. The debug APK with all of Phase 70 is installed on the Pixel 7 (`adb install -r`, same debug signer, save kept); the device checks above are in `docs/UAT-v2.0.md` section L for the user's session.

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| POLISH-01 | Quick task 260924-51h (merged c8e25d3): `src/browser/titleMusic.js` pure state machine, streamed `HTMLAudioElement` → music gain (0.5) → master, launch start on native (Capacitor `setMediaPlaybackRequiresUserGesture(false)`) with first-tap fallback, roller counted as title area, fade at the map, Sound/background aware; `sfx/theme.mp3` tracked byte-for-byte; AUD-06 = 30 clips + 1 music track. 70-04 mapped every D-02 clause to a passing test (86/86), no gaps | ✓ (listen deferred) |
| POLISH-02 | 70-01 pure layer (`accountMenuView`, `renderMenuFace`, `renderAccountMenu`, `menuView`, `ACCOUNT_COPY.menuLabel`); 70-03 shell wiring: the ☰ wears the account face, ACCOUNT block first in the dropdown, band-2 chip removed (band 2 back to S 336.4 / M 377.8 / L 446.8 px), title chip kept | ✓ (device look deferred) |
| POLISH-03 | 70-01 `abandonRowNext` + `HUD_MENU_QUIT_COPY`; 70-03 SAVE & QUIT / two-tap ABANDON rows (dialogs removed), Delve panel deleted (two hero snapshots declared), `closeMenuThen` for every row; 70-04 `hudMenuRowStates` + `syncHudMenuRows`, ☰ opens in every context, HUD on the DEAD tab, overlay z-order, back closes the menu first, round finished on open; `test/persistence/resume-mid-encounter.test.js` pins in-session exact resume and the relaunch limitation (backlog 999.10) | ✓ (with the recorded limitation) |
| POLISH-04 | 70-02: `lineageKey` = race + sub-class, `lineageRuns`, prune keeps each lineage's top 10 in `ddr.bests.v1` (old saves tolerant-load, record stays v1), LINEAGE picker model + default chain (picker → live hero → latest run → Human Wizard), filtered global sample (no new PGS calls), chip rows + hero seam + CSS; rail-centring `.find` bug on real `HTMLCollection` fixed | ✓ (device look deferred) |

## Automated gates

- Full `npm test` on master after the final merge (7712820): **5203/5203 pass**.
- `bridge-doc --check` passes on the committed content (the master working copy differs only by CRLF, the known autocrlf artifact).
- Engine gate: phase-wide, `engine/` changed only in `engine/records.js` (records, not GameState); `test/parity/` untouched; the only fixture movement is the two declared hero DOM snapshots.
- Decision coverage 15/15 at plan time; requirements 4/4.

## Known limitation (user ruling: defer)

A live fight or open store is cleared when the app is relaunched mid-encounter, because `engine/saveState.js#rehydrate` resets them to null, copying the prototype's load. This is pinned as today's behaviour and filed as backlog **999.10**. In-session Save & quit resumes exactly.
