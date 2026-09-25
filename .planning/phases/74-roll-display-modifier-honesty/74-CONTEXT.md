# Phase 74: Roll Display & Modifier Honesty - Context

**Gathered:** 2026-09-25 (collected ahead, while Phase 72 wave 5 executed)
**Status:** Ready for planning

<domain>
## Phase Boundary

Every roll and modifier the player sees is a direct, honest read of the engine's own high-is-good numbers (ROLL-02, ROLL-03). This builds on Phase 73:
- The engine is roll-high.
- Events carry the mirrored `roll`, the lowest winning face and `dieN`.
- Derived functions (`toHit`, `foeToHitVs`, `memberToHit`, `fleeBreakdown`, parley) return winning FACES, so the range on a dN is `(N+1−faces)–N`.

**In scope:**
- The Oracle and fight log. Phase 73 already moved their event lines to the final "17 vs 18–20" shape; this phase re-signs their modifier lists.
- Dice reveals.
- Rail cards.
- The hero sheet (`src/browser/heroTab.js`: TO STRIKE `d20`, TO HIT `1–5` today).
- The combat menu (`combatMenu.js` "d20, 5 to hit").
- Foe details (`foeDetails.js` "Hit only on a {n} or under") and foe condition chips (`foeConditions.js`).
- Item, loot, store and find comparisons (`upgradeWhy.js`).
- The fight log's need breakdown (`needModsClause`/`needModsText`, `eventNarration.js:81-89`).
- Any other surface that prints a roll, range or modifier.

**Not in scope:**
- Engine changes (Phase 73 is done).
- Rewording rules/content TEXT that encodes roll direction ("natural 1", "need a 3", "hittable only on a 4" in `content/` notes). That is Phase 79 (ROLL-04). This phase changes the NUMBERS and SIGNS a surface computes and prints, not authored prose.
</domain>

<decisions>
## Implementation Decisions

### How odds read on screen (user accepted 2026-09-25)
- **Range format:** a winning range is written "lo–hi" in the user's own form, e.g. "16–20". It is used identically on EVERY surface, and a single winning face reads "20".
  - Name the die where it isn't obvious: "hit on 16–20 (d20)".
  - No "16+" shorthand and no percentages.
- **Oracle and fight-log roll lines** keep today's shape with the new numbers: "**17** vs 18–20 (light blade +1). You miss it."
  - The modifier list follows the range, and the old "(needs 5: …)" repeat is gone.
  - Phase 73 already switched the event-driven lines to this shape. This phase finishes the modifier signs (below) and any line Phase 73 didn't own.
- **A foe's roll against you** uses the same line shape from the foe's side, with modifiers signed from YOUR view: "The Zit swings, **12** vs 19–20 (your Sidestep +2, insulted −1), and misses." Your defenses always read as +.
- **Hero sheet, combat menu and foe details:**
  - The hero sheet and combat menu show "Hit 16–20 (d20)" on the current strike die. This replaces `1–${toHit}` and "5 to hit".
  - Foe details show both directions against the hero RIGHT NOW: "You hit it on 17–20 · it hits you on 16–20", with the live modifiers applied. The old "Hit only on a {n} or under" becomes a real range. Untouchable/magic-only/dagger-only foes keep their existing rule line.

### Modifier signs everywhere (user accepted 2026-09-25)
- **Sign rule:** every displayed modifier is signed from the PLAYER's side: + is better for you, − is worse. This holds on foe lines too: Battle Roar reads "+2", an insulted foe reads "−1", Sidestep "+2", Guard "+1".
  - The engine's `needMods` deltas are signed for the ROLLER, so hero-roll lines print them as they are and foe-roll lines print them negated. One formatter owns that flip, keyed on who rolled.
  - This closes the ROLL-LEDGER "Handoffs → Phase 74" `needModsClause` item.
- **Item, loot, store and find comparisons:** "+1 to hit" / "−2 to hit" and "AR +2" keep their bigger-is-better meaning. Comparisons say which way is better, e.g. "−2 to hit, worse than your Sword".
  - AR stays a stat ("AR 6").
  - A soak RANGE appears only where a soak roll is printed ("soaks on 15–20").
  - This closes the ledger's device-trigger case: the dropped heavy weapon's "−2 to hit".
- **Condition chips** state their effect from your side, with the resulting range where one exists: "Afraid: −3 to hit (now 19–20)", "Weakened: it hits you only on 18–20".
  - Spell and ability TEXT rewording stays in Phase 79. Only chip numbers and signs change here.
- **Consistency guard:** ONE signed-modifier formatter feeds every surface. A guard test fails if the same modifier renders with opposite signs on two surfaces (success criterion 3), and it pins the range format.

### Claude's Discretion
- Formatter module location/name.
- How the foe-details "right now" ranges are computed (they reuse the engine's derived functions with the live combat state, never a re-derived formula).
- Exact chip wording within the voice rules (family-friendly, dry). Keep "HP not WP" (standing ruling).
- Plan split.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/eventNarration.js`:
  - `needModsText`/`needModsClause` (L81-89), currently used by `strikeMissed`, `struck`, `memberStruck`, `foeMissed`, `struckByFoe` and `spellThrown`.
  - The line templates `strikeMissed` (L384), `struck` (L397), `foeMissed` (L550) and `struckByFoe` (L578).
- `src/browser/heroTab.js:173/179`: the `toStrike` `d${strikeDie(c)}` and `toHit` `1–${toHit(state)}` rows (the character sheet view model is shared with `combatMenu.js:147`).
- `src/browser/foeDetails.js`: `FOE_DETAILS_COPY` (`toHit: "Hit only on a {n} or under"`, `ar: "AR {n}"`), voice-scanned by `test/unit/foeDetails.test.js`.
- `src/browser/foeConditions.js`: condition chip copy (e.g. "to hit while it naps").
- `src/browser/upgradeWhy.js`: `swingText`, `upgradeWhyText`. The U+2212 minus-sign convention is already in use.
- `src/browser/rail.js`: a rail line can carry `{text, roll}`.

### Established Patterns
- Copy objects are frozen and voice-scanned by tests. The U+2212 "−" minus is used, never a hyphen.
- Shell snapshot fixtures (`test/unit/fixtures/shell-snapshots/*.txt`) pin rendered sheets and stores. Regenerate them deliberately when a surface changes.

### Integration Points
- Phase 73's event fields: the threshold field name is chosen by Phase 73's planner. Read `73-CONTEXT.md` and its SUMMARYs.
- Phase 77 (CMBUI-13 effect indicators) will show ability/spell effects with rounds left. Its chips should reuse this phase's formatter.
- Phase 79 rewrites authored prose. Don't touch `content/` notes here beyond what a surface's computed numbers need.
</code_context>

<specifics>
## Specific Ideas

- The user's trigger: a dropped weapon read "−2 to hit", and they couldn't tell if it was better or worse. After this phase, − always reads worse and + always reads better, on every surface.
- "On a d20 a caster needs 18–20, a thief 17–20 and a fighter 16–20": the hero sheet must show exactly that at level 1.
</specifics>

<deferred>
## Deferred Ideas

- Percent-chance readouts: rejected for now in favour of ranges.
- Prose rewording of roll-direction text → Phase 79.
</deferred>
