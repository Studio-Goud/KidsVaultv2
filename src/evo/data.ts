/**
 * Van cel tot mens - the stops on the way, the body at each, and what is said there.
 *
 * The owner asked for human evolution explained better than it has ever been explained, "from the
 * very beginning to the very end", with transformations. The line here is our own: each stop is an
 * animal on the branch that leads to us, or as close to that branch as the fossils let anyone say.
 * Where a stop is a relative rather than a grandparent, the words say so - Acanthostega was a cousin
 * of our ancestors, not one of them, and chimpanzees are cousins too.
 *
 * Every date and every claim is meant to be true (rule 5) and each is listed in `docs/claims.md`.
 * The dates are the usual rounded ones: the oldest signs of life over three and a half billion
 * years ago, cells with a nucleus about two billion, animals of many cells about six hundred million,
 * Haikouichthys 518 million, the first bony fish about 420 million, Tiktaalik 375 million,
 * Acanthostega 365 million, the first egg-layers on our side about 310 million, Thrinaxodon 250
 * million, Morganucodon about 205 million, the asteroid 66 million, the first primates about 55
 * million, Proconsul about 20 million, Sahelanthropus about 7 million, Lucy 3.2 million, Homo habilis
 * about 2.3 million, Homo erectus about 1.9 million, Homo sapiens about 300,000 years (Jebel Irhoud),
 * and the oldest known cave paintings over 40,000.
 *
 * The bodies are numbers (`body.ts`); what one animal looks like halfway to the next is halfway
 * between their numbers. The sizes of the animals are said in words where they surprise; the drawing
 * is always scaled to fill the stage, because a ten-centimetre mouse the size it really is next to
 * Lucy would be a dot.
 */

import type { Body } from './body';

export type Early = 'cell' | 'nucleus' | 'many';
export type Scene = 'vent' | 'sea' | 'silurian' | 'reef' | 'shallows' | 'swamp' | 'dunes' | 'night' | 'trees' | 'forest' | 'savanna' | 'camp' | 'cave' | 'now';

/** What the child can do at a stop, beyond dragging on. */
export type Act = 'divide' | 'stick' | 'xray' | 'bite' | 'fingers' | 'hatch' | 'sniff' | 'leap' | 'tail' | 'tree' | 'walk' | 'knap' | 'fire' | 'hand' | 'clock' | null;

export interface Stop {
  id: string;
  /** years ago */
  ago: number;
  /** how the date is written on the time line */
  when: { en: string; nl: string };
  name: { en: string; nl: string };
  scene: Scene;
  early?: Early;
  body?: Body;
  act: Act;
  /** what the X-ray should point at here, if anything */
  show?: 'arm' | 'digits' | 'tail' | 'brain' | 'jaw' | 'spine';
  /** after which line the story waits for the child to do the act before going on */
  wait?: number;
  lines: Array<{ say: string; sayNl: string }>;
}

// ---------------------------------------------------------------- the bodies

const BASE: Body = {
  posture: 0, girth: 0.14, butt: 0, chest: 0, belly: 0, tail: 1, tailFin: 0, dorsalFin: 0, neck: 0,
  head: 0.3, headH: 0.6, snout: 0.5, dome: 0.1, brow: 0, chin: 0, nose: 0, jaw: 1, eye: 0.6, eyeFront: 0,
  sclera: 0, ear: 0, whisker: 0, arm: 0, leg: 0, fin: 1, digits: 5, sprawl: 1, grasp: 0, knuckle: 0,
  skin: '#8a7a5a', under: '#d8cfb0', fur: 0, furCol: '#6b5440', hair: 0, hairCol: '#1a1410', scales: 0,
  vert: 1, ribs: 0, clear: 0, swim: 0, wrap: 0,
};
const body = (b: Partial<Body>): Body => ({ ...BASE, ...b });

/** Haikouichthys: a finger-long swimmer with a rod down its back and no jaw. */
const HAIKOU = body({
  girth: 0.12, tail: 1.05, tailFin: 0.45, dorsalFin: 0.6, head: 0.26, headH: 0.82, snout: 0.35, dome: 0.15,
  jaw: 0, eye: 0.7, skin: '#c8b49a', under: '#e8dcc8', vert: 0, clear: 1, swim: 1, digits: 0,
});
/** A bony fish with jaws: fins on a fleshy base, scales, a gill cover. */
const JAWS = body({
  girth: 0.22, tail: 0.75, tailFin: 1, dorsalFin: 0.8, head: 0.38, headH: 0.95, snout: 0.45, dome: 0.12,
  jaw: 1, eye: 0.65, arm: 0.28, leg: 0.22, fin: 1, digits: 1, skin: '#5f7d74', under: '#d9dcc4', scales: 1,
  vert: 1, swim: 1,
});
/** Tiktaalik: a flat head on a neck, fins with bones in them, propped up in the shallows. */
const TIKTAALIK = body({
  girth: 0.16, tail: 0.95, tailFin: 0.55, dorsalFin: 0, neck: 0.1, head: 0.44, headH: 0.45, snout: 0.85, dome: 0.1,
  eye: 0.55, arm: 0.36, leg: 0.24, fin: 0.72, digits: 1, sprawl: 1, skin: '#6d6a48', under: '#c9c19a', scales: 1,
  ribs: 0.6, swim: 0.35,
});
/** Acanthostega: four legs, eight fingers on its front feet, and still a fin on its tail. */
const ACANTHO = body({
  girth: 0.14, tail: 1.0, tailFin: 0.6, neck: 0.08, head: 0.4, headH: 0.46, snout: 0.75, dome: 0.12,
  eye: 0.55, arm: 0.42, leg: 0.46, fin: 0.08, digits: 8, sprawl: 1, skin: '#5d6a50', under: '#c8c49c', scales: 0.5,
  ribs: 0.8, swim: 0.2,
});
/** One of the first animals on our side to lay eggs on land: small, lizard-shaped, scaly. */
const EGG = body({
  girth: 0.13, tail: 1.2, neck: 0.1, head: 0.3, headH: 0.55, snout: 0.6, dome: 0.25, eye: 0.7, arm: 0.46, leg: 0.5,
  fin: 0, digits: 5, sprawl: 0.95, skin: '#8a6a44', under: '#d8c49c', scales: 1, ribs: 1,
});
/** Thrinaxodon: legs more under the body, and very likely whiskers. */
const CYNO = body({
  girth: 0.15, tail: 0.65, neck: 0.12, head: 0.34, headH: 0.6, snout: 0.6, dome: 0.3, eye: 0.7, ear: 0.2,
  whisker: 0.6, arm: 0.5, leg: 0.55, fin: 0, sprawl: 0.5, skin: '#7a5e44', under: '#c8b08c', fur: 0.45,
  furCol: '#6e5540', scales: 0.2, ribs: 1,
});
/** Morganucodon: one of the first mammals, shrew-sized, whiskers and fur. */
const MAMMAL = body({
  girth: 0.2, tail: 0.85, neck: 0.12, head: 0.34, headH: 0.62, snout: 0.75, dome: 0.4, eye: 0.95, ear: 0.7,
  whisker: 1, arm: 0.48, leg: 0.52, fin: 0, sprawl: 0.2, skin: '#8a6a58', under: '#b89c80', fur: 1,
  furCol: '#5e4838', ribs: 1,
});
/** An early primate: tiny, long tail, big eyes in front, hands that grip. */
const PRIMATE = body({
  girth: 0.2, tail: 1.3, neck: 0.12, head: 0.32, headH: 0.8, snout: 0.3, dome: 0.55, eye: 1.4, eyeFront: 1, ear: 0.55,
  whisker: 0.3, arm: 0.55, leg: 0.68, fin: 0, sprawl: 0.1, grasp: 1, skin: '#9a7a62', under: '#c8ac90', fur: 1,
  furCol: '#7a5a40', ribs: 1,
});
/** Proconsul: an ape with no tail. */
const APE = body({
  posture: 0.12, girth: 0.28, belly: 0.3, tail: 0, neck: 0.1, head: 0.42, headH: 0.9, snout: 0.35, dome: 0.55,
  brow: 0.4, eye: 0.75, eyeFront: 1, ear: 0.4, arm: 1.05, leg: 0.95, fin: 0, sprawl: 0, grasp: 1, knuckle: 0.2,
  skin: '#4a3a30', under: '#6a5446', fur: 1, furCol: '#3e2e24', ribs: 1,
});
/** Sahelanthropus: near the fork where the chimpanzees' line and ours went apart. */
const SPLIT = body({
  posture: 0.35, girth: 0.3, belly: 0.5, tail: 0, neck: 0.08, head: 0.45, headH: 0.95, snout: 0.3, dome: 0.55,
  brow: 1, eye: 0.7, eyeFront: 1, ear: 0.45, arm: 1.35, leg: 1.05, fin: 0, sprawl: 0, grasp: 1, knuckle: 1,
  skin: '#3e3028', under: '#5a4a3e', fur: 1, furCol: '#2e241e', ribs: 1,
});
/** Lucy: upright on two legs, still a small brain and long arms. */
const LUCY = body({
  posture: 0.94, girth: 0.26, butt: 0.3, chest: 0.2, belly: 0.35, tail: 0, neck: 0.1, head: 0.45, headH: 0.95,
  snout: 0.28, dome: 0.55, brow: 0.8, eye: 0.7, eyeFront: 1, ear: 0.5, arm: 1.2, leg: 1.2, fin: 0, sprawl: 0,
  grasp: 0.4, skin: '#4a382c', under: '#5e4a3a', fur: 0.85, furCol: '#3a2c22', ribs: 1,
});
/** Homo habilis: a bigger braincase, a smaller face, a maker of stone tools. */
const HABILIS = body({
  posture: 0.97, girth: 0.26, butt: 0.45, chest: 0.3, belly: 0.3, tail: 0, neck: 0.12, head: 0.44, headH: 1.0,
  snout: 0.18, dome: 0.7, brow: 0.7, eye: 0.68, eyeFront: 1, ear: 0.55, arm: 1.25, leg: 1.4, fin: 0, sprawl: 0,
  skin: '#4a3428', under: '#5a4232', fur: 0.5, furCol: '#34261c', ribs: 1, sclera: 0.2,
});
/** Homo erectus: long legs like ours, a strong brow, and walked out of Africa. */
const ERECTUS = body({
  posture: 1, girth: 0.23, butt: 0.6, chest: 0.4, belly: 0.1, tail: 0, neck: 0.18, head: 0.42, headH: 1.0,
  snout: 0.1, dome: 0.8, brow: 0.85, nose: 0.6, eye: 0.62, eyeFront: 1, ear: 0.6, arm: 1.2, leg: 1.7, fin: 0,
  sprawl: 0, skin: '#4a3024', under: '#58402e', fur: 0.12, furCol: '#34261c', hair: 0.5, ribs: 1, sclera: 0.7,
});
/** Homo sapiens: a round head, a small face, a chin. */
const SAPIENS = body({
  posture: 1, girth: 0.22, butt: 0.6, chest: 0.4, belly: 0.05, tail: 0, neck: 0.2, head: 0.42, headH: 1.15,
  snout: 0.04, dome: 1.05, brow: 0.15, chin: 1, nose: 0.9, eye: 0.62, eyeFront: 1, ear: 0.6, arm: 1.2, leg: 1.75,
  fin: 0, sprawl: 0, skin: '#5a3a28', under: '#6a4632', fur: 0.03, furCol: '#34261c', hair: 1, ribs: 1, sclera: 1, wrap: 1,
});
const PAINTER = { ...SAPIENS, hair: 1.1 };

// ---------------------------------------------------------------- the stops

export const STOPS: Stop[] = [
  {
    id: 'cell', ago: 3.7e9, when: { en: 'over 3.5 billion years ago', nl: 'ruim 3,5 miljard jaar geleden' },
    name: { en: 'The first cells', nl: 'De eerste cellen' }, scene: 'vent', early: 'cell', act: 'divide',
    lines: [
      { say: 'Long, long ago there were no animals and no plants. Only water, rock, and warm springs deep in the sea.',
        sayNl: 'Heel, heel lang geleden waren er nog geen dieren en geen planten. Alleen water, stenen, en warme bronnen diep in de zee.' },
      { say: 'And then there was something new: a cell. Tinier than a grain of sand, but alive.',
        sayNl: 'En toen was er iets nieuws: een cel. Kleiner dan een zandkorrel, maar levend.' },
      { say: 'A cell can split in two. Tap it, and see.',
        sayNl: 'Een cel kan zich in tweeën delen. Tik er maar op.' },
    ],
  },
  {
    id: 'nucleus', ago: 2e9, when: { en: 'about 2 billion years ago', nl: 'zo’n 2 miljard jaar geleden' },
    name: { en: 'A cell with a core', nl: 'Een cel met een kern' }, scene: 'sea', early: 'nucleus', act: null,
    lines: [
      { say: 'Every time a cell splits, the two new cells are almost the same. Almost. Sometimes a little bit different.',
        sayNl: 'Elke keer als een cel zich deelt, zijn de twee nieuwe cellen bijna hetzelfde. Bijna. Soms een heel klein beetje anders.' },
      { say: 'Those tiny differences add up, over a very long time. Here is a cell with a core inside it, like your own cells have.',
        sayNl: 'Die kleine verschillen tellen op, heel lang. Hier is een cel met een kern erin, net als de cellen in jouw lijf.' },
    ],
  },
  {
    id: 'many', ago: 6e8, when: { en: 'about 600 million years ago', nl: 'zo’n 600 miljoen jaar geleden' },
    name: { en: 'Many cells together', nl: 'Veel cellen samen' }, scene: 'sea', early: 'many', act: 'stick',
    wait: 0,
    lines: [
      { say: 'Then cells started to stay together. Tap them, and they stick.',
        sayNl: 'Toen gingen cellen bij elkaar blijven. Tik erop, dan plakken ze vast.' },
      { say: 'Many cells together make one animal. You are made of more cells than there are stars you can see.',
        sayNl: 'Veel cellen samen vormen één dier. Jij bent gemaakt van meer cellen dan er sterren zijn die je kunt zien.' },
    ],
  },
  {
    id: 'backbone', ago: 5.18e8, when: { en: '518 million years ago', nl: '518 miljoen jaar geleden' },
    name: { en: 'A rod down the back', nl: 'Een staaf in de rug' }, scene: 'reef', body: HAIKOU, act: 'xray', show: 'spine',
    wait: 1,
    lines: [
      { say: 'This little swimmer is Haikouichthys. It was about as long as your finger.',
        sayNl: 'Dit zwemmertje heet Haikouichthys. Het was ongeveer zo lang als jouw vinger.' },
      { say: 'Tap the X-ray button, and look inside.',
        sayNl: 'Tik op de röntgenknop, en kijk erin.' },
      { say: 'Down its back runs a stiff rod. That is the beginning of a backbone. You have one too.',
        sayNl: 'Door zijn rug loopt een stevige staaf. Dat is het begin van een ruggengraat. Die heb jij ook.' },
    ],
  },
  {
    id: 'jaws', ago: 4.2e8, when: { en: 'about 420 million years ago', nl: 'zo’n 420 miljoen jaar geleden' },
    name: { en: 'A fish with jaws', nl: 'Een vis met kaken' }, scene: 'silurian', body: JAWS, act: 'bite', show: 'jaw',
    wait: 0,
    lines: [
      { say: 'Fish grew jaws that could open and shut. Tap it, and it bites.',
        sayNl: 'Vissen kregen kaken die open en dicht konden. Tik erop, dan hapt hij.' },
      { say: 'Your jaw comes from here. So do your teeth.',
        sayNl: 'Jouw kaak komt hiervandaan. Je tanden ook.' },
    ],
  },
  {
    id: 'tiktaalik', ago: 3.75e8, when: { en: '375 million years ago', nl: '375 miljoen jaar geleden' },
    name: { en: 'Tiktaalik', nl: 'Tiktaalik' }, scene: 'shallows', body: TIKTAALIK, act: 'xray', show: 'arm',
    wait: 1,
    lines: [
      { say: 'This is Tiktaalik. It lived in shallow water and could push itself up on its fins.',
        sayNl: 'Dit is Tiktaalik. Hij leefde in ondiep water en kon zich opdrukken op zijn vinnen.' },
      { say: 'Look inside its fin with the X-ray.',
        sayNl: 'Kijk met de röntgen eens in zijn vin.' },
      { say: 'One bone, then two bones, then little bones. Just like in your arm: upper arm, lower arm, hand.',
        sayNl: 'Eén bot, dan twee botten, dan kleine botjes. Net als in jouw arm: bovenarm, onderarm, hand.' },
    ],
  },
  {
    id: 'fourlegs', ago: 3.65e8, when: { en: '365 million years ago', nl: '365 miljoen jaar geleden' },
    name: { en: 'Four legs', nl: 'Vier poten' }, scene: 'shallows', body: ACANTHO, act: 'fingers', show: 'digits',
    wait: 1,
    lines: [
      { say: 'The fins became legs. This cousin of our ancestors is Acanthostega.',
        sayNl: 'De vinnen werden poten. Deze neef van onze voorouders heet Acanthostega.' },
      { say: 'Count its fingers. On each front foot it had eight.',
        sayNl: 'Tel zijn vingers eens. Aan elke voorpoot had hij er acht.' },
      { say: 'Later animals kept five. That is how many you have.',
        sayNl: 'Latere dieren hielden er vijf. Zoveel heb jij er ook.' },
    ],
  },
  {
    id: 'egg', ago: 3.1e8, when: { en: 'about 310 million years ago', nl: 'zo’n 310 miljoen jaar geleden' },
    name: { en: 'An egg on land', nl: 'Een ei op het land' }, scene: 'swamp', body: EGG, act: 'hatch',
    wait: 1,
    lines: [
      { say: 'Frogs still have to lay their eggs in water. These animals laid eggs with a shell, on land.',
        sayNl: 'Kikkers moeten hun eitjes nog in het water leggen. Deze dieren legden eieren met een schaal, op het land.' },
      { say: 'Tap the egg.',
        sayNl: 'Tik op het ei.' },
      { say: 'Now they could live far from the water, in the great forests of ferns.',
        sayNl: 'Nu konden ze ver van het water leven, in de grote varenbossen.' },
    ],
  },
  {
    id: 'cynodont', ago: 2.5e8, when: { en: '250 million years ago', nl: '250 miljoen jaar geleden' },
    name: { en: 'Thrinaxodon', nl: 'Thrinaxodon' }, scene: 'dunes', body: CYNO, act: 'sniff',
    lines: [
      { say: 'Thrinaxodon had its legs more under its body, so it could run better.',
        sayNl: 'Thrinaxodon had zijn poten meer onder zijn lijf, zodat hij beter kon rennen.' },
      { say: 'It may have had whiskers too. Tap it, and it sniffs.',
        sayNl: 'Misschien had hij ook al snorharen. Tik erop, dan snuffelt hij.' },
    ],
  },
  {
    id: 'mammal', ago: 2.05e8, when: { en: 'about 205 million years ago', nl: 'zo’n 205 miljoen jaar geleden' },
    name: { en: 'The first mammals', nl: 'De eerste zoogdieren' }, scene: 'night', body: MAMMAL, act: 'sniff',
    lines: [
      { say: 'This is Morganucodon, one of the first mammals. It was as small as a mouse, with soft fur.',
        sayNl: 'Dit is Morganucodon, een van de eerste zoogdieren. Hij was zo klein als een muis, met een zachte vacht.' },
      { say: 'It lived at the same time as the dinosaurs, and probably came out at night.',
        sayNl: 'Hij leefde tegelijk met de dinosaurussen, en kwam waarschijnlijk vooral ’s nachts tevoorschijn.' },
    ],
  },
  {
    id: 'primate', ago: 5.5e7, when: { en: 'about 55 million years ago', nl: 'zo’n 55 miljoen jaar geleden' },
    name: { en: 'In the trees', nl: 'In de bomen' }, scene: 'trees', body: PRIMATE, act: 'leap', show: 'brain',
    lines: [
      { say: 'Sixty-six million years ago a huge rock from space hit the Earth. The big dinosaurs died out. Small mammals survived.',
        sayNl: 'Zesenzestig miljoen jaar geleden sloeg er een enorme steen uit de ruimte in op de aarde. De grote dinosaurussen stierven uit. Kleine zoogdieren bleven over.' },
      { say: 'Some of them climbed into the trees. Big eyes in front, and hands that can hold on. Tap it, and it jumps.',
        sayNl: 'Sommige klommen in de bomen. Grote ogen aan de voorkant, en handjes die zich kunnen vasthouden. Tik erop, dan springt hij.' },
    ],
  },
  {
    id: 'ape', ago: 2e7, when: { en: 'about 20 million years ago', nl: 'zo’n 20 miljoen jaar geleden' },
    name: { en: 'An ape', nl: 'Een aap zonder staart' }, scene: 'forest', body: APE, act: 'tail', show: 'tail',
    lines: [
      { say: 'Proconsul was an ape. And look: no tail any more.',
        sayNl: 'Proconsul was een mensaap. En kijk: geen staart meer.' },
      { say: 'You have no tail either. But feel the bottom of your back: there is a little tailbone left.',
        sayNl: 'Jij hebt ook geen staart. Maar voel eens onderaan je rug: daar zit nog een klein staartbotje.' },
    ],
  },
  {
    id: 'split', ago: 7e6, when: { en: 'about 7 million years ago', nl: 'zo’n 7 miljoen jaar geleden' },
    name: { en: 'The fork in the road', nl: 'De splitsing' }, scene: 'forest', body: SPLIT, act: 'tree',
    lines: [
      { say: 'Here the family went two ways. One way led to the chimpanzees. The other way led to us.',
        sayNl: 'Hier ging de familie twee kanten op. De ene kant werd de chimpansees. De andere kant werden wij.' },
      { say: 'So a chimpanzee is not our grandfather. It is our cousin: we share the same great-great-grandparents.',
        sayNl: 'Een chimpansee is dus niet onze opa. Het is onze neef: we hebben dezelfde betovergrootouders.' },
    ],
  },
  {
    id: 'lucy', ago: 3.2e6, when: { en: '3.2 million years ago', nl: '3,2 miljoen jaar geleden' },
    name: { en: 'Lucy', nl: 'Lucy' }, scene: 'savanna', body: LUCY, act: 'walk',
    lines: [
      { say: 'This is Lucy. She walked upright, on two legs, just like you.',
        sayNl: 'Dit is Lucy. Zij liep rechtop, op twee benen, net als jij.' },
      { say: 'She was only a bit taller than a metre. Tap her, and she walks. Look at her footprints.',
        sayNl: 'Ze was maar iets groter dan een meter. Tik op haar, dan loopt ze. Kijk naar haar voetstappen.' },
    ],
  },
  {
    id: 'tools', ago: 2.3e6, when: { en: 'about 2.3 million years ago', nl: 'zo’n 2,3 miljoen jaar geleden' },
    name: { en: 'Homo habilis', nl: 'Homo habilis' }, scene: 'savanna', body: HABILIS, act: 'knap', show: 'brain',
    lines: [
      { say: 'Homo habilis had a bigger brain. And made tools from stone.',
        sayNl: 'Homo habilis had een groter brein. En maakte gereedschap van steen.' },
      { say: 'Tap the stones, and knock off a sharp edge.',
        sayNl: 'Tik op de stenen, en sla er een scherp randje af.' },
    ],
  },
  {
    id: 'fire', ago: 1.9e6, when: { en: 'about 1.9 million years ago', nl: 'zo’n 1,9 miljoen jaar geleden' },
    name: { en: 'Homo erectus', nl: 'Homo erectus' }, scene: 'camp', body: ERECTUS, act: 'fire',
    lines: [
      { say: 'Homo erectus had long legs, like yours, and walked all the way out of Africa.',
        sayNl: 'Homo erectus had lange benen, net als jij, en liep helemaal Afrika uit.' },
      { say: 'Later they used fire, to keep warm and to cook. Tap to make a fire.',
        sayNl: 'Later gebruikten ze vuur, om warm te blijven en om te koken. Tik om een vuurtje te maken.' },
    ],
  },
  {
    id: 'sapiens', ago: 3e5, when: { en: 'about 300,000 years ago', nl: 'zo’n 300.000 jaar geleden' },
    name: { en: 'Homo sapiens', nl: 'Homo sapiens' }, scene: 'savanna', body: SAPIENS, act: 'xray', show: 'brain',
    lines: [
      { say: 'And here we are: Homo sapiens. People like you. A round head, a big brain, and a chin.',
        sayNl: 'En hier zijn we: Homo sapiens. Mensen zoals jij. Een rond hoofd, een groot brein, en een kin.' },
      { say: 'Look with the X-ray at how big the brain has become since the little fish.',
        sayNl: 'Kijk met de röntgen hoe groot het brein is geworden sinds dat visje.' },
    ],
  },
  {
    id: 'cave', ago: 4e4, when: { en: 'over 40,000 years ago', nl: 'meer dan 40.000 jaar geleden' },
    name: { en: 'Paintings in a cave', nl: 'Schilderingen in een grot' }, scene: 'cave', body: PAINTER, act: 'hand',
    lines: [
      { say: 'People painted animals on the walls of caves. And their hands, too.',
        sayNl: 'Mensen schilderden dieren op de muren van grotten. En hun handen.' },
      { say: 'Put your hand on the wall. Tap it.',
        sayNl: 'Leg jouw hand op de muur. Tik maar.' },
    ],
  },
  {
    id: 'now', ago: 0, when: { en: 'now', nl: 'nu' },
    name: { en: 'And you', nl: 'En jij' }, scene: 'now', body: SAPIENS, act: 'clock',
    lines: [
      { say: 'If all the time since the first cell were one day, people like us came only in the last seven seconds.',
        sayNl: 'Als alle tijd sinds de eerste cel één dag was, kwamen mensen zoals wij pas in de laatste zeven seconden.' },
      { say: 'Every animal on the way was the child of the one before. A tiny bit different, every time.',
        sayNl: 'Elk dier onderweg was het kind van het dier ervoor. Elke keer een heel klein beetje anders.' },
      { say: 'And it has not stopped. Living things are still changing, today. Even us.',
        sayNl: 'En het is niet gestopt. Alles wat leeft verandert nog steeds, ook vandaag. Zelfs wij.' },
    ],
  },
];

/**
 * The seconds the story says: if the time since the first life (3.7 billion years is used, the
 * middle of the usual 3.5 to 3.8) were one day, how many seconds before midnight would Homo sapiens
 * appear. 300,000 / 3.7e9 x 86,400 = 7.0 seconds, which is what "de laatste zeven seconden" says.
 */
export function secondsInADay(ago: number, first = 3.7e9): number {
  return (ago / first) * 86400;
}

/**
 * How peppered moths show the way it works (`moths.ts`). In the industrial towns of England in the
 * 1800s soot turned the tree trunks black; pale moths were easy for birds to spot and dark ones were
 * not, and by the 1890s nearly all the moths round Manchester were dark. When the air was cleaned up
 * in the 1900s the pale ones came back. It is one of the best-studied examples there is.
 */
export const MOTH_LINES = {
  intro: { say: 'First: how does an animal change? You are a bird, looking for moths on the trees.',
    sayNl: 'Eerst: hoe verandert een dier? Jij bent een vogel die vlindertjes zoekt op de bomen.' },
  soot: { say: 'Long ago in England, smoke from the factories turned the trees black. Tap every moth you can see.',
    sayNl: 'Lang geleden werden in Engeland de bomen zwart van de rook uit de fabrieken. Tik elk vlindertje dat je ziet.' },
  next: { say: 'The moths you did not find have babies. Look: the next moths are darker.',
    sayNl: 'De vlindertjes die je niet vond, krijgen jongen. Kijk: de nieuwe vlindertjes zijn donkerder.' },
  again: { say: 'Once more. Tap the moths you can see.',
    sayNl: 'Nog een keer. Tik de vlindertjes die je ziet.' },
  done: { say: 'That is how it works. Whoever fits their place best has the most babies. Small changes, again and again, for a very long time.',
    sayNl: 'Zo werkt het. Wie het beste past, krijgt de meeste jongen. Kleine veranderingen, steeds weer, heel lang.' },
  go: { say: 'Now we go all the way back to the very beginning. Drag the time line, or tap the arrow.',
    sayNl: 'Nu gaan we helemaal terug naar het allereerste begin. Sleep over de tijdlijn, of tik op het pijltje.' },
};
