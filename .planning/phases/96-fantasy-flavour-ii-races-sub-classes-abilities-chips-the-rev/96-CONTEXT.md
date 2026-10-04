# Phase 96: Fantasy Flavour II: Races, Sub-classes, Abilities, Chips & the Review - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Race, sub-class and class blurbs, ability descriptions and condition-chip explanations read as fantasy flavour. Each identity blurb still tells the player what that race or sub-class is good and bad at (FLAVOR-03, FLAVOR-04). Every player line written in Phases 95 and 96 passes the family-friendly scan and a recorded narrative review (FLAVOR-06).

This builds on Phase 95's two-layer model (`docs/TEXT-LAYERS.md`, "Adding a domain (Phase 96)"):
- the flavour goes in keyed maps registered in `FLAVOR_DOMAINS`;
- the exact rules text stays where it is and sits behind the RULES reveal and the "Always show the rules" setting;
- every existing guard keeps pinning the rules layer.

Out of scope:
- the Phase 94 ability state labels and gate reasons, which stay plain and exact;
- Oracle, rail and fight-log narration (reviewed in v2.1 Phase 79).

</domain>

<decisions>
## Implementation Decisions

### Race, sub-class and class blurbs (user, 2026-10-03: accepted as proposed)
- **Shape:** up to two sentences, about 200 characters at most, with no numbers, dice or percentages. The house voice applies: sarcastic, deadpan, family-friendly. One sentence is too tight to carry both a good and a bad, so the identity domains get their own length and sentence rule in `flavor-layer` (the per-domain rule that TEXT-LAYERS.md step 4 allows). The other domains keep Phase 95's one-sentence rule.
- **Good and bad are guarded by tags.**
  - Each identity flavour entry carries its line plus the identity good and bad it hints at. The tags are keys or ids from the identity table (`content/identity.js` / the Phase 24 identity contract).
  - A test checks that every race and sub-class blurb is tagged with at least one real good and one real bad of that race or sub-class, so none loses its good or its bad (ROADMAP criterion 1).
  - The narrative review checks that the wording actually conveys them.
  - The map's shape must still let `FLAVOR_DOMAINS` `lines()` return plain strings for the shared scans.
- **Class blurbs (`CLASS_NOTE`, 4 classes) are included.** They sit on the same card.
- **Surfaces:** the character roller's race and sub-class picks, and the Hero tab identity card. Flavour shows first. RULES holds today's `RACE_NOTE` / `SUB_NOTE` / `CLASS_NOTE` text and the mechanical identity footer (`src/browser/identityFooter.js#footerLines`), all unchanged. Every identity guard (identity-text, identity-footer, identity-contract, authored-ranges and the rest) keeps pinning them byte for byte.

### Abilities and chips (user, 2026-10-03: accepted as proposed)
- **Ability descriptions:** one flavour sentence each under Phase 95's rules. The ability's `txt` (`content/abilities.js`, the Bard's Sing included) goes behind RULES. They show in the combat ABILITIES submenu and the Hero tab ability list.
- **The Phase 94 state labels and gate reasons stay plain and exact** (READY, READY IN N, the reasons, SPENT THIS FIGHT).
- **Condition chips:** a chip tap's card shows a flavour line first. The exact `CONDITION_EXPLAIN` text sits behind RULES, reusing the rail line's `rules` property from 95-05, the reuse point that plan named. This applies to every condition chip, harmful and helpful.
- **Special skills (`content/skills.js`):** they get flavour only where the player reads them as a separate description; the planner maps those surfaces. Rows that are already covered by an ability description get no second line.

### The review (FLAVOR-06) (user, 2026-10-03: accepted as proposed)
- **Mechanism:** reuse the Phase 79 why-ledgers and the narrative-review page (`node tools/narrative-review.mjs`, `docs/narrative-pass/review.html`). The page lists every Phase 95 and 96 player line with its verdict.
- **Verdicts:**
  - A separate reviewer agent reads every Phase 95 and 96 line against the house-voice checklist: sarcastic, family-friendly, no numbers, never contradicts the rules text, and conveys the good and the bad where tagged.
  - It records pass or revise per line in the ledger or on the review page.
  - Lines marked revise are rewritten and re-reviewed.
  - The user's own read of the page joins the v2.4 milestone device checklist (deferred-UAT protocol).
- **The "no rulebook sentence left" proof (ROADMAP criterion 4)** has two parts:
  - An automated sweep: on every surface that shows a player-layer description (Gear, store, loot and find, spells, Hero, combat, chip taps, title or roller), the flavour slot states no number, die or percentage, and the RULES body equals the unchanged rules text.
  - The deferred device walk.
- Every new line passes the family-friendly safety scan (`content/safety-wordlist.js`) and the voice-inventory checks: roll-under, hygiene and safety count 0.

### Claude's Discretion
- The exact identity-flavour map shape (for example `{ line, good, bad }` records with a `lines()` adapter) and the tag vocabulary, as long as the tags come from the identity table.
- Where the roller shows the RULES reveal, within the existing roller layout and touch targets.
- The reviewer agent's checklist format and where the verdicts are recorded.
- Each line's wording, within the tone rules.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 95 (`docs/TEXT-LAYERS.md`):
  - `src/browser/flavorText.js` (`FLAVOR_DOMAINS`, `flavorOf*`, `everyFlavorLine`);
  - `src/browser/rulesLayer.js` (`RULES_COPY`, `mountRules`, `window.__mzRules`, `setAlwaysRules`);
  - the "Always show the rules" setting;
  - the `lead` / `rules` / `rulesId` row shape;
  - `test/unit/rules-surfaces.test.js`, `flavor-layer`, `flavor-drift`, `flavor-not-serialized`.
- `content/flavor.js`: `RACE_NOTE`, `CLASS_NOTE`, `SUB_NOTE`. These are long, voiced, and full of numbers.
- `src/browser/identityFooter.js#footerLines`: the mechanical footer on the Hero tab.
- `content/abilities.js`: `ABILITY_BY_ID[...]` rows with `txt`.
- `CONDITION_EXPLAIN` and `CONDITION_COPY` in the shell (`src/browser/heroConditions.js` notes they stay in the shell).
- The rail card's `rules` line property (95-05).

### Established Patterns
- Keyed frozen maps beside the content and never on a serialized row. Lookup is by name, so saves are untouched.
- New-line ledger rows in `docs/narrative-pass/why/y-96-NN.json`, with the review pages regenerated.
- Declared shell-snapshot regeneration only. `MZ_SNAPSHOT_UPDATE=1` can rewrite unrelated fixtures with line-ending-only changes, so restore those.

### Integration Points
- The Hero tab identity card and ability list (`src/browser/heroTab.js`), the character roller (title flow), the combat ABILITIES submenu (`src/browser/combatMenu.js`), and the chip card in `mazeworld.html`.

</code_context>

<specifics>
## Specific Ideas

- The current blurbs already joke, e.g. Barbarian: "Two attacks a round and half the experience points, on the sound principle that a man swinging twice is learning nothing either time." The flavour keeps that energy without the numbers.

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope.

</deferred>
