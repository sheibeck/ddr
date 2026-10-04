---
phase: 96-fantasy-flavour-ii-races-sub-classes-abilities-chips-the-rev
plan: 09
subsystem: flavour-text
tags: [flavor, narrative-pass, review, rewrite]
requires: [96-08]
provides:
  - "14 round-1 revise lines rewritten in place"
  - "docs/narrative-pass/why/y-96-09.json (14 chained rows)"
affects: [96-11]
key-files:
  modified:
    - content/spells.js
    - content/treasure-tables.js
    - content/armors.js
    - content/abilities.js
    - content/skills.js
    - content/flavor.js
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
  created:
    - docs/narrative-pass/why/y-96-09.json
status: complete
---

# Phase 96 Plan 09: Round-1 Revise Rewrites Summary

All 14 lines the round-1 reviewer marked revise are rewritten in place, chained in a new ledger and shown on the regenerated review pages. Round 2 (independent re-review) is plan 96-11's job; no verdict was written or edited here.

R9_BASE: 673ee39370496b0b75aa934f75e438ba06dacff7

## Commits

- 10bfdd3b feat(96-09): rewrite the fourteen round-1 revise flavour lines
- a2c82d0b docs(96-09): chain the fourteen rewrites in y-96-09 and regenerate the review pages

## Rewrites (key, old, new, reviewer note, characters)

| Key | Old | New | Note | Chars |
|-----|-----|-----|------|-------|
| SPELL_FLAVOR.Bubble | A shimmering bubble that sends the next blow home to whoever threw it, then pops. | Returns the next blow to sender with its compliments, then lingers as a soft cushion for the round. | no joke; "pops" ignores the lingering cushion | 99 |
| SPELL_FLAVOR.Sense Presence | Your skin crawls in a helpful direction: no ambushes, and the dark stops mattering. | Your skin crawls in a helpful direction: no ambushes, and fighting in the dark stops being a chore. | scope the dark to the fight | 99 |
| SPELL_FLAVOR.Size of the Behemoth | Makes you loom enormously, so the smaller foes flee and the rest lose heart. | Makes you loom enormously, so lesser foes flee unless they know better, and the rest lose heart. | lesser not smaller; keep the resist hedge | 96 |
| MAGIC_ITEM_FLAVOR.Gauntlet of the Giant | A glove with ambitions: you grow, hit harder, and become far easier to aim at. | A glove with ambitions: you grow, hit harder, and become a slightly easier target. | drop "far" (rule is +1 to hit) | 82 |
| MAGIC_ITEM_FLAVOR.Pendant of Fortitude | Softens a blow into a mere insult, though it wants a long rest between favours. | Takes the edge off a blow, a bruise where a break would have been, but wants a long rest after. | rule only halves one attack; soften the claim | 95 |
| ARMOR_FLAVOR.Mail | A jingling shirt of linked rings: sturdy, heavy and best left to fighters. | A shirt of linked rings that jingles like a cutlery drawer: sturdy, heavy and best left to fighters. | plain inventory; give it Plate's attitude | 100 |
| SUB_FLAVOR.Master of Arms.line | Every weapon hits harder in your hands and you hammer your own dents out each night. You never talk anyone down and you never leave a fight after it starts: no running, no clever exits. | Every weapon hits harder in your hands and you hammer your own dents out each night. You can neither talk nor walk your way out of a fight, so you have learned to enjoy them. | flat list, lifted phrase; joke in a fighter who can neither talk nor leave | 174 |
| SUB_FLAVOR.Samurai.line | Plate and a magical katana, and enough clatter that you never act first. You never run either: the book uses the word suicidal and does not soften it. | Plate and a magical katana, and enough clatter that you never act first. You never run either: the book has strong words for that and declines to soften them. | banned stem "suicidal" in the new line | 158 |
| ABILITY_FLAVOR.Brace | Plant your feet and clench: the next few blows that land hurt rather less than they might. | Plant your feet and clench: the hits that land hurt rather less than they might. | disguised count, overruns the rule | 80 |
| ABILITY_FLAVOR.Overhead Blow | Everything you have behind a single swing: it hits much harder, and misses a little more. | Subtlety is for other people: a single huge swing that hits much harder and misses a little more. | straight description; lead with attitude | 97 |
| ABILITY_FLAVOR.Mark | Study the foe's soft spots until every strike afterwards hurts a bit more. | Glare at the foe until it confesses its soft spots, after which every strike hurts it a bit more. | plain restatement; add attitude | 97 |
| SKILL_FLAVOR.Cooking | Whatever you kill, you can eat, and you do: a little health back and a ration for later. | Every beast you kill is dinner, for a little health and a ration later; skeletons are not a meal. | contradicts rules (only beasts feed you) | 97 |
| CHIP_FLAVOR.unlock | The next locked chest gives in at a touch, and then the magic is spent. | The next locked chest swings open as if it had always meant to, and then the magic is spent. | flat; own deadpan | 92 |
| CHIP_FLAVOR.ability | One of your tricks is still running, with the particulars on the ability itself. | One of your tricks is still going and rather smug about it; the ability has the fine print. | plain restatement; add attitude | 91 |

The two identity rewrites keep their tag ids unchanged (Master of Arms: moa-damage and moa-patch good, moa-parley and moa-never-leaves bad; Samurai: samurai-kit good, samurai-never bad): the new wording still conveys at least one of each side. The canon Samurai SUB_NOTE (which still carries "suicidal") and every other rules text, CONDITION_EXPLAIN and txt field were left byte-identical.

## User-owned line flagged by the reviewer

None. bank:SPELL_FLAVOR.Heal was a pass in round 1, so it was not rewritten. For the user's read: two pass rows carried grammar-only or duplication notes (Weaken, Walnut Staff: "who swing" pairs a singular with a plural verb; Knight and Woodsman: second sentence lifted from the rules text). They were pass, so per the plan they were not touched.

## Ledger and pages

docs/narrative-pass/why/y-96-09.json holds 14 chained rows (`before` is the previous ledger `after`, reasons mapped from the failed checks). docs/NARRATIVE-PASS.md and docs/narrative-pass/review.html were regenerated; both stay CRLF in the working tree.

## Snapshots

Declared fixture moves: none. The snapshot tests (shell-tab-snapshots, shell-ability-states) pass unchanged, so no fixture renders a rewritten line, no MZ_SNAPSHOT_UPDATE run was needed and no header declaration was added.

## Verification (targeted only)

- Task 1 guard set (flavor-layer, flavor-text, identity-flavor, chip-flavor, content-tables, voice-corpus, safety-scan, narrative-hygiene, hp-not-wp, stale-terms, shell-no-content-copies, content-is-pure-data, rules-layer, identity-text, item-text-engine, spell-skill-text-engine): 356 tests, 356 pass; `voice-inventory --roll-under --hygiene --safety --count` ended with 0.
- Task 2 set (narrative-review, flavor-review, voice-corpus, shell-tab-snapshots, shell-ability-states, rules-surfaces, flavor-layer): 194 tests, 194 pass.
- `voice-inventory --check-ledgers --after`: 66 ledger files, 0 errors. `narrative-review --check`: pages in sync. `flavor-review --check`: verdict file valid; it lists the 14 rewritten keys as stale-verdict (hash mismatch), as designed until 96-11 records round 2.
- Diff against R9_BASE touches only content files, the ledger and the two generated pages (no engine, test, src, tools or mazeworld.html).
- Not run (project rulings): full npm test, bot runs. No CRLF-only failures were seen.

## Deviations from Plan

Two first drafts (Sense Presence, Pendant of Fortitude, Overhead Blow) overran the 100-character domain limit on the first guard run and were trimmed before commit. Otherwise none.

## Human verification (deferred to end of run)

Read the 14 rewritten lines on docs/narrative-pass/review.html (each shows its base, round-1 and final wording) and flag any that miss the house voice.

## Self-Check: PASSED

Commits 10bfdd3b and a2c82d0b exist; y-96-09.json exists with 14 rows.
