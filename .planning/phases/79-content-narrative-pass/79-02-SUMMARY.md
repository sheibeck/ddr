---
phase: 79-content-narrative-pass
plan: 02
status: complete
subsystem: engine events + narration (Oracle and rail)
tags: [VOX-05, number-honesty, table-4, gains, joiner, race-trait]
requires: []
provides:
  - "additive `gained` on every hero/member HP gain event"
  - "tableFour `row`/`stat`/signed `amount`, with number-free prose"
  - "honest gain, Table 4 and table-roll lines on the Oracle and the rail"
  - "engine/derived.js#raceFoeToHit: a Joiner's own race to-be-hit trait"
  - "docs/narrative-pass/why/79-02.json (27 rows)"
affects: [79-04, 79-08, 79-11, 79-12, 79-13, 79.1]
tech-stack:
  added: []
  patterns:
    - "additive event fields report the clamped truth; builders fall back to the pre-clamp field only for hand-built events"
    - "source-scan guard pairing every HP clamp-to-max site with a `gained` event, with a reasoned allowlist for foe heals"
key-files:
  created:
    - test/unit/honest-gains.test.js
    - test/unit/joiner-race-to-be-hit.test.js
    - docs/narrative-pass/why/79-02.json
  modified:
    - engine/abilities.js
    - engine/combat.js
    - engine/derived.js
    - engine/economy.js
    - engine/encounters.js
    - engine/events.js
    - engine/items.js
    - engine/magic.js
    - engine/movement.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/trap-death-repro.test.js
    - test/unit/encounters.test.js
    - test/unit/hp-growth-linear.test.js
    - test/unit/movement.test.js
    - test/unit/summoner-heal.test.js
    - test/unit/narrativeLines.test.js
    - test/unit/fixtures/event-order/default-fold-corpus.json
    - test/parity/FIXTURE-INVENTORY.md
decisions:
  - "Table 4 fix: the roll line names the row by its effect (the todo's first option), and tableFour carries the signed amount"
  - "Unit spelling stays lower-case 'hp' ('−19 hp'), matching docs/CLARITY.md and every Oracle line"
  - "`gained` is on every gain event, even where it equals `amount` (rested, floorRegen, cloakRegenerated, secondWindHealed, leveled, faerieBoon), so one field carries the truth"
  - "A store meal's gain rides on its `bought` event (`gained`, `meal`) through a STORE_EFFECTS return value that buyFrom merges, so no new event type is needed"
  - "A Joiner's race to-be-hit trait is read from its own sheet; the hero's race term applies only to vs 'hero' (fixes the leak)"
metrics:
  completed: 2026-09-27
  tasks: 4
  commits: 7
---

# Phase 79 Plan 02: Honest Gain and Table 4 Numbers (plus a Joiner's Own Race Trait) Summary

Every gain line now leads with the HP actually gained, and the Table 4 death log tells one signed number once. The engine got additive `gained`/`row`/`stat`/`amount` fields and uses zero new draws. Separately, a Joiner now carries its own race's to-be-hit trait instead of the hero's.

**Plan base:** `cd560cc8dafe63495bd80f45816c3bf30dae7ec1`

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | The engine reports what it actually did | 20e79824 (RED), 914e5fab (GREEN) |
| 2 | The sweep checks gains, not just losses | df159760 |
| 3 | The lines say it (gains, Table 4, the table roll) | e5b4777d (RED), 09aee3a5 (GREEN) |
| 4 | Extra scope: an Elven Joiner's own thin-boned trait | d4609b00 (RED), 57cb14e5 (fix) |

## Gain sites found

The clamp-site scan is authoritative, and the source guard in honest-gains.test.js enforces it.

| File | Function | Event | Pre-clamp before? | Now |
|------|----------|-------|-------------------|-----|
| engine/magic.js | castSpell (heal) | healed | yes (amount) | + `gained` |
| engine/magic.js | drinkPotion | potionDrunk | yes | + `gained` |
| engine/items.js | useItem `heal` | healed | yes | + `gained` |
| engine/items.js | useItem `full` | healed | amount = maxWP | + `gained` |
| engine/items.js | useItem `knit` | cloakRegenerated | no (clamped) | + `gained` |
| engine/abilities.js | useAbility secondWind | secondWindHealed | no (clamped; `rolled`) | + `gained` |
| engine/combat.js | resolveMemberAbility secondWind | memberSecondWind | no (clamped) | + `gained`, + `rolled` |
| engine/combat.js | killFoe cooking | cooked | yes (wp) | + `gained` |
| engine/combat.js | foeTurn regen tick | regenerated | yes | + `gained` |
| engine/encounters.js | findFood | foodFound | yes (wp) | + `gained` |
| engine/encounters.js | meetFaerie +d20 | faerieBoon | a raise (no clamp) | + `gained` |
| engine/encounters.js | tableFour +10 HP / +25 HP / tolls / XP / armour | tableFour | the number was baked into the prose | + `row`/`stat`/`amount` (+ `rolled`, `gained` on heal rows) |
| engine/movement.js | newDay rest | rested | no (clamped) | + `gained` |
| engine/movement.js / events.js | descend / floorRegen() | floorRegen | no (clamped) | + `gained` |
| engine/character.js / events.js | checkLevel / leveled() | leveled | a raise | + `gained` |
| engine/economy.js | STORE_EFFECTS.eatRation → buyFrom | bought (no event before) | the HP gain was silent | + `gained`, + `meal` |

**Clamp-site allowlist** (foe heals; none touch hero or member HP):
- foeAbilities.js: the Heal ability (`foeHealed` already reports the clamped amount), and two life-drain heals.
- scrollFumble.js: a fumbled heal that lands on a foe (`fumbleOnFoe` reports the clamped amount).
- combat.js: foe Regeneration (`foeRegenerated` is already clamped), and `f.wp = f.maxWP` on a foe's second life (`foeRevived`).

## Parity and engine-gate measurement

- Parity passes 66/66 after every task.
- `git diff --quiet cd560cc8 -- test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness/comparables.js` exits 0.
- The prototype master hash is `a1f4d0dc…` (unchanged).
- Events are never serialized, so no comparables carve-out was needed.
- Draw counts are pinned per touched site in honest-gains.test.js. The descend rng cursor (-869104716) was measured at the base.
- The fixture roster replays unchanged. The declaration is under `## Phase 79` / `### Plan 79-02` at the end of `test/parity/FIXTURE-INVENTORY.md`, and the moved set is a measured zero.

## The sweep (Task 2)

- `test/unit/trap-death-repro.test.js` now sums the hero's `gained`, plus each Table 4 hp/maxHp `amount`, minus LOSS_FIELDS.
- tableFour is classified. memberSecondWind is neutral, since it heals a member.
- `bought` counts as a gain only when it carries `gained`.
- **Counts:** 595 actions checked, 268 of them gain-bearing (the floor is ≥ 20). 1,451 were skipped as unclassified, and 46 traps were seen.
- **Runtime:** about 13.4 s, well inside the 60 s budget.

## Re-pinned tests

- `test/unit/encounters.test.js`: the encounterDot +10 HP row now pins `amount`/`stat`/`row` and number-free prose.
- `test/unit/hp-growth-linear.test.js`: the toll pins `amount === -15` at identity and number-free prose.
- `test/unit/movement.test.js`: the dot row pins `stat: "hp"`, `amount: 0`, since the hero is already at max.
- `test/unit/summoner-heal.test.js`: 8 `deepEqual` event shapes gain `gained`.
- `test/unit/narrativeLines.test.js`: the tableFour line pins the new prose plus "−13 hp".
- **Declared regeneration** of `test/unit/fixtures/event-order/default-fold-corpus.json` (`MZ_REGEN_EVENT_ORDER_CORPUS=1`): only two recorded `rested` events gained `"gained": 2`. Every recorded line is byte-identical.

## New strings (voice record)

**Oracle** (the rail twins are shorter):
- A capped heal: `+3 hp from Heal (8 rolled, back to full).`
- A heal at full: `Heal: nothing to restore. You were already at full hp.`
- A potion: `+3 hp (21 rolled, back to full; 2 potions left).` At full: `The potion finds nothing to fix. You were already at full hp (2 potions left).`
- Regeneration: `+3 hp knits itself shut (7 rolled, back to full).`
- Found food: `Meat (+3 hp; worth 15, back to full).` At full: `Meat: you were already at full hp, so this one is for morale.`
- Second wind at full: `You remember why you came. You were already at full hp, so it is mostly a mood.`
- A Joiner's second wind at full: `Ada remembers why they came, already at full hp.`
- Cooking: `You cook what is left. +3 hp (worth 10, back to full), +1 ration.`
- The cloak at full: `The cloak finds nothing to knit. You were already at full hp. Ask again in twenty squares.`
- A store meal: `Bought: X. −20 wilmst. +3 hp (worth 12, back to full).`
- The table roll: `Table 4, roll 7: The dice decide — a toll.` The effect names are a small mercy / a cut / a lesson / a rare kindness / a hard lesson / a toll / a wardrobe audit.
- Table 4 effect lines:
  - `The maze extracts a toll you did not agree to. −19 hp.`
  - `A rare kindness — you come away tougher, for keeps. +31 max hp.`
  - `A hard lesson, and you actually learned it. +31 experience.`
  - A heal row at full adds ` You were already at full hp, so it goes to waste.`

**Rail twins:**
- `+3 hp (Heal), back to full.`
- `Potion +3 hp, back to full (2 left)`
- `Cooked: +3 hp (back to full), +1 ration.`
- `… −19 hp.`
- Each at-full case reads `…: you were already at full hp.`

**Voice checks:** 79-01's `tools/voice-inventory.mjs` is not in this worktree, so I ran the checks by hand on the rendered lines.
- There is no hyphen-minus before a digit; every signed amount goes through `signedText` (U+2212).
- There is no roll-under phrasing.
- HP is named HP (the `hp-not-wp` guard passes).
- `test/voice/safety-scan.test.js` passes.
- Each new Oracle line has a rail twin.

## Elven Joiner fix (extra scope, todo 2026-09-25)

**Measured at the base.** The member branch of the foe's swing starts from `foeToHitVs(state, "member")`, which read the HERO's race row:
- An Elven Joiner beside a Human hero read **5** faces, which is neutral: it was not thin-boned.
- A Human Joiner beside an Elven hero read **6**: the hero's trait leaked onto the member's body.

**The fix.**
- `engine/derived.js#raceFoeToHit(sheet)` is the one seam for a race's `foeToHit`.
- `foeToHitVs`/`foeToHitBreakdown` apply it for `vs === "hero"` only.
- `engine/combat.js#foeTurn`'s member branch applies the Joiner's own trait before its size term. The mod is named by the member's race, as the hero's is.
- It is a data read with no race-name check, and uses zero draws.
- It follows the 75.2 rulings "race signatures survive size" and "Joiners get size".
- **After:** an Elven Joiner reads 6 faces, and an Elven hero's Human Joiner reads 5. An Elven hero with an Elven Joiner is thin-boned once, never twice. The hero's own odds are unchanged.

**Moved pins and fixtures:** a measured zero.
- Parity 66/66, and the fixture files are byte-identical.
- The roster replays unchanged.
- These pass unchanged: `roll-high-state-pins`, `roll-high-save-compat` (the pre-switch save's `expected` was not re-recorded), `foe-turn-draw-count`, `bot-tactics` and `test/determinism/**`.
- Declared in FIXTURE-INVENTORY.md under Phase 79 / Plan 79-02.

**Balance:** no bot runs, per the user ruling. Phase 79.1 measures the effect.

## Gates

- `npm test`: **7,280/7,280 pass** (after every task, including the Elven fix).
- `node --test "test/parity/**/*.test.js"`: 66/66.
- `npm run boot:check`: PASS on all 4 checks (no-uncaught, painted, graves, title).
  - It needed a temporary `node_modules` junction to the main checkout. I removed only the junction afterwards, the target is intact, and www/ was not committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing honesty] A store meal's HP gain was silent**
- **Found during:** Task 1 (the clamp-site scan).
- **Issue:** `STORE_EFFECTS.eatRation` clamped a hero HP gain but pushed no event, so the guard had nothing to pair it with.
- **Fix:** `buyFrom` merges an effect's returned fields into its `bought` event, and eatRation returns `{ gained, meal }`. The Oracle and rail `bought` lines add the gain. There is no new event type.
- **Commits:** 914e5fab, 09aee3a5.

**2. [Rule 1 - Bug] Re-pinned tests outside the plan's file list**
- `test/unit/movement.test.js` and `test/unit/summoner-heal.test.js` pinned the old event shapes or prose. I re-pinned them to the new additive fields.

**3. [Extra scope, orchestrator-routed] The Elven Joiner fix also removes the hero-race leak**
- One source of truth needed the member branch to stop inheriting the hero's race term. Without that change, an Elven hero with an Elven Joiner would have counted the trait twice.

### Found, not fixed (handed on)

- **Other hero terms still leak into a Joiner's odds.** `foeToHitVs(state, "member")` still applies the HERO's Acrobat override (`h = 3`), Guard −1, gear `eff(c, "foeToHit")`, Mirror Self and invisibility. The member branch's foe die `foeDie(c, f)` also uses the HERO's race `foeStrikeStep` (Dwarven). These are the same class of bug as the Elven one but outside this todo, and fixing them could move pins. A user or orchestrator decision is needed.
- **`strengthCast` (the Strength spell) raises current HP by the boost but no line narrates the HP.** The event carries no `gained`, so the sweep skips those actions as unclassified. Handed to 79-08 (the powers domain).
- **The why-ledger `before` values follow test/voice/safety-scan.test.js's BASE_EVENT**, as 79-01's validator requires. Because of that:
  - The `bought` rows read "[object Object]", since BASE_EVENT.item is an object.
  - The `oracle:encounterRolled` row's `before` ("… — -15 HP.") matches a base rendering only if 79-01's variant list renders a Table 4 cell. If `--check-ledgers` rejects it after the merge, that row's trigger variant needs adding (79-12 owns variant extensions).

## Known Stubs

None.

## Threat Flags

None. There is no new network, auth, file-access or serialized-state surface.

## TDD Gate Compliance

Task 1 has test(20e79824) followed by feat(914e5fab). Task 3 has test(e5b4777d) followed by feat(09aee3a5). The Elven task has test(d4609b00) followed by fix(57cb14e5). Task 2's sweep extension was committed as a single test commit, since the task is test-only.

## Self-Check: PASSED

- Created files exist: test/unit/honest-gains.test.js, test/unit/joiner-race-to-be-hit.test.js and docs/narrative-pass/why/79-02.json.
- Commits 20e79824, 914e5fab, df159760, e5b4777d, 09aee3a5, d4609b00 and 57cb14e5 are present on the branch.
