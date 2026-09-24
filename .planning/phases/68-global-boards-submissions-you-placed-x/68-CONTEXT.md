# Phase 68: Global Boards, Submissions & "You Placed X" - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous v2.0 run). The user accepted every recommendation in all four areas. There is no separate research pass: this phase builds on `.planning/phases/67-play-games-integration-account-chip/67-RESEARCH.md` and the 67-CONTEXT rulings D-17..D-19.

<domain>
## Phase Boundary

A signed-in, Compete-ON player's death submits real scores to the current season's global leaderboards. Offline and signed-out-but-competing deaths queue durably and flush later, with no score ever sent twice. The Leaderboards panel's ALL and FRIENDS views come alive from PGS top scores, the friends collection and the player's own rank, and LINEAGE is derived as D-19 settled. The death flow shows a ranked quip in voice. Leaderboard IDs are keyed per board per season.

**Depends on:**
- Phase 65 (the run summary: season/seed/acts/hash; `ddr.bests.v1`)
- Phase 66 (the panel and its `boardsView` seam; the row component with the handle/YOU/FRIEND styling and the "NOT IN THE TOP TEN" divider built in)
- Phase 67 (the `src/browser/playGames.js` provider with its native plugin and fake, the sign-in state, the Compete setting, and the D-17..D-19 rulings: the plugin intake, no epitaph in the tag, LINEAGE by client-side grouping)

**Not in this phase:** the privacy policy, Data Safety, the final runbook steps for leaderboard IDs, and the signed AAB (Phase 69).

</domain>

<decisions>
## Implementation Decisions

### Submissions and the offline queue (PGS-03, PGS-04)
- **D-01 — What gets submitted:** every non-dev death of a Compete-ON player submits **one score to each of the 5 current-season boards**: DEEPEST, LEANEST, LONGEST, BUTCHERY and PURSE (67 D-19). Each score carries the 64-char tag per the research encoding, versioned, with **no epitaph** (67 D-18). GRAVEYARD and LINEAGE are never submitted.
- **D-02 — The durable queue:** `ddr.pgsqueue.v1` through `mzStorage` holds the pending runs: run hash, season, the five encoded scores and the tag. A death enqueues first and then attempts a flush. The queue also flushes at launch after sign-in succeeds. Entries are deduped and acknowledged per (run hash, board), so a crash or retry never submits the same score twice. The queue is adapter- or shell-owned cross-run data, never GameState.
- **D-03 — Season bump:** a queued entry whose season is no longer the current `SEASON` is **dropped, not submitted** (old-season boards are never written again, per PGS-06). The drop is noted once in the Oracle in voice.
- **D-04 — Compete OFF:** turning Compete OFF **purges the queue**. A death while Compete is OFF is never queued. A death while signed out with Compete ON queues and flushes when sign-in returns ("signed-out-but-competing").

### Global ALL and FRIENDS views (PGS-05)
- **D-05 — ALL:** the public top 10 for the current season on the active board, using the Phase 66 row component with handles and YOU/FRIEND tags. When the player's own player-centred row falls outside the top 10, it is pinned under **"NOT IN THE TOP TEN · YOUR BEST RUN"**. The standing card uses the real rank: "3RD · of N interred worldwide", plus a quip.
- **D-06 — FRIENDS:** the PGS friends collection (the friends time-span/collection call from the research). If Play Games' friends-list consent is not granted, an in-panel note in voice offers a button that triggers the consent request. Declining leaves the note in place, with no rail and no modal.
- **D-07 — Fetching:** on panel open or a board/scope change, fetch per (board, scope, season) and cache in memory for about 5 minutes. Offline or on error, show the last cached result, or an in-voice "the world is unreachable" note when there is none. The panel never blocks: the local rows stay usable, and signed out or Compete OFF keeps the Phase 66 local views with zero network calls.
- **D-08 — Seasons in the panel:** a small **SEASON 1** label in the panel header. A picker for older seasons appears only once a second season exists; the old boards stay readable and are never written.
- **D-09 — LINEAGE global:** per 67 D-19, group a top-N DEEPEST fetch by race + class on the client. Its footnote says honestly that it is a sample (in voice).

### "You placed X" (PLACE-01, PLACE-02)
- **D-10 — Which rank:** **DEEPEST only**, the headline board. For example: "You placed 3,117th of 9,044." plus a quip.
- **D-11 — Where and when:** on THAT IS THAT, under the Phase 65 NEW PERSONAL BEST block. It fades in when the post-submit player-centred rank returns (respecting reduced motion). Nothing is shown while waiting, and nothing on failure. A signed-out or Compete-OFF run shows no rank line and no error.
- **D-12 — Runs submitted later from the queue:** one rail card in voice at the successful flush, for example "Your earlier death placed 412th on DEEPEST." When several queued runs flush at once, one card covers the best-placed run and gives the count.
- **D-13 — Quip bank:** a new `content/` bank banded by rank (1st, top 10, top 100, the rest) with `{rank}` / `{total}` tokens. The voice is deadpan and family-friendly, for example "You placed 3,117th. The 3,116 ahead of you are also dead." It must pass the safety scan.

### Seasons, IDs and score encodings (PGS-06)
- **D-14 — The ID map:** a frozen `{ [season]: { deep, lean, days, kills, purse } }` map in `content/` (for example `content/leaderboards.js`), with placeholder IDs until the user's Play Console setup (Phase 69 runbook). A missing or placeholder ID skips that board's submission silently, without a crash and without dequeueing the other boards.
- **D-15 — Season bump process:** bump `SEASON` (`content/season.js`) and add the new season's five IDs to the map. Old seasons stay in the map, read-only (panel picker only). Document this in `docs/PLAY-GAMES-SETUP.md`.
- **D-16 — Encodings (from the research):**
  - deep = floor × 1,000,000 − steps (higher is better)
  - lean = round(1000 × steps ÷ floor), minimum floor 1, on a **lower-is-better** board (a PGS single-score limit: equal rates do not favour depth, which is documented)
  - days = day × 1000 + floor
  - kills = kills × 1000 + floor
  - purse = gold

  Rows decode the displayed values from the tag, not from the score.
- **D-17 — Local-only boards:** GRAVEYARD stays local. Most Deaths and plausibility checks remain future requirements.

### Claude's Discretion
- The queue's exact record shape and flush scheduling (backoff between attempts, at most one flush in flight), the cache structure, the provider method names added for leaderboard calls, the fade styling, and the exact quip wording.
- How the rank request is sequenced after the submit, provided D-11's never-block and never-error rules hold.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/records.js`: the board ids and comparators (LEANEST by squares per floor after 66-01), `runHash`, `boardValue`.
- `content/season.js` (`SEASON`), `content/boards.js` (board copy, panel copy, standing lines, footnotes).
- `src/browser/engineAdapter.js`: `recordDeath` / `persistGrave` (the one death choke point), `takeDeathRecord()` (one-shot), the in-memory bests and graveyard.
- `src/browser/playGames.js` (Phase 67): the native provider plus the fake. This phase adds the leaderboard methods behind it (submit with tag, top scores public/friends, player-centred score/rank, friends consent). All network goes through it, and the fake drives every test.
- `src/browser/boardsView.js` / `boardsPanel.js` (Phase 66): the view seam gains a global source (scope ALL/FRIENDS rows from the cache), and the row component already supports handle/YOU/FRIEND and the divider.
- `src/browser/newBest.js` and `renderNewBestBlock` (Phase 65): the death-panel block that the rank line sits under.
- The rail (`renderRail`) is the one feedback surface for the deferred placement card.

### Established Patterns
- Cross-run persistence is fail-safe through `mzStorage`, with a per-key write queue and `track()`/`waitForPending` for the background flush (`nativeChrome.js`'s `flushOnBackground`).
- Network code is native-only and gated on Compete, with zero calls when OFF; the browser dev loop and tests use the fake provider.
- The modular shell bridge registry plus `docs/SHELL-MODULES.md`; the voice copy safety scan; HP never WP.

### Integration Points
- The death choke point → enqueue, then flush → provider submit ×5 → player-centred rank → the death-panel rank line, or a rail card for a later flush.
- Boot, after sign-in → flush the queue.
- The panel open → the global fetch through the provider, through the cache, into `boardsView`.
- Compete OFF → purge the queue (the settings change handler from Phase 67).

</code_context>

<specifics>
## Specific Ideas

- The tag format comes from the research: `v1.race.sub.lvl.cause.floor.day.steps.kills.gold.sp.name`, in the RFC 3986 unreserved charset, with names truncated as full → "First L." → a hard-truncated first name. Decoding is tolerant: an unknown version or a malformed tag renders a minimal row (the handle plus the value) instead of crashing.
- The expand row for a global run shows the cause line (from the cause code, through the existing `CAUSE_TEXT`) and the six stat chips, without an epitaph.

</specifics>

<deferred>
## Deferred Ideas

- Achievements, Most Deaths as a global board, and plausibility checks → future milestone.
- Tombstone share → a later milestone.

</deferred>
