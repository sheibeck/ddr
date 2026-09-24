# Phase 71: Device-Round Polish II - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning
**Mode:** Rulings captured from the user's second Pixel 7 session on the 2.0.0 debug build. The user approved the recommended approach for each ("Do it"). The four source todos hold the full detail:
- `.planning/todos/pending/2026-09-24-rebalance-sound-levels-death-too-loud-steps-and-theme-too-soft.md`
- `.planning/todos/pending/2026-09-24-gear-tab-item-sheet-shows-the-full-stat-set-like-the-store.md`
- `.planning/todos/pending/2026-09-24-combat-lock-actions-while-a-round-plays-and-keep-the-round-summary-visible.md`
- `.planning/todos/pending/2026-09-24-long-press-an-enemy-for-a-detailed-rail-card.md`

<domain>
## Phase Boundary

Four presentation fixes on the finished v2.0 build: sound balance and volume controls, full gear stats on the Gear tab, combat input lock plus round-summary visibility, and long-press enemy details. Engine rules, content balance and network behaviour are unchanged.

**Round summary design:** D-07's band follows the user's updated mock, "Mazeworld Combat v2.dc.html" (claude.ai/design project fed8909e-860d-496e-9d31-04dd31f14a3c, which imports ios-frame.jsx and support.js). The orchestrator imports it into `design/` before the round-summary plan executes.

**Not in this phase:** the combat/store relaunch gap (backlog 999.10), the milestone close (paused by the user), and any new sounds or assets.

</domain>

<decisions>
## Implementation Decisions

### Sound levels and volume sliders (POLISH-05)
- **D-01 — Per-clip levels in code, not the mp3s:** add a frozen `CLIP_GAIN` table in `src/browser/sfx.js`, keyed by clip id, with a default of 1.0 and a cap of 2.0. It applies through a per-voice gain before the effects bus. Starting values: `death` 0.5, every `walk*` and `walk-water*` clip at 1.6. Leave `foe-die` at 1.0 unless the planner finds it is the hero-death cue. It is one table the user can hand-tune by clip id, and a test asserts that every key is a real clip and every value is in (0, 2].
- **D-02 — Theme louder:** `MUSIC_GAIN` goes from 0.5 to 0.9.
- **D-03 — Three sliders under Sound:** MASTER, MUSIC and EFFECTS, directly under the Sound On/Off row in the settings sheet, rendered only while Sound is On and removed entirely when it's Off.
  - Persist them in `ddr.settings.v1` as `volMaster` / `volMusic` / `volEffects`, integers 0–100, default 100. Old blobs read the defaults with no migration.
  - MASTER sets the device master gain. MUSIC multiplies `MUSIC_GAIN` on the theme's gain node. EFFECTS multiplies a new effects bus between the one-shot voices (after `CLIP_GAIN`) and the master.
  - Changes apply live while dragging, including to a playing theme. A single `ui-tap` preview plays when EFFECTS is released.
  - Native range inputs styled in the house settings look, with 44px targets, text sizes S/M/L, and no motion under reduced motion. Update `shell-gear-toolbar`'s settings-key pin (8 → 11 keys).

### Gear tab full stats (POLISH-06)
- **D-04 — One shared stat formatter:** find the exact stat fields and formatters the store row renders (`storeScreen.js` with `viewModels.js`: `armorDisplay`, `usableBy`, etc.) and extract ONE shared `itemStatLines(item, state)` or equivalent pure formatter.
  - The store and the Gear tab action sheet (`gearSheetModel` / `renderGearSheet`) both render from it. A test asserts the two surfaces show an identical stat list for the same item, for worn and bag items across the item kinds.
  - The sheet keeps its header, the lootCompare/upgrade line and the actions. Stats wrap as rows or chips so the actions stay reachable at text size L.

### Combat input lock and round summary (POLISH-07)
- **D-05 — Visible lock:** while a round's beats are playing, every combat action renders visibly unavailable: dimmed, `aria-disabled`, no press feedback. Taps are never queued or replayed after the round settles, and a test pins that. The actions re-enable the moment the round settles.
- **D-06 — Tap to skip:** a tap on the combat screen during playback, including on a locked action, fast-forwards the round to its result, like a tab switch or opening the ☰ (Phase 70 R-C). The skip only reveals the result; it never acts.
- **D-07 — Round summary band:** a fixed band just above the action buttons always shows the latest round's summary, one or two lines. The full round text or log stays scrollable above it. With several foes the band stays in view at text size L with 3+ foes, and it must not cover the foe cards or the actions. Check backlog 999.5 (Combat screen & Oracle readability) and fold any overlap into this plan's notes.

### Long-press enemy details (POLISH-08)
- **D-08 — Gesture:** a long press of about 450–500 ms on a foe card in combat and on any encounter screen that shows a foe.
  - It must never also fire the short tap: targeting and other existing tap meanings are unchanged.
  - It cancels on move or scroll, gives a light haptic on trigger through `@capacitor/haptics`, and suppresses the WebView text-selection and context menu on foe cards.
- **D-09 — Rail card content:** built from `content/bestiary.js` and the live foe state:
  - name and family
  - HP current/max (HP, never WP)
  - defence/armour, attack and damage range
  - abilities, resistances and current effects on this foe
  - one deadpan flavour line
  Show only what the player could plausibly know; never invent hidden values.
- **D-10 — Rail rules:** it's a no-decision card, so a body tap dismisses it. It holds until dismissed while in combat, otherwise it uses the normal RAIL_HOLD. It never appears over the title or roller, and a new long press replaces it.
- **D-11 — Accessibility:** foe cards expose a "Details" accessible action that raises the same card, for TalkBack users.
- **D-12 — Pure view model:** tested for every bestiary family and for a malformed or unknown foe. New copy is registered in the voice safety and HP-not-WP scans.

### Enemy condition chips for every ability and spell (POLISH-09)
- **D-14 — Every foe-affecting condition shows as a chip:** user report (2026-09-24): "the hamstring ability doesn't show up on enemies as a condition chit. Let's make sure conditions from all abilities, spells show up on enemies when affected."
  - `foeStatusBadges(f)` (`mazeworld.html` ~L3621) is a hand-written list that misses at least `t.hamstrung` (Hamstring) and `t.marked` (Mark), and likely the Pommel / Dirty Trick effects (`engine/abilities.js` apply* functions).
  - Enumerate every foe-state field the engine sets from an ability, a spell or an item: `engine/abilities.js`, `engine/magic.js` and `engine/combat.js`, plus the combat-wide flags like `S.combat.weakened`. Move the chip mapping into ONE pure table in `src/browser/` (label, tone, optional rounds), and have `foeStatusBadges` / `chipsFor` read it.
  - Add a coverage test that fails if any foe-affecting effect key the engine can set has no chip entry: scan the engine's assignments to foe fields, or keep an explicit, pinned list next to the apply* functions.
  - Chip wording follows the house style ("Hamstrung", "Marked", with rounds where the effect is timed). Tones follow the existing convention: a foe debuff is "good" for the player. Any chip content for these conditions matches D-09's long-press card, which reads from the same table.
  - Presentation only, engine untouched.

### Close-out
- **D-13 — Device build:** after the last plan merges, the orchestrator rebuilds the debug APK and installs it on the Pixel 7 with `adb install -r` (keeps the save), and every Phase 71 device check is folded into `docs/UAT-v2.0.md` as a new section M. Each source todo moves to `.planning/todos/done/` when its plan lands.

### Claude's Discretion
- Plan split and waves: sound (sfx.js, settings.js, settings sheet), gear stats (gearSheet/storeScreen/viewModels), and combat (the encounter view, beats playback, foe cards, rail) touch mostly separate files. Keep plans that share `mazeworld.html` in different waves.
- Exact slider styling, the band's typography, the rail-card layout and the flavour wording, in the house deadpan voice.

</decisions>

<code_context>
## Existing Code Insights

- Audio: `src/browser/sfx.js` (device open, master gain, one-shot voices, `startLoop` / `MUSIC_GAIN` from quick 260924-51h), `src/browser/titleMusic.js`, `src/browser/settings.js` (`ddr.settings.v1`, 8 keys), and the settings sheet in `mazeworld.html` (the Sound row).
- Gear/store: `src/browser/gearSheet.js` (`gearSheetModel`, `renderGearSheet`), `src/browser/gearTab.js`, `src/browser/storeScreen.js`, `src/browser/viewModels.js`.
- Combat: `renderEncounter` and the beats playback in `mazeworld.html` (Phase 70 R-C already finishes a round on ☰ open or tab switch), the foe cards, Phase 63's combat lock and action sheet, the rail (`window.mzRailLine` / `renderRail`, one card at a time), `content/bestiary.js`.

</code_context>

<deferred>
## Deferred Ideas

- The combat/store relaunch gap → backlog 999.10.
- The title chip's "?" face → user not yet decided; leave as is.

</deferred>
