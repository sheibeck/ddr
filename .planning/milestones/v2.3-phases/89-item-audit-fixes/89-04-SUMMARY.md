---
phase: 89-item-audit-fixes
plan: 04
subsystem: combat
tags: [joiner, armour-soak, pendant, brace, derived-rng, narration, fixtures]
requires:
  - phase: 89-03
    provides: the Pendant's armed charge as halfNext = { slot, n } on any sheet; endSourceEffects disarm
  - phase: 88
    provides: the effect-source link, the `member` additive event pattern
provides:
  - "engine/combat.js#applyFoeDamageToMember: the Joiner's one damage pipeline (Pendant, Brace, armour soak and wear, breakage, the hit, downMember)"
  - "memberSoak derived stream for the Joiner's soak d20"
  - "armorSoaked, armorDestroyed, damageHalved carry `member`; memberStruck and foeBolted carry the failed `soak` die; Oracle and rail twins name the Joiner"
affects: [89-05, 89-08, phase-91, phase-92-bot-pass]
tech-stack:
  added: []
  patterns:
    - "the Joiner's twin of a hero pipeline function, routed from every foe damage site, events tagged with the additive `member` field"
key-files:
  created:
    - test/unit/joiner-armour-soak.test.js
  modified:
    - engine/combat.js
    - engine/foeAbilities.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/joiner-defences.test.js
    - test/unit/rollDirection.test.js
    - test/unit/roll-high-guard.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/unit/foe-damage.test.js
    - test/unit/honest-gains.test.js
    - docs/ROLL-LEDGER.md
    - test/parity/FIXTURE-INVENTORY.md
key-decisions:
  - "One helper (applyFoeDamageToMember) serves foeTurn's member branch and foeAbilities' member bolt/drain; the hero-only pieces (Bubble mirror, Shield ward, Hardiness, Fridgian hide) stay out (audit hands Joiner Hardiness/hide to Phase 91)"
  - "The round-damage ceiling stays with the caller and now sits before the Joiner's Brace (the hero's order)"
  - "No new event type: existing types gain the additive `member` field"
  - "No why-ledger file: the narrative corpus (synthetic events, no member field) did not change, so no changed corpus key exists to log"
requirements-completed: [ITEM-07]
status: complete
duration: ~1h
completed: 2026-09-30
---

# Phase 89 Plan 04: A Joiner's armour soaks foe hits like the hero's Summary

**A foe's swing or bolt on a Joiner now goes through that Joiner's own Pendant, Brace and armour soak (a derived-stream d20 against `armorSoak(sheet)`), wearing and breaking its own armour, narrated by name, with no main-rng draw added.**

## What changed

- `engine/combat.js#applyFoeDamageToMember(state, foe, member, rng, events, opts)` (new, exported), returning `{ downed, soaked, applied }`:
  1. the Joiner's own armed Pendant (`sheet.halfNext`) halves the blow (`damageHalved` with `member`), then clears;
  2. its Brace (`member.braced`) halves it (`braceHeld`, moved here unchanged);
  3. its own armour soaks: gate `av.wp > 0 && av.ar > 0 && !ignores`, die `rollCheck(derivedRng(cursor, "memberSoak", C.round, foe index, swing ?? -1, member.partyIdx), 20, atLeastFor(soakAr, 20))`, `soakAr` doubled (cap 20) under the Joiner's own Taunt, wear by the hero's rule on `sheet.armorWP` (race `armorWear` half wear, none at or under min, none for the Cloak of Armor's plate), `armorSoaked { member, ... }`, `armorDestroyed { member }` at 0;
  4. otherwise `member.wp -= dmg`, `memberStruck` (or `foeBolted` for a bolt) carrying `soak` when a die was drawn, `downMember` at 0.
- `foeTurn`'s member branch: the to-hit, crit, damage roll, halvings and the round-damage ceiling stay where they were; the inline Brace, `member.wp -=`, `memberStruck` and `downMember` are replaced by the helper call (passing the swing index).
- `engine/foeAbilities.js`: the member bolt/drain rolls its damage exactly as before (same main draw) then goes through the helper (`ignoresArmor` for a drain or a no-armour foe); a drain heals the foe by the hp actually applied.
- Narration (Oracle in `eventNarration.js`, rail in `narrationLines.js`): `armorSoaked`, `armorDestroyed`, `damageHalved` name the Joiner when `member` is present and are byte-identical for the hero; `memberStruck` and `foeBolted` (member form) state the failed armour roll when `soak` is present.

## Tasks and commits

| Task | Name | Commit |
|------|------|--------|
| 1 | One Joiner damage pipeline: Pendant, Brace, then the Joiner's own armour soaks and wears | `64a6c1e6` |
| 2 | Name the Joiner in the soak lines; ledger the roll; measure and declare the drift | `cdb86520` |

## Results

- `npm test`: 8,368 tests, **8,366 pass, 0 fail, 2 skipped** (base 8,342 / 8,340 / 0 / 2; +26 new tests). No CRLF doc-ledger failures appeared in this worktree run.
- `node --test "test/parity/**/*.test.js"`: 66 / 66, zero drift. `node tools/narrative-review.mjs` then `--check`: in sync (562 rows).
- Acceptance greps: `export function applyFoeDamageToMember` 1; `applyFoeDamageToMember(` 3 in combat.js (definition, JSDoc signature, the foeTurn call) and 1 in foeAbilities.js; `"memberSoak"` 1; `armorSoak(sheet)` 2; `e.member` in `eventNarration.js` 29 at base -> 34 now; `### Phase 89 plan 04` in FIXTURE-INVENTORY 1; `prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `corpus-base.json` untouched.
- Edge probes (all pinned in `test/unit/joiner-armour-soak.test.js`): a soak die exactly at the threshold soaks (and one under lets it through); a blow exactly at the armour's min soaks with no wear (`underMin`); no armour (AR 0, 0 durability, a Fridgian), a drain and a no-armour foe draw no soak die; within one blow the order is `damageHalved`, `braceHeld`, then `armorSoaked` (+ `armorDestroyed`) or `memberStruck`.
- Prohibition (a Joiner's armour never soaks with the hero's and vice versa): pinned; the hero's armour record is byte-identical after a Joiner soaks, and a bare Joiner beside a plated hero takes the blow.

## Fixture drift (Joiner soak)

Predicted: zero parity drift (no fixture meets a Joiner), state pins moved wherever a bot run fights beside a Joiner. Measured with a per-step state-hash trace against the base tree (`git archive 688c537d`):

- **Parity fixtures:** 66 / 66, zero drift; comparables unchanged.
- **Bot state pins moved: 3 of 8**, each first divergence exactly the first soaked Joiner blow; the other five byte-identical. Re-recorded alone (hand-pasted from `node tools/roll-high-baseline.mjs pins`; `save` never run), with a dated Phase 89 plan 04 comment:

| Label | Before | After | First divergence |
|---|---|---|---|
| `solo-magicuser-sorcerer` | 400 / alive / 5, `3ae31ce8...` | 400 / alive / 5, `565c5fcb...` | step 365: Google on Cedric Thorne, 9; base downs him, new engine soaks (Leather 15 -> 6) |
| `party-1` | 373 / dead / 3, `bb3e4f6b...` | 372 / dead / 3, `978f3eb0...` | step 222: Hair on Aldric Corrin, 7 soaked (Cloth 12 -> 5) |
| `party-fighter-knight` | 400 / alive / 3, `6e756e01...` | 400 / alive / 4, `ba93cb59...` | step 107: Ned on Hilda Stonecut, 9 and 3 soaked (Dwarven half wear, Leather 15 -> 8) |

- **Unit pins moved (before -> after):**
  - `joiner-defences.test.js` (to-hit face and die pins): the pinned Joiner's landed blow read `memberStruck` -> the pinned Joiner wears no armour so it still does (the pins are about to-hit, not the soak).
  - `rollDirection.test.js` `[foe-crit-vs-member:natural-best]`: probed an armoured Fighter Joiner's `memberStruck` -> the probed Joiner wears no armour.
  - `roll-high-guard.test.js` `DRAW_INVENTORY` `engine/combat.js`: `rollCheck` 22 -> 23 (the soak d20, derived stream).
  - `foe-damage.test.js` sanity source guard: `member.wp -= mDmg;` once -> `member.wp -= dmg;` once (inside the helper).
  - `honest-gains.test.js` `CLAMP_ALLOWLIST`: dropped the stale `f.wp = Math.min(f.maxWP, f.wp + dmg)` entry (the member drain heals by `hit.applied` now, already allowlisted).
- Full before/after rationale is in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 89 plan 04") and `docs/ROLL-LEDGER.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three source guards and two probes the change moved**
- **Found during:** Task 2 (`npm test`)
- **Issue:** `foe-damage.test.js`, `honest-gains.test.js` and `rollDirection.test.js` (none in the plan's file list) pinned the old inline member decrement, the old member-drain heal line, and an armoured Joiner's `memberStruck` crit probe.
- **Fix:** moved each expectation to the new engine value as described above; each declared in FIXTURE-INVENTORY.
- **Files modified:** `test/unit/foe-damage.test.js`, `test/unit/honest-gains.test.js`, `test/unit/rollDirection.test.js`
- **Commit:** `cdb86520`

### Plan adjustments (not bugs)

- **TDD order:** the new test file was written before the implementation but the tests were not committed separately in a RED commit; Task 1 is a single `feat` commit containing engine and tests (the narration-dependent tests were held back and committed in Task 2, so every commit is green).
- **No `docs/narrative-pass/why/89-04.json`:** the narrative corpus is built from synthetic events with no `member` field, so no corpus key changed (`narrative-review` is in sync without it); a why file with no rows would have had nothing to log. `docs/NARRATIVE-PASS.md` and `review.html` regenerated byte-identically.
- **Two behaviour notes, declared:** (1) the round-damage ceiling now sits before a Joiner's Brace (the hero's order): `ceil(min(dmg, cap) / 2)` instead of `min(ceil(dmg / 2), cap)`; (2) on a Joiner's lethal drain, `memberDowned` now precedes `foeDrained`.
- `src/browser/fightLog.js` and `combatBeat.js` needed no change (no hero-only reads of these events).

## Known Stubs

None.

## Threat Flags

None. No new network, auth or file surface.

## Human verification (deferred to end of run)

1. Fight beside an armoured Joiner (a Fighter in Studded): some foe hits on the Joiner are "soaked by <name>'s armour" and its HP does not drop for those.
2. Keep fighting until the Joiner's armour gives out: the Oracle says so by name.
3. The hero's own armour line in the Gear tab does not change when only the Joiner is hit.

## Self-Check: PASSED

- `engine/combat.js` exports `applyFoeDamageToMember`; `test/unit/joiner-armour-soak.test.js` exists; commits `64a6c1e6` and `cdb86520` exist on `worktree-agent-a47659121db55e6d3`; full `npm test` green (8,366 pass, 0 fail, 2 skipped).
