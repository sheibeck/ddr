---
phase: 68-global-boards-submissions-you-placed-x
status: passed
verified: 2026-09-24
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 6/6 requirements
human_verification:
  - "CONSOLE (user): create the five Season-1 leaderboards per docs/PLAY-GAMES-SETUP.md section 7 (only LEANEST is Smaller is better; tamper protection on), paste the IDs into content/leaderboards.js LEADERBOARD_IDS[1], rebuild"
  - "After console setup, a tester death appears on all five boards with its v1 tag visible in the console score view"
  - "Signed in, Compete ON, die: 'You placed Nth of M.' + quip appears under NEW PERSONAL BEST (or the panel line) and fades in once; with Android remove-animations on, it appears without the fade"
  - "A run that did not beat your best shows the standing line ('your best still holds …'), never a claim that this run placed"
  - "Die in airplane mode, force-close, relaunch online: the run lands exactly once on each board, and one THE LEDGER CAUGHT UP rail card appears once the map shows (never over title/roller, after any account card; holds ~12s)"
  - "Die offline so the death queues, turn Compete OFF, go online, turn Compete ON: nothing from that death is ever submitted"
  - "(Optional) Compete ON but signed out, die, then sign in: the queued run submits right after sign-in"
  - "Compete OFF, die: no rank line, no card, no error, no leaderboard traffic (capture)"
  - "Leaderboards ALL on DEEPEST: rows show handles + initials avatars, adventurer name, RACE SUB · LVL n, value + unit; expand shows cause + six chips, no epitaph; YOU/FRIEND tags fit beside a long handle"
  - "Outside the top ten: NOT IN THE TOP TEN · YOUR BEST RUN pinned last; standing card '3RD · of N interred worldwide.' + quip fits without clipping"
  - "ALL fills within a few seconds while local rows stay usable; in airplane mode a fetched board shows its last result and an unfetched one shows the unreachable note; nothing blocks"
  - "FRIENDS on a fresh account: consent note + SHOW MY FRIENDS button; the Play Games consent screen appears only after the tap; declining leaves the note (no modal, no rail card)"
  - "LINEAGE on ALL shows grouped race+class rows and the sampled footnote; the SEASON label fits beside INTERRED"
  - "Signed out or Compete OFF: ALL/FRIENDS show the Phase 66 notes and nothing else changes"
  - "Voice read at default and largest text sizes: rank quips, the ledger card (one/many), the season-drop Oracle line, and the panel's loading/unreachable/consent/sampled notes"
  - "Browser dev loop: pgsDevSignedIn on, relaunch — a death shows the rank line and ALL shows dev-board rows"
---

# Phase 68: Global Boards, Submissions & "You Placed X" — Verification

**Verdict:** passed on automated evidence. The device and console checks above are deferred to the milestone's batched Pixel 7 checklist (Phase 69, `docs/UAT-v2.0.md`) per the deferred-UAT protocol. Until the user creates the leaderboards and replaces the placeholder IDs, a native build submits nothing: deaths stay queued (capped at 50) and the global views say the board "has not opened yet".

## Requirement coverage

| Req | Evidence (plans) | Status |
|-----|------------------|--------|
| PGS-03 | Every non-dev Compete-ON death submits one score to each of the five current-season boards with the 64-char v1 tag and no epitaph (68-01 `scoreTag.js`, `boardScores.js` D-16 formulas; 68-02 `submitScore`; 68-04 `setRunRecordedListener` at the adapter's death choke point; 68-07 shell wiring); `scoreTag.test.js` (27), `boardScores.test.js` (25), `adapter-run-listener.test.js` (9), `shell-pgs.test.js` (40) | ✓ |
| PGS-04 | Durable `ddr.pgsqueue.v1` queue through `mzStorage`, written before any send; per-(run hash, board) ack stored before the next board, done ledger, so no score is sent twice; single-flight flush with backoff (30 s … 600 s); flush on sign-in, reconnect and resume; Compete OFF purges; background flush waits on the queue (68-04, 68-07); `pgsQueue.test.js` (29), `pgsQueue-flush.test.js` (33) | ✓ (device offline round-trip deferred) |
| PGS-05 | ALL/FRIENDS from the provider's top-scores, friends collection and player standing; 5-minute cache, stale-on-error, unreachable note, consent note with the only interactive request behind a button; LINEAGE grouped client-side from a 25-score DEEPEST sample (plugin cap); zero calls while signed out or Compete OFF (68-02, 68-05, 68-06, 68-07); `globalBoards.test.js` (42), `playGames.test.js` (69), `boardsView`/`boardsPanel` suites | ✓ |
| PGS-06 | Frozen per-season ID map with placeholder IDs and a gate test that fails when `SEASON` has no entry; old-season queue entries dropped unsent with one Oracle line; SEASON label + read-only picker from the second season; season-bump procedure in the runbook (68-01, 68-04, 68-06, 68-07) | ✓ |
| PLACE-01 | DEEPEST rank line on THAT IS THAT through `window.__mzPlacement`, textContent only, one 600 ms fade removed under reduced motion; nothing shown while waiting or on failure; standing band when the run did not beat the player's best (68-03 `placement.js`, 68-07 `renderRankLine`) | ✓ (device look deferred) |
| PLACE-02 | Runs submitted later from the queue fold into one "THE LEDGER CAUGHT UP" rail card, held until the map is visible and after any account card; quip bank banded 1st / top 10 / top 100 / the rest / standing, passing the voice safety and HP-not-WP scans (68-03, 68-07); `placement.test.js` (22), `placement-copy.test.js` (14) | ✓ |

## Automated gates

- Full `npm test` on master after the final merge (2ad5b28): **5023/5024 pass**. The one failure is `sfx-assets.test.js` AUD-06, caused by the user's untracked `sfx/theme.mp3` (tracked in the theme-music todo), not by Phase 68 code.
- `node tools/bridge-doc.mjs --check` passes on the committed content. On master's working copy it reports a mismatch only because `core.autocrlf=true` checks `docs/SHELL-MODULES.md` out with CRLF; the file is byte-identical to HEAD once `\r` is stripped. This is the same known CRLF artifact as the worktree doc-ledger failures, and the standing `.gitattributes eol=lf` follow-up would remove it.
- Engine gate: `engine/` and `test/parity/prototype-master.js.txt` untouched; parity passes; no fixtures moved. The only adapter change is the run-recorded listener in `src/browser/engineAdapter.js`.
- Decision coverage 17/17 at plan time; requirements 6/6.

## Rulings and deviations worth carrying forward

- Planner rulings: the rank line says "your best still holds Nth of M" when a run did not beat the player's best (PGS keeps only the best score); LINEAGE samples 25 (the plugin's cap, no paging); the tag's name budget is 16 characters.
- 68-07: the ledger card also waits while the party is dead (the rail is hidden under THAT IS THAT), and `showTitleScreen` resets the live-death hash so a late rank never lands on a later panel.
- 68-04: `purge()` takes effect at call time, and `enqueue` re-checks Compete after load, so nothing queued before Compete OFF can be written back.
- 68-06: an empty ready board shows the empty note with no pinned row; a ready snapshot with `you: null` falls back to the listed YOU entry for the standing card.
- 68-07 updated two Phase 67 pins in `shell-account.test.js` (provider line with `orders`, the `pendingPgsCard` slot).
