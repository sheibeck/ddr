# v2.0 Pixel 7 device round — Phase 69 (Compliance & Device Close)

**Build:** the Play build and the debug APK are recorded here when built: the 2.0.0 (versionCode 9) AAB by 69-04, the milestone's debug APK by the orchestrator at the close (D-08).

**Protocol:** the deferred-UAT protocol. This batch is written and committed in Phase 69. It is not run mid-milestone: it is walked at the milestone close, or in the user's own sessions after it. The orchestrator relays each check, and results are recorded as the user states them: `pass`, `fail: <what you saw>`, or `not reached`. A skipped *if available* or *(optional)* row is recorded as `not reached`, never as a pass. Findings become todos, never mid-walk edits. Every device row is on the Pixel 7.

**Install warning (D-08):** the Play build (from closed testing) and the debug APK have **different signers**. Installing one over the other needs an uninstall first, and the uninstall **deletes the current run, the graveyard, the personal bests, the settings and any queued leaderboard submissions**. Only a same-signer install keeps save data: `adb install -r` of a debug APK over a debug install, or a Play update over a Play install.

**Sign-in and leaderboard rows** need the user's console setup in section 0; they are marked *(after console setup)*. On a locally built debug APK they also need the optional debug-keystore credential (`docs/PLAY-GAMES-SETUP.md` section 3, row 0.10). Without it, walk them on the Play build from closed testing.

**Sources:** `.planning/phases/65-run-record-personal-bests/65-VERIFICATION.md` (10 items), `.planning/phases/66-leaderboards-panel-local/66-VERIFICATION.md` (18 items), `.planning/phases/67-play-games-integration-account-chip/67-VERIFICATION.md` (15 items) and `.planning/phases/68-global-boards-submissions-you-placed-x/68-VERIFICATION.md` (16 items), 59 in all. Extras came from the "Human verification (deferred to end of run)" sections of 65-03, 65-04, 65-05, 66-02 to 66-07, 67-01 to 67-08 and 68-01 to 68-07 (the sections in 65-01, 65-02 and 66-01 say None). Items were merged and reordered for one pass; the **Source map** at the end accounts for every source item.

**Suggested order:**
1. Section 0, the console, website and upload steps (user), except row 0.8, which waits for F1.
2. **F1, the RELEASE-BLOCKING capture**, on a fresh install with Compete OFF before any sign-in. Carve-out: row A1 needs the old v1.9 install, so if the phone still has it, walk A1 before F1's uninstall (it runs offline and touches no Compete or network state); otherwise A1 is `not reached`.
3. Still on that fresh install: B1 (every board empty), then keep the capture running and die with Compete OFF. That one death covers F2, A2 (first-ever death), B2 (one death on every board) and C3. Then row 0.8.
4. The sections that need no console setup: the rest of A, B3 to B12, C, D1 and D2, E1 to E4, and K1 and K2 (the parts shown signed out).
5. After the console setup and the rebuild from row 0.2 (installed as a Play update, so saves are kept): D3 to D5, E5, F3, B13 to B17, G, H, I and K3.
6. Section J, airplane mode, last among the device sections. Row A9 clears app storage, so it closes the walk.
7. Section Z, the desk check, any time.

## 0. Before the walk — console, website and upload (user) (10)

| # | Step | Who | Result |
|---|------|-----|--------|
| 0.1 | Walk `docs/PLAY-GAMES-SETUP.md` section 6 (Order of operations) in Play Console, top to bottom, and confirm each menu path still exists; note the current name of any that moved (D-06). This includes creating the five Season-1 leaderboards per section 7 (DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE; only LEANEST is Smaller is better; tamper protection left on). | user | open |
| 0.2 | Send Claude the APP_ID and the five leaderboard IDs. Claude puts the APP_ID in the string resource and the IDs in `content/leaderboards.js` `LEADERBOARD_IDS[1]`, then rebuilds with a versionCode bump. Until then the 2.0.0 (9) AAB still carries the 12-zero placeholder APP_ID and unfilled `PLACEHOLDER_` board IDs, so sign-in fails gracefully and boards are skipped. | user | open |
| 0.3 | Upload the 2.0.0 (9) AAB to closed testing by hand, and later the rebuild from 0.2 (D-07). Claude never uploads. | user | open |
| 0.4 | Review the darktier-studio commit recorded in `store-listing/LISTING.md` (Privacy policy section) and deploy the website, so `https://darktierstudios.com/privacy/apps` and the delete-data page serve the reconciled text (D-02). | user | open |
| 0.5 | In Play Console's Data safety form, enter the answers and both URLs (privacy policy and delete data) from `store-listing/LISTING.md`'s Data safety section (D-04). | user | open |
| 0.6 | Paste the full description from `store-listing/LISTING.md` into the store listing (D-05). | user | open |
| 0.7 | If `store-listing/LISTING.md`'s Screenshots section marks the graveyard shot as owed, regenerate it and upload it (D-05). | user | open |
| 0.8 | *(after F1)* Make the diagnostics decision recorded in `store-listing/LISTING.md`'s Data safety section, using what F1 recorded. Confirm the privacy page's Compete-off paragraph matches what F1 showed; if not, edit it in darktier-studio and redeploy. | user | open |
| 0.9 | On the Pixel 7, open the Play Games app and confirm the steps on the delete-data page match its current menus. | user | open |
| 0.10 | Only if testing sign-in on a local debug APK: run the debug-keystore `keytool` command in `docs/PLAY-GAMES-SETUP.md` section 3, confirm it prints a SHA-1, and add it as the optional second credential. | user | open |

## A. New personal best block and run record — Phase 65 (9)

| # | Step | Who | Result |
|---|------|-----|--------|
| A1 | *(needs the old v1.9 install; walk before F1's uninstall)* Install the milestone debug APK over the v1.9 debug sideload with `adb install -r` (same signer, saves kept), with airplane mode on. The app boots, the DEAD tab still lists the old stones, and there is no crash (the bests backfill). If the v1.9 install is already gone, record `not reached`. | user | open |
| A2 | On a fresh install, the first-ever death shows the gold block with one first-death line. | user | open |
| A3 | Die twice. After each death the DEAD tab lists the new run at once and INTERRED rises by one. Force-close and relaunch after the second: the app restarts cleanly. | user | open |
| A4 | A later death deeper than any before shows **NEW PERSONAL BEST** with DEEPEST DESCENT and DEEPEST, FEWEST STEPS rows plus one quip, above REVIEW THE ORACLE / BURY THEM. At the largest text size the buttons are not pushed off-screen. | user | open |
| A5 | A shallower death shows no block. | user | open |
| A6 | REVIEW THE ORACLE, then back: the same block and the same quip. | user | open |
| A7 | BURY THEM, a new run, then an early death: no stale block. | user | open |
| A8 | The rail never appears over the death panel. | user | open |
| A9 | *(clears app data; last row of the walk)* Clear the app's storage in Android settings, then launch and die: the first death works without error. | user | open |

## B. The Leaderboards panel on every board — Phases 66 + 68 (17)

The seven boards: **DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE, LINEAGE** and **GRAVEYARD**.

| # | Step | Who | Result |
|---|------|-----|--------|
| B1 | *(edge)* On a fresh install with no deaths, open the DEAD tab and step through all seven boards: each shows its empty state, with no error or blank panel. | user | open |
| B2 | *(edge)* With exactly one death on the device, that run shows on every one of the seven boards. | user | open |
| B3 | At text size M, step through DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE, LINEAGE and GRAVEYARD: each matches the mock's look. | user | open |
| B4 | At the largest text size, on every board, the header, strip and rail don't crowd out the list. | user | open |
| B5 | The rail chips and row tap targets are comfortable to tap. | user | open |
| B6 | Switching boards, the active chip glides to the centre of the rail. With the OS reduce-motion setting on, it jumps there instantly. | user | open |
| B7 | Tap a row deep in a long GRAVEYARD list: it expands in place, and the list does not jump to the top. | user | open |
| B8 | After a few real deaths, each board's order reads right. LEANEST visibly rewards short, efficient runs over merely deep ones. | user | open |
| B9 | *(edge, if available: two local runs with the same LEANEST rate)* LEANEST lists the deeper run first. | user | open |
| B10 | Right after a fresh death, the standing card's place and "of N" read sensibly. | user | open |
| B11 | Voice read-through of the panel copy: rule lines, footnotes and standing lines. | user | open |
| B12 | GRAVEYARD shows no identity strip, signed in or out. | user | open |
| B13 | *(after console setup; signed in, Compete ON)* ALL on DEEPEST, at the default and largest text sizes: rows show handles with initials avatars, the adventurer name, `RACE SUB · LVL n`, and the value and unit. Expanding a row shows the cause line and six stat chips, and no epitaph. The YOU (gold) and FRIEND tags fit beside a long handle. | user | open |
| B14 | *(after console setup; signed in, Compete ON; if available: outside the top ten)* **NOT IN THE TOP TEN · YOUR BEST RUN** is pinned last. The standing card ("3RD" with "of N interred worldwide." and a quip) fits without clipping. | user | open |
| B15 | *(after console setup; signed in, Compete ON)* Open ALL: the global rows fill within a few seconds, and the local rows stay usable while they load. | user | open |
| B16 | *(after console setup; signed in, Compete ON; a fresh account without friends consent)* FRIENDS shows the consent note and a SHOW MY FRIENDS button that fits and is easy to tap. The Play Games consent screen appears only after that tap, never on opening the panel, switching boards or scopes, or a background fetch. Declining leaves the note, with no modal and no rail card. Check at the default and largest text sizes. | user | open |
| B17 | *(after console setup; signed in, Compete ON)* LINEAGE on ALL shows grouped race-and-class rows and the "Sampled from the top N deepest corpses" footnote, at the default and largest text sizes. | user | open |

## C. Title vs tab entry, and back — Phases 66 + 67 (9)

| # | Step | Who | Result |
|---|------|-----|--------|
| C1 | The DEAD tab shows the panel with the tab bar visible and DEAD lit, and no chevron. | user | open |
| C2 | The DEAD tab reopens on the last board viewed. | user | open |
| C3 | After the first-ever death, the title's **View the Dead** appears without a restart. | user | open |
| C4 | With no live hero, View the Dead opens on GRAVEYARD with the chevron, BACK TO TITLE and ROLL A NEW HERO, and no tab bar. | user | open |
| C5 | BACK TO TITLE returns to the title, and ENTER there still rolls a new hero. | user | open |
| C6 | ROLL A NEW HERO opens the roller and lands on the map after commit. | user | open |
| C7 | After Save & quit, View the Dead shows a single BACK TO THE DUNGEON that resumes the same run on the map. | user | open |
| C8 | Android back on the title-opened panel does what the chevron does. On the DEAD tab it behaves as before. | user | open |
| C9 | Android back closes the account sheet first, whether it sits over the title, the title-mode Leaderboards panel or the map. | user | open |

## D. Sign-in: auto, decline, no profile — Phase 67 (5)

| # | Step | Who | Result |
|---|------|-----|--------|
| D1 | *(placeholder APP_ID: the 2.0.0 (9) build or the debug APK, before the rebuild in 0.2; Compete ON)* Cold boot. Both chips show the nobody glyph, and exactly one **PLAY GAMES DID NOT ANSWER** rail card appears after ENTER, never over the title or the roller. Play is normal, with no crash. | user | open |
| D2 | *(no Play Games profile; if available: a device or Android user without one)* The game is fully playable. | user | open |
| D3 | *(after console setup; a tester account)* Launch: the tester auto-signs in. Both chips show the initials, the **ON THE PUBLIC RECORD** welcome card appears once and never again after a restart, and the Leaderboards identity strip shows the display name, a square initials avatar with the gold ring, and PLAY GAMES · SIGNED IN. | user | open |
| D4 | *(after console setup; signed out)* In the account sheet, tap **Sign in**, then cancel Google's prompt. The PLAY GAMES DID NOT ANSWER card appears, nothing is modal, the chip stays the nobody glyph, and no automatic retry follows during the session. | user | open |
| D5 | *(after console setup; signed out)* Tap **Sign in** again and accept: the tester is signed in and the chip shows the player. | user | open |

## E. The account chip and menu — Phase 67 (5)

| # | Step | Who | Result |
|---|------|-----|--------|
| E1 | At text sizes S, M and L, band 2 shows Depth/Day/Squares/Rations with no clipping, and the account chip sits directly left of ☰. At L the computed budget is 477.8px, so watch the counters there. Band 2's height is unchanged, and ☰ still opens its dropdown above the map and rail, with the scrim closing it. | user | open |
| E2 | The title chip sits in the top-right corner, clear of the status bar, the camera cutout and the splash art's baked-in text. The nobody face (a hollow square with a dim ?) and the pending face read as deliberate, not broken, on both the HUD and the title. | user | open |
| E3 | The account sheet opens from both chips. Its Settings row, opened from the title chip, opens the settings sheet above the title screen. | user | open |
| E4 | The band-2 chip is ignored during combat and any encounter. The title chip is unaffected. | user | open |
| E5 | *(after console setup; signed in, Compete ON)* **Stop competing** flips both chips and the Leaderboards strip to the nobody glyph at once. Turning Compete ON again signs back in silently: the chip goes pending, then shows the avatar, with no prompt. | user | open |

## F. Compete OFF and the network capture — Phases 67 + 68 (3)

| # | Step | Who | Result |
|---|------|-----|--------|
| F1 | **RELEASE-BLOCKING.** *(fresh install, Compete OFF, before any sign-in; the Play build from closed testing, the one going to production)* Uninstall (see the install warning), install, turn airplane mode on and launch, so nothing can sign in. In the account sheet turn **Compete OFF**, then force-close and turn airplane mode off. Start `adb logcat` (`adb logcat -c`, then `adb logcat -v time > f1-logcat.txt`) and a per-app network capture for the game's package, `com.darktierstudios.delvedierepeat` (for example PCAPdroid with an app filter). Cold boot, wait on the title, ENTER, walk a few squares, open Leaderboards, then stop both captures. **Expected:** no Play Games sign-in, leaderboard submit or leaderboard fetch from the game. Google's own SDK start-up (`PlayGamesSdk.initialize`) and a possible "Welcome back" banner are expected (67 D-20): record exactly what they log and send (hosts, sizes, timing) for the privacy text and the diagnostics decision (row 0.8). Keep both capture files. | user | open |
| F2 | *(Compete OFF, capture still running)* Die. There is no rank line, no card, no error, and no Play Games leaderboard traffic in the capture. | user | open |
| F3 | *(signed out, or after console setup signed in and then Compete OFF)* Reopen Leaderboards: the strip shows the ? glyph, PLAY GAMES · SIGNED OUT and "Your dead only". The ALL and FRIENDS chips are dimmed and show the Phase 66 notes, and nothing else changes. | user | open |

## G. The offline queue and flush — Phase 68 (3)

| # | Step | Who | Result |
|---|------|-----|--------|
| G1 | *(after console setup; signed in, Compete ON)* Turn airplane mode on, die, then force-close. Turn airplane mode off and relaunch. The run lands exactly once on each of the five boards, with its tag. One **THE LEDGER CAUGHT UP** rail card appears once the map shows: never over the title or the roller, after any account card, and it holds about 12 s. | user | open |
| G2 | *(after console setup; signed in, Compete ON)* Die offline so the death is queued. Turn Compete OFF, go back online, then turn Compete ON. Nothing from that queued death is ever submitted. | user | open |
| G3 | *(optional; after console setup; Compete ON but signed out)* Die, then sign in: the queued run submits right after sign-in. | user | open |

## H. "You placed X": the live line and the deferred rail card — Phase 68 (5)

| # | Step | Who | Result |
|---|------|-----|--------|
| H1 | *(after console setup; signed in, Compete ON)* After one tester death, the run appears on all five boards, and the console's score view shows its v1 tag (like `v1.2.8.3.0.7.22.431.19.4688.1180.Hilda_Ferrow`). The LEANEST score is the rate times 1,000. | user | open |
| H2 | *(after console setup; signed in, Compete ON)* Die: "You placed Nth of M." plus a quip appears under NEW PERSONAL BEST (or under the panel line when there is none) and fades in once. | user | open |
| H3 | *(after console setup; signed in, Compete ON)* Repeat with Android's remove-animations setting on: the line appears without the fade. | user | open |
| H4 | *(after console setup; signed in, Compete ON)* A run that did not beat your best shows the standing line ("your best still holds …"), never a claim that this run placed. | user | open |
| H5 | *(optional; after console setup; signed in, Compete ON)* After a submit, the DEEPEST rank line reflects the new score, not the previous one (the rank-after-submit lag check). | user | open |

## I. Seasons — Phase 68 (2)

| # | Step | Who | Result |
|---|------|-----|--------|
| I1 | The SEASON label reads in the Leaderboards header without crowding the INTERRED count. | user | open |
| I2 | *(if available: once a second season exists)* The season chips wrap cleanly, and switching one re-renders the board read-only. | user | open |

## J. Airplane mode — Phases 66, 67 + 68 (3)

| # | Step | Who | Result |
|---|------|-----|--------|
| J1 | With Compete OFF and airplane mode on, a cold boot and a full run play normally, with no stall at boot. | user | open |
| J2 | In airplane mode every board renders, empty or not, and the title-opened panel (View the Dead, BACK TO TITLE, ROLL A NEW HERO, BACK TO THE DUNGEON) behaves exactly as online. | user | open |
| J3 | *(after console setup; signed in, Compete ON)* In airplane mode, reopen the panel or change board or scope. A board fetched earlier shows its last result, a board never fetched shows the "the world is unreachable" note, and nothing blocks. | user | open |

## K. Voice read-through at default and largest text sizes (3)

| # | Step | Who | Result |
|---|------|-----|--------|
| K1 | The `BOARD_COPY` rule lines, and the new-best and first-death quip banks as they appear on the death panel. | user | open |
| K2 | The welcome card (ON THE PUBLIC RECORD), the failure card (PLAY GAMES DID NOT ANSWER), the sheet's Stop competing helper line and the Compete OFF line: deadpan, family-friendly, no awkward wrapping, and none of them implies the account is signed out while Play Games is still signed in. The rail cards hold long enough. | user | open |
| K3 | *(after console setup; signed in, Compete ON)* The DEEPEST rank quips on THAT IS THAT, the ledger card (one-run and many-run), the season-drop Oracle line, and the panel's loading, unreachable, consent and sampled-LINEAGE notes: no clipping or overflow, and the joke lands on the player's own adventurer. | user | open |

## Z. Desk check — browser dev loop (1)

| # | Step | Who | Result |
|---|------|-----|--------|
| Z1 | In the browser dev loop, turn on the dev "simulate signed-in" setting (`pgsDevSignedIn`) and relaunch. A death shows the rank line, and ALL shows rows from the dev boards. | user | open |

---

**Tally (written 2026-09-24):** 0 walked. The batch is run at the milestone close per the deferred-UAT protocol; RELEASE-BLOCKING row F1 must pass before any production rollout.
