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
- 🚧 **v2.0 Leaderboards** — Phases 65–69 roadmapped 2026-09-23: run record & personal bests, the mock's Leaderboards panel over local bests, opt-in Play Games Services v2 global/friends boards, "you placed X", account chip, compliance close; see `.planning/REQUIREMENTS.md` + PROJECT.md
- 📋 **v1.0 launch tail** — first-run tutorial (UX-06, rebuilt on the v1.6 modular shell) + Google Play production launch (STR-01..04, STR-06)

## Phases

### v2.0 Leaderboards (Phases 65–69) — roadmapped 2026-09-23

Full requirements: `.planning/REQUIREMENTS.md`.

**Milestone gates (apply to every phase below):**

- **Engine gate:** the engine stays pure and deterministic; zero new rng draws touch floor generation; `test/parity/prototype-master.js.txt` is never edited; every new serialized field (season, seed, action count, hash, the bests record) is carved out of all three parity comparables; any fixture a deliberate change moves is measured, declared with before/after in `test/parity/FIXTURE-INVENTORY.md`, and regenerated — no silent blanket regen.
- **Mock stance:** `Mazeworld Leaderboards.dc.html` and `Mazeworld Boards Panel.dc.html` (project `fed8909e-860d-496e-9d31-04dd31f14a3c`, read via the `DesignSync` tool) are the UX and visual spec only — the iOS frame is preview chrome. Toy fields map to canon: squares → `steps`, WILMST → `gold`, EXP → `sp`, lvl → Roman `level`. The standing rulings win: the rail is the one feedback surface, the shipped tab set stays (DEAD keeps its slot), and player text says HP, never WP.
- **Offline constraint, amended for this milestone only:** signed out or with Compete off, the game makes zero network calls and the whole local panel works in airplane mode — the relaxation applies only to an opted-in, Compete-on player.
- **Seasons:** every run summary and every leaderboard carries the `rules`/season version from day one, so a balance change never poisons the all-time boards; personal bests stay all-time locally, tagged by season.
- **Display name:** the Play Games profile name is what shows on global boards — no adventurer-name composite; the adventurer's name and epitaph ride in the score tag and the local graveyard only.

**Working method:** no milestone-level research pass. Phase 67 is flagged `Research: yes` for `gsd-phase-researcher` — it settles the PGS plugin choice, sign-in mechanics, Capacitor 8 / AGP 8.13 compatibility, the score-tag encoding, and LINEAGE's global form together, since all five hinge on the same plugin's API surface. Phases 65, 66, 68 and 69 need no separate research pass — 65/66 build on the codebase's existing `buildRunSummary`/`engineAdapter` keys and the mock, and 68 builds on Phase 67's settled decisions. Full decision record: `.planning/proposed-milestone-leaderboards.md`.

- [x] **Phase 65: Run Record & Personal Bests** - Every death records a durable, season-tagged run summary and updates an all-time personal-bests record that survives the graveyard trim (completed 2026-09-23)
- [x] **Phase 66: Leaderboards Panel — Local** - The DEAD tab becomes the mock's Leaderboards panel, running fully offline across all seven boards on personal bests and the graveyard (completed 2026-09-23)
- [ ] **Phase 67: Play Games Integration & Account Chip** - Opt-in, non-blocking Play Games Services v2 sign-in replaces the settings cog with an account chip and a Compete toggle
- [ ] **Phase 68: Global Boards, Submissions & "You Placed X"** - Signed-in players' deaths submit scores to seasoned global boards, feed the panel's ALL/FRIENDS views, and land a ranked quip on the death card
- [ ] **Phase 69: Compliance & Device Close** - Privacy, Data Safety and the Play Console PGS runbook are ready for the user's console steps, and a signed AAB ships with the milestone's UAT batch

### Phase 65: Run Record & Personal Bests

**Goal**: Every run's outcome is captured durably — a run summary carrying its season/seed/hash, and a personal-bests record that survives the 60-tombstone graveyard trim — so every later phase (the panel, PGS submission, "you placed X") has real data to read instead of inventing a shape.
**Depends on**: Nothing (first phase of the milestone)
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04
**Success Criteria** (what must be TRUE):

  1. Every death produces a run summary (`buildRunSummary`) that also carries a `rules`/season version, the run seed, an action count and a cheap integrity hash, with zero new rng draws and the new fields left out of all three parity comparables
  2. A durable `ddr.bests.v1` record (Capacitor Preferences plus the localStorage mirror, through `mzStorage`) holds the player's best run per board, is tagged by season, is kept all-time, and survives the 60-tombstone graveyard trim
  3. An existing graveyard, the legacy `ddr.best.v1` / `ddr.graveyard.total.v1` keys, and old saves all load without error, and the bests record backfills from the tombstones already on the device
  4. When a run beats a personal best on any board, the death flow announces it in voice, as a card per the card-vs-toast ruling (a toast for anything short of a new best)

**Plans**: 5 plans (3 waves)

Plans:
**Wave 1**

- [x] 65-01-PLAN.md — (wave 1) `state.acts`: the per-validated-action counter, tolerant save whitelist, six parity carve-outs, and a measured zero in FIXTURE-INVENTORY (RUN-01)
- [x] 65-02-PLAN.md — (wave 1) `engine/records.js`: FNV-1a run hash/id, the shared board table, and the pure bests-record ops (update/sanitize/backfill/sort) (RUN-01, RUN-02, RUN-03)
- [x] 65-03-PLAN.md — (wave 1) `content/boards.js` board copy and quip banks, plus the pure `newBestView` view model, safety-scanned (RUN-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 65-04-PLAN.md — (wave 2) the summary gains season/seed/acts/hash; the adapter loads/backfills/persists `ddr.bests.v1`, sets GRAVE_CAP 60, retires `ddr.best.v1`, and adds a one-shot `takeDeathRecord()` (RUN-01..04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 65-05-PLAN.md — (wave 3) the gold NEW PERSONAL BEST block inside THAT IS THAT via the `__mzDeathRecord` parcel (RUN-04)

**Research**: none — `engine/death.js#buildRunSummary`, `src/browser/engineAdapter.js`'s three existing keys, and `mzStorage` carry the file-level shape; `.planning/proposed-milestone-leaderboards.md` has the full record.

### Phase 66: Leaderboards Panel — Local

**Goal**: The DEAD tab becomes the mock's Leaderboards panel, presenting every board from local data alone — the graveyard and the Phase 65 personal-bests record — so the panel is complete and honest before any network call exists.
**Depends on**: Phase 65 (every board and the standing card read the run-summary fields and the bests record Phase 65 builds)
**Requirements**: BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06, BOARD-07, BOARD-08
**Success Criteria** (what must be TRUE):

  1. The panel replaces the DEAD screen, opens from the in-game DEAD tab and from the title screen's VIEW THE DEAD, and its back button returns to wherever it was opened from (title or dungeon)
  2. The header shows LEADERBOARDS, a scope line and the INTERRED count, with a Play Games identity strip and an ALL/FRIENDS toggle beneath it (the strip and toggle show a deliberate signed-out state at this phase — Phase 67 makes them live)
  3. A horizontally scrolling board rail keeps the active chip centred across all seven boards (DEEPEST, LEANEST, LINEAGE, LONGEST, BUTCHERY, PURSE, GRAVEYARD), each with its own mark, title and rule line in voice; each board lists its top ten with rank, avatar, handle, a YOU tag, the adventurer's name, a `RACE SUB · LVL n` line, a value bar and value + unit, all from canon fields (`steps`/`gold`/`sp`/Roman `level`)
  4. When the player's best run misses the top ten, it is pinned below a "NOT IN THE TOP TEN · YOUR BEST RUN" divider; tapping any row expands it to show the cause, the epitaph, and FLOOR/DAYS/SQUARES/KILLS/EXP/WILMST chips
  5. Each board ends with a standing card ("your place · of N") and a per-board footnote in voice (GRAVEYARD's own: "Epitaphs are written by the dungeon, not by you. There is no appeal."); signed out, offline, or with Compete off, the whole panel runs on local data only, with zero network calls made

**Plans**: 7 plans (4 waves)

Plans:
**Wave 1**

- [x] 66-01-PLAN.md — (wave 1) LEANEST re-ranked by squares per floor (re-rank on load, zero fixture movement) and the adapter's in-memory graveyard + lifetime-total read seam (BOARD-02, BOARD-03, BOARD-08)
- [x] 66-02-PLAN.md — (wave 1) `content/boards.js`: the mock's marks, colours, rule lines and footnotes, the signed-out/empty/standing/dock copy and the standing-quip bank, safety-scanned (BOARD-02, BOARD-03, BOARD-07, BOARD-08)
- [x] 66-03-PLAN.md — (wave 1) `src/browser/boardsPanel.js`: the DOM renderer and controller (entry modes, board memory, scope/row toggles, back routing, rail centring) (BOARD-01..08)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 66-04-PLAN.md — (wave 2) `src/browser/boardsView.js`: the pure view model for all seven boards, the standing card, empty and signed-out states (BOARD-02..08)
- [x] 66-05-PLAN.md — (wave 2) the `.mw-bd-*` panel CSS, title-mode tab-bar/rail hiding, text scale and reduced motion (BOARD-01..04, BOARD-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 66-06-PLAN.md — (wave 3) the DEAD tab becomes the panel: `window.__mzBoards`, the classic graveyard screen deleted, the title gate on the adapter, sandbox + shell tests (BOARD-01..04, BOARD-06..08)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 66-07-PLAN.md — (wave 4) VIEW THE DEAD opens the panel in title mode, Android back mirrors the chevron, and the classic graveyard loader and its harness are retired (BOARD-01, BOARD-08)

**Research**: none — `Mazeworld Leaderboards.dc.html` and `Mazeworld Boards Panel.dc.html` (read via `DesignSync`) are the UX/visual spec.
**UI hint**: yes

### Phase 67: Play Games Integration & Account Chip

**Goal**: Players can opt in to Google Play Games Services v2 with non-blocking auto sign-in, and the settings cog becomes an account chip that carries sign-in, sign-out and a Compete toggle — laying the plugin and identity foundation Phase 68's submissions build on.
**Depends on**: Phase 66 (the identity strip and signed-out state Phase 66 built become live once real sign-in exists)
**Requirements**: PGS-01, PGS-02, ACCT-01, ACCT-02
**Success Criteria** (what must be TRUE):

  1. A Capacitor 8-compatible PGS v2 plugin is chosen (from `@modbender/capacitor-play-games`, `@openforge/capacitor-game-connect`, `capacitor-google-game-services`, or a vendored/forked alternative) and wired into the Android build, adding no ads or analytics SDK
  2. PGS auto sign-in runs at launch without blocking play; declining, having no Play Games profile, or a sign-in failure all leave the game fully playable with zero network calls when signed out
  3. The top-bar settings cog becomes an account chip: the Play Games avatar when signed in, a deliberate "nobody" glyph when signed out
  4. Tapping the chip opens a menu offering sign in / sign out, a Compete toggle (off means no submissions and no network calls), and the existing Settings entry

**Plans**: 8 plans (3 waves)

Plans:
**Wave 1**

- [x] 67-01-PLAN.md — (wave 1, checkpoint) read-only review of the @modbender/capacitor-play-games 0.5.0 tarball plus a blocking-human intake ruling (as-is / patch / stop): its load() initializes the PGS SDK at every launch (D-17, D-13) (PGS-01)
- [x] 67-02-PLAN.md — (wave 1) settings gain compete/pgsWelcomed/pgsDevSignedIn; `src/browser/playGames.js` provider seam (lazy native + in-memory fake, no sign-out, reserved Phase 68 methods); `docs/PLAY-GAMES-SETUP.md` console runbook (PGS-01, PGS-02)
- [x] 67-03-PLAN.md — (wave 1) `content/account.js` copy and the pure `src/browser/account.js` chip/sheet/card/identity view model, safety-scanned (ACCT-01, ACCT-02)
- [x] 67-04-PLAN.md — (wave 1) the Leaderboards identity strip goes live: signed-in avatar/name/PLAY GAMES · SIGNED IN, coming-online notes, `createBoardsPanel`'s injected identity() seam (ACCT-01)
- [x] 67-05-PLAN.md — (wave 1) shell markup + CSS: the band-2 chip beside ☰, the title-screen chip, the account bottom sheet, 44×44 faces, z-order over the title, the band-2 width budget (ACCT-01, ACCT-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 67-06-PLAN.md — (wave 2) exact 0.5.0 install with lockfile integrity, WebView vendoring, APP_ID placeholder resource + manifest, the ruling's build-time patch, debug build and Gradle ads/analytics audit (PGS-01)
- [x] 67-07-PLAN.md — (wave 2) `src/browser/accountChip.js`: chip/sheet renderers and the account controller (silent non-blocking boot, Compete, welcome/failed cards, one attempt at a time) (PGS-02, ACCT-01, ACCT-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 67-08-PLAN.md — (wave 3) shell wiring: provider by platform, both chips, the sheet and back button, rail cards parked until the dungeon is visible, the boards identity seam, docs, and the last-wave debug APK (PGS-02, ACCT-01, ACCT-02)

**Research**: yes — `gsd-phase-researcher` decides the plugin (maintenance, Capacitor 8 / AGP 8.13 compatibility, sign-in API surface), and — folded into this same pass rather than split into Phase 68 — settles the score-tag encoding format and LINEAGE's global form (per-combo boards vs. client-side grouping vs. local-only), since both hinge on the chosen plugin's leaderboard/score-tag API. Phase 68 implements against this phase's decisions with no separate research pass.
**UI hint**: yes

### Phase 68: Global Boards, Submissions & "You Placed X"

**Goal**: A signed-in, Compete-on player's death submits real scores to the current season's global boards, the panel's ALL and FRIENDS views come alive, and the death flow closes with a ranked quip in voice.
**Depends on**: Phase 65 (submits the run-summary fields Phase 65 built), Phase 67 (needs the chosen plugin, sign-in state, Compete toggle and the settled tag/LINEAGE decisions)
**Requirements**: PGS-03, PGS-04, PGS-05, PGS-06, PLACE-01, PLACE-02
**Success Criteria** (what must be TRUE):

  1. Each death of a signed-in, Compete-on player submits one score per board to the current season's leaderboard IDs, with the row's details (adventurer name, race/sub/level, and the rest of what the panel shows) packed into the 64-char score tag per Phase 67's encoding
  2. A death while offline or signed-out-but-competing queues its submissions durably; they flush once connectivity and sign-in return, and no score is ever submitted twice
  3. The panel's ALL and FRIENDS views are fed by PGS top-scores, the friends collection and the player's own rank, with LINEAGE's global form built exactly as Phase 67's research settled it
  4. Leaderboard IDs are keyed per board per season; bumping the season points new submissions at the new IDs while old-season boards stay readable and are never written again
  5. After a run's scores are submitted, the death flow shows the player's rank as a quip in voice from a `content/` bank; a run submitted from the offline queue reports its placement on the next successful flush, and a signed-out or Compete-off run shows no rank line and no error

**Plans**: 7 plans (3 waves)

Plans:
**Wave 1**

- [ ] 68-01-PLAN.md — (wave 1) `src/browser/scoreTag.js` (the v1 64-char tag, name truncation, defensive decode), `src/browser/boardScores.js` (D-16 encodings, fallback decode, ID lookup), `content/leaderboards.js` (season → five placeholder IDs), runbook leaderboards + season-bump sections (PGS-03, PGS-06)
- [ ] 68-02-PLAN.md — (wave 1) `src/browser/playGames.js` leaderboard methods on the native provider and the fake (submitScore, loadTopScores, loadPlayerScore, loadStanding, friendsAccess; validated, image-free, time-bounded) (PGS-03, PGS-04, PGS-05)
- [ ] 68-03-PLAN.md — (wave 1) `content/placement.js` rank-quip bank + deferred card + season-drop line, the panel's global copy, and the pure `src/browser/placement.js` view model, safety-scanned (PLACE-01, PLACE-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 68-04-PLAN.md — (wave 2) the adapter's run-recorded listener and `src/browser/pgsQueue.js` (ddr.pgsqueue.v1: enqueue-then-flush, ack per run+board, season drop, placeholder skip, purge, single-flight backoff, DEEPEST standing) (PGS-03, PGS-04, PGS-06)
- [ ] 68-05-PLAN.md — (wave 2) `src/browser/globalBoards.js`: per season/board/scope fetch + 5-minute cache, stale/unreachable/closed/consent states, LINEAGE's 25-score DEEPEST sample, zero calls when inactive (PGS-05)
- [ ] 68-06-PLAN.md — (wave 2) the panel's live ALL/FRIENDS views: global rows with YOU/FRIEND and the pinned best run, real-rank standing, consent button, SEASON label + picker, LINEAGE grouping, CSS (PGS-05, PGS-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 68-07-PLAN.md — (wave 3) shell wiring: death → queue, flush triggers, Compete-OFF purge, the THAT IS THAT rank line (`window.__mzPlacement`), the parked deferred card, the season-drop Oracle line, the panel's global seams, docs (PGS-03, PGS-04, PGS-05, PLACE-01, PLACE-02)

**Research**: none — builds directly on Phase 67's plugin, tag-encoding and LINEAGE-form decisions.
**UI hint**: yes

### Phase 69: Compliance & Device Close

**Goal**: The privacy, Data Safety and Play Console story matches the shipped PGS integration, the console-side setup is handed to the user as a clear runbook rather than blocking the milestone, and the milestone closes on a signed AAB with its own written UAT batch.
**Depends on**: Phase 68 (documents and ships the complete, submitting integration)
**Requirements**: COMPLY-01, COMPLY-02, COMPLY-03, COMPLY-04
**Success Criteria** (what must be TRUE):

  1. The privacy-policy page is updated to describe the opt-in PGS Player ID and scores collection, and states that nothing else leaves the device
  2. The Data Safety answers are drafted in the repo (Player ID and app activity collected, required for app functionality, not shared, only when signed in) and match a fresh SDK/dependency audit of the shipped build
  3. A Play Console PGS setup runbook is written covering enabling PGS, linking the SHA-1 of the Play App Signing key, creating the leaderboard IDs per board per season, and publishing the config plus the tester allow-list; because these are Play Console actions only the user can perform, the phase surfaces them as a human checkpoint / deferred item and does not block closure on the user completing them
  4. A signed AAB with PGS goes to the testing track, and the milestone's Pixel 7 batch is written as `docs/UAT-v2.0.md` (sign-in, decline, offline queue and flush, the panel on every board, the "you placed X" card, the account chip, airplane mode) as one batched checklist per the deferred-UAT protocol — not run mid-milestone

**Plans**: TBD
**Research**: none

<details>
<summary>✅ v1.9 The Gear Screen (Phases 61–64) — CODE-COMPLETE 2026-09-23, archived 2026-09-23 (override closeout; Play 1.9.0 / vc8 built for closed testing; device UAT 3 of 24 walked, the rest deferred to play sessions)</summary>

Full details: `.planning/milestones/v1.9-ROADMAP.md`. Audit: `.planning/milestones/v1.9-MILESTONE-AUDIT.md`.

- [x] **Phase 61: Gear Rules & Store Purchase Fix** - The combat gear lock (`gearRefused`), store purchases that always deliver (pre-payment refusals, not-better → bag), and the explained upgrade line (completed 2026-09-23)
- [x] **Phase 62: Gear Tab Layout Rebuild** - Slim AR/WILMST header, five fixed WORN rows with USE/ACTIVE/COOLING, bag meter + tagged cards, per-type consumables, ALSO ON YOU; the cross-screen agreement sweep (completed 2026-09-23)
- [x] **Phase 63: Action Sheet, Combat Lock & Accessibility** - One bottom sheet for every equip/swap/unequip/use/drop, with engine-true greyed reasons, a tap-again DROP, live combat greying, and back/TalkBack/reduced-motion support (completed 2026-09-23)
- [x] **Phase 64: Device Close & UAT Batch** - v1.9 debug APK on the Pixel 7 over wireless adb; `docs/UAT-v1.9.md` 3/24 walked (A1–A3 pass), 21 deferred (completed 2026-09-23)

</details>

<details>
<summary>✅ v1.8 Sound, Motion & Set Dressing (Phases 56–60) — CODE-COMPLETE 2026-09-22, archived 2026-09-22 (verified closeout; device UAT spread over the user's play sessions: 30 of 31 checks open)</summary>

Full details: `.planning/milestones/v1.8-ROADMAP.md`. Audit: `.planning/milestones/v1.8-MILESTONE-AUDIT.md`.

- [x] **Phase 56: Sound Effects & Audio Settings** - 30 bundled clips through `src/browser/sfx.js`: family cries, rotating variation, 8-voice overlap, and a Sound Off that opens no audio device (completed 2026-09-22)
- [x] **Phase 57: Map & HUD Layout Band** - The rail overlays the map, taps never double as a move, the HUD is stacked bands with a ☰ menu, and Table-7 darkness shows on the map (completed 2026-09-22)
- [x] **Phase 58: Motion & Pacing** - Camera glide, panel motion, a readable combat beat, and typed rail/encounter text, all with a reduced-motion path (completed 2026-09-22)
- [x] **Phase 59: Party Animation & Dungeon Set Dressing** - An idle/step party sprite with a soft glow, plus deterministic, non-interactive `set_dungeon_*` props with a Settings toggle (completed 2026-09-22)
- [x] **Phase 60: Performance & Footprint Close** - Pixel 7 side by side against v1.7: cold start +5.1 %, step p95 improved, AAB +4.5 %; no regression (completed 2026-09-22)

</details>

<details>
<summary>✅ v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve (Phases 50–55) — CODE-COMPLETE 2026-09-22, archived 2026-09-22 (Pixel 7 UAT batch deferred: 25 checks + the four-run DR bar, plus v1.6's 26 and v1.5's 140)</summary>

Full details: `.planning/milestones/v1.7-ROADMAP.md`. Audit: `.planning/milestones/v1.7-MILESTONE-AUDIT.md`.

- [x] **Phase 50: Character Roller Fix** - The character the roller's reels reveal is exactly the character that lands on the Hero tab — no second roll, no stale pending state, no label drift; shell-only, engine/fixtures untouched (completed 2026-09-20)
- [x] **Phase 51: Initiative Once Per Combat** - Initiative rolls once in `startCombat`/`fight`, the per-round re-roll is deleted so a foe never takes two turns back to back, and the result is narrated once per fight in the Oracle and fight log (completed 2026-09-20)
- [x] **Phase 52: Foe Cadence & Damage Curve** - A foe swings its ordinary attack count once per round (never stacked with a firing ability), the Bat/Rat and China Wolf floor-5 fights are re-measured in band, and every flat-damage cliff (Herman's 25 × multiplier) is smoothed by a bot-audited damage curve (completed 2026-09-20)
- [x] **Phase 53: Joiner Level Cap** - A Joiner's level never exceeds the floor it's met on (promoted from backlog 999.2), with the level-shallower fixtures declared/regenerated and the early-Joiner power shift measured (completed 2026-09-20)
- [x] **Phase 54: Four-Band Retune & Roster Decision** - `engine/difficulty.js` is reshaped toward the four recorded bands (Filter 1–4 / Wall 5–8 / Breakaway 9–15 / Endgame 16–20, average run ends floor 5–7), and the tier-3/5 roster (Herman, Drarl, Vampire, Djinni) gets a recorded per-creature decision (completed 2026-09-22)
- [x] **Phase 55: Human DR Round** - The twice-deferred human verdict (TUNE-07 → TUNE-09) runs once on the Pixel 7 against the post-retune debug APK, and the milestone closes on the recorded result (completed 2026-09-22)

</details>

<details>
<summary>✅ v1.6 Shell Debt & Dead Code (Phases 44–49) — CODE-COMPLETE 2026-09-20, archived 2026-09-20 (Pixel 7 UAT batch pending: 26 checks + the v1.5 140)</summary>

Full details: `.planning/milestones/v1.6-ROADMAP.md`. Audit: `.planning/milestones/v1.6-MILESTONE-AUDIT.md`.

- [x] **Phase 44: Retire the Classic Engine from the Shell** - The 16 dead pre-extraction mirrors and everything only they reach are gone from `mazeworld.html`, the Hero dossier reads `content/flavor.js`, and the drift-tripwire tests guard `engine/`/`content/` instead — expect −2k lines, zero engine bytes (completed 2026-09-19)
- [x] **Phase 45: Collapse the Phase 37 Hedges** - One worn-model path everywhere: every `newRun` creates `c.worn`, every load reconciles unconditionally, no `wornSlots` option anywhere; the fixtures that move are measured, declared and regenerated — the milestone's only fixture-moving phase (completed 2026-09-19)
- [x] **Phase 46: Honest Names, Dead Exports & the Tutorial Decision** - `toasts.js` becomes `narrationLines.js` with exports named for what they do, `winGame`/`state.won` and the dead toast-lifetime exports are deleted, no identifier is named after a retired mechanism, and `tutorial.js` is decided (delete or park), one rename per commit (completed 2026-09-19)
- [x] **Phase 47: Shell Modularisation** - The Gear tab, Hero tab and Store screen render from `src/browser/gearTab.js` / `heroTab.js` / `storeScreen.js` with source-pin tests; `mazeworld.html` is a mount point (5,621 lines, re-baselined from the < 5,000 target by user ruling) with the `window.__mz*` bridge listed in one place (completed 2026-09-19)
- [x] **Phase 48: Stale Docs, Comments & Test Names Purge** - Every comment, `docs/*.md` page, `.claude/CLAUDE.md` row and test name describes the game as it is — D-pad, toasts-as-UI, dead classic mirrors, `wornSlots`, retired counters and iOS rows are gone, proven by a recorded grep list over the final layout (completed 2026-09-20)
- [x] **Phase 49: Measure-First Perf Pass** - `paint()` re-render and `draw()` per step are measured on the Pixel 7 and recorded in `docs/PERF-BASELINE.md`; only a measured ≥ 16 ms hotspot or user-confirmed jank gets code — otherwise the phase closes with the numbers and no diff (completed 2026-09-20)

</details>

<details>
<summary>✅ v1.5 Meaningful Choices — Spells, Gear & Abilities (Phases 36–43) — CODE-COMPLETE 2026-09-18, archived 2026-09-19 (Pixel 7 UAT batch pending: 140 checks)</summary>

Full details: `.planning/milestones/v1.5-ROADMAP.md`. Audit: `.planning/milestones/v1.5-MILESTONE-AUDIT.md`.

- [x] **Phase 36: Balance Foundation, Effect Timers & Small Independent Wins** - The BEFORE class-matrix pin is captured before any new power lands, a general-purpose effect/cooldown/timer model exists for later phases to build on, dead foes can never be targeted, Cutthroats can accept (and occasionally lose) a Joiner, and any hero can dismiss one from the Company panel. (completed 2026-09-17)
- [x] **Phase 37: Equipment Slot Model & eff() Refactor** - One worn item per slot type, with a narrated migration for any old save that illegally has two — the widest-blast-radius change in the milestone, landed alone. (completed 2026-09-17)
- [x] **Phase 38: Melee Active Abilities** - Fighters and Thieves get a rolled pool of class-flavored active abilities with cooldowns, plus select passive skills converted to actives, all surfaced in the combat ABILITIES submenu. (completed 2026-09-18)
- [x] **Phase 39: Gear, Magic Items & One-Shot Tools** - Weapons/armor are rebalanced for real trade-offs, every activatable magic item follows one use-effect-cooldown model, and rope/ladder/torch give players a consumable answer to a specific hazard each. (completed 2026-09-18)
- [x] **Phase 40: Spell Rework** - Combat spells are differentiated by niche instead of a damage ladder, every utility spell has a felt effect, every Wizard sub-class starts with a damage spell, Detect Magic is renamed and time-boxed, and scribed scrolls are instantly castable. (completed 2026-09-18)
- [x] **Phase 41: Terrain, Darkness & Phobias** - Water squares cost extra movement and can scare swimmers, a dark square fogs the view to a 3×3 window, and every phobia has a real, once-per-entry trigger. (completed 2026-09-18)
- [x] **Phase 42: Flee Retune & Consolidated Balance Close** - Flee odds are lower and shown transparently, and the ONE consolidated AFTER class-matrix run verifies abilities + gear + spells together against the depth-20 target. (completed 2026-09-18)
- [x] **Phase 43: Clarity Pass** - Every costly line names its cause, every loot offer shows who can use it, ration math is honest, and the Gear screen splits into ON YOU and BAG. (completed 2026-09-18)

</details>

<details>
<summary>✅ v1.4 Combat & Map Screens (Phases 34–35) — SHIPPED 2026-09-16 (device round closed 2026-09-17)</summary>

Full details: `.planning/milestones/v1.4-ROADMAP.md`.

- [x] Phase 34: Combat Screen Rebuild - The encounter panel becomes the mock's full-screen layout (header, foes, YOUR LOT, › log, four-action bar with submenus), with the Fight! gate and the loot/flee/death endings folded into the same screen, engine untouched, validated on the Pixel 7. (completed 2026-09-16)
- [x] Phase 35: Map Screen Rebuild - The map tab becomes the mock's column: HUD + condition chips, tap-to-step viewport (no D-pad), the bottom rail that replaces every toast and carries every decision, the major overlay for encounters/descents/death, and the MARKS/CENTRE/MAKE CAMP chips with their sheets — engine untouched, validated on the Pixel 7. (completed 2026-09-16)

</details>

<details>
<summary>✅ v1.3 Feel, Loot & Combat Flow (Phases 28–33) — SHIPPED 2026-09-16 (device UAT batch pending; UIF-04 dropped to UX-06)</summary>

Full details: `.planning/milestones/v1.3-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.3-phases/`.

- [x] **Phase 28: Armor Integrity & Durability** - Armor behaves exactly as the screen says: the soak-vs-wear rule is audited and decided, durability lives on the item, and every armor outcome is legible (completed 2026-09-15)
- [x] **Phase 29: End-of-Combat Loot & Bag Cap** - Foe drops become a real, presented decision after combat, gated by one consistent bag-cap system, with bigger bags as a treasure path (completed 2026-09-15)
- [x] **Phase 30: Combat Narrative & Input — Research** - A written, decision-ready survey of combat-feedback UI patterns exists, with a recommended design for this game's combat flow agreed before any implementation begins (completed 2026-09-16)
- [x] **Phase 31: Combat Start Gating & Effect Hygiene** - Combat only truly starts on Fight!, every refusal explains itself, and every consumable/condition behaves and expires honestly (completed 2026-09-16)
- [x] **Phase 32: Combat Narrative & Input UI Build** - The chosen combat-feedback design is built — round narrative in one place, one-tap move-on, decision buttons safe from D-pad thumb-spam — then proven on-device (completed 2026-09-16)
- [x] **Phase 33: UI Feel & Store Polish** - Gear panel, map, tutorial toggle, toolbar layout, and store stock all get their remaining polish pass, done once against the finished combat UI (completed 2026-09-16)

</details>

<details>
<summary>✅ v1.2 Class Pass & Mass Playtest (Phases 22–27) — SHIPPED 2026-09-15 (override closeout: TUNE-07 deferred by user)</summary>

Full details: `.planning/milestones/v1.2-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.2-phases/`.

- [x] **Phase 22: Class-Aware Harness & BEFORE Matrix** - Force any class/sub-class/race through the bot with a sub-class-aware policy, print a ranked 144-combo matrix, and capture the BEFORE snapshot before any identity change lands (completed 2026-09-14)
- [x] **Phase 23: Casters Can Act** - Fix the three "cannot act" states and guarantee every fresh Magic User a day-one attack spell (completed 2026-09-14)
- [x] **Phase 24: Every Sub-class and Race: One Good, One Bad** - Every sub-class and race gets a code-verified good and bad, flavor text matches the mechanics, and an identity-contract test proves it (completed 2026-09-14)
- [x] **Phase 25: Nothing Happens Silently (Feature Feedback)** - Every class/sub-class/racial feature that fires or blocks is narrated in the Oracle and as a toast; enemy hits are unmistakable from player hits/misses (completed 2026-09-15)
- [x] **Phase 25.1: Device Feedback Batch** - Card only for decisions/big updates, minor events toast-only, Oracle fills the screen, Joiner swap with snark, Joiners fight by class, camp refusal states the numbers (completed 2026-09-15)
- [x] **Phase 26: Mass Playtest & Class-Pass Ledger** - An AFTER matrix on the post-pass engine ranks over/under-performers with a fun-band verdict per row, committed to `docs/CLASS-PASS.md` (completed 2026-09-15)
- [x] **Phase 27: Delve-to-Death Retune** - The deferred TUNE-04 re-attempt on the corrected player power, closed by a human DR round on the Pixel 7 (completed 2026-09-15; TUNE-07 verdict deferred by user)

</details>

<details>
<summary>✅ v1.1 Monster Balancing & Abilities (Phases 17–21) — SHIPPED 2026-09-14 (override closeout: TUNE-04 retune deferred)</summary>

Full details: `.planning/milestones/v1.1-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.1-phases/`.

- [x] **Phase 17: Fixture Inventory & Foe-Turn Refactors** - Document which bestiary creatures each parity fixture rolls and extract shared foe-turn helpers before any bestiary or ability behavior changes land (completed 2026-09-13)
- [x] **Phase 18: Bestiary Rebalance & Canon Combat Fixes** - Review every creature's stats against its intended depth band and land canon-accurate combat modifiers (armor, half-damage, type multipliers, slow) (completed 2026-09-13)
- [x] **Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance** - Foes cast, drain, debuff, heal, and summon via a data-driven ability system; the player's Intelligence resists incoming foe magic (completed 2026-09-14)
- [x] **Phase 20: Parley Balance & Language System** - Fix parley's payout/spam dominance and wire Language/Helm-of-Knowledge fluency into the same bonus term (completed 2026-09-14)
- [x] **Phase 21: Consolidated Difficulty Retune** - The ONE retune across party power, economy, monster power, ability threat, and parley numbers, closed out by a human DR-round sign-off (completed 2026-09-14)

</details>

<details>
<summary>✅ v1.0 Delve, Die, Repeat (Phases 1–16 + 04.1/04.2) — SHIPPED 2026-09-13 (internal testing)</summary>

Full details: `.planning/milestones/v1.0-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.0-phases/`.

- [x] Phase 1: Engine Extraction & Determinism (10/10 plans) — completed 2026-09-08
- [x] Phase 2: Android Packaging & Native Persistence (4/4 plans) — completed 2026-09-08
- [x] Phase 3: Endless Descent & Difficulty Balance (3/3 plans) — completed 2026-09-08
- [x] Phase 4: Mobile Presentation, Controls & Onboarding (10/11 plans + DR1–DR18) — 04-10 tutorial carried forward (UX-06)
- [x] Phase 04.1: Rules Review & Wiring (6/6 plans) — completed 2026-09-09
- [x] Phase 04.2: Bug Fixes & Text Polish (5 batches) — completed 2026-09-09
- [x] Phase 5: Voice, Content & Graveyard (3/3) — completed 2026-09-09
- [~] Phase 6: Google Play Compliance & Launch — store entry + internal-testing track live 2026-09-10 (STR-05 ✓); production launch carried forward (STR-01..04, STR-06)
- [x] Phases 7–11: Joiners / Party System — completed 2026-09-09 (PARTY-10 retune carried forward)
- [x] Phases 12–16: Economy & Item Balancing — completed 2026-09-10 (deep tuning carried forward)

</details>

## Deferred / Not This Milestone

- **Pixel 7 UAT batches** — `docs/UAT-v1.6.md` (26 checks, from the 44–47 VERIFICATION lists) and `docs/UAT-v1.5.md` (140 checks, never run), both against APK `c0cdbae` (on the phone at v1.6 close); findings become quick tasks or a UAT gap plan, never ad-hoc edits.
- **UX-06** first-run tutorial — deliberately last; rebuilt on the Phase 47 modular shell (the reason SHELL-01..03 exist). Includes the UIF-04 on/off toggle dropped from v1.3.
- **STR-01..04/06** Google Play production launch (Data Safety audit, privacy page, listing, IARC, pricing, rollout).
- **`storeRoll` for the bots** — the tuning harness still plays the frozen store roll; **the two structural v1.5 AFTER patterns** (Magic Users gain nothing from the class-gated ability system; Wilmsry's racial edge) — both carried forward past v1.7 per `REQUIREMENTS.md`'s Future Requirements (TUNE-06/07 are now in scope this milestone as TUNE-08/09, Phases 54–55).
- Store screen restyle to the dark vocabulary (Phase 47 moves the store into `storeScreen.js` unchanged — the restyle edits that module later).
- Dice-mode setting.
- Haptics polish; the unguarded button set from 32-03 (store rows, drop shelf, `a-evt`, `btn-again`, spell menu).
- Climb dice payload (`roll`/`need` on the four climb events) — carried over from v1.4 as a post-UAT quick task.
- Shell debt noted in the v1.5 audit but not in v1.6's requirements: the unreachable parley fluency-2 branch (`canParley`'s Magical tier, `wilmsryVsMagical`) and the `railCardFor` tie-break — fold into Phase 44's orphan sweep if they fall out for free, otherwise a quick task.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 65. Run Record & Personal Bests | v2.0 | 5/5 | Complete    | 2026-09-23 |
| 66. Leaderboards Panel — Local | v2.0 | 7/7 | Complete    | 2026-09-23 |
| 67. Play Games Integration & Account Chip | v2.0 | 7/8 | In Progress|  |
| 68. Global Boards, Submissions & "You Placed X" | v2.0 | 0/7 | Planned | - |
| 69. Compliance & Device Close | v2.0 | 0/TBD | Not started | - |
| 61. Gear Rules & Store Purchase Fix | v1.9 | 4/4 | Complete    | 2026-09-23 |
| 62. Gear Tab Layout Rebuild | v1.9 | 3/3 | Complete    | 2026-09-23 |
| 63. Action Sheet, Combat Lock & Accessibility | v1.9 | 5/5 | Complete    | 2026-09-23 |
| 64. Device Close & UAT Batch | v1.9 | 2/2 | Complete    | 2026-09-23 |
| 56. Sound Effects & Audio Settings | v1.8 | 4/4 | Complete    | 2026-09-22 |
| 57. Map & HUD Layout Band | v1.8 | 5/5 | Complete    | 2026-09-22 |
| 58. Motion & Pacing | v1.8 | 7/7 | Complete    | 2026-09-22 |
| 59. Party Animation & Dungeon Set Dressing | v1.8 | 5/5 | Complete    | 2026-09-22 |
| 60. Performance & Footprint Close | v1.8 | 3/3 | Complete    | 2026-09-22 |
| 50. Character Roller Fix | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 51. Initiative Once Per Combat | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 52. Foe Cadence & Damage Curve | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 53. Joiner Level Cap | v1.7 | 2/2 | Complete    | 2026-09-20 |
| 54. Four-Band Retune & Roster Decision | v1.7 | 7/7 | Complete    | 2026-09-22 |
| 55. Human DR Round | v1.7 | 0/0 | Complete    | 2026-09-22 |
| 44. Retire the Classic Engine from the Shell | v1.6 | 4/4 | Complete    | 2026-09-19 |
| 45. Collapse the Phase 37 Hedges | v1.6 | 3/3 | Complete    | 2026-09-19 |
| 46. Honest Names, Dead Exports & the Tutorial Decision | v1.6 | 4/4 | Complete    | 2026-09-19 |
| 47. Shell Modularisation | v1.6 | 5/5 | Complete    | 2026-09-19 |
| 48. Stale Docs, Comments & Test Names Purge | v1.6 | 5/5 | Complete    | 2026-09-20 |
| 49. Measure-First Perf Pass | v1.6 | 2/2 | Complete    | 2026-09-20 |
| 36. Balance Foundation, Effect Timers & Small Independent Wins | v1.5 | 6/6 | Complete    | 2026-09-17 |
| 37. Equipment Slot Model & eff() Refactor | v1.5 | 4/4 | Complete    | 2026-09-17 |
| 38. Melee Active Abilities | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 39. Gear, Magic Items & One-Shot Tools | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 40. Spell Rework | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 41. Terrain, Darkness & Phobias | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 42. Flee Retune & Consolidated Balance Close | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 43. Clarity Pass | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 34. Combat Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 35. Map Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 28–33 | v1.3 | 16/16 | Shipped | 2026-09-16 |
| 22–27 (+25.1) | v1.2 | 31/31 | Shipped (override closeout: TUNE-07 deferred by user) | 2026-09-15 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.6 (tutorial rebuilds on the modular shell) | - |

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

### Phase 999.5: Combat screen & Oracle readability (BACKLOG)

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

### Phase 999.6: Engine rules fixes from the device rounds (BACKLOG)

**Goal:** [Captured from the 2026-09-21 Pixel 7 device round] Five rules bugs the fitted build exposed: a free mid-fight re-arm, a store purchase that charges then refuses, a Summoner holding spells it cannot cast, Table-4 HP dots that compound max HP geometrically, and a wilmst cache that still pays far too much.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (5):**

- `todos/pending/2026-09-21-no-equipping-or-swapping-gear-during-combat.md` — `equipItem` / `unequipSlot` / `wearItem` carry no `state.combat` gate and the Gear tab stays live mid-fight; wants an engine refusal + disabled rows (`engine/movement.js:523` is the existing gate pattern).
- `todos/pending/2026-09-21-store-purchase-charged-then-rejected-as-not-an-upgrade-spike.md` — `buyFrom` deducts gold and marks the row sold BEFORE `takeItem` can reject `notBetter`; a purchase must always deliver or refuse before charging.
- `todos/pending/2026-09-21-summoner-rolls-freeze-it-cannot-cast-hide-uncastable-spells-.md` — chargen's `rollGrimoire` ignores the `mu-chart.js` school gate; plus the user ruling that the combat menu HIDES level-locked spells (reverses the earlier disabled-but-visible CONTEXT decision).
- `todos/pending/2026-09-21-table-4-hp-dots-compound-max-hp-geometrically-regression.md` — the "+25 HP" row adds `0.6 × CURRENT maxWP` permanently (×1.6 per pull, compounding) and the toll row then takes 36 % of the inflated pool; a 54-05 regression that also inflates the fit's bot heroes.
- `todos/pending/2026-09-21-red-dot-wilmst-cache-still-pays-far-too-much.md` — `WILMST_CACHE_PER_DEPTH = 300` flat × depth; wants its own cut (~100 × depth) or a derived-rng roll.

**Engine gate applies:** every one of these is a rules change — measure the moved parity fixtures first, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, regenerate only those, master never edited, bot readout before/after.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Content accuracy, tooling & the open climb ruling (BACKLOG)

**Goal:** [Captured 2026-09-21/22] The odds and ends from the device rounds: sub-class blurbs that hide their own gates, a fit tool whose replay-resume diverges, and the CLIMB IT retry card that went stale when Phase 54 made climbs one-and-done.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (3):**

- `todos/pending/2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md` — the Summoner blurb never mentions the level-3 offense gate; audit every `SUB_NOTE` / `RACE_NOTE` against `MU_CHART` + the Phase 24 identity table. Content only.
- `todos/pending/2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md` — `+Infinity` scores serialise as `null`, so a resumed walk takes a different step after the first rejected candidate; per-block stdout was also truncated. Tooling only.
- `todos/pending/2026-09-22-climb-leap-retry-card-is-stale-under-one-and-done.md` — **needs a user ruling:** A (retire the retry) vs B (pre-roll CLIMB / USE TOOL / TURN BACK prompt — the user's stated preference; no rng until commit). Keep the ladder/rope option either way; `mapMarks.js` crevice copy reads pre-one-and-done too.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.8: Unify the two darkness mechanisms (BACKLOG)

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

### Phase 999.9: Android 15/16 edge-to-edge, deprecated window APIs, large-screen orientation (BACKLOG)

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
