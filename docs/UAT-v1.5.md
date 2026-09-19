# v1.5 Pixel 7 UAT Batch — consolidated checklist

**Build:** debug APK from `9cb6b4a` (tag `v1.5`), installed 2026-09-19 via `adb install -r`, app force-stopped and relaunched.
**Protocol:** `defer uat to end` — no device pause was taken in Phases 36–43; this is the one batch. Items are grouped by phase and numbered continuously. Mark each ✅ / ❌ (with a note) / ⏭ (skipped, why).

**Suggested order:** start a fresh run (36/37/38/43 first-paint items), then a store visit (39/43), a few fights (38/40/42), a Magic User run (40), a wet/dark floor (41), a camp (43), then resume a pre-v1.5 save last (tolerant-load items).

## Phase 36 — Balance Foundation, Effect Timers & Small Wins (18)

1. [ ] (TGT-01): start a fight with two or more foes and kill the currently-targeted one (own blow, Joiner blow, item/spell kill) — the TARGET tag jumps to the next living foe's card before anything else can be tapped
2. [ ] (TGT-02): tap the downed (greyed) card repeatedly — nothing happens: no target change, no log line, no armed feedback
3. [ ] (TGT-02, race): immediately after a kill, spam-tap a live non-target card within ~250 ms — either the tap is swallowed or the tapped card becomes the target; a strike never lands on a foe you did not choose
4. [ ] (TGT-01, sources): a Joiner's blow or a Freeze that kills the current target also moves the TARGET tag to a survivor
5. [ ] (TGT-02, a11y, optional): with TalkBack on, the downed card reads as disabled
6. [ ] (CUT-01): roll a Cutthroat and walk until a Joiner is met — the rail shows the COMPANY offer card (TAKE THEM ALONG / LEAVE THEM), not a refusal
7. [ ] (CUT-01): accept the Joiner, open the Hero tab — the Company panel lists them
8. [ ] (CUT-02): descend floor after floor until the murder line fires (1-in-20 per descent; the dev start-depth harness can speed floors) — a COMPANY card in the bad tone with one of the six lines, the same line in the Oracle log, and the Company panel is empty afterwards
9. [ ] (CUT-01, regression): as a Wilmsry meeting a Magic User Joiner, the refusal still reads exactly as before
10. [ ] (CUT-01, blurb): the Cutthroat dossier blurb on the Hero tab states 'one descent in twenty'
11. [ ] (JOIN-01, rail): after a DISMISS confirm, the rail shows a COMPANY card (dull tone) with one of the five parting lines and the Oracle log carries the same line — never a toast, never inline text
12. [ ] (JOIN-01, roster): the Company panel is empty afterwards and the next Joiner met can be accepted without a swap line
13. [ ] (JOIN-01, sheet): accept any Joiner, open the Hero tab — the card shows name, sub / race, class · level, an HP bar labelled HP, 'Weapon: <name>', 'Eats N a rest', and a DISMISS button
14. [ ] (JOIN-01, confirm): tap DISMISS — it becomes 'Send them off? [Yes] [No]'; No reverts; waiting ~3 s reverts; tapping anywhere else reverts
15. [ ] (JOIN-01, confirm → Yes): the card disappears, the panel hides if it was the last member, the rail shows the COMPANY card and no text appears inside the panel
16. [ ] (JOIN-01, combat): during a fight, open the Hero tab — no DISMISS button on the card
17. [ ] (JOIN-01, rations): a Troll Joiner's card says 'Eats 2 a rest'
18. [ ] (SC-6, regression): a normal run and a pre-Phase-36 save look, sound and play identically to 1.4.0 outside the four features above (effects.js has no player-visible behaviour)

## Phase 37 — Equipment Slot Model & eff() Refactor (14)

19. [ ] (GEAR-04): resume a pre-Phase-37 save carrying two of one slot type (e.g. two Rings of Power) — the GEAR rail card reads 'You were wearing two rings on one finger. Physics has filed a complaint — Ring of Power is in your bag now.', the Oracle log carries the same line, and it shows exactly once per boot (a second ENTER or a fresh roll shows nothing)
20. [ ] (GEAR-04): resume a clean pre-Phase-37 save (nothing doubled) or one that already has worn — no reconciliation card
21. [ ] (GEAR-03, fresh run): start a new run as a Thief — the starting cloak is already worn (Gear tab worn area, not the bag) with no extra tap
22. [ ] (GEAR-03, combat): fight with a worn activatable staff/cloak/jewelry — it appears in the combat ITEMS submenu and is usable under the existing cooldown rules; the same item bagged instead shows the notWorn refusal ('Wear it first') when tapped
23. [ ] (GEAR-03, Gear tab): with at least one worn slot item, the worn row reads name · txt with [Use] (activatables only) and [Unequip], formatted like the weapon/armor rows
24. [ ] (GEAR-03, swap): tap EQUIP on a second Ring of Power while one is worn — the row shows 'Swap for Ring of Power? [Yes] [No]'
25. [ ] (GEAR-03, swap): No reverts; waiting ~3 s reverts; tapping anywhere else reverts; arming a second row disarms the first
26. [ ] (GEAR-03, swap): EQUIP → Yes on the occupied slot — the swap lands, the Oracle names the displaced item going back to the bag, and the displaced ring now shows EQUIP in the bag list
27. [ ] (GEAR-03, unequip): UNEQUIP on a worn item with a full bag reads 'Bag full' and is inert, exactly like the weapon/armor rows
28. [ ] (GEAR-03, take): pick up a cloak with an empty cloak slot (find/loot/store/Thief kit) — it auto-wears with an Equipped-style line and no extra tap
29. [ ] (GEAR-03, take): pick up a second cloak with the slot occupied — it goes to the bag with an EQUIP button, never auto-swapped
30. [ ] (GEAR-03, eff): with a worn Amulet of Light the map's revealed radius stays widened — the classic script's eff('sight') reads the worn model via window.__mzEff
31. [ ] (GEAR-03, eff): on the Hero tab a worn Ring of Power's +1 damage is counted exactly once, not doubled by a second bagged Ring of Power
32. [ ] (a11y, optional): with TalkBack on, the swap confirm's Yes/No and the worn row's Use/Unequip read their labels

## Phase 38 — Melee Active Abilities (15)

33. [ ] (ABIL-03, level-up): level a fresh Fighter or Thief once (dev start-at-depth, or a kill) — the SKILL LEVEL N rail card / fight log shows a second line reading 'New trick: {name} — {txt}'
34. [ ] (ABIL-05, Joiner opener): recruit a Fighter or Thief Joiner and, in a fight, watch the fight log for a '{name} calls {ability}.' line in round 1 (an opener ability, e.g. Pommel Strike/Dirty Trick/Battle Roar/Silent Step) followed by its effect line, with the companion's name correct
35. [ ] (ABIL-05, Joiner policy): past round 1 the Joiner uses a damage-tagged ability (e.g. Kata/Feint/Sweep) against a healthy foe, or a defensive-tagged one (e.g. Brace/Second Wind) once it has taken damage
36. [ ] (ABIL-05, Joiner cooldowns): a Joiner's ability is READY again at the start of the NEXT fight (cooldowns clear at endCombat), and a member Battle Roar's fight-log line reads as covering the whole party's side
37. [ ] (ABIL-01, submenu): open ABILITIES mid-fight as a fresh Fighter/Thief — at least one row reads READY with its effect line
38. [ ] (ABIL-01/02, use): use it — the fight log shows 'You call {name}.' then the effect line, the foes take their turn once, the row now reads 'N ROUNDS'
39. [ ] (ABIL-02, cooldown refusal): tap the same row on cooldown — the fight log shows '{Name}: N rounds. Your arm has opinions.' and nothing else happens
40. [ ] (ABIL-01, once-a-fight): a once-a-fight ability after use reads 'ONCE A FIGHT · USED' and is READY again next fight
41. [ ] (ABIL-01, Bard): Sing is still the first row, ability rows follow
42. [ ] (ABIL-04, Hero tab): Special skills list shows only kept passives; the Abilities list shows table actives tagged 'special skill · active' and pool tricks tagged 'trick', with 'cd N rounds' / 'once a fight' out of combat
43. [ ] (ABIL-03, first paint): a brand-new run's first paint shows the UP YOUR SLEEVE rail card 'New trick: {name} — {txt}' once, mirrored in the Oracle
44. [ ] (ABIL-03, victory report): level up in a fight — the fight log carries 'New trick: …' and the victory report lists it
45. [ ] (a11y): TalkBack reads each ability row's label/cost/desc
46. [ ] (tolerant load): a pre-Phase-38 save resumes with its old skills renamed/dropped and abilities present (Hero tab) with no card or crash
47. [ ] (voice): spot-check a few ability tones (Pommel Strike/Sweep/Riposte/Smoke) for the family-friendly deadpan voice in real play, not just the synthetic safety-scan corpus

## Phase 39 — Gear, Magic Items & One-Shot Tools (17)

48. [ ] (GEAR-01, to-hit): Hero tab TO HIT / TO STRIKE show the real weapon-adjusted numbers — Rapier 1–6, Flail 1–4 on a Fighter (need +1 / need −1 axes visible)
49. [ ] (GEAR-01, bulk): a Thief in Plate armor is refused the backstab ('Heavy armor negates…'); a Thief in Studded armor is not
50. [ ] (GEAR-01, store): the store's weapon offerings at any depth show a genuine heavy/neutral/light mix, not 'highest dice you can afford'
51. [ ] (GEAR-02, potion): drink a Speed potion from the Gear tab — the Oracle shows 'You use Speed potion.' then 'Double attacks for 50 squares.' and a Hasted chip counts down in the condition strip
52. [ ] (GEAR-02, cooldown): use a worn Cloak of Speed twice in a row — the second tap reads 'Cloak of Speed: 50 squares. It is not a vending machine.', the Gear-tab row shows 'cd 50 SQ' and a matching itemCooldown chip counts down
53. [ ] (GEAR-02, charges): a Magic User uses a Pine Staff in a fight, then again — the second use reads 'Pine Staff: 100 squares to the next charge. Patience is also a spell.' and the ITEMS submenu / staffCharges chip shows '0/1 · N SQ'
54. [ ] (GEAR-02, tolerant load): resume a pre-Phase-39 save mid-run — no card, no crash, worn cloaks/staves usable, any previously-active haste/invis/ether/acute effect reappears as a timed chip
55. [ ] (GEAR-05, ladder): buy a Ladder at a depth-2 store, walk into a climbable wall — a decision card appears BEFORE any roll with USE LADDER / CLIMB IT; USE LADDER passes with no roll, no damage, and the ladder is gone
56. [ ] (GEAR-05, rope): with a Rope, decline at a crevice (LEAP IT), fall, and confirm the retry card now offers USE ROPE beside LEAP IT; USE ROPE passes with no roll and no fall damage
57. [ ] (GEAR-05, torch): get Darkness while carrying a Torch — the card offers USE TORCH; using it lights the maze and a later Darkness within 40 squares is resisted
58. [ ] (GEAR-05, torch refusal): USE from the Gear tab on a Torch in a lit corridor reads 'It is not dark. Save the torch for when it is.' and the torch is not consumed
59. [ ] (GEAR-05, stock): a Torch/Rope line appears in a depth-1 store, Ladder only from depth 2, and none once carried
60. [ ] (GEAR-02, rows): Gear tab — a cloak/staff/potion each show READY / N SQ / cd N SQ / k/max · N SQ matching what the item claims
61. [ ] (GEAR-02, submenu): ITEMS submenu — a row on cooldown/recharging stays tappable and tapping it shows the engine's own named refusal in the fight log, never a silent no-op
62. [ ] (GEAR-02, chips): a live item effect, a cooling item and a recharging staff each show their own chip; tapping each names the item and what's counting (e.g. 'Cloak of Speed — cooling, 41 squares. Used, and not ready to be used again. Squares fix that.')
63. [ ] (a11y): TalkBack reads the new rail buttons (USE LADDER / USE ROPE / USE TORCH / CLIMB IT / LEAP IT) and the condition chips' labels/details
64. [ ] (voice): spot-check the hazard/dark card copy, the cooldown/recharging refusal lines and the chip explanations for the family-friendly deadpan tone in real play

## Phase 40 — Spell Rework (24)

65. [ ] (SPELL-01): Hero-tab Grimoire rows read as one niche line each — e.g. Freeze reads 'burst · one foe · d6, and frozen solid on a hit'
66. [ ] (SPELL-04): a fresh Summoner's grimoire lists Lesser Summon (castable) and Summon ('Needs level 2') — roll several fresh Summoners and confirm the split
67. [ ] (SPELL-05): 'Detect Magic' appears nowhere in the UI — Hero tab, combat SPELLS menu, scroll/shop copy all read 'Map the Floor'
68. [ ] (SPELL-01, Ice): cast Ice on a tough foe — 'Ice climbs …', a d6 tick each round, 'freezes solid' at the end with the kill paid
69. [ ] (SPELL-01, Weaken): 'They hit softer now, for N rounds.' then 'Their arms remember how to swing.' when it runs out; a mid-window recast shows a fresh count, not a stack
70. [ ] (SPELL-01, Stupidity): the foe 'stands there, thinking about nothing' every round after the cast and never swings or casts for the rest of the fight
71. [ ] (SPELL-04, Lesser Summon): a level-1 Summoner's Lesser Summon brings a small ally for at most 4 rounds and never backfires on repeated casts
72. [ ] (SPELL-01, Lightning): hits every foe in a multi-foe fight — one roll per foe
73. [ ] (SPELL-01, Shrink): a shrunk foe's blow visibly lands softer; Weakened as well → softer still
74. [ ] (SPELL-02): cast Mirror Self / Sense Presence / Regeneration outside a fight — each shows a condition chip on the map HUD with a plain-language tap explanation
75. [ ] (SPELL-02, Sense Presence): a forced foe-first race (e.g. a Samurai) is no longer forced — 'You move first. Nothing gets the jump on you.' when the fair roll goes the hero's way
76. [ ] (SPELL-02, fades): after a fight, a still-active Sense Presence / Regeneration shows 'Your senses dull back to normal.' / 'The wounds stop closing on their own.' exactly once
77. [ ] (SPELL-07): a level-1 Warlock reading a Heal scroll sees 'Heal needs level 3; you are 1. The scroll reads itself once and crumbles.', is healed once, and Heal is NOT in the grimoire afterward
78. [ ] (SPELL-05, cast): Map the Floor reveals the whole floor, the rail says 'The floor lays itself out in your head — every corridor on this level, for 40 squares', a MAPPED chip counts down from 40, and spell-only cells paint in the distinct 'borrowed sight' tint
79. [ ] (SPELL-05, expiry): walk 40 squares — walked corridors stay lit (tint reverts as you walk them); everything else fogs back with 'The map forgets what it was told.' and the MAPPED chip disappears
80. [ ] (SPELL-05, recast): recast ~20 squares in — the chip resets to 40, nothing flickers or re-fogs early
81. [ ] (SPELL-05, descend): descend mid-window — the MAPPED chip vanishes and the new floor has no leftover reveal state or stray tint
82. [ ] (tolerant load): resume a pre-Phase-40 save with Detect Magic in the grimoire — the row reads 'Map the Floor' with no card or popup
83. [ ] (SPELL-06): the Hero-tab Shield row shows BOTH hp and rounds (e.g. '34 hp left · 3 rds') and the map-HUD Shield chip shows the same pool and rounds outside combat
84. [ ] (SPELL-02, Hero tab): Mirror Self / Sense Presence / Sense Danger (armed) / Map the Floor rows show while each is up and disappear with their chip
85. [ ] (chips): tap each of the five new chips (Mirrored/Senses/Regenerating/Forewarned/Mapped) — correct detail and a deadpan tap explanation
86. [ ] (badges): a foe under Weaken shows 'Weakened · N' counting down; under Ice (or Poisoned Edge) 'Ice · N' / 'Poison · N' beside the Acid badge style
87. [ ] (a11y): TalkBack reads the five new chips' labels/details and the four new Hero-tab kit rows
88. [ ] (voice): spot-check every new line in real play (chip explanations, Hero-tab rows, foe-badge phrasings, spell niche lines) for the family-friendly deadpan tone

## Phase 41 — Terrain, Darkness & Phobias (21)

89. [ ] (TERR-01): a fresh floor shows blue water pools on the explored map; lit pools in a distinct blue, a pool inside a dark blob in a visibly darker shade
90. [ ] (TERR-01, tolerant load): a pre-Phase-41 save resumes with a waterless floor and no card; the next descent shows water
91. [ ] (TERR-02): HUD SQUARES jumps by 2 stepping onto a water cell and by 1 stepping off it
92. [ ] (TERR-02): the 'Wading…' line fires exactly once on entering a pool, not once per wet square
93. [ ] (TERR-02, timers): a lit torch / MAPPED chip counts down 2 per water step
94. [ ] (TERR-02, day): a water step that crosses square 100 rolls over exactly one day (not zero, not two)
95. [ ] (TERR-02, exemption): a flying (Bracelet / active Cloak of Flying window) or ethereal character pays 1 on water — no wading line, no double tick
96. [ ] (TERR-04/05, water): a Bodies-of-water hero entering a pool sees 'Water. You knew this was coming. Your knees did too.' once; silent while wading on; again only after stepping fully out and back in
97. [ ] (TERR-04/05, dark): a Darkness-phobic hero sees 'The dark. It was always going to be the dark.' once per fresh entry into an unlit square
98. [ ] (TERR-04/05, trapped): a dead end shows the existing 'Four walls and one door you already used. −N hp.' AND the new 'A dead end. The walls lean in a little, just to be sure.' in that order; hp loss unchanged
99. [ ] (TERR-04/05, heights): a climb/gorge attempt shows 'That is a long way down. Your stomach has already left.' BEFORE the roll; a retry of the same tile is silent; walking away and back shows it again
100. [ ] (TERR-04/05, death): at ≤ 25% hp a Death-phobic hero sees 'You can hear your own pulse. It sounds unimpressed.' once, not again until hp climbs above half
101. [ ] (TERR-05, arm): the next fight after any trigger opens with the Afraid chip and the phobiaAfraid line ends '… Still rattled from the water / the dark / the drop / the dead end / your own pulse.'
102. [ ] (TERR-05, chip): the Rattled chip shows between the trigger and that next fight, distinct from the in-fight Afraid chip; tap explanation reads 'Something out there got to you. The next fight opens Afraid — harder to hit, softer blows — until it passes.'
103. [ ] (TERR-01, inspect): a hold on a water tile shows the WATER card — 'Two squares a step, and your boots never dry. Wade, or go around.'
104. [ ] (TERR-03): standing on a dark square without Night Vision / a lit torch / the Amulet of Light shows only the 3×3 squares around the party — every other explored cell disappears
105. [ ] (TERR-03): stepping off the dark square restores the full explored view instantly, nothing re-walked
106. [ ] (TERR-03, waivers): with a lit torch, Night Vision, or the Amulet of Light on a dark tile the full map stays visible — confirm all three independently
107. [ ] (TERR-03 × SPELL-05): Map the Floor's window keeps counting while the 3×3 filter is active on the same square — the filter hides, never pauses
108. [ ] (a11y): TalkBack reads the Rattled chip's label/explanation and the WATER card's title/line
109. [ ] (voice): spot-check the WATER card, the Rattled explanation, the five phobia lines and the wading line for the family-friendly deadpan tone in real play

## Phase 42 — Flee Retune & Consolidated Balance Close (10)

110. [ ] (FLEE-02, submenu): in a fight the SOCIAL → FLEE row shows the honest pre-roll cost/desc — a plain Fighter 'd20, 14+'; a Thief 'd20+5, 14+' with '(Thief +5)'; a Troll in Plate 'd20−3, 14+' with both modifiers named
111. [ ] (FLEE-02, log): after tapping FLEE the fight log's newest line reads 'Flee: N (modifiers) = T vs 14.' followed by the outcome ('You get clear.' / 'You do not make it.'); tapping the line reveals the Oracle's fuller sentence with the dice
112. [ ] (FLEE-02, failure): a failed flee still hands every live foe its swing and the round counter advances — exactly as before
113. [ ] (FLEE-01, flavour): a Samurai still refuses to flee; a fresh Cloaker still vanishes for free with no roll; a round-1 tracked encounter still offers a clean WITHDRAW with no roll
114. [ ] (voice/glyph): the fleeRolled line reads deadpan/family-friendly on Oracle, toast and submenu, and the minus sign renders correctly
115. [ ] (FLEE-01, table): flee with three different characters (plain Fighter, Thief, heavily armored Fighter) — the shown need matches docs/FLEE.md's before/after table (35% / 60% / 25% anchors)
116. [ ] (BAL-02, feel): one short Summoner session — does 'no benefit from the Fighter/Thief-gated ability system' (the accepted reason for AFTER meanDepth 2.65 vs BEFORE 3.37) read fair in hand-play, or rougher?
117. [ ] (BAL-02, feel): one short Apprentice session (AFTER 2.60 vs BEFORE 2.94) — does the 'known floor of the class' reason hold up?
118. [ ] (BAL-02, feel): one short session with a non-Wilmsry, non-Troll Magic User — does the caster × weak-race combination read as unfairly hard? (17 accepted too-weak cells)
119. [ ] (BAL-02, feel): one short session with any Wilmsry character — does the racial edge read as too easy? (7 accepted too-strong cells; a pre-existing pattern from the BEFORE table, candidate for a future racial tune)

## Phase 43 — Clarity Pass (21)

120. [ ] (CLAR-01, trap): spring a trap — the A TRAP card reads 'Trap: <name> finds you first. −N hp.'
121. [ ] (CLAR-01, SC-1 literal): a Being-trapped hero enters a dead end — 'Being trapped: four walls and one door you already used. −N hp.'
122. [ ] (CLAR-01, falls): 'Fall: the wall had other plans. −N hp.' / 'Fall: short. The floor of the crevice makes its introduction. −N hp.'
123. [ ] (CLAR-01, spells): an Apprentice backfire / Summoner backfire / Earthquake with no ward / Death cast — each names the spell and the fee, e.g. 'Backfire: Fireball went wrong in your hands — the Apprentice tax, one time in eight. −N hp.'
124. [ ] (CLAR-01, store): buy anything — 'Bought: <item>. −N wilmst.'
125. [ ] (CLAR-01, flee): flee with a loot pile pending — 'Fled: the loot stays with them — <items>.'
126. [ ] (CLAR-01, Cutthroat): a descent that loses a Joiner opens 'Cutthroat: <name> …'
127. [ ] (HP not WP): Gear-tab rows for Cloak of Healing / Regeneration, Rowan / Poplar Staff and a Healing potion all read 'hp', never 'wp'
128. [ ] (CLAR-05, fed): make camp with rations at full hp — the card reads 'Rations: you eat N…' and with a Troll in the party ends 'Trolls eat for two.' before the count
129. [ ] (CLAR-05, camp): make camp with a heal — the card heads CAMP MADE and the Oracle shows the 'Rations: …' line immediately before the rest line
130. [ ] (CLAR-05, hungry): walk or camp with 0 rations — 'Hunger: nobody packed — you eat 1 a night, and you had 0. Cost of living −N hp.' ('the party eats N a night' with a Joiner; a Heft Thief also sees '(Heft: half, as promised)')
131. [ ] (CLAR-03, refusal): MAKE CAMP without enough rations still states need/have and the members exactly as before
132. [ ] (CLAR-02, find): a Fighter-only weapon (e.g. Bardiche) offered to a Thief reads '(usable by Fighters — not you)'; Mail offered to a Heft Thief reads '(usable by Fighters — and a Thief with Heft)'
133. [ ] (CLAR-02, loot/store): every weapon/armor/staff LOOT row shows the same suffix as the FIND card would; store rows read '(usable by Fighters)' or '— not you'; unrestricted items (Axe, Cloth) show no suffix
134. [ ] (CLAR-04, empty slots): an unequipped ring/bracelet/amulet/helm/cloak/staff each show an in-voice empty row; a non-Magic-User's staff slot reads 'staff — nothing, and nothing you could hold. Magic Users only.'
135. [ ] (CLAR-04, drop shelf): with a potion and two gear items in a full bag, the drop shelf lists only the two gear items — never the potion, never a worn ring/cloak/staff, never the weapon/armor — and tapping drops the right one
136. [ ] (CLAR-05, Joiner): the Joiner offer card's roll line ends '· eats N a rest' (2 for a Troll) and the Company panel reads 'Eats N a rest' from the same source
137. [ ] (CLAR-03, panel): the Hero tab's RATIONS panel reads the full line and 'N carried', updating immediately after Make Camp / a ration purchase / a Joiner joining
138. [ ] (CLAR-04, panels): the Gear tab shows ON YOU (WIELDED / WORN / ALSO ON YOU) and BAG with 'n / slots'; Use/Unequip/swap-confirm still work on ON YOU rows, Equip/Use/Drop on BAG rows
139. [ ] (a11y): TalkBack reads the RATIONS panel and the ON YOU head rows (WIELDED / WORN / ALSO ON YOU)
140. [ ] (voice): a read of every new string (cause lines, 'usable by', empty-slot rows, the RATIONS line, the FED card) in real play — deadpan, family-friendly, no tonal drift

---
**Total: 140 checks.** Record ❌ items as a list (phase, item number, what you saw) and hand them back — fixes go through a UAT gap plan before the Play internal-testing upload (versionCode 6).
