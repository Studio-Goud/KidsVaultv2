/**
 * Suri en het lichtje in de diepte - the second story journey, as data.
 *
 * The owner asked for the deep sea, space and the body to be stories as elaborate as the giant
 * tooth. This one has the same shape: a question at the start and its answer at the end. A camera
 * on a long cable sees a light blinking far down in the pitch dark, where no sunlight reaches. Who
 * makes light down there? You and Suri go down in a submarine to find out: past the reef and a sea
 * turtle, through a school of lanternfish in the twilight, after a sperm whale into the dark, and
 * with the lamps off at the bottom you find the light. It is the lure of an anglerfish.
 *
 * Every claim is meant to be true (rule 5): the zones and their depths are the usual ones
 * (sunlight to 200 m, twilight to 1000 m, midnight below), sperm whales do dive after squid and
 * stay down for up to an hour or more, deep water is about four degrees, marine snow is real, only
 * female anglerfish have a lure, and Melanocetus is about the size of a banana. `docs/claims.md`
 * lists them. The script is apart from the scenes for the same reasons as the tooth's: the tests
 * read it without a browser and `scripts/voice.mjs` finds every line in it for Ruth.
 */

import { nextPlaceIn, type Chapter as TaleChapter, type Place } from './tale';

export interface Chapter extends TaleChapter {
  id: 'boat' | 'reef' | 'twilight' | 'dark' | 'angler' | 'up';
}

/** How deep the submarine is in each chapter, in metres. */
export const DEPTH = { boat: 0, reef: 15, twilight: 500, dark: 1500, angler: 1500 } as const;

export type Zone = 'surface' | 'sunlight' | 'twilight' | 'midnight';

/**
 * The layers of the sea by how much sunlight reaches them. The boundaries are the ones oceanography
 * uses (NOAA's "ocean zones"): enough light for plants to 200 m, a dim blue to 1000 m, and below that
 * none at all.
 */
export function zoneAt(depth: number): Zone {
  if (depth < 1) return 'surface';
  if (depth < 200) return 'sunlight';
  if (depth < 1000) return 'twilight';
  return 'midnight';
}

export const ZONE_NAMES: Record<Zone, { en: string; nl: string }> = {
  surface: { en: 'at the surface', nl: 'aan de oppervlakte' },
  sunlight: { en: 'sunlight zone', nl: 'zonlichtzone' },
  twilight: { en: 'twilight zone', nl: 'schemerzone' },
  midnight: { en: 'midnight zone', nl: 'middernachtzone' },
};

export const CHAPTERS: Chapter[] = [
  {
    id: 'boat', title: 'At sea', titleNl: 'Op zee',
    steps: [
      { say: 'It is getting dark at sea. You and Suri are on a research ship.',
        sayNl: 'Het wordt al donker op zee. Suri en jij zijn op een onderzoeksschip.' },
      { say: 'A camera hangs from a long cable, very deep in the water. Look, on the screen.',
        sayNl: 'Aan een lange kabel hangt een camera, heel diep in het water. Kijk, op het scherm.' },
      { cue: 'screen' },
      { say: 'Something is blinking down there. A little light, in the pitch dark. Tap it.',
        sayNl: 'Daar knippert iets. Een lichtje, in het pikkedonker. Tik er eens op.' },
      { wait: 'spotted' },
      { say: 'No sunlight reaches that far down. So who is making light there?',
        sayNl: 'Zo diep komt geen zonlicht. Wie maakt daar dan licht?' },
      { say: 'We are going to see for ourselves. In the submarine.',
        sayNl: 'We gaan het zelf bekijken. Met de duikboot.' },
      { cue: 'submerge' },
      { wait: 'arrived' },
    ],
  },
  {
    id: 'reef', title: 'The coral reef', titleNl: 'Het koraalrif',
    steps: [
      { say: 'We are under water. The sun still shines here, and everything has colour.',
        sayNl: 'We zijn onder water. Hier schijnt de zon nog, en alles heeft kleur.' },
      { say: 'Look around you. Who is swimming there?',
        sayNl: 'Kijk eens om je heen. Wie zwemt daar rond?' },
      { wait: 'found' },
      { say: 'A sea turtle. Now and then he has to go up to breathe, just like you.',
        sayNl: 'Een zeeschildpad. Af en toe moet hij naar boven om adem te halen, net als jij.' },
      { say: 'The light was much deeper. Hold the button down, and we sink.',
        sayNl: 'Het lichtje zat veel dieper. Houd de knop ingedrukt, dan zakken we.' },
      { wait: 'deeper' },
    ],
  },
  {
    id: 'twilight', title: 'The twilight zone', titleNl: 'De schemerzone',
    steps: [
      { say: 'Five hundred metres down. It is dim here, like just after sunset.',
        sayNl: 'Vijfhonderd meter diep. Het is hier schemerig, zoals net na zonsondergang.' },
      { say: 'Do you see the fish with little lights? They are lanternfish. They make their own light.',
        sayNl: 'Zie je die visjes met lichtjes? Dat zijn lantaarnvissen. Ze maken zelf licht.' },
      { say: 'But the light on the screen was all on its own. Tap the fish, and they will swim aside.',
        sayNl: 'Maar het lichtje op het scherm was helemaal alleen. Tik op de vissen, dan gaan ze opzij.' },
      { wait: 'parted' },
      { cue: 'whale' },
      { say: 'What is that, behind them? Something very big. Look for it.',
        sayNl: 'Wat is dat daarachter? Iets heel groots. Zoek maar.' },
      { wait: 'found' },
      { say: 'A sperm whale. He dives down to catch squid, and can hold his breath for an hour.',
        sayNl: 'Een potvis. Hij duikt naar beneden om inktvissen te vangen, en kan wel een uur zijn adem inhouden.' },
      { say: 'Let us follow him. Hold the button down again.',
        sayNl: 'Laten we hem volgen. Houd de knop weer ingedrukt.' },
      { wait: 'deeper' },
    ],
  },
  {
    id: 'dark', title: 'The midnight zone', titleNl: 'De middernachtzone',
    steps: [
      { say: 'Fifteen hundred metres. Here it is always night. The whale has gone on, into the deep.',
        sayNl: 'Vijftienhonderd meter. Hier is het altijd nacht. De potvis is verder gezwommen, de diepte in.' },
      { say: 'The water here is only four degrees, as cold as the fridge.',
        sayNl: 'Het water is hier maar vier graden, zo koud als in de koelkast.' },
      { say: 'Switch the lamps on. Tap the lamp.',
        sayNl: 'Doe de lampen aan. Tik op de lamp.' },
      { wait: 'lamps' },
      { say: 'Do you see it snowing? That is sea snow: tiny crumbs drifting down from above.',
        sayNl: 'Zie je hoe het sneeuwt? Dat is zeesneeuw: kruimeltjes die van boven naar beneden dwarrelen.' },
      { say: 'Many animals down here make their own light, to find each other or to catch something.',
        sayNl: 'Veel dieren hier maken zelf licht, om elkaar te vinden of om iets te vangen.' },
      { say: 'Now switch the lamps off again. In the dark we will see the light better.',
        sayNl: 'Doe de lampen nu weer uit. In het donker zien we het lichtje beter.' },
      { wait: 'dark' },
    ],
  },
  {
    id: 'angler', title: 'The light', titleNl: 'Het lichtje',
    steps: [
      { say: 'Quiet now. Look around. Can you see a light blinking somewhere?',
        sayNl: 'Stil maar. Kijk eens om je heen. Zie je ergens een lichtje knipperen?' },
      { wait: 'found' },
      { say: 'There it is. Gently now. Switch the lamp on.',
        sayNl: 'Daar is het. Zachtjes nu. Doe de lamp aan.' },
      { wait: 'lamps' },
      { cue: 'reveal' },
      { say: 'An anglerfish. The light hangs from a little fishing rod on her head.',
        sayNl: 'Een hengelaarsvis. Het lichtje hangt aan een hengeltje op haar kop.' },
      { say: 'Small fish think it is something tasty. When they come close, she snaps them up.',
        sayNl: 'Kleine visjes denken dat het iets lekkers is. Komen ze dichtbij, dan hapt zij toe.' },
      { say: 'She is no bigger than a banana. Only the females have a light like this.',
        sayNl: 'Ze is niet groter dan een banaan. Alleen de vrouwtjes hebben zo’n lichtje.' },
      { say: 'So now we know where the light came from.',
        sayNl: 'Nu weten we waar het lichtje vandaan kwam.' },
    ],
  },
  {
    id: 'up', title: 'Back up', titleNl: 'Naar boven',
    steps: [
      { cue: 'ascend' },
      { say: 'Time to go back up. Hold on tight.',
        sayNl: 'Tijd om naar boven te gaan. Hou je goed vast.' },
      { say: 'Through the midnight zone, through the twilight, and back into the light.',
        sayNl: 'Door de middernachtzone, door de schemerzone, en weer het licht in.' },
      { wait: 'arrived' },
      { say: 'Up here the stars are out. And far below us, the little light is still blinking.',
        sayNl: 'Boven zijn de sterren al op. En diep onder ons knippert het lichtje nog steeds.' },
      { cue: 'end' },
      { say: 'The end. Shall we go again?',
        sayNl: 'Einde. Zullen we nog een keer gaan?' },
    ],
  },
];

export const ASIDES = {
  lookAround: { say: 'Turn round, or drag your finger across the screen.', sayNl: 'Draai je om, of veeg met je vinger over het scherm.' },
  holdOn: { say: 'Keep holding the button, then we keep sinking.', sayNl: 'Blijf de knop vasthouden, dan zakken we verder.' },
};

/** The step after this one in this story, running on into the next chapter; null at the very end. */
export const nextPlace = (p: Place): Place | null => nextPlaceIn(CHAPTERS, p);
