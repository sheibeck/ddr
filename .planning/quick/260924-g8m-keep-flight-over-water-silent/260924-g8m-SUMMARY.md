---
quick_id: 260924-g8m
status: complete
date: 2026-09-24
---

# Quick 260924-g8m: keep flight over water silent (summary)

- The dispatch `audioCtx.onWater` in `mazeworld.html` is now true only when the party actually wades the square: `!!postCell?.water && moveCost(result.state, postCell) > 1`. A live Cloak of Flying, Bracelet of Flight or Cloak of Ether (move cost 1) crosses water with the ordinary dry footstep, matching the engine's `waded` narration. Wading still splashes on every step (D-17).
- `moveCost` is imported on its own line from `./engine/derived.js`, following the separate-import precedent.
- `test/unit/ui-tap-shell.test.js`: the D-17 pin now checks the `postCell` read, the `moveCost` gate and the import.
- `docs/UAT-v2.0.md` M34: added the flight/ether case (dry footstep over water).
- **Gates:**
  - `npm test` 5483/5483.
  - `boot:check` PASS. One first-run "graves" miss was a timing flake; it passed on 4 reruns.
  - No `engine/`, `content/`, `test/parity/` or `sfx/` change.
- **Human check:** UAT M34, which needs the debug APK rebuilt with this change.
