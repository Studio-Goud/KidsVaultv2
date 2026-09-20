# Bramblewood

Bramblewood is a small world of games for children, built as one codebase. No advertising, no
third-party tracking, no account. Every game practises something real and ends properly: a session
has a beginning and an end, with no endless loop and no daily reward pulling anyone back.

English is the first language; Dutch is included.

## The games

### Cloudhopper (`index.html`)
Draw a route with your finger from every incoming aircraft to the runway. Aircraft must not touch:
within 60 m is a near miss, within 10 m a collision. Six islands rising in difficulty, plus twelve
real-world airports, with weather, multiple runways, seaplanes and helicopters. After a failed
mission you get a replay and an analysis of what went wrong.
Practises dividing attention, planning ahead, holding back and spatial reasoning. Age 6 and up.

### Night Watch (`nightwatch.html`)
The sky shows a figure in the stars, the lines fade, and you draw it back from memory. Six figures a
session, each with more lines, more look-alike stars and less time to look.
Practises visual working memory. Age 5 and up.

### Orbit (`orbit.html`)
Four tabs. Puzzle: put the eight planets in order by distance, size, day length and temperature, in
real NASA photographs. Explore: every planet and eight moons with their day, year, temperature and
size. To scale: distance and size on one strip. Missions: launch a probe from Earth (or from a
parking orbit around Earth for the Moon) and aim at where the planet will be, not where it is. Eight
missions, from the Moon to a grand tour past Mars to Jupiter with a mid-course burn, scored on fuel
left and flight time. Real physics: Kepler orbits, gravity, semi-implicit Euler, a dotted prediction
line that gets shorter in the harder missions.
Practises ordering, comparing, predicting motion and the solar system. Age 5 and up.

### Dino Dig (`dig.html`)
Excavate real fossils (Smithsonian, NASA and Wikimedia public domain photographs) with brush, chisel,
hammer and scribe, each with its own reach, bite and risk, before the daylight runs out. Ten species
across the Triassic, Jurassic and Cretaceous; every find goes into a museum with a timeline and a
size comparison against a person.
Practises fine motor control, patience, tool choice and deep time. Age 5 and up.

### Millstream (`mill.html`)
Dig channels and raise banks so the spring water reaches the fields and turns the mill wheels. Eight
valleys with rocks, slopes and multiple targets; the water is a real flow simulation, so a channel
that is too steep floods and one that is too shallow stalls.
Practises spatial reasoning, planning ahead and cause and effect. Age 5 and up.

### Tidepool (`tidepool.html`)
Sort what the tide brings into the right pools by colour, kind, size or spots. Then the rule changes
without warning, and creatures that fit the old rule but not the new one are the trap. Eight tides.
Practises cognitive flexibility and rule switching. Age 4 and up.

### Market Day (`market.html`)
Customers come to your stall with an order in pictures and a numeral: three apples, two pears and a
plum, six strawberries shared fairly between two baskets, or a basket that already has two carrots
and a customer who wants five. Eight market days, up to twelve customers with a patience ring.
Practises counting out, counting two things at once, sharing equally and how many more. Age 4 and up.

## Stack
- Vite + TypeScript, Canvas 2D, multi-page build (one entry per game)
- Photographs only where they are real: NASA planets and moons, public domain fossils; everything
  else is drawn procedurally. Credits are shown in-game. Licence rule: public domain, CC0 or CC BY only.
- WebAudio, all sound synthesised in `src/util/audio.ts` and per-game `*sfx.ts`
- Capacitor 7 for the native iOS and Android shell
- PWA manifest, so it installs straight from the browser too

## Developing
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
```

## Android (Android Studio nodig)
```bash
npm run cap:android   # bouwt web, synct naar android/ en opent Android Studio
```
Daarna in Android Studio: Build > Generate Signed Bundle voor de Play Store.

## iOS (Mac met Xcode nodig)
```bash
npm run cap:ios       # bouwt web, synct naar ios/ en opent Xcode
```
Op de Mac eerst eenmalig `cd ios/App && pod install`. Daarna in Xcode: signing team kiezen, archiveren, uploaden naar TestFlight.

## Iconen
`npm run icons` genereert PWA-iconen en Android launcher icons uit een SVG (scripts/icons.mjs).
Voor iOS: `public/icons/icon-1024.png` in Xcode slepen naar Assets > AppIcon.

## Structuur
- `src/hub/` het hoofdmenu (index.html), kaarten en miniaturen
- `src/games/<naam>/` de overige games, elk met eigen model, sfx en game.ts
- `src/util/` gedeeld: uiScale, audio, opslag, rng
- `src/game/` simulatie: vliegtuigen (echte types), levels, wind, botsingen, post-mortem analyse
- `src/render/` terrein, decor, vliegtuigtekeningen, effecten, HUD
- `src/ui/` DOM-schermen en de herhaling
