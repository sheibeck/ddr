---
phase: 69-compliance-device-close
plan: 02
subsystem: docs / Play Console runbook
tags: [pgs, play-console, runbook, leaderboards, compliance]
status: complete
requires:
  - "67-02 runbook sections 1-6 (credentials, APP_ID, testers)"
  - "68-01 runbook sections 7-11 (leaderboards table, IDs, seasons, score tag)"
provides:
  - "docs/PLAY-GAMES-SETUP.md: a finished, walkable PGS console runbook (sections 1-12)"
  - "test/unit/play-games-runbook.test.js: order-of-operations, publishing, per-row ordering and numbering pins"
affects:
  - "docs/UAT-v2.0.md (69-03) records the console steps as deferred human items"
tech-stack:
  added: []
  patterns: ["doc pins by section slicing (## heading to next ## heading) and checklist-order matching by cited section"]
key-files:
  created: []
  modified:
    - docs/PLAY-GAMES-SETUP.md
    - test/unit/play-games-runbook.test.js
decisions:
  - "Checklist items may wrap: the order test joins a numbered line with its indented continuation lines, so the doc keeps its ~100-column wrapping"
  - "Cross-references to other sections now say 'section N' (they said 'step N', which collided with the numbered steps inside each section)"
  - "Section 5 mentions Google's Release tracks tab (enable the closed-testing track for PGS testing) as an alternative to listing testers one by one, from the same Google page"
metrics:
  duration: "~20 min"
  completed: 2026-09-24
  tasks: 2
  files: 2
---

# Phase 69 Plan 02: PGS console runbook finished Summary

`docs/PLAY-GAMES-SETUP.md` now opens with a pointer to section 6, a single 11-step checklist that runs from enabling PGS to publishing and the Data safety answers, and ends with a new section 12 on publishing. Section 12 is sourced from Google's page as fetched today. Every step is pinned by tests, including the order the steps come in.

## What shipped

- **Section 6, "Order of operations (Phase 69)"** replaces the future-tense "What Phase 69 completes" list. It opens by saying these are the user's console steps, recorded as deferred items in `docs/UAT-v2.0.md`, that they never block a milestone close, and that the 2.0.0 build works without them. The checklist, in order:
  1. enable PGS (section 2)
  2. the Play App Signing SHA-1 credential, plus the optional debug one (section 3)
  3. the APP_ID (section 4)
  4. Testers, or the closed-testing track (section 5)
  5. create the five Season-1 boards (section 7)
  6. the IDs into `games-ids.xml` and `content/leaderboards.js` `LEADERBOARD_IDS[1]` (sections 4 and 8)
  7. rebuild with `npm run play:release` (`docs/RELEASING.md`)
  8. the tester check (section 11)
  9. publish (section 12)
  10. the Data safety answers from `store-listing/LISTING.md`, with https://darktierstudios.com/privacy/apps and https://darktierstudios.com/privacy/delete-data
  11. the season bump (section 9)

  It keeps both of the old section's facts: LINEAGE and GRAVEYARD get no board, and the cap is 70 boards (14 seasons).
- **Section 7:** gives each board's exact typed name (*DEEPEST, Season 1* and the other four) and notes that the console may label Ordering as "Sort order". The table, Numeric with no decimals, empty limits, tamper protection and the LEANEST limit are unchanged.
- **Section 11:** adds the five-board check. It uses the worked tag `v1.2.8.3.0.7.22.431.19.4688.1180.Hilda_Ferrow`, and its per-board scores (6,999,569 / 61,571 / 22,007 / 19,007 / 4,688) were computed with `boardScore()` and decoded with `decodeTag()`. It also says that a board still on a placeholder is skipped.
- **Section 12, "Publish the Play Games configuration"** covers:
  - the path: Grow users → Play Games Services → Setup and management → Publishing
  - the page lists anything misconfigured
  - publishing reaches every player with the game, and it is separate from publishing the app
  - up to 2 hours to take effect; publish at least 2 hours before a production rollout
  - tester data is not deleted at publish
  - orderings are fixed once published
  - when to publish: after the section 11 check, and staying unpublished is fine on closed testing
  - the source and its date
- **Edge statements:**
  - Section 3: the two credentials sit side by side, and each build matches only its own.
  - Section 5: with nobody on Testers, nobody signs in, you included.
  - Section 9: the fourteenth season takes boards 66 to 70, and there is no fifteenth set.
  - Section 8's skip-on-placeholder and section 7's LEANEST tie note are kept.

## Source check (Google's publishing page)

On 2026-09-24 I fetched https://developer.android.com/games/pgs/console/publish ("Test and publish your game", last updated 2026-06-16 UTC). It says the same as the planner's reading:

- The path is Grow users > Play Games Services > Setup and management > Publishing.
- The Publishing section lists what is missing or misconfigured.
- Publishing makes PGS available to all users with the game, without adding them as testers, and is different from publishing the APK.
- Changes take up to 2 hours; publish at least 2 hours before the game goes live.
- An unpublished game must allowlist testers, and you should add yourself.
- Tester data is not deleted at publish.

The page also documents the Testers > **Release tracks** tab, which enables a whole release track for PGS testing, and says new testers get access "within a couple of hours". Both are now in section 5. Nothing on the page changed from the plan's reading.

## Verification of the existing sections (2-5, 7-11)

I checked these against `content/leaderboards.js` (five keys, `PLACEHOLDER_*_S1`, prefix `PLACEHOLDER`), `content/season.js` (`SEASON = 1`), `games-ids.xml` (`game_services_project_id` = `000000000000`), `AndroidManifest.xml` (the APP_ID meta-data), `src/browser/boardScores.js` (score formulas) and `src/browser/scoreTag.js` (field order, caps). All the facts were right. Three wording fixes:

1. **Section 5:** the tester list said "internal-testing track's". The app is now on the closed-testing track, so it names the closed-testing testers first (and any internal ones).
2. **Section 4 step 3 and section 11:** "internal-testing upload/build" is now "Play testing-track upload" / "closed or internal testing".
3. **Cross-references:** they said "step N" when they meant a section (for example "(see step 5)" and "as in step 7"). They now say "section N", so they don't collide with the numbered steps inside sections or with the section 6 checklist. The one "step 2" in section 9 that means its own step 2 is unchanged.

## Tests

- **RED** (commit ae71d6d), 11 new failures against the unmodified doc:
  - needles "Order of operations", "Grow users", "2 hours", "store-listing/LISTING.md", "privacy/apps", "privacy/delete-data", "docs/UAT-v2.0.md"
  - "section 6 is an order of operations whose steps run in acting order"
  - "section 6 records the console steps as deferred items that never block a milestone"
  - "section 12 publishes the configuration, with the path, the delay and its dated source"
  - "the numbered sections run 1, 2, 3 ... with no gap and no repeat"

  Some new pins passed even at RED because the existing text already satisfied them: the per-row ordering test (section 7's table was already right, and the test now guards it) and the needles "Publishing", "debug keystore" and "Numeric". All pre-existing tests passed.
- **GREEN** (commit 2e59ab5): `node --test test/unit/play-games-runbook.test.js` gives 41 pass, 0 fail.
- `grep -c "^## " docs/PLAY-GAMES-SETUP.md` prints 12, and the old working title does not appear. The file ends in LF.
- `npm test`: 5039 tests, 5032 pass, 7 fail. The 7 are the known worktree CRLF doc-ledger failures (class-pass-ledger / flee-ledger), so there are no new failures.

## Deviations from Plan

- **[Rule 2 - wording correctness]** The three section 2-11 wording fixes listed above (closed-testing track, and section rather than step cross-references). The facts are unchanged.
- **[Plan interpretation]** The order test reads each checklist item as its numbered line plus its indented continuation lines, rather than the numbered line alone. That lets the doc keep its column wrapping, and each step is still matched by the first item that cites its section. It also pins two more steps than the plan's behavior list: the Data safety step (store-listing/LISTING.md) after publishing, and the season bump (section 9) last. Both match the plan's checklist.
- **[Addition]** Section 5 now mentions the Release tracks tab, from the same Google page, as an alternative to listing each tester. Checklist step 4 mentions it too.

Otherwise the plan was executed as written. Engine, `test/parity/`, STATE.md, ROADMAP.md and REQUIREMENTS.md are untouched.

## Known Stubs

None in this plan's files. The `PLACEHOLDER_*_S1` IDs and the 12-zero APP_ID are the intended stand-ins until the user runs the console steps below.

## Human verification (deferred to end of run)

These are the user's Play Console actions (D-06). They never block the milestone close.

1. Walk `docs/PLAY-GAMES-SETUP.md` section 6 (Order of operations) top to bottom in Play Console → Delve, Die, Repeat → Grow users → Play Games Services → Setup and management.
2. Confirm each menu path as you go: Configuration, Credentials, Testers (and its Release tracks tab), Leaderboards, Publishing, and App content → Data safety. Note any renamed labels so the runbook can be corrected.
3. Send Claude the APP_ID (12 digits) and the five Season-1 leaderboard IDs (DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE) for the rebuild into `games-ids.xml` and `content/leaderboards.js`.
4. After that rebuild, run the section 11 check with a tester account (sign-in plus one death on all five boards), then publish the configuration (section 12), at least 2 hours before any production rollout.

## Self-Check: PASSED

- FOUND: docs/PLAY-GAMES-SETUP.md, test/unit/play-games-runbook.test.js
- FOUND: commits ae71d6d, 2e59ab5
