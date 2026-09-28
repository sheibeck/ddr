# v2.1 autonomous run: resume point (2026-09-28, before the second compact)

## Where we are
- **Complete:** 72, 73, 74, 75, 75.1, 75.2, 75.3, 76, 77, 78, **79**, **79.2** (inserted: the early-floor retune, locked by user ruling). Phase 80's code plans (80-01/02/03/06) are merged; its build part (80-04 release build, 80-05 emulator) is still to run.
- **79.1:**
  - 79.1-01 (v2.0 baseline) done.
  - 79.1-02 done (START PASS on the old rules).
  - 79.1-03 no-op.
  - **79.1-04 (final readouts) still to run.** Trimmed per "measure, then ship": the 1,000-seed natural readout + the class matrix + the DIFFICULTY-RETUNE record. It MUST read the Phase 79.2 targets (median 3–4), not the old 5–7.
- **Master:** 5f05e3f7+ / 1c5e0455. The last full gate was 7,623/7,623, parity 66/66, boot:check PASS (after 79.2-04).
- **The Pixel 7 has the debug build from 49829f70** (all rules through 79.2). adb: `adb devices`; the mDNS serial `adb-28051FDH200H0R-p9tucj._adb-tls-connect._tcp` auto-connects. Install with `install -r`; the debug key matches.

## RUNNING at compact (worktrees under .claude/worktrees; each has a watch.sh monitor)
1. **a5b6e6a2d001574fd: the Fighter/Thief ability AUDIT** (quick 260928-abl), base 49829f70.
   - Returns a findings REPORT as text; the orchestrator writes `.planning/quick/260928-abl-fighter-thief-ability-audit/SUMMARY.md` and takes the nerf options to the user.
   - It may commit an off-by-default ablation switch plus readouts.
2. **abf2d766125778306: the Cloak of Strength fix** (quick 260928-cos), base 1c5e0455.
   - The cloak now wards foe crits on the wearer, stops suppressing the wearer's own crits, and gets a "Crit-proof" chip.
   - It returns its SUMMARY as text → write `.planning/quick/260928-cos-cloak-of-strength-blocks-crits-on-the-wearer/SUMMARY.md`.
3. **a4aa5f56d20a9bedb: hero resist on the half-intel scale, plus the Smoke/duration-ability off-by-one** (quick 260928-hrs), base 1c5e0455.
   - Returns its SUMMARY as text → write `.planning/quick/260928-hrs-hero-resist-half-intel-and-smoke-rounds/SUMMARY.md`.
- **Merge recipe:**
  1. `git -C <wt> checkout -- test/unit/fixtures/shell-snapshots/`, then `git merge --no-ff`.
  2. Resolve a FIXTURE-INVENTORY EOF conflict with `bash <scratchpad>/inv-merge.sh <branch>`.
  3. Resolve review.html/NARRATIVE-PASS.md conflicts with `git checkout --theirs` + `node tools/narrative-review.mjs --md --html`, then `--check-ledgers --after --coverage`.
  4. Unlock / remove -f -f / branch -d / prune.
  5. After cap sync, run `git checkout -- android/app/capacitor.build.gradle android/capacitor.settings.gradle` (CRLF noise).

## NEXT (user-ordered)
1. Merge cos and hrs (and the audit's tooling commit, if any) → full gate on master. It takes ~3–4 min now; run it in the background.
2. Take the audit findings to the user (AskUserQuestion with the nerf options). Implement the chosen nerfs as a quick task.
3. **Debug build to the phone** after the rules above land. The user wants to test each batch.
4. Re-measure once all rule changes are in: 79.1-04 trimmed (the 1,000-seed natural + class matrix + record). Every rule change since the 79.2 lock (cos, hrs, nerfs) shifts balance slightly; report, don't re-tune unless the user asks.
5. **Phase 80 build:** 80-04 (the ONE release build; versionCode 11+) and 80-05 (the emulator pass).
6. **Milestone close:**
   - audit / complete / cleanup;
   - publish docs/narrative-pass/review.html as an artifact;
   - the batched Pixel 7 checklist;
   - MILESTONE-CLOSE-QUESTIONS.md;
   - **ASK before the closed-test / Play push** (the user said "before we do a new push to the closed test").

## User rulings this session (all implemented unless noted)
- **Removed or changed in play:**
  - no descent heal (79-02c);
  - Joiner-only defences (79-02b);
  - every foe-targeted spell resistible (half-intel: faces max(1, round(intel/2)); a resisted spell has no effect);
  - one-shot strikes once per fight (Feint, Kata, Death Touch, Silent Step, Overhead Blow [borderline, flagged], Last Stand);
  - a failed climb or leap hurts at least 1;
  - Freeze: damage, then a d4 hold; never kills outright; a resist blocks only the freeze;
  - spell damage = dice + level² (replacing the level multiplier for damage; each foe gets it; Fireballs once per foe; Acid/Ice first tick).
- **The Magic User class gap is accepted** ("fine for now"): CLASS_CONSTRAINT_EXEMPT = ["Magic User"].
- **Early floors:** the fair-bot target p50 is 3–4 (human 5–7). Locked "as-is" at bot p50 5 (floors 3–6 still over target; floor 5 has two ruled step changes).
- **UI fixes:** the arrow pad hides in place under rail cards; rail cards show over the store/loot/stair screens and bottom buttons hide in place; the find card scrolls with separated rows; music ×2 (MUSIC_GAIN 1.8); the death card is always up on the map while dead (full screen, no map when dead); the thrown-spell text states to-hit + damage.
- **Pending implementation (running):** hero resist on the half-intel scale; Smoke lasts its 2 rounds; the Cloak of Strength fix.
- **Backlog added:**
  - 999.13 (own leaderboards);
  - 999.14 (friends list);
  - 999.15 (review every skill and spell);
  - 999.16 (the itemization pass: the Cloak of Regeneration heals every 10 steps for 30 steps; benefits end when the item comes off).

## Open items / flags
- **MILESTONE-CLOSE-QUESTIONS.md:**
  - the insanity tone;
  - the inert MU school bonuses;
  - the camp-ambush row;
  - level-up HP on descent;
  - British "armour".
- **Also bring up at close:** Overhead Blow borderline; floors 3–6 over target.
- 79.2 deferred-items.md: two stale scan outputs (the initiative/worn fixture scans; declaring Phase 51 on cast-damage is deferred).
- The review page is served locally at localhost:8790 only while the scratchpad server runs (it self-exits after 3h). Publish it as an artifact at close.
- The leftover dir `.claude/worktrees/agent-add4ee435865f0c87` can't be deleted (locked by a dead process).
- The orchestrator notes are in `<scratchpad>/notes-79.txt` and `notes-791.txt` (copied to 79-ORCH-NOTES.md earlier).

## Mechanics
- The watch script (`<scratchpad>/watch.sh <base> <stall-min> <ids>`) self-exits after 31 min and now also counts subagent transcript activity. Re-arm after expiry.
- Executors have no Monitor tool: tell them to use run_in_background plus bounded polls.
- The junction for boot:check: node `fs.symlinkSync(target,'node_modules','junction')` (cmd mklink is refused).
- **Rules:**
  - bots only at the milestone end (now allowed);
  - ask before any Play push;
  - never force-push;
  - the prototype master is never edited;
  - kill orphaned bash/node processes when asked (they must be parentless, older than 3 min and not a live monitor).
