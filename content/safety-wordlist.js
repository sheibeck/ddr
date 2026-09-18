// content/safety-wordlist.js
//
// VOX-02 — the family-friendly safety wordlist (PURE DATA) that backs the
// exhaustive content safety scan (test/voice/safety-scan.test.js). This is
// the standing guardrail, like the round-trip parity suite, that makes it
// impossible to ship profanity, slurs, sexual/adult copy, or graphic gore in
// the game's authored voice — a Google Play "PEGI 3 / Everyone" content-rating
// requirement (see .claude/CLAUDE.md's "family-friendly" tone constraint).
//
// ── SCOPE ──────────────────────────────────────────────────────────────────
// This file is DATA ONLY: exported arrays of banned terms grouped by category,
// plus an ALLOWLIST of known-safe game vocabulary that would otherwise collide.
// It contains NO matching/normalization LOGIC and NO functions — that lives in
// the test — so it passes the content-purity tripwire
// (test/determinism/content-is-pure-data.test.js: no function-typed leaves).
//
// This is also the ONE file in the repo where literal banned terms are allowed
// to appear (as filter data). Every other module — and the safety scan itself
// — references categories abstractly and never inlines an example bad word.
//
// ── ATTRIBUTION (CC BY 4.0) ─────────────────────────────────────────────────
// The PROFANITY array below is seeded from the "List of Dirty, Naughty,
// Obscene, and Otherwise Bad Words" (LDNOOBW), English (`en`) list:
//   https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
//   Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0):
//   https://creativecommons.org/licenses/by/4.0/
// The list is vendored as inert DATA (not an npm dependency — the offline /
// zero-SDK constraint forbids adding packages), so there is no executable code
// and no supply-chain/injection surface (threat T-05-07). It is a curated
// English subset of the LDNOOBW `en` list — obvious non-English, joke, and
// duplicate entries trimmed — plus hand-curated SLURS / SEXUAL / GORE
// supplements the profanity-focused LDNOOBW base does not cover but this game's
// dark-but-family-friendly tone could risk. Per CC BY 4.0, attribution is
// given above; no endorsement by the original authors is implied.
//
// ── SCUNTHORPE / WORD-BOUNDARY NOTE ────────────────────────────────────────
// The scan matches every term case-insensitively at WORD BOUNDARIES (\b…\b),
// so a banned short term can never trip on a longer safe word that merely
// contains it as a substring ("assassin"/"grass"/"class" never match "ass";
// "cockatrice" never matches "cock"; "Scunthorpe" never matches). Because of
// that, the ALLOWLIST below only needs to carry WHOLE words the game genuinely
// uses that are themselves on a profanity list (e.g. the "Bastard Sword"
// weapon) — the true Scunthorpe exceptions for THIS corpus. Every allowlist
// entry is annotated with where the game actually uses it; nothing
// speculative is allowlisted.

// ─── Vendored profanity / crude (LDNOOBW en subset, CC BY 4.0) ──────────────
// Deliberately EXCLUDES words that are core, family-friendly fantasy-roguelike
// vocabulary in this game and carry no profane sense here — e.g. "kill",
// "dead", "corpse", "blood", "die" — which a naive profanity list would flag
// but PEGI 3 / Everyone explicitly permits as mild fantasy violence.
export const PROFANITY = [
  "arse",
  "arsehole",
  "ass",
  "asses",
  "asshole",
  "assholes",
  "balls",
  "ballsack",
  "bastard",
  "bastards",
  "bitch",
  "bitches",
  "bloody",
  "bollocks",
  "bugger",
  "bullshit",
  "crap",
  "crappy",
  "cunt",
  "damn",
  "damned",
  "dammit",
  "dick",
  "dickhead",
  "dildo",
  "douche",
  "douchebag",
  "fuck",
  "fucked",
  "fucker",
  "fucking",
  "fucks",
  "goddamn",
  "goddamned",
  "jackass",
  "jerk off",
  "knob",
  "knobhead",
  "motherfucker",
  "motherfucking",
  "piss",
  "pissed",
  "prick",
  "shit",
  "shite",
  "shits",
  "shitty",
  "slut",
  "slutty",
  "twat",
  "wank",
  "wanker",
  "whore",
  "whores",
];

// ─── Hand-curated slurs (racial / ethnic / religious / homophobic / ableist) ─
// A content-moderation filter must catch these regardless of intent; they are
// listed purely as inert filter data for the guardrail to detect and reject.
export const SLURS = [
  "chink",
  "coon",
  "cripple",
  "dyke",
  "fag",
  "faggot",
  "gook",
  "gyp",
  "gypped",
  "kike",
  "negro",
  "nigger",
  "nigga",
  "paki",
  "raghead",
  "retard",
  "retarded",
  "spade",
  "spastic",
  "spic",
  "tranny",
  "wetback",
  "wop",
];

// ─── Hand-curated sexual / adult ────────────────────────────────────────────
export const SEXUAL = [
  "anal",
  "blowjob",
  "boob",
  "boobs",
  "buttplug",
  "clit",
  "cock",
  "cocks",
  "cum",
  "cunnilingus",
  "ejaculate",
  "erotic",
  "fellatio",
  "fetish",
  "genital",
  "genitals",
  "handjob",
  "horny",
  "incest",
  "jizz",
  "masturbate",
  "masturbation",
  "nude",
  "nudes",
  "orgasm",
  "orgy",
  "penis",
  "porn",
  "porno",
  "pornography",
  "pussy",
  "rape",
  "raped",
  "rapist",
  "scrotum",
  "semen",
  "sex",
  "sexy",
  "smut",
  "testicle",
  "testicles",
  "tits",
  "titties",
  "vagina",
  "vulva",
];

// ─── Hand-curated graphic gore / adult violence ─────────────────────────────
// Beyond the mild fantasy violence PEGI 3 permits — explicit real-world
// torture / mutilation / self-harm language the sarcastic voice must never
// reach for. Again EXCLUDES the family-friendly staples (kill/dead/corpse/
// blood/slain) the roguelike legitimately uses.
export const GORE = [
  "bloodbath",
  "decapitate",
  "decapitated",
  "disembowel",
  "disembowelled",
  "disemboweled",
  "dismember",
  "dismembered",
  "eviscerate",
  "eviscerated",
  "gutted alive",
  "impale",
  "impaled",
  "maim",
  "maimed",
  "mutilate",
  "mutilated",
  "suicide",
  "torture",
  "tortured",
];

// ─── The complete banned corpus (union of every category) ───────────────────
export const BANNED = [...PROFANITY, ...SLURS, ...SEXUAL, ...GORE];

// ─── Scunthorpe allowlist — whole words the game genuinely uses that collide ─
// Each entry is a real, in-use game word that is ALSO on a banned list above
// and is safe in this game's context. With \b word-boundary matching these are
// the ONLY true collisions in the current corpus; every entry cites its use.
export const ALLOWLIST = [
  // "Bastard Sword" — a canonical medieval hand-and-a-half sword; the weapon
  // name in content/weapons.js (WEAPONS["Bastard Sword"]) and content/kit.js.
  // Collides with PROFANITY "bastard".
  "bastard",
];
