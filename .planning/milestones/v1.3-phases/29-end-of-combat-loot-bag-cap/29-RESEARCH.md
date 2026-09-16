# Phase 29: End-of-Combat Loot & Bag Cap - Research

**Researched:** 2026-09-16
**Domain:** Engine inventory/combat-drop rules + shell decision-card presentation (no external libraries — pure code-grounded research, no web search performed per phase instructions)
**Confidence:** HIGH (every claim below is `[VERIFIED: direct code read]` or `[VERIFIED: engine run, this session]` unless marked `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pending pile & loot screen (LOOT-01, LOOT-02, LOOT-06)**
- Drops accumulate on a top-level `state.pendingLoot: []` (sibling of `pendingFind`). `engine/combat.js#killFoe` pushes the rolled treasure there INSTEAD of calling `takeItem` — the `rng.d(20) <= 2 + f.lvl` gate and the `rollTreasureItem(rng, depth, c)` draws are unchanged (zero rng change; only the destination of the item changes).
- Unlike `pendingFind` (transient, reset on load), `pendingLoot` IS serialized: `engine/saveState.js` `serializeRun`/`validateSave`/`rehydrate` carry it (tolerant: a pre-v1.3 save without the field loads as `[]`); it is carved out of all three `*Comparable()` fns via a `reconcilePendingLoot` mirror of the existing `reconcilePendingFind` (apply the legacy `takeItem` auto-take of each pending drop onto a CLONE of `c` before comparing — proves the engine offers byte-identically what the prototype auto-took).
- KNOWN PARITY RISK (research must enumerate): in the frozen prototype a strictly-better mid-fight drop was auto-equipped and USED in later rounds; with the pile, the hero fights on with the old gear, so any fixture whose combat continues after such a drop is a genuine action-path divergence (different weapon dice → different rng consumption). Treat each such fixture as a DECLARED divergence with an action-path record and rationale (the Phase 24 `actionPathDivergenceOf` / `stripScenarioDivergence` mechanism), never a blanket regeneration; `test/parity/prototype-master.js.txt` is never edited.
- The loot screen shows when combat ends (`encounterCleared`/`combatEnded`) with `pendingLoot.length > 0`, replacing the "encounter cleared" card; it also re-appears on resume if the pile is non-empty. The existing find card (`pendingFind`) stays for exploration finds.
- Actions (pure, no rng) in `engine/items.js` + `engine/engine.js` dispatch: `takeLoot {i, equip?}`, `leaveLoot {i}`, `takeAllLoot`, `leaveAllLoot`. The screen closes when the pile is empty. Every action emits an event (`lootTaken`, `lootLeft`, and the existing `itemEquipped` when equip-now) — no silent discards.
- Forfeit: fleeing (every `fled` reason) or dying with a non-empty pile clears it and pushes ONE `lootForfeited {items, reason}` event (new event type → `EVENT_NARRATION` entry + toast-table entry, family-friendly sarcastic line, e.g. leaving things on the floor in your hurry not to be on the floor). Amulet of Stone / other combat ends (Phase 31 will add more) show the pile normally.
- The loot screen is a decision surface: like Fight!/Joiner/find cards, its buttons must not be reachable from a D-pad tap (reuse whatever guard those cards have today; the systematic guard redesign is Phase 32).

**Compare-to-equipped & take semantics (LOOT-03)**
- `lootCompare(c, it)` is a pure view-model helper in `src/browser/viewModels.js` (engine stays presentation-free): weapons compare max damage using the SAME rule `takeItem` uses (`WEAPON_MAX[base] + bonus` vs `WEAPON_MAX[c.weapon] + c.prof + c.magicWpn`) → "+2 damage" / "not an upgrade"; armor compares AR and shows durability via Phase 28's `bagArmorText` (`AR 15 vs your AR 6 · 45/45 hp`); class/race-illegal gear reads "can't use (Fighter only)" using the existing `weaponRefusalReason`/`armorRefusalReason` (export or wrap them — one rule, no duplication).
- Taking a weapon/armor offers two buttons: **Equip now** (`takeLoot {i, equip: true}` — a direct swap; the displaced worn piece goes to the bag through the single stow gate, so a slot is needed only when something is displaced; a bare-handed / "Nothing" character needs no slot) and **Stow** (`takeLoot {i}` → bag). Equip now is hidden when the piece is illegal or not an upgrade (the player can still stow and equip later from Gear).
- Class-illegal gear is still takeable to the bag (sellable at the store); only Equip now is hidden.
- Non-gear drops (cloaks, jewelry, staves, lockpicks, special potions): Take = stow; the row shows the item's `txt`. The lockpick duplicate gate stays at roll time (`hasPicks`) as today.

**The single bag-cap gate (LOOT-04)**
- Only gear and treasure consume slots: `slotItems(c)` = `c.items` filtered to `kind !== "potion"`; healing potions (`c.potions`) and scrolls (`c.scrolls`) are already scalars. The "used / slots" readouts (gear panel, find card, loot screen, store) count the same way — one exported helper, no ad-hoc `c.items.length` counts left anywhere in the shell.
- ONE engine helper (planner's naming, e.g. `stowItem(state, it, events)`) is the only path that adds to `c.items` from outside chargen: it checks `slotItems(c).length >= bagCap(c)` → pushes `bagFull {item, have, slots}` and refuses (item stays where it was — pending find/loot untouched, no gold spent); else `giveItem`. Used by `takeFind`, `takeLoot`/`takeAllLoot`, the store paths that land in the bag (`givePotion`, `giveLockpicks`, and any buy that stows), `unequipSlot`, and the Equip-now displacement. Paths that equip directly (a strictly-better store buy via `takeItem`) consume no slot and are not gated.
- `bagFull` feedback: one toast ("Bag full (4/4) — drop something to make room") plus the existing drop-to-make-room shelf from the find card, reused on the loot screen and in the store. The engine never spends gold or discards an item on a refused stow.
- Starting kit: no behavior change (a Thief's single starting cloak ≤ every cap); add a test asserting chargen never exceeds `bagCap` for any class/bag.

**Bigger bags as treasure (LOOT-05)**
- A bigger bag turns up as a loot/find ITEM ("Medium bag (6 slots)" — `kind: "bag"`, `tier`), only ever ONE tier above the bag carried; taking it upgrades `c.bag` immediately (`bagUpgraded {from, to, slots}` event → toast "Bigger bag: 6 slots" + Oracle line in voice); it consumes no slot and is never stowed.
- Depth appropriateness by floor: medium from floor 2, large from floor 5, exlarge from floor 9; never offered below its floor, or when the character already carries that tier or better.
- The new rng draw: ONE extra `rng.d(20)` on a successful treasure drop (a low roll yields the bag instead of the rolled item), fired ONLY behind a guard the parity fixtures never satisfy: `floor.depth >= 2` AND an upgrade is available. Research MUST confirm no parity fixture kills a foe (or opens a chest that reaches the same roll) past floor 1; if any does, use an explicit run-level `state.features.bags` flag set by the shell's `startNewRun` and absent in every bare `newRun(seed)` fixture instead. Either way the new draw sits AFTER the existing draws so nothing upstream shifts.
- The same guarded draw may also apply to exploration finds (`findGear`/`openChest`) if the planner finds it clean; combat drops are the required path.

### Claude's Discretion
- Exact field/action/event names (`pendingLoot`, `takeLoot`, `lootForfeited`, `bagUpgraded`, `stowItem`, `slotItems`) and the loot-screen markup/CSS (reuse the find card's `.enc-head/.enc-sub/.actions/.shelf` pattern).
- Toast/Oracle wording for lootTaken/lootLeft/lootForfeited/bagUpgraded/bagFull (voice: sarcastic, deadpan, family-friendly; safety scan green).
- Whether Take all stops at the first `bagFull` (recommended: take what fits in order, then surface bagFull for the remainder) — must never lose an item.

### Deferred Ideas (OUT OF SCOPE)
- Systematic D-pad mis-tap guard for all decision cards → Phase 32 (CMBUI-04/05); the loot screen reuses today's card guard only.
- Selling/buying bags at the store → Phase 33 store stock if wanted.
- Compare readouts for jewelry/cloak effects (stat deltas beyond txt) — not requested.

### Phase Boundary (from CONTEXT.md)
Out of scope here: the combat narrative/tap-safety rebuild (Phases 30/32 — the loot screen is a decision surface and must not fire from a D-pad tap, but the general guard design lands in Phase 32), store stock randomization (Phase 33), gear-panel Use/Drop layout (Phase 33), any tuning of drop rates beyond the new bag draw.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOOT-01 | Foe drops during combat go into a pending pile instead of being auto-equipped or auto-rejected; no drop is silently discarded | `killFoe`'s exact drop-gate/draw order confirmed (engine/combat.js L558-610); Parity Risk Enumeration proves replacing `takeItem` with a `pendingLoot.push` changes zero rng draws across every fixture |
| LOOT-02 | Loot screen at combat end with take/leave per item + take-all/leave-all | `noteCombat`/`renderEncounter`/`mzCombatReport` flow mapped exactly (mazeworld.html); Pitfall 4 documents the race with the existing "Move on" combat-report card and how to avoid it |
| LOOT-03 | Compare-to-equipped + equip-now vs stow | Exact comparison rules (`takeItem`'s weapon/armor gates), refusal-reason helpers, and Phase 28's `armorDisplay`/`bagArmorText` pattern all identified as the reusable source of truth for `lootCompare` |
| LOOT-04 | One bag-cap gate for every pickup/buy/kit/loot path, potions/scrolls exempt | All current cap-check/count sites enumerated (engine/items.js L386/L521, engine/derived.js#clampCarry L67, mazeworld.html L3015-3016/4953/4973/4980); Pitfall 1 (gold-before-stow) and Pitfall 2 (potions counted) are the two gaps the "one gate" must close |
| LOOT-05 | Bigger bags as depth-appropriate treasure behind a feature guard | Parity Risk Enumeration confirms the `floor.depth >= 2` guard is unconditionally fixture-safe (no fixture fights past depth 1) — the `state.features.bags` fallback CONTEXT proposed is confirmed unnecessary |
| LOOT-06 | Pile survives save/resume; flee/death forfeits it with a narrated line | `saveState.js`'s exact `pendingFind`-reset pattern identified as the template for `pendingLoot`'s carry-through; Pitfall 3 documents why the forfeit hook belongs inside `die()` itself (13+ call sites) rather than at each death-cause site; `flee`'s 3 success-exit sites identified |

</phase_requirements>

## Summary

This phase turns the combat-drop auto-take/auto-reject into a real end-of-combat decision (`state.pendingLoot`), unifies bag-cap enforcement behind one gate, and adds bigger bags as depth treasure. The single most important finding: **the parity-risk enumeration CONTEXT.md asked for comes back clean.** I replayed all six combat/magic parity scenarios that can reach `killFoe` (win/lose/lose-apprentice/flee/parley/cast-damage) through the live, unmodified engine and inspected the actual events returned. Only **one** scenario (`combat/lose`, seed 14) ever rolls a foe drop, and it is a `kind:"jewel"` item (Bracelet of Flight) that today lands in the bag via `giveItem` — never a weapon/armor, never auto-equipped, never used in a later round. This is a pure comparables-only divergence (fixed by a `reconcilePendingLoot` mirror of `reconcilePendingFind`, exactly as CONTEXT anticipated) — **zero action-path divergences exist in the current fixture suite.** No fixture reaches `killFoe` at `floor.depth >= 2` (all combat/magic fixtures fight at depth 1; the one fixture that reaches depth 2 is `movement`'s seed 256, which never fights), so LOOT-05's `floor.depth >= 2 AND upgrade available` guard is safe as specified — **no `state.features.bags` fallback flag is needed.**

The second major finding: `engine/economy.js#buyFrom` deducts gold and marks the stock slot `sold` **before** invoking the `STORE_EFFECTS` handler (`buyWeapon`/`buyArmor`/`buyPremium`/`givePotion`/`giveLockpicks` all call `takeItem`/`giveItem` afterward). Any store path the planner routes through the new bag-cap `stowItem` gate (`giveLockpicks`, and any future stow-only buy) will spend the player's gold even if the stow is refused for a full bag, unless the plan explicitly reorders the check or adds a refund — this is a genuine gap CONTEXT's "no gold spent on a refused stow" promise must account for.

**Primary recommendation:** implement `pendingLoot` as a top-level array sibling of `pendingFind`, pushed to by `killFoe` (replacing its `takeItem` call) with zero rng-order change; gate every stow with one `slotItems(c)`/`stowItem` helper; forfeit via a single hook in `death.js#die` plus `flee`'s three success exits; and fix the store's gold-before-effect ordering as part of LOOT-04's "never spends gold on a refused stow" guarantee.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pending loot pile (accumulate/serialize/forfeit) | Engine (`engine/combat.js`, `engine/items.js`, `engine/death.js`, `engine/saveState.js`) | — | Pure state + rng-order rules; must stay parity-safe and serializable, same tier as `pendingFind` |
| Loot take/leave/equip-now/stow actions | Engine (`engine/items.js` + `engine/engine.js` dispatch) | — | Player-choice inventory actions are pure, no-rng, dispatched via `applyAction` — same tier as `takeFind`/`equipItem` |
| Compare-to-equipped readout (`lootCompare`) | Presentation view-model (`src/browser/viewModels.js`) | Engine (reads `engine/derived.js`/`engine/items.js` pure helpers) | Mirrors the Phase 28 `armorDisplay` precedent: engine stays render-free, the view-model is the ONE place comparison text is computed |
| One bag-cap gate (`slotItems`/`stowItem`) | Engine (`engine/items.js`) | — | Must be a single source of truth every stow path (find/loot/store/unequip) routes through — a UI-layer duplicate would drift |
| Bag-full feedback / drop-to-make-room shelf | Shell (`mazeworld.html`) | Presentation event tables (`toasts.js`/`eventNarration.js`) | Reuses the existing find-card shelf pattern; UI-only rendering of the engine's `bagFull` event |
| Bigger-bag treasure roll | Engine (`engine/combat.js#killFoe`, optionally `engine/encounters.js`) | Content data (`content/bags.js`) | New rng draw behind a fixture-safe guard; the tier table is pure content data |
| Loot screen card (take/leave/take-all/leave-all, equip-now vs stow) | Shell (`mazeworld.html`) | — | Decision surface, same tier and tap-safety class as the find/Joiner/Fight! cards |
| Store gold-vs-stow ordering fix | Engine (`engine/economy.js#buyFrom`) | — | The gold deduction / effect-application order is a pure engine sequencing bug relative to the new gate, not a UI concern |

## Standard Stack

No external libraries apply — this phase is 100% first-party engine/shell code. No `npm install`, no new dependencies, no Package Legitimacy Audit needed (N/A this phase — no external packages installed).

## Package Legitimacy Audit

**N/A — this phase introduces zero external packages.** All new code lives in `engine/*.js`, `src/browser/*.js`, `content/*.js`, and `mazeworld.html`, reusing the project's existing zero-dependency architecture (confirmed: `engine/items.js`, `engine/combat.js`, `engine/economy.js`, `engine/saveState.js` import only sibling engine/content modules — no third-party imports anywhere in the touched surface `[VERIFIED: direct code read]`).

## Architecture Patterns

### System Architecture Diagram

```
Foe dies (killFoe, engine/combat.js)
   │
   ├─ existing draws unchanged: rng.d(6) sp-roll → gainWilmst rng.d(10) coin
   │        → rng.d(20) treasure gate (<=2+f.lvl) → rollTreasureItem(rng, depth, c)
   │              [item roll draws vary by kind: blade/mail/jewel/cloak/staff]
   │        → (NEW, guarded) rng.d(20) bag-swap roll, ONLY if floor.depth>=2
   │              AND an upgrade bag tier is available — replaces the rolled
   │              item with a bag descriptor on a low roll
   │        → Beasts/Lair-Beasts cooking rng.d(6)
   │
   ▼
state.pendingLoot.push(item)      ◄── REPLACES today's takeItem(state, item, events)
   (top-level array, sibling of pendingFind; serialized, unlike pendingFind)
   │
   ▼
combat ends (encounterCleared / afterPlayerAction sees no live foes)
   │
   ├─ shell (noteCombat, mazeworld.html) sees wasCombat && !hasCombat
   │      → if state.pendingLoot.length: render the LOOT SCREEN card
   │        INSTEAD OF window.mzCombatReport's "Move on" beat
   │      → else: unchanged combat-report beat as today
   │
   ▼
Player taps per-item Take/Leave or Take-all/Leave-all (loot screen, mazeworld.html)
   │
   ├─ takeLoot {i, equip?}  ──► engine/items.js: routes through stowItem()
   │        (the ONE bag-cap gate) or, if equip:true, a direct equip-now swap
   │        whose DISPLACED worn piece also goes through stowItem()
   ├─ leaveLoot {i}          ──► splices pendingLoot[i], pushes lootLeft
   ├─ takeAllLoot            ──► takes what fits in bag-cap order, then
   │        surfaces ONE bagFull for the remainder (never loses an item)
   └─ leaveAllLoot           ──► clears pendingLoot, pushes lootLeft per item
                                  (or one batched event — planner's call)
   │
   ▼
pendingLoot.length === 0 → loot screen closes, normal map/report resumes

PARALLEL FORFEIT PATH:
flee() success exit (3 call sites) ──► forfeit pendingLoot (if any) BEFORE
       pushing `fled` ──► lootForfeited{items, reason:"fled"}
die() (ANY cause: combat/trap/starve/potion/backfire/summon/quake/fall/
       gorge/insanity/abandon — ONE function, all callers) ──► forfeit
       pendingLoot (if any) ──► lootForfeited{items, reason:"died"}

SAVE/RESUME:
serializeRun/validateSave/rehydrate ──► pendingLoot round-trips (NOT reset,
       unlike pendingFind/combat/store/beats) ──► shell re-renders the loot
       screen on resume if the pile is non-empty
```

### Recommended Project Structure (files touched, no new directories)

```
engine/
├── combat.js        # killFoe: push to pendingLoot instead of takeItem; NEW guarded bag-swap draw; flee's 3 success exits: forfeit hook; die() call sites unaffected (die() itself owns the forfeit)
├── death.js          # die(): ONE forfeit hook covering every cause
├── items.js           # NEW: slotItems(c), stowItem(state, it, events), takeLoot/leaveLoot/takeAllLoot/leaveAllLoot; bagCap/takeFind/unequipSlot re-routed through slotItems/stowItem
├── economy.js        # buyFrom: reorder gold-deduction vs stow-effect (or refund) so a refused stow never spends gold; STORE_EFFECTS' givePotion/giveLockpicks route through stowItem where they stow
├── engine.js          # dispatch cases: takeLoot/leaveLoot/takeAllLoot/leaveAllLoot
├── saveState.js       # serializeRun (automatic via spread)/validateSave/rehydrate: carry pendingLoot (tolerant default [])
└── encounters.js      # (optional, discretion) same guarded bag-swap draw for findGear/openChest

content/
└── bags.js            # NEW "bag" kind content entries (medium/large/exlarge as takeable items) + floor-tier knobs (2/5/9), documented as tuning knobs

src/browser/
├── viewModels.js      # NEW lootCompare(c, it) — mirrors armorDisplay's single-source-of-truth pattern
├── toasts.js          # NEW/extended: lootTaken, lootLeft, lootForfeited, bagUpgraded toasts; bagFull richer text (have/slots)
└── eventNarration.js  # same new event types, Oracle-log prose; itemUnequipped-destroyed precedent for tone

test/
├── parity/harness/comparables.js   # NEW reconcilePendingLoot (mirrors reconcilePendingFind); pendingLoot stripped/reconciled at all 3 comparables' top-level destructure
├── parity/fixtures/action-script.combat.json  # NO edits needed to seeds/actions (see Parity Risk table) — only comparables.js changes
├── roundtrip/serialize-rehydrate.test.js       # pendingLoot round-trips (unlike pendingFind)
├── unit/save-validation.test.js                 # pendingLoot NOT reset on load/validate (contrast with the existing pendingFind assertion)
├── unit/inventory-actions.test.js (or new file) # takeLoot/leaveLoot/takeAllLoot/leaveAllLoot/stowItem/slotItems pins
├── unit/formatEventsCoverage.test.js            # auto-detects the new literal event types — just needs EVENT_NARRATION entries added
└── voice/safety-scan.test.js                    # new toast/Oracle copy must pass the safety wordlist scan
```

### Pattern 1: Player-choice inventory action (pure, no rng)

**What:** Every carried-item decision (`takeFind`/`leaveFind`/`dropItem`/`equipItem`/`unequipSlot`, and now `takeLoot`/`leaveLoot`/`takeAllLoot`/`leaveAllLoot`) is a pure function taking `(state, ...args, events)`, mutating `state.c`/`state.pendingX` directly, pushing plain `{type, ...}` events, never drawing rng. This is why none of them are fixture-exposed and none need rng-order care.

**When to use:** Any new player decision over the bag.

**Example (existing precedent, `engine/items.js` L382-394):**
```js
// Source: engine/items.js (direct code read)
export function takeFind(state, events = []) {
  const c = state.c;
  const it = state.pendingFind;
  if (!it) return events;
  if ((c.items || []).length >= bagCap(c)) {
    events.push({ type: "bagFull", item: it });
    return events; // keep pending — the player must drop something first
  }
  giveItem(state, it, true, events);
  state.pendingFind = null;
  events.push({ type: "findTaken", item: it });
  return events;
}
```
`takeLoot`/`takeAllLoot` should follow this EXACT shape, but resolve against `state.pendingLoot[i]` and route the capacity check through the new `slotItems(c).length >= bagCap(c)` (see Don't Hand-Roll below) instead of the raw `c.items.length` this snippet still uses today.

### Pattern 2: Additive event-payload flags (no new event type when avoidable)

**What:** Phase 25/28 established the convention of adding new BOOLEAN flags to an EXISTING event's payload (`armorSoaked.underMin`/`.magic`, `itemUnequipped.destroyed`) rather than inventing a new event type, when the underlying event is semantically the same occurrence with a distinguishable outcome.

**When to use:** `bagFull`'s existing payload (`{item}`) should gain `have`/`slots` additively (LOOT-04's richer "Bag full (4/4)" message) rather than becoming a new event — `bagFull` already exists and already has a toast/Oracle entry.

**Example (Source: engine/items.js L522, `engine/combat.js`'s `armorSoaked` push):**
```js
// existing precedent — additive flags via a spread idiom
events.push({ type: "armorSoaked", amount: dmg, wear, ...(underMin ? { underMin: true } : {}), ...(magic ? { magic: true } : {}) });
```

### Pattern 3: Nested-array / new-field parity carve-out

**What:** When a new engine field lives on an array element (not a top-level `state.*`/`c.*` key), `comparables.js` maps the array and rebuilds only the affected elements — `stripBagArmorFields` (Phase 28) is the precedent. A brand-new TOP-LEVEL state field (`pendingLoot`, like `pendingFind`/`pendingJoiner`/`dev` before it) is instead destructured out at each comparable's opening line.

**Example (Source: test/parity/harness/comparables.js L47-52, the exact template for `reconcilePendingLoot`):**
```js
// reconcilePendingFind — the exact template reconcilePendingLoot should mirror
function reconcilePendingFind(rest, pendingFind) {
  if (!pendingFind || !rest.c) return rest;
  const proxy = { c: structuredClone(rest.c) };
  takeItem(proxy, structuredClone(pendingFind), []);
  return { ...rest, c: proxy.c };
}
```
`reconcilePendingLoot(rest, pendingLoot)` should apply `takeItem` for EACH item in the array (in order) onto the same cloned proxy, replicating the prototype's original mid-fight auto-take sequence exactly — this is what proves the engine offers byte-identically what the prototype auto-took, per CONTEXT's locked design.

### Anti-Patterns to Avoid

- **Duplicating the slot-cap check in the shell.** `mazeworld.html` today computes `(c.items||[]).length >= slots` locally in three places (find card, gear panel readout, drop shelf). Phase 29 must NOT add a fourth local computation for the loot screen — bridge ONE `window.__mzSlotItems`/reuse the engine's own gate result (the `bagFull` event already tells the shell exactly when a stow was refused).
- **Checking bag capacity by raw `c.items.length`.** This currently INCLUDES `kind:"potion"` items (special potions like Acuteness), which LOOT-04 explicitly exempts. Every capacity check (`engine/items.js#bagCap` call sites, `engine/derived.js#clampCarry`'s slot clamp, the shell's `s-carry-n`/`bagFull`/find-card/drop-shelf reads) must route through `slotItems(c)`, not `c.items.length`, or the exemption will be inconsistently enforced.
- **Spending gold before confirming the stow succeeds.** See the Common Pitfalls section — `buyFrom` currently deducts gold and marks the item sold BEFORE calling the stow effect.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weapon/armor "is this better than what I have" comparison | A second comparison formula in `viewModels.js` | The EXACT rule `takeItem` already uses: `WEAPON_MAX[base]+bonus` vs `WEAPON_MAX[c.weapon]+c.prof+c.magicWpn` for weapons, `it.ar <= c.ar` for armor (`engine/items.js` L258-266, L283) | Two independently-maintained "is this better" rules WILL drift; `lootCompare` must import/read the same constants and comparison, not restate it |
| Class/race legality text ("can't use — Fighter only") | A new refusal-reason function | `weaponRefusalReason(c, it)` / `armorRefusalReason(c, it)` (`engine/items.js`, already exported, already used by the store/find/equip UI) | These are the Phase 25/24 single-source-of-truth refusal predicates; duplicating them for the loot screen breaks the "one rule" guarantee CONTEXT explicitly calls out |
| Slot-cap enforcement re-implemented per call site | Ad-hoc `(c.items||[]).length >= X` checks scattered across `items.js`/`economy.js`/`mazeworld.html` | ONE `stowItem(state, it, events)` helper (new) built on ONE `slotItems(c)` helper (new) | REQUIREMENTS.md's own grounding paragraph flags this: "The cap is checked at only two sites" TODAY — Phase 29 is explicitly closing every OTHER uncapped path (buy/kit/loot) through one gate |
| Bag-tier upgrade item content | A bespoke one-off object literal at the `killFoe` call site | A `content/bags.js` (or `content/treasure-tables.js`) data table entry per tier, `kind:"bag"`, mirroring `JEWELRY`/`CLOAKS`/`STAVES`'s existing shape | Keeps content pure-data (no closures — `test/determinism/content-is-pure-data.test.js` enforces this project-wide) and keeps the depth-tier numbers a documented, greppable knob beside the existing `BAGS` table comment |

**Key insight:** every "don't hand-roll" item above already has exactly one canonical implementation in this codebase from a prior phase (28's `armorDisplay`, 25's `weaponRefusalReason`, 12's `bagCap`). Phase 29's job is almost entirely "reuse the existing rule, change WHERE the decision surfaces" — very little genuinely new game logic is needed.

## Common Pitfalls

### Pitfall 1: Store gold is deducted before the stow gate can refuse

**What goes wrong:** `engine/economy.js#buyFrom` (L330-344) runs `state.c.gold -= item.cost; item.sold = true;` THEN calls `STORE_EFFECTS[item.effectId](state, item.effectParams, events)`. `givePotion`/`giveLockpicks` currently call bare `giveItem` (uncapped); if the planner routes either through the new `stowItem` gate (needed so lockpicks respect the cap — potions are exempt by LOOT-04 so `givePotion` should stay uncapped), a `bagFull` refusal from `stowItem` would leave the player's gold already spent and the slot marked `sold` with nothing received.

**Why it happens:** `buyFrom` was written before any capacity gate existed on the buy path (Phase 13's ECON-04 gate only ever covered `takeFind`/`unequipSlot`); the deduct-then-effect order was never revisited when Phase 12/13 added bag caps elsewhere.

**How to avoid:** Either (a) check `stowItem`'s capacity predicate BEFORE deducting gold for any `effectId` whose effect stows into the bag (only `giveLockpicks` today — `givePotion`/`buyWeapon`/`buyArmor`/`buyPremium`/`buyScroll`/`buyRations`/`repairArmor` don't need the gate: potions/scrolls/rations are scalar-exempt, weapon/armor/premium buys equip-or-reject via `takeItem` with no slot consumed either way), or (b) refund `item.cost` and un-mark `sold` when `stowItem` returns a `bagFull` refusal. Option (a) is simpler and avoids a new refund code path.

**Warning signs:** A `bagFull` toast firing at the store while the player's gold total has already dropped and the shelf line shows "Sold" — a silent-loss bug exactly of the kind LOOT-04 exists to prevent.

### Pitfall 2: `c.items.length` still counts special potions in three places

**What goes wrong:** `engine/derived.js#clampCarry` (L67), and the shell's `#s-carry-n`/`bagFull` readout (`mazeworld.html` L3015-3016) and find-card/drop-shelf full-bag checks (L4953/4973) all count `(c.items||[]).length` directly — which includes `kind:"potion"` items (special potions like Acuteness, per REQUIREMENTS.md's own grounding paragraph: "special potions (`kind:"potion"`...) ... live in `c.items`"). LOOT-04 requires these NEVER count against capacity.

**Why it happens:** These sites predate the LOOT-04 user rule (2026-09-15) — at the time they were written, nothing in `c.items` was meant to be capacity-exempt.

**How to avoid:** Route every one of these five sites through the new `slotItems(c)` helper (`c.items.filter(it => it.kind !== "potion")`) instead of the raw array length. `clampCarry`'s slot-trim (`c.items.length = cap.slots`) needs special care: it should trim based on `slotItems(c).length > cap.slots`, but the actual splice must preserve potion entries while dropping OVERFLOW gear/treasure entries — a naive `c.items.length = cap.slots` truncation would incorrectly drop trailing potions instead of trailing gear. In practice this is a structural no-op today (chargen kits never exceed caps, confirmed by CONTEXT's own planned test), but it is a latent correctness gap once bag-upgrade items exist as loot (a character who takes a bigger bag then later somehow exceeds the OLD cap transiently) — flag it, low urgency, fix if the planner's `slotItems` refactor naturally reaches this line.

**Warning signs:** A character carrying an Acuteness potion sees their capacity readout show one fewer usable slot than the cap advertises.

### Pitfall 3: `pendingLoot` forfeiture is not automatically covered by every `die()` caller

**What goes wrong:** `die(state, cause, ...)` (`engine/death.js` L90) is called from 13+ sites across `combat.js`/`encounters.js`/`items.js`/`magic.js`/`movement.js`/`engine.js` (trap, maze, insanity, potion, backfire, summon, quake, fall/gorge, starve, abandon, plus normal combat death). If the forfeit logic is added at each CALL SITE instead of inside `die()` itself, a future ninth death cause will silently skip the forfeit.

**Why it happens:** Death is scattered by design (every rule domain can end a run), but there is exactly ONE terminator function (`die()`) all of them funnel through — the SAME reason `state.combat = null` and `deathAt`/`epitaph` are set unconditionally inside `die()` rather than at each call site.

**How to avoid:** Add the `lootForfeited` check as the FIRST or LAST thing `die()` does (mirrors how `state.combat = null` is unconditional there), not at any of the 13 call sites. This also automatically covers the one plausible non-combat edge case: a multi-foe fight where an earlier kill populated `pendingLoot`, then the hero dies to a LATER foe in the SAME fight (`combat.js` L1555, `die(state, "combat", ...)`) before ever seeing the loot screen.

**Warning signs:** A `test/unit/formatEventsCoverage.test.js`-style audit or a manual death-path test showing `pendingLoot` still populated on a `dead:true` save.

### Pitfall 4: The loot screen racing the "Move on" combat-report card

**What goes wrong:** `noteCombat` (`mazeworld.html` L5888-5924) currently ALWAYS builds `state.beats` from `window.mzCombatReport(data)` when combat ends normally (not dead/won/fled). If the loot screen is added as a SEPARATE `renderEncounter()` branch without suppressing this, the player would see the "Move on" combat-report card, dismiss it, and THEN see the loot screen — violating CONTEXT's "replacing the encounter cleared card" requirement and CMBUI's (Phase 32) "no dismiss-then-continue chains" spirit even before that phase lands.

**Why it happens:** `noteCombat` was written before any post-combat decision surface other than a passive summary existed.

**How to avoid:** In `noteCombat`'s `wasCombat && !has` branch, check `after.pendingLoot && after.pendingLoot.length` and skip setting `after.beats` (still fine to compute `mzCombatReport`'s HP/gold/kills numbers and merge them INTO the loot screen's header text as flavor, at the planner's discretion, but the "Move on" card itself must not show first).

**Warning signs:** A device-tester sees an extra tap between combat ending and the loot decision.

## Parity Risk Enumeration (measured, this session)

Every combat/magic parity scenario that can reach `killFoe` was replayed through the **live, unmodified engine** (`newRun`/`applyStartCombat`/`applyAction`, the exact harness `test/parity/harness/comparables.js#applyStartCombat` and `test/parity/harness/fixtureRoster.js` use) and every returned event inspected for `foeKilled`/`itemTaken`/`itemRejected`/`itemGiven`. Method: a scratch script (not committed — created in a repo-root `.research-scratch/` directory, executed, then deleted; `git status --porcelain` confirmed clean afterward) drove each scenario's exact fixture action list and logged events per action.

| Fixture | Scenario | Seed | Kills a foe? | Drop gate (`rng.d(20)<=2+f.lvl`) fires? | Item kind | Auto-equipped? | Used in a later round? | Divergence class |
|---|---|---|---|---|---|---|---|---|
| combat | win | 3 | yes (action 1, Shriek) | NO (no item event) | — | — | — | none |
| combat | lose | 14 | yes (action 5 Bat/Rat, action 8 Shriek) | YES at action 5 only | `jewel` (Bracelet of Flight) | N/A (jewel is never an equip slot — goes via `giveItem`) | N/A — not equipment | **comparables-only** (`reconcilePendingLoot`) |
| combat | lose-apprentice | 127 | NO — character dies without landing a killing blow | never reached | — | — | — | none |
| combat | flee | 17 | NO — flees before any kill | never reached | — | — | — | none |
| combat | parley | 303 | NO — parley ends combat without a kill | never reached | — | — | — | none |
| magic | cast-damage | 8 | yes (action 1, Shriek via Freeze→killFoe) | NO (no item event) | — | — | — | none |

**Verdict: zero action-path divergences.** The ONE fixture-exposed drop (seed 14's jewel) is a non-equipment item that already goes through `giveItem` today (not `takeItem`'s weapon/armor branch) — moving it into `pendingLoot` instead changes WHERE it lives in `state`, not any rng draw or downstream mechanic, and the character's remaining actions in that scenario (3 more scripted attacks) never reference it. This is resolved exactly the way CONTEXT.md anticipated: a `reconcilePendingLoot` mirror of `reconcilePendingFind`, applying the legacy `takeItem` auto-take onto a cloned `c` before comparing. **No fixture needs a declared action-path divergence record; `test/parity/prototype-master.js.txt` needs no changes; no fixture JSON needs edits.**

**LOOT-05 guard safety (measured, cross-referenced with `test/parity/FIXTURE-INVENTORY.md`):** every combat/magic parity fixture starts and fights at `floor.depth === 1` (confirmed both by the table above — all `startCombat` actions fire at the default `newRun(seed)` depth — and by `FIXTURE-INVENTORY.md`'s own "every fixture starts a level-1 character on floor 1" analysis). The only fixture that ever reaches `floor.depth >= 2` is the `movement` fixture (seed 256, descends to floor 2) — which never calls `startCombat`/`killFoe` at all (confirmed: no `foeKilled`/combat events possible in a pure-movement script; `content/encounters.js` and the movement path never reference `BESTIARY`). **Conclusion: the `floor.depth >= 2 AND an upgrade tier is available` guard, exactly as CONTEXT specifies, is unconditionally fixture-safe.** The fallback `state.features.bags` flag CONTEXT proposed as a contingency is **not needed** — implement the simpler floor-depth guard directly.

## Runtime State Inventory

Not applicable — this is a greenfield feature phase (new engine state/actions/content), not a rename/refactor/migration phase. No runtime state (external services, OS registrations, secrets) is touched.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `takeAllLoot` should "take what fits in order, then surface `bagFull` for the remainder" (CONTEXT's own recommended default, not yet locked as a requirement) | Architecture Patterns / dispatch | Low — CONTEXT explicitly marks this "Claude's Discretion", planner can lock it as written |
| A2 | The Amulet of Stone / future non-death/non-flee combat-end paths (Phase 31) should show the loot pile normally rather than forfeiting it — inferred from CONTEXT's own note ("Amulet of Stone / other combat ends ... show the pile normally") but Phase 31 doesn't exist yet to verify against | Architecture Patterns | Low — Phase 31 is out of scope; this phase just needs to not special-case Amulet of Stone (it already routes through the same `endCombat`/`encounterCleared` path as an ordinary win, confirmed structurally since it's not a `die()`/`flee()` exit) |
| A3 | `clampCarry`'s slot-trim (Pitfall 2) is low-urgency and can be left as a documented gap rather than fixed this phase, since no current or newly-added path can make it observably wrong | Common Pitfalls | Low — if wrong, a rare edge case (potion trimmed instead of gear) surfaces only after a bag-upgrade-then-overflow sequence that doesn't exist in v1 content yet |

**If this table is empty:** N/A — three low-risk assumptions logged above, none blocking.

## Open Questions

1. **Should the loot screen's header show the `mzCombatReport` summary numbers (rounds/HP/gold/kills) merged with the take/leave list, or should those two cards stack (report first, then loot)?**
   - What we know: CONTEXT says the loot screen "replac[es] the 'encounter cleared' card" — singular, implying ONE card.
   - What's unclear: whether "replacing" means the report's flavor text (kills/HP/gold) is lost entirely, or folded into the loot screen's own header.
   - Recommendation: fold the report's existing summary line(s) into the loot screen's header (reuse `mzCombatReport`'s already-computed `data` object), then list the pending items below — one card, no information lost, no extra tap.

2. **Does `takeAllLoot` emit one batched event or N individual `lootTaken` events?**
   - What we know: CONTEXT requires "no silent discards" and that Take-all "must never lose an item."
   - What's unclear: whether the Oracle log should show N lines or one summary line for a multi-item take-all.
   - Recommendation: emit one `lootTaken` event per item taken (consistent with `findTaken`'s one-item shape and the `formatEventsCoverage` guard's per-type narration requirement) plus, if any didn't fit, the existing `bagFull` event for the remainder — matches the take-all-stops-at-first-bagFull default in CONTEXT's Claude's Discretion section.

3. **Where exactly does the new bag-swap `rng.d(20)` draw sit relative to `checkLevel`'s own possible draws inside `killFoe`?**
   - What we know: CONTEXT says it must sit "AFTER the existing draws so nothing upstream shifts" and `checkLevel(state, rng, events)` is the LAST call in `killFoe` (L608) and may itself draw rng on a level-up.
   - What's unclear: whether the guarded bag-swap draw belongs before or after `checkLevel`'s call.
   - Recommendation: place it immediately after the treasure-item block (right after the `rollTreasureItem`/`takeItem`→`pendingLoot.push` line, before the Beasts/Lair-Beasts cooking check) — this is the natural "resolve what dropped" position and keeps it adjacent to the code it modifies; since the guard is always false on every parity fixture, its exact position relative to `checkLevel` cannot affect any fixture regardless.

## Sources

### Primary (HIGH confidence — direct code read, this session)
- `engine/combat.js` (`killFoe` L558-610, `flee` L684-740+, `pursuitStrike` L628-666, the combat-death `die()` call L1555) — drop-gate order, flee/die call sites
- `engine/items.js` (full file: `takeItem` L255-304, `bagCap` L323, `wornArmorItem`/`wornWeaponItem` L327-372, `takeFind`/`leaveFind`/`dropItem`/`equipItem`/`unequipSlot` L382-539, `rollTreasureItem` L154-164, `weaponRefusalReason`/`armorRefusalReason` L208-232)
- `engine/economy.js` (`STORE_EFFECTS` L195-225, `openStore` L236-321, `buyFrom` L330-344 — gold-deduction ordering)
- `engine/engine.js` (full dispatch switch L52-133)
- `engine/encounters.js` (`offerFind` L166-170, no `BESTIARY` references confirmed)
- `engine/saveState.js` (full file: `serializeRun`, `isValidCharacter`/`isValidFloor`, `validateSave` L145-215, `rehydrate` L217-255+)
- `engine/death.js` (full file: `die` L90-113, `bury`)
- `engine/derived.js` (`clampCarry` L63-70)
- `engine/state.js` (`STATE_VERSION` L33, `newRun` signature L137)
- `content/bags.js` (full file — BAGS tiers)
- `test/parity/harness/comparables.js` (`reconcilePendingFind` L47-52, `stripBagField`/`stripBagArmorFields`/`stripCloakArmorTxt` L87-178, `movementComparable`/`combatComparable`/`economyComparable` top-level destructures)
- `test/parity/harness/fixtureRoster.js` (full file — `applyStartCombat`/replay pattern used to build the parity-risk scratch script)
- `test/parity/FIXTURE-INVENTORY.md` (full file — depth-1-only confirmation, roster/draw-count baselines)
- `test/parity/fixtures/action-script.combat.json` (scenario/seed/action definitions)
- `mazeworld.html` (`hasActiveEncounter` L4703, find-card L4940-4993, `renderEncounter` L4795-4938, `endCombat`/`afterPlayerAction`/dead classic-script combat sim L4395-4460 confirmed DEAD CODE, `noteCombat`/`dispatchWithToasts` L5888-5967, `engineCombatAction`/`mzAttack`/`mzFight`/`mzFlee` L6441-6491, `mzCombatReport` L2733-2752, carry/capacity readout L3009-3016)
- `src/browser/viewModels.js` (`armorDisplay`/`bagArmorText` pattern, imports from `engine/derived.js`)
- `src/browser/toasts.js` (`CARD_EVENTS` L65, `bagFull`/`itemTaken`/`itemRejected`/`itemGiven` entries L1240-1252)
- `src/browser/eventNarration.js` (`findOffered`/`findTaken`/`findLeft`/`bagFull` entries L599-608)
- `test/unit/formatEventsCoverage.test.js` (coverage-guard derivation strategy, header comment)
- `test/unit/inventory-actions.test.js` (existing test-naming/shape conventions for pure inventory actions)
- `.planning/config.json` (`nyquist_validation: false`, `security_enforcement: false` — both optional sections correctly omitted below)
- `.planning/phases/28-armor-integrity-durability/28-0{1,2,3}-SUMMARY.md` (Phase 28 landed surface: `left`/`patches`, `stripBagArmorFields`, `armorDisplay`/`bagArmorText`, `window.__mzArmorDisplay`)
- Live engine replay, this session (`newRun`/`applyStartCombat`/`applyAction` against seeds 3/14/127/17/303/8) — the Parity Risk Enumeration table above; scratch script created and deleted in `.research-scratch/`, confirmed via `git status --porcelain` (clean) that no repo file was left modified
- `npm test` run this session: **1485/1485 passing** (matches the Phase 28 baseline exactly — confirms no drift before Phase 29 work begins)

### Secondary / Tertiary
None — no web search was performed per this phase's explicit "no external libraries; do not web-search" instruction; every claim above is grounded in this repository's own source or a live, reproducible engine run.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no external stack — pure internal engine/shell work)
- Architecture: HIGH — every integration point (killFoe, flee, die, engine.js dispatch, saveState.js, comparables.js, mazeworld.html's renderEncounter/noteCombat) was read directly, not inferred
- Parity risk: HIGH — measured via a live, reproducible engine replay this session, not reasoned about from seeds
- Pitfalls: HIGH — Pitfall 1 (gold-before-effect ordering) and Pitfall 2 (potions counted in capacity) are both confirmed by direct code read, not speculation

**Research date:** 2026-09-16
**Valid until:** Until the next engine-touching phase lands (this codebase's engine surface changes fast — treat as valid for Phase 29's planning/execution window only, ~7-14 days)
