/**
 * Suri en de reuzentand - the story, as data.
 *
 * The owner found the discovery journeys dated: a dot sliding down a line past pictures in a
 * circle, with the child only watching. He asked for a real story and a real journey, as immersive
 * as a phone can make it, and interactive. So this is a story with a question at the start and the
 * answer at the end: Suri digs up an enormous tooth in the garden, and the two of you go back in
 * time to find out whose it was. Every scene is a world you stand in and look around, and in every
 * scene the child does the thing that moves the story on.
 *
 * The script is kept apart from the drawing for three reasons: `npm test` can check it without a
 * browser, `scripts/voice.mjs` finds every line here as a literal and Ruth records it, and a change
 * to the words never touches the scenes.
 *
 * A step is one of: a line Ruth says (the story waits until she has finished), a wait for the child
 * to do something the scene knows about, a cue the scene acts on, or a short pause. There is no step
 * that times out and no step that can be failed. The one moment of tension - keeping still while
 * the T. rex goes by - ends the same way whatever the child does (rule 2 in CLAUDE.md).
 */

import type { Chapter as TaleChapter, Place } from './tale';
import { nextPlaceIn } from './tale';
export { readSeconds } from './tale';
export type { Step, Place } from './tale';

export interface Chapter extends TaleChapter {
  id: 'garden' | 'drill' | 'ice' | 'sea' | 'forest' | 'trex' | 'home';
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'garden', title: 'In the garden', titleNl: 'In de tuin',
    steps: [
      { say: 'In Grandpa’s shed, Suri found an old box full of sand. There is something in it.',
        sayNl: 'In de schuur van opa vond Suri een oude kist vol zand. Er zit iets in.' },
      { say: 'Help him. Brush the sand away with your finger.',
        sayNl: 'Help je mee? Veeg het zand weg met je vinger.' },
      { wait: 'dug' },
      { cue: 'shine' },
      { say: 'A tooth. A huge tooth, longer than your hand.',
        sayNl: 'Een tand. Een enorme tand, langer dan je hand.' },
      { say: 'There is no label with it. It is not a dog tooth, and not a cow tooth either. Whose could it be?',
        sayNl: 'Er zit geen kaartje bij. Het is geen hondentand, en ook geen koeientand. Van wie zou hij zijn?' },
      { say: 'Suri has an idea. We are going to find out, with the time drill.',
        sayNl: 'Suri heeft een idee. We gaan het uitzoeken, met de tijdboor.' },
    ],
  },
  {
    id: 'drill', title: 'The time drill', titleNl: 'De tijdboor',
    steps: [
      { say: 'The deeper we drill, the further back in time we go. Pull the handle down.',
        sayNl: 'Hoe dieper we boren, hoe verder we teruggaan in de tijd. Trek de hendel naar beneden.' },
      { wait: 'lever' },
      { cue: 'descend' },
      { say: 'Down we go. Every layer of ground is older than the one above it.',
        sayNl: 'Daar gaan we. Elke laag grond is ouder dan de laag erboven.' },
      { say: 'A thousand years. Ten thousand. Twenty thousand years ago.',
        sayNl: 'Duizend jaar. Tienduizend. Twintigduizend jaar geleden.' },
      { wait: 'arrived' },
    ],
  },
  {
    id: 'ice', title: 'The ice age', titleNl: 'De ijstijd',
    steps: [
      { say: 'Brr. This is the ice age. Where the North Sea is now, there is only snow.',
        sayNl: 'Brr. Dit is de ijstijd. Waar nu de Noordzee is, ligt alleen maar sneeuw.' },
      { say: 'Look around you. Can you find who lives here?',
        sayNl: 'Kijk eens om je heen. Zie jij wie hier woont?' },
      { wait: 'found' },
      { say: 'A mammoth. Hold the tooth up to him. Drag it to his mouth.',
        sayNl: 'Een mammoet. Houd de tand eens bij hem. Sleep hem naar zijn mond.' },
      { wait: 'compared' },
      { say: 'No, that does not fit. A mammoth has big flat teeth, for grinding grass.',
        sayNl: 'Nee, die past niet. Een mammoet heeft grote platte kiezen, om gras te malen.' },
      { say: 'Our tooth is sharp and pointed. We have to go further back.',
        sayNl: 'Onze tand is scherp en puntig. We moeten verder terug.' },
    ],
  },
  {
    id: 'sea', title: 'The chalk sea', titleNl: 'De krijtzee',
    steps: [
      { say: 'Sixty-eight million years ago. Where Limburg is now, there was a warm sea.',
        sayNl: 'Achtenzestig miljoen jaar geleden. Waar nu Limburg ligt, was toen een warme zee.' },
      { say: 'Something big is swimming around us. Look for it.',
        sayNl: 'Er zwemt iets groots om ons heen. Zoek hem maar.' },
      { wait: 'found' },
      { say: 'A Mosasaurus, as long as a bus. Hold the tooth up to him.',
        sayNl: 'Een Mosasaurus, zo lang als een bus. Houd de tand eens bij hem.' },
      { wait: 'compared' },
      { say: 'Close, but no. His teeth are sharp too, but they curve backwards and are smaller.',
        sayNl: 'Bijna, maar nee. Zijn tanden zijn ook scherp, maar ze buigen naar achteren en zijn kleiner.' },
      { say: 'Our tooth belongs to someone who lived on land. The time drill can travel too: we are going to America, where the big land dinosaurs lived.',
        sayNl: 'Onze tand is van iemand die op het land woonde. De tijdboor kan ook reizen: we gaan naar Amerika, waar toen de grote landdino’s leefden.' },
    ],
  },
  {
    id: 'forest', title: 'The forest', titleNl: 'Het bos',
    steps: [
      { say: 'A forest full of ferns and giant trees. And listen, animals.',
        sayNl: 'Een bos vol varens en reuzenbomen. En luister, dieren.' },
      { say: 'Look around. Someone is hungry.',
        sayNl: 'Kijk eens rond. Iemand heeft honger.' },
      { wait: 'found' },
      { say: 'A Triceratops. Give him a fern. Drag it to his beak.',
        sayNl: 'Een Triceratops. Geef hem een varen. Sleep hem naar zijn snavel.' },
      { wait: 'fed' },
      { say: 'He likes that. A Triceratops eats plants, all day long.',
        sayNl: 'Dat vindt hij lekker. Een Triceratops eet planten, de hele dag.' },
      { say: 'A plant eater does not need a tooth like ours. Ours was made for meat.',
        sayNl: 'Een planteneter heeft zo’n tand niet nodig. Onze tand is gemaakt voor vlees.' },
      { cue: 'rumble' },
      { say: 'Wait. Did you feel that?',
        sayNl: 'Wacht. Voelde je dat?' },
    ],
  },
  {
    id: 'trex', title: 'The T. rex', titleNl: 'De T. rex',
    steps: [
      { say: 'Boom. Boom. Something very big is coming.',
        sayNl: 'Boem. Boem. Er komt iets heel groots aan.' },
      { cue: 'enter' },
      { say: 'A Tyrannosaurus rex. Keep very still, and do not touch anything. Then he will not notice us.',
        sayNl: 'Een Tyrannosaurus rex. Blijf heel stil zitten en raak niets aan. Dan ziet hij ons niet.' },
      { wait: 'passed' },
      { say: 'Phew. He has gone. You kept wonderfully still.',
        sayNl: 'Pfoe. Hij is weg. Wat zat je goed stil.' },
      { cue: 'glint' },
      { say: 'Look, there on the ground, where he was standing. Something is shining. Tap it.',
        sayNl: 'Kijk, daar op de grond, waar hij stond. Daar glinstert iets. Tik erop.' },
      { wait: 'picked' },
      { say: 'A tooth. It looks just like ours. Let us hold them together.',
        sayNl: 'Een tand. Hij lijkt precies op de onze. We houden ze tegen elkaar.' },
      { cue: 'match' },
      { say: 'They match. Our tooth belonged to a T. rex.',
        sayNl: 'Ze passen. Onze tand was van een T. rex.' },
      { say: 'A T. rex lost teeth all its life, and new ones kept growing. This one fell out sixty-eight million years ago.',
        sayNl: 'Een T. rex verloor zijn hele leven tanden, en er groeiden steeds nieuwe. Deze viel achtenzestig miljoen jaar geleden uit.' },
    ],
  },
  {
    id: 'home', title: 'Home again', titleNl: 'Weer thuis',
    steps: [
      { cue: 'ascend' },
      { say: 'Back to our own time. Hold on tight.',
        sayNl: 'Terug naar onze eigen tijd. Hou je goed vast.' },
      { wait: 'arrived' },
      { say: 'Home again. Suri is taking the tooth to the museum, to Naturalis in Leiden.',
        sayNl: 'Weer thuis. Suri brengt de tand naar het museum, naar Naturalis in Leiden.' },
      { say: 'There stands Trix, a real T. rex, who also came from America. Now her teeth have a friend.',
        sayNl: 'Daar staat Trix, een echte T. rex, die ook uit Amerika kwam. Nu hebben haar tanden gezelschap.' },
      { cue: 'end' },
      { say: 'The end. Shall we go again?',
        sayNl: 'Einde. Zullen we nog een keer gaan?' },
    ],
  },
];

/**
 * Lines the scenes say on their own, outside the running script: when a child touches the screen
 * while the T. rex goes by, and when a tooth is held against an animal before the story asks.
 */
export const ASIDES = {
  hush: { say: 'Shh. Keep still. He is only sniffing.', sayNl: 'Sst. Stil blijven. Hij snuffelt alleen maar.' },
  lookAround: { say: 'Turn round, or drag your finger across the screen.', sayNl: 'Draai je om, of veeg met je vinger over het scherm.' },
  notYet: { say: 'Not yet. First find the animal.', sayNl: 'Nog niet. Zoek eerst het dier.' },
};

/** The step after this one in this story, running on into the next chapter; null at the very end. */
export const nextPlace = (p: Place): Place | null => nextPlaceIn(CHAPTERS, p);
