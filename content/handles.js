// content/handles.js
//
// Phase 83 (SRV-05). The rolled @handle's two word tables — PURE DATA, per
// CONTEXT "Identity & the @handle": `@` + two dungeon-flavoured words,
// rolled locally (shell-side randomness, never the engine rng) the first
// time a handle is needed, so it exists offline before any network call.
//
// Every HANDLE_FIRST x HANDLE_SECOND combination is proven clean by
// test/unit/handles.test.js: both the word-boundary safety scan
// (content/safety-wordlist.js) and a cross-boundary substring check (a
// banned term can never straddle the join between the two words) run over
// every pair, by construction — not by hand-review. Words are lowercase
// a-z only so the handle regex src/browser/handles.js builds
// (handlePatternSource) stays an exact anchored alternation; that regex is
// the one the deployed Firestore rules (83-02) embed to accept only a
// rolled handle, never a forged one.
//
// These tables are APPEND-ONLY once deployed: the live rules regex is built
// from them in table order, so removing or reordering a word would change
// which already-issued handles the rules still accept. See
// docs/LEADERBOARDS.md for the deploy note once 83-02/83-08 land.

// ─── First word: dungeon things and grim adjectives ────────────────────────
export const HANDLE_FIRST = [
  "lantern",
  "moss",
  "soot",
  "gloom",
  "rusty",
  "candle",
  "cellar",
  "crypt",
  "torch",
  "mildew",
  "cobweb",
  "gravel",
  "barrel",
  "dusty",
  "toad",
  "slug",
  "grub",
  "damp",
  "grim",
  "shadow",
  "ember",
  "brine",
  "murky",
  "tomb",
  "ashen",
  "briar",
  "hollow",
  "wretch",
  "musty",
  "grave",
];

// ─── Second word: comic body parts, garb and kitchen things ────────────────
export const HANDLE_SECOND = [
  "jaw",
  "toe",
  "knee",
  "nose",
  "boot",
  "sock",
  "hood",
  "beard",
  "elbow",
  "spoon",
  "ladle",
  "mop",
  "kettle",
  "mitten",
  "bonnet",
  "knuckle",
  "thumb",
  "chin",
  "shin",
  "wrist",
  "apron",
  "bucket",
  "skillet",
  "tunic",
  "cloak",
  "helmet",
  "buckle",
  "sandal",
  "goblet",
  "pouch",
];
