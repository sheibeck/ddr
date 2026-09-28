# v2.1 Pixel 7 device round (milestone close)

**Build:** Play 2.1.0 (versionCode 11), `android/app/build/outputs/bundle/release/app-release.aab`, signed with the upload key, tags `v2.1.0` / `v2.1.0-play11`, uploaded to the closed test by the user on 2026-09-28. A debug build with the same code is also on the Pixel 7.

**Protocol:** the deferred-UAT protocol. Every device check the v2.1 phases deferred is batched here, to walk in the user's own play sessions. Failures become todos.

**Install note:** the Play build and a debug APK have different signers. Installing one over the other needs an uninstall first, and the uninstall deletes saves.

**Sources:** the `human_verification` list of each v2.1 phase VERIFICATION.md (108 items, with Phase 80), plus the quick-task checks in section Q.

## 0. User tasks (console and store) (3)

| # | Step | Result |
|---|------|--------|
| 0.1 | Play Console → App content → Data safety: add the bug-report data types from `store-listing/LISTING.md` (Other user-generated content and Diagnostics; collected, optional, user-initiated, encrypted in transit, deletable on request). The privacy page already says this (deployed 2026-09-28). | open |
| 0.2 | After Play processes the 2.1.0 (11) upload, open its pre-launch report and confirm the edge-to-edge and deprecated-window-API warnings are gone, or name only the androidx/splashscreen back-compat rows recorded in `docs/ANDROID-DISPLAY.md`. | open |
| 0.3 | Carry forward the still-open v2.0 rows, above all F1 (the Compete-OFF cold-boot capture) in `docs/UAT-v2.0.md`. | open |

## 1. Phase 72: roll direction sign audit fixes (6)

Source: `.planning/phases/72-roll-direction-sign-audit-fixes/72-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 1.1 | Smoke + insult (72-04): the Smoke skill/ability card reads 'foes need a natural 1 to find you (a 1–2 if you insulted them)'; in a fight, after a parley insult, a smoked hero or party member can be found on a 1 or a 2 (the insult still counts after the member's own Smoke) | open |
| 1.2 | Fridgian frenzy (72-05): on a dark square, the frenzy second swing's Oracle line shows the hero's normal to-hit narrowed by one (not a flat 3), and it applies only when the frenzy actually fires | open |
| 1.3 | Skeleton shatter (72-06): a natural 1 on your strike die against a Skeleton shatters it outright, both lives, with its own Oracle line; M&M's note no longer promises 'criticals on a 1' | open |
| 1.4 | F1 (72-07): a party member swinging at a hard-to-hit foe (Zit, Stink Bug, a dozing foe, a magic-only foe) obeys the same limits the hero does | open |
| 1.5 | F3 (72-07): the Shadow can only be hurt by a dagger or a magic weapon, for the hero and party members alike | open |
| 1.6 | F2 (72-07): Acute Hearing's skill card reads 'never surprised' with no '3 to hit the unseen' clause | open |

## 2. Phase 73: engine roll high mirror (4)

Source: `.planning/phases/73-engine-roll-high-mirror/73-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 2.1 | Oracle and fight log: every roll line reads high-is-good in the form '17 vs 18–20 (mods)' — your strikes, members' and allies' strikes, thrown spells, foe swings at you and at members, pursuit, resistance, flee, parley, traps, locks, climbs, leaps, the cure — and no line mixes a flipped roll with an old 'need N or less' number (modifier signs are still the roller's until Phase 74) | open |
| 2.2 | On a d20 at level 1 a caster hits on 18–20, a thief on 17–20 and a fighter on 16–20 (as shown in the strike lines; the hero sheet and combat menu switch to ranges in Phase 74) | open |
| 2.3 | The best face now means the TOP face: a Skeleton shatters on a natural 20 (the strike die's top face), weapon crits land on 20 (19–20 for precise blades), and a smoked-and-insulted hero is found on 19–20 | open |
| 2.4 | Play feels identical to before the switch: same fights, same outcomes (the engine change is representation-only; this is a sanity check, not a balance check) | open |

## 3. Phase 74: roll display modifier honesty (7)

Source: `.planning/phases/74-roll-display-modifier-honesty/74-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 3.1 | Hero sheet and combat menu: a new level-1 hero's TO HIT reads the class range on d20 (Magic User 18–20, Fighter 16–20; a Thief with a Dagger 16–20); the combat menu's STRIKE row reads 'Hit 16–20 (d20) · … dmg' and FLEE reads an 'N–20 (d20)' range | open |
| 3.2 | Oracle and fight log, foe side: get insulted after a failed parley while Sidestep is up — the foe's line reads '(Sidestep +2, insulted −1)', and tapping that fight-log row reveals the same signs | open |
| 3.3 | Heights/water fear: a Heights climb reads '−2 on the climb' (or the live penalty) on both the Oracle and the rail | open |
| 3.4 | Foe details: long-pressing a foe shows 'You hit it on … · it hits you on …' with live modifiers; after casting Weaken the card's Weakened line reads 'it hits you only on 18–20 (d20)'; a magic-only foe without a magic weapon reads 'You cannot touch it' | open |
| 3.5 | Hero condition chips: tapping the Afraid chip in a fight opens with '−3 to hit (now …)'; tapping a live Anklet of Invisibility chip opens with its effect on the foes' swings | open |
| 3.6 | Item comparisons: a heavy weapon found or shopped while holding a Club reads '−2 to hit, worse than your Club'; a precise blade's crit range reads roll-high on your own die ('crits on 19–20') | open |
| 3.7 | No surface shows the same modifier with opposite signs, and no screen prints 'N+', a percent, or an old 'need N or less' number | open |

## 4. Phase 75: engine rules character economy grimoire combat bugs (12)

Source: `.planning/phases/75-engine-rules-character-economy-grimoire-combat-bugs/75-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 4.1 | RULES-01: pulling '+25 HP' twice on one hero gives two equal flat steps (linear, not compounding) | open |
| 4.2 | RULES-02: a floors 1–3 red-dot wilmst cache pays about 100 × depth, not a store buy-out | open |
| 4.3 | RULES-03: a level-1 Summoner rolls and casts an offense spell; a new Warlock/Apprentice never holds a spell that says 'not open to you yet'; a Summoner casting Heal restores about half what a Cleric's does (minimum 1) | open |
| 4.4 | RULES-04: the combat SPELLS menu has no row at all for a level- or school-locked spell; an out-of-charges spell stays listed and disabled; the Hero-tab Grimoire still lists everything | open |
| 4.5 | RULES-05: with Sense Presence on a dark square the Oracle reads 'You felt them coming. You go first.', never 'You cannot see what you are fighting', and a crit can land in the dark | open |
| 4.6 | RULES-06: a floor-2 trap at about 21 HP never kills on a '−1 HP' line; after a fight where a foe swings twice, the YOUR LOT card and the top HP bar agree | open |
| 4.7 | RULES-07: an ailment roll of 5 or 6 reads as a fear or phobia, not 'Disease.' | open |
| 4.8 | RULES-08: swapping new armor over a destroyed worn piece says the old piece was destroyed and is gone (and the Gear sheet warns before the swap) | open |
| 4.9 | RULES-12: a wanderer that interrupts a step onto a chest/trap/exit is fought first, then the tile still resolves once the fight and any spoils settle | open |
| 4.10 | RULES-13: a Magic User's bagged staff shows NOT WIELDED on the Gear tab and combat ITEMS and does nothing when tapped; a wielded staff fights as a d8 melee weapon and its charged power works from the weapon slot | open |
| 4.11 | RULES-14: casting Bubble throws the next hit back at the attacker in full, then pops into a small (~25 HP) pool that soaks the rest of that round | open |
| 4.12 | RULES-15: an unfed 100-square day or camp leaves a spent spell book empty (and says why) until the party actually eats; the 20-square trickle still works | open |

## 5. Phase 75.1: pilfer fumbles scroll reading (5)

Source: `.planning/phases/75.1-pilfer-fumbles-scroll-reading/75.1-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 5.1 | RULES-09: as a Pilfer, use a worn ring, cloak or wielded staff's power repeatedly. About one use in twenty, the Oracle says it came apart, HP drops by the stated d10 (unsoaked) and the item is gone from its slot. Potions, scrolls, tools and equipping never fumble. The Pilfer's blurb states both the good and the bad and never names a diagnosis. | open |
| 5.2 | RULES-10 reading: as a Fighter without Runes/Signs, read scrolls out of combat and in a fight. Most cast, some crumble with a 'can't make out the runes' line (never a refusal), and a bad miss backfires with a line naming who it hit. The SCROLLS count drops on every attempt. A Magic User or Runes/Signs holder always reads. | open |
| 5.3 | RULES-10 odds: on the Gear tab and in a fight's ITEMS menu, a non-reader sees 'reads on N–20 (d20, intel X); 1–M backfires', a Magic User sees 'without fail', and both surfaces agree. The Runes/Signs skill and the class notes describe the rule. | open |
| 5.4 | RULES-10 fumble severity (user rulings): a fumbled Death, Petrify or Freeze scroll never kills outright. It deals a heavy unsoaked blow (d10 + depth) plus Afraid. A fumbled Doze, Stun, Stupidity or Insane shows only LET THE ROUND PLAY with the reason, for at most four taps, with a 'Can't act' chip, and the normal menu returns after. A fumbled Blind shows 'Blinded' and a one-face STRIKE range. A fumbled Shrink shows 'Shrunk' and halves HP. Neither takes the menu away. | open |
| 5.5 | RULES-10 helpful fumbles: a fumbled Shield shields the targeted foe (your blows soak into its ward); a fumbled Bubble throws your next blow back at you; a fumbled Summon adds a demon to the foes (never more than 4 live foes). | open |

## 6. Phase 75.2: hero size matters (4)

Source: `.planning/phases/75.2-hero-size-matters/75.2-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 6.1 | Hero tab SIZE row per race: a Troll reads 'Large · +2 damage, −1 vs their swings'; an Elf reads 'Small · −2 damage' and is still thin-boned; a Dwarf reads 'Small · +1 vs their swings' and keeps +2 damage; a Human has no size effect. Wearing the Gauntlet of the Giant adds '· <race size> by birth', and the Damage line shifts by +2. | open |
| 6.2 | Foe details and the Oracle foe-swing line show a 'size' modifier for a Troll (size −1) and a Dwarf (size +1). An Elf shows only 'Elven −1', with no size token. | open |
| 6.3 | The Gauntlet of the Giant and an Enlarge potion each read 'one size larger for fifty squares: +2 damage, and one face easier for foes to hit'. Enlarge no longer adds a separate +4. Its chip names the resulting size ('Large'/'Huge') and counts down, and both stacked read as two steps. | open |
| 6.4 | Joiners: a Troll Joiner hits harder and is easier to hit; a Dwarven Joiner is harder to hit. | open |

## 7. Phase 75.3: deep floor encounter scaling (8)

Source: `.planning/phases/75.3-deep-floor-encounter-scaling/75.3-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 7.1 | Start a run at depth 20: fights bring three foes, some of them titled elites ('Grim …' at 20, 'Dread …' from 16). | open |
| 7.2 | Long-press a foe: its 'hits for' range matches the blows an elite actually lands. | open |
| 7.3 | Cast Freeze past floor 12. It either prints 'shrugs off … from Freeze. N vs A–20.' with the roll, or holds the foe with a 'Frozen · 3' chip that counts down and breaks ('shakes free and stands'). | open |
| 7.4 | Petrify, the Oak Staff and the Amulet of Stone past floor 12 show a Stone hold chip that counts down the same way. | open |
| 7.5 | An Unmoved chip (a resisted control) explains itself on long-press and names the effect. | open |
| 7.6 | A timed Blind past floor 12 reads 'for N rounds' on the Oracle and the rail. | open |
| 7.7 | On floors 5-9 about one fight in four is solo. From floor 10 no fight starts solo, and wandering monsters come in twos (floors 10-19) or threes (20+). | open |
| 7.8 | The changed spell texts (Freeze, Ice, Stupidity, Blind, Petrify) read well in the grimoire, and the Birch, Oak and Cedar staves and the Amulet of Stone read well on the gear sheet. | open |

## 8. Phase 76: darkness unification relaunch persistence (11)

Source: `.planning/phases/76-darkness-unification-relaunch-persistence/76-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 8.1 | Dark patch, no light: only the 3x3 around the party is revealed. With a torch lit, squares two away are revealed as you walk; with the Amulet of Light, three away. The explored map stays visible. | open |
| 8.2 | A fight on a dark patch with no light shows 'You cannot see what you are fighting.' and caps the odds. With a torch lit there is no such line, and the odds match a lit square. | open |
| 8.3 | A Darkness-phobic hero entering the dark with a torch lit is not frightened; with no light they are. | open |
| 8.4 | The DARK chip, its tap card, the vignette and the dark map squares all agree. A light source reads '… is holding it back', and dark squares take a faint warm tint that still reads as dark. | open |
| 8.5 | Save & quit mid-fight, or swipe the app away mid-fight: relaunch returns the same fight (foes, HP, round, effects). The Oracle says 'Still here. Still fighting. Round N…', and moving is still refused. | open |
| 8.6 | Relaunch with the store open: the same store with the same stock, and the Oracle says 'The shopkeeper has not moved…'. Relaunch during a pending find, hazard, tile or Joiner offer: the same decision is waiting. | open |
| 8.7 | A deep hero carrying more gold than the bag cap keeps it all across a relaunch. | open |
| 8.8 | Force-close between an action and its save write (not reproducible in tests): the relaunch lands on the last saved state, with no duplicated or lost turn. | open |
| 8.9 | Cast Map the Floor: the whole floor shows and the chip reads 'Mapped · until you move'. Tabs, camping and a fight on the same square keep it. One step fogs back the parts you never walked, and the Oracle and rail say your focus broke. A recast shows it again, and a relaunch mid-window keeps it. A Map the Floor scroll behaves the same. | open |
| 8.10 | A fumbled Weaken scroll in a fight puts a Weakened chip on YOU, halves your blows, and puts no weakened badge on any foe. | open |
| 8.11 | The full item-by-item list is in 76-05-SUMMARY '## Phase 76 device checklist' (22 items) and 76-06-SUMMARY's Plan 06 addendum (7 items). | open |

## 9. Phase 77: combat screen oracle readability (10)

Source: `.planning/phases/77-combat-screen-oracle-readability/77-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 9.1 | In a fight, open SPELLS, ABILITIES, ITEMS and SOCIAL: every row shows its whole label and description inside its border at the S, M and L text sizes. | open |
| 9.2 | SPELLS lists level 1 A to Z (a Summoner's Lesser Summon among them), then level 2, and so on. | open |
| 9.3 | Wear a ring and carry a cloak in the bag. The ring row reads 'EQUIPPED · READY' and works; the cloak row is greyed and reads NOT EQUIPPED with its reason. The ITEMS count matches the rows you can use. | open |
| 9.4 | THE FIGHT SO FAR and the round strip read in the order things happened: a riposte round reads miss, then 'pays', then 'falls'. Only identical back-to-back lines fold into ×N. | open |
| 9.5 | Fumble a Shield scroll (low-INT non-Magic-User): the targeted foe shows 'SHIELDED · n' and its long press explains it. A fumbled Mirror Self shows 'MIRRORED · n', and the long press gives the range you now hit it on. | open |
| 9.6 | A Magic User reading a too-advanced scroll sees the cast first and then 'Too advanced to copy into your book', never a refusal, on the ORACLE tab, the fight log and the rail. | open |
| 9.7 | Every foe card shows its family after its name ('ZIT · BEASTS'), and a deep elite reads 'DREAD … · FAMILY'. | open |
| 9.8 | Tap the oldest row of a long THE FIGHT SO FAR: it reveals its table dice, fully visible above the gesture bar. | open |
| 9.9 | Use Smoke: the hero card shows 'SMOKE · n', which counts down and clears. Tapping it explains the effect, what Smoke does, the rounds left and the source. Tapping mid-round opens the card without skipping the round. Party members' chips show under them in YOUR LOT. | open |
| 9.10 | When dazed, the strike's roll line lists 'dazed −2'. The onset reads '−2 to hit for N rounds', weakened says your blows do half damage, and both fades say the effect ended. With a torch in the dark there is no dark term; without one, 'dark −3'. | open |

## 10. Phase 78: hud dead state climb decisions (10)

Source: `.planning/phases/78-hud-dead-state-climb-decisions/78-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 10.1 | Walk into a wall or crevice: a card offers CLIMB IT / LEAP IT with a d10 range, USE LADDER / USE ROPE only while carried, and TURN BACK. No dice until you commit. TURN BACK costs nothing (no step, no day tick, no fear). Map taps and arrow keys pulse the card, a relaunch mid-card brings the same card back, and it rolls the same. | open |
| 10.2 | Band 1 reads 'Race Sub-class · Lvl N'. At S, M and L the level always shows, and the name ellipsizes first. | open |
| 10.3 | A regained spell charge gets a rail line with the count. A fed new day that refills a spent book says so, with the count; an unfed day keeps 'Book stays empty.' | open |
| 10.4 | Die on the map: the death card offers REVIEW THE ORACLE, FINAL SHEET and BURY THEM. HERO and GEAR are dimmed; ORACLE and DEAD open. MAP shows where you died (drag and pinch only; tap, hold and arrows do nothing). In the ☰, MARKS, CENTRE MAP and MAKE CAMP are dimmed. FINAL SHEET lists stats, level, gear, the book and the epitaph, and has only Close. | open |
| 10.5 | Text size S, M and L scale every screen, the combat screen included. In Settings a vertical drag starting on a volume slider scrolls the sheet and never changes a volume; a sideways drag or a track tap sets it. | open |
| 10.6 | Stairs: the screen fades to black under the stairs sound, the new floor fades in, and the FLOOR card follows. Input is ignored during the fade. Remove-animations gives an instant cut; a teleport still snaps. | open |
| 10.7 | Acute Hearing (a Thief): faint rings on unresolved encounter dots up to 3 squares away, through walls, never on traps or chests. Holding one says only that something is there. MARKS has a HEARD row. A hero without the skill never sees rings. | open |
| 10.8 | Settings › Movement: TAP TO MOVE (the default) or ARROWS, with the pad bottom left or bottom right. Each press is one step and map taps don't step. The map scrolls before the party slips under the pad. The pad is inert while dead, in a fight, at the stair prompt or under a sheet. TalkBack reads 'Step north'. | open |
| 10.9 | Full bag at text size L, find a weapon: the item, its stats and TAKE IT NOW / LEAVE IT stay visible, and the drop list scrolls inside the card with each row's stats. | open |
| 10.10 | The full numbered list (37 items) is in 78-09-SUMMARY '## Phase 78 Pixel 7 checklist'. | open |

## 11. Phase 79: content narrative pass (7)

Source: `.planning/phases/79-content-narrative-pass/79-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 11.1 | VOX-04: roll a Summoner, a Warlock, an Illusionist and a non-Human race. The reveal and the Hero tab's dossier footer state Good and Bad (the Summoner's half-strength healing, the gates, the level-1 Phantom Host, the race's trade-off), and both footers wrap without clipping at S, M and L. | open |
| 11.2 | ROLL-04: Mirror Self, Weaken, Smoke, Battle Roar, a Crystal Staff or Anklet, and Lockpicks each state a roll-high range, and the foe details card shows the same range in a fight. The Anklet's roll-line term reads 'unseen'. | open |
| 11.3 | VOX-05: a full fight (flee, a party blow, initiative), spells and a scroll fumble, deaths and epitaphs, the Leaderboards rule lines, the Hero, Gear, store and final-sheet panels, MARKS, Settings and the ☰ menu at L, and a walked floor (trap, crevice, store, Joiner offer, hungry night, relaunch mid-fight). Every line says who did what to whom and the result before the joke, every refusal says why, and 'armour' is spelled the British way. | open |
| 11.4 | 79-02c (user ruling): take the stairs down. HP does not change on descent and no 'the dungeon lets you keep +N hp' line appears. A level-up on the stairs still adds its own HP gain. | open |
| 11.5 | Number honesty: a potion drunk a few HP below full leads with the HP actually restored; a Table 4 red dot shows the loss with a minus sign and the HP bar drops by exactly that. | open |
| 11.6 | Read docs/narrative-pass/review.html (482 rows on 15 surfaces) surface by surface and list any tone changes for one follow-up task. | open |
| 11.7 | The full numbered list (15 items) is in 79-13-SUMMARY '## The Phase 79 Pixel 7 checklist'. | open |

## 12. Phase 79.1: milestone balance check deep floor tuning (1)

Source: `.planning/phases/79.1-milestone-balance-check-deep-floor-tuning/79.1-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 12.1 | Play a few runs on the Pixel 7 and confirm the difficulty feels right: harder than 2.0, with no sudden wall around floor 5. The typical fair-bot run now dies on floor 4. | open |

## 13. Phase 79.2: early floor difficulty retune floors 1 12 harder fair bot p5 (5)

Source: `.planning/phases/79.2-early-floor-difficulty-retune-floors-1-12-harder-fair-bot-p5/79.2-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 13.1 | Play floors 1-6 on the Pixel 7 (debug build from 49829f70). Foes hit harder and more often, have more HP, and start a level higher, while the hero starts with a little more HP. It should feel clearly harder than v2.0 without a sudden wall at floor 5. | open |
| 13.2 | Freeze: a hit deals d6 + your level² damage. A survivor is frozen for d4 rounds unless it resists; a resist keeps the damage but drops the freeze. Freeze never kills outright. | open |
| 13.3 | Spells: every spell cast on a foe can be resisted, and the Oracle notes each resist roll. A resisted damage spell does nothing (Freeze excepted). | open |
| 13.4 | Once per fight: Feint, Kata, Death Touch, Silent Step, Overhead Blow and Last Stand read 'spent for this fight' after one use. | open |
| 13.5 | A failed climb or leap always costs at least 1 HP. | open |

## 14. Phase 79.3: in app bug reports report a bug player text the run s oracle (4)

Source: `.planning/phases/79.3-in-app-bug-reports-report-a-bug-player-text-the-run-s-oracle/79.3-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 14.1 | ☰ → REPORT A BUG opens the sheet on the map, in a fight, on each tab and while dead, and the ✎ glyph renders. With the keyboard up, the box and SEND stay visible. Typing never moves the party. | open |
| 14.2 | With airplane mode on, SEND says it could not reach the server and keeps the draft. Back online, SEND thanks you and closes. The report appears as a player-report issue on sheibeck/ddr within about 15 minutes. | open |
| 14.3 | ☰ → PATCH NOTES shows the 2.1.0 notes offline, and the ¶ glyph renders. 'Past versions' opens the website in the browser, and the game is unchanged on return. | open |
| 14.4 | Installing 2.1.0 over the Play 2.0.0 build opens the notes once over the title, and a relaunch doesn't open them again. A fresh install never auto-opens them. Back closes both sheets. | open |

## 15. Phase 81: leaderboards panel fixes (8)

Source: `.planning/phases/81-leaderboards-panel-fixes/81-VERIFICATION.md`

| # | Check | Result |
|---|-------|--------|
| 15.1 | Signed in with Compete ON, the Leaderboards panel opens on ALL; the ME | ALL | FRIENDS chips switch every board; signed out or Compete OFF it opens on ME and ALL/FRIENDS show the sign-in note | open |
| 15.2 | On ALL and FRIENDS your own score reads YOU, never FRIEND, and appears once — no duplicate under the 'not in the top ten' divider when you are already listed | open |
| 15.3 | The standing card appears only when you are ranked but off the visible list; when Play Games hides your score (gameplay activity not shared publicly) the panel says so honestly | open |
| 15.4 | Two signed-in devices (you + a friend): after a run and reopening the panel, each sees the other's score on ALL, and each own row reads YOU (BOARD-16 backstop truth) | open |
| 15.5 | Under ME the rail ends LINEAGE, GRAVEYARD; neither appears under ALL/FRIENDS; GRAVEYARD lists every stored run (newest 60) with tap-to-expand epitaphs; VIEW THE DEAD opens GRAVEYARD | open |
| 15.6 | LEANEST is gone from the rail; an old save with LEANEST bests and queued runs loads cleanly and nothing is submitted to it | open |
| 15.7 | A new deeper run lands on ME DEEPEST above older ones (a depth-10 run tops a depth-9); if the earlier missing depth-10 run's gravestone is still stored, it reappears on ME DEEPEST after the update's first launch | open |
| 15.8 | After the update ships: delete the Season-1 LEANEST board (CgkIlvbN0YYPEAIQAw) in Play Console per docs/PLAY-GAMES-SETUP.md §13 (leave it if the console refuses) | open |

## 16. Phase 80: Android release build tooling (6)

The emulator pass (80-05) was cancelled by the user on 2026-09-28 and deferred until the features are in. These are the Pixel 7 checks on the uploaded 2.1.0 (vc11) R8 build.

| # | Check | Result |
|---|-------|--------|
| 16.1 | The Play build (2.1.0, R8-minified) installs, boots to the title and plays a run with no crash. | open |
| 16.2 | Force-stop mid-run and relaunch: the same hero resumes. | open |
| 16.3 | The back gesture on the map shows the confirm-quit prompt; in a sheet or menu it closes that first. | open |
| 16.4 | Sound, music and haptics work as in 2.0. | open |
| 16.5 | In gesture navigation and in 3-button navigation, the HUD sits below the status bar and camera cutout, and the bottom dock clears the navigation bar or gesture handle. | open |
| 16.6 | After Play's next pre-launch report: the edge-to-edge and deprecated-API warnings are gone, or name only the androidx/splashscreen back-compat rows recorded in docs/ANDROID-DISPLAY.md. | open |

## Q. Quick tasks since 2.0 (device checks)

| # | Check | Result |
|---|-------|--------|
| Q.1 | A bottom rail card hides the store, loot and stair buttons in place (and the arrow pad), and they return when the card is dismissed. | open |
| Q.2 | The find card scrolls with a full bag, and its item rows are clearly separated. | open |
| Q.3 | Dying, leaving the map and coming back: the death card is still up, full screen, with its three buttons. | open |
| Q.4 | The theme music is twice as loud as in 2.0 at the same slider setting. | open |
| Q.5 | Spells cast at foes show the foe's resist roll in the Oracle, and a resisted damage spell does nothing (Freeze keeps its damage but drops the hold). | open |
| Q.6 | Kata, Feint, Death Touch, Silent Step, Overhead Blow and Last Stand read "spent" after one use in a fight. Kata and Feint can miss. | open |
| Q.7 | Thrown-spell text states its to-hit and damage, including your level². | open |
| Q.8 | With the Cloak of Strength used, a foe crit lands as an ordinary hit, and the chip reads Crit-proof. | open |
| Q.9 | Your hero resists foe spells on the half-intelligence scale (5% at intel 1–2, 45% at 18), and the rail states the roll and range. Joiners resist too. | open |
| Q.10 | Smoke's chip reads 2 rounds right after the throw, and Sidestep, Battle Roar and Riposte show their stated rounds. | open |
| Q.11 | Sweep against a lone foe is greyed out ("needs two or more foes") and costs no turn. | open |
| Q.12 | A Thief's flee shows +3. Foes hit an Acrobat on their top 4 faces. | open |
