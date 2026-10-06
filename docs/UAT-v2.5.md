# UAT v2.5 Achievements: Pixel 7 device round

Debug APK built from master `bbaecfba` (adds quick tasks 261005-vhn, 261005-vn5, 261006-1js), installed 2026-10-06 over the first 2.5 debug build `e9213960` (data kept). The Play 2.4.0 build was uninstalled on 2026-10-05 (local data wiped, user OK).

**Before you start:** the Pixel 7's Google account must be on Play Console > Play Games Services > Setup and management > Testers (draft achievements only reach testers). Done: the user confirmed it is on the list (2026-10-05). Mark each row passed / failed with a note.

## 1. The unlock card and the death screen (Phase 100)
| # | Check | Result |
|---|---|---|
| 1.1 | Die on floor 1 with a fresh hero: Special Snowflake shows in the EARNED, POSTHUMOUSLY strip above BURY THEM; both buttons still reachable | |
| 1.2 | Earn a tier while walking (e.g. Downward Mobility I at floor 5): a card with icon, ACHIEVEMENT, name and line; it holds about twice as long; a tap dismisses it | |
| 1.3 | Cross a tier inside a fight: no card during the fight or its last-round playback; the card appears after | |
| 1.4 | TalkBack announces the card once | |
| 1.5 | Special Snowflake is a Secret in the list on a fresh install. Then die on floor 3 (not floor 1): the death screen shows one hint line about floor 1 (it never names the achievement) under the Earned strip, both death buttons stay reachable, and in the list Special Snowflake now reads as itself, still locked | |
| 1.6 | A second death on floor 3 shows no hint line; abandoning a hero on floor 1 or 3 shows no hint line and reveals nothing; a later floor-1 death earns it and the Earned strip names it with no hint line | |

## 2. The ☰ ACHIEVEMENTS list (Phase 100)
| # | Check | Result |
|---|---|---|
| 2.1 | ☰ shows ACHIEVEMENTS after MARKS with a star and "N / 77"; never dimmed, even on the death screen | |
| 2.2 | Portrait: one column; landscape (Settings, Screen: Rotate): a centred column that scrolls on its own, no sideways scroll | |
| 2.3 | A tiered track expands and folds without the list jumping; progress reads like "37 / 50 kills" and "best: floor 7 / 10" | |
| 2.4 | Secrets read as "Secret" until revealed; unlocking a revealer (e.g. Downward Mobility I) reveals its hidden one | |
| 2.5 | Android back closes the sheet in one press; with remove-animations on, no motion | |
| 2.6 | Icons show in the list, the card and the death strip | |

## 3. Play Games (Phase 101): Compete ON, signed in
| # | Check | Result |
|---|---|---|
| 3.1 | An unlock shows the in-game card, then Play's own popup, and XP is credited. Check the XP after publishing: draft achievements unlock for testers but do not appear to credit XP (Special Snowflake showed 0 XP on the draft), so a 0 here before publishing is expected and not a failure | |
| 3.2 | An incremental achievement's progress and a reveal show in Play's list | |
| 3.3 | VIEW IN PLAY GAMES sits at the top of the list only with Compete ON and signed in; it opens Play's screen and back returns to the list | |
| 3.4 | Airplane mode: earn something, reconnect, it syncs (no popup storm) | |
| 3.5 | Compete OFF: earn something; nothing reaches Play (optional: adb logcat shows no Games calls); turn Compete ON and it syncs | |
| 3.6 | Force-stop the app mid-sync and relaunch: nothing lost, nothing doubled | |
| 3.7 | The Compete help line in the ☰ account block reads in full in portrait and landscape | |

## 4. Durability (Phase 99)
| # | Check | Result |
|---|---|---|
| 4.1 | Kill the app right after an unlock and relaunch: still unlocked with its date, and it doesn't fire again | |
| 4.2 | `adb install -r` an update over this build: counts, unlocks and the current run's progress survive | |

## 5. Release-only checks (on the signed 2.5.0 build, at release)
| # | Check | Result |
|---|---|---|
| 5.1 | VIEW IN PLAY GAMES opens Play's list (the shrinker kept the achievement IDs) | |
| 5.2 | Publish the achievements in Play Console after this round passes, at least 2 hours before the 2.5.0 rollout | passed: published by the user 2026-10-06 |
| 5.3 | Deploy darktier-studio commit 7d4ad754 (privacy pages) and re-check the Data safety form | |
