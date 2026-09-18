# Flee Retune (Phase 42 ledger)

**Phase:** 42-flee-retune-consolidated-balance-close
**Date:** 2026-09-18

This ledger declares Phase 42's flee retune (FLEE-01/FLEE-02): a lower,
honestly-shown base escape chance with the Thief edge kept, small bounded
class/race modifiers, and the roll/modifiers/need narrated on every surface
BEFORE the outcome resolves.

## Canon change (Phase 42, FLEE-01)

The frozen prototype (`test/parity/prototype-master.js.txt` — NEVER edited)
rolls a flat `flee()`: `d20`, `+5` for a Thief, eleven or better escapes — a
plain character's base rate is 50%, a Thief's is 75%, and no race or armor
input exists at all.

The new rule (one formula, engine-wide):

```
d20 + Thief(+5, kept) + FLEE_CLASS_MOD[cls] + FLEE_RACE_MOD[race] - armorBulk(c) >= 14
```

The user's decision (CONTEXT Area 1, 2026-09-18): **35% base (need 14)** — a
plain Human Fighter in no armor escapes 35% of the time, a Thief in light
armor 60%, a Fighter in Plate 25%. Every class/race modifier is bounded to
±2 and reasoned below.

**Greenfield ruling (STATE.md amendment 2026-09-17):** this is the ONLY flee
formula — there is no run flag, no lazy field, and no old branch kept alive
for fixtures or the bot. The one parity fixture that flees (seed 17) was
measured live against the new formula (see "Parity fixture reading" below)
and its outcome did not move, so zero fixtures were regenerated.

## Modifier table

| Modifier | Value | Reason |
|---|---|---|
| Thief flee bonus | +5 | Getting out is the Thief's whole trade — kept unchanged from the prototype. |
| Fighter (class) | 0 | The class-neutral baseline; a Fighter's edge is standing and fighting, not running. |
| Thief (class) | 0 | The class modifier is separate from the Thief flee bonus above — a Thief's edge IS that bonus, not a second class term. |
| Magic User (class) | −1 | Robes and no footwork. |
| Human (race) | 0 | No advantages, no penalties — the dungeon's default. |
| Elven (race) | +1 | Light and quick, strikes a die better — a step easier to slip away too. |
| Dwarven (race) | −1 | Stocky and short-legged; not built for a sprint. |
| Wilmsry (race) | 0 | Nothing about the Wilmsry's own traits (fast healing, slow learning) touches agility. |
| Fridgian (race) | −1 | Strikes last (`slow`) — the same lack of urgency costs them the door. |
| Troll (race) | −1 | Large, 75 wp of lumber; nothing about a Troll is quick. |
| Cloth (armor bulk) | 0 | No bulk penalty. |
| Leather (armor bulk) | 0 | No bulk penalty. |
| Studded (armor bulk) | −1 | Heavier leather starts to slow you down. |
| Mail (armor bulk) | −1 | Same bulk tier as Studded. |
| Plate (armor bulk) | −2 | The heaviest tier — a Fridgian never wears armor at all, so this row never applies to one. |

(`FLEE_CLASS_MOD`/`FLEE_RACE_MOD` live in `content/flee.js`; armor's
contribution is `-armorBulk(c)`, the same `content/armors.js#bulk` axis
Phase 39 added for climb/leap/Stealth.)

## Before / after

Every percentage is `Math.round((21 - need) / 20 * 100)` — computed, not
typed from memory (`test/unit/flee-ledger.test.js` re-derives every cell
from `content/flee.js` and asserts this exact formula).

| Character | Old need (d20 ≥) | Old % | New need (d20 ≥) | New % |
|---|---|---|---|---|
| Human Fighter, no armor | 11 | 50 | 14 | 35 |
| Human Fighter, Mail | 12 | 45 | 15 | 30 |
| Human Fighter, Plate | 13 | 40 | 16 | 25 |
| Human Thief, Leather | 6 | 75 | 9 | 60 |
| Human Thief, Studded | 7 | 70 | 10 | 55 |
| Elven Thief, Leather | 6 | 75 | 8 | 65 |
| Human Magic User, Cloth | 11 | 50 | 15 | 30 |
| Dwarven Fighter, Mail | 12 | 45 | 16 | 25 |
| Fridgian Thief, no armor | 6 | 75 | 10 | 55 |
| Troll Fighter, Plate | 13 | 40 | 17 | 20 |
| Troll Magic User, Cloth | 11 | 50 | 16 | 25 |

The base rate drops everywhere, the Thief's edge over a Fighter of the same
race/armor stays the full 5 points wide, and armor's bite is now visible by
name (an armor-heavy Fighter and a light Thief are no longer separated by a
flat, silent 25-point gap the player never sees explained).

## What did not change

- **Samurai** never runs — refused before any roll, byte-identical.
- **Cloaker** free vanish while unseen (`!C.opened2`) — zero draws, no
  `fleeRolled`; once seen, `vanishDenied` narrates and falls through to the
  ordinary roll (which now uses the new formula, same as any other Thief).
- **Tracked round-1 withdrawal** — a clean, roll-free exit for any Fighter
  except a Master of Arms, who is denied (`withdrawalDenied`) and falls
  through to the ordinary roll.
- **Smoke** (ABIL-01) — an active flee bypass: no roll, no pursuit strike,
  unconditional escape while the effect is active.
- **The failed-flee path** — `fleeFailed` still hands every live foe its
  `foeTurn` swing and advances `C.round` exactly as before; a `fleesBelow`
  caster clearing mid-`foeTurn` still ends the encounter instead of
  stranding the screen. Byte-identical apart from the richer event payload.
- **Pursuit strikes** — a live `sp.pursues` foe's parting blow on every
  success exit is untouched (same function, same order, same draws).
- **Loot forfeiture** — a non-empty pending loot pile is still forfeited
  before `fled` on every success exit.
- **One d20 draw at the same position** — the roll still happens after the
  Smoke check and before `pursuitStrike`; no new rng draw was added or
  removed anywhere in `flee()`.

## Event payload and narration (FLEE-02)

The ordinary flee roll pushes exactly one event:

```js
{ type: "fleeRolled", roll, mods: [{ name, delta }, ...], total, need }
```

The old `bonus`/`bulk` keys are **retired** (greenfield — this is the only
shape the event ever carries now). `mods` is built in a fixed order — Thief
→ class → race → armor — pushing an entry only when it is non-zero, mirroring
`engine/derived.js#foeToHitBreakdown`'s `{ name, delta }` shape so every
narration surface reads the SAME list instead of re-deriving the formula:

- **Oracle sentence** (`src/browser/eventNarration.js`):
  `Flee: rolled <span class="roll">8</span> (Thief +5, Mail −1) — 12 against
  14.` — the roll, every named modifier, and the need, all before the
  `fled`/`fleeFailed` line resolves.
- **Fight-log fold** (`src/browser/toasts.js#fleeChain`): one line per
  attempt, ROLL FIRST — `Flee: 9 (Thief +5) = 14 vs 14. You get clear.` — by
  reusing `TOAST_FOR.fleeRolled`'s own text rather than restating the format.
- **Toast** (`TOAST_FOR.fleeRolled`): `Flee: 8 (Thief +5, Mail −1) = 12 vs
  14` (no parenthetical when there are no modifiers).
- **Rail** (`RAIL_FAMILY.fleeRolled`): `{ icon: "·", title: "FLEE", tone:
  "info" }` — a family entry for completeness; the fight log is the real
  destination for this combat-only event.
- **Combat submenu** (`src/browser/combatMenu.js`): the FLEE row's `cost`
  (`d20+5, 14+` / `d20−3, 14+` / …) and `desc` (appending `(Troll −1, Plate
  −2)` when modifiers apply) are computed from `fleeBreakdown(c)` — the same
  function `flee()` itself calls — so the pre-roll preview can never drift
  from the actual roll.

## Parity fixture reading

The only parity fixture whose action script flees is
`test/parity/fixtures/action-script.combat.json`'s `flee` scenario (seed
17). Measured live (2026-09-18, `node` replay of `newRun(17)` →
`startCombat`/`fight` (forced Beasts) → `applyAction({ type: "flee" })`):

| Field | Value |
|---|---|
| Hero | Fridgian Thief (Pilfer), no armor |
| Roll | 18 |
| Modifiers | Thief +5, Fridgian −1 |
| Total | 22 |
| Need | 14 |
| Outcome | `fled` (escaped) |

Under the OLD formula this same character escaped on `18 + 5 = 23 >= 11`;
under the NEW formula it escapes on `18 + 5 - 1 = 22 >= 14` — the outcome
does not move. **No divergence record was declared; the fixture is
untouched** (`git status --porcelain test/parity/fixtures` is empty).

## Tests

- `test/unit/flee-retune.test.js` — `content/flee.js` table bounds, worked
  `fleeBreakdown` rows, the exhaustive d20 enumeration (35%/60%/25%/30%/65%/
  20% anchors), the `fleeRolled` event's exact shape (no `bonus`/`bulk`),
  the failure path, sub-class flavour untouched, and (Task 2) the
  `EVENT_NARRATION`/`TOAST_FOR`/`fightLogLinesFor` narration surfaces.
- `test/unit/combat.test.js`, `test/unit/gear-axes.test.js`,
  `test/unit/feedback-payload.test.js` — re-pinned to need 14 where the old
  need-11 roll would now resolve differently; every other flee test
  (rolls that stay on the same side of both needs) is untouched.
- `test/unit/toastsForAction.test.js`, `test/unit/combatMenu.test.js`,
  `test/unit/rail.test.js` — re-pinned fold text/submenu cost and a new
  `RAIL_FAMILY.fleeRolled` shape assertion.
- `test/unit/flee-ledger.test.js` — reads this file and asserts its numbers
  can never drift from `content/flee.js`.

## Requirements map

| Requirement | Proof |
|---|---|
| FLEE-01 (need 14, Thief +5 kept, bounded class/race table, ledgered before/after — the ONLY formula) | `content/flee.js`, `engine/derived.js#fleeBreakdown`, `engine/combat.js#flee`, this document's Canon change/Modifier table/Before-after sections, `test/unit/flee-retune.test.js`, `test/unit/flee-ledger.test.js` |
| FLEE-02 (roll/modifiers/need shown in the fight log before the outcome; failed flee unchanged) | `src/browser/eventNarration.js`, `src/browser/toasts.js#fleeChain`, `src/browser/rail.js`, `src/browser/combatMenu.js`, this document's Event payload and narration/What did not change sections |

(REQUIREMENTS.md itself is flipped to complete by Plan 04 at phase close,
alongside BAL-02.) `docs/CLASS-PASS.md`'s v1.5 AFTER section (Plan 04) cites
this ledger for the flee-side half of the consolidated retune.
