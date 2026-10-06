---
phase: 101-play-games-achievements-mirror
plan: 05
subsystem: disclosure-and-runbooks
tags: [play-games, achievements, disclosure, docs, COMP-05, PGS-11]
requires: []
provides:
  - "ACCOUNT_COPY.sheet.onHelp names achievements going to Play Games, earned-while-off included"
  - "docs/PLAY-GAMES-SETUP.md covering sign-in and achievements, the @string/app_id resource and the two export copies"
  - "docs/ACHIEVEMENTS.md IDs-file home, tester precondition and the seven-row device check"
affects:
  - content/account.js
  - docs/PLAY-GAMES-SETUP.md
  - docs/ACHIEVEMENTS.md
tech-stack:
  added: []
  patterns: ["doc pins count headings so a re-run edit cannot duplicate a section"]
key-files:
  created: []
  modified:
    - content/account.js
    - test/unit/account-copy.test.js
    - docs/PLAY-GAMES-SETUP.md
    - docs/ACHIEVEMENTS.md
    - test/unit/compliance-docs.test.js
    - test/unit/achievements-docs.test.js
decisions:
  - "Docs written to the decided design of plans 101-01/101-02 (CONTEXT), not the mid-wave tree"
  - "offHelp left byte-identical and now guarded by an equality pin"
metrics:
  tasks: 2
  files: 6
status: complete
---

# Phase 101 Plan 05: Disclosure and runbooks Summary

The in-app Compete help now says achievements go to Play Games too (earned-while-off included), and both Play runbooks describe sign-in and achievements, the IDs file's two proven-equal copies, who can test drafts and the milestone-close device check.

## Final onHelp string (verbatim)

> Every death from here goes on the board under your Play Games name, for anyone to find. Your achievements go to Play Games too, even the ones earned while this was off. Turn it off any time, right here.

Length: 202 characters (pin allows up to 220). The file header comment also gained one sentence: achievements earned while Compete is off are sent once it is back on. `offHelp` is untouched and pinned byte-for-byte.

## Commits

- `0fa37d02` feat(101-05): onHelp achievements clause plus pins (content/account.js, test/unit/account-copy.test.js)
- `0a32f5a8` docs(101-05): the two runbooks plus pins (docs/PLAY-GAMES-SETUP.md, docs/ACHIEVEMENTS.md, test/unit/compliance-docs.test.js, test/unit/achievements-docs.test.js)
- SUMMARY commit follows.

## Doc changes

docs/PLAY-GAMES-SETUP.md:
- Retitled "Play Games setup: sign-in and achievements (live runbook)"; opening no longer says "sign-in only" or "no achievements" (still no Play Games leaderboards, no saved games).
- Section 1 gains three bullets: what is sent and when (absolute set-steps, 1.5 s unlocks, 60 s progress batches and the flush triggers), the earned-while-off backlog and account-switch resend, Compete OFF sends nothing / never purges / ERASE MY RUNS does not touch Play's achievements.
- Section 2 step 6: draft achievements follow the Testers rule.
- Path B step 3: re-import the achievements zip, fetch a fresh Get resources export, replace both copies (`achievements/games-ids.xml` and the res copy); `app_id` must equal `PLAY_GAMES_CONFIG.appId` (test).
- Section 5 pitfalls: `@string/app_id`, re-export replaces both copies, keep.xml wildcard (`@string/achievement_*`), draft achievements and testers.
- Section 6: achievement check (in-game card then Play's popup; VIEW IN PLAY GAMES).
- New "## 7. Achievements (2.5, Phase 101)" (IDs file, tests, plugin, mirror and ledger, button, testers, publishing, device check pointer, Data safety now counts achievements).

docs/ACHIEVEMENTS.md:
- Testers: the Pixel 7 account must be on the list; non-testers see sign-in failures or unknown-achievement refusals until publish (mirror holds, retries next launch).
- Publish: at least 2 hours before a production rollout.
- "Fetch the IDs file": both copies byte-identical, the two proving tests (77 of 77, app id 517177834262, equality), the name rule, re-export is a drop-in into both copies.
- New "## Check Play's side on a device": seven rows (signed-in unlock with card then popup and XP, incremental step, reveal, airplane-mode round, Compete OFF round with adb logcat, release-build shrinker check opening Play's list, force-stop during a sync).

## Verification (targeted, no full suite, no bots)

- account-copy.test.js: 21 pass (RED seen first: 20 pass, 1 fail, then GREEN).
- Combined run of account-copy, account, safety-scan, voice-corpus, stale-terms, compliance-docs, achievements-docs, android-r8: 148 tests, 148 pass, 0 fail.
- compliance-docs + achievements-docs + android-r8: 44 pass.
- `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints 0.

## Deviations from Plan

None - plan executed as written. The docs describe plan 101-01/101-02 behaviour (games-ids.xml in two copies, `@string/app_id`, keep.xml wildcard); those files were not present in this worktree and were not read or edited.

## Threat flags

None. No new network surface; no secret involved (the existing "outside the repo" pin stays green).

## Known Stubs

None.

## Human verification (deferred to end of run)

- With Compete ON, open the account block in the menu on the Pixel 7 and read the new help line in full, in portrait and landscape, without clipping; TalkBack reads it once.
- The seven "Check Play's side on a device" rows in docs/ACHIEVEMENTS.md join the milestone-close Pixel 7 checklist (needs the debug-keystore SHA-1 credential and the device's account on the Testers list).

## Self-Check: PASSED

- content/account.js, test/unit/account-copy.test.js, docs/PLAY-GAMES-SETUP.md, docs/ACHIEVEMENTS.md, test/unit/compliance-docs.test.js, test/unit/achievements-docs.test.js: modified and committed.
- Commits 0fa37d02 and 0a32f5a8 exist on worktree-agent-ac9ba78a86fac995a.
