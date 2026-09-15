# Phase 23: Casters Can Act (Wizard/Summoner/Illusionist + Guaranteed Attack Spell) - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas, all recommendations accepted by the user; one user-added item (Freeze pays XP)

<domain>
## Phase Boundary

No Magic User sub-class can be dealt a character that cannot fight. Four rule changes to the engine, all narrow and all deliberate divergences from the prototype (recorded per FID-06):

1. **Guaranteed day-one attack spell** (IDENT-02) — `rollGrimoire`'s existing first-day top-up also guarantees at least one usable-now ATTACK spell, with zero new rng draws.
2. **Wizard melee rule** (IDENT-01) — refuse to strike only while an attack spell is castable right now; the refusal names the spell to cast instead.
3. **Summoner summons at level 1** (IDENT-03) — via a data-driven per-sub-class spell-level override table.
4. **Illusionist wins at level 1** (IDENT-04) — Phantom Host castable at level 1 for Illusionists via the same table; the d20 strike die until level 3 stays.

Plus one user-requested spell fix riding along: **Freeze kills now pay experience and loot like any other kill** (today the frozen foe is marked dead without `killFoe`, so it awards nothing).

Also in scope: the three sub-class flavor blurbs this phase makes false (Wizard, Summoner, Illusionist in `content/flavor.js` `SUB_NOTE`) are updated here; the full flavor sweep is Phase 24 (IDENT-09). Every new/changed event gets an `EVENT_NARRATION` entry; the voice safety scan stays green.

OUT of scope: any other sub-class or race change (Phase 24), player-facing feedback beyond the event payloads (Phase 25), bot policy changes (the Phase 22 bot already summons, opens with Mirror Self, and casts disables — it will simply start succeeding), difficulty numbers (Phase 27).

Requirements: IDENT-01, IDENT-02, IDENT-03, IDENT-04, FID-06.

Grounding facts (verified 2026-09-14): every Magic User sub-class EXCEPT the Summoner can already learn all four level-1 offense spells (Doze, Freeze, Stun, Weaken) at level 1 — the Illusionist and Cleric included (offense bonus 0 but allowed). The Summoner's offense school is gated to level 3 and Summon is a level-2 spell, so a level-1 Summoner has NO attack in any legal school. Of the 14 chargen-parity seeds, only seed 15 (Summoner) and seed 24 (Apprentice, ready set Heal/Strength) roll a Magic User with no day-one attack spell.

</domain>

<decisions>
## Implementation Decisions

### Guaranteed day-one attack spell (IDENT-02, FID-06)
- **Mechanism:** extend the existing first-day top-up in `engine/character.js#rollGrimoire`. After the current "at least two usable-now spells" loop, ensure at least one usable-now ATTACK spell is in the book by taking the first attack-kind spell from the ALREADY-shuffled `spare` list (the same `rng.shuffle(spare)` — **zero new rng draws**, so rng consumption order is unchanged for every seed and only the grimoire CONTENT changes for casters that lacked an attack). Fighters and Thieves never enter `rollGrimoire`, so their rng order is untouched by construction.
- **What counts as an attack spell:** the four level-1 offense spells — **Doze, Freeze, Stun, Weaken** (kinds `status`, `thrown`, `stun`, `weaken`). Disables count: a dozing foe is hit on a 5 (canon p.27), which is exactly how a staff-wielding caster wins a fight.
- **Summoner is EXEMPT** from the attack-spell top-up (it has no legal level-1 offense spell); Summon at level 1 (below) IS the Summoner's attack. Do not add Freeze to a Summoner's book.
- **Fixture handling (FID-06):** regenerate ONLY the chargen-parity seeds whose grimoire actually changes (expected: seed 24 Apprentice; seed 15 Summoner only if its book changes — it should not, given the exemption). Record each regenerated seed's before/after grimoire list and the rationale in the plan summary and the fixture inventory. Every Fighter/Thief seed, and every other fixture file (combat, magic, movement, economy, encounters, full-suite), must stay byte-identical — the existing parity suite proves it. `test/parity/prototype-master.js.txt` is never edited.

### Wizard melee rule (IDENT-01)
- **Refusal condition:** a Wizard refuses to strike ONLY while `maxCharges(c) - c.spellsUsed > 0` AND at least one attack-kind spell in the grimoire passes `canCast(state, sp)` right now (known, level-legal, school-legal, including the new override table). A Wizard holding only utility spells, or one who has spent every attack spell for the day, fights with the staff.
- **Event payload:** `strikeRefused` keeps `reason: "wizard"` and ADDS `spell: <name>` — the attack spell the Wizard should cast instead — so Phase 25's toast can say "Cast Freeze, you have it". Update the existing `EVENT_NARRATION` line to use the spell name when present (voice-safe).
- **Rule location:** ONE shared helper, e.g. `castableAttackSpells(state)` (returns the castable attack-kind spells) plus the attack-kind set as a named export, in `engine/derived.js` (the cycle-free leaf). Used by the Wizard check in `engine/combat.js#playerStrike`, by `rollGrimoire`'s attack-kind test (via the same exported set), and later by the bot. One definition of "attack spell" for the whole engine.
- **Flavor now, not later:** update the Wizard, Summoner, and Illusionist `SUB_NOTE` strings in `content/flavor.js` in this phase (they become false the moment these rules land). Keep the voice — sarcastic, deadpan, family-friendly; e.g. the Wizard "will not raise a hand while an attack spell is left in the book". The rest of the flavor sweep is Phase 24.

### Summoner at level 1 (IDENT-03)
- **Mechanism:** a small pure-data table of per-sub-class spell-level overrides in `content/` (e.g. `SPELL_LEVEL_OVERRIDES = { Summoner: { Summon: 1 }, Illusionist: { "Phantom Host": 1 } }`), exported via `content/index.js`, read by ONE helper (e.g. `spellLevelFor(sub, sp)` in `engine/derived.js`) that `canCast` uses for its `sp.lvl > c.level` check and that `rollGrimoire`'s `usableNow` uses. Data-driven so Phase 24 can add rows without engine edits. The `SPELLS` table itself is NOT edited (Summon stays a level-2 spell for everyone else).
- **Level-1 summon strength: unchanged formula** — `lvl = min(5, c.level + 1)` for a Summoner (level 2 at level 1), `rounds = 2 * d4 + 2`; the one-in-eight backfire (`lvl² + d6` self-damage) stays as the bad.
- **Out-of-combat summon unchanged:** casting outside combat sets `c.pendingAlly`, joined by the next `startCombat`. That is the intended level-1 loop.
- **Fixture check:** the planner verifies no parity fixture attempts a level-1 Summon (today refused with no rng draw; after the change it draws). If one does, it is a documented deliberate regeneration under FID-06.

### Illusionist at level 1 (IDENT-04)
- **Phantom Host castable at level 1 for Illusionists** via the override table above. It is already a guaranteed grimoire grant for Illusionists and already implemented as `kind: "summon"`, so the phantom host fights beside them from day one. Together with the guaranteed attack spell, a level-1 Illusionist has two ways to WIN.
- **Not doubled:** only Summoners double; a Phantom Host ally is `lvl = min(5, c.level)`, standard rounds `d4 + 2`. Keeps the two identities distinct.
- **The bad stays:** d20 strike die until level 3, unchanged (`engine/derived.js#strikeDie`).
- **Mirror Self unchanged.** It remains the stall tool.

### Freeze pays out (user addition, 2026-09-14)
- **Deliberate divergence:** in `engine/magic.js`'s thrown branch, a successful Freeze must route the kill through `killFoe` (experience via `killSpFor`, loot, kill count, party split) instead of only setting `alive=false / frozen=true / wp=0`. Keep the `frozenSolid` event and the `t.frozen` flag for narration; the foe's wp is 0 either way. Order: emit `frozenSolid`, then `killFoe`. The planner must check whether any parity fixture casts Freeze; if one does, it is a documented regeneration under FID-06 (rationale: "Freeze kills awarded nothing — a bug in the prototype, not a rule").

### Claude's Discretion
- Exact names of the new helpers/exports and the override table; exact JSDoc wording.
- Whether `castableAttackSpells` returns spell objects or names.
- Test file layout (extend `test/unit/character.test.js` / `magic.test.js` / `combat.test.js` vs. a new `test/unit/casters-can-act.test.js`) — but every rule above needs a test: guaranteed attack for all 7 non-Summoner subs over many seeds; Summoner exemption; Wizard fights with utility-only book and after spending attack spells; Wizard refusal names the spell; Summon castable at level 1 by a Summoner only; Phantom Host castable at level 1 by an Illusionist only; Freeze kill awards sp/loot; zero-new-draw proof for `rollGrimoire`.
- The exact flavor sentences (voice-safe, run the safety scan).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/character.js#rollGrimoire(rng, sub)` — the top-up loop (`usableNow`, `ready()`, shuffled `spare`) to extend; sub-class guaranteed grants (Cleric, Illusionist, Summoner, Sorcerer) live here.
- `engine/derived.js#canCast(state, sp)` — the single castability gate (grimoire membership, `sp.lvl > c.level`, `schoolGate`); `schoolGate`/`schoolBonus`/`canLearn` read `content/mu-chart.js`.
- `engine/combat.js#playerStrike` ~L336 — the Wizard refusal (`c.sub === "Wizard" && maxCharges(c) - c.spellsUsed > 0` → `strikeRefused`).
- `engine/magic.js#castSpell` — `summon` branch (Summoner doubling, pending ally, backfire), thrown branch with the Freeze special case (`frozenSolid`, no `killFoe`).
- `engine/combat.js#killFoe` — experience (`killSpFor`), loot, kills, party split — the routine Freeze must now call.
- `engine/movement.js#maxCharges(c)` — `2*level + 2 + eff(charges)`.
- `content/spells.js` (32 entries; `content-tables.test.js` locks the count — do NOT add a spell), `content/mu-chart.js`, `content/flavor.js#SUB_NOTE`, `content/index.js` (barrel).
- `src/browser/eventNarration.js` — `EVENT_NARRATION` table with a coverage guard (`test/unit/formatEventsCoverage.test.js`) and `test/voice/safety-scan.test.js`.
- Parity: `test/parity/fixtures/action-script.chargen.json` (seeds 1,2,3,4,6,7,8,13,15,19,24,29,32,35), `test/parity/FIXTURE-INVENTORY.md`, `test/parity/harness/comparables.js` (no new serialized field here → no carve-out expected), `test/determinism/forced-chargen.test.js` (Phase 22 — its byte-identity assertions compare forced vs natural on the SAME engine, so they stay green).
- Phase 22 harness for a quick sanity readout after the changes: `node tools/tune-classes.mjs --sub Wizard --seeds 20`, `--sub Summoner`, `--sub Illusionist` (do NOT capture AFTER — that is Phase 26).

### Established Patterns
- Deliberate rules changes carry a `// DELIBERATE RULES CHANGE (phase, date, REQ): …` comment naming the prototype behavior and the rationale (see Warlock daily potion, Master of Arms +2, Cloak of Armor).
- Engine gate: pure/deterministic; new rng draws only behind new-feature guards (none needed here — Freeze's `killFoe` draws are behind a hit that already happened; Summon at L1 draws only when a Summoner casts at L1, impossible today).
- Fixture regeneration is narrow and documented (v1.1 BEST-03/FID-05 precedent: named seeds, before/after tables).

### Integration Points
- `engine/character.js` (top-up + attack-kind import), `engine/derived.js` (attack-kind set, `castableAttackSpells`, `spellLevelFor`, `canCast`), `engine/combat.js` (Wizard check), `engine/magic.js` (Freeze → `killFoe`; `summon` branch unchanged), `content/spell-level-overrides.js` (new) + `content/index.js`, `content/flavor.js` (3 strings), `src/browser/eventNarration.js` (strikeRefused wording).
- Tests: unit tests per rule; chargen fixture regeneration for the changed seed(s) + inventory note; full `npm test` (989) green; parity 30/30 with only the documented regenerations.

</code_context>

<specifics>
## Specific Ideas

- The whole fix is "no caster is ever helpless on day one" — measure it with the Phase 22 harness on the three worst subs (Summoner 2.18, Illusionist 2.20, Wizard 2.48 mean depth in BEFORE) as a sanity check only; the real AFTER matrix waits for Phase 26.
- Keep the bads intact and visible: Summoner backfire, Illusionist d20 strike, Wizard's refusal while a real attack is available. This phase adds goods and removes helplessness; it does not soften identities.
- Freeze paying out changes caster experience curves — note it in the ledger's Rulings section (Phase 24 owns the section, but the entry can be drafted in this phase's summary).

</specifics>

<deferred>
## Deferred Ideas

- A brand-new level-1 illusion attack spell (would change the locked 32-spell table; not needed once Phantom Host is level 1).
- Softening the Illusionist's d20 strike die (rejected — the bad stays).
- Broader spell audit ("not ready yet" items, round-based effects expiring) — v1.3 polish remainder.
- Bot policy tweaks to exploit the new rules (already covered by Phase 22's policy; revisit only if Phase 26 shows the bot never casts the new level-1 options).

</deferred>
