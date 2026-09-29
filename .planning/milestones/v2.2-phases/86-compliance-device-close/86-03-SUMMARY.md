---
phase: 86-compliance-device-close
plan: 03
subsystem: docs
tags: [play-games-retirement, release-checklist, firestore-rules-cutover, leaderboards, bug-reports]

# Dependency graph
requires:
  - phase: 85-play-games-out-our-board-in
    provides: "Play Games code fully removed (85-06); docs/PLAY-GAMES-SETUP.md and test/unit/play-games-runbook.test.js deliberately left untouched for this plan"
  - phase: 83-leaderboard-server
    provides: "the transition rules config (firebase.transition.json/firebase/firestore.transition.rules) and the ten-probe --probe-rules tool this plan's checklist cites"
provides:
  - "docs/PLAY-GAMES-SETUP.md retired to a 20-line notice pointing at LEADERBOARDS.md and the former runbook's last commit (a217d032)"
  - "docs/LEADERBOARDS.md section 6: 'Until the 2.2 release: the transition config' and 'Release-day cutover (2.2)' subsections"
  - "docs/LEADERBOARDS.md section 16: 'Retiring Google Play Games (Play Console cleanup)' — the listed user step, gated on 2.2 reaching testers"
  - "docs/RELEASING.md: '## Release 2.2.0: the ordered checklist' (9 numbered steps + the later Season 1 reset), replacing the stale v2.1 console checklist"
  - "docs/BUG-REPORTS.md: a pending 'Release-day --probe-rules results (2.2.0)' subsection with the ten probe names, and section 10 repointed at LISTING.md/apps.astro"
  - "test/unit/compliance-docs.test.js (8 tests) replacing test/unit/play-games-runbook.test.js"
affects: ["86-04 (store-listing/LISTING.md's audits cite this plan's release-checklist step 2 and section 16)", "86-05 (docs/UAT-v2.2.md section 0 cites RELEASING.md's checklist and LEADERBOARDS.md section 16 as the user's console/store tasks)", "the eventual 2.2.0 release build (RELEASING.md's checklist is the operator's script)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A single ordered release checklist in RELEASING.md, instead of scattering release-day steps across LEADERBOARDS.md/BUG-REPORTS.md/UAT — those docs point INTO the checklist by step number rather than duplicating it"

key-files:
  created:
    - test/unit/compliance-docs.test.js
  modified:
    - docs/PLAY-GAMES-SETUP.md
    - docs/LEADERBOARDS.md
    - docs/RELEASING.md
    - docs/BUG-REPORTS.md
  deleted:
    - test/unit/play-games-runbook.test.js

key-decisions:
  - "docs/LEADERBOARDS.md section 16 is the retired runbook's replacement destination (the plan's own next-free-number guess of 16 was correct — sections 1-15 were untouched by Phases 83-85 since the plan was written)"
  - "The three general bullets at the end of the old '## After the push' section (android/version.properties as the versionCode/versionName source, android:release-vs-play:release, the Pixel-7-can't-hold-both-signers note) were kept, not deleted — they contain no stale Play Games content and the new checklist's step 2 references the android:release/play:release distinction directly"
  - "The toolchain-pin section keeps exactly one 'Play Games' mention (history: 'the plugin that originally motivated this pin... was removed... in 2.2') — the acceptance criteria allow up to 3 such mentions inside the checklist or the pin's own history sentence; this plan's edits leave only 1"

patterns-established: []

requirements-completed: [COMP-03]

coverage:
  - id: D1
    description: "docs/PLAY-GAMES-SETUP.md is retired: a short notice pointing at docs/LEADERBOARDS.md and the git commit holding the full former runbook"
    requirement: "COMP-03"
    verification:
      - kind: unit
        ref: "test/unit/compliance-docs.test.js (docs/PLAY-GAMES-SETUP.md is at most 20 lines and says it is retired; docs/PLAY-GAMES-SETUP.md points at docs/LEADERBOARDS.md and the former runbook's git commit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/LEADERBOARDS.md carries a Play Console cleanup section listing every Season-1 board by name and ID and the Play Games configuration, done after 2.2 reaches testers"
    requirement: "COMP-03"
    verification:
      - kind: unit
        ref: "test/unit/compliance-docs.test.js (docs/LEADERBOARDS.md carries the Play Console cleanup section and all five Season-1 board IDs)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/LEADERBOARDS.md section 6 names the transition config for every deploy until the cutover, and describes the release-day cutover"
    verification:
      - kind: unit
        ref: "test/unit/compliance-docs.test.js (docs/LEADERBOARDS.md section 6 carries the transition-config and release-day-cutover subsections)"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/RELEASING.md carries one ordered 2.2.0 release checklist: patch notes, android:release (not play:release), ask-before-upload, the rules cutover, the ten-PASS probes recorded in BUG-REPORTS.md, deleting the transition files, the website deploy, Data safety, the Play Console cleanup, and the later Season 1 reset; the old console checklist and its stale runbook link are gone"
    requirement: "COMP-03"
    verification:
      - kind: unit
        ref: "test/unit/compliance-docs.test.js (carries no reference to the retired runbook's filename; checklist markers in order; names android:release not play:release)"
        status: pass
      - kind: unit
        ref: "test/unit/patch-notes-pipeline.test.js (RELEASING.md: carries the patch-notes step)"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/BUG-REPORTS.md has a release-day --probe-rules results subsection, pending, with the ten probe names, as the place the release step records SRV-09's live proof"
    verification:
      - kind: unit
        ref: "test/unit/compliance-docs.test.js (docs/BUG-REPORTS.md carries the release-day probe-results subsection with all ten probe names)"
        status: pass
    human_judgment: false
  - id: D6
    description: "No live doc outside .planning/milestones links docs/PLAY-GAMES-SETUP.md as instructions; the docs sweep is recorded"
    verification:
      - kind: other
        ref: "grep -rli \"play games\" docs --include=*.md (manual sweep, recorded below in this SUMMARY's Docs Sweep Result)"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-09-29
status: complete
---

# Phase 86 Plan 03: PLAY-GAMES-SETUP.md Retired, One Ordered 2.2.0 Release Checklist Summary

**docs/PLAY-GAMES-SETUP.md is now a 20-line retirement notice; docs/LEADERBOARDS.md carries the Play Console cleanup (all five Season-1 board IDs) and the rules-cutover subsections; docs/RELEASING.md carries one ordered nine-step 2.2.0 release checklist (patch notes → android:release, not play:release → ask before upload → rules cutover → ten-PASS probes → delete transition files → website deploy → Data safety → Play Console cleanup, then the later Season 1 reset); docs/BUG-REPORTS.md has the pending release-day probe table.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-29
- **Tasks:** 3
- **Files modified:** 6 (1 created, 4 modified, 1 deleted)

## Accomplishments

- **Task 1 — LEADERBOARDS.md gets the cleanup and the cutover; PLAY-GAMES-SETUP.md is retired.** Section 6 gained "Until the 2.2 release: the transition config" (every rules/index deploy uses `--config firebase.transition.json` until the cutover) and "Release-day cutover (2.2)" (the final-rules deploy, the ten-PASS probe expectation, deleting the transition files) — the plain `firebase deploy` command already in section 6 is now explicitly named as the cutover command, not run early. Section 14's "Release-day step" bullet now points at `docs/RELEASING.md`'s checklist. New section 16, "Retiring Google Play Games (Play Console cleanup)": a table of all five Season-1 boards (DEEPEST, LONGEST, BUTCHERY, PURSE, and LEANEST with its UAT-v2.1 row 15.8 contingency note), the delete/unpublish/cleanup steps, and the explicit "never touch the Firebase project" warning. `docs/PLAY-GAMES-SETUP.md` is now a 20-line notice: what changed (Phase 85), where the cleanup lives (LEADERBOARDS.md section 16), and the git commit holding the full former runbook (`a217d032b0f53fd75640e15dbefd7e0a9d8d336f`).
- **Task 2 — the ordered 2.2.0 release checklist.** `docs/RELEASING.md`'s stale "Next Play push: release notes" (v2.1 panel-fix lines) became a short "## Release notes" pointer to `docs/patch-notes/<versionName>.md`. The "After the push: console checklist" (the LEANEST single-board delete step, the two-account ALL-board check) became "## Release 2.2.0: the ordered checklist" — nine numbered steps (agree the patch notes and clear the DRAFT marker; `npm run android:release`, explicitly **not** `npm run play:release`, since `86-01`'s debug build already set `android/version.properties` to 2.2.0/12; ask before the Play upload; deploy the final rules once 2.2 reaches testers; `--probe-rules` expecting ten PASS, recorded in BUG-REPORTS.md; delete the three transition files; deploy the website; enter Play Console Data safety; the Play Console Play Games cleanup) plus a closing line for the later Season 1 reset. Three general bullets about `versionCode`/`versionName` and `android:release` vs. `play:release` were kept (no stale content, still directly relevant to step 2). The toolchain-pin section now says the plugin that motivated the AGP pin was removed in 2.2, without describing plugin-specific keep rules or the retired `play-games-intake.test.js`; the R8 section drops the plugin's own keep-rule sentence; "Verifying a release build" step 4 lists only `drawable/splash_screen` (Phase 85 removed `game_services_project_id`); the Pixel 7 smoke's sign-in/ME-ALL-FRIENDS steps became the ☰ account-block check and the Compete-ON "You placed Nth of M." check. `docs/BUG-REPORTS.md` gained a pending "Release-day `--probe-rules` results (2.2.0)" subsection (all ten probe names, `pending`) directly under the existing transition-period results, and section 10 now points at `store-listing/LISTING.md` and `apps.astro` instead of the retired `.planning/MILESTONE-CLOSE-QUESTIONS.md`.
- **Task 3 — the compliance-docs pin test and the docs sweep.** `test/unit/play-games-runbook.test.js` deleted (it pinned the now-retired runbook). New `test/unit/compliance-docs.test.js` (8 tests, `store-listing.test.js`'s style: CRLF-normalized reads, per-section string slicing) pins: the retirement notice's length and content; LEADERBOARDS.md's cleanup section, all five board IDs, and section 6's two new subsections; RELEASING.md's absence of any `PLAY-GAMES-SETUP` reference, the seven-marker in-order checklist proof, and the `android:release`-not-`play:release` wording; BUG-REPORTS.md's release-day subsection and all ten probe names. Confirmed Phase 85's RETIRE-02 sweep (`test/unit/retire-sweep.test.js`) is explicitly scoped to shipped code only (`src/`, `content/`, `mazeworld.html`, `tools/build-www.mjs`, tracked android text) and excludes `test/`/`docs/` by its own header comment, so no string-splitting was needed in the new test file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the Play Console cleanup and the release-day cutover to LEADERBOARDS.md, then retire the old runbook** - `87d27d1b` (docs)
2. **Task 2: Write the ordered 2.2.0 release checklist in RELEASING.md and the release-day probe target in BUG-REPORTS.md** - `1be9a60a` (docs)
3. **Task 3: Replace the old runbook pin test with a compliance-docs pin and sweep the docs** - `d0821e98` (test)

**Plan metadata:** (this commit, docs only)

## Files Created/Modified

- `docs/PLAY-GAMES-SETUP.md` - Retired: a 20-line notice, kept at this path for archived `.planning/milestones` links
- `docs/LEADERBOARDS.md` - Section 6 transition-config/cutover subsections, section 14 pointer, new section 16 (Play Console cleanup)
- `docs/RELEASING.md` - "## Release notes" pointer, "## Release 2.2.0: the ordered checklist" (9 steps + Season 1 reset), toolchain-pin/R8/verify-build/Pixel-7-smoke wording cleanup
- `docs/BUG-REPORTS.md` - Pending release-day `--probe-rules` results subsection (ten probes), section 10 repointed
- `test/unit/compliance-docs.test.js` - New: 8 tests pinning the retirement, the cleanup section, the checklist and the release-day probe target
- `test/unit/play-games-runbook.test.js` - Deleted (pinned the now-retired runbook)

## Decisions Made

See `key-decisions` in the frontmatter. Highlights: section 16 was the correct next-free number (the plan's own guess held); the general `android:release`/`play:release`/signer-conflict bullets at the end of the old console-checklist section were kept rather than deleted, since they're accurate and step 2 of the new checklist references the same distinction directly.

## Deviations from Plan

None - plan executed exactly as written. The plan's contingency notes ("if Phase 85's RETIRE-02 sweep scans test files for Play Games identifiers, build any string... from two halves") did not apply — confirmed by reading `test/unit/retire-sweep.test.js`'s own header comment and file-set walker, which explicitly excludes `test/` and `docs/` from its scan scope.

## Issues Encountered

None.

## User Setup Required

None from this plan directly — this plan writes docs and a test only. It *documents* two future user steps (both listed, not executed here): the Play Console Play Games cleanup (`docs/LEADERBOARDS.md` section 16, gated on 2.2 reaching testers) and the Play upload / Data safety entry (`docs/RELEASING.md` checklist steps 3 and 8).

## Docs Sweep Result

`grep -rli "play games" docs --include=*.md` (case-insensitive):

| File | Reason kept |
|---|---|
| `docs/PLAY-GAMES-SETUP.md` | the retirement notice itself |
| `docs/LEADERBOARDS.md` | section 1's history sentence + the new section 16 cleanup content |
| `docs/RELEASING.md` | the checklist (step 9, the cleanup pointer) + the toolchain-pin history sentence (1 mention; the acceptance criteria allow up to 3) |
| `docs/UAT-v2.0.md` | history; Phase 86-05's to mark rows superseded |
| `docs/UAT-v2.1.md` | history; Phase 86-05's to mark rows superseded |
| `docs/patch-notes/2.1.0.md` | released notes (not matched by the `.md`-only sweep check above since it's a plain filename match, but confirmed unchanged and intentionally out of scope — released notes are historical) |

`docs/narrative-pass/corpus-base.json` also mentions Play Games but is `.json`, not `.md` — an allowed historical corpus snapshot per the plan.

### Findings for the orchestrator

Two docs still mention Play Games and are **out of this plan's scope** (Phase 85's RETIRE-02 territory per the plan's own instructions — not edited here):

- `docs/SHELL-MODULES.md` — lines 9, 177, 182, 185, 227, 375, 384 (a "Play Games account (Phase 67)" section describing the now-deleted `playGames.js` module and its old score-tag format).
- `docs/ANDROID-DISPLAY.md` — line 293 (a mention of "the Play Games plugin" in an audit-history note).

## Next Phase Readiness

- 86-04 (store-listing/LISTING.md refresh) can cite this plan's release-checklist step 2 (the AAB audit recorded in LISTING.md) and section 16 (the Play Console cleanup) directly.
- 86-05 (docs/UAT-v2.2.md) can point its section 0 user tasks at `docs/RELEASING.md`'s ordered checklist and `docs/LEADERBOARDS.md` section 16, rather than restating them.
- The eventual 2.2.0 release build has a single script to follow: `docs/RELEASING.md`'s "Release 2.2.0: the ordered checklist".
- No blockers. `docs/SHELL-MODULES.md` and `docs/ANDROID-DISPLAY.md` still carry stale Play Games text — flagged above for whichever future plan owns RETIRE-02's docs sweep (not this milestone's scope per 86-CONTEXT).

**Verification run (this plan's scope):**
- `node --test test/unit/compliance-docs.test.js test/unit/stale-terms.test.js` — 14 pass, 0 fail.
- `node --test --test-name-pattern="RELEASING.md" test/unit/patch-notes-pipeline.test.js` — 1 pass, 0 fail.
- `node --test test/unit/retire-sweep.test.js` (Phase 85's RETIRE-02 sweep) — 8 pass, 0 fail.
- `git status --porcelain -- engine test/parity` — empty (engine gate clean).
- All Task 1/2/3 acceptance-criteria greps from `86-03-PLAN.md` verified individually during execution — all pass.

## Human verification (deferred to end of run)

None expected. This plan touches docs and a test file only — no device-testable surface.

---
*Phase: 86-compliance-device-close*
*Completed: 2026-09-29*

## Self-Check: PASSED

All modified/created files found on disk (docs/PLAY-GAMES-SETUP.md, docs/LEADERBOARDS.md, docs/RELEASING.md, docs/BUG-REPORTS.md, test/unit/compliance-docs.test.js, this SUMMARY.md); test/unit/play-games-runbook.test.js confirmed deleted; all three task commits (87d27d1b, 1be9a60a, d0821e98) found in `git log`.
