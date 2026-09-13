# Proposed Features — DR15 batch (captured 2026-09-09, mid-Joiners-planning)

Three feature requests the user fired via `/gsd-next` while the Joiners milestone was being planned. NONE are Joiners work. Each is grounded in the current code below with file:line pointers, a suggested home, and the key constraints. Sequence them with the user (quick tasks now / a small v1.0 phase / fold into a milestone).

---

## DR15-A — "Language" as a system (ties into parley; wire the Helm of Knowledge)
**User:** "add language as a system. ties in with parlay. see helmet of knowledge"

**Current state (grounded):**
- `content/skills.js:16` — `"Language": { cost: 1, txt: "parley with anything that talks" }`. Today Language is a THIN gate: `engine/combat.js:464` `if (skill(c,"Language") && TALKATIVE.includes(t)) return true;` inside `canParley()` — i.e. having the Language skill lets you parley the TALKATIVE encounter types (Humans/Demons/Lair Beasts/Beasts).
- `content/treasure-tables.js:19` — `{ n: "Helm of Knowledge", eff: { tongue: 1 }, txt: "perfect fluency in one language" }`. The `tongue` eff is **INERT** — read NOWHERE (same class of inert-item bug as `eff.fly` / `eff.cloakArmor` were before they were wired). So the Helm currently does nothing.

**What to build:**
- Make **Language a real system**, not just a parley gate. Wire the Helm of Knowledge's `eff:{tongue:1}` so carrying it grants the Language capability (mirror the `eff.fly`/`eff.cloakArmor` wiring pattern in `engine/derived.js`): a character WITH the Helm should `canParley` the talkative types even without buying the Language skill ("perfect fluency in one language").
- Decide what "Language as a system" means beyond parley-enabling: e.g. does it widen WHICH encounter types are talkable, improve the parley bonus/odds, or unlock non-combat comprehension/flavor? (Design call — check the rulebook's Language/tongue rules; prototype is canon.)
- **Ties into the parley balance pass** already logged to Monster Balancing (`proposed-milestone-monster-balancing.md` candidate #5) — Language changes WHO can parley and how well, so its balance must be tuned alongside parley. **Cross-referenced there.**

**Suggested home:** rules-wiring (like 04.1's inert-item fixes) — small-to-medium. Could be a quick task for the Helm wiring + a design decision for the "system" expansion, OR folded into the Monster-Balancing parley work.
**Constraints:** engine pure/deterministic; if it adds a `canParley` path, no new rng in chargen; `tongue`/`Language` are data keys — don't rename.

---

## DR15-B — Unified condition system (good + bad), tracked "up top"; add Invisibility — ✅ DONE 2026-09-10 (676/676, parity byte-identical, deployed)
**DONE:** pure `conditionsOf(state)` helper in `engine/derived.js` (data-only, no copy, no rng/mutation) enumerating haste/invis/acute/ether/might/flight (good) + affliction/darkness (bad); UI chip row `#mm-conditions` below the HUD character line, colorblind-safe (▲boon/▼bane glyph + label + color), wrap+capped for phones; bridged `window.__mzConditionsOf`; replaces the DR13 lone poison/disease tag. Active-phobia surfaced via `darkFor>0` ("In the dark"). `test/unit/conditions.test.js` (10 tests). Invis/acute were already engine-wired (DR15-D note); this adds the DISPLAY.
**User (original):** "add invisibility to conditions. they should track up top. find other conditions and make sure condition system accounts for good and bad conditions"

**Current state (grounded):**
- Status fields already on the character (`engine/character.js:189,200,213`): `haste`, `invis`, `ether`, `acute` (all default 0), `affliction` (null | {kind:"Poison"|"Disease"|…}), `darkFor` (persistent darkness, 04.1), `flightLeft`/`flightCooldown` (Batch 1). These are GOOD conditions (haste, invis, ether, acute, flight) and BAD ones (affliction poison/disease, darkFor).
- "Up top" rendering TODAY is minimal: `mazeworld.html` `.mw-map-status` (DR13) shows ONLY a persistent poison/disease tag (`data-kind="disease"` etc., `:258-265`). The viewport chips (`.mw-viewport-chips`/`.mw-chip`, `:303-304`) are the top-left overlay real estate. There is NO unified good-and-bad condition tracker.

**What to build:**
- A **condition/status-effect SYSTEM**: enumerate all active conditions (good AND bad) from the existing `c.*` fields (haste, invis, ether, acute, flight, affliction, darkness…), and render them as a **unified tracker at the top** (extend `.mw-map-status`/viewport chips into a row of condition chips, colorblind-safe, each showing kind + remaining duration/charges where applicable).
- **Invisibility** specifically: `c.invis` exists as a field but isn't surfaced as a tracked condition — add it to the tracker (and confirm what sets/decrements it — likely a spell/potion in `engine/magic.js`/items).
- Audit for OTHER conditions not currently shown and make the system general (data-driven list of condition descriptors: field, good/bad polarity, label, icon, duration source).
- **Active phobia** (user add, 2026-09-09): when the character's PHOBIA is actively in effect, show it as a BAD condition in the tracker. Phobias were wired in Phase 04.1 (all 10 given real effects, incl. the persistent Darkness/fog state `c.darkFor`). The tracker should surface a phobia condition ONLY while it is currently triggering a game effect (e.g. `c.darkFor > 0` for Darkness, or the situational phobia debuff is presently applied) — not merely because the character HAS that phobia. Requires a small derived predicate per phobia ("is this phobia active right now?"); reuse 04.1's phobia-effect wiring (`engine/derived.js`/`engine/movement.js`) as the source of truth rather than re-deriving. Name the phobia in the chip (e.g. "In the dark", "Trapped") in the game's voice.

**Suggested home:** its own **v1.0 presentation+rules phase** (engine: a `conditionsOf(state)` derived helper; UI: the tracker). **OVERLAPS the Joiners party-UI** ("status up top" / the mock's party rail also shows member status) — coordinate so the condition tracker and party status share one display system rather than two. Medium.
**Constraints:** the condition MODEL is derived/presentation over existing engine fields (prefer a pure `derived.js` helper enumerating conditions — no new serialized field unless a genuinely new condition is added, which would need a parity carve-out); engine stays pure.

---

## DR15-C — View the graveyard from the splash/title screen (when non-empty)
**User:** "allow viewing the graveyard from the main splash screen if it's not empty"

**Current state (grounded):**
- Title/splash screen: `mazeworld.html` `.mw-title-screen` (`:877-898`) + `initTitleScreen()` (module boot) shows splash art + GAME_NAME + ENTER/RESUME. No graveyard entry point there.
- The graveyard already exists as the DEAD tab (`renderGraves()`), and after the E12 rework there's a persisted **`gravesTotal`** (`ddr.graveyard.total.v1`) + a capped `graves` list, loaded via `loadGraves()`.

**What to build:**
- On the title screen, when the graveyard is NON-EMPTY (`gravesTotal > 0`, or `graves.length`), show a **"View the Dead" / graveyard entry** that opens the existing DEAD view (reuse `loadGraves().then(renderGraves)` + the tab/overlay). Hide it when empty (mirrors the empty-state logic already in `renderGraves`).

**Suggested home:** **quick task** — small, self-contained UI, no engine change. Cleanly builds on the E12 graveyard work. Presentation-only.
**Constraints:** presentation-only; reuse the existing graveyard render + storage load; don't duplicate the render path.

---

## DR15-D — Validate ALL potions; wire inert potion effects; confirm a use-path
**User:** "make sure potion effects work. see potion of speed. validate all potions and add systems if necessary"

**Two potion pathways (grounded):**
- Generic combat **POTION button** → `drinkPotion()` (`engine/magic.js:368`) = HEALING only (consumes one carried healing potion).
- **Named potions** (`content/potions.js`, d10 table) are found/bought as items carrying `eff2: p.eff`, and applied by the **`useItem(state, i, rng, events)`** engine action (`engine/items.js:256` switch on `it.eff2`). The engine action EXISTS and is wired (`engine/engine.js:85`, `engine/actions.js:69`).

**Per-potion audit (`content/potions.js` eff → `items.js` switch → is the field READ?):**
| Potion | eff | Handler (`items.js`) | Field read by a system? | Verdict |
|---|---|---|---|---|
| Healing | `heal` | `case heal` d10+2 → wp | healed event | ✅ works |
| Cure Poison | `poison` | `case poison` clears affliction | — | ✅ works |
| **Speed** | `speed` | `case speed/haste` → `c.haste=50` | combat.js:280 doubles attacks; ticks down movement.js:253 | ✅ **engine-correct** (see UI note) |
| Xtra Healing | `full` | `case full` → wp=max | healed | ✅ works |
| Strength | `strength` | `case strength` → `c.might+=8` | `derived.js:219 d+=c.might` (+dmg) ✓; reset at `newDay` (movement.js:320) | ⚠️ works but duration = "until next day", NOT the "25 squares" the txt claims |
| Cure Disease | `disease` | `case disease` clears affliction | — | ✅ works |
| Enlarge | `enlarge` | `case enlarge` → `c.might+=4` | same as Strength | ⚠️ same duration caveat; no actual "size" mechanic |
| **Acuteness** | `acute` | `case acute` → `c.acute=rng.d(8)` | **NOT read** — `strikeDie(c)` (combat.js:293) doesn't consult `c.acute` | ❌ **inert** ("strike on a d6" never happens) |
| Death | `death` | `case death` → die("potion") | — | ✅ works (kills you, as intended) |
| **Invisible** | `invis` | `case invis` → `c.invis=100` | decrements (movement.js:254) but **read NOWHERE in combat** — foes still hit you | ❌ **inert** (no protective effect) — SAME as DR15-B's invisibility item |

**What to build:**
1. **Wire the inert effects** (mirror the `eff.fly`/`cloakArmor`/`tongue` inert-item pattern):
   - **Acuteness** — make `strikeDie(c)` (or the to-hit) use a smaller die (d6) while `c.acute > 0`, and decrement `c.acute` per round/step (the txt says "d8 rounds"). Confirm `strikeDie` contents and where to inject.
   - **Invisibility** — make foe-attack logic MISS (or heavily penalize) while `c.invis > 0`. This is the SAME wiring DR15-B needs, so **do these together** (wire the effect here; DR15-B adds the top-of-screen chip).
   - **ether** (`c.ether`, set by a `case ether` =20, decrements movement.js:255) — verify whether it's read anywhere; if not, decide its rule (ethereal/pass-through?) or leave as documented-inert. Audit it during execution.
2. **Duration fidelity** (optional polish): Strength/Enlarge reset only at `newDay` (per-day), not the "25/50 squares" the flavor text promises — decide whether to honor the square-count duration or update the text (dual-purpose caution if the string is parsed).
3. **Confirm the player can actually USE a named potion.** The engine `useItem(i)` action exists, but verify the UI exposes a way to drink a non-healing potion mid-run (Speed/Strength/Acuteness/Invisible). If not, this is the **E2-class gap** ("surface usable items in the combat bar", already deferred to the **Economy & Item Balancing** milestone) — a Potion of Speed that works in the engine is still useless if there's no button. **Coordinate: the EFFECT-wiring is DR15-D; the USE-button is E2/Economy.**

**Suggested home:** rules-wiring quick-task/phase for the inert effects (Acuteness, Invisibility, ether) — **do jointly with DR15-B** (invisibility) since they share the `c.invis` combat wiring. The use-button belongs to E2/Economy. Determinism note: any NEW rng (e.g. an acute d6 vs d20 changes draw SIZE not COUNT — safe; but adding a foe-miss roll for invis must fire only in the non-chargen combat path, guarded, to keep parity).

## DR15-E — Remove the "Dice detail" setting; roll details live EXCLUSIVELY in the Oracle
**User:** "remove dice detail setting. didn't show those details for last exchange on encounters. details should now exclusively live in the Oracle"

**Current state (grounded):**
- A **`diceMode`** setting (Settings sheet, `mazeworld.html:1148-1149`, `data-setting="diceMode"`, segmented: "never" / "on tap" / "always"; field in `src/browser/settings.js`) drives a `#app[data-dice-mode="…"]` attribute (`mazeworld.html:1180`).
- CSS (`mazeworld.html:613-620`, 04-DR9 "dice transparency") uses that attribute to hide/show the `.roll` dice spans in BOTH the Oracle `#log` AND the encounter panel `#enc-body`/`.exchange` — plus an "on tap" reveal (`.mw-roll-revealed`) and the hint `.mw-oracle-hint` ("Tap a line to see the dice that did it", `:1370`).

**What to build (new fixed behavior, no setting):**
- **Remove the `diceMode` setting** entirely: the Settings segmented control (`:1148-1149`), the `settings.js` `diceMode` field + its persistence/wiring, the `#app data-dice-mode` attribute (`:1180`), and the "on tap" reveal interaction + `.mw-oracle-hint` (`:1368-1370`).
- **Roll details EXCLUSIVELY in the Oracle:** `.roll` dice spans are ALWAYS visible in `#log` (the Oracle), and NEVER rendered/visible in the encounter panel `#enc-body`/`.exchange` (the "last exchange" summary). Simplify the CSS from the three-mode gate to a single static rule: show `.roll` in `#log`, hide `.roll` in `#enc-body`.
- Net effect: the encounter "last exchange" reads as clean prose (HIT/MISS + outcome), and anyone who wants the dice math looks at the Oracle log — which always has it. (Complements the earlier `stripRollDetail` prose work + the combat-UX toasts.)

**Suggested home:** **quick task** — presentation/settings-only, no engine change. Coordinate with DR15-B (both touch the top-of-screen/encounter presentation) but independent.
**Constraints:** presentation-only; ensure removing the setting doesn't break the Settings sheet layout or leave a dangling `settings.js` reference; keep the `.roll` spans in the DOM (Oracle needs them) — this is a VISIBILITY/render-location change, not removing the roll data.

### Sequencing note
- **C** (graveyard from splash) is a fast quick-task (do anytime).
- **A** (Language + Helm) is small rules-wiring + a design decision; naturally pairs with the Monster-Balancing parley work.
- **D** (potion validation / wire inert effects) is rules-wiring like 04.1's inert-item fixes. Its **Invisibility** and **Acuteness** wiring share the `c.invis`/`c.acute` combat reads that **B** also needs — **do B + D together** (D wires the EFFECTS; B adds the top-of-screen chips). The potion **use-button** is the E2/Economy gap.
- **B** (condition tracker) is the biggest and **overlaps the Joiners party-UI** — build the condition tracker as part of, or just before, the Joiners party-status UI so there's ONE status-display system. B also depends on D having wired invisibility to actually DO something (else the chip shows a no-op condition).

**Natural grouping for a future phase/quick-batch:** {A, D} = inert-effect rules-wiring (Language/Helm, potions incl. invis+acute); {B} = the condition-tracker UI (after D); {C} = standalone quick task. All are pre-launch v1.0 polish, independent of Joiners except B's shared status-display concern.

---

# DR16 — party-build device review (captured 2026-09-09)

Bugs/gaps reported while device-reviewing the Joiners party build. The UI batch (darkness visual, potion/food-at-full guard, death→graveyard+Oracle, Move-on button placement) is being fixed in an executor pass. The two below are captured for the NEXT round.

## DR16-F — Armor HP/durability shown inconsistently on the character sheet — ❌ DROPPED (user directive 2026-09-10, "Drop backlog item DR16-F")
**User:** "sometimes armor lists hit points next to it, sometimes it doesn't on my character sheet."
**Grounded:** TWO different armor renders exist:
- `mazeworld.html:2763` `#s-arm`: `c.armor + (c.ar ? " (AR " + c.ar + ")" : "")` → shows e.g. "Plate (AR 15)" — NO durability hp.
- `mazeworld.html:2776` (the sheet grid row): `[c.armor, c.armorWP > 0 ? "AR " + c.ar + " · " + c.armorWP + "/" + c.armorMax + " hp" : "destroyed"]` → shows "Plate · AR 15 · 45/45 hp" — WITH durability.
**Fix:** make the two consistent — align `#s-arm` (2763) to include the `armorWP/armorMax hp` durability (the fuller 2776 format), or retire whichever element is the stale duplicate. Small UI consistency fix, presentation-only.

## DR16-G — "Amulet of Stone" + the "N squares of opponents" concept isn't modeled
**User:** "we didn't have the idea of 4 squares of enemies. Amulet of Stone — turns up to 4 squares of opponents to stone, once every 200 squares."
**Grounded:**
- The game models foes as a FLAT list `state.combat.foes` (individual creatures), NOT the tabletop "squares of opponents" (a square = a stack/group of creatures on the grid). AoE item/spell effects use `foes.slice(0, N)` (the first N individual foes) — e.g. `engine/items.js:324` `case "stone"` currently petrifies `foes.slice(0, 2)` (2 foes); freeze/gas/fire similar.
- **"Amulet of Stone" is NOT in the item tables** (grep found no such item) — it needs adding, with effect "turn up to 4 squares of opponents to stone, once every 200 squares."
**Design decision needed (then wire):**
- **How to interpret "N squares of opponents" in this engine.** Simplest, consistent with existing AoE items: treat **1 square ≈ 1 foe/creature** in `C.foes`, so "up to 4 squares" = `foes.slice(0, 4)`. (The alternative — modeling enemy STACKS/groups occupying squares — is a much larger combat-model change; likely overkill for v1. Recommend the 1-square=1-foe mapping and note it as a deliberate simplification, like other tabletop→solo adaptations.)
- **Wire the Amulet of Stone item:** add it to the appropriate treasure/jewelry table with `use:"stone"` targeting up to 4 foes + an `every: 200` square cooldown (mirror the `itemReady`/`every`-squares cooldown pattern already used by e.g. Cloak of Speed `every:50`). Confirm the existing `case "stone"` handler and generalize its `slice(0, N)` count for this item (2 for existing stone effects, 4 for the Amulet — or make N a per-item field).
- Belongs in the **Economy & Item Balancing** milestone (item review + wiring) OR a rules-wiring quick task; coordinate with DR15-D (potion/inert-effect wiring) since it's the same "wire an item effect" family. Also audit whether OTHER items/spells reference "squares of opponents" and need the same interpretation.
