/**
 * Suri heeft buikpijn - the body story journey, as data.
 *
 * The same shape as the other stories: a question at the start and its answer at the end. Suri is
 * in bed with a tummy ache. What is going on in there? You shrink to smaller than a grain of sand, go
 * in with a bite of apple, and follow it: chewed in the mouth, squeezed down the gullet, churned in the
 * stomach, into the long gut with its carpet of little fingers. There you find it: germs that came in
 * with something Suri ate, making the wall of the gut sore. The body's own answer is the white blood
 * cells, and the child helps them do what they do: come out of the blood and swallow the germs.
 *
 * It is written so that it is not frightening. The germs are drawn as what they are, small rods, not
 * monsters with faces; the gut has good bacteria too and the story says so; and it ends with what a
 * parent would say - rest, drink, wash your hands, and go to the doctor if it does not pass. That last
 * line is not decoration: an app must not teach a child that a tummy ache always sorts itself out.
 *
 * Every claim is meant to be true (rule 5) and `docs/claims.md` lists them. The script lives apart
 * from the scenes so the tests can read it without a browser and `scripts/voice.mjs` finds every line.
 */

import { nextPlaceIn, type Chapter as TaleChapter, type Place } from './tale';

export interface Chapter extends TaleChapter {
  id: 'bed' | 'mouth' | 'gullet' | 'stomach' | 'gut' | 'blood' | 'better';
}

/** How many times the apple is chewed, and how many germs the white blood cells have to catch. */
export const CHEWS = 5;
export const GERMS = 5;

/** How far down the gullet one swipe takes the bite: four or five swipes, and you are there. */
export const SQUEEZE = 0.24;

export const CHAPTERS: Chapter[] = [
  {
    id: 'bed', title: 'In bed', titleNl: 'In bed',
    steps: [
      { say: 'Suri is in bed. He has a tummy ache. Ow.',
        sayNl: 'Suri ligt in bed. Hij heeft buikpijn. Au.' },
      { say: 'What is going on in there? We are going to have a look. On the inside.',
        sayNl: 'Wat is daar aan de hand? We gaan het bekijken. Van binnen.' },
      { say: 'We make ourselves very small, smaller than a grain of sand, and go in with a bite of apple.',
        sayNl: 'We maken onszelf heel klein, kleiner dan een zandkorrel, en gaan mee met een hapje appel.' },
      { cue: 'shrink' },
      { wait: 'inside' },
    ],
  },
  {
    id: 'mouth', title: 'The mouth', titleNl: 'De mond',
    steps: [
      { say: 'We are in Suri’s mouth. Look at all those teeth. A child has twenty of them.',
        sayNl: 'We zijn in de mond van Suri. Kijk, al die tanden. Een kind heeft er twintig.' },
      { say: 'Help chew the apple. Tap, and the teeth bite.',
        sayNl: 'Help de appel kauwen. Tik, dan bijten de tanden.' },
      { wait: 'chewed' },
      { say: 'Small pieces now, all wet with spit. Spit starts breaking the food down already.',
        sayNl: 'Nu zijn het kleine stukjes, nat van het speeksel. Speeksel begint het eten al af te breken.' },
      { say: 'And now: swallow.',
        sayNl: 'En nu: slikken.' },
      { cue: 'swallow' },
    ],
  },
  {
    id: 'gullet', title: 'Down the gullet', titleNl: 'De slokdarm',
    steps: [
      { say: 'This tube is the gullet. It goes from your throat down to your stomach.',
        sayNl: 'Deze buis is de slokdarm. Hij loopt van je keel naar je maag.' },
      { say: 'Rings of muscle squeeze the food down. Swipe down, and help them squeeze.',
        sayNl: 'Ringen van spieren knijpen het eten naar beneden. Veeg naar beneden, en help ze knijpen.' },
      { wait: 'down' },
      { say: 'It works even if you stand on your head. The squeezing pushes the food along, not falling.',
        sayNl: 'Het werkt zelfs als je op je hoofd staat. Het knijpen duwt het eten verder, niet het vallen.' },
    ],
  },
  {
    id: 'stomach', title: 'The stomach', titleNl: 'De maag',
    steps: [
      { say: 'Splash. We are in the stomach. It is a bag of muscle, and the juice in it is very sour.',
        sayNl: 'Plons. We zijn in de maag. Dat is een zak van spieren, en het sap erin is heel zuur.' },
      { say: 'The sour juice kills most germs. And a layer of slime keeps the stomach itself safe from it.',
        sayNl: 'Het zure sap doodt de meeste bacteriën. En een laagje slijm beschermt de maag er zelf tegen.' },
      { say: 'The stomach kneads the food into porridge. Tap to help it knead.',
        sayNl: 'De maag kneedt het eten tot pap. Tik om mee te kneden.' },
      { wait: 'kneaded' },
      { say: 'Porridge. On we go, into the gut.',
        sayNl: 'Pap. Door naar de darm.' },
      { cue: 'onward' },
    ],
  },
  {
    id: 'gut', title: 'The gut', titleNl: 'De darm',
    steps: [
      { say: 'This is the gut. In a grown-up it is six metres long, all folded up in the belly.',
        sayNl: 'Dit is de darm. Bij een grote mens is hij wel zes meter lang, helemaal opgevouwen in je buik.' },
      { say: 'All those little fingers take the food out of the porridge, and pass it into the blood.',
        sayNl: 'Al die kleine vingertjes halen het eten uit de pap, en geven het door aan het bloed.' },
      { say: 'Lots of good bacteria live here too. They help you. But something here is not right. Look around.',
        sayNl: 'Hier wonen ook heel veel goede bacteriën. Die helpen je. Maar hier klopt iets niet. Kijk eens rond.' },
      { wait: 'found' },
      { say: 'There. Germs that came in with something Suri ate. The sour juice missed them.',
        sayNl: 'Daar. Ziekmakende bacteriën, die met iets wat Suri at zijn meegekomen. Het zure sap heeft ze gemist.' },
      { say: 'They make the wall of the gut sore. That is the tummy ache. Let us call for help, through the blood.',
        sayNl: 'Ze maken de wand van de darm pijnlijk. Dat is de buikpijn. We roepen hulp, via het bloed.' },
      { cue: 'dive' },
    ],
  },
  {
    id: 'blood', title: 'In the blood', titleNl: 'In het bloed',
    steps: [
      { say: 'We are in a blood vessel. The red cells carry air all round the body. They go all the way round in about a minute.',
        sayNl: 'We zijn in een bloedvat. De rode bloedcellen brengen zuurstof naar je hele lijf. In een minuutje zijn ze helemaal rond.' },
      { say: 'And these big white ones are the white blood cells. They clear up germs.',
        sayNl: 'En die grote witte zijn de witte bloedcellen. Die ruimen bacteriën op.' },
      { say: 'Help them. Drag a white blood cell to a germ.',
        sayNl: 'Help ze. Sleep een witte bloedcel naar een bacterie.' },
      { wait: 'cleared' },
      { say: 'All gone. The white blood cells have swallowed every one.',
        sayNl: 'Allemaal weg. De witte bloedcellen hebben ze allemaal opgegeten.' },
      { say: 'Time to go out again, and grow big.',
        sayNl: 'Tijd om weer naar buiten te gaan, en groot te worden.' },
      { cue: 'grow' },
      { wait: 'outside' },
    ],
  },
  {
    id: 'better', title: 'Better', titleNl: 'Beter',
    steps: [
      { say: 'The next morning. Suri feels much better.',
        sayNl: 'De volgende ochtend. Suri voelt zich een stuk beter.' },
      { say: 'Rest, and drink lots of water, helps the body do its work. And wash your hands before you eat.',
        sayNl: 'Rusten, en veel water drinken, helpt je lijf bij zijn werk. En was je handen voor het eten.' },
      { say: 'Does a tummy ache not go away? Then you go to the doctor.',
        sayNl: 'Gaat buikpijn niet over? Dan ga je naar de dokter.' },
      { cue: 'end' },
      { say: 'The end. Shall we go again?',
        sayNl: 'Einde. Zullen we nog een keer gaan?' },
    ],
  },
];

export const ASIDES = {
  lookAround: { say: 'Turn round, or drag your finger across the screen.', sayNl: 'Draai je om, of veeg met je vinger over het scherm.' },
  swipe: { say: 'Swipe down with your finger, from top to bottom.', sayNl: 'Veeg met je vinger naar beneden, van boven naar onder.' },
  drag: { say: 'Put your finger on a white cell and drag it to a germ.', sayNl: 'Zet je vinger op een witte cel en sleep hem naar een bacterie.' },
};

/** The step after this one in this story, running on into the next chapter; null at the very end. */
export const nextPlace = (p: Place): Place | null => nextPlaceIn(CHAPTERS, p);
