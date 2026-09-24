# v2.0 Pixel 7 device round — Phase 69 (Compliance & Device Close)

**Build:** Play build: 2.0.0 (versionCode 9), `android/app/build/outputs/bundle/release/app-release.aab`, 10,352,033 bytes, sha256 `bcaaa1b30fcf0b4683c2c78236880bb03becafbd9239edcf1ff6366664813f97`, signed with the upload key (certificate SHA-256 `50:45:7F:A3:B8:D5:5F:D0:EF:89:C5:74:BF:40:B3:F3:02:9F:EC:C4:9F:50:C5:1D:86:B1:AF:DD:5E:02:56:DD`), built from the release commit tagged `v2.0.0-play9` on 2026-09-24; the user uploads it to closed testing by hand (row 0.3). This build carries the placeholder APP_ID (`000000000000`) and the unfilled `PLACEHOLDER_` board IDs, so Play Games sign-in fails gracefully and the boards are skipped until the console setup and the rebuild in section 0 (row 0.2). The milestone's debug APK is recorded here by the orchestrator at the close (D-08).

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

## Source map

Every item from the four VERIFICATION files (`[NN-Vk]`, k in frontmatter order) and every SUMMARY extra (`[NN-PP-Sk]`, k in list order) appears once below. *Merged* means the check is walked in that row; *superseded* means a later phase replaced the behaviour.

| Source | Item | Row | Disposition |
|--------|------|-----|-------------|
| [65-V1] | voice: BOARD_COPY rule lines, new-best and first-death quip banks | K1 | own row |
| [65-V2] | install over an install with graves: boots, stones listed, no crash | A1 | own row |
| [65-V3] | die twice: Dead tab count rises, clean restart | A3 | own row (66-V10 merged into it) |
| [65-V4] | storage cleared, first death works | A9 | own row (last: it clears app data) |
| [65-V5] | fresh install first death: gold block, one first-death line | A2 | own row |
| [65-V6] | deeper death: NEW PERSONAL BEST rows and quip, buttons on-screen at largest text | A4 | own row |
| [65-V7] | shallower death: no block | A5 | own row |
| [65-V8] | REVIEW THE ORACLE and back: same block, same quip | A6 | own row |
| [65-V9] | BURY THEM, new run, early death: no stale block | A7 | own row |
| [65-V10] | rail never over the death panel | A8 | own row |
| [66-V1] | voice: panel copy (rule lines, footnotes, standing lines) | B11 | own row |
| [66-V2] | active chip glides; jumps with reduce-motion | B6 | own row |
| [66-V3] | deep GRAVEYARD row expands in place | B7 | own row |
| [66-V4] | board order reads right; LEANEST rewards efficient runs | B8 | own row |
| [66-V5] | standing card place and 'of N' after a fresh death | B10 | own row |
| [66-V6] | panel matches the mock at text size M | B3 | own row (extended to name all seven boards) |
| [66-V7] | largest text: header, strip, rail don't crowd the list | B4 | own row |
| [66-V8] | rail chips and row tap targets comfortable | B5 | own row |
| [66-V9] | DEAD tab: panel, tab bar, DEAD lit, no chevron | C1 | own row |
| [66-V10] | after a death the DEAD tab lists the run at once, INTERRED +1 | A3 | merged: same check as 65-V3 (the Dead tab count rising after a death) |
| [66-V11] | DEAD tab reopens on the last board viewed | C2 | own row |
| [66-V12] | every board renders, empty or not, in airplane mode | J2 | own row |
| [66-V13] | title View the Dead appears after the first-ever death, no restart | C3 | own row |
| [66-V14] | no live hero: View the Dead on GRAVEYARD, chevron, two buttons, no tab bar | C4 | own row |
| [66-V15] | BACK TO TITLE returns; ENTER still rolls | C5 | own row |
| [66-V16] | ROLL A NEW HERO: roller, then map | C6 | own row |
| [66-V17] | after Save & quit: BACK TO THE DUNGEON resumes | C7 | own row |
| [66-V18] | Android back mirrors the chevron; DEAD tab as before | C8 | own row |
| [67-V1] | RELEASE-BLOCKING Compete OFF cold boot, logcat + network capture | F1 | own row, RELEASE-BLOCKING (67-01-S1, 67-06-S2 and 67-08-S5's capture clause merged into it) |
| [67-V2] | Compete OFF + airplane: cold boot and a full run, no stall | J1 | own row |
| [67-V3] | placeholder APP_ID, Compete ON: nobody chip, one failure card after ENTER | D1 | own row |
| [67-V4] | no Play Games profile: fully playable | D2 | own row |
| [67-V5] | band 2 at S/M/L: no clipping, chip left of ☰, height and dropdown unchanged | E1 | own row |
| [67-V6] | title chip placement; nobody face reads as deliberate | E2 | own row |
| [67-V7] | account sheet from both chips; Settings row above the title | E3 | own row |
| [67-V8] | Android back closes the account sheet first | C9 | own row (a back behaviour, so in section C) |
| [67-V9] | band-2 chip ignored in combat/encounters | E4 | own row |
| [67-V10] | voice: welcome card, failure card, Stop competing helper, Compete OFF line | K2 | own row (spans sections D and E, so in K) |
| [67-V11] | after console setup: auto sign-in, initials, welcome once, strip SIGNED IN | D3 | own row |
| [67-V12] | after console setup: Sign in row signs in; decline shows the failure card, no retry | D4, D5 | split: decline and accept are two moments |
| [67-V13] | Stop competing flips chips and strip; Compete ON signs back in silently | E5 | own row |
| [67-V14] | signed in: ALL/FRIENDS coming-online notes; Compete OFF restores strip and dimmed chips; GRAVEYARD no strip | F3, B12 | partly superseded: the coming-online notes clause is superseded by Phase 68 live boards (now B13 to B16); the Compete OFF clause is F3, the GRAVEYARD clause is B12 |
| [67-V15] | console: walk the runbook, confirm menu paths; debug keytool SHA-1 | 0.1, 0.10 | own rows in section 0 (user, non-device) |
| [68-V1] | console: create the five Season-1 boards, paste IDs, rebuild | 0.1, 0.2 | merged into section 0 (user console steps) |
| [68-V2] | after console setup: a tester death on all five boards, v1 tag in the console | H1 | own row |
| [68-V3] | 'You placed Nth of M.' fades in once; no fade with remove-animations | H2, H3 | split: the reduced-motion repeat is a second death |
| [68-V4] | not a best: standing line, never a placed claim | H4 | own row |
| [68-V5] | die offline, relaunch online: lands once per board; one LEDGER CAUGHT UP card | G1 | own row |
| [68-V6] | queued death, Compete OFF, online, Compete ON: nothing submitted | G2 | own row |
| [68-V7] | (optional) Compete ON signed out, die, sign in: queued run submits | G3 | own row |
| [68-V8] | Compete OFF, die: no rank line, card, error or traffic (capture) | F2 | own row: a death, a different moment from F1's cold boot |
| [68-V9] | ALL on DEEPEST row anatomy; expand shows cause + six chips; YOU/FRIEND tags fit | B13 | own row |
| [68-V10] | outside the top ten: pinned divider; standing card fits | B14 | own row |
| [68-V11] | ALL fills in seconds; airplane: last result or unreachable note | B15, J3 | split: the airplane clause is in section J |
| [68-V12] | FRIENDS consent note and button; consent screen only after the tap; decline | B16 | own row |
| [68-V13] | LINEAGE on ALL grouped + sampled footnote; SEASON label fits beside INTERRED | B17, I1 | split: the SEASON label clause is in section I |
| [68-V14] | signed out or Compete OFF: ALL/FRIENDS show the Phase 66 notes | F3 | own row (shares F3 with 67-V14's Compete OFF clause: same moment) |
| [68-V15] | voice at default and largest: rank quips, ledger card, season-drop line, panel notes | K3 | own row (spans sections B, G, H and I, so in K) |
| [68-V16] | browser dev loop: pgsDevSignedIn, rank line, dev-board rows | Z1 | own row (a desk check, not a device check) |
| [65-03-S1] | voice: BOARD_COPY rule lines and both quip banks | K1 | merged into 65-V1 |
| [65-04-S1] | install over an install with graves | A1 | merged into 65-V2 |
| [65-04-S2] | die twice: count rises, clean restart | A3 | merged into 65-V3 |
| [65-04-S3] | storage cleared, first death works | A9 | merged into 65-V4 |
| [65-05-S1] | fresh install first death gold block | A2 | merged into 65-V5 |
| [65-05-S2] | deeper death NEW PERSONAL BEST at largest text | A4 | merged into 65-V6 |
| [65-05-S3] | shallower death no block | A5 | merged into 65-V7 |
| [65-05-S4] | REVIEW THE ORACLE and back | A6 | merged into 65-V8 |
| [65-05-S5] | BURY THEM, new run, early death | A7 | merged into 65-V9 |
| [65-05-S6] | rail never over the death panel | A8 | merged into 65-V10 |
| [66-02-S1] | voice: panel copy | B11 | merged into 66-V1 |
| [66-03-S1] | chip glide / reduce-motion jump | B6 | merged into 66-V2 |
| [66-03-S2] | deep GRAVEYARD row expands in place | B7 | merged into 66-V3 |
| [66-04-S1] | board order; LEANEST rewards efficient runs | B8 | merged into 66-V4 |
| [66-04-S2] | standing card after a fresh death | B10 | merged into 66-V5 |
| [66-05-S1] | matches the mock at M | B3 | merged into 66-V6 |
| [66-05-S2] | usable at the largest text size | B4 | merged into 66-V7 |
| [66-05-S3] | chips and tap targets comfortable | B5 | merged into 66-V8 |
| [66-06-S1] | DEAD tab: tab bar, DEAD lit, no chevron | C1 | merged into 66-V9 |
| [66-06-S2] | after a death the run is listed, INTERRED +1 | A3 | merged into 66-V10 (itself merged into A3) |
| [66-06-S3] | tab reopens on the last board | C2 | merged into 66-V11 |
| [66-06-S4] | every board renders in airplane mode | J2 | merged into 66-V12 |
| [66-06-S5] | title View the Dead after the first death | C3 | merged into 66-V13 |
| [66-07-S1] | no live hero: GRAVEYARD, chevron, two buttons | C4 | merged into 66-V14 |
| [66-07-S2] | BACK TO TITLE; ENTER still rolls | C5 | merged into 66-V15 |
| [66-07-S3] | ROLL A NEW HERO to the map | C6 | merged into 66-V16 |
| [66-07-S4] | BACK TO THE DUNGEON resumes | C7 | merged into 66-V17 |
| [66-07-S5] | Android back mirrors the chevron | C8 | merged into 66-V18 |
| [66-07-S6] | airplane mode changes nothing (title-opened panel) | J2 | merged into 66-V12's row (same airplane check of the panel) |
| [67-01-S1] | release-blocking Compete OFF cold boot capture | F1 | merged into 67-V1 (same check) |
| [67-01-S2] | Compete OFF + airplane cold boot and full run | J1 | merged into 67-V2 |
| [67-02-S1] | walk the runbook in Play Console, confirm menu paths | 0.1 | merged into 67-V15 |
| [67-02-S2] | debug-keystore keytool prints a SHA-1 | 0.10 | merged into 67-V15 |
| [67-02-S3] | after the APP_ID rebuild: tester initials, strip SIGNED IN | D3 | merged into 67-V11 |
| [67-03-S1] | voice: welcome card | K2 | merged into 67-V10 |
| [67-03-S2] | voice: failure card, never modal | K2 | merged into 67-V10 |
| [67-03-S3] | voice: Stop competing helper and Compete OFF line | K2 | merged into 67-V10 |
| [67-03-S4] | nobody glyph and pending face read as deliberate | E2 | merged into 67-V6 |
| [67-04-S1] | signed in: strip with display name, gold-ring avatar, SIGNED IN | D3 | merged into 67-V11 (same strip at sign-in) |
| [67-04-S2] | signed in: ALL/FRIENDS show the coming-online notes | B13, B16 | superseded by Phase 68 live boards |
| [67-04-S3] | Compete OFF: strip back to ?, SIGNED OUT, chips dimmed | F3 | merged into 67-V14's Compete OFF clause |
| [67-04-S4] | GRAVEYARD shows no identity strip | B12 | merged into 67-V14's GRAVEYARD clause |
| [67-05-S1] | band 2 at S/M/L, chip left of ☰, 477.8px at L | E1 | merged into 67-V5 |
| [67-05-S2] | title chip clear of status bar, cutout, splash text | E2 | merged into 67-V6 |
| [67-05-S3] | nobody face deliberate on HUD and title | E2 | merged into 67-V6 |
| [67-05-S4] | band-2 height unchanged; ☰ dropdown and scrim | E1 | merged into 67-V5 |
| [67-05-S5] | sheet opens from both chips; Settings row above the title | E3 | merged into 67-V7 |
| [67-06-S1] | placeholder APP_ID, Compete ON: nobody chip, one failure card | D1 | merged into 67-V3 |
| [67-06-S2] | Compete OFF cold boot capture (release-blocking) | F1 | merged into 67-V1 (same check) |
| [67-06-S3] | after console setup: Sign in row signs a tester in | D5 | merged into 67-V12 |
| [67-07-S1] | welcome card once, never again after restart | D3 | merged into 67-V11 |
| [67-07-S2] | declined sign-in: failure card, nothing modal, no retry | D4 | merged into 67-V12 |
| [67-07-S3] | Stop competing to nobody; Compete ON signs back in silently | E5 | merged into 67-V13 |
| [67-08-S1] | chip positions; placeholder nobody glyph and one card after ENTER | E2, D1 | merged into 67-V6 and 67-V3 |
| [67-08-S2] | after console setup: auto sign-in, welcome once, strip SIGNED IN | D3 | merged into 67-V11 |
| [67-08-S3] | declined Sign in: failure card, nothing modal | D4 | merged into 67-V12 |
| [67-08-S4] | no Play Games profile: fully playable | D2 | merged into 67-V4 |
| [67-08-S5] | Stop competing flips chips; Compete OFF cold boot capture | E5, F1 | merged: the Stop competing clause into 67-V13, the capture clause into 67-V1 |
| [67-08-S6] | Settings row from the title chip opens settings above the title | E3 | merged into 67-V7 |
| [67-08-S7] | Android back closes the account sheet first | C9 | merged into 67-V8 |
| [67-08-S8] | band-2 chip ignored during combat | E4 | merged into 67-V9 |
| [68-01-S1] | create the five season-1 leaderboards in Play Console | 0.1 | merged into 68-V1 (section 0) |
| [68-01-S2] | paste the IDs into LEADERBOARD_IDS[1] and rebuild | 0.2 | merged into 68-V1 (section 0) |
| [68-01-S3] | console score view shows the tag; LEANEST is rate x 1,000 | H1 | merged into 68-V2 |
| [68-02-S1] | a Compete-ON death appears on the Play Games board with its tag | H1 | merged into 68-V2 |
| [68-02-S2] | friends consent screen only after the in-panel tap | B16 | merged into 68-V12 |
| [68-02-S3] | (optional) rank line reflects the new score after a submit | H5 | own row: an extra with no VERIFICATION twin |
| [68-03-S1] | voice: DEEPEST rank quip at default and largest | K3 | merged into 68-V15 |
| [68-03-S2] | voice: LEDGER CAUGHT UP card (one/many), holds ~12 s | K3, G1 | merged into 68-V15 (read) and 68-V5 (the hold) |
| [68-03-S3] | standing-band line never claims the run placed | H4 | merged into 68-V4 |
| [68-03-S4] | voice: season-drop Oracle line and ALL/FRIENDS notes | K3 | merged into 68-V15 |
| [68-04-S1] | airplane death, relaunch online: once on each board | G1 | merged into 68-V5 |
| [68-04-S2] | queued death, Compete OFF then ON: nothing submitted | G2 | merged into 68-V6 |
| [68-04-S3] | (optional) signed out, die, sign in: queued run submits | G3 | merged into 68-V7 |
| [68-05-S1] | ALL fills in seconds, local rows usable | B15 | merged into 68-V11 |
| [68-05-S2] | airplane: last result or unreachable note, nothing blocks | J3 | merged into 68-V11 |
| [68-05-S3] | FRIENDS consent note; screen only after the tap; decline | B16 | merged into 68-V12 |
| [68-06-S1] | ALL on DEEPEST row anatomy; expand shows cause + six chips | B13 | merged into 68-V9 |
| [68-06-S2] | YOU and FRIEND tags fit beside a long handle | B13 | merged into 68-V9 |
| [68-06-S3] | NOT IN THE TOP TEN divider row last | B14 | merged into 68-V10 |
| [68-06-S4] | standing card '3RD · of N interred worldwide.' fits | B14 | merged into 68-V10 |
| [68-06-S5] | FRIENDS without consent: note and SHOW MY FRIENDS fit | B16 | merged into 68-V12 |
| [68-06-S6] | SEASON label fits; second-season chips wrap, switch read-only | I1, I2 | split: the label merges into 68-V13 (I1); the second-season chips are an extra with no VERIFICATION twin (own row I2) |
| [68-06-S7] | LINEAGE on ALL grouped rows and sampled footnote | B17 | merged into 68-V13 |
| [68-06-S8] | signed out or Compete OFF: Phase 66 notes | F3 | merged into 68-V14 |
| [68-07-S1] | 'You placed Nth of M.' fades in once | H2 | merged into 68-V3 |
| [68-07-S2] | remove-animations: no fade | H3 | merged into 68-V3 |
| [68-07-S3] | airplane death, relaunch: one LEDGER CAUGHT UP card after the map shows | G1 | merged into 68-V5 |
| [68-07-S4] | Compete OFF, die: no rank line, card, error or traffic | F2 | merged into 68-V8 |
| [68-07-S5] | ALL, FRIENDS and LINEAGE at default and largest text | B13, B16, B17 | merged into 68-V9, 68-V12 and 68-V13 (text sizes added to those rows) |
| [68-07-S6] | browser dev loop: pgsDevSignedIn | Z1 | merged into 68-V16 |

---

**Tally (written 2026-09-24):** 0 walked. The batch is run at the milestone close per the deferred-UAT protocol; RELEASE-BLOCKING row F1 must pass before any production rollout.
