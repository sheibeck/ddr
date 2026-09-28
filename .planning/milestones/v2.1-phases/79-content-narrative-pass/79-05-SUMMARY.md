---
phase: 79-content-narrative-pass
plan: 05
subsystem: content-text
status: complete
tags: [ROLL-04, VOX-05, content, narrative-pass, parity-carve-out]
requirements: [ROLL-04, VOX-05]
dependency_graph:
  requires: [79-01, 79-02, 79-03]
  provides:
    - "content rules text reads roll-high (Mirror Self, Weaken, Smoke, Battle Roar, Sidestep, Overhead Blow, Stealth, Locks, Lockpicks, the invisibility items, Zit/Stink Bug/Pogo)"
    - "test/unit/authored-ranges.test.js: every stated range or face count pinned to the engine rule"
    - "REWORDED_TXT_ITEMS carve-out extended; declaredEndDiffs strips reworded item txt"
    - "docs/narrative-pass/why/79-05.json (30 rows)"
  affects: [79-07, 79-12, "Joiner-defences engine fix"]
tech_stack:
  added: []
  patterns:
    - "faces phrasing for a scaling die (\"their die's top face\", \"two fewer faces\"); a fixed d10 states the range (\"6–10 on d10\")"
    - "a range pin reads the engine's own event fields (chestLockRolled atLeast/dieN) through facesRangeText"
key_files:
  created:
    - test/unit/authored-ranges.test.js
    - docs/narrative-pass/why/79-05.json
  modified:
    - content/spells.js
    - content/abilities.js
    - content/skills.js
    - content/treasure-tables.js
    - content/potions.js
    - content/bestiary.js
    - content/misc-tables.js
    - engine/items.js
    - engine/economy.js
    - src/browser/rollOdds.js
    - test/parity/harness/comparables.js
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/roll-high-state-pins.test.js
    - test/unit/abilities-catalog.test.js
    - test/unit/fixtures/shell-snapshots/mu-store.store.txt
    - test/unit/fixtures/shell-snapshots/mu.hero.txt
    - test/unit/fixtures/shell-snapshots/thief-store.store.txt
    - test/unit/fixtures/shell-snapshots/thief.gear-sheet-bag.txt
    - test/unit/fixtures/shell-snapshots/thief.gear-sheet-worn.txt
    - test/unit/fixtures/shell-snapshots/thief.gear.txt
    - test/unit/fixtures/shell-snapshots/thief.hero.txt
decisions:
  - "A foe's strike die scales with the foe's level (foeDie: d20, d12, d10, d8), so Mirror Self, Smoke, the invisibility items and Weaken speak in faces rather than the CONTEXT example's d20 numbers (\"only on a 20\", \"18–20\"), which would be wrong against any foe above level 1"
  - "Weaken reads \"no more than their die's top three faces\": the engine caps (min) at three, it never raises a lower count"
  - "Bat/Rat and Viper keep \"wp\": they are Phase 18 D-14 fixture-exposed rows pinned byte-identical in a sibling-owned test, and the foe card already shows HP (R-16); handed on"
  - "Leap labels take the en dash and rollOdds.js#gapText reads it (greenfield: no hyphen fallback)"
metrics:
  duration: "about 45 minutes"
  completed: 2026-09-27
  tasks: 3
  files: 23
---

# Phase 79 Plan 05: The content rules text reads roll-high Summary

Every roll-under content text handed to Phase 79 now states the engine's
roll-high odds, in faces where the die scales and as a d10 range where it
is fixed, and a new test ties each stated number to the engine function
that enforces it.

**Plan base:** `d39625ee07887d049a216e1801e467f923aabe41`.

## What changed (before → after)

| Key | Before | After | Reasons |
|---|---|---|---|
| content:SPELLS.Mirror Self.txt | defensive · you · foes need a 1 to hit, d6 rounds | defensive · you · foes hit you only on their die's top face (the top two faces if you insulted them), d6 rounds | roll-under, accurate |
| content:SPELLS.Weaken.txt | control · every foe · they hit on a 3 and do half, d4+1 rounds | control · every foe · no more than their die's top three faces hit, and they do half, d4+1 rounds | roll-under |
| content:ABILITIES.smoke.txt, THIEF_SKILLS.Smoke.txt | gone: for two rounds foes need a natural 1 to find you (a 1–2 if you insulted them), and a flee during it just works | gone: for two rounds foes find you only on their die's top face (the top two faces if you insulted them), and a flee during it just works | roll-under |
| content:ABILITIES.battleRoar.txt, FIGHTER_SKILLS.Battle Roar.txt | loud enough to matter: for two rounds every foe needs two better to hit anyone on your side | loud enough to matter: for two rounds every foe has two fewer faces that hit anyone on your side | roll-under |
| content:ABILITIES.sidestep.txt, FIGHTER_SKILLS.Sidestep.txt | two rounds of not being where the blade is: every foe needs two better | two rounds of not being where the blade is: every foe has two fewer faces that hit you | roll-under |
| content:ABILITIES.overheadBlow.txt | everything into one swing: double damage, but you need two better to land it | everything into one swing: double damage, but your die has two fewer faces that land it | roll-under |
| content:FIGHTER_SKILLS.Stealth.txt | critical on a 2 when you open a fight; never in plate | critical on your die's top two faces when you open a fight; never in plate | roll-under |
| content:THIEF_SKILLS.Locks.txt / .txt2 | 1–5 on d10 to open a lock / 1–7 on d10 to open a lock | 6–10 on d10 to open a lock / 4–10 on d10 to open a lock | roll-under |
| content:ABILITIES.feint.txt, THIEF_SKILLS.Feint.txt | look left, stab right: this strike cannot miss and adds your level | … adds your level in damage | fact |
| content:ABILITIES.mark.txt | study it: every strike on the target adds +2 for the rest of the fight | … adds +2 damage for the rest of the fight | fact |
| content:JEWELRY.Anklet of Invisibility.txt | used, foes need two better to land a blow on you for fifty squares; then fifty squares back in plain sight | used, for fifty squares every foe has two fewer faces that hit you; then fifty squares back in plain sight | roll-under |
| content:CLOAKS.Cloak of Invisibility.txt | invisible for 50 squares, once every 100 | invisible for 50 squares, once every 100: foes hit you only on their die's top face (the top two faces if you insulted them) | roll-under, fact |
| content:STAVES.Crystal Staff.txt | party invisible d10+5 squares; enemies need a 1 | party invisible d10+5 squares: foes hit only on their die's top face (the top two faces if you insulted them) | roll-under |
| content:POTIONS.Invisible.txt | invisible for a day | invisible for a day: foes hit you only on their die's top face (the top two faces if you insulted them) | fact |
| raw:engine/items.js#rollTreasureItem | 1–5 on d10 against any lock | 6–10 on d10 against any lock | roll-under |
| raw:engine/economy.js#openStore (two literals) | 1–5 on d10 against any lock; opens boxes on 1–5 | 6–10 on d10 against any lock; opens boxes on 6–10 | roll-under |
| content:BESTIARY.Zit.sp.note | acid; hittable only on a 4 | acid; at best your die's top four faces hit it | roll-under |
| content:BESTIARY.Stink Bug.sp.note | small: strike as one level lower, 2 to hit | small and slippery: at best your die's top two faces hit it | roll-under, accurate |
| content:BESTIARY.Pogo.sp.note | +4 damage, and fast — strike one higher | +4 damage, and fast: your die has one face fewer that hits it | roll-under |
| content:BESTIARY.Trachea.sp.note | +4 on its first hit; fighters do double to it | a d10 bite; fighters do double to it | accurate |
| content:LEAP_TABLE.0–3.ft | 3-4 feet, 5-8 feet, 8-12 feet, 12-15 feet | 3–4 feet, 5–8 feet, 8–12 feet, 12–15 feet | hygiene |

The engine files changed only in string literals:

```diff
# engine/items.js#rollTreasureItem
-    return { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" };
+    return { kind: "picks", n: "Lockpicks", txt: "6–10 on d10 against any lock" };
# engine/economy.js#openStore
-    add("Set of lockpicks", 450, "giveLockpicks", { item: { kind: "picks", n: "Lockpicks", txt: "1–5 on d10 against any lock" } }, "opens boxes on 1–5");
+    add("Set of lockpicks", 450, "giveLockpicks", { item: { kind: "picks", n: "Lockpicks", txt: "6–10 on d10 against any lock" } }, "opens boxes on 6–10");
```

Every other string in the 79-05 worklist (about 250 entries: spells,
potions, tools, bags, foe abilities, afflictions, the Faerie and madness
tables, niche labels, the rest of the bestiary) was judged against the
rubric and passes, so it stays word for word. Three notes on that
judgement: the Faerie gift strings ("-d10 Base HP" and the rest) are
engine keys that `engine/encounters.js#meetFaerie` compares by value, so
they cannot be reworded as text; the Death potion's "your dead!" reads the
same aloud and is the prototype's own line; and bestiary notes that describe
canon flags the engine keeps as flavour (poison, awe, song and so on) are
the foe's canon description, not narration of an event, so they stay.

## The authored-range rows (test/unit/authored-ranges.test.js, 31 tests)

- **Why faces:** `strikeDie` (hero, levels 1–5) and `foeDie` (foe levels
  1–5) each return more than one die, so those rows speak in faces.
- **Top face, plain and insulted** (`foeSwingVsHero` with and without
  `parleyInsulted`): Mirror Self, Smoke (ability and skill), the Crystal
  Staff, Cloak of Invisibility and Invisible potion: 1 face, 2 insulted.
- **Weaken:** `foeSwingVsHero` with `foeToHitPenalty: 3` across a plain,
  Guard, Acrobat and Mirror Self hero: never above 3, never raised.
- **Two fewer faces** (`foeToHitVs` with and without the live timer):
  Battle Roar (ability and skill), Sidestep (ability and skill), the Anklet.
- **Overhead Blow:** a real `useAbility` strike's `overhead` mod (−2).
- **Stealth:** real opening strikes walked down from the top face: the
  stealthStrike fires on the top two faces only.
- **Locks and Lockpicks** (fixed d10): a real `openChest`'s
  `chestLockRolled` atLeast/dieN through `facesRangeText`: Locks tier 1 and
  Lockpicks 6–10, tier 2 4–10; the found item (`rollTreasureItem`) and the
  store row (`openStore`, item txt and `sub`) both checked.
- **Bestiary:** Zit (4) and Stink Bug (2) via `targetStrikeFaces` against
  `sp.toHit`; Pogo's `fast` takes one face.
- **Signed numbers:** Wolf +2, Gremlin +3, Pogo +4, Rast +4, Strength
  potion +8, Ring of Power +1, Enlarge and the Gauntlet +2 (size step),
  Heft +2 (`weaponDamage`), Mark +2 (a real marked strike); every signed
  number in any bestiary note must equal that foe's `sp.dmg.bonus` (this is
  what caught the Trachea's "+4 on its first hit").

## Parity measurement and carve-outs

- Before the carve-out: 63 of 66. The only diff: the economy fixture's
  declared end-state `after.items[2].txt` (a bought set of Lockpicks).
- `REWORDED_TXT_ITEMS` gains "Lockpicks", "Crystal Staff", "Cloak of
  Invisibility", "Invisible potion" and "Invisible potion (clear)";
  `declaredEndDiffs` compares the engine side's `after` through
  `stripCloakArmorTxt`. After: **66/66**.
- `test/parity/fixtures` and `prototype-master.js.txt` are byte-identical
  (`git diff --quiet d39625ee` exits 0; master hash `a1f4d0dc…`).
- **State pins:** `roll-high-state-pins.test.js` `party-fighter-knight`
  (ends holding an Invisible potion (clear)) and `deep-8` (ends holding
  Lockpicks) re-pinned. Traced: putting the old txt back into each final
  state re-hashes to the old pin; actions/dead/depth unchanged. The
  pre-switch save's `expected` was not re-recorded.
- Recorded under `### Plan 79-05` at the end of
  `test/parity/FIXTURE-INVENTORY.md`.

## Regenerated snapshots

Regenerated with `MZ_SNAPSHOT_UPDATE=1 node --test
test/unit/shell-tab-snapshots.test.js`; `mu.gear.txt` changed only by CRLF
noise and was restored.

| Snapshot | Text that moved |
|---|---|
| mu-store.store.txt | the Set of lockpicks row (6–10 on d10) |
| thief-store.store.txt | the Set of lockpicks row (6–10 on d10) |
| mu.hero.txt | Mirror Self in the grimoire |
| thief.hero.txt | Smoke |
| thief.gear.txt | Anklet of Invisibility |
| thief.gear-sheet-bag.txt | Anklet of Invisibility |
| thief.gear-sheet-worn.txt | Anklet of Invisibility |

## Re-pinned tests

- `test/unit/abilities-catalog.test.js`: CATALOG_TXT (sidestep,
  battleRoar, overheadBlow, feint, smoke, mark) and KEPT_TXT/`txt2`
  (Stealth, Locks), each with a "VOX-05/ROLL-04 (79-05)" comment.
- `test/unit/roll-high-state-pins.test.js`: two hashes (above).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The leap labels' en dash broke the climb card's parser**
- **Found during:** Task 2
- **Issue:** `src/browser/rollOdds.js#gapText` parsed the LEAP_TABLE label
  with a hyphen-only regex, so an en-dash label would have printed raw
  ("3–4 feet" instead of "3–4 ft") on the climb card.
- **Fix:** the regex reads the U+2013 dash (a one-character change plus its
  comment); the file is outside this plan's list but no sibling owns it.
- **Commit:** 8ac2ec2d

**2. [Rule 3 - Blocking] The economy fixture's declared end-state pins the Lockpicks text**
- **Found during:** Task 2
- **Issue:** the fixture file may not change, but its declared `after`
  record holds the old Lockpicks txt.
- **Fix:** `declaredEndDiffs` strips `REWORDED_TXT_ITEMS` txt on the
  engine side (the named carve-out, applied to the declared record too).
- **Commit:** 8ac2ec2d

**3. Scope: Bat/Rat and Viper "wp" reverted (hygiene count is 2, not 0)**
- **Found during:** Task 3 (npm test)
- **Issue:** both are Phase 18 D-14 fixture-exposed rows pinned
  byte-identical to the prototype in `test/unit/content-tables.test.js`
  (owned by same-wave 79-06), and `test/unit/foeDetails.test.js` expects the
  foe card's R-16 translation to print "1 HP each" / "2 HP a round" from
  the "wp" source. The player-facing card already reads HP.
- **Action:** reverted to the base text (Task 3 commit) and handed on
  (below). `node tools/voice-inventory.mjs --owner 79-05 --roll-under
  --hygiene --safety --count` prints **2**: exactly these two
  `standalone-wp` hits. Roll-under and safety are 0.

**4. Mark, Feint, the Trachea and the Invisible potion (VOX-05 rubric fixes).**
Not in the handoff list; each failed rubric 1 or 4 and is ledgered.

## Handed on

- **content:BESTIARY.Bat/Rat.sp.note, content:BESTIARY.Viper.sp.note** ("wp"):
  to 79-12. The only pins sit in `test/unit/content-tables.test.js` (79-06,
  same wave; Phase 18 D-14 byte-identity) and `test/unit/foeDetails.test.js`
  (the card's R-16 wp→HP translation, 79-07's surface). Either re-pin D-14
  and drop the translation, or add the two keys to the hygiene exceptions.
- **content:STAVES.Crystal Staff.txt "party invisible":** to the
  Joiner-defences engine fix and 79-12. Today a member is protected only
  because `foeToHitVs(state, "member")` reads the hero's own invisibility.
  If the fix makes invisibility hero-only, "party" must be reworded; if it
  keeps the staff party-wide, the text stands. The authored-range test pins
  the hero side only, so it holds either way.
- **docs/ABILITIES.md, docs/SPELLS.md** still quote the old catalog lines
  (no test syncs them): to 79-12's doc sweep.

## Known Stubs

None.

## Commits

- `a8ed234c` test(79-05): add failing authored-range pins for the ROLL-04 content handoffs
- `75eeb44e` feat(79-05): rewrite the ROLL-04 content handoffs to the roll-high reading
- `8ac2ec2d` feat(79-05): leap labels take the range dash; carve out the reworded item text
- `c80a6bc1` test(79-05): re-pin the reworded texts, regenerate named snapshots, write the ledger

## Verification

- `node --test test/unit/authored-ranges.test.js`: 31/31.
- `node tools/voice-inventory.mjs --owner 79-05 --roll-under --count`: 0;
  `--safety`: 0; `--twins`: 0; `--hygiene`: 2 (the two handed-on "wp" notes).
- `node tools/voice-inventory.mjs --check-ledgers --plan 79-05 --after --coverage`: 0 errors;
  `node --test test/unit/voice-corpus.test.js`: 27/27.
- `node --test "test/parity/**/*.test.js"`: 66/66; fixtures and the prototype master untouched.
- `npm test` (`node --test`): **7377/7377**.

## TDD Gate Compliance

RED `a8ed234c` (test), GREEN `75eeb44e` and `8ac2ec2d` (feat). No refactor commit.

## Self-Check: PASSED

- FOUND: test/unit/authored-ranges.test.js, docs/narrative-pass/why/79-05.json,
  test/parity/harness/comparables.js (REWORDED_TXT_ITEMS), this SUMMARY.
- FOUND commits: a8ed234c, 75eeb44e, 8ac2ec2d, c80a6bc1.
