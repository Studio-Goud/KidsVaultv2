/**
 * Every experience in Braambos, as data rather than as prose.
 *
 * This used to live as paragraphs inside the hub's own file: a title, a sentence and an age label,
 * written for a human to read on one screen. That is fine until something else needs to know. A
 * parent who wants "only space and machines, and nothing my six-year-old has outgrown" needs an
 * age range and a subject, not a sentence. A child who is ready for the next thing needs to be
 * offered it. Neither is possible against prose.
 *
 * So: one row per experience, and the hub, the parent screen and whatever comes next all read the
 * same rows.
 *
 * Two fields in here are about the state of the code rather than the child, and they are the
 * honest kind of metadata: `reads` says the thing still cannot be played without reading, and
 * `speaks` says it talks. Fourteen of the sixteen read and one speaks. Those two numbers are the
 * roadmap, and keeping them in the catalogue means nobody has to take my word for it.
 */

/** What an experience is about. A thing can be about more than one. */
export type Domain =
  | 'taal' | 'rekenen' | 'tijd' | 'vormen' | 'dieren' | 'dinos'
  | 'ruimte' | 'techniek' | 'natuur' | 'muziek' | 'aardrijkskunde' | 'spel';

/**
 * Why it exists.
 *
 * "Leuke spellen naast dit alles" was a decision, not an afterthought, so a thing that is only
 * fun is a valid row. An app that is all homework does not get opened on a Saturday.
 */
export type Nature = 'leren' | 'spelen' | 'beide';

export interface Entry {
  /** matches the page: `moonshot` is `moonshot.html` and `__moon` on the window */
  id: string;
  title: string;
  line: string;
  lineNl: string;
  practises: string;
  practisesNl: string;
  /** the youngest age this has something to offer, in years */
  from: number;
  /** the oldest age it still has something to offer */
  to: number;
  domains: Domain[];
  nature: Nature;
  /** a typical sitting, in minutes: low and high */
  minutes: [number, number];
  /** cannot currently be played without reading */
  reads: boolean;
  /** speaks its instructions aloud */
  speaks: boolean;
}

export const CATALOG: Entry[] = [
  {
    id: 'dig', title: 'Opgraving',
    line: 'Brush the dirt away, find the skeleton and name the dinosaur.',
    lineNl: 'Borstel het zand weg, vind het skelet en benoem de dinosaurus.',
    practises: 'Patience, recognising a whole from its parts',
    practisesNl: 'Geduld, het geheel herkennen aan de delen',
    from: 2, to: 8, domains: ['dinos', 'natuur'], nature: 'beide', minutes: [2, 6],
    reads: true, speaks: false,
  },
  {
    id: 'rhythm', title: 'Klankhuis',
    line: 'Nine chimes you can play, and nine levels of beat, bar and tune.',
    lineNl: 'Negen klankstaven om op te spelen, en negen niveaus van tel, maat en melodie.',
    practises: 'Holding a beat, long against short, hearing high from low',
    practisesNl: 'De tel vasthouden, lang tegen kort, hoog van laag horen',
    from: 2, to: 9, domains: ['muziek'], nature: 'beide', minutes: [2, 8],
    reads: true, speaks: false,
  },
  {
    id: 'tidepool', title: 'Getijdenpoel',
    line: 'Sort what the tide brings into the right pools. Then the rule changes.',
    lineNl: 'Sorteer wat het tij brengt in de juiste poelen. Dan verandert de regel.',
    practises: 'Thinking flexibly, switching rule',
    practisesNl: 'Denkflexibiliteit, van regel wisselen',
    from: 3, to: 7, domains: ['vormen', 'natuur'], nature: 'beide', minutes: [3, 6],
    reads: true, speaks: false,
  },
  {
    id: 'market', title: 'Marktdag',
    line: 'Fill the basket with exactly what they asked for, share fairly, and ring the bell.',
    lineNl: 'Vul de mand met precies wat ze vroegen, deel eerlijk, en bel.',
    practises: 'Counting out, sharing fairly, how many more',
    practisesNl: 'Uittellen, eerlijk delen, hoeveel erbij',
    from: 3, to: 7, domains: ['rekenen'], nature: 'beide', minutes: [3, 7],
    reads: true, speaks: false,
  },
  {
    id: 'nightwatch', title: 'Nachtwacht',
    line: 'The sky shows a figure in the stars. The lines fade. Draw it back.',
    lineNl: 'De hemel toont een figuur in de sterren. De lijnen vervagen. Teken hem terug.',
    practises: 'Visual working memory',
    practisesNl: 'Visueel werkgeheugen',
    from: 3, to: 10, domains: ['ruimte', 'vormen'], nature: 'beide', minutes: [3, 8],
    reads: true, speaks: false,
  },
  {
    id: 'animals', title: 'Dierenboek',
    line: 'Thousands of real animals with real photographs: how big, where they live, what they eat.',
    lineNl: "Duizenden echte dieren met echte foto's: hoe groot, waar ze wonen en wat ze eten.",
    practises: 'Looking closely, comparing sizes, sorting into groups, looking something up',
    practisesNl: 'Goed kijken, groottes vergelijken, in groepen indelen, iets opzoeken',
    from: 3, to: 10, domains: ['dieren', 'natuur'], nature: 'leren', minutes: [2, 15],
    reads: true, speaks: false,
  },
  {
    id: 'mill', title: 'Watermolen',
    line: 'Dig channels and the water finds its own way to the fields and the mill.',
    lineNl: 'Graaf geulen en het water vindt zelf zijn weg naar de akkers en de molen.',
    practises: 'Spatial reasoning, thinking ahead, cause and effect, saving up',
    practisesNl: 'Ruimtelijk inzicht, vooruitdenken, oorzaak en gevolg, sparen',
    from: 4, to: 9, domains: ['natuur', 'techniek'], nature: 'beide', minutes: [4, 10],
    reads: true, speaks: false,
  },
  {
    id: 'letters', title: 'Letterbos',
    line: 'Build Dutch words out of their sounds: hear the word, hear the sounds, drag the letters.',
    lineNl: 'Bouw Nederlandse woorden uit hun klanken: hoor het woord, hoor de klanken, sleep de letters.',
    practises: 'Hearing the sounds in a word, building one from them, ei and ij, au and ou',
    practisesNl: 'De klanken in een woord horen, er een woord van bouwen, ei en ij, au en ou',
    from: 4, to: 7, domains: ['taal'], nature: 'leren', minutes: [4, 8],
    reads: false, speaks: true,
  },
  {
    id: 'orbit', title: 'Planetarium',
    line: 'Order the planets, explore them in NASA photographs, and launch probes to reach them.',
    lineNl: 'Zet de planeten op volgorde, verken ze in NASA-opnamen en lanceer sondes om ze te bereiken.',
    practises: 'Ordering, comparing sizes, predicting motion, knowing the solar system',
    practisesNl: 'Ordenen, groottes vergelijken, beweging voorspellen, het zonnestelsel kennen',
    from: 4, to: 10, domains: ['ruimte'], nature: 'leren', minutes: [4, 12],
    reads: true, speaks: false,
  },
  {
    id: 'puffball', title: 'Stuifzwam',
    line: 'Put down a puffball, count how far it reaches, and be somewhere else when it pops.',
    lineNl: 'Leg een stuifzwam neer, tel hoe ver hij reikt, en sta ergens anders als hij afgaat.',
    practises: 'Counting squares, comparing two numbers, planning a way out',
    practisesNl: 'Vakjes tellen, twee getallen vergelijken, een uitweg plannen',
    from: 5, to: 9, domains: ['rekenen', 'spel'], nature: 'beide', minutes: [3, 8],
    reads: true, speaks: false,
  },
  {
    id: 'numbers', title: 'Rekenrijk',
    line: 'Every sum is something you can see and move: beads, crates, a ten-frame, a number line.',
    lineNl: 'Elke som is iets wat je kunt zien en verschuiven: kralen, kisten, een tienveld, een getallenlijn.',
    practises: 'Splitting to ten, adding and taking away, over the ten, the tables',
    practisesNl: 'Splitsen tot 10, erbij en eraf, over het tiental, tientallen, de tafels',
    from: 5, to: 9, domains: ['rekenen'], nature: 'leren', minutes: [4, 10],
    reads: true, speaks: false,
  },
  {
    id: 'clock', title: 'Klokkijken',
    line: 'Read the analogue clock and the digital clock, and learn to say it out loud.',
    lineNl: 'Lees de analoge en de digitale klok, en leer het hardop zeggen.',
    practises: 'Reading both clocks, saying the time in Dutch, counting on in minutes',
    practisesNl: 'De analoge en digitale klok lezen, de tijd in het Nederlands zeggen, minuten doortellen',
    from: 5, to: 9, domains: ['tijd'], nature: 'leren', minutes: [4, 10],
    reads: true, speaks: false,
  },
  {
    id: 'circuit', title: 'Stroomkring',
    line: 'A bench of real parts and real physics. Close the loop and the lamp lights.',
    lineNl: 'Een werkbank met echte onderdelen en echte natuurkunde. Maak de kring rond en het lampje brandt.',
    practises: 'Cause and effect, reading a circuit, series against parallel, finding your own mistake',
    practisesNl: 'Oorzaak en gevolg, een schakeling lezen, serie tegen parallel, je eigen fout vinden',
    from: 6, to: 10, domains: ['techniek'], nature: 'leren', minutes: [5, 15],
    reads: true, speaks: false,
  },
  {
    id: 'moonshot', title: 'Moonshot',
    line: 'A workshop with a hundred parts and nothing locked. Build the rocket you want and fly it.',
    lineNl: 'Een werkplaats met honderd onderdelen en niets op slot. Bouw de raket die jij wilt en vlieg ermee.',
    practises: 'Weighing things up, cause and effect, shape against speed',
    practisesNl: 'Afwegen, oorzaak en gevolg, vorm tegen snelheid',
    from: 6, to: 10, domains: ['ruimte', 'techniek'], nature: 'beide', minutes: [5, 20],
    reads: true, speaks: false,
  },
  {
    id: 'atlas', title: 'Wereldatlas',
    line: 'Drag provinces, rivers, countries and flags onto a drawn map, from your own province outward.',
    lineNl: 'Sleep provincies, rivieren, landen en vlaggen op een getekende kaart, van je eigen provincie naar buiten.',
    practises: 'Where things are, reading a map, the Netherlands, Europe and the world',
    practisesNl: 'Waar dingen liggen, kaartlezen, Nederland, Europa en de wereld',
    from: 6, to: 10, domains: ['aardrijkskunde'], nature: 'leren', minutes: [5, 12],
    reads: true, speaks: false,
  },
  {
    id: 'cloudhopper', title: 'Cloudhopper',
    line: 'Draw a route for every incoming aircraft and bring it safely down.',
    lineNl: 'Teken voor elk binnenkomend toestel een route en breng het veilig aan de grond.',
    practises: 'Dividing attention, planning ahead, holding back',
    practisesNl: 'Aandacht verdelen, vooruit plannen, impuls remmen',
    from: 7, to: 10, domains: ['spel', 'techniek'], nature: 'beide', minutes: [5, 20],
    reads: true, speaks: false,
  },
];

export const byId = (id: string): Entry | undefined => CATALOG.find(e => e.id === id);

/** Everything a child of this age has something to do with. */
export const forAge = (years: number): Entry[] =>
  CATALOG.filter(e => years >= e.from && years <= e.to);

/** Everything about one subject. */
export const inDomain = (d: Domain): Entry[] => CATALOG.filter(e => e.domains.includes(d));

/** Every subject that has something in it, in the order the catalogue lists them. */
export function domainsPresent(): Domain[] {
  const seen: Domain[] = [];
  for (const e of CATALOG) for (const d of e.domains) if (!seen.includes(d)) seen.push(d);
  return seen;
}

/**
 * How well an age is served, which is the number that says where to build next.
 *
 * At the time of writing: two things for a two-year-old and sixteen for an eight-year-old. That
 * is the gap the whole roadmap is about, and it is a function rather than a claim so it cannot
 * quietly stop being true.
 */
export const coverage = (years: number): number => forAge(years).length;
