# DR17 — Encounter/condition UX batch (device review, 2026-09-10)

A batch of device-review UX fixes, ALL presentation-layer + one pure-read engine helper addition → PARITY-SAFE (no rng change, no serialized field, no frozen-fixture impact). Baseline: `npm test` = **676/676**, parity byte-identical. Keep it there.

## Item 1 — Active phobia shows in the condition tracker
**User:** "fear of crowds (Humans)… the oracle shows my phobia rooted me in place, but I don't see it at the top with name/subclass/hp (where poison shows). The word `phobia` should show when my phobia is active."
- The phobia "root" is `state.combat.frozen` (set in `engine/combat.js:264` when the phobia triggers; `phobiaFrozen` event). DR15-B's `conditionsOf` only surfaced `darkFor`, so the type-matched phobia (e.g. Humans) never appears.
- **Fix:** in `conditionsOf(state)` (`engine/derived.js`), add a **phobia** condition (`{key:"phobia", polarity:"bad", phobia: c.phobia}`) when the phobia is ACTIVE in the current combat — i.e. `state.combat` exists AND (`state.combat.frozen` OR `c.phobiaType === state.combat.type` OR (`c.phobia==="Darkness" && inDark(state)`) OR (`c.phobia==="Death" && c.wp <= c.maxWP * DEATH_PANIC_THRESHOLD`)). (Mirror the exact trigger combat.js uses at ~:260-264 — reuse `inDark`/the threshold so the chip is up for the whole feared fight, named.) Pure read, no rng/mutation.
- **UI:** the condition tracker (`#mm-conditions`, `paintConditions`) maps `key:"phobia"` → a BAD chip labeled e.g. `Phobia: <fear>` (use `c.phobia` for the fear name). Colorblind-safe (▼ + label). The tracker is in the map header (name/subclass/HP line) which stays visible during combat — confirm it renders then.

## Item 2 — Darkness = only the square you're on
**User:** "darkness should mean the map only shows the square you are on, and nothing else."
- `reveal()` (`mazeworld.html:2425-2426`): today `inDk → radius 1`. Change so that in darkness (`inDk && !Night Vision`) the reveal radius is **0** (only the player's own cell; nothing else), ignoring the `eff("sight")` widen (true darkness). Night Vision still negates (full radius). Non-dark stays `2 + eff("sight")`. (Amulet of Light already dispels `darkFor` → you're not in darkness if you carry it.) Verify `reveal()` with r=0 reveals exactly the occupied cell and the viewport still renders (the player marker stays drawn).

## Item 4 — One screen to confirm (Joiner accept/decline + find Take/Leave)
**User:** "Don't have two screens to get to confirmation for Joiner or for Taking/Leaving items — confirm on the screen where the encounter happens."
- Today: `joinerMet`/`findOffered` narrate as a BEAT (with "Move on"), THEN a separate screen shows the `pendingJoiner` accept/decline or `pendingFind` Take/Leave prompt.
- **Fix:** show the narration AND the choice buttons TOGETHER on ONE screen. In `window.move` (engineMove), do NOT build the intermediate beat when `state.pendingJoiner` or `state.pendingFind` is set (suppress the beat for those). In `renderEncounter`, the `pendingJoiner` / `pendingFind` prompt branches should render the encounter narration line(s) (the joinerMet/findOffered copy — still logged to the Oracle) ABOVE the accept/decline / Take-Leave buttons, so it's one screen: "you meet X … [Take them along] [Leave them]". No "Move on" step for these.

## Item 5 — See all enemies + confirm "Fight!" before combat resolves (PARITY-SAFE presentation gate)
**User:** "Combat should not start until you see all the enemies. Don't roll initiative until the player confirms Fight!"
- **Do NOT move the initiative roll out of `engine/combat.js startCombat`** — the frozen prototype rolls it inside startCombat; deferring it engine-side would break the whole combat parity suite. Instead, gate the PRESENTATION:
- When combat has JUST started (this move set `state.combat` and it hasn't been "entered" yet), `renderEncounter`'s combat branch shows the **foe roster only** (names + HP, the enemies you're facing) + a single **"Fight!"** button, and HIDES the action bar (strike/flee/spell/potion/use) and SUPPRESSES the initiative/first-turn narration. Track this with a presentation flag (e.g. `S.combat.awaitingFight = true` set when combat starts; cleared on Fight!). On **Fight!**: clear the flag, reveal the initiative result + (if foes won) the pre-emptive first-turn outcome (already computed by the engine in startCombat + sitting in the events/log), enable the action bar.
- **Ambush integration:** if the engine's pre-emptive turn already killed the player on entry (`state.dead` after the move), the Fight! gate still shows the foe roster + Fight! first; on Fight!, play the existing pre-death "They got the drop on you" beat → death card. (This supersedes the bare instant-death; the death-on-move beat from the prior fix still provides the narration.)
- Set `awaitingFight` only for a genuine combat START (not when re-rendering an in-progress fight). A wandering-monster/camp combat start should also gate (you still see the foes + Fight!). This is a new presentation-only field on `state.combat`; since `state.combat` is already nulled on rehydrate and stripped appropriately in parity (combatComparable), confirm it doesn't leak into a compared field — if `state.combat.awaitingFight` is compared, add it to the combat strip (like `round`), since it's a presentation flag with no prototype equivalent.

## Determinism / parity (all items)
- `conditionsOf` stays a PURE read (no rng, no mutation). `reveal()` is presentation. The Joiner/find one-screen merge is presentation. The Fight! gate adds only a presentation flag on `state.combat` (engine startCombat UNCHANGED — initiative still rolls there). If `awaitingFight` ends up compared by `combatComparable`, strip it (mirror the `round` carve-out). NEVER edit `prototype-master.js.txt`. No new rng anywhere.
- Full `npm test` stays green (676+).

## Success criteria
1. The active phobia shows as a named chip in the top condition tracker during the feared combat (and while rooted).
2. In darkness, the map reveals only the current square (Night Vision negates).
3. Joiner accept/decline and find Take/Leave are a SINGLE screen (narration + buttons together), no "Move on" step.
4. Stepping into combat shows the enemy roster + a "Fight!" button; initiative/first-turn outcome is revealed only on Fight!; an ambush death plays out after Fight! (not instantly).
5. Parity byte-identical; `npm test` green.
