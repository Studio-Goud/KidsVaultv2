# Bramblewood — regression checklist

This project has no test suite and no CI gate. `main` deploys straight to production, to a Capacitor
shell and a PWA that children open directly — there is no staging ring, no phased rollout, and no
one between a merge and a kid's phone. This document is the manual gate until an automated one
exists. Run it against the dev server (`npm run dev`, default `http://localhost:5180`) before any
merge to `main` touches rendering, layout, or a game's state machine.

## What a release must satisfy

- **No console errors** on load or during play, on any of the five reference sizes below, for any
  of the nine pages.
- **Every game reaches its own "done" screen** at least once per release (won/lost/finished/museum
  — see the per-game table). A game that cannot be completed is a release blocker, not a bug ticket.
- **No control is unreachable or overlapped.** Every button a child needs is fully on screen, not
  hidden under the Bramblewood home link, and at least 44×44 px.
- **No stale frame.** Backgrounds and boards repaint when the thing they depict changes, even if the
  canvas pixel size does not (see "cached layers" below).
- **The hub's eight cards all resolve** to a working game page and back again.
- Session boundaries hold: nothing loops forever, nothing nags to return. If a change touches a
  results/complete screen, confirm it still ends the session rather than auto-advancing.

If any of the above fails, the build does not go out, regardless of schedule pressure. Escalate to
producer, don't ship around it.

## Per-game critical path

Each path is written to run on a phone in under a minute. Where a debug handle exists, open it
from a laptop devtools console tethered to the phone (or just Chrome devtools on desktop at a
narrow viewport) and read it after the step described — the point is to confirm state, not to
replace playing the game with your thumb.

Status note: the mill, tidepool, market, dig and puffball loops below were played today at four
sizes and passed. Cloudhopper, Orbit, Night Watch, and the hub critical paths below are written from
reading the code, not from having played them this session — treat them as **unverified** until
someone actually runs them.

| Game | Path (what to do) | What the debug handle should report |
|---|---|---|
| **Hub** (`index.html`) *(unverified)* | Load the page. Confirm 9 game cards render with thumbnails/photos, not blank tiles. Tap "Cloudhopper" (top-left card). Confirm it navigates to `cloudhopper.html` and the game loads. Tap the Bramblewood link top-right inside that game. Confirm you land back on the hub. | No debug handle on the hub. Check visually: `document.querySelectorAll('.gamecard').length === 9` in devtools, and that none of the 9 `href`s 404. |
| **Cloudhopper** (`cloudhopper.html`) *(unverified)* | From the hub, open Cloudhopper. Tap through to Worlds → pick World 1, Mission 1 → play. Draw a route from the first aircraft to the runway and let it land. While it is still rolling out, route a second aircraft to the same runway: once the first is about a quarter of the way down the strip, the second should be cleared in rather than sent around. | `window.__wh.getMode()` should read `'playing'` once the mission starts. After one landing, `window.__wh.getWorld().planes.length` should have dropped by one and `.failure` should still be `null`/undefined (no crash was recorded). |
| **Night Watch** (`nightwatch.html`) *(unverified)* | Open the game. Let the first figure show, wait for the lines to fade (phase should move to `drawing`). Reconnect the stars in the order shown. | `window.__nw.debugState().phase` goes `intro` → `showing` → `drawing`, and on a correct reconnect either `solved` (with the figure's id added to `.solved`) or `wrong` if you got it wrong. `round` stays `0` until you clear round 1, then becomes `1`. |
| **Orbit** (`orbit.html`) *(unverified)* | Open the game (it opens on the Puzzle tab). Tap the planets in order, nearest the sun first, for round 1 (4 rocky planets). Then tap the Explore, To scale, and Missions tabs once each just to confirm they render without a crash. | `window.__orbit.debugState()`: `phase` starts `'picking'`, `placed` increments with each correct tap, `next` shows the id of the planet still wanted. After the 4th correct tap, `phase` should move on (`roundDone` or the next round starts and `round` becomes `1`). |
| **Dino Dig** (`dig.html`) | Open the game, pick the first site. Use the tools to expose bone, then answer the species question, then let it reveal. | `window.__dig.debugState()`: `phase` goes `dig` → `ask` → `reveal` (or `wrong` if the guess is wrong), `exposed` rises above 0 as you brush/chisel, and `found` increases by one once the specimen is confirmed in the museum. |
| **Puffball** (`puffball.html`) | Open the game, pick night 1. Tap an arrow once: the hedgehog should move exactly one square and stop. Hold it: it should keep walking and stop on the next square when you let go. Then drop a puffball, count the lit squares, move away, let it pop, catch a mole or clear a pot. | `window.__puff.debugState()`: `phase` is `play`, `puffs` goes from 0 to 1 while it's ticking and back to 0 after it pops, `reach` matches the number printed on the cap, and either `knocks` increases (a mole caught) or `potsLeft` decreases. |
| **Moonshot** (`moonshot.html`) | Open the game; the starter rocket is on the pad. Tap the Motoren tab and tap the big engine (it should go *under* the stack, not on top). Tap Tanks and tap a tank (it should slide in *under* the capsule). Tap Boosters and tap a booster twice (one should land on each side). Drag one booster down onto the shelf to bin it. Press Undo. Then Launch, steer with the two thumb pads, and let the fuel run out. | `window.__moon.debugState()`: `phase` goes `build` → `count` → `fly` → `coast` → `done`. In `build`, `design` lists every part as `id@col,row`, `problem` is the one line shown on screen (null when nothing is wrong), and `stages` shows how many stages each column has. During `fly`, `altKm` and `vUp` rise and `dropped` climbs each time a stage falls away — side boosters should drop before the core. At `done`, `topKm` is the height reached and `best` the highest ladder rung recorded. Build something deliberately wrong and check `problem` names it: a tank in a column of its own (dead weight), two engines stacked (never lights), one booster on one side only (lopsided), no capsule at all. |
| **Millstream** (`mill.html`) | Open the game, pick valley 1. It should stay dry: a card says what the valley wants ("Breng het water naar 1 akker"), a countdown button says how long you have, and the card fades after about six seconds. Dig a channel from spring to field, then press the button rather than waiting it out. | `window.__mill.debugState()`: `prep` counts down from 15 and `water` stays 0 until it reaches 0 or the button is pressed. `phase` moves `levels` → `play` → `won` (or `failed` if the channel floods/stalls), `water` (total water) rises above 0, and `wasted` should not run away while you're actively directing flow. |
| **Tidepool** (`tidepool.html`) | Open the game, pick tide 1. Sort three or four creatures by the shown rule, then let the rule change once and sort one more correctly. | `window.__tide.debugState()`: `phase` is `play`, `rule` changes value partway through the level, `correct` increments on right sorts, `wrong`/`missed` should not climb on the ones you got right, and `resolved` tracks total handled. |
| **Market Day** (`market.html`) | Open the game, pick market day 1. Fill a customer's basket to match their pictured/numeral order and serve them; repeat for a second customer. | `window.__market.debugState()`: `phase` is `play`, `served` increments per correct order, `baskets` reflects what's currently in the stall, `patience` counts down for the active customer and resets/advances on serve, `wrong` should not climb on correct fills. |

For every game with a `hits`-bearing `debugState()` (mill, tidepool, market, dig, puffball, and
Orbit's mission screen), `buttons` gives the on-screen centre of every tappable control — useful for
confirming a button that looks fine is actually where the game thinks it is, if a bug report says a
tap "does nothing" at a particular size.

## Checks that run without a browser

`npm test` bundles the rule modules with esbuild and asserts against them: when a runway is clear
for the next arrival, how a Moonshot design cuts into stages, what is dead weight, what the air
makes of a shape, and who carries on walking in Puffball. It runs in about a second and needs no
device. Run it before every push; it is not a substitute for the paths below, but every rule it
covers is one that used to be checked only by eye.

## Cross-cutting checks

Run these on every page, not just the ones you changed — a shared CSS or util file (`uiScale`,
`style.css`, `render/look.ts`) can regress every game at once.

| Check | What to do | What "pass" looks like |
|---|---|---|
| Console errors | Open devtools console, load each of the 10 pages fresh | No red errors on load or during a short play session |
| Reference sizes | Resize/rotate to 390×844, 360×640, 844×390, 820×1180, 1440×900 | Layout adapts at all five; nothing requires a sixth to look right |
| Controls on screen | At each size, check every button/tool/HUD element | Nothing is clipped, pushed off-canvas, or requires scrolling to reach (games don't scroll; the hub does) |
| Bramblewood link collisions | At each size, check the top-right home link against nearby HUD elements | The link never overlaps a game button; nothing sits underneath it un-tappably |
| Touch target size | Measure any control that looks tight, especially in landscape | Every tappable control is at least 44×44 px |
| Orientation flip mid-session | Rotate the device while a level is in progress, not just before starting one | The layout re-flows without freezing the game or losing state (`debugState()` still responds) |
| Back link round-trip | From inside each game, tap the Bramblewood link | Returns to `index.html`, hub renders normally, no stuck overlay |

## What has broken before — re-check every time

1. **A canvas not sized by CSS because its id is missing from the fullscreen rule.** The rule in
   `src/style.css` is:
   `#game, #sky, #space, #dig, #valley, #pool, #stall, #wood { position: fixed; inset: 0; width: 100%; height: 100%; ... }`
   These eight ids must cover all eight game canvases (`game` = Cloudhopper, `sky` = Night Watch,
   `space` = Orbit, `dig` = Dino Dig, `valley` = Mill, `pool` = Tidepool, `stall` = Market,
   `wood` = Puffball). This is what broke Puffball before — its canvas id (`wood`) had been left out
   of the rule, so the canvas rendered at its default intrinsic size instead of filling the screen.
   **Re-check:** whenever `style.css` changes, or a game's HTML file changes, confirm its canvas id
   is still in that selector list, and that the canvas actually fills the viewport on load.

2. **Layout that assumes a tall screen and collapses in landscape.** This broke Market Day,
   Tidepool, and Dino Dig previously — UI built for portrait aspect ratios (stall counter, pool
   rows, dig site framing) either overlapped itself or ran off-screen once width exceeded height.
   **Re-check:** every game, not just these three, at 844×390 (landscape phone) specifically, not
   just at the tall sizes. Test starting a level already in landscape, and also rotating into
   landscape mid-level.

3. **A cached drawing layer keyed on too little, so it shows a stale picture.** `render/look.ts`'s
   `CachedLayer.get(w, h, key, draw)` only redraws when the canvas size *or* the caller's `key`
   string changes. Several games pass a `key` that does not include everything that affects the
   picture — for example Night Watch's sky layer uses the constant key `'night'` and Tidepool's
   sand layer uses the constant key `'sand'`, regardless of which round or level is showing. If a
   future change makes that background vary by level while the canvas stays the same pixel size
   (e.g., advancing to the next level without a resize), the old picture will keep showing.
   **Re-check:** after finishing a level and moving to the next one *without* resizing or rotating,
   confirm every background/board element that should reflect the new level actually changed
   (Mill's valley art, Tidepool's sand/pool layout, Puffball's board, Dino Dig's land and trench,
   Market's stall/counter). If it looks identical to the previous level, and it shouldn't, that's
   this bug back.

## What is deliberately not covered here

- **Frame rate / performance.** The dev machine runs several agents at once; any number measured
  right now is noise, not signal. Performance needs its own pass on an idle machine, not a place in
  this checklist.
- **Audio content correctness** (mixes, synthesis quality) — `src/util/audio.ts` and the per-game
  `*sfx.ts` files are a sound-design concern, not a functional regression risk covered here. This
  checklist only expects that audio doesn't throw a console error.
- **Dutch-language text review** — the i18n switch (`NL()`/`T()` in each game) is exercised by these
  paths incidentally (whichever the `navigator.language` gives you), but translation accuracy and
  completeness need a bilingual reviewer, not a QA click-through.
- **Native shell behaviour** (Capacitor iOS/Android, PWA install, app icons) — this checklist is
  scoped to the web build served by Vite. Native packaging has its own release checklist once it
  exists.
- **Full playthroughs of every level/valley/mission/night.** The critical paths above prove each
  game's core loop still works, not that all eight levels of every game are individually bug-free.
  Content-level bugs within a specific level are tracked as ordinary bugs, not regression blockers.
- **Save/progress persistence across sessions** (coins, unlocked levels, `localStorage`) — worth its
  own pass, but not exercised by these single-session critical paths.
