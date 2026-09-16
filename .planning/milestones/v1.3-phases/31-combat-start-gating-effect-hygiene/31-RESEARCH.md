# Phase 31: Combat Start Gating & Effect Hygiene - Research

**Researched:** 2026-09-16
**Domain:** Turn-based combat engine flow (engine/combat.js, engine/items.js, engine/magic.js), refusal-event vocabulary, parity-harness reconciliation
**Confidence:** HIGH (every claim below is a direct code read of this repo this session — no web search, no external libraries; `npm test` re-verified fresh: **1593/1593 passing, 0 failures**)

## Summary

All six CMB requirements trace back to ONE structural fact: today's `startCombat` (`engine/combat.js:153-376`) does everything in a single synchronous call — foe roster, initiative, phobia freeze, and (if the foes win initiative) a full pre-emptive `foeTurn` — and the shell's DR17 "Fight!" gate (`mazeworld.html` `awaitingFight`) is **presentation-only**: it hides the DOM, but the engine has already rolled and the Oracle log already has the lines (`for (const line of html) window.logLine(line)` runs before the gate is even consulted). CMB-01 fixes this at the root by literally splitting `startCombat` into an ENCOUNTER phase (foes + roster, unchanged) and a new `fight` action (initiative onward), so nothing is drawn or narrated until the player presses Fight!.

CMB-02's "always not ready" complaint has **two independent, confirmed, reproducible root causes**, both presentation-layer bugs sitting on top of an already-correct engine: (1) `grimoireViewModel` (`src/browser/viewModels.js:301-343`) collapses every `!canCast` failure into the single string `"Not ready yet"`, even though the engine's own `castSpell` already computes THREE distinct, self-explaining reasons (`spellNotKnown`/`spellAboveLevel`/`spellSchoolLocked`); and (2) the in-combat SPELLS menu filter is a **stale classic-script copy** of `canCast` (`mazeworld.html:2046-2050`) that checks `sp.lvl > S.c.level` directly instead of the level-override-aware `spellLevelFor` the engine uses — this makes a level-1 Summoner's Summon and a level-1 Illusionist's Phantom Host **literally absent** from the in-combat spell list (not just disabled), exactly reproducing the "cannot act" bug Phase 23 (IDENT-03/04) believed it had fixed at the engine layer.

CMB-03's targeted-item gap and CMB-06's stranded-combat bug share one root cause: `useItem` (`engine/items.js:797-939`) has **no combat-only gate and never calls `afterPlayerAction`**. A staff of Freeze/Stone/Gas used outside combat silently fizzles (foes = [], forEach no-ops) while still burning its cooldown; a Stone/Fire kill that clears the last foe leaves `state.combat` non-null forever (no `liveFoes` check after the kill). CMB-05's headline bug is that `c.acute` is set (`items.js:855`) and read (`derived.js:186,285`) but **never decremented or cleared anywhere in the codebase** — Acuteness is permanent once drunk. CMB-04 needs one new `conditionsOf` entry (`derived.js:179-238` has no `ward` case at all) plus a bespoke two-number chip branch in `paintConditions` (`mazeworld.html:2837-2868`), mirroring the existing `flight` special case.

**Primary recommendation:** land this as five ordered waves — (1) `fight` action + parity-harness auto-apply, (2) refusal vocabulary + the two "not ready" fixes, (3) `useItem` combat gate + stranded-combat fix (reused by CMB-06), (4) effect expiry (Acuteness tick + endCombat clear) + Shield chip, (5) shell wiring + `docs/USABLE-FEATURES-AUDIT.md` + full-suite gate — because waves 3-4 both touch `useItem`'s tail and should land together, and wave 1 is a prerequisite for nothing else but must be proven parity-safe first since it is the highest-risk change.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fight! gating (CMB-01)**
- Split `engine/combat.js#startCombat`: the ENCOUNTER step (triggered by the move/encounter roll) rolls the foes, builds `state.combat = {foes, type, round: 1, …, pending: true}` and emits `encounterStarted`; a NEW engine action `fight` (validated in `engine/actions.js`, dispatched in `engine/engine.js`) performs everything from `rollInitiative` onward IN TODAY'S EXACT DRAW ORDER — initiative d20s, the phobia-freeze Hardiness `rng.d(2)`, `combatInDark`, then the pre-emptive `foeTurn` if foes won — and clears `pending`. Nothing rolls or strikes before `fight`.
- The shell's existing DR17 Fight! gate (`mzFight`) dispatches `fight` instead of flipping a display flag; the pre-death/AMBUSH Fight! special-case (mazeworld.html ~L4894) is re-based on the new model (a pre-emptive kill now happens AFTER Fight!, so that special case should collapse).
- Parity: because the moved draws keep their order, add `reconcilePendingFight` to `test/parity/harness/comparables.js` (the `reconcilePendingFind`/`reconcilePendingLoot` pattern: when a compared state has `combat.pending`, apply `fight` on a clone with the same rng cursor before comparing, so both the post-move state AND the rng cursor match the prototype). No fixture JSON edited; `prototype-master.js.txt` never edited. Apply the same reconcile in the three parity tests that keep a local `comparable()` (combat/magic/movement — see 29-02-SUMMARY).
- The preview offers the foe roster + Fight! only; Flee/Parley/Sing/spells/items remain combat actions after Fight! (rulebook: initiative decides first strike; no pre-combat escape). While `combat.pending`, every combat action other than `fight` is refused with reason `notFought` (explains itself).
- Combat stays transient in saves (rehydrate nulls `combat` as today): a pending encounter is not serialized.

**The "not ready yet" audit (CMB-02)**
- Deliverable: `docs/USABLE-FEATURES-AUDIT.md` — a ledger of EVERY usable spell (by class/level), item (potions, staves, cloaks, jewelry, picks), gear piece and class/race/sub-class active feature × circumstance (explore / combat / class or race gate / cooldown / charges / Fight!-pending), with the engine's refusal reason for each blocked circumstance and an "expiry" column for every timed effect (see CMB-05). A TEST walks the same table (data-driven from a JS mirror of the ledger or from the content tables) and asserts each refusal path emits an explaining event and each allowed circumstance succeeds.
- One refusal vocabulary: `useRefused {item, reason}` (exists today for `pilfer`) and `castRefused {spell, reason}` (new type) with fixed reasons — `cooldown {left}`, `wrongClass`, `exploreOnly`, `combatOnly`, `noTarget`, `noCharges`, `frozen`, `notFought`, `pilfer` — each reason with its own toast + Oracle line naming the why (family-friendly sarcastic). New event TYPES get EVENT_NARRATION + toast-table entries.
- Shell: blocked buttons stay visible; tapping one dispatches and the refusal toast explains (Phase 25.1 DFB-06 precedent — never disable silently); cooldown rows keep showing the countdown.
- USER CLARIFICATION (2026-09-16): refusals are TOASTS — and stay toasts even after Phase 32's Round Card ships (the design doc §4.2 already routes `PRIORITY.block` refusals to toasts as direct replies to a tap; out-of-combat refusals on the Gear tab/store are toasts regardless). Phase 32 must not fold refusals into the Round Card.
- The reported "always not ready yet" spells are real bugs to root-cause: research reproduces which spells/items report not-ready when they should be usable (candidates: `itemReady` cooldowns keyed on `state.steps`, which never advances during combat; charge counters; a generic not-ready string) and each is fixed; any fix that changes fixture behaviour is a declared, documented divergence.

**Potions from Gear, Shield chip, effect expiry (CMB-03, CMB-04, CMB-05)**
- Buff potions/items (Acuteness, Strength/might, haste, ward-type, healing) are usable from the Gear page outside combat and start their timers immediately; targeted attack items (Amulet of Stone, fire, gas, freeze/Birch-style) are refused outside combat with `combatOnly`. The Gear tab's Use button therefore works for buffs anywhere.
- Shield chip: add `ward` to `engine/derived.js#conditionsOf` with `{pool, rounds}` (reads the same `c.ward` the engine's absorb/reflect/shatter code uses) → shell chip "Shield · 34 hp · 3 rds"; ward-fade/shatter already narrate.
- Expiry model — every timed effect gets an explicit counter AND a unit, recorded in the audit ledger: ROUND-based effects (Acuteness `c.acute` — currently set to `rng.d(8)` and NEVER decremented — plus ward, mirror, senses, regen) tick once per combat round and clear at `endCombat`; STEP-based effects (haste from the Cloak of Speed, 50 squares; invis/ether) tick on exploration steps as today; might stays "until the next day" as today. The Acuteness fix is the headline: it finally counts down and clears when combat ends.
- Parity: new decrements/clears fire only for characters who have the effect (no new rng draws); research enumerates any fixture that drinks/casts such an effect and the planner carves out precisely (comparables) if needed — fixtures never edited.

**Amulet of Stone (CMB-06)**
- When an ITEM kill (stone, fire, gas, freeze…) removes the last live foe, the encounter clears through the same path as any other kill (`encounterCleared` → `endCombat` → Phase 29's loot card). Research pins down exactly where today's stranded state comes from (likely the `useItem` action path not running `afterPlayerAction`'s cleared check) and fixes that path for every item kill, not just the Amulet.
- Stoned foes count as slain: they already route through `killFoe` (XP, coin, treasure drop into the pile, kill count); pin with a test; fix any bypass.
- New `foeStoned {names}` event (EVENT_NARRATION + toast entry, e.g. "N turn to stone. Statues don't hit back.") in addition to the per-foe `foeKilled` lines.
- `aoe: 4` stays; the "squares of opponents" group model remains deferred.

### Claude's Discretion
- Exact reason strings and toast/Oracle wording (voice-safe); the audit ledger's column layout; whether the table-driven test reads a JS mirror or derives rows from `content/*` tables.
- Whether `fight` also owns the `tracked` (Tracking skill) roll — NO: it precedes the foes' roll today and stays at the encounter step; only draws from `rollInitiative` onward move.

### Deferred Ideas (OUT OF SCOPE)
- Flee/Parley from the preview before Fight! — not requested; would be a rules divergence.
- Squares-of-opponents group model (Amulet aoe geometry) — deferred milestone-wide.
- Round Card rendering of anything — Phase 32.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMB-01 | No initiative roll or enemy strike happens before Fight! is pressed; the encounter screen is a preview / decision point only | §1 Fight! split — exact cut line, event-shape consequences, every `startCombat` caller enumerated, shell gate mechanism traced |
| CMB-02 | "Not ready yet" audit — every usable spell/item/gear piece is provably usable in its proper circumstances, and each refusal says why | §2 Two confirmed root causes (grimoireViewModel's collapsed string; the stale classic in-combat `canCast` filter); §5 refusal vocabulary recommendation; §3 usable-features inventory seed |
| CMB-03 | Combat potions are drinkable from the Gear page outside combat | §4 — buff potions (content/potions.js) are ALREADY dispatchable from Gear outside combat (no engine gate blocks them); the real gap is that targeted items (staves/amulets) have NO `combatOnly` refusal and silently fizzle/burn cooldown instead |
| CMB-04 | Shield shows a condition chip with remaining pool and rounds | §7 — `conditionsOf`/`paintConditions` exact insertion points, `c.ward` shape, existing `flight` special-case precedent |
| CMB-05 | Every round-based effect expires outside combat — the audit covers all of them | §6 — full effect table (set-where / unit / ticked-where / cleared-where) for every timed field; Acuteness is the confirmed gap |
| CMB-06 | Amulet of Stone ends combat and pays out like a kill | §4/§8 — confirmed root cause (`useItem` never calls `afterPlayerAction`/checks `liveFoes`); payout already correct (routes through `killFoe`); fix is narrow and fixture-free |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Encounter roll (foes/roster/type) | Engine (rules) | — | Pure deterministic rng-consuming logic; already isolated in `engine/combat.js` |
| Fight! gate / initiative / pre-emptive strike | Engine (rules) | Presentation (shell button wiring only) | CMB-01 moves the GATE from presentation-only (`awaitingFight` flag) into the engine itself (`combat.pending` + a real `fight` action) — the shell becomes a thin dispatcher, not the source of truth |
| Refusal reasons (spell/item/gear) | Engine (rules) | Presentation (toast/Oracle copy) | Engine emits `{type, reason}` events; `src/browser/toasts.js`/`eventNarration.js` own the copy — never the other way around |
| Condition chip enumeration | Engine (`conditionsOf`) | Presentation (`paintConditions`) | Engine owns WHICH conditions are active and their raw data; shell owns copy/label/unit formatting only (existing pattern, e.g. `flight`) |
| Effect expiry (tick/clear) | Engine (rules) | — | All ticking (per-round in `foeTurn`, per-step in `movement.js`, per-day in `newDay`) already lives in engine; no presentation involvement |
| Item-kill combat resolution | Engine (`combat.js`/`items.js`) | — | `killFoe`/`endCombat`/`afterPlayerAction` are the existing engine seam; `useItem` must route through the same seam, not a new one |

## Standard Stack

No new libraries. This phase is pure engine/content/shell work inside the existing codebase (vanilla JS, no framework, no build step). No `npm install` needed.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages — it is entirely internal engine/shell/content changes. No `npm view`/registry check needed.

## 1. Fight! split (CMB-01) — the exact cut line

### 1.1 What `startCombat` does today, in draw order

`engine/combat.js:153-376`, `state.combat = {...}` is assigned at **line 218**. Everything before that line is the roster build (unaffected by this phase); everything from **line 219 (`const first = rollInitiative(state, rng);`) through line 375 (end of function)** is what CMB-01 moves into the new `fight` action.

**ENCOUNTER step (stays in `startCombat`, unchanged):**
1. `type = forced || rng.pick(ENC_TYPES)` — skipped when `forced` is supplied (every caller except the wandering-monster/encounter-dot path passes `forced` explicitly or `undefined`; `wandering` calls pass `null`/no override so this draws).
2. Tracking skill (conditional on `skill(c,"Tracking")`): `rng.d(20)` → `tracked` bool, pushes `trackingRolled`.
3. Foe count (skipped when `wandering`): `rng.d(4)`, and a SECOND `rng.d(4)` only if the first roll was `> 2` (the prototype's exact short-circuit ternary — do not hoist to one draw).
4. Per foe (`i = 0..n-1`): `rng.d(4)` (level roll, `lvl`) then `rng.pick(roster)` (creature pick).
5. Warlock walking-dead boost: 0 draws (flat addition).
6. Knight/Con Artist/Court Mage removal loop (`combat.js:292-309`): Con Artist conditional `rng.d(6)`; Court Mage conditional `rng.d(12)`, and if it fires, a full `killFoe(...)` call (its own `rng.d(6)` sp-roll, `rng.d(10)` coin roll, conditional `rng.d(20)` loot gate + treasure/bag-swap rolls, conditional Beasts/Lair-Beasts cooking `rng.d(6)`, `checkLevel`'s own draws) — **all of this is pre-existing and already unaffected by this phase**, but it means `killFoe` can already fire from inside the ENCOUNTER step (before Fight! exists as a concept) — this is fine; a foe bored to death before you ever see the roster is correct per the existing rules comment ("beneath the notice of small things").
7. `state.combat = {foes, type, round: 1, target: 0, spellOpen: false, tracked}` — **ADD `pending: true` here.**
8. `encounterStarted` event (`combat.js:221-246`) — **MUST be split.** Today this event is pushed AFTER `rollInitiative` and carries `first` plus five flags computed from data available at ENCOUNTER time (`samuraiNeverFirst: c.sub==="Samurai"`, `fridgianSlow: !!R.slow`, `acuteHearing: skill(c,"Acute Hearing")`, `knightBigFoe: knightFacesBigFoe(state)`, `courtMageTalksFirst: c.sub==="Court Mage"` — **none of these five require a draw**, they can move to the ENCOUNTER step's `encounterStarted` unchanged). Only `first` itself requires `rollInitiative`'s two d20s. **Recommendation:** keep `encounterStarted` in the ENCOUNTER step with everything EXCEPT `first`; have `fight` push a second, new event (e.g. `combatJoined {first}`) carrying just the initiative outcome. This is a genuine event-SHAPE change from today (see §1.4 pitfall on toast folding) — flag as a deliberate, documented divergence, not silently absorbed.
9. `tracked`/`allyJoined`/`warlockBoost`/`foeFled`/`foeBored` events — unchanged, stay in the ENCOUNTER step.
10. Early return if `!liveFoes(state).length` (every foe removed by Knight/Con Artist/Court Mage before you'd ever see a roster): push `encounterCleared`, `state.combat = null`, return. **This stays in the ENCOUNTER step** — there is nothing to press Fight! for if the fight is already over.

**FIGHT step (moves into the new `fight` action, in this exact order):**
1. `rollInitiative(state, rng)` (`combat.js:113-135`) — **unconditional** `rng.d(20)` (`mine`), `rng.d(20)` (`theirs`); consumes `c.foresight` (sets it `false` — this happens on FIGHT now, not encounter start; a foreseen character's foresight is "spent" the moment Fight! resolves, not the moment the encounter is glimpsed — flag this timing shift explicitly to the planner as a rules-adjacent side effect, even though it is zero-draw and structurally invisible to any fixture that doesn't inspect `c.foresight` mid-encounter).
2. Sets `C.first` via the samurai/slow/knightBig/courtMage/foreseen/AcuteHearing ladder (0 draws — pure logic on already-known data).
3. Emit the initiative outcome (new event or extended `encounterStarted` — planner's call, see §1.4).
4. Phobia freeze (`combat.js:349-356`): `nearDeathPanic` computed (0 draws); `if ((c.phobiaType===type || Darkness-in-dark || nearDeathPanic) && !(skill(c,"Hardiness") && rng.d(2)===1))` → **conditional** `rng.d(2)`, drawn ONLY when a phobia condition is true AND the character has Hardiness. Sets `state.combat.frozen = true`, pushes `phobiaFrozen`.
5. `combatInDark` check (`combat.js:357`): 0 draws, pure read.
6. `if (first === "foe") { foeTurn(state, rng, events); if (state.combat && !liveFoes(state).length) { push encounterCleared; endCombat(...); } }` — `foeTurn`'s OWN internal draws (many; per-foe, ability-gated, unchanged internally — only its POSITION moves).
7. **Clear `state.combat.pending`** (delete the flag or set `false`) at the very end, ONLY if `state.combat` is still non-null (a pre-emptive kill may have already nulled it via the branch above).
8. Return events.

### 1.2 Every caller of `startCombat` today

| Caller | File:line | What happens after the call today |
|---|---|---|
| `encounterDot` (dungeon dot tile → monster result) | `engine/encounters.js:186` | `return events;` immediately — nothing else runs in that dispatch |
| `newDay`'s wandering-monster check (camp / 100-step tick) | `engine/movement.js:537` | `return events;` immediately after (end of `newDay`) |
| `move()`'s dot-tile branch | `engine/movement.js:349` (via `encounterDot`) | `move()` itself returns right after (`return events;` at line 370) — no post-combat-start logic reads `state.combat` in the same dispatch |
| `teleport()`'s dot-tile branch | `engine/movement.js:630` (via `encounterDot`) | A same-cell `if (cell.feat === "trap")` check follows, but `cell.feat` was already nulled at line 629 before `encounterDot` ran, so this is dead/unreachable for a dot cell — confirmed safe |
| Parity harness `applyStartCombat` | `test/parity/harness/comparables.js:332-339` | Used by the FIXTURE REPLAY loop, not real gameplay — see §2 below for the required harness change |
| `combat-parity.test.js`'s own local `applyStartCombat` | `test/parity/combat-parity.test.js:142-149` | Same as above — a scenario-scoped duplicate |
| `magic-parity.test.js` | `test/parity/magic-parity.test.js:101` (+ local wiring ~L127) | Same pattern |
| `full-suite.test.js` (×2 sites) | `test/parity/full-suite.test.js:159,195` | Same pattern |
| `test/roundtrip/serialize-rehydrate.test.js` | `:82` | Save/load round-trip fixture setup |
| `test/determinism/foe-abilities.test.js` | `:116` | Determinism harness |
| `test/unit/combat.test.js`, `test/unit/combat-scaling.test.js` | many call sites | Unit tests calling `startCombat` directly and asserting on the FULL (today's) resolved state — **every one of these will need updating to also apply `fight`** if the assertion depends on `state.combat.first`/foe hp after a pre-emptive strike/frozen state. Grep count: `combat.test.js` has ~15 direct calls, `combat-scaling.test.js` has ~9. |

**No `state.combat.first`/`.round`/`.frozen` reader exists anywhere in `engine/` or `src/browser/` or `mazeworld.html` OUTSIDE of `combat.js` itself** (`rollInitiative` sets `.first`; `afterPlayerAction` reads `.first` at line 1058 for the round-2+ reroll; nothing else touches it) — confirmed by grep. This means no OTHER engine/shell code needs to change to tolerate a `pending` combat; the shell's `awaitingFight`/`C.awaitingFight` gate already fully hides the action bar and "Last exchange" block while pending is conceptually true (see §1.3).

### 1.3 Today's shell Fight! gate is presentation-only — this is the actual bug

`mazeworld.html` sets `after.combat.awaitingFight = true` in `noteCombat()` (~L5989) the moment a fresh `state.combat` appears from ANY dispatch — but the dispatch has ALREADY run the full (today's) `startCombat`, including the pre-emptive `foeTurn` and its narration. `renderEncounter()`'s `C.awaitingFight` branch (~L5169-5176) and the AMBUSH-death special case (~L4900-4910, gated by `state.beats.awaitingFight`, set at ~L6107) both STOP RENDERING before showing the outcome, but `window.logLine(line)` for every event (including the pre-emptive strike's narration) already ran inside `engineCombatAction`/`window.move` BEFORE `renderEncounter()` is even called (`mazeworld.html:6571-6573`). **This is exactly the user-reported bug: "the enemy attacks (and shows in the Oracle) before Fight! is pressed."** `window.mzFight` (~L6582-6590) is purely `awaitingFight = false` + re-render — no dispatch, no rng, no engine call ("the engine already resolved everything inside startCombat; this only reveals it" — the code's own comment). CMB-01 replaces this with a REAL dispatch: `window.mzFight = () => engineCombatAction("fight")` (mirroring `mzAttack`), so nothing is drawn/narrated until the tap.

The AMBUSH pre-death special case (`~L4894-4910`, `b.awaitingFight`/`state.beats.awaitingFight`) exists because a pre-emptive foe turn can kill the player on the SAME dispatch that started combat, before the player ever saw Fight!. Once `fight` is its own action, `die()` from a pre-emptive strike happens INSIDE the `fight` dispatch (after the player has already pressed Fight!), so this special case's premise ("you die before you could press Fight!") no longer exists — CONTEXT's own note says this special case "should collapse." Confirm by tracing: the death card (`S.dead`) branch (~L4870) already takes priority over the AMBUSH-preview branch in `renderEncounter`'s early-return order (`S.dead → S.won → S.beats → ...`), so once `fight` handles the death internally, the normal `S.dead` death-card path fires directly — no `awaitingFight` bridging needed.

### 1.4 Parity harness — the critical distinction between the two failure modes

**The `reconcilePendingLoot`/`reconcilePendingFind` pattern is COMPARE-ONLY** — it clones `c`, applies the legacy auto-take, and compares that clone; the REAL replay state keeps `pendingLoot`/`pendingFind` untouched because no fixture ever exercises `takeLoot`/`takeFind` as a scripted action (every fixture's pending pile is simply left unresolved for the rest of the scenario).

**`fight` is different and needs BOTH a compare-only reconcile AND a real state advance, depending on the caller:**

1. **`combat-parity.test.js`/`magic-parity.test.js`'s scripted `"startCombat"` fixture action** is immediately followed by scripted `attack`/`flee`/`parley` actions that assume combat is ALREADY past initiative (this is what today's single-call `startCombat` produces). If the harness's `"startCombat"` case handler only calls the new ENCOUNTER-only `startCombat`, `engineState.combat.pending` stays `true`, and the very next scripted `attack` would hit the new `notFought` refusal on the engine side while the prototype's `ctx.playerStrike()` proceeds normally — an immediate, hard divergence. **Fix:** the harness's `"startCombat"` case must, after `applyStartCombat`, ALSO real-dispatch `fight` on `engineState` (`applyAction(engineState, {type:"fight"})`, chained, before returning) so the REAL replay state advances exactly as far as the prototype did. This is a **test-loop code change in each of the four call sites in §1.2's harness table**, not a `comparables.js` helper — no fixture JSON is touched.
2. **Real gameplay via `move()`/`newDay()`** (and `movementComparable`/`combatComparable`/`economyComparable`'s general-purpose diffing) legitimately WANTS `combat.pending: true` to survive the dispatch — that is the whole point of CMB-01. For these comparables, a genuine **compare-only** `reconcilePendingFight(rest, combat)` (mirroring `reconcilePendingLoot`'s signature shape) is correct: when `rest.combat?.pending`, clone, apply `fight` with the SAME `rngState` cursor, and compare THAT clone (with its advanced `rngState`) against the prototype — proving the state WOULD match once Fight! is pressed, without mutating what a subsequent scripted action in the SAME fixture actually operates on.

**Action required per RESEARCH ask #2 ("flag any fixture where a non-fight action follows the move while combat is pending"):** grep every fixture's action script for a `move`/`camp` action that triggers `startCombat` (via `encounterDot`/wandering) followed by anything OTHER than the end of that scenario. `test/parity/fixtures/action-script.movement.json` and `action-script.economy.json`/`encounters.json` need this check explicitly — if any movement/economy fixture's script continues with unrelated non-combat actions (e.g., another `move`) WHILE `combat.pending` is true, the compare-only reconcile in `movementComparable`/`economyComparable` is sufficient (each per-action diff after the move-that-triggered-combat re-derives the reconciled clone fresh); no auto-apply is needed there because those fixtures never script a combat action against a pending fight. This must be verified fixture-by-fixture at plan time by actually running the harness with logging — this research did not enumerate every fixture script line-by-line (30+ fixture files); flag as a **Wave 1 verification task**, not a closed finding.

### 1.5 `engine/actions.js`/`engine/engine.js` wiring

Add `"fight"` to `ACTION_TYPES` (`engine/actions.js:10-53`) with no payload validation needed (mirrors `takeAllLoot`/`camp` — no fields). Add a `case "fight":` to `applyAction`'s switch (`engine/engine.js:52-150`) calling a new `engine/combat.js` export (e.g. `resolveFight(state, rng, events)`) containing exactly the FIGHT-step body from §1.1. The `notFought` refusal (CMB-01's "every combat action other than fight is refused while pending") belongs in `engine/actions.js` or as a shared guard at the TOP of `playerStrike`/`flee`/`parley`/`sing`/`castSpell`/`drinkPotion`/`readScroll`/`useItem` — **recommend a single shared helper** (e.g. `notFoughtGuard(state, events)` returning `true` if it pushed a refusal) called first in each of those seven functions, so the check lives in ONE place per CONTEXT's explicit ask ("so a `notFought` refusal can be added in ONE place").

## 2. Refusal vocabulary today (CMB-02 groundwork)

Every existing `*Refused`/`*Rejected` event and reason, by file:line:

| Event type | File | Reasons today |
|---|---|---|
| `strikeRefused` | `combat.js:406` | `wizard` (attack spell castable, must cast instead) |
| `fleeRefused` | `combat.js:710` | `samurai` |
| `parleyRefused` | `combat.js:860,864,881` | `ninja`, `masterOfArms`, `wilmsryVsMagical` |
| `joinerRefused` | `encounters.js:476` | class/race-specific |
| `itemRejected` | `items.js:287,292,305,309,323,388` | `weaponReason`/`armorReason` (computed), `notBetter`, `wrongClass` — **this is the auto-equip/auto-take rejection path (drops), NOT the use-gate** |
| `equipRejected` | `items.js:545,561,578,684,691,707` | `weaponReason`/`armorReason`, `notEquippable` |
| `useRefused` | `items.js:813` | **ONLY `pilfer` exists today** — this is the ONE reason CMB-02 must extend |
| `noChargesLeft` | `magic.js:55` | (no `reason` field — event type itself is the reason) |
| `spellNotKnown` | `magic.js:60` | (spell not in grimoire — should be unreachable from `grimoireViewModel`'s own list, but IS reachable if `castSpell` is dispatched with an arbitrary `idx`) |
| `spellAboveLevel` | `magic.js:67` | carries `need`/`have` |
| `spellSchoolLocked` | `magic.js:69` | carries `school`/`need`/`have` |
| `gateRefused` | `magic.js:259` | Plane Gate cast with no Walking Dead/Demons foe type |
| `scrollRefused` | `magic.js:448,452` | `noScrolls`, `pilfer`, `noRunes` |

**Recommendation (discretionary per CONTEXT, but grounded in the above):** `noChargesLeft`/`spellNotKnown`/`spellAboveLevel`/`spellSchoolLocked` already self-explain via their OWN event type + dedicated `EVENT_NARRATION`/`TOAST_FOR` copy — **do not fold these into a new generic `castRefused` type**; that would be a disruptive rename touching four already-tested, already-narrated event shapes for zero clarity gain. Instead, add `castRefused {spell, reason}` ONLY for the genuinely NEW gating circumstances this phase introduces that have no existing event: `notFought` (Fight!-pending), `frozen` (phobia-frozen, currently `strikeRefused`-adjacent has no spell equivalent — verify whether a frozen caster can currently attempt to cast at all; `castSpell` has no frozen check today, meaning a frozen character CAN currently cast spells while frozen — likely a real, separate small bug worth a one-line fix: cast should be refused with `frozen` exactly like `playerStrike` handles it at `combat.js:410-415`), `combatOnly` (a `sp.combatOnly` spell cast with `!state.combat` — confirmed silently broken today, see §4.1), and `noTarget` (a targeted spell/item cast with no live foe, e.g. `insaneNoTarget`/`nothingToThrowAt` ALREADY exist as their own named events for two kinds — extend the pattern for `acid`/`blind`/`petrify`/`stupid`/`status`, which today silently no-op with zero event at all, see §4.1). Mirror the same "extend, don't replace" approach for `useRefused`: keep `pilfer`, add `cooldown {left}`, `combatOnly`, `notFought` as new reasons on the SAME event type (items.js already has exactly one `useRefused` push site to extend).

## 3. The "not ready yet" root cause — two confirmed bugs

### 3.1 Bug A — `grimoireViewModel` collapses three distinct engine reasons into one string

`src/browser/viewModels.js:301-343`. The Hero tab's Grimoire computes `disabledReason` via:
```js
if (inCombat) disabledReason = "On the combat screen";
else if (sp.combatOnly) disabledReason = "Combat only";
else if (!canCast(state, sp)) disabledReason = "Not ready yet";   // <-- collapses 2 distinct real reasons
else if (charges <= 0) disabledReason = "No charges left";
else castable = true;
```
`canCast(state, sp)` (`engine/derived.js:690-699`) fails for exactly two distinct reasons (grimoire membership is already guaranteed true since `sp` was looked up FROM `c.grimoire` — see the loop at `viewModels.js:307-309`): `spellLevelFor(c.sub, sp) > c.level` (spell level too high) OR `c.level < schoolGate(c.sub, sp.s)` (school gate too high). **Both collapse to the same opaque "Not ready yet" string**, which never changes as long as the character's level/school gate is unmet — for a character who plateaus at a level that never satisfies the gate this run, the message is permanent, matching the "ALWAYS not ready" complaint precisely.

**Fix:** replace the single `!canCast` branch with the same two-way split `castSpell` itself already performs (`magic.js:61-69`): check `spellLevelFor(c.sub, sp) > c.level` first (→ e.g. `` `Needs level ${need}` ``) then the school gate (→ e.g. `` `Needs level ${schoolGate(...)} in ${sp.s}` ``). This is a presentation-only change (no engine event shape change, no parity risk) — `grimoireViewModel` already reads engine helpers directly.

### 3.2 Bug B — the in-combat SPELLS menu filters on a STALE, un-overridden `canCast`

`mazeworld.html:2046-2050` (classic script, explicitly documented as "NOT dead" at `mazeworld.html:3853` — it "still gate[s] which action buttons renderEncounter() shows"):
```js
function canCast(sp) {
  if (!S.c.grimoire || !S.c.grimoire.includes(sp.n)) return false;
  if (sp.lvl > S.c.level) return false;                         // <-- STALE: ignores spellLevelFor's override table
  return S.c.level >= schoolGate(S.c.sub, sp.s);
}
```
This is called at `mazeworld.html:5210` (`if (!canCast(sp)) return;` inside the in-combat `SPELLS.forEach` menu build) to decide which spells even APPEAR in the combat spell menu. It checks `sp.lvl` directly, never `spellLevelFor(c.sub, sp)` (`engine/derived.js:648-651`), which consults `content/spell-level-overrides.js`:
```js
export const SPELL_LEVEL_OVERRIDES = {
  Summoner: { Summon: 1 },          // printed level 2, overridden to 1
  Illusionist: { "Phantom Host": 1 }, // printed level 3, overridden to 1
};
```
This table exists SPECIFICALLY because Phase 23 (IDENT-03/IDENT-04) found "a level-1 Summoner could not summon at all and a level-1 Illusionist could only stall... with no damage source of its own" — and fixed it in `engine/derived.js#canCast`/`engine/magic.js#castSpell` (both correctly use `spellLevelFor`). **But the classic shell filter at line 2046 was never updated** — so a level-1 Summoner's Summon and a level-1 Illusionist's Phantom Host are `sp.lvl=2 > c.level=1` / `sp.lvl=3 > c.level=1` under the stale check → **the spell button never renders in combat at all** (falls through to `mazeworld.html:5220-5224`'s "Nothing in the grimoire you can work at this level" empty-state message), even though `engine/magic.js#castSpell` would happily accept `SPELLS.indexOf(sp)` if it COULD be clicked. This is the exact scenario Phase 23 believed it had fixed — reproduced live by this stale duplicate. **This is very likely THE bug behind the user's report** ("some spells ALWAYS say not ready yet") since it affects precisely the two sub-classes Phase 23's own grounding singled out as previously "cannot act."

**Fix:** change `mazeworld.html:2048` from `if (sp.lvl > S.c.level) return false;` to `if (spellLevelFor(S.c.sub, sp) > S.c.level) return false;` (import or classic-mirror `spellLevelFor` the same way `schoolGate`/`schoolBonus`/`canLearn` are already mirrored at lines 2043-2045). Cross-check with `test/unit/spell-level-overrides.test.js` (already exists) and Phase 20's `parley-button-mirror.test.js` precedent — a live-DOM-extraction test that replays the classic filter against the engine's own gate is the established pattern for catching exactly this class of drift; recommend a NEW test in the same style pinning that the classic `canCast(sp)` filter and the engine's `canCast(state, sp)` never disagree for any (sub, spell) pair, so a FUTURE override-table addition can't silently reintroduce this bug.

### 3.3 Ruled OUT: `itemReady`'s `state.steps` cooldown gate is NOT a bug

CONTEXT flagged `itemReady` (`engine/items.js:783-787`, mirrored classic at `mazeworld.html:3445-3449`) — `state.steps - (it.usedAt ?? -99999) >= it.every` — as a candidate, reasoning that `state.steps` never advances during combat. Verified: this is **working as designed**, not a bug. A first use (`usedAt` undefined → `-99999`) is always ready (`steps - (-99999)` is always `>= it.every`). A SECOND use of an `every`-gated item (a staff/cloak, e.g. "one use every 250 squares") within the SAME combat is correctly refused — the cooldown is genuinely measured in squares walked, not combat rounds, matching every item's own flavor text ("once every 200 squares", "fifty squares"). This candidate is closed with no fix needed; document it in `docs/USABLE-FEATURES-AUDIT.md` as "verified correct, not a bug" so it isn't re-investigated later.

### 3.4 `itemReady`'s silent omission (distinct from the two bugs above, still real)

`renderCarriedList`'s `"use"` action (`mazeworld.html:3532-3534`) only appends a "Use" button when `itemReady(it)` is true — an item on cooldown is **not shown as disabled, it is not shown at all**, and the combat use-list (`mazeworld.html:5195,5202`) applies the SAME `itemReady` filter to decide which items even appear in the list. This violates the Phase 25.1 DFB-06 "never disable silently" precedent CONTEXT explicitly invokes. **Fix (shell-only, presentation):** render every `use`/`potion`-kind item row regardless of `itemReady`, with the button disabled and a cooldown countdown (`cd` — already computed at `mazeworld.html:3510` as `it.every ? Math.max(0, it.every - (S.steps - (it.usedAt ?? -99999))) : 0` and already displayed in the row's subtitle — just needs a disabled Use button added instead of omitted).

## 4. Potions from Gear (CMB-03) — what's actually broken

### 4.1 Buff/heal potions ALREADY work outside combat — confirmed, not a gap

`content/potions.js` (Healing, Cure Poison, Speed, Xtra Healing, Strength, Cure Disease, Enlarge, Acuteness, Death, Invisible) are all `kind:"potion"` bag items with an `eff2` field. `window.mzUseItem` (`mazeworld.html:6523-6527`) ALREADY branches: `if (st && st.combat) engineCombatAction("useItem", {i}); else inventoryAction({type:"useItem", i});` — the Gear tab's Use button (`renderCarriedList` `actions:["use","equip","drop"]` at `mazeworld.html:3059`) dispatches `useItem` regardless of combat state, and `engine/items.js#useItem`'s `switch (kind)` for `heal`/`full`/`poison`/`disease`/`strength`/`enlarge`/`speed`/`haste`/`acute`/`invis`/`ether`/`half`/`dome`/`death` has **no combat check at all** — every one of these already executes identically in or out of combat. **This requirement is already substantially satisfied by existing code**; no engine change is needed for the buff-potion path itself.

### 4.2 The real gap: targeted attack items silently fizzle outside combat AND burn their cooldown

`engine/items.js:820-821`: `const foes = combat && combat.foes ? combat.foes.filter((f) => f.alive) : [];` — when `useItem` runs with `state.combat === null`, `foes = []`. The `freeze`/`stone`/`gas` cases (`.slice(0, it.aoe ?? 2).forEach(...)` / `.forEach(...)`) silently no-op on an empty array — **no event, no refusal, nothing visibly happens** — while `it.usedAt = state.steps` (line 817) and the `itemUsed` narration (line 818) ALREADY fired unconditionally BEFORE the switch, and if `it.uses === 1` or `it.kind === "potion"` the item is even CONSUMED (line 935-938) for zero effect. The `weaken` case correctly no-ops via `if (combat) combat.weakened = true;` (guarded). The `fire` case (`rng.d(6)` draws, `for` loop over `foes`) also silently no-ops the SAME way when `foes.length === 0` — the loop body never executes since `k < n && foes.length` is `n < ... && 0` → false immediately — but STILL rolls `rng.d(6)` for `n` (a wasted, narratively-invisible draw) and pushes `itemBurned {total: 0}` (a real, misleading "it worked" event with zero effect).

**Fix:** add a `combatOnly` gate at the TOP of `useItem`, before `it.usedAt`/`itemUsed` fire, for exactly the targeted kinds (`freeze`, `stone`, `fire`, `gas`, `weaken` — the five kinds that read `foes`/`combat`): `if (!state.combat && TARGETED_KINDS.has(kind)) { events.push({type:"useRefused", item: it, reason:"combatOnly"}); return events; }`. This is a strictly ADDITIVE refusal on a path that previously fizzled — safe for parity since `useItem` is confirmed fixture-free (§ below) and the new branch only fires on a state (`!state.combat`) that today produces zero mechanical effect anyway.

### 4.3 `useItem` is confirmed NOT exercised by any parity fixture

`grep -rln "useItem" test/parity/fixtures/*.json` returns nothing — no fixture JSON scripts a `useItem` action. `engine/items.js`'s own module header independently states the five inventory actions are "pure and fixture-free" (though `useItem` itself is NOT pure — it draws rng for heal/acute/fire — the header's claim applies to `dropItem`/`equipItem`/`unequipSlot`/`takeFind`/`leaveFind`, not `useItem`, but the fixture-grep independently confirms `useItem` specifically has zero fixture coverage either way). **This means both the CMB-03 `combatOnly` gate and the CMB-06 stranded-combat fix (§8) can be implemented in `useItem` with zero parity risk** — no fixture replay will ever reach the new code paths, no `comparables.js` reconcile is needed for this function. Existing coverage lives entirely in `test/unit/items.test.js` (unit tests, not parity fixtures).

### 4.4 Bonus finding — combat-only SPELLS have the identical silent-fizzle bug, worse in one case

`content/spells.js`'s `combatOnly: true` flag is READ ONLY by `grimoireViewModel` (presentation gating, Hero tab) — **`engine/magic.js#castSpell` never checks `sp.combatOnly` at all**. If a combat-only spell were somehow dispatched with `state.combat === null` (the Hero tab's Grimoire button is correctly disabled today, so this is not reachable through the shipped UI, but it IS an engine-layer gap, not just a UI one):
- `stun`/`shrink`/`blind`/`acid`/`stupid`/`status`/`petrify`: read `C && ...` or `C.foes[C.target]` → silently no-op (several — `blind`/`acid`/`petrify`/`status` — push literally NO event at all when the target check fails).
- **`quake` (Earthquake) is the dangerous one:** `liveFoes(state).forEach(...)` no-ops with no foes, but the self-damage branch is UNGUARDED by combat: `if (!c.ward) { const self = Math.ceil(d/2); c.wp -= self; ...; if (c.wp <= 0) { die(state, "quake", ...); return; } }` (`magic.js:191-198`) still runs — **casting Earthquake with `state.combat === null` still damages (and can kill) the caster with zero foes present.** This is out of this phase's stated CMB-02/03 item scope but is the same class of bug CMB-02's audit is meant to catch for spells too; recommend folding a `combatOnly` engine-level guard into `castSpell` (returns `castRefused {spell, reason:"combatOnly"}` before the kind switch when `sp.combatOnly && !state.combat`) as part of this phase's refusal-vocabulary work, since it is a one-line, self-contained, fixture-safe addition (no magic-parity fixture casts a combat-only spell with no active combat — every magic fixture scenario starts inside a forced encounter) and directly serves "every refusal to act... explains itself."

## 5. Usable-features inventory (seed for `docs/USABLE-FEATURES-AUDIT.md`)

Full content-table enumeration (exact counts, for the planner's ledger sizing):
- **Spells:** `content/spells.js` — 32 entries (`SPELLS.length`), each with `combatOnly` already flagged; two have a `spellLevelFor` override (`content/spell-level-overrides.js`).
- **Potions:** `content/potions.js` — 10 entries, all always-usable-anywhere buffs/heals/curses/Death (no `combatOnly` concept for potions; only the STAVES/JEWELRY targeted kinds below are combat-restricted).
- **Targeted attack items:** `content/treasure-tables.js` — `use:"stone"` (Amulet of Stone `aoe:4`, Oak Staff `aoe` default 2), `use:"freeze"` (Birch Staff and others), `use:"fire"`, `use:"gas"`, `use:"weaken"` — grep `content/treasure-tables.js` for the full `use:` field enumeration at plan time (this research confirms the MECHANISM, not an exhaustive line-by-line item list; recommend `grep -n "use: *\"" content/treasure-tables.js` as the planner's first ledger-population step).
- **Class/race/sub-class active features:** gated via `skill(c, "...")`/`eff(c, "...")`/`c.sub === "..."` checks scattered across `combat.js`/`magic.js`/`movement.js`/`derived.js` (Tracking, Acute Hearing, Hardiness, Cooking, Kata, Heft, Silence, Night Vision, Ambidextrous, Runes/Signs, etc. — `content/skills.js` is the canonical name list). These are mostly PASSIVE (always-on modifiers) rather than player-TRIGGERED actions, so most have no "refusal" concept at all — the audit ledger should note this distinction explicitly (passive skill vs. active/dispatchable action) so the table-driven test doesn't attempt to assert a refusal event for something that was never a button.

## 6. Effect expiry (CMB-05) — full table

| Effect (field) | Set where | Unit | Ticked where today | Cleared where today | Gap |
|---|---|---|---|---|---|
| `c.acute` | `items.js:855` (`rng.d(8)`) | rounds (displayed) | **NOWHERE** | **NOWHERE** | **CONFIRMED BUG — headline fix.** Permanent once drunk. |
| `c.ward` (`{pool, rounds, reflect, name}`) | `items.js:876` (dome, `pool:100,rounds:99`), `magic.js:276` (Shield/Bubble, `sp.pool`/`sp.rounds`) | rounds | `combat.js:1784` (`--c.ward.rounds` in `foeTurn`'s tail, once per `foeTurn` call) | `combat.js:1005` (`endCombat`, unconditional `= null`); also self-clears via `wardShattered` when `pool<=0` (`combat.js:1481-1483`) | None — already correct. Add to `conditionsOf` for CMB-04 (no expiry change needed). |
| `c.mirror` | `magic.js:273` (`rng.d(6)`) | rounds | `combat.js:1788` (`--c.mirror` in `foeTurn`'s tail) | `combat.js:1006` (`endCombat`, `= 0`) | None — already correct. |
| `c.foeEffect` (`{kind, rounds}`) | `engine/foeAbilities.js` (foe-inflicted debuff) | rounds | `combat.js:1792` (`foeTurn`'s tail, guarded against double-tick same-turn) | `combat.js:1013` (`endCombat`, conditional) | None — already correct (Phase 19). |
| `c.regen` | `magic.js:287` (boolean, no counter) | until combat ends (no round count) | n/a (boolean flag, read every `foeTurn` at `combat.js:1616`) | `combat.js:1004` (`endCombat`, `= false`) | None — not round-COUNTED, correctly combat-scoped. |
| `c.senses` | `magic.js:262` (boolean, `= 1`) | until combat ends (no round count) | n/a | `combat.js:1007` (`endCombat`, `= 0`) | None — same as regen. |
| `C.weakened` (on `state.combat`, not `c`) | `magic.js:148`, `items.js:890` | until combat ends | n/a | Implicitly: `state.combat = null` at `endCombat` destroys the whole object | None — correctly combat-scoped by construction. |
| `c.haste` | `items.js:851` (`=50`) | steps/squares | `movement.js:293` (`c.haste--` per step) | Reaches 0 naturally; no explicit combat-end clear (by design — a step-based buff, not round-based) | None — CMB-05 explicitly scopes step-based effects as "tick on exploration steps as today," not combat-cleared. |
| `c.invis` | `items.js:859` (`=100`) | steps | `movement.js:294` | Reaches 0 naturally | None |
| `c.ether` | `items.js:863` (`=20`) | steps | `movement.js:295` | Reaches 0 naturally | None |
| `c.might` | `items.js:842,846` (`+8`/`+4`), `magic.js:279` (`rollDice`) | "until tomorrow" | n/a | `movement.js:402` (`newDay`, `c.might = 0`) | None — CONTEXT confirms this stays as-is. |
| `c.halfNext` | `items.js:867` (boolean) | one-shot (consumed on next hit received) | n/a | `combat.js:1453-1455` (consumed on the next `applyFoeDamageToPlayer`) | Not round-based (no counter) — out of CMB-05's stated scope; note in the audit as "one-shot, not round-based" so it isn't mistakenly "fixed." |
| `c.flightLeft`/`c.flightCooldown` | `character.js`/`movement.js` (Cloak of Flying) | steps | `movement.js:328-333` | Reaches 0 naturally | None — already step-ticked, out of scope (not a combat effect at all). |

### 6.1 Open design question — round-based effects drunk OUTSIDE combat (flag for planner)

CMB-03 allows Acuteness (a ROUND-based effect) to be drunk from Gear outside combat, and CONTEXT says buff potions used this way "start their timers immediately." But `c.acute`'s natural tick site (once this phase adds one) is inside `foeTurn`'s per-ROUND tail — there is no "round" outside combat. Three options exist and the planner must pick one and document it as a Key Decision:
1. **Round-based effects don't tick at all until the next combat starts** (the "timer immediately" claim means the counter is SET immediately, but doesn't count DOWN until rounds actually occur) — simplest, but means a solo player who drinks Acuteness in town then walks 500 squares into the next fight gets the full duration fresh, arguably over-generous.
2. **Round-based effects ALSO tick once per exploration step outside combat** (treat "no active round" as "tick per step" as a reasonable analog) — matches "start their timers immediately" literally, but blurs the round/step distinction CMB-05 otherwise keeps clean.
3. **Round-based effects are simply capped/cleared at the NEXT `endCombat`** regardless of how many rounds actually elapsed (already true structurally once Acuteness is added to `endCombat`'s clear list) — the "timer" is really just "lasts until the end of whichever combat you're in when it (or the next one) resolves," and the `rounds` number is closer to flavor than a hard countdown outside combat.

This research recommends **option 3** (add `c.acute = null`/`0` to `endCombat`'s existing clear block alongside `regen`/`ward`/`mirror`/`senses`, PLUS the per-round tick inside `foeTurn`'s tail exactly like `ward`/`mirror`) as the lowest-risk, most consistent-with-existing-code choice — it reuses the EXACT pattern `ward`/`mirror` already use with zero new architectural surface, and "drunk outside combat, doesn't tick until the next fight, then ticks and clears normally" is a defensible, simple rule that needs no new step-tick machinery. Flag this explicitly for `/gsd-discuss-phase` or the planner's own judgment call if a stronger opinion is wanted before locking it.

## 7. Shield chip (CMB-04)

`engine/derived.js#conditionsOf` (`derived.js:179-238`) has no `ward` entry at all — add, following the exact same shape as the `flight` special-case that already exists for a multi-field condition:
```js
if (c.ward && c.ward.pool > 0) {
  out.push({ key: "ward", polarity: "good", pool: c.ward.pool, remaining: c.ward.rounds, name: c.ward.name });
}
```
Place it near the other GOOD conditions (after `might`, before the `flight` block, or after `flight` — order is cosmetic/deterministic-array-order only, no test pins a specific position beyond "GOOD conditions in a fixed order").

`mazeworld.html#paintConditions` (`~L2837-2868`) needs a NEW `CONDITION_COPY.ward` entry (`{label: "Shield", unit: "hp"}` or similar) AND a bespoke rendering branch mirroring the existing `flight` special case (`~L2858-2862`, which is the ONLY current example of a condition needing TWO numbers shown at once) — because the generic `detail` branch (`~L2863+`) only formats ONE number (`cn.remaining` + one `unit`), but the ward chip needs BOTH `pool` (hp) and `rounds` (rds) shown together ("Shield · 34 hp · 3 rds" per CONTEXT's exact example). `test/unit/conditions.test.js` is the existing test file to extend (pure `conditionsOf` unit tests, `cleanChar()` helper already exists — add `ward: null` to its baseline and a new test block mirroring the existing `might`/`flight` tests).

`wardAbsorbed`/`wardReflected`(implicit via the reflect branch at `combat.js:1467-1479`)/`wardShattered`/`wardFaded` already have narration (confirmed by grep — CONTEXT's claim "ward-fade/shatter already narrate" is verified true) — no new narration work needed for the ward LIFECYCLE, only the persistent CHIP display.

## 8. Amulet of Stone / item-kill stranded combat (CMB-06)

### 8.1 Confirmed root cause

`engine/items.js#useItem` (`items.js:797-939`) **never calls `afterPlayerAction` and never checks `liveFoes(state).length`** after any branch. The `stone` case (`items.js:893-909`) and `fire` case (`items.js:911-926`) can both kill every live foe (both correctly route through `killFoe`, which correctly credits XP/coin/`offerLoot`/kill count — **the payout is already correct**, confirmed by reading `killFoe`, `combat.js:560-625`, directly) — but nothing after the `switch` checks whether combat is now over. `state.combat` remains non-null with zero live foes, indefinitely, until SOME other action happens to trigger a clear check (there isn't one reachable from a stranded all-dead-foes state, since every other combat action's own refusal/target-lookup logic would either no-op against an empty foe list or hit the SAME missing-check gap).

### 8.2 The fix must be narrow, not a full `afterPlayerAction` call

`afterPlayerAction` (`combat.js:1025-1075`) does FOUR things: (1) check-cleared, (2) `allyTurn`, (3) `alliesTurn`, (4) if still not cleared, `foeTurn` (the enemy's retaliation) + a fresh initiative reroll. **`useItem` calling the FULL `afterPlayerAction` unconditionally would be a much larger behavioral change** — every non-lethal item use (a heal potion via the Gear-outside-combat path is fine since `state.combat` is null there, but a heal potion or buff used mid-combat via the combat use-list) would newly trigger a foe's retaliation turn, which it never has before (confirmed: `useItem` is the ONLY combat-capable player action in the whole engine that does NOT call `afterPlayerAction` today — `playerStrike`/`flee`/`parley`/`sing`/`castSpell`/`drinkPotion`/`readScroll` all call it). This is a real, pre-existing, SEPARATE latent inconsistency (using an item in combat is currently a "free action" with no foe retaliation) but is **explicitly out of this phase's stated scope** (CONTEXT scopes CMB-06 to "the encounter clears through the same path as any other kill," not "items now cost a turn"). 

**Recommended fix:** add the SAME narrow "cleared check" pattern already used twice elsewhere in `combat.js` (the opening `foeTurn` pre-emptive-kill guard at lines 370-373, and `afterPlayerAction`'s own mid-round guard at lines 1050-1054) directly after `useItem`'s `switch`, before the `it.kind==="potion"` consumption block or right after it:
```js
if (state.combat && !liveFoes(state).length) {
  events.push({ type: "encounterCleared" });
  endCombat(state, events);
}
```
This fixes the stranded-combat bug for `stone`/`fire`/any future item-kill kind WITHOUT introducing foe retaliation for non-lethal item uses — a minimal, targeted, low-risk change matching exactly what CONTEXT asked for ("the encounter clears through the same path as any other kill"). `killFoe`/`endCombat` are already imported into `items.js`'s module scope (confirmed: `killFoe` is called directly at `items.js:907,922`) — `liveFoes`/`endCombat` need adding to the existing `import { ... } from "./combat.js"` at the top of `items.js` (confirm current import list at plan time; `killFoe` is already imported so the module boundary is already crossed).

### 8.3 `foeStoned` event

CONTEXT asks for a new `foeStoned {names}` event alongside the existing per-foe `foeKilled`. Add it in the `stone` case's `.forEach` (`items.js:905-909`), collecting names before/while calling `killFoe`, then pushing ONE `foeStoned {names: [...]}` event after the loop (mirrors the existing pattern of `warlockBoost`/other batch-events elsewhere in `combat.js`). Needs a new `EVENT_NARRATION`/`TOAST_FOR` entry (`src/browser/eventNarration.js`/`toasts.js`) — follow the exact addition pattern already used for Phase 29's `lootDropped`/`lootTaken`/etc. (both tables, `formatEventsCoverage.test.js`/`toastsCoverage.test.js` will fail-fast if either is missed, per the project's own coverage-guard tests).

## Architecture Patterns

### System Architecture Diagram

```
Player taps "Fight!" (shell)
        │
        ▼
window.mzFight() ──dispatch──▶ applyAction({type:"fight"}) ──▶ engine/engine.js switch
        │                                                              │
        │                                                              ▼
        │                                              engine/combat.js#resolveFight
        │                                          (rollInitiative → phobia freeze →
        │                                           combatInDark → pre-emptive foeTurn
        │                                           if foes win → clear .pending)
        │                                                              │
        ▼                                                              ▼
  events[] returned ◀─────────────────────────────────────── state.combat mutated
        │
        ▼
toastsForAction(...) → toasts        window.logLine(...) → Oracle
        │                                     │
        ▼                                     ▼
  renderEncounter() re-paints the NOW-resolved combat panel (action bar, "Last exchange")


Encounter trigger (unchanged shape, narrower body):
move()/newDay() ──▶ encounterDot()/wandering check ──▶ engine/combat.js#startCombat (ENCOUNTER only)
                                                              │
                                                              ▼
                                             state.combat = {foes, type, ..., pending:true}
                                             events: encounterStarted (no `first`)
                                                              │
                                                              ▼
                                         renderEncounter() shows roster + Fight! ONLY
                                             (shell never saw initiative/foeTurn narration)


Item use (any item, any time):
useItem(state, i, rng, events)
        │
        ├─ targeted kind (stone/fire/gas/freeze/weaken) AND !state.combat
        │      └─▶ useRefused {reason:"combatOnly"}  (NEW — CMB-03)
        │
        ├─ stone/fire kills every live foe
        │      └─▶ killFoe (existing, correct payout) × N
        │            └─▶ if (!liveFoes) encounterCleared + endCombat  (NEW — CMB-06)
        │
        └─ buff kind (heal/acute/haste/...) — unchanged, already combat-agnostic
```

### Recommended Project Structure

No new files/folders beyond `docs/USABLE-FEATURES-AUDIT.md` (new doc) and whatever new test files the planner names (recommend `test/unit/fight-gate.test.js` or extending `test/unit/combat.test.js`; extending `test/unit/items.test.js` for CMB-03/06; extending `test/unit/conditions.test.js` for CMB-04; a new or extended effect-expiry test for CMB-05). Existing structure (`engine/`, `content/`, `src/browser/`, `test/unit/`, `test/parity/`) is unchanged.

### Pattern: "narrow cleared-check", not a shared afterPlayerAction call
**What:** `if (state.combat && !liveFoes(state).length) { events.push({type:"encounterCleared"}); endCombat(state, events); }`
**When to use:** Any NEW kill path that doesn't already flow through `afterPlayerAction` (this phase: `useItem`'s stone/fire kills).
**Example (existing precedent, `combat.js:370-373`):**
```js
// Source: engine/combat.js (existing code, this repo)
if (state.combat && !liveFoes(state).length) {
  events.push({ type: "encounterCleared" });
  endCombat(state, events);
}
```

### Anti-Patterns to Avoid
- **Calling the full `afterPlayerAction` from `useItem`:** would silently add foe retaliation to every non-lethal item use — a much larger behavioral change than CMB-06 asks for. Use the narrow cleared-check instead (§8.2).
- **Renaming/consolidating `spellNotKnown`/`spellAboveLevel`/`spellSchoolLocked`/`noChargesLeft` into a new `castRefused` type:** these already self-explain via dedicated events + copy; consolidating them is a disruptive, untested-benefit rewrite. Only ADD `castRefused` for genuinely new reasons this phase introduces (§2).
- **Editing `test/parity/prototype-master.js.txt` or any fixture JSON to "fix" the Fight! split:** never — every reconciliation happens in `comparables.js`/harness code, per the Engine Gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Splitting a multi-draw rng function into two dispatchable phases while keeping fixture parity | A bespoke "replay both halves and diff" harness from scratch | The `reconcilePendingFind`/`reconcilePendingLoot` compare-only-clone pattern already in `test/parity/harness/comparables.js`, PLUS (new, since this case differs) a real chained `applyAction(fight)` call in the four harness call sites that script `"startCombat"` as an explicit fixture action | The codebase already has two working examples of exactly this "engine behavior changed shape, prove the state a fixture-observer needed still matches" problem — reuse the established shape rather than inventing a third |
| Distinguishing "spell too high level" from "spell wrong school" for a disabled button | A new spell-readiness state machine | The existing `spellLevelFor`/`schoolGate` helpers `castSpell` already calls (`magic.js:61-69`) — `grimoireViewModel` just needs to call them too, in the same order | Duplicating gate logic in a third place (view model) risks a third copy drifting out of sync, exactly like the classic-script `canCast` already has |

**Key insight:** every bug this research found (stale classic `canCast`, collapsed `grimoireViewModel` reason, missing `useItem` combat gate, un-decremented `c.acute`, missing `ward` chip) is a case of the engine ALREADY having (or trivially being given) the correct data/logic, with a presentation or wiring layer failing to consume it fully. This phase is almost entirely "wire up what already exists correctly," not new game-rules design — which is exactly the "groundwork ahead of the narrative rebuild" framing in the phase description.

## Common Pitfalls

### Pitfall 1: Splitting `encounterStarted`'s event shape breaks the `encounterStart` toast folder for `phobiaFrozen`/`combatInDark`
**What goes wrong:** `toastsForAction`'s `encounterStart` folder (`src/browser/toasts.js:723-780`) looks for `encounterStarted` in the SAME `events[]` array to fold `phobiaFrozen`/`combatInDark` into one toast. Once those two events fire from the SEPARATE `fight` dispatch, they will never share an array with `encounterStarted` again, so they fall through to step 7 of the toast pipeline (direct `TOAST_FOR` mapping) instead of being folded.
**Why it happens:** The fold logic is scoped per-dispatched-action; splitting the action means splitting which events land in the same array.
**How to avoid:** Both events already have standalone `TOAST_FOR` entries (`toasts.js:927-928`) that produce sensible independent toasts — this is a shape change, not a breakage, but existing tests that assert the FOLDED single-toast behavior for these two events will need updating. Grep `test/unit/*.test.js` for `phobiaFrozen`/`combatInDark` fold assertions before touching `startCombat`.
**Warning signs:** A previously-passing toast-folding test starts failing with "expected 1 toast, got 2" after the split.

### Pitfall 2: Unit tests that call `startCombat` directly and assert on post-initiative state
**What goes wrong:** `test/unit/combat.test.js` (~15 call sites) and `test/unit/combat-scaling.test.js` (~9 call sites) call `startCombat(...)` and then immediately assert on `state.combat.first`, foe hp after a pre-emptive strike, or `state.combat.frozen` — all of which will no longer be set after the ENCOUNTER-only `startCombat` returns.
**Why it happens:** These tests were written against today's single-call behavior.
**How to avoid:** Each such test needs an explicit follow-up call to the new `fight` resolver (or `applyAction({type:"fight"})`) before the assertion — this is expected, planned rework, not a regression; budget real time for it in Wave 1.
**Warning signs:** `state.combat.first === undefined` / foe `wp` unexpectedly still at `maxWP` in a test that used to see a pre-emptive strike's damage.

### Pitfall 3: `c.foresight` is now consumed at Fight!-time, not encounter-glimpse-time
**What goes wrong:** `rollInitiative` sets `c.foresight = false` unconditionally (`combat.js:125`) — this now happens inside `fight`, not `startCombat`. A save/load, or any code that inspects `c.foresight` between "encounter shown" and "Fight! pressed," would see a DIFFERENT (still-true) value than it would have under today's single-call model.
**Why it happens:** Direct consequence of moving `rollInitiative` into a later dispatch.
**How to avoid:** Confirmed via grep that nothing reads `c.foresight` between those two points today (no fixture/test saves mid-encounter-preview) — flag as a documented, zero-fixture-impact timing shift, not a required code change, but WORTH noting in the plan's divergence log.

### Pitfall 4: `combat.pending` must be excluded from every save (already true structurally, verify explicitly)
**What goes wrong:** CONTEXT locks "combat stays transient in saves (rehydrate nulls `combat` as today)." Since `state.combat` is ALREADY nulled wholesale on save/rehydrate (confirmed existing behavior — combat never survives a save today), a `pending: true` combat is automatically covered by the SAME existing nulling — no new save-shape work needed. Verify this assumption by reading `engine/saveState.js`'s `rehydrate`/`sanitize*` functions at plan time (not read in this research pass) to confirm `state.combat` really is unconditionally nulled on load, not merely "not serialized" (a subtle but important difference if a mid-session snapshot — not save/load — is ever taken, e.g. for the loot-screen resume path Phase 29 shipped).
**How to avoid:** One-line confirmation read of `engine/saveState.js` before finalizing the plan; do not assume.

### Pitfall 5: `killSpFor`/party-share math inside `killFoe` already handles the multi-foe stone kill correctly — don't re-derive it
**What goes wrong:** A planner might be tempted to write custom XP/coin-split logic for "all foes stoned at once" since it looks like a special multi-kill event.
**Why it happens:** The `stone` case already loops `.forEach(f => { f.wp=0; killFoe(state,f,rng,events); })` — EACH foe gets its own full `killFoe` call (own d6 SP roll, own d10 coin roll, own loot-gate roll, own `checkLevel` check) — this is already correct, already tested via `killFoe`'s own unit coverage, and adds real rng draws per stoned foe (multiple `rng.d(6)`/`rng.d(10)`/`rng.d(20)` in sequence for a multi-foe stone).
**How to avoid:** Do not intercept/batch the kills — the ONLY new code needed is the cleared-check AFTER the existing loop (§8.2) and the new `foeStoned` narration event collecting names DURING the same existing loop.

## Code Examples

### The exact cleared-check pattern to reuse for CMB-06 (from this repo)
```js
// Source: engine/combat.js:370-373 (existing precedent — the pre-emptive-foeTurn-kill guard)
if (state.combat && !liveFoes(state).length) {
  events.push({ type: "encounterCleared" });
  endCombat(state, events);
}
```

### The exact per-round ward tick to mirror for Acuteness (from this repo)
```js
// Source: engine/combat.js:1784-1787 (foeTurn's tail — existing ward tick, mirror for c.acute)
if (c.ward && --c.ward.rounds <= 0) {
  events.push({ type: "wardFaded" });
  c.ward = null;
}
```

### The exact `conditionsOf` shape to add for the Shield chip (from this repo)
```js
// Source: engine/derived.js:190-199 (existing `flight` multi-field precedent — mirror for `ward`)
if (hasItemNamed(c, "Bracelet of Flight")) {
  out.push({ key: "flight", polarity: "good", flight: "always" });
} else if (hasItemNamed(c, "Cloak of Flying")) {
  if (c.flightLeft > 0) out.push({ key: "flight", polarity: "good", flight: "charged", remaining: c.flightLeft });
  else if (c.flightCooldown > 0) out.push({ key: "flight", polarity: "good", flight: "cooldown", remaining: c.flightCooldown });
  else out.push({ key: "flight", polarity: "good", flight: "ready" });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `startCombat` resolves everything (roster → initiative → pre-emptive strike) in one call; shell hides the tail behind a presentation flag | `startCombat` (ENCOUNTER only) + a real `fight` action the player must dispatch | This phase (CMB-01) | Nothing rolls/narrates before Fight! is pressed — fixes the reported "enemy attacks before Fight!" bug at its actual root, not just its symptom |
| `useItem` never checks combat state for targeted items; never checks for a cleared encounter after any kill | `useItem` refuses targeted kinds outside combat (`combatOnly`) and clears a stranded encounter after any kill | This phase (CMB-03/CMB-06) | Closes the Amulet of Stone stranded-combat bug and the silent staff-fizzle-and-burn-cooldown bug |
| `c.acute` set once, never decremented | `c.acute` decrements once per combat round (mirroring `ward`/`mirror`) and clears at `endCombat` | This phase (CMB-05) | Acuteness finally expires — the headline CMB-05 fix |

**Deprecated/outdated:**
- The classic `mazeworld.html:2046-2050` `canCast(sp)` in-combat spell-menu filter is now confirmed stale relative to `engine/derived.js#canCast`'s `spellLevelFor` override awareness (Phase 23) — fix in this phase (§3.2), do not leave as "intentionally duplicated" going forward without the override fix.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `engine/saveState.js` unconditionally nulls `state.combat` on rehydrate (not merely omits it from serialization) — asserted from STATE.md's Ground Truth note ("combat stays transient in saves") but NOT independently re-read in this session | Pitfall 4 | Low — if false, a `pending:true` combat could theoretically survive an in-memory snapshot path (e.g. the loot-screen resume Phase 29 added); a one-line confirmation read at plan time closes this gap cheaply |
| A2 | Option 3 (endCombat-clear + per-round tick, no step-tick) is the right resolution for "round-based effects drunk outside combat" — this is a RECOMMENDATION, not a verified fact; CONTEXT does not lock a specific mechanism | §6.1 | Medium — if the user/planner wants a different mechanism (e.g. step-ticking outside combat), the Acuteness fix's exact tick-site placement would need to change; flagged explicitly as an open design point, not silently assumed |
| A3 | No fixture in `test/parity/fixtures/*.json` scripts a non-`fight` combat action immediately after a `move`/`camp` action that triggers `startCombat`, outside of the four explicit "startCombat" scripted scenarios already identified — this was NOT verified by reading every fixture script line-by-line (30+ files) | §1.4 | Medium — if a movement/economy/encounters fixture DOES chain a non-combat action while `combat.pending` is true, the compare-only reconcile alone is insufficient and that fixture needs the same real-apply treatment as combat/magic-parity; flagged as a mandatory Wave-1 verification task, not assumed clean |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should `fight`'s post-initiative event carry `first` on a re-emitted `encounterStarted`, or a brand-new event type?**
   - What we know: the five zero-draw flags (`samuraiNeverFirst` etc.) can stay in the ENCOUNTER-step `encounterStarted`; only `first` needs to move.
   - What's unclear: whether Phase 32's Round Card (which reads events for its round-narrative fold) expects `first` on `encounterStarted` specifically, or is agnostic to event naming as long as narration/toast tables cover it.
   - Recommendation: name it explicitly in the plan (this research suggests `combatJoined {first}` as a working name) and add the EVENT_NARRATION/TOAST_FOR entries in the same commit; do not leave it implicit.

2. **Does `castSpell` need a `frozen` guard added (a currently-uncaught small gap found in §2), or is that out of this phase's scope?**
   - What we know: `playerStrike` already refuses while frozen (`combat.js:410-415`, clears the freeze and ends the turn); `castSpell` has no equivalent check today — a frozen character CAN currently cast spells.
   - What's unclear: whether this is a deliberate rules asymmetry (a frozen character can still work magic, just can't swing) or an oversight.
   - Recommendation: surface to the user/planner explicitly rather than silently fixing or silently ignoring — this is exactly the kind of pre-existing small gap CMB-02's audit is meant to surface, but CONTEXT's decisions section doesn't explicitly mention "frozen + spellcasting" as in scope.

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependencies beyond the existing Node.js test toolchain already in use throughout the project (confirmed working: `npm test` ran clean this session).

## Sources

### Primary (HIGH confidence — direct code read, this session)
- `engine/combat.js` (read in full: `startCombat`, `rollInitiative`, `playerStrike`, `killFoe`, `endCombat`, `afterPlayerAction`, `foeTurn`'s tail)
- `engine/items.js` (read `useItem`, `itemReady`, `offerLoot`/`takeLoot` region, all five loot handlers' surrounding context)
- `engine/magic.js` (read in full: `castSpell`, `drinkPotion`, `readScroll`, `canRead`)
- `engine/actions.js`, `engine/engine.js` (read in full — action vocabulary + dispatch switch)
- `engine/derived.js` (read `conditionsOf`, `canCast`, `spellLevelFor`, `castableAttackSpells`, `schoolGate`/`schoolBonus`/`canLearn`)
- `engine/movement.js` (read `move`, `newDay`, the per-step tick block, `makeCamp`)
- `src/browser/viewModels.js` (read `grimoireViewModel` in full)
- `src/browser/toasts.js` (read the `toastsForAction` pipeline doc comment, `encounterStart` folder, relevant `TOAST_FOR` entries)
- `mazeworld.html` (read the Fight! gate region ~L4880-4930, ~L5150-5270, ~L5500-5545, ~L5960-6120, ~L6500-6690; the classic `canCast`/`itemReady`/`useItem`/`renderCarriedList` region ~L2040-2060, ~L3440-3560; `paintConditions`/`CONDITION_COPY` ~L2790-2870)
- `test/parity/harness/comparables.js` (read in full — `reconcilePendingFind`/`reconcilePendingLoot`/`applyStartCombat`/all three comparables)
- `test/parity/combat-parity.test.js` (read the harness/dispatch loop in full)
- `content/spells.js`, `content/potions.js`, `content/spell-level-overrides.js`, `content/treasure-tables.js` (grepped/read relevant sections)
- `test/unit/conditions.test.js` (read the existing test shape/helper)
- `.planning/phases/31-combat-start-gating-effect-hygiene/31-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/29-end-of-combat-loot-bag-cap/29-02-SUMMARY.md`, `docs/COMBAT-NARRATIVE-DESIGN.md` (all read in full per the task's required-reads list)
- `npm test` — run fresh this session: **1593/1593 passing, 0 failures**

No WebSearch/Context7/external documentation was used for this research, per the task's explicit instruction (code-read only, no external libraries).

## Metadata

**Confidence breakdown:**
- Fight! split (CMB-01): HIGH — exact line numbers for every draw, every caller enumerated, the two-mode parity reconcile distinction verified by reading the actual harness dispatch loops, not inferred
- "Not ready yet" root cause (CMB-02): HIGH — both bugs reproduced by direct code trace (not runtime-tested on device, since this is a code-read-only research pass); the SPELL_LEVEL_OVERRIDES/classic-canCast mismatch is a structural, unambiguous fact independent of any runtime
- Effect expiry (CMB-05): HIGH — every field's set/tick/clear site is grep-confirmed present or absent; the Acuteness gap is a `grep`-provable "zero hits" for any decrement of `c.acute`
- Item-kill stranded combat (CMB-06): HIGH — `useItem`'s missing `afterPlayerAction`/cleared-check is directly visible in the function body; fixture-free status independently confirmed via grep
- Shield chip (CMB-04): HIGH — exact insertion points identified against the existing `flight` precedent
- Open design question (§6.1, round-based effects outside combat): MEDIUM — this is a genuine ambiguity in CONTEXT's own wording, not a code fact; flagged as a recommendation, not a verified finding

**Research date:** 2026-09-16
**Valid until:** Until this phase's plan lands (this is groundwork for immediate execution, not a stable-reference doc); re-verify `npm test` count and any file:line references if execution is delayed more than a few days, since Phase 30/31 work is landing in rapid succession on this codebase.
