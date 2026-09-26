/**
 * De tijd van de dino's - straight down through the ground, and back through time.
 *
 * The third journey. You ride a drill, and the deeper it goes the older the rock and the further
 * back you are: that is how the ground really works, and it is also how the people who found
 * these animals found them. The gauge counts millions of years ago.
 *
 * Every picture but one is a real fossil in a real museum, from Wikimedia Commons with the
 * photographer and licence on screen. That is a choice, not a shortcut: nobody has ever seen a
 * living dinosaur, and what we know of them is bones. A painted dinosaur beside a photographed one
 * would teach that the painting is the fact (`docs/research.md` §2.3). The one drawn stop is the
 * impact, which nobody photographed.
 *
 * Three stops are chosen because they are close to home: Trix, the Tyrannosaurus in Naturalis in
 * Leiden; the Mosasaurus, named after the Maas and first dug up by Maastricht; and the Iguanodons
 * from the coal mine at Bernissart in Belgium.
 *
 * The ages are the usual rounded ones for each animal (Trix and Triceratops about 67 million
 * years, Stegosaurus about 152, Herrerasaurus about 231). The first stop is the last ice age,
 * twenty thousand years ago, which the gauge shows as zero: it counts in millions.
 */

import type { Journey, Stop } from '../journey/types';
import { impact } from './dinoart';

const at = (i: number, n: number): number => i / (n - 1);

const S: Array<Omit<Stop, 'at'>> = [
  {
    id: 'mammoth', title: 'The mammoth', titleNl: 'De mammoet', tone: '#b9d3dc', mark: 0.02,
    picture: { kind: 'remote', path: '1/17/Mammoth_skeleton_01.JPG', credit: 'HTO, publiek domein' },
    say: 'In the last ice age there was no North Sea. You could walk to England, and mammoths lived here.',
    sayNl: 'In de laatste ijstijd was er geen Noordzee. Je kon naar Engeland lopen, en hier liepen mammoeten.',
    more: [
      { say: 'Fishermen still pull mammoth bones and teeth out of the North Sea in their nets.',
        sayNl: 'Vissers halen nog steeds botten en kiezen van mammoeten uit de Noordzee, in hun netten.' },
      { say: 'The last mammoths lived on an island near the North Pole, when the pyramids in Egypt were already standing.',
        sayNl: 'De laatste mammoeten leefden op een eiland bij de Noordpool, toen de piramides in Egypte er al stonden.' },
    ],
  },
  {
    id: 'impact', title: 'The big bang', titleNl: 'De grote klap', tone: '#6a3a36', mark: 66,
    picture: { kind: 'drawn', art: impact },
    say: 'Sixty-six million years ago a stone about ten kilometres across fell from the sky, near Mexico.',
    sayNl: 'Zesenzestig miljoen jaar geleden viel er een steen van zo’n tien kilometer groot uit de lucht, bij Mexico.',
    more: [
      { say: 'Dust hid the sun for years. Plants died, and after them the big dinosaurs.',
        sayNl: 'Stof hield jarenlang de zon tegen. Planten gingen dood, en daarna de grote dino’s.' },
      { say: 'Not all of them, though. The dinosaurs that made it are still flying around: birds.',
        sayNl: 'Maar niet allemaal. De dino’s die het overleefden, vliegen nog steeds rond: dat zijn de vogels.' },
    ],
  },
  {
    id: 'trex', title: 'Trix the T. rex', titleNl: 'Trix de T. rex', tone: '#4f6e3c', mark: 67,
    picture: { kind: 'remote', path: 'e/ea/Naturalis-Trix-Trex-1.jpg', credit: 'Hay Kranen, CC BY 4.0' },
    say: 'This is Trix, a Tyrannosaurus rex. She stands in Naturalis, the museum in Leiden.',
    sayNl: 'Dit is Trix, een Tyrannosaurus rex. Ze staat in Naturalis, het museum in Leiden.',
    more: [
      { say: 'A T. rex was about twelve metres long, as long as a bus.',
        sayNl: 'Een T. rex was zo’n twaalf meter lang, zo lang als een bus.' },
      { say: 'Its biggest teeth were as long as a banana.',
        sayNl: 'Zijn grootste tanden waren zo lang als een banaan.' },
    ],
  },
  {
    id: 'triceratops', title: 'Triceratops', titleNl: 'Triceratops', tone: '#66823f', mark: 67.5,
    picture: { kind: 'remote', path: '8/89/Triceratops_skeleton_at_National_Science_Museum_in_South_Korea.jpg', credit: 'Yoo Chung, CC BY-SA 3.0' },
    say: 'Triceratops means three-horned face. It ate plants, and it lived at the same time as T. rex.',
    sayNl: 'Triceratops betekent gezicht met drie hoorns. Hij at planten, en hij leefde in dezelfde tijd als de T. rex.',
    more: [
      { say: 'Its head alone was more than two metres long, one of the biggest heads any land animal has had.',
        sayNl: 'Alleen zijn kop was al ruim twee meter lang, een van de grootste koppen die een landdier ooit had.' },
      { say: 'The wide collar at the back of its head was made of bone.',
        sayNl: 'De brede kraag achter op zijn kop was van bot.' },
    ],
  },
  {
    id: 'mosasaurus', title: 'The Mosasaurus', titleNl: 'De Mosasaurus', tone: '#2f6f8f', mark: 68,
    picture: { kind: 'remote', path: 'a/a9/Mosasaurus_hoffmannii_-_skeleton.jpg', credit: 'Ghedoghedo, CC BY-SA 3.0' },
    say: 'Limburg was under the sea then. The first Mosasaurus was dug up near Maastricht, and it is named after the Maas.',
    sayNl: 'Limburg lag toen onder de zee. De eerste Mosasaurus werd bij Maastricht opgegraven, en hij is naar de Maas genoemd.',
    more: [
      { say: 'It was not a dinosaur but a sea reptile, about fifteen metres long.',
        sayNl: 'Het was geen dino maar een zeereptiel, zo’n vijftien meter lang.' },
      { say: 'The soldiers of Napoleon took its skull to Paris, and it is still there.',
        sayNl: 'De soldaten van Napoleon namen zijn schedel mee naar Parijs, en daar ligt hij nog steeds.' },
    ],
  },
  {
    id: 'pteranodon', title: 'Pteranodon', titleNl: 'Pteranodon', tone: '#4f86a6', mark: 86,
    picture: { kind: 'remote', path: 'f/f4/Pteranodon_longiceps_skeleton.jpg', credit: 'Mira Mechtley, CC BY-SA 2.0' },
    say: 'Pteranodon flew over the sea on wings up to six metres wide.',
    sayNl: 'Pteranodon vloog over de zee met vleugels van wel zes meter breed.',
    more: [
      { say: 'It was a flying reptile, not a dinosaur and not a bird.',
        sayNl: 'Het was een vliegend reptiel, geen dino en geen vogel.' },
      { say: 'Its name means wing without teeth: it swallowed its fish whole.',
        sayNl: 'Zijn naam betekent vleugel zonder tanden: hij slikte zijn vis in één keer door.' },
    ],
  },
  {
    id: 'iguanodon', title: 'Iguanodon', titleNl: 'Iguanodon', tone: '#5b7d3a', mark: 125,
    picture: { kind: 'remote', path: '0/0b/Iguanodon2_28-12-2007_14-20-05.jpg', credit: 'Paul Hermans, CC BY-SA 3.0' },
    say: 'In a coal mine in Belgium, miners found more than thirty Iguanodons at once.',
    sayNl: 'In een kolenmijn in België vonden mijnwerkers meer dan dertig Iguanodons tegelijk.',
    more: [
      { say: 'They stand in the museum in Brussels, still in a row.',
        sayNl: 'Ze staan in het museum in Brussel, nog steeds op een rij.' },
      { say: 'It had a spike on each thumb. The first people to draw it put the spike on its nose.',
        sayNl: 'Hij had een punt op elke duim. De eerste mensen die hem tekenden, zetten die punt op zijn neus.' },
    ],
  },
  {
    id: 'archaeopteryx', title: 'Archaeopteryx', titleNl: 'Archaeopteryx', tone: '#b59d68', mark: 150,
    picture: { kind: 'remote', path: '2/2a/Berlin_Archaeopteryx.jpg', credit: 'Emily Willoughby, CC BY-SA 4.0' },
    say: 'Look closely: in the stone you can see feathers. Archaeopteryx was a dinosaur with wings.',
    sayNl: 'Kijk goed: in de steen zie je veren. Archaeopteryx was een dino met vleugels.',
    more: [
      { say: 'It was about the size of a crow, but it had teeth and claws on its wings.',
        sayNl: 'Hij was ongeveer zo groot als een kraai, maar hij had tanden en klauwtjes aan zijn vleugels.' },
      { say: 'It was found in Germany, in stone so fine that even the feathers were kept.',
        sayNl: 'Hij werd gevonden in Duitsland, in steen die zo fijn is dat zelfs de veren bewaard bleven.' },
    ],
  },
  {
    id: 'stegosaurus', title: 'Stegosaurus', titleNl: 'Stegosaurus', tone: '#7e8f45', mark: 152,
    picture: { kind: 'remote', path: 'd/d8/Stegosaurus_skeleton_at_American_Museum_of_Natural_History.jpg', credit: 'Vicpeters, CC BY 4.0' },
    say: 'Stegosaurus had big plates along its back and spikes on its tail to keep attackers off.',
    sayNl: 'Stegosaurus had grote platen op zijn rug en punten op zijn staart om aanvallers weg te houden.',
    more: [
      { say: 'T. rex lived closer to us in time than to Stegosaurus.',
        sayNl: 'De T. rex leefde dichter bij ons in de tijd dan bij Stegosaurus.' },
      { say: 'For such a big animal it had a very small brain.',
        sayNl: 'Voor zo’n groot dier had hij heel kleine hersenen.' },
    ],
  },
  {
    id: 'giraffatitan', title: 'The long neck', titleNl: 'De langnek', tone: '#8a9a5a', mark: 154,
    picture: { kind: 'remote', path: '1/11/Giraffatitan_brancai_Naturkundemuseum_Berlin.jpg', credit: 'Axel Mauruszat, naamsvermelding' },
    say: 'This long neck stands in a museum in Berlin. It is the tallest dinosaur skeleton in the world.',
    sayNl: 'Deze langnek staat in een museum in Berlijn. Het is het hoogste dinoskelet ter wereld.',
    more: [
      { say: 'It is called Giraffatitan, giant giraffe, because it ate from the tops of trees.',
        sayNl: 'Hij heet Giraffatitan, reuzengiraf, omdat hij uit de toppen van de bomen at.' },
      { say: 'Its bones were dug up in Africa, in Tanzania, more than a hundred years ago.',
        sayNl: 'Zijn botten werden in Afrika opgegraven, in Tanzania, meer dan honderd jaar geleden.' },
    ],
  },
  {
    id: 'herrerasaurus', title: 'One of the first', titleNl: 'Een van de eersten', tone: '#b0663a', mark: 231,
    picture: { kind: 'remote', path: '0/00/FMNH_Herrerasaurus_skeleton.jpg', credit: 'Zissoudisctrucker, CC BY-SA 4.0' },
    say: 'Herrerasaurus is one of the very first dinosaurs. It lived two hundred and thirty million years ago.',
    sayNl: 'Herrerasaurus is een van de allereerste dino’s. Hij leefde tweehonderddertig miljoen jaar geleden.',
    more: [
      { say: 'Back then all the land on Earth was stuck together in one big continent.',
        sayNl: 'Toen zat al het land op aarde nog aan elkaar vast, in één groot werelddeel.' },
      { say: 'It is named after the goatherd in Argentina who found its bones.',
        sayNl: 'Hij is genoemd naar de geitenhoeder in Argentinië die zijn botten vond.' },
    ],
  },
];

export const DINO: Journey = {
  id: 'dino',
  title: 'The age of the dinosaurs', titleNl: 'De tijd van de dino’s',
  opening: 'The deeper we drill, the older the ground and the further back in time we go. Hold on.',
  openingNl: 'Hoe dieper we boren, hoe ouder de grond en hoe verder we teruggaan in de tijd. Hou je vast.',
  closing: 'Further back than this there were no dinosaurs yet. Everything we saw, we know because someone found a bone.',
  closingNl: 'Nog verder terug waren er nog geen dino’s. Alles wat we zagen, weten we omdat iemand een bot vond.',
  craft: 'drill', axis: 'down',
  unit: 'million years ago', unitNl: 'miljoen jaar geleden',
  stops: S.map((s, i) => ({ ...s, at: at(i, S.length) })),
};
