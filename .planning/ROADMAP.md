# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 (shipped 2026-09-15, override closeout; see `.planning/milestones/v1.2-ROADMAP.md`)
- ✅ **v1.3 Feel, Loot & Combat Flow** — Phases 28–33 (shipped 2026-09-16, device UAT batch closed; see `.planning/milestones/v1.3-ROADMAP.md`)
- ✅ **v1.4 Combat & Map Screens** — Phases 34–35 (shipped 2026-09-16, device round closed 2026-09-17; see `.planning/milestones/v1.4-ROADMAP.md`)
- ✅ **v1.5 Meaningful Choices — Spells, Gear & Abilities** — Phases 36–43 (code-complete 2026-09-18, archived 2026-09-19; 140-check Pixel 7 UAT batch pending on its own track against a post-quick-task debug APK; see `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-MILESTONE-AUDIT.md`)
- ✅ **v1.6 Shell Debt & Dead Code** — Phases 44–49 (code-complete 2026-09-20, archived 2026-09-20; 26-check Pixel 7 UAT batch + the v1.5 140-check batch pending on APK `c0cdbae`; see `.planning/milestones/v1.6-ROADMAP.md`)
- ✅ **v1.7 Tuning Pass — Initiative, Cadence & the Four-Band Curve** — Phases 50–55 (code-complete 2026-09-22, archived 2026-09-22, override closeout; the four-run DR checklist + 25-item Pixel 7 batch `docs/UAT-v1.7.md` deferred by the user, as are the v1.6 26-check and v1.5 140-check batches; see `.planning/milestones/v1.7-ROADMAP.md`, `.planning/milestones/v1.7-MILESTONE-AUDIT.md`)
- ✅ **v1.8 Sound, Motion & Set Dressing** — Phases 56–60 (code-complete 2026-09-22, archived 2026-09-22, verified closeout; 30 of 31 Pixel 7 checks in `docs/UAT-v1.8.md` spread over the user's play sessions; see `.planning/milestones/v1.8-ROADMAP.md`, `.planning/milestones/v1.8-MILESTONE-AUDIT.md`)
- ✅ **v1.9 The Gear Screen** — Phases 61–64 (code-complete 2026-09-23; override closeout: GSCR-12 device batch partial) → `.planning/milestones/v1.9-ROADMAP.md`
- ✅ **v2.0 Leaderboards** — Phases 65–71 (shipped 2026-09-24 as Play 2.0.0 / vc10; override closeout: 38/38 requirements, 7/7 phases passed, 142-row Pixel 7 batch `docs/UAT-v2.0.md` spread over the user's play sessions) → `.planning/milestones/v2.0-ROADMAP.md`
- 🚧 **v2.1 Bug Fixes** — Phases 72–81 (roadmapped 2026-09-24; clears every open device-round bug plus backlog 999.5–999.10, and reworks the Leaderboards panel scopes)
- 📋 **v1.0 launch tail** — first-run tutorial (UX-06, rebuilt on the v1.6 modular shell) + Google Play production launch (STR-01..04, STR-06)

## Phases

<details>
<summary>✅ v2.0 Leaderboards (Phases 65–71) — SHIPPED 2026-09-24</summary>

- [x] Phase 65: Run Record & Personal Bests (5/5 plans) — completed 2026-09-23
- [x] Phase 66: Leaderboards Panel — Local (7/7 plans) — completed 2026-09-23
- [x] Phase 67: Play Games Integration & Account Chip (8/8 plans) — completed 2026-09-24
- [x] Phase 68: Global Boards, Submissions & "You Placed X" (7/7 plans) — completed 2026-09-24
- [x] Phase 69: Compliance & Device Close (4/4 plans) — completed 2026-09-24
- [x] Phase 70: Device-Round Polish (4/4 plans) — completed 2026-09-24
- [x] Phase 71: Device-Round Polish II (8/8 plans) — completed 2026-09-24

Full details: `.planning/milestones/v2.0-ROADMAP.md`.

</details>

### v2.1 Bug Fixes (Phases 72–80) — IN PROGRESS

**Engine gate (greenfield, user ruling 2026-09-17):** every RULES/DARK/SAV change is the only rule afterwards (no dual path). Measure the fixtures it moves, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, and regenerate only those. `test/parity/prototype-master.js.txt` is never edited, new serialized fields are carved out of the three comparables, and a bot readout is taken before and after any change that affects difficulty.

**Roll-high ruling (user, 2026-09-24):** the engine itself switches to roll-high rather than gaining a display adapter (Phase 73, ROLL-05) — every seed must resolve identically to before the switch, so the parity suite staying byte-identical is the proof. The sign/ordering audit (Phase 72, ROLL-01) lands first so the mirror is built on already-correct modifiers, and every phase after the mirror (RULES, DARK, SAV, CMBUI's roll-showing indicators) is written directly in the roll-high convention instead of being rewritten later.

- [x] **Phase 72: Roll-Direction Sign Audit & Fixes** - the audited ledger of every roll modifier's sign, with the three known bugs fixed under the engine gate, landing before the roll-high mirror (completed 2026-09-24)
- [x] **Phase 73: Engine Roll-High Mirror** - the engine itself switches every die check to roll-high; the full parity suite proves it byte-identical (completed 2026-09-25)
- [x] **Phase 74: Roll Display & Modifier Honesty** - the Oracle, fight log, rail and every surface print the engine's own high-is-good rolls and consistently signed modifiers (completed 2026-09-25)
- [x] **Phase 75: Engine Rules — Character, Economy, Grimoire & Combat Bugs** - HP dots, the wilmst cache, the Summoner's grimoire, Sense Presence, the trap-death bug, ailments and destroyed armor, all under the greenfield engine gate
 (completed 2026-09-25)

- [ ] **Phase 75.1: Pilfer Fumbles & Scroll Reading** (INSERTED) - the Pilfer's d20 magic-item fumble (d10 blast, turns to dust), and scrolls for everyone on an intelligence roll with fumbles that backfire
- [ ] **Phase 75.2: Hero Size Matters** (INSERTED) - race sets a hero's size, items step it; size changes damage, how easily you're hit, and size-based rules
- [ ] **Phase 75.3: Deep-Floor Encounter Scaling** (INSERTED) - solo fights fade with depth, a steeper foe curve and tier past floor 12, and control spells lose their lock at depth
- [ ] **Phase 76: Darkness Unification & Relaunch Persistence** - one shared darkness rule, and a relaunch or force-close can no longer escape a live fight or an open store
- [ ] **Phase 77: Combat Screen & Oracle Readability** - submenu rows, spell sort, foe family, Oracle order, scroll narration, the last fight-log row, and active effect indicators
- [ ] **Phase 78: HUD, Dead State & Climb Decisions** - band-1 identity, dead-state lockdown, the DEAD-screen character sheet, text-size/settings/stairs-fade fixes, and the climb/leap decision card
- [ ] **Phase 79: Content & Narrative Pass** - sub-class/race blurbs, roll-direction phrasing, and the full narrative clarity sweep
- [ ] **Phase 80: Android Release Build & Tooling** - R8 minify/shrink, edge-to-edge and large-screen handling, and the fit tool's replay-resume fix
- [x] **Phase 81: Leaderboards Panel Fixes** - YOU tag, standing card, ME | ALL | FRIENDS scopes with ALL default when signed in, LINEAGE ME-only, GRAVEYARD and LEANEST removed (completed 2026-09-25)

## Phase Details

### Phase 72: Roll-Direction Sign Audit & Fixes

**Goal**: Every modifier that affects a roll has the correct sign, audited and fixed under the engine gate, before the engine's roll-high conversion begins.
**Depends on**: Nothing (first phase of v2.1; must land before the roll-high mirror)
**Requirements**: ROLL-01
**Success Criteria** (what must be TRUE):

  1. An audited ledger covers every modifier (weapon, armor, spell, ability, item, race, sub-class, condition, terrain) on every roll type (to-hit both ways, soak, saves/resistance, initiative, climbs, flee, parley, traps), confirming each bonus widens the success range and each penalty narrows it.
  2. The parley-insult "+1" lands in the correct order relative to the Smoke/Mirror/invisible/blind "natural 1" overrides on both the hero and member branches.
  3. Fridgian frenzy's second swing honours the dark-cap penalty instead of hard-setting a fixed need.
  4. The bestiary `critOn: 1` claim (Skeleton, "a 1 shatters it") is either wired into the engine or removed from the text.
  5. Every fixture the fixes move is measured, declared with before/after in `test/parity/FIXTURE-INVENTORY.md`, and regenerated — nothing else moves.

**Plans**: 7/7 plans executed

Plans:
**Wave 1**

- [x] 72-01-PLAN.md — Roll ledger audit (docs/ROLL-LEDGER.md, extends Phase 31's 34 sites) + BEFORE bot readout + batched rulings checkpoint for NEEDS-RULING findings (wave 1)
- [x] 72-02-PLAN.md — Odds harness (test/unit/harness/rollOdds.js) + combat direction test rows, with RED pending rows for the four known bugs (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 72-03-PLAN.md — Non-combat direction test rows: soak, thrown, resist, initiative, flee, parley, traps, locks, climbs/leaps, cure, wake, drops (wave 2)
- [x] 72-04-PLAN.md — Fix (d) Thief evasion sign + (a) the insult is the last term on the member branch; Smoke text; measured-zero declaration + ROLL-01 guard (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 72-05-PLAN.md — Fix (b) Fridgian frenzy second swing = normal to-hit narrowed by one (declared canon divergence); measure/declare/regenerate (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 72-06-PLAN.md — Fix (c) Skeleton shatters on its best face (sp.shatterOnBest, shatterIfBest, foeShattered); M&M claim removed; measured (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 72-07-PLAN.md — Close-out: F5 parley-dial sign + ruled findings, AFTER bot readout, final ledger, ledger↔test sync guard (wave 5)

**Cross-cutting constraints:**

- A modifier whose effect is absorbed by a clamp (need already floored at 1, an untouchable need-0 foe, the dark cap at 2) is asserted by the direction test as non-worsening (never flagged as a sign bug), and a clamp never turns a bonus into a penalty
- Identity-valued dials (e.g. Thief evasion = 0, FOE_ACCURACY = 0) are asserted to change nothing at identity, and their DIRECTION is asserted by probing a non-zero value inside the test

### Phase 73: Engine Roll-High Mirror

**Goal**: The engine itself resolves every die check as roll-high, so no later display code or rule fix ever needs a translation layer again.
**Depends on**: Phase 72 (the sign/ordering fixes land first so the mirror is built on already-correct modifiers, not redone afterward)
**Requirements**: ROLL-05
**Success Criteria** (what must be TRUE):

  1. Every die check in the engine reads the same rng draw `r` as `(N+1) − r` on an N-sided die and succeeds at or above a high target, with modifiers applied as signed bonuses that always help the roller when positive.
  2. Every seeded run resolves identically to before the switch — the full parity suite (chargen, combat, economy) is byte-identical before and after, proving the mirror changed representation, not outcome.
  3. A guard test fails the build on any roll-under comparison left anywhere in `engine/`.
  4. Content numbers that encode to-hit/AR/etc. are re-expressed in the new convention, and any roll-related value already in a saved game converts once, tolerantly, on load.
  5. Every event that carries a roll (`struck`, foe swings, soak, thrown spells, resistance, parley, traps, locks, climbs/leaps, cures, wake, drops, gates, summons, crits) natively carries the high-is-good `roll`, `target` and `dieN`.

**Plans**: 10/10 plans complete

Plans:
**Wave 1**

- [x] 73-01-PLAN.md — The roll-high helper (`rollCheck`/`atLeastFor`/`rollFields` in engine/dice.js) and the build-failing guard, enforced on the 17 conversion-free engine files (wave 1)
- [x] 73-02-PLAN.md — Proof baselines on the untouched engine: bot-sweep state pins, the pre-switch save, the 200-seed baseline readout (checked against Phase 72's AFTER), and the runtime roll invariant (wave 1)
- [x] 73-03-PLAN.md — The shared range formatter (src/browser/rollRange.js, "17 vs 18–20") and the per-site mirror verdicts plus event-field contract in docs/ROLL-LEDGER.md (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 73-04-PLAN.md — Hero strike, Philly, crits, frenzy and the foe's armor soak on rollCheck; struck/strikeMissed in the final line shape; rail dice line (wave 2)

**Wave 3**

- [x] 73-05-PLAN.md — Member, legacy and summoned-ally strikes and thrown spells on rollCheck; isBestFace flips to the top face (wave 3)

**Wave 4**

- [x] 73-06-PLAN.md — Resistance on rollCheck, magic mishaps reported on the 1; magic.js and derived.js guarded (wave 4)

**Wave 5**

- [x] 73-07-PLAN.md — Foe swings (hero and member), pursuit, foe crits and the hero soak on rollCheck; the old need clause retired (wave 5)

**Wave 6**

- [x] 73-08-PLAN.md — Flee (bonus folded into the threshold), parley, combat gates, drops and the foe ability gate; combat.js and foeAbilities.js guarded (wave 6)

**Wave 7**

- [x] 73-09-PLAN.md — Traps, locks, climbs, leaps, cures, wake and the murder check; the guard covers all of engine/ and the invariant is complete (wave 7)

**Wave 8**

- [x] 73-10-PLAN.md — Close-out: the three proofs recorded (parity, direction tests, identical 200-seed readout), the ledger finalized with Phase 74/79 handoffs, and the comment sweep (wave 8)

**Cross-cutting constraints:**

- Byte-identical outcomes: zero regenerated fixtures, zero new divergence records or carve-outs; the Phase 72 direction tests, the ledger-sync test, the state pins and the pre-switch save run unedited. A moved result means a mis-flipped site: fix the site, never the evidence
- Each conversion plan ships one vertical slice (engine sites, event fields, the event-driven lines that print them, the tests that assert them), so every wave merges green; combat.js and the narration files force the waves to run in series

### Phase 74: Roll Display & Modifier Honesty

**Goal**: Every roll and modifier the player sees is a direct, honest read of the engine's own high-is-good numbers.
**Depends on**: Phase 73 (the mirror must land first — the display reads the engine's numbers directly, with no adapter)
**Requirements**: ROLL-02, ROLL-03
**Success Criteria** (what must be TRUE):

  1. The Oracle, fight log, dice reveals, rail cards, hero sheet, combat menu and foe details all print the engine's own roll and target with no translation layer, and a higher roll always reads as better (on a d20 a caster needs 18–20, a thief 17–20, a fighter 16–20).
  2. Every displayed modifier is signed from the player's point of view — "+2" always reads better, "−2" always reads worse — across item/loot/store/find comparisons, the hero sheet, spell/ability text, condition chips and the fight log's need breakdown.
  3. The same modifier never shows opposite signs on two different surfaces.

**Plans**: 8/8 plans complete

Plans:
**Wave 1**

- [x] 74-01-PLAN.md — Pure extraction: the hero per-target and foe-swing to-hit chains become engine/derived.js helpers the engine itself calls (byte-identical, equivalence-tested), so displays read the same function (wave 1)
- [x] 74-02-PLAN.md — The ONE formatter in src/browser/rollRange.js: roller-keyed signed modifiers, faces-to-range, die names, "16–20 (d20; mods)" (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 74-03-PLAN.md — Oracle, fight-log, dice-reveal and rail roll lines re-signed from the player's side (foe lines negated); heights/water "−N on the climb/leap"; voice sample (wave 2)
- [x] 74-04-PLAN.md — src/browser/rollOdds.js; hero sheet "16–20 (d20)"; combat menu STRIKE "Hit 16–20 (d20)" and FLEE range; hero snapshots re-pinned (wave 2)
- [x] 74-05-PLAN.md — Item/loot/store/find comparisons say which way ("−2 to hit, worse than your Club"), crit ranges on the strike die; store snapshot re-pinned (wave 2)

**Wave 3**

- [x] 74-06-PLAN.md — Foe details "You hit it on … · it hits you on …" with live modifiers; foe condition effects with their ranges (wave 3)
- [x] 74-07-PLAN.md — Hero condition chips state their effect from the engine ("−3 to hit (now 19–20)"); conditionEffects.js and its bridge (wave 3)

**Wave 4**

- [x] 74-08-PLAN.md — The cross-surface sign consistency guard and range-format pin, copy banks walked by the standing scans, the ROLL-LEDGER display closure and the whole-phase gates (wave 4)

**Cross-cutting constraints:**

- Presentation only: engine behaviour byte-identical (74-01 is a pure extraction proven by parity, pins and direction tests); no content file, parity fixture or state pin moves; only mu.hero.txt, thief.hero.txt and thief-store.store.txt shell snapshots are re-pinned, each declared
- Authored roll-direction prose stays for Phase 79; Phase 77 reuses the formatter, conditionEffects.js WHAT_IF and foeConditionEffect

**UI hint**: yes

### Phase 75: Engine Rules — Character, Economy, Grimoire & Combat Bugs

**Goal**: Character creation, HP growth, spell legality, initiative, traps, ailments and armor destruction follow the rules the game claims, written in the roll-high convention from the start.
**Depends on**: Phase 73 (written directly on top of the roll-high mirror so nothing here needs rewriting later)
**Requirements**: RULES-01, RULES-02, RULES-03, RULES-04, RULES-05, RULES-06, RULES-07, RULES-08, RULES-12, RULES-13, RULES-14, RULES-15
**Success Criteria** (what must be TRUE):

  1. Pulling multiple Table-4 "+HP" dots grows a character's max HP linearly, not compounding (×1.6 each time), and the toll row takes its share from that same non-inflated pool.
  2. A red-dot wilmst cache pays a bounded cut (~100 × depth) instead of buying out the store, the Summoner's offense gate is gone (a level-1 Summoner casts offense; amended 2026-09-25) while no gated sub-class's grimoire holds a spell from a school gated above its level, and the combat SPELLS menu hides (never just greys) anything level- or school-locked.
  3. A hero with Sense Presence active always wins initiative outright, never sees "You cannot see what you are fighting," and can land crits in the dark.
  4. A trap the Oracle reports as "−1 HP" can never kill the hero — the fix follows an explicit `/gsd-debug` root-cause session before it lands, not a guess.
  5. An ailment roll of 5–6 always narrates what it gives (canon: a phobia, a disease of the mind — user ruling 2026-09-25), and replacing a destroyed armor piece with a new one always tells the player the old piece was destroyed and is gone.

  6. When a wandering monster interrupts a step onto an icon, the icon resolves after the fight if the hero is still on it.

  7. A Magic User can wield a magic staff as a d8 melee weapon, and its power works only while it is wielded.

  8. Bubble reflects the next attack back at the attacker and pops, leaving a small soak pool for that round; it is no longer a bigger Shield.

  9. A day without enough rations refills no spell books, and the player is told why.

**Plans**: 13/13 plans complete

- [x] 75-01-PLAN.md
- [x] 75-02-PLAN.md
- [x] 75-03-PLAN.md
- [x] 75-04-PLAN.md
- [x] 75-05-PLAN.md
- [x] 75-06-PLAN.md
- [x] 75-07-PLAN.md
- [x] 75-08-PLAN.md
- [x] 75-09-PLAN.md
- [x] 75-10-PLAN.md
- [x] 75-11-PLAN.md
- [x] 75-12-PLAN.md
- [x] 75-13-PLAN.md

**UI hint**: yes

### Phase 75.1: Pilfer Fumbles & Scroll Reading (INSERTED)

**Goal**: The Pilfer trades its heal-only lockout for a fumble risk on magic items, and anyone can try a scroll. Magic Users and Runes/Signs readers always succeed; everyone else rolls intelligence, and a bad miss turns the scroll against the reader.
**Depends on**: Phase 75 (engine-gated and fixture-moving, sequenced after the RULES phase so fixture claims don't overlap; written in the roll-high convention from Phase 73)
**Requirements**: RULES-09, RULES-10
**Success Criteria** (what must be TRUE):

  1. A Pilfer can use use-activated jewelry, cloaks and staves like anyone else, but each use rolls a d20. On a 1 the use fails, the item explodes for d10 damage to the Pilfer (armor does not soak it) and turns to dust, and the Oracle says so. Potions, scrolls and tools never fumble.
  2. Anyone can try to read a scroll, and the scroll is gone either way. A Magic User, or anyone with Runes/Signs, always succeeds. Everyone else rolls d20 against their intelligence (no intel-12 floor): meeting the target casts the spell; missing casts nothing.
  3. A read that rolls below half the required target is a fumble. A harmful spell hits the reader instead of its target, and an area-damage spell hits the reader and their whole party. A helpful spell lands on the targeted enemy (a fumbled Shield shields that foe). Outside combat a fumble has no effect.
  4. The Pilfer's and every affected class's descriptions state the new rules, both outcomes are narrated in voice, the new rolls come from derived rng streams, and every moved fixture is declared and regenerated.

**Plans**: 3/9 plans executed

Plans:
**Wave 1**

- [x] 75.1-01-PLAN.md — Replace the Pilfer's heal-only lockout with a fumble risk (RULES-09): a Pilfer uses jewelry, cloaks and staves like anyone else, but each use rolls a d20, and on a 1 the use fails, the item explodes for d10 to the Pil... (wave 1)
- [x] 75.1-02-PLAN.md — Decide and pin, per spell, what a fumbled scroll does (RULES-10's classification, Claude's discretion in 75.1-CONTEXT): which side it lands on (harmful to the reader, area on the reader's side, helpful to the targeted... (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 75.1-03-PLAN.md — Build the foe-side effects a fumbled helpful scroll can hand the targeted enemy (RULES-10: "a fumbled Shield shields that foe"): a foe Shield pool, a foe Bubble that catches a blow and throws it back, foe Mirror Self,... (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 75.1-04-PLAN.md — Build the reader-side effects a harmful fumble needs (RULES-10, with the user's fumble-severity rulings of 2026-09-25 and the second ruling on turn-loss duration and easy hits): (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 75.1-05-PLAN.md — Turn a fumbled scroll against its reader (RULES-10): one resolver that reads the 75.1-02 table and applies the harmful, area or helpful effect on the right side, using the foe-side (75.1-03) and reader-side (75.1-04) ... (wave 4)
- [ ] 75.1-09-PLAN.md — Give the hero-cannot-act state (75.1-04) its shell: a combat menu with one way forward, LET THE ROUND PLAY; the bridge that sends it to the engine; a "Can't act" chip, and "Blinded" and "Shrunk" chips for hero Blind a... (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 75.1-06-PLAN.md — Let anyone try a scroll (RULES-10): Magic Users and Runes/Signs holders always succeed, everyone else rolls intelligence, a bad miss is a fumble, and the scroll is consumed every time (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 75.1-07-PLAN.md — Show every reader their scroll odds before they read, and make the class and skill descriptions state the new reading rule (RULES-10, ROADMAP criterion 4: "every affected class's descriptions state the new rules") (wave 6)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 75.1-08-PLAN.md — Close Phase 75.1's engine gate: record both balance changes against their readouts, write the fixture story with a standing exposure guard, note the new check sites in the roll ledger, refresh the voice sample, and pr... (wave 7)

**UI hint**: yes

### Phase 75.2: Hero Size Matters (INSERTED)

**Goal**: A hero's size is a real stat. Race sets it, items step it, and it changes how hard you hit, how easily you're hit, and how size-based rules treat you, so the Gauntlet of the Giant and Enlarge deliver what their text promises.
**Depends on**: Phase 75.1 (engine-gated and fixture-moving; sequenced after the other RULES phases so fixture claims don't overlap; written roll-high on Phase 73's helper)
**Requirements**: RULES-11
**Success Criteria** (what must be TRUE):

  1. Every hero has a size from their race (Elven and Dwarven Small, Troll Large, the rest Human-size), shown on the hero sheet, and items/potions step it up or down for their duration.
  2. Each size step up gives +2 damage and makes the hero one face easier for foes to hit; each step down gives -2 damage and one face harder, with the effect visible in the roll breakdown.
  3. Rules that care about a creature being big or small read the hero's size as well as the foe's.
  4. The Gauntlet of the Giant and the Enlarge potion are both exactly a +1 size step (Enlarge's separate +4 damage is gone), and their text states exactly what a step does, with no ceiling promise.
  5. Moved fixtures are measured, declared and regenerated, and a bot readout before and after is recorded.

**Plans**: 0/5 plans executed

Plans:
**Wave 1**

- [ ] 75.2-01-PLAN.md — Make size a real stat in the engine (RULES-11): race sets a base step, items add to it, and every step changes weapon damage by 2 and the foe's winning faces by 1, except that a race's base step never cancels one of t... (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 75.2-02-PLAN.md — Make the Gauntlet of the Giant and the Enlarge potion deliver what their text promises (RULES-11): each is exactly one size step for its duration, Enlarge loses its separate damage payload, and both texts state exactl... (wave 2)
- [ ] 75.2-03-PLAN.md — Show the hero's size on the hero sheet and make the sheet's damage honest about it (RULES-11): a SIZE row with the size name and, when it matters, what it does to damage and to the foe's odds from the player's side; t... (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 75.2-04-PLAN.md — Make every surface say what size does (RULES-11): the chip for a live Gauntlet or Enlarge is labelled with the hero's resulting size and explains exactly what a step does; the Oracle and the rail narrate the start of ... (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 75.2-05-PLAN.md — Close Phase 75.2's engine gate: write the size-rule audit into the roll ledger and guard it, finish the fixture story with a standing exposure guard, record every balance readout (overall and per race) in the difficul... (wave 4)

**UI hint**: yes

### Phase 75.3: Deep-Floor Encounter Scaling (INSERTED)

**Goal**: The deep floors keep getting harder. Fights grow in number, foes grow in toughness and tier past floor 12, and control spells stop locking everything, so floor 20+ is the unicorn ceiling it is meant to be, not a stroll to 40.
**Depends on**: Phase 75.2 (the bot readout measures hero size and foe count together; engine-gated)
**Requirements**: RULES-16, RULES-17, RULES-18
**Success Criteria** (what must be TRUE):

  1. Floors 1-4 keep today's foe count (50% solo); on floors 5-9 a fight is solo only on a d4 of 1 (25%); from floor 10 a fight is never solo (at least 2 foes); from floor 20 at least 3.
  2. The same rng draws are used (the existing d4 and table roll); the depth rule reshapes the result, so no unrelated fixture reorders.
  3. A 200-seed bot readout before and after is recorded against the depth-20 unicorn / floor 5-7 average target, and any moved fixtures are declared and regenerated.
  4. From floor 12, foe HP and hit climb on a steeper slope and the roster keeps escalating past today's level-5 tier cap, with slopes set by bot readouts.
  5. From floor 12, foes increasingly resist or shake off Freeze, Stone, Doze and Weaken, so a control-lock rotation no longer carries a caster to depth 40.

**Plans**: 0/7 plans executed

Plans:
**Wave 1**

- [ ] 75.3-01-PLAN.md — Foe count grows with depth (RULES-16) with the same draws: floors 1-4 as today, 5-9 solo only on a d4 of 1, 10+ never solo (wandering included), 20+ three; FOE_COUNT_DEPTH dial; BEFORE/AFTER readouts, flag if the median drops below 5 (wave 1)
- [ ] 75.3-02-PLAN.md — Deep-floor instruments: the bot's opt-in control rotation, the fit tool's tail objective on deep-start slices, and the phase BEFORE from depths 12/20/30/40 plus the rotation Sorcerer and a Troll Summoner (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 75.3-03-PLAN.md — The deep curve (RULES-17): a knee after floor 12 on foe HP and hit, and titled elite variants of tier-5 foes from floor 16; floors 1-12 proven unchanged (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 75.3-04-PLAN.md — Control at depth (RULES-18), the rule and every combat.js site: a roll-high derived-stream resist that grows past floor 12, holds instead of freeze/stone kills, the Joiner / Ice / Bard-song sites, four narrated events, Held and Unmoved chips (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 75.3-05-PLAN.md — Control at depth on the hero's spells, scrolls and control items, honest texts, the bot playing Freeze as a hold at depth, rotation readouts before and after (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 75.3-06-PLAN.md — The checkpointed tail sweep against the user's ruled targets (unicorn at 20, depth 30 basically never, the rotation contained): the deep slopes, elite HP step and control resistance are set by readouts in blocks of 10, handing back on a failure pattern, then locked (wave 5, can hand back)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 75.3-07-PLAN.md — Close the phase: FINAL 200/1,000-seed and deep readouts, the DIFFICULTY-RETUNE.md record with rotation and depth-40 verdicts, the control audit in the roll ledger with a standing guard, the fixture close and exposure guard, voice sample, gates (wave 6)

### Phase 76: Darkness Unification & Relaunch Persistence

**Goal**: One shared darkness rule governs everything the player experiences as dark, and saving or force-closing never lets a player escape a live fight or an open store.
**Depends on**: Phase 75.3 (shares the engine fixture gate; sequenced after the RULES phases to avoid overlapping fixture claims)
**Requirements**: DARK-01, DARK-02, SAV-06, SAV-07
**Success Criteria** (what must be TRUE):

  1. A lit torch, the Amulet, or Night Vision widens what a player reveals while walking by the same rule that widens what is rendered — `revealRadius` and `mapViewRadius` never disagree again.
  2. The DARK chip, the map vignette and per-tile dark painting all read from the same unified waiver rule, so a light source means the same thing on every surface.
  3. A player who Saves & quits, or whose app is killed, mid-fight relaunches into the exact same fight — same foes, HP, round and active effects — and force-closing can no longer be used to escape a fight.
  4. A player who relaunches with the store open returns to the same store with the same stock.

**Plans**: 0/5 plans executed

Plans:
**Wave 1**

- [ ] 76-01-PLAN.md — Make one darkness-waiver rule govern what the party reveals as it walks, what the map renders, and every in-fight dark penalty (DARK-01 plus the "combat too" ruling), with measured readouts and declared pin moves (wave 1)
- [ ] 76-03-PLAN.md — Make the load keep what the player was in the middle of (SAV-06, SAV-07): a live fight, an open store, a pending find, a pending hazard decision, a pending tile (RULES-12's Phase 76 handoff) and a pending Joiner offer (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 76-02-PLAN.md — Make every darkness surface the player sees read the one rule from 76-01 (DARK-02): the DARK chip and its tap card, the map vignette and per-tile dark painting, with copy that tells the map and fight truth (wave 2)
- [ ] 76-04-PLAN.md — Prove the relaunch end to end (SAV-06, SAV-07) and hand the shell its resume line (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 76-05-PLAN.md — Finish the phase: the Oracle says the fight (or the shop) is still on after a relaunch, the persistence half's measurement is recorded beside the darkness half's in FIXTURE-INVENTORY.md, every gate is run at the phase... (wave 3)

**Device check**: yes — relaunch-mid-fight and relaunch-mid-store batched into the milestone-close Pixel 7 checklist per the deferred-UAT protocol.

### Phase 77: Combat Screen & Oracle Readability

**Goal**: Everything the player reads during a fight is legible, correctly ordered, honest, and shows what effects are currently live on them or their foe.
**Depends on**: Phase 74 (the roll-high display convention must be in place before combat-screen indicators show roll data)
**Requirements**: CMBUI-07, CMBUI-08, CMBUI-09, CMBUI-10, CMBUI-11, CMBUI-12, CMBUI-13, CMBUI-14
**Success Criteria** (what must be TRUE):

  1. Every combat submenu row (spells, abilities, items, social) grows to fit its text on the Pixel 7 with no clipped label or description, and spell rows sort by level ascending then alphabetically.
  2. Each foe card shows the foe's bestiary family after its name, and the Oracle prints combat lines in the order they happened (adjacent identical lines still fold).
  3. Reading a scroll in combat that successfully casts its spell never narrates a level refusal, and the last (oldest) row of THE FIGHT SO FAR can be tapped to reveal its roll like every other row.
  4. Every active ability or spell effect (Smoke, Sidestep, Battle Roar, Riposte, Taunt, Shield, Sense Presence and every other timed or conditional effect) shows an indicator on the hero (YOUR LOT) or the foe it affects, with rounds remaining, a tap-for-description, and it clears when the effect ends.

  5. In combat, the ITEMS list marks equipped gear EQUIPPED and greys out bag gear that only works when worn, with the reason shown.

**Plans**: 0/8 plans executed

Plans:
**Wave 1**

- [ ] 77-01-PLAN.md — Make the combat submenus readable and honest: every row grows to fit its whole label and description on the Pixel 7 (CMBUI-07), spells list by level then name (CMBUI-08), and the ITEMS list says what is equipped and g... (wave 1)
- [ ] 77-02-PLAN.md — Make the combat record read in the order things happened (CMBUI-10): the fight log's lines follow engine event order, and only identical back-to-back lines fold into "×N" (wave 1)
- [ ] 77-03-PLAN.md — Build the data half of CMBUI-13's live effect indicators: the one enumerator knows every effect that is live on the hero or a party member, one table says how each is shown, a coverage guard fails the build when a new... (wave 1)
- [ ] 77-04-PLAN.md — Finish the foe half of CMBUI-13: every effect a foe can carry this milestone, including the gifts a fumbled scroll hands it, shows as a chip on its card with a description on the long press (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 77-05-PLAN.md — Stop a successful scroll cast from reading like a refusal (CMBUI-11): the copy limit is said once, after the cast, as "too advanced to copy into your book", on every surface (wave 2)
- [ ] 77-06-PLAN.md — Two combat-screen display fixes: each foe card names its bestiary family after the foe's name (CMBUI-09), and the oldest row of THE FIGHT SO FAR reveals its roll like every other row (CMBUI-12) (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 77-07-PLAN.md — Make the conditions honest in the rolls themselves: a dazed (or inspired, blinded, dark-capped) strike says so in its modifier list, and the moment you are dazed or weakened the Oracle and the fight log say what it do... (wave 3)
- [ ] 77-08-PLAN.md — Draw CMBUI-13's live effect indicators on the player's side: a chip row under the hero and each party member in YOUR LOT, with a tap that explains what the effect does, how long it lasts and where it came from (wave 3)

**UI hint**: yes
**Device check**: yes — combat-screen legibility (submenu clipping, indicator readability) batched into the milestone-close Pixel 7 checklist per the deferred-UAT protocol.

### Phase 78: HUD, Dead State & Climb Decisions

**Goal**: The HUD tells the truth at a glance, the dead state locks down cleanly, settings behave as expected, and crossing a wall or crevice is a decision the player makes before any dice are rolled.
**Depends on**: Phase 73, Phase 74 (amended 2026-09-25: the climb card became an ENGINE pending decision (engine-gated, harness reconcile) and shows odds in the Phase 74 range format; the rest stays shell-only)
**Requirements**: HUD-01, HUD-02, HUD-03, HUD-04, HUD-05, HUD-06, HUD-07, HUD-08, HUD-09, CLIMB-01, CLIMB-02
**Success Criteria** (what must be TRUE):

  1. Band 1 reads "Race Sub-class · Lvl N" (e.g. "Dwarf Pickpocket · Lvl 3") with no parent class and no parentheses.
  2. Once the hero is dead, only the Oracle, the DEAD/Leaderboards screen and the ☰ menu accept input — map taps, other tabs, camp, marks and centre map are inert — and the DEAD screen offers a read-only final character sheet (stats, gear, level) for the run that just ended.
  3. The Settings text-size choice (S/M/L) scales every `--mw-font-*` token, and dragging or scrolling the settings sheet never changes a volume slider — a deliberate horizontal drag on a slider still sets its volume.
  4. A stairs descent fades to black under the stairs sound, then fades in on the new floor, honouring reduced motion.
  5. Stepping toward a wall or crevice square first shows a decision card — CLIMB IT / LEAP IT, USE LADDER / USE ROPE (when carried), TURN BACK — with no dice rolled until the player commits; TURN BACK costs nothing (no step, time or roll) and no stale retry card ever appears after a crossing.
  6. A hero with Acute Hearing sees a faint "something's there" mark on neighbouring squares that hold an encounter, before stepping in.
  7. A Movement setting switches between tap-to-move (default) and an on-screen arrow pad in the chosen bottom corner; in arrow mode map taps never move the party, and the map auto-scrolls so the party never walks under the pad.

  8. With a full bag, the find card keeps the found item and TAKE / LEAVE in view while the drop list scrolls inside the card.

**Plans**: 0/9 plans executed

Plans:
**Wave 1**

- [ ] 78-01-PLAN.md — Move the wall/crevice decision into the engine (CLIMB-01/02): every hazard step pauses with no dice drawn, `resolveHazard` commits (draw-identical to the old step) or turns back at no cost, one faces formula feeds the roll and `hazardOdds`, the bot commits, moved pins declared, readouts before and after (wave 1)
- [ ] 78-02-PLAN.md — Settings behave (HUD-04/05): the text scale moves to the root so every `--mw-font-*` token and every screen's text (combat included) follows S/M/L, pinned by a token walker; a volume slider moves only on a sideways drag or a track tap (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 78-03-PLAN.md — The pre-roll decision card on the rail (CLIMB-01/02): CLIMB IT / LEAP IT with honest odds, USE LADDER / USE ROPE when carried, TURN BACK; the map locked while it is up; the post-fall retry card retired; one-and-done MARKS copy (wave 2)
- [ ] 78-04-PLAN.md — Declare and guard the pre-roll decision: the parity exposure guard, the relaunch probe on `resolveHazard`, and the Phase 78 records in FIXTURE-INVENTORY, DIFFICULTY-RETUNE, TERRAIN and the roll ledger (wave 2)
- [ ] 78-05-PLAN.md — The HUD tells the truth (HUD-01): band 1 reads "Race Sub-class · Lvl N"; a regained spell charge and a new day's book refill get rail lines with the count (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 78-06-PLAN.md — The dead state locks down (HUD-02) and offers a read-only FINAL SHEET of the run that just ended (HUD-03), from the DEAD tab and the death card (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 78-07-PLAN.md — The opt-in arrow pad (HUD-08): a Movement setting, one step per press through window.move, tap-to-move off in arrow mode, and a camera that treats the pad as an edge (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 78-08-PLAN.md — The stairs fade under the stairs sound, an instant cut with reduced motion (HUD-06); the full-bag find card keeps the loot in view with a scrolling drop list (HUD-09) (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 78-09-PLAN.md — Acute Hearing hears the next room (HUD-07, default pending the user's confirmation) and the phase close: voice sample, compiled Pixel 7 checklist, full gates (wave 6)

**UI hint**: yes
**Device check**: yes — dead-state input lockdown, settings-sheet drag behaviour, the stairs fade and the climb card need a Pixel 7 pass, batched into the milestone-close checklist per the deferred-UAT protocol.

### Phase 79: Content & Narrative Pass

**Goal**: Every piece of in-game text — class/race blurbs, roll-direction phrasing and the full narrative sweep — reads honestly and consistently in the game's voice.
**Depends on**: Phase 74 (roll-direction display must be settled before the text is rewritten to match it), Phase 75.1 (the new Pilfer and scroll text), Phase 77 (VOX-05 sweeps the new CMBUI-13 effect-indicator text)
**Requirements**: VOX-04, ROLL-04, VOX-05
**Success Criteria** (what must be TRUE):

  1. Every sub-class and race description states both its advantage(s) and disadvantage(s), including school gates such as the Summoner's no-offense-spells-before-level-3.
  2. No player-facing string still encodes roll-under phrasing ("1–N", "need N", "natural 1", "−3 on to-hit") — a doc-synced test pins that none remains.
  3. Every in-game line (Oracle, rail cards, fight log, refusal reasons, item and spell text, epitaphs) states clearly what happened, to whom and why, while staying sarcastic and family-friendly.

**Plans**: TBD

### Phase 80: Android Release Build & Tooling

**Goal**: The release build is optimized and store-clean on modern Android and large screens, and the tuning tool's replay-resume is trustworthy.
**Depends on**: Nothing (native/infra track, independent of the gameplay phases)
**Requirements**: DROID-01, DROID-02, DROID-03, TOOL-01
**Success Criteria** (what must be TRUE):

  1. The release AAB builds with R8 minify, shrink and obfuscation on AGP 8.13, ships a deobfuscation mapping, and a release-signed Pixel 7 build boots, saves and resumes, handles back, and plays sound/haptics as before.
  2. The game draws correctly edge-to-edge on Android 15+, in both gesture and 3-button navigation and with a display cutout, using no deprecated window or status-bar APIs Play flags.
  3. On a tablet, foldable or Chromebook, the game presents a deliberate, documented layout (such as a letterboxed portrait column) rather than a broken one, and Play's display-configuration warning is addressed or consciously accepted.
  4. A fit-tool run resumed from its JSONL log retraces the exact same walk as the live run, including after an infeasible (`+Infinity`) point, with per-block stdout appended rather than truncated.

**Plans**: 0/6 plans executed

Plans:
**Wave 1**

- [ ] 80-01-PLAN.md — Turn on R8 for the release build (minify, resource shrinking, obfuscation) on the pinned AGP 8.13.0 toolchain, prove it with a real release build, and document the deobfuscation mapping (wave 1)
- [ ] 80-03-PLAN.md — Give tablets, foldables and Chromebooks a deliberate, documented layout: declare the app a game so Android 16 keeps honouring the portrait lock, and present the shell as one centred, phone-width portrait column with p... (wave 1)
- [ ] 80-06-PLAN.md — Prove TOOL-01 end to end through the real CLI: a fit resumed from its JSONL log retraces the live walk exactly, including after an infeasible (+Infinity) point, and per-block stdout is appended, never truncated (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 80-02-PLAN.md — Remove the deprecated status-bar colour path from the shipped app by uninstalling @capacitor/status-bar and styling the bars through Capacitor 8's core SystemBars plugin, then prove the native plugin list and the R8 r... (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 80-04-PLAN.md — Audit the actual R8 release artifact for deprecated window and system-UI API calls and for the merged manifest's large-screen attributes, with a reusable, tested scanner, and document edge-to-edge handling and the aud... (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 80-05-PLAN.md — Run the emulator pass CONTEXT asked for: an R8 release smoke, edge-to-edge in gesture and 3-button navigation and with a display cutout, and the tablet and foldable large-screen behaviour, with screenshots in the phas... (wave 4)

**UI hint**: yes
**Device check**: yes — DROID-02/03 recommended for `--research-phase` (Android 15/16 edge-to-edge + large-screen handling); needs device checks in both navigation modes plus an emulator tablet/foldable, batched into the milestone-close Pixel 7 checklist.

### Phase 81: Leaderboards Panel Fixes

**Goal**: The Leaderboards panel shows the signed-in player accurately, filters every board by ME | ALL | FRIENDS, and drops the boards Play Games cannot back honestly.
**Depends on**: Nothing (shell-only: `src/browser/boardsView.js`, `boardsPanel.js`, `globalBoards.js`, `content/boards.js`, `boardScores.js`, `content/leaderboards.js`, plus `engine/records.js` `BOARD_IDS`; zero parity fixtures)
**Requirements**: BOARD-09, BOARD-10, BOARD-11, BOARD-12, BOARD-13, BOARD-14, BOARD-15, BOARD-16, BOARD-17
**Success Criteria** (what must be TRUE):

  1. The panel shows three scope chips — ME | ALL | FRIENDS — and every board can be viewed under each; signed in with Compete ON it opens on ALL, signed out or Compete OFF it opens on ME with ALL/FRIENDS showing the sign-in note.
  2. On ALL and FRIENDS the signed-in player's own score is tagged YOU — never FRIEND — with the `playerId` mismatch root-caused and fixed, and the "not in the top ten / your best run" card appears only when the player is ranked but off the visible list.
  3. LINEAGE appears only under ME, sits at the end of the board rail, and never reads the global DEEPEST sample.
  4. The GRAVEYARD board stays as a ME-only board at the end of the rail beside LINEAGE, listing every stored run with its tap-to-expand details (epitaph included); ME rows keep their details too, the stored run history still feeds ME, LINEAGE and GRAVEYARD, and old saves load cleanly. (Amended 2026-09-25: the user reversed the removal.)
  5. Every finished run lands on each ME board it qualifies for (a depth-10 run tops a depth-9 one on DEEPEST), and a signed-in player's score reaches Play Games and shows on another player's ALL board after a refresh. Both root causes are found with `/gsd-debug` before fixing.
  6. The LEANEST board is gone from the rail, the local records and Play Games submission; old bests and queued runs that carry a `lean` entry load cleanly and nothing is ever submitted to the Season-1 LEANEST board again.

**Plans**: 6/6 plans executed

Plans:
**Wave 1**

- [x] 81-01-PLAN.md — Root-cause session, debug first (BOARD-15/16, confirms the BOARD-09 identity): death-path and submit/fetch trace pins, 81-DEBUG.md root causes, fix routing and the device-session gate (wave 1)
- [x] 81-02-PLAN.md — Retire LEANEST in code (BOARD-17): RETIRED_BOARDS, four-board submission and records, tolerant load of old bests and queued entries (wave 1)
- [x] 81-03-PLAN.md — LEANEST docs (BOARD-17): four-board runbook, §13 Retired boards with the delete-after-ship step, release notes and the post-push console checklist (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 81-04-PLAN.md — Panel restructure (BOARD-11/12/13/14): ME | ALL | FRIENDS with the ALL default when signed in; LINEAGE and GRAVEYARD kept as ME-only boards at the rail's end (…, LINEAGE, GRAVEYARD); LINEAGE never reads the global sample; 81-03's GRAVEYARD doc lines corrected (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 81-05-PLAN.md — Local recording fix (BOARD-15): the routed R-15 fixes plus reconcileBests at boot, every death-path pin green (wave 3)
- [x] 81-06-PLAN.md — Global boards fix (BOARD-09/10/16): YOU from the player's own leaderboard record, the pin rule and the hidden-score note, forceReload plus invalidate after a submission and on every panel open, the routed queue/tag fixes (wave 3)

**UI hint**: yes
**Device check**: yes — needs a signed-in Google Play Games build (YOU tag, standing card, ALL default, ME/ALL/FRIENDS switching, LINEAGE under ME only), batched into the milestone-close Pixel 7 checklist.

## Deferred / Not This Milestone

- **Pixel 7 UAT batches** — `docs/UAT-v2.0.md` (142), `UAT-v1.9.md` (21), `UAT-v1.8.md` (30), `UAT-v1.7.md` (25 + DR bar), `UAT-v1.6.md` (26) and `UAT-v1.5.md` (140), walked over the user's play sessions; findings become todos or quick tasks, never ad-hoc edits.
- **UX-06** first-run tutorial — deliberately last; rebuilt on the Phase 47 modular shell (the reason SHELL-01..03 exist). Includes the UIF-04 on/off toggle dropped from v1.3.
- **STR-01..04/06** Google Play production launch (Data Safety audit, privacy page, listing, IARC, pricing, rollout).
- **`storeRoll` for the bots** — the tuning harness still plays the frozen store roll; **the two structural v1.5 AFTER patterns** (Magic Users gain nothing from the class-gated ability system; Wilmsry's racial edge) — both carried forward past v1.7 per `REQUIREMENTS.md`'s Future Requirements (TUNE-06/07 are now in scope this milestone as TUNE-08/09, Phases 54–55).
- Store screen restyle to the dark vocabulary (Phase 47 moves the store into `storeScreen.js` unchanged — the restyle edits that module later).
- Dice-mode setting.
- Haptics polish; the unguarded button set from 32-03 (store rows, drop shelf, `a-evt`, `btn-again`, spell menu).
- Climb dice payload (`roll`/`need` on the four climb events) — carried over from v1.4 as a post-UAT quick task. **Superseded 2026-09-24**: CLIMB-01/02 (v2.1 Phase 78) replaces the retry card with a pre-roll decision card, and ROLL-05 (Phase 73) makes every climb roll high-is-good natively.
- Shell debt noted in the v1.5 audit but not in v1.6's requirements: the unreachable parley fluency-2 branch (`canParley`'s Magical tier, `wilmsryVsMagical`) and the `railCardFor` tie-break — fold into Phase 44's orphan sweep if they fall out for free, otherwise a quick task.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 72. Roll-Direction Sign Audit & Fixes | v2.1 | 7/7 | Complete    | 2026-09-24 |
| 73. Engine Roll-High Mirror | v2.1 | 10/10 | Complete    | 2026-09-25 |
| 74. Roll Display & Modifier Honesty | v2.1 | 8/8 | Complete   | 2026-09-25 |
| 75. Engine Rules — Character, Economy, Grimoire & Combat Bugs | v2.1 | 13/13 | Complete    | 2026-09-25 |
| 75.1. Pilfer Fumbles & Scroll Reading | v2.1 | 3/9 | In Progress|  |
| 75.2. Hero Size Matters | v2.1 | 0/– | Not started | - |
| 75.3. Deep-Floor Encounter Scaling | v2.1 | 0/– | Not started | - |
| 76. Darkness Unification & Relaunch Persistence | v2.1 | 0/– | Not started | - |
| 77. Combat Screen & Oracle Readability | v2.1 | 0/– | Not started | - |
| 78. HUD, Dead State & Climb Decisions | v2.1 | 0/– | Not started | - |
| 79. Content & Narrative Pass | v2.1 | 0/– | Not started | - |
| 80. Android Release Build & Tooling | v2.1 | 0/– | Not started | - |
| 81. Leaderboards Panel Fixes | v2.1 | 6/6 | Complete    | 2026-09-25 |
| 65. Run Record & Personal Bests | v2.0 | 5/5 | Complete    | 2026-09-23 |
| 66. Leaderboards Panel — Local | v2.0 | 7/7 | Complete    | 2026-09-23 |
| 67. Play Games Integration & Account Chip | v2.0 | 8/8 | Complete    | 2026-09-24 |
| 68. Global Boards, Submissions & "You Placed X" | v2.0 | 7/7 | Complete    | 2026-09-24 |
| 69. Compliance & Device Close | v2.0 | 4/4 | Complete    | 2026-09-24 |
| 70. Device-Round Polish | v2.0 | 4/4 | Complete    | 2026-09-24 |
| 71. Device-Round Polish II | v2.0 | 8/8 | Complete    | 2026-09-24 |
| 61. Gear Rules & Store Purchase Fix | v1.9 | 4/4 | Complete    | 2026-09-23 |
| 62. Gear Tab Layout Rebuild | v1.9 | 3/3 | Complete    | 2026-09-23 |
| 63. Action Sheet, Combat Lock & Accessibility | v1.9 | 5/5 | Complete    | 2026-09-23 |
| 64. Device Close & UAT Batch | v1.9 | 2/2 | Complete    | 2026-09-23 |
| 56. Sound Effects & Audio Settings | v1.8 | 4/4 | Complete    | 2026-09-22 |
| 57. Map & HUD Layout Band | v1.8 | 5/5 | Complete    | 2026-09-22 |
| 58. Motion & Pacing | v1.8 | 7/7 | Complete    | 2026-09-22 |
| 59. Party Animation & Dungeon Set Dressing | v1.8 | 5/5 | Complete    | 2026-09-22 |
| 60. Performance & Footprint Close | v1.8 | 3/3 | Complete    | 2026-09-22 |
| 50. Character Roller Fix | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 51. Initiative Once Per Combat | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 52. Foe Cadence & Damage Curve | v1.7 | 3/3 | Complete    | 2026-09-20 |
| 53. Joiner Level Cap | v1.7 | 2/2 | Complete    | 2026-09-20 |
| 54. Four-Band Retune & Roster Decision | v1.7 | 7/7 | Complete    | 2026-09-22 |
| 55. Human DR Round | v1.7 | 0/0 | Complete    | 2026-09-22 |
| 44. Retire the Classic Engine from the Shell | v1.6 | 4/4 | Complete    | 2026-09-19 |
| 45. Collapse the Phase 37 Hedges | v1.6 | 3/3 | Complete    | 2026-09-19 |
| 46. Honest Names, Dead Exports & the Tutorial Decision | v1.6 | 4/4 | Complete    | 2026-09-19 |
| 47. Shell Modularisation | v1.6 | 5/5 | Complete    | 2026-09-19 |
| 48. Stale Docs, Comments & Test Names Purge | v1.6 | 5/5 | Complete    | 2026-09-20 |
| 49. Measure-First Perf Pass | v1.6 | 2/2 | Complete    | 2026-09-20 |
| 36. Balance Foundation, Effect Timers & Small Independent Wins | v1.5 | 6/6 | Complete    | 2026-09-17 |
| 37. Equipment Slot Model & eff() Refactor | v1.5 | 4/4 | Complete    | 2026-09-17 |
| 38. Melee Active Abilities | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 39. Gear, Magic Items & One-Shot Tools | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 40. Spell Rework | v1.5 | 5/5 | Complete    | 2026-09-18 |
| 41. Terrain, Darkness & Phobias | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 42. Flee Retune & Consolidated Balance Close | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 43. Clarity Pass | v1.5 | 4/4 | Complete    | 2026-09-18 |
| 34. Combat Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 35. Map Screen Rebuild | v1.4 | 5/5 | Complete | 2026-09-16 |
| 28–33 | v1.3 | 16/16 | Shipped | 2026-09-16 |
| 22–27 (+25.1) | v1.2 | 31/31 | Shipped (override closeout: TUNE-07 deferred by user) | 2026-09-15 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.6 (tutorial rebuilds on the modular shell) | - |

## Backlog

### Phase 999.1: Transitions & Sounds (PROMOTED → Phases 56 / 58 / 59)

> **Promoted 2026-09-22 into milestone v1.8.** Sound → AUD-01..06 (Phase 56); transitions, combat pacing and typed text → MOTION-01..05 (Phase 58); the party-marker ring → ANIM-03 (Phase 59). The rail-overlay prerequisite it names is LAYOUT-01 (Phase 57). Kept here for its planning context until v1.8 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-19 for future planning — user's words] Map the sound clips in `sfx/` (30 MP3s the user added — 31 originally, less `enemy-batrat` which the user deleted 2026-09-22: `walk1-3`, `walk-water1-3`, `hit1-2`, `miss1-2`, `hurt1-3`, `foe-die`, `enemy-{beast,demon,human,undead}`, `spell`, `resist`, `heal`, `drink`, `chest`, `gold`, `trap`, `jump`, `stairs`, `levelup`, `death`, `ui-tap`) to game actions and engine events; and make the shell's transitions smooth — map panning, rail show/hide, opening menu items — "not jarring and immediate". Slow the fight responses down so there are transitions between exchanges and the player can process each one. Animate on-screen text as if quickly typed out (fast, not slow). Dial back the black circle around the party marker — the party is already highlighted, the ring is too stark.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** sound = a `src/browser/sfx.js` event→clip table played through Web Audio (`AudioContext` + `decodeAudioData`, unlocked by the first tap), wired beside `hapticForEvents(events)` in the dispatch path — engine untouched, mute toggle by the settings gear, clips bundled in `www/` (Android WebView plays MP3 offline, no plugin). Transitions: the rail is a flex sibling that reflows the viewport today (see todo `2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — overlay + slide is the fix, land together); map pan goes through `cameraPan()`/`keepInViewAxis` (`src/browser/controls.js`) with no easing; `.mw-rail-new` has a 0.18 s rise (`mazeworld.html` CSS ~L707) and combat has `mwStrikePop`/`mwRoundTick` keyframes but no inter-exchange pacing in `combatPanel.js`. Typed-text effect belongs to the rail/encounter line renderers (`renderRail`, `renderEncounter`), must respect the rail hold/dismiss rules and TalkBack (`#mw-rail-live` announcer gets the full text at once). Party marker ring: `PLAYER_MARKER_ICON`/`draw()`. Sequence AFTER v1.6 Phase 47 (shell modularisation) so the effects land in the new `src/browser/` modules, not the old `paint()` bodies; each effect gets a settings-respecting reduced-motion path.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.3: Dungeon set dressing (PROMOTED → Phase 59)

> **Promoted 2026-09-22 into milestone v1.8 as DRESS-01..05, Phase 59 (Party Animation & Dungeon Set Dressing).** Kept here for its planning context until v1.8 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-19 for future planning — user's words] Add set dressing to the dungeon using the new optimized `icons/optimized/set_dungeon_*.png` icons (54 of them: ash pile, banners, barrels/crates/sacks, bones/skulls/skeleton, blood, book/scrolls, boulder/rocks/rubble, braziers/torches/candles/sconce, cobwebs, mushrooms/moss/fern/roots/vines, grate/hatch/pit, puddles/slime, rat, shackles, …). Use them for random dungeon set items — on walls, or on paths provided they are DIMMED so they are never confused with the real encounter icons. Set dressing only: not interactable, no rules effect, pure ambiance.
**Requirements:** TBD
**Plans:** 0 plans

**Context for planning:** rendering-only, engine untouched — the placement must be deterministic per floor (derive from `makeRng(hash(seed, "dressing", depth))` in the SHELL/`src/browser/` layer, never a draw off the engine's main stream, so no fixture moves and the engine stays pure), keyed off the generated grid (`engine/maze.js` cells `{ wall, seen, feat }`; walls are the majority of the 21×21 grid) and revealed with `c.seen`. Draw in `draw()` (`mazeworld.html` ~L1931; feature icons at ~L1998-2002 via `iconsApi.drawFeatureIcon(ctx, img, x, y, CELL, dir, 0.75)`) BEFORE the feature/party layer: wall items at full or near-full alpha on wall cells; path items at low alpha (≈0.3-0.4) so `featureKeyForCell` encounter icons stay unmistakable; never on a cell that has a `feat`, the stairs, or the party. Density is a tunable (a handful per floor, rarer on deep floors?). `preloadIcons("./icons/optimized")` already loads the directory — check `icons.js`'s manifest approach so 54 extra images don't slow the first paint (lazy or a sprite). Respect the 260918-vm3 stationary camera and Phase 35 map palette; a settings toggle ("set dressing off") is cheap. Land after v1.6 Phase 47 (draw code may move into a module) and alongside 999.1's party-marker frames. The raw `icons/*.png` sheets the user added (`dungeon_dressing.png`, `encounters.png`, …) are sources — only `icons/optimized/` ships in `www/`.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: Map & HUD layout band (PROMOTED → Phase 57)

> **Promoted 2026-09-22 into milestone v1.8 as LAYOUT-01..06, Phase 57 (Map & HUD Layout Band).** Kept here with its todo index until Phase 57 closes; the four todos below carry `resolves_phase: 57`. Not a runnable backlog item — do not queue it.

**Goal:** [Captured from the 2026-09-19/21 Pixel 7 device rounds] The map screen's chrome stops fighting the map: the rail slides up OVER the map instead of reflowing it, the MARKS / CENTRE / MAKE CAMP / gear strip becomes a reserved band outside the viewport (so a chip tap can never also move the party), the HUD stacks into four bands instead of one clipping row, and the Table-7 Darkness counter becomes visible on the map.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (4):**

- `todos/pending/2026-09-19-rail-overlays-the-map-without-reflow-tap-to-dismiss-longer-h.md` — rail is a flex sibling that resizes `.mw-maze-viewport`; must overlay + slide, body tap dismisses a no-decision card (never a decision card), `RAIL_HOLD` roughly doubles. **Lands with 999.1** (both touch rail transitions).
- `todos/pending/2026-09-21-map-chip-strip-is-a-reserved-band-above-the-map-not-an-overl.md` — `.mw-map-chips` is an absolute overlay inside the viewport; chip taps also move the party and `keepInViewAxis` counts hidden cells.
- `todos/pending/2026-09-21-hud-reflow-name-hp-row-then-counters-then-conditions-then-chips.md` — the single-row HUD (Phase 35 ruling 5) overlaps Rations past 1,000 squares; four stacked bands. **Land together with the chip-strip todo.**
- `todos/pending/2026-09-21-table-7-darkness-counter-is-invisible-on-the-map.md` — `c.darkFor` only shrinks the reveal radius for NEW cells (fog is cumulative) and nothing dims; wants a vignette + the existing DARK chip countdown.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: Combat screen & Oracle readability (PROMOTED → Phase 77)

> **Promoted 2026-09-24 into milestone v2.1 as CMBUI-07..13, Phase 77 (Combat Screen & Oracle Readability).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured from the 2026-09-21 Pixel 7 device round] Everything the player reads during a fight is legible, ordered and honest: submenu rows stop clipping and sort by spell level, the foe's BESTIARY family shows after its name, the Oracle prints combat lines in event order rather than priority order, status chits are readable mid-fight, and a scroll that casts stops narrating a refusal.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (5):**

- `todos/pending/2026-09-21-combat-submenu-rows-clip-their-text-order-spells-by-level-then-name.md` — `.cb-row` clips on the phone; spell rows render in `SPELLS` array order with no sort. **Land with the hide-uncastable todo in 999.6.**
- `todos/pending/2026-09-21-foe-type-listed-after-the-name-on-the-combat-screen.md` — the foe record already carries `type` (the six BESTIARY families); surface it on `.cb-foe-name`.
- `todos/pending/2026-09-21-oracle-combat-lines-must-read-in-event-order.md` — the Oracle reuses the rail fold, which sorts by PRIORITY and collapses identical lines across time, so riposte kills print before the misses that caused them; wants idx-order + adjacent-only folding.
- `todos/pending/2026-09-21-status-chit-tap-in-combat-shows-nothing-rail-hidden-in-comba.md` — `railEl.hidden` is forced for the whole fight, so status-effect descriptions are unreachable in combat; wants a combat-legal transient card.
- `todos/pending/2026-09-21-scroll-read-in-combat-narrates-a-level-refusal-although-it-cast.md` — `scrollTooAdvanced` is the copy-to-book gate but reads as a refusal right before the cast line; narration-only.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: Engine rules fixes from the device rounds (PROMOTED → Phase 75)

> **Promoted 2026-09-24 into milestone v2.1 as RULES-01..04, Phase 75 (Engine Rules — Character, Economy, Grimoire & Combat Bugs).** The combat gear-lock and store-charge-then-refuse items in this backlog already shipped as v1.9 Phase 61 (GRULE-02 / STORE-02/03); only the Summoner school-gate, hide-uncastable-spells, HP-dot compounding and wilmst-cache items carried forward into v2.1. Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured from the 2026-09-21 Pixel 7 device round] Five rules bugs the fitted build exposed: a free mid-fight re-arm, a store purchase that charges then refuses, a Summoner holding spells it cannot cast, Table-4 HP dots that compound max HP geometrically, and a wilmst cache that still pays far too much.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (5):**

- `todos/pending/2026-09-21-no-equipping-or-swapping-gear-during-combat.md` — `equipItem` / `unequipSlot` / `wearItem` carry no `state.combat` gate and the Gear tab stays live mid-fight; wants an engine refusal + disabled rows (`engine/movement.js:523` is the existing gate pattern). **DONE — shipped as v1.9 Phase 61 (GRULE-02).**
- `todos/pending/2026-09-21-store-purchase-charged-then-rejected-as-not-an-upgrade-spike.md` — `buyFrom` deducts gold and marks the row sold BEFORE `takeItem` can reject `notBetter`; a purchase must always deliver or refuse before charging. **DONE — shipped as v1.9 Phase 61 (STORE-02/03).**
- `todos/pending/2026-09-21-summoner-rolls-freeze-it-cannot-cast-hide-uncastable-spells-.md` — chargen's `rollGrimoire` ignores the `mu-chart.js` school gate; plus the user ruling that the combat menu HIDES level-locked spells (reverses the earlier disabled-but-visible CONTEXT decision). **Carried to v2.1 as RULES-03/04.**
- `todos/pending/2026-09-21-table-4-hp-dots-compound-max-hp-geometrically-regression.md` — the "+25 HP" row adds `0.6 × CURRENT maxWP` permanently (×1.6 per pull, compounding) and the toll row then takes 36 % of the inflated pool; a 54-05 regression that also inflates the fit's bot heroes. **Carried to v2.1 as RULES-01.**
- `todos/pending/2026-09-21-red-dot-wilmst-cache-still-pays-far-too-much.md` — `WILMST_CACHE_PER_DEPTH = 300` flat × depth; wants its own cut (~100 × depth) or a derived-rng roll. **Carried to v2.1 as RULES-02.**

**Engine gate applies:** every one of these is a rules change — measure the moved parity fixtures first, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, regenerate only those, master never edited, bot readout before/after.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Content accuracy, tooling & the open climb ruling (PROMOTED → Phases 78, 79, 80)

> **Promoted 2026-09-24 into milestone v2.1: the climb/leap ruling → CLIMB-01/02, Phase 78; sub-class descriptions → VOX-04, Phase 79; the fit-tool replay-resume bug → TOOL-01, Phase 80.** The climb ruling was decided by the user 2026-09-24 as option B (the pre-roll CLIMB/LEAP/USE LADDER/USE ROPE/TURN BACK decision card). Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-21/22] The odds and ends from the device rounds: sub-class blurbs that hide their own gates, a fit tool whose replay-resume diverges, and the CLIMB IT retry card that went stale when Phase 54 made climbs one-and-done.
**Requirements:** TBD
**Plans:** 0 plans

**Captured todos (3):**

- `todos/pending/2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md` — the Summoner blurb never mentions the level-3 offense gate; audit every `SUB_NOTE` / `RACE_NOTE` against `MU_CHART` + the Phase 24 identity table. Content only.
- `todos/pending/2026-09-21-fit-tool-replay-resume-diverges-after-an-infeasible-point.md` — `+Infinity` scores serialise as `null`, so a resumed walk takes a different step after the first rejected candidate; per-block stdout was also truncated. Tooling only.
- `todos/pending/2026-09-22-climb-leap-retry-card-is-stale-under-one-and-done.md` — **resolved by user ruling 2026-09-24, option B:** a pre-roll CLIMB / USE TOOL / TURN BACK prompt, no rng until commit. Keep the ladder/rope option; `mapMarks.js` crevice copy reads pre-one-and-done too.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.8: Unify the two darkness mechanisms (PROMOTED → Phase 76)

> **Promoted 2026-09-24 into milestone v2.1 as DARK-01/02, Phase 76 (Darkness Unification & Relaunch Persistence).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [User ruling 2026-09-22, found during Phase 57 planning] The game has **two** darkness mechanisms with **different waiver sets**, and they disagree. Unify them behind one shared waiver predicate so a light source means the same thing everywhere.
**Requirements:** TBD
**Plans:** 0 plans

**The inconsistency, measured:**

| | `revealRadius(state)` | `mapViewRadius(state)` |
|---|---|---|
| Origin | **1994 canon** — `engine/derived.js` comment: "ports `mazeworld.html` `reveal()`'s radius line verbatim (line 838)" | **Phase 41 (TERR-03)** — this project's own render filter |
| Governs | what NEW cells are revealed as the party walks (feeds `seen`) | which already-`seen` cells are rendered (`inViewWindow`, applied in `draw()`) |
| Waived by | Night Vision, `+ eff("sight")` | Night Vision, `eff("light") > 0` (Amulet), `itemEffectActive("lit")` (torch) |

Verified empirically at HEAD with `darkFor: 30` on a non-dark tile:

```
no waiver   | inDark true | revealRadius 1 | mapViewRadius 1
lit torch   | inDark true | revealRadius 1 | mapViewRadius Infinity   <-- the divergence
```

**So a lit torch reopens your entire explored map but does not help you see one square further as you walk.** That is backwards from what a torch obviously does, and it is the cause of the 2026-09-21 device report (*"It looks like I'm in the dark, but it's not limiting my vision"*) — the player had a light source, the render filter waived, the reveal rule did not, and nothing on screen explained either.

**The shape of the fix:** one shared `darkWaived(c)` predicate consumed by both functions, with the **torch and the Amulet widening `revealRadius` as well** (the reading the user favours: a light source should mean the same thing everywhere). Keep `+ eff("sight")` as the separate additive it already is.

**Why this is NOT a v1.8 phase:** widening `revealRadius` changes which cells enter `seen`, and `seen` is serialized — so parity fixtures move. v1.8 is gated presentation-only (`engine/` and `content/` byte-identical, zero fixtures moved). This needs the greenfield treatment instead: measure the moved set first, declare each with before/after in `test/parity/FIXTURE-INVENTORY.md`, regenerate only those, never edit the master, and take a bot readout before/after (a wider reveal radius in the dark is a small difficulty change — darkness gets less punishing for anyone carrying a light).

**What Phase 57 did instead (v1.8, presentation-only):** made the *current* behaviour legible rather than changing it — the DARK chip names which waiver is holding the dark back, and the map vignette follows `mapViewRadius` (what is actually rendered) rather than `revealRadius`. When this backlog phase lands and the two agree, the vignette's source argument can collapse back to a single radius and `waiverFor`'s three-way split becomes a two-way one. Leave a comment in `src/browser/darknessView.js` pointing here.

**Third surface to fold in while here:** per-tile `tile.dark` painting in `draw()` is a *third* darkness expression, independent of both radii. Decide whether it shares the predicate or stays purely cosmetic.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.9: Android 15/16 edge-to-edge, deprecated window APIs, large-screen orientation (PROMOTED → Phase 80)

> **Promoted 2026-09-24 into milestone v2.1 as DROID-02/03, Phase 80 (Android Release Build & Tooling).** Flagged `--research-phase` recommended. Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-23 from the Play Console pre-launch notes on the 1.9.0 / vc8 build] Clear the three Play Console warnings so the game draws correctly edge-to-edge on Android 15+ and behaves on tablets, foldables and Chromebooks.
**Requirements:** TBD
**Plans:** 0 plans

**The three warnings, verbatim from Play Console:**

1. *"From Android 15, apps targeting SDK 35 will display edge-to-edge by default. Apps targeting SDK 35 should handle insets to make sure that their app displays correctly on Android 15 and later. Investigate this issue and allow time to test edge-to-edge and make the required updates. Alternatively, call enableEdgeToEdge() for Kotlin or EdgeToEdge.enable() for Java for backward compatibility."*
2. *"One or more of the APIs you use or parameters that you set for edge-to-edge and window display have been deprecated in Android 15. To fix this, migrate away from these APIs or parameters."*
3. *"Your game doesn't support all display configurations, and uses resizability and orientation restrictions that may lead to layout issues for your users."*

**What is already in place (so this is a verify-and-tidy, not a rewrite):**

- `targetSdkVersion = 36` (`android/variables.gradle`), so edge-to-edge is already forced on Android 15+.
- `mazeworld.html` pads its fixed chrome with `var(--safe-area-inset-*, env(safe-area-inset-*))` (HUD band ~L1026, dead screen ~L1105, `.mw-bd-dock` ~L1187, title/panels ~L1261/1344/1417/1527). Device checks so far have looked right on the Pixel 7, but nobody has tested gesture-nav vs 3-button nav, a display cutout, or landscape.

**Likely sources, to confirm:**

- **Warning 2:** `src/browser/nativeChrome.js` ~L219-220 calls `StatusBar.setBackgroundColor({ color: "#1b170f" })`. On Android that maps to `Window.setStatusBarColor`, which is deprecated in API 35 and ignored under edge-to-edge (the comment there already calls it best-effort). Drop the call, or move to `@capacitor/status-bar`'s edge-to-edge-aware API if 8.x has one. Also check Capacitor core, SplashScreen and the Play Games plugin (Phase 67) for `setStatusBarColor`, `setNavigationBarColor` or `setDecorFitsSystemWindows`. Play Console names the calling class under "View details".
- **Warning 1:** confirm Capacitor 8's `BridgeActivity` already enables edge-to-edge, or call `EdgeToEdge.enable(this)` in `MainActivity`. Then check that the WebView really receives the insets: Capacitor's `SystemBars`/`adjustMarginsForEdgeToEdge` config, and whether `env(safe-area-inset-*)` is populated inside the Android WebView or needs the Capacitor-injected `--safe-area-inset-*` variables.
- **Warning 3:** `AndroidManifest.xml` sets `android:screenOrientation="portrait"` and `nativeChrome.js` locks portrait through `@capacitor/screen-orientation`. On Android 16 (targetSdk 36), large screens (smallest width ≥ 600dp) **ignore** orientation and resizability restrictions, so the game will run in landscape or in split-screen on tablets and foldables whatever we set. Decide whether to (a) accept a letterboxed portrait column centred on wide screens (a max-width layout plus a dark gutter), or (b) do nothing and accept the warning. Games can opt out through the `android:appCategory="game"` exemption, so check whether Play still flags a game that declares it.

**Constraints:** presentation and native shell only. The engine, `content/` and fixtures are untouched. Needs a device pass on the Pixel 7 in both navigation modes, plus an emulator tablet or foldable (resizable AVD) for warning 3.

**Sequencing:** interacts with the AGP 9.3.1 spike (Phase 67, `67-AGP9-SPIKE.md`), which also touches the Android build, so land it after that verdict. A good fit for the first post-v2.0 native-polish pass, alongside the R8/minify todo.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.10: Keep live combat and open store through a relaunch (PROMOTED → Phase 76)

> **Promoted 2026-09-24 into milestone v2.1 as SAV-06/07, Phase 76 (Darkness Unification & Relaunch Persistence).** Kept here for its planning context until v2.1 closes — not a runnable backlog item, do not queue it.

**Goal:** [Captured 2026-09-24 from Phase 70 plan 70-04's resume proof; user ruling: finish Phase 70, fix later] A player who Save & quits (or whose app is killed) mid-fight or mid-store should come back to the same fight or store after a relaunch, not to a cleared tile.
**Requirements:** TBD
**Plans:** 0 plans

**The gap, measured (70-04, real engineAdapter + fake storage):**

- In session: SAVE & QUIT → ENTER resumes exactly (no dispatch happens).
- After a relaunch: `dispatch()` did persist `combat` / `store`, but `engine/saveState.js#rehydrate` (~L735-736) always resets `combat`, `store`, `beats`, `pendingFind` and `pendingHazard` to null. Only `pendingLoot` survives on purpose (LOOT-06). The code comments call this deliberate: it copies the 1994 prototype's load, which treated them as transient.
- Consequences: a relaunch mid-fight lands on the same tile with the fight gone, which also means force-closing the app escapes any fight. An open store vanishes the same way.
- Pinned as today's behaviour in `test/persistence/` (70-04), with a pointer here.

**The shape of the fix:** carry a validated `combat` and `store` through `validateSave` and `rehydrate`, including mid-fight state that combat depends on (`c.foeEffect`, the timers, any per-round flags). Decide whether `beats` should rehydrate or the round should resume at a clean round boundary. Check `pendingFind` / `pendingHazard` the same way.

**Constraints:** an engine change (greenfield ruling: no dual path). Measure which parity or roundtrip expectations move, declare them in `test/parity/FIXTURE-INVENTORY.md`, and never edit the prototype master. Needs a relaunch-mid-fight device check.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.11: Per-sub-class leaderboards & global LINEAGE (BACKLOG — promote as its own milestone)

**Goal:** [Captured 2026-09-24, user] Every sub-class has its own global DEEPEST board on Play Games. Claude creates all 24 boards in Play Console by script and captures their IDs; nobody fills in the Console form 24 times. The game submits each run to its sub-class board, and LINEAGE gets an honest global form back. **The user wants this promoted as its own milestone** (via `/gsd-new-milestone`, after v2.1), not folded into v2.1.
**Requirements:** TBD
**Plans:** 0 plans

**Combines two threads:**

1. **The ask (user, 2026-09-24):** one leaderboard per sub-class, all ranked by deepest depth. Creating each board by hand in Play Console is too slow with 24 sub-classes, so Claude should create them. It must also **retrieve each new board's ID** and wire it in, the way the Season-1 IDs were pasted by quick task 260924-c14.
2. **The deferred LINEAGE global board:** v2.0 Phase 68 built LINEAGE's global form by grouping a top-25 DEEPEST sample on the client, with no per-combo board explosion in Play Console (PROJECT.md key decision; `proposed-milestone-leaderboards.md` "Race/sub-class boards: combinatorial"). At v2.1 roadmap approval the user made LINEAGE ME-only and deferred per-sub-class global boards (STATE.md 2026-09-24; **Phase 81** success criterion 3). The reason: Play Games keeps one best score per player per board, so a sample of DEEPEST cannot honestly rank lineages. Per-sub-class boards are the fix.

**What exists today (verified 2026-09-24):**

- **24 sub-classes, 8 per parent class:** `content/classes.js:13` (`CLASSES[...].subs`). The id is also the display name.
  - Magic User: Wizard, Warlock, Sorcerer, Summoner, Cleric, Illusionist, Court Mage, Apprentice
  - Fighter: Knight, Guard, Woodsman, Soldier, Barbarian, Master of Arms, Samurai, Bard
  - Thief: Pickpocket, Pilfer, Cat Burglar, Cutthroat, Cloaker, Ninja, Con Artist, Acrobat
  - `src/browser/scoreTag.js:38` `TAG_SUBS` is a frozen, append-only index in a different order. `classOfSub()` is at `:66`.
- **Play Games app / project ID `517177834262`:** `android/app/src/main/res/values/games-ids.xml:6`; runbook `docs/PLAY-GAMES-SETUP.md`.
- **Board IDs:** `content/leaderboards.js` `LEADERBOARD_IDS`, one frozen entry per season with 5 keys (deep/lean/days/kills/purse; `lean` goes away, see the LEANEST decision). A `PLACEHOLDER` prefix means the board is skipped silently.
- **Scores:** `src/browser/boardScores.js`. The DEEPEST encoding is `floor * 1,000,000 - steps` (steps capped at 999,999), `largerIsBetter`. `leaderboardId(ids, season, board)` is at `:132`, and dev builds use `dev_{board}_s{season}` (`:165`).
- **Submission:** `mazeworld.html` `onRunRecorded` → `src/browser/pgsQueue.js` enqueue (`:124`) → `flush()` → `provider.submitScore` (`:386`), one acked board at a time. Standing is fetched on the deep board (`:428-432`). The provider is `src/browser/playGames.js` (`@modbender/capacitor-play-games` 0.5.0).
- **No service account yet:** `docs/RELEASING.md` "Uploading from the CLI (not set up yet)" and `C:/Users/Dell/.play/` does not exist.

**Part A: provision the boards by script (Claude does this, user approves)**

- **API:** Google's Play Games Services **Publishing / Games Configuration API**. `POST https://www.googleapis.com/games/v1configuration/applications/{applicationId}/leaderboards` (`leaderboardConfigurations.insert`), plus `list` / `get` / `update` / `delete`. OAuth scope `https://www.googleapis.com/auth/androidpublisher`. The body is `{ scoreOrder: "LARGER_IS_BETTER", draft: { name: { translations: [{ locale: "en-US", value }] }, scoreFormat: { numberFormatType: "NUMERIC", numDecimalPlaces: 0 }, sortRank } }`. Leave `scoreMin` / `scoreMax` empty to match the Season-1 boards. The response carries the new board's `id` (`CgkI...`), which is how the IDs are captured.
- **One-time user setup:** a Google Cloud service account plus a JSON key stored outside the repo (`C:/Users/Dell/.play/service-account.json`), with the Games Configuration API enabled in that project. Then invite the service account in Play Console → Users and permissions, with the permission that covers Play Games Services configuration. Confirm the exact permission name at planning. **The same key unlocks `tools/play-upload.mjs`** (the CLI AAB upload that RELEASING.md defers), so plan the two together.
- **Script:** `tools/pgs-leaderboards.mjs`, build tooling only; `googleapis` or plain `fetch` + `google-auth-library` as a devDependency; nothing ships in the app. It reads the sub-class list from `content/classes.js` so the list is never retyped. It is **idempotent**: `list` first and skip any board whose name already exists, so a rerun never duplicates. `--dry-run` prints the plan. It writes the returned IDs into `content/leaderboards.js` (or prints the block for review).
- **Naming:** follow the Season-1 convention (`PLAY-GAMES-SETUP.md` §7: *DEEPEST, Season 1*). For example *DEEPEST, Wizard* (all-time) or *Wizard, Season 1* (seasonal). Decide with the seasons question below.
- **Publishing:** the API creates **draft** leaderboards. Testers see drafts; everyone else sees them only after the user presses **Publish** on the Play Games Services config in Play Console. Keep that as a manual user step and add it to the runbook. Ordering cannot be changed once published, so the dry-run output is the review gate.
- **Fallback:** if the service-account route is blocked, drive Play Console's "Create leaderboard" form in the user's signed-in Chrome (claude-in-chrome) and scrape each ID from the board's page. It's slower and more fragile.

**Part B: submit to the sub-class boards**

- Extend the `LEADERBOARD_IDS` shape to carry sub-class boards, keyed by the `content/classes.js` sub names. The unit suite asserts every sub-class has an ID or a `PLACEHOLDER`.
- `pgsQueue` submits the existing DEEPEST score (same `boardScore` encoding and score tag) to the run's sub-class board, as well as the main DEEPEST board. Acks are tracked per board so a retry never double-submits. Dev IDs become `dev_deep_{sub}_s{season}`.
- Old queued entries without sub-class boards load tolerantly (greenfield rule: no dual path; old saves tolerant-load only).

**Part C: global LINEAGE returns**

- The global LINEAGE view for a picked sub-class reads **that sub-class's board** (top page + the player's own standing), not the DEEPEST sample. Race stays a client-side filter from the score tag on that board's rows. This is honest per sub-class; the race split is still a sample, and the copy should say so.
- This reverses or extends Phase 81's "LINEAGE ME-only". **It depends on Phase 81 landing first** (ME | ALL | FRIENDS scopes).

**Decided (user, 2026-09-24): Google only, rolling season sets.**

- **Play Games only.** No backend of our own and no managed leaderboard service. Considered and rejected: a Cloudflare Worker + D1 server (PGS `requestServerSideAccess` identity, `loadFriends` filter, replay-verified runs), and PlayFab / LootLocker / Nakama.
- **Each season gets a full set of 28 boards** (4 main + 24 sub-class; LEANEST is dropped, see below) with fresh IDs, added as a new `LEADERBOARD_IDS` entry plus a `SEASON` bump and an app update, as the season model already works. **The old season's set is deleted later** to stay under Play Games' **70-leaderboard cap**. Published boards cannot be reset, but they can be deleted.
- **Rolling window:** at most two season sets live at once (56 boards). Season N-1's set must be deleted before Season N+1's set is created (3 × 28 = 84 > 70). Google does not document whether deleted boards still count toward the cap. **Test it once with a throwaway board** before the first rollover.
- **The script therefore needs two modes:** `create --season N` (create the 28 boards, capture the IDs, write the `content/leaderboards.js` entry) and `delete --season N` (delete that season's 28 by name/ID; `--dry-run` first).
- **Once a season is deleted,** the panel's season picker must drop it (or show it as retired). `pgsQueue` must treat a "leaderboard not found" error on a retired season's board as permanent and drop the entry, not retry forever. Players who haven't updated keep submitting to the old boards until those are deleted, and after that the submissions are dropped.

**Decided (user, 2026-09-24): drop LEANEST.**

- **Why:** LEANEST ranks by steps per floor (`src/browser/boardScores.js` `lean = round(1000 × steps / max(floor, 1))`; local `engine/records.js` `compareRuns("lean")`). A 1-step death therefore tops it (a floor-0 death counts as one floor on Play Games, and a 1-step death on floor 1 tops the local board). The user's intended meaning, "deepest floor, then the fewest steps", is exactly DEEPEST's ordering (`floor × 1,000,000 − steps`). v2.0 Phase 66 D-09 had moved LEANEST to steps per floor precisely to stop it duplicating DEEPEST, so there is no honest single-number LEANEST left.
- **Considered and parked:** "fewest steps to reach floor 5 / 10 / 15 / 20" speedrun boards. The user liked the idea, but it adds 4 boards per season, and the user wants fewer boards, not more. Keep it as an idea only.
- **Scope of the removal:** drop `lean` from `RANKED_BOARDS` / `BOARD_IDS` (`engine/records.js`), `SUBMIT_BOARDS` / `SCORE_ORDER` / `boardScore` / `scoreFallback` (`src/browser/boardScores.js`), the `lean` key of every `LEADERBOARD_IDS` season entry, `content/boards.js` copy, the panel's board rail, the bests record's `lean` list (tolerant-load: an old `ddr.bests.v1` with a `lean` list loads cleanly and drops it), and queued `pgsQueue` entries' `lean` scores (dropped on load, never submitted). Also update `docs/PLAY-GAMES-SETUP.md` §7 (board table and "The LEANEST limit").
- **The live Season-1 LEANEST board** (`CgkIlvbN0YYPEAIQAw`): stop submitting to it, then delete it in Play Console (or by the script's `delete` mode) once the update without it is out. That frees one slot under the 70 cap.
- **Moved to v2.1 Phase 81 as BOARD-17** (user, 2026-09-24): it closes a live exploit and is the same kind of removal as GRAVEYARD. This milestone starts with LEANEST already gone; the season sets above assume 28 boards.

**Open decisions (for milestone discussion):**

- Race boards too? 6 more per season makes 34 per set, and two live sets = 68, just under the cap, so probably not. Race × sub-class (144) is impossible under the cap.
- Board icons: `imageConfigurations.upload` (`LEADERBOARD_ICON`) could reuse the sub-class PNG art. Optional.
- Does "you placed X" also report the sub-class standing on the death card?

**Constraints:** shell and tooling, plus the pure `engine/records.js` board list for the LEANEST removal; zero parity fixtures expected (verify). The service-account key never enters the repo or `www/`. No new runtime SDK (the ads/analytics audit stays clean). Needs a signed-in Pixel 7 check (submission lands on the sub-class board; LINEAGE ALL/FRIENDS), batched into the milestone-close checklist.

**Sources:** [leaderboardConfigurations.insert](https://developer.android.com/games/services/publishing/api/leaderboardConfigurations/insert) · [LeaderboardConfiguration resource](https://developer.android.com/games/services/publishing/api/leaderboardConfigurations) · [70-leaderboard limit](https://developers.google.com/games/services/common/concepts/leaderboards)

Plans:

- [ ] TBD (promote with /gsd-new-milestone when ready — user wants this as its own milestone)

### Phase 999.12: Achievements track (BACKLOG — promote as its own milestone)

**Goal:** [Captured 2026-09-25, user] Add an achievements track to the game. Every achievement name and unlock line is written in the game's sarcastic, family-friendly voice. **The user wants this promoted as its own milestone** (via `/gsd-new-milestone`), not folded into a bug-fix milestone.
**Requirements:** TBD
**Plans:** 0 plans

**The user's seed list (ideas, not a closed set):**

- **Depth milestones:** reach 5, 10, 15 and 20. **20 is "Unicorn!"** (matches the depth-20 unicorn-ceiling tuning target).
- **Fully dressed:** have an item equipped in every slot at once.
- **Naked ambition:** reach 5 with **nothing equipped**. You must unequip everything before your first move, so the check is "zero equipped at step 1 and never re-equipped".
- **Teetotaler:** reach 5 without drinking a single healing potion.
- **Frequent flier (tiered):** die 50, 100, 200 and 500 times, counted across all runs.
- **Read the label:** drink the Death potion (`content/potions.js:45`, `eff: "death"`, *"your dead!"*).
- **Body counts:** kill 100 Walking Dead, and one "kill 100" for each monster group. The groups are the `content/bestiary.js` `BESTIARY` keys: Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead.
- **Every race:** reach 5 with each race in `content/races.js`: Human, Elven, Dwarven, Wilmsry, Fridgian, Troll.
- **Every class:** reach 5 with each parent class (Magic User, Fighter, Thief), not with each sub-class.
- **Tourist:** start one delve with every one of the 24 sub-classes (`content/classes.js` `CLASSES[...].subs`). Depth doesn't matter.
- **Survivor (tiered):** live for X days in a single run. Tier thresholds are decided at planning, calibrated from bot/sim day counts.
- **Hoarder (tiered):** gain X coin. Decide at planning whether it counts one run or lifetime, and whether it's coin earned or coin held.
- **Special Snowflake:** die on floor 1. The user's line: *"You're a special snowflake."* Every run starts on floor 1 (there is no floor 0), so any death before the first descent counts.
- **Party Animal (tiered):** accept X Joiners in total, counted across all your delves. The tier thresholds are decided at planning.

- **Fallen Joiners (tiered, user):** X Joiners have died in your service, counted across all delves. Name idea: *Human Shields*.
- **Fallen summons (tiered, user):** X of your summons have died. Name idea: *Disposable Help*.
- **"Any kind of fun thing" (user):** the brainstorm below is open. Keep what's funny.

**Brainstorm (Claude, 2026-09-25, for the milestone discussion; every one keys off an engine event or death cause that already exists):**

- **Death-cause collection.** The death causes are the `content/epitaphs.js` keys: combat, starve, trap, fall, gorge, teleport, maze, quake, potion, insanity, poison, backfire, summon, entombed.
  - *Well-Rounded:* die of every cause.
  - Hidden one-offs, each with a hint breadcrumb:
    - *Just One More Bite* (gorge)
    - *Friendly Fire* (your own spell backfires; also `backfireSelfDamage`)
    - *Read the Fine Print* (killed by your own summon; also `summonBackfired`)
    - *Buried Talent* (entombed)
    - *Poor Aim* (teleported into trouble)
- **Dying with regrets:**
  - *You Can't Take It With You:* die with X coin unspent.
  - *Saving It For Later:* die holding an undrunk healing potion.
  - *Speedrun:* die within your first N steps.
- **Tiered event counters:**
  - *Tactical Retreat Enthusiast:* flee X times (`fled`).
  - *Tripwire Connoisseur:* spring X traps (`trapSprung`).
  - *Bomb Squad:* disarm X traps (`trapDisarmed`).
  - *Get Off My Lawn:* turn X Walking Dead (`walkingDeadTurned`).
  - *Cartographer:* fully map X floors (`floorMapped`).
- **Social disasters:**
  - *Diplomatic Incident:* insult a foe in parley (`parleyInsulted`).
  - *Riveting Company:* a foe gets bored and leaves (`foeBored`).
  - *It's Not You, It's Me:* dismiss a Joiner (`joinerDismissed`).
  - Something for `joinerMurdered`, once planning confirms what that event covers.
- **Collectors:**
  - *Collected Neuroses:* acquire X distinct phobias (`phobiaAcquired`).
  - *Fashion Victim:* lose X armor pieces to wear (`armorDestroyed`).
  - *Retail Therapy:* spend X coin at the store, lifetime.
- **Faerie roulette:** *Fairy Godmother* (a `faerieBoon`) and *Fairy Godmugger* (a `faerieBane`).
- **Clutch:** *Just a Flesh Wound:* win a fight on 1 HP.

**Design principle: tiers and breadcrumbs (user, 2026-09-25):**

- **Tier the counters.** Counting achievements come in escalating tiers (deaths 50 / 100 / 200 / 500). Apply the same idea to kill counts and similar tracks, so there is always a next rung in sight.
- **Achievements hint at other achievements.** An easier, more common unlock's sarcastic line drops a clue about a less obvious one. Example: *Fully dressed* (every slot filled, likely common) hints that taking it all *off* might also count, which leads to *Naked ambition*, something few players would think of otherwise. Chain the hidden or odd achievements behind hints from the obvious ones. Hidden achievements can be revealed when their hint fires (Play Games `revealAchievement` exists for exactly this).

**Open decisions (for milestone discussion):**

- **"Level" means floor depth or character level?** The engine has both: character level comes from `levelFromSP` in `engine/derived.js`. The depth-20 unicorn target suggests depth, and "reach 5" in the other ideas probably means depth too. Confirm.
- **Where achievements live:** Play Games achievements, a local in-game list, or both. The plugin `@modbender/capacitor-play-games` already exposes `unlockAchievement` / `incrementAchievement` / `setAchievementSteps` / `loadAchievements` / `showAchievements`. The game must stay fully playable offline, so a local list is the source of truth and Play Games is a mirror. Unlocks earned offline or while signed out are queued like `pgsQueue` scores.
- **Provisioning:** Play Console achievements need an icon and fixed XP points (1,000 XP cap per game). Created by script via the Games Configuration API (`achievementConfigurations.insert`) with the same service account as 999.11's leaderboards script, or by hand. Plan them together.
- **Counters and persistence:** the kill counts per group, deaths, races/classes reached and sub-classes delved need a durable lifetime-stats record in `@capacitor/preferences` (the `storage.js` pattern), kept separate from the run save. Tolerant-load, no legacy paths. Decide whether to count retroactively from the local graveyard/bests history.
- **Engine purity:** the engine only emits the facts (kills with group, potion drunk, equip state at step 1, depth reached). The achievement tracker is a shell layer that folds events into the lifetime stats. Zero rng draws, so zero parity fixtures should move (verify).
- **Surfacing:** an unlock is a minor event, so it shows as a toast with a sarcastic line, not a card (see the card vs toast rule). The list lives somewhere in ☰ or the Hero Company tab; the Play Games achievements UI opens from ☰. Hidden or secret achievements (e.g. the Death potion) keep the joke intact.
- **Bot / sim:** decide whether the headless bot tracks achievements (probably not, but depth-reach rates from the sim help calibrate how hard each one is).
- **More ideas welcome:** the user's list is a starting point. Brainstorm more in the game's voice during discussion.

**Achievement and icon inventory (Claude, 2026-09-25, for icon generation):**

Icons are required. Play Games treats each tier as its own achievement, and every achievement needs its own uploaded icon (512×512). So **icon files = achievements**. Art is cheaper than that: draw one picture per achievement line and make each tier by adding one of 4 reusable tier frames (bronze / silver / gold / mythic). Play Games generates the greyed-out locked version itself. The same pictures, shrunk down, serve the in-game list. The repo has no race, class or monster art to reuse, so every picture is new.

*The user's list:*

| Achievement | Tiers | Icon files | Pictures |
|---|---|---|---|
| Depth 5 / 10 / 15 | 3 | 3 | 1 (descent) |
| Unicorn! (depth 20) | 1 | 1 | 1 (its own art) |
| Fully Dressed | 1 | 1 | 1 |
| Naked Ambition | 1 | 1 | 1 |
| Teetotaler | 1 | 1 | 1 |
| Frequent Flier (die 50/100/200/500) | 4 | 4 | 1 |
| Read the Label (Death potion) | 1 | 1 | 1 |
| Body counts: Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead | 1 each (100 kills) | 6 | 6 |
| Every race: Human, Elven, Dwarven, Wilmsry, Fridgian, Troll | — | 6 | 6 |
| Every class: Magic User, Fighter, Thief | — | 3 | 3 |
| Tourist (all 24 sub-classes) | 1 | 1 | 1 |
| Special Snowflake | 1 | 1 | 1 |
| Survivor (X days) | TBD | ~4 | 1 |
| Hoarder (X coin) | TBD | ~4 | 1 |
| Party Animal (X Joiners) | TBD | ~4 | 1 |
| Human Shields (fallen Joiners) | TBD | ~4 | 1 |
| Disposable Help (fallen summons) | TBD | ~4 | 1 |
| **Total** | | **49** (44 at 3 tiers) | **29** |

*The Claude brainstorm (not yet agreed):*

| Group | Achievements | Icon files | Pictures |
|---|---|---|---|
| Death causes | Well-Rounded, Just One More Bite, Friendly Fire, Read the Fine Print, Buried Talent, Poor Aim | 6 | 6 |
| Dying with regrets | You Can't Take It With You, Saving It For Later, Speedrun | 3 | 3 |
| Tiered counters | Tactical Retreat Enthusiast, Tripwire Connoisseur, Bomb Squad, Get Off My Lawn, Cartographer | 20 (4 tiers) | 5 |
| Social disasters | Diplomatic Incident, Riveting Company, It's Not You It's Me, one for `joinerMurdered` | 4 | 4 |
| Collectors | Collected Neuroses, Fashion Victim, Retail Therapy (tiered) | 12 (4 tiers) | 3 |
| Faerie | Fairy Godmother, Fairy Godmugger | 2 | 2 |
| Clutch | Just a Flesh Wound | 1 | 1 |
| **Total** | | **48** (40 at 3 tiers) | **24** |

*Scenarios:*

| What ships | Icon files | Pictures |
|---|---|---|
| User's list as written | 44–49 | 29 |
| User's list, kill counts tiered ×4 | ~67 | 29 |
| User's list + full brainstorm | ~84–97 | 53 |
| Tier frames (made once, reused) | — | +4 |

Minimum art job: **29 pictures + 4 tier frames**, exported as about **49 icon files**. The hand-off prompt for an image-generation agent is `.planning/phases/999.12-achievements-track/ICON-BRIEF.md`.

*Decisions that move the counts:*

- **Tier counts** for Survivor, Hoarder, Party Animal, Human Shields, Disposable Help and the kill counts. Each extra tier adds one icon file per track, but no new picture.
- **Races and classes:** 9 separate achievements (as counted above), or one achievement each that fills up as you go. The single-achievement option cuts 9 files and 9 pictures down to 2 of each (29 pictures become 22).
- **Points:** Play Games gives each game 1,000 points in total. Across 50–90 achievements that is roughly 10–20 points each, which argues for short tier ladders.

**Constraints:** offline-first (no network needed to earn an achievement); no new runtime SDK beyond the existing Play Games plugin; family-friendly copy; needs a signed-in Pixel 7 check (unlock toast plus the Play Games popup), batched into the milestone-close checklist.

Plans:

- [ ] TBD (promote with /gsd-new-milestone when ready — user wants this as its own milestone)
