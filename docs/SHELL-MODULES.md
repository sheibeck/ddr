# Shell modules

`mazeworld.html` is a mount point. The Gear tab, the Hero tab and the Store
screen render from named `src/browser/` modules — `gearTab.js`, `heroTab.js`
and `storeScreen.js` (Phase 47), and the character roller mounts from
`roller.js` (Phase 50). The GEAR tab's bottom action sheet renders from
`gearSheet.js` (Phase 63). The DEAD tab's Leaderboards panel renders from
`boardsPanel.js` over the pure `boardsView.js` view model (Phase 66). The
Play Games account (Phase 67) comes from three modules: `playGames.js` (the
provider seam), `account.js` (the pure view model) and `accountChip.js`
(the chip and sheet renderers plus the account controller). The global
boards (Phase 68) add five: `scoreTag.js` (the score tag), `boardScores.js`
(the per-board score encodings and leaderboard IDs), `pgsQueue.js` (the
durable submission queue), `globalBoards.js` (the fetch-and-cache
controller for ALL and FRIENDS) and `placement.js` (the rank line and rail
card views). The
contract below is what those modules implement, and every `window.__mz*`
bridge crossing the classic-script/module-script seam is listed in one
place, with an owner.

## Contract

Each tab module exports one render function:

- `renderGearTab(host, state, deps)`
- `renderHeroTab(host, state, deps)`
- `renderStoreScreen(host, state, deps)`

- `host` — the mount element (`#screen-gear`, `#screen-hero`, `#enc-body`).
- `state` — the engine state (`S`).
- `deps` — the object the classic script's `tabDeps()` builds, each key an
  action closure over the matching `window.mz*` bridge: `guardTap`,
  `useItem`, `equipItem`, `unequip`, `dropItem`, `sellItem`, `takeLoot`,
  `leaveLoot`, `buyItem`, `leaveStore`, `dismissJoiner`, `castSpell`,
  `drinkPotion`, `readScroll`, `openGearSheet`, `closeGearSheet` (16 keys).
  Phase 62 (GSCR-06): the rebuilt Gear tab's CONSUMABLES section dispatches
  the HEALING POTION and SCROLLS rows through `deps.drinkPotion`/
  `deps.readScroll` — no new engine action, no new bridge; both close over
  the existing `window.mzDrinkPotion`/`window.mzReadScroll` bridges. Phase 63
  (GSCR-07..10, GRULE-02): `openGearSheet`/`closeGearSheet` are closures over
  the classic sheet lifecycle — the Gear rows call
  `deps.openGearSheet(target, openerId)` to open the action sheet, and the
  sheet's own actions call `deps.closeGearSheet()` before dispatching.

Rules:

- A module reaches the page only through `host`, `host.ownerDocument` and
  `deps` — **never** `window`/`document` globals.
- A module imports `content/`, `engine/` and `viewModels.js` directly; it
  never re-derives what an import already gives it.
- `paint()` makes exactly one call per surface: `window.__mzTabs.gear(host,
  S, deps)`, `window.__mzTabs.hero(host, S, deps)`. `renderEncounter()`'s
  `S.store` branch becomes one `window.__mzTabs.store(host, S, deps)` call.
- `window.__mzTabs = Object.freeze({ gear, hero, store })` is assigned by
  the module script BEFORE the first `paint()` call — the same discipline
  as `window.__mzControls`/`window.__mzTables`.
- The shared carried-item list (`renderCarriedList`, exported by
  `gearTab.js` once it lands) is reached by the classic loot card through
  `window.__mzCarriedList`.

### Screens

`src/browser/roller.js` (Phase 50, ROLL-01) is a different shape from the
three tab modules above: a stateful factory rather than a stateless render
function, because the roll screen owns mutable presentation state (the roll
token, the serialized roll chain, the pending rolled state, its timers)
across its own async reveal sequence.

`createRoller` is the mount factory the shell calls once, at module-script
load time, with the shell's own `document` and seams:

```js
const roller = createRoller({ doc: document, startNewRun, sheetFor: characterSheetViewModel, onCommit });
window.mzStartRoll = roller.start;
```

`createRoller({ doc, startNewRun, sheetFor, onCommit, timers, random, words })`
returns `Object.freeze({ start, commit, pending, dispose })`:

- `doc` — the Document the module reads/writes through — only via
  `getElementById` on the eight `mw-roller-*` ids (`ROLLER_IDS`); never a
  global.
- `startNewRun` — `src/browser/engineAdapter.js`'s new-run seam, called with
  no arguments and serialized through an internal promise chain so it is
  never in flight twice, even under rapid re-entry.
- `sheetFor` — the injected view-model reader; the shell wires
  `heroTab.js`'s `characterSheetViewModel`, the SAME rng-free, DOM-free view
  model the Hero tab itself renders from, so the reels and the Hero tab can
  never disagree.
- `onCommit(state)` — called once the CTA fires on a fully-revealed roll;
  the shell's mount wires it to `commitRolledState(state)` followed by
  `window.__mzShowTab("maze")`.
- `timers` / `random` / `words` — test seams; default to the global timer
  functions, `Math.random`, and `reelWordLists()` (the cosmetic `{ race,
  cls, sub }` word lists built from `content/index.js`'s RACES/CLASSES).

The mount assigns `window.mzStartRoll = roller.start` — the one bridge name
both roll triggers (the title screen's ENTER button, and the ☰ menu's
dead-state NEW CHARACTER row, Phase 70) call. The same never-`window`/`document`
invariant every other module in this doc follows applies here too — the
factory reaches the page only through the injected `doc`.

A monotonic roll token guards re-entry: if `start()` is called again before
a prior roll's `startNewRun()` resolution has been read (a superseded roll —
double-tap, or a re-tap mid-reveal), that stale resolution is dropped before
it touches a reel or the pending state, and every reel lock plus the CTA
always read the SAME pending object — never a `sheet` captured once and
reused later.

### Gear action sheet (Phase 63)

`src/browser/gearSheet.js` (GSCR-07..10, GRULE-02) exports `GEAR_SHEET_COPY`,
`gearSheetModel(state, target)`, `GEAR_SHEET_IDS` and
`renderGearSheet(host, state, target, deps)` — the ONE bottom action sheet
behind every equip/swap/unequip/use/drop decision on the GEAR tab, for
either a WORN slot (`{ from: "worn", slot }`) or a BAG card
(`{ from: "bag", i, n }`) target.

The classic script owns the sheet's lifecycle, never the module: `openGearSheet(target, openerId)` renders through the bridge and shows the
panel; `refreshGearSheet()` (called by `paint()` whenever a sheet is open)
re-derives it from `S` and the stored target every frame — greying it in
place when a fight starts (GRULE-02), closing it when the target vanishes;
`closeGearSheet()` hides it, stamps `lastDismissAt` and returns focus to the
opener. The scrim tap and the Android back button both close it too.

`window.__mzGearSheet` is the one bridge — the module script assigns it to
`renderGearSheet` before the first `boot()`; the classic script's
`openGearSheet`/`refreshGearSheet` are its only callers.

### Leaderboards panel (Phase 66)

`src/browser/boardsView.js` exports `boardsView(input)` — the D-15 pure
view-model seam. Given `{ bests, graves, total, board, scope, open, entry,
hasHero, signedIn, recentHash }` it returns everything the panel renders:
the header (title, scope line, INTERRED count), the identity strip (`null`
on GRAVEYARD, otherwise the signed-out glyph/label/source and dimmed ALL/
FRIENDS chips), the seven-chip board rail, the active board's mark/title/
rule line, the body (`rows` | `empty` | `note`), the standing card and the
footnote. It is a pure function of its input — no DOM, no storage read —
built entirely from `engine/records.js` and `content/boards.js`.

`src/browser/boardsPanel.js` exports `renderBoardsPanel(host, view,
handlers)` (a persistent-skeleton DOM renderer reusing its `.mw-bd` root and
six section children across re-renders, so the rail's and body's own scroll
positions survive a row tap or board switch) and `createBoardsPanel({ host,
buildView, readData, prefs, reducedMotion, onRoute })` — the stateful
controller returning `{ openFromTab, openFromTitle, onDeadTab, back,
isTitleOpen, centreRail, refresh, state }`.

Two entry modes:

- **Tab** (`openFromTab`/`onDeadTab`) — the game tab bar stays visible with
  DEAD active, no chevron, no dock. Opens on the board last viewed (the
  `ddr.boards.last.v1` per-viewer convenience key, read/written through the
  injected `prefs`, always inside try/catch), falling back to DEEPEST.
- **Title** (`openFromTitle`) — a ◀ back chevron appears in the header, the
  bottom dock shows BACK TO TITLE / ROLL A NEW HERO / BACK TO THE DUNGEON,
  and `body[data-boards-entry="title"]` hides the game tab bar and the rail.
  Always opens on GRAVEYARD. `back()`/the dock route through the panel's
  `onRoute(action, { hasHero })` callback ("title" | "dungeon" | "roll").

`window.__mzBoards` is the one bridge — `{ onDeadTab }` — assigned by the
module script; the classic script's `showTab`'s `name === "dead"` branch is
its only caller. The panel reads only the adapter's in-memory
`getBests()`/`getGraveyard()` snapshots (never storage directly), so a death
that just happened already shows when the DEAD tab opens.

Phases 67 (Play Games sign-in, the account chip) and 68 (global/friends
boards, submissions) add real sources behind this same `boardsView` seam —
the signed-out identity strip and dimmed ALL/FRIENDS chips this phase ships
are the deliberate placeholder those phases bring to life.

### Play Games account (Phase 67)

`src/browser/playGames.js` is the D-12 provider seam and the one module
that names the Play Games plugin package. `createPlayGames()` wraps the
Capacitor plugin on a native build and loads it lazily, on the first
provider call only. `createFakePlayGames({ signedIn })` is the in-memory
twin used by `node --test` and the browser dev loop. Both expose `init()`
(the silent launch attempt), `signIn()` (the interactive attempt, which
passes `silent: false`), `isAuthenticated()` and `getPlayer()` →
`{ id, displayName }`. Every method resolves and never rejects. There is no
sign-out, because PGS v2 has none (D-03). Phase 68 binds the leaderboard
methods: `submitScore`, `loadTopScores`, `loadPlayerScore`, `loadStanding`
and `friendsAccess`. `PLUGIN_METHODS_USED` is the allow-list of the only
plugin methods the wrapper ever calls.

`src/browser/account.js` is the pure view model: the account state
(`ACCOUNT_STATUS`, `normalizeAccountState`), the two rail cards
(`accountCard("welcome" | "failed")`), the boards identity
(`accountIdentity`) and the chip, sheet and ☰ face views (`accountChipView`,
`accountSheetView`, and Phase 70's `accountMenuView`: the initials avatar
when signed in, the plain ☰ otherwise). It has no DOM, no storage and no
provider access.

`src/browser/accountChip.js` exports `renderAccountChip(button, view)`,
`renderAccountSheet({ rows, title }, view, handlers)`, Phase 70's
`renderMenuFace(button, view)` (repaints the ☰ button's static
`.mw-hud-menu-face` and its aria-label) and `renderAccountMenu(host, view,
handlers)` (the sheet's rows without its title or Settings row). All build
DOM only through the host's `ownerDocument`; `ACCOUNT_CLASSES` lists every
class they emit. `createAccountController({ provider, settings, notify })`
returns `{ boot, signIn, setCompete, stopCompeting, state, identity,
chipView, sheetView, menuView, subscribe }`. `boot()` reads the settings and, with
Compete ON, starts one silent `init()` without waiting for it. Only one
attempt runs at a time, and a superseded or late result is dropped.
Compete OFF always wins: it persists `compete: false`, cancels the silent
timeout and never touches the provider (D-02). `subscribe(fn)` hears every
state change.

The shell wiring (mazeworld.html's module script):

- The provider is chosen by `window.Capacitor?.isNativePlatform?.()`:
  native gets `createPlayGames()`, the browser dev loop gets the fake,
  seeded signed in only when the dev setting `pgsDevSignedIn` is on. The
  seed is read once, at launch.
- `account.boot()` starts right after the title screen is initialized and
  is never awaited, so boot, the title and play never wait on Play Games.
- `renderAccountSurfaces()` runs on every account change and once before
  boot. It paints three surfaces from the controller's views: the title's
  corner chip `#mw-title-acct-chip` (`chipView`), the ☰ button
  `#mw-hud-menu-btn` (`menuView` through `renderMenuFace`) and the ☰
  dropdown's ACCOUNT block `#mw-hud-menu-acct` (`sheetView` through
  `renderAccountMenu`).
- Phase 70 (D-03, superseding Phase 67 D-05) retired the band-2 account
  chip. In the dungeon the ☰ wears the account face, and its dropdown opens
  on the ACCOUNT block: identity, Sign in / Stop competing / a disabled
  SIGNING IN…, the helper line and Compete ON/OFF. Each ACCOUNT row closes
  the menu first (`hudMenuEvent("select")`, D-07) and then calls the
  controller. The block follows the ☰'s own availability rule.
- Only the title chip opens `#mw-acct-sheet` now, with no encounter guard.
  The Settings row closes the account sheet and opens the settings sheet.
  The scrim, Close and the Android back button close it; the back button
  closes it first, ahead of every other layer.
- The controller's `notify` parks the welcome and failed cards until the
  dungeon is visible (no title, no roller, no title-mode Leaderboards
  panel), then hands them to `window.mzRailLine`. The latest card wins, and
  each is delivered once.
- The Leaderboards panel reads the account through its `identity()` seam,
  and every account change calls `boardsPanel.refresh()`.

No new `window.__mz` bridge: the account lives in the module script.

### The ☰ menu rows (Phase 70)

The ☰ dropdown (`#mw-hud-menu`) reads, top to bottom: the ACCOUNT block
(`#mw-hud-menu-acct`), MARKS, CENTRE MAP, MAKE CAMP, SETTINGS (the four
`HUD_MENU_ITEMS` rows), SAVE & QUIT (`#mw-menu-save-quit`), then ABANDON
THIS CHARACTER (`#mw-menu-abandon`) last, in the danger look. The HERO
tab's Delve panel and its two buttons are retired (D-06).

- D-07: every row closes the menu before its action runs. The classic
  `closeMenuThen(fn)` wraps each legacy row's existing handler (raise
  `hudMenuEvent("select")`, then run it); the ACCOUNT rows and the quit rows
  raise `select` themselves before calling the controller or the bridge. The
  dropdown's own bubble `select` stays as a no-op safety net.
- SAVE & QUIT closes the menu, then calls `window.mzAbandonRun`, which shows
  the title with `allowResume: hasActiveDelveSave()`. There is no dialog. A
  live hero resumes on ENTER; a dead hero's Save & quit arms no resume.
- ABANDON THIS CHARACTER arms in the row through `hudMenu.js`'s
  `abandonRowNext`. With Settings › Confirm before quit On, the first tap
  shows TAP AGAIN TO BURY THEM and a second tap within `ABANDON_ARM_MS`
  closes the menu and calls `window.mzAbandonCharacter`; with it Off, one
  tap does. The arm expires on its timer and whenever the menu closes
  (`setHudMenuOpen` writes `data-armed="0"`). Opening the menu stamps
  `data-dead` from the live state; while dead the row reads NEW CHARACTER
  and calls `window.mzStartRoll`. There are no confirm dialogs.

**The ☰ opens everywhere (Phase 70, D-08).** The Phase 57 T-57-17 refusal
is lifted: `hudMenuNext`'s toggle opens the menu on the map, in combat and
every other encounter (store, loot pile, stair prompt, beats), on the
Oracle, on all five tabs including DEAD, and while dead. Rows are disabled
by context, not hidden.

- `hudMenu.js#hudMenuRowStates(ctx)` (bridged as `window.__mzHudMenu.rows`)
  answers which of the six rows can act: MARKS, SETTINGS, SAVE & QUIT and
  ABANDON always; CENTRE MAP unless an over-map encounter covers the map;
  MAKE CAMP only with a live hero outside an encounter. Its short-on-food
  dim (Phase 25.1 DFB-06) stays separate and never disables it.
- The classic `syncHudMenuRows()` writes that answer onto the row buttons
  (`disabled` plus `aria-disabled="true"`, both cleared when live). It is
  TDZ-safe (state through `window.__mzState`), never touches the ACCOUNT
  block, and runs on every open and on every `renderEncounter()` while the
  menu is open. A tap on a disabled row leaves the menu open.
- The z-ladder is rail 4 < encounter/death overlay 8 < scrim 9 < ☰ wrap 10
  < sheets 45 < title 50 < roller 51 < account/settings sheets 55, so a
  scrim tap over a fight only closes the menu.
- The Android back button closes the menu first and returns
  (`closeModal`'s menu-first early return), so a store, loot pile, stair
  prompt or beat beneath survives that press.
- Opening the menu lands a live combat beat first
  (`window.__mzBeat?.hurry?.()`), the way a tab switch does.
- `renderEncounter` closes an open menu only when an encounter STARTS; a
  re-render of an ongoing encounter leaves it open.

### Global boards, submissions and placement (Phase 68)

**Encodings.** `src/browser/scoreTag.js` encodes a run into the 64-char
Play Games score tag (versioned, no epitaph) and decodes it tolerantly;
global rows are drawn from the tag, not from the score.
`src/browser/boardScores.js` turns a run summary into the five submitted
scores (DEEPEST, LEANEST, LONGEST, BUTCHERY, PURSE; LINEAGE and GRAVEYARD
are never submitted) and resolves leaderboard IDs per season and board
from `content/leaderboards.js`. Those IDs are placeholders until the Play
Console setup in Phase 69, and a placeholder or missing ID skips its board
silently.

**The queue.** `src/browser/pgsQueue.js` exports
`createSubmissionQueue({ storage, provider, ids, season, isCompeting,
isSignedIn, onFlushed, onSeasonDrop })`. Its record lives in
`ddr.pgsqueue.v1` through `window.mzStorage`: cross-run shell data, never
game state. The adapter's `setRunRecordedListener` reports every non-dev
death. The shell's `onRunRecorded` enqueues it: the queue refuses while
Compete is OFF, otherwise it stores the entry and then starts a flush.
Flushes also run when sign-in succeeds (at launch or from the Sign in row),
when the device comes back `online` (forced) and when the app becomes
visible again (the backoff applies). Each (run, board) is acknowledged and
stored before the next submission, so a crash or retry never sends a score
twice. An entry from an older season is dropped, not submitted, and the
drop is noted once in the Oracle through `window.logLine`. Turning Compete
OFF purges the queue. The native background flush (`registerNativeChrome`'s
`waitForPending`) awaits the queue's pending writes alongside the
adapter's.

**Global views.** `src/browser/globalBoards.js` exports
`createGlobalBoards({ provider, ids, isActive, playerId, onChange })`,
which returns `{ view, requestFriendsAccess, clear }`. `view({ board,
scope, season })` answers at once from a cache kept per season, board and
scope for about 5 minutes and starts at most one background fetch.
`onChange` redraws the open panel when a fetch finishes. Friends consent is
requested only by `requestFriendsAccess()`, which only the panel's SHOW MY
FRIENDS button calls. While signed out or with Compete OFF, `isActive()` is
false and no leaderboard call is made; the cache is cleared on sign-out and
on Compete OFF. The Leaderboards panel reads it through three
`createBoardsPanel` seams: `global` (the controller's `view`, or null
before it exists), `seasons` (`{ current: SEASON, all: knownSeasons() }`)
and `onFriendsConsent`.

**Placement.** `src/browser/placement.js` holds the pure views:
`placementLine`, `deferredPlacementCard` and `seasonDropLine`. A flush that
submitted DEEPEST scores reads the player's DEEPEST standing once and calls
the shell's `handlePgsFlush`:

- The live death, while its THAT IS THAT panel is up, gets the rank line.
  `window.__mzPlacement` (`{ hash, line, fresh }`) is set and the classic
  `renderRankLine` draws it under the NEW PERSONAL BEST block. It fades in
  once, and the blanket reduced-motion rule removes the fade. Nothing shows
  while the rank is on its way or when the read fails.
- Every other submitted run folds into one rail card, covering the
  best-placed run and the count. The card is parked until the dungeon is
  visible and the party is not dead. It is delivered after any parked
  account card's hold, never on top of it.

A signed-out or Compete-OFF run shows no rank line, no card and no error.

**Dev loop.** The browser gets the fake provider with dev leaderboard IDs
(`leaderboardIdsFor({ native: false })`, built once) and the real score
orders (`scoreOrdersFor`). With the dev setting `pgsDevSignedIn` on,
submissions, the rank line, the card and the ALL/FRIENDS views all work
without a device.

`window.__mzPlacement` is the one new bridge (see the table below).

### Title music (quick task 260924-51h)

**Controller.** `src/browser/titleMusic.js` is the pure half: it exports
`MUSIC_FADE_MS` (500), `shouldPlayTitleMusic` and `createTitleMusic({ start,
stop, reduced })`. The controller is edge-triggered on four booleans:
title area showing, device unlocked, Sound on and app active. On the rising
edge it calls `start()`. On the falling edge it calls `stop(ms)`, with a fade
only when the player reaches the map and a cut at once under reduced motion,
Sound Off or background.

**Player.** `src/browser/sfx.js` exports `MUSIC_IDS` (`["theme"]`),
`MUSIC_GAIN` (0.9 since Phase 71; 0.5 at 51h), `isSfxUnlocked`, `startMusic` and `stopMusic`. The theme
streams through one looping media element. That element is routed once
through `createMediaElementSource` into a music gain node on the one-shots'
device, so it shares the Sound gate, the master level and the teardown.
`stopAllSfx` and the Sound-Off teardown also cut it.

**Shell.** `mazeworld.html` declares `titleMusic`, `titleMusicShowing`,
`syncTitleMusic`, `unlockAudioAndSync` (the file's one `unlockSfx(` call) and
`setAppActive`. Its inputs come from four places:

- One `MutationObserver(syncTitleMusic)` watches `#mw-title-screen[hidden]`,
  `#mw-roller-screen[hidden]` and `body[data-boards-entry]`. The title area
  is the title, the roller and the title-mode Leaderboards panel, so the
  title functions stay untouched.
- The first-gesture listener and the Sound settings row.
- A `visibilitychange` listener.
- On native, a launch-time unlock one frame after first paint.

**Lifecycle.** `registerNativeChrome` takes two optional hooks,
`onBackground` and `onForeground`, which the shell wires to `setAppActive`.
A throwing hook never breaks the storage flush.

There is no new bridge.

**Levels (Phase 71, POLISH-05, D-01..D-03).** `src/browser/sfx.js` also
exports `CLIP_GAIN`, `clipGain`, `volumeLevels` and raises `MUSIC_GAIN` to
0.9. `CLIP_GAIN` is the one hand-tunable per-clip balance table, keyed by
clip id (`death` 0.5, the six step clips 1.6, every other clip 1.0, capped
at 2.0). Each one-shot plays through its own gain node at `clipGain(id)`,
then an effects bus, then the device master. The theme's gain node skips the
effects bus and feeds the master directly, so MASTER scales everything,
EFFECTS the one-shots only and MUSIC the theme only. The music level is
`MUSIC_GAIN` times the MUSIC slider. `settings.js` persists the three
sliders in `ddr.settings.v1` as `volMaster`, `volMusic` and `volEffects`
(integers 0-100, default 100). In the settings sheet they sit under the
Sound row (`#mw-vol-rows`) and show only while Sound is On. Dragging applies
the level live through `applySettings` without writing storage. Releasing
persists once through `writeSetting`, and an EFFECTS release previews one
ui-tap. There is no new bridge.

## What stays shared

`src/browser/viewModels.js` keeps the view models more than one surface
reads: `armorDisplay`, `bagArmorText`, `USABLE_COPY`, `usableBy`,
`lootCompare`, `dropShelfItems`, `oracleLogViewModel`.

`renderDropShelf` stays in the shell — it renders on the LOOT and FIND
cards (encounter surfaces, not the Gear tab). The encounter overlay's
host/frame also stays in the shell.

Phase 62 (GSCR-01..06/11): `src/browser/gearTab.js` also exports the
Gear-tab view models — `GEAR_WORN_ORDER`, `gearHeaderModel`, `gearUseCell`,
`gearWornModel`, `gearBagMeterModel`, `gearBagCardsModel`,
`gearConsumablesModel`, `gearKitRows` — the pure, DOM-free layer
`renderGearTab` turns into elements. `itemRowState` and `bagUsage` stay the
shared rules that `combatMenu.js`'s ITEMS submenu, `storeScreen.js`'s sell
list and the loot card all read too, so the Gear tab can never show a use
state, bag count or potion availability the player would see differently
elsewhere (GSCR-11; proven by `test/unit/gear-agreement.test.js`). Since
Phase 63, every WORN row and BAG card opens the action sheet
(`gearSheet.js`) and the Gear tab no longer calls `renderCarriedList`. The
shared list now serves the store sell list, the combat ITEMS list and the
loot card, and its `gearRow` branch has no live caller; it is kept
byte-identical by the standing ruling, a cleanup candidate for a later
quick task.

## Module bridge

Generated from `src/browser/bridge.js` by `node tools/bridge-doc.mjs
--write`; `test/unit/bridge-registry.test.js` fails when this table and the
map disagree, or when the shell/modules define a name the map lacks.

<!-- bridge-table:start -->

| Name | Owner | Consumers | Purpose |
| --- | --- | --- | --- |
| __mzAppImportOverride | src/browser/nativeChrome.js | test/persistence/lifecycle.test.js<br>test/unit/haptics.test.js | Test-only injection hook so a test can replace the native @capacitor/app import with a fake, without any shipped code path setting it. |
| __mzArmorDisplay | mazeworld.html (module) | mazeworld.html (classic: paint — sheet armor line)<br>mazeworld.html (classic: renderCarriedList — bag armor swap-compare text)<br>mazeworld.html (classic: renderDropShelf — bag armor text)<br>mazeworld.html (classic: renderEncounter — loot/find armor text) | Bridges the pure armorDisplay/bagArmorText formatters so every armor string on screen renders from one engine-derived source. |
| __mzBagUsage | mazeworld.html (module) | mazeworld.html (classic: paint — bag usage readout)<br>mazeworld.html (classic: renderEncounter — loot/find bag-full gate) | Bridges the pure bag-capacity readout (used/slots, full) so the Gear tab and every loot/find/store surface agree with the engine's real cap. |
| __mzBeat | mazeworld.html (module) | mazeworld.html (classic: renderEncounter/renderFightLog/renderActionArea — view())<br>mazeworld.html (classic: hasActiveEncounter/encArmed — active())<br>mazeworld.html (classic: beatHurryTap/showTab — hurry())<br>mazeworld.html (module: settleAllMotion — hurry()) | Bridges the pure src/browser/combatBeat.js runner (Phase 58, MOTION-03: D-09..D-11, D-17) so the classic renderer reveals an already-resolved combat round one exchange at a time, without a second copy of the reveal schedule. |
| __mzBoards | mazeworld.html (module) | mazeworld.html (classic: showTab — the DEAD tab opens the Leaderboards panel, or re-centres its rail when the panel is already open from the title) | Bridges the module-owned Leaderboards panel (src/browser/boardsPanel.js over boardsView.js and the adapter's in-memory bests record and graveyard) so the classic tab switch opens it without importing a module; presentation only, never a field on state. |
| __mzCameraGlide | mazeworld.html (module) | mazeworld.html (classic: keepPartyInView — the glided keep-in-view nudge)<br>mazeworld.html (classic: glideCenterMap — the CENTRE row of the ☰ menu)<br>mazeworld.html (classic: anchorCamOnParty — cancels before a snap or a pinch frame)<br>mazeworld.html (classic: the viewport's pointerdown handler — cancels so the finger wins) | Bridges the pure src/browser/cameraGlide.js retargetable ease-out tween (Phase 58, MOTION-01) so the classic camera code eases `cam` without a second copy of the tween math. |
| __mzCanvasSizing | mazeworld.html (module) | mazeworld.html (classic: fit — canvas backing size + cell size for text scale) | Bridges the pure canvas-backing/cell-size math so the map canvas resizes identically to the engine's own text-scale settings model. |
| __mzCarriedList | mazeworld.html (module) | mazeworld.html (classic: the loot card — the shared carried-item list; the store sell list reaches it directly now, via src/browser/storeScreen.js's own gearTab.js import) | Bridges src/browser/gearTab.js's renderCarriedList so the loot card reaches the ONE shared carried-item list renderer, never a second copy. |
| __mzClassicBoot | mazeworld.html (classic) | mazeworld.html (module: the boot sequence after the roller mount — awaits the classic boot before first paint) | Exposes the classic script's async boot routine (the first canvas fit and paint) so the module script can await it before running the title screen's own init. |
| __mzCombatMenu | mazeworld.html (module) | mazeworld.html (classic: openCombatMenu / renderActionArea / fightLogRefuse — reads and also writes)<br>mazeworld.html (module: dispatchWithNarration — closes the menu after every dispatched action) | Presentation-only open/closed state for the combat action submenu; never a field on state (serializeRun spreads state wholesale). |
| __mzCombatVM | mazeworld.html (module) | mazeworld.html (classic: renderActionArea / renderEncounter — combat header/foe-card/YOUR LOT/overlay content) | Bridges the pure combat header/foe-list/your-lot/overlay/menu view-model builders for renderEncounter's combat branch. |
| __mzConditionsOf | mazeworld.html (module) | mazeworld.html (classic: paint — top-of-screen condition tracker) | Bridges the pure condition enumerator so paint()'s condition chips map data-only descriptors to labels through one shared source. |
| __mzControls | mazeworld.html (module) | mazeworld.html (classic: keepPartyInView / map pointer handlers — screenToCell, resolveTapDirection, classifyPointerGesture, keepInViewAxis) | Bridges the pure pointer-to-cell and camera-keep-in-view math so map taps and the stationary camera use one shared calculation. |
| __mzDarkness | mazeworld.html (module) | mazeworld.html (classic: paintVignette — the counter-driven map vignette; paintConditions — the DARK chip's waiver clause) | Bridges the engine's own inDark/revealRadius/mapViewRadius/skill/eff reads plus the pure darknessView.js vignette/waiver helpers, so the shell reads the darkness rule and its three waiver checks instead of reimplementing them. |
| __mzDeathRecord | mazeworld.html (module) | mazeworld.html (classic: renderCombatOver — renders the NEW PERSONAL BEST block on the THAT IS THAT panel)<br>mazeworld.html (module: dispatchWithNarration — sets it on a died event; showTitleScreen — resets it to null) | Presentation-only parcel of the just-died run's new-personal-best block view; never a field on state. |
| __mzDescend | mazeworld.html (module) | mazeworld.html (classic: the stair-down overlay's primary action) | Exposes the module's descend action so the classic stair overlay's GO button can dispatch it without importing the module a second time. |
| __mzDressing | mazeworld.html (module) | mazeworld.html (classic: draw — the ambient prop layer beneath the feature icons) | Bridges the pure src/browser/dressing.js ambient-prop layer (Phase 59, DRESS-01..05) so draw() places, dims and excludes props with one thin call and no second copy of the rules; it draws nothing while Set dressing is Off. |
| __mzDropShelfItems | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — LOOT and FIND drop-shelf cards) | Bridges the pure bag-items-only list the shared drop shelf renders when a pickup would overflow the bag. |
| __mzEther | mazeworld.html (module) | mazeworld.html (classic: condition-chip tone for the ether condition)<br>mazeworld.html (classic: map pointer handlers — tap-to-move isOpen predicate, hold-inspect ethereal flag) | Bridges the pure Cloak of Ether predicates (itemEffectActive, inStone) so tap-to-move, hold-inspect and the condition chip agree on wall-walking state. |
| __mzFightEnd | mazeworld.html (module) | mazeworld.html (classic: renderCombatOver — reads and also resets to null)<br>mazeworld.html (module: the post-dispatch combat-end tracker — sets the ending-line parcel) | Presentation-only parcel of a just-ended fight's closing lines; never a field on state. |
| __mzFightLog | mazeworld.html (module) | mazeworld.html (classic: renderFightLog / fightLogRefuse — reads and also writes via __mzFightLogVM.toggle/append)<br>mazeworld.html (module: dispatchWithNarration — appends every dispatch's fight-log lines) | Presentation-only whole-fight log entries (rows, seq); never a field on state. |
| __mzFightLogVM | mazeworld.html (module) | mazeworld.html (classic: renderFightLog / fightLogRefuse — rows/toggle/announcement/append/dull) | Bridges fightLog.js's pure view-model functions so the classic fight-log renderer never imports the module a second time. |
| __mzGearSheet | mazeworld.html (module) | mazeworld.html (classic: openGearSheet / refreshGearSheet — the Gear action sheet's render) | Bridges src/browser/gearSheet.js's renderGearSheet so the classic sheet lifecycle (open, repaint refresh, close, back button, ghost-tap arm) renders the ONE pure sheet model, never a second copy. |
| __mzHapticsImportOverride | src/browser/haptics.js | test/unit/haptics.test.js | Test-only injection hook so a test can replace the native @capacitor/haptics import with a fake, without any shipped code path setting it. |
| __mzHasTool | mazeworld.html (module) | mazeworld.html (classic/module: rail dark/hazard cards — torch retry, dark-fell gating) | Bridges the pure carried-tool predicate so a hazard/dark rail card only offers a retry when the party actually carries the tool. |
| __mzHudBands | mazeworld.html (module) | mazeworld.html (classic: paint — band 1's name/line split via identityParts, and the fixed-width counter slots) | Bridges the pure src/browser/hudBands.js identityLine/identityParts/counterSlots formatters (Phase 57, LAYOUT-05) so paint() renders band 1's identity line (split into a never-truncated name and a truncating race/class/level line, Plan 05) and band 2's fixed-width counters from ONE engine-agnostic source. |
| __mzHudMenu | mazeworld.html (module) | mazeworld.html (classic: hudMenuEvent — the ☰ HUD menu's open/close policy, via next)<br>mazeworld.html (classic: syncHudMenuRows — the ☰ rows' per-row availability, via rows) | Bridges the pure src/browser/hudMenu.js hudMenuNext reducer (Phase 57, LAYOUT-04/05, Plan 05) and hudMenuRowStates (Phase 70, D-08) so the shell holds no second copy of the ☰ menu's rules; the classic hudMenuEvent reads the live open state and asks next for the open/close policy (the menu opens on every screen, failing closed when the bridge is missing), and the classic syncHudMenuRows asks rows which of the six rows can act in the current context (encounter, dead, hero) and writes disabled plus aria-disabled onto the rest. |
| __mzIconMap | mazeworld.html (module) | mazeworld.html (classic: draw — the preloaded map icon atlas) | Bridges the preloaded PNG icon atlas so the map canvas's draw() can paint feature icons without re-fetching them. |
| __mzIconsApi | mazeworld.html (module) | mazeworld.html (classic: draw — featureKeyForCell/drawFeatureIcon) | Bridges the pure icon-selection helpers so the map canvas's draw() resolves and paints the same icon set as the rest of the shell; the party marker moved to the DOM sprite (window.__mzPartySprite) in Phase 59. |
| __mzInputGuards | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — encArmed/encounterSettled/armEncounterButtons) | Bridges the pure arm-delay/dismiss-settle predicates so the encounter overlay's double-tap and stale-dismiss guards read one shared clock rule. |
| __mzLootCompare | mazeworld.html (module) | mazeworld.html (classic: renderEncounter loot branch — equip-now compare verdict) | Bridges the pure compare-to-equipped verdict so the loot screen's Equip Now button and the Gear tab agree with the engine. |
| __mzLootReport | mazeworld.html (module) | mazeworld.html (classic: renderEncounter loot branch — folds the victory report into the loot card) | Presentation-only transient carrying a just-won fight's report into the loot card when drops are pending; never a field on state. |
| __mzMapMarks | mazeworld.html (module) | mazeworld.html (classic: draw / renderMarksLegend / inspectAt — palette, glyphs, legend, markForCell) | Bridges the pure map-mark palette/glyph/legend tables so the canvas, the legend sheet and hold-inspect all agree on one mark vocabulary. |
| __mzMapView | mazeworld.html (module) | mazeworld.html (classic: draw — the render-window radius/visibility predicate) | Bridges the pure render-window read so draw() only paints the currently-visible window; missing bridge falls back to showing everything. |
| __mzMotion | mazeworld.html (module) | mazeworld.html (classic: showPanel/hidePanel — the fail-open wrappers every D-05 hidden-based close/open routes through)<br>mazeworld.html (classic: showTab — the reduced() check that decides whether an outgoing screen leaves with a pinned translateY or hides instantly) | Bridges src/browser/motion.js's one shared, timer-driven panel close helper (Phase 58, MOTION-02) and its reduced-motion predicate so the classic script animates every hidden-based close (the MARKS/Settings/camp sheets, the encounter overlay, a tab's outgoing screen) without a second copy of the close-then-hide timing. |
| __mzNightlyEats | mazeworld.html (module) | mazeworld.html (classic: paint — camp button's food-need readout) | Bridges the pure nightly-food-need calculation so the camp button's readout matches the engine's own camp gate. |
| __mzOracleToNewest | mazeworld.html (classic) | mazeworld.html (classic: showTab — scrolls the Oracle log to newest on tab entry) | Forward-declared scroll-to-newest callback for the Oracle log, called by showTab whenever the Oracle tab is opened. |
| __mzPartyCap | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — Joiner offer party-size cap) | Bridges the engine's PARTY_CAP constant so the Joiner offer card's cap check never drifts from the engine's own limit. |
| __mzPartySprite | mazeworld.html (module) | mazeworld.html (classic: partyShown — the displayed point a step glide is heading toward)<br>mazeworld.html (classic: positionPartySprite — box/pose/frame, in lockstep with positionCanvas())<br>mazeworld.html (classic: glideParty — stepTo, the step glide, Phase 59 Plan 04)<br>mazeworld.html (module: settleAllMotion — finish()) | Bridges the pure src/browser/partySprite.js marker controller (Phase 59, ANIM-01/02) so the classic placement code reads one lockstep box and one step glide, never a second copy of the camera math. |
| __mzPendingNarration | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — the narrated() helper building loot/find/store narration lines) | Presentation-only queue of narration HTML lines a dispatch produced, read once by the encounter card that follows; never a field on state. |
| __mzPerfMarks | mazeworld.html (module) | mazeworld.html (classic: paint — the one canvas draw() call's dev-gated timing bracket, PERF-02 fix 2) | Bridges the SAME perfMarks module instance stepWith already imports directly, so classic paint()'s draw() call — now the only canvas draw per step — can record its own `draw` timing row from the classic side (which cannot `import`); read-only from paint() (record() only, never reset()/summary()). |
| __mzPlacement | mazeworld.html (module) | mazeworld.html (classic: renderCombatOver / renderRankLine — draws the DEEPEST rank line on the THAT IS THAT panel, then marks it not fresh)<br>mazeworld.html (module: onRunRecorded — resets it for a new death; handlePgsFlush — sets it when the run's rank returns; showTitleScreen and onAccountForPgs — reset it to null) | Presentation-only parcel { hash, line, fresh } of the just-died run's DEEPEST rank line (Phase 68, PLACE-01); never a field on state. |
| __mzPreferencesOverride | src/browser/storage.js | test/persistence/harness/fakePreferences.js | Test-only injection hook so a test can replace the native @capacitor/preferences import with a fake, without any shipped code path setting it. |
| __mzRail | mazeworld.html (module) | mazeworld.html (classic: renderRail / railLocked — reads and also clears pending on dismiss)<br>mazeworld.html (module: dispatchWithNarration / darkFell / mzRailLine — pushes new cards) | Presentation-only rail state (seq/card/pending) — what is currently on screen at the bottom of the map; never a field on state. |
| __mzRailVM | mazeworld.html (module) | mazeworld.html (classic: renderRail / isOpen — card/push/clear/lineCard/announcement/copy)<br>mazeworld.html (classic: renderRail's auto-clear timer — holdForCard; the guarded #mw-rail body-tap dismiss handler — dismissKind) | Bridges rail.js's pure view-model functions so the classic rail renderer never imports the module a second time. |
| __mzRations | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — Joiner card eats line) | Bridges the pure rations view-model and eats-line formatter so the Joiner card's eats readout reads engine/movement.js#eatsFor the same way the Hero tab (src/browser/heroTab.js, a direct import — no bridge needed) and its own Company panel do. |
| __mzSettings | mazeworld.html (module) | mazeworld.html (classic: fit — reads the current text-scale/haptics/sound settings) | Exposes the module's currently-applied settings object so the classic canvas-fit routine can read the live text-scale setting. |
| __mzSfxBackendOverride | src/browser/sfx.js | test/unit/sfx.test.js<br>test/unit/sfx-settings.test.js | Test-only injection hook so a test can replace the Web Audio backend with a fake and assert which clips actually started, without any shipped code path setting it. |
| __mzShowTab | mazeworld.html (classic) | mazeworld.html (classic: the death card's Oracle button)<br>mazeworld.html (module: the roller mount's onCommit / the death-screen router — switches tabs after commit or death)<br>mazeworld.html (module: routeFromBoards — back to the map when the panel's title mode exits) | Exposes the classic script's tab-switch function so the module script can route to a tab (maze on boot, dead on death) without a DOM click. |
| __mzStair | mazeworld.html (module) | mazeworld.html (classic: the stair-down overlay's STAY button — reads and also clears to null)<br>mazeworld.html (module: the tap-to-move step handler / getGameContext / closeModal — sets and clears the overlay flag) | Presentation-only stair-down gate flag ({ dir } while the overlay is up, else null); never a field on state. |
| __mzState | mazeworld.html (classic) | mazeworld.html (classic: paint/renderRail/railPulse — reads the live GameState)<br>mazeworld.html (module: dispatchWithNarration and every engine-action bridge — get()/set() the live GameState)<br>tools/store-screenshots/bot.js<br>tools/store-screenshots/capture.js | The one get()/set() accessor onto the classic script's `S` variable, letting the module script read and replace the live GameState. |
| __mzTables | mazeworld.html (module) | mazeworld.html (classic: mzCombatReport — level roman numerals)<br>mazeworld.html (classic: renderEncounter — level roman numerals in the graves stone / Joiner card) | Bridges the one read-only content table (ROMAN) the classic script still cannot import — RACE_NOTE/CLASS_NOTE/SUB_NOTE/THRESHOLDS/WEAPONS/FIGHTER_SKILLS/THIEF_SKILLS/RACES moved to gearTab.js/heroTab.js, which import content/ directly. |
| __mzTabs | mazeworld.html (module) | mazeworld.html (classic: paint() — one call per tab surface; renderEncounter() — the store branch) | The tab modules' render functions, one frozen object — gear + hero + store, the phase's final shape — the __mzControls/__mzTables precedent for a module-assigned, classic-read bridge. |
| __mzTakesBagSlot | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — loot/find per-item bag-full gate) | Bridges the one bag-free predicate (potions/scrolls/bags ride free) so the loot and find cards gate bag-full per item, not on the aggregate alone. |
| __mzTapStep | mazeworld.html (module) | mazeworld.html (classic: map pointer handlers — resolveStep/inspectCell/HOLD_MS/TAP_MAX_TRAVEL_PX) | Bridges the pure tap-to-move step resolver and hold-inspect builder so map taps and holds share one gesture-to-action rule. |
| __mzToolIndex | mazeworld.html (module) | mazeworld.html (classic: the dark rail card's USE TORCH button) | Bridges the engine's tool-slot resolver so the dark card's USE TORCH tap dispatches the correct, freshly-resolved bag index. |
| __mzTypewriter | mazeworld.html (module) | mazeworld.html (classic: renderRail — types a fresh card's lines/rolls, adopts an in-flight block on a same-card re-render, starts the hold from the block's own onDone)<br>mazeworld.html (classic: the #mw-rail body-tap handler — a tap on typing text completes it instead of dismissing)<br>mazeworld.html (classic: renderMajorOverlay — types the encounter/stair overlay's line once per content, adopts it on a same-content re-render) | Bridges src/browser/typewriter.js's one shared, keyed typewriter (Phase 58, MOTION-04: rail cards, the encounter overlay's line, and — Plan 58-06 — fight-log rows type on at 12ms/char, capped at 700ms/block) so the classic renderers type without a second copy of the schedule; a caller's own announcer/description node always carries the complete text at once, regardless of typing (D-16). |
| __mzUsableBy | mazeworld.html (module) | mazeworld.html (classic: renderEncounter — loot/find usable-by suffix; the store reaches it directly now, via src/browser/storeScreen.js's own viewModels.js import) | Bridges the pure usable-by-class predicate so every item row's usable-by suffix (loot, find, and — indirectly, via storeScreen.js's own import — the store) reads one shared rule. |

<!-- bridge-table:end -->

How to add a bridge name: assign it, add its entry to `BRIDGE`, run
`--write`, commit all three together.

## DOM snapshots

`test/unit/harness/recordingDom.js` (a from-scratch recording DOM + a
deterministic serializer) and `test/unit/harness/shellSandbox.js` (loads the
classic `<script>` under `node:vm` with the real bridges wired) back the
standing test `test/unit/shell-tab-snapshots.test.js`, which compares seven
fixtures under `test/unit/fixtures/shell-snapshots/` byte-for-byte on every
run.

Fixtures are regenerated only with `MZ_SNAPSHOT_UPDATE=1`, only for a
declared, deliberate DOM change, with the rationale in the commit message —
never to make a carve pass. A diff means the carve moved rendered DOM.

## Line budget

**Criterion 2 (ROADMAP Phase 47, `wc -l mazeworld.html` < 5000): NOT MET — 5621 lines at the phase's final commit.**

| Milestone | Commit | `wc -l mazeworld.html` (comma) | lines (plain) | Delta |
| --- | --- | --- | --- | --- |
| Phase start (smart-discuss context) | `0129ca3` | 6,339 | 6339 | — |
| Post Plan 01 (DOM-snapshot harness) / Plan 02 (bridge registry) | `bbb6503` | 6,330 | 6330 | -9 |
| Post Plan 03 (Gear tab carve) | `4cd35ea` | 5,980 | 5980 | -350 |
| Post Plan 04 (Hero tab carve) | `6d1a999` | 5,669 | 5669 | -311 |
| Post Plan 05 Task 1 (Store carve) | `df78e66` | 5,621 | 5621 | -48 |
| **Final (Plan 05 Task 2)** | (this commit) | **5,621** | **5621** | **-718 total** |

**The CONTEXT's own fallback (move the tabs' remaining private helpers) was applied and found nothing in scope.** `node tools/shell-sweep.mjs orphans` at the final commit reports 27 orphaned classic top-level declarations — every one of them belongs to the Map/camera/tap-control cluster, the combat/rail/HUD renderers, or the graves/Oracle log (`cv`, `ctx`, `GW`, `ZOOM_MIN`, `CANVAS_PAD`, `CAPTURE`, `logEl`, `CONDITION_COPY`, `MAP_COPY`, `FOE_EFFECT_LABEL`, `CONDITION_TONE`, `CONDITION_EXPLAIN`, `lastCondKeyShown`, `GRAVE_KEY`, `GRAVE_TOTAL_KEY`, `gravesLoadError`, `saveGraves`, `encRenderedAt`, `armTimer`, `lastDismissAt`, `encWasActive`, `lastLogSeqShown`, `fightLogAnnouncedSeq`, `FEATURE_ICON_PATH`, `COMBAT_DISPATCH`, `lastRailKeyShown`, `railTimer`). None trace to the Gear, Hero or Store bodies this phase carved — the phase ground rules explicitly forbid moving Map/Oracle/rail/combat code, so this lever has nothing left to pull for SHELL-01..04's own scope.

**Classified breakdown of the remaining 5,621 lines** (measured at the final commit):

| Category | Lines | Detail |
| --- | --- | --- |
| Markup + CSS (`<head>`/`<style>`, before `<body>`) | 1,196 | lines 1–1,196 |
| Body markup between the classic and module `<script>` tags | 491 | lines 1,197–1,687 |
| Classic `<script>` (total) | 2,507 | lines 1,687–4,193 |
| — of which comment-only lines | 885 | `//`, `/* … */`, `*` continuation lines |
| Module `<script type="module">` (total) | 1,424 | lines 4,195–5,618 |
| — of which comment-only lines | 757 | `//`, `/* … */`, `*` continuation lines |
| Trailing lines (`</html>` etc.) | 4 | after the module script closes |

Comment-only lines alone total **1,642** across both scripts — the single largest lever left, and it is explicitly **out of scope for this phase** (Phase 48's DOCS-01..03 comment purge per the phase ground rules: "comment purges outside moved lines are Phase 48"). The largest remaining classic function bodies by line count are all Map/Combat/Rail/Graves/Oracle surfaces this phase never touched: `inspectAt` (map tap/hold-inspect), `renderEncounter` (261 lines — now almost entirely combat, the Store/Gear/Hero branches having moved out), `logLine`/`CAPTURE`/`logEl` (Oracle log), `renderRail`/`railPulse`/`railLocked` (the rail), `draw` (map canvas), `renderDropShelf` (shared, deliberately NOT moved into a tab module per this phase's own CONTEXT ruling), `paint` (the tab-mount skeleton + HUD writes, deliberately NOT moved into the module script per this phase's own CONTEXT ruling: "Moving `paint()` itself into the module script is out of scope"), `paintConditions` (HUD condition strip), `renderFoeCards`/`renderCombatOver`/`renderYourLot`/`renderActionArea`/`cbRow`/`foeStatusBadges`/`renderMajorOverlay`/`renderFightLog`/`syncFightLogLive` (combat renderers), `renderGraves` (the graveyard).

**Candidate levers for a user ruling** (recorded, not acted on — out of this plan's scope): Phase 48's comment purge (DOCS-01..03, ~1,642 lines); moving `renderDropShelf` into a shared module (currently deliberately shell-owned, serving both the LOOT and FIND cards); moving `paint()`'s own tab-mount skeleton into the module script (currently deliberately shell-owned per this phase's CONTEXT); a future phase naming the Map/Combat/Rail/Oracle surfaces as additional named modules (out of SHELL-01..04's stated scope, which names only Gear/Hero/Store).

**Ruling (2026-09-19, user):** re-baselined and closed at 5,621 lines. The three surfaces are carved and the shell is their mount point; the "< 5,000" figure was a planning estimate that under-counted the Map/Combat/Rail/Oracle/Graves bodies the phase deliberately left in place. SHELL-04 is complete against the amended clause. No comment purge or combat carve was traded for the number.
