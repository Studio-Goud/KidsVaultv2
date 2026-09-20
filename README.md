# Bramblewood

Bramblewood is a small world of games for children, built as one codebase. No advertising, no
third-party tracking, no account. Every game practises something real and ends properly: a session
has a beginning and an end, with no endless loop and no daily reward pulling anyone back.

English is the first language; Dutch is included.

`index.html` is Bramblewood itself: the page that holds every game and says in a line what each
one practises. Each game has its own page beside it.

## The games

### Cloudhopper (`cloudhopper.html`)
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
real NASA photographs. Explore: eleven worlds - the sun, the eight planets, and the dwarf planets
Ceres and Pluto - and ten moons, with their day, year, temperature and size. To scale: distance and size on one strip. Missions: launch a probe from Earth (or from a
parking orbit around Earth for the Moon) and aim at where the planet will be, not where it is. Eight
missions, from the Moon to a grand tour past Mars to Jupiter with a mid-course burn, scored on fuel
left and flight time. Real physics: Kepler orbits, gravity, semi-implicit Euler, a dotted prediction
line that gets shorter in the harder missions.
Practises ordering, comparing, predicting motion and the solar system. Age 5 and up.

### Moonshot (`moonshot.html`)
Build a rocket out of the parts you choose - capsule, tanks, engines, fins, strap-on boosters - and
a balance on the workshop screen weighs the push against the weight while you build, so a rocket
that cannot lift itself never leaves the pad. When you decide it is finished you launch it, steer it
upright against the wind with two thumbs, drop each stage as it runs dry, and see how far the speed
you were left with carries you: up with the birds, through the clouds, past the satellites, as far
as the Moon, away from the Earth, as far as Mars. Each rung reached hands over the next part, so the
rocket that got you there is the reason you can build a better one.

Shape matters as much as power. The air only cares about two things and both of them are visible
in the drawing: how wide the rocket is across, and how long it is for that width. A short fat
rocket leaves a hole behind it that the air falls into, and that hole is most of the drag; a long
thin one lets the air close up gently. Boosters strapped to the sides make the rocket wider and
cost more than they look, which is why a fourth pair buys almost nothing - and why the rocket
visibly picks up speed the moment they drop off. Fins keep it pointing straight in the thick air
and cost a slice of the top speed for it. A gauge under the balance says how slippery the thing you
have built is and what is costing the most, and in flight the air itself shows up: streaks past the
body and a nose that glows hotter the harder the air is pushing.

The rest of the physics is honest too. Mass falls as fuel burns, gravity weakens by the inverse
square, the air thins out exponentially and stops both pushing back and holding you straight, a
spent stage is dead weight until it is dropped, and exhaust speed decides how far you end up going
- which is why the quiet vacuum engine beats the loud one, and why the last part is a nuclear
engine NASA really did build and fire in the sixties. The only thing bent for a child is the clock:
tanks empty in seconds rather than minutes.
Practises weighing one thing against another, cause and effect, shape against speed, and
reading a number that grows. Age 6 and up.

### Dino Dig (`dig.html`)
Excavate real fossils (Smithsonian, NASA and Wikimedia public domain photographs) with brush, chisel,
hammer and scribe, each with its own reach, bite and risk, before the daylight runs out. Ten species
across the Triassic, Jurassic and Cretaceous; every find goes into a museum with a timeline and a
size comparison against a person.
Practises fine motor control, patience, tool choice and deep time. Age 5 and up.

### Puffball (`puffball.html`)
Put down a puffball, count how far it reaches, and be somewhere else when it pops. It is
Bomberman's shape - a grid, a fuse, a cross of effect, pots to clear and moles to catch - with the
counting brought to the front: the reach is a number on the cap, and when the puffball goes down
the squares it will cover light up one at a time from the middle outwards, a dot apiece, so the
count happens in front of you. From the third night on the marking dims once it has counted
itself out, leaving only the outline, so the number has to be held rather than read off the floor.
Pick-ups raise the reach, so the comparison has to be made again. Nobody is hurt; whoever is caught
sits down dizzy. Eight nights.
Practises counting squares, comparing two numbers and planning a way out. Age 5 and up.

### Millstream (`mill.html`)
Dig channels and raise banks so the spring water reaches the fields and turns the mill wheels. Eight
valleys with rocks, slopes and multiple targets; the water is a real flow simulation, so a channel
that is too steep floods and one that is too shallow stalls.

Every valley pays in sheaves of grain, and the sheaves build a village of six things that make the
next valley kinder: a water cellar that keeps the spring running longer, a shed with a bigger
spade, a bridge that takes a rock out of the way, a sawmill, a dyke and an orchard. A valley pays
once; come back and do it better and it pays the difference. There is no clock, nothing rots, and
nothing is for sale - the village is a record of how well it was played, not a reason to keep
opening the app.
Practises spatial reasoning, planning ahead, cause and effect and saving up. Age 5 and up.

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
