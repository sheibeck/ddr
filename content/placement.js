// content/placement.js
//
// Phase 85 (ACCT-04, 85-CONTEXT group 2). The words for the THAT IS THAT
// death panel's rank line and the one rail card that reports runs an
// acknowledged board flush delivered later. The rank is this run's own
// DEPTH place on the whole board this season, read once the board
// acknowledges the run — every run has its own rank now, which is why
// there is no "standing" band and no season-drop line: the new queue has
// no season-drop path. The joke stays on the player's own adventurer.
//
// `content/` holds no functions: the `{rank}`, `{total}`, `{ahead}` and
// `{count}` placeholders are filled by src/browser/placement.js, which also
// decides the band (1st / top 10 / top 100 / the rest).
//
// The Oracle/rail render through innerHTML, so no string here may carry a
// markup character. The joke is always on the player's own adventurer or on
// death in general, never on another player.

export const PLACEMENT_LINES = Object.freeze({
  first: Object.freeze([
    "You placed 1st of {total}. Everyone else is also dead, just less impressively.",
    "You placed 1st of {total}. The top of the pile is still the pile.",
    "You placed 1st of {total}. Savour it. The dungeon is already planning a sequel.",
  ]),
  ten: Object.freeze([
    "You placed {rank} of {total}. Top ten. The dungeon will pretend it did not notice.",
    "You placed {rank} of {total}. Close enough to the top to see it, not close enough to matter.",
    "You placed {rank} of {total}. Top ten. Somebody out there will have to try harder.",
  ]),
  hundred: Object.freeze([
    "You placed {rank} of {total}. Top hundred, which is a crowd, but an exclusive one.",
    "You placed {rank} of {total}. Respectable, in the way a tidy grave is respectable.",
    "You placed {rank} of {total}. The {ahead} ahead of you would like a word. They cannot have one.",
  ]),
  rest: Object.freeze([
    "You placed {rank} of {total}. The {ahead} ahead of you are also dead.",
    "You placed {rank} of {total}. Somewhere in the heap. It is warm in there, at least.",
    "You placed {rank} of {total}. Statistically, you happened.",
    "You placed {rank} of {total}. The ledger has room for everyone. That is its whole problem.",
  ]),
});

// PLACEMENT_CARD — one rail card for every run a flush delivered after the
// death panel was already gone (offline, then back in the dungeon).
// `one`/`many` cover a single delivered run or several folded together.
export const PLACEMENT_CARD = Object.freeze({
  title: "THE LEDGER CAUGHT UP",
  tone: "good",
  hold: 12000,
  one: Object.freeze(["Your earlier death placed {rank} of {total} on DEPTH."]),
  many: Object.freeze(["{count} earlier deaths reached the ledger. The best placed {rank} of {total} on DEPTH."]),
});
