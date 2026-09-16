---
phase: 32-combat-narrative-input-ui-build
verified: 2026-09-16T15:00:00Z
status: passed
score: 4/5 requirements verified by automated evidence (CMBUI-02..05); CMBUI-06 is by definition the on-device DR round and is deferred to the end-of-run UAT batch per the user's "defer uat to end" instruction
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7: walk into an encounter — panel shows head → foe roster → 'The stare-down' card holding the encounter line → Fight!; NO narrative toast at the top of the screen", "Pixel 7: tap Fight! — the card becomes 'Round 1 · how that went' with the initiative line (and any pre-emptive strike / Afraid line), still no toast", "Pixel 7: tap Strike — the card is replaced by that round's lines, the topbar counter reads the next round, the action bar has not moved", "Pixel 7: open Spells / tap a cooling Use item / tap Potion at full health — the card persists and the refusal arrives as a toast", "Pixel 7: a long round (several foes) scrolls inside the card rather than pushing the action bar", "Pixel 7: kill the last foe — loot card appears and the kill line is a toast over it; flee — panel hides and the flee line is a toast", "Pixel 7 TalkBack: a new round is announced once; opening Spells does not re-announce; every guarded button is still announced as a button and becomes tappable after the arm window", "Pixel 7 (CMBUI-04): walk into an encounter with a D-pad double-tap — the second tap must NOT press Fight!; Fight! looks normal, not greyed", "Pixel 7 (CMBUI-04): after Fight!, mash Strike twice fast — exactly one strike per deliberate tap after the panel settles, no stuck button; tap a foe row to retarget then immediately Strike — never a wrong-target strike", "Pixel 7 (CMBUI-05): Move on from a floor-change/level-up card and immediately tap the D-pad — no step for the settle window, then normal; same after Take all / Leave all and after Leave them on a joiner", "Pixel 7: die — Review the Oracle and Confirm both work after the panel settles; Confirm needs no read-first lock", "Pixel 7: Enter on the Fight! gate right after the panel appears is swallowed, a second Enter fights (BT keyboard if handy)", "Pixel 7: Reduced motion ON in Android settings — every check above behaves identically (guards are clock checks)", "Pixel 7 (CMBUI-06 sign-off): the whole DR round — a combat round reads in one place, moving on never needs a dismiss-then-continue, nothing important vanished under a movement tap"]
gaps: []
---

# Phase 32 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-16)

Goal-backward check of the phase goal: *the Round Card design chosen in Phase 30 is built — a combat round's narrative lands in one coherent place instead of a stack of toasts, moving on takes at most one deliberate tap, and decision buttons are guarded against D-pad thumb-spam — then validated on-device before the milestone closes.*

## Automated evidence (re-run by the orchestrator after 32-03)

- `npm test`: **1902/1902, 0 failures** (1855 at phase start → 1864 after 32-01 → 1882 after 32-02 → 1902 after 32-03). `npm run build:www` exit 0 (32-01, 32-02, 32-03).
- Shell-only phase: `git diff --stat 9174e6e..HEAD -- engine content test/parity` empty across all three plans; `test/parity/prototype-master.js.txt` untouched; the seven §6.8 "unchanged" test files (`narrativeToasts`, `oracleLogViewModel`, `shell-oracle-panel`, `feedback-payload`, `toastsForAction`, `toastTable`, `toastsCoverage`) untouched on disk and green — the 25-05 partition invariants hold.
- Three plans, three SUMMARY.md files, all `## Self-Check: PASSED`; working tree clean at HEAD `1f38a9a`.
- Worst-case round measurement (`test/unit/round-card-worst-case.test.js`, 400 seeds × 2 scenarios, both frenzy mechanics + Stalka/Djinni/Krupke kits): `fight` seed 1 → 13 events / 5 lines / 246 chars; `attack` seed 8 → 27 events / 6 lines / 293 chars. The card is uncapped (user ruling, Area 1 #5) and the toast host stayed ≤ `MAX_TOASTS` on every seed.
- `grep -c "transitionend\|animationend" mazeworld.html` = 0; 24 `guardTap(` call sites; exactly one `encounterSettled()` clause in `window.move`.

## Success criteria → evidence

| # | Success criterion (ROADMAP) | Evidence |
|---|-----------------------------|----------|
| 1 | Round narrative in one coherent place; Oracle still complete | `dispatchWithToasts` is the single routing seam: post-dispatch `state.combat` non-null AND `priority !== PRIORITY.block` → `window.__mzRoundCard` line (uncapped via `toastsForAction(..., { limit: Infinity })`, text via `narrativeToastText`); refusals and everything out of combat → `mzToast` (≤ `MAX_TOASTS`). `renderEncounter` renders `.round-card` between the foe roster and the Fight!/action bar (textContent only; "The stare-down" preview, "Round N · how that went"); persistent sr-only `#enc-round-live` `aria-live="polite"` announcer re-announces only on seq change. `S.lastExchange`/`S.exchangeN` deleted. The Oracle path (`logLine`/`EVENT_NARRATION`) is untouched. Routing exclusivity + region source assertions in `test/unit/shell-round-card.test.js` (13) and `shell-toast-wiring.test.js` re-pins. |
| 2 | ≤1 deliberate tap to move on | No mid-fight Move-on gate was introduced (the card is rebuilt by the next render, never dismissed); loot/joiner/death/floor-change surfaces preserved at one tap (§6.2 table); no tap-anywhere-to-dismiss listener anywhere (`shell-input-guards.test.js`). |
| 3 | Decision buttons never fire from a D-pad-aimed tap | `src/browser/inputGuards.js` (`ARM_DELAY_MS = 250`, pure `isArmed`) bridged as `window.__mzInputGuards`; `guardTap`/`encArmed`/`armEncounterButtons` wrap exactly the §6.3 set (action bar incl. Items rows, Fight!, joiner ×2, loot rows + Take all/Leave all, find Take/Leave, death Review the Oracle + Confirm, `#enc-dismiss-slot`); keys go through the same check; `aria-disabled` during the window with no CSS flicker; every check is a `Date.now()` comparison (`inputGuards.test.js` purity scan, `shell-input-guards.test.js` 18 pins). |
| 4 | Nothing important dismisses from a movement tap | `DISMISS_SETTLE_MS = 250` clause in `window.move` keyed off `lastDismissAt`, stamped on the `hasActiveEncounter()` true→false transition; the hit-zone rule holds structurally (every decision button inside `#enc-panel`, roster → card → actions order keeps action-bar coordinates stable). |
| 5 | On-device DR round confirms the feel | **Deferred** — CMBUI-06 is the device round itself; it is the last block of the end-of-run UAT checklist (frontmatter `human_verification`). It does not gate `phase.complete` per 32-CONTEXT.md Area 3 #5 and the run's precedent (Phases 26–31). |

## Requirements

CMBUI-02 ✓ · CMBUI-03 ✓ · CMBUI-04 ✓ · CMBUI-05 ✓ · CMBUI-06 ⏸ deferred to end-of-run UAT (REQUIREMENTS.md keeps it Pending until the device round)

## Phase 33 hand-off (from 32-03-SUMMARY)

Haptics on hit/kill is the standing enhancer candidate (`src/browser/haptics.js`, Settings toggle exists). Deliberately unguarded: store rows/Leave, `renderDropShelf`, `a-evt`, `btn-again`, individual spell-menu buttons. Round-label asymmetry: the card header names the round the player acted in while the topbar shows the round in progress — revisit only if the DR round finds it confusing. `window.__mzRoundCard` is the only new presentation state (never on `S`).

## Deferred human verification

The fourteen Pixel 7 checks in the frontmatter `human_verification` list (merged from the three SUMMARY.md sections; the last is the CMBUI-06 sign-off) are batched into the end-of-run UAT list per the user's instruction for this autonomous run.
