# Store screenshot capture

Headless capture of Play Store screenshots (phone 1080x1920, 7" tablet
1350x2400, 10" tablet 1620x2880 — all exact 9:16) from the shipped `www/`
build, using the locally installed Chrome. Nothing here ships in the app.

```
cd tools/store-screenshots
npm init -y && npm i playwright-core     # one-time; uses installed Chrome, no download
node serve.js &                          # static server for www/ on :8765
node capture.js                          # plays real runs, saves scenes.json, renders out/<size>/
node capture.js --replay                 # re-render from scenes.json without replaying
```

`bot.js` explores with a BFS toward unvisited feature tiles, handles
encounters/loot/finds/joiners/shops, and stops on death. `capture.js` plays
until it has each scene plus five graves, then re-renders every scene at every
size. Overlay scenes are injected via `window.__mzState.set()` (a resumed save
nulls `combat`/`store`/`pendingFind` by design); the combat scene resumes from
the state one step before the encounter and plays two real rounds so the fight
log is populated. Copy the picks into `store-listing/screenshots/`.
