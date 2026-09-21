# Bramblewood — regression checklist

This project has no test suite and no CI gate. `main` deploys straight to production, to a Capacitor
shell and a PWA that children open directly — there is no staging ring, no phased rollout, and no
one between a merge and a kid's phone. This document is the manual gate until an automated one
exists. Run it against the dev server (`npm run dev`, default `http://localhost:5180`) before any
merge to `main` touches rendering, layout, or a game's state machine.

## What a release must satisfy

- **No console errors** on load or during play, on any of the five reference sizes below, for any
  of the twelve pages.
- **Every game reaches its own "done" screen** at least once per release (won/lost/finished/museum
  — see the per-game table). A game that cannot be completed is a release blocker, not a bug ticket.
- **No control is unreachable or overlapped.** Every button a child needs is fully on screen, not
  hidden under the Bramblewood home link, and at least 44×44 px.
- **No stale frame.** Backgrounds and boards repaint when the thing they depict changes, even if the
  canvas pixel size does not (see "cached layers" below).
- **The hub's cards all resolve** to a working game page and back again.
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
| **Hub** (`index.html`) *(unverified)* | Load the page. Confirm 11 game cards render with thumbnails/photos, not blank tiles. Tap "Cloudhopper" (top-left card). Confirm it navigates to `cloudhopper.html` and the game loads. Tap the Bramblewood link top-right inside that game. Confirm you land back on the hub. | No debug handle on the hub. Check visually: `document.querySelectorAll('.gamecard').length === 11` in devtools, and that none of the 11 `href`s 404. |
| **Cloudhopper** (`cloudhopper.html`) *(unverified)* | From the hub, open Cloudhopper. The title screen offers one road, "The journey" — check there is no second mode button beside it and no shop icon in the top bar. Open it: islands and real airports should be numbered 1, 2, 3 … in one grid, in the order the stars open them, with "You are here" on the first unfinished open stop. Tap stop 1, Mission 1 → play. Draw a route from the first aircraft to the runway and let it land. While it is still rolling out, route a second aircraft to the same runway: once the first is about a quarter of the way down the strip, the second should be cleared in rather than sent around. Then tap the green build button under the pause button: the upgrade list should open over the paused airport, a bought upgrade should apply at once (buy Radar and the distance readout should start appearing further out), and the back arrow should return you to the same shift. The mission-complete card carries the same list on its gold Upgrades button. | `window.__wh.getMode()` should read `'playing'` once the mission starts. After one landing, `window.__wh.getWorld().planes.length` should have dropped by one and `.failure` should still be `null`/undefined (no crash was recorded). |
| **Night Watch** (`nightwatch.html`) *(unverified)* | Open the game. Let the first figure show, wait for the lines to fade (phase should move to `drawing`). Reconnect the stars in the order shown. | `window.__nw.debugState().phase` goes `intro` → `showing` → `drawing`, and on a correct reconnect either `solved` (with the figure's id added to `.solved`) or `wrong` if you got it wrong. `round` stays `0` until you clear round 1, then becomes `1`. |
| **Orbit** (`orbit.html`) *(unverified)* | Open the game (it opens on the Puzzle tab). Tap the planets in order, nearest the sun first, for round 1 (4 rocky planets). Then tap the Explore, To scale, and Missions tabs once each just to confirm they render without a crash. | `window.__orbit.debugState()`: `phase` starts `'picking'`, `placed` increments with each correct tap, `next` shows the id of the planet still wanted. After the 4th correct tap, `phase` should move on (`roundDone` or the next round starts and `round` becomes `1`). |
| **Dino Dig** (`dig.html`) | Open the game, pick the first site. Use the tools to expose bone, then answer the species question, then let it reveal. | `window.__dig.debugState()`: `phase` goes `dig` → `ask` → `reveal` (or `wrong` if the guess is wrong), `exposed` rises above 0 as you brush/chisel, and `found` increases by one once the specimen is confirmed in the museum. |
| **Puffball** (`puffball.html`) | Open the game, pick night 1. Tap an arrow once: the hedgehog should move exactly one square and stop. Hold it: it should keep walking and stop on the next square when you let go. Then drop a puffball, count the lit squares, move away, let it pop, catch a mole or clear a pot. | `window.__puff.debugState()`: `phase` is `play`, `puffs` goes from 0 to 1 while it's ticking and back to 0 after it pops, `reach` matches the number printed on the cap, and either `knocks` increases (a mole caught) or `potsLeft` decreases. |
| **Moonshot** (`moonshot.html`) | Open the game; the starter rocket is on the pad. The shelf has five tabs and pages within them; step through every page of every tab and check nothing is a blank square. Tap an engine on the rocket: a panel should offer ignition delays, and picking one should put a yellow badge on that engine. Tap a cargo bay on the rocket: the hold should open with two slots, tapping Rover and Camera should fill it, the bay should show two gold dots, and the pill under the destination chip should read "photo · hold 2/2". Fly a rocket carrying a camera, a solar panel, an aerial, a parachute, a leg and a flag: the card at the end must list a picture coming home, a landing under the parachute, and the flag planted - none of that kit may fall away with the first stage. Tap the destination chip top-left: the whole list of places should appear with NASA photographs and the speed each one needs. Pick Mars. Tap the Motoren tab and tap the big engine (it should go *under* the stack, not on top). Tap Tanks and tap a tank (it should slide in *under* the capsule). Tap Boosters and tap a booster twice (one should land on each side). Drag one booster down onto the shelf to bin it. Press Undo. Then Launch, steer with the two thumb pads, and let the fuel run out. On the way up watch the rail down the right-hand edge: the marks you pass (birds, aeroplanes, the edge of the air) should turn gold, the dashed gold line should sit at your best height, and going over it should jolt the frame and say so. Birds should pass in the first kilometre, a weather balloon around thirty, satellites from four hundred; when the engines stop, the view should keep climbing with the number rather than freezing. Turn the phone sideways mid-flight: the rail moves to the left edge and must not sit under the stage button or the thumb pads. | `window.__moon.debugState()`: `phase` goes `build` → `count` → `fly` → `coast` → `done`. In `build`, `design` lists every part as `id@col,row`, `problem` is the one line shown on screen (null when nothing is wrong), and `stages` shows how many stages each column has. During `fly`, `altKm` and `vUp` rise and `dropped` climbs each time a stage falls away — side boosters should drop before the core. At `done`, `topKm` is the height reached, `best` the highest rung recorded, and the card should show where you got to with its photograph plus how much more speed your chosen target wanted. Build something deliberately wrong and check `problem` names it: a tank in a column of its own (dead weight), two engines stacked (never lights), one booster on one side only (lopsided), no capsule at all. |
| **Millstream** (`mill.html`) | Open the game, pick valley 1. It should stay dry: a card says what the valley wants ("Breng het water naar 1 akker"), a countdown button says how long you have, and the card fades after about six seconds. Dig a channel from spring to field, then press the button rather than waiting it out. | `window.__mill.debugState()`: `prep` counts down from 15 and `water` stays 0 until it reaches 0 or the button is pressed. `phase` moves `levels` → `play` → `won` (or `failed` if the channel floods/stalls), `water` (total water) rises above 0, and `wasted` should not run away while you're actively directing flow. |
| **Tidepool** (`tidepool.html`) | Open the game, pick tide 1. Sort three or four creatures by the shown rule, then let the rule change once and sort one more correctly. | `window.__tide.debugState()`: `phase` is `play`, `rule` changes value partway through the level, `correct` increments on right sorts, `wrong`/`missed` should not climb on the ones you got right, and `resolved` tracks total handled. |
| **Dierenboek** (`animals.html`) | Open the page. It should show a loading ring of drawn animals for a moment and then nine coloured shelf tiles, each with a drawn animal and a count, under a line saying how many of the animals you have looked at. Tap **Zoogdieren**: a grid of photograph cards, two or three to a row, names underneath. Photographs arrive over the network, so watch a card go from a shimmering coloured panel to a real animal - if a card is still a faint silhouette after a few seconds, that photograph failed and the fallback is what you are looking at. Scroll well down the grid and back: cards must keep filling in and nothing may flicker. Tap a card. The animal's page must show a large photograph with the photographer and licence along its foot, the name in Dutch, English and Latin, a size bar with a grey child and the animal on one ruler standing on one line, a world map with the right continents lit, the facts, and the Wikipedia paragraph. Press **+** and **−** on the size bar: the child changes height and the animal rescales against it. Press **Volgende** a few times. Go back twice, tap **Zoeken**, type `l e e u`: results should appear from the second or third letter. Tap one, then **Verras me** - it must open an animal you have not seen. Go back to the shelves: the count and the green bar must have moved up. | `window.__animals.debugState()`: `view` goes `loading` → `shelves` → `grid` → `detail` → `search`, `count` is the whole book (about two thousand), `shown` is the shelf or the search results, `open` is the scientific name of the animal on screen, `seen` climbs by one per new animal and never falls, and `buttons` lists every hit box currently on screen with its centre. `window.__animals.tap('shelf:bir')` presses a button by name without aiming, and `window.__animals.scrollTo(px)` puts a long list where you want it. |
| **Market Day** (`market.html`) | Open the game, pick market day 1. Fill a customer's basket to match their pictured/numeral order and serve them; repeat for a second customer. | `window.__market.debugState()`: `phase` is `play`, `served` increments per correct order, `baskets` reflects what's currently in the stall, `patience` counts down for the active customer and resets/advances on serve, `wrong` should not climb on correct fills. |
| **Klokkijken** (`clock.html`) | Open the game; nine level cards, each with a real clock face on it. Pick level 1 and read three whole hours. Get one deliberately wrong: the ring round the clock goes red, the hour hand lights up orange, the slice of dial it is inside is shaded, the number it has left is circled, the card under the question reads the time out in Dutch ("half vier · 3:30"), the right answer goes green and the one you picked goes red, and a Verder button carries on - it must never dead-end and never fail you out. Finish the level and check the stars. Then pick level 5 (Zet de klok) and drag the hands: dragging the long hand must carry the short hand along with it, and taking the long hand past twelve must move the hour on by one. Take the long hand backwards past twelve and the hour must go back. Press the 5 10 button top left: the minute ring appears on the dial and survives a reload. Check level 7 (Zoek de klok) and level 9 (Hoeveel later) render and can be answered, in portrait and turned sideways - on its side the four faces move to the left half and the digital clock to the right. | `window.__clock.debugState()`: `phase` goes `levels` → `play` → `won`; `kind` is one of `read`/`set`/`match`/`elapsed`; `target` is the time asked about and `hands` the hands as they stand; `spokenNl` must read "half vier" for 3:30 and "tien voor half vier" for 3:20; `feedback` goes `none` → `right`/`wrong` → `none`; `firstTry` counts only answers given before the clock explained itself, and `stars` follows from it. `buttons` lists every drawn control, and after a wrong answer must include `go`. |

**Every game, every time:** the top right corner must show the same round house button, and, once you are inside a level, the same
round chevron beside it. No words in either. The chevron must be absent on a level list and present during play, and one tap must
come back out of the level without leaving the game.

For every game with a `hits`-bearing `debugState()` (mill, tidepool, market, dig, puffball, and
Orbit's mission screen), `buttons` gives the on-screen centre of every tappable control — useful for
confirming a button that looks fine is actually where the game thinks it is, if a bug report says a
tap "does nothing" at a particular size.

## Checks that run without a browser

`npm test` bundles the rule modules with esbuild and asserts against them: when a runway is clear
for the next arrival, how a Moonshot design cuts into stages, what is dead weight, what the air
makes of a shape, who carries on walking in Puffball, and that the journey lists every island and
every airport once, in a never-decreasing order of stars. It runs in about a second and needs no
device. Run it before every push; it is not a substitute for the paths below, but every rule it
covers is one that used to be checked only by eye.

## Cross-cutting checks

Run these on every page, not just the ones you changed — a shared CSS or util file (`uiScale`,
`style.css`, `render/look.ts`) can regress every game at once.

| Check | What to do | What "pass" looks like |
|---|---|---|
| Console errors | Open devtools console, load each of the 12 pages fresh | No red errors on load or during a short play session |
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
