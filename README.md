# Bramblewood

Bramblewood is a small world of games for children, built as one codebase. No advertising, no
third-party tracking, no account. Every game practises something real and ends properly: a session
has a beginning and an end, with no endless loop and no daily reward pulling anyone back.

English is the first language; Dutch is included.

`index.html` is Bramblewood itself: the page that holds every game and says in a line what each
one practises. Each game has its own page beside it.

Every game carries the same two round buttons in the same corner, with no words in them: a house
that goes back to Bramblewood, and, beside it, a chevron that goes back exactly one screen - out
of a level to the level list, out of a flight to the workshop, out of the museum to the dig. The
chevron hides itself when there is nothing to go back to.

## The games

### Cloudhopper (`cloudhopper.html`)
Draw a route with your finger from every incoming aircraft to the runway. Aircraft must not touch:
within 60 m is a near miss, within 10 m a collision. One journey, not two menus: six islands and
twelve real-world airports on a single numbered road, in the order the stars open them, with the
stop you are up to marked. Weather, multiple runways, seaplanes and helicopters. The airport is
upgraded from the tower during a shift - a button beside the pause button, which lights up the
moment the coins will buy something - and again on the card at the end of a mission, so the
upgrades are never a tab of their own. After a failed mission you get a replay and an analysis of
what went wrong.
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
A workshop, a grid, and a launch button. A hundred and three parts - cones and fairings and heat
shields, probes and satellites and telescopes, capsules and cabins and a station module, landers
and rovers and a space shuttle, twenty-one tanks from a needle to a giant, twenty-two engines from
a vernier thruster to thirty at once to a nuclear reactor, eleven strap-on boosters in single,
double and triple, fins and grid fins and wings and airbrakes, tapers and girders and decouplers,
and legs and parachutes and solar panels and a flag - and every one of them is on the shelf from
the first second. Nothing is locked, nothing is earned, nothing costs anything.

Every number follows a rule rather than a guess. A tank's fuel is its volume: 2.75 tonnes per unit
of width squared times height, which is why a wide tank holds so much more than a tall thin one and
why the air hates it for exactly the same reason. Its empty mass is four per cent of what it
carries, except where the shape changes that - a sphere is the lightest skin for a volume, a
balloon tank is thinner still, a pressure tank is thicker. An engine is given a thrust and an
exhaust speed, both real, and its burn rate falls out of them.

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

Each engine can be told to wait. Tap one on the rocket and pick how many seconds after lift-off it
lights: a second pair of boosters a minute in, an upper stage that holds until the first one is
done. Real rockets stagger their ignitions constantly, and here it is the difference between
spending all your thrust in the first ten seconds and a rocket that keeps pushing. In flight there
is a button to let go of something early - the boosters, or the stage, or, if you have put a
decoupler on, exactly where the decoupler is.

Before you launch you say where you are going. Tapping the chip in the corner opens the whole list
- up with the birds, through the clouds, above the aeroplanes, the edge of the air, round the
Earth, past the satellites, the Moon, away from the Earth, Venus, Mars, Jupiter, Saturn, Uranus,
Neptune, and out past the planets - each with the photograph Orbit uses and the speed it really
takes. Those speeds are not invented. Everything past the Moon costs escape velocity, 11.19 km/s,
with however fast you want to still be going once you are clear of the Earth added on top, which
is why Venus and Mars sit a hundred metres a second apart and Jupiter is nearly three thousand
further. Once you are off the Earth at all, the inner planets cost about the same; the expensive
ones are the ones further out. That is not a balance decision, it is the solar system.

On the way up there is something to see out of the window at every height, and each thing is at
roughly the height it really flies: a flock of birds in the first kilometre, a weather balloon at
thirty, satellites from four hundred, and the Earth curving away and going dark behind them. Down
the right-hand edge runs a doorframe - birds, aeroplanes, the edge of the air, the space station,
the satellites, the Moon - on a logarithmic scale, because that is the only way a kilometre and the
Moon fit on one phone. The marks you have passed turn gold as you pass them. Across it is a dashed
gold line at the highest any rocket of yours has ever been, and going over it jolts the frame and
says so. The rocket also calls Max Q, the moment the air is pushing hardest - which is neither the
fastest moment nor the highest, and is why it is worth naming - and every separation now comes with
a flash, a ring of smoke and a scatter of sparks rather than happening silently. When the engines
stop the window keeps climbing with the number, so the coast is a view rather than a wait.

Everything on the shelf has a job, and the shelf says what it is. The jobs chain, the way they do
on a real rocket: a camera takes a picture, a battery or a solar panel powers it, an aerial sends
it home, and if one of the three is missing nothing comes back. A parachute brings the payload
down and says how many tonnes it can hold; landing legs let it stand up when it gets there; a flag
has to have something to stand on. Struts and girders damp the wobble, an air brake really brakes.
The cargo bay is a hold with doors: tap it on the rocket and two things go inside - a rover, a
satellite, a camera, a flag - where they are carried but the air never touches them, which is what
a fairing is for and why the empty weight is worth paying. The build screen lists what the rocket
can do before it goes, and the card at the end lists what it actually managed, line by line,
including the ones it did not: "no aerial, so no picture came home".

Your best height is kept, and the build screen says it under the destination chip along with the
next place along the ladder. Opening the list shows a flag planted on every place you have already
reached and a count at the top - six of fifteen - which turns a menu into a collection.

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

The land is drawn from the height field you are shaping: colour from height, brightness from which
way each slope faces the sun, warm where the light lands and cool in the shade, with fine grain on
top so grass reads as grass and freshly cut earth as wet soil. It is rendered at three pixels per
valley cell rather than one, and kept, because the ground only changes when somebody digs - which
also took the whole thing from ten frames a second to nearly forty on a machine with no GPU at all.

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

### Klokkijken (`clock.html`)
A clock on a schoolroom wall and nine levels in the order a school teaches them: whole hours, the
half hour, the quarters, five minutes at a time, setting the hands yourself, single minutes, finding
the face that matches a digital time, the twenty-four hour clock, and last the question a clock is
actually for - it is twenty past two and the bus goes in twenty-five minutes.

Three kinds of question, mixed: read the hands and pick the figures, drag the hands to a time given
in words, and pick which of four faces is the digital time on the card. The hands are geared
together the way a real clock's are, so moving the long one carries the short one along, and taking
it past twelve moves the hour.

The hour hand moves between the numbers. At half past three it is genuinely halfway to the four,
which is why Dutch says "half vier" and why children read it as four o'clock, and the wrong answers
on offer are that mistake and its cousins rather than random numbers: 4:30 beside 3:30, 10:25 beside
5:50 for a child reading the short hand as the long one, quarter past beside quarter to, and the
same hands read as the other half of the day once the twenty-four hour clock arrives.

Getting one wrong is not a loss and there is no way to fail. The hour hand lights up, the slice of
dial it is inside is shaded, the number it has left is circled, and the reading is spelled out in
words - "tien voor half vier · 3:20" - before the next question comes. The stars count what was read
right the first time, before the clock showed you. A switch in the corner puts the 5, 10, 15 ring on
the dial for a child still counting round in fives, and takes it off again.

The spoken layer is the point and it lives in `src/games/clock/dutchtime.ts`, a module with no
canvas in it: whole hours, the quarters, "half vier" for 3:30, "tien voor half vier" for 3:20, "vijf
over half vier" for 3:35, midnight and midday both called twelve. It is tested case by case in
`tests/run.mjs`, in Dutch and in English.
Practises reading the analogue and the digital clock, saying the time in Dutch, and counting on in
minutes. Age 6 and up.

### Dierenboek (`animals.html`)
Nine shelves - mammals, birds, fish and sharks, reptiles, amphibians, butterflies, insects, spiders
and sea creatures - and a couple of thousand real animals behind them, every one with a real
photograph. Pick a shelf, scroll the grid, tap one.

The page that opens is the point. It says the animal's name in Dutch, in English and in Latin. It
draws the animal beside a child, both on one ruler, so the length stops being a number: a red deer
comes up past your head, a ladybird is a dot that has to be blown up sixty times to be visible at
all and says so, a blue whale squashes the child to a sliver. The child on that ruler can be made
taller or shorter, because every child is a different size and the comparison is only worth
anything if it is yours. Then a drawn world map with the continents the animal has really been
recorded on lit up, what it eats, how it is doing, and two or three sentences the book writes
itself out of the data - which family it belongs to, where it lives, what it eats, how it measures
up against you - followed by a paragraph from Wikipedia in whichever language is set.

There is a keyboard a child can hunt and peck at: three or four letters is enough, accents and
capitals do not matter, and it searches the Dutch, the English and the scientific name at once.
And there is a button marked "Verras me" that opens an animal nobody chose - one you have not seen
yet, for as long as there are any left.

The book remembers which animals have been looked at and says so on the way in: *je hebt 37 van de
2000 dieren bekeken*. That is the only thing it keeps. No score, no streak, nothing to lose by
staying away, and the count only ever goes up.

None of it is typed by hand. `npm run animals` builds `public/animals/animals.json` out of four
open sources: iNaturalist for which species are worth having and what they are called in Dutch and
in English, Wikipedia for the paragraph and the lead photograph, Wikimedia Commons for who took
that photograph and under which licence, and GBIF for the continents. Body length, diet and habitat
are in none of them in a form you can read to a five year old, so those come from a table in
`scripts/animal-traits.mjs`, looked up species first and then up the family tree - and the page
says when a length is the family's typical one rather than this species' own. The data is cached in
the repository, so the book needs no network to know anything; only the photographs are fetched as
you go, with a drawn silhouette in their place while they come and instead of them if they do not.
Practises looking closely, comparing sizes, sorting into groups and looking something up. Age 4 and up.

## Stack
- Vite + TypeScript, Canvas 2D, multi-page build (one entry per game)
- Photographs only where they are real: NASA planets and moons, public domain fossils, and the
  animals in Dierenboek from Wikimedia Commons; everything else is drawn procedurally. Credits are
  shown in-game, beside the photograph. Licence rule: public domain, CC0, CC BY or CC BY-SA -
  never NC and never ND, and `scripts/animals.mjs` drops any photograph whose licence does not
  pass that test rather than shipping it. (CC BY-SA was let in when the animal book arrived: it
  is a free licence and a displayed, unaltered, credited photograph honours it, and holding to
  CC BY alone would have left three animals in four with no picture.)
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
