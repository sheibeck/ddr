# Phase 28: Armor Integrity & Durability - Research

**Researched:** 2026-09-15
**Domain:** Code-grounded audit of the existing armor soak/wear/UI pipeline (no external libraries; this is an internal-consistency and refactor phase)
**Confidence:** HIGH — every claim below is a direct code read (file:line), not inference. Where a claim is a synthesis/judgment call, it is marked `[ASSUMED]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Soak-vs-wear ruling (ARMOR-01) — KEEP CANON**
- Keep "d20 ≤ AR soaks the whole blow" — rulebook p.44 ("Using Armor") and the frozen prototype (`mazeworld.html` ~L4464) agree verbatim; no parity divergence, no fixture regeneration.
- Keep the canon wear charge: the full blocked damage is charged to durability when dmg > the armor's Min; nothing when dmg ≤ Min.
- Keep the Dwarven half-wear trait (Phase 24 IDENT-09, already a declared divergence).
- Keep 04.2 (E8)'s Cloak of Armor ruling: never-wearing magic Plate, take-the-better of AR 15 / pool 45 against the worn piece (`engine/derived.js#armorSoak`), recorded as the documented interpretation of the rulebook's "acts as an equivalent to a full suit of plate armor … weighs no more than leather".
- **User addition:** the cloak counts as player armor for ANYONE who can equip a cloak — no Fighter-only Plate class gate applies to the cloak's plate (a Thief or Magic User carrying it soaks as Plate). Today's `armorSoak` already ignores class; keep it that way and say so in the item text.
- Record the whole ruling as a Key Decision in PROJECT.md ("Armor soak-vs-wear: canon kept; cloak = never-wearing plate for any carrier"). Because nothing about the soak/wear math changes, no fixture regenerates and no new divergence record is needed for ARMOR-01 itself.

**Durability on the item (ARMOR-03) — MINIMAL MODEL**
- The WORN piece keeps today's character scalars (`c.armorWP`, `c.armorMax`, `c.patches`). The combat soak block, camp mending, and store repair stay untouched → parity stays byte-identical with no engine soak change.
- When a piece LEAVES the body (`unequipSlot`, or the swap inside `equipItem`), the bag item it becomes carries its remaining durability and patch count (naming is the planner's discretion; must be carved out of all three `*Comparable()` fns via the existing strip-field pattern). `wornArmorItem` currently rebuilds the piece at full `c.armorMax` — that IS the exploit; it must carry `left`/`patches` instead.
- `equipItem` restores `c.armorWP = it.left ?? it.wp` and `c.patches = it.patches ?? 0` (instead of resetting to full). `c.armorMax` stays the item's `wp`.
- Fresh pieces always start at full: store buy, foe drop (`takeItem`), starting kit, treasure/magic armor. Only a piece that has been worn carries a `left` value. No random pre-wear (no new rng).
- Destroyed armor (armorWP 0) is GONE: unequipping/swapping a destroyed piece clears the slot with no bag copy. The existing `armorDestroyed` event already narrates the moment it breaks.
- Save migration is a tolerant read only: a pre-v1.3 bag armor without `left` reads as full (`left ?? wp`); no migration pass; `validateSave`/`rehydrate` need no new required field.

**Toast ↔ panel truth (ARMOR-02, ARMOR-05)**
- Root-cause with a reproduction test FIRST: drive `applyAction` through a soaked foe hit (scripted rng) and assert the `armorSoaked` toast's `wear` equals the durability delta on the displayed armor. Then close every suspect found in the code read.
- Durability is displayed EVERYWHERE armor is named, through ONE shared formatter (view-model/helper level, not ad-hoc string building): sheet ARMOR tile → `PLATE · AR 15 · 6/45 hp`; gear panel worn row; bag armor rows (`left/max hp`); store repair line.
- Unit label is "hp" everywhere (unify "wp"/"hp" mismatches).
- Four outcomes distinguishable on screen via ADDITIVE payload flags on the existing `armorSoaked` event (no new event types): soaked-with-wear; soaked-without-wear (`underMin: true`); magic-plate soak (`magic: true`); armor giving out (existing `armorDestroyed`). Both `src/browser/toasts.js` and `src/browser/eventNarration.js` read the flags. The Dwarven `halved` flag stays.

**Cloak of Armor legibility (ARMOR-04)**
- Item text states the rule plainly: soaks as Plate (AR 15) over whatever you wear, never wears out, any class.
- Effective-armor readout everywhere (sheet tile + gear worn row): `CLOAK OF ARMOR · AR 15 · magic plate, never wears`, with the piece underneath listed as e.g. "under the cloak: Leather 9/15 hp". Derived from `armorSoak(c)` — one source of truth shared with the engine's soak site.
- The cloak stays a carried bag item (no equip step, no armor-slot record, no Fighter gate).
- Repairs (store, camp mending) apply to the worn piece underneath, unchanged; the cloak never needs repair.

### Claude's Discretion
- Exact serialized field names for remaining durability / patches on bag items, and the shared formatter's location (a `viewModels.js` helper is the established pattern).
- Exact toast/Oracle wording for the four outcomes (voice: sarcastic, deadpan, family-friendly; must pass `test/voice/safety-scan.test.js`).
- Whether the sheet tile and the gear worn row share one HTML snippet or two calls to the same formatter.

### Deferred Ideas (OUT OF SCOPE)
- Removing foe-drop auto-equip / auto-reject entirely → Phase 29 (LOOT-01).
- Random pre-wear on dropped armor ("a bit rusty") — new rng draw, not requested.
- Repairing bag (unworn) pieces at the store — not requested; repair stays worn-piece-only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARMOR-01 | Audit soak-vs-wear against prototype/rulebook, record keep/change decision, declare any parity divergence | Confirmed byte-for-byte agreement between rulebook p.44, the DEAD classic-script reference at `mazeworld.html` L4464, and the LIVE `engine/combat.js` soak block. No divergence needed — see "Soak/Wear Rule Audit" below. |
| ARMOR-02 | Toast `wear` and gear panel/sheet always agree; root-cause the discrepancy with a pinning test | Root cause identified precisely: `mazeworld.html` L2954 (`#s-arm`, live `paint()`) never displays durability at all. Two OTHER live displays (`#s-kit` L2967, gear worn row L3036) already show it correctly. See "Root Cause: Toast/Panel Discrepancy" below. |
| ARMOR-03 | Durability carried on the item; kills the re-equip exploit; parity-carved; save-tolerant | Exact minimal-diff locations identified in `engine/items.js` (`wornArmorItem` L351-364, `equipItem` L443-459, `unequipSlot` L473-497) plus a SEPARATE, currently-undocumented bug: `wornArmorItem`'s null-guard does not check `armorWP<=0`, so a destroyed piece is NOT actually "gone" today. See "The Exploit and the Destroyed-Armor Gap" below. |
| ARMOR-04 | Cloak of Armor item text + effective-armor UI readout | `content/treasure-tables.js` L30 is the live source (mazeworld.html L1815's CLOAKS table is dead/frozen reference only); `armorSoak(c)` (`engine/derived.js` L231-242) is the existing single source of effective armor to reuse for the UI readout. No test pins the exact `txt` string — safe to rewrite. |
| ARMOR-05 | Four armor outcomes distinguishable on screen | `armorSoaked`/`armorDestroyed` toast+narration sites and their pinning tests fully mapped; additive-flag pattern (`halved`) already precedents this exact approach (Phase 19 D-18). See "Event/Toast/Narration Wiring" below. |
</phase_requirements>

## Summary

This is a pure code-consistency phase: no new libraries, no new mechanics, just closing a real display bug and a real data-model exploit inside an existing, well-tested engine. The soak/wear MATH is already canon-correct and does not need to change (ARMOR-01 is a documentation exercise, not a code change). The actual bugs are narrower and more mechanical than the phase description suggests:

1. **The "toast says wear / panel shows no damage" bug** is not a state bug — `c.armorWP` updates correctly and two of three live armor displays already show durability. The bug is that the game's most prominent HUD readout — the compact "Armor" stat line at `mazeworld.html` L2954 (`#s-arm`, written every `paint()` call) — was NEVER wired to show durability, only `name (AR n)`. A player watching that one line sees zero visible change on every hit, no matter how much wear lands. This is a one-line-of-intent bug hiding behind a three-display architecture (compact stat row, "kit" list, gear panel) that was never unified.

2. **The re-equip full-repair exploit** is real and precisely where CONTEXT.md says it is: `wornArmorItem()` (`engine/items.js` L351-364) always reconstructs a swapped-out piece at `wp: c.armorMax` (full), and `equipItem`'s armor branch (L443-459) always resets `c.armorWP = it.wp` (the item's max) on equip. Unequip → re-equip (or unequip → equip something else → re-equip the original) fully repairs any piece for free.

3. **A second, currently-undiscussed gap sits right next to the exploit fix**: `wornArmorItem`'s guard (`!(c.ar > 0)`) does not check `c.armorWP <= 0`. Because `engine/combat.js`'s armor-destroy path (L1500) only zeroes `c.armorWP`, never `c.ar`/`c.armor`/`c.armorMax`, a piece destroyed IN COMBAT still passes `wornArmorItem`'s guard — unequipping a "destroyed" armor today would reconstruct it as a full-durability bag item. This is the SAME root cause as the exploit and must be closed by the same edit (add an `armorWP<=0` check to `wornArmorItem`'s null-return), or ARMOR-03's "destroyed armor is gone" success criterion silently fails.

4. Cloak of Armor's `txt` field lives in exactly one LIVE source (`content/treasure-tables.js` L30) and is unpinned by any test — safe to rewrite freely for ARMOR-04.

5. The event/toast/narration wiring for the four outcomes is additive and low-risk: `armorSoaked` already carries a `halved` flag (Phase 19 precedent) that both `toasts.js` and `eventNarration.js` read conditionally — `underMin`/`magic` flags follow the identical pattern, and three existing pinning tests (`feedback-payload.test.js` L356-389, L603-610) already assert only PRESENT fields, so they stay green untouched.

**Primary recommendation:** Fix the display bug at `mazeworld.html` L2954 and the exploit/destroyed-gap together in `engine/items.js`, both via ONE shared armor-display formatter (new `viewModels.js` helper reading `armorSoak(c)`); add the `underMin`/`magic` payload flags to the existing `armorSoaked` event; carve the new bag-item fields out of all three parity comparables with a NEW nested-array strip helper (no precedent exists for stripping fields *inside* `c.items[]` — see "Parity Carve-Out Pattern Gap" below); and record the ARMOR-01 ruling as a Key Decision with no fixture regeneration.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Soak roll, wear/durability math | API/Backend (engine) | — | `engine/combat.js#applyFoeDamageToPlayer` is the ONE soak site; pure, deterministic, rng-injected |
| Effective armor (worn vs. cloak plate) | API/Backend (engine) | — | `engine/derived.js#armorSoak(c)` is the single source of truth; UI must READ it, never re-derive |
| Durability persistence on bag items | API/Backend (engine) | Database/Storage (save/load) | `engine/items.js` equip/unequip mutators own the transfer; `engine/saveState.js` only needs a tolerant read, no schema change |
| Armor display (sheet, gear panel, bag rows, store) | Browser/Client (DOM) | API/Backend (view-model) | `src/browser/viewModels.js` should own ONE formatter function; `mazeworld.html`'s DOM-writing functions (`paint()`, gear panel renderer) consume it — never re-derive the string inline |
| Toast/Oracle narration of the 4 outcomes | Browser/Client | API/Backend (event payload) | Engine emits additive flags on `armorSoaked`/`armorDestroyed`; `src/browser/toasts.js` + `src/browser/eventNarration.js` render them — no new event types |
| Parity comparables (bag-item field carve-out) | API/Backend (test harness) | — | `test/parity/harness/comparables.js` is a test-only concern; a new field on `c.items[]` needs a NEW nested-strip helper (no existing helper strips inside array elements) |

## Standard Stack

Not applicable — this phase touches only first-party engine/UI code already in the repository. No new npm packages, no external libraries. `npm view`/package-legitimacy checks are not applicable.

## Package Legitimacy Audit

Not applicable — no external packages are installed or proposed by this phase.

## Architecture Patterns

### Data Flow: A Soaked Hit, Today

```
Foe swings (engine/combat.js#applyFoeDamageToPlayer)
   │
   ├─ armorSoak(c) [engine/derived.js] ─── reads c.ar/c.armorWP/c.armorMin/c.armorMax
   │                                        OR eff(c,"cloakArmor") → Plate AR15/wp45
   │
   ├─ d20 ≤ av.ar? ── NO → dmg lands on c.wp (unchanged path)
   │        │
   │       YES (onArmour = true)
   │        │
   │        ├─ av.magic (cloak present)? ── YES → wear = 0, c.armorWP UNCHANGED, no armorDestroyed ever
   │        │                                NO  → dmg > av.min? ── YES → wear = min(c.armorWP, dmg*armorWear)
   │        │                                                              c.armorWP -= wear
   │        │                                       NO (dmg ≤ min) → wear = 0, c.armorWP UNCHANGED
   │        │
   │        └─ c.armorWP <= 0 (and !magic)? → events.push(armorDestroyed)   ⚠ does NOT reset c.ar/c.armor/c.armorMax
   │
   └─ events.push({type:"armorSoaked", name, amount:blocked, wear, halved?})
              │
              ├─ src/browser/toasts.js#armorSoaked  → "Armour takes N · wear N"
              ├─ src/browser/eventNarration.js#armorSoaked → Oracle log line
              │
              └─ window.paint() re-renders the HUD from the SAME state.c —
                     ├─ #s-arm  (mazeworld.html L2954) → c.armor + " (AR n)"        ⚠ NEVER shows durability
                     ├─ #s-kit  (mazeworld.html L2967) → "AR n · x/y hp" / "destroyed"  ✓ correct
                     └─ gear worn row (L3036)          → "AR n · x/y hp" / "destroyed"  ✓ correct
```

### Recommended Project Structure (no new files needed; extend existing ones)
```
engine/
├── items.js          # wornArmorItem/equipItem/unequipSlot — carry left/patches; add armorWP<=0 null-guard
├── combat.js          # applyFoeDamageToPlayer — add underMin/magic flags to armorSoaked payload (additive)
├── derived.js         # armorSoak(c) — already the single source; UI formatter should call THIS, not re-derive
src/browser/
├── viewModels.js      # NEW: armorDisplay(c) or similar — the ONE shared formatter (sheet/gear/bag/store all call it)
├── toasts.js          # armorSoaked/armorDestroyed — read new underMin/magic flags
├── eventNarration.js  # armorSoaked/armorDestroyed — read new underMin/magic flags
mazeworld.html
├── paint() (~L2954, ~L2967)     # #s-arm, #s-kit — both call the new shared formatter
├── gear panel worn row (~L3036) # calls the new shared formatter
├── renderCarriedList (~L3479)   # bag armor rows — stop reading it.txt for armor; call the formatter with it.left/it.patches
content/
├── treasure-tables.js # L30 Cloak of Armor — rewrite txt to state the rule plainly
test/parity/harness/
├── comparables.js     # NEW nested-strip helper for c.items[].left/.patches (no existing precedent for in-array strips)
```

### Pattern 1: Single-Source Effective-Armor Formatter
**What:** One pure function, e.g. `armorDisplay(state)` in `src/browser/viewModels.js`, that reads `armorSoak(c)` (already engine-side truth) plus the worn piece's raw fields, and returns a render-ready object: `{ label, ar, current, max, destroyed, magic, underlyingLabel? }`.
**When to use:** Every site that currently builds an armor string ad-hoc: `#s-arm`, `#s-kit` row, gear panel worn row, bag armor row, store repair line, and (if reused later) `characterSheetViewModel`'s ARMOR stat tile.
**Why:** Mirrors the project's own established pattern (`damageBracket(c)` ↔ `weaponDamage()` in `engine/derived.js` — see `src/browser/viewModels.js` L20-27 doc comment) — a pure, DOM-free, rng-free helper that the engine's OWN soak math can never disagree with, because both read `armorSoak(c)`.
**Example (sketch, not prescriptive):**
```javascript
// Source: pattern mirrors src/browser/viewModels.js damageBracket(c) (existing)
import { armorSoak } from "../../engine/derived.js";

export function armorDisplay(c) {
  const av = armorSoak(c); // engine's own single source of truth
  if (av.magic) {
    return { label: "CLOAK OF ARMOR", ar: av.ar, text: "magic plate, never wears",
             underLabel: c.armor !== "Nothing" ? `under the cloak: ${c.armor} ${c.armorWP}/${c.armorMax} hp` : null };
  }
  if (!(c.ar > 0) || c.armor === "Nothing") return { label: "NOTHING", ar: 0, text: null };
  if (c.armorWP <= 0) return { label: c.armor.toUpperCase(), ar: c.ar, text: "destroyed" };
  return { label: c.armor.toUpperCase(), ar: c.ar, text: `${c.armorWP}/${c.armorMax} hp` };
}
```

### Pattern 2: Additive Event Payload Flags (Phase 19/25 precedent)
**What:** Add `underMin`/`magic` boolean flags to the EXISTING `armorSoaked` event rather than introducing new event types.
**When to use:** Any time a new OUTCOME is a variant of an already-narrated event, not a new kind of thing happening.
**Example (existing precedent, verbatim from the codebase):**
```javascript
// Source: engine/combat.js L1498-1503 (existing `halved` flag, Phase 19/24 IDENT-09)
events.push({
  type: "armorSoaked",
  name: foe.name,
  amount: blocked,
  wear,
  ...(R.armorWear && wear > 0 ? { halved: true } : {}),
});
```
The same `...(condition ? { flag: true } : {})` spread pattern extends cleanly to `underMin`/`magic`.

### Anti-Patterns to Avoid
- **Ad-hoc string building at each display site:** the CURRENT bug (`#s-arm` never showing durability) exists precisely because armor text is hand-built independently at 4+ call sites instead of going through one formatter. Do not repeat this by hand-editing `#s-arm`'s string in isolation — route it through the new shared formatter along with every other site.
- **Reading `c.ar`/`c.armorWP` directly in UI code when the cloak is present:** any UI site that reads the worn scalars directly (instead of `armorSoak(c)`) will show the WRONG effective armor when a Cloak of Armor is carried. `armorSoak(c)` is not optional plumbing — it is the only place cloak-vs-worn "take-the-better" logic lives.
- **Resetting `c.ar`/`c.armor`/`c.armorMax` on combat-destroy to "fix" the exploit:** `[ASSUMED]` this is tempting (it would mirror `encounters.js`'s "-All armour" table wipe) but is NOT required by CONTEXT.md's locked decisions and would touch the combat soak block itself (currently untouched, parity-safe). The locked, minimal fix is entirely in `wornArmorItem`'s null-guard (add `c.armorWP <= 0` to the condition) — leave `c.ar`/`c.armor`/`c.armorMax` as-is after a combat destroy; the sheet/gear UI's "destroyed" branch already keys off `armorWP<=0`, not off `c.ar`/`c.armor` being cleared.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Effective armor (worn vs. cloak plate) | A second "what's my real armor" calculation in the UI layer | `engine/derived.js#armorSoak(c)` | Already exists, already the engine's own soak-site truth; a duplicate UI calc WILL eventually drift (this is arguably how the original bug happened) |
| Armor display string | Per-site string templates (`AR ${ar} · ${wp}/${max} hp`, repeated 4+ times with slightly different unit labels) | One `viewModels.js` formatter | The "hp" vs "wp" unit-label inconsistency across `#s-kit`/gear-row ("hp") vs bag `it.txt` ("wp") is a symptom of exactly this duplication |
| Parity carve-out for the new bag field | Inline destructuring at each of the 3 `*Comparable()` call sites | A new named strip helper following `stripBagField`/`stripFlightFields`'s doc-comment convention | Keeps the carve-out rationale documented in ONE place and machine-greppable, matching every other divergence in the file |

**Key insight:** Every bug this phase closes traces back to the SAME root cause — a value that should have one authoritative source (`armorSoak(c)` for effective armor; `c.armorWP` for durability) instead got re-derived or re-initialized independently at 3-4 call sites. The fix pattern is uniform: consolidate reads through `armorSoak(c)` and a single formatter; consolidate the durability transfer through `wornArmorItem`/`equipItem` alone.

## Parity Carve-Out Pattern Gap

**Important finding not covered by the existing strip-field precedents:** every existing carve-out in `test/parity/harness/comparables.js` (`stripBagField`, `stripFlightFields`, `stripDarkForField`, `stripFoeEffectField`, `stripNameField`) strips a TOP-LEVEL scalar field directly off `c` (e.g. `c.bag`, `c.darkFor`). **None of them strip a field nested inside an array element** (`c.items[i].left`, `c.items[i].patches`). The planner must author a NEW helper, e.g.:

```javascript
// Sketch — no direct precedent exists; follows the stripBagField doc-comment convention
function stripBagArmorFields(c) {
  if (!c || !Array.isArray(c.items)) return c;
  const items = c.items.map((it) =>
    it && it.kind === "armor" ? (({ left, patches, ...rest }) => rest)(it) : it
  );
  return { ...c, items };
}
```

**Confirmed via code read + `npm test`:** `equipItem`/`unequipSlot`/`takeFind`/`leaveFind`/`dropItem` are — per `engine/items.js`'s own header comment (L313-318) — "inherently parity-safe (no fixture drives them)" today; a grep of `test/parity/fixtures/*.json` for `"equipItem"`/`"unequipSlot"` returns zero matches. So this new strip helper is a STRUCTURAL tripwire (like Phase 19's `stripFoeAbilityState`, added even though "no fixture is exposed to it") rather than a fix for a currently-failing fixture. It must still be added to all three `*Comparable()` functions per the Engine Gate, and it costs nothing today (no-op on every fixture).

## Soak/Wear Rule Audit (ARMOR-01)

**Rulebook (p.44, "Using Armor"):** d20 ≤ AR → the blow lands on armor instead of the character; if the blocked damage is above the armor's Min, subtract it from armor WP; at 0 WP, permanently destroyed, may not be repaired.

**Frozen prototype reference** (`mazeworld.html` L4461-4470, inside `foeTurn()`):
```javascript
// Source: mazeworld.html L4461-4470 (classic <script>, DEAD CODE at runtime — see below)
if (S.c.armorWP > 0 && S.c.ar > 0 && !ignores) {
  const soak = D(20);
  if (soak <= S.c.ar) {
    onArmour = true; blocked = dmg;
    if (dmg > S.c.armorMin) S.c.armorWP = Math.max(0, S.c.armorWP - dmg);
    dmg = 0;
    if (S.c.armorWP <= 0) say(`<span class="miss">Your ${S.c.armor.toLowerCase()} is destroyed.</span>`);
  }
}
```

**LIVE engine** (`engine/combat.js` L1467-1503, `applyFoeDamageToPlayer`): [VERIFIED: direct code read] — same d20-≤-AR gate, same `dmg > av.min` wear-charge condition, same `Math.max(0, ...)` floor. The only additions beyond the frozen prototype are (a) `armorSoak(c)` for cloak-as-plate (documented DELIBERATE RULES CHANGE, 04.2/E8, already recorded) and (b) the Dwarven `armorWear` half-wear multiplier (documented DELIBERATE RULES CHANGE, Phase 24/IDENT-09, already recorded). Both are pre-existing, already-declared divergences — **no new divergence is introduced by keeping this rule as-is.**

**Is the classic-script combat path (`mazeworld.html` ~L4419-4474, `foeTurn()`) reachable at runtime? NO — confirmed dead code.** [VERIFIED: direct code read, mazeworld.html L5477-6470] Every live combat button (`mzAttack`, `mzFlee`, `mzParley`, `mzSing`, `mzCastSpell`, `mzDrinkPotion`, `mzReadScroll`) calls `engineCombatAction()` (L6399), which calls `dispatchWithToasts()` → `dispatch()` (from `src/browser/engineAdapter.js`) → `applyAction()` → `engine/combat.js`. A large doc comment at L6389-6402 explicitly confirms this ("combat/magic/camp actions now route through the SAME dispatch()->applyAction() seam... the classic mazeworld.html functions of the same name... duplicated this logic against Math.random()-backed D() rather than the persisted GameState's seeded rngState"). The classic script's `startCombat`/`playerStrike`/`foeTurn`/`killFoe` functions still exist as source text (used by `window.__mzClassicBoot()` for one-time chargen bootstrapping only) but are NEVER invoked for actual combat resolution. `test/parity/prototype-master.js.txt` (a SEPARATE frozen file, not `mazeworld.html` itself) is the actual parity reference — it is never edited and is not affected by anything in this phase.

**Recommendation for ARMOR-01:** No code change to the soak/wear math. Write the Key Decision to `PROJECT.md`'s Key Decisions table (format: `| Decision | Rationale | Outcome |`, see existing rows) as: *"Armor soak-vs-wear: canon kept (d20≤AR soaks whole blow; wear charged only above Min; Cloak of Armor = never-wearing plate for any carrier) — Rationale: prototype/rulebook already agree byte-for-byte, changing it would be tuning, not a fidelity fix — Outcome: [fill after phase closes]"*. No fixture regenerates.

## Root Cause: Toast/Panel Discrepancy (ARMOR-02)

**The bug, precisely:** `mazeworld.html` L2954, inside `paint()` (the LIVE render function called after every `engineCombatAction()`):
```javascript
// Source: mazeworld.html L2954 — the compact "Armor" stat line (#s-arm, markup at L1429)
document.getElementById("s-arm").textContent = c.armor + (c.ar ? ` (AR ${c.ar})` : "");
```
This NEVER references `c.armorWP`/`c.armorMax` — it is architecturally incapable of showing wear, no matter how correct the underlying state is. `state.c.armorWP` DOES update correctly (confirmed: `engine/combat.js` L1497 mutates it directly, and `paint()` re-reads live `S.c` on every call — there is no state-sync bug).

**Two OTHER live displays already show durability correctly** and are NOT part of the bug:
- `mazeworld.html` L2967 (`#s-kit` row, same `paint()` function, further down): `` c.armorWP > 0 ? `AR ${c.ar} · ${c.armorWP}/${c.armorMax} hp` : "destroyed" ``
- `mazeworld.html` L3036 (gear panel worn row): identical pattern to L2967.

**One display is static/stale by construction (separate finding, relevant to ARMOR-03's item-carried durability):** `renderCarriedList` (`mazeworld.html` L3479-3508) prints `it.txt` for every bag row (L3502: `` `<i>${it.txt ?? ""}</i>` ``) — a string baked in ONCE when the item entered the bag (e.g. `"AR 15, 45 hp"` from `wornArmorItem`'s L362 or `takeItem`'s equivalent). Once bag items carry live `left`/`patches`, this row must be changed to call the shared formatter with `it.left`/`it.patches`, not print the frozen `it.txt`.

**A separate, ROLL-SCREEN-ONLY display was misidentified as "live" in CONTEXT.md's suspect list** [correction of CONTEXT.md's suspect #1] — `src/browser/viewModels.js#characterSheetViewModel`'s ARMOR stat (L97: `` `${c.armor.toUpperCase()} · AR ${c.ar}` ``) is called from EXACTLY ONE site: `mazeworld.html` L6152, inside the character-ROLL reveal screen (before a run starts, at full durability). It is NOT re-rendered during live play. This is still worth fixing (for consistency and because ARMOR-04 wants an effective-armor readout that could reuse this view-model in the future), but it is not the mechanism behind the user's observed live-play bug. **Pitfall for the planner:** `test/unit/characterSheetViewModel.test.js` L44 and L142 PIN the exact string `` `${c.armor.toUpperCase()} · AR ${c.ar}` `` — any change to this stat's value shape must update both assertions in the same commit.

**Recommendation for ARMOR-02:** Write the pinning/reproduction test FIRST as CONTEXT.md specifies: drive `applyFoeDamageToPlayer` (or a full `applyAction` "attack" round) with scripted rng that lands a soaked hit above Min, then assert `armorSoaked.wear === (before.c.armorWP - after.c.armorWP)` AND that a NEW shared formatter's output for `after.c` reflects that same delta. Then wire `#s-arm` through the new formatter (this is the actual fix for the reported bug), and update `renderCarriedList`'s armor-row branch to use live `left`/`patches` instead of `it.txt`.

## The Exploit and the Destroyed-Armor Gap (ARMOR-03)

**Exploit, exact location** (`engine/items.js`):
```javascript
// Source: engine/items.js L345-364 — wornArmorItem, THE exploit's root
function wornArmorItem(c) {
  if (!c.armor || c.armor === "Nothing" || !(c.ar > 0)) return null;
  // ...
  return {
    kind: "armor", n: c.armor, armor: c.armor, ar: c.ar,
    wp: c.armorMax,        // ⚠ always FULL, never c.armorWP
    min: c.armorMin, cls: base ? base.cls : "FTM",
    txt: `AR ${c.ar}, ${c.armorMax} hp`,
  };
}
```
```javascript
// Source: engine/items.js L443-459 — equipItem's armor branch, the OTHER half of the exploit
if (it.kind === "armor") {
  // ...
  const worn = wornArmorItem(c);   // swapped-OUT piece rebuilt at full (see above)
  c.armor = it.armor; c.ar = it.ar; c.armorMin = it.min;
  c.armorMax = it.wp; c.armorWP = it.wp;   // ⚠ swapped-IN piece ALWAYS reset to full, even if it.left < it.wp
  c.patches = 0;
  if (worn) c.items[i] = worn; else c.items.splice(i, 1);
  events.push({ type: "itemEquipped", item: it, slot: "armor" });
  return events;
}
```
`unequipSlot` (L473-497) calls `wornArmorItem(c)` too, so it shares the exact same bug — no separate fix needed there once `wornArmorItem` is corrected.

**Minimal fix (per CONTEXT.md's locked "minimal data model"):**
1. `wornArmorItem(c)`: change `wp: c.armorMax` → add `left: c.armorWP, patches: c.patches`.
2. `equipItem`'s armor branch: change `c.armorWP = it.wp` → `c.armorWP = it.left ?? it.wp`; change `c.patches = 0` → `c.patches = it.patches ?? 0`.
3. `takeItem`'s armor branch (L277-295, store buy / foe drop / starting kit) is UNCHANGED — it always sets `c.armorWP = it.wp` (full), which is CORRECT per CONTEXT.md ("fresh pieces always start at full... no random pre-wear"). Do not touch `takeItem`.

**Second gap, found during this audit, adjacent to but distinct from the exploit — the "destroyed armor is gone" success criterion is not actually satisfied by the exploit fix alone:**
```javascript
// Source: engine/combat.js L1500 — the ONLY state mutation on armor destruction
if (!av.magic && c.armorWP <= 0) events.push({ type: "armorDestroyed" });
// note: c.ar, c.armor, c.armorMax are NOT reset here — only c.armorWP was already zeroed above
```
`wornArmorItem`'s guard is `!(c.ar > 0)` — it does **not** check `c.armorWP <= 0`. Since combat-destroy never resets `c.ar`, a piece destroyed mid-fight still has `c.ar > 0` afterward, so `wornArmorItem` would happily reconstruct it as a bag item — and with the exploit fix in place, it would carry `left: 0` (not full, so NOT the same bug) but it would still EXIST as a takeable bag item, contradicting "destroyed armor is GONE... may not be repaired... no bag copy." **Required additional fix:** `wornArmorItem`'s null-guard must ALSO check `c.armorWP <= 0`, e.g.:
```javascript
if (!c.armor || c.armor === "Nothing" || !(c.ar > 0) || c.armorWP <= 0) return null;
```
This is a one-line change but is load-bearing for ARMOR-03's success criterion 2 and is NOT called out explicitly in CONTEXT.md's decision text — flag it to the user/planner as a necessary corollary of the locked "destroyed armor is gone" rule, not scope creep.

Contrast with `engine/encounters.js`'s "-All armour" table wipe (L306-312), which DOES fully reset `c.armor = "Nothing"; c.ar = 0; c.armorWP = 0; c.armorMax = 0` — this is a pre-existing, different code path (a random dungeon-table hazard, not combat destruction) and is UNCHANGED/unaffected by this phase; it is shown here only to illustrate that a "fully reset" pattern already exists in the codebase for comparison, and that combat's destroy path deliberately does less (which is fine, per the anti-pattern note above — do not widen combat's destroy path to match this, that would touch the soak block itself).

**Existing test to extend, not break:** `test/unit/combat.test.js` L665-673 asserts `state.c.armorWP === 0` after a destroy but does NOT assert anything about `c.ar`/`c.armor` — safe to add a NEW assertion here (or a new test) proving `wornArmorItem`-driven unequip of that same state returns `null`/no bag item, without touching the existing assertions.

**Existing equip/unequip tests, all using FULL armorWP (`armorWP === armorMax`) — will not catch the exploit and stay green as-is, but should be extended with partial-durability cases:**
- `test/unit/inventory-actions.test.js` L160-168 ("equips an INFERIOR legal armor and swaps the worn piece back") — uses `armorWP: 45` (full, `armorMax: 45`). Add a companion test with `armorWP: 20, armorMax: 45` asserting the swapped-out bag item carries `left: 20`, not `wp: 45`.
- `test/unit/inventory-actions.test.js` L214-222 ("unequipSlot: returns worn armor to the bag") — uses `armorWP: 15, armorMax: 15` (full). Add a partial-durability variant plus a destroyed-armor variant (`armorWP: 0`) asserting NO bag item is added and the event set reflects a bare slot with nothing stowed.

**Save/round-trip:** `engine/saveState.js#isValidCharacter` (L34-46) checks only `wp`/`maxWP`/`level`/`skills` — it does NOT validate `c.items` shape at all, and `migrateCarry` (L99+) only defaults `c.bag`. **No `validateSave`/`rehydrate` change is needed** — confirmed by direct read, matching CONTEXT.md's claim. The tolerant read (`it.left ?? it.wp`) belongs entirely at the POINT OF USE (the new shared formatter, and `equipItem`'s restore line above) — a pre-v1.3 save's bag armor (no `left` field) naturally reads as full via that `??`. No existing `test/roundtrip/*` test exercises `c.items` at all — the planner should add ONE new roundtrip/unit test proving a bag armor item with `left`/`patches` survives a JSON round-trip, and ONE proving a `left`-less legacy item reads as full on equip.

## Event/Toast/Narration Wiring (ARMOR-02, ARMOR-05)

**Current shape** (`engine/combat.js` L1494-1507):
```javascript
// Source: engine/combat.js L1494-1507 — current armorSoaked payload
if (!av.magic && dmg > av.min) {
  const rawWear = R.armorWear ? Math.ceil(dmg * R.armorWear) : dmg;
  wear = Math.min(c.armorWP, rawWear);
  c.armorWP = Math.max(0, c.armorWP - rawWear);
}
dmg = 0;
if (!av.magic && c.armorWP <= 0) events.push({ type: "armorDestroyed" });
// ...
events.push({
  type: "armorSoaked", name: foe.name, amount: blocked, wear,
  ...(R.armorWear && wear > 0 ? { halved: true } : {}),
});
```

**Four outcomes and how each currently reaches this event (or doesn't):**
1. **Soaked-with-wear** (`dmg > av.min`, `!av.magic`): `wear > 0` today — already distinguishable via `wear` truthiness. No new flag strictly needed, but CONTEXT.md's wording implies explicit clarity in text.
2. **Soaked-without-wear** (`dmg <= av.min`, `!av.magic`): TODAY indistinguishable from outcome 3 (magic) — both produce `wear: 0` with no other signal. **Needs new `underMin: true` flag**, set at the `else` of the `dmg > av.min` check.
3. **Magic-plate soak** (`av.magic`): TODAY also produces `wear: 0` with no signal — **needs new `magic: true` flag**, set from `av.magic` directly.
4. **Armor giving out**: already fully distinct — separate `armorDestroyed` event, already narrated (`toasts.js` L1047, `eventNarration.js` L353).

**Toast site** (`src/browser/toasts.js` L1048-1053):
```javascript
armorSoaked: (e) => ({
  text: `Armour takes ${e?.amount ?? 0}${e?.wear ? ` · wear ${e.wear}` : ""}${e?.halved ? " (Dwarven, halved)" : ""}`,
  tone: "hit", priority: PRIORITY.them,
}),
```
**Narration site** (`src/browser/eventNarration.js` L354-355):
```javascript
armorSoaked: (e) =>
  `Your armor takes ${e.amount ?? 0} from ${e.name ?? "it"} so you do not have to.${e.wear ? ` It costs the armour ${e.wear}.` : ""}${e.halved ? " Dwarven steel takes the hit — half the wear." : ""}`,
```
Both need `underMin`/`magic` branches added following the exact same `${e?.flag ? "..." : ""}` conditional-suffix idiom already used for `halved`. **No new `EVENT_NARRATION` entry is needed** (armorSoaked already has one) — confirmed no coverage-guard change required (`test/unit/formatEventsCoverage.test.js` has no armor-specific entries to update; it is a generic completeness guard over the exported maps).

**Pinning tests that will stay green (additive-safe, confirmed by reading their exact assertions):**
- `test/unit/feedback-payload.test.js` L356-366 (Dwarven `wear`/`halved`), L368-377 (Human `wear`, no `halved`), L379-389 (magic cloak `wear: 0`, no `halved`) — none of these assert the ABSENCE of `underMin`/`magic`, so adding those flags does not break them. The L379-389 test is a natural place to ADD an assertion that the new `magic: true` flag is now also present.
- `test/unit/feedback-payload.test.js` L603-610 (`EVENT_NARRATION.armorSoaked` wear/halved rendering) and L622-640 (bare-`{type}` coverage sanity) — same additive safety.

**Voice/safety scan:** `test/voice/safety-scan.test.js` (header comment L1-30) auto-scans the EXPORTED `EVENT_NARRATION` map and every content `txt` bank (including cloaks) by iterating exported structures — **no test edit is required** to cover new toast/Oracle strings for the four outcomes or the rewritten Cloak of Armor `txt`; they are covered automatically once authored.

## Cloak of Armor Content (ARMOR-04)

**Live source, single location:**
```javascript
// Source: content/treasure-tables.js L30
{ n: "Cloak of Armor", eff: { cloakArmor: 1 }, txt: "a full suit of plate that weighs nothing" },
```
`mazeworld.html` L1815 has an IDENTICAL entry inside the classic script's `CLOAKS` table — this is DEAD/frozen reference text only (part of the classic script's `rollCloak()`, itself unreachable for the same reason `foeTurn()` is unreachable — see ARMOR-01 section). `test/parity/prototype-master.js.txt` L207 also has the identical string as part of the frozen golden master — **never edit this file.**

**No test pins the `txt` string.** Confirmed via grep across `test/**`: only `content/treasure-tables.js` L30, `mazeworld.html` L1815 (dead), and `test/parity/prototype-master.js.txt` L207 (frozen, untouched) contain "weighs nothing"/"Cloak of Armor" as flavor text; every test reference to "Cloak of Armor" (`test/unit/combat.test.js` L500-505, `test/unit/economy.test.js` L81/L294-297, `test/unit/identity-contract.test.js` L703, `test/unit/item-wiring.test.js` L275-283) asserts on `n`/`kind`/sell-price behavior, never on `txt`. **Free to rewrite `content/treasure-tables.js` L30's `txt` to state the rule plainly** (per CONTEXT.md: "soaks as Plate (AR 15) over whatever you wear, never wears out, any class").

**UI readout:** should be derived from `armorSoak(c)` (see Pattern 1 above) — `armorSoak` already correctly ignores class (confirmed: `engine/derived.js` L231-242 has no class check anywhere in the function), matching the user's addition ("the cloak counts as player armor for ANYONE who can equip a cloak").

## Common Pitfalls

### Pitfall 1: Fixing the display bug at the wrong site
**What goes wrong:** A planner reads CONTEXT.md's suspect list and edits `characterSheetViewModel`'s ARMOR tile (`src/browser/viewModels.js` L97), believing that's the live in-game display the user saw.
**Why it happens:** The doc comment above `characterSheetViewModel` genuinely says "the HERO tab's... render-ready data," which reads as "the live sheet." In fact it is invoked from exactly one call site — the roll-reveal screen (`mazeworld.html` L6152) — not the persistent in-game sheet.
**How to avoid:** The actual live "Armor" stat during play is written by `paint()` at `mazeworld.html` L2954 into `#s-arm`. Fix THAT site (via the shared formatter) for the reported bug; update `characterSheetViewModel` too for consistency/ARMOR-04 reuse, but know it is a SEPARATE, lower-stakes fix.
**Warning signs:** A fix that only touches `viewModels.js` and adds no changes to `mazeworld.html`'s `paint()` function has not actually closed the reported bug.

### Pitfall 2: Treating "destroyed armor is gone" as already covered by the exploit fix
**What goes wrong:** Carrying `left`/`patches` through `wornArmorItem` is assumed to also make destroyed armor disappear on unequip, since `left` would be `0`.
**Why it happens:** The exploit fix and the destroyed-gap fix touch the SAME function (`wornArmorItem`) and look like one change.
**How to avoid:** `wornArmorItem`'s null-guard must independently check `c.armorWP <= 0` — see "The Exploit and the Destroyed-Armor Gap" above. Without this, a destroyed piece with `left: 0` still becomes a REAL, visible (if durability-0) bag item — contradicting "destroyed armor is gone... no bag copy."
**Warning signs:** A test that unequips a destroyed armor (`armorWP: 0`) and finds `state.c.items.length === 1` (a `left: 0` item was added) instead of `0`.

### Pitfall 3: Breaking the "hp" unit-label unification silently
**What goes wrong:** CONTEXT.md requires "hp" everywhere, but `wornArmorItem`'s `txt` field (L362) currently bakes in `"AR n, ${max} hp"` — actually wait, this one already says "hp." The REAL inconsistency is `equipItem`'s armor branch has no `txt` regeneration on swap (it reuses whatever `wornArmorItem` produced), and the STORE's repair line (`economy.js` L255) uses `"points"` not "wp"/"hp" at all — but its DISPLAY label at L281-282 (`buyArmor` stock entry) uses `` `AR ${a.ar}, ${a.wp} hp` `` — already "hp." **Actual unit mismatch found:** none in the engine layer; the CONTEXT.md's claim of a "wp" vs "hp" split refers to the OLD `wornArmorItem` shape before this phase's changes are made — verify post-edit that no stray `"wp"` string survives in a NEW `txt`/label built during this phase.
**How to avoid:** Grep for the literal string `` `${...} wp` `` in any NEWLY authored code in this phase; there should be none — "hp" is the sole unit token per CONTEXT.md.

### Pitfall 4: Forgetting the nested-array parity strip
**What goes wrong:** The planner adds `left`/`patches` to bag items and updates ONLY the top-level `c.*` strip functions (mirroring `stripBagField`), missing that the new fields live INSIDE `c.items[]` elements, which none of the existing strip helpers reach into.
**Why it happens:** Every existing precedent (`stripBagField`, `stripFlightFields`, etc.) strips a top-level scalar; there is no existing "strip a field from every array element" helper to copy-paste.
**How to avoid:** Author a NEW helper (sketch provided above under "Parity Carve-Out Pattern Gap") and wire it into `movementComparable`, `combatComparable`, AND `economyComparable` (all three, per the Engine Gate) even though no current fixture drives an equip/unequip action — this is a structural tripwire, matching the project's own precedent (`stripFoeAbilityState`, Phase 19, added for a then-zero-fixture-exposure reason).

### Pitfall 5: `structuredClone` and item shape
**What goes wrong:** `applyAction`'s clone-before-mutate discipline (project-wide) means any bag item object must remain plain JSON — no functions, no `undefined` values inside item objects (structuredClone throws on functions; `undefined` properties are silently dropped, which is usually fine but can surprise an equality assertion in a test).
**How to avoid:** When adding `left`/`patches` to a bag item, always assign a concrete number (`c.armorWP`, `c.patches`), never `undefined` — this already matches the existing pattern (`patches: 0` is always a number, never omitted).

## Code Examples

### Reading effective armor for a UI display (the pattern to replicate everywhere)
```javascript
// Source: engine/combat.js L1477 (existing, the engine's own soak-site read)
const av = armorSoak(c);
if (av.wp > 0 && av.ar > 0 && !ignores) { /* ... */ }
```
Any new UI formatter should call `armorSoak(c)` identically — never read `c.ar`/`c.armorWP` directly when the cloak might be present.

### Additive event payload flag (exact existing precedent to mirror for `underMin`/`magic`)
```javascript
// Source: engine/combat.js L1498-1503 (existing `halved` flag — Phase 19/24 IDENT-09)
events.push({
  type: "armorSoaked",
  name: foe.name,
  amount: blocked,
  wear,
  ...(R.armorWear && wear > 0 ? { halved: true } : {}),
});
```

### Bag item null-guard for a bare slot (existing pattern to extend, not replace)
```javascript
// Source: engine/items.js L352 (existing) — extend with `|| c.armorWP <= 0`
if (!c.armor || c.armor === "Nothing" || !(c.ar > 0)) return null;
```

## State of the Art

Not applicable in the traditional sense (no external library/ecosystem shift). The relevant "before → after" is internal:

| Before (today) | After (this phase) | Why Changed |
|--------------|------------------|--------------|
| Durability lives only on `c.armorWP` (character scalar); swapped-out armor always reconstructed at full | Durability transfers via `left`/`patches` on the bag item when it leaves the body | Kills the unequip→re-equip full-repair exploit (ARMOR-03) |
| `#s-arm` shows only `name (AR n)`, no durability | `#s-arm` (and every other armor display) routed through one shared formatter showing current/max | Closes the reported "toast says wear, panel shows no damage" bug (ARMOR-02) |
| `armorSoaked` distinguishes only `wear>0` vs `wear===0` (2 states, but 3 real causes collapse into "wear===0") | `underMin`/`magic` flags make all 4 outcomes distinct | ARMOR-05 |
| Cloak of Armor `txt` is vague flavor ("a full suit of plate that weighs nothing") with no stated mechanic | `txt` states the AR/never-wears/any-class rule plainly | ARMOR-04 |

**Deprecated/outdated:** N/A.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Combat's `armorDestroyed` path should NOT reset `c.ar`/`c.armor`/`c.armorMax` (only `wornArmorItem`'s guard needs the `armorWP<=0` check) — this is a judgment call about minimal-diff scope, not a directly-stated CONTEXT.md rule | "Anti-Patterns to Avoid" / "The Exploit and the Destroyed-Armor Gap" | If wrong, and the user actually wants combat-destroy to fully clear the worn slot (like "-All armour" does), the sheet/gear panel would show "Nothing" instead of "PLATE · destroyed" after a combat kill — a legitimate alternative design the planner should confirm with the user during plan review if unsure |
| A2 | The unit-label inconsistency CONTEXT.md describes ("bag `txt` says wp — unify") refers to `wornArmorItem`'s pre-phase `txt` field or an equivalent site not fully identified in this read; no LIVE "wp" label was found that needs unifying beyond what's already "hp" | "Common Pitfalls" Pitfall 3 | Low risk — worst case the planner double-checks and finds nothing to change, costing a few minutes |

**If this table is empty:** N/A — two low/medium-risk assumptions logged above; both are judgment calls about scope boundary, not disputed facts about current code behavior (all code-behavior claims in this document were directly verified by reading the cited file:line).

## Open Questions

1. **Should the shared armor formatter live in `src/browser/viewModels.js` (ES module, importable by the trailing `<script type="module">`) or as a plain function bridged onto `window.*` for the classic script's `paint()` to call directly?**
   - What we know: `paint()` is part of the classic (non-module) script and cannot use ES `import`; the project's established bridge pattern (`window.__mzBags`, `window.__mzNightlyEats`, etc., all set inside the trailing `<script type="module">` block, mazeworld.html L5477+) is exactly how `viewModels.js`-authored logic already reaches the classic script.
   - What's unclear: the exact bridge variable name to introduce.
   - Recommendation: author the formatter in `viewModels.js` (consistent with `characterSheetViewModel`/`grimoireViewModel`), bridge it onto `window.__mzArmorDisplay` (or similar) inside the module script, and call it from `paint()`, the gear panel renderer, and `renderCarriedList`. This is the planner's discretion per CONTEXT.md.

2. **Does `equipItem`'s armor branch need its `txt`/label field on the swapped-OUT `wornArmorItem` result to also reflect the "hp" unit and current durability for display in the bag, or is that solely the shared formatter's job (with `it.txt` becoming vestigial/removed for armor)?**
   - What we know: `renderCarriedList` currently prints raw `it.txt`; once the formatter exists, the bag row should call the formatter with the item's `left`/`patches`/`ar`/`max` rather than the frozen `txt` string.
   - What's unclear: whether `txt` should be removed entirely from armor bag items or kept as a fallback for non-armor consumers of the same rendering path (weapons still use `it.txt` legitimately).
   - Recommendation: keep `it.txt` on armor items for any non-display consumer that might read it structurally (none found in this audit, but low cost to retain), but have `renderCarriedList`'s `kind === "armor"` branch call the shared formatter instead of printing `it.txt` directly.

## Environment Availability

Skipped — this phase touches only in-repo JS/HTML with no new external dependency, service, or CLI tool. `npm test` (Node's built-in `node:test` runner) is already confirmed available and green (1448/1448, verified via direct run during this research).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` + `node:assert/strict` |
| Config file | none — plain `node --test` convention; run via `npm test` |
| Quick run command | `node --test test/unit/combat.test.js test/unit/inventory-actions.test.js` (or the specific new/edited files) |
| Full suite command | `npm test` (currently 1448/1448 passing, ~15.7s, confirmed by direct run 2026-09-15) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARMOR-01 | Soak/wear math unchanged; ruling documented | doc-only (no test) | — | N/A — PROJECT.md edit, not code |
| ARMOR-02 | Toast `wear` matches displayed durability delta | unit (pinning/repro) | `node --test test/unit/combat.test.js` (new test) | ❌ Wave 0 — new reproduction test needed |
| ARMOR-02 | Shared formatter renders durability correctly (current/destroyed/magic) | unit | `node --test test/unit/viewModels-armor.test.js` or extend `characterSheetViewModel.test.js` | ❌ Wave 0 — new formatter has no test file yet |
| ARMOR-03 | `wornArmorItem`/`equipItem` carry `left`/`patches`, not full | unit | `node --test test/unit/inventory-actions.test.js` (extend existing) | ✅ file exists, extend with partial-durability + destroyed cases |
| ARMOR-03 | Re-equip does not repair (the exploit is closed) | unit | `node --test test/unit/inventory-actions.test.js` (new test) | ✅ file exists, add test |
| ARMOR-03 | Parity comparables carve out the new bag-item fields | parity (structural, no-op today) | `npm test` (runs `test/parity/full-suite.test.js`) | ❌ Wave 0 — new strip helper needed in `comparables.js` |
| ARMOR-03 | Pre-v1.3 save (no `left`) reads as full on equip | unit/roundtrip | `node --test test/roundtrip/serialize-rehydrate.test.js` (extend) or new unit test | ❌ Wave 0 — no existing test covers `c.items` round-trip |
| ARMOR-04 | Cloak `txt` states the rule; effective-armor UI readout derives from `armorSoak(c)` | unit | `node --test test/unit/combat.test.js` (extend L500 area) | ✅ file/test exists, extend |
| ARMOR-05 | `underMin`/`magic` flags present on `armorSoaked`; toast/Oracle render distinctly | unit | `node --test test/unit/feedback-payload.test.js` (extend L356-389, L603-610) | ✅ file exists, extend |
| ARMOR-05 | New strings pass the safety scan | voice (auto-covering) | `node --test test/voice/safety-scan.test.js` | ✅ auto-covers new copy with zero edits |

### Sampling Rate
- **Per task commit:** the specific extended/new unit test file(s) for that task
- **Per wave merge:** `npm test` (full suite — the Engine Gate requires this stays 100% green with no fixture regeneration for ARMOR-01/03)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] A new reproduction/pinning test in `test/unit/combat.test.js` (or a new file) proving `armorSoaked.wear` equals the shared formatter's displayed durability delta — this IS the ARMOR-02 acceptance evidence CONTEXT.md specifies
- [ ] A new formatter test (extend `test/unit/characterSheetViewModel.test.js` or create `test/unit/viewModels-armor.test.js`) for the shared armor-display helper, covering: normal wear, destroyed, magic-cloak-present, cloak-over-damaged-worn-piece
- [ ] A new nested-array strip helper in `test/parity/harness/comparables.js` wired into all three `*Comparable()` functions (no fixture currently exercises it — structural tripwire, per the project's own `stripFoeAbilityState` precedent)
- [ ] A new roundtrip/unit test proving a bag armor item's `left`/`patches` survive JSON serialize/rehydrate, and that a legacy item without `left` reads as full

*(No framework install needed — `node:test` is already the project's only test runner.)*

## Security Domain

Not applicable — this phase has no authentication, session, network, or input-validation surface (fully offline, single-player, local-save game; no user-supplied text beyond a save file that is already validated by `validateSave`, unaffected by this phase's changes). `security_enforcement` considerations for save-file parsing are already covered by the existing `isValidCharacter`/`isValidFloor` gates, which this phase does not need to extend (confirmed above: no new required fields).

## Sources

### Primary (HIGH confidence — direct code read, this session)
- `engine/combat.js` L1377-1512 (`applyFoeDamageToPlayer`, the one soak site)
- `engine/derived.js` L210-242 (`armorSoak(c)`)
- `engine/items.js` L215-497 (`armorRefusalReason`, `canEquipArmor`, `takeItem`, `wornArmorItem`, `equipItem`, `unequipSlot`)
- `engine/character.js` L360-380 (chargen armor init)
- `engine/encounters.js` L290-312 (`-All armour` table wipe)
- `engine/economy.js` L195-296 (`repairArmor`, `openStore` repair line + armor stock)
- `engine/movement.js` L470-501 (camp mending/Sewing/Master of Arms)
- `engine/saveState.js` L34-46, L140-211 (`isValidCharacter`, `validateSave`)
- `mazeworld.html` L1425-1490 (sheet DOM markup, `#s-arm`/`#s-kit`), L2874-2980 (`paint()`), L3020-3040 (gear panel worn row), L3390-3525 (classic `takeItem`/`renderCarriedList`), L4357-4480 (classic combat cluster incl. dead armor block), L5477-6470 (module script, `dispatch`/`engineCombatAction`/live combat wiring)
- `src/browser/viewModels.js` L1-140 (`characterSheetViewModel`, its single call site confirmed at `mazeworld.html` L6152)
- `src/browser/toasts.js` L195-215, L1035-1060 (TOAST_FOR membership, armorSoaked/armorDestroyed toast builders)
- `src/browser/eventNarration.js` L345-358 (armorSoaked/armorDestroyed narration)
- `content/treasure-tables.js` L24-30 (CLOAKS table, live Cloak of Armor entry)
- `test/parity/harness/comparables.js` (full file read — every strip helper and all three `*Comparable()` functions)
- `test/unit/combat.test.js` L482-684 (existing armor tests)
- `test/unit/inventory-actions.test.js` (full file read — equip/unequip test coverage)
- `test/unit/feedback-payload.test.js` L354-389, L595-640 (armorSoaked/EVENT_NARRATION pinning tests)
- `test/unit/characterSheetViewModel.test.js` L38-142 (ARMOR tile pinning)
- `test/voice/safety-scan.test.js` L1-30 (scan scope doc comment)
- `test/unit/content-tables.test.js`, grep across `test/**` for "Cloak of Armor"/"weighs nothing" (no `txt` pinning found)
- Direct `npm test` run this session: 1448/1448 passing, 15748ms — matches STATE.md's Ground Truth claim
- Direct grep of `test/parity/fixtures/` and `test/fixtures/` for `equipItem`/`unequipSlot`/`takeFind`/`leaveFind`/`dropItem` action types: zero matches (confirms `engine/items.js`'s own header-comment claim that these five functions are "inherently parity-safe (no fixture drives them)")

### Secondary (MEDIUM confidence)
- `.planning/phases/28-armor-integrity-durability/28-CONTEXT.md` — user-locked decisions (authoritative for SCOPE, treated as given, not re-verified against the rulebook PDF directly in this session — rulebook facts were supplied pre-verified in the task's "Rulebook facts already established" block)

### Tertiary (LOW confidence)
- None — this phase required no web search or external-library research; every claim traces to a specific file:line read during this session.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no external stack involved
- Architecture: HIGH — every data-flow claim traced through actual source, including confirming which of two parallel implementations (classic script vs. engine module) is live
- Pitfalls: HIGH — the destroyed-armor gap (Pitfall 2) and the roll-screen-vs-live-display misattribution (Pitfall 1) were both discovered by direct code tracing, not inferred from CONTEXT.md's suspect list, and are corrections/additions to it

**Research date:** 2026-09-15
**Valid until:** No expiry driver (internal code, not a moving external dependency) — valid until the underlying files change; re-check file:line references if this phase's start is delayed past other v1.3 phases touching `engine/items.js`, `engine/combat.js`, or `mazeworld.html`'s armor sections.
