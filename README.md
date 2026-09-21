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
A workshop, a grid, and a launch button. Twenty-eight parts - nose cones, probes, capsules, a crew
cabin, a fairing, a space shuttle, six tanks from two tonnes to sixteen, eight engines from a toy
to a nuclear one, four solid boosters in single, double and triple, two sets of fins, a taper and a
girder - and every one of them is on the shelf from the first second. Nothing is locked, nothing is
earned, nothing costs anything.

You put parts where you want them. Drag one out of the tray and the grid lights up every cell it
could legally go in; drop it and it bolts on. Drag one that is already on the rocket to move it, or
let go of it over the shelf to take it off. Tap instead of dragging and the game guesses: an engine
goes underneath, a tank slides in under the capsule, a booster goes on whichever side has fewer,
and a second engine becomes a second stage. Take a tank out of the middle and what was above it
falls onto what is below. There is an undo button and there is no limit but the grid itself, which
is nine columns wide and twenty-six rows tall.

The rules are the teacher. Each column of the grid stages itself: an engine owns the tanks above it
until the next engine, and drops away when they run dry - so strap-on boosters fall off first and
the core keeps going, exactly as they do. A tank with no engine under it is dead weight for the
whole flight, an engine with no tank above it never lights, and a rocket whose push is not under
its weight leans over on its own. The build screen says which of those is wrong, one line at a
time, in the order a builder would notice them.

A rocket can be made to taper. The taper piece takes the width of whatever it is standing on and
runs up to the width of whatever is standing on it, so a wide first stage can narrow into a
standard one and then into a slim upper stage without stepping down in ledges - and a nose cone on
top adopts the width it is capping. The boosters come as one, two or three tubes strapped together
in a single piece, and the air treats three tubes as three tubes rather than as one enormous
cylinder. The space shuttle is an orbiter that rides on the side of the tank the way the real one
did: it is payload rather than a stage, so it never falls away, and its engines go under the tank.
It is heavy and the wings catch a great deal of air, which is the trade.

Shape counts as much as power. The air feels how wide the rocket is across, how long it is for that
width, and what is capping each column - so a flat-topped stack is noticeably draggier than the
same stack wearing nose cones, and a fourth pair of boosters buys almost nothing because the drag
eats what the thrust adds. A bar under the rocket says how slippery the thing is; in flight the air
itself shows up as streaks past the body and a nose that glows hotter the harder it is being
pushed.

The physics is honest throughout: mass falls as fuel burns, gravity weakens by the inverse square,
the air thins out exponentially and stops both pushing back and holding you straight, a spent stage
is dead weight until it goes, and exhaust speed - not thrust - decides how far you end up. One grid
column is 1.8 m, which is what makes a two-row tank hold exactly the four and a half tonnes it says
it holds. The only thing bent for a child is the clock: tanks empty in seconds rather than minutes.

Before you launch you say where you are going. Tapping the chip in the corner opens the whole list
- up with the birds, through the clouds, above the aeroplanes, the edge of the air, round the
Earth, past the satellites, the Moon, away from the Earth, Venus, Mars, Jupiter, Saturn, Uranus,
Neptune, and out past the planets - each with the photograph Orbit uses and the speed it really
takes. Those speeds are not invented. Everything past the Moon costs escape velocity, 11.19 km/s,
with however fast you want to still be going once you are clear of the Earth added on top, which
is why Venus and Mars sit a hundred metres a second apart and Jupiter is nearly three thousand
further. Once you are off the Earth at all, the inner planets cost about the same; the expensive
ones are the ones further out. That is not a balance decision, it is the solar system.

At the end the card shows where you actually got to, with its photograph and one true thing about
it, and how much more speed the place you were aiming at would have wanted. Reaching a rung hands
over nothing at all. It is a pencil mark on a doorframe.
Practises weighing one thing against another, cause and effect, shape against speed, and reading a
number that grows. Age 6 and up.

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

A valley starts dry. For the first fifteen seconds nothing flows: a card says what this valley
wants in as many words ("get the water to two fields and a mill wheel"), the pins sit over the
things that want it, and there is time to look and to dig. The card fades before the end so the
last seconds are a clear view, and a button lets anyone who is ready start the water early.

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
