# v2.1 autonomous run: resume point (2026-09-28, evening)

## NOW (supersedes everything below; 2026-09-28 ~16:15, before the third compact)
- **Released:** Play 2.1.0 / versionCode 11 is signed, tagged `v2.1.0` and `v2.1.0-play11` (commit a897fd9c), and **UPLOADED to the closed test by the user**. The GitHub Release v2.1.0 is published with the notes.
- **Website deployed** (user: "deploy it") and pushed (darktier-studio 262b823). It has the patch-notes pages, the bug-report privacy paragraphs and the "binder" → 1994 copy fix (six races).
- **Complete:** every phase except 80. **80-04 is done** (summary 248166cd). **80-05, the emulator pass, is RUNNING** as a gsd-executor in a worktree, base a897fd9c, watched by a watch.sh monitor. Its gate has a declared exception: versionCode 10→11 is the only app-path change since acba40ed. It deletes its three AVDs itself.
- **docs/UAT-v2.1.md is written:** 102 phase checks, 3 user console tasks and 12 quick-task checks. Commit it with the close.

## NEXT (in order)
1. When 80-05 returns:
   - merge it (the worktree may need a `\\?\` long-path delete in PowerShell);
   - write 80-05-SUMMARY.md and place any screenshots or VERIFICATION it returned as text;
   - write 80-VERIFICATION.md;
   - run `gsd-tools query phase.complete 80`.
2. **Delete `C:/projects/mazeworld-build/phase80-acba40ed/`.** The user asked for it once 80-05 is done.
3. **Milestone lifecycle** (/gsd-autonomous step 5): Skill gsd-audit-milestone → Skill gsd-complete-milestone v2.1 → Skill gsd-cleanup (it asks the user). Then bring the user MILESTONE-CLOSE-QUESTIONS.md and docs/UAT-v2.1.md.
4. **Discord (user request):** in the user's Discord server "The Bat Cave", create a text channel **#delve-die-repeat**. Its first post is the patch-notes link https://darktierstudios.com/delve-die-repeat/patch-notes. There is no Discord tool, so use the claude-in-chrome browser tools on discord.com in the user's signed-in Chrome. Creating a channel and posting were explicitly requested.

## Where we are
- **Complete:** 72, 73, 74, 75, 75.1, 75.2, 75.3, 76, 77, 78, **79**, and **79.2**, which was inserted for the early-floor retune and locked by user ruling.
- **Phase 80:** its code plans (80-01/02/03/06) are merged. Its build part (80-04, the release build; 80-05, the emulator pass) is still to run.
- **Phase 79.3 (INSERTED 2026-09-28): in-app bug reports.** The context is written (a9a8a0f7). The planner is RUNNING. Details below.
- **79.1:**
  - 01, 02 and 03 are done (03 was a no-op).
  - **04 (the final readouts) is still to run** and waits for all rule changes. It MUST read the Phase 79.2 targets (median 3–4).
- **Quick tasks merged since the compact** (SUMMARYs written):
  - 260928-cos: the Cloak of Strength wards foe crits on the wearer, with a "Crit-proof" chip.
  - 260928-hrs: hero resist uses the half-intel scale; duration abilities last their stated rounds, so Smoke's chip reads 2.
  - 260928-abl: the Fighter/Thief ability audit; tooling is off by default and the readouts are in tools/readouts/260928-abl-*.
- **Master:** 16bd2654, then a9a8a0f7 (docs). The last full gate on b1515781 passed 7,649/7,649, parity 66/66, boot:check PASS.
- **The Pixel 7 has the debug build from 49829f70** (all rules through 79.2, not cos/hrs). adb: `adb devices`, then `install -r`.

## RUNNING (each has a watch.sh monitor)
1. **Quick 260928-nrf: class trims + Joiner resist** (gsd-executor in a worktree, base 16bd2654). User rulings 2026-09-28:
   - Thief flee +5 → +3;
   - Sweep needs 2+ living foes (refuses, no turn spent);
   - Kata and Feint get `needShift +3` instead of auto-hit;
   - Acrobat: foes hit on their top 4 faces (foeToHitVs h=3 → 4);
   - Joiners resist foe spells on the half-intel scale;
   - Riposte is KEPT as 260928-hrs made it.
   - It returns its SUMMARY as text; write `.planning/quick/260928-nrf-class-trims-and-joiner-resist/SUMMARY.md`.
2. **Phase 79.3 planner** (gsd-planner). Plans go in `.planning/phases/79.3-in-app-bug-reports-report-a-bug-player-text-the-run-s-oracle/`.

## Phase 79.3 (bug reports): user rulings and provisioning
- **Rulings:**
  - "Firestore + GitHub Action": the app writes to Firestore in `delve-die-repeat-6ba5f` (Spark, billing off). A scheduled Action in ddr files issues with GITHUB_TOKEN, and no GitHub token ships in the app.
  - "Public, with a notice": the sheet warns that the report and Oracle are public on GitHub.
- **Provisioning done by the orchestrator** (full list in `<scratchpad>/notes-793.txt`):
  - Firestore (default) is Native in nam5, with TEMPORARY deny-all rules.
  - A Firestore-only API key exists; its keyString is in `<scratchpad>/apikey-create.json`.
  - The service account `ddr-bug-reports@…` has roles/datastore.user only. Its key is stored as the `FIREBASE_BUG_REPORTS_SA` secret on sheibeck/ddr, and the local copy is shredded.
  - The `player-report` label is created.
- **After the code merges:**
  1. Fill the API key into the config module.
  2. Deploy firebase/firestore.rules.
  3. Push master.
  4. Run the live E2E test: send a test report → `gh workflow run` → the issue appears → close it. Also check that the rules refuse read, update and oversize writes.

## NEXT (user-ordered)
1. Merge 260928-nrf, then run the full gate on master in the background.
2. Plan → execute Phase 79.3, then provisioning finish + live E2E + VERIFICATION.
3. **Debug build to the phone** after nrf lands, and again after 79.3. The user tests each batch.
4. 79.1-04 re-measure (the 1,000-seed natural + class matrix + record) on the final rules: report, don't re-tune unless asked.
5. **STOP before the release build and agree the patch notes with the user** (standing rule from 2026-09-28: "before you do a final build I want you to let me know. Because we want to discuss patch notes before the build goes"). Then Phase 80: 80-04 (the ONE release build, versionCode 11+) and 80-05 (the emulator pass).
6. **Milestone close:**
   - audit / complete / cleanup;
   - publish docs/narrative-pass/review.html as an artifact;
   - the batched Pixel 7 checklist;
   - MILESTONE-CLOSE-QUESTIONS.md, plus the Play Data safety and privacy-policy updates for bug reports (user tasks);
   - **ASK before the closed-test / Play push.**

## Merge recipe
1. `git -C <wt> checkout -- test/unit/fixtures/shell-snapshots/`, then `git merge --no-ff`.
2. Resolve a FIXTURE-INVENTORY EOF conflict with `bash <scratchpad>/inv-merge.sh <branch>`. Run it from the main checkout.
3. Resolve a docs/ROLL-LEDGER.md EOF conflict by keeping both sections: delete the markers and put a blank line between.
4. Resolve review.html/NARRATIVE-PASS.md conflicts with `git checkout --theirs` + `node tools/narrative-review.mjs --md --html`, then `--check-ledgers --after --coverage`.
5. Clean up the worktree: unlock / remove -f -f / branch -d / prune. **Stop the worktree's watch monitor first**, or Windows refuses the delete.
6. After cap sync, run `git checkout -- android/app/capacitor.build.gradle android/capacitor.settings.gradle` (CRLF noise).
7. **Never `cd` the persistent shell into a worktree.** The harness then treats the session as inside it. Use `git -C` or a subshell.

## User rulings this session (all implemented unless noted)
- **Removed or changed in play:**
  - no descent heal;
  - Joiner-only defences;
  - every foe-targeted spell resistible (half-intel);
  - one-shot strikes once per fight;
  - a failed climb or leap hurts at least 1;
  - Freeze: damage then a d4 hold, never kills, and a resist blocks only the freeze;
  - spell damage = dice + level²;
  - hero resist on the half-intel scale;
  - duration abilities last their stated rounds;
  - the Cloak of Strength wards foe crits.
- **Pending (260928-nrf):** Thief flee +3, Sweep needs 2+ foes, Kata and Feint roll with +3 faces, Acrobat top-4, Joiners resist.
- **The Magic User class gap is accepted** ("fine for now"). The audit shows starting HP is the lever, not abilities.
- **Early floors:** the fair-bot target p50 is 3–4. It was locked "as-is" at p50 5, with floors 3–6 over target.
- **Backlog:** 999.13 (own leaderboards), 999.14 (friends), 999.15 (the skill/spell review), 999.16 (the itemization pass).

## Open items / flags
- **MILESTONE-CLOSE-QUESTIONS.md:**
  - the insanity tone;
  - the inert MU school bonuses;
  - the camp-ambush row;
  - level-up HP on descent;
  - British "armour";
  - Overhead Blow borderline;
  - floors 3–6 over target.
- 79.2 deferred-items.md: two stale scan outputs.
- `.claude/worktrees/agent-add4ee435865f0c87` can't be deleted (locked by a dead process).
- Orchestrator notes are in `<scratchpad>/notes-79.txt`, `notes-791.txt` and `notes-793.txt`.

## Mechanics
- The watch script (`<scratchpad>/watch.sh <base> <stall-min> <ids>`) self-exits after 31 min. Re-arm it after expiry.
- Executors have no Monitor tool; they use run_in_background plus bounded polls. They return their SUMMARY as text.
- The junction for boot:check is made with node `fs.symlinkSync(target,'node_modules','junction')`.
- **Rules:**
  - bots only at the milestone end;
  - ask before any Play push;
  - discuss the patch notes before any release build;
  - never force-push;
  - the prototype master is never edited;
  - kill orphaned bash/node processes when asked.
