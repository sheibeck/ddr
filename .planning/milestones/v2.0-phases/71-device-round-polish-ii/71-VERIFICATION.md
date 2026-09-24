---
phase: 71-device-round-polish-ii
status: passed
verified: 2026-09-24
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 8/8 requirements
human_verification:
  - "docs/UAT-v2.0.md section M (41 rows, M1–M41): the full Phase 71 device batch, source-mapped to the 71-01..71-08 SUMMARYs"
  - "Sound: death quieter, footsteps (dry and water) louder, theme louder but under a step; MASTER/MUSIC/EFFECTS shown only while Sound is On, live while dragging, one preview tap on EFFECTS release, levels survive a relaunch"
  - "Gear tab: worn and bag items show the same stat lines as a store row (damage dice, AR/durability, usable-by); readable and scrollable at text size L; store armour rows now read 'AR n · left/max hp'"
  - "Combat: the actions dim and read HOLD · THE DICE ARE STILL OUT while a round plays; STRIKE spam never double-strikes; a tap skips to the result without acting; every foe condition (Hamstrung, Marked, Stunned, Blind n…) shows as a chip"
  - "Long-press a foe (~450 ms): light buzz, one details card above the strip and actions, never aims or selects text; TalkBack 'Details: <name>'"
  - "The ROUND n · WHAT HAPPENED strip stays above the actions with 3+ foes at text size L; RESOLVING pulse; tapping it opens THE FIGHT SO FAR (newest first by round, dice on tap), never mid-round"
  - "Tap sound only on a real press: scrolling from a button, locked actions, skip taps and long presses are silent; STRIKE / GO DOWN make only their own sound (the old double sound is gone)"
  - "Every step onto water splashes; stepping out plays the dry footstep (note: flying/ether-walking over water also splashes — D-17 read literally)"
  - "A status chit tapped in combat shows its description on the combat card without skipping a round; each foe effect is described on the long-press card; TalkBack no longer calls chits 'disabled'"
---

# Phase 71: Device-Round Polish II: Verification

**Verdict:** passed on automated evidence. The debug APK with all of Phase 71 and the live Play Games IDs is installed on the Pixel 7 (`adb install -r`, same debug signer, save kept). The device checks above are section M of `docs/UAT-v2.0.md`, for the user's session.

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| POLISH-05 | 71-01: frozen `CLIP_GAIN` (death 0.5, six step clips 1.6, cap 2.0), `MUSIC_GAIN` 0.9, per-voice gain → effects bus → master, live levels; `volMaster`/`volMusic`/`volEffects` in `ddr.settings.v1` (11 keys, default 100, tolerant load); three sliders under Sound, shown only while On | ✓ (listen deferred) |
| POLISH-06 | 71-02: one `itemStatLines` formatter (plus `wornItemFor`, `ITEM_STAT_COPY`) rendered by the store rows (`storeItemStats`) and the Gear sheet's `stats` list; agreement test for bag and worn items; four declared snapshots moved | ✓ (device look deferred) |
| POLISH-07 | 71-03: `combatMenuViewModel(state, { locked })`, HOLD prompt, `data-locked` + `aria-disabled`, arm sweep skips locked actions, 8-case lock/skip/no-replay sandbox proof. 71-05: `roundSummary` + the fixed `#cb-summary` strip (last 3 revealed lines, RESOLVING). 71-06: THE FIGHT SO FAR sheet (R-22, R-23) | ✓ (device feel deferred) |
| POLISH-08 | 71-04: pure `foeDetails` view model for every bestiary creature (HP never WP), `longPress` recognizer (450 ms, cancels on move, suppresses the trailing click), light haptic, the combat-legal rail card above the actions, TalkBack "Details" buttons | ✓ (gesture deferred) |
| POLISH-09 | 71-03: `src/browser/foeConditions.js`, one chip table (adds Stunned, Hamstrung, Marked, timed Blind) read by `foeStatusBadges`; engine-scan coverage test fails on any foe-field write with no chip or reasoned exclusion | ✓ |
| POLISH-10 | 71-07: pure `uiTap.js`; unlock stays on pointerdown, the tap plays from one capture-phase click listener; silent for disabled / aria-disabled (unguarded) / data-locked / guard-swallowed / mid-round skip taps and long presses; one sound per press via `sfxClipCount()` (R-24..R-27) | ✓ (listen deferred) |
| POLISH-11 | 71-08: `COMBAT_CARD_KINDS`, `conditionCard`, `window.mzConditionCard`; hero chit taps in combat show the out-of-combat text on the combat card without skipping (R-29); `guardInfoTap`; every foe condition carries a `desc` shown per line on the long-press card (R-28..R-32) | ✓ (device look deferred) |
| POLISH-12 | 71-07 Task 2b: the dispatch `audioCtx.onWater` (from `result.state.floor.g[py][px].water`) makes every water step play the walk-water group; `waded` still works without the flag; water→dry plays walk | ✓ (listen deferred) |

## Automated gates

- Full `npm test` on master after the final merge (d77eea3, todo close ccc174b): **5483/5483 pass**.
- `npm run boot:check`: PASS. `bridge-doc --check` passes on every plan's committed content (the master working copy differs only by CRLF, the known autocrlf artifact).
- Engine gate: phase-wide (`dd06b3f..HEAD`), no file under `engine/`, `content/`, `test/parity/` or `sfx/` changed. Under `test/unit/fixtures/` only 71-02's four declared snapshots moved. `paint()`/`draw()` stay byte-identical (reduced-motion SHA-256 pins).
- Every decision D-01..D-17 is cited by at least one plan. D-15/POLISH-10, D-16/POLISH-11 and D-17/POLISH-12 were added mid-phase at the user's request (the 2026-09-23 tap-sound todo, the 2026-09-21 status-chit todo, the 2026-09-22 water-steps todo).
- Source todos closed to `.planning/todos/done/`: sound levels, gear-tab stats, combat lock + round summary, long-press details, UI tap sound, water steps, status chit in combat.

## Rulings to confirm on the device

- **R-26:** STRIKE, GO DOWN and other buttons with their own clip no longer also play the UI click.
- **D-17 read literally:** a party flying or ether-walking over water also hears the splash, where the engine's `waded` narration skips that case. It's a one-line guard if the user wants flight to stay dry.
- **R-19 / R-22:** the in-panel fight log left the middle of the combat panel. The full log is the THE FIGHT SO FAR sheet, opened from the strip, and the Oracle as before.
