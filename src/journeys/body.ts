/**
 * Het menselijk lichaam - from the top of your head to the tips of your toes.
 *
 * The fourth journey. You are made smaller than a grain of sand and ride a pod straight down
 * through a body: the brain, an eye, the teeth, the voice, the lungs, the heart, the blood, the
 * stomach, the gut, a knee and a foot. It is your own body, which is why it goes top to bottom -
 * a child can point at each stop on themselves.
 *
 * The gauge counts centimetres down from the top of your head, for a child 1.20 m tall. That is a
 * product decision, not a measurement: it is about how tall a six-year-old in the Netherlands is
 * (TNO's growth charts, 2010), in the middle of the four to ten this is for, and the positions of
 * the stops are rounded to where those things sit in a body that size.
 *
 * Four stops are photographs: an eye, red blood cells under an electron microscope, and X-rays of a
 * knee and a foot. The organs are drawn (`bodyart.ts`), because a photograph of a real brain or a
 * real stomach comes from an operating theatre, and that frightens a four-year-old rather than
 * interesting them.
 */

import type { Journey, Stop } from '../journey/types';
import { brain, gut, heart, lungs, stomach, teeth, voice } from './bodyart';

const at = (i: number, n: number): number => i / (n - 1);

const S: Array<Omit<Stop, 'at'>> = [
  {
    id: 'brain', title: 'The brain', titleNl: 'De hersenen', tone: '#c98aa0', mark: 6,
    picture: { kind: 'drawn', art: brain },
    say: 'This is your brain. Everything you feel, see and think comes together here.',
    sayNl: 'Hier zitten je hersenen. Alles wat je voelt, ziet en denkt, komt hier samen.',
    more: [
      { say: 'Your brain cannot feel pain itself, even though it feels everything in the rest of you.',
        sayNl: 'Je hersenen voelen zelf geen pijn, ook al voelen ze alles van de rest van je lijf.' },
      { say: 'A message from your toe to your brain travels faster than a car on the motorway.',
        sayNl: 'Een berichtje van je teen naar je hersenen gaat sneller dan een auto op de snelweg.' },
    ],
  },
  {
    id: 'eye', title: 'The eye', titleNl: 'Het oog', tone: '#6f93b4', mark: 10,
    picture: { kind: 'remote', path: '1/15/Iris_of_the_Human_Eye.jpg', credit: 'Mcorrens, CC BY-SA 3.0' },
    say: 'In the middle of your eye is a little hole, the pupil. That is where the light goes in.',
    sayNl: 'In het midden van je oog zit een gaatje, je pupil. Daar gaat het licht naar binnen.',
    more: [
      { say: 'The coloured ring around it is different for everybody, like a fingerprint.',
        sayNl: 'Het gekleurde rondje eromheen is bij niemand hetzelfde, net als een vingerafdruk.' },
      { say: 'You blink about fifteen times a minute without noticing.',
        sayNl: 'Je knippert zo’n vijftien keer per minuut, zonder dat je het merkt.' },
    ],
  },
  {
    id: 'teeth', title: 'The teeth', titleNl: 'De tanden', tone: '#c85a66', mark: 16,
    picture: { kind: 'drawn', art: teeth },
    say: 'A child has twenty milk teeth, and they come out one by one.',
    sayNl: 'Een kind heeft twintig melktanden. Die vallen er een voor een uit.',
    more: [
      { say: 'Thirty-two grow back in their place, and those have to last a whole life.',
        sayNl: 'Er komen er tweeëndertig voor terug, en die moeten een heel leven mee.' },
      { say: 'The enamel on your teeth is the hardest thing in your whole body.',
        sayNl: 'Het glazuur op je tanden is het hardste wat er in je hele lichaam zit.' },
    ],
  },
  {
    id: 'voice', title: 'The voice', titleNl: 'De stembanden', tone: '#b04c5a', mark: 22,
    picture: { kind: 'drawn', art: voice },
    say: 'These are your vocal cords. When you talk or sing, they shake.',
    sayNl: 'Dit zijn je stembanden. Als je praat of zingt, trillen ze.',
    more: [
      { say: 'On a high note they shake hundreds of times a second.',
        sayNl: 'Bij een hoge noot trillen ze honderden keren per seconde.' },
      { say: 'When you whisper they stay still, and it is only air.',
        sayNl: 'Als je fluistert, trillen ze niet: dan is het alleen lucht.' },
    ],
  },
  {
    id: 'lungs', title: 'The lungs', titleNl: 'De longen', tone: '#d27d8e', mark: 34,
    picture: { kind: 'drawn', art: lungs },
    say: 'Your lungs are two soft bags that fill with air every time you breathe in.',
    sayNl: 'Je longen zijn twee zachte zakken die zich vullen met lucht, elke keer als je inademt.',
    more: [
      { say: 'Your left lung is a bit smaller, to make room for your heart.',
        sayNl: 'Je linkerlong is een stukje kleiner, om plaats te maken voor je hart.' },
      { say: 'You breathe about twenty thousand times a day, even while you sleep.',
        sayNl: 'Je ademt zo’n twintigduizend keer per dag, ook als je slaapt.' },
    ],
  },
  {
    id: 'heart', title: 'The heart', titleNl: 'Het hart', tone: '#a8323f', mark: 38,
    picture: { kind: 'drawn', art: heart },
    say: 'Your heart is a muscle about the size of your fist, and it never rests.',
    sayNl: 'Je hart is een spier zo groot als je vuist, en het rust nooit.',
    more: [
      { say: 'It beats more than a hundred thousand times a day.',
        sayNl: 'Het klopt meer dan honderdduizend keer per dag.' },
      { say: 'Put your hand flat on your chest and you can feel it.',
        sayNl: 'Leg je hand plat op je borst, dan voel je het.' },
    ],
  },
  {
    id: 'blood', title: 'The blood', titleNl: 'Het bloed', tone: '#8e2a34', mark: 42,
    picture: { kind: 'remote', path: '1/14/Red_blood_cells_%282%29.jpg', credit: 'Scootdive, CC BY-SA 3.0' },
    say: 'This is blood, made very much bigger. The little discs carry air to every bit of you.',
    sayNl: 'Dit is bloed, heel erg vergroot. De schijfjes brengen zuurstof naar elk stukje van je lijf.',
    more: [
      { say: 'There are millions of those discs in a single drop of blood.',
        sayNl: 'In één druppel bloed zitten miljoenen van die schijfjes.' },
      { say: 'Your blood goes all the way round your body in about a minute.',
        sayNl: 'Je bloed gaat in ongeveer een minuut je hele lichaam rond.' },
    ],
  },
  {
    id: 'stomach', title: 'The stomach', titleNl: 'De maag', tone: '#c98060', mark: 48,
    picture: { kind: 'drawn', art: stomach },
    say: 'In your stomach your food is squeezed and mixed with stomach acid until it is a mush.',
    sayNl: 'In je maag wordt je eten gekneed en met maagzuur gemengd tot het pap is.',
    more: [
      { say: 'When your tummy rumbles, air and juice are sliding along inside.',
        sayNl: 'Als je buik rommelt, schuiven er lucht en sap door je buik.' },
      { say: 'Your stomach stretches like a balloon when you eat, and shrinks again afterwards.',
        sayNl: 'Je maag rekt uit als een ballon als je eet, en krimpt daarna weer.' },
    ],
  },
  {
    id: 'gut', title: 'The gut', titleNl: 'De darmen', tone: '#b0645a', mark: 60,
    picture: { kind: 'drawn', art: gut },
    say: 'Your gut is a very long tube, folded up. This is where your body takes the good out of your food.',
    sayNl: 'Je darmen zijn een heel lange, opgevouwen buis. Hier haalt je lijf het goede uit je eten.',
    more: [
      { say: 'In a grown-up the small intestine is about six metres long.',
        sayNl: 'Bij een volwassene is de dunne darm zo’n zes meter lang.' },
      { say: 'What you eat today takes a day or two to go all the way through.',
        sayNl: 'Wat je vandaag eet, is pas na een dag of twee helemaal door je darmen.' },
    ],
  },
  {
    id: 'knee', title: 'The knee', titleNl: 'De knie', tone: '#6d7a8a', mark: 88,
    picture: { kind: 'remote', path: 'f/f0/Knee_plain_X-ray.jpg', credit: 'Ptrump16, CC BY-SA 4.0' },
    say: 'This picture looks straight through a knee. You see the bones, because they stop the X-rays.',
    sayNl: 'Deze foto kijkt dwars door een knie. Je ziet de botten, want die houden de röntgenstralen tegen.',
    more: [
      { say: 'A baby has about three hundred little bones. Some grow together, and a grown-up has two hundred and six.',
        sayNl: 'Een baby heeft zo’n driehonderd botjes. Een deel groeit aan elkaar vast, en een volwassene heeft er tweehonderdzes.' },
      { say: 'Your thigh bone is the longest and strongest bone you have.',
        sayNl: 'Je bovenbeen is het langste en sterkste bot dat je hebt.' },
    ],
  },
  {
    id: 'foot', title: 'The foot', titleNl: 'De voet', tone: '#5f6b78', mark: 120,
    picture: { kind: 'remote', path: '6/6f/X-ray_of_normal_right_foot_by_dorsoplantar_projection.jpg', credit: 'Mikael Häggström, CC0' },
    say: 'We have reached your toes. There are twenty-six little bones in one foot.',
    sayNl: 'We zijn bij je tenen. In één voet zitten zesentwintig botjes.',
    more: [
      { say: 'Your two feet together hold more than a quarter of all your bones.',
        sayNl: 'In je twee voeten samen zit ruim een kwart van al je botten.' },
      { say: 'Your feet carry you every day, and they keep growing until you are about fifteen.',
        sayNl: 'Je voeten dragen je elke dag, en ze groeien door tot je ongeveer vijftien bent.' },
    ],
  },
];

export const BODY: Journey = {
  id: 'lichaam',
  title: 'Inside your body', titleNl: 'Het menselijk lichaam',
  opening: 'We have been made smaller than a grain of sand. We start at the top of your head and go all the way down to your toes.',
  openingNl: 'We zijn kleiner gemaakt dan een zandkorrel. We beginnen boven in je hoofd en reizen helemaal naar je tenen.',
  closing: 'From the top of your head to your toes. And all of it is working at once, all day long, right now too.',
  closingNl: 'Van je kruin tot je tenen. En dat werkt allemaal tegelijk, de hele dag, ook nu.',
  craft: 'pod', axis: 'down',
  unit: 'cm from the top', unitNl: 'cm vanaf je kruin',
  stops: S.map((s, i) => ({ ...s, at: at(i, S.length) })),
};
