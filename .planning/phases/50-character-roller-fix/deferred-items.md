# Phase 50 — Deferred Items

## `npm run boot:check` is environment-blocked on this machine (pre-existing, not caused by Plan 03)

**Discovered:** Plan 03, Task 2 (running the phase gates).

**Symptom:** `npm run boot:check` reports `FAIL painted`, `FAIL graves`, `FAIL title` (only `PASS no-uncaught`), with an empty `boot-dom.html` dump (0 bytes) and an empty `boot-console.log` — Chrome's `--dump-dom` produced no output at all.

**Proof this is pre-existing, not a Plan 03 regression:**
1. `node tools/shell-boot-check.mjs --self-test` — a self-contained scratch page with **zero app code involved** — also fails (`SELF-TEST FAIL: the injected uncaught error was NOT detected`). If the tool can't even see its own synthetic throwing page, the failure cannot be specific to `mazeworld.html`'s roller mount.
2. Swapped `mazeworld.html` back to the pre-Plan-03 committed version (`HEAD~1`), rebuilt `www/`, re-ran `boot:check` — **identical failure** (same three FAILs, same empty dump). Restored the Plan 03 version afterward (`git checkout` — no working-tree change resulted).

**Root cause (best available evidence, not fully diagnosed):** this Windows machine has a live, visible, interactive Chrome browser window already running under the default profile (confirmed via `tasklist /v`, window title "Google Chrome"). A raw `chrome.exe --headless=new --dump-dom <url>` invocation with no `--user-data-dir` explicitly logs `Opening in existing browser session` and does nothing headless. Even with an explicit, distinct `--user-data-dir` pointed at a scratch folder, the invocation still produced zero stdout and — per `wmic process ... commandline like` — never spawned a process under that profile directory at all, unlike `tools/roller-repro.mjs`'s CDP-driven approach (which **does** work reliably on this same machine, per Plan 02's SUMMARY and this plan's own AFTER table). `tools/shell-boot-check.mjs`'s artifacts show it last passed on 2026-09-19 (`selftest-dom.html` etc. dated then) — something in the Chrome install/session state on this box changed since.

**Why this is out of scope for Plan 03:** `tools/shell-boot-check.mjs` is not in this plan's `files_modified` list, the failure reproduces identically with zero code changes (the self-test), and the fix (if any) is a Chrome-session/OS-environment issue on this specific developer machine, not a code defect in `mazeworld.html`, `roller.js`, or any file this phase touched.

**Mitigating evidence:** `tools/roller-repro.mjs --scenario all` (this plan's Task 2 AFTER table) drives the **actual rebuilt `www/index.html`** through a real headless-Chrome CDP session — title screen → roll → reveal → DESCEND → Hero tab — end to end, for all four scenarios, 4/4 matched. This is a strictly stronger live-browser proof of the fixed shell's correctness than `boot:check`'s static `--dump-dom` snapshot would have given; `boot:check`'s own `no-uncaught` check (the one check that isn't blocked by the empty dump) still reports PASS.

**Next step:** re-run `npm run boot:check` in a clean environment (no other Chrome instance already running under the default profile) before the next phase's gates, or migrate `shell-boot-check.mjs` to the same CDP-driven approach `roller-repro.mjs` uses (proven to work around this machine's Chrome-singleton quirk) — tracked here, not actioned by this plan.
