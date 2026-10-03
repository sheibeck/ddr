# Phase 94: Ability States You Can Tell Apart - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

In a fight, a player can tell at a glance which abilities are Ready, Recharging ("ready in N"), Can't use now (with the gate's reason on the row) or Spent this fight, by words and row shape as well as colour (ASTATE-01..05). The engine owns the state (ASTATE-04): a pure, additive, derived function, with zero rng draws and nothing newly serialized, which the view only reads.

Source: backlog 999.20 (user, on 2.3.0): "Differentiate an ability that is on cooldown from one that is not usable and one that is not active. Some sort of color difference."

Not in this phase (Future Requirements): a fifth "Active" state (chips already show running effects), the same states on spells, item rows, and any light theme.

</domain>

<decisions>
## Implementation Decisions

### How the four states look (user, 2026-10-03)
- **Full-word labels** in the row's state slot:
  - READY. A ready once-a-fight row keeps "READY · ONCE PER FIGHT".
  - Recharging reads "READY IN N" (N = rounds left, singular "READY IN 1"). It replaces today's "N ROUNDS".
  - Can't use now reads the gate's own reason in plain words, e.g. "NEEDS TWO OR MORE FOES" or "ALREADY ON IT" (today's copy), plus a plain reason for every other engine refusal reason (noTarget → "NO FOE IN REACH", notLowEnough → its hp gate in plain words, etc.).
  - Spent reads "SPENT THIS FIGHT" (replaces "ONCE PER FIGHT · SPENT").
  - Labels are functional and plain. Phase 96's flavour pass must not rewrite them (already a roadmap boundary).
- **Non-colour cue = the label words plus a row edge style:** solid edge (Ready), dashed (Recharging), hatched/patterned (Can't use now), faded with no edge (Spent). No glyph icons: the pixel font may lack them.
- **Four colour families:** Ready = the existing green-gold "good" ink; Recharging = amber (the condition strip's `warn` tone); Can't use now = rust red (the `bad` tone); Spent = dim grey. Recharging and Spent stay in separate families (one comes back this fight, the other doesn't). Colours are CSS tokens defined once.
- **Tapping a non-ready row stays as today:** it remains tappable, dispatches, and the engine's refusal line lands in the fight log, so a tap always agrees with the label.

### Scope and the engine contract (user, 2026-10-03)
- **Surfaces:** the combat ABILITIES submenu (`src/browser/combatMenu.js` `abilityRows`, including the Bard's Sing row) and the Hero tab's abilities list (`src/browser/heroTab.js`, which shows READY / N ROUNDS / ONCE A FIGHT today). Both read one engine function.
- **Joiners:** the engine function takes any sheet (hero or Joiner) and is pinned for both. Joiners auto-act and have no ability menu, so their states show only where a Joiner's abilities are already listed (the Company panel), with the same labels.
- **Themes:** the dark theme only (the one shipped; the light theme was retired). Pinned by shell snapshot, plus a greyscale and colour-blind (deuteranopia and protanopia) distinguishability check in tests. ASTATE-05's wording becomes "readable in the shipped theme and for colour-blind players".
- **Engine contract:** a pure derived `abilityState(state, sheet, key)` in `engine/abilities.js` returns `{ state: "ready" | "recharging" | "unavailable" | "spent", roundsLeft, reason }`. It is built from the existing `isReady`, `abilityRoundsLeft`, `abilityUnavailableReason` and `abilityTargetShortfall` checks. `useAbility`'s refusals use the same function, so the label and the tap can never disagree. No rng draw and nothing serialized (no `*Comparable()` change). Parity fixtures must not move.

### Claude's Discretion
- Exact token names and hex values (meeting a contrast target against the dark panel), the hatch pattern technique, and the plain wording for each remaining refusal reason (house style: uppercase on the row, plain, exact).
- Whether the hero-cannot-act menu interacts (it replaces the menu; likely untouched).
- How the colour-blind check is implemented (e.g. a pure luminance and edge-style distinctness test over the four tokens).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/abilities.js`: `abilityTargetShortfall` (L181), `abilityUnavailableReason` (L193), `abilityRoundsLeft` (L220), and `useAbility`'s refusal ladder (~L320-374): unknown, notInCombat, spent, cooldown, noTarget, tooFewFoes, alreadyOn, notLowEnough.
- `engine/effects.js#isReady`.
- `src/browser/combatMenu.js`: `abilityRows` (~L178), `COMBAT_MENU_COPY` ability strings (L46-60), and the Sing row (~L361-375).
- `src/browser/heroTab.js`: `ABILITY_VIEW_COPY` (~L177) and the ability state line (~L194-211).

### Established Patterns
- Rows are view-model objects `{ id, label, cost, desc, enabled, dispatch }`. The shell draws `enabled: false` with one shared disabled style.
- The condition strip's tone vocabulary (`good` / `warn` / `bad` / `odd` CSS variables in `mazeworld.html`) can seed the four tokens.
- Shell snapshot and a11y tests exist under `test/unit` (the snapshot harness `test/unit/harness/shellSandbox.js`).

### Integration Points
- The combat submenu renderer in `mazeworld.html` (where `.enabled` maps to the disabled style) must read the new `state` field.
- The Joiner Company panel (heroTab), if it lists Joiner abilities.

</code_context>

<specifics>
## Specific Ideas

- User (999.20): "Differentiate an ability that is on cooldown from one that is not usable and one that is not active. Some sort of color difference."

</specifics>

<deferred>
## Deferred Ideas

- Fifth "Active" state; ability states on spells and items; a light theme (none ships).

</deferred>
