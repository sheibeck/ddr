# The narrative pass (Phase 79): the method

This page is the one written method every Phase 79 plan follows. The tooling
it describes is `tools/voice-inventory.mjs` (the command), built on
`tools/lib/voice-corpus.mjs` (the corpus), `tools/lib/voice-checks.mjs` (the
checks) and `tools/lib/event-variants.mjs` (the synthetic events builders
are rendered through). The phase-base snapshot is
`docs/narrative-pass/corpus-base.json`, and every rewrite plan's why-ledger
is `docs/narrative-pass/why/79-NN.json`.

## What the pass is

- **VOX-05.** Every line states clearly what happened, to whom and why,
  sarcastic and family-friendly.
- **ROLL-04.** No player-facing string still encodes roll-under phrasing.
- **VOX-04.** Every sub-class and race blurb names its advantages and
  disadvantages, including school gates (79-03's generated footers).

## What it is not

- **No rules changes.** No rule, rng draw or serialized state moves, and no
  parity fixture moves. `prototype-master.js.txt` is never edited.
- **No new number formatting.** Phase 74's formatter,
  `src/browser/rollRange.js`, is reused unchanged.
- **No full voice rewrite.** Only lines that FAIL the rubric change. A line
  that passes stays word for word, which keeps churn and snapshot re-pins
  down (79-CONTEXT, "How much changes").

## The rubric (79-CONTEXT, user accepted 2026-09-25)

Every line is judged on four points:

1. States what happened, to whom and with what result (numbers where the
   player needs them).
2. Reads naturally aloud, with no stilted or translated-sounding phrasing.
3. The deadpan, family-friendly joke comes AFTER the fact, never instead of
   it.
4. Is accurate to what the engine actually did, so the narration never
   contradicts the event.

## The house line shape (docs/CLARITY.md)

`<Cause>: <plain-language why>. −N <unit>.` Cause first, cost last. The
number is always stated when the engine knows it, and the item is named when
there is no number. For example: "Being trapped: four walls and one door you
already used. −4 hp." Fight-log strike lines keep their dice-first
convention, because the foe's name is the cause.

## The ROLL-04 phrasing rule

Every check is roll-high: a higher face is always better, so a 1 is always
the worst face.

- **A fixed die states the Phase 74 range.** d20 checks, d10 locks and
  climbs: "foes find you only on a 20 (19–20 if you insulted them)", "they
  hit only on 18–20".
- **A die that scales with level speaks in faces.** The hero's strike die
  runs d20 to d6, so a face number would be wrong at half the levels: "only
  your die's top face lands", "one face better".
- **A mishap on a low face is canon.** "A natural 1 fumbles the pick" and "a
  scroll fumbles on 1–3" are roll-high phrasing and stay. Only a low face
  named as the way to SUCCEED (hit, find, open, crit) is roll-under.
- **A signed modifier is Phase 74's display.** "+2 to hit" and "−2 to hit"
  are signed from the player's side and stay. A bare face count ("a 5 to
  hit", "2 to hit") does not.

The roll-under patterns (`--roll-under`) catch: a need phrase with a face
count ("foes need a 1 to hit"), a natural-low success ("need a natural 1 to
find you"), a low range tied to a roll ("1–5 on a d10", "a 1–2 if you
insulted them"), "N or under/less/lower/below", a face count to hit ("a 5 to
hit"), a single low face that hits or crits ("hittable only on a 4",
"criticals on a 2"), a penalty on to-hit ("−3 on to-hit") and "need(s) N
better". Each pattern matches every dash (hyphen-minus, U+2013, U+2014,
U+2212) and the number words one to six, case-insensitively, on
markup-stripped text.

## The standing rulings

- **HP, not WP.** No player-facing string says "wp" or "WP".
- **U+2212 for a minus, U+2013 for a range.** "−4 hp", "18–20", never "-4"
  or "18-20".
- **Dungeon Master and Game Master.** Never "Maze Master"; never the retired
  working title (the 1994 rulebook's own name in the credits is not the
  working title).
- **Family-friendly deadpan.** No profanity, gore or adult content; the
  darkness is in the wit, not the shock. `content/safety-wordlist.js` stays
  green (`--safety`).
- **House spelling: British (79-12).** The player reads "armour", and the
  rest of the -our family follows (honour, rumour, favour, colour). Counted
  on the live corpus at 79-12's dispatch base (1968d3e8): "armour" 64
  occurrences in 39 keys, "armor" 31 in 22; honour 2 / honor 1, rumour 3 /
  rumor 1, favour 2, colour 1, centre 1, grey 3, and no other US form. The
  majority won, and nothing in `.claude/CLAUDE.md` or the content set a
  precedent the other way. Every player-facing "armor" became "armour"
  (Oracle lines, panel labels such as ARMOUR RATING, the Hero sheet's
  Armour row, the blurbs, footers and race notes, the engine's `armor` slot
  word through `narrationLines.js#slotWord`). Item names are proper nouns
  and ids that reach saved state, so the Cloak of Armor and the Faerie's
  Magic Armor keep theirs, and code identifiers (`armorSoaked`, `c.armor`)
  are untouched. `--hygiene`'s `house-spelling` rule holds it.
- **A Pilfer's text never names a diagnosis.**
- **Card versus rail line.** A dismissible card is for decisions and big
  updates; a minor event is a rail line with its narrative sentence.

## The corpus

`node tools/voice-inventory.mjs` builds the corpus from the tree at run
time; nothing in it is a hard-coded line list. Five sources, each with its
key scheme (every ledger uses these keys verbatim):

| Source | Key | What it is |
| --- | --- | --- |
| EVENT_NARRATION builders | `oracle:<eventType>` | every Oracle line, rendered through the fixed synthetic events |
| LINE_FOR builders | `rail:<eventType>` | every rail and fight-log line, the same way |
| Registered copy banks | `bank:<EXPORT>.<path>` | every string leaf; object keys and array indices joined by "." (a plain string export is `bank:<EXPORT>`) |
| Content tables | `content:<TABLE>.<rowKey>.<field>` | rowKey is the row's `n`, `id` or `name`, else its object key, else its index |
| The raw sweep | `raw:<repo-relative file>#<declaration>` | copy-like string literals in src/browser (not the two narration files), engine and mazeworld.html, keyed by the enclosing top-level function or const, or `top`; mazeworld.html's markup text is `#markup` |

A builder's texts are its de-duplicated renderings across the synthetic
events (tools/lib/event-variants.mjs; frozen after 79-01, only 79-12 may
extend it). An odd reading can be an artifact of a synthetic field value no
real event carries: check the engine before rewriting.

### Surfaces, in this fixed order

blurbs (class and race blurbs), oracle (the Oracle log), rail (rail lines and
the fight log), refusals (any builder whose event type ends in Refused,
Rejected, Blocked or Denied), rail-cards (rail cards and decision cards),
combat-screen (combat screen and chips), items (item, gear and store text),
spells (spells, abilities and skills), foes (bestiary and foe text), death
(epitaphs and death), boards (leaderboards and account), panels (hero, gear,
store and final-sheet panels), map (map, marks and legend), title (title,
roller, settings and menus), other (anything the rules above do not place).

### Domains (builders only)

By the engine file that emits the event type: **fight** when
engine/combat.js emits it; **powers** when engine/abilities.js,
engine/magic.js, any engine/foe*.js or engine/scrollFumble.js does;
**world** for every other emitter and for a type no engine file emits. Fight
wins over powers, powers over world.

### Ownership (by surface, module, export and domain; never by line)

The first rule that matches owns the entry (`OWNER_RULES` in
tools/lib/voice-corpus.mjs is this list as data):

| Owner | What it owns |
| --- | --- |
| 79-02 | the gain, Table 4 and table-roll builders (healed, regenerated, potionDrunk, secondWindHealed, foodFound, faerieBoon, floorRegen, cloakRegenerated, cooked, rested, leveled, tableFour, tableFourNoop, encounterRolled) and engine/encounters.js#tableFour's prose |
| 79-03 | blurbs (CLASS_NOTE, SUB_NOTE, RACE_NOTE, RACES notes, the identity footers and traits) and the JOINER lines |
| 79-06 | epitaphs, CAUSE_TEXT, MISS_LINES, the boards, placement and account copy, scoreTag.js |
| 79-04 | fight-domain builders, src/browser/fightLog.js and engine/combat.js literals |
| 79-05 | content rules text (spells, potions, skills, abilities, treasure tables, bestiary, foe abilities, afflictions, misc tables, traps, tools, scroll fumbles, activations, kit, bags, foods, store stock) and engine/items.js and engine/economy.js literals |
| 79-07 | combatMenu.js, combatPanel.js, conditionEffects.js, heroConditions.js, foeConditions.js, foeDetails.js and mazeworld.html's combat and condition consts (CONDITION_COPY, COMBAT_COPY, FOE_EFFECT_LABEL, FOE_EFFECT_EXPLAIN, ABILITY_CHIP_LABEL, CONDITION_EXPLAIN, WAIVER_LABEL) |
| 79-08 | powers-domain builders and engine/magic.js, engine/abilities.js, engine/foe*.js and engine/scrollFumble.js literals |
| 79-09 | heroTab.js, gearTab.js, gearSheet.js, storeScreen.js, viewModels.js, upgradeWhy.js, boardsPanel.js, boardsView.js, globalBoards.js, boardScores.js and finalSheet.js |
| 79-10 | mapMarks.js, roller.js, settings.js, hudMenu.js, arrowPad.js, accountChip.js, playGames.js and every other mazeworld.html literal |
| 79-11 | world-domain builders, rail.js, hazardCard.js, the two phrase banks only world builders print (PHOBIA_TRIGGER_PHRASE, RATION_RULE_LINE) and every other engine literal |
| 79-12 | rollRange.js (reused, not changed) and anything the rules above do not place |

## The why-ledger

Every rewrite plan writes `docs/narrative-pass/why/79-NN.json`: an array of
rows, one per changed line.

```json
{ "key": "content:SPELLS.Mirror Self.txt", "surface": "spells", "trigger": "a spell's Grimoire and scroll text",
  "before": "defensive · you · foes need a 1 to hit, d6 rounds",
  "after": "defensive · you · foes find you only on a 20, d6 rounds",
  "reasons": ["roll-under"], "why": "The old text was the roll-under face count; the engine rolls high." }
```

- `before` and `after` are markup-stripped, whitespace-collapsed renderings:
  a representative rendering for a builder (list them with
  `--key oracle:<type>`), the exact string for a bank or content field, the
  literal for a raw entry. `before` is "" for a brand-new line and `after`
  is "" for a removed one.
- `before` must be a base rendering of that key (docs/narrative-pass/
  corpus-base.json), or the `after` of an earlier Phase 79 plan's row for
  the same key. A builder's `before` compares number-blind (its renderings
  are representative, so a real event's numbers may differ).
- `reasons` come from this fixed set:
  - **fact**: states what happened to whom, with the result (rubric 1);
  - **natural**: reads naturally aloud (rubric 2);
  - **joke**: the joke comes after the fact (rubric 3);
  - **accurate**: accurate to the engine (rubric 4);
  - **roll-under**: a ROLL-04 fix;
  - **number**: an honest-number fix;
  - **identity**: VOX-04;
  - **naming**: HP not WP, Dungeon or Game Master, the working title;
  - **hygiene**: a leaked token or a wrong sign or range character.
- `why` is one plain sentence.

`test/unit/voice-corpus.test.js` validates every ledger present (schema and
before-side) against the base on every `npm test`.

## The per-plan procedure

1. **List your worklist.** `node tools/voice-inventory.mjs --owner 79-NN
   --table` (add `--surface` or `--domain` to narrow it).
2. **Judge every line against the rubric.** Rewrite only the lines that
   fail. A line that passes stays word for word.
3. **Write a ledger row per changed key** in
   `docs/narrative-pass/why/79-NN.json`.
4. **Drive the checks to zero for your owner.** `node tools/voice-inventory.mjs
   --owner 79-NN --roll-under --hygiene --safety --count` must print 0
   (exit 0). `--twins` lists a rail number its Oracle twin lacks; fix a real
   disagreement, and name an artifact of the synthetic events in your
   SUMMARY.
5. **Prove the ledger.** `node tools/voice-inventory.mjs --check-ledgers
   --plan 79-NN --after` must report 0 errors; `--diff --owner 79-NN` shows
   every key you changed against the base.
6. **Re-pin deliberately.** An exact-string test that pins a line you
   changed is updated in the same commit, on purpose.

## Handed on

A failing line whose owner is another plan, or whose only test pin sits in a
file a same-wave sibling owns, is not fixed out of turn. List it in your
SUMMARY under **"Handed on"** with its key and the reason. 79-12 closes every
handed-on item.

## No new banks

A rewrite plan changes existing strings. A new string goes in an existing
bank or stays module-private, never in a new exported copy bank:
tools/lib/voice-corpus.mjs (the registry) is not edited after 79-01 except by
79-12, and its completeness guard fails on any unregistered export holding
copy. The same holds for tools/lib/event-variants.mjs and the exception
lists in tools/lib/voice-checks.mjs: only 79-12 edits them, and it prunes
the exception lists for rot.

Phase 95 (FLAVOR-01/02/05) amends this rule for the flavour layer: the eight
*_FLAVOR maps and src/browser/rulesLayer.js#RULES_COPY are new banks, registered
in tools/lib/voice-corpus.mjs by plan 95-01 (FLAVOR_DOMAINS is a non-copy row).
Their lines are new-line ledger rows (`before` "") in
docs/narrative-pass/why/y-95-NN.json, the `y-` prefix keeping the ledgers in plan
order after `x-94-04`. Phase 96 registers its own banks the same way. See
docs/TEXT-LAYERS.md.

## The Phase 96 review (FLAVOR-06)

Phase 79 judged lines once and kept no record of the judgement. The Phase 95
and 96 flavour lines are reviewed one by one, and the review is recorded in
files you can check.

**The reviewed set.** Every key in docs/narrative-pass/why/y-95-*.json and
y-96-*.json (the three RULES_COPY toggle words included), resolved to the last
`after` in plan order, so a rewritten line is judged in its final wording.
`node tools/flavor-review.mjs --worksheet` prints each one (add `--domain race`
to read one domain at a time).

**The five checks.** A verdict records the checks a line FAILS, never the ones
it passes.

| id | the line passes when it |
|---|---|
| voice | is sarcastic, deadpan, in the house voice; a plain restatement of the rule in other words fails |
| family | is family-friendly: nothing crude, gory or adult, and the sarcasm lands on the adventurer or the trope, never a real group |
| numberFree | states no number, die, percentage or number word, in disguise either (a duration, a count, a doubling) |
| consistent | points the same way as its rules text, never contradicts it, never promises more than it delivers |
| goodBad | for a tagged race or sub-class line: the wording conveys at least one tagged good and one tagged bad a player could act on (a joke with no information fails) |

The same text is the frozen `REVIEW_CHECKLIST` in tools/lib/flavor-review.mjs.

**The verdict files.** docs/narrative-pass/verdicts/*.json, one file per round:

    { "round": 1, "reviewer": "<who>", "rows": [
      { "key": "bank:SPELL_FLAVOR.Heal", "h": "1a2b3c4d", "verdict": "pass" },
      { "key": "...", "h": "...", "verdict": "revise", "fails": ["voice"], "note": "one sentence: what is wrong, which way to go" } ] }

- `key` is the ledger key, compared exactly.
- `h` is the first eight hex characters of the SHA-1 of the line's UTF-8 text.
  A verdict is tied to the exact wording it judged. When the line is rewritten
  the old hash is stale, and both generated pages say "line changed since".
- `verdict` is pass or revise. A revise needs at least one failed check and a
  note specific enough for another agent to rewrite the line from it. A pass
  lists no failed check.
- Optional `selfChecked: true` (round 2 only: the rewriting agent checked its
  own rewrite) and `userOwned: true` (valid only on the frozen
  `USER_OWNED_LINES` key, `bank:SPELL_FLAVOR.Heal`, the user's own accepted
  example: if a reviewer disagrees, the round that closes the review records a
  pass with `userOwned: true` and the concern in the note, and the line is never
  rewritten).

**The rounds.** Round 1 covers every reviewed line it could see. Later rounds
cover only the lines whose latest verdict is revise, and any line added after
round 1 was recorded. The review is CLOSED when every reviewed key's latest
verdict is a pass whose hash equals the hash of the current line.

**Lines added after round 1.** Gap plan 96-12 added eleven active-skill lines
after round 1 was recorded, so round 1 holds no verdict for them. The rule
(declared in plan 96-11, `POST_ROUND1_PLANS` in tools/lib/flavor-review.mjs):
every reviewed key has a verdict in round 1 or, if its first ledger row is from
a plan listed there, a first verdict in a later round; the latest verdict must
still be a pass at the current wording. A round-1 row for such a key is an
error, because no verdict is ever back-dated onto a line the round never saw.
`--skeleton --round N` (N of 2 or more) lists the keys with no verdict yet as
well as the keys whose latest verdict is revise.

**Who does what (the independence boundary).** An executor cannot spawn
subagents, so "a separate reviewer" is a plan boundary. Phase 95 plans 03 and 04
and Phase 96 plans 01 to 04 wrote the lines. Plan 96-08's executor wrote none of
them and records round 1; it changes no content, shell or engine file (the
diff gate against its base commit proves it). Plan 96-09's executor rewrites the
revise lines. Plan 96-11's executor, again fresh, records round 2 and closes.
No script ever sets a verdict: the skeleton carries `null`, which the validator
rejects until a reviewer has judged the line.

**Commands.**

- `node tools/flavor-review.mjs --worksheet [--domain <id>]` prints the line, its
  hash, its exact rules text and, for a race or sub-class, the tagged good and
  bad entries' texts.
- `node tools/flavor-review.mjs --skeleton --round N --reviewer "<text>" --out docs/narrative-pass/verdicts/<file>.json`
  writes the null-verdict file (round 1: every key; later: the keys whose latest
  verdict is revise).
- `node tools/flavor-review.mjs --check` validates every present verdict file
  (exit 1 on an error; exit 0 when there is none).
- `node tools/flavor-review.mjs --closed` also requires the review to be closed.
- `node tools/narrative-review.mjs` regenerates both pages; a row shows its
  verdicts after its why, and a counts section lists them. With no verdict file
  both pages are unchanged byte for byte.
