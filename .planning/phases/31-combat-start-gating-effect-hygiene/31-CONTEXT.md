# Phase 31: Combat Start Gating & Effect Hygiene - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas proposed in batch tables; user accepted all, with one clarification (refusals render as toasts even after the Round Card ships)

<domain>
## Phase Boundary

Engine/combat-flow groundwork landed BEFORE the Round Card build (Phase 32) so the new screen is built against settled rules: no initiative roll or enemy strike before Fight! is pressed; every refusal to act (spell, item, gear) explains itself, backed by a completed audit of every usable feature; combat (buff) potions are drinkable from Gear outside combat; Shield shows a condition chip; every round-based effect expires outside combat; Amulet of Stone ends a fight and pays out like a kill. Requirements: CMB-01..06.

Out of scope: the Round Card / toast routing rebuild itself (Phase 32 — this phase only produces the refusal EVENTS and wording; Phase 32's routing table renders them), the "squares of opponents" group model (deferred), any tuning, Fight!-preview escape options (Flee/Parley stay combat actions).

</domain>

<decisions>
## Implementation Decisions

### Fight! gating (CMB-01)
- Split `engine/combat.js#startCombat`: the ENCOUNTER step (triggered by the move/encounter roll) rolls the foes, builds `state.combat = {foes, type, round: 1, …, pending: true}` and emits `encounterStarted`; a NEW engine action `fight` (validated in `engine/actions.js`, dispatched in `engine/engine.js`) performs everything from `rollInitiative` onward IN TODAY'S EXACT DRAW ORDER — initiative d20s, the phobia-freeze Hardiness `rng.d(2)`, `combatInDark`, then the pre-emptive `foeTurn` if foes won — and clears `pending`. Nothing rolls or strikes before `fight`.
- The shell's existing DR17 Fight! gate (`mzFight`) dispatches `fight` instead of flipping a display flag; the pre-death/AMBUSH Fight! special-case (mazeworld.html ~L4894) is re-based on the new model (a pre-emptive kill now happens AFTER Fight!, so that special case should collapse).
- Parity: because the moved draws keep their order, add `reconcilePendingFight` to `test/parity/harness/comparables.js` (the `reconcilePendingFind`/`reconcilePendingLoot` pattern: when a compared state has `combat.pending`, apply `fight` on a clone with the same rng cursor before comparing, so both the post-move state AND the rng cursor match the prototype). No fixture JSON edited; `prototype-master.js.txt` never edited. Apply the same reconcile in the three parity tests that keep a local `comparable()` (combat/magic/movement — see 29-02-SUMMARY).
- The preview offers the foe roster + Fight! only; Flee/Parley/Sing/spells/items remain combat actions after Fight! (rulebook: initiative decides first strike; no pre-combat escape). While `combat.pending`, every combat action other than `fight` is refused with reason `notFought` (explains itself).
- Combat stays transient in saves (rehydrate nulls `combat` as today): a pending encounter is not serialized.

### The "not ready yet" audit (CMB-02)
- Deliverable: `docs/USABLE-FEATURES-AUDIT.md` — a ledger of EVERY usable spell (by class/level), item (potions, staves, cloaks, jewelry, picks), gear piece and class/race/sub-class active feature × circumstance (explore / combat / class or race gate / cooldown / charges / Fight!-pending), with the engine's refusal reason for each blocked circumstance and an "expiry" column for every timed effect (see CMB-05). A TEST walks the same table (data-driven from a JS mirror of the ledger or from the content tables) and asserts each refusal path emits an explaining event and each allowed circumstance succeeds.
- One refusal vocabulary: `useRefused {item, reason}` (exists today for `pilfer`) and `castRefused {spell, reason}` (new type) with fixed reasons — `cooldown {left}`, `wrongClass`, `exploreOnly`, `combatOnly`, `noTarget`, `noCharges`, `notFought`, `pilfer` (no `frozen` — see the phobia ruling below) — each reason with its own toast + Oracle line naming the why (family-friendly sarcastic). New event TYPES get EVENT_NARRATION + toast-table entries.
- Shell: blocked buttons stay visible; tapping one dispatches and the refusal toast explains (Phase 25.1 DFB-06 precedent — never disable silently); cooldown rows keep showing the countdown.
- USER CLARIFICATION (2026-09-16): refusals are TOASTS — and stay toasts even after Phase 32's Round Card ships (the design doc §4.2 already routes `PRIORITY.block` refusals to toasts as direct replies to a tap; out-of-combat refusals on the Gear tab/store are toasts regardless). Phase 32 must not fold refusals into the Round Card.
- The reported "always not ready yet" spells are real bugs to root-cause: research reproduces which spells/items report not-ready when they should be usable (candidates: `itemReady` cooldowns keyed on `state.steps`, which never advances during combat; charge counters; a generic not-ready string) and each is fixed; any fix that changes fixture behaviour is a declared, documented divergence.

### Potions from Gear, Shield chip, effect expiry (CMB-03, CMB-04, CMB-05)
- Buff potions/items (Acuteness, Strength/might, haste, ward-type, healing) are usable from the Gear page outside combat and start their timers immediately; targeted attack items (Amulet of Stone, fire, gas, freeze/Birch-style) are refused outside combat with `combatOnly`. The Gear tab's Use button therefore works for buffs anywhere.
- Shield chip: add `ward` to `engine/derived.js#conditionsOf` with `{pool, rounds}` (reads the same `c.ward` the engine's absorb/reflect/shatter code uses) → shell chip "Shield · 34 hp · 3 rds"; ward-fade/shatter already narrate.
- Expiry model — every timed effect gets an explicit counter AND a unit, recorded in the audit ledger: ROUND-based effects (Acuteness `c.acute` — currently set to `rng.d(8)` and NEVER decremented — plus ward, mirror, senses, regen) tick once per combat round and clear at `endCombat`; STEP-based effects (haste from the Cloak of Speed, 50 squares; invis/ether) tick on exploration steps as today; might stays "until the next day" as today. The Acuteness fix is the headline: it finally counts down and clears when combat ends.
- Parity: new decrements/clears fire only for characters who have the effect (no new rng draws); research enumerates any fixture that drinks/casts such an effect and the planner carves out precisely (comparables) if needed — fixtures never edited.

### Amulet of Stone (CMB-06)
- When an ITEM kill (stone, fire, gas, freeze…) removes the last live foe, the encounter clears through the same path as any other kill (`encounterCleared` → `endCombat` → Phase 29's loot card). Research pins down exactly where today's stranded state comes from (likely the `useItem` action path not running `afterPlayerAction`'s cleared check) and fixes that path for every item kill, not just the Amulet.
- Stoned foes count as slain: they already route through `killFoe` (XP, coin, treasure drop into the pile, kill count); pin with a test; fix any bypass.
- New `foeStoned {names}` event (EVENT_NARRATION + toast entry, e.g. "N turn to stone. Statues don't hit back.") in addition to the per-foe `foeKilled` lines.
- `aoe: 4` stays; the "squares of opponents" group model remains deferred.

### Phobia = penalty, never a lost action (USER RULING 2026-09-16, supersedes "frozen" everywhere)
- User: "Phobia should be penalties, never a no actions state." Today a triggered phobia sets `C.frozen` and the player's FIRST strike is spent shaking it off (`shookOffFrozen`) — one lost action. That mechanic is REPLACED (deliberate rules change, declared parity divergence for every fixture that triggers a phobia — at least magic `cast-damage` seed 8 — with before/after records; `prototype-master.js.txt` never edited).
- New mechanic "Afraid": trigger unchanged (type-matched phobia / Darkness in the dark / Death near death; Hardiness `rng.d(2)` still halves the odds — same draw, same site). Effect: `combat.afraid = 2` rounds; while afraid every attack roll the player makes (strike to-hit, and spell to-hit where one exists) is at −3 and the player's damage is halved (Math.ceil, min 1); the player may act normally otherwise. ZERO new rng draws (no shake-off roll). Counts down once per round with the other Phase 31 round-based effects; clears at `endCombat`; condition chip "Afraid · N rds".
- Events: `phobiaFrozen` → `phobiaAfraid {rounds}`; `shookOffFrozen` → `fearPassed`; `frozen` is REMOVED from the refusal vocabulary (nothing is refused for fear — casting, striking, items, flight all allowed). EVENT_NARRATION/toast entries renamed accordingly; the audit ledger records fear as a penalty row, not a refusal.
- Numbers (2 rounds / −3 / half) are tuning knobs documented at the constant.

### Claude's Discretion
- Exact reason strings and toast/Oracle wording (voice-safe); the audit ledger's column layout; whether the table-driven test reads a JS mirror or derives rows from `content/*` tables.
- Whether `fight` also owns the `tracked` (Tracking skill) roll — NO: it precedes the foes' roll today and stays at the encounter step; only draws from `rollInitiative` onward move.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/combat.js#startCombat` (~L153–370): foes roll → `state.combat = {…}` → `rollInitiative` (~L219) → phobia freeze `rng.d(2)` → `combatInDark` → pre-emptive `foeTurn` (~L358). `afterPlayerAction` (~L1035) — the cleared/endCombat check every player action should route through; `endCombat` (~L962) clears regen/ward/mirror/senses/foeEffect.
- `engine/items.js#useItem` (~L790–930): `itemReady` (steps-keyed cooldown), `useRefused {reason:"pilfer"}`, the `stone`/`fire`/`gas`/`freeze` cases (`foes` filtered from `state.combat`), buff cases (`might`, `haste = 50`, `acute = rng.d(8)`, `halfNext`, `ward`).
- `engine/magic.js#castSpell` (~L80–350) and `readScroll` (`scrollRefused {reason}`); `castableAttackSpells`/`bestAttackSpell` in `engine/derived.js`.
- `engine/derived.js#conditionsOf` (~L170–205): haste/invis/acute/ether/might/flight/affliction/phobia chips — add `ward`.
- `engine/movement.js` per-step tick (~L280–310: haste--, invis/ether, cloak regen) and the new-day reset (`c.might = 0` ~L402).
- `engine/actions.js` validation switch + `engine/engine.js` dispatch — add `fight`.
- `test/parity/harness/comparables.js`: `reconcilePendingFind`/`reconcilePendingLoot` (clone-and-apply reconcile) — the pattern for `reconcilePendingFight`; `applyStartCombat` (how the harness starts combat).
- Shell: `mazeworld.html` Fight! gate (~L4894–4910 AMBUSH special case, ~L5161–5175 the gate, ~L5525 key handling), `renderCarriedList` use actions, combat use-list (~L5092), `paintConditions` chips (~L2837).
- `src/browser/toasts.js` / `eventNarration.js` tables + `test/unit/formatEventsCoverage.test.js`; `docs/PARLEY-REBALANCE.md` (ledger style).

### Established Patterns
- Engine gate: pure/deterministic; parity byte-identical (reconcile/carve-out in comparables, never fixture edits, master never edited); new rng only behind guards fixtures don't satisfy (this phase adds NO new draws — it MOVES draws into `fight` in the same order); every new event type gets EVENT_NARRATION + toast entries; voice scan green.
- Refusals never silent (Phase 25 FEED / 25.1 DFB-06): visible buttons + explaining toast.
- Documentation ledgers with a table-driven test (Phase 24 identity contract, Phase 26 class-pass ledger).

### Integration Points
- `startCombat` split + `fight` action; `useItem`/`castSpell` refusal vocabulary; `conditionsOf` ward chip; per-round tick site (`afterPlayerAction` round advance) for Acuteness & co.; `endCombat` clears; item-kill → cleared path; comparables reconcile; shell Fight! button → `fight`; Gear tab Use for buffs outside combat; `docs/USABLE-FEATURES-AUDIT.md`.

</code_context>

<specifics>
## Specific Ideas

- User's device reports driving this phase: the enemy attacks (and shows in the Oracle) before Fight! is pressed; some spells "always" say not ready yet; Acuteness never wears off; Shield has no chip; the Amulet of Stone leaves the fight open.
- Refusals stay toasts (user, 2026-09-16) — do not plan them into the Round Card.

</specifics>

<deferred>
## Deferred Ideas

- Flee/Parley from the preview before Fight! — not requested; would be a rules divergence.
- Squares-of-opponents group model (Amulet aoe geometry) — deferred milestone-wide.
- Round Card rendering of anything — Phase 32.

</deferred>
