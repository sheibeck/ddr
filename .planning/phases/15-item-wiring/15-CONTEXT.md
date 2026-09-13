# Phase 15: Item Audit + Inert-Effect Wiring (Economy D) — Context

**Gathered:** 2026-09-10 (autonomous). **Requirements:** ECON-08.
**Research:** `.planning/research/economy-SUMMARY.md` §4 (the inert table — item:line + fix each). Depends on Phase 12 (independent of 13/14, pairs with 14's base-value work). Baseline: **653/653**, parity byte-identical.

## Phase boundary
- **DOES:** wire the confirmed-INERT item effects so every item either works or is deliberately retired; give treasure items a base value (refines Phase 14's fallback). Folds in DR15-A (Helm/Language) + DR16-G (Amulet-of-Stone 4-target).
- **Does NOT:** economy number tuning (Phase 16).

## The inert set to WIRE (from research §4, `content/treasure-tables.js`)
Each is a pure derived read (mirror `isFlying`/`armorSoak`/`eff.cloakArmor` in `engine/derived.js:66-105`) unless noted:
1. **Helm of Knowledge `eff:{tongue:1}` (DR15-A):** wire `tongue`→`canParley` (`engine/combat.js:464` area) — carrying it grants the Language capability (parley the TALKATIVE types). Pure read, no rng.
2. **Cloak of Strength `eff:{noCrit:1}`:** in `engine/combat.js` where `noCrit` is computed (~:334, currently class-only Guard/Soldier/dark), add `|| eff(c,"noCrit")`. Pure read.
3. **Pendant of Fortitude `use:"half"`→`c.halfNext`:** wire `c.halfNext` into the foeTurn damage-taken path (halve ONE incoming hit, then clear the flag). Pure (no rng); place the read in the member/hero damage branch. `halfNext` is an existing field (set by `items.js:304`).
4. **Amulet of Light `eff:{light:1}`:** `sight` already works (revealRadius); wire `light`→dispel persistent darkness (clear/decrement `c.darkFor`) — a pure read where darkFor is applied (`engine/derived.js inDark`/`movement.js`). No rng.
5. **Cloak of Healing `eff:{cloakHeal:1}`:** a per-step FLAT heal (e.g. +1-2 hp/step up to maxWP) — wire at the per-step tick site (`engine/movement.js:253-255` where haste/invis/ether tick). FLAT = NO rng.
6. **Cloak of Regeneration `eff:{cloakRegen:1}`:** a per-step **d6** regen at the same tick site. ⚠ This is a NEW rng draw — it MUST be GATED behind carrying the cloak (`if (eff(c,"cloakRegen")) { rng.d(6)… }`), so a character NOT carrying it draws nothing (byte-identical). Verify NO parity fixture carries this cloak (treasure finds aren't in chargen/fixtures); if one does, handle the divergence (gate + document). The tick fn must have `rng` available (movement's newDay/tick already uses rng).
7. **Amulet of Stone (DR16-G):** the `case "stone"` handler (`engine/items.js:325`) petrifies `foes.slice(0,2)`; make the AoE count a per-item field `n` (default 2) so the Amulet passes `n:4` ("up to 4 squares" ≈ 4 foes, the DR16-G "1 square = 1 foe" simplification). Update the Amulet's item data + the freeze/gas/stone handlers to read the per-item `n`.
8. **`ether` (`c.ether`) + Gauntlet of the Giant (`eff:{size:1}`):** DESIGN CALL — wire a real effect OR formally retire (document). For `ether`: either wire ethereal wall/gorge pass-through in `movement.js` (mirror `isFlying`) or mark intentionally-inert in a code comment. For Gauntlet `size`: wire a small damage/size benefit OR retire. Keep it simple — prefer wiring if cheap, else a clear "retired: does nothing by design" note + consider removing the item or its flavor claim.
9. **Treasure base values:** add a base `cost`/value to treasure items (jewelry/cloaks/staves) that lack one, so Phase 14's `sellPriceFor` uses real values instead of the 200 fallback. Reasonable values relative to the item's power (a Phase-16 tuning knob).

## Determinism / parity
- Most wires are PURE derived reads (no rng) → parity-safe.
- The ONLY new rng is Cloak of Regeneration's per-step d6 — GATE it behind carrying the cloak so non-carriers draw nothing; verify no fixture carries it (parity byte-identical). If any new combat draw is added (none expected), gate it to the qualifying non-chargen combat path.
- No new serialized fields (all effects read existing `eff`/`c.*`); if you add one, carve it out.
- New event types (if any, e.g. `darknessDispelled`, `damageHalved`, `cloakRegen`) need `EVENT_NARRATION` entries. Run FULL `npm test` after each wire.

## Success criteria (gate)
1. Every item in the research §4 inert set either works (wired) or is deliberately retired with a documented reason; DR15-A (tongue/Language) + DR16-G (Amulet-of-Stone 4-target) done.
2. Treasure items carry base values (sell pricing no longer needs the flat fallback for them).
3. **Parity gate:** full `npm test` green; empty/solo byte-identical; the Regeneration d6 gated behind the cloak; `prototype-master.js.txt` untouched.

## Hard constraints
Engine pure/deterministic; new rng (regen d6) gated behind carrying the item; new event types get narration; no field/existing-event renames; no git; no build/deploy (orchestrator); no SUMMARY.md (policy).
