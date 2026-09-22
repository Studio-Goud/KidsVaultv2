/**
 * De diepzee - straight down, from the waves to the deepest place there is.
 *
 * The second journey, and the one that proves the format carries more than planets. Nothing here
 * is Planetarium's: the pictures are photographs from Wikimedia Commons, three of the stops are
 * drawn because no photograph of them would read, the craft is a submersible and the gauge counts
 * metres down instead of millions of kilometres out. What it shares with `solar.ts` is every line
 * of engine.
 *
 * The photographs are the same ones the animal book uses, which is why they are already checked:
 * each one's licence and photographer came out of `public/animals/animals.json`, and the credit
 * line here carries both, because several of them are share-alike.
 *
 * Depths are the ones the creature is actually found at rather than the deepest it has ever been
 * recorded, because the point of the gauge is the sense of going down, not a record.
 */

import type { Journey, Stop } from '../journey/types';
import { angler, trench, wreck } from './deepart';

const at = (i: number, n: number): number => i / (n - 1);

const S: Array<Omit<Stop, 'at'>> = [
  {
    id: 'surface', title: 'The surface', titleNl: 'De zeespiegel', tone: '#7fd0e8', mark: 0,
    picture: { kind: 'remote', path: 'a/a3/Green_sea_turtle_%28Chelonia_mydas%29_Moorea.jpg', credit: 'Charles J. Sharp, CC BY-SA 4.0' },
    say: 'A sea turtle breathes air, so it always has to come back up.',
    sayNl: 'Een zeeschildpad ademt lucht. Hij moet dus altijd weer naar boven.',
    more: [
      { say: 'She lays her eggs on the same beach she was born on.',
        sayNl: 'Ze legt haar eieren op hetzelfde strand waar ze zelf uit het ei kwam.' },
      { say: 'A green turtle can live longer than your grandmother.',
        sayNl: 'Een soepschildpad kan ouder worden dan je oma.' },
    ],
  },
  {
    id: 'reef', title: 'The reef', titleNl: 'Het rif', tone: '#43b5d6', mark: 15,
    picture: { kind: 'remote', path: 'f/f6/Clown_fish_in_the_Andaman_Coral_Reef.jpg', credit: 'Ritiks, CC BY-SA 3.0' },
    say: 'A clownfish lives in among the stinging arms of an anemone. It is the one fish they do not sting.',
    sayNl: 'Een anemoonvis woont tussen de brandende armen van een zeeanemoon. Hij is de enige vis die ze niet steken.',
    more: [
      { say: 'The anemone gets something back: the fish chases off whatever comes to nibble at it.',
        sayNl: 'De anemoon krijgt er iets voor terug: de vis jaagt weg wat aan haar komt knabbelen.' },
      { say: 'This close to the top there is still plenty of sunlight, which is why a reef has colours at all.',
        sayNl: 'Zo dicht bij de top is er nog volop zonlicht, en daarom heeft een rif kleuren.' },
    ],
  },
  {
    id: 'shark', title: 'The shark', titleNl: 'De haai', tone: '#2a87ad', mark: 60,
    picture: { kind: 'remote', path: '5/56/White_shark.jpg', credit: 'Terry Goss, CC BY 2.5' },
    say: 'A great white can grow to about six metres. That is longer than a car.',
    sayNl: 'Een witte haai kan zo’n zes meter lang worden. Dat is langer dan een auto.',
    more: [
      { say: 'It smells its way about: a shark can pick up a scent from a long way off.',
        sayNl: 'Hij ruikt zijn weg: een haai pikt een geur van heel ver op.' },
      { say: 'Its teeth keep growing back. A shark gets through thousands in a lifetime.',
        sayNl: 'Zijn tanden groeien steeds terug. Een haai versleet er duizenden in zijn leven.' },
    ],
  },
  {
    id: 'light', title: 'Where the light stops', titleNl: 'Waar het licht ophoudt', tone: '#1c5f84', mark: 200,
    picture: { kind: 'remote', path: '9/98/Mola_mola.jpg', credit: 'NOAA, publiek domein' },
    say: 'Two hundred metres down is where plants give up. Below this nothing grows.',
    sayNl: 'Op tweehonderd meter geven planten het op. Hieronder groeit niets meer.',
    more: [
      { say: 'This is a sunfish, the heaviest bony fish in the sea.',
        sayNl: 'Dit is een maanvis, de zwaarste beenvis van de zee.' },
      { say: 'It dives down into the cold and then lies on its side at the top to warm up again.',
        sayNl: 'Hij duikt de kou in en gaat daarna boven op zijn zij liggen om weer op te warmen.' },
    ],
  },
  {
    id: 'twilight', title: 'The twilight', titleNl: 'De schemerzone', tone: '#12455f', mark: 500,
    picture: { kind: 'remote', path: '4/4a/Nautilus_pompilius_%28detail%29.jpg', credit: 'Hans Hillewaert, CC BY-SA 4.0' },
    say: 'A nautilus lives in a shell with rooms in it, and it has hardly changed in millions of years.',
    sayNl: 'Een nautilus woont in een schelp met kamertjes, en hij is in miljoenen jaren nauwelijks veranderd.',
    more: [
      { say: 'It fills the rooms with gas to rise and with water to sink.',
        sayNl: 'Hij vult de kamertjes met gas om te stijgen en met water om te zakken.' },
      { say: 'At night it comes up to feed and before morning it goes back down.',
        sayNl: "'s Nachts komt hij omhoog om te eten en voor de ochtend zakt hij weer." },
    ],
  },
  {
    id: 'whale', title: 'The sperm whale', titleNl: 'De potvis', tone: '#0d3149', mark: 1000,
    picture: { kind: 'remote', path: 'b/b1/Mother_and_baby_sperm_whale.jpg', credit: 'Gabriel Barathieu, CC BY-SA 2.0' },
    say: 'A sperm whale dives deeper than a kilometre and can stay under for more than an hour.',
    sayNl: 'Een potvis duikt dieper dan een kilometer en kan meer dan een uur onder water blijven.',
    more: [
      { say: 'It cannot see a thing down here. It hunts by sound, and listens for the echo.',
        sayNl: 'Hij ziet hier niets. Hij jaagt met geluid en luistert naar de echo.' },
      { say: 'It is the loudest animal there is.',
        sayNl: 'Het is het luidste dier dat er bestaat.' },
    ],
  },
  {
    id: 'squid', title: 'The giant squid', titleNl: 'De reuzeninktvis', tone: '#0a2740', mark: 1500,
    picture: { kind: 'remote', path: '3/3c/Giant_squid_Ranheim.jpg', credit: 'NTNU Vitenskapsmuseet, CC BY 2.0' },
    say: 'The giant squid has an eye the size of a football, the biggest eye of any animal.',
    sayNl: 'De reuzeninktvis heeft een oog zo groot als een voetbal, het grootste oog van alle dieren.',
    more: [
      { say: 'It needs an eye that big to catch what little light is left, and to spot a sperm whale coming.',
        sayNl: 'Zo’n groot oog heeft hij nodig om het laatste beetje licht te vangen, en om een potvis aan te zien komen.' },
      { say: 'Nobody had ever filmed a live one until 2012.',
        sayNl: 'Tot 2012 had nog nooit iemand er een levende gefilmd.' },
    ],
  },
  {
    id: 'wreck', title: 'The Titanic', titleNl: 'De Titanic', tone: '#0a2036', mark: 3800,
    picture: { kind: 'drawn', art: wreck },
    say: 'The Titanic lies here, at three thousand eight hundred metres, since 1912.',
    sayNl: 'Hier ligt de Titanic, op drieduizend achthonderd meter, sinds 1912.',
    more: [
      { say: 'It was not found until 1985, because nobody could get this deep before.',
        sayNl: 'Hij werd pas in 1985 gevonden, omdat niemand er eerder zo diep bij kon.' },
      { say: 'It is dark here and always about four degrees, all year round.',
        sayNl: 'Het is hier donker en altijd ongeveer vier graden, het hele jaar door.' },
    ],
  },
  {
    id: 'dark', title: 'The black deep', titleNl: 'Het zwarte diep', tone: '#06182b', mark: 6000,
    picture: { kind: 'drawn', art: angler },
    say: 'No sunlight has ever been here. The only light is what the animals bring themselves.',
    sayNl: 'Hier is nooit zonlicht geweest. Het enige licht is wat de dieren zelf meebrengen.',
    more: [
      { say: 'An anglerfish carries a little lamp on a rod above her head, to fish with.',
        sayNl: 'Een hengelaarsvis draagt een lampje aan een hengel boven haar kop, om mee te vissen.' },
      { say: 'The light is made by bacteria living inside the lamp.',
        sayNl: 'Het licht wordt gemaakt door bacteriën die in het lampje wonen.' },
    ],
  },
  {
    id: 'challenger', title: 'The Challenger Deep', titleNl: 'De Challengerdiepte', tone: '#020c18', mark: 10935,
    picture: { kind: 'drawn', art: trench },
    say: 'This is the deepest place in the sea: nearly eleven kilometres straight down.',
    sayNl: 'Dit is de diepste plek van de zee: bijna elf kilometer recht naar beneden.',
    more: [
      { say: 'Mount Everest would fit in here with water still above it.',
        sayNl: 'De Mount Everest zou er in passen en er zou nog water boven staan.' },
      { say: 'More people have walked on the moon than have been down here.',
        sayNl: 'Er hebben meer mensen op de maan gelopen dan dat er hier beneden zijn geweest.' },
    ],
  },
];

export const DEEP: Journey = {
  id: 'diepzee',
  title: 'All the way down', titleNl: 'De diepzee',
  opening: 'Hatch shut. We are going straight down, and we stop wherever there is something to see.',
  openingNl: 'Luik dicht. We gaan recht naar beneden, en we stoppen overal waar iets te zien is.',
  closing: 'There is nowhere deeper than this. Everything above us is sea.',
  closingNl: 'Dieper dan dit bestaat niet. Alles boven ons is zee.',
  craft: 'sub', axis: 'down',
  unit: 'metres down', unitNl: 'meter diep',
  stops: S.map((s, i) => ({ ...s, at: at(i, S.length) })),
};
