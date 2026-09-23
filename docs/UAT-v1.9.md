# v1.9 Pixel 7 device round — Phase 64 (Device Close & UAT Batch)

**Build:** the v1.9 debug APK, `ddr-v1.9-6c7aa6f-debug.apk`, full commit `6c7aa6fd722edee0f8f3ce2709607d9b75948df6`, sha256 `4e58c1ede7d34fc772e6686a6c608a0c11c37c7323f97c88e726f705870102be`, 11,013,331 bytes. It is the milestone's one debug APK, installed with `adb install -r` over the v1.8 sideload, so save data is kept. Settings still shows "Version 1.5.0 (6)" (a debug build gets no version bump). The visible tell is the new Gear tab: a slim ARMOR RATING / WILMST header and rows that open a bottom sheet.

**Protocol:** the user asked for an in-session walk (2026-09-23) over wireless adb. The orchestrator relays each check, and results are recorded as the user states them: `pass`, `fail: <what you saw>`, or `not reached`. Findings become todos, never mid-walk edits. A skipped "if available" row is recorded as `not reached`, never as a pass.

**Sources:** `.planning/phases/61-gear-rules-store-purchase-fix/61-VERIFICATION.md` (7 items), `.planning/phases/62-gear-tab-layout-rebuild/62-VERIFICATION.md` (7 items), `.planning/phases/63-action-sheet-combat-lock-accessibility/63-VERIFICATION.md` (8 items), and `63-04-SUMMARY.md`'s two carried-forward device assumptions (TalkBack reading the dialog, the hardware back button's real feel). Items were merged and reordered for one pass.

**Suggested order:**
1. Section A, the Gear tab outside a fight.
2. Section B, the action sheet.
3. Section C, at the next store.
4. Section D, in the next fight.
5. Section E, with Android's *Remove animations* on, together in one pass.
6. Section F, TalkBack, last.

## A. Gear tab layout — Phase 62 (7)

| # | Step | Who | Result |
|---|------|-----|--------|
| A1 | Open GEAR. The top shows a slim header with **ARMOR RATING** and **WILMST**, and no repeated name or class line (the HUD above already shows it). AR matches the value you'd expect. With a Cloak of Armor (if available) it shows the cloak's effective AR. | user | |
| A2 | **WORN** lists exactly five rows in order: WEAPON, ARMOR, CLOAK, JEWELRY 1, JEWELRY 2, with an `N / 5` count. Bare fists read as an empty weapon slot, in italics and in voice. Armor wear (`x/y hp`, or `destroyed`) sits in the armor row's note. | user | |
| A3 | A worn item with a power shows a USE button; use it and walk. It reads **ACTIVE** (n SQ) while running and **COOLING** (n SQ) afterwards, counting down as you step. A staff (if available) shows `k/max · n SQ`. | user | |
| A4 | **BAG** shows `used / cap` and one pip per slot. Potions and scrolls never fill a pip. Fill the bag (if convenient): the count and pips turn red and "BAG FULL · DROP OR USE SOMETHING" appears. | user | |
| A5 | Bag cards show the name, a slot tag (WEAPON / ARMOR / CLOAK / JEWELRY) and `· SWAP` when every slot of that family is full. A staff or torch card carries USE instead of a tag. An item name with an apostrophe (if available) reads normally. | user | |
| A6 | **CONSUMABLES**: the healing potion row (USE is greyed at full HP or ×0), one row per buff-potion type with `×N`, and SCROLLS `×N` with READ (greyed with a reason if you can't read). Drinking a potion from here works. | user | |
| A7 | **ALSO ON YOU** still shows rations, spell charges (Magic User), any running effects (Shield, Strength, Sense Presence…) and kills. Text size S/M/L in Settings resizes the new Gear text. | user | |

## B. Action sheet — Phase 63 (5)

| # | Step | Who | Result |
|---|------|-----|--------|
| B1 | Tap a **filled** worn row. A sheet rises with `SLOT · WORN`, the name and note, then USE (if the item has one), UNEQUIP, and a `SWAP FOR <item>` row for each fitting bag item. With a full bag, UNEQUIP is greyed with "Bag is full — free a slot first." Destroyed armor (if available) shows DISCARD. | user | |
| B2 | Tap an **empty** worn slot. It offers one `EQUIP <item>` per fitting bag item, or a greyed NOTHING TO EQUIP. | user | |
| B3 | Tap a bag **weapon or armor** card. The header shows the explained upgrade line (dice · to-hit · per-swing · upgrade / not an upgrade). A **jewelry** card offers SWAP INTO JEWELRY 1 and JEWELRY 2 by name. | user | |
| B4 | In a sheet, tap **DROP** once: it relabels "DROP IT? · tap again" and reverts after about 3 s. Tap twice quickly and the item is dropped. Every completed action (equip / swap / unequip / drop) closes the sheet and says so on the **rail**, with no toast and no text left inside the sheet. An illegal swap (if available) is greyed with its reason. | user | |
| B5 | The inline USE / ACTIVE / COOLING button on a row acts **directly** and never opens the sheet. | user | |

## C. Store and the upgrade line — Phase 61 (5)

| # | Step | Who | Result |
|---|------|-----|--------|
| C1 | *(if available: a Magic User with a Quarter Staff at a store)* Buy a **Spiked Staff**. Gold drops by its price, the staff is in the **BAG**, and the rail line says why it isn't an upgrade (d8 vs your d6 · −1 to hit …). | user | |
| C2 | A weapon or armor your class **can't use** shows its row **disabled with the reason on the row**, and tapping it charges nothing. | user | |
| C3 | With a **full bag**, a lockpicks / tool row and a not-an-upgrade gear row are disabled with "bag full — sell or drop something first". | user | |
| C4 | Buying a **real upgrade** auto-equips it, and the rail says the shopkeeper kept your old piece. | user | |
| C5 | Store weapon / armor rows, the loot screen after a fight, and a find card all show the explained line (dice · to-hit · per-swing · upgrade / not an upgrade). | user | |

## D. Combat lock — Phases 61 + 63 (3)

| # | Step | Who | Result |
|---|------|-----|--------|
| D1 | In a fight (and at the Fight! preview), open GEAR and a worn row's sheet: EQUIP / SWAP / UNEQUIP / DISCARD are **greyed** with "Not the moment to change outfits." Nothing changes if you tap them. | user | |
| D2 | Mid-fight, **USE** (staff / torch / jewelry power), a potion, a scroll, and **DROP** still work, and USE costs your turn as before. | user | |
| D3 | Open a sheet **before** a fight starts, then trigger the fight: the open sheet re-greys in place. **After** the fight, the same actions work again. | user | |

## E. Closing and reduced motion — Phase 63 (2)

| # | Step | Who | Result |
|---|------|-----|--------|
| E1 | The sheet closes on **CANCEL**, on a **tap on the dimmed backdrop**, and on the **Android back** gesture or button. Focus lands back on the row you opened it from. Back feels natural, with no double-close and no app exit. | user | |
| E2 | With Android **Remove animations** on, the sheet opens and closes instantly with no rise or fade. | user | |

## F. TalkBack — Phase 63 (2)

| # | Step | Who | Result |
|---|------|-----|--------|
| F1 | With TalkBack on, the worn rows and bag cards announce as **buttons that open actions**. Opening one reads the sheet as a **dialog** with its title. | user | |
| F2 | TalkBack reads each greyed action's **reason** (e.g. "Bag is full — free a slot first.", "Not the moment to change outfits."). | user | |

---

**Tally:** _to be filled at the end of the walk_: pass / fail / not reached.
