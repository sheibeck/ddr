# Stack Research

**Domain:** Internal engine-state / serialization / save-migration for a single-player Party System ("Joiners") in a pure, deterministic, serializable vanilla-JS roguelike engine
**Researched:** 2026-09-09
**Confidence:** HIGH (primary source — direct read of the actual engine + parity harness)

> **Scope note.** This is NOT a technology-adoption research doc. No runtime/framework/library is being added — the milestone is internal engine work on an existing pure-JS engine (`engine/*.js`, `applyAction(state,action)→{state,events}`, seeded mulberry32 rng). The "stack" here is the set of **engine-state mechanisms, serialization seams, and parity constraints** the party system rides on. The template's headers are reused; the content is the concrete field shapes, migration approach, and parity carve-outs the requirements author + roadmapper need.

---

## Executive Answer (TL;DR for the roadmapper)

1. **Data model:** Add a new **top-level `state.party` array** (sibling to `state.c`, `state.combat`), NOT a field on `c`. Each member is a **full `rollCharacter()`-shaped sheet** plus a few party-scoped fields. Keep the existing `c.joiner` (persistent summary) and `state.combat.ally` (`C.ally`, temporary summon) **exactly as they are** — they are frozen in the parity master. Wire the party in **additively** alongside them; do not fold either into `state.party` this milestone.
2. **Serialization:** `serializeRun()` already spreads the full state (`{...state, version}`) so `state.party` persists for free. The **only** two edits are in `engine/saveState.js`: add `party` to the **explicit whitelist** in `validateSave()` and in `rehydrate()`, each defaulting to `[]`. That IS the save migration — old saves (no `party` key) default to an empty party. No storage-key change, no `mzStorage`/`storage.js`/`engineAdapter` change.
3. **Parity/determinism:** Add a carve-out that **strips `party` at the top-level state destructure** in `test/parity/harness/comparables.js` (the top-level analog of `stripDarkForField`, stripped like `beats`/`lastExchange`). Any **new rng draws** (party members acting in combat) must be **guarded to fire only when `state.party` is non-empty** — a situation the frozen prototype never reaches — so the frozen chargen/combat rng order is byte-identical when party is empty (exactly the pattern the phobia `rng.d(2)` and `nameFor` already use).
4. **No new dependency** is warranted. Confirmed: pure in-engine plain-data state, riding the existing JSON save blob through the existing `@capacitor/preferences`-backed `mzStorage`. Zero npm/native additions. Offline / paid-upfront / zero-SDK constraint fully honored.

---

## Current State of Play (what the code actually does today)

Two **disconnected** halves exist, confirmed by direct read:

| Half | Where | Shape | Lifetime | Wired into combat? |
|------|-------|-------|----------|--------------------|
| `c.joiner` (persistent summary) | `engine/encounters.js:404` (`meetJoiner`) | `{ name, race, sub, cls, lvl, wp, maxWP }` — a **summary only** (no skills/armor/grimoire/gear) | Persists on the character sheet across floors | **No.** Nothing ever reads `c.joiner` in combat. It is inert display data. |
| `C.ally` (temporary summon) | `state.combat.ally`, set at `engine/combat.js:163-167` (from `c.pendingAlly`) or `engine/magic.js:117` (Summon spell) | `{ lvl, rounds, name }` | **Combat-scoped only** — cleared when `--C.ally.rounds <= 0` (`combat.js:660-663`); `state.combat` itself is nulled on `endCombat` | **Yes** — `allyTurn()` (`combat.js:646-665`) strikes each round: `rng.d(STRIKE_DICE[lvl-1])`, damage `lvl*lvl + rng.d(6)`, emits `allyStruck`/`allyMissed`/`allyDeparted`. |

`meetJoiner()` (`encounters.js:397-407`) already rolls a **full** character via `rollCharacter(rng)` (plus two discarded `d20` draws for rng-order fidelity) but throws away everything except the 7-field summary. **This is the key leverage point:** the full sheet is already rolled and paid-for in rng; the party system just needs to *keep* it.

Both `c.joiner` and `C.ally` are present verbatim in the **frozen parity master** (`test/parity/prototype-master.js.txt:1762-1763, 1836-1837, 2373-2383`) — so their shapes, fields, events, and rng draws are **locked**. Touching them breaks parity.

---

## Recommended Stack

### Core Technologies (engine-state mechanisms)

| Mechanism | "Version"/Location | Purpose | Why This Is The Right Seam |
|-----------|--------------------|---------|-----------------------------|
| **Top-level `state.party` array** | `engine/state.js` `newRun()` return (init `party: []`) | The persistent joiner roster — an array of full character sheets that travel with the run | Joiners are **peers** of the player character, not properties of them. Top-level placement mirrors `state.combat`/`state.store`; keeps `c` = "the player's own sheet" clean; and `serializeRun`'s `{...state}` spread persists it with **zero serializer change**. A `state`-level field is also stripped in one place in the parity comparable (like `beats`) rather than needing a per-`c` helper. |
| **Full `rollCharacter()`-shaped member** | reuse `engine/character.js` `rollCharacter(rng)` output | Each party member has its own sheet/gear/HP/skills/grimoire — "each with their own sheet/gear/HP" | `rollCharacter` already produces the exact plain, serializable, combat-ready sheet a party actor needs (`wp/maxWP/level/skills/weapon/prof/armor/ar/armorWP/grimoire/...`). `meetJoiner` already rolls one and discards it — capturing it costs **no new rng**. |
| **Guarded party-turn in combat** | new `partyTurn(state, rng, events)` in `engine/combat.js`, called from `afterPlayerAction`/`startCombat` behind `if (state.party?.length)` | Party members act each round | Mirrors `allyTurn`'s early-return guard (`combat.js:648 if (!C.ally) return`). When `state.party` is empty (every prototype-parity fixture), it consumes no rng and pushes no events → `afterPlayerAction` stays byte-identical to the frozen master. |
| **Whitelist migration in `validateSave`/`rehydrate`** | `engine/saveState.js:117-129, 147-162` | Load-time default-fill so old saves get `party: []` | These two functions build their output from an **explicit named whitelist** (they do NOT spread `obj`), so a new field is silently dropped unless added. Adding `party` with an `[]` default IS the backward-compatible migration. |

### Supporting Libraries (existing seams reused — nothing new)

| Seam | Location | Purpose | Party-System Use |
|------|----------|---------|------------------|
| `serializeRun(state)` | `engine/saveState.js:22-24` | `{...state, version}` — persists the whole state | **No change.** Automatically includes `state.party`. |
| `window.mzStorage` / `storage.js` | `src/browser/storage.js` (via `engineAdapter.js:37`) | `@capacitor/preferences`-backed durable K/V | **No change.** Party rides inside the existing `SAVE_KEY` (`ddr.delve.v1`) JSON blob — it is in-run state, so it belongs in the save, NOT a new key (contrast graveyard/best, which are cross-run and use separate keys). |
| `engineAdapter.js` persist/boot | `src/browser/engineAdapter.js:295-331` | Load/validate/persist the run | **No change** beyond what `validateSave`/`rehydrate` already return — the adapter just round-trips whatever those emit. |
| `STRIKE_DICE`, `SPELL_LEVEL_TABLE` | `content/misc-tables.js:13,27` | Existing combat/level tables | Reusable for party-member combat math if you keep the ally-style `lvl*lvl+d6` model; no new content file needed. |

### Development Tools (verification, not build tools)

| Tool | Purpose | Notes |
|------|---------|-------|
| `test/parity/harness/comparables.js` | The strip carve-out surface | Add `party` to the top-level destructure-and-drop in `movementComparable`/`combatComparable`/`economyComparable` (see Parity section). This is the milestone's single most important test-side edit. |
| `test/parity/prototype-master.js.txt` | **FROZEN golden master — DO NOT EDIT** | Contains `c.joiner`/`C.ally` verbatim. Party has no prototype equivalent, so party state must be *stripped*, never matched. |
| `test/unit/encounters.test.js:306-314`, `test/unit/combat.test.js:683` | Existing joiner/ally unit tests | New party behavior gets NEW unit tests here; do not weaken the existing `c.joiner`/`C.ally` assertions. |

## Installation

```bash
# No packages. This milestone adds zero npm/native dependencies.
# (Offline, paid-upfront, zero-SDK constraint — confirmed below.)
```

---

## Concrete Field Shapes

### `state.party` (new top-level array)

```js
// engine/state.js — newRun() return object, add alongside combat/store/beats:
party: [],   // plain assignment — no rng draw (like combat:null, store:null)
```

### A party member (recommended shape)

```js
// Produced by capturing meetJoiner's already-rolled full character, e.g.:
{
  ...rollCharacter(rng),        // full serializable sheet: cls, sub, race, level,
                                //   wp, maxWP, skills, weapon, prof, magicWpn,
                                //   armor/ar/armorMin/armorWP/armorMax, grimoire,
                                //   temperament, motive, phobia, name, darkFor,
                                //   flightLeft, flightCooldown, ... (see character.js:175-217)
  joinerLvl: lvl,               // the SPELL_LEVEL_TABLE[d10] "power" tier meetJoiner rolls
  // OPTIONAL party-scoped bookkeeping (roadmapper's call — combat-design, not state):
  // id, alive, roundsLeft (if joiners are temporary), targetIdx, ...
}
```

**Design decision to flag (out of scope for *this* STACK doc, it's combat design):** whether a party member fights via the lightweight ally model (`lvl*lvl + d6`, one `STRIKE_DICE` roll) or via a fuller `playerStrike`-like path using their real `weapon`/`skills`/`grimoire`. The **state shape supports either**; the requirements author should decide. Keeping the full sheet (option above) leaves both doors open.

**Do NOT** overwrite the existing `c.joiner` summary shape. `meetJoiner` must **still set `c.joiner` exactly as today** (parity master pins it) AND additionally push the full member into `state.party`. See rng note below.

---

## Serialization + Save Migration (concrete)

### The one file that changes: `engine/saveState.js`

**`serializeRun` (line 22):** no change — `{...state}` already carries `state.party`.

**`validateSave` (lines 117-129):** the `value` object is an explicit whitelist. Add:

```js
const value = {
  version: STATE_VERSION,
  seed, rngState,
  c: obj.c,
  floor: obj.floor,
  party: Array.isArray(obj.party) ? obj.party : [],   // ADD — old saves → []
  day, steps,
  dead: !!obj.dead, won: !!obj.won,
  deathNote: obj.deathNote || "",
  epitaph: obj.epitaph || "",
};
```

**`rehydrate` (lines 147-162):** same — add `party: Array.isArray(obj.party) ? obj.party : []`.

### Migration semantics

- **Old saves have no `party` key** → `Array.isArray(undefined)` is false → default `[]`. Safe, silent, backward-compatible.
- **STATE_VERSION bump: NOT required.** Adding an additive field with a safe default does not change how existing v1 saves validate (`validateSave` only *rejects* saves claiming a version **newer** than supported — `saveState.js:101-104`). You MAY bump `STATE_VERSION` to 2 for documentation clarity; it is harmless (a stored v1 save still passes `1 <= 2`) but not necessary. Recommendation: **keep `STATE_VERSION = 1`**, treat the default-fill as the migration, and add a one-line comment at the existing migration-note site (`saveState.js:94-104`).
- **Malformed party members:** recommend **fail-open, not fail-closed** — validate that `party` is an array and default to `[]` if not; do NOT reject the entire save because one member is malformed. Optionally filter members through the existing `isValidCharacter` (`saveState.js:34-46`) and drop bad ones, but do not let a bad member nuke an otherwise-valid run. (Mirrors the adapter's fail-open posture, e.g. `readRecentNames` `engineAdapter.js:149-157`.)
- **Storage layer:** untouched. Party is inside the `SAVE_KEY` blob; `@capacitor/preferences`/`mzStorage`/`storage.js` and `engineAdapter.boot/persist` need no edits.

---

## Determinism / Parity Constraints (the hard part)

### 1. New parity carve-out (mirror `stripDarkForField`, but at state-level)

`c.darkFor`/`flightLeft`/`flightCooldown` are stripped by per-`c` helpers because they live on `c`. **`state.party` lives at the top level**, so it is stripped at the **state destructure**, exactly like `beats`/`seed`/`rngState`/`lastExchange`/`exchangeN` already are (`comparables.js:64, 92-93, 182`). Add `party` to each comparable's destructure-and-drop list:

```js
// movementComparable (line 64):
export function movementComparable(state) {
  const { beats, seed, rngState, version, party, ...rest } = state;   // ADD party
  if (rest.c) rest.c = stripFlightFields(stripDarkForField(rest.c));
  return rest;
}
// combatComparable (line 92) and economyComparable (line 182): add `party` to the
// same `const { beats, seed, rngState, version, lastExchange, exchangeN, ... }` list.
```

Add a doc-comment block above these mirroring `stripDarkForField`'s (comparables.js:26-40): *"`state.party` is a brand-new engine-only top-level field with no prototype-side equivalent — the frozen prototype-master.js.txt never sets it — a deliberate, permanent divergence, stripped like `beats`."*

**Why it's needed:** the comparables deep-equal `...rest` against the prototype sandbox. The frozen prototype has **no** `party` concept, so an un-stripped engine-side `party` (even `[]`) is an extra key → guaranteed parity failure the moment any fixture touches `newRun`/`meetJoiner`. Stripping it keeps every fixture green.

**Note:** `c.joiner` and `state.combat.ally` are **NOT** stripped and must not be — the prototype master sets them identically, so they compare equal and *guard* fidelity. Only the genuinely-new `state.party` is stripped.

### 2. RNG-order rules (do not shift the frozen draw sequence)

- **Chargen order is frozen** (`character.js` header, lines 16-17). `state.party` is initialized in `newRun` as a **plain `party: []`** — no rng draw — exactly like `darkFor`/`flightLeft` were added as plain assignments (`character.js:200,213`). Safe.
- **`meetJoiner` must not change its rng draws.** It currently consumes: `d10` (level table) → full `rollCharacter(rng)` → `d20` → `d20` (discarded) (`encounters.js:399-403`). This exact sequence is in the frozen master (`prototype-master.js.txt:1762-1763`). To wire the joiner into the party, **capture the already-rolled `joinerChar` into `state.party`** — this adds **zero** rng draws. Keep setting `c.joiner` identically. Result: byte-identical rng stream; only a new (stripped) `state.party` entry appears.
- **Party members acting in combat = new rng draws** (their strike dice, etc.). These MUST be **guarded to fire only when `state.party` is non-empty**, e.g. a `partyTurn` that early-returns like `allyTurn` (`combat.js:648`). Every prototype-parity fixture runs with an **empty** party, so the guard short-circuits → no rng consumed → the frozen combat/afterPlayerAction sequence (`combat.js:601-640`) stays byte-identical. This is precisely the pattern the phobia-Hardiness `rng.d(2)` uses ("fires ONLY in the qualifying situation... never during chargen... RNG consumption order is unchanged for everyone else" — `combat.js:216-219`).
- **Insertion point discipline:** if `partyTurn` is inserted into `afterPlayerAction` (e.g. between `allyTurn` and `foeTurn`), it must be a guarded no-op when party is empty so the ported `foeTurn`/`rollInitiative` call sequence is unchanged for parity fixtures.

---

## Alternatives Considered

| Recommended | Alternative | When The Alternative Would Win |
|-------------|-------------|--------------------------------|
| `state.party` (top-level array) | `c.party` (array on the character) | Never for this engine — joiners are peers, not a property of the player; top-level strips in one place and mirrors `state.combat`. `c.party` would need a per-`c` `stripPartyField` helper (like `stripDarkForField`) and muddies "`c` = the player's sheet". Both are technically viable; top-level is cleaner. |
| Full `rollCharacter` sheet per member | 7-field summary (like today's `c.joiner`) | If joiners were purely cosmetic display. But the milestone explicitly wants "their own sheet/gear/HP" and real party combat → needs the full sheet. The full sheet is already rolled in `meetJoiner`, so it's *cheaper* to keep than to re-derive. |
| Keep `C.ally` + `state.party` separate | Unify `C.ally` into `state.party` now | Only if you accept touching parity-frozen `allyTurn`/`startCombat`/summon code. Not worth it this milestone — unifying risks the frozen `allyStruck`/`allyDeparted`/rng path. Coexist now; unify later behind its own parity review if ever. |
| Default-fill migration (keep v1) | Bump `STATE_VERSION` to 2 + version gate | If a *breaking* shape change lands later. For an additive-with-default field, the version bump buys nothing (old v1 saves still validate) and adds ceremony. |
| Fail-open on malformed party | Reject whole save if any member malformed | Never — one bad joiner should not cost the player their whole in-progress run. Fail-open to `[]` (or drop bad members) matches the codebase's storage posture. |

## What NOT to Use / What NOT to Change

| Avoid | Why | Do Instead |
|-------|-----|------------|
| Any new npm package / Capacitor plugin / native SDK | Violates offline + paid-upfront + zero-SDK constraint (PROJECT.md Constraints; CLAUDE.md). Party is pure plain-data state. | Pure in-engine state + existing `serializeRun`/`mzStorage`. |
| A new storage key for the party | Party is **in-run** state, not cross-run — it belongs in the `SAVE_KEY` blob. A separate key would desync from the run and break the save round-trip. | Ride inside `serializeRun(currentState)` under existing `ddr.delve.v1`. |
| Renaming/reshaping `c.joiner` | Frozen in `prototype-master.js.txt:1762-1763`; renaming breaks parity across every encounter fixture. | Keep `c.joiner` summary as-is; **add** `state.party` alongside it. |
| Touching `C.ally`/`state.combat.ally`, `allyTurn`, or the `allyStruck`/`allyMissed`/`allyDeparted`/`allyJoined` events | Frozen in the master (`:2373-2383, :1836-1837`). Any rng or event-shape change there breaks combat parity. | Add a **separate** guarded `partyTurn`; leave the summon-ally path untouched. |
| Adding rng draws inside `rollCharacter`/`meetJoiner`/`startCombat` for party setup | Shifts the frozen chargen/encounter draw order → breaks chargen + combat parity everywhere. | Init party with plain `party: []`; capture `meetJoiner`'s **already-rolled** character (no new draw); gate all party-combat draws behind non-empty `state.party`. |
| Editing `test/parity/prototype-master.js.txt` to "add" party | It is the immutable golden master. | Strip `state.party` in `comparables.js` instead. |

## Stack Patterns by Variant

**If joiners are permanent party members (persist across floors, permadie):**
- `state.party` holds them for the whole run; members carry `alive`; a dead member stays in the array flagged dead (or is filtered) — decided by permadeath-semantics requirement (proposed-milestone item 6).
- Combat reads `state.party` directly each `partyTurn`.

**If joiners are temporary (leave after N encounters, like `C.ally`):**
- Give each member a `roundsLeft`/`encountersLeft` counter and decrement in `partyTurn` (mirror `allyTurn`'s `--C.ally.rounds`), removing at zero.
- Either way the **state/serialization/parity work is identical** — only the combat-behavior code differs.

**Either variant:** the migration (`validateSave`/`rehydrate` default-fill) and the single `comparables.js` strip are unchanged.

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| New `state.party` field | `STATE_VERSION = 1` (unchanged) | Additive + default-filled; old saves validate unchanged (`validateSave` only rejects *newer*-than-supported versions). |
| `state.party` | `serializeRun` `{...state}` spread | Round-trips automatically; the only load-side edits are the two whitelist defaults. |
| Guarded `partyTurn` rng | Frozen parity master | Byte-identical only while every parity fixture keeps `party` empty — enforce the non-empty guard. |
| `@capacitor/preferences` / `mzStorage` / `storage.js` | unchanged | Party lives inside the existing `SAVE_KEY` JSON; storage layer is agnostic to blob shape. |

## No-New-Dependency Confirmation

**Confirmed: no new npm or native dependency is warranted.** The party system is entirely (a) new plain-data fields on the already-100%-serializable `GameState`, (b) reuse of the existing pure `rollCharacter(rng)`, (c) two default-fill lines in `saveState.js`, (d) one guarded combat function, and (e) one parity strip. It rides the existing `@capacitor/preferences`-backed `mzStorage` save blob with no schema-external storage. This honors the offline / paid-upfront / zero-SDK / "keep the build free of monetization+extra SDKs" constraints (PROJECT.md Constraints; CLAUDE.md) with **zero** additions to `package.json` or the native project.

## Sources

- `engine/character.js:140-218` (`rollCharacter`), `:189` (`joiner:null`) — full serializable sheet + the frozen chargen rng order; the `darkFor`/`flightLeft` plain-assignment precedent (:200,:213) — CONFIDENCE: HIGH (direct read)
- `engine/encounters.js:397-407` (`meetJoiner`) — rolls a full character + 2 discarded d20s, keeps only a 7-field `c.joiner` summary — CONFIDENCE: HIGH
- `engine/combat.js:163-167` (pendingAlly→`C.ally`), `:646-665` (`allyTurn`), `:601-640` (`afterPlayerAction` frozen sequence), `:216-219` (guarded-rng precedent) — CONFIDENCE: HIGH
- `engine/magic.js:100-123` — the Summon `C.ally`/`c.pendingAlly` shape `{lvl,rounds,name}` — CONFIDENCE: HIGH
- `engine/state.js:34-56` (`newRun`) — where `party: []` initializes; plain-assignment top-level fields — CONFIDENCE: HIGH
- `engine/saveState.js:22-24` (`serializeRun` full spread), `:79-138` (`validateSave` explicit whitelist + version gate), `:146-171` (`rehydrate` whitelist) — the migration seam — CONFIDENCE: HIGH
- `src/browser/engineAdapter.js:44-83` (SAVE_KEY vs separate cross-run keys), `:295-331` (boot/persist) — party belongs in the save blob, not a new key — CONFIDENCE: HIGH
- `test/parity/harness/comparables.js:26-40` (`stripDarkForField`), `:53-57` (`stripFlightFields`), `:64,92-93,182` (top-level destructure strips) — the exact carve-out pattern to mirror — CONFIDENCE: HIGH
- `test/parity/prototype-master.js.txt:1762-1763,1836-1837,2373-2383` — `c.joiner`/`C.ally` frozen (do not touch) — CONFIDENCE: HIGH
- `content/misc-tables.js:13,27` (`STRIKE_DICE`, `SPELL_LEVEL_TABLE`) — reusable combat tables — CONFIDENCE: HIGH
- `.planning/PROJECT.md` Constraints, `.claude/CLAUDE.md` — offline/paid-upfront/zero-SDK/serializable-engine constraints — CONFIDENCE: HIGH

---
*Stack research for: single-player Party System ("Joiners") — engine-state, serialization, save-migration, parity*
*Researched: 2026-09-09*
