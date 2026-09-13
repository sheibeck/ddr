# Phase 13: Inventory Actions + UI (Economy B) — Context

**Gathered:** 2026-09-09 (autonomous). **Requirements:** ECON-03, ECON-04, ECON-05.
**Research:** `.planning/research/economy-SUMMARY.md` §2, §6-B. **Roadmap:** Phase 13. Depends on Phase 12 (`c.bag`, `state.pendingFind`, `clampCarry`, `BAGS`). Baseline: **617/617**, parity byte-identical.

## Phase boundary
- **DOES:** replace "auto-take the best item, drop the rest" with PLAYER CHOICE — new pure actions `takeFind`/`leaveFind`/`dropItem`/`equipItem`/`unequipSlot`; find callers stash `state.pendingFind` instead of auto-`takeItem`; a GEAR-tab keep/drop/equip UI + the find accept/decline prompt. Deliberate rules change.
- **Does NOT:** store-sell (14), item wiring (15), numbers (16).

## New PURE engine actions (all NO rng)
Mirror the `pendingJoiner`/`resolveJoiner` pattern (`encounters.js` + `actions.js` ACTION_TYPES + `engine.js` dispatch case):
- **(find) → stash:** change the auto-take callers to stash the rolled item in `state.pendingFind` + push a `findOffered` event (name/kind), NOT auto-add/equip.
- **`takeFind`:** accept `pendingFind` into `c.items` if a slot is free (`c.items.length < BAGS[c.bag].slots`); if full, keep pending + push `bagFull`; clear `pendingFind` + push `findTaken` on success.
- **`leaveFind`:** clear `pendingFind` + push `findLeft`.
- **`dropItem {i}`:** splice `c.items[i]` (frees a slot); push `itemDropped`.
- **`equipItem {i}`:** equip a bag weapon/armor onto the character REGARDLESS of better/worse (the deliberate change vs `takeItem`'s strictly-better gate) — BUT enforce class/subclass/race legality; the previously-worn item drops back into the bag (direct SWAP — no net slot change, per the locked "equip = direct swap" decision); push `equipRejected` on an illegal equip, else `itemEquipped`.
- **`unequipSlot {slot}`:** move the equipped weapon/armor back to the bag (needs a free slot); push `itemUnequipped`.
- **Refactor:** extract the legality predicates from `takeItem` (`engine/items.js:171-217`: class letter FTM, `Acrobat`→dagger, `Heft`→armor AR≤12, `RACES[c.race].noArmor`, staff→MU, + verify the Pilfer magic-item limit site) into pure helpers `canEquipWeapon(c,it)` / `canEquipArmor(c,it)` so `equipItem` AND the store buy path share ONE source of truth. `takeItem` may stay for the store's buy=auto-equip convenience or be re-pointed at the helpers.
- New event types (`findOffered`/`findTaken`/`findLeft`/`bagFull`/`itemDropped`/`itemEquipped`/`itemUnequipped`/`equipRejected`) each need an `EVENT_NARRATION` entry (formatEventsCoverage guard). Sarcastic, family-friendly voice.

## ⚠ DETERMINISM / PARITY — the critical risk of this phase
Changing the find callers (`openChest` `:142`, `findGear` `:313-324`, `findMisc` `:343-349`, `meetFaerie` `:377-383` in `engine/encounters.js`) from auto-`takeItem` to stashing `pendingFind` is a DELIBERATE DIVERGENCE from the frozen `prototype-master.js.txt` (the prototype auto-takes). Handle it correctly:
1. **FIRST determine whether any parity fixture actually drives a find encounter** (grep the fixtures under `test/parity/fixtures/`; check if any action-script move lands on a chest/gear/misc/faerie outcome). The new ACTIONS (`takeFind` etc.) are not in any fixture → they're inherently parity-safe.
2. **If NO fixture hits the find paths:** the caller change is parity-safe — proceed; full suite stays green.
3. **If a fixture DOES hit a find path:** it will now produce `pendingFind` instead of an auto-equip → that fixture diverges. Handle it the RATION-01 / `stripRationsField` way — a DOCUMENTED deliberate divergence: prefer a **targeted carve-out** (strip `pendingFind` — already stripped from Phase 12 — plus, if the divergence is in `c.items`/equipped, a scoped carve-out or fixture adjustment for JUST that find outcome). If a carve-out can't cleanly express it, adjust ONLY the specific affected fixture(s) with an explicit documented rationale. **NEVER** edit `prototype-master.js.txt`, and NEVER weaken a whole comparison (don't strip all of `c.items`).
4. New actions add NO rng; `clampCarry`/cap enforcement lives ONLY in the new gated handlers (never retrofitted into `giveItem`/`gainWilmst`). `state.pendingFind` is already carved out (Phase 12).
5. Run the FULL `npm test` after each sub-change; keep parity green.

## UI (`mazeworld.html`, presentation over the new actions)
- **Find accept/decline prompt** — when `S.pendingFind` is set, show a prompt (reuse the encounter/`pendingJoiner` overlay pattern) naming the item with **Take it** → `dispatch(takeFind)` / **Leave it** → `dispatch(leaveFind)`; on a full bag (`bagFull`), show a keep/drop chooser (list `c.items` with Drop buttons + the pending item). Add `S.pendingFind` to `hasActiveEncounter()` (like `pendingJoiner`).
- **GEAR tab keep/drop/equip** — the GEAR tab (carried-item render ~`mazeworld.html:2852-2875`) gains per-item **Equip** (weapon/armor) and **Drop** buttons dispatching `equipItem{i}`/`dropItem{i}`; show equipped weapon/armor with an **Unequip** option; show bag capacity used (`items.length / slots`). Bridge through `window.__mzState` + `dispatch` (add `window.mzTakeFind`/`mzLeaveFind`/`mzEquipItem`/`mzDropItem`/`mzUnequip` mirroring `mzResolveJoiner`). ≥48dp targets.

## Success criteria (gate)
1. On a find, the player is offered the item (take/leave) — no auto-grab (ECON-03); a full bag prompts keep/drop (ECON-04).
2. The player can equip bag items incl. inferior gear, with class/subclass/race restrictions enforced (`equipRejected` on illegal) (ECON-05); direct swap on equip.
3. New actions are pure/no-rng; new events carry narration.
4. **PARITY GATE:** full `npm test` green; the find-caller divergence handled per the rule above (documented); no `prototype-master.js.txt` edit; new actions touch no fixture.

## Hard constraints
Engine pure/deterministic; caps only in new gated handlers; deliberate find divergence documented + minimally scoped; no field/existing-event renames; new events get narration; no git; no build/deploy (orchestrator); no SUMMARY.md (policy).
