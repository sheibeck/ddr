# Phase 79: Content & Narrative Pass - Context

**Gathered:** 2026-09-25 (collected ahead, while Phase 72 wave 5 executed)
**Status:** Ready for planning

<domain>
## Phase Boundary

Every piece of in-game text reads honestly and consistently in the game's voice:
- VOX-04: every sub-class and race blurb names both its advantage(s) and disadvantage(s), including school gates.
- ROLL-04: no player-facing string still encodes roll-under phrasing.
- VOX-05: every line states clearly what happened, to whom and why, sarcastic and family-friendly.

**Presentation and content text only.** The engine gate is untouched and no parity fixture moves. Content `txt`/`note` strings are compared by some comparables; if one is, carve it out or declare it per the stripCloakArmorTxt precedent.

**Not in scope:**
- Rules changes.
- Display formatting of numbers (Phase 74's formatter is reused, not changed).
- New features.
</domain>

<decisions>
## Implementation Decisions

### Blurbs and roll phrasing (user accepted 2026-09-25)
- **VOX-04 blurbs:** keep each `SUB_NOTE`/`RACE_NOTE`'s sarcastic prose, and add a compact MECHANICAL FOOTER under each blurb, generated FROM the rules tables so prose and rules can never drift.
  - The tables are `MU_CHART` bonuses and school gates, `spell-level-overrides.js`, the race modifiers, and the Phase 24 IDENT table / `docs/CLASS-PASS.md`.
  - A unit test pins that every sub-class with a gate names its level in the footer (the Summoner: "no offense spell until level 3"), and that every sub-class and race states at least one advantage and one disadvantage.
  - Both the roller reel and the Hero tab read `SUB_NOTE`. Where the footer shows on each is the planner's call, within space limits.
  - Phase 75.1's new Pilfer bad (fumbling magic items) and scroll rules are already in their blurbs; verify they're consistent.
- **ROLL-04 phrasing:**
  - Where the die is FIXED (d20 checks, d10 locks/climbs), text states the Phase 74 range format: "foes find you only on a 20 (19–20 if you insulted them)", "Weaken: they hit only on 18–20".
  - Where the die SCALES with level (the hero's strike die d20→d6), text speaks in faces: "only your die's top face lands", "one face better".
  - Covers every item in `docs/ROLL-LEDGER.md` "Handoffs → Phase 79": Mirror Self, the Crystal Staff, Weaken, Smoke (currently written roll-under "natural 1 … 1–2"), `sp.toHit` bestiary notes (Zit, Drat, Stink Bug, Skeleton), the Shadow's dagger/magic note, and bare signed to-hit numbers without a cue.
  - A DOC-SYNCED TEST scans every player-facing string (content txt/note, EVENT_NARRATION templates, line banks, panel copy) for roll-under patterns ("1–N" as a to-hit range, "need N", "natural 1", "N or under/less", "−N on to-hit") and fails on any.

### The narrative pass — VOX-05 (user accepted 2026-09-25)
- **Review model: Claude drafts; the user reviews at milestone close.** This follows the deferred-UAT protocol, so there are no mid-run pauses.
  - The phase produces a before/after REVIEW PAGE grouped by surface, with each changed line, the event it describes and why it changed.
  - The user reads it at milestone close alongside the Pixel 7 checklist. Any tone changes the user wants go into one quick follow-up.
- **The rubric for every line:**
  1. States what happened, to whom and with what result (numbers where the player needs them).
  2. Reads naturally aloud, with no stilted or translated-sounding phrasing.
  3. The deadpan, family-friendly joke comes AFTER the fact, never instead of it.
  4. Is accurate to what the engine actually did, so the narration never contradicts the event.
- **Scope:** everything player-facing.
  - The Oracle and every `EVENT_NARRATION` template, `narrationLines` banks, rail cards and the fight log.
  - Refusal reasons, item/spell/ability text and epitaphs.
  - Panel copy (hero, gear, store, camp, title, settings, boards), the v2.0 board lines/footnotes/"you placed X" bank, and the new effect-chip descriptions (Phase 77).
- **How much changes:** ONLY lines that FAIL the rubric are rewritten. Lines that pass stay word-for-word, to minimise churn and snapshot re-pins.
- **Guardrails:** `content/safety-wordlist.js` checks stay green. Re-pin any exact-string tests deliberately. Keep the "HP not WP" and "Dungeon / Game Master" naming rulings. Family-friendly: no profanity, gore or adult content, and never name a diagnosis (Pilfer).

### Claude's Discretion
- The inventory tooling (e.g. a script that dumps every player-facing string with its trigger into a table), the review page format (an HTML artifact or `docs/` page), and plan split by surface.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content/flavor.js` (`SUB_NOTE`, `RACE_NOTE`), `content/classes.js` (`MU_CHART`, subs), `content/spell-level-overrides.js`, `content/abilities.js`, `content/skills.js`, `content/spells.js`, `content/treasure-tables.js`, `content/bestiary.js` notes, `content/safety-wordlist.js`.
- `src/browser/eventNarration.js` (EVENT_NARRATION templates, with a coverage guard) and `src/browser/narrationLines.js` (line banks).
- `docs/ROLL-LEDGER.md` "Handoffs → Phase 79": the concrete list of roll-under strings.
- The todos: `2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md`, `2026-09-23-narrative-pass-clarity-cleanup-of-every-in-game-line.md`.

### Established Patterns
- Frozen copy objects voice-scanned by tests. Shell snapshot fixtures pin rendered text.
- Content text edits that reach state are carved out of the comparables (stripCloakArmorTxt precedent).

### Integration Points
- Phases 74, 75.1 and 77 all add or change text. This phase runs after them and sweeps their lines with the same rubric.
</code_context>

<specifics>
## Specific Ideas

- The user's standing voice: heavy sarcasm and dark humor, self-aware and deadpan, but family-friendly. "The darkness is in the wit, not the shock."
- The Summoner example: the blurb must say "not one offense spell until level 3".
</specifics>

<deferred>
## Deferred Ideas

- A full voice rewrite of lines that already pass the rubric: not wanted.
</deferred>
