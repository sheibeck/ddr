# Extra scope added mid-audit (2026-09-09)

These two items were added by the user after the audit sweep was already running.
Fold them into the fix plan alongside the audit FINDINGS.

## E1 — Remove redundant "Teleport" from the red-dot encounter list
When the player hits a red-dot (feature/encounter) tile, the list of encounter
options/results includes **Teleport** — but teleport already exists elsewhere in
the game (a spell/item), so it's redundant here. Remove teleport from the
red-dot encounter options/table. (Likely in `engine/encounters.js` — the
feature/encounter result table dispatched on a red-dot tile — and/or wherever
those options are presented. Confirm where the duplicate lives and remove only
the encounter-list teleport, NOT the existing spell/item teleport.)

## E2 — Surface combat-usable items in the combat encounter UI
Items that have a **combat effect** (e.g. Cloak of Fortitude) should appear in
the combat encounter panel during combat, so the player can use them easily
mid-fight (like the POTION/SPELL action buttons already do). Today the combat
action bar exposes strike/potion/spell/flee etc. but not usable combat items.
- Identify which items carry a combat-usable effect (content items + `eff()` /
  item-effect keys in `engine/derived.js` / `engine/items.js`).
- Determine how such an item is "used" through the engine (dispatch action) —
  if no "use item" action exists in combat, this needs one wired through
  `applyAction` (pure), plus a combat action-bar control in `mazeworld.html`
  (`renderEncounter`) and toast/feedback.
- Keep engine pure/deterministic; player-facing only where UI.

Both are presentation+rules items; E2 is the larger (may need a new engine
"use combat item" action + UI). Confirm scope from the audit findings before
executing.

## E3 — Convert remaining uppercase SP→XP and WP→HP (missed by Wave 1's lowercase pass)
Wave 1 (04.1-01) renamed lowercase "wp"→"hp" and the phrases "skill
points"/"Win Potential", but uppercase abbreviations "SP" (skill points) and
"WP" (Win Potential) survive in several player-facing spots. Confirmed sites
(pre-audit grep — the audit FINDINGS may add more):

- **`mazeworld.html:2545`** — combat toast `` `Hit — ${dmg} WP...` `` → **HP** (player sees every hit).
- **`mazeworld.html:2552`** — combat toast `` `Potion — +${heal.amount} WP` `` → **HP**.
- **`content/encounters.js:12`** — ENCOUNTER_TABLES results row: "+10 WP", "-10 WP",
  "+10 SP", "+25 WP", "+25 SP", "-15 WP" → WP→HP, SP→XP. **Also contains the
  duplicate "Teleport" (E1).** ⚠ These strings are DUAL-PURPOSE (display label AND
  the key the engine matches to apply the effect) — must be changed together with
  their parser in `engine/encounters.js` (the effect dispatch that reads this row),
  atomically, exactly as Wave 1 did for Table Four / the FAERIE gift table. Do NOT
  blind find-replace.
- **`content/treasure-tables.js:47`** — "+d20 Base WP", "-d10 Base WP" → **HP**;
  same dual-purpose caution — update the treasure parser in `engine/items.js`
  (or wherever these are consumed) in the same change.
- **LEAVE (not player-facing):** `mazeworld.html:1433/1739/3128` are dev/rulebook
  reference COMMENTS mentioning the book's "WP"; not shown as game text.

Rule as always: change PLAYER-FACING TEXT + any parser key that must match it;
NEVER rename engine state fields/identifiers (`c.sp`, `c.wp`, `c.maxWP`,
`c.armorWP`, `.wp` data keys).

## E4 — Foe health shows current/current instead of current/max (BUG, live)
User hit a foe for 15 (start 20/20) and the panel showed **5/5** — should be **5/20**.
- Render: `mazeworld.html:4467-4472` iterates `C.foes` (`C = S.combat`, `mazeworld.html:4438`) and prints `` `${Math.max(0,f.wp)} / ${f.maxWP} hp` `` — reads `f.maxWP` (correct casing).
- Engine: `engine/combat.js:124-136` creates foes with BOTH `wp` and `maxWP` (= `picked.wp` = 20); damage never lowers `maxWP`. So an engine foe is 5/20.
- **BUT** `engine/combat.js:145` `encounterStarted` event maps foes to `{name, lvl, wp}` — **drops maxWP**. Suspect the live page builds/syncs `S.combat.foes` from that event (or a mapping) so each rendered foe's `maxWP` ends up equal to current `wp` (→ 5/5). Also note classic dead code `mazeworld.html:3514` builds a foe with `maxWP: c.wp`.
- **Fix:** ensure the rendered `S.combat.foes` carry the engine's real starting `maxWP` (stable across damage). Trace how `S`/`S.combat` is synced from `window.__mzState` and make foe `maxWP` = the creature's starting HP, not current. Add/adjust the `encounterStarted` event payload to include `maxWP` if the sync depends on it. Files: `mazeworld.html` (sync/render) and possibly `engine/combat.js:145` (add `maxWP` to the event) — the latter is an ADDITIVE event-field change (safe; update any snapshot test).

## E5 — Poison-at-1hp infinite loop (BUG, game-breaking, live)
Once poison has floored you at 1 hp it keeps printing "Poison has taken everything it can. You are on one hp." every step and never clears — user is stuck in a loop.
- Root cause: `engine/movement.js:214-228` affliction tick. `l = min(roll, max(0, c.wp-1))` clamps so poison never kills → at 1 hp, `l=0`. The affliction only clears when `--af.left <= 0` (a fixed duration), so while `af.left` remains it keeps ticking a harmless loss-0 hit with the loop message. Narration: `eventNarration.js:70` (loss===0 branch) + classic `mazeworld.html:2891`.
- **Fix (user's ask):** when the tick can take nothing more (`l === 0`, i.e. `c.wp <= 1`), **auto-clear the affliction** immediately (set `c.affliction = null`, push `afflictionPassed{kind}`) instead of looping. e.g. `if (l === 0 || --af.left <= 0) { c.affliction = null; events.push({type:"afflictionPassed", kind: af.kind}); }` — and ideally suppress the loss-0 "taken everything it can" tick message when it's clearing so it reads as a clean "it burns out / passes." Log as DELIBERATE RULES CHANGE. Add a test: poison at 1 hp clears on the next tick and stops emitting the loop message.

## E6 — Clear the Oracle log when starting a new character (BUG/UX, live)
The Oracle message log carries over into a fresh run. On new-character / new-run start, **reset the log** so a new character starts with an empty Oracle.
- Fix: in the new-run path (`startNewRun` bridge / the classic `newGame`/reset in `mazeworld.html` — the log entries array feeding the Oracle `#log`), clear the accumulated log entries. Presentation-only (the log is a UI accumulation, not engine state). Ensure it clears on BOTH the death→new-run one-tap and the "Abandon character → new" path.

## E7 — Backstab "Critical" narration fires on a MISS / no damage (BUG, live)
User (Elven Con Artist Thief) saw "A blade in the back. Critical." but no creature took damage.
- `engine/combat.js:312-323`: opening strike sets `crit = true` and pushes a `backstab` event (`:323`); narration `eventNarration.js:136` = "A blade in the back. Critical." Suspected: the backstab/crit event is emitted regardless of whether the opening strike's to-hit actually LANDS (or damage is applied), so a missed opening backstab still announces "Critical" with 0 damage. Classic mirror at `mazeworld.html:3634-3639`.
- Fix: only announce backstab/"Critical" AND apply doubled damage when the opening strike hits (or make it an explicit auto-hit if that's the intended Thief rule — see `mazeworld.html:1420` "every Thief opens with a backstab (doubled damage)"). Test: missed opening strike emits no `backstab`; a landed one emits it + doubled damage. Touches `engine/combat.js` — run AFTER the E4 bugs batch.

## E8 — Cloak of Armor ("acts as plate") is inert; must operate as armor over worn leather (BUG/wiring, live)
- `content/treasure-tables.js:30`: Cloak of Armor `eff:{cloakArmor:1}` ("a full suit of plate that weighs nothing"); `cloakArmor` is READ NOWHERE (inert like `eff.fly` was). Armor model in `content/armors.js` (Plate `ar:15,wp:45`; Leather `ar:6,wp:15`); soak system `engine/combat.js:693-702` on `c.ar`/`c.armorWP`/`c.armorMax`.
- Fix: when the character carries the Cloak of Armor (`eff(c,"cloakArmor")>0`), effective armor operates as **Plate** — take-the-better of cloak-plate vs worn armor `ar`/soak, cloak supplies plate `ar`/`wp` pool. Keep engine pure. Test: a Leather+Cloak-of-Armor character soaks as Plate. Overlaps the Economy & Item Balancing milestone (armor/equip) but it's a live broken/inert item — wire it now (mirrors the `eff.fly` fix). Touches `engine/derived.js`/`engine/combat.js` — run AFTER the E4 bugs batch.

## E9 — Dead character not recorded on the Dead/graveyard screen (BUG, live)
User's Con Artist died but did NOT appear on the Dead screen / graveyard.
- Investigate the death → graveyard-persist path: `engine/death.js` (die/epitaph), the adapter's `persistGrave`/graveyard write (`src/browser/engineAdapter.js`), and the Dead-screen render in `mazeworld.html` (graveyard list). Determine whether the death event failed to write the character to the graveyard store, or the Dead screen doesn't re-fetch/render it (note Phase 5's planned "re-fetch-on-open" graveyard fix — this may be the same class of bug surfacing now).
- Possible causes: (a) graveyard entry not written on death (async `persistGrave` not awaited / race), (b) Dead screen reads a stale in-memory list and doesn't re-load from storage on open, (c) the engine-routed death path doesn't call the graveyard write at all. Root-cause first, then fix so every death appends to the graveyard and the Dead screen shows it. Add a test at the adapter/engine level (death → graveyard contains the character). ⚠ May touch `engineAdapter.js`/`mazeworld.html`/`engine/death.js`.

## E10 — "+3000 WM" Table-Four encounter triple-narrates + leaks "(tableFour)" (BUG, TEXT batch)
User hit the `+3000 WM` encounter and saw THREE messages, one containing the raw internal token "(tableFour)". Root cause in `engine/encounters.js:247-249` (the `"+3000 WM"` case of `tableFour()`):
```
case "+3000 WM":
  gainWilmst(state, 3000, "tableFour", rng, events);   // → goldGained narration
  events.push({ type: "tableFour", result });           // → raw "+3000 WM" beat AGAIN
```
On top of the `encounterRolled` roll line, the player therefore sees:
1. `encounterRolled` (`eventNarration.js:257`): "Table 4, roll N: The dice decide — +3000 WM." (raw jargon result)
2. `goldGained` (`eventNarration.js:158`): `+${amount} wm (${why})` → **"+3000 wm (tableFour)."** — the internal source label `"tableFour"` passed as `why` LEAKS to the player, and it reads "wm" not "wilmst" (P2).
3. `tableFour` (`eventNarration.js:258`): echoes the raw `result` string → **"+3000 WM"** a second time.
**Fixes (fold into the Text batch):**
- **Stop the `why` leak.** The `why` arg of `gainWilmst` is an internal source tag ("chest", "off the body", "grimoire", "faerie", "tableFour"…) and should NOT be surfaced raw. Either (a) drop the `(${why})` suffix from `goldGained` narration entirely, or (b) map the internal tags to nothing/player-facing prose. Simplest + safest: remove the `(${why})` suffix from `goldGained` (`eventNarration.js:158`) so no source tag ever leaks. Check every `gainWilmst` call site — none of the tags are player-friendly, so dropping the suffix is correct across the board.
- **wm → wilmst** in `goldGained` (part of P2). Also audit sibling gold/shop lines using "wm" (`bought`/`buyFailed` `:239-240`) — user-facing currency should read **wilmst** consistently (confirm the game's canonical spelling before mass-changing; treat "wm"/"WM" as the abbreviation to expand).
- **Kill the redundant raw-jargon beat.** For rows where `gainWilmst`/an effect already narrates the outcome (the `+N WM`, `+/-N WP`, `+/-N SP` numeric rows), the extra `events.push({ type: "tableFour", result })` with the raw table string is double-narration of dev jargon. Prefer: for these numeric-effect rows, do NOT also push the raw `tableFour` beat (the gold/hp/xp event already tells the story); reserve the `tableFour`/`tableFourNoop` beats for rows that have no other narration. If that's too broad for this batch, at minimum convert the raw `result` strings to prose so the beat reads as a sentence, not "+3000 WM". Coordinate with E3 (WM→HP/SP→XP casing) and P1 (tableFour jargon→prose) — same code path.
- ⚠ These row strings are DUAL-PURPOSE (display + the key the `switch` in `tableFour()` matches). Change the parser `case` labels and the `content/encounters.js:12` row TOGETHER, atomically, exactly as Wave 1 did. Do NOT blind find-replace.
**Balance:** +3000 wilmst is also just too generous — logged to the Economy & Item Balancing milestone (see that spec). The Text batch fixes the DISPLAY; the milestone retunes the AMOUNT.

## E11 — Epitaph editorial polish (TEXT, user-requested 2026-09-09; "full editorial polish pass")
Reviewed the whole `content/epitaphs.js` EPITAPHS bank + the death-screen assembly. The bank is strong; only three lines read awkwardly / leaked jargon. **DONE (applied directly to `content/epitaphs.js`, parity-safe — parity never compares epitaph strings; death.test.js 16/16 green):**
- combat: "Died as {name} lived: needing a 5, and getting whatever that was." → "…needing a 5 and rolling whatever that was." (smoother).
- combat: "…“it’s nearly dead.” It was nearer than {name}." (dangling "nearer than") → "…“it’s nearly dead.” True of someone in the room, just not the {foe}." (uses {foe}, present & filled in the combat bank).
- fall: "Climbing is a 2vp skill. {name} bought Cooking." (raw "2vp" cost jargon) → "Climbing was there to be learned. {name} spent the points on Cooking."
Constraint honored: only tokens `epitaphCtx` provides (name/foe/sub/race/floor/day/sp/gold/motive/lvl) were used, so death.test.js's no-unfilled-token check still passes; determinism unchanged.
**STILL PENDING (for the Text executor — `mazeworld.html` is held by the Bugs B executor):** gravestone stat label `<dt>Skill pts</dt>` at `mazeworld.html:4292` is stale pre-04.1 terminology → change to **Experience** (or "XP") to match the 04.1 skill-points→XP rename. (The epitaph bank itself already says "experience points" correctly.)

## E12 — Graveyard rework: cap 5 shown, running total, no clear button, name dedup (FEATURE, user-requested 2026-09-09)
A cohesive rework of the graveyard, to run as its own batch AFTER Bugs B (E9 just touched the same graveyard code) and BEFORE the Text batch (shares `mazeworld.html`). Four parts:
1. **Only keep the last 5 graves** shown/stored. On write (`src/browser/engineAdapter.js` `persistGrave` — the `died`-event choke point that writes `GRAVE_KEY`), after appending the tombstone, trim the stored array to the most recent 5. The classic in-memory `graves` array + `renderGraves()` (`mazeworld.html`) then naturally show ≤5. (E9's fix already re-fetches on Dead-tab open.)
2. **Running total of ALL dead** — a separate persisted counter (e.g. `GRAVE_TOTAL_KEY` / a `total` field), incremented on every `persistGrave`, NEVER trimmed. Surface it on the Dead screen — change the `#yard-count` copy (`mazeworld.html:4269`) from "N interred" to reflect the true total, e.g. **"Showing last 5 of {total}"** (or "{total} interred" with only 5 stones rendered). Keep the empty-state copy for total 0.
3. **Remove the clear button.** Delete the `#btn-clearyard` control + its handler (`mazeworld.html:4624` `document.getElementById("btn-clearyard").onclick = …`) and the button element in the DEAD-tab markup. (Total must be non-clearable by design now.)
4. **No name reuse over the last ~25 dead** (user chose the WIDER window: last ~25, even though only 5 graves show). Determinism-safe design (REQUIRED):
   - `engine/character.js:98` `nameFor(rng, r) = rng.pick(NAMES[r]||NAMES.Human)` is ONE rng draw inside the parity-critical `rollCharacter(rng)` (draw order frozen against `prototype-master`). Add an optional exclusion param: `nameFor(rng, r, exclude=[])` — still make EXACTLY ONE `rng.pick` (same draw count), then if the picked name ∈ `exclude`, walk FORWARD deterministically through `NAMES[r]` (modulo length) to the next name not in `exclude`, consuming NO further rng. If all names are excluded (window ≥ pool), fall back to the raw pick. With `exclude` empty/absent → byte-identical to today → parity stays green with NO comparables carve-out (verify: an empty-exclusion `rollCharacter` still matches the master).
   - Thread the exclusion list in from the NON-engine layer: persist a `recentNames` list (last ~25 names, capped separately from the 5-grave cap — so it survives even as graves trim) in the adapter on each death; on new-character roll, read it and pass as `exclude` to `rollCharacter`/`nameFor`. `rollCharacter` must accept & forward the exclusion (additive optional arg, default empty). Parity/unit tests that call `rollCharacter(rng)` with no exclusion are unaffected.
   - ⚠ Do NOT re-roll on collision (extra rng draws would shift EVERY subsequent chargen roll and break parity across all fields). The forward-walk-without-rng is the whole point.
**Files:** `engine/character.js` (nameFor + rollCharacter exclusion arg), `src/browser/engineAdapter.js` (persistGrave: cap-5 + total counter + recentNames persist), `mazeworld.html` (remove clear button, total-aware count copy, thread recentNames into the new-char roll), + a new storage key or two. Add tests: persistGrave caps at 5 while total keeps climbing; `nameFor` with an exclusion returns a non-excluded name and makes exactly one rng draw; empty-exclusion `rollCharacter` still byte-matches the pre-change roll.
