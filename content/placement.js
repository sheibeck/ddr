// content/placement.js
//
// Phase 68 (PLACE-01/02; D-10..D-13, D-03). The words for the DEEPEST rank
// quip on the THAT IS THAT death panel, the one rail card that reports runs
// a queued-submission flush delivered later, and the one Oracle line for
// queued deaths dropped at a season bump. DEEPEST is the only board that
// gets a ranked quip (D-10).
//
// `content/` holds no functions: the `{rank}`, `{total}`, `{ahead}` and
// `{count}` placeholders are filled by src/browser/placement.js, which also
// decides the band (1st / top 10 / top 100 / the rest). The "standing" band
// covers a run that did not beat the player's best: Play Games keeps only a
// player's best score, so the rank it reports belongs to that best run, not
// this one, and "You placed Nth" would be false.
//
// The Oracle renders the season line through innerHTML, so no string here
// may carry a markup character. The joke is always on the player's own
// adventurer or on death in general, never on another player.

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
    "You placed {rank} of {total}. Somewhere in the middle of the heap. It is warm there, at least.",
    "You placed {rank} of {total}. Statistically, you happened.",
    "You placed {rank} of {total}. The ledger has room for everyone. That is its whole problem.",
  ]),
  standing: Object.freeze([
    "This one did not beat your best. Your best still holds {rank} of {total}.",
    "Not a new record. Your best run is still {rank} of {total}, and still dead.",
    "The ledger kept your better corpse. {rank} of {total}, unchanged.",
  ]),
});

// PLACEMENT_CARD (D-12) — one rail card for every run a flush delivered.
// `one`/`many` report a new best; the `Standing` variants say the delivered
// runs did not beat the best, whose rank is the one shown.
export const PLACEMENT_CARD = Object.freeze({
  title: "THE LEDGER CAUGHT UP",
  tone: "good",
  hold: 12000,
  one: Object.freeze(["Your earlier death placed {rank} of {total} on DEEPEST."]),
  many: Object.freeze(["{count} earlier deaths reached the ledger. The best placed {rank} of {total} on DEEPEST."]),
  oneStanding: Object.freeze([
    "Your earlier death reached the ledger. It did not beat your best, which holds {rank} of {total}.",
  ]),
  manyStanding: Object.freeze([
    "{count} earlier deaths reached the ledger. None beat your best, which holds {rank} of {total}.",
  ]),
});

// SEASON_DROP_LINES (D-03) — the Oracle line for queued deaths that belonged
// to a season which closed before they could be sent.
export const SEASON_DROP_LINES = Object.freeze({
  one: "One unsent death belonged to a closed season. That ledger is sealed, so it was let go.",
  many: "{count} unsent deaths belonged to a closed season. That ledger is sealed, so they were let go.",
});
