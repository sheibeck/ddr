---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 02
subsystem: ui
tags: [flavour, identity, sub-classes, text-layer, tag-guard, narrative-review]

requires:
  - phase: 96-01
    provides: identityDomain builder, per-domain identity shape rule, live tag guard, RACE_FLAVOR and CLASS_FLAVOR
provides:
  - SUB_FLAVOR (24 tagged { line, good, bad } records in CLASSES order)
  - the sub identity domain (11 domains, 144 content keys), covered by the tag guard and every shared scan
  - y-96-02.json (24 new-line ledger rows) and the regenerated review pages
affects: [96-05 roller and Hero surfaces, 96-08 review]

tech-stack:
  added: []
  patterns:
    - "A sub-class line tags real identityEntries ids (authored traits, generated chart-* ids, free-skill) and nothing the wording does not hint at"

key-files:
  created:
    - docs/narrative-pass/why/y-96-02.json
  modified:
    - content/flavor.js
    - src/browser/flavorText.js
    - test/unit/flavor-layer.test.js
    - test/unit/flavor-text.test.js
    - test/unit/identity-flavor.test.js
    - tools/lib/voice-corpus.mjs
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html

key-decisions:
  - "Records are keyed and ordered by the CLASSES table (Magic User, Fighter, Thief), not by SUB_NOTE's own key order"
  - "Number rule stays strict: no number words, 'once' and 'double' avoided (Master of Arms says 'after it starts')"

patterns-established:
  - "Tag only what the wording hints at: chart ids such as chart-gate-* and chart-never are tagged only where the line says the school is late or closed"

requirements-completed: [FLAVOR-03, FLAVOR-06]

coverage:
  - id: D1
    description: "24 sub-class records, each with at least one real good and one real bad id; the tag guard now runs for race and sub"
    requirement: FLAVOR-03
    verification:
      - kind: unit
        ref: "test/unit/identity-flavor.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lines are number-free, within 200 characters and two sentence marks, safe, unique, not equal to SUB_NOTE, not serialized"
    requirement: FLAVOR-03
    verification:
      - kind: unit
        ref: "test/unit/flavor-layer.test.js; test/voice/safety-scan.test.js; test/roundtrip/flavor-lines-not-serialized.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 24 lines read well and each good and bad really comes through, with drawbacks still legible"
    requirement: FLAVOR-06
    verification: []
    human_judgment: true
    rationale: "Voice, and whether the wording conveys the tagged good and bad, are judgments the scans cannot make; the 96-08 reviewer and the user's read of review.html decide"

duration: 20min
completed: 2026-10-04
status: complete
---

# Phase 96 Plan 02: The 24 sub-class lines Summary

**24 tagged sub-class flavour records (every one carries a real good and a real bad id, chart-generated ids included), the `sub` domain registered so the tag guard and every shared scan cover them, ledgered and on the review page.**

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-10-04
- **Tasks:** 3 of 3
- **Files:** 1 created, 8 modified

## Commits

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 | `ce2da8e4` | 16 Magic User and Fighter lines in SUB_FLAVOR; BANK_REGISTRY row |
| 2 | `f6bd451b` | 8 Thief lines; `sub` domain registered; declared re-pins; both-domains guard test |
| 3 | `16ba09d4` | y-96-02.json (24 rows) and the regenerated review pages |

## The 24 lines

| Key | Line | Chars | Good ids | Bad ids |
| --- | ---- | ----- | -------- | ------- |
| Wizard | Your book opens with something that hurts, and your aim is good, but you refuse to lift a weapon while a spell remains. Illusion, meanwhile, is the Illusionist's, like a family recipe. | 184 | wizard-day-one, chart-bonus-offense | wizard-melee, chart-never |
| Warlock | Evil, and productive with it: a potion copied by night and a thrown spell that lands. The walking dead in the room grow sturdier on your account, and healing and warding come late. | 180 | warlock-potion, chart-bonus-offense | warlock-undead, chart-gate-protection, chart-gate-healing |
| Sorcerer | Freeze and Fireball from day one, spells by the handful and a very sure aim, but now and then one simply falls out of your head. The arm is decorative, and Illusion is none of your business. | 190 | sorcerer-book, sorcerer-levels, chart-bonus-offense | sorcerer-forgets, sorcerer-arm, chart-never |
| Summoner | Your Summon is in the book from the first day, and it arrives bigger and longer-lived than anyone else's. Now and then it turns up on the wrong side, and your own healing is feeble. | 181 | summoner-summon, summoner-doubled, chart-override-Summon | summoner-backfire, chart-healmul |
| Cleric | Chain mail, a better aim than the rest of the book and healing that actually heals. The gods have ruled out fireballs, illusions and anything else fun, and the foresight comes late. | 181 | cleric-mail, cleric-hit, chart-bonus-healing | chart-never, chart-gate-divination |
| Illusionist | Teleport squares go where you point them and the mirrors are in the book from day one. Your own swing is a rumour, warding comes late and the mirror cannot bandage anyone. | 171 | illusionist-teleport, illusionist-book | illusionist-d20, chart-gate-protection, chart-never |
| Court Mage | You talk Humans down, bore the occasional foe to death and shield and mend a little better than most. When a fight does start, everyone else gets there first, and special and illusion are closed. | 195 | court-mage-boredom, court-mage-humans, chart-bonus-protection, chart-bonus-healing | court-mage-first, chart-never |
| Apprentice | You gain experience at a ferocious rate and may even dabble in Illusion. Now and then a spell goes off in your own hands, and foresight comes late, assuming you get that far. | 174 | apprentice-xp, apprentice-illusion | apprentice-backfire, chart-gate-divination |
| Knight | Anything small runs before it can try, and anything large gets there first. You have been made important by the only creatures whose vote counts. | 145 | knight-small | knight-big |
| Guard | Foes miss you more often, which is as well, because your blows are feeble and never land a lucky one. You are a professional, and the profession is standing there. | 163 | guard-hard | guard-weak, guard-nocrit |
| Woodsman | Every beast in here will at least hear you out, with a bonus, and you carry a staff like an old friend. Mail and plate are out: the store won't offer it and your hands won't take it. | 182 | woodsman-talk | woodsman-armor |
| Soldier | Camp mends you generously and the army eventually knights you, trading your weapon for the privilege. Foes find your weak spots easily, and you never find theirs. | 162 | soldier-camp, soldier-knighted | soldier-crit, soldier-nocrit |
| Barbarian | You swing and swing again every round, on the sound principle that a man swinging this much is learning nothing. The experience points agree, and are docked accordingly. | 169 | barbarian-two | barbarian-xp |
| Master of Arms | Every weapon hits harder in your hands and you hammer your own dents out each night. You never talk anyone down and you never leave a fight after it starts: no running, no clever exits. | 185 | moa-damage, moa-patch | moa-parley, moa-never-leaves |
| Samurai | Plate and a magical katana, and enough clatter that you never act first. You never run either: the book uses the word suicidal and does not soften it. | 150 | samurai-kit | samurai-never |
| Bard | You sing a different spell every time, free, and any Human will at least hear you out. Camp draws crowds, and with a Joiner along the dim ones all come for you first. | 166 | bard-song, bard-humans | bard-camp, bard-target |
| Pickpocket | Chests and monsters somehow hand over a little extra. Shopkeepers remember you all the same, charging more and paying less, and you have never been thanked. | 156 | pickpocket-item | pickpocket-shops |
| Pilfer | Traps give up and chests fall open at your approach. Your hands, however, cannot leave a magic ring or staff alone, and now and then it comes apart and takes some of you with it. | 178 | pilfer-traps | pilfer-fumble |
| Cat Burglar | Your first strike always lands and you start knowing Dirty Trick. You also go through every door first, and every trap that catches you hurts far worse than it should. | 167 | cat-burglar-first, free-skill | cat-burglar-traps |
| Cutthroat | Your first blow always lands hard, armour or no armour, lamp or no lamp. Joiners still walk beside you, but now and then one does not reach the next floor, and nobody asks. | 172 | cutthroat-crit | cutthroat-joiner |
| Cloaker | You vanish from any fight for free, right up until you land a blow, Spectres included. After that you run like everyone else, so the career is mostly encounters that never technically happened. | 193 | cloaker-vanish | cloaker-seen |
| Ninja | Your opening strike lands for the maximum, later ones find the weak spots, and you start with Silent Step. The silence is a tactic, but it means no fight is ever talked down. | 174 | ninja-opener, ninja-crit, free-skill | ninja-silent |
| Con Artist | You talk first, and most small foes decline to fight you at all. Your opening blow does nothing, since part of you is still hoping to sell them something. | 154 | con-artist-talk, con-artist-leave | con-artist-opener |
| Acrobat | Foes rarely land a hit, traps rarely land either, and you strike like a Fighter. You may carry nothing but a knife, and you start knowing Smoke. | 144 | acrobat-dodge, acrobat-traps, acrobat-hit, free-skill | acrobat-dagger |

## Lines the writer's rules made hard

- **Sorcerer, Court Mage, Illusionist, Cleric, Summoner:** each SUB_NOTE carries many rules, so each line picks the good and bad that most change play and tags only those (for example the Cleric's closed schools via chart-never, the Illusionist's late warding and no healing). Many chart ids (stretch, shield-and-bubble bonuses, healing bonus on Sorcerer and others) are deliberately untagged because the wording does not hint at them.
- **Barbarian and Master of Arms:** the originals' "twice" and "once" are banned number words, so the Barbarian keeps the "man swinging learns nothing" joke without them, and the Master of Arms says "after it starts".
- **Soldier:** the Awl Pike swap is carried as "trading your weapon for the privilege", which hints at the knighting without naming the number or the weapon; a 96-08 watch item.
- **Pilfer:** the fumbling hands are described plainly ("cannot leave a magic ring or staff alone"), no diagnosis named; the d10 damage is hinted as "takes some of you with it".
- **Cutthroat:** the Joiner risk is legible as "now and then one does not reach the next floor, and nobody asks", with no die named.
- **Drawbacks stay legible:** the Cat Burglar's trap damage ("hurts far worse than it should"), the Wizard's refusal to melee, the Cleric's closed schools and the Samurai's "never run" are stated as drawbacks, not dressed as perks.

## Declared re-pins

- `test/unit/flavor-layer.test.js`: domains 10 to 11, content keys 120 to 144, layer entries 120 to 144; the shape-rule table gains an `ruleOf("sub")` pin; each carries a "Phase 96 (FLAVOR-03): declared re-pin" comment.
- `test/unit/flavor-text.test.js`: COUNTS gains `sub: 24`, the domain order gains `sub` between `race` and `class`, total keys 120 to 144.
- `test/unit/identity-flavor.test.js`: a new test that the live loop covers both the race and the sub domains (and 24 sub keys), so the tag guard cannot silently stop covering sub-classes.

## Tests run (targeted only, no full suite, no bot runs)

- Task 1: flavor-layer, flavor-text, identity-flavor, voice-corpus, safety-scan, shell-no-content-copies, content-is-pure-data, identity-text: 141 tests, 141 pass.
- Task 2: the above plus flavor-lines-not-serialized, flavor-not-serialized, content-tables, narrative-hygiene, hp-not-wp, stale-terms, identity-footer, identity-contract, identity-audit: 348 tests, 348 pass; `node tools/voice-inventory.mjs --roll-under --hygiene --safety --count` prints `0`; `bank:SUB_FLAVOR*` counts 24.
- Task 3: `--check-ledgers --after` 63 ledger files, 0 errors; `narrative-review.mjs --check` pages in sync (1023 rows on 15 surfaces); narrative-review and voice-corpus tests: 40 tests, 40 pass.

## Deviations from Plan

### Plan acceptance criterion mismatch (no code change)

The Task 2 acceptance one-liner compares `Object.keys(C.SUB_FLAVOR).join()` to `Object.keys(C.SUB_NOTE).join()`. SUB_NOTE's own key order is Fighter, Thief, then Magic User sub-classes, while the plan (and the domain's `keys()`) mandate CLASSES order (Magic User, Fighter, Thief), so a literal ordered comparison cannot pass. The key sets are equal (checked sorted) and `identity-flavor`'s live loop asserts the record keys equal `keys()` in CLASSES order. Not a defect.

No other deviation. TDD note: as in 96-01, implementation and tests landed together; the tag guard's teeth cases from 96-01 are what prove it catches a missing good or bad.

## Known Stubs

None. No flavour line is shown on a surface yet by design (the roller and Hero tab read these maps in 96-05).

## Threat Flags

None. No new network, auth or storage surface. T-96-04: every record is tagged with a real bad id by the guard; T-96-06: the bank row picks only `line`.

## Human verification (deferred to end of run)

- Read the 24 sub-class lines on `docs/narrative-pass/review.html` (surface "blurbs", keys `bank:SUB_FLAVOR.*`) and mark any where the good or the bad does not come through. Watch items: Soldier (does "trading your weapon for the privilege" read as the Awl Pike swap?), Warlock (the walking-dead drawback), Court Mage (is "special and illusion are closed" clear?), Cleric and Wizard (closed schools), and Sorcerer (the forgetting line).

## Self-Check: PASSED

- Files found: content/flavor.js (SUB_FLAVOR), src/browser/flavorText.js (sub domain), docs/narrative-pass/why/y-96-02.json (24 rows).
- Commits found: ce2da8e4, f6bd451b, 16ba09d4.
- `git diff --stat HEAD -- engine test/parity test/determinism test/unit/fixtures/shell-snapshots` and the five audit docs print nothing; content diff is additions only (0 removed lines).
