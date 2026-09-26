---
created: 2026-09-25T00:00:00.000Z
title: Hero sheet damage range leaves out bonuses the engine applies
area: ui
files:
  - src/browser/heroTab.js (damageBracket; the #s-dmg line)
  - engine/derived.js (weaponDamage, the truth)
---

## Problem

Found by the Phase 75.2 planner (2026-09-25). The hero sheet's damage range (`damageBracket`) leaves out Master of Arms' +2, which `engine/derived.js#weaponDamage` includes. The `#s-dmg` line also leaves out Heft, Master of Arms and might. As a result, the sheet can show a lower damage range than the engine rolls. This predates Phase 75.2.

## Solution

Derive the sheet's damage range from the same engine function (or a derived.js helper it shares) so it can't drift. Add a sheet-vs-engine agreement test in the style of the Phase 74 sign guard.
