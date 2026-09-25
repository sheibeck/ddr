# Phase 81 Plan 01: Root-Cause Debug Session

Debug-first, fix-after (CONTEXT: "Plan 1 is a root-cause session"). This
document is built in three passes by Plan 01's three tasks: Task 1 writes
`## R-15`, Task 2 writes `## R-09`, `## R-10`, `## R-16a`, `## R-16b`,
`## R-16c` and `## Assumption delta`, and Task 3 prepends `## Root causes`,
`## Fix routing` and `## Device session`. No production code is touched by
any of the three tasks — every finding here is pinned by a test in
`test/unit/board-death-paths.test.js` or `test/unit/board-global-trace.test.js`.

## R-15

**Symptom (device, 2026-09-25):** a depth-10 run showed in the Graveyard but
not on the player's own DEEPEST board, above their depth-9 run.

**Method:** `test/unit/board-death-paths.test.js` drives six death paths
(combat, trap, starvation, abandon, a resumed save, a relaunch after death)
through the real `src/browser/engineAdapter.js` `dispatch()` choke point —
never `engine/death.js#die()` directly — each seeding a depth-9 run first,
then a depth-10 run, and asserting DEEPEST order, every other `RANKED_BOARDS`
board the depth-10 run strictly beats, `ddr.bests.v1` byte-equality with the
in-memory record, and agreement with the graveyard's newest stone. **All
eight tests in that file pass — no local-recording defect was reproduced at
the engine/adapter layer.**

| Hypothesis | Evidence | Test / citation | Verdict |
| --- | --- | --- | --- |
| H-15a: a death that never reaches `dispatch()`'s `died` branch | `engine/death.js:120-147` `die()` is the ONE terminator every death cause (combat, trap, starve, fall, gorge, abandon, entombed, ...) funnels through, and it unconditionally pushes a `died` event; `src/browser/engineAdapter.js:646` `const diedEvent = events.find((e) => e.type === "died")` is the one choke point that catches every one of them regardless of which rule module called `die()` (mirrors the CR-01 rationale already recorded in that file's own header comment). | All six path tests in `board-death-paths.test.js` (each drives a *different* `die()` call site and each correctly records) | RULED OUT |
| H-15b: `recordDeath` throws, so the summary is null, and `bury()` still writes the grave while the bests record and the run-recorded listener are skipped | `src/browser/engineAdapter.js:398-426` `recordDeath` wraps `buildRunSummary` in try/catch; on a thrown summary it returns `{ summary: null, bestsJson: null }`. `persistGrave` (`:448-519`) calls `bury()` (`:479`) UNCONDITIONALLY — `bury()` computes its own independent `buildRunSummary` call, so the grave write does not depend on `recordDeath`'s summary at all — while `notifyRunRecorded` (`:155-165`) and the bests write (`:505`, gated `if (bestsJson !== null)`) are both no-ops when `summary` is null. This is already the CORRECT defensive behavior the code documents (`recordDeath`'s own doc comment: "a failure here can never reach dispatch()'s fail-closed catch... the death panel and the graveyard write must both survive a bug in this path"), not a bug — and `buildRunSummary` (`engine/death.js:70-94`) has no code path that throws on a well-formed `state` (every field read is a plain property access with safe fallbacks), so this is not reproducible without corrupting live state in a way no death path in this game can produce. | Code citation only — not exercised (unreachable under a well-formed state) | RULED OUT |
| H-15c: `bests` still null at the death (the lazy `persistGrave` path) | `src/browser/engineAdapter.js:450-461`'s lazy branch (`if (summary && bestsJson === null) { await loadBests(); ... }`) is exercised end-to-end by the pre-existing `test/unit/bests-adapter.test.js` "lazy path: a death before loadBests()/boot() is ever called..." test (first test in that file, fresh module state) — it passes, proving the lazy fallback correctly backfills AND folds the new death. Every path test in THIS file calls `loadBests()`/`loadGraveyard()` before its first death, so `bests` is never null on a real device (boot() always awaits `loadBests()` before the title screen can be reached). | `test/unit/bests-adapter.test.js` (existing, cited) | RULED OUT |
| H-15d: a hash dedupe collision on `rec.last`/`rec.runs` | `engine/records.js:315-362` `updateBests` — `if (rec.last === hash \|\| rec.runs[hash]) return { record: rec, newBests: [], first: false }` is a deliberate, correct no-op for a REPLAYED identical hash (the same run folded twice), not a collision bug — two DIFFERENT runs producing the same 8-hex FNV-1a hash is a (very) different, unrelated risk this session did not find evidence of on a real device (the hash covers 15 fields including `seed`/`acts`/`when`-independent state). | `board-death-paths.test.js` "extra pin (H-15d)" | RULED OUT |
| H-15e: `prune` dropping the new run | `engine/records.js:216-236` `prune` keeps every hash referenced by a `RANKED_BOARDS` list PLUS each lineage's top `BOARD_TOP_N` (10) runs. A device player with only a handful of held runs (the reported case: one depth-9 run plus the new depth-10 one) is nowhere near this ceiling, so `prune` cannot be dropping the reported run — it only ever discards runs that are provably outside the visible top ten of every board AND every lineage, by design. | Code citation only — the six path tests each hold only 2 runs, well under the cap | RULED OUT (for the reported scale) |
| H-15f: the `ddr.bests.v1` write being lost while the `ddr.graveyard.v1` write persisted — write order, the storage degrade path, and `getItem` not queued behind writes | `persistGrave` (`engineAdapter.js:448-519`) issues FOUR independent `storage.setItem` calls in one `Promise.all` (`:500-505`: `GRAVE_KEY`, `GRAVE_TOTAL_KEY`, `RECENT_NAMES_KEY`, and — only `if (bestsJson !== null)` — `BESTS_KEY`). `src/browser/storage.js:67-69`'s per-key `writeQueues` Map guarantees ordering ONLY *within* one key; there is NO cross-key atomicity — nothing ties the `BESTS_KEY` write's completion to the `GRAVE_KEY` write's completion. On Android, `@capacitor/preferences`' native bridge call for one key can still be in flight when the WebView process is suspended/killed (a backgrounding event that the OS does not always run a JS lifecycle callback for first — `flushOnBackground` in `src/browser/nativeChrome.js` only runs on an OBSERVED pause event, never on an OS-forced low-memory kill), while a *different* key's own bridge call that started fractionally earlier already completed. This trigger condition (an OS-level process suspension mid-`Promise.all`, between two independently-scheduled native Preferences calls) cannot be reproduced in `node --test` (no native bridge, no process suspension) — device-only to trigger — but the code-level asymmetry (the bests write depends on nothing the graveyard write doesn't also depend on, yet they are NOT bundled as one atomic write) is real, and is the most evidence-consistent explanation for "shown in the Graveyard but not on DEEPEST" specifically (the graveyard write for this exact death landed; the bests write for the very same death did not). | Code citation (`engineAdapter.js:500-505`, `storage.js:67-69`) | CONFIRMED |
| H-15g: `sanitizeBests` on reload dropping the run | `engine/records.js:263-301` `sanitizeBests` keeps every `runs` entry whose key matches `HASH_RE` (8 lowercase hex) and whose own `value.hash === key`; a correctly-written record (every entry in `board-death-paths.test.js` satisfies both) round-trips byte-identically. Directly pinned by this file's "relaunch-after-death" and "device sequence" tests (`boot()` reload after a flushed write), and by the existing `test/unit/bests-adapter.test.js` "boot with an existing valid ddr.bests.v1 loads it via sanitizeBests" test. | `board-death-paths.test.js` relaunch/device-sequence tests; `bests-adapter.test.js` (existing, cited) | RULED OUT |
| H-15-view: the player was looking at ALL while believing it was their own board; the hidden local scope and the un-invalidated global cache | `src/browser/boardsPanel.js:785-789` `onScope(id) { scope = scope === id ? "local" : id; ... }` — the hidden `"local"` scope is reached ONLY by re-tapping the currently-active chip; it survives a board switch within the same panel session (`onBoard` only resets `board`/`open`, never `scope`) because nothing re-defaults `scope` on a board change. `openFromTab()` (`:842-851`) DOES reset `scope = "local"` on every fresh open from the tab, and `openFromTitle()` (`:853+`) does the same — so this can only mislead a player mid-session (switch to ALL, then switch boards without noticing they never switched back), not across a fresh open of the panel. Separately, `src/browser/globalBoards.js:41` `GLOBAL_TTL_MS` (5 minutes) caches an ALL/FRIENDS snapshot with no invalidation hook tied to the player's own submission (see `## R-16b` below) — but this is a GLOBAL-scope staleness, not a local (ME/DEEPEST) one, and cannot explain "the Graveyard shows it but DEEPEST does not" since both boards read the SAME synchronous `getBests()`/`getGraveyard()` in-memory snapshot with no cache or TTL of their own (`mazeworld.html:6326-6329` `readBoardsData()`). This hypothesis is a plausible confound for a DIFFERENT symptom (a player confused about which scope/board they are viewing) — real UX risk, tracked separately under BOARD-11/12 (81-04) — but does not fit the specific "Graveyard yes, DEEPEST no" report. | Code citation only (prose, no panel test — per the plan's own instruction; 81-04 rewrites this controller) | RULED OUT |

**R-15 verdict:** No engine/adapter-layer defect reproduces the reported
symptom — every one of the six real death paths, replayed dedup, and a
storage-backed relaunch all correctly rank a depth-10 run above a depth-9 one
on every board it beats. The single evidence-consistent explanation is
**H-15f**: `ddr.bests.v1` and `ddr.graveyard.v1` are written as four
INDEPENDENT `storage.setItem` calls with no cross-key atomicity, so an
Android process suspension between two of those native bridge calls can let
the graveyard write land while the bests write for the SAME death is lost —
device-only to trigger, impossible to force in `node --test`. Routed to
81-05 as a defensive **boot-time reconciliation** (`reconcileBests(record,
graves)`, already scoped in `81-05-PLAN.md`): on every boot, fold any
graveyard stone whose hash the bests record does not hold back in — a
backstop that fixes the reported symptom regardless of which of H-15f's exact
triggers actually fired on the device, and costs nothing when the two stores
already agree (the common case, per every test in this file).

## R-09

**Symptom (device, 2026-09-25):** the friend's own #1 entry showed the tag
"Friend", never "YOU", on his own device.

**Root cause (CONFIRMED):** `src/browser/globalBoards.js:76-91` `toGlobalEntry`
marks a row `you` only when `s.playerId !== "" && s.playerId === me`, and that
`playerId` comes from `normalizeScore` (`src/browser/playGames.js:169-180`)
reading `s.scoreHolder.playerId` — but `scoreHolder` itself is an OPTIONAL
field the plugin's Kotlin serializer OMITS (never sends as `null`, simply
absent) whenever Play Games reports none:
`LeaderboardsModule.kt:159 putIfPresent("scoreHolder", scoreHolder?.toJsObject())`.
A public/friends top-scores row with no `scoreHolder` therefore ALWAYS
decodes to `playerId: ""`, which can never equal the account's own non-empty
id — even when the row genuinely IS the signed-in player's own entry. Pinned
by both invariant tests in `test/unit/board-global-trace.test.js` (payload
shape (i): no `scoreHolder` at all; shape (ii): a `scoreHolder.playerId` that
differs from the account id while `loadCurrentPlayerScore`'s OWN result for
the same board carries the identical rank/rawScore/scoreTag) — both `todo`,
both fail today (`youRows.length` is 0, not 1).

**Fix direction (routed to 81-06, per `81-06-PLAN.md`'s own truths):** YOU is
keyed on the player's own leaderboard score record (`loadPlayerScore`'s
result for the SAME board/collection/allTime span) — when a row and that
record both carry a `playerId`, the ids decide; when either is empty, the
SAME rank + the SAME raw score + the SAME score tag decide (all three, exact,
no rounding); the account id alone is only the last-resort fallback.

## R-10

**Symptom (device, 2026-09-25):** the friend's sole entry (rank #1) was shown
twice — once in the ranked list, once again under "NOT IN THE TOP TEN · YOUR
BEST RUN".

**Root cause (CONFIRMED — a direct consequence of R-09, not a second, separate
bug):** `src/browser/boardsView.js:555-561` `buildGlobalRows` only skips
pinning `snap.you` a second time when `snap.entries.some((e) => e.you ===
true)` is already true. Because R-09's `playerId` mismatch means the listed
row's `you` flag is `false` even for the player's own entry, this condition
is NEVER satisfied for an affected row, so the SAME entry is rendered twice:
once as an ordinary (un-tagged) listed row, once again as the pinned "YOU"
row under the divider. Pinned by the `todo` "R-10 shown-twice" test in
`test/unit/board-global-trace.test.js`, which feeds the exact R-09 shape (i)
snapshot into `boardsView` and asserts the rendered row count is 1 — it is 2
today.

**Fix direction (routed to 81-06, same file, same `you` fix as R-09):** once
`toGlobalEntry`/the entries pass correctly resolve `you` for the player's own
listed row (R-09's fix), `buildGlobalRows`'s existing "already listed" check
works unmodified — no separate R-10 code change is needed beyond R-09's own.

## R-16a

**Symptom (device, 2026-09-25):** the friend's depth-11 DEEPEST score never
reached the user's ALL board at all (not merely displayed wrong).

**Confirmed defects, both pinned as `todo` tests in
`test/unit/board-global-trace.test.js`:**

1. **The queue wedge.** `src/browser/pgsQueue.js:373-419` `run()`'s
   `outer: for (const hash of hashes) { for (const board of SUBMIT_BOARDS) {
   ... if (!res || res.ok !== true) { ...; break outer; } ... } }` — the
   `break outer` on the FIRST failed board submission of the FIRST queued run
   exits BOTH loops, abandoning every later run's submissions entirely for
   this flush. Because the failed entry stays first (un-acked, un-removed)
   and `hashes` is recomputed fresh from `queue.entries` on every flush, the
   SAME run blocks the SAME later run on every subsequent retry too — a
   single permanently-rejected board (a stale/placeholder id, a
   server-side rejection, ...) on entry #1 permanently wedges every entry
   queued after it, forever. Pinned: "R-16a queue wedge" — fails today
   (`state.pending` still includes the second run's hash after four
   repeated forced flushes).
2. **Every score encoding and routing check passes** (not a defect): DEEPEST
   scores stay safe integers in strict floor order under worst-case adversarial
   steps assignment (a depth-9 run at the steps cap still ranks below a
   depth-10 run at zero steps); a 40+-character worst-case name with
   apostrophes, an accented letter and a hyphen still encodes to a tag inside
   the shared `A-Za-z0-9._~-`, ≤64-character alphabet both `pgsQueue.js`'s
   `TAG_RE` and `playGames.js`'s `TAG_OK` accept; `submitScore` is routed to
   the exact Season-1 DEEPEST id (`content/leaderboards.js` `LEADERBOARD_IDS[1].deep`,
   `CgkIlvbN0YYPEAIQAg`). None of these are the cause.

**Fix direction (routed to 81-06):** `pgsQueue.js#run()` must not let one
run's failed board abort every OTHER run's submissions in the same flush —
only that one run's remaining boards (and only for THAT run) should be
deferred to the next flush.

## R-16b

**Symptom (device, 2026-09-25):** the friend saw the user's depth-9 entry,
but the user could not see the friend's newer depth-11 entry — consistent
with the user's client simply never re-fetching after the friend's score
landed.

**Confirmed defects, both pinned as `todo` tests:**

1. **`forceReload` is hard-coded `false`, with no way to override it.**
   `src/browser/playGames.js:362-382` `loadTopScores` calls
   `PlayGames.loadTopScores({ ..., forceReload: false })` unconditionally —
   the function's own options destructure (`{ leaderboardId, collection,
   maxResults }`) does not even accept a `forceReload` field, so no caller
   anywhere in the stack can ask Play Games to bypass ITS OWN cache. Pinned:
   "R-16b forceReload" — fails today (the recorded plugin call's
   `forceReload` is `false`, never `true`).
2. **`createGlobalBoards`'s cache has no invalidation hook tied to the
   player's own submission or a panel reopen.** `src/browser/globalBoards.js:41`
   `GLOBAL_TTL_MS` (300000 ms, 5 minutes) serves a cached snapshot for the
   whole window; the only mutator is `clear()` (`:303-306`), which wipes
   EVERY board/scope/season at once and is called from exactly two sites —
   `mazeworld.html:7151` and `:7155`, both inside `onAccountForPgs`, fired
   ONLY on a Compete-off toggle or a sign-out transition. `mazeworld.html:7104-7108`
   `onRunRecorded` (the death → queue-enqueue path) and
   `boardsPanel.js:842-851` `openFromTab`/`openFromTitle` (a fresh panel
   open) never call `clear()` or anything narrower. Pinned: "R-16b cache
   invalidation" — fails today (`view()` still returns 0 entries immediately
   after a successful `submitScore()` that added exactly one).

**Fix direction (routed to 81-06):** either a `forceReload: true` option
`loadTopScores`/`view()` can pass through the first read after a submission
or panel reopen, or a per-key `invalidate({ board, scope, season })` method
on the `createGlobalBoards` controller (narrower than today's whole-cache
`clear()`) that the queue's `onFlushed` and the panel's open path both call.

## R-16c

**Symptom (device, 2026-09-25):** "not in the top ten" was shown for the
friend even though he should have ranked #1 among the two visible players.

**Google's own rule** (https://developer.android.com/games/pgs/leaderboards,
read 2026-09-24): *"If your player has not chosen to share their gameplay
activity publicly, they won't appear in this leaderboard."* This is a
DIFFERENT situation from a player who IS ranked, merely outside the visible
top ten — the withheld case carries no rank at all
(`LeaderboardVariant.playerRank`'s sentinel is OMITTED by
`putUnlessSentinel`, `LeaderboardsModule.kt:142`), decoding to `rank: null`
via `rankOf` (`playGames.js:142-144`) and `globalBoards.js:76-91`'s
`toGlobalEntry`.

**Confirmed defect (pinned, `todo`):** `src/browser/boardsView.js:508-533`
`globalRow`'s pinned-row branch and `boardsView.js:654-669`
`buildGlobalStanding` both treat a `rank: null` "you" record IDENTICALLY to
a `rank: 47`-style genuinely-ranked-but-off-list record — both pin under the
exact same `BOARDS_PANEL_COPY.divider` string, `"NOT IN THE TOP TEN · YOUR
BEST RUN"` (`content/boards.js:164`). The UI cannot distinguish "you have a
rank, it's just not on this page" from "Play Games will not compute a rank
for you at all because you haven't opted into public sharing" — both read as
the same honest-sounding but, for the withheld case, subtly misleading
sentence. Pinned: "R-16c public visibility" — fails today (`withheldRow.divider
=== rankedRow.divider`).

**This is a real, but narrower, contributing defect** — it explains the
COPY the friend saw, not necessarily why his score was missing from the
list in the first place (that is better explained by R-16a's queue wedge,
or R-16b's stale cache, either of which independently explains "his score
never reached the user's device at all"). All three are routed to 81-06.

## Assumption delta

**Question:** is the signed-in id from the same API family as the score
rows' ids?

**Answer: CONFIRMED — yes, same family, but the row-level id is frequently
ABSENT, not merely differently-shaped.**

- The account id comes from `PlayersClient.getCurrentPlayer()` via the
  sign-in result: `SignInModule.kt:70-82` `resolveWithPlayer` calls
  `plugin.players.currentPlayer()` and serializes it with
  `Pgs.kt:215-217` `Player.toJsObject()`, which `put("playerId", playerId)`
  UNCONDITIONALLY (never `putIfPresent` — always present when signed in).
- The row ids come from `LeaderboardScore.getScoreHolder().getPlayerId()`,
  the SAME underlying Play Games player id family, but
  `LeaderboardsModule.kt:159` serializes it with `putIfPresent("scoreHolder",
  scoreHolder?.toJsObject())` — OMITTED, not `null` and not a differently-typed
  id, whenever Play Games reports no score holder for that row (which its own
  documentation and this session's Kotlin read both indicate happens for
  privacy/visibility reasons independent of whether the row is the caller's
  own).
- `globalBoards.js:211` (`const me = meId() || (mine ? str(mine.playerId) :
  "")`) already prefers the account id over the player's own record's id when
  computing the STANDALONE "you" snapshot object — but this preference is
  NEVER applied to the LISTED rows in `top.scores`, which is exactly the gap
  R-09 pins.

**81-06's `assumption_delta_decision` (primary noun: the player's own
leaderboard score record, decision: promote) is CONFIRMED** by this session's
evidence: the fix belongs on the LISTED-rows path (matching a row to the
player's own record — `loadPlayerScore`'s result — by id when both carry one,
else by rank+rawScore+tag), not on the account-id path (which was already
correct and is not the gap).

## Device session

**Decision: Device session NOT NEEDED.**

Every root cause this session found (R-09, R-10, R-16a, R-16b, R-16c) is
CONFIRMED by reading the vendored plugin's Kotlin source
(`node_modules/@modbender/capacitor-play-games/android/.../{Pgs,LeaderboardsModule,SignInModule}.kt`)
alongside this repo's own JS, and each is independently reproduced by a
failing `node --test` pin — no two of them have mutually exclusive fixes (all
five route to the same `src/browser/globalBoards.js`/`playGames.js`/
`boardsView.js`/`pgsQueue.js` family in 81-06, and R-10's fix IS R-09's fix).
R-15's single leading hypothesis (H-15f) is device-only to trigger by its
very nature (an OS process suspension mid-write), but its fix
(`reconcileBests` boot-time reconciliation) is correct and cheap regardless
of confirming the exact trigger on a device — a device session could not add
evidence a code read plus a passing/failing test pin does not already give.

Per the plan's own ESSENTIAL test (two or more surviving explanations whose
fixes are mutually exclusive, with no code/plugin-source/Google-doc evidence
separating them): that condition never held for any R-id this session
examined. Confirmation instead happens where the plan's own fallback says it
should: the post-phase Play internal-testing push the orchestrator offers
(ask-first rule, `docs/RELEASING.md`), and the milestone-close two-device
checklist (user + friend, both signed in) 81-06 adds as a human check.
