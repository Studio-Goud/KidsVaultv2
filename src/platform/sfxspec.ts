/**
 * Every sound effect that may be played from a recording instead of being synthesised.
 *
 * Until 2026-09-23 every sound in Suri was made in code. The owner asked for real sound effects
 * from ElevenLabs, for every game, and this is the list: one row per effect, keyed `game.method`
 * after the sfx object it replaces. `scripts/sfx.mjs` reads the prompts and renders the files;
 * `src/platform/samples.ts` reads the rest and plays them. The synthesised version stays in the
 * code underneath and is what plays whenever a recording is missing or not yet decoded, so nothing
 * here can make a game go silent.
 *
 * Left out on purpose, and still synthesised: Klankhuis' chimes, count-in and drum, which are
 * notes on a clock and have to be exactly in tune and in time; the engines and hums that run
 * continuously and follow the game (Moonshot's engine, Stroomkring's motor, Cloudhopper's
 * aircraft); and anything that is a switch rather than a sound.
 *
 * The house sound, for every prompt: soft, warm, wooden and rounded, for small children - no harsh
 * buzzers, nothing that startles. A mistake is a shrug, never a punishment (see the comments in the
 * sfx files, which say the same thing about the synthesised versions).
 */

export interface SfxRow {
  /** what ElevenLabs is asked for */
  prompt: string;
  /** how long the generation is, in seconds (the API's floor is half a second) */
  secs: number;
  /** how much of it is played, from the first sound onwards; shorter than `secs` for taps */
  max: number;
  /** semitones higher per step, for an effect that climbs with a streak or a count */
  step?: number;
  /** the least time between two plays, in ms, for effects fired many times a second */
  gap?: number;
  /** relative loudness, 1 is the house level */
  gain?: number;
  /** a background that runs on its own and repeats, rather than a one-shot */
  loop?: boolean;
}

const SOFT = 'soft, warm, gentle, for a calm children\'s game, clean studio recording, no music, no voice';
const tap = (what = 'a small soft wooden tap, like a fingertip on a wooden toy'): SfxRow =>
  ({ prompt: `${what}, very short, ${SOFT}`, secs: 0.5, max: 0.18, gain: 0.7 });
const done = (what: string): SfxRow => ({ prompt: `${what}, ${SOFT}`, secs: 2.5, max: 2.5 });
const right = (what = 'a bright soft wooden marimba double note going up, a small happy success'): SfxRow =>
  ({ prompt: `${what}, ${SOFT}`, secs: 0.8, max: 0.7, step: 1 });
const wrong = (what = 'two soft low wooden knocks, a gentle shrug, not a buzzer, friendly'): SfxRow =>
  ({ prompt: `${what}, ${SOFT}`, secs: 0.6, max: 0.5, gain: 0.8 });

export const SFX: Record<string, SfxRow> = {
  // ---- Wereldatlas
  'atlas.tap': tap(),
  'atlas.lift': { prompt: `a small wooden puzzle piece being lifted off a wooden table, ${SOFT}`, secs: 0.5, max: 0.3 },
  'atlas.snap': { prompt: `a wooden jigsaw puzzle piece clicking neatly into place, satisfying, ${SOFT}`, secs: 0.6, max: 0.45, step: 1 },
  'atlas.miss': wrong(),
  'atlas.slide': { prompt: `a wooden puzzle piece sliding softly across a wooden table, ${SOFT}`, secs: 0.6, max: 0.5 },
  'atlas.flood': { prompt: `water gently rushing in over a low dyke and spreading out, a small wave, ${SOFT}`, secs: 2, max: 2 },
  'atlas.drain': { prompt: `water gently draining away and gurgling out, ${SOFT}`, secs: 1.5, max: 1.5 },
  'atlas.complete': done('a warm little celebration: soft wooden chimes rising, finishing a map puzzle'),

  // ---- Stroomkring
  'circuit.clunk': { prompt: `a small electronic component set down firmly on a wooden workbench, ${SOFT}`, secs: 0.5, max: 0.3 },
  'circuit.tap': tap(),
  'circuit.blocked': wrong('a soft muted plastic bump, cannot go there, gentle'),
  'circuit.click': { prompt: `a small toggle switch flicking over with a crisp click, ${SOFT}`, secs: 0.5, max: 0.15 },
  'circuit.draw': { prompt: `a tiny soft click of a wire being laid down, ${SOFT}`, secs: 0.5, max: 0.08, gap: 60, gain: 0.5, step: 0.3 },
  'circuit.glow': { prompt: `a small light bulb switching on with a soft warm electric hum rising, ${SOFT}`, secs: 1, max: 0.8 },
  'circuit.blow': { prompt: `a tiny fuse popping with a small soft snap and a fizz, not scary, ${SOFT}`, secs: 0.8, max: 0.6 },
  'circuit.crackle': { prompt: `a short soft electric crackle and sizzle along a wire, not scary, ${SOFT}`, secs: 0.8, max: 0.6, gain: 0.7 },
  'circuit.flat': { prompt: `a toy battery running down, a soft electric hum sliding down in pitch and stopping, ${SOFT}`, secs: 1.2, max: 1 },
  'circuit.solved': done('a cheerful soft electronic chime, a circuit working, a small success'),
  'circuit.hush': { prompt: `a soft whoosh of everything going quiet, ${SOFT}`, secs: 0.6, max: 0.4, gain: 0.6 },

  // ---- Klokkijken
  'clock.tick': { prompt: `a single small clock tick, ${SOFT}`, secs: 0.5, max: 0.06, gap: 45, gain: 0.5 },
  'clock.tock': { prompt: `a single deeper wooden clock tock, ${SOFT}`, secs: 0.5, max: 0.12, gain: 0.7 },
  'clock.tap': tap(),
  'clock.pick': tap('a soft wooden button being pressed, a gentle click'),
  'clock.right': right(),
  'clock.wrong': wrong(),
  'clock.complete': done('a soft small clock chiming the hour, warm and gentle, three chimes'),

  // ---- Opgraving
  'dig.brush': { prompt: `a soft bristle brush sweeping sand off a rock, one short stroke, ${SOFT}`, secs: 0.5, max: 0.2, gap: 90, gain: 0.6 },
  'dig.chisel': { prompt: `a small metal chisel tapping stone once, a light tink, ${SOFT}`, secs: 0.5, max: 0.15, gap: 120, gain: 0.7 },
  'dig.hammer': { prompt: `a small rock hammer knocking on stone once, a dull thud, ${SOFT}`, secs: 0.5, max: 0.2, gap: 150, gain: 0.8 },
  'dig.scribe': { prompt: `a fine metal pick scratching stone, one short scratch, ${SOFT}`, secs: 0.5, max: 0.12, gap: 70, gain: 0.5 },
  'dig.crack': { prompt: `an old dry bone cracking, a short crack, an oops moment but not gross, ${SOFT}`, secs: 0.6, max: 0.4 },
  'dig.uncover': { prompt: `a small magical twinkle, discovering a piece of fossil, ${SOFT}`, secs: 0.6, max: 0.5 },
  'dig.correct': right('a bright soft marimba arpeggio going up, right answer'),
  'dig.wrong': wrong(),
  'dig.complete': done('a warm triumphant little fanfare on soft marimba, a whole dinosaur skeleton found'),
  'dig.tired': { prompt: `a soft sleepy descending tone, the sun going down, ${SOFT}`, secs: 1, max: 0.8 },
  'dig.tap': tap(),

  // ---- Letterbos
  'letters.lift': { prompt: `a small wooden letter tile being picked up off a wooden rack, ${SOFT}`, secs: 0.5, max: 0.25 },
  'letters.land': { prompt: `a wooden letter tile set down neatly into a slot, a soft clack, ${SOFT}`, secs: 0.5, max: 0.25 },
  'letters.bounce': { prompt: `a wooden tile bouncing softly back, a gentle boing, ${SOFT}`, secs: 0.5, max: 0.4, gain: 0.8 },
  'letters.tap': tap(),
  'letters.word': right('a bright soft wooden three note rising chime, a word completed'),
  'letters.chop': { prompt: `a small wooden block being split in two with a soft chop, ${SOFT}`, secs: 0.5, max: 0.25 },
  'letters.complete': done('a warm little celebration of soft chimes and birdsong in a forest'),

  // ---- Marktdag
  'market.drop': { prompt: `a piece of fruit dropped softly into a wicker basket, ${SOFT}`, secs: 0.5, max: 0.3, step: 0.5 },
  'market.take': { prompt: `a piece of fruit lifted out of a wicker basket, ${SOFT}`, secs: 0.5, max: 0.3 },
  'market.bell': { prompt: `a small brass shop counter bell, one ding, ${SOFT}`, secs: 1, max: 0.9 },
  'market.coins': { prompt: `a few coins dropped into a hand, a soft jingle, ${SOFT}`, secs: 0.8, max: 0.6 },
  'market.happy': { prompt: `a short soft happy musical flourish, a satisfied customer, ${SOFT}`, secs: 0.8, max: 0.7 },
  'market.puzzled': { prompt: `a short soft questioning musical wobble, hmm, ${SOFT}`, secs: 0.6, max: 0.5 },
  'market.leaves': { prompt: `soft footsteps walking away on cobblestones, ${SOFT}`, secs: 1, max: 0.8, gain: 0.7 },
  'market.arrives': { prompt: `soft footsteps arriving on cobblestones and a tiny door chime, ${SOFT}`, secs: 1, max: 0.9, gain: 0.7 },
  'market.complete': done('a warm cheerful little market celebration, soft bells and chimes'),
  'market.fail': wrong('a soft descending two note wooden sound, never mind, gentle'),
  'market.tap': tap(),

  // ---- Watermolen
  'mill.dig': { prompt: `a small spade digging into wet soil once, ${SOFT}`, secs: 0.5, max: 0.25, gap: 80, gain: 0.7 },
  'mill.blocked': wrong('a soft thud of a spade hitting a stone, gentle'),
  'mill.creak': { prompt: `a slow wooden water wheel creaking once as it turns, ${SOFT}`, secs: 1, max: 0.9, gain: 0.6 },
  'mill.fieldFull': { prompt: `a soft happy water splash and a little rising chime, a field watered, ${SOFT}`, secs: 1, max: 0.9 },
  'mill.wheelDone': { prompt: `a wooden water mill turning happily with a warm chime, ${SOFT}`, secs: 1.5, max: 1.4 },
  'mill.flood': { prompt: `water spilling over and splashing too much, a small oops, ${SOFT}`, secs: 1.2, max: 1 },
  'mill.spring': { prompt: `a small spring of water bubbling up out of the ground, ${SOFT}`, secs: 1.2, max: 1 },
  'mill.complete': done('a warm celebration by a river, soft chimes and a happy splash'),
  'mill.dry': { prompt: `a soft dry sad descending tone, water drying up, gentle, ${SOFT}`, secs: 1, max: 0.8 },
  'mill.tap': tap(),

  // ---- Moonshot
  'moonshot.clunk': { prompt: `a metal rocket part clicking firmly onto another part, ${SOFT}`, secs: 0.5, max: 0.3 },
  'moonshot.tap': tap(),
  'moonshot.blocked': wrong('a soft muted metallic bump, it does not fit, gentle'),
  'moonshot.tick': { prompt: `a single soft countdown beep, ${SOFT}`, secs: 0.5, max: 0.15, gain: 0.6 },
  'moonshot.ignite': { prompt: `a toy rocket engine igniting with a warm rumbling whoosh, exciting but not loud, ${SOFT}`, secs: 2, max: 1.8 },
  'moonshot.stage': { prompt: `a rocket stage separating with a soft clunk and a puff of air, ${SOFT}`, secs: 0.8, max: 0.7 },
  'moonshot.burnout': { prompt: `a rocket engine sputtering out softly and going quiet, ${SOFT}`, secs: 1.2, max: 1 },
  'moonshot.land': { prompt: `a gentle soft landing thump and a small whoosh settling, ${SOFT}`, secs: 1, max: 0.9 },
  'moonshot.record': done('a bright triumphant little space fanfare with sparkles, a new record'),

  // ---- Nachtwacht
  'nightwatch.hold': { prompt: `a tiny soft twinkle of a star being touched, ${SOFT}`, secs: 0.5, max: 0.35, gain: 0.7 },
  'nightwatch.line': { prompt: `a soft glassy chime, a line drawn between two stars, ${SOFT}`, secs: 0.6, max: 0.5, step: 1 },
  'nightwatch.lock': { prompt: `a soft sparkling chime settling into place, ${SOFT}`, secs: 0.6, max: 0.5, step: 1 },
  'nightwatch.turn': { prompt: `a slow soft airy whoosh like the night sky turning, ${SOFT}`, secs: 1.5, max: 1.3, gain: 0.7 },
  'nightwatch.undo': { prompt: `a tiny soft reversed twinkle, taking something back, ${SOFT}`, secs: 0.5, max: 0.35, gain: 0.7 },
  'nightwatch.show': { prompt: `a soft shimmering reveal of stars lighting up, ${SOFT}`, secs: 1.2, max: 1 },
  'nightwatch.solved': done('a soft magical glockenspiel sparkle, a constellation completed'),
  'nightwatch.wrong': wrong('a soft falling glassy note, a gentle miss, not a buzzer'),
  'nightwatch.peek': { prompt: `a soft curious shimmer, taking a second look, ${SOFT}`, secs: 0.8, max: 0.6 },
  'nightwatch.tap': tap(),
  'nightwatch.complete': done('a dreamy warm celebration under the night sky, soft chimes'),

  // ---- Rekenrijk
  'numbers.bead': { prompt: `a wooden abacus bead sliding and clicking against the next one, ${SOFT}`, secs: 0.5, max: 0.15, gap: 50, gain: 0.7 },
  'numbers.lift': { prompt: `a small wooden block being picked up off a table, ${SOFT}`, secs: 0.5, max: 0.25 },
  'numbers.drop': { prompt: `an apple set down softly into a wooden crate, ${SOFT}`, secs: 0.5, max: 0.3, step: 0.5 },
  'numbers.hop': { prompt: `a small wooden peg hopping once along a board, a soft boop, ${SOFT}`, secs: 0.5, max: 0.2, step: 0.3, gap: 60 },
  'numbers.tenFull': { prompt: `a soft satisfying chime, a box of ten filled up, ${SOFT}`, secs: 0.8, max: 0.7 },
  'numbers.tap': tap(),
  'numbers.pick': tap('a soft wooden button being pressed, a gentle click'),
  'numbers.right': right(),
  'numbers.wrong': wrong(),
  'numbers.complete': done('a warm cheerful little celebration on soft marimba, sums finished'),

  // ---- Planetarium
  'orbit.pick': { prompt: `a soft airy space whoosh, a planet picked up, ${SOFT}`, secs: 0.5, max: 0.35 },
  'orbit.place': { prompt: `a soft glassy space chime, a planet placed in orbit, ${SOFT}`, secs: 0.6, max: 0.5, step: 1 },
  'orbit.wrong': wrong('a soft wobbly descending space tone, try again, gentle'),
  'orbit.roundDone': done('a soft shimmering cosmic celebration, all the planets in order'),
  'orbit.tab': tap('a soft click, turning a page'),
  'orbit.turn': { prompt: `a soft airy whoosh, turning to the next planet, ${SOFT}`, secs: 0.6, max: 0.5, gain: 0.7 },
  'orbit.moon': { prompt: `a tiny soft space twinkle, a moon appearing, ${SOFT}`, secs: 0.6, max: 0.5 },
  'orbit.tap': tap(),

  // ---- Stuifzwam
  'puffball.place': { prompt: `a soft squishy mushroom being set down on moss, ${SOFT}`, secs: 0.5, max: 0.3 },
  'puffball.tick': { prompt: `a tiny soft rising bloop of something swelling up, ${SOFT}`, secs: 0.5, max: 0.15, step: 1, gain: 0.6 },
  'puffball.pop': { prompt: `a soft puffball mushroom popping with a gentle poof of spores, funny, not loud, ${SOFT}`, secs: 0.8, max: 0.6 },
  'puffball.pot': { prompt: `a small clay pot breaking with a soft crack, ${SOFT}`, secs: 0.6, max: 0.5 },
  'puffball.pickup': { prompt: `a soft sparkly pickup chime, finding something good, ${SOFT}`, secs: 0.6, max: 0.5 },
  'puffball.knocked': { prompt: `a soft cartoon bonk and a little dizzy wobble, funny, ${SOFT}`, secs: 0.8, max: 0.6 },
  'puffball.mole': { prompt: `a little mole popping out of the ground with soft digging, cute, ${SOFT}`, secs: 0.8, max: 0.6 },
  'puffball.step': { prompt: `a tiny soft footstep on moss, ${SOFT}`, secs: 0.5, max: 0.12, gap: 90, gain: 0.5 },
  'puffball.tap': tap(),
  'puffball.blocked': wrong('a soft muted bump into a tree stump, gentle'),
  'puffball.complete': done('a warm happy forest celebration, soft chimes and birdsong'),
  'puffball.fail': wrong('a soft descending woodwind tone, oh well, gentle'),

  // ---- Klankhuis: only the interface, never the notes
  'rhythm.uiTap': tap('a small dry wooden knock, not a musical note'),
  'rhythm.cheer': right('a bright soft rising chime, well played'),
  'rhythm.nudge': wrong('two soft low wooden notes a step apart, a shrug'),
  'rhythm.fanfare': done('soft chimes running up a scale, a little celebration'),

  // ---- Getijdenpoel
  'tidepool.pick': { prompt: `a small wet sea creature picked up out of water, a soft drip, ${SOFT}`, secs: 0.5, max: 0.3 },
  'tidepool.right': { prompt: `a clean soft water plop into a rock pool, ${SOFT}`, secs: 0.5, max: 0.35, step: 1 },
  'tidepool.wrong': wrong('a soft dull splash, the wrong pool, gentle'),
  'tidepool.missed': { prompt: `a small wave washing up the shore softly, ${SOFT}`, secs: 1, max: 0.9, gain: 0.7 },
  'tidepool.switchRule': { prompt: `three soft rising bubbly chimes, something has changed, ${SOFT}`, secs: 1, max: 0.9 },
  'tidepool.shellLost': { prompt: `a small shell rolling away into the sea with a soft splash, ${SOFT}`, secs: 0.8, max: 0.6 },
  'tidepool.complete': done('a warm happy seaside celebration, soft chimes and gentle waves'),
  'tidepool.fail': wrong('a soft descending bubbly tone, the tide went out, gentle'),
  'tidepool.tap': tap(),

  // ---- everywhere: the front page, the round buttons, the parent screen, the Animal Book
  'ui.tap': tap(),
  'ui.open': { prompt: `a soft friendly pop with a tiny rising whoosh, opening something, ${SOFT}`, secs: 0.5, max: 0.35 },
  'ui.home': { prompt: `a soft warm descending two note wooden chime, going home, ${SOFT}`, secs: 0.6, max: 0.5 },
  'ui.back': { prompt: `a soft short reversed whoosh, going back one step, ${SOFT}`, secs: 0.5, max: 0.25, gain: 0.8 },
  'ui.toggle': { prompt: `a small soft switch click, like a light switch on a toy, ${SOFT}`, secs: 0.5, max: 0.12, gain: 0.8 },
  'ui.key': { prompt: `a single soft wooden keyboard key press, ${SOFT}`, secs: 0.5, max: 0.08, gap: 40, gain: 0.6 },
  'ui.page': { prompt: `a single page of a thick book being turned, soft paper, ${SOFT}`, secs: 0.6, max: 0.45 },
  'ui.surprise': { prompt: `a short magical sparkle and shimmer, a surprise, ${SOFT}`, secs: 0.8, max: 0.7 },
  'ui.stepper': { prompt: `a tiny soft ratchet click, one notch, ${SOFT}`, secs: 0.5, max: 0.1, gain: 0.7 },

  // ---- De grote reis: in a rocket from the sun to the edge
  'reis.go': { prompt: `a friendly rocket lifting off, a warm rumble rising into a whoosh, exciting but not loud, ${SOFT}`, secs: 2.5, max: 2.3 },
  'reis.arrive': { prompt: `a soft glassy space chime, arriving at a planet, ${SOFT}`, secs: 1, max: 0.9 },
  'reis.more': { prompt: `a soft curious twinkle, there is more to tell, ${SOFT}`, secs: 0.6, max: 0.5 },
  'reis.on': { prompt: `a rocket engine starting again with a soft whoosh, moving on, ${SOFT}`, secs: 1.2, max: 1 },
  'reis.index': tap('a soft click, opening a map'),
  'reis.done': done('a warm dreamy celebration in space, soft chimes, the journey is complete'),
  'reis.bed': { prompt: `a calm steady low hum of a spaceship travelling through space, gentle, seamless loop, ${SOFT}`, secs: 10, max: 10, loop: true, gain: 0.35 },

  // ---- De diepzee: in a submarine from the waves to the deepest place there is
  'diepzee.go': { prompt: `a small submarine hatch closing and diving under water with a splash and bubbles, ${SOFT}`, secs: 2.5, max: 2.3 },
  'diepzee.arrive': { prompt: `a soft submarine sonar ping under water, arriving somewhere, ${SOFT}`, secs: 1.2, max: 1.1 },
  'diepzee.more': { prompt: `a few soft bubbles rising, there is more to see, ${SOFT}`, secs: 0.6, max: 0.5 },
  'diepzee.on': { prompt: `a small submarine propeller starting again under water, soft bubbles, ${SOFT}`, secs: 1.2, max: 1 },
  'diepzee.index': tap('a soft click, opening a map'),
  'diepzee.done': done('a warm gentle celebration under the sea, soft chimes and bubbles'),
  'diepzee.bed': { prompt: `calm deep underwater ambience inside a small submarine, soft hum and distant bubbles, seamless loop, ${SOFT}`, secs: 10, max: 10, loop: true, gain: 0.35 },

  // ---- Cloudhopper
  'cloudhopper.landed': done('a soft airport chime, a plane landed safely'),
  'cloudhopper.touchdown': { prompt: `airplane tyres touching down on a runway with a soft chirp and a rumble, ${SOFT}`, secs: 1.2, max: 1 },
  'cloudhopper.pathStart': tap('a soft click, starting to draw a line'),
  'cloudhopper.pathLock': { prompt: `a soft confirming chime, a flight path set, ${SOFT}`, secs: 0.5, max: 0.35 },
  'cloudhopper.warn': { prompt: `a soft gentle two tone alert chime, attention please, not alarming, ${SOFT}`, secs: 0.8, max: 0.7 },
  'cloudhopper.goAround': { prompt: `a small airplane engine revving up and climbing away, ${SOFT}`, secs: 1.5, max: 1.3 },
  'cloudhopper.crash': { prompt: `a soft cartoon bump and a puff, two toy planes bumping, not scary, ${SOFT}`, secs: 0.8, max: 0.7 },
  'cloudhopper.tap': tap(),
  'cloudhopper.coin': { prompt: `a soft bright coin pickup chime, ${SOFT}`, secs: 0.5, max: 0.35, step: 1 },
  'cloudhopper.fanfare': done('a bright cheerful little aviation fanfare, a level completed'),
};
