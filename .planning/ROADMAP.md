# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (shipped 2026-09-16, device UAT batch closed; see `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.4 Combat & Map Screens** — Phases 34–35 (shipped 2026-09-16, device round closed 2026-09-17; see `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.5 Meaningful Choices — Spells, Gear & Abilities** — Phases 36–43 (code-complete 2026-09-18, archived 2026-09-19; 140-check Pixel 7 UAT batch pending on its own track against a post-quick-task debug APK; see `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-MILESTONE-AUDIT.md`)
- ✅ **v1.6 Shell Debt & Dead Code** — Phases 44–49 (code-complete 2026-09-20, archived 2026-09-20; 26-check Pixel 7 UAT batch + the v1.5 140-check batch pending on APK `c0cdbae`; see `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve** — Phases 50–55 (code-complete 2026-09-22, archived 2026-09-22, override closeout; the four-run DR checklist + 25-item Pixel 7 batch `docs/UAT-v1.7.md` deferred by the user, as are the v1.6 26-check and v1.5 140-check batches; see `.planning/milestones/v1.7-ROADMAP.md`, `.planning/milestones/v1.7-MILESTONE-AUDIT.md`)
- ✅ **v1.8 Sound, Motion & Set Dressing** — Phases 56–60 (code-complete 2026-09-22, archived 2026-09-22, verified closeout; 30 of 31 Pixel 7 checks in `docs/UAT-v1.8.md` spread over the user's play sessions; see `.planning/milestones/v1.8-ROADMAP.md`, `.planning/milestones/v1.8-MILESTONE-AUDIT.md`)
- ✅ **v1.9 The Gear Screen** — Phases 61–64 (code-complete 2026-09-23; override closeout: GSCR-12 device batch partial) → `.planning/milestones/v1.9-ROADMAP.md`
- ✅ **v2.0 Leaderboards** — Phases 65–71 (shipped 2026-09-24 as Play 2.0.0 / vc10; override closeout: 38/38 requirements, 7/7 phases passed, 142-row Pixel 7 batch `docs/UAT-v2.0.md` spread over the user's play sessions) → `.planning/milestones/v2.0-ROADMAP.md`
- ✅ **v2.1 Bug Fixes** — Phases 72–81, incl. 75.1–75.3 and 79.1–79.3 (shipped 2026-09-28 as Play 2.1.0 / vc11 to closed testing; override closeout: 68/68 requirements, 16/16 phases passed, audit tech_debt; UAT batch `docs/UAT-v2.1.md`, 80-05 emulator pass deferred) → `.planning/milestones/v2.1-ROADMAP.md`
- 🚧 **v2.2 Our Own Leaderboards** — Phases 82–86 (started 2026-09-28; promoted from backlog 999.13)
- 📋 **v1.0 launch tail** — first-run tutorial (UX-06, rebuilt on the v1.6 modular shell) + Google Play production launch (STR-01..04, STR-06)

## Phases

### v2.2 Our Own Leaderboards (Phases 82–86) — IN PROGRESS

- [x] **Phase 82: DAYS Farming Check** - Measure whether floor-1 farming out-DAYS an honest descending run and settle the DAYS ranking rule. (completed 2026-09-28)
- [ ] **Phase 83: Leaderboard Server** - Stand up our own Firebase-hosted run table, rules, indexes, identity and queue, proven end to end.
- [ ] **Phase 84: Leaderboards Panel v3** - Rebuild the DEAD tab and VIEW THE DEAD to the v3 mock, ranked by four stats with RACE/SUB-CLASS filters.
- [ ] **Phase 85: Play Games Out, Our Board In** - Remove Play Games entirely and route every Compete-ON death to our own board.
- [ ] **Phase 86: Compliance & Device Close** - Reconcile store, policy and website text and batch the milestone's device checks.

<details>
<summary>✅ v2.1 Bug Fixes (Phases 72–81) — SHIPPED 2026-09-28</summary>

- [x] Phase 72: Roll-Direction Sign Audit & Fixes (7/7 plans) — completed 2026-09-24
- [x] Phase 73: Engine Roll-High Mirror (10/10 plans) — completed 2026-09-25
- [x] Phase 74: Roll Display & Modifier Honesty (8/8 plans) — completed 2026-09-25
- [x] Phase 75: Engine Rules — Character, Economy, Grimoire & Combat Bugs (13/13 plans) — completed 2026-09-25
- [x] Phase 75.1: Pilfer Fumbles & Scroll Reading (9/9 plans) — completed 2026-09-26
- [x] Phase 75.2: Hero Size Matters (5/5 plans) — completed 2026-09-26
- [x] Phase 75.3: Deep-Floor Encounter Scaling (6/6 plans) — completed 2026-09-26
- [x] Phase 76: Darkness Unification & Relaunch Persistence (6/6 plans) — completed 2026-09-26
- [x] Phase 77: Combat Screen & Oracle Readability (8/8 plans) — completed 2026-09-26
- [x] Phase 78: HUD, Dead State & Climb Decisions (9/9 plans) — completed 2026-09-27
- [x] Phase 79: Content & Narrative Pass (15/13 plans) — completed 2026-09-27
- [x] Phase 79.1: Milestone Balance Check & Deep-Floor Tuning (4/4 plans) — completed 2026-09-28
- [x] Phase 79.2: Early-floor difficulty retune (4/4 plans) — completed 2026-09-28
- [x] Phase 79.3: In-app bug reports and patch notes (8/8 plans) — completed 2026-09-28
- [x] Phase 80: Android Release Build & Tooling (6/6 plans) — completed 2026-09-28
- [x] Phase 81: Leaderboards Panel Fixes (6/6 plans) — completed 2026-09-25

80-05 (the emulator pass) was deferred by the user until the features are in. Full details: `.planning/milestones/v2.1-ROADMAP.md`.

</details>

<details>
<summary>✅ v2.0 Leaderboards (Phases 65–71) — SHIPPED 2026-09-24</summary>

- [x] Phase 65: Run Record & Personal Bests (5/5 plans) — completed 2026-09-23
- [x] Phase 66: Leaderboards Panel — Local (7/7 plans) — completed 2026-09-23
- [x] Phase 67: Play Games Integration & Account Chip (8/8 plans) — completed 2026-09-24
- [x] Phase 68: Global Boards, Submissions & "You Placed X" (7/7 plans) — completed 2026-09-24
- [x] Phase 69: Compliance & Device Close (4/4 plans) — completed 2026-09-24
- [x] Phase 70: Device-Round Polish (4/4 plans) — completed 2026-09-24
- [x] Phase 71: Device-Round Polish II (8/8 plans) — completed 2026-09-24

Full details: `.planning/milestones/v2.0-ROADMAP.md`.

</details>

## Phase Details

### Phase 82: DAYS Farming Check

**Goal**: Know whether a hero who never leaves floor 1 can farm the DAYS board, and settle the DAYS ranking rule before the server is built.
**Depends on**: Nothing (first phase of v2.2; tooling + a doc only — a scripted floor-1 farmer bot policy in `tools/`, results recorded in a `docs/` ledger; engine untouched, zero parity fixtures). This is a one-off exploit measurement, not a balance/fit run: the engine does not change this milestone, so running it first measures the final rules and its verdict shapes SRV-03's DAYS key. Discuss with the user if farming wins.
**Requirements**: FARM-01, FARM-02
**Success Criteria** (what must be TRUE):

  1. A scripted floor-1 farmer bot policy (in `tools/`) plays camp/rest/fight/buy/find-food loops across multiple seeds and classes without ever descending, touching no engine or content bytes.
  2. The DAYS banked by floor-1 farming is measured and recorded in a `docs/` ledger alongside the DAYS from honest descending runs, so the two are directly comparable.
  3. The user has reviewed the comparison and recorded a verdict: either DAYS ranks as the mock already shows (days, then floor), or a specific rule that stops the exploit is chosen and recorded.
  4. The recorded verdict is stated in terms Phase 83 can consume directly as SRV-03's DAYS ranking key.

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 82-01-PLAN.md — Farmer tooling: opt-in playRun policy/stopWhen hook (readouts byte-identical), noStairs + hoarder farmer policy, classification, mechanical farmVerdict + DAYS_RULES, tools/days-farm.mjs CLI (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 82-02-PLAN.md — One 200-seed measurement (floors 1 and 2 + honest baseline), docs/DAYS-FARMING.md ledger with the verdict and `## The DAYS rule`, ledger guard test (wave 2)

### Phase 83: Leaderboard Server

**Goal**: Our own board is live on Firebase (Firestore run table, rules, indexes, anonymous identity, rolled handles, a durable queue, admin script, runbook) and proven end to end, with no Firebase SDK in the app.
**Depends on**: Phase 82 (the DAYS ranking rule feeds SRV-03's tie-break key). Same Spark project as the Phase 79.3 bug reports (`delve-die-repeat-6ba5f`); precedent = `src/browser/bugReport.js` + `firebase/firestore.rules` + `test/unit/firestore-rules.test.js` — pure DOM-free modules with an injected `fetchFn`, a JS mirror of the security rules kept equal by tests. User console steps (enable Anonymous sign-in, API key API restrictions, deploy rules + `firestore.indexes.json`) are checkpoints. Zero parity fixtures; engine untouched.
**Requirements**: SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, SRV-06, SRV-07, SRV-08, SRV-09, SRV-10, SRV-11, SRV-12
**Success Criteria** (what must be TRUE):

  1. Each finished Compete-ON run is written once to a Firestore run collection in `delve-die-repeat-6ba5f`, carrying owner id, handle, season, hero identity, stats, cause, epitaph, run hash and app version; resubmitting the same run never creates a duplicate.
  2. Firestore security rules — with a JS mirror kept equal by tests — let an anonymous signed-in player create only correctly-shaped runs owned by their own id, read in bounded pages, and never update; only the owner or the admin service account may delete, everything else is denied.
  3. For each of DEPTH, DAYS, KILLS and WILMST, filtered by race, sub-class, both or neither within the current season, the board answers the top ten, a total count and one run's rank, backed by declared composite indexes, with DAYS ties following the Phase 82 ruling.
  4. The game obtains and refreshes an anonymous Firebase identity over plain `fetch` (no SDK) only when Compete is ON, rolls a family-friendly @handle the player can re-roll, and queues every non-dev Compete-ON death durably through relaunches and offline play, retrying with backoff and never double-submitting.
  5. An admin script lists and deletes suspicious runs (one run or one player's runs, with the service-account key never entering the repo or `www/`), an ops runbook covers rules/index deploys and quotas, and a smoke test against the live project proves create, read, rank and delete end to end with rules and indexes deployed, anonymous sign-in enabled and the API key restricted to only the APIs the game calls.
  6. Bug reports share the quota safely (added by the user 2026-09-28): a report needs the anonymous identity and is limited per player (2-minute cooldown, 5 a day) by rules proven with live 403 probes; the Action deletes filed/failed reports and stale limit documents on the retention schedule, and its 15-minute schedule is proven to fire.

**Plans:** 11/12 plans executed

Plans:
**Wave 1**

- [x] 83-01-PLAN.md — Shared Firebase config + Firestore REST helpers (encoder moved, decoder, timedFetch) and the rolled @handle (content/handles.js, safety proof) (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 83-02-PLAN.md — runDoc.js (run doc, rank keys, JS mirror), reportLimits.js (cooldown/daily-cap mirror, report + limit commit), firestore.rules for runs/banned/reportLimits/limited bugReports, 19 composite indexes, contract tests (wave 2)
- [x] 83-03-PLAN.md — firebaseAuth.js: lazy anonymous sign-up, proactive refresh, ddr.identity.v1, handle roll/re-roll, Compete gate with the explicit Send exception (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 83-04-PLAN.md — fakeBoardServer.js (in-memory REST model of the rules, runs and reports) and boardClient.js (topTen/total/rankOf, 5-min cache, stale) (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 83-05-PLAN.md — tools/boards-admin.mjs (top/suspicious/delete-run/ban/unban/export) and docs/LEADERBOARDS.md runbook (wave 4)
- [x] 83-06-PLAN.md — boardWrites.js (idempotent submit, handle rewrite, erase), runQueue.js (ddr.runQueue.v1) (wave 4)
- [x] 83-12-PLAN.md — runBackfill.js: runs from the 2.1.0 release on reach the board once, stamped "2.1.0 (11)" (user ruling 2026-09-28; wave 5)
- [x] 83-09-PLAN.md — Bug reports on the shared identity: one-commit limited send, rate-limited sheet UX, shell wiring, ten-probe test tool (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 83-07-PLAN.md — tools/boards-smoke.mjs end-to-end smoke, proven offline against the fake (wave 5)
- [x] 83-10-PLAN.md — Action cleanup on the retention schedule (30 d / 2 d / 100 a run), "until <date>" trim note, BUG-REPORTS.md and LISTING.md (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 83-08-PLAN.md — Live setup: deploy rules + indexes, enable APIs, restrict the key, anonymous sign-in, per-IP sign-up limit, live board smoke (wave 6)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 83-11-PLAN.md — Live bug-report proof: push, ten 403 probes, report-to-issue-to-deleted cleanup proof, scheduled run proven (wave 7)

**Research**: yes — gsd-phase-researcher (Firestore REST `runQuery`/`runAggregationQuery` count + rank queries, anonymous auth over REST + token refresh, owner-scoped rules and bounded list rules, composite index count, Spark quotas)

### Phase 84: Leaderboards Panel v3

**Goal**: The DEAD tab and VIEW THE DEAD show the v3 mock — everyone's dead or just yours, ranked by DEPTH/DAYS/KILLS/WILMST with RACE and SUB-CLASS filters.
**Depends on**: Phase 83. Mock files: `design/Mazeworld Leaderboards v3.dc.html` and `design/Mazeworld Boards Panel v3.dc.html` (UX/visual spec only — house rules win: PNG icons, the rail as the one feedback surface, tap-to-move, HP not WP). Rebuilds `src/browser/boardsPanel.js` + `boardsView.js` + `content/boards.js`; `engine/records.js` board lists and the local run store change (per-run records, tolerant load of old graveyard/bests). Zero parity fixtures; engine untouched.
**Requirements**: BOARD-18, BOARD-19, BOARD-20, BOARD-21, BOARD-22, BOARD-23, BOARD-24, BOARD-25, BOARD-26, BOARD-27
**Success Criteria** (what must be TRUE):

  1. The DEAD tab and the title's VIEW THE DEAD open one Leaderboards panel built to the v3 mock, opening on LEADERBOARD when Compete is ON and on YOUR DEAD when Compete is OFF, with back and footer routing matching the mock.
  2. The header box switches views (YOURS› with your run count, EVERYONE› with the board's total; a static INTERRED count with Compete OFF), and the RANK BY / RACE / SUB-CLASS bottom sheets re-rank the list (per-option counts on YOUR DEAD only), replacing the old board rail entirely.
  3. Each row shows rank, an initials avatar, the handle (or hero name on YOUR DEAD), a YOU tag on your own runs, and the name/race/sub-class/level/value line; tapping a row expands its cause of death, epitaph and six stat chips, tapping again closes it.
  4. A best run outside the top ten is pinned under a "NOT IN THE TOP TEN" divider with its real rank and standing line, and a filter with no runs shows NOBODY YET with a CLEAR FILTERS button.
  5. LEADERBOARD shows deliberate in-voice states for loading, offline/unreachable and a stale cached result, while YOUR DEAD never waits on the network and ranks a generous local per-run history that starts with runs from the 2.1.0 release on (versionCode 11, `when` ≥ 2026-09-28T19:41:01Z, `BACKFILL_SINCE_MS` in `src/browser/runBackfill.js`); older runs are not imported or shown.
  6. The LEADERBOARD view names the current season from `content/season.js`: SEASON OF THE ALPHA for season 1, the closed-testing season (user, 2026-09-28).

**Plans**: TBD
**UI hint**: yes
**Device check**: yes — batched into the milestone-close Pixel 7 checklist.

### Phase 85: Play Games Out, Our Board In

**Goal**: Play Games is gone from the app and every Compete-ON death reaches our board; the ☰ account block and title chip carry Compete plus your handle.
**Depends on**: Phases 83 and 84. Deletes the plugin (`@modbender/capacitor-play-games`), APP_ID meta-data + `games-ids.xml`, `src/browser/playGames.js`, `pgsQueue.js`, `globalBoards.js`, `boardScores.js`, `scoreTag.js`, `content/leaderboards.js`, and rewrites `account.js`/`accountChip.js`/`content/account.js`; wires the new queue at death and "you placed X" from our board; tolerant load of old keys. Zero parity fixtures; engine untouched.
**Requirements**: ACCT-03, ACCT-04, ACCT-05, ACCT-06, RETIRE-01, RETIRE-02, RETIRE-03
**Success Criteria** (what must be TRUE):

  1. The Play Games plugin, the APP_ID meta-data and `games-ids.xml` are gone from the Android build, and launch makes no Play Games call and shows no sign-in popup.
  2. Every Play Games module (the provider, the PGS queue, global boards, score encodings, the score tag, the board IDs) and their tests, copy and docs are deleted or rewritten, and a sweep proves no Play Games identifier remains in shipped code.
  3. Old stored data — the old PGS queue, the welcomed flag and any sign-in state — loads tolerantly and is dropped silently on first launch, while the local graveyard and bests are untouched.
  4. The ☰ account block and the title's corner chip show the player's @handle and the Compete toggle, the ☰ face wears the handle's initials avatar while competing, and there is no sign-in, sign-out or Play Games wording anywhere.
  5. Every non-dev Compete-ON death is queued and submitted to our board, the death card's "you placed X" reports the run's DEPTH rank once acknowledged (or on the next flush if offline), the player can erase every run they have on the board from the ☰ account block behind a two-tap confirm (starting a new identity on the next Compete-ON run), and with Compete OFF the game makes zero network calls and discards any queued runs.

**Plans**: TBD
**UI hint**: yes (☰ rows, title chip, erase confirm)
**Device check**: yes — batched into the milestone-close Pixel 7 checklist.

### Phase 86: Compliance & Device Close

**Goal**: Every store, policy and website text matches what the game now sends, and the milestone's device checks are batched against one debug APK.
**Depends on**: Phase 85. Includes the darktierstudios.com repo at `C:/projects/darktier-studio` (`src/pages/privacy/apps.astro`, `src/pages/privacy/delete-data.astro`, `src/pages/delve-die-repeat/terms.astro`) — the user asked for these on 2026-09-28. Keep release builds out of this phase: the debug APK is built after the last code lands, and any Play release build comes only after the user agrees patch notes (standing rule). Zero parity fixtures; engine untouched.
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04
**Success Criteria** (what must be TRUE):

  1. The Data safety answers in `store-listing/LISTING.md` describe our board's data (an anonymous id, the handle, run stats; collected for app functionality; optional through Compete; deletable) and no longer mention Play Games.
  2. The darktierstudios.com pages `/privacy/apps`, `/privacy/delete-data` and the Delve, Die, Repeat Terms of Service describe our own leaderboard instead of Play Games: what is sent, who sees it, Compete OFF, erasing your runs, and removal of forged runs.
  3. `docs/PLAY-GAMES-SETUP.md` is retired in favor of the leaderboard-server runbook, and the Play Console cleanup (unpublish or delete the Season-1 boards and the Play Games configuration) is a listed user step.
  4. One batched Pixel 7 checklist, `docs/UAT-v2.2.md`, covers the panel, submission, the handle, erasing your runs and Compete OFF in airplane mode, run against one debug APK built after the last code lands.
  5. The bug-report rules swap is a listed release step (user, 2026-09-29: keep 2.1.0's REPORT A BUG working until 2.2 ships): when the 2.2 build reaches testers, deploy the final `firebase/firestore.rules` over 83-08's transition rules, run `send-test-report.mjs --probe-rules` live (ten PASS, SRV-09's live proof), record it in docs/BUG-REPORTS.md, and delete the transition files.

**Plans**: TBD
**Device check**: yes (this phase presents the batch)

## Deferred / Not This Milestone

- **80-05 emulator pass** (tablet, foldable, nav modes on the R8 build) — deferred by the user 2026-09-28 until the features are in.

- **Pixel 7 UAT batches** — `docs/UAT-v2.1.md` (108 + 12 quick), `docs/UAT-v2.0.md` (142), `UAT-v1.9.md` (21), `UAT-v1.8.md` (30), `UAT-v1.7.md` (25 + DR bar), `UAT-v1.6.md` (26) and `UAT-v1.5.md` (140), walked over the user's play sessions; findings become todos or quick tasks, never ad-hoc edits.
- **UX-06** first-run tutorial — deliberately last; rebuilt on the Phase 47 modular shell (the reason SHELL-01..03 exist). Includes the UIF-04 on/off toggle dropped from v1.3.
- **STR-01..04/06** Google Play production launch (Data Safety audit, privacy page, listing, IARC, pricing, rollout).
- **`storeRoll` for the bots** — the tuning harness still plays the frozen store roll; **the two structural v1.5 AFTER patterns** (Magic Users gain nothing from the class-gated ability system; Wilmsry's racial edge) — both carried forward past v1.7 per `REQUIREMENTS.md`'s Future Requirements (TUNE-06/07 are now in scope this milestone as TUNE-08/09, Phases 54–55).
- Store screen restyle to the dark vocabulary (Phase 47 moves the store into `storeScreen.js` unchanged — the restyle edits that module later).
- Dice-mode setting.
- Haptics polish; the unguarded button set from 32-03 (store rows, drop shelf, `a-evt`, `btn-again`, spell menu).
- Climb dice payload (`roll`/`need` on the four climb events) — carried over from v1.4 as a post-UAT quick task. **Superseded 2026-09-24**: CLIMB-01/02 (v2.1 Phase 78) replaces the retry card with a pre-roll decision card, and ROLL-05 (Phase 73) makes every climb roll high-is-good natively.
- Shell debt noted in the v1.5 audit but not in v1.6's requirements: the unreachable parley fluency-2 branch (`canParley`'s Magical tier, `wilmsryVsMagical`) and the `railCardFor` tie-break — fold into Phase 44's orphan sweep if they fall out for free, otherwise a quick task.
- **Backlog 999.14 (our own friends list)** — not planned (user, 2026-09-28: no friends scope, everyone or just yours).
- Replay verification of top runs, Firebase App Check and a season picker — see REQUIREMENTS.md Future Requirements.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 82. DAYS Farming Check | 2/2 | Complete    | 2026-09-28 |
| 83. Leaderboard Server | 11/12 | In Progress|  |
| 84. Leaderboards Panel v3 | 0/TBD | Not started | - |
| 85. Play Games Out, Our Board In | 0/TBD | Not started | - |
| 86. Compliance & Device Close | 0/TBD | Not started | - |

## Backlog

### Phase 999.1: Transitions & Sounds (PROMOTED → Phases 56 / 58 / 59)

> **Promoted 2026-09-22 into milestone v1.8.** Sound → AUD-01..06 (Phase 56); transitions, combat pacing and typed text → MOTION-01..05 (Phase 58); the party-marker ring → ANIM-03 (Phase 59). The rail-overlay prerequisite it names is LAYOUT-01 (Phase 57). Kept here for its planning context until v1.8 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-19 for future planning — user's words] Map the sound clips in `sfx/` (30 MP3s the user added — 31 originally, less `enemy-batrat` which the user deleted 2026-09-22: `walk1-3`, `walk-water1-3`, `hit1-2`, `miss1-2`, `hurt1-3`, `foe-die`, `enemy-{beast,demon,human,undead}`, `spell`, `resist`, `heal`, `drink`, `chest`, `gold`, `trap`, `jump`, `stairs`, `levelup`, `death`, `ui-tap`) to game actions and engine events; and make the shell's transitions smooth — map panning, rail show/hide, opening menu items — "not jarring and immediate". Slow the fight responses down so there are transitions between exchanges and the player can process each one. Animate on-screen text as if quickly typed out (fast, not slow). Dial back the black circle around the party marker — the party is already highlighted, the ring is too stark.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** sound = a `src/browser/sfx.js` event→clip table played through Web Audio (`AudioContext` + `decodeAudioData`, unlocked by the first tap), wired beside `hapticForEvents(events)` in the dispatch path — engine untouched, mute toggle by the settings gear, clips bundled in `www/` (Android WebView plays MP3 offline, no plugin). Transitions: the rail is a flex sibling that reflows the viewport today (see todo `2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — overlay + slide is the fix, land together); map pan goes through `cameraPan()`/`keepInViewAxis` (`src/browser/controls.js`) with no easing; `.mw-rail-new` has a 0.18 s rise (`mazeworld.html` CSS ~L707) and combat has `mwStrikePop`/`mwRoundTick` keyframes but no inter-exchange pacing in `combatPanel.js`. Typed-text effect belongs to the rail/encounter line renderers (`renderRail`, `renderEncounter`), must respect the rail hold/dismiss rules and TalkBack (`#mw-rail-live` announcer gets the full text at once). Party marker ring: `PLAYER_MARKER_ICON`/`draw()`. Sequence AFTER v1.6 Phase 47 (shell modularisation) so the effects land in the new `src/browser/` modules, not the old `paint()` bodies; each effect gets a settings-respecting reduced-motion path.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.3: Dungeon set dressing (PROMOTED → Phase 59)

> **Promoted 2026-09-22 into milestone v1.8 as DRESS-01..05, Phase 59 (Party Animation & Dungeon Set Dressing).** Kept here for its planning context until v1.8 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-19 for future planning — user's words] Add set dressing to the dungeon using the new optimized `icons/optimized/set_dungeon_*.png` icons (54 of them: ash pile, banners, barrels/crates/sacks, bones/skulls/skeleton, blood, book/scrolls, boulder/rocks/rubble, braziers/torches/candles/sconce, cobwebs, mushrooms/moss/fern/roots/vines, grate/hatch/pit, puddles/slime, rat, shackles, …). Use them for random dungeon set items — on walls, or on paths provided they are DIMMED so they are never confused with the real encounter icons. Set dressing only: not interactable, no rules effect, pure ambiance.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** rendering-only, engine untouched — the placement must be deterministic per floor (derive from `makeRng(hash(seed, "dressing", depth))` in the SHELL/`src/browser/` layer, never a draw off the engine's main stream, so no fixture moves and the engine stays pure), keyed off the generated grid (`engine/maze.js` cells `{ wall, seen, feat }`; walls are the majority of the 21×21 grid) and revealed with `c.seen`. Draw in `draw()` (`mazeworld.html` ~L1931; feature icons at ~L1998-2002 via `iconsApi.drawFeatureIcon(ctx, img, x, y, CELL, dir, 0.75)`) BEFORE the feature/party layer: wall items at full or near-full alpha on wall cells; path items at low alpha (≈0.3-0.4) so `featureKeyForCell` encounter icons stay unmistakable; never on a cell that has a `feat`, the stairs, or the party. Density is a tunable (a handful per floor, rarer on deep floors?). `preloadIcons("./icons/optimized")` already loads the directory — check `icons.js`'s manifest approach so 54 extra images don't slow the first paint (lazy or a sprite). Respect the 260918-vm3 stationary camera and Phase 35 map palette; a settings toggle ("set dressing off") is cheap. Land after v1.6 Phase 47 (draw code may move into a module) and alongside 999.1's party-marker frames. The raw `icons/*.png` sheets the user added (`dungeon_dressing.png`, `encounters.png`, …) are sources — only `icons/optimized/` ships in `www/`.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: Map & HUD layout band (PROMOTED → Phase 57)

> **Promoted 2026-09-22 into milestone v1.8 as LAYOUT-01..06, Phase 57 (Map & HUD Layout Band).** Kept here with its todo index until Phase 57 closes; the four todos below carry `resolves_phase: 57`. Not a runnable backlog item — do not queue it.

**Goal:** [Captured from the 2026-09-19/21 Pixel 7 device rounds] The map screen's chrome stops fighting the map: the rail slides up OVER the map instead of reflowing it, the MARKS / CENTRE / MAKE CAMP / gear strip becomes a reserved band outside the viewport (so a chip tap can never also move the party), the HUD stacks into four bands instead of one clipping row, and the Table-7 Darkness counter becomes visible on the map.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (4):**

- `todos/pending/2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — rail is a flex sibling that resizes `.mw-maze-viewport`; must overlay + slide, body tap dismisses a no-decision card (never a decision card), `RAIL_HOLD` roughly doubles. **Lands with 999.1** (both touch rail transitions).
- `todos/pending/2026-09-21-map-chip-strip-is-a-reserved-band-above-the-map-not-an-overl.md` — `.mw-map-chips` is an absolute overlay inside the viewport; chip taps also move the party and `keepInViewAxis` counts hidden cells.
- `todos/pending/2026-09-21-hud-reflow-name-hp-row-then-counters-then-conditions-then-chips.md` — the single-row HUD (Phase 35 ruling 5) overlaps Rations past 1,000 squares; four stacked bands. **Land together with the chip-strip todo.**
- `todos/pending/2026-09-21-table-7-darkness-counter-is-invisible-on-the-map.md` — `c.darkFor` only shrinks the reveal radius for NEW cells (fog is cumulative) and nothing dims; wants a vignette + the existing DARK chip countdown.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: Combat screen & Oracle readability (PROMOTED → Phase 77)

> **Promoted 2026-09-24 into milestone v2.1 as CMBUI-07..13, Phase 77 (Combat Screen & Oracle Readability).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured from the 2026-09-21 Pixel 7 device round] Everything the player reads during a fight is legible, ordered and honest: submenu rows stop clipping and sort by spell level, the foe's BESTIARY family shows after its name, the Oracle prints combat lines in event order rather than priority order, status chits are readable mid-fight, and a scroll that casts stops narrating a refusal.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (5):**

- `todos/pending/2026-09-21-combat-submenu-rows-clip-their-text-order-spells-by-level-then-name.md` — `.cb-row` clips on the phone; spell rows render in `SPELLS` array order with no sort. **Land with the hide-uncastable todo in 999.6.**
- `todos/pending/2026-09-21-foe-type-listed-after-the-name-on-the-combat-screen.md` — the foe record already carries `type` (the six BESTIARY families); surface it on `.cb-foe-name`.
- `todos/pending/2026-09-21-oracle-combat-lines-must-read-in-event-order.md` — the Oracle reuses the rail fold, which sorts by PRIORITY and collapses identical lines across time, so riposte kills print before the misses that caused them; wants idx-order + adjacent-only folding.
- `todos/pending/2026-09-21-status-chit-tap-in-combat-shows-nothing-rail-hidden-in-comba.md` — `railEl.hidden` is forced for the whole fight, so status-effect descriptions are unreachable in combat; wants a combat-legal transient card.
- `todos/pending/2026-09-21-scroll-read-in-combat-narrates-a-level-refusal-although-it-cast.md` — `scrollTooAdvanced` is the copy-to-book gate but reads as a refusal right before the cast line; narration-only.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: Engine rules fixes from the device rounds (PROMOTED → Phase 75)

> **Promoted 2026-09-24 into milestone v2.1 as RULES-01..04, Phase 75 (Engine Rules — Character, Economy, Grimoire & Combat Bugs).** The combat gear-lock and store-charge-then-refuse items in this backlog already shipped as v1.9 Phase 61 (GRULE-02 / STORE-02/03); only the Summoner school-gate, hide-uncastable-spells, HP-dot compounding and wilmst-cache items carried forward into v2.1. Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured from the 2026-09-21 Pixel 7 device round] Five rules bugs the fitted build exposed: a free mid-fight re-arm, a store purchase that charges then refuses, a Summoner holding spells it cannot cast, Table-4 HP dots that compound max HP geometrically, and a wilmst cache that still pays far too much.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (5):**

- `todos/pending/2026-09-21-no-equipping-or-swapping-gear-during-combat.md` — `equipItem` / `unequipSlot` / `wearItem` carry no `state.combat` gate and the Gear tab stays live mid-fight; wants an engine refusal + disabled rows (`engine/movement.js:523` is the existing gate pattern). **DONE — shipped as v1.9 Phase 61 (GRULE-02).**
- `todos/pending/2026-09-21-store-purchase-charged-then-rejected-as-not-an-upgrade-spike.md` — `buyFrom` deducts gold and marks the row sold BEFORE `takeItem` can reject `notBetter`; a purchase must always deliver or refuse before charging. **DONE — shipped as v1.9 Phase 61 (STORE-02/03).**
- `todos/pending/2026-09-21-summoner-rolls-freeze-it-cannot-cast-hide-uncastable-spells-.md` — chargen's `rollGrimoire` ignores the `mu-chart.js` school gate; plus the user ruling that the combat menu HIDES level-locked spells (reverses the earlier disabled-but-visible CONTEXT decision). **Carried to v2.1 as RULES-03/04.**
- `todos/pending/2026-09-21-table-4-hp-dots-compound-max-hp-geometrically-regression.md` — the "+25 HP" row adds `0.6 × CURRENT maxWP` permanently (×1.6 per pull, compounding) and the toll row then takes 36 % of the inflated pool; a 54-05 regression that also inflates the fit's bot heroes. **Carried to v2.1 as RULES-01.**
- `todos/pending/2026-09-21-red-dot-wilmst-cache-still-pays-far-too-much.md` — `WILMST_CACHE_PER_DEPTH = 300` flat × depth; wants its own cut (~100 × depth) or a derived-rng roll. **Carried to v2.1 as RULES-02.**

**Engine gate applies:** every one of these is a rules change — measure the moved parity fixtures first, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, regenerate only those, master never edited, bot readout before/after.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Content accuracy, tooling & the open climb ruling (PROMOTED → Phases 78, 79, 80)

> **Promoted 2026-09-24 into milestone v2.1: the climb/leap ruling → CLIMB-01/02, Phase 78; sub-class descriptions → VOX-04, Phase 79; the fit-tool replay-resume bug → TOOL-01, Phase 80.** The climb ruling was decided by the user 2026-09-24 as option B (the pre-roll CLIMB/LEAP/USE LADDER/USE ROPE/TURN BACK decision card). Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-21/22] The odds and ends from the device rounds: sub-class blurbs that hide their own gates, a fit tool whose replay-resume diverges, and the CLIMB IT retry card that went stale when Phase 54 made climbs one-and-done.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (3):**

- `todos/pending/2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md` — the Summoner blurb never mentions the level-3 offense gate; audit every `SUB_NOTE` / `RACE_NOTE` against `MU_CHART` + the Phase 24 identity table. Content only.
- `todos/pending/2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md` — `+Infinity` scores serialise as `null`, so a resumed walk takes a different step after the first rejected candidate; per-block stdout was also truncated. Tooling only.
- `todos/pending/2026-09-22-climb-leap-retry-card-is-stale-under-one-and-done.md` — **resolved by user ruling 2026-09-24, option B:** a pre-roll CLIMB / USE TOOL / TURN BACK prompt, no rng until commit. Keep the ladder/rope option; `mapMarks.js` crevice copy reads pre-one-and-done too.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.8: Unify the two darkness mechanisms (PROMOTED → Phase 76)

> **Promoted 2026-09-24 into milestone v2.1 as DARK-01/02, Phase 76 (Darkness Unification & Relaunch Persistence).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [User ruling 2026-09-22, found during Phase 57 planning] The game has **two** darkness mechanisms with **different waiver sets**, and they disagree. Unify them behind one shared waiver predicate so a light source means the same thing everywhere.
**Requirements:** TBD
**Plans:** 0 plans

**The inconsistency, measured:**

| | `revealRadius(state)` | `mapViewRadius(state)` |
|---|---|---|
| Origin | **1994 canon** — `engine/derived.js` comment: "ports `mazeworld.html` `reveal()`'s radius line verbatim (line 838)" | **Phase 41 (TERR-03)** — this project's own render filter |
| Governs | what NEW cells are revealed as the party walks (feeds `seen`) | which already-`seen` cells are rendered (`inViewWindow`, applied in `draw()`) |
| Waived by | Night Vision, `+ eff("sight")` | Night Vision, `eff("light") > 0` (Amulet), `itemEffectActive("lit")` (torch) |

Verified empirically at HEAD with `darkFor: 30` on a non-dark tile:

```
no waiver   | inDark true | revealRadius 1 | mapViewRadius 1
lit torch   | inDark true | revealRadius 1 | mapViewRadius Infinity   <-- the divergence
```

**So a lit torch reopens your entire explored map but does not help you see one square further as you walk.** That is backwards from what a torch obviously does, and it is the cause of the 2026-09-21 device report (*"It looks like I'm in the dark, but it's not limiting my vision"*) — the player had a light source, the render filter waived, the reveal rule did not, and nothing on screen explained either.

**The shape of the fix:** one shared `darkWaived(c)` predicate consumed by both functions, with the **torch and the Amulet widening `revealRadius` as well** (the reading the user favours: a light source should mean the same thing everywhere). Keep `+ eff("sight")` as the separate additive it already is.

**Why this is NOT a v1.8 phase:** widening `revealRadius` changes which cells enter `seen`, and `seen` is serialized — so parity fixtures move. v1.8 is gated presentation-only (`engine/` and `content/` byte-identical, zero fixtures moved). This needs the greenfield treatment instead: measure the moved set first, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, regenerate only those, never edit the master, and take a bot readout before/after (a wider reveal radius in the dark is a small difficulty change — darkness gets less punishing for anyone carrying a light).

**What Phase 57 did instead (v1.8, presentation-only):** made the *current* behaviour legible rather than changing it — the DARK chip names which waiver is holding the dark back, and the map vignette follows `mapViewRadius` (what is actually rendered) rather than `revealRadius`. When this backlog phase lands and the two agree, the vignette's source argument can collapse back to a single radius and `waiverFor`'s three-way split becomes a two-way one. Leave a comment in `src/browser/darknessView.js` pointing here.

**Third surface to fold in while here:** per-tile `tile.dark` painting in `draw()` is a *third* darkness expression, independent of both radii. Decide whether it shares the predicate or stays purely cosmetic.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.9: Android 15/16 edge-to-edge, deprecated window APIs, large-screen orientation (PROMOTED → Phase 80)

> **Promoted 2026-09-24 into milestone v2.1 as DROID-02/03, Phase 80 (Android Release Build & Tooling).** Flagged `--research-phase` recommended. Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-23 from the Play Console pre-launch notes on the 1.9.0 / vc8 build] Clear the three Play Console warnings so the game draws correctly edge-to-edge on Android 15+ and behaves on tablets, foldables and Chromebooks.
**Requirements:** TBD
**Plans:** 0 plans

**The three warnings, verbatim from Play Console:**

1. *"From Android 15, apps targeting SDK 35 will display edge-to-edge by default. Apps targeting SDK 35 should handle insets to make sure that their app displays correctly on Android 15 and later. Investigate this issue and allow time to test edge-to-edge and make the required updates. Alternatively, call enableEdgeToEdge() for Kotlin or EdgeToEdge.enable() for Java for backward compatibility."*
2. *"One or more of the APIs you use or parameters that you set for edge-to-edge and window display have been deprecated in Android 15. To fix this, migrate away from these APIs or parameters."*
3. *"Your game doesn't support all display configurations, and uses resizability and orientation restrictions that may lead to layout issues for your users."*

**What is already in place (so this is a verify-and-tidy, not a rewrite):**

- `targetSdkVersion = 36` (`android/variables.gradle`), so edge-to-edge is already forced on Android 15+.
- `mazeworld.html` pads its fixed chrome with `var(--safe-area-inset-*, env(safe-area-inset-*))` (HUD band ~L1026, dead screen ~L1105, `.mw-bd-dock` ~L1187, title/panels ~L1261/1344/1417/1527). Device checks so far have looked right on the Pixel 7, but nobody has tested gesture-nav vs 3-button nav, a display cutout, or landscape.

**Likely sources, to confirm:**

- **Warning 2:** `src/browser/nativeChrome.js` ~L219-220 calls `StatusBar.setBackgroundColor({ color: "#1b170f" })`. On Android that maps to `Window.setStatusBarColor`, which is deprecated in API 35 and ignored under edge-to-edge (the comment there already calls it best-effort). Drop the call, or move to `@capacitor/status-bar`'s edge-to-edge-aware API if 8.x has one. Also check Capacitor core, SplashScreen and the Play Games plugin (Phase 67) for `setStatusBarColor`, `setNavigationBarColor` or `setDecorFitsSystemWindows`. Play Console names the calling class under "View details".
- **Warning 1:** confirm Capacitor 8's `BridgeActivity` already enables edge-to-edge, or call `EdgeToEdge.enable(this)` in `MainActivity`. Then check that the WebView really receives the insets: Capacitor's `SystemBars`/`adjustMarginsForEdgeToEdge` config, and whether `env(safe-area-inset-*)` is populated inside the Android WebView or needs the Capacitor-injected `--safe-area-inset-*` variables.
- **Warning 3:** `AndroidManifest.xml` sets `android:screenOrientation="portrait"` and `nativeChrome.js` locks portrait through `@capacitor/screen-orientation`. On Android 16 (targetSdk 36), large screens (smallest width ≥ 600dp) **ignore** orientation and resizability restrictions, so the game will run in landscape or in split-screen on tablets and foldables whatever we set. Decide whether to (a) accept a letterboxed portrait column centred on wide screens (a max-width layout plus a dark gutter), or (b) do nothing and accept the warning. Games can opt out through the `android:appCategory="game"` exemption, so check whether Play still flags a game that declares it.

**Constraints:** presentation and native shell only. The engine, `content/` and fixtures are untouched. Needs a device pass on the Pixel 7 in both navigation modes, plus an emulator tablet or foldable (resizable AVD) for warning 3.

**Sequencing:** interacts with the AGP 9.3.1 spike (Phase 67, `67-AGP9-SPIKE.md`), which also touches the Android build, so land it after that verdict. A good fit for the first post-v2.0 native-polish pass, alongside the R8/minify todo.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.10: Keep live combat and open store through a relaunch (PROMOTED → Phase 76)

> **Promoted 2026-09-24 into milestone v2.1 as SAV-06/07, Phase 76 (Darkness Unification & Relaunch Persistence).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-24 from Phase 70 plan 70-04's resume proof; user ruling: finish Phase 70, fix later] A player who Save & quits (or whose app is killed) mid-fight or mid-store should come back to the same fight or store after a relaunch, not to a cleared tile.
**Requirements:** TBD
**Plans:** 0 plans

**The gap, measured (70-04, real engineAdapter + fake storage):**

- In session: SAVE & QUIT → ENTER resumes exactly (no dispatch happens).
- After a relaunch: `dispatch()` did persist `combat` / `store`, but `engine/saveState.js#rehydrate` (~L735-736) always resets `combat`, `store`, `beats`, `pendingFind` and `pendingHazard` to null. Only `pendingLoot` survives on purpose (LOOT-06). The code comments call this deliberate: it copies the 1994 prototype's load, which treated them as transient.
- Consequences: a relaunch mid-fight lands on the same tile with the fight gone, which also means force-closing the app escapes any fight. An open store vanishes the same way.
- Pinned as today's behaviour in `test/persistence/` (70-04), with a pointer here.

**The shape of the fix:** carry a validated `combat` and `store` through `validateSave` and `rehydrate`, including mid-fight state that combat depends on (`c.foeEffect`, the timers, any per-round flags). Decide whether `beats` should rehydrate or the round should resume at a clean round boundary. Check `pendingFind` / `pendingHazard` the same way.

**Constraints:** an engine change (greenfield ruling: no dual path). Measure which parity or roundtrip expectations move, declare them in `test/parity/FIXTURE-INVENTORY.md`, and never edit the prototype master. Needs a relaunch-mid-fight device check.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.11: Per-sub-class leaderboards & global LINEAGE (SUPERSEDED by the Our Own Leaderboards milestone, Phases 82–86 — RACE/SUB-CLASS filters over one run table)

**Goal:** [Captured 2026-09-24, user] Every sub-class has its own global DEEPEST board on Play Games. Claude creates all 24 boards in Play Console by script and captures their IDs; nobody fills in the Console form 24 times. The game submits each run to its sub-class board, and LINEAGE gets an honest global form back. **The user wants this promoted as its own milestone** (via `/gsd-new-milestone`, after v2.1), not folded into v2.1.
**Requirements:** TBD
**Plans:** 0 plans

**Combines two threads:**

1. **The ask (user, 2026-09-24):** one leaderboard per sub-class, all ranked by deepest depth. Creating each board by hand in Play Console is too slow with 24 sub-classes, so Claude should create them. It must also **retrieve each new board's ID** and wire it in, the way the Season-1 IDs were pasted by quick task 260924-c14.
2. **The deferred LINEAGE global board:** v2.0 Phase 68 built LINEAGE's global form by grouping a top-25 DEEPEST sample on the client, with no per-combo board explosion in Play Console (PROJECT.md key decision; `proposed-milestone-leaderboards.md` "Race/sub-class boards: combinatorial"). At v2.1 roadmap approval the user made LINEAGE ME-only and deferred per-sub-class global boards (STATE.md 2026-09-24; **Phase 81** success criterion 3). The reason: Play Games keeps one best score per player per board, so a sample of DEEPEST cannot honestly rank lineages. Per-sub-class boards are the fix.

**What exists today (verified 2026-09-24):**

- **24 sub-classes, 8 per parent class:** `content/classes.js:13` (`CLASSES[...].subs`). The id is also the display name.
  - Magic User: Wizard, Warlock, Sorcerer, Summoner, Cleric, Illusionist, Court Mage, Apprentice
  - Fighter: Knight, Guard, Woodsman, Soldier, Barbarian, Master of Arms, Samurai, Bard
  - Thief: Pickpocket, Pilfer, Cat Burglar, Cutthroat, Cloaker, Ninja, Con Artist, Acrobat
  - `src/browser/scoreTag.js:38` `TAG_SUBS` is a frozen, append-only index in a different order. `classOfSub()` is at `:66`.
- **Play Games app / project ID `517177834262`:** `android/app/src/main/res/values/games-ids.xml:6`; runbook `docs/PLAY-GAMES-SETUP.md`.
- **Board IDs:** `content/leaderboards.js` `LEADERBOARD_IDS`, one frozen entry per season with 5 keys (deep/lean/days/kills/purse; `lean` goes away, see the LEANEST decision). A `PLACEHOLDER` prefix means the board is skipped silently.
- **Scores:** `src/browser/boardScores.js`. The DEEPEST encoding is `floor * 1,000,000 - steps` (steps capped at 999,999), `largerIsBetter`. `leaderboardId(ids, season, board)` is at `:132`, and dev builds use `dev_{board}_s{season}` (`:165`).
- **Submission:** `mazeworld.html` `onRunRecorded` → `src/browser/pgsQueue.js` enqueue (`:124`) → `flush()` → `provider.submitScore` (`:386`), one acked board at a time. Standing is fetched on the deep board (`:428-432`). The provider is `src/browser/playGames.js` (`@modbender/capacitor-play-games` 0.5.0).
- **No service account yet:** `docs/RELEASING.md` "Uploading from the CLI (not set up yet)" and `C:/Users/Dell/.play/` does not exist.

**Part A: provision the boards by script (Claude does this, user approves)**

- **API:** Google's Play Games Services **Publishing / Games Configuration API**. `POST https://www.googleapis.com/games/v1configuration/applications/{applicationId}/leaderboards` (`leaderboardConfigurations.insert`), plus `list` / `get` / `update` / `delete`. OAuth scope `https://www.googleapis.com/auth/androidpublisher`. The body is `{ scoreOrder: "LARGER_IS_BETTER", draft: { name: { translations: [{ locale: "en-US", value }] }, scoreFormat: { numberFormatType: "NUMERIC", numDecimalPlaces: 0 }, sortRank } }`. Leave `scoreMin` / `scoreMax` empty to match the Season-1 boards. The response carries the new board's `id` (`CgkI...`), which is how the IDs are captured.
- **One-time user setup:** a Google Cloud service account plus a JSON key stored outside the repo (`C:/Users/Dell/.play/service-account.json`), with the Games Configuration API enabled in that project. Then invite the service account in Play Console → Users and permissions, with the permission that covers Play Games Services configuration. Confirm the exact permission name at planning. **The same key unlocks `tools/play-upload.mjs`** (the CLI AAB upload that RELEASING.md defers), so plan the two together.
- **Script:** `tools/pgs-leaderboards.mjs`, build tooling only; `googleapis` or plain `fetch` + `google-auth-library` as a devDependency; nothing ships in the app. It reads the sub-class list from `content/classes.js` so the list is never retyped. It is **idempotent**: `list` first and skip any board whose name already exists, so a rerun never duplicates. `--dry-run` prints the plan. It writes the returned IDs into `content/leaderboards.js` (or prints the block for review).
- **Naming:** follow the Season-1 convention (`PLAY-GAMES-SETUP.md` §7: *DEEPEST, Season 1*). For example *DEEPEST, Wizard* (all-time) or *Wizard, Season 1* (seasonal). Decide with the seasons question below.
- **Publishing:** the API creates **draft** leaderboards. Testers see drafts; everyone else sees them only after the user presses **Publish** on the Play Games Services config in Play Console. Keep that as a manual user step and add it to the runbook. Ordering cannot be changed once published, so the dry-run output is the review gate.
- **Fallback:** if the service-account route is blocked, drive Play Console's "Create leaderboard" form in the user's signed-in Chrome (claude-in-chrome) and scrape each ID from the board's page. It's slower and more fragile.

**Part B: submit to the sub-class boards**

- Extend the `LEADERBOARD_IDS` shape to carry sub-class boards, keyed by the `content/classes.js` sub names. The unit suite asserts every sub-class has an ID or a `PLACEHOLDER`.
- `pgsQueue` submits the existing DEEPEST score (same `boardScore` encoding and score tag) to the run's sub-class board, as well as the main DEEPEST board. Acks are tracked per board so a retry never double-submits. Dev IDs become `dev_deep_{sub}_s{season}`.
- Old queued entries without sub-class boards load tolerantly (greenfield rule: no dual path; old saves tolerant-load only).

**Part C: global LINEAGE returns**

- The global LINEAGE view for a picked sub-class reads **that sub-class's board** (top page + the player's own standing), not the DEEPEST sample. Race stays a client-side filter from the score tag on that board's rows. This is honest per sub-class; the race split is still a sample, and the copy should say so.
- This reverses or extends Phase 81's "LINEAGE ME-only". **It depends on Phase 81 landing first** (ME | ALL | FRIENDS scopes).

**Decided (user, 2026-09-24): Google only, rolling season sets.**

- **Play Games only.** No backend of our own and no managed leaderboard service. Considered and rejected: a Cloudflare Worker + D1 server (PGS `requestServerSideAccess` identity, `loadFriends` filter, replay-verified runs), and PlayFab / LootLocker / Nakama.
- **Each season gets a full set of 28 boards** (4 main + 24 sub-class; LEANEST is dropped, see below) with fresh IDs, added as a new `LEADERBOARD_IDS` entry plus a `SEASON` bump and an app update, as the season model already works. **The old season's set is deleted later** to stay under Play Games' **70-leaderboard cap**. Published boards cannot be reset, but they can be deleted.
- **Rolling window:** at most two season sets live at once (56 boards). Season N-1's set must be deleted before Season N+1's set is created (3 × 28 = 84 > 70). Google does not document whether deleted boards still count toward the cap. **Test it once with a throwaway board** before the first rollover.
- **The script therefore needs two modes:** `create --season N` (create the 28 boards, capture the IDs, write the `content/leaderboards.js` entry) and `delete --season N` (delete that season's 28 by name/ID; `--dry-run` first).
- **Once a season is deleted,** the panel's season picker must drop it (or show it as retired). `pgsQueue` must treat a "leaderboard not found" error on a retired season's board as permanent and drop the entry, not retry forever. Players who haven't updated keep submitting to the old boards until those are deleted, and after that the submissions are dropped.

**Decided (user, 2026-09-24): drop LEANEST.**

- **Why:** LEANEST ranks by steps per floor (`src/browser/boardScores.js` `lean = round(1000 × steps / max(floor, 1))`; local `engine/records.js` `compareRuns("lean")`). A 1-step death therefore tops it (a floor-0 death counts as one floor on Play Games, and a 1-step death on floor 1 tops the local board). The user's intended meaning, "deepest floor, then the fewest steps", is exactly DEEPEST's ordering (`floor × 1,000,000 − steps`). v2.0 Phase 66 D-09 had moved LEANEST to steps per floor precisely to stop it duplicating DEEPEST, so there is no honest single-number LEANEST left.
- **Considered and parked:** "fewest steps to reach floor 5 / 10 / 15 / 20" speedrun boards. The user liked the idea, but it adds 4 boards per season, and the user wants fewer boards, not more. Keep it as an idea only.
- **Scope of the removal:** drop `lean` from `RANKED_BOARDS` / `BOARD_IDS` (`engine/records.js`), `SUBMIT_BOARDS` / `SCORE_ORDER` / `boardScore` / `scoreFallback` (`src/browser/boardScores.js`), the `lean` key of every `LEADERBOARD_IDS` season entry, `content/boards.js` copy, the panel's board rail, the bests record's `lean` list (tolerant-load: an old `ddr.bests.v1` with a `lean` list loads cleanly and drops it), and queued `pgsQueue` entries' `lean` scores (dropped on load, never submitted). Also update `docs/PLAY-GAMES-SETUP.md` §7 (board table and "The LEANEST limit").
- **The live Season-1 LEANEST board** (`CgkIlvbN0YYPEAIQAw`): stop submitting to it, then delete it in Play Console (or by the script's `delete` mode) once the update without it is out. That frees one slot under the 70 cap.
- **Moved to v2.1 Phase 81 as BOARD-17** (user, 2026-09-24): it closes a live exploit and is the same kind of removal as GRAVEYARD. This milestone starts with LEANEST already gone; the season sets above assume 28 boards.

**Open decisions (for milestone discussion):**

- Race boards too? 6 more per season makes 34 per set, and two live sets = 68, just under the cap, so probably not. Race × sub-class (144) is impossible under the cap.
- Board icons: `imageConfigurations.upload` (`LEADERBOARD_ICON`) could reuse the sub-class PNG art. Optional.
- Does "you placed X" also report the sub-class standing on the death card?

**Constraints:** shell and tooling, plus the pure `engine/records.js` board list for the LEANEST removal; zero parity fixtures expected (verify). The service-account key never enters the repo or `www/`. No new runtime SDK (the ads/analytics audit stays clean). Needs a signed-in Pixel 7 check (submission lands on the sub-class board; LINEAGE ALL/FRIENDS), batched into the milestone-close checklist.

**Sources:** [leaderboardConfigurations.insert](https://developer.android.com/games/services/publishing/api/leaderboardConfigurations/insert) · [LeaderboardConfiguration resource](https://developer.android.com/games/services/publishing/api/leaderboardConfigurations) · [70-leaderboard limit](https://developers.google.com/games/services/common/concepts/leaderboards)

Plans:

- [ ] TBD (promote with /gsd-new-milestone when ready — user wants this as its own milestone)

### Phase 999.12: Achievements track (BACKLOG — promote as its own milestone)

**Goal:** [Captured 2026-09-25, user] Add an achievements track to the game. Every achievement name and unlock line is written in the game's sarcastic, family-friendly voice. **The user wants this promoted as its own milestone** (via `/gsd-new-milestone`), not folded into a bug-fix milestone.
**Note (2026-09-28):** v2.2 removes Play Games entirely, so achievements become a local list unless Play Games is re-added for them.
**Requirements:** TBD
**Plans:** 0 plans

**The user's seed list (ideas, not a closed set):**

- **Depth milestones:** reach 5, 10, 15 and 20. **20 is "Unicorn!"** (matches the depth-20 unicorn-ceiling tuning target).
- **Fully dressed:** have an item equipped in every slot at once.
- **Naked ambition:** reach 5 with **nothing equipped**. You must unequip everything before your first move, so the check is "zero equipped at step 1 and never re-equipped".
- **Teetotaler:** reach 5 without drinking a single healing potion.
- **Frequent flier (tiered):** die 50, 100, 200 and 500 times, counted across all runs.
- **Read the label:** drink the Death potion (`content/potions.js:45`, `eff: "death"`, *"your dead!"*).
- **Body counts:** kill 100 Walking Dead, and one "kill 100" for each monster group. The groups are the `content/bestiary.js` `BESTIARY` keys: Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead.
- **Every race:** reach 5 with each race in `content/races.js`: Human, Elven, Dwarven, Wilmsry, Fridgian, Troll.
- **Every class:** reach 5 with each parent class (Magic User, Fighter, Thief), not with each sub-class.
- **Tourist:** start one delve with every one of the 24 sub-classes (`content/classes.js` `CLASSES[...].subs`). Depth doesn't matter.
- **Survivor (tiered):** live for X days in a single run. Tier thresholds are decided at planning, calibrated from bot/sim day counts.
- **Hoarder (tiered):** gain X coin. Decide at planning whether it counts one run or lifetime, and whether it's coin earned or coin held.
- **Special Snowflake:** die on floor 1. The user's line: *"You're a special snowflake."* Every run starts on floor 1 (there is no floor 0), so any death before the first descent counts.
- **Party Animal (tiered):** accept X Joiners in total, counted across all your delves. The tier thresholds are decided at planning.

- **Fallen Joiners (tiered, user):** X Joiners have died in your service, counted across all delves. Name idea: *Human Shields*.
- **Fallen summons (tiered, user):** X of your summons have died. Name idea: *Disposable Help*.
- **"Any kind of fun thing" (user):** the brainstorm below is open. Keep what's funny.

**Brainstorm (Claude, 2026-09-25, for the milestone discussion; every one keys off an engine event or death cause that already exists):**

- **Death-cause collection.** The death causes are the `content/epitaphs.js` keys: combat, starve, trap, fall, gorge, teleport, maze, quake, potion, insanity, poison, backfire, summon, entombed.
  - *Well-Rounded:* die of every cause.
  - Hidden one-offs, each with a hint breadcrumb:
    - *Just One More Bite* (gorge)
    - *Friendly Fire* (your own spell backfires; also `backfireSelfDamage`)
    - *Read the Fine Print* (killed by your own summon; also `summonBackfired`)
    - *Buried Talent* (entombed)
    - *Poor Aim* (teleported into trouble)
- **Dying with regrets:**
  - *You Can't Take It With You:* die with X coin unspent.
  - *Saving It For Later:* die holding an undrunk healing potion.
  - *Speedrun:* die within your first N steps.
- **Tiered event counters:**
  - *Tactical Retreat Enthusiast:* flee X times (`fled`).
  - *Tripwire Connoisseur:* spring X traps (`trapSprung`).
  - *Bomb Squad:* disarm X traps (`trapDisarmed`).
  - *Get Off My Lawn:* turn X Walking Dead (`walkingDeadTurned`).
  - *Cartographer:* fully map X floors (`floorMapped`).
- **Social disasters:**
  - *Diplomatic Incident:* insult a foe in parley (`parleyInsulted`).
  - *Riveting Company:* a foe gets bored and leaves (`foeBored`).
  - *It's Not You, It's Me:* dismiss a Joiner (`joinerDismissed`).
  - Something for `joinerMurdered`, once planning confirms what that event covers.
- **Collectors:**
  - *Collected Neuroses:* acquire X distinct phobias (`phobiaAcquired`).
  - *Fashion Victim:* lose X armor pieces to wear (`armorDestroyed`).
  - *Retail Therapy:* spend X coin at the store, lifetime.
- **Faerie roulette:** *Fairy Godmother* (a `faerieBoon`) and *Fairy Godmugger* (a `faerieBane`).
- **Clutch:** *Just a Flesh Wound:* win a fight on 1 HP.

**Design principle: tiers and breadcrumbs (user, 2026-09-25):**

- **Tier the counters.** Counting achievements come in escalating tiers (deaths 50 / 100 / 200 / 500). Apply the same idea to kill counts and similar tracks, so there is always a next rung in sight.
- **Achievements hint at other achievements.** An easier, more common unlock's sarcastic line drops a clue about a less obvious one. Example: *Fully dressed* (every slot filled, likely common) hints that taking it all *off* might also count, which leads to *Naked ambition*, something few players would think of otherwise. Chain the hidden or odd achievements behind hints from the obvious ones. Hidden achievements can be revealed when their hint fires (Play Games `revealAchievement` exists for exactly this).

**Open decisions (for milestone discussion):**

- **"Level" means floor depth or character level?** The engine has both: character level comes from `levelFromSP` in `engine/derived.js`. The depth-20 unicorn target suggests depth, and "reach 5" in the other ideas probably means depth too. Confirm.
- **Where achievements live:** Play Games achievements, a local in-game list, or both. The plugin `@modbender/capacitor-play-games` already exposes `unlockAchievement` / `incrementAchievement` / `setAchievementSteps` / `loadAchievements` / `showAchievements`. The game must stay fully playable offline, so a local list is the source of truth and Play Games is a mirror. Unlocks earned offline or while signed out are queued like `pgsQueue` scores.
- **Provisioning:** Play Console achievements need an icon and fixed XP points (1,000 XP cap per game). Created by script via the Games Configuration API (`achievementConfigurations.insert`) with the same service account as 999.11's leaderboards script, or by hand. Plan them together.
- **Counters and persistence:** the kill counts per group, deaths, races/classes reached and sub-classes delved need a durable lifetime-stats record in `@capacitor/preferences` (the `storage.js` pattern), kept separate from the run save. Tolerant-load, no legacy paths. Decide whether to count retroactively from the local graveyard/bests history.
- **Engine purity:** the engine only emits the facts (kills with group, potion drunk, equip state at step 1, depth reached). The achievement tracker is a shell layer that folds events into the lifetime stats. Zero rng draws, so zero parity fixtures should move (verify).
- **Surfacing:** an unlock is a minor event, so it shows as a toast with a sarcastic line, not a card (see the card vs toast rule). The list lives somewhere in ☰ or the Hero Company tab; the Play Games achievements UI opens from ☰. Hidden or secret achievements (e.g. the Death potion) keep the joke intact.
- **Bot / sim:** decide whether the headless bot tracks achievements (probably not, but depth-reach rates from the sim help calibrate how hard each one is).
- **More ideas welcome:** the user's list is a starting point. Brainstorm more in the game's voice during discussion.

**Achievement and icon inventory (Claude, 2026-09-25, for icon generation):**

Icons are required. Play Games treats each tier as its own achievement, and every achievement needs its own uploaded icon (512×512). So **icon files = achievements**. Art is cheaper than that: draw one picture per achievement line and make each tier by adding one of 4 reusable tier frames (bronze / silver / gold / mythic). Play Games generates the greyed-out locked version itself. The same pictures, shrunk down, serve the in-game list. The repo has no race, class or monster art to reuse, so every picture is new.

*The user's list:*

| Achievement | Tiers | Icon files | Pictures |
|---|---|---|---|
| Depth 5 / 10 / 15 | 3 | 3 | 1 (descent) |
| Unicorn! (depth 20) | 1 | 1 | 1 (its own art) |
| Fully Dressed | 1 | 1 | 1 |
| Naked Ambition | 1 | 1 | 1 |
| Teetotaler | 1 | 1 | 1 |
| Frequent Flier (die 50/100/200/500) | 4 | 4 | 1 |
| Read the Label (Death potion) | 1 | 1 | 1 |
| Body counts: Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead | 1 each (100 kills) | 6 | 6 |
| Every race: Human, Elven, Dwarven, Wilmsry, Fridgian, Troll | — | 6 | 6 |
| Every class: Magic User, Fighter, Thief | — | 3 | 3 |
| Tourist (all 24 sub-classes) | 1 | 1 | 1 |
| Special Snowflake | 1 | 1 | 1 |
| Survivor (X days) | TBD | ~4 | 1 |
| Hoarder (X coin) | TBD | ~4 | 1 |
| Party Animal (X Joiners) | TBD | ~4 | 1 |
| Human Shields (fallen Joiners) | TBD | ~4 | 1 |
| Disposable Help (fallen summons) | TBD | ~4 | 1 |
| **Total** | | **49** (44 at 3 tiers) | **29** |

*The Claude brainstorm (not yet agreed):*

| Group | Achievements | Icon files | Pictures |
|---|---|---|---|
| Death causes | Well-Rounded, Just One More Bite, Friendly Fire, Read the Fine Print, Buried Talent, Poor Aim | 6 | 6 |
| Dying with regrets | You Can't Take It With You, Saving It For Later, Speedrun | 3 | 3 |
| Tiered counters | Tactical Retreat Enthusiast, Tripwire Connoisseur, Bomb Squad, Get Off My Lawn, Cartographer | 20 (4 tiers) | 5 |
| Social disasters | Diplomatic Incident, Riveting Company, It's Not You It's Me, one for `joinerMurdered` | 4 | 4 |
| Collectors | Collected Neuroses, Fashion Victim, Retail Therapy (tiered) | 12 (4 tiers) | 3 |
| Faerie | Fairy Godmother, Fairy Godmugger | 2 | 2 |
| Clutch | Just a Flesh Wound | 1 | 1 |
| **Total** | | **48** (40 at 3 tiers) | **24** |

*Scenarios:*

| What ships | Icon files | Pictures |
|---|---|---|
| User's list as written | 44–49 | 29 |
| User's list, kill counts tiered ×4 | ~67 | 29 |
| User's list + full brainstorm | ~84–97 | 53 |
| Tier frames (made once, reused) | — | +4 |

Minimum art job: **29 pictures + 4 tier frames**, exported as about **49 icon files**. The hand-off prompt for an image-generation agent is `.planning/phases/999.12-achievements-track/ICON-BRIEF.md`.

*Decisions that move the counts:*

- **Tier counts** for Survivor, Hoarder, Party Animal, Human Shields, Disposable Help and the kill counts. Each extra tier adds one icon file per track, but no new picture.
- **Races and classes:** 9 separate achievements (as counted above), or one achievement each that fills up as you go. The single-achievement option cuts 9 files and 9 pictures down to 2 of each (29 pictures become 22).
- **Points:** Play Games gives each game 1,000 points in total. Across 50–90 achievements that is roughly 10–20 points each, which argues for short tier ladders.

**Constraints:** offline-first (no network needed to earn an achievement); no new runtime SDK beyond the existing Play Games plugin; family-friendly copy; needs a signed-in Pixel 7 check (unlock toast plus the Play Games popup), batched into the milestone-close checklist.

Plans:

- [ ] TBD (promote with /gsd-new-milestone when ready — user wants this as its own milestone)

### Phase 999.13: Our own leaderboards instead of Google Play Games boards (PROMOTED → Phases 82–86)

**Goal:** [Captured 2026-09-26, user] Stop relying on Google Play Games leaderboards and run our own global boards. The user's reasoning: "with the privacy being defaulted to on, the competition is ghost-town". Play Games hides a player's scores from other players unless their profile visibility allows it, so the ALL and FRIENDS boards look empty. Players must still be able to opt out; the Compete toggle stays. Our boards should be public by default, and Compete OFF means nothing is ever sent.
**Requirements:** TBD
**Plans:** 0 plans

**Decisions this needs before planning (discuss-phase):**

- **The backend is new territory.** PROJECT.md says the game is offline-first: "the offline constraint relaxes only for opted-in players", and signed-out play makes zero network calls. That rule survives, since only Compete-ON players talk to the server. But a server the author runs is new: hosting, cost, uptime and moderation. Candidates:
  - a small serverless endpoint (e.g. Cloudflare Workers + D1, or Supabase), called with plain `fetch`
  - **no** new client SDK: CLAUDE.md bans analytics SDKs, and Firebase counts as one
- **Identity.** Either keep Play Games sign-in only for the player id and display name, dropping only its leaderboards, or use an anonymous install id plus a chosen handle. Chosen handles need the family-friendly filter (`content/safety-wordlist.js`) and a way to report or rename a bad one.
- **Cheating.** A client-submitted score is trivially forged. The engine is deterministic and serializable, and `buildRunSummary` already carries the seed, the rules/season version, an action count and a hash. So the server can check the run cheaply, or fully replay the seed plus the action log for top-N entries.
- **Scopes.** ME stays local and ALL comes from our server. FRIENDS comes from our own friends list: the user decided on 2026-09-26 to drop Google's friends list too. That work is **Phase 999.14**, which is built together with this item.
- **Store compliance.** The Data Safety form and the privacy policy change, because a score, a handle and an id now leave the device and go to our server, not Google's. The Compete opt-out copy is updated too.
- **Migration.** Keep or retire the Season-1 Play Games boards, and decide what happens to queued `pgsQueue` entries. Play Games achievements (999.12) can stay on Play Games regardless.
- **DAYS farming (to check; captured 2026-09-28, user).** "We need a way to prevent someone from wandering around floor 1 endless to wrack up DAYS on the leaderboard. I'd expect that they would eventually starve to death ... so, maybe it's fine, but let's note it as something to check."
  - **The check:** measure how many DAYS a hero can bank by staying on floor 1 and never descending. Count rations, foraging or healing on floor 1, camp and rest loops, store restocks, and anything else that refills food.
  - **If starvation reliably ends it** at a DAYS count below an honest deep run, it's fine; record the number.
  - **If it doesn't:** candidate fixes are to rank DAYS only with depth (e.g. ties broken by depth, or days counted only after floor N), to cap days per floor, or to let the server's run check (above) flag runs with a long days-to-depth ratio.

**The new leaderboard UX (design handed over 2026-09-28, user):** "This is the new UX for leaderboards." Implement it when this item is promoted. It replaces the Phase 81 panel layout described below.

- **The design:** the Claude Design project https://claude.ai/design/p/fed8909e-860d-496e-9d31-04dd31f14a3c?file=Mazeworld+Leaderboards+v3.dc.html
- **Import it** with the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via `/design-login`). The whole project is readable.
- **Focus file:** `Mazeworld Leaderboards v3.dc.html`. Also read the files it imports: `ios-frame.jsx` and `support.js`.
- **Implement:** `Mazeworld Leaderboards v3.dc.html`.
  - Its frame is iOS, but the target is Android only, so treat the frame as presentation.
  - Keep the house rules: PNG icons, the rail rules, tap-to-move.
  - Plan the UI phase against the design (the UI-SPEC from it).

**What it touches / supersedes:**

- The shell leaderboard stack: `src/browser/playGames.js`, `globalBoards.js`, `pgsQueue.js`, `boardScores.js`, `boardsPanel.js`, `boardsView.js`, `account.js`, `accountChip.js`; plus `content/leaderboards.js` (the Play Games board ids). The Phase 81 panel (ME | ALL | FRIENDS, YOU tag, standing card) is kept as the UI; only its global data source changes.
- **Supersedes most of 999.11.** Per-sub-class boards and an honest global LINEAGE become server queries over one run table, and no Play Console board has to be created for each. Review 999.11 when this is promoted.
- Engine untouched: this is shell and server work, with zero parity fixtures.

Plans:

- [ ] TBD (promote with /gsd-review-backlog or /gsd-new-milestone when ready)

### Phase 999.14: Our own friends list (NOT PLANNED — user, 2026-09-28)

**Goal:** [Captured 2026-09-26, user] "to go along with our own leaderboards, we'll do our own friends list as well. This is better solution than relying on google infrastructure." The FRIENDS scope on the Leaderboards panel reads from a friends list that we host, not from the Play Games friends list and its separate consent prompt. Built together with 999.13, on the same server and identity.
**Requirements:** TBD
**Plans:** 0 plans

**Decisions this needs before planning (discuss together with 999.13):**

- **How players find each other** with no Google contacts and no email: a short shareable friend code, a handle search, or both. An Android share-sheet link ("add me in Delve, Die, Repeat") is a cheap extra.
- **Mutual or follow.** Mutual needs requests, accept, decline and remove. Follow is one-way, with no request to answer.
- **Blocking and privacy.** Block and remove a friend. With Compete OFF the player can't be found or added, and nothing is sent.
- **Family-friendly safety.** Handles pass `content/safety-wordlist.js`. There is no free-text messaging: a friends list only, never chat, which keeps the IARC rating and the moderation load low.
- **Store compliance.** The friend relationships are stored on our server, so they go on the Data Safety form and in the privacy policy alongside 999.13's scores and handle.
- **Offline.** Friend actions need the network; offline they show a short in-voice note, not an error. Signed-out or Compete-OFF play makes zero network calls, as today.

**What it touches:**

- It replaces the Play Games friends path: `requestFriendsAccess()` and the friends scope in `src/browser/globalBoards.js` (D-05..D-07), plus the `friend` flag on each row. The Phase 81 FRIENDS chip and the YOU/FRIEND tags stay as the UI.
- It adds a small friends screen, reached from the ☰ account rows ("account-in-hamburger" ruling): your code, add by code, pending requests, and your friends list.
- Engine untouched; shell and server work only, with zero parity fixtures.

Plans:

- [ ] TBD (promote with 999.13 via /gsd-review-backlog or /gsd-new-milestone)

### Phase 999.15: Review every skill and every spell (BACKLOG)

**Goal:** [Captured 2026-09-27, user] "why does freeze say a d6? Looks like a spell with a to hit roll. So we have spells with to hit rolls? Maybe those rolls need to be double checked. Let's add a backlog item to review every skill and every spell." Audit every spell and every skill/ability end to end. For each one, check what the text promises against what the engine rolls and does, and against canon.
**Requirements:** TBD
**Plans:** 0 plans

**What prompted it (scouted 2026-09-27):**

- **Thrown attack spells have a to-hit roll.** In `engine/magic.js`'s thrown branch (~L598-630), Freeze hits on 6 faces of a d10, and every other thrown spell on 4 faces of a d8. Both are narrowed by Afraid and widened by the school and throw bonuses. The "d6" in Freeze's text (`content/spells.js:87`, "one foe · d6, and frozen solid on a hit") is its DAMAGE die. It reads like a to-hit roll, and the text never states the real to-hit odds.
- The 2026-09-27 universal spell resist (quick 260927-rsx: every foe-targeted spell can be resisted on a half-intel scale) adds a second roll after a thrown spell's to-hit. Its interaction with the to-hit roll belongs in this review.

**Scope for the review (decide at discuss time):**

- **Every spell:** its to-hit roll (if any), damage dice, multipliers, duration, the resist checks (intel, RULES-18 depth control), the school gates, the backfire and fumble odds, and whether the text, the Grimoire, the chips and the foe card state each of those in roll-high form and agree with the engine.
- **Every skill and ability:** its cooldown or once-per-fight rule, auto-hit or forced crit, its bonus terms, who can use it (the hero, Joiners), and the same text-vs-engine agreement.
- **Canon check:** each against the 1994 rulebook. Deviations are recorded as deliberate rulings or fixed.
- **Output:** a per-spell and per-skill audit table (text / engine / canon / verdict), the fixes, and pinned tests. That extends test/unit/authored-ranges.test.js and roll-sign-consistency.test.js to every roll a spell or skill makes.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.16: Itemization pass: every item works as intended, and benefits need the item worn (BACKLOG)

**Goal:** [Captured 2026-09-28, user] "we need to run an itemization pass to make sure all items are working as intended, we have all required systems, etc. For instance, the cloak of regeneration should actually heal every 10 steps for 30 steps. Also, when you use an item and then take that item off, you should lose the items benefit. For instance, if I wear the cloak of flying and use it, I gain flying, and then if I take it off, I should lose that flying condition. We don't want people just putting everything on and stacking benefits without actually wearing the item for the benefit."
**Requirements:** TBD
**Plans:** 0 plans

**Scope for the pass:**

- **Every item audited end to end:** text vs engine vs canon for every treasure, armour, weapon, cloak, jewellery, staff, wand, potion and scroll. Whatever each promises must actually happen: its duration, charges, cooldown and numbers. Output an audit table (item / text / engine / canon / verdict) with the fixes, pinned by tests (authored-ranges style).
- **Missing systems:** list any system the items need that doesn't exist yet: per-step heal-over-time, stack rules, slot limits, whatever turns up. Build or re-rule each one.
- **Cloak of Regeneration (user example):** it should heal **every 10 steps for 30 steps** (three ticks) once used. Today (`content/treasure-tables.js:199`, engine/items.js "knit" case ~L1616) it gives a flat d6 at once, then a 20-square cooldown (260918-w4n's reading of the prototype's "d6 hp back every 20 squares"). It needs a per-step heal-over-time effect, with narration for each tick.
- **Benefits end when the item comes off (user rule):** an item's activated benefit lasts only while that item is worn or held. Take off a used Cloak of Flying and the flying condition ends at once, with narration. This applies to every use-activated worn item (cloaks, rings, amulets, armour activations such as plated, invisibility, flying, regeneration ticks, etc.), so a player can't put everything on, use it all, and stack benefits from items they no longer wear. That needs an "effect source" link from each timed effect to its item and slot, cleared on unequip, drop, sell, swap or destruction, with save/load and a relaunch covered. Joiners are covered too, if their gear activates.
- **Cloak of Strength is inverted (user report 2026-09-28, scouted):** "the cloak of strength is supposed to stop critical hits, but I'm still getting critted. just now I had Braced on from my cloak, and I took a critical hit from a [Chaos?] wolf."
  - The text (`content/treasure-tables.js:180`, `eff:{noCrit:1}`) says "no critical damage lands on you". The engine reads `eff(c,"noCrit")` in engine/combat.js ~L835-846 as the HERO's OWN crit suppression (the Guard/Soldier "your blows never crit" seam, from Phase 15 ECON-08). So the cloak stops YOUR crits, and foe crits against you still land. That's the opposite of what it promises.
  - Fix: the cloak blocks foe crits against the wearer (foe damage and crit paths, plus the member branch for a Joiner wearing it), and stops suppressing the wearer's own crits.
  - Also, its use activation (`act.kind "brace"`) shows the same "Braced" chip as the Fighter's Brace ability (which halves the next blow). Give it its own chip and name, e.g. "Crit-proof" (a clarity bug).
- **Related existing items to fold in:** backlog 999.15 (the spell and skill review) and the 2026-09-27 PARTY_WIDE_ITEM_EFFECTS (Crystal Staff).

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)
