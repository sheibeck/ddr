# Requirements: Delve, Die, Repeat — v1.3 Feel, Loot & Combat Flow

**Defined:** 2026-09-15
**Core Value:** The dungeon crawl — the tension and discovery of descending into the unknown. What the screen says must be what the dice did.
**Milestone goal:** Make gear and combat legible and honest — armor behaves the way the screen says it does, kill drops become a real end-of-combat loot decision, and the combat narrative is delivered through a researched, less tap-heavy, tap-safe UI — while landing the parked Feel & Polish backlog (inventory integrity, UI feel, combat start, store stock). Tuning is explicitly NOT this milestone.

**Grounding (2026-09-15, code read):**

- **Armor today** (`engine/combat.js` ~L1478–1512, `engine/derived.js#armorSoak`): on a foe hit, if worn armor has `ar > 0` and `armorWP > 0` and the foe doesn't ignore armor, a d20 ≤ AR *soaks the entire blow* (`dmg = 0`). Durability is charged the **full blocked damage** (`c.armorWP -= dmg`) only when `dmg > armorMin`; a Dwarf pays `ceil(dmg × armorWear)`; the Cloak of Armor makes effective armor never-wearing magic Plate (`av.magic`). The `armorSoaked` event carries `{amount, wear}` — so "Armor takes 39 / Wear 39" means 39 blocked, 39 durability spent. If the gear panel showed no change, either the panel reads the *item's* `wp` (durability is a scalar on the character: `c.armorWP/armorMax/patches`, not on the item — `engine/items.js` L292/L454 reset it on every equip) or the cloak's magic plate absorbed it. That split (durability on the character, not the item) is also the root of the re-equip full-repair exploit.
- **Foe drops today** (`engine/items.js#takeItem` L253–300): a dropped weapon/armor is auto-equipped if strictly better, else `itemRejected reason:"notBetter"` → the "Not an upgrade." toast, and the item is gone. Only `giveItem` paths touch the bag.
- **Bag space today** (`content/bags.js`, `engine/items.js#bagCap` L323): slots cap `c.items.length` (4/6/8/10). Healing potions (`c.potions`) and scrolls (`c.scrolls`) are scalar counters that never take a slot; special potions (`kind:"potion"`, e.g. Acuteness) and other treasure live in `c.items`. The cap is checked at only two sites (L378, L477).
- **Combat feedback today** (`src/browser/toasts.js`, Phase 25/25.1): 189 toast types, each event its own toast; "Move on" card for floorChanged/leveled; Fight!/Joiner/find/death cards. Toasts linger 3–9 s and tap to dismiss; the D-pad sits under the thumb that also lands on those cards.

## v1.3 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Armor (ARMOR)

- [x] **ARMOR-01**: The soak-vs-wear rule is audited against the prototype and rulebook (d20 ≤ AR soaks the whole blow; blocked damage above the armor's min is charged to durability; Cloak = never-wearing magic plate; Dwarves wear at half), a keep/change decision is recorded as a Key Decision, and any change ships as a declared parity divergence
- [x] **ARMOR-02**: The "Armor takes N / Wear N" toast and the gear panel / character sheet always agree — the observed "toast says wear, panel shows no damage" discrepancy is root-caused and fixed, with a test pinning toast `wear` = durability delta on the displayed armor
- [x] **ARMOR-03**: Armor durability is carried on the item, so unequip → swap → re-equip preserves remaining durability (kills the full-repair exploit); new serialized field carved out of the parity comparables, save-migration tolerant
- [x] **ARMOR-04**: Cloak of Armor is legible and real — its item text says exactly what it does (never-wearing magic plate, or a redesign) and the armor UI shows it as the effective armor when carried
- [x] **ARMOR-05**: Player can tell the four armor outcomes apart on screen: soaked-with-wear, soaked-without-wear (blow ≤ armor min), magic-plate soak, armor gives out

### End-of-combat loot (LOOT)

- [x] **LOOT-01**: Foe drops during combat go into a pending pile instead of being auto-equipped or auto-rejected; no drop is silently discarded
- [x] **LOOT-02**: When combat clears, the player sees a loot screen listing every drop with take / leave per item, plus take-all / leave-all
- [x] **LOOT-03**: Taking a weapon or armor from loot shows the compare-to-equipped info (e.g. "+2 damage" / "not an upgrade") and offers equip-now vs. bag
- [x] **LOOT-04**: One bag-cap gate that every pickup / buy / starting-kit / loot path routes through, with "bag full" feedback and a drop-to-make-room option; healing potions, special potions, and scrolls do NOT count against bag space (user rule 2026-09-15) — only gear and treasure items consume slots
- [x] **LOOT-05**: Bigger bags (medium / large / xlarge) are obtainable as depth-appropriate treasure (new rng draw behind a feature guard)
- [x] **LOOT-06**: The pending pile survives save/resume (serialized, carved out of comparables); fleeing or dying forfeits it with a narrated line

### Combat narrative & input (CMBUI) — research-first

- [x] **CMBUI-01**: A written survey of known combat-feedback patterns (combat log / ledger, batched round summary, auto-advance, ticker, mis-tap guards — from mobile roguelikes and turn-based RPGs) with a recommended design for this game, recorded in `docs/` and as a Key Decision before implementation starts
- [x] **CMBUI-02**: A combat round's narrative is delivered in one coherent place per the chosen design, not a stack of individual toasts; the Oracle remains the complete log
- [x] **CMBUI-03**: Moving on after a round or an encounter takes at most one deliberate tap — no dismiss-then-continue chains
- [x] **CMBUI-04**: Decision buttons (Fight!, Joiner accept/decline, loot, Move on) cannot fire from a tap aimed at the D-pad — arm delay, no hit-zone overlap, or a distinct gesture
- [x] **CMBUI-05**: Nothing important can be dismissed by a movement tap; dismissal requires a deliberate tap on the surface itself
- [x] **CMBUI-06**: The chosen design is validated in an on-device DR round before the milestone closes

### Combat start & usability (CMB)

- [x] **CMB-01**: No initiative roll or enemy strike happens before Fight! is pressed; the encounter screen is a preview / decision point only
- [x] **CMB-02**: "Not ready yet" audit — every usable spell, item, and gear piece is provably usable in its proper circumstances (cooldown / readiness, class gates, combat-vs-explore gates), and each refusal says why
- [x] **CMB-03**: Combat potions are drinkable from the Gear page outside combat
- [x] **CMB-04**: Shield shows a condition chip with remaining pool and rounds
- [x] **CMB-05**: Every round-based effect (Acuteness, haste, might, ward, …) expires outside combat — ticks on exploration steps or clears at `endCombat`; the audit covers all of them
- [x] **CMB-06**: Amulet of Stone ends combat and pays out like a kill (stoned foes count as defeated)

### UI feel (UIF)

- [ ] **UIF-01**: Gear panel shows Use and Drop side by side, Drop on the far right, with a confirm before dropping
- [ ] **UIF-02**: The map recenters on the party icon whenever the map view returns from a full-screen panel (Store, sheet, Oracle, …)
- [ ] **UIF-03**: Default map zoom is the midpoint between fully zoomed in and fully zoomed out
- [ ] **UIF-04**: Tutorial on/off setting — dismiss once, re-enable from Settings
- [ ] **UIF-05**: Make Camp moves into the Marks / Centre row (far right); the handedness option is removed; movement buttons are centered

### Store (STORE)

- [ ] **STORE-01**: Store stock is rolled randomly and floor-appropriately for the current depth (new rng draw behind a feature guard; parity byte-identical for fixtures)

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Next tuning pass (user decision 2026-09-15: NOT v1.3)

- **TUNE-07**: Human DR round on the Pixel 7 (forced 20/35/50 + natural) re-issues the retune verdict — checklist waits in `docs/DIFFICULTY-RETUNE.md`
- **TUNE-06 residue**: forced-20 floors gained p50 0 / mean 0.84 and reach ≥ 20 0.1 % — needs a canon tier-3/5 roster decision

### Loot / inventory extras

- **G16 squares of opponents**: DR16-G "N squares of opponents" group model for multi-target items (Amulet of Stone `aoe: 4`) — only the minimal Amulet fix (CMB-06) ships in v1.3
- **Narrative-toast case/wrap on device** — subsumed if CMBUI replaces per-event toasts; otherwise a polish item

### Release tail

- **Play versionCode-4 internal upload** — pending the phone (standing rule: ask after every batch)
- **UX-06 first-run tutorial** — deliberately last, after the UI settles (CMBUI changes the UI again)
- **STR-01..04, STR-06 production launch** — user-driven; repo-side SDK/dependency audit owed
- **Play Developer API upload automation** — `docs/RELEASING.md`

### Identity extras

- **IDENT-V2-01**: Human race gains its own good and bad
- **IDENT-V2-02**: Sub-class-specific joiner synergies

### Housekeeping

- `mazeworld.html` `/*`-in-`//` comment cleanup
- GSD state tools not resolving decimal phase numbers

## Out of Scope

| Feature | Reason |
|---------|--------|
| Difficulty retune / TUNE-06 / TUNE-07 | User decision 2026-09-15: tuning waits for a later milestone; v1.3 changes player feel (armor, loot, combat flow) so tuning now would be tuned twice |
| Counting potions or scrolls against bag slots | User rule 2026-09-15: they stay slot-free |
| Squares-of-opponents group model | Open-ended engine geometry; only the Amulet of Stone stranded-combat fix ships |
| First-run tutorial (UX-06) | Deliberately last; CMBUI reshapes the combat UI this milestone |
| Google Play production launch (STR-01..04, STR-06) | User-driven, separate tail |
| New armor types, encumbrance, or a weight system | Cloak of Armor is made legible within the existing model, not by adding encumbrance |
| iOS, multiplayer networking, accounts, ads/IAP | Unchanged project-level exclusions |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARMOR-01 | Phase 28 | Complete |
| ARMOR-02 | Phase 28 | Complete |
| ARMOR-03 | Phase 28 | Complete |
| ARMOR-04 | Phase 28 | Complete |
| ARMOR-05 | Phase 28 | Complete |
| LOOT-01 | Phase 29 | Complete |
| LOOT-02 | Phase 29 | Complete |
| LOOT-03 | Phase 29 | Complete |
| LOOT-04 | Phase 29 | Complete |
| LOOT-05 | Phase 29 | Complete |
| LOOT-06 | Phase 29 | Complete |
| CMBUI-01 | Phase 30 | Complete |
| CMB-01 | Phase 31 | Complete |
| CMB-02 | Phase 31 | Complete |
| CMB-03 | Phase 31 | Complete |
| CMB-04 | Phase 31 | Complete |
| CMB-05 | Phase 31 | Complete |
| CMB-06 | Phase 31 | Complete |
| CMBUI-02 | Phase 32 | Complete |
| CMBUI-03 | Phase 32 | Complete |
| CMBUI-04 | Phase 32 | Complete |
| CMBUI-05 | Phase 32 | Complete |
| CMBUI-06 | Phase 32 | Complete |
| UIF-01 | Phase 33 | Pending |
| UIF-02 | Phase 33 | Pending |
| UIF-03 | Phase 33 | Pending |
| UIF-04 | Phase 33 | Pending |
| UIF-05 | Phase 33 | Pending |
| STORE-01 | Phase 33 | Pending |
