---
phase: 70-device-round-polish
plan: 04
subsystem: browser-shell (HUD ☰ menu, DEAD tab, persistence proof, UAT)
status: complete
tags: [vanilla-js, presentation-only, hud, hamburger-menu, persistence, uat, milestone-v2.0]
requirements: [POLISH-01, POLISH-03]
requires:
  - "70-01 pure layer (hudMenu.js quit exports), 70-02 LINEAGE, 70-03 ☰ shell wiring (closeMenuThen, the quit rows, the data-dead stamp)"
  - "quick task 260924-51h title-music block (verified, untouched)"
provides:
  - "hudMenuNext opens on toggle whatever the context; hudMenuRowStates(ctx) -> six { key, id, enabled }"
  - "window.__mzHudMenu = { next, rows }; classic syncHudMenuRows writes disabled + aria-disabled"
  - "z-ladder rail 4 < overlay 8 < scrim 9 < ☰ wrap 10 < sheets 45 < title 50"
  - "closeModal menu-first early return; beat hurry before opening; rising-edge encounter close"
  - "the HUD and ☰ on all five in-game tabs; title-mode panel hides the HUD via body[data-boards-entry=title]"
  - "test/persistence/resume-mid-encounter.test.js (today's resume behaviour, with the 999.10 known limitation pinned)"
  - "docs/UAT-v2.0.md section L (29 rows) + Z2"
affects:
  - "backlog 999.10 (keep live combat and open store through a relaunch)"
  - "the orchestrator's D-15 debug APK install and the batched Pixel 7 walk"
tech-stack:
  added: []
  patterns:
    - "pure per-row availability reducer + one shell writer (syncHudMenuRows), re-synced on open and on renderEncounter"
    - "event-aware container onclick: a tap on an aria-disabled row keeps the menu open"
key-files:
  created:
    - test/persistence/resume-mid-encounter.test.js
  modified:
    - src/browser/hudMenu.js
    - src/browser/bridge.js
    - mazeworld.html
    - docs/SHELL-MODULES.md
    - docs/UAT-v2.0.md
    - test/unit/hudMenu.test.js
    - test/unit/hud-menu-layout.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/shell-menu-quit.test.js
    - test/unit/shell-boards-entry.test.js
    - test/unit/shell-boards-panel.test.js
    - test/unit/boards-css.test.js
    - test/unit/harness/shellSandbox.js
decisions:
  - "R-A: CENTRE MAP is disabled while an over-map encounter is up; MAKE CAMP is the only engine-refused row (disabled mid-encounter, dead or with no hero); the short-on-food dim stays tappable"
  - "R-B: the DEAD tab keeps the HUD (Phase 57 discovery-B hide retired); only the title-opened panel hides it"
  - "R-C: opening the ☰ lands a live combat beat first (window.__mzBeat?.hurry?.())"
  - "R-D: only an encounter STARTING closes an open menu; a re-render of an ongoing one leaves it open"
  - "User ruling 2026-09-24 (option 3, DEFER): a relaunch mid-combat / mid-store clears the fight or store (saveState.js#rehydrate); pinned as a known limitation, fix tracked as backlog 999.10; no engine change"
metrics:
  duration: "~2h (including the checkpoint round-trip)"
  completed: 2026-09-24
  tasks: 3
  commits: 5 task commits + this SUMMARY
---

# Phase 70 Plan 04: The ☰ on every screen, the resume pin, POLISH-01 and the UAT fold Summary

**The ☰ now opens everywhere, including in combat, in a store, at the stair prompt, over THAT IS THAT and on the DEAD tab. Rows that can't act are dimmed and disabled by a pure `hudMenuRowStates`. The menu sits above the overlays, and the back button closes it first. The mid-encounter Save & quit resume is pinned as it behaves today: exact in session, loot kept on a relaunch, and a fight or store cleared on a relaunch, which is the known limitation tracked as 999.10. POLISH-01 is confirmed against D-02 with no gaps, and every Phase 70 device check is folded into UAT-v2.0 section L.**

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `fc7db4f` | test(70-04): add failing tests for the ☰ opening on every screen (D-08) |
| 2 | `f1aea3c` | feat(70-04): the ☰ opens on every screen with context-disabled rows |
| 3 | `286626a` | test(70-04): add failing DEAD-tab HUD tests and the resume pin (D-08) |
| 4 | `4f473f0` | feat(70-04): the ☰ on the DEAD tab, and a resume proof for mid-encounter Save & quit |
| 5 | `add19f4` | docs(70-04): fold the Phase 70 device checks into UAT-v2.0 |

## What shipped

**Task 1: the ☰ opens on every screen (D-08).**
- `hudMenuNext`'s toggle returns `!open` whatever the context. The `ctx` parameter stays but is no longer read.
- `hudMenuRowStates(ctx)` returns six frozen `{ key, id, enabled }` entries in dropdown order:
  - MARKS, SETTINGS, SAVE & QUIT and ABANDON are always enabled.
  - CENTRE MAP is enabled unless `ctx.encounter === true`.
  - MAKE CAMP is enabled only when `hero === true`, `dead !== true` and `encounter !== true`.
  - A missing or hostile ctx never throws: MAKE CAMP reads as disabled and every other row as enabled.
- The bridge is `{ next, rows }`. `BRIDGE.__mzHudMenu` names both consumers, and the doc table is regenerated.
- Classic shell:
  - `hudMenuEvent` asks `next(open, kind)` with no encounter context, and calls `window.__mzBeat?.hurry?.()` before `setHudMenuOpen(true)`.
  - `syncHudMenuRows()` is TDZ-safe, never touches `#mw-hud-menu-acct`, and does nothing without the bridge. It runs on every open and from `renderEncounter` while the menu is open.
  - `renderEncounter` uses `if (active && !encWasActive) hudMenuEvent("encounter");`.
  - The container's onclick ignores a tap on an `[aria-disabled="true"]` row.
- CSS:
  - `#mw-hud-menu .mw-hud-menu-item:disabled` (1,2,0) dims the row and its glyph and outranks `#btn-camp[data-short="1"]`. It has no motion.
  - The scrim moves to z 9 and the wrap to z 10. The T-57-19 ladder comment, the scrim markup comment and the DFB-06 CSS comment are rewritten.
- `closeModal`: `if (hudMenuIsOpen()) { hudMenuEvent("escape"); return; }` now runs after the account-sheet and title-panel returns and before the gear sheet and the store/beats/stair clears.
- `docs/SHELL-MODULES.md` has a D-08 paragraph.

**Task 2: the DEAD tab and the resume pin.**
- `showTab` no longer writes `data-offtab`. The two `[data-offtab]` rules are gone.
- Title-mode CSS: `body[data-boards-entry="title"] #mw-hud` and `#mm-conditions` are hidden, and the title-mode `#screen-dead` keeps the safe-area top padding.
- The in-game `#screen-dead` has `padding-top:0`. The side/bottom reset rule is unchanged.
- `test/persistence/resume-mid-encounter.test.js` runs against the real engineAdapter with a fake localStorage. Its results are listed under Resume proof below.

**Task 3:** the POLISH-01 conformance check (below), the UAT fold (below) and the phase gates.

## POLISH-01 conformance against D-02 (no reimplementation)

The asset is `sfx/theme.mp3`. It is tracked (`git ls-files` lists it), 2,318,486 B, sha256 `0e3bed0a820e6ed02db5b4be074c69b8f0022cf606622dc3188fb69f79d702d0`. The 51h pins all pass: titleMusic, sfx-music, sfx-assets, title-music-shell and lifecycle, 86/86.

| D-02 clause | Passing pin(s) |
|---|---|
| Starts at launch on native with no tap | title-music-shell (11) "native launch — the device is opened one frame after first paint, native only"; titleMusic "native launch — the device opening with the title up and no gesture starts the theme" |
| Falls back silently to the first tap, and in the browser dev loop | title-music-shell (5)(6) (the one `unlockSfx(` inside `unlockAudioAndSync`, the first-gesture listener); titleMusic "unlock landing while the title is hidden never starts…"; sfx-music "a resume() that never settles cannot wedge the unlock…" and "a rejected play() is swallowed; the next nudge re-plays" |
| Continues from the title into the roller and over title-opened panels/sheets | title-music-shell (4) (the title area covers the title, the roller and the title-mode panel) and (8) (one MutationObserver on all three); titleMusic "title -> roller is one continuous title-area state — no stop, no restart" |
| Fades ~500 ms on reaching the map, instantly under reduced motion | titleMusic "MUSIC_FADE_MS is 500", "leaving the title alone fades out — stop(MUSIC_FADE_MS)", "leaving the title under reduced motion cuts at once — stop(0)"; sfx-music (default backend) "fade = gain ramp to 0 over fadeMs, then pause" |
| Restarts from the top when the title or the roller shows again | titleMusic "title hidden then shown again restarts", "roller -> map fades; a later roll (roller shown again) restarts from the top"; sfx-music "stop then start again restarts through startLoop" and (default backend) "restart … resets to the top" |
| Respects Sound | titleMusic "Sound off from the start never starts…"; sfx-music "startMusic … under Sound Off … starts nothing", "the Sound-Off transition cuts the loop BEFORE close()"; title-music-shell (7) (the Sound row re-syncs) |
| Stops in the background | lifecycle "260924-51h: pause calls onBackground…", "appStateChange({ isActive: false }) calls onBackground…", "…isActive: true calls onForeground", "a resume listener … calls onForeground"; title-music-shell (9) and (10) (the native hooks, the visibilitychange listener); titleMusic "appActive false then true with the title up — stop(0) then start()" |
| Streams through an HTMLAudioElement into the Web Audio gain path, not a full decode | sfx-music (default backend) "the first start creates ONE looping element on ./sfx/theme.mp3, routed once through createMediaElementSource -> gain(MUSIC_GAIN) -> masterGain"; "unlockSfx alone never touches the theme — loads are exactly the 30 CLIP_IDS" |
| Committed byte-for-byte; AUD-06 at 30 + 1 | sfx-assets AUD-06 "EXPECTED_MUSIC has exactly 1 entry…" and "sfx/ contains exactly the 30 expected clips plus the 1 declared music track"; the size and sha256 check above |

The ☰'s NEW CHARACTER row (70-03) reaches the roller through `window.mzStartRoll`, which un-hides `#mw-roller-screen`. The observer sees the title area return, so the theme restarts from the top, as 51h designed.

**POLISH-01 gaps for the orchestrator:** none. Every clause maps to a passing pin.

## Planner rulings (as executed)

- **R-A:** CENTRE MAP is disabled only while `hasActiveEncounter()` is true. MAKE CAMP is the one engine-refused row. The short-on-food state (DFB-06) is still dimmed but tappable, and is never disabled.
- **R-B:** the DEAD tab keeps the HUD. If the user prefers the old full-height DEAD tab, revert only the showTab/CSS hunk of `4f473f0`.
- **R-C:** a live beat is landed before the menu opens.
- **R-D:** only an encounter starting closes an open menu.
- **DISC-3:** RESOLVED. The ☰ opens while dead, so the NEW CHARACTER row is reachable.

## Resume proof (test/persistence/resume-mid-encounter.test.js)

| Case | Result |
|---|---|
| In session: `mzAbandonRun`'s body only calls `showTitleScreen({ allowResume: hasActiveDelveSave() })`, with no dispatch, state write or roll | pinned, passes |
| In session: ENTER's resume branch is `hideTitleScreen();` then `surfaceWornReconcile(); return;`, with no dispatch | pinned, passes |
| (c) Relaunch with a pending loot pile: the pile, the floor/position and the hero rehydrate, and the whole state JSON-equals the save | passes |
| Dead save: `abandon` writes `dead === true`; the shell's `hadSaveAtLaunch = !!(parsed && !parsed.dead)` sends a relaunch to the roller | passes |
| (a) Relaunch mid-combat: the save carries `combat`, but `boot()` returns `combat === null`; the floor/position and hero survive | **known limitation**, pinned |
| (b) Relaunch mid-store: the save carries `store`, but `boot()` returns `store === null` | **known limitation**, pinned |

## Known limitations

- **A relaunch mid-combat or mid-store clears the fight or the store.** `engine/saveState.js#rehydrate` resets `combat`, `store` and `beats` to null on load. This has been deliberate, transient-state behaviour since Phase 1, the same as the prototype's own load. The save file does carry them.
  - D-08 asks for a mid-encounter Save & quit to resume exactly. That holds in session, but not across a force-close and relaunch.
  - The executor raised this at a checkpoint. The **user ruled on 2026-09-24 for option 3, DEFER**: no engine change in Phase 70. The gap is pinned in `resume-mid-encounter.test.js` (cases (a) and (b)) and tracked as backlog item **999.10 "Keep live combat and open store through a relaunch"**.
  - When 999.10 lands, flip (a) and (b) to assert that the sub-state survives. UAT row L19 records the expected behaviour today: the fight or store is cleared, and a loot pile survives.

## UAT fold (docs/UAT-v2.0.md, D-15)

- **Added:** section L, "Device-round polish — Phase 70 (29)", L1 to L29, plus Z2, the 51h browser-only item.
  - The folded sources are 51h (9 items), 70-01 (5), 70-02 (6), 70-03 (5) and 70-04 (7): 32 items, each with exactly one Source map line.
  - The row order is: theme L1–L8, ☰ face and ACCOUNT L9–L12, quit rows L13–L15, ☰ everywhere L16–L23, LINEAGE L24–L29.
  - L10, L12 and L28 are console-dependent and follow step 5.
- **Re-worded (7):** C1 (the DEAD tab now carries the HUD), C9 (the sheet no longer opens over the map), D1 and D3 ("the ☰ face and the title chip"), E2 (the title chip only), E3 (the title chip; the ACCOUNT block in the dungeon) and E5 (the ☰ face, the title chip and the strip).
- **Superseded (3):** E1 → L9, E4 → L16, B17 → L28.
- **Also updated:** 30 existing Source map lines now carry "re-worded for Phase 70 (L#)" or "superseded by Phase 70 (L#)". The Sources paragraph, Suggested order and Tally are updated. The **Build:** line is left for the orchestrator.

## Deviations from Plan

**1. [Rule 3 - Blocking] Test-harness and pin updates outside the plan's file list** (commit `f1aea3c`)
- `test/unit/harness/shellSandbox.js` wires `rows: hudMenuRowStates` into the sandbox bridge, so the BEHAVIOUR tests use the real reducer.
- `shell-menu-quit.test.js` (the import-line pin, and the container-onclick pin in the event-aware form) and `shell-boards-entry.test.js` (C2) now match the new code. C2's extracted `closeModal` now throws on the unthreaded `hudMenuIsOpen`, which still proves that a tab-opened panel skips the guard.

**2. [Rule 1] Kept the shell inside existing pins**
- The CSS comment for the disabled rule avoids the literal attribute name, because three tests forbid that token anywhere in `<style>`.
- `paint()` is byte-identical. Its DFB-06 comment was not edited, because paint() is SHA-256-pinned by the reduced-motion audit; the D-08 note sits in the CSS comment instead.

**3. Checkpoint and user ruling.** The resume proof exposed the combat/store relaunch gap. The executor stopped per the plan's escalation rule. The user ruled DEFER, so it is pinned as today's behaviour; see Known limitations above.

## Phase gates

- `npm test` (worktree): 5203 tests, 5196 pass. The 7 failures are exactly the known CRLF doc-ledger ones (class-pass-ledger / flee-ledger).
- `node tools/bridge-doc.mjs --check` exits 0. bridge-registry and shell-no-content-copies pass.
- Phase-wide diff from `af8834e~1` (the parent of the first 70-01 commit) to HEAD: 48 files, +4096 / −781.
  - engine/: only `engine/records.js` (1 file).
  - test/parity/: 0 files.
  - test/unit/fixtures/: only the two declared hero snapshots (`mu.hero.txt`, `thief.hero.txt`).
  - content/: only `content/account.js` and `content/boards.js`.
- Nothing was built or installed, and adb was not touched.

## Known Stubs

None.

## Threat Flags

None. There is no new surface beyond the plan's threat model (T-70-13..16, all mitigated or accepted as planned).

## Human verification (deferred to end of run)

These are for the Phase 70 device round, folded into docs/UAT-v2.0.md section L (L16–L23), after the orchestrator's D-15 debug APK install:

1. The ☰ opens on the map, in a fight, in a store, on a loot pile, at the stair prompt, over THAT IS THAT, on the Oracle (via REVIEW THE ORACLE while dead) and on all five tabs including DEAD. The dropdown sits above the overlay, and a scrim tap closes it without pressing anything underneath.
2. Mid-fight, MAKE CAMP and CENTRE MAP are dimmed and do nothing. MARKS, SETTINGS, the ACCOUNT rows, SAVE & QUIT and ABANDON all work.
3. SAVE & QUIT mid-fight, then ENTER: the same fight, the same round and the same foes. After a force-close and relaunch, the fight (or an open store) is cleared on the same tile, and a loot pile survives. This is the known limitation, backlog 999.10.
4. Dead: the ☰ opens over THAT IS THAT, and its last row reads NEW CHARACTER, which opens the roller (the title theme starts). SAVE & QUIT goes to the title, and ENTER there rolls a new hero.
5. Android back with the ☰ open over a store or the stair prompt closes only the menu; the store or prompt stays.
6. Tapping ☰ while a combat round is still typing lands the round at once, with no half-typed round under the menu.
7. The DEAD tab shows the HUD above the Leaderboards panel. At text size L the list still has usable room; note it as a finding if it feels cramped. VIEW THE DEAD from the title shows no HUD and no ☰.

## Self-Check: PASSED

- FOUND: test/persistence/resume-mid-encounter.test.js, src/browser/hudMenu.js (hudMenuRowStates), mazeworld.html (syncHudMenuRows), docs/UAT-v2.0.md (section L)
- FOUND commits: fc7db4f, f1aea3c, 286626a, 4f473f0, add19f4
