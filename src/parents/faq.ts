/**
 * The questions a parent actually asks, and the answers as they really are.
 *
 * This is the page that has to sell the app and the page that has to be honest, and those two
 * jobs pull against each other exactly once: where somebody would like to read "pedagogisch
 * goedgekeurd". It does not say that, because no pedagogue has looked at it. What it says instead
 * is what each thing practises, where that comes from, and where it stops - and that turns out to
 * be a better answer for the parent this app is for.
 *
 * Rules I have kept to in here:
 *
 *  - no claim about what a child will learn, only about what a thing practises;
 *  - every number that comes from research says whose research, and every number that is mine
 *    says it is mine;
 *  - nothing is promised that is not built. Where something is not built yet, it says so in the
 *    same breath rather than in a footnote.
 *
 * The list of claims that still need an (ortho)pedagoog to look at them is `docs/claims.md`. If
 * you are reading this file to change a claim in it, read that one first.
 */

import { CATALOG, type Domain } from '../platform/catalog';
import { NL } from '../util/lang';

export interface Question {
  id: string;
  q: string;
  qNl: string;
  /** one string per paragraph */
  a: string[];
  aNl: string[];
}

export const QUESTIONS: Question[] = [
  {
    id: 'why',
    q: 'What is this for?',
    qNl: 'Waar is dit voor?',
    a: [
      'Suri is a hub of small things to do, each of which practises something real: hearing the sounds in a word, holding a beat, counting out, reading a clock, finding your way round a map, working out why a circuit will not light.',
      'It exists because most of what is on offer for this age is built to be opened again tomorrow rather than to be any good today. Nothing in here is trying to get your child to come back. There is no streak, no daily reward, no badge you lose by stopping.',
    ],
    aNl: [
      'Suri is een verzameling kleine dingen om te doen, die elk iets echts oefenen: de klanken in een woord horen, de tel vasthouden, uittellen, de klok lezen, de weg vinden op een kaart, uitzoeken waarom een lampje niet brandt.',
      'Het bestaat omdat het meeste aanbod voor deze leeftijd gebouwd is om morgen weer geopend te worden, niet om vandaag goed te zijn. Niets hierin probeert je kind terug te lokken. Er is geen reeks die je kwijtraakt, geen dagelijkse beloning, geen badge die vervalt als je stopt.',
    ],
  },
  {
    id: 'learn',
    q: 'Will my child learn anything?',
    qNl: 'Leert mijn kind hier iets van?',
    a: [
      'Each thing says what it practises, and that is the most I can promise. "Practises" is a claim about what a child does while they are playing. "Learns" is a claim about what is left over afterwards, and that is a claim you can only make by measuring it.',
      'Nobody has measured this app. So: the games practise what they say they practise, the facts in them are true and checked, and beyond that I am not going to tell you something I do not know.',
    ],
    aNl: [
      'Elk onderdeel zegt zelf wat het oefent, en verder ga ik niet. "Oefent" is een uitspraak over wat een kind doet terwijl het speelt. "Leert" is een uitspraak over wat er daarna van overblijft, en die kun je alleen doen als je het gemeten hebt.',
      'Deze app is niet gemeten. Dus: de spellen oefenen wat ze zeggen te oefenen, de feiten erin kloppen en zijn nagekeken, en daarbuiten ga ik je niets vertellen wat ik niet weet.',
    ],
  },
  {
    id: 'approved',
    q: 'Is it approved by an educational specialist?',
    qNl: 'Is het pedagogisch goedgekeurd?',
    a: [
      'No. No pedagogue, orthopedagogue or speech therapist has tested this app, and until one has, it will not say that it has.',
      'What it is built on is published research about children of this age, which is written out in full in the project’s own notes, including where that research does not reach. The advice on screen time below, for example, is the Nederlands Jeugdinstituut’s for two to six, and mine for seven and up - and the app says which is which, on the screen where you set it.',
    ],
    aNl: [
      'Nee. Geen pedagoog, orthopedagoog of logopedist heeft deze app getoetst, en tot dat wel zo is, beweert hij dat ook niet.',
      'Waar hij wél op gebouwd is, is gepubliceerd onderzoek over kinderen van deze leeftijd, dat volledig is uitgeschreven in de notities van het project, inclusief waar dat onderzoek ophoudt. Het advies over schermtijd hieronder bijvoorbeeld is dat van het Nederlands Jeugdinstituut voor twee tot zes, en van mij voor zeven en ouder - en de app zegt erbij welke van de twee je leest, op het scherm waar je het instelt.',
    ],
  },
  {
    id: 'howlong',
    q: 'How long should my child be on it?',
    qNl: 'Hoe lang mag mijn kind erop?',
    a: [
      'The Nederlands Jeugdinstituut gives five to ten minutes at a time and up to half an hour a day for two to four, and ten to fifteen minutes and up to an hour for four to six. Those are the numbers this app starts with, and you can set them lower.',
      'For seven and up there is no such guidance, so the numbers you see are mine: I let them rise gently rather than match a guideline that does not exist. The app marks them as mine on the screen where you set them.',
      'The limit is a limit on this app, not on screens. Whether that half hour is the whole of your child’s screen time today is something only you can see.',
    ],
    aNl: [
      'Het Nederlands Jeugdinstituut houdt voor twee tot vier jaar vijf tot tien minuten per keer aan en maximaal een half uur per dag, en voor vier tot zes tien tot vijftien minuten en maximaal een uur. Met die getallen begint deze app, en je kunt ze lager zetten.',
      'Voor zeven jaar en ouder bestaat zo’n richtlijn niet, dus de getallen die je daar ziet zijn van mij: ik laat ze rustig oplopen in plaats van te doen alsof ik een richtlijn volg die er niet is. De app zegt erbij dat ze van mij zijn, op het scherm waar je ze instelt.',
      'De limiet geldt voor deze app, niet voor schermen. Of dat halve uur ook de hele schermtijd van vandaag is, kun alleen jij zien.',
    ],
  },
  {
    id: 'warning',
    q: 'Why is there no warning before time is up?',
    qNl: 'Waarom komt er geen waarschuwing vlak voor het einde?',
    a: [
      'Because the research says it makes the handover worse, not better. Hiniker and colleagues (CHI 2016) found that a "two more minutes" warning made stopping harder for children of one to five, while a natural endpoint - the thing being finished - made it easier.',
      'So that is what happens here. When there is less left than one more go, the next thing your child picks is announced as the last one, it is played to its own end rather than cut off, and then the same closing every time.',
      'If you want the warning anyway, you can switch it on. It is off by default, and that default is the researched one rather than the intuitive one.',
    ],
    aNl: [
      'Omdat onderzoek zegt dat het de overdracht moeilijker maakt in plaats van makkelijker. Hiniker en collega’s (CHI 2016) vonden dat een waarschuwing van "nog twee minuten" het stoppen juist zwaarder maakte bij kinderen van één tot vijf, terwijl een natuurlijk eindpunt - het ding dat af is - het lichter maakte.',
      'Dus dat is wat hier gebeurt. Als er minder over is dan één keer spelen, wordt het volgende dat je kind kiest aangekondigd als de laatste, dat wordt tot zijn eigen einde gespeeld in plaats van afgekapt, en daarna elke dag dezelfde afsluiting.',
      'Wil je de waarschuwing toch, dan kun je hem aanzetten. Hij staat uit, en die stand is de onderzochte en niet de vanzelfsprekende.',
    ],
  },
  {
    id: 'data',
    q: 'What happens to my child’s data?',
    qNl: 'Wat gebeurt er met de gegevens van mijn kind?',
    a: [
      'Nothing leaves this device. There is no account, no login, no analytics, no advertising identifier, and no third-party tracking of any kind. The name and age you fill in are stored on the phone and are never sent anywhere.',
      'Two things do go out over the internet, and neither carries anything about your child: the photographs in the animal book and on the dive are fetched from Wikimedia Commons as they are needed, and that is it.',
      'Clearing the app’s data on your phone clears everything, including the code on this screen.',
    ],
    aNl: [
      'Er gaat niets van dit toestel af. Geen account, geen inlog, geen analytics, geen advertentie-id, geen volgsoftware van derden. De naam en de leeftijd die je invult staan op de telefoon en worden nergens heen gestuurd.',
      'Twee dingen gaan wél het internet op, en geen van beide draagt iets over je kind mee: de foto’s in het dierenboek en op de duik worden opgehaald bij Wikimedia Commons op het moment dat ze nodig zijn. Dat is alles.',
      'De gegevens van de app wissen op je telefoon wist alles, inclusief de code van dit scherm.',
    ],
  },
  {
    id: 'ads',
    q: 'Why are there no adverts?',
    qNl: 'Waarom staan er geen advertenties in?',
    a: [
      'Because a child of four cannot tell an advert from the rest of the screen, so an advert in a children’s app is not an offer, it is a trick. The same goes for the things that look like games and are really a shop.',
      'There is nothing in here to buy, nothing to unlock with money, no currency that can be topped up, and nothing that gets easier if you pay. The subscription is the whole of it.',
    ],
    aNl: [
      'Omdat een kind van vier een advertentie niet van de rest van het scherm kan onderscheiden. Een advertentie in een kinderapp is dus geen aanbod maar een truc. Dat geldt net zo goed voor de dingen die op een spel lijken en eigenlijk een winkel zijn.',
      'Er valt hierbinnen niets te kopen, niets met geld vrij te spelen, er is geen munt die je kunt bijvullen, en niets wordt makkelijker als je betaalt. Het abonnement is het hele verhaal.',
    ],
  },
  {
    id: 'price',
    q: 'What does €3.99 a month pay for?',
    qNl: 'Waar gaat die €3,99 per maand naartoe?',
    a: [
      'The making of it: the games, the drawings, the voice, the checking of every fact, and the part nobody sees, which is keeping sixteen things working on every phone shape there is.',
      'It is also the answer to the previous question. An app for children pays for itself in one of two ways, and the other one is your child.',
      'Billing is not built yet. When it is, it will run through the App Store or Google Play, so cancelling happens where you cancel everything else. Nothing in the app asks for a card.',
    ],
    aNl: [
      'Naar het maken ervan: de spellen, de tekeningen, de stem, het nakijken van elk feit, en het deel dat niemand ziet, namelijk zestien dingen werkend houden op elk telefoonformaat dat er is.',
      'Het is ook het antwoord op de vorige vraag. Een kinderapp verdient zichzelf op één van twee manieren terug, en de andere manier is je kind.',
      'Het afrekenen is nog niet gebouwd. Straks loopt het via de App Store of Google Play, zodat opzeggen gaat waar je alles opzegt. Nergens in de app wordt om een pasje gevraagd.',
    ],
  },
  {
    id: 'twoyears',
    q: 'My child is two. Is there anything here yet?',
    qNl: 'Mijn kind is twee. Valt hier al iets te doen?',
    a: [
      'Some of it, and the app is honest about which. Fill in an age of three or under and the things that can take a simpler shape do: Opgraving, for instance, drops its tools, its rules and its question, and becomes rubbing a stone with your finger until a fossil comes out.',
      'That is not everything. Most of what is in here is built for four and up, and a card that says 5-9 means it. The age on each card is the range it has something to offer, not the range it will tolerate.',
    ],
    aNl: [
      'Een deel, en de app is er eerlijk over welk deel. Vul je een leeftijd van drie of jonger in, dan nemen de dingen die dat kunnen hun eenvoudigste vorm aan: Opgraving laat bijvoorbeeld het gereedschap, de regels en de vraag vallen, en wordt wrijven over een steen met je vinger tot er een fossiel uit komt.',
      'Dat is niet alles. Het meeste hierin is voor vier jaar en ouder gebouwd, en een kaartje waar 5-9 op staat meent dat. De leeftijd op elk kaartje is het bereik waarin het iets te bieden heeft, niet het bereik waarin het te verdragen is.',
    ],
  },
  {
    id: 'older',
    q: 'My child is nine. Is this not too babyish?',
    qNl: 'Mijn kind is negen. Is dit niet te kinderachtig?',
    a: [
      'Some of it is. That is why the cards carry a range at both ends and why you can switch subjects off: a nine-year-old who is sent to Letterbos will close the app, and they will be right.',
      'What is built for that end: Moonshot, where you stage a rocket yourself and it fails for the reason a real one would; Cloudhopper, which is air traffic control; Planetarium; Stroomkring, which is circuits; the animal book, which is a reference work with a few thousand real animals in it; and the discovery journeys.',
    ],
    aNl: [
      'Een deel wel. Daarom staat er op de kaartjes een bereik met twee kanten en kun je onderwerpen uitzetten: een negenjarige die naar Letterbos gestuurd wordt sluit de app, en terecht.',
      'Wat wél voor die kant gebouwd is: Moonshot, waar je zelf een raket in trappen bouwt en hij mislukt om de reden waarom een echte dat zou doen; Cloudhopper, dat luchtverkeersleiding is; Planetarium; Stroomkring, over schakelingen; het dierenboek, dat een naslagwerk is met een paar duizend echte dieren; en de ontdekreizen.',
    ],
  },
  {
    id: 'voice',
    q: 'Why does it talk so much?',
    qNl: 'Waarom praat de app zoveel?',
    a: [
      'Because a child of four cannot read, and an instruction they cannot read is not an instruction. Everything that matters is said out loud, and the guide in the corner will say it again as often as your child taps him.',
      'Today that is the phone’s own voice, which is not a warm one. Recorded lines are the plan and the app is built to take them without changing anything else. If you would rather it were quiet, turn the sound off; nothing depends on hearing it twice.',
    ],
    aNl: [
      'Omdat een kind van vier niet leest, en een aanwijzing die je niet kunt lezen geen aanwijzing is. Alles wat ertoe doet wordt hardop gezegd, en de gids in de hoek zegt het nog eens, zo vaak als je kind op hem tikt.',
      'Vandaag is dat de stem van de telefoon zelf, en die is niet warm. Ingesproken zinnen zijn het plan en de app is zo gebouwd dat die erin kunnen zonder dat er verder iets verandert. Wil je liever stilte, zet het geluid uit; niets hangt ervan af dat je het twee keer hoort.',
    ],
  },
  {
    id: 'offline',
    q: 'Does it work without internet?',
    qNl: 'Werkt het zonder internet?',
    a: [
      'The games do, once the app has been opened once: everything is drawn by the app itself and every sound is made by it, so there is nothing to download while playing.',
      'Two things need a connection: the photographs in the animal book and the ones on the dive. Without it they fall back to a drawing and everything carries on working.',
      'What is not built yet is proper offline installation, so a browser that has thrown the app out of its cache will need a moment to fetch it again. On a train in a tunnel that is the one thing that can go wrong.',
    ],
    aNl: [
      'De spellen wel, zodra de app één keer geopend is: alles wordt door de app zelf getekend en elk geluid wordt erdoor gemaakt, dus er valt tijdens het spelen niets te downloaden.',
      'Twee dingen hebben verbinding nodig: de foto’s in het dierenboek en die op de duik. Zonder verbinding vallen die terug op een tekening en werkt de rest gewoon door.',
      'Wat nog niet gebouwd is, is echte offline-installatie. Een browser die de app uit zijn geheugen heeft gegooid, heeft dus even nodig om hem opnieuw op te halen. In een trein in een tunnel is dat het enige wat mis kan gaan.',
    ],
  },
  {
    id: 'break',
    q: 'Can my child break something, or buy something?',
    qNl: 'Kan mijn kind iets kapotmaken of per ongeluk iets kopen?',
    a: [
      'No. There is nothing to buy anywhere in the app, and no link that leaves it except the one on this page.',
      'This screen is behind a four-digit code so that a child cannot change their own limits. It is a speed bump, not a lock: a nine-year-old who watches you type it knows it. That is fine, because there is nothing behind it that is dangerous, only settings that are yours to make.',
    ],
    aNl: [
      'Nee. Er valt nergens in de app iets te kopen, en er is geen link die eruit leidt behalve die op deze pagina.',
      'Dit scherm zit achter een code van vier cijfers, zodat een kind zijn eigen limiet niet kan verzetten. Het is een drempel, geen slot: een negenjarige die meekijkt terwijl jij hem intypt, kent hem. Dat geeft niet, want erachter zit niets gevaarlijks, alleen instellingen die aan jou zijn.',
    ],
  },
  {
    id: 'photos',
    q: 'Where do the photographs come from?',
    qNl: 'Waar komen de foto’s vandaan?',
    a: [
      'The planets and moons are NASA and ESA frames, which are in the public domain. The animals and the creatures on the dive come from Wikimedia Commons, under licences that allow it, and each one is credited with its photographer and its licence on the screen where it is shown.',
      'Nothing is generated. If a picture in here is of a sperm whale, it is a photograph of a sperm whale.',
    ],
    aNl: [
      'De planeten en manen zijn opnamen van NASA en ESA, die publiek domein zijn. De dieren en de beesten op de duik komen van Wikimedia Commons, onder licenties die dat toestaan, en bij elk staat de fotograaf en de licentie op het scherm waar hij te zien is.',
      'Er is niets gegenereerd. Staat er een potvis, dan is het een foto van een potvis.',
    ],
  },
];

/** The subjects that are actually in the app, with what each one is for. */
export const DOMAIN_HELP: Record<Domain, [string, string]> = {
  taal: ['Language', 'Hearing the separate sounds in a spoken word and building one back out of letters - the step that comes before reading.'],
  rekenen: ['Numbers', 'Counting out, comparing two amounts, sharing fairly, and how many more - handled as objects on a table rather than as sums.'],
  tijd: ['Time', 'Reading a clock face, and the Dutch way of saying it, which is its own puzzle.'],
  vormen: ['Shapes and rules', 'Sorting by one rule and then by another, which is harder than it sounds and is the thing that makes a child flexible.'],
  dieren: ['Animals', 'A few thousand real animals with real photographs: how big, where they live, what they eat, and how to look something up.'],
  dinos: ['Dinosaurs', 'Patience, and recognising a whole animal from the parts of it you have uncovered.'],
  ruimte: ['Space', 'The order of the planets, how far apart things really are, and what a probe has to do to reach one.'],
  techniek: ['How things work', 'Cause and effect you can see: water finding its way down a channel, current finding its way round a circuit.'],
  natuur: ['Nature', 'Tides, weather, rock, the sea - the things that happen whether or not anyone is watching.'],
  muziek: ['Music', 'Holding a beat, long against short, and hearing high from low.'],
  aardrijkskunde: ['The world', 'Where places are in relation to each other, which is the only part of geography that is any use at six.'],
  spel: ['Just a game', 'Some of it is here to be fun. An app that is all homework does not get opened on a Saturday.'],
};

export const DOMAIN_HELP_NL: Record<Domain, [string, string]> = {
  taal: ['Taal', 'De losse klanken in een gesproken woord horen en er met letters weer een woord van bouwen - de stap die vóór lezen komt.'],
  rekenen: ['Rekenen', 'Uittellen, twee hoeveelheden vergelijken, eerlijk delen en hoeveel erbij - als spullen op een tafel en niet als sommen.'],
  tijd: ['Tijd', 'De wijzerplaat lezen, en de Nederlandse manier om hem te zeggen, wat een puzzel op zich is.'],
  vormen: ['Vormen en regels', 'Sorteren op één regel en dan op een andere. Dat is lastiger dan het klinkt en het is precies wat een kind flexibel maakt.'],
  dieren: ['Dieren', 'Een paar duizend echte dieren met echte foto’s: hoe groot, waar ze wonen, wat ze eten, en hoe je iets opzoekt.'],
  dinos: ['Dino’s', 'Geduld, en een heel dier herkennen aan de stukken die je hebt vrijgelegd.'],
  ruimte: ['Ruimte', 'De volgorde van de planeten, hoe ver dingen echt uit elkaar liggen, en wat een sonde moet doen om er te komen.'],
  techniek: ['Hoe dingen werken', 'Oorzaak en gevolg die je kunt zien: water dat zijn weg zoekt door een geul, stroom die zijn weg zoekt door een schakeling.'],
  natuur: ['Natuur', 'Getij, weer, gesteente, de zee - de dingen die gebeuren of er nu iemand kijkt of niet.'],
  muziek: ['Muziek', 'De tel vasthouden, lang tegen kort, en hoog van laag horen.'],
  aardrijkskunde: ['De wereld', 'Waar plekken ten opzichte van elkaar liggen, het enige deel van aardrijkskunde waar je op je zesde iets aan hebt.'],
  spel: ['Gewoon leuk', 'Een deel staat er om leuk te zijn. Een app die alleen maar huiswerk is, gaat op zaterdag niet open.'],
};

/** Which subjects there actually are, with how many things carry each one. */
export function domainsWithCounts(): Array<{ d: Domain; name: string; note: string; n: number }> {
  const counts = new Map<Domain, number>();
  for (const e of CATALOG) for (const d of e.domains) counts.set(d, (counts.get(d) ?? 0) + 1);
  const table = NL() ? DOMAIN_HELP_NL : DOMAIN_HELP;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([d, n]) => ({ d, name: table[d][0], note: table[d][1], n }));
}
