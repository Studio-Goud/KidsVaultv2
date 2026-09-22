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

## The platform under the games

`src/platform/` holds the things that were about to be built six times over.

**`coach.ts` - the game shows itself off.** A child who cannot read yet learns what a game is by
watching someone do it once. A game hands the coach a short script - point here, a hand taps, now
you try - and it dims everything except the one place that matters, draws a hand doing the gesture,
waits for the child to copy it, and gets out of the way. There is nothing to read and nothing to
dismiss. It runs once per game, ever, and it comes back only when a child is plainly stuck: three
wrong answers in a row, or nine seconds of nothing at all. Help that arrives when you are not stuck
is noise.

**`skill.ts` - how hard the next thing should be.** Every game used to own a ladder of nine levels,
hand-cut, with nothing at the top. That is right for a valley of water and wrong for the things a
child gets steadily better at. So a game stops deciding how hard to be and says instead what it
asked and how it went - right or wrong, how long it took against how long it ought to take, how
much help was taken, how many goes. Out of that comes one number per skill for how firm the ground
is, and one number back for how hard to make the next question, which each game turns into its own
knobs: how many things on screen, how fast, how much to hold in mind, how many steps, how near the
wrong answers sit.

Two rules it is built on. It aims for about four right out of five, because much more than that is
a chore and much less is a wall. And a wrong answer is never a reason to go back to the beginning -
it is a reason to put a smaller step in between. It never decides what a child *is*: there is no
clever and no slow in it. The only question it answers is what to ask next.

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

### Stroomkring (`circuit.html`)
A workbench with a grid on it and fourteen real parts on the shelf: batterij, draad, lampje,
schakelaar, drukknop, motor, zoemer, weerstand, led, zekering, zonnecel, condensator, relais and a
krokodillenklem. You drag the parts onto the board and draw the wire between them with your finger,
one cell at a time. Two lines of wire lying side by side do not touch, because the line was never
drawn between them - which is the only reason a circuit can be run back past itself without
shorting out.

The physics is real and lives in one pure module. Every terminal becomes a node, every part becomes
an edge between nodes, and the whole board is solved forty times a second by nodal analysis: G·V =
I, Gaussian elimination, one pass per diode and relay until their states stop changing. Nothing is
scripted. A bulb is twelve ohms of glowing wire and its brightness is the power the sum gives it,
so two bulbs in series share one current of 0.18 A and each get a quarter of their power, while two
in parallel each get 0.34 A and burn at nine tenths - and the battery pays for both, which it
visibly does: the same cell that runs one bulb for three minutes runs the parallel pair for about
ninety seconds. Every source has a resistance inside it, which is why a wire laid straight across
the battery draws about eight amps rather than infinity, why the wire glows, why the fuse has
something to melt at, and why the cell is empty in seven seconds. The LED swallows 1.8 V before it
passes anything and passes nothing at all backwards. The motor turns the other way round when you
turn it round. The relay is a coil that pulls a switch shut, so a circuit with one battery in it
can turn on a circuit with another.

Nothing ever just fails. One line under the board names what is wrong and a ring on the board points
at the part it is in: *hier zit een gat in de kring*, *deze schakelaar staat uit*, *de led zit
achterstevoren*, *dit is kortsluiting*, *de zekering is doorgeslagen*, *de batterij is leeg*. The
open switch and the backwards LED are worked out by trying it - close every switch and solve it
again, turn the LED round and solve it again - so the game only says so when that really would have
fixed it.

Nine puzzles and an open bench, and none of them is a gate: the bench can be opened from the list at
any time, and what is built on it is still there tomorrow. Light the bulb. Put a switch in. Two
bulbs, both lit. Two bulbs, and one may go out while the other stays on. A motor that runs both
ways. A doorbell that only buzzes while the button is held. A fuse that saves the circuit from a
short you make on purpose. An LED that only lights one way round. A relay: a small circuit
switching a big one.
Practises cause and effect, reading a circuit, series against parallel, and finding your own
mistake. Age 6 and up.

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
and sea creatures - and three thousand seven hundred real animals behind them, every one with a
real photograph. Pick a shelf, scroll the grid, tap one.

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
capitals do not matter, there is a space bar and a backspace, and it searches the Dutch, the
English and the scientific name at once. Forgetting the space is forgiven too - "blauwevinvis"
finds the blauwe vinvis. And there is a button marked "Verras me" that opens an animal nobody
chose - one you have not seen yet, for as long as there are any left.

The book remembers which animals have been looked at and shows it where you are looking. A card you
have opened turns green - the card, its edge, its name - with a filled green tick in the corner, so
a shelf you have worked through reads as green at a glance and the ones you have not seen stand out
white. The shelf tiles count it too (*2 van de 439 bekeken*, with a bar along the foot), and so
does the line on the way in: *je hebt 37 van de 3744 dieren bekeken*. That is the only thing it keeps. No score, no streak, nothing to lose by
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

### Klankhuis (`rhythm.html`)
The instrument comes first. What opens is nine chime bars you can hit - a C major scale from the G
below middle C up to the A above it - and nothing else asks anything of you. Each bar is a real
pitch in equal temperament, each is coloured the way real chime bars are (C red, D orange, E
yellow, and so on round to B), and the low ones are drawn long and the high ones short, because on
a xylophone the pitch *is* the length of the bar.

The sound is built rather than played back, like everything else here, but this game is its sound
so it is built properly. A note is five oscillators, not one: the fundamental, the octave, and
three partials above it that are not whole multiples - the fifth sits at five and a half times the
fundamental, which is what metal does and a harmonic series does not. Each partial has its own
decay, and the high ones die first, so a struck bar starts bright and ends warm. In front of it is
a few milliseconds of filtered noise with no pitch in it at all, which is the mallet, and under it
a second fundamental five cents away, because two bars of metal are never in perfect tune with
each other and that slow beating is most of what "warm" means. Behind all of it is a room: a
convolution reverb whose impulse response is a decaying burst of noise, generated at startup.
There are four instruments - klokkenspel, houten blokjes, fluit and harp - and the difference
between them is where the partials sit and how fast each one dies, not a filter sweep.

Every note is scheduled against `AudioContext.currentTime` at an absolute moment, a quarter of a
second before it sounds, and the drawing is worked out from that same clock: the ball on the screen
and the beat in the ear are the same number. Nothing is timed with `setTimeout` and nothing hangs
off a frame. A tap is judged against when the child *heard* the beat, so the output latency comes
off before anything is compared - sixty milliseconds either side is on the beat, two hundred is
where a tap stops belonging to that beat at all. None of that appears on screen as a number: it is
a ring that tightens.

Nine levels. Klap mee, a ball that falls and bounces on the beat so you can see it coming. Lang en
kort, half notes against quarter notes, drawn as long and short blocks before you hear them. Maat
van vier, where the count starts again, with the one drawn bigger and leant on - and halfway
through the level it stops asking for every beat and asks only for the one. Drie tellen, the same
thing in three, so that "the beat" stops meaning "four". Echo, where the game plays a phrase and
you play it back on the chimes. Hoog en laag: was the second note higher or lower, and then, on a
drawn ladder of pitches, how much higher. Het liedje, a song a Dutch child already knows with notes
taken out of it - Vader Jacob, Altijd is Kortjakje ziek and In de maneschijn, all three written in
the key that fits the chimes with no note moved an octave to make it fit. Samen, a drum you keep
going while a tune plays over the top. And Zelf maken.

Zelf maken is the point of the whole thing and it is never locked: there is a button to it on the
opening screen, because a child who has to earn eight levels before being allowed to make anything
will never make anything. It is a grid of nine pitches by eight beats. Tap the squares, press
spelen, and it loops; the column the loop is on lights up as it passes. A button changes the
instrument, another the tempo. It saves itself the moment a square changes, so it is still there
tomorrow - and it is read back out of the save sanitised rather than trusted, so a half-written or
hand-edited save opens as an empty grid instead of stopping the game.

Getting something wrong is never a dead end. A tap that was late leaves a ring where it landed with
a dashed line back to the beat it belonged to, and then that one bar - not the whole pattern -
plays again at half speed with the beats lit. In the ear levels a wrong chime is answered by the
right one three tenths of a second later, long enough to be two sounds and short enough to be one
thought, and then the game moves on. Listening to a phrase again is free and always offered. The
stars count only what went right the first time, before any of that happened.

The music itself lives in `src/games/rhythm/music.ts`, a module with no canvas and no browser in
it: note names to frequencies in equal temperament from A4 = 440 Hz, note values against a tempo,
the beats of a bar in 2/4, 3/4 and 4/4 and which of them are leant on, the three tunes as note
lists, how close a tap was, and the sequencer's save format. It is tested case by case in
`tests/run.mjs`, including that every stored tune really does fit the nine bars the instrument has.
Practises keeping a beat, long against short, hearing high from low, playing a phrase back, doing
two things at once, and writing something down and hearing it again. Age 4 and up.

### Rekenrijk (`numbers.html`)
Market Day counts to about ten and stops. This is the ladder after that, and the rule the whole
thing is built on is that every sum is something you can see and move. There is no screen in this
game where a row of symbols sits with an empty box at the end and nothing else to go on: seven is
seven beads on a rack, eight plus five is eight apples in a ten-frame and five waiting beside it,
thirty plus forty is three rods and four, twenty-seven plus eight is a peg standing on a number
line. The child does the sum by moving the things, and the written sum underneath fills itself in
while they do it - so the figures end up as a description of something they have already done
rather than a code to be broken.

The answers do not appear until the things have been moved. That is deliberate and it is the
difference between this and a worksheet with a picture beside it: the crate has to be pushed, the
frame has to be filled, the peg has to be walked to the next ten. Only then do four numerals come
up to be chosen between.

Nine levels, in the order a Dutch school teaches them: splitsen tot 10 on a bead rack with a
divider you slide, erbij with two crates that slide together, eraf with apples taken out one at a
time, de tien vol on a ten-frame, tientallen as rods and cubes with a number line saying the same
thing underneath, over het tiental as two jumps drawn on the line, verschil as one walk from here
to there, keersommen as an array you build by dragging the corner of the crate, and last the
tafels of 3, 4, 6, 7, 8 and 9.

The step over the ten is shown, not skipped. 8 + 5 fills the frame to ten first and then counts on
the three; 27 + 8 jumps to thirty and then the rest. Both are written out as two lines, and both
lines fill in as the objects move, because "rijgen over het tiental" is the strategy the school
teaches and a game that jumps straight to the answer teaches a child to guess instead.

Getting one wrong is not a loss and there is no way to fail. The objects rearrange themselves and
count the right answer out in front of you - the frame fills, the apples number themselves one to
seventeen, the second jump draws itself on the line - the sum is written and said in words
("achtentwintig plus acht is zesendertig"), and then you tap on. The stars count what was worked
out first time, before the apples showed you. Nothing locks.

The wrong answers on offer are the mistakes children actually make, and never a random number.
Beside 27 + 8 = 35 sits 25, because a child who adds seven and eight, gets fifteen and writes down
the five keeps the two and loses the carry; and 215, because a child who adds the tens and the
units separately and writes them side by side gets exactly that - and the number line, which stops
at a hundred, is the answer to it. Beside 8 + 5 sits 10, which is stopping at the ten this level
just taught, and 3, which is dropping it. Beside 6 x 7 sit 35, 49 and 36: the fact above, the fact
below, and the same fact in the table next door.

All of that lives in `src/games/numbers/model.ts`, which has no canvas in it. Every level's rule is
written once in `inRule`, and the tests hold every generator to it rather than to a comment. The
words - "vierentwintig", "tweeentwintig" with its diaeresis, "vier keer zes is vierentwintig" -
are in `numberwords.ts` beside it, tested in Dutch and in English.

A switch in the corner puts a number on every object on the table, for a child still counting one
by one, and takes it off again. On the last level there is a bar marked "hoe snel" that empties
while you think: nothing happens when it runs out and no star is lost, but three quick answers in a
row fade the apples down to outlines, so a child who has learnt the table stops being handed it.
Practises splitting to ten, adding and taking away, crossing the ten, tens and ones, difference,
and the tables. Age 5 and up.

### Wereldatlas (`atlas.html`)
A drawn map and pieces you drag onto it. Pick up Friesland, drop it where Friesland is and it
clicks home; drop it on Drenthe and it springs back, Friesland lights up where it really was, and
a line appears that is worth knowing. Nine levels, working outward from where a Dutch child is
standing: the twelve provinces, the water, the cities, the neighbours, Europe by shape, the
European capitals, the continents and oceans, the countries of the world, and the flags.

The piece is carried at the map's own scale. The moment it leaves the tray it is exactly as big as
the hole it is going into, so a child can see Zeeland fit rather than guess. A piece is dragged by
its own middle - a point worked out to sit as far inside the shape as the shape allows, because
the middle-of-the-area of Norway lands in Sweden - so where the finger is *is* where the piece is,
and a drop can simply ask whether that point is inside the place it belongs.

A drop finds the *nearest* thing the level deals in rather than the first. Arnhem and Nijmegen are
fifteen kilometres apart and within a fingertip of each other on a phone; the Rijn and the Waal run
side by side across the middle of the country. Asking which is nearer answers both the way a
teacher would, and hands the correction its own words for free: *dat is Nijmegen, Arnhem ligt hier*,
with the fact underneath. Then the piece flies home by itself, so nobody is ever stuck on a shape
they do not know. The stars count only what went home first time, before the map showed you.

The water level has a third button in the corner: a drawn dyke with the sea against it. Press it
and the Netherlands is redrawn by height - the deep polders six metres down, the peat behind the
dunes, the sandy east, the Veluwe, the hills of south Limburg - with every band lower than the
water outside turned blue. With the dykes off and an ordinary sea, a quarter of the country is
already under. Press it again for a storm surge of five metres, which is roughly what stood
against the dykes in 1953, and the west goes. Press it once more and the dykes come back.

On a continent or a country the card offers **welke dieren wonen hier?**, and that opens the animal
book filtered to that part of the world - `animals.html#af` is Africa. The animal data already
carries a continent per species, so the two are the same shelf seen from two sides.

Nothing is fetched and nothing is a photograph. The outlines are longitude and latitude in
`src/games/atlas/geo.ts`, simplified to about ten kilometres of detail and drawn as canvas paths,
which is what lets the same Germany appear on a map of the neighbours, a map of Europe and a map of
the world without being redrawn. The continents come out of the animal book's own `worldmap.ts`,
so there are not two different Africas in Bramblewood. The flags are written down rather than
photographed - bands, a cross, a disc - and only the flags that description can tell the truth
about are in the game, because a drawn approximation of a coat of arms is a wrong flag rather than
a simple one. A cross knows which cross it is: the Nordic ones stand off to the hoist and reach
every edge, and the Swiss one is square with its arms stopping short, six parts wide and twenty
across a flag of thirty-two, which is what its own law says.

What is simplified is the coastline. What is not is the naming: twelve provinces with their
capitals, twenty-two Dutch cities, ten rivers and seas and the works that hold them back,
thirty-nine European countries each with its real capital, seven continents, five oceans and
forty-one countries of the world. Bern, not Zurich. Ankara, not Istanbul. Den Haag is where the
government sits and Amsterdam is the capital, and the game says so.

Luxembourg on a map of Europe that fits a phone is four pixels across. It stays on the board and in
the data - a real country, a real capital, three real languages - but it is never dealt out as a
piece there, because nobody could hit it. On the map of the neighbours, zoomed right in on the
Netherlands, it is big enough and it is dealt out. Every level works that way, and every board has
its own number, measured in what it comes to on the narrowest phone: a country has to be twelve
degrees across before the world level will hand it over, which on a 320 pixel screen is ten
pixels. Kenya, between Ethiopia and Congo, is a real country with a real capital and a real fact,
and it is not something a child can be asked to hit with a finger on a map of the whole earth - so
the level that says "the big ones" on its own card deals the big ones.

A switch in the corner outlines the empty places for a child still finding the holes, and takes
the outlines away again for a child who should know. It is there only on the levels where there is
something for it to outline: on the water, the capitals and the flags, the places a piece can go
are the rivers and the countries the board has already drawn, and a button that does nothing when
a child presses it is worse than no button at all.
Practises where things are, reading a map, and the Netherlands, Europe and the world. Age 5 and up.

### Letterbos (`letters.html`)
A picture of a moon. The game says *maan* out loud, then says it again in pieces - /m/ /aa/ /n/ -
and the letters lie on a rack underneath. The word gets built by dragging them into the boxes.
Nothing here is multiple choice: picking the right picture out of four proves nothing about
reading, and putting the sounds back together in order is the thing a child actually has to learn
to do.

Nine levels, in the order a Dutch school teaches them: three letters and a short vowel (*bus*,
*kat*, *vis*, *zon*); the doubled vowel (*maan*, *boom*, *vuur*), where the rack offers the `aa`
as one tile and a single `a` beside it, because that mistake is the lesson; the two-letter sounds
*ui*, *oe*, *eu*, *ie* and *eeuw*; *ei* against *ij*; *au* against *ou*; consonants stacked up
(*schaap*, *straat*, *angst*, *herfst*); chopping a written word back into its sounds by tapping
where it falls apart; a word ladder where exactly one sound changes at a time - *boom*, *boot*,
*poot*, *pot*, *pet*, *pen*; and last, four-word sentences with a drawn scene that says the same
thing without words. A hundred and forty-one words, each with its own drawing, and ten scenes.
Nothing is fetched and nothing is a photograph.

The sounds are sounds, not letter names. /m/ is "mmm" and never "em", because "em-aa-en" never
becomes *maan*. That table is `src/games/letters/phonics.ts`, a module with no canvas in it: the
consonants that can be held are written held, the ones that cannot get the smallest vowel Dutch
has ("puh", "buh") because /p/ on its own is a puff of air and then silence, and the short vowels
are written the only way Dutch ever writes them alone - ah, eh, ih, oh, uh, the interjections.
Every reading method makes those same two compromises; this one writes them down rather than
hiding them. The breakdowns in the word list are not typed out by hand either: the same module
cuts each word up, longest spelling first, which is what gets *schaap* to s-ch-aa-p, *leeuw* to
l-eeuw and *angst* to a-ng-s-t. It is tested case by case, in Dutch.

Two spellings, one sound, three times over: *ei* and *ij*, *au* and *ou*, and *g* and *ch*. They
share a sound in that table on purpose, so the game can say the true thing - they sound exactly
the same, and only the word itself says which it is - instead of inventing a rule. Get one wrong
and the word is written out underneath with the right spelling in red and named the way a school
names it: de lange ij, de korte ei.

A wrong tile is never a dead end. It springs back, the box it does belong in glows, the sound that
box wants is said again slowly and then borrowed from a word a child knows ("de aa van maan"), and
the second time the game lifts the right tile into place itself and reads the whole word out. The
stars count only the words that were built with no help at all, so nothing is lost by needing it.

Two things on a tile are teaching rather than decoration. The vowels are warm and the consonants
are cool, the way Dutch methods mark the klinkers apart from the medeklinkers, because a word is a
run of consonants around a vowel and seeing that shape is most of the way to reading it. And a
tile with two letters on it carries a tie underneath them - the stroke a teacher draws under *aa*
to say "these two are one sound". A switch in the corner writes the word above the boxes for a
child who still wants to copy it, and takes it away again.

The voice is the browser's own, with a Dutch one picked at startup. If the machine has no Dutch
voice, nothing waits and nothing breaks: the pictures, the tiles, the glowing box and the wooden
knocks carry the whole game in silence.
Practises hearing the separate sounds in a word, putting them back together into the word, the
two-letter sounds, the ei/ij and au/ou traps, and reading a short sentence. Age 5 and up.

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
