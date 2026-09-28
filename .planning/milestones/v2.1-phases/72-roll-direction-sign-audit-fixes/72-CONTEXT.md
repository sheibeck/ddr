# Phase 72: Roll-Direction Sign Audit & Fixes - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit every modifier that feeds a die check, and fix every one whose effect on the roller's odds contradicts what it claims. This happens in today's roll-under engine, BEFORE Phase 73 mirrors the engine to roll-high. Three sign/ordering fixes are already known (ROLL-01 a/b/c), plus the latent Thief `evasion` inversion.

**In scope:** ROLL-01. This covers every die check (to-hit both ways, soak, thrown spells, resistance, initiative, flee, parley, traps, locks, climbs/leaps, cures, wake, drops, gates, summons, crits), every modifier source that folds into them (weapons, armor, spells, abilities, items, races, sub-classes, conditions, terrain/darkness, tuning dials), the three known fixes, and the evasion sign.

**Not in scope:**
- The roll-high mirror (Phase 73).
- Any display or narration sign changes (Phase 74, ROLL-02/03). This includes `needModsClause` printing deltas in opposite senses on hero-need and foe-need lines; record it in the ledger, do not fix it here.
- Rewording roll-direction phrasing in content (Phase 79, ROLL-04).

The one exception is a content `note`/`txt` edit that a rules fix below directly requires (M&M's note, the Smoke text if needed). Those are allowed here.
</domain>

<decisions>
## Implementation Decisions

### Ledger & method
- **Form: a direction test plus a short ledger doc.**
  - Add a test (e.g. `test/unit/rollDirection.test.js`) that, for every modifier source, computes the roller's success probability with and without the modifier and asserts the change has the direction the modifier's player-facing text or name claims: a bonus raises the roller's odds, a penalty lowers them.
  - It asserts on ODDS (the fraction of die faces that succeed), not on raw need arithmetic, so it survives Phase 73's mirror unchanged. That's the point: Phase 73 must be able to run it untouched.
  - `docs/ROLL-LEDGER.md` summarizes the inventory: site, die, who rolls, modifier sources, claimed direction, verified direction, verdict.
  - Extend, don't redo, `.planning/milestones/v1.3-phases/31-combat-start-gating-effect-hygiene/31-ROLL-DIRECTION-AUDIT.md` (34 sites, commit b92ce09).
- **When code and text disagree, the text wins.** Player-facing text (content `txt`/`note`, ability/spell/item descriptions, narration) is the promise.
  - Exception: where the text contradicts the 1994 rulebook/prototype canon, list the case for a user ruling instead of fixing silently.
- **New sign bugs found mid-audit:** fix them in this phase when the text backs the fix and the change is local. Stop with a `checkpoint:decision` when a fix needs a design ruling (text vs canon, or a noticeable difficulty swing). Never fix a canon-vs-text conflict silently.
- **Display-sign inconsistencies** are recorded in the ledger and handed to Phase 74. They are not fixed here.

### The known fixes (user rulings 2026-09-24; the user reasons in the upcoming roll-high terms)
- **(a) The parley insult vs the "only a perfect roll finds you" overrides. The INSULT STACKS, applied LAST.**
  - User's words: "a smoked hero is found on 1–2 means max die − 1. So on a d20 a 19–20 is a find. The bonus then is a literal +1 when insulted."
  - The Smoke / Mirror Self / invisibility / blinded-foe overrides first set the foe's need to the single best face. The insulted +1 is then applied on top as the final modifier: today's roll-under need 1 → 2, which becomes 19–20 after the Phase 73 mirror.
  - The HERO branch already does this (`engine/combat.js` ~L2549-2564: `foeToHitVs` overrides → blind → penalty → insulted). **The fix is the PARTY-MEMBER branch** (~L2436-2466). It applies insulted BEFORE the member's own Sidestep/Smoke, so Smoke resets the need to 1 and swallows the insult. Move the insult to the very end of the member branch so both branches share one order: overrides and conditions first, insult last.
  - Update the Smoke description (`content/abilities.js:56`, `content/skills.js:53`) and the Smoke/Mirror/invisibility narration only as far as needed to stay true, e.g. "foes need a natural 1 to find you (a 1–2 if you insulted them)". Phase 79 re-phrases it to roll-high later.
- **(b) Fridgian frenzy's second swing = your normal to-hit, one worse.**
  - Replace the canon hard-set `need = a === 1 && R.frenzy ? 3 : toHit(state)` (`engine/combat.js` ~L611; prototype-master L1909) with the normal to-hit narrowed by one, `Math.max(1, toHit(state) - 1)`.
  - All the per-target and condition rules already applied after it (dozing, `sp.toHit`, `fast`, `magicOnly`, Overhead Blow, Afraid, dark cap via `toHit`) keep applying.
  - This is a DECLARED divergence from the 1994 rules: canon 3 → fighters' frenzy improves 3→4, magic users' drops 3→2. Keep the floor at 1 unless the target is untouchable (need 0).
  - Update the Fridgian race note (`content/races.js`) if it states the swing's odds.
- **(c) Skeleton shatter: rolling the best face of your die shatters it.**
  - User's words: "Rolling max on your dice triggers the shatter."
  - Any to-hit roll against a Skeleton (`sp.critOn: 1`) that shows its die's best face (a natural 1 in today's roll-under engine, the max face after Phase 73) destroys it outright, including its second `twice` life.
  - Wire `critOn` as the engine field (rename it to something truthful, e.g. `shatterOnBest`, if clearer) with an event and narration line.
  - Drop M&M's "criticals on a 1" clause from its note. Every foe is already crittable on a best roll, so the note promises nothing special. It is a text-only change and the field goes if unused.
- **(d) Thief `evasion` dial: flip its sign now.** `classEvasionFor` (`engine/difficulty.js` ~L584-591) is added into the foe's need in `foeToHitVs`/`foeToHitBreakdown` (`engine/derived.js` L1229, ~L1291), so a positive "evasion" would make thieves EASIER to hit. Make a positive evasion SUBTRACT from the foe's need (harder to hit). The value is 0 at identity, so behaviour is unchanged and no fixture should move. Fix the JSDoc too.

### Engine gate (standing, every rules change)
- Engine stays pure and deterministic; no new rng draws except where a fix inherently needs one (none of the four should).
- Measure which parity fixtures each fix moves. Declare each moved fixture with before/after rationale in `test/parity/FIXTURE-INVENTORY.md` (divergence-records pattern) and regenerate ONLY those. `test/parity/prototype-master.js.txt` is never edited. Any new serialized field is carved out of the three `*Comparable()` functions in `test/parity/harness/comparables.js`, and every new event type gets an `EVENT_NARRATION` entry (coverage guard).
- Greenfield: no dual paths or legacy gates. Old saves load tolerantly.
- Take one bot readout (`tools/tune-difficulty.mjs`, 200 seeds) before and after the phase's fixes and record it in `docs/DIFFICULTY-RETUNE.md`. The frenzy change is the one expected to move difficulty measurably (Fridgian heroes only).

### Claude's Discretion
- For (c), which to-hit rolls count as "your dice" against a Skeleton. Recommended: every to-hit roll aimed at it, meaning hero weapon strikes, party-member strikes and thrown attack spells that roll to hit. Say which in the ledger.
- Test file names and ledger layout.
- Whether `critOn` is renamed or kept.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/milestones/v1.3-phases/31-combat-start-gating-effect-hygiene/31-ROLL-DIRECTION-AUDIT.md`: the 34-site inventory with verdicts. It's the base for the ledger.
- `engine/derived.js`:
  - `toHit` (L1125): classNeed, then inspired, `eff(toHit)`, `weaponNeedMod`, floor 1, dazed −2, dark cap 2 (waived by Night Vision / senses).
  - `classNeed` (L884).
  - `afraidNeed` (L1149): the last modifier, −3.
  - `foeToHitVs` (L1217): base 5, then race `foeToHit` (Elven +1, a deliberate Phase 31 change), Acrobat 3, Guard −1, `eff(foeToHit)`, `foeAccuracyFor`, Thief evasion, Battle Roar −2, Sidestep −2, then the Smoke/Mirror/invis overrides to 1.
  - `foeToHitBreakdown` (L1256): the narration-only mirror of the same terms.
  - `resistRoll` (L1427): d20 < intel.
  - `fleeBreakdown` (L948): roll-high, d20 + X ≥ 14.
- `engine/combat.js`:
  - `playerStrike` (~L600-690): strike die by level, Philly `slow` keeps the lower, frenzy L611, dozing/stupid ≥5, `sp.toHit` min, `fast` −1, `magicOnly` 0, Overhead Blow `needShift`, Afraid, crit `roll <= weaponCrit`.
  - The foe turn: the member branch (~L2424-2545) and the hero branch (~L2547-2600).
  - Pursuit (~L956).
  - Initiative (~L191).
- `engine/abilities.js`: `DURATION_ROUNDS` (L60) and the smoke case (L266). `engine/magic.js`: thrown spells `roll - bonus <= target` (L508, ally ~L1886). `engine/encounters.js`: traps, locks, affliction cure, wake and drops. `engine/movement.js`: climbs (L270) and leaps (L285).
- Content text that states directions:
  - `content/abilities.js` L43/45/51/56
  - `content/skills.js` L28/30/40/47/51/53
  - `content/spells.js` L93/95
  - `content/treasure-tables.js` L129/244
  - `content/bestiary.js` L48/63/124/151
  - `content/flavor.js` L34/36/41/43/56/63
  - `content/races.js` L23

### Established Patterns
- Roll-under almost everywhere: a hit is `roll <= need`, and a higher need is better for the roller. Foe-vs-hero is a miss on `roll > need`, where a lower need is better for the hero. Flee and initiative are the only roll-high sites.
- Modifiers adjust the NEED, never the roll. The one exception is thrown spells, `roll - bonus`, whose sign is correct.
- Phase 25 FEED-01: every need adjustment pushes `{ name, delta }` into `needMods` for narration. New or reordered terms must keep pushing correct entries.
- Fixture handling: `test/parity/FIXTURE-INVENTORY.md` and `test/parity/divergence-records.test.js`; `tools/fixture-inventory.mjs` measures the moved set.

### Integration Points
- Phase 73 consumes this phase's direction test unchanged. It must pass before and after the mirror, so write it in terms of success odds per die face count, never raw need numbers.
- Phase 74 consumes the ledger's display-sign findings.
</code_context>

<specifics>
## Specific Ideas

- The user now reasons in roll-high terms. Any user-facing explanation in the ledger should state both views, e.g. "insult: need 1 → 2 today = 19–20 on a d20 after Phase 73".
- The device trigger for the whole ROLL track: a dropped heavy weapon read "−2 to hit" and the user couldn't tell whether that was better or worse. The audit confirmed it WAS worse (heavy weapons narrow the range), so the modifier was right and only the presentation was ambiguous. The ledger should say so explicitly.
</specifics>

<deferred>
## Deferred Ideas

- Display/narration sign normalisation → Phase 74 (ROLL-02/03).
- Roll-under phrasing in content → Phase 79 (ROLL-04).
- Whether Elven `foeToHit +1` (a deliberate Phase 31 change away from canon) should be revisited. No request to revisit; leave it.
</deferred>
