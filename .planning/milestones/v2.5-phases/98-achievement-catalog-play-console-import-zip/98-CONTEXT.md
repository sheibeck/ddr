# Phase 98: Achievement Catalog & Play Console Import Zip - Context

**Gathered:** 2026-10-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The phase delivers the achievement catalog that every later phase reads, plus the Play Console import zip built from it.

- **The catalog:** one pure-data content module holding all **77** achievements. The user dropped Disposable Help in this discuss (see Scope change), so the count fell from 81.
- **The tool:** a repo command builds `AchievementsMetadata.csv`, `AchievementsIconsMappings.csv` and the 77 icons into a zip. A validator checks that zip against Google's rules, and a test exercises the validator.
- **The docs:** `docs/ACHIEVEMENTS.md` explains how to rebuild, import, test, publish and fetch the IDs file.
- **The hand-off:** the phase ends by handing the user the zip and a readable copy table.
- **Out of scope:** the engine and the shell. Tracking is Phase 99, the toast and the ☰ list are Phase 100, and the Play mirror is Phase 101.

</domain>

<decisions>
## Implementation Decisions

### Scope change: Disposable Help is dropped (user, this discuss)
- Summons cannot die in the engine. A summon times out mid-fight (`allyDeparted`), is unmade by a scroll fumble (`fumbleOnSide` with `who: "ally"`), or vanishes when the fight ends. Offered ways to count a "fallen summon", the user chose to drop the achievement.
- **77 achievements ship.** That is 13 tiered tracks of four tiers each (52), the 3-tier depth ladder, and 22 single achievements: 52 + 3 + 22 = 77.
- **The icons:** the four `disposable_help` exports leave `achievements/manifest.json`, and their files leave `play/`, `ingame/` and `master/`.
  - The exports can be rebuilt by script, so removing them loses nothing.
  - The source picture stays in `achievements/sources/` in case summons ever become killable.
  - `build_achievements.py` must stop emitting the four files. Regenerate `contact_sheet.png` if Pillow, NumPy and SciPy are available here; otherwise note it as stale.
- **Docs:** REQUIREMENTS.md, ROADMAP.md and PROJECT.md already say 77 (updated with this context): ACH-01, TRACK-01, TRACK-03, ZIP-01 and the Phase 99/100 text.

### Points (ACH-03)
Google's rules, checked 2026-10-05 at developer.android.com/games/pgs/achievements:
- each achievement is worth 5–200 points, in multiples of 5;
- a game can have at most **2,000** points;
- Play awards XP of 100 × points.

**Total: 1,200 points, which leaves 800 for the future brainstorm set** (quick 261005-opm, user 2026-10-05) (was 1,110 and 890).

| Group | Achievements | Points | Subtotal |
|---|---|---|---|
| Tiered tracks (13 × 4 tiers = 52) | Frequent Flier; Body Count: Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead; Survivor; Hoarder; Party Animal; Human Shields; Silver Tongue; Still Standing | I 5 · II 10 · III 15 · IV 25 (55 per track) | 715 |
| Depth ladder | floors 5 / 10 / 15 | 10 / 20 / 30 | 60 |
| Unicorn! | floor 20 | 100 | 100 |
| Races | Human, Elven, Dwarven, Wilmsry, Fridgian, Troll to floor 10 | 20 each | 120 |
| Classes | Magic User, Fighter, Thief to floor 10 | 20 each | 60 |
| Tourist | all 24 sub-classes | 30 | 30 |
| Run feats | Fully Dressed 10 · Teetotaler 15 · Chicken 15 · Naked Ambition 25 | | 65 |
| Deaths and oddities | Special Snowflake, Read the Label, Fatal Misstep, Gravity Wins, Empty Calories 5 each · Solid Miscalculation 10 · Terminal Condition 15 | | 50 |
| **Total** | **77** | | **1,200** |

Count check: 52 + 3 + 1 + 6 + 3 + 1 + 4 + 7 = 77. Headroom: 2,000 − 1,200 = 800. The races and classes moved from floor 5 at 10 points to floor 10 at 20 points (quick 261005-opm, user 2026-10-05).

### Types (ACH-05: Play cannot change a type or an initial state once published)
- **Incremental, 57 entries:**
  - The 11 lifetime-count tracks: Frequent Flier, the six Body Counts, Party Animal, Human Shields, Silver Tongue and Still Standing (44 entries). Each tier is its own incremental achievement whose steps equal its threshold; for example, Body Count: Beasts II needs 100 steps. Phase 101 decides between increment and set-steps-at-least for the lifetime count.
  - The single-run bests (12 entries): Survivor I–IV (days), Hoarder I–IV (wilmst held at once), the depth ladder I–III and Unicorn!. Each one's steps are its threshold, sent as "set steps at least" the best single-run value, so Play shows progress such as "7 / 10".
  - Hoarder IV's 10,000 steps sit exactly on Play's cap.
  - Tourist (1 entry): 24 steps, one per distinct sub-class delved.
- **Standard, 20 entries:**
  - the 6 races and the 3 classes;
  - Fully Dressed, Naked Ambition, Teetotaler, Read the Label and Special Snowflake;
  - Solid Miscalculation, Gravity Wins, Terminal Condition and Empty Calories;
  - Chicken and Fatal Misstep.
- None of the 8 hidden achievements is incremental.

### Names
- **Tier names are the track name plus a Roman numeral**, matching the I–IV drawn on the icons: "Frequent Flier III", "Body Count: Beasts IV", "<depth ladder name> II". Names must be unique, contain no commas, and stay within 100 characters.
- **The user's names are kept verbatim:**
  - Unicorn!, Fully Dressed, Naked Ambition, Teetotaler, Read the Label;
  - Frequent Flier, Special Snowflake, Body Count: <group> (×6), Tourist;
  - Survivor, Hoarder, Party Animal, Human Shields;
  - Solid Miscalculation, Gravity Wins, Terminal Condition, Empty Calories;
  - Silver Tongue, Chicken, Fatal Misstep, Still Standing.
- **Claude writes names in the house voice where the manifest only has a placeholder:**
  - the depth ladder (manifest "Depth");
  - the 6 races (manifest "Human", "Elven", ...), for example "Human Error";
  - the 3 classes (manifest "Magic User", "Fighter", "Thief").
  - These are reviewed with the rest of the copy at the hand-off.

### Hidden achievements and who reveals them (ACH-04)
- **8 start Hidden:** Naked Ambition, Read the Label, Fatal Misstep, Empty Calories, Gravity Wins, Solid Miscalculation, Terminal Condition and Chicken. **The other 69 start Revealed**, Special Snowflake and Unicorn! included.
- **Amended 2026-10-05 (quick 261005-vn5): Special Snowflake now starts Hidden, so 9 start Hidden and 68 start Revealed.** It is revealed by a death, not by a revealer entry: the catalog field `revealOn: { kind: "realDeath" }` reveals it on the player's first real death that does NOT earn it (a death on floor 2 or deeper; abandons never count), and that death screen shows one sarcastic hint line about floor 1 that never names it. Unlocking it directly (a floor-1 death) still reveals it. The user flipped it to Hidden by hand in the Play Console draft the same day. Points, type and copy are unchanged.
- When a revealer unlocks, it reveals its hidden achievement, both in game and in Play (`revealAchievement`). A hidden achievement can still be earned directly before it is revealed.

| Revealer (when it unlocks) | Reveals | Why the hint is true |
|---|---|---|
| Fully Dressed | Naked Ambition | The user's own example: every slot filled, so try none |
| Teetotaler | Read the Label | Potions |
| Still Standing I | Fatal Misstep | Traps |
| Survivor I | Empty Calories | Days, then rations |
| Depth I | Gravity Wins | The long way down |
| Gravity Wins | Solid Miscalculation | A chain: falling into the floor, then walking into the rock |
| Frequent Flier I | Terminal Condition | Fifty deaths, and Disease and Poison take their time |
| Silver Tongue I | Chicken | When words fail, feet work |

### Two lines per achievement
- **`description`** is Play copy. It says what earns the achievement, in the house voice.
  - No commas: Play's CSV has no quoting.
  - At most 500 characters.
  - Numbers are allowed (thresholds) but are written without thousands separators: "2000 wilmst", never "2,000".
  - It uses the player's words: wilmst, floor, Joiner, Walking Dead.
  - It freezes when the user imports the zip.
- **`line`** is the in-game unlock line, shown in the toast and the list. It is sarcastic.
  - A revealer's line carries the hint toward the hidden achievement it reveals.
  - It is never sent to Play, so it can be reworded later. Commas are allowed.
  - The user's line for Special Snowflake is "You're a special snowflake."
- Both fields pass the safety scan and the voice inventory checks: roll-under, hygiene and safety counts stay at 0.

### List order (shared by the zip and the in-game list)
Themed blocks, with each track's tiers kept together and each hidden achievement placed right after its revealer:
1. **The descent:** depth ladder I, II, III; Unicorn!; Gravity Wins; Solid Miscalculation
2. **Dressing for it:** Fully Dressed, Naked Ambition, Teetotaler, Read the Label
3. **Who you are:**
   - the races, in `content/races.js` order: Human, Elven, Dwarven, Wilmsry, Fridgian, Troll;
   - the classes: Magic User, Fighter, Thief;
   - Tourist.
4. **Staying alive:** Survivor I–IV, Empty Calories, Hoarder I–IV, Still Standing I–IV, Fatal Misstep
5. **Company:** Party Animal I–IV, Human Shields I–IV, Silver Tongue I–IV, Chicken
6. **Body counts**, in `BESTIARY` key order: Beasts, Demons, Humans, Lair Beasts, Magical, Walking Dead, each I–IV
7. **Dying:** Frequent Flier I–IV, Terminal Condition, Special Snowflake

Block sizes: 6 + 4 + 10 + 14 + 13 + 24 + 6 = 77.

### What counts (the rulings each description must stay true to; Phase 99 implements them)
- **Body counts:** every foe that dies in the hero's fights counts, whoever struck it: the hero, a Joiner or a summon. **Walking Dead destroyed by Turn Undead also count.** `walkingDeadTurned` sets them `alive = false` and `turned = true` and emits no `foeKilled`.
  - The group is the `content/bestiary.js` `BESTIARY` family key.
  - Thresholds are 50, 100, 200 and 500.
- **Human Shields:** both kinds of Joiner death count: a Joiner who falls in a fight (`memberDowned`) and one a Cutthroat murders on the stairs (`joinerMurdered`). Thresholds are 5, 10, 25 and 50, counted across all delves.
- **Teetotaler:** reach floor 5 in one run without the hero drinking a healing potion.
  - Only the hero's own healing potion (`potionDrunk`) breaks it.
  - A Joiner drinking theirs (`memberPotionDrunk`) does not break it.
  - The magic potions (Strength, Acuteness and the rest) do not break it.
- **Chicken:** win 10 flee rolls in a single run.
  - **Only a won flee roll counts** (`fled` with reason `escaped`).
  - These escapes do not count: the door illusion (`door`), the Cloaker's vanish (`cloaker`), a Fighter's clean round-1 withdrawal (`tracked`), and Smoke (`smoke`).
  - The copy must not promise "any escape".
- **Abandon is not a death.** ABANDON THIS CHARACTER ends the run through `die(state, "abandon")`. It does not count for Frequent Flier or Special Snowflake. **It still counts as a delve started for Tourist.**
- **Fully Dressed:** all five equipment slots are filled at the same moment:
  - a weapon (not Fists);
  - armor (not "Nothing");
  - `jewelry1`;
  - `jewelry2`;
  - the cloak.
- **Naked Ambition:** all five slots are empty at the hero's first step (weapon Fists, armor "Nothing", no jewelry, no cloak), and none is filled again before floor 5. Bag items and the torch do not count.
  - Verified achievable: the Gear sheet offers UNEQUIP on every worn slot (`src/browser/gearSheet.js:221`; `engine/items.js:1097` `unequipSlot` handles the weapon, the armor, both jewelry slots and the cloak).
  - Unequipping moves the piece into the bag, so a full bag blocks it until the player drops something. The combat gear lock blocks it during a fight.
- **The rest of the definitions** (restated from backlog 999.12; the user settled "level" as floor depth):

| Achievement | Definition |
|---|---|
| Depth ladder | Reach floor 5 / 10 / 15 (`state.floor.depth`) in a run |
| Unicorn! | Reach floor 20 |
| Races and classes | Reach floor 10 with that race, or with that parent class (quick 261005-opm, user 2026-10-05) |
| Tourist | Start a delve with each of the 24 sub-classes; depth doesn't matter |
| Survivor | Live 10 / 25 / 50 / 100 days in one run (`state.day`) |
| Hoarder | Hold 2000 / 5000 / 8000 / 10000 wilmst at once in one run. These are the bag caps for small, medium, large and the largest bag. Spending never counts against it |
| Party Animal | Accept 10 / 25 / 50 / 100 Joiners, counted across all delves |
| Silver Tongue | Win 10 / 25 / 50 / 100 parleys (`parleyWon`), counted across all delves |
| Still Standing | Survive 10 / 25 / 50 / 100 traps: each `trapSprung` that does not end in a `trap` death, counted across all runs |
| Frequent Flier | Die 50 / 100 / 200 / 500 real deaths, counted across all runs (abandons excluded) |
| Special Snowflake | Any real death on floor 1 |
| Read the Label | Death cause `potion` (the Death potion) |
| Fatal Misstep | Death cause `trap` |
| Gravity Wins | Death cause `fall` or `gorge` |
| Empty Calories | Death cause `starve` |
| Solid Miscalculation | Death cause `entombed` |
| Terminal Condition | Two lifetime flags: Disease has once left the hero on exactly 1 HP, and Poison has once left the hero on exactly 1 HP (`afflictionCaught` or `afflictionTick`), in any runs. It is not a death |

### Copy review and the freeze (user, this discuss)
- **There is no mid-phase review pause.** Claude drafts all 77 names, descriptions and lines inside the phase. The automated checks are the in-phase gate: the safety scan, the voice inventory, and Play's limits in the validator.
- **The user reads the copy at the hand-off.** The phase hands over the zip together with a readable table of every name, description and line, in list order, showing points, type, steps, initial state and the reveal pairs.
  - If the user asks for changes, edit the catalog and rebuild the zip.
  - The freeze takes effect when the user imports the zip into Play Console as a draft.

### Claude's Discretion
- **The catalog module:** `content/achievements.js`, pure data with no function leaves, so it passes `test/determinism/content-is-pure-data.test.js`.
  - Fields per entry:
    - `id`, `name`, `description`, `line`;
    - `trigger`, `threshold`, `tier` (1–4 or null);
    - `points`, `initialState` (`"Hidden"` / `"Revealed"`), `type` (`"standard"` / `"incremental"`);
    - `steps` (incremental only), `reveals` (the ids it reveals);
    - `listOrder`, `icon` (the manifest entry or its paths).
  - Stable ids follow the icon stems, for example `depth_t1`, `kills_beasts_t3`, `unicorn`, `ether_entombed`.
- **The trigger shape:** declarative data drawn from a small closed vocabulary that Phase 99's tracker interprets. The kinds are: lifetime counter, single-run best, single-run flag, death cause, lifetime flag pair, and distinct-set count. A test pins the vocabulary and checks that every trigger uses it.
- **The zip tool:** `tools/achievements-zip.mjs`, using Node built-ins only and no new dependency (the zero-SDK rule).
  - Write the zip container by hand with `zlib.deflateRawSync` (or the stored method) and `zlib.crc32`; Node 22 has both.
  - Use fixed timestamps so rebuilds are byte-identical.
  - Write the output to a git-ignored path (for example `build/achievements/`), and add that path to `.gitignore`.
  - Offer a `--check` / validate mode. The validator re-reads the built zip: it parses the central directory, checks every rule in ZIP-02, and reads each PNG's IHDR to confirm 512 × 512.
  - The test builds into a temp dir and also proves that the validator fails on deliberately broken inputs.
- **Icon file names in the zip:** the existing unique `ach_*.png` names from `achievements/play/`.
- **List Order values:** either 1..77 or spaced (for example × 10, to leave room for later imports). This is the planner's call.
- **Voice coverage:** register the catalog's names, descriptions and lines explicitly.
  - Add them to the safety scan's `collectAuthoredStrings` in `test/voice/safety-scan.test.js`. Its own comment warns that new content banks are NOT auto-discovered.
  - Add a row to `tools/lib/voice-corpus.mjs` `BANK_REGISTRY` so the voice inventory covers them. The surface choice is the planner's.
- **The plan split and wave shape.** Expect 2–3 plans: (1) the catalog, the manifest trim and the voice registration; (2) the zip tool, the validator test and `docs/ACHIEVEMENTS.md`; then the hand-off.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `achievements/` holds:
  - `manifest.json`: entries of `{ id, name, tier, file_play, file_ingame }`; 81 today, 77 after the trim;
  - `play/`: 512 × 512 opaque PNGs;
  - `ingame/`: 144 × 144 transparent PNGs;
  - `master/`, `sources/` (37 pictures) and `frames/` (the four tier overlays);
  - `build_achievements.py` (needs Pillow, NumPy and SciPy), `contact_sheet.png` and `README.md`.
- `content/safety-wordlist.js` and `test/voice/safety-scan.test.js`. Banks are registered explicitly in `collectAuthoredStrings`, around line 325.
- `tools/lib/voice-corpus.mjs` (`BANK_REGISTRY`, `SURFACES`) and `tools/voice-inventory.mjs`. The roll-under, hygiene and safety counts must stay at 0.
- Content the definitions read:
  - `content/bestiary.js` `BESTIARY`, the six groups;
  - `content/races.js`, six races;
  - `content/classes.js` `CLASSES[...].subs`, 24 sub-classes;
  - `content/epitaphs.js`, the death causes;
  - `content/bags.js`, the bag wilmst caps of 2000 / 5000 / 8000 / 10000;
  - `content/potions.js`, the Death potion.
- Node 22 built-ins: `zlib.deflateRawSync`, `zlib.crc32`, `fs`, `path`.
- Tool conventions to copy: `tools/patch-notes.mjs` and `tools/narrative-review.mjs` (Node built-ins only, a `--check` mode, and `--root <dir>` for tests).

### Established Patterns
- Content modules are pure data with a header comment explaining their scope. Tests pin counts and field shapes.
- The player-facing currency is **wilmst** (the HUD shows WILMST). The copy must say wilmst, not "coin" or "gold".
- Greenfield: no legacy paths and no dual-path code.
- Executors run targeted tests only. The orchestrator runs the full `npm test` once at phase close.
- Commits are plain `git commit` with the attribution trailers.

### Integration Points
- **Phase 99** (tracker) reads each entry's `trigger`, `threshold`, `type`, `steps` and `reveals`.
- **Phase 100** (toast and ☰ list) reads `name`, `line`, `listOrder`, the `ingame/` icon, `initialState` and the reveal pairs.
- **Phase 101** (Play mirror) maps a catalog id to a Play ID. It goes through the Get resources XML, whose resource names derive from the achievement names, so names must stay unique and unchanged after import.
- **Play Console** receives the zip. The user imports it as a draft.

</code_context>

<specifics>
## Specific Ideas

- **Special Snowflake's line** is the user's own: "You're a special snowflake."
- **Fully Dressed's line** hints at Naked Ambition. This is the user's design-principle example for hint chains.
- **Hoarder's tiers** are the bag caps, so each tier needs that bag or a bigger one.
- **The Play import path:** Grow users > Play Games Services > Setup and management > Achievements > Import achievements, then Save as draft.
- **Google's import rules,** checked 2026-10-05 at developer.android.com/games/pgs/integrate-achievements:
  - The zip has no subdirectories, unique file names, only CSV and PNG/JPEG files, and no header rows.
  - Each file is under 1 MB, there are at most 403 files, and the whole zip is under 800 MB.
  - Metadata rows hold 7 values in this order: Name, Description, Incremental value, Steps Needed, Initial State, Points, List Order.
  - Mapping rows hold 2 values: Name, icon filename.
  - The values are spelt `True` / `False` and `Hidden` / `Revealed`, and Steps is filled only when incremental.
  - Name and Description contain no commas; the name is at most 100 characters and unique, and the description at most 500.
  - Icons are 512 × 512. Play generates the greyed locked version itself, and its toast crops the icon to a circle (the built icons already allow for that).
  - `AchievementsLocalizations.csv` is optional and not used: the game is English only.
- **Lifetime caps:** at most 400 achievements over the game's life. 77 now leaves room for the brainstorm set.

</specifics>

<deferred>
## Deferred Ideas

- **Disposable Help (fallen summons).** Dropped. Revisit only if summons ever become killable, which is a rules change. The source picture stays in `achievements/sources/`.
- **The brainstorm set** (Well-Rounded, Friendly Fire, Bomb Squad and the rest, in backlog 999.12) stays future work: new art, a later import, and the 800-point headroom.
- **Decisions for later phases:** how increments are sent (Phase 101), the toast and list shape (Phase 100), and the stats record's shape (Phase 99).

</deferred>
