---
phase: 71-device-round-polish-ii
plan: 05
subsystem: ui
status: complete
tags: [vanilla-js, presentation-only, combat, round-summary, mock, milestone-v2.0]
requirements: [POLISH-07]
requires:
  - src/browser/fightLog.js log shape (appendFightLog batches, seq, round)
  - Phase 58 beat runner view { state, log, maxId, typeId } and beatHurryTap
  - Phase 58 shared "fightlog" typewriter and the #enc-round-live announcer
  - 71-03 combat action lock (#cb-act[data-locked])
  - 71-04 combat-legal rail card and its --mw-rail-lift
provides:
  - src/browser/fightLog.js roundSummary(log, beatView) and ROUND_STRIP_COPY
  - window.__mzFightLogVM.summary / .copy (module, sandbox mirror, bridge registry)
  - mazeworld.html renderRoundStrip(host, fallbackRound) and the #cb-summary strip
  - "@keyframes mwtorch (the mock's pulse)"
affects:
  - the combat screen layout (header, #cb-mid foes and party only, #cb-summary, #cb-act)
  - the Phase 58 beat reveal and typing (now in the strip)
  - 71-04's rail lift (measures the strip first)
  - 71-06 (THE FIGHT SO FAR sheet reuses renderFightLog and hangs its tap on #cb-summary)
tech-stack:
  added: []
  patterns:
    - "a pure, frozen, spoiler-gated view model (roundSummary) bridged to the classic renderer"
    - "a once-per-new-line rise flag so a same-content re-render never replays an entrance animation"
key-files:
  created:
    - test/unit/round-summary-band.test.js
    - .planning/phases/71-device-round-polish-ii/71-05-SUMMARY.md
  modified:
    - src/browser/fightLog.js
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/fightLog.test.js
    - test/unit/hp-not-wp.test.js
    - test/unit/combat-beat-shell.test.js
    - test/unit/reduced-motion.test.js
    - test/unit/shell-combat-screen.test.js
    - test/unit/shell-fight-log.test.js
    - test/unit/combat-lock-shell.test.js
    - test/unit/foe-inspect-shell.test.js
decisions:
  - "R-18: a mid-round tap on the strip is Phase 58's beatHurryTap (the strip is inside #enc-panel); it skips and opens nothing, so no new listener"
  - "R-19: the in-panel fight log and its scroll-into-view gate left #cb-mid (the mock's middle holds foes and party only); renderFightLog stays defined for 71-06's sheet; the Oracle is the full log until then; the revert is renderFightLog(mid)"
  - "R-20: the beat reveal and the fightlog typewriter target the strip's newest line with the same type/adopt/cancel and aria-hidden rules; #enc-round-live still announces the whole round once"
  - "R-21: the latest round is the entries whose round equals the newest entry's round, read back from the end; a null round falls back to the newest batch; a refusal in the same round joins it"
  - "The strip's label names the round of the lines it shows (the round just played), falling back to the live combat round when the log is empty; the header keeps showing the current round"
  - "The newest line rises in only when a new line becomes the newest, never on a submenu or re-render of the same round"
metrics:
  duration: "~40 min"
  completed: 2026-09-24
  tasks: 2
  files: 14
---

# Phase 71 Plan 05: The what-happened strip Summary

The combat screen now follows the user's combat v2 mock. A fixed "ROUND n · WHAT HAPPENED" strip sits directly above the action buttons and shows the last three lines of the latest round, with the newest bright and the older ones dim. The foes and your lot scroll on their own in the middle, so more foes never push the strip or the buttons off-screen. While a round plays, the label reads RESOLVING in red and pulses. The strip shows only the lines that have already appeared, and the newest one types in. A tap anywhere, the strip included, lands the round at once.

## Source todo

With this plan, `.planning/todos/pending/2026-09-24-combat-lock-actions-while-a-round-plays-and-keep-the-round-summary-visible.md` is **fully closed**. Item 1 (lock the actions while a round plays) landed in 71-03; item 2 (keep the round summary visible) lands here. The orchestrator moves it to `done/` on merge.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | roundSummary, the strip's pure, spoiler-safe content (D-07) | 4d27d07 (RED), bea232c (GREEN) |
| 2 | The strip above the actions, with the beat reveal moved into it and the log out of the middle (D-07, D-06) | 35a3a11 (RED), 7994a06 (GREEN) |

## What was built

- **`roundSummary(log, beatView = null)`** (`src/browser/fightLog.js`) returns a frozen `{ round, lines, newestId, total }`.
  - `lines` holds at most the last 3 entries of the latest round, oldest to newest. Each is `{ id, text, tone, newest }`, with the text kept whole.
  - With a beat view, the source is `beatView.log`, and only entries with `id <= maxId` show. `round` still comes from the whole log, so a beat that has revealed nothing yet shows no lines, never the round before.
  - `total` counts the whole log, for the chip.
  - Null, empty and malformed logs return no lines and never throw. The function is pure.
- **`ROUND_STRIP_COPY`** is frozen: `roundHappened` "ROUND {n} · WHAT HAPPENED", `resolving` "RESOLVING", `fullLog` "FULL LOG · {n} ›". It is voice-scanned and registered in hp-not-wp's banks.
- **`renderRoundStrip(host, fallbackRound)`** (mazeworld.html, right after `renderFightLog`) builds `div#cb-summary` with createElement/textContent only:
  - a head with `.cb-sum-label` (`data-busy="1"` while a beat is live) and `.cb-sum-chip`;
  - `.cb-sum-body` with one `.cb-sum-line > .cb-sum-text` per line. The newest line carries `.cb-sum-newest`, and `.cb-sum-rise` only when it is new.
  - It calls `syncFightLogLive(log)` with the whole log.
  - It types the newest line through `__mzTypewriter` "fightlog" when `bv.typeId` matches it, and cancels any stray run otherwise.
  - It adds no listener.
- **The combat branch** runs header → `#cb-mid` (foes, YOUR LOT) → `body.appendChild(mid)` → `renderRoundStrip(body, C.round)` → `#cb-act`. The `lastLogSeqShown` scroll gate and its variable are gone. The pending overlay returns before any of this, so it builds no strip, and the over, loot, store, stair and death branches never reach it.
- **The CSS comes from the mock:**
  - `#cb-summary`: `flex:none`, border-top 3px #3a3226, background #16120c, padding 9px 12px 10px;
  - the label is 6.5px Press Start in #a89c82, and the busy label is #e07260 with `mwtorch .9s steps(2) infinite`;
  - the chip is 6px in #8f856f;
  - the body is 78px, `justify-content:flex-end`, overflow hidden, with the 22px top mask;
  - lines are 14px bold with 1.4 line-height, #8f856f, and the newest is #e6ddc6 with `mwrise .22s`;
  - `@keyframes mwtorch` was added verbatim from the mock. The blanket reduced-motion rule drops the pulse and the rise.
- **The lift:** `renderRail` measures `#cb-summary`'s top first and falls back to `#cb-act`'s, so 71-04's foe card sits above the strip and covers neither it nor the actions.
- **The bridge:** `window.__mzFightLogVM` gains `summary: roundSummary, copy: ROUND_STRIP_COPY` in the module and in the sandbox mirror. The bridge.js consumers and purpose are updated, the bridge-doc was regenerated, and a D-07 section was added to docs/SHELL-MODULES.md.

## Rulings recorded

- **R-18 (D-06 with the strip):** the strip is inside `#enc-panel`, so a tap on it during a live beat is caught by Phase 58's capture-phase `beatHurryTap`. That stops propagation and skips. The strip's own tap (opening the log, in 71-06) can never fire mid-round. No new listener was added. `#enc-panel` still has exactly one capture click listener. round-summary-band (c) proves this.
- **R-19 (the in-panel log leaves the middle):** the mock's middle holds foes and party only. D-07's "the full round text or log stays scrollable above it" is met by three things:
  - the strip (the latest round, always visible);
  - 71-06's THE FIGHT SO FAR sheet (the full log, scrollable, grouped by round, opened from the strip);
  - the Oracle, which stays the complete per-swing log.

  Until 71-06 lands, the full log and the per-line dice reveal are reachable only through the Oracle tab. `renderFightLog` stays defined and its row building and reveal pins stay in place. The revert is `renderFightLog(mid)` in the combat branch.
- **R-20 (the typing moves with the reveal):** the Phase 58 D-14 reveal and the "fightlog" typewriter now target the strip's newest line. The type/adopt/cancel rules, `lastBeatTypedId`, aria-hidden while typing, and the whole-round announcer (D-16) are unchanged. Under reduced motion the beat resolves synchronously, nothing types, and the blanket rule drops the rise and pulse.
- **R-21 ("latest round"):** the strip shows the entries whose `round` equals the newest entry's round, read back from the end while it matches. When the round is null it falls back to the newest batch (`seq`). A refusal appended in the same round joins it. A shell refusal (`fightLogRefuse`) is stamped with the live round, so it opens the next round's group, and that round's resolution then joins it.

## Backlog 999.5 notes (Combat screen & Oracle readability)

1. Submenu rows clipping and spell order: no overlap. This stays in 999.5, with 999.6.
2. Foe family after the name on the card: related to D-09, since 71-04's long-press card shows the family. The on-card label stays in 999.5, and the mock does not add it.
3. Oracle lines in event order: the strip keeps the fight log's own fold order, the same order the sheet will show, so the two never disagree. When 999.5 moves the fold to event order, both follow with no change here. The roundSummary JSDoc records this.
4. Status chit in combat shows nothing: 71-04's combat-legal rail path is the mechanism this item needs, and its lift now clears the strip too. It stays in 999.5.
5. The scroll-read refusal narration: no overlap.

## Mock deltas outside D-07

These are not built here and are listed for the orchestrator. They are mock elements that differ from the current combat screen, outside D-05..D-07:

1. **Party prompt:** the mock reads `{NAME}'S TURN · PICK YOUR MISTAKE`, with the name prefix only when there is a party. The game's prompt is `PICK YOUR MISTAKE` with no name.
2. **Grid labels:** the mock uses STRIKE / SPELL / GEAR / RUN, with RUN in the red accent. The game keeps `1 · STRIKE`, `2 · SPELLS`/`2 · ABILITIES`, `3 · ITEMS`, `4 · SOCIAL` (FLEE · PARLEY).
3. **Full-log sheet** (scrim `rgba(10,8,6,.72)`, max-height 74%, THE FIGHT SO FAR, newest first under ROUND headers, tap a line for its dice, tap the scrim to close) and the strip's tap to open it: 71-06.
4. **Dice mode** (the mock's "on tap" / "always" / "never" prop and the `TAP A LINE FOR ITS DICE` hint): the game has no such setting. On-tap reveal is today's behaviour and 71-06 carries it.
5. **The mwrise distance:** the mock's `mwrise` rises 14px and the game's existing keyframe rises 16px. The strip reuses the game's keyframe, a 2px difference.
6. **Party member cards:** the mock shows each member's HP, bar and a third line, with the active member in gold. The game's YOUR LOT cards match this in structure, and the mock's "wp" field is shown as HP (HP-never-WP).
7. **Already matching, so no delta:** the submenu `mwrise .16s` rise and 206px max-height, the HP bar `steps(6)` transition, the header's ENCOUNTER / ROUND n / n STANDING, the aim hint and threat label copy, the party hint copy, the selected-foe gold border and the dead-foe 0.45 opacity. These are already in the game from Phase 34 and Phase 71-03.

## Deviations from Plan

1. **[Rule 2 - Correctness] The rise plays once per new newest line.** The plan put `mwrise .22s` on the newest line. Every renderEncounter (a submenu open or close, a beat tick) rebuilds the strip, so an unconditional class would replay the rise on every re-render of the same round. `lastStripRiseId` gates `.cb-sum-rise` to a newly newest line and resets on an empty log, because a new fight restarts ids. Test round-summary-band (g) pins this. Commit 7994a06.
2. **[Rule 3 - Blocking] The label's round when the log is empty.** `roundSummary.round` is null before a fight's first line, so `renderRoundStrip` takes the live `C.round` as a fallback (`renderRoundStrip(body, C.round)`), and the label never reads "ROUND  · WHAT HAPPENED". Commit 7994a06.
3. **[Rule 3 - Blocking] Stale-terms allow-list.** The re-pointed shell-fight-log section header first read "zero Round Card", which the DOCS-01 stale-term scan flagged. It now keeps the allow-listed phrase "zero remaining Round Card". Commit 7994a06.
4. **combat-lock-shell (7)** was widened to also forbid `cb-summary`/`cb-sum-` in the `#cb-act[data-locked]` rules. This is a strengthening, so the lock never styles the strip. foe-inspect-shell's lift pin now also requires the strip to be measured first. Commit 35a3a11.
5. The bridge-doc was regenerated with `--write`. `--check` exits 0, and docs/SHELL-MODULES.md stays LF in the working copy.

There is no engine/, content/ or test/parity/ change. `paint()`/`draw()` are byte-identical: the reduced-motion SHA-256 pins pass. `beatHurryTap` and its listener are untouched, and `#enc-panel` still has exactly one capture click listener.

## Threat model check

- **T-71-09 (a spoiled round):** mitigated. roundSummary gates on `beatView.maxId`. fightLog.test's beat-gating test and round-summary-band (b) prove that only revealed lines show, including the case where nothing has been revealed yet.
- **T-71-10 (a covered control):** mitigated. The strip is in the normal flow (`flex:none`) between the scrolling `#cb-mid` and `#cb-act`. A source pin forbids `position:absolute|fixed` on any `#cb-summary` rule, and (a) and (d) prove the sibling order with 2 and 4 foes.
- No new surface: no network, storage, schema or listener.

## Verification

- Task 1: `node --test` fightLog, shell-fight-log, combat-beat and hp-not-wp all pass (78 tests).
- Task 2: `node --test` round-summary-band, shell-combat-screen, shell-fight-log, combat-beat-shell, combat-lock-shell, foe-inspect-shell, reduced-motion, shell-input-guards, bridge-registry, shell-no-content-copies, hp-not-wp and rail-overlay all pass. `node tools/bridge-doc.mjs --check` exits 0.
- `npm test`: **5391 tests, 5384 pass, 7 fail.** The 7 are the known worktree CRLF doc-ledger failures: Outliers, AFTER/Outliers/Handoff, Handoff to Phase 27, v1.5 AFTER, and the three flee-table rows. There are no other failures.

## Known Stubs

None. The strip's chip reads "FULL LOG · n ›" but has no tap yet. That is intentional: 71-06 (the next wave) adds THE FIGHT SO FAR sheet and the strip's tap. Until then the Oracle tab is the full log.

## Human verification (deferred)

These are deferred to the Phase 71 device round, folded into section M by 71-06:

1. Fight 3 or more foes at text size M and then L. The strip "ROUND n · WHAT HAPPENED" sits directly above the buttons and shows the last three lines of the round, with the newest bright. The foes and your lot scroll above it, and nothing covers a foe card or a button.
2. While a round plays, the strip's label pulses RESOLVING, and only lines that have already appeared show there. Tap the strip mid-round: the round lands at once and nothing opens.
3. The strip, label, chip and fade match the combat v2 mock.
4. With a foe details card up (long press), the card sits above the strip and the buttons.
5. With reduced motion on, the strip shows each round complete, with no pulse and no rise.

## Self-Check: PASSED
