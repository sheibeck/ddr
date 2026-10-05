# v2.4 Pixel 7 device round (build gate, before Phase 98 screenshots)

**Build:** the debug APK 2.3.0 (versionCode 13), `android/app/build/outputs/apk/debug/app-debug.apk`, 14,615,477 bytes, sha256 `ede382b2f88f78f7a3c25496f37aabed742ff2ea0fe07b8dce2ca3b2caa08c7b`, built from commit `15ed21b8055d805d15058ae176d44ec2656ed8fe`. It is built from master after Phase 97, so it holds all v2.4 code (Phases 93–97). The Play release build comes after the user agrees the 2.4.0 patch notes (row 0.1). That build is 2.4.0 at versionCode 14, made with `npm run play:release`, which bumps the version.

**Protocol (deferred UAT):**
- Every device check that Phases 93–97 deferred is batched here and walked in the user's own play sessions.
- Results are recorded as the user states them: `pass`, `fail: <what you saw>`, or `not reached`.
- Failures become quick tasks before the release build, or todos.
- Rows marked *decision* need the user's call, not a test.

**Install note:**
- `adb install -r` of this debug APK over a debug install keeps the run, the history and the settings.
- Over the Play build, it needs an uninstall first, because the two have different signers. The uninstall deletes the local run and settings.

**Sources:** the `human_verification` lists in `.planning/phases/{93,93.1,94,94.1,95,96,97}-*/*-VERIFICATION.md` and the plan SUMMARYs they name. Layout screenshots for every device shape are at https://claude.ai/artifact/ELyMSDLXdN3PFacmnuWX5P.

## 0. Release, console and build-gate tasks (7)

| # | Step | Result |
|---|------|--------|
| 0.1 | Agree `docs/patch-notes/2.4.0.md` with Claude, including the new "Screens" bullet, and delete its DRAFT paragraph. (user + Claude) | open |
| 0.2 | Release build: `npm run play:release` bumps to 2.4.0 / versionCode 14 and builds the signed AAB. The user uploads it to Play. (Claude builds, user uploads) | open |
| 0.3 | Merged manifest of the release build (`aapt2 dump xmltree`): no `screenOrientation` on MainActivity, `appCategory="game"` kept, `configChanges` intact. (Claude, at 0.2) | open |
| 0.4 | After the upload, Play's large-screen notice ("orientation and resizability restrictions") no longer fires. (user, Play Console) | open |
| 0.5 | Refresh `docs/PERF-BASELINE.md` on the Pixel 7: portrait and landscape step timings. (Claude, phone connected) | open |
| 0.6 | AVD pass, which absorbs the cancelled 80-05 profiles. Run it on the debug APK. In every profile there must be no restart, the run, fight and store must be kept, and the HUD and side panels must stay clear of the bars and the cutout. (Claude) | open |
| | - pixel_7 with gesture navigation, 3-button navigation and a cutout, in portrait and landscape | |
| | - pixel_tablet rotated both ways mid-fight | |
| | - pixel_fold folded and unfolded mid-store; the Screen lock re-applies on the cover screen | |
| | - a desktop-size window dragged across 840 px twice | |
| 0.7 | Pixel 7 smoke from `docs/RELEASING.md` once the Play build reaches the phone. (user) | open |

## 1. Phase 93: Harmful chips first, cloak heals on use (5)

| # | Check | Result |
|---|-------|--------|
| 1.1 | Poisoned or Diseased while buffed: the harmful chip is first on the strip under the HUD. In a fight, Dazed or Weakened leads the strip and the hero's YOUR LOT card. A Joiner's card keeps its old order. | open |
| 1.2 | Use a worn Cloak of Regeneration while hurt. HP rises at once ("Tick 1 of 4", rail "(1/4)"), then ticks 2–4 come at 10, 20 and 30 squares. The chip counts 3, 2, 1. The start line says a d6 now, then 3 more while walking. | open |
| 1.3 | Use the cloak mid-fight from ITEMS: HP rises at once, the fight goes on, and no more ticks come until you walk. At full HP it says "Nothing left to knit." and the chip still shows 3. | open |
| 1.4 | Use a Joiner's cloak from the Company panel: that Joiner heals at once, by name. | open |
| 1.5 | The cloak's Gear card, store line and find card all read "a d6 hp back at once, and again every ten squares you walk, three more times". | open |

## 2. Phase 93.1: Gauntlet of the Giant (3)

| # | Check | Result |
|---|-------|--------|
| 2.1 | Wear and use the Gauntlet: the Oracle and rail say +6 damage and foes +1 to hit you, and the Enlarged chip's card says the same. | open |
| 2.2 | The Gear card, a store's Gauntlet line and a found Gauntlet each read +6 damage, foes +1 to hit you. | open |
| 2.3 | With the Gauntlet live, the Hero tab's DAMAGE line rises by 6. The SIZE row still shows the step's +2, as it does for Enlarge. | open |

## 3. Phase 94: Ability states you can tell apart (5)

| # | Check | Result |
|---|-------|--------|
| 3.1 | In a fight, the ABILITIES submenu shows four states. Judge the lime ink and the 12% hatch on the Pixel 7. | open |
| | - READY: solid edge, lime | |
| | - READY IN N: dashed, amber; N drops each round | |
| | - the gate's reason, e.g. NEEDS TWO OR MORE FOES: hatched, rust | |
| | - SPENT THIS FIGHT: faded grey | |
| 3.2 | Tapping any row that isn't ready logs a refusal matching its words. A READY row acts. | open |
| 3.3 | Last Stand reads NEEDS A QUARTER HP OR LESS above a quarter HP, and READY at or below it. | open |
| 3.4 | The Hero tab's abilities list shows the same words and edges in a fight, and is unchanged out of a fight. | open |
| 3.5 | A Bard's SING row reads READY IN N between songs and SPENT THIS FIGHT after the second. | open |

## 4. Phase 94.1: Joiner level follows depth (2)

| # | Check | Result |
|---|-------|--------|
| 4.1 | A Joiner met on floors 1–3 is always level 1; on floors 4–6 it is at most level 2. The meeting line says "a level N …". | open |
| 4.2 | A Joiner taken on keeps its level as you go deeper. | open |

## 5. Phase 95: Fantasy flavour I, spells, scrolls and items (4)

| # | Check | Result |
|---|-------|--------|
| 5.1 | At text size L, with Always show the rules OFF then ON, each of these shows flavour first, and RULES reveals the exact old text: the Grimoire, the combat SPELLS and ITEMS rows, the find card, the Gear tab (WORN, BAG, CONSUMABLES), the Gear sheet, the store, the sell list, the loot card and the bag-full drop shelf. | open |
| 5.2 | Drop shelf at large text: a long flavour line plus the usable-by tag may clip at the two-line clamp. | open |
| 5.3 | *Decision:* read the 114 Phase 95 lines in `docs/narrative-pass/review.html` and confirm or overrule them. | open |
| 5.4 | *Decision:* confirm or overrule the discretion calls in 95-08-SUMMARY items 19–26: | open |
| | - the niche label comes before the flavour | |
| | - the armour WORN row keeps its wear note | |
| | - the weapon voice line gives way to the type flavour | |
| | - jewel and cloak candidates read as flavour | |
| | - the Sealed scroll's RULES | |
| | - the loot advice line | |
| | - a RULES body that repeats a usable-by tag | |
| | - the 2.4.0 Headline stays unchanged | |

## 6. Phase 96: Fantasy flavour II, races, sub-classes, abilities and chips (12)

| # | Check | Result |
|---|-------|--------|
| 6.1 | Roller reveal at text size L: flavour comes first, with a RULES chip per group. DESCEND stays reachable, and RULES never rolls or commits. Check with Always show the rules on and off. | open |
| 6.2 | Hero tab: the dossier and trait-line RULES, and the ability and special-skill lists, Off then On. Opened dossier bodies use the mono footer style. | open |
| 6.3 | Combat ABILITIES and SING at text size L in the 206 px list: flavour and RULES fit, the four state words still read apart, and a RULES tap never uses the ability. | open |
| 6.4 | Chip taps on the HUD strip, the combat condition card, YOUR LOT and the Company panel: flavour comes first, harmful chips read as trouble, RULES opens the exact old text, and the hold time is readable. | open |
| 6.5 | The UP YOUR SLEEVE card on a fresh Fighter and a fresh Thief. The Oracle log shows the flavour line. | open |
| 6.6 | Final Sheet after a death: the tricks, worn and bag sections, Off and On. Bag notes fit at the largest text size. | open |
| 6.7 | Buy an active skill (Kata, Smoke) and read its Hero row, Off then On. | open |
| 6.8 | Screen walk for any rulebook sentence left: Gear, the store, loot and find, the drop shelf, the Grimoire, combat SPELLS, ITEMS and ABILITIES, Hero, chips, the title and the roller. | open |
| 6.9 | Read the Phase 96 lines: https://claude.ai/artifact/EXJPDVF9RwJCtLFR8na3zG, or all 236 Phase 95 and 96 lines in `docs/narrative-pass/review.html`. Include the 3 self-checked rows: Death Touch, Second Wind and Feint. | open |
| 6.10 | *Decision:* the discretion calls. | open |
| | - the trait-line race note sits behind RULES | |
| | - the Final Sheet shows flavour only, with the exact text only when Always is on | |
| | - the UP YOUR SLEEVE card and its Oracle line | |
| | - blurbs use no number words at all | |
| 6.11 | *Decision:* the canon Samurai SUB_NOTE still contains "suicidal", which the safety wordlist bans. Edit the canon text or keep it. Play content-rating answers may care. | open |
| 6.12 | *Decision:* pick one standard for vague counts. Round 2 failed "a few rounds", while round 1 passed "a few Demons" on the Plane Gate line. | open |

## 7. Phase 97: Large-screen support (8)

| # | Check | Result |
|---|-------|--------|
| 7.1 | Settings > Screen: Portrait keeps the game upright when the phone turns. Rotate lets it turn without a restart. The choice survives a relaunch. A tablet has no Screen row. | open |
| 7.2 | Landscape in both directions, with Screen set to Rotate. Every screen must fit. Play a full run: | open |
| | - roll, then walk with the arrows and with tap-to-move | |
| | - a find docks beside the map, and the pad stays up | |
| | - two fight rounds: the fight is the right-hand panel and the actions are on screen | |
| | - the store and Make Camp (docked right) | |
| | - Hero, Gear, the Oracle and the leaderboards | |
| | - die and bury | |
| 7.3 | Landscape at text size L: the one-row HUD keeps the name, HP and the four counters, and the ☰ dropdown fits. | open |
| 7.4 | Cutout and navigation bars: with the cutout on the left, then on the right, and with gesture and 3-button navigation, no HUD text, tab, rail card, side panel or docked camp sheet sits under an inset. | open |
| 7.5 | *Feel:* in a landscape fight the foe-card strip is about 50 px tall and scrolls. Is aiming comfortable? Is the side panel at 45% of the width right? | open |
| 7.6 | 10" tablet or Chromebook, if one is available: the map squares read larger than on the Pixel 7, taps are easy, and pinch zoom works. Portrait tablet panels are a centred column of at most 640 px. | open |
| 7.7 | *Decision:* on two-pane screens, the right pane collapses to zero on MAP when nothing is up. Keep that, or make the pane always present (a one-rule change). | open |
| 7.8 | *Decision:* the "Screens" patch-notes bullet. Agree it with row 0.1. | open |
