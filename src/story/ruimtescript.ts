/**
 * Suri en de verloren satelliet - the space story journey, as data.
 *
 * The same shape as the tooth and the light: a question at the start and its answer at the end.
 * Stip, a small satellite, was sent to Saturn and stopped answering; its last photograph shows the
 * rings. You and Suri go and fetch him: up through the clouds in a rocket you start yourself, once
 * round the Earth past the space station, low over the Moon where the first footprints still are,
 * down on Mars to pick up a tube of rock with the robot arm, and between the ice of Saturn's rings,
 * steering with the phone, to Stip. Then home, glowing, under three parachutes, into the sea.
 *
 * Every claim is meant to be true (rule 5) and `docs/claims.md` lists them: the station flies about
 * 400 km up and goes round in about an hour and a half; the sky turns black above about a hundred
 * kilometres; Apollo 11 landed in 1969 and the footprints are still there because nothing on the
 * Moon blows them away; Mars is red with rust; Perseverance really did leave ten sealed tubes of
 * rock on the ground at Three Forks, and nobody has fetched them yet; Saturn's rings are ice from
 * grains of dust to chunks as big as a house; Saturn would float; a radio signal takes well over an
 * hour to get here from there. The one thing that is not true is how long it all takes, and the
 * story says so out loud at the end rather than pretend.
 *
 * The script lives apart from the scenes so the tests can read it without a browser and
 * `scripts/voice.mjs` finds every line in it for Ruth.
 */

import { nextPlaceIn, type Chapter as TaleChapter, type Place } from './tale';

export interface Chapter extends TaleChapter {
  id: 'pad' | 'orbit' | 'moon' | 'mars' | 'rings' | 'home';
}

/**
 * How high the rocket is at each moment of the launch, in kilometres. The clouds are the ones you
 * see from the ground (up to about 12 km), the sky is black from the edge of space (100 km, the
 * Kármán line) and the space station flies at about 400.
 */
export const HEIGHT = { clouds: 12, black: 100, booster: 70, orbit: 400 } as const;

/**
 * How high the rocket is after holding the button for a share of the climb (0..1). It starts slow
 * and ends fast, the way a real launch does: most of the height comes in the last part, when the
 * rocket is light and the air is thin. The shape is a product decision, not a trajectory.
 */
export const altitudeAt = (climb: number): number => HEIGHT.orbit * Math.pow(Math.max(0, Math.min(1, climb)), 2.1);

/** What the sky looks like at a height: the words under the chapter title during the launch. */
export function skyAt(km: number): 'ground' | 'clouds' | 'blue' | 'dark' | 'space' {
  if (km < 1) return 'ground';
  if (km < HEIGHT.clouds) return 'clouds';
  if (km < 40) return 'blue';
  if (km < HEIGHT.black) return 'dark';
  return 'space';
}

export const SKY_NAMES: Record<ReturnType<typeof skyAt>, { en: string; nl: string }> = {
  ground: { en: 'on the ground', nl: 'op de grond' },
  clouds: { en: 'through the clouds', nl: 'door de wolken' },
  blue: { en: 'above the clouds', nl: 'boven de wolken' },
  dark: { en: 'the sky goes dark', nl: 'de lucht wordt donker' },
  space: { en: 'in space', nl: 'in de ruimte' },
};

export const CHAPTERS: Chapter[] = [
  {
    id: 'pad', title: 'The launch pad', titleNl: 'Het lanceerplatform',
    steps: [
      { say: 'Early in the morning, at the launch pad. That tall thing there is our rocket.',
        sayNl: 'Het is vroeg in de ochtend, bij het lanceerplatform. Dat hoge ding daar is onze raket.' },
      { say: 'Suri has a problem. His little satellite, Stip, flew all the way to Saturn. And now he does not answer.',
        sayNl: 'Suri heeft een probleem. Zijn kleine satelliet, Stip, is helemaal naar Saturnus gevlogen. En nu antwoordt hij niet meer.' },
      { say: 'This is the last photo Stip sent. Where is he? Tap him.',
        sayNl: 'Dit is de laatste foto die Stip stuurde. Waar is hij? Tik hem aan.' },
      { cue: 'photo' },
      { wait: 'spotted' },
      { say: 'There, between the rings. We are going to fetch him. Get in.',
        sayNl: 'Daar, tussen de ringen. We gaan hem ophalen. Stap maar in.' },
      { cue: 'board' },
      { say: 'Hold the button down. Then the rocket starts, and up we go.',
        sayNl: 'Houd de knop ingedrukt. Dan start de raket, en gaan we omhoog.' },
      { wait: 'launched' },
    ],
  },
  {
    id: 'orbit', title: 'Round the Earth', titleNl: 'Rondom de aarde',
    steps: [
      { say: 'We are in space. Down there is the Earth. Look how thin the blue air is, like a skin.',
        sayNl: 'We zijn in de ruimte. Daar beneden is de aarde. Kijk hoe dun de blauwe lucht is, als een velletje.' },
      { say: 'Someone else is flying here too. Look around. Who is it?',
        sayNl: 'Hier vliegt nog iemand. Kijk eens om je heen. Wie is dat?' },
      { wait: 'found' },
      { say: 'The space station. Astronauts live there, four hundred kilometres up.',
        sayNl: 'Het ruimtestation. Daar wonen astronauten, vierhonderd kilometer hoog.' },
      { say: 'It goes round the Earth in an hour and a half. So they see the sun come up sixteen times a day.',
        sayNl: 'Het vliegt in anderhalf uur rond de aarde. Zo zien ze wel zestien keer per dag de zon opkomen.' },
      { say: 'On to the Moon. Hold the button, and we fly faster.',
        sayNl: 'Door naar de maan. Houd de knop vast, dan vliegen we sneller.' },
      { wait: 'boosted' },
    ],
  },
  {
    id: 'moon', title: 'The Moon', titleNl: 'De maan',
    steps: [
      { say: 'We are skimming low over the Moon. Grey dust, rocks, and holes everywhere. Those are craters.',
        sayNl: 'We scheren laag over de maan. Grijs stof, stenen, en overal kuilen. Dat zijn kraters.' },
      { say: 'There is no air here, and it never rains. Look, you can see the Earth in the sky.',
        sayNl: 'Hier is geen lucht, en het regent nooit. Kijk, je ziet de aarde aan de hemel.' },
      { cue: 'hover' },
      { say: 'Something is standing on the ground. Can you find it?',
        sayNl: 'Daar staat iets op de grond. Kun je het vinden?' },
      { wait: 'found' },
      { say: 'This is where the first people walked on the Moon, in 1969. They left this behind.',
        sayNl: 'Hier liepen in 1969 de eerste mensen op de maan. Dit hebben ze laten staan.' },
      { say: 'Their footprints are still here. Nothing blows them away.',
        sayNl: 'Hun voetstappen staan er nog steeds. Er is geen wind die ze wegblaast.' },
      { say: 'Next stop, Mars. Hold the button again.',
        sayNl: 'Volgende halte: Mars. Houd de knop weer vast.' },
      { wait: 'boosted' },
    ],
  },
  {
    id: 'mars', title: 'Mars', titleNl: 'Mars',
    steps: [
      { cue: 'land' },
      { wait: 'landed' },
      { say: 'We have landed on Mars. Everything is red here, because there is rust in the dust.',
        sayNl: 'We zijn geland op Mars. Alles is hier roestbruin, want er zit roest in het stof.' },
      { say: 'A robot left little tubes here, full of Mars stone. Look around. Do you see something shining?',
        sayNl: 'Een robot heeft hier buisjes neergelegd, vol met stenen van Mars. Kijk eens rond. Zie je iets glimmen?' },
      { wait: 'found' },
      { say: 'There is one. Grab it with the robot arm. Drag the claw to the tube.',
        sayNl: 'Daar ligt er een. Pak hem met de robotarm. Sleep de grijper naar het buisje.' },
      { wait: 'grabbed' },
      { say: 'Got it. In real life, ten of these tubes are waiting on Mars. Nobody has fetched them yet.',
        sayNl: 'Hebbes. In het echt liggen er tien van zulke buisjes op Mars te wachten. Nog niemand heeft ze opgehaald.' },
      { say: 'Now quickly on to Saturn. Hold the button.',
        sayNl: 'Nu snel door naar Saturnus. Houd de knop vast.' },
      { wait: 'boosted' },
    ],
  },
  {
    id: 'rings', title: 'The rings of Saturn', titleNl: 'De ringen van Saturnus',
    steps: [
      { say: 'Saturn. It is so big and so light that it would float, if you had a bath big enough.',
        sayNl: 'Saturnus. Hij is zo groot en zo licht, dat hij zou blijven drijven als je een bad had dat groot genoeg was.' },
      { say: 'The rings are made of ice. Tiny grains, and chunks as big as a house.',
        sayNl: 'De ringen zijn van ijs. Kleine korreltjes, en brokken zo groot als een huis.' },
      { say: 'Stip is in there somewhere. Tilt the phone to steer, or steer with your finger.',
        sayNl: 'Ergens daartussen zit Stip. Kantel de telefoon om te sturen, of stuur met je vinger.' },
      { cue: 'fly' },
      { wait: 'through' },
      { say: 'Look, a little light blinking. That is Stip. Steer towards him.',
        sayNl: 'Kijk, daar knippert een lichtje. Dat is Stip. Stuur maar naar hem toe.' },
      { wait: 'caught' },
      { say: 'We have him. His antenna had turned the wrong way, so nobody could hear him any more.',
        sayNl: 'We hebben hem. Zijn antenne was de verkeerde kant op gedraaid, daarom kon niemand hem meer horen.' },
      { say: 'From here a radio message takes more than an hour to reach the Earth. That is how far away we are.',
        sayNl: 'Een radiobericht doet er vanaf hier meer dan een uur over om de aarde te bereiken. Zo ver weg zijn we.' },
    ],
  },
  {
    id: 'home', title: 'Home', titleNl: 'Naar huis',
    steps: [
      { cue: 'homeward' },
      { say: 'Home now, with Stip and the stone from Mars. Look, there is the Earth again.',
        sayNl: 'Nu naar huis, met Stip en het steentje van Mars. Kijk, daar is de aarde weer.' },
      { cue: 'reentry' },
      { say: 'We are going through the air very fast. The outside glows hot, but inside we are safe.',
        sayNl: 'We gaan heel snel door de lucht. De buitenkant gloeit heet, maar binnen zijn we veilig.' },
      { wait: 'slowed' },
      { say: 'Now the parachutes. Tap the button.',
        sayNl: 'Nu de parachutes. Tik op de knop.' },
      { wait: 'chutes' },
      { say: 'Three big parachutes. Gently down, towards the sea.',
        sayNl: 'Drie grote parachutes. Rustig naar beneden, naar de zee.' },
      { wait: 'splashed' },
      { say: 'Splash. We are home. Stip is back, and the stone from Mars too.',
        sayNl: 'Plons. We zijn thuis. Stip is terug, en het steentje van Mars ook.' },
      { say: 'In real life a trip like this takes many years. Ours was a story.',
        sayNl: 'In het echt duurt zo’n reis heel veel jaren. De onze was een verhaal.' },
      { cue: 'end' },
      { say: 'The end. Shall we go again?',
        sayNl: 'Einde. Zullen we nog een keer gaan?' },
    ],
  },
];

export const ASIDES = {
  lookAround: { say: 'Turn round, or drag your finger across the screen.', sayNl: 'Draai je om, of veeg met je vinger over het scherm.' },
  holdOn: { say: 'Keep holding the button, then we keep going.', sayNl: 'Blijf de knop vasthouden, dan gaan we verder.' },
  bump: { say: 'Bump. That was a chunk of ice. Nothing broken.', sayNl: 'Boem. Dat was een brok ijs. Er is niets kapot.' },
};

/** The step after this one in this story, running on into the next chapter; null at the very end. */
export const nextPlace = (p: Place): Place | null => nextPlaceIn(CHAPTERS, p);
