---
phase: 43-clarity-pass
verified: 2026-09-19T02:30:00Z
status: passed
score: 5/5 success criteria verified on automated evidence; every player-facing check (cause lines, usable-by suffixes, rations panel, ON YOU / BAG, drop shelf) is deferred to the end-of-run Pixel 7 batch per the user's "defer uat to end" instruction
behavior_unverified: 0
overrides_applied: 0
human_verification: ["Pixel 7 (CLAR-01, trap): spring a trap — the A TRAP card reads 'Trap: <name> finds you first. −N hp.'", "Pixel 7 (CLAR-01, SC-1 literal): a Being-trapped hero enters a dead end — 'Being trapped: four walls and one door you already used. −N hp.'", "Pixel 7 (CLAR-01, falls): 'Fall: the wall had other plans. −N hp.' / 'Fall: short. The floor of the crevice makes its introduction. −N hp.'", "Pixel 7 (CLAR-01, spells): an Apprentice backfire / Summoner backfire / Earthquake with no ward / Death cast — each names the spell and the fee, e.g. 'Backfire: Fireball went wrong in your hands — the Apprentice tax, one time in eight. −N hp.'", "Pixel 7 (CLAR-01, store): buy anything — 'Bought: <item>. −N wilmst.'", "Pixel 7 (CLAR-01, flee): flee with a loot pile pending — 'Fled: the loot stays with them — <items>.'", "Pixel 7 (CLAR-01, Cutthroat): a descent that loses a Joiner opens 'Cutthroat: <name> …'", "Pixel 7 (HP not WP): Gear-tab rows for Cloak of Healing / Regeneration, Rowan / Poplar Staff and a Healing potion all read 'hp', never 'wp'", "Pixel 7 (CLAR-05, fed): make camp with rations at full hp — the card reads 'Rations: you eat N…' and with a Troll in the party ends 'Trolls eat for two.' before the count", "Pixel 7 (CLAR-05, camp): make camp with a heal — the card heads CAMP MADE and the Oracle shows the 'Rations: …' line immediately before the rest line", "Pixel 7 (CLAR-05, hungry): walk or camp with 0 rations — 'Hunger: nobody packed — you eat 1 a night, and you had 0. Cost of living −N hp.' ('the party eats N a night' with a Joiner; a Heft Thief also sees '(Heft: half, as promised)')", "Pixel 7 (CLAR-03, refusal): MAKE CAMP without enough rations still states need/have and the members exactly as before", "Pixel 7 (CLAR-02, find): a Fighter-only weapon (e.g. Bardiche) offered to a Thief reads '(usable by Fighters — not you)'; Mail offered to a Heft Thief reads '(usable by Fighters — and a Thief with Heft)'", "Pixel 7 (CLAR-02, loot/store): every weapon/armor/staff LOOT row shows the same suffix as the FIND card would; store rows read '(usable by Fighters)' or '— not you'; unrestricted items (Axe, Cloth) show no suffix", "Pixel 7 (CLAR-04, empty slots): an unequipped ring/bracelet/amulet/helm/cloak/staff each show an in-voice empty row; a non-Magic-User's staff slot reads 'staff — nothing, and nothing you could hold. Magic Users only.'", "Pixel 7 (CLAR-04, drop shelf): with a potion and two gear items in a full bag, the drop shelf lists only the two gear items — never the potion, never a worn ring/cloak/staff, never the weapon/armor — and tapping drops the right one", "Pixel 7 (CLAR-05, Joiner): the Joiner offer card's roll line ends '· eats N a rest' (2 for a Troll) and the Company panel reads 'Eats N a rest' from the same source", "Pixel 7 (CLAR-03, panel): the Hero tab's RATIONS panel reads the full line and 'N carried', updating immediately after Make Camp / a ration purchase / a Joiner joining", "Pixel 7 (CLAR-04, panels): the Gear tab shows ON YOU (WIELDED / WORN / ALSO ON YOU) and BAG with 'n / slots'; Use/Unequip/swap-confirm still work on ON YOU rows, Equip/Use/Drop on BAG rows", "Pixel 7 (a11y): TalkBack reads the RATIONS panel and the ON YOU head rows (WIELDED / WORN / ALSO ON YOU)", "Pixel 7 (voice): a read of every new string (cause lines, 'usable by', empty-slot rows, the RATIONS line, the FED card) in real play — deadpan, family-friendly, no tonal drift"]
gaps: []
---

# Phase 43 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-19)

Goal-backward check of the phase goal: *every cost the player pays names its cause, every loot offer shows who can use it, ration math is honest and matches what Make Camp actually charges, and the Gear screen tells the truth about what's worn versus carried.*

The last phase of v1.5. A display sweep: zero rule changes, one declared cosmetic fixture literal.

## Automated evidence (re-run by the orchestrator after 43-04)

- `npm test`: **3168/3168, 0 failures** (3002 at phase start → 3078 after 43-01 → 3112 after 43-02 → 3146 after 43-03 → 3168 after 43-04). `npm run build:www` exit 0; `grep -c fonts.googleapis mazeworld.html` = 0; `package.json`/lock unchanged; no `docs/class-pass/*.json` changed since the Phase 42 close.
- Engine gate: `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged); `git status --porcelain test/parity/fixtures` empty. The only fixture edit was the economy fixture's declared `after.items[1].txt` (`+d10+2 wp` → `hp`, re-measured, `before` untouched); the five content `wp`→`hp` rewords are a Phase 28-style cosmetic carve-out (`REWORDED_TXT_ITEMS`) at every comparable site. Nine payload keys added — all ADDITIVE, zero rng draws.
- **SC-5 hard gate run explicitly:** `toastsCoverage.test.js` + `formatEventsCoverage.test.js` + `hp-not-wp.test.js` + `test/voice/safety-scan.test.js` — 25/25 green.
- Cumulative `git diff --stat 816eaee -- engine content src mazeworld.html docs tools test/parity/fixtures` = 15 files, 840+/111−; `mazeworld.html` touched by 43-04 only.
- Four plans, four SUMMARY.md files, all `## Self-Check: PASSED`; working tree clean at HEAD `a9fb885` apart from the two untracked user directories outside the phase.

## Success criteria → evidence

| # | Success criterion (ROADMAP, SC-4 as amended by CONTEXT) | Evidence |
|---|-----------------------------|----------|
| 1 | A costly Oracle/rail line names its cause in plain language sourced from the event payload | `docs/CLARITY.md` 38-row cost-event inventory (machine-checked against `EVENT_NARRATION`); 24 lines rewritten cause-first / cost-last; nine additive keys (`trappedPanic.phobia`, `heightsFear.penalty`, `waterFear.penalty`, `backfireSelfDamage`/`summonBackfired {spell, sub}`, `earthquakeSelfDamage.spell`, `deathCast.cost`, `deathSpellTooWeak.fee`, `insanitySelfHarm.loss`); the SC-1 literal renders exactly `Being trapped: four walls and one door you already used. −4 hp.`; `clarity-cause-lines.test.js` (69). Day-cycle rows: `rationsEaten { eats, left, eaters }`, `wentHungry { need, have, mouths, heft }`. |
| 2 | Every loot offer shows "(usable by …)" when an item is class-restricted | `usableBy(it, c)` + `USABLE_COPY` (legality via the engine's own `weaponRefusalReason`/`armorRefusalReason`, staff = Magic Users; "— not you", "— and a Thief with Heft"); additive `lootCompare.usable`; wired on the FIND card, victory LOOT rows and store rows via `__mzUsableBy`; `usableBy.test.js` (25), `shell-clarity-43.test.js`. (The Joiner offer card carries no item — recorded as "none today".) |
| 3 | The Hero screen lists rations eaten per rest for the hero and each Joiner and the total, matching what Make Camp charges; the ration rules audited and ledgered | `eatsFor(sheet)` is the ONE appetite read (value-identical refactor; `nightlyEats`/`newDay`/`makeCamp` route through it); `rationsViewModel(state)` with the invariant `total === nightlyEats(state)`; Hero `#rations-panel`; Joiner offer card + Company panel read `eatsLineFor`; `docs/RATIONS.md` audits 12 rules against the frozen prototype + rulebook — **zero missing prototype rules**; two rulebook-only rules deliberately not adopted (no prototype counterpart); `rations-audit.test.js`. |
| 4 | The Gear screen is two panels — ON YOU and BAG — and the bag-full drop prompt lists bag items only | `#onyou-panel` (WIELDED weapon · WORN armor + the six Phase 37 slots with in-voice empty rows via `emptySlotRows`/`GEAR_COPY` · ALSO ON YOU slot-exempt kit) + `#bag-panel` (`c.items`, `n / slots`); `renderDropShelf` reads bag-only true-index `dropShelfItems(c)` at both call sites; the roadmap's "Carried: weapon, staff, shield" superseded (staff is worn; no shields); `gear-panels.test.js` (14). |
| 5 | `toastsCoverage.test.js` and `formatEventsCoverage.test.js` stay green — no cause string bypasses the coverage guard | Run explicitly in the whole-phase gate alongside `hp-not-wp` and the voice scan: 25/25 green. |

## Requirements

CLAR-01 ✓ · CLAR-02 ✓ · CLAR-03 ✓ · CLAR-04 ✓ · CLAR-05 ✓ — automated halves verified; on-device halves in the frontmatter `human_verification` list (21 items, de-duplicated from the 30-item aggregated checklist in 43-04-SUMMARY.md: Plan 04's items 21–23/27–28 restate Plan 03's 15–20, its 24–25 restate the eats line).

## Accepted planner/executor deviations (recorded in plan/SUMMARY frontmatter)

- Planner corrections to CONTEXT: no Death potion (the Death spell's 25-hp fee); no foe DOT on the hero; the Company panel already showed "Eats N" (re-pointed at the view model); the Joiner offer card carries no item.
- 43-01: `full-suite.test.js`'s own chargen loop and `movement-parity.test.js`'s local comparable lacked the generalized `stripCloakArmorTxt` — mirrored.
- 43-02: `[dayBegan, rationsEaten]` folds under `railCardFor`'s lowest-idx tie-break to the DAY card (same pattern `wentHungry` already had) — tests assert the real behaviour; the shared fold logic was left alone.
- 43-03: `GEAR_COPY` added to the hp-not-wp COPY walk in a follow-up commit.
- 43-04: a CSS comment tripped three raw-text style scans (reworded); two new-test helper bugs fixed (`sliceBetween` end-marker substring; HTML comments stripped first).

## Follow-ups noted (not gaps)

- The cause-first cost-line convention is now a standing rule for every future cost-bearing event (recorded in PROJECT.md at close).
- `railCardFor`'s lowest-idx tie-break (DAY card wins over FED/HUNGER titles when `dayBegan` fires in the same dispatch) — a candidate for the shell cleanup milestone, not a v1.5 gap.
