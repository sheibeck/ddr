# Phase 94: Ability States You Can Tell Apart - Research

**Researched:** 2026-10-03
**Domain:** Engine-derived UI state (pure function), vanilla-JS view-models, dark-theme CSS tokens, colour-vision accessibility, node:test pinning
**Confidence:** HIGH (every engine and view claim read from the code; the contrast and colour-blind numbers computed in this session; the one external input, the Machado 2009 matrices, fetched from the authors' page)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### How the four states look (user, 2026-10-03)
- **Full-word labels** in the row's state slot:
  - READY. A ready once-a-fight row keeps "READY · ONCE PER FIGHT".
  - Recharging reads "READY IN N" (N = rounds left, singular "READY IN 1"). It replaces today's "N ROUNDS".
  - Can't use now reads the gate's own reason in plain words, e.g. "NEEDS TWO OR MORE FOES" or "ALREADY ON IT" (today's copy), plus a plain reason for every other engine refusal reason (noTarget → "NO FOE IN REACH", notLowEnough → its hp gate in plain words, etc.).
  - Spent reads "SPENT THIS FIGHT" (replaces "ONCE PER FIGHT · SPENT").
  - Labels are functional and plain. Phase 96's flavour pass must not rewrite them (already a roadmap boundary).
- **Non-colour cue = the label words plus a row edge style:** solid edge (Ready), dashed (Recharging), hatched/patterned (Can't use now), faded with no edge (Spent). No glyph icons: the pixel font may lack them.
- **Four colour families:** Ready = the existing green-gold "good" ink; Recharging = amber (the condition strip's `warn` tone); Can't use now = rust red (the `bad` tone); Spent = dim grey. Recharging and Spent stay in separate families (one comes back this fight, the other doesn't). Colours are CSS tokens defined once.
- **Tapping a non-ready row stays as today:** it remains tappable, dispatches, and the engine's refusal line lands in the fight log, so a tap always agrees with the label.

#### Scope and the engine contract (user, 2026-10-03)
- **Surfaces:** the combat ABILITIES submenu (`src/browser/combatMenu.js` `abilityRows`, including the Bard's Sing row) and the Hero tab's abilities list (`src/browser/heroTab.js`, which shows READY / N ROUNDS / ONCE A FIGHT today). Both read one engine function.
- **Joiners:** the engine function takes any sheet (hero or Joiner) and is pinned for both. Joiners auto-act and have no ability menu, so their states show only where a Joiner's abilities are already listed (the Company panel), with the same labels.
- **Themes:** the dark theme only (the one shipped; the light theme was retired). Pinned by shell snapshot, plus a greyscale and colour-blind (deuteranopia and protanopia) distinguishability check in tests. ASTATE-05's wording becomes "readable in the shipped theme and for colour-blind players".
- **Engine contract:** a pure derived `abilityState(state, sheet, key)` in `engine/abilities.js` returns `{ state: "ready" | "recharging" | "unavailable" | "spent", roundsLeft, reason }`. It is built from the existing `isReady`, `abilityRoundsLeft`, `abilityUnavailableReason` and `abilityTargetShortfall` checks. `useAbility`'s refusals use the same function, so the label and the tap can never disagree. No rng draw and nothing serialized (no `*Comparable()` change). Parity fixtures must not move.

### Claude's Discretion
- Exact token names and hex values (meeting a contrast target against the dark panel), the hatch pattern technique, and the plain wording for each remaining refusal reason (house style: uppercase on the row, plain, exact).
- Whether the hero-cannot-act menu interacts (it replaces the menu; likely untouched).
- How the colour-blind check is implemented (e.g. a pure luminance and edge-style distinctness test over the four tokens).

### Deferred Ideas (OUT OF SCOPE)
- Fifth "Active" state; ability states on spells and items; a light theme (none ships).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASTATE-01 | Each ability row shows one of four states, each with its own colour token plus a non-colour cue | Token set + edge styles (Tokens and Accessibility); row `state` field and shell hook (View); labels (Refusal reasons table) |
| ASTATE-02 | A Recharging ability shows "ready in N" | `roundsLeft` from `abilityRoundsLeft` (Engine); label `READY IN {n}` (Copy table); N ticks down through `tickRounds` (no new code) |
| ASTATE-03 | A Can't-use-now ability shows the gate's reason on the row | Seven unavailable reasons with labels (Refusal reasons table); Last Stand's hp gate is NOT shown on the row today and becomes visible |
| ASTATE-04 | The engine exposes each row's state category and rounds left, so the view never infers it | `abilityState` contract and `useAbility` refactor (Engine), `singState` for the Bard (Engine), Joiner pins |
| ASTATE-05 | Readable in the shipped (dark) theme and for colour-blind players, pinned by shell snapshot and a11y tests | Computed contrast and colour-blind numbers, pure-node a11y test design, shell snapshot design (Tokens and Accessibility, Snapshots) |
</phase_requirements>

## Summary

The engine side is small and low-risk. Today the ladder that decides "can this ability be used" lives in `useAbility` (`engine/abilities.js:317-376`) and the combat menu re-derives a partial copy of it in `abilityRows` (`src/browser/combatMenu.js:180-219`). The copy is already wrong in two real ways: the menu never checks Last Stand's hp gate (so a ready Last Stand reads READY at full hp and then refuses on tap, `abilities.js:373`), and it checks Hamstring/Mark's "already on it" against `combat.target` without the dead-target retarget the engine applies. A single pure `abilityState(state, sheet, key)` that mirrors the ladder rung for rung fixes both and makes the label/tap agreement structural. I prototyped it in a throwaway `git archive` copy: refactoring `useAbility` onto it left the whole suite green (10,216 pass; the 1 fail is the `git`-dependent "package.json unchanged from HEAD" test, which cannot run in a `git archive` copy), with parity, determinism and round-trip untouched, because the function draws nothing and writes nothing.

The view side moves exactly 10 existing tests (listed under Tests That Move) once the labels change, and nothing else in the 9,957-test unit tree. The shell already funnels every submenu row through one function (`cbRow`, `mazeworld.html:5188-5214`) and one CSS block (`.cb-row*`, `mazeworld.html:900-906`), so the four visual states are one new attribute (`data-state`) plus about ten CSS rules and four `:root` tokens.

Three facts in CONTEXT.md need correcting before planning (details under Findings That Change The Plan): the Company panel does NOT list Joiner abilities (so Joiner states have no UI surface; they are engine-pinned only); there is no "needs a weapon" gate on any ability (the ROADMAP example is illustrative); and the existing `good`/`warn`/`bad` ink colours cannot meet the greyscale and protanopia requirement (good vs warn differ by only 1.13:1 in luminance; bad vs the existing dim grey collapses to 1.01:1 under protanopia), so four new ink values are proposed with their computed numbers.

**Primary recommendation:** Add `abilityState` (plus a `singState` twin for the Bard) to the engine and route `useAbility`/`sing` through them with every refusal event payload and order byte-identical; add one small pure copy module for the labels; key the visuals on a `data-state` attribute with four `:root` tokens (`#cbee86`, `#eeb433`, `#fc7970`, `#86898c`) and four edge styles (solid, dashed, dotted plus 12% hatch, no edge); pin the tokens with a pure node:test that parses `mazeworld.html`.

## Findings That Change The Plan

| # | CONTEXT.md says | Reality (verified) | Consequence for planning |
|---|-----------------|--------------------|--------------------------|
| F1 | Joiner states show "where a Joiner's abilities are already listed (the Company panel)" | The Company card (`src/browser/heroTab.js:840-910`, `renderPartyRoster`) lists name, sub/race, class and level, hp, weapon, eats, armour, condition chips, items, DISMISS. It never lists a Joiner's abilities. The only ability-related thing there is an active-effect chip ("Ability · N rds", `mazeworld.html:3602`, `memberChipsFor` 4119-4128), which is the deferred "Active" concept. | Joiner states have no UI surface. Pin them in engine tests only and add NO new Joiner ability list (a new list is a new feature, out of scope). Flag to the user in the plan summary. |
| F2 | Roadmap criterion 3 example: "needs a weapon" | No ability has a weapon gate. The complete refusal set is: notFought, unknown, notInCombat, cooldown, spent, noTarget, tooFewFoes, alreadyOn, notLowEnough (`abilities.js:317-376`, `eventNarration.js:1195-1218`). | Do not invent a weapon reason. The seven unavailable reasons below are exhaustive. |
| F3 | "Ready = the existing green-gold good ink; Recharging = the warn tone" | `good` ink `#a8cc72` (L 0.527) and `warn` ink `#e8c97a` (L 0.603) are 1.13:1 apart in luminance, i.e. identical in greyscale; `warn` is also exactly the colour every normal row's cost already uses (`.cb-row-cost`, `mazeworld.html:904`). | Keep the families (green-gold, amber, red, grey) but pick new ink values from the computed set below. |
| F4 | Last Stand listed among rows whose state comes from the checks | The menu does not check Last Stand's hp gate today (`combatMenu.js:180-219` handles only Sweep and Hamstring/Mark). A ready Last Stand reads READY at full hp, then `useAbility` refuses `notLowEnough` on tap. | Real label/tap disagreement fixed by `abilityState`. Last Stand will now read "NEEDS A QUARTER HP OR LESS" until hurt. Call this out as a visible behaviour change. |
| F5 | Hero-tab "state" text | `abilitiesViewFor` rows already use the key `state` for the text label (`heroTab.js:215`). The combat rows will use `state` for the category. | Name collision. Hero rows: keep `state` as the text, add a separate category key (`stateKind`) in combat only. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deciding whether an ability can be used, and why not | Engine (`engine/abilities.js`) | none | ASTATE-04: the view never infers; `useAbility` and the menu share one function so tap and label cannot disagree |
| Bard's Sing availability | Engine (`engine/combat.js`) | none | Sing is not in `ABILITY_BY_ID`; its rule lives in `sing()`/`songDue`, so it needs its own derived twin |
| Plain-word labels for each state and reason | View-model copy module (`src/browser/`) | none | Labels are presentation; one module so the combat menu and Hero tab say identical words |
| Row shape: `{... state, cost, enabled}` | View-model (`combatMenu.js`, `heroTab.js`) | none | Pure presentation modules, no DOM, no rng |
| Row element classes, `data-state`, edge styles, tokens | Shell (`mazeworld.html` `cbRow` + CSS `:root`) | Hero tab renderer (`heroTab.js` `renderAbilityRows`) | The only code that touches the DOM |
| Colour-blind and contrast guarantee | Test tier (`test/unit`) | CSS tokens | Parse tokens out of `mazeworld.html`, compute, assert |

## Standard Stack

No new runtime or dev packages. The phase uses what the repo already has.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node built-in test runner (`node:test`, `node:assert/strict`) | Node 22.23.2 (`engines >=22`) [VERIFIED: `node --version`, `package.json`] | All pins and the a11y check | Project standard: `npm test` is `node --test` |
| Existing test harness: `test/unit/harness/shellSandbox.js`, `recordingDom.js` | in repo | Real `renderEncounter()` into a recording DOM for the snapshot | Same harness `shell-tab-snapshots.test.js` and `combat-lock-shell.test.js` use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none | | | No colour library: the contrast and colour-vision maths is about 40 lines (below) and must live in the test file so the test has no dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New copy module `src/browser/abilityStates.js` | Add keys to `COMBAT_MENU_COPY` and `ABILITY_VIEW_COPY` | Two copies of the same words, kept in step by an agreement test; avoids registering a new bank in `tools/lib/voice-corpus.mjs`. `heroTab.js` cannot import `combatMenu.js` (combatMenu already imports heroTab), so a shared module is the clean single source. |
| `color-mix()` for the hatch tint | literal `rgba()` | `color-mix` needs Chrome 111+; use a literal `rgba(252,121,112,.12)` so every Android System WebView renders it [ASSUMED: WebView floor not checked this session] |

**Installation:** none.

**Version verification:** nothing to install; Node 22.23.2 present.

## Package Legitimacy Audit

No external packages are installed or recommended in this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                      state.c.timers  state.combat (foes, target, pending, allies, sang/sangAt/round)
                              |                         |
                              v                         v
   effects.js#isReady ---> engine/abilities.js#abilityState(state, sheet, key)  -----> { state, roundsLeft, reason }
   abilityRoundsLeft  ---> (reads only; no rng, no writes, no allocation of state)          |
   abilityShortfall   --->                                                                   |
   abilityTargetShortfall                                                                    |
   DEATH_PANIC_THRESHOLD                                                                     |
                                                                                             |
        +-------------------------------+-------------------------+-------------------------+
        |                               |                         |
        v                               v                         v
 useAbility (engine)           combatMenu.js abilityRows     heroTab.js abilitiesViewFor (in combat only)
 refusal event by reason       row {label,cost,enabled,       row {name,description,source,state:text,
 (payload + order unchanged)        state,desc,dispatch}            stateKind}
        |                               |                         |
        v                               v                         v
 fight log line (tap)          mazeworld.html cbRow           heroTab.js renderAbilityRows
 [unchanged narration]         className, dataset.state       li.dataset.state
                                        |                         |
                                        +-----------+-------------+
                                                    v
                          CSS: :root --mw-ast-* tokens + .cb-row[data-state=..] + ul.skills li[data-state=..]

   Bard:  engine/combat.js#singState(state) --> same {state, roundsLeft, reason} --> Sing row (first row)
          sing() refusals (songResting / sungThisFight / wrongClass / notFought) read it

   Joiner: abilityState(state, state.party[i], key)  -- engine + tests only, no UI surface (Finding F1)
```

### Recommended Project Structure
```
engine/abilities.js              # + abilityState, ABILITY_UNAVAILABLE_REASONS; useAbility refactored onto it
engine/combat.js                 # + singState; sing() refusals read it
src/browser/abilityStates.js     # NEW pure copy: ABILITY_STATE_COPY, abilityStateLabel(st, meta)
src/browser/combatMenu.js        # abilityRows + Sing row use abilityState/singState and the copy module
src/browser/heroTab.js           # abilitiesViewFor(c, state): in-combat rows gain stateKind; out-of-combat unchanged
mazeworld.html                   # :root tokens, .cb-row[data-state] rules, ul.skills li[data-state] rules, cbRow dataset.state
test/unit/ability-state.test.js          # NEW engine pins (agreement sweep, purity, Joiner, Sing)
test/unit/ability-state-copy.test.js     # NEW copy coverage vs ABILITY_UNAVAILABLE_REASONS
test/unit/ability-state-a11y.test.js     # NEW token maths from mazeworld.html
test/unit/shell-ability-states.test.js   # NEW snapshot (combat submenu, Hero tab in combat)
```

### Pattern 1: `abilityState` mirrors the `useAbility` ladder rung for rung

**What:** The state is the first rung of the existing ladder that fires, nothing more. Rung order is the contract; it is why a tap always agrees.

| Order | Condition (engine today) | `state` | `reason` | `roundsLeft` |
|-------|--------------------------|---------|----------|--------------|
| 0 | `refuseIfPending` (`abilities.js:319`, `combat.js:680`): `combat.pending` | unavailable | `notFought` | 0 |
| 1 | key not in catalog or not in `sheet.abilities` (`:324-328`) | unavailable | `unknown` | 0 |
| 2 | no `state.combat` (`:329-332`) | unavailable | `notInCombat` | 0 |
| 3 | `!isReady(sheet, "ability:"+key)` and `meta.cd === "fight"` (`:338-339`) | spent | `spent` | 0 |
| 4 | `!isReady(...)` otherwise (`:340`) | recharging | `cooldown` | `abilityRoundsLeft(sheet, key)` |
| 5 | target is foe/foes and no live foe (`:348-355`) | unavailable | `noTarget` | 0 |
| 6 | `abilityShortfall(key, liveCount)` (Sweep, `:359-363`) | unavailable | `tooFewFoes` | 0 |
| 7 | `abilityTargetShortfall(key, aimedFoe) === "alreadyOn"` (Hamstring/Mark, `:366-372`) | unavailable | `alreadyOn` | 0 |
| 8 | Last Stand and `wp > maxWP * DEATH_PANIC_THRESHOLD` (`:373-376`), threshold 0.25 (`derived.js:29`) | unavailable | `notLowEnough` | 0 |
| 9 | none of the above | ready | `null` | 0 |

Rung 0 sits inside `abilityState` for the view's benefit but `useAbility` must keep its own `refuseIfPending(state, events, "abilityRefused", { key })` call first, unchanged, because that event has its own payload (`{type, key, reason}` with no `name`, built in `combat.js:680-684`).

**Target used for rung 7:** for the hero (`sheet === state.c`) the aimed foe is `foes[C.target]` if alive, else the first live foe (the exact result of `normalizeTarget`, `combat.js:161-166`, computed WITHOUT mutating). For a Joiner it is the first live foe, because `alliesTurn` passes `foes[0]` of `liveFoes(state)` (`combat.js:2680, 2801`).

**Hp used for rung 8:** hero reads `sheet.wp/maxWP`; a Joiner mid-fight reads its live combat entry (`state.combat.allies.find(a => state.party[a.partyIdx] === sheet)` then `ally.wp/ally.maxWP`, the same fields `pickMemberAbility` reads at `combat.js:2986`), falling back to the sheet.

### Pattern 2: `useAbility` refactored onto the function without moving a byte

The one subtle part is `normalizeTarget(C)`, a mutation (`combat.js:161-166`). Today it runs only when the ladder has passed the cooldown rung and the ability needs a foe (`abilities.js:348-350`), so a cooldown/spent refusal does NOT retarget but a tooFewFoes/alreadyOn/notLowEnough refusal DOES. To stay byte-identical keep that exact order of effects:

```js
// Source: prototype built and run in a git-archive copy this session; full suite green
export function useAbility(state, key, rng, events = []) {
  if (refuseIfPending(state, events, "abilityRefused", { key })) return events;   // unchanged, first
  const c = state.c;
  const C = state.combat;
  const meta = typeof key === "string" ? ABILITY_BY_ID[key] : null;
  const st = abilityState(state, c, key);
  if (st.reason === "unknown") { events.push({ type: "abilityRefused", key, reason: "unknown", name: meta ? meta.name : undefined }); return events; }
  if (st.reason === "notInCombat") { events.push({ type: "abilityRefused", key, reason: "notInCombat", name: meta.name }); return events; }
  if (st.state === "spent") { events.push({ type: "abilityRefused", key, reason: "spent", name: meta.name }); return events; }
  if (st.state === "recharging") { events.push({ type: "abilityRefused", key, reason: "cooldown", name: meta.name, left: st.roundsLeft }); return events; }
  const needsFoe = meta.target === "foe" || meta.target === "foes";
  if (needsFoe) normalizeTarget(C);                       // same point as today: after the cooldown rungs, before the foe rungs
  if (st.state === "unavailable") {                       // noTarget | tooFewFoes | alreadyOn | notLowEnough
    if (st.reason === "noTarget") events.push({ type: "abilityRefused", key, reason: "noTarget", name: meta.name });
    else if (st.reason === "tooFewFoes") events.push({ type: "abilityRefused", key, reason: "tooFewFoes", name: meta.name, need: SWEEP_MIN_FOES, have: liveFoes(state).length });
    else if (st.reason === "alreadyOn") events.push({ type: "abilityRefused", key, reason: "alreadyOn", name: meta.name, target: C.foes[C.target].name });
    else if (st.reason === "notLowEnough") events.push({ type: "abilityRefused", key, reason: "notLowEnough", name: meta.name, have: c.wp, max: c.maxWP });
    return events;
  }
  events.push({ type: "abilityUsed", key, name: meta.name });   // success path unchanged from here
  /* ... startAbilityTimer, switch ... */
}
```

Rules to hold: keep each event's property literal order (`deepStrictEqual` treats `name: undefined` differently from a missing key, and a JSON fixture is order-sensitive); keep `unknown`'s `name: meta ? meta.name : undefined` literal; keep `abilityShortfall`, `abilityTargetShortfall`, `abilityUnavailableReason`, `abilityRoundsLeft` exported and unchanged (`tools/lib/tuning-bot.mjs:37, 289-330` and `combat.js:87, 2975-2978` import them; the bot's decisions must not move).

### Pattern 3: Sing gets a derived twin, not a fake ability

Sing is not in `ABILITY_BY_ID` (`content/abilities.js:17-18` says "Bard's Sing stays as-is"). Today the menu computes its state itself, i.e. the view infers (`combatMenu.js:265-270, 371`). Add `singState(state)` beside `songReady`/`songDue` (`combat.js:119-123, 2354-2360`) and make `sing()` (`combat.js:2379-2411`) read it for its refusals:

| Condition (`sing()` order) | `state` | `reason` (existing event reason) | `roundsLeft` |
|----------------------------|---------|----------------------------------|--------------|
| `combat.pending` | unavailable | `notFought` | 0 |
| no `combat` | unavailable | `notInCombat` | 0 |
| `c.sub !== "Bard"` | unavailable | `wrongClass` | 0 |
| `songDue(C.sang, C.sangAt, C.round)` | ready | `null` | 0 |
| `C.sang` and `Number.isFinite(C.sangAt)` | recharging | `songResting` | `C.sangAt + SONG_GAP_ROUNDS - C.round` (>= 1 whenever not due) |
| otherwise | spent | `sungThisFight` | 0 |

`sing()` today does `if (!C) return events;` silently (`combat.js:2384`); keep that. `sing()`'s event payloads (`actionRefused { action: "sing", reason, rounds? }`) stay identical.

### Pattern 4: Joiners

A Joiner's ability is gated in two places and neither is a refusal:
- **Pick** (`pickMemberAbility`, `combat.js:2967-2993`): owned, `ABILITY_BY_ID[id].cls === sheet.cls` (off-class ids are silently ignored, T-38-09), `isReady(sheet, "ability:"+id)`, `!abilityShortfall(id, liveCount)`, `!abilityTargetShortfall(id, target)`; then a policy (opener in round 1, damage vs a foe above half hp, defensive when the member is below half; Last Stand only at or below the death-panic threshold). The policy is a choice, not availability.
- **Fire** (`resolveMemberAbility`, `combat.js:3134`; timer by `startMemberAbilityTimer`, `:3110`): the same `abilityEffectTicks`/`ONCE_A_FIGHT` mapping onto `sheet.timers`.

`abilityState(state, state.party[i], key)` therefore returns the same categories for a Joiner. Do NOT add a class check to `abilityState` (hero tests build sparse sheets such as `{ sub: "Bard", abilities: ["kata"] }` with no `cls`); the off-class filter stays `pickMemberAbility`'s. Leave `pickMemberAbility` and its signature alone (direct tests call it without `state`, `party-abilities.test.js:130-190`); pin its ready set equal to the `abilityState` ready set in a new test instead.

### Anti-Patterns to Avoid
- **Deriving a state in the view** (what `abilityRows` and the Sing row do today). The view reads `st.state`, `st.roundsLeft`, `st.reason` and maps them to words, nothing else.
- **Storing the state** on `state`, `c`, a timer record or a row that is later serialized. It is recomputed on every render; there is nothing to carve out of `*Comparable()`.
- **Adding `cls` or `target.alive` checks that `useAbility` does not make.** Any extra rung makes label and tap disagree.
- **Using `opacity` to fade Spent.** It drags the label under 4.5:1; use explicit colours (the locked-beat dim `opacity:.45`, `mazeworld.html:884`, already exists and is separate).
- **Making an ability row `disabled`.** Every row stays tappable (locked decision); `el.disabled = true` stays for `dispatch === null` placeholder rows only (`mazeworld.html:5208-5212`).

## Refusal Reasons And Labels

Every reason `abilityState` can emit, with the engine's own fight-log wording (unchanged by this phase) and the proposed row label. House style: uppercase, plain, exact. Strings go in the new copy module (see Don't Hand-Roll).

| Reason | State | Engine log line (Oracle, `eventNarration.js:1198-1215`) | Row label | Where it can show |
|--------|-------|----------------------------------------------------------|-----------|-------------------|
| (ready) | ready | n/a | `READY`, or `READY · ONCE PER FIGHT` when `meta.cd === "fight"` | rows, Hero tab |
| `cooldown` | recharging | "{name}: ready again in {left} round(s). Your arm has opinions." | `READY IN {n}` (n = `roundsLeft`; "1" is just `READY IN 1`, no plural logic) | rows, Hero tab |
| `spent` | spent | "{name}: spent for this fight." | `SPENT THIS FIGHT` | rows, Hero tab |
| `tooFewFoes` | unavailable | "needs two or more foes, and ..." | `NEEDS TWO OR MORE FOES` (existing copy, `combatMenu.js:54`) | Sweep |
| `alreadyOn` | unavailable | "{target} already has it." | `ALREADY ON IT` (existing, `combatMenu.js:58`) | Hamstring, Mark |
| `noTarget` | unavailable | "nothing left standing to use it on." | `NO FOE IN REACH` (given in CONTEXT) | structurally unreachable in play, reachable in hand-built zero-foe test states |
| `notLowEnough` | unavailable | "Last Stand: only at a quarter of your hp or less, and you have X of Y." | `NEEDS A QUARTER HP OR LESS` (26 chars; see Pitfall 5) | Last Stand (NEW on the row) |
| `notInCombat` | unavailable | "nothing to use it on out here." | `NOT IN A FIGHT` | never on the combat menu; only if a caller asks outside a fight |
| `notFought` | unavailable | "Fight! first, then swing." | `FIGHT FIRST` | never: the combat screen does not render the menu while `combat.pending` (`mazeworld.html:5730-5734`) |
| `unknown` | unavailable | "You do not know that one." | `NOT ONE OF YOURS` | never: rows only exist for owned catalog ids |
| Sing: `songResting` | recharging | `actionRefused sing songResting` | `READY IN {n}` (replaces `AGAIN IN {n}`, `combatMenu.js:105`) | Bard Sing row |
| Sing: `sungThisFight` | spent | `actionRefused sing sungThisFight` | `SPENT THIS FIGHT` (replaces `SUNG THIS FIGHT`, `combatMenu.js:101`) | Bard Sing row |
| Sing: `wrongClass` | unavailable | `actionRefused sing wrongClass` | (no row exists for a non-Bard) | never |

Export `ABILITY_UNAVAILABLE_REASONS = Object.freeze(["unknown","notInCombat","notFought","noTarget","tooFewFoes","alreadyOn","notLowEnough"])` from `engine/abilities.js` and have the copy test assert the copy table has exactly those keys, so a future engine reason cannot ship without a label.

The Oracle and rail refusal lines (`eventNarration.js:1195-1218`, `narrationLines.js:2062-2080`) are not touched: their payloads do not change.

## View: How The Rows Render Today

- **Combat submenu rows** are built by `combatMenuViewModel` → `abilityRows` (`combatMenu.js:180-219`; Sing row `:365-380`; fallback `:400-413`) and drawn by `cbRow(row, n)` in `mazeworld.html:5188-5214`: `className = "cb-row" + (row.enabled ? "" : " cb-row-off")`, `id = "cb-row-" + row.id`, `dataset.cbRow`, then head (`.cb-row-label`, `.cb-row-cost`) and `.cb-row-desc`, all `textContent`, tap via `guardTap(el, () => pickCombatRow(row))`. The only place `enabled` becomes a style is that one line, shared by SPELLS, ABILITIES, ITEMS and SOCIAL rows.
- **Today an ability on cooldown or spent has `enabled: true`** (`combatMenu.js:214`: `enabled: !shortfall`), so it looks identical to a ready one. That is the user's complaint (backlog 999.20). Only `tooFewFoes` and `alreadyOn` rows are greyed.
- **CSS** (`mazeworld.html:900-906`): `.cb-row` border `2px solid #6b5c3c`, bg `#241d12`; `.cb-row-off` border `#241f16`, bg `#191510`, ink `#8f856f`; `.cb-row-cost` `#e8c97a` mono 14px `flex:none`; `.cb-row-desc` `#a89c82`. Tap target `min-height:48px`. Rows are literal hex, not variables.
- **Grid button "N/M READY"** (`combatMenu.js:386-391`) counts ready rows by comparing `cost` strings; switch it to `r.state === "ready"`.
- **Beat view:** the menu is built from `window.__mzBeat?.view?.()?.state || S` (`mazeworld.html:5245`), a frame state, so `abilityState` may run on a non-live snapshot. It reads only `c.timers`, `c.wp`, `combat.{foes,target,pending,allies}` which that state carries (same fields the menu already reads).
- **Hero tab** (`heroTab.js:176-218` `ABILITY_VIEW_COPY` + `abilitiesViewFor`; `:495-524` `renderAbilityRows`): rows `{id, name, description, source, state}`; in combat `state` is `READY` / `"{n} rounds"` / `"once per fight · spent"`; out of combat it is the static declared text (`"cd 4 rounds"`, `"once per fight"`) because `c.timers` is combat-scoped. CSS `ul.skills li` has a `2px solid var(--moss)` left border for every ability and `li span{color:var(--moss)}` (`mazeworld.html:251-259`).
- **Company panel:** no abilities (Finding F1).
- **Hero cannot act** (`C.heroOut`): the whole grid is replaced by LET THE ROUND PLAY (`combatMenu.js:147-158`; `engine.js:71-90` converts any action to `loseTurn`). Untouched; `abilityState` ignores `heroOut`.
- **Pending combat** draws the major overlay, never the menu (`mazeworld.html:5730-5734`).

### Recommended view contract

Combat row: `{ id, label, cost, desc, enabled, state, dispatch }` where `state` is `"ready" | "recharging" | "unavailable" | "spent"`, `cost` is the label from the copy module, `enabled` is `state === "ready"` (the semantic truth; the shell stops using it for ability rows), `dispatch` unchanged (still tappable). Add `roundsLeft` only if a test needs it; the label already carries it.

Hero tab: in combat only, add `stateKind` to each row and use the same label words; out of combat leave the row byte-identical (`state: "cd 4 rounds"`, no new key). That keeps `thief.hero.txt` (the only committed snapshot with an abilities list, lines 64-100) and `characterSheetViewModel.test.js:205-214` unmoved.

Shell hook (`cbRow`): 
```js
el.className = "cb-row" + (row.state ? " cb-row-st" : (row.enabled ? "" : " cb-row-off"));
if (row.state) el.dataset.state = row.state;
```
`shell-combat-actions.test.js:135` asserts the region still contains `cb-row-off`, which the else branch keeps. Rows without a `state` (spells, items, social, placeholders) are untouched.

## Tokens And Accessibility

### Existing colours and their numbers against the dark panel [VERIFIED: computed this session from mazeworld.html hex values]

Row bg `#241d12` (L 0.0130); disabled bg `#191510`; page `#14110c`. Contrast = (L1+0.05)/(L2+0.05).

| Name | Hex | L | Contrast vs row `#241d12` | Source |
|------|-----|---|---------------------------|--------|
| good ink | `#a8cc72` | 0.527 | 9.17 | `.mw-cond[data-tone="good"]`, `mazeworld.html:1527` |
| good edge | `#5e7a3c` | 0.166 | 3.43 | same |
| warn ink | `#e8c97a` | 0.603 | 10.37 | `:1525` (also `--ditto`, `.cb-row-cost`) |
| warn edge | `#6b5c3c` | 0.111 | 2.56 | same |
| bad ink | `#e07260` | 0.287 | 5.36 | `:1523` |
| bad edge | `#a63a2c` | 0.113 | 2.59 | same |
| odd ink | `#b9a4ef` | 0.431 | 7.64 | `:1526` (unused here) |
| disabled ink | `#8f856f` | 0.238 | 4.57 (4.98 on `#191510`) | `.cb-row-off` |
| `--amber` | `#d99a2b` | 0.380 | 6.83 | `:root` (the refusal amber) |

Why the existing set fails the user's own requirement: good vs warn luminance ratio is 1.13 (indistinguishable in greyscale); bad vs disabled-grey under protanopia is 1.01 with ΔE76 8.6 (the red is crushed to the same olive-grey).

### Proposed tokens [VERIFIED: computed; matrices from the authors' page]

Define once in the `:root` block (`mazeworld.html:58-163`, insert before line 163):

```css
/* Phase 94 (ASTATE-01/05) — the four ability-state inks, defined once. Ink = label colour AND edge colour. */
--mw-ast-ready:#cbee86;        /* READY            solid edge   */
--mw-ast-recharging:#eeb433;   /* READY IN N       dashed edge  */
--mw-ast-unavailable:#fc7970;  /* reason           dotted edge + 12% hatch */
--mw-ast-spent:#86898c;        /* SPENT THIS FIGHT no edge, flat #191510 bg */
```

| State | Ink | L | Contrast vs row `#241d12` | vs `#191510` | Edge |
|-------|-----|---|---------------------------|--------------|------|
| ready | `#cbee86` | 0.756 | 12.79 | 13.94 | `2px solid` ink |
| recharging | `#eeb433` | 0.511 | 8.90 | 9.70 | `2px dashed` ink |
| unavailable | `#fc7970` | 0.355 | 6.44 | 7.01 | `2px dotted` ink + `repeating-linear-gradient(135deg, rgba(252,121,112,.12) 0 1px, transparent 1px 6px)` |
| spent | `#86898c` | 0.249 | 4.74 | 5.16 | none (`2px solid #241f16`, the existing near-invisible off border), bg `#191510`, description ink `#8f856f` |

Edge colours only need 3:1 against the surround (WCAG 1.4.11 non-text); using the ink as the edge gives 6.4 to 12.8. Muted alternatives that still pass if the user finds lime too loud: `#5e7a3c` (3.43), `#a8761f` (4.19), `#c4483a` (3.44).

Hatch ceiling: composite bg at alpha a of `#fc7970` over `#241d12` gives ink contrast 5.50 (a .10), 5.12 (.14), 4.73 (.18), 4.14 (.25); the description ink `#a89c82` gives 5.26 / 4.89 / 4.52 / 3.95. Cap alpha at 0.14 (0.12 recommended); at 0.12 the hatch is faint on a desktop render and the dotted edge carries the cue, so flag the hatch weight for the on-device check.

Pairwise distinctness of the four inks (Lratio = luminance ratio, ΔE = CIE76 in Lab):

| Pair | Greyscale Lratio | Protanopia Lratio / ΔE | Deuteranopia Lratio / ΔE |
|------|------------------|------------------------|---------------------------|
| ready / recharging | 1.44 | 1.60 / 26.2 | 1.35 / 26.1 |
| ready / unavailable | 1.99 | 2.48 / 44.7 | 1.75 / 22.0 |
| ready / spent | 2.70 | 2.71 / 63.0 | 2.69 / 56.7 |
| recharging / unavailable | 1.38 | 1.55 / 55.0 | 1.30 / 35.3 |
| recharging / spent | 1.88 | 1.69 / 75.9 | 1.99 / 73.5 |
| unavailable / spent | 1.36 | 1.09 / 21.0 | 1.53 / 38.4 |
| **minimum** | **1.36** | **1.09 / 21.0** | **1.30 / 22.0** |

Simulated inks (Machado 2009, severity 1.0): ready → `#f8e27e` prot, `#f4e18c` deut; recharging → `#ccb519`, `#dac339`; unavailable → `#99906f`, `#b9ab6d`; spent → `#88898c`, `#87888c`.

Pinned thresholds that this set passes with margin: every ink >= 4.5:1 on its worst background (hatch composite for unavailable; `#191510` for spent); every non-spent edge >= 3:1 on `#14110c`; greyscale luminance ratio >= 1.30 for all six pairs (min 1.36); ΔE76 >= 20 for all six pairs under normal, protanopia and deuteranopia (min 21.0). Protanopia unavailable/spent is the tight pair (Lratio 1.09, ΔE 21.0): colour there is deliberately the weakest cue and the edge style plus the words carry it, which the test enforces separately.

I rendered the four rows with exactly these rules in headless Chrome (greyscale filter and SVG feColorMatrix protanopia/deuteranopia filters) and looked at the image: solid, dashed, dotted-plus-hatch and no-edge read apart in all four renderings, including greyscale. The layout check also showed `NEEDS A QUARTER HP OR LESS` fits a 392px list at 14px mono only because the cost slot was allowed to shrink (Pitfall 5).

### How to pin it in a pure node:test

`test/unit/ability-state-a11y.test.js` (no DOM, no network): read `mazeworld.html` (strip `\r\n` as `combat-submenu-fit.test.js:20-22` does), regex the four `--mw-ast-*` tokens out of `:root`, regex each state's `border` shorthand and the hatch alpha out of the `.cb-row[data-state="…"]` rules (same `rulesFor`/`baseRule`/`decl` helpers pattern as `combat-submenu-fit.test.js:24-48`), then assert:

1. **Four tokens defined once** and no other rule hard-codes them (grep the file for each hex, expect the `:root` line plus the one literal `rgba()` of the hatch).
2. **Text contrast:** each ink >= 4.5:1 on its row background; unavailable on the hatch composite at the declared alpha; spent on `#191510`.
3. **Edge contrast:** each non-spent edge ink >= 3:1 on `#14110c`.
4. **Non-colour cue is not hue alone:** the four `border-style` values are pairwise distinct (`solid`, `dashed`, `dotted`, and an edge that is not visible for spent), the four labels from the copy module are pairwise distinct, and no two states share both.
5. **Greyscale:** relative luminance (Rec. 709 on linearised sRGB) pairwise ratio >= 1.30.
6. **Colour-blind:** for protanopia and deuteranopia apply the matrices to linear RGB, convert to Lab, require pairwise ΔE76 >= 20.
7. **Teeth (fail-first, the repo's habit, e.g. `bridge-registry.test.js` header):** feed the OLD tone inks (`#a8cc72`, `#e8c97a`, `#e07260`, `#8f856f`) to the same functions and assert the greyscale check FAILS (good/warn 1.13) and the protanopia check FAILS (bad/grey ΔE 8.6).

Machado 2009 matrices, severity 1.0, applied to LINEAR RGB (rows are output R, G, B) [CITED: https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html]:

```js
const PROTAN = [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]];
const DEUTAN = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]];
// sRGB -> linear: v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4 ; clamp matrix output to [0,1] ; Lab via D65 (X/0.95047, Z/1.08883)
```

### Existing a11y and shell tests (what exists, what moves)

There is no existing contrast or colour-blind test (grep for contrast/luminance/colorblind in `test/` finds only unrelated hits). Existing relevant guards:
- `test/unit/shell-tab-snapshots.test.js` (8 committed fixtures in `test/unit/fixtures/shell-snapshots/`; compare byte-for-byte; `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js` rewrites them; a missing fixture is a hard failure; CRLF-tolerant). Only `thief.hero.txt` contains an abilities list, and it stays byte-identical if the out-of-combat Hero rows are left unchanged (recommended). `mu.hero.txt` holds the "Spells are the trick." none row and a Company card with no abilities. Declare nothing, regenerate nothing.
- `test/unit/combat-submenu-fit.test.js`: `.cb-row` must have exactly one base rule; rules naming `.cb-row` must not set `height`/`max-height`, must not use `overflow:hidden|clip`, `text-overflow`, `line-clamp` or `white-space:nowrap`. Attribute selectors like `.cb-row[data-state="ready"]` are fine (they match `rulesFor` but not `baseRule`); a class name `cb-row-st` is also fine (`.cb-row-st` does not match the `.cb-row` token, which requires a non-`[\w-]` next char).
- `test/unit/text-scale.test.js:253`: font sizes must be `calc(<rem> * var(--mw-text-scale))`; declare no `--mw-font-*` outside `:root`. The new tokens are colours, so unaffected; do not add pixel font sizes.
- `test/unit/shell-combat-actions.test.js:135-139`: `cbRow` region must still contain `cb-row-off`, `cb-row-label`, `cb-row-cost`, `cb-row-desc`, `dataset.cbRow`, exactly one `guardTap(el, () => pickCombatRow(row))`, `el.disabled = true`, and no `innerHTML`.
- `test/unit/combat-lock-shell.test.js` shows how to drive the real `renderEncounter()` with an open submenu.

## Snapshots: how to pin the rendered rows

The sandbox renders the real ABILITIES submenu. Verified in the prototype: with `st.combat` set, `sandbox.context.window.__mzCombatMenu = { open: "abilities" }; sandbox.context.renderEncounter();` then `doc.document.getElementById("enc-body").querySelector("#cb-sub-list")` returned the four rows with their classes and text (for example `cb-row cb-row-off | POMMEL STRIKEREADY IN 3 | ...`). Build `test/unit/shell-ability-states.test.js` with the same `check(name, text)` helper and `MZ_SNAPSHOT_UPDATE=1` convention as `shell-tab-snapshots.test.js:171-185`, fixtures under `test/unit/fixtures/shell-snapshots/`:

- `thief.abilities-states.txt`: a Fighter or Thief with four owned abilities, one in each state (ready, `startCooldown(..., {rounds: 3})`, `startCooldown(..., {rounds: 999})` on a `cd:"fight"` ability, Sweep against one live foe), serialize `["cb-sub-title", "cb-sub-list"]`. Rows carry `class="cb-row cb-row-st" data-state="…"`.
- `thief.hero-in-combat.txt`: the Hero tab `#s-abilities` with `state.combat` set, same four states (`li data-state`, label text).
- A greyscale proof is not a snapshot; it is the pure a11y test above.

Capture is one-shot and the first run must be `MZ_SNAPSHOT_UPDATE=1`; commit the fixtures with a SUMMARY that names the DOM change (the file header documents this declared-change discipline).

## Tests That Pin Today's Strings (and will move)

Prototype result: with the label change applied to the combat menu, the Sing row and the Hero tab, the unit tree has exactly these real failures (plus the environmental MAP-09 one); everything else, including `voice-corpus`, `hp-not-wp`, `class-trims-nrf-copy`, `combat-submenu-fit`, `text-scale` and `shell-tab-snapshots`, stayed green. [VERIFIED: ran `node --test test/unit/*.test.js` in a scratch copy: 9,957 tests, 11 fail = 10 listed + MAP-09.]

| Test (file:line) | Pins | Why it moves | Fix |
|------------------|------|--------------|-----|
| `test/unit/combatMenu.test.js:141-152` "Bard: ABILITIES opens SING..." | Sing cost `"SUNG THIS FIGHT"`, `enabled:false`, row deepEqual at `:143-145` | label to `SPENT THIS FIGHT`; row gains `state` | update strings, add `state` to the expected row |
| `test/unit/combatMenu.test.js:618-632` "Fighter ... kata, brace" | `"2/2 READY"`, deepEqual rows | `fixedCombat([])` has ZERO foes, so Kata/Brace now read `NO FOE IN REACH`; rows gain `state` | give the fixture one live foe (`fixedFoe`) and add `state:"ready"` |
| `test/unit/combatMenu.test.js:647-668` cost text | `"3 ROUNDS"`, `"1 ROUND"`, `"ONCE PER FIGHT · SPENT"`, `"6 ROUNDS"`, `enabled` stays true on cooldown | new labels `READY IN 3`, `READY IN 1`, `SPENT THIS FIGHT`, `READY IN 6`; `enabled` is now false when not ready | rewrite; the "stays enabled" claim becomes "stays tappable: `dispatch` still `useAbility`" |
| `test/unit/combatMenu.test.js:670-684` Bard rows | deepEqual Sing and Kata rows | zero-foe fixture, `state` field | one live foe, add `state` |
| `test/unit/once-per-fight-copy.test.js:66-85` | `COMBAT_MENU_COPY.abilityReadyOnce/abilityUsedUp` literal values, `ABILITY_VIEW_COPY.used`, `enabled === true` on a spent row, `"1/2 READY"` | keys removed or renamed; `enabled` false | re-point to the new copy module |
| `test/unit/value-abilities.test.js:402-420` | `"2 ROUNDS"`, `"ONCE PER FIGHT · SPENT"`, Hero `"2 rounds"`, `"once per fight · spent"`; out of combat `"cd 4 rounds"` etc. | in-combat words change; the out-of-combat lines (`idle.*`) must NOT change | update the in-combat assertions only |
| `test/unit/bard-song.test.js:405-430` | Sing `READY` / `AGAIN IN n` (`:424`) / `SUNG THIS FIGHT` | Sing labels | update |
| `test/unit/value-identity.test.js:544-557` | `COMBAT_MENU_COPY.singAgain` / `singSung` | keys removed | update |
| `test/unit/characterSheetViewModel.test.js:216-230` | in-combat Hero state text `"2 rounds"`, `"once per fight · spent"`; uses `state.combat = {}` (no `foes`) | new words; `abilityState` must tolerate `combat.foes` missing (see Pitfall 2) | add a foe, update words; `:205-214` out-of-combat deepEqual stays |
| `test/unit/shell-abilities.test.js:117-131` | `import { abilityRoundsLeft } ... engine/abilities.js` and `import { isReady } ... engine/effects.js` source regexes in `heroTab.js` | heroTab imports `abilityState` instead | update the two import regexes; the `renderAbilityRows` region regexes at `:100-110` must keep matching `function renderAbilityRows(doc, state) {`, `ul.replaceChildren();`, `row.source === "pool" ? "trick" : "special skill · active"`, `characterSheetViewModel(state).abilities` |
| `test/unit/hp-not-wp.test.js:31,174` | scans a fixed list of copy banks for forbidden "wp" wording | new bank is not in the list | add the new copy bank to the list |

Pinned and unchanged: `class-trims-nrf-copy.test.js:73-81` (`NEEDS TWO OR MORE FOES`, `"1/2 READY"` / `"2/2 READY"`; keep those two strings), `value-abilities.test.js:333-339` (`ALREADY ON IT`), all Oracle/rail `abilityRefused` narration tests, `hero-conditions.test.js:440` and `foe-conditions.test.js:458` (comments that mention `AGAIN IN n` inside descriptor strings; harmless, optionally reword). `test/unit/voice-corpus.test.js` "completeness" fails if a NEW frozen copy object ships in `src/browser` without being registered as a bank in `tools/lib/voice-corpus.mjs` (`bank(...)` lines ~140-156); register the new module (surface `"combat-screen"`).

## Test Commands

| Purpose | Command |
|---------|---------|
| Full suite (baseline after 93.1: 10,226 tests, 10,218 pass, 0 fail, 8 skipped; about 2m45s on this machine) | `npm test` (= `node --test`) |
| Quick tree | `npm run test:quick` |
| Engine + parity gate | `node --test test/unit/abilities.test.js test/unit/ability-state.test.js test/unit/value-abilities.test.js test/unit/party-abilities.test.js test/unit/ability-strike.test.js test/unit/bard-song.test.js test/parity/*.test.js test/determinism/*.test.js test/roundtrip/*.test.js` |
| View + shell | `node --test test/unit/combatMenu.test.js test/unit/heroTab.test.js test/unit/characterSheetViewModel.test.js test/unit/shell-abilities.test.js test/unit/shell-combat-actions.test.js test/unit/combat-submenu-fit.test.js test/unit/once-per-fight-copy.test.js test/unit/class-trims-nrf-copy.test.js test/unit/value-identity.test.js test/unit/hp-not-wp.test.js test/unit/voice-corpus.test.js test/unit/shell-tab-snapshots.test.js test/unit/ability-state-a11y.test.js test/unit/shell-ability-states.test.js` |
| Record the new snapshot (first run only) | `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-ability-states.test.js` |
| Boot gate after `mazeworld.html` edits | `npm run build:www && npm run boot:check` (headless Chrome is installed: `C:/Program Files/Google/Chrome/Application/chrome.exe`) |

`node --test <directory>` does NOT work (Node 22 treats it as a module path and fails); pass globs or file lists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this ability usable and why not" | A second ladder in `combatMenu.js`/`heroTab.js` | `abilityState` | The existing duplicate already disagrees with the engine on Last Stand and on the dead-target retarget |
| Rounds left | New arithmetic | `abilityRoundsLeft` (effect phase `left + cd`, `abilities.js:220-224`) | Handles the duration abilities (Sidestep reads `READY IN 6` while running) |
| Bard song clock | `Math.max(1, sangAt + gap - round)` in the view | `singState` over `songDue`/`SONG_GAP_ROUNDS` | Same reason |
| Label strings | Literals scattered in two view-models | One frozen copy module + `abilityStateLabel(st, meta)` | Hero tab and combat menu must say identical words; `heroTab.js` cannot import `combatMenu.js` (cycle) |
| Contrast/colour-blind maths | An npm colour library | ~40 lines in the a11y test | No new dependency; the matrices are 9 numbers each |
| Faded Spent look | `opacity` | explicit colours | `opacity` breaks the 4.5:1 label contrast |
| Hatch | An image or glyph | `repeating-linear-gradient` with a literal `rgba()` | The pixel font may lack glyphs; no asset; works in every WebView |

**Key insight:** the phase is "make the view stop guessing". Everything the player sees is a pure function of data the engine already holds; the work is one derived function, one label table and four tokens, plus the tests that make drift impossible.

## Common Pitfalls

### Pitfall 1: `normalizeTarget` is a mutation hidden inside the ladder
**What goes wrong:** Calling `normalizeTarget(C)` before `abilityState` (or inside it) changes `combat.target` on cooldown/spent refusals, where the engine today leaves it alone.
**Why:** The original ladder retargets only after the cooldown rung (`abilities.js:348-350`).
**How to avoid:** `abilityState` computes the effective target without mutating; `useAbility` calls `normalizeTarget` at the same point as today (Pattern 2).
**Warning signs:** A serialized combat diff after a refused cooldown tap.

### Pitfall 2: `abilityState` throws on a hand-built `combat: {}`
**What goes wrong:** `liveFoes(state)` does `state.combat.foes.filter` (`combat.js:130-132`); `characterSheetViewModel.test.js:216-229` uses `state.combat = {}`. The prototype threw `Cannot read properties of undefined (reading 'filter')`.
**How to avoid:** inside `abilityState` use `Array.isArray(C.foes) ? C.foes.filter(f => f && f.alive) : []`. A foe-less combat then yields `noTarget` for foe abilities (matches what the engine refuses with); fix the fixtures to include one live foe rather than special-casing "unknown foes".
**Warning signs:** TypeError in a view-model test.

### Pitfall 3: Zero-foe fixtures flip from READY to NO FOE IN REACH
**What goes wrong:** Tests built on `fixedCombat([])` expect Kata/Brace READY. `noTarget` is structurally unreachable in play (`abilities.js:343-347`) but is a ladder rung `useAbility` really refuses on, so the label must show it.
**How to avoid:** add one live foe to those fixtures (4 combatMenu tests, `once-per-fight-copy`, `value-abilities`, `characterSheetViewModel`). Do not weaken `abilityState` to hide the rung.

### Pitfall 4: Event payload drift
**What goes wrong:** A reordered key or a dropped `name: undefined` changes `deepStrictEqual` and JSON fixtures.
**How to avoid:** keep the literals as in Pattern 2; the agreement sweep (below) compares the first event of a refused call to the pre-refactor shape.

### Pitfall 5: Long reasons overflow the cost slot
**What goes wrong:** `.cb-row-cost` is `flex:none` 14px mono (`mazeworld.html:904`). `NEEDS A QUARTER HP OR LESS` is 26 characters (existing longest is 22) and the text-scale setting goes to 1.25.
**How to avoid:** for state rows set the cost to `flex:0 1 auto; text-align:right; overflow-wrap:anywhere` so it wraps instead of pushing the label (the headless render confirms it fits at 392px). Pin the longest label length in the copy test (<= 26).

### Pitfall 6: Colour is the only difference between two states under CVD
**What goes wrong:** red and grey collapse under protanopia (ΔE 8.6 for the old set).
**How to avoid:** use the proposed inks and the pinned ΔE >= 20 check, and keep the edge-style and words checks independent of colour.

### Pitfall 7: Treating `enabled` as the tap gate
**What goes wrong:** Setting `enabled:false` on a recharging row tempts someone to also null its `dispatch`.
**How to avoid:** `dispatch` is never nulled for ability rows; only `id:"none"` placeholders have `dispatch: null` (`combatMenu.js:412`). A test asserts every ability and Sing row has a dispatch.

### Pitfall 8: Duration abilities read as "recharging" while their effect runs
**What goes wrong:** Sidestep used this round shows `READY IN 6` (effect `left` 2 plus cd 4) even though its effect is active. That is today's "6 ROUNDS" behaviour with new words; the "Active" state is deferred.
**How to avoid:** do nothing; record it in the plan so the on-device review does not file it as a bug.

### Pitfall 9: Snapshots and new copy banks
`voice-corpus.test.js` "completeness" and `hp-not-wp.test.js` scan copy banks. Register the new bank and add it to the `hp-not-wp` list in the same plan that creates it, or the full suite goes red between plans.

## Code Examples

### The engine function (prototype, passes the suite)
```js
// Source: prototype in a git-archive copy of HEAD f5859216 (not committed); adapt names/comments to house style
export const ABILITY_UNAVAILABLE_REASONS = Object.freeze(["unknown", "notInCombat", "notFought", "noTarget", "tooFewFoes", "alreadyOn", "notLowEnough"]);

export function abilityState(state, sheet, key) {
  const meta = typeof key === "string" ? ABILITY_BY_ID[key] : null;
  const owned = !!meta && !!sheet && Array.isArray(sheet.abilities) && sheet.abilities.includes(key);
  const no = (reason) => ({ state: "unavailable", roundsLeft: 0, reason });
  if (!owned) return no("unknown");
  const C = state && state.combat;
  if (!C) return no("notInCombat");
  if (C.pending) return no("notFought");
  if (!isReady(sheet, `ability:${key}`)) {
    if (meta.cd === "fight") return { state: "spent", roundsLeft: 0, reason: "spent" };
    return { state: "recharging", roundsLeft: abilityRoundsLeft(sheet, key), reason: "cooldown" };
  }
  const live = Array.isArray(C.foes) ? C.foes.filter((f) => f && f.alive) : [];   // Pitfall 2
  const needsFoe = meta.target === "foe" || meta.target === "foes";
  if (needsFoe && !live.length) return no("noTarget");
  const short = abilityShortfall(key, live.length);
  if (short) return no(short);
  if (needsFoe) {
    const aimed = sheet === state.c ? C.foes[C.target] : null;
    const t = aimed && aimed.alive ? aimed : live[0];
    if (abilityTargetShortfall(key, t) === "alreadyOn") return no("alreadyOn");
  }
  if (key === "lastStand") {
    let wp = sheet.wp, max = sheet.maxWP;
    if (sheet !== state.c && Array.isArray(C.allies)) {
      const ally = C.allies.find((a) => state.party && state.party[a.partyIdx] === sheet);
      if (ally) { wp = ally.wp; max = ally.maxWP; }
    }
    if (wp > max * DEATH_PANIC_THRESHOLD) return no("notLowEnough");
  }
  return { state: "ready", roundsLeft: 0, reason: null };
}
```
Note `abilityShortfall` takes `liveCount`, so rung 6 uses `live.length`, not `liveFoes(state)` (which would throw on a foe-less combat).

### The agreement sweep that proves "a tap always agrees"
```js
// test/unit/ability-state.test.js (sketch)
for (const key of Object.keys(ABILITY_BY_ID)) for (const scenario of SCENARIOS) {
  const s = scenario.build(key);                       // ready | cooldown(n) | effect phase | spent | 1 foe | 2 foes | target marked/hamstrung | hp high/low | pending | no combat | not owned
  const before = JSON.stringify(s);
  const st = abilityState(s, s.c, key);
  assert.equal(JSON.stringify(s), before);             // pure: no writes
  const throwingRng = { d() { throw new Error("draw"); }, getState: () => 1 };
  assert.doesNotThrow(() => abilityState(s, s.c, key));   // draws nothing
  const ev = useAbility(structuredClone(s), key, fakeRng(FILL), []);
  const first = ev[0];
  if (st.state === "ready") assert.equal(first.type, "abilityUsed");
  else {
    assert.equal(first.type, "abilityRefused");
    assert.equal(first.reason, st.reason);
    if (st.state === "recharging") assert.equal(first.left, st.roundsLeft);
  }
}
```
Add: the same sweep for `sing`/`singState`; Joiner pins (`abilityState(state, state.party[0], key)` for a Fighter and a Thief Joiner: ready, cooldown with `roundsLeft`, spent, Sweep with one foe, Hamstring on a hamstrung first foe, Last Stand above and at 25% of the `ally` hp); and `pickMemberAbility(...)`'s ready set (no policy filter) equals the `abilityState`-ready set minus the policy-only cases; and the existing `party-abilities.test.js` stays green.

### The copy module
```js
// src/browser/abilityStates.js (new) — pure, no DOM
export const ABILITY_STATE_COPY = Object.freeze({
  ready: "READY",
  readyOnce: "READY · ONCE PER FIGHT",
  recharging: "READY IN {n}",
  spent: "SPENT THIS FIGHT",
  reason: Object.freeze({
    tooFewFoes: "NEEDS TWO OR MORE FOES",
    alreadyOn: "ALREADY ON IT",
    noTarget: "NO FOE IN REACH",
    notLowEnough: "NEEDS A QUARTER HP OR LESS",
    notInCombat: "NOT IN A FIGHT",
    notFought: "FIGHT FIRST",
    unknown: "NOT ONE OF YOURS",
    wrongClass: "NOT FOR YOU",
  }),
});
export function abilityStateLabel(st, meta) {
  if (st.state === "ready") return meta && meta.cd === "fight" ? ABILITY_STATE_COPY.readyOnce : ABILITY_STATE_COPY.ready;
  if (st.state === "recharging") return ABILITY_STATE_COPY.recharging.replace("{n}", String(st.roundsLeft));
  if (st.state === "spent") return ABILITY_STATE_COPY.spent;
  return ABILITY_STATE_COPY.reason[st.reason] ?? ABILITY_STATE_COPY.reason.unknown;
}
```

### CSS
```css
/* Phase 94 — row state: edge style + ink + (unavailable) hatch. Never sets a height; never nowrap. */
.cb-row.cb-row-st{background:#241d12}
.cb-row[data-state="ready"]{border:2px solid var(--mw-ast-ready)}
.cb-row[data-state="recharging"]{border:2px dashed var(--mw-ast-recharging)}
.cb-row[data-state="unavailable"]{border:2px dotted var(--mw-ast-unavailable);background-image:repeating-linear-gradient(135deg,rgba(252,121,112,.12) 0 1px,transparent 1px 6px)}
.cb-row[data-state="spent"]{border:2px solid #241f16;background:#191510;color:#8f856f}
.cb-row[data-state] .cb-row-cost{flex:0 1 auto;text-align:right;overflow-wrap:anywhere}
.cb-row[data-state="ready"] .cb-row-cost{color:var(--mw-ast-ready)}
.cb-row[data-state="recharging"] .cb-row-cost{color:var(--mw-ast-recharging)}
.cb-row[data-state="unavailable"] .cb-row-cost{color:var(--mw-ast-unavailable)}
.cb-row[data-state="spent"] .cb-row-cost{color:var(--mw-ast-spent)}
.cb-row[data-state="spent"] .cb-row-desc{color:#8f856f}
/* Hero tab (in combat only): same four edges on the list item's left rule */
ul.skills li[data-state="ready"]{border-left:2px solid var(--mw-ast-ready)}
ul.skills li[data-state="recharging"]{border-left:2px dashed var(--mw-ast-recharging)}
ul.skills li[data-state="unavailable"]{border-left:2px dotted var(--mw-ast-unavailable)}
ul.skills li[data-state="spent"]{border-left:2px solid transparent}
ul.skills li[data-state="ready"] span{color:var(--mw-ast-ready)}   /* ...and the other three inks */
```
The Hero tab's 2px left rule is its only edge, so give the dotted and no-edge states a wider rule (4px) in the final CSS and let the test read the same style names; the wording on the row is the primary cue there.

## State of the Art

| Old approach | Current approach | When | Impact |
|--------------|------------------|------|--------|
| View infers state from timers and re-runs shortfall rules | Engine derives `{state, roundsLeft, reason}`; view maps to words | this phase | One rule, structurally agreeing with the tap |
| One shared "disabled" style for any unavailable row | Four states by words, edge style and ink | this phase | Cooldown, can't-use, spent and ready all distinguishable |

**Deprecated/outdated:** `COMBAT_MENU_COPY.abilityRound/abilityRounds/abilityUsedUp/abilityReady/abilityReadyOnce/abilityTooFewFoes/abilityAlreadyOn/singReady/singAgain/singSung` and `ABILITY_VIEW_COPY.ready/rounds/used` (move to the copy module; delete the old keys so no second wording survives). `ABILITY_VIEW_COPY.cd`/`.once` (out-of-combat static text) stay.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `color-mix()` is unsafe on the Android System WebView floor, so a literal `rgba()` is used | Standard Stack, Alternatives | Low: a literal rgba works everywhere; only matters if someone prefers `color-mix` |
| A2 | The user accepts the new ink values (`#cbee86`, `#eeb433`, `#fc7970`, `#86898c`), which are lighter and a little different from the existing `good`/`warn`/`bad` inks, in exchange for meeting the greyscale and protanopia requirement | Tokens | Medium: the families are kept (green-gold, amber, rust-red-to-coral, grey) but the exact hues move; the alternative is the old inks, which fail the pinned thresholds. Confirm on device |
| A3 | Sing's row should use the common words (`READY IN n`, `SPENT THIS FIGHT`) instead of its own `AGAIN IN n` / `SUNG THIS FIGHT` | Refusal Reasons table | Low: purely wording; the grid button's sub-line `SING · SUNG` can stay |
| A4 | The Hero tab should show the four states only in combat and keep its static out-of-combat text | Recommended view contract | Low: keeps `thief.hero.txt` unmoved; the alternative (always show a state) moves that fixture and would have to invent an out-of-combat state |
| A5 | No new Joiner ability list is wanted even though CONTEXT assumed one exists | Finding F1 | Medium: if the user wanted Joiner abilities visible in the Company card, that is a new feature and needs its own decision |
| A6 | Wording `NEEDS A QUARTER HP OR LESS`, `NOT IN A FIGHT`, `FIGHT FIRST`, `NOT ONE OF YOURS`, `NOT FOR YOU` | Refusal Reasons | Low: Claude's discretion per CONTEXT; the last four never display |

## Open Questions

1. **Does the user want Joiner ability states visible anywhere?**
   - Known: the Company panel does not list Joiner abilities; Joiners auto-act with no menu.
   - Unclear: CONTEXT assumed a listing exists.
   - Recommendation: engine-only plus tests (as planned); mention in the plan summary so the user can ask for a Joiner ability line later.
2. **Hatch weight and lime brightness on the Pixel 7.** The 12% hatch is faint in a desktop render and `#cbee86` is bright. Human check at the end of the phase (config `human_verify_mode: end-of-phase`); tune alpha (cap 0.14) or swap to the muted edges listed under Tokens. Tests keep passing as long as the pinned thresholds hold.
3. **Last Stand now reads NEEDS A QUARTER HP OR LESS at high hp.** Intended (it is the truth the tap already enforced), but it is a visible change to a row the player saw as READY before. Worth one line in the SUMMARY.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests | yes | v22.23.2 | none needed |
| Headless Chrome / Edge | `npm run boot:check`, optional visual render of the four rows | yes | `C:/Program Files/Google/Chrome/Application/chrome.exe` | skip; unit tests do not need it |
| `git` | `npm test` includes tests that call git (MAP-09, secret scan) | yes in the repo | repo is a git checkout | in a `git archive` scratch copy those two tests fail/skip (known; not a phase problem) |
| Pixel 7 over wireless adb | on-device review of the hatch and colours | user-run | per STATE.md | the user reviews and reports (screenshots hit the lock screen) |

**Missing dependencies with no fallback:** none.

## Plan Split (waves, no `files_modified` overlap inside a wave)

| Wave | Plan | Goal | files_modified |
|------|------|------|----------------|
| 1 | 94-01 Engine | `abilityState`, `ABILITY_UNAVAILABLE_REASONS`, `singState`; `useAbility` and `sing()` refusals read them; agreement sweep, purity/no-draw, Joiner and Sing pins; docs ladder note | `engine/abilities.js`, `engine/combat.js`, `test/unit/ability-state.test.js` (new), `docs/ABILITIES.md` |
| 1 | 94-02 Copy | `src/browser/abilityStates.js` copy + `abilityStateLabel`; register the bank; coverage test against `ABILITY_UNAVAILABLE_REASONS` (import the constant from the engine, so this plan reads 94-01's export only at test time: have 94-02's test define its expected key list inline and let 94-04 assert equality with the engine constant) | `src/browser/abilityStates.js` (new), `tools/lib/voice-corpus.mjs`, `test/unit/ability-state-copy.test.js` (new), `test/unit/hp-not-wp.test.js` |
| 1 | 94-03 Tokens, CSS, shell hook | `:root` tokens, `.cb-row[data-state]` and `ul.skills li[data-state]` rules, `cbRow` `data-state`/`cb-row-st`, cost-slot wrap rule; the pure a11y test with teeth | `mazeworld.html`, `test/unit/ability-state-a11y.test.js` (new), `test/unit/shell-combat-actions.test.js` |
| 2 | 94-04 View models | `combatMenu.js` (`abilityRows`, Sing row, `N/M READY`) and `heroTab.js` (`abilitiesViewFor(c, state)`, `renderAbilityRows` `data-state`) onto the engine and copy module; delete the old copy keys; update the ten moved tests | `src/browser/combatMenu.js`, `src/browser/heroTab.js`, `test/unit/combatMenu.test.js`, `test/unit/once-per-fight-copy.test.js`, `test/unit/value-abilities.test.js`, `test/unit/bard-song.test.js`, `test/unit/value-identity.test.js`, `test/unit/characterSheetViewModel.test.js`, `test/unit/shell-abilities.test.js` |
| 3 | 94-05 Snapshots and gate | New shell snapshot test + fixtures (combat submenu, Hero tab in combat), `abilityStates` ↔ engine reason coverage assertion, full `npm test`, `npm run build:www && npm run boot:check`, SUMMARY with the declared DOM change and the deferred on-device check | `test/unit/shell-ability-states.test.js` (new), `test/unit/fixtures/shell-snapshots/*.txt` (new files only), `.planning/phases/94-ability-states-you-can-tell-apart/94-VERIFICATION.md` |

Dependencies: 94-04 needs 94-01 (engine) and 94-02 (labels); 94-05 needs 94-03 and 94-04. Wave 1 plans are independent: 94-03 only adds an attribute hook (a row without `state` behaves exactly as today) and 94-02 only adds a module. The view-model plan is one plan on purpose: `value-abilities.test.js:402-420` asserts the combat row and the Hero row in one test, so splitting them would leave a red suite between plans.

Wave 1 gate (per plan): `node --test` on that plan's files, plus for 94-01 the parity/determinism/round-trip globs from Test Commands. Wave 2 gate: the View + shell command list. Phase gate: `npm test` green at or above 10,226 tests (new tests add to the count; 0 fail; the 8 skips unchanged).

## Sources

### Primary (HIGH confidence)
- `engine/abilities.js:1-495` (ladder `:317-376`, helpers `:140-224`), `engine/combat.js:119-123, 130-166, 680-684, 2354-2411, 2680-2806, 2967-2993, 3110-3180`, `engine/effects.js:236-255`, `engine/engine.js:71-90`, `engine/derived.js:29`, `content/abilities.js` (full catalog, 20 entries) [VERIFIED: read]
- `src/browser/combatMenu.js:26-219, 238-414`, `src/browser/heroTab.js:165-218, 485-524, 830-910`, `src/browser/eventNarration.js:1189-1218`, `src/browser/narrationLines.js:2057-2080` [VERIFIED: read]
- `mazeworld.html:58-163` (`:root`), `:251-259`, `:716-723`, `:884-906`, `:1523-1527`, `:4119-4128`, `:5188-5318`, `:5730-5734` [VERIFIED: read]
- Tests read: `test/unit/combatMenu.test.js`, `shell-tab-snapshots.test.js`, `combat-submenu-fit.test.js`, `shell-combat-actions.test.js`, `shell-abilities.test.js`, `once-per-fight-copy.test.js`, `value-abilities.test.js`, `characterSheetViewModel.test.js`, `party-abilities.test.js`, `voice-corpus.test.js`, `combat-lock-shell.test.js`, `bridge-registry.test.js` [VERIFIED: read/grep]
- Prototype and full-suite runs in a `git archive` copy (engine-only: 10,226 tests, 10,216 pass, 1 environmental fail, 9 skipped; view prototype: exactly 10 real unit failures)
- Computation scripts (sRGB luminance, WCAG ratio, Machado 2009, CIE76) in the session scratchpad; headless Chrome render of the four rows with greyscale and CVD filters

### Secondary (MEDIUM confidence)
- [Machado, Oliveira, Fernandes 2009 simulation matrices, severity 1.0](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html) [CITED], cross-checked against the paper's title and authorship via search

### Tertiary (LOW confidence)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new is installed
- Architecture (engine contract, refactor, Joiners, Sing): HIGH, prototyped and the full suite run
- View and tests-that-move: HIGH, the failing set was produced by running the prototype
- Tokens and accessibility numbers: HIGH for the arithmetic; MEDIUM for how the colours feel on the Pixel 7 (needs the human check)
- Pitfalls: HIGH

**Research date:** 2026-10-03
**Valid until:** 2026-11-03 (stable; invalidated by any change to the ability catalog, `useAbility`'s ladder, or the `cb-row` CSS before planning)

*Project constraints honoured:* `security_enforcement` is false in `.planning/config.json`, so no Security Domain section; `workflow.nyquist_validation` is false, so no Validation Architecture section. Project instructions from `.claude/CLAUDE.md`: all repo edits go through a GSD workflow (this research wrote only this file; the prototype lived in a throwaway copy); the rules engine stays decoupled from UI and serializable (no new serialized field here); no monetization or analytics SDK (no packages added); player-facing text stays in the established voice and family-friendly (the new labels are functional and plain, per CONTEXT); fidelity to prototype rules (no rule or number changes: only a derived read and event-identical refusals). The STATE.md engine gate holds: pure/deterministic, no new rng draw, no new serialized field (nothing to carve out of the three `*Comparable()` functions), `test/parity/prototype-master.js.txt` untouched, no new event type (so no `EVENT_NARRATION` entry needed).
