---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 04
subsystem: ui
tags: [flavour, condition-chips, text-layer, narrative-review]

requires:
  - phase: 96-03
    provides: the ability and skill domains (13 domains, 175 keys), flavorOfAbility, the ledger flow
provides:
  - CHIP_FLAVOR (47 lines: the 42 HERO_CONDITIONS keys plus 5 variant keys) in content/flavor.js
  - the chip domain (14 domains, 222 content keys), CHIP_FLAVOR_VARIANTS, flavorOfChip
  - test/unit/chip-flavor.test.js, which ties every shell chip explanation to a flavour line
  - y-96-04.json (47 new-line ledger rows) and the regenerated review pages
affects: [96-07 chip tap cards, 96-08 review]

tech-stack:
  added: []
  patterns:
    - "A shell-only table is guarded by reading mazeworld.html as text (brace-matched literal slicing) so the test cannot go vacuous: each table is asserted found with a minimum key count"
    - "Variant keys use a slash (foeEffect/dazed, haste/Speed of Sound), matching the spell Open/Lock key scheme"

key-files:
  created:
    - test/unit/chip-flavor.test.js
    - docs/narrative-pass/why/y-96-04.json
  modified:
    - content/flavor.js
    - src/browser/flavorText.js
    - test/unit/flavor-layer.test.js
    - test/unit/flavor-text.test.js
    - tools/lib/voice-corpus.mjs
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html

key-decisions:
  - "flavorOfChip only resolves keys that are HERO_CONDITIONS keys: a variant key passed as cn.key, the shell's `default`, and Object.prototype names all read empty"
  - "An ability chip reads the ability's own line (96-03) and falls back to the chip's `ability` key line only for an unknown or missing id"

patterns-established:
  - "Harmful chip lines name the trouble in plain words (nasty, rattled, weakly, burning, out of action) and carry the ledger reason 'accurate'; a timed buff is worded as passing (for now, on loan, until the magic is spent)"

requirements-completed: [FLAVOR-04, FLAVOR-06]

coverage:
  - id: D1
    description: "47 chip lines exist, one sentence, at most 100 characters, number-free, safe, unique across the layer, never equal to their explanation sentence"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/flavor-layer.test.js; test/unit/chip-flavor.test.js; test/voice/safety-scan.test.js; test/voice/narrative-hygiene.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "A new chip explanation (CONDITION_EXPLAIN key, FOE_EFFECT_EXPLAIN, HERO_OUT_EXPLAIN, HASTE_SPELL_EXPLAIN, the mirror ward branch) cannot ship without a flavour line, and CHIP_FLAVOR_VARIANTS equals the derived set"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/chip-flavor.test.js (Tests 1 and 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "flavorOfChip resolves every chip shape and returns empty for malformed, unknown and hostile descriptors"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/chip-flavor.test.js (Test 3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The shell tables, HERO_CONDITIONS and every chip guard are byte-identical"
    requirement: FLAVOR-04
    verification:
      - kind: unit
        ref: "test/unit/hero-conditions.test.js; status-chit-combat.test.js; authored-ranges.test.js; item-text-wording.test.js; spell-skill-text-wording.test.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "The 47 lines read well, a harmful chip still tells the player something is wrong, a timed buff does not read as lasting"
    requirement: FLAVOR-06
    verification: []
    human_judgment: true
    rationale: "Voice and honesty against the explanation are judgments the scans cannot make; the 96-08 reviewer and the user's read of review.html decide"

duration: 30min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 04: Condition-chip flavour Summary

**47 one-sentence player lines for every condition chip (42 HERO_CONDITIONS keys plus 5 kind- or source-specific variants), the `chip` domain and a `flavorOfChip` resolver, a test that reads the shell's explanation tables so no chip explanation can ship without a line, all ledgered and on the review page. Nothing on screen changes yet (96-07 puts the line first on each chip tap card with the exact text behind RULES).**

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `cd9dc688` | CHIP_FLAVOR (47) in content/flavor.js and its BANK_REGISTRY row |
| 2 | `7df8d14f` | CHIP_FLAVOR_VARIANTS, flavorOfChip, the chip domain, chip-flavor.test.js, declared re-pins, non-copy registration |
| 3 | `f7e502cb` | y-96-04.json (47 rows) and the regenerated review pages |

## The 47 lines

| Key | Line | Chars |
| --- | ---- | ----- |
| haste | Quick enough that the rest of the round looks like it is wading through porridge. | 81 |
| invis | The foes are attacking a spot you just left, and cannot work out why it keeps happening. | 88 |
| acute | Your aim has sharpened into something faintly unfair, and the maze has noticed. | 79 |
| ether | Walls are optional for now, so choose where you stand before the rock starts caring again. | 90 |
| enlarge | Grown well past your size by magic, which is wonderful for swinging and awful for hiding. | 89 |
| giant | A giant's gauntlet lends you stature: bigger blows, and a bigger thing for the foes to aim at. | 94 |
| glow | You glow like a nightlight with ambitions, so the dark has no say in how you swing. | 83 |
| unseen | Foes can only just make you out, which spoils their aim a little and their mood a lot. | 86 |
| tongue | You speak every tongue the maze has, which helps whenever the foes can be talked to at all. | 91 |
| critWard | Luck worn like armour: the foe's very best swing lands as merely a rude one. | 76 |
| plate | Your cloak does a fair impression of plate armour, without the clanking or the repair bills. | 92 |
| power | A ring's idea of generosity: every swing lands with a little extra on it. | 73 |
| lit | A lit torch in your fist, so the dark can wait its turn to ruin your aim. | 73 |
| knit | The cloak is slowly stitching you back together, provided you keep walking and stop dawdling. | 93 |
| flight | Off the ground and above the problem, for exactly as long as the magic holds up. | 80 |
| strength | Muscle on loan, and every strike and spell that connects gets to spend it. | 74 |
| unlock | The next locked chest gives in at a touch, and then the magic is spent. | 71 |
| enchant | A charm over you: you swing true, they swing wild, and nobody gets a lucky strike. | 82 |
| ability | One of your tricks is still running, with the particulars on the ability itself. | 80 |
| might | Strong in a way you did not plan, whether from a potion or a temper, so hit something. | 86 |
| ward | Borrowed hit points stand between you and the blows, right up until they run dry. | 81 |
| mirror | A flickering second you, so foes swing at the wrong one and mostly hit the air. | 79 |
| senses | Every living thing nearby tickles your nerves, so darkness and ambushes matter far less. | 88 |
| regen | Your body has decided to heal as you go, for this fight at least, and asked no permission. | 90 |
| foresight | A twinge of warning means you get the first move when trouble next turns up. | 76 |
| reveal | The whole floor lies open to you, but only while you stand still and keep staring. | 82 |
| braced | Ready for the next hit and almost looking forward to it, which takes much of the sting out. | 91 |
| halfNext | Your pendant is lined up to soften the next blow that lands, and fully expects credit. | 86 |
| nightVision | Born with eyes for it, you treat the dark as scenery and fight in it without complaint. | 87 |
| itemCooldown | The item is sulking after its last use and will come round if you keep walking. | 79 |
| staffCharges | The staff is topping up its magic, slowly, and does not care to be hurried. | 75 |
| affliction | Something nasty in the blood nibbles at you with every step, though never quite finishes the job. | 97 |
| foeEffect | Something nasty a foe did to you is hanging about, though it will not stay long. | 80 |
| darkness | The dark has closed in, so you see hardly a thing and swing worse until a light or time ends it. | 96 |
| fearArmed | Something out there rattled you, and the next fight will open with your knees knocking. | 87 |
| afraid | Fear has got into your hands: blows go astray and land weakly until your nerve returns. | 87 |
| heroOut | Out of action, with nothing able to wake you early, and the foes entirely at their leisure. | 91 |
| heroBlind | Your sight has packed up, and only the luckiest swings find anything to hit. | 76 |
| heroShrunk | Shrunk by a scroll gone wrong, your blows land with all the force of a stern letter. | 84 |
| fightDark | Swinging in the gloom is mostly guesswork, so blows land less often and never spectacularly. | 92 |
| insulted | Rude things were said, and now every foe aims at you with unusual enthusiasm. | 77 |
| selfDot | A scroll gone wrong is still burning, and it will keep at you each round until it tires. | 88 |
| foeEffect/dazed | Your head is full of bells, so swings go wide until the ringing stops. | 70 |
| foeEffect/weakened | Your arms have turned to wet rope, and blows land feebly until it passes. | 73 |
| heroOut/stopped | Time stopped around you, and you with it, which the foes find very convenient. | 78 |
| ward/mirror | A polished bubble waits to send the next blow back to its sender, with padding afterwards. | 90 |
| haste/Speed of Sound | You move ahead of your own sound, swinging first and often, and the din arrives afterwards. | 91 |

## Lines the writer's rules made hard

- **Number words in the explanations:** haste ("Two strikes"), afraid, weakened and braced ("half damage"), heroOut/stopped ("two turns") and others state counts; the lines use "swing more", "land weakly", "feebly" and "ahead of your own sound" instead.
- **The sibling groups** stay distinguishable by image: enlarge (magic growth) vs giant (the gauntlet's stature); invis (foes attack where you were) vs unseen (foes can barely make you out) vs mirror (a flickering second you); glow (a nightlight) vs lit (a torch in your fist) vs nightVision (born with the eyes) vs senses (nerves tuned to living things); darkness (the dark closes in) vs fightDark (swinging in the gloom); ward (borrowed hit points) vs ward/mirror (a bubble that sends a blow back) vs halfNext (the pendant) vs braced (ready for the next hit).
- **Harm kept visible:** affliction ("nibbles ... with every step"), afraid ("blows go astray and land weakly"), heroOut ("out of action ... foes at their leisure"), heroBlind, heroShrunk, fightDark, insulted, selfDot and fearArmed each say something is wrong. Ledger reasons `accurate` on those, on the foeEffect pair and on ether (the walls end).
- **Passing, not lasting:** ether ("for now"), flight ("for exactly as long as the magic holds up"), strength ("on loan"), unlock ("then the magic is spent"), foeEffect ("will not stay long"), knit (needs walking).
- **insulted** avoids the explanation's own wording ("took it personally") so line and RULES text do not echo.
- **reveal / ward/mirror** are the most fragile: reveal says "only while you stand still"; ward/mirror says the blow goes back and padding follows (the pool is the "padding").
- **Joiner-safe wording:** most lines use "you" because the tap card speaks to the hero; foe-side and item-side lines (itemCooldown, staffCharges, halfNext) read fine for a Joiner too. A 96-07 watch item: whether the Company panel wants a "you"-free pass.

## Declared re-pins

- `test/unit/flavor-layer.test.js`: domains 13 to 14, content keys 175 to 222, layer entries 175 to 222, each with a "Phase 96 (FLAVOR-04): declared re-pin" comment.
- `test/unit/flavor-text.test.js`: COUNTS gains `chip: 47`, chip last in the domain order, total keys 175 to 222.
- `tools/lib/voice-corpus.mjs`: the CHIP_FLAVOR bank row, plus a non-copy row for `CHIP_FLAVOR_VARIANTS` (see Deviations).

## Tests run (targeted only, no full suite, no bot runs)

- Task 1: flavor-layer, flavor-text, voice-corpus, safety-scan, shell-no-content-copies, content-is-pure-data: 119 tests, 119 pass. `voice-inventory --roll-under --hygiene --safety --count` prints `0`; `bank:CHIP_FLAVOR*` counts 47.
- Task 2: chip-flavor, flavor-layer, flavor-text, identity-flavor, flavor-lines-not-serialized, flavor-not-serialized, content-tables, hero-conditions, status-chit-combat, authored-ranges, item-text-wording, spell-skill-text-wording, voice-corpus, safety-scan, narrative-hygiene, hp-not-wp, stale-terms, shell-no-content-copies: 371 tests, 371 pass after the voice-corpus registration (two voice-corpus completeness tests failed once on the unregistered export, see Deviations). The count command still prints `0`.
- Task 3: `--check-ledgers --after` 65 ledger files, 0 errors; `narrative-review --check` pages in sync (1101 rows on 15 surfaces); narrative-review and voice-corpus tests: 40 tests, 40 pass.
- `git diff` against the plan base: 0 removed lines under `content/` and no change to `engine`, `mazeworld.html`, `test/parity`, `test/determinism` or `test/unit/fixtures/shell-snapshots`.
- No CRLF-related test failure (the worktree checks out every file as CRLF through `core.autocrlf`; the index holds LF; the Edit tool kept each file's existing endings).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered `CHIP_FLAVOR_VARIANTS` as a non-copy export**
- **Found during:** Task 2 verify
- **Issue:** `test/unit/voice-corpus.test.js` completeness failed twice: the new frozen array of sentence-like keys exported from `src/browser/flavorText.js` was unregistered.
- **Fix:** one `nonCopy("src/browser/flavorText.js", "CHIP_FLAVOR_VARIANTS", ...)` row in `tools/lib/voice-corpus.mjs` (the keys are ids; the sentences are walked through the CHIP_FLAVOR bank). `tools/lib/voice-corpus.mjs` was already in this plan's Task 1 file list.
- **Files modified:** tools/lib/voice-corpus.mjs
- **Commit:** `7df8d14f`

TDD note: as in 96-01 to 96-03, the implementation and the tests landed in one pass per task, so there is no separate failing-test commit.

## Known Stubs

None. No chip line is shown on a surface yet by design (96-07 wires the three chip tap cards).

## Threat Flags

None. No new network, auth or storage surface. T-96-10: `flavorOfChip` guards with typeof checks and a try/catch and returns empty for null, a string, an array, an unknown key, an unknown ability id and a throwing Proxy (all in Test 3). T-96-11: each harmful line was written to keep the trouble in plain words and carries the `accurate` ledger reason; the exact explanation is one tap away under RULES. T-96-12: the test's slicing helper asserts it found every shell table, the mirror branch and a minimum key count before comparing.

## Human verification (deferred to end of run)

- Read the 47 chip lines on `docs/narrative-pass/review.html` (surface "combat-screen", keys `bank:CHIP_FLAVOR.*`) for voice, and check each harmful chip still tells the player something is wrong and each timed buff does not read as lasting. Watch items: affliction ("never quite finishes the job" mirrors "never your last one"), heroOut ("foes entirely at their leisure"), reveal, ward/mirror ("padding afterwards"), the enlarge/giant and invis/unseen/mirror sibling pairs, and whether Joiner chips on the Company panel want a "you"-free pass.

## Self-Check: PASSED

- Files found: content/flavor.js (CHIP_FLAVOR), src/browser/flavorText.js (chip domain, CHIP_FLAVOR_VARIANTS, flavorOfChip), test/unit/chip-flavor.test.js, docs/narrative-pass/why/y-96-04.json (47 rows).
- Commits found: cd9dc688, 7df8d14f, f7e502cb.
