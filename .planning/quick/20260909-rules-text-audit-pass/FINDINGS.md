# Rules & Text Audit — Findings (2026-09-09)

Read-only audit of `engine/*.js`, `content/*.js`, `src/browser/*.js`, `mazeworld.html`.
Cross-ref `EXTRA-SCOPE.md` (E1/E3 overlap the P1 jargon-leak rows below — same fix, not separate).

## Part A — the 3 rooted items

### A1. Affliction narration ("Something is wrong with you:: , Disease.") — TWO compounding bugs
- **Bug 1 (dangling ": ,"):** `src/browser/eventNarration.js:257` `afflictionRolled` wraps only the bare roll number in `<span class="roll">`, violating the file's own convention (`:41-48`: keep dice text + trailing punctuation INSIDE the span). `mazeworld.html:5136-5144` `stripRollDetail` (used for the over-map beats overlay via `window.move=engineMove` `:5215`) strips the span + trailing space → leaves `"...you: , Poison."`.
  - **Siblings, same defect (all go through the move() → stripRollDetail path):** `eventNarration.js:80` `wanderingMonster` → "Wandering monster check: of 8 hours disturbed."; `:95-98` `trackingRolled` → "Tracking pays off: . You clock them first." (`encounterRolled` `:247` and `insanityRolled` `:260` do it correctly — models to copy.)
- **Bug 2 (wrong name "Disease"):** `content/encounters.js:11,14` ENCOUNTER_TABLES cell `"Disease"` is a generic **bucket/dispatch key** (`engine/encounters.js:179`), meaning "roll on the affliction table"; the real outcome is a SECOND d8 in `catchAffliction` (`engine/encounters.js:409-411` vs `content/afflictions.js`, a 50/50 Poison/Disease mix). `encounterRolled` narration (`eventNarration.js:247`) prints the bucket name "Disease" one line ABOVE the real (Poison) diagnosis → "it told me Disease" while catching Poison. The two affliction events always agree with each other; the mismatch is bucket-label vs real roll.
- **Also nameless (same family):** `afflictionPassed`/`afflictionCured` (`eventNarration.js:66-67`) never say what passed/cured — `engine/movement.js:195,284` push them with no `kind` (though `af.kind` is one line above).
- **Fix:** (1) rewrite `afflictionRolled` so all dice text + punctuation sits inside the span, kind stated plainly outside; (2) add `kind: af.kind` to the `afflictionPassed`/`afflictionCured` pushes + use it; (3) same span-fix for `wanderingMonster` + `trackingRolled`. **DECISION:** rename the `"Disease"` bucket to kind-neutral (e.g. "Ailment") or keep as a deliberate teaser?

### A2. Flying does not exist as a mechanic — inert `eff.fly` flag
- `content/treasure-tables.js:20` Bracelet of Flight `eff:{fly:1}` ("walls and crevices are nothing"); `:31` Cloak of Flying `eff:{fly:1}` ("flight for 20 squares, once every 50"). `eff(c,"fly")` (`engine/derived.js:23-28`) is read NOWHERE in `engine/*.js`. Inert in the 1994 prototype too (`test/parity/prototype-master.js.txt:198,208`) — not a regression.
- Roll sites that should short-circuit: `engine/movement.js:123-160` (`there.feat==="climb"/"gorge"`): climb roll `rng.d(10)-climbBonus+hPenalty` per 10ft + fall damage `:134-139`; leap roll `:143-150`. Neither checks flight.
- **Fix:** at `engine/movement.js:123` add `const flying = eff(state.c,"fly")>0;` — when true, skip roll + fall-damage, push a distinct `flownOver` event, fall through to clear the feature. **DECISION:** wire both items as a flat "has flight" gate (simple), or build the Cloak's 20-sq/50 charge-cooldown counter now (new `c.flightLeft`/`c.flightCooldown`)?

### A3. Resting auto-cures any affliction (no roll, ever)
- `engine/movement.js:274-285` `newDay`: if fed (`c.rations>=eats`), `c.affliction=null` unconditionally every night, no rng. Narration `eventNarration.js:67` states it as inevitable.
- **Fix (same block):** replace with a seeded cure roll, e.g. `rng.d(20) <= 10 + (Hardiness?4:0)` → `afflictionCured{kind}` else `afflictionLingers{kind}`. New rng only fires for a character who HAS an affliction (determinism-safe, same pattern as RULE-02's armor patch). **DECISION:** confirm Hardiness as modifier + the actual odds (10/20 is placeholder) + narration for a failed/lingering cure (new `afflictionLingers` event).

## Part B — broad sweep (prioritized)

| Pri | file:line | Problem | Fix |
|---|---|---|---|
| P1 | `engine/encounters.js:217-263` + `eventNarration.js:248-249` | `tableFour`/`tableFourNoop` `result` is the raw ENCOUNTER_TABLES cell (`"+10 WP"`, `"-3000 WM"`, `"-All armour"`) echoed verbatim — literal jargon, stale WP/WM. (overlaps E3) | Resolve to real prose/amounts in the engine switch or split into typed events each with its own narration sentence. |
| P1 | `content/treasure-tables.js:47-48` + `engine/encounters.js:349-378` `meetFaerie` + `eventNarration.js:253` | `gift` can be `"+d20 Base WP"`/`"d10 x 100 WM"` printed raw by `faerieMet`, then the SAME turn prints the real number — redundant + jargon. (overlaps E3) | Drop the raw `gift` string from `faerieMet` when a specific follow-up event exists; make it a teaser. |
| P1 | `mazeworld.html:5136-5144` `stripRollDetail` | Applied to EVERY move()-path line but only designed for the 8 feature-landing events; others (A1 siblings) break its "punctuation inside span" assumption. | Fix all offending templates (generalize A1) or scope stripRollDetail to the FEATURE_EVENT_TITLE types only. |
| P2 | `content/encounters.js:12` | Table-4 row lists `"Teleport"` TWICE (20% vs 10%) — duplicate. (= EXTRA-SCOPE E1; user confirmed remove) | Replace one occurrence. |
| P2 | `eventNarration.js:148,229,230` | `goldGained`/`buyFailed`/`bought` use `"wm"` while everywhere else spells out "wilmst". | Spell out "wilmst". |
| P2 | `eventNarration.js:66-67` | `afflictionPassed`/`afflictionCured` never name what. | See A1 fix #2. |
| P3 | `eventNarration.js:80` `wanderingMonster` | Debug-y, off-voice; also A1. | Rewrite in the sarcastic voice, dice inside span. |
| P3 | `eventNarration.js:217` `spellThrown` | Stat-block phrasing ("Fireball at Goblin: 14 vs 12."), flatter than the file. Not stripped (combat ≠ move path) → cosmetic. | Optional prose rewrite. |
| P3 | `eventNarration.js:242` `trapPoisoned` | Never names "Poison" though `encounters.js:90` sets `kind:"Poison"` — coy but player is unaware till the tick. | Optional: append "Poison." |
| P3 | `eventNarration.js:222,224` `scrollRead`/`scrollCast` | Bare "X: {spell}." style outlier. | Cosmetic. |

**Note:** `tableFourNoop` appears to be dead today (every table-4 cell has an explicit case except `"Teleport"`, intercepted by `encounterDot` before `tableFour`). Confirm before assuming the path runs.

## Decisions (LOCKED 2026-09-09)
1. **A1 bucket:** Rename ENCOUNTER_TABLES `"Disease"` bucket → **kind-neutral "Ailment"** (never contradicts the real diagnosis).
2. **A2 flying:** **Build the Cloak's charge/cooldown NOW** — Cloak of Flying = 20 squares per 50-square cooldown as real serialized state (`c.flightLeft`/`c.flightCooldown` or similar); Bracelet of Flight = always-on. Both skip crevice/wall climb/leap rolls (no roll, no fall damage) while flight is available. New `flownOver` event.
3. **A3 cure roll:** rest cure = **~50% base + Hardiness** (e.g. `rng.d(20) <= 10 + (Hardiness?4:0)`), only when the character has an affliction; failure → new **`afflictionLingers`** event/narration.
4. **E1 Teleport:** remove the duplicate. **RESOLVED.**

## Execution grouping (2 sequential executors — both touch eventNarration.js + encounters.js, so NOT parallel)
- **Batch 1 (rules):** A2 flying charge system, A3 cure roll, A1 engine-side `kind` on `afflictionPassed`/`afflictionCured`; new events (`flownOver`, `afflictionLingers`) + their narration; parity carve-out for new `c.flight*` fields (mirror 04.1's `stripDarkForField`). Files: `engine/movement.js`, `engine/character.js`, `engine/derived.js`, `src/browser/eventNarration.js`, tests.
- **Batch 2 (text/terminology, AFTER Batch 1):** A1 narration templates + `"Disease"`→`"Ailment"` bucket rename, E1 dup Teleport, E3 SP→XP/WP→HP (combat toasts `mazeworld.html:2545/2552` + `content/encounters.js:12` + `content/treasure-tables.js:47` with their dual-purpose engine parsers), P1 `tableFour`/`meetFaerie` jargon→prose + `stripRollDetail` scoping, P2 `wm`→`wilmst`, P3 cosmetic voice rewrites. Files: `src/browser/eventNarration.js`, `content/encounters.js` + `engine/encounters.js`, `content/treasure-tables.js` + `engine/items.js`, `mazeworld.html`, tests.

## Deferred to the Economy & Item Balancing milestone (NOT in this batch)
- **E2 (surface combat-usable items in the combat UI)** — needs an engine "use combat item" action + combat action-bar control, which the milestone's inventory/equip/use system will build anyway. Doing it now = throwaway work. Deferred to avoid building item-use twice (flagged to user).
