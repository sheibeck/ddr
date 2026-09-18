// content/activations.js
//
// Phase 39 (GEAR-02): the ONE merged activation-declaration table for every
// item that does something when used — duration+cooldown (jewelry/cloaks,
// content/treasure-tables.js#TREASURE_ACTIVATION_OF), charges+recharge
// (staves, also TREASURE_ACTIVATION_OF), consumable-with-duration (potions,
// content/potions.js#POTION_ACTIVATION_OF). Keyed by the item's display name
// for treasure rows, or the POTIONS row `n` for potions — see
// engine/derived.js#activationKeyFor for the exact key-derivation rule.
// Plan 04 (GEAR-05) spreads the one-shot tools' activations (the torch) in
// alongside these two. Frozen; NEVER spread onto an item object —
// engine/derived.js#activationFor is the only reader.

import { TREASURE_ACTIVATION_OF } from "./treasure-tables.js";
import { POTION_ACTIVATION_OF } from "./potions.js";

export const ACTIVATION_OF = Object.freeze({ ...TREASURE_ACTIVATION_OF, ...POTION_ACTIVATION_OF });
