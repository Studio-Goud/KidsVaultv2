/**
 * Suri en het donker - the story about a feeling, as data.
 *
 * The other stories answer a question about the world: how does a body work, what lives in the deep.
 * This one is about a feeling. Suri is scared in the dark at bedtime, and the child helps him through
 * it: sits with him, looks at what made the shape on the wall (a coat), finds the creaking sound
 * (the wind at the window), breathes slowly with him, and picks a night light. It ends with the
 * feeling smaller, not gone, and a grown-up nearby.
 *
 * It is written so that it gives a feeling a name and shows what helps, and claims nothing beyond
 * that. It does not treat fear and does not say it will make fear go away. It never says "je hoeft
 * niet bang te zijn", because that tells a child the feeling is wrong; it says "bang zijn mag". The
 * shadow and the sound are shown as the ordinary things they are the moment the child looks, and
 * nothing is ever real that was frightening: no monster turns out to exist, nothing jumps out.
 *
 * What is said out loud, and why it is meant to be true (rule 5; for `docs/claims.md`):
 *   1. Being scared in the dark is common in young children. True: it is one of the most usual
 *      fears of the preschool years.
 *   2. A feeling has a name, and knowing the name makes it easier to talk about. The claim is about
 *      talking, not about the fear going away; it is how children and parents are usually helped
 *      to speak about feelings.
 *   3. A shadow always comes from something, and when you look at what makes it, it is an ordinary
 *      thing again (here: a coat on a chair). The scene shows this; it is not a claim about fear.
 *   4. Slow breathing feels calmer for many people. "Many", "feels", no more: it is not said to cure
 *      or treat anything. The timings (BREATH_IN, BREATH_OUT) are a product decision, slow enough
 *      for a small child and short enough to hold a finger on, not a measured prescription.
 *   5. A night light is fine. It is a household choice and the story says only that it is allowed.
 *   6. You can always call a grown-up. A promise the story makes on behalf of the parent, which is
 *      the reason the parent should play it once first.
 *   Also: "bang zijn mag, iedereen is weleens bang" is true of people of every age.
 *
 * The script lives apart from the scenes so the tests can read it without a browser and
 * `scripts/voice.mjs` finds every line.
 */

import { nextPlaceIn, type Chapter as TaleChapter, type Place } from './tale';

export interface Chapter extends TaleChapter {
  id: 'bedtijd' | 'schaduw' | 'geluid' | 'ademen' | 'lichtje' | 'slapen';
}

/** How many slow breaths there are to do: three, because a four-year-old can count to three. */
export const BREATHS = 3;

/**
 * Seconds the circle takes to grow and to shrink. A product decision, not research: a little slower
 * than a child breathes without thinking, with the out-breath longer than the in-breath, which is
 * the way slow breathing is usually taught. The circle is the metronome; the child is never timed.
 */
export const BREATH_IN = 3.5;
export const BREATH_OUT = 4.5;

/**
 * How much of the growing the finger has to be on the circle for the breath to count. Generous on
 * purpose: a child who lifts off a moment early has still breathed, and nothing here is a test.
 */
export const HOLD_SHARE = 0.6;

/** The three night lights a child can pick from, left to right, with the name said aloud. */
export const LIGHTS = [
  { id: 'geel', nl: 'geel', en: 'yellow', colour: '#ffcf5a' },
  { id: 'roze', nl: 'roze', en: 'pink', colour: '#ff9ec4' },
  { id: 'blauw', nl: 'blauw', en: 'blue', colour: '#7fc4ff' },
] as const;

export const CHAPTERS: Chapter[] = [
  {
    id: 'bedtijd', title: 'Bedtime', titleNl: 'Bedtijd',
    steps: [
      { say: 'It is bedtime. The light is off, and Suri is lying in bed.',
        sayNl: 'Het is bedtijd. Het licht is uit en Suri ligt in bed.' },
      { say: 'He has pulled the blanket up to his nose. He whispers: I feel scared. My tummy feels all tight.',
        sayNl: 'Hij trekt de deken tot aan zijn neus. Hij fluistert: Ik ben bang. Mijn buik voelt heel strak.' },
      { say: 'That feeling has a name. It is called being scared. When you know its name, it is easier to talk about.',
        sayNl: 'Dat gevoel heeft een naam. Het heet bang zijn. Als je de naam weet, kun je er makkelijker over praten.' },
      { say: 'Will you sit with him? Tap Suri.',
        sayNl: 'Ga je bij hem zitten? Tik op Suri.' },
      { wait: 'sat' },
      { cue: 'sit' },
      { say: 'Being scared is allowed. Everybody is scared sometimes.',
        sayNl: 'Bang zijn mag. Iedereen is weleens bang.' },
      { say: 'Lots of small children are scared in the dark. That is very ordinary.',
        sayNl: 'Veel kleine kinderen zijn bang in het donker. Dat is heel gewoon.' },
      { say: 'Thank you for sitting with me, says Suri. Shall we see what is in the room?',
        sayNl: 'Dank je wel dat je bij me zit, zegt Suri. Zullen we kijken wat er in de kamer is?' },
    ],
  },
  {
    id: 'schaduw', title: 'The shadow', titleNl: 'De schaduw',
    steps: [
      { say: 'Look. There is a big dark shape on the wall. What is that?',
        sayNl: 'Kijk. Er zit een grote donkere vlek op de muur. Wat is dat?' },
      { say: 'A shadow always comes from something. Let us find what makes it. Turn round, or drag your finger across the screen.',
        sayNl: 'Een schaduw komt altijd ergens vandaan. Laten we zoeken wat hem maakt. Draai je om, of veeg met je vinger over het scherm.' },
      { wait: 'found' },
      { say: 'There. A chair, with a coat hanging on it. Could that be what makes the shape?',
        sayNl: 'Daar. Een stoel, met een jas eraan. Zou dat de vlek maken?' },
      { say: 'Switch the lamp on, then we can see it properly. Tap the lamp.',
        sayNl: 'Doe het lampje aan, dan zien we het goed. Tik op het lampje.' },
      { wait: 'lamp' },
      { say: 'Look. The shape is just the shadow of a coat. You can see the sleeves.',
        sayNl: 'Kijk. De vlek is gewoon de schaduw van een jas. Je ziet de mouwen.' },
      { say: 'When you look at what makes a shadow, it is an ordinary coat again.',
        sayNl: 'Als je kijkt wat een schaduw maakt, is het weer gewoon een jas.' },
      { say: 'Suri breathes out. His tummy is already a little less tight.',
        sayNl: 'Suri ademt uit. Zijn buik is al een beetje minder strak.' },
      { say: 'The lamp goes off again, because it is bedtime.',
        sayNl: 'Het lampje gaat weer uit, want het is bedtijd.' },
      { cue: 'lampOff' },
    ],
  },
  {
    id: 'geluid', title: 'The sound', titleNl: 'Het geluid',
    steps: [
      { cue: 'creak' },
      { say: 'Shh. Listen. Creeeak. What is that sound?',
        sayNl: 'Sst. Luister. Kriiieeek. Wat is dat voor geluid?' },
      { say: 'Suri holds his blanket tight. Where does it come from? Look around.',
        sayNl: 'Suri houdt zijn deken stevig vast. Waar komt het vandaan? Kijk eens rond.' },
      { wait: 'found' },
      { say: 'There. The window is open a little bit. The wind pushes against it. That is the creaking.',
        sayNl: 'Daar. Het raam staat een stukje open. De wind duwt ertegenaan. Dat is het gekraak.' },
      { say: 'Shall we close the window? Drag it down.',
        sayNl: 'Zullen we het raam dicht doen? Sleep het naar beneden.' },
      { wait: 'closed' },
      { say: 'Quiet. It was only the wind.',
        sayNl: 'Stil. Het was maar de wind.' },
      { say: 'You found it, and you closed it. Suri’s tummy is still a bit tight, though. A scared feeling does not always go away at once.',
        sayNl: 'Jij hebt het gevonden en dichtgedaan. Maar Suri’s buik is nog een beetje strak. Een bang gevoel gaat niet altijd meteen weg.' },
    ],
  },
  {
    id: 'ademen', title: 'Breathing together', titleNl: 'Samen ademen',
    steps: [
      { say: 'Many people breathe slowly when they feel scared. Suri does it too. Breathe in... and out.',
        sayNl: 'Veel mensen ademen langzaam als ze bang zijn. Suri doet het ook. Adem in... en uit.' },
      { say: 'The circle grows and shrinks. Put your finger on it while it grows, and breathe in.',
        sayNl: 'De cirkel wordt groot en klein. Leg je vinger erop als hij groot wordt, en adem in.' },
      { say: 'Lift your finger while it shrinks, and breathe out. We do it three times.',
        sayNl: 'Haal je vinger weg als hij klein wordt, en adem uit. We doen het drie keer.' },
      { wait: 'breathed' },
      { say: 'Three slow breaths. Many people feel a little calmer after that.',
        sayNl: 'Drie rustige ademhalingen. Veel mensen voelen zich daar wat rustiger van.' },
      { say: 'Suri’s tummy feels softer now.',
        sayNl: 'Suri’s buik voelt nu zachter.' },
    ],
  },
  {
    id: 'lichtje', title: 'A small light', titleNl: 'Een lichtje',
    steps: [
      { say: 'Suri has one more idea. A small night light. A night light is fine.',
        sayNl: 'Suri heeft nog een idee. Een klein nachtlampje. Een nachtlampje mag gewoon.' },
      { say: 'Which one do you choose? Yellow, pink or blue. Tap the one you like.',
        sayNl: 'Welk lichtje kies jij? Geel, roze of blauw. Tik op het lichtje dat je mooi vindt.' },
      { wait: 'chosen' },
      { cue: 'glow' },
      { say: 'Look. The room is not dark any more. It is dim and cosy.',
        sayNl: 'Kijk. De kamer is niet meer donker. Het is zacht en gezellig.' },
      { say: 'You can see the bed, the chair and the window. All ordinary things.',
        sayNl: 'Je ziet het bed, de stoel en het raam. Allemaal gewone dingen.' },
    ],
  },
  {
    id: 'slapen', title: 'Sleep well', titleNl: 'Slaap lekker',
    steps: [
      { say: 'Suri lies down again. He says: The scared feeling is smaller now. It is not gone, and that is fine.',
        sayNl: 'Suri gaat weer liggen. Hij zegt: Het bange gevoel is kleiner geworden. Het is niet weg, en dat is goed.' },
      { say: 'Sometimes the feeling comes back. Then you can always call a grown-up. Mummy or daddy is nearby.',
        sayNl: 'Soms komt het gevoel terug. Dan mag je altijd papa of mama roepen. Ze zijn dichtbij.' },
      { say: 'Goodnight, Suri. Goodnight, you.',
        sayNl: 'Slaap lekker, Suri. Slaap lekker, jij.' },
      { cue: 'goodnight' },
      { pause: 3 },
      { cue: 'end' },
      { say: 'The end. Shall we go again?',
        sayNl: 'Einde. Zullen we nog een keer gaan?' },
    ],
  },
];

export const ASIDES = {
  lookAround: { say: 'Turn round, or drag your finger across the screen.', sayNl: 'Draai je om, of veeg met je vinger over het scherm.' },
  tapSuri: { say: 'Tap Suri, in the bed.', sayNl: 'Tik op Suri, in het bed.' },
  tapLamp: { say: 'Tap the lamp, the button at the bottom.', sayNl: 'Tik op het lampje, de knop onderaan.' },
  drag: { say: 'Put your finger on the window and drag it down.', sayNl: 'Zet je vinger op het raam en sleep het naar beneden.' },
  hold: { say: 'Put your finger on the circle while it grows.', sayNl: 'Leg je vinger op de cirkel als hij groot wordt.' },
  breathIn: { say: 'Breathe in...', sayNl: 'Adem in...' },
  breathOut: { say: '...and out.', sayNl: '...en uit.' },
  choose: { say: 'Tap a light: yellow, pink or blue.', sayNl: 'Tik op een lichtje: geel, roze of blauw.' },
};

/** The step after this one in this story, running on into the next chapter; null at the very end. */
export const nextPlace = (p: Place): Place | null => nextPlaceIn(CHAPTERS, p);
