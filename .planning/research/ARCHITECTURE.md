# Architecture Research

**Domain:** v1.5 "Meaningful Choices — Spells, Gear & Abilities" — integrating spell rework, activated abilities, magic-item cooldowns, terrain/phobias, darkness rendering, flee retune, Cutthroat murder, dead-foe targeting, and a Gear-tab split into an existing shipped, deterministic roguelike rules engine
**Researched:** 2026-09-17
**Confidence:** HIGH (every integration point below is a direct code read with file:line citations; no external doc lookups were needed for this pass — it is pure codebase archaeology). MEDIUM on the handful of explicitly-flagged open design calls (re-fog provenance tracking, water movement-cost side effects on cadence timers, ability-vs-passive-skill conversion scope).

## Standard Architecture (current, as-built)

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  mazeworld.html — DOM/canvas shell (draw(), paint(), renderEncounter,  │
│  renderGear/#s-carry, guardTap-wired taps, window.mz* action bridges)  │
├───────────────────────────────────────────────────────────────────────┤
│  src/browser/ — presentation view-models + narration (pure, no DOM):   │
│  combatMenu.js / combatPanel.js / rail.js / toasts.js /                │
│  eventNarration.js (EVENT_NARRATION, coverage-guarded) / viewModels.js │
├───────────────────────────────────────────────────────────────────────┤
│  engine/engine.js  applyAction(state, action) → {state, events}       │
│  (THE single chokepoint: validate → structuredClone → rehydrate rng    │
│   from state.rngState → dispatch by action.type → persist rng cursor)  │
├───────────────────┬───────────────┬───────────────┬───────────────────┤
│ engine/combat.js   │ engine/magic.js│ engine/         │ engine/         │
│ startCombat/fight  │ castSpell      │ movement.js     │ encounters.js   │
│ playerStrike       │ (kind switch,  │ move/newDay/    │ meetJoiner/     │
│ foeTurn, flee,     │  combatOnly    │ makeCamp/       │ resolveJoiner/  │
│ pickFoeTarget,     │  gate, resist) │ teleport/descend│ encounterDot    │
│ killFoe/liveFoes   │ drinkPotion/   │ (per-step ticks:│                 │
│ afterPlayerAction  │ readScroll     │ darkFor/haste/  │                 │
├───────────────────┴───────────────┤ invis/ether/     ├─────────────────┤
│ engine/items.js — takeItem/        │ acute/cloak      │ engine/state.js │
│ equipItem/unequipSlot/useItem/     │ heal/flight/     │ newRun, party   │
│ pendingLoot family                 │ spellCharge)     │ cap, addParty…  │
├────────────────────────────────────┴──────────────────┴─────────────────┤
│ engine/derived.js — strikeDie/toHit/foeToHitVs/eff/slotItems/conditionsOf│
│ /afraidNeed/afraidDamage/resistRoll/castableAttackSpells (cycle-free leaf)│
├───────────────────────────────────────────────────────────────────────┤
│ engine/maze.js — genFloor(depth,rng)/bfs/reveal; cell = {wall,seen,feat,dark}│
├───────────────────────────────────────────────────────────────────────┤
│ content/*.js — pure data tables (SPELLS, SKILLS, treasure tables, …)   │
├───────────────────────────────────────────────────────────────────────┤
│ engine/rng.js — seeded mulberry32; state.rngState persists the cursor  │
├───────────────────────────────────────────────────────────────────────┤
│ test/parity/harness/comparables.js — the parity gate every new field/  │
│ event/rng-draw must clear (strip helpers, run-flag precedent, etc.)    │
└───────────────────────────────────────────────────────────────────────┘
```

Every rule domain is a pure function of `(state, rng, events)` — no DOM, no `Math.random`, no global `S`. `state.combat`, `state.c` (the player), `state.floor` (the maze) and `state.party` are the objects every v1.5 mechanic reads and writes. The single hardest constraint this milestone must respect: **`engine/maze.js#genFloor` is called by `engine/state.js#newRun` and `engine/movement.js#descend` for every single run and every single floor transition, and it is exercised, unmodified, by every movement/combat/economy/magic parity fixture** — any new *unconditional* rng draw inside it changes the maze layout (and therefore the rng cursor consumed by everything downstream) for every fixture simultaneously. This is the single biggest parity landmine in the milestone (water terrain) and is called out in detail in §2 and in Parity/Testing Considerations below.

### Component Responsibilities (current vs. what this milestone touches)

| Component | Current responsibility | v1.5 touches it because |
|-----------|------------------------|--------------------------|
| `engine/maze.js` | Pure maze/floor generator; cell = `{wall, seen, feat, dark}` (maze.js:69, dark added maze.js:141-148) | Needs a new `water` cell flag — a new terrain type, parity-sensitive (§2) |
| `engine/movement.js` | `move()` per-step ticks (darkFor/haste/invis/ether/acute/cloak heal-regen/flight/spellCharge, lines 273-347); `descend()` (691-701); phobia penalties (heightsPenalty/waterPenalty, 56-63; trapped-panic, 230-236) | Water movement cost, re-fog tick, Cutthroat murder hook, more phobia triggers |
| `engine/combat.js` | `fight()`'s phobia trigger (343-405); `flee()` (777-842); `pickFoeTarget`/`playerStrike`'s dead-target retarget (461-462, 1463-1471); `killFoe` (632) | Flee retune, proactive dead-foe retarget, a home for ability-cooldown round-ticks |
| `engine/magic.js` | `castSpell()`'s kind-keyed if/else chain (140-439); `combatOnly` gate (85-88); RESIST_IMMUNE_KINDS (36) | New spell kinds (timed reveal), day-one damage spell wiring, scroll-castable-immediately |
| `engine/items.js` | Scalar weapon/armor equip (269-330, 537-634); `useItem`'s kind switch + `itemReady`/`every`/`usedAt` cooldown (775-1014); `eff(c,key)` sums ALL carried items unconditionally (derived.js:51-55) | One-worn-item-per-slot-type needs a real "worn" concept for cloak/jewelry (today only weapon/armor are scalar-equipped); magic-item use→effect→cooldown; one-shot tools |
| `engine/derived.js` | `eff`, `skill`/`skillTier`, `afraidNeed`/`afraidDamage`, `conditionsOf`, `castableAttackSpells`/`ATTACK_SPELL_KINDS` (cycle-free leaf module) | Natural home for a new shared timer/cooldown helper and an ability-availability query mirroring `castableAttackSpells` |
| `engine/encounters.js` | `meetJoiner`/`resolveJoiner` (465-521) — **today a Cutthroat's Joiner offer is refused outright** (line 473) | Must REVERSE this refusal for Cutthroat, then hook the murder chance elsewhere (descend) |
| `src/browser/combatMenu.js` | Four-action grid; ABILITIES submenu is a hard-disabled stub for every non-Bard, non-caster class (111-148) | Real ability rows plug into this existing seam |
| `src/browser/combatPanel.js` | `foeListViewModel` (60-107) already fully suppresses a dead foe's "TARGET" tag (76, 86-89) | Confirms the display-layer half of dead-foe targeting is already correct; only the numeric `C.target` and the tap-guard need work |
| `mazeworld.html` | Gear tab (`#s-carry`, paint() 3182-3239) renders worn-weapon/worn-armor rows then ONE flat `renderCarriedList` for everything else, in the same container; foe-card tap sets `S.combat.target = i` directly (5916), guarded by `guardTap` (5354) | On You/Bag panel split (depends on a real "worn" model, §6); dead-foe tap-guard |
| `test/parity/harness/comparables.js` | Per-field strip helpers (stripDarkForField, stripFlightFields, stripBagField, …) + the `storeRoll`-style run-flag precedent (state.js:201-212) for gating new rng draws | Every new field/draw this milestone adds needs the same treatment |

## Integration Points (file:line grounded)

### 1. A generic effect/cooldown/duration model — what exists today, and what to build

**What already exists (and should NOT be blanket-replaced):**

- **Per-step (squares) tickers**, all inside `engine/movement.js#move`'s single per-step block (lines 273-347), each a bespoke field with its own semantics:
  - `c.darkFor` (273-292) — persistent darkness counter, dispelled by `eff(c,"light")`, else decremented; narrated `darknessLifted`/`darknessDispelled`.
  - `c.haste`/`c.invis`/`c.ether` (293-295) — flat per-step decrements, no events.
  - `c.acute` (296-302) — decremented per step (Acuteness also ticks per **round** in combat — see below); `acuteFaded` event at zero.
  - `eff(c,"cloakHeal")`/`eff(c,"cloakRegen")` (303-328) — fire on a **cadence** (`state.steps % CLOAK_TICK_SQUARES === 0`, i.e. every 20 squares), not a plain decrement.
  - `c.flightLeft`/`c.flightCooldown` (329-341) — a genuine two-phase charge-then-cooldown resource, the closest existing precedent to what magic-item "use → effect for X → cooldown for Y" needs.
  - Magic User spell-charge recovery (344-347) — cadence-based (`state.steps % 20 === 0`).
- **Per-round ticker**: `combat.afraid` (set in `combat.js#fight`, 383; consumed by `derived.js#afraidNeed`/`afraidDamage`, 377-389) — decremented once per `foeTurn` call and, per Decision `31-02`, Acuteness "ticks both per foeTurn round AND per exploration step, clearing unconditionally at `endCombat`" — i.e. **the codebase already has one real precedent for a dual squares+rounds ticker**, just not factored into a shared helper.
- **Item cooldowns**: `it.every`/`it.usedAt`, gated purely on `state.steps` (`itemReady`, items.js:783-787; refusal narration in `useItem`, items.js:857-867). This is already exactly the "use → cooldown for Y squares" shape magic items need — it just currently has no matching "effect lasts for X" half (every existing `use:` effect in the `useItem` switch, 875-994, is either instantaneous or writes a bespoke scalar field like `c.haste=50`).
- **Potion/buff square-counters** (`c.haste`, `c.invis`, `c.ether`, `c.acute`, `c.might` "until next day") are all bespoke scalar fields on `c`, each independently ticked, each independently narrated, each independently carved out of the parity comparables where new (e.g. `stripDarkForField`/`stripFlightFields`, comparables.js:103-134).

**Recommendation — do not retrofit the existing fields.** Every one of the fields above already has a tuned narration line, a parity carve-out (where new), and in several cases a declared canon divergence. Rewriting them onto a generic model buys nothing and risks regressing tuned behavior and fixture coverage for zero player-visible benefit. Instead:

**Build one new, small, cycle-free module — `engine/effects.js`** (sibling to `derived.js`, the pattern that module's own header explains: "the only cycle-free leaf module" when both `magic.js`→`combat.js` and a future `combat.js`→`abilities.js` edge exist) — that owns exactly the **new** timers this milestone introduces: ability cooldowns, magic-item duration-then-cooldown pairs, and the timed map reveal. Shape:

```js
// engine/effects.js
export function tickSquareEffects(state, events) { /* called from movement.js#move,
  in the SAME per-step block as darkFor/haste/etc (after line 347), decrementing
  c.timers[] entries whose kind === "squares" */ }
export function tickRoundEffects(state, events) { /* called from combat.js's
  foeTurn tail, mirroring the existing combat.afraid/acute-in-combat tick site,
  decrementing c.timers[]/C.timers[] entries whose kind === "rounds" */ }
export function clearCombatEffects(state) { /* called from combat.js#endCombat,
  mirroring Acuteness's unconditional end-of-combat clear (Decision 31-02) */ }
```

`c.timers` (or a small array per consumer — `c.abilityCooldowns`, `c.itemEffects`) is a **new serialized field** with **zero rng draws** (pure decrement), so it needs exactly one new strip helper in `comparables.js` (mirroring `stripDarkForField`) — cheap, and it is the ONE new mechanism every subsequent feature (abilities, magic items, timed reveal) should target, rather than each inventing its own bespoke counter as items.js/movement.js have organically done for years. This is the single foundational build-order item (§ Build Order, item 2).

### 2. Water terrain squares — the parity landmine

Maze cells are built as `{ wall: true, seen: false, feat: null }` (maze.js:69) with `dark` added later only where a dark blob's BFS reaches (maze.js:141-148: `g[y][x].dark = true`). Adding `water` as a third boolean flag on the cell is structurally trivial — the hard part is **how it gets there**.

The existing `darkBlobs` mechanism is *not* a new draw: the code comment at maze.js:136-140 states plainly that `dc.darkBlobs` (from `difficultyCurve`) "equals the old `blobs` count for depths 1-5, so `rng.pick(open)` is still called exactly `darkBlobs` times here, preserving the seeded RNG cursor" — darkness blobs existed in the **original, frozen prototype** at those depths, so this was a refactor of an existing draw, not an addition. **Water squares have no prototype-side equivalent at all.** Any new, unconditional `rng.pick(open)`/BFS-seed draw added to `genFloor` shifts the RNG cursor for literally every seed, which means every movement/combat/economy/magic parity fixture (all of which start from `genFloor(1)` via `newRun`) would generate a **different maze layout** than the frozen master — not a "field changed," a structurally different floor. This is unrecoverable via a strip helper; it would require regenerating every fixture.

**The only clean path is the `storeRoll` run-flag precedent** (`engine/state.js:201-212`, Phase 33/STORE-01): `state.storeRoll` is `false` for every existing caller (every fixture, every bot, every pre-Phase-33 save) and gates the *only* new rng draws that phase introduced, so nothing that doesn't opt in ever sees a different cursor. Apply the identical shape here:

- Thread a new options flag through `genFloor(depth, rng, { water = false } = {})` (maze.js:65), consumed only when `water` is true, drawing its blob seeds via `rng.pick(open)` **after every existing draw in the function** (i.e., appended after the one-way-door shuffle at maze.js:163-172, the last existing consumer).
- `engine/state.js#newRun` (149: `const floor = genFloor(startAt, rng);`) and `engine/movement.js#descend` (697: `state.floor = genFloor(state.floor.depth + 1, rng);`) both need to pass `{ water: state.terrainRoll }` (a new top-level run flag, plain boolean, set only by the shell's `engineAdapter#startNewRun` exactly like `storeRoll` is today) — every existing caller (`newRun(seed)` with no options, every fixture, every bot, every tool) gets `water: undefined` → falsy → byte-identical floor generation.
- This is the **highest-parity-risk single item in the entire milestone** and should be flagged explicitly to whoever plans the terrain phase.

**Movement cost of 2 for water:** `move()` currently does one unconditional `state.steps++` per successful step (movement.js:215). The simplest, most consistent option is: when the destination cell (`there`, movement.js:126) has `there.water`, increment `state.steps` by 2 instead of 1. This is additive arithmetic at one call site — no new field. **Side effect to flag explicitly for the phase's own design call**: `state.steps` is the SAME counter driving every existing cadence (Magic User spell recharge every 20 squares, both healing cloaks every 20 squares, the Cloak of Flying's 20/50 charge-cooldown, the Bard's song every 100 squares, the 8-hour wandering-monster check every 100 squares). Wading through water will incidentally accelerate all of these cadences relative to "squares walked" — reasonable flavor (water is slow, cadences measured in steps-not-progress fire "sooner" per tile crossed) but should be a *ratified* Key Decision, not an accidental side effect discovered in QA. If the phase wants cadences unaffected, introduce a separate `state.moves` (actual tiles entered) and keep `state.steps` reserved for the +2 semantics — but this is more invasive (every `% N` cadence site would need to switch counters) and is not recommended unless the ratified design explicitly rejects the shared-counter side effect.

Phobia hook: `waterPenalty(c)` (movement.js:61-63) already exists and is wired into the **gorge/crevice leap roll**, not general water-tile movement — the new water *terrain* trigger for the "Bodies of water" phobia is a distinct event (stepping onto a `water` cell during ordinary `move()`, not the climb/leap branch at movement.js:138-211) and should push its own new event (e.g. `waterEntered`/reuse the existing `waterFear` event shape) from the water-cost branch described above.

### 3. Timed map reveal, and the 3×3 dark view — two genuinely different mechanisms that must stay decoupled

**Timed reveal** (Detect Magic rework): today, `magic.js`'s `reveal` kind (295-298) is a one-shot, permanent, unconditional `f.g[y][x].seen = true` sweep of every open cell — no duration, no re-fog. The milestone wants this to expire after N turns.

- New spell-kind branch (or an added `sp.turns` field on the existing `reveal` kind, dispatched via a small conditional inside the same branch — either is fine; a distinct kind, e.g. `timedReveal`, is cleaner since `RESIST_IMMUNE_KINDS` (magic.js:36) and any future UI copy can key off it independently) inserted into the same if/else-if chain, following the exact pattern every other kind uses: read/write only `state`/`c`, push a typed event, fall through to the shared `if (state.combat) afterPlayerAction(...)` tail (magic.js:440). This is a pure addition — no existing branch is touched, so every fixture that never casts it (none does) is byte-identical.
- **Critical design point**: `.seen` today means "the player has ever legitimately walked close enough to know this cell" — it is permanent memory and drives the canvas fog-of-war. A timed reveal must NOT corrupt that memory for cells the player later walks past normally. Track provenance explicitly: stamp only the *newly*-revealed cells (ones that were `seen: false` immediately before the cast) with a `revealedAt: state.steps` marker, and record the expiry on the character (`c.mapRevealUntil = state.steps + sp.turns`, a new top-level `c` field). A new per-step check (added to the existing tick block in `movement.js#move`, after line 347, in the new `engine/effects.js#tickSquareEffects` helper from §1) fires when `state.steps >= c.mapRevealUntil`, and for every cell still carrying a `revealedAt` marker, **re-fogs it only if the player's current position's own `revealRadius(state)` (derived.js:341-343) would not otherwise have revealed it by now** — i.e., don't take back knowledge the player would have earned normally in the meantime. This is a design decision the phase's own plan must state explicitly (the two options — "re-fog everything the spell touched, unconditionally" vs. "re-fog only what normal walking wouldn't already show" — are both defensible; the latter is recommended since it never feels like it's punishing the player for having also explored).
- Zero new rng draws (pure step-counter bookkeeping), so the only parity obligation is a new strip helper for `c.mapRevealUntil` (mirroring `stripDarkForField`) and, if cell-level `revealedAt` markers are added, a structural map-and-strip on `state.floor.g` mirroring how `stripBagArmorFields` maps into `c.items[]` (comparables.js:202-208) — cheap, since no fixture ever casts this spell.

**3×3 dark view** — this is explicitly **not** the same thing, and the research question's framing is correct: it must be a **render filter, never a state change**.

- `derived.js#revealRadius` (341-343) already computes `(inDark(state) && !skill(c,"Night Vision") ? 1 : 2) + eff(c,"sight")` — this is the ENGINE's existing, correct answer to "how much NEW area do you learn per step while standing in the dark." It already shrinks new-knowledge radius to 1. This infrastructure is untouched and is not what the milestone is asking to change.
- The new ask is purely about what the **canvas currently draws** from already-`seen` memory while the player happens to be standing on a dark tile right now: hide everything outside a 3×3 window around the player (Chebyshev distance ≤ 1), regardless of whether those cells are `seen`, and un-hide them the instant the player leaves the dark tile. This is squarely inside `mazeworld.html#draw()` (maze.js:2637) — the cell-iteration loop there should gate on `inDark(state)` (bridgeable to the shell exactly as other derived reads already are, e.g. via a small `window.__mz*` bridge or a tiny new view-model export) and, when true, skip rendering any `seen` cell whose Chebyshev distance from `(f.px, f.py)` exceeds 1.
- Waiver condition must reuse the identical gate the engine already uses for "does darkness matter to you right now": `inDark(state) && !skill(c, "Night Vision")`, PLUS `eff(c, "light") > 0` should also waive it (mirroring `movement.js:285`'s existing light-source dispel of `darkFor`) — so the render filter's rule can never drift from what the engine considers "you can actually see fine here."
- **Zero engine changes, zero new serialized field, zero parity risk** — this is entirely inside the shell's draw loop. It is the single cheapest, most isolated item in the whole milestone and can land whenever convenient (it pairs naturally with the Darkness-phobia work but has no code dependency on it).

### 4. Spell dispatch (`magic.js#castSpell`) — where new kinds and abilities plug in

`castSpell` (magic.js:48-442) is a single long if/else-if chain keyed on `sp.kind` (140-439). The `combatOnly` gate already exists as general content-driven infrastructure (`sp.combatOnly`, checked at line 85: `if (sp.combatOnly && !state.combat)`) — any new spell that should be combat-only just sets that flag in `content/spells.js`; no engine change needed. `RESIST_IMMUNE_KINDS` (line 36) is the other content-adjacent gate new kinds must consider (should intelligent foes resist this?).

Most of the milestone's new spell content (day-one damage spell per wizard sub, rebalanced numbers, Shield-pool display) needs **no new kind at all** — they reuse existing kinds (`thrown` for damage, `ward` for Shield — `c.ward = {pool, rounds, reflect, name}` already exists at magic.js:307 and is already surfaced as a UI chip via `conditionsOf` at derived.js:213-215, so "Shield shows its remaining pool" is very likely *already wired* and just needs a dedicated combat-panel chip if one doesn't already render it prominently — verify before treating this as new work). The **timed reveal** (§3) is the one genuinely new `castSpell` kind this milestone needs. A "scroll scribed into the grimoire is castable immediately" changes `readScroll`'s existing branch (magic.js:503-507: today, learning a scroll into the grimoire returns early with `scrollCopiedToGrimoire` and never casts) — the phase would add an immediate `castSpell` call after the grimoire push, gated on `c.level >= spellLevelFor(...)` exactly as `canCast` already checks (derived.js:735-744), reusing `scrollCast`-style bypass semantics already present in the same function (511-514).

**Abilities are structurally NOT spells** and should not be forced through `castSpell`. `SPELLS`/grimoire/school-gate/charge-economy (`canCast`, `schoolGate`, `maxCharges`, magic.js:56-74) are Magic-User-only concepts baked deeply into `castSpell`'s preamble. Fighter/Thief activated abilities need a **parallel dispatch module**, `engine/abilities.js`, mirroring `magic.js`'s shape (`useAbility(state, key, rng, events)`), reading a new `c.abilities` array with its own cooldown entries (via the `engine/effects.js` timer model from §1) instead of grimoire/charges. This is wired into `engine/engine.js`'s action-type dispatch table as a new `"useAbility"` action, exactly parallel to the existing `"castSpell"`/`"useItem"` entries (confirm the exact dispatch table shape in `engine/engine.js` before implementation — not read in this pass, but the pattern is unambiguous from `magic.js`/`items.js`'s own action-registration comments).

Converting existing passive `SKILLS` catalog entries (content/skills.js: Kata, Agility, Ambidextrous, Climbing, Leaping, Silence, Night Vision, Heft, Sewing, Language, Runes/Signs) into activated abilities is a **per-skill** refactor, not a mechanical batch job — each skill's passive read site (`skill(c, name)`/`skillTier`, scattered across `derived.js`/`combat.js`/`movement.js`) would need to become conditional on an active-use flag for any skill that converts. Recommend picking a small (2-3 skill) initial conversion set rather than the whole catalog in one phase.

### 5. ABILITIES submenu + dead-foe targeting — where the mutation belongs

`combatMenu.js#combatMenuViewModel` (62-256) already has the exact seam: the `isCaster`/`isBard`/`else` branch (72-148) decides what fills submenu slot 2. Real Fighter/Thief ability rows are a **third branch** (`hasAbilities`), built with the identical `{id, label, cost, desc, enabled, dispatch}` shape the SPELLS branch already uses (94-104: `cost: LVL N`, `dispatch: {type:"castSpell", idx}` → for abilities, `cost: cooldown-remaining`, `dispatch: {type:"useAbility", key}`). `mazeworld.html`'s submenu renderer (the `pickCombatRow`/`openCombatMenu` machinery around lines 5477/5526) already dispatches whatever `row.dispatch` object the view-model supplies through the existing shell→`applyAction` bridge — **zero shell changes needed for the submenu itself**, only the view-model's row-building logic.

Dead-foe targeting is confirmed, by direct read, to be a **guarded shell-local mutation, never an engine action** — `S.combat.target = i` at `mazeworld.html:5916`, wrapped in `guardTap` via `renderFoeCards`' internal wiring (`mazeworld.html:5354`), and the recorded Key Decision states explicitly: "no engine `retarget` action exists or was added — targeting stays the guarded shell mutation." The engine already has TWO independent, duplicated, reactive dead-target guards: `playerStrike` (combat.js:461-462: `if (!foe || !foe.alive) C.target = C.foes.findIndex(f => f.alive);`) and `castSpell` (magic.js:95-98, identical logic). `combatPanel.js#foeListViewModel` (60-107) already fully suppresses the visual "TARGET" tag on a dead foe (`tagTone`/`tag` logic at 76-89, gated on `f.alive`) — so the *display* is already correct; only the underlying numeric `C.target` can go briefly stale between kills.

Two small, independent, zero-risk changes close this gap:
1. **Engine-side proactive normalization**: extract the duplicated `if (!foe||!foe.alive) C.target = ...findIndex(...)` pattern (combat.js:461-462, magic.js:95-98) into one shared helper (e.g. `combat.js#normalizeTarget(state)`) and call it from `killFoe` (combat.js:632) the instant a foe dies, not just lazily at the next strike/cast. Zero new events (pure index reassignment, matching today's silent behavior), zero rng.
2. **Shell-side tap-guard**: the foe-card tap handler (`mazeworld.html:5916`) should refuse the assignment outright for a dead card (`if (!vm.cards[i].alive) return;`) — belt-and-braces, since "dead foes never targetable" reads as an interaction rule as much as an engine-consistency one.

Neither change touches serialization or adds an event/rng draw — this is one of the cheapest, earliest-buildable items in the milestone.

### 6. Equipment slots — the "one per type" rule needs a real "worn" concept that doesn't exist yet

Weapon and armor are **already** effectively one-per-type by construction: they are scalar fields on `c` (`c.weapon`, `c.armor`/`c.ar`/`c.armorWP`, set by `takeItem`/`equipItem`, items.js:269-330/537-634) — equipping a second weapon simply overwrites the first, so there is no stacking concept to fix there. **Cloaks, jewelry, and staves are different**: they have no "worn" bit at all today. They live permanently and unconditionally in `c.items` (the bag), and their `eff` values are summed **across every carried copy, unconditionally**, by `derived.js#eff` (51-55: `for (const it of c.items||[]) if (it.eff && it.eff[key]) t += it.eff[key];`). A character carrying three Cloaks of Flying today gets `eff(c,"fly")` counted three times over — masked for `fly` specifically because `isFlying` (derived.js:156-161) only checks a boolean name-match, but this is a real latent stacking bug for any additive `eff` key (e.g. `sight`, `toHit`, `dmg`) that this milestone's "no stacking of a type" rule newly surfaces.

**Proposed model**: introduce `c.worn = { cloak: null, jewelry: null, bracelet: null, ... }` (a small slot-key → item map), mirroring the weapon/armor scalar pattern but keyed since there are several slot types. `content/treasure-tables.js`'s CLOAKS/JEWELRY entries need a new `slot` field (defaulting obviously — cloak items → `"cloak"`, etc.). `derived.js#eff` (51-55) must change from "sum across all of `c.items`" to "sum across scalar-equipped weapon/armor effects (if any carry `eff`) plus every populated `c.worn[*]` entry" — **this is a wide-blast-radius change**: `eff()` is read at roughly 15+ call sites across `combat.js`/`movement.js`/`magic.js`/`items.js` (toHit, damage, upkeep, sight, greed, throw, size, cloakHeal/cloakRegen, foeToHit, …), so it should be its own early sub-phase with full regression coverage before anything else depends on it (magic items, the Gear-tab split).

Equip/unequip flow: extend `items.js#equipItem`/`unequipSlot` (519-634) — today gated on `it.kind === "weapon"|"armor"` only (542/558) — with a parallel branch for `it.kind === "cloak"|"jewelry"` that reads/writes `c.worn[slotFor(it)]` instead of a scalar, displacing any previously-worn item at that slot back into the bag via the exact same stow-gate pattern the weapon/armor branch already uses (worn-item reconstruction + `stowItem`, mirroring 542-556 almost verbatim, parameterized by slot key).

One-shot tools (rope for pits, ladder for walls, torch for darkness) are **not** equip-slot items — they are single-use consumables that belong in the existing `useItem` kind-switch (items.js:875-994), each a new `case` (e.g. `use:"climbAssist"`, `use:"wallBreach"`, `use:"lightSource"`) consumed via the already-generic `it.uses === 1` → splice + `itemConsumed` path (996-999). Purely additive, no dependency on the worn-slot work.

### 7. Cutthroat Joiner + murder chance — a canon reversal plus a new descend() hook

**This is a deliberate reversal of existing, documented behavior, not new ground.** `engine/encounters.js#meetJoiner` (465-491) *already* special-cases Cutthroat: line 473, `const refusal = c.sub === "Cutthroat" ? "cutthroat" : ...` — today, **no Joiner has ever agreed to travel with a Cutthroat hero at all**; `state.pendingJoiner` is simply left `null` on that branch (the header comment even states "No Joiner ever agrees to travel with a Cutthroat"). The v1.5 target feature ("Cutthroat — can accept a Joiner") directly contradicts this and must be logged as an explicit canon reversal in the phase's own context doc: remove the Cutthroat clause from the `refusal` ternary (line 473) so a Cutthroat's Joiner offer proceeds through `resolveJoiner` (508-521) exactly like any other class — `resolveJoiner` itself is already class-agnostic, so zero changes are needed there.

**The murder hook belongs in `engine/movement.js#descend`** (691-701) — the one function that already runs exactly once per floor transition with an injected `rng`, already gated on party state elsewhere in the same module (the `nightlyEats`/`newDay` party loops at movement.js:392/435 are the precedent for "only run this when `state.party?.length`"). Recommended shape: gate a new check on `c.sub === "Cutthroat" && state.party?.length`, roll a low-probability check (the phase's balance pass picks the exact odds), and on a hit, splice the murdered member out of `state.party` and push a new `cutthroatMurder {name}` event — land it as the **last** step of `descend()`, after `floorChanged` (line 699), so the murder is narrated as happening on the new floor, not retroactively un-happening the floor that was just survived.

**Parity note**: `descend()` is directly fixture-exposed — `test/parity/harness/comparables.js`'s `INTERNAL_FNS` (763: `{ openStore, springTrap, openChest, encounterDot, descend }`) replays it in economy/encounters fixtures. A new unguarded rng draw inside it would be a parity risk in principle, but per `meetJoiner`'s own header note ("no fixture ever meets a Joiner"), no existing fixture rolls a Cutthroat hero carrying a live party member — the gate (`c.sub === "Cutthroat" && state.party?.length`) should therefore be a structural no-op on every current fixture, mirroring the Phase 19 caster-ability gating precedent (zero draws for a foe with no ability kit). Confirm this with a live fixture-roster scan (mirroring the Phase 17 `FIXTURE-INVENTORY.md` audit) before landing, rather than assuming.

### 8. Gear tab — On You / Bag split

Today's Gear tab (`mazeworld.html`, `paint()`, `#s-carry` block ~3182-3239) renders two `wornRow(...)` calls for weapon (3217) and armor (3222-3223) directly ahead of a single flat `renderCarriedList(carry, items, {...})` call (3233-3239) covering every other carried item (cloaks, jewelry, staves, potions, scrolls, tools) — all appended into the **same** `<ul id="s-carry">` container with no structural boundary between "worn" and "everything else." `renderCarriedList` itself (mazeworld.html:3685+) is already a clean, reusable component — it is the same function the store's sell list, the combat use-list, and the loot card all call, and it never receives worn items on any of those other call sites already.

Once §6's `c.worn` slot model exists, the split falls out almost for free: "On You" becomes weapon + armor (existing scalar rows) plus one new `wornRow`-style entry per populated `c.worn[slot]`; "Bag" becomes the exact same `renderCarriedList(carry, items, {...})` call, unchanged, now naturally excluding worn cloak/jewelry items because — mirroring how an equipped weapon/armor is already not a `c.items` entry — a worn cloak/jewelry item would live in `c.worn`, not in `c.items`, the instant it's equipped. The "bag-full drop prompt lists bag items only" requirement falls out for the same structural reason (worn items are never candidates because they were never bag members to begin with).

Concretely: split the single `#s-carry` container into two DOM sections (e.g. `#s-worn` / `#s-bag`), move the `wornRow(...)` calls into the first, and the `renderCarriedList(...)` call into the second — unchanged internally. **This item has a hard dependency on §6 landing first** — there is nothing structurally distinct to put in an "On You" panel for cloaks/jewelry until the worn-slot model exists to make them not-bag-members.

## Data-Flow Changes (summary)

- **New engine module `engine/effects.js`** (§1): consumed by `movement.js#move` (new per-step tick call), `combat.js` (new per-round tick call in `foeTurn`'s tail, and a clear call in `endCombat`), `magic.js` (timed reveal writes a timer entry), `items.js` (magic-item use writes a duration-then-cooldown pair).
- **New engine module `engine/abilities.js`** (§4): consumed by `engine/engine.js`'s action dispatch table (new `"useAbility"` action) and `src/browser/combatMenu.js`'s ABILITIES submenu branch.
- **`engine/maze.js#genFloor`** gains an options parameter (`{ water }`) and a new cell flag (§2) — parity-gated behind a new top-level run flag (`state.terrainRoll`, mirroring `storeRoll`) threaded through `state.js#newRun` and `movement.js#descend`.
- **`c` (character) gains**: `c.worn` (§6, equip slots), ability-cooldown entries (§1/§4, likely `c.abilities`/`c.abilityCooldowns`), `c.mapRevealUntil` + per-cell `revealedAt` markers (§3). Every one of these needs a new strip helper in `comparables.js`, mirroring `stripDarkForField`/`stripFlightFields`/`stripBagField` (103-151), added to all three comparables (`movementComparable`/`combatComparable`/`economyComparable`) even where currently a structural no-op (the `stripFoeAbilityState` precedent, 302-322).
- **New events** needing `EVENT_NARRATION` + toast-table entries (both coverage-guarded, machine-checked): `cutthroatMurder`, `revealFaded` (or similar), `waterEntered`/reused `waterFear`, `abilityUsed`/ability-specific events, item duration-expired/cooldown-ready narration, and whatever the "clarity" pass's cause-naming additions turn out to need on existing events (additive payload fields, not new types, per the Phase 25 `foeToHitBreakdown`/`needMods` precedent at derived.js:446-509).

## Build Order (dependency-aware)

The question's own two hard constraints are correct and are the spine of this ordering: **the generic effect/cooldown model before items and abilities**, and **terrain before phobias**. Recommended full sequence:

1. **Dead-foe targeting + Cutthroat reversal** (§5, §7) — zero new state, zero dependencies on anything else, cheapest possible wins; can land first or be interleaved anywhere. Recommended first purely for early confidence-building and because it touches the fewest files.
2. **Generic effect/cooldown/timer model** (`engine/effects.js`, §1) — foundational. Blocks: melee abilities (3), magic-item use→cooldown (4 below), and the timed-reveal spell kind (part of item 7).
3. **Terrain** (water squares + the `genFloor`/`terrainRoll` parity-gated plumbing, §2) — independent of item 2 (different subsystem: `maze.js`/`movement.js` vs. timers), so it can run in parallel if resourced separately, but **must** land before phobias (item 5), since the "Bodies of water" phobia's real trigger doesn't exist without water tiles.
4. **Equipment one-per-type** (`c.worn` model + `eff()` refactor, §6) — wide-blast-radius; land before magic items (which are mostly the cloak/jewelry/staff category this targets) and before the Gear-tab split (item 8), both of which hard-depend on it.
5. **Phobias** (every phobia fires, §2/movement.js's existing `heightsPenalty`/`waterPenalty`/`trapped-panic` precedents) — depends on item 3 for the water trigger; the Heights hook can reuse existing gorge/climb feature tiles with no new content, so it has no hard dependency beyond the existing phobia-trigger machinery already in `combat.js#fight` (352-385).
6. **Darkness 3×3 render filter** (§3, second half) — fully independent, presentation-only; natural pairing with item 5 (both are "make darkness matter") but no code dependency — can land anytime.
7. **Melee active abilities** (`engine/abilities.js` + `combatMenu.js` ABILITIES submenu, §4/§5) — depends on item 2 (cooldown timers); independent of items 3/4/6.
8. **Magic items use→effect→cooldown + one-shot tools** (§1/§6) — depends on item 2 (cooldown model) for the duration-then-cooldown items, and on item 4 for worn magic items specifically (one-shot tools do not depend on item 4 — they can land earlier if convenient).
9. **Spell rework** (§3/§4) — the timed-reveal piece depends on item 2; day-one damage spell wiring, rebalance, and scroll-castable-immediately are content/data plus small `canCast`-adjacent logic, independent of items 2/3/4.
10. **Flee retune** — isolated to `combat.js#flee` (777-842) and its display mirror in `combatMenu.js` (207-219); no dependency on anything else in this list.
11. **Gear tab On You / Bag split** (§8) — hard dependency on item 4 (`c.worn` must exist before there is anything structurally distinct to split by).
12. **Clarity pass** (cause-naming, loot-gating display, rations-per-camp) — mostly narration/view-model surface work touching the final shape of *every* feature above (a cooldown ability's refusal needs to exist before its refusal reason can be named; water's move-cost needs an event before its "cause" line can be written). Best done **last**, or continuously feature-by-feature as each lands, rather than as one big terminal pass.

## Parity/Testing Considerations

- **`genFloor`'s water-blob rng draws are the single highest parity risk in the milestone** — they MUST be gated behind a new run-level flag mirroring `storeRoll` (state.js:201-212). An ungated draw breaks every movement/combat/economy/magic parity fixture simultaneously, since all of them start from `genFloor(1)`. There is no strip-helper remedy for this class of divergence — only a run-flag gate prevents it in the first place.
- Every new serialized field (`c.worn`, ability-cooldown entries, `c.mapRevealUntil` + cell `revealedAt` markers, the maze cell's `water` flag, `state.terrainRoll`) needs a strip helper added to all three comparables, mirroring `stripDarkForField`/`stripFlightFields`/`stripBagField` (comparables.js:103-151) — including a structural no-op tripwire where no current fixture would ever reach it (the `stripFoeAbilityState` precedent, 302-322, is the model to copy: cheap insurance against a future fixture reaching a currently-unreachable field).
- The Cutthroat murder draw inside `descend()` (a fixture-exposed `INTERNAL_FNS` entry, comparables.js:763) must be gated on `c.sub === "Cutthroat"` and verified, via a live fixture-roster scan (mirroring the Phase 17 `FIXTURE-INVENTORY.md` precedent), to never fire on any existing fixture before landing.
- Every new event type needs both an `EVENT_NARRATION` entry (coverage-guarded per `test/unit/formatEventsCoverage.test.js`) and a `toasts.js#TOAST_FOR`/`ORACLE_ONLY` entry (coverage-guarded per Phase 25's `toastsCoverage.test.js`) — these are machine-checked CI gates, not optional cleanup, and should be budgeted into every plan that adds an event.
- `derived.js#castableAttackSpells`/`ATTACK_SPELL_KINDS` (699-733) is the established precedent for "what can this character legally do right now" as a pure, state-scoped, no-rng query — the new ability system's own availability query (feeding `combatMenu.js`'s ABILITIES submenu) should follow this exact shape rather than inventing a new one.
- The `eff()` refactor (§6) is the one item in this milestone with the widest blast radius on EXISTING, already-parity-tested behavior (toHit, damage, upkeep, sight, greed, and more all read it) — it should ship with its own full regression pass (unit + parity) before any feature that depends on it (magic items, Gear-tab split) begins, not bundled into the same phase as new content.

## Sources

- `engine/maze.js:65-186` (genFloor), `:204-208` (reveal) — direct code read
- `engine/movement.js:56-101` (phobia penalty constants, isDeadEnd), `:116-378` (move, per-step ticks), `:389-571` (newDay/makeCamp/nightlyEats), `:691-726` (descend/winGame) — direct code read
- `engine/state.js:137-231` (newRun, `storeRoll`/`dev` run-flag precedent) — direct code read
- `engine/magic.js:22-517` (castSpell, drinkPotion, canRead, readScroll) — direct code read
- `engine/items.js:1-1014` (giveItem, treasure rollers, equip legality, takeItem/equipItem/unequipSlot, pendingLoot family, itemReady/useItem) — direct code read
- `engine/derived.js:1-773` (skill/eff/slotItems, conditionsOf, armorSoak, strikeDie/toHit/afraidNeed/afraidDamage, foeToHitVs/foeToHitBreakdown, resistRoll, killSpFor, fluency, canCast/castableAttackSpells/bestAttackSpell) — direct code read
- `engine/combat.js:328-422` (fight, refuseIfPending), `:435-500` (playerStrike excerpt, dead-target retarget at 461-462), `:756-842` (flee), `:844-885` (canParley excerpt), `:1463-1471` (pickFoeTarget) — direct code read
- `engine/encounters.js:440-521` (meetJoiner, resolveJoiner — Cutthroat refusal at line 473) — direct code read
- `test/parity/harness/comparables.js:1-783` (every strip helper, run-flag precedent, `INTERNAL_FNS`, action-path divergence machinery) — direct code read
- `src/browser/combatMenu.js:1-256` (combatMenuViewModel, ABILITIES stub branch at 134-148) — direct code read
- `src/browser/combatPanel.js:1-211` (foeListViewModel dead-foe tag suppression at 76-89) — direct code read
- `src/browser/eventNarration.js:1-150`, `src/browser/toasts.js:1-120` — direct code read (narration/toast coverage conventions)
- `content/flavor.js:17-20` (PHOBIAS catalog), `content/skills.js:9-32` (SKILLS catalog, ability-conversion candidates) — direct code read
- `mazeworld.html:3182-3265` (Gear tab `#s-carry`, worn rows + flat carried list), `:3685+` (renderCarriedList), `:5291-5356` (renderFoeCards, guardTap wiring), `:5895-5919` (renderEncounter, foe-card tap → `S.combat.target = i`), `:5052-5061` (guardTap definition) — direct code read
- `.planning/PROJECT.md` Key Decisions table (esp. the 34-03 "no engine retarget action exists" decision, and the Phase 33 `storeRoll` decision) — direct read, used to confirm architectural precedent rather than re-derive it
- `.planning/STATE.md` Ground Truth + Decisions log — direct read, used for milestone scope and engine-gate confirmation

---
*Architecture research for: v1.5 Meaningful Choices — Spells, Gear & Abilities*
*Researched: 2026-09-17*
