# Phase 95: Fantasy Flavour I: The Text Layer, Spells, Scrolls & Items - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Players read short fantasy flavour for every spell, scroll, weapon, armour piece, magic item, potion, tool and bag. The exact v2.3 rules text stays in the game as a technical layer, one tap away, and every v2.3 truth guard keeps pinning it (FLAVOR-01, FLAVOR-02, FLAVOR-05). This phase builds the two-layer model and the in-game RULES surface that Phase 96 reuses for races, sub-classes, abilities and chips.

Source (user, 2026-10-02, on the v2.3 debug build): "the spell descriptions in game are too descriptive now. They read like a technical manual. I want fantasy flavor for the descriptions that show to the players for equipment, spells, race/sub-class, etc. Players see narrative, code sees technical."

Not in this phase: races, sub-classes, ability descriptions and chip explanations (Phase 96), Oracle, rail and fight-log narration lines (reviewed in v2.1 Phase 79, out of scope), the Phase 94 state labels (functional, they stay plain), and any rule or number change.

</domain>

<decisions>
## Implementation Decisions

### Where the exact numbers live in game (user, 2026-10-03)
- **A tap-to-reveal RULES line under the flavour** on every surface that shows an item, spell or scroll description: the Gear sheet, store, loot and find cards, the grimoire (spell list), and the combat SPELLS and ITEMS menu rows. Flavour shows first. One tap reveals the exact rules text (the technical layer).
- **A Settings switch, "Always show the rules", default OFF.** When on, every RULES line is shown expanded. The per-card tap still works when it's off. The switch persists like the other Preferences-backed settings.
- **Combat menu rows show the flavour plus the row's existing short functional tag** (e.g. "d10 hp", charges, cooldown). The full rules line sits behind the tap. These tags are functional, like the Phase 94 labels, and stay plain.

### Data shape and guards (user, 2026-10-03)
- **`txt` stays the exact rules text (the technical layer), and a new `flavor` field beside it carries the player line.** Every v2.3 guard (item-text-engine, authored-ranges, spell-audit, skill-audit, value-identity, identity tests) keeps pinning `txt` unchanged, so no guard is lost and the audit tables keep their row counts. Phase 96 reuses the same shape.
- **Three new tests prove it:**
  - every entry in scope with a `txt` (or a generated stat line) has a non-empty `flavor`;
  - no flavour line states a number, a die (dN) or a percentage, so rules can't creep back into the player layer;
  - a deliberately drifted number in a `txt` still fails its guard (a fail-first test, ROADMAP criterion 3).
- **Weapons and armour get one flavour line per type.** Their generated stat line ("d8 · −1 to hit" and the armour equivalent) is their technical layer and moves behind the RULES tap like everything else.
- Saved items: an old save's item carries its own `txt` copy. Flavour must reach old saves the same way item text does today (`refreshItemTexts` on load, or a lookup by name). Tolerant load only.

### Tone (user, 2026-10-03)
- **One sentence, about 90 characters or fewer.**
- **The house voice:** sarcastic, deadpan, family-friendly (no profanity, gore or adult content). It hints at what the thing does without numbers, e.g. Heal: "Closes wounds the polite way: quickly, and without asking how you got them."
- **No sample checkpoint:** Claude writes the full batch. The user reviews everything at the end on the narrative-review page (`node tools/narrative-review.mjs`, `docs/narrative-pass/review.html`). Every line passes the family-friendly safety scan (`content/safety-wordlist.js`) and the narrative-pass ledgers (new-line rows).

### Claude's Discretion
- The exact UI of the RULES affordance (a small "RULES ▸" toggle row, its styling and its tap target), within the existing sheet and card patterns and touch-target sizes.
- Where the Settings switch sits in the existing Settings sheet, and its key name.
- Each flavour line's wording, within the tone rules.
- Whether flavour lives inline in each content row or in one keyed table per content file (inline `flavor` beside `txt` is the default).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `txt` rules lines: `content/spells.js` (41 spells, e.g. Heal "healing · you · d10 hp"), `content/treasure-tables.js` (23 magic items), `content/potions.js` (10), `content/tools.js`, `content/bags.js`. Scrolls reuse the spells.
- Weapons (`content/weapons.js`) and armour (`content/armors.js`) have no `txt`; their stat text is generated (e.g. `bagArmorText` in `src/browser/gearTab.js` ~L462).
- Display sites that read `.txt`: `src/browser/gearTab.js` (~L347, 386, 430-462, 512), `combatMenu.js`, `heroTab.js`, `viewModels.js`, `rail.js`, `eventNarration.js` and `narrationLines.js` (narration stays out of scope).
- The narrative-pass tooling (`tools/narrative-review.mjs`, `tools/voice-inventory.mjs`, `tools/lib/voice-corpus.mjs` BANK_REGISTRY, `docs/narrative-pass/why/*.json` ledgers) and the safety scan.

### Established Patterns
- Settings live in a Settings sheet backed by `src/browser/storage.js` (Preferences, with a localStorage mirror).
- v2.3 guards pin `txt` strings and their numbers against the engine (item-text-engine, authored-ranges, value-identity, the spell and skill audits in `docs/*-AUDIT.md`).
- Phases 93 and 94 added "one rule everywhere" guard tests, a useful pattern for "flavour present, rules reachable".

### Integration Points
- Every card or sheet renderer that prints a description must print `flavor` plus the RULES toggle.
- Shell snapshot fixtures that print descriptions will move. These are text-layer moves, each declared (criterion 4).

</code_context>

<specifics>
## Specific Ideas

- "Players see narrative, code sees technical." (user, 2026-10-02)
- Tone example (accepted): Heal, "Closes wounds the polite way: quickly, and without asking how you got them."

</specifics>

<deferred>
## Deferred Ideas

- Races, sub-classes, ability descriptions and chip explanations: Phase 96 (same shape, same RULES surface).
- Rewriting narration lines: out of the milestone.

</deferred>
