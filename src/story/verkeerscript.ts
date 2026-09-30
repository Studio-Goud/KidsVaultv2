/**
 * Suri en de fietstocht - the traffic story journey, as data.
 *
 * Suri has a new bicycle and rides to grandma's with the child. The story is what a child in Dutch
 * traffic actually does, in the order a short ride goes: helmet and bell at home, walking the bike to
 * the kerb and looking, the red cycle path, a zebra crossing, a traffic light, and arriving. Every
 * chapter says out loud why, because a child who is told "look left first" without a reason has
 * nothing to hold on to.
 *
 * It is written so that nothing frightening happens. There is no crash, no shout, nobody is hurt and
 * a child cannot do it wrong: the worst thing that can happen is that Suri says "wait a moment".
 * Tapping go on a red light is not an error, it is a reason for one more sentence.
 *
 * What this story says out loud, all of it meant to be true (rule 5; `docs/claims.md` lists them):
 *   1. In the Netherlands you cycle on the right.
 *   2. A red cycle path is for bikes.
 *   3. A helmet protects your head if you fall. It is called "a good idea", never "required":
 *      there is no helmet law for cyclists in the Netherlands.
 *   4. At a zebra crossing, cars must stop for people who are crossing - so the story has Suri get
 *      off and walk the bike across, because that is what makes you a pedestrian. A rider on a bike
 *      is not one. And it still says to look first.
 *   5. A red light means stop, a green light means go.
 *   6. Before crossing you look left, right and left again (links, rechts, links), because on the
 *      lane nearest to you the traffic comes from the left.
 *   7. A bell says "here I come".
 *   8. A blue round sign with a bicycle on it means the path is for bikes.
 *
 * The script lives apart from the scenes so the tests can read it without a browser and
 * `scripts/voice.mjs` finds every line.
 */

import { nextPlaceIn, type Chapter as TaleChapter, type Place } from './tale';

export interface Chapter extends TaleChapter {
  id: 'thuis' | 'stoep' | 'fietspad' | 'zebrapad' | 'stoplicht' | 'oma';
}

/**
 * How far the camera must turn to have "looked left" or "looked right", in radians. 0.8 is about
 * 46 degrees: far enough that the road is seen running away along its length rather than across the
 * screen, near enough that a four-year-old with one finger gets there in two swipes. Product decision.
 */
export const LOOK_YAW = 0.8;
/** How long the look must be held, in seconds, so sweeping past it does not count. Product decision. */
export const LOOK_HOLD = 0.35;

/**
 * How long the light stays red at least, in seconds, once the child has been told what it means.
 * It turns green only when the cross traffic has gone, so this is a floor and not a timer on the
 * child: nothing is counted against anyone. Product decision.
 */
export const RED_MIN = 5;

/** Metres: from the front door to the kerb, the width of the road, the path to grandma's door. */
export const TO_KERB = 4.5;
export const ROAD_NEAR = 7;
export const ROAD_WIDTH = 6;
export const RIDE_LEN = 30;
export const TO_OMA = 11;

export const CHAPTERS: Chapter[] = [
  {
    id: 'thuis', title: 'At home', titleNl: 'Thuis',
    steps: [
      { say: 'Suri has a new bicycle. A red one, with a bell.',
        sayNl: 'Suri heeft een nieuwe fiets gekregen. Een rode, met een bel.' },
      { say: 'Today we are cycling to grandma’s house. You come too.',
        sayNl: 'Vandaag fietsen we naar oma. Jij gaat mee.' },
      { say: 'First the helmet. A helmet protects your head if you fall. Tap the helmet.',
        sayNl: 'Eerst de helm. Een helm beschermt je hoofd als je valt. Tik op de helm.' },
      { wait: 'helmet' },
      { say: 'It fits well. A helmet is a good idea.',
        sayNl: 'Hij zit goed. Een helm is een goed idee.' },
      { say: 'Now the bell. Tap the bell.',
        sayNl: 'Nu de bel. Tik op de bel.' },
      { wait: 'bell' },
      { say: 'Ting ting. A bell says: here I come.',
        sayNl: 'Tring tring. Een bel zegt: hier kom ik.' },
      { say: 'Off we go.',
        sayNl: 'Daar gaan we.' },
    ],
  },
  {
    id: 'stoep', title: 'The pavement', titleNl: 'De stoep',
    steps: [
      { say: 'We walk the bike to the road. Hold the button and walk along.',
        sayNl: 'We lopen met de fiets aan de hand naar de weg. Houd de knop ingedrukt en loop mee.' },
      { wait: 'atkerb' },
      { say: 'Stop at the edge. We do not just go. First we look.',
        sayNl: 'Stop bij de rand. We gaan niet zomaar. Eerst kijken.' },
      { say: 'Look to the left. Turn round, or drag your finger across the screen.',
        sayNl: 'Kijk naar links. Draai, of veeg met je vinger over het scherm.' },
      { wait: 'left' },
      { say: 'Here comes a car. On this side the cars come from the left. We wait until it has gone by.',
        sayNl: 'Daar komt een auto. Aan deze kant komen de auto’s van links. We wachten tot hij voorbij is.' },
      { wait: 'carPassed' },
      { say: 'Now look to the right.',
        sayNl: 'Kijk nu naar rechts.' },
      { wait: 'right' },
      { say: 'Nothing is coming.',
        sayNl: 'Er komt niets aan.' },
      { say: 'And to the left once more. Left, right, left: that is how we look.',
        sayNl: 'En nog een keer naar links. Links, rechts, links: zo kijken we.' },
      { wait: 'left2' },
      { say: 'The road is clear. Now we walk across.',
        sayNl: 'De weg is vrij. Nu lopen we over.' },
      { cue: 'cross' },
      { wait: 'over' },
    ],
  },
  {
    id: 'fietspad', title: 'The cycle path', titleNl: 'Het fietspad',
    steps: [
      { say: 'This is the cycle path. It is red. A red cycle path is for bikes.',
        sayNl: 'Dit is het fietspad. Het is rood. Een rood fietspad is voor fietsen.' },
      { say: 'In the Netherlands we cycle on the right. Suri stays on the right.',
        sayNl: 'In Nederland fietsen we rechts. Suri blijft rechts.' },
      { say: 'Hold the button to pedal.',
        sayNl: 'Houd de knop ingedrukt om te trappen.' },
      { wait: 'pedaled' },
      { say: 'Well done. Can you see a sign? A blue, round one, with a bicycle on it. Look around.',
        sayNl: 'Mooi zo. Zie je een bord? Een blauw, rond bord met een fiets erop. Kijk eens rond.' },
      { wait: 'found' },
      { say: 'There it is. A blue round sign with a bicycle on it says: this path is for bikes.',
        sayNl: 'Daar is het. Een blauw rond bord met een fiets erop zegt: dit pad is voor fietsen.' },
    ],
  },
  {
    id: 'zebrapad', title: 'The zebra crossing', titleNl: 'Het zebrapad',
    steps: [
      { say: 'A zebra crossing. The white stripes are for people who want to cross.',
        sayNl: 'Een zebrapad. De witte strepen zijn voor mensen die willen oversteken.' },
      { say: 'We get off and walk the bike. First we stop at the edge. Tap stop.',
        sayNl: 'We stappen af en lopen met de fiets aan de hand. Eerst stoppen bij de rand. Tik op stop.' },
      { wait: 'stopped' },
      { cue: 'car' },
      { say: 'Good. We are standing still. Here comes a car. Look to the left and find it.',
        sayNl: 'Goed. We staan stil. Daar komt een auto. Kijk naar links en zoek hem.' },
      { wait: 'found' },
      { say: 'The car stops. Cars must stop for people who are crossing. We wait until it stands still.',
        sayNl: 'De auto stopt. Auto’s moeten stoppen voor mensen die oversteken. We wachten tot hij stilstaat.' },
      { wait: 'carStill' },
      { say: 'Still, we look first, even at a zebra crossing. He is standing still. Now we may cross.',
        sayNl: 'Toch kijken we eerst, ook bij een zebrapad. Hij staat stil. Nu mogen we oversteken.' },
      { say: 'Hold the button and walk across the stripes.',
        sayNl: 'Houd de knop ingedrukt en loop over de strepen.' },
      { wait: 'crossed' },
      { say: 'We are across. Thank you, car.',
        sayNl: 'We zijn aan de overkant. Dank je wel, auto.' },
    ],
  },
  {
    id: 'stoplicht', title: 'The traffic light', titleNl: 'Het stoplicht',
    steps: [
      { say: 'A traffic light. Red means stop. Green means go.',
        sayNl: 'Een stoplicht. Rood betekent stop. Groen betekent gaan.' },
      { say: 'It is red now. We stop and wait. The cars may go.',
        sayNl: 'Nu staat het op rood. Wij stoppen en wachten. De auto’s mogen rijden.' },
      { say: 'When it turns green, tap go.',
        sayNl: 'Als het groen wordt, tik je op ga.' },
      { wait: 'go' },
      { say: 'Green means go. Off we go.',
        sayNl: 'Groen betekent gaan. Daar gaan we.' },
      { cue: 'ride' },
      { wait: 'over' },
    ],
  },
  {
    id: 'oma', title: 'Grandma’s house', titleNl: 'Bij oma',
    steps: [
      { say: 'Nearly there. Hold the button and cycle to grandma’s house.',
        sayNl: 'Bijna daar. Houd de knop ingedrukt en fiets naar het huis van oma.' },
      { wait: 'arrived' },
      { say: 'We are here. This is where grandma lives.',
        sayNl: 'We zijn er. Hier woont oma.' },
      { say: 'Ring the bell, so grandma knows we are here.',
        sayNl: 'Bel maar, dan weet oma dat we er zijn.' },
      { wait: 'rang' },
      { cue: 'grandma' },
      { say: 'Grandma opens the door. She is so glad to see you both.',
        sayNl: 'Oma doet de deur open. Wat is ze blij jullie te zien.' },
      { say: 'Suri takes off his helmet. There is cake.',
        sayNl: 'Suri doet zijn helm af. Er is cake.' },
      { cue: 'end' },
      { say: 'The end. Shall we go again?',
        sayNl: 'Einde. Zullen we nog een keer gaan?' },
    ],
  },
];

export const ASIDES = {
  lookAround: { say: 'Turn round, or drag your finger across the screen. Somewhere there is a blue sign.', sayNl: 'Draai je om, of veeg met je vinger over het scherm. Ergens staat een blauw bord.' },
  hold: { say: 'Keep your finger on the button.', sayNl: 'Houd je vinger op de knop.' },
  helmet: { say: 'Tap the helmet, the button with the helmet on it.', sayNl: 'Tik op de helm, de knop met de helm erop.' },
  bell: { say: 'Tap the bell, the button with the bell on it.', sayNl: 'Tik op de bel, de knop met de bel erop.' },
  stop: { say: 'Tap stop, the red button.', sayNl: 'Tik op stop, de rode knop.' },
  left: { say: 'Turn to the left, or drag your finger to the right. Then you see the road.', sayNl: 'Draai naar links, of veeg met je vinger naar rechts. Dan zie je de weg.' },
  right: { say: 'Now to the right, or drag your finger to the left.', sayNl: 'Nu naar rechts, of veeg met je vinger naar links.' },
  wait: { say: 'Wait a little longer. It is red.', sayNl: 'Nog even wachten. Het is rood.' },
  green: { say: 'It is green. Now tap go.', sayNl: 'Het is groen. Nu tik je op ga.' },
  findCar: { say: 'Look to the left. The car is on the road.', sayNl: 'Kijk naar links. De auto rijdt op de weg.' },
};

/** The step after this one in this story, running on into the next chapter; null at the very end. */
export const nextPlace = (p: Place): Place | null => nextPlaceIn(CHAPTERS, p);
