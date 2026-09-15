# Phase 24: Every Sub-class and Race: One Good, One Bad - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas + a race pass; all recommendations accepted by the user, who widened the race question to "review and update all races"

<domain>
## Phase Boundary

Every one of the 24 sub-classes and 6 races has a code-verified **one solid good, one solid bad**; every flavor blurb tells the truth about the implemented mechanic; an identity-contract test proves each good and bad fires under a forced scenario. This phase lands the goods/bads that are missing (11 sub-class changes, 3 race changes), enforces or rewords three flavor-only restrictions, records the dagger ruling, and sweeps all 30 blurbs.

**Design constraint (accepted):** every new mechanic is a **zero-draw design** — a flat modifier, a gate, or a wider hit on a roll that already happens — and adds **no new serialized field** where at all avoidable. The parity fixtures roll Knights (seeds 1, 6), Cat Burglars (2, 4), a Pickpocket (3 — also the economy fixture's seed), a Woodsman (13), a Samurai (32), a Fridgian Knight (1), and Wilmsry (2, 8, 24, 29, 32); a new rng draw behind a sub-class or race guard would shift those fixtures. Parity stays byte-identical for every fixture unless the planner proves a fixture's ACTION PATH is changed (the one known candidate: removing the Fridgian corpse-whiff roll), in which case it is a declared FID-style divergence, never a blanket regeneration.

OUT of scope: player-facing toasts/feedback beyond event payloads + `EVENT_NARRATION` lines (Phase 25); the AFTER matrix (Phase 26); difficulty numbers (Phase 27); new spells/classes/races; the Human race (stays the neutral control — user decision 2026-09-14).

Requirements: IDENT-05, IDENT-06, IDENT-07, IDENT-08, IDENT-09, IDENT-10, FID-07.

</domain>

<decisions>
## Implementation Decisions

### Bads promised by flavor text (IDENT-05, part 1)
- **Knight** — "everything over 20 comes straight at you": against any encounter containing a live foe with **`maxWP >= 20`**, the Knight **never wins initiative** (unless foreseen) — same structure as `samuraiNeverFirst` in `rollInitiative`/`startCombat`; the initiative dice still roll, the result is overridden (zero draws). Event flag (e.g. `knightBigFoe: true` on `encounterStarted`) for narration.
- **Ninja** — "you never speak": **cannot parley, ever.** `canParley` returns false for `c.sub === "Ninja"`; the mirrored classic `canParley()` in `mazeworld.html` (D-17) and `test/unit/parley-button-mirror.test.js` are updated in lockstep. A `parleyRefused` (or equivalent) event with `reason: "ninja"` is narrated.
- **Bard** — "creatures too stupid to know better come for you first": **camping draws wandering monsters twice as often** — in `newDay`'s eight hourly `rng.d(20)` wake rolls, a Bard wakes on a **1 or 2** instead of a 1 (same eight draws, wider hit). In party play (when `C.allies` exists), foes with `intel <= 3` prefer the Bard as target in `pickFoeTarget` (zero new draws: reinterpret the existing pick, never add one).
- **Master of Arms** — "you attack creatures without question": **cannot parley** (same `canParley` gate + mirror), and **the Tracking round-1 clean withdrawal is denied** (`flee`'s `C.tracked && C.round === 1` branch skipped for a Master of Arms; they flee like any Fighter after round 1). Narrated refusals.

### Fresh designs (IDENT-05 part 2, IDENT-06)
- **Court Mage bad** — "you talk first": **foes act first in round one** unless foreseen (the `samuraiNeverFirst` structure again; flag for narration). Zero draws.
- **Court Mage good made felt**: boredom kill fires on **`rng.d(12) <= 2`** (1 in 6; same single draw, wider hit) AND **Court Mages can always parley Humans** (courtly manners) — add to `canParley` (+ mirror) alongside Bard-vs-Humans.
- **Pickpocket bad** — "never been thanked": **shopkeepers know your face — store buy prices ×1.25 and sell-back ×0.75** for a Pickpocket, applied where race pricing is applied (`engine/economy.js#priceFor`/`sellPriceFor` — extend the signature to take the character or sub, or add a sibling `subPriceMul`); zero draws. Note the economy fixture's seed 3 hero IS a Pickpocket — the planner must check whether that fixture buys/sells (if so, declared divergence with rationale; the store stock prices would change).
- **Cutthroat bad** — "one member of every party dies by your hand": **Joiners never travel with a Cutthroat.** In `meetJoiner`, roll the joiner exactly as today (all draws preserved), then instead of setting `state.pendingJoiner`, emit a `joinerRefused` event (`reason: "cutthroat"`, with the joiner's name/sub for the Oracle) and leave `pendingJoiner` null. Solo play otherwise unchanged.
- **Guard good** — "the profession is standing there": **every enemy needs one better to land a blow on a Guard** — `foeToHitVs` subtracts 1 for `c.sub === "Guard"`, stacking with Agility, floor 1. Zero draws.

### Enforce or reword (IDENT-07) and the dagger ruling (IDENT-10)
- **Woodsman** — enforce: `canEquipArmor` refuses **Mail and Plate** (any `ar > 10`, i.e. anything heavier than Studded) for a Woodsman; Cloth/Leather/Studded stay legal; starting kit is Leather so chargen is unchanged. Rejection event narrated with the reason.
- **Pilfer** — enforce: a Pilfer may **use only heal-kind items** (healing potions via `drinkPotion`, `useItem` with `kind === "heal"`); every other `useItem` is refused with a narrated `useRefused`/`itemRejected` reason `"pilfer"`. Scrolls stay blocked (`canRead`). Trap disarm and free chest open are untouched (the good stays strong).
- **Cloaker** — the bad becomes real: **the free vanish works only before the Cloaker has struck this fight** (`!C.opened2`); once they have swung, `flee` falls through to the ordinary Thief roll (d20 + 5 vs 11). Flavor: "You can always vanish — as long as nobody has seen your face yet." Zero draws, no new field (`opened2` already exists).
- **Dagger (IDENT-10) — RULING: keep as-is.** Rationale for the ledger: Thieves already lead the BEFORE matrix (Ninja 4.22, Con Artist 4.08, Acrobat 3.71 are the top three), the opener backstab doubles the dagger's 2–4, and a better weapon is one find away; the dagger is the price of the class's escape/stealth kit, not an accident. Recorded in `docs/CLASS-PASS.md` Rulings.

### Race pass (user widened Area 4 Q2 to "review and update all races")
- **Human** — neutral control, **no change** (prior user decision).
- **Elven** — **no mechanic change**; blurb check only ("not much more than half a person's Hit Points" is 0.6× — fine).
- **Dwarven** — **built to be hit: armor wears at half the rate.** In the armor-soak durability line (`c.armorWP = Math.max(0, c.armorWP - dmg)` in `applyFoeDamageToPlayer`), a Dwarf loses `Math.ceil(dmg / 2)` instead of `dmg`. Keeps +2 damage, upkeep 1, half prices, and the foes-strike-a-die-better bad. Pure arithmetic, zero draws.
- **Wilmsry** — **"Magic Users despise you" made real: Magic User Joiners refuse to travel with a Wilmsry.** Same `joinerRefused` mechanism as the Cutthroat (`reason: "wilmsry"`), after the joiner is rolled (`joinerChar.cls === "Magic User"`). Heal 2×, parley +4, haggle, half SP all unchanged.
- **Fridgian** — two changes: (a) **the frenzy's second swing is never wasted on a corpse** — delete the `corpse && rng.d(10) <= 5` whiff branch (this REMOVES a draw when a corpse exists → the planner must check whether any parity fixture has a Fridgian hero frenzying with a dead foe present; chargen seed 1 is a Fridgian but has no actions; if a combat/full-suite scenario is affected it is a declared divergence); (b) **a Fridgian's hide soaks 2 from every blow** — flat `-2` in `applyFoeDamageToPlayer` alongside Hardiness's `-3` (stacking), floor 0 or 1 per the existing Hardiness convention. No-armor and always-last stay.
- **Troll** — **no mechanic change**; blurb check only.

### Contract test, flavor sweep, fidelity (IDENT-08, IDENT-09, FID-07)
- **Identity-contract test = ONE data table** (new `test/unit/identity-contract.test.js`): for each of the 24 sub-classes and the 5 non-Human races an entry `{ good: {name, scenario, assert}, bad: {name, scenario, assert} }`, each scenario built with Phase 22's `newRun(seed, [], { force })` plus a synthetic combat/store/camp state, asserting the named mechanic fires. Human is asserted neutral on every hook (no race modifier anywhere). The table is the source for the ledger's good/bad table.
- **Flavor sweep = every `SUB_NOTE` and `RACE_NOTE`** re-read against the implemented mechanic and corrected where false, including the blurbs this phase changes (Knight, Ninja, Bard, Master of Arms, Court Mage, Pickpocket, Cutthroat, Guard, Woodsman, Pilfer, Cloaker, Dwarven, Wilmsry, Fridgian). Voice: sarcastic, deadpan, family-friendly; `test/voice/safety-scan.test.js` is the gate.
- **Fidelity posture:** zero-draw designs throughout; **no new serialized field** unless unavoidable (the Cloaker reads `C.opened2`; the Cutthroat/Wilmsry checks read `c.sub`/`c.race` at the Joiner offer; the Pickpocket markup is a pure price read; Knight/Court Mage initiative reads combat + `c.sub`). If a field does become necessary, carve it out in all three `*Comparable()` functions and round-trip it through save/load (FID-07). Every new event type gets an `EVENT_NARRATION` entry (coverage guard green). Parity byte-identical for every fixture unless a declared action-path divergence is proven (Fridgian whiff removal; Pickpocket store prices in the economy fixture).

### Claude's Discretion
- Exact event names/payloads for the new refusals and flags (`joinerRefused`, `parleyRefused` reasons, `knightBigFoe`, `courtMageTalkedFirst`, `useRefused`), as long as each is narrated.
- Whether the Bard target preference in party play is implemented by reinterpreting `pickFoeTarget`'s existing draw or skipped if it cannot be done with zero draws (document the choice).
- Exact flavor sentences.
- Test file split (one identity-contract table file + targeted unit tests per mechanic).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/combat.js`: `rollInitiative` (`samuraiNeverFirst` / `slow` / `foreseen` structure to extend for Knight-vs-big-foe and Court Mage), `startCombat` (foe roster with `maxWP`; the Court Mage `rng.d(12) === 1` boredom kill → `<= 2`), `canParley` (+ mazeworld.html mirror + `parley-button-mirror.test.js`), `flee` (`Cloaker` free vanish, `C.tracked && C.round === 1` withdrawal), `pickFoeTarget` (party-only targeting), `applyFoeDamageToPlayer` (Hardiness `-3`, armor durability line ~L1155 — Dwarven half-wear and Fridgian hide go here), `playerStrike` (`R.frenzy` block with the corpse whiff; `C.opened2`).
- `engine/derived.js`: `foeToHitVs` (Agility `-1` — Guard `-1` sits beside it), `killSpFor`, `fluency`.
- `engine/encounters.js#meetJoiner` — rolls the joiner (`rollCharacter(rng)` + two d20s) then sets `state.pendingJoiner`; the Cutthroat/Wilmsry refusal goes AFTER the draws.
- `engine/economy.js#priceFor(base, race)` / `sellPriceFor(item, race)` — the race price hook (10 call sites) to extend for the Pickpocket markup.
- `engine/items.js#canEquipArmor` (Woodsman gate), `useItem` (Pilfer gate; `kind` resolves from `it.eff2`/`it.use`), `engine/magic.js#canRead` (already blocks Pilfer scrolls).
- `engine/movement.js#newDay` — the eight `rng.d(20) === 1` wake rolls (Bard: `<= 2`).
- `content/flavor.js` `SUB_NOTE`/`RACE_NOTE` (30 blurbs), `content/races.js` (race flags — add e.g. `hide: 2`, `armorWear: 0.5` as data if cleaner than `c.race` checks).
- `src/browser/eventNarration.js` + coverage guard + voice scan.
- Phase 22 `force` seam for the contract test; Phase 23's `castableAttackSpells`/`spellLevelFor` (read-only).
- `docs/CLASS-PASS.md` — Rulings section placeholder (PLAY-03 owns the document; this phase fills the Rulings section: dagger ruling + every good/bad design decision with rationale).

### Established Patterns
- `// DELIBERATE RULES CHANGE (Phase N, date, REQ): …` comments on every rule change naming prototype behavior and rationale.
- Race/sub effects as data flags in `content/races.js` read by the engine (`frenzy`, `slow`, `noArmor`, `heal2x`, `spMul`) — prefer data flags for the new race traits.
- Zero-draw modifiers (Master of Arms +2, Guard damage penalty, Agility) as flat arithmetic in derived/combat.
- Declared, machine-checked fixture divergences (Phase 23's `stripDeclaredFields`/`stripScenarioDivergence` in `test/parity/harness/comparables.js`) if an action path changes.

### Integration Points
- `engine/combat.js`, `engine/derived.js`, `engine/encounters.js`, `engine/economy.js`, `engine/items.js`, `engine/movement.js`, `content/races.js`, `content/flavor.js`, `src/browser/eventNarration.js`, `mazeworld.html` (canParley mirror only), tests (`identity-contract.test.js` new; parley-button-mirror, combat, items, economy, movement, encounters unit tests extended), `docs/CLASS-PASS.md` Rulings section.

</code_context>

<specifics>
## Specific Ideas

- "One good, one bad" is the acceptance bar, not balance. Uneven is fine; a sub-class or race with only penalties or only perks is not.
- Zero draws is the discipline that keeps this phase cheap on parity. If a design cannot be done without a draw, prefer redesign over regeneration.
- The Joiner refusal event should be funny and specific ("Word has reached the Joiners. The Joiners have reached the exit."). Two sub-identities use it (Cutthroat, Wilmsry-vs-Magic-User) — one event type, two reasons.
- Fill the ledger's Rulings section as part of this phase: every design decision above with a one-line rationale, plus the dagger ruling.

</specifics>

<deferred>
## Deferred Ideas

- Wilmsry numeric trim (parley +4 → lower, or heal 2× → 1.5×) — revisit only if Phase 26's AFTER matrix still shows Wilmsry as a runaway outlier.
- Elven/Troll mechanic changes — none needed now; re-check after AFTER.
- Bard low-wit targeting in party play if it cannot be done with zero draws — note it for v1.3.
- Feedback/toast presentation of every new refusal — Phase 25 (FEED-01/02).

</deferred>
